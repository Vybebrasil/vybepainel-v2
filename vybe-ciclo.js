// ─── CICLO DE VIDA: CRIAR, MANDAR PARA O SUBSOLO, REVIVER E APAGAR ────────────
//
// O único lugar do navegador que chama o ciclo de vida do servidor
// (server/ciclo-de-vida.js), para cliente e para colaborador. A Equipe, a mesa
// do Centro de Operação e o subsolo do Escritório usam estas mesmas janelas:
// o gesto e as perguntas são iguais em todo lugar, e ninguém reimplementa o
// "tem certeza?" do apagar.
//
// Quem chama passa `depois`, para repintar a sua tela quando der certo.

const CICLO_API = { cliente: '/api/painel?area=clientes', pessoa: '/api/painel?area=pessoas' };
const CICLO_NOME = { cliente: 'cliente', pessoa: 'colaborador' };
let cicloPendente = null;

async function cicloChamar(tipo, corpo) {
  const r = await fetch(CICLO_API[tipo], {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'O painel não respondeu.');
  return d;
}

function cicloJanela(html) {
  openWorkflowModal(`<div class="ciclo-janela">${html}</div>`);
  setTimeout(() => document.querySelector('.ciclo-janela input, .ciclo-janela textarea')?.focus(), 30);
}

async function cicloConcluir(botao, executar, mensagem) {
  const p = cicloPendente;
  if (!p) return;
  if (botao) botao.disabled = true;
  try {
    const d = await executar(p);
    closeWorkflowModal();
    cicloPendente = null;
    showToast(typeof mensagem === 'function' ? mensagem(d, p) : mensagem, 'success', 5000);
    if (typeof p.depois === 'function') await p.depois(d);
  } catch (erro) {
    if (botao) botao.disabled = false;
    const aviso = document.getElementById('ciclo-erro');
    if (aviso) aviso.textContent = erro.message; else showToast(erro.message, 'error', 6000);
  }
}

// ── criar ────────────────────────────────────────────────────────────────────
function abrirNovoNoCiclo(tipo, { depois } = {}) {
  cicloPendente = { tipo, depois };
  const pessoa = tipo === 'pessoa';
  cicloJanela(`<div class="workflow-kicker">Novo ${CICLO_NOME[tipo]}</div>
    <h2 class="workflow-title">${pessoa ? 'Quem chega no time?' : 'Qual cliente chegou?'}</h2>
    <p>${pessoa
      ? 'Ganha sala no Escritório quando você definir a senha dele na Equipe. Se o e-mail já foi de alguém do subsolo, essa pessoa volta em vez de duplicar.'
      : 'Senta numa mesa livre do Centro de Operação e aparece no Hub. Se o nome já foi de um cliente do subsolo, ele volta em vez de duplicar.'}</p>
    <div class="conta-form">
      <label>Nome<input id="ciclo-nome" maxlength="${pessoa ? 120 : 200}" autocomplete="off"></label>
      ${pessoa ? `<label>E-mail (é o login)<input id="ciclo-email" type="email" required autocomplete="off"></label>
      <label>Papel<input id="ciclo-papel" maxlength="80" placeholder="Design, Vídeo, Atendimento…" autocomplete="off"></label>` : ''}
    </div>
    <p class="ciclo-erro" id="ciclo-erro" role="alert"></p>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="confirmarNovoNoCiclo(this)">Cadastrar</button></div>`);
}
function confirmarNovoNoCiclo(botao) {
  const valor = (id) => document.getElementById(id)?.value?.trim() || '';
  const corpo = { acao: 'criar', nome: valor('ciclo-nome'), email: valor('ciclo-email'), papel: valor('ciclo-papel') };
  return cicloConcluir(botao, (p) => cicloChamar(p.tipo, corpo), (d) => {
    const quem = d.cliente || d.pessoa || {};
    return d.reativado ? `${quem.nome} voltou do subsolo.` : d.ja_existia ? `${quem.nome} já estava ativo.` : `${quem.nome} cadastrado.`;
  });
}

// ── mandar para o subsolo ────────────────────────────────────────────────────
function abrirDesativarNoCiclo(tipo, id, nome, { depois } = {}) {
  cicloPendente = { tipo, id, nome, depois };
  const pessoa = tipo === 'pessoa';
  cicloJanela(`<div class="workflow-kicker">Mandar para o subsolo</div>
    <h2 class="workflow-title">${safeText(nome)}</h2>
    <p>${pessoa
      ? 'Perde o login na hora, a Vybe IA para de responder a ele no WhatsApp e a sala some do Escritório. As peças e o histórico ficam. Dá para reviver pelo subsolo.'
      : 'Sai da mesa do Centro de Operação, das listas e do portal no Hub. Peças, demandas e atas ficam. Dá para reviver pelo subsolo.'}</p>
    <div class="conta-form"><label>Motivo (fica na lápide e na história)<input id="ciclo-motivo" maxlength="300" placeholder="${pessoa ? 'Saiu da agência' : 'Encerrou o contrato'}" autocomplete="off"></label></div>
    <p class="ciclo-erro" id="ciclo-erro" role="alert"></p>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary perigo" onclick="confirmarDesativarNoCiclo(this)">Mandar para o subsolo</button></div>`);
}
function confirmarDesativarNoCiclo(botao) {
  const motivo = document.getElementById('ciclo-motivo')?.value?.trim() || '';
  return cicloConcluir(botao, (p) => cicloChamar(p.tipo, { acao: 'desativar', id: p.id, motivo }), (_, p) => `${p.nome} desceu para o subsolo.`);
}

// ── reviver ──────────────────────────────────────────────────────────────────
async function reviverNoCiclo(tipo, id, nome, { depois } = {}) {
  cicloPendente = { tipo, id, nome, depois };
  return cicloConcluir(null, (p) => cicloChamar(p.tipo, { acao: 'reativar', id: p.id }),
    tipo === 'pessoa' ? `${nome} voltou ao time.` : `${nome} voltou para uma mesa do Centro de Operação.`);
}

// ── apagar para sempre ───────────────────────────────────────────────────────
// Digitar o nome é a trava: um clique errado não apaga ninguém.
function abrirApagarNoCiclo(tipo, id, nome, { depois } = {}) {
  cicloPendente = { tipo, id, nome, depois };
  const pessoa = tipo === 'pessoa';
  cicloJanela(`<div class="workflow-kicker ciclo-perigo">Apagar para sempre</div>
    <h2 class="workflow-title">${safeText(nome)}</h2>
    <p>${pessoa
      ? 'Some o cadastro (e-mail, senha, foto), o vínculo do WhatsApp e o boneco. As peças e demandas em que trabalhou ficam, com o nome congelado.'
      : 'Some o cadastro (contato, CNPJ, contrato, identidade), os acessos das redes, os heads e o portal do Hub. Peças, demandas, atas e planejamentos ficam, com o nome congelado.'}
      <b>Não tem volta.</b></p>
    <div class="conta-form"><label><span>Digite <b>${safeText(nome)}</b> para confirmar</span><input id="ciclo-confirmacao" autocomplete="off" oninput="cicloConferirNome(this)"></label></div>
    <p class="ciclo-erro" id="ciclo-erro" role="alert"></p>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" id="ciclo-apagar" class="workflow-primary perigo" disabled onclick="confirmarApagarNoCiclo(this)">Apagar para sempre</button></div>`);
}
function cicloConferirNome(campo) {
  const botao = document.getElementById('ciclo-apagar');
  if (botao) botao.disabled = campo.value.trim().toLowerCase() !== String(cicloPendente?.nome || '').trim().toLowerCase();
}
function confirmarApagarNoCiclo(botao) {
  const confirmacao = document.getElementById('ciclo-confirmacao')?.value?.trim() || '';
  return cicloConcluir(botao, (p) => cicloChamar(p.tipo, { acao: 'apagar', id: p.id, confirmacao }), (_, p) => `${p.nome} foi apagado para sempre.`);
}
