// SAFE: fontes reais (vybe-escritorio.js e o dock de vybe-mundo.js) em VM, com dublê do transporte de mídia (RealtimeKit),
// do WebSocket do escritório, do relógio e do DOM. Sem rede, sem dispositivos, sem servidor.
// Estados da chamada (Paulo, 14/11/2026: "às vezes tá conectando mas fica o nome ENTRAR lá e a pessoa fica clicando").
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const office = readFileSync(new URL('../vybe-escritorio.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const world = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function fonte(src, nome) {
  const ini = src.search(new RegExp(`\\n(?:async )?function ${nome}\\(`));
  assert.ok(ini >= 0, nome);
  const fim = src.indexOf('\n}', ini + 1);
  return src.slice(ini, fim + 2);
}
const vazio = () => Promise.resolve();
const negado = () => Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
function emissor() {
  const ev = {};
  return { on(n, f) { (ev[n] ||= []).push(f); }, emit(n, ...a) { for (const f of ev[n] || []) f(...a); }, ouvintes(n) { return (ev[n] || []).length; } };
}
// Dublê do RealtimeKit: cada init devolve uma reunião; join pode ficar pendurado (rede lenta) até o teste soltar.
function transporte() {
  const t = { reunioes: [], joinPendente: false, micNegado: false, cameraNegada: false, telaCancelada: false };
  t.init = async ({ defaults }) => {
    const self = { ...emissor(), audioEnabled: Boolean(defaults.audio && !t.micNegado), videoEnabled: false, screenShareEnabled: false };
    self.enableAudio = async () => { if (t.micNegado) throw negado(); self.audioEnabled = true; self.emit('audioUpdate'); };
    self.disableAudio = async () => { self.audioEnabled = false; self.emit('audioUpdate'); };
    self.enableVideo = async () => { if (t.cameraNegada) throw negado(); self.videoEnabled = true; self.emit('videoUpdate'); };
    self.disableVideo = async () => { self.videoEnabled = false; self.emit('videoUpdate'); };
    self.enableScreenShare = async () => { if (t.telaCancelada) throw negado(); self.screenShareEnabled = true; self.emit('screenShareUpdate'); };
    self.disableScreenShare = async () => { self.screenShareEnabled = false; self.emit('screenShareUpdate'); };
    self.playAudio = async () => {};
    const joined = { ...emissor(), lista: [], toArray() { return this.lista; } };
    let soltar; const entrou = new Promise((r) => { soltar = r; });
    const m = { self, participants: { joined }, saiu: false, soltar, join: () => (t.joinPendente ? entrou : Promise.resolve()), leave: async () => { m.saiu = true; } };
    t.reunioes.push(m);
    return m;
  };
  return t;
}
function montar({ e: extra = {}, online = true } = {}) {
  const relogio = { agora: 1_000_000, fila: [], seq: 0 };
  const setTimeout = (f, ms = 0) => { const id = ++relogio.seq; relogio.fila.push({ id, em: relogio.agora + ms, f }); return id; };
  const clearTimeout = (id) => { relogio.fila = relogio.fila.filter((x) => x.id !== id); };
  const avisos = [], tr = transporte();
  const e = { conectado: true, conectando: false, zona: 'sala-a', base: { eu: '1' }, online: [], trancas: new Map(), chamada: null, entrandoChamada: false, microfoneQuer: false, geracao: 0, ...extra };
  const docOuvintes = [];
  const c = vm.createContext({
    escritorio: e, window: { RealtimeKitClient: { init: tr.init } }, navigator: { onLine: online, mediaDevices: { getDisplayMedia() {} } },
    document: { addEventListener: (n, f) => docOuvintes.push([n, f]), removeEventListener: (n, f) => { const i = docOuvintes.findIndex((x) => x[0] === n && x[1] === f); if (i >= 0) docOuvintes.splice(i, 1); }, getElementById: () => null, visibilityState: 'visible' },
    Date: { now: () => relogio.agora }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Promise, Error, Map, Set, String, Boolean, Object, console: { warn() {} },
    escritorioAviso: (m) => avisos.push(m), atualizarControlesEscritorio() {}, atualizarDockEscritorio() {}, renderEscritorio() {}, renderMidiaEscritorio() {},
    escritorioTokenDaZona: async () => ({ authToken: 't' }), escritorioMotorVoz: vazio, escritorioPrefsAudio: () => ({}), escritorioLimiteTela: () => ({}),
    escritorioNivelAudio: { ligado: false, iniciar() { this.ligado = true; }, parar() { this.ligado = false; } }, escritorioAplicarDispositivos() {}, escritorioAplicarFiltroVoz() {},
    escritorioTocarVozes() {}, escritorioPararVozes() {}, escritorioFiltroVoz: { geracao: 0 }, escritorioOutraAbaConectada: () => false,
    escritorioDiagnosticarMic: async () => ({ tipo: 'negado', titulo: 'O navegador bloqueou o microfone', dica: 'Clique no cadeado.' }),
    aplicarQualidadeTelaEscritorio: vazio, escritorioQuererMicrofone(v) { e.microfoneQuer = v; }, tentarEntrarDeNovoEscritorio() {}, conectarEscritorio() {}, abrirEscritorio() {},
    escritorioOuvindo: () => [],
  });
  for (const n of ['escritorioCanal', 'escritorioFaseChamada', 'escritorioMidiaChamada', 'escritorioTextoTransicao', 'escritorioEstadoChamada', 'escritorioTentarChamadaDeNovo',
    'escritorioTelaParou', 'escritorioMudancaNaSala', 'escritorioTextoMudancaSala', 'escritorioAvisoNaSala', 'escritorioComPrazo', 'entrarChamadaEscritorio', 'escritorioConversaAutomatica',
    'escritorioTentarVozDeNovo', 'sairChamadaEscritorio', 'alternarMidiaEscritorio', 'escritorioSincronizarVoz', 'escritorioMicDesligouSozinho', 'escritorioOutrosNaChamada', 'escritorioLiberarSom', 'escritorioVozCaiu'])
    vm.runInContext(fonte(office, n), c);
  vm.runInContext('var ESCRITORIO_VOZ_PRAZO = 15000;', c);
  // vm.runInContext não expõe const/let do topo: as funções acima são declarações, então ficam em c.
  const passar = async (ms = 0) => {
    for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
    const ate = relogio.agora + ms;
    for (;;) {
      relogio.fila.sort((a, b) => a.em - b.em);
      const x = relogio.fila[0];
      if (!x || x.em > ate) break;
      relogio.fila.shift(); relogio.agora = Math.max(relogio.agora, x.em); x.f();
      for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
    }
    relogio.agora = ate;
  };
  const estado = () => c.escritorioEstadoChamada(relogio.agora);
  return { c, e, tr, avisos, relogio, passar, estado, docOuvintes };
}
// O dock de verdade (dockSalasHtml + botaoVozHtml + vozAgora), lendo o estado da VM do escritório.
function dock(m, { celular = false } = {}) {
  const ini = world.indexOf('  function dockSalasHtml('), fim = world.indexOf('  const faixaDock = ');
  const ctx = { escritorio: m.e, andarAbertoId: '', body: { classList: { contains: () => false } }, noCelular: () => celular,
    zonas3d: () => ({ 'sala-a': { nome: 'Sala do Paulo' } }), minhaSalaDaConta: () => 'sala-a', quartoDaSala: () => null,
    fn: (n) => ({ escritorioEstadoChamada: m.estado, escritorioCanal: m.c.escritorioCanal, escritorioPessoasFalando: () => new Set(), escritorioOutrosNaChamada: m.c.escritorioOutrosNaChamada })[n] || null,
    esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), svg: (d) => `<svg>${d}</svg>`,
    IC: { mic: 'MIC', micOff: 'MICOFF', musica: 'MUS', som: 'SOM', semSom: 'SEMSOM', camera: 'CAM', tela: 'TELA', ajustes: 'AJ', tv: 'TV' }, n0: String, window: {}, Set, Map, String, Math };
  vm.createContext(ctx); vm.runInContext(world.slice(ini, fim), ctx);
  return ctx.dockSalasHtml(Infinity);
}
const pecaVoz = (h) => (h.match(/<span class="vq-voz"[\s\S]*?<\/button><\/span>|<span class="vq-voz"[^>]*>[\s\S]*?<\/span><\/span>/) || [''])[0];

