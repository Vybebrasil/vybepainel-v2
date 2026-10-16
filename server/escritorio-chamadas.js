// Adaptado do motor RealtimeKit do VybeChat; credenciais ficam no servidor.
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
  const config = realtimeKitConfig(env);
  if (!config.ready) {
    throw new Error(
      "O RealtimeKit ainda não foi configurado no Worker.",
      503,
      "realtimekit_unconfigured",
    );
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
    throw new Error(detail, response.status || 502);
  }
  if (!payload?.data)
    throw new Error(
      "A Cloudflare devolveu uma resposta de chamada inválida.",
      502,
    );
  return payload.data;
}
export async function prepararChamadaEscritorio(
  sql,
  pessoa,
  sala,
  env = process.env,
) {
  // A conversa por voz é da zona do mapa (sala individual ou espaço).
  const { SALAS_ESCRITORIO, ZONAS_ESCRITORIO } = await import("./escritorio.js");
  if (!SALAS_ESCRITORIO.includes(sala) && !ZONAS_ESCRITORIO.includes(sala)) throw new Error("Sala inválida.");
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
    return { authToken: p.token };
  });
}
