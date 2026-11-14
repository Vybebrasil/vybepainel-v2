// Direção 3 (moodboard 3, 13/11/2026) no grupo Hoje: as quatro abas do Hoje, a Coordenação, a loja do Centro, a
// Equipe online e a entrada seguem os quadros D3. Conferência estática do essencial de cada tela e da folha d3-hoje.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync('vybe-mundo.js', 'utf8');
const coord = fs.readFileSync('vybe-mundo-coordenacao.js', 'utf8');
const css = fs.readFileSync('padrao-v2/d3-hoje.css', 'utf8');
const trecho = (a, b, fonte = js) => { const i = fonte.indexOf(a); assert.ok(i >= 0, a); const j = fonte.indexOf(b, i + a.length); return fonte.slice(i, j < 0 ? undefined : j); };
const naOrdem = (txt, partes) => { let p = -1; for (const x of partes) { const i = txt.indexOf(x, p + 1); assert.ok(i > p, x); p = i; } };

test('peças comuns: topo "Hoje" com a data, faixa laranja, quatro números, cartões e linha que abre no lugar', () => {
  for (const f of ['function topoD3(', 'function acaoD3(', 'function numD3(', 'function cartaoD3(', 'function semanaD3Html(', 'function agendaD3Html(', 'function agentesD3Html(', 'function whatsappD3Html(', 'function aprovacoesD3Html(']) assert.ok(js.includes(f), f);
  assert.match(js, /class="d3-acao d3h-acao" aria-label="O que pede ação agora"/);
  assert.match(js, /if \(acao === 'abre'\) \{/, 'a linha abre no lugar sem repintar');
  assert.match(js, /el\.classList\.add\('d3h-tela'\)/, 'fundo areia atrás dos cartões');
});

test('Agência: faixa com o alerta mais grave, Pede ação em Agora/Depois/Em seguida, De olho, baralho, semana com dia escolhido, agenda, agentes e WhatsApp', () => {
  const ag = trecho('  function pintarAgencia(el', '  // ---------- Módulo Gestão');
  naOrdem(ag, ['topoD3({ sub: diaD3(), meio: quemOnline, dir: seg })', 'acaoD3({ ...faixa', '${numeros}', '${pede}', 'decidirHtml()', 'semanaD3Html(N.graficoSemana)', 'agendaD3Html()', 'agentesD3Html()', "whatsappD3Html('agencia')"]);
  for (const r of ["rotulo: 'Atrasadas'", "rotulo: 'Vão ao ar hoje'", "rotulo: 'Semana'", "rotulo: 'Para você decidir'"]) assert.ok(ag.includes(r), r);
  assert.match(ag, /data-espiar="atencao"/); assert.match(ag, /data-espiar="sem3"/); assert.match(ag, /data-hoje-acao="decidir-lista"/);
  const sem = trecho('  function semanaD3Html(', '  function pintarAgencia(');
  assert.match(sem, /data-semana-dia="\$\{x\.dia\}" aria-pressed=/, 'tocar num dia escolhe o dia');
  assert.match(sem, /data-espiar="semdia:/, 'a lista do dia escolhido');
  assert.match(sem, /<polyline class="meta"/, 'previstas tracejadas, prontas em linha');
});

test('Para você decidir: baralho com ‹ ›, Pedir alteração e Aprovar, status e grupo em pílula; passar não repinta', () => {
  const d = trecho('  function decidirHtml(', '  function decidirPeca(');
  naOrdem(d, ['class="v2-baralho d3h-baralho"', 'data-hoje-acao="decidir-passo" data-valor="-1"', 'data-valor="alterar">Pedir alteração', 'data-valor="aprovar">Aprovar', 'data-hoje-acao="decidir-passo" data-valor="1"']);
  assert.match(d, /statusCor\(i\.item\)/); assert.match(d, /class="d3h-pill so">\$\{esc\(grupo\)\}/);
  assert.match(js, /closest\?\.\('#vv-hoje \[data-decidir\]'\)/, 'setas do teclado');
});

test('Minhas tarefas: filtros, busca e Filtros no cartão; bolinha que risca; status que troca; De olho; coluna com WhatsApp e Aprovações', () => {
  const t = trecho('// ===== Minhas tarefas pelo quadro D3-Tarefas', '  function acaoDoHoje(');
  for (const k of ["hoje: ['Hoje'", "semana: ['Semana'", "todas: ['Todas'", "atrasadas: ['Atrasadas'", "feitas: ['Feitas'"]) assert.ok(t.includes(k), k);
  naOrdem(t, ['class="d3h-q', 'class="v2t-cx', 'class="v2-risca', "onclick=\"openStatusEditor(event,'${id}')\"", 'data-editar-data="veiculacao"', '${avD3(quem)}']);
  assert.match(t, /data-hoje-acao="foco"/, 'prazo desatualizado continua com o atalho do Modo Foco');
  assert.match(t, /compromissosD3Html\(\)\}\$\{!verComo \? whatsappD3Html\('tarefas'\) : ''\}\$\{!verComo \? aprovacoesD3Html\(\) : ''\}/);
});

test('Criação: faixa do Danilo, quatro números, Fila do Danilo, parecer em baralho, Pediram ajuste, o time com o limite e as ideias dos clientes', () => {
  const c = trecho('  function pintarCriacao(', '  // Minha sala (quadro 34');
  naOrdem(c, ["acaoD3({ ...faixa, agente: 'D' })", '${numeros}', '${fila}', "decidirHtml({ titulo: 'Esperando o seu parecer', artes: true })", '${ajustes}', '${time}${ideias}']);
  assert.match(c, /data-criacao-pessoa=/); assert.match(c, /data-criacao-atalho="perguntar"/); assert.match(c, /data-pend-agente="design"/);
  assert.match(c, /class="v2c-sugestoes" hidden/);
});

test('Coordenação: período no título, faixa do Heitor que pede o OK, sem ninguém (contorno = sugerido), para equilibrar, carga em linha e agora → depois', () => {
  const h = trecho('  function html({ itens, time', '  async function gravar(', coord);
  naOrdem(h, ['class="d3-acao d3h-acao"', 'data-coord-periodo=', 'Sem ninguém atribuído', 'Para equilibrar', 'Carga do time', 'agora → depois']);
  assert.match(h, /data-coord-atribuir="\$\{esc\(s1\.d\.id\)\}" data-para="\$\{esc\(s1\.sugerido\)\}">Atribuir a 1ª/, 'a faixa só abre a confirmação na linha');
  assert.match(h, /confirmarHtml\(chave \+ id, `Atribuir a/, 'nada grava sem o OK');
  assert.match(coord, /function linhaCarga\(/);
});

test('Centro e loja, Equipe online e entrada pelos quadros D3', () => {
  assert.match(js, /fala\.className = 'd3-acao d3h-acao v2m-fala'/);
  const loja = trecho('  function mostrarCliente(nome) {', '    p.hidden = false; ajustarAreaLivre(); window.VybeClientePlaca');
  naOrdem(loja, ['class="d3m-loja-cab"', 'class="v2m-n3 d3m-n3"', 'class="d3m-lista"', 'class="d3m-semana"', 'class="d3m-quem"', 'data-trilho="criar">Nova demanda', 'class="v2n-btn k d3m-abrir" data-abrir-cliente=']);
  assert.match(js, /<h1>Equipe online<\/h1><small class="v2e-data">/);
  assert.match(js, /class="v2e-seg" role="img"/); assert.match(js, /class="v2n-busca v2e-busca" data-eq-busca/);
  assert.match(js, /<span class="v2-risca\$\{m\.feita \|\| m\.concluida/);
  assert.match(trecho('  function entradaHtml(', '  function pintarEntrada('), /class="d3-acao d3en-acao"/);
});

test('folha d3-hoje.css: tokens --d3-*, sem !important, sem html body.mundo, presa às janelas', () => {
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /html body\.mundo/);
  assert.match(css, /#vv-hoje\.d3h-tela\{background:var\(--d3-areia\)\}/);
  assert.match(css, /#vv-hoje \.d3h-cartao\{[^}]*border-radius:var\(--d3-r-cartao\);background:var\(--d3-cartao\)/);
  assert.match(css, /@container hoje \(max-width:760px\)/, 'uma coluna na Minha sala e no celular');
  for (const linha of css.split('\n').filter((l) => /^[#.a-z:]/i.test(l) && l.includes('{'))) assert.ok(/^(#vv-hoje|#vv-placa|#vv-entrada|#ofc-ranking|#d3-centro|#d3-sala|#mundo-hud|#mundo-andar|body\.mundo|@)/.test(linha), linha.slice(0, 80));
});

test('Centro e Minha sala pelos quadros: o 3D dentro de um cartão da grade, números, prédio, online, salas, Agora, Seu dia, Conquistas e Datas', () => {
  const c = trecho('  function pintarCentroD3(', '  function filtrarCidade(');
  for (const t of ['class="d3c-cartao d3c-mapa"', 'data-d3-cheio>Entrar no mapa', "num('Online agora'", "num('Em salas'", "num('Lojas com atraso'", "num('Peças em aberto'", 'aria-label="Prédio · elevador"', 'data-andar=', 'aria-label="Online agora"', 'aria-label="Salas"', 'data-entrar-zona=', 'class="d3c-cartao d3c-lojas"', 'data-d3-loja=', 'class="d3c-cartao d3c-modulos"']) assert.ok(c.includes(t), t);
  assert.ok(js.includes("set('--d3c-mx', r.left)"), 'o mapa desenha no retângulo do cartão');
  assert.ok(css.includes('body.mundo.d3c-painel #mundo > :is(canvas,.mundo-rotulos,.mundo-vinheta){inset:auto;left:var(--d3c-mx'));
  const s = trecho('  function pintarSalaD3(', '  async function abrirMinhaSala(');
  for (const t of ['class="d3s-cartao d3s-quarto"', 'VYBES · Seu dia', "num('Feitas hoje'", "num('XP da semana'", "num('VybeCoins'", "num('Troféus'", 'aria-label="Agora"', 'data-d3-humor=', "fn('escritorioTrocarStatus')", 'aria-label="Seu dia"', 'para aprovar', 'aria-label="Conquistas"', 'aria-label="Datas"', 'class="v2-risca']) assert.ok(s.includes(t), t);
  assert.ok(js.includes('pintarSalaD3(el, zona);'), 'repinta com a presença da sala');
  assert.ok(css.includes('#mundo-andar.quarto > .andar-palco{inset:auto;left:var(--d3s-qx'), 'o quarto desenha no cartão');
  assert.ok(css.includes('body.mundo.mundo-quarto.d3s-painel #mundo-hud > #vv-hoje.vv-hoje{display:none}'), 'sem o Hoje estreito');
});

test('Minha sala: a grade deixa o toque passar para o quarto 3D (arrastar, girar e zoom como antes)', () => {
  const css = fs.readFileSync("padrao-v2/d3-hoje.css", "utf8");
  assert.match(css, /#d3-sala > \.d3s-grade\{pointer-events:none\}/);
  assert.match(css, /#d3-sala \.d3s-quarto\{[^}]*pointer-events:none/);
  assert.match(css, /#d3-centro \.d3c-mapa\{[^}]*pointer-events:none/);
});
