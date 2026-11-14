// shared/status-finalizado.js — "pronta" é só Finalizado (Paulo, 13/11/2026: "pronta = só Finalizado em tudo").
//
// O predicado único do servidor. vybe_status.final NÃO serve: o espelho do Monday marca final=true também em
// "Para agendar" e "Agendado" (vybe_dominio_store.js), que ainda esperam a postagem. Conta como pronta a peça cujo status
// é Finalizado, Feito ou Concluído (com ou sem acento, no masculino, feminino ou plural) — a mesma lista de
// vybe-dono-metricas.js (VybeDono.util.finalizado), que a tela usa.
//
// No SQL: lower(trim(COALESCE(s.rotulo, c.status_chave, ''))) = ANY(${STATUS_FINALIZADO_SQL}::text[])
// (a lista já vem em minúsculas, com e sem acento, e com as chaves do banco).
// No Node, module.exports; no navegador, window.VybeStatusFinalizado.
(function (raiz) {
  const CHAVES = Object.freeze(['finalizado', 'finalizada', 'feito', 'concluido', 'concluida', 'concluidos', 'concluidas']);
  const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const chave = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const CONJUNTO = new Set(CHAVES);
  function statusFinalizado(rotuloOuChave) { return CONJUNTO.has(chave(rotuloOuChave)); }
  // Para o ANY do SQL: as chaves e as formas com acento, tudo em minúsculas.
  const STATUS_FINALIZADO_SQL = Object.freeze([...CHAVES, 'concluído', 'concluída', 'concluídos', 'concluídas']);
  const api = Object.freeze({ CHAVES, STATUS_FINALIZADO_SQL, statusFinalizado, chave });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybeStatusFinalizado = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
