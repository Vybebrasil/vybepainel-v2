// shared/prazo-interno.js — o Prazo de Ouro (prazo interno da peça), uma regra só para o servidor, o bot e as telas.
//
// A regra oficial é a do cadastro do planejamento (server/planejamentos.js, Paulo, 20/10/2026):
//  - 7 dias antes da veiculação; sábado e domingo voltam para a sexta;
//  - se esse dia já passou, hoje;
//  - mas nunca depois de 2 dias antes da veiculação (margem mínima): a menos de 2 dias, fica 2 dias antes (sexta, se cair
//    no fim de semana), e a peça já nasce atrasada de verdade.
// Datas em AAAA-MM-DD, somadas em UTC ao meio-dia (não andam com o fuso). No Node, module.exports; no navegador,
// window.VybePrazoInterno (cadastros_governed_v2.js e vybe-sazonal.js passam a usar depois).
(function (raiz) {
  const PRAZO_OURO_DIAS = 7, MARGEM_MINIMA_DIAS = 2;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const somarDias = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const diaUtil = (iso) => { let x = iso; while ([0, 6].includes(new Date(`${x}T12:00:00Z`).getUTCDay())) x = somarDias(x, -1); return x; };
  function prazoInterno(veiculacao, hoje) {
    const v = String(veiculacao || '').slice(0, 10), h = String(hoje || '').slice(0, 10);
    if (!ISO.test(v) || !ISO.test(h)) return '';
    const ouro = diaUtil(somarDias(v, -PRAZO_OURO_DIAS));
    if (ouro >= h) return ouro;
    const limite = diaUtil(somarDias(v, -MARGEM_MINIMA_DIAS));
    return h <= limite ? h : limite;
  }
  const api = Object.freeze({ PRAZO_OURO_DIAS, MARGEM_MINIMA_DIAS, prazoInterno, somarDias, diaUtil });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybePrazoInterno = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
