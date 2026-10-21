import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Uma aba conectada por pessoa (Paulo, 21/10/2026: com duas telas a pessoa
// ficava conectada duas vezes e o áudio dobrava). Duas abas dividem o mesmo
// localStorage e o mesmo canal; só a que entrou por último fica conectada.
const fonte = readFileSync(new URL('../vybe-escritorio.js', import.meta.url), 'utf8');
const bloco = fonte.slice(fonte.indexOf('const ESCRITORIO_ABA_ID'), fonte.indexOf('if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("pagehide"'));

function navegador() {
  const dados = new Map(), canais = [];
  class Canal { constructor() { canais.push(this); } postMessage(m) { for (const c of canais) if (c !== this) c.onmessage?.({ data: m }); } }
  const aba = () => {
    const ctx = vm.createContext({ Math, Date, JSON, Number, Boolean, setInterval: () => 1, clearInterval: () => {}, setTimeout: (f) => f(),
      localStorage: { getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, String(v)), removeItem: (k) => dados.delete(k) },
      BroadcastChannel: Canal, escritorio: { conectado: false }, saidas: 0,
      renderEscritorio() {}, atualizarDockEscritorio() {}, sairChamadaEscritorio() {}, voltarAoEscritorio() {},
      desconectarEscritorio() { ctx.escritorio.conectado = false; ctx.saidas++; },
      conectarEscritorio() { if (ctx.escritorioOutraAbaConectada() && !ctx.escritorio.assumindoAba) return; ctx.escritorio.assumindoAba = false; ctx.escritorio.conectado = true; ctx.escritorioAbaAssumir(); } });
    vm.runInContext(bloco.replace(/^const /gm, 'var ').replace(/^function /gm, 'function '), ctx);
    return ctx;
  };
  return { aba };
}

test('a segunda aba não entra sozinha e "Trazer para esta aba" passa a conexão', () => {
  const nav = navegador(), a = nav.aba(), b = nav.aba();
  a.conectarEscritorio();
  assert.equal(a.escritorio.conectado, true);
  assert.equal(b.escritorioOutraAbaConectada(), true);
  b.conectarEscritorio();
  assert.equal(b.escritorio.conectado, false, 'a segunda aba ficou de fora');
  b.trazerEscritorioParaEstaAba();
  assert.equal(b.escritorio.conectado, true);
  assert.equal(a.escritorio.conectado, false, 'a primeira aba saiu');
  assert.equal(a.escritorio.emOutraAba, true);
  assert.equal(a.escritorioOutraAbaConectada(), true);
  assert.equal(b.escritorioOutraAbaConectada(), false);
});

test('aba que parou de se anunciar há mais de 12 s não segura as outras', () => {
  const nav = navegador(), a = nav.aba(), b = nav.aba();
  a.conectarEscritorio();
  a.localStorage.setItem('vybe-escritorio-aba', JSON.stringify({ aba: 'velha', em: Date.now() - 20000 }));
  assert.equal(b.escritorioOutraAbaConectada(), false);
});
