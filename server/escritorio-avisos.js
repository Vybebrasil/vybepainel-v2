// Recado global do Escritório (decisão do Paulo, 21/10/2026): quem está em
// vybe_escritorio_avisos_autores manda um recado que aparece no meio da tela de
// toda a equipe, com "Conferir" (leva ao destino) e "Ignorar". Cada pessoa vê
// cada recado uma vez. Tabelas em migrations/2026-10-22-escritorio-avisos.sql.
const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
export const DESTINOS_AVISO = ["", "reforma", "loja", "ranking", "conquistas", "missoes", "provador"];
export const ESTILOS_AVISO = ["padrao", "obra", "festa"];
const pronto = async (sql) => (await sql`SELECT to_regclass('vybe_escritorio_avisos') IS NOT NULL AS ok`)[0]?.ok === true;

export async function podeMandarAviso(sql, pessoaId) {
  if (!(await pronto(sql))) return false;
  const [r] = await sql`SELECT 1 AS ok FROM vybe_escritorio_avisos_autores WHERE pessoa_id = ${Number(pessoaId)}`;
  return Boolean(r);
}

// Os recados ainda valendo que a pessoa não conferiu nem ignorou. Quem manda
// também recebe o dele (Paulo, 21/10/2026: "até pra eu ver como tá").
export async function avisosDaPessoa(sql, pessoaId) {
  if (!(await pronto(sql))) return { avisos: [], pode: false };
  const id = Number(pessoaId);
  const avisos = await sql`SELECT a.id::text AS id, a.titulo, a.texto, a.destino, a.estilo, a.criado_em, p.id::text AS autor_id, p.nome AS autor_nome
    FROM vybe_escritorio_avisos a JOIN vybe_pessoas p ON p.id = a.autor_id
    WHERE a.expira_em > NOW()
      AND NOT EXISTS (SELECT 1 FROM vybe_escritorio_avisos_vistos v WHERE v.aviso_id = a.id AND v.pessoa_id = ${id})
    ORDER BY a.criado_em DESC LIMIT 3`;
  return { avisos: avisos.map((a) => ({ id: a.id, titulo: a.titulo, texto: a.texto, destino: a.destino, estilo: a.estilo, criado_em: a.criado_em, autor: { id: a.autor_id, nome: a.autor_nome } })), pode: await podeMandarAviso(sql, id) };
}

export async function mandarAviso(sql, pessoa, corpo = {}) {
  if (!(await pronto(sql))) throw erro("O recado global ainda não foi instalado no banco.", 503);
  if (!(await podeMandarAviso(sql, pessoa.id))) throw erro("Só quem foi liberado pode mandar recado para todos.", 403);
  const titulo = String(corpo.titulo || "").replace(/\s+/g, " ").trim(), texto = String(corpo.texto || "").replace(/[ \t]+/g, " ").trim();
  const destino = String(corpo.destino ?? ""), estilo = String(corpo.estilo || "padrao"), chave = String(corpo.chave || "");
  if (titulo.length < 3 || titulo.length > 80) throw erro("O título precisa ter de 3 a 80 letras.");
  if (texto.length < 3 || texto.length > 400) throw erro("A mensagem precisa ter de 3 a 400 letras.");
  if (!DESTINOS_AVISO.includes(destino)) throw erro("Destino inválido.");
  if (!ESTILOS_AVISO.includes(estilo)) throw erro("Estilo inválido.");
  if (chave && !/^[a-z0-9-]{8,64}$/i.test(chave)) throw erro("Chave inválida.");
  // A mesma chave (clique repetido) não manda duas vezes.
  const [novo] = await sql`INSERT INTO vybe_escritorio_avisos (autor_id, titulo, texto, destino, estilo, chave)
    VALUES (${Number(pessoa.id)}, ${titulo}, ${texto}, ${destino}, ${estilo}, ${chave || null})
    ON CONFLICT (chave) DO UPDATE SET chave = EXCLUDED.chave RETURNING id::text AS id`;
  return { id: novo.id };
}

export async function responderAviso(sql, pessoaId, corpo = {}) {
  if (!(await pronto(sql))) return { ok: true };
  const id = String(corpo.id || ""), acao = String(corpo.resposta || "");
  if (!/^\d{1,18}$/.test(id)) throw erro("Recado inválido.");
  if (!["conferiu", "ignorou"].includes(acao)) throw erro("Resposta inválida.");
  await sql`INSERT INTO vybe_escritorio_avisos_vistos (aviso_id, pessoa_id, acao)
    SELECT id, ${Number(pessoaId)}, ${acao} FROM vybe_escritorio_avisos WHERE id = ${id}
    ON CONFLICT (aviso_id, pessoa_id) DO NOTHING`;
  return { ok: true };
}
