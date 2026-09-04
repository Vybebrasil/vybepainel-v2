// vybe-automacoes-ui.js — a tela das automações.
//
// No Monday as regras ficavam num painel de configuração que ninguém da equipe
// abria: quem via o card mudar de dono sozinho não tinha como descobrir por quê.
// Aqui a lista é legível por todo mundo, e só quem administra altera.
//
// Duas coisas que o Monday não dava:
//
// 1. SABER SE A REGRA TRABALHA. Lá, doze regras tinham a mesma aparência,
//    estivessem elas movendo peças todo dia ou paradas desde a importação. Aqui
//    cada regra carrega o próprio histórico: quantas vezes rodou, quando foi a
//    última, e — quando nunca rodou — o motivo provável.
//
// 2. ESCREVER A REGRA SEM SABER A SINTAXE. Lá era um monte de menu encaixado;
//    aqui era pior, três caixas de JSON cru. Agora a regra se monta escolhendo,
//    e a frase final aparece pronta antes de salvar.

const AUTOMACOES_API = '/api/painel?area=automacoes';

// Os grupos do quadro têm id técnico e nome de gente. O servidor manda os dois,
// mas este mapa fica como rede: grupo que sumiu do quadro ainda aparece nomeado
// nas regras antigas em vez de virar "novo_grupo22352__1" na cara da pessoa.
const GRUPOS_NOME = {
  'novo_grupo31348__1': 'Finalizados',
  'novo_grupo57911__1': 'Produção (Foto e Vídeo, à Captar)',
  'novo_grupo__1': 'Design & Edição',
  'group_title': 'Redação',
  'novo_grupo22352__1': 'Gestão de publicações',
};

let AUTOMACOES = [];
let EXECUCOES = [];
let CATALOGOS = { status: [], captacao: [], grupos: [], pessoas: [], formatos: [] };
let automacaoEmEdicao = null;
let RASCUNHO = null;          // a regra sendo montada no construtor
let FILTRO_DE_REGRAS = 'todas';

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
    if (dados.catalogos) CATALOGOS = { ...CATALOGOS, ...dados.catalogos };
    pintarAutomacoes();
    carregarHistorico();
  } catch (erro) {
    if (raiz) raiz.innerHTML = `<div class="auto-carregando">Não foi possível carregar<br><small>${safeText(erro.message)}</small></div>`;
  }
}

// ── nomes: chave técnica → o que a pessoa reconhece ───────────────────────────
function rotuloDoCatalogo(lista, chave, reserva) {
  const achado = (CATALOGOS[lista] || []).find((x) => String(x.chave) === String(chave));
  return achado ? achado.rotulo : (reserva || chave);
}
function nomeDeGrupo(id) { return GRUPOS_NOME[id] || rotuloDoCatalogo('grupos', id, id); }
function nomeDeStatus(chave) {
  return rotuloDoCatalogo('status', chave, String(chave || '').replace(/_/g, ' '));
}
function nomeDeCaptacao(chave) {
  return rotuloDoCatalogo('captacao', chave, String(chave || '').replace(/_/g, ' '));
}
function nomeDePessoa(id) {
  const doBanco = (CATALOGOS.pessoas || []).find((p) => String(p.chave) === String(id));
  if (doBanco) return doBanco.rotulo;
  const achado = Object.entries(typeof PESSOAS === 'object' ? PESSOAS : {})
    .find(([, valor]) => String(valor) === String(id));
  return achado ? achado[0].replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()) : id;
}
function primeiroNome(texto) { return String(texto || '').trim().split(/\s+/)[0] || texto; }

// ── a regra dita em português ─────────────────────────────────────────────────
function frasearGatilho(g) {
  if (!g) return '—';
  if (g.tipo === 'data') {
    const n = Math.abs(Number(g.dias) || 0);
    const dias = `${n} ${n === 1 ? 'dia' : 'dias'}`;
    const campo = g.campo === 'prazo' ? 'o prazo' : 'a veiculação';
    if (Number(g.dias) < 0) return `faltar ${dias} para ${campo}`;
    if (Number(g.dias) > 0) return `${campo} tiver passado há ${dias}`;
    return `chegar o dia d${campo === 'o prazo' ? 'o prazo' : 'a veiculação'}`;
  }
  const campo = g.tipo === 'captacao' ? 'a captação' : 'o status';
  const nome = g.tipo === 'captacao' ? nomeDeCaptacao : nomeDeStatus;
  return g.de ? `${campo} passar de “${nome(g.de)}” para “${nome(g.para)}”`
              : `${campo} virar “${nome(g.para)}”`;
}

