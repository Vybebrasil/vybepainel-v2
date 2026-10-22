// Música das salas: como o "bot" de música do VybeChat. Toda jukebox ou
// aparelho de som (rádio, vitrola, toca-discos, DJ, caixas…) abre o nosso
// player do YouTube (Paulo, 19/10/2026; antes era só no Lounge). Cada sala tem
// a sua fila no Worker: quem está na sala cola um link (vídeo ou playlist),
// ouve junto e mexe na fila; cada navegador toca o próprio player, no mesmo
// ponto, só enquanto a pessoa está na sala. Volume é de cada um.
const ESCRITORIO_SOM = /jukebox|^hc25_6$|^hc_radio$|gramophone|recordplayer|turntable|vinyltable|_vinyl\d*$|^uni_vinyl$|^fest_c19_dj$|mixingdesk|speakers$|^trax(bronze|silver|gold)$|musicbox|^classic8_records$/;
const ESCRITORIO_MUSICA_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);
// Link (ou id) do YouTube → { kind: "video", videoId } ou { kind: "playlist", playlistId }.
function escritorioFonteMusica(texto) {
  const valor = String(texto || "").trim();
  const id = /^[a-zA-Z0-9_-]+$/;
  const playlistOk = (v) => Boolean(v) && v.length >= 10 && v.length <= 80 && id.test(v) && !/^(RD|LL|WL|LM)/.test(v);
  if (!valor) return null;
  if (valor.length === 11 && id.test(valor)) return { kind: "video", videoId: valor };
  let url;
  try { url = new URL(/^https?:\/\//i.test(valor) ? valor : "https://" + valor); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (!ESCRITORIO_MUSICA_HOSTS.has(host)) return null;
  const lista = url.searchParams.get("list");
  if (playlistOk(lista)) return { kind: "playlist", playlistId: lista };
  const partes = url.pathname.split("/").filter(Boolean);
  const video = host.endsWith("youtu.be") ? partes[0] : url.searchParams.get("v") || (["embed", "shorts", "live"].includes(partes[0]) ? partes[1] : null);
  return video && video.length === 11 && id.test(video) ? { kind: "video", videoId: video } : null;
}
// A música toca na sala inteira que tem aparelho de som (o Lounge sempre).
function escritorioSalaTemSom() {
  return escritorio.quarto === "lounge" || Boolean(escritorio.mapa?.moveisDaClasse?.(ESCRITORIO_SOM).length);
}
function escritorioNaPista() {
  return Boolean(escritorio.conectado && escritorio.zona && escritorioSalaTemSom());
}
function escritorioNomeDaSalaMusica() {
  return escritorioAmbienteDoQuarto?.(escritorio.quarto)?.nome || "sala";
}
// Mudou de sala: a fila mostrada passa a ser a da sala nova.
function escritorioMusicaDaSala() {
  if (escritorio.musicaZona !== escritorio.zona) {
    escritorio.musicaZona = escritorio.zona;
    escritorio.musica = null;
    if (escritorioNaPista()) escritorioEmitir("music:get", {});
  } else if (escritorioNaPista() && !escritorio.musica) escritorioEmitir("music:get", {});
  escritorio.naPista = escritorioNaPista();
  sincronizarMusicaEscritorio();
}
function escritorioPosicaoMusica(m, agora = Date.now()) {
  return Math.max(0, m.posicao + (m.tocando ? Math.max(0, agora - m.atualizado) / 1000 : 0));
}
function escritorioVolumeMusica() {
  try { const v = Number(localStorage.getItem("vybe-escritorio-volume-musica")); return Number.isFinite(v) && v >= 0 && v <= 100 && localStorage.getItem("vybe-escritorio-volume-musica") !== null ? v : 60; } catch { return 60; }
}
function escritorioMusicaMuda() {
  try { return localStorage.getItem("vybe-escritorio-musica-muda") === "1"; } catch { return false; }
}
function volumeMusicaEscritorio(v) {
  try { localStorage.setItem("vybe-escritorio-volume-musica", String(v)); localStorage.removeItem("vybe-escritorio-musica-muda"); } catch {}
  escritorio.player?.setVolume?.(Number(v));
  escritorio.player?.unMute?.();
}
// Silenciar a música só para você (o resto do Lounge continua ouvindo).
function silenciarMusicaEscritorio() {
  const muda = !escritorioMusicaMuda();
  try { muda ? localStorage.setItem("vybe-escritorio-musica-muda", "1") : localStorage.removeItem("vybe-escritorio-musica-muda"); } catch {}
  muda ? escritorio.player?.mute?.() : escritorio.player?.unMute?.();
  desenharInfoMusicaEscritorio();
}
// API do player do YouTube: carrega só quando alguém entra no Lounge com música.
function escritorioCarregarYoutube() {
  if (window.YT?.Player) return Promise.resolve();
  if (escritorio.carregandoYoutube) return escritorio.carregandoYoutube;
  escritorio.carregandoYoutube = new Promise((ok, erro) => {
    const antes = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { antes?.(); ok(); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => { escritorio.carregandoYoutube = null; erro(new Error("O YouTube não carregou.")); };
    document.head.append(s);
  });
  return escritorio.carregandoYoutube;
}
// Elemento da música: fica fora do redesenho da tela (o player não pode ser recriado).
function escritorioElementoMusica() {
  if (escritorio.musicaEl) return escritorio.musicaEl;
  const el = document.createElement("section");
  el.id = "office-musica";
  el.className = "ofc-musica";
  el.setAttribute("aria-label", "Música da sala");
  el.hidden = true;
  el.innerHTML = `<div class="ofc-musica-topo" title="Arraste para mudar de lugar"><b>${escritorioIcone("musica")}Música</b><span><button type="button" class="ofc-x ofc-encaixar" onclick="encaixarCaixaEscritorio('office-musica')" aria-label="Voltar o player para a coluna" title="Voltar para a coluna da direita">↘</button><button type="button" class="ofc-x" onclick="minimizarMusicaEscritorio()" aria-label="Minimizar o player" title="Minimizar">–</button></span></div><div class="ofc-musica-player"><div id="office-yt"></div></div><div class="ofc-musica-info"></div>`;
  escritorio.musicaEl = el;
  try { if (localStorage.getItem("vybe-escritorio-musica-mini") === "1") el.classList.add("mini"); } catch {}
  return el;
}
function chaveMusica(m) {
  const f = m?.fila?.[m.indice];
  return f && m.tocando ? `${f.id}|${m.revisao}` : "";
}
// Aplica o estado da fila no player local (sem recriar o player).
async function sincronizarMusicaEscritorio() {
  const m = escritorio.musica, el = escritorioElementoMusica();
  const aqui = escritorioNaPista();
  el.hidden = !(aqui && m?.fila?.length);
  desenharInfoMusicaEscritorio();
  const atual = m?.fila?.[m.indice];
  if (!aqui || !atual) { escritorio.player?.pauseVideo?.(); escritorio.musicaTocando = ""; return; }
  if (!m.tocando) { escritorio.player?.pauseVideo?.(); escritorio.musicaTocando = ""; return; }
  try { await escritorioCarregarYoutube(); } catch (e) { escritorioAviso(e.message); return; }
  const inicio = Math.floor(escritorioPosicaoMusica(m));
  const carregar = (p) => atual.kind === "playlist"
    ? p.loadPlaylist({ list: atual.playlistId, listType: "playlist", index: 0, startSeconds: inicio })
    : p.loadVideoById({ videoId: atual.videoId, startSeconds: inicio });
  const chave = chaveMusica(m);
  if (!escritorio.player) {
    escritorio.musicaTocando = chave;
    escritorio.player = new YT.Player("office-yt", {
      width: 192, height: 108,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: (e) => { e.target.setVolume(escritorioVolumeMusica()); if (escritorioMusicaMuda()) e.target.mute(); carregar(e.target); },
        onStateChange: (e) => {
          // Fim do vídeo (ou da playlist inteira): avisa o Worker uma vez por revisão.
          if (e.data === YT.PlayerState.ENDED) {
            const mm = escritorio.musica;
            const ultimo = mm?.fila?.[mm.indice];
            if (ultimo?.kind === "playlist" && e.target.getPlaylistIndex?.() < (e.target.getPlaylist?.()?.length || 0) - 1) return;
            if (mm) escritorioEmitir("music:ended", { revisao: mm.revisao });
          }
          if (e.data === YT.PlayerState.PLAYING) { escritorio.musicaBloqueada = false; desenharInfoMusicaEscritorio(); }
        },
        onAutoplayBlocked: () => { escritorio.musicaBloqueada = true; desenharInfoMusicaEscritorio(); },
        onError: () => escritorioAviso("Esse vídeo do YouTube não pode tocar aqui. Pule para a próxima."),
      },
    });
    return;
  }
  if (escritorio.musicaTocando !== chave) {
    escritorio.musicaTocando = chave;
    carregar(escritorio.player);
  } else if (escritorio.player.getPlayerState?.() !== YT.PlayerState.PLAYING) escritorio.player.playVideo?.();
}
function desenharInfoMusicaEscritorio() {
  const el = escritorio.musicaEl?.querySelector(".ofc-musica-info");
  if (!el) return;
  const m = escritorio.musica, f = m?.fila?.[m.indice];
  el.innerHTML = `<b>${f ? (m.tocando ? "Tocando" : "Pausada") : "Fila vazia"}</b><small>${f ? `${f.kind === "playlist" ? "Playlist" : "Música"} ${m.indice + 1} de ${m.fila.length} · de ${safeText(String(f.por || "").split(" ")[0])}` : ""}</small>
${escritorio.musicaBloqueada ? '<button type="button" class="ofc-primario" onclick="escritorio.player?.playVideo?.()">Clique para ouvir</button>' : ""}
<div class="ofc-musica-ctl"><button type="button" onclick="controleMusicaEscritorio('anterior')" aria-label="Anterior" ${m?.indice > 0 ? "" : "disabled"}>${escritorioIcone("voltar")}</button><button type="button" onclick="controleMusicaEscritorio('${m?.tocando ? "pausar" : "tocar"}')" aria-label="${m?.tocando ? "Pausar" : "Tocar"}">${m?.tocando ? "Pausar" : "Tocar"}</button><button type="button" onclick="controleMusicaEscritorio('proxima')" aria-label="Próxima" ${m && m.indice + 1 < m.fila.length ? "" : "disabled"}>${escritorioIcone("avancar")}</button></div>
<div class="ofc-musica-vol"><button type="button" aria-pressed="${escritorioMusicaMuda()}" onclick="silenciarMusicaEscritorio()">${escritorioMusicaMuda() ? "Ouvir" : "Silenciar"}</button><input type="range" min="0" max="100" value="${escritorioMusicaMuda() ? 0 : escritorioVolumeMusica()}" oninput="volumeMusicaEscritorio(this.value);if(this.previousElementSibling.getAttribute('aria-pressed')==='true')desenharInfoMusicaEscritorio()" aria-label="Volume da música (só para você)"></div>
<button type="button" class="ofc-secundario" onclick="abrirMusicaEscritorio()">Fila e link</button>`;
}
function controleMusicaEscritorio(acao, id) {
  if (!escritorioNaPista()) return escritorioAviso("Esta sala não tem aparelho de som. A música toca nas salas com jukebox, rádio ou vitrola.");
  escritorioEmitir("music:control", { acao, ...(id ? { id } : {}) });
}
function receberMusicaEscritorio(estado) {
  // Estado de outra sala (chegou depois da troca de sala): não vale aqui.
  // Estado sem sala vem do Worker antigo, que só tinha a fila do Lounge.
  if (estado?.zona ? estado.zona !== escritorio.zona : escritorio.zona !== "lounge") return;
  escritorio.musica = estado;
  sincronizarMusicaEscritorio();
  const lista = document.getElementById("office-lista-salas");
  if (lista && !lista.hidden) lista.innerHTML = escritorioListaSalasHtml();
  if (document.getElementById("office-musica-fila")) desenharFilaMusicaEscritorio();
}
// Painel da jukebox: colar link, ver a fila, tocar uma, tirar uma.
function abrirMusicaEscritorio() {
  if (!escritorio.conectado) return escritorioAviso("Entre no escritório para usar a música.");
  if (!escritorioNaPista()) return escritorioAviso("Esta sala não tem aparelho de som. A música toca nas salas com jukebox, rádio ou vitrola.");
  let d = document.getElementById("office-musica-painel");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "office-musica-painel";
    d.className = "ofc-dialogo ofc-musica-painel";
    d.setAttribute("aria-labelledby", "office-musica-titulo");
    document.body.append(d);
  }
  d.innerHTML = `<div class="ofc-dialogo-topo"><h3 id="office-musica-titulo">Música · ${safeText(escritorioNomeDaSalaMusica())}</h3><button type="button" class="ofc-x" onclick="this.closest('dialog').close()" aria-label="Fechar">×</button></div>
<p class="ofc-nota">Quem está nesta sala ouve junto. O volume é só seu.</p>
<form class="ofc-musica-form" onsubmit="event.preventDefault();adicionarMusicaEscritorio(this)"><input name="link" placeholder="Cole um link do YouTube (vídeo ou playlist)" aria-label="Link do YouTube" autocomplete="off" required><button class="workflow-primary">Pôr na fila</button></form>
<p class="ofc-erro" id="office-musica-erro" role="alert"></p>
<div id="office-musica-fila"></div>`;
  desenharFilaMusicaEscritorio();
  if (!d.open) d.showModal();
  if (!escritorio.musica) escritorioEmitir("music:get", {});
  d.querySelector("input")?.focus();
}
function desenharFilaMusicaEscritorio() {
  const el = document.getElementById("office-musica-fila");
  if (!el) return;
  const m = escritorio.musica;
  if (!m) { el.innerHTML = '<p class="ofc-nota">Carregando a fila…</p>'; return; }
  if (!m.fila.length) { el.innerHTML = '<p class="ofc-nota">A fila está vazia. Cole um link acima para começar.</p>'; return; }
  el.innerHTML = `<ol class="ofc-musica-lista">${m.fila.map((f, i) => `<li${i === m.indice ? ' aria-current="true"' : ""}><img src="${f.kind === "video" ? `https://i.ytimg.com/vi/${f.videoId}/default.jpg` : ""}" alt="" width="48" height="36" loading="lazy" ${f.kind === "video" ? "" : "hidden"}><span><b>${i === m.indice ? (m.tocando ? "Tocando agora" : "Pausada") : f.kind === "playlist" ? "Playlist" : "Música"}</b><small>${f.kind === "playlist" ? "Playlist do YouTube" : "Vídeo do YouTube"} · de ${safeText(String(f.por || ""))}</small></span><button type="button" onclick="controleMusicaEscritorio('tocarItem','${f.id}')" ${i === m.indice && m.tocando ? "disabled" : ""}>Tocar</button><button type="button" class="perigo" onclick="controleMusicaEscritorio('remover','${f.id}')" aria-label="Tirar da fila">Tirar</button></li>`).join("")}</ol>
<div class="ofc-musica-rodape"><button type="button" class="ofc-secundario" onclick="if(confirm('Limpar a fila inteira?'))controleMusicaEscritorio('limpar')">Limpar fila</button></div>`;
}
function adicionarMusicaEscritorio(form) {
  const erro = document.getElementById("office-musica-erro");
  const fonte = escritorioFonteMusica(form.link.value);
  if (!fonte) { erro.textContent = "Esse link não é de um vídeo ou playlist do YouTube."; return; }
  if (!escritorioNaPista()) { erro.textContent = "Esta sala não tem aparelho de som."; return; }
  erro.textContent = "";
  escritorioEmitir("music:enqueue", { fonte });
  form.reset();
}

// O player é uma das caixas soltas (escritorioPrepararCaixas): arrasta pelo
// topo e fica onde a pessoa deixou; minimizado, a música continua tocando.
function minimizarMusicaEscritorio() {
  const el = escritorio.musicaEl;
  if (!el) return;
  el.classList.toggle("mini");
  try { el.classList.contains("mini") ? localStorage.setItem("vybe-escritorio-musica-mini", "1") : localStorage.removeItem("vybe-escritorio-musica-mini"); } catch {}
}
// Atalho (lista do celular): vai para o Lounge, onde a música toca.
function irParaMusicaEscritorio() {
  escritorioIrParaAmbiente("lounge", true);
}