test('conectando → na sala → caiu → reconectando → na sala: o dock nunca mostra Entrar fora da fase "fora"', async () => {
  const m = montar(); m.tr.joinPendente = true;
  m.c.escritorioConversaAutomatica();
  await m.passar(0);
  assert.equal(m.estado().fase, 'conectando');
  let h = dock(m);
  assert.match(pecaVoz(h), /disabled aria-busy="true"[^>]*>.*Conectando…<\/button>/, 'girando e travado');
  assert.doesNotMatch(h, /data-dock="entrar"/, 'sem Entrar enquanto conecta');
  assert.match(h, /data-dock="mic"[^>]*disabled/, 'microfone apagado até conectar');
  m.tr.reunioes[0].soltar(); await m.passar(0);
  assert.equal(m.estado().fase, 'na-sala');
  h = dock(m);
  assert.match(pecaVoz(h), /class="dentro" disabled[^>]*>Dentro/);
  assert.match(h, /data-fase="na-sala"/);
  // O servidor de mídia derrubou: reconectando, com a nova tentativa sozinha.
  m.tr.joinPendente = false;
  m.tr.reunioes[0].self.emit('roomLeft');
  assert.equal(m.estado().fase, 'reconectando');
  assert.match(pecaVoz(dock(m)), /aria-busy="true"[^>]*>.*Reconectando…/);
  assert.doesNotMatch(dock(m), /data-dock="entrar"/);
  await m.passar(1000);
  assert.equal(m.e.chamada, m.tr.reunioes[1]);
  assert.equal(m.estado().fase, 'na-sala');
  assert.ok(m.avisos.includes('A voz voltou: você está na sala de novo.'), m.avisos.join(' | '));
  assert.ok(!m.avisos.some((a) => /Você entrou na conversa/.test(a)), 'a volta não repete o aviso de entrada');
});

