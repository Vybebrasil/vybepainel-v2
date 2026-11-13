// Padrão v2 (moodboard aprovado, 12/11/2026): os quadros DEPOIS de Agentes, Perfil do agente e Automações.
// O essencial do que a tela monta: o baralho do que espera um dono, "Como cada um está indo", o perfil em nota,
// rotinas e achados que abrem no lugar, e as Automações com a frase do agente, três números, "Pede ação" e as regras.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('padrao-v2/agentes.css'), ag = ler('vybe-mundo-agentes.js'), auto = ler('vybe-automacoes-ui.js');

test('o CSS do grupo ganha pelo id da janela: sem !important e sem html body.mundo', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  const seletores = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').split('}').map((r) => r.split('{')[0].trim()).filter((s) => s && !s.startsWith('@'));
  for (const s of seletores) assert.match(s, /#vv-agentes|#automacoes-root/, `regra presa à janela: ${s.slice(0, 80)}`);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('Agentes: o que espera um dono é um baralho com as mesmas rotas de decisão; a fila inteira fica em "ver em lista"', () => {
  assert.match(ag, /class="v2-baralho v2a-baralho/, 'usa a peça pronta do padrão');
  assert.match(ag, /class="v2-carta v2a-carta\$\{anima\}" data-pos="\$\{pos\}"/);
  assert.match(ag, /<span class="v2-pontos">/);
  assert.match(ag, /seta para os lados passa/);
  assert.match(ag, /data-vga-lista>ver em lista</);
  for (const rota of ['data-vga-aprovacao="aprovar"', 'data-vga-aprovacao="recusar"', 'data-vga-licao="${acao}"', 'data-vga-licao-lote="${acao}"', 'data-vga-autonomia="${esc(it.setor)}"', 'data-vga-achado="${acao}"', 'data-vga-lote="${acao}"'])
    assert.ok(ag.slice(ag.indexOf('function attrsDoAchado'), ag.indexOf('function baralhoHtml')).includes(rota), rota);
  assert.match(ag, /sim: \['Pode fazer', ''\], nao: \['Não faça', ''\]/, 'os dois botões do quadro');
  assert.match(ag, /function listaDaFilaHtml\(F, dono, lendo\)[\s\S]*itemFilaHtml\(it, dono\)[\s\S]*Esperando confirmação/, 'a lista de antes continua a um clique');
  assert.match(ag, /e\.key === 'ArrowRight' \|\| e\.key === 'ArrowLeft'/);
  assert.match(ag, /Aprovar os \$\{varios\}/);
  assert.match(ag, /confirm\(`Dizer "pode fazer" aos \$\{itens\.length\} pedidos de uma vez\?/, 'aprovar todos pede confirmação');
});

test('Agentes: "Como cada um está indo" usa o acerto da central como nota e não repete o movimento a cada leitura', () => {
  assert.match(ag, /perfil\?\.numeros\?\.acerto/);
  assert.match(ag, /<h3 class="v2g-h2">Como cada um está indo<\/h3><span class="v2g-sub">nota dos últimos 7 dias<\/span>/);
  assert.match(ag, /class="v2a-agl" data-vga-setor="\$\{esc\(s\.id\)\}"/, 'a linha abre o agente');
  for (const lado of ["elo('todos', 'mostrar')", "elo('andar', 'por andar')", "elo('planejados', `planejados (${planejados.length})`)"]) assert.ok(ag.includes(lado), lado);
  assert.match(ag, /st\.anima = !mesmo;/, 'número e barra só chegam ao abrir ou trocar de vista');
  assert.doesNotMatch(ag, /volta sozinho para sombra/, 'não promete rebaixamento automático, que o sistema não faz');
});

test('Perfil do agente: voltar, trocar de agente, nota, o que ele faz, rotinas com chave, achados que abrem no lugar e a ficha a um clique', () => {
  assert.match(ag, /data-vga-fila>‹ Agentes<\/button>/);
  assert.match(ag, /data-vga-trocar aria-expanded="\$\{st\.trocar\}">Trocar de agente</);
  assert.match(ag, /<small>Nota · últimos 7 dias<\/small>/);
  assert.match(ag, /<h3 class="v2g-h2">O que ele faz<\/h3>/);
  assert.match(ag, /titulo: 'Esperando a sua decisão'/);
  assert.match(ag, /<h3 class="v2g-h2">Agora<\/h3>\$\{centralHtml\(\)\}/);
  assert.match(ag, /class="v2g-tg" role="switch" aria-checked="\$\{r\.ligada\}" data-vga-rotina=/);
  assert.match(ag, /class="v2-abre v2a-achado" aria-expanded="\$\{exp\}"/);
  for (const acao of ['resolvido', 'ignorar', 'errado']) assert.ok(ag.includes(`data-vga-achado="${acao}" data-vga-chave="\${esc(a.chave)}"`), acao);
  const ficha = ag.slice(ag.indexOf('const ficha = !st.mais'), ag.indexOf('function topoHtml'));
  for (const pedaco of ['estadoFormHtml(s, modo)', 'atividadeDoAgenteHtml', 'projecaoHtml(P)', 'licoesHtml(P, dono)', 'data-vga-form', '${autonomia}']) assert.ok(ficha.includes(pedaco), `na ficha: ${pedaco}`);
});

function telaDeAutomacoes({ admin = true, regras } = {}) {
  const nos = {};
  const no = (id) => (nos[id] ||= { id, innerHTML: '', textContent: '', dataset: {}, hidden: false, classList: { add() {} }, querySelectorAll: () => [], querySelector: () => null });
  const c = vm.createContext({ console, Date, JSON, Number, String, Array, Object, Boolean, Math, setTimeout,
    safeText: (s) => String(s ?? '').replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x])),
    vbCabecalhoHtml: ({ titulo, acoes }) => `<header><h2>${titulo}</h2>${acoes}</header>`, vbEstadoHtml: () => '<i>carregando</i>',
    sessaoAtual: () => ({ admin }), GRUPOS_NOME: { saida: 'Saída de Publicações' }, PESSOAS: {},
    document: { getElementById: (id) => { if (id !== 'automacoes-root' && !new RegExp(`id="${id}"`).test(nos['automacoes-root']?.innerHTML || '')) return null; return no(id); } } });
  c.window = c;
  vm.runInContext(auto, c);
  c.regrasDeTeste = regras;
  vm.runInContext('AUTOMACOES = regrasDeTeste; pintarAutomacoes();', c);
  return { c, no, raiz: nos['automacoes-root'] };
}
const regra = (id, nome, ativa, total, mes) => ({ id, nome, ativa, gatilho: { tipo: 'status', para: 'aprovado' }, condicao: null, acoes: [{ tipo: 'grupo', para: 'saida' }], execucoes_total: total, execucoes_30_dias: mes, ultima_em: '2026-11-12T10:00:00Z' });

test('Automações: cabeçalho com Regras/Falhas, Mais e Nova regra; fala do agente, três números, "Pede ação" e regras em linha', () => {
  const { c, no, raiz } = telaDeAutomacoes({ regras: [regra(1, 'Aprovado vira Saída', true, 88, 61), regra(2, 'Outra', true, 5, 3), regra(3, 'Parada de vez', false, 12, 0), regra(4, 'Quarta', true, 1, 1), regra(5, 'Quinta', true, 1, 1), regra(6, 'Sexta', true, 1, 1)] });
  assert.match(raiz.innerHTML, /<h2>Automações<\/h2><div class="v2g-seg ar-abas" role="radiogroup"/);
  assert.match(raiz.innerHTML, /class="v2g-btn p auto-novo" onclick="editarAutomacao\(null\)">Nova regra</);
  assert.equal((raiz.innerHTML.match(/class="v2g-btn p/g) || []).length, 1, 'uma ação principal na tela');
  assert.ok(raiz.innerHTML.indexOf('id="auto-fala"') < raiz.innerHTML.indexOf('id="auto-kpis"') && raiz.innerHTML.indexOf('id="auto-kpis"') < raiz.innerHTML.indexOf('id="auto-pede"'), 'fala, números, pede ação');
  assert.match(no('auto-fala').innerHTML, /As 5 regras ligadas fizeram <b>67 ações em 30 dias<\/b> sem ninguém tocar\./);
  assert.equal((no('auto-kpis').innerHTML.match(/class="v2g-card v2g-kpi/g) || []).length, 3, 'três números');
  assert.match(no('auto-kpis').innerHTML, /<span class="v2-num">5<\/span> <i>de 6<\/i>/);
  assert.match(no('auto-pede').innerHTML, /Conferindo as falhas…|Desligada/);
  const lista = no('auto-regras-lista').innerHTML;
  assert.equal((lista.match(/class="v2-abre v2r-regra/g) || []).length, 4, 'quatro regras na frente');
  assert.match(lista, /\+ 2 regras recolhidas · <a href="#" role="button" class="v2g-link" onclick="mostrarTodasAsRegras\(true\);return false">mostrar<\/a> · clicar na regra abre e edita/);
  assert.match(lista, /role="switch" aria-checked="true"[\s\S]*?Testar regra[\s\S]*?<em>Quando<\/em> o status virar “aprovado”[\s\S]*?<em>então<\/em> move para Saída de Publicações<span class="v2g-sub">88 ações<\/span>/);
  assert.match(no('auto-regras-chips').innerHTML, /Todas <b>6<\/b>[\s\S]*Ligadas <b>5<\/b>[\s\S]*Desligadas <b>1<\/b>[\s\S]*>Filtros</);

  // As falhas chegam: a fala, o número e o "Pede ação" passam a contar as pendentes, com as duas saídas na linha.
  c.aoLerFalhasDeAutomacoes([{ estado: 'pendente', item: 'vybe:1', ocorrencia: '7', titulo: 'Post <b>', motivo: 'sem responsável' }, { estado: 'resolvida', item: 'vybe:2', titulo: 'x', motivo: 'y' }]);
  assert.match(no('auto-fala').innerHTML, /<b>1 encaminhamento falhou<\/b> e espera alguém/);
  assert.match(no('auto-fala').innerHTML, /trocarAbaAutomacoes\('falhas'\)">Ver a falha</);
  assert.match(no('auto-kpis').innerHTML, /v2g-kpi ruim"><small>Falhas<\/small><b><span class="v2-num">1<\/span>/);
  const pede = no('auto-pede').innerHTML;
  assert.match(pede, /<span class="v2g-pill r">Falhou<\/span><p><b>Post &lt;b&gt;<\/b> · sem responsável<\/p>/, 'o texto da falha não vira HTML');
  assert.match(pede, /diagnosticarAutomacao\(this\.dataset\.item,this\)">Ver diagnóstico<[\s\S]*retomarEncaminhamentoDaPeca\(this\.dataset\.item,this\.dataset\.evento,this\)">Tentar de novo</);
  assert.match(pede, /<span class="v2g-pill a">Desligada<\/span><p><b>Parada de vez<\/b> · chegou a rodar 12 vezes<\/p>\s*<button type="button" class="v2g-btn s" onclick="alternarAutomacao\(3\)">Ligar</);

  // Busca e fichas repintam só a lista (a busca não perde o foco).
  c.buscarRegras('parada');
  assert.equal((no('auto-regras-lista').innerHTML.match(/class="v2-abre v2r-regra/g) || []).length, 1);
  c.buscarRegras(''); c.filtrarRegras('ligada');
  assert.equal((no('auto-regras-lista').innerHTML.match(/class="v2-abre v2r-regra/g) || []).length, 5, 'recorte mostra todas as que casam');
});

test('Automações: sem regra, uma frase e o botão; quem não administra não liga, não testa e não cria', () => {
  const vazia = telaDeAutomacoes({ regras: [] }).raiz.innerHTML;
  assert.match(vazia, /Nenhuma regra ainda\. Uma regra move, atribui ou avisa sozinha quando uma peça muda\.<\/p><button type="button" class="v2g-btn p auto-novo"/);
  assert.doesNotMatch(vazia, /id="auto-kpis"|id="auto-pede"/);
  const { raiz, no } = telaDeAutomacoes({ admin: false, regras: [regra(1, 'Uma', true, 2, 1), regra(2, 'Duas', false, 0, 0)] });
  assert.doesNotMatch(raiz.innerHTML, /Nova regra|Recalcular prioridades/);
  const lista = no('auto-regras-lista').innerHTML;
  assert.doesNotMatch(lista, /role="switch"|Testar regra|Editar a regra/);
  assert.match(lista, /<span class="v2g-pill g">Ligada<\/span>[\s\S]*<span class="v2g-pill n">Desligada<\/span>/);
  assert.match(lista, /clicar na regra abre<\/p>/);
});

test('Automações: o registro vira uma linha por ação, com o selo do que a regra fez', () => {
  const { c, no } = telaDeAutomacoes({ regras: [regra(1, 'Aprovado vira Saída', true, 88, 61)] });
  c.execs = [['grupo → saida'], ['responsáveis replace'], ['notificação'], ['status → aprovado'], [], ['grupo → saida']].map((feitas, i) => ({ em: '2026-11-10T12:00:00Z', titulo: 'Peça ' + i, automacao: 'Aprovado vira Saída', feitas, evento: { tipo: 'status', de: 'a', para: 'b' } }));
  vm.runInContext('EXECUCOES = execs; pintarHistorico();', c);
  const h = no('auto-historico').innerHTML;
  assert.deepEqual([...h.matchAll(/class="v2g-pill \w">(\w+)</g)].map((m) => m[1]), ['Moveu', 'Atribuiu', 'Avisou', 'Mudou'], 'quatro na frente');
  assert.match(h, /\+ 2 ações · <a href="#" role="button" class="v2g-link" onclick="mostrarHistoricoInteiro\(true\);return false">mostrar</);
  assert.match(no('auto-regras-lista').innerHTML, /A última ação foi em Peça 0,/, 'a regra aberta diz a última ação dela');
});
