// Frente "time" do redesign (quadros 17, 21, 22, 25, 39, 40, 48, 49, 61, 62 e 63 do moodboard, 10/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pedidoDaPeca } from '../server/planejamento-documento.js';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
// Um trecho de função do arquivo, do cabeçalho até a próxima função do mesmo nível.
function trecho(arquivo, inicio, fim) {
  const s = ler(arquivo), i = s.indexOf(inicio); assert.ok(i >= 0, `${inicio} em ${arquivo}`);
  const j = fim ? s.indexOf(fim, i + inicio.length) : -1; return s.slice(i, j > i ? j : undefined);
}

test('vbEscolhaHtml: chip com o valor, menu de opções com contagem e o campo escondido que avisa como o select', () => {
  const fonte = trecho('vybe-core.js', 'function vbEscolhaHtml', 'if (typeof window');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fonte + ';this.f = vbEscolhaHtml;', ctx);
  const html = ctx.f({ rotulo: 'Nicho', valor: 'Moda', vazio: 'Todos', campo: 'data-vc-filtro="nicho"', opcoes: [{ valor: 'Moda', nome: 'Moda', n: 3 }, { valor: 'Pet <x>', nome: 'Pet <x>', n: 1 }] });
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /<details class="vb-escolha"><summary class="vb-chip vb-escolha-com" aria-label="Nicho: Moda">/);
  assert.match(html, /<input type="hidden" data-vc-filtro="nicho" value="Moda">/);
  assert.match(html, /data-vb-escolha="" aria-selected="false"><span>Todos<\/span>/, 'a opção vazia vem primeiro');
  assert.match(html, /data-vb-escolha="Moda" aria-selected="true"><span>Moda<\/span><em>3<\/em>/);
  assert.match(html, /Pet &lt;x&gt;/, 'escapa o texto');
  const sem = ctx.f({ rotulo: 'Dia', valor: '', vazio: '—', campo: 'name="nasc_dia"', grade: 7, opcoes: [{ valor: '1', nome: '1' }] });
  assert.match(sem, /<summary class="vb-chip" aria-label="Dia: —">/);
  assert.match(sem, /class="vb-escolha-menu grade" role="listbox" aria-label="Dia" style="--colunas:7"/);
});

