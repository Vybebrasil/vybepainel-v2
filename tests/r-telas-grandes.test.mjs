import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Telas grandes nas pranchas V2-R (aprovadas pelo Paulo, 19/11/2026): Saúde da carteira, Agenda (Mês e Dia), Cérebro do
// cliente, Loja, Toolkit, Metas no Comercial (com meta por pessoa) e a fila dos Agentes com filtros por tipo.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };
const cssR = (nome) => ler(`padrao-v2/${nome}`);
const guardaCss = (css, nome) => {
  assert.doesNotMatch(css, /!important/, `${nome}: sem !important`);
  assert.doesNotMatch(css, /html body\.mundo/, `${nome}: sem html body.mundo`);
  assert.doesNotMatch(css, /:has\([^)]*\[style/, `${nome}: sem :has com [style]`);
  assert.doesNotMatch(css.replace(/rgba?\([^)]*\)/g, ''), /#[0-9a-fA-F]{3,8}\b/, `${nome}: só tokens, sem cor escrita`);
  assert.ok(fs.readFileSync(`padrao-v2/${nome}`, 'utf8').includes('\r\n'), `${nome}: CRLF`);
};

test('Saúde da carteira na prancha V2-R: vidro como Contratos e Churn, quatro números, a lista com filtros na cabeça e o laranja do Mateus ao lado', () => {
  const js = ler('vybe-mundo-carteira.js');
  assert.match(js, /const TELAS_M = new Set\(\['contratos', 'churn', 'saude'\]\);/);
  assert.match(js, /\{ churn: abaChurn, contratos: abaContratos, saude: abaSaudeM \}\[estado\.aba\]/);
  const tela = js.slice(js.indexOf('  function abaSaudeM() {'), js.indexOf('  // Contas por head: quantos clientes'));
  naOrdem(tela, ['data-tela="saude-v2"', "rotulo: 'Nota média'", "rotulo: 'Precisam de você'", "rotulo: 'Tranquilos'", "rotulo: 'Peças vencidas'", 'data-vc-mais="saude"', 'sem urgência, em Todos', "segM('Filtrar por risco'", 'data-vc-ordem-gira',
    'larMq(AGENTE', '<b>O que mais pesa</b>', '<b>Como tira ponto</b>']);
  // Os mesmos data-vc-* de antes: filtro, head, visão, linha que abre no lugar, abrir o cliente e as vencidas.
  for (const a of ['data-vc-risco=', 'data-vc-head', 'data-vc-visao=', 'data-vc-atrasadas', 'data-vc-cliente=', 'data-vc-ir="churn"', 'data-vc-como']) assert.ok(js.slice(js.indexOf('  function linhaSaudeM('), js.indexOf('  // Contas por head: quantos clientes')).includes(a), a);
  assert.match(js, /if \(d\.vcOrdemSaude\) \{ estado\.ordem\.saude = d\.vcOrdemSaude;/);
  // Receita só para quem vê dinheiro.
  assert.match(tela, /nota\$\{din \? ' e receita' : ''\}/);
  guardaCss(cssR('zm-r-b-1-saude.css'), 'zm-r-b-1-saude.css');
});
