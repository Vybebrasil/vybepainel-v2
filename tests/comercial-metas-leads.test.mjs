// Comercial (08/11/2026): metas do mês, corrida comercial, KPIs × mês anterior, séries de 6 meses e o formulário
// público de captura de leads. SAFE: funções puras e PGlite em memória; nada envia mensagem nem toca banco real.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import calc from '../shared/comercial-calculos.js';
import { areaComercial } from '../server/comercial-api.js';
import { areaCrm } from '../server/crm-api.js';
import { hojeNaBahia } from '../server/comercial.js';
import { paginaFormularioLeads, esquecerLimites, LIMITE_IP_MINUTO } from '../server/comercial-leads.js';
import handler from '../api/painel.js';

// ---------- Cálculos ----------
test('metas: validação, soma do ano e progresso com barra limitada a 100%', () => {
  assert.deepEqual(calc.validarMetas({ mrr: '5000.456', avulso: '', negocios: 4, leads: '30' }), { mrr: 5000.46, avulso: 0, negocios: 4, leads: 30 });
  assert.throws(() => calc.validarMetas({ negocios: 1.5 }), /inteiro/);
  assert.throws(() => calc.validarMetas({ mrr: -1 }), /inválida/);
  assert.throws(() => calc.validarMetas({ leads: 'abc' }), /inválida/);
  assert.throws(() => calc.validarMetas(null), /inválidas/);
  const porMes = { '2026-10': { mrr: 1000.1, leads: 10 }, '2026-11': { mrr: 2000.2, negocios: 2, leads: 20 }, '2025-11': { mrr: 99 }, 'lixo': { mrr: 5 }, '2026-12': {} };
  const nov = calc.metasDoPeriodo(porMes, calc.periodo('2026-11'));
  assert.equal(nov.mrr, 2000.2); assert.equal(nov.leads, 20); assert.equal(nov.definida, true);
  const ano = calc.metasDoPeriodo(porMes, calc.periodo('2026-11', 'anual'));
  assert.equal(ano.mrr, 3000.3); assert.equal(ano.leads, 30); assert.equal(ano.negocios, 2); assert.equal(ano.meses_com_meta, 2);
  assert.equal(calc.metasDoPeriodo(null, calc.periodo('2026-11')).definida, false);
  const prog = calc.progressoMetas({ mrr: 2000, avulso: 0, negocios: 2, leads: 20 }, { mrr: 3000, avulso: 500, negocios: 1, leads: 5 });
  const por = Object.fromEntries(prog.map((p) => [p.id, p]));
  assert.equal(por.mrr.percentual, 150); assert.equal(por.mrr.barra, 100); assert.equal(por.mrr.batida, true); assert.equal(por.mrr.falta, 0);
  assert.equal(por.avulso.percentual, null); assert.equal(por.avulso.falta, null);
  assert.equal(por.negocios.percentual, 50); assert.equal(por.negocios.falta, 1);
  assert.equal(por.leads.percentual, 25); assert.equal(por.leads.batida, false);
});

const OPS = [
  { id: '1', nome: 'A', etapa: 'ganho', criado_dia: '2026-10-05', ganho_dia: '2026-11-03', valor_mensal: 1500, valor_avulso: 300, responsavel_nome: 'Taynara', criado_por_nome: 'Paulo' },
  { id: '2', nome: 'B', etapa: 'ganho', criado_dia: '2026-11-01', ganho_dia: '2026-11-20', valor_mensal: 2000, responsavel_nome: '', criado_por_nome: 'Vinícius' },
  { id: '3', nome: 'C', etapa: 'ganho', criado_dia: '2026-11-02', ganho_dia: '2026-11-21', valor_mensal: 0, valor_avulso: 800, responsavel_nome: 'taynara ', criado_por_nome: 'Paulo' },
  { id: '4', nome: 'D', etapa: 'ganho', criado_dia: '2026-11-02', ganho_dia: '2026-11-22', valor_mensal: 900, origem: 'formulario', criado_por_nome: 'Paulo' },
  { id: '5', nome: 'E', etapa: 'ganho', criado_dia: '2026-09-02', ganho_dia: '2026-10-10', valor_mensal: 700, responsavel_nome: 'Bia' },
  { id: '6', nome: 'F', etapa: 'reuniao', criado_dia: '2026-11-07', ganho_dia: null, valor_mensal: 5000 },
  { id: '7', nome: 'G', etapa: 'perdido', criado_dia: '2026-10-30', ganho_dia: '2026-11-01' }, // perdido não conta como fechado
];
const PROPOSTAS = [{ oportunidade_id: '1', dia: '2026-10-28' }, { oportunidade_id: '2', dia: '2026-11-05' }, { oportunidade_id: '2', dia: '2026-11-09' }, { oportunidade_id: '3', dia: '2026-11-10' }];

