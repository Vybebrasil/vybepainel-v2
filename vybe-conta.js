// vybe-conta.js — a própria conta e, para quem administra, a equipe.
//
// Antes isto não existia: trocar senha era "pede ao Paulo", e ele resolvia
// direto no banco. Liberar alguém novo, idem.

const CONTA_API = '/api/painel?area=conta';
const PESSOAS_API = '/api/painel?area=pessoas';

let EQUIPE = [];

function ehAdmin() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
}

async function carregarConta() {
  const raiz = document.getElementById('conta-root');
  if (!raiz) return;
  raiz.innerHTML = '<div class="auto-carregando">CARREGANDO…</div>';
  EQUIPE = [];
  if (ehAdmin()) {
    try {
      const r = await fetch(PESSOAS_API, { credentials: 'same-origin' });
      const d = await r.json();
      if (r.ok) EQUIPE = d.pessoas || [];
    } catch { /* a área da conta funciona sem a lista da equipe */ }
  }
  pintarConta();
}

function quandoAcessou(iso) {
  if (!iso) return 'nunca entrou';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias === 0) return 'entrou hoje';
  if (dias === 1) return 'entrou ontem';
  return `entrou há ${dias} dias`;
}

function pintarConta() {
  const raiz = document.getElementById('conta-root');
  const eu = typeof sessaoAtual === 'function' ? sessaoAtual() : null;
  if (!raiz || !eu) return;

  const linhas = EQUIPE.map((p) => {
    const travado = p.bloqueado_ate && new Date(p.bloqueado_ate) > new Date();
    const sou = String(p.email).toLowerCase() === String(eu.email).toLowerCase();
    return `
    <div class="eq-linha ${p.pode_entrar ? '' : 'fora'}">
      <div class="eq-quem">
        <b>${safeText(p.nome)}</b>${p.admin ? '<span class="eq-tag">admin</span>' : ''}${sou ? '<span class="eq-tag eu">você</span>' : ''}
        <span class="eq-email">${safeText(p.email)}</span>
      </div>
      <div class="eq-estado">
        ${p.pode_entrar ? 'liberado' : 'sem acesso'} ·
        ${p.tem_senha ? quandoAcessou(p.ultimo_acesso) : 'sem senha definida'}
        ${travado ? ' · <b class="eq-travado">travado por erro de senha</b>' : ''}
      </div>
      <div class="eq-acoes">
        ${p.pode_entrar
          ? (sou ? '' : `<button onclick="acaoPessoa('${safeText(p.email)}','bloquear')">tirar acesso</button>`)
          : `<button onclick="acaoPessoa('${safeText(p.email)}','liberar')">liberar</button>`}
        ${p.admin
          ? (sou ? '' : `<button onclick="acaoPessoa('${safeText(p.email)}','tirar_admin')">tirar admin</button>`)
          : `<button onclick="acaoPessoa('${safeText(p.email)}','tornar_admin')">tornar admin</button>`}
        ${travado ? `<button onclick="acaoPessoa('${safeText(p.email)}','destravar')">destravar</button>` : ''}
        <button onclick="redefinirSenhaDe('${safeText(p.email)}','${safeText(p.nome)}')">definir senha</button>
      </div>
    </div>`;
  }).join('');

  raiz.innerHTML = `
    <div class="auto-cabeca">
      <div>
        <div class="auto-kicker">VYBE OS · SUA CONTA</div>
        <h2 class="auto-titulo">${safeText(eu.nome)}</h2>
        <p class="auto-sub">${safeText(eu.email)}${eu.admin ? ' · administra o painel' : ''}</p>
      </div>
    </div>

    <div class="conta-caixa">
      <div class="conta-titulo">Trocar minha senha</div>
      <div class="conta-linha">
        <label>Senha atual<input id="conta-atual" type="password" autocomplete="current-password"></label>
        <label>Nova senha<input id="conta-nova" type="password" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label>
        <label>Repita a nova<input id="conta-nova2" type="password" autocomplete="new-password"></label>
        <button class="auto-novo" onclick="trocarMinhaSenha()">Trocar</button>
      </div>
      <p class="auto-ajuda">Ninguém, nem quem administra, consegue ler sua senha — o sistema guarda só uma marca dela. Se esquecer, um administrador define uma nova.</p>
    </div>

    ${eu.admin ? `
    <div class="auto-cabeca" style="margin-top:26px">
      <div>
        <div class="auto-kicker">VYBE OS · EQUIPE</div>
        <h2 class="auto-titulo">Quem entra no painel</h2>
        <p class="auto-sub">Liberar, tirar acesso e definir senha. Oito erros de senha travam a conta por 15 minutos — aqui dá para destravar na hora.</p>
      </div>
    </div>
    <div class="eq-lista">${linhas || '<div class="auto-carregando">Nenhuma pessoa cadastrada.</div>'}</div>` : ''}`;
}

async function trocarMinhaSenha() {
  const atual = document.getElementById('conta-atual')?.value || '';
  const nova = document.getElementById('conta-nova')?.value || '';
  const nova2 = document.getElementById('conta-nova2')?.value || '';
  if (nova !== nova2) { showToast('A nova senha e a repetição não batem.', 'error', 5000); return; }
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
  } catch (erro) { showToast(erro.message, 'error', 6000); }
}

async function acaoPessoa(email, acao) {
  const rotulos = { bloquear: 'tirar o acesso de', liberar: 'liberar', tornar_admin: 'tornar administrador',
                    tirar_admin: 'tirar o administrador de', destravar: 'destravar' };
  if (acao === 'bloquear' && !confirm(`Tirar o acesso de ${email}?\n\nA pessoa deixa de entrar no painel. Dá para liberar de novo depois.`)) return;
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
  const senha = prompt(`Nova senha para ${nome} (${email}).\n\nMínimo 8 caracteres. Anote antes de confirmar: depois de gravada ninguém consegue lê-la de volta.`);
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
