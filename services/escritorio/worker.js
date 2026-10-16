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
// Zona do mapa (sala individual ou espaço); fora delas, corredor ("").
const REACOES = ["aplauso", "coracao", "risada", "joinha", "fogo", "festa"];
// Poses visíveis para todos: acenar e deitar acabam ao andar; o café segue na mão.
const POSES = ["acenar", "deitar", "cafe", "bebida", "lanche", "exercicio", "bicicleta", ""];
// Continuam ao andar (algo na mão) ou até a pessoa sair do aparelho.
const POSES_MANTIDAS = ["cafe", "bebida", "lanche", "exercicio", "bicicleta"];
// Móvel ligado/desligado: "classe@x,y" do mapa geral e o estado da animação.
const MOVEL_CHAVE = /^[a-z0-9_]{1,64}@\d{1,2},\d{1,2}$/;
const zonaValida = (z) => (/^(sala-([0-9]|1[01])|auditorio|reuniao|recepcao|cafe|academia|foco|jogos|producao|lounge)$/.test(String(z || "")) ? String(z) : "");
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
    // VYBE_ORIGIN aceita mais de um endereço do painel, separados por vírgula
    // (o oficial e o alias do time). Só a igualdade exata vale.
    const origem = req.headers.get("Origin");
    const permitidas = String(env.VYBE_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
    if (!origem || !permitidas.includes(origem))
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
  // Salas trancadas: transitórias, na memória da sala do Worker (como a presença).
  get trancas() {
    if (!this._trancas) this._trancas = new Map();
    return this._trancas;
  }
  // Móveis ligados/desligados (jukebox, fliperama, luz…): transitórios, como as trancas.
  get moveis() {
    if (!this._moveis) this._moveis = new Map();
    return this._moveis;
  }
  listaMoveis() {
    return [...this.moveis];
  }
  listaTrancas() {
    return [...this.trancas].map(([zona, permitidos]) => ({ zona, permitidos: [...permitidos] }));
  }
  naZona(zona) {
    return this.ativos().filter((t) => this.estado(t).zona === zona);
  }
  presenca() {
    // Sala trancada que ficou vazia destranca sozinha.
    let mudou = false;
    for (const zona of this.trancas.keys()) if (!this.naZona(zona).length) { this.trancas.delete(zona); mudou = true; }
    if (mudou) this.broadcast("zone:locks", this.listaTrancas());
    const pessoas = new Map();
    for (const s of this.ativos()) {
      const a = this.estado(s);
      pessoas.set(a.sub, {
        id: a.sub,
        nome: a.nome,
        perfil: a.perfil,
        sala: a.sala,
        zona: a.zona || "",
        pose: a.pose || "",
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
      this.send(s, "zone:locks", this.listaTrancas());
      this.send(s, "furni:states", this.listaMoveis());
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
        zona: zonaValida(p.zona),
        pose: POSES_MANTIDAS.includes(a.pose) ? a.pose : "",
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
          (outro.zona || "") === (a.zona || "") &&
          outro.status === "disponivel" &&
          Math.hypot(outro.x - a.x, outro.y - a.y) <= 25
        )
          this.send(target, "conversation:invite", {
            nome: a.nome,
            sala: a.sala,
            zona: a.zona || "",
          });
      }
      s.serializeAttachment(a);
      return;
    } else if (evento.type === "zone:lock") {
      const zona = zonaValida(p.zona);
      // Só quem está na zona tranca; sala individual, só a dona ou quem administra.
      if (!zona || a.zona !== zona) return;
      if (zona.startsWith("sala-") && a.minhaSala !== zona && !a.admin) return;
      if (p.trancada) this.trancas.set(zona, new Set(this.naZona(zona).map((t) => this.estado(t).sub)));
      else this.trancas.delete(zona);
      this.broadcast("zone:locks", this.listaTrancas());
      return;
    } else if (evento.type === "zone:knock") {
      const zona = zonaValida(p.zona);
      if (!zona || !this.trancas.has(zona) || this.trancas.get(zona).has(a.sub)) return;
      for (const t of this.naZona(zona)) this.send(t, "zone:knock", { id: a.sub, nome: a.nome, zona });
      return;
    } else if (evento.type === "zone:admit") {
      const zona = zonaValida(p.zona);
      if (!zona || a.zona !== zona || !this.trancas.has(zona) || typeof p.id !== "string") return;
      this.trancas.get(zona).add(p.id.slice(0, 40));
      this.broadcast("zone:locks", this.listaTrancas());
      return;
    } else if (evento.type === "recado:novo") {
      // Só um toque para quem recebeu: o texto é relido da API autenticada.
      if (typeof p.para !== "string" || !/^\d{1,18}$/.test(p.para) || p.para === a.sub) return;
      for (const t of this.ativos()) if (this.estado(t).sub === p.para) this.send(t, "recado:novo", { de: a.sub, nome: a.nome });
      return;
    } else if (evento.type === "furni:toggle") {
      const estado = Number(p.estado);
      if (typeof p.chave !== "string" || !MOVEL_CHAVE.test(p.chave) || !Number.isInteger(estado) || estado < 0 || estado > 20) return;
      if (!this.moveis.has(p.chave) && this.moveis.size >= 300) return;
      this.moveis.set(p.chave, estado);
      this.broadcast("furni:states", this.listaMoveis());
      return;
    } else if (evento.type === "pose") {
      if (!POSES.includes(p.tipo)) return;
      a.pose = p.tipo;
    } else if (evento.type === "reaction") {
      if (!REACOES.includes(p.tipo)) return;
      this.broadcast("reaction", { id: a.sub, tipo: p.tipo });
      return;
    } else if (evento.type === "chat:bubble") {
      // Balão sobre a cabeça: só o texto, curto; a autoria vem da sessão.
      const texto = typeof p.texto === "string" ? p.texto.replace(/\s+/g, " ").trim().slice(0, 140) : "";
      if (!texto) return;
      this.broadcast("chat:bubble", { id: a.sub, texto });
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
