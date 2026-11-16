// A logo do cliente, uma fonte só para todas as telas (Paulo, 16/11/2026: "em planejamentos vi que alguns clientes têm a
// logo e outros não... deixa todos com sua logo... pega do insta ou do drive"). Ordem: cadastro → Instagram → Drive →
// iniciais; a rota da logo só lê (nada de UPDATE) e o plano de gravação só propõe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { logoDoCliente, arquivoDoLinkDoDrive, limparCacheDeLogos } from '../server/planejamentos-api.js';
import { areaFeedInstagram, limparCacheDoFeed } from '../server/instagram-feed.js';
import { planejarLogos, dossieDoCliente } from '../server/logos-clientes.js';

const ler = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function tela({ cadastro = [], perfis = new Map(), cerebro = [], extra = {} } = {}) {
  const c = vm.createContext({ CADASTRO_CLIENTES: cadastro, FEED: { perfis }, VYBES_CEREBRO_BASE: cerebro,
    feedFotoIg: (u) => `/api/painel?area=feed_instagram&foto=${encodeURIComponent(u)}`, ...extra });
  vm.runInContext(ler('vybe-logo-cliente.js'), c);
  // Os arrays voltam de outro contexto: passa por JSON para o deepEqual comparar o conteúdo.
  return (js) => { const v = vm.runInContext(js, c); return v === undefined ? v : JSON.parse(JSON.stringify(v)); };
}

test('fontes na ordem: cadastro, Instagram (o servidor lê só a foto), Drive', () => {
  const run = tela({ cadastro: [{ id: 7, nome: 'Lions', tem_logo: true, cadastro: { instagram: '@lions' } }] });
  const f = run("fontesDaLogoDoCliente('Lions')");
  assert.equal(f.length, 3);
  assert.match(f[0], /^\/api\/painel\?area=logo&c=7&fonte=cadastro&v=/);
  assert.equal(f[1], '/api/painel?area=feed_instagram&avatar=lions');
  assert.equal(f[2], '/api/painel?area=logo&c=7&fonte=drive');
});

test('o Feed já leu o perfil: usa a foto de lá; leu com erro: pula o Instagram', () => {
  const perfis = new Map([['lions', { foto: 'https://x.cdninstagram.com/a.jpg' }], ['priv', { erro: 'Perfil privado.' }]]);
  const run = tela({ perfis, cadastro: [{ id: 1, nome: 'Lions', cadastro: { instagram: 'instagram.com/lions/' } }, { id: 2, nome: 'Priv', cadastro: { instagram: '@priv' } }] });
  assert.deepEqual(run("fontesDaLogoDoCliente('Lions')"), ['/api/painel?area=feed_instagram&foto=https%3A%2F%2Fx.cdninstagram.com%2Fa.jpg', '/api/painel?area=logo&c=1&fonte=drive']);
  assert.deepEqual(run("fontesDaLogoDoCliente('Priv')"), ['/api/painel?area=logo&c=2&fonte=drive']);
});

test('sem @ no cadastro, o @ do cérebro do cliente (como o Feed); link da ficha conta como logo do cadastro', () => {
  const cerebro = [{ nome: 'VÖA Sportswear', apelidos: ['voa'], instagram: '@voasportswear' }];
  const run = tela({ cerebro, cadastro: [{ id: 3, nome: 'VOA', cadastro: { logo_url: 'https://drive.google.com/file/d/abcdefghijk123/view' } }] });
  const f = run("fontesDaLogoDoCliente('VOA')");
  assert.match(f[0], /fonte=cadastro/);
  assert.equal(f[1], '/api/painel?area=feed_instagram&avatar=voasportswear');
});

test('cliente fora do cadastro e sem @: as iniciais, sem pedir nada', () => {
  const run = tela();
  assert.equal(run("logoDoClienteHtml('Cliente Novo')"), '<i class="d3v-foto" aria-hidden="true">CL</i>');
  assert.equal(run("logoDoClienteHtml('Cliente Novo', { classe: '', iniciais: 'CN' })"), 'CN');
});

