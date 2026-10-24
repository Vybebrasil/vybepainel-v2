import test from 'node:test';
import assert from 'node:assert/strict';
import { validarJid, identificadorProtegido, criarDesafioVinculacao, validarDesafio } from '../server/assistente-identidade.js';

const segredo = 'segredo-de-teste-com-mais-de-32-caracteres-para-hmac';
const agora = Date.parse('2026-10-23T10:00:00Z');

test('aceita @lid e @c.us somente em formatos explícitos', () => {
  assert.equal(validarJid('123456789@lid'), true);
  assert.equal(validarJid('5511999999999@c.us'), true);
  assert.equal(validarJid('123@g.us'), false);
  assert.equal(validarJid('abc@lid'), false);
  assert.equal(validarJid('123456789@lid\n'), false);
});

test('não confunde LID e número telefônico', () => {
  assert.notEqual(identificadorProtegido('123456789@lid', segredo),
    identificadorProtegido('123456789@c.us', segredo));
});

test('desafio expira em 10 minutos e deve ser consumido uma única vez', () => {
  const desafio = criarDesafioVinculacao(segredo, agora);
  const entrada = { ...desafio };
  assert.equal(validarDesafio(entrada, segredo, agora + 9 * 60_000), true);
  assert.equal(validarDesafio(entrada, segredo, agora + 10 * 60_000), false);
  assert.equal(validarDesafio({ ...entrada, usadoEm: new Date().toISOString() }, segredo, agora + 1000), false);
  assert.equal(validarDesafio({ ...entrada, codigo: 'f'.repeat(20) }, segredo, agora + 1000), false);
});
