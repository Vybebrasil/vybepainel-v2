// vybe-mundo-coordenacao.js — A aba Coordenação do Hoje: o Heitor (agente de Coordenação de produção) e a Beatriz, que
// coordena a produção (Paulo, 13/11/2026: "algo prático: ela clicar e já ver como está a carga de cada um para o dia, a
// semana e o mês, como dá para melhorar e distribuir essa carga entre o time... e se tem demanda sem ninguém atribuído,
// já aparecer perguntando se ela quer atribuir para alguém do time").
//
// O time de produção é o da Criação (EQUIPES.design + EQUIPES.audiovisual: Deivid, Beatriz, Jady e Reriston). A carga
// usa o peso e o limite do controle da Direção de arte (vybe-perfis.js: daEffortWeight e daCapacitySignal — 14 pontos
// por semana no design, 24 no audiovisual); no dia o limite é 1/5 da semana e no mês, 4,3 semanas.
//
// Regras da conta (calcular, pura, sem DOM — tests/coordenacao.test.mjs):
// - Peça aberta = não Finalizada (pronta é só Finalizado, Paulo 13/11/2026). Data da peça = veiculação; sem ela, prazo.
// - Na janela = data dentro do período OU data antes de hoje (atrasada: ainda é trabalho de alguém). Sem data fica fora
//   da carga e aparece só como contagem.
// - Disciplina da peça: Reels, vídeo, motion, captação e fotografia em vídeo → audiovisual; o resto → design.
// - Nível: acima de 100% sobrecarregada, de 80% cheia, de 30% ok, abaixo leve.
// - Sem ninguém = peça aberta na janela sem responsável. A sugestão é quem da disciplina fica com a menor carga depois de
//   receber a peça (sem passar do limite, se der).
// - Equilíbrio: de quem passou de 100% sai a peça que ainda não começou (A Fazer, Pode Fazer, Nova demanda), só dela,
//   para quem da mesma disciplina fica abaixo de 80% depois de receber. No máximo 5 trocas.
// Nada é gravado sem o OK de quem está olhando: cada botão pede confirmação na própria linha e grava pela função de
// sempre (gravarResponsaveisDaPeca, vybe-gestor.js), que registra no histórico da peça.
(function (G) {
  'use strict';

  const FATOR = { dia: 1 / 5, semana: 1, mes: 4.3 };
  const NAO_COMECOU = /^(a fazer|pode fazer|nova demanda)$/i;
  const AUDIOVISUAL = /reels|v[íi]deo|motion|capta|anima/i;

  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const somarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoLocal(d); };

  function janelaDe(periodo, hoje) {
    if (periodo === 'dia') return { inicio: hoje, fim: hoje };
    if (periodo === 'mes') { const d = new Date(`${hoje}T12:00:00`); return { inicio: hoje.slice(0, 8) + '01', fim: isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) }; }
    const dow = new Date(`${hoje}T12:00:00`).getDay(), seg = somarDias(hoje, dow === 0 ? -6 : 1 - dow);
    return { inicio: seg, fim: somarDias(seg, 6) };
  }
  const idsDe = (d) => [...new Set([...(Array.isArray(d.responsavel_ids) ? d.responsavel_ids : []), d.responsavel_id].filter((x) => x != null && x !== '').map(String))];
  const dataDe = (d) => String(d.veiculacao_iso || d.prazo_iso || '').slice(0, 10);
  const formatoDe = (d) => String((Array.isArray(d.formatos) ? d.formatos.join(' ') : '') || d.formato || d.tipo || '');
  const disciplinaDe = (d) => (AUDIOVISUAL.test(formatoDe(d)) ? 'audiovisual' : 'design');
  const nivelDe = (pct) => (pct > 100 ? 'sobrecarregada' : pct >= 80 ? 'cheia' : pct >= 30 ? 'ok' : 'leve');

  // time: [{ id, nome, papel, disciplina, limiteSemana }]; itens: peças abertas (já sem as finalizadas).
  function calcular({ itens = [], time = [], hoje, periodo = 'semana', peso = () => 1, maxTrocas = 5 } = {}) {
    const { inicio, fim } = janelaDe(periodo, hoje);
    const fator = FATOR[periodo] || 1;
    const naJanela = (d) => { const x = dataDe(d); return Boolean(x) && ((x >= inicio && x <= fim) || x < hoje); };
    const doTime = new Set(time.map((p) => String(p.id)));
    const pessoas = time.map((p) => ({ ...p, id: String(p.id), limite: Math.max(1, Math.round(p.limiteSemana * fator)), pontos: 0, pecas: [], atrasadas: 0, hoje: 0 }));
    const porId = Object.fromEntries(pessoas.map((p) => [p.id, p]));
    const semDono = [], semData = [];
    for (const d of itens) {
      const ids = idsDe(d);
      if (!dataDe(d)) { if (!ids.length) semData.push(d); continue; }
      if (!naJanela(d)) continue;
      if (!ids.length) { semDono.push(d); continue; }
      for (const id of ids) {
        const p = porId[id]; if (!p) continue;
        p.pecas.push(d); p.pontos += Number(peso(d, { id }) || 1);
        if (dataDe(d) < hoje) p.atrasadas++; else if (dataDe(d) === hoje) p.hoje++;
      }
    }
    for (const p of pessoas) { p.pct = Math.round(p.pontos / p.limite * 100); p.nivel = nivelDe(p.pct); p.pecas.sort((a, b) => dataDe(a).localeCompare(dataDe(b))); }
    // Carga simulada: cada sugestão já conta a anterior, para não mandar tudo para a mesma pessoa.
    const sim = Object.fromEntries(pessoas.map((p) => [p.id, p.pontos]));
    const ordemPara = (d, excluir = []) => pessoas.filter((p) => p.disciplina === disciplinaDe(d) && !excluir.includes(p.id))
      .map((p) => ({ p, depois: (sim[p.id] + Number(peso(d, { id: p.id }) || 1)) / p.limite })).sort((a, b) => a.depois - b.depois);
    semDono.sort((a, b) => dataDe(a).localeCompare(dataDe(b)));
    const atribuir = semDono.map((d) => {
      const ordem = ordemPara(d), melhor = ordem[0]?.p || null;
      if (melhor) sim[melhor.id] += Number(peso(d, { id: melhor.id }) || 1);
      return { d, disciplina: disciplinaDe(d), sugerido: melhor ? melhor.id : '', ordem: ordem.map((x) => x.p.id) };
    });
    const trocas = [];
    const fontes = pessoas.filter((p) => sim[p.id] > p.limite).sort((a, b) => sim[b.id] / b.limite - sim[a.id] / a.limite);
    for (const de of fontes) {
      const candidatas = de.pecas.filter((d) => NAO_COMECOU.test(String(d.status || '').trim()) && idsDe(d).filter((i) => doTime.has(i)).length === 1)
        .sort((a, b) => dataDe(b).localeCompare(dataDe(a)));
      for (const d of candidatas) {
        if (trocas.length >= maxTrocas || sim[de.id] <= de.limite) break;
        const alvo = ordemPara(d, [de.id]).find((x) => x.depois < 0.8);
        if (!alvo) continue;
        const w = Number(peso(d, { id: alvo.p.id }) || 1);
        sim[de.id] -= Number(peso(d, { id: de.id }) || 1); sim[alvo.p.id] += w;
        trocas.push({ d, de: de.id, para: alvo.p.id });
      }
    }
    return { periodo, inicio, fim, pessoas, semDono: atribuir, trocas, semData: semData.length };
  }

  // ---------- tela ----------
  // lote: "Confirmar N" (Direção 3) — pergunta (o OK do lote), rodando (i de n), resultado ({ ok, falhas, n }).
  const st = { periodo: 'semana', aberta: '', confirmando: '', gravando: '', msg: '', lote: { pergunta: false, rodando: false, chaves: [], i: 0, n: 0, resultado: null } };
  try { st.periodo = localStorage.getItem('vybe.coordenacao.periodo') || 'semana'; } catch { /* padrão */ }
  let ultima = null;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (v) => Number(v || 0).toLocaleString('pt-BR');
  const plural = (n, um, varios) => `${n0(n)} ${Number(n) === 1 ? um : varios}`;
  const primeiro = (s) => String(s || '').split(' ')[0];
  const diaBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : 'sem data');
  const ROT = { dia: 'Hoje', semana: 'Semana', mes: 'Mês' };
  const COR = { sobrecarregada: '#B42318', cheia: '#C2490C', ok: '#11613A', leve: '#6B665E' };
  const NIVEL = { sobrecarregada: 'acima do limite', cheia: 'cheia', ok: 'no ritmo', leve: 'com folga' };
  const repintar = () => document.dispatchEvent(new CustomEvent('vybe:coordenacao'));

  function frasesDoHeitor(r, nome) {
    const quando = r.periodo === 'dia' ? 'Hoje' : r.periodo === 'mes' ? 'No mês' : 'Na semana';
    const acima = r.pessoas.filter((p) => p.pct > 100).sort((a, b) => b.pct - a.pct);
    const folga = r.pessoas.filter((p) => p.pct < 60).sort((a, b) => a.pct - b.pct);
    const partes = [];
    if (acima.length) partes.push(`${quando}, <b>${esc(primeiro(nome(acima[0].id)))}</b> está com ${n0(acima[0].pontos)} de ${n0(acima[0].limite)} pontos (${n0(acima[0].pct)}%)${acima.length > 1 ? ` e mais ${plural(acima.length - 1, 'pessoa passou', 'pessoas passaram')} do limite` : ''}.`);
    else partes.push(`${quando}, ninguém passou do limite.`);
    const lista = (l) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);
    if (folga.length) partes.push(`${lista(folga.map((p) => `<b>${esc(primeiro(nome(p.id)))}</b>`))} ${folga.length === 1 ? 'tem' : 'têm'} folga.`);
    if (r.semDono.length) partes.push(`<b>${plural(r.semDono.length, 'demanda está', 'demandas estão')} sem ninguém</b>.`);
    if (r.trocas.length) partes.push(`Sugiro ${plural(r.trocas.length, 'troca', 'trocas')} para equilibrar.`);
    return partes.join(' ');
  }

  function confirmarHtml(chave, texto) {
    if (st.gravando === chave) return '<span class="v2o-grava">Gravando…</span>';
    if (st.confirmando !== chave) return '';
    return `<span class="v2o-conf" role="group" aria-label="Confirmar"><span>${texto}</span><button type="button" class="v2o-btn k" data-coord-ok="${esc(chave)}">Confirmar</button><button type="button" class="v2o-btn" data-coord-cancelar>Cancelar</button></span>`;
  }

  // Direção 3 (quadro D3-Coordenacao): "Hoje" com o período ao lado e as abas; a faixa do Heitor com o mais urgente (a
  // primeira atribuição ou troca, que pede o OK na própria linha); quatro números; "Sem ninguém atribuído" (contorno =
  // sugerido) e "Para equilibrar" (de quem → para quem); a carga do time em linha contra o limite, com os limites e o
  // que fica fora da conta; "Por pessoa" com agora → depois (depois = aplicando as sugestões), que abre a pessoa no lugar.
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const faixaDe = (r) => { const a = `${r.inicio.slice(8, 10)}`, b = `${r.fim.slice(8, 10)} ${MESES[Number(r.fim.slice(5, 7)) - 1]}`;
    return r.inicio === r.fim ? b : r.inicio.slice(5, 7) === r.fim.slice(5, 7) ? `${a} a ${b}` : `${a} ${MESES[Number(r.inicio.slice(5, 7)) - 1]} a ${b}`; };
  const pilulaPct = (p, pct = p.pct) => `<span class="d3h-pct ${pct > 100 ? 'a' : pct < 80 ? 'g' : ''}">${n0(pct)}%</span>`;

  function linhaCarga(r, itens, peso, hoje) {
    if (r.periodo === 'dia') return '';
    const dias = []; for (let d = r.inicio; d <= r.fim; d = somarDias(d, 1)) dias.push(d);
    const limite = r.pessoas.reduce((s, p) => s + p.limite, 0), doTime = new Set(r.pessoas.map((p) => p.id));
    const pts = (d) => idsDe(d).filter((i) => doTime.has(i)).reduce((s, id) => s + Number(peso(d, { id }) || 1), 0);
    const pecas = r.pessoas.flatMap((p) => p.pecas); const unicas = [...new Map(pecas.map((d) => [String(d.id), d])).values()];
    let ac = 0; const serie = dias.map((dia) => { ac += unicas.filter((d) => (dataDe(d) < r.inicio ? r.inicio : dataDe(d)) === dia).reduce((s, d) => s + pts(d), 0); return ac; });
    const ateHoje = serie.slice(0, Math.max(1, dias.filter((d) => d <= hoje).length));
    const W = 400, H = 150, P = 8, max = Math.max(1, limite * 1.1, ...serie), X = (i) => P + (i * (W - 2 * P)) / Math.max(1, dias.length - 1), Y = (v) => H - P - (v / max) * (H - 2 * P);
    const pl = (l) => l.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    let comp = 0; for (let i = 1; i < ateHoje.length; i++) comp += Math.hypot(X(i) - X(i - 1), Y(ateHoje[i]) - Y(ateHoje[i - 1]));
    const u = ateHoje.length - 1;
    const rot = dias.length <= 7 ? dias.map((d) => `<span class="${d === hoje ? 'hoje' : ''}">${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${d}T12:00:00`).getDay()]}</span>`).join('')
      : [dias[0], dias[Math.floor(dias.length / 2)], dias[dias.length - 1]].map((d) => `<span>${diaBr(d)}</span>`).join('');
    return `<svg class="d3-graf d3h-co-graf" viewBox="0 0 ${W} ${H}" style="--d3-comp:${Math.ceil(comp) || 1}" role="img" aria-label="Carga do time: ${n0(serie[serie.length - 1])} de ${n0(limite)} pontos"><polyline class="meta" points="${P},${Y(limite).toFixed(1)} ${W - P},${Y(limite).toFixed(1)}"/>${u > 0 ? `<polyline class="previsto" points="${pl(serie.slice(u))}" transform="translate(${(X(u) - X(0)).toFixed(1)} 0)"/>` : ''}<polyline points="${pl(ateHoje)}"/><circle cx="${X(u).toFixed(1)}" cy="${Y(ateHoje[u]).toFixed(1)}" r="4.5"/></svg><div class="d3h-sem-dias">${rot}</div>`;
  }

  function html({ itens, time, hoje, peso, data, abas = '', titulo = 'Hoje', nome = (id) => id, cliente = (d) => d.cliente || '' }) {
    const r = calcular({ itens, time, hoje, periodo: st.periodo, peso });
    ultima = { r, itens };
    const quem = (id) => esc(primeiro(nome(id)));
    const pessoaDe = (id) => r.pessoas.find((p) => p.id === id);
    const pw = (d, id) => Number(peso(d, { id }) || 1);
    // Depois: a carga de cada um aplicando as atribuições sugeridas e as trocas.
    const depois = Object.fromEntries(r.pessoas.map((p) => [p.id, p.pontos]));
    for (const x of r.semDono) if (x.sugerido) depois[x.sugerido] += pw(x.d, x.sugerido);
    for (const t of r.trocas) { depois[t.de] -= pw(t.d, t.de); depois[t.para] += pw(t.d, t.para); }
    const pctDepois = (p) => Math.round(depois[p.id] / p.limite * 100);
    const cli = (d) => (cliente(d) ? `${typeof G.cliCor === 'function' ? G.cliCor(cliente(d)) : esc(cliente(d))} · ` : '');
    const linhaPeca = (d, extra = '') => `<span class="v2o-peca" title="${esc(String(d.nome || 'Peça') + ' · ' + (d.status || 'Sem status'))}"><b>${cli(d)}${esc(String(d.nome || 'Peça').trim())}</b><small>${extra}${dataDe(d) < hoje ? `<em class="ruim">venceu ${diaBr(dataDe(d))}</em>` : dataDe(d) === hoje ? 'hoje' : diaBr(dataDe(d))}</small></span>`;
    const acima = r.pessoas.filter((p) => p.pct > 100).sort((a, b) => b.pct - a.pct);
    // A faixa: quem passou do limite e quantas estão sem ninguém; o botão abre o OK da primeira sugestão.
    const partes = [acima.length ? `${acima.slice(0, 2).map((p) => esc(primeiro(nome(p.id)))).join(' e ')} acima do limite` : 'Ninguém acima do limite', r.semDono.length ? `${plural(r.semDono.length, 'sem ninguém', 'sem ninguém')}` : ''].filter(Boolean);
    const s1 = r.semDono.find((x) => x.sugerido), t1 = r.trocas[0];
    const botao = s1 ? `<button type="button" class="d3-acao-btn" data-coord-atribuir="${esc(s1.d.id)}" data-para="${esc(s1.sugerido)}">Atribuir a 1ª</button>`
      : t1 ? `<button type="button" class="d3-acao-btn" data-coord-trocar="${esc(t1.d.id)}" data-de="${esc(t1.de)}" data-para="${esc(t1.para)}">Passar a 1ª</button>` : '';
    // Direção V2 (16/11/2026): o laranja com a composição fixa (rótulo de quem fala, a frase e o botão), ao lado dos indicadores.
    const faixa = `<section class="d3-acao d3h-acao d3v-laranja d3v-lar-faixa" aria-label="Heitor, coordenação de produção"><span class="d3v-lar-rot"><span class="d3-acao-av" aria-hidden="true">H</span>Heitor · coordenação</span><span class="d3v-lar-txt"><span class="d3-acao-frase" title="${esc(frasesDoHeitor(r, nome).replace(/<[^>]+>/g, ''))}">${partes.join(' · ')}.</span></span>${botao ? `<span class="d3v-lar-bts">${botao}</span>` : ''}</section>`;
    const periodos = `<div class="v2o-periodo" role="tablist" aria-label="Período">${['dia', 'semana', 'mes'].map((p) => `<button type="button" role="tab" aria-selected="${st.periodo === p}" data-coord-periodo="${p}">${ROT[p]}</button>`).join('')}</div>`;
    const porDisc = (l) => { const m = {}; for (const x of l) m[x.disciplina] = (m[x.disciplina] || 0) + 1; return Object.entries(m).map(([k, n]) => `${n} ${k === 'audiovisual' ? 'motion' : k}`).join(' · '); };
    const totPontos = r.pessoas.reduce((s, p) => s + p.pontos, 0), totLimite = r.pessoas.reduce((s, p) => s + p.limite, 0), pctTime = totLimite ? Math.round(totPontos / totLimite * 100) : 0;
    const num = (rot, v, { de = '', sub = '', tom = '', subTom = '', barra = null } = {}) => `<div class="d3-num d3h-num${tom ? ' ' + tom : ''}"><span class="d3-num-rot">${rot}</span><span class="d3h-num-linha"><span class="d3h-num-txt"><b class="d3-num-v">${v}${de ? `<small>${de}</small>` : ''}</b>${sub ? `<span class="d3h-num-sub${subTom ? ' ' + subTom : ''}">${sub}</span>` : ''}</span>${barra != null ? `<svg class="d3v-anel" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17"/><circle cx="22" cy="22" r="17" stroke-dasharray="${(106.8 * Math.max(0, Math.min(100, barra)) / 100).toFixed(1)} 106.8"/></svg>` : ''}</span></div>`;
    const numeros = `<div class="d3h-nums" role="group" aria-label="Os números da carga">${[
      num('Sem ninguém', n0(r.semDono.length), { tom: r.semDono.length ? 'a' : '', sub: r.semDono.length ? porDisc(r.semDono) : 'todas com alguém' }),
      num('Acima do limite', n0(acima.length), { de: ` / ${n0(r.pessoas.length)}`, tom: acima.length ? 'a' : '', sub: acima[0] ? `${quem(acima[0].id)} ${n0(acima[0].pontos)} / ${n0(acima[0].limite)} · ${n0(acima[0].pct)}%` : 'ninguém', subTom: acima.length ? 'a' : '' }),
      num('Carga do time', `${n0(pctTime)}%`, { sub: `${n0(totPontos)} / ${n0(totLimite)} pontos`, barra: pctTime }),
      num('Trocas sugeridas', n0(r.trocas.length), { sub: r.trocas.length || r.semDono.length ? `depois: ${r.pessoas.every((p) => pctDepois(p) <= 100) ? 'todos ≤ 100%' : 'ainda acima'}` : 'nada a trocar', subTom: r.trocas.length && r.pessoas.every((p) => pctDepois(p) <= 100) ? 'g' : '' }),
    ].join('')}</div>`;
    const cab = (t, aux) => `<div class="d3h-cab"><h3>${t}</h3><span class="d3h-aux">${aux}</span></div>`;
    const semDono = `<section class="d3h-cartao v2o-semdono" aria-label="Sem ninguém atribuído">${cab('Sem ninguém atribuído', r.semDono.length ? 'contorno = sugerido' : '0')}
        <ul class="d3h-corpo">${r.semDono.slice(0, 8).map((x) => { const chave = `atribuir:${x.d.id}:`;
          return `<li>${linhaPeca(x.d, `${x.disciplina === 'audiovisual' ? 'motion' : 'design'} · ${n0(pw(x.d, x.sugerido || ''))} pt · `)}<span class="v2o-quem">${x.ordem.map((id) => { const p = pessoaDe(id), pct = Math.round((p.pontos + pw(x.d, id)) / p.limite * 100);
            return `<button type="button" class="v2o-chip${id === x.sugerido ? ' sugerido' : ''}${pct > 100 ? ' a' : ''}" data-coord-atribuir="${esc(x.d.id)}" data-para="${esc(id)}" title="${quem(id)}: ${n0(p.pontos)} de ${n0(p.limite)} pontos agora">${quem(id)} <small>${n0(pct)}%</small></button>`; }).join('') || '<small>ninguém da disciplina</small>'}</span>
            ${x.ordem.map((id) => confirmarHtml(chave + id, `Atribuir a ${quem(id)}?`)).join('')}</li>`; }).join('') || '<li class="d3h-vazio">Todas as peças têm alguém</li>'}</ul>
        ${r.semDono.length > 8 ? `<p class="v2o-nota">+ ${n0(r.semDono.length - 8)} no Painel de trabalho, em "Sem dono".</p>` : ''}</section>`;
    const trocas = `<section class="d3h-cartao" aria-label="Para equilibrar">${cab('Para equilibrar', r.trocas.length ? 'não começadas' : 'nada a trocar')}
        ${r.trocas.length ? `<ul class="d3h-corpo">${r.trocas.map((t) => { const chave = `trocar:${t.d.id}:${t.de}:${t.para}`, de = pessoaDe(t.de), para = pessoaDe(t.para);
          return `<li>${linhaPeca(t.d, `${n0(pw(t.d, t.para))} pt · `)}<span class="v2o-porque"><span class="v2o-de">${quem(t.de)} ${pilulaPct(de)}</span><i aria-hidden="true">→</i>${confirmarHtml(chave, '') ? '' : `<button type="button" class="v2o-chip sugerido" data-coord-trocar="${esc(t.d.id)}" data-de="${esc(t.de)}" data-para="${esc(t.para)}">${quem(t.para)} <small>${n0(para.pct)}%</small></button>`}</span>
            ${confirmarHtml(chave, `Passar para ${quem(t.para)}?`)}</li>`; }).join('')}</ul>`
          : `<p class="d3h-vazio">${acima.length ? 'Quem passou do limite só tem peças já começadas ou de mais de uma pessoa: troque abrindo a pessoa' : 'A carga está dentro do limite de todo mundo'}</p>`}
        ${loteHtml(r)}</section>`;
    const lims = [...new Map(r.pessoas.map((p) => [p.disciplina, p])).values()];
    const tiles = `<div class="d3h-co-tiles">${lims.map((p) => `<span><small>Limite ${p.disciplina === 'audiovisual' ? 'audiovisual' : 'design'}</small><b>${n0(p.limite)}</b> pt/${r.periodo === 'dia' ? 'dia' : r.periodo === 'mes' ? 'mês' : 'sem'}</span>`).join('')}
        <span><small>Sem data</small><b>${n0(r.semData)}</b> fora da conta</span><span><small>Peças no período</small><b>${n0(new Set(r.pessoas.flatMap((p) => p.pecas.map((d) => String(d.id)))).size + r.semDono.length)}</b></span></div>`;
    const carga = `<section class="d3h-cartao d3h-co-carga" aria-label="Carga do time">${cab('Carga do time', '<span class="d3h-leg"><i></i>carga</span><span class="d3h-leg m"><i></i>limite</span>')}
        <div class="d3h-corpo"><p class="d3h-co-total"><b>${n0(totPontos)}</b> / ${n0(totLimite)} pontos · ${n0(pctTime)}%</p>${linhaCarga(r, itens, peso, hoje)}${tiles}</div></section>`;
    const pessoas = `<section class="d3h-cartao v2o-time" aria-label="Por pessoa">${cab('Por pessoa', `${esc(ROT[r.periodo])} · agora → depois`)}<div class="d3h-corpo">
        ${r.pessoas.map((p) => { const aberta = st.aberta === p.id, escala = Math.max(p.pontos, depois[p.id], p.limite * 1.25, 1), pd = pctDepois(p);
          return `<div class="v2-abre v2o-pes${aberta ? ' aberta' : ''}" aria-expanded="${aberta}"><button type="button" class="v2o-pes-linha" data-coord-pessoa="${esc(p.id)}" aria-expanded="${aberta}">
              <span class="d3h-pes-top"><b>${quem(p.id)}</b><small>${esc(p.papel || '')}</small><span class="d3h-pes-n"><b class="${p.pct > 100 ? 'a' : ''}">${n0(p.pontos)}</b> / ${n0(p.limite)}${depois[p.id] !== p.pontos ? ` → <b class="${pd > 100 ? 'a' : 'g'}">${n0(depois[p.id])}</b>` : ''}</span></span>
              <span class="d3h-carga${p.pct > 100 ? ' passou' : ''}" style="--v:${Math.round(p.pontos / escala * 100)}%;--lim:${Math.round(p.limite / escala * 100)}%"><i></i><u></u></span>
              <span class="d3h-pes-pe">${pilulaPct(p)}<small>${plural(p.pecas.length, 'peça', 'peças')}</small>${p.atrasadas ? `<span class="d3h-pill r">${plural(p.atrasadas, 'atrasada', 'atrasadas')}</span>` : ''}<small class="v2o-nivel" style="color:${COR[p.nivel]}">${NIVEL[p.nivel]}</small></span></button>
            <div class="v2-mais"><div><ul class="v2o-lista">${aberta ? p.pecas.map((d) => { const outros = r.pessoas.filter((o) => o.id !== p.id && o.disciplina === disciplinaDe(d));
                return `<li>${linhaPeca(d, `${esc(d.status || 'Sem status')} · `)}${outros.map((o) => confirmarHtml(`trocar:${d.id}:${p.id}:${o.id}`, `Passar para ${quem(o.id)}?`)).join('') || `<span class="v2o-quem">${outros.map((o) => `<button type="button" class="v2o-chip" data-coord-trocar="${esc(d.id)}" data-de="${esc(p.id)}" data-para="${esc(o.id)}">${quem(o.id)} <small>${n0(o.pct)}%</small></button>`).join('') || '<small>ninguém mais da disciplina</small>'}</span>`}</li>`; }).join('') || '<li class="v2o-nota">Nada neste período.</li>' : ''}</ul></div></div></div>`; }).join('')}</div>
        <div class="d3h-pe"><span class="d3h-leg"><i></i>pontos</span><span class="d3h-leg t"><i></i>limite</span></div></section>`;
    const aviso = st.msg ? `<p class="v2o-msg" role="status">${esc(st.msg)}</p>` : '';
    // Direção 3 com o controle manual da Beatriz: os indicadores e a grade vêm primeiro; o que o Heitor sugere fica
    // recolhido embaixo ("Sugestões do Heitor"), com tudo o que tinha, e só grava com o clique e o OK.
    const man = manualHtml({ itens, time, hoje, nome, cliente });
    // Direção V2 (pranchas V2, 16/11/2026): a mesma janela de vidro das outras abas, em uma coluna larga (a grade pessoa × dia
    // pede a largura toda). Em cima a saudação, o período e as abas; depois os seis indicadores com o único cartão laranja
    // ao lado; a grade ocupa o resto e rola por dentro; as sugestões do Heitor ficam recolhidas no pé.
    return `<div class="d3h d3h-co v2o d3q d3q-larga"><div class="d3q-main"><div class="d3h-topo"><div class="d3h-ola"><h2>${esc(titulo)}</h2><small>${esc(faixaDe(r))}</small></div><div class="d3h-topo-dir">${periodos}${abas}</div></div>
      <div class="d3q-co-topo">${man.nums}${man.faixa || faixa}</div>${aviso}
      ${man.html}
      <section class="d3h-cartao v2o-heitor v2-abre" aria-expanded="${sg.heitor}" aria-label="Sugestões do Heitor"><button type="button" class="v2o-heitor-cab" data-coord-heitor aria-expanded="${sg.heitor}"><span class="d3-agente-av v2o-heitor-av" aria-hidden="true">H</span><b>Sugestões do Heitor</b><small>${esc([r.semDono.length ? plural(r.semDono.length, 'sem ninguém', 'sem ninguém') : '', r.trocas.length ? plural(r.trocas.length, 'troca', 'trocas') : '', acima.length ? `${n0(acima.length)} acima do limite` : ''].filter(Boolean).join(' · ') || 'nada a sugerir')}</small><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
      <div class="v2-mais"><div>${numeros}
      <div class="d3h-grade"><div class="d3h-col">${semDono}${trocas}</div><div class="d3h-col">${carga}</div><div class="d3h-col">${pessoas}</div></div></div></div></section></div></div>`;
  }

  // ---------- controle manual (Beatriz, 14/11/2026: "gosto de fazer essas coisas manualmente, pra ter um controle
  // maior"; especificação dela: visão geral da equipe, organização manual semanal e diária, o mês para planejar, uma
  // ficha por responsável, edição total e os indicadores no topo). O sistema não distribui sozinho: as sugestões do
  // Heitor ficam recolhidas embaixo e só gravam com o clique e o OK de quem olha. ----------
  // Regras (gradeCalcular e indicadores, puros — tests/coordenacao-manual.test.mjs):
  // - Ficha por pessoa do time (padrão: quem está olhando, se é do time; senão a última aberta, guardada no navegador);
  //   "Todos" e "Sem ninguém" existem, mas não são o padrão.
  // - Hoje: um dia; Semana: segunda a domingo (sábado e domingo vazios saem); Mês: o calendário do mês, dia a dia.
  //   ‹ › anda um período. A peça cai no dia da referência: Prazo (o prazo interno, padrão) ou Veiculação (data do
  //   cliente). Aberta e vencida antes do período aparece em "Antes"; sem a data da referência vira contagem.
  // - Limite do dia: peças por dia de area=series (limite_dia: { padrao: 5, pessoas }, gravado pelos donos e pela
  //   coordenação); o da pessoa, quando existe, manda; sem a série, 5 (a média da Beatriz). limite_carga é outra coisa
  //   (peças abertas) e não entra aqui. Vermelho só quando passou.
  // - Repetição: o mesmo cliente 2 vezes no dia da mesma pessoa, ou 3 no dia da agência; o mesmo formato 3 vezes no dia
  //   da agência (ex.: carrossel). Pílulas discretas e o resumo no topo da grade.
  // - Mudar: arrastar a peça para outra pessoa e/ou outro dia (no Mês, entre dias), ou o menu ⋯ ("Passar para…",
  //   "Mudar prazo", "Mudar veiculação", "Abrir a peça" — a gaveta de sempre, onde status, cliente, formato e o resto se
  //   editam). Arrastar pergunta antes ("Mover"); grava pelas funções de sempre: gravarResponsaveisDaPeca (vybe-gestor.js)
  //   e moverDataDoItem (vybe-agenda.js, a do arrastar no calendário, que avisa abaixo do Prazo de Ouro). "Desfazer"
  //   volta como estava. Arrastar muda só a data da referência ativa; mexer na veiculação avisa que é a data do cliente.
  // - Indicadores: ao ar na semana, ao ar hoje, prazo na semana, aguardando você (sem ninguém), para aprovação (Aprovar
  //   pelo portão de sempre, updateFocusStatus) e atrasadas (quem é e "Mudar prazo" na linha).
  const LIMITE_DIA = 5, REPETE_PESSOA = 2, REPETE_AGENCIA = 3, FORMATO_DIA = 3;
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const NO_DIA = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];
  const sg = { pessoa: '', desloca: 0, ref: 'prazo', filtro: { cliente: '', formato: '', setor: '' }, busca: '', ind: '', heitor: false, passando: '', pedido: null, gravando: false, msg: '', periodoVisto: '' };
  try { const g = JSON.parse(localStorage.getItem('vybe.coordenacao.grade') || '{}'); if (['prazo', 'veiculacao'].includes(g.ref)) sg.ref = g.ref; if (g.pessoa) sg.pessoa = String(g.pessoa); sg.heitor = g.heitor === true; } catch { /* padrão */ }
  const guardarGrade = () => { try { localStorage.setItem('vybe.coordenacao.grade', JSON.stringify({ ref: sg.ref, pessoa: sg.pessoa, heitor: sg.heitor })); } catch { /* fica nesta tela */ } };
  let ultimaGrade = null;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const formatoChave = (d) => { const f = Array.isArray(d.formatos) && d.formatos.length ? d.formatos[0] : (d.formato || d.tipo || ''); return String(f || '').trim(); };
  const PLURAL_FMT = { carrossel: 'carrosséis', card: 'cards', story: 'stories', stories: 'stories', reels: 'reels', video: 'vídeos', feed: 'feeds', motion: 'motions', fotografia: 'fotografias', foto: 'fotos' };
  const fmtPlural = (f, n) => (n === 1 ? f.toLowerCase() : PLURAL_FMT[norm(f)] || `× ${f.toLowerCase()}`);
  const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : 'sem data');
  const dowDe = (iso) => new Date(`${iso}T12:00:00`).getDay();
  // Aprovação interna: Para, Em ou Aguardando aprovação, pelo começo do status sem acento. "Aprovado" e
  // "Ag. Aprovação Cliente" não entram.
  const paraAprovar = (d) => /^(para|em|aguardando) aprova/.test(norm(d.status));

  function colunasDe(periodo, hoje, desloca = 0) {
    if (periodo === 'dia') { const d = somarDias(hoje, desloca); return [{ inicio: d, fim: d, dia: true }]; }
    if (periodo === 'mes') {
      const b = new Date(`${hoje.slice(0, 7)}-01T12:00:00`); b.setMonth(b.getMonth() + desloca);
      const mes = isoLocal(b).slice(0, 7), ultimo = isoLocal(new Date(b.getFullYear(), b.getMonth() + 1, 0, 12));
      const cols = []; for (let d = janelaDe('semana', `${mes}-01`).inicio, fim = janelaDe('semana', ultimo).fim; d <= fim; d = somarDias(d, 1)) cols.push({ inicio: d, fim: d, dia: true, fora: d.slice(0, 7) !== mes });
      return cols;
    }
    const seg = janelaDe('semana', somarDias(hoje, 7 * desloca)).inicio;
    return Array.from({ length: 7 }, (_, i) => { const d = somarDias(seg, i); return { inicio: d, fim: d, dia: true }; });
  }

  // time: [{ id, disciplina }]; pessoa: '<id>' | 'todos' | 'ninguem'; filtro: { cliente, formato, setor ('design'|'audiovisual'|'g:<grupo>') }.
  function gradeCalcular({ itens = [], time = [], hoje, periodo = 'semana', desloca = 0, ref = 'prazo', pessoa = 'todos', limiteDia = () => LIMITE_DIA, cliente = (d) => d.cliente || '', filtro = {}, busca = '' } = {}) {
    const dataRef = (d) => String((ref === 'veiculacao' ? d.veiculacao_iso : d.prazo_iso) || '').slice(0, 10);
    const doTime = new Set(time.map((p) => String(p.id)));
    const usadas = new Set(itens.filter((d) => { const t = idsDe(d); return !t.length || t.some((i) => doTime.has(i)); }).map(dataRef));
    const cols = colunasDe(periodo, hoje, desloca).filter((c) => periodo !== 'semana' || ![0, 6].includes(dowDe(c.inicio)) || usadas.has(c.inicio) || c.inicio === hoje);
    const colDe = (iso) => cols.findIndex((c) => iso >= c.inicio && iso <= c.fim);
    const f = { cliente: '', formato: '', setor: '', ...filtro }, q = norm(busca);
    const visivel = (d) => (!f.cliente || norm(cliente(d)) === norm(f.cliente)) && (!f.formato || norm(formatoChave(d)) === norm(f.formato))
      && (!f.setor || (f.setor.startsWith('g:') ? String(d.grupo || '') === f.setor.slice(2) : disciplinaDe(d) === f.setor))
      && (!q || norm(`${d.nome || ''} ${cliente(d)} ${formatoChave(d)} ${d.status || ''}`).includes(q));
    const celula = (limite) => ({ pecas: [], limite });
    const linhas = time.map((p) => { const lim = Math.max(1, Number(limiteDia(String(p.id))) || LIMITE_DIA); return { id: String(p.id), disciplina: p.disciplina, limite: lim, antes: celula(0), celulas: cols.map(() => celula(lim)) }; });
    const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
    const ninguem = { id: '', antes: celula(0), celulas: cols.map(() => celula(0)) };
    const agencia = cols.map(() => ({ pecas: [] }));
    let semData = 0, antesN = 0;
    for (const d of itens) {
      const iso = dataRef(d), todos = idsDe(d), ids = todos.filter((i) => doTime.has(i));
      if (todos.length && !ids.length) continue;
      if (!iso) { semData++; continue; }
      const ci = colDe(iso), antes = ci < 0 && iso < cols[0].inicio && iso < hoje;
      if (ci < 0 && !antes) continue;
      if (antes) antesN++; else agencia[ci].pecas.push(d);
      for (const l of ids.length ? ids.map((i) => porId[i]) : [ninguem]) (antes ? l.antes : l.celulas[ci]).pecas.push(d);
    }
    const repetidos = (pecas, min) => { const m = new Map(); for (const d of pecas) { const c = cliente(d); if (!c) continue; const k = norm(c); const x = m.get(k) || { cliente: c, n: 0 }; x.n++; m.set(k, x); } return [...m.values()].filter((x) => x.n >= min).sort((a, b) => b.n - a.n); };
    const formatos = (pecas) => { const m = new Map(); for (const d of pecas) { const fm = formatoChave(d); if (!fm) continue; const k = norm(fm); const x = m.get(k) || { formato: fm, n: 0 }; x.n++; m.set(k, x); } return [...m.values()].filter((x) => x.n >= FORMATO_DIA).sort((a, b) => b.n - a.n); };
    const ordem = (a, b) => dataRef(a).localeCompare(dataRef(b)) || String(cliente(a)).localeCompare(String(cliente(b)));
    for (const l of [...linhas, ninguem]) for (const cel of [l.antes, ...l.celulas]) {
      cel.pecas.sort(ordem); cel.visiveis = cel.pecas.filter(visivel); cel.n = cel.pecas.length;
      cel.passou = Boolean(l.id) && cel.limite > 0 && cel.n > cel.limite; cel.cheia = Boolean(l.id) && cel.limite > 0 && cel.n === cel.limite;
      cel.repetidos = l.id ? repetidos(cel.pecas, REPETE_PESSOA) : [];
    }
    for (const a of agencia) { a.pecas.sort(ordem); a.visiveis = a.pecas.filter(visivel); a.repetidos = repetidos(a.pecas, REPETE_AGENCIA); a.formatos = formatos(a.pecas); }
    const mostra = pessoa === 'todos' ? linhas : linhas.filter((l) => l.id === pessoa);
    const mostraNinguem = pessoa === 'todos' || pessoa === 'ninguem';
    const diasAcima = mostra.reduce((s, l) => s + l.celulas.filter((c) => c.passou).length, 0);
    const pares = new Set();
    mostra.forEach((l) => l.celulas.forEach((c, i) => c.repetidos.forEach((x) => pares.add(`${i}|${norm(x.cliente)}`))));
    agencia.forEach((a, i) => a.repetidos.forEach((x) => pares.add(`${i}|${norm(x.cliente)}`)));
    const fmts = agencia.flatMap((a, i) => a.formatos.map((x) => ({ ...x, col: i }))).sort((a, b) => b.n - a.n);
    const opcoes = (fn) => [...new Map(itens.map((d) => [norm(fn(d)), fn(d)]).filter(([k]) => k)).values()].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    return { periodo, desloca, ref, pessoa, cols, linhas: mostra, todas: linhas, ninguem: mostraNinguem ? ninguem : null, ninguemSempre: ninguem, agencia, semData, antes: antesN,
      resumo: { diasAcima, clientesRepetidos: pares.size, formatos: fmts },
      opcoes: { clientes: opcoes((d) => cliente(d)), formatos: opcoes(formatoChave), grupos: opcoes((d) => String(d.grupo || '')) } };
  }

  // Os indicadores do topo, sobre as peças abertas do time e as sem ninguém (a semana é a de hoje).
  function indicadores({ itens = [], time = [], hoje }) {
    const doTime = new Set(time.map((p) => String(p.id)));
    const nossas = itens.filter((d) => { const t = idsDe(d); return !t.length || t.some((i) => doTime.has(i)); });
    const { inicio, fim } = janelaDe('semana', hoje), naSemana = (x) => x && x >= inicio && x <= fim;
    const v = (d) => String(d.veiculacao_iso || '').slice(0, 10), p = (d) => String(d.prazo_iso || '').slice(0, 10);
    const porData = (a, b) => (p(a) || v(a) || '9').localeCompare(p(b) || v(b) || '9');
    const porPessoa = Object.fromEntries(time.map((t) => [String(t.id), nossas.filter((d) => idsDe(d).includes(String(t.id))).length]));
    return {
      porPessoa, ninguem: nossas.filter((d) => !idsDe(d).length).length, total: nossas.length,
      listas: {
        hoje: nossas.filter((d) => v(d) === hoje).sort(porData),
        ar: nossas.filter((d) => naSemana(v(d))).sort((a, b) => v(a).localeCompare(v(b))),
        semana: nossas.filter((d) => naSemana(p(d))).sort(porData),
        aguardando: nossas.filter((d) => !idsDe(d).length).sort(porData),
        aprovar: nossas.filter(paraAprovar).sort(porData),
        atrasadas: nossas.filter((d) => (p(d) && p(d) < hoje) || (v(d) && v(d) < hoje)).sort(porData),
      },
    };
  }
  const IND = [['hoje', 'No ar hoje'], ['ar', 'Vão ao ar'], ['semana', 'Da semana'], ['aguardando', 'Aguardando você'], ['aprovar', 'Para aprovação'], ['atrasadas', 'Atrasadas']];

  // "3 dias passam do limite · 2 clientes repetidos · 4 carrosséis na quinta"
  function resumoTexto(g) {
    const R = g.resumo, partes = [];
    if (R.diasAcima) partes.push(`${plural(R.diasAcima, 'dia passa', 'dias passam')} do limite`);
    if (R.clientesRepetidos) partes.push(plural(R.clientesRepetidos, 'cliente repetido', 'clientes repetidos'));
    const f = R.formatos[0];
    if (f) { const c = g.cols[f.col], quando = g.periodo === 'mes' ? `em ${dm(c.inicio)}` : g.periodo === 'dia' ? 'no dia' : NO_DIA[dowDe(c.inicio)];
      partes.push(`${n0(f.n)} ${fmtPlural(f.formato, f.n)} ${quando}${R.formatos.length > 1 ? ` · +${n0(R.formatos.length - 1)}` : ''}`); }
    return partes;
  }

  // A ficha aberta: a escolhida antes (guardada no navegador); sem ela, quem está olhando, se é do time; senão, Todos.
  function pessoaDaFicha(time) {
    const ids = time.map((p) => String(p.id));
    if (sg.pessoa === 'todos' || sg.pessoa === 'ninguem' || ids.includes(sg.pessoa)) return sg.pessoa;
    const eu = String((typeof G.operadorDoTopo === 'function' ? G.operadorDoTopo()?.id : '') || '');
    return ids.includes(eu) ? eu : 'todos';
  }

  // O controle manual inteiro: os indicadores e a grade. Devolve também a frase da faixa laranja quando há prioridade.
  function manualHtml({ itens, time, hoje, nome = (id) => id, cliente = (d) => d.cliente || '' }) {
    if (sg.periodoVisto && sg.periodoVisto !== st.periodo) { sg.desloca = 0; sg.pedido = null; }
    sg.periodoVisto = st.periodo;
    const S = typeof G.d3Series === 'function' ? G.d3Series('setor', repintar) : null;
    const limiteDia = (id) => {
      const L = S?.limite_dia; if (!L) return LIMITE_DIA;
      const padrao = Number(L.padrao) > 0 ? Number(L.padrao) : LIMITE_DIA;
      // limite_dia.pessoas usa o id de vybe_pessoas (o sujeito da carga); a ficha usa o id do Monday.
      const x = Object.values(S.carga || {}).find((c) => String(c.monday || '') === id || String(c.sujeito) === id);
      return Number(L.pessoas?.[x ? String(x.sujeito) : id]) || padrao;
    };
    const pessoa = pessoaDaFicha(time);
    const g = gradeCalcular({ itens, time, hoje, periodo: st.periodo, desloca: sg.desloca, ref: sg.ref, pessoa, limiteDia, cliente, filtro: sg.filtro, busca: sg.busca });
    const I = indicadores({ itens, time, hoje });
    ultimaGrade = { g, time, I };
    const quem = (id) => (id ? esc(primeiro(nome(id))) : 'Sem ninguém');
    const cli = (d) => (cliente(d) ? (typeof G.cliCor === 'function' ? G.cliCor(cliente(d)) : esc(cliente(d))) : '<span class="v2o-gp-sem">sem cliente</span>');
    const pilulaSt = (d) => { const s = String(d.status || 'Sem status'), t = typeof G.pv2Tom === 'function' ? G.pv2Tom(s) : 'n';
      const c = t === 'n' ? (d.status_color || (typeof G.corDeStatus === 'function' ? G.corDeStatus(s)?.cor : '') || '') : '';
      return `<span class="v2o-st ${t}"${c ? ` style="--d3-st:${esc(c)}"` : ''}>${t === 'n' ? '<i aria-hidden="true"></i>' : ''}${esc(s)}</span>`; };
    const dataBt = (d, campo, rot) => { const v = String((campo === 'prazo' ? d.prazo_iso : d.veiculacao_iso) || '').slice(0, 10);
      return `<button type="button" class="v2o-gp-d${v && v < hoje ? ' ruim' : ''}" data-coord-data="${campo}" data-peca="${esc(d.id)}" title="Mudar ${campo === 'prazo' ? 'o prazo' : 'a veiculação'}"><i>${rot}</i> ${dm(v)}</button>`; };
    const menu = (d, de) => (typeof G.vbMenuLinhaHtml === 'function' ? G.vbMenuLinhaHtml({ rotulo: 'Mais opções da peça', itens: [
      { rotulo: 'Passar para…', attrs: `data-coord-menu="passar" data-peca="${esc(d.id)}" data-de="${esc(de)}"` },
      { rotulo: 'Mudar prazo', attrs: `data-coord-menu="prazo" data-peca="${esc(d.id)}"` },
      { rotulo: 'Mudar veiculação', attrs: `data-coord-menu="veiculacao" data-peca="${esc(d.id)}"` },
      { rotulo: 'Abrir a peça', attrs: `data-hoje-acao="peca" data-valor="${esc(d.id)}"` }] }) : '');
    const donos = (d) => idsDe(d).filter((i) => g.todas.some((l) => l.id === i));
    const passarHtml = (d, de, ci) => {
      if (sg.passando !== `${d.id}|${de}`) return '';
      return `<span class="v2o-gp-para" role="group" aria-label="Passar para">${g.todas.filter((l) => l.id !== de).map((l) => { const c = ci >= 0 ? l.celulas[ci] : null, depois = c ? c.n + 1 : 0;
        return `<button type="button" class="v2o-chip${l.disciplina === disciplinaDe(d) ? '' : ' fora'}${c && depois > c.limite ? ' a' : ''}" data-coord-sem-para="${esc(l.id)}" data-peca="${esc(d.id)}" data-de="${esc(de)}" data-col="${ci}">${quem(l.id)}${c ? ` <small>${n0(depois)}/${n0(c.limite)}</small>` : ''}</button>`; }).join('')}<button type="button" class="v2o-btn" data-coord-sem-cancelar>Cancelar</button></span>`;
    };
    const P = sg.pedido;
    const confirmar = () => {
      if (!P) return '';
      if (sg.gravando) return '<div class="v2o-sem-conf" role="status"><span class="v2o-grava">Gravando…</span></div>';
      const partes = [];
      if (P.para !== P.de) partes.push(`passar para ${quem(P.para)}`);
      if (P.dataPara !== P.dataDe) partes.push(`${P.campo === 'prazo' ? 'mudar o prazo' : 'mudar a veiculação'} para ${DOW[dowDe(P.dataPara)]} ${dm(P.dataPara)}`);
      const frase = partes.join(' e '), avisos = (P.avisos || []).map((a) => `<span class="v2o-aviso${a.r ? ' r' : ''}"><i aria-hidden="true"></i>${esc(a.t)}</span>`).join('');
      return `<div class="v2o-sem-conf" role="group" aria-label="Confirmar a mudança"><b>${esc(P.nome)}: ${frase.charAt(0).toUpperCase() + frase.slice(1)}?</b>${avisos ? `<span class="v2o-avisos">${avisos}</span>` : ''}<span class="v2o-sem-conf-bt"><button type="button" class="v2o-btn" data-coord-sem-cancelar>Cancelar</button><button type="button" class="v2o-btn k" data-coord-sem-ok>Mover</button></span></div>`;
    };
    const pecaHtml = (d, de, ci, comQuem = false) => `<div class="v2o-gp${sg.passando === `${d.id}|${de}` ? ' passando' : ''}${P && P.id === String(d.id) && P.de === de ? ' movendo' : ''}" draggable="true" data-coord-arrasta="${esc(d.id)}" data-de="${esc(de)}" data-col="${ci}" title="${esc(String(d.nome || 'Peça').trim())}" aria-label="${esc(`${String(d.nome || 'Peça').trim()} · ${cliente(d) || 'sem cliente'} · ${d.status || 'Sem status'}`)}">
        <span class="v2o-gp-top"><b class="v2o-gp-cli">${cli(d)}</b>${menu(d, de)}</span>
        <span class="v2o-gp-meio">${comQuem ? `<span class="v2o-gp-q">${quem(de)}</span>` : ''}${formatoChave(d) ? `<span class="v2o-gp-f">${esc(formatoChave(d))}</span>` : ''}${pilulaSt(d)}</span>
        <span class="v2o-gp-datas">${dataBt(d, 'prazo', 'Prazo')}${dataBt(d, 'veiculacao', 'Veic.')}</span>${passarHtml(d, de, ci)}</div>`;
    const contaHtml = (l, cel) => (l.id && cel.limite ? `<span class="v2o-conta${cel.passou ? ' r' : cel.cheia ? ' cheia' : ''}" title="${plural(cel.n, 'peça', 'peças')} de ${n0(cel.limite)} no dia${cel.passou ? ': passou do limite' : ''}">${n0(cel.n)}<small>/${n0(cel.limite)}</small></span>` : (cel.n ? `<span class="v2o-conta">${n0(cel.n)}</span>` : ''));
    const repHtml = (lista) => lista.map((x) => `<span class="v2o-aviso" title="${esc(x.cliente)} ${n0(x.n)} vezes"><i aria-hidden="true"></i>${esc(primeiro(x.cliente))} ×${n0(x.n)}</span>`).join('');
    const fmtHtml = (lista) => lista.map((x) => `<span class="v2o-aviso f" title="${n0(x.n)} ${esc(fmtPlural(x.formato, x.n))}"><i aria-hidden="true"></i>${esc(x.formato)} ×${n0(x.n)}</span>`).join('');
    const filtradas = (cel) => (cel.n > cel.visiveis.length ? `<small class="v2o-sem-filtradas">+${n0(cel.n - cel.visiveis.length)} fora do filtro</small>` : '');
    const alvo = (id, ci) => P && P.para === id && P.col === ci;
    const ehHoje = (c) => hoje >= c.inicio && hoje <= c.fim;
    const temAntes = g.antes > 0;
    const celHtml = (l, cel, ci) => `<div class="v2o-sem-cel${cel.passou ? ' passou' : ''}${ci === -1 ? ' antes' : ''}${alvo(l.id, ci) ? ' alvo' : ''}"${ci >= 0 && l.id ? ` data-coord-solta data-pessoa="${esc(l.id)}" data-col="${ci}"` : ''}>
        ${cel.n || l.id ? `<span class="v2o-sem-cel-top">${contaHtml(l, cel)}${repHtml(cel.repetidos)}</span>` : ''}
        ${alvo(l.id, ci) ? confirmar() : ''}${cel.visiveis.map((d) => pecaHtml(d, l.id, ci)).join('')}${filtradas(cel)}</div>`;
    const cabCol = (c, ci) => { const a = g.agencia[ci];
      return `<div class="v2o-sem-dia${ehHoje(c) ? ' hoje' : ''}"><b>${DOW[dowDe(c.inicio)]} ${c.inicio.slice(8, 10)}</b><small>${plural(a.pecas.length, 'peça', 'peças')}</small>${a.formatos.length || a.repetidos.length ? `<span class="v2o-sem-avisos">${fmtHtml(a.formatos)}${repHtml(a.repetidos)}</span>` : ''}</div>`; };
    const pessoaCab = (l) => { if (!l.id) return '<div class="v2o-sem-quem"><b>Sem ninguém</b><small>arraste para alguém</small></div>';
      const p = time.find((t) => String(t.id) === l.id) || {};
      return `<div class="v2o-sem-quem"><b>${quem(l.id)}</b><small>${esc(p.papel || (l.disciplina === 'audiovisual' ? 'Audiovisual' : 'Design'))}</small><small>${plural(I.porPessoa[l.id] || 0, 'aberta', 'abertas')} · ${n0(l.limite)}/dia</small></div>`; };
    const linhasTodas = [...g.linhas, ...(g.ninguem ? [g.ninguem] : [])];
    const celDe = (l, ci) => (ci < 0 ? l.antes : l.celulas[ci]);
    // Semana e Hoje: pessoa × dia. Mês: o calendário (seg a dom), cada dia com as peças da ficha aberta.
    let corpo;
    if (g.periodo !== 'mes') {
      const cols = `${temAntes ? 'minmax(118px,.7fr) ' : ''}repeat(${g.cols.length}, minmax(0,1fr))`;
      corpo = `<div class="v2o-sem-grade" style="--cols:${cols}" role="grid" aria-label="Peças por pessoa e dia">
        <div class="v2o-sem-linha cab" role="row"><div class="v2o-sem-quem"></div>${temAntes ? '<div class="v2o-sem-dia antes"><b>Antes</b><small>vencidas</small></div>' : ''}${g.cols.map(cabCol).join('')}</div>
        ${linhasTodas.map((l) => `<div class="v2o-sem-linha${l.id ? '' : ' ninguem'}" role="row">${pessoaCab(l)}${temAntes ? celHtml(l, l.antes, -1) : ''}${l.celulas.map((c, ci) => celHtml(l, c, ci)).join('')}</div>`).join('')}</div>`;
    } else {
      const uma = linhasTodas.length === 1 ? linhasTodas[0] : null;
      const dia = (c, ci) => {
        const cel = uma ? uma.celulas[ci] : g.agencia[ci], a = g.agencia[ci];
        const acima = uma ? [] : g.linhas.filter((l) => l.celulas[ci].passou);
        const pecas = uma ? cel.visiveis.map((d) => pecaHtml(d, uma.id, ci)) : a.visiveis.map((d) => { const de = donos(d)[0] || ''; return pecaHtml(d, de, ci, true); });
        const souAlvo = P && P.col === ci;
        return `<div class="v2o-cal-dia${c.fora ? ' fora' : ''}${ehHoje(c) ? ' hoje' : ''}${(uma ? cel.passou : acima.length) ? ' passou' : ''}${souAlvo ? ' alvo' : ''}" data-coord-solta data-manter data-pessoa="${esc(uma ? uma.id : '')}" data-col="${ci}">
          <span class="v2o-cal-top"><b>${c.inicio.slice(8, 10)}</b>${uma ? contaHtml(uma, cel) : (a.pecas.length ? `<span class="v2o-conta">${n0(a.pecas.length)}</span>` : '')}${acima.map((l) => `<span class="v2o-aviso r"><i aria-hidden="true"></i>${quem(l.id)} ${n0(l.celulas[ci].n)}/${n0(l.celulas[ci].limite)}</span>`).join('')}${uma ? repHtml(cel.repetidos) : ''}${fmtHtml(a.formatos)}${repHtml(a.repetidos)}</span>
          ${souAlvo ? confirmar() : ''}${pecas.join('')}${filtradas(uma ? cel : a)}</div>`; };
      corpo = `<div class="v2o-cal" role="grid" aria-label="Calendário do mês">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<span class="v2o-cal-dow">${DOW[w]}</span>`).join('')}${g.cols.map(dia).join('')}</div>`;
    }
    // Celular: lista por dia, com os mesmos menus; o OK aparece no topo do dia de destino. No Mês, só os dias com peça.
    const lista = `<div class="v2o-sem-lista">${[...(temAntes && g.periodo !== 'mes' ? [-1] : []), ...g.cols.map((_, i) => i)].map((ci) => {
        const c = g.cols[ci], grupos = linhasTodas.filter((l) => celDe(l, ci).n || alvo(l.id, ci) || (g.periodo === 'mes' && P && P.col === ci && P.de === l.id));
        if (g.periodo === 'mes' && !grupos.length) return '';
        return `<section class="v2o-sem-ldia${c && ehHoje(c) ? ' hoje' : ''}" aria-label="${esc(!c ? 'Antes' : `${DOW[dowDe(c.inicio)]} ${dm(c.inicio)}`)}">${c ? cabCol(c, ci) : '<div class="v2o-sem-dia antes"><b>Antes</b><small>vencidas</small></div>'}${P && P.col === ci ? confirmar() : ''}
          ${grupos.map((l) => { const cel = celDe(l, ci); return `<div class="v2o-sem-lpes"><span class="v2o-sem-lquem"><b>${quem(l.id)}</b>${contaHtml(l, cel)}${repHtml(cel.repetidos)}</span>${cel.visiveis.map((d) => pecaHtml(d, l.id, ci)).join('')}${filtradas(cel)}</div>`; }).join('') || '<p class="v2o-nota">Nada neste dia.</p>'}</section>`; }).join('') || '<p class="v2o-nota">Nada neste mês.</p>'}</div>`;
    const resumo = resumoTexto(g);
    const escolha = (rot, chave, valor, opcoes, vazio) => (typeof G.vbEscolhaHtml === 'function' ? G.vbEscolhaHtml({ rotulo: rot, valor, opcoes, vazio, campo: `data-coord-filtro="${chave}"` })
      : `<label class="v2o-sem-sel"><span>${esc(rot)}</span><select data-coord-filtro="${chave}"><option value="">${esc(vazio)}</option>${opcoes.map((o) => `<option value="${esc(o.valor)}"${String(o.valor) === String(valor) ? ' selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></label>`);
    const F = sg.filtro, filtrado = Boolean(F.cliente || F.formato || F.setor || sg.busca);
    const filtros = `<div class="v2o-sem-filtros">${escolha('Cliente', 'cliente', F.cliente, g.opcoes.clientes.map((c) => ({ valor: c, nome: c })), 'Todos')}
        ${escolha('Formato', 'formato', F.formato, g.opcoes.formatos.map((c) => ({ valor: c, nome: c })), 'Todos')}
        ${escolha('Setor', 'setor', F.setor, [{ valor: 'design', nome: 'Design' }, { valor: 'audiovisual', nome: 'Audiovisual' }, ...g.opcoes.grupos.map((x) => ({ valor: 'g:' + x, nome: x }))], 'Todos')}
        <input type="search" class="v2o-sem-busca" data-coord-busca value="${esc(sg.busca)}" placeholder="Buscar" aria-label="Buscar peça, cliente ou formato">${filtrado ? '<button type="button" class="v2o-btn" data-coord-sem-limpar>Limpar</button>' : ''}</div>`;
    const cs = colunasDe(st.periodo, hoje, sg.desloca);
    const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const faixa = st.periodo === 'mes' ? (() => { const m = cs.find((c) => !c.fora).inicio; return `${MESES_L[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`; })() : cs.length === 1 ? `${DOW[dowDe(cs[0].inicio)]} ${dm(cs[0].inicio)}` : `${dm(cs[0].inicio)} a ${dm(cs[cs.length - 1].fim)}`;
    const refs = `<div class="v2o-periodo" role="tablist" aria-label="Data da grade">${[['prazo', 'Prazo'], ['veiculacao', 'Veiculação']].map(([k, r]) => `<button type="button" role="tab" aria-selected="${sg.ref === k}" data-coord-sem-ref="${k}">${r}</button>`).join('')}</div>`;
    const anda = `<span class="v2o-sem-anda"><button type="button" class="v2o-btn ic" data-coord-sem-anda="-1" aria-label="Período anterior">‹</button>${sg.desloca ? '<button type="button" class="v2o-btn" data-coord-sem-anda="0">Atual</button>' : ''}<button type="button" class="v2o-btn ic" data-coord-sem-anda="1" aria-label="Próximo período">›</button></span>`;
    // As fichas: uma por pessoa do time (quem olha primeiro), Sem ninguém e Todos; cada uma com as abertas.
    const eu = String((typeof G.operadorDoTopo === 'function' ? G.operadorDoTopo()?.id : '') || '');
    const ordemFichas = [...g.todas].sort((a, b) => (b.id === eu) - (a.id === eu));
    const ficha = (id, rot, n, tom = '') => `<button type="button" aria-pressed="${pessoa === id}" data-coord-sem-pessoa="${esc(id)}">${rot}<small class="${tom}">${n0(n)}</small></button>`;
    const fichas = `<div class="v2o-fichas" role="group" aria-label="De quem">${ordemFichas.map((l) => ficha(l.id, quem(l.id), I.porPessoa[l.id] || 0)).join('')}${ficha('ninguem', 'Sem ninguém', I.ninguem, I.ninguem ? 'a' : '')}${ficha('todos', 'Todos', I.total)}</div>`;
    const fora = g.semData ? `${n0(g.semData)} sem ${sg.ref === 'prazo' ? 'prazo' : 'veiculação'}` : '';
    const grade = `<section class="d3h-cartao v2o-sem" aria-label="Grade ${esc(ROT[st.periodo])}">
        <div class="d3h-cab v2o-sem-cab"><h3>${esc(ROT[st.periodo])}</h3><span class="v2o-sem-faixa">${esc(faixa)}</span>${anda}${refs}</div>
        ${fichas}
        <p class="v2o-sem-resumo" role="status">${resumo.length ? resumo.map((t, i) => `<span class="v2o-aviso${i === 0 && g.resumo.diasAcima ? ' r' : ''}"><i aria-hidden="true"></i>${esc(t)}</span>`).join('') : '<span class="v2o-aviso g"><i aria-hidden="true"></i>Tudo equilibrado</span>'}${fora ? `<small>${esc(fora)} fora da grade</small>` : ''}</p>
        ${sg.msg ? `<p class="v2o-msg" role="status">${esc(sg.msg)}</p>` : ''}
        ${filtros}${corpo}${lista}</section>`;
    // Indicadores: o número abre a lista no lugar; Para aprovação tem Aprovar e Atrasadas tem quem é e Mudar prazo.
    const L = I.listas;
    const SELO_IND = { r: '<path d="M12 7v6M12 17h.01"/>', roxo: '<path d="M9 12l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/>', info: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>' };
    const num = ([k, rot]) => { const n = L[k].length, tom = k === 'atrasadas' && n ? 'r' : k === 'hoje' && n ? 'k' : k === 'aguardando' && n ? 'a' : '';
      const kk = k === 'atrasadas' ? 'r' : k === 'aprovar' || k === 'aguardando' ? 'roxo' : 'info';
      return `<button type="button" class="d3-num d3h-num v2o-ind${tom ? ' ' + tom : ''}" data-k="${kk}" data-coord-ind="${k}" aria-expanded="${sg.ind === k}"><span class="d3-num-rot">${rot}</span><i class="d3h-num-selo" data-k="${kk}" aria-hidden="true"><svg viewBox="0 0 24 24">${SELO_IND[kk]}</svg></i><span class="d3h-num-linha"><span class="d3h-num-txt"><b class="d3-num-v">${n0(n)}</b></span></span></button>`; };
    const linhaInd = (d, k) => { const ids = idsDe(d);
      return `<li class="v2o-il"><span class="v2o-il-cli">${cli(d)}</span><span class="v2o-il-nome" title="${esc(String(d.nome || 'Peça'))}">${esc(String(d.nome || 'Peça').trim())}</span>${formatoChave(d) ? `<span class="v2o-gp-f">${esc(formatoChave(d))}</span>` : ''}${pilulaSt(d)}<span class="v2o-il-q">${ids.length ? ids.map((i) => esc(primeiro(nome(i)))).join(', ') : '<em>sem ninguém</em>'}</span><span class="v2o-gp-datas">${dataBt(d, 'prazo', 'Prazo')}${dataBt(d, 'veiculacao', 'Veic.')}</span>
        <span class="v2o-il-ac">${k === 'aprovar' ? `<button type="button" class="v2o-btn k" data-coord-aprovar="${esc(d.id)}">Aprovar</button>` : ''}${k === 'atrasadas' ? `<button type="button" class="v2o-btn" data-coord-mudar-prazo="${esc(d.id)}">Mudar prazo</button>` : ''}${k === 'aguardando' ? `<button type="button" class="v2o-btn" data-coord-menu="passar" data-peca="${esc(d.id)}" data-de="">Atribuir</button>` : ''}<button type="button" class="v2o-btn" data-hoje-acao="peca" data-valor="${esc(d.id)}">Abrir</button></span>
        ${k === 'aguardando' && sg.passando === `${d.id}|` ? `<span class="v2o-gp-para">${g.todas.map((l) => `<button type="button" class="v2o-chip${l.disciplina === disciplinaDe(d) ? '' : ' fora'}" data-coord-sem-para="${esc(l.id)}" data-peca="${esc(d.id)}" data-de="" data-col="-2">${quem(l.id)}</button>`).join('')}<button type="button" class="v2o-btn" data-coord-sem-cancelar>Cancelar</button></span>${P && P.id === String(d.id) && P.col === -2 ? confirmar() : ''}` : (P && P.id === String(d.id) && P.col === -2 ? confirmar() : '')}</li>`; };
    const aberta = sg.ind && L[sg.ind] ? `<section class="d3h-cartao v2o-ind-lista" aria-label="${esc(IND.find((x) => x[0] === sg.ind)[1])}"><div class="d3h-cab"><h3>${esc(IND.find((x) => x[0] === sg.ind)[1])}</h3><button type="button" class="v2o-btn" data-coord-ind="${sg.ind}">Fechar</button></div><ul class="v2o-il-ul">${L[sg.ind].slice(0, 40).map((d) => linhaInd(d, sg.ind)).join('') || '<li class="v2o-nota">Nada aqui.</li>'}</ul>${L[sg.ind].length > 40 ? `<p class="v2o-nota">+ ${n0(L[sg.ind].length - 40)} na grade</p>` : ''}</section>` : '';
    const nums = `<div class="v2o-inds" role="group" aria-label="Indicadores da produção">${IND.map(num).join('')}</div>`;
    // A faixa laranja: o que pede ação agora, na ordem atrasadas → no ar hoje → para aprovação.
    const prio = [L.atrasadas.length ? [plural(L.atrasadas.length, 'atrasada', 'atrasadas'), 'atrasadas', 'Ver atrasadas'] : null, L.hoje.length ? [`${n0(L.hoje.length)} no ar hoje`, 'hoje', 'Ver hoje'] : null, L.aprovar.length ? [`${n0(L.aprovar.length)} para aprovar`, 'aprovar', 'Aprovar'] : null].filter(Boolean);
    const faixaAcao = prio.length ? `<section class="d3-acao d3h-acao d3v-laranja d3v-lar-faixa" aria-label="O que pede ação agora"><span class="d3v-lar-rot"><span class="d3-acao-av" aria-hidden="true">H</span>Heitor · coordenação</span><span class="d3v-lar-txt"><span class="d3-acao-frase">${prio.map((x) => x[0]).join(' · ')}.</span></span><span class="d3v-lar-bts"><button type="button" class="d3-acao-btn" data-coord-ind="${prio[0][1]}">${prio[0][2]}</button></span></section>` : '';
    return { faixa: faixaAcao, nums, html: `<div class="v2o-man">${aberta}${grade}</div>` };
  }

  // O pedido do arrastar ou do "Passar para…": quem recebe, a data nova (na referência ativa) e os avisos da regra.
  function montarPedido({ id, de, para, col }) {
    const U = ultimaGrade; if (!U) return null;
    const item = typeof G.findOperationalItem === 'function' ? G.findOperationalItem(id) : null;
    if (!item) { sg.msg = 'A peça não está carregada agora. Abra as demandas e tente de novo.'; return null; }
    const g = U.g, campo = g.ref, dataDe = String((campo === 'prazo' ? item.prazo_iso : item.veiculacao_iso) || '').slice(0, 10);
    const dataPara = col >= 0 && g.cols[col] ? g.cols[col].inicio : dataDe;
    const prazo = campo === 'prazo' ? dataPara : String(item.prazo_iso || '').slice(0, 10), veic = campo === 'veiculacao' ? dataPara : String(item.veiculacao_iso || '').slice(0, 10);
    const avisos = [];
    if (dataPara !== dataDe && campo === 'veiculacao') avisos.push({ t: 'Data do cliente' });
    if (dataPara !== dataDe && prazo && veic && prazo > veic) avisos.push({ t: 'Prazo depois da veiculação' });
    else if (dataPara !== dataDe && prazo && veic) { const folga = Math.round((new Date(`${veic}T12:00:00`) - new Date(`${prazo}T12:00:00`)) / 864e5); if (folga < 7) avisos.push({ t: `${plural(folga, 'dia', 'dias')} antes do ar` }); }
    const linha = g.todas.find((l) => l.id === para), cel = linha && col >= 0 ? linha.celulas[col] : null;
    if (cel && (para !== de || dataPara !== dataDe)) { const depois = cel.n + 1; if (depois > cel.limite) avisos.push({ t: `Passa do limite: ${n0(depois)}/${n0(cel.limite)}`, r: true }); }
    if (linha && para !== de && linha.disciplina !== disciplinaDe(item)) avisos.push({ t: 'Fora da disciplina' });
    if (para === de && dataPara === dataDe) return null;
    return { id: String(item.id), nome: String(item.nome || 'Peça').trim(), de, para, col, campo, dataDe, dataPara, avisos };
  }

  // Grava o pedido pelas funções de sempre e oferece "Desfazer". Devolve true quando tudo gravou.
  async function executarPedido() {
    const P = sg.pedido; if (!P || sg.gravando) return false;
    const item = typeof G.findOperationalItem === 'function' ? G.findOperationalItem(P.id) : null;
    if (!item) { sg.msg = 'A peça não está carregada agora. Abra as demandas e tente de novo.'; sg.pedido = null; repintar(); return false; }
    const trocaPessoa = P.para !== P.de, trocaData = P.dataPara !== P.dataDe;
    if (trocaPessoa && typeof G.gravarResponsaveisDaPeca !== 'function') { sg.msg = 'O painel ainda não carregou a edição de responsáveis.'; sg.pedido = null; repintar(); return false; }
    if (trocaData && typeof G.moverDataDoItem !== 'function') { sg.msg = 'O painel ainda não carregou a edição de datas.'; sg.pedido = null; repintar(); return false; }
    const antes = idsDe(item), novos = [...new Set([...antes.filter((i) => i !== P.de), P.para].filter(Boolean))];
    sg.gravando = true; sg.msg = ''; repintar();
    const feito = { pessoa: false, data: false };
    try {
      if (trocaPessoa) { G.armOutboundMutationGuard?.('responsáveis'); await G.gravarResponsaveisDaPeca(item, novos); feito.pessoa = true; G.saveProductionCache?.(); }
      if (trocaData) { await G.moverDataDoItem(item, P.campo, P.dataPara, { request: false }); feito.data = true; }
      G.renderIntegratedOperationalViews?.();
    } catch (e) {
      sg.msg = `${feito.pessoa ? 'O responsável mudou, mas a data não gravou' : 'Não gravou'}: ${e?.message || e}`;
    }
    sg.gravando = false; sg.pedido = null; sg.passando = ''; repintar();
    if (feito.pessoa || feito.data) {
      const nomePara = (G.TEAM_USERS || (typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [])).find((u) => String(u.id) === P.para)?.name;
      const frase = [feito.pessoa ? `com ${nomePara ? primeiro(nomePara) : 'a pessoa'}` : '', feito.data ? `${P.campo === 'prazo' ? 'prazo' : 'veiculação'} ${dm(P.dataPara)}` : ''].filter(Boolean).join(' · ');
      G.mostrarDesfazer?.(`${P.nome}: ${frase}`, async () => {
        // A peça de novo, como está agora: a cópia de antes ainda tem a data velha e moverDataDoItem acharia que não mudou.
        const atual = G.findOperationalItem(P.id) || item;
        try {
          if (feito.data) await G.moverDataDoItem(atual, P.campo, P.dataDe, { request: false });
          if (feito.pessoa) { G.armOutboundMutationGuard?.('responsáveis'); await G.gravarResponsaveisDaPeca(atual, antes); G.saveProductionCache?.(); }
          G.renderIntegratedOperationalViews?.();
        } catch (e) { sg.msg = `Não desfez: ${e?.message || e}`; }
        repintar();
      });
    }
    return !sg.msg;
  }

  // Mudar prazo ou veiculação no lugar (o campo de data ali mesmo; Enter grava, Esc desiste), pela mesma moverDataDoItem.
  function editarData(alvo, id, campo) {
    const item = typeof G.findOperationalItem === 'function' ? G.findOperationalItem(id) : null;
    if (!item || typeof G.moverDataDoItem !== 'function' || typeof G.vbEditarDataNoLugar !== 'function' || !alvo) return false;
    const antigo = String((campo === 'prazo' ? item.prazo_iso : item.veiculacao_iso) || '').slice(0, 10);
    G.vbEditarDataNoLugar(alvo, { valor: antigo, rotulo: campo === 'prazo' ? 'Mudar o prazo' : 'Mudar a veiculação (data do cliente)', aoSalvar: async (iso) => {
      await G.moverDataDoItem(item, campo, iso, { request: false });
      G.mostrarDesfazer?.(`${campo === 'prazo' ? 'Prazo' : 'Veiculação'} foi para ${dm(iso)}`, async () => { try { await G.moverDataDoItem(G.findOperationalItem(id) || item, campo, antigo, { request: false }); } catch (e) { sg.msg = `Não desfez: ${e?.message || e}`; } repintar(); });
      repintar();
    } });
    return true;
  }

  // Aprovar pelo portão de sempre: o status depois da aprovação ("Para agendar" ou o seguinte do quadro, nunca Alteração)
  // vai por updateFocusStatus (vybe-status.js), que abre a conferência e o checklist de qualidade antes de gravar.
  function aprovar(id) {
    const item = typeof G.findOperationalItem === 'function' ? G.findOperationalItem(id) : null;
    if (!item) { sg.msg = 'A peça não está carregada agora. Abra as demandas e tente de novo.'; return false; }
    if (typeof G.updateFocusStatus !== 'function') { sg.msg = 'O painel ainda não carregou a troca de status.'; return false; }
    const opcoes = ((typeof G.operationalStatusOptions === 'function' ? G.operationalStatusOptions(item) : G.STATUS_OPTIONS) || []).filter((o) => o && o.label && o.ativa !== false);
    const seguinte = typeof G.proximoStatusDaPeca === 'function' ? G.proximoStatusDaPeca(item) : null;
    const serve = (o) => o && !/altera/.test(norm(o.label)) && norm(o.label) !== norm(item.status);
    const destino = opcoes.find((o) => norm(o.label) === 'para agendar') || (serve(seguinte) ? seguinte : null);
    if (!destino) { sg.msg = 'O quadro desta peça não tem o status depois da aprovação.'; return false; }
    G.updateFocusStatus(item.id, destino.label);
    return true;
  }

  const ALVOS = ['data-coord-sem-ref', 'data-coord-sem-anda', 'data-coord-sem-pessoa', 'data-coord-menu', 'data-coord-sem-para', 'data-coord-sem-ok', 'data-coord-sem-cancelar', 'data-coord-sem-limpar', 'data-coord-data', 'data-coord-ind', 'data-coord-aprovar', 'data-coord-mudar-prazo', 'data-coord-heitor'];
  const SEL_GRADE = ALVOS.map((a) => `#vv-hoje .v2o [${a}]`).join(',');
  function aoClicarGrade(ev) {
    const b = ev.target.closest?.(SEL_GRADE);
    if (!b) return;
    ev.stopPropagation();
    if (sg.gravando) return;
    const ds = b.dataset;
    if (ds.coordData) { ev.preventDefault?.(); editarData(b, ds.peca, ds.coordData); return; }
    if (ds.coordMenu === 'prazo' || ds.coordMenu === 'veiculacao') {
      b.closest('details')?.removeAttribute?.('open');
      editarData(b.closest('.v2o-gp')?.querySelector(`[data-coord-data="${ds.coordMenu}"]`), ds.peca, ds.coordMenu); return;
    }
    if (ds.coordMudarPrazo) { editarData(b.closest('.v2o-il')?.querySelector('[data-coord-data="prazo"]'), ds.coordMudarPrazo, 'prazo'); return; }
    if (ds.coordAprovar) { sg.msg = ''; if (!aprovar(ds.coordAprovar)) repintar(); return; }
    if (b.hasAttribute('data-coord-heitor')) { sg.heitor = !sg.heitor; guardarGrade(); }
    else if (ds.coordInd) { sg.ind = sg.ind === ds.coordInd ? '' : ds.coordInd; sg.passando = ''; sg.pedido = null; }
    else if (ds.coordSemPessoa) { sg.pessoa = ds.coordSemPessoa; sg.passando = ''; sg.pedido = null; guardarGrade(); }
    else if (ds.coordSemRef) { sg.ref = ds.coordSemRef; sg.pedido = null; guardarGrade(); }
    else if (ds.coordSemAnda != null) { sg.desloca = Number(ds.coordSemAnda) === 0 ? 0 : sg.desloca + Number(ds.coordSemAnda); sg.pedido = null; }
    else if (ds.coordMenu === 'passar') { b.closest('details')?.removeAttribute?.('open'); sg.passando = `${ds.peca}|${ds.de}`; sg.pedido = null; }
    else if (ds.coordSemPara != null) { sg.pedido = montarPedido({ id: ds.peca, de: ds.de, para: ds.coordSemPara, col: Number(ds.col) }); if (sg.pedido) sg.passando = ''; }
    else if (b.hasAttribute('data-coord-sem-ok')) { executarPedido(); return; }
    else if (b.hasAttribute('data-coord-sem-cancelar')) { sg.pedido = null; sg.passando = ''; }
    else if (b.hasAttribute('data-coord-sem-limpar')) { sg.filtro = { cliente: '', formato: '', setor: '' }; sg.busca = ''; }
    if (!sg.pedido) sg.msg = '';
    repintar();
  }

  // Arrastar (computador): solta na célula de outra pessoa e/ou de outro dia; o OK aparece na célula de destino. No
  // calendário do Mês (data-manter) a peça fica com quem está e só muda de dia.
  let arrasto = null;
  function aoArrastar(ev) {
    const t = ev.target?.closest?.('#vv-hoje .v2o-man [data-coord-arrasta]');
    if (ev.type === 'dragstart') {
      if (!t || sg.gravando) return;
      arrasto = { id: t.dataset.coordArrasta, de: t.dataset.de || '' };
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', arrasto.id); } catch { /* sem dataTransfer */ }
      t.classList?.add('arrastando'); return;
    }
    const cel = ev.target?.closest?.('#vv-hoje .v2o-man [data-coord-solta]');
    if (ev.type === 'dragend') { arrasto = null; document.querySelectorAll?.('#vv-hoje .v2o-man .solta-aqui, #vv-hoje .v2o-man .arrastando').forEach((x) => x.classList.remove('solta-aqui', 'arrastando')); return; }
    if (!arrasto || !cel) return;
    if (ev.type === 'dragover') { ev.preventDefault(); try { ev.dataTransfer.dropEffect = 'move'; } catch { /* sem dataTransfer */ } cel.classList?.add('solta-aqui'); return; }
    if (ev.type === 'dragleave') { if (!cel.contains?.(ev.relatedTarget)) cel.classList?.remove('solta-aqui'); return; }
    if (ev.type === 'drop') {
      ev.preventDefault();
      const a = arrasto; arrasto = null;
      const para = cel.hasAttribute('data-manter') ? (cel.dataset.pessoa || a.de) : (cel.dataset.pessoa || '');
      sg.pedido = montarPedido({ id: a.id, de: a.de, para, col: Number(cel.dataset.col) });
      sg.passando = ''; repintar();
    }
  }
  function aoMudarFiltro(ev) {
    const c = ev.target?.closest?.('#vv-hoje .v2o-man [data-coord-filtro], #vv-hoje .v2o-man [data-coord-busca]');
    if (!c) return;
    if (c.hasAttribute('data-coord-busca')) {
      if (ev.type !== 'input') return;
      sg.busca = c.value; const pos = c.selectionStart; repintar();
      const novo = document.querySelector('#vv-hoje .v2o-man [data-coord-busca]'); if (novo && novo !== c) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch { /* campo sem seleção */ } }
      return;
    }
    if (ev.type !== 'change') return;
    sg.filtro = { ...sg.filtro, [c.dataset.coordFiltro]: c.value }; repintar();
  }

  // Devolve true quando gravou (o lote conta por aqui).
  async function gravar(chave) {
    // O id da peça pode ter ":" (as do Vybe OS vêm como "vybe:123"): as pessoas são as últimas partes da chave.
    const partes = chave.split(':'), tipo = partes[0], nPessoas = tipo === 'trocar' ? 2 : 1;
    const id = partes.slice(1, -nPessoas).join(':'), [a, b] = partes.slice(-nPessoas);
    const item = typeof G.findOperationalItem === 'function' ? G.findOperationalItem(id) : null;
    if (!item) { st.msg = 'A peça não está carregada agora. Abra as demandas e tente de novo.'; st.confirmando = ''; repintar(); return false; }
    if (typeof G.gravarResponsaveisDaPeca !== 'function') { st.msg = 'O painel ainda não carregou a edição de responsáveis.'; st.confirmando = ''; repintar(); return false; }
    const para = tipo === 'atribuir' ? a : b, de = tipo === 'trocar' ? a : '';
    const novos = [...new Set([...idsDe(item).filter((i) => i !== de), para])];
    st.gravando = chave; st.confirmando = ''; repintar();
    let ok = false;
    try {
      await G.gravarResponsaveisDaPeca(item, novos);
      G.saveProductionCache?.(); G.renderIntegratedOperationalViews?.();
      const nome = (G.TEAM_USERS || (typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [])).find((u) => String(u.id) === para)?.name;
      st.msg = ''; G.showToast?.(`${item.nome || 'Peça'} ficou com ${nome ? primeiro(nome) : 'a pessoa'}.`, 'ok', 4200); ok = true;
    } catch (e) { st.msg = `Não gravou: ${e?.message || e}`; }
    st.gravando = ''; repintar();
    return ok;
  }

  // Direção 3 (quadro D3-Coordenacao): "Confirmar N" no pé de Para equilibrar faz o mesmo que N confirmações da linha
  // (gravar, uma por vez, na ordem da tela): as atribuições sugeridas (o contorno) e as trocas. O 1º clique só pergunta e
  // guarda o que está na tela; o OK roda. O botão conta o estado: Confirmar N → Confirmando i/N… → Confirmado.
  const chavesDoLote = (r) => [...r.semDono.filter((x) => x.sugerido).map((x) => `atribuir:${x.d.id}:${x.sugerido}`), ...r.trocas.map((t) => `trocar:${t.d.id}:${t.de}:${t.para}`)];
  function loteHtml(r) {
    const L = st.lote, chaves = chavesDoLote(r), n = chaves.length, R = !L.rodando ? L.resultado : null;
    if (!n && !L.rodando && !R) return '';
    const na = chaves.filter((c) => c.startsWith('atribuir:')).length, nt = n - na;
    if (L.pergunta && !L.rodando) {
      const qa = L.chaves.filter((c) => c.startsWith('atribuir:')).length, qt = L.chaves.length - qa;
      const frase = [qa ? `atribuir ${plural(qa, 'peça', 'peças')}` : '', qt ? `fazer ${plural(qt, 'troca', 'trocas')}` : ''].filter(Boolean).join(' e ');
      return `<div class="v2o-lote" role="group" aria-label="Confirmar o lote"><span class="v2o-lote-conta">${frase.charAt(0).toUpperCase() + frase.slice(1)}, uma por vez?</span>
        <button type="button" class="v2o-btn" data-coord-lote-voltar>Voltar</button><button type="button" class="v2o-btn k v2-estado" data-coord-lote-ok>Confirmar ${L.chaves.length}</button></div>`;
    }
    const feito = R && !R.falhas && !n;
    const rotulo = L.rodando ? `<i class="v2o-gira" aria-hidden="true"></i>Confirmando ${L.i}/${L.n}…`
      : feito ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>Confirmado ${R.ok}` : `Confirmar ${n}`;
    const conta = R?.falhas ? `<span class="v2o-lote-conta erro" role="status">${R.ok} de ${R.n} feitas · ${plural(R.falhas, 'falhou', 'falharam')}</span>`
      : `<span class="v2o-lote-conta">${[na ? plural(na, 'entrega', 'entregas') : '', nt ? plural(nt, 'troca', 'trocas') : ''].filter(Boolean).join(' + ') || 'nada pendente'} · só com o seu OK</span>`;
    return `<div class="v2o-lote">${conta}<button type="button" class="v2o-btn k v2-estado${L.rodando ? ' rodando' : ''}" data-coord-lote${feito ? ' data-estado="feito"' : ''}${!n || L.rodando || st.gravando ? ' disabled' : ''} aria-live="polite">${rotulo}</button></div>`;
  }
  async function confirmarLote() {
    const L = st.lote; if (L.rodando || st.gravando || !L.chaves.length) return null;
    const chaves = [...L.chaves];
    Object.assign(L, { pergunta: false, rodando: true, i: 0, n: chaves.length, resultado: null });
    let ok = 0;
    for (const chave of chaves) { L.i += 1; if (await gravar(chave)) ok += 1; }
    Object.assign(L, { rodando: false, chaves: [], resultado: { ok, falhas: chaves.length - ok, n: chaves.length } });
    if (L.resultado.falhas) st.msg = `${plural(L.resultado.falhas, 'confirmação não gravou', 'confirmações não gravaram')}; as outras ficaram.`;
    repintar();
    return L.resultado;
  }

  function aoClicar(ev) {
    const b = ev.target.closest?.('#vv-hoje .v2o [data-coord-periodo],#vv-hoje .v2o [data-coord-pessoa],#vv-hoje .v2o [data-coord-atribuir],#vv-hoje .v2o [data-coord-trocar],#vv-hoje .v2o [data-coord-ok],#vv-hoje .v2o [data-coord-cancelar],#vv-hoje .v2o [data-coord-lote],#vv-hoje .v2o [data-coord-lote-ok],#vv-hoje .v2o [data-coord-lote-voltar]');
    if (!b) return;
    ev.stopPropagation();
    if (st.lote.rodando) return;
    if (b.hasAttribute('data-coord-lote')) { if (st.gravando || !ultima) return; Object.assign(st.lote, { pergunta: true, chaves: chavesDoLote(ultima.r), resultado: null }); st.confirmando = ''; st.msg = ''; repintar(); return; }
    if (b.hasAttribute('data-coord-lote-ok')) { confirmarLote(); return; }
    if (b.hasAttribute('data-coord-lote-voltar')) { Object.assign(st.lote, { pergunta: false, chaves: [] }); repintar(); return; }
    if (b.dataset.coordPeriodo) { st.periodo = b.dataset.coordPeriodo; st.aberta = ''; st.confirmando = ''; try { localStorage.setItem('vybe.coordenacao.periodo', st.periodo); } catch { /* fica nesta tela */ } }
    else if (b.dataset.coordPessoa) { st.aberta = st.aberta === b.dataset.coordPessoa ? '' : b.dataset.coordPessoa; st.confirmando = ''; }
    else if (b.dataset.coordAtribuir) st.confirmando = `atribuir:${b.dataset.coordAtribuir}:${b.dataset.para}`;
    else if (b.dataset.coordTrocar) st.confirmando = `trocar:${b.dataset.coordTrocar}:${b.dataset.de}:${b.dataset.para}`;
    else if (b.hasAttribute('data-coord-cancelar')) st.confirmando = '';
    else if (b.dataset.coordOk) { gravar(b.dataset.coordOk); return; }
    st.msg = ''; repintar();
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', aoClicar, true);
    document.addEventListener('click', aoClicarGrade, true);
    for (const t of ['dragstart', 'dragover', 'dragleave', 'drop', 'dragend']) document.addEventListener(t, aoArrastar);
    document.addEventListener('change', aoMudarFiltro, true); document.addEventListener('input', aoMudarFiltro, true);
  }

  G.VybeCoordenacao = { calcular, html, janelaDe, disciplinaDe, ultima: () => ultima, gradeCalcular, colunasDe, resumoTexto, indicadores, ultimaGrade: () => ultimaGrade, estadoGrade: () => sg };
})(typeof window !== 'undefined' ? window : globalThis);