test('17, 21, 30, 39, 49, 61: os selects nativos que o quadro pedia viraram o chip do sistema', () => {
  assert.doesNotMatch(trecho('vybe-mundo-comercial.js', 'function abaCreators', 'const PINTOR'), /<select/);
  assert.doesNotMatch(trecho('vybe-mundo-ferramentas.js', 'function escolhaNivel', 'function baixarPNG'), /<select/);
  assert.doesNotMatch(trecho('vybe-mundo-pessoas.js', 'function campoAniversario', 'function nascimentoDoForm'), /<select/);
  assert.doesNotMatch(trecho('vybe-mundo-pessoas.js', 'function htmlRecrutamento', 'if (estado.form === \'vaga\')'), /<select data-vp-vaga/);
  assert.match(ler('vybe-mundo-pessoas.js'), /escolha\(\{ rotulo: 'Vaga'[^\n]*campo: 'data-vp-vaga'/);
});

test('17 e 49: ação principal no cabeçalho, sem título repetido no corpo, filtro com contagem e vazio com botão', () => {
  const c = ler('vybe-mundo-comercial.js');
  // Padrão v2 (quadros Fornecedores e Creators): a ação cheia fica no cabeçalho do quadro (topoV2).
  assert.match(c, /fornecedores: \['Novo fornecedor', 'data-vc="fornecedor"', Boolean\(d\)\], creators: \['Novo creator', 'data-vc="creator"', Boolean\(d\?\.pode\?\.editar_comercial\)\]/);
  assert.doesNotMatch(c, /<h3>Fornecedores<\/h3>|<h3>Creators de Irecê<\/h3>/);
  assert.match(trecho('vybe-mundo-comercial.js', 'function abaFornecedores', 'function abaCreators'), /fichas: \['', \.\.\.cats\.map\(\(c\) => c\.id\)\]\.map\(ficha\)/, 'Todos e os tipos, com a contagem');
  assert.match(c, /botao\('Cadastrar o primeiro', 'data-vc="creator"'\)/);
  const i = ler('vybe-mundo-impressoes.js');
  assert.doesNotMatch(i, /vi-alerta|<small>Produção<\/small>/, 'sem o aviso solto de fornecedor e sem o setor no título');
  assert.match(i, /\$\{st\.dados && !st\.form \? '<button type="button" class="p2-btn p" data-vi="nova">Nova impressão<\/button>'/, 'padrão v2: a ação da tela é a pílula laranja do cabeçalho');
  assert.match(i, /data-vi-escolher-forn=/, 'sem fornecedor · escolher na própria peça');
  assert.match(i, /data-vi-vista="\$\{k\}"/, 'Linhas | Etapas | Tabela, dentro de Filtros');
});

test('21, 40, 61: a ação da aba fica no cabeçalho uma vez só; pedidos e clima lado a lado', () => {
  const p = ler('vybe-mundo-pessoas.js');
  assert.match(p, /<div class="vp-topo-botoes">\$\{acaoDoTopo\(estado\.dados\[estado\.aba\]\)\}/);
  for (const t of ['Nova vaga', 'Novo documento', 'Nova trilha', 'Nova solicitação']) assert.equal(p.split(`acao('${t}'`).length - 1, 1, `${t} uma vez só`);
  assert.doesNotMatch(p, /acao\('Abrir vaga'|acao\('Cadastrar o primeiro'|sec\('Começar do zero'/);
  // Padrão v2 (12/11/2026): o quadro põe o baralho de pedidos e o calendário lado a lado; a lista e o clima ficam a um clique.
  assert.match(p, /<div class="v2p-grade v2p-grade-rh">/);
  assert.match(p, /\['lista', 'Pedidos em lista'\], \['clima', 'Pesquisa de clima'\]/);
  assert.match(p, /a === 'academy' && d\.gestao && d\.provisionado !== false/, 'Nova trilha só para quem monta trilhas');
});

test('22: Equipe online com "visto há", moedas num selo e atalhos com ícone', () => {
  const m = trecho('vybe-mundo.js', 'const EQUIPE_ACOES', '// Perfil = a ficha completa');
  assert.doesNotMatch(m, /<small>offline<\/small>|vv-coins/);
  assert.match(m, /vistoHa\(D\.vistos\[t\.id\]\)/);
  assert.match(m, /class="v2n-chip vv-moedas-selo"/);
  assert.match(m, /class="v2n-chip" data-equipe="\$\{id\}"/, 'padrão v2: as portas do Escritório viram fichas no pé, como no quadro');
  const ctx = { Date, Number, Math, JSON, localStorage: { getItem: () => null, setItem() {} } }; vm.createContext(ctx);
  vm.runInContext(trecho('vybe-mundo.js', '  function vistoHa', '  // ===== Equipe online pelo quadro') + ';this.f = vistoHa;', ctx);
  const ha = (min) => ctx.f(Date.now() - min * 60e3);
  assert.equal(ha(1), 'visto há pouco'); assert.equal(ha(25), 'visto há 25 min'); assert.equal(ha(130), 'visto há 2 h');
  assert.equal(ha(60 * 30), 'visto ontem'); assert.equal(ha(60 * 24 * 3), 'visto há 3 dias');
  assert.match(ler('vybe-mundo.css'), /body\.mundo\.com-dock-salas:not\(\.mundo-centro\) \.vv-placa\{bottom:calc\(var\(--vv-m,14px\) \+ var\(--vv-dock-alto,74px\) \+ 6px\)\}/, 'não desce por trás do dock');
});

test('48: cada linha diz quantas peças tem e os avisos viram uma frase', () => {
  const m = ler('vybe-mundo-planejamentos.js');
  assert.doesNotMatch(m, /vv-plj-aviso \$\{c\}/);
  assert.match(m, /`\$\{n\} \$\{n === 1 \? 'peça' : 'peças'\}`/, 'padrão v2: o número de peças sem negrito, como no quadro');
  assert.match(m, /\.filter\(Boolean\)\.join\(' · '\)/);
});

test('25: "pedido" no menu do editor usa a mesma regra da coluna Pedidos do cliente do documento', () => {
  const ctx = { String }; vm.createContext(ctx);
  vm.runInContext(trecho('vybe-planejamentos.js', 'const pljPedidoDaPeca', 'function pljEdListaHtml') + ';this.f = pljPedidoDaPeca;', ctx);
  const casos = [{}, { revisao_cliente: { estado: 'ajuste', nota: 'Trocar a foto' } }, { revisao_cliente: { estado: 'ajuste' } }, { revisao_cliente: { estado: 'aprovada' }, ajuste_cliente: 'velho' },
    { ajuste_cliente: 'Mudar o texto' }, { revisao_head: { estado: 'ajustar' } }];
  for (const x of casos) assert.equal(ctx.f(x), pedidoDaPeca(x), JSON.stringify(x));
  assert.match(ler('vybe-planejamentos.js'), /<em class="plj-ed-pedido" title="\$\{pljEsc\(pljPedidoDaPeca\(x\)\)\}">pedido<\/em>/);
});

function carregarAgentes() {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, setInterval() {}, setTimeout,
    sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, setItem() {} },
    document: { hidden: false, addEventListener() {}, body: { classList: { contains: () => false } }, querySelector: () => null } };
  ctx.window = ctx; ctx.souDonoDaSessao = () => true;
  vm.createContext(ctx);
  vm.runInContext(ler('vybe-mundo-agentes.js'), ctx);
  return ctx.VybeAgentes;
}

test('62: a mesma lição de três agentes vira uma linha só, "visto por" todos, e decidir vale para a lição de cada um', () => {
  const { filaDoDono, itemFilaHtml } = carregarAgentes();
  const agentes = [{ id: 'orquestrador', agente: 'VYBES', nome: 'Orquestração' }, { id: 'sdr', agente: 'Otávio', nome: 'SDR' }, { id: 'closing', agente: 'Beto', nome: 'Closing' }];
  const licao = (id, em) => ({ id, estado: 'em_revisao', texto: 'Padaria demonstração: card sem briefing se repetiu 3 vezes em 14 dias.', em });
  const perfis = { orquestrador: { licoes: [licao('a', '2026-11-10T10:00:00Z')] }, sdr: { licoes: [licao('b', '2026-11-10T08:00:00Z')] },
    closing: { licoes: [licao('c', '2026-11-10T09:00:00Z'), { id: 'd', estado: 'em_revisao', texto: 'Outra lição' }] } };
  const F = filaDoDono({ agentes, perfis, atividades: {}, agora: Date.parse('2026-11-10T15:00:00Z') });
  const licoes = F.decidir.filter((x) => x.tipo === 'licao');
  assert.equal(licoes.length, 2, 'uma linha para a lição repetida e outra para a diferente');
  const junta = licoes.find((x) => x.copias.length === 3);
  assert.deepEqual(JSON.parse(JSON.stringify(junta.vistos.map((v) => v.agente))), ['VYBES', 'Otávio', 'Beto']);
  assert.equal(junta.em, '2026-11-10T08:00:00Z', 'a mais antiga marca a linha');
  const html = itemFilaHtml(junta, true);
  assert.match(html, /visto por VYBES, Otávio e Beto/);
  assert.match(html, /class="vga-sim" data-vga-licao-lote="incorporar" data-vga-licoes="\[\{&quot;setor&quot;:&quot;orquestrador&quot;,&quot;id&quot;:&quot;a&quot;\}/);
  const sozinha = itemFilaHtml(licoes.find((x) => x.copias.length === 1), true);
  assert.match(sozinha, /data-vga-licao="incorporar" data-vga-id="d"/, 'lição de um agente só segue com o botão de antes');
});

test('63: "Dar autonomia" no cabeçalho do agente em sombra, pelo mesmo estado da central (etapa=estado)', () => {
  const a = ler('vybe-mundo-agentes.js');
  assert.match(a, /dono && modo\.real && modo\.id === 'sombra' \? `<button type="button" class="vga-autonomia" data-vga-autonomia=/);
  assert.match(a, /chamar\(\{ setor: s\.id, estado: 'ativo' \}, 'estado'/);
  assert.match(a, /Um dono decide em "Dar autonomia", na página do agente\./);
});