test('15 s em "Conectando" viram "caiu" com Tentar de novo; o retorno tardio da tentativa velha não solta a nova', async () => {
  const m = montar(); m.tr.joinPendente = true;
  m.c.escritorioConversaAutomatica(); await m.passar(0); m.estado(); // a pintura do dock (a cada 1,5 s) marca o começo
  const velha = m.e.entrandoChamada;
  assert.ok(velha, 'entrando');
  await m.passar(14000); assert.equal(m.estado().fase, 'conectando');
  await m.passar(1500);
  const st = m.estado();
  assert.equal(st.fase, 'caiu'); assert.equal(st.motivo, 'demorou demais para conectar');
  assert.ok(m.avisos.some((a) => a.startsWith('A voz não conectou: demorou demais para conectar')), m.avisos.join(' | '));
  const h = dock(m);
  assert.match(pecaVoz(h), /class="vq-erro" data-dock="tentar"[^>]*>Tentar de novo/);
  assert.doesNotMatch(h, /data-dock="entrar"/);
  // Tentar de novo: aposenta a tentativa presa e começa outra (uma só entrando).
  m.c.escritorioTentarChamadaDeNovo(); await m.passar(0);
  const nova = m.e.entrandoChamada;
  assert.ok(nova && nova !== velha, 'nova tentativa com marca própria');
  assert.equal(m.estado().fase, 'conectando');
  m.tr.reunioes[0].soltar(); await m.passar(0);
  assert.equal(m.e.entrandoChamada, nova, 'a velha terminou e não apagou a marca da nova');
  assert.ok(m.tr.reunioes[0].saiu, 'a reunião velha foi deixada');
  m.tr.reunioes[1].soltar(); await m.passar(0);
  assert.equal(m.estado().fase, 'na-sala');
  assert.equal(m.e.entrandoChamada, false);
});

