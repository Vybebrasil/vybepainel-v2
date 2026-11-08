// vybe-mundo-agentes.js — Agentes da Vybe em tela cheia (Paulo, 08/11/2026: "eu preciso clicar no agente e ver o que ele
// está fazendo no dia a dia e poder dar novas atribuições a ele por dentro do sistema mesmo").
//
// Quem é quem: a planta do Prédio (mundo/planta.mjs, a mesma de core/agentes.js no VYBES), andar por andar.
// O que faz agora e o que fez: a atividade real que a central do VYBES registra (mundoVoxel.atividadeDoAgenteHtml).
// Rotina: o que roda de verdade com horário (rotinas.js / noite.js, vindo da central) + as atribuições recorrentes.
// Atribuições: guardadas na central (core/atribuicoes-agentes.js). Só os donos dão, pausam e removem. Quando vencem, viram
// proposta do agente e esperam a aprovação de um dono (modo sombra): nada sai no WhatsApp nem grava no Vybe OS por aqui.
(() => {
  const G = window;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DONOS = ['paulo', 'vinicius', 'ewerton', 'deivid'];
  const primeiro = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().split(/\s+/)[0];
  const souDono = () => { const u = typeof G.operadorDoTopo === 'function' ? G.operadorDoTopo() : null; return Boolean(u && DONOS.includes(primeiro(u.name || u.nome))); };
  const ESTADO_SETOR = { ativo: ['Ativo', 'Já trabalha hoje.', '#18A957'], sombra: ['Sombra', 'Só propõe; um dono aprova.', '#0D74CE'], planejado: ['Planejado', 'Falta ligar as ferramentas: hoje não roda.', '#7A8B82'] };
  const ANDAR = (n) => (n === 0 ? 'Térreo' : n === 6 ? 'Terraço' : n + 'º andar');
  const FREQ = { uma_vez: 'Uma vez', diaria: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' };
  const st = { aberto: false, setor: 'orquestrador', msg: '', enviando: false };
  let raiz = null;

  const mv = () => G.mundoVoxel || {};
  const planta = () => (mv().planta?.() || []).filter((a) => a.setores.some((s) => s.agente));
  const fonte = () => mv().fonteAgentes?.()?.ler?.() || { dados: null };
  const quando = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { timeZone: 'America/Bahia', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('.', ''); };

  function setores() { return planta().flatMap((a) => a.setores.filter((s) => s.agente).map((s) => ({ ...s, andar: a }))); }

  function listaHtml() {
    return planta().map((a) => `<div class="vga-andar"><small>${esc(ANDAR(a.nivel))} · ${esc(a.nome)}</small>${a.setores.filter((s) => s.agente).map((s) => {
      const E = mv().estadoDoAgente?.(s.id) || {}, [rot, , cor] = ESTADO_SETOR[s.estado] || ESTADO_SETOR.planejado;
      const ini = String(s.agente).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      return `<button type="button" class="vga-linha${s.id === st.setor ? ' sel' : ''}" data-vga-setor="${esc(s.id)}">
        <span class="vga-av" style="--e:${esc(E.cor || cor)}">${esc(ini)}</span>
        <span class="vga-meio"><b>${esc(s.agente)}</b><small>${esc(s.funcao || s.nome)} · ${esc(s.nome)}</small></span>
        <em style="--c:${cor}">${esc(rot)}</em></button>`;
    }).join('')}</div>`).join('');
  }

  function detalheHtml() {
    const s = setores().find((x) => x.id === st.setor) || setores()[0]; if (!s) return '<p class="vga-vazio">Carregando a planta do prédio…</p>';
    st.setor = s.id;
    const f = fonte(), dados = f.dados || {}, [rot, expl, cor] = ESTADO_SETOR[s.estado] || ESTADO_SETOR.planejado;
    const atribs = Array.isArray(dados.atribuicoes) ? dados.atribuicoes.filter((a) => a.setor === s.id) : null;
    const fixas = (dados.rotinas?.[s.id] || []);
    const recorrentes = (atribs || []).filter((a) => a.estado === 'ativa' && a.frequencia !== 'uma_vez');
    const rotina = [...fixas.map((r) => ({ h: r.horario, t: r.texto, tipo: 'fixa' })), ...recorrentes.map((a) => ({ h: a.horario, t: `${a.texto}${a.cliente ? ' · ' + a.cliente : ''}`, tipo: (FREQ[a.frequencia] || '').toLowerCase() }))]
      .sort((a, b) => (a.h === 'madrugada' ? '00:00' : String(a.h)).localeCompare(b.h === 'madrugada' ? '00:00' : String(b.h)));
    const dono = souDono();
    const clientes = (typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : []).filter((c) => c.ativo !== false && !/inativ/i.test(String(c.status || ''))).map((c) => c.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const semCentral = f.erro || !f.dados;
    return `<div class="vga-cab"><span class="vga-av grande" style="--e:${esc((mv().estadoDoAgente?.(s.id) || {}).cor || cor)}">${esc(String(s.agente).slice(0, 2).toUpperCase())}</span>
        <span><small>${esc(ANDAR(s.andar.nivel))} · ${esc(s.andar.nome)} · ${esc(s.nome)}</small><h3>${esc(s.agente)} <i>${esc(s.funcao || '')}</i></h3>
        <span class="vga-estado" style="--c:${cor}">${esc(rot)}</span><span class="vga-expl">${esc(expl)}</span></span></div>
      <p class="vga-papel">${esc(s.papel || '')}</p>
      ${(s.skills || []).length ? `<div class="vga-skills">${s.skills.map((k) => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
      <div class="vga-colunas">
        <section class="vga-bloco"><h4>O que está fazendo</h4>
          ${semCentral ? '<p class="vga-vazio">Sem leitura da central do VYBES agora: a atividade aparece quando ela responder.</p>' : `<div class="vga-atividade">${mv().atividadeDoAgenteHtml?.(s.id) || ''}</div>`}
        </section>
        <section class="vga-bloco"><h4>Rotina do dia</h4>
          ${rotina.length ? `<ul class="vga-rotina">${rotina.map((r) => `<li><time>${esc(r.h === 'madrugada' ? 'madrugada' : r.h)}</time><span>${esc(r.t)}</span><em>${esc(r.tipo === 'fixa' ? 'roda hoje' : r.tipo)}</em></li>`).join('')}</ul>`
            : `<p class="vga-vazio">${s.estado === 'planejado' ? 'Sem rotina: as ferramentas deste setor ainda não estão ligadas.' : 'Sem rotina com horário. Dê uma atribuição recorrente abaixo.'}</p>`}
        </section>
      </div>
      <section class="vga-bloco"><h4>Atribuições</h4>
        ${atribs === null ? '<p class="vga-vazio">A central do VYBES ainda não guarda atribuições. Elas passam a valer depois que o VYBES for reiniciado com a versão nova.</p>'
          : atribs.length ? `<ul class="vga-atrib">${atribs.map((a) => `<li class="${esc(a.estado)}"><span><b>${esc(a.texto)}</b><small>${esc(FREQ[a.frequencia] || a.frequencia)}${a.frequencia !== 'uma_vez' ? ' às ' + esc(a.horario) : ''}${a.cliente ? ' · ' + esc(a.cliente) : ''} · ${esc(a.estado === 'ativa' ? (a.proxima ? 'próxima ' + quando(a.proxima) : 'ativa') : a.estado)}${a.vezes ? ' · rodou ' + a.vezes + 'x' : ''}${a.criadaPor ? ' · por ' + esc(a.criadaPor) : ''}</small></span>
              ${dono ? `<span class="vga-acoes">${a.estado === 'ativa' ? `<button type="button" data-vga-acao="pausar" data-vga-id="${esc(a.id)}">Pausar</button>` : a.estado === 'pausada' ? `<button type="button" data-vga-acao="retomar" data-vga-id="${esc(a.id)}">Retomar</button>` : ''}<button type="button" data-vga-acao="remover" data-vga-id="${esc(a.id)}">Remover</button></span>` : ''}</li>`).join('')}</ul>`
          : '<p class="vga-vazio">Nenhuma atribuição ainda.</p>'}
        ${dono && atribs !== null ? `<form class="vga-form" data-vga-form>
          <label class="largo"><span>O que ${esc(s.agente)} deve fazer</span><textarea name="texto" rows="2" maxlength="500" required placeholder="Ex.: revisar as legendas das peças que saem amanhã e apontar erro de português"></textarea></label>
          <label><span>Cliente (opcional)</span><select name="cliente"><option value="">Todos / nenhum</option>${clientes.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
          <label><span>Quando</span><select name="frequencia">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}"${k === 'diaria' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label><span>Horário</span><input type="time" name="horario" value="09:00" required></label>
          <button type="submit" class="vga-principal"${st.enviando ? ' disabled' : ''}>Atribuir</button>
          <p class="vga-nota">Modo sombra: quando vencer, vira proposta de ${esc(s.agente)} e espera a aprovação de um dono. ${s.estado === 'planejado' ? 'Este setor ainda não tem as ferramentas ligadas: a proposta fica registrada, mas ninguém executa sozinho.' : ''}</p>
        </form>` : !dono ? '<p class="vga-nota">Só os donos dão atribuições aos agentes.</p>' : ''}
        ${st.msg ? `<p class="vga-msg" role="status">${esc(st.msg)}</p>` : ''}
      </section>`;
  }

  function pintar() {
    if (!st.aberto) { if (raiz) raiz.hidden = true; return; }
    if (!raiz) {
      raiz = document.createElement('section'); raiz.id = 'vv-agentes'; raiz.className = 'vv-ag'; raiz.setAttribute('aria-label', 'Agentes da Vybe');
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('submit', aoEnviar);
      document.body.append(raiz);
    }
    const f = fonte();
    raiz.innerHTML = `<div class="vga-topo"><span><small>Prédio da Vybe</small><h2>Agentes</h2><p>${f.dados ? `Central do VYBES · leitura às ${new Date(f.atualizadoEm || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : f.erro ? 'Sem sinal da central do VYBES agora' : 'Consultando a central do VYBES…'}</p></span>
      <button type="button" class="vga-fechar" data-vga-fechar aria-label="Fechar">×</button></div>
      <div class="vga-corpo"><nav class="vga-lista" aria-label="Agentes por andar">${listaHtml()}</nav><div class="vga-detalhe">${detalheHtml()}</div></div>`;
    raiz.hidden = false;
  }

  async function chamar(corpo) {
    st.enviando = true; st.msg = ''; pintar();
    try {
      const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'atribuir', ...corpo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível salvar agora.');
      st.msg = corpo.acao === 'criar' ? 'Atribuição registrada.' : 'Atribuição atualizada.';
      await mv().fonteAgentes?.()?.atualizar?.(true);
    } catch (e) { st.msg = e.message; }
    finally { st.enviando = false; pintar(); }
  }
  function aoClicar(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-vga-fechar')) { fechar(); return; }
    if (b.dataset.vgaSetor) { st.setor = b.dataset.vgaSetor; st.msg = ''; pintar(); return; }
    if (b.dataset.vgaAcao) { if (b.dataset.vgaAcao === 'remover' && !confirm('Remover esta atribuição?')) return; chamar({ acao: b.dataset.vgaAcao, id: b.dataset.vgaId }); }
  }
  function aoEnviar(e) {
    const f = e.target.closest('[data-vga-form]'); if (!f) return; e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    chamar({ acao: 'criar', setor: st.setor, texto: v.texto, cliente: v.cliente, frequencia: v.frequencia, horario: v.horario });
  }
  function abrir(setor) {
    if (setor) st.setor = setor;
    st.aberto = true; st.msg = '';
    pintar();
    Promise.resolve(mv().garantirModulo?.()).then(() => { mv().fonteAgentes?.()?.atualizar?.(true)?.then?.(pintar); pintar(); });
  }
  function fechar() { st.aberto = false; pintar(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.aberto && !e.target.closest?.('input,textarea,select')) fechar(); });
  G.VybeAgentes = { abrir, fechar, aberto: () => st.aberto, repintar: () => { if (st.aberto && !raiz?.contains(document.activeElement)) pintar(); } };
})();
