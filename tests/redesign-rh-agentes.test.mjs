// Redesign de RH, Agentes, Criar, Ajuda e Boletim (quadros 61 a 66 do moodboard, 10/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
function carregarAgentes() {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, setInterval() {}, setTimeout,
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, setItem() {} },
    document: { hidden: false, addEventListener() {}, body: { classList: { contains: () => false } }, querySelector: () => null } };
  ctx.window = ctx; ctx.souDonoDaSessao = () => true;
  vm.createContext(ctx);
  vm.runInContext(ler('vybe-mundo-agentes.js'), ctx);
  return ctx.VybeAgentes;
}
function carregarPessoas() {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, Intl, setTimeout,
    document: { createElement: () => ({}), body: { append() {} }, querySelectorAll: () => [] }, addEventListener() {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ler('vybe-mundo-pessoas.js'), ctx);
  return ctx.VybePessoas._teste;
}
const simples = (x) => JSON.parse(JSON.stringify(x));
const agentes = [{ id: 'orquestrador', agente: 'VYBES', nome: 'Orquestração' }, { id: 'sdr', agente: 'Otávio', nome: 'SDR' },
  { id: 'closing', agente: 'Beto', nome: 'Closing' }, { id: 'concierge', agente: 'Mateus', nome: 'Atendimento' }, { id: 'design', agente: 'Danilo', nome: 'Design Visual' }];
const pedido = (setor, extra = {}) => ({ chave: `${setor}:pedido`, tipo: `pedido_${setor}`, gravidade: 'alta', cliente: 'Cliente demonstração',
  fato: 'Cliente demonstração: pedido no grupo há 6 h sem card.', primeiraVez: '2026-11-10T09:00:00Z', ...extra });
const AGORA = Date.parse('2026-11-10T15:00:00Z');

test('62: o mesmo achado de quatro agentes vira uma linha só, "visto por" todos, com a chave de cada um', () => {
  const { filaDoDono, itemFilaHtml } = carregarAgentes();
  const perfis = Object.fromEntries(['orquestrador', 'sdr', 'closing', 'concierge'].map((s) => [s, { achados: { abertos: [pedido(s, s === 'closing' ? { primeiraVez: '2026-11-10T07:00:00Z' } : {})] } }]));
  perfis.design = { achados: { abertos: [{ chave: 'd1', gravidade: 'alta', cliente: 'Alpha1', ref: 'vybe:101', fato: 'Peça cadastrada sem briefing', primeiraVez: '2026-11-09T09:00:00Z' }] } };
  const F = filaDoDono({ agentes, perfis, atividades: {}, agora: AGORA });
  assert.equal(F.total, 2, 'uma linha para o pedido visto por quatro e outra para a peça');
  const junto = F.decidir.find((x) => x.vistos?.length === 4);
  assert.ok(junto, 'a linha junta os quatro agentes');
  assert.equal(junto.tipo, 'achado');
  assert.deepEqual(simples(junto.vistos.map((v) => v.agente)), ['VYBES', 'Otávio', 'Beto', 'Mateus']);
  assert.deepEqual(simples(junto.chaves), ['orquestrador:pedido', 'sdr:pedido', 'closing:pedido', 'concierge:pedido'], 'resolver vale para todos: uma chave por agente');
  assert.equal(junto.a.chave, 'closing:pedido', 'o mais antigo representa a linha');
  const html = itemFilaHtml(junto, true);
  assert.match(html, /visto por VYBES, Otávio, Beto e Mateus/);
  assert.match(html, /data-vga-lote="resolvido"[^>]*data-vga-chaves="\[&quot;orquestrador:pedido&quot;,&quot;sdr:pedido&quot;,&quot;closing:pedido&quot;,&quot;concierge:pedido&quot;\]"/);
  assert.match(html, /data-vga-setores="\[&quot;orquestrador&quot;,&quot;sdr&quot;,&quot;closing&quot;,&quot;concierge&quot;\]"[^>]*data-vga-vistos/, 'relê o perfil de cada agente e não pede confirmação de grupo');
  assert.match(html, /<span class="vga-selo alto">Urgente<\/span>/, 'urgência num selo com texto');
  assert.doesNotMatch(html, /--c:/, 'sem a faixa colorida na borda');
});

