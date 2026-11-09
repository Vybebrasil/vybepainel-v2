// Comercial: rota, papéis no servidor, funil sobre o CRM (follow-up, motivo de perda, valor) e o dinheiro da agência.
// SAFE: PGlite em memória; nada envia mensagem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaComercial } from '../server/comercial-api.js';
import { areaCrm } from '../server/crm-api.js';
import { ehDono } from '../server/crm.js';
import handler from '../api/painel.js';

const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Henrique', admin: false, dono: true } }; // dono vem da sessão (server/donos.js)
const vinicius = { tipo: 'sessao', pessoa: { id: 2, nome: 'Vinícius', admin: false, dono: true } };
const atendimento = { tipo: 'sessao', pessoa: { id: 5, nome: 'Taynara', admin: false } };
const criacao = { tipo: 'sessao', pessoa: { id: 3, nome: 'Bia', admin: false } };
const admin = { tipo: 'sessao', pessoa: { id: 4, nome: 'Suporte', admin: true } };

async function banco(t, { comercial = true } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY,nome text,ativo boolean,pode_entrar boolean,monday_user_id text);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY,funcao text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY,nome text,ativo boolean); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
    INSERT INTO vybe_pessoas (id,nome,ativo,pode_entrar) VALUES (1,'Paulo Henrique',true,true),(2,'Vinícius',true,true),(3,'Bia',true,true),(4,'Suporte',true,true),(5,'Taynara',true,true);
    INSERT INTO vybe_escritorio_funcoes VALUES (5,'atendimento'),(3,'criacao');
    INSERT INTO vybe_clientes VALUES (10,'Hebravet',true),(11,'DiaLab',true),(12,'Antigo',false);`);
  await db.exec(readFileSync('migrations/2026-11-07-crm-prospeccao.sql', 'utf8'));
  if (comercial) { const m = readFileSync('migrations/2026-11-07-comercial.sql', 'utf8'); await db.exec(m); await db.exec(m); }
  return { db, sql };
}
async function chamar(sql, quem, body = null, query = {}) {
  const r = resposta(); await areaComercial({ method: body ? 'POST' : 'GET', body, query }, r, quem, () => sql); return r;
}
async function crm(sql, quem, body = null, query = {}) {
  const r = resposta(); await areaCrm({ method: body ? 'POST' : 'GET', body, query }, r, quem, () => sql); return r;
}

test('donos pelo id (Monday, sessão ou VYBE_DONOS_IDS) e administração; nunca pelo primeiro nome', () => {
  assert.equal(ehDono({ id: 3, nome: 'Vinícius Souza', monday_user_id: '68035653' }), true);
  assert.equal(ehDono({ id: 24, nome: 'EWERTON L.', monday_user_id: '68036687' }), true);
  assert.equal(ehDono({ id: 4, nome: 'Deivid', dono: true }), true);
  assert.equal(ehDono({ id: 9, nome: 'Vinícius Homônimo' }), false, 'primeiro nome não basta');
  assert.equal(ehDono({ nome: 'Bia' }), false);
  assert.equal(ehDono({ nome: 'Bia', admin: true }), true);
  assert.equal(ehDono(null), false);
});

test('rota comercial: 401 sem login, 403 sem sessão pessoal, 503 sem migração', async (t) => {
  const r = resposta(); await handler({ method: 'GET', headers: {}, query: { area: 'comercial' } }, r); assert.equal(r.codigo, 401);
  const s = resposta(); await areaComercial({ method: 'GET', query: {} }, s, { tipo: 'servico' }, () => { throw Error('não deve abrir o banco'); }); assert.equal(s.codigo, 403);
  const { sql } = await banco(t, { comercial: false });
  for (const aba of ['pacotes', 'financas', 'recebimentos']) {
    const x = await chamar(sql, paulo, null, { aba }); assert.equal(x.codigo, 503, aba); assert.match(x.body.error, /2026-11-07-comercial\.sql/);
  }
  // O funil funciona sem a migração nova (sem valor); Follow-up e valor respondem 503 explicado.
  const f = await chamar(sql, criacao, null, { aba: 'funil' }); assert.equal(f.codigo, 200); assert.equal(f.body.valor_disponivel, false);
  const c = await crm(sql, paulo, { acao: 'criar', nome: 'Loja X' }); assert.equal(c.codigo, 200);
  const v = await crm(sql, paulo, { acao: 'valor', id: c.body.id, versao: 1, valor_mensal: 100 }); assert.equal(v.codigo, 503);
});

test('dinheiro só para donos e administração, também no servidor', async (t) => {
  const { sql } = await banco(t);
  for (const aba of ['financas', 'recebimentos', 'contas', 'inadimplencia', 'fornecedores']) {
    for (const quem of [criacao, atendimento]) { const r = await chamar(sql, quem, null, { aba }); assert.equal(r.codigo, 403, aba); }
    for (const quem of [paulo, admin]) { const r = await chamar(sql, quem, null, { aba }); assert.equal(r.codigo, 200, aba + JSON.stringify(r.body)); }
  }
  for (const acao of ['pacote_salvar', 'financas_salvar', 'recebivel_salvar', 'conta_salvar', 'fornecedor_salvar']) {
    const r = await chamar(sql, atendimento, { acao, nome: 'x' }); assert.equal(r.codigo, 403, acao);
  }
  // Pacote: equipe vê preço, não custo nem margem.
  let r = await chamar(sql, paulo, { acao: 'pacote_salvar', nome: 'Social Start', tipo: 'recorrente', preco: 2000, entregas: ['12 posts', '4 reels'], horas: 20, custo_hora: 50, captacoes: 2, custo_captacao: 150 });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  r = await chamar(sql, criacao, null, { aba: 'pacotes' });
  assert.equal(r.body.pacotes[0].preco, 2000); assert.equal(r.body.pacotes[0].custo, undefined); assert.equal(r.body.pacotes[0].margem_percentual, undefined); assert.equal(r.body.pode.ver_dinheiro, false);
  r = await chamar(sql, vinicius, null, { aba: 'pacotes' });
  assert.equal(r.body.pacotes[0].custo, 1300); assert.equal(r.body.pacotes[0].margem_percentual, 35); assert.deepEqual(r.body.pacotes[0].entregas, ['12 posts', '4 reels']);
  // Creator: atendimento escreve, criação só lê.
  assert.equal((await chamar(sql, criacao, { acao: 'creator_salvar', nome: 'Ana' })).codigo, 403);
  assert.equal((await chamar(sql, atendimento, { acao: 'creator_salvar', nome: 'Ana Irecê', arroba: '@anairece', seguidores: 15000, engajamento: 4.5, nicho: 'Moda', cidade: 'Irecê' })).codigo, 200);
  r = await chamar(sql, criacao, null, { aba: 'creators' }); assert.equal(r.body.creators[0].arroba, 'anairece'); assert.deepEqual(r.body.opcoes.cidades, ['Irecê']);
});

test('funil: follow-up opcional, motivo de perda obrigatório, valor e relatório', async (t) => {
  const { sql } = await banco(t);
  let r = await chamar(sql, paulo, { acao: 'pacote_salvar', nome: 'Social', tipo: 'recorrente', preco: 1500 }); const pacote = r.body.id;
  const ids = [];
  for (const nome of ['A', 'B', 'C']) { r = await crm(sql, atendimento, { acao: 'criar', nome }); ids.push(String(r.body.id)); }
  const andar = async (id, passos) => { for (const [de, para] of passos) { const x = await crm(sql, atendimento, { acao: 'mover', id, de_etapa: de, etapa: para }); assert.equal(x.codigo, 200, `${de}→${para} ${JSON.stringify(x.body)}`); } };
  const ate = [['empresa', 'qualificacao'], ['qualificacao', 'abordagem_proposta'], ['abordagem_proposta', 'aprovada'], ['aprovada', 'contato_feito'], ['contato_feito', 'reuniao'], ['reuniao', 'proposta_comercial']];
  await andar(ids[0], [...ate, ['proposta_comercial', 'follow_up'], ['follow_up', 'ganho']]);
  await andar(ids[1], [...ate, ['proposta_comercial', 'ganho']]);
  // Perdido sem motivo não fecha; "outro" exige texto.
  r = await crm(sql, atendimento, { acao: 'mover', id: ids[2], de_etapa: 'empresa', etapa: 'perdido' }); assert.equal(r.codigo, 400); assert.match(r.body.error, /motivo/);
  r = await crm(sql, atendimento, { acao: 'mover', id: ids[2], de_etapa: 'empresa', etapa: 'perdido', motivo_perda: 'outro' }); assert.equal(r.codigo, 400);
  await andar(ids[2], [['empresa', 'qualificacao']]);
  r = await crm(sql, atendimento, { acao: 'mover', id: ids[2], de_etapa: 'qualificacao', etapa: 'perdido', motivo_perda: 'preco', motivo_texto: 'Achou caro' }); assert.equal(r.codigo, 200);
  r = await crm(sql, paulo, null, { id: ids[2] }); assert.equal(r.body.historico[0].detalhes.motivo_perda, 'preco');
  // Valor: versão confere; criação não edita.
  r = await crm(sql, paulo, null, { id: ids[0] }); const versao = r.body.oportunidade.versao;
  assert.equal((await crm(sql, criacao, { acao: 'valor', id: ids[0], versao, valor_mensal: 1500 })).codigo, 403);
  r = await crm(sql, paulo, { acao: 'valor', id: ids[0], versao, valor_mensal: 1500, valor_avulso: 300, pacote_id: pacote }); assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.equal((await crm(sql, paulo, { acao: 'valor', id: ids[0], versao, valor_mensal: 1 })).codigo, 409);
  r = await chamar(sql, criacao, null, { aba: 'funil' });
  const { resumo, produtos } = r.body;
  assert.equal(resumo.fases.find((f) => f.id === 'ganho').atual, 2);
  assert.equal(resumo.fases.find((f) => f.id === 'novo').alcancaram, 3);
  assert.equal(resumo.fases.find((f) => f.id === 'novo').conversao, 66.7);
  assert.equal(resumo.motivos_perda.find((m) => m.id === 'preco').quantidade, 1);
  assert.equal(resumo.taxa_ganho, 66.7);
  assert.equal(produtos.campeao.nome, 'Social'); assert.equal(produtos.ticket_medio_mensal, 1500);
  // O CRM antigo continua: etapa nova aparece entre Proposta comercial e Ganho.
  r = await crm(sql, criacao); assert.deepEqual(r.body.etapas.map((e) => e.id).slice(6, 9), ['proposta_comercial', 'follow_up', 'ganho']);
});

test('orçamento, finanças por cliente, recebimentos, contas, inadimplência e fornecedores', async (t) => {
  const { sql } = await banco(t);
  let r = await chamar(sql, paulo, { acao: 'pacote_salvar', nome: 'Social', tipo: 'recorrente', preco: 2000, horas: 30, custo_hora: 55 }); const social = r.body.id;
  r = await chamar(sql, paulo, { acao: 'pacote_salvar', nome: 'Ensaio', tipo: 'avulso', preco: 800 }); const ensaio = r.body.id;
  r = await chamar(sql, atendimento, { acao: 'orcamento_criar', cliente_nome: 'Padaria Sol', itens: [{ pacote_id: social }, { pacote_id: ensaio, quantidade: 2 }], desconto_percentual: 10, validade: '2026-11-22' });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  r = await chamar(sql, criacao, null, { aba: 'orcamentos', id: r.body.id });
  assert.equal(r.body.orcamento.totais.total_recorrente, 1800); assert.equal(r.body.orcamento.totais.total_avulso, 1440); assert.equal(r.body.orcamento.itens[0].nome, 'Social');
  assert.equal((await chamar(sql, atendimento, { acao: 'orcamento_criar', cliente_nome: 'X', itens: [], validade: '2026-11-22' })).codigo, 400);
  assert.equal((await chamar(sql, atendimento, { acao: 'orcamento_criar', cliente_nome: 'X', itens: [{ pacote_id: social }], validade: '2026-02-30' })).codigo, 400);

  // Finanças por cliente: custo 30 h × R$ 55 = 1650 sobre 2000 → margem 17,5% (zona crítica).
  r = await chamar(sql, paulo, { acao: 'financas_salvar', cliente_id: 10, valor_mensal: 2000, pacote_id: social, status_pagamento: 'atrasado' }); assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.equal((await chamar(sql, paulo, { acao: 'financas_salvar', cliente_id: 10, valor_mensal: 1 })).codigo, 409);
  r = await chamar(sql, admin, null, { aba: 'financas' });
  const h = r.body.clientes.find((c) => c.cliente_nome === 'Hebravet');
  assert.equal(h.margem_percentual, 17.5); assert.equal(h.zona_critica, true); assert.equal(h.status_pagamento, 'atrasado');
  assert.equal(r.body.clientes.some((c) => c.cliente_nome === 'Antigo'), false); assert.equal(r.body.resumo.criticas, 1);

  // Recebimentos (hoje fixo pela consulta do servidor: usa a data real; aqui os vencimentos são relativos).
  const { hojeNaBahia } = await import('../server/comercial.js');
  const calc = (await import('../shared/comercial-calculos.js')).default;
  const hoje = hojeNaBahia(), mes = hoje.slice(0, 7);
  r = await chamar(sql, paulo, { acao: 'recebivel_salvar', tipo: 'recorrente', cliente_id: 10, ciclo: 'mensal', valor: 2000, vencimento: calc.somarDias(hoje, -40) }); const velho = r.body.id; assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.equal((await chamar(sql, paulo, { acao: 'recebivel_salvar', tipo: 'recorrente', valor: 10, vencimento: hoje, ciclo: 'mensal' })).codigo, 400);
  r = await chamar(sql, paulo, { acao: 'recebivel_proximo', id: velho }); assert.equal(r.body.criado, true);
  r = await chamar(sql, paulo, { acao: 'recebivel_proximo', id: velho }); assert.equal(r.body.criado, false);
  r = await chamar(sql, paulo, { acao: 'recebivel_salvar', tipo: 'pontual', descricao: 'Evento', categoria: 'Evento', valor: 500, vencimento: hoje }); const pontual = r.body.id;
  r = await chamar(sql, paulo, { acao: 'recebivel_receber', id: pontual, valor_recebido: 9999, recebido_em: hoje }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, null, { aba: 'recebimentos', mes });
  assert.equal(r.codigo, 200, JSON.stringify(r.body)); assert.ok(r.body.recebiveis.find((x) => x.id === pontual).status === 'recebido');
  r = await chamar(sql, paulo, null, { aba: 'inadimplencia' });
  assert.equal(r.body.clientes[0].cliente_nome, 'Hebravet'); assert.equal(r.body.clientes[0].severidade.nivel, 'u1'); assert.equal(r.body.marcados_a_mao[0].status_pagamento, 'atrasado');

  r = await chamar(sql, paulo, { acao: 'fornecedor_salvar', nome: 'Gráfica Irecê', categoria: 'grafica', bv_percentual: 5, contato: '(74) 0000-0000' }); const forn = r.body.id; assert.equal(r.codigo, 200);
  assert.equal((await chamar(sql, paulo, { acao: 'fornecedor_salvar', nome: 'X', categoria: 'padaria' })).codigo, 400);
  r = await chamar(sql, paulo, { acao: 'conta_salvar', grupo: 'fixa', descricao: 'Aluguel', valor: 1000, vencimento: calc.somarDias(hoje, 3) }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, { acao: 'conta_salvar', grupo: 'variavel', descricao: 'Banner', fornecedor_id: forn, valor: 250, vencimento: hoje }); const banner = r.body.id;
  assert.equal((await chamar(sql, paulo, { acao: 'conta_pagar', id: banner })).codigo, 200);
  r = await chamar(sql, paulo, null, { aba: 'contas', mes });
  assert.equal(r.body.resumo.sete_dias.quantidade, 1); // a de daqui a 3 dias (a paga não entra)
  assert.equal(r.body.contas.find((c) => c.id === banner).fornecedor_nome, 'Gráfica Irecê');
  r = await chamar(sql, paulo, null, { aba: 'fornecedores' }); assert.equal(r.body.fornecedores[0].bv_percentual, 5);
  assert.equal((await chamar(sql, paulo, null, { aba: 'recebimentos', mes: '2026-13' })).codigo, 400);
});

test('funil configurável: donos adicionam e reordenam; CRM segue a ordem; padrão não sai; etapa ocupada não sai', async (t) => {
  const { sql } = await banco(t);
  const meio = (extra) => [{ id: 'contato_feito' }, { id: 'reuniao' }, ...extra, { id: 'proposta_comercial' }, { id: 'follow_up' }];
  assert.equal((await chamar(sql, atendimento, { acao: 'etapas_salvar', etapas: meio([]) })).codigo, 403);
  let r = await chamar(sql, paulo, { acao: 'etapas_salvar', etapas: meio([{ nome: 'Visita à loja' }]) }); assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const visita = r.body.etapas[2].id; assert.equal(visita, 'x_visita_a_loja');
  assert.equal((await chamar(sql, paulo, { acao: 'etapas_salvar', etapas: [{ id: 'reuniao' }] })).codigo, 400);
  r = await crm(sql, criacao); assert.deepEqual(r.body.etapas.map((e) => e.id).slice(4, 9), ['contato_feito', 'reuniao', visita, 'proposta_comercial', 'follow_up']);
  r = await crm(sql, atendimento, { acao: 'criar', nome: 'Loja Y' }); const id = String(r.body.id);
  for (const [de, para] of [['empresa', 'qualificacao'], ['qualificacao', 'abordagem_proposta'], ['abordagem_proposta', 'aprovada'], ['aprovada', 'contato_feito'], ['contato_feito', 'reuniao']])
    assert.equal((await crm(sql, atendimento, { acao: 'mover', id, de_etapa: de, etapa: para })).codigo, 200);
  assert.equal((await crm(sql, atendimento, { acao: 'mover', id, de_etapa: 'reuniao', etapa: 'proposta_comercial' })).codigo, 400);
  assert.equal((await crm(sql, atendimento, { acao: 'mover', id, de_etapa: 'reuniao', etapa: visita })).codigo, 200);
  r = await chamar(sql, criacao, null, { aba: 'funil' });
  assert.deepEqual(r.body.fases.map((f) => f.nome), ['Novo', 'Primeiro contato', 'Apresentação', 'Visita à loja', 'Proposta', 'Follow-up', 'Ganho', 'Perdido']);
  assert.equal(r.body.resumo.fases.find((f) => f.id === visita).atual, 1);
  r = await chamar(sql, paulo, { acao: 'etapas_salvar', etapas: meio([]) }); assert.equal(r.codigo, 409);
});

test('caixa e capacidade: só donos configuram; previsão vem do servidor', async (t) => {
  const { sql } = await banco(t);
  assert.equal((await chamar(sql, atendimento, { acao: 'capacidade_salvar', capacidades: { criacao: 10 } })).codigo, 403);
  assert.equal((await chamar(sql, paulo, { acao: 'capacidade_salvar', capacidades: { padaria: 10 } })).codigo, 400);
  assert.equal((await chamar(sql, paulo, { acao: 'capacidade_salvar', capacidades: { criacao: 120, producao: 30 } })).codigo, 200);
  let r = await chamar(sql, atendimento, null, { aba: 'orcamentos' });
  assert.equal(r.body.capacidade.capacidades.criacao, 120); assert.equal(r.body.capacidade.pessoas.find((p) => p.id === '5').cargo, 'atendimento');
  assert.equal((await chamar(sql, paulo, { acao: 'pacote_salvar', nome: 'P', tipo: 'avulso', preco: 1, carga: { padaria: 1 } })).codigo, 400);
  r = await chamar(sql, paulo, { acao: 'pacote_salvar', nome: 'P', tipo: 'recorrente', preco: 1000, carga: { criacao: 12, producao: 0 } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, criacao, null, { aba: 'pacotes' }); assert.deepEqual(r.body.pacotes[0].carga, { criacao: 12 });
  assert.equal((await chamar(sql, atendimento, null, { aba: 'caixa' })).codigo, 403);
  r = await chamar(sql, paulo, null, { aba: 'caixa' }); assert.equal(r.codigo, 200); assert.equal(r.body.previsao.meses.length, 4);
});
