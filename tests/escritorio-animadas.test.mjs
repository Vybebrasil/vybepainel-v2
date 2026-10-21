// Roupas animadas (21/10/2026): o boneco vem do imager sem a peça animada e a
// tela por cima desenha os quadros. O índice gerado tem de casar com as folhas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const indice = JSON.parse(readFileSync('assets/escritorio/habbo/roupas_animadas.json', 'utf8'));

test('índice das roupas animadas: cada conjunto tem folha, camadas e quadros válidos', () => {
  assert.ok(Object.keys(indice).length >= 20);
  for (const [chave, d] of Object.entries(indice)) {
    assert.match(chave, /^(mc|pt|ha|he|fa|wa)-\d+$/);
    assert.match(d.folha, /^roupa_anim_[a-z]+_\d+\.png$/, 'a rota de arte só serve nomes simples');
    assert.ok(existsSync(`assets/escritorio/habbo/${d.folha}`), d.folha);
    assert.ok(d.camadas.some((c) => Object.values(c.d).some((q) => q.length > 1)), `${chave} tem animação`);
    for (const c of d.camadas) for (const q of Object.values(c.d).flat()) assert.equal(q.length, 7);
  }
});

test('a figura vai ao imager sem a peça animada e guarda as cores dela', () => {
  const c = vm.createContext({ window: {}, document: {}, fetch: async () => ({}), mapaArquivo: (n) => n, setInterval, clearInterval });
  vm.runInContext(readFileSync('vybe-escritorio-animadas.js', 'utf8'), c);
  vm.runInContext(`ANIMADAS.dados = ${JSON.stringify({ 'mc-6562': indice['mc-6562'] })};`, c);
  const r = vm.runInContext('animadasDaFigura("hd-180-1.hr-828-61.mc-6562-1408-90.lg-280-110")', c);
  assert.equal(r.base, 'hd-180-1.hr-828-61.lg-280-110');
  assert.deepEqual(JSON.parse(JSON.stringify(r.achadas)), [{ chave: 'mc-6562', tipo: 'mc', cores: [1408, 90] }]);
  assert.equal(vm.runInContext('animadasDaFigura("hd-180-1.lg-280-110")', c), null);
});
