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
  assert.match(ag, /<h3 class="v2g-h2">Como cada um está indo<\/h3><span class="v2g-sub">acerto · 7 dias<\/span>/);
  assert.match(ag, /class="v2a-agl d3t-agl\$\{nota != null \? ' v2-humor' : ''\}"[^>]*data-vga-setor="\$\{esc\(s\.id\)\}"/, 'a linha abre o agente (com a cor do humor quando há nota)');
  for (const lado of ["ficha('todos',", "ficha('andar', 'Por andar')", "ficha('planejados', `${planejados.length} planejados`)"]) assert.ok(ag.includes(lado), lado);
  assert.match(ag, /st\.anima = !mesmo;/, 'número e barra só chegam ao abrir ou trocar de vista');
  assert.doesNotMatch(ag, /volta sozinho para sombra/, 'não promete rebaixamento automático, que o sistema não faz');
});

test('Perfil do agente: voltar, trocar de agente, nota, o que ele faz, rotinas com chave, achados que abrem no lugar e a ficha a um clique', () => {
  assert.match(ag, /data-vga-fila>‹ Agentes<\/button>/);
  assert.match(ag, /data-vga-trocar aria-expanded="\$\{st\.trocar\}">Trocar de agente</);
  assert.match(ag, /rotulo: 'Acerto · 7 dias'/);
  assert.match(ag, /<h3 class="v2g-h2">O que faz<\/h3>/);
  assert.match(ag, /titulo: 'Esperando você'/);
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

test('Automações (prancha V2-M-Automacoes): título no vidro com Nova regra, uma folha com Regras e Falhas, três números, a lista em linha e a consulta com o laranja, o que a regra faz e o que pede ação', () => {
  const { c, no, raiz } = telaDeAutomacoes({ regras: [regra(1, 'Aprovado vira Saída', true, 88, 61), regra(2, 'Outra', true, 5, 3), regra(3, 'Parada de vez', false, 12, 0), regra(4, 'Quarta', true, 1, 1), regra(5, 'Quinta', true, 1, 1), regra(6, 'Sexta', true, 1, 1)] });
  assert.match(raiz.innerHTML, /<div class="d3m-e-tela d3m-e-auto" data-vazia="false">/);
  assert.match(raiz.innerHTML, /<span class="d3m-e-h" role="heading" aria-level="2">Automações<\/span><span class="d3m-e-sub">regras que movem as demandas sozinhas · 6 regras, 5 ligadas<\/span>/);
  assert.match(raiz.innerHTML, /<div class="d3m-e-cab"><b>Regras<\/b><div class="d3m-e-seg ar-abas" role="radiogroup"/, 'Regras e Falhas no alternador da cabeça da folha');
  // Prancha: "Nova regra" é a pastilha branca do topo; o único laranja cheio é o cartão do agente, quando há falha.
  assert.match(raiz.innerHTML, /class="d3v-btn d3m-e-claro auto-novo" onclick="editarAutomacao\(null\)">.*Nova regra</);
  assert.doesNotMatch(raiz.innerHTML, /class="v2g-btn p/, 'nenhum botão laranja fora do cartão de ação');
  const pos = (id) => raiz.innerHTML.indexOf(`id="${id}"`);
  assert.ok(pos('auto-kpis') > 0 && pos('auto-kpis') < pos('auto-regras-lista') && pos('auto-regras-lista') < pos('auto-fala') && pos('auto-fala') < pos('auto-tipos') && pos('auto-tipos') < pos('auto-pede'), 'a folha (números e lista) e depois a consulta (ação, o que a regra faz, pede ação)');
  // Sem falha não há ação: o laranja não aparece.
  assert.equal(no('auto-fala').hidden, true); assert.equal(no('auto-fala').innerHTML, '');
  assert.equal((no('auto-kpis').innerHTML.match(/class="d3m-e-au-num[ "]/g) || []).length, 3, 'três números');
  assert.match(no('auto-kpis').innerHTML, /<b>5<small class="d3m-e-au-de"> \/ 6<\/small><\/b><span>Regras ligadas<\/span>/);
  assert.match(no('auto-kpis').innerHTML, /<b>67<\/b><span>Ações em 30 dias<\/span>/);
  // O que uma regra pode fazer: as três linhas da prancha, com quantas vezes cada tipo rodou em 30 dias.
  assert.match(no('auto-tipos').innerHTML, /<b>Mover<\/b> · trocar o grupo ou o status da peça<\/span><b class="d3m-vn">67<\/b>[\s\S]*<b>Atribuir<\/b> · dar um dono<\/span><b class="d3m-vn">0<\/b>[\s\S]*<b>Avisar<\/b> · no grupo ou a uma pessoa<\/span><b class="d3m-vn">0<\/b>/);
  const lista = no('auto-regras-lista').innerHTML;
  assert.equal((lista.match(/class="v2-abre d3m-e-au-regra/g) || []).length, 6, 'a lista inteira (até 8 na frente)');
  assert.doesNotMatch(lista, /regras recolhidas/); assert.match(lista, /clicar na regra abre e edita/);
  assert.match(lista, /role="switch" aria-checked="true"[\s\S]*?<em class="d3m-e-au-q">Quando<\/em> o status virar “aprovado”[\s\S]*?<em class="d3m-e-au-q">então<\/em> move para Saída de Publicações<\/span><\/button>[\s\S]*?<span class="d3m-e-au-n">88 ações<\/span>[\s\S]*?aria-label="Testar regra Aprovado vira Saída"[^>]*>Testar</);
  assert.match(no('auto-regras-chips').innerHTML, /Todas <b>6<\/b>[\s\S]*Ligadas <b>5<\/b>[\s\S]*Desligadas <b>1<\/b>[\s\S]*>Filtros</);
  // Pede ação: a regra desligada, com a saída na linha.
  assert.match(no('auto-pede').innerHTML, /<span class="d3m-e-au-selo">Desligada<\/span> <b>Parada de vez<\/b> · chegou a rodar 12 vezes<\/p><button type="button" class="d3v-btn s vidro" onclick="alternarAutomacao\(3\)">Ligar</);

  // As falhas chegam: o laranja do agente aparece com a frase e as duas saídas, e o número passa a contar as pendentes.
  c.aoLerFalhasDeAutomacoes([{ estado: 'pendente', item: 'vybe:1', ocorrencia: '7', titulo: 'Post <b>', motivo: 'sem responsável' }, { estado: 'resolvida', item: 'vybe:2', titulo: 'x', motivo: 'y' }]);
  const fala = no('auto-fala').innerHTML;
  assert.equal(no('auto-fala').hidden, false);
  assert.match(fala, /class="d3m-laranja d3m-e-au-lar"[\s\S]*Cícero · Automação[\s\S]*<b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">1 falha espera alguém: sem responsável\.<\/span><small class="d3m-lar-sub">Post &lt;b&gt;<\/small>/, 'o texto da falha não vira HTML');
  assert.match(fala, /retomarEncaminhamentoDaPeca\(this\.dataset\.item,this\.dataset\.evento,this\)">Tentar de novo<[\s\S]*diagnosticarAutomacao\(this\.dataset\.item,this\)">Ver diagnóstico</);
  assert.match(no('auto-kpis').innerHTML, /class="d3m-e-au-num r"><b>1<\/b><span>Falhas<\/span>/);
  // Várias falhas: as do mesmo motivo contam juntas e "Ver as N" leva à aba Falhas.
  c.aoLerFalhasDeAutomacoes([1, 2, 3].map((i) => ({ estado: 'pendente', item: `vybe:${i}`, ocorrencia: String(i), titulo: `Peça ${i}`, motivo: i < 3 ? 'sem responsável' : 'grupo sumiu' })));
  assert.match(no('auto-fala').innerHTML, /3 falhas esperam alguém\.<\/span><small class="d3m-lar-sub">2 falhas · sem responsável; 1 falha · grupo sumiu<\/small>[\s\S]*onclick="trocarAbaAutomacoes\('falhas'\)">Ver as 3</);

  // Busca e fichas repintam só a lista (a busca não perde o foco).
  c.buscarRegras('parada');
  assert.equal((no('auto-regras-lista').innerHTML.match(/class="v2-abre d3m-e-au-regra/g) || []).length, 1);
  c.buscarRegras(''); c.filtrarRegras('ligada');
  assert.equal((no('auto-regras-lista').innerHTML.match(/class="v2-abre d3m-e-au-regra/g) || []).length, 5, 'recorte mostra todas as que casam');
  c.buscarRegras('nada-que-exista');
  assert.match(no('auto-regras-lista').innerHTML, /Nenhuma regra neste recorte[\s\S]*onclick="limparRecorteDeRegras\(\)">Ver todas</);
});

test('Automações: sem regra, o vazio da prancha com os três passos; quem não administra não liga, não testa e não cria', () => {
  const tela = telaDeAutomacoes({ regras: [] }), vazia = tela.raiz.innerHTML;
  assert.match(vazia, /<div class="d3m-e-tela d3m-e-auto" data-vazia="true">/);
  assert.match(vazia, /nenhuma regra ainda<\/span>/);
  assert.match(vazia, /<b>Nenhuma regra ainda<\/b><span>Uma regra move, atribui ou avisa sozinha quando uma peça muda\.<\/span><button type="button" class="d3m-e-estado-btn" onclick="editarAutomacao\(null\)">Criar a primeira regra<\/button>/);
  // Prancha: o topo mantém "Nova regra" e o pé da folha ensina as três partes de uma regra.
  assert.match(vazia, /class="d3v-btn d3m-e-claro auto-novo"/);
  assert.match(vazia, /class="d3m-e-au-passos"[\s\S]*<b>Quando<\/b>[\s\S]*<b>Se<\/b>[\s\S]*<b>Então<\/b>/);
  assert.doesNotMatch(vazia, /id="auto-kpis"|id="auto-regras-lista"|id="auto-fala"|data-aba-botao="registro"/);
  assert.match(tela.no('auto-tipos').innerHTML, /<b>Mover<\/b>[\s\S]*<b>Atribuir<\/b>[\s\S]*<b>Avisar<\/b>/);
  assert.doesNotMatch(tela.no('auto-tipos').innerHTML, /d3m-vn/, 'sem regra não há contagem');
  assert.match(tela.no('auto-pede').innerHTML, /Conferindo as falhas…/);
  tela.c.aoLerFalhasDeAutomacoes([]);
  assert.match(tela.no('auto-pede').innerHTML, /Quando uma regra não consegue rodar, a falha aparece aqui com o motivo, e nada é movido\./);
  // Recalcular e Sincronizar (o "Mais" de antes) moram em "Manutenção", no fim da consulta, só para quem administra.
  assert.match(vazia, /<b>Manutenção<\/b>[\s\S]*recalcularPrioridadesAgora\(this\)[\s\S]*>Recalcular prioridades<[\s\S]*sincronizarRegrasDoSistema\(this\)[\s\S]*>Sincronizar regras do sistema</);
  const { raiz, no } = telaDeAutomacoes({ admin: false, regras: [regra(1, 'Uma', true, 2, 1), regra(2, 'Duas', false, 0, 0)] });
  assert.doesNotMatch(raiz.innerHTML, /Nova regra|Recalcular prioridades|Manutenção/);
  const lista = no('auto-regras-lista').innerHTML;
  assert.doesNotMatch(lista, /role="switch"|Testar regra|Editar a regra/);
  assert.match(lista, /<span class="d3m-e-au-pill g">Ligada<\/span>[\s\S]*<span class="d3m-e-au-pill n">Desligada<\/span>/);
  assert.match(lista, /clicar na regra abre<\/p>/);
  assert.doesNotMatch(no('auto-pede').innerHTML, />Ligar</, 'quem não administra não liga');
  const semAdmin = telaDeAutomacoes({ admin: false, regras: [] }).raiz.innerHTML;
  assert.doesNotMatch(semAdmin, /Criar a primeira regra|Nova regra/);
  assert.match(semAdmin, /Quando quem administra criar uma, ela aparece aqui\./);
});

test('Automações: o registro vira uma linha por ação, com o selo do que a regra fez, na aba Últimas ações', () => {
  const { c, no, raiz } = telaDeAutomacoes({ regras: [regra(1, 'Aprovado vira Saída', true, 88, 61)] });
  assert.match(raiz.innerHTML, /data-aba-botao="registro" aria-checked="false" onclick="trocarAbaAutomacoes\('registro'\)">Últimas ações</);
  assert.ok(raiz.innerHTML.indexOf('data-aba="regras"') < raiz.innerHTML.indexOf('data-aba="falhas"') && raiz.innerHTML.indexOf('data-aba="falhas"') < raiz.innerHTML.indexOf('data-aba="registro"'));
  c.execs = [['grupo → saida'], ['responsáveis replace'], ['notificação'], ['status → aprovado'], [], ['grupo → saida'], ['notificação'], ['grupo → saida']].map((feitas, i) => ({ em: '2026-11-10T12:00:00Z', titulo: 'Peça ' + i, automacao: 'Aprovado vira Saída', feitas, evento: { tipo: 'status', de: 'a', para: 'b' } }));
  vm.runInContext('EXECUCOES = execs; pintarHistorico();', c);
  const h = no('auto-historico').innerHTML;
  assert.deepEqual([...h.matchAll(/class="d3m-e-au-selo \w">(\w+)</g)].map((m) => m[1]), ['Moveu', 'Atribuiu', 'Avisou', 'Mudou', 'Rodou', 'Moveu'], 'seis na frente');
  assert.match(h, /\+ 2 ações · <a href="#" role="button" class="d3m-e-au-elo" onclick="mostrarHistoricoInteiro\(true\);return false">mostrar</);
  assert.match(no('auto-regras-lista').innerHTML, /A última ação foi em Peça 0,/, 'a regra aberta diz a última ação dela');
});
