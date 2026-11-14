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
  if (raiz) raiz.innerHTML = vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando as regras' });
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
    if (raiz) raiz.innerHTML = vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível carregar as automações', texto: erro.message,
      acao: '<button type="button" class="vb-botao" onclick="carregarAutomacoes()">Tentar de novo</button>' });
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
// Quadro 11 do redesign (10/11/2026): as regras vêm primeiro, cada uma numa linha
// "Quando… então…" com liga/desliga e quantas vezes rodou; as falhas ficam numa aba
// própria com a contagem; Recalcular e Sincronizar vão para o "Mais" e a ação
// principal é "Nova regra"; a explicação da Prioridade vira dica no ⓘ.
const ICONE_MAIS_AUTOMACOES = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const DICA_PRIORIDADE = 'A coluna Prioridade não é escrita à mão: é o espelho da veiculação. Atrasado, hoje ou amanhã é Crítica; 2 a 3 dias, Alta; 4 a 7 dias, Média; 8 dias ou mais, Baixa. Sobe e desce sozinha na varredura da madrugada; peça finalizada ou sem veiculação não é tocada.';
const DICA_REGRAS_DE_DATA = 'As regras por data rodam numa varredura por dia, de madrugada, e não na hora que estiver escrita nelas.';

// Quadro "Automações" do padrão v2 (moodboard aprovado, 12/11/2026): título com Regras/Falhas, Mais e Nova regra; a
// frase de quem cuida (Cícero); os números; "Pede ação" e "Últimas ações" à esquerda; à direita as regras,
// cada uma numa linha com a chave, o nome com a frase "Quando… então…", as ações e "Testar"; a linha abre no lugar.
const ICONE_SETA_REGRA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const REGRAS_NA_FRENTE = 4, ACOES_NA_FRENTE = 4, PEDIDOS_NA_FRENTE = 3;
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

