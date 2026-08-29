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

// ── contas conhecidas neste navegador ────────────────────────────────────────
//
// Mostrar as fotos de todo mundo na tela de login publicaria a equipe inteira:
// quem abrisse a URL veria nomes, rostos e, na prática, metade de cada
// credencial. Aqui só aparece quem já entrou NESTE navegador — na máquina da
// pessoa ela clica na própria cara; numa máquina desconhecida, a tela continua
// sem revelar nada.
//
// Fica em localStorage e some ao limpar o navegador, que é o comportamento certo
// para uma máquina compartilhada.
const CONTAS_CONHECIDAS = 'vybe_contas_deste_navegador';

function contasConhecidas() {
  try { return JSON.parse(localStorage.getItem(CONTAS_CONHECIDAS) || '[]'); }
  catch { return []; }
}

function lembrarConta(pessoa, foto) {
  if (!pessoa?.email) return;
  try {
    const outras = contasConhecidas().filter((c) => c.email !== pessoa.email);
    const lista = [{ nome: pessoa.nome, email: pessoa.email, foto: foto || null }, ...outras].slice(0, 6);
    localStorage.setItem(CONTAS_CONHECIDAS, JSON.stringify(lista));
  } catch { /* navegador sem storage: só não lembra */ }
}

function esquecerConta(email) {
  try {
    localStorage.setItem(CONTAS_CONHECIDAS,
      JSON.stringify(contasConhecidas().filter((c) => c.email !== email)));
  } catch { /* nada a fazer */ }
  const gate = document.getElementById('login-gate');
  if (gate) { gate.remove(); montarTelaDeLogin(); }
}

function escolherConta(email) {
  const campo = document.getElementById('login-email');
  if (campo) campo.value = email;
  const conta = contasConhecidas().find((c) => c.email === email);
  const titulo = document.getElementById('login-titulo');
  if (titulo && conta) titulo.textContent = String(conta.nome || '').split(' ')[0];
  // 'escolhida' esconde a lista e o campo de e-mail: quem clicou na própria cara
  // não precisa ver nem editar o próprio endereço, só a senha.
  document.querySelector('#login-gate .login-caixa')?.classList.add('escolhida');
  document.getElementById('login-senha')?.focus();
}

// Clicou na cara errada. Sem isto, a saída era recarregar a página.
function voltarParaAsContas() {
  const caixa = document.querySelector('#login-gate .login-caixa');
  if (caixa) caixa.classList.remove('com-email', 'escolhida');
  const titulo = document.getElementById('login-titulo');
  if (titulo) titulo.textContent = 'Quem está operando?';
  const email = document.getElementById('login-email');
  const senha = document.getElementById('login-senha');
  if (email) email.value = '';
  if (senha) senha.value = '';
  const erro = document.getElementById('login-erro');
  if (erro) erro.hidden = true;
}

function usarOutroEmail() {
  const titulo = document.getElementById('login-titulo');
  if (titulo) titulo.textContent = 'Entrar';
  document.querySelector('#login-gate .login-caixa')?.classList.add('com-email');
  const campo = document.getElementById('login-email');
  if (campo) { campo.value = ''; campo.focus(); }
}

function contasHtml() {
  const contas = contasConhecidas();
  if (!contas.length) return '';
  const inicial = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase();
  return `
    <div class="login-contas">
      <p class="login-ajuda">Toque na sua foto e informe sua senha.</p>
      <div class="login-contas-lista">
        ${contas.map((c) => `
          <div class="login-conta">
            <button type="button" onclick="escolherConta('${c.email.replace(/'/g, "\\'")}')" title="${c.email}">
              <span class="login-conta-foto">${c.foto
                ? `<img src="${c.foto}" alt="">` : `<i>${inicial(c.nome)}</i>`}</span>
              <b>${String(c.nome || c.email).split(' ')[0]}</b>
            </button>
            <button type="button" class="login-conta-tirar"
                    onclick="esquecerConta('${c.email.replace(/'/g, "\\'")}')"
                    title="Esquecer esta conta neste computador">×</button>
          </div>`).join('')}
      </div>
      <button type="button" class="login-outro" onclick="usarOutroEmail()">Entrar com outro e-mail</button>
    </div>`;
}