test('falha que se repete avisa uma vez; as novas tentativas sozinhas não repetem o aviso', async () => {
  const m = montar();
  m.c.escritorioTokenDaZona = () => { const p = Promise.reject(new Error('A conversa não abriu (servidor da conversa). Tente de novo.')); p.catch(() => {}); return p; };
  m.c.escritorioConversaAutomatica(); await m.passar(0);
  assert.equal(m.estado().fase, 'caiu');
  assert.equal(m.estado().motivo, 'parou em: servidor da conversa');
  // Dois minutos com a pintura do dock a cada 1,5 s: as tentativas sozinhas passam por "conectando" e voltam a cair.
  for (let i = 0; i < 80; i++) { await m.passar(1500); m.estado(); }
  assert.ok(m.e.tentativasVoz >= 4, 'tentou de novo sozinho');
  assert.equal(m.avisos.filter((a) => a.startsWith('A voz não conectou')).length, 1, m.avisos.join(' | '));
  assert.equal(m.avisos.filter((a) => a === 'Preparando conversa…').length, 1, 'o "Preparando" também não repete');
  assert.equal(m.c.escritorioNivelAudio.ligado, false, 'o medidor de volume não fica rodando sem chamada');
});

test('microfone negado: entra ouvindo e o botão diz Bloqueado com o caminho para liberar', async () => {
  const m = montar({ e: { microfoneQuer: true } }); m.tr.micNegado = true;
  m.c.escritorioConversaAutomatica(); await m.passar(0);
  const st = m.estado();
  assert.equal(st.fase, 'na-sala'); assert.equal(st.midia.mic, 'bloqueado');
  const h = dock(m);
  assert.match(h, /class="vq-item vq-mic vq-bloq" data-dock="mic-liberar" title="O navegador bloqueou o microfone\. Clique no cadeado\./);
  assert.match(h, /<span class="vq-rotulo">Bloqueado<\/span>/);
});

test('câmera negada vira "Bloqueada"; tela cancelada na escolha não é erro; tela parada pelo navegador avisa uma vez', async () => {
  const m = montar(); m.c.escritorioConversaAutomatica(); await m.passar(0);
  const self = m.e.chamada.self;
  m.tr.cameraNegada = true; await m.c.alternarMidiaEscritorio('video');
  assert.equal(m.estado().midia.camera, 'bloqueada');
  assert.match(dock(m), /class="vq-item vq-bloq" data-dock="camera"[^>]*>.*Bloqueada/);
  m.tr.cameraNegada = false; await m.c.alternarMidiaEscritorio('video');
  assert.equal(m.estado().midia.camera, 'ligada'); assert.equal(m.e.erroCamera, null);
  m.tr.telaCancelada = true; await m.c.alternarMidiaEscritorio('screen');
  assert.equal(m.avisos.at(-1), 'A tela não foi compartilhada.'); assert.equal(m.estado().midia.tela, 'parada');
  m.tr.telaCancelada = false; await m.c.alternarMidiaEscritorio('screen');
  assert.equal(m.estado().midia.tela, 'transmitindo');
  assert.deepEqual([...m.estado().midia.transmitindo], ['1']);
  assert.match(dock(m), /data-dock="tela"[^>]*aria-pressed="true"[^>]*>.*Mostrando/);
  // O "Parar de compartilhar" do navegador: o SDK manda screenShareUpdate com a tela desligada.
  const antes = m.avisos.length;
  self.screenShareEnabled = false; self.emit('screenShareUpdate');
  assert.equal(m.avisos.at(-1), 'A transmissão da sua tela parou.'); assert.equal(m.avisos.length, antes + 1);
  self.emit('screenShareUpdate'); assert.equal(m.avisos.length, antes + 1, 'não repete');
  // Parar pelo próprio botão não é "o navegador parou".
  await m.c.alternarMidiaEscritorio('screen'); await m.c.alternarMidiaEscritorio('screen');
  assert.equal(m.avisos.length, antes + 1);
});

test('som bloqueado pelo navegador: um par de ouvintes por chamada (antes somava a cada erro) e o botão "Ativar som"', async () => {
  const m = montar(); m.c.escritorioConversaAutomatica(); await m.passar(0);
  for (let i = 0; i < 5; i++) m.e.chamada.self.emit('autoplayError');
  assert.equal(m.docOuvintes.length, 2);
  assert.match(dock(m), /data-dock="liberar-som"[^>]*>.*Ativar som/);
  await m.docOuvintes[0][1]();
  assert.equal(m.docOuvintes.length, 0); assert.equal(m.e.somBloqueado, false);
});

test('escritório fora, conectando, caiu, oscilou, outra aba, sem internet e demo', () => {
  const fase = (extra, opc) => { const m = montar({ e: extra, ...opc }); return m.estado(); };
  assert.equal(fase({ conectado: false }).fase, 'fora');
  assert.equal(fase({ conectado: false, conectando: true }).fase, 'conectando');
  assert.deepEqual([fase({ conectado: false, erroConexao: 'o escritório não respondeu' }).fase, fase({ conectado: false, erroConexao: 'x' }).motivo], ['caiu', 'x']);
  assert.equal(fase({ socketCaiu: true }).fase, 'reconectando');
  assert.equal(fase({ conectado: false, emOutraAba: true }).fase, 'outra-aba');
  assert.equal(fase({ vozPausada: true }).fase, 'fora');
  assert.equal(fase({ zona: 'foco' }).fase, 'sem-voz');
  const sem = fase({}, { online: false }); assert.deepEqual([sem.fase, sem.motivo], ['reconectando', 'Sem internet']);
  assert.equal(fase({ base: { demo: true } }).fase, 'indisponivel');
  // Sem internet não estoura o prazo: volta sozinho quando a rede voltar.
  const m = montar({ online: false }); m.estado(); m.relogio.agora += 60000; assert.equal(m.estado().fase, 'reconectando');
  // Demo: o dock não oferece um Entrar que não faz nada.
  const d = montar({ e: { conectado: false, base: { demo: true } } });
  assert.doesNotMatch(dock(d), /data-dock="entrar"/);
  assert.match(pecaVoz(dock(d)), /disabled title="Sem servidor de voz nesta demonstração">Sem voz/);
  // Fora de verdade: aí sim, Entrar.
  assert.match(dock(montar({ e: { vozPausada: true } })), /data-dock="entrar"/);
});

test('celular fora das salas: o cartão mostra o estado (conectando, caiu) em vez de Entrar', async () => {
  const m = montar(); m.tr.joinPendente = true; m.c.escritorioConversaAutomatica(); await m.passar(0);
  let h = dock(m, { celular: true });
  assert.match(h, /class="vq-cartao"[^>]*data-fase="conectando"/);
  assert.match(h, /<b>Conectando à voz<\/b>/);
  assert.match(h, /class="vc-acao vq-espera" disabled aria-busy="true"/);
  assert.doesNotMatch(h, /data-dock="entrar"/);
  await m.passar(16000);
  h = dock(m, { celular: true });
  assert.match(h, /<b>A voz não conectou<\/b><small>demorou demais para conectar<\/small>/);
  assert.match(h, /class="vc-acao vq-erro" data-dock="tentar"/);
});

test('quem entra e sai da sua sala: um aviso só por leva, sem contar você nem as outras salas', async () => {
  const m = montar();
  const ana = { id: '2', nome: 'Ana Lima', zona: 'sala-a' }, bia = { id: '3', nome: 'Bia Souza', zona: 'sala-a' }, eu = { id: '1', nome: 'Paulo', zona: 'sala-a' }, rui = { id: '4', nome: 'Rui', zona: 'sala-b' };
  m.c.escritorioAvisoNaSala(m.c.escritorioMudancaNaSala([eu], [eu, ana, rui], { eu: '1', zona: 'sala-a' }));
  m.c.escritorioAvisoNaSala(m.c.escritorioMudancaNaSala([eu, ana], [eu, ana, bia], { eu: '1', zona: 'sala-a' }));
  await m.passar(1600);
  assert.deepEqual(m.avisos, ['Ana e Bia entraram na sala']);
  m.c.escritorioAvisoNaSala(m.c.escritorioMudancaNaSala([eu, ana, bia], [eu, bia], { eu: '1', zona: 'sala-a' }));
  m.c.escritorioAvisoNaSala(m.c.escritorioMudancaNaSala([eu, bia], [eu, bia, ana], { eu: '1', zona: 'sala-a' }));
  await m.passar(1600);
  assert.equal(m.avisos.length, 1, 'saiu e voltou na mesma leva: nada a avisar');
  assert.equal(m.c.escritorioTextoMudancaSala({ entraram: ['Ana', 'Bia', 'Caio', 'Duda'], sairam: ['Rui'] }), 'Ana, Bia e mais 2 entraram na sala · Rui saiu da sala');
});

test('conexão do escritório: sem "session:ready" em 15 s fecha e diz o motivo; queda depois de dentro vira "Reconectando…"', async () => {
  const m = montar({ e: { conectado: false, base: null } });
  const sockets = [];
  class WebSocketFalso { constructor(u) { this.url = String(u); this.fechado = false; sockets.push(this); } close() { this.fechado = true; } send() {} }
  Object.assign(m.c, { WebSocket: WebSocketFalso, URL, escritorioApi: async () => ({ worker: 'https://w.exemplo', token: 't' }), escritorioEtapaEntrada() {}, escritorioChegar() {},
    escritorioErroEntrada(t) { m.c.erroEntrada = t; }, escritorioReconectar(motivo) { m.c.reconectou = motivo; } });
  vm.runInContext(fonte(office, 'conectarEscritorio'), m.c);
  m.c.conectarEscritorio(); await m.passar(0);
  assert.equal(m.estado().fase, 'conectando');
  await m.passar(15001);
  assert.equal(sockets[0].fechado, true); assert.equal(m.e.conectando, false);
  assert.equal(m.estado().fase, 'caiu'); assert.equal(m.estado().motivo, 'o escritório não respondeu');
  // Dentro e o socket cai: a voz diz Reconectando (antes o dock seguia "Dentro" sem conexão).
  m.e.conectado = true; m.e.erroConexao = ''; m.e.conectando = false;
  m.c.conectarEscritorio({ reconexao: true }); await m.passar(0);
  m.e.chamada = { self: { audioEnabled: false } }; m.e.canalChamada = 'escritorio';
  sockets[1].onclose();
  assert.equal(m.e.socketCaiu, true); assert.equal(m.c.reconectou, true);
  assert.equal(m.estado().fase, 'reconectando');
  // A volta passou do prazo: Tentar de novo reabre o socket na hora (não a voz da sala).
  m.relogio.agora += 16000; assert.equal(m.estado().fase, 'caiu');
  m.c.escritorioTentarChamadaDeNovo(); await m.passar(0);
  assert.equal(sockets.length, 3); assert.equal(m.e.conectando, true);
});

test('Entrar, Tentar de novo e Usar aqui passam pela mesma porta, que não faz nada enquanto conecta', () => {
  const f = world.slice(world.indexOf('  function entrarPeloTopo()'), world.indexOf('  // Quadro D3-Topo'));
  assert.match(f, /\['conectando', 'reconectando', 'na-sala', 'indisponivel', 'sem-voz'\]\.includes\(st\.fase\)\) \{ pintarChamada\(\); return; \}/);
  assert.match(f, /st\.fase === 'caiu'\) \{ pintarChamada\.tentou = true; fn\('escritorioTentarChamadaDeNovo'\)/);
  assert.ok(world.includes("if (a === 'entrar' || a === 'tentar' || a === 'assumir') { entrarPeloTopo(); return; }"));
});