function frasearCondicao(c) {
  if (!c) return '';
  // Estas listas significam "qualquer um destes", entao a juncao e OU. Com "e" a
  // frase dizia o contrario do que a regra faz — o erro mais caro possivel numa
  // tela cujo trabalho e explicar a regra.
  const ou = (lista, nome) => lista.map(nome).join(' ou ');
  const partes = [];
  if (c.formato_em) partes.push(`o formato for ${ou(c.formato_em, nomeDeFormato)}`);
  if (c.formato_apenas) partes.push(`o formato for só ${ou(c.formato_apenas, nomeDeFormato)}`);
  if (c.grupo_em) partes.push(`a peça estiver em ${ou(c.grupo_em, nomeDeGrupo)}`);
  if (c.status_nao_em) partes.push(`o status não for ${ou(c.status_nao_em, nomeDeStatus)}`);
  if (c.status_em) partes.push(`o status for ${ou(c.status_em, nomeDeStatus)}`);
  return partes.join(', e ');
}
function nomeDeFormato(chave) {
  return rotuloDoCatalogo('formatos', chave, String(chave || '').replace(/_/g, ' '));
}

function frasearAcao(a) {
  if (a.tipo === 'grupo') return `move para ${nomeDeGrupo(a.para)}`;
  if (a.tipo === 'status') return `muda o status para “${nomeDeStatus(a.para)}”`;
  if (a.tipo === 'captacao') return `muda a captação para “${nomeDeCaptacao(a.para)}”`;
  if (a.tipo === 'update') return 'escreve um comentário na peça';
  if (a.tipo === 'notificar') return 'avisa quem é responsável';
  if (a.tipo === 'responsaveis') {
    const quem = (a.pessoas || []).map((id) => primeiroNome(nomeDePessoa(id))).join(' e ');
    // Lista vazia com 'replace' e uma acao de verdade: limpa os responsaveis.
    // Sem este caso a frase saia pela metade — "passa a responsabilidade para "
    // — e a regra parecia quebrada em vez de proposital.
    if (!quem) return a.modo === 'replace' ? 'tira o responsável da peça' : 'não chama ninguém';
    return a.modo === 'replace' ? `passa a responsabilidade para ${quem}` : `chama também ${quem}`;
  }
  return a.tipo;
}

// ── saúde: esta regra trabalha? ───────────────────────────────────────────────
//
// Foi a pergunta que ninguém sabia responder olhando a tela antiga. As respostas
// possíveis são poucas e cada uma leva a uma decisão diferente: desligada é
// escolha de alguém; nunca rodou pode ser regra nova ou regra morta; parada há
// muito tempo costuma ser um estado que a operação deixou de usar.
const DIAS_PARA_CONSIDERAR_PARADA = 30;

function saudeDaRegra(a) {
  const total = Number(a.execucoes_total || 0);
  const recentes = Number(a.execucoes_30_dias || 0);
  const ultima = a.ultima_em ? new Date(a.ultima_em) : null;
  if (!a.ativa) {
    return { chave: 'desligada', rotulo: 'desligada', detalhe: total
      ? `chegou a rodar ${total}×` : 'nunca chegou a rodar' };
  }
  if (!total) {
    return { chave: 'nunca', rotulo: 'nunca rodou', detalhe: motivoDeNuncaTerRodado(a) };
  }
  if (recentes) {
    return { chave: 'trabalhando', rotulo: 'trabalhando',
      detalhe: `${recentes}× em ${DIAS_PARA_CONSIDERAR_PARADA} dias · última ${quandoFoi(ultima)}` };
  }
  return { chave: 'parada', rotulo: 'parada',
    detalhe: `${total}× no total · última ${quandoFoi(ultima)}` };
}

// Um palpite honesto, dito como palpite. Vale mais que "nunca rodou" sozinho,
// que deixa a pessoa sem próximo passo.
function motivoDeNuncaTerRodado(a) {
  const g = a.gatilho || {};
  if (g.tipo === 'data') return 'depende da varredura diária';
  if (g.tipo === 'captacao') return 'depende de alguém mexer na captação';
  if (g.de) return 'a passagem exata ainda não aconteceu';
  const usado = (AUTOMACOES || []).length;
  return usado ? 'esse status ainda não foi usado' : '';
}

function quandoFoi(data) {
  if (!data || Number.isNaN(data.getTime())) return 'sem data';
  const hoje = new Date();
  const dias = Math.floor((hoje - data) / 86400000);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dias <= 0) return `hoje ${hora}`;
  if (dias === 1) return `ontem ${hora}`;
  if (dias < 30) return `há ${dias} dias`;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── a lista ───────────────────────────────────────────────────────────────────
