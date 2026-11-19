// Meta por pessoa no Comercial (prancha V2-R-Comercial-Metas, 19/11/2026). SAFE: funções puras e PGlite em memória;
// nada envia mensagem nem toca banco real. Confere a conta da pessoa, o servidor com e sem a tabela nova, a migração
// rodando duas vezes, a regra de quem edita (só donos) e o dinheiro só para dono.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import calc from '../shared/comercial-calculos.js';
import { areaComercial } from '../server/comercial-api.js';
import { areaCrm } from '../server/crm-api.js';
import { hojeNaBahia } from '../server/comercial.js';

const MIGRACAO = 'migrations/2026-11-19-comercial-metas-pessoa.sql';

test('progressoPorPessoa: a regra da corrida (quem fechou), leads que a pessoa cadastrou e o formulário fora', () => {
  const p = calc.periodo('2026-11');
  const ops = [
    { etapa: 'ganho', criado_dia: '2026-11-02', ganho_dia: '2026-11-03', valor_mensal: 1500, valor_avulso: 300, responsavel_nome: 'Paulo Martins', criado_por_nome: 'Paulo Martins' },
    { etapa: 'ganho', criado_dia: '2026-11-04', ganho_dia: '2026-11-20', valor_mensal: 2000, responsavel_nome: '', criado_por_nome: 'Vinícius' },
    { etapa: 'empresa', criado_dia: '2026-11-05', criado_por_nome: 'paulo martins ' },
    { etapa: 'empresa', criado_dia: '2026-11-06', criado_por_nome: 'Paulo Martins', origem: 'formulario' },
    { etapa: 'ganho', criado_dia: '2026-10-01', ganho_dia: '2026-10-10', valor_mensal: 900, responsavel_nome: 'Paulo Martins' },
  ];
  const [paulo, vini, ninguem] = calc.progressoPorPessoa([{ pessoa_id: 1, nome: 'Paulo Martins', negocios: 2, leads: 4, mrr: 3000 }, { pessoa_id: '2', nome: 'Vinicius', negocios: 1 }, { pessoa_id: 3, nome: 'Ewerton' }], ops, p);
  assert.deepEqual(paulo.realizado, { negocios: 1, mrr: 1500, avulso: 300, leads: 2 });
  const por = Object.fromEntries(paulo.progresso.map((x) => [x.id, x]));
  assert.equal(por.negocios.percentual, 50); assert.equal(por.negocios.falta, 1); assert.equal(por.mrr.falta, 1500); assert.equal(por.leads.percentual, 50); assert.equal(por.avulso.meta, 0);
  assert.equal(vini.pessoa_id, '2'); assert.equal(vini.realizado.negocios, 1, 'sem responsável conta quem cadastrou, sem acento no nome');
  assert.equal(ninguem.progresso.every((x) => x.meta === 0), true);
  assert.deepEqual(calc.progressoPorPessoa(null, ops, p), []);
  assert.deepEqual(calc.progressoPorPessoa([{ nome: 'Sem id' }, { pessoa_id: 9, nome: ' ' }], ops, p), []);
});