test('62: uma ação principal por linha; Ignorar e Estava errado no "Mais"; cliente diferente ou peça diferente não junta', () => {
  const { filaDoDono, itemFilaHtml } = carregarAgentes();
  const perfis = { orquestrador: { achados: { abertos: [pedido('orquestrador')] } }, sdr: { achados: { abertos: [pedido('sdr', { cliente: 'Alpha1', fato: 'Alpha1: pedido no grupo há 6 h sem card.' })] } },
    design: { achados: { abertos: [{ chave: 'p1', gravidade: 'alta', cliente: 'Alpha1', ref: 'vybe:1', fato: 'Peça sem briefing' }] } },
    closing: { achados: { abertos: [{ chave: 'p2', gravidade: 'alta', cliente: 'Alpha1', ref: 'vybe:2', fato: 'Peça sem briefing' }] } } };
  const F = filaDoDono({ agentes, perfis, atividades: {}, agora: AGORA });
  assert.ok(F.decidir.every((x) => (x.vistos || []).length === 1), 'clientes ou peças diferentes ficam separados');
  const comPeca = F.decidir.find((x) => x.a?.ref === 'vybe:1'), html = itemFilaHtml(comPeca, true);
  assert.equal((html.match(/class="vga-sim"/g) || []).length, 1, 'um botão principal');
  assert.match(html, /class="vga-sim" data-vga-peca="vybe:1"[^>]*>Abrir a peça</);
  const mais = html.slice(html.indexOf('<details class="vga-mais">'));
  assert.match(mais, /data-vga-achado="ignorar"/); assert.match(mais, /data-vga-achado="errado"/); assert.match(mais, />Abrir Danilo</);
  assert.doesNotMatch(html.slice(0, html.indexOf('<details class="vga-mais">')), /data-vga-achado="(ignorar|errado)"/);
  const semPeca = itemFilaHtml(F.decidir.find((x) => !x.a?.ref), true);
  assert.match(semPeca, /class="vga-sim">Já resolvi</, 'sem peça, resolver é a ação principal');
});

