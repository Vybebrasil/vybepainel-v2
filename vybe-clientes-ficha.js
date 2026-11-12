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

// Quantos itens essenciais do cadastro estão preenchidos: a mesma conta do servidor (completude em
// server/clientes-cadastro.js), usada na tabela de clientes, na ficha e no Ecossistema.
function completudeDoCadastro(f) {
  if (!CADASTRO_DEF || !f || !f.id) return null;
  const essenciais = CADASTRO_DEF.campos.filter((c) => c.obrigatorio);
  const faltam = essenciais.filter((c) => !valorDoCadastro(f, c).trim()).map((c) => c.rotulo);
  return { feitos: essenciais.length - faltam.length, total: essenciais.length, faltam };
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
    if (d.financas?.estado === 'erro') showToast(`Cadastro salvo, mas o Finanças não recebeu: ${d.financas.erro}`, 'warning', 8000);
    else if (d.financas?.estado === 'criado') showToast('Também criado no Finanças, como Pendente.', 'success', 5000);
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

// Redesign, quadro 52 (10/11/2026): sem a faixa colorida na borda; o estado é um selo com texto à esquerda, a barra
// no topo diz quantos estão certos, e só o que falta ganha o botão laranja. Mesma informação, mesma ordem.
const ECO_ROTULO = { ok: 'Ligado', falta: 'Falta', conferir: 'Conferir' };
const ECO_ACAO = {
  cadastro: ['Completar cadastro', (n) => `abrirCadastroCompleto('${n}')`],
  reativar: ['Trazer de volta', (n, id) => `alternarAtivoDoCliente('${id}', false)`],
  cerebro: ['Ver no cérebro', () => `trocarAbaDaFicha('cerebro')`],
  grupo: ['Informar o grupo', (n) => `abrirCadastroCompleto('${n}', { etapa: 'canais' })`],
  drive: ['Ligar a pasta', (n) => `abrirCadastroCompleto('${n}', { etapa: 'canais' })`],
  criar_financas: ['Criar no Finanças', (n, id) => `criarNoFinancas('${id}', '${n}')`],
};
function ecossistemaHtml(estado, nome) {
  if (!estado || estado.carregando) return '<div class="auto-carregando">Conferindo os sistemas…</div>';
  if (estado.erro) return `<p class="ciclo-erro">${fichaEsc(estado.erro)}</p>`;
  const { sistemas = [], cliente = {} } = estado.dados || {};
  const n = fichaAspas(nome || cliente.nome);
  const ok = sistemas.filter((s) => s.estado === 'ok').length;
  const pct = Math.round((ok / Math.max(1, sistemas.length)) * 100);
  return `<p class="eco-resumo"><b>${ok} de ${sistemas.length}</b> sistemas com tudo certo.</p>
    <div class="eco-progresso" role="progressbar" aria-valuemin="0" aria-valuemax="${sistemas.length}" aria-valuenow="${ok}" aria-label="Sistemas com tudo certo"><i style="width:${pct}%"></i></div>
    <ul class="eco-lista">${sistemas.map((s) => {
      const acao = ECO_ACAO[s.acao];
      const tipo = s.estado === 'falta' ? 'vb-botao principal' : 'vb-botao';
      const botao = acao && (typeof podeEditarClientes !== 'function' || podeEditarClientes() || s.acao === 'cerebro')
        ? `<button type="button" class="${tipo}" onclick="closeWorkflowModal();${acao[1](n, fichaEsc(cliente.id))}">${acao[0]}</button>`
        : s.link ? `<a class="${tipo}" href="${fichaEsc(s.link)}" target="_blank" rel="noopener">Abrir ↗</a>` : '';
      return `<li class="eco-item eco-${s.estado}"><span class="eco-estado"><i aria-hidden="true"></i>${ECO_ROTULO[s.estado] || s.estado}</span>
        <div class="eco-texto"><b>${fichaEsc(s.nome)}</b><p>${fichaEsc(s.detalhe)}</p></div>${botao}</li>`;
    }).join('')}</ul>`;
}

// Leva o cadastro ao Vybe Finanças (entra como Pendente) e confere o ecossistema de novo.
async function criarNoFinancas(id, nome) {
  try {
    const r = await fetch('/api/painel?area=clientes', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'financas', id }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'O Finanças não respondeu.');
    showToast(d.financas?.estado === 'criado' ? `${nome} criado no Finanças como Pendente. Ative lá quando o contrato estiver certo.` : `${nome} atualizado no Finanças.`, 'success', 6000);
  } catch (e) { showToast(e.message, 'error', 7000); }
  await carregarEcossistema(String(id), true);
  if (CLIENTE_ABERTO === nome) renderClientMasterDetail(nome);
}

