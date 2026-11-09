// Cadastro único do cliente (09/11/2026): campos validados e a conferência de
// onde o cliente existe no ecossistema, sem dizer "ok" sem prova.
import test from 'node:test';
import assert from 'node:assert/strict';
import { separarCampos, completude, estadoNoEcossistema, parNoFinancas, CAMPOS_CADASTRO } from '../server/clientes-cadastro.js';

test('separa colunas antigas do que é novo e formata CNPJ', () => {
  const { colunas, extras } = separarCampos({ cnpj: '12345678000190', cidade: ' Irecê ', plano: 'Plus', contato_nome: 'Ana', inexistente: 'x' });
  assert.equal(colunas.cnpj, '12.345.678/0001-90');
  assert.equal(colunas.plano, 'Plus');
  assert.deepEqual(extras, { cidade: 'Irecê', contato_nome: 'Ana' });
});

test('recusa dado errado com frase de quem preencheu', () => {
  assert.throws(() => separarCampos({ cnpj: '123' }), /CNPJ precisa/);
  assert.throws(() => separarCampos({ contato_email: 'ana@' }), /e-mail inválido/);
  assert.throws(() => separarCampos({ contato_whatsapp: '9999' }), /DDD/);
  assert.throws(() => separarCampos({ uf: 'XX' }), /sigla/);
  assert.throws(() => separarCampos({ tipo_contrato: 'Vitalício' }), /opções/);
  assert.throws(() => separarCampos({ contrato_inicio: '2026-12-01', contrato_fim: '2026-01-01' }), /antes do início/);
});

test('campo vazio apaga; dinheiro só grava para quem vê dinheiro', () => {
  assert.deepEqual(separarCampos({ cidade: '' }).extras, { cidade: '' });
  assert.equal(separarCampos({ valor: '1.500,50' }).colunas.valor, '1500.5');
  assert.deepEqual(separarCampos({ valor: '1500', vencimento: '10' }, { veDinheiro: false }), { colunas: {}, extras: {} });
});

test('completude conta só os essenciais e diz o que falta', () => {
  const total = CAMPOS_CADASTRO.filter((c) => c.obrigatorio).length;
  const c = completude({ cnpj: '1', segmento: 'Academia', cadastro: { cidade: 'Irecê' } });
  assert.equal(c.total, total);
  assert.equal(c.feitos, 3);
  assert.ok(c.faltam.includes('Grupo do WhatsApp com o cliente'));
});

test('ecossistema: nada vira ok sem prova', () => {
  const cliente = { id: 7, nome: 'Academia Lions', ativo: true, cnpj: '', cadastro: {} };
  const s = Object.fromEntries(estadoNoEcossistema({ cliente }).map((l) => [l.id, l]));
  assert.equal(s.vybe_os.estado, 'ok');
  assert.equal(s.bots.estado, 'falta');      // sem grupo do WhatsApp
  assert.equal(s.drive.estado, 'falta');     // sem pasta ligada
  assert.equal(s.hub.estado, 'conferir');    // daqui não se vê o portal
  assert.equal(s.financas.estado, 'conferir'); // leitura desligada
});

test('ecossistema: com grupo, pasta e par no Finanças', () => {
  const cliente = { id: 7, nome: 'Academia Lions', ativo: true, cnpj: '12.345.678/0001-90', cadastro: { grupo_whatsapp: 'Lions x Vybe' } };
  const ligacao = parNoFinancas([{ id: 'f1', name: 'Lions Top', cnpj: '12345678000190' }], [{ id: '7', nome: 'Academia Lions', cnpj: '12.345.678/0001-90' }], 7);
  const s = Object.fromEntries(estadoNoEcossistema({ cliente, acesso: { drive: 'https://drive.google.com/x' },
    financas: { estado: 'lido', ligacao }, hubUrl: 'https://hub.vybe.com.br' }).map((l) => [l.id, l]));
  assert.equal(s.bots.estado, 'ok');
  assert.equal(s.drive.estado, 'ok');
  assert.equal(s.financas.estado, 'ok');
  assert.match(s.financas.detalhe, /pelo CNPJ/);
  assert.equal(s.hub.link, 'https://hub.vybe.com.br/admin');
});

test('ecossistema: inativo não aparece como ok nos bots', () => {
  const s = estadoNoEcossistema({ cliente: { id: 1, nome: 'X', ativo: false, cadastro: { grupo_whatsapp: 'g' } } });
  assert.equal(s.find((l) => l.id === 'bots').estado, 'falta');
});