test('corrida comercial: responsável, depois quem cadastrou; formulário sem responsável fica sem atribuição', () => {
  const r = calc.rankingFechamentos(OPS, calc.periodo('2026-11'));
  assert.deepEqual(r.linhas.map((x) => [x.posicao, x.nome, x.quantidade, x.mrr, x.avulso, x.total]), [
    [1, 'Taynara', 2, 1500, 1100, 2600], [2, 'Vinícius', 1, 2000, 0, 2000]]);
  assert.equal(r.linhas[1].pelo_cadastro, 1);
  assert.deepEqual(r.sem_atribuicao, { quantidade: 1, mrr: 900, avulso: 0 });
  assert.deepEqual(calc.rankingFechamentos([], calc.periodo('2026-11')).linhas, []);
  // Empate de valor: mais negócios na frente; depois o nome.
  const emp = calc.rankingFechamentos([
    { etapa: 'ganho', ganho_dia: '2026-11-01', valor_mensal: 100, responsavel_nome: 'Zé' },
    { etapa: 'ganho', ganho_dia: '2026-11-01', valor_mensal: 50, responsavel_nome: 'Ana' }, { etapa: 'ganho', ganho_dia: '2026-11-02', valor_mensal: 50, responsavel_nome: 'Ana' }], calc.periodo('2026-11'));
  assert.deepEqual(emp.linhas.map((x) => x.nome), ['Ana', 'Zé']);
});

