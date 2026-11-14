// Padrão v2 (moodboard de 12/11/2026): Equipe online, Centro, Minha sala, painel Salas, Jogos, Chat e celular,
// desenhados em vybe-mundo.js e vybe-mundo-conversa.js pelos quadros DEPOIS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync('vybe-mundo.js', 'utf8');
const conversa = readFileSync('vybe-mundo-conversa.js', 'utf8');
const css = readFileSync('vybe-mundo.css', 'utf8');
const trecho = (de, ate) => { const a = js.indexOf(de); assert.ok(a >= 0, de); const b = js.indexOf(ate, a + de.length); assert.ok(b > a, ate); return js.slice(a, b); };
const bloco = css.slice(css.indexOf('/* ==== PADRÃO V2 · NÚCLEO 2: início ==== */'), css.indexOf('/* ==== PADRÃO V2 · NÚCLEO 2: fim ==== */'));

test('o CSS do grupo fica no fim do vybe-mundo.css, sem !important e sem html body.mundo', () => {
  assert.ok(bloco.length > 1000);
  assert.doesNotMatch(bloco, /!important|html body\.mundo/);
  for (const t of ['PEÇAS DO NÚCLEO', 'EQUIPE ONLINE', 'SALAS, CHAT E JOGOS', 'MINHA SALA', 'CENTRO', 'CELULAR']) assert.ok(bloco.includes('PADRÃO V2 · ' + t), t);
});

test('Equipe online: a ordem do quadro e as ações que já existiam', () => {
  const m = trecho('function mostrarEquipe()', 'const naEquipe =');
  const ordem = ['<h1>Equipe online</h1>', 'data-equipe="conversa">Conversa da equipe', 'VYBES · Escritório', "kpi('Online agora'", "kpi('Recados sem ler'", "kpi('Missões do dia'", '<h2>Pede ação</h2>', '<h2>Missões do dia</h2>', '<h2>No prédio agora</h2>', 'Do Escritório:'];
  let ultimo = -1; for (const t of ordem) { const i = m.indexOf(t); assert.ok(i > ultimo, t); ultimo = i; }
  const predio = trecho('function predioAgoraHtml(D)', 'function mostrarEquipe()');
  assert.match(predio, /class="v2-abre v2e-sala" aria-expanded=/, 'a sala com mais de uma pessoa abre no lugar');
  assert.match(predio, /data-chamar-online=/); assert.match(predio, /data-entrar-zona=/); assert.match(predio, /data-perfil=/);
  assert.ok(predio.includes('Entrar na sala') && predio.includes('Ninguém online agora.'));
  assert.match(m, /data-eq-filtro="\$\{k\}" aria-pressed=/, 'Todos, Online e Fora agora como fichas');
  assert.match(js, /e\?\.recadosResumo/, 'recados sem ler vêm do resumo do Escritório');
  assert.match(js, /e\?\.missoes\?\.missoes \|\| \[\]\)\.filter\(\(m\) => m\.hoje \|\| m\.atrasada\)/, 'missões do dia: as de hoje e as atrasadas');
});

test('Centro: barra Vybelândia, cartão da loja, fala do VYBES e controles em pílula', () => {
  const barra = trecho('function pintarLegendaCidade(lista', 'function filtrarCidade(');
  for (const t of ['<h1>Vybelândia</h1>', 'data-vista="cidade"', 'data-vista="predio"', 'data-busca-loja', "'em dia'", "'em atenção'", "'com atraso'", 'class="d3-acao-btn" data-loja-apertada', 'VYBES · Agência inteira', 'data-seu-dia']) assert.ok(barra.includes(t), t);
  // Direção 3 (D3-Centro e D3-Loja): a fala vira a faixa laranja e o cartão da loja ganha ladrilhos, lista e semana.
  assert.ok(barra.includes("fala.className = 'd3-acao d3h-acao v2m-fala'"));
  const loja = trecho('  function mostrarCliente(nome) {', '// ---------- Hora do mundo');
  for (const t of ['class="v2m-loja d3m-loja"', 'class="d3m-semana"', "tile('atrasada', 'atrasadas'", "tile('aprovar', 'para aprovar'", "tile('fazer', 'a fazer'", 'data-loja-abre=', 'data-trilho="criar">Nova demanda', 'data-abrir-cliente=', 'data-cerebro-cliente=', 'VybeClientePlaca?.html(c.nome)']) assert.ok(loja.includes(t), t);
  assert.ok(js.includes('<span class="v2m-dica">arraste para girar · clique na loja para abrir</span>'));
  assert.ok(bloco.includes('body.mundo.mundo-centro:not(.v2m-dia) #mundo-hud > #vv-hoje{display:none}'), 'o Hoje fica atrás de "Seu dia"');
});

test('Minha sala: título, Convidar, Usar/Decorar e Salvar a sala pelas funções do Escritório e do VybeDecorar', () => {
  const cab = trecho('function pintarCabDaSala(el, zona, quarto)', 'async function abrirMinhaSala(');
  assert.ok(cab.includes('data-quarto-acao="convidar"') && cab.includes('data-quarto-acao="usar"') && cab.includes('data-quarto-acao="decorar"') && cab.includes('data-quarto-acao="salvar"'));
  assert.match(cab, /podeSalvar = decorando && ed\.mudou && !ed\.salvando/, 'Salvar só acende com mudança');
  assert.ok(js.includes("else if (b.dataset.quartoAcao === 'salvar') Promise.resolve(D?.salvar?.())"));
});

test('painel Salas do dock: título, pessoas ao vivo, fechar, rostos, Dentro, a frase e só "Decorar minha sala" no pé', () => {
  const s = trecho('function salasDeVozHtml(', 'barra.addEventListener?.(');
  for (const t of ['<b>Salas</b>', 'ao vivo</span>', 'data-chamada="fechar"', 'class="vz-avs"', "minha ? 'Dentro' : 'Entrar'", 'Entrou, o microfone, a câmera e a tela ligam na barra.', 'data-chamada="decorar-minha">Decorar minha sala']) assert.ok(s.includes(t), t);
  assert.doesNotMatch(s, /Sair da sala/, 'sempre se está em alguma sala (decisão do dono)');
});

test('Jogos na janela do padrão e o Chat com título e a sala de quem lê', () => {
  const j = trecho('function mostrarJogos()', 'let jogandoAgora');
  assert.ok(j.includes('<h1>Jogos</h1>') && j.includes('class="v2n-btn k" data-jogo=') && j.includes('Quem pode jogar agora'));
  assert.ok(conversa.includes("const titulo = el('h2', 'vv-conversa-titulo');") && conversa.includes("titulo.textContent = 'Chat';"));
  assert.ok(conversa.includes('<b>${esc(nomeSala(sala))}</b> · lê quem está na sala'));
});

test('celular: barra de quatro com o Criar redondo ao lado e a folha "Mais" em grade de quatro', () => {
  const m = trecho('function maisCelHtml(origem)', 'function vozCelAberta()');
  for (const t of ['<h3>Ferramentas e sala</h3>', '<h3>Vista do mundo</h3>', '<h3>Favoritos</h3>', '<h3>Setores</h3>']) assert.ok(m.includes(t), t);
  assert.ok(bloco.includes('#mundo-hud .vv-trilho > .vv-trilho-btn.criar{order:4;position:absolute;right:-64px'));
  assert.ok(bloco.includes('#mundo-hud .vv-cel-mais .vv-cel-grade{grid-template-columns:repeat(4,minmax(0,1fr))'));
});
