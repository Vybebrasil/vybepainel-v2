import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Os scripts do painel dividem um escopo global, na ordem do index.html: uma
// segunda "function x" com o mesmo nome substitui a primeira em silêncio.
// Já quebrou o "Fechar" das fichas do Escritório (a prévia do catálogo
// reaproveitou fecharFichaMovelEscritorio) e o sino de notificações (quandoFoi
// das automações recebia Date; a das notificações, texto) — Paulo, 19/10/2026.
test('nenhuma função global é declarada duas vezes nos scripts do painel', () => {
  const html = readFileSync('index.html', 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1])
    .filter((s) => !/^https?:/.test(s)).map((s) => s.replace(/^\.?\//, '').split('?')[0]).filter((s) => existsSync(s));
  assert.ok(scripts.length > 20, 'achou os scripts do index.html');
  const onde = new Map();
  for (const f of scripts) {
    for (const m of readFileSync(f, 'utf8').matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      onde.set(m[1], [...(onde.get(m[1]) || []), f]);
    }
  }
  const repetidas = [...onde].filter(([, l]) => l.length > 1).map(([n, l]) => `${n}: ${l.join(', ')}`);
  assert.deepEqual(repetidas, []);
});
