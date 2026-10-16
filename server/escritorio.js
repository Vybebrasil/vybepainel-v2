import { prepararChamadaEscritorio } from "./escritorio-chamadas.js";
import { createHmac } from "node:crypto";

export const SALAS_ESCRITORIO = [
  "convivencia",
  "criacao",
  "atendimento",
  "producao",
  "reuniao",
  "foco",
];
export const CORES_ESCRITORIO = [
  "laranja",
  "azul",
  "verde",
  "roxo",
  "rosa",
  "grafite",
];
export function perfilEscritorio(valor = {}) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) valor = {};
  const opcao = (campo, lista, padrao) =>
    lista.includes(valor[campo]) ? valor[campo] : padrao;
  const coordenada = (campo, padrao) =>
    Number.isFinite(Number(valor[campo]))
      ? Math.min(94, Math.max(6, Number(valor[campo])))
      : padrao;
  return {
    roupa: opcao("roupa", CORES_ESCRITORIO, "laranja"),
    pele: opcao("pele", ["clara", "media", "escura"], "media"),
    cabelo: opcao("cabelo", ["curto", "longo", "cacheado", "sem"], "curto"),
    mesa: opcao("mesa", CORES_ESCRITORIO, "grafite"),
    objeto: opcao("objeto", ["planta", "livros", "luminaria"], "planta"),
    sala: opcao("sala", SALAS_ESCRITORIO, "convivencia"),
    x: coordenada("x", 50),
    y: coordenada("y", 70),
  };
}
export function assinarEntradaEscritorio(
  pessoa,
  perfil,
  segredo,
  agora = Date.now(),
) {
  if (!segredo || segredo.length < 32)
    throw new Error(
      "Configure ESCRITORIO_SESSION_SECRET com pelo menos 32 caracteres.",
    );
  const claims = {
    sub: String(pessoa.id),
    nome: pessoa.nome,
    admin: Boolean(pessoa.admin),
    perfil: perfilEscritorio(perfil),
    aud: "vybe-escritorio",
    iat: Math.floor(agora / 1000),
    exp: Math.floor(agora / 1000) + 300,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return (
    body + "." + createHmac("sha256", segredo).update(body).digest("base64url")
  );
}
export async function escritorioPronto(sql) {
  const [r] =
    await sql`SELECT (to_regclass('public.vybe_escritorio_perfis') IS NOT NULL AND to_regclass('public.vybe_escritorio_mensagens') IS NOT NULL AND to_regclass('public.vybe_escritorio_salas') IS NOT NULL) AS existe`;
  return Boolean(r?.existe);
}
export async function carregarEscritorio(sql, pessoa) {
  const equipe =
    await sql`SELECT p.id,p.nome,COALESCE(e.preferencias,'{}'::jsonb) AS preferencias
    FROM vybe_pessoas p LEFT JOIN vybe_escritorio_perfis e ON e.pessoa_id=p.id
    WHERE p.ativo=TRUE AND p.pode_entrar=TRUE ORDER BY p.nome`;
  return {
    eu: String(pessoa.id),
    equipe: equipe.map((p) => ({
      id: String(p.id),
      nome: p.nome,
      perfil: perfilEscritorio(p.preferencias),
    })),
  };
}
export async function salvarPerfilEscritorio(sql, pessoaId, valor) {
  const perfil = perfilEscritorio(valor);
  await sql`INSERT INTO vybe_escritorio_perfis(pessoa_id,preferencias) VALUES(${pessoaId},${JSON.stringify(perfil)}::jsonb)
    ON CONFLICT(pessoa_id) DO UPDATE SET preferencias=EXCLUDED.preferencias,atualizado_em=NOW()`;
  return perfil;
}
export async function mensagensEscritorio(sql, sala) {
  if (!SALAS_ESCRITORIO.includes(sala)) throw new Error("Sala inválida.");
  const rows =
    await sql`SELECT m.id,m.pessoa_id,p.nome,m.texto,m.criado_em FROM vybe_escritorio_mensagens m
    JOIN vybe_pessoas p ON p.id=m.pessoa_id WHERE m.sala=${sala} ORDER BY m.id DESC LIMIT 60`;
  return rows
    .reverse()
    .map((r) => ({ ...r, id: String(r.id), pessoa_id: String(r.pessoa_id) }));
}
export async function enviarMensagemEscritorio(
  sql,
  pessoaId,
  { sala, texto, chave },
) {
  if (!SALAS_ESCRITORIO.includes(sala)) throw new Error("Sala inválida.");
  if (typeof texto !== "string" || !texto.trim() || texto.length > 2000)
    throw new Error("Escreva uma mensagem de até 2.000 caracteres.");
  if (typeof chave !== "string" || !/^[a-f0-9-]{36}$/i.test(chave))
    throw new Error("Identificador de mensagem inválido.");
  const [r] =
    await sql`INSERT INTO vybe_escritorio_mensagens(pessoa_id,sala,texto,chave) VALUES(${pessoaId},${sala},${texto.trim()},${chave})
    ON CONFLICT(pessoa_id,chave) DO UPDATE SET chave=EXCLUDED.chave RETURNING id`;
  return String(r.id);
}
export async function areaEscritorio(req, res, quem, sql) {
  if (quem.tipo !== "sessao")
    return res.status(403).json({
      error: "Entre com sua conta individual para usar o escritório.",
    });
  if (!["GET", "POST"].includes(req.method))
    return res.status(405).json({ error: "Método não permitido." });
  if (!(await escritorioPronto(sql)))
    return res.status(503).json({
      error: "O escritório aguarda a migração revisada do banco.",
      code: "escritorio_setup",
    });
  const pessoa = quem.pessoa;
  const acao = req.query?.acao || req.body?.acao || "entrada";
  if (req.method === "GET") {
    if (acao === "mensagens")
      return res.status(200).json({
        ok: true,
        mensagens: await mensagensEscritorio(sql, String(req.query.sala || "")),
      });
    const base = await carregarEscritorio(sql, pessoa);
    const perfil =
      base.equipe.find((p) => p.id === base.eu)?.perfil || perfilEscritorio();
    const worker = String(process.env.ESCRITORIO_WORKER_URL || "");
    const configurado =
      /^https:\/\/[a-z0-9.-]+(?:\/)?$/i.test(worker) &&
      Boolean(process.env.ESCRITORIO_SESSION_SECRET?.length >= 32);
    return res.status(200).json({
      ok: true,
      ...base,
      worker: configurado ? worker : null,
      token: configurado
        ? assinarEntradaEscritorio(
            pessoa,
            perfil,
            process.env.ESCRITORIO_SESSION_SECRET,
          )
        : null,
      aviso: configurado
        ? null
        : "A conexão em tempo real ainda não foi configurada.",
    });
  }
  // Identidade vem exclusivamente da sessão; o corpo nunca escolhe pessoa/admin.
  if (acao === "chamada")
    return res.status(200).json({
      ok: true,
      ...(await prepararChamadaEscritorio(
        sql,
        pessoa,
        String(req.body?.sala || ""),
      )),
    });
  if (acao === "perfil")
    return res.status(200).json({
      ok: true,
      perfil: await salvarPerfilEscritorio(sql, pessoa.id, req.body?.perfil),
    });
  if (acao === "mensagem")
    return res.status(200).json({
      ok: true,
      id: await enviarMensagemEscritorio(sql, pessoa.id, req.body || {}),
    });
  return res.status(400).json({ error: "Ação inválida." });
}
