// Missões e cobranças no Irecity (vybe-mundo-missoes.js, Paulo, 07/11/2026).
// SAFE: roda o painel e as funções do Escritório (vybe-escritorio-missoes.js)
// num vm com um DOM de mentira; a "API" é um dublê, nada vai ao servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const MISSOES = [
  { ref: '101', quadro: 'producao', titulo: 'Card atrasado', prazo: '2026-11-05', tipo_data: 'prazo', atrasada: true, hoje: false, recompensa: { pontos: 30, moedas: 10 } },
  { ref: '102', quadro: 'producao', titulo: 'Reels de hoje', prazo: '2026-11-07', tipo_data: 'veiculacao', atrasada: false, hoje: true, recompensa: { pontos: 50, moedas: 20 } },
  { ref: '103', quadro: 'demandas', titulo: 'Cardápio da semana', prazo: '2026-11-12', tipo_data: 'prazo', atrasada: false, hoje: false, recompensa: { pontos: 20, moedas: 5 } },
];
const COBRANCAS = [
  { ref: '201', quadro: 'producao', titulo: 'Post do dia', tipo: 'hoje', dias: 0, data: '2026-11-07', prazo: '2026-11-07', cliente_id: '1', cliente: 'DiaCenter', status: 'Em andamento', com: ['Ana Paula'] },
  { ref: '202', quadro: 'producao', titulo: 'Carrossel atrasado', tipo: 'atrasada', dias: 3, data: '2026-11-04', prazo: '2026-11-04', veiculacao: '2026-11-09', cliente_id: '2', cliente: 'Antonov', status: 'Pode Fazer', com: [] },
  { ref: '203', quadro: 'producao', titulo: 'Aprovação pendente', tipo: 'lembrar_cliente', dias: 0, data: '2026-11-07', cliente_id: '1', cliente: 'DiaCenter', status: 'Ag. Aprovação Cliente', status_chave: 'ag_aprovacao_cliente', com: ['Ana Paula'] },
  { ref: '204', quadro: 'producao', titulo: 'Vence amanhã', tipo: 'vence', dias: -1, data: '2026-11-08', cliente_id: '3', cliente: 'VOA', status: 'A Fazer', com: ['Bruno Lima'] },
];
const BASE = () => ({ eu: '5', admin: false, equipe: [{ id: '5', nome: 'Ana Paula' }, { id: '7', nome: 'Bruno Lima' }] });
// As do Bruno (id 7), como o servidor calcula para quem administra.
const DE_BRUNO = [
  { ref: '401', quadro: 'producao', titulo: 'Vídeo do Bruno', prazo: '2026-11-06', tipo_data: 'prazo', atrasada: true, hoje: false, recompensa: { pontos: 80, moedas: 25 } },
  { ref: '402', quadro: 'demandas', titulo: 'Arte do Bruno', prazo: '2026-11-07', tipo_data: 'prazo', atrasada: false, hoje: true, recompensa: { pontos: 40, moedas: 10 } },
];
// O servidor de verdade: as de outra pessoa só para quem administra (403, como a ficha).
const recusa = () => Object.assign(new Error('Só quem administra vê as missões de outra pessoa.'), { status: 403 });
const servidor = ({ admin }) => (consulta) => {
  if (!consulta?.pessoa || consulta.pessoa === '5') return MISSOES;
  if (!admin) throw recusa();
  return consulta.pessoa === '7' ? DE_BRUNO : [];
};

