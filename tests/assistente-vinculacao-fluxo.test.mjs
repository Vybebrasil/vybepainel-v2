import test from 'node:test';
import assert from 'node:assert/strict';
import { emitirCodigo, consumirCodigo, limiteCodigosVinculacao } from '../server/assistente-vinculacao-fluxo.js';

const segredo = 'segredo-ficticio-de-mais-de-trinta-e-dois-caracteres';

test('não emite código para identidade inválida', async () => {
  await assert.rejects(() => emitirCodigo(() => { throw Error('Não chamar'); }, -1, segredo), /Pessoa inválida/);
});

test('não emite código quando usuário não tem acesso ao painel', async () => {
  const sql = async (partes, ...valores) => {
    if(partes.join('').includes('FOR UPDATE')) return [{id:11}];
    assert.match(partes.join('?'), /p.ativo IS TRUE/);
    assert.match(partes.join('?'), /p.pode_entrar IS TRUE/);
    assert.match(partes.join('?'), /COUNT\(\*\) FROM vybe_ai_desafios/);
    assert.match(partes.join('?'), /INTERVAL '1 hour'/);
    assert.equal(valores[2], 11);
    return [];
  };
  sql.comTransacao=fn=>fn(sql);
  assert.equal(await emitirCodigo(sql, 11, segredo), null);
});

test('código malformado não consulta banco', async () => {
  let chamados = 0;
  assert.equal(await consumirCodigo(() => { chamados++; }, '123456789@lid', 'abc', segredo), false);
  assert.equal(chamados, 0);
});

test('o consumo exige atualização de código não utilizado e vínculo único', async () => {
  const sql = async (partes, ...valores) => {
    const consulta = partes.join('?');
    if(consulta.includes('FOR UPDATE OF p')) return [{id:11}];
    assert.match(consulta, /usado_em IS NULL/);
    assert.match(consulta, /expira_em > NOW\(\)/);
    assert.match(consulta, /ON CONFLICT \(jid_hash\) DO UPDATE/);
    assert.equal(valores.length, 2);
    return [{ pessoa_id: 11 }];
  };
  sql.comTransacao=fn=>fn(sql);
  assert.equal(await consumirCodigo(sql, '123456789@lid', 'a'.repeat(20), segredo), true);
});


test('limite de emissão é 30 somente no Preview e 3 nos demais ambientes', async () => {
  assert.equal(limiteCodigosVinculacao('preview'), 30);
  assert.equal(limiteCodigosVinculacao('production'), 3);
  assert.equal(limiteCodigosVinculacao('development'), 3);
  assert.equal(limiteCodigosVinculacao('test'), 3);
});
