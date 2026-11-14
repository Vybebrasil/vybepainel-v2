// Confere do back (14/11/2026), item 8 da liga: permissões por COMPORTAMENTO (o servidor responde 200 ou 403), com dono,
// coordenação, atendimento e equipe, em Comercial, Carteira, Séries, Financeiro e Clientes (C2: o dinheiro do cadastro só
// para os donos), e a hora de publicação da peça (item 6). SAFE: PGlite em memória, migrações do próprio repositório.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaComercial } from '../server/comercial-api.js';
import { areaCarteira } from '../server/carteira.js';
import { areaSeries } from '../server/series-historicas.js';
import { areaFinanceiro } from '../server/financeiro.js';
import { areaPecaComplemento } from '../server/campos-d3.js';
import { esquecerMigracoesCampos } from '../server/migracoes-campos.js';
import { esquecerMigracoesHistorico } from '../server/migracoes-historico.js';
import { areaClientes, usarBancoDoPainel } from '../api/painel.js';

after(() => usarBancoDoPainel(null));
// Como a sessão monta (vybe_sessao.js sessaoDoPedido): admin = dono || coordenação.
const PAPEIS = {
  dono: { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', monday_user_id: '68035537', admin: true, dono: true, coordenacao: false } },
  coordenacao: { tipo: 'sessao', pessoa: { id: 3, nome: 'Beatriz', monday_user_id: '71130408', admin: true, dono: false, coordenacao: true } },
  atendimento: { tipo: 'sessao', pessoa: { id: 4, nome: 'Ana', monday_user_id: '400', admin: false, dono: false, coordenacao: false } },
  equipe: { tipo: 'sessao', pessoa: { id: 5, nome: 'Bia', monday_user_id: '500', admin: false, dono: false, coordenacao: false } },
};
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; }, end() { return this; } });

