// vybe-clientes-ficha.js — Cadastro único e ficha completa do cliente (Paulo, 09/11/2026).
//
// "Eu preciso que tudo voltado ao cliente seja unificado." Havia três jeitos de
// criar cliente (Clientes, Conta e o subsolo), todos pedindo só o nome, e a ficha
// tinha dez campos soltos. Agora:
//   - um cadastro só, em etapas, com os campos que o servidor define
//     (server/clientes-cadastro.js manda a lista em `cadastro_def`);
//   - a ficha do cliente em abas: Visão geral, Cadastro, Ecossistema e Cérebro;
//   - o Ecossistema mostra onde o cliente existe (Vybe OS, cérebro, bots, Drive,
//     Hub, Finanças) e o que falta em cada um, com o botão para resolver.
// O cérebro continua um só (vybe-clientes-cerebro.js): a aba Cérebro abre o
// mesmo cérebro com este cliente em foco.

let CADASTRO_DEF = null;
let FICHA_ABA = 'geral';
const FICHA_ECOSSISTEMA = {}; // id → { carregando, dados, erro }

function fichaEsc(v) { return typeof safeText === 'function' ? safeText(String(v ?? '')) : String(v ?? ''); }
function fichaAspas(v) { return fichaEsc(String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }

// ── cadastro em etapas ───────────────────────────────────────────────────────
let CADASTRO_ABERTO = null; // { id, nome, etapa, depois }

function valorDoCadastro(f, campo) {
  if (!f) return '';
  const bruto = campo.coluna ? f[campo.coluna] : f.cadastro?.[campo.chave];
  if (bruto === null || bruto === undefined) return '';
  return campo.tipo === 'data' ? String(bruto).slice(0, 10) : String(bruto);
}

function campoDoCadastroHtml(campo, valor) {
  const id = `cad-${campo.chave}`;
  const obrig = campo.obrigatorio ? ' <i class="cad-obrig" title="Essencial para o cadastro completo">•</i>' : '';
  const dica = campo.dica ? `<small>${fichaEsc(campo.dica)}</small>` : '';
  let entrada;
  if (campo.tipo === 'longo') {
    entrada = `<textarea id="${id}" rows="4" maxlength="${campo.max || 4000}">${fichaEsc(valor)}</textarea>`;
  } else if (campo.tipo === 'opcao') {
    entrada = `<select id="${id}"><option value="">Escolher…</option>${campo.opcoes.map((o) =>
      `<option ${o === valor ? 'selected' : ''}>${fichaEsc(o)}</option>`).join('')}</select>`;
  } else if (campo.tipo === 'uf') {
    const ufs = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
    entrada = `<select id="${id}"><option value="">—</option>${ufs.map((u) => `<option ${u === valor ? 'selected' : ''}>${u}</option>`).join('')}</select>`;
  } else {
    const tipo = { data: 'date', email: 'email', url: 'url', dia: 'number', telefone: 'tel' }[campo.tipo] || 'text';
    const ph = { documento: '00.000.000/0000-00', telefone: '(74) 99999-9999', url: 'https://…', dinheiro: '0,00', email: 'nome@empresa.com' }[campo.tipo] || '';
    // Segmento é etiqueta compartilhada: sugere as que já existem, para não nascer "Academia" e "academia".
    const lista = campo.chave === 'segmento' && typeof segmentosExistentes === 'function'
      ? `<datalist id="${id}-lista">${segmentosExistentes().map((s) => `<option value="${fichaEsc(s)}">`).join('')}</datalist>` : '';
    entrada = `<input id="${id}" type="${tipo}" value="${fichaEsc(valor)}" ${ph ? `placeholder="${ph}"` : ''} ${lista ? `list="${id}-lista"` : ''} ${campo.tipo === 'dia' ? 'min="1" max="31"' : ''} autocomplete="off">${lista}`;
  }
  return `<label class="cad-campo${campo.largo ? ' largo' : ''}"><span>${fichaEsc(campo.rotulo)}${obrig}</span>${entrada}${dica}</label>`;
}

function abrirCadastroCompleto(nome = '', { etapa = '', depois = null } = {}) {
  if (typeof podeEditarClientes === 'function' && !podeEditarClientes()) return showToast('Só quem administra cadastra cliente.', 'warning', 4000);
  if (!CADASTRO_DEF) {
    showToast('Carregando o cadastro…', 'info', 2500);
    return ensureClientMasterSources(true).then(() => CADASTRO_DEF ? abrirCadastroCompleto(nome, { etapa, depois }) : showToast('O cadastro não carregou. Recarregue a página.', 'error', 6000));
  }
  const f = nome ? (fichaDoCliente(nome) || CADASTRO_CLIENTES.find((c) => String(c.id) === String(idDoCliente(nome)))) : null;
  const id = f ? String(f.id) : '';
  if (nome && !id) return showToast('Este cliente ainda não tem cadastro próprio. Crie a ficha dele em "Só na operação".', 'warning', 5000);
  const secoes = CADASTRO_DEF.secoes;
  CADASTRO_ABERTO = { id, nome: f?.nome || '', etapa: secoes.some((s) => s.id === etapa) ? etapa : secoes[0].id, depois };
  const drive = nome && typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nome).drive || '' : '';

  const corpo = secoes.map((s) => {
    const campos = CADASTRO_DEF.campos.filter((c) => c.secao === s.id);
    const extra = s.id === 'empresa' ? `<label class="cad-campo largo"><span>Nome do cliente no painel <i class="cad-obrig">•</i></span>
        <input id="cad-nome" type="text" maxlength="200" value="${fichaEsc(f?.nome || '')}" ${id ? 'disabled' : ''} placeholder="Como o time chama o cliente. Ex.: Academia Lions" autocomplete="off">
        <small>${id ? 'Para trocar o nome, use “renomear” em Conta → Clientes: o nome muda em todo o painel.' : 'É o nome que aparece no calendário, na produção, no Hub e para o VYBES.'}</small></label>` : '';
    const pasta = s.id === 'canais' ? `<label class="cad-campo largo"><span>Pasta do cliente no Drive</span>
        <input id="cad-pasta_drive" type="url" value="${fichaEsc(drive)}" placeholder="https://drive.google.com/…" autocomplete="off">
        <small>Peças, planejamentos e o VYBES usam esta pasta.</small></label>` : '';
    return `<fieldset class="cad-etapa" data-etapa="${s.id}" ${s.id === CADASTRO_ABERTO.etapa ? '' : 'hidden'}>
      <legend>${fichaEsc(s.titulo)}</legend><div class="cad-grade">${extra}${campos.map((c) => campoDoCadastroHtml(c, valorDoCadastro(f, c))).join('')}${pasta}</div></fieldset>`;
  }).join('');

  openWorkflowModal(`<div class="cad-janela" role="dialog" aria-modal="true" aria-labelledby="cad-titulo">
    <div class="workflow-kicker"><span>Vybe OS · Cadastro do cliente</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title" id="cad-titulo">${id ? fichaEsc(f.nome) : 'Novo cliente'}</h2>
    <p class="workflow-copy">Um cadastro só para o ecossistema inteiro: o que for preenchido aqui vale no Vybe OS, no cérebro, nos bots e no Hub. Os itens com <i class="cad-obrig">•</i> completam a ficha.</p>
    <nav class="cad-passos" aria-label="Etapas do cadastro">${secoes.map((s, i) =>
      `<button type="button" data-etapa="${s.id}" class="${s.id === CADASTRO_ABERTO.etapa ? 'ativo' : ''}" onclick="irParaEtapaDoCadastro('${s.id}')"><b>${i + 1}</b>${fichaEsc(s.titulo)}</button>`).join('')}</nav>
    <form class="cad-corpo" onsubmit="event.preventDefault()">${corpo}</form>
    <p class="ciclo-erro" id="cad-erro" role="alert"></p>
    <div class="workflow-actions cad-acoes">
      <button type="button" class="workflow-secondary" id="cad-voltar" onclick="passoDoCadastro(-1)">Voltar</button>
      <span class="cli-espaco"></span>
      <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-secondary" id="cad-seguir" onclick="passoDoCadastro(1)">Continuar</button>
      <button type="button" class="workflow-primary" id="cad-salvar" onclick="salvarCadastroCompleto(this)">${id ? 'Salvar cadastro' : 'Cadastrar cliente'}</button>
    </div></div>`);
  document.getElementById('workflow-modal')?.classList.add('cad-modal');
  pintarPassosDoCadastro();
  setTimeout(() => document.querySelector(`.cad-etapa[data-etapa="${CADASTRO_ABERTO.etapa}"] :is(input:not([disabled]),select,textarea)`)?.focus(), 40);
}

