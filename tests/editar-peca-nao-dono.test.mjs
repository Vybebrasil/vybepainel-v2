// Quem é da equipe e não é dono troca o status e o responsável da peça e da demanda (Reriston, 16/11/2026: "não
// conseguiu nem mudar o responsável nem o status"). A causa foi o roteiro da tela abrindo por cima do menu
// (tests/temas-tutorial.test.mjs); aqui fica preso o resto do caminho: os editores não pedem dono e a gravação sai para
// /api/conteudo com a sessão de quem é da equipe, como sempre foi. SAFE: sandbox com fetch falso, sem rede nem banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const corpoDe = (fonte, nome) => {
  const i = fonte.search(new RegExp(`(?:async\\s+)?function ${nome}\\(`));
  assert.ok(i >= 0, `falta ${nome}`);
  const fim = fonte.indexOf('\n}\n', i);
  return fonte.slice(i, fim > i ? fim : i + 4000);
};

test('equipe: a troca de status e a de responsável gravam em /api/conteudo com a sessão de quem não é dono', async () => {
  const pedidos = [], avisos = [];
  const c = vm.createContext({
    console: { ...console, error() {}, warn() {} }, Date,
    SESSAO_ATUAL: { id: 68036697, nome: 'Reriston', dono: false, admin: false },
    showToast: (...a) => avisos.push(a),
    fetch: async (url, op) => { pedidos.push({ url, metodo: op.method, credenciais: op.credentials, corpo: JSON.parse(op.body) });
      return { ok: true, status: 200, json: async () => ({ ok: true, replica_monday: 'ok' }) }; },
  });
  vm.runInContext(ler('vybe-dominio.js'), c);
  const peca = { id: 'vybe:915', status: 'Em andamento' };
  const r = await vm.runInContext('(item) => tentarEscritaDupla(item, { acao: "status", item: "vybe:915", para: "pode_fazer", _devolve: true })', c)(peca);
  assert.equal(r.ok, true);
  assert.equal(await vm.runInContext('(item) => tentarEscritaDupla(item, { acao: "responsaveis", item: "vybe:915", pessoas: ["68036697"] })', c)(peca), true);
  assert.deepEqual(JSON.parse(JSON.stringify(pedidos)), [
    { url: '/api/conteudo', metodo: 'POST', credenciais: 'same-origin', corpo: { acao: 'status', item: 'vybe:915', para: 'pode_fazer' } },
    { url: '/api/conteudo', metodo: 'POST', credenciais: 'same-origin', corpo: { acao: 'responsaveis', item: 'vybe:915', pessoas: ['68036697'] } },
  ]);
  assert.equal(avisos.length, 0, 'nada de erro para quem é da equipe');
});

test('equipe: abrir e gravar os editores de status e de responsável não pergunta se é dono (nem antes, nem agora)', () => {
  const status = ler('vybe-status.js'), gestor = ler('vybe-gestor.js'), portoes = ler('vybe-portoes.js');
  const trancas = /souDono|SESSAO_ATUAL|podeAdministrar|\.dono\b|\.admin\b|coordenacao/;
  for (const [fonte, nome] of [[status, 'openStatusEditor'], [status, 'updateFocusStatus'], [status, 'commitStatusChange'],
    [gestor, 'openOwnerEditor'], [gestor, 'saveOwnerAssignments'], [gestor, 'gravarResponsaveisDaPeca'], [portoes, 'openManualHandoff']]) {
    // Ferramentas de etiqueta (renomear, cor, ordem) seguem de quem administra; a escolha do status não.
    const corpo = corpoDe(fonte, nome).replace(/podeGerirEtiquetas\(\)/g, '').replace(/ferramentasDaEtiquetaHtml|chaveDaEtiquetaHtml|juntarAprovacaoNoSeletorHtml/g, '');
    assert.doesNotMatch(corpo, trancas, `${nome} não pode depender de ser dono`);
  }
  // O servidor deixa toda sessão trocar status e responsáveis; só mover entre quadros é de quem administra.
  const api = ler('api/conteudo.js');
  assert.match(api, /if \(acao === 'status'\) \{\n\s+if \(!corpo\.para\)[^\n]*\n\s+return res\.status\(200\)/);
  assert.match(api, /if \(acao === 'responsaveis'\) \{\n\s+return res\.status\(200\)/);
  assert.match(api, /acao === 'mover_board' && !\(quem\.tipo === 'servico' \|\| quem\.pessoa\?\.admin\)/);
});
