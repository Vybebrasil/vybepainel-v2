// vybe-automacoes-ui.js — a tela das automações.
//
// No Monday as regras ficavam num painel de configuração que ninguém da equipe
// abria: quem via o card mudar de dono sozinho não tinha como descobrir por quê.
// Aqui a lista é legível por todo mundo, e só quem administra altera.
//
// O "ensaiar" é o que não existia lá: dá para ver o que uma regra faria antes de
// deixá-la solta em cima do trabalho de alguém.

const AUTOMACOES_API = '/api/painel?area=automacoes';

const GRUPOS_NOME = {
  'novo_grupo31348__1': 'Finalizados',
  'novo_grupo57911__1': 'Produção (Foto e Vídeo, à Captar)',
  'novo_grupo__1': 'Design & Edição',
  'group_title': 'Redação',
  'novo_grupo22352__1': 'Gestão de publicações',
};

let AUTOMACOES = [];
let EXECUCOES = [];
let automacaoEmEdicao = null;

function podeEditarAutomacoes() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
}

async function carregarAutomacoes() {
  const raiz = document.getElementById('automacoes-root');
  if (raiz) raiz.innerHTML = '<div class="auto-carregando">CARREGANDO REGRAS…</div>';
  try {
    const resposta = await fetch(AUTOMACOES_API, { credentials: 'same-origin' });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados?.error || 'Falha ao carregar automações.');
    AUTOMACOES = dados.automacoes || [];
    pintarAutomacoes();
    carregarHistorico();
  } catch (erro) {
    if (raiz) raiz.innerHTML = `<div class="auto-carregando">Não foi possível carregar<br><small>${safeText(erro.message)}</small></div>`;
  }
}

// ── tradução para quem não escreve JSON ───────────────────────────────────────
function frasearGatilho(g) {
  if (!g) return '—';
  if (g.tipo === 'data') {
    const n = Math.abs(Number(g.dias) || 0);
    const dias = `${n} ${n === 1 ? 'dia' : 'dias'}`;
    const campo = g.campo === 'prazo' ? 'o prazo' : 'a veiculação';
    const quando = Number(g.dias) < 0 ? `faltar ${dias} para ${campo}`
      : Number(g.dias) > 0 ? `${campo} tiver passado há ${dias}`
      : `for o dia d${campo === 'o prazo' ? 'o prazo' : 'a veiculação'}`;
    return `${quando}, às ${g.hora || '—'}`;
  }
  const campo = g.tipo === 'captacao' ? 'a captação' : 'o status';
  return g.de ? `${campo} passar de “${g.de}” para “${g.para}”`
              : `${campo} virar “${g.para}”`;
}

function frasearCondicao(c) {
  if (!c) return 'qualquer conteúdo';
  const partes = [];
  if (c.formato_em) partes.push(`formato ${c.formato_em.join(', ')}`);
  if (c.formato_apenas) partes.push(`formato apenas ${c.formato_apenas.join(', ')}`);
  if (c.grupo_em) partes.push(`peças em ${c.grupo_em.map((g) => GRUPOS_NOME[g] || g).join(', ')}`);
  if (partes.length) return partes.join(' e ');
  if (c.status_nao_em) return `status diferente de ${c.status_nao_em.join(', ')}`;
  if (c.status_em) return `status ${c.status_em.join(', ')}`;
  return 'qualquer conteúdo';
}

function nomeDePessoa(id) {
  const achado = Object.entries(typeof PESSOAS === 'object' ? PESSOAS : {})
    .find(([, valor]) => String(valor) === String(id));
  return achado ? achado[0].replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : id;
}

function frasearAcao(a) {
  if (a.tipo === 'grupo') return `move para ${GRUPOS_NOME[a.para] || a.para}`;
  if (a.tipo === 'status') return `muda o status para “${a.para}”`;
  if (a.tipo === 'captacao') return `muda a captação para “${a.para}”`;
  if (a.tipo === 'update') return `escreve um comentário`;
  if (a.tipo === 'notificar') return `avisa quem é responsável`;
  if (a.tipo === 'responsaveis') {
    const quem = (a.pessoas || []).map(nomeDePessoa).join(', ');
    return a.modo === 'replace' ? `passa a responsabilidade para ${quem}` : `chama também ${quem}`;
  }
  return a.tipo;
}

