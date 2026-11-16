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
// Prancha V2-M-Cliente-Ficha (16/11/2026): as abas ficam no alto da ficha, numa barra só. Financeiro é só dos donos (a
// conta do cliente, com atalho para a tela geral); Ecossistema entra como aba (a janela à parte segue na rota antiga); o
// Cadastro só aparece ali enquanto está aberto.
const FICHA_ABAS = [['geral', 'Resumo'], ['demandas', 'Demandas'], ['conteudo', 'Conteúdo'], ['reunioes', 'Reuniões'], ['onboarding', 'Onboarding'], ['financeiro', 'Financeiro'], ['ecossistema', 'Ecossistema'], ['cerebro', 'Cérebro'], ['cadastro', 'Cadastro']];
const FICHA_ABAS_AO_LADO = [];
const fichaEhDono = () => { try { return typeof souDonoDaSessao === 'function' && souDonoDaSessao() === true; } catch { return false; } };

function trocarAbaDaFicha(aba) {
  FICHA_ABA = FICHA_ABAS.some(([id]) => id === aba) ? aba : 'geral';
  // O financeiro do cliente é só dos donos: quem não é dono volta para o Resumo.
  if (FICHA_ABA === 'financeiro' && !fichaEhDono()) FICHA_ABA = 'geral';
  const nome = typeof CLIENTE_ABERTO === 'string' ? CLIENTE_ABERTO : '';
  if (nome) renderClientMasterDetail(nome);
}

// Financeiro da ficha (prancha V2-M-Cliente-Financeiro): só a conta deste cliente, só para donos, com o atalho para a
// tela geral. O servidor já apaga o valor de quem não é dono (server/carteira.js); aqui a aba nem desenha número.
function financeiroDaFichaHtml(nome) {
  if (!fichaEhDono()) return '<p class="d3v-estado"><b>Só os donos veem o financeiro do cliente.</b></p>';
  const id = String(idDoCliente(nome) || '');
  const atalho = typeof window.VybeComercial?.abrir === 'function'
    ? `<button type="button" class="d3v-btn sec" onclick="window.VybeComercial.abrir('financas', { abas: ['financas'] })">Abrir Finanças, por cliente</button>` : '';
  if (!id) return `<p class="d3v-estado"><b>Sem ficha no cadastro.</b>O contrato aparece aqui depois de criar a ficha.${atalho}</p>`;
  const sv = typeof carteiraDaFicha === 'function' ? carteiraDaFicha(() => { if (FICHA_ABA === 'financeiro' && CLIENTE_ABERTO === nome) renderClientMasterDetail(nome); }) : null;
  if (!sv) return '<p class="d3v-estado"><b>Lendo a conta do cliente…</b></p>';
  const locais = sv.contratos?.lista || [];
  const lista = window.VybeFinancas?.contratosDaCarteira ? window.VybeFinancas.contratosDaCarteira(locais) : locais;
  const c = lista.find((x) => String(x.cliente_id) === id) || null;
  const reais = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? 'sem valor' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(v)));
  const dia = (v) => { const iso = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : 'sem data'; };
  const contratos = typeof window.VybeCarteira?.abrir === 'function' ? `<button type="button" class="d3v-btn sec" onclick="window.VybeCarteira.abrir('contratos', { abas: ['contratos'] })">${c ? 'Editar em Contratos' : 'Registrar em Contratos'}</button>` : '';
  const campo = (rotulo, valor) => `<div class="fv2-fin-campo"><span class="d3v-rot">${rotulo}</span><b>${fichaEsc(valor)}</b></div>`;
  return `<div class="fv2-fin"><div class="cv2-cab"><h3>A conta de ${fichaEsc(nome)} <span>· só os donos veem</span></h3><span class="fv2-cab-lado">${contratos}${atalho}</span></div>
    ${c ? `<div class="fv2-fin-alto"><span class="d3v-rot">Valor mensal do contrato</span><b class="fv2-fin-valor">${fichaEsc(reais(c.valor_mensal))}</b></div>
      <div class="fv2-fin-grade">${campo('Início', dia(c.inicio))}${campo('Renovação', dia(c.renovacao))}${campo('Situação', c.status || 'ativo')}${c.observacao ? campo('Observação', c.observacao) : ''}</div>`
      : '<p class="d3v-estado"><b>Nenhum contrato registrado para este cliente.</b>Recebimentos, faturas e atraso ficam em Finanças, por cliente.</p>'}</div>`;
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

