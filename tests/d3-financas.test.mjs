// Direção 3 · Financeiro do Vybe OS: Extrato, Cartão, Gastos fixos, Projeção e Vorcaro pelos quadros D3 (moodboard 3).
// Monta a resposta com o próprio montar() do servidor sobre um extrato inventado (nada de extrato real) e pinta as telas
// de vybe-mundo-financeiro.js num vm, com as peças d3 da base (vybe-core.js). SAFE: sem navegador, servidor nem banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { montar } from '../server/financeiro.js';

const require = createRequire(import.meta.url);
const X = require('../shared/financeiro-extrato.js');
const ler = (a) => readFileSync(new URL('../' + a, import.meta.url), 'utf8');
const CORE = ler('vybe-core.js'), CSS = ler('padrao-v2/d3-financas.css');
const D3 = CORE.slice(CORE.indexOf('const d3Esc'), CORE.indexOf('if (typeof globalThis !== \'undefined\') Object.assign(globalThis, { d3AcaoHtml'));
const HOJE = '2026-11-13';

// Extrato inventado no formato do BB: dois meses fechados e o atual.
const CSV = ['AGENCIA;"0001";CONTA;"99999"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
  '"12/11/2026";"Pix Enviado Vinicius Exemplo";"";"-300,00";"9.320,00"', '"10/11/2026";"Pix Recebido Cliente Teste";"";"1.800,00";"9.620,00"',
  '"05/11/2026";"Cr Cob Bloq Comp Conf Recebimento 0001/000123";"";"6.100,00";"7.820,00"', '"03/11/2026";"Pagto Boleto Aluguel Sala";"";"-3.200,00";"1.720,00"',
  '"15/10/2026";"Pix Recebido Cliente Teste";"";"4.000,00";"4.920,00"', '"10/10/2026";"Pagto Boleto Aluguel Sala";"";"-3.200,00";"920,00"',
  '"15/09/2026";"Pix Recebido Cliente Teste";"";"4.000,00";"4.120,00"', '"10/09/2026";"Pagto Boleto Aluguel Sala";"";"-3.200,00";"120,00"',
  '"01/09/2026";"Pix Recebido Cliente Teste";"";"3.320,00";"3.320,00"'].join('\r\n');
function dados() {
  const transacoes = X.transacoesDoCsv(X.lerCsvBB(CSV), [], [{ id: 'c1', nome: 'Cliente Teste' }]);
  for (const t of transacoes) if (t.banco.data < '2026-11-01') t.real = X.aplicarEdicao(t, { conferido: true }, 'Paulo').real;
  const fixos = [X.normalizarFixo({ id: 'fx-aluguel', nome: 'Aluguel da sala', valor: 3200, dia: 3, categoria: 'estrutura', forma: 'boleto', contem: 'aluguel' }).fixo,
    X.normalizarFixo({ id: 'fx-contador', nome: 'Contador', valor: 1100, dia: 10, categoria: 'servicos', forma: 'pix', contem: 'contador' }).fixo];
  const cartao = [X.normalizarItemCartao({ id: 'ct-um', fatura: '2026-11', data: '2026-11-06', descricao: 'PAPELARIA', valor: 318, categoria: 'a_classificar', status: 'nao_pago' }).item,
    X.normalizarItemCartao({ id: 'ct-dois', fatura: '2026-11', data: '2026-11-04', descricao: 'ANUNCIOS', valor: 1200, categoria: 'ferramentas', status: 'pago', parcela: '2/5' }).item];
  const propostas = [{ id: 'wa-1', autor: 'Ewerton', anexo: 'print', texto: 'Pix do Cliente Teste', tipo: 'entrada', valor: 1800, data: '2026-11-10', categoria: 'receita_cliente', recebido_em: '2026-11-12T10:00:00Z', estado: 'pendente' },
    { id: 'wa-2', autor: 'Paulo', anexo: 'audio', texto: 'Gasolina da captação', tipo: 'saida', valor: 180, data: '2026-11-13', categoria: 'combustivel', recebido_em: '2026-11-13T09:00:00Z', estado: 'pendente' },
    { id: 'wa-0', autor: 'Deivid', anexo: 'print', texto: 'Print repetido', tipo: 'entrada', valor: 1800, data: '2026-11-10', categoria: 'receita_cliente', recebido_em: '2026-11-10T10:00:00Z', estado: 'descartada' }];
  return montar({ extrato: { transacoes, importacoes: [{ em: '2026-11-13T10:00:00Z', por: 'Paulo', de: '2026-09-01', ate: '2026-11-12', novas: transacoes.length, repetidas: 0 }] }, regras: [], fixos, cartao, cenarios: [], vorcaro: { propostas } },
    [{ cliente_id: 'c1', cliente_nome: 'Cliente Teste', valor_mensal: 4000, ativo: true, inicio: '2026-01-01' }], { mes: '', hoje: HOJE });
}
function telas() {
  const ctx = vm.createContext({ console, Intl, Date, Map, Set, Promise, setTimeout, clearTimeout, CSS: { escape: (s) => s } });
  ctx.window = ctx;
  vm.runInContext(D3 + ';globalThis.d3AcaoHtml=d3AcaoHtml;globalThis.d3NumHtml=d3NumHtml;globalThis.d3LinhaSvg=d3LinhaSvg;', ctx);
  vm.runInContext(ler('shared/financeiro-extrato.js'), ctx);
  vm.runInContext(ler('vybe-mundo-financeiro.js'), ctx);
  return ctx.VybeFinanceiro;
}
const comum = (html, nome, nums) => {
  assert.match(html, new RegExp(`class="fv2 fx d3f" data-tela="fx-${nome}"`));
  assert.match(html, /class="d3-selo-donos"[^>]*>[\s\S]*só donos/, `${nome}: selo só donos`);
  assert.equal((html.match(/class="d3-acao"/g) || []).length, 1, `${nome}: um bloco de ação, o único laranja cheio`);
  assert.equal((html.match(/class="d3-num[ "]/g) || []).length, nums, `${nome}: números`);
  assert.doesNotMatch(html, /fv2-fala|fv2-kpi/, `${nome}: a fala e os números antigos saíram`);
  assert.doesNotMatch(html, /—/, `${nome}: sem travessão`);
};

