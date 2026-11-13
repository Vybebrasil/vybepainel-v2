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
  const st = { periodo: 'semana', aberta: '', confirmando: '', gravando: '', msg: '' };
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

  function html({ itens, time, hoje, peso, data, abas = '', nome = (id) => id, cliente = (d) => d.cliente || '' }) {
    const r = calcular({ itens, time, hoje, periodo: st.periodo, peso });
    ultima = { r, itens };
    const quem = (id) => esc(primeiro(nome(id)));
    const linhaPeca = (d) => `<span class="v2o-peca"><b>${esc(String(d.nome || 'Peça').trim())}</b><small>${esc(cliente(d))}${cliente(d) ? ' · ' : ''}${esc(d.status || 'Sem status')} · ${dataDe(d) < hoje ? `<em class="ruim">ia ao ar ${diaBr(dataDe(d))}</em>` : dataDe(d) === hoje ? 'hoje' : diaBr(dataDe(d))}</small></span>`;
    const pessoaDe = (id) => r.pessoas.find((p) => p.id === id);
    const fala = `<section class="v2t-fala" aria-label="Heitor, coordenação de produção"><span class="vg-av" aria-hidden="true">H</span><p><span class="v2t-quem">Heitor · Coordenação de produção</span>${frasesDoHeitor(r, nome)}</p></section>`;
    const periodos = `<div class="v2o-periodo" role="tablist" aria-label="Período">${['dia', 'semana', 'mes'].map((p) => `<button type="button" role="tab" aria-selected="${st.periodo === p}" data-coord-periodo="${p}">${ROT[p]}</button>`).join('')}</div>`;
    const semDono = r.semDono.length ? `<section class="v2o-cartao v2o-semdono" aria-label="Sem ninguém atribuído"><div class="v2a-cab"><h3>Sem ninguém atribuído</h3><small>${plural(r.semDono.length, 'demanda', 'demandas')} · atribuir para quem?</small></div>
        <ul>${r.semDono.slice(0, 8).map((x) => { const chave = `atribuir:${x.d.id}:`;
          return `<li>${linhaPeca(x.d)}<span class="v2o-quem">${x.ordem.map((id) => { const p = pessoaDe(id);
            return `<button type="button" class="v2o-chip${id === x.sugerido ? ' sugerido' : ''}" data-coord-atribuir="${esc(x.d.id)}" data-para="${esc(id)}" title="${quem(id)}: ${n0(p.pontos)} de ${n0(p.limite)} pontos">${quem(id)} <small>${n0(p.pct)}%</small></button>`; }).join('') || '<small>ninguém da disciplina</small>'}</span>
            ${x.ordem.map((id) => confirmarHtml(chave + id, `Atribuir a ${quem(id)}?`)).join('')}</li>`; }).join('')}</ul>
        ${r.semDono.length > 8 ? `<p class="v2o-nota">e mais ${n0(r.semDono.length - 8)} no Painel de trabalho, em "Sem dono".</p>` : ''}</section>` : '';
    const trocas = `<section class="v2o-cartao" aria-label="Sugestões para equilibrar"><div class="v2a-cab"><h3>Para equilibrar</h3><small>${r.trocas.length ? 'sugestões do Heitor' : 'nada a trocar'}</small></div>
        ${r.trocas.length ? `<ul>${r.trocas.map((t) => { const chave = `trocar:${t.d.id}:${t.de}:${t.para}`, de = pessoaDe(t.de), para = pessoaDe(t.para);
          return `<li>${linhaPeca(t.d)}<span class="v2o-porque">de <b>${quem(t.de)}</b> (${n0(de.pct)}%) para <b>${quem(t.para)}</b> (${n0(para.pct)}%)</span>
            ${confirmarHtml(chave, `Passar para ${quem(t.para)}?`) || `<button type="button" class="v2o-btn" data-coord-trocar="${esc(t.d.id)}" data-de="${esc(t.de)}" data-para="${esc(t.para)}">Passar</button>`}</li>`; }).join('')}</ul>`
          : `<p class="v2o-nota">${r.pessoas.some((p) => p.pct > 100) ? 'Quem passou do limite só tem peças já começadas ou de mais de uma pessoa: troque à mão abrindo a pessoa.' : 'A carga está dentro do limite de todo mundo.'}</p>`}</section>`;
    const time2 = `<section class="v2o-cartao v2o-time" aria-label="Carga do time"><div class="v2a-cab"><h3>Carga do time</h3><small>${esc(ROT[r.periodo])} · ${diaBr(r.inicio)}${r.fim !== r.inicio ? ' a ' + diaBr(r.fim) : ''}</small></div>
        ${r.pessoas.map((p) => { const aberta = st.aberta === p.id;
          return `<div class="v2o-pes${aberta ? ' aberta' : ''}"><button type="button" class="v2o-pes-linha" data-coord-pessoa="${esc(p.id)}" aria-expanded="${aberta}"><i aria-hidden="true">${esc(primeiro(nome(p.id)).slice(0, 2).toUpperCase())}</i>
              <span><span><b>${quem(p.id)}</b> · ${esc(p.papel || '')}</span><span class="v2-barra" style="--v:${Math.min(100, p.pct)}%;--c:${COR[p.nivel]}"><i></i></span>
              <small>${n0(p.pontos)} de ${n0(p.limite)} pontos · ${plural(p.pecas.length, 'peça', 'peças')}${p.atrasadas ? ` · <b class="ruim">${plural(p.atrasadas, 'atrasada', 'atrasadas')}</b>` : ''} · <em style="color:${COR[p.nivel]}">${NIVEL[p.nivel]}</em></small></span></button>
            ${aberta ? `<ul class="v2o-lista">${p.pecas.map((d) => { const outros = r.pessoas.filter((o) => o.id !== p.id && o.disciplina === disciplinaDe(d));
                return `<li>${linhaPeca(d)}${outros.map((o) => confirmarHtml(`trocar:${d.id}:${p.id}:${o.id}`, `Passar para ${quem(o.id)}?`)).join('') || `<span class="v2o-quem">${outros.map((o) => `<button type="button" class="v2o-chip" data-coord-trocar="${esc(d.id)}" data-de="${esc(p.id)}" data-para="${esc(o.id)}">${quem(o.id)} <small>${n0(o.pct)}%</small></button>`).join('') || '<small>ninguém mais da disciplina</small>'}</span>`}</li>`; }).join('') || '<li class="v2o-nota">Nada neste período.</li>'}</ul>` : ''}</div>`; }).join('')}
        ${r.semData ? `<p class="v2o-nota">${plural(r.semData, 'demanda sem data e sem ninguém', 'demandas sem data e sem ninguém')} fora da conta.</p>` : ''}</section>`;
    const aviso = st.msg ? `<p class="v2o-msg" role="status">${esc(st.msg)}</p>` : '';
    return `<div class="v2t v2c v2o"><div class="v2t-topo"><span class="v2t-ola"><small class="vv-data">${esc(data)}</small><h2>Coordenação</h2></span>${periodos}${abas}</div>
      ${fala}${aviso}
      <div class="v2o-corpo"><div class="v2o-esq">${semDono}${trocas}</div><div class="v2o-dir">${time2}</div></div>
      <p class="v2t-pe">Nada muda sem o seu OK: cada troca pede confirmação e fica no histórico da peça.</p></div>`;
  }

  async function gravar(chave) {
    const [tipo, id, a, b] = chave.split(':');
    const item = typeof G.findOperationalItem === 'function' ? G.findOperationalItem(id) : null;
    if (!item) { st.msg = 'A peça não está carregada agora. Abra as demandas e tente de novo.'; st.confirmando = ''; repintar(); return; }
    if (typeof G.gravarResponsaveisDaPeca !== 'function') { st.msg = 'O painel ainda não carregou a edição de responsáveis.'; st.confirmando = ''; repintar(); return; }
    const para = tipo === 'atribuir' ? a : b, de = tipo === 'trocar' ? a : '';
    const novos = [...new Set([...idsDe(item).filter((i) => i !== de), para])];
    st.gravando = chave; st.confirmando = ''; repintar();
    try {
      await G.gravarResponsaveisDaPeca(item, novos);
      G.saveProductionCache?.(); G.renderIntegratedOperationalViews?.();
      const nome = (G.TEAM_USERS || []).find((u) => String(u.id) === para)?.name || 'a pessoa';
      st.msg = ''; G.showToast?.(`${item.nome || 'Peça'} ficou com ${primeiro(nome)}.`, 'ok', 4200);
    } catch (e) { st.msg = `Não gravou: ${e?.message || e}`; }
    st.gravando = ''; repintar();
  }

  function aoClicar(ev) {
    const b = ev.target.closest?.('#vv-hoje .v2o [data-coord-periodo],#vv-hoje .v2o [data-coord-pessoa],#vv-hoje .v2o [data-coord-atribuir],#vv-hoje .v2o [data-coord-trocar],#vv-hoje .v2o [data-coord-ok],#vv-hoje .v2o [data-coord-cancelar]');
    if (!b) return;
    ev.stopPropagation();
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
