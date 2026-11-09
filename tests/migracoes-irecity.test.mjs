// SAFE: PGlite em memória; verifica que garantirMigracoesIrecity cria todas as tabelas
// das 5 migrações de 07/11/2026 no primeiro uso (e é idempotente na segunda chamada).
import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { garantirMigracoesIrecity, esquecerMigracoesIrecity } from '../server/migracoes-irecity.js';
import { areaCarteira } from '../server/carteira.js';
import { areaComercial } from '../server/comercial-api.js';
import { areaSetorPessoas } from '../server/pessoas.js';
import { listarObjetivos, trocarObjetivo } from '../server/conteudo-objetivo.js';

const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins', admin: true } };

test('migrações do Irecity: o servidor cria as tabelas no primeiro uso e é idempotente', async (t) => {
  esquecerMigracoesIrecity();
  const { db, sql } = conexao();
  t.after(() => db.close());

  await db.exec(`
    CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, email text, ativo boolean DEFAULT true, pode_entrar boolean DEFAULT true, admin boolean DEFAULT false, monday_user_id text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, status text, nao_e_cliente boolean DEFAULT false, valor numeric, criado_no_monday date, desativado_em timestamptz, apagado_em timestamptz); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
    CREATE TABLE vybe_cliente_eventos (id bigserial PRIMARY KEY, cliente_id bigint, tipo text, de text, para text, motivo text, autor text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_cliente_pessoas (cliente_id bigint, pessoa_id bigint, ordem int DEFAULT 0);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY, funcao text);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, monday_index int, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, monday_item_id text, board_id bigint, titulo text, formato text, status_chave text, prazo date, veiculacao date, status_em timestamptz, atualizado_em timestamptz, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint, ordem int DEFAULT 0, PRIMARY KEY (conteudo_id, pessoa_id));
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    CREATE TABLE vybe_conteudo_eventos (id bigserial PRIMARY KEY, conteudo_id bigint, tipo text, de text, para text, autor_id bigint, texto text, em timestamptz DEFAULT now());
    INSERT INTO vybe_pessoas (id, nome, email, ativo, pode_entrar, admin) VALUES (1, 'Paulo Martins', 'paulo@vybe.invalid', true, true, true);
    INSERT INTO vybe_clientes (id, nome, ativo, status) VALUES (10, 'Alfa', true, 'Ativo');
    INSERT INTO vybe_conteudos (id, board_id, titulo, status_chave) VALUES (100, 1, 'Peça 1', 'em_andamento');
  `);

  // Primeira execução: cria todas as tabelas e semeia a Academy.
  await garantirMigracoesIrecity(sql);
  // Segunda execução (forçando releitura do banco): idempotente e rápida.
  esquecerMigracoesIrecity();
  await garantirMigracoesIrecity(sql);

  // 1. Carteira provisionada
  const rCarteira = resposta();
  await areaCarteira({ method: 'GET', query: {} }, rCarteira, paulo, () => sql);
  assert.equal(rCarteira.codigo, 200);
  assert.equal(rCarteira.body.onboarding.disponivel, true);
  assert.equal(rCarteira.body.contratos.disponivel, true);

  // 2. Comercial provisionado
  const rComercial = resposta();
  await areaComercial({ method: 'GET', query: { aba: 'pacotes' } }, rComercial, paulo, () => sql);
  assert.equal(rComercial.codigo, 200);
  assert.equal(Array.isArray(rComercial.body.pacotes), true);

  // 3. Conteúdo (objetivos) provisionado
  await trocarObjetivo(sql, paulo, { item: 'vybe:100', objetivo: 'conversao' });
  const obj = await listarObjetivos(sql);
  assert.equal(obj.pronto, true);
  assert.equal(obj.objetivos['vybe:100'], 'conversao');

  // 4. Setor de Pessoas provisionado (com trilha inicial da Academy semeada)
  const rPessoas = resposta();
  await areaSetorPessoas({ method: 'GET', query: { aba: 'academy' } }, rPessoas, paulo, sql);
  assert.equal(rPessoas.codigo, 200);
  assert.equal(rPessoas.body.provisionado, true);
  assert.equal(rPessoas.body.trilhas.length, 1);
  assert.equal(rPessoas.body.trilhas[0].aulas.length, 6);

  // 5. RH de 08/11 (2026-11-08-rh-pedidos-clima.sql): prazos, data desejada, reembolso e pesquisa com período.
  const rRh = resposta();
  await areaSetorPessoas({ method: 'GET', query: { aba: 'rh' } }, rRh, paulo, sql);
  assert.equal(rRh.codigo, 200);
  assert.equal(rRh.body.rhPronto, true);
  const tabelas = (await db.query(`SELECT to_regclass('public.vybe_rh_prazos') AS a, to_regclass('public.vybe_clima_pesquisas') AS b,
    to_regclass('public.vybe_clima_pesquisa_respostas') AS c, to_regclass('public.vybe_clima_pesquisa_participacao') AS d`)).rows[0];
  assert.ok(tabelas.a && tabelas.b && tabelas.c && tabelas.d, JSON.stringify(tabelas));
  const rPed = resposta();
  await areaSetorPessoas({ method: 'POST', body: { acao: 'pedido_criar', tipo: 'reembolso', titulo: 'Uber', data_desejada: '2026-12-01' } }, rPed, paulo, sql);
  assert.equal(rPed.codigo, 200, JSON.stringify(rPed.body));
});