// ── ficha em abas ────────────────────────────────────────────────────────────
const FICHA_ABAS = [['geral', 'Resumo'], ['demandas', 'Demandas'], ['conteudo', 'Conteúdo'], ['reunioes', 'Reuniões'], ['onboarding', 'Onboarding'], ['cadastro', 'Cadastro'], ['ecossistema', 'Ecossistema'], ['cerebro', 'Cérebro']];
// Ecossistema e Cérebro ficam à direita da barra, como fichas; o Cadastro só aparece ali enquanto está aberto.
const FICHA_ABAS_AO_LADO = ['ecossistema', 'cerebro'];

function trocarAbaDaFicha(aba) {
  FICHA_ABA = FICHA_ABAS.some(([id]) => id === aba) ? aba : 'geral';
  const nome = typeof CLIENTE_ABERTO === 'string' ? CLIENTE_ABERTO : '';
  if (nome) renderClientMasterDetail(nome);
  if (nome && (FICHA_ABA === 'conteudo' || FICHA_ABA === 'demandas') && typeof redesenharListasDoCliente === 'function') redesenharListasDoCliente();
}

function cadastroLeituraHtml(nome) {
  const f = fichaDoCliente(nome) || CADASTRO_CLIENTES.find((c) => String(c.id) === String(idDoCliente(nome))) || null;
  if (!f) return `<div class="client-master-detail-card"><h3>Sem cadastro próprio</h3>
    <p>Este nome aparece na operação, mas ainda não tem ficha. ${typeof podeEditarClientes === 'function' && podeEditarClientes()
      ? `<button type="button" class="vb-botao principal" onclick="cadastrarClienteDaOperacao('${fichaAspas(nome)}')">Criar a ficha</button>` : ''}</p></div>`;
  if (!CADASTRO_DEF) return '<div class="auto-carregando">Carregando o cadastro…</div>';
  const pode = typeof podeEditarClientes === 'function' && podeEditarClientes();
  const { feitos, total } = completudeDoCadastro(f);
  const pct = Math.round((feitos / Math.max(1, total)) * 100);
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
      <p>${feitos === total ? 'Cadastro completo.' : `${feitos} de ${total} itens essenciais preenchidos. Os que faltam estão marcados.`}</p>
      ${secoes}</div>`;
}

function ecossistemaDaFichaHtml(nome) {
  const id = String(idDoCliente(nome) || '');
  if (!id) return cadastroLeituraHtml(nome);
  const estado = FICHA_ECOSSISTEMA[id];
  if (!estado) carregarEcossistema(id).then(() => { if (FICHA_ABA === 'ecossistema' && CLIENTE_ABERTO === nome) renderClientMasterDetail(nome); });
  return `<section class="client-master-detail-card clf-cartao eco-cartao"><div class="clf-cartao-topo"><div>
      <h3 class="clf-titulo">Ecossistema</h3>
      <p class="clf-texto">Um cliente, um cadastro. Cada sistema lê daqui; esta lista diz onde ele já está e o que falta.</p></div>
      <button type="button" class="vb-botao" onclick="carregarEcossistema('${fichaEsc(id)}', true).then(() => renderClientMasterDetail('${fichaAspas(nome)}'))"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.3"/><path d="M20 4v5h-5"/></svg>Conferir de novo</button></div>
    ${ecossistemaHtml(estado || { carregando: true }, nome)}</section>`;
}

// Registros que os chats do Claude.ai mandaram pelo conector "Ecossistema Vybe" (server/mcp-ecossistema.js).
const FICHA_REGISTROS = {}; // id → { dados, erro }
async function carregarRegistrosDoCliente(id) {
  try {
    const r = await fetch(`/api/painel?area=clientes&registros=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Não consegui ler os registros.');
    FICHA_REGISTROS[id] = { dados: d.registros || [] };
  } catch (e) { FICHA_REGISTROS[id] = { erro: e.message }; }
}
const TIPO_REGISTRO = { conteudo: 'Conteúdo', planejamento: 'Planejamento', roteiro: 'Roteiro', decisao: 'Decisão', regra_de_marca: 'Regra de marca', aprendizado: 'Aprendizado' };
function registrosDosChatsHtml(nome) {
  const id = String(idDoCliente(nome) || '');
  if (!id) return '';
  const estado = FICHA_REGISTROS[id];
  if (!estado) carregarRegistrosDoCliente(id).then(() => { if (FICHA_ABA === 'cerebro' && CLIENTE_ABERTO === nome) renderClientMasterDetail(nome); });
  const corpo = !estado ? '<div class="auto-carregando">Lendo os registros…</div>'
    : estado.erro ? `<p class="ciclo-erro">${fichaEsc(estado.erro)}</p>`
    : !estado.dados.length ? '<p>Nada registrado ainda. Quando alguém fechar uma entrega deste cliente com o assistente, o resumo aparece aqui.</p>'
    : `<ul class="reg-lista">${estado.dados.map((g) => `<li class="reg-item"><details><summary>
        <span class="reg-tipo">${fichaEsc(TIPO_REGISTRO[g.tipo] || g.tipo)}</span><b>${fichaEsc(g.titulo)}</b>
        <small>${fichaEsc(String(g.criado_em || '').slice(0, 10).split('-').reverse().join('/'))} · ${fichaEsc(g.status.replace(/_/g, ' '))} · ${fichaEsc(g.origem)}${g.drive_erro ? ' · cópia no Drive falhou' : ''}</small></summary>
        <p>${fichaEsc(g.resumo).replace(/\n/g, '<br>')}</p>
        ${g.decisoes ? `<h5>Decisões e regras novas</h5><p>${fichaEsc(g.decisoes).replace(/\n/g, '<br>')}</p>` : ''}
        ${g.proximos ? `<h5>Próximos passos</h5><p>${fichaEsc(g.proximos).replace(/\n/g, '<br>')}</p>` : ''}
        ${g.conteudo ? `<h5>Conteúdo</h5><pre>${fichaEsc(g.conteudo)}</pre>` : ''}</details></li>`).join('')}</ul>`;
  return `<div class="client-master-detail-card"><div class="cli-ficha-topo"><h3>O que a equipe registrou</h3>
      <button type="button" class="vb-botao" onclick="delete FICHA_REGISTROS['${fichaEsc(id)}'];renderClientMasterDetail('${fichaAspas(nome)}')">Atualizar</button></div>
    ${corpo}</div>`;
}

