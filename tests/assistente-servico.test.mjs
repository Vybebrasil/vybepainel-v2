import test from 'node:test';
import assert from 'node:assert/strict';
import { autenticarAssistente } from '../server/assistente-servico.js';
const token = 'A'.repeat(64);
test('somente token exclusivo e suficientemente forte é aceito', () => {
  assert.equal(autenticarAssistente({headers:{authorization:'Bearer ' + token}}, token), true);
  assert.equal(autenticarAssistente({headers:{authorization:'Bearer ' + 'B'.repeat(64)}}, token), false);
  assert.equal(autenticarAssistente({headers:{authorization:'Bearer ' + token}}, 'curto'), false);
  assert.equal(autenticarAssistente({headers:{authorization:'Bearer ' + token + ' outro'}}, token), false);
  assert.equal(autenticarAssistente({headers:{}}, token), false);
});
