// Redesign da Gestão (quadros 10 a 12 do moodboard, 10/11/2026): Diário, Automações e IA e custos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const trecho = (fonte, de, ate) => { const a = fonte.indexOf(de), b = fonte.indexOf(ate, a); assert.ok(a >= 0 && b > a, `trecho ${de}`); return fonte.slice(a, b); };
const safeText = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const nucleo = trecho(ler('vybe-core.js'), 'const VB_ICONES', '// Números que contam');
const css = ler('vybe-mundo.css');
const bloco = css.slice(css.indexOf('GESTÃO: DIÁRIO, AUTOMAÇÕES E IA E CUSTOS'));

test('Diário: "Registrar agora" uma vez só, no topo, sem o ícone rosa', () => {
  const painel = trecho(ler('index.html'), '<div id="painel-diario"', '<!-- ===== PAINEL SOLICITAÇÕES');
  assert.equal(painel.match(/Registrar agora/g).length, 1);
  assert.doesNotMatch(painel, /pv-ic-aba|#ee83b7/);
  // Padrão v2 (quadro "Diário de produção", 12/11/2026): o vazio é uma frase só e a explicação vai para o pé da tela.
  const tela = trecho(ler('vybe-relatorios.js'), 'async function renderDiarioLista', 'async function abrirSnapshot');
  assert.doesNotMatch(tela, /salvarSnapshot()/, 'o estado vazio não repete o botão');
  assert.match(tela, /Nenhum registro salvo ainda./);
  assert.match(ler('vybe-relatorios.js'), /const DIARIO_PE = .*para comparar com outro dia/);
});

test('Diário: o retrato do registro usa os números dele e não chama prazo passado de atrasado', () => {
  const c = vm.createContext({});
  const fonte = ler('vybe-relatorios.js');
  vm.runInContext(trecho(fonte, 'function diarioFmt', 'function diarioSinal'), c);
  vm.runInContext(trecho(fonte, 'function diarioRetratoTexto', '// O cabeçalho vem do index.html'), c);
  const texto = c.diarioRetratoTexto({ payload: { conteudos: { ativos: 100, sem_data: 10, prazo_passado: 30 } } });
  assert.equal(texto, '100 conteúdos ativos, 10 sem data, 30 com o prazo já passado (de qualquer status)');
  assert.doesNotMatch(texto, /atrasad/i);
  assert.equal(c.diarioRetratoTexto({ total: 5, payload: {} }), '5 conteúdos ativos', 'registro antigo sem os números fica só com o total');
});

test('o rodapé técnico sai das três telas, sem forçar nada', () => {
  // A frente "sistema" (10/11/2026) tirou o rodapé de todas as telas do mundo com uma regra só (body.mundo > footer).
  assert.ok(bloco.includes('body.mundo.mundo-modulo:has(:is(#painel-diario,#painel-automacoes,#painel-ai-usage)[style*="block"]) > footer{display:none}')
    || ler('vybe-mundo.css').includes('body.mundo > footer{display:none}'));
  assert.doesNotMatch(bloco, /!important/);
  assert.doesNotMatch(bloco, /html body\.mundo/);
});

test('Automações: regras primeiro, falhas numa aba, Recalcular e Sincronizar no "Mais", Prioridade na dica', () => {
  const fonte = ler('vybe-automacoes-ui.js');
  const pintar = trecho(fonte, 'function pintarAutomacoes', 'function trocarAbaAutomacoes');
  assert.match(pintar, /class="v2g-seg ar-abas" role="radiogroup"/, 'padrão v2 (quadro Automações): Regras e Falhas em pílula clara, com a escolhida em branco');
  assert.match(pintar, /Regras <span class="ar-n">/);
  assert.match(pintar, /Falhas <span class="ar-n" id="auto-aba-falhas-n">/);
  assert.match(pintar, /Nova regra/);
  assert.match(pintar, /<em>Quando<\/em>[\s\S]*<em>então<\/em>/);
  assert.match(pintar, /role="switch"/);
  assert.ok(pintar.indexOf('data-aba="regras"') < pintar.indexOf('data-aba="falhas"'), 'as regras vêm antes das falhas');
  const mais = pintar.slice(pintar.indexOf('const mais'), pintar.indexOf('const novo'));
  assert.match(mais, /vga-mais-menu[\s\S]*Recalcular prioridades[\s\S]*Sincronizar regras do sistema/);
  assert.match(pintar, /data-dica="\$\{safeText\(texto\)\}"/);
  assert.match(fonte, /const DICA_PRIORIDADE = 'A coluna Prioridade/);
  assert.doesNotMatch(pintar, /auto-aviso-varredura|Encaminhamentos com falha<\/h2>/, 'sem parágrafo nem título grande');
});

test('Automações: a contagem da aba Falhas são as pendentes', async () => {
  const caixa = { dataset: {}, innerHTML: '' }, n = { textContent: '', title: '' };
  const c = vm.createContext({ AUTOMACOES_API: '/api/painel?area=automacoes', safeText,
    fetch: async () => ({ ok: true, json: async () => ({ falhas: ['pendente', 'pendente', 'resolvida'].map((estado) => ({ estado, item: '1', titulo: 'x', ultima_falha_em: '2026-11-10T12:00:00Z' })) }) }),
    document: { getElementById: (id) => (id === 'auto-aba-falhas-n' ? n : caixa) } });
  vm.runInContext(trecho(ler('vybe-automacoes-ui.js'), 'async function carregarFalhasAutomacoes', '// ── histórico'), c);
  await c.carregarFalhasAutomacoes();
  assert.equal(n.textContent, '2');
  assert.equal(n.title, '2 falhas pendentes');
});

function contextoIa() {
  const c = vm.createContext({ safeText, document: { getElementById: () => null } });
  vm.runInContext(nucleo, c);
  vm.runInContext(trecho(ler('vybe-demandas.js'), '// ─── Monitoramento de uso e custo de IA', 'async function saveAiUsageSettings'), c);
  const root = { innerHTML: '' };
  c.document.getElementById = (id) => (id === 'ai-usage-root' ? root : null);
  return { c, root };
}

test('IA e custos: sem uso, um estado vazio só, os números numa linha e nada de tokens', () => {
  const { c, root } = contextoIa();
  c.renderAiUsageBoard({ period_days: 30, settings: { monthly_budget_brl: 0, brl_per_usd: 5.5, gemini_billing: 'free' }, overview: { calls: 0 }, month: {}, providers: [], daily: [], people: [] });
  assert.equal((root.innerHTML.match(/class="vb-estado /g) || []).length, 1);
  assert.match(root.innerHTML, /Nenhum pedido ao VYBES nos últimos 30 dias/);
  assert.match(root.innerHTML, /class="vb-resumo"/);
  assert.match(root.innerHTML, /Sem teto mensal definido/);
  assert.doesNotMatch(root.innerHTML, /token|Texto processado|comandos|ai-usage-metric/i);
  // Os parâmetros da estimativa continuam ali (os ids são os que saveAiUsageSettings lê).
  for (const id of ['ai-budget-input', 'ai-usd-input', 'ai-gemini-billing']) assert.match(root.innerHTML, new RegExp(`id="${id}"`));
  assert.match(root.innerHTML, /onclick="saveAiUsageSettings\(\)"/);
});

test('IA e custos: com uso, o teto usado, o gasto por dia e a tabela de quem usou', () => {
  const { c, root } = contextoIa();
  const hoje = new Date().toISOString().slice(0, 10);
  c.renderAiUsageBoard({ period_days: 7, settings: { monthly_budget_brl: 100, brl_per_usd: 5.5 }, overview: { calls: 12, cost_brl: 85 }, month: { cost_brl: 85, cost_usd: 15.45 },
    providers: [{ provider: 'claude', model: 'm', calls: 12, cost_brl: 85 }], daily: [{ day: hoje, calls: 12, cost_brl: 85 }], people: [{ profile_name: 'Paulo', calls: 12, cost_brl: 85 }] });
  assert.match(root.innerHTML, /<b>85%<\/b>do teto de R\$\s100,00 usado/);
  assert.match(root.innerHTML, /vb-resumo-item atencao/, 'acima de 80% acende o aviso');
  assert.match(root.innerHTML, /US\$ 15,45/);
  assert.match(root.innerHTML, /12<\/b>pedidos ao VYBES em 7 dias/);
  assert.equal((root.innerHTML.match(/<i class="/g) || []).length, 7, 'uma barra por dia, inclusive os sem pedido');
  assert.match(root.innerHTML, /<td>Paulo<\/td>/);
  assert.doesNotMatch(root.innerHTML, /token|comandos/i);
});

test('o cabeçalho de página fica em linha mesmo sendo um <header>', () => {
  assert.match(ler('vybe-appearance.css'), /\.vb-cabecalho \{ display: flex; flex-direction: row; padding: 0;/);
});