// Padrão V2 (16/11/2026): as telas no molde comum (prancha V2-M-Financas-Modelo).
const molde = (html, nome) => {
  assert.match(html, new RegExp(`class="fv2 fx d3f d3m-d-fx d3m-d-fm" data-tela="fx-${nome}"`));
  assert.match(html, /class="d3-selo-donos"[^>]*>[\s\S]*só donos/, `${nome}: selo só donos`);
  assert.ok((html.match(/class="d3m-laranja/g) || []).length <= 1, `${nome}: no máximo um laranja`);
  assert.doesNotMatch(html, /class="d3-acao"|class="d3f-nums"|fv2-fala|fv2-kpi/, `${nome}: o bloco de ação e os números antigos saíram`);
  assert.match(html, new RegExp(`class="d3m-vlin" data-fx="ir-aba" data-valor="${nome}" aria-current="page"`), `${nome}: a coluna de Finanças marca a tela`);
  assert.doesNotMatch(html, /—/, `${nome}: sem travessão`);
};

test('Extrato: banco × de verdade em colunas, os números com a linha, conferir, dividir entre clientes e "Sempre assim"', () => {
  const V = telas(), d = dados();
  let html = V.telas.extrato({ d, filtro: {} });
  // Padrão V2 (prancha V2-M-Financas-Extrato): o molde; os números viram o "De olho" e o laranja só pede o que falta.
  molde(html, 'extrato');
  assert.match(html, /Vorcaro · já sugeri o destino<\/span>[\s\S]*d3m-lar-num">4<\/b><span class="d3-acao-frase">lançamentos para conferir<\/span><small>E 1 boleto de R\$ 6\.100,00 para dividir entre clientes\.<\/small>/);
  assert.match(html, /class="d3m-btn l" data-fx="chip" data-alvo="extrato" data-valor="conferir">Ver os 4</);
  assert.match(html, /class="d3m-btn l s" data-fx="cat" data-valor="receita_boleto">Dividir</);
  assert.match(html, /class="d3m-d-fm-th"[\s\S]*Dia[\s\S]*No banco[\s\S]*De verdade[\s\S]*Valor/);
  assert.match(html, /\+R\$ 6\.100,00/); assert.match(html, /−R\$ 300,00/);
  assert.match(html, /data-valor="conferir" aria-pressed="true">A conferir<span class="a">4<\/span>/);
  assert.match(html, /class="d3m-d-fm-olho"[\s\S]*entrou[\s\S]*saiu[\s\S]*saldo em 12\/11/, 'entrou, saiu e o saldo no De olho');
  assert.match(html, /data-fx="conferir-todos">Conferir os 4 sugeridos/);
  // Para onde foi, regras e importações atrás de botões.
  assert.doesNotMatch(html, /class="d3f-gx/); assert.match(html, /data-fx="extrato-lado" data-valor="regras"/); assert.match(html, /data-fx="extrato-lado" data-valor="para"/);
  V._teste.ui.extrato.lado = 'para';
  html = V.telas.extrato({ d, filtro: {} });
  assert.match(html, /Para onde foi[\s\S]*data-fx="cat"[^>]*class="d3f-gx/, 'para onde foi em barras que filtram');
  V._teste.ui.extrato.lado = 'regras';
  assert.match(V.telas.extrato({ d, filtro: {} }), /<h3>Regras<\/h3>[\s\S]*Nenhuma regra sua ainda\./);
  V._teste.ui.extrato.lado = '';
  const boleto = d.transacoes.find((t) => t.banco.valor === 6100);
  V._teste.ui.extrato.aberta = boleto.id;
  html = V.telas.extrato({ d, filtro: {} });
  assert.match(html, /Como está no banco[\s\S]*Para onde foi de verdade/);
  assert.match(html, /data-fx="dividir"[^>]*>Dividir entre clientes</);
  assert.match(html, /data-fx="regra-de"[^>]*>Sempre assim</);
  assert.match(html, /class="fv2-btn d3f-escuro v2-estado" data-fx="salvar-lanc"[^>]*>Salvar e conferir</, 'o botão que conta o estado');
  V._teste.ui.extrato.aberta = '';
});

test('Clientes mês a mês (prancha V2-M-Financas-Clientes-Mes): a matriz no molde, a célula na cor da situação, De olho e o laranja só com quem deve', () => {
  const V = telas(), d = dados();
  let html = V.telas.clientes_mes({ d, filtro: {} });
  molde(html, 'clientes_mes');
  assert.match(html, /<h3>Pago e em aberto <small>· pelo mês de referência<\/small><\/h3>/);
  assert.match(html, /data-fx="abrir" data-alvo="clientes_mes" data-valor="c1"[^>]*><b>Cliente Teste<\/b><small>R\$ 4\.000,00 por mês<\/small>/);
  assert.match(html, /class="d3m-d-fm-mes (pago|parcial|aberto|a_receber|sem|fora)"/);
  assert.match(html, /class="d3m-d-fm-olho"[\s\S]*recebido em novembro[\s\S]*a receber no mês[\s\S]*já pagou novembro/);
  const aberto = d.por_cliente.linhas.reduce((s, l) => s + l.total_aberto, 0);
  assert.equal((html.match(/class="d3m-laranja/g) || []).length, aberto > 0 ? 1 : 0, 'laranja só com quem deve');
  if (aberto > 0) assert.match(html, /Vorcaro · quem deve[\s\S]*data-fx="chip" data-alvo="clientes_mes" data-valor="aberto">Ver quem deve</);
  V._teste.ui.clientes_mes.aberta = 'c1';
  html = V.telas.clientes_mes({ d, filtro: {} });
  assert.match(html, /data-linha="c1" aria-expanded="true"[\s\S]*class="fx-mm-det"/, 'a linha abre com as entradas do cliente');
  V._teste.ui.clientes_mes.aberta = '';
});

test('Cartão: total, pago pelo extrato, falta e itens; itens com situação, filtro "Sem categoria" e editar no lugar', () => {
  const V = telas(), d = dados();
  let html = V.telas.cartao({ d, filtro: {} });
  comum(html, 'cartao', 4);
  assert.match(html, /Faltam R\$ 1\.518,00 na fatura e 1 item sem categoria\./);
  assert.match(html, /data-alvo="cartao" data-valor="semcat">Ver o item</);
  assert.match(html, /Sem categoria <b class="r">1<\/b>/); assert.match(html, /A classificar/); assert.match(html, /· 2\/5/);
  assert.match(html, /fatura de novembro/);
  V._teste.ui.cartao.aberta = 'ct-um';
  html = V.telas.cartao({ d, filtro: {} });
  assert.match(html, /data-linha="ct-um" aria-expanded="true"[\s\S]*data-fx="item-status" data-id="ct-um" data-valor="pago"[\s\S]*data-fx="item-editar" data-valor="ct-um"/);
  V._teste.ui.cartao.editando = 'ct-um';
  html = V.telas.cartao({ d, filtro: {} });
  assert.match(html, /data-linha="ct-um"[\s\S]*class="fx-form-caixa"><div class="fx-grade" data-fx-form="item" data-id="ct-um"/, 'o formulário abre na própria linha');
  V._teste.ui.cartao.chip = 'semcat'; V._teste.ui.cartao.editando = '';
  html = V.telas.cartao({ d, filtro: {} });
  assert.doesNotMatch(html, /ANUNCIOS/);
});

test('Gastos fixos: o que não apareceu no extrato pede ação, editar no lugar e os prováveis com os critérios', () => {
  const V = telas(), d = dados();
  let html = V.telas.fixos({ d, filtro: {} });
  comum(html, 'fixos', 4);
  assert.match(html, /Contador venceu dia 10 e não saiu no extrato\./);
  assert.match(html, /d3f-alerta" data-linha="fx-contador"[\s\S]*não apareceu/);
  assert.match(html, /Do que entra[\s\S]*--v:/); assert.match(html, /× 12/);
  V._teste.ui.fixos.editando = 'fx-aluguel';
  html = V.telas.fixos({ d, filtro: {} });
  assert.match(html, /data-linha="fx-aluguel" aria-expanded="true"[\s\S]*data-fx-form="fixo" data-id="fx-aluguel"[\s\S]*data-fx="fixo-salvar"/);
});

test('Projeção: caixa em linha com o ponto no hoje, a tabela à vista e o "E se…"', () => {
  const V = telas(), d = dados();
  const html = V.telas.projecao({ d, filtro: {} });
  comum(html, 'projecao', 4);
  assert.match(html, /No ritmo atual, o caixa vai a <b>/);
  assert.match(html, /<svg class="d3-graf fx-graf"[\s\S]*<polyline points="[^"]+" class="meta"\/>[\s\S]*<circle/, 'realizado cheio, como está tracejado, ponto no hoje');
  assert.match(html, /class="fx-tab fx-tab-proj"[\s\S]*Saldo · como está/); assert.doesNotMatch(html, /Ver a tabela mês a mês/, 'a tabela fica à vista');
  assert.match(html, /E se…[\s\S]*data-fx="novo-mais"[\s\S]*data-fx="cenario-salvar"/);
  assert.match(html, /Fluxo realizado[\s\S]*fx-fluxo-b[\s\S]*Resultado por grupo/);
});

test('Vorcaro (prancha V2-M-Financeiro): três números, Pede decisão, o laranja com o lançamento do WhatsApp e as telas de Finanças no vidro', () => {
  const V = telas(), d = dados();
  let html = V.telas.vorcaro({ d, filtro: {} });
  assert.match(html, /class="fv2 fx d3f d3m-d-fx" data-tela="fx-vorcaro"/);
  assert.match(html, /<h1>Vorcaro · Tesouraria<\/h1>[\s\S]*class="d3-selo-donos"[^>]*>[\s\S]*só donos[\s\S]*data-fx="ir" data-valor="setor:financas">Finanças<\/button> · novembro de 2026 · \d+ coisas pedem decisão/);
  assert.match(html, /data-fx="buscar"[\s\S]*data-fx="foco" data-valor="como"[\s\S]*data-fx="mao-abrir"[^>]*>[\s\S]*?Lançar à mão/);
  assert.equal((html.match(/class="d3m-laranja/g) || []).length, 1, 'um cartão laranja só');
  assert.equal((html.match(/class="d3m-d-folha d3m-d-fx-num"/g) || []).length, 3, 'três números');
  assert.doesNotMatch(html, /—/, 'sem travessão');
  for (const r of ['Caixa hoje', 'Resultado de novembro', 'Em 6 meses, no ritmo de hoje']) assert.ok(html.includes(`<span>${r}</span>`), r);
  // Pede decisão: cada achado com o rótulo, o detalhe e o botão que leva à tela.
  assert.match(html, /data-fx-card="vi" aria-label="Pede decisão">[\s\S]*o mais sério primeiro · \d+ daqui e 2 do WhatsApp/);
  assert.match(html, /<b>Banco sem conferir<\/b> <span>· 4<\/span>[\s\S]*?data-fx="ir-aba" data-valor="extrato" data-chip="conferir"/);
  assert.match(html, /<b>WhatsApp<\/b> <span>· 2 esperando<\/span>[\s\S]*?data-fx="foco" data-valor="whats">Ver</);
  // O laranja é o lançamento do WhatsApp da frente, com os campos para corrigir e as decisões.
  assert.match(html, /class="d3m-laranja d3m-d-fx-prop" data-fx-proposta="wa-1" data-fx-card="whats"[\s\S]*chegou pelo WhatsApp, 1 de 2[\s\S]*<b>Ewerton<\/b> mandou um print em 12\/11[\s\S]*class="d3m-lar-num">\+R\$ 1\.800,00<\/b><span class="d3-acao-frase">Pix do Cliente Teste/);
  for (const n of ['tipo', 'valor', 'categoria', 'cliente_id', 'quem', 'data']) assert.match(html, new RegExp(`data-fx-proposta="wa-1"[\\s\\S]*name="${n}"`), `campo ${n} continua editável`);
  assert.match(html, /data-fx="proposta-lancar" data-valor="wa-1"[\s\S]*data-fx="proposta-descartar" data-valor="wa-1">Descartar/);
  assert.match(html, /aria-label="A seguir">[\s\S]*1 de 2[\s\S]*data-fx="proposta-frente" data-valor="wa-2"/);
  // A coluna de consulta: cada tela de Finanças com o que espera nela, e as decididas a um clique.
  for (const a of ['financas', 'recebimentos', 'contas', 'inadimplencia', 'extrato', 'clientes_mes', 'cartao', 'fixos', 'vales', 'projecao']) assert.match(html, new RegExp(`class="d3m-vlin" data-fx="ir-aba" data-valor="${a}"`), a);
  assert.match(html, /data-fx="ir-aba" data-valor="extrato"><span><b>Extrato e conciliação<\/b><\/span><b class="d3m-vn">4<\/b>/);
  assert.match(html, /aria-label="Entrou e saiu"/);
  assert.match(html, /data-fx="vorcaro-baixo" data-valor="decididas"/);
  V._teste.ui.vorcaro.baixo = 'decididas';
  html = V.telas.vorcaro({ d, filtro: {} });
  assert.match(html, /fx-dec-txt v2-risca feita">10\/11 · Print repetido/, 'a descartada risca');
  assert.doesNotMatch(html, /aria-label="Entrou e saiu"/, 'as decididas abrem no lugar do gráfico');
  V._teste.ui.vorcaro.baixo = ''; V._teste.ui.vorcaro.mao = true;
  html = V.telas.vorcaro({ d, filtro: {} });
  assert.match(html, /data-fx-form="mao"[\s\S]*data-fx="mao-salvar"/, 'lançar à mão abre no lugar do gráfico');
  V._teste.ui.vorcaro.mao = false; V._teste.ui.vorcaro.frente = 'wa-2';
  html = V.telas.vorcaro({ d, filtro: {} });
  assert.match(html, /class="d3m-laranja d3m-d-fx-prop" data-fx-proposta="wa-2"[\s\S]*2 de 2/, 'a escolhida vem para o laranja');
  // Sem nada do WhatsApp, o laranja é o item mais sério do "Pede decisão".
  V._teste.ui.vorcaro.frente = '';
  const semZap = { ...d, vorcaro: { propostas: [] } };
  html = V.telas.vorcaro({ d: semZap, filtro: {} });
  const serio = V._teste.analise(semZap)[0];
  assert.ok(html.includes(`Vorcaro · o mais sério agora</span>`) && html.includes(`<span class="d3-acao-frase">${serio.rot}`), 'o mais sério no laranja');
  assert.doesNotMatch(html, /data-fx-proposta=|aria-label="A seguir"/);
  assert.equal(V._teste.analise(d).every((a) => a.rot && a.texto), true, 'cada achado tem o rótulo curto e o texto inteiro');
});

test('CSS d3-financas: sem forçar regra, tokens da base, escopo pela raiz d3f e movimento que para com "Reduzir movimento"', () => {
  assert.doesNotMatch(CSS, /!important/); assert.doesNotMatch(CSS, /html body\.mundo/);
  assert.match(CSS, /var\(--d3-areia|var\(--d3-cartao\)/); assert.doesNotMatch(CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /#C2490C/i, 'o laranja vem só do bloco de ação da base');
  for (const r of CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((x) => x.trim()).filter((x) => x && !x.startsWith('@') && x.includes('{'))) {
    const sel = r.slice(0, r.indexOf('{'));
    if (/^(from|to|\d)/.test(sel.trim())) continue;
    assert.ok(/\.d3f|#pv2-ia\.d3f/.test(sel), 'regra fora do escopo d3f: ' + sel.slice(0, 80));
  }
  assert.match(CSS, /prefers-reduced-motion:reduce/);
});
