// Objetivo de cada peça (módulo Conteúdo, 07/11/2026): Atração, Educação ou Conversão — a "bolinha"
// do AgencyFlow. Mora na coluna vybe_conteudos.objetivo (migrations/2026-11-07-conteudo-objetivo-aprovacao.sql).
// Sem a migração, nada quebra: a leitura devolve pronto:false com o aviso e a escrita recusa com 503.
// As contas do equilíbrio do mês são do navegador (vybe-conteudo-equilibrio.js): aqui só se lê e grava.
const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
export const OBJETIVOS = Object.freeze(['atracao', 'educacao', 'conversao']);
export const ROTULO_OBJETIVO = Object.freeze({ atracao: 'Atração', educacao: 'Educação', conversao: 'Conversão' });
export const AVISO_MIGRACAO = 'O objetivo das peças e os links de aprovação aguardam a migração 2026-11-07-conteudo-objetivo-aprovacao.sql (aplicação manual do Paulo).';

export async function objetivoPronto(sql) {
  const [r] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'vybe_conteudos' AND column_name = 'objetivo') AS existe`;
  return Boolean(r?.existe);
}
export async function respostasProntas(sql) {
  const [r] = await sql`SELECT to_regclass('vybe_aprovacao_respostas') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}

const referenciaLocal = (item) => { const t = String(item || ''); return /^vybe:\d{1,18}$/.test(t) ? Number(t.slice(5)) : null; };

// Grava (ou limpa, com objetivo vazio) o objetivo de uma peça e deixa o rastro em vybe_conteudo_eventos.
export async function trocarObjetivo(sql, quem, { item, objetivo }) {
  const alvo = objetivo === null || objetivo === undefined || objetivo === '' ? null : String(objetivo);
  if (alvo !== null && !OBJETIVOS.includes(alvo)) throw erro('Objetivo inválido. Use atração, educação ou conversão.');
  if (!String(item || '').trim()) throw erro('Informe a peça.');
  if (!await objetivoPronto(sql)) throw erro(AVISO_MIGRACAO, 503);
  const [c] = await sql`SELECT id, titulo, objetivo FROM vybe_conteudos
    WHERE (monday_item_id::text = ${String(item)} OR id = ${referenciaLocal(item)}) AND removido_em IS NULL LIMIT 1`;
  if (!c) throw erro('Peça não encontrada.', 404);
  if ((c.objetivo || null) === alvo) return { conteudo_id: String(c.id), titulo: c.titulo, objetivo: alvo, mudou: false };
  const autor = /^\d{1,18}$/.test(String(quem?.pessoa?.id || '')) ? Number(quem.pessoa.id) : null;
  await sql.transaction([
    sql`UPDATE vybe_conteudos SET objetivo = ${alvo}, atualizado_em = NOW() WHERE id = ${c.id}`,
    sql`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, autor_id, texto)
      VALUES (${c.id}, 'objetivo', ${ROTULO_OBJETIVO[c.objetivo] || null}, ${ROTULO_OBJETIVO[alvo] || null}, ${autor}, ${null})`,
  ]);
  return { conteudo_id: String(c.id), titulo: c.titulo, objetivo: alvo, mudou: true };
}

// Mapa id da peça (o mesmo do painel: id externo ou "vybe:<id>") → objetivo, e a última resposta do
// cliente pelo link (para o calendário marcar "aprovado pelo cliente" / "alteração do cliente").
export async function listarObjetivos(sql) {
  const pronto = await objetivoPronto(sql);
  const objetivos = {};
  if (pronto) {
    const linhas = await sql`SELECT COALESCE(monday_item_id::text, 'vybe:' || id::text) AS id, objetivo
      FROM vybe_conteudos WHERE objetivo IS NOT NULL AND removido_em IS NULL`;
    for (const l of linhas) objetivos[l.id] = l.objetivo;
  }
  const respostas = {};
  if (await respostasProntas(sql)) {
    const linhas = await sql`SELECT DISTINCT ON (r.conteudo_id) COALESCE(c.monday_item_id::text, 'vybe:' || c.id::text) AS id,
        r.acao, r.nome, r.em
      FROM vybe_aprovacao_respostas r JOIN vybe_conteudos c ON c.id = r.conteudo_id
      WHERE r.em > NOW() - INTERVAL '120 days'
      ORDER BY r.conteudo_id, r.em DESC`;
    for (const l of linhas) respostas[l.id] = { acao: l.acao, nome: l.nome, em: l.em };
  }
  return { pronto, ...(pronto ? {} : { aviso: AVISO_MIGRACAO }), objetivos, respostas };
}
