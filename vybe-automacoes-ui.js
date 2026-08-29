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
  } catch (erro) {
    if (raiz) raiz.innerHTML = `<div class="auto-carregando">NÃO FOI POSSÍVEL CARREGAR<br><small>${safeText(erro.message)}</small></div>`;
  }
}

// ── tradução para quem não escreve JSON ───────────────────────────────────────
function frasearGatilho(g) {
  if (!g) return '—';
  if (g.tipo === 'data') {
    const quando = Number(g.dias) < 0 ? `${Math.abs(g.dias)} dia(s) antes d`
      : Number(g.dias) > 0 ? `${g.dias} dia(s) depois d` : 'no dia d';
    return `${quando}${g.campo === 'prazo' ? 'o prazo' : 'a veiculação'}, às ${g.hora || '—'}`;
  }
  const campo = g.tipo === 'captacao' ? 'a captação' : 'o status';
  return g.de ? `quando ${campo} vai de “${g.de}” para “${g.para}”`
              : `quando ${campo} vira “${g.para}”`;
}

function frasearCondicao(c) {
  if (!c) return 'qualquer conteúdo';
  if (c.formato_em) return `só formato ${c.formato_em.join(', ')}`;
  if (c.status_nao_em) return `só se o status não for ${c.status_nao_em.join(', ')}`;
  if (c.status_em) return `só se o status for ${c.status_em.join(', ')}`;
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
      <div class="auto-frase"><i>Quando</i> ${safeText(frasearGatilho(a.gatilho))} · <i>em</i> ${safeText(frasearCondicao(a.condicao))}</div>
      <div class="auto-acoes">${(a.acoes || []).map((x) => `<span>${safeText(frasearAcao(x))}</span>`).join('')}</div>
    </div>`).join('');

  raiz.innerHTML = `
    <div class="auto-cabeca">
      <div>
        <div class="auto-kicker">VYBE OS · OPERAÇÃO</div>
        <h2 class="auto-titulo">Automações</h2>
        <p class="auto-sub">As regras que movem, atribuem e avisam sozinhas. ${admin
          ? 'Alterar aqui vale na hora, sem publicar nada.'
          : 'Só quem administra pode alterar — a lista fica visível para todos porque é ela que explica por que um card muda de dono sozinho.'}</p>
      </div>
      ${admin ? '<button class="auto-novo" onclick="editarAutomacao(null)">+ Nova regra</button>' : ''}
    </div>
    <div class="auto-lista">${linhas || '<div class="auto-carregando">Nenhuma regra cadastrada.</div>'}</div>
    <div id="auto-editor"></div>`;
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
  const formato = (regra.condicao?.formato_em || ['Reels'])[0];
  try {
    const resposta = await fetch(`${AUTOMACOES_API}&acao=ensaio`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formato, evento: { tipo: g.tipo, de: g.de || null, para: g.para } }),
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
