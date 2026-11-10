// Modo decorar na sala voxel (vybe-mundo-decorar.js + mundo/sala.mjs, Irecity, 07/11/2026).
// SAFE: roda o painel junto com as funções DE VERDADE do Escritório (planta, editor, escritório e ficha)
// num vm com um DOM de mentira. A "API" é um dublê que normaliza os itens com o mesmo itensValidos do
// servidor; nada vai ao servidor nem ao banco. A cena 3D é um dublê que só anota as chamadas: as mudanças
// de móvel saem das funções de mundo/sala.mjs, as mesmas que a cena usa ao arrastar, girar e guardar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { itensValidos } from '../server/escritorio-mapa.js';
import {
  moverItem, girarItem, guardarItem, porItem, proximaDirecao, encaixar, cabeNaSala, pegada, definirMedida,
  giroDaDirecao, centroDoItem, sobrepoe,
} from '../mundo/sala.mjs';

const j = (v) => JSON.parse(JSON.stringify(v)); // o vm tem outros protótipos: compara pelo conteúdo
const SALVO = () => [
  ['exe_sofa', 5, 0, 4, 0, 0],
  ['exe_table', 2, 2, 0, 0, 0],
  ['computer_flatscreen', 3, 2, 0, 1, 0.95],
  ['chair_silo', 3, 4, 0, 0, 0],
  ['fball_trophy', 7, 6, 2, 0, 0, { n: 'Bia', d: '2026-10-31' }],
];
definirMedida('exe_sofa', { x: 2, y: 1, direcoes: [0, 2, 4, 6] });
definirMedida('exe_table', { x: 2, y: 2, direcoes: [0, 2] });
definirMedida('computer_flatscreen', { x: 1, y: 1, direcoes: [0, 2, 4, 6] });
definirMedida('chair_silo', { x: 1, y: 1, direcoes: [0, 2, 4, 6] });

// ---------- as funções da cena (mundo/sala.mjs) ----------
test('direção do Habbo vira o giro certo da peça voxel (4 = de frente para a sala)', () => {
  assert.equal(giroDaDirecao(4), 0);
  assert.equal(giroDaDirecao(2), Math.PI / 2);
  assert.equal(giroDaDirecao(0), Math.PI);
  assert.equal(giroDaDirecao(6), -Math.PI / 2);
  assert.deepEqual(pegada('exe_sofa', 4), { w: 2, h: 1 });
  assert.deepEqual(pegada('exe_sofa', 2), { w: 1, h: 2 }, 'de lado, largura e fundo trocam, como no servidor');
  const c = centroDoItem(['exe_sofa', 0, 0, 4], { w: 10, d: 10 });
  assert.ok(Math.abs(c.x - 0.7) < 1e-9 && Math.abs(c.z - 0.35) < 1e-9, 'o centro é o da área que a peça ocupa');
});

test('girar segue as direções do móvel; encaixar mantém a peça inteira dentro da sala', () => {
  assert.deepEqual([0, 2, 4, 6].map((d) => proximaDirecao(d, [0, 2, 4, 6])), [2, 4, 6, 0]);
  assert.equal(proximaDirecao(4, [2, 4]), 2);
  assert.equal(proximaDirecao(4, null), 2, 'sem a lista do Habbo, 2 e 4');
  assert.equal(proximaDirecao(4, [4]), null, 'uma direção só: não gira');
  const L = { w: 8, d: 8 };
  assert.deepEqual(encaixar(-3.2, 2.6, { w: 2, h: 1 }, L), { x: 0, y: 3 });
  assert.deepEqual(encaixar(9.4, 9.9, { w: 2, h: 2 }, L), { x: 6, y: 6 });
  assert.equal(cabeNaSala(7, 0, { w: 2, h: 1 }, L), false);
  assert.equal(cabeNaSala(6, 7, { w: 2, h: 1 }, L), true);
  assert.equal(sobrepoe(SALVO(), -1, 2, 3, { w: 1, h: 1 }), true, 'a mesa ocupa 2..4 × 2..4');
  assert.equal(sobrepoe(SALVO(), -1, 0, 6, { w: 1, h: 1 }), false);
});

