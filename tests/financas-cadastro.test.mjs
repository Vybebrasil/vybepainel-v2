// Vybe OS cria/atualiza o cliente no Finanças (server/vybe-financas-cadastro.js) por uma função só, e o cliente novo
// entra como Pendente (a função no Finanças garante; aqui conferimos o que vai e o que volta).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clienteParaFinancas, criarCadastroFinancas } from '../server/vybe-financas-cadastro.js';
import { estadoNoEcossistema } from '../server/clientes-cadastro.js';

const linha = { id: 7, nome: 'Academia Lions', cnpj: '12.345.678/0001-90', email: 'contato@lions.com', telefone: '(74) 3641-0000', plano: 'Plus', valor: '1500.00',
  cadastro: { contato_nome: 'Carla', contato_whatsapp: '(74) 99999-0001', vencimento: '10' } };

test('o que vai para o Finanças: responsável, WhatsApp dele, valor e vencimento do cadastro', () => {
  assert.deepEqual(clienteParaFinancas(linha), { nome: 'Academia Lions', cnpj: '12.345.678/0001-90', contato: 'Carla', email: 'contato@lions.com',
    telefone: '(74) 99999-0001', plano: 'Plus', valor: 1500, vencimento: 10 });
  assert.equal(clienteParaFinancas({ nome: 'X', valor: null, cadastro: { vencimento: '40' } }).vencimento, null);
});

test('sem a variável, nada é enviado', async () => {
  const c = criarCadastroFinancas({ env: {} });
  assert.equal(c.configurado(), false);
  assert.deepEqual(await c.salvar(linha), { estado: 'desligado' });
});

test('chama só a função do Finanças e traduz o erro sem vazar a conexão', async () => {
  const chamadas = [];
  const sqlFalso = (partes, ...valores) => { chamadas.push([partes.join('?'), valores]); return Promise.resolve([{ cliente_id: 'u-1', criado: true }]); };
  const c = criarCadastroFinancas({ env: { VYBE_FINANCAS_CADASTRO_URL: 'postgresql://vybe_os_cadastro:x@h:6543/postgres' }, criarSql: () => sqlFalso });
  assert.deepEqual(await c.salvar(linha), { estado: 'criado', id: 'u-1' });
  assert.match(chamadas[0][0], /public\.vybe_os_salvar_cliente\(/);
  assert.doesNotMatch(chamadas[0][0], /INSERT|UPDATE|DELETE/i);
  const ruim = criarCadastroFinancas({ env: { VYBE_FINANCAS_CADASTRO_URL: 'postgresql://u:senha@h/db' }, criarSql: () => () => Promise.reject(new Error('permission denied for function vybe_os_salvar_cliente')) });
  await assert.rejects(() => ruim.salvar(linha), (e) => /rode o SQL/.test(e.message) && !/senha/.test(e.message));
});

test('ecossistema oferece "Criar no Finanças" só com o cadastro do Finanças ligado', () => {
  const cliente = { id: 7, nome: 'Academia Lions', ativo: true, cnpj: '', cadastro: {} };
  const fin = (cria) => estadoNoEcossistema({ cliente, financas: { estado: 'lido', ligacao: null }, criaNoFinancas: cria }).find((l) => l.id === 'financas');
  assert.equal(fin(true).acao, 'criar_financas');
  assert.match(fin(true).detalhe, /Pendente/);
  assert.equal(fin(false).acao, 'abrir_financas');
});
