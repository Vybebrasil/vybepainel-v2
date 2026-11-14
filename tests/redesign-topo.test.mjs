// Redesign, frente "topo" (10/11/2026): Criar, Busca, Ajuda, sino, Notas, TV e Música, avisos curtos e menu da conta
// (quadros 08/64, 09/66, 41, 42, 44, 45 e 46 do moodboard), sem tirar informação da tela.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const css = ler('vybe-mundo.css'), mundo = ler('vybe-mundo.js'), cad = ler('cadastros_governed_v2.js');
const spot = ler('vybe-spotlight.js'), core = ler('vybe-core.js'), esc = ler('vybe-escritorio.js'), notas = ler('vybe-notas.js');

test('Criar (08/64): "Etapa N de 5" na trilha, calendário sazonal junto das opções, sem "Cadastro rápido" nem fundo desfocado', () => {
  // Padrão v2 (quadro "Nova demanda em etapas"): três etapas na tela, as cinco conferências continuam por baixo.
  assert.match(cad, /<span class="nd-sub fc-trilha-texto">Etapa \$\{fcEtapa \+ 1\} de \$\{FC_ETAPAS\.length\}<\/span>/);
  assert.match(cad, /const FC_ETAPAS = \['O quê', 'Para quem', 'Quando'\];/);
  assert.match(cad, /const FC_PASSOS = \['board', 'client', 'format', 'itens', 'destino'\];/, 'o que é conferido antes de criar não mudou');
  assert.match(cad, /onclick="fcIrPara\(\$\{i\}\)"/, 'as etapas continuam clicáveis');
  assert.doesNotMatch(cad, /aria-label="Cadastro rápido"|>Cadastro rápido</);
  assert.doesNotMatch(cad, /class="fc-kicker"/);
  assert.match(cad, /onclick="abrirCalendarioSazonal\(\)">Começar pelo calendário sazonal<\/button><\/p>`;/, 'o atalho mora no cartão da primeira etapa');
  assert.ok(cad.indexOf('function fcCartaoOQueHtml(') < cad.indexOf('Começar pelo calendário sazonal'));
  assert.match(css, /body\.mundo #fc-overlay\{[^}]*backdrop-filter:none!important\}/);
  assert.doesNotMatch(css, /#fc-overlay[^{]*\{[^}]*backdrop-filter:blur/);
  assert.match(css, /body\.mundo #fc-overlay \.fc-side-col\{[^}]*background:#F3F1EC\}/);
  assert.doesNotMatch(css, /body\.mundo #fc-overlay \.fc-modal :is\([^)]*\.fc-preview-card/, 'a prévia não tem sombra de cartão flutuando');
  assert.match(cad, /Como vai chegar na equipe/);
});

function spotlight({ recentes = [], itens = [] } = {}) {
  const guardado = { 'vybe.busca.recentes': JSON.stringify(recentes) };
  const c = vm.createContext({
    console, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail; } },
    localStorage: { getItem: (k) => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } },
    document: { addEventListener() {}, body: { classList: { contains: () => false } }, querySelector: () => null },
    safeText: (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`),
    cliCor: (n) => `<span class="cliente-carteira">${n}</span>`,
    openCadastrosGoverned: () => {},
    unifiedOperationalItems: () => itens,
  });
  vm.runInContext(spot, c);
  c.guardado = guardado;
  return c;
}

