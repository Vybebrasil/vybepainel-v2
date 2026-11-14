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

  function html({ itens, time, hoje, peso, data, abas = '', nome = (id) => id, cliente = (d) => d.cliente || '' }) {
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
    const faixa = `<section class="d3-acao d3h-acao" aria-label="Heitor, coordenação de produção"><span class="d3-acao-av" aria-hidden="true">H</span><span class="d3-acao-frase" title="${esc(frasesDoHeitor(r, nome).replace(/<[^>]+>/g, ''))}">${partes.join(' · ')}.</span>${botao}</section>`;
    const periodos = `<div class="v2o-periodo" role="tablist" aria-label="Período">${['dia', 'semana', 'mes'].map((p) => `<button type="button" role="tab" aria-selected="${st.periodo === p}" data-coord-periodo="${p}">${ROT[p]}</button>`).join('')}</div>`;
    const porDisc = (l) => { const m = {}; for (const x of l) m[x.disciplina] = (m[x.disciplina] || 0) + 1; return Object.entries(m).map(([k, n]) => `${n} ${k === 'audiovisual' ? 'motion' : k}`).join(' · '); };
    const totPontos = r.pessoas.reduce((s, p) => s + p.pontos, 0), totLimite = r.pessoas.reduce((s, p) => s + p.limite, 0), pctTime = totLimite ? Math.round(totPontos / totLimite * 100) : 0;
    const num = (rot, v, { de = '', sub = '', tom = '', subTom = '', barra = null } = {}) => `<div class="d3-num d3h-num${tom ? ' ' + tom : ''}"><span class="d3-num-rot">${rot}</span><span class="d3h-num-linha"><b class="d3-num-v">${v}${de ? `<small>${de}</small>` : ''}</b></span>${barra != null ? `<span class="d3-barra" style="--v:${Math.max(0, Math.min(100, barra))}%"><i></i></span>` : ''}${sub ? `<span class="d3h-num-sub${subTom ? ' ' + subTom : ''}">${sub}</span>` : ''}</div>`;
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
    return `<div class="d3h d3h-co v2o"><div class="d3h-topo"><div class="d3h-ola"><h2>Hoje</h2><small>${esc(faixaDe(r))}</small>${periodos}</div><div class="d3h-topo-dir">${abas}</div></div>
      ${faixa}${aviso}
      ${numeros}
      <div class="d3h-grade"><div class="d3h-col">${semDono}${trocas}</div><div class="d3h-col">${carga}</div><div class="d3h-col">${pessoas}</div></div></div>`;
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
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', aoClicar, true);

  G.VybeCoordenacao = { calcular, html, janelaDe, disciplinaDe, ultima: () => ultima };
})(typeof window !== 'undefined' ? window : globalThis);
