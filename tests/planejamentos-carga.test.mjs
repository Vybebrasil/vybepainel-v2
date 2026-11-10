// Cadastro do planejamento pela carga (Paulo, 09/11/2026): "colocar no prazo certinho de acordo com a carga de quem vai
// fazer e distribuir pra pessoa certa". O lote não cai inteiro com uma pessoa, e o prazo foge do dia em que ela já está cheia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import * as P from '../server/planejamentos.js';

const PROD = 7829537690;
async function montar(t, { cheios = [] } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,email text,monday_user_id text);
   INSERT INTO vybe_pessoas VALUES(1,'Paulo',true,NULL,'1'),(3,'Vinícius',true,NULL,'3'),(51,'Deivid',true,NULL,'51'),(52,'Bia',true,NULL,'52'),(53,'Jady',true,NULL,'53');
   CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean DEFAULT true,email text,responsavel text,segmento text,nao_e_cliente boolean DEFAULT false);
   INSERT INTO vybe_clientes(id,nome,email) VALUES(10,'Serra Grande','contato@serra.example');
   CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
   INSERT INTO vybe_cliente_pessoas VALUES(10,3,0);
   CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,monday_index int,final boolean DEFAULT false);
   INSERT INTO vybe_status VALUES(${PROD},'pode_fazer','Pode Fazer',1,false),(${PROD},'a_fazer','A Fazer',0,false),(${PROD},'publicado','Publicado',9,true);
   CREATE TABLE vybe_conteudos(id bigserial PRIMARY KEY,board_id bigint,titulo text,formato text,formato_chaves text[],tipo_conteudo_chaves text[],clientes_texto text,status_chave text,etapa text,grupo_id text,prazo date,veiculacao date,briefing text,prioridade text,status_em timestamptz,captacao text,removido_em timestamptz,monday_item_id text);
   CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
   CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int DEFAULT 0, PRIMARY KEY(conteudo_id,pessoa_id));
   CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,de text,para text,autor_id bigint,texto text);
   CREATE TABLE vybe_opcoes(coluna_id text,chave text,rotulo text,indice int);`);
  await db.exec(readFileSync('migrations/2026-10-20-planejamentos.sql', 'utf8'));
  // Carga já existente: cada [pessoa, dia, n, status] vira n peças abertas (ou publicadas) com prazo naquele dia.
  let id = 500;
  for (const [pessoa, dia, n, status = 'a_fazer'] of cheios)
    for (let k = 0; k < n; k++, id++) await db.exec(`INSERT INTO vybe_conteudos(id,board_id,titulo,formato,status_chave,prazo,veiculacao) VALUES(${id},${PROD},'Card - fila','Card','${status}','${dia}','${dia}');
      INSERT INTO vybe_conteudo_responsaveis VALUES(${id},${pessoa},0);`);
  await db.exec(`SELECT setval('vybe_conteudos_id_seq', 1000)`);
  return { db, sql };
}
async function aprovado(sql, pecas) {
  const p = await P.publicarDoAgente(sql, { cliente: 'Serra Grande', mes: '2026-12', conteudo: { pecas } });
  const env = await P.enviarAoCliente(sql, { id: 3 }, { id: p.id });
  await P.responderDoCliente(sql, env.token, { acao: 'aprovar', nome: 'Ana' });
  return P.detalhePlanejamento(sql, { id: 3 }, p.id);
}
const linhas = (sql) => sql`SELECT c.titulo, TO_CHAR(c.prazo,'YYYY-MM-DD') AS prazo,
  ARRAY(SELECT pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=c.id) AS resp FROM vybe_conteudos c WHERE id>1000 ORDER BY id`;
const card = (n, extra = {}) => ({ data: '2026-12-10', formato: 'Card', tema: `Peça ${n}`, legenda: 'x', ...extra });
const destinos = { Card: { grupo_id: 'novo_grupo__1', status: 'pode_fazer', responsaveis: ['51', '52', '53'] } };
const vini = { tipo: 'sessao', pessoa: { id: 3 } };

test('lote do planejamento: uma peça por pessoa pela carga até a veiculação, sem jogar tudo em quem está cheio', async (t) => {
  // A Bia está com 6 peças abertas no Prazo de Ouro (03/12); publicada não conta.
  const { sql } = await montar(t, { cheios: [[52, '2026-12-03', 6], [51, '2026-12-03', 5, 'publicado']] });
  const p = await aprovado(sql, [1, 2, 3, 4].map((n) => card(n)));
  await P.cadastrarPecas(sql, vini, { id: p.id, versao: p.versao, destinos });
  const l = await linhas(sql);
  assert.deepEqual(l.map((x) => x.resp.join()), ['51', '53', '51', '53'], 'Deivid e Jady se revezam; a Bia, cheia, fica de fora');
  assert.ok(l.every((x) => x.prazo === P.prazoDaPeca('2026-12-10', '2026-11-09') || x.prazo <= '2026-12-08'), 'prazo antes da veiculação');
});

test('dia cheio: o prazo vai para o dia útil mais perto com vaga, e o prazo escolhido pelo head é respeitado', async (t) => {
  const { sql } = await montar(t, { cheios: [[51, '2026-12-03', 6]] });
  const p = await aprovado(sql, [card(1), card(2, { prazo: '2026-12-03' })]);
  await P.cadastrarPecas(sql, vini, { id: p.id, versao: p.versao, destinos: { Card: { ...destinos.Card, responsaveis: ['51'] } } });
  const [a, b] = await linhas(sql);
  assert.deepEqual(a.resp, ['51']);
  assert.notEqual(a.prazo, '2026-12-03', 'o Deivid já tem 6 no Prazo de Ouro');
  assert.ok(['2026-12-02', '2026-12-04'].includes(a.prazo), `dia útil mais perto: ${a.prazo}`);
  assert.equal(b.prazo, '2026-12-03', 'o head escolheu o dia: fica');
});
