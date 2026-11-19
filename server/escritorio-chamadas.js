// Adaptado do motor RealtimeKit do VybeChat; credenciais ficam no servidor.
import { exigirSaidaExternaAtiva } from './homologacao.js';
function realtimeKitConfig(env) {
  const accountId = String(env?.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  const appId = String(env?.REALTIMEKIT_APP_ID ?? "").trim();
  const apiToken = String(env?.CLOUDFLARE_REALTIME_API_TOKEN ?? "").trim();
  const presetName = String(
    env?.REALTIMEKIT_PRESET_NAME ?? "group_call_participant",
  ).trim();
  return {
    accountId,
    appId,
    apiToken,
    presetName,
    ready: Boolean(accountId && appId && apiToken && presetName),
  };
}

async function realtimeKitRequest(env, pathname, init = {}) {
  exigirSaidaExternaAtiva();
  const config = realtimeKitConfig(env);
  // Error() ignora o segundo argumento: status e código vão como propriedades,
  // para a rota responder 503/502 em vez de 500 genérico.
  if (!config.ready) {
    throw Object.assign(new Error("O RealtimeKit ainda não foi configurado no Worker."), { status: 503, code: "realtimekit_unconfigured" });
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/realtime/kit/${encodeURIComponent(config.appId)}${pathname}`,
    {
      ...init,
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
        ...(init.headers ?? {}),
      },
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const detail =
      payload?.errors?.[0]?.message ||
      payload?.messages?.[0]?.message ||
      "A Cloudflare não conseguiu preparar a chamada.";
    throw Object.assign(new Error(detail), { status: response.status >= 400 ? response.status : 502, code: "realtimekit_error" });
  }
  if (!payload?.data)
    throw Object.assign(new Error("A Cloudflare devolveu uma resposta de chamada inválida."), { status: 502, code: "realtimekit_error" });
  return payload.data;
}
// O participante da chamada é por aparelho, não por pessoa (Paulo, 18/11/2026: ouvia no Windows e no Mac ao mesmo tempo
// e caía). O RealtimeKit aceita uma conexão por participante: renovar o token do mesmo participante em outro aparelho
// derruba o primeiro. O navegador manda um id próprio dele (vybe-escritorio.js, guardado no localStorage); dentro do
// mesmo navegador a voz já fica numa aba só, então recarregar ou trocar de aba continua reaproveitando o participante.
// Sem o id (tela antiga), a chave é a de sempre, por pessoa.
const APARELHO = /^[A-Za-z0-9_-]{8,64}$/;
export function chaveDoParticipante(pessoaId, sala, aparelho) {
  const base = "p:" + String(pessoaId) + ":" + sala;
  return typeof aparelho === "string" && APARELHO.test(aparelho) ? base + ":" + aparelho : base;
}
export async function prepararChamadaEscritorio(
  sql,
  pessoa,
  sala,
  env = process.env,
  { aparelho = null } = {},
) {
  exigirSaidaExternaAtiva();
  // A conversa por voz é da zona do mapa (sala individual ou espaço).
  const { SALAS_ESCRITORIO, ZONAS_ESCRITORIO } = await import("./escritorio.js");
  // "escritorio": a conversa única dos espaços abertos (cada um só ouve quem
  // está na mesma sala); as zonas continuam valendo para salas trancadas.
  if (sala !== "escritorio" && !SALAS_ESCRITORIO.includes(sala) && !ZONAS_ESCRITORIO.includes(sala)) throw new Error("Sala inválida.");
  return sql.comTransacao(async (tx) => {
    // Mesmo bloqueio por sala em todas as instâncias; evita criar reuniões duplicadas.
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"escritorio:" + sala}))`;
    const [atual] =
      await tx`SELECT reuniao_id FROM vybe_escritorio_salas WHERE sala=${sala}`;
    let id = atual?.reuniao_id;
    if (!id) {
      const m = await realtimeKitRequest(env, "/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: "Vybe · " + sala,
          persist_chat: false,
          record_on_start: false,
        }),
      });
      if (typeof m.id !== "string")
        throw new Error("Reunião sem identificador.");
      id = m.id;
      await tx`INSERT INTO vybe_escritorio_salas(sala,reuniao_id) VALUES(${sala},${id})`;
    }
    // O mesmo aparelho reaproveita o mesmo participante (só renova o token): reconectar não deixa um "fantasma"
    // falando junto e não cria custo novo. Outro aparelho da mesma pessoa tem participante próprio e não derruba este.
    // Participante parado expira no RealtimeKit como antes; a renovação falha e cria outro abaixo.
    const chave = chaveDoParticipante(pessoa.id, sala, aparelho);
    const [guardado] = await tx`SELECT reuniao_id FROM vybe_escritorio_salas WHERE sala=${chave}`;
    if (guardado?.reuniao_id) {
      try {
        const r = await realtimeKitRequest(env, `/meetings/${encodeURIComponent(id)}/participants/${encodeURIComponent(guardado.reuniao_id)}/token`, { method: "POST", body: "{}" });
        if (typeof r.token === "string") return { authToken: r.token };
      } catch { /* participante expirou ou foi removido: cria outro abaixo */ }
    }
    const p = await realtimeKitRequest(
      env,
      `/meetings/${encodeURIComponent(id)}/participants`,
      {
        method: "POST",
        body: JSON.stringify({
          name: pessoa.nome,
          preset_name: realtimeKitConfig(env).presetName,
          custom_participant_id: String(pessoa.id) + ":" + crypto.randomUUID(),
        }),
      },
    );
    if (typeof p.token !== "string")
      throw new Error("Participante sem token de chamada.");
    if (typeof p.id === "string")
      await tx`INSERT INTO vybe_escritorio_salas(sala,reuniao_id) VALUES(${chave},${p.id})
        ON CONFLICT(sala) DO UPDATE SET reuniao_id=EXCLUDED.reuniao_id`;
    return { authToken: p.token };
  });
}
