import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaImpressoes, usarCriacaoDePeca, porFornecedor } from '../server/impressoes.js';

// Impressões com módulo próprio (Paulo, 09/11/2026): cliente, arte na esteira, fornecedor e etapas datadas.
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins', dono: true } };
const ana = { tipo: 'sessao', pessoa: { id: 2, nome: 'Ana', admin: false } };

async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean, pode_entrar boolean);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false, apagado_em timestamptz);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, board_id bigint, titulo text, formato text, status_chave text, prazo date, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint, ordem int, PRIMARY KEY (conteudo_id, pessoa_id));
    CREATE TABLE vybe_projetos (id bigserial PRIMARY KEY, nome text, cliente_id bigint, inicio date DEFAULT now(), status text DEFAULT 'planejado');
    CREATE TABLE vybe_comercial_fornecedores (id bigint PRIMARY KEY, nome text, categoria text, ativo boolean DEFAULT true);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins',true,true),(2,'Ana',true,true),(3,'Sem acesso',true,false);
    INSERT INTO vybe_clientes (id, nome, ativo) VALUES (27,'VOA',true),(1,'Irecê Modas',false);
    INSERT INTO vybe_status VALUES (8385559107,'em_impressao','Em impressão',false),(8385559107,'em_aprovacao','Em Aprovação',false),
      (8385559107,'feito','Feito',true),(8385559107,'nova_demanda','Nova Demanda',false);
    INSERT INTO vybe_conteudos VALUES (500,8385559107,'Impresso - Arte para adesivo','Impresso','em_aprovacao','2026-10-27',NULL),
      (501,8385559107,'Impresso - Arte para sacola','Impresso','em_impressao','2026-10-31',NULL),
      (502,8385559107,'Impresso - Antigo','Impresso','feito','2026-01-01',NULL),(503,8385559107,'Card','Card','em_aprovacao',NULL,NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (500,27),(501,27),(502,27),(503,27);
    INSERT INTO vybe_comercial_fornecedores VALUES (70,'Gráfica Irecê','grafica',true),(71,'Antiga','grafica',false);`);
  const m = readFileSync('migrations/2026-11-09-impressoes.sql', 'utf8'); await db.exec(m); await db.exec(m);
  return { db, sql };
}
async function chamar(sql, quem, body) {
  const r = resposta(); await areaImpressoes({ method: body ? 'POST' : 'GET', body, query: {} }, r, quem, sql); return r;
}

test('migração traz as impressas abertas das Solicitações uma vez só, na etapa certa', async (t) => {
  const { sql } = await banco(t);
  const r = await chamar(sql, ana);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.impressoes.map((i) => [i.titulo, i.etapa, i.cliente_nome, i.conteudo_id]).sort(),
    [['Arte para adesivo', 'arte', 'VOA', '500'], ['Arte para sacola', 'em_impressao', 'VOA', '501']]);
  assert.equal(r.body.impressoes[0].eventos[0].nota, 'Trazida das Solicitações');
  assert.equal(r.body.resumo.semFornecedor, 2);
  assert.deepEqual(r.body.fornecedores.map((f) => f.nome), ['Gráfica Irecê'], 'só fornecedor ativo');
  assert.deepEqual(r.body.pessoas.map((p) => p.nome), ['Ana', 'Paulo Martins'], 'equipe: ativo e com acesso');
  assert.equal('valor' in r.body.impressoes[0], false, 'valor só para a gestão');
  assert.equal((await chamar(sql, { tipo: 'servico' })).codigo, 403);
});

test('impressão nova abre a arte na esteira; etapas pedem fornecedor e datam pedido e entrega; valor só da gestão', async (t) => {
  const { db, sql } = await banco(t);
  const pedidos = [];
  usarCriacaoDePeca(async (tx, quem, d) => {
    pedidos.push(d);
    await tx`INSERT INTO vybe_conteudos (id, board_id, titulo, formato, status_chave, prazo) VALUES (900, ${d.board}, ${d.titulo}, ${d.formato}, ${d.status}, ${d.prazo}::date)`;
    return { conteudo_id: 900 };
  });
  t.after(() => usarCriacaoDePeca(null));
  let r = await chamar(sql, ana, { acao: 'impressao_salvar', titulo: 'Lona da fachada', cliente_id: '1' });
  assert.equal(r.codigo, 400, 'cliente inativo');
  r = await chamar(sql, ana, { acao: 'impressao_salvar', titulo: 'Lona da fachada', cliente_id: '27', material: 'Lona', quantidade: 2,
    especificacao: '3x1 m, ilhós', previsao: '2026-11-20', responsavel: '2', valor: 500 });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const id = r.body.id; assert.equal(r.body.arte_id, '900');
  assert.deepEqual(pedidos.map((d) => [d.board, d.formato, d.titulo, d.cliente, d.prazo]), [[8385559107, 'Impresso', 'Impresso - Lona da fachada', 'VOA', '2026-11-20']]);
  r = await chamar(sql, ana, { acao: 'impressao_etapa', id, etapa: 'em_impressao' });
  assert.equal(r.codigo, 400, 'sem fornecedor não vai para a gráfica');
  // A arte terminou na esteira: a impressão sai de Arte para Orçamento sozinha.
  await db.exec(`UPDATE vybe_conteudos SET status_chave = 'feito' WHERE id = 900`);
  r = await chamar(sql, paulo);
  let lona = r.body.impressoes.find((i) => i.id === id);
  assert.equal(lona.etapa, 'orcamento'); assert.equal(lona.valor, null, 'valor da Ana não grava');
  assert.equal(lona.eventos.at(-1).nota, 'Arte concluída na esteira');
  r = await chamar(sql, paulo, { acao: 'impressao_salvar', id, titulo: 'Lona da fachada', cliente_id: '27', conteudo_id: '900', fornecedor_id: '70', previsao: '2026-11-01', valor: 480 });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  r = await chamar(sql, ana, { acao: 'impressao_etapa', id, etapa: 'em_impressao' }); assert.equal(r.codigo, 200, JSON.stringify(r.body));
  r = await chamar(sql, paulo);
  lona = r.body.impressoes.find((i) => i.id === id);
  assert.equal(lona.valor, 480); assert.ok(lona.pedido_em); assert.equal(lona.atrasada, true, 'previsão vencida');
  assert.deepEqual(r.body.porFornecedor.map((f) => [f.nome, f.abertas, f.atrasadas]), [['Gráfica Irecê', 1, 1]]);
  r = await chamar(sql, ana, { acao: 'impressao_etapa', id, etapa: 'cancelado' }); assert.equal(r.codigo, 400, 'cancelar pede motivo');
  r = await chamar(sql, ana, { acao: 'impressao_etapa', id, etapa: 'entregue' }); assert.equal(r.codigo, 200);
  r = await chamar(sql, ana);
  lona = r.body.impressoes.find((i) => i.id === id);
  assert.ok(lona.entregue_em); assert.equal(lona.atrasada, false);
  assert.deepEqual(lona.eventos.map((e) => e.para), ['arte', 'orcamento', 'em_impressao', 'entregue']);
});

test('prazo médio do fornecedor: do pedido à entrega', () => {
  const r = porFornecedor([{ fornecedor_id: '1', fornecedor_nome: 'G', etapa: 'entregue', pedido_em: '2026-11-01', entregue_em: '2026-11-05' },
    { fornecedor_id: '1', fornecedor_nome: 'G', etapa: 'entregue', pedido_em: '2026-11-01', entregue_em: '2026-11-07' }, { fornecedor_id: '1', etapa: 'pronto', atrasada: false }]);
  assert.deepEqual(r, [{ fornecedor_id: '1', nome: 'G', abertas: 1, atrasadas: 0, entregues: 2, prazo_medio_dias: 5 }]);
});