test('a imagem passa para a próxima fonte quando falha e termina nas iniciais, com a cor dela', () => {
  const run = tela({ cadastro: [{ id: 9, nome: 'Gonzalez', cadastro: { instagram: '@gonzalez' } }] });
  const html = run("logoDoClienteHtml('Gonzalez', { classe: 'd3v-foto cv2-foto', iniciais: 'GO', estilo: '--h:40' })");
  assert.match(html, /^<img class="d3v-foto cv2-foto" style="--h:40" src="\/api\/painel\?area=feed_instagram&amp;avatar=gonzalez" data-logo-mais="\/api\/painel\?area=logo&amp;c=9&amp;fonte=drive" data-logo-ini="GO"/);
  assert.match(html, /onerror="logoProximaFonte\(this\)"/);
  // Uma <img> de mentira, com o mesmo contrato do DOM que a função usa.
  let trocadaPor = null;
  const img = { attrs: { src: '/api/painel?area=feed_instagram&avatar=gonzalez', style: '--h:40' }, className: 'd3v-foto cv2-foto',
    dataset: { logoMais: '/api/painel?area=logo&c=9&fonte=drive', logoIni: 'GO' },
    getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, replaceWith(n) { trocadaPor = n; } };
  const doc = { createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }), createTextNode: (t) => ({ texto: t }) };
  const run2 = tela({ cadastro: [{ id: 9, nome: 'Gonzalez', cadastro: { instagram: '@gonzalez' } }], extra: { document: doc, img } });
  run2('logoProximaFonte(img)');
  assert.equal(img.attrs.src, '/api/painel?area=logo&c=9&fonte=drive');
  run2('logoProximaFonte(img)');
  assert.equal(trocadaPor.textContent, 'GO');
  assert.equal(trocadaPor.className, 'd3v-foto cv2-foto');
  assert.equal(trocadaPor.attrs.style, '--h:40');
  // As duas que falharam não são pedidas de novo no próximo desenho da tela.
  assert.deepEqual(run2("fontesDaLogoDoCliente('Gonzalez')"), []);
});

test('as telas usam a mesma fonte (sem ler FEED.perfis cada uma do seu jeito)', () => {
  for (const [arq, chamada] of [['vybe-gestor.js', 'logoDoClienteHtml(nome)'], ['vybe-clientes.js', 'logoDoClienteHtml(nome, { classe: cls'],
    ['vybe-mundo.js', 'logoDoClienteHtml(nome, { classe, iniciais: iniciaisD3(nome) })'], ['vybe-feed.js', 'logoDoClienteHtml(cli.nome, { classe, iniciais })'],
    ['vybe-mundo-conteudo.js', "logoDoClienteHtml(nome, { classe: '', iniciais })"]]) assert.ok(ler(arq).includes(chamada), arq);
  assert.doesNotMatch(ler('vybe-mundo.js'), /function fotoDoClienteD3/);
  const html = ler('index.html');
  assert.ok(html.indexOf('/vybe-logo-cliente.js') > html.indexOf('/vybe-core.js') && html.indexOf('/vybe-logo-cliente.js') < html.indexOf('/vybe-gestor.js'));
});

