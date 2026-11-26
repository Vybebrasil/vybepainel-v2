// vybe-relatorio-financas.js — o relatório do Finanças no contrato do motor de relatórios (rel), Paulo 26/11/2026.
//
//   window.VybeRelatorioFinancas.montar(d, { mes })  → o objeto do contrato (puro: d = o GET de area=financeiro)
//   window.VybeRelatorioFinancas.gerar({ mes })      → busca os dados (só donos: o servidor recusa os outros) e monta
//   window.VybeFinancas.relatorio({ mes })           → o mesmo gerar (vybe-mundo-financas.js delega para cá)
//   window.VybeRelatorioFinancas.imprimir(rel)       → sem o motor de PDF, abre a versão para imprimir/salvar em PDF
//
// Contrato: { titulo, periodo, resumo, numeros: [{ rotulo, valor, variacao, porque }], secoes: [{ titulo, texto,
//   grafico: { tipo, series, rotulos, svg }, tabela: { colunas, linhas } }], recomendacoes: [{ o_que, por_que, impacto,
//   prioridade }], fontes: [...] }. Os gráficos saem dos mesmos helpers SVG da tela (vybe-graficos.js).
// O registro no motor só acontece se window.VybeRelatorio.registrar existir (o VybeRelatorio de hoje é o do cliente e não
// tem registrar; quando o rel chegar, este arquivo se registra sozinho como 'financas').
(function (raiz) {
  'use strict';
  const reais = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v) < 0 ? '−' : ''}R$ ${Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}` : '');
  const pct = (v) => (v == null ? '—' : `${String(v).replace('.', ',')}%`);
  const G = () => raiz.VybeGraficos;
  const svgDe = (fn, o) => { try { return G()?.[fn] ? G()[fn](o) : ''; } catch { return ''; } };
  const PRIOR = { 3: 'alta', 2: 'média', 1: 'baixa' };

  function montar(d = {}, { mes = '' } = {}) {
    const an = d.analise;
    if (!an) return { titulo: 'Finanças da Vybe', periodo: '', resumo: 'Sem extrato importado: não há números para o relatório.', numeros: [], secoes: [], recomendacoes: [], fontes: ['Extrato da conta PJ (Santander)'] };
    const ms = an.meses || [], m = /^\d{4}-\d{2}$/.test(mes) ? mes : ms[ms.length - 1] || (d.hoje || '').slice(0, 7);
    const dre = an.dre.competencia, i = dre.meses.indexOf(m), iAnt = i - 1;
    const rec = an.recorrente, ult = rec.meses[rec.meses.length - 1] || {}, pj = an.projecao;
    const res = i >= 0 ? dre.resultado[i] : null, resAnt = iAnt >= 0 ? dre.resultado[iAnt] : null;
    const receita = i >= 0 ? dre.linhas[0].valores[i] : null;
    const varia = (a, b) => (a == null || b == null || !b ? null : Math.round((a - b) / Math.abs(b) * 100));
    const conf = an.confianca?.texto || '';
    const numeros = [
      { rotulo: 'Receita do mês', valor: reais(receita), variacao: varia(receita, iAnt >= 0 ? dre.linhas[0].valores[iAnt] : null), porque: 'Entradas classificadas como receita, por competência.' },
      { rotulo: 'Resultado do mês', valor: reais(res), variacao: varia(res, resAnt), porque: `Receita − impostos − equipe − ferramentas − despesas gerais. Margem ${pct(i >= 0 ? dre.margem[i] : null)}.` },
      { rotulo: 'MRR', valor: reais(rec.mrr), variacao: varia(ult.mrr, ult.mrr_anterior), porque: `Contratos ativos; novo ${reais(ult.novo)}, perdido ${reais(ult.perdido)} no último mês.` },
      { rotulo: 'Vencido a receber', valor: reais(an.aging.vencido), variacao: null, porque: `Atraso médio de ${an.aging.atraso_medio_dias || 0} dias pelo dia de vencimento do contrato.` },
      { rotulo: 'Saldo em 12 meses (base)', valor: reais(pj.base.saldo_final), variacao: null, porque: `${conf}. Pessimista ${reais(pj.pessimista.saldo_final)}, otimista ${reais(pj.otimista.saldo_final)}.` },
      { rotulo: 'Fôlego', valor: pj.base.folego_meses == null ? '12+ meses' : `${pj.base.folego_meses} meses`, variacao: null, porque: pj.base.primeiro_dia_negativo ? `Caixa negativo em ${pj.base.primeiro_dia_negativo.split('-').reverse().join('/')} no base.` : 'O base não fica negativo nos próximos 12 meses.' },
    ];
    const rot = dre.meses.map((x) => ({ curto: x.slice(5, 7) + '/' + x.slice(2, 4), longo: nomeMes(x) }));
    const secoes = [
      { titulo: 'DRE por competência', texto: `De ${nomeMes(dre.meses[0])} a ${nomeMes(dre.meses[dre.meses.length - 1])}. Resultado do período: ${reais(dre.total_resultado)} (margem ${pct(dre.margem_total)}).`,
        grafico: { tipo: 'barras', rotulos: rot.map((r) => r.longo), series: [{ nome: 'Receita', valores: dre.linhas[0].valores }, { nome: 'Resultado', valores: dre.resultado }],
          svg: svgDe('barras', { rotX: rot, series: [{ nome: 'Receita', vals: dre.linhas[0].valores, cor: 'k2' }, { nome: 'Resultado', vals: dre.resultado, cor: 'k1' }], rotulo: 'Receita e resultado' }) },
        tabela: { colunas: ['Linha', ...rot.map((r) => r.longo), 'Período'], linhas: [...dre.linhas.map((l) => [l.nome, ...l.valores.map((v) => reais(v * (l.sinal < 0 ? -1 : 1))), reais(l.total * (l.sinal < 0 ? -1 : 1))]), ['Resultado', ...dre.resultado.map(reais), reais(dre.total_resultado)]] } },
      { titulo: 'Receita recorrente', texto: `MRR de ${reais(rec.mrr)}, ticket médio ${reais(rec.ticket)}, churn médio ${pct(rec.churn_medio_pct)} ao mês${rec.ltv ? `, LTV ${reais(rec.ltv)}` : ''}.`,
        grafico: { tipo: 'linha', rotulos: rec.meses.map((x) => nomeMes(x.mes)), series: [{ nome: 'MRR', valores: rec.meses.map((x) => x.mrr) }],
          svg: svgDe('linhaFaixa', { rotX: rec.meses.map((x) => ({ curto: x.mes.slice(5, 7) + '/' + x.mes.slice(2, 4), longo: nomeMes(x.mes) })), series: [{ nome: 'MRR', vals: rec.meses.map((x) => x.mrr), cor: 'k1' }], rotulo: 'MRR' }) },
        tabela: { colunas: ['Mês', 'MRR', 'Novo', 'Expansão', 'Contração', 'Perdido'], linhas: rec.meses.filter((x) => x.mrr || x.mrr_anterior).map((x) => [nomeMes(x.mes), reais(x.mrr), reais(x.novo), reais(x.expansao), reais(x.contracao), reais(x.perdido)]) } },
      { titulo: 'Margem por cliente', texto: `Custo de equipe rateado ${an.margem.regra.includes('pecas') ? 'pelas peças da produção' : 'pela receita'}. ${an.margem.prejuizo.length ? `${an.margem.prejuizo.length} cliente(s) com prejuízo.` : 'Nenhum cliente com prejuízo.'}`,
        grafico: { tipo: 'barras_horizontais', rotulos: an.margem.linhas.map((l) => l.cliente_nome), series: [{ nome: 'Margem', valores: an.margem.linhas.map((l) => l.margem) }],
          svg: svgDe('barrasH', { itens: an.margem.linhas.slice(0, 12).map((l) => ({ nome: l.cliente_nome, valor: l.margem })), rotulo: 'Margem por cliente' }) },
        tabela: { colunas: ['Cliente', 'Receita', 'Custo direto', 'Equipe', 'Margem', '%'], linhas: an.margem.linhas.map((l) => [l.cliente_nome, reais(l.receita), reais(l.custo_direto), reais(l.custo_equipe), reais(l.margem), pct(l.margem_pct)]) } },
      { titulo: 'A receber por idade', texto: `Total ${reais(an.aging.total)}, vencido ${reais(an.aging.vencido)}.`,
        grafico: { tipo: 'barras', rotulos: an.aging.faixas.map((f) => f.nome), series: [{ nome: 'A receber', valores: an.aging.faixas.map((f) => f.total) }], svg: '' },
        tabela: { colunas: ['Cliente', 'Mês', 'Venceu', 'Atraso (dias)', 'Valor'], linhas: an.aging.itens.map((x) => [x.cliente_nome, nomeMes(x.mes), x.vence.split('-').reverse().join('/'), String(x.atraso_dias), reais(x.valor)]) } },
      { titulo: 'Projeção (12 meses)', texto: `${conf}. Base: contratos no dia do vencimento, fixos e a média do variável. Pessimista: atraso médio, clientes em risco saem, variável alto. Otimista: funil do Comercial pela chance.`,
        grafico: { tipo: 'linha_faixa', rotulos: pj.meses.map(nomeMes), series: ['pessimista', 'base', 'otimista'].map((k) => ({ nome: k, valores: pj[k].meses.map((x) => x.saldo) })),
          svg: svgDe('linhaFaixa', { rotX: pj.meses.map((x) => ({ curto: x.slice(5, 7) + '/' + x.slice(2, 4), longo: nomeMes(x) })), series: [{ nome: 'Base', vals: pj.base.meses.map((x) => x.saldo), cor: 'k1' }], faixa: { nome: 'Pessimista a otimista', de: pj.pessimista.meses.map((x) => x.saldo), ate: pj.otimista.meses.map((x) => x.saldo) }, rotulo: 'Saldo projetado' }) },
        tabela: { colunas: ['Mês', 'Pessimista', 'Base', 'Otimista'], linhas: pj.meses.map((x, k) => [nomeMes(x), reais(pj.pessimista.meses[k].saldo), reais(pj.base.meses[k].saldo), reais(pj.otimista.meses[k].saldo)]) } },
    ];
    const recomendacoes = (an.achados || []).map((a) => ({ o_que: a.fazer || a.rot, por_que: a.texto || a.det, impacto: a.impacto ? reais(a.impacto) : '', prioridade: PRIOR[a.g] || 'baixa' }));
    const fech = d.fechamentos?.[m];
    return { titulo: `Finanças da Vybe · ${nomeMes(m)}`, periodo: m, resumo: `${fech?.situacao === 'fechado' ? 'Mês fechado' : 'Mês em aberto'}. Resultado de ${reais(res)} com receita de ${reais(receita)}; MRR ${reais(rec.mrr)}. ${conf}.`,
      numeros, secoes, recomendacoes, fontes: ['Extrato da conta PJ (Santander), com o lado real conferido no Vybe OS', 'Contratos dos clientes (Vybe OS)', 'Peças da produção (Vybe OS)', 'Funil do Comercial (Vybe OS)', 'Saúde da Carteira (Vybe OS)'] };
  }

  async function gerar({ mes = '' } = {}) {
    const r = await fetch(`/api/painel?area=financeiro${mes ? `&mes=${encodeURIComponent(mes)}` : ''}`, { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { erro: d.error || 'Não foi possível montar o relatório agora.' };
    return montar(d, { mes });
  }

  // Sem o motor de PDF: uma página limpa para imprimir ou "Salvar como PDF" no navegador.
  function imprimir(rel) {
    const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${e(rel.titulo)}</title><style>body{font:13px/1.45 system-ui,sans-serif;color:#111;margin:24px}h1{font-size:20px}h2{font-size:15px;margin-top:22px}table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left}.n{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.n div{border:1px solid #ccc;border-radius:6px;padding:8px}svg{max-width:100%;height:auto}.fv2-sr,.fe-tip{display:none}</style></head><body>
      <h1>${e(rel.titulo)}</h1><p>${e(rel.resumo)}</p><div class="n">${rel.numeros.map((n) => `<div><small>${e(n.rotulo)}</small><br><b>${e(n.valor)}</b>${n.variacao != null ? ` (${n.variacao > 0 ? '+' : ''}${n.variacao}%)` : ''}<br><small>${e(n.porque)}</small></div>`).join('')}</div>
      ${rel.secoes.map((s) => `<h2>${e(s.titulo)}</h2><p>${e(s.texto)}</p>${s.tabela ? `<table><tr>${s.tabela.colunas.map((c) => `<th>${e(c)}</th>`).join('')}</tr>${s.tabela.linhas.map((l) => `<tr>${l.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</table>` : ''}`).join('')}
      <h2>Recomendações</h2><ul>${rel.recomendacoes.map((r) => `<li><b>${e(r.o_que)}</b> — ${e(r.por_que)}${r.impacto ? ` (impacto ${e(r.impacto)})` : ''} · prioridade ${e(r.prioridade)}</li>`).join('') || '<li>Nada pedindo ação.</li>'}</ul>
      <p><small>Fontes: ${rel.fontes.map(e).join('; ')}</small></p><script>window.print()<\/script></body></html>`;
    const w = raiz.open?.('', '_blank');
    if (!w) return false;
    w.document.open(); w.document.write(html); w.document.close();
    return true;
  }

  const api = Object.freeze({ montar, gerar, imprimir, paraMotor });
  raiz.VybeRelatorioFinancas = api;
  // O motor de relatórios (rel), quando existir com registrar: o Finanças entra como 'financas'.
  const R = raiz.VybeRelatorio;
  // Contrato do motor (vybe-relatorio.js, rel 26/11/2026): resumo em frases, variação em texto com o lado bom, gráficos
  // nos tipos do motor (vybe-relatorio-graficos.js, legíveis em preto e branco), tabela larga (mês nas colunas) virada
  // para caber no A4, fontes como { nome } e o botão só para os quatro donos (acesso 'dinheiro').
  const mesCurto = (r) => String(r).replace(/^([a-zç]{3})[a-zç]* de \d{2}(\d{2})$/i, '$1/$2');
  const brlCurto = (n) => `${n < 0 ? '−' : ''}R$ ${Math.round(Math.abs(n)).toLocaleString('pt-BR')}`;
  function graficoDoMotor(g) {
    const series = (g?.series || []).filter((x) => Array.isArray(x?.valores));
    if (!series.length) return null;
    if (g.tipo === 'barras_horizontais') return { tipo: 'ranking', itens: (g.rotulos || []).map((r, i) => ({ rotulo: r, valor: series[0].valores[i], tom: series[0].valores[i] < 0 ? 'ruim' : '' })).filter((x) => Number.isFinite(x.valor)).sort((a, b) => b.valor - a.valor).slice(0, 12), formato: brlCurto };
    return { tipo: g.tipo === 'linha_faixa' || g.tipo === 'linha' ? 'linha' : 'barras', rotulos: (g.rotulos || []).map(mesCurto), series: series.map((x) => ({ nome: x.nome, valores: x.valores })), formato: brlCurto };
  }
  function tabelaDoMotor(t) {
    if (!t?.colunas?.length) return null;
    if (t.colunas.length <= 7) return { colunas: t.colunas, linhas: t.linhas };
    // Muitas colunas (um mês em cada): vira, com um mês por linha.
    const curto = { 'Custo de equipe': 'Equipe', 'Ferramentas e assinaturas': 'Ferramentas', 'Despesas gerais': 'Despesas', 'Sem categoria': 'Sem categ.' };
    // Linha toda zerada (ex.: Sem categoria) não ganha coluna: a tabela virada precisa caber nos 180 mm.
    const vazio = (v) => v == null || v === '—' || /^[−-]?R\$ 0,00$/.test(String(v));
    t = { ...t, linhas: t.linhas.filter((l) => !l.slice(1).every(vazio)) };
    return { colunas: [t.colunas[0] === 'Linha' ? 'Mês' : t.colunas[0], ...t.linhas.map((l) => curto[l[0]] || l[0])], linhas: t.colunas.slice(1).map((c, j) => [mesCurto(c), ...t.linhas.map((l) => l[j + 1])]) };
  }
  function paraMotor(r) {
    const pctTexto = (v) => (v == null ? null : { texto: `${v > 0 ? '▲ +' : v < 0 ? '▼ ' : '= '}${v}% vs mês anterior`, bom: v > 0 ? true : v < 0 ? false : null });
    return {
      titulo: r.titulo, subtitulo: 'Resultado, recorrência, margem, a receber e projeção, pelo extrato da conta PJ',
      resumo: String(r.resumo || '').split(/(?<=\.)\s+/).filter(Boolean),
      numeros: (r.numeros || []).map((n) => ({ ...n, variacao: pctTexto(n.variacao), dinheiro: true })),
      secoes: (r.secoes || []).map((x) => ({ titulo: x.titulo, texto: x.texto, grafico: graficoDoMotor(x.grafico), tabela: tabelaDoMotor(x.tabela), dinheiro: true })),
      recomendacoes: (r.recomendacoes || []).length ? r.recomendacoes.map((x) => ({ ...x, dinheiro: true }))
        : [(r.secoes || []).length ? { o_que: 'Conferir e fechar o mês no Finanças.', por_que: 'Nenhum achado pede ação agora.', impacto: 'Números fechados no próximo relatório.', prioridade: 'baixa', dinheiro: true }
          : { o_que: 'Importar o extrato da conta PJ no Finanças.', por_que: 'Sem extrato não há resultado, recorrência nem projeção.', impacto: 'Relatório com números.', prioridade: 'alta', dinheiro: true }],
      metodologia: ['Números do extrato da conta PJ, com o lado real conferido no Vybe OS. O DRE e a recorrência mostram todos os meses do extrato; os números do mês são do último mês do período escolhido.'],
      fontes: (r.fontes || []).map((x) => (typeof x === 'string' ? { nome: x, detalhe: 'leitura do Financeiro (só donos)' } : x)),
    };
  }
  const TELAS = ['setor:financas', 'fin_hoje', 'fin_movimento', 'fin_clientes', 'fin_pessoas', 'fin_assinaturas', 'fin_analise', 'fin_projecao', 'fin_fechamento', 'financas', 'recebimentos', 'contas', 'inadimplencia', 'vorcaro', 'extrato', 'clientes_mes', 'cartao', 'fixos', 'projecao', 'vales'];
  async function doMotor(ctx = {}) {
    const mes = typeof ctx.periodo === 'object' && ctx.periodo ? String(ctx.periodo.fim || '').slice(0, 7) : String(ctx.mes || ctx.periodo || '');
    // Pelo ctx.api do motor (só leitura, entra nas fontes); sem o motor, o gerar() de sempre.
    if (typeof ctx.api === 'function') {
      const d = await ctx.api('financeiro', mes ? { mes } : {});
      if (!d) return { ...paraMotor(montar({}, { mes })), resumo: ['O Financeiro não respondeu agora: o relatório saiu sem números. Tente de novo em instantes.'] };
      return paraMotor(montar(d, { mes }));
    }
    const r = await gerar({ mes }); if (r.erro) throw new Error(r.erro); return r;
  }
  if (R && typeof R.registrar === 'function') { try { R.registrar('financas', doMotor, { nome: 'Finanças', telas: TELAS, agente: { nome: 'Vorcaro', papel: 'Tesouraria' }, acesso: 'dinheiro' }); } catch { /* o motor recusou: o relatório continua por VybeFinancas.relatorio() */ } }
})(typeof globalThis !== 'undefined' ? globalThis : this);
