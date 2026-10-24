import test from 'node:test';
import assert from 'node:assert/strict';
import { minhasDemandas, validarPessoaId } from '../server/assistente-consultas.js';

test('identidade inválida é rejeitada antes de consultar banco', async () => {
  let executou = false;
  const sql = () => { executou = true; throw Error('Não deve consultar'); };
  await assert.rejects(() => minhasDemandas(sql, 0), /Identidade interna inválida/);
  await assert.rejects(() => minhasDemandas(sql, '1'), /Identidade interna inválida/);
  assert.equal(executou, false);
  assert.equal(validarPessoaId(1), true);
  assert.equal(validarPessoaId(-2), false);
});

test('retorna somente campos operacionais e conserva clientes múltiplos', async () => {
  const fake = async (strings, ...values) => {
    assert.match(strings.join('?'), /vybe_conteudo_responsaveis/);
    assert.match(strings.join('?'), /r.pessoa_id=/);
    assert.equal(values[0], 8385559107);
    assert.equal(values[1], 17);
    return [{
      id: '41', titulo: 'Peça de teste', prazo: '2026-10-23',
      status: 'Em produção', clientes: [{ id: 3, nome: 'Cliente de teste' }],
      briefing: 'NÃO RETORNAR', atualizado_em: '2026-10-23T10:00:00Z',
    }];
  };
  const resultado = await minhasDemandas(fake, 17);
  assert.equal(resultado.itens.length, 1);
  assert.equal(resultado.itens[0].titulo, 'Peça de teste');
  assert.equal(resultado.itens[0].briefing, undefined);
  assert.equal(resultado.itens[0].clientes.length, 1);
});
