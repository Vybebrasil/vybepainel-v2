// Impressões da Produção (vybe-mundo-impressoes.js): desenho a partir do contrato do servidor (#547) e envio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class El {
  constructor(tag) { this.tagName = tag; this.innerHTML = ''; this.ouvintes = {}; this.atributos = {}; this.className = ''; this.id = ''; this.isConnected = false; }
  append(el) { this.filho = el; el.isConnected = true; }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  addEventListener(t, fn) { (this.ouvintes[t] ||= []).push(fn); }
  remove() { this.isConnected = false; }
  querySelector() { return null; }
}
const ETAPAS = ['arte', 'orcamento', 'aprovado', 'arquivo_enviado', 'em_impressao', 'pronto', 'entregue', 'cancelado'].map((id) => ({ id, nome: id }));
const DADOS = (o = {}) => ({ ok: true, hoje: '2026-11-09', gestao: false, etapas: ETAPAS, clientes: [{ id: '7', nome: 'VOA' }], fornecedores: [], pessoas: [], projetos: [],
  impressoes: [{ id: '1', titulo: 'Adesivo', cliente_id: '7', cliente_nome: 'VOA', conteudo_id: '11472', demanda_status: 'Em andamento', etapa: 'arte', previsao: '2026-11-05', atrasada: true, eventos: [] }],
  resumo: { abertas: 1, atrasadas: 1, semFornecedor: 1 }, porFornecedor: [], ...o });

async function montar(dados) {
  const corpo = new El('body'), pedidos = [];
  const ctx = { console, Promise, JSON, Object, Array, String, Number, Date, Error, FormData: class {}, Event: class {},
    document: { body: corpo, activeElement: null, createElement: (t) => new El(t), querySelector: () => null },
    fetch: async (url, op = {}) => { pedidos.push({ url, metodo: op.method || 'GET', corpo: op.body ? JSON.parse(op.body) : null }); return { ok: true, json: async () => (op.method === 'POST' ? { ok: true } : dados) }; } };
  ctx.window = ctx; ctx.window.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-impressoes.js', 'utf8'), ctx);
  ctx.VybeImpressoes.abrir();
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  return { ctx, pedidos, html: () => corpo.filho?.filho?.innerHTML || '' };
}

test('lista vazia de fornecedores mostra o caminho para cadastrar; cartões com cliente, sem fornecedor e atraso', async () => {
  const t = await montar(DADOS());
  const h = t.html();
  assert.match(h, /Nenhum fornecedor cadastrado/);
  assert.match(h, /data-vi="cadastrar-fornecedor"/);
  assert.match(h, /sem fornecedor/); assert.match(h, /atrasada · 05\/11/);
  assert.equal((h.match(/vi-botao principal/g) || []).length, 1, 'um botão principal só');
  assert.ok(t.pedidos.some((p) => p.url === '/api/painel?area=impressoes' && p.metodo === 'GET'));
});

test('sem impressões: estado vazio útil com o botão de começar', async () => {
  const t = await montar(DADOS({ impressoes: [], resumo: { abertas: 0, atrasadas: 0, semFornecedor: 0 }, fornecedores: [{ id: '3', nome: 'Gráfica X', categoria: 'Gráfica' }] }));
  assert.match(t.html(), /Nenhuma impressão ainda/); assert.match(t.html(), /data-vi="nova"/);
  assert.doesNotMatch(t.html(), /Nenhum fornecedor cadastrado/);
});

test('dock: Impressões logo depois de Fornecedores, na Produção', () => {
  const js = readFileSync('vybe-mundo.js', 'utf8').replace(/\r\n/g, '\n');
  assert.match(js, /id: 'fornecedores'[^\n]*\n[^\n]*\n\s*\{ id: 'impressoes', nome: 'Impressões'[^}]*mod: \['VybeImpressoes'\] \}/);
  assert.match(js, /'VybeImpressoes'\]/);
  assert.match(js, /'vv-impressoes'/);
});
