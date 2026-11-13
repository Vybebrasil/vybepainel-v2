// vybe-login.js — portão de entrada.
//
// Carrega antes do vybe-init.js e segura a inicialização até existir sessão.
// Sem isso, o painel abria direto na escolha de estação e qualquer pessoa com a
// URL via a operação inteira.

let SESSAO_ATUAL = null;

function sessaoAtual() { return SESSAO_ATUAL; }
// Dono (Paulo, Vinícius, Ewerton e Deivid): quem decide é o servidor (server/donos.js, pelo id da pessoa, campo `dono`
// de /api/sessao). Nenhuma tela decide pelo primeiro nome.
function souDonoDaSessao() { return Boolean(SESSAO_ATUAL && SESSAO_ATUAL.dono === true); }

async function consultarSessao() {
  try {
    const resposta = await fetch('/api/sessao', { credentials: 'same-origin' });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return dados?.pessoa || null;
  } catch {
    return null;
  }
}

// Saudação pela hora do dia. O painel abre dizendo bom dia antes de pedir
// qualquer coisa — quem senta na máquina é gente, não usuário.
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ── os rostos da porta ───────────────────────────────────────────────────────
//
// A porta pergunta quem está operando e mostra o time. Ninguém digita e-mail:
// clica na própria cara e informa a senha.
//
// O que a tela publica: rosto e primeiro nome de quem já tem senha. O e-mail
// fica no servidor — o login manda o id que a própria porta devolveu. Quem abrir
// a URL descobre quem trabalha aqui; a senha continua sendo tudo que separa isso
// de entrar, e o bloqueio por tentativas segue valendo.
//
// A ordem começa por quem entrou por último NESTE computador: na máquina de cada
// um, a própria cara fica em primeiro.

let ROSTOS = [];
let ESCOLHIDO = null;
const ULTIMO_ROSTO = 'vybe_ultimo_rosto';

function ultimoRosto() {
  try { return Number(localStorage.getItem(ULTIMO_ROSTO)) || null; } catch { return null; }
}

function lembrarRosto(id) {
  try { localStorage.setItem(ULTIMO_ROSTO, String(id)); } catch { /* navegador sem storage */ }
}

async function carregarRostos() {
  try {
    const resposta = await fetch('/api/sessao?rostos=1', { credentials: 'same-origin' });
    if (!resposta.ok) return [];
    const dados = await resposta.json();
    const lista = Array.isArray(dados?.rostos) ? dados.rostos : [];
    const ultimo = ultimoRosto();
    return lista.sort((a, b) => (b.id === ultimo) - (a.id === ultimo));
  } catch {
    return [];
  }
}

// Padrão v2 (quadro "Login e entrada" do moodboard, 12/11/2026): um campo por vez. Passo 1, quem é você (os rostos);
// passo 2, a senha, com a pessoa cumprimentada pelo nome. Neste computador, quem entrou por último já cai no passo 2.
// "Trocar" volta aos rostos; "Outra pessoa" troca direto; "Não estou na lista" pede o e-mail e depois a senha.
const escLogin = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function avatarLoginHtml(r, classe = 'v2lg-av') {
  return `<span class="${classe}" aria-hidden="true">${r.foto ? `<img src="${escLogin(r.foto)}" alt="" loading="lazy">` : escLogin(r.iniciais || String(r.nome || '?').slice(0, 2).toUpperCase())}</span>`;
}
function rostosHtml() {
  return ROSTOS.map((r) => `
    <button type="button" class="v2lg-rosto" onclick="escolherRosto(${Number(r.id)})">${avatarLoginHtml(r)}<b>${escLogin(r.nome)}</b></button>`).join('');
}
function passoDoLogin(passo) {
  const caixa = document.getElementById('login-form');
  if (!caixa) return;
  caixa.dataset.passo = passo;
  const botao = document.getElementById('login-entrar');
  if (botao && !botao.disabled) botao.textContent = passo === 'email' ? 'Continuar' : 'Entrar';
  const erro = document.getElementById('login-erro');
  if (erro) erro.hidden = true;
}
// "Outra pessoa": os outros rostos, pequenos, no pé do passo 2 (um toque troca).
function pintarOutros() {
  const caixa = document.getElementById('login-outros');
  if (!caixa) return;
  const outros = ROSTOS.filter((r) => !ESCOLHIDO || r.id !== ESCOLHIDO.id).slice(0, 4);
  caixa.innerHTML = outros.map((r) => `<button type="button" class="v2lg-mini" onclick="escolherRosto(${Number(r.id)})" title="${escLogin(r.nome)}" aria-label="Entrar como ${escLogin(r.nome)}">${avatarLoginHtml(r, 'v2lg-av p')}</button>`).join('');
  caixa.hidden = !outros.length;
}

