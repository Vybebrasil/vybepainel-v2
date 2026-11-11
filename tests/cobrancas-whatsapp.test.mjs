import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { pedirCobranca, cobrancasDoDia, cobrancasParaEnviar, registrarResultado, textoDaCobranca, setorDaCobranca, areaCobrancas } from '../server/cobrancas-whatsapp.js';

// Cobrança pelo WhatsApp (Paulo, 10/11/2026): o Deivid clica em Cobrar, o pedido fica guardado, o VYBES busca, manda
// pelo agente dono da cobrança e devolve "enviado" ou "falhou". Aqui nada é enviado: é só o lado do Vybe OS.
const PROD = 7829537690;
const DEIVID = { id: 1, nome: 'Deivid Souza', dono: true }, JADY_M = '100482777', RERISTON_M = '68036697', BIA_M = '71130408';
const agora = Date.parse('2026-11-10T15:00:00Z');
const opcoes = { agora, env: {}, doAudiovisual: new Set([RERISTON_M]), link: (ref) => 'https://painel.teste/?atividade=' + ref };
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean,monday_user_id bigint);
    INSERT INTO vybe_pessoas VALUES(1,'Deivid Souza',true,68997024),(2,'Jady Lima',true,${JADY_M}),(3,'Reriston Alves',true,${RERISTON_M}),(4,'Beatriz Antiga',false,${BIA_M}),(5,'Tainara Head',true,555);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id bigint,titulo text,board_id bigint,removido_em timestamptz);
    INSERT INTO vybe_conteudos VALUES(10,9001,'Card - Agenda Musical',${PROD},NULL),(11,NULL,'Reels - Bastidores',${PROD},NULL),(12,9003,'Apagada',${PROD},NOW()),(13,9004,'De outro quadro',123,NULL);
    CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);INSERT INTO vybe_clientes VALUES(8,'VOA');
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);INSERT INTO vybe_conteudo_clientes VALUES(10,8),(11,8);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);
    INSERT INTO vybe_conteudo_responsaveis VALUES(10,2),(10,1),(10,4),(11,3),(11,2);`);
  return { db, sql };
}
const pedido = { item: '9001', para: [JADY_M], oque: 'mandar a prévia', quando: 'hoje até as 14h', por: 'parada há 4 dias em Em andamento · vai ao ar 12/11' };

test('o texto diz a peça, o motivo, o pedido e quem pediu; o agente vem da disciplina de quem é cobrado', () => {
  const t = textoDaCobranca({ nome: 'Jady Lima', titulo: 'Card', cliente: 'VOA', por: 'parada há 4 dias', oque: 'mandar a prévia', quando: 'agora', pedidoPor: 'Deivid Souza', link: 'https://x/?atividade=1' });
  assert.equal(t, 'Jady, sobre "Card" (VOA): parada há 4 dias.\n\nConsegue mandar a prévia agora?\n\n_Cobrança pedida por Deivid no Vybe OS._\n🔗 https://x/?atividade=1');
  const av = new Set([RERISTON_M]);
  assert.equal(setorDaCobranca(RERISTON_M, av), 'edicao'); assert.equal(setorDaCobranca(JADY_M, av), 'design'); assert.equal(setorDaCobranca(null, av), 'design');
});

test('pedir: só dono; só quem é responsável ativo da peça entra; quem pede não cobra a si mesmo', async () => {
  const { sql } = await banco();
  await assert.rejects(() => pedirCobranca(sql, { id: 5, nome: 'Tainara Head' }, pedido, opcoes), (e) => e.status === 403 && /donos/.test(e.message));
  const r = await pedirCobranca(sql, DEIVID, pedido, opcoes);
  assert.equal(r.cobrancas.length, 1);
  const c = r.cobrancas[0];
  assert.equal(c.pessoa, 'Jady Lima'); assert.equal(c.setor, 'design'); assert.equal(c.agente, 'Danilo'); assert.equal(c.estado, 'pedido'); assert.equal(c.ref, '9001'); assert.equal(c.repetida, false);
  assert.match(c.texto, /^Jady, sobre "Card - Agenda Musical" \(VOA\): parada há 4 dias/);
  assert.match(c.texto, /Consegue mandar a prévia hoje até as 14h\?/); assert.match(c.texto, /pedida por Deivid no Vybe OS/); assert.match(c.texto, /atividade=9001/);
  // Quem não é responsável da peça, quem está inativo e quem pede ficam de fora, mesmo vindo na lista.
  await assert.rejects(() => pedirCobranca(sql, DEIVID, { ...pedido, para: [RERISTON_M] }, opcoes), (e) => e.status === 409);
  await assert.rejects(() => pedirCobranca(sql, DEIVID, { ...pedido, para: [BIA_M] }, opcoes), (e) => e.status === 409, 'pessoa inativa não é cobrada');
  await assert.rejects(() => pedirCobranca(sql, DEIVID, { ...pedido, para: ['68997024'] }, opcoes), (e) => e.status === 409, 'ninguém cobra a si mesmo');
  // Peça que não existe, apagada ou de outro quadro; pedido sem o quê ou sem para quem.
  for (const item of ['7777', '9003', '9004']) await assert.rejects(() => pedirCobranca(sql, DEIVID, { ...pedido, item }, opcoes), (e) => e.status === 404);
  await assert.rejects(() => pedirCobranca(sql, DEIVID, { ...pedido, oque: '' }, opcoes), (e) => e.status === 400);
  await assert.rejects(() => pedirCobranca(sql, DEIVID, { ...pedido, para: ['jady@c.us'] }, opcoes), (e) => e.status === 400, 'destino nunca é um contato: só id de pessoa do time');
  // Peça só do painel (vybe:N) e duas pessoas: cada uma com o seu agente.
  const dois = await pedirCobranca(sql, DEIVID, { ...pedido, item: 'vybe:11', para: [JADY_M, RERISTON_M] }, opcoes);
  assert.deepEqual(dois.cobrancas.map((x) => [x.pessoa, x.agente, x.ref]).sort(), [['Jady Lima', 'Danilo', 'vybe:11'], ['Reriston Alves', 'Lucas', 'vybe:11']]);
});

test('uma cobrança por pessoa, por peça, por dia: clicar de novo não duplica; a que falhou pode ser pedida de novo', async () => {
  const { sql } = await banco();
  const [a] = (await pedirCobranca(sql, DEIVID, pedido, opcoes)).cobrancas;
  const [b] = (await pedirCobranca(sql, DEIVID, pedido, opcoes)).cobrancas;
  assert.equal(b.id, a.id); assert.equal(b.repetida, true);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_cobrancas_whatsapp`)[0].n, 1);
  // O bot pega (vira "enviando") e a segunda busca vem vazia: nada sai em dobro.
  const fila = await cobrancasParaEnviar(sql, { agora });
  assert.deepEqual(fila.map((x) => [x.id, x.pessoa_id, x.setor, x.pedido_por]), [[a.id, 2, 'design', 'Deivid Souza']]);
  assert.equal(fila[0].texto, a.texto);
  assert.deepEqual(await cobrancasParaEnviar(sql, { agora }), []);
  assert.equal((await pedirCobranca(sql, DEIVID, pedido, opcoes)).cobrancas[0].estado, 'enviando', 'a caminho: clicar de novo não pede outra');
  // Falhou: o painel mostra o motivo e deixa pedir de novo.
  assert.deepEqual(await registrarResultado(sql, { id: a.id, estado: 'falhou', motivo: 'Jady não está vinculada ao VYBES no WhatsApp.' }, { agora }), { registrado: true });
  assert.deepEqual(await registrarResultado(sql, { id: a.id, estado: 'enviado' }, { agora }), { registrado: false }, 'resultado só vale para o que está "enviando"');
  let [v] = (await cobrancasDoDia(sql, DEIVID, opcoes)).cobrancas;
  assert.equal(v.estado, 'falhou'); assert.match(v.motivo, /não está vinculada/);
  const [de_novo] = (await pedirCobranca(sql, DEIVID, pedido, opcoes)).cobrancas;
  assert.equal(de_novo.id, a.id); assert.equal(de_novo.estado, 'pedido'); assert.equal(de_novo.repetida, false);
  await cobrancasParaEnviar(sql, { agora });
  assert.deepEqual(await registrarResultado(sql, { id: a.id, estado: 'enviado' }, { agora: agora + 60e3 }), { registrado: true });
  [v] = (await cobrancasDoDia(sql, DEIVID, opcoes)).cobrancas;
  assert.equal(v.estado, 'enviado'); assert.equal(v.motivo, ''); assert.equal(v.resolvido_em, new Date(agora + 60e3).toISOString());
  assert.equal((await pedirCobranca(sql, DEIVID, pedido, opcoes)).cobrancas[0].estado, 'enviado', 'já foi hoje: não cobra a mesma pessoa de novo pela mesma peça');
  await assert.rejects(() => registrarResultado(sql, { id: a.id, estado: 'qualquer' }), /Resultado inválido/);
  await assert.rejects(() => cobrancasDoDia(sql, { id: 5 }, opcoes), (e) => e.status === 403);
});

