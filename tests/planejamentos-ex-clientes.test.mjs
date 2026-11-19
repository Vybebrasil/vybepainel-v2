// Planejamentos sem ex-clientes (Bia, 18/11/2026): Alpha1 e Mangaba AI têm nao_e_cliente e apareciam no módulo
// Planejamentos, na lista e em "Sem planejamento". A regra é a de ativo_de_verdade (api/painel.js): ativo e não marcado
// "não é cliente". O planejamento antigo continua guardado e abre pela ficha do cliente; só sai da tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import * as P from '../server/planejamentos.js';

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true);
  INSERT INTO vybe_pessoas VALUES(1,'Paulo',true),(3,'Vinícius',true);
  CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,email text,responsavel text,segmento text,nao_e_cliente boolean DEFAULT false);
  INSERT INTO vybe_clientes(id,nome,ativo,nao_e_cliente) VALUES(10,'Serra Grande',true,false),(26,'Alpha1',true,true),(229,'Mangaba AI',NULL,true),(30,'Hellen',NULL,NULL),(31,'Antigo',false,false);
  CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
  INSERT INTO vybe_cliente_pessoas VALUES(10,3,0),(26,3,0);
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,status_chave text,prazo date,briefing text,removido_em timestamptz,monday_item_id text);
  CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean DEFAULT false);
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int DEFAULT 0);`);
  await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql', 'utf8'));
  return { db, sql };
}
const conteudo = { resumo: 'Dezembro', pecas: [{ data: '2026-12-03', formato: 'Card', tema: 'Natal' }] };

test('Planejamentos: ex-cliente (nao_e_cliente) sai da lista e de "sem planejamento"; o planejamento fica guardado', async (t) => {
  const { sql } = await banco(t);
  await P.publicarDoAgente(sql, { cliente: '10', mes: '2026-12', conteudo });
  await P.publicarDoAgente(sql, { cliente: '229', mes: '2026-12', conteudo });
  const postos = await P.postosDaOperacao(sql, { id: 3 });
  assert.deepEqual(postos.map((p) => p.cliente), ['Serra Grande', 'Hellen'], 'só ativo de verdade: ativo nulo conta como ativo; nao_e_cliente e ativo=false ficam fora');
  assert.equal(postos.filter((p) => !p.planejamento).map((p) => p.cliente).join(), 'Hellen', 'Alpha1 não aparece em "sem planejamento"');
  const lista = await P.listarPlanejamentos(sql, { id: 1, admin: true });
  assert.deepEqual(lista.planejamentos.map((p) => p.cliente), ['Serra Grande'], 'a lista geral não mostra o planejamento da Mangaba AI');
  // Guardado: a ficha do cliente (por id) e o banco ainda têm o planejamento.
  const daFicha = await P.listarPlanejamentos(sql, { id: 1, admin: true }, { clienteId: '229' });
  assert.equal(daFicha.planejamentos.length, 1);
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM vybe_planejamentos WHERE cliente_id=229`;
  assert.equal(n, 1);
});

test('Planejamentos na tela: o cadastro carregado também tira o ex-cliente (clienteAtivo de vybe-core.js)', () => {
  const fonte = readFileSync('vybe-mundo-planejamentos.js', 'utf8');
  const corpo = fonte.match(/function soAtivos\(postos\) \{[\s\S]*?\n {2}\}/)?.[0];
  assert.ok(corpo, 'soAtivos existe');
  assert.match(fonte, /estado\.postos = soAtivos\(/, 'os postos lidos passam por soAtivos');
  const core = readFileSync('vybe-core.js', 'utf8').match(/function clienteAtivo\(c\) \{[\s\S]*?\n\}/)[0];
  const ctx = vm.createContext({ CADASTRO_CLIENTES: [{ id: '26', nome: 'Alpha1', ativo_de_verdade: false }, { id: '229', nome: 'Mangaba AI', ativo: true, nao_e_cliente: true }, { id: '10', nome: 'Serra Grande', ativo_de_verdade: true }] });
  vm.runInContext(`${core}\n${corpo}\nthis.soAtivos = soAtivos;`, ctx);
  const postos = [{ cliente_id: '10', cliente: 'Serra Grande' }, { cliente_id: '26', cliente: 'Alpha1' }, { cliente_id: '229', cliente: 'Mangaba AI' }, { cliente_id: '99', cliente: 'Fora do cadastro' }];
  assert.deepEqual(ctx.soAtivos(postos).map((p) => p.cliente), ['Serra Grande', 'Fora do cadastro']);
  ctx.CADASTRO_CLIENTES = [];
  assert.equal(ctx.soAtivos(postos).length, 4, 'sem cadastro carregado, vale o que o servidor mandou');
});
