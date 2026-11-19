// Contraste dos pares críticos nos três temas (Paulo, 18/11/2026: "tem muito bug de contraste nos temas (botão preto com
// nome preto dentro)"). SAFE: só lê padrao-v2/0-d3-base.css e os fragmentos; calcula pelos valores dos tokens.
// 1 · os pares de token das peças (botão cheio, botão secundário, selo, aba ativa, letra sobre o laranja) dão 4,5:1 ou mais
//     em Fumê, Claro e Escuro (no Escuro, na folha clara das telas antigas e na folha escura das telas V2);
// 2 · nenhum fragmento volta a juntar fundo e letra que viram a mesma cor num dos temas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const BASE = ler('padrao-v2/0-d3-base.css').replace(/\/\*[\s\S]*?\*\//g, '');

function bloco(seletor) {
  const i = BASE.indexOf(seletor + '{');
  assert.ok(i >= 0, 'falta o bloco ' + seletor);
  const corpo = BASE.slice(i + seletor.length + 1, BASE.indexOf('}', i));
  const t = {};
  for (const m of corpo.matchAll(/(--d3-[\w-]+)\s*:\s*((?:[^;(]|\((?:[^()]|\([^()]*\))*\))+)/g)) t[m[1]] = m[2].trim();
  return t;
}
const FOLHA_ESCURA = '[data-d3-tema="escuro"] :is(#vv-hoje,body[data-modo="gestor"][data-pv2-vista="semana"] :is(#pv2-painel,#pv2-regua,#pv2-semana,#pv2-pe,#panel-week4),.d3-tema,.pv2-casa,#painel-demandas,#painel-clientes,#painel-diario,#painel-ai-usage,#painel-automacoes,#painel-conta,.vv-gestao,#vv-pessoas,#vv-conteudo,#vv-planejamentos,#vv-comercial,#vv-impressoes,#vv-carteira,#vv-reunioes,#vv-agentes,#vv-ferramentas,#vv-placa,#office-catalogo,#ofc-ranking,#workspace-drawer,#status-editor,#dono-editor):not(.d3-previa *),.d3-previa[data-d3-tema="escuro"]';
const RAIZ = bloco(':root');
const TEMAS = {
  fume: { ...RAIZ, ...bloco('[data-d3-tema="fume"]') },
  claro: { ...RAIZ, ...bloco('[data-d3-tema="claro"]') },
  'escuro (folha clara)': { ...RAIZ, ...bloco('[data-d3-tema="escuro"]') },
  'escuro (folha escura)': { ...RAIZ, ...bloco('[data-d3-tema="escuro"]'), ...bloco(FOLHA_ESCURA) },
};

const cor = (s) => {
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)).concat(1);
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const v = m[1].split(',').map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; }
  throw new Error('cor que o teste não lê: ' + s);
};
const resolver = (t, k, fundo = 0) => { let v = t['--d3-' + k]; assert.ok(v, 'falta --d3-' + k); for (let i = 0; i < 6 && /^var\(/.test(v); i++) v = t[v.match(/^var\((--d3-[\w-]+)/)[1]]; return cor(v); };
const sobre = (frente, fundo) => { const a = frente[3]; return [0, 1, 2].map((i) => frente[i] * a + fundo[i] * (1 - a)).concat(1); };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('pares críticos: botão cheio, botão secundário, selo, aba ativa e letra sobre o laranja dão 4,5:1 nos três temas', () => {
  const ruins = [];
  for (const [nome, t] of Object.entries(TEMAS)) {
    const v = (k) => resolver(t, k);
    const vidro = sobre(v('fume'), v('tema-fundo'));
    const painel = v('fume-painel');
    const folha = sobre(v('folha'), vidro);
    const cartao = v('cartao');
    const confere = (oque, letra, fundo) => { const f = sobre(fundo, [255, 255, 255, 1]); const r = contraste(sobre(letra, f), f); if (r < 4.5) ruins.push(`${nome}: ${oque} ${r.toFixed(2)}`); };
    // botão cheio: na folha (tinta + contra) e no vidro (fume-texto + fume-contra, o "Novo …" do topo das telas)
    confere('botão cheio da folha (contra sobre tinta)', v('contra'), v('tinta'));
    confere('botão cheio do vidro (fume-contra sobre fume-texto)', v('fume-contra'), v('fume-texto'));
    // aba ativa: o escolhido do seletor no vidro e na folha
    confere('aba ativa no vidro (fume-contra sobre fume-texto)', v('fume-contra'), v('fume-texto'));
    confere('aba ativa na folha (tinta sobre véu forte)', v('tinta'), sobre(v('veu-forte'), folha));
    // botão secundário: véu sobre o vidro, o painel e a folha
    for (const [onde, base] of [['vidro', vidro], ['painel', painel]]) {
      confere(`botão secundário no ${onde} (fume-texto sobre fume-veu-forte)`, v('fume-texto'), sobre(v('fume-veu-forte'), base));
      confere(`rótulo do botão secundário no ${onde} (fume-apagado sobre fume-veu)`, v('fume-apagado'), sobre(v('fume-veu'), base));
    }
    confere('botão secundário na folha (tinta sobre véu)', v('tinta'), sobre(v('veu'), folha));
    confere('botão secundário no cartão (tinta sobre cartão)', v('tinta'), cartao);
    // selos: a cor de função sobre o véu dela, em cima da folha e do cartão
    for (const [letra, veu] of [['perigo', 'perigo-veu'], ['pronto', 'pronto-veu'], ['info', 'info-veu'], ['ajuste', 'ajuste-veu'], ['agente-texto', 'agente-veu']]) {
      confere(`selo ${letra} na folha`, v(letra), sobre(v(veu), folha));
      confere(`selo ${letra} no cartão`, v(letra), sobre(v(veu), cartao));
    }
    // letra sobre o laranja (igual nos três): branco sobre a ação e a letra laranja no botão branco de dentro
    confere('letra branca sobre o laranja (escuro-texto sobre acao)', v('escuro-texto'), v('acao'));
    confere('letra branca no fim do degradê laranja (escuro-texto sobre acao-texto-fixa)', v('escuro-texto'), v('acao-texto-fixa'));
    confere('letra laranja no botão branco do laranja', v('acao-texto-fixa'), v('escuro-texto'));
  }
  assert.deepEqual(ruins, []);
});

// Os pares que viram a mesma cor num dos temas: fume-texto é escura no Claro (como a tinta) e a tinta fica clara na folha
// escura (como o branco escrito). O par certo de cada preenchimento é o "contra" dele.
const FRAGMENTOS = fs.readdirSync('padrao-v2').filter((f) => f.endsWith('.css') && !/^(0-d3-base|zt-temas)\.css$/.test(f));
function blocos(f) { return [...ler('padrao-v2/' + f).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), corpo: m[2] })); }
const letraDe = (corpo) => [...corpo.matchAll(/(?:^|;)\s*(?:color|-webkit-text-fill-color)\s*:\s*([^;]+)/g)].map((m) => m[1].trim());

