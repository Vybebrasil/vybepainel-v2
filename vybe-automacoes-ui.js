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


let AUTOMACOES = [];
let EXECUCOES = [];
let CATALOGOS = { status: [], captacao: [], grupos: [], pessoas: [], formatos: [] };
let automacaoEmEdicao = null;
let RASCUNHO = null;          // a regra sendo montada no construtor
let FILTRO_DE_REGRAS = 'todas';
let ABA_DE_AUTOMACOES = 'regras'; // 'regras' | 'falhas' (quadro 11: as falhas numa aba própria)

function podeEditarAutomacoes() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
}

// As regras e os catalogos, uma vez por sessao. Separado do carregarAutomacoes
// porque o diagnostico na peca precisa dos NOMES das etiquetas sem abrir a tela
// de Automacoes — e sem os nomes ele responderia 'captacao_feita' a quem so
// reconhece 'Captação Feita'.
let REGRAS_CARREGADAS = null;
async function carregarRegrasECatalogos() {
  const resposta = await fetch(AUTOMACOES_API, { credentials: 'same-origin' });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.error || 'Falha ao carregar automações.');
  AUTOMACOES = dados.automacoes || [];
  if (dados.catalogos) CATALOGOS = { ...CATALOGOS, ...dados.catalogos };
  return dados;
}
function garantirRegrasECatalogos() {
  REGRAS_CARREGADAS = REGRAS_CARREGADAS || carregarRegrasECatalogos()
    .catch((erro) => { REGRAS_CARREGADAS = null; throw erro; });
  return REGRAS_CARREGADAS;
}

async function carregarAutomacoes() {
  const raiz = document.getElementById('automacoes-root');
  if (raiz) raiz.innerHTML = `<div class="d3m-e-tela d3m-e-auto"><div class="d3m-e-corpo um"><div class="d3m-e-main"><section class="d3m-e-folha cresce">${estadoDeAutomacoes({ tipo: 'carregando', forma: 'lista', linhas: 8, titulo: 'Carregando as regras' })}</section></div></div></div>`;
  try {
    // Abrir a tela recarrega de verdade: quem acabou de salvar uma regra precisa
    // ver a dela, nao a resposta guardada de antes.
    REGRAS_CARREGADAS = carregarRegrasECatalogos();
    await REGRAS_CARREGADAS;
    pintarAutomacoes();
    carregarHistorico();
    carregarFalhasAutomacoes();
  } catch (erro) {
    REGRAS_CARREGADAS = null;
    if (raiz) raiz.innerHTML = `<div class="d3m-e-tela d3m-e-auto"><div class="d3m-e-corpo um"><div class="d3m-e-main"><section class="d3m-e-folha cresce">${estadoDeAutomacoes({ tipo: 'erro', grande: true, titulo: 'Não foi possível carregar as automações', texto: erro.message,
      acao: botaoDeEstadoDeAutomacoes('Tentar de novo', 'onclick="carregarAutomacoes()"', true) })}</section></div></div></div>`;
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
      ? `chegou a rodar ${vezesAutomacao(total)}` : 'nunca chegou a rodar' };
  }
  if (!total) {
    return { chave: 'nunca', rotulo: 'nunca rodou', detalhe: motivoDeNuncaTerRodado(a) };
  }
  if (recentes) {
    return { chave: 'trabalhando', rotulo: 'trabalhando',
      detalhe: `rodou ${vezesAutomacao(recentes)} em ${DIAS_PARA_CONSIDERAR_PARADA} dias · última ${quandoFoiAutomacao(ultima)}` };
  }
  return { chave: 'parada', rotulo: 'parada',
    detalhe: `rodou ${vezesAutomacao(total)} no total · última ${quandoFoiAutomacao(ultima)}` };
}
function vezesAutomacao(n) { return `${Number(n).toLocaleString('pt-BR')} ${Number(n) === 1 ? 'vez' : 'vezes'}`; }

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

