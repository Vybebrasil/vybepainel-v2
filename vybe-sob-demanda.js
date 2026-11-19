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
  // Comercial e Pessoas entram pelo objeto da janela (SOB_DEMANDA_JANELAS), não por função solta.
  comercial: [],
  pessoas: [],
};
// Janelas de módulo que só carregam quando abrem (confere 19/11/2026: o Comercial e o Pessoas eram 470 KB que a
// abertura executava e só 9 a 10% rodava). O resto do painel conhece estas janelas por window.<Nome> (o dock testa
// abrir, o Hoje chama abrir/novoPedido, a visão do setor chama carga): até a primeira chamada, window.<Nome> é este
// substituto, com os mesmos métodos. Os de "portas" baixam o grupo e repassam a chamada ao objeto de verdade, que
// toma o lugar do substituto; os de "quietos" respondem como a janela fechada responderia (aberto() = false).
// "cliques": o grupo também abre por um [data-modulo] da planta (sala do Prédio), como o arquivo dele trata na captura.
const SOB_DEMANDA_JANELAS = {
  comercial: { nome: 'VybeComercial', portas: ['abrir'], quietos: { fechar: undefined, aberto: false }, cliques: 'comercial', abaPadrao: 'funil' },
  pessoas: { nome: 'VybePessoas', portas: ['abrir', 'carga', 'novoPedido'], quietos: { fechar: undefined, aberto: false } },
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

for (const [grupo, j] of Object.entries(SOB_DEMANDA_JANELAS)) {
  const substituto = { sobDemanda: grupo };
  for (const metodo of j.portas) {
    substituto[metodo] = function (...args) {
      return carregarSobDemanda(grupo).then(() => {
        const real = window[j.nome];
        if (!real || real === substituto || typeof real[metodo] !== 'function') throw new Error(`${j.nome}.${metodo} não veio com o grupo ${grupo}.`);
        return real[metodo](...args);
      });
    };
  }
  for (const [metodo, valor] of Object.entries(j.quietos || {})) substituto[metodo] = () => valor;
  window[j.nome] = substituto;
  // A sala da planta que abre a janela ({ tipo: 'janela', alvo }) é tratada pelo próprio arquivo, na captura, antes do
  // HUD (que a trataria como quadro). Até o arquivo chegar, quem trata é o substituto, do mesmo jeito.
  if (j.cliques) document.addEventListener?.('click', (e) => {
    if (window[j.nome] !== substituto) return;
    const b = e.target.closest?.('[data-modulo]'); if (!b) return;
    let m; try { m = JSON.parse(b.dataset.modulo); } catch { return; }
    if (m?.tipo !== 'janela' || m.alvo !== j.cliques) return;
    e.preventDefault(); e.stopPropagation(); substituto.abrir(m.aba || j.abaPadrao).catch(() => {});
  }, true);
}
