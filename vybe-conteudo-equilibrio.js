// vybe-conteudo-equilibrio.js — o equilíbrio de objetivos das peças de cada cliente no mês.
//
// O "bolinha" do AgencyFlow: cada peça tem um objetivo — Atração (trazer gente nova),
// Educação (explicar, criar confiança) ou Conversão (vender, chamar para a ação). Este arquivo
// só faz contas: recebe as peças e devolve, por cliente, quantas há de cada objetivo e o que
// está faltando. Não lê DOM, não busca nada na rede, não lê globais do painel. Deixa no escopo
// global só VybeEquilibrio (window.VybeEquilibrio no navegador). Testes: tests/conteudo-equilibrio.test.mjs.
//
// ── Definições ────────────────────────────────────────────────────────────────────
// - Data da peça = veiculação (a data do cliente manda); sem veiculação, o prazo. Datas sem hora
//   são comparadas como texto (YYYY-MM-DD), sem fuso.
// - Peça de vários clientes conta uma vez em cada cliente.
// - "Classificadas" = peças com objetivo. As sem objetivo aparecem à parte ("3 sem objetivo").
// - Falta um objetivo quando: há 3 ou mais peças classificadas e ele tem zero; ou há 5 ou mais
//   classificadas e ele tem menos de 20% delas. Ex.: 12 peças, 6/4/2 → "falta conversão" (2/12 = 17%).
// - Etapa de aprovação (para o calendário do cliente), a partir do status que o painel já usa e da
//   última resposta do cliente pelo link (aprovar/ajuste):
//     aprovar_interno   Para aprovação, Em aprovação, Ag. Interno
//     alteracao_interna Alteração, sem pedido do cliente pelo link
//     aprovado_interno  Ag. Aprovação Cliente (já passou pela Vybe, está com o cliente), Para agendar,
//                       Agendado, Aprovado — sem resposta do cliente pelo link
//     alteracao_cliente Alteração depois de o cliente pedir ajuste pelo link
//     aprovado_cliente  o cliente aprovou pelo link e a peça não voltou para aprovação/alteração
//   Qualquer outro status: sem etapa (null), a peça ainda está em produção.
(function (raiz) {
  const OBJETIVOS = Object.freeze(['atracao', 'educacao', 'conversao']);
  const ROTULO = Object.freeze({ atracao: 'Atração', educacao: 'Educação', conversao: 'Conversão' });
  const MINUSCULO = Object.freeze({ atracao: 'atração', educacao: 'educação', conversao: 'conversão' });
  // Cores de categoria (identificação, não urgência): ponto colorido, nunca fundo de botão.
  const COR = Object.freeze({ atracao: '#1F7AE0', educacao: '#0E8F6E', conversao: '#C2490C' });
  const ETAPAS = Object.freeze([
    ['aprovar_interno', 'Para aprovar (interno)'], ['alteracao_interna', 'Alteração interna'],
    ['aprovado_interno', 'Aprovado internamente'], ['alteracao_cliente', 'Alteração do cliente'],
    ['aprovado_cliente', 'Aprovado pelo cliente'],
  ]);
  const ROTULO_ETAPA = Object.freeze(Object.fromEntries(ETAPAS));

  const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function objetivoValido(v) {
    const n = normal(v).replace(/ /g, '');
    if (OBJETIVOS.includes(n)) return n;
    if (n === 'atrair') return 'atracao';
    if (n === 'educar') return 'educacao';
    if (n === 'converter' || n === 'venda' || n === 'vender') return 'conversao';
    return null;
  }
  const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const dataDaPeca = (p) => iso(p?.veiculacao_iso) || iso(p?.veiculacao) || iso(p?.prazo_iso) || iso(p?.prazo) || iso(p?.data);
  const clientesDe = (p) => {
    const lista = Array.isArray(p?.clientes) && p.clientes.length ? p.clientes : (p?.cliente ? String(p.cliente).split(/\s*,\s*/) : []);
    const vistos = new Map();
    for (const c of lista) { const nome = String(c || '').trim(); if (nome && !vistos.has(normal(nome))) vistos.set(normal(nome), nome); }
    return [...vistos.values()];
  };
  function mesAnterior(mes) {
    const [a, m] = String(mes).split('-').map(Number);
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
  }
  const pecas = (n) => `${n} peça${n === 1 ? '' : 's'}`;

  // O que falta no conjunto (contagens por objetivo).
  function faltando(cont) {
    const classificadas = OBJETIVOS.reduce((n, o) => n + (cont[o] || 0), 0);
    return OBJETIVOS.filter((o) => {
      const n = cont[o] || 0;
      if (classificadas >= 3 && n === 0) return true;
      return classificadas >= 5 && n / classificadas < 0.2;
    });
  }
  function frase(cont) {
    const partes = OBJETIVOS.map((o) => `${cont[o] || 0} ${MINUSCULO[o]}`).join(', ');
    let t = `${pecas(cont.total)}: ${partes}`;
    if (cont.falta.length) t += ` — falta ${cont.falta.map((o) => MINUSCULO[o]).join(' e ')}`;
    else if (cont.total - cont.sem >= 3) t += ' — equilibrado';
    if (cont.sem) t += ` · ${cont.sem} sem objetivo`;
    return t;
  }
  function vazio() { return { total: 0, atracao: 0, educacao: 0, conversao: 0, sem: 0 }; }
  function fechar(cont) { cont.falta = faltando(cont); cont.frase = frase(cont); return cont; }

  // equilibrioDoMes(pecas, { mes: 'YYYY-MM', clientes?: [nomes] })
  //   → { mes, clientes: [{ cliente, total, atracao, educacao, conversao, sem, falta, frase }], geral }
  // `clientes`, se vier, limita aos nomes dados (ex.: só os ativos). Ordem: quem tem falta primeiro,
  // depois quem tem mais peças.
  function equilibrioDoMes(lista, { mes, clientes = null } = {}) {
    if (!/^\d{4}-\d{2}$/.test(String(mes || ''))) throw new Error('Informe o mês como AAAA-MM.');
    const permitidos = Array.isArray(clientes) ? new Set(clientes.map(normal)) : null;
    const por = new Map();
    const geral = vazio();
    for (const p of Array.isArray(lista) ? lista : []) {
      if (!dataDaPeca(p).startsWith(mes + '-')) continue;
      const obj = objetivoValido(p?.objetivo);
      const cs = clientesDe(p).filter((c) => !permitidos || permitidos.has(normal(c)));
      if (!cs.length) continue;
      geral.total++; if (obj) geral[obj]++; else geral.sem++;
      for (const c of cs) {
        const k = normal(c);
        if (!por.has(k)) por.set(k, { cliente: c, ...vazio() });
        const x = por.get(k);
        x.total++; if (obj) x[obj]++; else x.sem++;
      }
    }
    const lista2 = [...por.values()].map(fechar)
      .sort((a, b) => (b.falta.length > 0) - (a.falta.length > 0) || b.total - a.total || a.cliente.localeCompare(b.cliente, 'pt-BR'));
    return { mes, clientes: lista2, geral: fechar(geral) };
  }

  function etapaDeAprovacao(status, respostaCliente = null) {
    const s = normal(status);
    const r = respostaCliente === 'aprovar' || respostaCliente === 'ajuste' ? respostaCliente : null;
    if (['para aprovacao', 'em aprovacao', 'ag interno'].includes(s)) return 'aprovar_interno';
    if (s === 'alteracao') return r === 'ajuste' ? 'alteracao_cliente' : 'alteracao_interna';
    if (s === 'ag aprovacao cliente') return 'aprovado_interno';
    if (r === 'aprovar') return 'aprovado_cliente';
    if (['para agendar', 'agendado', 'aprovado'].includes(s)) return 'aprovado_interno';
    return null;
  }

  // Comparação com o mês anterior para os cartões: { atual, anterior, diferenca, texto }.
  function comparar(atual, anterior) {
    const d = (Number(atual) || 0) - (Number(anterior) || 0);
    const texto = !anterior && !atual ? 'igual ao mês anterior' : d === 0 ? 'igual ao mês anterior'
      : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs mês anterior`;
    return { atual: Number(atual) || 0, anterior: Number(anterior) || 0, diferenca: d, texto };
  }

  const api = Object.freeze({ OBJETIVOS, ROTULO, COR, ETAPAS, ROTULO_ETAPA, objetivoValido, dataDaPeca, clientesDe,
    equilibrioDoMes, etapaDeAprovacao, comparar, mesAnterior, faltando, frase });
  raiz.VybeEquilibrio = api;
  if (raiz.window && typeof raiz.window === 'object' && raiz.window !== raiz) raiz.window.VybeEquilibrio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