function irParaEtapaDoCadastro(etapa) {
  if (!CADASTRO_ABERTO) return;
  CADASTRO_ABERTO.etapa = etapa;
  document.querySelectorAll('.cad-etapa').forEach((el) => { el.hidden = el.dataset.etapa !== etapa; });
  pintarPassosDoCadastro();
  document.querySelector(`.cad-etapa[data-etapa="${etapa}"] :is(input:not([disabled]),select,textarea)`)?.focus();
}
function passoDoCadastro(direcao) {
  const ids = CADASTRO_DEF.secoes.map((s) => s.id);
  const i = ids.indexOf(CADASTRO_ABERTO?.etapa);
  const alvo = ids[Math.max(0, Math.min(ids.length - 1, i + direcao))];
  if (alvo) irParaEtapaDoCadastro(alvo);
}
function pintarPassosDoCadastro() {
  const ids = CADASTRO_DEF.secoes.map((s) => s.id);
  const i = ids.indexOf(CADASTRO_ABERTO?.etapa);
  document.querySelectorAll('.cad-passos button').forEach((b) => {
    const etapa = b.dataset.etapa;
    b.classList.toggle('ativo', etapa === CADASTRO_ABERTO.etapa);
    b.setAttribute('aria-current', etapa === CADASTRO_ABERTO.etapa ? 'step' : 'false');
    // Etapa com essencial vazio ganha um ponto: dá para ver o que falta sem abrir cada uma.
    const falta = CADASTRO_DEF.campos.some((c) => c.secao === etapa && c.obrigatorio && !String(document.getElementById(`cad-${c.chave}`)?.value || '').trim());
    b.classList.toggle('falta', falta);
  });
  const voltar = document.getElementById('cad-voltar'); if (voltar) voltar.disabled = i <= 0;
  const seguir = document.getElementById('cad-seguir'); if (seguir) seguir.hidden = i >= ids.length - 1;
}
document.addEventListener('input', (e) => { if (e.target?.closest?.('.cad-corpo')) pintarPassosDoCadastro(); });

