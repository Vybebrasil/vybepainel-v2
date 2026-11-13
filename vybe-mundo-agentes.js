// vybe-mundo-agentes.js — Agentes da Vybe em tela cheia (Paulo, 08/11/2026: "eu preciso clicar no agente e ver o que ele
// está fazendo no dia a dia e poder dar novas atribuições a ele por dentro do sistema mesmo").
//
// Quem é quem: a planta do Prédio (mundo/planta.mjs, a mesma de core/agentes.js no VYBES), andar por andar.
// O que faz agora e o que fez: a atividade real que a central do VYBES registra (mundoVoxel.atividadeDoAgenteHtml).
// Rotina: o que roda de verdade com horário (rotinas.js / noite.js, vindo da central) + as atribuições recorrentes.
// Atribuições: guardadas na central (core/atribuicoes-agentes.js). Só os donos dão, pausam e removem. Quando vencem, viram
// proposta do agente e esperam a aprovação de um dono (modo sombra): nada sai no WhatsApp nem grava no Vybe OS por aqui.
// Estado de cada agente (Paulo, 09/11/2026): ativo · sombra · pausado (com data de volta opcional) · desligado. Vem da
// central (core/estado-agentes.js, fonte única); só os donos mudam, aqui mesmo. Os pedidos de aprovação dos agentes em
// sombra entram em "Depende de você" › Para decidir, com Aprovar / Recusar e a prévia do que será feito.
(() => {
  const G = window;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Cabeçalho único da janela (vbCabecalhoHtml e vbFecharHtml, vybe-core.js). Sem o vybe-core (testes), só o título e as ações.
  const cabecalho = (o) => (typeof window !== 'undefined' && typeof window.vbCabecalhoHtml === 'function' ? window.vbCabecalhoHtml(o) : `<h2${o.id ? ` id="${o.id}"` : ''}>${esc(o.titulo)}</h2>${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${o.acoes || ''}`);
  const botaoX = (attr, classe = '') => (typeof window !== 'undefined' && typeof window.vbFecharHtml === 'function' ? window.vbFecharHtml(attr, classe) : `<button type="button" class="vb-janela-x ${classe}" ${attr} aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`);
  // Dono pela informação do servidor (sessão, server/donos.js), não pelo primeiro nome. A central confere de novo.
  const souDono = () => { try { return typeof G.souDonoDaSessao === 'function' && G.souDonoDaSessao(); } catch { return false; } };
  const ESTADO_SETOR = { ativo: ['Ativo', 'Já trabalha hoje.', '#18A957'], sombra: ['Sombra', 'Só propõe; um dono aprova.', '#0D74CE'], planejado: ['Planejado', 'Falta ligar as ferramentas: hoje não roda.', '#7A8B82'] };
  // O estado que vale agora (o mesmo texto de core/estado-agentes.js EXPLICA). Sem leitura da central: a planta, como antes.
  const MODO = { ativo: ['Ativo', 'Age sozinho e conta no grupo dos sócios o que fez.', '#18A957'], sombra: ['Sombra', 'Trabalha, mas cada ação espera o OK de um dono.', '#0D74CE'],
    pausado: ['Pausado', 'Parado por um tempo; volta sozinho na data marcada.', '#C2490C'], desligado: ['Desligado', 'Não roda nada até um dono ligar.', '#7A8B82'] };
  function modoDo(s) {
    const a = (fonte().dados?.agentes || []).find((x) => x.setor === s.id);
    if (a?.modo && MODO[a.modo]) return { id: a.modo, ate: a.modoAte || null, pedidos: a.pedidos || 0, real: true };
    return { id: s.estado, ate: null, pedidos: 0, real: false };
  }
  const rotuloDoModo = (m) => MODO[m.id] || ESTADO_SETOR[m.id] || ESTADO_SETOR.planejado;
  const ANDAR = (n, id) => (n === 0 ? 'Térreo' : id === 'terraco' ? 'Terraço' : n + 'º andar');
  const FREQ = { uma_vez: 'Uma vez', diaria: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' };
  const st = { aberto: false, vista: 'fila', setor: 'orquestrador', msg: '', enviando: false, frente: 0, lista: false, lado: 'resumo', achado: undefined, rotinasTodas: false, achadosTodos: false, mais: false, trocar: false, anima: true, doBaralho: false, saindo: false, chegou: false, perfis: {}, estados: { dados: null, erro: '', em: 0, lendo: null } };
  // Estados e pedidos de aprovação: só para dono (o servidor confere a sessão e a central de novo). 30 s de folga.
  function lerEstados(forcar = false) {
    const e = st.estados;
    if (!souDono()) return Promise.resolve();
    if (e.lendo || (!forcar && Date.now() - e.em < 30e3)) return e.lendo || Promise.resolve();
    e.em = Date.now();
    e.lendo = fetch('/api/painel?area=vybes&etapa=estados', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !Array.isArray(d.pedidos)) throw new Error(d.error || 'Sem os pedidos da central agora.'); e.dados = d; e.erro = ''; })
      .catch((x) => { e.erro = x.message; }).finally(() => { e.lendo = null; if (st.aberto) pintar(); });
    return e.lendo;
  }
  let raiz = null;
  // Perfil completo (Paulo, 08/11/2026: "ver o que cada um tá fazendo certo, desligar uma coisa da rotina, analisar tudo que
  // ele fez, tá fazendo, histórico, projeção"). Vem pronto da central (core/perfil-agente.js); aqui só desenha.
  const MOTOR = { qwen: ['Qwen', '#8B7DFF', 'O modelo local (Qwen 3.5 35B) pensa e escreve.'], logica: ['Lógica', '#0D74CE', 'Regra fixa no código: mesma entrada, mesma saída.'],
    misto: ['Lógica + Qwen', '#8E4EC6', 'A regra fixa filtra e o Qwen escreve.'], vybe_os: ['Vybe OS', '#7A8B82', 'Texto montado no servidor do Vybe OS.'], nao_mapeado: ['Não mapeada', '#D13D36', 'Sem origem conferida.'] };
  function lerPerfil(setor, forcar = false) {
    const p = st.perfis[setor] ||= { dados: null, erro: '', em: 0, lendo: null };
    if (p.lendo || (!forcar && Date.now() - p.em < 30e3)) return p.lendo || Promise.resolve();
    p.em = Date.now();
    p.lendo = fetch(`/api/painel?area=vybes&etapa=perfil&setor=${encodeURIComponent(setor)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.perfil) throw new Error(d.error || 'Sem perfil da central agora.'); p.dados = d; p.erro = ''; })
      .catch((e) => { p.erro = e.message; }).finally(() => { p.lendo = null; if (st.aberto && st.setor === setor) pintar(); });
    return p.lendo;
  }
  // "hoje 19:31", "amanhã 08:00", "qua 08:00": cabe na coluna da hora.
  const horaCurta = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const dia = (x) => x.toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' }), hoje = dia(new Date()), am = dia(new Date(Date.now() + 864e5));
    const h = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' }); return `${dia(d) === hoje ? 'hoje' : dia(d) === am ? 'amanhã' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia', weekday: 'short' }).replace('.', '')} ${h}`; };
  const pct = (n) => n == null ? '—' : `${n}%`;
  // Os números do perfil numa linha só (quadro "Perfil do agente" do padrão v2): em aberto, resolvidos, tempo e projeção.
  function numerosLinha(P) {
    const n = P.numeros || {}, pj = P.projecao || {};
    const horas = n.horasAteResolver == null ? '' : String(n.horasAteResolver).replace('.', ',') + ' h';
    return [`<b>${n.abertos ?? 0} em aberto</b>${n.altas ? `, ${n.altas} urgente${n.altas > 1 ? 's' : ''}` : ''}`,
      `<b>${n.resolvidos7d ?? 0} resolvido${n.resolvidos7d === 1 ? '' : 's'}</b> em 7 dias${n.errados7d ? `, ${n.errados7d} marcado${n.errados7d > 1 ? 's' : ''} como errado` : ''}`,
      horas ? `<b>${horas}</b> até resolver` : '',
      pj.tendencia ? `projeção: ${esc(pj.tendencia)}` : '', pj.subirNivel ? esc(pj.subirNivel) : ''].filter(Boolean).join(' · ');
  }
  // A peça do achado (vybe-mundo-peca.js): calendário, quem faz, datas e a sugestão do agente para aplicar ali mesmo.
  const achadosVistos = {};
  const ehPeca = (a) => /^vybe:[1-9]\d{0,19}$/.test(String(a?.ref || ''));
  function pecaBotao(a, setor) {
    if (!ehPeca(a)) return '';
    achadosVistos[setor + '|' + a.chave] = a;
    return `<button type="button" class="vga-peca" data-vga-peca="${esc(a.ref)}" data-vga-chave="${esc(a.chave)}" data-vga-de="${esc(setor)}" title="Abrir a peça: calendário, quem faz, datas e a sugestão do agente" aria-label="Abrir a peça ${esc(a.titulo || a.fato || '')}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></button>`;
  }
  // "Últimos achados" (quadro "Perfil do agente"): uma linha por achado, com o selo da gravidade; a linha abre no lugar
  // com a prova, a sugestão, a ficha e os botões de retorno. Os três primeiros na frente; o resto em "ver todos".
  const ICONE_ABRE = '<svg class="v2a-vai" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const SELO_ACHADO = { alta: ['r', 'Urgente'], media: ['a', 'Atenção'], baixa: ['n', 'De olho'] };
  function achadosHtml(P, dono) {
    const setor = P.setor || st.setor, ab = P.achados?.abertos || [], fe = P.achados?.resolvidos || [];
    const todos = [...ab.map((a) => [a, true]), ...fe.map((a) => [a, false])];
    if (st.achado === undefined) st.achado = ab[0]?.chave || '';
    const mostra = st.achadosTodos ? todos : todos.slice(0, 3);
    const linha = ([a, aberto]) => {
      const [tom, selo] = aberto ? SELO_ACHADO[a.gravidade] || SELO_ACHADO.baixa : ['g', 'Resolvido'], exp = st.achado === a.chave;
      if (aberto) pecaBotao(a, setor);
      return `<div class="v2-abre v2a-achado" aria-expanded="${exp}">
        <button type="button" class="v2g-lin v2a-achado-l" data-vga-abre="${esc(a.chave)}" aria-expanded="${exp}"><span class="v2g-pill ${tom}">${selo}</span><span class="v2a-achado-t">${esc(a.fato)}</span>${ICONE_ABRE}</button>
        <div class="v2-mais"><div>
          <p class="v2g-sub v2a-achado-d">${a.cliente ? (typeof G.cliCor === 'function' ? G.cliCor(a.cliente) : esc(a.cliente)) + ' · ' : ''}${esc(a.prova)}${a.sugestao ? ' · ' + esc(a.sugestao) : ''}${aberto ? ` · desde ${esc(quando(a.primeiraVez))}${a.vezes > 1 ? ` · visto ${a.vezes} vezes` : ''}` : ` · ${esc(a.comoFechou || a.estado)} ${esc(quando(a.fechadoEm))}`}</p>
          ${a.ficha ? `<details><summary>Ficha para quem faz</summary><pre>${esc(a.ficha)}</pre></details>` : ''}${a.versaoSugerida ? `<details><summary>Versão sugerida pelo Qwen</summary><pre>${esc(a.versaoSugerida)}</pre></details>` : ''}${a.rascunho ? `<details class="vga-rascunho"${aberto ? ' open' : ''}><summary>Pedido de orçamento pronto</summary><pre>${esc(a.rascunho)}</pre><button type="button" class="vga-copiar" data-vga-copiar>Copiar pedido</button></details>` : ''}
          ${aberto && (dono || ehPeca(a)) ? `<p class="v2a-achado-b">${ehPeca(a) ? `<button type="button" class="v2g-btn s" data-vga-peca="${esc(a.ref)}" data-vga-chave="${esc(a.chave)}" data-vga-de="${esc(setor)}" title="Calendário, quem faz, datas e a sugestão do agente">Abrir a peça</button>` : ''}${dono ? `<button type="button" class="v2g-btn s" data-vga-achado="resolvido" data-vga-chave="${esc(a.chave)}">Resolvido</button><button type="button" class="v2g-btn s" data-vga-achado="ignorar" data-vga-chave="${esc(a.chave)}">Ignorar</button><button type="button" class="v2g-btn s" data-vga-achado="errado" data-vga-chave="${esc(a.chave)}" title="O agente se enganou: conta na nota dele">Estava errado</button>` : ''}</p>` : ''}
        </div></div></div>`;
    };
    const h = Object.entries(P.historico || {}).sort().slice(-14), max = Math.max(1, ...h.map(([, v]) => v.concluidas + v.falhas));
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
    const dias = h.length ? `<div class="v2a-dias" role="img" aria-label="Execuções por dia nos últimos 14 dias">${h.map(([dia, v]) => `<i${dia === hoje ? ' class="hoje"' : ''} style="--h:${Math.max(6, Math.round((v.concluidas + v.falhas) / max * 100))}%" title="${esc(dia.slice(8, 10) + '/' + dia.slice(5, 7))}: ${v.concluidas} concluída${v.concluidas === 1 ? '' : 's'}, ${v.falhas} falha${v.falhas === 1 ? '' : 's'}"></i>`).join('')}</div>` : '';
    return `<section class="v2g-card v2a-achados"><div class="v2g-cab"><h3 class="v2g-h2">Últimos achados</h3><span class="v2g-sub">${ab.length} em aberto · a linha abre no lugar</span></div>
      ${mostra.length ? mostra.map(linha).join('') : '<p class="v2g-sub v2a-nada">Nada em aberto. Os achados aparecem quando as rotinas dele rodam.</p>'}
      <div class="v2a-achados-pe">${dias}<p class="v2g-sub">${h.length ? 'Execuções por dia, 14 dias. ' : ''}Nota = achados resolvidos sobre resolvidos mais os marcados como errado${todos.length > 3 ? ` · <button type="button" class="v2g-link" data-vga-achados-todos>${st.achadosTodos ? 'só os últimos' : `ver todos (${todos.length})`}</button>` : ''}</p></div></section>`;
  }
  // "Rotinas" (quadro "Perfil do agente"): o nome, quando roda, quem pensa (lógica fixa ou Qwen) e a chave de ligar.
  const SELO_MOTOR = { qwen: ['v', 'Qwen'], logica: ['n', 'lógica fixa'], misto: ['v', 'lógica + Qwen'], vybe_os: ['n', 'Vybe OS'], nao_mapeado: ['r', 'não mapeada'] };
  function rotinasHtml(P, dono) {
    const rs = P.rotinas || [], mostra = st.rotinasTodas ? rs : rs.slice(0, 3);
    return `<section class="v2g-card v2a-rotinas"><div class="v2g-cab"><h3 class="v2g-h2">Rotinas</h3><span class="v2g-sub">${rs.length ? 'desligar vale na próxima execução' : ''}</span></div>
      ${mostra.map((r) => {
        const [tom, nm] = SELO_MOTOR[r.motor] || SELO_MOTOR.nao_mapeado, expl = (MOTOR[r.motor] || MOTOR.nao_mapeado)[2];
        const detalhe = [r.evita ? 'Evita: ' + r.evita : '', (r.leNomes || []).length ? 'lê ' + r.leNomes.join(', ') : '', (r.geraNomes || []).length ? 'gera ' + r.geraNomes.join(', ') : '', r.codigo || '',
          r.ultimaRodada ? 'última rodada ' + quando(r.ultimaRodada.em) : '', !r.ligada && r.desligadaPor ? 'desligada por ' + r.desligadaPor : ''].filter(Boolean).join(' · ');
        return `<div class="v2g-lin${r.ligada ? '' : ' off'}" title="${esc(detalhe)}"><p><b>${esc(r.texto)}</b>${r.nova ? ' <span class="v2g-pill b">nova</span>' : ''}${st.rotinasTodas && detalhe ? `<small>${esc(detalhe)}</small>` : ''}</p><span class="v2g-sub">${esc(r.quando)}</span><span class="v2g-pill ${tom}" title="${esc(expl)}">${nm}</span>
          ${dono && !r.fixa ? `<button type="button" class="v2g-tg" role="switch" aria-checked="${r.ligada}" data-vga-rotina="${esc(r.id)}" data-vga-ligar="${r.ligada ? 'desligar' : 'ligar'}" aria-label="${r.ligada ? 'Desligar' : 'Ligar'} ${esc(r.texto)}"></button>` : r.fixa ? '<span class="v2g-sub v2a-fixa" title="Esta rotina não desliga">fixa</span>' : ''}</div>`;
      }).join('') || '<p class="v2g-sub v2a-nada">Sem rotina com horário.</p>'}
      ${rs.length > 3 ? `<p class="v2g-sub v2a-pe">${st.rotinasTodas ? '' : `+ ${rs.length - 3} ${rs.length - 3 === 1 ? 'rotina' : 'rotinas'} · `}<button type="button" class="v2g-link" data-vga-rotinas-todas>${st.rotinasTodas ? 'recolher' : 'mostrar'}</button></p>` : ''}</section>`;
  }
  function projecaoHtml(P) {
    const px = (P.projecao?.proximas || []).slice(0, 8), h = Object.entries(P.historico || {}).sort();
    const max = Math.max(1, ...h.map(([, v]) => v.concluidas + v.falhas));
    return `<section class="vga-bloco"><h4>Próximas execuções</h4>${px.length ? `<ul class="vga-rotina vga-proximas">${px.map((x) => `<li><time>${esc(horaCurta(x.em))}</time><span>${esc(x.texto)}</span><em>${x.tipo === 'atribuicao' ? 'atribuição' : 'rotina'}</em></li>`).join('')}</ul>` : '<p class="vga-vazio">Nada marcado até amanhã.</p>'}
      <h4 class="vga-h4-sep">Histórico (14 dias)</h4>${h.length ? `<div class="vga-barras" role="img" aria-label="Execuções por dia">${h.map(([dia, v]) => `<span title="${esc(dia.slice(8, 10) + '/' + dia.slice(5, 7))}: ${v.concluidas} concluída${v.concluidas === 1 ? '' : 's'}, ${v.falhas} falha${v.falhas === 1 ? '' : 's'}, ${v.aguardando} aguardando"><i style="height:${Math.round(v.concluidas / max * 100)}%"></i>${v.falhas ? `<i class="f" style="height:${Math.max(4, Math.round(v.falhas / max * 100))}%"></i>` : ''}<small>${esc(dia.slice(8, 10))}</small></span>`).join('')}</div>` : '<p class="vga-vazio">Sem execução registrada nos últimos 14 dias.</p>'}</section>`;
  }
  function licoesHtml(P, dono) {
    const ls = P.licoes || []; if (!ls.length) return '';
    return `<section class="vga-bloco"><h4>Lições (o que se repetiu)</h4><ul class="vga-achados">${ls.map((l) => `<li><span><b>${esc(l.texto)}</b><small>${esc(l.estado === 'em_revisao' ? 'em revisão' : l.estado)}${l.prova ? ' · ' + esc(l.prova) : ''}</small></span>
      ${dono && l.estado === 'em_revisao' ? `<span class="vga-acoes"><button type="button" data-vga-licao="incorporar" data-vga-id="${esc(l.id)}">Vale sempre</button><button type="button" data-vga-licao="contestar" data-vga-id="${esc(l.id)}">Não vale</button></span>` : ''}</li>`).join('')}</ul></section>`;
  }

  const mv = () => G.mundoVoxel || {};
  const planta = () => (mv().planta?.() || []).filter((a) => a.setores.some((s) => s.agente));
  const fonte = () => mv().fonteAgentes?.()?.ler?.() || { dados: null };
  const quando = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { timeZone: 'America/Bahia', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('.', ''); };

  function setores() { return planta().flatMap((a) => a.setores.filter((s) => s.agente).map((s) => ({ ...s, andar: a }))); }
  // Retrato voxel do agente (quadros 62 e 63 do moodboard): o mesmo boneco de agente do Prédio (figuraDoAgente, com a cor
  // do andar no visor e no fone), pela avatarDoAgente de mundo/avatar.mjs. Enquanto o módulo 3D não chega (ou sem
  // WebGL), as iniciais de antes.
  let modRetrato = null;
  function retratoHtml(s, { grande = false } = {}) {
    const cor = s?.andar?.cor || '#FF7A2F', nome = String(s?.agente || '');
    let url = '';
    try { url = modRetrato?.avatarDoAgente?.(nome, cor, { cabeca: true }) || ''; } catch { url = ''; }
    const cls = `vga-av${grande ? ' grande' : ''}`;
    if (url) return `<img class="${cls} vga-retrato" src="${esc(url)}" alt="" style="--e:${esc(cor)}" width="${grande ? 52 : 32}" height="${grande ? 52 : 32}">`;
    return `<span class="${cls}" style="--e:${esc(cor)}" aria-hidden="true">${esc(nome.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>`;
  }

  // "Depende de você" (Paulo, 09/11/2026: "o que cada um tá dependendo de mim"): uma fila só, de todos os agentes, com o
  // que espera um dono. Para decidir: achado urgente, lição em revisão, execução que parou com falha e agente que pode
  // ganhar autonomia. Acompanhar: os demais achados, contados por agente. Esperando: ação preparada que espera o SIM de
  // quem pediu (só essa pessoa confirma, em 5 min, no WhatsApp: server/assistente-acoes.js) e proposta de agente em
  // sombra. Tudo sai do perfil (etapa=perfil) e da atividade (etapa=agentes) que a tela do agente já lê; decidir usa as
  // mesmas rotas (etapa=achado). O número do dock é o tamanho de "Para decidir".
  // O fato sem o nome do cliente na frente ("Alpha1: nenhum conteúdo…" → "nenhum conteúdo…"): é o que se repete no grupo.
  function semCliente(a) {
    let f = String(a.fato || '').trim(); const c = String(a.cliente || '').trim();
    if (c && f.toLowerCase().startsWith(c.toLowerCase())) f = f.slice(c.length).replace(/^[\s:·–—-]+/, '');
    return f;
  }
  function tituloDoGrupo(as) {
    const fatos = new Set(as.map(semCliente)), clientes = [...new Set(as.map((a) => String(a.cliente || '').trim()).filter(Boolean))];
    const comum = fatos.size === 1 ? [...fatos][0] : '';
    const quantos = clientes.length === as.length ? `${as.length} clientes` : `${as.length} vezes`;
    return { titulo: comum ? `${quantos}: ${comum.charAt(0).toLowerCase() + comum.slice(1)}` : `${as.length} achados do mesmo tipo`, exemplo: comum ? '' : String(as[0].fato || ''), clientes };
  }
  // Os achados do mesmo tipo (ou do mesmo fato sem o cliente) juntos; o boletim usa a mesma conta (VybeAgentes.agrupar).
  function agrupar(lista) {
    const grupos = new Map();
    for (const a of lista) { const k = a.tipo || 'fato:' + semCliente(a); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(a); }
    return [...grupos].map(([k, as]) => ({ k, achados: as, em: as.map((a) => String(a.primeiraVez || '')).sort()[0], ...tituloDoGrupo(as) }));
  }
  // Pedido de aprovação de agente em sombra (core/porta-agentes.js na central): entra em "Para decidir" logo depois das
  // falhas; vencido não aparece. A atividade "aguardando aprovação" do mesmo pedido (porta_aprovacao) não repete em Esperando.
  const GRAVIDADE = { alta: 0, media: 1, baixa: 2 };
  // O mesmo achado visto por vários agentes (quadro 62 do moodboard, 10/11/2026: "Cliente demonstração pediu no grupo…"
  // aparecia quatro vezes, uma por agente): mesmo cliente, mesmo fato sem o nome do cliente e mesma peça. Cada agente
  // guarda o seu com chave própria na central (core/achados-agentes.js), então a linha leva as chaves de todos.
  const normal = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '');
  const mesmoAchado = (a) => `${normal(a.cliente)}|${normal(semCliente(a))}|${String(a.ref || '')}`;
  function juntarVistos(lista) {
    const por = new Map();
    for (const { quem, a } of lista) {
      const k = mesmoAchado(a);
      if (!por.has(k)) por.set(k, { a, copias: [] });
      const m = por.get(k);
      m.copias.push({ ...quem, a });
      if (String(a.primeiraVez || '') < String(m.a.primeiraVez || '')) m.a = a; // o mais antigo representa
    }
    return [...por.values()];
  }
  // "VYBES, Otávio, Beto e Mateus".
  const listaDeNomes = (ns) => (ns.length < 2 ? ns.join('') : `${ns.slice(0, -1).join(', ')} e ${ns[ns.length - 1]}`);
  function filaDoDono({ agentes = [], perfis = {}, atividades = {}, pedidos = [], agora = Date.now() } = {}) {
    const decidir = [], acompanhar = [], esperando = [], urgentes = [], licoes = new Map();
    for (const x of Array.isArray(pedidos) ? pedidos : []) {
      if (!x || x.status !== 'pendente' || !(Date.parse(x.expiraEm) > agora)) continue;
      const s = agentes.find((a) => a.id === x.setor);
      decidir.push({ setor: x.setor, agente: s?.agente || x.agente || x.setor, nome: s?.nome || '', tipo: 'aprovacao', em: x.criadoEm || '', p: x });
    }
    for (const s of agentes) {
      const P = perfis[s.id], A = atividades[s.id], quem = { setor: s.id, agente: s.agente, nome: s.nome };
      if (P) {
        const abertos = P.achados?.abertos || [];
        for (const a of abertos.filter((x) => x.gravidade === 'alta')) urgentes.push({ quem, a });
        // A mesma lição de vários agentes (quadro 62, 10/11/2026: "card sem briefing se repetiu 3 vezes" aparecia uma vez por
        // agente) vira uma linha só, "visto por" todos; decidir vale para a lição de cada um.
        for (const l of (P.licoes || []).filter((x) => x.estado === 'em_revisao')) {
          const k = normal(l.texto) || 'licao:' + s.id + ':' + l.id;
          if (!licoes.has(k)) licoes.set(k, { ...quem, tipo: 'licao', em: l.em || l.criadaEm || '', l, vistos: [], copias: [] });
          const g = licoes.get(k); g.copias.push({ setor: s.id, id: l.id });
          if (!g.vistos.some((v) => v.setor === s.id)) g.vistos.push(quem);
          const em = l.em || l.criadaEm || ''; if (em && (!g.em || em < g.em)) g.em = em;
        }
        if (P.projecao?.subirNivel) decidir.push({ ...quem, tipo: 'nivel', em: '', texto: P.projecao.subirNivel });
        const outros = abertos.filter((x) => x.gravidade !== 'alta');
        if (outros.length) acompanhar.push({ ...quem, n: outros.length, mais: outros[0] });
      }
      const ult = A?.ultimos || [];
      if (ult[0]?.estado === 'falhou') decidir.push({ ...quem, tipo: 'falha', em: ult[0].em, e: ult[0] });
      ult.forEach((e, i) => {
        if (e.estado !== 'aguardando_aprovacao' || e.ferramenta === 'porta_aprovacao') return;
        // A lista vem da mais nova para a mais antiga: se algo depois dela fechou a mesma referência, já foi decidida.
        if (ult.slice(0, i).some((x) => x.ref === e.ref && x.estado !== 'aguardando_aprovacao')) return;
        const idade = agora - Date.parse(e.em);
        const acao = e.ferramenta === 'executor_aprovacao';
        if (!(idade >= 0) || idade > (acao ? 10 * 60e3 : 7 * 864e5)) return; // o código da ação vale 5 min; proposta, 1 semana
        esperando.push({ ...quem, tipo: acao ? 'acao' : 'proposta', em: e.em, e });
      });
    }
    decidir.push(...licoes.values());
    // Urgentes: primeiro o mesmo achado de vários agentes vira um só; depois os do mesmo tipo e dos mesmos agentes viram um
    // grupo (Paulo, 09/11/2026: a fila veio com 58 e boa parte era o mesmo achado repetido por cliente), com resolver ou
    // ignorar o grupo e "ver um a um".
    const juntos = juntarVistos(urgentes), deQuem = new Map(juntos.map((m) => [m.a, m])), porVistos = new Map();
    for (const m of juntos) { const k = [...new Set(m.copias.map((c) => c.setor))].join('+'); if (!porVistos.has(k)) porVistos.set(k, []); porVistos.get(k).push(m.a); }
    for (const lista of porVistos.values()) {
      for (const g of agrupar(lista)) {
        const membros = g.achados.map((a) => deQuem.get(a)), copias = membros.flatMap((m) => m.copias);
        const vistos = [...new Map(copias.map((c) => [c.setor, { setor: c.setor, agente: c.agente, nome: c.nome }])).values()];
        const base = { ...vistos[0], vistos, chaves: copias.map((c) => c.a.chave), em: g.em };
        if (g.achados.length === 1) decidir.push({ ...base, tipo: 'achado', a: g.achados[0] });
        else decidir.push({ ...base, tipo: 'grupo', chave: vistos.map((v) => v.setor).join('+') + ':' + g.k, achados: g.achados, membros, titulo: g.titulo, exemplo: g.exemplo, clientes: g.clientes });
      }
    }
    const ordem = { falha: 0, aprovacao: 1, grupo: 2, achado: 2, licao: 3, nivel: 4 };
    decidir.sort((x, y) => ordem[x.tipo] - ordem[y.tipo] || (y.achados?.length || 1) - (x.achados?.length || 1) || String(x.em || '').localeCompare(String(y.em || '')));
    acompanhar.sort((x, y) => y.n - x.n);
    return { decidir, acompanhar, esperando, total: decidir.length };
  }
  function lerTodos() {
    const fila = setores().map((s) => s.id);
    return Promise.all(Array.from({ length: 4 }, async () => { while (fila.length) await lerPerfil(fila.shift()).catch(() => {}); }));
  }
  function filaAgora() {
    const ag = setores(), f = fonte(), atividades = Object.fromEntries((f.dados?.agentes || []).map((a) => [a.setor, a]));
    const perfis = Object.fromEntries(ag.map((s) => [s.id, st.perfis[s.id]?.dados?.perfil]).filter(([, p]) => p));
    return { ...filaDoDono({ agentes: ag, perfis, atividades, pedidos: st.estados.dados?.pedidos || [] }), lidos: Object.keys(perfis).length, de: ag.length };
  }
  const ICONE_FILA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4v5c0 4.6-3.4 8.4-8 9-4.6-.6-8-4.4-8-9V7z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>';
  // Selo com texto (sem faixa colorida na borda): a cor segue a escala de urgência de docs/padrao-visual.md.
  const TIPO = { falha: ['Parou com falha', 'critico'], aprovacao: ['Pede o seu OK', 'bloqueio'], achado: ['Urgente', 'alto'], grupo: ['Urgente', 'alto'], licao: ['Lição para confirmar', 'bloqueio'],
    nivel: ['Pode ganhar autonomia', 'andando'], acao: ['Esperando o SIM de quem pediu', 'espera'], proposta: ['Proposta esperando um dono', 'espera'] };
  const ICONE_MAIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const maisHtml = (botoes) => (botoes ? `<details class="vga-mais"><summary>${ICONE_MAIS}<span>Mais</span></summary><div class="vga-mais-menu">${botoes}</div></details>` : '');
  // Botão de decidir um achado: um agente só, a rota dele (data-vga-achado); vários, a mesma rota para cada chave (lote).
  function botaoAchado(it, acao, rotulo, extra = '') {
    const chaves = it.chaves || [it.a?.chave], setores = [...new Set((it.vistos || [it]).map((v) => v.setor))];
    if (chaves.length === 1) return `<button type="button" data-vga-de="${esc(it.setor)}" data-vga-achado="${acao}" data-vga-chave="${esc(chaves[0])}"${extra}>${rotulo}</button>`;
    return `<button type="button" data-vga-de="${esc(it.setor)}" data-vga-lote="${acao}" data-vga-chaves="${esc(JSON.stringify(chaves))}" data-vga-setores="${esc(JSON.stringify(setores))}"${it.tipo === 'grupo' ? '' : ' data-vga-vistos'}${extra}>${rotulo}</button>`;
  }
  function itemFilaHtml(it, dono) {
    const [rot, nivel] = TIPO[it.tipo], cli = (c) => (c ? (typeof G.cliCor === 'function' ? G.cliCor(c) : esc(c)) + ' · ' : '');
    const vistos = it.vistos || [{ setor: it.setor, agente: it.agente, nome: it.nome }];
    // Abrir o agente: um botão por agente que viu (no "Mais" quando há outra ação principal).
    const abrirAgentes = it.dentro ? '' : vistos.map((v) => `<button type="button" data-vga-setor="${esc(v.setor)}">Abrir ${esc(v.agente)}</button>`).join('');
    const abrirPrincipal = it.dentro ? '' : `<button type="button" class="vga-sim" data-vga-setor="${esc(it.setor)}">Abrir ${esc(it.agente)}</button>`;
    let titulo = '', detalhe = '', principal = '', segunda = '', mais = '', extra = '';
    if (it.tipo === 'grupo') {
      const n = it.achados.length, vis = it.clientes.slice(0, 6);
      titulo = it.titulo;
      detalhe = `${vis.length ? vis.map((c) => (typeof G.cliCor === 'function' ? G.cliCor(c) : esc(c))).join(' ') + (it.clientes.length > vis.length ? ` e mais ${it.clientes.length - vis.length}` : '') + ' · ' : ''}${it.exemplo ? 'Ex.: ' + esc(it.exemplo) + ' · ' : ''}o mais antigo desde ${esc(quando(it.em))}`;
      if (dono) { principal = botaoAchado(it, 'resolvido', `Resolver os ${n}`, ' class="vga-sim"'); mais = botaoAchado(it, 'ignorar', `Ignorar os ${n}`) + abrirAgentes; }
      else principal = abrirPrincipal;
      const membros = it.membros || it.achados.map((a) => ({ a, copias: [{ ...vistos[0], a }] }));
      extra = `<details class="vga-grupo"><summary>Ver um a um (${n})<span hidden>${esc(it.chave)}</span></summary><ul class="vga-fila">${membros.map((m) => itemFilaHtml({ ...it, tipo: 'achado', a: m.a, chaves: m.copias.map((c) => c.a.chave), dentro: true }, dono)).join('')}</ul></details>`;
    } else if (it.tipo === 'achado') {
      const a = it.a, peca = /^vybe:[1-9]\d{0,19}$/.test(String(a?.ref || ''));
      titulo = a.fato; detalhe = `${cli(a.cliente)}${esc(a.prova)}${a.sugestao ? ' · ' + esc(a.sugestao) : ''} · desde ${esc(quando(a.primeiraVez))}${a.vezes > 1 ? ` · visto ${a.vezes}x` : ''}`;
      if (peca) { pecaBotao(a, it.setor); principal = `<button type="button" class="vga-sim" data-vga-peca="${esc(a.ref)}" data-vga-chave="${esc(a.chave)}" data-vga-de="${esc(it.setor)}" title="Calendário, quem faz, datas e a sugestão do agente">Abrir a peça</button>`; }
      if (dono) {
        const resolver = botaoAchado(it, 'resolvido', 'Já resolvi', peca ? '' : ' class="vga-sim"');
        if (peca) segunda = resolver; else principal = resolver;
        mais = botaoAchado(it, 'ignorar', 'Ignorar') + botaoAchado(it, 'errado', 'Estava errado', ' title="O agente se enganou: conta no acerto dele"') + abrirAgentes;
      } else if (!peca) principal = abrirPrincipal;
      else mais = abrirAgentes;
    } else if (it.tipo === 'licao') {
      titulo = it.l.texto; detalhe = `O agente viu isso se repetir e quer guardar como regra${it.l.prova ? ' · ' + esc(it.l.prova) : ''}`;
      const varias = (it.copias || []).length > 1, lote = varias ? ` data-vga-licoes="${esc(JSON.stringify(it.copias))}"` : '';
      const botaoLicao = (acao, rotulo, cls = '') => varias ? `<button type="button"${cls} data-vga-licao-lote="${acao}"${lote}>${rotulo}</button>`
        : `<button type="button"${cls} data-vga-de="${esc(it.setor)}" data-vga-licao="${acao}" data-vga-id="${esc(it.l.id)}">${rotulo}</button>`;
      if (dono) { principal = botaoLicao('incorporar', 'Vale sempre', ' class="vga-sim"'); segunda = botaoLicao('contestar', 'Não vale'); mais = abrirAgentes; }
      else principal = abrirPrincipal;
    } else if (it.tipo === 'aprovacao') {
      const x = it.p, vence = Date.parse(x.expiraEm) - Date.now();
      titulo = x.resumo; detalhe = `${x.destino ? 'Para ' + esc(x.destino) + ' · ' : ''}${esc(it.agente)} está em sombra e só faz depois do OK de um dono · pedido ${esc(quando(x.criadoEm))}${vence > 0 ? ` · vence em ${Math.max(1, Math.round(vence / 3600e3))} h` : ''} · código ${esc(x.id)}`
        + (x.previa ? `</small><details class="vga-previa"><summary>O que será feito</summary><pre>${esc(x.previa)}</pre></details><small>` : '');
      if (dono) { principal = `<button type="button" class="vga-sim" data-vga-de="${esc(it.setor)}" data-vga-aprovacao="aprovar" data-vga-id="${esc(x.id)}">Aprovar</button>`; segunda = `<button type="button" data-vga-de="${esc(it.setor)}" data-vga-aprovacao="recusar" data-vga-id="${esc(x.id)}" title="Não faz e vira aprendizado do agente">Recusar</button>`; mais = abrirAgentes; }
      else { principal = abrirPrincipal; segunda = '<span class="vga-nota">Só um dono aprova.</span>'; }
    } else if (it.tipo === 'falha') {
      titulo = it.e.tarefa; detalhe = `${esc(it.e.erro || 'Sem detalhe do erro.')} · ${esc(quando(it.e.em))}`; principal = abrirPrincipal;
    } else if (it.tipo === 'nivel') {
      titulo = `${it.agente} acertou o bastante para agir com menos aprovação`; detalhe = `${esc(it.texto)}. Um dono decide em "Dar autonomia", na página do agente.`; principal = abrirPrincipal;
    } else if (it.tipo === 'acao') {
      titulo = it.e.tarefa; detalhe = `Só quem pediu confirma, respondendo SIM no WhatsApp; o código vale 5 minutos · ${esc(quando(it.e.em))}`;
    } else {
      titulo = it.e.tarefa; detalhe = `${esc(it.nome)} está em modo sombra: propõe e espera um dono na central do VYBES · ${esc(quando(it.e.em))}`; principal = abrirPrincipal;
    }
    const acoes = principal + segunda + maisHtml(mais);
    const quem = vistos.length > 1 ? `visto por ${esc(listaDeNomes(vistos.map((v) => v.agente)))}` : `<b>${esc(it.agente)}</b> · ${esc(it.nome)}`;
    const s0 = setores().find((x) => x.id === it.setor) || { agente: it.agente, andar: null };
    return `<li class="vga-item">${it.dentro ? '' : retratoHtml(s0)}<span class="vga-fila-meio">${it.dentro ? '' : `<span class="vga-fila-cab"><span class="vga-selo ${nivel}">${esc(rot)}</span><small>${quem}${it.tipo === 'grupo' ? ` · ${it.achados.length} parecidos` : ''}</small></span>`}<b>${esc(titulo)}</b><small>${detalhe}</small></span>${acoes ? `<span class="vga-acoes">${acoes}</span>` : ''}${extra}</li>`;
  }
  // ===== Quadros "Agentes" e "Perfil do agente" do padrão v2 (moodboard aprovado, 12/11/2026) =====
  // O que espera um dono vira um baralho: um pedido na frente, os próximos atrás; decidir tira o da frente e traz o
  // seguinte. A fila inteira (com "ver um a um", o que é só para acompanhar e o que espera confirmação) continua em
  // "ver em lista". As decisões usam as mesmas rotas de sempre (etapa=aprovacao, achado e estado).
  const iniciais = (nome) => { const t = String(nome || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1, 2).toLowerCase() : '?'; };
  const SELO_MODO = { ativo: 'g', sombra: 'v', pausado: 'a', desligado: 'n', planejado: 'n' };
  const horasAte = (iso) => Math.max(1, Math.round((Date.parse(iso) - Date.now()) / 3600e3));
  // Os mesmos atributos do botaoAchado, para o botão do baralho.
  function attrsDoAchado(it, acao) {
    const chaves = it.chaves || [it.a?.chave], vistos = [...new Set((it.vistos || [it]).map((v) => v.setor))];
    if (chaves.length === 1) return `data-vga-de="${esc(it.setor)}" data-vga-achado="${acao}" data-vga-chave="${esc(chaves[0])}"`;
    return `data-vga-de="${esc(it.setor)}" data-vga-lote="${acao}" data-vga-chaves="${esc(JSON.stringify(chaves))}" data-vga-setores="${esc(JSON.stringify(vistos))}"${it.tipo === 'grupo' ? '' : ' data-vga-vistos'}`;
  }
  // O pedido da frente em partes: quem pede, o que quer, a prova, o efeito de cada resposta e de onde veio.
  function cartaDe(it) {
    const vistos = it.vistos || [{ setor: it.setor, agente: it.agente, nome: it.nome }];
    const de = `data-vga-de="${esc(it.setor)}"`;
    const abrir = vistos.map((v) => `<button type="button" class="v2g-link" data-vga-setor="${esc(v.setor)}">abrir ${esc(v.agente)}</button>`).join(' · ');
    const c = { quem: vistos.length > 1 ? `${vistos[0].agente} e mais ${vistos.length - 1}` : it.agente, papel: vistos.length > 1 ? '' : it.nome || '', tipo: TIPO[it.tipo][0],
      selos: [], tit: '', prova: '', sub: '', efeito: '', sim: ['Pode fazer', ''], nao: ['Não faça', ''], veio: [] };
    if (it.tipo === 'aprovacao') {
      const x = it.p, h = horasAte(x.expiraEm);
      c.tipo = 'Pedido'; c.selos.push([h <= 6 ? 'r' : 'a', `Vence em ${h} h`]);
      c.tit = x.resumo; c.prova = x.previa || (x.destino ? `Para ${x.destino}` : 'Sem prévia do que será feito.'); c.sub = x.previa && x.destino ? `Para ${x.destino}` : '';
      c.efeito = `<b>Pode fazer:</b> a central executa${x.destino ? ` em ${esc(x.destino)}` : ''}. <b>Não faça:</b> não faz e vira aprendizado.`;
      c.sim[1] = `${de} data-vga-aprovacao="aprovar" data-vga-id="${esc(x.id)}"`; c.nao[1] = `${de} data-vga-aprovacao="recusar" data-vga-id="${esc(x.id)}"`;
      c.veio = [`${esc(it.agente)} pediu ${esc(quando(x.criadoEm))} · código ${esc(x.id)}`, `${esc(it.agente)} está em sombra: só faz depois do OK de um dono · ${abrir}`, `Sem resposta sua em ${h} h, o pedido vence e nada muda`];
    } else if (it.tipo === 'licao') {
      const varias = (it.copias || []).length > 1, alvo = (acao) => (varias ? `data-vga-licao-lote="${acao}" data-vga-licoes="${esc(JSON.stringify(it.copias))}"` : `${de} data-vga-licao="${acao}" data-vga-id="${esc(it.l.id)}"`);
      c.tipo = 'Regra nova'; c.selos.push(['v', 'Lição']);
      c.tit = 'Quer guardar como regra'; c.prova = it.l.texto; c.sub = it.l.prova || '';
      c.efeito = '<b>Pode fazer:</b> vale sempre. <b>Não faça:</b> não vale.';
      c.sim[1] = alvo('incorporar'); c.nao[1] = alvo('contestar');
      c.veio = [vistos.length > 1 ? `Visto por ${esc(listaDeNomes(vistos.map((v) => v.agente)))}` : `${esc(it.agente)} viu isso se repetir`, it.em ? `Em revisão desde ${esc(quando(it.em))}` : '', abrir];
    } else if (it.tipo === 'nivel') {
      c.tipo = 'Autonomia'; c.selos.push(['a', 'Promoção']);
      c.tit = 'Quer agir sozinho, sem esperar o seu OK'; c.prova = it.texto;
      c.efeito = '<b>Pode fazer:</b> passa de sombra para ativo. <b>Não faça:</b> continua em sombra.';
      c.sim[1] = `data-vga-autonomia="${esc(it.setor)}"`; c.nao[1] = `data-vga-passa="1" data-vga-fica="${esc(it.agente)}"`;
      c.veio = [`${esc(it.agente)} acertou o bastante para agir com menos aprovação`, 'Ativo: age sozinho e conta no grupo dos sócios o que fez', abrir];
    } else if (it.tipo === 'achado') {
      const a = it.a;
      c.tipo = 'Achado'; c.selos.push(['r', 'Urgente']);
      c.tit = a.fato; c.prova = a.prova || a.sugestao || 'Sem prova registrada.'; c.sub = [a.cliente, a.prova ? a.sugestao : ''].filter(Boolean).join(' · ');
      c.efeito = `<b>Já resolvi:</b> fecha o achado. <b>Ignorar:</b> ${esc(it.agente)} para de avisar.`;
      c.sim = ['Já resolvi', attrsDoAchado(it, 'resolvido')]; c.nao = ['Ignorar', attrsDoAchado(it, 'ignorar')];
      if (ehPeca(a)) pecaBotao(a, it.setor);
      c.veio = [`Desde ${esc(quando(a.primeiraVez))}${a.vezes > 1 ? ` · visto ${a.vezes} vezes` : ''}`, vistos.length > 1 ? `Visto por ${esc(listaDeNomes(vistos.map((v) => v.agente)))}` : '',
        [ehPeca(a) ? `<button type="button" class="v2g-link" data-vga-peca="${esc(a.ref)}" data-vga-chave="${esc(a.chave)}" data-vga-de="${esc(it.setor)}">abrir a peça</button>` : '',
          souDono() ? `<button type="button" class="v2g-link" ${attrsDoAchado(it, 'errado')} title="O agente se enganou: conta na nota dele">estava errado</button>` : '', abrir].filter(Boolean).join(' · ')];
    } else if (it.tipo === 'grupo') {
      const n = it.achados.length;
      c.tipo = 'Achados'; c.selos.push(['r', `${n} parecidos`]);
      c.tit = it.titulo; c.prova = it.clientes.length ? it.clientes.slice(0, 6).join(', ') + (it.clientes.length > 6 ? ` e mais ${it.clientes.length - 6}` : '') : it.exemplo || 'Achados do mesmo tipo.';
      c.sub = it.clientes.length && it.exemplo ? `Ex.: ${it.exemplo}` : '';
      c.efeito = `<b>Resolver os ${n}:</b> fecha todos de uma vez. Para decidir um a um, veja em lista.`;
      c.sim = [`Resolver os ${n}`, attrsDoAchado(it, 'resolvido')]; c.nao = [`Ignorar os ${n}`, attrsDoAchado(it, 'ignorar')];
      c.veio = [`O mais antigo desde ${esc(quando(it.em))}`, `<button type="button" class="v2g-link" data-vga-lista>ver um a um</button> · ${abrir}`];
    } else {
      c.tipo = 'Falha'; c.selos.push(['r', 'Parou com falha']);
      c.tit = it.e.tarefa; c.prova = it.e.erro || 'Sem detalhe do erro.'; c.sub = quando(it.e.em);
      c.efeito = `Abra ${esc(it.agente)} para ver o que parou.`;
      c.sim = [`Abrir ${it.agente}`, `data-vga-setor="${esc(it.setor)}"`]; c.nao = ['Depois', 'data-vga-passa="1"'];
      c.veio = [`A execução parou ${esc(quando(it.e.em))}`, abrir];
    }
    c.veio = c.veio.filter(Boolean);
    return c;
  }
  function baralhoHtml(itens, { titulo, sub, vazio, doAgente = false, veio = true }) {
    const n = itens.length, dono = souDono();
    st.frente = n ? ((st.frente % n) + n) % n : 0;
    const cab = `<div class="v2a-cab"><h3 class="v2g-h2">${esc(titulo)}</h3><span class="v2g-sub">${sub}</span></div>`;
    if (!n) return `${cab}<div class="v2g-card v2a-vazio"><p>${vazio}</p></div>`;
    const frente = cartaDe(itens[st.frente]);
    const cartas = [0, 1, 2].filter((pos) => pos < n).map((pos) => {
      const it = itens[(st.frente + pos) % n], c = pos ? cartaDe(it) : frente;
      const anima = pos === 0 ? (st.saindo ? ' v2a-sai' : st.chegou ? ' v2a-vem' : '') : '';
      return `<div class="v2-carta v2a-carta${anima}" data-pos="${pos}"${pos ? ' aria-hidden="true"' : ''}>
        <div class="v2a-carta-cab"><span class="v2g-av lil" aria-hidden="true">${esc(iniciais(it.agente))}</span><p>${doAgente ? `<b>${esc(c.tipo)}</b>` : `<b>${esc(c.quem)}</b>${c.papel ? ` <span class="v2g-sub">· ${esc(c.papel)}</span>` : ''}`}</p>${c.selos.map(([tom, t]) => `<span class="v2g-pill ${tom}">${esc(t)}</span>`).join('')}</div>
        <p class="v2a-tit">${esc(c.tit)}</p>
        <div class="v2a-prova"><p>${esc(c.prova)}</p>${c.sub ? `<p class="v2g-sub">${esc(c.sub)}</p>` : ''}</div>
        <p class="v2a-efeito">${c.efeito}</p></div>`;
    }).join('');
    const trava = st.enviando ? ' disabled' : '';
    const decide = dono ? `<div class="v2a-decide"><button type="button" class="v2g-btn" ${frente.nao[1]}${trava}>${esc(frente.nao[0])}</button><button type="button" class="v2g-btn k v2-estado" ${frente.sim[1]}${st.saindo ? ' data-estado="indo"' : ''}${trava}>${esc(frente.sim[0])}</button></div>`
      : '<p class="v2g-sub v2a-decide">Só um dono decide.</p>';
    const passo = `<div class="v2a-passo"><button type="button" class="v2a-pts" data-vga-passa="1" aria-label="Passar para o próximo pedido"${n > 1 ? '' : ' disabled'}><span class="v2-pontos">${itens.slice(0, 12).map((_, i) => `<i${i === Math.min(st.frente, 11) ? ' class="on"' : ''}></i>`).join('')}</span></button>
      <span class="v2g-sub">${st.frente + 1} de ${n}${n > 1 ? ' · seta para os lados passa' : ''} · <button type="button" class="v2g-link" data-vga-lista>ver em lista</button></span></div>`;
    const deOnde = veio ? `<div class="v2g-card v2a-veio"><div class="v2g-cab"><h3 class="v2g-h2">De onde veio</h3><span class="v2g-sub">o pedido da frente, de ${esc(frente.quem)}</span></div>${frente.veio.map((l) => `<p class="v2g-hist"><span>${l}</span></p>`).join('')}</div>` : '';
    return `${cab}<div class="v2a-mesa"><div class="v2-baralho v2a-baralho${doAgente ? ' menor' : ''}">${cartas}</div>${decide}${passo}</div>${deOnde}`;
  }
  // O prazo mais curto entre os pedidos que vencem (aprovação de agente em sombra).
  function venceEm(itens) {
    const hs = itens.filter((it) => it.tipo === 'aprovacao').map((it) => horasAte(it.p.expiraEm));
    return hs.length ? Math.min(...hs) : null;
  }
  const pedidosTxt = (n) => `${n} pedido${n === 1 ? '' : 's'}`;
  function centralHtml() {
    const f = fonte();
    if (f.dados) return `<span class="v2g-pill g" title="Leitura às ${new Date(f.atualizadoEm || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}">Central do VYBES no ar</span>`;
    return f.erro ? '<span class="v2g-pill a">Sem sinal da central do VYBES agora</span>' : '<span class="v2g-pill n">Consultando a central do VYBES…</span>';
  }
  // "Aprovar os N": o "pode fazer" de uma vez para o que é pedido de agente em sombra e lição a confirmar.
  const aprovaveis = (F) => F.decidir.filter((it) => it.tipo === 'aprovacao' || it.tipo === 'licao');
  // A nota do agente é o acerto que a central já calcula (core/perfil-agente.js): resolvidos sobre resolvidos mais os
  // marcados como errado, em 7 dias. Sem retorno de um dono, não há nota.
  function notaDe(setor) { const n = st.perfis[setor]?.dados?.perfil?.numeros?.acerto; return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null; }
  const corDaNota = (n) => (n == null ? ['#C9C2B6', '#6B665E'] : n >= 75 ? ['#11613A', '#11613A'] : n >= 60 ? ['#9A5B00', '#7A4A00'] : ['#B42318', '#B42318']);
  function linhaAgenteHtml(s, F, anima) {
    const m = modoDo(s), [rot] = rotuloDoModo(m), nota = notaDe(s.id), [barra, tinta] = corDaNota(nota);
    const meus = F.decidir.filter((it) => (it.vistos || [it]).some((v) => v.setor === s.id));
    const aperta = meus.some((it) => it.tipo === 'falha' || (it.tipo === 'aprovacao' && horasAte(it.p.expiraEm) <= 6));
    // 10 · Cor do humor: a taxa de acerto do agente pinta o cartão (sem nota, fica neutro).
    return `<button type="button" class="v2a-agl${nota != null ? ' v2-humor' : ''}"${nota != null ? (typeof vbHumorAttr === 'function' ? vbHumorAttr(nota) : '') : ''} data-vga-setor="${esc(s.id)}" title="Abrir ${esc(s.agente)}${m.ate ? ` · volta ${esc(quando(m.ate))}` : ''}">
      <span class="v2g-av lil" aria-hidden="true">${esc(iniciais(s.agente))}</span>
      <span class="v2a-agl-meio"><span class="v2a-agl-nome"><b>${esc(s.agente)}</b> <span class="v2g-sub">· ${esc(s.nome)}</span></span><span class="v2-barra${anima ? '' : ' parada'}"><i style="--v:${nota ?? 0}%;--c:${barra}"></i></span></span>
      ${meus.length ? `<span class="v2g-pill ${aperta ? 'r' : 'n'}">${pedidosTxt(meus.length)}</span>` : '<span></span>'}
      <span class="v2g-pill ${SELO_MODO[m.id] || 'n'}">${esc(rot)}</span>
      <b class="v2a-nt" style="color:${tinta}">${nota == null ? '—' : `<span${anima ? ' class="v2-num"' : ''}>${nota}</span>`}</b></button>`;
  }
  // "Como cada um está indo": os agentes que já rodam, com a nota; os demais, por andar e os planejados ficam a um clique.
  function comoVaoHtml(F, anima) {
    const todos = setores(), rodam = todos.filter((s) => modoDo(s).id !== 'planejado'), planejados = todos.filter((s) => modoDo(s).id === 'planejado');
    const comPedido = (s) => F.decidir.some((it) => (it.vistos || [it]).some((v) => v.setor === s.id));
    const frente = [...rodam.filter(comPedido), ...rodam.filter((s) => !comPedido(s))].slice(0, 6), resto = rodam.filter((s) => !frente.includes(s));
    const linha = (s) => linhaAgenteHtml(s, F, anima);
    const corpo = st.lado === 'andar' ? planta().map((a) => `<small class="v2a-andar">${esc(ANDAR(a.nivel, a.id))} · ${esc(a.nome)}</small>${a.setores.filter((s) => s.agente).map((s) => linha({ ...s, andar: a })).join('')}`).join('')
      : st.lado === 'planejados' ? (planejados.map(linha).join('') || '<p class="v2g-sub v2a-nada">Nenhum agente planejado.</p>')
      : (st.lado === 'todos' ? rodam : frente).map(linha).join('');
    const elo = (id, rotulo) => `<button type="button" class="v2g-link" data-vga-lado="${id}"${st.lado === id ? ' aria-current="true"' : ''}>${rotulo}</button>`;
    const pe = `<p class="v2g-sub v2a-agl-pe">${st.lado === 'resumo' && resto.length ? `+ ${resto.length} ${resto.length === 1 ? 'agente' : 'agentes'}: ${esc(listaDeNomes(resto.map((s) => s.agente)))} · ${elo('todos', 'mostrar')}` : st.lado === 'resumo' ? '' : elo('resumo', 'recolher')}${st.lado === 'resumo' && !resto.length ? '' : ' · '}${elo('andar', 'por andar')}${planejados.length ? ` · ${elo('planejados', `planejados (${planejados.length})`)}` : ''}</p>`;
    const baixos = rodam.filter((s) => { const n = notaDe(s.id); return n != null && n < 60; });
    const alerta = baixos.length ? `<p class="v2a-alerta"><b>${esc(listaDeNomes(baixos.map((s) => s.agente)))} ${baixos.length === 1 ? 'está' : 'estão'} com nota abaixo de 60.</b> Vale abrir e conferir o que foi marcado como errado antes de dar mais autonomia.</p>` : '';
    const acompanhar = F.acompanhar.reduce((t, x) => t + x.n, 0);
    return `<section class="v2g-card v2a-vao"><div class="v2g-cab"><h3 class="v2g-h2">Como cada um está indo</h3><span class="v2g-sub">nota dos últimos 7 dias</span></div>
      <div class="v2a-agls">${corpo}</div>${pe}${alerta}
      <p class="v2g-sub v2a-nota-expl">Nota = achados resolvidos sobre resolvidos mais os marcados como errado. Sem retorno não conta como acerto.</p>
      ${acompanhar ? `<div class="v2g-lin v2a-acomp"><span class="v2g-pill n">${acompanhar} achado${acompanhar === 1 ? '' : 's'}</span><p>para acompanhar, sem urgência · o agente segue vigiando e avisa se piorar</p><button type="button" class="v2g-btn s" data-vga-lista="1">Mostrar</button></div>` : ''}
      ${F.esperando.length ? `<div class="v2g-lin v2a-acomp"><span class="v2g-pill b">${F.esperando.length} esperando</span><p>a confirmação de quem pediu ou de um dono na central</p><button type="button" class="v2g-btn s" data-vga-lista="1">Mostrar</button></div>` : ''}</section>`;
  }
  // A fila inteira em lista (a um clique do baralho): decidir linha a linha, "ver um a um", acompanhar e esperando.
  function listaDaFilaHtml(F, dono, lendo) {
    const decidir = F.decidir.length ? `<ul class="vga-fila">${F.decidir.map((it) => itemFilaHtml(it, dono)).join('')}</ul>`
      : `<p class="vga-vazio">${lendo ? 'Procurando…' : 'Nada esperando você agora. Quando um agente pedir o seu OK, achar algo urgente, falhar ou quiser guardar uma lição, aparece aqui.'}</p>`;
    const acomp = F.acompanhar.length ? `<section class="vga-bloco"><h4>Achados para acompanhar<span class="vga-pilula">${F.acompanhar.reduce((t, x) => t + x.n, 0)}</span></h4>
      <p class="vga-vazio">Não são urgentes: o agente segue vigiando e avisa se piorar.</p><ul class="vga-fila vga-fila-curta">${F.acompanhar.map((x) => `<li><span class="vga-fila-meio"><small><b>${esc(x.agente)}</b> · ${esc(x.nome)}</small><b>${x.n} achado${x.n === 1 ? '' : 's'} em aberto</b><small>O mais antigo: ${esc(x.mais.fato)}</small></span><span class="vga-acoes"><button type="button" data-vga-setor="${esc(x.setor)}">${x.n === 1 ? 'Ver o achado' : `Ver os ${x.n}`}</button></span></li>`).join('')}</ul></section>` : '';
    const esp = F.esperando.length ? `<section class="vga-bloco"><h4>Esperando confirmação<span class="vga-pilula">${F.esperando.length}</span></h4><ul class="vga-fila">${F.esperando.map((it) => itemFilaHtml(it, dono)).join('')}</ul></section>` : '';
    return `<div class="v2a-cab"><h3 class="v2g-h2">Depende de você</h3><span class="v2g-sub">${pedidosTxt(F.decidir.length)} em lista · <button type="button" class="v2g-link" data-vga-lista>ver em baralho</button></span></div>
      <section class="vga-bloco"><h4>Para decidir<span class="vga-pilula">${F.decidir.length}</span></h4>${decidir}</section>${acomp}${esp}`;
  }
  function filaHtml() {
    const anima = st.anima;
    const F = filaAgora(), dono = souDono(), lendo = F.lidos < F.de && setores().some((s) => st.perfis[s.id]?.lendo || !st.perfis[s.id]);
    if (!F.de) return '<p class="vga-vazio">Carregando a planta do prédio…</p>';
    const n = F.decidir.length, h = venceEm(F.decidir);
    const prazo = h == null ? '' : `o mais antigo vence em ${h} h`;
    const fala = `<div class="v2g-card v2g-fala"><span class="v2g-ag" aria-hidden="true">V</span>
      <p><span class="v2g-quem">VYBES · Agência inteira</span>Eu organizo; quem fala e responde por cada área é o agente. ${lendo && !n ? 'Estou lendo o que cada um deixou para você.' : n ? `Hoje <b>${n === 1 ? '1 pedido depende' : `${n} pedidos dependem`} de você</b>${prazo ? ` e ${prazo}` : ''}.` : 'Hoje nada depende de você.'}</p>
      ${temDiagnostico() ? '<button type="button" class="v2g-btn s" data-vga-cerebro>Como o VYBES pensa</button>' : ''}</div>`;
    const avisoPedidos = dono && st.estados.erro ? `<p class="vga-nota">Os pedidos de aprovação não vieram da central agora (${esc(st.estados.erro)}).</p>` : '';
    const aviso = avisoPedidos + (lendo ? `<p class="vga-nota vga-lendo" role="status">Lendo ${F.lidos} de ${F.de} agentes na central do VYBES…</p>`
      : F.lidos < F.de ? `<p class="vga-nota">A central não respondeu por ${F.de - F.lidos} agente${F.de - F.lidos > 1 ? 's' : ''}: a fila pode estar incompleta. <button type="button" class="vga-link" data-vga-recarregar>Tentar de novo</button></p>` : '');
    const esq = st.lista ? listaDaFilaHtml(F, dono, lendo)
      : baralhoHtml(F.decidir, { titulo: 'Depende de você', sub: n ? `${pedidosTxt(n)}${prazo ? ` · ${prazo}` : ''}` : '', vazio: lendo ? 'Procurando…' : 'Nada esperando você agora. Quando um agente pedir o seu OK, achar algo urgente, falhar ou quiser guardar uma lição, aparece aqui.' });
    return `${fala}${aviso}<div class="v2a-grade${st.lista ? ' em-lista' : ''}"><div class="v2a-esq">${esq}</div>${comoVaoHtml(F, anima)}</div>${st.msg ? `<p class="vga-msg" role="status">${esc(st.msg)}</p>` : ''}`;
  }
  // Número no item Agentes do dock: só para quem decide (dono, sem "ver como"), lido ao entrar e a cada 10 min com a aba à vista.
  let ultimaContagem = 0;
  function pintarContagem() {
    const b = document.querySelector('.vv-trilho [data-trilho="agentes"]'); if (!b) return;
    const n = G.VybeBoletim?.podeVer?.() ? filaAgora().total : 0;
    let el = b.querySelector('.vv-trilho-n');
    if (!n) { el?.remove(); b.removeAttribute('data-pendentes'); return; }
    if (!el) { el = document.createElement('b'); el.className = 'vv-trilho-n'; b.append(el); }
    el.textContent = n > 99 ? '99+' : String(n); b.dataset.pendentes = String(n);
    el.setAttribute('aria-label', `${n} ${n > 1 ? 'coisas esperam' : 'coisa espera'} você`);
  }
  function contar(forcar = false) {
    if (!G.VybeBoletim?.podeVer?.() || document.hidden || !document.body.classList.contains('mundo')) return;
    if (!forcar && Date.now() - ultimaContagem < 10 * 60e3) return;
    if (!setores().length) return; // o mundo ainda não carregou a planta
    ultimaContagem = Date.now();
    Promise.all([lerTodos(), lerEstados(), mv().fonteAgentes?.()?.atualizar?.()]).then(() => { pintarContagem(); if (st.aberto && st.vista === 'fila') pintar(); document.dispatchEvent(new CustomEvent('vybe:agentes')); });
  }
  // "Os agentes viram" no Hoje (quadro 31 do redesign): o começo da mesma fila Depende de você, só para quem vê o boletim.
  function tituloDoItem(it) {
    if (it.tipo === 'grupo') return it.titulo;
    if (it.tipo === 'achado') return it.a?.fato;
    if (it.tipo === 'licao') return it.l?.texto;
    if (it.tipo === 'aprovacao') return it.p?.resumo;
    if (it.tipo === 'nivel') return `${it.agente} pode agir com menos aprovação`;
    return it.e?.tarefa;
  }
  function resumoParaHoje(n = 3) {
    if (!G.VybeBoletim?.podeVer?.()) return { pode: false, itens: [], total: 0 };
    contar();
    const F = filaAgora(), lendo = !F.de || (F.lidos < F.de && setores().some((s) => st.perfis[s.id]?.lendo || !st.perfis[s.id]));
    const itens = F.decidir.slice(0, n).map((it) => ({ titulo: String(tituloDoItem(it) || TIPO[it.tipo][0]), agente: it.agente, rotulo: TIPO[it.tipo][0], setor: it.setor,
      chave: it.tipo === 'achado' && /^vybe:[1-9]\d{0,19}$/.test(String(it.a?.ref || '')) ? it.a.chave : '' }));
    return { pode: true, lendo, itens, total: F.decidir.length };
  }
  // Abre a peça do achado (a mesma janela do boletim); devolve false quando não é achado com peça.
  function abrirPeca(setor, chave) {
    if (!chave) return false;
    const it = filaAgora().decidir.find((x) => x.tipo === 'achado' && x.setor === setor && x.a?.chave === chave);
    if (!it || !G.VybePeca?.abrir || !pecaBotao(it.a, setor)) return false;
    G.VybePeca.abrir(it.a.ref, { achado: it.a, setor });
    return true;
  }
  setInterval(() => contar(), 60e3);
  document.addEventListener('visibilitychange', () => contar());

  // "Como o VYBES pensa" (quadro 54 do redesign, 2ª rodada): o diagnóstico que ficava nas Sinapses do cliente (quem pensa
  // cada rotina, Qwen ou lógica fixa, a fila do Qwen e o detalhe por agente) mora aqui. O desenho é o mesmo do cérebro
  // (renderDiagnosticoCerebroHtml, vybe-clientes-cerebro.js), lido do mesmo mapa da central.
  const ICONE_CEREBRO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.5 6h7M7.2 8.2l3.6 7.6M16.8 8.2l-3.6 7.6"/></svg>';
  const temDiagnostico = () => typeof G.renderDiagnosticoCerebroHtml === 'function';
  function cerebroHtml() {
    return `<div class="vga-cab"><span class="vga-av grande vga-av-fila">${ICONE_CEREBRO}</span><span><small>Todos os agentes</small><h3>Como o VYBES pensa</h3>
      <span class="vga-expl">Quem pensa cada rotina (o Qwen ou a lógica fixa), de onde ela lê e onde escreve, agente por agente.</span></span></div>
      <div class="vga-cerebro">${temDiagnostico() ? G.renderDiagnosticoCerebroHtml() : '<p class="vga-vazio">O mapa do cérebro não carregou nesta tela.</p>'}</div>`;
  }
  function listaHtml() {
    const n = st.vista === 'fila' || ultimaContagem ? filaAgora().total : 0;
    return `<button type="button" class="vga-linha vga-linha-fila${st.vista === 'fila' ? ' sel' : ''}" data-vga-fila>
        <span class="vga-av vga-av-fila">${ICONE_FILA}</span><span class="vga-meio"><b>Depende de você</b><small>O que espera um dono, de todos os agentes</small></span>
        ${n ? `<em class="vga-n">${n}</em>` : ''}</button>` + (temDiagnostico() ? `<button type="button" class="vga-linha vga-linha-fila${st.vista === 'cerebro' ? ' sel' : ''}" data-vga-cerebro>
        <span class="vga-av vga-av-fila">${ICONE_CEREBRO}</span><span class="vga-meio"><b>Como o VYBES pensa</b><small>Qwen ou lógica fixa, rotina por rotina</small></span></button>` : '') + planta().map((a) => `<div class="vga-andar"><small>${esc(ANDAR(a.nivel, a.id))} · ${esc(a.nome)}</small>${a.setores.filter((s) => s.agente).map((s) => {
      const m = modoDo(s), [rot, , cor] = rotuloDoModo(m);
      return `<button type="button" class="vga-linha${st.vista === 'agente' && s.id === st.setor ? ' sel' : ''}" data-vga-setor="${esc(s.id)}">
        ${retratoHtml(s)}
        <span class="vga-meio"><b>${esc(s.agente)}</b><small>${esc(s.funcao || s.nome)} · ${esc(s.nome)}</small></span>
        <em style="--c:${cor}"${m.ate ? ` title="Volta ${esc(quando(m.ate))}"` : ''}>${esc(rot)}</em></button>`;
    }).join('')}</div>`).join('');
  }

  function detalheHtml() {
    if (st.vista === 'fila') return filaHtml();
    if (st.vista === 'cerebro') return cerebroHtml();
    const s = setores().find((x) => x.id === st.setor) || setores()[0]; if (!s) return '<p class="vga-vazio">Carregando a planta do prédio…</p>';
    st.setor = s.id;
    const f = fonte(), dados = f.dados || {}, modo = modoDo(s), [rot, expl0, cor] = rotuloDoModo(modo), anima = st.anima;
    const expl = expl0 + (modo.id === 'pausado' && modo.ate ? ` Volta ${quando(modo.ate)}.` : '') + (modo.pedidos ? ` ${modo.pedidos} pedido${modo.pedidos > 1 ? 's' : ''} esperando um dono.` : '');
    const atribs = Array.isArray(dados.atribuicoes) ? dados.atribuicoes.filter((a) => a.setor === s.id) : null;
    const fixas = (dados.rotinas?.[s.id] || []);
    const recorrentes = (atribs || []).filter((a) => a.estado === 'ativa' && a.frequencia !== 'uma_vez');
    const rotina = [...fixas.map((r) => ({ h: r.horario, t: r.texto, tipo: 'fixa' })), ...recorrentes.map((a) => ({ h: a.horario, t: `${a.texto}${a.cliente ? ' · ' + a.cliente : ''}`, tipo: (FREQ[a.frequencia] || '').toLowerCase() }))]
      .sort((a, b) => (a.h === 'madrugada' ? '00:00' : String(a.h)).localeCompare(b.h === 'madrugada' ? '00:00' : String(b.h)));
    const dono = souDono();
    const clientes = (typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : []).filter((c) => clienteAtivo(c)).map((c) => c.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const semCentral = f.erro || !f.dados;
    void lerPerfil(s.id);
    const pf = st.perfis[s.id] || {}, P = pf.dados?.perfil || null;
    // "Dar autonomia" (quadro 63, 10/11/2026): o agente em sombra passa a Ativo pelo mesmo estado da central (etapa=estado,
    // só dono; a central confere de novo). É para onde leva o "Pode ganhar autonomia" de Depende de você.
    const autonomia = dono && modo.real && modo.id === 'sombra' ? `<button type="button" class="vga-autonomia" data-vga-autonomia="${esc(s.id)}" title="Ativo: age sozinho e conta no grupo dos sócios o que fez"${st.enviando ? ' disabled' : ''}>Dar autonomia</button>` : '';

    // Quadro "Perfil do agente": a nota e o que ele faz no alto; o baralho do que espera você e o "Agora" à esquerda;
    // rotinas e últimos achados à direita.
    const nota = notaDe(s.id), [barra, tinta] = corDaNota(nota), n = P?.numeros || {};
    const seloNota = nota == null ? ['n', 'Sem nota ainda'] : nota >= 75 ? ['g', 'Indo bem'] : nota >= 60 ? ['a', 'Atenção'] : ['r', 'Abaixo de 60'];
    const notaHtml = `<div class="v2g-card v2g-kpi v2a-nota"><small>Nota · últimos 7 dias</small>
      <div class="v2a-nota-l"><b style="color:${tinta}">${nota == null ? '—' : `<span${anima ? ' class="v2-num"' : ''}>${nota}</span>`}</b><span class="v2g-pill ${seloNota[0]}">${seloNota[1]}</span></div>
      <div class="v2-barra${anima ? '' : ' parada'}"><i style="--v:${nota ?? 0}%;--c:${nota != null && nota >= 60 && nota < 75 ? '#E0A21B' : barra}"></i></div>
      <small>${!P ? esc(pf.erro || 'Lendo o perfil na central do VYBES…') : nota == null ? 'A nota aparece quando um dono resolve um achado ou marca que estava errado.'
        : `${n.resolvidos7d ?? 0} resolvido${n.resolvidos7d === 1 ? '' : 's'} e ${n.errados7d ?? 0} marcado${n.errados7d === 1 ? '' : 's'} como errado em 7 dias.`}</small></div>`;
    const faz = (s.skills || []).length ? s.skills.slice(0, 4) : [s.papel].filter(Boolean);
    const fazHtml = `<div class="v2g-card v2a-faz"${s.papel ? ` title="${esc(s.papel)}"` : ''}><div class="v2g-cab"><h3 class="v2g-h2">O que ele faz</h3><span class="v2g-sub">${esc(expl)}</span></div>
      ${faz.map((k) => `<p class="v2a-fazl">${esc(k)}</p>`).join('') || `<p class="v2g-sub v2a-nada">${s.estado === 'planejado' ? 'As ferramentas deste setor ainda não estão ligadas.' : 'Sem atribuição descrita.'}</p>`}
      <p class="v2g-sub v2a-numeros">${P ? numerosLinha(P) + ' · ' : ''}<button type="button" class="v2g-link" data-vga-mais aria-expanded="${st.mais}">${st.mais ? 'recolher a ficha' : 'estado, atribuições e histórico'}</button></p></div>`;

    const F = filaAgora(), meus = F.decidir.filter((it) => (it.vistos || [it]).some((v) => v.setor === s.id));
    const vivo = (dados.agentes || []).find((a) => a.setor === s.id), ult = vivo?.ultimos?.[0], prox = P?.projecao?.proximas || [];
    const agora = semCentral ? 'Sem leitura da central do VYBES agora: a atividade aparece quando ela responder.'
      : vivo?.tarefa ? `${esc(vivo.tarefa)}${vivo.desde ? ` · desde ${esc(quando(vivo.desde))}` : ''}` : ult ? `Último: ${esc(ult.tarefa)} · ${esc(quando(ult.em))}` : 'Nada registrado ainda.';
    const agoraHtml = `<div class="v2g-card v2a-agora"><div class="v2g-cab"><h3 class="v2g-h2">Agora</h3>${centralHtml()}</div>
      <p class="v2g-hist"><span>${agora}</span></p>
      <p class="v2g-hist"><span>${prox.length ? `Próxima execução: ${esc(horaCurta(prox[0].em))}, ${esc(prox[0].texto)}${prox.length > 1 ? ` · <button type="button" class="v2g-link" data-vga-mais="1">ver as ${prox.length}</button>` : ''}` : 'Nada marcado até amanhã.'}</span></p></div>`;
    const esq = `${baralhoHtml(meus, { titulo: 'Esperando a sua decisão', sub: meus.length ? `${pedidosTxt(meus.length)} de ${esc(s.agente)}` : '', vazio: `Nada de ${esc(s.agente)} espera você agora.`, doAgente: true, veio: false })}${agoraHtml}`;
    const semPerfil = `<section class="v2g-card v2a-rotinas"><div class="v2g-cab"><h3 class="v2g-h2">Rotinas</h3><span class="v2g-sub">${esc(pf.erro || 'lendo o perfil…')}</span></div>
      ${rotina.length ? rotina.map((r) => `<div class="v2g-lin"><p><b>${esc(r.t)}</b></p><span class="v2g-sub">${esc(r.h === 'madrugada' ? 'madrugada' : r.h)}</span><span class="v2g-pill n">${esc(r.tipo === 'fixa' ? 'roda hoje' : r.tipo)}</span></div>`).join('')
        : `<p class="v2g-sub v2a-nada">${s.estado === 'planejado' ? 'Sem rotina: as ferramentas deste setor ainda não estão ligadas.' : 'Sem rotina com horário. Dê uma atribuição recorrente na ficha.'}</p>`}</section>`;

    // A ficha completa (a um clique): o estado com a pausa, o que está fazendo em detalhe, as próximas execuções, as
    // lições e as atribuições com o formulário. É a tela de antes, inteira, para nada ficar sem lugar.
    const ficha = !st.mais ? '' : `<div class="v2a-ficha" id="v2a-ficha">
      <div class="vga-cab">${retratoHtml(s, { grande: true })}
        <span><small>${esc(ANDAR(s.andar.nivel))} · ${esc(s.andar.nome)} · ${esc(s.nome)}</small><h3>${esc(s.agente)} <i>${esc(s.funcao || '')}</i></h3>
        <span class="vga-estado" style="--c:${cor}">${esc(rot)}</span><span class="vga-expl">${esc(expl)}</span></span>${autonomia}</div>
      <p class="vga-papel">${esc(s.papel || '')}</p>
      ${souDono() && modo.real ? estadoFormHtml(s, modo) : ''}
      <div class="vga-colunas">
        <section class="vga-bloco"><h4>O que está fazendo</h4>
          ${semCentral ? '<p class="vga-vazio">Sem leitura da central do VYBES agora: a atividade aparece quando ela responder.</p>' : `<div class="vga-atividade">${mv().atividadeDoAgenteHtml?.(s.id) || ''}</div>`}
        </section>
        ${P ? projecaoHtml(P) : ''}
      </div>
      ${P ? licoesHtml(P, dono) : ''}
      <section class="vga-bloco"><h4>Atribuições</h4>
        ${atribs === null ? '<p class="vga-vazio">A central do VYBES ainda não guarda atribuições. Elas passam a valer depois que o VYBES for reiniciado com a versão nova.</p>'
          : atribs.length ? `<ul class="vga-atrib">${atribs.map((a) => `<li class="${esc(a.estado)}"><span><b>${esc(a.texto)}</b><small>${esc(FREQ[a.frequencia] || a.frequencia)}${a.frequencia !== 'uma_vez' ? ' às ' + esc(a.horario) : ''}${a.cliente ? ' · ' + esc(a.cliente) : ''} · ${esc(a.estado === 'ativa' ? (a.proxima ? 'próxima ' + quando(a.proxima) : 'ativa') : a.estado)}${a.vezes ? ' · rodou ' + a.vezes + 'x' : ''}${a.criadaPor ? ' · por ' + esc(a.criadaPor) : ''}</small></span>
              ${dono ? `<span class="vga-acoes">${a.estado === 'ativa' ? `<button type="button" data-vga-acao="pausar" data-vga-id="${esc(a.id)}">Pausar</button>` : a.estado === 'pausada' ? `<button type="button" data-vga-acao="retomar" data-vga-id="${esc(a.id)}">Retomar</button>` : ''}<button type="button" data-vga-acao="remover" data-vga-id="${esc(a.id)}">Remover</button></span>` : ''}</li>`).join('')}</ul>`
          : '<p class="vga-vazio">Nenhuma atribuição ainda.</p>'}
        ${dono && atribs !== null ? `<form class="vga-form" data-vga-form>
          <label class="largo"><span>O que ${esc(s.agente)} deve fazer</span><textarea name="texto" rows="2" maxlength="500" required placeholder="Ex.: revisar as legendas das peças que saem amanhã e apontar erro de português"></textarea></label>
          <label><span>Cliente (opcional)</span><select name="cliente"><option value="">Todos / nenhum</option>${clientes.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
          <label><span>Quando</span><select name="frequencia">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}"${k === 'diaria' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label><span>Horário</span><input type="time" name="horario" value="09:00" required></label>
          <button type="submit" class="vga-principal"${st.enviando ? ' disabled' : ''}>Atribuir</button>
          <p class="vga-nota">Modo sombra: quando vencer, vira proposta de ${esc(s.agente)} e espera a aprovação de um dono. ${s.estado === 'planejado' ? 'Este setor ainda não tem as ferramentas ligadas: a proposta fica registrada, mas ninguém executa sozinho.' : ''}</p>
        </form>` : !dono ? '<p class="vga-nota">Só os donos (Paulo, Vinícius, Ewerton e Deivid) dão atribuições aos agentes.</p>' : ''}
      </section></div>`;
    return `<div class="v2a-alto">${notaHtml}${fazHtml}</div>
      <div class="v2a-grade"><div class="v2a-esq">${esq}</div><div class="v2a-dir">${P ? rotinasHtml(P, dono) + achadosHtml(P, dono) : semPerfil}</div></div>
      ${st.msg ? `<p class="vga-msg" role="status">${esc(st.msg)}</p>` : ''}${ficha}`;
  }
  // O alto da janela. Na fila e em "Como o VYBES pensa", o cabeçalho único; no agente, o do quadro "Perfil do agente":
  // voltar, a bolinha com a letra, o nome, onde ele fica, o estado e "Trocar de agente" (a lista por andar de antes).
  function topoHtml() {
    const x = botaoX('data-vga-fechar', 'vga-fechar');
    if (st.vista !== 'agente') {
      const F = st.vista === 'fila' ? filaAgora() : null, varios = F && souDono() ? aprovaveis(F).length : 0;
      return `<div class="vga-topo vb-janela-topo">${cabecalho({ titulo: st.vista === 'cerebro' ? 'Como o VYBES pensa' : 'Agentes',
        acoes: (st.vista === 'cerebro' ? '<button type="button" class="v2g-btn s" data-vga-fila>‹ Agentes</button>' : centralHtml() + (varios > 1 ? `<button type="button" class="v2g-btn" data-vga-aprovar-todos${st.enviando ? ' disabled' : ''}>Aprovar os ${varios}</button>` : '')) + x })}</div>`;
    }
    const s = setores().find((y) => y.id === st.setor) || setores()[0];
    if (!s) return `<div class="vga-topo vb-janela-topo">${cabecalho({ titulo: 'Agentes', acoes: x })}</div>`;
    const modo = modoDo(s), [rot] = rotuloDoModo(modo);
    return `<div class="v2a-topo"><button type="button" class="v2g-btn s" data-vga-fila>‹ Agentes</button>
      <span class="v2g-ag" aria-hidden="true">${esc(String(s.agente || '?').charAt(0).toUpperCase())}</span><h2 id="v2a-nome">${esc(s.agente)}</h2>
      <p class="v2g-sub v2a-onde">${esc(s.funcao || s.nome)} · ${esc(ANDAR(s.andar.nivel, s.andar.id))} <button type="button" class="v2g-pill ${SELO_MODO[modo.id] || 'n'}" data-vga-mais="1" title="Ver o estado na ficha${modo.ate ? ` · volta ${esc(quando(modo.ate))}` : ''}">${esc(rot)}</button></p>
      <span class="v2a-trocar"><button type="button" class="v2g-btn" data-vga-trocar aria-expanded="${st.trocar}">Trocar de agente</button>${st.trocar ? `<nav class="v2a-trocar-menu" aria-label="Agentes por andar">${listaHtml()}</nav>` : ''}</span>
      ${temDiagnostico() ? '<button type="button" class="v2g-btn" data-vga-cerebro>Como o VYBES pensa</button>' : ''}${x}</div>`;
  }

  function pintar() {
    if (!st.aberto) { if (raiz) raiz.hidden = true; return; }
    if (!raiz) {
      raiz = document.createElement('section'); raiz.id = 'vv-agentes'; raiz.className = 'vv-ag v2a'; raiz.setAttribute('aria-label', 'Agentes da Vybe');
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('submit', aoEnviar);
      // Opção escolhida do estado marcada por classe (sem :has, que pesa no Vybe OS).
      raiz.addEventListener('change', (e) => { const g = e.target.closest?.('.vga-modos-opcoes'); if (g) g.querySelectorAll('label').forEach((l) => l.classList.toggle('sel', l.contains(e.target) && e.target.checked)); });
      document.body.append(raiz);
    }
    // A tela repinta a cada leitura da central (5 s): guarda a rolagem e os detalhes abertos do mesmo agente. Os
    // movimentos de chegada (número, barra) só tocam quando a pessoa abre ou troca de vista, não a cada leitura.
    const det0 = raiz.querySelector('.vga-detalhe'), lista0 = raiz.querySelector('.v2a-trocar-menu');
    const chave = st.vista + ':' + (st.vista === 'agente' ? st.setor : '');
    const mesmo = raiz.dataset.vista === chave, rolagem = mesmo && det0 ? det0.scrollTop : 0, rolagemLista = lista0 ? lista0.scrollTop : 0;
    const abertos = mesmo ? [...raiz.querySelectorAll('.vga-detalhe details[open]:not(.vga-mais) > summary')].map((s) => s.textContent) : [];
    st.anima = !mesmo;
    if (!mesmo) { st.frente = 0; st.achado = undefined; st.rotinasTodas = false; st.achadosTodos = false; st.mais = false; }
    raiz.dataset.vista = chave; raiz.dataset.setor = st.setor;
    const corpo = detalheHtml();
    raiz.innerHTML = `${topoHtml()}<div class="vga-detalhe v2a-corpo v2a-${st.vista}">${corpo}</div>`;
    st.chegou = false;
    raiz.hidden = false;
    if (abertos.length) raiz.querySelectorAll('.vga-detalhe details:not(.vga-mais) > summary').forEach((s) => { if (abertos.includes(s.textContent)) s.parentElement.open = true; });
    const det1 = raiz.querySelector('.vga-detalhe'), lista1 = raiz.querySelector('.v2a-trocar-menu');
    if (det1) det1.scrollTop = rolagem; if (lista1) lista1.scrollTop = rolagemLista;
  }

  // Atribuir (etapa padrão), ligar/desligar rotina ('rotina') ou dar retorno a um achado ou lição ('achado'): tudo pela
  // mesma ponte (server/vybes.js → central). A central confere se é dono.
  // Resolver ou ignorar um grupo: um achado por vez, pela mesma rota; o que já estava fechado conta como feito.
  async function emLote(chaves, acao, setores, { vistos = false } = {}) {
    st.enviando = true; st.saindo = st.doBaralho; st.doBaralho = false; st.msg = ''; pintar();
    let feitos = 0, falhou = '';
    for (const chave of chaves) {
      try {
        const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'achado', chave, acao }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok || d.error === 'Esse achado já foi fechado.') feitos++; else { falhou = d.error || 'Não foi possível salvar agora.'; break; }
      } catch { falhou = 'Sem conexão com o servidor.'; break; }
    }
    const feito = { ignorar: 'ignorado', errado: 'anotado como errado', resolvido: 'resolvido' }[acao] || 'resolvido';
    st.msg = falhou ? `${feitos} de ${chaves.length} fechados. Parou: ${falhou}`
      : vistos ? (setores.length === 1 ? `Achado ${feito} para o agente que o viu.` : `Achado ${feito} para os ${setores.length} agentes que o viram.`) : `${feitos} achado${feitos > 1 ? 's' : ''} ${feito}${feitos > 1 && acao !== 'errado' ? 's' : ''}.`;
    try { await Promise.all([mv().fonteAgentes?.()?.atualizar?.(true), ...setores.map((x) => lerPerfil(x, true))]); } catch { /* a fila relê na próxima */ }
    pintarContagem(); st.enviando = false; st.chegou = st.saindo; st.saindo = false; pintar();
  }
  // A mesma lição vista por vários agentes: uma decisão, gravada na lição de cada um pela mesma rota (etapa=achado).
  async function licoesEmLote(lista, acao) {
    st.enviando = true; st.saindo = st.doBaralho; st.doBaralho = false; st.msg = ''; pintar();
    let feitas = 0, falhou = '';
    for (const x of lista) {
      try {
        const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'achado', licao: x.id, acao }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok) feitas++; else { falhou = d.error || 'Não foi possível salvar agora.'; break; }
      } catch { falhou = 'Sem conexão com o servidor.'; break; }
    }
    st.msg = falhou ? `${feitas} de ${lista.length} ${lista.length === 1 ? 'lição atualizada' : 'lições atualizadas'}. Parou: ${falhou}` : lista.length === 1 ? 'Lição atualizada para o agente que a viu.' : `Lição atualizada para os ${lista.length} agentes que a viram.`;
    try { await Promise.all([...new Set(lista.map((x) => x.setor))].map((s) => lerPerfil(s, true))); } catch { /* a fila relê na próxima */ }
    pintarContagem(); st.enviando = false; st.chegou = st.saindo; st.saindo = false; pintar();
  }
  async function chamar(corpo, etapa = 'atribuir', ok = '', setor = st.setor) {
    st.enviando = true; st.saindo = st.doBaralho; st.doBaralho = false; st.msg = ''; pintar();
    try {
      const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa, ...corpo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível salvar agora.');
      st.msg = ok || (corpo.acao === 'criar' ? 'Atribuição registrada.' : 'Atribuição atualizada.');
      if (d.falhou) st.msg = `Aprovado, mas a ação falhou ao executar (${d.erro || 'erro'}). A decisão ficou registrada.`;
      await Promise.all([mv().fonteAgentes?.()?.atualizar?.(true), lerPerfil(setor, true), ['estado', 'aprovacao'].includes(etapa) ? lerEstados(true) : null]);
      pintarContagem();
    } catch (e) { st.msg = e.message; }
    finally { st.enviando = false; st.chegou = st.saindo; st.saindo = false; pintar(); }
  }
  // Passa o baralho: o da frente vai para o fim da fila e o seguinte vem.
  function passar(passo) { st.frente += passo; st.chegou = true; pintar(); }
  // "Aprovar os N": o mesmo "pode fazer" de cada pedido, um por vez, pelas rotas de sempre (aprovacao e lição).
  async function aprovarTodos() {
    const itens = aprovaveis(filaAgora());
    if (itens.length < 2 || st.enviando || !confirm(`Dizer "pode fazer" aos ${itens.length} pedidos de uma vez? Os pedidos de agente em sombra são executados pela central e as lições passam a valer sempre.`)) return;
    st.enviando = true; st.msg = ''; pintar();
    let feitos = 0, falhou = '';
    const mandar = async (corpo) => { const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Não foi possível salvar agora.'); };
    for (const it of itens) {
      try {
        if (it.tipo === 'aprovacao') await mandar({ etapa: 'aprovacao', id: it.p.id, decisao: 'aprovar', motivo: '' });
        else for (const c of (it.copias?.length ? it.copias : [{ id: it.l.id }])) await mandar({ etapa: 'achado', licao: c.id, acao: 'incorporar' });
        feitos++;
      } catch (e) { falhou = e.message || 'Sem conexão com o servidor.'; break; }
    }
    st.msg = falhou ? `${feitos} de ${itens.length} aprovados. Parou: ${falhou}` : `${feitos} pedidos aprovados.`;
    try { await Promise.all([mv().fonteAgentes?.()?.atualizar?.(true), lerEstados(true), ...[...new Set(itens.flatMap((it) => (it.vistos || [it]).map((v) => v.setor)))].map((x) => lerPerfil(x, true))]); } catch { /* a fila relê na próxima */ }
    pintarContagem(); st.enviando = false; st.frente = 0; pintar();
  }
  function aoClicar(e) {
    raiz?.querySelectorAll('.vga-mais[open]').forEach((d) => { if (!d.contains(e.target) || e.target.closest('button')) d.open = false; });
    const b = e.target.closest('button');
    // "Trocar de agente" fecha com um clique fora dele.
    if (st.trocar && !e.target.closest('.v2a-trocar')) { st.trocar = false; if (!b) { pintar(); return; } }
    if (!b) return;
    st.doBaralho = Boolean(b.closest('.v2a-decide'));
    if (b.hasAttribute('data-vga-fechar')) { fechar(); return; }
    if (b.hasAttribute('data-vga-trocar')) { st.trocar = !st.trocar; pintar(); return; }
    // Baralho: passar para o próximo, ver a fila em lista, abrir a linha do achado no lugar e os "mostrar".
    if (b.dataset.vgaPassa) { if (b.dataset.vgaFica) st.msg = `${b.dataset.vgaFica} continua em sombra.`; passar(Number(b.dataset.vgaPassa) || 1); return; }
    if (b.hasAttribute('data-vga-lista')) { st.lista = b.dataset.vgaLista ? true : !st.lista; pintar(); raiz?.querySelector('.vga-detalhe')?.scrollTo?.(0, 0); return; }
    if (b.dataset.vgaLado) { st.lado = b.dataset.vgaLado; pintar(); return; }
    if (b.dataset.vgaAbre != null) { st.achado = st.achado === b.dataset.vgaAbre ? '' : b.dataset.vgaAbre; raiz.querySelectorAll('.v2a-achado').forEach((l) => { const a = l.firstElementChild?.dataset.vgaAbre === st.achado; l.setAttribute('aria-expanded', String(a)); l.firstElementChild?.setAttribute('aria-expanded', String(a)); }); return; }
    if (b.hasAttribute('data-vga-achados-todos')) { st.achadosTodos = !st.achadosTodos; pintar(); return; }
    if (b.hasAttribute('data-vga-rotinas-todas')) { st.rotinasTodas = !st.rotinasTodas; pintar(); return; }
    if (b.hasAttribute('data-vga-mais')) { st.mais = b.dataset.vgaMais ? true : !st.mais; pintar(); if (st.mais) raiz?.querySelector('#v2a-ficha')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); return; }
    if (b.hasAttribute('data-vga-aprovar-todos')) { aprovarTodos(); return; }
    if (b.dataset.vgaSetor) { st.setor = b.dataset.vgaSetor; st.vista = 'agente'; st.trocar = false; st.msg = ''; pintar(); raiz?.querySelector('.vga-detalhe')?.scrollTo?.(0, 0); return; }
    if (b.hasAttribute('data-vga-fila')) { st.vista = 'fila'; st.trocar = false; st.msg = ''; pintar(); Promise.all([lerTodos(), lerEstados()]).then(() => { pintarContagem(); pintar(); }); return; }
    if (b.hasAttribute('data-vga-cerebro')) { st.vista = 'cerebro'; st.trocar = false; st.msg = ''; pintar(); raiz?.querySelector('.vga-detalhe')?.scrollTo?.(0, 0); return; }
    if (b.hasAttribute('data-vga-recarregar')) { setores().forEach((x) => { if (st.perfis[x.id]) st.perfis[x.id].em = 0; }); lerTodos().then(() => { pintarContagem(); pintar(); }); pintar(); return; }
    if (b.dataset.vgaRotina) { chamar({ id: b.dataset.vgaRotina, acao: b.dataset.vgaLigar }, 'rotina', b.dataset.vgaLigar === 'ligar' ? 'Rotina ligada.' : 'Rotina desligada: o agendador pula até ligar de novo.'); return; }
    // Pedido de orçamento que o Nestor (Compras) deixa pronto: copia o texto para colar no WhatsApp ou e-mail da gráfica.
    if (b.hasAttribute('data-vga-copiar')) {
      const texto = b.closest('details')?.querySelector('pre')?.textContent || '';
      const ok = () => { b.textContent = 'Copiado'; setTimeout(() => { b.textContent = 'Copiar pedido'; }, 1800); };
      (navigator.clipboard?.writeText(texto) || Promise.reject()).then(ok, () => { st.msg = 'Não deu para copiar sozinho: selecione o texto e copie.'; pintar(); });
      return;
    }
    if (b.dataset.vgaPeca) { G.VybePeca?.abrir?.(b.dataset.vgaPeca, { achado: achadosVistos[b.dataset.vgaDe + '|' + b.dataset.vgaChave] || null, setor: b.dataset.vgaDe }); return; }
    if (b.dataset.vgaLote) {
      let chaves = [], setoresDoLote = []; try { chaves = JSON.parse(b.dataset.vgaChaves || '[]'); setoresDoLote = JSON.parse(b.dataset.vgaSetores || '[]'); } catch { /* sem chaves */ }
      if (!chaves.length || st.enviando) return;
      if (!setoresDoLote.length) setoresDoLote = [b.dataset.vgaDe || st.setor];
      // O mesmo achado visto por vários agentes é uma decisão só (vale para todos); um grupo de achados pede confirmação.
      const vistos = b.hasAttribute('data-vga-vistos');
      if (!vistos && !confirm(`${b.dataset.vgaLote === 'ignorar' ? 'Ignorar' : 'Marcar como resolvidos'} os ${chaves.length} achados deste grupo?`)) return;
      emLote(chaves, b.dataset.vgaLote, setoresDoLote, { vistos }); return;
    }
    // Pedido de agente em sombra: aprovar executa a ação guardada; recusar não faz e vira aprendizado (motivo opcional).
    if (b.dataset.vgaAprovacao) {
      const recusar = b.dataset.vgaAprovacao === 'recusar';
      const motivo = recusar && typeof G.prompt === 'function' ? G.prompt('Por que não? (opcional, vira aprendizado do agente)', '') : '';
      if (motivo === null) return; // cancelou
      chamar({ id: b.dataset.vgaId, decisao: b.dataset.vgaAprovacao, motivo: motivo || '' }, 'aprovacao', recusar ? 'Recusado: não faço, e o agente anotou como aprendizado.' : 'Aprovado: a central executou.', b.dataset.vgaDe || st.setor);
      return;
    }
    if (b.dataset.vgaAchado) { chamar({ chave: b.dataset.vgaChave, acao: b.dataset.vgaAchado }, 'achado', b.dataset.vgaAchado === 'errado' ? 'Anotado: conta no acerto do agente.' : 'Achado fechado.', b.dataset.vgaDe || st.setor); return; }
    if (b.dataset.vgaAutonomia) {
      const s = setores().find((x) => x.id === b.dataset.vgaAutonomia);
      if (!s || st.enviando || !confirm(`Dar autonomia a ${s.agente}? Ele passa a agir sozinho, sem esperar o OK de um dono, e conta no grupo dos sócios o que fez. Dá para voltar a Sombra no Estado.`)) return;
      chamar({ setor: s.id, estado: 'ativo' }, 'estado', `${s.agente} agora age sozinho (Ativo).`, s.id);
      return;
    }
    if (b.dataset.vgaLicaoLote) {
      let lista = []; try { lista = JSON.parse(b.dataset.vgaLicoes || '[]'); } catch { /* sem lições */ }
      if (lista.length && !st.enviando) licoesEmLote(lista, b.dataset.vgaLicaoLote);
      return;
    }
    if (b.dataset.vgaLicao) { chamar({ licao: b.dataset.vgaId, acao: b.dataset.vgaLicao }, 'achado', 'Lição atualizada.', b.dataset.vgaDe || st.setor); return; }
    if (b.dataset.vgaAcao) {
      const acao = b.dataset.vgaAcao, id = b.dataset.vgaId;
      if (acao !== 'remover') { chamar({ acao, id }); return; }
      const pergunta = typeof vbConfirmarApagar === 'function' ? vbConfirmarApagar({ titulo: 'Remover esta atribuição?', rotulo: 'Remover' }) : Promise.resolve(confirm('Remover esta atribuição?'));
      pergunta.then((sim) => { if (sim) chamar({ acao, id }); });
    }
  }
  function aoEnviar(e) {
    const fe = e.target.closest('[data-vga-estado-form]');
    if (fe) {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(fe)), ate = v.estado === 'pausado' && v.ate ? new Date(v.ate).toISOString() : '';
      chamar({ setor: st.setor, estado: v.estado, ...(ate ? { ate } : {}) }, 'estado', `Estado salvo: ${(MODO[v.estado] || [v.estado])[0]}.`);
      return;
    }
    const f = e.target.closest('[data-vga-form]'); if (!f) return; e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    chamar({ acao: 'criar', setor: st.setor, texto: v.texto, cliente: v.cliente, frequencia: v.frequencia, horario: v.horario });
  }
  function abrir(setor) {
    // Sem agente escolhido abre na fila; ou na vista pedida há instantes pelo abrirCerebro (o dock abre com um respiro).
    if (setor) { st.setor = setor; st.vista = 'agente'; } else st.vista = pedido.vista && Date.now() < pedido.ate ? pedido.vista : 'fila';
    pedido = { vista: '', ate: 0 };
    st.aberto = true; st.msg = ''; st.lista = false; st.lado = 'resumo'; st.trocar = false; st.mais = false;
    if (raiz) raiz.dataset.vista = '';
    pintar();
    if (st.vista === 'fila') lerTodos().then(() => { pintarContagem(); pintar(); });
    lerEstados(true);
    Promise.resolve(mv().garantirModulo?.()).then((m) => { if (m?.avatarDoAgente) modRetrato = m; mv().fonteAgentes?.()?.atualizar?.(true)?.then?.(pintar); pintar(); });
  }
  function fechar() { st.aberto = false; pintar(); }
  // Abre a página Agentes já em "Como o VYBES pensa" (o botão das Sinapses do cliente leva para cá). Pelo dock quando ele
  // existe, para acender o item certo, fechar o que estiver por cima e valer o cadeado de quem não é dono.
  let pedido = { vista: '', ate: 0 };
  function abrirCerebro() {
    if (st.aberto) { st.vista = 'cerebro'; st.msg = ''; pintar(); raiz?.querySelector('.vga-detalhe')?.scrollTo?.(0, 0); return; }
    pedido = { vista: 'cerebro', ate: Date.now() + 3000 };
    if (typeof mv().irPara === 'function') mv().irPara('agentes'); else abrir();
  }
  // O mapa da central chegou ou o filtro (Qwen, lógica fixa…) mudou: repinta só se a vista aberta for a dele.
  document.addEventListener('vybe:cerebro-mapa', () => { if (st.aberto && st.vista === 'cerebro') pintar(); });
  // Mudou a peça e o achado foi resolvido na janela da peça: relê o perfil daquele agente. "Abrir a demanda completa":
  // a gaveta abre embaixo das janelas, a página Agentes sai da frente.
  G.addEventListener?.('vybe:achado-mudou', (e) => { const setor = e.detail?.setor; if (!setor) return; lerPerfil(setor, true).then(() => { pintarContagem(); if (st.aberto) pintar(); }); });
  G.addEventListener?.('vybe:peca-completa', () => { if (st.aberto) fechar(); });
  document.addEventListener('keydown', (e) => {
    if (!st.aberto || e.target.closest?.('input,textarea,select')) return;
    if (e.key === 'Escape') { if (st.trocar) { st.trocar = false; pintar(); } else fechar(); return; }
    // Seta para os lados passa o baralho (com mais de um pedido e sem outra janela por cima).
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.altKey && !e.ctrlKey && !e.metaKey && !st.enviando && raiz?.querySelectorAll('.v2a-baralho > .v2-carta').length > 1 && !document.querySelector('.workflow-modal.open, dialog[open]')) { e.preventDefault(); passar(e.key === 'ArrowRight' ? 1 : -1); }
  });
  // Seletor do estado do agente (só dono): uma frase curta em cada opção; a data de volta só vale para Pausado.
  function estadoFormHtml(s, modo) {
    const local = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const z = new Date(d.getTime() - d.getTimezoneOffset() * 60e3); return z.toISOString().slice(0, 16); };
    return `<form class="vga-bloco vga-modos" data-vga-estado-form><h4>Estado de ${esc(s.agente)}</h4>
      <div class="vga-modos-opcoes" role="radiogroup" aria-label="Estado de ${esc(s.agente)}">${Object.entries(MODO).map(([id, [nm, ex, c]]) => `<label style="--c:${c}"${modo.id === id ? ' class="sel"' : ''}><input type="radio" name="estado" value="${id}"${modo.id === id ? ' checked' : ''}><span><b>${esc(nm)}</b><small>${esc(ex)}</small></span></label>`).join('')}</div>
      <div class="vga-modos-fim"><label><span>Se pausar, volta sozinho em (opcional)</span><input type="datetime-local" name="ate" value="${modo.id === 'pausado' && modo.ate ? esc(local(modo.ate)) : ''}"></label>
      <button type="submit" class="vga-principal"${st.enviando ? ' disabled' : ''}>Salvar estado</button></div>
      <p class="vga-nota">Ativo faz sozinho e conta no grupo dos sócios. Sombra pede o OK de um dono no grupo dos sócios ou aqui em Depende de você. Pausado e desligado não rodam as rotinas.</p></form>`;
  }
  G.VybeAgentes = { abrir, abrirCerebro, fechar, filaDoDono, agrupar, itemFilaHtml, contar, resumoParaHoje, abrirPeca, aberto: () => st.aberto, repintar: () => { if (st.aberto && !raiz?.contains(document.activeElement)) pintar(); } };
})();
