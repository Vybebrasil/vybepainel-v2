// Cadastro com cliente chamado pelo apelido: a tela mostra "Hellen", o banco
// conhece "Hellen Rocha". Criar tem que mandar o nome do banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function painel() {
  // A tabela de apelidos de verdade (vybe-config) e as funções de fora do
  // fechamento do cadastro.
  const c = vm.createContext({ console, window: {}, document: {}, localStorage: { getItem() { return null; } } });
  vm.runInContext(fs.readFileSync('vybe-config.js', 'utf8'), c);
  vm.runInContext(fs.readFileSync('cadastros_governed_v2.js', 'utf8').split('\n(function() {')[0], c);
  return (nome, fichas) => { c.a = [nome, fichas]; return vm.runInContext('cadastroNomeNoBanco(a[0], a[1], normalizarCliente)', c); };
}

const fichas = [
  { id: 1, nome: 'Hellen Rocha', ativo: true },
  { id: 2, nome: 'Voa Sportswear', ativo: true },
  { id: 3, nome: 'Gonzalez Gastronomia', ativo: true },
  { id: 4, nome: 'Gonzalez Advocacia', ativo: false },
  { id: 5, nome: 'Alpha1', ativo: true },
];

test('o apelido da tela volta a ser o nome do cadastro', () => {
  const nomeNoBanco = painel();
  assert.equal(nomeNoBanco('Hellen', fichas), 'Hellen Rocha');
  assert.equal(nomeNoBanco('VOA', fichas), 'Voa Sportswear');
});

test('nome que já é o do cadastro não muda, com qualquer caixa', () => {
  const nomeNoBanco = painel();
  assert.equal(nomeNoBanco('Alpha1', fichas), 'Alpha1');
  assert.equal(nomeNoBanco('hellen rocha', fichas), 'Hellen Rocha');
});

test('dois cadastros com o mesmo apelido: vale o ativo', () => {
  const nomeNoBanco = painel();
  assert.equal(nomeNoBanco('Gonzalez', fichas), 'Gonzalez Gastronomia');
});

test('sem correspondência única, o nome segue como está para o servidor responder', () => {
  const nomeNoBanco = painel();
  assert.equal(nomeNoBanco('Cliente novo', fichas), 'Cliente novo');
  assert.equal(nomeNoBanco('Hellen', []), 'Hellen');
  const duplicado = [{ nome: 'Gonzalez Gastronomia', ativo: true }, { nome: 'Gonzalez Advocacia', ativo: true }];
  assert.equal(nomeNoBanco('Gonzalez', duplicado), 'Gonzalez');
});