test('mover, girar, guardar e pôr devolvem o item que o editor do Escritório grava', () => {
  const antes = SALVO();
  // Mover a mesa leva junto o computador que está em cima (escritorioLevarOQueEstaEmCima).
  let itens = moverItem(antes, 1, 4, 3);
  assert.deepEqual(itens[1], ['exe_table', 4, 3, 0, 0, 0]);
  assert.deepEqual(itens[2], ['computer_flatscreen', 5, 3, 0, 1, 0.95], 'o que estava em cima andou junto, com a mesma altura');
  assert.deepEqual(antes[1], ['exe_table', 2, 2, 0, 0, 0], 'a lista de antes não muda (desfazer)');
  itens = girarItem(itens, 3, proximaDirecao(itens[3][3], [0, 2, 4, 6]));
  assert.deepEqual(itens[3], ['chair_silo', 3, 4, 2, 0, 0]);
  itens = moverItem(itens, 4, 6, 6);
  assert.deepEqual(itens[4], ['fball_trophy', 6, 6, 2, 0, 0, { n: 'Bia', d: '2026-10-31' }], 'o 7º campo (dedicatória) vai junto');
  const g = guardarItem(itens, 0);
  assert.deepEqual(g.item, ['exe_sofa', 5, 0, 4, 0, 0]);
  assert.equal(g.itens.length, 4);
  itens = porItem(g.itens, 'plant_big_cactus', 0, 7, 2);
  assert.deepEqual(itens.at(-1), ['plant_big_cactus', 0, 7, 2, 0, 0]);
  assert.deepEqual(porItem([], 'attic15_window', 3, 0, 4, { parede: true })[0], ['attic15_window', 3, 0, 4, 0, 1], 'na parede, altura 1 como no editor');
  // O servidor do Escritório guarda exatamente isto (nada é corrigido nem descartado).
  assert.deepEqual(itensValidos('sala-4', itens), itens);
});

