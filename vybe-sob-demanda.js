// vybe-sob-demanda.js — partes do painel que só carregam quando alguém usa.
//
// O painel abria executando 72 arquivos (2,6 MB de JavaScript) antes da
// primeira tela, e o time sentia o peso nos notebooks (Paulo, 03/11/2026).
// Os jogos de mesa do Escritório, os relatórios, as automações e o calendário
// sazonal continuam listados no index.html, na ordem de sempre, mas como
// <script type="vybe/sob-demanda" data-grupo="…">: o navegador não baixa nem
// executa esse tipo. O build dá a eles o mesmo endereço com hash dos outros.
//
// Cada grupo tem as suas portas (SOB_DEMANDA_PORTAS): as funções por onde o
// resto do painel entra nele. Elas existem desde o início; a primeira chamada
// baixa o grupo inteiro, na ordem do index.html, e repassa a chamada à função
// de verdade, que ocupa o lugar da porta. Quem chama recebe uma Promise, então
// só vira porta função cujo retorno ninguém usa na hora (abrir uma tela,
// desenhar um quadro, receber um sinal). O teste tests/sob-demanda.test.mjs
// cobra que o resto do painel só entra nos grupos pelas portas.
const SOB_DEMANDA_PORTAS = {
  jogos: [
    'abrirXadrezEscritorio', 'abrirMesaDeJogosEscritorio', 'abrirPokerEscritorio', 'abrirSinucaEscritorio',
    'xadrezSinalEscritorio', 'dominoSinalEscritorio', 'pokerSinalEscritorio', 'sinucaSinalEscritorio',
    'mesaSinalPorChave', 'avisarConviteDeJogo',
  ],
  relatorios: [
    'renderDiarioLista', 'renderPerformance', 'setDiarioDateMode', 'voltarDiarioLista',
    'salvarSnapshot', 'exportarSnapshot', 'setPerfPeriod',
  ],
  automacoes: ['carregarAutomacoes', 'diagnosticarAutomacao'],
  sazonal: ['abrirCalendarioSazonal'],
};
const SOB_DEMANDA_CARGAS = {};
const SOB_DEMANDA_PRONTOS = new Set();

function carregarSobDemanda(grupo) {
  if (SOB_DEMANDA_CARGAS[grupo]) return SOB_DEMANDA_CARGAS[grupo];
  const fontes = [...document.querySelectorAll(`script[type="vybe/sob-demanda"][data-grupo="${grupo}"]`)]
    .map((s) => s.getAttribute('src'));
  if (!fontes.length) return Promise.reject(new Error(`O grupo ${grupo} não está no index.html.`));
  // Só o que ainda não rodou: um arquivo executado duas vezes quebraria nas
  // declarações (const repetido). async = false mantém a ordem do index.html.
  const carga = Promise.all(fontes.filter((src) => !SOB_DEMANDA_PRONTOS.has(src)).map((src) => new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => { SOB_DEMANDA_PRONTOS.add(src); ok(); };
    s.onerror = () => { s.remove(); falha(new Error(`Não foi possível carregar ${src}.`)); };
    document.body.append(s);
  })));
  SOB_DEMANDA_CARGAS[grupo] = carga.catch((erro) => {
    delete SOB_DEMANDA_CARGAS[grupo];
    if (typeof showToast === 'function') showToast('Não foi possível abrir esta parte do painel. Confira a conexão e tente de novo.', 'error', 6000);
    throw erro;
  });
  return SOB_DEMANDA_CARGAS[grupo];
}

for (const [grupo, nomes] of Object.entries(SOB_DEMANDA_PORTAS)) {
  for (const nome of nomes) {
    const porta = function (...args) {
      return carregarSobDemanda(grupo).then(() => {
        if (window[nome] === porta) throw new Error(`${nome} não veio com o grupo ${grupo}.`);
        return window[nome].apply(this, args);
      });
    };
    window[nome] = porta;
  }
}
