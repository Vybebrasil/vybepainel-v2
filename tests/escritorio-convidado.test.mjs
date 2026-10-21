// Convidado do Escritório (Paulo, 20/10/2026): link assinado, bonecos prontos,
// só a sala de quem convidou e as áreas comuns, voz só na sala de quem convidou.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { criarConvite, cancelarConvites, areaConvite, lerAssinado, nomeDoConvidado, ZONAS_DO_CONVIDADO } from '../server/escritorio-convite.js';
import { verificarEntrada, EscritorioRoom } from '../services/escritorio/worker.js';

const SEGREDO = 'segredo-exclusivo-de-teste-isolado-123456789';
const ENV = { ESCRITORIO_SESSION_SECRET: SEGREDO, ESCRITORIO_WORKER_URL: 'https://w.test' };

async function banco(t) {
  const { db, sql } = conexao();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id int primary key,nome text,ativo boolean,pode_entrar boolean);
    INSERT INTO vybe_pessoas VALUES(1,'Paulo Martins',true,true),(2,'Jady Amynne',true,true),(3,'Saiu da equipe',true,false);`);
  await db.exec(readFileSync('migrations/2026-10-15-escritorio.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-10-16-escritorio-mapa.sql', 'utf8'));
  return { db, sql };
}
// Resposta HTTP de mentira para chamar a rota pública.
function resposta() {
  const r = { status_: 200, corpo: null, cabecalhos: {} };
  r.setHeader = (k, v) => { r.cabecalhos[k.toLowerCase()] = v; };
  r.status = (s) => { r.status_ = s; return r; };
  r.json = (c) => { r.corpo = c; return r; };
  return r;
}
const pedir = async (sql, acao, corpo, cookie = '') => {
  const res = resposta();
  await areaConvite({ method: corpo ? 'POST' : 'GET', query: { acao }, body: corpo || {}, headers: { cookie } }, res, sql, ENV);
  return res;
};
const tokenDoLink = (link) => /#convite=(.+)$/.exec(link)[1];

test('link assinado abre, entra com um dos bonecos e o crachá vale só para as zonas do convite', async (t) => {
  const { sql } = await banco(t);
  const { link } = await criarConvite(sql, { id: 1 }, 'https://vybepainel-v2.vercel.app', ENV);
  assert.match(link, /^https:\/\/vybepainel-v2\.vercel\.app\/#convite=/);
  const token = tokenDoLink(link);
  const aberto = await pedir(sql, 'abrir', { token });
  assert.equal(aberto.status_, 200);
  assert.equal(aberto.corpo.anfitriao.nome, 'Paulo Martins');
  assert.equal(aberto.corpo.bonecos.length, 4);
  // Nome com marcação e boneco que não existe são recusados.
  assert.equal((await pedir(sql, 'entrar', { token, nome: 'a', boneco: 0 })).status_, 400);
  assert.equal((await pedir(sql, 'entrar', { token, nome: 'Cliente', boneco: 9 })).status_, 400);
  const entrou = await pedir(sql, 'entrar', { token, nome: 'Ana <b>Cliente</b>', boneco: 2 });
  assert.equal(entrou.status_, 200);
  const base = entrou.corpo;
  assert.equal(base.convidado.nome, 'Ana bCliente/b');
  assert.equal(base.admin, false);
  assert.ok(!base.convidado.zonas.includes('operacao'), 'o Centro de Operação fica de fora');
  for (const z of ZONAS_DO_CONVIDADO) assert.ok(base.convidado.zonas.includes(z));
  assert.ok(base.convidado.zonas.every((z) => !z.startsWith('sala-') || z.replace(/-andar-1$/, '') === base.convidado.salaAnfitriao), 'nenhum quarto de outra pessoa');
  // Voz em todas as salas do convite, menos no Foco; nunca na conversa única.
  assert.deepEqual(base.convidado.vozes, base.convidado.zonas.filter((z) => z !== 'foco'));
  // Só a sala de quem convidou leva a planta; dos outros, só o boneco.
  assert.equal(base.equipe.find((p) => p.id === '2').perfil.sala_planta, 'quadrado-m');
  const cookie = entrou.cabecalhos['set-cookie'].split(';')[0];
  assert.match(entrou.cabecalhos['set-cookie'], /HttpOnly/);
  // O crachá do Worker é de convidado e passa na verificação.
  const c = await verificarEntrada(base.token, SEGREDO);
  assert.equal(c.convidado, true);
  assert.equal(c.anfitriao, '1');
  assert.match(c.sub, /^c-[a-f0-9]{12}$/);
  // Recarregar a página: o cookie traz a entrada de volta.
  assert.equal((await pedir(sql, 'entrada', null, cookie)).corpo.convidado.id, base.convidado.id);
  // A conversa única dos espaços abertos, o Foco e o Centro de Operação são recusados.
  for (const sala of ['escritorio', 'foco', 'operacao', 'sala-3']) assert.equal((await pedir(sql, 'chamada', { sala }, cookie)).status_, 403, sala);
});

test('cancelar convites derruba o link e quem entrou por ele; quem saiu da equipe não convida', async (t) => {
  const { sql } = await banco(t);
  const token = tokenDoLink((await criarConvite(sql, { id: 1 }, 'https://vybepainel-v2.vercel.app', ENV)).link);
  const entrou = await pedir(sql, 'entrar', { token, nome: 'Bruno', boneco: 0 });
  const cookie = entrou.cabecalhos['set-cookie'].split(';')[0];
  await cancelarConvites(sql, { id: 1 });
  assert.equal((await pedir(sql, 'abrir', { token })).status_, 410);
  assert.equal((await pedir(sql, 'entrada', null, cookie)).status_, 401);
  const deFora = tokenDoLink((await criarConvite(sql, { id: 3 }, 'https://vybepainel-v2.vercel.app', ENV)).link);
  assert.equal((await pedir(sql, 'abrir', { token: deFora })).status_, 410);
  // Link adulterado ou vencido não abre.
  assert.equal(lerAssinado(token.slice(0, -2) + 'xx', SEGREDO, 'vybe-convite'), null);
  assert.equal(lerAssinado(token, SEGREDO, 'vybe-convite', Date.now() + 13 * 3600e3), null);
  assert.throws(() => nomeDoConvidado('  '), /nome/);
});

test('Worker: convidado não entra no Centro de Operação nem em quarto alheio, nem em sala trancada', async () => {
  const sockets = [];
  const room = new EscritorioRoom({ getWebSockets: () => sockets }, { ESCRITORIO_SESSION_SECRET: SEGREDO });
  const sock = (a) => {
    const s = { a: { nome: 'X', sala: 'convivencia', zona: '', x: 50, y: 50, status: 'disponivel', last: 0, exp: Math.floor(Date.now() / 1000) + 300, ...a },
      msgs: [], deserializeAttachment() { return this.a; }, serializeAttachment(v) { this.a = v; }, send(m) { this.msgs.push(JSON.parse(m)); } };
    sockets.push(s); return s;
  };
  const ev = async (s, type, payload) => { s.a.last = 0; s.a.lastMov = 0; await room.webSocketMessage(s, JSON.stringify({ type, payload })); };
  const zonas = ['sala-0', 'sala-0-andar-1', ...ZONAS_DO_CONVIDADO];
  const paulo = sock({ sub: '1', zona: 'sala-0', minhaSala: 'sala-0' });
  const equipe = sock({ sub: '2', zona: 'operacao' });
  const convidado = sock({ sub: 'c-0123456789ab', convidado: true, anfitriao: '1', salaAnfitriao: 'sala-0', zonas });
  await ev(convidado, 'presence:move', { sala: 'convivencia', zona: 'operacao', x: 40, y: 40 });
  assert.equal(convidado.a.zona, '', 'Centro de Operação fica fechado');
  await ev(convidado, 'presence:move', { sala: 'convivencia', zona: 'sala-3', x: 40, y: 40 });
  assert.equal(convidado.a.zona, '', 'quarto de outra pessoa fica fechado');
  await ev(convidado, 'presence:move', { sala: 'convivencia', zona: 'cafe', x: 40, y: 40 });
  assert.equal(convidado.a.zona, 'cafe');
  assert.ok(!room.trancas.has('cafe'), 'área comum não tranca');
  // Sala trancada em que não estava: fica de fora.
  await ev(paulo, 'zone:lock', { zona: 'sala-0', trancada: true });
  await ev(convidado, 'presence:move', { sala: 'convivencia', zona: 'sala-0', x: 40, y: 40 });
  assert.equal(convidado.a.zona, 'cafe');
  await ev(paulo, 'zone:admit', { zona: 'sala-0', id: '2' });
  await ev(paulo, 'zone:lock', { zona: 'sala-0', trancada: false });
  await ev(convidado, 'presence:move', { sala: 'convivencia', zona: 'sala-0', x: 40, y: 40 });
  assert.equal(convidado.a.zona, 'sala-0');
  assert.ok(!room.trancas.has('sala-0'), 'a sala não tranca sozinha: a conversa própria vem do navegador');
  // Não tranca, não admite, não mexe em móvel nem na música.
  await ev(convidado, 'zone:lock', { zona: 'sala-0', trancada: true });
  assert.ok(!room.trancas.has('sala-0'));
  await ev(convidado, 'furni:toggle', { chave: 'lamp@1,1', estado: 1 });
  assert.equal(room.moveis.size, 0);
  // Balão da equipe em outra sala não chega ao convidado.
  convidado.msgs.length = 0;
  await ev(equipe, 'chat:bubble', { texto: 'assunto interno' });
  assert.ok(!convidado.msgs.some((m) => m.type === 'chat:bubble'));
  await ev(paulo, 'chat:bubble', { texto: 'oi, seja bem-vindo' });
  assert.ok(convidado.msgs.some((m) => m.type === 'chat:bubble' && m.payload.texto === 'oi, seja bem-vindo'));
  // A presença marca quem é convidado (e de quem).
  const lista = paulo.msgs.filter((m) => m.type === 'presence:update').at(-1).payload;
  assert.deepEqual(lista.find((p) => p.id === 'c-0123456789ab').anfitriao, '1');
});

test('Worker recusa crachá de convidado com zona inventada ou com poder de administrar', async () => {
  const { createHmac } = await import('node:crypto');
  const assinar = (d) => { const c = Buffer.from(JSON.stringify(d)).toString('base64url'); return c + '.' + createHmac('sha256', SEGREDO).update(c).digest('base64url'); };
  const agora = Math.floor(Date.now() / 1000);
  const base = { sub: 'c-0123456789ab', nome: 'Ana', convidado: true, anfitriao: '1', salaAnfitriao: 'sala-0', zonas: ['sala-0', 'cafe'], aud: 'vybe-escritorio', iat: agora, exp: agora + 300 };
  assert.ok(await verificarEntrada(assinar(base), SEGREDO));
  assert.equal(await verificarEntrada(assinar({ ...base, zonas: ['<x>'] }), SEGREDO), null);
  assert.equal(await verificarEntrada(assinar({ ...base, admin: true }), SEGREDO), null);
  assert.equal(await verificarEntrada(assinar({ ...base, sub: '7' , convidado: true }), SEGREDO), null);
});
