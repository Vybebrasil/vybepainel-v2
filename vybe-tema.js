// vybe-tema.js — os três temas do Vybe OS (Paulo, 16/11/2026): o Fumê (padrão V2: vidro fumê sobre luz quente), o Claro
// e o Escuro. As peças e a estrutura são as mesmas nos três; só mudam os valores dos tokens --d3-* (padrao-v2/0-d3-base.css),
// aplicados por html[data-d3-tema="fume|claro|escuro"]. "Auto" segue o sistema operacional, entre o claro e o escuro.
//
// A escolha fica onde a aparência já ficava: localStorage "irecity.tema" (a chave não começa com "vybe" para o Sair não
// apagar). Quem nunca escolheu fica no Fumê; quem já tinha escolhido claro, escuro ou auto continua com a escolha.
// O escuro de antes invertia a tela inteira (html.tema-escuro, filter:invert); agora é um tema de verdade, pelos tokens, e
// a classe não é mais ligada.
//
// window.VybeTema: TEMAS (nome e frase de cada um), OPCOES, escolhido(), efetivo(), jaEscolheu(), aplicar(), trocar().
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const doc = G.document;
  const CHAVE = 'irecity.tema';
  // Marca de que a pessoa já passou pela tela de escolha (as boas-vindas do VYBES): não volta a cada entrada.
  const CHAVE_ESCOLHEU = 'irecity.tema.escolheu';
  const TEMAS = [
    { id: 'fume', nome: 'Fumê', resumo: 'Vidro fumê sobre luz quente. É o padrão do Vybe OS.' },
    { id: 'claro', nome: 'Claro', resumo: 'Tudo claro e leve, bom para sala bem iluminada.' },
    { id: 'escuro', nome: 'Escuro', resumo: 'Fundo escuro que descansa a vista, bom para a noite.' },
  ];
  const OPCOES = ['fume', 'claro', 'escuro', 'auto'];
  const ROTULOS = { fume: 'Fumê', claro: 'Claro', escuro: 'Escuro', auto: 'Auto' };

  function guardado() { try { return G.localStorage?.getItem(CHAVE) || ''; } catch { return ''; } }
  // O que a pessoa escolheu (fume, claro, escuro ou auto). Sem escolha, ou com valor estranho, o Fumê.
  function escolhido() { const v = guardado(); return OPCOES.includes(v) ? v : 'fume'; }
  function sistemaEscuro() { try { return Boolean(G.matchMedia?.('(prefers-color-scheme: dark)')?.matches); } catch { return false; } }
  // O tema que vai para a tela: "auto" vira claro ou escuro, pelo sistema.
  function efetivo(t = escolhido()) { return t === 'auto' ? (sistemaEscuro() ? 'escuro' : 'claro') : (OPCOES.includes(t) ? t : 'fume'); }
  function jaEscolheu() { try { return G.localStorage?.getItem(CHAVE_ESCOLHEU) === '1'; } catch { return false; } }
  function marcarEscolheu() { try { G.localStorage?.setItem(CHAVE_ESCOLHEU, '1'); } catch { /* sem armazenamento: vale só nesta abertura */ } }

  function aplicar(t = escolhido()) {
    const raiz = doc?.documentElement; if (!raiz) return efetivo(t);
    const ef = efetivo(t);
    if (raiz.getAttribute?.('data-d3-tema') !== ef) raiz.setAttribute?.('data-d3-tema', ef);
    raiz.classList?.remove?.('tema-escuro');
    if (raiz.style) raiz.style.colorScheme = ef === 'escuro' ? 'dark' : 'light';
    return ef;
  }
  function quieto() {
    if (doc?.body?.dataset?.motion === 'reduce') return true;
    try { return Boolean(G.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
  }
  // Troca e guarda. A tela passa de um tema ao outro num esmaecer curto (a foto do tema de antes some por cima do novo);
  // sem a API de transição, ou com "reduzir movimento", troca na hora.
  function trocar(t, { suave = true } = {}) {
    const novo = OPCOES.includes(t) ? t : 'fume';
    try { G.localStorage?.setItem(CHAVE, novo); } catch { /* sem armazenamento: vale só nesta abertura */ }
    const pintar = () => { aplicar(novo); avisar(novo); };
    const muda = efetivo(novo) !== doc?.documentElement?.getAttribute?.('data-d3-tema');
    if (suave && muda && !quieto() && typeof doc?.startViewTransition === 'function') {
      const raiz = doc.documentElement;
      raiz.classList?.add?.('d3-tema-trocando');
      try {
        const vt = doc.startViewTransition(pintar);
        Promise.resolve(vt?.finished).catch(() => {}).then(() => raiz.classList?.remove?.('d3-tema-trocando'));
      } catch { raiz.classList?.remove?.('d3-tema-trocando'); pintar(); }
    } else pintar();
    return novo;
  }
  // Quem mostra a escolha (menu Conta, Minha conta, boas-vindas) acerta o marcado ao ouvir "vybe:tema".
  function avisar(t) {
    try { doc?.dispatchEvent?.(new G.CustomEvent('vybe:tema', { detail: { escolhido: t, efetivo: efetivo(t) } })); } catch { /* sem eventos: cada tela acerta a própria */ }
  }

  aplicar();
  try { G.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => { if (escolhido() === 'auto') { aplicar(); avisar('auto'); } }); } catch { /* navegador sem aviso de troca do sistema */ }

  G.VybeTema = { CHAVE, CHAVE_ESCOLHEU, TEMAS, OPCOES, ROTULOS, escolhido, efetivo, jaEscolheu, marcarEscolheu, aplicar, trocar };
})();
