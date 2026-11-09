import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Uma regra só de "cliente ativo" no servidor (auditoria de 09/11/2026): ativo E não marcado "não é cliente".
// Antes ~30 consultas usavam só COALESCE(ativo,true), e Eskinão, Freela, Vybe etc. entravam nas listas.
const arquivos = ['api/painel.js', ...readdirSync('server').filter((f) => f.endsWith('.js')).map((f) => 'server/' + f)];

test('toda consulta de vybe_clientes que filtra ativo também tira os "não é cliente"', () => {
  const faltando = [];
  for (const arq of arquivos) {
    const s = readFileSync(arq, 'utf8');
    for (const m of s.matchAll(/FROM vybe_clientes(?:\s+(\w+))?[\s\S]{0,400}?COALESCE\(((\w+)\.)?ativo, ?true\)([\s\S]{0,60})/g)) {
      const [, alias, , pre, depois] = m;
      if (pre && alias && pre !== alias) continue; // o "ativo" é de outra tabela da consulta (ex.: pessoas)
      if (/42703/.test(s.slice(Math.max(0, m.index - 160), m.index))) continue; // plano B de banco antigo sem a coluna
      if (!/nao_e_cliente/.test(depois)) faltando.push(`${arq}: …${m[0].slice(-120).replace(/\s+/g, ' ')}`);
    }
  }
  assert.deepEqual(faltando, []);
});

test('a Carteira trata os donos como gestão (não só quem administra)', () => {
  const s = readFileSync('server/carteira.js', 'utf8');
  assert.match(s, /const gestao = \(pessoa\) => Boolean\(pessoa\?\.admin\) \|\| ehDonoPessoa\(pessoa\)/);
  assert.doesNotMatch(s, /if \(!quem\.pessoa\.admin\) falhar/);
});

test('a lista de clientes manda ativo_de_verdade calculado pelo servidor', () => {
  assert.match(readFileSync('api/painel.js', 'utf8'), /\(COALESCE\(c\.ativo,true\) AND NOT COALESCE\(c\.nao_e_cliente,false\)\) AS ativo_de_verdade/);
});
