// "Pronta" no servidor = só o que terminou de verdade (Paulo, 13/11/2026: "PRONTA = SÓ FINALIZADO").
//
// O catálogo vybe_status.final veio do Monday, que marca "Para agendar" e "Agendado" como concluídos
// (vybe_dominio_store.js, etiquetasConcluidas). O dado fica como está; quem decide aqui é este critério,
// o mesmo da tela (vybe-dono-metricas.js, AGUARDA_POSTAR):
//   pronta          = status final E não é Para agendar/Agendado (Finalizado, Publicado, Postado, Feito, Concluído…)
//   aguarda postar  = Para agendar ou Agendado: ainda não saiu, mas a produção terminou. Não é cobrança antes da
//                     veiculação; passou a veiculação e não saiu, conta como atrasada (não entregue).
//   aberta          = nem pronta nem aguardando postar (a produção ainda está com alguém).
//
// Nas consultas: as tags de SQL (Neon/PGlite) só aceitam parâmetros, então o critério entra como a lista
// AGUARDA_POSTAR em parâmetro (`<> ALL(${AGUARDA_POSTAR}::text[])`); em sql.query, os trechos prontaSql/aguardaSql.

export const AGUARDA_POSTAR = Object.freeze(['para_agendar', 'agendado']);

// A mesma chave de vybe_status.chave (chaveStatus em vybe_dominio_store.js): "Para agendar" → "para_agendar".
export function chaveDoStatus(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Aceita a chave (para_agendar) ou o rótulo (Para agendar / para agendar).
export function aguardaPostar(status) {
  return AGUARDA_POSTAR.includes(chaveDoStatus(status));
}

// final = vybe_status.final da etiqueta (o que o Monday chama de concluído).
export function ehPronta(status, final) {
  return Boolean(final) && !aguardaPostar(status);
}

// Para agendar/Agendado cuja veiculação já passou (antes de hoje) e não saiu: é atraso.
// Sem veiculação não há data para cobrar. Datas em AAAA-MM-DD.
export function aguardaPostarVencida(status, veiculacao, hoje) {
  const v = String(veiculacao || '').slice(0, 10);
  return aguardaPostar(status) && /^\d{4}-\d{2}-\d{2}$/.test(v) && v < String(hoje).slice(0, 10);
}

// Trechos para sql.query (c = apelido de vybe_conteudos, s = de vybe_status).
const LISTA_SQL = AGUARDA_POSTAR.map((k) => `'${k}'`).join(', ');
export const aguardaSql = (c = 'c') => `(COALESCE(${c}.status_chave, '') IN (${LISTA_SQL}))`;
export const prontaSql = (c = 'c', s = 's') => `(COALESCE(${s}.final, false) AND NOT ${aguardaSql(c)})`;