function pintarAutomacoes() {
  const raiz = document.getElementById('automacoes-root');
  if (!raiz) return;
  const admin = podeEditarAutomacoes();
  const comSaude = AUTOMACOES.map((a) => ({ ...a, saude: saudeDaRegra(a) }));
  const conta = (chave) => comSaude.filter((a) => a.saude.chave === chave).length;

  const visiveis = FILTRO_DE_REGRAS === 'todas'
    ? comSaude : comSaude.filter((a) => a.saude.chave === FILTRO_DE_REGRAS);

  const pastilhas = [
    ['todas', 'Todas', comSaude.length],
    ['trabalhando', 'Trabalhando', conta('trabalhando')],
    ['parada', 'Paradas', conta('parada')],
    ['nunca', 'Nunca rodaram', conta('nunca')],
    ['desligada', 'Desligadas', conta('desligada')],
  ].filter(([chave, , n]) => chave === 'todas' || n)
   .map(([chave, rotulo, n]) => `<button type="button" class="auto-pastilha ${chave} ${
      FILTRO_DE_REGRAS === chave ? 'ativa' : ''}" onclick="filtrarRegras('${chave}')"
      aria-pressed="${FILTRO_DE_REGRAS === chave}">${rotulo}<span>${n}</span></button>`).join('');

  const linhas = visiveis.map((a) => {
    const s = a.saude;
    const condicao = frasearCondicao(a.condicao);
    return `
    <article class="auto-regra ${a.ativa ? '' : 'desligada'} saude-${s.chave}">
      <header class="auto-regra-topo">
        <div class="auto-regra-ident">
          <span class="auto-selo ${s.chave}" title="${safeText(s.detalhe)}"><i></i>${safeText(s.rotulo)}</span>
          <h3 class="auto-nome">${safeText(a.nome)}</h3>
          <small class="auto-regra-detalhe">${safeText(s.detalhe)}</small>
        </div>
        ${admin ? `<div class="auto-botoes">
          <button onclick="ensaiarAutomacao(${a.id})" title="Ver o que ela faria, sem mexer em nada">ensaiar</button>
          <button onclick="editarAutomacao(${a.id})">editar</button>
          <button onclick="alternarAutomacao(${a.id})">${a.ativa ? 'desligar' : 'ligar'}</button>
          <button class="perigo" onclick="excluirAutomacao(${a.id})">excluir</button>
        </div>` : ''}
      </header>
      <div class="auto-receita">
        <div class="auto-passo quando">
          <span class="auto-passo-rotulo">Quando</span>
          <span class="auto-passo-texto">${safeText(frasearGatilho(a.gatilho))}</span>
        </div>
        ${condicao ? `<div class="auto-passo so-se">
          <span class="auto-passo-rotulo">Só se</span>
          <span class="auto-passo-texto">${safeText(condicao)}</span>
        </div>` : ''}
        <div class="auto-passo entao">
          <span class="auto-passo-rotulo">Então</span>
          <ul class="auto-passo-lista">${(a.acoes || [])
            .map((x) => `<li>${safeText(frasearAcao(x))}</li>`).join('') || '<li>—</li>'}</ul>
        </div>
      </div>
    </article>`;
  }).join('');

  // A varredura diária tem uma hora só, e as regras por data guardam uma hora
  // própria que ninguém lê. Dizer isso aqui evita a conclusão errada de que a
  // regra está quebrada quando o aviso chega em outro horário.
  const temRegraDeData = AUTOMACOES.some((a) => a.gatilho?.tipo === 'data' && a.ativa);

  raiz.innerHTML = `
    <div class="auto-cabeca">
      <div>
        <div class="auto-kicker">Vybe OS · Operação</div>
        <h2 class="auto-titulo">Automações</h2>
        <p class="auto-sub">As regras que movem, atribuem e avisam sozinhas. ${admin
          ? 'Alterar aqui vale na hora, sem publicar nada.'
          : 'Só quem administra pode alterar — a lista fica visível para todos porque é ela que explica por que um card muda de dono sozinho.'}</p>
      </div>
      ${admin ? `<div class="auto-cabeca-acoes">
        <button class="auto-sincronizar" onclick="recalcularPrioridadesAgora(this)"
          title="Refaz a coluna Prioridade de todas as peças a partir da veiculação. Roda sozinho toda madrugada; isto aqui é para não esperar.">Recalcular prioridades</button>
        <button class="auto-sincronizar" onclick="sincronizarRegrasDoSistema(this)"
          title="Traz para o painel as regras que vieram do Monday, corrigindo as que mudaram. Regra criada aqui não é tocada.">Sincronizar regras do sistema</button>
        <button class="auto-novo" onclick="editarAutomacao(null)">+ Nova regra</button>
      </div>` : ''}
    </div>
    <div class="auto-pastilhas">${pastilhas}</div>
    ${temRegraDeData ? `<p class="auto-aviso-varredura">As regras por data rodam numa
      varredura por dia, de madrugada — não na hora que estiver escrita nelas.</p>` : ''}
    <p class="auto-aviso-varredura">A coluna <b>Prioridade</b> não é escrita à mão: ela é o
      espelho da veiculação. Atrasado, hoje ou amanhã é <b>Crítica</b>; 2 a 3 dias, <b>Alta</b>;
      4 a 7 dias, <b>Média</b>; 8 dias ou mais, <b>Baixa</b>. Sobe e desce sozinha na mesma
      varredura da madrugada, e peça finalizada ou sem data de veiculação não é tocada.</p>
    <div id="auto-editor"></div>
    <div class="auto-lista">${linhas || '<div class="auto-carregando">Nenhuma regra neste recorte.</div>'}</div>
    <div class="auto-cabeca" style="margin-top:28px">
      <div>
        <div class="auto-kicker">Vybe OS · Registro</div>
        <h2 class="auto-titulo">O que as regras fizeram</h2>
        <p class="auto-sub">Cada movimento automático fica registrado — o que cada regra fez, quando executou e qual peça foi afetada.</p>
      </div>
    </div>
    <div id="auto-historico" class="auto-hist"><div class="auto-carregando">CARREGANDO…</div></div>`;
}