test('bot fora do ar: pedido velho não sai mais e aparece como falha; "enviando" sem confirmação também', async () => {
  const { sql } = await banco();
  await pedirCobranca(sql, DEIVID, pedido, opcoes);
  const depois = agora + 13 * 3600e3;
  assert.deepEqual(await cobrancasParaEnviar(sql, { agora: depois }), [], 'cobrança de 13 horas atrás não é mandada');
  // (a lista do painel é a do dia; 13 h depois já é outro dia na Bahia, então confere na mesma data com 12 h e pouco)
  const { sql: s2 } = await banco();
  const cedo = Date.parse('2026-11-10T04:00:00Z');
  await pedirCobranca(s2, DEIVID, pedido, { ...opcoes, agora: cedo });
  const [v] = (await cobrancasDoDia(s2, DEIVID, { ...opcoes, agora: cedo + 12.5 * 3600e3 })).cobrancas;
  assert.equal(v.estado, 'falhou'); assert.match(v.motivo, /não pegou o pedido em 12 horas/);
  const { sql: s3 } = await banco();
  await pedirCobranca(s3, DEIVID, pedido, opcoes); await cobrancasParaEnviar(s3, { agora });
  const [w] = (await cobrancasDoDia(s3, DEIVID, { ...opcoes, agora: agora + 11 * 60e3 })).cobrancas;
  assert.equal(w.estado, 'falhou'); assert.match(w.motivo, /não confirmou o envio/);
  assert.equal((await pedirCobranca(s3, DEIVID, pedido, { ...opcoes, agora: agora + 11 * 60e3 })).cobrancas[0].estado, 'pedido', 'sem confirmação há 10 min: dá para pedir de novo');
});

