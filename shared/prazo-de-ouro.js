// shared/prazo-de-ouro.js — o Prazo de Ouro de uma peça, igual no servidor e na tela (Paulo, 13/11/2026).
//
// Função pura: não lê DOM, rede nem banco. O servidor (server/planejamentos.js, server/captacoes.js) e o cadastro
// rápido (cadastros_governed_v2.js) usam a mesma. No navegador fica em window.VybePrazoDeOuro.
//
// Regra (era só do servidor; a tela fazia veiculação − 7 puro e as duas datas não batiam):
//   1. 7 dias antes da veiculação (PRAZO_OURO_DIAS); sábado e domingo voltam para a sexta.
//   2. Se esse dia já passou, o prazo é hoje…
//   3. …mas nunca depois de 2 dias antes da veiculação (MARGEM_MINIMA_DIAS, também voltando para a sexta). Peça
//      cadastrada a menos de 2 dias da veiculação nasce com esse limite, mesmo no passado: está atrasada de verdade.
// Datas em AAAA-MM-DD. Sem `hoje` válido, vale só a regra 1.
(function (raiz) {
  'use strict';
  const PRAZO_OURO_DIAS = 7;
  const MARGEM_MINIMA_DIAS = 2;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const somarDias = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  // Sábado e domingo voltam para a sexta.
  const diaUtil = (iso) => { let x = iso; while ([0, 6].includes(new Date(`${x}T12:00:00Z`).getUTCDay())) x = somarDias(x, -1); return x; };

  function prazoDaPeca(veiculacao, hoje) {
    const v = String(veiculacao || '').slice(0, 10);
    if (!ISO.test(v)) return '';
    const ouro = diaUtil(somarDias(v, -PRAZO_OURO_DIAS));
    const h = String(hoje || '').slice(0, 10);
    if (!ISO.test(h) || ouro >= h) return ouro;
    const limite = diaUtil(somarDias(v, -MARGEM_MINIMA_DIAS));
    return h <= limite ? h : limite;
  }

  const api = Object.freeze({ PRAZO_OURO_DIAS, MARGEM_MINIMA_DIAS, somarDias, diaUtil, prazoDaPeca });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybePrazoDeOuro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
