import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Auditoria de 09/11: "pessoa ativa" tinha três regras (RH 14, Equipe 9). A equipe é uma só: ativo AND pode_entrar.
const VIGIADAS = [
  ['server/pessoas.js', /SELECT id::text AS id, nome FROM vybe_pessoas WHERE ativo AND pode_entrar/],
  ['server/pessoas.js', /\(ativo AND pode_entrar\) AS ativo FROM vybe_pessoas/],
  ['server/pessoas.js', /WHERE id = \$\{id\} AND ativo AND pode_entrar/],
  ['server/carteira.js', /FROM vybe_pessoas WHERE ativo AND pode_entrar ORDER BY nome/],
  ['server/carteira.js', /WHERE id=\$\{pid\} AND ativo AND pode_entrar/],
  ['server/clientes-heads.js', /AND ativo AND pode_entrar FOR SHARE/],
  ['server/comercial.js', /WHERE p\.ativo AND p\.pode_entrar/],
  ['api/painel.js', /monday_user_id FROM vybe_pessoas\s+WHERE ativo AND pode_entrar ORDER BY nome/],
];
test('a equipe é contada pela mesma regra em todas as telas (ativo AND pode_entrar)', () => {
  for (const [arq, re] of VIGIADAS) assert.match(readFileSync(arq, 'utf8'), re, arq);
});