test('Busca (09/66): vazia mostra o que você abriu por último e os atalhos; guarda o recente ao abrir', () => {
  const c = spotlight({ recentes: [{ tipo: 'cliente', valor: 'Antonov' }, { tipo: 'item', valor: '7' }, { tipo: 'item', valor: 'sumiu' }],
    itens: [{ id: '7', nome: 'Reels da fábrica', cliente: 'Antonov', status: 'Pode Fazer', formato: 'Reels' }] });
  const opcoes = [];
  const bloco = (id, titulo, linhas) => linhas.length ? `<g ${id}>${titulo}${linhas.join('')}</g>` : '';
  const linha = (acao, conteudo) => { opcoes.push(acao); return `<l>${conteudo}</l>`; };
  const atividade = (it) => linha({ tipo: 'item', id: it.id }, it.nome);
  const html = c.spotlightInicioHtml({ bloco, linha, atividade });
  assert.match(html, /Continuar de onde parou/);
  assert.match(html, /<span class="cliente-carteira">Antonov<\/span>/, 'cliente na cor dele');
  assert.match(html, /Reels da fábrica/);
  assert.match(html, /Atalhos/);
  assert.match(html, /Criar conteúdo ou demanda/);
  assert.deepEqual(opcoes.map((o) => o.tipo), ['cliente', 'item', 'atalho'], 'item que sumiu do painel não aparece');
  c.spotlightGuardarRecente('item', '9');
  assert.equal(JSON.parse(c.guardado['vybe.busca.recentes'])[0].valor, '9');
});

