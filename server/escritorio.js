import { prepararChamadaEscritorio } from "./escritorio-chamadas.js";
import { salasDoEscritorio, carregarMapaEscritorio, salvarCamadaEscritorio, arteRemotaEscritorio, bonecoEscritorio } from "./escritorio-mapa.js";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const SALAS_ESCRITORIO = [
  "convivencia",
  "criacao",
  "atendimento",
  "producao",
  "reuniao",
  "foco",
];
// Zonas de conversa do mapa: cada sala individual e cada espaço tem a sua.
export const ZONAS_ESCRITORIO = [
  ...Array.from({ length: 12 }, (_, i) => "sala-" + i),
  "auditorio", "reuniao", "recepcao", "cafe", "academia", "foco", "jogos", "producao", "lounge",
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
    // Boneco do Habbo montado no criador: partes "tipo-conjunto-cor" separadas
    // por ponto. Só esse formato passa; vai para uma URL de imagem.
    figura: /^[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}(\.[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}){0,15}$/.test(String(valor.figura || ""))
      ? String(valor.figura)
      : "",
    // Versão da abertura que a pessoa já viu (data). Vazio: ainda não viu.
    abertura: /^\d{4}-\d{2}-\d{2}$/.test(String(valor.abertura || "")) ? String(valor.abertura) : "",
  };
}
export function assinarEntradaEscritorio(
  pessoa,
  perfil,
  segredo,
  agora = Date.now(),
  minhaSala = "",
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
    // Sala individual da pessoa (decidida aqui): só ela e quem administra a trancam.
    minhaSala: /^sala-([0-9]|1[01])$/.test(String(minhaSala)) ? String(minhaSala) : "",
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
  const lista = equipe.map((p) => ({
    id: String(p.id),
    nome: p.nome,
    perfil: perfilEscritorio(p.preferencias),
  }));
  return {
    eu: String(pessoa.id),
    admin: Boolean(pessoa.admin),
    equipe: lista,
    // Dono de cada sala individual e o mapa salvo (camadas editadas).
    salas: salasDoEscritorio(lista),
    mapa: await carregarMapaEscritorio(sql),
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
export const PASTA_ARTE_ESCRITORIO = join(process.cwd(), "assets", "escritorio", "habbo");
export async function enviarArteEscritorio(res, arquivo) {
  const m = /^([a-z0-9_]+)\.(png|json)$/.exec(arquivo);
  if (!m) return res.status(400).json({ error: "Arquivo inválido." });
  let dados;
  try {
    dados = await readFile(join(PASTA_ARTE_ESCRITORIO, arquivo));
  } catch {
    // Fora dos móveis do painel: vem do catálogo do Habbo (editor do mapa).
    try {
      dados = await arteRemotaEscritorio(m[1], m[2]);
    } catch (e) {
      return res.status(e.status || 502).json({ error: e.message });
    }
  }
  res.setHeader("Content-Type", m[2] === "png" ? "image/png" : "application/json; charset=utf-8");
  // O endereço muda quando o arquivo muda (?v=hash); cache só no navegador.
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  return res.status(200).send(dados);
}
export async function areaEscritorio(req, res, quem, sql) {
  if (quem.tipo !== "sessao")
    return res.status(403).json({
      error: "Entre com sua conta individual para usar o escritório.",
    });
  if (!["GET", "POST"].includes(req.method))
    return res.status(405).json({ error: "Método não permitido." });
  // Arte do mapa (Habbo, uso interno): só sai para quem está logado, nunca
  // como arquivo público do site. O nome é validado; nada fora da pasta.
  if (req.method === "GET" && req.query?.acao === "arte")
    return enviarArteEscritorio(res, String(req.query.arquivo || ""));
  if (req.method === "GET" && req.query?.acao === "boneco") {
    try {
      const png = await bonecoEscritorio(sql, String(req.query.figura || ""), req.query.dir);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, max-age=86400");
      return res.status(200).send(png);
    } catch (e) {
      return res.status(e.status || 502).json({ error: e.message });
    }
  }
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
            Date.now(),
            base.salas.find((x) => x.pessoa_id === String(pessoa.id))?.id || "",
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
  if (acao === "mapa") {
    const { salas } = await carregarEscritorio(sql, pessoa);
    try {
      return res.status(200).json({ ok: true, ...(await salvarCamadaEscritorio(sql, pessoa, salas, req.body || {})) });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }
  if (acao === "mensagem")
    return res.status(200).json({
      ok: true,
      id: await enviarMensagemEscritorio(sql, pessoa.id, req.body || {}),
    });
  return res.status(400).json({ error: "Ação inválida." });
}
