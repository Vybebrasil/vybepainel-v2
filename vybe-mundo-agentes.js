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
  // Dono pela informação do servidor (sessão, server/donos.js), não pelo primeiro nome. A central confere de novo.
  const souDono = () => { try { return typeof G.souDonoDaSessao === 'function' && G.souDonoDaSessao(); } catch { return false; } };
  const ESTADO_SETOR = { ativo: ['Ativo', 'Já trabalha hoje.', '#18A957'], sombra: ['Sombra', 'Só propõe; um dono aprova.', '#0D74CE'], planejado: ['Planejado', 'Falta ligar as ferramentas: hoje não roda.', '#7A8B82'] };
  const ANDAR = (n, id) => (n === 0 ? 'Térreo' : id === 'terraco' ? 'Terraço' : n + 'º andar');
  const FREQ = { uma_vez: 'Uma vez', diaria: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' };
  const st = { aberto: false, setor: 'orquestrador', msg: '', enviando: false, perfis: {} };
  let raiz = null;
  // Perfil completo (Paulo, 08/11/2026: "ver o que cada um tá fazendo certo, desligar uma coisa da rotina, analisar tudo que
  // ele fez, tá fazendo, histórico, projeção"). Vem pronto da central (core/perfil-agente.js); aqui só desenha.
  const MOTOR = { qwen: ['Qwen', '#8B7DFF', 'O modelo local (Qwen 3.5 35B) pensa e escreve.'], logica: ['Lógica', '#0D74CE', 'Regra fixa no código: mesma entrada, mesma saída.'],
    misto: ['Lógica + Qwen', '#8E4EC6', 'A regra fixa filtra e o Qwen escreve.'], vybe_os: ['Vybe OS', '#7A8B82', 'Texto montado no servidor do Vybe OS.'], nao_mapeado: ['Não mapeada', '#D13D36', 'Sem origem conferida.'] };
  function lerPerfil(setor, forcar = false) {
    const p = st.perfis[setor] ||= { dados: null, erro: '', em: 0, lendo: null };
    if (p.lendo || (!forcar && Date.now() - p.em < 30e3)) return p.lendo || Promise.resolve();
    p.em = Date.now();
    p.lendo = fetch(`/api/painel?area=vybes&etapa=perfil&setor=${encodeURIComponent(setor)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.perfil) throw new Error(d.error || 'Sem perfil da central agora.'); p.dados = d; p.erro = ''; })
      .catch((e) => { p.erro = e.message; }).finally(() => { p.lendo = null; if (st.aberto && st.setor === setor) pintar(); });
    return p.lendo;
  }
  // "hoje 19:31", "amanhã 08:00", "qua 08:00": cabe na coluna da hora.
  const horaCurta = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const dia = (x) => x.toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' }), hoje = dia(new Date()), am = dia(new Date(Date.now() + 864e5));
    const h = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit' }); return `${dia(d) === hoje ? 'hoje' : dia(d) === am ? 'amanhã' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia', weekday: 'short' }).replace('.', '')} ${h}`; };
  const pct = (n) => n == null ? '—' : `${n}%`;
  function numerosHtml(P) {
    const n = P.numeros || {}, pj = P.projecao || {};
    return `<div class="vga-numeros">
      <span><b>${n.abertos ?? 0}</b><small>em aberto${n.altas ? ` · <em>${n.altas} urgente${n.altas > 1 ? 's' : ''}</em>` : ''}</small></span>
      <span><b>${n.resolvidos7d ?? 0}</b><small>resolvidos em 7 dias</small></span>
      <span title="Resolvidos ÷ (resolvidos + marcados como errado) em 7 dias"><b>${pct(n.acerto)}</b><small>acerto${n.errados7d ? ` · ${n.errados7d} errado${n.errados7d > 1 ? 's' : ''}` : ''}</small></span>
      <span><b>${n.horasAteResolver == null ? '—' : n.horasAteResolver + ' h'}</b><small>até resolver (mediana)</small></span>
    </div><p class="vga-projecao"><b>Projeção:</b> ${esc(pj.tendencia || 'sem dados ainda')} · ${esc(pj.carga || '')}${pj.subirNivel ? ` · <em>${esc(pj.subirNivel)}</em>` : ''}</p>`;
  }
  function achadosHtml(P, dono) {
    const ab = P.achados?.abertos || [], fe = P.achados?.resolvidos || [];
    const linha = (a, aberto) => `<li class="g-${esc(a.gravidade)}"><span><b>${esc(a.fato)}</b><small>${a.cliente ? esc(a.cliente) + ' · ' : ''}${esc(a.prova)}${a.sugestao ? ' · ' + esc(a.sugestao) : ''}${aberto ? ` · desde ${esc(quando(a.primeiraVez))}${a.vezes > 1 ? ` · visto ${a.vezes}x` : ''}` : ` · ${esc(a.comoFechou || a.estado)} ${esc(quando(a.fechadoEm))}`}</small>
        ${a.ficha ? `<details><summary>Ficha para quem faz</summary><pre>${esc(a.ficha)}</pre></details>` : ''}${a.versaoSugerida ? `<details><summary>Versão sugerida pelo Qwen</summary><pre>${esc(a.versaoSugerida)}</pre></details>` : ''}</span>
        ${aberto && dono ? `<span class="vga-acoes"><button type="button" data-vga-achado="resolvido" data-vga-chave="${esc(a.chave)}">Resolvido</button><button type="button" data-vga-achado="ignorar" data-vga-chave="${esc(a.chave)}">Ignorar</button><button type="button" data-vga-achado="errado" data-vga-chave="${esc(a.chave)}" title="O agente se enganou: conta no acerto dele">Estava errado</button></span>` : ''}</li>`;
    return `<section class="vga-bloco"><h4>O que ele achou<span class="vga-pilula">${ab.length}</span></h4>
      ${ab.length ? `<ul class="vga-achados">${ab.map((a) => linha(a, true)).join('')}</ul>` : '<p class="vga-vazio">Nada em aberto. Os achados aparecem quando as rotinas dele rodam.</p>'}
      ${fe.length ? `<details class="vga-hist"><summary>Resolvidos e fechados (${fe.length})</summary><ul class="vga-achados">${fe.map((a) => linha(a, false)).join('')}</ul></details>` : ''}</section>`;
  }
  function rotinasHtml(P, dono) {
    const rs = P.rotinas || [];
    if (!rs.length) return '';
    return `<section class="vga-bloco"><h4>Rotinas<span class="vga-pilula">${rs.filter((r) => r.ligada).length}/${rs.length}</span></h4><ul class="vga-rotinas">${rs.map((r) => {
      const [nm, cor, expl] = MOTOR[r.motor] || MOTOR.nao_mapeado;
      return `<li class="${r.ligada ? '' : 'off'}"><time>${esc(r.quando)}</time><span><b>${esc(r.texto)}${r.nova ? ' <i>nova</i>' : ''}</b>
        <small>${r.evita ? 'Evita: ' + esc(r.evita) + ' · ' : ''}<em class="vga-motor" style="--c:${cor}" title="${esc(expl)}">${esc(nm)}</em>${(r.leNomes || []).length ? ' · lê ' + r.leNomes.map(esc).join(', ') : ''}${(r.geraNomes || []).length ? ' → ' + r.geraNomes.map(esc).join(', ') : ''}</small>
        <small class="vga-codigo">${esc(r.codigo || '')}${r.ultimaRodada ? ` · última rodada ${esc(quando(r.ultimaRodada.em))}` : ''}${!r.ligada && r.desligadaPor ? ` · desligada por ${esc(r.desligadaPor)}` : ''}</small></span>
        ${dono && !r.fixa ? `<button type="button" class="vga-chave${r.ligada ? ' on' : ''}" role="switch" aria-checked="${r.ligada}" data-vga-rotina="${esc(r.id)}" data-vga-ligar="${r.ligada ? 'desligar' : 'ligar'}" aria-label="${r.ligada ? 'Desligar' : 'Ligar'} ${esc(r.texto)}"><i></i></button>` : r.fixa ? '<em class="vga-fixa">fixa</em>' : ''}</li>`;
    }).join('')}</ul></section>`;
  }
  function projecaoHtml(P) {
    const px = (P.projecao?.proximas || []).slice(0, 8), h = Object.entries(P.historico || {}).sort();
    const max = Math.max(1, ...h.map(([, v]) => v.concluidas + v.falhas));
    return `<section class="vga-bloco"><h4>Próximas execuções</h4>${px.length ? `<ul class="vga-rotina vga-proximas">${px.map((x) => `<li><time>${esc(horaCurta(x.em))}</time><span>${esc(x.texto)}</span><em>${x.tipo === 'atribuicao' ? 'atribuição' : 'rotina'}</em></li>`).join('')}</ul>` : '<p class="vga-vazio">Nada marcado até amanhã.</p>'}
      <h4 class="vga-h4-sep">Histórico (14 dias)</h4>${h.length ? `<div class="vga-barras" role="img" aria-label="Execuções por dia">${h.map(([dia, v]) => `<span title="${esc(dia.slice(8, 10) + '/' + dia.slice(5, 7))}: ${v.concluidas} concluídas, ${v.falhas} falhas, ${v.aguardando} aguardando"><i style="height:${Math.round(v.concluidas / max * 100)}%"></i>${v.falhas ? `<i class="f" style="height:${Math.max(4, Math.round(v.falhas / max * 100))}%"></i>` : ''}<small>${esc(dia.slice(8, 10))}</small></span>`).join('')}</div>` : '<p class="vga-vazio">Sem execução registrada nos últimos 14 dias.</p>'}</section>`;
  }
  function licoesHtml(P, dono) {
    const ls = P.licoes || []; if (!ls.length) return '';
    return `<section class="vga-bloco"><h4>Lições (o que se repetiu)</h4><ul class="vga-achados">${ls.map((l) => `<li><span><b>${esc(l.texto)}</b><small>${esc(l.estado === 'em_revisao' ? 'em revisão' : l.estado)}${l.prova ? ' · ' + esc(l.prova) : ''}</small></span>
      ${dono && l.estado === 'em_revisao' ? `<span class="vga-acoes"><button type="button" data-vga-licao="incorporar" data-vga-id="${esc(l.id)}">Vale sempre</button><button type="button" data-vga-licao="contestar" data-vga-id="${esc(l.id)}">Não vale</button></span>` : ''}</li>`).join('')}</ul></section>`;
  }

  const mv = () => G.mundoVoxel || {};
  const planta = () => (mv().planta?.() || []).filter((a) => a.setores.some((s) => s.agente));
  const fonte = () => mv().fonteAgentes?.()?.ler?.() || { dados: null };
  const quando = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { timeZone: 'America/Bahia', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('.', ''); };

  function setores() { return planta().flatMap((a) => a.setores.filter((s) => s.agente).map((s) => ({ ...s, andar: a }))); }

  function listaHtml() {
    return planta().map((a) => `<div class="vga-andar"><small>${esc(ANDAR(a.nivel, a.id))} · ${esc(a.nome)}</small>${a.setores.filter((s) => s.agente).map((s) => {
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
    void lerPerfil(s.id);
    const pf = st.perfis[s.id] || {}, P = pf.dados?.perfil || null;
    return `<div class="vga-cab"><span class="vga-av grande" style="--e:${esc((mv().estadoDoAgente?.(s.id) || {}).cor || cor)}">${esc(String(s.agente).slice(0, 2).toUpperCase())}</span>
        <span><small>${esc(ANDAR(s.andar.nivel))} · ${esc(s.andar.nome)} · ${esc(s.nome)}</small><h3>${esc(s.agente)} <i>${esc(s.funcao || '')}</i></h3>
        <span class="vga-estado" style="--c:${cor}">${esc(rot)}</span><span class="vga-expl">${esc(expl)}</span></span></div>
      <p class="vga-papel">${esc(s.papel || '')}</p>
      ${(s.skills || []).length ? `<div class="vga-skills">${s.skills.map((k) => `<span>${esc(k)}</span>`).join('')}</div>` : ''}
      ${P ? numerosHtml(P) : `<p class="vga-nota">${esc(pf.erro || 'Lendo o perfil na central do VYBES…')}</p>`}
      <div class="vga-colunas">
        <section class="vga-bloco"><h4>O que está fazendo</h4>
          ${semCentral ? '<p class="vga-vazio">Sem leitura da central do VYBES agora: a atividade aparece quando ela responder.</p>' : `<div class="vga-atividade">${mv().atividadeDoAgenteHtml?.(s.id) || ''}</div>`}
        </section>
        ${P ? projecaoHtml(P) : `<section class="vga-bloco"><h4>Rotina do dia</h4>
          ${rotina.length ? `<ul class="vga-rotina">${rotina.map((r) => `<li><time>${esc(r.h === 'madrugada' ? 'madrugada' : r.h)}</time><span>${esc(r.t)}</span><em>${esc(r.tipo === 'fixa' ? 'roda hoje' : r.tipo)}</em></li>`).join('')}</ul>`
            : `<p class="vga-vazio">${s.estado === 'planejado' ? 'Sem rotina: as ferramentas deste setor ainda não estão ligadas.' : 'Sem rotina com horário. Dê uma atribuição recorrente abaixo.'}</p>`}
        </section>`}
      </div>
      ${P ? achadosHtml(P, dono) + rotinasHtml(P, dono) + licoesHtml(P, dono) : ''}
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
        </form>` : !dono ? '<p class="vga-nota">Só os donos (Paulo, Vinícius, Ewerton e Deivid) dão atribuições aos agentes.</p>' : ''}
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
    // A tela repinta a cada leitura da central (5 s): guarda a rolagem e os detalhes abertos do mesmo agente.
    const det0 = raiz.querySelector('.vga-detalhe'), lista0 = raiz.querySelector('.vga-lista');
    const mesmo = raiz.dataset.setor === st.setor, rolagem = mesmo && det0 ? det0.scrollTop : 0, rolagemLista = lista0 ? lista0.scrollTop : 0;
    const abertos = mesmo ? [...raiz.querySelectorAll('.vga-detalhe details[open] > summary')].map((s) => s.textContent) : [];
    raiz.dataset.setor = st.setor;
    raiz.innerHTML = `<div class="vga-topo"><span><small>Prédio da Vybe</small><h2>Agentes</h2><p>${f.dados ? `Central do VYBES · leitura às ${new Date(f.atualizadoEm || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : f.erro ? 'Sem sinal da central do VYBES agora' : 'Consultando a central do VYBES…'}</p></span>
      <button type="button" class="vga-fechar" data-vga-fechar aria-label="Fechar">×</button></div>
      <div class="vga-corpo"><nav class="vga-lista" aria-label="Agentes por andar">${listaHtml()}</nav><div class="vga-detalhe">${detalheHtml()}</div></div>`;
    raiz.hidden = false;
    if (abertos.length) raiz.querySelectorAll('.vga-detalhe details > summary').forEach((s) => { if (abertos.includes(s.textContent)) s.parentElement.open = true; });
    const det1 = raiz.querySelector('.vga-detalhe'), lista1 = raiz.querySelector('.vga-lista');
    if (det1) det1.scrollTop = rolagem; if (lista1) lista1.scrollTop = rolagemLista;
  }

  // Atribuir (etapa padrão), ligar/desligar rotina ('rotina') ou dar retorno a um achado ou lição ('achado'): tudo pela
  // mesma ponte (server/vybes.js → central). A central confere se é dono.
  async function chamar(corpo, etapa = 'atribuir', ok = '') {
    st.enviando = true; st.msg = ''; pintar();
    try {
      const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa, ...corpo }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível salvar agora.');
      st.msg = ok || (corpo.acao === 'criar' ? 'Atribuição registrada.' : 'Atribuição atualizada.');
      await Promise.all([mv().fonteAgentes?.()?.atualizar?.(true), lerPerfil(st.setor, true)]);
    } catch (e) { st.msg = e.message; }
    finally { st.enviando = false; pintar(); }
  }
  function aoClicar(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-vga-fechar')) { fechar(); return; }
    if (b.dataset.vgaSetor) { st.setor = b.dataset.vgaSetor; st.msg = ''; pintar(); return; }
    if (b.dataset.vgaRotina) { chamar({ id: b.dataset.vgaRotina, acao: b.dataset.vgaLigar }, 'rotina', b.dataset.vgaLigar === 'ligar' ? 'Rotina ligada.' : 'Rotina desligada: o agendador pula até ligar de novo.'); return; }
    if (b.dataset.vgaAchado) { chamar({ chave: b.dataset.vgaChave, acao: b.dataset.vgaAchado }, 'achado', b.dataset.vgaAchado === 'errado' ? 'Anotado: conta no acerto do agente.' : 'Achado fechado.'); return; }
    if (b.dataset.vgaLicao) { chamar({ licao: b.dataset.vgaId, acao: b.dataset.vgaLicao }, 'achado', 'Lição atualizada.'); return; }
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
