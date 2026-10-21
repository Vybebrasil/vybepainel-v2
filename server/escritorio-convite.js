// Convidado no Escritório (pedido do Paulo, 20/10/2026): qualquer pessoa da
// equipe manda um link; quem abre escolhe um de quatro bonecos prontos e entra
// sem conta. O convidado vê quem está online e só anda pela sala de quem
// convidou e pelas áreas comuns (nunca o Centro de Operação nem outros
// quartos). Conversa por voz só na sala de quem convidou, que vira conversa
// própria enquanto ele está lá: a conversa única dos espaços abertos levaria o
// som de toda a equipe ao navegador dele.
//
// Nada do convidado vai para o banco: o link e o crachá são assinados
// (ESCRITORIO_SESSION_SECRET) e o crachá fica num cookie próprio. Cancelar os
// convites é trocar o número `convite_geracao` do perfil de quem convidou.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { QUARTOS } from "./escritorio-quartos.js";
import { perfilEscritorio } from "./escritorio.js";
import { salasDoEscritorio, carregarMapaEscritorio } from "./escritorio-mapa.js";
import { prepararChamadaEscritorio } from "./escritorio-chamadas.js";

// Validade do link: um dia de trabalho.
export const CONVITE_HORAS = 12;
// Áreas comuns abertas ao convidado (o Centro de Operação fica de fora).
export const ZONAS_DO_CONVIDADO = ["recepcao", "reuniao", "auditorio", "producao", "cafe", "jogos", "foco", "academia", "lounge"];
// Bonecos prontos: nada é criado para o convidado (Paulo: "evitar carga no
// sistema"). Peças do próprio Habbo, já usadas pelos figurantes das salas.
export const BONECOS_CONVIDADO = [
  { rotulo: "Social", figura: "hr-828-61.hd-180-1.ch-255-1408.lg-280-110.sh-305-62" },
  { rotulo: "Casual", figura: "hr-3163-45.hd-180-2.ch-215-66.lg-275-1408.sh-290-62" },
  { rotulo: "Executiva", figura: "hr-515-45.hd-600-1.ch-665-1408.lg-700-110.sh-725-62" },
  { rotulo: "Criativa", figura: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62" },
];
const COOKIE = "vybe_convidado";

const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
const segredo = (env = process.env) => {
  const s = String(env.ESCRITORIO_SESSION_SECRET || "");
  if (s.length < 32) throw erro("O escritório ainda não está configurado para convidados.", 503);
  return s;
};
function assinar(dados, chave) {
  const corpo = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return corpo + "." + createHmac("sha256", chave).update(corpo).digest("base64url");
}
export function lerAssinado(token, chave, aud, agora = Date.now()) {
  if (typeof token !== "string" || token.length > 2000) return null;
  const [corpo, sig, extra] = token.split(".");
  if (!corpo || !sig || extra) return null;
  const esperada = Buffer.from(createHmac("sha256", chave).update(corpo).digest("base64url"));
  const recebida = Buffer.from(sig);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, "base64url").toString());
    if (d.aud !== aud || !Number.isFinite(d.exp) || d.exp <= agora) return null;
    return d;
  } catch {
    return null;
  }
}
// Nome que o convidado digita: texto curto, sem marcação.
export function nomeDoConvidado(v) {
  const nome = String(v || "").replace(/[<>"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (nome.length < 2) throw erro("Escreva o seu nome para entrar.");
  return nome;
}

// Quem convidou continua na equipe e não cancelou os convites.
async function anfitriao(sql, d) {
  if (!/^\d{1,18}$/.test(String(d?.a || ""))) return null;
  const [p] = await sql`SELECT p.id, p.nome, COALESCE(e.preferencias,'{}'::jsonb) AS preferencias
    FROM vybe_pessoas p LEFT JOIN vybe_escritorio_perfis e ON e.pessoa_id=p.id
    WHERE p.id=${d.a} AND p.ativo=TRUE AND p.pode_entrar=TRUE`;
  if (!p) return null;
  const perfil = perfilEscritorio(p.preferencias);
  if (Number(perfil.convite_geracao || 0) !== Number(d.g || 0)) return null;
  return { id: String(p.id), nome: p.nome, perfil };
}

export async function criarConvite(sql, pessoa, origem, env = process.env, agora = Date.now()) {
  const [p] = await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoa.id}`;
  const g = perfilEscritorio(p?.preferencias || {}).convite_geracao || 0;
  const exp = agora + CONVITE_HORAS * 3600e3;
  const token = assinar({ aud: "vybe-convite", a: String(pessoa.id), g, exp }, segredo(env));
  const base = /^https:\/\/[a-z0-9.-]+$/i.test(String(origem || "")) ? origem : "https://vybepainel-v2.vercel.app";
  // No fragmento (#): o token não vai para os registros do servidor.
  return { link: `${base}/#convite=${token}`, expira: new Date(exp).toISOString() };
}
// Cancela todos os links mandados até agora (e tira quem entrou por eles).
export async function cancelarConvites(sql, pessoa) {
  await sql`INSERT INTO vybe_escritorio_perfis(pessoa_id) VALUES(${pessoa.id}) ON CONFLICT DO NOTHING`;
  await sql`UPDATE vybe_escritorio_perfis SET preferencias = jsonb_set(COALESCE(preferencias,'{}'::jsonb), '{convite_geracao}',
    to_jsonb(COALESCE((preferencias->>'convite_geracao')::int, 0) + 1)), atualizado_em=NOW() WHERE pessoa_id=${pessoa.id}`;
  return true;
}

export function convidadoDoCookie(req, env = process.env) {
  const achado = String(req.headers?.cookie || "").split(";").map((p) => p.trim()).find((p) => p.startsWith(COOKIE + "="));
  if (!achado) return null;
  let token;
  try { token = decodeURIComponent(achado.slice(COOKIE.length + 1)); } catch { return null; }
  try { return lerAssinado(token, segredo(env), "vybe-convidado"); } catch { return null; }
}
function cabecalhoDoCookie(token, exp) {
  const idade = token ? Math.max(0, Math.floor((exp - Date.now()) / 1000)) : 0;
  return [`${COOKIE}=${encodeURIComponent(token || "")}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax", `Max-Age=${idade}`].join("; ");
}

// Zonas por onde o convidado anda e onde ele tem voz.
function zonasDe(salaAnfitriao) {
  const sala = salaAnfitriao ? [salaAnfitriao, salaAnfitriao + "-andar-1"] : [];
  return { zonas: [...sala, ...ZONAS_DO_CONVIDADO], vozes: sala };
}

// Entrada do convidado: só o que a tela precisa para desenhar a sala de quem
// convidou, as áreas comuns e quem está online (nome e boneco).
export async function baseDoConvidado(sql, c, host, env = process.env, agora = Date.now()) {
  const equipe = await sql`SELECT p.id, p.nome, COALESCE(e.preferencias,'{}'::jsonb) AS preferencias
    FROM vybe_pessoas p LEFT JOIN vybe_escritorio_perfis e ON e.pessoa_id=p.id
    WHERE p.ativo=TRUE AND p.pode_entrar=TRUE ORDER BY p.nome`;
  const lista = equipe.map((p) => {
    const perfil = perfilEscritorio(p.preferencias);
    // Da sala de quem convidou vai tudo (planta, pintura); dos outros, só o boneco.
    return { id: String(p.id), nome: p.nome, perfil: String(p.id) === host.id ? perfil : perfilEscritorio({ figura: perfil.figura, mao: perfil.mao }) };
  });
  const salas = salasDoEscritorio(lista.map((p) => ({ id: p.id, nome: p.nome })));
  const salaAnfitriao = salas.find((s) => s.pessoa_id === host.id)?.id || "";
  const { zonas, vozes } = zonasDe(salaAnfitriao);
  const mapa = await carregarMapaEscritorio(sql);
  const camadas = Object.fromEntries(Object.entries(mapa.camadas || {}).filter(([k]) => k === "geral" || zonas.includes(k)));
  const usadas = new Set(Object.values(camadas).flatMap((c) => (c.itens || []).map((it) => String(it[0]))).filter((k) => k.startsWith("vybeimg_")).map((k) => k.slice(8)));
  const perfilConvidado = perfilEscritorio({ figura: BONECOS_CONVIDADO[c.b]?.figura || BONECOS_CONVIDADO[0].figura, sala: "convivencia" });
  const worker = String(env.ESCRITORIO_WORKER_URL || "");
  const pronto = /^https:\/\/[a-z0-9.-]+(?:\/)?$/i.test(worker);
  const claims = {
    sub: c.id, nome: c.nome, admin: false, convidado: true, anfitriao: host.id, salaAnfitriao, zonas,
    perfil: perfilConvidado, minhaSala: "", aud: "vybe-escritorio",
    iat: Math.floor(agora / 1000), exp: Math.floor(agora / 1000) + 300,
  };
  return {
    ok: true,
    convidado: { id: c.id, nome: c.nome, anfitriao: { id: host.id, nome: host.nome }, salaAnfitriao, zonas, vozes, expira: new Date(c.exp).toISOString() },
    quartos: QUARTOS,
    economia: { disponivel: false, motivo: "Convidados não usam a loja." },
    eu: c.id,
    admin: false,
    equipe: [...lista, { id: c.id, nome: c.nome, perfil: perfilConvidado, convidado: true }],
    salas,
    mapa: { editavel: false, camadas, imagens: (mapa.imagens || []).filter((i) => usadas.has(String(i.id))) },
    worker: pronto ? worker : null,
    token: pronto ? assinar(claims, segredo(env)) : null,
    aviso: pronto ? null : "A conexão em tempo real ainda não foi configurada.",
  };
}

// Rotas públicas (sem sessão do painel): area=convite.
export async function areaConvite(req, res, sql, env = process.env) {
  res.setHeader("Cache-Control", "no-store");
  const acao = String(req.query?.acao || req.body?.acao || "");
  try {
    const chave = segredo(env);
    if (req.method === "POST" && (acao === "abrir" || acao === "entrar")) {
      const convite = lerAssinado(String(req.body?.token || ""), chave, "vybe-convite");
      const host = convite && await anfitriao(sql, convite);
      if (!host) throw erro("Este convite venceu ou foi cancelado. Peça um link novo a quem convidou.", 410);
      if (acao === "abrir")
        return res.status(200).json({ ok: true, anfitriao: { nome: host.nome }, bonecos: BONECOS_CONVIDADO.map((b) => ({ rotulo: b.rotulo, figura: b.figura })), expira: new Date(convite.exp).toISOString() });
      const b = Number(req.body?.boneco);
      if (!Number.isInteger(b) || b < 0 || b >= BONECOS_CONVIDADO.length) throw erro("Escolha um dos bonecos.");
      const c = { aud: "vybe-convidado", id: "c-" + randomBytes(6).toString("hex"), nome: nomeDoConvidado(req.body?.nome), b, a: convite.a, g: convite.g, exp: convite.exp };
      res.setHeader("Set-Cookie", cabecalhoDoCookie(assinar(c, chave), c.exp));
      return res.status(200).json(await baseDoConvidado(sql, c, host, env));
    }
    const c = convidadoDoCookie(req, env);
    const host = c && await anfitriao(sql, c);
    if (acao === "sair" || !host) {
      res.setHeader("Set-Cookie", cabecalhoDoCookie("", 0));
      if (acao === "sair") return res.status(200).json({ ok: true });
      throw erro("Seu convite venceu ou foi cancelado.", 401);
    }
    // A tela renova a entrada no Worker a cada poucos minutos.
    if (req.method === "GET" && acao === "entrada") return res.status(200).json(await baseDoConvidado(sql, c, host, env));
    if (req.method === "POST" && acao === "chamada") {
      const salas = salasDoEscritorio((await sql`SELECT id,nome FROM vybe_pessoas WHERE ativo=TRUE AND pode_entrar=TRUE ORDER BY nome`).map((p) => ({ id: String(p.id), nome: p.nome })));
      const { vozes } = zonasDe(salas.find((s) => s.pessoa_id === host.id)?.id || "");
      const sala = String(req.body?.sala || "");
      if (!vozes.includes(sala)) throw erro("A conversa por voz com convidados é só na sala de quem convidou.", 403);
      return res.status(200).json({ ok: true, ...(await prepararChamadaEscritorio(sql, { id: c.id, nome: c.nome + " (convidado)" }, sala, env)) });
    }
    throw erro("Ação de convidado inválida.");
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message, ...(e.code ? { code: e.code } : {}) });
  }
}
