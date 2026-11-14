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

test('Extrato: banco × de verdade em colunas, os números com a linha, conferir, dividir entre clientes e "Sempre assim"', () => {
  const V = telas(), d = dados();
  let html = V.telas.extrato({ d, filtro: {} });
  comum(html, 'extrato', 4);
  assert.match(html, /Vorcaro · Tesouraria<\/small>4 lançamentos para conferir e 1 boleto para dividir\./);
  assert.match(html, /data-fx="chip" data-alvo="extrato" data-valor="conferir">Ver o que falta</);
  assert.match(html, /Entrou<\/span>[\s\S]*?<svg class="d3-graf"/, 'a mini linha do que entrou mês a mês');
  assert.match(html, /class="d3f-cab"[\s\S]*Dia[\s\S]*No banco[\s\S]*De verdade[\s\S]*Valor/);
  assert.match(html, /\+R\$ 6\.100,00/); assert.match(html, /−R\$ 300,00/);
  assert.match(html, /A conferir <b class="a">4<\/b>/);
  const boleto = d.transacoes.find((t) => t.banco.valor === 6100);
  V._teste.ui.extrato.aberta = boleto.id;
  html = V.telas.extrato({ d, filtro: {} });
  assert.match(html, /Como está no banco[\s\S]*Para onde foi de verdade/);
  assert.match(html, /data-fx="dividir"[^>]*>Dividir entre clientes</);
  assert.match(html, /data-fx="regra-de"[^>]*>Sempre assim</);
  assert.match(html, /class="fv2-btn d3f-escuro v2-estado" data-fx="salvar-lanc"[^>]*>Salvar e conferir</, 'o botão que conta o estado');
  assert.match(html, /Para onde foi[\s\S]*data-fx="cat"[^>]*class="d3f-gx/, 'para onde foi em barras que filtram');
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

test('Vorcaro: o que viu em rótulo curto, o baralho do WhatsApp com a fila, onde mexer com contagem e as decididas', () => {
  const V = telas(), d = dados();
  let html = V.telas.vorcaro({ d, filtro: {} });
  comum(html, 'vorcaro', 4);
  assert.match(html, /coisas pedem atenção; 2 chegaram pelo WhatsApp\./);
  assert.match(html, /data-fx="foco" data-valor="whats">Ver os 2</);
  assert.match(html, /class="fx-baralho" style="--atras:1"><span class="fx-carta-atras"[\s\S]*data-fx-proposta="wa-1"/);
  assert.match(html, /data-fx="proposta-frente" data-valor="wa-2"/);
  assert.match(html, /<b>Banco sem conferir<\/b> · 4/);
  assert.match(html, /class="fx-atalho" data-fx="ir-aba" data-valor="extrato"><span><b>Extrato<\/b>[\s\S]*?<b class="d3f-a">4<\/b>/);
  assert.match(html, /fx-dec-txt v2-risca feita">Print repetido/, 'a descartada risca');
  V._teste.ui.vorcaro.frente = 'wa-2';
  html = V.telas.vorcaro({ d, filtro: {} });
  assert.match(html, /class="fx-baralho"[\s\S]*?data-fx-proposta="wa-2"/, 'a escolhida vem para a frente');
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
