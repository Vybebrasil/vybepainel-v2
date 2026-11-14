// Aprovação de conteúdo (Paulo e Beatriz, 14/11/2026): "não dá pra aprovar a peça pelo botão?" e "por que não aparecem
// as prévias?". O Aprovar e o Pedir alteração do baralho (vybe-mundo-conteudo.js) e do "Para você decidir" do Hoje
// (vybe-mundo.js) acham a peça em qualquer quadro (conteúdo, solicitação, vybe:<id>), usam o destino do quadro dela e
// abrem os portões de sempre. A prévia vem de onde a gaveta tira os arquivos (area=arquivos, que agora aceita
// vybe:<id>, e o detalhe da peça), com ▶ no vídeo e "1/N" no carrossel. Tudo com fetch dublê; nada grava.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { ehAmploPessoa, ehCoordenacaoPessoa, COORDENACAO_MONDAY } from '../server/donos.js';

const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// O painel no navegador, o bastante para o módulo Conteúdo: os quadros, os portões (espiões) e o fetch dublê.
function painel({ respostas = {} } = {}) {
  const ouvintes = {}, avisos = [], portoes = [], abertas = [], pedidos = [];
  const doc = {
    addEventListener: (t, f) => { (ouvintes[t] ||= []).push(f); }, removeEventListener() {}, dispatchEvent() { return true; },
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, append() {}, setAttribute() {} }),
    body: { classList: { contains: () => false, toggle() {}, add() {}, remove() {} }, append() {} }, hidden: false,
  };
  const c = vm.createContext({
    console, Date, Math, JSON, URL, Intl, Promise, Map, Set, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: (f, ms = 0, ...a) => { const t = setTimeout(f, ms, ...a); if (ms >= 1000) t.unref?.(); return t; }, clearTimeout,
    AbortSignal: { timeout: () => undefined }, document: doc, CSS: { escape: (s) => s }, requestAnimationFrame: (f) => setTimeout(f, 0),
    MutationObserver: class { observe() {} disconnect() {} },
    clienteDesativado: () => false, aplicarFotosDoBanco() {},
    fetch: async (url) => {
      pedidos.push(String(url));
      const chave = Object.keys(respostas).find((k) => String(url).includes(k));
      const corpo = chave ? (typeof respostas[chave] === 'function' ? respostas[chave](String(url)) : respostas[chave]) : {};
      return { ok: corpo?.status ? corpo.status < 400 : true, status: corpo?.status || 200, json: async () => corpo?.json ?? corpo };
    },
    showToast: (t, tipo) => avisos.push([t, tipo]),
    openQualityGate: (item, op) => portoes.push(['qualidade', String(item.id), op.label, item.origem]),
    openStatusContextGate: (item, op) => portoes.push(['contexto', String(item.id), op.label, item.origem]),
    openItemWorkspace: (id) => abertas.push(['peca', String(id)]), openDemandaWorkspace: (id) => abertas.push(['demanda', String(id)]),
  });
  c.window = c; c.globalThis = c; c.addEventListener = () => {};
  for (const f of ['vybe-config.js', 'vybe-core.js', 'vybe-dominio.js', 'vybe-demandas.js', 'vybe-gaveta.js', 'vybe-conteudo-equilibrio.js', 'vybe-mundo-conteudo.js'])
    vm.runInContext(fs.readFileSync(f, 'utf8'), c, { filename: f });
  // Os portões e a gaveta abrem pelo nome global; o dublê fica por cima do que os arquivos declararam.
  vm.runInContext(`openQualityGate = globalThis.__q; openStatusContextGate = globalThis.__c; openItemWorkspace = globalThis.__p; openDemandaWorkspace = globalThis.__d; showToast = globalThis.__t;`,
    Object.assign(c, { __q: c.openQualityGate, __c: c.openStatusContextGate, __p: c.openItemWorkspace, __d: c.openDemandaWorkspace, __t: c.showToast }));
  const rodar = (js) => vm.runInContext(js, c);
  const erro = (img) => (ouvintes.error || []).forEach((f) => f({ target: img }));
  return { c, rodar, avisos, portoes, abertas, pedidos, erro };
}

