import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { saudeDosClientes, sugerirResponsavel } from '../server/assistente-saude.js';

const PROD = 7829537690;
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean);
    CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,disciplina text,ativo boolean,pode_entrar boolean);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,prazo date,veiculacao date,removido_em timestamptz,status_chave text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);
    CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,em timestamptz,de text,para text);
    INSERT INTO vybe_clientes VALUES (10,'Gonzalez',true),(11,'Hebravet',true);
    INSERT INTO vybe_pessoas VALUES (1,'Jady Amynne','design',true,true),(2,'Deivid Souza','design',true,true);
    INSERT INTO vybe_status VALUES (${PROD},'ab','Em produção',false),(${PROD},'ok','Publicado',true);
    INSERT INTO vybe_conteudos VALUES
     (1,${PROD},'Reels - A','Reels','2026-10-20','2026-10-21',NULL,'ab'),
     (2,${PROD},'Card - B','Card','2026-10-10','2026-10-12',NULL,'ok'),
     (3,${PROD},'Card - C','Card','2026-10-28','2026-11-02',NULL,'ab'),
     (4,${PROD},'Card - D','Card','2026-10-05','2026-10-06',NULL,'ok'),
     (5,${PROD},'Card - E','Card','2026-10-01','2026-10-02',NULL,'ok');
    INSERT INTO vybe_conteudo_clientes VALUES (1,10),(2,11),(3,11),(4,11),(5,11);
    INSERT INTO vybe_conteudo_responsaveis VALUES (2,1),(4,1),(5,2),(3,2),(1,1);
    INSERT INTO vybe_conteudo_eventos VALUES (1,'status','2026-10-22','Em produção','Alteração'),(1,'status','2026-10-23','Em produção','Alteração'),(1,'status','2026-10-24','Em produção','Alteração');`);
  return sql;
}

test('saúde: atraso, alterações e calendário vazio levantam o alerta', async () => {
  const r = await saudeDosClientes(await banco(), '2026-10-27');
  assert.match(r.texto, /Pedem atenção \(1\)/);
  assert.match(r.texto, /\*Gonzalez\*: 1 atrasada\(s\) · 3 voltas para alteração em 30 dias · nada para veicular nos próximos 14 dias/);
  assert.match(r.texto, /Em dia: 1 cliente/);
});

test('quem pega: experiência no formato menos a carga dos próximos 3 dias', async () => {
  const r = await sugerirResponsavel(await banco(), { formato: 'Card', dia: '2026-10-27' });
  assert.deepEqual(r.itens.map((p) => [p.nome, p.experiencia, p.carga]), [['Jady Amynne', 2, 0], ['Deivid Souza', 1, 1]]);
  assert.match(r.texto, /1\. \*Jady\* · fez 2 Card em 90 dias · 0 com prazo até 30\/10/);
});

test('sem briefing: card novo e aberto, sem briefing nem comentário de briefing; pede para quem criou', async () => {
  const { pecasSemBriefing } = await import('../server/assistente-saude.js');
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,monday_user_id text);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,veiculacao date,removido_em timestamptz,status_chave text,monday_item_id bigint,briefing text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int);
    CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,em timestamptz,autor_id bigint);
    CREATE TABLE vybe_conteudo_updates(conteudo_id bigint,corpo text);
    INSERT INTO vybe_clientes VALUES (10,'Gonzalez');
    INSERT INTO vybe_pessoas VALUES (1,'Tainara Lima','80146924'),(2,'Jady Amynne','100482777');
    INSERT INTO vybe_status VALUES (${PROD},'ab','Nova demanda',false);
    INSERT INTO vybe_conteudos VALUES (1,${PROD},'Reels - Sem briefing','Reels','2026-10-30',NULL,'ab',555,NULL),
      (2,${PROD},'Card - Com briefing','Card','2026-10-30',NULL,'ab',NULL,'Objetivo: ...'),
      (3,${PROD},'Card - Briefing no comentário','Card','2026-10-30',NULL,'ab',NULL,NULL),
      (4,${PROD},'Card - Antigo','Card','2026-10-30',NULL,'ab',NULL,NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (1,10);
    INSERT INTO vybe_conteudo_responsaveis VALUES (1,2,0);
    INSERT INTO vybe_conteudo_eventos VALUES (1,'criacao','2026-10-27 09:00',1),(2,'criacao','2026-10-27 09:00',1),(3,'criacao','2026-10-27 09:00',1),(4,'criacao','2026-10-10 09:00',1);
    INSERT INTO vybe_conteudo_updates VALUES (3,'BRIEFING: objetivo vender');`);
  const r = await pecasSemBriefing(sql, '2026-10-27');
  assert.deepEqual(r, [{ ref: '555', titulo: 'Reels - Sem briefing', formato: 'Reels', cliente: 'Gonzalez', veiculacao: '2026-10-30', pessoa: { monday_id: '80146924', nome: 'Tainara Lima' } }]);
});
