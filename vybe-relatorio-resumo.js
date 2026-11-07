// vybe-relatorio-resumo.js — as contas do relatório mensal do cliente (e do bloco "Peças do mês" da ficha).
//
// Paulo, 07/11/2026: a ficha do cliente junta tudo e gera o relatório do mês para imprimir em PDF. Este
// arquivo só faz contas: recebe as peças e devolve o resumo do mês. Não lê DOM, não busca nada na rede e
// não lê os globais do painel (quem chama passa os dados). Deixa no escopo global só VybeRelatorioResumo.
//
//   VybeRelatorioResumo.resumoDoMes({ pecas, cliente, mes, hoje = new Date(),
//                                    objetivoDe = null, entregue = null, ehSolicitacao = null })
//
// ── Definições (as mesmas de vybe-dono-metricas.js, para os números baterem com a Gestão) ──────────
// - Peça do mês = conteúdo (solicitação não é post) de um dos clientes da peça igual ao `cliente`
//   (nome sem acento, caixa ou pontuação) com a data da peça dentro do mês. Data da peça = veiculação
//   (o dia em que o cliente publica); sem veiculação, o prazo. Peça de vários clientes conta inteira
//   para cada um deles.
// - Entregue = status Finalizado, Feito, Concluído, Aprovado, Para agendar, Agendado, Publicado ou
//   Postado (ENTREGUE de vybe-dono-metricas.js; tests/relatorio-resumo.test.mjs confere que é a mesma
//   lista). Quem chama pode trocar a regra por `entregue(d)`.
// - Dia da entrega = dia local de status_updated_at de uma peça entregue (o painel não guarda outro).
// - No prazo = entregue até a data da peça (inclusive). Fora do prazo = entregue depois dela. Entregue
//   sem dia da entrega fica em `semDiaDaEntrega` e não entra na porcentagem.
//   noPrazoPct = no prazo ÷ (no prazo + fora do prazo), arredondado; null sem nenhuma medida.
// - Atrasada = não entregue, fora de "Segurar Post", com a data da peça antes de hoje.
// - Formato = campo `formato` da peça; vazio ou "—" vira "Sem formato". Ordem: mais peças primeiro.
// - Objetivo (Atração, Educação, Conversão): `objetivoDe(d)` ou o campo `objetivo` da peça, lido sem
//   acento ("atrair", "educativo", "venda"… também valem). `objetivos.disponivel` é false quando
//   nenhuma peça do mês tem objetivo: o relatório não mostra o bloco (vazio não é 0%).
//   As porcentagens são sobre as peças com objetivo.
(function (raiz) {
  'use strict';

  const ENTREGUE = new Set(['finalizado', 'concluido', 'concluida', 'concluidas', 'aprovado', 'para agendar', 'agendado', 'publicado', 'postado']);
  const PAUSADA = new Set(['segurar post']);
  // A mesma junção dos nomes de solicitação de operationalFlowStatus (vybe-dono-metricas.js).
  const SINONIMOS = new Map([['nova demanda', 'a fazer'], ['em execucao', 'em andamento'], ['feito', 'finalizado'],
    ['aguardando info', 'falta info'], ['aguardando aprovacao', 'para aprovacao'], ['em aprovacao', 'para aprovacao']]);
  const OBJETIVOS = Object.freeze([
    Object.freeze({ chave: 'atracao', rotulo: 'Atração', cor: '#FF7A2F' }),
    Object.freeze({ chave: 'educacao', rotulo: 'Educação', cor: '#1F4FA8' }),
    Object.freeze({ chave: 'conversao', rotulo: 'Conversão', cor: '#11613A' }),
  ]);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const chaveTexto = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const chaveStatus = (s) => { const k = chaveTexto(s); return SINONIMOS.get(k) || k; };
  const lista = (v) => (Array.isArray(v) ? v : []);

  // ── Datas: sem hora fica como está; com hora vira o dia local ────────────────────────────────
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const dois = (n) => String(n).padStart(2, '0');
  const ehData = (x) => Boolean(x) && typeof x.getTime === 'function' && !Number.isNaN(x.getTime());
  const diaLocal = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
  const soData = (v) => { const s = String(v ?? '').slice(0, 10); return ISO.test(s) ? s : ''; };
  function diaDe(v) {
    if (!v) return '';
    if (ehData(v)) return diaLocal(v);
    const s = String(v).trim();
    if (ISO.test(s)) return s;
    if (!/^\d{4}-\d{2}-\d{2}[T ]\d/.test(s)) return soData(s);
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    return ehData(d) ? diaLocal(d) : soData(s);
  }
  // "2026-10", "2026-10-01" ou Date → "2026-10". Inválido → ''.
  function mesDe(v) {
    if (ehData(v)) return diaLocal(v).slice(0, 7);
    const s = String(v ?? '').trim();
    return /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(s) ? s.slice(0, 7) : '';
  }
  const ultimoDia = (mes) => { const [a, m] = mes.split('-').map(Number); return `${mes}-${dois(new Date(Date.UTC(a, m, 0)).getUTCDate())}`; };
  const rotuloMes = (mes) => (mesDe(mes) ? `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}` : '');
  // Mês anterior/seguinte, sem passar por fuso.
  function somarMeses(mes, n) {
    const [a, m] = mesDe(mes).split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${dois((t % 12) + 1)}`;
  }

  // ── Leituras da peça ─────────────────────────────────────────────────────────────────────────
  const clientesDaPeca = (d) => [...lista(d?.clientes), d?.cliente].filter(Boolean).map(chaveTexto);
  const dataDaPeca = (d) => soData(d?.veiculacao_iso) || soData(d?.prazo_iso);
  const formatoDe = (d) => { const f = String(d?.formato ?? '').trim(); return !f || /^[—–-]+$/.test(f) ? 'Sem formato' : f; };
  const tituloDe = (d) => String(d?.nome ?? d?.titulo ?? '').trim() || 'Peça sem título';
  // Atração / Educação / Conversão a partir de qualquer grafia.
  function objetivoNormal(v) {
    const t = chaveTexto(typeof v === 'object' && v ? (v.objetivo ?? v.chave ?? v.rotulo) : v);
    if (!t) return '';
    if (/^(atra|atrair|alcance|descoberta|topo)/.test(t)) return 'atracao';
    if (/^(educa|ensin|autoridade|meio|relacionamento)/.test(t)) return 'educacao';
    if (/^(conver|venda|vender|oferta|fundo)/.test(t)) return 'conversao';
    return '';
  }

  function resumoDoMes({ pecas = [], cliente = '', mes, hoje = new Date(), objetivoDe = null, entregue = null, ehSolicitacao = null } = {}) {
    const m = mesDe(mes);
    if (!m) throw new TypeError('Mês inválido: use AAAA-MM.');
    const alvo = chaveTexto(cliente);
    const inicio = `${m}-01`, fim = ultimoDia(m), dHoje = diaDe(hoje) || diaLocal(new Date());
    const foiEntregue = typeof entregue === 'function' ? entregue : (d) => ENTREGUE.has(chaveStatus(d?.status));
    const solicitacao = typeof ehSolicitacao === 'function' ? ehSolicitacao : (d) => d?.origem === 'solicitacao';
    const objetivoBruto = (d) => { try { return typeof objetivoDe === 'function' ? objetivoDe(d) ?? d?.objetivo : d?.objetivo; } catch { return d?.objetivo; } };

    const vistas = new Set();
    const doMes = [];
    for (const d of lista(pecas)) {
      if (!d || solicitacao(d)) continue;
      const id = d.id != null ? String(d.id) : '';
      if (id && vistas.has(id)) continue;
      if (alvo && !clientesDaPeca(d).includes(alvo)) continue;
      const data = dataDaPeca(d);
      if (!data || data < inicio || data > fim) continue;
      if (id) vistas.add(id);
      const ok = Boolean(foiEntregue(d));
      const diaEntrega = ok ? diaDe(d.status_updated_at) : '';
      const pausada = PAUSADA.has(chaveStatus(d.status));
      doMes.push({
        id, nome: tituloDe(d), formato: formatoDe(d), data, status: String(d.status ?? '').trim() || 'Sem status',
        entregue: ok, diaEntrega, noPrazo: ok && diaEntrega ? diaEntrega <= data : null,
        atrasada: !ok && !pausada && data < dHoje, objetivo: objetivoNormal(objetivoBruto(d)),
      });
    }
    doMes.sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, 'pt-BR'));

    const entregues = doMes.filter((p) => p.entregue);
    const noPrazo = entregues.filter((p) => p.noPrazo === true).length;
    const foraDoPrazo = entregues.filter((p) => p.noPrazo === false).length;
    const medidas = noPrazo + foraDoPrazo;

    const formatos = new Map();
    for (const p of doMes) {
      const f = formatos.get(p.formato) || { formato: p.formato, total: 0, entregues: 0 };
      f.total += 1; if (p.entregue) f.entregues += 1;
      formatos.set(p.formato, f);
    }
    const porFormato = [...formatos.values()].sort((a, b) => (b.total - a.total) || (a.formato === 'Sem formato') - (b.formato === 'Sem formato') || a.formato.localeCompare(b.formato, 'pt-BR'));

    const status = new Map();
    for (const p of doMes) status.set(p.status, (status.get(p.status) || 0) + 1);
    const porStatus = [...status].map(([s, total]) => ({ status: s, total })).sort((a, b) => (b.total - a.total) || a.status.localeCompare(b.status, 'pt-BR'));

    const contagem = Object.fromEntries(OBJETIVOS.map((o) => [o.chave, doMes.filter((p) => p.objetivo === o.chave).length]));
    const comObjetivo = OBJETIVOS.reduce((t, o) => t + contagem[o.chave], 0);
    const objetivos = {
      disponivel: comObjetivo > 0,
      comObjetivo,
      semObjetivo: doMes.length - comObjetivo,
      itens: OBJETIVOS.map((o) => ({ ...o, total: contagem[o.chave], pct: comObjetivo ? Math.round((contagem[o.chave] / comObjetivo) * 100) : 0 })),
    };

    return {
      cliente: String(cliente || '').trim(), mes: m, rotuloMes: rotuloMes(m), inicio, fim,
      total: doMes.length,
      entregues: entregues.length,
      abertas: doMes.length - entregues.length,
      atrasadas: doMes.filter((p) => p.atrasada).length,
      noPrazo, foraDoPrazo,
      semDiaDaEntrega: entregues.filter((p) => p.noPrazo === null).length,
      noPrazoPct: medidas ? Math.round((noPrazo / medidas) * 100) : null,
      porFormato, porStatus, objetivos, pecas: doMes,
    };
  }

  const api = Object.freeze({
    resumoDoMes,
    OBJETIVOS,
    util: Object.freeze({ mesDe, rotuloMes, somarMeses, ultimoDia, diaDe, chaveTexto, chaveStatus, objetivoNormal, formatoDe }),
  });
  raiz.VybeRelatorioResumo = api;
  if (raiz.window && typeof raiz.window === 'object' && raiz.window !== raiz) raiz.window.VybeRelatorioResumo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