// Produção sem "Para agendar" (como o quadro de demonstração) e Solicitações com o próprio catálogo.
const QUADROS = `
  STATUS_OPTIONS = ['A Fazer', 'Em Andamento', 'Para aprovação', 'Para agendar', 'Agendado', 'Finalizado', 'Alteração'].map((label, index) => ({ label, index, chave: label.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_') }));
  CATALOGO_STATUS_DEMANDAS = [['nova', 'Nova Demanda'], ['pode', 'Pode Fazer'], ['exec', 'Em execução'], ['em_aprovacao', 'Em Aprovação'], ['feito', 'Feito'], ['alteracao', 'Alteração']].map(([chave, rotulo], indice) => ({ chave, rotulo, indice, ativa: true }));
  FLUXO_STATUS = { boards: {} };
  DADOS_ALL = [{ id: '901', nome: 'Card - Promo', status: 'Para aprovação', cliente: 'Gonzalez' }, { id: 'vybe:77', nome: 'Reels - Treino', status: 'Para aprovação', cliente: 'Academia Lions' }];
  DADOS_DEMANDAS = [{ id: '555', nome: 'Folder da clínica', status: 'Em Aprovação', cliente: 'Clínica' }];
`;
const fila = (pecas) => `window.VybeAprovacoes = { estado: () => ({ dados: { pecas: ${JSON.stringify(pecas)} } }), atualizar() {} };`;
const PECAS = [
  { ref: '901', quadro: 'producao', titulo: 'Card - Promo', formato: 'Card', status: 'Para aprovação', etapa: 'interna', veiculacao: '2026-11-15' },
  { ref: 'vybe:77', quadro: 'producao', titulo: 'Reels - Treino', formato: 'Reels', status: 'Para aprovação', etapa: 'interna', veiculacao: '2026-11-16' },
  { ref: '555', quadro: 'demandas', titulo: 'Folder da clínica', formato: 'Folder', status: 'Em Aprovação', etapa: 'interna', veiculacao: '2026-11-17' },
];

test('Aprovar e Pedir alteração acham a peça em todo quadro e abrem o portão certo, com o destino do quadro dela', () => {
  const p = painel(); p.rodar(QUADROS + fila(PECAS));
  const decidir = (k, acao) => p.rodar(`(() => { const i = ${JSON.stringify(PECAS)}[${k}]; const d = VybeConteudo.decisaoDaFila(i, '${acao}'); if (d.opcao) d.portao(d.item, d.opcao); return d.motivo || ''; })()`);
  assert.equal(decidir(0, 'aprovar'), ''); assert.equal(decidir(0, 'alterar'), '');
  assert.equal(decidir(1, 'aprovar'), '', 'peça só do Vybe (vybe:<id>)');
  assert.equal(decidir(2, 'aprovar'), '', 'solicitação: sem "Para agendar", segue o fluxo do quadro');
  assert.equal(decidir(2, 'alterar'), '');
  assert.deepEqual(p.portoes, [
    ['qualidade', '901', 'Para agendar', 'producao_conteudo'], ['contexto', '901', 'Alteração', 'producao_conteudo'],
    ['qualidade', 'vybe:77', 'Para agendar', 'producao_conteudo'],
    ['qualidade', '555', 'Feito', 'solicitacao'], ['contexto', '555', 'Alteração', 'solicitacao'],
  ]);
  assert.deepEqual(p.abertas, []); assert.deepEqual(p.avisos, []);
  // A solicitação sai da fila quando o painel já a mostra fora de aprovação (o portão gravou).
  assert.equal(p.rodar('VybeConteudo.itemDaFila({ ref: "555", quadro: "demandas" }).status'), 'Em Aprovação');
});

test('no modo próprio o quadro manda; sem destino, a peça abre com o motivo curto', () => {
  const p = painel(); p.rodar(QUADROS + fila(PECAS));
  p.rodar(`FLUXO_STATUS = { boards: { [String(BOARD_DEMANDAS_ID)]: { modo: 'proprio', proximo: { em_aprovacao: 'exec' } } } };`);
  assert.equal(p.rodar(`VybeConteudo.decisaoDaFila(${JSON.stringify(PECAS[2])}, 'aprovar').opcao.label`), 'Em execução');
  p.rodar(`FLUXO_STATUS = { boards: { [String(BOARD_DEMANDAS_ID)]: { modo: 'perguntar', proximo: {} } } };`);
  assert.equal(p.rodar(`VybeConteudo.decisaoDaFila(${JSON.stringify(PECAS[2])}, 'aprovar').motivo`), 'o quadro dela não tem o status depois da aprovação');
  assert.equal(p.rodar(`VybeConteudo.decisaoDaFila({ ref: 'x9', quadro: 'producao' }, 'aprovar').motivo`), 'ela ainda não carregou no painel');
  // O botão do baralho: sem destino, abre a gaveta da solicitação e diz o porquê.
  const js = fs.readFileSync('vybe-mundo-conteudo.js', 'utf8');
  assert.match(js, /if \(!d\.opcao\) \{ st\.lote = \[\]; toast\(`Abri a peça: \$\{d\.motivo\}\.`, 'info'\); return abrirDaFila\(i\); \}/);
  assert.match(js, /d\.portao\(d\.item, d\.opcao\);/);
});

