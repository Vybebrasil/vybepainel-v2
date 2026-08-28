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

function montarTelaDeLogin() {
  if (document.getElementById('login-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'login-gate';
  gate.innerHTML = `
    <form class="login-caixa" id="login-form" autocomplete="on">
      <div class="login-marca"><span class="login-logo">V</span>
        <div><b>Vybe OS</b><small>Painel de Produção</small></div>
      </div>
      <h1>Entrar</h1>
      <p class="login-ajuda">Use o e-mail cadastrado na operação. Se não lembrar a senha, peça ao Paulo.</p>
      <label class="login-campo">
        <span>E-mail</span>
        <input type="email" id="login-email" name="email" autocomplete="username"
               inputmode="email" required placeholder="voce@gmail.com">
      </label>
      <label class="login-campo">
        <span>Senha</span>
        <input type="password" id="login-senha" name="senha" autocomplete="current-password"
               required placeholder="••••••••">
      </label>
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

  document.getElementById('login-email').focus();
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
