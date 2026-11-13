// "PRONTA = SÓ FINALIZADO" no servidor (Paulo, 13/11/2026). O catálogo vybe_status.final do Monday marca "Para agendar"
// e "Agendado" como concluídos; o dado fica, e o critério de server/pronta.js decide: Para agendar/Agendado não são
// entrega. Com a veiculação vencida e sem sair, contam como atrasadas; com a veiculação futura, não são cobrança.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { ehPronta, aguardaPostar, aguardaPostarVencida, chaveDoStatus, prontaSql } from '../server/pronta.js';

const PROD = 7829537690, hoje = '2026-11-13';

test('critério: final e não é Para agendar/Agendado; chave ou rótulo', () => {
  assert.equal(chaveDoStatus('Para agendar'), 'para_agendar');
  for (const s of ['Finalizado', 'finalizado', 'Publicado', 'postado', 'Feito', 'Concluído']) assert.equal(ehPronta(s, true), true, s);
  for (const s of ['Para agendar', 'para_agendar', 'Agendado', 'agendado']) {
    assert.equal(ehPronta(s, true), false, s + ' com final=true do Monday não é pronta');
    assert.equal(aguardaPostar(s), true);
  }
  assert.equal(ehPronta('Finalizado', false), false, 'sem final no catálogo não é pronta');
  assert.equal(aguardaPostarVencida('Agendado', '2026-11-12', hoje), true, 'veiculação passou: atrasada');
  assert.equal(aguardaPostarVencida('Agendado', hoje, hoje), false, 'veicula hoje: ainda pode sair');
  assert.equal(aguardaPostarVencida('Agendado', '2026-11-20', hoje), false, 'futura: não cobra');
  assert.equal(aguardaPostarVencida('Agendado', null, hoje), false, 'sem data não cobra');
  assert.equal(aguardaPostarVencida('Finalizado', '2026-11-01', hoje), false);
});

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean,nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,disciplina text,ativo boolean,pode_entrar boolean);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,prazo date,veiculacao date,removido_em timestamptz,
      status_chave text,monday_item_id bigint,briefing text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);
    CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,em timestamptz,de text,para text);
    -- Como no banco real: o Monday marcou Para agendar e Agendado como final.
    INSERT INTO vybe_status VALUES (${PROD},'em_producao','Em produção',false),(${PROD},'finalizado','Finalizado',true),
      (${PROD},'para_agendar','Para agendar',true),(${PROD},'agendado','Agendado',true);
    INSERT INTO vybe_clientes VALUES (10,'Gonzalez',true);
    INSERT INTO vybe_pessoas VALUES (1,'Jady Lima','design',true,true);
    INSERT INTO vybe_conteudos VALUES
      (1,${PROD},'Agendado vencido','Card','2026-11-05','2026-11-10',NULL,'agendado',NULL,'b'),
      (2,${PROD},'Agendado futuro','Card','2026-11-05','2026-11-20',NULL,'agendado',NULL,'b'),
      (3,${PROD},'Para agendar futuro','Card','2026-11-01','2026-11-25',NULL,'para_agendar',NULL,'b'),
      (4,${PROD},'Finalizado','Card','2026-11-05','2026-11-08',NULL,'finalizado',NULL,'b'),
      (5,${PROD},'Em produção vencida','Card','2026-11-05','2026-11-30',NULL,'em_producao',NULL,'b');
    INSERT INTO vybe_conteudo_clientes VALUES (1,10),(2,10),(3,10),(4,10),(5,10);
    INSERT INTO vybe_conteudo_responsaveis VALUES (1,1),(2,1),(3,1),(4,1),(5,1);`);
  return { db, sql };
}

test('trecho SQL: só o Finalizado é pronta, mesmo com final=true em Para agendar/Agendado', async () => {
  const { db, sql } = await banco();
  try {
    const r = await sql.query(`SELECT c.titulo FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id=c.board_id AND s.chave=c.status_chave
      WHERE ${prontaSql('c', 's')} ORDER BY c.id`);
    assert.deepEqual(r.map((x) => x.titulo), ['Finalizado']);
  } finally { await db.close(); }
});

test('alertas do cliente: Agendado com veiculação passada atrasa; Agendado/Para agendar futuros não cobram; Finalizado sai', async () => {
  const { db, sql } = await banco();
  try {
    const { alertasDosClientes } = await import('../server/alertas-clientes.js');
    const a = (await alertasDosClientes(sql, { agora: new Date(hoje + 'T15:00:00Z') })).get('10');
    assert.deepEqual(a.atrasadas.map((x) => x.titulo).sort(), ['Agendado vencido', 'Em produção vencida']);
    const todos = [...a.atrasadas, ...a.sem_info, ...a.aprovar].map((x) => x.titulo);
    for (const fora of ['Agendado futuro', 'Para agendar futuro', 'Finalizado']) assert.equal(todos.includes(fora), false, fora);
  } finally { await db.close(); }
});

test('saúde: Agendado vencido é atraso, não entrega; Finalizado entrega; futuros não pesam', async () => {
  const { db, sql } = await banco();
  try {
    const { saudeDosClientes } = await import('../server/assistente-saude.js');
    const [c] = (await saudeDosClientes(sql, hoje)).clientes;
    assert.equal(c.atrasadas, 2, 'Agendado vencido + Em produção com prazo vencido (Agendado futuro com prazo vencido não)');
    assert.equal(c.entregues30, 1, 'só o Finalizado; Agendado vencido não conta como entregue');
  } finally { await db.close(); }
});

test('retrato do dia: Agendado vencido entra nas atrasadas; Agendado de hoje "vai sair"; Finalizado entregue', async () => {
  const { mensagemMeuDia, mensagemMeioDia } = await import('../server/assistente-rotinas.js');
  const item = (id, nome, status, extra = {}) => ({ id, nome, status, responsavel: 'Jady Lima', responsavel_ids: ['1'], clientes: ['Cli'],
    origem: 'producao_conteudo', prazo_iso: '2026-11-05', veiculacao_iso: hoje, ...extra });
  const itens = [
    item('1', 'Agendado vencido', 'Agendado', { veiculacao_iso: '2026-11-10' }),
    item('2', 'Agendado futuro', 'Agendado', { veiculacao_iso: '2026-11-20' }),
    item('3', 'Para agendar futuro', 'Para agendar', { veiculacao_iso: '2026-11-25' }),
    item('4', 'Agendado de hoje', 'Agendado'),
    item('5', 'Finalizado de hoje', 'Finalizado'),
  ];
  const meu = mensagemMeuDia(itens, hoje, (i) => i.status, 'Sex 13/11', { nome: 'Jady Lima', monday_id: '1' });
  assert.match(meu, /🔴 1 atrasada\(s\)/);
  assert.match(meu, /\*🔴 Atrasadas \(1\)\*\n- Agendado vencido \(Cli\) · Agendado · veiculação 10\/11, não saiu/);
  assert.doesNotMatch(meu, /Agendado futuro|Para agendar futuro/);
  const meio = mensagemMeioDia(itens, hoje, (i) => i.status, 'Sex 13/11');
  assert.match(meio, /Conteúdos que veiculam hoje: 2 · ✅ 2 entregues/, 'Agendado de hoje vai sair; Finalizado saiu');
  assert.match(meio, /⚠️ 1 atividades com prazo vencido/);
});

test('itens do dia: Agendado com veiculação vencida antiga entra no recorte (para cobrar); Finalizado antigo não', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN etapa text, ADD COLUMN status_em timestamptz;
      INSERT INTO vybe_conteudos(id,board_id,titulo,prazo,veiculacao,status_chave) VALUES
       (6,${PROD},'Agendado de outubro','2026-10-01','2026-10-02','agendado'),(7,${PROD},'Finalizado de outubro','2026-10-01','2026-10-02','finalizado');
      ALTER TABLE vybe_pessoas ADD COLUMN monday_user_id text; ALTER TABLE vybe_conteudo_responsaveis ADD COLUMN ordem int DEFAULT 0;`);
    const { itensDoDia } = await import('../server/assistente-rotinas.js');
    const nomes = (await itensDoDia(sql, hoje)).map((i) => i.nome);
    assert.equal(nomes.includes('Agendado de outubro'), true);
    assert.equal(nomes.includes('Finalizado de outubro'), false);
  } finally { await db.close(); }
});
