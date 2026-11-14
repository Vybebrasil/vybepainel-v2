// vybe-conta.js — a própria conta e, para quem administra, a equipe.
//
// Antes isto não existia: trocar senha era "pede ao Paulo", e ele resolvia
// direto no banco. Liberar alguém novo, idem.

const CONTA_API = '/api/painel?area=conta';
const PESSOAS_API = '/api/painel?area=pessoas';
const CLIENTES_API = '/api/painel?area=clientes';
const OPCOES_API = '/api/painel?area=opcoes';
const ACESSOS_API = '/api/painel?area=acessos';

let EQUIPE = [];
let CLIENTES = [];
let OPCOES = null;
let ACESSOS = [];
let MINHA_CONTA = null;
let CONTA_AI = { carregando: true };

function ehAdmin() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
}

let ERROS_DA_CONTA = {};
let CONTA_CARGA = 0;
async function carregarConta() {
  const raiz = document.getElementById('conta-root');
  if (!raiz) return;
  const carga = ++CONTA_CARGA;
  raiz.innerHTML = '<div class="auto-carregando" role="status">Carregando…</div>';
  EQUIPE = []; CLIENTES = []; OPCOES = null; ACESSOS = []; MINHA_CONTA = null;
  ERROS_DA_CONTA = {};
  clearTimeout(CONTA_AI.expiracao);
  CONTA_AI = { carregando: true };
  const ler = async (url, campo) => {
    const r = await fetch(url, { credentials:'same-origin', cache:'no-store' });
    if (!r.ok) throw new Error('Não foi possível carregar.');
    const d = await r.json();
    const valor = campo ? d[campo] : d;
    if (valor == null || (['pessoas','clientes','acessos'].includes(campo) && !Array.isArray(valor)))
      throw new Error('Resposta incompleta.');
    return valor;
  };
  const carregar = async (chave, url, campo, aplicar) => {
    try { const valor = await ler(url, campo); if (carga === CONTA_CARGA) aplicar(valor); }
    catch { if (carga === CONTA_CARGA) ERROS_DA_CONTA[chave] = true; }
  };
  await Promise.all([
    carregarContaAI(carga, false),
    carregar('perfil', CONTA_API, 'pessoa', v => { MINHA_CONTA = v; }),
    ...(ehAdmin() ? [
      carregar('equipe', PESSOAS_API, 'pessoas', v => { EQUIPE = v; }),
      carregar('clientes', CLIENTES_API, 'clientes', v => { CLIENTES = v; }),
      carregar('opcoes', OPCOES_API, null, v => { OPCOES = v; }),
      carregar('acessos', ACESSOS_API, 'acessos', v => { ACESSOS = v; }),
    ] : [])
  ]);
  if (carga === CONTA_CARGA) pintarConta();
}

function erroDaContaHtml() {
  return '<div class="conta-carregamento-erro" role="alert"><h2>Não foi possível carregar esta seção</h2><p>Confira sua conexão e tente novamente. Os dados não foram alterados.</p><button type="button" class="workflow-secondary" onclick="carregarConta()">Tentar novamente</button></div>';
}

function quandoAcessou(iso) {
  if (!iso) return 'nunca entrou';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias === 0) return 'entrou hoje';
  if (dias === 1) return 'entrou ontem';
  return `entrou há ${dias} dias`;
}

// ── a tela ───────────────────────────────────────────────────────────────────
//
// Quadro "Conta e equipe" do padrão novo: a tela abre no que pede ação e no cartão de quem você é. O que é da
// operação (equipe, clientes, opções das fichas, credenciais, manutenção) fica a um clique, nos números do alto e
// na fileira "Abrir" do pé. Quem não administra vê só a própria conta.
let SECAO_ATIVA = 'perfil';
let VER_COMO_O_TIME = false;

function secoesDaConta(eu) {
  const minhas = [
    { chave: 'perfil', rotulo: 'Perfil' },
    { chave: 'senha', rotulo: 'Senha' },
  ];
  const daOperacao = [
    { chave: 'equipe', rotulo: 'Equipe' },
    { chave: 'clientes', rotulo: 'Clientes' },
    { chave: 'opcoes', rotulo: 'Opções das fichas' },
    { chave: 'acessos', rotulo: 'Credenciais' },
    { chave: 'manutencao', rotulo: 'Manutenção' },
  ];
  const mostraOperacao = eu.admin && !VER_COMO_O_TIME;
  return [
    { titulo: 'Você', itens: minhas },
    ...(mostraOperacao ? [{ titulo: 'Operação', itens: daOperacao }] : []),
  ];
}

