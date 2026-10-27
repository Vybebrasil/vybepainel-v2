import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { criarCliente, cicloCliente, criarPessoa, cicloPessoa, listarSubsolo, esquecerCicloDeVidaPronto } from '../server/ciclo-de-vida.js';

async function banco() {
  esquecerCicloDeVidaPronto();
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigserial primary key, nome text unique not null, ativo boolean not null default true,
      status text, email text, telefone text, cnpj text, segmento text, valor numeric, monday_item_id text,
      identidade jsonb not null default '{}'::jsonb, nao_e_cliente boolean not null default false);
    CREATE TABLE vybe_pessoas(id bigserial primary key, nome text not null, papel text, email text, ativo boolean not null default true,
      pode_entrar boolean not null default false, admin boolean not null default false, senha_hash text, senha_sal text,
      foto_url text, sessao_versao int not null default 0, monday_user_id text);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id int, cliente_id bigint references vybe_clientes(id));
    CREATE TABLE vybe_cliente_pessoas(cliente_id bigint references vybe_clientes(id), pessoa_id bigint references vybe_pessoas(id), ordem int);
    CREATE TABLE vybe_acessos(id serial primary key, nome text, cliente_id bigint references vybe_clientes(id));
    CREATE TABLE vybe_ai_vinculos(id serial primary key, pessoa_id bigint references vybe_pessoas(id), revogado_em timestamptz);
    INSERT INTO vybe_clientes(nome, status, email, cnpj, segmento, monday_item_id, identidade)
      VALUES ('Padaria Sol', 'Ativo', 'contato@sol.invalid', '00.000', 'Alimentos', '77', '{"personagem":"padeiro"}');
    INSERT INTO vybe_pessoas(nome, email, admin, pode_entrar, senha_hash, monday_user_id)
      VALUES ('Paulo Teste', 'paulo@vybe.invalid', true, true, 'h', '1'),
             ('Ana Teste', 'ana@vybe.invalid', false, true, 'h', '2');
    INSERT INTO vybe_conteudo_clientes VALUES (10, 1);
    INSERT INTO vybe_cliente_pessoas VALUES (1, 2, 0);
    INSERT INTO vybe_acessos(nome, cliente_id) VALUES ('Instagram', 1);
    INSERT INTO vybe_ai_vinculos(pessoa_id) VALUES (2);`);
  return { db, sql };
}

test('cliente desce ao subsolo, volta, e só se apaga depois de desativado e com o nome digitado', async () => {
  const { db, sql } = await banco();
  try {
    await assert.rejects(cicloCliente(sql, { id: 1, acao: 'apagar', confirmacao: 'Padaria Sol' }), /subsolo antes/);
    await cicloCliente(sql, { id: 1, acao: 'desativar', motivo: 'Encerrou contrato', autor: 'Paulo' });
    let sub = await listarSubsolo(sql);
    assert.deepEqual(sub.clientes.map((c) => [c.nome, c.motivo, c.pecas]), [['Padaria Sol', 'Encerrou contrato', 1]]);
    assert.ok(sub.clientes[0].saiu_em);

    await cicloCliente(sql, { id: 1, acao: 'reativar' });
    assert.equal((await sql`SELECT ativo FROM vybe_clientes WHERE id=1`)[0].ativo, true);
    assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_cliente_pessoas`)[0].n, 1, 'heads voltam junto');

    await cicloCliente(sql, { id: 1, acao: 'desativar' });
    await assert.rejects(cicloCliente(sql, { id: 1, acao: 'apagar', confirmacao: 'Padaria' }), /nome exato/);
    await cicloCliente(sql, { id: 1, acao: 'apagar', confirmacao: 'padaria sol' });
    const [c] = await sql`SELECT nome, email, cnpj, monday_item_id, identidade, status, apagado_em FROM vybe_clientes WHERE id=1`;
    assert.equal(c.nome, 'Padaria Sol', 'o nome fica congelado');
    assert.equal(c.email, null); assert.equal(c.cnpj, null); assert.equal(c.monday_item_id, null);
    assert.deepEqual(c.identidade, {}); assert.equal(c.status, 'Apagado'); assert.ok(c.apagado_em);
    assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_acessos`)[0].n, 0, 'senhas do cliente saem');
    assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_conteudo_clientes`)[0].n, 1, 'as peças ficam');
    assert.equal((await listarSubsolo(sql)).clientes.length, 0);
    await assert.rejects(cicloCliente(sql, { id: 1, acao: 'reativar' }), /para sempre/);
    await assert.rejects(criarCliente(sql, { nome: 'PADARIA SOL' }), /apagado para sempre/);
    const eventos = await sql`SELECT tipo, para FROM vybe_cliente_eventos ORDER BY id`;
    assert.deepEqual(eventos.map((e) => e.para), ['Inativo', 'Ativo', 'Inativo', 'Apagado']);
  } finally { await db.close(); }
});

