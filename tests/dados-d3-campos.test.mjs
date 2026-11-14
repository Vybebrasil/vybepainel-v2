// SAFE: PGlite em memória. Os campos e registros novos dos quadros D3 (server/migracoes-campos.js, server/campos-d3.js):
// estrutura, gravação pelo fluxo da tela, leitura e quem pode. Nada envia WhatsApp, e-mail nem mensagem a cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { garantirMigracoesCampos, esquecerMigracoesCampos, BLOCOS_CAMPOS } from '../server/migracoes-campos.js';
import { lerComercial, escreverComercial } from '../server/comercial.js';
import { escreverCrm } from '../server/crm.js';
import { lerFinanceiro, escreverFinanceiro } from '../server/financeiro.js';
import { areaMetas, areaMinhaSala, areaPecaComplemento, nivelDoAtraso, emCampanha } from '../server/campos-d3.js';
import { usarBancoDeUso, logUsageEvent, getUsageDashboard } from '../jarvis_usage.js';

const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
// Donos pelo id do Monday (server/donos.js): Paulo e Vinícius. A Bia é da equipe.
const PAULO = { id: 1, nome: 'Paulo Martins', monday_user_id: '68035537' };
const VINI = { id: 2, nome: 'Vinícius', monday_user_id: '68035653' };
const BIA = { id: 3, nome: 'Bia' };
const sessao = (pessoa) => ({ tipo: 'sessao', pessoa });

async function banco(t) {
  esquecerMigracoesCampos();
  const { db, sql } = conexao(); t.after(() => { db.close(); esquecerMigracoesCampos(); });
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, pode_entrar boolean DEFAULT true, admin boolean DEFAULT false, monday_user_id text);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY, funcao text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
    CREATE TABLE vybe_notificacoes (id bigserial PRIMARY KEY, pessoa_id bigint, texto text, canal text, conteudo_id bigint, lida_em timestamptz, criada_em timestamptz DEFAULT now());
    INSERT INTO vybe_pessoas (id, nome, monday_user_id) VALUES (1,'Paulo Martins','68035537'),(2,'Vinícius','68035653'),(3,'Bia',NULL),(4,'Ewerton','68036687');
    INSERT INTO vybe_clientes (id, nome) VALUES (10,'Hebravet'),(11,'Brussolo');`);
  await db.exec(readFileSync('migrations/2026-11-07-crm-prospeccao.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-07-comercial.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-07-carteira.sql', 'utf8'));
  return { db, sql };
}

test('migração dos campos: aditiva, idempotente, espera a tabela base e bate com o .sql', async (t) => {
  const { sql } = await banco(t);
  await garantirMigracoesCampos(sql);
  esquecerMigracoesCampos(); await garantirMigracoesCampos(sql); // segunda vez: nada quebra
  const tabelas = (await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`).map((r) => r.table_name);
  for (const t2 of ['vybe_financeiro_avisos', 'vybe_comercial_recebivel_forma', 'vybe_creator_campanhas', 'vybe_sala_preferencias', 'vybe_sala_focos', 'vybe_peca_complemento'])
    assert.ok(tabelas.includes(t2), t2);
  const col = async (tab, c) => (await sql`SELECT 1 FROM information_schema.columns WHERE table_name=${tab} AND column_name=${c}`).length === 1;
  assert.ok(await col('vybe_comercial_orcamentos', 'aprovado_em'));
  assert.ok(await col('vybe_crm_oportunidades', 'origem'));
  assert.equal(tabelas.includes('ai_usage_events'), false, 'sem a tabela de uso, o bloco da IA espera (não cria a tabela dos outros)');
  // Só ADD/CREATE IF NOT EXISTS: nada de DROP, ALTER TYPE nem UPDATE.
  const todos = BLOCOS_CAMPOS.flatMap((b) => b.comandos).join('\n');
  assert.doesNotMatch(todos, /\bDROP\b|\bUPDATE\b|\bDELETE\b|ALTER COLUMN|TYPE /i);
  for (const c of BLOCOS_CAMPOS.flatMap((b) => b.comandos)) assert.match(c, /IF NOT EXISTS/, c.slice(0, 60));
  const arquivo = readFileSync('migrations/2026-11-14-campos-d3.sql', 'utf8');
  for (const b of BLOCOS_CAMPOS) assert.ok(arquivo.includes('-- ' + b.nome), 'o .sql registra o bloco ' + b.nome);
});

