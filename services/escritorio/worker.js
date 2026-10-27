// Protocolo presence:join/presence:update reaproveitado do VybeChat.
// A identidade agora vem de um token curto do Vybe OS, nunca de nome/código livre.
const salas = [
  "convivencia",
  "criacao",
  "atendimento",
  "producao",
  "reuniao",
  "foco",
  // Conversa escrita do subsolo do Escritório (easter egg do Centro de Operação).
  "subsolo",
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
// Sala da música (a Pista do Lounge): fila de vídeos/playlists do YouTube,
// como o bot do VybeChat. Cada navegador toca o próprio player; aqui fica só a
// fila, o que está tocando e desde quando, para todos ouvirem no mesmo ponto.
const MUSICA_LIMITE = 50;
const ID_YOUTUBE = /^[a-zA-Z0-9_-]+$/;
export function fonteMusica(f) {
  if (!f || typeof f !== "object") return null;
  if (f.kind === "video" && typeof f.videoId === "string" && f.videoId.length === 11 && ID_YOUTUBE.test(f.videoId)) return { kind: "video", videoId: f.videoId };
  if (f.kind === "playlist" && typeof f.playlistId === "string" && f.playlistId.length >= 10 && f.playlistId.length <= 80 && ID_YOUTUBE.test(f.playlistId) && !/^(RD|LL|WL|LM)/.test(f.playlistId))
    return { kind: "playlist", playlistId: f.playlistId };
  return null;
}
const musicaVazia = () => ({ fila: [], indice: 0, tocando: false, posicao: 0, atualizado: Date.now(), revisao: 0, por: null });
const chaveMusica = (zona) => (zona === "lounge" ? "musica" : "musica:" + zona);
const posicaoAgora = (m, agora = Date.now()) => Math.max(0, m.posicao + (m.tocando ? Math.max(0, agora - m.atualizado) / 1000 : 0));
const zonaValida = (z) => (/^(sala-([0-9]|1[01])(-andar-1)?|auditorio|reuniao|recepcao|cafe|academia|foco|jogos|producao|lounge|operacao|subsolo)$/.test(String(z || "")) ? String(z) : "");
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
    // Convidado (link de uma pessoa da equipe): crachá próprio, sem número de
    // pessoa, com as zonas por onde pode andar (server/escritorio-convite.js).
    const convidado = c.convidado === true;
    if (convidado && (!/^c-[a-f0-9]{12}$/.test(String(c.sub)) || !/^\d{1,18}$/.test(String(c.anfitriao || "")) || !Array.isArray(c.zonas) || c.zonas.length > 24
      || c.zonas.some((z) => zonaValida(z) !== z) || (c.salaAnfitriao && zonaValida(c.salaAnfitriao) !== c.salaAnfitriao) || c.admin)) return null;
    if (
      c.aud !== "vybe-escritorio" ||
      (!convidado && !/^\d+$/.test(c.sub)) ||
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
      // "observar": a tela de entrada pode ver quem está no escritório sem
      // entrar (o painel só usa isso quando este Worker já entende).
      return Response.json({ ok: true, service: "vybe-escritorio", andares: 1, observar: true }, { headers: { "Access-Control-Allow-Origin": "*" } });
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
  // Balão de fala: o convidado só recebe o de quem está na mesma sala que ele.
  balao(de, p) {
    for (const s of this.ativos()) {
      const o = this.estado(s);
      if (o.convidado && (o.zona || "") !== (de.zona || "")) continue;
      this.send(s, "chat:bubble", p);
    }
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
  // Uma fila de música por sala (Paulo, 19/10/2026: toda jukebox ou aparelho
  // de som abre o player). O Lounge guarda a fila na chave antiga "musica".
  // Quem está na sala ouve e mexe; o estado vai só para quem está nela.
  async musica(zona) {
    if (!this._musicas) this._musicas = new Map();
    if (!this._musicas.has(zona)) this._musicas.set(zona, (await this.ctx.storage?.get?.(chaveMusica(zona))) || musicaVazia());
    return { ...this._musicas.get(zona), zona };
  }
  async mudarMusica(m, a, zona) {
    m.revisao++;
    m.atualizado = Date.now();
    m.por = a ? { id: a.sub, nome: a.nome } : null;
    m.zona = zona;
    this._musicas.set(zona, m);
    await this.ctx.storage?.put?.(chaveMusica(zona), m);
    for (const t of this.naZona(zona)) this.send(t, "music:state", m);
  }
  listaTrancas() {
    return [...this.trancas].map(([zona, permitidos]) => ({ zona, permitidos: [...permitidos] }));
  }
  naZona(zona) {
    return this.ativos().filter((t) => !this.estado(t).observador && this.estado(t).zona === zona);
  }
  presenca() {
    // Sala trancada que ficou vazia destranca sozinha.
    let mudou = false;
    for (const zona of this.trancas.keys()) if (!this.naZona(zona).length) { this.trancas.delete(zona); mudou = true; }
    if (mudou) this.broadcast("zone:locks", this.listaTrancas());
    const pessoas = new Map();
    for (const s of this.ativos()) {
      const a = this.estado(s);
      // Quem só olha da tela de entrada não aparece para ninguém.
      if (a.observador) continue;
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
        ...(a.convidado ? { convidado: true, anfitriao: a.anfitriao } : {}),
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
      // Tela de entrada (Paulo, 20/10/2026): só recebe a lista de quem está
      // no escritório, sem aparecer nela, sem voz e sem mover. A mesma
      // assinatura da sessão; ao entrar de verdade o navegador abre outra conexão.
      if (p.observar === true) {
        s.serializeAttachment({ ...c, observador: true, last: 0 });
        this.presenca();
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
    if (a.observador) return;
    // Convidado anda, fala por balão e reage; não tranca, não admite, não mexe
    // na música, nos móveis nem nos recados da equipe.
    if (a.convidado && ["zone:lock", "zone:admit", "music:enqueue", "music:control", "music:ended", "furni:toggle", "recado:novo", "chat:changed", "conversation:summon"].includes(evento.type)) return;
    // Limite por tipo: o passo chega a cada 150 ms e a rede às vezes junta dois;
    // antes um limite único de 120 ms descartava passos (e a parada final), e
    // os outros viam a pessoa travada no lugar errado.
    const mov = evento.type === "presence:move";
    const campo = mov ? "lastMov" : "last";
    if (Date.now() - (a[campo] || 0) < (mov ? 40 : 120)) return;
    a[campo] = Date.now();
    if (evento.type === "presence:move") {
      if (
        !salas.includes(p.sala) ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y)
      )
        return;
      const zonaNova = zonaValida(p.zona);
      if (a.convidado && zonaNova) {
        // Só as zonas do convite, e sala trancada só se já estava dentro.
        if (!a.zonas.includes(zonaNova)) return;
        if (zonaNova !== a.zona && this.trancas.has(zonaNova) && !this.trancas.get(zonaNova).has(a.sub)) return;
      }
      a = {
        ...a,
        sala: p.sala,
        zona: zonaNova,
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
      // Onde não há voz (corredor, Foco), quem convida escolhe a sala do
      // encontro; dentro de uma sala com voz, a conversa é a dela.
      const zona = a.zona && a.zona !== "foco" ? a.zona : zonaValida(p.zona);
      for (const target of this.ativos()) {
        const outro = this.estado(target);
        if (
          !outro.observador &&
          outro.sub === String(p.id) &&
          outro.sub !== a.sub &&
          outro.sala === a.sala &&
          (outro.zona || "") === (a.zona || "") &&
          outro.status === "disponivel" &&
          Math.hypot(outro.x - a.x, outro.y - a.y) <= 25
        )
          this.send(target, "conversation:invite", {
            id: a.sub,
            nome: a.nome,
            sala: a.sala,
            zona,
          });
      }
      s.serializeAttachment(a);
      return;
    } else if (evento.type === "conversation:summon") {
      // Chamar alguém de longe para a sala onde você está: só um aviso para a
      // pessoa (que decide se vai); autoria e sala vêm da sessão.
      if (typeof p.id !== "string" || !/^\d{1,18}$/.test(p.id) || p.id === a.sub || !a.zona) return;
      for (const t of this.ativos()) if (!this.estado(t).observador && this.estado(t).sub === p.id)
        this.send(t, "conversation:invite", { nome: a.nome, sala: a.sala, zona: a.zona, chamado: true });
      return;
    } else if (evento.type === "zone:lock") {
      const zona = zonaValida(p.zona);
      // Só quem está na zona tranca; sala individual, só a dona ou quem administra.
      if (!zona || a.zona !== zona) return;
      if (zona.startsWith("sala-") && a.minhaSala !== zona.replace(/-andar-1$/, "") && !a.admin) return;
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
      if (!zona || a.zona !== zona || !this.trancas.has(zona) || typeof p.id !== "string" || !/^\d{1,18}$/.test(p.id)) return;
      this.trancas.get(zona).add(p.id);
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
    } else if (evento.type === "music:get") {
      if (!a.zona) return;
      this.send(s, "music:state", await this.musica(a.zona));
      return;
    } else if (evento.type === "music:enqueue" || evento.type === "music:control" || evento.type === "music:ended") {
      // Mexe na fila da sala só quem está nela; autoria da sessão.
      if (!a.zona) return;
      const m = await this.musica(a.zona);
      m.fila = [...m.fila];
      if (evento.type === "music:enqueue") {
        const fonte = fonteMusica(p.fonte);
        if (!fonte) return this.send(s, "realtime:error", { message: "Use um link de vídeo ou playlist do YouTube." });
        if (m.fila.length >= MUSICA_LIMITE) return this.send(s, "realtime:error", { message: `A fila de música chegou a ${MUSICA_LIMITE}.` });
        m.fila.push({ ...fonte, id: crypto.randomUUID(), por: a.nome });
        // Fila parada ou acabada: começa pela que entrou.
        if (!m.tocando) { m.indice = m.fila.length - 1; m.posicao = 0; m.tocando = true; }
        else m.posicao = posicaoAgora(m);
      } else if (evento.type === "music:ended") {
        // Vários navegadores avisam o fim: só o primeiro (mesma revisão) avança.
        if (p.revisao !== m.revisao) return;
        if (m.indice + 1 < m.fila.length) { m.indice++; m.posicao = 0; } else { m.tocando = false; m.posicao = 0; }
      } else {
        const acao = p.acao;
        if (acao === "tocar") { if (!m.fila.length) return; m.posicao = posicaoAgora(m); m.tocando = true; }
        else if (acao === "pausar") { m.posicao = posicaoAgora(m); m.tocando = false; }
        else if (acao === "proxima" || acao === "anterior") {
          const i = m.indice + (acao === "proxima" ? 1 : -1);
          if (i < 0 || i >= m.fila.length) return;
          m.indice = i; m.posicao = 0; m.tocando = true;
        } else if (acao === "tocarItem" || acao === "remover") {
          const i = m.fila.findIndex((f) => f.id === p.id);
          if (i < 0) return;
          if (acao === "tocarItem") { m.indice = i; m.posicao = 0; m.tocando = true; }
          else {
            m.fila.splice(i, 1);
            if (i < m.indice) m.indice--;
            else if (i === m.indice) { m.posicao = 0; if (m.indice >= m.fila.length) { m.indice = Math.max(0, m.fila.length - 1); m.tocando = false; } }
            if (!m.fila.length) m.tocando = false;
          }
        } else if (acao === "limpar") { Object.assign(m, musicaVazia(), { revisao: m.revisao }); }
        else return;
      }
      await this.mudarMusica(m, a, a.zona);
      return;
    } else if (evento.type === "screen:quality") {
      // Quem assiste pede outra qualidade a quem mostra a tela (mesma zona).
      if (typeof p.para !== "string" || !/^\d{1,18}$/.test(p.para) || !["nitida", "equilibrada", "leve"].includes(p.nivel) || !a.zona) return;
      for (const t of this.naZona(a.zona)) if (this.estado(t).sub === p.para) this.send(t, "screen:quality", { de: a.sub, nome: a.nome, nivel: p.nivel });
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
      this.balao(a, { id: a.sub, texto });
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