// DOM mínimo: o painel só cria a camada com a janela dentro, troca o innerHTML
// da janela e ouve cliques na camada.
class El {
  constructor(tag, corpo) { this.tagName = tag.toUpperCase(); this.corpo = corpo; this.className = ''; this.innerHTML = ''; this.ouvintes = {}; this.isConnected = false; this.dataset = {}; this.filhos = []; this.atributos = {}; }
  append(el) { this.filhos.push(el); }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  addEventListener(tipo, fn) { (this.ouvintes[tipo] ||= []).push(fn); }
  remove() { const i = this.corpo.filhos.indexOf(this); if (i >= 0) this.corpo.filhos.splice(i, 1); this.isConnected = false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return false; }
  focus() {}
}
function montar({ base = BASE(), missoes = MISSOES, cobrancas = COBRANCAS, extras = {}, dono = false } = {}) {
  const corpo = { filhos: [], append(el) { this.filhos.push(el); el.isConnected = true; } };
  const chamadas = [], teclas = [], abertas = [], guardado = new Map();
  const ctx = {
    console, setTimeout, clearTimeout,
    document: { body: corpo, activeElement: null, createElement: (t) => new El(t, corpo), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => guardado.set(k, String(v)) },
    matchMedia: () => ({ matches: false }),
    addEventListener: (tipo, fn) => { if (tipo === 'keydown') teclas.push(fn); },
    safeText: (v) => String(v || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])),
    escritorio: { base },
    // Dono vem da sessão (auditoria 09/11), nunca do primeiro nome.
    souDonoDaSessao: () => dono,
    escritorioHojeBahia: () => '2026-11-07',
    escritorioApi: async (acao, _corpo, consulta) => {
      chamadas.push(JSON.stringify([acao, consulta || null]));
      // `missoes` pode ser uma função da consulta (a de outra pessoa) e lançar a recusa do servidor.
      if (acao === 'missoes') return { ok: true, disponivel: true, funcao: 'criacao', missoes: typeof missoes === 'function' ? missoes(consulta) : missoes };
      if (acao === 'cobrancas') return { ok: true, cobrancas: typeof cobrancas === 'function' ? cobrancas(consulta) : cobrancas };
      throw new Error('rota inesperada: ' + acao);
    },
    openItemWorkspace: (id) => abertas.push(['producao', String(id)]),
    openDemandaWorkspace: (id) => abertas.push(['demandas', String(id)]),
    ...extras,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('vybe-escritorio-missoes.js', 'utf8'), ctx, { filename: 'vybe-escritorio-missoes.js' });
  vm.runInContext(fs.readFileSync('vybe-mundo-missoes.js', 'utf8'), ctx, { filename: 'vybe-mundo-missoes.js' });
  const raiz = () => corpo.filhos.find((el) => el.className === 'vv-missoes-camada');
  // Clique delegado: o alvo responde ao closest() do atributo pedido.
  const clicar = (atributos) => {
    const dataset = Object.fromEntries(Object.entries(atributos).map(([k, v]) => [k.replace(/^data-/, '').replace(/-(\w)/g, (_, l) => l.toUpperCase()), v]));
    const botao = { dataset, getBoundingClientRect: () => ({ left: 10, top: 10, width: 100, height: 30 }) };
    const alvo = { closest: (sel) => (Object.keys(atributos).some((k) => sel.includes(k)) ? botao : null) };
    raiz().ouvintes.click.forEach((fn) => fn({ target: alvo }));
  };
  const esc = () => { const e = { key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }; teclas.forEach((fn) => fn(e)); return e; };
  return { ctx, corpo, raiz, clicar, esc, chamadas, abertas, guardado, M: ctx.VybeMissoes };
}
const html = (t) => t.raiz().filhos[0].innerHTML;
const esperar = () => new Promise((r) => setImmediate(r));

