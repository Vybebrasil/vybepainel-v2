// Regras de cada cliente (Paulo, 27/10/2026: "deixar o JARVIS mais foda"): o que foi decidido e vale para as próximas
// peças ("a Gonzalez não gosta de fundo escuro", "sexta é sempre a Greyce"). Guardadas pelo WhatsApp, sempre com SIM;
// entram na memória do cliente, nas legendas que a Vybe IA escreve e na revisão das artes. Texto é dado, não instrução.
export async function tabelaRegras(sql) {
  await sql`CREATE TABLE IF NOT EXISTS vybe_ai_regras_cliente(id bigserial PRIMARY KEY, cliente_id bigint NOT NULL, texto text NOT NULL,
    autor_id bigint, criado_em timestamptz NOT NULL DEFAULT now(), removida_em timestamptz)`;
}
async function existe(sql) {
  const [t] = await sql`SELECT to_regclass('public.vybe_ai_regras_cliente') IS NOT NULL AS ok`;
  return Boolean(t?.ok);
}
export async function regrasDoCliente(sql, clienteId) {
  try {
    if (!(await existe(sql))) return [];
    return (await sql`SELECT texto FROM vybe_ai_regras_cliente WHERE cliente_id = ${Number(clienteId)} AND removida_em IS NULL
      ORDER BY criado_em DESC LIMIT 15`).map((r) => r.texto);
  } catch { return []; }
}
export async function regrasDaPeca(sql, conteudoId) {
  try {
    if (!(await existe(sql))) return [];
    return (await sql`SELECT r.texto FROM vybe_ai_regras_cliente r JOIN vybe_conteudo_clientes cc ON cc.cliente_id = r.cliente_id
      WHERE cc.conteudo_id = ${Number(conteudoId)} AND r.removida_em IS NULL ORDER BY r.criado_em DESC LIMIT 15`).map((r) => r.texto);
  } catch { return []; }
}