function filtrarRegras(chave) {
  FILTRO_DE_REGRAS = FILTRO_DE_REGRAS === chave && chave !== 'todas' ? 'todas' : chave;
  pintarAutomacoes();
  carregarHistorico();
}

// ── histórico ─────────────────────────────────────────────────────────────────
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
    const gatilho = ev.tipo === 'data' ? `por ${ev.campo || 'data'}`
      : `${nomeDeStatus(ev.de) || '—'} → ${nomeDeStatus(ev.para) || ''}`;
    return `<div class="auto-hist-linha">
      <span class="auto-hist-quando">${new Date(e.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
      <span class="auto-hist-peca">${safeText(e.titulo || '(conteúdo removido)')}<small>${safeText(gatilho)}</small></span>
      <span class="auto-hist-regra">${safeText(e.automacao)}</span>
      <span class="auto-hist-feitas">${(e.feitas || []).map((f) => safeText(traduzirFeita(f))).join(' · ') || '—'}</span>
    </div>`;
  }).join('');
}

// O registro guardava "grupo → novo_grupo22352__1". O id é o que ficou gravado
// e não se reescreve o passado; traduzir na leitura resolve sem tocar no dado.
function traduzirFeita(texto) {
  const t = String(texto || '');
  const grupo = t.match(/^grupo → (.+)$/);
  if (grupo) return `move para ${nomeDeGrupo(grupo[1].trim())}`;
  const status = t.match(/^status → (.+)$/);
  if (status) return `status vira ${nomeDeStatus(status[1].trim())}`;
  if (t === 'responsáveis replace') return 'troca quem é responsável';
  if (t === 'responsáveis add') return 'chama mais gente';
  if (t === 'update') return 'comentário na peça';
  if (t === 'notificação') return 'aviso enviado';
  const cap = t.match(/^captação → (.+)$/);
  if (cap) return `captação vira ${cap[1].trim()}`;
  return t;
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
  // A peca do ensaio nasce no estado que a PROPRIA regra exige. Sem isto, uma
  // regra que so vale "com a captacao feita" era ensaiada numa peca sem
  // captacao nenhuma, e o ensaio respondia "nao dispara" — parecendo
  // diagnostico, sendo defeito do ensaio.
  const captacao = (regra.condicao?.captacao_em || [])[0] || null;
  const status = g.tipo !== 'status' ? (regra.condicao?.status_em || [])[0] || null : null;
  try {
    const resposta = await fetch(`${AUTOMACOES_API}&acao=ensaio`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formato, grupo, captacao, status,
        evento: { tipo: g.tipo, de: g.de || null, para: g.para } }),
    });
    const d = await resposta.json();
    if (!resposta.ok) throw new Error(d?.error || 'Ensaio falhou.');
    const r = d.resultado || {};
    showToast(`Ensaio (${formato}): status → ${nomeDeStatus(r.status)} · grupo → ${nomeDeGrupo(r.grupo)} · ${
      (r.responsaveis || []).map((p) => primeiroNome(nomeDePessoa(p))).join(', ') || 'sem responsável'}`, 'info', 9000);
  } catch (erro) {
    showToast(`Ensaio falhou: ${erro.message}`, 'error', 6000);
  }
}

// ── o construtor ──────────────────────────────────────────────────────────────
//
// Três caixas de JSON viraram escolhas. O rascunho vive em RASCUNHO e a tela é
// redesenhada a cada mudança — é o que permite mostrar a frase final se
// reescrevendo enquanto a pessoa monta, que é a parte que ensina.

const ACOES_DISPONIVEIS = [
  { tipo: 'grupo',        rotulo: 'Mover para um grupo' },
  { tipo: 'responsaveis', rotulo: 'Passar a responsabilidade', modo: 'replace' },
  { tipo: 'responsaveis', rotulo: 'Chamar mais gente junto',   modo: 'add' },
  { tipo: 'status',       rotulo: 'Mudar o status' },
  { tipo: 'captacao',     rotulo: 'Mudar a captação' },
  { tipo: 'update',       rotulo: 'Escrever um comentário na peça' },
  { tipo: 'notificar',    rotulo: 'Avisar quem é responsável' },
];

function editarAutomacao(id) {
  automacaoEmEdicao = id ? AUTOMACOES.find((a) => Number(a.id) === Number(id)) : null;
  const a = automacaoEmEdicao
    || { nome: '', ordem: 50, ativa: true, gatilho: { tipo: 'status', para: '' }, condicao: null, acoes: [] };
  RASCUNHO = {
    id: id || null,
    nome: a.nome || '',
    ordem: Number(a.ordem) || 50,
    ativa: a.ativa !== false,
    gatilho: { ...(a.gatilho || { tipo: 'status' }) },
    condicao: a.condicao ? { ...a.condicao } : null,
    acoes: JSON.parse(JSON.stringify(a.acoes || [])),
  };
  pintarConstrutor();
}