function pintarAutomacoes() {
  const raiz = document.getElementById('automacoes-root');
  if (!raiz) return;
  raiz.classList.add('v2r');
  const admin = podeEditarAutomacoes();
  const comSaude = regrasComSaude();
  const temRegraDeData = AUTOMACOES.some((a) => a.gatilho?.tipo === 'data' && a.ativa);
  const dica = (rotulo, texto) => `<span class="ar-dica vb-jogo-dica" tabindex="0" data-dica="${safeText(texto)}" title="${safeText(texto)}">${rotulo}<span class="ar-dica-i" aria-hidden="true">i</span></span>`;
  const mais = admin ? `<details class="vga-mais ar-mais"><summary class="v2g-btn">Mais ${ICONE_MAIS_AUTOMACOES}</summary>
      <div class="vga-mais-menu">
        <button type="button" onclick="this.closest('details').open=false;recalcularPrioridadesAgora(this)"
          title="Refaz a coluna Prioridade de todas as peças a partir da veiculação. Roda sozinho toda madrugada; isto aqui é para não esperar.">Recalcular prioridades</button>
        <button type="button" onclick="this.closest('details').open=false;sincronizarRegrasDoSistema(this)"
          title="Traz para o painel as regras que vieram do Monday, corrigindo as que mudaram. Regra criada aqui não é tocada.">Sincronizar regras do sistema</button>
      </div></details>` : '';
  // Direção 3: o único laranja cheio é o bloco de ação; "Nova regra" fica preta, com o +.
  const novo = admin ? '<button type="button" class="v2g-btn k auto-novo" onclick="editarAutomacao(null)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nova regra</button>' : '';
  const regras = ABA_DE_AUTOMACOES !== 'falhas';
  // Regras/Falhas como par de opções (aria-checked): o "selecionado é preto" do painel antigo vale para aria-pressed.
  const abas = `<div class="v2g-seg ar-abas" role="radiogroup" aria-label="Regras ou falhas">
        <button type="button" role="radio" aria-checked="${regras}" onclick="trocarAbaAutomacoes('regras')">Regras <span class="ar-n">${comSaude.length}</span></button>
        <button type="button" role="radio" aria-checked="${!regras}" onclick="trocarAbaAutomacoes('falhas')">Falhas <span class="ar-n" id="auto-aba-falhas-n">…</span></button>
      </div>`;
  const semRegra = !comSaude.length;

  raiz.innerHTML = `
    ${vbCabecalhoHtml({ titulo: 'Automações', texto: 'Gestão', acoes: abas + mais + novo })}
    <section class="ar-aba v2r-tela" data-aba="regras" aria-label="Regras" ${regras ? '' : 'hidden'}>
      ${semRegra ? '' : '<div class="d3t-auto-acao" id="auto-fala"></div><div class="v2r-kpis d3t-nums" id="auto-kpis"></div>'}
      <div id="auto-editor"></div>
      ${semRegra ? `<div class="v2g-card v2r-vazio"><p>Nenhuma regra ainda. Uma regra move, atribui ou avisa sozinha quando uma peça muda.${admin ? '' : ' Quando quem administra criar uma regra, ela aparece aqui.'}</p>${novo}</div>
      <div id="auto-historico" hidden></div>` : `<div class="v2r-grade">
        <div class="v2r-col">
          <div class="v2g-card" id="auto-pede"></div>
          <div class="v2g-card v2r-fez">
            <div class="v2g-cab"><h3 class="v2g-h2">Últimas ações</h3><span class="v2g-sub" id="auto-historico-n"></span></div>
            <div id="auto-historico" class="v2r-hist">${vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando o registro' })}</div>
          </div>
        </div>
        <div class="v2g-card v2r-regras">
          <div class="v2g-cab"><h3 class="v2g-h2">Regras</h3><span class="v2r-dicas">${temRegraDeData ? dica('por data, de madrugada', DICA_REGRAS_DE_DATA) : ''}${dica('prioridade automática', DICA_PRIORIDADE)}</span></div>
          <div class="v2r-filtros">
            <label for="auto-busca" class="v2g-fora">Buscar regra</label>
            <input class="v2g-busca" id="auto-busca" type="search" placeholder="Buscar regra" autocomplete="off" value="${safeText(BUSCA_DE_REGRAS)}" oninput="buscarRegras(this.value)">
            <span class="v2r-chips" id="auto-regras-chips" role="group" aria-label="Filtrar regras"></span>
          </div>
          <div id="auto-regras-lista" class="v2r-lista"></div>
        </div>
      </div>`}
    </section>
    <section class="ar-aba v2g-card v2r-falhas" data-aba="falhas" aria-label="Encaminhamentos com falha" ${regras ? 'hidden' : ''}>
      <div class="ar-falhas-topo"><p>Status de Produção e Demandas que não conseguiram seguir. As resolvidas ficam no histórico; até 100, com as pendentes primeiro.</p>
        <button type="button" class="v2g-btn s" onclick="carregarFalhasAutomacoes()">Atualizar</button></div>
      <div id="auto-falhas-lista" aria-live="polite">${vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando as falhas' })}</div>
    </section>`;
  pintarResumoDasAutomacoes();
  pintarListaDeRegras();
}

// A frase do agente, os três números e o "Pede ação": repintam quando as falhas chegam, sem mexer na lista nem na busca.
function pintarResumoDasAutomacoes() {
  const fala = document.getElementById('auto-fala'), kpis = document.getElementById('auto-kpis'), pede = document.getElementById('auto-pede');
  if (!fala || !kpis || !pede) return;
  const admin = podeEditarAutomacoes(), comSaude = regrasComSaude();
  const n = (v) => Number(v).toLocaleString('pt-BR');
  const ligadas = comSaude.filter((a) => a.ativa).length;
  const acoes = comSaude.reduce((t, a) => t + Number(a.execucoes_30_dias || 0), 0);
  const lendo = FALHAS_DE_AUTOMACOES === null;
  const pendentes = (FALHAS_DE_AUTOMACOES || []).filter((f) => f.estado === 'pendente');
  // Quantas vezes rodaram, em 30 dias, as regras que movem, que atribuem e que avisam (uma regra pode fazer mais de uma coisa).
  const rodaram = (tipos) => comSaude.filter((a) => (a.acoes || []).some((x) => tipos.includes(x.tipo))).reduce((t, a) => t + Number(a.execucoes_30_dias || 0), 0);
  const partes = [[rodaram(['grupo']), 'moveram'], [rodaram(['responsaveis']), 'atribuíram'], [rodaram(['notificar', 'update']), 'avisaram'], [rodaram(['status', 'captacao']), 'mudaram etiqueta']]
    .filter(([q]) => q).map(([q, rotulo]) => `${n(q)} ${rotulo}`).join(' · ');
  const agente = nomeDoAgenteDeAutomacao();

  // Direção 3 (quadro D3-Automacoes): o bloco de ação laranja com a frase do agente e "Ver as N" quando há falha; quatro
  // números (ligadas com a barra, ações, por tipo em barras e falhas). Sem falha, a frase diz o que as regras fizeram.
  const fez = !ligadas ? 'Nenhuma regra ligada: nada se move sozinho.'
    : `${ligadas === 1 ? 'A regra ligada fez' : `${ligadas} regras ligadas fizeram`} ${n(acoes)} ${acoes === 1 ? 'ação' : 'ações'} em 30 dias.`;
  const motivos = [...new Set(pendentes.map((f) => String(f.motivo || '').trim()).filter(Boolean))];
  const falhou = pendentes.length
    ? `${pendentes.length === 1 ? '1 falha espera' : `${pendentes.length} falhas esperam`} alguém${motivos.length === 1 ? `: ${safeText(motivos[0])}` : ''}.` : '';
  const agenteLetra = safeText(agente.slice(0, 1).toUpperCase());
  fala.innerHTML = `<section class="d3-acao" aria-label="O que pede ação agora"><span class="d3-acao-av" aria-hidden="true">${agenteLetra}</span>
    <span class="d3-acao-frase"><small class="d3t-quem">${safeText(agente)} · Automação</small>${falhou || fez}</span>
    ${pendentes.length ? `<button type="button" class="d3-acao-btn" onclick="trocarAbaAutomacoes('falhas')">${pendentes.length === 1 ? 'Ver a falha' : `Ver as ${pendentes.length}`}</button>` : ''}</section>`;

  const num = (rotulo, valor, sub, { tom = '', barra = null, extra = '' } = {}) => `<div class="d3-num${tom ? ' ' + tom : ''}"><span class="d3-num-rot">${rotulo}</span><b class="d3-num-v">${valor}</b>${barra == null ? '' : `<span class="d3-barra" style="--v:${Math.max(0, Math.min(100, Math.round(barra)))}%"><i></i></span>`}${extra}${sub ? `<span class="d3t-sub">${sub}</span>` : ''}</div>`;
  const tipos = [[rodaram(['grupo']), 'moveram'], [rodaram(['responsaveis']), 'atribuíram'], [rodaram(['notificar', 'update']), 'avisaram'], [rodaram(['status', 'captacao']), 'etiqueta']];
  const maxTipo = Math.max(1, ...tipos.map(([q]) => q));
  const porTipo = `<div class="d3-num d3t-tipos"><span class="d3-num-rot">Por tipo · 30 dias</span>${tipos.filter(([q], i) => q || i < 3).map(([q, rotulo]) => `<span class="d3t-tipo"><span>${rotulo}</span><span class="d3-barra" style="--v:${Math.round(q / maxTipo * 100)}%"><i></i></span><b>${n(q)}</b></span>`).join('')}</div>`;
  kpis.innerHTML = num('Regras ligadas', `${ligadas}<small> / ${comSaude.length}</small>`, admin ? '' : 'só quem administra altera', { barra: comSaude.length ? ligadas / comSaude.length * 100 : 0 })
    + num('Ações em 30 dias', n(acoes), partes ? 'sem ninguém tocar' : 'nenhuma no período')
    + porTipo
    + num('Falhas', lendo ? '…' : String(pendentes.length), lendo ? 'consultando' : pendentes.length ? 'esperando alguém' : 'nenhuma', { tom: pendentes.length ? 'r' : '' });

  const itens = [
    ...pendentes.map((f) => `<div class="v2g-lin v2r-pede"><span class="v2g-pill r">Falhou</span><p><b>${safeText(f.titulo)}</b> · ${safeText(f.motivo)}${f.clientes ? ` · ${safeText(f.clientes)}` : ''}</p>
      <span class="v2r-pede-acoes"><button type="button" class="v2g-btn s" data-item="${safeText(f.item)}" onclick="diagnosticarAutomacao(this.dataset.item,this)">Ver diagnóstico</button>
      <button type="button" class="v2g-btn s" data-item="${safeText(f.item)}" data-evento="${safeText(f.ocorrencia)}" onclick="retomarEncaminhamentoDaPeca(this.dataset.item,this.dataset.evento,this)">Tentar de novo</button></span></div>`),
    ...comSaude.filter((a) => a.saude.chave === 'desligada').map((a) => `<div class="v2g-lin"><span class="v2g-pill a">Desligada</span><p><b>${safeText(a.nome)}</b> · ${safeText(a.saude.detalhe)}</p>
      ${admin ? `<button type="button" class="v2g-btn s" onclick="alternarAutomacao(${a.id})">Ligar</button>` : ''}</div>`),
    ...comSaude.filter((a) => a.saude.chave === 'parada').map((a) => `<div class="v2g-lin"><span class="v2g-pill a">Parada</span><p><b>${safeText(a.nome)}</b> · ${safeText(a.saude.detalhe)}</p>
      <button type="button" class="v2g-btn s" onclick="abrirRegra(${a.id},true)">Abrir</button></div>`),
  ];
  const mostra = PEDE_ACAO_INTEIRO ? itens : itens.slice(0, PEDIDOS_NA_FRENTE);
  pede.innerHTML = `<div class="v2g-cab"><h3 class="v2g-h2">Pede ação</h3><span class="v2g-sub">${itens.length ? `${itens.length} ${itens.length === 1 ? 'coisa' : 'coisas'}` : ''}</span></div>
    ${mostra.join('') || `<p class="v2g-sub v2r-nada">${lendo ? 'Conferindo as falhas…' : 'Nada pede ação agora.'}</p>`}
    ${itens.length > PEDIDOS_NA_FRENTE ? `<p class="v2g-sub v2r-pe">${PEDE_ACAO_INTEIRO ? '' : `+ ${itens.length - mostra.length} · `}<a href="#" role="button" class="v2g-link" onclick="mostrarTodoOPedeAcao(${!PEDE_ACAO_INTEIRO});return false">${PEDE_ACAO_INTEIRO ? 'recolher' : 'mostrar'}</a></p>` : ''}`;
}
function mostrarTodoOPedeAcao(sim) { PEDE_ACAO_INTEIRO = Boolean(sim); pintarResumoDasAutomacoes(); }
// A consulta das falhas terminou (ou falhou: lista vazia para a tela não ficar em "consultando").
function aoLerFalhasDeAutomacoes(falhas) { FALHAS_DE_AUTOMACOES = Array.isArray(falhas) ? falhas : []; pintarResumoDasAutomacoes(); }

function linhaDaRegraHtml(a, admin) {
  const s = a.saude, nome = safeText(a.nome), aberta = REGRA_ABERTA === Number(a.id);
  const condicao = frasearCondicao(a.condicao);
  const acoes = (a.acoes || []).map((x) => safeText(frasearAcao(x))).join(' e ') || '—';
  const total = Number(a.execucoes_total || 0);
  const selo = { desligada: ['n', 'Desligada'], parada: ['a', 'Parada'], nunca: ['n', 'Nunca rodou'] }[s.chave];
  const liga = admin
    ? `<button type="button" class="v2g-tg" role="switch" aria-checked="${a.ativa ? 'true' : 'false'}"
        aria-label="Regra ${nome} ${a.ativa ? 'ligada' : 'desligada'}" title="${a.ativa ? 'Ligada: clique para desligar' : 'Desligada: clique para ligar'}"
        onclick="alternarAutomacao(${a.id})"></button>`
    : `<span class="v2g-pill ${a.ativa ? 'g' : 'n'}">${a.ativa ? 'Ligada' : 'Desligada'}</span>`;
  const ultima = (EXECUCOES || []).find((e) => e.automacao === a.nome);
  const saude = s.rotulo.charAt(0).toUpperCase() + s.rotulo.slice(1) + (s.detalhe ? ` · ${s.detalhe}` : '');
  return `
    <div class="v2-abre v2r-regra${a.ativa ? '' : ' desligada'}" data-regra="${Number(a.id)}" aria-expanded="${aberta}">
      <div class="v2r-lin">
        ${liga}
        <button type="button" class="v2r-nome" aria-expanded="${aberta}" title="Abrir a regra" onclick="abrirRegra(${a.id})"><b>${nome}</b>
          <span class="v2r-qe"><em>Quando</em> ${safeText(frasearGatilho(a.gatilho))}${condicao
          ? ` <em>só se</em> ${safeText(condicao)}` : ''} ${ICONE_SETA_REGRA}<em>então</em> ${acoes}</span></button>
        ${selo && (admin || s.chave !== 'desligada') ? `<span class="v2g-pill ${selo[0]}">${selo[1]}</span>` : ''}
        <span class="v2g-sub v2r-n">${total.toLocaleString('pt-BR')} ${total === 1 ? 'ação' : 'ações'}</span>
        ${admin ? `<button type="button" class="v2g-btn s v2-estado" title="Ver o que ela faria, sem mexer em nada" aria-label="Testar regra ${nome}" onclick="ensaiarAutomacao(${a.id},this)">Testar</button>` : ''}
      </div>
      <div class="v2-mais"><div>
        <p class="v2g-hist">${safeText(saude)}</p>
        ${ultima ? `<p class="v2g-hist">A última ação foi em ${safeText(ultima.titulo || 'conteúdo removido')}, ${safeText(quandoFoiAutomacao(new Date(ultima.em)))}</p>` : ''}
        ${admin ? `<p class="v2g-hist"><span><a href="#" role="button" class="v2g-link" onclick="editarAutomacao(${a.id});return false">Editar a regra</a> · <a href="#" role="button" class="v2g-link" onclick="excluirAutomacao(${a.id});return false">excluir</a></span></p>` : ''}
      </div></div>
    </div>`;
}

// As fichas do filtro e as linhas: repintam sozinhas, para a busca não perder o foco a cada letra.
function pintarListaDeRegras() {
  const chips = document.getElementById('auto-regras-chips'), lista = document.getElementById('auto-regras-lista');
  if (!chips || !lista) return;
  const admin = podeEditarAutomacoes(), comSaude = regrasComSaude();
  const conta = (f) => comSaude.filter(f).length;
  const chip = ([chave, rotulo, n]) => `<button type="button" class="v2g-chip" onclick="filtrarRegras('${chave}')" aria-pressed="${FILTRO_DE_REGRAS === chave}">${rotulo} <b>${n}</b></button>`;
  const saude = [['trabalhando', 'Trabalhando'], ['parada', 'Paradas'], ['nunca', 'Nunca rodaram']]
    .map(([chave, rotulo]) => [chave, rotulo, conta((a) => a.saude.chave === chave)]).filter(([, , n]) => n);
  const comSaudeAberta = FILTROS_DE_SAUDE || saude.some(([chave]) => chave === FILTRO_DE_REGRAS);
  chips.innerHTML = [['todas', 'Todas', comSaude.length], ['ligada', 'Ligadas', conta((a) => a.ativa)], ['desligada', 'Desligadas', conta((a) => !a.ativa)]].map(chip).join('')
    + (saude.length ? `<button type="button" class="v2g-btn s" aria-expanded="${comSaudeAberta}" onclick="abrirFiltrosDeRegras()">Filtros</button>` : '')
    + (saude.length && comSaudeAberta ? `<span class="v2r-saude">${saude.map(chip).join('')}</span>` : '');

  const visiveis = comSaude.filter(regraNoRecorte);
  const recorte = FILTRO_DE_REGRAS !== 'todas' || Boolean(BUSCA_DE_REGRAS.trim());
  // A regra aberta nunca fica escondida no "+ N recolhidas".
  const frente = visiveis.slice(0, REGRAS_NA_FRENTE);
  const mostra = TODAS_AS_REGRAS || recorte ? visiveis : [...frente, ...visiveis.slice(REGRAS_NA_FRENTE).filter((a) => Number(a.id) === REGRA_ABERTA)];
  const resto = visiveis.length - mostra.length;
  const pe = resto > 0 ? `+ ${resto} ${resto === 1 ? 'regra recolhida' : 'regras recolhidas'} · <a href="#" role="button" class="v2g-link" onclick="mostrarTodasAsRegras(true);return false">mostrar</a> · `
    : TODAS_AS_REGRAS && !recorte && visiveis.length > REGRAS_NA_FRENTE ? '<a href="#" role="button" class="v2g-link" onclick="mostrarTodasAsRegras(false);return false">recolher</a> · ' : '';
  lista.innerHTML = mostra.length
    ? mostra.map((a) => linhaDaRegraHtml(a, admin)).join('') + `<p class="v2g-sub v2r-pe">${pe}clicar na regra abre${admin ? ' e edita' : ''}</p>`
    : '<p class="v2g-sub v2r-nada">Nenhuma regra neste recorte. <a href="#" role="button" class="v2g-link" onclick="limparRecorteDeRegras();return false">Ver todas</a></p>';
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
  if (manter && !lista.querySelector(`[data-regra="${Number(id)}"]`)) pintarListaDeRegras();
  lista.querySelectorAll('.v2r-regra').forEach((linha) => {
    const aberta = Number(linha.dataset.regra) === REGRA_ABERTA;
    linha.setAttribute('aria-expanded', String(aberta));
    linha.querySelector('.v2r-nome')?.setAttribute('aria-expanded', String(aberta));
    if (aberta && manter) linha.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function trocarAbaAutomacoes(aba) {
  ABA_DE_AUTOMACOES = aba === 'falhas' ? 'falhas' : 'regras';
  const raiz = document.getElementById('automacoes-root');
  if (!raiz) return;
  raiz.querySelectorAll('.ar-abas button').forEach((b, i) => b.setAttribute('aria-checked', String((i === 1) === (ABA_DE_AUTOMACOES === 'falhas'))));
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
  caixa.innerHTML = '<p class="auto-carregando">Carregando falhas…</p>';
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
    if (!falhas.length) { caixa.innerHTML = '<p class="auto-carregando">Nenhuma falha de encaminhamento registrada.</p>'; return; }
    const data = valor => new Date(valor).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const nomes = {pendente:'Pendente',resolvida:'Resolvida',superada:'Etapa alterada',removida:'Atividade removida'};
    caixa.innerHTML = `<p class="auto-sub">Exibindo ${falhas.length} de ${Number(falhas[0].total) || falhas.length} ocorrências.</p>` + falhas.map(f => `
      <article class="auto-falha-linha">
        <div class="auto-falha-peca">${safeText(f.titulo)}<small>${safeText(f.clientes)}</small>
          <small>${safeText(f.status_anterior || '—')} → ${safeText(f.status_destino || '—')}</small></div>
        <div class="auto-falha-motivo"><strong>${safeText(nomes[f.estado] || 'Indisponível')}</strong>
          <p>${safeText(f.motivo)}</p><small>${Number(f.tentativas)} tentativa(s) com falha · ${safeText(data(f.ultima_falha_em))}</small>
          ${f.resolvida_em ? `<small>Resolvida em ${safeText(data(f.resolvida_em))}</small>` : f.estado === 'superada' ? '<small>A etapa atual impede retomar este evento antigo.</small>' : ''}</div>
        <div class="auto-falha-acoes">
          ${f.estado !== 'removida' ? `<button type="button" class="auto-sincronizar" data-item="${safeText(f.item)}" onclick="diagnosticarAutomacao(this.dataset.item,this)">Ver diagnóstico</button>` : ''}
          ${f.estado === 'pendente' ? `<button type="button" class="auto-sincronizar" data-item="${safeText(f.item)}" data-evento="${safeText(f.ocorrencia)}" onclick="retomarEncaminhamentoDaPeca(this.dataset.item,this.dataset.evento,this)">Tentar novamente</button>` : ''}
        </div>
      </article>`).join('');
  } catch (erro) {
    if (document.getElementById('auto-falhas-lista') === caixa && caixa.dataset.pedido === pedido) {
      contagem('!', 'Não foi possível consultar as falhas');
      if (typeof aoLerFalhasDeAutomacoes === 'function') aoLerFalhasDeAutomacoes([]);
      caixa.innerHTML = `<p class="auto-carregando" role="alert">Não foi possível consultar as falhas. ${safeText(erro.message)}</p><button type="button" class="v2g-btn s" onclick="carregarFalhasAutomacoes()">Tentar de novo</button>`;
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
    if (caixa) caixa.innerHTML = vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível ler o registro', texto: erro.message,
      acao: '<button type="button" class="vb-botao" onclick="carregarHistorico()">Tentar de novo</button>' });
  }
}

function pintarHistorico() {
  const caixa = document.getElementById('auto-historico');
  if (!caixa) return;
  const contagem = document.getElementById('auto-historico-n');
  if (!EXECUCOES.length) {
    caixa.innerHTML = '<p class="v2g-sub v2r-nada">Nenhuma regra disparou ainda.</p>';
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
    return `<div class="v2g-lin" title="${safeText(`${e.automacao || ''} · ${gatilho}`)}">
      <span class="v2g-pill ${tom}">${selo}</span>
      <p><b>${safeText(e.titulo || '(conteúdo removido)')}</b> · ${(e.feitas || []).map((f) => safeText(traduzirFeita(f))).join(' · ') || '—'}${HISTORICO_INTEIRO
        ? `<small>${safeText(e.automacao || '')} · ${safeText(gatilho)}</small>` : ''}</p>
      <span class="v2g-sub">${dia}${hora}</span>
    </div>`;
  }).join('') + (EXECUCOES.length > ACOES_NA_FRENTE
    ? `<p class="v2g-sub v2r-pe">${HISTORICO_INTEIRO ? '' : `+ ${EXECUCOES.length - mostra.length} ${EXECUCOES.length - mostra.length === 1 ? 'ação' : 'ações'} · `}<a href="#" role="button" class="v2g-link" onclick="mostrarHistoricoInteiro(${!HISTORICO_INTEIRO});return false">${HISTORICO_INTEIRO ? 'recolher' : 'mostrar'}</a></p>` : '');
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

function editarAutomacao(id) {
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
