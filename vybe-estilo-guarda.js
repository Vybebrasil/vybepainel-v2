// Guarda das folhas de estilo (Paulo, 14/11/2026: no app do Mac, às vezes o Painel abria sem fundo, sem título e com
// o bloco laranja transparente, ou seja, com a folha do padrão novo fora). Se uma folha não chegou ou chegou vazia,
// ela é pedida de novo uma vez, com um marcador na URL para não vir do cache quebrado. A prova de que o padrão novo
// está valendo é o token --d3-acao no :root (padrao-v2/0-d3-base.css).
(function () {
  if (typeof document === 'undefined') return;
  const tentadas = new Set();
  const folhaVazia = (link) => { try { return !link.sheet || link.sheet.cssRules.length === 0; } catch { return false; } };
  function repedir(link) {
    const base = link.href.split('#')[0];
    if (tentadas.has(base)) return false;
    tentadas.add(base);
    const novo = link.cloneNode();
    novo.href = base + (base.includes('?') ? '&' : '?') + 'r=' + Date.now();
    novo.addEventListener('load', () => link.remove(), { once: true });
    link.after(novo);
    console.warn('[estilo] folha pedida de novo:', base);
    return true;
  }
  function conferir() {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].filter((l) => !/fonts\.googleapis/.test(l.href));
    for (const l of links) if (folhaVazia(l)) repedir(l);
    const temPadrao = getComputedStyle(document.documentElement).getPropertyValue('--d3-acao').trim();
    if (!temPadrao) { const p = links.find((l) => /padrao-v2/.test(l.href)); if (p) repedir(p); }
  }
  const depois = () => setTimeout(conferir, 1500);
  if (document.readyState === 'complete') depois(); else window.addEventListener('load', depois, { once: true });
  // O app do Mac volta do fundo sem recarregar: confere de novo quando a janela reaparece.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferir(); });
  if (typeof globalThis !== 'undefined') globalThis.vbConferirEstilos = conferir;
})();