function pintarAutomacoes() {
  const raiz = document.getElementById('automacoes-root');
  if (!raiz) return;
  const admin = podeEditarAutomacoes();

  const linhas = AUTOMACOES.map((a) => `
    <div class="auto-regra ${a.ativa ? '' : 'desligada'}">
      <div class="auto-regra-topo">
        <span class="auto-ordem">${a.ordem}</span>
        <b class="auto-nome">${safeText(a.nome)}</b>
        ${admin ? `<div class="auto-botoes">
          <button onclick="ensaiarAutomacao(${a.id})">ensaiar</button>
          <button onclick="editarAutomacao(${a.id})">editar</button>
          <button onclick="alternarAutomacao(${a.id})">${a.ativa ? 'desligar' : 'ligar'}</button>
          <button class="perigo" onclick="excluirAutomacao(${a.id})">excluir</button>
        </div>` : `<span class="auto-estado">${a.ativa ? 'ativa' : 'desligada'}</span>`}
      </div>
      <div class="auto-frase"><i>Quando</i> ${safeText(frasearGatilho(a.gatilho))}${a.condicao ? ` · <i>só em</i> ${safeText(frasearCondicao(a.condicao))}` : ''}</div>
      <div class="auto-acoes">${(a.acoes || []).map((x) => `<span>${safeText(frasearAcao(x))}</span>`).join('')}</div>
    </div>`).join('');

  raiz.innerHTML = `
    <div class="auto-cabeca">
      <div>
        <div class="auto-kicker">Vybe OS · Operação</div>
        <h2 class="auto-titulo">Automações</h2>
        <p class="auto-sub">As regras que movem, atribuem e avisam sozinhas. ${admin
          ? 'Alterar aqui vale na hora, sem publicar nada.'
          : 'Só quem administra pode alterar — a lista fica visível para todos porque é ela que explica por que um card muda de dono sozinho.'}</p>
      </div>
      ${admin ? '<button class="auto-novo" onclick="editarAutomacao(null)">+ Nova regra</button>' : ''}
    </div>
    <div class="auto-lista">${linhas || '<div class="auto-carregando">Nenhuma regra cadastrada.</div>'}</div>
    <div id="auto-editor"></div>
    <div class="auto-cabeca" style="margin-top:28px">
      <div>
        <div class="auto-kicker">Vybe OS · Registro</div>
        <h2 class="auto-titulo">O que as regras fizeram</h2>
        <p class="auto-sub">Cada movimento automático fica registrado no Vybe OS — aqui está o que cada regra fez, quando executou e qual peça foi afetada.</p>
      </div>
    </div>
    <div id="auto-historico" class="auto-hist"><div class="auto-carregando">CARREGANDO…</div></div>`;
}

// ── histórico ─────────────────────────────────────────────────────────────────
// As regras são próprias e precisam deixar rastreável o que fizeram, quando
// executaram e qual peça foi afetada.
async function carregarHistorico() {
  try {
    const r = await fetch(`${AUTOMACOES_API}&historico=1&limite=40`, { credentials: 'same-origin' });
    const d = await r.json();
    if (!r.ok) return;
    EXECUCOES = d.execucoes || [];
    pintarHistorico();
  } catch { /* a lista de regras não depende do histórico */ }
}

function pintarHistorico() {
  const caixa = document.getElementById('auto-historico');
  if (!caixa) return;
  if (!EXECUCOES.length) {
    caixa.innerHTML = '<div class="auto-carregando">Nenhuma regra disparou ainda.</div>';
    return;
  }
  caixa.innerHTML = EXECUCOES.map((e) => {
    const ev = e.evento || {};
    const gatilho = ev.tipo === 'data' ? `${ev.campo}` : `${ev.de || '—'} → ${ev.para || ''}`;
    return `<div class="auto-hist-linha">
      <span class="auto-hist-quando">${new Date(e.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
      <span class="auto-hist-peca">${safeText(e.titulo || '(conteúdo removido)')}<small>${safeText(gatilho)}</small></span>
      <span class="auto-hist-regra">${safeText(e.automacao)}</span>
      <span class="auto-hist-feitas">${e.feitas.map((f) => safeText(f)).join(' · ') || '—'}</span>
    </div>`;
  }).join('');
}

// ── ensaio ────────────────────────────────────────────────────────────────────
async function ensaiarAutomacao(id) {
  const regra = AUTOMACOES.find((a) => Number(a.id) === Number(id));
  if (!regra) return;
  const g = regra.gatilho || {};
  if (g.tipo === 'data') {
    showToast('Regra por data: roda na varredura diária, não dá para ensaiar por evento.', 'info', 5000);
    return;
  }
  const formato = (regra.condicao?.formato_em || regra.condicao?.formato_apenas || ['Reels'])[0];
  const grupo = (regra.condicao?.grupo_em || [])[0] || 'ensaio';
  try {
    const resposta = await fetch(`${AUTOMACOES_API}&acao=ensaio`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formato, grupo, evento: { tipo: g.tipo, de: g.de || null, para: g.para } }),
    });
    const d = await resposta.json();
    if (!resposta.ok) throw new Error(d?.error || 'Ensaio falhou.');
    const r = d.resultado || {};
    showToast(`Ensaio (${formato}): status → ${r.status} · grupo → ${GRUPOS_NOME[r.grupo] || r.grupo} · ${r.responsaveis?.join(', ') || 'sem responsável'}`, 'info', 9000);
  } catch (erro) {
    showToast(`Ensaio falhou: ${erro.message}`, 'error', 6000);
  }
}