// ---------- Servidor (PGlite) ----------
const resposta = () => ({ codigo: 0, body: null, cab: {}, setHeader(k, v) { this.cab[k.toLowerCase()] = v; }, status(n) { this.codigo = n; return this; },
  json(d) { this.body = d; return this; }, send() { return this; }, end() { return this; } });
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Henrique', admin: false, dono: true } };
const atendimento = { tipo: 'sessao', pessoa: { id: 5, nome: 'Taynara', admin: false } };
async function banco(t, { tabelaNova = false } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY,nome text,ativo boolean,pode_entrar boolean,monday_user_id text);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY,funcao text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY,nome text,ativo boolean); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
    INSERT INTO vybe_pessoas (id,nome,ativo,pode_entrar) VALUES (1,'Paulo Henrique',true,true),(3,'Bia',true,true),(5,'Taynara',true,true),(7,'Saiu',false,false);
    INSERT INTO vybe_escritorio_funcoes VALUES (5,'atendimento'),(3,'criacao');`);
  await db.exec(readFileSync('migrations/2026-11-07-crm-prospeccao.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-07-comercial.sql', 'utf8'));
  await db.exec(`CREATE TABLE IF NOT EXISTS vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL,
    atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id))`);
  if (tabelaNova) { await db.exec(readFileSync(MIGRACAO, 'utf8')); await db.exec(readFileSync(MIGRACAO, 'utf8')); } // idempotente: duas vezes
  return { db, sql };
}
const chamar = async (sql, quem, body = null, query = {}) => { const r = resposta(); await areaComercial({ method: body ? 'POST' : 'GET', body, query }, r, quem, () => sql); return r; };
const crm = async (sql, quem, body = null, query = {}) => { const r = resposta(); await areaCrm({ method: body ? 'POST' : 'GET', body, query }, r, quem, () => sql); return r; };
const ATE_GANHO = [['empresa', 'qualificacao'], ['qualificacao', 'abordagem_proposta'], ['abordagem_proposta', 'aprovada'], ['aprovada', 'contato_feito'], ['contato_feito', 'reuniao'], ['reuniao', 'proposta_comercial'], ['proposta_comercial', 'ganho']];
async function fechar(sql, nome, { mensal = 0, responsavel = null } = {}) {
  const c = await crm(sql, atendimento, { acao: 'criar', nome }); const id = String(c.body.id);
  for (const [de, para] of ATE_GANHO) assert.equal((await crm(sql, atendimento, { acao: 'mover', id, de_etapa: de, etapa: para })).codigo, 200);
  let o = (await crm(sql, paulo, null, { id })).body.oportunidade;
  assert.equal((await crm(sql, paulo, { acao: 'valor', id, versao: o.versao, valor_mensal: mensal, valor_avulso: 0 })).codigo, 200);
  if (responsavel) { o = (await crm(sql, paulo, null, { id })).body.oportunidade; assert.equal((await crm(sql, paulo, { acao: 'atualizar', id, versao: o.versao, responsavel })).codigo, 200); }
  return id;
}

test('sem a tabela nova: só a meta da agência; a meta por pessoa avisa e salvar responde 503 explicado', async (t) => {
  const { sql } = await banco(t);
  const mes = hojeNaBahia().slice(0, 7);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_salvar', mes, metas: { negocios: 3 } })).codigo, 200, 'a meta da agência segue funcionando');
  const f = await chamar(sql, paulo, null, { aba: 'funil', mes });
  assert.equal(f.codigo, 200, JSON.stringify(f.body));
  assert.equal(f.body.mes.metas_pessoa.disponivel, false);
  assert.match(f.body.mes.metas_pessoa.aviso, /por enquanto vale a meta da agência/);
  assert.deepEqual(f.body.mes.metas_pessoa.linhas, []);
  assert.equal(f.body.mes.metas_pessoa.pessoas, undefined);
  assert.equal(f.body.mes.progresso.find((x) => x.id === 'negocios').meta, 3);
  const s = await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes, pessoas: [{ pessoa_id: 5, metas: { negocios: 2 } }] });
  assert.equal(s.codigo, 503); assert.match(s.body.error, /meta por pessoa ainda está sendo ligada/);
  assert.doesNotMatch(JSON.stringify([f.body, s.body]), /\.sql/);
});

test('com a tabela: só donos editam, a corrida traz a meta de cada pessoa e quem não é dono não vê reais', async (t) => {
  const { sql, db } = await banco(t, { tabelaNova: true });
  const hoje = hojeNaBahia(), mes = hoje.slice(0, 7);
  assert.equal((await chamar(sql, atendimento, { acao: 'metas_pessoa_salvar', mes, pessoas: [{ pessoa_id: 5, metas: { negocios: 2 } }] })).codigo, 403);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes: '2026-13', pessoas: [{ pessoa_id: 5, metas: {} }] })).codigo, 400);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes, pessoas: [] })).codigo, 400);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes, pessoas: [{ pessoa_id: 'x; drop', metas: {} }] })).codigo, 400);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes, pessoas: [{ pessoa_id: 5, metas: { negocios: 1.5 } }] })).codigo, 400);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes, pessoas: [{ pessoa_id: 999, metas: { negocios: 1 } }] })).codigo, 404);
  let r = await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes, aplicar: 'resto_do_ano', pessoas: [{ pessoa_id: 5, metas: { negocios: 2, leads: 4, mrr: 3000 } }, { pessoa_id: 3, metas: { negocios: 1 } }] });
  assert.equal(r.codigo, 200, JSON.stringify(r.body)); assert.equal(r.body.meses.at(-1), mes.slice(0, 4) + '-12'); assert.equal(r.body.pessoas, 2);
  const linhas = await db.query('SELECT count(*)::int AS n FROM vybe_comercial_metas_pessoa');
  assert.equal(linhas.rows[0].n, 2 * r.body.meses.length);
  await fechar(sql, 'Loja da Taynara', { mensal: 2000, responsavel: 5 });

  const dono = (await chamar(sql, paulo, null, { aba: 'funil', mes, periodo: 'mensal' })).body.mes;
  assert.equal(dono.metas_pessoa.disponivel, true); assert.equal(dono.metas_pessoa.aviso, '');
  const tay = dono.metas_pessoa.linhas.find((x) => x.nome === 'Taynara'), bia = dono.metas_pessoa.linhas.find((x) => x.nome === 'Bia');
  assert.ok(tay && bia);
  const pt = Object.fromEntries(tay.progresso.map((x) => [x.id, x]));
  assert.equal(pt.negocios.realizado, 1); assert.equal(pt.negocios.meta, 2); assert.equal(pt.mrr.realizado, 2000); assert.equal(pt.mrr.falta, 1000);
  assert.deepEqual(dono.metas_pessoa.do_mes['5'], { mrr: 3000, avulso: 0, negocios: 2, leads: 4 });
  assert.deepEqual(dono.metas_pessoa.pessoas.map((x) => x.nome), ['Bia', 'Paulo Henrique', 'Taynara'], 'só a equipe ativa que entra no painel');
  // Anual soma os meses.
  const ano = (await chamar(sql, paulo, null, { aba: 'funil', mes, periodo: 'anual' })).body.mes;
  assert.equal(ano.metas_pessoa.linhas.find((x) => x.nome === 'Taynara').progresso.find((x) => x.id === 'negocios').meta, 2 * r.body.meses.length);

  // Quem não é dono: as quantidades e a posição, sem reais, sem a lista da equipe e sem as metas do mês para editar.
  const outro = (await chamar(sql, atendimento, null, { aba: 'funil', mes })).body.mes;
  const t2 = outro.metas_pessoa.linhas.find((x) => x.nome === 'Taynara');
  assert.ok(t2.progresso.every((x) => x.tipo !== 'dinheiro')); assert.equal(t2.realizado.mrr, undefined);
  assert.equal(outro.metas_pessoa.pessoas, undefined); assert.equal(outro.metas_pessoa.do_mes, undefined);
  assert.doesNotMatch(JSON.stringify(outro.metas_pessoa), /3000|2000/);

  // Meta zerada apaga a linha da pessoa naquele mês.
  r = await chamar(sql, paulo, { acao: 'metas_pessoa_salvar', mes, pessoas: [{ pessoa_id: 3, metas: { negocios: '', leads: 0 } }] });
  assert.equal(r.codigo, 200);
  const depois = (await chamar(sql, paulo, null, { aba: 'funil', mes })).body.mes;
  assert.equal(depois.metas_pessoa.linhas.some((x) => x.nome === 'Bia'), false);
});

test('a migração é aditiva e idempotente: só cria (IF NOT EXISTS), nada de DROP, DELETE, UPDATE ou ALTER em tabela existente', () => {
  const s = readFileSync(MIGRACAO, 'utf8');

  const sem = s.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.match(sem, /CREATE TABLE IF NOT EXISTS vybe_comercial_metas_pessoa/);
  assert.match(sem, /CREATE INDEX IF NOT EXISTS/);
  assert.match(sem, /PRIMARY KEY \(mes, pessoa_id\)/);
  assert.doesNotMatch(sem, /^\s*(DROP|DELETE|UPDATE|TRUNCATE|ALTER|INSERT)\b/im, 'nenhum comando que mexa no que existe');
});
