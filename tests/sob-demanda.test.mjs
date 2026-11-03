// Partes do painel que carregam sob demanda (vybe-sob-demanda.js). Elas ficam
// no index.html como <script type="vybe/sob-demanda">, e o resto do painel só
// pode entrar nelas pelas portas: chamar uma função de um grupo que ainda não
// carregou daria "não está definida" na hora do clique, e ler uma constante
// dele quebraria a tela inteira. Este teste cobra a fronteira.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
const tags = [...html.matchAll(/<script(?:\s+type="vybe\/sob-demanda"\s+data-grupo="([\w-]+)")?\s+src="\/([^"?]+)"\s*><\/script>/g)]
  .map((m) => ({ grupo: m[1] || null, arquivo: m[2] }));
const portas = vm.runInNewContext(`${fs.readFileSync('vybe-sob-demanda.js', 'utf8')}\n;SOB_DEMANDA_PORTAS`,
  { window: {}, document: { querySelectorAll: () => [] } });
const texto = (f) => fs.readFileSync(f, 'utf8');
const literal = (nome) => nome.replace(/\$/g, '\\$');

// O que um arquivo declara no topo e fica visível para os outros scripts.
function declarados(t) {
  const nomes = new Set();
  for (const m of t.matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) nomes.add(m[1]);
  for (const m of t.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) nomes.add(m[1]);
  for (const m of t.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) nomes.add(m[1]);
  return nomes;
}

test('cada grupo sob demanda tem arquivos no index.html e portas declaradas nele', () => {
  const grupos = new Set(tags.filter((t) => t.grupo).map((t) => t.grupo));
  assert.deepEqual([...grupos].sort(), Object.keys(portas).sort());
  for (const [grupo, nomes] of Object.entries(portas)) {
    const dele = new Set(tags.filter((t) => t.grupo === grupo).flatMap((t) => [...declarados(texto(t.arquivo))]));
    for (const nome of nomes) assert.ok(dele.has(nome), `${nome} não é declarada no grupo ${grupo}`);
  }
});

test('o resto do painel só entra num grupo sob demanda pelas portas', () => {
  const donoDe = new Map();
  for (const t of tags.filter((x) => x.grupo)) for (const n of declarados(texto(t.arquivo))) donoDe.set(n, t.grupo);
  const portaDe = new Map(Object.entries(portas).flatMap(([g, l]) => l.map((n) => [n, g])));
  // O HTML conta sem as próprias tags dos grupos (o onclick dos botões fixos).
  const leitores = [...tags.map((t) => ({ nome: t.arquivo, grupo: t.grupo, t: texto(t.arquivo) })),
    { nome: 'index.html', grupo: null, t: html.replace(/<script[^>]*sob-demanda[^>]*><\/script>/g, '') }];
  const furos = [];
  for (const { nome, grupo, t } of leitores) {
    const fonte = t.replace(/^\s*\/\/.*$/gm, '');
    for (const m of fonte.matchAll(/(?<![\w$.'"`-])([A-Za-z_$][\w$]*)(?![\w$])/g)) {
      const dono = donoDe.get(m[1]);
      if (!dono || dono === grupo || portaDe.get(m[1]) === dono) continue;
      // Nome repetido numa declaração local de quem lê é outra variável.
      if (new RegExp(`(?:const|let|var)\\s+${literal(m[1])}\\b`).test(fonte)) continue;
      // Chave de objeto ({ nome: … }) não é uso; `typeof nome` é guarda prevista.
      const depois = fonte.slice(m.index + m[1].length);
      if (/^\s*:/.test(depois) && !/\?\s*$/.test(fonte.slice(Math.max(0, m.index - 20), m.index))) continue;
      if (new RegExp(`typeof\\s+${literal(m[1])}\\s*[!=]==?`).test(fonte.slice(Math.max(0, m.index - 80), m.index + m[1].length + 20))) continue;
      furos.push(`${m[1]} (grupo ${dono}) em ${nome}`);
    }
  }
  assert.deepEqual([...new Set(furos)], []);
});

test('as chaves de sinal das mesas no núcleo são as que os jogos registram', () => {
  const nucleo = texto('vybe-escritorio.js').match(/const ESCRITORIO_SINAIS_MESAS = (\[[^\]]*\]);/);
  assert.ok(nucleo, 'ESCRITORIO_SINAIS_MESAS no vybe-escritorio.js');
  const registradas = tags.filter((t) => t.grupo === 'jogos')
    .flatMap((t) => [...texto(t.arquivo).matchAll(/registrarMesaEscritorio\(\{[\s\S]{0,300}?sinal: "(\w+)"/g)].map((m) => m[1]));
  assert.deepEqual(JSON.parse(nucleo[1]).sort(), registradas.sort());
});
