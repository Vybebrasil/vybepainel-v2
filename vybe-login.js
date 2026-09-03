// vybe-login.js — portão de entrada.
//
// Carrega antes do vybe-init.js e segura a inicialização até existir sessão.
// Sem isso, o painel abria direto na escolha de estação e qualquer pessoa com a
// URL via a operação inteira.

let SESSAO_ATUAL = null;

function sessaoAtual() { return SESSAO_ATUAL; }

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

function rostosHtml() {
  return ROSTOS.map((r) => `
    <button type="button" class="login-rosto" onclick="escolherRosto(${r.id})">
      <span class="login-rosto-foto">${r.foto
        ? `<img src="${r.foto}" alt="" loading="lazy">` : `<i>${r.iniciais}</i>`}</span>
      <b>${r.nome}</b>
    </button>`).join('');
}

// Os rostos chegam depois da tela: a saudação não espera a rede para aparecer.
async function pintarRostos() {
  ROSTOS = await carregarRostos();
  const caixa = document.querySelector('#login-gate .login-caixa');
  const lista = document.getElementById('login-rostos-lista');
  if (!caixa || !lista) return;

  // Banco fora do ar, ou ninguém com senha ainda: volta para e-mail e senha, que
  // sempre funciona. Uma porta que não abre é pior que uma porta sem graça.
  if (!ROSTOS.length) {
    caixa.classList.remove('tem-rostos');
    const titulo = document.getElementById('login-titulo');
    if (titulo) titulo.textContent = 'Entrar';
    document.getElementById('login-email')?.focus();
    return;
  }

  lista.innerHTML = rostosHtml();
  caixa.classList.add('tem-rostos');
  caixa.classList.remove('carregando-rostos');
}

function escolherRosto(id) {
  ESCOLHIDO = ROSTOS.find((r) => r.id === Number(id)) || null;
  const titulo = document.getElementById('login-titulo');
  if (titulo && ESCOLHIDO) titulo.textContent = ESCOLHIDO.nome;
  // 'escolhida' esconde os rostos: dali em diante é só a senha.
  document.querySelector('#login-gate .login-caixa')?.classList.add('escolhida');
  document.getElementById('login-senha')?.focus();
}

// Clicou na cara errada. Sem isto, a saída era recarregar a página.
function voltarParaAsContas() {
  ESCOLHIDO = null;
  const caixa = document.querySelector('#login-gate .login-caixa');
  if (caixa) caixa.classList.remove('com-email', 'escolhida');
  const titulo = document.getElementById('login-titulo');
  if (titulo) titulo.textContent = ROSTOS.length ? 'Quem está operando?' : 'Entrar';
  const email = document.getElementById('login-email');
  const senha = document.getElementById('login-senha');
  if (email) email.value = '';
  if (senha) senha.value = '';
  const erro = document.getElementById('login-erro');
  if (erro) erro.hidden = true;
}

// Saída para quem não está na lista — conta nova que ainda não tem senha, ou
// alguém entrando por outro endereço.
function usarOutroEmail() {
  ESCOLHIDO = null;
  const titulo = document.getElementById('login-titulo');
  if (titulo) titulo.textContent = 'Entrar';
  document.querySelector('#login-gate .login-caixa')?.classList.add('com-email');
  const campo = document.getElementById('login-email');
  if (campo) { campo.value = ''; campo.focus(); }
}

function montarTelaDeLogin() {
  if (document.getElementById('login-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'login-gate';
  gate.innerHTML = `
    <form class="login-caixa carregando-rostos" id="login-form" autocomplete="on">
      <div class="login-marca"><span class="login-logo">V</span>
        <div><b>Vybe OS</b><small>Painel de Produção</small></div>
      </div>
      <p class="login-saudacao">${saudacao()}.</p>
      <h1 id="login-titulo">Quem está operando?</h1>
      <p class="login-ajuda login-so-sem-rostos">Use o e-mail cadastrado na operação. Se não lembrar a senha, peça ao Paulo.</p>
      <div class="login-rostos">
        <p class="login-ajuda">Toque na sua foto e informe sua senha.</p>
        <div class="login-rostos-lista" id="login-rostos-lista">
          <span class="login-rosto-vazio"></span><span class="login-rosto-vazio"></span>
          <span class="login-rosto-vazio"></span><span class="login-rosto-vazio"></span>
        </div>
        <button type="button" class="login-outro" onclick="usarOutroEmail()">Não estou na lista</button>
      </div>
      <label class="login-campo login-campo-email">
        <span>E-mail</span>
        <input type="email" id="login-email" name="email" autocomplete="username"
               inputmode="email" placeholder="voce@gmail.com">
      </label>
      <label class="login-campo">
        <span>Senha</span>
        <input type="password" id="login-senha" name="senha" autocomplete="current-password"
               required placeholder="••••••••">
      </label>
      <button type="button" class="login-voltar" onclick="voltarParaAsContas()">← Não sou eu</button>
      <div class="login-erro" id="login-erro" role="alert" hidden></div>
      <button type="submit" class="login-entrar" id="login-entrar">Entrar</button>
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
    if (!ESCOLHIDO && !email) {
      erro.textContent = 'Toque na sua foto para dizer quem você é.';
      erro.hidden = false;
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

// Chamado pelo vybe-init.js: devolve a sessão, ou mostra o login e devolve null.
async function garantirSessao() {
  SESSAO_ATUAL = await consultarSessao();
  if (SESSAO_ATUAL) return SESSAO_ATUAL;
  // O painel não pode aparecer por trás do login.
  document.getElementById('loading')?.classList.remove('show');
  document.getElementById('mode-gate')?.classList.remove('open');
  montarTelaDeLogin();
  return null;
}

async function sairDaSessao() {
  try {
    await fetch('/api/sessao', { method: 'DELETE', credentials: 'same-origin' });
  } catch { /* mesmo falhando, recarregar leva de volta ao login */ }
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
  if (FOTO_DE_QUEM_SOU !== undefined) return pintar(FOTO_DE_QUEM_SOU);
  try {
    const r = await fetch('/api/painel?area=conta', { credentials: 'same-origin' });
    const d = r.ok ? await r.json() : null;
    FOTO_DE_QUEM_SOU = d?.pessoa?.foto_url || null;
  } catch { FOTO_DE_QUEM_SOU = null; }
  pintar(FOTO_DE_QUEM_SOU);
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
