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
  const st = { aberto: false, vista: 'fila', setor: 'orquestrador', msg: '', enviando: false, perfis: {}, estados: { dados: null, erro: '', em: 0, lendo: null } };
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
  function numerosHtml(P) {
    const n = P.numeros || {}, pj = P.projecao || {};
    return `<div class="vga-numeros">
      <span><b>${n.abertos ?? 0}</b><small>em aberto${n.altas ? ` · <em>${n.altas} urgente${n.altas > 1 ? 's' : ''}</em>` : ''}</small></span>
      <span><b>${n.resolvidos7d ?? 0}</b><small>resolvidos em 7 dias</small></span>
      <span title="Resolvidos ÷ (resolvidos + marcados como errado) em 7 dias"><b>${pct(n.acerto)}</b><small>acerto${n.errados7d ? ` · ${n.errados7d} errado${n.errados7d > 1 ? 's' : ''}` : ''}</small></span>
      <span><b>${n.horasAteResolver == null ? '—' : String(n.horasAteResolver).replace('.', ',') + ' h'}</b><small>até resolver (mediana)</small></span>
    </div><p class="vga-projecao"><b>Projeção:</b> ${esc(pj.tendencia || 'sem dados ainda')} · ${esc(pj.carga || '')}${pj.subirNivel ? ` · <em>${esc(pj.subirNivel)}</em>` : ''}</p>`;
  }
  // A peça do achado (vybe-mundo-peca.js): calendário, quem faz, datas e a sugestão do agente para aplicar ali mesmo.
  const achadosVistos = {};
  function pecaBotao(a, setor) {
    if (!/^vybe:[1-9]\d{0,19}$/.test(String(a?.ref || ''))) return '';
    achadosVistos[setor + '|' + a.chave] = a;
    return `<button type="button" class="vga-peca" data-vga-peca="${esc(a.ref)}" data-vga-chave="${esc(a.chave)}" data-vga-de="${esc(setor)}" title="Abrir a peça: calendário, quem faz, datas e a sugestão do agente" aria-label="Abrir a peça ${esc(a.titulo || a.fato || '')}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></button>`;
  }
  function achadosHtml(P, dono) {
    const ab = P.achados?.abertos || [], fe = P.achados?.resolvidos || [];
    const linha = (a, aberto) => `<li class="g-${esc(a.gravidade)}">${pecaBotao(a, P.setor || st.setor)}<span><b>${esc(a.fato)}</b><small>${a.cliente ? (typeof G.cliCor === 'function' ? G.cliCor(a.cliente) : esc(a.cliente)) + ' · ' : ''}${esc(a.prova)}${a.sugestao ? ' · ' + esc(a.sugestao) : ''}${aberto ? ` · desde ${esc(quando(a.primeiraVez))}${a.vezes > 1 ? ` · visto ${a.vezes}x` : ''}` : ` · ${esc(a.comoFechou || a.estado)} ${esc(quando(a.fechadoEm))}`}</small>
        ${a.ficha ? `<details><summary>Ficha para quem faz</summary><pre>${esc(a.ficha)}</pre></details>` : ''}${a.versaoSugerida ? `<details><summary>Versão sugerida pelo Qwen</summary><pre>${esc(a.versaoSugerida)}</pre></details>` : ''}${a.rascunho ? `<details class="vga-rascunho"${aberto ? ' open' : ''}><summary>Pedido de orçamento pronto</summary><pre>${esc(a.rascunho)}</pre><button type="button" class="vga-copiar" data-vga-copiar>Copiar pedido</button></details>` : ''}</span>
        ${aberto && dono ? `<span class="vga-acoes"><button type="button" data-vga-achado="resolvido" data-vga-chave="${esc(a.chave)}">Resolvido</button><button type="button" data-vga-achado="ignorar" data-vga-chave="${esc(a.chave)}">Ignorar</button><button type="button" data-vga-achado="errado" data-vga-chave="${esc(a.chave)}" title="O agente se enganou: conta no acerto dele">Estava errado</button></span>` : ''}</li>`;
    return `<section class="vga-bloco"><h4>O que ele achou<span class="vga-pilula">${ab.length}</span></h4>
      ${ab.length ? `<ul class="vga-achados">${ab.map((a) => linha(a, true)).join('')}</ul>` : '<p class="vga-vazio">Nada em aberto. Os achados aparecem quando as rotinas dele rodam.</p>'}
      ${fe.length ? `<details class="vga-hist"><summary>Resolvidos e fechados (${fe.length})</summary><ul class="vga-achados">${fe.map((a) => linha(a, false)).join('')}</ul></details>` : ''}</section>`;
  }
  function rotinasHtml(P, dono) {
    const rs = P.rotinas || [];
    if (!rs.length) return '';
    return `<section class="vga-bloco"><h4>Rotinas<span class="vga-pilula">${rs.filter((r) => r.ligada).length}/${rs.length}</span></h4><ul class="vga-rotinas">${rs.map((r) => {
      const [nm, cor, expl] = MOTOR[r.motor] || MOTOR.nao_mapeado;
      return `<li class="${r.ligada ? '' : 'off'}"><time>${esc(r.quando)}</time><span><b>${esc(r.texto)}${r.nova ? ' <i>nova</i>' : ''}</b>
        <small>${r.evita ? 'Evita: ' + esc(r.evita) + ' · ' : ''}<em class="vga-motor" style="--c:${cor}" title="${esc(expl)}">${esc(nm)}</em>${(r.leNomes || []).length ? ' · lê ' + r.leNomes.map(esc).join(', ') : ''}${(r.geraNomes || []).length ? ' → ' + r.geraNomes.map(esc).join(', ') : ''}</small>
        <small class="vga-codigo">${esc(r.codigo || '')}${r.ultimaRodada ? ` · última rodada ${esc(quando(r.ultimaRodada.em))}` : ''}${!r.ligada && r.desligadaPor ? ` · desligada por ${esc(r.desligadaPor)}` : ''}</small></span>
        ${dono && !r.fixa ? `<button type="button" class="vga-chave${r.ligada ? ' on' : ''}" role="switch" aria-checked="${r.ligada}" data-vga-rotina="${esc(r.id)}" data-vga-ligar="${r.ligada ? 'desligar' : 'ligar'}" aria-label="${r.ligada ? 'Desligar' : 'Ligar'} ${esc(r.texto)}"><i></i></button>` : r.fixa ? '<em class="vga-fixa">fixa</em>' : ''}</li>`;
    }).join('')}</ul></section>`;
  }
  function projecaoHtml(P) {
    const px = (P.projecao?.proximas || []).slice(0, 8), h = Object.entries(P.historico || {}).sort();
    const max = Math.max(1, ...h.map(([, v]) => v.concluidas + v.falhas));
    return `<section class="vga-bloco"><h4>Próximas execuções</h4>${px.length ? `<ul class="vga-rotina vga-proximas">${px.map((x) => `<li><time>${esc(horaCurta(x.em))}</time><span>${esc(x.texto)}</span><em>${x.tipo === 'atribuicao' ? 'atribuição' : 'rotina'}</em></li>`).join('')}</ul>` : '<p class="vga-vazio">Nada marcado até amanhã.</p>'}
      <h4 class="vga-h4-sep">Histórico (14 dias)</h4>${h.length ? `<div class="vga-barras" role="img" aria-label="Execuções por dia">${h.map(([dia, v]) => `<span title="${esc(dia.slice(8, 10) + '/' + dia.slice(5, 7))}: ${v.concluidas} concluídas, ${v.falhas} falhas, ${v.aguardando} aguardando"><i style="height:${Math.round(v.concluidas / max * 100)}%"></i>${v.falhas ? `<i class="f" style="height:${Math.max(4, Math.round(v.falhas / max * 100))}%"></i>` : ''}<small>${esc(dia.slice(8, 10))}</small></span>`).join('')}</div>` : '<p class="vga-vazio">Sem execução registrada nos últimos 14 dias.</p>'}</section>`;
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
  function filaHtml() {
    const F = filaAgora(), dono = souDono(), lendo = F.lidos < F.de && setores().some((s) => st.perfis[s.id]?.lendo || !st.perfis[s.id]);
    const cab = `<div class="vga-cab"><span class="vga-av grande vga-av-fila">${ICONE_FILA}</span><span><small>Todos os agentes</small><h3>Depende de você</h3>
      <span class="vga-expl">O que os agentes deixaram para um dono decidir. Decida aqui mesmo ou abra o agente.</span></span></div>`;
    if (!F.de) return cab + '<p class="vga-vazio">Carregando a planta do prédio…</p>';
    const avisoPedidos = dono && st.estados.erro ? `<p class="vga-nota">Os pedidos de aprovação não vieram da central agora (${esc(st.estados.erro)}).</p>` : '';
    const aviso = avisoPedidos + (lendo ? `<p class="vga-nota vga-lendo" role="status">Lendo ${F.lidos} de ${F.de} agentes na central do VYBES…</p>`
      : F.lidos < F.de ? `<p class="vga-nota">A central não respondeu por ${F.de - F.lidos} agente${F.de - F.lidos > 1 ? 's' : ''}: a fila pode estar incompleta. <button type="button" class="vga-link" data-vga-recarregar>Tentar de novo</button></p>` : '');
    const decidir = F.decidir.length ? `<ul class="vga-fila">${F.decidir.map((it) => itemFilaHtml(it, dono)).join('')}</ul>`
      : `<p class="vga-vazio">${lendo ? 'Procurando…' : 'Nada esperando você agora. Quando um agente pedir o seu OK, achar algo urgente, falhar ou quiser guardar uma lição, aparece aqui.'}</p>`;
    const acomp = F.acompanhar.length ? `<section class="vga-bloco"><h4>Achados para acompanhar<span class="vga-pilula">${F.acompanhar.reduce((t, x) => t + x.n, 0)}</span></h4>
      <p class="vga-vazio">Não são urgentes: o agente segue vigiando e avisa se piorar.</p><ul class="vga-fila vga-fila-curta">${F.acompanhar.map((x) => `<li><span class="vga-fila-meio"><small><b>${esc(x.agente)}</b> · ${esc(x.nome)}</small><b>${x.n} achado${x.n > 1 ? 's' : ''} em aberto</b><small>O mais antigo: ${esc(x.mais.fato)}</small></span><span class="vga-acoes"><button type="button" data-vga-setor="${esc(x.setor)}">Ver os ${x.n}</button></span></li>`).join('')}</ul></section>` : '';
    const esp = F.esperando.length ? `<section class="vga-bloco"><h4>Esperando confirmação<span class="vga-pilula">${F.esperando.length}</span></h4><ul class="vga-fila">${F.esperando.map((it) => itemFilaHtml(it, dono)).join('')}</ul></section>` : '';
    return `${cab}${aviso}<section class="vga-bloco"><h4>Para decidir<span class="vga-pilula">${F.decidir.length}</span></h4>${decidir}</section>${acomp}${esp}${st.msg ? `<p class="vga-msg" role="status">${esc(st.msg)}</p>` : ''}`;
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
    Promise.all([lerTodos(), lerEstados(), mv().fonteAgentes?.()?.atualizar?.()]).then(() => { pintarContagem(); if (st.aberto && st.vista === 'fila') pintar(); });
  }
  setInterval(() => contar(), 60e3);
  document.addEventListener('visibilitychange', () => contar());

  function listaHtml() {
    const n = st.vista === 'fila' || ultimaContagem ? filaAgora().total : 0;
    return `<button type="button" class="vga-linha vga-linha-fila${st.vista === 'fila' ? ' sel' : ''}" data-vga-fila>
        <span class="vga-av vga-av-fila">${ICONE_FILA}</span><span class="vga-meio"><b>Depende de você</b><small>O que espera um dono, de todos os agentes</small></span>
        ${n ? `<em class="vga-n">${n}</em>` : ''}</button>` + planta().map((a) => `<div class="vga-andar"><small>${esc(ANDAR(a.nivel, a.id))} · ${esc(a.nome)}</small>${a.setores.filter((s) => s.agente).map((s) => {
      const m = modoDo(s), [rot, , cor] = rotuloDoModo(m);
      return `<button type="button" class="vga-linha${st.vista !== 'fila' && s.id === st.setor ? ' sel' : ''}" data-vga-setor="${esc(s.id)}">
        ${retratoHtml(s)}
        <span class="vga-meio"><b>${esc(s.agente)}</b><small>${esc(s.funcao || s.nome)} · ${esc(s.nome)}</small></span>
        <em style="--c:${cor}"${m.ate ? ` title="Volta ${esc(quando(m.ate))}"` : ''}>${esc(rot)}</em></button>`;
    }).join('')}</div>`).join('');
  }

  function detalheHtml() {
    if (st.vista === 'fila') return filaHtml();
    const s = setores().find((x) => x.id === st.setor) || setores()[0]; if (!s) return '<p class="vga-vazio">Carregando a planta do prédio…</p>';
    st.setor = s.id;
    const f = fonte(), dados = f.dados || {}, modo = modoDo(s), [rot, expl0, cor] = rotuloDoModo(modo);
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
    return `<div class="vga-cab">${retratoHtml(s, { grande: true })}
        <span><small>${esc(ANDAR(s.andar.nivel))} · ${esc(s.andar.nome)} · ${esc(s.nome)}</small><h3>${esc(s.agente)} <i>${esc(s.funcao || '')}</i></h3>
        <span class="vga-estado" style="--c:${cor}">${esc(rot)}</span><span class="vga-expl">${esc(expl)}</span></span>${autonomia}</div>
      <p class="vga-papel">${esc(s.papel || '')}</p>
      ${souDono() && modo.real ? estadoFormHtml(s, modo) : ''}
      ${(s.skills || []).length ? `<div class="vga-skills">${s.skills.map((k) => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
      ${P ? numerosHtml(P) : `<p class="vga-nota">${esc(pf.erro || 'Lendo o perfil na central do VYBES…')}</p>`}
      <div class="vga-colunas">
        <section class="vga-bloco"><h4>O que está fazendo</h4>
          ${semCentral ? '<p class="vga-vazio">Sem leitura da central do VYBES agora: a atividade aparece quando ela responder.</p>' : `<div class="vga-atividade">${mv().atividadeDoAgenteHtml?.(s.id) || ''}</div>`}
        </section>
        ${P ? projecaoHtml(P) : `<section class="vga-bloco"><h4>Rotina do dia</h4>
          ${rotina.length ? `<ul class="vga-rotina">${rotina.map((r) => `<li><time>${esc(r.h === 'madrugada' ? 'madrugada' : r.h)}</time><span>${esc(r.t)}</span><em>${esc(r.tipo === 'fixa' ? 'roda hoje' : r.tipo)}</em></li>`).join('')}</ul>`
            : `<p class="vga-vazio">${s.estado === 'planejado' ? 'Sem rotina: as ferramentas deste setor ainda não estão ligadas.' : 'Sem rotina com horário. Dê uma atribuição recorrente abaixo.'}</p>`}
        </section>`}
      </div>
      ${P ? achadosHtml(P, dono) + rotinasHtml(P, dono) + licoesHtml(P, dono) : ''}
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
        ${st.msg ? `<p class="vga-msg" role="status">${esc(st.msg)}</p>` : ''}
      </section>`;
  }

  function pintar() {
    if (!st.aberto) { if (raiz) raiz.hidden = true; return; }
    if (!raiz) {
      raiz = document.createElement('section'); raiz.id = 'vv-agentes'; raiz.className = 'vv-ag'; raiz.setAttribute('aria-label', 'Agentes da Vybe');
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('submit', aoEnviar);
      // Opção escolhida do estado marcada por classe (sem :has, que pesa no Vybe OS).
      raiz.addEventListener('change', (e) => { const g = e.target.closest?.('.vga-modos-opcoes'); if (g) g.querySelectorAll('label').forEach((l) => l.classList.toggle('sel', l.contains(e.target) && e.target.checked)); });
      document.body.append(raiz);
    }
    const f = fonte();
    // A tela repinta a cada leitura da central (5 s): guarda a rolagem e os detalhes abertos do mesmo agente.
    const det0 = raiz.querySelector('.vga-detalhe'), lista0 = raiz.querySelector('.vga-lista');
    const mesmo = raiz.dataset.setor === st.setor, rolagem = mesmo && det0 ? det0.scrollTop : 0, rolagemLista = lista0 ? lista0.scrollTop : 0;
    const abertos = mesmo ? [...raiz.querySelectorAll('.vga-detalhe details[open]:not(.vga-mais) > summary')].map((s) => s.textContent) : [];
    raiz.dataset.setor = st.setor;
    raiz.innerHTML = `<div class="vga-topo"><span><small>Prédio da Vybe</small><h2>Agentes</h2><p>${f.dados ? `Central do VYBES · leitura às ${new Date(f.atualizadoEm || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : f.erro ? 'Sem sinal da central do VYBES agora' : 'Consultando a central do VYBES…'}</p></span>
      <button type="button" class="vga-fechar" data-vga-fechar aria-label="Fechar">×</button></div>
      <div class="vga-corpo"><nav class="vga-lista" aria-label="Agentes por andar">${listaHtml()}</nav><div class="vga-detalhe">${detalheHtml()}</div></div>`;
    raiz.hidden = false;
    if (abertos.length) raiz.querySelectorAll('.vga-detalhe details:not(.vga-mais) > summary').forEach((s) => { if (abertos.includes(s.textContent)) s.parentElement.open = true; });
    const det1 = raiz.querySelector('.vga-detalhe'), lista1 = raiz.querySelector('.vga-lista');
    if (det1) det1.scrollTop = rolagem; if (lista1) lista1.scrollTop = rolagemLista;
  }

  // Atribuir (etapa padrão), ligar/desligar rotina ('rotina') ou dar retorno a um achado ou lição ('achado'): tudo pela
  // mesma ponte (server/vybes.js → central). A central confere se é dono.
  // Resolver ou ignorar um grupo: um achado por vez, pela mesma rota; o que já estava fechado conta como feito.
  async function emLote(chaves, acao, setores, { vistos = false } = {}) {
    st.enviando = true; st.msg = ''; pintar();
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
      : vistos ? `Achado ${feito} para os ${setores.length} agentes que o viram.` : `${feitos} achado${feitos > 1 ? 's' : ''} ${feito}${feitos > 1 && acao !== 'errado' ? 's' : ''}.`;
    try { await Promise.all([mv().fonteAgentes?.()?.atualizar?.(true), ...setores.map((x) => lerPerfil(x, true))]); } catch { /* a fila relê na próxima */ }
    pintarContagem(); st.enviando = false; pintar();
  }
  // A mesma lição vista por vários agentes: uma decisão, gravada na lição de cada um pela mesma rota (etapa=achado).
  async function licoesEmLote(lista, acao) {
    st.enviando = true; st.msg = ''; pintar();
    let feitas = 0, falhou = '';
    for (const x of lista) {
      try {
        const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'achado', licao: x.id, acao }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok) feitas++; else { falhou = d.error || 'Não foi possível salvar agora.'; break; }
      } catch { falhou = 'Sem conexão com o servidor.'; break; }
    }
    st.msg = falhou ? `${feitas} de ${lista.length} lições atualizadas. Parou: ${falhou}` : `Lição atualizada para os ${lista.length} agentes que a viram.`;
    try { await Promise.all([...new Set(lista.map((x) => x.setor))].map((s) => lerPerfil(s, true))); } catch { /* a fila relê na próxima */ }
    pintarContagem(); st.enviando = false; pintar();
  }
  async function chamar(corpo, etapa = 'atribuir', ok = '', setor = st.setor) {
    st.enviando = true; st.msg = ''; pintar();
    try {
      const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa, ...corpo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível salvar agora.');
      st.msg = ok || (corpo.acao === 'criar' ? 'Atribuição registrada.' : 'Atribuição atualizada.');
      if (d.falhou) st.msg = `Aprovado, mas a ação falhou ao executar (${d.erro || 'erro'}). A decisão ficou registrada.`;
      await Promise.all([mv().fonteAgentes?.()?.atualizar?.(true), lerPerfil(setor, true), ['estado', 'aprovacao'].includes(etapa) ? lerEstados(true) : null]);
      pintarContagem();
    } catch (e) { st.msg = e.message; }
    finally { st.enviando = false; pintar(); }
  }
  function aoClicar(e) {
    raiz?.querySelectorAll('.vga-mais[open]').forEach((d) => { if (!d.contains(e.target) || e.target.closest('button')) d.open = false; });
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-vga-fechar')) { fechar(); return; }
    if (b.dataset.vgaSetor) { st.setor = b.dataset.vgaSetor; st.vista = 'agente'; st.msg = ''; pintar(); raiz?.querySelector('.vga-detalhe')?.scrollTo?.(0, 0); return; }
    if (b.hasAttribute('data-vga-fila')) { st.vista = 'fila'; st.msg = ''; pintar(); Promise.all([lerTodos(), lerEstados()]).then(() => { pintarContagem(); pintar(); }); return; }
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
    if (b.dataset.vgaAcao) { if (b.dataset.vgaAcao === 'remover' && !confirm('Remover esta atribuição?')) return; chamar({ acao: b.dataset.vgaAcao, id: b.dataset.vgaId }); }
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
    if (setor) { st.setor = setor; st.vista = 'agente'; } else st.vista = 'fila';
    st.aberto = true; st.msg = '';
    pintar();
    if (st.vista === 'fila') lerTodos().then(() => { pintarContagem(); pintar(); });
    lerEstados(true);
    Promise.resolve(mv().garantirModulo?.()).then((m) => { if (m?.avatarDoAgente) modRetrato = m; mv().fonteAgentes?.()?.atualizar?.(true)?.then?.(pintar); pintar(); });
  }
  function fechar() { st.aberto = false; pintar(); }
  // Mudou a peça e o achado foi resolvido na janela da peça: relê o perfil daquele agente. "Abrir a demanda completa":
  // a gaveta abre embaixo das janelas, a página Agentes sai da frente.
  G.addEventListener?.('vybe:achado-mudou', (e) => { const setor = e.detail?.setor; if (!setor) return; lerPerfil(setor, true).then(() => { pintarContagem(); if (st.aberto) pintar(); }); });
  G.addEventListener?.('vybe:peca-completa', () => { if (st.aberto) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.aberto && !e.target.closest?.('input,textarea,select')) fechar(); });
  // Seletor do estado do agente (só dono): uma frase curta em cada opção; a data de volta só vale para Pausado.
  function estadoFormHtml(s, modo) {
    const local = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const z = new Date(d.getTime() - d.getTimezoneOffset() * 60e3); return z.toISOString().slice(0, 16); };
    return `<form class="vga-bloco vga-modos" data-vga-estado-form><h4>Estado de ${esc(s.agente)}</h4>
      <div class="vga-modos-opcoes" role="radiogroup" aria-label="Estado de ${esc(s.agente)}">${Object.entries(MODO).map(([id, [nm, ex, c]]) => `<label style="--c:${c}"${modo.id === id ? ' class="sel"' : ''}><input type="radio" name="estado" value="${id}"${modo.id === id ? ' checked' : ''}><span><b>${esc(nm)}</b><small>${esc(ex)}</small></span></label>`).join('')}</div>
      <div class="vga-modos-fim"><label><span>Se pausar, volta sozinho em (opcional)</span><input type="datetime-local" name="ate" value="${modo.id === 'pausado' && modo.ate ? esc(local(modo.ate)) : ''}"></label>
      <button type="submit" class="vga-principal"${st.enviando ? ' disabled' : ''}>Salvar estado</button></div>
      <p class="vga-nota">Ativo faz sozinho e conta no grupo dos sócios. Sombra pede o OK de um dono no grupo dos sócios ou aqui em Depende de você. Pausado e desligado não rodam as rotinas.</p></form>`;
  }
  G.VybeAgentes = { abrir, fechar, filaDoDono, agrupar, itemFilaHtml, contar, aberto: () => st.aberto, repintar: () => { if (st.aberto && !raiz?.contains(document.activeElement)) pintar(); } };
})();