test('Busca (09/66): só "Esc" para fechar, sem rodapé técnico, cliente e status nas cores; uma janela por vez', () => {
  assert.doesNotMatch(spot, /<kbd class="spotlight-tecla">esc<\/kbd>/);
  // Padrão v2 (quadro "Janelas do topo"): "Esc" numa etiqueta do cabeçalho e o X redondo ao lado.
  assert.match(spot, /<h2 id="spotlight-titulo">Busca<\/h2><span class="v2j-pill">Esc<\/span>/);
  assert.match(spot, /class="spotlight-fechar v2j-x" aria-label="Fechar busca"/);
  assert.doesNotMatch(spot, /finalizadas e antigas`/);
  // Padrão v2: a linha é o nome e uma palavra à direita; o cliente na cor dele fica na linha do cliente, e o status no título da linha.
  assert.match(spot, /const nomeCliente = \(nome\) => \(typeof cliCor === 'function' \? cliCor\(nome\)/);
  assert.match(spot, /item\.status \|\| 'Sem status'/);
  assert.match(spot, /dispatchEvent\(new CustomEvent\('vybe:janela-topo', \{ detail: \{ qual: 'busca' \} \}\)\)/);
  assert.match(mundo, /document\.addEventListener\?\.\('vybe:janela-topo', \(e\) => fecharJanelasDoTopo\(e\.detail\?\.qual\)\);/);
  assert.match(mundo, /if \(\['busca', 'avisos', 'conta', 'notas', 'boletim', 'ajuda'\]\.includes\(id\)\) fecharJanelasDoTopo\(id\);/);
  assert.match(mundo, /if \(menos !== 'busca'\) document\.querySelector\('\.spotlight-dialog\[open\]'\)\?\.close\?\.\(\);/);
  assert.match(css, /body\.mundo \.vv-tour-janela:focus\{outline:none\}/);
});

test('Sino (41): "Marcar como lidos" sempre que houver avisos; sem nada novo, o último aviso fica no alto', () => {
  assert.match(mundo, /\$\{partes\.length \? `<button type="button" class="vc-sec vv-aviso-lidos" data-aviso-lidos\$\{novas \? '' : ' disabled title="Tudo já foi lido"'\}>Marcar como lidos<\/button>` : ''\}/);
  assert.match(mundo, /const ultimo = novas \? null : /);
  assert.match(mundo, /O último aviso foi este:/);
  assert.match(mundo, /<h3>Último aviso<\/h3>/);
  assert.match(core, /globalThis\.ULTIMO_AVISO_CURTO = \{ titulo: String\(titulo\)/);
});

test('Notas (42): Renomear e Apagar no menu de três pontos do caderno e da nota', () => {
  assert.match(notas, /<details class="notas-menu notas-caderno-acoes">/);
  assert.match(notas, /aria-label="Mais ações do caderno/);
  assert.match(notas, /aria-label="Mais ações da nota"/);
  assert.doesNotMatch(notas, /<button type="button" class="notas-acao perigo" onclick="apagarNotaAberta\(\)">Apagar<\/button>/);
  assert.match(notas, /onclick="renomearCadernoAtual\(\)"/);
  assert.match(notas, /onclick="apagarCadernoAtual\(\)"/);
});

test('TV (44): em cima do dock, sem fundo desfocado, fonte num alternador e sem o play vermelho; o player continua', () => {
  // Padrão v2 (quadro "Barra de baixo", 12/11/2026): no mundo a TV virou aba do painel Som, em cima do dock; a janela fica para o Escritório antigo.
  assert.match(esc, /if \(escritorioPainelSomNoMundo\(\)\) return alternarPainelSomEscritorio\("tv"\);/);
  assert.match(esc, /<div class="ofc-tv-opcoes vb-alternar" role="group" aria-label="O que passar na TV">/);
  assert.ok(esc.includes('const idPassando = '), 'o clipe que está passando continua no alto');
  // Limpeza de 14/11/2026: a regra de .ofc-tv-janela saiu na poda das regras mortas (nenhum JS/HTML monta mais .ofc-tv-janela).
  assert.match(css, /body\.mundo \.ofc-tv-tela span\{[^}]*background:rgba\(255,255,255,\.14\)/);
  assert.match(ler('vybe-styles.css'), /\.workflow-modal:where\(:not\(\.ofc-snc-jogo\):not\(\.ofc-snc-menu\):not\(\.ofc-tv-janela\):not\(body\.mundo \.ofc-menu-jogo\):not\(\.vb-sem-acesso-janela\)\)\{width:min\(940px,94vw\)!important/);
});

test('Música (44/45): fora de uma sala com som, o aviso curto de sempre com "Entrar no Lounge", também fora do escritório', () => {
  assert.match(mundo, /\(!escritorio\.conectado \|\| \(typeof escritorioNaPista === 'function' && !escritorioNaPista\(\)\)\)\) musicaForaDaSala\(b\);/);
  assert.match(mundo, /fn\('mostrarAvisoCurto'\)\?\.\(\{ chave: 'musica-fora', icone: 'musica', titulo: 'A música toca dentro de uma sala'/);
  assert.match(mundo, /rotulo: 'Entrar no Lounge', principal: true, fazer: entrar/);
  assert.doesNotMatch(css, /\.vv-musica-fora\{/);
});

test('Avisos curtos (45): o toast antigo e o aviso do Escritório saem no aviso curto do mundo', () => {
  assert.match(core, /if \(avisoCurtoNoMundo\(msg, \{ erro: type === 'err' \|\| type === 'error'/);
  assert.match(esc, /if \(texto && typeof avisoCurtoNoMundo === "function" && avisoCurtoNoMundo\(texto, /);
  const avisos = [];
  const c = vm.createContext({ console, document: { body: { classList: { contains: (k) => k === 'mundo' } }, getElementById: () => null } });
  vm.runInContext(core.slice(core.indexOf('// Aviso de uma frase só'), core.indexOf('function mostrarAvisoCurto(')), c);
  c.mostrarAvisoCurto = (o) => { avisos.push(o); return {}; };
  assert.equal(c.avisoCurtoNoMundo('Escolha o cliente.'), true);
  assert.equal(avisos[0].titulo, 'Escolha o cliente.');
  assert.equal(c.avisoCurtoNoMundo(''), false);
});

test('Menu da conta (46): nome e saldo no alto, e o ícone de aparência saiu do topo (fica no menu)', () => {
  assert.doesNotMatch(mundo, /data-ferr="aparencia"/);
  assert.doesNotMatch(mundo, /function alternarMenuTema\(/);
  assert.match(mundo, /operadorDoTopo\(\) : null\) \|\| \(typeof pessoaLogada === 'function' \? pessoaLogada\(\) : null\)/);
  assert.match(mundo, /nomeEu\.split\(\/\\s\+\/\)/);
  assert.match(mundo, /<small>\$\{esc\(papelEu\)\} · \$\{saldoEu !== null \?/);
  assert.match(mundo, /item\('ajustes', 'Mais ajustes de aparência'/);
});
