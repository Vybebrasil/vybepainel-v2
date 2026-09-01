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

function ehAdmin() {
  return Boolean(typeof sessaoAtual === 'function' && sessaoAtual()?.admin);
}

async function carregarConta() {
  const raiz = document.getElementById('conta-root');
  if (!raiz) return;
  raiz.innerHTML = '<div class="auto-carregando">CARREGANDO…</div>';
  EQUIPE = []; CLIENTES = []; OPCOES = null; ACESSOS = [];
  try {
    const r = await fetch(CONTA_API, { credentials: 'same-origin' });
    if (r.ok) MINHA_CONTA = (await r.json()).pessoa || null;
  } catch { MINHA_CONTA = null; }
  if (ehAdmin()) {
    // Cada bloco falha por conta própria: a área da conta não pode sumir porque
    // a lista de clientes não carregou.
    await Promise.all([
      (async () => { try { const r = await fetch(PESSOAS_API, { credentials:'same-origin' }); const d = await r.json(); if (r.ok) EQUIPE = d.pessoas || []; } catch {} })(),
      (async () => { try { const r = await fetch(CLIENTES_API, { credentials:'same-origin' }); const d = await r.json(); if (r.ok) CLIENTES = d.clientes || []; } catch {} })(),
      (async () => { try { const r = await fetch(OPCOES_API, { credentials:'same-origin' }); const d = await r.json(); if (r.ok) OPCOES = d; } catch {} })(),
      (async () => { try { const r = await fetch(ACESSOS_API, { credentials:'same-origin' }); const d = await r.json(); if (r.ok) ACESSOS = d.acessos || []; } catch {} })(),
    ]);
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
  const eu = MINHA_CONTA || (typeof sessaoAtual === 'function' ? sessaoAtual() : null);
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
        <div class="auto-kicker">Vybe OS · Sua conta</div>
        <h2 class="auto-titulo">${safeText(eu.nome)}</h2>
        <p class="auto-sub">${safeText(eu.email)}${eu.admin ? ' · administra o painel' : ''}</p>
      </div>
    </div>

    <div class="conta-caixa">
      <div class="conta-titulo">Minha foto</div>
      <div class="conta-foto">
        <div class="conta-foto-atual" id="conta-foto-atual">${eu.foto_url
          ? `<img src="${safeText(eu.foto_url)}" alt="Sua foto">`
          : `<span>${safeText(String(eu.nome || '?').trim().split(/\s+/).slice(0,2).map((p) => p[0]).join('').toUpperCase())}</span>`}</div>
        <div>
          <input type="file" id="conta-foto-arquivo" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="enviarMinhaFoto(this)">
          <button class="auto-novo" onclick="document.getElementById('conta-foto-arquivo').click()">Escolher imagem</button>
          <p class="auto-ajuda" style="margin:8px 0 0">PNG, JPG ou WEBP, até 2 MB. A imagem fica no Drive próprio da Vybe e permanece disponível no cadastro central da equipe.</p>
        </div>
      </div>
    </div>

    <div class="conta-caixa" style="margin-top:12px">
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
        <div class="auto-kicker">Vybe OS · Manutenção</div>
        <h2 class="auto-titulo">Prévias dos arquivos</h2>
        <p class="auto-sub">Arquivo enviado pelo painel só mostra prévia se estiver liberado para
          leitura por link no Drive. Os que subiram antes dessa liberação existir aparecem como
          “Prévia indisponível”. Abrir a peça já conserta os dela; o botão conserta todos de uma vez.</p>
      </div>
      <button class="auto-novo" onclick="liberarPreviasDeArquivos(this)">Liberar prévias antigas</button>
    </div>
    <p class="auto-ajuda" id="conta-previas-nota" style="margin:-8px 0 4px"></p>

    <div class="auto-cabeca" style="margin-top:26px">
      <div>
        <div class="auto-kicker">Vybe OS · Equipe</div>
        <h2 class="auto-titulo">Quem entra no painel</h2>
        <p class="auto-sub">Liberar, tirar acesso e definir senha. Oito erros de senha travam a conta por 15 minutos — aqui dá para destravar na hora.</p>
      </div>
    </div>
    <div class="eq-lista">${linhas || '<div class="auto-carregando">Nenhuma pessoa cadastrada.</div>'}</div>
    ${blocoClientes()}
    ${blocoOpcoes()}
    ${blocoAcessos()}` : ''}`;
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

  return `
    <div class="auto-cabeca" style="margin-top:26px">
      <div>
        <div class="auto-kicker">Vybe OS · Clientes</div>
        <h2 class="auto-titulo">Quem aparece no painel</h2>
        <p class="auto-sub">Cliente não se apaga, se desativa: apagar arrastaria junto o vínculo de todo conteúdo histórico dele. Desativado some das telas e continua no histórico.</p>
      </div>
      <button class="auto-novo" onclick="criarCliente()">+ Novo cliente</button>
    </div>
    <div class="eq-lista">${linhas || '<div class="auto-carregando">Nenhum cliente cadastrado.</div>'}</div>`;
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

function criarCliente() {
  const nome = prompt('Nome do novo cliente, exatamente como deve aparecer no painel:');
  if (nome === null || !String(nome).trim()) return;
  chamarClientes({ acao:'criar', nome }, 'Cliente criado.');
}

function renomearCliente(id, atual) {
  const nome = prompt('Novo nome do cliente:', atual);
  if (nome === null || !String(nome).trim() || nome === atual) return;
  chamarClientes({ acao:'renomear', id, nome }, 'Cliente renomeado.');
}

function acaoCliente(id, acao) {
  if (acao === 'desativar' && !confirm('Tirar este cliente do painel?\n\nO histórico dele continua; ele só deixa de aparecer nas telas e não pode receber conteúdo novo.')) return;
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

  return `
    <div class="auto-cabeca" style="margin-top:26px">
      <div>
        <div class="auto-kicker">Vybe OS · Opções das colunas</div>
        <h2 class="auto-titulo">O que a ficha oferece</h2>
        <p class="auto-sub">Desligar uma opção tira ela dos seletores sem apagar nada: peças que já a usam continuam mostrando. O catálogo do Vybe OS é a referência dos seletores e preserva o histórico existente.</p>
      </div>
    </div>
    ${grupos.map(([coluna, titulo, itens]) => `
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

function criarOpcao(coluna, titulo) {
  const rotulo = prompt(`Nova opção para “${titulo}”:`);
  if (rotulo === null || !String(rotulo).trim()) return;
  chamarOpcoes({ acao:'criar', coluna, rotulo });
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
  return `
    <div class="auto-cabeca" style="margin-top:26px">
      <div>
        <div class="auto-kicker">Vybe OS · Acessos</div>
        <h2 class="auto-titulo">Credenciais dos clientes</h2>
        <p class="auto-sub">Preservadas no domínio próprio da Vybe.${semDoc ? ` ${semDoc} clientes estão sem documento — a lacuna é do cadastro, não da migração.` : ''} O conteúdo só é buscado quando você clica, um de cada vez.</p>
      </div>
    </div>
    <div class="eq-lista">${linhas || '<div class="auto-carregando">Nenhum acesso cadastrado.</div>'}</div>
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