test('KPIs do mês × anterior e séries dos últimos 6 meses', () => {
  const dados = { oportunidades: OPS, propostas: PROPOSTAS };
  const k = calc.kpisComerciais(dados, calc.periodo('2026-11'));
  assert.deepEqual(k.atual, { leads: 4, propostas: 2, negocios: 4, mrr: 4400, avulso: 1100 });
  assert.deepEqual(k.anterior, { leads: 2, propostas: 1, negocios: 1, mrr: 700, avulso: 0 });
  assert.equal(k.variacao.leads, 100); assert.equal(k.variacao.negocios, 300); assert.equal(k.variacao.avulso, null);
  const s = calc.seriesMensais(dados, '2026-11', 6);
  assert.deepEqual(s.map((x) => x.mes), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(s.map((x) => x.leads), [0, 0, 0, 1, 2, 4]);
  assert.deepEqual(s.map((x) => x.mrr), [0, 0, 0, 0, 700, 4400]);
  assert.equal(calc.seriesMensais(dados, '2026-02', 3)[0].mes, '2025-12'); // virada de ano
  assert.throws(() => calc.seriesMensais(dados, '2026-13'), /Mês inválido/);
  // Anual: o ano inteiro contra o anterior.
  const a = calc.kpisComerciais(dados, calc.periodo('2026-11', 'anual'));
  assert.equal(a.atual.negocios, 5); assert.equal(a.anterior.negocios, 0); assert.equal(a.variacao.negocios, null);
});

test('formulário: isca, campos obrigatórios, limites, WhatsApp e limpeza de texto', () => {
  assert.deepEqual(calc.validarLead({ nome: 'Ana', whatsapp: '74999998888', site: 'http://spam' }), { isca: true });
  assert.match(calc.validarLead({ whatsapp: '74999998888' }).erro, /nome/);
  assert.equal(calc.validarLead({ nome: 'Ana', whatsapp: '123' }).campo, 'whatsapp');
  assert.equal(calc.validarLead({ nome: 'Ana', whatsapp: '74999998888', mensagem: 'x'.repeat(1001) }).campo, 'mensagem');
  assert.equal(calc.validarLead({ nome: 'Ana', whatsapp: '74999998888', empresa: 'x'.repeat(5000) }).campo, 'empresa');
  assert.equal(calc.validarLead({ nome: { $ne: 1 }, whatsapp: '74999998888' }).campo, 'nome');
  assert.equal(calc.validarLead({ nome: 'Ana', whatsapp: '74999998888', interesse: 'Hackear' }).campo, 'interesse');
  assert.match(calc.validarLead([]).erro, /inválido/);
  const ok = calc.validarLead({ nome: '  Ana \u0000 Souza\u202E ', empresa: 'Padaria <b>Sol</b>', whatsapp: '+55 (74) 99999-8888', cidade: 'Irecê',
    interesse: 'Site', mensagem: 'Oi\r\n\r\n\r\n\r\nquero   um site\t!', extra: 'ignorado' });
  assert.deepEqual(ok.dados, { nome: 'Ana Souza', empresa: 'Padaria <b>Sol</b>', whatsapp: '5574999998888', cidade: 'Irecê', interesse: 'Site', mensagem: 'Oi\n\nquero um site !' });
  assert.equal(calc.formatarWhatsapp('5574999998888'), '(74) 99999-8888');
  assert.equal(calc.formatarWhatsapp('7433334444'), '(74) 3333-4444');
});

// ---------- Servidor (PGlite) ----------
const resposta = () => ({ codigo: 0, body: null, corpo: '', cab: {}, setHeader(k, v) { this.cab[k.toLowerCase()] = v; }, status(n) { this.codigo = n; return this; },
  json(d) { this.body = d; return this; }, send(s) { this.corpo = s; return this; }, end() { return this; } });
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Henrique', admin: false, dono: true } }; // dono vem da sessão (server/donos.js)
const atendimento = { tipo: 'sessao', pessoa: { id: 5, nome: 'Taynara', admin: false } };
const criacao = { tipo: 'sessao', pessoa: { id: 3, nome: 'Bia', admin: false } };
const CONFIG = `CREATE TABLE IF NOT EXISTS vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id))`;
async function banco(t, { config = true } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY,nome text,ativo boolean,pode_entrar boolean,monday_user_id text);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY,funcao text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY,nome text,ativo boolean); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
    INSERT INTO vybe_pessoas (id,nome,ativo,pode_entrar) VALUES (1,'Paulo Henrique',true,true),(3,'Bia',true,true),(5,'Taynara',true,true);
    INSERT INTO vybe_escritorio_funcoes VALUES (5,'atendimento'),(3,'criacao');`);
  await db.exec(readFileSync('migrations/2026-11-07-crm-prospeccao.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-07-comercial.sql', 'utf8'));
  if (config) await db.exec(CONFIG);
  return { db, sql };
}
const chamar = async (sql, quem, body = null, query = {}) => { const r = resposta(); await areaComercial({ method: body ? 'POST' : 'GET', body, query }, r, quem, () => sql); return r; };
const crm = async (sql, quem, body = null, query = {}) => { const r = resposta(); await areaCrm({ method: body ? 'POST' : 'GET', body, query }, r, quem, () => sql); return r; };
const ATE_GANHO = [['empresa', 'qualificacao'], ['qualificacao', 'abordagem_proposta'], ['abordagem_proposta', 'aprovada'], ['aprovada', 'contato_feito'], ['contato_feito', 'reuniao'], ['reuniao', 'proposta_comercial'], ['proposta_comercial', 'ganho']];
async function fechar(sql, nome, { mensal = 0, avulso = 0, responsavel = null } = {}) {
  const c = await crm(sql, atendimento, { acao: 'criar', nome }); const id = String(c.body.id);
  for (const [de, para] of ATE_GANHO) { const r = await crm(sql, atendimento, { acao: 'mover', id, de_etapa: de, etapa: para }); assert.equal(r.codigo, 200, JSON.stringify(r.body)); }
  let o = (await crm(sql, paulo, null, { id })).body.oportunidade;
  assert.equal((await crm(sql, paulo, { acao: 'valor', id, versao: o.versao, valor_mensal: mensal, valor_avulso: avulso })).codigo, 200);
  if (responsavel) { o = (await crm(sql, paulo, null, { id })).body.oportunidade; assert.equal((await crm(sql, paulo, { acao: 'atualizar', id, versao: o.versao, responsavel })).codigo, 200); }
  return id;
}

test('metas: sem a tabela de configuração o funil abre com aviso e salvar explica a migração', async (t) => {
  const { sql } = await banco(t, { config: false });
  const f = await chamar(sql, paulo, null, { aba: 'funil' });
  assert.equal(f.codigo, 200); assert.equal(f.body.mes.config_disponivel, false); assert.match(f.body.mes.aviso_config, /2026-11-07-carteira\.sql/);
  const s = await chamar(sql, paulo, { acao: 'metas_salvar', mes: '2026-11', metas: { leads: 10 } });
  assert.equal(s.codigo, 503); assert.match(s.body.error, /2026-11-07-carteira\.sql/);
});

test('metas, KPIs, corrida e séries pelo servidor; só donos editam e só donos veem reais', async (t) => {
  const { sql, db } = await banco(t);
  const hoje = hojeNaBahia(), mes = hoje.slice(0, 7), anterior = calc.somarMeses(mes + '-01', -1).slice(0, 7);
  assert.equal((await chamar(sql, atendimento, { acao: 'metas_salvar', mes, metas: { leads: 10 } })).codigo, 403);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_salvar', mes, metas: { negocios: 1.5 } })).codigo, 400);
  assert.equal((await chamar(sql, paulo, { acao: 'metas_salvar', mes: '2026-13', metas: {} })).codigo, 400);
  let r = await chamar(sql, paulo, { acao: 'metas_salvar', mes, aplicar: 'resto_do_ano', metas: { mrr: 3000, avulso: 1000, negocios: 2, leads: 4 } });
  assert.equal(r.codigo, 200, JSON.stringify(r.body)); assert.equal(r.body.meses.at(-1), mes.slice(0, 4) + '-12');
  r = await chamar(sql, paulo, { acao: 'metas_salvar', mes: anterior, metas: { leads: 1 } }); assert.equal(r.codigo, 200); // não apaga os outros meses
  await fechar(sql, 'Loja A', { mensal: 2000, avulso: 500, responsavel: 5 });
  await fechar(sql, 'Loja B', { mensal: 1500 }); // sem responsável: conta quem cadastrou (Taynara)
  await crm(sql, atendimento, { acao: 'criar', nome: 'Loja C' });
  const velha = await crm(sql, atendimento, { acao: 'criar', nome: 'Loja do mês passado' });
  await db.query(`UPDATE vybe_crm_oportunidades SET criado_em = criado_em - interval '35 days' WHERE id = $1`, [velha.body.id]);

  r = await chamar(sql, paulo, null, { aba: 'funil', mes, periodo: 'mensal' });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const m = r.body.mes;
  assert.equal(m.config_disponivel, true); assert.equal(m.valores, true);
  assert.equal(m.kpis.atual.leads, 3); assert.equal(m.kpis.atual.negocios, 2); assert.equal(m.kpis.atual.propostas, 2); assert.equal(m.kpis.atual.mrr, 3500);
  const prog = Object.fromEntries(m.progresso.map((x) => [x.id, x]));
  assert.equal(prog.mrr.percentual, 116.7); assert.equal(prog.negocios.batida, true); assert.equal(prog.leads.percentual, 75);
  assert.deepEqual(m.ranking.linhas.map((x) => [x.nome, x.quantidade, x.mrr, x.pelo_cadastro]), [['Taynara', 2, 3500, 1]]);
  assert.equal(m.series.length, 6); assert.equal(m.series.at(-1).mes, mes); assert.equal(m.series.at(-1).leads, 3);
  assert.equal(m.metas_por_mes[anterior].leads, 1); assert.equal(m.metas_por_mes[mes].mrr, 3000);
  // Anual: metas somadas dos meses do ano.
  r = await chamar(sql, paulo, null, { aba: 'funil', mes, periodo: 'anual' });
  const meses = 13 - Number(mes.slice(5));
  assert.equal(r.body.mes.metas.negocios, 2 * meses + 0); assert.equal(r.body.mes.periodo.tipo, 'anual');
  // Equipe: quantidades sim, reais não.
  r = await chamar(sql, criacao, null, { aba: 'funil', mes });
  const e = r.body.mes;
  assert.equal(e.valores, false); assert.equal(e.kpis.atual.mrr, undefined); assert.equal(e.kpis.atual.negocios, 2);
  assert.equal(e.metas.mrr, undefined); assert.equal(e.metas_por_mes, undefined); assert.ok(e.progresso.every((x) => x.tipo !== 'dinheiro'));
  assert.equal(e.ranking.linhas[0].mrr, undefined); assert.equal(e.series[0].mrr, undefined);
  assert.equal(e.formulario.token, undefined); assert.equal(e.leads_formulario, null);
});

async function publico(sql, { metodo = 'GET', t, corpo, ip = '10.0.0.1', json = true } = {}) {
  const r = resposta();
  await paginaFormularioLeads({ method: metodo, query: { t }, body: corpo, headers: { 'content-type': json ? 'application/json' : 'application/x-www-form-urlencoded', 'x-forwarded-for': ip + ', 70.0.0.1' } }, r, () => sql);
  return r;
}

test('formulário público: token, isca, limites, IP, troca de link e nada interno na resposta', async (t) => {
  esquecerLimites();
  const { sql, db } = await banco(t);
  // Sem link gerado: indisponível.
  let r = await publico(sql, { t: 'A'.repeat(32) }); assert.equal(r.codigo, 404); assert.match(r.corpo, /Formulário indisponível/);
  assert.equal((await chamar(sql, atendimento, { acao: 'formulario_gerar' })).codigo, 403);
  r = await chamar(sql, paulo, { acao: 'formulario_gerar' }); assert.equal(r.codigo, 200);
  const token = r.body.token; assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  // A página: cabeçalhos de segurança, isca e limites dos campos.
  r = await publico(sql, { t: token }); assert.equal(r.codigo, 200);
  assert.match(r.cab['content-security-policy'], /default-src 'none'/); assert.equal(r.cab['x-frame-options'], 'DENY');
  assert.match(r.corpo, /name="site"/); assert.match(r.corpo, /maxlength="1000"/); assert.ok(!r.corpo.includes(token), 'o token não aparece na página');
  assert.equal((await publico(sql, { t: token.slice(0, 31) + '!' })).codigo, 404);
  assert.equal((await publico(sql, { t: '<script>' })).codigo, 404);
  // Isca: finge sucesso e não grava.
  r = await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'Robô', whatsapp: '74999990000', site: 'http://x' }, ip: '10.0.0.9' });
  assert.equal(r.codigo, 200); assert.equal(r.body.ok, true);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM vybe_crm_oportunidades`)).rows[0].n, 0);
  // Validação: erro do campo, sem nada interno.
  r = await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'Ana', whatsapp: '12' }, ip: '10.0.0.2' });
  assert.equal(r.codigo, 400); assert.equal(r.body.campo, 'whatsapp');
  // Envio certo vira oportunidade em Novo (etapa Empresa), origem formulário, em nome do dono que gerou o link.
  r = await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'Ana <img src=x onerror=alert(1)>', empresa: 'Padaria Sol', whatsapp: '(74) 99999-8888', cidade: 'Irecê', interesse: 'Site', mensagem: 'Quero um site' } });
  assert.equal(r.codigo, 200, JSON.stringify(r.body)); assert.deepEqual(Object.keys(r.body).sort(), ['mensagem', 'ok']);
  const [o] = (await db.query(`SELECT nome, etapa, criado_por::text, legado, proxima_acao FROM vybe_crm_oportunidades`)).rows;
  assert.equal(o.nome, 'Padaria Sol'); assert.equal(o.etapa, 'empresa'); assert.equal(o.criado_por, '1');
  assert.equal(o.legado.origem, 'formulario'); assert.equal(o.legado.contato.whatsapp, '74999998888'); assert.match(o.legado.ip, /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(o.legado).includes('10.0.0.1'), 'o IP não fica guardado');
  assert.match(o.proxima_acao, /\(74\) 99999-8888/);
  const [h] = (await db.query(`SELECT quem_nome, tipo FROM vybe_crm_historico`)).rows; assert.deepEqual(h, { quem_nome: 'Formulário de leads', tipo: 'criacao' });
  // No funil: etiqueta de origem; contato só para quem edita o Comercial.
  let f = await chamar(sql, atendimento, null, { aba: 'funil' });
  assert.equal(f.body.oportunidades[0].origem, 'formulario'); assert.equal(f.body.mes.leads_formulario[0].contato.empresa, 'Padaria Sol');
  assert.equal(f.body.mes.formulario.ativo, true); assert.equal(f.body.mes.formulario.token, undefined);
  f = await chamar(sql, criacao, null, { aba: 'funil' }); assert.equal(f.body.mes.leads_formulario, null);
  f = await chamar(sql, paulo, null, { aba: 'funil' }); assert.equal(f.body.mes.formulario.token, token);
  // Limite por IP na memória da instância.
  for (let i = 0; i < LIMITE_IP_MINUTO - 1; i++) assert.equal((await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'Ana ' + i, whatsapp: '74999998888' } })).codigo, 200);
  assert.equal((await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'Mais um', whatsapp: '74999998888' } })).codigo, 429);
  // E no banco (outra instância, memória zerada): o mesmo IP continua barrado; outro IP passa.
  esquecerLimites();
  r = await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'De novo', whatsapp: '74999998888' } }); assert.equal(r.codigo, 429);
  assert.equal((await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'Outra pessoa', whatsapp: '74999997777' }, ip: '10.0.0.3' })).codigo, 200);
  // Envio sem JavaScript (form-urlencoded): página de confirmação, com o texto escapado.
  r = await publico(sql, { metodo: 'POST', t: token, corpo: 'nome=Jo%C3%A3o&whatsapp=74988887777', json: false, ip: '10.0.0.4' });
  assert.equal(r.codigo, 200); assert.match(r.corpo, /Contato recebido/);
  r = await publico(sql, { metodo: 'POST', t: token, corpo: 'nome=J&whatsapp=74988887777', json: false, ip: '10.0.0.5' });
  assert.equal(r.codigo, 400); assert.match(r.corpo, /Informe o seu nome/);
  // Corpo grande demais.
  assert.equal((await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'x', mensagem: 'y'.repeat(9000) }, ip: '10.0.0.6' })).codigo, 413);
  // Trocar o link invalida o antigo; desligar fecha o formulário.
  r = await chamar(sql, paulo, { acao: 'formulario_gerar' }); const novo = r.body.token; assert.notEqual(novo, token);
  assert.equal((await publico(sql, { t: token })).codigo, 404);
  assert.equal((await publico(sql, { metodo: 'POST', t: token, corpo: { nome: 'Ana', whatsapp: '74999998888' }, ip: '10.0.0.7' })).codigo, 404);
  assert.equal((await publico(sql, { t: novo })).codigo, 200);
  assert.equal((await chamar(sql, paulo, { acao: 'formulario_desligar' })).codigo, 200);
  assert.equal((await publico(sql, { t: novo })).codigo, 404);
  // Erro do banco não vaza: sem tabela de configuração, só "indisponível".
  await db.exec('DROP TABLE vybe_carteira_config');
  r = await publico(sql, { metodo: 'POST', t: novo, corpo: { nome: 'Ana', whatsapp: '74999998888' }, ip: '10.0.0.8' });
  assert.equal(r.codigo, 404); assert.deepEqual(r.body, { error: 'Formulário indisponível.' });
});

