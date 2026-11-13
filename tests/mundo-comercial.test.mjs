// Janela do Comercial no Irecity (vybe-mundo-comercial.js) com dados reais do servidor (PGlite + server/comercial.js):
// cada aba pinta sem erro, o dinheiro não aparece para quem não é dono e a sala de Closing abre a janela. SAFE.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaComercial } from '../server/comercial-api.js';
import { areaCrm } from '../server/crm-api.js';
import { hojeNaBahia } from '../server/comercial.js';
import calc from '../shared/comercial-calculos.js';
import { areaFinanceiro } from '../server/financeiro.js';

function elemento(tag) {
  const el = { tagName: tag.toUpperCase(), dataset: {}, hidden: false, innerHTML: '', ouvintes: {}, scrollTop: 0, attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); },
    querySelector: () => null, querySelectorAll: () => [], contains: () => false, append() {}, focus() {} };
  return el;
}
async function montar(t, quem) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY,nome text,ativo boolean,pode_entrar boolean,monday_user_id text);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY,funcao text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY,nome text,ativo boolean); ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente boolean DEFAULT false;
    INSERT INTO vybe_pessoas VALUES (1,'Paulo',true,true,'100'),(3,'Bia',true,true,'300');
    INSERT INTO vybe_escritorio_funcoes VALUES (3,'criacao');
    INSERT INTO vybe_clientes VALUES (10,'Hebravet',true);`);
  await db.exec(readFileSync('migrations/2026-11-07-crm-prospeccao.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-11-07-comercial.sql', 'utf8'));
  // As abas do Financeiro (area=financeiro) guardam em vybe_carteira_config.
  await db.exec(`CREATE TABLE IF NOT EXISTS vybe_carteira_config (chave text PRIMARY KEY, valor jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint)`);
  const chamar = async (fn, req, pessoa) => { let codigo = 0, corpo = null; const res = { setHeader() {}, status(n) { codigo = n; return this; }, json(d) { corpo = d; return this; } }; await fn(req, res, pessoa, () => sql); return { codigo, corpo }; };
  const dono = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', admin: false, dono: true } };
  const hoje = hojeNaBahia();
  // Dados de verdade, pelo mesmo servidor.
  const post = (corpo) => chamar(areaComercial, { method: 'POST', body: corpo, query: {} }, dono);
  const { corpo: pac } = await post({ acao: 'pacote_salvar', nome: 'Social <b>Start</b>', tipo: 'recorrente', preco: 2000, horas: 30, custo_hora: 55, entregas: ['12 posts'], carga: { criacao: 8 } });
  await post({ acao: 'capacidade_salvar', capacidades: { criacao: 10 } });
  await post({ acao: 'financas_salvar', cliente_id: 10, valor_mensal: 2000, pacote_id: pac.id });
  await post({ acao: 'recebivel_salvar', tipo: 'recorrente', cliente_id: 10, ciclo: 'mensal', valor: 2000, vencimento: calc.somarDias(hoje, -40) });
  await post({ acao: 'conta_salvar', grupo: 'fixa', descricao: 'Aluguel', valor: 900, vencimento: hoje });
  await post({ acao: 'fornecedor_salvar', nome: 'Gráfica', categoria: 'grafica', bv_percentual: 5 });
  await post({ acao: 'creator_salvar', nome: 'Ana', nicho: 'Moda', cidade: 'Irecê', seguidores: 1000 });
  await post({ acao: 'orcamento_criar', cliente_nome: 'Padaria', itens: [{ pacote_id: pac.id }], validade: calc.somarDias(hoje, 10) });
  await chamar(areaCrm, { method: 'POST', body: { acao: 'criar', nome: 'Loja X' }, query: {} }, dono);

  const corpo = elemento('body'), criados = [], doc = { body: corpo, ouvintes: {}, activeElement: null,
    createElement: (tag) => { const e = elemento(tag); criados.push(e); return e; }, getElementById: (id) => criados.find((e) => e.id === id) || null,
    addEventListener(tipo, f, cap) { (this.ouvintes[tipo] ||= []).push({ f, cap }); }, querySelector: () => null };
  const ctx = vm.createContext({ document: doc, console, setTimeout, Intl, Date, JSON, Math, Number, String, Object, Array, Promise, Error, encodeURIComponent, confirm: () => true,
    DADOS_ALL: [{ responsavel_ids: ['300'], status: 'Em produção' }], isFinishedItem: () => false,
    fetch: async (url, op = {}) => {
      const u = new URL(url, 'http://x'), q = Object.fromEntries(u.searchParams), area = q.area === 'crm' ? areaCrm : q.area === 'financeiro' ? areaFinanceiro : areaComercial;
      const r = await chamar(area, { method: op.method || 'GET', body: op.body ? JSON.parse(op.body) : null, query: q }, quem);
      return { ok: r.codigo === 200, status: r.codigo, json: async () => r.corpo };
    } });
  ctx.window = ctx; ctx.window.addEventListener = (tipo, f, cap) => (doc.ouvintes['w' + tipo] ||= []).push({ f, cap });
  vm.runInContext(readFileSync('shared/comercial-calculos.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('vybe-mundo-comercial.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('shared/financeiro-extrato.js', 'utf8'), ctx);
  vm.runInContext(readFileSync('vybe-mundo-financeiro.js', 'utf8'), ctx);
  const janela = () => criados.find((e) => e.id === 'vv-comercial');
  const esperar = async () => { for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 5)); };
  return { ctx, doc, janela, esperar };
}

test('dono: todas as abas pintam com dados reais, com o dinheiro e sem HTML injetado', async (t) => {
  const { ctx, janela, esperar } = await montar(t, { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', admin: false, dono: true } });
  const espera = { funil: 'Loja X', pacotes: 'Zona crítica', orcamentos: 'Padaria', financas: 'Hebravet', recebimentos: 'inadimplente', contas: 'Aluguel',
    inadimplencia: 'Crítico', caixa: 'Entradas recorrentes', fornecedores: 'Gráfica', creators: 'Ana',
    vorcaro: 'Ainda não tenho o extrato', extrato: 'Importar extrato', clientes_mes: 'Hebravet', cartao: 'Colar fatura', fixos: 'Novo gasto fixo', projecao: 'A projeção nasce' };
  for (const aba of ctx.VybeComercial.ABAS.map((a) => a.id)) {
    ctx.VybeComercial.abrir(aba); await esperar();
    const html = janela().innerHTML;
    assert.ok(html.includes(espera[aba]), `${aba}: ${html.slice(0, 400)}`);
    assert.ok(!html.includes('Não foi possível mostrar'), aba);
    assert.ok(!html.includes('<b>Start</b>'), `${aba}: nome do pacote sem escapar`);
  }
  ctx.VybeComercial.abrir('orcamentos'); await esperar();
  assert.match(janela().innerHTML, /Finanças por cliente/);
});

test('equipe sem ser dono: abas de dinheiro escondidas e o servidor recusa se forçar', async (t) => {
  const { ctx, janela, esperar } = await montar(t, { tipo: 'sessao', pessoa: { id: 3, nome: 'Bia', admin: false } });
  ctx.VybeComercial.abrir('pacotes'); await esperar();
  const html = janela().innerHTML;
  assert.ok(html.includes('Social &lt;b&gt;Start&lt;/b&gt;'));
  assert.ok(!html.includes('Zona crítica') && !html.includes('Custo '), 'custo e margem não chegam');
  assert.ok(!html.includes('data-vc-aba="financas"') && !html.includes('data-vc-aba="caixa"'));
  ctx.VybeComercial.abrir('financas'); await esperar();
  assert.ok(!janela().innerHTML.includes('Hebravet'));
});

test('sala de Closing abre a janela antes do HUD tratar o clique', async (t) => {
  const { ctx, doc, janela, esperar } = await montar(t, { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo', admin: false, dono: true } });
  const ouvinte = doc.ouvintes.click.find((o) => o.cap);
  let parou = false;
  const botao = { dataset: { modulo: JSON.stringify({ tipo: 'janela', alvo: 'comercial', aba: 'pacotes' }) } };
  ouvinte.f({ target: { closest: () => botao }, preventDefault() {}, stopPropagation() { parou = true; } });
  await esperar();
  assert.equal(parou, true); assert.equal(ctx.VybeComercial.aberto(), true); assert.match(janela().innerHTML, /aria-selected="true">Pacotes/);
});