async function salvarCadastroCompleto(botao) {
  const aberto = CADASTRO_ABERTO;
  if (!aberto) return;
  const erro = document.getElementById('cad-erro');
  const campos = {};
  for (const c of CADASTRO_DEF.campos) {
    const el = document.getElementById(`cad-${c.chave}`);
    if (el) campos[c.chave] = String(el.value ?? '').trim();
  }
  const nome = aberto.id ? aberto.nome : String(document.getElementById('cad-nome')?.value || '').trim();
  if (!nome) { irParaEtapaDoCadastro('empresa'); if (erro) erro.textContent = 'Escreva o nome do cliente.'; return; }
  const pasta = String(document.getElementById('cad-pasta_drive')?.value || '').trim();
  if (pasta && typeof linkDeCliente === 'function' && !linkDeCliente(pasta)) {
    irParaEtapaDoCadastro('canais'); if (erro) erro.textContent = 'A pasta do Drive precisa ser um endereço (https://…).'; return;
  }
  if (botao) botao.disabled = true;
  if (erro) erro.textContent = '';
  try {
    const corpo = aberto.id ? { acao: 'cadastro', id: aberto.id, campos } : { acao: 'criar', nome, campos };
    const r = await fetch('/api/painel?area=clientes', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não foi possível salvar.');
    const id = String(aberto.id || d.cliente?.id || '');
    const nomeFinal = d.cliente?.nome || nome;
    // A pasta do Drive mora em Acessos: grava lá, pelo mesmo caminho da tabela.
    const ligado = typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nomeFinal) : {};
    if (id && pasta !== String(ligado.drive || '')) {
      const corpoAcesso = { pasta_drive: pasta, ...(ligado.acessoId ? { id: ligado.acessoId } : { cliente: id }) };
      const ra = await fetch('/api/painel?area=acessos', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoAcesso) });
      if (!ra.ok) showToast('Cadastro salvo, mas a pasta do Drive não gravou. Tente de novo na aba Ecossistema.', 'warning', 7000);
    }
    await ensureClientMasterSources(true);
    if (typeof atualizarCoresDasCarteiras === 'function') atualizarCoresDasCarteiras();
    delete FICHA_ECOSSISTEMA[id];
    const msg = d.reativado ? `${nomeFinal} voltou para o painel.` : d.ja_existia ? `${nomeFinal} já existia; o cadastro foi atualizado.` : aberto.id ? 'Cadastro salvo.' : `${nomeFinal} cadastrado.`;
    showToast(msg, 'success', 4500);
    CADASTRO_ABERTO = null;
    if (typeof aberto.depois === 'function') { closeWorkflowModal(); await aberto.depois(d); return; }
    // Depois de salvar, o que importa é onde o cliente já está e o que falta.
    mostrarEcossistemaNaJanela(id, nomeFinal);
  } catch (e) {
    if (botao) botao.disabled = false;
    if (erro) erro.textContent = e.message; else showToast(e.message, 'error', 6000);
  }
}