function quandoFoiAutomacao(data) {
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
//
// V2 · Automações (prancha V2-M-Automacoes, aprovada pelo Paulo em 16/11/2026): o título direto no vidro (com a seta que
// troca de tela, a busca, o "Como funciona" e "Nova regra"), uma folha só com Regras e Falhas no alternador da cabeça e,
// direto no vidro, a coluna de consulta: o laranja do agente quando há falha, o que uma regra pode fazer (com quantas
// vezes cada tipo rodou), as falhas que pedem alguém, as últimas ações e os atalhos. Recalcular e Sincronizar (o "Mais"
// de antes) moram em "Manutenção", no fim da consulta, só para quem administra.
const DICA_PRIORIDADE = 'A coluna Prioridade não é escrita à mão: é o espelho da veiculação. Atrasado, hoje ou amanhã é Crítica; 2 a 3 dias, Alta; 4 a 7 dias, Média; 8 dias ou mais, Baixa. Sobe e desce sozinha na varredura da madrugada; peça finalizada ou sem veiculação não é tocada.';
const DICA_REGRAS_DE_DATA = 'As regras por data rodam numa varredura por dia, de madrugada, e não na hora que estiver escrita nelas.';
const DICA_DO_QUE_E_REGRA = 'Uma regra tem três partes: quando (o gatilho), se (a condição) e então (o que acontece). Todo mundo lê; só quem administra cria, liga e desliga.';

const ICONE_SETA_REGRA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICONES_DE_AUTOMACOES = { lupa: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.2 1-1.2 1.9M12 17h.01"/>',
  mais: '<path d="M12 5v14M5 12h14"/>', depois: '<path d="M9 6l6 6-6 6"/>', alta: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', baixo: '<path d="M6 9l6 6 6-6"/>' };
function iconeDeAutomacoes(nome) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES_DE_AUTOMACOES[nome] || ''}</svg>`; }
// Os estados (vazio, carregando e erro) saem da peça comum; fora do painel (testes), a mesma frase numa marcação simples.
function estadoDeAutomacoes(o) {
  if (typeof d3mEEstado === 'function') return d3mEEstado(o);
  return `<div class="d3m-e-estado d3m-e-estado-${o.tipo || 'vazio'}" role="${o.tipo === 'erro' ? 'alert' : 'status'}">${o.titulo ? `<b>${safeText(o.titulo)}</b>` : ''}${o.texto ? `<span>${safeText(o.texto)}</span>` : ''}${o.acao || ''}</div>`;
}
function botaoDeEstadoDeAutomacoes(rotulo, attrs, sec = false) {
  return typeof d3mEEstadoBtn === 'function' ? d3mEEstadoBtn(rotulo, attrs, sec) : `<button type="button" class="d3m-e-estado-btn${sec ? ' sec' : ''}" ${attrs}>${safeText(rotulo)}</button>`;
}
// O quadro mostra a lista de regras inteira (8); passa disso, o resto recolhe.
const REGRAS_NA_FRENTE = 8, ACOES_NA_FRENTE = 6, PEDIDOS_NA_FRENTE = 3;
let FALHAS_DE_AUTOMACOES = null;   // null enquanto a consulta não volta
let BUSCA_DE_REGRAS = '';
let REGRA_ABERTA = null, TODAS_AS_REGRAS = false, FILTROS_DE_SAUDE = false, HISTORICO_INTEIRO = false, PEDE_ACAO_INTEIRO = false;

function regrasComSaude() { return AUTOMACOES.map((a) => ({ ...a, saude: saudeDaRegra(a) })); }
function regraNoRecorte(a) {
  if (FILTRO_DE_REGRAS === 'ligada') { if (!a.ativa) return false; }
  else if (FILTRO_DE_REGRAS !== 'todas' && a.saude.chave !== FILTRO_DE_REGRAS) return false;
  const q = BUSCA_DE_REGRAS.trim().toLowerCase();
  return !q || `${a.nome} ${frasearGatilho(a.gatilho)} ${(a.acoes || []).map(frasearAcao).join(' ')}`.toLowerCase().includes(q);
}
function nomeDoAgenteDeAutomacao() {
  try {
    const planta = window.mundoVoxel?.planta?.() || [];
    for (const andar of planta) for (const s of andar.setores || []) if (s.id === 'automacao' && s.agente) return String(s.agente);
  } catch { /* sem a planta do prédio: o nome de sempre */ }
  return 'Cícero';
}
// Atalho da consulta: abre outra tela pelo próprio item do menu lateral (o clique é o dele).
function abrirTelaPeloMenu(id) {
  const item = document.querySelector?.(`.vv-trilho [data-trilho="${id}"], .vv-trilho [data-submodulo="${id}"]`);
  if (item) item.click();
}
// A lupa do topo: leva à aba Regras e põe o cursor na busca.
function abrirBuscaDeRegras() {
  trocarAbaAutomacoes('regras');
  document.getElementById('auto-busca')?.focus?.();
}

function pintarAutomacoes() {
  const raiz = document.getElementById('automacoes-root');
  if (!raiz) return;
  raiz.classList.add('v2r'); // o construtor (Nova regra) segue com as peças de antes
  // A folha antiga pinta de cinza, com força, todo botão dentro de uma classe "auto-…": a raiz deixa de ser .auto-shell
  // (que só dava o respiro da página antiga); o construtor, que tem as próprias classes auto-…, segue igual.
  raiz.classList.remove?.('auto-shell');
  const admin = podeEditarAutomacoes();
  const comSaude = regrasComSaude();
  const semRegra = !comSaude.length;
  const temRegraDeData = AUTOMACOES.some((a) => a.gatilho?.tipo === 'data' && a.ativa);
  const aba = ABA_DE_AUTOMACOES === 'falhas' ? 'falhas' : ABA_DE_AUTOMACOES === 'registro' && !semRegra ? 'registro' : 'regras';
  const ligadas = comSaude.filter((a) => a.ativa).length;

  // Topo no vidro. "Nova regra" é a pastilha branca; a busca só existe com regra para buscar.
  const ajuda = `<details class="d3m-e-troca d3m-e-ajuda"><summary class="d3m-e-ico" aria-label="Como funciona" title="Como funciona">${iconeDeAutomacoes('ajuda')}</summary><div class="d3m-e-pop d3m-e-ajuda-pop" role="note" aria-label="Como as regras funcionam"><b class="d3m-e-ajuda-t">Como funciona</b>${[DICA_DO_QUE_E_REGRA, DICA_PRIORIDADE, ...(temRegraDeData || semRegra ? [DICA_REGRAS_DE_DATA] : [])].map((texto) => `<p class="d3m-e-ajuda-p" data-dica="${safeText(texto)}">${safeText(texto)}</p>`).join('')}</div></details>`;
  const busca = semRegra ? '' : `<button type="button" class="d3m-e-ico" aria-label="Buscar regra" title="Buscar regra" onclick="abrirBuscaDeRegras()">${iconeDeAutomacoes('lupa')}</button>`;
  const novo = admin ? `<button type="button" class="d3v-btn d3m-e-claro auto-novo" onclick="editarAutomacao(null)">${iconeDeAutomacoes('mais')}Nova regra</button>` : '';
  const sub = `regras que movem as demandas sozinhas · ${semRegra ? 'nenhuma regra ainda' : `${comSaude.length} ${comSaude.length === 1 ? 'regra' : 'regras'}, ${ligadas} ${ligadas === 1 ? 'ligada' : 'ligadas'}`}`;
  const topo = typeof d3mETopo === 'function' ? d3mETopo({ titulo: 'Automações', sub, setor: 'gestao', atual: 'automacoes', acoes: busca + ajuda + novo })
    : `<div class="d3m-e-topo"><div class="d3m-e-tit"><span class="d3m-e-h" role="heading" aria-level="2">Automações</span><span class="d3m-e-sub">${safeText(sub)}</span></div><div class="d3m-e-acoes">${busca}${ajuda}${novo}</div></div>`;

  // Regras e Falhas no alternador da cabeça da folha (par de opções: aria-checked).
  const abas = `<div class="d3m-e-seg ar-abas" role="radiogroup" aria-label="Regras ou falhas">
        <button type="button" role="radio" data-aba-botao="regras" aria-checked="${aba === 'regras'}" onclick="trocarAbaAutomacoes('regras')">Regras <span class="ar-n">${comSaude.length}</span></button>
        <button type="button" role="radio" data-aba-botao="falhas" aria-checked="${aba === 'falhas'}" onclick="trocarAbaAutomacoes('falhas')">Falhas <span class="ar-n" id="auto-aba-falhas-n">…</span></button>
        ${semRegra ? '' : `<button type="button" role="radio" data-aba-botao="registro" aria-checked="${aba === 'registro'}" onclick="trocarAbaAutomacoes('registro')">Últimas ações</button>`}
      </div>`;
  const passo = (n, titulo, texto) => `<div class="d3m-e-au-passo"><i class="d3m-e-au-passo-n" aria-hidden="true">${n}</i><b>${titulo}</b><span>${texto}</span></div>`;
  const vazio = estadoDeAutomacoes({ tipo: 'vazio', icone: 'alta', grande: true, titulo: 'Nenhuma regra ainda',
    texto: `Uma regra move, atribui ou avisa sozinha quando uma peça muda.${admin ? '' : ' Quando quem administra criar uma, ela aparece aqui.'}`,
    acao: admin ? botaoDeEstadoDeAutomacoes('Criar a primeira regra', 'onclick="editarAutomacao(null)"') : '' });
  const abaRegras = semRegra
    ? `<div class="d3m-e-rola d3m-e-au-vazio">${vazio}</div>
        <div class="d3m-e-au-passos" role="list" aria-label="Como uma regra é montada">${passo(1, 'Quando', 'O gatilho: a peça mudou de status, a captação mudou ou uma data chegou.')}${passo(2, 'Se', 'A condição: de qual formato, de qual grupo, em qual status.')}${passo(3, 'Então', 'O que acontece: mover, atribuir a alguém ou avisar.')}</div>`
    : `<div class="d3m-e-nums d3m-e-au-nums" id="auto-kpis" style="--n:3"></div>
        <div class="d3m-e-au-filtros">
          <input class="d3m-e-au-busca" id="auto-busca" type="search" aria-label="Buscar regra" placeholder="Buscar regra" autocomplete="off" value="${safeText(BUSCA_DE_REGRAS)}" oninput="buscarRegras(this.value)">
          <span class="d3m-e-au-chips" id="auto-regras-chips" role="radiogroup" aria-label="Filtrar regras"></span>
        </div>
        <div id="auto-regras-lista" class="d3m-e-rola d3m-e-au-lista"></div>`;

  // A consulta, direto no vidro.
  const linha = (id, nome, texto) => `<button type="button" class="d3m-vlin" onclick="abrirTelaPeloMenu('${id}')"><span><b>${nome}</b> · ${texto}</span>${iconeDeAutomacoes('depois')}</button>`;
  const manutencao = admin ? `<div class="d3m-cons d3m-e-au-manut"><div class="d3m-cons-cab"><b>Manutenção</b></div>
        <button type="button" class="d3m-vlin" onclick="recalcularPrioridadesAgora(this)"
          title="Refaz a coluna Prioridade de todas as peças a partir da veiculação. Roda sozinho toda madrugada; isto aqui é para não esperar.">Recalcular prioridades</button>
        <button type="button" class="d3m-vlin" onclick="sincronizarRegrasDoSistema(this)"
          title="Traz para o painel as regras que vieram do Monday, corrigindo as que mudaram. Regra criada aqui não é tocada.">Sincronizar regras do sistema</button>
      </div>` : '';
  const lado = `<aside class="d3m-lado d3m-e-au-lado" aria-label="Consulta">
      ${semRegra ? '' : '<div id="auto-fala" class="d3m-e-au-fala" hidden></div>'}
      <div class="d3m-cons"><div class="d3m-cons-cab"><b>O que uma regra pode fazer</b>${semRegra ? '' : '<span>em 30 dias</span>'}</div><div id="auto-tipos" class="d3m-cons"></div></div>
      <div class="d3m-cons"><div class="d3m-cons-cab"><b>${semRegra ? 'Falhas' : 'Pede ação'}</b><span id="auto-pede-n"></span></div><div id="auto-pede" class="d3m-cons"></div></div>
      <div class="d3m-cons"><div class="d3m-cons-cab"><b>Abrir</b></div>
        ${linha('tarefas', 'Minhas tarefas', 'a fila na ordem do dia')}
        ${linha('agentes', 'Agentes', 'o que os bots fazem sozinhos')}
      </div>
      ${manutencao}
    </aside>`;

  raiz.innerHTML = `<div class="d3m-e-tela d3m-e-auto" data-vazia="${semRegra}">
    ${topo}
    <div id="auto-editor"></div>
    <div class="d3m-e-corpo">
      <div class="d3m-e-main">
        <section class="d3m-e-folha cresce d3m-e-au-folha" aria-label="Regras e falhas">
          <div class="d3m-e-cab"><b>Regras</b>${abas}</div>
          <div class="ar-aba d3m-e-au-aba" data-aba="regras" role="group" aria-label="Regras" ${aba === 'regras' ? '' : 'hidden'}>
            ${abaRegras}
          </div>
          <div class="ar-aba d3m-e-au-aba" data-aba="falhas" role="group" aria-label="Encaminhamentos com falha" ${aba === 'falhas' ? '' : 'hidden'}>
            <div class="d3m-e-au-falhas-topo"><span>Status de Produção e Demandas que não conseguiram seguir. As resolvidas ficam no histórico; até 100, com as pendentes primeiro.</span>
              <button type="button" class="d3v-btn s d3m-e-fio" onclick="carregarFalhasAutomacoes()">Atualizar</button></div>
            <div id="auto-falhas-lista" class="d3m-e-rola d3m-e-au-falhas" aria-live="polite">${estadoDeAutomacoes({ tipo: 'carregando', forma: 'lista', linhas: 4, titulo: 'Carregando as falhas' })}</div>
          </div>
          ${semRegra ? '<div id="auto-historico" hidden></div>' : `<div class="ar-aba d3m-e-au-aba" data-aba="registro" role="group" aria-label="Últimas ações" ${aba === 'registro' ? '' : 'hidden'}>
            <div class="d3m-e-au-falhas-topo"><span>O que as regras fizeram por último, uma linha por ação.</span><span class="d3m-e-au-hist-n" id="auto-historico-n"></span></div>
            <div id="auto-historico" class="d3m-e-rola d3m-e-au-hist">${estadoDeAutomacoes({ tipo: 'carregando', forma: 'lista', linhas: 6, titulo: 'Carregando o registro' })}</div>
          </div>`}
        </section>
      </div>
      ${lado}
    </div>
  </div>`;
  pintarResumoDasAutomacoes();
  pintarListaDeRegras();
}

// Os três números da folha e a consulta (o laranja do agente, o que as regras fizeram por tipo e o que pede ação):
// repintam quando as falhas chegam, sem mexer na lista nem na busca.
function pintarResumoDasAutomacoes() {
  const pede = document.getElementById('auto-pede');
  if (!pede) return;
  const fala = document.getElementById('auto-fala'), kpis = document.getElementById('auto-kpis'), tiposNo = document.getElementById('auto-tipos'), pedeN = document.getElementById('auto-pede-n');
  const admin = podeEditarAutomacoes(), comSaude = regrasComSaude(), semRegra = !comSaude.length;
  const n = (v) => Number(v).toLocaleString('pt-BR');
  const ligadas = comSaude.filter((a) => a.ativa).length;
  const acoes = comSaude.reduce((t, a) => t + Number(a.execucoes_30_dias || 0), 0);
  const lendo = FALHAS_DE_AUTOMACOES === null;
  const pendentes = (FALHAS_DE_AUTOMACOES || []).filter((f) => f.estado === 'pendente');
  // Quantas vezes rodaram, em 30 dias, as regras que movem, que atribuem e que avisam (uma regra pode fazer mais de uma coisa).
  const rodaram = (tipos) => comSaude.filter((a) => (a.acoes || []).some((x) => tipos.includes(x.tipo))).reduce((t, a) => t + Number(a.execucoes_30_dias || 0), 0);
  const agente = nomeDoAgenteDeAutomacao();

  // O que uma regra pode fazer: as três linhas da prancha; com regra, cada uma diz quantas vezes rodou em 30 dias.
  if (tiposNo) tiposNo.innerHTML = [['Mover', 'trocar o grupo ou o status da peça', ['grupo', 'status', 'captacao']], ['Atribuir', 'dar um dono', ['responsaveis']], ['Avisar', 'no grupo ou a uma pessoa', ['notificar', 'update']]]
    .map(([nome, texto, tipos]) => `<div class="d3m-vlin d3m-e-au-tipo"><span><b>${nome}</b> · ${texto}</span>${semRegra ? '' : `<b class="d3m-vn">${n(rodaram(tipos))}</b>`}</div>`).join('');

  // O laranja é só para ação: aparece quando há falha esperando alguém. As falhas do mesmo motivo contam juntas
  // ("2 falhas · motivo"); com uma só, o "Tentar de novo" e o diagnóstico ficam aqui; com várias, "Ver as N" leva à aba.
  const porMotivo = new Map();
  for (const f of pendentes) { const k = String(f.motivo || '').trim() || 'sem motivo'; if (!porMotivo.has(k)) porMotivo.set(k, []); porMotivo.get(k).push(f); }
  if (fala) {
    const um = pendentes.length === 1 ? pendentes[0] : null;
    const motivos = [...porMotivo].map(([motivo, fs]) => (porMotivo.size === 1 ? motivo : `${fs.length === 1 ? '1 falha' : `${fs.length} falhas`} · ${motivo}`));
    const apoio = um ? `${um.titulo || ''}${um.clientes ? ` · ${um.clientes}` : ''}` : porMotivo.size > 1 ? motivos.slice(0, 2).join('; ') + (motivos.length > 2 ? `; + ${motivos.length - 2}` : '') : '';
    fala.hidden = !pendentes.length;
    fala.innerHTML = pendentes.length ? `<section class="d3m-laranja d3m-e-au-lar" aria-label="O que pede ação agora">
      <span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">${safeText(agente.slice(0, 1).toUpperCase())}</span>${safeText(agente)} · Automação</span>
      <span class="d3m-lar-txt"><b class="d3m-lar-num">${pendentes.length}</b><span class="d3-acao-frase">${um ? '1 falha espera' : `${pendentes.length} falhas esperam`} alguém${porMotivo.size === 1 ? `: ${safeText(motivos[0])}` : ''}.</span>${apoio ? `<small class="d3m-lar-sub">${safeText(apoio)}</small>` : ''}</span>
      <span class="d3m-lar-bts">${um ? `<button type="button" class="d3m-btn l v2-estado" data-item="${safeText(um.item)}" data-evento="${safeText(um.ocorrencia)}" onclick="retomarEncaminhamentoDaPeca(this.dataset.item,this.dataset.evento,this)">Tentar de novo</button>
        <button type="button" class="d3m-btn l s" data-item="${safeText(um.item)}" onclick="diagnosticarAutomacao(this.dataset.item,this)">Ver diagnóstico</button>`
        : `<button type="button" class="d3m-btn l" onclick="trocarAbaAutomacoes('falhas')">Ver as ${pendentes.length}</button>`}</span></section>` : '';
  }

  // Três números na folha: ligadas, ações em 30 dias e falhas.
  if (kpis) {
    const num = (rotulo, valor, sub, tom = '') => `<span class="d3m-e-au-num${tom ? ' ' + tom : ''}"><b>${valor}</b><span>${rotulo}</span><small class="d3m-e-au-num-sub">${sub}</small></span>`;
    kpis.innerHTML = num('Regras ligadas', `${ligadas}<small class="d3m-e-au-de"> / ${comSaude.length}</small>`, admin ? (ligadas ? 'movem sozinhas' : 'nada se move sozinho') : 'só quem administra altera')
      + num('Ações em 30 dias', n(acoes), acoes ? 'sem ninguém tocar' : 'nenhuma no período')
      + num('Falhas', lendo ? '…' : String(pendentes.length), lendo ? 'consultando' : pendentes.length ? 'esperando alguém' : 'nenhuma', pendentes.length ? 'r' : '');
  }

  // Pede ação: as regras desligadas e as paradas, cada uma numa linha com a saída (as falhas estão no laranja).
  const item = (tom, selo, texto, dica, botao) => `<div class="d3m-e-au-pede" title="${dica}"><span class="d3m-pt ${tom}"></span><p class="d3m-e-au-pede-txt"><span class="d3m-e-au-selo">${selo}</span> ${texto}</p>${botao}</div>`;
  const itens = [
    ...comSaude.filter((a) => a.saude.chave === 'desligada').map((a) => item('a', 'Desligada', `<b>${safeText(a.nome)}</b> · ${safeText(a.saude.detalhe)}`, safeText(`${a.nome} · ${a.saude.detalhe}`),
      admin ? `<button type="button" class="d3v-btn s vidro" onclick="alternarAutomacao(${a.id})">Ligar</button>` : '')),
    ...comSaude.filter((a) => a.saude.chave === 'parada').map((a) => item('a', 'Parada', `<b>${safeText(a.nome)}</b> · ${safeText(a.saude.detalhe)}`, safeText(`${a.nome} · ${a.saude.detalhe}`),
      `<button type="button" class="d3v-btn s vidro" onclick="abrirRegra(${a.id},true)">Abrir</button>`)),
  ];
  const mostra = PEDE_ACAO_INTEIRO ? itens : itens.slice(0, PEDIDOS_NA_FRENTE);
  if (pedeN) pedeN.textContent = semRegra ? (lendo ? '…' : String(pendentes.length)) : itens.length ? `${itens.length} ${itens.length === 1 ? 'regra' : 'regras'}` : '';
  pede.innerHTML = (mostra.join('') || `<p class="d3m-e-lado-txt">${semRegra ? (lendo ? 'Conferindo as falhas…' : 'Quando uma regra não consegue rodar, a falha aparece aqui com o motivo, e nada é movido.') : 'Nenhuma regra desligada ou parada.'}</p>`)
    + (itens.length > PEDIDOS_NA_FRENTE ? `<p class="d3m-e-lado-txt d3m-e-au-pe">${PEDE_ACAO_INTEIRO ? '' : `+ ${itens.length - mostra.length} · `}<a href="#" role="button" class="d3m-e-au-elo" onclick="mostrarTodoOPedeAcao(${!PEDE_ACAO_INTEIRO});return false">${PEDE_ACAO_INTEIRO ? 'recolher' : 'mostrar'}</a></p>` : '');
}
function mostrarTodoOPedeAcao(sim) { PEDE_ACAO_INTEIRO = Boolean(sim); pintarResumoDasAutomacoes(); }
// A consulta das falhas terminou (ou falhou: lista vazia para a tela não ficar em "consultando").
function aoLerFalhasDeAutomacoes(falhas) { FALHAS_DE_AUTOMACOES = Array.isArray(falhas) ? falhas : []; pintarResumoDasAutomacoes(); }

// Uma regra, uma linha de 52: a chave, o nome com a frase "Quando… então…", o selo de saúde, quantas ações e "Testar".
// A linha abre no lugar (a saúde, a última ação e, para quem administra, editar e excluir).
function linhaDaRegraHtml(a, admin) {
  const s = a.saude, nome = safeText(a.nome), aberta = REGRA_ABERTA === Number(a.id);
  const condicao = frasearCondicao(a.condicao);
  const acoes = (a.acoes || []).map((x) => safeText(frasearAcao(x))).join(' e ') || '—';
  const total = Number(a.execucoes_total || 0);
  const selo = { desligada: ['n', 'Desligada'], parada: ['a', 'Parada'], nunca: ['n', 'Nunca rodou'] }[s.chave];
  const liga = admin
    ? `<button type="button" class="d3m-e-au-tg" role="switch" aria-checked="${a.ativa ? 'true' : 'false'}"
        aria-label="Regra ${nome} ${a.ativa ? 'ligada' : 'desligada'}" title="${a.ativa ? 'Ligada: clique para desligar' : 'Desligada: clique para ligar'}"
        onclick="alternarAutomacao(${a.id})"></button>`
    : `<span class="d3m-e-au-pill ${a.ativa ? 'g' : 'n'}">${a.ativa ? 'Ligada' : 'Desligada'}</span>`;
  const ultima = (EXECUCOES || []).find((e) => e.automacao === a.nome);
  const saude = s.rotulo.charAt(0).toUpperCase() + s.rotulo.slice(1) + (s.detalhe ? ` · ${s.detalhe}` : '');
  return `
    <div class="v2-abre d3m-e-au-regra${a.ativa ? '' : ' desligada'}" data-regra="${Number(a.id)}" aria-expanded="${aberta}">
      <div class="d3m-e-au-lin">
        ${liga}
        <button type="button" class="d3m-e-au-nome" aria-expanded="${aberta}" title="Abrir a regra" onclick="abrirRegra(${a.id})"><b>${nome}</b>
          <span class="d3m-e-au-qe"><em class="d3m-e-au-q">Quando</em> ${safeText(frasearGatilho(a.gatilho))}${condicao
          ? ` <em class="d3m-e-au-q">só se</em> ${safeText(condicao)}` : ''} ${ICONE_SETA_REGRA}<em class="d3m-e-au-q">então</em> ${acoes}</span></button>
        ${selo && (admin || s.chave !== 'desligada') ? `<span class="d3m-e-au-pill ${selo[0]}">${selo[1]}</span>` : ''}
        <span class="d3m-e-au-n">${total.toLocaleString('pt-BR')} ${total === 1 ? 'ação' : 'ações'}</span>
        ${admin ? `<button type="button" class="d3v-btn s d3m-e-fio v2-estado" title="Ver o que ela faria, sem mexer em nada" aria-label="Testar regra ${nome}" onclick="ensaiarAutomacao(${a.id},this)">Testar</button>` : ''}
      </div>
      <div class="v2-mais"><div>
        <p class="d3m-e-au-mais">${safeText(saude)}</p>
        ${ultima ? `<p class="d3m-e-au-mais">A última ação foi em ${safeText(ultima.titulo || 'conteúdo removido')}, ${safeText(quandoFoiAutomacao(new Date(ultima.em)))}</p>` : ''}
        ${admin ? `<p class="d3m-e-au-mais"><span><a href="#" role="button" class="d3m-e-au-elo" onclick="editarAutomacao(${a.id});return false">Editar a regra</a> · <a href="#" role="button" class="d3m-e-au-elo" onclick="excluirAutomacao(${a.id});return false">excluir</a></span></p>` : ''}
      </div></div>
    </div>`;
}

// As fichas do filtro e as linhas: repintam sozinhas, para a busca não perder o foco a cada letra.
function pintarListaDeRegras() {
  const chips = document.getElementById('auto-regras-chips'), lista = document.getElementById('auto-regras-lista');
  if (!chips || !lista) return;
  const admin = podeEditarAutomacoes(), comSaude = regrasComSaude();
  const conta = (f) => comSaude.filter(f).length;
  const chip = ([chave, rotulo, n]) => `<button type="button" class="d3m-e-au-chip" role="radio" onclick="filtrarRegras('${chave}')" aria-checked="${FILTRO_DE_REGRAS === chave}">${rotulo} <b>${n}</b></button>`;
  const saude = [['trabalhando', 'Trabalhando'], ['parada', 'Paradas'], ['nunca', 'Nunca rodaram']]
    .map(([chave, rotulo]) => [chave, rotulo, conta((a) => a.saude.chave === chave)]).filter(([, , n]) => n);
  const comSaudeAberta = FILTROS_DE_SAUDE || saude.some(([chave]) => chave === FILTRO_DE_REGRAS);
  chips.innerHTML = [['todas', 'Todas', comSaude.length], ['ligada', 'Ligadas', conta((a) => a.ativa)], ['desligada', 'Desligadas', conta((a) => !a.ativa)]].map(chip).join('')
    + (saude.length ? `<button type="button" class="d3m-e-au-chip mais" aria-expanded="${comSaudeAberta}" onclick="abrirFiltrosDeRegras()">Filtros</button>` : '')
    + (saude.length && comSaudeAberta ? `<span class="d3m-e-au-saude">${saude.map(chip).join('')}</span>` : '');

  const visiveis = comSaude.filter(regraNoRecorte);
  const recorte = FILTRO_DE_REGRAS !== 'todas' || Boolean(BUSCA_DE_REGRAS.trim());
  // A regra aberta nunca fica escondida no "+ N recolhidas".
  const frente = visiveis.slice(0, REGRAS_NA_FRENTE);
  const mostra = TODAS_AS_REGRAS || recorte ? visiveis : [...frente, ...visiveis.slice(REGRAS_NA_FRENTE).filter((a) => Number(a.id) === REGRA_ABERTA)];
  const resto = visiveis.length - mostra.length;
  const pe = resto > 0 ? `+ ${resto} ${resto === 1 ? 'regra recolhida' : 'regras recolhidas'} · <a href="#" role="button" class="d3m-e-au-elo" onclick="mostrarTodasAsRegras(true);return false">mostrar</a> · `
    : TODAS_AS_REGRAS && !recorte && visiveis.length > REGRAS_NA_FRENTE ? '<a href="#" role="button" class="d3m-e-au-elo" onclick="mostrarTodasAsRegras(false);return false">recolher</a> · ' : '';
  lista.innerHTML = mostra.length
    ? mostra.map((a) => linhaDaRegraHtml(a, admin)).join('') + `<p class="d3m-e-au-rodape">${pe}clicar na regra abre${admin ? ' e edita' : ''}</p>`
    : estadoDeAutomacoes({ tipo: 'vazio', icone: 'alta', titulo: 'Nenhuma regra neste recorte', texto: 'Mude a busca ou o filtro para ver as outras.', acao: botaoDeEstadoDeAutomacoes('Ver todas', 'onclick="limparRecorteDeRegras()"', true) });
}
function buscarRegras(valor) { BUSCA_DE_REGRAS = String(valor || ''); pintarListaDeRegras(); }
function abrirFiltrosDeRegras() { FILTROS_DE_SAUDE = !FILTROS_DE_SAUDE; pintarListaDeRegras(); }
function mostrarTodasAsRegras(sim) { TODAS_AS_REGRAS = Boolean(sim); pintarListaDeRegras(); }
function limparRecorteDeRegras() {
  FILTRO_DE_REGRAS = 'todas'; BUSCA_DE_REGRAS = '';
  const busca = document.getElementById('auto-busca'); if (busca) busca.value = '';
  pintarListaDeRegras();
}
// Abre a regra no lugar (um clique abre, outro fecha); `manter` é para quem chega de outro bloco e quer vê-la aberta.
function abrirRegra(id, manter = false) {
  REGRA_ABERTA = !manter && REGRA_ABERTA === Number(id) ? null : Number(id);
  const lista = document.getElementById('auto-regras-lista');
  if (!lista) return;
  if (manter) trocarAbaAutomacoes('regras');
  if (manter && !lista.querySelector(`[data-regra="${Number(id)}"]`)) pintarListaDeRegras();
  lista.querySelectorAll('.d3m-e-au-regra').forEach((linha) => {
    const aberta = Number(linha.dataset.regra) === REGRA_ABERTA;
    linha.setAttribute('aria-expanded', String(aberta));
    linha.querySelector('.d3m-e-au-nome')?.setAttribute('aria-expanded', String(aberta));
    if (aberta && manter) linha.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function trocarAbaAutomacoes(aba) {
  ABA_DE_AUTOMACOES = aba === 'falhas' || aba === 'registro' ? aba : 'regras';
  const raiz = document.getElementById('automacoes-root');
  if (!raiz) return;
  raiz.querySelectorAll('.ar-abas button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.abaBotao === ABA_DE_AUTOMACOES)));
  raiz.querySelectorAll('.ar-aba').forEach((sec) => { sec.hidden = sec.dataset.aba !== ABA_DE_AUTOMACOES; });
}

function filtrarRegras(chave) {
  FILTRO_DE_REGRAS = FILTRO_DE_REGRAS === chave && chave !== 'todas' ? 'todas' : chave;
  pintarListaDeRegras();
}

// A lista pertence à instância da tela: uma resposta antiga não repinta outra abertura.
async function carregarFalhasAutomacoes() {
  const caixa = document.getElementById('auto-falhas-lista');
  if (!caixa) return;
  const pedido = String(Number(caixa.dataset.pedido || 0) + 1);
  caixa.dataset.pedido = pedido;
  // Os estados saem da peça comum; quando esta função roda sozinha (testes), a mesma frase numa linha simples.
  const estadoDeAutomacoes = typeof globalThis.estadoDeAutomacoes === 'function' ? globalThis.estadoDeAutomacoes
    : (o) => `<p class="d3m-e-au-rodape"${o.tipo === 'erro' ? ' role="alert"' : ''}>${safeText(o.titulo || '')}${o.texto ? `. ${safeText(o.texto)}` : ''}</p>${o.acao || ''}`;
  const botaoDeEstadoDeAutomacoes = typeof globalThis.botaoDeEstadoDeAutomacoes === 'function' ? globalThis.botaoDeEstadoDeAutomacoes
    : (rotulo, attrs) => `<button type="button" class="d3m-e-estado-btn sec" ${attrs}>${safeText(rotulo)}</button>`;
  caixa.innerHTML = estadoDeAutomacoes({ tipo: 'carregando', forma: 'lista', linhas: 4, titulo: 'Carregando as falhas' });
  // A contagem da aba Falhas (quadro 11) são as pendentes: as que ainda pedem alguém.
  const contagem = (texto, dica) => { const n = document.getElementById('auto-aba-falhas-n'); if (n && n !== caixa) { n.textContent = texto; n.title = dica; } };
  contagem('…', 'Consultando as falhas');
  try {
    const r = await fetch(`${AUTOMACOES_API}&falhas=1`,{credentials:'same-origin'});
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Falha ao consultar encaminhamentos.');
    if (document.getElementById('auto-falhas-lista') !== caixa || caixa.dataset.pedido !== pedido) return;
    const falhas = d.falhas || [];
    const pendentes = falhas.filter((f) => f.estado === 'pendente').length;
    contagem(String(pendentes), pendentes === 1 ? '1 falha pendente' : `${pendentes} falhas pendentes`);
    if (typeof aoLerFalhasDeAutomacoes === 'function') aoLerFalhasDeAutomacoes(falhas);
    if (!falhas.length) { caixa.innerHTML = estadoDeAutomacoes({ tipo: 'vazio', grande: true, titulo: 'Nenhuma falha registrada', texto: 'Quando uma regra não consegue rodar, a falha aparece aqui com o motivo, e nada é movido.' }); return; }
    const data = valor => new Date(valor).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const nomes = {pendente:'Pendente',resolvida:'Resolvida',superada:'Etapa alterada',removida:'Atividade removida'};
    caixa.innerHTML = `<p class="d3m-e-au-falhas-n">Exibindo ${falhas.length} de ${Number(falhas[0].total) || falhas.length} ocorrências.</p>` + falhas.map(f => `
      <article class="d3m-e-au-falha" data-estado="${safeText(f.estado || '')}">
        <div class="d3m-e-au-falha-peca"><b>${safeText(f.titulo)}</b><small class="d3m-e-au-falha-s">${safeText(f.clientes)}</small>
          <small class="d3m-e-au-falha-s">${safeText(f.status_anterior || '—')} → ${safeText(f.status_destino || '—')}</small></div>
        <div class="d3m-e-au-falha-motivo"><strong class="d3m-e-au-pill ${f.estado === 'pendente' ? 'r' : f.estado === 'resolvida' ? 'g' : 'n'}">${safeText(nomes[f.estado] || 'Indisponível')}</strong>
          <p class="d3m-e-au-falha-p">${safeText(f.motivo)}</p><small class="d3m-e-au-falha-s">${Number(f.tentativas)} tentativa(s) com falha · ${safeText(data(f.ultima_falha_em))}</small>
          ${f.resolvida_em ? `<small class="d3m-e-au-falha-s">Resolvida em ${safeText(data(f.resolvida_em))}</small>` : f.estado === 'superada' ? '<small class="d3m-e-au-falha-s">A etapa atual impede retomar este evento antigo.</small>' : ''}</div>
        <div class="d3m-e-au-falha-acoes">
          ${f.estado !== 'removida' ? `<button type="button" class="d3v-btn s d3m-e-fio" data-item="${safeText(f.item)}" onclick="diagnosticarAutomacao(this.dataset.item,this)">Ver diagnóstico</button>` : ''}
          ${f.estado === 'pendente' ? `<button type="button" class="d3v-btn s" data-item="${safeText(f.item)}" data-evento="${safeText(f.ocorrencia)}" onclick="retomarEncaminhamentoDaPeca(this.dataset.item,this.dataset.evento,this)">Tentar novamente</button>` : ''}
        </div>
      </article>`).join('');
  } catch (erro) {
    if (document.getElementById('auto-falhas-lista') === caixa && caixa.dataset.pedido === pedido) {
      contagem('!', 'Não foi possível consultar as falhas');
      if (typeof aoLerFalhasDeAutomacoes === 'function') aoLerFalhasDeAutomacoes([]);
      caixa.innerHTML = estadoDeAutomacoes({ tipo: 'erro', grande: true, titulo: 'Não foi possível consultar as falhas', texto: erro.message, acao: botaoDeEstadoDeAutomacoes('Tentar de novo', 'onclick="carregarFalhasAutomacoes()"', true) });
    }
  }
}

// ── histórico ─────────────────────────────────────────────────────────────────
async function carregarHistorico() {
  try {
    const r = await fetch(`${AUTOMACOES_API}&historico=1&limite=40`, { credentials: 'same-origin' });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
    EXECUCOES = d.execucoes || [];
    pintarHistorico();
  } catch (erro) {
    // A lista de regras não depende do histórico; só o lugar dele diz que falhou, em vez de carregar para sempre.
    const caixa = document.getElementById('auto-historico');
    if (caixa) caixa.innerHTML = estadoDeAutomacoes({ tipo: 'erro', grande: true, titulo: 'Não foi possível ler o registro', texto: erro.message,
      acao: botaoDeEstadoDeAutomacoes('Tentar de novo', 'onclick="carregarHistorico()"', true) });
  }
}

function pintarHistorico() {
  const caixa = document.getElementById('auto-historico');
  if (!caixa) return;
  const contagem = document.getElementById('auto-historico-n');
  if (!EXECUCOES.length) {
    caixa.innerHTML = estadoDeAutomacoes({ tipo: 'vazio', icone: 'relogio', grande: true, titulo: 'Nenhuma regra disparou ainda', texto: 'Cada ação que uma regra fizer aparece aqui, com a peça e a hora.' });
    if (contagem) contagem.textContent = '';
    return;
  }
  // Uma linha por ação, como no quadro: o que a regra fez (selo), em qual peça e a hora. A regra e a mudança que a
  // disparou ficam na dica da linha e aparecem escritas quando a lista inteira é aberta.
  const hoje = new Date().toDateString();
  const mostra = HISTORICO_INTEIRO ? EXECUCOES : EXECUCOES.slice(0, ACOES_NA_FRENTE);
  caixa.innerHTML = mostra.map((e) => {
    const ev = e.evento || {};
    const gatilho = ev.tipo === 'data' ? `por ${ev.campo || 'data'}`
      : `${nomeDeStatus(ev.de) || '—'} → ${nomeDeStatus(ev.para) || ''}`;
    const [tom, selo] = seloDaExecucao(e.feitas);
    const quando = new Date(e.em);
    const hora = quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dia = quando.toDateString() === hoje ? '' : `${quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} `;
    return `<div class="d3m-e-au-fez" title="${safeText(`${e.automacao || ''} · ${gatilho}`)}">
      <span class="d3m-e-au-selo ${tom}">${selo}</span>
      <p class="d3m-e-au-fez-txt"><b>${safeText(e.titulo || '(conteúdo removido)')}</b> · ${(e.feitas || []).map((f) => safeText(traduzirFeita(f))).join(' · ') || '—'}${HISTORICO_INTEIRO
        ? `<small class="d3m-e-au-fez-s">${safeText(e.automacao || '')} · ${safeText(gatilho)}</small>` : ''}</p>
      <span class="d3m-e-au-hora">${dia}${hora}</span>
    </div>`;
  }).join('') + (EXECUCOES.length > ACOES_NA_FRENTE
    ? `<p class="d3m-e-au-rodape">${HISTORICO_INTEIRO ? '' : `+ ${EXECUCOES.length - mostra.length} ${EXECUCOES.length - mostra.length === 1 ? 'ação' : 'ações'} · `}<a href="#" role="button" class="d3m-e-au-elo" onclick="mostrarHistoricoInteiro(${!HISTORICO_INTEIRO});return false">${HISTORICO_INTEIRO ? 'recolher' : 'mostrar'}</a></p>` : '');
  if (contagem) contagem.textContent = EXECUCOES.length === 1 ? 'a última' : `as últimas ${EXECUCOES.length}`;
  // Com o registro em mãos, a regra aberta passa a dizer qual foi a última ação dela.
  pintarListaDeRegras();
}
function mostrarHistoricoInteiro(sim) { HISTORICO_INTEIRO = Boolean(sim); pintarHistorico(); }
// O selo da linha: a primeira coisa que a regra fez naquela peça.
function seloDaExecucao(feitas) {
  const t = String((feitas || [])[0] || '');
  if (/^grupo/.test(t)) return ['g', 'Moveu'];
  if (/^responsáveis/.test(t)) return ['b', 'Atribuiu'];
  if (t === 'notificação' || t === 'update') return ['a', 'Avisou'];
  if (/^(status|captação)/.test(t)) return ['n', 'Mudou'];
  return ['n', 'Rodou'];
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
// O botão "Testar regra" conta o estado: gira enquanto o ensaio roda e fica "Passou" quando volta.
function estadoDoBotaoDeTeste(botao, estado) {
  if (!botao?.dataset) return;
  if (!estado) { delete botao.dataset.estado; botao.textContent = 'Testar'; return; }
  botao.dataset.estado = estado;
  if (estado === 'feito') { botao.textContent = 'Passou'; setTimeout(() => estadoDoBotaoDeTeste(botao, ''), 2600); }
}
async function ensaiarAutomacao(id, botao) {
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
  estadoDoBotaoDeTeste(botao, 'indo');
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
    estadoDoBotaoDeTeste(botao, 'feito');
  } catch (erro) {
    estadoDoBotaoDeTeste(botao, '');
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

// Quem abriu o construtor recebe o foco de volta quando ele fecha (Esc, ×, Cancelar ou salvar).
let ORIGEM_DO_CONSTRUTOR = null;
function editarAutomacao(id) {
  const ativo = document.activeElement;
  if (!RASCUNHO || !ativo?.closest?.('.regra-v2')) ORIGEM_DO_CONSTRUTOR = ativo && ativo !== document.body ? ativo : null;
  trocarAbaAutomacoes('regras'); // o construtor mora na aba Regras
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
  document.querySelector('#auto-editor .regra-v2')?.focus({ preventScroll: true });
}

function fecharConstrutor({ devolverFoco = true } = {}) {
  const aberto = Boolean(document.querySelector('#auto-editor .regra-v2'));
  RASCUNHO = null;
  const caixa = document.getElementById('auto-editor');
  if (caixa) caixa.innerHTML = '';
  const origem = ORIGEM_DO_CONSTRUTOR;
  ORIGEM_DO_CONSTRUTOR = null;
  if (!aberto || !devolverFoco) return;
  const volta = origem?.isConnected && origem.getClientRects().length ? origem : document.querySelector('#automacoes-root .auto-novo');
  volta?.focus?.({ preventScroll: true });
}
// Esc fecha o construtor (no campo, o primeiro Esc só tira o foco dele); uma janela por cima recebe o Esc antes.
// Trocar de tela pelo trilho também fecha: o rascunho não fica escondido esperando a volta.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !RASCUNHO) return;
    const construtor = document.querySelector('#auto-editor .regra-v2');
    if (!construtor?.getClientRects().length || document.querySelector('#cli-pergunta, #vb-apagar, #workflow-modal, dialog[open]')) return;
    e.preventDefault(); e.stopPropagation();
    const campo = e.target?.closest?.('input, textarea, select');
    if (campo && construtor.contains(campo)) { campo.blur(); construtor.focus({ preventScroll: true }); return; }
    fecharConstrutor();
  }, true);
  document.addEventListener('click', (e) => {
    const item = e.target?.closest?.('.vv-trilho [data-trilho], .vv-trilho [data-submodulo], .vv-trilho [data-visao-setor]');
    if (item && RASCUNHO && item.dataset.submodulo !== 'automacoes') fecharConstrutor({ devolverFoco: false });
  }, true);
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
    return 'O “vindo de” e o “virar” estão no mesmo valor: assim nada muda e a regra nunca dispara.';
  }
  if (!(RASCUNHO.acoes || []).length) return 'Uma regra sem ação não faz nada. Escolha pelo menos uma.';
  const vazia = (RASCUNHO.acoes || []).find((a) => (
    (a.tipo === 'responsaveis' && !(a.pessoas || []).length)
    || (['grupo', 'status', 'captacao'].includes(a.tipo) && !a.para)));
  if (vazia) return 'Uma das ações está sem escolha. Complete ou tire ela.';
  if (!String(RASCUNHO.nome || '').trim()) return 'Falta dar um nome à regra: é ele que aparece quando ela dispara.';
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

// V2 · S · Nova regra (prancha V2-S-Automacoes-Regra, aprovada pelo Paulo em 19/11/2026). Os quatro passos numa folha de
// duas colunas (1, 2 e 4 à esquerda; 3, as ações, à direita) e, direto no vidro, a frase "A regra vai ficar assim" com
// Testar numa peça, Cancelar e Criar regra. As escolhas de um valor só são <select>; as de vários (formato, grupo e
// pessoas) abrem uma lista de marcar por baixo do campo. Classes rg2-*: as antigas auto-* caem nas regras !important do
// legado (vybe-padrao.css e vybe-mundo.css).
const jsArgRegra = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
function opcoesDoCatalogo(lista, atual, primeira = '') {
  const itens = CATALOGOS[lista] || [];
  const nome = (x) => (lista === 'grupos' ? nomeDeGrupo(x.chave) : x.rotulo);
  return `${primeira ? `<option value="">${safeText(primeira)}</option>` : ''}${itens.map((x) =>
    `<option value="${safeText(x.chave)}"${String(atual || '') === String(x.chave) ? ' selected' : ''}>${safeText(nome(x))}</option>`).join('')}`;
}
function campoDeEscolhaRegra(rotulo, html, extra = '') {
  return `<label class="rg2-campo"><span class="rg2-rot">${rotulo}</span><span class="rg2-sel">${html}</span>${extra}</label>`;
}
// Escolha de vários: o resumo parece um campo; aberto, a lista de marcar (aria-pressed) fica por baixo dele.
function escolhaDeVariosRegra(k, lista, atuais, aoClicar, vazio, nada = 'nada cadastrado', prefixo = '') {
  const itens = CATALOGOS[lista] || [];
  const nome = (chave) => (lista === 'grupos' ? nomeDeGrupo(chave) : lista === 'pessoas' ? primeiroNome(nomeDePessoa(chave)) : rotuloDoCatalogo(lista, chave, chave));
  const marcados = (atuais || []).map(nome);
  const resumo = marcados.length ? prefixo + (marcados.length > 1 ? `${marcados.slice(0, -1).join(', ')} e ${marcados.at(-1)}` : marcados[0]) : vazio;
  const corpo = itens.length ? itens.map((x) => {
    const marcada = (atuais || []).some((v) => String(v) === String(x.chave));
    return `<button type="button" class="rg2-op" aria-pressed="${marcada}" onclick="${safeText(aoClicar.replace('{chave}', jsArgRegra(x.chave)))}">${x.cor ? `<i style="background:${safeText(x.cor)}"></i>` : ''}${safeText(lista === 'grupos' ? nomeDeGrupo(x.chave) : x.rotulo)}</button>`;
  }).join('') : `<span class="rg2-nada">${safeText(nada)}</span>`;
  return `<details class="rg2-varios" data-k="${safeText(k)}"><summary class="rg2-resumo${marcados.length ? '' : ' vazio'}"><span>${safeText(resumo)}</span></summary><div class="rg2-lista" role="group">${corpo}</div></details>`;
}

// Escolha de um (o "para onde" de uma ação): o mesmo campo, a lista fecha ao escolher. Sem <select> aqui porque o
// legado pinta todo campo de branco com !important, e na linha da ação a escolha é só a segunda linha do texto.
function escolhaDeUmRegra(k, lista, atual, caminho, vazio) {
  const itens = CATALOGOS[lista] || [];
  const nome = (chave) => (lista === 'grupos' ? nomeDeGrupo(chave) : rotuloDoCatalogo(lista, chave, chave));
  const corpo = itens.length ? itens.map((x) => {
    const marcada = String(atual || '') === String(x.chave);
    return `<button type="button" class="rg2-op" aria-pressed="${marcada}" onclick="${safeText(`this.closest('details').open=false;mexerNoRascunho('${caminho}','${jsArgRegra(x.chave)}')`)}">${x.cor ? `<i style="background:${safeText(x.cor)}"></i>` : ''}${safeText(nome(x.chave))}</button>`;
  }).join('') : '<span class="rg2-nada">nada cadastrado</span>';
  return `<details class="rg2-varios rg2-um" data-k="${safeText(k)}"><summary class="rg2-resumo${atual ? '' : ' vazio'}"><span>${safeText(atual ? `para ${nome(atual)}` : vazio)}</span></summary><div class="rg2-lista" role="group">${corpo}</div></details>`;
}

// A frase com as partes que decidem em negrito: o gatilho e a primeira ação.
function fraseDoRascunhoHtml() {
  const frase = fraseDoRascunho();
  if (!frase) return '';
  const quando = frasearGatilho(RASCUNHO.gatilho);
  const acoes = (RASCUNHO.acoes || []).map(frasearAcao).filter(Boolean);
  let html = safeText(frase);
  for (const parte of [quando, acoes[0]]) if (parte) html = html.replace(safeText(parte), `<b>${safeText(parte)}</b>`);
  return html;
}

// "Testar numa peça" do construtor: um ensaio SÓ NA TELA. A regra ainda não existe e o ensaio do servidor
// (acao=ensaio) roda as regras já gravadas criando e apagando uma peça de verdade; por isso aqui nada vai ao servidor:
// a peça de teste nasce do gatilho e da condição e recebe as ações em ordem, como o motor faz. Nada grava, nada avisa.
function ensaioDoRascunho(r = RASCUNHO) {
  if (!r) return null;
  const g = r.gatilho || {}, c = r.condicao || {};
  const peca = {
    formato: (c.formato_em || c.formato_apenas || [])[0] || '',
    grupo: (c.grupo_em || [])[0] || '',
    status: g.tipo === 'status' ? g.para || '' : (c.status_em || [])[0] || '',
    captacao: g.tipo === 'captacao' ? g.para || '' : (c.captacao_em || [])[0] || '',
    responsaveis: [], comentarios: 0, avisos: 0,
  };
  const mudou = new Set();
  for (const a of r.acoes || []) {
    if (a.tipo === 'grupo' && a.para) { peca.grupo = a.para; mudou.add('grupo'); }
    else if (a.tipo === 'status' && a.para) { peca.status = a.para; mudou.add('status'); }
    else if (a.tipo === 'captacao' && a.para) { peca.captacao = a.para; mudou.add('captacao'); }
    else if (a.tipo === 'responsaveis') {
      const novas = (a.pessoas || []).map(String);
      peca.responsaveis = a.modo === 'replace' ? novas : [...new Set([...peca.responsaveis, ...novas])];
      mudou.add('responsaveis');
    } else if (a.tipo === 'update') peca.comentarios += 1;
    else if (a.tipo === 'notificar') peca.avisos += 1;
  }
  return { peca, mudou: [...mudou] };
}
let ENSAIO_DO_RASCUNHO = '';
function ensaiarRascunho() {
  if (!RASCUNHO) return;
  const g = RASCUNHO.gatilho || {};
  if ((g.tipo !== 'data' && !g.para) || !(RASCUNHO.acoes || []).length) {
    ENSAIO_DO_RASCUNHO = 'Para testar, escolha o gatilho e pelo menos uma ação.';
    pintarConstrutor();
    return;
  }
  const { peca, mudou } = ensaioDoRascunho();
  const linhas = [];
  if (mudou.includes('status')) linhas.push(`status ${nomeDeStatus(peca.status)}`);
  if (mudou.includes('grupo')) linhas.push(`no grupo ${nomeDeGrupo(peca.grupo)}`);
  if (mudou.includes('captacao')) linhas.push(`captação ${nomeDeCaptacao(peca.captacao)}`);
  if (mudou.includes('responsaveis')) linhas.push(peca.responsaveis.length ? `com ${peca.responsaveis.map((p) => primeiroNome(nomeDePessoa(p))).join(' e ')}` : 'sem responsável');
  if (peca.comentarios) linhas.push(peca.comentarios === 1 ? 'um comentário escrito' : `${peca.comentarios} comentários escritos`);
  if (peca.avisos) linhas.push('o responsável avisado');
  const formato = peca.formato ? nomeDeFormato(peca.formato) : 'qualquer formato';
  ENSAIO_DO_RASCUNHO = `Numa peça de ${formato}, quando ${frasearGatilho(g)}: ${linhas.length ? `fica ${linhas.join(', ')}` : 'nada muda (falta escolher para onde)'}. Ensaio só na tela: nada foi gravado nem avisado.`;
  pintarConstrutor();
}

function pintarConstrutor() {
  const caixa = document.getElementById('auto-editor');
  if (!caixa) return;
  if (!RASCUNHO) { caixa.innerHTML = ''; ENSAIO_DO_RASCUNHO = ''; return; }
  // A lista de marcar que estava aberta continua aberta depois de redesenhar (cada escolha redesenha a folha).
  // O resultado do ensaio vale só para o desenho logo depois dele: qualquer mudança no rascunho o apaga.
  const ensaio = ENSAIO_DO_RASCUNHO; ENSAIO_DO_RASCUNHO = '';
  const abertaAntes = caixa.querySelector?.('details.rg2-varios[open]')?.dataset?.k || '';
  const r = RASCUNHO;
  const g = r.gatilho || {};

  const abas = [['status', 'um status mudar'], ['captacao', 'a captação mudar'], ['data', 'chegar uma data']]
    .map(([tipo, rotulo]) => `<button type="button" role="radio" aria-checked="${g.tipo === tipo}" onclick="trocarTipoDeGatilho('${tipo}')">${rotulo}</button>`).join('');

  let quandoCorpo = '';
  if (g.tipo === 'data') {
    const dias = [[-3, '3 dias antes'], [-2, '2 dias antes'], [-1, '1 dia antes'], [0, 'no próprio dia'], [1, '1 dia depois']];
    quandoCorpo = `<div class="rg2-par">
        ${campoDeEscolhaRegra('Qual data', `<select onchange="mexerNoRascunho('gatilho.campo',this.value)">
          <option value="prazo" ${g.campo === 'prazo' ? 'selected' : ''}>o prazo de produção</option>
          <option value="veiculacao" ${g.campo === 'veiculacao' ? 'selected' : ''}>a veiculação</option></select>`)}
        ${campoDeEscolhaRegra('Momento', `<select onchange="mexerNoRascunho('gatilho.dias',Number(this.value))">${dias.map(([v, t]) =>
          `<option value="${v}" ${Number(g.dias) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      </div>`;
  } else {
    const lista = g.tipo === 'captacao' ? 'captacao' : 'status';
    const qual = g.tipo === 'captacao' ? 'captação' : 'status';
    quandoCorpo = `<div class="rg2-par">
        ${campoDeEscolhaRegra(`Virar qual ${qual}?`, `<select onchange="mexerNoRascunho('gatilho.para',this.value)">${opcoesDoCatalogo(lista, g.para, (CATALOGOS[lista] || []).length ? 'escolha' : 'nada cadastrado')}</select>`)}
        ${campoDeEscolhaRegra('Vindo de qual? <small>· opcional</small>', `<select onchange="mexerNoRascunho('gatilho.de',this.value)">${opcoesDoCatalogo(lista, g.de, 'qualquer um')}</select>`)}
      </div>`;
  }

  const jaTem = (m) => (r.acoes || []).some((a) => a.tipo === m.tipo && (!m.modo || a.modo === m.modo));
  const acoes = (r.acoes || []).map((a, i) => {
    let escolha = '';
    if (a.tipo === 'grupo' || a.tipo === 'status' || a.tipo === 'captacao') {
      const lista = a.tipo === 'grupo' ? 'grupos' : a.tipo;
      escolha = escolhaDeUmRegra(`acao-${i}`, lista, a.para, `acoes.${i}.para`, 'escolha para onde');
    } else if (a.tipo === 'responsaveis') {
      escolha = escolhaDeVariosRegra(`acao-${i}`, 'pessoas', a.pessoas || [], `alternarPessoaDaAcao(${i},'{chave}')`, 'escolha quem', 'ninguém cadastrado', a.modo === 'replace' ? 'para ' : '');
    } else {
      escolha = `<input type="text" class="rg2-texto" aria-label="Texto" value="${safeText(a.texto || '')}"
        placeholder="${a.tipo === 'notificar' ? 'Sua entrega vence amanhã: {titulo} ({cliente}).' : 'Encaminhado para agendamento.'}"
        oninput="RASCUNHO.acoes[${i}].texto=this.value">`;
    }
    const titulo = ACOES_DISPONIVEIS.find((m) => m.tipo === a.tipo && (!m.modo || m.modo === a.modo))?.rotulo || a.tipo;
    return `<div class="rg2-acao"><span class="rg2-acao-meio"><b>${safeText(titulo)}</b>${escolha}</span>
        <button type="button" class="rg2-tirar" onclick="removerAcao(${i})" aria-label="Tirar esta ação" title="Tirar esta ação"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
  }).join('');
  const somar = ACOES_DISPONIVEIS.map((m, i) => (jaTem(m) ? '' : `<button type="button" class="rg2-somar" onclick="adicionarAcao(${i})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>${safeText(m.rotulo)}</button>`)).join('');

  const passo = (n, titulo, corpo) => `<div class="rg2-passo"><span class="rg2-n" aria-hidden="true">${n}</span><div class="rg2-passo-corpo"><b class="rg2-passo-t">${titulo}</b>${corpo}</div></div>`;
  const frase = fraseDoRascunhoHtml();
  const problema = problemaDoRascunho();

  caixa.innerHTML = `
    <section class="regra-v2" role="dialog" tabindex="-1" aria-label="${r.id ? 'Editar regra' : 'Nova regra'}">
      <div class="rg2-folha">
        <div class="rg2-cab"><h3><span>${r.id ? 'Editar regra' : 'Nova regra'}</span></h3><span>monta em frase · nada roda antes de ${r.id ? 'salvar' : 'criar'}</span></div>
        <div class="rg2-colunas">
          <div class="rg2-col">
            ${passo(1, 'Quando isto acontecer', `<span class="rg2-seg" role="radiogroup" aria-label="Quando isto acontecer">${abas}</span>${quandoCorpo}`)}
            ${passo(2, 'Só se… <small>· opcional</small>', `<div class="rg2-par">
              <div class="rg2-campo"><span class="rg2-rot">O formato for</span>${escolhaDeVariosRegra('formato', 'formatos', r.condicao?.formato_em || [], `alternarCondicao('formato_em','{chave}')`, 'qualquer formato', 'nenhum formato cadastrado')}</div>
              <div class="rg2-campo"><span class="rg2-rot">A peça estiver em</span>${escolhaDeVariosRegra('grupo', 'grupos', r.condicao?.grupo_em || [], `alternarCondicao('grupo_em','{chave}')`, 'qualquer grupo', 'nenhum grupo cadastrado')}</div>
            </div>`)}
            ${passo(4, 'Como ela vai se chamar', `<div class="rg2-par">
              <label class="rg2-campo"><span class="rg2-rot">Nome</span><input type="text" class="rg2-texto" id="auto-f-nome" value="${safeText(r.nome)}" placeholder="Ex.: agendou, vai ao Danilo" oninput="RASCUNHO.nome=this.value"></label>
              <label class="rg2-campo"><span class="rg2-rot">Ordem</span><input type="number" class="rg2-texto" value="${r.ordem}" oninput="RASCUNHO.ordem=Number(this.value)||50"><small class="rg2-dica">menor roda primeiro</small></label>
              ${campoDeEscolhaRegra('Ligada', `<select onchange="mexerNoRascunho('ativa',this.value==='1')"><option value="1" ${r.ativa ? 'selected' : ''}>sim, vale assim que criar</option><option value="0" ${r.ativa ? '' : 'selected'}>não, fica desligada</option></select>`)}
            </div>`)}
          </div>
          <div class="rg2-col">
            ${passo(3, 'Faça isto', `${acoes ? `<div class="rg2-acoes">${acoes}</div>` : '<p class="rg2-dica">Nenhuma ação ainda. Escolha a primeira abaixo.</p>'}${somar ? `<div class="rg2-somas">${somar}</div>` : ''}`)}
          </div>
        </div>
      </div>
      <aside class="rg2-lado" aria-label="Prévia da regra">
        <div class="rg2-bloco"><b class="rg2-bloco-t">A regra vai ficar assim</b>
          <div class="rg2-frase${frase ? '' : ' incompleta'}" aria-live="polite">${frase || 'Escolha o gatilho e pelo menos uma ação para ver a frase.'}${problema ? `<em class="rg2-problema">${safeText(problema)}</em>` : ''}</div></div>
        ${ensaio ? `<p class="rg2-ensaio" role="status">${safeText(ensaio)}</p>` : ''}
        <div class="rg2-botoes"><button type="button" class="v2g-btn rg2-fio" onclick="ensaiarRascunho()" title="Mostra o que a regra faria numa peça de teste, só na tela">Testar numa peça</button><button type="button" class="v2g-btn rg2-fio" onclick="fecharConstrutor()">Cancelar</button></div>
        <button type="button" class="v2g-btn k rg2-criar" onclick="salvarAutomacao()" ${problema ? `disabled title="${safeText(problema)}"` : ''}>${r.id ? 'Salvar alterações' : 'Criar regra'}</button>
        <div class="rg2-bloco"><span class="rg2-bloco-cab"><b class="rg2-bloco-t">Regras por data</b><span>rodam de madrugada</span></span><span class="rg2-bloco-p">Prazo de produção ou veiculação, de 3 dias antes a 1 dia depois.</span></div>
      </aside>
    </section>`;
  if (abertaAntes) caixa.querySelector(`details.rg2-varios[data-k="${abertaAntes}"]`)?.setAttribute('open', '');
  caixa.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
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
      showToast(`✓ Nada a mudar · ${previa.consideradas === 1 ? '1 peça já está' : `${previa.consideradas} peças já estão`} com a prioridade que a veiculação pede`, 'ok', 6000);
      return;
    }
    const faixas = Object.entries(previa.distribuicao || {})
      .map(([rotulo, quantas]) => `${quantas} ${rotulo}`).join(' · ');
    const sim = await perguntarNoPainel({
      titulo: `Recalcular a prioridade de ${previa.mudancas} peça${previa.mudancas === 1 ? '' : 's'}?`,
      texto: `De ${previa.consideradas === 1 ? '1 peça aberta' : `${previa.consideradas} peças abertas`} com data de veiculação, ${previa.ja_certas} já estão certas. Como fica o quadro depois: ${faixas}. O Monday recebe a cópia pela fila.`,
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

// ── "POR QUE NÃO RODOU?" ──────────────────────────────────────────────────────
//
// A pergunta mais feita da operação era a única que o painel não sabia
// responder. Quando uma regra rodava, aparecia um aviso; quando nenhuma rodava,
// aparecia silêncio — e silêncio era a mesma resposta para três coisas bem
// diferentes: nenhuma regra se aplica, a regra está desligada, e a regra escuta
// outra etiqueta. Quem marcava "Captação Feita" e não via nada acontecer não
// tinha como saber qual das três era, nem a quem perguntar.
//
// O motor de diagnóstico já existia no servidor e não tinha botão. Isto é o
// botão — e o servidor devolve fatos, não frases: a redação mora aqui, junto dos
// nomes das etiquetas, e é a mesma que descreve as regras na tela de Automações.

// Com o artigo junto, e nas duas formas: "de a captação" foi o que apareceu na
// tela quando a frase montava o "de" por fora. Guardar as duas evita a
// concordância feita com concatenação, que é onde esse erro nasce.
const O_CAMPO = { captacao: 'a captação', status: 'o status' };
const DO_CAMPO = { captacao: 'da captação', status: 'do status' };

function nomeDaEtiqueta(tipo, chave) {
  if (!chave) return '—';
  return tipo === 'captacao' ? nomeDeCaptacao(chave) : nomeDeStatus(chave);
}

// Nome de cada item conforme o campo — é o que separa "novo_grupo__1" de
// "Design & Edição" na frase que a pessoa lê.
function nomesDoCampo(campo, lista) {
  const nome = campo === 'formato' ? nomeDeFormato
    : campo === 'grupo' ? nomeDeGrupo
    : campo === 'captacao' ? nomeDeCaptacao
    : campo === 'status' ? nomeDeStatus
    : campo === 'quadro' ? ((id) => (String(id) === '8385559107' ? 'Solicitações' : 'Produção'))
    : ((v) => v);
  const nomes = (lista || []).map(nome).filter(Boolean);
  return nomes.length ? nomes.join(' ou ') : 'nada';
}

const ROTULO_DO_CAMPO = { formato: 'o formato', grupo: 'o grupo', captacao: 'a captação',
  status: 'o status', quadro: 'o quadro' };

// Uma recusa, em uma frase. Cada motivo leva a uma ação diferente de quem lê:
// condição é a peça que não serve, gatilho é a regra que não é sobre isto,
// desligada é escolha de alguém, e interrompida é outra regra que chegou antes.
function frasearRecusa(d, tipo) {
  const campo = ROTULO_DO_CAMPO[d.campo] || d.campo;
  if (d.motivo === 'desligada') return 'está desligada.';
  if (d.motivo === 'interrompida') {
    return `não chegou a ser avaliada: “${d.por}” moveu a peça de grupo antes dela.`;
  }
  if (d.motivo === 'gatilho') {
    if (d.campo === 'para') {
      return `só roda quando ${O_CAMPO[tipo] || 'o campo'} virar “${nomeDaEtiqueta(tipo, d.exigido)}”`
        + ` — e virou “${nomeDaEtiqueta(tipo, d.tem)}”.`;
    }
    if (d.campo === 'de') {
      return `só roda saindo de “${nomeDaEtiqueta(tipo, d.exigido)}”`
        + (d.tem ? ` — esta peça vinha de “${nomeDaEtiqueta(tipo, d.tem)}”.`
                 : ' — e não há registro de onde esta peça vinha.');
    }
    return 'escuta outro tipo de mudança.';
  }
  // condição
  if (d.modo === 'nenhum_de') {
    return `não vale quando ${campo} é ${nomesDoCampo(d.campo, d.exigido)}`
      + ` — e esta peça é ${nomesDoCampo(d.campo, d.tem)}.`;
  }
  if (d.modo === 'todos_de') {
    return `pede que ${campo} seja só ${nomesDoCampo(d.campo, d.exigido)}`
      + ` — esta peça tem ${nomesDoCampo(d.campo, d.tem)}.`;
  }
  return `pede que ${campo} seja ${nomesDoCampo(d.campo, d.exigido)}`
    + ` — esta peça está com ${nomesDoCampo(d.campo, d.tem)}.`;
}

// O que a regra FARIA, para quem vê que ela se aplica e ainda assim nada mudou.
function frasearOQueFaria(acoes) {
  const partes = (acoes || []).map(frasearAcao).filter(Boolean);
  return partes.length ? partes.join(', ') : 'nada (regra sem ação)';
}

function blocoDoDiagnostico(r, tipo) {
  const e = r.evento || {};
  let contexto;
  if (e.origem === 'sem histórico') {
    // Sem particípio no fim: "sem a captação preenchida" vira "sem o status
    // preenchida" no outro caso, e concordância remendada é o mesmo erro de novo.
    contexto = `Esta peça está sem ${O_CAMPO[tipo] || 'o campo'},`
      + ' então não houve mudança para nenhuma regra escutar.';
  } else if (e.origem === 'estado atual') {
    contexto = `Não há registro no painel de quem mudou ${O_CAMPO[tipo] || 'o campo'} desta peça — ela`
      + ` provavelmente veio assim do Monday. Lendo como está hoje: “${nomeDaEtiqueta(tipo, e.para)}”.`;
  } else {
    const quando = quandoNaBahia(e.em);
    contexto = `A última mudança ${DO_CAMPO[tipo] || 'do campo'} nesta peça foi`
      + (e.de ? ` de “${nomeDaEtiqueta(tipo, e.de)}”` : '')
      + ` para “${nomeDaEtiqueta(tipo, e.para)}”${quando ? `, em ${safeText(quando)}` : ''}.`;
  }

  if (e.origem === 'sem histórico') {
    return `<p class="auto-diag-evento">${safeText(contexto)}</p>`;
  }

  const rodam = (r.dispararia || []).map((a) => `<li class="roda">
    <span class="auto-diag-marca">✓</span>
    <span><b>${safeText(a.nome)}</b> — ${safeText(frasearOQueFaria(a.acoes))}.</span></li>`).join('');
  const barradas = (r.descartadas || []).map((d) => `<li class="barrada">
    <span class="auto-diag-marca">·</span>
    <span><b>${safeText(d.nome)}</b> — ${safeText(frasearRecusa(d, tipo))}</span></li>`).join('');

  // "Se aplica e mesmo assim nada mudou" é outro problema, e a resposta dele está
  // no histórico de execuções — não em mais uma leitura das regras.
  const aviso = rodam
    ? `<p class="workspace-note">Se essas regras se aplicam e ainda assim nada mudou na peça,
        o problema não é a regra: é a execução. O histórico de cada uma fica na tela de Automações.</p>`
    : (barradas ? '' : `<p class="workspace-note">Nenhuma regra foi escrita para essa mudança.
        É isso: não é defeito, é que não existe regra para esse caso.</p>`);

  return `<p class="auto-diag-evento">${safeText(contexto)}</p>
    ${rodam ? `<p class="auto-diag-titulo">SE APLICAM (${(r.dispararia || []).length})</p>
      <ul class="auto-diag-lista">${rodam}</ul>` : ''}
    ${barradas ? `<p class="auto-diag-titulo">NÃO PEGARAM ESTA PEÇA (${(r.descartadas || []).length})</p>
      <ul class="auto-diag-lista">${barradas}</ul>` : ''}
    ${aviso}`;
}

async function diagnosticarAutomacao(itemId, botao) {
  const rotuloOriginal = botao?.textContent;
  if (botao) { botao.disabled = true; botao.textContent = 'verificando…'; }
  try {
    // Os nomes das etiquetas vêm antes: sem eles a explicação sai em chave de
    // banco, e "captacao_feita" não é como ninguém aqui chama a etiqueta.
    await garantirRegrasECatalogos();
    const pedir = async (tipo) => {
      const r = await fetch(`${AUTOMACOES_API}&acao=simular`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo_id: String(itemId), evento: { tipo } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      return d;
    };
    // As duas perguntas de uma vez: quem mexeu na captação e quem mexeu no status
    // fazem a MESMA pergunta, e obrigar a escolher o tipo seria pedir que a
    // pessoa soubesse de antemão qual das duas a regra escutava.
    const [captacao, status] = await Promise.all([pedir('captacao'), pedir('status')]);
    const titulo = captacao.item?.titulo || status.item?.titulo || 'esta peça';
    openWorkflowModal(`<div class="workflow-kicker"><span>Vybe OS · Automações</span>
        <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
      <h2 class="workflow-title">Por que não rodou?</h2>
      <p class="workflow-copy">${safeText(titulo)}</p>
      <p class="auto-diag-titulo">PELA CAPTAÇÃO</p>
      ${blocoDoDiagnostico(captacao, 'captacao')}
      <p class="auto-diag-titulo">PELO STATUS</p>
      ${blocoDoDiagnostico(status, 'status')}
      <div class="workflow-actions">
        ${[7829537690,8385559107].includes(Number(status.item?.board_id)) && /^\d+$/.test(status.evento?.ocorrencia || '') ? `<button type="button" class="workflow-secondary" data-item="${safeText(String(itemId))}" data-evento="${safeText(status.evento.ocorrencia)}" onclick="retomarEncaminhamentoDaPeca(this.dataset.item,this.dataset.evento,this)">Tentar encaminhamento novamente</button>` : ''}
        <button type="button" class="workflow-primary" onclick="closeWorkflowModal()">Entendi</button>
      </div>`);
  } catch (erro) {
    showToast(`Não foi possível verificar as automações: ${erro.message}`, 'err', 7000);
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = rotuloOriginal; }
  }
}

// Reutiliza o diagnóstico e a escrita nativa; não cria outro evento de status.
async function retomarEncaminhamentoDaPeca(itemId, ocorrencia, botao) {
  const item = findOperationalItem(itemId);
  if (statusEmGravacao.has(String(itemId))) return;
  statusEmGravacao.add(String(itemId));
  const drawer = document.getElementById('workspace-drawer');
  const modal = document.getElementById('workflow-modal');
  let salvo = false;
  if (botao) botao.disabled = true;
  try {
    const r = await tentarEscritaDupla(item,{acao:'retomar_encaminhamento',item:String(itemId),ocorrencia:String(ocorrencia),_devolve:true});
    if (!r) throw new Error('O banco não confirmou o encaminhamento.');
    salvo = true;
    if (item && r.depois?.status) updateLocalStatus(itemId,{label:r.depois.status,color:r.depois.status_color,border:r.depois.status_border,index:r.depois.status_index});
    if (item) aplicarEfeitoDaAutomacao(item,r);
    renderOutboundItemPatch('encaminhamento');
    if (document.getElementById('workflow-modal') === modal) closeWorkflowModal();
    showToast(r.ja_aplicada ? 'Este encaminhamento já foi aplicado; nenhuma ação foi duplicada.' : r.automacoes?.length ? 'Encaminhamento concluído.' : 'Nenhuma regra ativa se aplica a esta etapa. Confira o diagnóstico.', r.automacoes?.length ? 'ok' : 'info',8000);
    if (item) await atualizarGavetaPreservandoRascunhos(item,drawer);
  } catch (erro) {
    showToast(salvo ? 'Encaminhamento confirmado. Reabra a atividade para atualizar os detalhes.' : `Não foi possível retomar: ${erro.message}`, salvo ? 'info' : 'err',9000);
  } finally {
    statusEmGravacao.delete(String(itemId)); if (botao) botao.disabled = false;
    if (document.getElementById('auto-falhas-lista')) await carregarFalhasAutomacoes();
  }
}
