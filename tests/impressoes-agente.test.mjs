import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { registrarPeloAgente } from '../server/impressoes.js';

// O Nestor registra em Impressões o que leu na conversa com o fornecedor (Paulo, 09/11/2026: "o Nestor não era pra
// identificar que eu não cadastrei e fazer isso?"). Etapa só anda para a frente; cada mudança leva a frase da conversa.
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean, pode_entrar boolean, monday_user_id text, admin boolean DEFAULT false);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false, apagado_em timestamptz);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, board_id bigint, titulo text, formato text, status_chave text, prazo date, removido_em timestamptz, status_em timestamptz, criado_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint, ordem int, PRIMARY KEY (conteudo_id, pessoa_id));
    CREATE TABLE vybe_projetos (id bigserial PRIMARY KEY, nome text, cliente_id bigint, inicio date DEFAULT now(), status text DEFAULT 'planejado');
    CREATE TABLE vybe_comercial_fornecedores (id bigserial PRIMARY KEY, nome text, categoria text, ativo boolean DEFAULT true, contato text DEFAULT '', observacoes text DEFAULT '', criado_por bigint);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins',true,true,'68035537'),(2,'Ana',true,true,NULL),(3,'Sem acesso',true,false,NULL);
    INSERT INTO vybe_clientes (id, nome, ativo) VALUES (27,'VOA',true),(1,'Irecê Modas',false);
    INSERT INTO vybe_status VALUES (8385559107,'em_impressao','Em impressão',false),(8385559107,'em_aprovacao','Em Aprovação',false),
      (8385559107,'feito','Feito',true),(8385559107,'nova_demanda','Nova Demanda',false);
    INSERT INTO vybe_conteudos VALUES (500,8385559107,'Impresso - Arte para adesivo','Impresso','em_aprovacao','2026-10-27',NULL),
      (501,8385559107,'Impresso - Arte para sacola','Impresso','em_impressao','2026-10-31',NULL),
      (502,8385559107,'Impresso - Antigo','Impresso','feito','2026-01-01',NULL),(503,8385559107,'Card','Card','em_aprovacao',NULL,NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (500,27),(501,27),(502,27),(503,27);
    INSERT INTO vybe_comercial_fornecedores VALUES (70,'Gráfica Irecê','grafica',true),(71,'Antiga','grafica',false);`);
  for (const arq of ['2026-11-09-impressoes.sql', '2026-11-09-impressoes-fornecedores.sql']) { const m = readFileSync('migrations/' + arq, 'utf8'); await db.exec(m); await db.exec(m); }
  return { db, sql };
}

const frase = 'vamos fazer o possível pra entregar antes dos 30 dias';
const linha = (sql, id) => sql`SELECT titulo, etapa, fornecedor_id::text AS f, cliente_id::text AS c, pedido_em::text AS pedido, previsao::text AS previsao, quantidade FROM vybe_impressoes WHERE id = ${id}`;

test('sem a impressão em Impressões, o Nestor cria com fornecedor, cliente, etapa e datas; de novo, não duplica', async (t) => {
  const { sql } = await banco(t);
  const emb = (await sql`SELECT id::text AS id FROM vybe_comercial_fornecedores WHERE nome = 'Emballar'`)[0].id;
  const r = await registrarPeloAgente(sql, 1, { titulo: 'Sacola plástica P 30x40', quantidade: 2000, cliente: 'voa', fornecedor: 'EMBALLAR', etapa: 'em_impressao', pedido_em: '2026-10-28', previsao: '2026-11-27', frase });
  assert.equal(r.criada, true);
  const [i] = await linha(sql, r.id);
  assert.deepEqual([i.etapa, i.f, i.c, i.pedido, i.previsao, i.quantidade], ['em_impressao', emb, '27', '2026-10-28', '2026-11-27', 2000]);
  const [ev] = await sql`SELECT para, nota, autor_id::text AS autor FROM vybe_impressao_eventos WHERE impressao_id = ${r.id}`;
  assert.deepEqual([ev.para, ev.autor], ['em_impressao', '1']); assert.match(ev.nota, /^Nestor, pela conversa com EMBALLAR: “vamos fazer/);
  const de_novo = await registrarPeloAgente(sql, 1, { titulo: 'sacola plastica p 30x40', cliente: 'VOA', fornecedor: 'Emballar', etapa: 'em_impressao', previsao: '2026-11-27', frase });
  assert.deepEqual([de_novo.id, de_novo.criada, de_novo.mudou], [r.id, false, []], 'mesma impressão, nada mudou');
});

test('na impressão que já existe: põe o fornecedor, anda a etapa e nunca volta nem cancela', async (t) => {
  const { sql } = await banco(t);
  const [a] = await sql`INSERT INTO vybe_impressoes (titulo, cliente_id, etapa) VALUES ('Tag do panetone', 27, 'orcamento') RETURNING id::text AS id`;
  // Sem o cliente na conversa, a impressão de um cliente não muda (a sacola branca foi parar na VOA, 09/11).
  await assert.rejects(registrarPeloAgente(sql, 1, { impressao_id: a.id, titulo: 'Tag do panetone', fornecedor: 'Emballar', etapa: 'pronto', frase: 'prontas' }), /não confere/);
  await assert.rejects(registrarPeloAgente(sql, 1, { impressao_id: a.id, titulo: 'Tag do panetone', cliente: 'Gonzalez', fornecedor: 'Emballar', etapa: 'pronto', frase: 'prontas' }), /não confere/);
  let r = await registrarPeloAgente(sql, 1, { impressao_id: a.id, titulo: 'Tag do panetone', cliente: 'VOA', fornecedor: 'Emballar', etapa: 'pronto', valor: 380, frase: 'as tags estão prontas' });
  assert.deepEqual(r.mudou, ['fornecedor', 'valor', 'etapa']);
  let [i] = await linha(sql, a.id); assert.equal(i.etapa, 'pronto');
  r = await registrarPeloAgente(sql, 1, { impressao_id: a.id, titulo: 'Tag do panetone', cliente: 'VOA', fornecedor: 'Emballar', etapa: 'orcamento', frase: 'quanto fica?' });
  assert.deepEqual(r.mudou, [], 'etapa não volta');
  await assert.rejects(registrarPeloAgente(sql, 1, { impressao_id: a.id, titulo: 'x', fornecedor: 'Emballar', etapa: 'cancelado', frase: 'desisti' }), /Etapa inválida/);
  await assert.rejects(registrarPeloAgente(sql, 1, { titulo: 'x', fornecedor: 'Gráfica Desconhecida', etapa: 'orcamento', frase: 'oi' }), /não está cadastrado/);
  await assert.rejects(registrarPeloAgente(sql, 1, { titulo: 'x', fornecedor: 'Emballar', etapa: 'orcamento', frase: '' }), /Informe frase/);
});

test('impressão criada sem cliente ganha o cliente quando o Nestor descobre de quem é', async (t) => {
  const { sql } = await banco(t);
  const r = await registrarPeloAgente(sql, 1, { titulo: 'Sacola pequena 30 x 40 cm', fornecedor: 'Emballar', etapa: 'em_impressao', frase: '50% sacolas P' });
  const de_novo = await registrarPeloAgente(sql, 1, { titulo: 'Sacola pequena 30 x 40 cm', cliente: 'VOA', fornecedor: 'Emballar', etapa: 'em_impressao', frase: '50% sacolas P' });
  assert.deepEqual([de_novo.id, de_novo.mudou], [r.id, ['cliente']]);
  const [i] = await linha(sql, r.id); assert.equal(i.c, '27');
});