// ---------- o painel (vybe-mundo-decorar.js) com o Escritório de verdade ----------
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.id = ''; this.className = ''; this.innerHTML = ''; this.dataset = {}; this.style = {}; this.ouvintes = {}; this.atributos = {}; this.isConnected = false; this.classList = classes(); }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  getAttribute(k) { return this.atributos[k] ?? null; }
  addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); }
  removeEventListener() {}
  append(...n) { for (const x of n) x.isConnected = true; }
  appendChild(n) { this.append(n); return n; }
  remove() { this.isConnected = false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return false; }
  focus() {}
}
function classes() { const s = new Set(); return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => ((f ?? !s.has(c)) ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }

const ECONOMIA = () => ({ disponivel: true, saldo: 120, essenciais: ['tile_stella'],
  inventario: [{ classe: 'exe_sofa', quantidade: 1 }, { classe: 'exe_table', quantidade: 1 }, { classe: 'computer_flatscreen', quantidade: 1 },
    { classe: 'chair_silo', quantidade: 2 }, { classe: 'plant_big_cactus', quantidade: 1 }, { classe: 'tile_stella', quantidade: 9 }] });
const BASE = () => ({
  eu: '5', admin: true,
  salas: [{ id: 'sala-1', dono: 'Vinícius', pessoa_id: '7' }, { id: 'sala-4', dono: 'Bia', pessoa_id: '5' }],
  equipe: [{ id: '5', nome: 'Bia Souza', perfil: {} }, { id: '7', nome: 'Vinícius Lima', perfil: { quarto_configurado: true, sala_piso: 'concreto' } }],
  mapa: { editavel: true, camadas: {
    'sala-4': { itens: SALVO(), versao: 3, em: '2026-11-06T12:00:00Z' },
    'sala-4-andar-1': { itens: [['chair_silo', 1, 1, 2, 0, 0]], versao: 1, em: '2026-11-06T12:00:00Z' },
  } },
});
const PERFIL = () => ({ quarto_configurado: true, sala_planta: 'amplo', sala_piso: 'madeira', sala_parede: '', sala_taca: '3,3,2' });

function cenaFalsa() {
  const c = { chamadas: [], op: null };
  c.iniciarEdicao = (op) => { c.op = op; c.chamadas.push(['iniciarEdicao', op.sala, j(op.itens)]); return true; };
  c.pararEdicao = () => c.chamadas.push(['pararEdicao']);
  c.definirItens = (itens, sala) => c.chamadas.push(['definirItens', j(itens), sala]);
  c.definirAcabamento = (sala, a) => c.chamadas.push(['definirAcabamento', sala, j(a)]);
  c.segurar = (classe) => { c.chamadas.push(['segurar', classe]); c.op?.aoSegurar?.(classe); };
  c.selecionar = (i) => { c.chamadas.push(['selecionar', i]); c.op?.aoSelecionar?.(i); };
  c.girar = () => c.chamadas.push(['girar']);
  c.guardar = () => c.chamadas.push(['guardar']);
  c.medidas = (l) => c.chamadas.push(['medidas', j(l)]);
  c.de = (nome) => c.chamadas.filter((x) => x[0] === nome);
  return c;
}
const MODULO = { CATALOGO: [{ classe: 'chair_silo', nome: 'Cadeira de escritório laranja' }],
  pecaDaClasse: (c) => ({ nome: { chair_silo: 'Cadeira de escritório laranja' }[c] || null }), iconeMovel: () => ({ toDataURL: () => 'data:image/png;base64,AA' }) };

function montar({ base = BASE(), perfil = PERFIL(), confirmar = true, falhar = null } = {}) {
  const noop = () => {};
  const corpo = new El('body');
  const api = { chamadas: [] }, avisados = [], perguntas = [];
  const ctx = {
    console, setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop,
    document: { body: corpo, documentElement: new El('html'), activeElement: null, addEventListener: noop, removeEventListener: noop, createElement: (t) => new El(t),
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, location: { search: '', hash: '' }, navigator: {},
    matchMedia: () => ({ matches: false, addEventListener: noop }), performance: { now: () => 0 }, addEventListener: noop, removeEventListener: noop,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['shared/escritorio-nome-movel.js', 'vybe-escritorio-planta.js', 'vybe-escritorio-editor.js', 'vybe-escritorio.js', 'vybe-escritorio-ficha.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  ctx.__base = base; ctx.__perfil = perfil;
  vm.runInContext('escritorio.base = __base; escritorio.perfil = __perfil; escritorio.quarto = null;'
    + "escritorioCatalogo = [{ classe: 'attic15_window', nome: 'Attic Window', parede: true, giros: 1 }, { classe: 'chair_silo', nome: 'Chair', giros: 4 }];", ctx);
  // Dublês só do que sai da tela: a API (o servidor), o aviso aos colegas e a pergunta do painel.
  ctx.escritorioApi = async (acao, c) => {
    api.chamadas.push([acao, c ? j(c) : null]);
    if (acao === 'economia') return { ok: true, economia: ECONOMIA() };
    if (acao === 'mapa') {
      if (falhar) throw falhar;
      return { ok: true, camada: c.camada, versao: c.versao + 1, itens: itensValidos(c.camada, j(c.itens)), perfil: j(c.decoracao) };
    }
    throw new Error('rota inesperada: ' + acao);
  };
  ctx.escritorioAvisarDecoracao = (camada) => avisados.push(camada);
  ctx.confirmarNoPainel = async (msg, op) => { perguntas.push([msg, j(op)]); return typeof confirmar === 'function' ? confirmar() : confirmar; };
  vm.runInContext(fs.readFileSync('vybe-mundo-decorar.js', 'utf8'), ctx, { filename: 'vybe-mundo-decorar.js' });
  const cena = cenaFalsa();
  // Leituras saem do vm por JSON (outros protótipos); as ações vão direto.
  const V = ctx.VybeDecorar, D = { ...V, estado: () => j(V.estado()), inventario: () => j(V.inventario()), acabamentoDaSala: (id) => j(V.acabamentoDaSala(id)) };
  D.ligarCena(cena, MODULO);
  return { ctx, D, cena, api, avisados, perguntas, corpo, rodar: (codigo) => vm.runInContext(codigo, ctx) };
}

test('só o dono decora a própria sala: admin não decora a de outra pessoa, nem as salas comuns', async () => {
  const { D, cena, api } = montar();
  assert.equal(D.podeDecorar('sala-4'), true);
  assert.equal(D.podeDecorar('sala-1'), false, 'admin, mas a sala é do Vinícius (o servidor recusa com 403)');
  assert.equal(D.podeDecorar('cafe'), false);
  assert.equal(D.podeDecorar('geral'), false);
  assert.equal(D.podeDecorar('sala-4-andar-1'), false, 'o andar voxel mostra só o térreo');
  assert.equal(D.salaDecoravel(['sala-1', 'cafe', 'sala-4']), 'sala-4');
  assert.equal(await D.abrir('sala-1'), false);
  assert.equal(cena.de('iniciarEdicao').length, 0);
  assert.equal(api.chamadas.length, 0, 'nem leu o inventário');
  assert.equal(D.aberto(), false);

  const semMapa = montar({ base: { ...BASE(), mapa: { editavel: false, camadas: {} } } });
  assert.equal(semMapa.D.podeDecorar('sala-4'), false, 'mapa editável aguardando o banco');
  const convidado = montar({ base: { ...BASE(), convidado: true } });
  assert.equal(convidado.D.podeDecorar('sala-4'), false);
  const demo = montar({ base: { ...BASE(), demo: true, mapa: { camadas: {} } } });
  assert.equal(demo.D.podeDecorar('sala-4'), true, 'a demonstração edita sem gravar');
});

test('abrir lê o inventário como o editor e entrega à cena os móveis salvos da sala', async () => {
  const { D, cena, api, corpo } = montar();
  assert.equal(await D.abrir('sala-4'), true);
  assert.deepEqual(api.chamadas, [['economia', null]], 'a mesma leitura de abrirEditorEscritorio');
  const [[, sala, itens]] = cena.de('iniciarEdicao');
  assert.equal(sala, 'sala-4');
  assert.deepEqual(itens, j(SALVO()), 'escritorioItensDaCamada');
  assert.deepEqual(cena.de('definirAcabamento')[0], ['definirAcabamento', 'sala-4', { piso: ['#6b4a33', '#62432e'], parede: null }]);
  const e = D.estado();
  assert.equal(e.editando, true);
  assert.equal(e.mudou, false);
  assert.equal(e.versao, 3);
  assert.equal(corpo.classList.contains('vv-decorando'), true);
  assert.equal(D.aberto(), true);
});

test('a gravação chama a rota do Escritório com a camada, os itens, a versão e o acabamento', async () => {
  const { D, cena, api, avisados, rodar } = montar();
  await D.abrir('sala-4');
  let itens = D.estado().itens;
  itens = moverItem(itens, 1, 4, 3); cena.op.aoMudar(itens, { tipo: 'mover', i: 1 });
  itens = girarItem(itens, 3, 2); cena.op.aoMudar(itens, { tipo: 'girar', i: 3 });
  const g = guardarItem(itens, 0); cena.op.aoMudar(g.itens, { tipo: 'guardar', item: g.item });
  assert.match(D.estado().aviso, /volta ao inventário quando você salvar/);
  itens = porItem(g.itens, 'plant_big_cactus', 0, 7, 2); cena.op.aoMudar(itens, { tipo: 'por', classe: 'plant_big_cactus' });
  assert.equal(D.estado().mudou, true);
  assert.equal(D.estado().mudancas, 4);

  assert.equal(await D.salvar(), true);
  const [acao, corpo] = api.chamadas.at(-1);
  assert.equal(acao, 'mapa');
  assert.equal(corpo.camada, 'sala-4');
  assert.equal(corpo.versao, 3, 'a versão lida: o servidor recusa (409) se alguém salvou antes');
  assert.deepEqual(corpo.itens, j(itens));
  assert.deepEqual(itensValidos('sala-4', corpo.itens), corpo.itens, 'o mesmo formato que o servidor guarda');
  assert.deepEqual(corpo.decoracao, j(rodar('escritorioAcabamento(escritorio.perfil)')), 'o acabamento sai pelo escritorioAcabamento do editor');
  assert.equal(corpo.decoracao.sala_taca, '3,3,2', 'a taça da Copa fica onde estava');
  // Depois de gravar, o mesmo que salvarEditorEscritorio faz.
  assert.equal(rodar("escritorio.base.mapa.camadas['sala-4'].versao"), 4);
  assert.deepEqual(j(rodar("escritorio.base.mapa.camadas['sala-4'].itens")), j(itens));
  assert.deepEqual(avisados, ['sala-4'], 'os colegas recarregam a sala');
  assert.equal(D.estado().mudou, false);
  assert.equal(D.estado().versao, 4);
  assert.deepEqual(cena.de('definirItens').at(-1), ['definirItens', j(itens), 'sala-4']);
  assert.equal(await D.salvar(), false, 'sem mudança, não grava de novo');
  assert.equal(api.chamadas.filter(([a]) => a === 'mapa').length, 1);
});

test('desfazer e refazer voltam os móveis e o acabamento, inclusive na cena', async () => {
  const { D, cena } = montar();
  await D.abrir('sala-4');
  const inicio = D.estado().itens;
  const um = moverItem(inicio, 3, 0, 0); cena.op.aoMudar(um, { tipo: 'mover', i: 3 });
  const dois = girarItem(um, 3, 4); cena.op.aoMudar(dois, { tipo: 'girar', i: 3 });
  assert.equal(D.escolherPiso('marmore'), true);
  assert.equal(D.desfazer(), true);
  assert.equal(D.estado().decoracao.sala_piso, 'madeira');
  assert.deepEqual(D.estado().itens, j(dois));
  assert.equal(D.desfazer(), true);
  assert.deepEqual(D.estado().itens, j(um));
  assert.deepEqual(cena.de('definirItens').at(-1), ['definirItens', j(um), 'sala-4']);
  assert.equal(D.desfazer(), true);
  assert.equal(D.estado().mudou, false, 'de volta ao que está salvo');
  assert.equal(D.desfazer(), false, 'nada antes da abertura');
  assert.equal(D.refazer(), true);
  assert.deepEqual(D.estado().itens, j(um));
  assert.equal(D.estado().mudou, true);
});

test('piso e parede: o "Piso inteiro" e a cor das paredes do Escritório, gravados junto', async () => {
  const { D, cena, api } = montar();
  await D.abrir('sala-4');
  assert.equal(D.escolherPiso('nao-existe'), false);
  assert.equal(D.escolherParede('#123456'), false, 'só as cores que o servidor aceita');
  assert.equal(D.escolherPiso('marmore'), true);
  assert.deepEqual(cena.de('definirAcabamento').at(-1), ['definirAcabamento', 'sala-4', { piso: ['#d9d6d0', '#cfccc5'], parede: null }]);
  assert.equal(D.escolherParede('#5aa9ff'), true);
  assert.deepEqual(cena.de('definirAcabamento').at(-1)[2], { piso: ['#d9d6d0', '#cfccc5'], parede: '#5aa9ff' });
  assert.equal(await D.salvar(), true);
  const { decoracao } = api.chamadas.at(-1)[1];
  assert.equal(decoracao.sala_piso, 'marmore');
  assert.equal(decoracao.sala_pisos, '', 'a pintura ladrilho a ladrilho sai, como no Piso inteiro');
  assert.equal(decoracao.sala_parede, '#5aa9ff');
  assert.equal(D.acabamentoDaSala('sala-4').parede, '#5aa9ff', 'o perfil voltou do servidor');
  assert.deepEqual(D.acabamentoDaSala('sala-1'), { piso: ['#3d3f46', '#383a40'], parede: null }, 'as outras salas também mostram o piso do dono');
});

test('inventário: só móveis guardados, livres = os que o dono tem menos os que estão nos dois andares', async () => {
  const { D, cena } = montar();
  await D.abrir('sala-4');
  const inv = D.inventario();
  assert.ok(!inv.some((m) => m.classe === 'tile_stella'), 'material de construção (essencial) fica no editor do Escritório');
  const cadeira = inv.find((m) => m.classe === 'chair_silo');
  assert.equal(cadeira.nome, 'Cadeira de escritório laranja', 'o nome do catálogo voxel');
  assert.deepEqual([cadeira.tem, cadeira.naSala, cadeira.livres], [2, 2, 0], 'uma no térreo e uma no segundo andar');
  assert.equal(inv[0].classe, 'chair_silo', 'as peças do catálogo Vybe primeiro');
  assert.equal(inv.find((m) => m.classe === 'plant_big_cactus').livres, 1);
  assert.equal(D.segurar('chair_silo'), false);
  assert.match(D.estado().aviso, /Compre outra na Loja/);
  assert.equal(cena.de('segurar').length, 0);
  assert.equal(D.segurar('plant_big_cactus'), true);
  assert.deepEqual(cena.de('segurar'), [['segurar', 'plant_big_cactus']]);
  assert.equal(D.estado().naMao, 'plant_big_cactus');
  // A cena pôs a peça: ela sai da mão e deixa de estar livre.
  cena.op.aoMudar(porItem(D.estado().itens, 'plant_big_cactus', 0, 7, 2), { tipo: 'por', classe: 'plant_big_cactus' });
  assert.equal(D.estado().naMao, '');
  assert.equal(D.inventario().find((m) => m.classe === 'plant_big_cactus').livres, 0);
});

test('peças de parede encostam nas paredes do quarto do Escritório; a imagem da equipe fica onde está', async () => {
  const { D, cena } = montar();
  await D.abrir('sala-4');
  assert.equal(cena.op.tipoDeParede('attic15_window'), 'parede');
  assert.equal(cena.op.tipoDeParede('vybeimg_12'), 'imagem');
  assert.equal(cena.op.tipoDeParede('chair_silo'), '');
  assert.deepEqual(j(cena.op.lugarParede(3, 0, 3.5, 0.2)), { lx: 3, ly: 0, dir: 4 }, 'parede do fundo');
  assert.deepEqual(j(cena.op.lugarParede(0, 3, 0.2, 3.5)), { lx: 0, ly: 3, dir: 2 }, 'parede da esquerda');
  assert.equal(cena.op.lugarParede(4, 4, 4.5, 4.5), null, 'no meio da sala não tem parede');
  assert.equal(cena.op.lugarParede(9, 0, 9.5, 0.2), null, 'fora do quarto');
});

test('conflito ao salvar: o erro aparece e as mudanças continuam no painel', async () => {
  const falhar = Object.assign(new Error('Alguém salvou esta área antes. Recarregue para ver a versão nova.'), { status: 409 });
  const { D, cena, rodar } = montar({ falhar });
  await D.abrir('sala-4');
  const itens = moverItem(D.estado().itens, 3, 0, 0);
  cena.op.aoMudar(itens, { tipo: 'mover', i: 3 });
  assert.equal(await D.salvar(), false);
  const e = D.estado();
  assert.match(e.erro, /Alguém salvou esta área antes.*Suas mudanças continuam aqui/);
  assert.equal(e.mudou, true);
  assert.deepEqual(e.itens, j(itens));
  assert.equal(e.versao, 3);
  assert.equal(e.salvando, false);
  assert.equal(rodar("escritorio.base.mapa.camadas['sala-4'].versao"), 3, 'nada mudou no Escritório');
});

test('sair sem salvar pergunta antes e devolve a sala como estava', async () => {
  let resposta = false;
  const { D, cena, perguntas } = montar({ confirmar: () => resposta });
  await D.abrir('sala-4');
  cena.op.aoMudar(moverItem(D.estado().itens, 3, 0, 0), { tipo: 'mover', i: 3 });
  assert.equal(await D.fechar(), false);
  assert.equal(D.aberto(), true);
  assert.match(perguntas[0][0], /^Sair sem salvar\?/);
  assert.equal(perguntas[0][1].confirmar, 'Sair sem salvar');
  assert.equal(cena.de('pararEdicao').length, 0);
  resposta = true;
  assert.equal(await D.fechar(), true);
  assert.equal(D.aberto(), false);
  assert.deepEqual(cena.de('definirItens').at(-1), ['definirItens', j(SALVO()), 'sala-4'], 'a sala volta à decoração salva');
  assert.equal(cena.de('pararEdicao').length, 1);
  // Sem mudança: sai sem perguntar.
  await D.abrir('sala-4');
  assert.equal(await D.fechar(), true);
  assert.equal(perguntas.length, 2);
});

test('o andar fechou: a edição acaba sem perguntar', async () => {
  const { D, cena, perguntas } = montar();
  await D.abrir('sala-4');
  cena.op.aoMudar(moverItem(D.estado().itens, 3, 0, 0), { tipo: 'mover', i: 3 });
  D.ligarCena(null);
  assert.equal(D.aberto(), false);
  assert.equal(perguntas.length, 0);
  assert.equal(await D.abrir('sala-4'), false, 'sem cena, não abre');
});

test('demonstração: decora e "salva" sem chamar o servidor', async () => {
  const { D, cena, api, avisados } = montar({ base: { ...BASE(), demo: true } });
  await D.abrir('sala-4');
  assert.deepEqual(api.chamadas, [], 'nem a economia');
  cena.op.aoMudar(moverItem(D.estado().itens, 3, 0, 0), { tipo: 'mover', i: 3 });
  assert.equal(D.escolherPiso('deck'), true);
  assert.equal(await D.salvar(), true);
  assert.deepEqual(api.chamadas, []);
  assert.equal(D.estado().versao, 4);
  assert.equal(D.acabamentoDaSala('sala-4').piso[0], '#8a5f3c');
  assert.deepEqual(avisados, ['sala-4'], 'escritorioAvisarDecoracao recebe a camada (na demonstração ele mesmo não emite)');
});

test('quarto ainda não montado: o painel explica, não entra em edição', async () => {
  const { D, cena } = montar({ perfil: { quarto_configurado: false } });
  assert.equal(await D.abrir('sala-4'), true);
  assert.equal(D.estado().semQuarto, true);
  assert.equal(D.estado().editando, false);
  assert.equal(cena.de('iniciarEdicao').length, 0);
  assert.equal(await D.fechar(), true);
});
