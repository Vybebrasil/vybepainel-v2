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

// Banco de ideias por cliente (Paulo, 27/10/2026): "!vybe ideia para a Gonzalez: bastidores do forno a lenha" guarda; a
// pauta do mês usa as mais recentes (últimos 90 dias). Qualquer pessoa vinculada pode guardar.
export async function guardarIdeia(sql, pessoaId, { cliente, texto }) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 500) throw Object.assign(new Error('Diga a ideia (até 500 caracteres).'), { status: 400, publica: true });
  const nome = String(cliente || '').trim();
  const achados = nome.length >= 2 ? await sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE COALESCE(ativo, true) AND nome ILIKE ${'%' + nome + '%'} ORDER BY nome LIMIT 5` : [];
  const normal = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const c = achados.length === 1 ? achados[0] : achados.find((x) => normal(x.nome) === normal(nome));
  if (!c) throw Object.assign(new Error(achados.length ? `Mais de um cliente com "${nome}": ${achados.map((x) => x.nome).join(', ')}.` : `Não achei o cliente "${nome.slice(0, 60)}".`), { status: 400, publica: true });
  await sql`CREATE TABLE IF NOT EXISTS vybe_ai_ideias(id bigserial PRIMARY KEY, cliente_id bigint NOT NULL, texto text NOT NULL, autor_id bigint, criado_em timestamptz NOT NULL DEFAULT now())`;
  await sql`INSERT INTO vybe_ai_ideias(cliente_id, texto, autor_id) VALUES (${Number(c.id)}, ${t}, ${Number(pessoaId) || null})`;
  return { texto: `💡 Ideia guardada para *${c.nome}*: “${t}”. Entra na próxima pauta do cliente.` };
}
export async function ideiasDoCliente(sql, clienteId) {
  try {
    const [t] = await sql`SELECT to_regclass('public.vybe_ai_ideias') IS NOT NULL AS ok`;
    if (!t?.ok) return [];
    return (await sql`SELECT texto FROM vybe_ai_ideias WHERE cliente_id = ${Number(clienteId)} AND criado_em >= now() - interval '90 days' ORDER BY criado_em DESC LIMIT 12`).map((r) => r.texto);
  } catch { return []; }
}