function escolherSecaoDaConta(chave) {
  // Perfil e Senha moram no mesmo cartão: com ele na tela, a senha só abre ou fecha no lugar.
  if (['perfil', 'senha'].includes(chave) && document.getElementById('v2c-senha')) {
    alternarSenhaDaConta(chave === 'senha');
    document.getElementById('conta-conteudo')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  SECAO_ATIVA = chave;
  pintarConta();
  document.getElementById('conta-conteudo')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// O ensaio existe para responder "como o time vê a própria tela?" sem precisar
// entrar na conta de outra pessoa. Só esconde o que é de administrador — as
// permissões do servidor continuam as mesmas, e por isso ele não é um modo de
// segurança e nem se apresenta como um.
function alternarVisaoDoTime() {
  VER_COMO_O_TIME = !VER_COMO_O_TIME;
  if (VER_COMO_O_TIME && !['perfil', 'senha'].includes(SECAO_ATIVA)) SECAO_ATIVA = 'perfil';
  pintarConta();
}

const contaIniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const CONTA_VISTO = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

// O que a conta de quem está logado ainda pede. Sai do que o painel sabe: o vínculo com o WhatsApp e a foto.
// `curta` vai para o bloco de ação (Direção 3: uma frase só); `texto` é o rótulo curto da linha do "Pede ação".
function pendenciasDaConta(eu) {
  const a = CONTA_AI, lista = [];
  if (a.carregando) lista.push({ chave: 'whatsapp', cor: 'n', selo: 'Conferindo', nome: 'WhatsApp', texto: 'lendo o seu vínculo', frase: '', curta: '', botao: 'Tentar de novo', acao: 'carregarContaAI()', indo: true });
  else if (a.erro) lista.push({ chave: 'whatsapp', cor: 'r', selo: 'Não conferido', nome: 'WhatsApp', texto: 'vínculo com o seu número', frase: 'não consegui conferir o seu vínculo com o WhatsApp', curta: 'Não conferi seu WhatsApp', botao: 'Tentar de novo', acao: 'carregarContaAI()' });
  else if (!a.disponivel) lista.push({ chave: 'whatsapp', cor: 'n', selo: 'Indisponível', nome: 'WhatsApp', texto: 'ainda não disponível aqui', frase: 'a conexão com o WhatsApp ainda não está disponível neste ambiente', curta: 'O WhatsApp ainda não está disponível aqui', botao: 'Conferir', acao: 'carregarContaAI()' });
  else if (!a.vinculado) {
    const temCodigo = a.codigo && Date.parse(a.expiraEm) > Date.now();
    lista.push({ chave: 'whatsapp', cor: 'a', selo: 'Não conectado', nome: 'WhatsApp', texto: temCodigo ? 'envie o código ao VYBES' : 'ligue o VYBES ao seu número', frase: 'o seu WhatsApp ainda não está ligado a mim',
      curta: temCodigo ? 'Falta enviar o código do WhatsApp' : 'Seu WhatsApp não está ligado a mim',
      botao: temCodigo ? 'Já enviei o código' : 'Conectar', acao: temCodigo ? 'carregarContaAI()' : "acaoContaAI('vinculacao_iniciar')", parado: !temCodigo && (!a.pode_gerar || a.ocupado) });
  }
  if (!eu?.foto_url) lista.push({ chave: 'foto', cor: 'a', selo: 'Sem foto', nome: 'Sua foto', texto: 'aparece nas bolinhas de responsável', frase: 'você ainda não tem foto', curta: 'falta sua foto', botao: 'Escolher', acao: "document.getElementById('conta-foto-arquivo')?.click()" });
  return lista;
}

// Bloco de ação da Direção 3 (d3AcaoHtml, vybe-core.js): a única faixa laranja da tela. Sem o vybe-core (testes),
// a mesma marcação montada aqui.
function contaAcaoHtml(frase, botao = '', attrs = '') {
  const corpo = `<small class="d3c-quem">VYBES · Conta</small>${frase}`;
  if (typeof d3AcaoHtml === 'function') return d3AcaoHtml({ frase: corpo, agente: 'V', botao, attrs });
  return `<section class="d3-acao" aria-label="O que pede ação agora"><span class="d3-acao-av" aria-hidden="true">V</span><span class="d3-acao-frase">${corpo}</span>`
    + `${botao ? `<button type="button" class="d3-acao-btn" ${attrs}>${safeText(botao)}</button>` : ''}</section>`;
}

// "senhor" só com os donos (identidade do VYBES); o resto do time pelo nome, aqui sem tratamento.
function falaDaConta(eu) {
  const senhor = eu?.dono ? ', senhor' : '';
  if (VER_COMO_O_TIME) return contaAcaoHtml(`Você vê o painel como o time${senhor}.`, 'Voltar', 'onclick="alternarVisaoDoTime()"');
  if (CONTA_AI.carregando) return contaAcaoHtml(`Conferindo sua conta${senhor}.`);
  const p = pendenciasDaConta(eu).filter((x) => x.curta);
  if (!p.length) return contaAcaoHtml(`Conta em ordem${senhor}.${CONTA_AI.vinculado ? ' WhatsApp conferido.' : ''}`);
  const [um, dois] = p;
  const frase = `${um.curta}${senhor}${dois ? `, e ${dois.curta}` : ''}.`;
  return contaAcaoHtml(safeText(frase.charAt(0).toUpperCase() + frase.slice(1)), um.botao, `onclick="${um.acao}"${um.parado ? ' disabled' : ''}`);
}

function pedeAcaoDaConta(eu) {
  const p = pendenciasDaConta(eu);
  const linhas = p.map((x, i) => `<div class="v2c-lin d3c-pend"><span class="v2c-pill ${x.cor}">${safeText(x.selo)}</span><b>${safeText(x.nome)}</b>
      <span class="d3c-pend-baixo"><span class="d3c-pend-txt">${safeText(x.texto)}</span><button type="button" class="v2c-btn s v2-estado${i === 0 ? ' k' : ''}"${x.indo ? ' data-estado="indo"' : ''}${x.parado ? ' disabled' : ''} onclick="${x.acao}">${safeText(x.botao)}</button></span></div>`).join('');
  const feito = `<p class="v2c-tudo-certo">${CONTA_VISTO}Nada pendente na sua conta.${CONTA_AI.vinculado ? ' WhatsApp conferido.' : ''}</p>`;
  return `<div class="v2c-card-topo"><h2>Pede ação</h2><span class="v2c-sub">${p.length || 'nada agora'}</span></div>
    ${linhas || feito}`;
}

// A operação (só quem administra): as partes que abrem no lugar, cada uma com o rótulo curto e o "Abrir".
function operacaoDaConta() {
  const ativos = CLIENTES.filter((c) => c.ativo).length, guardadas = ACESSOS.filter((a) => a.tem_documento).length;
  const linha = (chave, nome, sub) => `<div class="v2c-lin d3c-op"><span><b>${nome}</b><small>${sub}</small></span><button type="button" class="v2c-btn s" onclick="escolherSecaoDaConta('${chave}')">Abrir</button></div>`;
  return `<div class="v2c-card-topo"><h2>Operação</h2></div>
    ${linha('opcoes', 'Opções das fichas', 'listas das fichas')}${linha('manutencao', 'Manutenção', 'limpeza e conferência')}
    ${linha('clientes', 'Clientes', ERROS_DA_CONTA.clientes ? 'não carregou' : `${ativos} ${ativos === 1 ? 'ativo' : 'ativos'}`)}
    ${linha('acessos', 'Credenciais', ERROS_DA_CONTA.acessos ? 'não carregou' : `${guardadas} ${guardadas === 1 ? 'guardada' : 'guardadas'}`)}`;
}

const CONTA_CADEADO = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const contaEquipeAtiva = () => EQUIPE.filter((x) => x.ativo !== false && x.pode_entrar);
// Donos primeiro, depois a coordenação, depois o resto do time (a etiqueta vem do servidor: p.dono, p.coordenacao).
const contaOrdemDoTime = (l) => [...l].sort((a, b) => (b.dono ? 2 : b.coordenacao ? 1 : 0) - (a.dono ? 2 : a.coordenacao ? 1 : 0));

// Os quatro números de quem administra (Direção 3: cartão de número com o número que chega). Cada um abre a lista dele.
function numerosDaConta() {
  const comAcesso = contaEquipeAtiva();
  const ativos = CLIENTES.filter((c) => c.ativo);
  const guardadas = ACESSOS.filter((a) => a.tem_documento).length;
  const donos = comAcesso.filter((x) => x.dono).length, coord = comAcesso.filter((x) => !x.dono && x.coordenacao).length;
  const rostos = contaOrdemDoTime(comAcesso).slice(0, 4).map((x) => `<span class="v2c-av">${retratoDaPessoa(x)}</span>`).join('')
    + (comAcesso.length > 4 ? `<span class="v2c-av mais"><span>+${comAcesso.length - 4}</span></span>` : '');
  const nomes = ativos.slice(0, 2).map((c) => `<span class="v2c-cli">${safeText(c.nome)}</span>`).join('')
    + (ativos.length > 2 ? `<span class="v2c-sub">+${ativos.length - 2}</span>` : '');
  const cartao = (chave, rotulo, valor, lado, pe, extra = '') => ERROS_DA_CONTA[chave === 'donos' ? 'equipe' : chave]
    ? `<div class="d3-num d3c-num"><span class="d3-num-rot">${rotulo}</span><b class="d3-num-v">?</b><span class="d3c-num-pe">não carregou · <button type="button" class="v2c-link" onclick="carregarConta()">tentar de novo</button></span></div>`
    : `<button type="button" class="d3-num d3c-num" onclick="escolherSecaoDaConta('${chave === 'donos' ? 'equipe' : chave}')"><span class="d3-num-rot">${rotulo}</span><b class="d3-num-v">${valor}</b>${lado ? `<span class="d3c-num-lado">${lado}</span>` : ''}${pe ? `<span class="d3c-num-pe">${pe}</span>` : ''}${extra}</button>`;
  return `<div class="d3c-nums">
    ${cartao('equipe', 'Equipe', comAcesso.length, `<span class="v2c-avs" aria-hidden="true">${rostos}</span>`, 'com acesso')}
    ${cartao('clientes', 'Clientes', ativos.length, `<span class="v2c-clis">${nomes}</span>`, 'ativos no painel')}
    ${cartao('acessos', 'Credenciais', guardadas, '', `${CONTA_CADEADO}só a gestão vê`)}
    ${cartao('donos', 'Donos', `${donos}${coord ? `<small> · ${coord} coordenação</small>` : ''}`, '', '', `<span class="d3-barra"><i style="--v:${comAcesso.length ? Math.round(((donos + coord) / comAcesso.length) * 100) : 0}%"></i></span>`)}
  </div>`;
}

// A equipe à direita, uma linha por pessoa com a etiqueta "dono" ou "coordenação". As ações (liberar, senha,
// subsolo) continuam na seção Equipe, que abre pelo pé do cartão.
function equipeDaConta() {
  if (ERROS_DA_CONTA.equipe) return `<div class="v2c-card-topo"><h2>Equipe</h2></div><p class="v2c-sub d3c-eq-erro">Não carregou · <button type="button" class="v2c-link" onclick="carregarConta()">tentar de novo</button></p>`;
  const time = contaOrdemDoTime(contaEquipeAtiva()), MAX = 8, resto = Math.max(0, time.length - MAX);
  const etiqueta = (p) => (p.dono ? '<span class="v2c-pill d3c-dono">dono</span>' : p.coordenacao ? '<span class="v2c-pill n">coordenação</span>' : '');
  const linhas = time.slice(0, MAX).map((p) => `<div class="v2c-lin d3c-eq"><span class="v2c-av">${retratoDaPessoa(p)}</span>${p.dono || p.coordenacao ? `<b>${safeText(p.nome)}</b>` : `<span>${safeText(p.nome)}</span>`}${etiqueta(p)}</div>`).join('');
  return `<div class="v2c-card-topo"><h2>Equipe</h2><span class="v2c-sub">${time.length}</span></div>
    ${linhas || '<p class="v2c-sub d3c-eq-erro">Ninguém com acesso ainda.</p>'}
    <button type="button" class="d3c-eq-pe" onclick="escolherSecaoDaConta('equipe')">${resto ? `+${resto} · ` : ''}abrir a equipe</button>`;
}

function pintarConta() {
  const raiz = document.getElementById('conta-root');
  const eu = MINHA_CONTA || (typeof sessaoAtual === 'function' ? sessaoAtual() : null);
  if (!raiz) return;
  if (!eu) { raiz.innerHTML = erroDaContaHtml(); return; }

  const todas = secoesDaConta(eu).flatMap((g) => g.itens);
  if (!todas.some((i) => i.chave === SECAO_ATIVA)) SECAO_ATIVA = 'perfil';
  const admin = eu.admin && !VER_COMO_O_TIME;
  const inicio = ['perfil', 'senha'].includes(SECAO_ATIVA);

  raiz.innerHTML = `
    <div class="v2c d3c" id="v2c">
      <div class="v2c-topo">
        <h1>${admin ? 'Conta e equipe' : 'Sua conta'}</h1>${admin ? '<span class="d3c-onde">Gestão</span>' : ''}
        ${eu.admin ? `<button type="button" class="v2c-btn" onclick="alternarVisaoDoTime()" aria-pressed="${VER_COMO_O_TIME}">${VER_COMO_O_TIME ? 'Voltar à minha visão' : 'Ver como o time vê'}</button>` : ''}
        <button type="button" class="v2c-btn k" onclick="carregarContaAI()">Conferir o WhatsApp</button>
      </div>
      <div class="d3c-fala" id="v2c-fala">${falaDaConta(eu)}</div>
      ${admin ? numerosDaConta() : ''}
      ${inicio ? `<div class="d3c-cols${admin ? '' : ' so-eu'}">
        <div class="d3c-col">
          <section class="v2c-card v2c-pede d3c-cartao" id="v2c-pede" aria-label="Pede ação">${pedeAcaoDaConta(eu)}</section>
          ${admin ? `<section class="v2c-card d3c-cartao d3c-operacao" aria-label="Operação">${operacaoDaConta()}</section>` : ''}
        </div>
        <section class="v2c-card v2c-perfil d3c-cartao" id="conta-conteudo" aria-label="Seu perfil">${ERROS_DA_CONTA.perfil ? erroDaContaHtml() : blocoPerfil(eu)}</section>
        ${admin ? `<section class="v2c-card d3c-cartao d3c-equipe" aria-label="Equipe">${equipeDaConta()}</section>` : ''}
      </div>` : `<section class="v2c-card v2c-secao" id="conta-conteudo">${corpoDaSecao(SECAO_ATIVA, eu)}</section>`}
      <nav class="v2c-abrir" aria-label="Abrir uma parte da conta"><span class="v2c-sub">Abrir</span>${todas.map((i) =>
        `<button type="button" class="v2c-chip" data-secao="${i.chave}" aria-pressed="${i.chave === SECAO_ATIVA && i.chave !== 'perfil'}" onclick="escolherSecaoDaConta('${i.chave}')">${safeText(i.rotulo)}</button>`).join('')}</nav>
    </div>`;
}

function cabecaDaSecao(titulo, texto, acao = '') {
  return `<header class="conta-secao-topo">
      <div><h2>${safeText(titulo)}</h2><p>${texto}</p></div>${acao}</header>`;
}

function corpoDaSecao(chave, eu) {
  if (ERROS_DA_CONTA[chave]) return erroDaContaHtml();
  if (chave === 'equipe') return blocoEquipe(eu);
  if (chave === 'clientes') return blocoClientes();
  if (chave === 'opcoes') return blocoOpcoes();
  if (chave === 'acessos') return blocoAcessos();
  if (chave === 'manutencao') return blocoManutencao();
  return blocoPerfil(eu);
}

const CHAVE_TEMA_DA_CONTA = 'irecity.tema';
function temaDaConta() { try { return localStorage.getItem(CHAVE_TEMA_DA_CONTA) || 'claro'; } catch { return 'claro'; } }
// A mesma chave e a mesma classe que o menu da conta usa no topo: o tema vale só para este navegador.
function trocarTemaDaConta(tema) {
  try { localStorage.setItem(CHAVE_TEMA_DA_CONTA, tema); } catch { /* sem armazenamento: vale só nesta abertura */ }
  const raiz = document.documentElement;
  raiz.classList.toggle('tema-escuro', tema === 'escuro');
  raiz.style.colorScheme = tema === 'escuro' ? 'dark' : 'light';
  document.querySelectorAll('[data-tema-conta]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.temaConta === tema)));
  // A aba preta estica até a escolha (Direção 3: "aba que estica").
  document.querySelectorAll('.d3c-seg').forEach((s) => { s.dataset.tema = tema; });
}

// A senha abre no lugar, na própria linha, sem trocar de tela.
function alternarSenhaDaConta(abrir) {
  const caixa = document.getElementById('v2c-senha');
  if (!caixa) return;
  const aberto = typeof abrir === 'boolean' ? abrir : caixa.getAttribute('aria-expanded') !== 'true';
  SECAO_ATIVA = aberto ? 'senha' : 'perfil';
  caixa.setAttribute('aria-expanded', String(aberto));
  caixa.querySelector('.v2-mais')?.toggleAttribute('inert', !aberto);
  caixa.querySelector('[data-senha-abre]')?.setAttribute('aria-expanded', String(aberto));
  document.querySelectorAll('.v2c-abrir .v2c-chip').forEach((b) => b.setAttribute('aria-pressed', String(aberto && b.dataset.secao === 'senha')));
  if (aberto) document.getElementById('conta-atual')?.focus();
}

// O cartão de quem você é: foto, senha, WhatsApp e tema, uma linha cada.
function blocoPerfil(eu) {
  const senhaAberta = SECAO_ATIVA === 'senha', tema = temaDaConta();
  const temaBotao = (t, rotulo) => `<button type="button" role="radio" data-tema-conta="${t}" aria-checked="${tema === t}" onclick="trocarTemaDaConta('${t}')">${rotulo}</button>`;
  // A etiqueta do papel: "dono" (cheia) ou "coordenação" (clara), como o servidor diz; o resto do time, "time".
  const papel = eu.dono ? ['dono', 'd3c-dono'] : eu.coordenacao ? ['coordenação', 'n'] : eu.admin ? ['gestão', 'n'] : ['time', 'n'];
  return `<div class="v2c-quem">
      <span class="v2c-retrato" id="conta-foto-atual">${eu.foto_url ? `<img src="${safeText(eu.foto_url)}" alt="Sua foto">` : `<span>${safeText(contaIniciais(eu.nome))}</span>`}</span>
      <div><h2>${safeText(eu.nome)}</h2><p class="v2c-sub">${safeText(eu.email)}</p></div>
      <span class="v2c-pill ${papel[1]}">${papel[0]}</span>
    </div>
    <div class="v2c-lin v2c-dado"><span>Foto</span><span class="d3c-fichas"><i>PNG · JPG · WEBP</i><i>até 2 MB</i><i>Drive da Vybe</i></span>
      <span><input type="file" id="conta-foto-arquivo" accept="image/png,image/jpeg,image/webp" hidden onchange="enviarMinhaFoto(this)">
      <button type="button" class="v2c-btn s" onclick="document.getElementById('conta-foto-arquivo').click()">Escolher</button></span></div>
    <div class="v2-abre" id="v2c-senha" aria-expanded="${senhaAberta}">
      <div class="v2c-lin v2c-dado"><span>Senha</span><span>só você troca</span>
        <button type="button" class="v2c-btn s" data-senha-abre aria-expanded="${senhaAberta}" aria-controls="v2c-senha-campos" onclick="alternarSenhaDaConta()">Trocar</button></div>
      <div class="v2-mais" id="v2c-senha-campos"${senhaAberta ? '' : ' inert'}><div><div class="v2c-senha-campos">
        <input id="conta-atual" type="password" autocomplete="current-password" placeholder="Atual" aria-label="Senha atual">
        <input id="conta-nova" type="password" autocomplete="new-password" placeholder="Nova" aria-label="Nova senha, mínimo de 8 caracteres" title="Mínimo de 8 caracteres">
        <button type="button" class="v2c-btn s k" onclick="trocarMinhaSenha()">Salvar</button>
      </div></div></div>
    </div>
    ${blocoContaAI()}
    <div class="v2c-lin v2c-dado"><span>Tema</span><span class="v2c-sub">só para você</span>
      <span class="v2c-seg d3c-seg" role="radiogroup" aria-label="Tema" data-tema="${tema === 'escuro' ? 'escuro' : 'claro'}"><i class="d3c-seg-ind" aria-hidden="true"></i>${temaBotao('claro', 'Claro')}${temaBotao('escuro', 'Escuro')}</span></div>
    <p class="v2c-sub v2c-nota">nome e e-mail · cadastro da equipe</p>`;
}

// A conta WhatsApp usa a mesma sessão do Perfil; código fica só em memória.
function blocoContaAI() {
  // Uma linha do cartão de perfil: "WhatsApp" e a situação numa etiqueta. Quem resolve é o botão do "Pede ação";
  // aqui ficam só o que não é pendência (desconectar) e o código temporário, que abre embaixo depois de pedir.
  const a=CONTA_AI, ocupado=a.ocupado ? ' disabled' : '';
  const temCodigo = a.codigo && Date.parse(a.expiraEm)>Date.now();
  const botao = (rotulo, acao, preto=false) => `<button type="button" class="v2c-btn s${preto ? ' k' : ''}" onclick="${acao}"${ocupado}>${rotulo}</button>`;
  let situacao, explica, cor='n', acoes='';
  if (a.carregando) { situacao='Conferindo…'; explica='Lendo se o seu número já está ligado ao VYBES.'; }
  else if (a.erro) { situacao='Não deu para conferir agora'; explica=a.erro; cor='r'; }
  else if (!a.disponivel) { situacao='Conexão ainda não disponível neste ambiente'; explica='Nenhuma alteração foi feita na sua conta.'; }
  else if (a.vinculado) { situacao='Conectado'; cor='g'; explica='Você consulta pelo WhatsApp as demandas permitidas para você. O vínculo não dá acesso administrativo.'; acoes=botao('Desconectar',"acaoContaAI('vinculacao_revogar')"); }
  else {
    situacao='Não conectado'; cor='a'; explica=a.pode_gerar ? 'Ligue o VYBES ao seu número para consultar as demandas permitidas para você. O vínculo não dá acesso administrativo.' : 'A conexão não está liberada para esta conta ou ambiente.';
    if (temCodigo) acoes = botao('Cancelar o código',"acaoContaAI('vinculacao_revogar')");
  }
  const codigo = temCodigo && !a.carregando && !a.erro ? `<div class="conta-ai-codigo"><label for="conta-ai-codigo">Seu código temporário</label>
    <input id="conta-ai-codigo" value="${safeText(a.codigo)}" readonly autocomplete="off" spellcheck="false" onclick="this.select()">
    <button type="button" class="v2c-btn s" onclick="copiarCodigoContaAI()">Copiar código</button>
    <small>Válido até ${safeText(new Date(a.expiraEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))}. Uso único. Envie este código somente na conversa privada com o WhatsApp do VYBES.</small></div>` : '';
  return `<section class="conta-ai" aria-label="VYBES no WhatsApp">
    <div class="v2c-lin v2c-dado conta-ai-linha${a.erro ? ' erro' : ''}"><span class="conta-ai-rotulo">WhatsApp</span>
      <div class="conta-ai-meio"><b class="v2c-pill ${cor}" title="${safeText(explica)}">${safeText(situacao)}</b><small>${safeText(explica)}</small></div><div class="conta-ai-acoes">${acoes}</div></div>
    ${codigo}<p class="v2c-sub conta-ai-aviso" role="status" aria-live="polite">${safeText(a.aviso || '')}</p></section>`;
}
// O vínculo muda três lugares da tela: a fala, o "Pede ação" e a linha do perfil. Troca só eles, para não apagar
// o que a pessoa está digitando na senha.
function pintarContaAI() {
  const el=document.querySelector('.conta-ai');
  if(el) el.outerHTML=blocoContaAI();
  const eu = MINHA_CONTA || (typeof sessaoAtual === 'function' ? sessaoAtual() : null);
  if (!eu) return;
  const fala = document.getElementById('v2c-fala'), pede = document.getElementById('v2c-pede');
  if (fala) fala.innerHTML = falaDaConta(eu);
  if (pede) pede.innerHTML = pedeAcaoDaConta(eu);
}
async function carregarContaAI(carga=CONTA_CARGA, pintar=true) {
  const estado=CONTA_AI; estado.carregando=true;estado.erro='';
  if(pintar)pintarContaAI();
  try {
    const r=await fetch('/api/painel?area=assistente&consulta=vinculacao_status',{credentials:'same-origin',cache:'no-store'});
    const d=await r.json(); if(!r.ok || !d.ok || typeof d.vinculado!=='boolean' || typeof d.disponivel!=='boolean') throw Error(d.error || 'Não foi possível conferir o vínculo.');
    if(carga!==CONTA_CARGA || estado!==CONTA_AI)return;
    Object.assign(estado,{disponivel:d.disponivel,vinculado:d.vinculado,pode_gerar:d.pode_gerar});
    if(d.vinculado){estado.codigo=null;clearTimeout(estado.expiracao);}
  } catch(e){if(carga===CONTA_CARGA && estado===CONTA_AI)estado.erro=e.message || 'Não foi possível conferir o vínculo.';}
  finally {if(carga===CONTA_CARGA && estado===CONTA_AI){estado.carregando=false;if(pintar)pintarContaAI();}}
}
async function acaoContaAI(consulta) {
  const estado=CONTA_AI,carga=CONTA_CARGA;
  if(estado.ocupado || estado.carregando)return;
  estado.ocupado=true;estado.aviso='';pintarContaAI();
  try {
    const r=await fetch('/api/painel?area=assistente&consulta='+encodeURIComponent(consulta),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();if(!r.ok || !d.ok)throw Error(d.error || 'Não foi possível atualizar o vínculo.');
    if(estado!==CONTA_AI || carga!==CONTA_CARGA)return;
    clearTimeout(estado.expiracao);estado.codigo=null;
    if(consulta==='vinculacao_iniciar'){
      if(!/^[0-9a-f]{20}$/.test(d.codigo || '') || !(Date.parse(d.expiraEm)>Date.now()))throw Error('Código recebido inválido. Tente novamente.');
      estado.codigo=d.codigo;estado.expiraEm=d.expiraEm;
      estado.aviso='Código gerado. Após enviar para o VYBES, clique em "Já enviei o código".';
      estado.expiracao=setTimeout(()=>{if(CONTA_AI===estado){estado.codigo=null;estado.aviso='Código expirado. Gere outro para continuar.';pintarContaAI();}},Math.max(0,Date.parse(d.expiraEm)-Date.now()));
    }else{estado.vinculado=false;estado.aviso='Vínculos revogados e códigos pendentes invalidados.';}
  }catch(e){if(estado===CONTA_AI && carga===CONTA_CARGA)estado.aviso=e.message || 'Não foi possível atualizar o vínculo.';}
  finally{if(estado===CONTA_AI && carga===CONTA_CARGA){estado.ocupado=false;pintarContaAI();}}
}
async function copiarCodigoContaAI() {
  if(!CONTA_AI.codigo || Date.parse(CONTA_AI.expiraEm)<=Date.now())return;
  const estado=CONTA_AI;
  try{await navigator.clipboard.writeText(estado.codigo);if(estado===CONTA_AI)estado.aviso='Código copiado.';}
  catch{if(estado===CONTA_AI){estado.aviso='Selecione o código e copie com o teclado.';pintarContaAI();document.getElementById('conta-ai-codigo')?.select();}return;}
  pintarContaAI();
}

// Retrato de alguém da equipe (redesign, quadro 60): o boneco do Escritório da pessoa, que o mundo troca pelo retrato
// voxel (vybe-mundo.js, trocarAvatar); sem boneco, a foto do painel; sem foto, as iniciais.
function retratoDaPessoa(p) {
  const iniciais = String(p?.nome || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  let boneco = null;
  try { boneco = typeof escritorioCabecaUrl === 'function' ? (escritorioCabecaUrl(p?.id) || escritorioCabecaUrl(p?.nome)) : null; } catch { boneco = null; }
  if (boneco) return `<img src="${safeText(boneco)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  if (p?.foto_url) return `<img src="${safeText(p.foto_url)}" alt="">`;
  return `<span>${safeText(iniciais)}</span>`;
}

// Equipe (redesign, quadro 60): cada pessoa com o retrato, a situação escrita e UM botão principal (o que a pessoa
// mais precisa agora); as ações raras ficam no "Mais", e a perigosa (subsolo) só lá dentro, em vermelho.
function acoesDaPessoa(p, sou, travado) {
  const email = safeText(p.email), nome = safeText(p.nome), id = safeText(String(p.id));
  const b = (rotulo, onclick, extra = '') => ({ rotulo, html: (cls) => `<button type="button" class="${cls}"${extra} onclick="${onclick}">${rotulo}</button>` });
  const senha = b('Definir senha', `redefinirSenhaDe('${email}','${nome}')`);
  const destravar = b('Destravar', `acaoPessoa('${email}','destravar')`);
  const liberar = b('Liberar acesso', `acaoPessoa('${email}','liberar')`);
  const principal = travado ? destravar : !p.pode_entrar ? liberar : senha;
  const raras = [
    travado && principal !== destravar ? destravar : null,
    principal !== senha ? senha : null,
    p.pode_entrar ? (sou ? null : b('Tirar acesso', `acaoPessoa('${email}','bloquear')`)) : (principal !== liberar ? liberar : null),
  ].filter(Boolean);
  const subsolo = sou ? '' : `<button type="button" class="eq-mais-item eq-mais-perigo" role="menuitem" data-id="${id}" data-nome="${nome}" onclick="abrirDesativarNoCiclo('pessoa',this.dataset.id,this.dataset.nome,{depois:carregarConta})"><span>Mandar para o subsolo</span></button>`;
  const mais = raras.length || subsolo ? `<details class="eq-mais"><summary class="conta-botao" aria-label="Mais ações para ${nome}">Mais<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="eq-mais-menu" role="menu">${raras.map((x) => x.html('eq-mais-item').replace('<button type="button"', '<button type="button" role="menuitem"')).join('')}${subsolo}</div></details>` : '';
  return principal.html('conta-botao') + mais;
}

function situacaoDaPessoa(p, travado) {
  const partes = [p.pode_entrar ? 'liberado' : 'sem acesso', p.tem_senha ? quandoAcessou(p.ultimo_acesso) : 'sem senha definida'];
  return safeText(partes.join(' · ')) + (travado ? ' · <b class="eq-travado">travado por erro de senha</b>' : '');
}

function blocoEquipe(eu) {
  const linhas = EQUIPE.map((p) => {
    const travado = p.bloqueado_ate && new Date(p.bloqueado_ate) > new Date();
    const sou = String(p.email).toLowerCase() === String(eu.email).toLowerCase();
    // Quem está no subsolo aparece só com o caminho de volta: liberar acesso de
    // quem saiu seria abrir a porta sem trazer a pessoa de volta.
    if (p.ativo === false) return `
    <div class="eq-linha fora">
      <span class="eq-retrato">${retratoDaPessoa(p)}</span>
      <div class="eq-quem"><b>${safeText(p.nome)}</b><span class="eq-email">${safeText(p.email)}</span>
        <div class="eq-estado">desativado · sem login · no subsolo do Escritório</div></div>
      <div class="eq-acoes"><button type="button" class="conta-botao" data-id="${safeText(String(p.id))}" data-nome="${safeText(p.nome)}" onclick="reviverNoCiclo('pessoa',this.dataset.id,this.dataset.nome,{depois:carregarConta})">Reativar</button></div>
    </div>`;
    return `
    <div class="eq-linha ${p.pode_entrar ? '' : 'fora'}">
      <span class="eq-retrato">${retratoDaPessoa(p)}</span>
      <div class="eq-quem">
        <b>${safeText(p.nome)}</b>${p.dono ? '<span class="eq-tag">dono</span>' : p.coordenacao ? '<span class="eq-tag">coordenação</span>' : ''}${sou ? '<span class="eq-tag eu">você</span>' : ''}
        <span class="eq-email">${safeText(p.email)}</span>
        <div class="eq-estado">${situacaoDaPessoa(p, travado)}</div>
      </div>
      <div class="eq-acoes">${acoesDaPessoa(p, sou, travado)}</div>
    </div>`;
  }).join('');
  return cabecaDaSecao('Equipe',
    'Liberar, tirar acesso e definir senha. Oito erros de senha travam a conta por 15 minutos — aqui dá para destravar na hora. Quem sai do time vai para o subsolo do Escritório; de lá volta ou é apagado para sempre.',
    `<button type="button" class="conta-botao primario" onclick="abrirNovoNoCiclo('pessoa',{depois:carregarConta})">Novo colaborador</button>`)
    + `<div class="eq-lista">${linhas || '<div class="auto-carregando">Nenhuma pessoa cadastrada.</div>'}</div>`;
}

// O "Mais" fecha ao clicar fora dele ou ao escolher uma ação (um aberto por vez).
document.addEventListener?.('click', (e) => {
  for (const d of document.querySelectorAll('.eq-mais[open]')) if (!d.contains(e.target) || e.target.closest('.eq-mais-item')) d.open = false;
});
document.addEventListener?.('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const aberto = document.querySelector('.eq-mais[open]'); if (!aberto) return;
  aberto.open = false; aberto.querySelector('summary')?.focus();
});

function blocoManutencao() {
  return cabecaDaSecao('Manutenção',
    'Arquivo enviado pelo painel só mostra prévia se estiver liberado para leitura por link no Drive. Os que subiram antes dessa liberação existir aparecem como “Prévia indisponível”. Abrir a peça já conserta os dela.')
    + `<div class="conta-cartao">
      <div class="conta-acao-linha">
        <div><b>Prévias dos arquivos</b><small>Conserta o acervo inteiro de uma vez, em lotes.</small></div>
        <button class="conta-botao" onclick="liberarPreviasDeArquivos(this)">Liberar prévias antigas</button>
      </div>
      <p class="conta-nota" id="conta-previas-nota"></p>
      <div class="conta-acao-linha">
        <div><b>Estrutura do banco</b><small>Cria o que falta de estrutura nova, como a tabela das Notas. Não apaga nem altera nada do que já existe.</small></div>
        <button class="conta-botao" onclick="conferirEstruturaDoBanco(this)">Conferir estrutura do banco</button>
      </div>
      <p class="conta-nota" id="conta-estrutura-nota"></p>
    </div>`;
}

// A estrutura nova (tabela das Notas, por exemplo) nasce por um clique de quem
// administra, não por uma leitura: leitura que cria tabela é o tipo de coisa que
// derruba o painel numa madrugada. O endpoint é idempotente — CREATE TABLE IF
// NOT EXISTS — e não altera nem apaga o que já existe.
async function conferirEstruturaDoBanco(botao) {
  const caixa = document.getElementById('conta-estrutura-nota');
  if (botao) botao.disabled = true;
  if (caixa) caixa.textContent = 'Conferindo a estrutura…';
  try {
    const r = await fetch('/api/dominio?action=schema', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) throw new Error(d?.error || `Não deu certo (${r.status})`);
    if (caixa) caixa.textContent = '✓ Estrutura conferida. As Notas já podem ser usadas.';
    showToast('✓ Estrutura do banco conferida', 'ok', 5000);
  } catch (erro) {
    if (caixa) caixa.textContent = `Não foi possível conferir: ${erro.message}`;
    showToast(erro.message, 'err', 7000);
  } finally { if (botao) botao.disabled = false; }
}

async function consultarFilaReplica() {
  const caixa=document.getElementById('conta-replica-nota'); if (!caixa) return;
  caixa.textContent='Conferindo pendências…';
  try {
    const r=await fetch('/api/dominio?action=replica',{credentials:'same-origin',cache:'no-store'});
    const d=await r.json(); if (!r.ok) throw new Error(d.error || 'Falha ao consultar a fila.');
    const saude=d.saude || {};
    caixa.innerHTML=`<p>${Number(saude.pendentes || 0)} pendentes · ${Number(saude.revisao_necessaria || 0)} precisam de conferência no Monday.</p>`
      +(d.pendencias || []).map((p)=>`<div class="conta-acao-linha"><div><b>#${Number(p.id)} · ${safeText(p.operacao)} · ${safeText(p.referencia || '')}</b><small>${safeText(p.ultimo_erro || p.estado)}</small></div>
      ${p.revisao_necessaria?`<button class="conta-botao" onclick="retomarCopiaConferida(${Number(p.id)},this)">Autorizar nova tentativa</button>`:''}</div>`).join('');
  } catch(erro) { caixa.textContent=erro.message; }
}

async function processarReplicaAgora(botao, retomarId=null) {
  if(botao)botao.disabled=true;
  try {
    const r=await fetch('/api/dominio?action=replica',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(retomarId?{retomar_id:retomarId,confirmado:true}:{})});
    const d=await r.json(); if(!r.ok)throw new Error(d.error || 'Falha ao processar a fila.');
    showToast(`${Number(d.execucao?.concluidas || 0)} cópias concluídas.`, 'success', 5000);
    await consultarFilaReplica();
  } catch(erro) { showToast(erro.message,'error',7000); }
  finally { if(botao)botao.disabled=false; }
}

async function retomarCopiaConferida(id, botao) {
  if (!await confirmarNoPainel('Confira primeiro no Monday se esta operação NÃO foi aplicada. Repetir uma criação já concluída pode duplicar item ou comentário. Confirmou que ela ainda não existe?')) return;
  return processarReplicaAgora(botao,id);
}

// ── clientes ──────────────────────────────────────────────────────────────────
// Sem isto, cliente novo exigia cadastrar antes no Monday — e com o time fora de
// lá, viraria um pedido ao Paulo toda vez.
function blocoClientes() {
  const linhas = CLIENTES.map((c) => `
    <div class="eq-linha ${c.ativo ? '' : 'fora'}">
      <div class="eq-quem"><b>${safeText(c.nome)}</b><span class="eq-email">${c.conteudos} conteúdo${c.conteudos === 1 ? '' : 's'}</span></div>
      <div class="eq-estado">${c.ativo ? 'aparece no painel' : 'fora do painel'}</div>
      <div class="eq-acoes">
        <button onclick="renomearCliente(${c.id},'${safeText(c.nome).replace(/'/g, "\\'")}')">renomear</button>
        <button onclick="acaoCliente(${c.id},'${c.ativo ? 'desativar' : 'ativar'}')">${c.ativo ? 'tirar do painel' : 'trazer de volta'}</button>
      </div>
    </div>`).join('');

  return cabecaDaSecao('Clientes',
    'Cliente não se apaga, se desativa: apagar arrastaria junto o vínculo de todo conteúdo histórico dele. Desativado some das telas e continua no histórico.',
    '<button class="conta-botao primario" onclick="criarCliente()">+ Novo cliente</button>')
    + `<div class="eq-lista">${linhas || '<div class="auto-carregando">Nenhum cliente cadastrado.</div>'}</div>`;
}

async function chamarClientes(corpo, feito) {
  try {
    const r = await fetch(CLIENTES_API, { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify(corpo) });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Falhou.');
    showToast(d.reativado ? 'Cliente já existia e voltou para o painel.' : feito, 'success', 4500);
    carregarConta();
  } catch (erro) { showToast(erro.message, 'error', 6000); }
}

async function criarCliente() {
  if (typeof abrirCadastroCompleto === 'function') return abrirCadastroCompleto('', { depois: () => carregarConta() });
  const nome = await nomearNoPainel('Nome do novo cliente, exatamente como deve aparecer no painel:');
  if (nome === null || !String(nome).trim()) return;
  chamarClientes({ acao:'criar', nome }, 'Cliente criado.');
}

async function renomearCliente(id, atual) {
  const nome = await nomearNoPainel('Novo nome do cliente:', atual);
  if (nome === null || !String(nome).trim() || nome === atual) return;
  chamarClientes({ acao:'renomear', id, nome }, 'Cliente renomeado.');
}

async function acaoCliente(id, acao) {
  if (acao === 'desativar' && !await confirmarNoPainel('Tirar este cliente do painel?\n\nO histórico dele continua; ele só deixa de aparecer nas telas e não pode receber conteúdo novo.')) return;
  chamarClientes({ acao, id }, acao === 'ativar' ? 'Cliente de volta ao painel.' : 'Cliente fora do painel.');
}

// ── opções das colunas ────────────────────────────────────────────────────────
function blocoOpcoes() {
  if (!OPCOES) return '';
  const grupos = Object.entries(OPCOES.colunas || {}).map(([coluna, titulo]) => {
    const itens = (OPCOES.opcoes || []).filter((o) => o.coluna_id === coluna);
    return [coluna, titulo, itens];
  });
  grupos.push(['status_1__1', 'Captação', (OPCOES.captacao || []).map((o) => ({ ...o, coluna_id: 'status_1__1' }))]);

  return cabecaDaSecao('Opções das fichas',
    'Desligar uma opção tira ela dos seletores sem apagar nada: peças que já a usam continuam mostrando.')
    + `${grupos.map(([coluna, titulo, itens]) => `
      <div class="op-grupo">
        <div class="op-grupo-topo">
          <b>${safeText(titulo)}</b>
          ${OPCOES.colunas?.[coluna] ? `<button onclick="criarOpcao('${coluna}','${safeText(titulo)}')">+ nova opção</button>` : '<small>catálogo interno</small>'}
        </div>
        <div class="op-lista">${itens.map((o) => `
          <button class="op-chip ${o.ativa ? 'ativa' : ''}" onclick="alternarOpcao('${coluna}','${safeText(o.chave)}')" title="${o.ativa ? 'Clique para desligar' : 'Clique para ligar'}">
            ${safeText(o.rotulo)}${o.so_vybe ? ' <i>só Vybe</i>' : ''}
          </button>`).join('')}</div>
      </div>`).join('')}`;
}

async function chamarOpcoes(corpo) {
  try {
    const r = await fetch(OPCOES_API, { method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify(corpo) });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Falhou.');
    showToast(d.aviso || `“${d.opcao.rotulo}” ${d.opcao.ativa ? 'ligada' : 'desligada'}.`, 'success', d.aviso ? 8000 : 4000);
    carregarConta();
  } catch (erro) { showToast(erro.message, 'error', 6000); }
}

function alternarOpcao(coluna, chave) { chamarOpcoes({ acao:'alternar', coluna, chave }); }

async function criarOpcao(coluna, titulo) {
  const rotulo = await nomearNoPainel(`Nova opção para “${titulo}”:`);
  if (rotulo === null || !String(rotulo).trim()) return;
  chamarOpcoes({ acao:'criar', coluna, rotulo });
}

async function trocarMinhaSenha() {
  const atual = document.getElementById('conta-atual')?.value || '';
  const nova = document.getElementById('conta-nova')?.value || '';
  const repete = document.getElementById('conta-nova2');
  if (repete && nova !== repete.value) { showToast('A nova senha e a repetição não batem.', 'error', 5000); return; }
  if (nova.length < 8) { showToast('A nova senha precisa de pelo menos 8 caracteres.', 'error', 5000); return; }
  try {
    const r = await fetch(CONTA_API, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha_atual: atual, senha_nova: nova }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível trocar.');
    ['conta-atual', 'conta-nova', 'conta-nova2'].forEach((id) => { const n = document.getElementById(id); if (n) n.value = ''; });
    showToast('Senha trocada.', 'success', 4000);
    alternarSenhaDaConta(false);
  } catch (erro) { showToast(erro.message, 'error', 6000); }
}

async function acaoPessoa(email, acao) {
  const rotulos = { bloquear: 'tirar o acesso de', liberar: 'liberar', tornar_admin: 'tornar administrador',
                    tirar_admin: 'tirar o administrador de', destravar: 'destravar' };
  if (acao === 'bloquear' && !await confirmarNoPainel(`Tirar o acesso de ${email}?\n\nA pessoa deixa de entrar no painel. Dá para liberar de novo depois.`)) return;
  try {
    const r = await fetch(PESSOAS_API, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, acao }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Falhou.');
    showToast(`Feito: ${rotulos[acao] || acao} ${email}.`, 'success', 4000);
    carregarConta();
  } catch (erro) { showToast(erro.message, 'error', 6000); }
}

// A senha é digitada por quem administra, aqui no navegador — não passa por
// lugar nenhum além do envio para gravar.
async function redefinirSenhaDe(email, nome) {
  const senha = await nomearNoPainel(`Nova senha para ${nome} (${email}).\n\nMínimo 8 caracteres. Anote antes de confirmar: depois de gravada ninguém consegue lê-la de volta.`);
  if (senha === null) return;
  if (String(senha).length < 8) { showToast('A senha precisa de pelo menos 8 caracteres.', 'error', 5000); return; }
  try {
    const r = await fetch(PESSOAS_API, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, acao: 'senha', senha }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Falhou.');
    showToast(`Senha definida para ${nome}. Passe para a pessoa por um canal privado.`, 'success', 7000);
    carregarConta();
  } catch (erro) { showToast(erro.message, 'error', 6000); }
}

// ── acessos ───────────────────────────────────────────────────────────────────
//
// As credenciais de cada cliente viviam num documento dentro do Monday — a coisa
// mais presa lá de todas, porque documento não sai por exportação de item.
//
// A lista mostra só metadado. O conteúdo vem numa segunda chamada, um de cada
// vez, e não fica na tela: abrir esta aba não pode deixar 43 senhas paradas na
// memória do navegador de quem só queria conferir a equipe.
function blocoAcessos() {
  const linhas = ACESSOS.map((a) => {
    const nome = String(a.nome || '').replace(/^Dados\s*&\s*Acessos\s*[-–—]\s*/i, '');
    return `
    <div class="eq-linha ${a.grupo === 'Inativos' ? 'fora' : ''}">
      <div class="eq-quem">
        <b>${safeText(nome)}</b>
        <span class="eq-email">${a.cliente ? safeText(a.cliente) : 'sem cliente vinculado'}</span>
      </div>
      <div class="eq-estado">
        ${a.tem_documento ? `documento com ${a.tamanho} caracteres` : '<b class="eq-travado">sem documento</b>'}
        ${a.pasta_drive ? ' · tem pasta no Drive' : ''}
      </div>
      <div class="eq-acoes">
        ${a.tem_documento ? `<button onclick="verAcesso(${a.id})">ver credenciais</button>` : ''}
        ${a.pasta_drive ? `<a class="ac-link" href="${safeText(a.pasta_drive)}" target="_blank" rel="noopener">drive ↗</a>` : ''}
        ${a.link ? `<a class="ac-link" href="${safeText(a.link)}" target="_blank" rel="noopener">link ↗</a>` : ''}
      </div>
    </div>`;
  }).join('');

  const semDoc = ACESSOS.filter((a) => !a.tem_documento).length;
  return cabecaDaSecao('Credenciais dos clientes',
    `Preservadas no domínio próprio da Vybe.${semDoc ? ` ${semDoc} clientes estão sem documento — a lacuna é do cadastro, não da migração.` : ''} O conteúdo só é buscado quando você clica, um de cada vez.`)
    + `<div class="eq-lista">${linhas || '<div class="auto-carregando">Nenhum acesso cadastrado.</div>'}</div>
    <div id="acesso-aberto"></div>`;
}

async function verAcesso(id) {
  const caixa = document.getElementById('acesso-aberto');
  if (!caixa) return;
  caixa.innerHTML = '<div class="auto-carregando">BUSCANDO…</div>';
  caixa.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const r = await fetch(`${ACESSOS_API}&id=${encodeURIComponent(id)}`, { credentials: 'same-origin' });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível abrir.');
    const a = d.acesso;
    const nome = String(a.nome || '').replace(/^Dados\s*&\s*Acessos\s*[-–—]\s*/i, '');
    caixa.innerHTML = `
      <div class="ac-doc">
        <div class="ac-doc-topo">
          <b>${safeText(nome)}</b>
          <div>
            <button onclick="copiarAcesso(${a.id})">copiar</button>
            <button onclick="document.getElementById('acesso-aberto').innerHTML=''">fechar</button>
          </div>
        </div>
        <pre id="ac-doc-texto">${safeText(a.doc_conteudo || '')}</pre>
      </div>`;
  } catch (erro) {
    caixa.innerHTML = `<div class="auto-carregando">Não foi possível abrir<br><small>${safeText(erro.message)}</small></div>`;
  }
}

async function copiarAcesso() {
  const el = document.getElementById('ac-doc-texto');
  if (!el) return;
  try {
    await navigator.clipboard.writeText(el.textContent || '');
    showToast('Credenciais copiadas.', 'success', 3000);
  } catch { showToast('Não consegui copiar; selecione o texto na tela.', 'info', 5000); }
}

// Troca da própria foto. Vai para o Drive, como qualquer arquivo nosso.
async function enviarMinhaFoto(input) {
  const arquivo = input?.files?.[0];
  if (!arquivo) return;
  if (arquivo.size > 2 * 1024 * 1024) {
    showToast('Imagem grande demais; até 2 MB.', 'error', 5000);
    input.value = ''; return;
  }
  showToast('Enviando sua foto...', 'info', 5000);
  try {
    const base64 = await new Promise((ok, erro) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result).split(',')[1]);
      leitor.onerror = erro;
      leitor.readAsDataURL(arquivo);
    });
    const r = await fetch(CONTA_API, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foto: base64, nome: arquivo.name }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || 'Não foi possível enviar.');
    const alvo = document.getElementById('conta-foto-atual');
    if (alvo) alvo.innerHTML = `<img src="${d.foto_url}" alt="Sua foto">`;
    if (MINHA_CONTA) { MINHA_CONTA.foto_url = d.foto_url; pintarContaAI(); }
    showToast('✓ Foto atualizada. Ela aparece para o time no próximo carregamento.', 'ok', 6000);
  } catch (erro) {
    showToast(`Não foi possível enviar: ${erro.message}`, 'error', 7000);
  } finally { input.value = ''; }
}

// Conserto dos arquivos que subiram antes de a liberacao existir. Vai em lotes
// porque cada arquivo e uma ida ao Google e a funcao tem tempo contado; o
// servidor devolve quantos faltam e o botao repete ate zerar, contando o
// progresso em voz alta em vez de deixar a pessoa olhando para um botao parado.
async function liberarPreviasDeArquivos(botao) {
  const nota = document.getElementById('conta-previas-nota');
  const dizer = (t) => { if (nota) nota.textContent = t; };
  botao.disabled = true;
  let liberados = 0;
  let falharam = [];
  try {
    for (let volta = 0; volta < 40; volta += 1) {
      botao.textContent = liberados ? `Liberando… ${liberados} prontos` : 'Liberando…';
      const r = await fetch('/api/painel?area=peca&acao=liberar-previas&limite=40',
        { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      liberados += Number(d.liberados) || 0;
      falharam = falharam.concat(d.falharam || []);
      dizer(`${liberados} liberado${liberados === 1 ? '' : 's'}${d.faltam ? ` · faltam ${d.faltam}` : ''}`);
      // Sem pendente e sem ninguem liberado nesta volta, nao ha o que repetir.
      if (!d.faltam || (!d.liberados && !(d.falharam || []).length)) break;
    }
    const recado = falharam.length
      ? `${liberados} prévia${liberados === 1 ? '' : 's'} liberada${liberados === 1 ? '' : 's'} · ${falharam.length} não deu: ${falharam.slice(0, 2).map((f) => f.nome).join(', ')}`
      : `${liberados} prévia${liberados === 1 ? '' : 's'} liberada${liberados === 1 ? '' : 's'}. Recarregue a peça para ver.`;
    dizer(recado);
    showToast(recado, falharam.length ? 'info' : 'ok', 8000);
  } catch (erro) {
    dizer(`Não deu: ${erro.message}`);
    showToast(`Não foi possível liberar as prévias: ${erro.message}`, 'err', 8000);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Liberar prévias antigas';
  }
}