// Aba Ecossistema (prancha V2-M-Cliente-Ecossistema, 16/11/2026): cada sistema numa linha (o selo, o nome, a situação, o
// que falta ou o que há e o botão que resolve), o pé com o resumo e, no vidro, o cartão laranja com o que falta ligar,
// Dados e acessos e "Um cadastro só". A janela de depois do cadastro continua usando ecossistemaHtml.
const ECO_SUB = { vybe_os: 'operação e painel', cerebro: 'o que ele sabe', bots: 'o grupo do cliente', drive: 'a pasta do cliente', hub: 'o portal do cliente', financas: 'contrato e pagamento' };
const ECO_SITUACAO = { ok: 'tudo certo', falta: 'falta ligar', conferir: 'para conferir' };
function ecossistemaDaFichaHtml(nome) {
  const id = String(idDoCliente(nome) || ''), n = fichaAspas(nome);
  const pode = typeof podeEditarClientes !== 'function' || podeEditarClientes();
  const so = (ico, titulo, texto = '', botao = '') => fv2DuasHtml('ecossistema', `<section class="fv2-folha fv2-cheia">${fv2VazioHtml(ico, titulo, texto, botao)}</section>`, '');
  if (!id) return so('falta', 'Sem cadastro próprio', 'Este nome aparece na operação, mas ainda não tem ficha.',
    typeof podeEditarClientes === 'function' && podeEditarClientes() ? `<button type="button" class="d3v-btn s" onclick="cadastrarClienteDaOperacao('${n}')">Criar a ficha</button>` : '');
  const estado = FICHA_ECOSSISTEMA[id];
  if (!estado) carregarEcossistema(id).then(() => { if (FICHA_ABA === 'ecossistema' && CLIENTE_ABERTO === nome) renderClientMasterDetail(nome); });
  const conferir = `carregarEcossistema('${fichaEsc(id)}', true).then(() => renderClientMasterDetail('${n}'))`;
  if (!estado || estado.carregando) return so('relogio', 'Conferindo os sistemas…');
  if (estado.erro) return so('falta', fichaEsc(estado.erro), '', `<button type="button" class="d3v-btn sec s" onclick="${conferir}">Conferir de novo</button>`);
  const { sistemas = [], cliente = {} } = estado.dados || {};
  const botaoDe = (s, classe) => { const acao = ECO_ACAO[s.acao];
    return acao && (pode || s.acao === 'cerebro') ? `<button type="button" class="${classe}" onclick="${acao[1](n, fichaEsc(cliente.id || id))}">${acao[0]}</button>`
      : s.link ? `<a class="${classe}" href="${fichaEsc(s.link)}" target="_blank" rel="noopener">Abrir</a>` : ''; };
  const linha = (s) => `<div class="fv2-tb-lin fv2-eco-lin eco-${fichaEsc(s.estado)}"><i class="fv2-selo ${s.estado === 'ok' ? 'g' : 'a'}" aria-hidden="true">${s.estado === 'ok' ? FV2_ICO.ok : FV2_ICO.falta}</i>
      <span class="fv2-eco-nome"><b>${fichaEsc(s.nome)}</b>${ECO_SUB[s.id] ? ` · ${ECO_SUB[s.id]}` : ''}</span><span class="fv2-eco-sit ${s.estado === 'ok' ? 'g' : 'a'}">${ECO_SITUACAO[s.estado] || fichaEsc(s.estado)}</span>
      <span class="fv2-eco-det" title="${fichaEsc(s.detalhe)}">${fichaEsc(s.detalhe)}</span>${botaoDe(s, 'd3v-btn sec s fv2-op-acao')}</div>`;
  const certos = sistemas.filter((s) => s.estado === 'ok').length, faltam = sistemas.filter((s) => s.estado !== 'ok');
  const meta = (clientMasterRecords().find((r) => r.name === nome) || {}).meta || {};
  const f = fichaDoCliente(nome) || CADASTRO_CLIENTES.find((c) => String(c.id) === id) || null;
  const completo = f ? completudeDoCadastro(f) : null;
  const urlDrive = linkDeCliente(meta.drive), outroLink = linkDeCliente(meta.link), temDoc = Boolean(meta.acessoId && meta.doc);
  const semLink = [urlDrive, temDoc, outroLink].filter((x) => !x).length;
  const conta = (forte, apoio, tom = '') => `<span class="cv2-olho fv2-eco-conta${tom ? ` ${tom}` : ''}"><b>${forte}</b><small>${apoio}</small></span>`;
  const folha = `<section class="fv2-folha fv2-cheia fv2-eco" aria-label="Ecossistema do cliente"><div class="cv2-cab"><h3>Onde ${fichaEsc(nome)} existe <span>· ${fichaPlural(sistemas.length, 'sistema', 'sistemas')}, um cadastro só</span></h3><span class="fv2-cab-nota">conferido agora</span><button type="button" class="fv2-cab-acao" onclick="${conferir}">conferir de novo</button></div>
      ${sistemas.length ? `<div class="fv2-op-th fv2-eco-th" aria-hidden="true"><span class="fv2-eco-c-selo"></span><span class="fv2-eco-nome">Sistema</span><span class="fv2-eco-sit">Situação</span><span class="fv2-eco-det">O que falta ou o que há</span></div>
        <div class="fv2-tb fv2-linhas">${sistemas.map(linha).join('')}</div>` : fv2VazioHtml('falta', 'Nenhum sistema na resposta', 'Confira de novo em instantes.')}
      <div class="cv2-pe fv2-eco-pe"><span class="d3m-olho-rot">Resumo</span>${conta(`${certos} de ${sistemas.length}`, 'sistemas completos')}${completo ? conta(`${completo.feitos} de ${completo.total}`, 'campos do cadastro') : ''}${conta(semLink, semLink === 1 ? 'link faltando' : 'links faltando', semLink ? 'a' : '')}</div></section>`;

  const comAcao = faltam.find((s) => botaoDe(s, 'x'));
  const nomes = faltam.map((s) => s.nome).join(', ').replace(/, ([^,]*)$/, ' e $1');
  const alto = faltam.length ? fv2LaranjaHtml({ rotulo: 'falta ligar', n: faltam.length, titulo: faltam.length === 1 ? 'sistema ainda sem este cliente' : 'sistemas ainda sem este cliente',
      apoio: `${fichaEsc(nomes)}. O cadastro é um só e vale em todos.`, botoes: `${comAcao ? botaoDe(comAcao, 'd3m-btn l') : ''}<button type="button" class="d3m-btn l s" onclick="trocarAbaDaFicha('cadastro')">Ver o cadastro</button>` })
    : fv2CalmoHtml('Tudo ligado.', `Os ${sistemas.length} sistemas leem o mesmo cadastro deste cliente.`);
  const porta = (tem, forte, chamada, url) => (url ? `<a class="d3m-vlin" href="${fichaEsc(url)}" target="_blank" rel="noopener"><i class="d3m-pt g" aria-hidden="true"></i><span><b>${forte}</b></span>${fichaVai()}</a>`
    : fv2VlinHtml(forte, tem ? '' : 'falta', chamada, tem ? 'g' : 'a'));
  const dados = fv2ConsHtml('Dados e acessos', 'senhas só para quem administra',
    porta(Boolean(urlDrive), 'Drive do cliente', pode && typeof abrirCadastroCompleto === 'function' ? `abrirCadastroCompleto('${n}', { etapa: 'canais' })` : "trocarAbaDaFicha('geral')", urlDrive)
    + (meta.acessoId || pode ? porta(temDoc, 'Documento de acessos', `abrirDocumentoDoCliente('${jsArg(String(meta.acessoId || ''))}', '${n}', '${jsArg(id)}')`, '') : '')
    + fv2VlinHtml('Acessos', 'links, senhas e painel', "trocarAbaDaFicha('geral')", 'g')
    + porta(Boolean(outroLink), 'Link do projeto', "trocarAbaDaFicha('geral')", outroLink), ' aria-label="Dados e acessos"');
  return fv2DuasHtml('ecossistema', folha, alto + dados + fv2ConsHtml('Um cadastro só', '', '<p class="fv2-nota-lado">O que for preenchido no cadastro vale no Vybe OS, no cérebro, nos bots e no Hub. Cada sistema lê daqui.</p>'));
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
// ── As abas da ficha no esqueleto das pranchas V2-M-Cliente-* (16/11/2026) ───────────────────────────────────────────
// Toda aba fora do Resumo tem o mesmo esqueleto: as folhas claras à esquerda e, à direita, direto no vidro, o cartão
// laranja (o que pede ação nesta aba) e a consulta. Peças: fv2-duas, fv2-vazio, fv2-barras e fv2-op (a lista da operação).
const FV2_ICO = {
  ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  lapis: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  cifrao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="M16.5 7.5C16 6 14.3 5 12 5 9.5 5 7.5 6.2 7.5 8.3c0 4.7 9 2.2 9 7.2 0 2.200-2 3.500-4.500 3.500s-4.300-1-4.800-2.800"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  falta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>',
  olho: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/></svg>',
};
const fichaPlural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const fichaDiaMes = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
const fichaVai = () => (typeof CV2_IC !== 'undefined' ? CV2_IC.vai : '');
function fv2Matiz(t) { let h = 7; for (const ch of String(t || '')) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h % 360; }
// Outro módulo do Vybe OS (quem navega é o menu lateral); sem o mundo, o atalho não aparece.
const fv2PodeIr = () => typeof window !== 'undefined' && typeof window.mundoVoxel?.irPara === 'function';
function fv2DuasHtml(aba, folhas, lado) {
  return `<div class="fv2-duas" data-fv2-aba="${aba}"><div class="fv2-col">${folhas}</div><aside class="d3m-lado fv2-lado" aria-label="Consulta">${lado}</aside></div>`;
}
function fv2VazioHtml(ico, titulo, texto = '', botao = '') {
  return `<div class="fv2-vazio"><i class="fv2-vazio-ico" aria-hidden="true">${FV2_ICO[ico] || ''}</i><b>${titulo}</b>${texto ? `<span>${texto}</span>` : ''}${botao}</div>`;
}
function fv2LaranjaHtml({ quem = 'Mateus', rotulo, n = '', titulo, apoio = '', botoes = '' }) {
  return `<section class="d3-acao d3m-laranja cv2-laranja fv2-laranja fv2-lar-aba" aria-label="O que pede ação agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">${fichaEsc(quem.slice(0, 1))}</span>${fichaEsc(quem)} · ${rotulo}</span>
    <span class="d3m-lar-txt">${n === '' ? '' : `<b class="d3m-lar-num">${n}</b>`}<span class="d3-acao-frase">${titulo}</span>${apoio ? `<small>${apoio}</small>` : ''}${botoes ? `<span class="d3m-lar-bts">${botoes}</span>` : ''}</span></section>`;
}
function fv2CalmoHtml(titulo, texto, botao = '') {
  return `<section class="fv2-calmo" aria-label="Leitura desta aba"><b>${titulo}</b><span>${texto}</span>${botao}</section>`;
}
function fv2ConsHtml(titulo, lado, dentro, attrs = '') {
  return `<section class="d3m-cons"${attrs}><div class="d3m-cons-cab"><b>${titulo}</b><span>${lado}</span></div>${dentro}</section>`;
}
function fv2VlinHtml(forte, apoio, chamada, ponto = '') {
  return `<button type="button" class="d3m-vlin" onclick="${chamada}">${ponto ? `<i class="d3m-pt ${ponto}" aria-hidden="true"></i>` : ''}<span><b>${forte}</b>${apoio ? ` · ${apoio}` : ''}</span>${fichaVai()}</button>`;
}
// Barras de contagem no vidro: [{ rotulo, n, de, lado, cor, tom, chamada, ligada }].
function fv2BarrasHtml(linhas) {
  return `<div class="fv2-barras">${linhas.map((l) => { const v = l.de ? Math.round((Math.max(0, l.n) / l.de) * 100) : 0, tag = l.chamada ? 'button' : 'div';
    return `<${tag}${l.chamada ? ` type="button" onclick="${l.chamada}" aria-pressed="${Boolean(l.ligada)}"` : ''} class="fv2-barra-lin"><span>${fichaEsc(l.rotulo)}</span><span class="d3m-vbarra${l.tom ? ` ${l.tom}` : ''}"${l.cor ? ` style="--st:${fichaEsc(l.cor)}"` : ''}><i style="--v:${v}%"></i></span><b>${l.lado ?? l.n}</b></${tag}>`; }).join('')}</div>`;
}

// A lista da operação dentro da ficha (Conteúdo e Demandas): os MESMOS editores do painel (marcar vários, status na
// linha, data na linha, dono, prévia e abrir a peça), no desenho da prancha.
const FV2_LISTA = { conteudo: { filtro: 'todas', porStatus: false }, demandas: { filtro: 'abertos' } };
function fv2Filtrar(aba, filtro) { if (!FV2_LISTA[aba]) return; FV2_LISTA[aba].filtro = filtro; if (typeof redesenharListasDoCliente === 'function') redesenharListasDoCliente(); }
function fv2PorStatus() { FV2_LISTA.conteudo.porStatus = !FV2_LISTA.conteudo.porStatus; if (typeof redesenharListasDoCliente === 'function') redesenharListasDoCliente(); }
function fv2OrdemVisivel(el) { return [...(el?.closest('.fv2-op-linhas')?.querySelectorAll('input[data-item-id]') || [])].map((x) => x.dataset.itemId); }
function fv2ContarAbaixo(caixa) {
  const alvo = caixa?.closest('.fv2-op')?.querySelector('[data-fv2-abaixo]');
  if (!alvo) return;
  const fundo = caixa.getBoundingClientRect().bottom;
  const n = [...caixa.children].filter((l) => l.getBoundingClientRect().top >= fundo - 6).length;
  alvo.textContent = n ? `mais ${fichaPlural(n, alvo.dataset.um, alvo.dataset.varios)} abaixo` : '';
}
function fv2Marcadas(itens) { return typeof SELECIONADAS === 'undefined' ? 0 : itens.filter((x) => SELECIONADAS.has(String(x.d.id))).length; }
// "Mais" do pé: as ações de lote que não cabem à vista, pelas mesmas funções da barra de lote do painel.
function fv2MaisDoLote(event) {
  const botao = event.currentTarget;
  const demandas = [...SELECIONADAS].map(findOperationalItem).filter(Boolean).every(isRequestItem);
  const falso = { preventDefault() {}, stopPropagation() {}, currentTarget: botao };
  const op = (rotulo, chamar) => ({ rotulo, direto: true, cor: 'currentColor', aplicar: () => chamar(falso) });
  abrirMenuDeLote(event, 'Mais ações', [op('Prazo de produção', (ev) => lotePrazo(ev, 'prazo')), op('Grupo', (ev) => loteGrupo(ev, demandas ? 'demandas' : 'producao')),
    op(demandas ? 'Tipo' : 'Formato', (ev) => loteEscolha(ev, 'formato')), ...(demandas ? [] : [op('Captação', (ev) => loteEscolha(ev, 'captacao'))]),
    op('Prioridade', (ev) => loteEscolha(ev, 'prioridade')), op('Arquivar', () => loteArquivar())], '');
}
function fv2LinhaOpHtml(x, hoje) {
  const d = x.d, id = jsArg(String(d.id)), pedido = typeof isRequestItem === 'function' && isRequestItem(d);
  const bruto = String(d.nome || d.formato || 'Peça'), m = /^(.*?)\s+-\s+(.*)$/.exec(bruto);
  const [tipo, titulo] = m ? [m[1], m[2]] : [String(d.formato || '').trim() || (pedido ? 'Pedido' : 'Peça'), bruto];
  const marcada = typeof SELECIONADAS !== 'undefined' && SELECIONADAS.has(String(d.id));
  const prazo = String(d.prazo_iso || '').slice(0, 10), veic = String(d.veiculacao_iso || '').slice(0, 10);
  const data = (campo, iso, dica, manda) => { const venceu = manda && iso && iso < hoje, eHoje = manda && iso === hoje;
    return `<label class="fv2-op-data fv2-op-c-${campo}${venceu ? ' r' : eHoje ? ' a' : ''}${iso ? '' : ' sem'}" title="${dica}" onclick="event.stopPropagation()"><span>${!iso ? 'sem data' : venceu ? `era ${fichaDiaMes(iso)}` : eHoje ? 'hoje' : fichaDiaMes(iso)}</span><input type="date" value="${fichaEsc(iso)}" aria-label="${dica} de ${fichaEsc(d.nome || '')}" onclick="event.stopPropagation();try{this.showPicker()}catch{}" onchange="event.stopPropagation();salvarDataNaLinha('${id}','${campo}',this)"></label>`; };
  const mini = typeof jaTemMaterial === 'function' && jaTemMaterial(d)
    ? `<button type="button" class="fv2-op-mini" style="--h:${fv2Matiz(tipo + titulo)}" data-previa-id="${fichaEsc(String(d.id))}" onclick="event.stopPropagation();abrirPreviaDaEntrega('${id}',this)" title="Ver o material entregue" aria-label="Ver prévia de ${fichaEsc(d.nome || 'atividade')}">${FV2_ICO.olho}</button>`
    : `<i class="fv2-op-mini" style="--h:${fv2Matiz(tipo + titulo)}" aria-hidden="true"></i>`;
  return `<div class="fv2-op-lin${marcada ? ' marcada' : ''}" title="Abrir ${fichaEsc(d.nome || '')}" onclick="openItemWorkspace('${id}')">
      <input type="checkbox" class="fv2-op-marca" ${marcada ? 'checked' : ''} data-item-id="${fichaEsc(String(d.id))}" aria-label="Selecionar ${fichaEsc(d.nome || '')}" onclick="event.stopPropagation();alternarSelecao('${id}',this.checked,event,fv2OrdemVisivel(this))">
      ${mini}<button type="button" class="fv2-op-nome" onclick="event.stopPropagation();openItemWorkspace('${id}')"><b>${fichaEsc(tipo)}</b> · ${fichaEsc(titulo)}</button>
      <span class="fv2-op-c-st" onclick="event.stopPropagation()">${typeof pv2StatusBotao === 'function' ? pv2StatusBotao(d) : fichaEsc(d.status || 'Sem status')}</span>
      ${data('prazo', prazo, 'Prazo de produção', !veic)}${data('veiculacao', veic, pedido ? 'Data de conclusão' : 'Data de veiculação', true)}
      <span class="fv2-op-c-quem" onclick="event.stopPropagation()">${typeof pv2Av === 'function' ? pv2Av(d) : ''}</span></div>`;
}
// A folha da lista: cabeçalho com os recortes, as linhas (só elas rolam) e o pé com o que fazer com as marcadas.
function fv2FolhaOpHtml({ idGrade, titulo, chips, colunas, itens, vazio, um, varios, todos }) {
  const hoje = hojeIsoV2(), marcadas = fv2Marcadas(todos);
  const bt = (rot, chamada) => `<button type="button" class="d3v-btn sec s fv2-op-acao"${marcadas ? '' : ' disabled'} onclick="${chamada}">${rot}</button>`;
  return `<section class="fv2-folha fv2-op fv2-cheia" aria-label="Lista de ${varios}"><div class="cv2-cab fv2-op-cab"><h3>${titulo}</h3><span class="cv2-filtros">${chips}</span></div>
      ${itens.length ? `<div class="fv2-op-th" aria-hidden="true"><span class="fv2-op-c-marca"></span><span class="fv2-op-c-mini"></span><span class="fv2-op-c-nome">${colunas[0]}</span><span class="fv2-op-c-st">Status</span><span class="fv2-op-c-prazo">Prazo</span><span class="fv2-op-c-veiculacao">${colunas[1]}</span><span class="fv2-op-c-quem">Quem</span></div>` : ''}
      <div class="fv2-op-linhas" id="${idGrade}" onscroll="fv2ContarAbaixo(this)">${itens.map((x) => fv2LinhaOpHtml(x, hoje)).join('') || vazio}</div>
      ${todos.length ? `<div class="fv2-op-pe" role="toolbar" aria-label="Ações para as marcadas"><span class="fv2-op-pe-txt"><b>${marcadas ? fichaPlural(marcadas, 'marcada', 'marcadas') : 'Nenhuma marcada'}</b><span data-fv2-abaixo data-um="${um}" data-varios="${varios}"></span>${marcadas ? '<button type="button" class="cv2-chip" onclick="limparSelecao()">desmarcar</button>' : ''}</span>
        <span class="fv2-op-pe-bts">${bt('Mudar a data', "lotePrazo(event,'veiculacao')")}${bt('Trocar o dono', 'loteResponsavel(event)')}${bt('Mudar o status', 'loteStatus(event)')}${bt('Mais', 'fv2MaisDoLote(event)')}</span></div>` : ''}</section>`;
}
// "Reagendar as N": marca as vencidas e abre a troca de data das marcadas (a mesma do painel).
function fv2ReagendarVencidas(event) {
  const ids = vencidosDoCliente(CLIENTE_ABERTO).map((x) => String(x.d.id));
  if (!ids.length || typeof SELECIONADAS === 'undefined') return;
  SELECIONADAS.clear(); ids.forEach((i) => SELECIONADAS.add(i));
  FV2_LISTA.conteudo.filtro = 'vencidas';
  if (typeof repintarOndeHaSelecao === 'function') repintarOndeHaSelecao(); else redesenharListasDoCliente();
  lotePrazo(event, 'veiculacao');
}

// Aba Conteúdo (prancha V2-M-Cliente-Conteudo): os conteúdos em aberto, a veiculação mais antiga primeiro; ao lado, as
// vencidas no cartão laranja, a contagem por status e os atalhos.
function conteudoDaFichaHtml(nome) {
  const E = FV2_LISTA.conteudo, hoje = hojeIsoV2(), id = String(idDoCliente(nome) || ''), aspas = fichaAspas(nome);
  const todos = conteudosAbertosV2(nome).sort((a, b) => (a.quando || '9999').localeCompare(b.quando || '9999'));
  const stDe = (x) => String(x.d.status || 'Sem status');
  const recortes = { todas: () => true, vencidas: (x) => Boolean(x.quando) && x.quando < hoje, alteracao: (x) => /altera/i.test(stDe(x)), aprovacao: (x) => /aprova/i.test(stDe(x)) };
  const conta = Object.fromEntries(Object.entries(recortes).map(([k, f]) => [k, todos.filter(f).length]));
  const soStatus = E.filtro.startsWith('st:') ? E.filtro.slice(3) : '';
  if (!soStatus && !recortes[E.filtro]) E.filtro = 'todas';
  let itens = todos.filter(soStatus ? (x) => stDe(x) === soStatus : recortes[E.filtro]);
  if (E.porStatus) itens = [...itens].sort((a, b) => stDe(a).localeCompare(stDe(b), 'pt-BR') || (a.quando || '9999').localeCompare(b.quando || '9999'));
  const chip = (k, rot, tom = '') => `<button type="button" class="cv2-chip" role="radio" aria-checked="${E.filtro === k}" onclick="fv2Filtrar('conteudo','${k}')">${rot}<span${tom && conta[k] ? ` class="${tom}"` : ''}>${conta[k]}</span></button>`;
  const chips = `<span class="cv2-chips" role="radiogroup" aria-label="Recorte">${chip('todas', 'Todas')}${chip('vencidas', 'Vencidas', 'cv2-ruim')}${chip('alteracao', 'Em alteração')}${chip('aprovacao', 'Para aprovação')}${
      soStatus ? `<button type="button" class="cv2-chip" role="radio" aria-checked="true" title="Tirar este recorte" onclick="fv2Filtrar('conteudo','todas')">${fichaEsc(soStatus)}<span>${itens.length}</span></button>` : ''}</span>
      <i class="cv2-risco" aria-hidden="true"></i><button type="button" class="cv2-chip" data-ligado="${E.porStatus}" aria-pressed="${E.porStatus}" title="Juntar as peças do mesmo status" onclick="fv2PorStatus()">Por status</button>`;
  const folha = fv2FolhaOpHtml({ idGrade: 'grid-cliente-producao', um: 'conteúdo', varios: 'conteúdos', todos, itens, chips, colunas: ['Conteúdo', 'Veiculação'],
    titulo: `${fichaPlural(todos.length, 'conteúdo em aberto', 'conteúdos em aberto')} <span>· ${E.porStatus ? 'juntos por status' : 'a veiculação mais antiga primeiro'}</span>`,
    vazio: todos.length ? fv2VazioHtml('ok', 'Nenhum conteúdo neste recorte', '', `<button type="button" class="d3v-btn sec s" onclick="fv2Filtrar('conteudo','todas')">Ver todos</button>`)
      : fv2VazioHtml('ok', 'Nenhum conteúdo em aberto', 'O que entrar na produção deste cliente aparece aqui, com o status, o prazo e a veiculação.') });

  const vencidas = todos.filter(recortes.vencidas), esperam = vencidas.filter((x) => /info/i.test(stDe(x))).length;
  const alto = vencidas.length ? fv2LaranjaHtml({ rotulo: 'o mais grave da conta', n: vencidas.length, titulo: vencidas.length === 1 ? 'peça passou da veiculação' : 'peças passaram da veiculação',
      apoio: `A mais antiga era para ${fichaDiaMes(vencidas[0].quando)}.${esperam ? ` ${esperam === 1 ? 'Uma espera' : `${esperam} esperam`} o cliente.` : ''}`,
      botoes: `<button type="button" class="d3m-btn l" title="Marca as vencidas e abre a troca de data" onclick="fv2ReagendarVencidas(event)">${vencidas.length === 1 ? 'Reagendar' : `Reagendar as ${vencidas.length}`}</button><button type="button" class="d3m-btn l s" onclick="fv2Filtrar('conteudo','vencidas')">Uma a uma</button>` })
    : fv2CalmoHtml('Nenhuma peça vencida.', todos.length ? 'Todas as datas de veiculação estão pela frente.' : 'Sem conteúdo em aberto neste cliente.');
  const porStatus = Object.entries(todos.reduce((m, x) => { (m[stDe(x)] = m[stDe(x)] || []).push(x); return m; }, {})).sort((a, b) => b[1].length - a[1].length);
  const maior = porStatus.length ? porStatus[0][1].length : 0;
  const barras = porStatus.length ? fv2ConsHtml('Por status', fichaPlural(todos.length, 'aberta', 'abertas'), fv2BarrasHtml(porStatus.slice(0, 7).map(([st, l]) => ({ rotulo: st, n: l.length, de: maior,
    cor: l[0].d.status_color || (typeof corDeStatus === 'function' ? corDeStatus(st)?.cor : '') || '', ligada: soStatus === st, chamada: `fv2Filtrar('conteudo','${soStatus === st ? 'todas' : `st:${fichaAspas(st)}`}')` }))), ' aria-label="Conteúdos por status"') : '';
  const plj = id && typeof planejamentosDaFicha === 'function' ? planejamentosDaFicha(id, nome) : null;
  const ultimo = plj && plj.lista && plj.lista[0];
  const mes = (p) => String(typeof pljMes === 'function' ? pljMes(p.mes) : p.mes || '').toLowerCase();
  const abrir = [fv2PodeIr() ? fv2VlinHtml('Aprovação de conteúdo', 'o feed do mês', "window.mundoVoxel.irPara('conteudo')") : '',
    ultimo ? fv2VlinHtml(`Planejamento de ${fichaEsc(mes(ultimo))}`, '', `abrirPlanejamento('${jsArg(ultimo.id)}')`)
      : plj && plj.podeCriar && typeof novoPlanejamento === 'function' ? fv2VlinHtml('Começar um planejamento', '', `novoPlanejamento('${jsArg(id)}', '${aspas}')`) : ''].join('');
  return fv2DuasHtml('conteudo', folha, alto + barras + (abrir ? fv2ConsHtml('Abrir', '', abrir) : ''));
}

// Aba Demandas (prancha V2-M-Cliente-Demandas): os pedidos fora do conteúdo mensal; ao lado, onde está o mensal, de onde
// vem um pedido e os atalhos.
function demandasDaFichaHtml(nome) {
  const E = FV2_LISTA.demandas, aspas = fichaAspas(nome);
  const record = clientMasterRecords().find((item) => item.name === nome) || { content: [], requests: [] };
  const FEITO = ['Feito', 'Finalizado', 'feito', 'finalizado', 'Concluídas', 'concluída'];
  const feito = (d) => FEITO.includes(String(d.status || ''));
  // A lista crua de Solicitações fala outro idioma; o normalizador é o mesmo da tabela de grupos.
  const linha = (d) => { const n = typeof normalizeRequestForOperational === 'function' ? normalizeRequestForOperational(d) : d;
    return { d: n, quando: String(n.veiculacao_iso || n.prazo_iso || '').slice(0, 10) }; };
  const porData = (a, b) => (a.quando || '9999').localeCompare(b.quando || '9999');
  const abertas = (record.requests || []).filter((d) => !feito(d)).map(linha).sort(porData);
  const feitas = (record.requests || []).filter(feito).map(linha).sort((a, b) => porData(b, a));
  if (E.filtro !== 'concluidos') E.filtro = 'abertos';
  const itens = E.filtro === 'concluidos' ? feitas : abertas;
  const chip = (k, rot, n) => `<button type="button" class="cv2-chip" role="radio" aria-checked="${E.filtro === k}" onclick="fv2Filtrar('demandas','${k}')">${rot}<span>${n}</span></button>`;
  const nova = `<button type="button" class="d3v-btn s" onclick="openCadastrosGoverned({ client: '${aspas}' })">Nova demanda</button>`;
  const folha = fv2FolhaOpHtml({ idGrade: 'grid-cliente-demandas', classe: 'demandas-grid', um: 'pedido', varios: 'pedidos', todos: itens, itens, colunas: ['Pedido', 'Conclusão'],
    chips: `<span class="cv2-chips" role="radiogroup" aria-label="Recorte">${chip('abertos', 'Abertos', abertas.length)}${chip('concluidos', 'Concluídos', feitas.length)}</span>`,
    titulo: `${E.filtro === 'concluidos' ? 'Pedidos concluídos' : 'Pedidos em aberto'} <span>· fora do conteúdo mensal</span>`,
    vazio: E.filtro === 'concluidos' ? fv2VazioHtml('ok', 'Nenhum pedido concluído ainda', 'Os pedidos entregues deste cliente ficam aqui.')
      : fv2VazioHtml('ok', 'Nenhuma solicitação em aberto', `Banner, site, evento, vídeo: o que ${fichaEsc(nome)} pedir fora do mensal aparece aqui, com o dono e o prazo.`, nova) });
  const { conteudos } = typeof abertosDoCliente === 'function' ? abertosDoCliente(nome) : { conteudos: 0 };
  const vencidas = typeof vencidosDoCliente === 'function' ? vencidosDoCliente(nome).length : 0;
  const abrir = fv2PodeIr() ? fv2ConsHtml('Abrir', '', fv2VlinHtml('Todas as demandas', 'da agência', "window.mundoVoxel.irPara('demandas')") + fv2VlinHtml('Projetos pontuais', '', "window.mundoVoxel.irPara('projetos')")) : '';
  return fv2DuasHtml('demandas', folha, fv2ConsHtml('O mensal está em outra aba', '', fv2VlinHtml('Conteúdo', `${conteudos} em aberto${vencidas ? `, ${fichaPlural(vencidas, 'vencida', 'vencidas')}` : ''}`, "trocarAbaDaFicha('conteudo')"))
    + fv2ConsHtml('De onde vem um pedido', '', '<p class="fv2-nota-lado">Do grupo do cliente (o VYBES avisa e propõe o card), de uma reunião (demandas sugeridas da ata) ou criado à mão.</p>') + abrir);
}

// O que a equipe registrou (folha da aba Cérebro): os registros que os chats do Claude.ai mandaram pelo conector.
function registrosDosChatsHtml(nome) {
  const id = String(idDoCliente(nome) || '');
  if (!id) return '';
  const estado = FICHA_REGISTROS[id];
  if (!estado) carregarRegistrosDoCliente(id).then(() => { if (FICHA_ABA === 'cerebro' && CLIENTE_ABERTO === nome) renderClientMasterDetail(nome); });
  const corpo = !estado ? fv2VazioHtml('relogio', 'Lendo os registros…')
    : estado.erro ? fv2VazioHtml('falta', fichaEsc(estado.erro))
    : !estado.dados.length ? fv2VazioHtml('lapis', 'Nada registrado ainda', 'Quando alguém fechar uma entrega deste cliente com o assistente, o que foi aprendido aparece aqui.')
    : `<ul class="reg-lista fv2-tb fv2-linhas fv2-reg">${estado.dados.map((g) => `<li class="reg-item"><details><summary class="fv2-tb-lin">
        <span class="d3v-etiqueta reg-tipo">${fichaEsc(TIPO_REGISTRO[g.tipo] || g.tipo)}</span><span class="fv2-tb-txt"><b>${fichaEsc(g.titulo)}</b></span>
        <small>${fichaEsc(String(g.criado_em || '').slice(0, 10).split('-').reverse().join('/'))} · ${fichaEsc(g.status.replace(/_/g, ' '))} · ${fichaEsc(g.origem)}${g.drive_erro ? ' · cópia no Drive falhou' : ''}</small></summary>
        <div class="fv2-reg-c"><p>${fichaEsc(g.resumo).replace(/\n/g, '<br>')}</p>
        ${g.decisoes ? `<h5>Decisões e regras novas</h5><p>${fichaEsc(g.decisoes).replace(/\n/g, '<br>')}</p>` : ''}
        ${g.proximos ? `<h5>Próximos passos</h5><p>${fichaEsc(g.proximos).replace(/\n/g, '<br>')}</p>` : ''}
        ${g.conteudo ? `<h5>Conteúdo</h5><pre>${fichaEsc(g.conteudo)}</pre>` : ''}</div></details></li>`).join('')}</ul>`;
  return `<section class="fv2-folha fv2-cheia" aria-label="O que a equipe registrou"><div class="cv2-cab"><h3>O que a equipe registrou</h3>
      <button type="button" class="fv2-cab-acao" onclick="delete FICHA_REGISTROS['${fichaEsc(id)}'];renderClientMasterDetail('${fichaAspas(nome)}')">atualizar</button></div>
    ${corpo}</section>`;
}

// Aba Cérebro (prancha V2-M-Cliente-Cerebro, 16/11/2026): o que o VYBES sabe da conta (o perfil, as cores e os quatro
// números), as regras de arte e o que a equipe registrou; no vidro, as ideias no banco, as pendências e os atalhos.
// O cérebro continua um só (vybe-clientes-cerebro.js): "abrir o mapa" abre o mesmo, com este cliente em foco.
function cerebroDaFichaHtml(nome) {
  if (typeof cerebroDoCliente !== 'function') return fv2DuasHtml('cerebro', registrosDosChatsHtml(nome), '');
  const c = cerebroDoCliente(nome), paleta = c.base?.paleta || [], n = typeof cerebroAspas === 'function' ? cerebroAspas(c.nome) : fichaAspas(c.nome), cats = c.categorias || {};
  const mapa = `abrirModalCerebroCliente('${n}', 'mapa')`, cerebro = `abrirModalCerebroCliente('${n}')`;
  const dica = 'O cérebro é um só, o do VYBES. Ele junta o cadastro, a operação, as pastas, as regras de arte e o que a equipe registra deste cliente, e mostra de onde vem cada coisa.';
  const num = (v, rot, tom = '') => `<div class="fv2-cb-num${tom && v ? ` ${tom}` : ''}"><b>${v}</b><span>${rot}</span></div>`;
  const sabe = `<section class="fv2-folha fv2-fixa fv2-cb" id="vybes-cli-cerebro-card" aria-label="O que o VYBES sabe desta conta"><div class="cv2-cab"><h3 title="${fichaEsc(dica)}">O que o VYBES sabe desta conta</h3><button type="button" class="fv2-cab-acao" onclick="${mapa}">abrir o mapa</button></div>
      <div class="fv2-cb-alto"><div class="fv2-cb-quem">${c.base ? `<b>${fichaEsc(c.base.instagram || c.nomeNoCadastro || c.nome)}</b><p>${fichaEsc(c.base.segmento || '')}</p><span>É com isto que ele revisa as peças e sugere as pautas.</span>`
          : `<b>${fichaEsc(c.nomeNoCadastro || c.nome)}</b><p>Ainda sem estudo de identidade no VYBES.</p><span>O cérebro mostra a operação, as pastas e o que a equipe registrar.</span>`}</div>
        ${paleta.length ? `<div class="fv2-cb-cores" role="list" aria-label="Cores da marca">${paleta.slice(0, 4).map((p) => `<span role="listitem" title="${fichaEsc([p.nome, p.hex].filter(Boolean).join(' · '))}"><i style="background:${fichaEsc(p.hex)}" aria-hidden="true"></i><em>${fichaEsc(p.nome || p.hex)}</em></span>`).join('')}</div>` : ''}</div>
      <div class="fv2-cb-nums">${num(c.resumo.atrasados, c.resumo.atrasados === 1 ? 'atrasado' : 'atrasados', 'r')}${num(c.resumo.pendencias, c.resumo.pendencias === 1 ? 'pendência' : 'pendências', 'a')}${num(c.resumo.ideias, c.resumo.ideias === 1 ? 'ideia no banco' : 'ideias no banco')}${num(c.resumo.regras, c.resumo.regras === 1 ? 'regra de arte' : 'regras de arte')}</div></section>`;
  const regras = cats.regras || [];
  const folhaRegras = `<section class="fv2-folha fv2-cb-regras" aria-label="Regras de arte"><div class="cv2-cab"><h3>Regras de arte</h3><span class="fv2-cab-nota">${regras.length ? `${regras.length} · o VYBES confere em cada peça` : ''}</span></div>
      ${regras.length ? `<ul class="fv2-tb fv2-linhas">${regras.map((r) => `<li class="fv2-tb-lin" title="${fichaEsc(r.detalhe || r.titulo)}"><i class="fv2-pt-g" aria-hidden="true"></i><span class="fv2-tb-txt">${fichaEsc(r.detalhe || r.titulo)}</span></li>`).join('')}</ul>`
        : fv2VazioHtml('lapis', 'Nenhuma regra de arte ainda', 'As regras ficam no cérebro do cliente; o VYBES confere cada peça com elas.', `<button type="button" class="d3v-btn sec s" onclick="${cerebro}">Abrir o cérebro</button>`)}</section>`;

  const ideias = cats.ideias || [], pend = (cats.atrasados || []).filter((i) => i.tom !== 'alerta');
  const item = (i, ponto = '') => fv2VlinHtml(fichaEsc(i.titulo || i.curto), i.sub && ponto ? fichaEsc(i.sub) : '', cerebro, ponto);
  const reu = c.idCadastro && window.VybeReunioes?.dadosDe ? window.VybeReunioes.dadosDe(String(c.idCadastro)) : null;
  const respondidas = reu ? (reu.questoes || []).filter((q) => (reu.onboarding?.respostas || {})[q.chave]).length : 0;
  const lado = fv2ConsHtml('Ideias no banco', String(ideias.length), ideias.length ? ideias.slice(0, 5).map((i) => item(i)).join('') + (ideias.length > 5 ? fv2VlinHtml(`Mais ${ideias.length - 5}`, 'no cérebro', cerebro) : '') : '<p class="d3m-vvazio">Nenhuma ideia guardada ainda.</p>', ' aria-label="Ideias no banco"')
    + (pend.length ? fv2ConsHtml(pend.length === 1 ? 'Pendência' : 'Pendências', String(pend.length), pend.slice(0, 3).map((i) => item(i, 'a')).join(''), ' aria-label="Pendências"') : '')
    + fv2ConsHtml('Abrir', '', fv2VlinHtml('O mapa', 'as sinapses desta conta', mapa)
      + (reu && (reu.questoes || []).length ? fv2VlinHtml('Questionário de entrada', `${respondidas} de ${reu.questoes.length}`, "trocarAbaDaFicha('onboarding')") : ''));
  return fv2DuasHtml('cerebro', sabe + folhaRegras + registrosDosChatsHtml(nome), lado);
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
    // A lista de uma aba guarda a rolagem entre um desenho e outro (marcar uma peça não leva a lista para o alto).
    const rolagem = document.querySelector('#client-master-detail .fv2-op-linhas')?.scrollTop || 0;
    original(cli);
    const node = document.getElementById('client-master-detail');
    if (!node || !node.innerHTML) return;
    const nome = (clientMasterRecords().find((r) => r.name === cli || normalizeClientKey(r.name) === normalizeClientKey(cli)) || {}).name || cli;
    const corpo = node.querySelector('.v2f-corpo') || node;
    // Fora do Resumo, a aba mora numa folha clara que rola por dentro (o esqueleto de cada aba vem da prancha dela).
    const naAba = (html) => { corpo.className = 'v2f-corpo fv2-aba'; corpo.innerHTML = html; };
    const naFolha = (html) => { corpo.className = 'v2f-corpo fv2-aba'; corpo.innerHTML = `<div class="fv2-folha fv2-aba-folha" data-aba="${FICHA_ABA}">${html}</div>`; };
    if (FICHA_ABA === 'financeiro' && !fichaEhDono()) FICHA_ABA = 'geral';
    if (FICHA_ABA === 'cadastro') naFolha(cadastroLeituraHtml(nome));
    else if (FICHA_ABA === 'financeiro') naFolha(financeiroDaFichaHtml(nome));
    else if (FICHA_ABA === 'ecossistema') naAba(ecossistemaDaFichaHtml(nome));
    else if (FICHA_ABA === 'cerebro') naAba(cerebroDaFichaHtml(nome));
    else if (FICHA_ABA === 'reunioes' && window.VybeReunioes) naAba(window.VybeReunioes.reunioesHtml(nome));
    else if (FICHA_ABA === 'onboarding' && window.VybeReunioes) naAba(window.VybeReunioes.onboardingHtml(nome));
    else if (FICHA_ABA === 'conteudo') naAba(conteudoDaFichaHtml(nome));
    else if (FICHA_ABA === 'demandas') naAba(demandasDaFichaHtml(nome));
    else node.querySelector('#vybes-cli-cerebro-card')?.remove();
    node.dataset.aba = FICHA_ABA;
    // A folha de estilo lê a aba no body (a barra de lote do painel dá lugar ao pé da lista da aba).
    if (document.body?.dataset) document.body.dataset.fv2Aba = FICHA_ABA;
    const linhasOp = node.querySelector('.fv2-op-linhas');
    if (linhasOp) { linhasOp.scrollTop = rolagem; fv2ContarAbaixo(linhasOp); }
    // Onboarding só aparece para quem está (ou esteve) em onboarding; a leitura das reuniões diz isso e repinta.
    const idFicha = typeof idDoCliente === 'function' ? String(idDoCliente(nome) || '') : '';
    if (idFicha && window.VybeReunioes?.carregar) window.VybeReunioes.carregar(idFicha);
    const reu = idFicha && window.VybeReunioes?.dadosDe ? window.VybeReunioes.dadosDe(idFicha) : null;
    const abertos = typeof abertosDoCliente === 'function' ? abertosDoCliente(nome) : { conteudos: 0, pedidos: 0 };
    const respondidas = reu ? (reu.questoes || []).filter((q) => (reu.onboarding?.respostas || {})[q.chave]).length : 0;
    const conta = { demandas: abertos.pedidos, conteudo: abertos.conteudos, reunioes: reu ? (reu.reunioes || []).length : '',
      onboarding: reu && (reu.questoes || []).length ? `${respondidas} de ${reu.questoes.length}` : '' };
    const naBarra = FICHA_ABAS.filter(([id]) => id !== 'cadastro' || FICHA_ABA === 'cadastro')
      .filter(([id]) => id !== 'financeiro' || fichaEhDono())
      .filter(([id]) => id !== 'onboarding' || FICHA_ABA === 'onboarding' || window.VybeReunioes?.temOnboarding?.(nome));
    const aba = ([id, rotulo]) => `<button type="button" role="radio" aria-checked="${id === FICHA_ABA}"${id === 'financeiro' ? ' title="Só os donos veem"' : ''} onclick="trocarAbaDaFicha('${id}')">${id === 'financeiro' ? CADEADO : ''}${rotulo}${
      conta[id] !== undefined && conta[id] !== '' && conta[id] !== 0 ? `<span class="v2f-q">${conta[id]}</span>` : ''}</button>`;
    const barra = `<nav class="ficha-abas cv2-seg fv2-abas" role="radiogroup" aria-label="Ficha do cliente">${naBarra.map(aba).join('')}</nav>`;
    const topo = document.getElementById('ficha-abas-topo');
    if (topo) topo.innerHTML = barra; else node.insertAdjacentHTML('afterbegin', barra);
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