test('area=cobrancas: sessão pessoal de dono; GET lista, POST pedir; o resto é recusado', async () => {
  const { sql } = await banco();
  const res = () => { const r = { codigo: 0, corpo: null, status(c) { r.codigo = c; return r; }, json(b) { r.corpo = b; return r; } }; return r; };
  let r = await areaCobrancas({ method: 'GET' }, res(), { tipo: 'servico' }, sql); assert.equal(r.codigo, 403);
  r = await areaCobrancas({ method: 'DELETE' }, res(), { tipo: 'sessao', pessoa: DEIVID }, sql); assert.equal(r.codigo, 405);
  r = await areaCobrancas({ method: 'POST', body: { acao: 'apagar' } }, res(), { tipo: 'sessao', pessoa: DEIVID }, sql); assert.equal(r.codigo, 400);
  r = await areaCobrancas({ method: 'GET' }, res(), { tipo: 'sessao', pessoa: { id: 5, nome: 'Tainara' } }, sql); assert.equal(r.codigo, 403);
  r = await areaCobrancas({ method: 'POST', body: { acao: 'pedir', ...pedido, item: '7777' } }, res(), { tipo: 'sessao', pessoa: DEIVID }, sql); assert.equal(r.codigo, 404);
  r = await areaCobrancas({ method: 'GET' }, res(), { tipo: 'sessao', pessoa: DEIVID }, sql); assert.deepEqual(r.corpo, { ok: true, cobrancas: [] });
});

test('ligado: área no painel, consultas do bot só para a administração no privado, e a tela pede o envio', () => {
  const painel = readFileSync('api/painel.js', 'utf8'), servico = readFileSync('server/assistente-servico.js', 'utf8'), tela = readFileSync('vybe-mundo-criacao.js', 'utf8');
  assert.match(painel, /cobrancas: \(req,res,quem\) => areaCobrancas\(req,res,quem,sql\(\)\)/);
  const lista = servico.split('\n').find((l) => l.includes("'pacote_avisado'") && l.includes('includes(consulta)'));
  assert.match(lista, /'cobrancas', 'cobranca_resultado'/, 'as consultas do bot ficam na lista da administração (só no privado)');
  assert.match(servico, /consulta === 'cobrancas'\) return res\.status\(200\)\.json\(\{ ok: true, cobrancas: await cobrancasParaEnviar\(banco\) \}\)/);
  assert.match(servico, /consulta === 'cobranca_resultado'/);
  assert.match(tela, /body: JSON\.stringify\(\{ acao: 'pedir', item: String\(item\.id\), para: c\.para, oque: c\.oque, quando: c\.quando, por: c\.por \}\)/);
  assert.doesNotMatch(tela, /a mensagem vai copiada para você mandar/);
});