test('abre e fecha pelo X, pelo fundo e pelo Esc; sem o Escritório, oferece entrar', async () => {
  const t = montar({ base: null });
  let entrou = 0;
  t.ctx.abrirEscritorio = async () => { entrou++; t.ctx.escritorio.base = BASE(); };
  assert.equal(t.M.aberto(), false);
  await t.M.abrir();
  assert.equal(t.M.aberto(), true);
  assert.equal(t.corpo.filhos.length, 1, 'uma camada só, no body');
  const janela = t.raiz().filhos[0];
  assert.equal(janela.id, 'vv-missoes');
  assert.deepEqual({ ...janela.atributos }, { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vv-missoes-titulo' });
  assert.match(html(t), /<h2 id="vv-missoes-titulo">Suas missões e cobranças<\/h2>/);
  assert.match(html(t), /data-vm-entrar[^>]*>Entrar no Escritório</);
  assert.equal(t.chamadas.length, 0, 'sem a entrada do Escritório não lê nada');
  t.clicar({ 'data-vm-entrar': '' });
  await esperar(); await esperar();
  assert.equal(entrou, 1, 'o botão usa abrirEscritorio()');
  assert.match(html(t), /Card atrasado/, 'depois de entrar, as missões aparecem');
  const e = t.esc();
  assert.equal(e.defaultPrevented, true, 'o Esc é do painel (o mundo não fecha o módulo junto)');
  assert.equal(t.M.aberto(), false);
  assert.equal(t.corpo.filhos.length, 0);
  assert.equal(t.esc().defaultPrevented, false, 'fechado, o Esc segue para o resto da tela');
  await t.M.abrir('cobrancas');
  t.clicar({ 'data-vm-fechar': '' });
  assert.equal(t.M.aberto(), false, 'o X fecha');
  await t.M.abrir();
  t.raiz().ouvintes.click.forEach((fn) => fn({ target: t.raiz() }));
  assert.equal(t.M.aberto(), false, 'clicar no fundo fecha');
  await t.M.abrir(); await t.M.abrir('cobrancas');
  assert.equal(t.corpo.filhos.length, 1, 'abrir de novo reaproveita o mesmo painel');
});

test('missões: os filtros do Escritório, prazo, XP e moedas; a escolha fica guardada', async () => {
  const t = montar();
  await t.M.abrir('missoes');
  assert.deepEqual(t.chamadas, [JSON.stringify(['missoes', null]), JSON.stringify(['cobrancas', { pessoa: '5' }])], 'as mesmas cargas do Escritório; a outra aba já vem para o contador');
  let h = html(t);
  assert.match(h, /Concluir tudo vale <span class="ofc-missao-xp">\+100 XP<\/span><span class="ofc-missao-moeda">\+35<\/span>/);
  assert.match(h, /data-vm-filtro="atrasadas" aria-pressed="true" class="alerta">Atrasadas<span class="vv-missoes-badge">1<\/span>/, 'com atrasada, começa nas atrasadas');
  assert.match(h, /data-vm-filtro="todas" aria-pressed="false">Todas<span class="vv-missoes-badge">3<\/span>/);
  assert.match(h, /class="vv-missoes-linha atrasada"[^>]*data-vm-missao="101"/);
  assert.match(h, /<em class="ofc-missao-prazo atrasada">Prazo vencido · 05\/11<\/em>/);
  assert.doesNotMatch(h, /Reels de hoje/);
  assert.match(h, /id="vv-missoes-aba-missoes"[^>]*aria-selected="true"[^>]*>Missões<span class="vv-missoes-badge alerta">3<\/span>/);
  t.clicar({ 'data-vm-filtro': 'hoje' });
  h = html(t);
  assert.match(h, /<em class="ofc-missao-prazo hoje">Veiculação hoje<\/em>/);
  assert.match(h, /class="vv-missoes-linha hoje"[^>]*data-vm-missao="102"/);
  assert.doesNotMatch(h, /Card atrasado/);
  assert.equal(t.guardado.get('vybe-escritorio-missoes-filtro'), 'hoje', 'a mesma escolha do cartão do Escritório');
  t.clicar({ 'data-vm-filtro': 'proximas' });
  assert.match(html(t), /<em class="ofc-missao-prazo">Prazo 12\/11<\/em>/);
  assert.match(html(t), /Cardápio da semana/);
  t.clicar({ 'data-vm-filtro': 'todas' });
  for (const titulo of ['Card atrasado', 'Reels de hoje', 'Cardápio da semana']) assert.match(html(t), new RegExp(titulo));
  // Abrir a missão: a peça abre pelo caminho do Escritório e o painel sai da frente.
  t.clicar({ 'data-vm-missao': '103', 'data-vm-quadro': 'demandas' });
  assert.deepEqual(t.abertas.map((a) => a.join(':')), ['demandas:103']);
  assert.equal(t.M.aberto(), false);
  // Reabrir não lê de novo antes de 1 minuto (a mesma memória do Escritório).
  await t.M.abrir();
  assert.equal(t.chamadas.filter((c) => c.includes('"missoes"')).length, 1);
  assert.match(html(t), /data-vm-filtro="todas" aria-pressed="true"/, 'o filtro escolhido continua');
});

test('missões sem o banco de pontos e sem nada aberto', async () => {
  const t = montar({ missoes: [] });
  t.ctx.escritorioApi = async () => ({ ok: true, disponivel: false, missoes: [] });
  await t.M.abrir();
  assert.match(html(t), /As missões ainda não estão ligadas/);
  const v = montar({ missoes: [] });
  await v.M.abrir();
  assert.match(html(v), /Nenhuma missão aberta/);
  assert.doesNotMatch(html(v), /data-vm-filtro/);
});

test('cobranças: agrupadas por cliente com o pior pedido primeiro, as datas e o botão de abrir', async () => {
  const t = montar();
  await t.M.abrir('cobrancas');
  assert.ok(t.chamadas.includes(JSON.stringify(['cobrancas', { pessoa: '5' }])), 'as de quem está logado, pela rota do quarto');
  const h = html(t);
  assert.match(h, /3 clientes · 4 demandas/);
  const pos = (s) => h.indexOf(s);
  assert.ok(pos('<b>Antonov</b>') < pos('<b>DiaCenter</b>') && pos('<b>DiaCenter</b>') < pos('<b>VOA</b>'), 'atrasada antes do dia, o dia antes do aviso');
  assert.ok(pos('Post do dia') < pos('Aprovação pendente'), 'dentro do cliente, a cobrança antes do lembrete');
  assert.match(h, /<span class="ofc-cobranca-cliente cobra"><b>Antonov<\/b><small>1<\/small><\/span>/);
  assert.match(h, /<span class="ofc-cobranca-cliente cobra"><b>DiaCenter<\/b><small>2<\/small><\/span>/);
  assert.match(h, /<span class="ofc-cobranca-cliente avisa"><b>VOA<\/b><small>1<\/small><\/span>/);
  assert.match(h, /<em class="ofc-missao-prazo atrasada">Prazo vencido há 3 dias \(04\/11\)<\/em>/);
  assert.match(h, /Esperando aprovação do cliente · prazo/);
  assert.match(h, /onclick="abrirMissaoEscritorio\('202','producao',event\);VybeMissoes\.fechar\(\{foco:false\}\)"/, 'abrir a demanda tira o painel da frente');
  assert.match(h, /class="ofc-cobranca-datas-abrir" onclick="abrirDatasCobrancaEscritorio\(this\)" data-ref="202" data-quadro="producao" data-prazo="2026-11-04" data-veic="2026-11-09"/, 'o botão das datas é o do Escritório');
  assert.match(h, /id="vv-missoes-aba-cobrancas"[^>]*aria-selected="true"[^>]*>Cobranças<span class="vv-missoes-badge alerta">4<\/span>/);
  // De outra pessoa: todos veem as cobranças de todos, como no quarto.
  await t.M.abrir('cobrancas', '7');
  assert.ok(t.chamadas.includes(JSON.stringify(['cobrancas', { pessoa: '7' }])));
  assert.match(html(t), /Missões e cobranças de Bruno/);
  // A leitura que o saguão acabou de fazer serve aqui (sem ir ao servidor).
  const s = montar();
  s.ctx.escritorio.cobrancasDoLobby = { pessoa: '5', em: Date.now(), lista: COBRANCAS.slice(0, 1) };
  await s.M.abrir('cobrancas');
  assert.ok(!s.chamadas.some((c) => c.includes('"cobrancas"')));
  assert.match(html(s), /1 cliente · 1 demanda/);
  // Ninguém cobrando.
  const v = montar({ cobrancas: [] });
  await v.M.abrir('cobrancas');
  assert.match(html(v), /Ninguém cobrando/);
});

test('missões de outra pessoa: quem administra vê pelo servidor, com XP e moedas', async () => {
  const PECAS = [{ id: '301', nome: 'Peça atrasada', prazo_iso: '2026-11-01' }];
  const extras = { TEAM_USERS: [{ id: '7', name: 'Bruno Lima' }], focusOwnItems: (u) => (u.id === '7' ? PECAS : []) };
  const admin = montar({ base: { ...BASE(), admin: true }, missoes: servidor({ admin: true }), extras });
  await admin.M.abrir('missoes', '7');
  assert.ok(admin.chamadas.includes(JSON.stringify(['missoes', { pessoa: '7' }])), 'a rota de missões com a pessoa pedida');
  assert.ok(!admin.chamadas.includes(JSON.stringify(['missoes', null])), 'as próprias não são lidas para mostrar as de outra pessoa');
  assert.equal(admin.ctx.escritorio.missoes, undefined, 'as de outra pessoa não viram as missões de quem está logado');
  admin.clicar({ 'data-vm-filtro': 'todas' });
  const h = html(admin);
  assert.match(h, /Missões e cobranças de Bruno/);
  assert.match(h, /Concluir tudo vale <span class="ofc-missao-xp">\+120 XP<\/span><span class="ofc-missao-moeda">\+35<\/span>/);
  assert.match(h, /class="vv-missoes-linha atrasada"[^>]*data-vm-missao="401"/);
  assert.match(h, /Arte do Bruno/);
  assert.doesNotMatch(h, /Sem XP e moedas/);
  assert.doesNotMatch(h, /Peça atrasada/, 'com o servidor respondendo, as tarefas do painel não entram');
  assert.match(h, /id="vv-missoes-aba-missoes"[^>]*>Missões<span class="vv-missoes-badge alerta">2<\/span>/);
  // Reabrir em menos de 1 minuto não lê de novo (a mesma memória do Escritório).
  await admin.M.abrir('missoes', '7');
  assert.equal(admin.chamadas.filter((c) => c === JSON.stringify(['missoes', { pessoa: '7' }])).length, 1);
});

test('missões de outra pessoa: sem permissão, recusa do servidor ou falha voltam às tarefas do painel, sem XP', async () => {
  const PECAS = [{ id: '301', nome: 'Peça atrasada', prazo_iso: '2026-11-01' }, { id: '302', nome: 'Peça de hoje', veiculacao_iso: '2026-11-07' }, { id: '303', nome: 'Sem data' }];
  const extras = { TEAM_USERS: [{ id: '7', name: 'Bruno Lima' }, { id: '99', name: 'Fora do Escritório' }], focusOwnItems: (u) => (u.id === '7' || u.id === '99' ? PECAS : []) };
  // Nem admin nem sócio: nada vai ao servidor.
  const fechado = montar({ missoes: servidor({ admin: false }), extras });
  await fechado.M.abrir('missoes', '7');
  assert.match(html(fechado), /As missões de Bruno são só para a gestão/);
  assert.ok(!fechado.chamadas.some((c) => c.includes('"missoes"')), 'sem permissão, a rota de missões nem é chamada');
  // Sócio sem admin: o servidor recusa (403) e ficam as tarefas do painel, com o aviso.
  const socio = montar({ base: { eu: '9', admin: false, equipe: [{ id: '9', nome: 'Vinícius Rocha' }, { id: '7', nome: 'Bruno Lima' }] }, missoes: servidor({ admin: false }), extras, dono: true });
  await socio.M.abrir('missoes', '7');
  assert.ok(socio.chamadas.includes(JSON.stringify(['missoes', { pessoa: '7' }])), 'sócio pede ao servidor');
  socio.clicar({ 'data-vm-filtro': 'todas' });
  let h = html(socio);
  assert.doesNotMatch(h, /só para a gestão/, 'sócio (dono pela sessão) vê');
  assert.match(h, /Sem XP e moedas: o valor das missões de outra pessoa só sai para quem administra\./);
  assert.match(h, /Peça atrasada/);
  assert.match(h, /<em class="ofc-missao-prazo hoje">Veiculação hoje<\/em>/);
  assert.match(h, /<em class="ofc-missao-prazo">Sem prazo nem veiculação<\/em>/);
  assert.doesNotMatch(h, /Concluir tudo vale/);
  assert.doesNotMatch(h, /vv-missoes-erro/, 'a recusa não é erro: sem "Tentar de novo"');
  // Admin com o servidor fora do ar: as tarefas do painel, o erro e o "Tentar de novo", que relê.
  let fora = true;
  const falha = montar({ base: { ...BASE(), admin: true }, missoes: (c) => { if (fora && c?.pessoa) throw new Error('fora do ar'); return servidor({ admin: true })(c); }, extras });
  await falha.M.abrir('missoes', '7');
  falha.clicar({ 'data-vm-filtro': 'todas' });
  h = html(falha);
  assert.match(h, /Não foi possível atualizar: fora do ar <button type="button" data-vm-recarregar>Tentar de novo<\/button>/);
  assert.match(h, /Sem XP e moedas: o valor das missões não chegou/);
  assert.match(h, /Peça atrasada/);
  fora = false;
  falha.clicar({ 'data-vm-recarregar': '' });
  await esperar(); await esperar();
  h = html(falha);
  assert.match(h, /Concluir tudo vale <span class="ofc-missao-xp">\+120 XP<\/span>/, 'de volta, o valor de verdade');
  assert.doesNotMatch(h, /Sem XP e moedas|vv-missoes-erro/);
  // Quem não está no Escritório (só no painel): sem id para o servidor, as tarefas do painel.
  const semId = montar({ base: { ...BASE(), admin: true }, missoes: servidor({ admin: true }), extras });
  await semId.M.abrir('missoes', '99');
  assert.ok(!semId.chamadas.some((c) => c.includes('"missoes"')), 'id do painel não vai para a rota de missões');
  assert.match(html(semId), /Sem XP e moedas: esta pessoa não está no Escritório/);
});

test('resumo para o cartão do HUD', async () => {
  const t = montar();
  const r = JSON.parse(JSON.stringify(await t.M.resumo()));
  assert.deepEqual(r, { missoesAtrasadas: 1, missoesHoje: 1, xpEmJogo: 100, moedasEmJogo: 35, cobrancas: 4, clientesCobrando: 3, pessoaId: '5' });
  const outra = JSON.parse(JSON.stringify(await t.M.resumo('7')));
  assert.equal(outra.missoesAtrasadas, null, 'sem permissão, missões de outra pessoa ficam sem número');
  assert.equal(outra.cobrancas, 4);
  const PECAS = [{ id: '301', nome: 'Peça atrasada', prazo_iso: '2026-11-01' }, { id: '302', nome: 'Peça de hoje', veiculacao_iso: '2026-11-07' }];
  const extras = { TEAM_USERS: [{ id: '7', name: 'Bruno Lima' }], focusOwnItems: () => PECAS };
  // Quem administra: o XP e as moedas de outra pessoa vêm do servidor.
  const admin = montar({ base: { ...BASE(), admin: true }, cobrancas: [], missoes: servidor({ admin: true }), extras });
  const a = JSON.parse(JSON.stringify(await admin.M.resumo('7')));
  assert.deepEqual(a, { missoesAtrasadas: 1, missoesHoje: 1, xpEmJogo: 120, moedasEmJogo: 35, cobrancas: 0, clientesCobrando: 0, pessoaId: '7' });
  assert.ok(admin.chamadas.includes(JSON.stringify(['missoes', { pessoa: '7' }])));
  // Servidor recusou (sócio sem admin): as tarefas do painel contam, sem XP.
  const socio = montar({ base: { eu: '9', admin: false, equipe: [{ id: '9', nome: 'Deivid Ribeiro' }, { id: '7', nome: 'Bruno Lima' }] }, cobrancas: [], missoes: servidor({ admin: false }), dono: true, extras });
  const s = JSON.parse(JSON.stringify(await socio.M.resumo('7')));
  assert.deepEqual(s, { missoesAtrasadas: 1, missoesHoje: 1, xpEmJogo: null, moedasEmJogo: null, cobrancas: 0, clientesCobrando: 0, pessoaId: '7' });
  const sem = JSON.parse(JSON.stringify(await montar({ base: null }).M.resumo()));
  assert.equal(sem.semEscritorio, true);
  assert.equal(sem.missoesAtrasadas, null);
  // Leitura de cobranças que falhou: número desconhecido, não zero.
  const falha = montar();
  falha.ctx.escritorioApi = async (acao) => { if (acao === 'missoes') return { ok: true, missoes: MISSOES }; throw new Error('fora do ar'); };
  assert.equal((await falha.M.resumo()).cobrancas, null);
});
