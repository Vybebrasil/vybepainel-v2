// vybe-mundo-financas.js — o Vybe Finanças dentro das janelas do Irecity (Paulo, 08/11/2026). SÓ LEITURA.
//
// Lê /api/painel?area=vybe_financas (server/vybe-financas-api.js) e guarda a resposta por parte e mês, para o
// Comercial (abas de dinheiro), a Carteira (Contratos) e o setor de Pessoas (RH → Folha). Cada módulo desenha com as
// próprias classes (vc-* / vp-*); aqui ficam só a leitura, a junção dos contratos e o mini painel dos números.
//   window.VybeFinancas.carregar(parte, mes, { forcar }) → Promise<estado>   (parte = comercial | carteira | rh)
//   window.VybeFinancas.estado(parte, mes) → { carregando, dados, erro } | null
//   window.VybeFinancas.contratosDaCarteira(listaDoVybeOS, mes) → lista no formato da Carteira, com o Finanças por cima
//   window.VybeFinancas.contratoDoCliente(clienteId, mes) → o contrato principal do Finanças daquele cliente (ou null)
//   window.VybeEspiarProvedores.financas   os números clicáveis (data-espiar="financas:<parte>:<o quê>")
// Quem vê o quê é o servidor que decide (os campos de dinheiro e de salário nem chegam a quem não pode).
(() => {
  'use strict';
  const VALIDADE = 2 * 60 * 1000;
  const guardados = new Map(); // `${parte}|${mes}` → { carregando, dados, erro, em, promessa }
  const ultimo = {}; // parte → chave do último estado carregado (o mini painel lê dele)
  const chave = (parte, mes) => `${parte}|${mes || ''}`;
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const din = (v) => (v == null ? '—' : BRL.format(Number(v) || 0));
  const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '—');
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = (m) => (/^\d{4}-\d{2}$/.test(m || '') ? `${MESES[Number(m.slice(5)) - 1]} de ${m.slice(0, 4)}` : '');

  async function pedir(parte, mes) {
    const r = await fetch(`/api/painel?area=vybe_financas&parte=${encodeURIComponent(parte)}${mes ? `&mes=${encodeURIComponent(mes)}` : ''}`,
      { credentials: 'same-origin', cache: 'no-store' });
    let d = {}; try { d = await r.json(); } catch { /* sem corpo */ }
    if (!r.ok || !d.ok) throw Object.assign(new Error(d.error || 'O Vybe Finanças não respondeu agora.'), { status: r.status, indisponivel: Boolean(d.financas_indisponivel) });
    return d;
  }
  function carregar(parte, mes = '', { forcar = false } = {}) {
    const k = chave(parte, mes), atual = guardados.get(k);
    if (atual?.promessa) return atual.promessa;
    if (atual && !forcar && Date.now() - atual.em < VALIDADE) return Promise.resolve(atual);
    const e = { carregando: true, dados: atual?.dados || null, erro: '', em: Date.now(), promessa: null };
    guardados.set(k, e);
    e.promessa = pedir(parte, mes).then((d) => { e.dados = d; e.erro = ''; ultimo[parte] = k; })
      .catch((err) => { e.erro = err.message; e.status = err.status; if (err.status === 403) e.dados = null; })
      .then(() => { e.carregando = false; e.em = Date.now(); e.promessa = null; return e; });
    return e.promessa;
  }
  const estado = (parte, mes = '') => guardados.get(chave(parte, mes)) || null;
  const ligado = (parte, mes = '') => estado(parte, mes)?.dados?.conectado === true;

  // ---------- Carteira: contratos ----------
  // O contrato principal do Finanças (o ativo mais recente) entra no lugar do registro do Vybe OS daquele cliente:
  // início, renovação (= fim no Finanças) e status; o valor só quando o servidor mandou (quem vê dinheiro).
  function contratoDoCliente(clienteId, mes = '') {
    const d = estado('carteira', mes)?.dados;
    if (!d?.conectado || clienteId == null) return null;
    return (d.contratos || []).find((c) => c.principal && String(c.cliente_id) === String(clienteId)) || null;
  }
  function contratosDaCarteira(locais = [], mes = '') {
    const d = estado('carteira', mes)?.dados;
    if (!d?.conectado) return locais;
    const deLocal = new Map((locais || []).map((c) => [String(c.cliente_id), c]));
    const saida = new Map(deLocal);
    for (const f of d.contratos || []) {
      if (!f.principal || !f.cliente_id) continue;
      const l = deLocal.get(String(f.cliente_id));
      saida.set(String(f.cliente_id), { cliente_id: String(f.cliente_id), valor_mensal: f.valor != null ? f.valor : l?.valor_mensal ?? null,
        inicio: f.inicio || l?.inicio || null, renovacao: f.fim || null, status: f.status_carteira || 'ativo', observacao: l?.observacao || '', fonte: 'financas' });
    }
    return [...saida.values()];
  }

  // ---------- Mini painel (data-espiar="financas:<parte>:<o quê>[:<extra>]") ----------
  (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {}).financas = (resto) => {
    const [parte, tipo, extra = ''] = String(resto).split(':');
    const d = ultimo[parte] ? guardados.get(ultimo[parte])?.dados : null;
    if (!d?.conectado) return null;
    const rodape = 'fonte: Vybe Finanças';
    if (parte === 'comercial') {
      if (tipo === 'despesas') return { titulo: `Despesas de ${nomeMes(d.mes)} por categoria`, rodape, vazio: 'Nenhuma despesa no mês.',
        itens: d.despesas.categorias.map((c) => ({ nome: c.categoria, sub: `${c.quantidade} lançamento${c.quantidade === 1 ? '' : 's'}${c.pendente ? ` · ${din(c.pendente)} pendente` : ''}`, dir: din(c.total) })) };
      if (tipo === 'fixos') return { titulo: 'Custos fixos (assinaturas ativas)', rodape, vazio: 'Nenhuma assinatura ativa.',
        itens: d.custos_fixos.itens.map((s) => ({ nome: s.nome, sub: s.dia_renovacao ? `renova dia ${s.dia_renovacao}` : '', dir: din(s.custo) + '/mês' })) };
      if (tipo === 'inad') return { titulo: 'Receitas vencidas e não pagas', cls: 'u1', rodape, vazio: 'Ninguém em atraso no Finanças.',
        itens: d.inadimplencia.clientes.map((c) => ({ nome: c.cliente_nome, sub: `${c.faturas} lançamento${c.faturas === 1 ? '' : 's'} · ${c.atraso_mais_antigo} dia${Number(c.atraso_mais_antigo) === 1 ? '' : 's'} de atraso${c.no_vybe ? '' : ' · sem par no Vybe OS'}`, dir: din(c.valor), cls: c.atraso_mais_antigo > 30 ? 'u1' : '' })) };
      if (tipo === 'margem') {
        const lista = extra === 'negativa' ? d.margens.filter((m) => m.periodo.margem < 0) : d.margens;
        return { titulo: extra === 'negativa' ? 'Clientes com margem negativa (3 meses)' : 'Margem real por cliente (3 meses)', cls: extra === 'negativa' ? 'u1' : '', rodape, vazio: 'Nenhum cliente.',
          itens: lista.map((m) => ({ nome: m.cliente_nome, sub: `recebido ${din(m.periodo.receita)} · despesas ${din(m.periodo.despesas)}`, dir: din(m.periodo.margem), cls: m.periodo.margem < 0 ? 'u1' : '' })) };
      }
      if (tipo === 'serie') {
        const m = d.series.find((s) => s.mes === extra); if (!m) return null;
        return { titulo: nomeMes(m.mes), rodape, itens: [{ nome: 'Faturamento recebido', dir: din(m.faturamento) }, { nome: 'Custos pagos', dir: din(m.custos) },
          { nome: 'Resultado', dir: din(m.resultado), cls: m.resultado < 0 ? 'u1' : '' }, { nome: 'Ticket médio', sub: `${m.clientes_pagantes} cliente${m.clientes_pagantes === 1 ? '' : 's'} pagaram`, dir: din(m.ticket_medio) }] };
      }
      if (tipo === 'sempar') return { titulo: 'No Finanças, sem par no Vybe OS', rodape: 'Ligação pelo CNPJ ou pelo nome', vazio: 'Todos ligados.',
        itens: d.ligacao.sem_par.map((c) => ({ nome: c.nome, sub: c.status })) };
    }
    if (parte === 'carteira') {
      if (tipo === 'sempar') return { titulo: 'No Finanças, sem par no Vybe OS', rodape: 'Ligação pelo CNPJ ou pelo nome', vazio: 'Todos ligados.',
        itens: d.ligacao.sem_par.map((c) => ({ nome: c.nome, sub: c.status })) };
      if (tipo === 'faltafin') return { titulo: 'Ativos no Vybe OS, sem cadastro no Finanças', rodape: 'Cadastre no Vybe Finanças com o mesmo nome ou CNPJ', vazio: 'Todos os ativos estão no Finanças.',
        itens: (d.ligacao.vybe_sem_par || []).map((c) => ({ nome: c.nome, sub: 'falta no Vybe Finanças' })) };
      if (tipo === 'contratos') return { titulo: 'Contratos no Vybe Finanças', rodape, vazio: 'Nenhum contrato no Finanças.',
        itens: d.contratos.map((c) => ({ nome: c.cliente_nome, sub: [c.titulo, c.status, c.fim ? `até ${dataBr(c.fim)}` : 'sem fim', c.tem_pdf ? 'com PDF' : ''].filter(Boolean).join(' · '),
          dir: c.valor != null ? din(c.valor) + '/mês' : '', cls: c.dias_restantes != null && c.dias_restantes < 0 && c.status_carteira !== 'encerrado' ? 'u1' : '' })) };
    }
    if (parte === 'rh' && tipo === 'folha' && d.folha) return { titulo: `Folha de ${nomeMes(d.folha.mes)}`, rodape, vazio: 'Nenhum funcionário no Finanças.',
      itens: d.folha.funcionarios.map((f) => ({ nome: f.nome, sub: [f.cargo, f.dia_pagamento ? `paga dia ${f.dia_pagamento}` : ''].filter(Boolean).join(' · '), dir: din(f.total),
        cls: f.variacao > 0 ? 'u2' : '' })) };
    return null;
  };

  window.VybeFinancas = Object.freeze({ carregar, estado, ligado, contratosDaCarteira, contratoDoCliente });
})();