function fecharConstrutor() {
  RASCUNHO = null;
  const caixa = document.getElementById('auto-editor');
  if (caixa) caixa.innerHTML = '';
}

// Toda mudança no rascunho passa por aqui: guarda e redesenha, para a frase
// final e as escolhas dependentes acompanharem sem ninguém precisar salvar.
function mexerNoRascunho(caminho, valor) {
  if (!RASCUNHO) return;
  const partes = caminho.split('.');
  let alvo = RASCUNHO;
  for (let i = 0; i < partes.length - 1; i += 1) {
    if (!alvo[partes[i]] || typeof alvo[partes[i]] !== 'object') alvo[partes[i]] = {};
    alvo = alvo[partes[i]];
  }
  alvo[partes[partes.length - 1]] = valor;
  pintarConstrutor();
}

function trocarTipoDeGatilho(tipo) {
  if (!RASCUNHO) return;
  // Sem 'hora': o campo existia nas regras importadas e NADA no servidor o le —
  // a varredura roda uma vez por dia e avisa todo mundo junto. Gravar uma hora
  // nova seria escrever uma promessa que o sistema nao cumpre.
  RASCUNHO.gatilho = tipo === 'data'
    ? { tipo: 'data', campo: 'prazo', dias: -1 }
    : { tipo, para: '' };
  pintarConstrutor();
}

function adicionarAcao(indice) {
  const modelo = ACOES_DISPONIVEIS[Number(indice)];
  if (!modelo || !RASCUNHO) return;
  const nova = { tipo: modelo.tipo };
  if (modelo.modo) nova.modo = modelo.modo;
  if (modelo.tipo === 'responsaveis') nova.pessoas = [];
  if (modelo.tipo === 'update' || modelo.tipo === 'notificar') nova.texto = '';
  else if (modelo.tipo !== 'responsaveis') nova.para = '';
  RASCUNHO.acoes.push(nova);
  pintarConstrutor();
}

function removerAcao(i) {
  if (!RASCUNHO) return;
  RASCUNHO.acoes.splice(Number(i), 1);
  pintarConstrutor();
}

function alternarPessoaDaAcao(i, id) {
  if (!RASCUNHO) return;
  const acao = RASCUNHO.acoes[Number(i)];
  if (!acao) return;
  acao.pessoas = acao.pessoas || [];
  const chave = String(id);
  const em = acao.pessoas.findIndex((p) => String(p) === chave);
  if (em >= 0) acao.pessoas.splice(em, 1); else acao.pessoas.push(chave);
  pintarConstrutor();
}

function alternarCondicao(campo, chave) {
  if (!RASCUNHO) return;
  const c = RASCUNHO.condicao ? { ...RASCUNHO.condicao } : {};
  const lista = Array.isArray(c[campo]) ? [...c[campo]] : [];
  const em = lista.findIndex((x) => String(x) === String(chave));
  if (em >= 0) lista.splice(em, 1); else lista.push(String(chave));
  if (lista.length) c[campo] = lista; else delete c[campo];
  RASCUNHO.condicao = Object.keys(c).length ? c : null;
  pintarConstrutor();
}

// O que impede a regra de existir. Devolve a frase do problema, ou vazio quando
// esta tudo certo — e e isso que trava o botao de salvar. Uma regra impossivel
// salva sem reclamar seria a pior forma de descobrir o erro: ela entra na lista
// como "nunca rodou" e ninguem sabe que nasceu morta.
function problemaDoRascunho() {
  if (!RASCUNHO) return '';
  const g = RASCUNHO.gatilho || {};
  if (g.tipo !== 'data' && !g.para) return 'Falta escolher o que precisa acontecer para a regra disparar.';
  if (g.tipo !== 'data' && g.de && String(g.de) === String(g.para)) {
    return 'O “vindo de” e o “virar” estão no mesmo valor — assim nada muda e a regra nunca dispara.';
  }
  if (!(RASCUNHO.acoes || []).length) return 'Uma regra sem ação não faz nada. Escolha pelo menos uma.';
  const vazia = (RASCUNHO.acoes || []).find((a) => (
    (a.tipo === 'responsaveis' && !(a.pessoas || []).length)
    || (['grupo', 'status', 'captacao'].includes(a.tipo) && !a.para)));
  if (vazia) return 'Uma das ações está sem escolha — complete ou tire ela.';
  if (!String(RASCUNHO.nome || '').trim()) return 'Falta dar um nome à regra — é ele que aparece quando ela dispara.';
  return '';
}