test('63: retrato voxel do agente (o boneco do Prédio) e o histórico na cor do sistema', () => {
  const js = ler('vybe-mundo-agentes.js'), css = ler('vybe-mundo.css'), avatar = ler('mundo/avatar.mjs'), m3d = ler('mundo/mundo-3d.mjs');
  assert.match(avatar, /export function avatarDoAgente\(nome, cor = '#FF7A2F', \{ cabeca = false \} = \{\}\)/);
  assert.match(m3d, /avatarDoAgente \} from '\.\/avatar\.mjs'/);
  assert.match(js, /modRetrato\?\.avatarDoAgente\?\.\(nome, cor, \{ cabeca: true \}\)/, 'mesmo boneco, cor do andar');
  assert.match(js, /<div class="vga-cab">\$\{retratoHtml\(s, \{ grande: true \}\)\}/, 'no cabeçalho, no lugar das iniciais');
  const fim = css.slice(css.indexOf('RH, AGENTES, CRIAR, AJUDA E BOLETIM'));
  assert.match(fim, /\.vga-barras i\{background:var\(--ds-acao,#C2490C\)\}/);
  assert.match(fim, /\.vga-fila li\{border-left-width:1px;border-left-color:#ECE6DC\}/);
  assert.doesNotMatch(fim, /!important|html body\.mundo/, 'código novo sem !important nem html body.mundo');
});

test('61: calendário do time com aniversários e férias; aniversário só com dia e mês', () => {
  const { eventosDoMes, nascimentoDoForm, andarMes } = carregarPessoas();
  const por = simples(eventosDoMes('2026-11', [{ nome: 'Bia', dia: '11-13' }, { nome: 'Paulo', dia: '12-02' }],
    [{ nome: 'Mizinho', inicio: '2026-10-30', fim: '2026-11-02' }, { nome: 'Vini', inicio: '2026-11-29', fim: '2026-12-03' }]));
  assert.deepEqual(por['2026-11-13'], [{ tipo: 'aniv', nome: 'Bia' }]);
  assert.equal(por['2026-12-02'], undefined, 'outro mês não entra');
  assert.deepEqual(Object.keys(por).filter((k) => por[k].some((e) => e.nome === 'Mizinho')), ['2026-11-01', '2026-11-02'], 'férias que começam no mês anterior');
  assert.deepEqual(Object.keys(por).filter((k) => por[k].some((e) => e.nome === 'Vini')), ['2026-11-29', '2026-11-30'], 'e as que passam do fim do mês');
  assert.deepEqual(simples(eventosDoMes('2027-02', [{ nome: 'Ana', dia: '02-29' }], []))['2027-02-28'], [{ tipo: 'aniv', nome: 'Ana' }], '29/02 em ano sem ele cai no dia 28');
  assert.equal(andarMes('2026-12', 1), '2027-01'); assert.equal(andarMes('2026-01', -1), '2025-12');
  assert.deepEqual(simples(nascimentoDoForm({ nasc_dia: '22', nasc_mes: '11', nasc_ano: '1994' })), { valor: '1994-11-22' }, 'o ano guardado não muda');
  assert.deepEqual(simples(nascimentoDoForm({ nasc_dia: '5', nasc_mes: '3', nasc_ano: '' })), { valor: '2000-03-05' });
  assert.deepEqual(simples(nascimentoDoForm({ nasc_dia: '29', nasc_mes: '2', nasc_ano: '1995' })), { valor: '2000-02-29' }, '29/02 sem ano bissexto guardado');
  assert.deepEqual(simples(nascimentoDoForm({ nasc_dia: '', nasc_mes: '' })), { valor: null }, 'vazio apaga');
  assert.match(nascimentoDoForm({ nasc_dia: '31', nasc_mes: '2' }).erro, /Fevereiro não tem dia 31/);
  assert.match(nascimentoDoForm({ nasc_dia: '3', nasc_mes: '' }).erro, /dia e o mês/);
  const js = ler('vybe-mundo-pessoas.js');
  assert.match(js, /\['rh', 'Pedidos e calendário'\]/, 'o título é o nome do item do dock');
  assert.doesNotMatch(js, /name="nascimento"/, 'nenhum campo dd\/mm\/aaaa para o aniversário');
});

test('64, 66: Criar com a cor de cada cliente; Ajuda e Boletim como painel no canto, sem fundo desfocado', () => {
  const cad = ler('cadastros_governed_v2.js'), css = ler('vybe-mundo.css'), bol = ler('vybe-mundo-boletim.css'), tut = ler('vybe-mundo-tutorial.css'), tutJs = ler('vybe-mundo-tutorial.js');
  assert.match(cad, /class="fc-escolha fc-cli \$\{marcado \? 'marcada' : ''\}"/);
  assert.match(cad, /cliCor\(c\)\.replace\(/, 'o nome do cliente com a cor da carteira');
  const fim = css.slice(css.indexOf('RH, AGENTES, CRIAR, AJUDA E BOLETIM'));
  assert.match(fim, /\.fc-escolha\.fc-cli\.marcada\{box-shadow:0 0 0 2px var\(--ds-acao,#C2490C\)\}/, 'escolhido com contorno laranja');
  assert.match(fim, /#fc-overlay \.fc-modal\{max-height:var\(--vv-janela-alto\)\}/, 'cabe acima do dock');
  assert.match(fim, /body\.mundo \.vcal\{background:#FFFFFF/, 'o calendário do painel claro no mundo');
  assert.match(css, /:is\(\.fc-escolha,\.fc-mais\):not\(\.marcada\):not\(\.fc-cli\)/, 'a regra antiga não pinta o botão de cliente');
  assert.match(bol, /\.vbl-fundo\{[^}]*pointer-events:none;background:none\}/);
  assert.doesNotMatch(bol.split('\n').find((l) => l.startsWith('.vbl-fundo{')), /backdrop-filter/);
  assert.match(tut, /\.vv-tour-ajuda\{[^}]*pointer-events:none\}/);
  assert.doesNotMatch(tut, /\.vv-tour-veu/); assert.doesNotMatch(tutJs, /vv-tour-veu/);
  assert.match(tut, /\.vv-tour-janela-topo\{display:flex;flex-direction:row;/, 'o X na linha do título');
  assert.match(tut, /--tour-nova-f:#ECE9FF;--tour-nova-t:#5B4BD6/, 'o selo Nova continua lilás');
});
