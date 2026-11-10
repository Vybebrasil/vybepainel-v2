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

// Quadro 17 (10/11/2026): sem o aviso solto de fornecedor; a peça sem gráfica tem "escolher", que abre a edição (onde
// fica o caminho para cadastrar quando não há nenhuma), e o atraso aparece em dias na própria peça.
test('sem fornecedor: escolher na própria peça, sem aviso solto; cartões com cliente e atraso', async () => {
  const t = await montar(DADOS());
  const h = t.html();
  assert.doesNotMatch(h, /Nenhum fornecedor cadastrado|vi-alerta/);
  assert.match(h, /sem fornecedor<\/em> · <span class="vi-escolher" data-vi-escolher-forn="1">escolher<\/span>/);
  assert.match(h, /atrasada \d+ dias? · 05\/11/);
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

test('servidor #549: histórico inteiro, gráficas sugeridas com motivo, cotações só para a gestão e ranking', async () => {
  const forn = [{ id: '3', nome: 'Emballar', categoria: 'Gráfica', cidade: 'Irecê', uf: 'BA' }];
  const rk = [{ fornecedor_id: '3', nome: 'Emballar', local: 'Irecê/BA', entregues: 14, pontualidade: 86, prazo_medio_dias: 4.5, motivo: 'Mais entregas da região' }];
  const base = DADOS({ fornecedores: forn, ranking: rk });
  base.impressoes[0] = { ...base.impressoes[0], sugestao: rk, cotacoes: [{ id: 'c1', fornecedor_id: '3', fornecedor_nome: 'Emballar', valor: 180, prazo_dias: 5, escolhida: false }] };
  const t = await montar({ ...base, gestao: true });
  assert.match(t.html(), /Ranking das gráficas/); assert.match(t.html(), /Mais entregas da região/);
  assert.match(t.html(), /data-vi="todas"/);
  const fonte = readFileSync('vybe-mundo-impressoes.js', 'utf8');
  assert.match(fonte, /'&todas=1'/);
  assert.match(fonte, /acao: 'cotacao_salvar', impressao_id: st\.sel/);
  assert.match(fonte, /acao: 'cotacao_escolher', id:/);
  assert.match(fonte, /if \(!st\.dados\?\.gestao \|\| !Array\.isArray\(i\.cotacoes\)/, 'cotações só para a gestão');
});

test('Nestor (Compras) tem sala no andar Financeiro e abre Impressões; o rascunho do achado tem "Copiar pedido"', async () => {
  const { ANDARES } = await import('../mundo/planta.mjs').catch(() => ({}));
  const fonte = readFileSync('mundo/planta.mjs', 'utf8');
  assert.match(fonte, /id: 'compras', nome: 'Compras e Fornecedores', agente: 'Nestor'[^\n]*\n[^\n]*modulo: \{ tipo: 'janela', alvo: 'impressoes' \}/);
  if (ANDARES) assert.ok(ANDARES.find((a) => a.id === 'financeiro').setores.some((s) => s.id === 'compras'));
  assert.match(readFileSync('vybe-mundo-agentes.js', 'utf8'), /a\.rascunho \?[^\n]*data-vga-copiar>Copiar pedido</);
});