// Os rostos chegam depois da tela: a saudação não espera a rede para aparecer.
async function pintarRostos() {
  ROSTOS = await carregarRostos();
  const caixa = document.getElementById('login-form');
  const lista = document.getElementById('login-rostos-lista');
  if (!caixa || !lista) return;
  caixa.classList.remove('carregando-rostos');

  // Banco fora do ar, ou ninguém com senha ainda: volta para e-mail e senha, que
  // sempre funciona. Uma porta que não abre é pior que uma porta sem graça.
  if (!ROSTOS.length) { usarOutroEmail(); return; }

  lista.innerHTML = rostosHtml();
  caixa.classList.add('tem-rostos');
  // Quem entrou por último neste computador: o login já cumprimenta e pede só a senha.
  const ultimo = ultimoRosto();
  if (caixa.dataset.passo === 'quem' && ultimo && ROSTOS.some((r) => r.id === ultimo)) escolherRosto(ultimo);
  else document.querySelector('#login-rostos-lista button')?.focus({ preventScroll: true });
}

function escolherRosto(id) {
  ESCOLHIDO = ROSTOS.find((r) => r.id === Number(id)) || null;
  if (!ESCOLHIDO) return;
  const nome = document.getElementById('login-nome');
  if (nome) nome.textContent = ESCOLHIDO.nome;
  const av = document.getElementById('login-av');
  if (av) av.outerHTML = avatarLoginHtml(ESCOLHIDO, 'v2lg-av g').replace('<span ', '<span id="login-av" ');
  const email = document.getElementById('login-email');
  if (email) email.value = '';
  pintarOutros();
  passoDoLogin('senha');
  document.getElementById('login-senha')?.focus();
}

// Clicou na cara errada. Sem isto, a saída era recarregar a página.
function voltarParaAsContas() {
  ESCOLHIDO = null;
  const email = document.getElementById('login-email');
  const senha = document.getElementById('login-senha');
  if (email) email.value = '';
  if (senha) senha.value = '';
  if (!ROSTOS.length) { usarOutroEmail(); return; }
  passoDoLogin('quem');
  document.querySelector('#login-rostos-lista button')?.focus({ preventScroll: true });
}

// Saída para quem não está na lista — conta nova que ainda não tem senha, ou
// alguém entrando por outro endereço. Um campo por vez: o e-mail, depois a senha.
function usarOutroEmail() {
  ESCOLHIDO = null;
  const campo = document.getElementById('login-email');
  if (campo) campo.value = '';
  const senha = document.getElementById('login-senha');
  if (senha) senha.value = '';
  passoDoLogin('email');
  campo?.focus();
}