function cerebroDaFichaHtml(nome) {
  const cartao = typeof cerebroDoClienteCardHtml === 'function' ? cerebroDoClienteCardHtml(nome) : '';
  // "O que é o cérebro" virou a dica do "?" no título do cartão (quadro 53).
  return `${cartao}${registrosDosChatsHtml(nome)}`;
}

// Embrulha a ficha que já existia. Pelo quadro "Ficha do cliente" do moodboard (12/11/2026): a nota e a fala ficam em
// cima de todas as abas; a barra tem Resumo, Demandas, Conteúdo, Reuniões e Onboarding com a contagem de cada uma, o
// Financeiro (só para os donos, abre Finanças por cliente) e, à direita, Ecossistema e Cérebro. O Cadastro abre pela
// ficha "cadastro N de M" da nota e por Editar cadastro. As listas da operação viraram as abas Conteúdo e Demandas.
(function () {
  if (typeof renderClientMasterDetail !== 'function') return;
  const original = renderClientMasterDetail;
  const CADEADO = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  renderClientMasterDetail = function (cli) {
    original(cli);
    const node = document.getElementById('client-master-detail');
    if (!node || !node.innerHTML) return;
    const listas = document.querySelector('#panel-cliente-detalhe .cliente-listas');
    const nome = (clientMasterRecords().find((r) => r.name === cli || normalizeClientKey(r.name) === normalizeClientKey(cli)) || {}).name || cli;
    const corpo = node.querySelector('.v2f-corpo') || node;
    if (FICHA_ABA === 'cadastro') corpo.innerHTML = cadastroLeituraHtml(nome);
    else if (FICHA_ABA === 'ecossistema') corpo.innerHTML = ecossistemaDaFichaHtml(nome);
    else if (FICHA_ABA === 'cerebro') corpo.innerHTML = cerebroDaFichaHtml(nome);
    else if (FICHA_ABA === 'reunioes' && window.VybeReunioes) corpo.innerHTML = window.VybeReunioes.reunioesHtml(nome);
    else if (FICHA_ABA === 'onboarding' && window.VybeReunioes) corpo.innerHTML = window.VybeReunioes.onboardingHtml(nome);
    else if (FICHA_ABA === 'conteudo' || FICHA_ABA === 'demandas') corpo.innerHTML = '';
    else node.querySelector('#vybes-cli-cerebro-card')?.remove();
    // As listas completas (prazo, status, seleção de vários) só aparecem na aba delas.
    const naLista = FICHA_ABA === 'conteudo' || FICHA_ABA === 'demandas';
    if (listas) {
      listas.style.display = naLista ? '' : 'none';
      const [conteudos, pedidos] = listas.querySelectorAll(':scope > section');
      if (conteudos) conteudos.hidden = FICHA_ABA !== 'conteudo';
      if (pedidos) pedidos.hidden = FICHA_ABA !== 'demandas';
    }
    node.dataset.aba = FICHA_ABA;
    // Onboarding só aparece para quem está (ou esteve) em onboarding; a leitura das reuniões diz isso e repinta.
    const idFicha = typeof idDoCliente === 'function' ? String(idDoCliente(nome) || '') : '';
    if (idFicha && window.VybeReunioes?.carregar) window.VybeReunioes.carregar(idFicha);
    const reu = idFicha && window.VybeReunioes?.dadosDe ? window.VybeReunioes.dadosDe(idFicha) : null;
    const abertos = typeof abertosDoCliente === 'function' ? abertosDoCliente(nome) : { conteudos: 0, pedidos: 0 };
    const respondidas = reu ? (reu.questoes || []).filter((q) => (reu.onboarding?.respostas || {})[q.chave]).length : 0;
    const conta = { demandas: abertos.pedidos, conteudo: abertos.conteudos, reunioes: reu ? (reu.reunioes || []).length : '',
      onboarding: reu && (reu.questoes || []).length ? `${respondidas} de ${reu.questoes.length}` : '' };
    const naBarra = FICHA_ABAS.filter(([id]) => !FICHA_ABAS_AO_LADO.includes(id) && id !== 'cadastro')
      .filter(([id]) => id !== 'onboarding' || FICHA_ABA === 'onboarding' || window.VybeReunioes?.temOnboarding?.(nome));
    const aba = ([id, rotulo]) => `<button type="button" role="tab" aria-selected="${id === FICHA_ABA}" class="v2f-seg-pill principal${id === FICHA_ABA ? ' ativo' : ''}" onclick="trocarAbaDaFicha('${id}')">${rotulo}${
      conta[id] !== undefined && conta[id] !== '' ? `<b class="v2f-q">${conta[id]}</b>` : ''}</button>`;
    const dono = typeof souDonoDaSessao === 'function' && souDonoDaSessao() && typeof window.VybeComercial?.abrir === 'function';
    const financeiro = dono ? `<button type="button" role="tab" aria-selected="false" class="v2f-seg-pill principal" title="Só os donos veem. Abre Finanças, por cliente" onclick="window.VybeComercial.abrir('financas', { abas: ['financas'] })">${CADEADO}Financeiro</button>` : '';
    const aoLado = FICHA_ABAS.filter(([id]) => FICHA_ABAS_AO_LADO.includes(id) || (id === 'cadastro' && FICHA_ABA === 'cadastro'))
      .map(([id, rotulo]) => `<button type="button" class="v2f-chip" aria-pressed="${id === FICHA_ABA}" onclick="trocarAbaDaFicha('${id}')">${rotulo}</button>`).join('');
    const barra = `<div class="v2f-abas"><nav class="ficha-abas v2f-seg" role="tablist" aria-label="Ficha do cliente">${naBarra.map(aba).join('')}${financeiro}</nav><span class="v2f-espaco"></span>${aoLado}</div>`;
    const alto = node.querySelector('.v2f-alto');
    if (alto) alto.insertAdjacentHTML('afterend', barra); else node.insertAdjacentHTML('afterbegin', barra);
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