// Paulo, 16/11/2026: "tá caindo toda hora a chamada, desativando o microfone, quando tá streamando a tela". O motor avisa
// roomLeft "disconnected" numa oscilação e volta sozinho (roomJoined reconnected), com microfone e tela.
async function naSalaMostrandoTela() {
  const m = montar({ e: { microfoneQuer: true } });
  m.c.escritorioConversaAutomatica(); await m.passar(0);
  const r = m.tr.reunioes[0];
  assert.equal(m.e.chamada, r);
  await m.c.alternarMidiaEscritorio('screen'); await m.passar(0);
  assert.equal(r.self.screenShareEnabled, true);
  assert.equal(r.self.audioEnabled, true);
  return { m, r };
}
test('oscilação curta da rede: a mesma reunião segue, com microfone e tela, sem abrir outra', async () => {
  const { m, r } = await naSalaMostrandoTela();
  r.self.emit('roomLeft', { state: 'disconnected' });
  assert.equal(m.e.chamada, r, 'não larga a reunião');
  assert.equal(m.estado().fase, 'reconectando');
  assert.ok(!m.avisos.includes('A conversa caiu. Reconectando…'), m.avisos.join(' | '));
  await m.passar(3000);
  r.self.emit('roomJoined', { reconnected: true });
  assert.equal(m.estado().fase, 'na-sala');
  assert.equal(m.tr.reunioes.length, 1, 'nenhuma reunião nova');
  assert.equal(r.saiu, false);
  assert.equal(r.self.screenShareEnabled, true, 'a tela continua');
  assert.equal(r.self.audioEnabled, true, 'o microfone continua');
  await m.passar(20000);
  assert.equal(m.tr.reunioes.length, 1, 'o prazo da oscilação não dispara depois da volta');
});
test('oscilação que não volta em 12 s: larga a reunião velha (solta microfone e tela) e entra de novo', async () => {
  const { m, r } = await naSalaMostrandoTela();
  r.self.emit('roomLeft', { state: 'disconnected' });
  await m.passar(11000);
  assert.equal(m.e.chamada, r);
  await m.passar(1500);
  assert.equal(r.saiu, true, 'a reunião velha saiu (leave)');
  assert.equal(r.self.screenShareEnabled, false, 'a tela da reunião velha foi solta');
  assert.equal(r.self.audioEnabled, false, 'o microfone da reunião velha foi solto');
  await m.passar(2000);
  assert.equal(m.e.chamada, m.tr.reunioes[1]);
  assert.equal(m.estado().fase, 'na-sala');
  assert.equal(m.e.chamada.self.audioEnabled, true, 'volta com o microfone ligado');
});
test('queda de verdade (failed): larga a reunião velha na hora e entra de novo', async () => {
  const { m, r } = await naSalaMostrandoTela();
  r.self.emit('roomLeft', { state: 'failed' });
  assert.equal(m.e.chamada, null);
  assert.equal(m.estado().fase, 'reconectando');
  await m.passar(0);
  assert.equal(r.saiu, true);
  assert.equal(r.self.screenShareEnabled, false);
  await m.passar(1500);
  assert.equal(m.e.chamada, m.tr.reunioes[1]);
});