function montarTelaDeLogin() {
  document.body.classList.add('auth-pending');
  if (document.getElementById('login-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'login-gate';
  // Sem a cena antes do login (quadro "Login e entrada"): a porta já é o login, e cumprimenta.
  gate.className = 'v2lg-portao';
  gate.dataset.etapa = 'login';
  window.VYBELANDIA_VISTA = true; // a abertura do escritório não repete a cena
  const ola = saudacao();
  gate.innerHTML = `
    <form class="v2lg carregando-rostos" id="login-form" autocomplete="on" data-passo="quem" novalidate>
      <div class="v2lg-marca"><span class="v2lg-logo" aria-hidden="true">V</span><b>Vybe OS</b>
        <span class="v2lg-pts" aria-hidden="true"><i class="um"></i><i class="dois"></i></span></div>
      <div class="v2lg-quem">
        <p class="v2lg-ola"><span class="v2lg-sub">${ola}</span><b id="login-titulo">Quem é você?</b></p>
        <div class="v2lg-rostos" id="login-rostos-lista" role="group" aria-label="Quem está entrando">
          <span class="v2lg-rosto-vazio"></span><span class="v2lg-rosto-vazio"></span><span class="v2lg-rosto-vazio"></span>
        </div>
      </div>
      <div class="v2lg-eu">
        <span class="v2lg-av g" id="login-av" aria-hidden="true"></span>
        <p class="v2lg-ola"><span class="v2lg-sub">${ola}</span><b id="login-nome"></b></p>
        <button type="button" class="v2lg-btn s" onclick="voltarParaAsContas()">Trocar</button>
      </div>
      <p class="v2lg-ola v2lg-so-email"><span class="v2lg-sub">${ola}</span><b>Entrar com o e-mail</b></p>
      <label class="v2lg-campo v2lg-campo-email">
        <span>Seu e-mail</span>
        <input type="email" id="login-email" name="email" autocomplete="username" inputmode="email" placeholder="voce@gmail.com">
      </label>
      <label class="v2lg-campo v2lg-campo-senha">
        <span>Sua senha</span>
        <input type="password" id="login-senha" name="senha" autocomplete="current-password" placeholder="Digite a senha">
      </label>
      <div class="v2lg-erro" id="login-erro" role="alert" hidden></div>
      <button type="submit" class="v2lg-entrar" id="login-entrar">Entrar</button>
      <div class="v2lg-pe">
        <span class="v2lg-sub v2lg-pe-rot">Outra pessoa</span>
        <span class="v2lg-avs" id="login-outros" hidden></span>
        <button type="button" class="v2lg-chip v2lg-outro" onclick="usarOutroEmail()">Não estou na lista</button>
        <button type="button" class="v2lg-chip v2lg-voltar" onclick="voltarParaAsContas()">Escolher pelo rosto</button>
      </div>
      <p class="v2lg-ajuda">Se não lembrar a senha, peça ao Paulo.</p>
    </form>`;
  document.body.appendChild(gate);
  pintarRostos();

  const form = document.getElementById('login-form');
  const erro = document.getElementById('login-erro');
  const botao = document.getElementById('login-entrar');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const senha = document.getElementById('login-senha').value;
    const email = document.getElementById('login-email').value.trim();
    // Passo do e-mail: confere o endereço e passa para a senha, sem ir ao servidor.
    if (form.dataset.passo === 'email') {
      const campo = document.getElementById('login-email');
      if (!email || (campo.checkValidity && !campo.checkValidity())) {
        erro.textContent = email ? 'Confira o e-mail: falta alguma parte.' : 'Escreva o e-mail cadastrado na operação.';
        erro.hidden = false; campo.focus(); return;
      }
      const nome = document.getElementById('login-nome');
      if (nome) nome.textContent = email;
      const av = document.getElementById('login-av');
      if (av) av.textContent = email.slice(0, 2).toUpperCase();
      pintarOutros();
      passoDoLogin('senha');
      document.getElementById('login-senha').focus();
      return;
    }
    if (!ESCOLHIDO && !email) {
      erro.textContent = 'Toque na sua foto para dizer quem você é.';
      erro.hidden = false;
      return;
    }
    if (!senha) {
      erro.textContent = 'Digite a senha para entrar.';
      erro.hidden = false;
      document.getElementById('login-senha').focus();
      return;
    }
    erro.hidden = true;
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    try {
      const resposta = await fetch('/api/sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(ESCOLHIDO ? { pessoa_id: ESCOLHIDO.id, senha } : { email, senha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.error || 'Não foi possível entrar.');
      SESSAO_ATUAL = dados.pessoa;
      lembrarRosto(dados.pessoa.id);
      // A entrada logo depois do login (vybe-mundo.js, mostrarEntrada): só quando a pessoa acabou de entrar por aqui.
      window.VYBE_ACABOU_DE_ENTRAR = true;
      gate.remove();
      iniciarPainel();
    } catch (falha) {
      erro.textContent = falha.message;
      erro.hidden = false;
      botao.disabled = false;
      botao.textContent = 'Entrar';
      document.getElementById('login-senha').select();
    }
  });
}

// A abertura pergunta uma vez: o convite do Escritório (vybe-escritorio-convidado.js)
// e o portão abaixo usam a mesma resposta.
let SESSAO_DA_ABERTURA = null;
function consultarSessaoDaAbertura() {
  return (SESSAO_DA_ABERTURA ??= consultarSessao());
}

// Chamado pelo vybe-init.js: devolve a sessão, ou mostra o login e devolve null.
async function garantirSessao() {
  SESSAO_ATUAL = await consultarSessaoDaAbertura();
  if (SESSAO_ATUAL) return SESSAO_ATUAL;
  // O painel não pode aparecer por trás do login.
  document.getElementById('loading')?.classList.remove('show');
  document.getElementById('mode-gate')?.classList.remove('open');
  montarTelaDeLogin();
  return null;
}

async function sairDaSessao() {
  try {
    const r = await fetch('/api/sessao', { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) throw new Error('Não foi possível encerrar a sessão.');
    for (const chave of Object.keys(localStorage)) {
      // "Continuar de onde parou" é guardado por pessoa (vybe.continuar.<id>): fica para a próxima entrada dela.
      if (chave.startsWith('vybe') && chave !== ULTIMO_ROSTO && !chave.startsWith('vybe.continuar.')) localStorage.removeItem(chave);
    }
  } catch { showToast('Não foi possível sair. Verifique a conexão e tente novamente.', 'error'); return; }
  location.reload();
}

// ── quem está logado ─────────────────────────────────────────────────────────
//
// O painel tinha login e não mostrava em que conta você estava, nem como sair —
// a função de sair existia e nenhum botão chamava ela. Com o time todo entrando
// com contas diferentes, isso deixa de ser detalhe.

function pintarQuemSou() {
  const eu = sessaoAtual();
  const caixa = document.getElementById('quem-sou');
  if (!caixa || !eu) return;
  const primeiro = String(eu.nome || '').trim().split(/\s+/)[0] || 'Você';
  const iniciais = String(eu.nome || '?').trim().split(/\s+/).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase();

  caixa.style.display = '';
  const marca = document.getElementById('quem-sou-inicial');
  // Escrever as iniciais por cima apagaria a foto que ja carregou — e esta
  // funcao agora e chamada de novo toda vez que o portao abre. As iniciais so
  // entram enquanto nao ha foto.
  if (!marca.querySelector('img')) marca.textContent = iniciais;
  // A foto existe no banco desde a migração para o Drive, e esta era a única
  // marca do painel que ainda mostrava as duas letras. As iniciais ficam como
  // alternativa: enquanto a foto não chega, e para quem não tem foto.
  vestirFotoDeQuemSou(marca);
  const avatar = document.getElementById('quem-sou-avatar');
  if (avatar && !avatar.querySelector('img')) { avatar.textContent = iniciais; vestirFotoDeQuemSou(avatar); }
  document.getElementById('quem-sou-nome').textContent = primeiro;
  document.getElementById('quem-sou-completo').textContent = eu.nome || '';
  document.getElementById('quem-sou-email').textContent = eu.email || '';
  document.getElementById('quem-sou-papel').textContent = eu.admin
    ? 'Administra o painel' : 'Acesso da equipe';
}

// A sessão não carrega imagem — o cookie guarda nome, e-mail e permissão. A foto
// vem numa consulta só, guardada para não repetir a cada desenho.
let FOTO_DE_QUEM_SOU;
async function vestirFotoDeQuemSou(marca) {
  if (!marca) return;
  const pintar = (url) => {
    if (!url || marca.querySelector('img')) return;
    const img = new Image();
    img.onload = () => { marca.textContent = ''; marca.appendChild(img); marca.classList.add('com-foto'); };
    img.alt = '';
    img.src = url;
  };
  // A marca do topo e o avatar pedem juntos: a mesma consulta serve aos dois.
  FOTO_DE_QUEM_SOU ??= (async () => {
    try {
      const r = await fetch('/api/painel?area=conta', { credentials: 'same-origin' });
      const d = r.ok ? await r.json() : null;
      return d?.pessoa?.foto_url || null;
    } catch { return null; }
  })();
  pintar(await FOTO_DE_QUEM_SOU);
}

function alternarMenuDaConta() {
  const menu = document.getElementById('quem-sou-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function irParaMinhaConta() {
  // Vindo do portão, é preciso entrar em alguma estação antes de mostrar uma aba;
  // sem isso a tela fica no portão e o clique parece não fazer nada.
  const gate = document.getElementById('mode-gate');
  if (gate && gate.classList.contains('open')) {
    if (typeof panelMode !== 'undefined' && typeof applyPanelMode === 'function') {
      panelMode = 'gestor';
      applyPanelMode();
    }
    if (typeof closeModeGate === 'function') closeModeGate();
  }
  const doCabecalho = document.getElementById('quem-sou-menu');
  if (doCabecalho) doCabecalho.style.display = 'none';
  const btn = document.getElementById('btn-board-conta');
  if (btn && typeof switchBoard === 'function') switchBoard('conta', btn);
}

document.addEventListener('click', (evento) => {
  const menu = document.getElementById('quem-sou-menu');
  if (menu && menu.style.display !== 'none' && !evento.target.closest('#quem-sou')) {
    menu.style.display = 'none';
  }
});
