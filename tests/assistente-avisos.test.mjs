import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { identificarParticipantes, avisosDeStatus } from '../server/assistente-avisos.js';
import { atenderBotAssistente } from '../server/assistente-servico.js';
import { identificadorProtegido } from '../server/assistente-identidade.js';

const PROD = 7829537690, segredo = 's'.repeat(40);
const agora = new Date('2026-10-26T15:00:00Z');
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,monday_user_id text,ativo boolean,pode_entrar boolean,senha_hash text,admin boolean);
    CREATE TABLE vybe_ai_vinculos(id bigserial,pessoa_id bigint,jid_hash char(64) UNIQUE,criado_em timestamptz DEFAULT NOW(),revogado_em timestamptz);
    CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,prazo date,veiculacao date,removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int);
    CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int);
    CREATE TABLE vybe_conteudo_eventos(id bigserial PRIMARY KEY,conteudo_id bigint,tipo text,de text,para text,autor_id bigint,em timestamptz);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins','68035537',true,true,'x',true),(2,'Deivid Souza','68997024',true,true,'x',false),
      (3,'Jady Amynne Oliveira Lima','100482777',true,true,'x',false),(4,'Tainara Lima','80146924',true,true,'x',false),
      (5,'Vinícius Damascena','68035653',true,true,'x',false),(6,'Ewerton Lima','68036687',true,true,'x',false),(7,'Inativo','1',false,true,'x',false);
    INSERT INTO vybe_clientes VALUES (10,'Cliente A'),(11,'Cliente B');
    INSERT INTO vybe_cliente_pessoas VALUES (10,5,0),(11,6,0);
    INSERT INTO vybe_conteudos VALUES (100,${PROD},'Card - Promo','Card','2026-10-26','2026-10-28',NULL),(101,${PROD},'Reels - Bastidor','Reels','2026-10-26','2026-10-29',NULL),
      (102,${PROD},'Story - Agenda','Story',NULL,'2026-10-27',NULL),(103,${PROD},'Carrossel - Dicas','Carrossel','2026-10-25','2026-10-30',NULL),
      (104,${PROD},'Reels - Sem head','Reels','2026-10-26',NULL,NULL),(105,${PROD},'Removido','Card','2026-10-26',NULL,'2026-10-01');
    INSERT INTO vybe_conteudo_clientes VALUES (100,10),(101,11),(102,10),(103,10),(104,99),(105,10);
    INSERT INTO vybe_conteudo_responsaveis VALUES (100,3,0),(101,3,0),(102,3,0),(103,3,0),(104,3,0);
    INSERT INTO vybe_conteudo_eventos(conteudo_id,tipo,de,para,em) VALUES
      (100,'status','Pode Fazer','Para aprovação','2026-10-26T14:50:00Z'),(101,'status','Em andamento','Em aprovação','2026-10-26T14:51:00Z'),
      (102,'status','Finalizado','Para agendar','2026-10-26T14:52:00Z'),(103,'status','Para aprovação','Alteração','2026-10-26T14:53:00Z'),
      (104,'status','Em andamento','Para aprovação','2026-10-26T14:54:00Z'),(105,'status','Pode Fazer','Para aprovação','2026-10-26T14:55:00Z'),
      (100,'status','Para aprovação','Finalizado','2026-10-26T14:56:00Z'),(100,'grupo','Design','Edição','2026-10-26T14:57:00Z'),
      (100,'status','Pode Fazer','Para aprovação','2026-10-26T13:00:00Z');`);
  return { db, sql };
}

test('identificar: só pessoas ativas vinculadas, devolvendo o JID consultado', async () => {
  const { db, sql } = await banco();
  try {
    const jady = '3333333333@lid', inativo = '7777777777@lid', estranho = '9999999999@lid';
    await sql`INSERT INTO vybe_ai_vinculos(pessoa_id,jid_hash) VALUES (3,${identificadorProtegido(jady, segredo)}),(7,${identificadorProtegido(inativo, segredo)})`;
    const r = await identificarParticipantes(sql, [jady, inativo, estranho], segredo);
    assert.deepEqual(r, [{ jid: jady, pessoa_id: '3', monday_id: '100482777', nome: 'Jady Amynne Oliveira Lima' }]);
    await assert.rejects(() => identificarParticipantes(sql, ['abc'], segredo), TypeError);
    await assert.rejects(() => identificarParticipantes(sql, [], segredo), TypeError);
  } finally { await db.close(); }
});

test('avisos: aprovação de design → Deivid; vídeo → dono do cliente; agendar → Tainara; alteração → responsável', async () => {
  const { db, sql } = await banco();
  try {
    const avisos = await avisosDeStatus(sql, { desde: '2026-10-26T14:00:00Z' }, agora);
    const por = Object.fromEntries(avisos.map((a) => [a.conteudo_id + ':' + a.status, a]));
    assert.equal(avisos.length, 5); // removido, Finalizado, mudança de grupo e evento antigo ficam fora
    const card = por['100:Para aprovação'];
    assert.equal(card.grupo, 'criacao'); assert.deepEqual(card.pessoas.map((p) => p.monday_id), ['68997024']);
    assert.match(card.texto, /^🔎 \*Para aprovação\* · Card - Promo \(Cliente A\)\n👤 Jady · ⏰ prazo 26\/10 · 📅 cliente 28\/10\n👉 \{\{pessoa:68997024:Deivid\}\}, pode aprovar\? 🙏$/);
    const reels = por['101:Em aprovação'];
    assert.equal(reels.grupo, 'atendimento'); assert.deepEqual(reels.pessoas.map((p) => p.monday_id), ['68036687']); // head do Cliente B = Ewerton
    const semHead = por['104:Para aprovação'];
    assert.deepEqual(semHead.pessoas.map((p) => p.monday_id).sort(), ['68035653', '68036687']); // sem head: Vinícius e Ewerton
    const agendar = por['102:Para agendar'];
    assert.equal(agendar.grupo, 'publicacoes'); assert.deepEqual(agendar.pessoas.map((p) => p.monday_id), ['80146924']);
    assert.match(agendar.texto, /veicula 27\/10\n👉 \{\{pessoa:80146924:Tainara\}\}, pode agendar\?/);
    const alt = por['103:Alteração'];
    assert.equal(alt.grupo, 'correcao'); assert.deepEqual(alt.pessoas.map((p) => p.monday_id), ['100482777']);
  } finally { await db.close(); }
});

test('avisos: janela máxima de 6h e período válido', async () => {
  for (const desde of ['ontem', '2026-10-26T08:00:00Z', '2026-10-26T16:00:00Z', undefined])
    await assert.rejects(() => avisosDeStatus(() => { throw Error('não consultar'); }, { desde }, agora), TypeError);
});

test('endpoint: identificar e avisos só para administração no privado', async () => {
  const { db, sql } = await banco();
  const grupo = '123456789-123@g.us', admin = '1111111111@lid', jady = '3333333333@lid';
  const config = { VYBE_AI_ATIVA: '1', VYBE_AI_BOT_TOKEN: 'A'.repeat(64), VYBE_AI_LINK_SECRET: segredo, VYBE_AI_GRUPOS_IDS: grupo, VYBE_AI_ESCOPO: 'equipe' };
  try {
    await sql`INSERT INTO vybe_ai_vinculos(pessoa_id,jid_hash) VALUES (1,${identificadorProtegido(admin, segredo)}),(3,${identificadorProtegido(jady, segredo)})`;
    const chamar = async (jid, corpo) => {
      const res = { status(n) { this.codigo = n; return this; }, json(d) { this.dados = d; return this; } };
      await atenderBotAssistente({ method: 'POST', headers: { authorization: 'Bearer ' + config.VYBE_AI_BOT_TOKEN },
        body: { jid, contexto: { tipo: 'privado', participantes: [jid], grupos_remetente: [grupo], observado_em: Date.now() }, ...corpo } }, res, () => sql, config);
      return res;
    };
    const ident = await chamar(admin, { consulta: 'identificar', participantes: [admin, jady] });
    assert.equal(ident.codigo, 200); assert.equal(ident.dados.pessoas.length, 2);
    assert.equal((await chamar(jady, { consulta: 'identificar', participantes: [jady] })).codigo, 403);
    const recente = new Date(Date.now() - 3600e3).toISOString();
    const av = await chamar(admin, { consulta: 'avisos', desde: recente });
    assert.equal(av.codigo, 200); assert.ok(Array.isArray(av.dados.avisos));
    assert.equal((await chamar(admin, { consulta: 'avisos', desde: 'x' })).codigo, 400);
  } finally { await db.close(); }
});