// A frase que a regra vira quando salvar. É ela que faz o construtor ensinar em
// vez de só coletar: quem monta lê o resultado antes de existir.
function fraseDoRascunho() {
  if (!RASCUNHO) return '';
  const quando = frasearGatilho(RASCUNHO.gatilho);
  const so = frasearCondicao(RASCUNHO.condicao);
  const acoes = (RASCUNHO.acoes || []).map(frasearAcao).filter(Boolean);
  if (!RASCUNHO.gatilho?.para && RASCUNHO.gatilho?.tipo !== 'data') return '';
  if (!acoes.length) return '';
  const lista = acoes.length === 1 ? acoes[0]
    : `${acoes.slice(0, -1).join(', ')} e ${acoes[acoes.length - 1]}`;
  return `Quando ${quando}${so ? `, e ${so}` : ''}, ${lista}.`;
}

function fichasDeEscolha(lista, atual, aoClicar, vazio = 'nada cadastrado') {
  const itens = CATALOGOS[lista] || [];
  if (!itens.length) return `<span class="auto-vazio">${vazio}</span>`;
  return itens.map((x) => {
    const marcada = Array.isArray(atual)
      ? atual.some((v) => String(v) === String(x.chave))
      : String(atual || '') === String(x.chave);
    const nome = lista === 'grupos' ? nomeDeGrupo(x.chave) : x.rotulo;
    return `<button type="button" class="auto-ficha ${marcada ? 'marcada' : ''}"
      onclick="${aoClicar.replace('{chave}', String(x.chave).replace(/'/g, "\\'"))}"
      aria-pressed="${marcada}">${x.cor ? `<i style="background:${safeText(x.cor)}"></i>` : ''}${safeText(nome)}</button>`;
  }).join('');
}

