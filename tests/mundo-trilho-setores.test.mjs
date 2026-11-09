// SAFE: só lê o vybe-mundo.js e avalia a lista do trilho em memória.
// Paulo, 07/11/2026: módulos em setores com submódulos (ideia do AgencyFlow), sem tirar nenhum módulo que já existia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n'); // checkout no Windows
const ini = js.indexOf('  const TRILHO = [');
const fim = js.indexOf('  const subVisivel', ini);
// Avalia o bloco do trilho (TRILHO, SUBMODULOS e setorDe) com um svg falso.
const { TRILHO, SUBMODULOS, setorDe } = new Function('svg', `${js.slice(ini, fim)}; return { TRILHO, SUBMODULOS, setorDe };`)((d) => `<svg>${d}</svg>`);

test('trilho por setores: o separador não quebra a lista (String.prototype.sub existe)', () => {
  assert.ok(TRILHO.includes('-'));
  assert.ok(SUBMODULOS.length > 10);
  assert.ok(SUBMODULOS.every((x) => x.id && x.nome && x.setor.startsWith('setor:')));
});

test('trilho por setores: nenhum módulo antigo sumiu', () => {
  const diretos = TRILHO.filter((t) => typeof t === 'object').map((t) => t.id);
  const todos = new Set([...diretos, ...SUBMODULOS.map((x) => x.id)]);
  for (const id of ['hoje', 'gestao', 'tarefas', 'criar', 'gestor', 'direcao', 'agenda', 'clientes', 'equipe', 'jogos', 'predio', 'vybes']) // 'perfil' saiu para o menu da conta (auditoria 09/11)
    assert.ok(todos.has(id), `o módulo ${id} continua no trilho`);
  assert.equal(setorDe('agenda'), 'setor:producao');
  assert.equal(setorDe('hoje'), 'hoje');
});

test('Planejamentos (Centro de Operação) está em Produção e usa a janela de sempre', () => {
  const p = SUBMODULOS.find((x) => x.id === 'planejamentos');
  assert.equal(p.setor, 'setor:producao');
  assert.deepEqual(p.mod, ['VybePlanejamentos']);
  const mod = readFileSync(new URL('../vybe-mundo-planejamentos.js', import.meta.url), 'utf8');
  assert.match(mod, /area=planejamentos&acao=operacao/);
  assert.match(mod, /window\.abrirPlanejamento\(/);
  assert.match(mod, /zona === 'operacao'/);
});

// Dock no jeito do AgencyFlow (Paulo, 08/11/2026): categorias, setor que abre para baixo e a Visão geral de cada setor.
test('dock: setores e atalhos em categorias, na ordem Operação, Negócio, Time e Vybe', () => {
  const grupos = TRILHO.filter((t) => typeof t === 'object' && t.grupo).map((t) => t.grupo);
  assert.deepEqual([...new Set(grupos)], ['Operação', 'Negócio', 'Time', 'Vybe']);
  for (const t of TRILHO) if (typeof t === 'object' && Array.isArray(t.sub)) assert.ok(t.grupo, `${t.id} tem categoria`);
  assert.equal(TRILHO.find((t) => t.id === 'hoje').grupo, undefined, 'Hoje fica no topo, fora das categorias');
});

test('dock: cada setor (menos a Gestão, que já é a visão geral) abre a Visão geral do setor', () => {
  assert.match(js, /data-visao-setor="\$\{t\.id\}">Visão geral<\/button>/);
  assert.match(js, /if \(id === 'setor:gestao'\) \{ usarTrilho\('gestao'\); return; \}/);
  assert.match(js, /if \(dockLargo\(\)\) abrirVisaoSetor\(id\); else abrirSetor\(/);
  const setor = readFileSync(new URL('../vybe-mundo-setor.js', import.meta.url), 'utf8');
  for (const id of ['setor:producao', 'setor:clientes', 'setor:comercial', 'setor:financas', 'setor:pessoas']) assert.ok(setor.includes(`'${id}'`), `visão geral de ${id}`);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('/vybe-mundo-setor.js') > html.indexOf('/vybe-mundo.js'), 'o painel do setor carrega depois do mundo');
});

test('o Painel de trabalho (Gestor) é da Produção e toda navegação fecha o que estava aberto', () => {
  assert.equal(setorDe('gestor'), 'setor:producao');
  assert.match(js, /function limparTela\(\) \{/);
  assert.match(js, /if \(id !== 'criar' && id !== 'vybes'\) \{\n      limparTela\(\);/);
});

test('dock no modelo do AgencyFlow: cada coisa no seu setor, sem perder módulo, e a janela só com as abas do item', () => {
  // Produção = o "Projetos" do AgencyFlow (com fornecedores e creators); RH com a produtividade; Academy próprio.
  for (const id of ['projetos', 'conteudo', 'fornecedores', 'creators']) assert.equal(setorDe(id), 'setor:producao', id);
  assert.equal(setorDe('produtividade'), 'setor:pessoas');
  assert.equal(setorDe('conversas'), 'setor:comercial');
  assert.ok(TRILHO.some((t) => t && t.id === 'academy' && t.mod?.[0] === 'VybePessoas'), 'Academy é item próprio');
  assert.ok(!SUBMODULOS.some((x) => x.id === 'academy'), 'Academy não fica dentro de outro setor');
  // Auditoria 09/11: presença e gamificação não são RH. Equipe online é item do Time; Meu perfil fica no menu da conta.
  assert.ok(TRILHO.some((t) => t && t.id === 'equipe' && t.grupo === 'Time'), 'Equipe online é item próprio do Time');
  assert.ok(!SUBMODULOS.some((x) => x.id === 'equipe' || x.id === 'perfil'), 'Equipe e perfil fora do RH');
  assert.ok(js.includes("item('perfil', 'Meu perfil'"), 'Meu perfil no menu da conta');
  // Nenhum módulo sumiu.
  for (const id of ['gestor', 'tarefas', 'demandas', 'agenda', 'direcao', 'planejamentos', 'clientes', 'carteira', 'onboarding', 'churn', 'contratos',
    'funil', 'pacotes', 'orcamentos', 'financas', 'recebimentos', 'contas', 'inadimplencia', 'gestao', 'diario', 'performance', 'ai-usage', 'automacoes',
    'conta', 'rh', 'recrutamento', 'documentos', 'qr', 'whatsapp-link', 'roi']) assert.ok(SUBMODULOS.some((x) => x.id === id), id);
  assert.match(js, /abrir\?\.\(sub\.mod\[1\], \{ abas: irmaos, rotulo: setorNome \}\)/);
  // Segundo clique no setor aberto fecha os submenus.
  assert.match(js, /if \(b\.getAttribute\('aria-expanded'\) === 'true'\) \{ expandirSetor\(''\); return; \}/);
});

test('dock aceso só no que está na tela (auditoria 09/11, D10 e D13)', () => {
  // Fechar a janela de um módulo (X, Esc ou o próprio módulo) apaga o item e acende o que ficou à vista.
  for (const id of ['vv-carteira', 'vv-comercial', 'vv-pessoas', 'vv-conteudo', 'vv-ferramentas']) assert.ok(js.includes(`'${id}'`), id);
  assert.match(js, /function remarcarAoFechar\(\)/);
  assert.match(js, /marcarTrilho\(body\.classList\.contains\('mundo-cartoes'\) \? 'modulos' : 'hoje'\)/);
  // Abrir a agenda completa fecha o menu da Agenda, que ficava por cima da tela que abriu.
  assert.match(js, /function abrirAgenda\(dia\) \{[\s\S]{0,200}fecharDaDireita\(\);/);
});