test('o Hoje usa a mesma decisão e a mesma prévia do Conteúdo', () => {
  const js = fs.readFileSync('vybe-mundo.js', 'utf8');
  const i = js.indexOf('  function filaDecidir()'), j = js.indexOf("  document.addEventListener('vybe:aprovacoes', () => { if (visaoHoje");
  const t = js.slice(i, j);
  assert.match(t, /VC\(\)\?\.itemDaFila/); assert.match(t, /VC\(\)\.decisaoDaFila\(i, acao\)/); assert.match(t, /vc\.previaDe\(String\(ref\)\)/); assert.match(t, /VC\(\)\.arteHtml\(/);
  assert.doesNotMatch(t, /fetch\(|area=arquivos|a decisão dela é por lá/);
});

const detalhe = (assets) => ({ ok: true, assets });
const drive = (id, w = 400) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;

test('prévia: imagem pela miniatura curta; vybe:<id> também; vídeo com ▶; carrossel com a 1ª e 1/N; sem miniatura, o nome', async () => {
  const p = painel({ respostas: {
    'area=arquivos&itens=901': { ok: true, itens: { 901: { total: 1, nome: 'promo.png', extensao: '.png', thumb: drive('d-promo', 160), abrir: 'https://drive.google.com/file/d/d-promo/view' } } },
    'area=arquivos&itens=vybe%3A77': { ok: true, itens: { 'vybe:77': { total: 1, nome: 'treino.mp4', extensao: '.mp4', thumb: drive('d-treino', 160), abrir: 'x' } } },
    'area=arquivos&itens=vybe%3A78': { ok: true, itens: { 'vybe:78': { total: 3, nome: 'tela-3.png', extensao: '.png', thumb: drive('d-3', 160) } } },
    'area=peca&item=vybe%3A78': detalhe([{ name: 'tela-10.png', file_extension: '.png', url_thumbnail: drive('d-10') }, { name: 'tela-2.png', file_extension: '.png', url_thumbnail: drive('d-2') }, { name: 'tela-1.png', file_extension: '.png', url_thumbnail: drive('d-1') }]),
    'area=arquivos&itens=555': { ok: true, itens: {} },
    'area=peca&item=555': detalhe([{ name: 'bastidores.mov', file_extension: '.mov', url_thumbnail: null, public_url: null }]),
    'area=arquivos&itens=556': { ok: true, itens: {} },
    'area=peca&item=556': detalhe([]),
  } });
  p.rodar(QUADROS);
  for (const r of ['901', 'vybe:77', 'vybe:78', '555', '556']) p.rodar(`VybeConteudo.previaDe(${JSON.stringify(r)})`);
  assert.equal(p.rodar('VybeConteudo.previaDe("901")'), undefined, 'enquanto busca');
  await espera(60);
  const pv = (r) => JSON.parse(JSON.stringify(p.rodar(`VybeConteudo.previaDe(${JSON.stringify(r)})`)));
  assert.equal(pv('901').tipo, 'imagem'); assert.equal(pv('901').thumb, drive('d-promo', 480), 'a miniatura no tamanho do cartão');
  assert.equal(pv('vybe:77').tipo, 'video');
  assert.deepEqual([pv('vybe:78').tipo, pv('vybe:78').n, pv('vybe:78').thumb], ['imagem', 3, drive('d-1')], 'a 1ª imagem pelo nome');
  assert.deepEqual([pv('555').tipo, pv('555').thumb, pv('555').nome], ['video', null, 'bastidores.mov']);
  assert.equal(pv('556'), null, 'sem arquivo nenhum');
  assert.ok(!p.pedidos.some((u) => u.includes('area=peca&item=901')), 'a miniatura curta basta: o detalhe não é pedido');
  const arte = (r) => p.rodar(`VybeConteudo.arteHtml(${JSON.stringify(r)}, VybeConteudo.previaDe(${JSON.stringify(r)}), 'Prévia')`);
  assert.match(arte('vybe:77'), /<img src="https:\/\/drive\.google\.com\/thumbnail\?id=d-treino&amp;sz=w480"[^>]*data-vc-previa="vybe:77">.*vc-previa-play/);
  assert.match(arte('vybe:78'), /1\/3<\/i>$/);
  assert.match(arte('555'), /vc-previa-quadro"><i class="vc-previa-play" aria-hidden="true">▶<\/i><b>bastidores\.mov<\/b>/);
  assert.doesNotMatch(arte('555'), /Sem arquivo/);
  assert.match(arte('556'), /Sem arquivo anexado/);
});

test('miniatura que não abre (o Drive não liberou): o detalhe da peça libera e traz; se nem assim, o nome do arquivo', async () => {
  let vezes = 0;
  const p = painel({ respostas: {
    'area=arquivos&itens=901': { ok: true, itens: { 901: { total: 1, nome: 'promo.png', extensao: '.png', thumb: drive('d-promo', 160) } } },
    'area=peca&item=901': () => { vezes++; return detalhe([{ name: 'promo.png', file_extension: '.png', url_thumbnail: drive('d-promo') }]); },
  } });
  p.rodar(QUADROS); p.rodar('VybeConteudo.previaDe("901")'); await espera(40);
  p.erro({ tagName: 'IMG', dataset: { vcPrevia: '901' } }); await espera(40);
  assert.equal(vezes, 1); assert.equal(p.rodar('VybeConteudo.previaDe("901").thumb'), drive('d-promo'));
  p.erro({ tagName: 'IMG', dataset: { vcPrevia: '901' } }); await espera(20);
  assert.equal(vezes, 1, 'o detalhe é pedido uma vez só');
  assert.equal(p.rodar('VybeConteudo.previaDe("901").thumb'), null);
  assert.match(p.rodar('VybeConteudo.arteHtml("901", VybeConteudo.previaDe("901"), "x")'), /<b>promo\.png<\/b>/);
});

test('area=arquivos aceita vybe:<id> e devolve a chave do jeito que a tela pediu', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY, monday_item_id text, removido_em timestamptz);
    INSERT INTO vybe_conteudos VALUES (1,'901',NULL),(77,NULL,NULL),(78,NULL,now());
    CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY, conteudo_id bigint, nome text, extensao text, drive_file_id text, criado_em timestamptz, ausente_em timestamptz);
    INSERT INTO vybe_conteudo_arquivos(conteudo_id,nome,extensao,drive_file_id,criado_em) VALUES
      (1,'antiga.png','.png','d-a',now()-interval '2 day'),(1,'nova.png','.png','d-n',now()),(77,'treino.mp4','.mp4','d-t',now()),(78,'x.png','.png','d-x',now());`);
  const fonte = fs.readFileSync('api/painel.js', 'utf8');
  const c = vm.createContext({ sql: () => sql });
  vm.runInContext(fonte.slice(fonte.indexOf('async function areaArquivos'), fonte.indexOf('// Baixar um arquivo da peca')), c);
  let corpo; const res = { status() { return this; }, json(v) { corpo = v; } };
  await c.areaArquivos({ method: 'GET', query: { itens: '901,vybe:77,vybe:78,vybe:abc' } }, res);
  assert.deepEqual(Object.keys(corpo.itens).sort(), ['901', 'vybe:77']);
  assert.deepEqual([corpo.itens['901'].nome, corpo.itens['901'].total], ['nova.png', 2]);
  assert.equal(corpo.itens['vybe:77'].thumb, 'https://drive.google.com/thumbnail?id=d-t&sz=w160');
  // Peça com id do Monday pedida por vybe:<id> volta como vybe:<id>.
  await c.areaArquivos({ method: 'GET', query: { itens: 'vybe:1' } }, res);
  assert.deepEqual(Object.keys(corpo.itens), ['vybe:1']);
});

test('a Beatriz é coordenação, vê a fila como os donos e a troca de status não pede papel', () => {
  const beatriz = { id: 40, monday_user_id: Object.keys(COORDENACAO_MONDAY)[0] };
  assert.equal(ehCoordenacaoPessoa(beatriz), true); assert.equal(ehAmploPessoa(beatriz, {}), true);
  const api = fs.readFileSync('api/conteudo.js', 'utf8');
  const st = api.slice(api.indexOf("if (acao === 'status') {"), api.indexOf("if (acao === 'datas') {"));
  assert.doesNotMatch(st, /403|ehDono|ehAmplo|admin/, 'status só pede a sessão');
});

test('Fila: a linha destacada acompanha a carta e o nome do cliente não cobre o título', () => {
  const js = fs.readFileSync('vybe-mundo-conteudo.js', 'utf8'), css = fs.readFileSync('padrao-v2/d3-previas.css', 'utf8');
  const passar = js.slice(js.indexOf('  function passar(para)'), js.indexOf('  const abrirDaFila'));
  assert.match(passar, /\.v2c-fila \[data-vc-apr-ir\]'\)\.forEach\(\(l\) => \{ if \(Number\(l\.dataset\.vcAprIr\) === novo\) l\.setAttribute\('aria-current', 'true'\); else l\.removeAttribute\('aria-current'\); \}\)/);
  assert.match(css, /\.d3a-fila-lin \.v2c-lin-txt > \.v2c-cli\{flex:0 1 auto;display:block;max-width:55%;overflow:hidden;text-overflow:ellipsis/);
});