test('fragmentos: preenchimento de fume-texto leva letra fume-contra, nunca a tinta (no Claro as duas são escuras)', () => {
  const ruins = [];
  for (const f of FRAGMENTOS) for (const { sel, corpo } of blocos(f)) {
    if (!/(?:^|;)\s*background(?:-color)?\s*:\s*var\(--d3-fume-texto\)\s*(?:;|$)/.test(corpo)) continue;
    for (const l of letraDe(corpo)) if (/^var\(--d3-tinta(-fixa)?\)$/.test(l)) ruins.push(`${f}: ${sel.slice(0, 90)} → ${l}`);
  }
  assert.deepEqual(ruins, []);
});

test('fragmentos: preenchimento de tinta leva letra contra, nunca branco escrito (na folha escura a tinta é clara)', () => {
  const ruins = [];
  for (const f of FRAGMENTOS) for (const { sel, corpo } of blocos(f)) {
    if (!/(?:^|;)\s*background(?:-color)?\s*:\s*var\(--d3-tinta\)\s*(?:;|$)/.test(corpo)) continue;
    for (const l of letraDe(corpo)) if (/^(#fff(fff)?|var\(--d3-escuro-texto\)|var\(--d3-cartao\)|var\(--d3-tinta\))$/i.test(l)) ruins.push(`${f}: ${sel.slice(0, 90)} → ${l}`);
  }
  assert.deepEqual(ruins, []);
});

test('fragmentos: preenchimento de laranja ou de cor de agente leva letra branca fixa, nunca a letra do tema', () => {
  const ruins = [];
  for (const f of FRAGMENTOS) for (const { sel, corpo } of blocos(f)) {
    if (!/(?:^|;)\s*background(?:-color)?\s*:\s*var\(--d3-(acao|laranja|agente)\)\s*(?:;|$)/.test(corpo)) continue;
    for (const l of letraDe(corpo)) if (/^var\(--d3-(tinta|cartao|fume-texto|contra|fume-contra)\)$/.test(l)) ruins.push(`${f}: ${sel.slice(0, 90)} → ${l}`);
  }
  assert.deepEqual(ruins, []);
});
