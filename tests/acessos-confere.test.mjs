// SAFE: o confere de acessos de 13/11/2026 (depois do PR #664) — leitura do código, sem banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('login devolve dono e coordenação, pela mesma regra da sessão (sem esperar o F5)', () => {
  const s = ler('vybe_sessao.js');
  const entrar = s.slice(s.indexOf('async function entrar('), s.indexOf('const b64'));
  assert.ok(entrar.includes('const dono = ehDonoPessoa({ id: Number(pessoa.id), monday_user_id: monday });'));
  assert.ok(entrar.includes('admin: dono || coordenacao, dono, coordenacao'));
  assert.doesNotMatch(entrar, /admin: Boolean\(pessoa\.admin\)/);
});

test('equipe: só um dono mexe no acesso de outro dono; a marca de admin não existe mais', () => {
  const p = ler('api/painel.js'), conta = ler('vybe-conta.js'), s = ler('vybe_sessao.js');
  assert.ok(p.includes("return res.status(403).json({ error: 'Só um dono mexe no acesso de outro dono.' });"));
  assert.ok(p.indexOf("Só um dono mexe no acesso de outro dono") < p.indexOf("if (['criar', 'desativar', 'reativar', 'apagar'].includes(acao))"), 'antes de senha, bloqueio e ciclo de vida');
  assert.ok(p.includes("if (acao === 'tornar_admin' || acao === 'tirar_admin') return res.status(400)"));
  assert.doesNotMatch(conta, /Tornar admin|Tirar admin/);
  assert.ok(conta.includes('<span class="eq-tag">dono</span>') && conta.includes('<span class="eq-tag">coordenação</span>'));
  assert.ok(s.includes('return { ...p, dono, coordenacao, admin: dono || coordenacao };'));
});

test('dinheiro: carteira sem valores para quem não é dono; Gestão não pede finanças para quem não é dono', () => {
  const cart = ler('server/carteira.js'), setor = ler('vybe-mundo-setor.js'), com = ler('vybe-mundo-comercial.js');
  assert.ok(cart.includes('const dinheiro = ehDonoPessoa(quem?.pessoa);') && cart.includes('for (const c of clientes || []) c.valor = null;'));
  for (const acao of ['contrato_salvar', 'churn_registrar', 'churn_apagar']) assert.ok(cart.includes(`if (acao === '${acao}') {\n    soDono(quem);`), acao);
  assert.ok(setor.includes("const veDinheiro = typeof souDonoDaSessao !== 'function' || souDonoDaSessao(), negado = Promise.resolve({ falha: 'negado' });"));
  assert.doesNotMatch(com.slice(com.indexOf('function palpiteDono'), com.indexOf('const souAdminAqui')), /souAdmin\(\)/, 'o palpite de dinheiro não usa a marca de admin');
  assert.ok(com.includes("['fornecedores', 'Fornecedores'],"), 'Fornecedores não é aba de dinheiro');
});

test('bugs claros: fatura, aviso, agentes, cobrança repetida, colar fatura', () => {
  const fin = ler('vybe-mundo-financeiro.js'), notif = ler('vybe-notificacoes.js'), ag = ler('vybe-mundo-agentes.js'), cri = ler('vybe-mundo-criacao.js');
  assert.ok(fin.includes("if (!/^\\d{4}-\\d{2}$/.test(u.fatura || ''))"), 'as setas de mês do cartão');
  assert.ok(fin.includes('Cole só a partir dele para não duplicar.'));
  assert.ok(notif.includes("n.monday_item_id || 'vybe:' + n.conteudo_id"));
  assert.ok(ag.includes("if (!r.ok || d.ok === false || d.falhou) throw new Error("));
  assert.ok(cri.includes('if (resp.repetida) {'));
});
