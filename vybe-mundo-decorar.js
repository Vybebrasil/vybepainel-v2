// vybe-mundo-decorar.js — Modo decorar na sala voxel da própria pessoa (Irecity, 07/11/2026).
//
// O andar por dentro (mundo/sala.mjs, abrirAndar) já mostra a decoração salva de cada sala. Montar e
// decorar a própria sala, porém, só existia no editor do Escritório (Habbo), que fica escondido no
// Irecity. Este painel faz isso na sala voxel, com a MESMA gravação do editor
// (vybe-escritorio-editor.js, salvarEditorEscritorio): a rota escritorio/mapa (escritorioApi), a camada
// "sala-N", o item [classe, x, y, direção, estado, altura, config?] em ladrilhos da sala, a versão da
// camada (conflito = 409) e o acabamento (piso e parede) no mesmo pedido, pelo mesmo escritorioAcabamento.
// O inventário é o da economia do Escritório (escritorioApi('economia'), lido ao abrir, como o editor) e o
// servidor confere tudo de novo ao salvar (dono, inventário dos dois andares, planta, versão). Sem rota nova.
//
//   VybeDecorar.ligarCena(cena, modulo)  cena = o retorno de abrirAndar (andarAberto); modulo = mundo-3d (ícones)
//   VybeDecorar.salaDecoravel(ids)       → a sala da lista que quem está logado pode decorar, ou ''
//   VybeDecorar.podeDecorar(salaId)      → boolean
//   VybeDecorar.acabamentoDaSala(salaId) → { piso: [cor, cor] | null, parede: '#hex' | null } (para a cena)
//   VybeDecorar.abrir(salaId)            → Promise<boolean>
//   VybeDecorar.fechar({ forcar })       → Promise<boolean> (com mudança sem salvar, pergunta antes)
//   VybeDecorar.aberto()                 → boolean
//
// Quem decora: só o dono da sala, a mesma regra do servidor (server/escritorio-mapa.js, conferirEdicao) e do
// editor (escritorioPodeEditar). Quem administra NÃO decora a sala de outra pessoa (decisão do Paulo,
// 19/10/2026, AGENTS.md "Edição de decoração": "não autorizar só por admin"); as salas comuns e a Praça
// continuam com o Paulo, no editor do Escritório.
(function () {
  'use strict';
  const raiz = typeof window !== 'undefined' ? window : globalThis;
  const MUNDO_JS = "/assets/mundo/mundo-3d.js";
  const CAMADA = /^sala-\d+$/, IMAGEM = /^vybeimg_\d+$/, CLASSE = /^[a-z0-9_]{1,64}$/i;
  const ABAS = [['moveis', 'Móveis'], ['piso', 'Piso'], ['parede', 'Parede']];
  // As cores de parede do Escritório (ESCRITORIO_PAREDES_SALA) só têm amostra; aqui ganham nome.
  const NOMES_PAREDE = { '': 'Cor da sala', '#ff8a35': 'Laranja', '#ffb347': 'Damasco', '#ffd166': 'Amarelo', '#ff6fa8': 'Rosa', '#e05a5a': 'Vermelho', '#b48cff': 'Lilás',
    '#7c6cff': 'Violeta', '#5aa9ff': 'Azul', '#5ad1e6': 'Turquesa', '#7ee08a': 'Verde-claro', '#3fb68b': 'Verde', '#e8e8ee': 'Gelo', '#8a8f9c': 'Cinza' };
  const ICONE = {
    fechar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    girar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>',
    guardar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v4H3z"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>',
    desfazer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
    loja: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
  };
  const estado = {
    raiz: null, antes: null, cena: null, modulo: null, sala: '', nome: '', aba: 'moveis',
    itens: [], decoracao: {}, versao: 0, original: null, passos: [], futuro: [], inicial: '',
    sel: null, naMao: '', editando: false, carregando: false, salvando: false, semQuarto: false, erroAbrir: '', erro: '', aviso: '',
  };
  const icones = new Map(), medidas = new Map();

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const copiar = (itens) => (Array.isArray(itens) ? itens : []).filter(Array.isArray).map((it) => [...it]);
  const base = () => (typeof escritorio !== 'undefined' && escritorio ? escritorio.base : null);
  const chamar = (f, ...a) => { try { return typeof f === 'function' ? f(...a) : undefined; } catch (e) { console.error('[decorar]', e); return undefined; } };

  // ---------- quem pode ----------
  // A regra do servidor (conferirEdicao): a camada é uma sala individual e o dono dela é quem está logado.
  // A do editor (escritorioPodeEditar, vybe-escritorio-editor.js:10) diz o mesmo, mais o mapa editável
  // (ou a demonstração). Não vale admin.
  function podeDecorar(salaId) {
    const b = base(), id = String(salaId || '');
    if (!b || !CAMADA.test(id) || b.convidado || raiz.ESCRITORIO_CONVIDADO) return false;
    if (!b.mapa?.editavel && !b.demo) return false;
    return (b.salas || []).some((s) => s.id === id && s.pessoa_id != null && String(s.pessoa_id) === String(b.eu));
  }
  const salaDecoravel = (ids) => (Array.isArray(ids) ? ids : []).map(String).find(podeDecorar) || '';

  // ---------- acabamento (piso e parede) ----------
  const listaPisos = () => (typeof ESCRITORIO_PISOS_SALA !== 'undefined' && Array.isArray(ESCRITORIO_PISOS_SALA) ? ESCRITORIO_PISOS_SALA : []);
  const listaParedes = () => (typeof ESCRITORIO_PAREDES_SALA !== 'undefined' && Array.isArray(ESCRITORIO_PAREDES_SALA) ? ESCRITORIO_PAREDES_SALA : []);
  function coresDoPiso(id) {
    const c = id && typeof ESCRITORIO_PLANTA !== 'undefined' ? ESCRITORIO_PLANTA?.PISO?.[id] : null;
    return Array.isArray(c) && c.length === 2 ? [...c] : null;
  }
  function ambiente(id = estado.sala) { return chamar(typeof escritorioAmbienteDoQuarto === 'function' ? escritorioAmbienteDoQuarto : null, id) || null; }
  // O mesmo recorte de campos que o editor manda (ESCRITORIO_ACABAMENTO, vybe-escritorio-editor.js:2554).
  function acabamento(p) {
    if (typeof escritorioAcabamento === 'function') return escritorioAcabamento(p);
    return Object.fromEntries(Object.entries(p || {}).filter(([k]) => /^sala_(piso|parede|piso_plano|parede_plano|pisos|paredes|paredes_texturas|taca|luz|porta|sem_paredes|espessura_parede|espessura_piso|altura_parede)$/.test(k)));
  }
  const paraCena = (d) => ({ piso: coresDoPiso(d?.sala_piso), parede: /^#[0-9a-f]{6}$/i.test(String(d?.sala_parede || '')) ? d.sala_parede : null });
  function acabamentoDaSala(salaId) {
    const perfil = chamar(typeof escritorioPerfilDecoracao === 'function' ? escritorioPerfilDecoracao : null, String(salaId || ''));
    return paraCena(perfil);
  }

  // ---------- inventário (o do Escritório) ----------
  function quantidade(classe) {
    // escritorioQuantidadeMovel: essenciais e imagens não acabam; o resto é o que o inventário tem.
    if (typeof escritorioQuantidadeMovel === 'function') { try { return escritorioQuantidadeMovel(classe); } catch { /* sem a lista dos essenciais */ } }
    return Number(base()?.economia?.inventario?.find((i) => i.classe === classe)?.quantidade || 0);
  }
  // As unidades do segundo andar contam junto, como no servidor e em escritorioOutrosAndares.
  const outroAndar = () => base()?.mapa?.camadas?.[estado.sala + '-andar-1']?.itens || [];
  const colocados = (classe) => [...estado.itens, ...outroAndar()].filter((it) => it?.[0] === classe).length;
  function essenciais() { const b = base(); return new Set([...(b?.quartos?.essenciais || []), ...(b?.economia?.essenciais || [])]); }
  function ehVoxel(classe) { return Boolean(estado.modulo?.CATALOGO?.some?.((p) => p.classe === classe)); }
  function nomeDe(classe) {
    const v = chamar(estado.modulo?.pecaDaClasse, classe);
    if (v?.nome) return v.nome;
    if (IMAGEM.test(classe)) return 'Imagem da equipe';
    return chamar(typeof escritorioNomeDaClasse === 'function' ? escritorioNomeDaClasse : null, classe) || classe;
  }
  // Móveis guardados (os de construção, grátis, ficam no editor do Escritório): quantos livres para pôr.
  function inventario() {
    const ess = essenciais();
    return (base()?.economia?.inventario || [])
      .filter((i) => CLASSE.test(String(i?.classe || '')) && Number(i.quantidade) > 0 && !ess.has(i.classe) && !IMAGEM.test(i.classe))
      .map((i) => {
        const tem = quantidade(i.classe), naSala = colocados(i.classe);
        return { classe: i.classe, nome: nomeDe(i.classe), tem, naSala, livres: tem === Infinity ? Infinity : Math.max(0, tem - naSala), voxel: ehVoxel(i.classe) };
      })
      .sort((a, b) => (Number(b.voxel) - Number(a.voxel)) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function iconeDe(classe) {
    if (!icones.has(classe)) {
      let url = '';
      try { url = estado.modulo?.iconeMovel?.(classe, 72, 72)?.toDataURL?.() || ''; } catch { /* sem WebGL: fica o quadrado */ }
      if (url || estado.modulo) icones.set(classe, url);
      return url;
    }
    return icones.get(classe);
  }
  function iconeHtml(classe, lado) {
    const url = iconeDe(classe);
    return url ? `<img src="${esc(url)}" alt="" width="${lado}" height="${lado}" loading="lazy">` : '<span class="vv-decorar-sem-icone" aria-hidden="true"></span>';
  }
  // Peças de parede: as do acervo (escritorioEhParede) vão encostadas numa parede; a imagem da equipe fica onde está.
  function tipoDeParede(classe) {
    if (IMAGEM.test(String(classe))) return 'imagem';
    return chamar(typeof escritorioEhParede === 'function' ? escritorioEhParede : null, classe) ? 'parede' : '';
  }
  // Onde a peça de parede encosta, como escritorioLugarParede + escritorioTemParede (vybe-escritorio-editor.js:2096-2111),
  // que dependem do editor aberto no mapa: a parede de trás (direção 4) ou a da esquerda (2), a mais perto do ponto.
  function lugarParede(x, y, fx, fy) {
    const a = ambiente();
    if (!a) return null;
    const dim = chamar(typeof escritorioDimQuarto === 'function' ? escritorioDimQuarto : null, a) || { w: (a.x1 - a.x0) || 0, h: (a.y1 - a.y0) || 0 };
    if (x < 0 || y < 0 || x >= dim.w || y >= dim.h) return null;
    const paredes = chamar(typeof escritorioParedesDoQuarto === 'function' ? escritorioParedesDoQuarto : null, a) || [];
    const X = (a.x0 || 0) + x, Y = (a.y0 || 0) + y;
    const tem = (eixo) => paredes.some(([x0, y0, x1, y1]) => (eixo === 'x' ? y0 === y1 && y0 === Y && X >= x0 && X < x1 : x0 === x1 && x0 === X && Y >= y0 && Y < y1));
    const op = [];
    if (tem('x')) op.push({ dist: fy - y, dir: 4 });
    if (tem('y')) op.push({ dist: fx - x, dir: 2 });
    if (!op.length) return null;
    return { lx: x, ly: y, dir: op.sort((p, q) => p.dist - q.dist)[0].dir };
  }
  // Tamanho e direções de cada móvel, pelo arquivo do Habbo que o mapa do Escritório já carrega
  // (mapaCarregarMovel; as mesmas contas de mapaDimensoes e de escritorio.mapa.medidas). Sem o arquivo,
  // os giros do catálogo (escritorioGirosDe).
  function direcoesDoCatalogo(classe) {
    const g = Number(chamar(typeof escritorioGirosDe === 'function' ? escritorioGirosDe : null, classe)) || 0;
    return g >= 4 ? [0, 2, 4, 6] : g === 2 ? [2, 4] : g === 1 ? [4] : null;
  }
  async function medirClasses(classes) {
    const novas = [];
    await Promise.all([...new Set(classes)].filter((c) => CLASSE.test(c) && !IMAGEM.test(c) && !medidas.has(c)).map(async (c) => {
      medidas.set(c, null);
      let m = null;
      try {
        if (typeof mapaCarregarMovel === 'function') {
          const { dados } = await mapaCarregarMovel(c);
          const d = dados?.logic?.model?.dimensions || {};
          const dirs = Object.keys(dados?.visualizations?.find?.((v) => v.size === 64)?.directions || {}).map(Number);
          m = { x: d.x, y: d.y, direcoes: dirs.length ? dirs : direcoesDoCatalogo(c) };
        }
      } catch { /* sem a arte do Habbo: só os giros do catálogo */ }
      if (!m) { const dirs = direcoesDoCatalogo(c); if (dirs) m = { direcoes: dirs }; }
      medidas.set(c, m);
      if (m) novas.push([c, m]);
    }));
    if (novas.length && estado.editando) chamar(estado.cena?.medidas, novas);
  }

  // ---------- rascunho e desfazer ----------
  const foto = () => JSON.stringify({ itens: estado.itens, decoracao: estado.decoracao });
  const mudou = () => Boolean(estado.inicial) && foto() !== estado.inicial;
  const mudancas = () => Math.max(0, estado.passos.length - 1);
  function registrar() {
    const f = foto();
    if (f === estado.passos.at(-1)) return;
    estado.passos.push(f); estado.futuro = [];
    if (estado.passos.length > 80) estado.passos.shift();
  }
  function aplicarFoto(f) {
    const d = JSON.parse(f);
    estado.itens = copiar(d.itens); estado.decoracao = { ...d.decoracao }; estado.sel = null;
    chamar(estado.cena?.definirItens, estado.itens, estado.sala);
    chamar(estado.cena?.definirAcabamento, estado.sala, paraCena(estado.decoracao));
  }
  function desfazer() {
    if (!estado.editando || estado.salvando || estado.passos.length < 2) return false;
    estado.futuro.push(estado.passos.pop());
    aplicarFoto(estado.passos.at(-1));
    avisar('Desfeito.'); pintar();
    return true;
  }
  function refazer() {
    if (!estado.editando || estado.salvando || !estado.futuro.length) return false;
    const f = estado.futuro.pop();
    estado.passos.push(f); aplicarFoto(f);
    avisar('Refeito.'); pintar();
    return true;
  }

  // ---------- o que a cena conta ----------
  function aoMudar(itens, info = {}) {
    estado.itens = copiar(itens);
    if (info.tipo === 'guardar' && info.item) estado.aviso = `${nomeDe(info.item[0])} saiu da sala e volta ao inventário quando você salvar.`;
    else if (info.tipo === 'por') { estado.naMao = ''; estado.aviso = `${nomeDe(info.classe)} na sala. Arraste para ajustar; R gira.`; }
    else estado.aviso = '';
    registrar(); pintar();
  }
  function aoSelecionar(i) { estado.sel = Number.isInteger(i) ? i : null; pintar(); }
  function aoSegurar(classe) { estado.naMao = classe || ''; pintar(); }
  function avisar(texto) {
    estado.aviso = String(texto || '');
    const el = estado.raiz?.querySelector?.('.vv-decorar-aviso');
    if (el) el.textContent = estado.aviso;
  }

  // ---------- ações ----------
  function segurar(classe) {
    if (!estado.editando || estado.salvando) return false;
    if (estado.naMao === classe) { chamar(estado.cena?.segurar, null); return false; }
    const m = inventario().find((x) => x.classe === classe);
    if (!m) return false;
    if (!(m.livres === Infinity || m.livres > 0)) { avisar('Todas as unidades deste móvel já estão na sala. Compre outra na Loja.'); return false; }
    medirClasses([classe]);
    chamar(estado.cena?.segurar, classe);
    estado.naMao = classe;
    avisar(tipoDeParede(classe) === 'parede' ? 'Clique no piso encostado numa parede para pendurar.' : 'Clique no chão da sala para pôr. R gira antes de pôr.');
    pintar();
    return true;
  }
  function selecionar(i) { if (estado.editando) chamar(estado.cena?.selecionar, Number(i)); }
  // Piso: o "Piso inteiro" do Escritório (estiloSalaEscritorio('sala_piso', id, true)): a sala toda muda e a
  // pintura feita ladrilho a ladrilho sai. Vale ao salvar, junto com os móveis.
  function escolherPiso(id) {
    if (!estado.editando || estado.salvando || !listaPisos().some(([k]) => k === id)) return false;
    estado.decoracao = { ...estado.decoracao, sala_piso: id, sala_pisos: '' };
    chamar(estado.cena?.definirAcabamento, estado.sala, paraCena(estado.decoracao));
    registrar(); avisar(`Piso: ${listaPisos().find(([k]) => k === id)?.[1] || id}. Salve para ficar.`); pintar();
    return true;
  }
  // Parede: a cor das paredes da sala (estiloSalaEscritorio('sala_parede', cor)).
  function escolherParede(cor) {
    if (!estado.editando || estado.salvando || !listaParedes().includes(cor)) return false;
    estado.decoracao = { ...estado.decoracao, sala_parede: cor };
    chamar(estado.cena?.definirAcabamento, estado.sala, paraCena(estado.decoracao));
    registrar(); avisar(`Parede: ${NOMES_PAREDE[cor] || cor}. Salve para ficar.`); pintar();
    return true;
  }
  function trocarAba(id) {
    if (!ABAS.some(([k]) => k === id) || estado.aba === id) return;
    estado.aba = id;
    if (id !== 'moveis' && estado.naMao) chamar(estado.cena?.segurar, null);
    pintar();
    estado.raiz?.querySelector?.(`[data-vd-aba="${id}"]`)?.focus?.();
  }
  // A Loja de sempre (o atalho "Catálogo (loja)" da Equipe). Comprou: ao fechar, o inventário é relido.
  function abrirLoja() {
    if (typeof abrirCatalogoEscritorio !== 'function') { avisar('A Loja não está disponível agora.'); return; }
    abrirCatalogoEscritorio();
    let tentativas = 0;
    const ligar = () => {
      const d = document.getElementById?.('office-catalogo');
      if (d && !d.dataset?.vdDecorar) { d.dataset.vdDecorar = '1'; d.addEventListener('close', () => { if (estado.editando) recarregarInventario(); }); }
      else if (!d && ++tentativas < 20) setTimeout(ligar, 250);
    };
    ligar();
  }
  async function recarregarInventario() {
    const b = base();
    if (!b || b.demo || typeof escritorioApi !== 'function') return;
    try { b.economia = (await escritorioApi('economia')).economia; pintar(); } catch (e) { avisar(e?.message || 'O inventário não atualizou.'); }
  }

  // Grava como o editor do Escritório (salvarEditorEscritorio): a camada inteira, a versão que foi lida e o
  // acabamento. Depois, o mesmo que ele faz: guarda a versão nova no mapa do Escritório e avisa a sala.
  async function salvar() {
    const b = base();
    if (!estado.editando || estado.salvando || !mudou() || !b) return false;
    estado.salvando = true; estado.erro = ''; pintar();
    const camada = estado.sala, itens = copiar(estado.itens), decoracao = acabamento(estado.decoracao);
    try {
      let r = { camada, itens, versao: estado.versao + 1 };
      if (!b.demo) r = await escritorioApi('mapa', { camada, itens, versao: estado.versao, decoracao });
      if (typeof escritorio !== 'undefined' && escritorio) {
        if (r.perfil) escritorio.perfil = { ...escritorio.perfil, ...r.perfil };
        else if (b.demo) escritorio.perfil = Object.assign(escritorio.perfil || {}, decoracao);
      }
      b.mapa = b.mapa || { editavel: true, camadas: {} };
      b.mapa.camadas = b.mapa.camadas || {};
      b.mapa.camadas[camada] = { itens: r.itens, versao: r.versao, em: new Date().toISOString() };
      chamar(typeof escritorioAplicarSalas === 'function' ? escritorioAplicarSalas : null);
      // O Escritório (escondido no Irecity) mostrando esta sala: redesenha piso, paredes e móveis.
      if (typeof escritorio !== 'undefined' && escritorio?.quarto === camada) chamar(typeof escritorioRedesenharMapa === 'function' ? escritorioRedesenharMapa : null);
      chamar(typeof escritorioAvisarDecoracao === 'function' ? escritorioAvisarDecoracao : null, camada);
      estado.versao = Number(r.versao) || estado.versao + 1;
      estado.itens = copiar(r.itens);
      estado.original = { itens: copiar(estado.itens), decoracao: { ...estado.decoracao } };
      estado.passos = [foto()]; estado.inicial = estado.passos[0]; estado.futuro = []; estado.sel = null;
      chamar(estado.cena?.definirItens, estado.itens, camada);
      estado.aviso = `Mudanças salvas em ${estado.nome}.`;
      return true;
    } catch (e) {
      estado.erro = e?.status === 409 ? `${e.message} Suas mudanças continuam aqui.` : (e?.message || 'Não foi possível salvar.');
      return false;
    } finally {
      estado.salvando = false; pintar();
    }
  }

  async function perguntar(mensagem, confirmar) {
    if (typeof confirmarNoPainel === 'function') return confirmarNoPainel(mensagem, { confirmar, perigo: true });
    return typeof raiz.confirm === 'function' ? raiz.confirm(mensagem) : true;
  }
  async function fechar({ forcar = false } = {}) {
    if (!estado.raiz) return true;
    if (estado.salvando && !forcar) return false;
    if (estado.editando && mudou() && !forcar) {
      if (!await perguntar('Sair sem salvar?\nAs mudanças desta decoração não ficam na sala.', 'Sair sem salvar')) return false;
      if (!estado.raiz) return true;
    }
    // A sala volta a ser a salva e para de responder à edição.
    if (estado.editando) {
      if (mudou() && estado.original) {
        chamar(estado.cena?.definirItens, estado.original.itens, estado.sala);
        chamar(estado.cena?.definirAcabamento, estado.sala, paraCena(estado.original.decoracao));
      }
      chamar(estado.cena?.pararEdicao);
    }
    raiz.removeEventListener?.('keydown', teclaGlobal, true);
    estado.raiz.remove?.();
    document.body?.classList?.remove?.('vv-decorando');
    const antes = estado.antes;
    Object.assign(estado, { raiz: null, antes: null, sala: '', nome: '', itens: [], decoracao: {}, original: null, passos: [], futuro: [], inicial: '',
      sel: null, naMao: '', editando: false, carregando: false, salvando: false, semQuarto: false, erroAbrir: '', erro: '', aviso: '' });
    if (antes?.isConnected) antes.focus?.();
    return true;
  }

  // Abre a cena para a edição: inventário fresco (como abrirEditorEscritorio), catálogo, móveis e acabamento salvos.
  async function preparar() {
    const b = base(), id = estado.sala;
    estado.carregando = true; estado.erroAbrir = ''; pintar();
    try {
      if (!b.demo && typeof escritorioApi === 'function') b.economia = (await escritorioApi('economia')).economia;
      if (typeof carregarCatalogoEscritorio === 'function' && (typeof escritorioCatalogo === 'undefined' || !escritorioCatalogo)) await carregarCatalogoEscritorio();
      if (!estado.modulo) { try { estado.modulo = await import(MUNDO_JS); } catch { estado.modulo = null; } }
    } catch (e) {
      estado.carregando = false; estado.erroAbrir = e?.message || 'Não foi possível ler o inventário.'; pintar();
      return false;
    }
    if (estado.sala !== id || !estado.raiz) return false;
    const perfil = chamar(typeof escritorioPerfilDecoracao === 'function' ? escritorioPerfilDecoracao : null, id);
    // Quarto ainda não montado: o servidor recusa ("Configure seu quarto antes de decorar").
    if (b.economia?.disponivel && !perfil?.quarto_configurado) { estado.carregando = false; estado.semQuarto = true; pintar(); return false; }
    const salvos = typeof escritorioItensDaCamada === 'function' ? chamar(escritorioItensDaCamada, id) : b.mapa?.camadas?.[id]?.itens;
    estado.itens = copiar(salvos);
    estado.versao = Number(b.mapa?.camadas?.[id]?.versao || 0);
    estado.decoracao = acabamento(perfil || {});
    estado.original = { itens: copiar(estado.itens), decoracao: { ...estado.decoracao } };
    estado.passos = [foto()]; estado.inicial = estado.passos[0]; estado.futuro = [];
    const ok = chamar(estado.cena?.iniciarEdicao, {
      sala: id, itens: copiar(estado.itens), aoMudar, aoSelecionar, aoSegurar, aoAviso: avisar, aoSair: () => { fechar(); },
      tipoDeParede, lugarParede,
    });
    estado.carregando = false;
    if (!ok) { estado.erroAbrir = 'Esta sala não abriu para decorar neste andar. Feche o andar e entre de novo.'; pintar(); return false; }
    estado.editando = true;
    chamar(estado.cena?.definirAcabamento, id, paraCena(estado.decoracao));
    medirClasses(estado.itens.map((it) => it[0]));
    pintar();
    estado.raiz?.querySelector?.('[role="tab"][aria-selected="true"]')?.focus?.();
    return true;
  }
  async function abrir(salaId) {
    const id = String(salaId || '');
    if (estado.raiz) { if (estado.sala === id) return true; if (!await fechar()) return false; }
    if (!estado.cena?.iniciarEdicao) return false;
    if (!podeDecorar(id)) return false;
    if (typeof escritorio !== 'undefined' && escritorio?.edicao) {
      chamar(typeof escritorioAviso === 'function' ? escritorioAviso : null, 'Feche a construção do Escritório antes de decorar no Irecity.');
      return false;
    }
    estado.antes = document.activeElement || null;
    Object.assign(estado, { sala: id, nome: chamar(typeof escritorioNomeCamada === 'function' ? escritorioNomeCamada : null, id) || 'Sua sala', aba: 'moveis' });
    const r = document.createElement('section');
    r.id = 'vv-decorar'; r.className = 'vv-decorar';
    r.setAttribute('role', 'region'); r.setAttribute('aria-labelledby', 'vv-decorar-titulo');
    r.addEventListener('click', aoClicar);
    r.addEventListener('keydown', teclaNasAbas);
    document.body.append(r);
    document.body.classList?.add?.('vv-decorando');
    estado.raiz = r;
    raiz.addEventListener?.('keydown', teclaGlobal, true);
    await preparar();
    return true;
  }
  function ligarCena(cena, modulo = null) {
    // O andar fechou (ou outro abriu): a edição da cena antiga acaba sem gravar nada.
    if (estado.raiz && estado.cena && cena !== estado.cena) fechar({ forcar: true });
    estado.cena = cena || null;
    if (modulo) estado.modulo = modulo;
  }

  // ---------- desenho ----------
  const vazio = (titulo, texto, extra = '') => `<div class="vv-decorar-vazio"><b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ''}${extra}</div>`;
  const botaoLoja = () => (typeof abrirCatalogoEscritorio === 'function' ? `<button type="button" class="vv-decorar-botao" data-vd-acao="loja">${ICONE.loja}Abrir a Loja</button>` : '');
  function htmlTopo() {
    const n = mudancas(), sujo = mudou();
    const status = estado.salvando ? 'Salvando…' : sujo ? `${n || 1} ${(n || 1) === 1 ? 'mudança' : 'mudanças'} sem salvar` : estado.editando ? 'Tudo salvo' : '';
    return `<div class="vv-decorar-topo"><div class="vv-decorar-cab"><span class="vv-decorar-kicker">Decorar</span><h2 id="vv-decorar-titulo">${esc(estado.nome)}</h2>
      <p class="vv-decorar-status${sujo ? ' sujo' : ''}">${esc(status)}</p></div>
      <button type="button" class="vv-decorar-x" data-vd-acao="sair" aria-label="Sair do modo decorar" title="Sair (Esc)">${ICONE.fechar}</button></div>`;
  }
  function htmlAbas() {
    return `<div class="vv-decorar-abas" role="tablist" aria-label="O que decorar">${ABAS.map(([id, nome]) => `<button type="button" role="tab" id="vv-decorar-aba-${id}" aria-selected="${estado.aba === id}" aria-controls="vv-decorar-corpo" tabindex="${estado.aba === id ? 0 : -1}" data-vd-aba="${id}">${nome}</button>`).join('')}</div>`;
  }
  function htmlBarra() {
    if (!estado.editando) return '';
    if (estado.naMao) return `<div class="vv-decorar-barra na-mao" role="group" aria-label="Móvel na mão"><span class="vv-decorar-barra-txt"><small>Na mão</small><b>${esc(nomeDe(estado.naMao))}</b><em>Clique no chão da sala para pôr · R gira · Esc larga</em></span>
      <button type="button" class="vv-decorar-botao" data-vd-acao="largar">Largar</button></div>`;
    const it = estado.itens[estado.sel];
    if (it) {
      const parede = tipoDeParede(it[0]);
      return `<div class="vv-decorar-barra" role="group" aria-label="Peça selecionada"><span class="vv-decorar-barra-txt"><small>Selecionada</small><b>${esc(nomeDe(it[0]))}</b>${parede ? `<em>${parede === 'imagem' ? 'Imagem da equipe: fica onde está' : 'Peça de parede: arraste para outro trecho'}</em>` : ''}</span>
        <button type="button" class="vv-decorar-botao" data-vd-acao="girar" title="Girar (R)"${parede ? ' disabled' : ''}>${ICONE.girar}Girar</button>
        <button type="button" class="vv-decorar-botao" data-vd-acao="guardar" title="Guardar no inventário (Delete)">${ICONE.guardar}Guardar</button></div>`;
    }
    return '<p class="vv-decorar-dica">Arraste um móvel para mudar de lugar · R gira · Delete guarda · Esc larga</p>';
  }
  function htmlMoveis() {
    const eco = base()?.economia, lista = inventario();
    const peca = (m) => {
      const livre = m.livres === Infinity || m.livres > 0, conta = m.livres === Infinity ? 'grátis' : `${m.livres} ${m.livres === 1 ? 'livre' : 'livres'}`;
      return `<li><button type="button" class="vv-decorar-peca" data-vd-movel="${esc(m.classe)}" aria-pressed="${estado.naMao === m.classe}"${livre ? '' : ' disabled'}
        aria-label="${esc(livre ? `Pôr ${m.nome} na sala, ${conta}` : `${m.nome}: todas as unidades já estão na sala`)}" title="${esc(livre ? `Pôr na sala · ${conta}` : 'Todas as unidades já estão na sala')}">
        ${iconeHtml(m.classe, 56)}<b>${esc(m.nome)}</b><small>${livre ? conta : 'todas na sala'}</small></button></li>`;
    };
    const guardados = eco && eco.disponivel === false ? vazio('A loja ainda não está ligada', eco.motivo || 'O inventário aguarda o banco do Escritório.')
      : !lista.length ? vazio('Nada guardado no inventário', 'Os móveis que você compra na Loja aparecem aqui para pôr na sala.', botaoLoja())
      : `<ul class="vv-decorar-grade">${lista.map(peca).join('')}</ul>`;
    const naSala = estado.itens.map((it, i) => `<li><button type="button" class="vv-decorar-item" data-vd-item="${i}" aria-pressed="${estado.sel === i}">${iconeHtml(it[0], 28)}<span>${esc(nomeDe(it[0]))}</span></button></li>`);
    return `<div class="vv-decorar-secao"><h3 class="vv-decorar-rotulo">Guardados</h3>${lista.length && typeof abrirCatalogoEscritorio === 'function' ? `<button type="button" class="vv-decorar-link" data-vd-acao="loja">${ICONE.loja}Comprar na Loja</button>` : ''}</div>
      ${guardados}
      <div class="vv-decorar-secao"><h3 class="vv-decorar-rotulo">Na sala <span class="vv-decorar-conta">${naSala.length}</span></h3></div>
      ${naSala.length ? `<ul class="vv-decorar-lista">${naSala.join('')}</ul>` : '<p class="vv-decorar-nota">A sala está vazia. Escolha um móvel guardado e clique no chão.</p>'}`;
  }
  function htmlPiso() {
    const pisos = listaPisos();
    if (!pisos.length) return vazio('Pisos indisponíveis', 'Os acabamentos do Escritório não carregaram neste navegador.');
    const a = ambiente(), atual = estado.decoracao.sala_piso || '', padrao = coresDoPiso(a?.pisoPadrao || a?.piso) || ['#B98A5C', '#C99A6B'];
    return `<p class="vv-decorar-nota">O piso vale para a sala toda; a pintura feita ladrilho a ladrilho no Escritório sai.</p>
      <ul class="vv-decorar-amostras">${pisos.map(([id, nome]) => { const [a, b] = coresDoPiso(id) || padrao; return `<li><button type="button" class="vv-decorar-opcao" data-vd-piso="${esc(id)}" aria-pressed="${atual === id}"><i class="vv-decorar-amostra" style="--a:${esc(a)};--b:${esc(b)}"></i><span>${esc(nome)}</span></button></li>`; }).join('')}</ul>`;
  }
  function htmlParede() {
    const cores = listaParedes();
    if (!cores.length) return vazio('Cores indisponíveis', 'Os acabamentos do Escritório não carregaram neste navegador.');
    const atual = estado.decoracao.sala_parede || '', padrao = ambiente()?.corPadrao || ambiente()?.cor || '#FF8A35';
    return `<p class="vv-decorar-nota">A cor das paredes da sala. Trechos pintados um a um no Escritório continuam como estão.</p>
      <ul class="vv-decorar-amostras cores">${cores.map((c) => `<li><button type="button" class="vv-decorar-opcao" data-vd-parede="${esc(c)}" aria-pressed="${atual === c}"><i class="vv-decorar-amostra lisa" style="--a:${esc(c || padrao)};--b:${esc(c || padrao)}"></i><span>${esc(NOMES_PAREDE[c] || c)}</span></button></li>`).join('')}</ul>`;
  }
  function htmlCorpo() {
    if (estado.carregando) return '<div class="vv-decorar-carregando" role="status" aria-label="Abrindo o inventário"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
    if (estado.erroAbrir) return vazio('A decoração não abriu', estado.erroAbrir, '<button type="button" class="vv-decorar-botao" data-vd-acao="tentar">Tentar de novo</button>');
    if (estado.semQuarto) return vazio('Monte o seu quarto primeiro', 'Escolha a planta e o modelo do quarto em Meu espaço. Depois, decore por aqui.',
      typeof personalizarEscritorio === 'function' ? '<button type="button" class="vv-decorar-botao" data-vd-acao="montar">Abrir Meu espaço</button>' : '');
    return estado.aba === 'piso' ? htmlPiso() : estado.aba === 'parede' ? htmlParede() : htmlMoveis();
  }
  function htmlRodape() {
    const sujo = mudou();
    const erro = estado.erro ? `<p class="vv-decorar-erro" role="alert">${esc(estado.erro)}</p>` : '';
    return `${erro}<div class="vv-decorar-rodape">
      <button type="button" class="vv-decorar-botao" data-vd-acao="desfazer"${estado.editando && !estado.salvando && estado.passos.length > 1 ? '' : ' disabled'} title="Desfazer (Ctrl+Z)">${ICONE.desfazer}Desfazer</button>
      <button type="button" class="vv-decorar-botao sair" data-vd-acao="sair">${sujo ? 'Sair sem salvar' : 'Sair'}</button>
      <button type="button" class="vv-decorar-salvar" data-vd-acao="salvar"${sujo && !estado.salvando ? '' : ' disabled'} title="Salvar (Ctrl+S)">${estado.salvando ? 'Salvando…' : 'Salvar'}</button></div>`;
  }
  function pintar() {
    const r = estado.raiz;
    if (!r) return;
    const ativo = document.activeElement, dentro = Boolean(ativo && r.contains?.(ativo));
    const chave = dentro ? ['data-vd-acao', 'data-vd-aba', 'data-vd-movel', 'data-vd-item', 'data-vd-piso', 'data-vd-parede'].map((a) => [a, ativo.getAttribute?.(a)]).find(([, v]) => v != null) : null;
    const rolagem = r.querySelector?.('.vv-decorar-corpo')?.scrollTop || 0;
    r.innerHTML = htmlTopo() + htmlAbas() + `<p class="vv-decorar-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>` + htmlBarra()
      + `<div class="vv-decorar-corpo" id="vv-decorar-corpo" role="tabpanel" aria-labelledby="vv-decorar-aba-${estado.aba}">${htmlCorpo()}</div>` + htmlRodape();
    const corpo = r.querySelector?.('.vv-decorar-corpo');
    if (corpo && rolagem) corpo.scrollTop = rolagem;
    if (chave) r.querySelector?.(`[${chave[0]}="${String(chave[1]).replace(/["\\]/g, '\\$&')}"]`)?.focus?.();
  }

  // ---------- eventos ----------
  function aoClicar(ev) {
    const b = ev.target?.closest?.('button');
    if (!b || b.disabled) return;
    const d = b.dataset || {};
    if (d.vdAba) trocarAba(d.vdAba);
    else if (d.vdMovel) segurar(d.vdMovel);
    else if (d.vdItem != null) selecionar(d.vdItem);
    else if (d.vdPiso != null) escolherPiso(d.vdPiso);
    else if (d.vdParede != null) escolherParede(d.vdParede);
    else if (d.vdAcao === 'girar') chamar(estado.cena?.girar);
    else if (d.vdAcao === 'guardar') chamar(estado.cena?.guardar);
    else if (d.vdAcao === 'largar') chamar(estado.cena?.segurar, null);
    else if (d.vdAcao === 'salvar') salvar();
    else if (d.vdAcao === 'desfazer') desfazer();
    else if (d.vdAcao === 'sair') fechar();
    else if (d.vdAcao === 'loja') abrirLoja();
    else if (d.vdAcao === 'tentar') preparar();
    else if (d.vdAcao === 'montar') { const f = typeof personalizarEscritorio === 'function' ? personalizarEscritorio : null; fechar({ forcar: true }).then(() => chamar(f)); }
  }
  // Setas trocam de aba (padrão de tablist).
  function teclaNasAbas(ev) {
    const aba = ev.target?.closest?.('[role="tab"]');
    if (!aba || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    const ids = ABAS.map(([k]) => k), i = ids.indexOf(aba.dataset.vdAba);
    const prox = ev.key === 'Home' ? 0 : ev.key === 'End' ? ids.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length;
    ev.preventDefault(); trocarAba(ids[prox]);
  }
  // Ctrl/⌘ + Z desfaz, + Shift + Z (ou Y) refaz, + S salva. R, Delete, setas e Esc são da cena (sala.mjs).
  function teclaGlobal(e) {
    if (!estado.raiz || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector?.('dialog[open], #cli-pergunta')) return;
    const k = String(e.key || '').toLowerCase();
    if (k === 'z') { if (e.shiftKey) refazer(); else desfazer(); }
    else if (k === 'y') refazer();
    else if (k === 's') salvar();
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  raiz.addEventListener?.('beforeunload', (ev) => { if (estado.editando && mudou()) { ev.preventDefault(); ev.returnValue = ''; } });

  raiz.VybeDecorar = {
    abrir, fechar, aberto: () => Boolean(estado.raiz),
    ligarCena, podeDecorar, salaDecoravel, acabamentoDaSala,
    salvar, desfazer, refazer, segurar, escolherPiso, escolherParede, aba: trocarAba, inventario,
    estado: () => ({ sala: estado.sala, aba: estado.aba, itens: copiar(estado.itens), decoracao: { ...estado.decoracao }, versao: estado.versao,
      mudou: mudou(), mudancas: mudancas(), sel: estado.sel, naMao: estado.naMao, editando: estado.editando, salvando: estado.salvando,
      semQuarto: estado.semQuarto, erro: estado.erro, erroAbrir: estado.erroAbrir, aviso: estado.aviso }),
  };
})();
