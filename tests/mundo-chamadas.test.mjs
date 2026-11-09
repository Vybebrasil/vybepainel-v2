// SAFE: fontes reais em VM, mídia e DOM simulados; sem rede, dispositivos ou banco.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const office = readFileSync(new URL('../vybe-escritorio.js', import.meta.url), 'utf8');
const world = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
function fonte(src, nome, recuo = '') {
  const ini = src.search(new RegExp(`(?:async )?function ${nome}\\(`));
  assert.ok(ini >= 0, nome);
  const fim = src.indexOf(`\n${recuo}}`, ini);
  assert.ok(fim > ini, nome);
  return src.slice(ini, fim + recuo.length + 2);
}
function chamada() {
  const eventos = [], timers = [], avisos = [];
  const self = { audioEnabled: false, videoEnabled: false, screenShareEnabled: false };
  for (const [meio, flag] of [['Audio', 'audioEnabled'], ['Video', 'videoEnabled'], ['ScreenShare', 'screenShareEnabled']]) {
    self[`enable${meio}`] = async () => { eventos.push(`ligar${meio}`); self[flag] = true; };
    self[`disable${meio}`] = async () => { eventos.push(`desligar${meio}`); self[flag] = false; };
  }
  const e = { conectado: true, zona: 'sala-a', canalChamada: 'escritorio', microfoneQuer: false, erroMic: null, base: {}, online: [], trancas: new Map(), chamada: { self } };
  const c = vm.createContext({ escritorio: e, Set, Map, window: {}, andarAbertoId: '', quartoDaSala: () => null, abrirMinhaSala() {},
    setTimeout: f => { timers.push(f); return timers.length; },
    pintarChamada() {}, focarSalaDaChamada() {}, moverParaSala: zona => { e.zona = zona; },
    escritorioTocarVozes() {}, renderMidiaEscritorio() {}, atualizarControlesEscritorio() {},
    escritorioAviso: m => avisos.push(m), escritorioDiagnosticarMic: async () => ({ titulo: 'Negado' }),
    aplicarQualidadeTelaEscritorio: async () => eventos.push('qualidade'),
  });
  c.fn = n => c[n];
  for (const n of ['escritorioCanal', 'escritorioSincronizarVoz', 'alternarMidiaEscritorio', 'escritorioEstadoVozTexto']) vm.runInContext(fonte(office, n), c);
  vm.runInContext(fonte(world, 'irParaSala', '  '), c);
  return { c, e, self, eventos, timers, avisos };
}
test('trocar de sala e clicar na própria sala preservam mute; entrada recusada também', async () => {
  const { c, e, self, eventos } = chamada();
  c.irParaSala('sala-b'); await c.escritorioSincronizarVoz();
  assert.equal(e.zona, 'sala-b'); assert.equal(e.microfoneQuer, false); assert.equal(self.audioEnabled, false);
  c.irParaSala('sala-b'); assert.equal(e.microfoneQuer, false);
  c.moverParaSala = () => {}; e.erroMic = { titulo: 'Permissão negada' };
  c.irParaSala('sala-trancada'); await c.escritorioSincronizarVoz();
  assert.equal(e.zona, 'sala-b'); assert.equal(e.microfoneQuer, false); assert.equal(e.erroMic.titulo, 'Permissão negada');
  assert.deepEqual(eventos, []);
});
test('microfone ligado continua ligado na troca; escolha explícita de mute é aplicada', async () => {
  const { c, e, self } = chamada(); e.microfoneQuer = true; self.audioEnabled = true;
  c.irParaSala('sala-b'); await c.escritorioSincronizarVoz(); assert.equal(self.audioEnabled, true);
  e.microfoneQuer = false; await c.escritorioSincronizarVoz(); assert.equal(self.audioEnabled, false);
});
test('Foco e Praça desligam áudio, câmera e tela, preservando mute para a próxima sala', async () => {
  for (const zona of ['foco', '']) {
    const { c, e, self, eventos } = chamada();
    Object.assign(self, { audioEnabled: true, videoEnabled: true, screenShareEnabled: true });
    e.microfoneQuer = true; e.zona = zona; await c.escritorioSincronizarVoz();
    assert.equal(self.audioEnabled, false); assert.equal(self.videoEnabled, false); assert.equal(self.screenShareEnabled, false);
    assert.equal(e.microfoneQuer, true); assert.deepEqual(eventos, ['desligarAudio', 'desligarVideo', 'desligarScreenShare']);
  }
});
test('chamada da sala anterior não habilita áudio, câmera ou tela na nova sala', async () => {
  for (const tipo of ['audio', 'video', 'screen']) {
    const { c, e, eventos, avisos } = chamada(); e.trancas.set(e.zona, new Set());
    await c.alternarMidiaEscritorio(tipo); assert.deepEqual(eventos, []); assert.equal(avisos.length, 1);
  }
});
test('parar transmissão funciona fora da sala; iniciar tela usa o SDK existente sem TV', async () => {
  const { c, e, self, eventos } = chamada();
  await c.alternarMidiaEscritorio('screen'); assert.equal(self.screenShareEnabled, true);
  assert.deepEqual(eventos, ['ligarScreenShare', 'qualidade']);
  e.zona = 'foco'; await c.alternarMidiaEscritorio('screen'); assert.equal(self.screenShareEnabled, false);
});
test('permissão de câmera ou tela concluída depois de entrar no Foco não mantém transmissão', async () => {
  for (const [tipo, metodo, flag] of [['video', 'enableVideo', 'videoEnabled'], ['screen', 'enableScreenShare', 'screenShareEnabled']]) {
    const { c, e, self } = chamada();
    self[metodo] = async () => { e.zona = 'foco'; self[flag] = true; };
    await c.alternarMidiaEscritorio(tipo); assert.equal(self[flag], false);
  }
});
test('mute durante habilitação pendente de microfone não é desfeito pelo retorno tardio', async () => {
  const { c, e, self } = chamada(); e.microfoneQuer = true;
  self.enableAudio = async () => { e.microfoneQuer = false; self.audioEnabled = true; };
  await c.escritorioSincronizarVoz(); assert.equal(self.audioEnabled, false); assert.equal(e.erroMic, null);
});
function barra(e, participantes, falando = new Set()) {
  const el = { hidden: false, innerHTML: '', querySelector: () => null };
  const funcoes = { escritorioCanal: () => 'escritorio', escritorioOuvindo: () => participantes,
    escritorioPessoasFalando: () => falando, escritorioEstadoVozTexto: () => 'Conectando' };
  const c = vm.createContext({ escritorio: e, mundo: { zonasDoPredio: {} }, zonas3d: () => ({}), barra: el,
    body: { classList: { contains: () => false } }, ligado: true, window: {},
    pessoaAberta: null, chamarAberto: false, minhaSalaDaConta: () => '', fn: n => funcoes[n], esc: String, iniciais: n => n[0],
    musicaHtml: () => '', salasDeVozHtml: ({ estadoVoz }) => '<lista>' + estadoVoz + '</lista>', IC: {}, Set, marcarVozNoTopo: () => {}, pintarDock() {}, microfonesNaChamada: () => new Map(), primeiro: (n) => String(n || '?').split(' ')[0],
  });
  vm.runInContext(fonte(world, 'pintarChamada', '  '), c); c.pintarChamada(); return el.innerHTML;
}
test('barra conta participantes da chamada separadamente de pessoas apenas presentes', () => {
  const { e, self } = chamada(); self.audioEnabled = true;
  e.online = [{ id: '2', nome: 'Ana', zona: e.zona }, { id: '3', nome: 'Bia', zona: e.zona }];
  const html = barra(e, [{ customParticipantId: '2:sessao' }]);
  assert.match(html, /Na chamada com Ana · Bia está na sala, fora da chamada/);
  assert.doesNotMatch(html, /ouve você|falando/);
  e.canalChamada = 'sala-antiga'; const transicao = barra(e, [{ customParticipantId: '2:sessao' }]);
  assert.doesNotMatch(transicao, /Na chamada com/, 'no canal anterior não diz que está na chamada');
});
test('estado da voz não anuncia conversa da sala enquanto está no canal anterior', () => {
  const { c, e } = chamada(); assert.equal(c.escritorioEstadoVozTexto(), 'Na conversa da sala');
  e.canalChamada = 'sala-antiga'; assert.match(c.escritorioEstadoVozTexto(), /Conectando/);
  e.falhaConversa = 'Sem rede'; assert.match(c.escritorioEstadoVozTexto(), /indisponível/);
});
test('indicador de fala usa nível medido, e zera com silêncio, mute e encerramento', () => {
  const { c, e, self } = chamada(); self.id = 'eu'; self.audioEnabled = true; e.base.eu = '1';
  const classe = new Set();
  c.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [{ classList: { toggle: (k, v) => v ? classe.add(k) : classe.delete(k) } }] };
  c.CSS = { escape: String }; c.clearInterval = () => {};
  const bloco = office.slice(office.indexOf('const escritorioNivelAudio ='), office.indexOf('// Mini tela de quem'));
  vm.runInContext(bloco, c);
  vm.runInContext('escritorioNivelAudio.marcar(escritorio.chamada.self, 0.5)', c);
  assert.deepEqual([...c.escritorioPessoasFalando()], ['1']); assert.ok(classe.has('fala'));
  vm.runInContext('escritorioNivelAudio.marcar(escritorio.chamada.self, 0)', c);
  assert.equal(c.escritorioPessoasFalando().size, 0); assert.ok(!classe.has('fala'));
  self.audioEnabled = false; vm.runInContext('escritorioNivelAudio.marcar(escritorio.chamada.self, 0.7)', c);
  assert.equal(c.escritorioPessoasFalando().size, 0);
  self.audioEnabled = true; vm.runInContext('escritorioNivelAudio.marcar(escritorio.chamada.self, 0.5); escritorioNivelAudio.parar()', c);
  assert.equal(c.escritorioPessoasFalando().size, 0);
});
function palcoSimulado() {
  class El {
    constructor(tag) { this.tag = tag; this.children = []; this.classes = new Set(); this.attrs = {}; this.listeners = {}; this.classList = { toggle: (k, v) => { const valor = v ?? !this.classes.has(k); valor ? this.classes.add(k) : this.classes.delete(k); return valor; }, contains: k => this.classes.has(k) }; }
    append(...itens) { for (const item of itens) { this.children.push(item); item.parent = this; } }
    setAttribute(k, v) { this.attrs[k] = v; }
    querySelectorAll(tag) { return this.children.flatMap(x => [...(x.tag === tag ? [x] : []), ...x.querySelectorAll(tag)]); }
    querySelector(s) { return s === '[data-palco="parar"]' ? parar : null; }
    closest() { return this.parent; }
    remove() { this.parent.children = this.parent.children.filter(x => x !== this); }
    addEventListener(n, f) { this.listeners[n] = f; }
    play() { return Promise.resolve(); }
  }
  const parar = { hidden: true }, originais = [], body = new El('body');
  const document = { body, fullscreenElement: null, createElement: tag => new El(tag), getElementById: id => id === 'office-call-media' ? { querySelectorAll: () => originais } : null, exitFullscreen: async () => { document.fullscreenElement = null; } };
  const { e, self } = chamada();
  const c = vm.createContext({ document, escritorio: e, ligado: true, setInterval: () => 0,
    pintarChamada() {}, fn: n => ({ escritorioCanal: () => e.zona === 'foco' ? null : 'escritorio', alternarMidiaEscritorio: async () => { self.screenShareEnabled = false; } })[n] });
  const inicio = world.indexOf("  const palco = document.createElement('section');");
  const fim = world.indexOf('  if (typeof setInterval', inicio);
  vm.runInContext(world.slice(inicio, fim), c);
  const palco = vm.runInContext('palco', c);
  palco.requestFullscreen = async () => { document.fullscreenElement = palco; };
  return { c, palco, parar, originais, document, e, self };
}
test('palco preserva stream, nome e controles sem duplicar vídeo; retira mídia ao sair da chamada', () => {
  const { c, palco, originais, e } = palcoSimulado();
  const stream = { id: 'tela-1' };
  originais.push({ srcObject: stream, closest: () => ({ querySelector: () => ({ textContent: 'Ana' }) }) });
  c.trazerProPalco(); c.trazerProPalco();
  const videos = palco.querySelectorAll('video'); assert.equal(videos.length, 1);
  assert.equal(videos[0].srcObject, stream); assert.equal(videos[0].controls, true); assert.equal(videos[0].muted, true);
  assert.equal(palco.querySelectorAll('figcaption')[0].textContent, 'Ana');
  e.zona = 'foco'; c.trazerProPalco(); assert.equal(palco.querySelectorAll('video').length, 0); assert.ok(!palco.classes.has('com-video'));
});
test('palco amplia, sai da tela cheia e permite parar a própria transmissão', async () => {
  const { c, palco, parar, self, document } = palcoSimulado();
  const clicar = acao => palco.listeners.click({ target: { closest: () => ({ dataset: { palco: acao } }) } });
  self.screenShareEnabled = true; c.trazerProPalco(); assert.equal(parar.hidden, false);
  await clicar('cheia'); assert.equal(document.fullscreenElement, palco);
  await clicar('cheia'); assert.equal(document.fullscreenElement, null);
  await clicar('parar'); assert.equal(self.screenShareEnabled, false); assert.equal(parar.hidden, true);
});
// Saída manual é diferente das trocas internas de canal: não pode reconectar sozinha.
function controlesDeSaida() {
  const r = chamada(), { c } = r;
  let saiu = 0, tentativas = 0;
  Object.assign(c, { clearTimeout() {}, escritorioFiltroVoz: { geracao: 0 },
    escritorioNivelAudio: { parar() {}, iniciar() {} }, escritorioPararVozes() {}, atualizarDockEscritorio() {},
    document: { getElementById: () => null }, console: { warn() {} },
    escritorioComPrazo: p => p, escritorioMotorVoz: async () => {}, escritorioPrefsAudio: () => ({}), escritorioLimiteTela: () => ({}),
    escritorioTentarVozDeNovo: () => { tentativas++; },
  });
  r.e.chamada.leave = async () => { saiu++; };
  for (const n of ['sairChamadaEscritorio', 'entrarChamadaEscritorio', 'escritorioConversaAutomatica']) vm.runInContext(fonte(office, n), c);
  return { ...r, saidas: () => saiu, tentativas: () => tentativas };
}
test('sair manualmente encerra dispositivos e reunião, mantendo presença e lugar no painel', async () => {
  const { c, e, self, eventos, saidas } = controlesDeSaida();
  Object.assign(self, { audioEnabled: true, videoEnabled: true, screenShareEnabled: true });
  await c.sairChamadaEscritorio({ manual: true });
  assert.equal(e.vozPausada, true); assert.equal(e.chamada, null); assert.equal(e.conectado, true); assert.equal(e.zona, 'sala-a');
  assert.equal(self.audioEnabled, false); assert.equal(self.videoEnabled, false); assert.equal(self.screenShareEnabled, false);
  assert.equal(saidas(), 1); assert.deepEqual(eventos, ['desligarAudio', 'desligarVideo', 'desligarScreenShare']);
});
test('saída manual não é desfeita pela conversa automática ou por nova entrada atrasada', async () => {
  const { c, e } = controlesDeSaida(); await c.sairChamadaEscritorio({ manual: true });
  let tokens = 0; c.escritorioTokenDaZona = async () => { tokens++; return {}; };
  c.escritorioConversaAutomatica(); await c.entrarChamadaEscritorio(); assert.equal(tokens, 0); assert.equal(e.chamada, null);
});
test('clicar numa sala retoma a chamada sem desfazer mute; porta recusada mantém saída manual', () => {
  const { c, e, timers } = chamada(); e.vozPausada = true;
  c.moverParaSala = () => {}; c.irParaSala('sala-trancada');
  for (const f of timers.splice(0)) f(); assert.equal(e.vozPausada, true);
  c.moverParaSala = zona => { e.zona = zona; }; c.irParaSala('sala-b');
  for (const f of timers.splice(0)) f(); assert.equal(e.vozPausada, false); assert.equal(e.microfoneQuer, false);
});
test('token de entrada anterior à saída não entra no SDK, mesmo após pedido de retomar', async () => {
  const { c, e, tentativas } = controlesDeSaida(); e.chamada = null;
  let resolver, inicializacoes = 0;
  c.escritorioTokenDaZona = () => new Promise(r => { resolver = r; });
  c.window.RealtimeKitClient = { init: () => { inicializacoes++; throw new Error('Não deveria iniciar'); } };
  const pendente = c.entrarChamadaEscritorio();
  await c.sairChamadaEscritorio({ manual: true }); e.vozPausada = false;
  resolver({ authToken: 'token-ficticio' }); await pendente;
  assert.equal(inicializacoes, 0); assert.equal(tentativas(), 0); assert.equal(e.chamada, null);
});
test('saída durante inicialização do SDK deixa a reunião tardia sem entrar nela', async () => {
  const { c, e, tentativas } = controlesDeSaida(); e.chamada = null;
  let resolver, joins = 0, leaves = 0;
  c.escritorioTokenDaZona = async () => ({ authToken: 'token-ficticio' });
  c.window.RealtimeKitClient = { init: () => new Promise(r => { resolver = r; }) };
  const pendente = c.entrarChamadaEscritorio();
  for (let i = 0; i < 15 && !resolver; i++) await Promise.resolve(); assert.ok(resolver);
  await c.sairChamadaEscritorio({ manual: true });
  resolver({ join: async () => { joins++; }, leave: async () => { leaves++; } }); await pendente;
  assert.equal(joins, 0); assert.equal(leaves, 1); assert.equal(tentativas(), 0);
});
test('ajustar processamento de áudio reconecta preservando a escolha de mute', async () => {
  const { c, e } = chamada(); let microfone;
  c.escritorioSalvarPrefsAudio = () => {};
  c.sairChamadaEscritorio = async () => {};
  c.entrarChamadaEscritorio = async op => { microfone = op.microfone; };
  vm.runInContext(fonte(office, 'mudarProcessamentoAudio'), c);
  await c.mudarProcessamentoAudio('ruido', true); assert.equal(microfone, false);
  e.microfoneQuer = true; await c.mudarProcessamentoAudio('ruido', false); assert.equal(microfone, true);
});
test('temporizadores de Ir até anteriores à saída manual não retomam a chamada', async () => {
  const { c, e, timers } = controlesDeSaida(); let retomou = 0;
  c.escritorioConversaAutomatica = () => { retomou++; };
  c.irParaSala('sala-b'); await c.sairChamadaEscritorio({ manual: true });
  for (const f of timers.splice(0)) f();
  assert.equal(e.vozPausada, true); assert.equal(e.chamada, null); assert.equal(retomou, 0);
});
test('saída antiga concluída depois de nova entrada não limpa o vídeo da chamada atual', async () => {
  const { c, e } = controlesDeSaida(); let concluir, limpou = 0;
  e.chamada.leave = () => new Promise(r => { concluir = r; });
  c.document.getElementById = () => ({ setAttribute() { limpou++; }, replaceChildren() { limpou++; }, remove() {} });
  const pendente = c.sairChamadaEscritorio({ manual: true });
  for (let i = 0; i < 10 && !concluir; i++) await Promise.resolve(); assert.ok(concluir);
  e.vozPausada = false; e.chamada = { self: {} }; concluir(); await pendente;
  assert.equal(limpou, 0);
});