// ── edição ────────────────────────────────────────────────────────────────────
function editarAutomacao(id) {
  automacaoEmEdicao = id ? AUTOMACOES.find((a) => Number(a.id) === Number(id)) : null;
  const caixa = document.getElementById('auto-editor');
  if (!caixa) return;
  const a = automacaoEmEdicao || { nome: '', ordem: 50, ativa: true, gatilho: { tipo: 'status', para: '' }, condicao: null, acoes: [] };
  caixa.innerHTML = `
    <div class="auto-editor-caixa">
      <div class="auto-editor-titulo">${id ? 'Editar regra' : 'Nova regra'}</div>
      <label>Nome<input id="auto-f-nome" value="${safeText(a.nome)}" placeholder="Descreva a regra em uma frase"></label>
      <div class="auto-editor-linha">
        <label>Ordem<input id="auto-f-ordem" type="number" value="${a.ordem}"></label>
        <label>Ativa<select id="auto-f-ativa"><option value="1" ${a.ativa ? 'selected' : ''}>sim</option><option value="0" ${a.ativa ? '' : 'selected'}>não</option></select></label>
      </div>
      <label>Quando (gatilho)<textarea id="auto-f-gatilho" rows="3">${safeText(JSON.stringify(a.gatilho, null, 1))}</textarea></label>
      <label>Só em (condição, vazio = qualquer conteúdo)<textarea id="auto-f-condicao" rows="3">${a.condicao ? safeText(JSON.stringify(a.condicao, null, 1)) : ''}</textarea></label>
      <label>Faça (ações)<textarea id="auto-f-acoes" rows="6">${safeText(JSON.stringify(a.acoes || [], null, 1))}</textarea></label>
      <p class="auto-ajuda">Ordem menor roda primeiro. Numa mudança de status, a primeira regra que mover de grupo encerra as demais — é o que impede a regra genérica de desfazer o roteamento por formato.</p>
      <div class="auto-editor-botoes">
        <button class="auto-salvar" onclick="salvarAutomacao(${id || 'null'})">Salvar</button>
        <button onclick="document.getElementById('auto-editor').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
  caixa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function salvarAutomacao(id) {
  const ler = (campo) => document.getElementById(`auto-f-${campo}`)?.value ?? '';
  let gatilho, condicao, acoes;
  try {
    gatilho = JSON.parse(ler('gatilho') || '{}');
    condicao = ler('condicao').trim() ? JSON.parse(ler('condicao')) : null;
    acoes = JSON.parse(ler('acoes') || '[]');
  } catch (erro) {
    showToast(`Não entendi o formato: ${erro.message}`, 'error', 6000);
    return;
  }
  const corpo = { id: id || undefined, nome: ler('nome').trim(), ordem: Number(ler('ordem')) || 50,
                  ativa: ler('ativa') === '1', gatilho, condicao, acoes };
  if (!corpo.nome) { showToast('Dê um nome à regra — é ele que aparece quando ela dispara.', 'error', 5000); return; }
  try {
    const resposta = await fetch(AUTOMACOES_API, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    });
    const d = await resposta.json();
    if (!resposta.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    document.getElementById('auto-editor').innerHTML = '';
    showToast('Regra salva. Vale a partir da próxima mudança.', 'success', 4000);
    carregarAutomacoes();
  } catch (erro) {
    showToast(`Falha ao salvar: ${erro.message}`, 'error', 6000);
  }
}

async function alternarAutomacao(id) {
  const a = AUTOMACOES.find((x) => Number(x.id) === Number(id));
  if (!a) return;
  try {
    const resposta = await fetch(AUTOMACOES_API, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...a, ativa: !a.ativa }),
    });
    if (!resposta.ok) throw new Error((await resposta.json())?.error || 'Falhou.');
    showToast(a.ativa ? 'Regra desligada.' : 'Regra ligada.', 'success', 3500);
    carregarAutomacoes();
  } catch (erro) { showToast(`Falhou: ${erro.message}`, 'error', 5000); }
}

async function excluirAutomacao(id) {
  const a = AUTOMACOES.find((x) => Number(x.id) === Number(id));
  // Desligar guarda a regra; excluir apaga a redação dela. Vale perguntar.
  if (!confirm(`Excluir “${a?.nome || id}” de vez?\n\nSe a ideia é só parar de rodar, use “desligar” — assim a regra continua registrada.`)) return;
  try {
    const resposta = await fetch(`${AUTOMACOES_API}&id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!resposta.ok) throw new Error((await resposta.json())?.error || 'Falhou.');
    showToast('Regra excluída.', 'success', 3500);
    carregarAutomacoes();
  } catch (erro) { showToast(`Falhou: ${erro.message}`, 'error', 5000); }
}