test('1 · orçamento: aprovado_em grava ao virar aprovado; o de antes sai do atualizado_em', async (t) => {
  const { db, sql } = await banco(t);
  const [p] = await sql`INSERT INTO vybe_comercial_pacotes (nome,tipo,preco,criado_por) VALUES ('Redes','recorrente',3000,1) RETURNING id::text`;
  const a = await escreverComercial(sql, PAULO, { acao: 'orcamento_criar', cliente_nome: 'Alpha', validade: '2026-12-31', itens: [{ pacote_id: p.id }] });
  const b = await escreverComercial(sql, PAULO, { acao: 'orcamento_criar', cliente_nome: 'Beta', validade: '2026-12-31', itens: [{ pacote_id: p.id }] });
  // Um aceito de antes da migração: sem aprovado_em, com atualizado_em de setembro.
  await db.exec(`INSERT INTO vybe_comercial_orcamentos (cliente_nome,itens,validade,status,criado_por,criado_em,atualizado_em)
    VALUES ('Antigo','[{"pacote_id":"1","nome":"Redes","tipo":"recorrente","preco":3000,"quantidade":1}]','2026-12-31','aceito',1,'2026-08-10T12:00:00Z','2026-09-20T15:00:00Z')`);
  await escreverComercial(sql, PAULO, { acao: 'orcamento_status', id: a.id, status: 'enviado' });
  await escreverComercial(sql, PAULO, { acao: 'orcamento_status', id: a.id, status: 'aceito' });
  const [g] = await sql`SELECT aprovado_em, aprovado_por::text FROM vybe_comercial_orcamentos WHERE id=${a.id}`;
  assert.ok(g.aprovado_em, 'gravou quando virou aprovado'); assert.equal(g.aprovado_por, '1');
  // Aceito de novo não muda a data; sair de aprovado limpa.
  await escreverComercial(sql, PAULO, { acao: 'orcamento_status', id: a.id, status: 'aceito' });
  const [g2] = await sql`SELECT aprovado_em FROM vybe_comercial_orcamentos WHERE id=${a.id}`;
  assert.equal(new Date(g2.aprovado_em).getTime(), new Date(g.aprovado_em).getTime());
  await escreverComercial(sql, PAULO, { acao: 'orcamento_status', id: b.id, status: 'aceito' });
  await escreverComercial(sql, PAULO, { acao: 'orcamento_status', id: b.id, status: 'recusado' });
  const r = await lerComercial(sql, PAULO, { aba: 'orcamentos' });
  const por = Object.fromEntries(r.orcamentos.map((o) => [o.cliente_nome, o]));
  assert.equal(por.Alpha.aprovado_fonte, 'registro'); assert.match(por.Alpha.aprovado_dia, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(por.Beta.aprovado_em, null, 'recusado não tem aprovação');
  assert.equal(por.Antigo.aprovado_dia, '2026-09-20'); assert.equal(por.Antigo.aprovado_fonte, 'atualizado_em', 'o passado vem do atualizado_em, sem reescrever o banco');
  const [antigo] = await sql`SELECT aprovado_em FROM vybe_comercial_orcamentos WHERE cliente_nome='Antigo'`;
  assert.equal(antigo.aprovado_em, null, 'a leitura não grava nada no orçamento antigo');
});

test('2 · inadimplência: aviso aos sócios é registro + sino dos outros donos, só dono avisa', async (t) => {
  const { sql } = await banco(t);
  assert.equal(nivelDoAtraso(4), 3); assert.equal(nivelDoAtraso(12), 10); assert.equal(nivelDoAtraso(31), 30);
  await assert.rejects(escreverComercial(sql, BIA, { acao: 'inadimplencia_avisar', cliente_id: '10', cliente_nome: 'Hebravet', atraso_dias: 18 }), /só dos donos/);
  const r = await escreverComercial(sql, PAULO, { acao: 'inadimplencia_avisar', cliente_id: '10', cliente_nome: 'Hebravet', atraso_dias: 18 });
  assert.equal(r.aviso.nivel, 10); assert.deepEqual(r.aviso.para.sort(), ['Ewerton', 'Vinícius']); assert.equal(r.no_sino, 2);
  const sino = await sql`SELECT pessoa_id::text, texto FROM vybe_notificacoes ORDER BY pessoa_id`;
  assert.deepEqual(sino.map((n) => n.pessoa_id), ['2', '4'], 'o sino de quem não avisou; a Bia (equipe) não recebe');
  assert.match(sino[0].texto, /Paulo avisou os sócios: Hebravet com 18 dias/);
  await escreverComercial(sql, VINI, { acao: 'inadimplencia_avisar', cliente_nome: 'Sem cadastro', atraso_dias: 40 });
  const lida = await lerComercial(sql, PAULO, { aba: 'inadimplencia' });
  assert.equal(lida.avisos.disponivel, true);
  assert.equal(lida.avisos.ultimo_por_cliente['id:10'].quem_nome, 'Paulo Martins');
  assert.equal(lida.avisos.ultimo_por_cliente['nome:Sem cadastro'].nivel, 30);
  await assert.rejects(escreverComercial(sql, PAULO, { acao: 'inadimplencia_avisar', cliente_nome: 'X', nivel: 7 }), /3, 10 ou 30/);
});

test('3 · recebimentos: forma de pagamento editável pelo dono, também no lançamento do Finanças', async (t) => {
  const { sql } = await banco(t);
  const rec = await escreverComercial(sql, PAULO, { acao: 'recebivel_salvar', tipo: 'recorrente', cliente_id: '10', ciclo: 'mensal', valor: 4200, vencimento: '2026-11-10' }, { hoje: '2026-11-14' });
  await escreverComercial(sql, PAULO, { acao: 'recebivel_forma', id: rec.id, forma: 'boleto' });
  await escreverComercial(sql, PAULO, { acao: 'recebivel_forma', id: 'fin:abc-1', forma: 'pix' }); // o do Finanças é só leitura, a forma é nossa
  await assert.rejects(escreverComercial(sql, PAULO, { acao: 'recebivel_forma', id: rec.id, forma: 'cheque' }), /Forma/);
  await assert.rejects(escreverComercial(sql, BIA, { acao: 'recebivel_forma', id: rec.id, forma: 'pix' }), /só dos donos/);
  const r = await lerComercial(sql, PAULO, { aba: 'recebimentos', mes: '2026-11' }, { hoje: '2026-11-14' });
  assert.equal(r.recebiveis.find((x) => x.id === rec.id).forma, 'boleto');
  assert.deepEqual(r.formas, ['pix', 'boleto', 'cartao', 'transferencia']);
  await escreverComercial(sql, PAULO, { acao: 'recebivel_forma', id: rec.id, forma: '' });
  const r2 = await lerComercial(sql, PAULO, { aba: 'recebimentos', mes: '2026-11' }, { hoje: '2026-11-14' });
  assert.equal(r2.recebiveis.find((x) => x.id === rec.id).forma, null, 'forma vazia tira');
});

test('4 · cartão: vencimento da fatura por cartão, só dono, e a fatura sai com a data', async (t) => {
  const { sql } = await banco(t);
  const dono = sessao(PAULO);
  await escreverFinanceiro(sql, dono, { acao: 'cartao_salvar', item: { cartao: 'Cartão da agência', fatura: '2026-11', data: '2026-11-03', descricao: 'Adobe', valor: 300, categoria: 'software' } });
  await escreverFinanceiro(sql, dono, { acao: 'cartao_vencimento', cartao: 'Cartão da agência', dia: 20 });
  await assert.rejects(escreverFinanceiro(sql, dono, { acao: 'cartao_vencimento', cartao: 'Cartão da agência', dia: 40 }), /1 a 31/);
  await assert.rejects(escreverFinanceiro(sql, sessao(BIA), { acao: 'cartao_vencimento', cartao: 'Cartão da agência', dia: 5 }), /só dos donos/);
  const d = await lerFinanceiro(sql, dono, {});
  assert.deepEqual(d.cartao.vencimentos, { 'Cartão da agência': 20 });
  assert.equal(d.cartao.faturas.find((f) => f.fatura === '2026-11').vence, '2026-11-20');
  await escreverFinanceiro(sql, dono, { acao: 'cartao_vencimento', cartao: 'Cartão da agência', dia: 31 });
  await escreverFinanceiro(sql, dono, { acao: 'cartao_salvar', item: { cartao: 'Cartão da agência', fatura: '2027-02', data: '2027-02-03', descricao: 'Canva', valor: 50, categoria: 'software' } });
  const d2 = await lerFinanceiro(sql, dono, {});
  assert.equal(d2.cartao.faturas.find((f) => f.fatura === '2027-02').vence, '2027-02-28', 'dia 31 em fevereiro = último dia');
});

test('5 · IA e custos: agente e cliente nas gravações novas e o gasto por agente e por cliente', async (t) => {
  const { db, sql } = conexao(); t.after(() => { usarBancoDeUso(null); db.close(); });
  usarBancoDeUso(sql);
  await logUsageEvent({ provider: 'claude', model: 'claude-haiku', input_tokens: 1_000_000, output_tokens: 0, agente: 'Copy', cliente: 'Brussolo', profile_name: 'Paulo' });
  await logUsageEvent({ provider: 'claude', model: 'claude-haiku', input_tokens: 500_000, output_tokens: 0, agente: 'Copy', cliente: 'Hebravet' });
  await logUsageEvent({ provider: 'gpt', model: 'gpt-mini', input_tokens: 1000, output_tokens: 1000 }); // sem agente: fica fora dos recortes novos
  const d = await getUsageDashboard(30);
  assert.equal(d.agents.length, 1); assert.equal(d.agents[0].agente, 'Copy'); assert.equal(d.agents[0].calls, 2);
  assert.deepEqual(d.clients.map((c) => c.cliente), ['Brussolo', 'Hebravet'], 'do maior gasto para o menor');
  assert.ok(Number(d.clients[0].cost_brl) > Number(d.clients[1].cost_brl));
  assert.equal(d.overview.calls, 3, 'o total continua contando tudo');
});

test('6 · creators: campanha com creator, cliente, período e status; "em campanha" hoje', async (t) => {
  const { sql } = await banco(t);
  const c1 = await escreverComercial(sql, PAULO, { acao: 'creator_salvar', nome: 'Duda', seguidores: 12000 });
  const c2 = await escreverComercial(sql, PAULO, { acao: 'creator_salvar', nome: 'Lara', seguidores: 9000 });
  const k = await escreverComercial(sql, PAULO, { acao: 'creator_campanha_salvar', creator_id: c1.id, cliente_id: '10', inicio: '2026-11-01', fim: '2026-11-30', status: 'ativa' }, { hoje: '2026-11-14' });
  await escreverComercial(sql, PAULO, { acao: 'creator_campanha_salvar', creator_id: c2.id, cliente_nome: 'Brussolo', inicio: '2026-12-01', status: 'planejada' });
  await assert.rejects(escreverComercial(sql, PAULO, { acao: 'creator_campanha_salvar', creator_id: c2.id, cliente_nome: 'X', inicio: '2026-12-10', fim: '2026-12-01' }), /fim vem depois/);
  await assert.rejects(escreverComercial(sql, BIA, { acao: 'creator_campanha_salvar', creator_id: c2.id, cliente_nome: 'X', inicio: '2026-12-10' }), /editam aqui/);
  const r = await lerComercial(sql, BIA, { aba: 'creators' }, { hoje: '2026-11-14' });
  const por = Object.fromEntries(r.creators.map((c) => [c.nome, c]));
  assert.equal(por.Duda.em_campanha, true); assert.equal(por.Duda.campanhas[0].cliente_nome, 'Hebravet');
  assert.equal(por.Lara.em_campanha, false, 'planejada para dezembro ainda não está em campanha');
  await escreverComercial(sql, PAULO, { acao: 'creator_campanha_status', id: k.id, status: 'encerrada' });
  const r2 = await lerComercial(sql, PAULO, { aba: 'creators' }, { hoje: '2026-11-14' });
  assert.equal(r2.creators.find((c) => c.nome === 'Duda').em_campanha, false);
  assert.equal(emCampanha({ status: 'planejada', inicio: '2026-11-01', fim: null }, '2026-11-14'), true);
});

test('7 · CRM: origem gravada na criação (manual, sdr) e lida nas antigas pelo legado/histórico', async (t) => {
  const { db, sql } = await banco(t);
  // Uma antiga, de antes da coluna: importada pelo SDR (histórico 'importacao').
  await db.exec(`INSERT INTO vybe_crm_oportunidades (id, chave_empresa, nome, etapa, criado_por) VALUES (900, 'nome:antiga', 'Antiga', 'abordagem_proposta', 1);
    INSERT INTO vybe_crm_historico (oportunidade_id, quem, quem_nome, para_etapa, tipo) VALUES (900, 1, 'Paulo', 'abordagem_proposta', 'importacao');
    SELECT setval(pg_get_serial_sequence('vybe_crm_oportunidades','id'), 1000);`);
  await escreverCrm(sql, PAULO, { acao: 'criar', nome: 'Loja Manual' });
  await escreverCrm(sql, PAULO, { acao: 'importar', propostas: [{ nome: 'Empresa do SDR', setor: 'sdr' }] });
  const gravadas = Object.fromEntries((await sql`SELECT nome, origem FROM vybe_crm_oportunidades`).map((o) => [o.nome, o.origem]));
  assert.equal(gravadas['Loja Manual'], 'manual'); assert.equal(gravadas['Empresa do SDR'], 'sdr'); assert.equal(gravadas.Antiga, null, 'a antiga não é reescrita');
  const f = await lerComercial(sql, PAULO, { aba: 'funil' }, { hoje: '2026-11-14' });
  const por = Object.fromEntries(f.oportunidades.map((o) => [o.nome, o.origem_tipo]));
  assert.deepEqual(por, { 'Loja Manual': 'manual', 'Empresa do SDR': 'sdr', Antiga: 'sdr' });
});

test('8 · Minha sala: cor e foco por pessoa, guardados no servidor; visita vê só a cor e se está em foco', async (t) => {
  const { sql } = await banco(t);
  const chamar = async (quem, body = null, query = {}) => { const r = resposta(); await areaMinhaSala({ method: body ? 'POST' : 'GET', body, query }, r, quem, sql); return r; };
  const vazio = await chamar(sessao(BIA));
  assert.equal(vazio.codigo, 200); assert.equal(vazio.body.cor, null); assert.equal(vazio.body.foco, null);
  assert.equal((await chamar(sessao(BIA), { acao: 'cor', cor: 'azul' })).codigo, 400);
  assert.equal((await chamar(sessao(BIA), { acao: 'cor', cor: '#3A7BFF' })).body.cor, '#3a7bff');
  const f1 = await chamar(sessao(BIA), { acao: 'foco_iniciar', item: '12345', rotulo: 'Card · Dia do cliente' });
  assert.ok(f1.body.foco.inicio); assert.equal(f1.body.foco.rotulo, 'Card · Dia do cliente');
  await chamar(sessao(BIA), { acao: 'foco_iniciar', item: '999' }); // começar outro fecha o anterior (um aberto por pessoa)
  const [{ abertos }] = await sql`SELECT COUNT(*) FILTER (WHERE fim IS NULL)::int AS abertos FROM vybe_sala_focos WHERE pessoa_id=3`;
  assert.equal(abertos, 1);
  const visita = await chamar(sessao(PAULO), null, { pessoa: '3' });
  assert.equal(visita.body.minha, false); assert.equal(visita.body.cor, '#3a7bff'); assert.ok(visita.body.foco.inicio); assert.equal(visita.body.foco.item, undefined);
  const parou = await chamar(sessao(BIA), { acao: 'foco_parar' });
  assert.equal(parou.body.foco, null); assert.equal(parou.body.hoje.focos, 2);
  assert.equal((await chamar({ tipo: 'servico' })).codigo, 403);
});

test('9 · peça: hora de publicação do nosso lado, pelo id da peça', async (t) => {
  const { sql } = await banco(t);
  const chamar = async (body = null, query = {}) => { const r = resposta(); await areaPecaComplemento({ method: body ? 'POST' : 'GET', body, query }, r, sessao(BIA), sql); return r; };
  assert.equal((await chamar({ item: '2101', publicar_hora: '10:00' })).codigo, 200);
  assert.equal((await chamar({ item: 'vybe:77', publicar_hora: '18:30' })).codigo, 200);
  assert.equal((await chamar({ item: '2101', publicar_hora: '25:00' })).codigo, 400);
  assert.equal((await chamar({ item: 'drop table', publicar_hora: '10:00' })).codigo, 400);
  assert.deepEqual((await chamar(null, { itens: '2101,vybe:77,555' })).body.horas, { 2101: '10:00', 'vybe:77': '18:30' });
  await chamar({ item: '2101', publicar_hora: '' });
  assert.deepEqual((await chamar()).body.horas, { 'vybe:77': '18:30' }, 'hora vazia tira');
});

test('10 · metas: nota da carteira e acerto dos agentes em vybe_carteira_config, só dono edita', async (t) => {
  const { sql } = await banco(t);
  const chamar = async (quem, body = null) => { const r = resposta(); await areaMetas({ method: body ? 'POST' : 'GET', body, query: {} }, r, quem, sql); return r; };
  const antes = await chamar(sessao(BIA));
  assert.deepEqual([antes.body.carteira_nota, antes.body.agentes_acerto, antes.body.pode_editar], [null, null, false], 'sem meta gravada, nada inventado');
  assert.equal((await chamar(sessao(BIA), { carteira_nota: 70 })).codigo, 403);
  assert.equal((await chamar(sessao(PAULO), { carteira_nota: 170 })).codigo, 400);
  const ok = await chamar(sessao(PAULO), { carteira_nota: 70, agentes_acerto: 90 });
  assert.equal(ok.codigo, 200); assert.equal(ok.body.carteira_nota, 70); assert.equal(ok.body.agentes_acerto, 90);
  // A meta dos agentes é a mesma chave de server/series-historicas.js (meta_acerto_agentes { meta }).
  const [l] = await sql`SELECT valor FROM vybe_carteira_config WHERE chave='meta_acerto_agentes'`;
  assert.equal(l.valor.meta, 90);
  const so = await chamar(sessao(VINI), { agentes_acerto: 85 });
  assert.equal(so.body.carteira_nota, 70, 'mudar uma meta não apaga a outra'); assert.equal(so.body.agentes_acerto, 85);
});