async function mostrarEcossistemaNaJanela(id, nome) {
  openWorkflowModal(`<div class="cad-janela"><div class="workflow-kicker"><span>Vybe OS · ${fichaEsc(nome)}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Onde ${fichaEsc(nome)} já está</h2>
    <p class="workflow-copy">O cadastro é um só. Aqui está cada sistema do ecossistema e o que falta em cada um.</p>
    <div id="cad-ecossistema"><div class="auto-carregando">Conferindo os sistemas…</div></div>
    <div class="workflow-actions"><span class="cli-espaco"></span>
      <button type="button" class="workflow-primary" onclick="closeWorkflowModal();abrirFichaNoModulo('${fichaAspas(nome)}', 'ecossistema')">Abrir a ficha</button></div></div>`);
  document.getElementById('workflow-modal')?.classList.add('cad-modal');
  const dados = await carregarEcossistema(id, true);
  const alvo = document.getElementById('cad-ecossistema');
  if (alvo) alvo.innerHTML = ecossistemaHtml(dados, nome);
}

// Quem cadastrou pelo subsolo ou pela Conta não está no módulo Clientes: abre o módulo antes da ficha
// (o mesmo caminho do menu "Gestão de clientes" em vybe-mundo.js).
function abrirFichaNoModulo(nome, aba = 'geral') {
  const painel = document.getElementById('painel-clientes');
  const abrir = () => { abrirClienteDetalhe(nome); trocarAbaDaFicha(aba); };
  const noModulo = painel && getComputedStyle(painel).display !== 'none' && (!window.mundoVoxel?.ligado?.() || document.body.classList.contains('mundo-modulo'));
  if (noModulo) return abrir();
  if (window.mundoVoxel?.ligado?.() && window.mundoVoxel.irPara) { window.mundoVoxel.irPara('clientes'); setTimeout(abrir, 700); return; }
  if (typeof chooseManagerMode === 'function') chooseManagerMode();
  const btn = document.getElementById('btn-board-clientes');
  if (btn && typeof switchBoard === 'function') switchBoard('clientes', btn);
  abrir();
}

