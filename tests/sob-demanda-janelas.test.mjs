// Janelas de módulo sob demanda (vybe-sob-demanda.js, SOB_DEMANDA_JANELAS; confere de 19/11/2026): o Comercial e o
// Pessoas só baixam quando abrem. Até lá window.VybeComercial / window.VybePessoas é um substituto com os mesmos
// métodos; a primeira chamada baixa o grupo e repassa para o objeto de verdade.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
const fonte = fs.readFileSync('vybe-sob-demanda.js', 'utf8');
const tags = [...html.matchAll(/<script type="vybe\/sob-demanda" data-grupo="([\w-]+)" src="\/([^"?]+)"><\/script>/g)].map((m) => ({ grupo: m[1], arquivo: m[2] }));

function montar() {
  const ouvintes = [], postos = [];
  const document = {
    querySelectorAll: (sel) => { const g = sel.match(/data-grupo="([\w-]+)"/)?.[1]; return tags.filter((t) => t.grupo === g).map((t) => ({ getAttribute: () => '/' + t.arquivo })); },
    createElement: () => ({ remove() {} }),
    body: { append: (s) => postos.push(s) },
    addEventListener: (tipo, fn, captura) => ouvintes.push({ tipo, fn, captura }),
  };
  const window = {};
  const ctx = vm.createContext({ window, document, Promise, Error, JSON, Object, Set });
  vm.runInContext(`${fonte}\n;this.JANELAS = SOB_DEMANDA_JANELAS;`, ctx);
  return { ctx, window, ouvintes, postos };
}

test('cada janela sob demanda tem arquivo no index.html e o objeto de verdade tem os mesmos métodos', () => {
  const { ctx } = montar();
  for (const [grupo, j] of Object.entries(ctx.JANELAS)) {
    const arquivos = tags.filter((t) => t.grupo === grupo).map((t) => t.arquivo);
    assert.ok(arquivos.length, `grupo ${grupo} sem <script type="vybe/sob-demanda"> no index.html`);
    const texto = arquivos.map((a) => fs.readFileSync(a, 'utf8')).join('\n');
    const obj = texto.match(new RegExp(`window\\.${j.nome}\\s*=\\s*\\{([^\\n]*)\\}`));
    assert.ok(obj, `${j.nome} não é declarado no grupo ${grupo}`);
    for (const m of [...j.portas, ...Object.keys(j.quietos || {})]) assert.match(obj[1], new RegExp(`\\b${m}\\b`), `${j.nome}.${m} sumiu do arquivo de verdade`);
    // Ninguém mais carrega o arquivo à força.
    assert.ok(!html.includes(`<script src="/${arquivos[0]}">`));
  }
});

test('o substituto responde fechado, baixa o grupo na primeira chamada e repassa ao objeto de verdade', async () => {
  const { window, postos } = montar();
  const sub = window.VybeComercial;
  assert.equal(sub.aberto(), false); assert.equal(sub.fechar(), undefined);
  assert.equal(typeof sub.abrir, 'function'); // o dock só mostra o item quando abrir é função
  const chamada = sub.abrir('funil', { abas: ['funil'] });
  assert.equal(postos.length, 1); assert.equal(postos[0].src, '/vybe-mundo-comercial.js');
  const recebidos = [];
  window.VybeComercial = { abrir: (...a) => { recebidos.push(a); return 'aberto'; }, fechar() {}, aberto: () => true };
  postos[0].onload();
  assert.equal(await chamada, 'aberto');
  assert.deepEqual(recebidos, [['funil', { abas: ['funil'] }]]);
  // A segunda chamada pelo substituto guardado (onclick antigo) não baixa de novo.
  await sub.abrir('pacotes'); assert.equal(postos.length, 1); assert.deepEqual(recebidos[1], ['pacotes']);
  const p = window.VybePessoas;
  assert.equal(p.aberto(), false); assert.equal(typeof p.carga, 'function'); assert.equal(typeof p.novoPedido, 'function');
});

test('a sala da planta abre o Comercial pelo substituto, antes do HUD', async () => {
  const { window, ouvintes, postos } = montar();
  const clique = ouvintes.find((o) => o.tipo === 'click' && o.captura === true);
  assert.ok(clique);
  let parou = false;
  const botao = { dataset: { modulo: JSON.stringify({ tipo: 'janela', alvo: 'comercial', aba: 'orcamentos' }) } };
  clique.fn({ target: { closest: () => botao }, preventDefault() {}, stopPropagation() { parou = true; } });
  assert.ok(parou); assert.equal(postos.length, 1);
  const recebidos = [];
  window.VybeComercial = { abrir: (...a) => recebidos.push(a), fechar() {}, aberto: () => true };
  postos[0].onload(); await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(recebidos, [['orcamentos']]);
  // Com o arquivo carregado, quem trata o clique é o próprio arquivo.
  parou = false; clique.fn({ target: { closest: () => botao }, preventDefault() {}, stopPropagation() { parou = true; } });
  assert.equal(parou, false);
});