function montarTelaDeLogin() {
  if (document.getElementById('login-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'login-gate';
  const temContas = contasConhecidas().length > 0;
  gate.innerHTML = `
    <form class="login-caixa ${temContas ? 'tem-contas' : ''}" id="login-form" autocomplete="on">
      <div class="login-marca"><span class="login-logo">V</span>
        <div><b>Vybe OS</b><small>Painel de Produção</small></div>
      </div>
      <p class="login-saudacao">${saudacao()}.</p>
      <h1 id="login-titulo">${temContas ? 'Quem está operando?' : 'Entrar'}</h1>
      <p class="login-ajuda login-so-sem-contas">Use o e-mail cadastrado na operação. Se não lembrar a senha, peça ao Paulo.</p>
      ${contasHtml()}
      <label class="login-campo login-campo-email">
        <span>E-mail</span>
        <input type="email" id="login-email" name="email" autocomplete="username"
               inputmode="email" required placeholder="voce@gmail.com">
      </label>
      <label class="login-campo">
        <span>Senha</span>
        <input type="password" id="login-senha" name="senha" autocomplete="current-password"
               required placeholder="••••••••">
      </label>
      <button type="button" class="login-voltar" onclick="voltarParaAsContas()">← Não sou eu</button>
      <div class="login-erro" id="login-erro" role="alert" hidden></div>
      <button type="submit" class="login-entrar" id="login-entrar">ENTRAR</button>
    </form>`;
  document.body.appendChild(gate);

  const form = document.getElementById('login-form');
  const erro = document.getElementById('login-erro');
  const botao = document.getElementById('login-entrar');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erro.hidden = true;
    botao.disabled = true;
    botao.textContent = 'ENTRANDO…';
    try {
      const resposta = await fetch('/api/sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: document.getElementById('login-email').value.trim(),
          senha: document.getElementById('login-senha').value,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.error || 'Não foi possível entrar.');
      SESSAO_ATUAL = dados.pessoa;
      // A foto vem numa segunda chamada: o cookie de sessão não carrega imagem.
      try {
        const r = await fetch('/api/painel?area=conta', { credentials: 'same-origin' });
        const d = r.ok ? await r.json() : null;
        lembrarConta(dados.pessoa, d?.pessoa?.foto_url || null);
      } catch { lembrarConta(dados.pessoa, null); }
      gate.remove();
      iniciarPainel();
    } catch (falha) {
      erro.textContent = falha.message;
      erro.hidden = false;
      botao.disabled = false;
      botao.textContent = 'ENTRAR';
      document.getElementById('login-senha').select();
    }
  });

  // Com contas lembradas, o cursor vai para a senha depois do clique na foto —
  // focar o e-mail escondido roubaria o foco.
  if (!temContas) document.getElementById('login-email').focus();
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
  document.getElementById('quem-sou-inicial').textContent = iniciais;
  document.getElementById('quem-sou-nome').textContent = primeiro;
  document.getElementById('quem-sou-completo').textContent = eu.nome || '';
  document.getElementById('quem-sou-email').textContent = eu.email || '';
  document.getElementById('quem-sou-papel').textContent = eu.admin
    ? 'Administra o painel' : 'Acesso da equipe';
}

function alternarMenuDaConta() {
  const menu = document.getElementById('quem-sou-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function alternarContaNoPortao() {
  const menu = document.getElementById('identity-conta-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function irParaMinhaConta() {
  const noPortao = document.getElementById('identity-conta-menu');
  if (noPortao) noPortao.style.display = 'none';
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
  // Fecha o menu do cabeçalho em vez de alternar: vindo do portão ele está
  // fechado, e alternar o abriria sozinho.
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
  const noPortao = document.getElementById('identity-conta-menu');
  if (noPortao && noPortao.style.display !== 'none'
      && !evento.target.closest('#identity-conta-menu')
      && !evento.target.closest('#identity-quem')) {
    noPortao.style.display = 'none';
  }
});