test('rota pública /lead entra antes do login', async () => {
  const r = resposta();
  // Token sem formato: responde a página de indisponível sem abrir o banco.
  await handler({ method: 'GET', headers: {}, query: { area: 'lead', t: 'curto' } }, r);
  assert.equal(r.codigo, 404); assert.match(r.corpo, /Formulário indisponível/);
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(vercel.rewrites.some((x) => x.source === '/lead/:t' && x.destination === '/api/painel?area=lead&t=:t'));
});

// ---------- Tela (vybe-mundo-comercial.js com o servidor de verdade) ----------
function elemento(tag) {
  return { tagName: tag.toUpperCase(), dataset: {}, hidden: false, innerHTML: '', ouvintes: {}, scrollTop: 0, attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); },
    querySelector: () => null, querySelectorAll: () => [], contains: () => false, append() {}, focus() {} };
}
async function tela(t, sql, quem) {
  const corpo = elemento('body'), criados = [], doc = { body: corpo, ouvintes: {}, activeElement: null,
    createElement: (tag) => { const e = elemento(tag); criados.push(e); return e; }, getElementById: (id) => criados.find((e) => e.id === id) || null,
    addEventListener(tipo, f, cap) { (this.ouvintes[tipo] ||= []).push({ f, cap }); }, querySelector: () => null };
  const ctx = vm.createContext({ document: doc, console, setTimeout, Intl, Date, JSON, Math, Number, String, Object, Array, Promise, Error, Set, Map, encodeURIComponent, confirm: () => true,
    location: { origin: 'https://painel.exemplo' },
    fetch: async (url, op = {}) => {
      const u = new URL(url, 'http://x'), q = Object.fromEntries(u.searchParams), fn = q.area === 'crm' ? areaCrm : areaComercial;
      let codigo = 0, corpoR = null; const res = { setHeader() {}, status(n) { codigo = n; return this; }, json(d) { corpoR = d; return this; } };
      await fn({ method: op.method || 'GET', body: op.body ? JSON.parse(op.body) : null, query: q }, res, quem, () => sql);
      return { ok: codigo === 200, status: codigo, json: async () => corpoR };
    } });
  ctx.window = ctx; ctx.window.addEventListener = () => {};
  vm.runInContext(readFileSync('shared/comercial-calculos.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('vybe-mundo-comercial.js', 'utf8'), ctx);
  const esperar = async () => { for (let i = 0; i < 60; i++) await new Promise((r) => setTimeout(r, 5)); };
  ctx.VybeComercial.abrir('funil'); await esperar();
  return { ctx, html: () => criados.find((e) => e.id === 'vv-comercial').innerHTML };
}

test('tela do funil: metas com barra, KPIs espiáveis, gráficos, corrida e bloco do formulário', async (t) => {
  esquecerLimites();
  const { sql } = await banco(t);
  const mes = hojeNaBahia().slice(0, 7);
  await chamar(sql, paulo, { acao: 'metas_salvar', mes, metas: { mrr: 4000, negocios: 2, leads: 4 } });
  await fechar(sql, 'Loja <b>A</b>', { mensal: 2000, responsavel: 5 });
  const { body } = await chamar(sql, paulo, { acao: 'formulario_gerar' });
  await publico(sql, { metodo: 'POST', t: body.token, corpo: { nome: 'Bruno <script>x</script>', whatsapp: '74999998888', empresa: 'Mercado <i>Bom</i>' } });

  const dono = await tela(t, sql, paulo);
  let h = dono.html();
  assert.ok(!h.includes('Não foi possível mostrar'), h.slice(0, 300));
  assert.match(h, /Metas de /); assert.match(h, /vc-metas/); assert.match(h, />50%</); assert.match(h, /fechado \(MRR\)/);
  assert.match(h, /data-espiar="comercial:funil:leads"/); assert.match(h, /data-espiar="comercial:funil:propostas"/);
  assert.match(h, /<svg viewBox/); assert.match(h, /MRR fechado/); assert.match(h, /class="valor">2 mil</);
  assert.match(h, /Corrida comercial/); assert.match(h, /Taynara/);
  assert.match(h, /Formulário de leads/); assert.ok(h.includes('https://painel.exemplo/lead/' + body.token));
  assert.match(h, /Mercado &lt;i&gt;Bom&lt;\/i&gt;/); assert.ok(!h.includes('<script>x') && !h.includes('<b>A</b>') && !h.includes('<i>Bom'), 'nada de HTML injetado');
  assert.match(h, /Editar metas/);
  // Espiar: as oportunidades por trás dos números.
  const espiar = dono.ctx.VybeEspiarProvedores.comercial;
  assert.equal(espiar('funil:fechados').itens.length, 1); assert.equal(espiar('funil:fechados').itens[0].dir, 'R$ 2.000,00/mês'.replace(' ', '\u00A0'));
  assert.equal(espiar('funil:leads').itens.length, 2);
  assert.equal(espiar('funil:formulario').itens[0].nome, 'Mercado <i>Bom</i>'); // o mini painel escapa ao pintar
  assert.equal(espiar('funil:propostas').itens.length, 1);
  assert.equal(espiar('funil:corrida:1').titulo.startsWith('Taynara'), true);
  assert.equal(espiar('funil:leads:' + mes).itens.length, 2);
  assert.equal(espiar('funil:nada'), null);

  const equipe = await tela(t, sql, criacao);
  h = equipe.html();
  assert.ok(!h.includes('fechado (MRR)') && !h.includes('MRR fechado') && !h.includes('Editar metas') && !h.includes('Formulário de leads'));
  assert.match(h, /Negócios fechados/); assert.match(h, /só para os donos/);
  assert.equal(equipe.ctx.VybeEspiarProvedores.comercial('funil:fechados').itens[0].dir, '');
});
