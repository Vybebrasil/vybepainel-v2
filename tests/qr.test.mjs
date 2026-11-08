import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

// Gerador de QR próprio do painel (Ferramentas). Gabarito: o gerador que vem dentro do bot
// (qrcode-terminal, só nesta máquina); sem ele, os testes estruturais ainda rodam.
const require = createRequire(import.meta.url);
const ctx = vm.createContext({ window: {}, TextEncoder }); vm.runInContext(readFileSync('vybe-qr.js', 'utf8'), ctx);
const QR = ctx.window.VybeQR;
const GABARITO = 'C:/whatsapp-ia/node_modules/qrcode-terminal/vendor/QRCode/index.js';

test('escolhe a menor versão que cabe e monta os padrões fixos', () => {
  const q = QR.matriz('VYBE', { ecc: 'M' });
  assert.equal(q.versao, 1); assert.equal(q.tamanho, 21);
  for (const [y, x] of [[0, 0], [0, 14], [14, 0]]) { assert.equal(q.modulos[y][x], true); assert.equal(q.modulos[y + 1][x + 1], false); assert.equal(q.modulos[y + 3][x + 3], true); }
  assert.equal(q.modulos[13][8], true); // módulo escuro fixo
  const longo = QR.matriz('https://wa.me/5574999999999?text=' + 'Olá, quero um orçamento da Vybe '.repeat(4));
  assert.ok(longo.versao > 4);
  assert.throws(() => QR.matriz('x'.repeat(400)), /longo demais/);
});

test('acentos viram UTF-8 e cabem no QR', () => {
  const q = QR.matriz('Promoção de verão em Irecê');
  assert.ok(q.versao >= 2);
  assert.match(QR.svg('Irecê'), /^<svg[^>]+viewBox="0 0 29 29"/);
});

test('igual, módulo por módulo, ao gerador do bot em todas as máscaras', { skip: !existsSync(GABARITO) }, () => {
  const Gab = require(GABARITO), Nivel = require('C:/whatsapp-ia/node_modules/qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel.js');
  const casos = ['VYBE', 'https://vybe.com.br', 'https://wa.me/5574999999999?text=Oi%2C%20quero%20falar%20com%20a%20Vybe', 'A'.repeat(90), 'B'.repeat(150), 'C'.repeat(200)];
  let conferidos = 0;
  for (const texto of casos) for (const ecc of ['L', 'M', 'Q', 'H']) {
    let q; try { q = QR.matriz(texto, { ecc }); } catch { continue; }
    for (let k = 0; k < 8; k++) {
      const g = new Gab(q.versao, Nivel[ecc]); g.addData(texto); g.makeImpl(false, k);
      const nosso = QR.matriz(texto, { ecc, mascara: k }).modulos;
      assert.deepEqual(JSON.parse(JSON.stringify(nosso.map((l) => l.map(Boolean)))), g.modules.map((l) => l.map(Boolean)), `${texto.slice(0, 12)} ${ecc} máscara ${k} versão ${q.versao}`);
      conferidos++;
    }
  }
  assert.ok(conferidos > 100);
});

test('link do WhatsApp: número brasileiro com DDD, mensagem codificada, número inválido não gera link', () => {
  const c = vm.createContext({ window: { addEventListener() {} }, document: {} });
  vm.runInContext(readFileSync('vybe-mundo-ferramentas.js', 'utf8'), c);
  const F = c.window.VybeFerramentas;
  assert.equal(F._linkWhatsapp('(74) 99999-8888', ''), 'https://wa.me/5574999998888');
  assert.equal(F._linkWhatsapp('+55 74 3641-2000', 'Olá! Quero um orçamento & mais'), 'https://wa.me/557436412000?text=Ol%C3%A1!%20Quero%20um%20or%C3%A7amento%20%26%20mais');
  assert.equal(F._linkWhatsapp('0055 74 99999 8888', ''), 'https://wa.me/5574999998888');
  for (const ruim of ['', '9999', '74 9999-99999999', 'abc']) assert.equal(F._linkWhatsapp(ruim, 'oi'), '');
});
