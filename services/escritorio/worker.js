// Protocolo presence:join/presence:update reaproveitado do VybeChat.
// A identidade agora vem de um token curto do Vybe OS, nunca de nome/código livre.
const salas = [
  "convivencia",
  "criacao",
  "atendimento",
  "producao",
  "reuniao",
  "foco",
];
const estados = ["disponivel", "foco", "reuniao", "ausente"];
export async function verificarEntrada(token, segredo, agora = Date.now()) {
  try {
    if (
      !segredo ||
      segredo.length < 32 ||
      typeof token !== "string" ||
      token.length > 3000
    )
      return null;
    const [body, sig, extra] = token.split(".");
    if (extra || !body || !sig) return null;
    const bytes = (s) =>
      Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
        c.charCodeAt(0),
      );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(segredo),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        key,
        bytes(sig),
        new TextEncoder().encode(body),
      ))
    )
      return null;
    const c = JSON.parse(new TextDecoder().decode(bytes(body)));
    if (
      c.aud !== "vybe-escritorio" ||
      !/^\d+$/.test(c.sub) ||
      typeof c.nome !== "string" ||
      c.nome.length > 120 ||
      !Number.isFinite(c.exp) ||
      c.exp * 1000 <= agora ||
      c.exp - c.iat > 300 ||
      c.iat * 1000 > agora + 10000
    )
      return null;
    return c;
  } catch {
    return null;
  }
}
const json = (type, payload) => JSON.stringify({ type, payload });
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/health")
      return Response.json({ ok: true, service: "vybe-escritorio" });
    const origem = req.headers.get("Origin");
    if (origem !== env.VYBE_ORIGIN)
      return new Response("Origem não permitida", { status: 403 });
    if (url.pathname !== "/room/vybe-os")
      return new Response("Não encontrado", { status: 404 });
    return env.ESCRITORIO.idFromName
      ? env.ESCRITORIO.get(env.ESCRITORIO.idFromName("vybe-os")).fetch(req)
      : new Response("Configuração indisponível", { status: 503 });
  },
};
export class EscritorioRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async fetch(req) {
    if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return new Response("WebSocket obrigatório", { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ aberto: Date.now(), last: 0 });
    await this.ctx.storage.setAlarm(Date.now() + 15000);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  estado(s) {
    return s.deserializeAttachment() || {};
  }
  ativos() {
    return this.ctx
      .getWebSockets()
      .filter((s) => this.estado(s).exp > Date.now() / 1000);
  }
  send(s, t, p) {
    try {
      s.send(json(t, p));
    } catch {
      /* fechamento concorrente */
    }
  }
  broadcast(t, p) {
    for (const s of this.ativos()) this.send(s, t, p);
  }
  presenca() {
    const pessoas = new Map();
    for (const s of this.ativos()) {
      const a = this.estado(s);
      pessoas.set(a.sub, {
        id: a.sub,
        nome: a.nome,
        perfil: a.perfil,
        sala: a.sala,
        x: a.x,
        y: a.y,
        status: a.status,
      });
    }
    this.broadcast("presence:update", [...pessoas.values()]);
  }
  async webSocketMessage(s, raw) {
    if (typeof raw !== "string" || raw.length > 4000) {
      s.close(1009, "Mensagem muito grande");
      return;
    }
    let evento;
    try {
      evento = JSON.parse(raw);
    } catch {
      return;
    }
    let a = this.estado(s);
    const p = evento.payload || {};
    if (evento.type === "presence:join") {
      const c = await verificarEntrada(
        p.token,
        this.env.ESCRITORIO_SESSION_SECRET,
      );
      if (!c) {
        this.send(s, "realtime:error", {
          message: "Sessão expirada. Entre novamente.",
        });
        s.close(1008, "Sessão inválida");
        return;
      }
      s.serializeAttachment({
        ...c,
        sala: c.perfil?.sala || "convivencia",
        x: c.perfil?.x || 50,
        y: c.perfil?.y || 70,
        status: "disponivel",
        last: 0,
      });
      this.send(s, "session:ready", {});
      this.presenca();
      return;
    }
    if (!a.sub || a.exp <= Date.now() / 1000) {
      s.close(1008, "Sessão expirada");
      return;
    }
    if (evento.type === "system:ping") {
      this.send(s, "system:pong", {});
      return;
    }
    if (Date.now() - a.last < 120) return;
    a.last = Date.now();
    if (evento.type === "presence:move") {
      if (
        !salas.includes(p.sala) ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y)
      )
        return;
      a = {
        ...a,
        sala: p.sala,
        status: estados.includes(p.status) ? p.status : a.status,
        x: Math.max(6, Math.min(94, p.x)),
        y: Math.max(6, Math.min(94, p.y)),
      };
    } else if (evento.type === "presence:status") {
      if (!estados.includes(p.status)) return;
      a.status = p.status;
    } else if (evento.type === "conversation:invite") {
      if (a.status !== "disponivel") return;
      for (const target of this.ativos()) {
        const outro = this.estado(target);
        if (
          outro.sub === String(p.id) &&
          outro.sub !== a.sub &&
          outro.sala === a.sala &&
          outro.status === "disponivel" &&
          Math.hypot(outro.x - a.x, outro.y - a.y) <= 25
        )
          this.send(target, "conversation:invite", {
            nome: a.nome,
            sala: a.sala,
          });
      }
      s.serializeAttachment(a);
      return;
    } else if (evento.type === "chat:changed") {
      if (!salas.includes(p.sala)) return;
      // Apenas invalidação. Texto e autoria são relidos da API autenticada Neon.
      this.broadcast("chat:changed", { sala: p.sala });
      return;
    } else return;
    s.serializeAttachment(a);
    this.presenca();
  }
  webSocketClose(s) {
    try {
      s.close();
    } catch {}
    this.presenca();
  }
  webSocketError(s) {
    this.webSocketClose(s);
  }
  async alarm() {
    for (const s of this.ctx.getWebSockets()) {
      const a = this.estado(s);
      if (
        (!a.sub && Date.now() - a.aberto > 10000) ||
        (a.exp && a.exp <= Date.now() / 1000)
      )
        s.close(1008, "Renove sua sessão");
    }
    this.presenca();
    if (this.ctx.getWebSockets().length)
      await this.ctx.storage.setAlarm(Date.now() + 15000);
  }
}