function pintarConstrutor() {
  const caixa = document.getElementById('auto-editor');
  if (!caixa) return;
  if (!RASCUNHO) { caixa.innerHTML = ''; return; }
  const r = RASCUNHO;
  const g = r.gatilho || {};

  const abas = [['status', 'um status mudar'], ['captacao', 'a captação mudar'], ['data', 'chegar uma data']]
    .map(([tipo, rotulo]) => `<button type="button" class="auto-aba ${g.tipo === tipo ? 'ativa' : ''}"
      onclick="trocarTipoDeGatilho('${tipo}')" aria-pressed="${g.tipo === tipo}">${rotulo}</button>`).join('');

  let quandoCorpo = '';
  if (g.tipo === 'data') {
    quandoCorpo = `
      <div class="auto-campo-linha">
        <label>Qual data<select onchange="mexerNoRascunho('gatilho.campo',this.value)">
          <option value="prazo" ${g.campo === 'prazo' ? 'selected' : ''}>o prazo de produção</option>
          <option value="veiculacao" ${g.campo === 'veiculacao' ? 'selected' : ''}>a veiculação</option>
        </select></label>
        <label>Momento<select onchange="mexerNoRascunho('gatilho.dias',Number(this.value))">
          <option value="-1" ${Number(g.dias) === -1 ? 'selected' : ''}>1 dia antes</option>
          <option value="-2" ${Number(g.dias) === -2 ? 'selected' : ''}>2 dias antes</option>
          <option value="-3" ${Number(g.dias) === -3 ? 'selected' : ''}>3 dias antes</option>
          <option value="0" ${Number(g.dias) === 0 ? 'selected' : ''}>no próprio dia</option>
          <option value="1" ${Number(g.dias) === 1 ? 'selected' : ''}>1 dia depois</option>
        </select></label>
      </div>
      <p class="auto-dica">Regras por data rodam numa varredura por dia, de madrugada.</p>`;
  } else {
    const lista = g.tipo === 'captacao' ? 'captacao' : 'status';
    quandoCorpo = `
      <div class="auto-campo">
        <span class="auto-campo-rotulo">Virar qual ${g.tipo === 'captacao' ? 'captação' : 'status'}?</span>
        <div class="auto-fichas">${fichasDeEscolha(lista, g.para, `mexerNoRascunho('gatilho.para','{chave}')`)}</div>
      </div>
      <div class="auto-campo">
        <span class="auto-campo-rotulo">Vindo de qual? <small>opcional — deixe em branco para valer de qualquer um</small></span>
        <div class="auto-fichas">
          <button type="button" class="auto-ficha ${!g.de ? 'marcada' : ''}"
            onclick="mexerNoRascunho('gatilho.de','')" aria-pressed="${!g.de}">qualquer um</button>
          ${fichasDeEscolha(lista, g.de, `mexerNoRascunho('gatilho.de','{chave}')`)}
        </div>
      </div>`;
  }

  const acoes = (r.acoes || []).map((a, i) => {
    let corpo = '';
    if (a.tipo === 'grupo') {
      corpo = `<div class="auto-fichas">${fichasDeEscolha('grupos', a.para, `mexerNoRascunho('acoes.${i}.para','{chave}')`)}</div>`;
    } else if (a.tipo === 'status') {
      corpo = `<div class="auto-fichas">${fichasDeEscolha('status', a.para, `mexerNoRascunho('acoes.${i}.para','{chave}')`)}</div>`;
    } else if (a.tipo === 'captacao') {
      corpo = `<div class="auto-fichas">${fichasDeEscolha('captacao', a.para, `mexerNoRascunho('acoes.${i}.para','{chave}')`)}</div>`;
    } else if (a.tipo === 'responsaveis') {
      corpo = `<div class="auto-fichas">${fichasDeEscolha('pessoas', a.pessoas || [], `alternarPessoaDaAcao(${i},'{chave}')`, 'ninguém cadastrado')}</div>`;
    } else {
      corpo = `<input type="text" class="auto-texto" value="${safeText(a.texto || '')}"
        placeholder="${a.tipo === 'notificar' ? 'Sua entrega vence amanhã: {titulo} ({cliente}).' : 'Encaminhado para agendamento.'}"
        oninput="RASCUNHO.acoes[${i}].texto=this.value">`;
    }
    const titulo = ACOES_DISPONIVEIS.find((m) => m.tipo === a.tipo && (!m.modo || m.modo === a.modo))?.rotulo || a.tipo;
    return `<div class="auto-acao-caixa">
      <div class="auto-acao-topo"><b>${safeText(titulo)}</b>
        <button type="button" class="auto-acao-tirar" onclick="removerAcao(${i})" aria-label="Tirar esta ação">×</button></div>
      ${corpo}</div>`;
  }).join('');

  const frase = fraseDoRascunho();
  const problema = problemaDoRascunho();

  caixa.innerHTML = `
    <section class="auto-construtor" role="dialog" aria-label="${r.id ? 'Editar regra' : 'Nova regra'}">
      <header class="auto-construtor-topo">
        <div>
          <span class="auto-kicker">${r.id ? 'Editando' : 'Montando'}</span>
          <h3>${r.id ? 'Editar regra' : 'Nova regra'}</h3>
        </div>
        <button type="button" class="auto-construtor-fechar" onclick="fecharConstrutor()" aria-label="Fechar">×</button>
      </header>

      <div class="auto-bloco">
        <span class="auto-bloco-numero">1</span>
        <div class="auto-bloco-corpo">
          <h4>Quando isto acontecer</h4>
          <div class="auto-abas">${abas}</div>
          ${quandoCorpo}
        </div>
      </div>

      <div class="auto-bloco">
        <span class="auto-bloco-numero">2</span>
        <div class="auto-bloco-corpo">
          <h4>Só se… <small>opcional</small></h4>
          <div class="auto-campo">
            <span class="auto-campo-rotulo">O formato for</span>
            <div class="auto-fichas">${fichasDeEscolha('formatos', r.condicao?.formato_em || [], `alternarCondicao('formato_em','{chave}')`, 'nenhum formato cadastrado')}</div>
          </div>
          <div class="auto-campo">
            <span class="auto-campo-rotulo">A peça estiver em</span>
            <div class="auto-fichas">${fichasDeEscolha('grupos', r.condicao?.grupo_em || [], `alternarCondicao('grupo_em','{chave}')`, 'nenhum grupo cadastrado')}</div>
          </div>
        </div>
      </div>

      <div class="auto-bloco">
        <span class="auto-bloco-numero">3</span>
        <div class="auto-bloco-corpo">
          <h4>Faça isto</h4>
          ${acoes || '<p class="auto-dica">Nenhuma ação ainda — escolha a primeira abaixo.</p>'}
          <div class="auto-fichas auto-add">${ACOES_DISPONIVEIS.map((m, i) =>
            `<button type="button" class="auto-ficha somar" onclick="adicionarAcao(${i})">+ ${safeText(m.rotulo)}</button>`).join('')}</div>
        </div>
      </div>

      <div class="auto-bloco">
        <span class="auto-bloco-numero">4</span>
        <div class="auto-bloco-corpo">
          <h4>Como ela vai se chamar</h4>
          <input type="text" class="auto-texto" id="auto-f-nome" value="${safeText(r.nome)}"
            placeholder="Descreva a regra em uma frase" oninput="RASCUNHO.nome=this.value">
          <div class="auto-campo-linha">
            <label>Ordem <small>menor roda primeiro</small>
              <input type="number" value="${r.ordem}" oninput="RASCUNHO.ordem=Number(this.value)||50"></label>
            <label>Ligada
              <select onchange="mexerNoRascunho('ativa',this.value==='1')">
                <option value="1" ${r.ativa ? 'selected' : ''}>sim</option>
                <option value="0" ${r.ativa ? '' : 'selected'}>não</option>
              </select></label>
          </div>
        </div>
      </div>

      <div class="auto-frase-final ${frase ? '' : 'incompleta'}">
        <span>A regra vai ficar assim</span>
        <b>${frase ? safeText(frase) : 'Escolha o gatilho e pelo menos uma ação para ver a frase.'}</b>
        ${problema ? `<em class="auto-problema">${safeText(problema)}</em>` : ''}
      </div>

      <div class="auto-construtor-botoes">
        <button type="button" class="auto-cancelar" onclick="fecharConstrutor()">Cancelar</button>
        <button type="button" class="auto-salvar" onclick="salvarAutomacao()" ${problema ? 'disabled' : ''}>
          ${r.id ? 'Salvar alterações' : 'Criar regra'}</button>
      </div>
    </section>`;
  caixa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function salvarAutomacao() {
  if (!RASCUNHO) return;
  const r = RASCUNHO;
  const problema = problemaDoRascunho();
  if (problema) { showToast(problema, 'error', 6000); return; }
  const corpo = { id: r.id || undefined, nome: r.nome.trim(), ordem: r.ordem, ativa: r.ativa,
                  gatilho: r.gatilho, condicao: r.condicao, acoes: r.acoes };
  try {
    const resposta = await fetch(AUTOMACOES_API, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    });
    const d = await resposta.json();
    if (!resposta.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    fecharConstrutor();
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
  // Desligar guarda a regra; excluir apaga a redação dela. Vale perguntar — e
  // perguntar na caixa do painel, não no aviso cinza do navegador.
  const sim = await perguntarNoPainel({
    titulo: `Excluir “${a?.nome || id}”?`,
    texto: 'Se a ideia é só parar de rodar, use “desligar” — assim a regra continua registrada e dá para religar depois.',
    confirmar: 'Excluir de vez', perigo: true,
  });
  if (!sim) return;
  try {
    const resposta = await fetch(`${AUTOMACOES_API}&id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!resposta.ok) throw new Error((await resposta.json())?.error || 'Falhou.');
    showToast('Regra excluída.', 'success', 3500);
    carregarAutomacoes();
  } catch (erro) { showToast(`Falhou: ${erro.message}`, 'error', 5000); }
}

// A COLUNA PRIORIDADE, REFEITA NA HORA.
//
// Ela se refaz sozinha de madrugada. Este botao existe para os dias em que se
// acabou de mexer em muita data e nao da para esperar ate as 3h para ver o
// quadro ordenado direito.
//
// Pergunta com o numero na mao: roda primeiro em seco, que conta o que MUDARIA
// sem mudar nada, e so entao pede confirmacao. "Aplicar em 41 peças" e uma
// decisao; "aplicar" sozinho e um pulo no escuro.
async function recalcularPrioridadesAgora(botao) {
  const chamar = async (seco) => {
    const r = await fetch(`${AUTOMACOES_API}&acao=prioridades${seco ? '&seco=1' : ''}`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
    return d;
  };
  if (botao) { botao.disabled = true; botao.textContent = 'Conferindo…'; }
  try {
    const previa = await chamar(true);
    if (!previa.mudancas) {
      showToast(`✓ Nada a mudar · ${previa.consideradas} peças já estão com a prioridade que a veiculação pede`, 'ok', 6000);
      return;
    }
    const faixas = Object.entries(previa.distribuicao || {})
      .map(([rotulo, quantas]) => `${quantas} ${rotulo}`).join(' · ');
    const sim = await perguntarNoPainel({
      titulo: `Recalcular a prioridade de ${previa.mudancas} peça${previa.mudancas === 1 ? '' : 's'}?`,
      texto: `De ${previa.consideradas} peças abertas com data de veiculação, ${previa.ja_certas} já estão certas. Como fica o quadro depois: ${faixas}. O Monday recebe a cópia pela fila.`,
      confirmar: 'Recalcular',
    });
    if (!sim) return;
    if (botao) botao.textContent = 'Recalculando…';
    const feito = await chamar(false);
    showToast(`✓ ${feito.aplicadas} prioridade${feito.aplicadas === 1 ? '' : 's'} refeita${feito.aplicadas === 1 ? '' : 's'} · ${feito.na_fila_do_monday} na fila do Monday`, 'ok', 7000);
    // A tela de automacoes nao mostra a coluna; quem precisa reler e o painel.
    if (typeof carregarOperacao === 'function') await carregarOperacao();
  } catch (erro) {
    showToast(`Não foi possível recalcular: ${erro.message}`, 'error', 7000);
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = 'Recalcular prioridades'; }
  }
}

// As regras que vieram do Monday moram no codigo, e mudam quando o codigo muda.
// Este botao traz essas mudancas para o banco — corrigindo as que ja existem, em
// vez de duplicar. Regra criada aqui no painel NAO e tocada: quem escreveu uma
// regra a mao nao pode ve-la reescrita por um deploy.
async function sincronizarRegrasDoSistema(botao) {
  const sim = await perguntarNoPainel({
    titulo: 'Sincronizar as regras do sistema?',
    texto: 'As regras que vieram do Monday voltam ao que está no código — as que mudaram são corrigidas e as novas entram. Regras criadas aqui no painel não são tocadas.',
    confirmar: 'Sincronizar',
  });
  if (!sim) return;
  if (botao) { botao.disabled = true; botao.textContent = 'Sincronizando…'; }
  try {
    const r = await fetch(`${AUTOMACOES_API}&acao=semear&refazer=1`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
    showToast(`✓ Regras sincronizadas${typeof d.criadas === 'number' ? ` · ${d.criadas} nova(s)` : ''}`, 'ok', 6000);
    carregarAutomacoes();
  } catch (erro) {
    showToast(`Não foi possível sincronizar: ${erro.message}`, 'error', 7000);
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = 'Sincronizar regras do sistema'; }
  }
}