// ── ecossistema ──────────────────────────────────────────────────────────────
async function carregarEcossistema(id, forcar = false) {
  if (!id) return { erro: 'Sem cadastro próprio.' };
  const atual = FICHA_ECOSSISTEMA[id];
  if (atual && !forcar && (atual.dados || atual.carregando)) return atual.promessa || atual;
  const estado = { carregando: true };
  estado.promessa = fetch(`/api/painel?area=clientes&ecossistema=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' })
    .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.error || 'Não consegui conferir.'); estado.dados = d; return estado; })
    .catch((e) => { estado.erro = e.message; return estado; })
    .finally(() => { estado.carregando = false; });
  FICHA_ECOSSISTEMA[id] = estado;
  return estado.promessa;
}

const ECO_ROTULO = { ok: 'Está lá', falta: 'Falta', conferir: 'Conferir' };
const ECO_ACAO = {
  cadastro: ['Completar cadastro', (n) => `abrirCadastroCompleto('${n}')`],
  reativar: ['Trazer de volta', (n, id) => `alternarAtivoDoCliente('${id}', false)`],
  cerebro: ['Ver no cérebro', () => `trocarAbaDaFicha('cerebro')`],
  grupo: ['Informar o grupo', (n) => `abrirCadastroCompleto('${n}', { etapa: 'canais' })`],
  drive: ['Ligar a pasta', (n) => `abrirCadastroCompleto('${n}', { etapa: 'canais' })`],
};
function ecossistemaHtml(estado, nome) {
  if (!estado || estado.carregando) return '<div class="auto-carregando">Conferindo os sistemas…</div>';
  if (estado.erro) return `<p class="ciclo-erro">${fichaEsc(estado.erro)}</p>`;
  const { sistemas = [], cliente = {} } = estado.dados || {};
  const n = fichaAspas(nome || cliente.nome);
  const ok = sistemas.filter((s) => s.estado === 'ok').length;
  return `<p class="eco-resumo"><b>${ok} de ${sistemas.length}</b> sistemas com tudo certo.</p>
    <ul class="eco-lista">${sistemas.map((s) => {
      const acao = ECO_ACAO[s.acao];
      const botao = acao && (typeof podeEditarClientes !== 'function' || podeEditarClientes() || s.acao === 'cerebro')
        ? `<button type="button" class="vb-botao" onclick="closeWorkflowModal();${acao[1](n, fichaEsc(cliente.id))}">${acao[0]}</button>`
        : s.link ? `<a class="vb-botao" href="${fichaEsc(s.link)}" target="_blank" rel="noopener">Abrir ↗</a>` : '';
      return `<li class="eco-item eco-${s.estado}"><span class="eco-estado">${ECO_ROTULO[s.estado] || s.estado}</span>
        <div><b>${fichaEsc(s.nome)}</b><p>${fichaEsc(s.detalhe)}</p></div>${botao}</li>`;
    }).join('')}</ul>`;
}

// ── ficha em abas ────────────────────────────────────────────────────────────
const FICHA_ABAS = [['geral', 'Visão geral'], ['cadastro', 'Cadastro'], ['ecossistema', 'Ecossistema'], ['cerebro', 'Cérebro']];

function trocarAbaDaFicha(aba) {
  FICHA_ABA = FICHA_ABAS.some(([id]) => id === aba) ? aba : 'geral';
  const nome = typeof CLIENTE_ABERTO === 'string' ? CLIENTE_ABERTO : '';
  if (nome) renderClientMasterDetail(nome);
}

function cadastroLeituraHtml(nome) {
  const f = fichaDoCliente(nome) || CADASTRO_CLIENTES.find((c) => String(c.id) === String(idDoCliente(nome))) || null;
  if (!f) return `<div class="client-master-detail-card"><h3>Sem cadastro próprio</h3>
    <p>Este nome aparece na operação, mas ainda não tem ficha. ${typeof podeEditarClientes === 'function' && podeEditarClientes()
      ? `<button type="button" class="vb-botao principal" onclick="cadastrarClienteDaOperacao('${fichaAspas(nome)}')">Criar a ficha</button>` : ''}</p></div>`;
  if (!CADASTRO_DEF) return '<div class="auto-carregando">Carregando o cadastro…</div>';
  const pode = typeof podeEditarClientes === 'function' && podeEditarClientes();
  const essenciais = CADASTRO_DEF.campos.filter((c) => c.obrigatorio);
  const feitos = essenciais.filter((c) => valorDoCadastro(f, c).trim()).length;
  const pct = Math.round((feitos / Math.max(1, essenciais.length)) * 100);
  const mostrar = (c, v) => {
    if (!v) return '<span class="cli-vazio">—</span>';
    if (c.tipo === 'data') return fichaEsc(v.split('-').reverse().join('/'));
    if (c.tipo === 'url') return `<a class="cli-porta" href="${fichaEsc(v)}" target="_blank" rel="noopener">Abrir ↗</a>`;
    if (c.tipo === 'dinheiro') return fichaEsc(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)));
    return fichaEsc(v).replace(/\n/g, '<br>');
  };
  const secoes = CADASTRO_DEF.secoes.map((s) => {
    const campos = CADASTRO_DEF.campos.filter((c) => c.secao === s.id);
    return `<section class="cad-leitura"><div class="cli-ficha-topo"><h4>${fichaEsc(s.titulo)}</h4>
        ${pode ? `<button type="button" class="cli-lapis" onclick="abrirCadastroCompleto('${fichaAspas(nome)}', { etapa: '${s.id}' })">Editar</button>` : ''}</div>
      <dl>${campos.map((c) => { const v = valorDoCadastro(f, c).trim();
        return `<div class="${c.largo ? 'largo' : ''}${!v && c.obrigatorio ? ' falta' : ''}"><dt>${fichaEsc(c.rotulo)}</dt><dd>${mostrar(c, v)}</dd></div>`; }).join('')}</dl></section>`;
  }).join('');
  return `<div class="client-master-detail-card cad-ficha">
      <div class="cli-ficha-topo"><h3>Cadastro de ${fichaEsc(f.nome)}</h3>
        ${pode ? `<button type="button" class="vb-botao principal" onclick="abrirCadastroCompleto('${fichaAspas(nome)}')">Editar cadastro</button>` : ''}</div>
      <div class="cad-progresso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Cadastro completo">
        <i style="width:${pct}%"></i></div>
      <p>${feitos === essenciais.length ? 'Cadastro completo.' : `${feitos} de ${essenciais.length} itens essenciais preenchidos. Os que faltam estão marcados.`}</p>
      ${secoes}</div>`;
}

function ecossistemaDaFichaHtml(nome) {
  const id = String(idDoCliente(nome) || '');
  if (!id) return cadastroLeituraHtml(nome);
  const estado = FICHA_ECOSSISTEMA[id];
  if (!estado) carregarEcossistema(id).then(() => { if (FICHA_ABA === 'ecossistema' && CLIENTE_ABERTO === nome) renderClientMasterDetail(nome); });
  return `<div class="client-master-detail-card"><div class="cli-ficha-topo"><h3>Ecossistema</h3>
      <button type="button" class="cli-lapis" onclick="carregarEcossistema('${fichaEsc(id)}', true).then(() => renderClientMasterDetail('${fichaAspas(nome)}'))">Conferir de novo</button></div>
    <p>Um cliente, um cadastro. Cada sistema lê daqui; esta lista diz onde ele já está e o que falta.</p>
    ${ecossistemaHtml(estado || { carregando: true }, nome)}</div>`;
}

function cerebroDaFichaHtml(nome) {
  const cartao = typeof cerebroDoClienteCardHtml === 'function' ? cerebroDoClienteCardHtml(nome) : '';
  return `${cartao}<div class="client-master-detail-card"><h3>O que é o cérebro</h3>
    <p>O cérebro é um só, o do VYBES. Ele junta o cadastro, a operação, as pastas, as regras de arte e o que a equipe registra deste cliente, e mostra de onde vem cada coisa (lógica fixa, Qwen ou Vybe OS). O botão acima abre o mapa completo com este cliente em foco.</p></div>`;
}

// Embrulha a ficha que já existia: a Visão geral é ela mesma; as outras abas
// trocam o conteúdo e escondem as listas da operação.
(function () {
  if (typeof renderClientMasterDetail !== 'function') return;
  const original = renderClientMasterDetail;
  renderClientMasterDetail = function (cli) {
    original(cli);
    const node = document.getElementById('client-master-detail');
    if (!node || !node.innerHTML) return;
    const listas = document.querySelector('#panel-cliente-detalhe .cliente-listas');
    const nome = (clientMasterRecords().find((r) => r.name === cli || normalizeClientKey(r.name) === normalizeClientKey(cli)) || {}).name || cli;
    if (FICHA_ABA === 'cadastro') node.innerHTML = cadastroLeituraHtml(nome);
    else if (FICHA_ABA === 'ecossistema') node.innerHTML = ecossistemaDaFichaHtml(nome);
    else if (FICHA_ABA === 'cerebro') node.innerHTML = cerebroDaFichaHtml(nome);
    else node.querySelector('#vybes-cli-cerebro-card')?.remove();
    if (listas) listas.style.display = FICHA_ABA === 'geral' ? '' : 'none';
    node.dataset.aba = FICHA_ABA;
    node.insertAdjacentHTML('afterbegin', `<nav class="ficha-abas" role="tablist" aria-label="Ficha do cliente">${FICHA_ABAS.map(([id, rotulo]) =>
      `<button type="button" role="tab" aria-selected="${id === FICHA_ABA}" class="${id === FICHA_ABA ? 'ativo' : ''}" onclick="trocarAbaDaFicha('${id}')">${rotulo}</button>`).join('')}</nav>`);
  };
  // Abrir outro cliente volta para a Visão geral.
  if (typeof abrirClienteDetalhe === 'function') {
    const abrir = abrirClienteDetalhe;
    abrirClienteDetalhe = function (cli) { if (cli !== CLIENTE_ABERTO) FICHA_ABA = 'geral'; return abrir(cli); };
  }
  // Os três jeitos de criar cliente viram o mesmo cadastro.
  novoClienteNoPainel = () => abrirCadastroCompleto();
  abrirFichaDeCliente = (nome) => abrirCadastroCompleto(nome);
})();
