import test from 'node:test';
import assert from 'node:assert/strict';
import { pessoaVinculada } from '../server/assistente-vinculos.js';

test('hash inválido é rejeitado', async () => {
  let chamado = false;
  await assert.rejects(() => pessoaVinculada(() => { chamado = true; }, 'abc'), /Hash invalido/);
  assert.equal(chamado, false);
});

test('confere estado ativo e permissões e retorna o id associado', async () => {
  const hash = 'a'.repeat(64);
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    if(query.includes('to_regclass')) return [{pronta:true}];
    assert.match(query, /revogado_em IS NULL/);
    assert.match(query, /p.ativo = TRUE/);
    assert.match(query, /p.pode_entrar = TRUE/);
    assert.deepEqual(values, [hash]);
    return [{id: '17'}];
  };
  assert.equal(await pessoaVinculada(sql, hash), 17);
});

test('sem vínculo ativo não retorna pessoa', async () => {
  assert.equal(await pessoaVinculada(async (s) => s.join('').includes('to_regclass') ? [{pronta:true}] : [], 'b'.repeat(64)), null);
});