// ---------- servidor ----------
function resposta() {
  const r = { codigo: 0, cab: {}, corpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.setHeader = (k, v) => { r.cab[k] = v; };
  r.end = (b) => { r.corpo = b ?? r.corpo; return r; };
  r.send = (b) => { r.corpo = b; return r; };
  r.json = (b) => { r.corpo = b; return r; };
  return r;
}
const baixarPng = (ids) => async (id) => { ids.push(id); return { headers: { get: () => 'image/png' }, arrayBuffer: async () => new Uint8Array([137, 80]).buffer }; };

test('arquivoDoLinkDoDrive: só link do Drive vira id', () => {
  assert.equal(arquivoDoLinkDoDrive('https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing'), '1AbCdEfGhIjK');
  assert.equal(arquivoDoLinkDoDrive('https://drive.google.com/open?id=1AbCdEfGhIjK'), '1AbCdEfGhIjK');
  assert.equal(arquivoDoLinkDoDrive('https://exemplo.com/file/d/1AbCdEfGhIjK'), '');
  assert.equal(arquivoDoLinkDoDrive('https://drive.google.com/drive/folders/1AbCdEfGhIjK'), '');
});

test('fonte=cadastro: o link da ficha no Drive sai pelo servidor, sem gravar nada', async () => {
  const consultas = [], ids = [];
  const sql = async (p) => { consultas.push(p.join('?')); return [{ nome: 'Lions', arquivo: null, url: null, logo_url: 'https://drive.google.com/file/d/1AbCdEfGhIjK/view', pasta: null }]; };
  const r = resposta();
  await logoDoCliente({ query: { c: '5', fonte: 'cadastro' } }, r, sql, { baixar: baixarPng(ids) });
  assert.equal(r.codigo, 200);
  assert.deepEqual(ids, ['1AbCdEfGhIjK']);
  assert.equal(r.cab['Content-Type'], 'image/png');
  assert.equal(consultas.length, 1);
  assert.doesNotMatch(consultas[0], /UPDATE/);
});

test('fonte=cadastro: sem logo guardada é 404 (a tela passa para o Instagram)', async () => {
  const r = resposta();
  await logoDoCliente({ query: { c: '5', fonte: 'cadastro' } }, r, async () => [{ nome: 'X', arquivo: null, url: null, logo_url: null }], { baixar: async () => assert.fail('não baixa') });
  assert.equal(r.codigo, 404);
});

test('fonte=drive: sem sessão não procura; com sessão, a pasta do cliente primeiro, guarda em memória e não grava', async () => {
  limparCacheDeLogos();
  let r = resposta();
  await logoDoCliente({ query: { c: '8', fonte: 'drive' } }, r, async () => assert.fail('sem sessão não lê o banco'));
  assert.equal(r.codigo, 404);
  const consultas = [], ids = [], pastas = [];
  const sql = async (p) => { consultas.push(p.join('?')); return [{ nome: 'DiaLab', arquivo: null, url: null, logo_url: null, pasta: 'https://drive.google.com/drive/folders/PASTAdoCLIENTE1' }]; };
  const opcoes = { comSessao: true, baixar: baixarPng(ids), naPasta: async (id) => { pastas.push(id); return [{ id: 'LOGOdaPASTA123', nota: 6 }]; }, procurar: async () => assert.fail('achou na pasta, não procura por nome') };
  r = resposta();
  await logoDoCliente({ query: { c: '8', fonte: 'drive' } }, r, sql, opcoes);
  assert.equal(r.codigo, 200);
  assert.deepEqual(pastas, ['PASTAdoCLIENTE1']);
  assert.deepEqual(ids, ['LOGOdaPASTA123']);
  assert.match(r.cab['Cache-Control'], /^private/);
  r = resposta();
  await logoDoCliente({ query: { c: '8', fonte: 'drive' } }, r, sql, opcoes);
  assert.deepEqual(pastas, ['PASTAdoCLIENTE1'], 'a segunda vez vem do cache');
  assert.ok(consultas.every((q) => !/UPDATE/.test(q)));
});

test('fonte=drive: sem pasta, a busca por nome com nota mínima 3', async () => {
  limparCacheDeLogos();
  const sql = async () => [{ nome: 'Hebravet', arquivo: null, url: null, logo_url: null, pasta: null }];
  let r = resposta();
  await logoDoCliente({ query: { c: '11', fonte: 'drive' } }, r, sql, { comSessao: true, baixar: async () => assert.fail('nota baixa não serve'), procurar: async () => [{ id: 'fraco', nota: 2 }] });
  assert.equal(r.codigo, 404);
  limparCacheDeLogos();
  const ids = [];
  r = resposta();
  await logoDoCliente({ query: { c: '11', fonte: 'drive' } }, r, sql, { comSessao: true, baixar: baixarPng(ids), procurar: async () => [{ id: 'BOMlogo12345', nota: 5 }] });
  assert.equal(r.codigo, 200);
  assert.deepEqual(ids, ['BOMlogo12345']);
});

test('avatar do Instagram: @ inválido ou perfil que não abre é 404; sessão é obrigatória', async () => {
  limparCacheDoFeed();
  let r = resposta();
  await areaFeedInstagram({ method: 'GET', query: { avatar: 'x' } }, r, null);
  assert.equal(r.codigo, 401);
  r = resposta();
  await areaFeedInstagram({ method: 'GET', query: { avatar: 'não é @' } }, r, { pessoa: { id: 1 } });
  assert.equal(r.codigo, 404);
  r = resposta();
  await areaFeedInstagram({ method: 'GET', query: { avatar: 'sumiu' } }, r, { pessoa: { id: 1 } }, { env: {}, buscar: async () => ({ ok: false, status: 404 }) });
  assert.equal(r.codigo, 404);
});

test('plano de gravação: preenche o @ vazio ou quebrado pelo cérebro, não troca @ válido diferente, propõe a logo achada', () => {
  const cerebro = [{ nome: 'Hellen Rocha Advocacia', apelidos: ['hellen'], instagram: '@hellenrochax' }, { nome: 'DiaLab', instagram: '@labdiacenter' }, { nome: 'Alpha1', instagram: '@alpha1consultoria_' }];
  assert.equal(dossieDoCliente('Hellen', cerebro).instagram, '@hellenrochax');
  const clientes = [
    { id: 1, nome: 'Hellen', ativo: true, cadastro: {} },
    { id: 2, nome: 'DiaLab', ativo: true, cadastro: { instagram: 'ver no drive' } },
    { id: 3, nome: 'Alpha1', ativo: true, cadastro: { instagram: '@alpha1' } },
    { id: 4, nome: 'Mangaba AI', ativo: true, cadastro: {} },
    { id: 5, nome: 'De Bull', ativo: false, cadastro: { instagram: '@errado' } },
  ];
  const p = planejarLogos(clientes, { cerebro, logosNoDrive: new Map([['4', { id: 'LOGOmangaba01', nome: 'logo mangaba.png' }]]) });
  assert.deepEqual(p.mudar.map((m) => [m.cliente, m.campo, m.hoje, m.novo]), [
    ['Hellen', 'instagram', '', '@hellenrochax'],
    ['DiaLab', 'instagram', 'ver no drive', '@labdiacenter'],
    ['Mangaba AI', 'logo_url', '', 'https://drive.google.com/file/d/LOGOmangaba01/view'],
  ]);
  assert.deepEqual(p.conferir.map((m) => m.cliente), ['Alpha1']);
  assert.ok(!JSON.stringify(p).includes('De Bull'), 'cliente inativo fica de fora');
  assert.deepEqual(p.sem, []);
});