async function banco(t) {
  esquecerMigracoesCampos(); esquecerMigracoesHistorico();
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, email text, ativo boolean DEFAULT true, pode_entrar boolean DEFAULT true, admin boolean DEFAULT false, monday_user_id text);
    INSERT INTO vybe_pessoas (id, nome, monday_user_id) VALUES (1,'Paulo','68035537'),(3,'Beatriz','71130408'),(4,'Ana','400'),(5,'Bia','500');
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY, funcao text);
    INSERT INTO vybe_escritorio_funcoes VALUES (4,'atendimento'),(5,'criacao');
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, status text, nao_e_cliente boolean DEFAULT false, email text, telefone text,
      endereco text, cnpj text, plano text, segmento text, responsavel text, planejamento_url text, dashboard text, valor numeric, proxima_reuniao date, ultima_reuniao date,
      criado_no_monday date, nps smallint, nps_em date, identidade jsonb, desativado_em timestamptz, apagado_em timestamptz);
    INSERT INTO vybe_clientes (id, nome, ativo, status, valor) VALUES (10,'Alfa',true,'Ativo',1500),(11,'Beta',true,'Ativo',900);
    CREATE TABLE vybe_cliente_eventos (id bigserial PRIMARY KEY, cliente_id bigint, tipo text, de text, para text, motivo text, autor text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_cliente_pessoas (cliente_id bigint, pessoa_id bigint, ordem int DEFAULT 0);
    INSERT INTO vybe_cliente_pessoas VALUES (11,4,0);
    CREATE TABLE vybe_acessos (id bigserial PRIMARY KEY, nome text, cliente_id bigint, grupo text, pasta_drive text, link text, manus text, doc_id text, doc_conteudo text,
      doc_atualizado_em timestamptz, atualizado_em timestamptz DEFAULT now());
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, monday_item_id text, board_id bigint, titulo text, formato text, status_chave text, prazo date, veiculacao date,
      status_em timestamptz, criado_em timestamptz DEFAULT now(), removido_em timestamptz);
    INSERT INTO vybe_conteudos (id, monday_item_id, board_id, titulo, status_chave) VALUES (50,'2101',7829537690,'Card','em_andamento'),(51,'2102',7829537690,'Reels','em_andamento');
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint, ordem int DEFAULT 0);
    INSERT INTO vybe_conteudo_responsaveis VALUES (50,5,0);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    INSERT INTO vybe_conteudo_clientes VALUES (50,10),(51,11);
    CREATE TABLE vybe_conteudo_eventos (id bigserial PRIMARY KEY, conteudo_id bigint, tipo text, de text, para text, autor_id bigint, texto text, em timestamptz DEFAULT now());`);
  for (const m of ['2026-11-07-crm-prospeccao', '2026-11-07-comercial', '2026-11-07-carteira']) await db.exec(readFileSync(`migrations/${m}.sql`, 'utf8'));
  return { db, sql };
}
// Roda a mesma ação com os quatro papéis e devolve { papel: status }.
async function matriz(chamar) {
  const out = {};
  for (const [papel, quem] of Object.entries(PAPEIS)) out[papel] = (await chamar(quem)).codigo;
  return out;
}
const pode = (m, quem) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, quem.includes(k) ? v === 200 : v === 403]));
const todos = (m) => Object.fromEntries(Object.keys(m).map((k) => [k, true]));

test('Comercial: dinheiro só dono; fornecedores dono e coordenação; editar o comercial também o atendimento', async (t) => {
  const { sql } = await banco(t);
  const post = (body) => (quem) => { const r = resposta(); return areaComercial({ method: 'POST', body, query: {} }, r, quem, () => sql).then(() => r); };
  let m = await matriz(post({ acao: 'capacidade_salvar', capacidades: { criacao: 40 } }));
  assert.deepEqual(pode(m, ['dono']), todos(m), JSON.stringify(m));
  m = await matriz(post({ acao: 'fornecedor_salvar', nome: 'Gráfica', categoria: 'grafica' }));
  assert.deepEqual(pode(m, ['dono', 'coordenacao']), todos(m), JSON.stringify(m));
  m = await matriz(post({ acao: 'creator_salvar', nome: 'Creator X' }));
  assert.deepEqual(pode(m, ['dono', 'coordenacao', 'atendimento']), todos(m), JSON.stringify(m));
});

test('Carteira: nota do mês e contratos só dono; etapas dono e coordenação', async (t) => {
  const { sql } = await banco(t);
  const post = (body) => (quem) => { const r = resposta(); return areaCarteira({ method: 'POST', body, query: {} }, r, quem, () => sql).then(() => r); };
  let m = await matriz(post({ acao: 'contrato_salvar', cliente_id: 10, valor_mensal: 1000, status: 'ativo' }));
  assert.deepEqual(pode(m, ['dono']), todos(m), JSON.stringify(m));
  m = await matriz(post({ acao: 'saude_registrar', itens: [{ cliente_id: 10, score: 1, risco: 'alto' }] }));
  assert.deepEqual(m, { dono: 200, coordenacao: 403, atendimento: 403, equipe: 403 });
  m = await matriz(post({ acao: 'etapas_salvar', etapas: [{ id: 'boas_vindas', nome: 'Boas-vindas', itens: [{ id: 'mensagem', texto: 'Mensagem' }] }] }));
  assert.deepEqual(m, { dono: 200, coordenacao: 200, atendimento: 403, equipe: 403 });
});

test('Séries: limite de carga e acerto só dono; peças por dia dono e coordenação; carteira e comercial só da gestão', async (t) => {
  const { sql } = await banco(t);
  const post = (body) => (quem) => { const r = resposta(); return areaSeries({ method: 'POST', body }, r, quem, sql).then(() => r); };
  const get = (para) => (quem) => { const r = resposta(); return areaSeries({ method: 'GET', query: { para } }, r, quem, sql).then(() => r); };
  assert.deepEqual(pode(await matriz(post({ acao: 'limite_carga', padrao: 7 })), ['dono']), { dono: true, coordenacao: true, atendimento: true, equipe: true });
  assert.deepEqual(pode(await matriz(post({ acao: 'acerto', agentes: { comercial: 80 } })), ['dono']), { dono: true, coordenacao: true, atendimento: true, equipe: true });
  assert.deepEqual(pode(await matriz(post({ acao: 'limite_dia', padrao: 4 })), ['dono', 'coordenacao']), { dono: true, coordenacao: true, atendimento: true, equipe: true });
  assert.deepEqual(pode(await matriz(get('carteira')), ['dono', 'coordenacao']), { dono: true, coordenacao: true, atendimento: true, equipe: true });
  // O Comercial: a gestão e quem tem acesso ao Comercial (o atendimento edita o comercial).
  assert.deepEqual(pode(await matriz(get('comercial')), ['dono', 'coordenacao', 'atendimento']), { dono: true, coordenacao: true, atendimento: true, equipe: true });
  // O setor lê todo mundo.
  const s = await matriz(get('setor'));
  assert.ok(Object.values(s).every((v) => v === 200), JSON.stringify(s));
});

test('Financeiro: só os donos (a coordenação vê tudo menos dinheiro)', async (t) => {
  const { sql } = await banco(t);
  const m = await matriz((quem) => { const r = resposta(); return areaFinanceiro({ method: 'GET', query: {} }, r, quem, () => sql).then(() => r); });
  assert.deepEqual(pode(m, ['dono']), todos(m), JSON.stringify(m));
});

test('C2: clientes — o valor e o vencimento só para os donos; a coordenação grava o cadastro sem mexer no dinheiro', async (t) => {
  const { sql } = await banco(t);
  usarBancoDoPainel(() => sql);
  await sql`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS cadastro jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql`UPDATE vybe_clientes SET cadastro = '{"vencimento":"10","grupo_whatsapp":"Alfa | Vybe"}'::jsonb WHERE id = 10`;
  const ler = async (quem) => { const r = resposta(); await areaClientes({ method: 'GET', query: {} }, r, quem); return r; };
  for (const [papel, quem] of Object.entries(PAPEIS)) {
    const r = await ler(quem);
    assert.equal(r.codigo, 200, papel);
    const alfa = r.body.clientes.find((c) => c.nome === 'Alfa');
    const campos = r.body.cadastro_def.campos.map((c) => c.chave);
    if (papel === 'dono') {
      assert.equal(Number(alfa.valor), 1500); assert.equal(alfa.cadastro.vencimento, '10'); assert.ok(campos.includes('valor'));
    } else {
      assert.equal(alfa.valor, null, `${papel}: antes o valor ia a qualquer sessão`);
      assert.equal(alfa.cadastro.vencimento, undefined, papel);
      assert.equal(alfa.cadastro.grupo_whatsapp, 'Alfa | Vybe', `${papel}: o resto do cadastro continua`);
      assert.ok(!campos.includes('valor') && !campos.includes('vencimento'), papel);
    }
  }
  const gravar = async (quem, campos) => { const r = resposta(); await areaClientes({ method: 'POST', query: {}, body: { acao: 'cadastro', id: 10, campos } }, r, quem); return r; };
  // A coordenação salva a ficha inteira (a tela manda os campos vazios que não vê): o dinheiro não muda.
  let r = await gravar(PAPEIS.coordenacao, { segmento: 'Café', valor: '', vencimento: '' });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  let [c] = await sql`SELECT valor, segmento, cadastro FROM vybe_clientes WHERE id=10`;
  assert.equal(Number(c.valor), 1500); assert.equal(c.cadastro.vencimento, '10'); assert.equal(c.segmento, 'Café');
  r = await gravar(PAPEIS.coordenacao, { valor: '1,00' });
  assert.equal(Number((await sql`SELECT valor FROM vybe_clientes WHERE id=10`)[0].valor), 1500);
  // Atendimento e equipe não alteram clientes; o dono altera o valor.
  assert.equal((await gravar(PAPEIS.atendimento, { segmento: 'x' })).codigo, 403);
  assert.equal((await gravar(PAPEIS.equipe, { segmento: 'x' })).codigo, 403);
  r = await gravar(PAPEIS.dono, { valor: '2000' });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  [c] = await sql`SELECT valor FROM vybe_clientes WHERE id=10`;
  assert.equal(Number(c.valor), 2000);
});

test('liga 6: hora de publicação — responsável, head do cliente, coordenação e dono gravam; os outros não', async (t) => {
  const { sql } = await banco(t);
  const post = (item) => (quem) => { const r = resposta(); return areaPecaComplemento({ method: 'POST', body: { item, publicar_hora: '10:00' }, query: {} }, r, quem, sql).then(() => r); };
  // 2101: a Bia (equipe) é a responsável; 2102: a Ana (atendimento) é head do cliente.
  assert.deepEqual(await matriz(post('2101')), { dono: 200, coordenacao: 200, atendimento: 403, equipe: 200 });
  assert.deepEqual(await matriz(post('vybe:51')), { dono: 200, coordenacao: 200, atendimento: 200, equipe: 403 });
});