test('criar cliente com nome de quem está no subsolo traz de volta em vez de duplicar', async () => {
  const { db, sql } = await banco();
  try {
    await cicloCliente(sql, { id: 1, acao: 'desativar' });
    const r = await criarCliente(sql, { nome: ' padaria sol ' });
    assert.equal(r.reativado, true);
    const novo = await criarCliente(sql, { nome: 'Oficina Lua', autor: 'Paulo' });
    assert.equal(novo.cliente.ativo, true);
    assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_clientes`)[0].n, 2);
  } finally { await db.close(); }
});

test('colaborador sai sem login nem WhatsApp, volta entrando, e apagado perde o cadastro', async () => {
  const { db, sql } = await banco();
  try {
    await assert.rejects(cicloPessoa(sql, { id: 1, acao: 'desativar', autorId: 1 }), /si mesmo/);
    await assert.rejects(cicloPessoa(sql, { id: 1, acao: 'desativar', autorId: 2 }), /último administrador/);
    await cicloPessoa(sql, { id: 2, acao: 'desativar', autorId: 1, motivo: 'Saiu da agência' });
    let [ana] = await sql`SELECT ativo, pode_entrar, sessao_versao FROM vybe_pessoas WHERE id=2`;
    assert.deepEqual([ana.ativo, ana.pode_entrar, ana.sessao_versao], [false, false, 1]);
    assert.ok((await sql`SELECT revogado_em FROM vybe_ai_vinculos`)[0].revogado_em);
    assert.deepEqual((await listarSubsolo(sql)).pessoas.map((p) => [p.nome, p.motivo]), [['Ana Teste', 'Saiu da agência']]);

    await cicloPessoa(sql, { id: 2, acao: 'reativar', autorId: 1 });
    [ana] = await sql`SELECT ativo, pode_entrar FROM vybe_pessoas WHERE id=2`;
    assert.deepEqual([ana.ativo, ana.pode_entrar], [true, true], 'quem entrava volta entrando');

    await cicloPessoa(sql, { id: 2, acao: 'desativar', autorId: 1 });
    await cicloPessoa(sql, { id: 2, acao: 'apagar', autorId: 1, confirmacao: 'Ana Teste' });
    [ana] = await sql`SELECT nome, email, senha_hash, monday_user_id, apagado_em FROM vybe_pessoas WHERE id=2`;
    assert.deepEqual([ana.nome, ana.email, ana.senha_hash, ana.monday_user_id], ['Ana Teste', null, null, '2']);
    assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_ai_vinculos`)[0].n, 0);
    assert.equal((await sql`SELECT COUNT(*)::int n FROM vybe_cliente_pessoas`)[0].n, 0);
    await assert.rejects(cicloPessoa(sql, { id: 2, acao: 'reativar' }), /para sempre/);

    const nova = await criarPessoa(sql, { nome: 'Bia Teste', email: 'BIA@vybe.invalid' });
    const [bia] = await sql`SELECT email, ativo, pode_entrar FROM vybe_pessoas WHERE id=${nova.pessoa.id}`;
    assert.deepEqual([bia.email, bia.ativo, bia.pode_entrar], ['bia@vybe.invalid', true, false]);
    await assert.rejects(criarPessoa(sql, { nome: 'X', email: 'sem-arroba' }), /E-mail inválido/);
    // Sem e-mail ficaria fora da Equipe e sem como entrar.
    await assert.rejects(criarPessoa(sql, { nome: 'Sem Email', email: '' }), /Informe o e-mail/);
  } finally { await db.close(); }
});
