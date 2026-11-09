// vybe-carteira-saude.js — a nota de saúde (0 a 100) e o risco de churn de cada cliente.
//
// Paulo, 07/11/2026 (inspirado no AgencyFlow): a Carteira mostra, sozinha, quais clientes pedem
// cuidado antes que eles esfriem. Este arquivo só faz contas: não lê DOM, não busca nada na rede e
// não lê os globais do painel. Quem chama passa os dados (no painel: DADOS_ALL, CADASTRO_CLIENTES e
// os sinais de GET /api/painel?area=carteira). Deixa no escopo global só VybeCarteiraSaude
// (window.VybeCarteiraSaude no navegador; module.exports quando houver).
//
//   VybeCarteiraSaude.calcular({ demandas, clientes, sinais = null, hoje = new Date() })
//
// Depende de VybeDono (vybe-dono-metricas.js, carregado antes): atrasos, furos, risco de furo e
// posts da semana vêm de VybeDono.calcular, com as MESMAS definições do módulo Gestão (a data do
// cliente manda; só clientes ativos do cadastro, com o nome do cadastro).
//
// ── A nota ──────────────────────────────────────────────────────────────────────
// Começa em 100 e perde pontos por sinal (cada sinal tem teto). Fica entre 0 e 100.
//  1. Atrasos: veiculação vencida (furo) −10 cada; só o prazo interno vencido −5 cada. Teto −35.
//  2. Risco de furo (vai ao ar em até 2 dias sem andamento): −3 cada. Teto −9.
//  3. Voltas para alteração: com os sinais do servidor, as trocas de status para "Alteração" nos
//     últimos 30 dias (vybe_conteudo_eventos); sem eles, as peças em Alteração agora. A primeira
//     não conta; −4 a partir da segunda. Teto −16.
//  4. Tempo em aprovação do cliente: o maior entre a peça esperando "Ag. Aprovação Cliente" há
//     mais tempo (dias desde status_updated_at) e a mediana histórica do servidor (60 dias).
//     4 a 6 dias −6; 7 ou mais −12.
//  5. Entregas no prazo: peças entregues nos últimos 60 dias (dia da última troca de status) até
//     a data da peça (veiculação; sem ela, o prazo). Com 4 ou mais na amostra e abaixo de 90%:
//     −(90 − %)/3, teto −20.
//  6. Calendário: nenhum conteúdo nesta semana nem na próxima −12; abaixo da meta de 3 posts
//     nesta semana −4.
//  7. Fim de contrato (só se o cadastro tiver o campo: fim_contrato, contrato_fim ou
//     contrato_ate): vencido −20; em até 30 dias −15; em até 60 dias −8. Hoje o cadastro não
//     tem esse campo; quando tiver, entra sozinho.
//  8. Pagamento (só se o cadastro tiver: pagamento_atrasado = true, ou pagamento/situacao_pagamento
//     com "atras", "inadimpl" ou "pendente"): −20. Financeiro mora no VybeFinanças; hoje não vem.
//  9. NPS (nps e nps_em do cadastro, nota do último ano): 0–6 detrator −15; 7–8 neutro −4.
// 10. Sem reunião (ultima_reuniao): mais de 60 dias −6. Sem registro não perde ponto.
//
// 11. Clima do grupo (sinal externo, opcional): o bot do WhatsApp lê o grupo do cliente e grava na
//     tabela vybe_carteira_clima (migração 2026-11-07-carteira.sql) pela rota POST
//     /api/painel?area=carteira acao=clima, corpo { clientes: { "<nome do cliente>": { pontos, motivo, em } } }
//     (server/carteira.js, gravarClima; só serviço ou quem administra). Uma linha por cliente:
//       cliente_id bigint, pontos smallint (−20 a +10), motivo text (até 200 caracteres, frase curta
//       para a tela, ex.: "cliente reclamou do atraso duas vezes"), origem text (ex.: 'bot'),
//       atualizado_em timestamptz.
//     GET area=carteira devolve em `clima.porCliente` = { [cliente_id]: { pontos, motivo, atualizado_em } }
//     e a tela passa aqui como `clima` (mesmo formato; o mapa direto também vale). Pontos fora de
//     −20..+10 são cortados; sinal com mais de 14 dias é ignorado; sem tabela ou sem linha, ignorado.
//     Negativo tira pontos (motivo "ruim"); positivo soma até o teto de 100 (motivo "bom").
//
// Risco de churn: nota abaixo de 50 = alto (urgência 1, vermelho); 50 a 74 = médio (urgência 2,
// âmbar); 75 ou mais = baixo (urgência 6, verde). Ordem: menor nota primeiro ("prioritários").
// `motivos` diz o porquê em frases curtas (o que tirou ponto, do maior para o menor) e, depois,
// o que vai bem (tom "bom").
//
// Heads: a carteira de cada head é a lista de heads do cadastro (vybe_cliente_pessoas, campo
// `heads`, "Nome A, Nome B"). Cliente com vários heads entra na média de cada um; sem head vai
// para "Sem head". Média simples das notas, arredondada.
//
// Paulo, 08/11/2026 (AgencyFlow, Clientes e Finanças): tempo de casa (LTV) e tempo restante de
// contrato por cliente (tempoDeCasa, nas linhas de contratos()), LTV médio, receita estimada do LTV,
// clientes novos e tempo restante médio (totais de contratos()), séries mês a mês (serieMensal) e
// contas por head com receita (contasPorHead). As regras estão em cima de cada função.

(function (raiz) {
  'use strict';

  const REGRAS = Object.freeze({
    furo: 10, prazoVencido: 5, tetoAtraso: 35,
    risco: 3, tetoRisco: 9,
    ajuste: 4, tetoAjuste: 16,
    aprovacaoAtencao: 4, aprovacaoGrave: 7, perdaAprovacaoAtencao: 6, perdaAprovacaoGrave: 12,
    prazoJanelaDias: 60, prazoAmostraMinima: 4, prazoAlvoPct: 90, tetoPrazo: 20,
    semCalendario: 12, abaixoDaMeta: 4, metaSemana: 3,
    contratoVencido: 20, contrato30: 15, contrato60: 8,
    pagamento: 20,
    npsDetrator: 15, npsNeutro: 4, npsValidadeDias: 365,
    reuniaoDias: 60, semReuniao: 6,
    climaMin: -20, climaMax: 10, climaValidadeDias: 14,
    riscoAlto: 50, riscoMedio: 75,
  });
  const RISCOS = Object.freeze({
    alto: { rotulo: 'Risco alto', nivel: 'u1' },
    medio: { rotulo: 'Risco médio', nivel: 'u2' },
    baixo: { rotulo: 'Risco baixo', nivel: 'u6' },
  });
  const SEM_HEAD = 'Sem head';

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const dois = (n) => String(n).padStart(2, '0');
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const dataCurta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const chaveNome = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const compararNomes = (a, b) => String(a).localeCompare(String(b), 'pt-BR');

  function riscoDaNota(score) {
    if (score < REGRAS.riscoAlto) return 'alto';
    if (score < REGRAS.riscoMedio) return 'medio';
    return 'baixo';
  }

  // Sinais do servidor: { porCliente: { [cliente_id]: { ajustes30, aprovacao_dias, aprovacoes } } }
  // ou o mapa direto. Sem eles, null (a conta usa só o que está na tela).
  function sinaisDe(entrada) {
    if (!entrada || typeof entrada !== 'object') return null;
    const mapa = entrada.porCliente && typeof entrada.porCliente === 'object' ? entrada.porCliente : entrada;
    const m = new Map();
    for (const [id, v] of Object.entries(mapa)) if (v && typeof v === 'object') m.set(String(id), v);
    return m;
  }
  const numeroOuNulo = (v) => (v === null || v === undefined || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const dataDoCadastro = (c, campos) => {
    for (const k of campos) { const s = String(c?.[k] ?? '').slice(0, 10); if (ISO.test(s)) return s; }
    return '';
  };
  function headsDe(c) {
    const lista = Array.isArray(c?.heads) ? c.heads : String(c?.heads || '').split(',');
    const nomes = [];
    for (const n of lista) { const s = String(n || '').trim(); if (s && !nomes.includes(s)) nomes.push(s); }
    return nomes;
  }

  function calcular(entrada) {
    const { demandas = [], clientes = [], sinais = null, clima = null, hoje = new Date() } = entrada || {};
    const D = raiz.VybeDono || (raiz.window && raiz.window.VybeDono);
    if (!D || typeof D.calcular !== 'function') throw new Error('VybeCarteiraSaude precisa de VybeDono (vybe-dono-metricas.js).');
    const U = D.util;
    const R = REGRAS;
    const dia = typeof hoje === 'string' && ISO.test(hoje) ? hoje : U.diaLocal(hoje instanceof Date ? hoje : new Date(hoje));
    const dono = D.calcular({ demandas, clientes, hoje: dia });
    const mapaSinais = sinaisDe(sinais);
    const mapaClima = sinaisDe(clima);

    // Cadastro ativo pelo nome (o mesmo nome que a Gestão mostra).
    const cadastro = (Array.isArray(clientes) ? clientes : []).filter((c) => c && String(c.nome || '').trim());
    const cadPorChave = new Map();
    for (const c of cadastro) if (U.ativoNoCadastro(c)) { const k = chaveNome(c.nome); if (k && !cadPorChave.has(k)) cadPorChave.set(k, c); }

    // Uma passada pelas peças para o que a Gestão não conta: aprovação, alteração e prazo em 60 dias.
    const desdePrazo = U.somarDias(dia, -R.prazoJanelaDias);
    const extra = new Map();
    const fichaExtra = (nome) => {
      let x = extra.get(nome);
      if (!x) { x = { aprovacao: [], alteracaoAgora: 0, noPrazo: 0, foraDoPrazo: 0 }; extra.set(nome, x); }
      return x;
    };
    const nomesDosClientes = new Map(dono.clientes.map((c) => [chaveNome(c.cliente), c.cliente]));
    const vistos = new Set();
    for (const d of Array.isArray(demandas) ? demandas : []) {
      if (!d || typeof d !== 'object') continue;
      const id = d.id == null ? '' : String(d.id);
      if (id) { if (vistos.has(id)) continue; vistos.add(id); }
      const lista = Array.isArray(d.clientes) && d.clientes.length ? d.clientes : [d.cliente];
      const deles = [];
      for (const n of lista) { const nome = nomesDosClientes.get(chaveNome(n)); if (nome && !deles.includes(nome)) deles.push(nome); }
      if (!deles.length) continue;
      const chave = U.chaveStatus(d.status);
      const entregue = U.entregue(d.status);
      const diaStatus = U.diaDe(d.status_updated_at);
      const veic = U.diaDe(d.veiculacao_iso), prazo = U.diaDe(d.prazo_iso);
      const data = veic || prazo;
      for (const nome of deles) {
        const x = fichaExtra(nome);
        if (!entregue && chave === 'ag aprovacao cliente') x.aprovacao.push(diaStatus ? Math.max(0, U.diasEntre(diaStatus, dia)) : null);
        if (!entregue && chave === 'alteracao') x.alteracaoAgora++;
        if (entregue && diaStatus && data && diaStatus >= desdePrazo && diaStatus <= dia) {
          if (diaStatus <= data) x.noPrazo++; else x.foraDoPrazo++;
        }
      }
    }

    const listaClientes = dono.clientes.map((g) => {
      const cad = cadPorChave.get(chaveNome(g.cliente)) || null;
      const x = extra.get(g.cliente) || { aprovacao: [], alteracaoAgora: 0, noPrazo: 0, foraDoPrazo: 0 };
      const s = cad?.id != null && mapaSinais ? mapaSinais.get(String(cad.id)) || null : null;
      const perdas = [], bons = [];
      const perder = (pontos, texto) => { if (pontos > 0) perdas.push({ texto, pontos: -Math.round(pontos), tom: 'ruim' }); };

      // 1 e 2. Atrasos e risco de furo (as contas da Gestão).
      const soPrazo = g.atrasadas - g.furos;
      const perdaAtraso = Math.min(R.tetoAtraso, g.furos * R.furo + soPrazo * R.prazoVencido);
      if (perdaAtraso) {
        const partes = [];
        if (g.furos) partes.push(`${plural(g.furos, 'peça', 'peças')} com a veiculação vencida`);
        if (soPrazo) partes.push(`${plural(soPrazo, 'peça', 'peças')} com o prazo interno vencido`);
        perder(perdaAtraso, partes.join(' e '));
      }
      perder(Math.min(R.tetoRisco, g.emRisco * R.risco), `${plural(g.emRisco, 'peça', 'peças')} com risco de furo`);

      // 3. Voltas para alteração.
      const ajustesServidor = numeroOuNulo(s?.ajustes30);
      const ajustes = ajustesServidor ?? x.alteracaoAgora;
      const ajustesFonte = ajustesServidor === null ? 'tela' : 'servidor';
      if (ajustes >= 2) {
        perder(Math.min(R.tetoAjuste, (ajustes - 1) * R.ajuste), ajustesFonte === 'servidor'
          ? `${plural(ajustes, 'volta', 'voltas')} para alteração em 30 dias`
          : `${plural(ajustes, 'peça', 'peças')} em alteração agora`);
      }

      // 4. Tempo em aprovação do cliente.
      const esperando = x.aprovacao.length;
      const esperaAgora = x.aprovacao.reduce((m, v) => (v != null && v > m ? v : m), 0);
      const medianaServidor = numeroOuNulo(s?.aprovacao_dias);
      const diasAprovacao = Math.max(esperaAgora, medianaServidor === null ? 0 : Math.round(medianaServidor));
      if (diasAprovacao >= R.aprovacaoAtencao) {
        const perda = diasAprovacao >= R.aprovacaoGrave ? R.perdaAprovacaoGrave : R.perdaAprovacaoAtencao;
        const texto = esperaAgora >= diasAprovacao && esperando
          ? `aprovação parada há ${esperaAgora} dias (${plural(esperando, 'peça esperando', 'peças esperando')})`
          : `o cliente leva ${diasAprovacao} dias para aprovar (mediana)`;
        perder(perda, texto);
      }

      // 5. Entregas no prazo (60 dias).
      const amostra = x.noPrazo + x.foraDoPrazo;
      const noPrazoPct = amostra ? Math.round((x.noPrazo / amostra) * 100) : null;
      if (amostra >= R.prazoAmostraMinima) {
        if (noPrazoPct < R.prazoAlvoPct) perder(Math.min(R.tetoPrazo, (R.prazoAlvoPct - noPrazoPct) / 3), `${noPrazoPct}% das entregas no prazo em 60 dias`);
        else bons.push(`${noPrazoPct}% das entregas no prazo`);
      }

      // 6. Calendário.
      if (!g.semana && !g.proximaSemana) perder(R.semCalendario, 'sem conteúdo nesta semana nem na próxima');
      else if (g.semana < R.metaSemana) perder(R.abaixoDaMeta, `${g.semana}/${R.metaSemana} posts nesta semana`);
      else bons.push(`${g.semana} posts nesta semana`);

      // 7. Fim de contrato (se houver o campo).
      const fimContrato = dataDoCadastro(cad, ['fim_contrato', 'contrato_fim', 'contrato_ate']);
      const diasContrato = fimContrato ? U.diasEntre(dia, fimContrato) : null;
      if (diasContrato !== null) {
        if (diasContrato < 0) perder(R.contratoVencido, `contrato venceu em ${dataCurta(fimContrato)}`);
        else if (diasContrato <= 30) perder(R.contrato30, diasContrato === 0 ? 'contrato vence hoje' : `contrato vence em ${plural(diasContrato, 'dia', 'dias')}`);
        else if (diasContrato <= 60) perder(R.contrato60, `contrato vence em ${diasContrato} dias`);
      }

      // 8. Pagamento (se houver o campo).
      const pagamentoRuim = cad?.pagamento_atrasado === true
        || /atras|inadimpl|pendente/i.test(String(cad?.pagamento ?? cad?.situacao_pagamento ?? ''));
      if (pagamentoRuim) perder(R.pagamento, 'pagamento em atraso');

      // 9. NPS do último ano.
      const nps = numeroOuNulo(cad?.nps);
      const npsEm = dataDoCadastro(cad, ['nps_em']);
      const npsValido = nps !== null && (!npsEm || U.diasEntre(npsEm, dia) <= R.npsValidadeDias);
      if (npsValido) {
        if (nps <= 6) perder(R.npsDetrator, `NPS ${nps} (detrator)`);
        else if (nps <= 8) perder(R.npsNeutro, `NPS ${nps} (neutro)`);
        else bons.push(`NPS ${nps} (promotor)`);
      }

      // 10. Reunião.
      const ultimaReuniao = dataDoCadastro(cad, ['ultima_reuniao']);
      const diasSemReuniao = ultimaReuniao ? U.diasEntre(ultimaReuniao, dia) : null;
      if (diasSemReuniao !== null && diasSemReuniao > R.reuniaoDias) perder(R.semReuniao, `sem reunião há ${diasSemReuniao} dias`);

      // 11. Clima do grupo (sinal do bot).
      let climaPontos = null;
      const cl = cad?.id != null && mapaClima ? mapaClima.get(String(cad.id)) : null;
      const climaDia = cl ? U.diaDe(cl.atualizado_em) : '';
      if (cl && numeroOuNulo(cl.pontos) !== null && (!climaDia || U.diasEntre(climaDia, dia) <= R.climaValidadeDias)) {
        climaPontos = Math.max(R.climaMin, Math.min(R.climaMax, Math.round(Number(cl.pontos))));
        const motivo = String(cl.motivo || '').trim().slice(0, 200) || (climaPontos < 0 ? 'clima ruim no grupo' : 'clima bom no grupo');
        if (climaPontos < 0) perder(-climaPontos, `grupo: ${motivo}`);
        else if (climaPontos > 0) bons.push(`grupo: ${motivo}`);
      }

      if (!g.atrasadas && !g.emRisco) bons.push('nada atrasado');

      const total = perdas.reduce((t, p) => t - p.pontos, 0) - (climaPontos > 0 ? climaPontos : 0);
      const score = Math.max(0, Math.min(100, 100 - total));
      const risco = riscoDaNota(score);
      perdas.sort((a, b) => a.pontos - b.pontos);
      return {
        id: cad?.id != null ? String(cad.id) : '',
        nome: g.cliente,
        score, risco, nivel: RISCOS[risco].nivel, rotuloRisco: RISCOS[risco].rotulo,
        motivos: [...perdas, ...bons.map((texto) => ({ texto, pontos: 0, tom: 'bom' }))],
        heads: headsDe(cad),
        carteira: String(cad?.responsavel || '').trim(),
        numeros: {
          abertas: g.abertas, atrasadas: g.atrasadas, furos: g.furos, emRisco: g.emRisco,
          ajustes, ajustesFonte, aguardandoAprovacao: esperando, diasAprovacao,
          noPrazoPct, entreguesAmostra: amostra, semana: g.semana, proximaSemana: g.proximaSemana,
          fimContrato: fimContrato || null, diasContrato, nps: npsValido ? nps : null, diasSemReuniao, clima: climaPontos,
        },
      };
    }).sort((a, b) => (a.score - b.score) || compararNomes(a.nome, b.nome));

    // Média por head.
    const porHead = new Map();
    for (const c of listaClientes) {
      for (const h of c.heads.length ? c.heads : [SEM_HEAD]) {
        let x = porHead.get(h);
        if (!x) { x = { head: h, clientes: [] }; porHead.set(h, x); }
        x.clientes.push(c);
      }
    }
    const heads = [...porHead.values()].map((x) => {
      const media = Math.round(x.clientes.reduce((t, c) => t + c.score, 0) / x.clientes.length);
      const risco = riscoDaNota(media);
      return {
        head: x.head, semHead: x.head === SEM_HEAD, media, risco, nivel: RISCOS[risco].nivel,
        total: x.clientes.length,
        alto: x.clientes.filter((c) => c.risco === 'alto').length,
        medio: x.clientes.filter((c) => c.risco === 'medio').length,
        baixo: x.clientes.filter((c) => c.risco === 'baixo').length,
        piores: x.clientes.slice(0, 3).map((c) => ({ nome: c.nome, score: c.score, risco: c.risco })),
      };
    }).sort((a, b) => (Number(a.semHead) - Number(b.semHead)) || (a.media - b.media) || compararNomes(a.head, b.head));

    const n = listaClientes.length;
    const comCampo = (k) => cadastro.some((c) => Object.prototype.hasOwnProperty.call(c, k));
    return {
      dia,
      clientes: listaClientes,
      heads,
      resumo: {
        total: n,
        media: n ? Math.round(listaClientes.reduce((t, c) => t + c.score, 0) / n) : null,
        alto: listaClientes.filter((c) => c.risco === 'alto').length,
        medio: listaClientes.filter((c) => c.risco === 'medio').length,
        baixo: listaClientes.filter((c) => c.risco === 'baixo').length,
      },
      fonte: {
        clientes: dono.fonte?.clientes || '',
        sinais: mapaSinais ? 'servidor' : 'tela',
        clima: Boolean(mapaClima),
        contrato: ['fim_contrato', 'contrato_fim', 'contrato_ate'].some(comCampo),
        pagamento: ['pagamento_atrasado', 'pagamento', 'situacao_pagamento'].some(comCampo),
      },
    };
  }

  // ── Período, variação, churn, cohort e contratos ───────────────────────────────
  // Datas YYYY-MM-DD comparadas como texto, sem fuso (as mesmas contas de VybeDono.util).
  const emUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const somarDias = (iso, n) => new Date(emUtc(iso) + n * 864e5).toISOString().slice(0, 10);
  const diasEntre = (de, ate) => Math.round((emUtc(ate) - emUtc(de)) / 864e5);
  const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  // Mesmo dia N meses depois (31/01 + 1 mês = 28/02 ou 29/02).
  function somarMeses(iso, n) {
    const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10));
    const ano = a + Math.floor(m / 12), mes = ((m % 12) + 12) % 12 + 1;
    return `${ano}-${dois(mes)}-${dois(Math.min(d, ultimoDia(ano, mes)))}`;
  }
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeDoMes = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
  const diaDeHoje = (hoje) => (typeof hoje === 'string' && ISO.test(hoje) ? hoje
    : (() => { const d = hoje instanceof Date ? hoje : new Date(hoje || Date.now()); return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`; })());

  // periodo('mensal', '2026-11') → nov/2026 contra out/2026; periodo('anual', '2026-11') → 2026 contra 2025.
  function periodo(tipo, mes) {
    const ym = /^\d{4}-\d{2}$/.test(String(mes || '')) ? mes : '';
    if (!ym) throw new Error('Mês inválido (use AAAA-MM).');
    const ano = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
    if (tipo === 'anual') {
      return { tipo: 'anual', inicio: `${ano}-01-01`, fim: `${ano}-12-31`, rotulo: String(ano),
        anterior: { inicio: `${ano - 1}-01-01`, fim: `${ano - 1}-12-31`, rotulo: String(ano - 1) } };
    }
    const ini = `${ym}-01`, antes = somarMeses(ini, -1).slice(0, 7);
    return { tipo: 'mensal', inicio: ini, fim: `${ym}-${dois(ultimoDia(ano, m))}`, rotulo: nomeDoMes(ym),
      anterior: { inicio: `${antes}-01`, fim: `${antes}-${dois(ultimoDia(Number(antes.slice(0, 4)), Number(antes.slice(5, 7))))}`, rotulo: nomeDoMes(antes) } };
  }

  // Variação de um número contra o período anterior. `melhor`: 'maior' ou 'menor' (diz se subir é bom).
  function variacao(atual, anterior, melhor = 'maior') {
    if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
    const delta = Math.round((atual - anterior) * 10) / 10;
    const direcao = delta > 0 ? 'sobe' : delta < 0 ? 'desce' : 'igual';
    return { atual, anterior, delta, pct: anterior ? Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10 : null, direcao,
      bom: direcao === 'igual' ? null : (direcao === 'sobe') === (melhor === 'maior') };
  }

  // Ativo num dia: entrou até ele (sem entrada conhecida, conta como antigo) e ainda não tinha saído.
  const ativoEm = (c, iso) => (!c.entrada || c.entrada <= iso) && (!c.saida || c.saida > iso);
  const valorDe = (c, contrato) => { const v = contrato?.valor_mensal ?? c.valor; return v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); };
  const MOTIVOS_CHURN = Object.freeze({ preco: 'Preço', resultado: 'Resultado', atendimento: 'Atendimento', fechou_empresa: 'Fechou a empresa', internalizou: 'Internalizou', outro: 'Outro' });
  const TIPOS_CHURN = Object.freeze({ cancelamento: 'Cancelamento', nao_renovou: 'Não renovou', pausa: 'Pausa' });

  // Churn no período. Entradas: clientes = base do servidor ({ id, nome, ativo, entrada, saida, valor,
  // motivo_saida }); registros = classificações (vybe_cliente_churn); contratos = valor mensal.
  // - saídas = clientes com saída dentro do período (a classificação mais recente diz tipo e motivo).
  // - taxa = saídas ÷ clientes ativos na véspera do período (%, uma casa).
  // - receita perdida = soma da receita mensal de quem saiu (a do registro; sem ela, a do contrato ou do cadastro).
  // - tempo até sair = média, em meses, da entrada à saída de quem saiu no período (só quem tem entrada).
  // - principal motivo = o mais comum entre as saídas classificadas do período.
  function churn({ clientes = [], registros = [], contratos: listaContratos = [], tipo = 'mensal', mes } = {}) {
    const p = periodo(tipo, mes);
    const contratoDe = new Map((listaContratos || []).map((c) => [String(c.cliente_id), c]));
    const registroDe = new Map();
    for (const r of [...(registros || [])].sort((a, b) => String(b.saiu_em).localeCompare(String(a.saiu_em)))) if (!registroDe.has(String(r.cliente_id))) registroDe.set(String(r.cliente_id), r);
    const base = (clientes || []).filter((c) => c && c.id != null);
    const saidaDe = (c) => {
      const r = registroDe.get(String(c.id));
      return { id: String(c.id), nome: c.nome, entrada: c.entrada || null, saida: c.saida, saidaFonte: c.saida_fonte || null,
        tipo: r?.tipo || null, motivo: r?.motivo || null, detalhe: r?.detalhe || '', registroId: r?.id ? String(r.id) : null,
        motivoLivre: c.motivo_saida || '', classificado: Boolean(r),
        receita: r?.receita_mensal != null ? Number(r.receita_mensal) : valorDe(c, contratoDe.get(String(c.id))),
        meses: c.entrada && c.saida ? Math.round((diasEntre(c.entrada, c.saida) / 30.44) * 10) / 10 : null };
    };
    const todas = base.filter((c) => c.saida).map(saidaDe).sort((a, b) => b.saida.localeCompare(a.saida) || compararNomes(a.nome, b.nome));
    const numeros = (q) => {
      const saidas = todas.filter((s) => s.saida >= q.inicio && s.saida <= q.fim);
      const vespera = somarDias(q.inicio, -1);
      const ativosNoInicio = base.filter((c) => ativoEm(c, vespera)).length;
      const comMeses = saidas.filter((s) => s.meses != null);
      const contagem = new Map();
      for (const s of saidas) if (s.motivo) contagem.set(s.motivo, (contagem.get(s.motivo) || 0) + 1);
      const [principal] = [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const comReceita = saidas.filter((s) => s.receita != null);
      return {
        saidas: saidas.length, ativosNoInicio,
        taxa: ativosNoInicio ? Math.round((saidas.length / ativosNoInicio) * 1000) / 10 : null,
        receitaPerdida: Math.round(comReceita.reduce((t, s) => t + s.receita, 0) * 100) / 100,
        semReceita: saidas.length - comReceita.length,
        tempoMedioMeses: comMeses.length ? Math.round((comMeses.reduce((t, s) => t + s.meses, 0) / comMeses.length) * 10) / 10 : null,
        principalMotivo: principal ? { motivo: principal[0], rotulo: MOTIVOS_CHURN[principal[0]] || principal[0], vezes: principal[1] } : null,
        semClassificar: saidas.filter((s) => !s.classificado).length,
        lista: saidas,
      };
    };
    const atual = numeros(p), anterior = numeros(p.anterior);
    const porMotivo = Object.keys(MOTIVOS_CHURN).map((m) => ({ motivo: m, rotulo: MOTIVOS_CHURN[m], vezes: atual.lista.filter((s) => s.motivo === m).length }));
    const { lista: _semLista, ...resumoAnterior } = anterior;
    return { periodo: p, ...atual, anterior: resumoAnterior, porMotivo, todas,
      variacao: {
        taxa: variacao(atual.taxa, anterior.taxa, 'menor'),
        saidas: variacao(atual.saidas, anterior.saidas, 'menor'),
        receitaPerdida: variacao(atual.receitaPerdida, anterior.receitaPerdida, 'menor'),
        tempoMedioMeses: variacao(atual.tempoMedioMeses, anterior.tempoMedioMeses, 'maior'),
      } };
  }

  // Cohort de retenção: linhas = mês de entrada (os `meses` mais recentes com alguém entrando);
  // colunas = 1º, 2º, 3º, 6º e 12º mês: % de quem entrou naquele mês e seguia ativo no mesmo dia N
  // meses depois. Célula que ainda não chegou = null. Cliente sem entrada conhecida fica de fora.
  const COLUNAS_COHORT = Object.freeze([1, 2, 3, 6, 12]);
  function cohort({ clientes = [], hoje, meses = 12 } = {}) {
    const dia = diaDeHoje(hoje);
    const porMes = new Map();
    for (const c of clientes || []) {
      if (!c?.entrada || c.entrada > dia) continue;
      const ym = c.entrada.slice(0, 7);
      if (!porMes.has(ym)) porMes.set(ym, []);
      porMes.get(ym).push(c);
    }
    const linhas = [...porMes.keys()].sort().reverse().slice(0, meses).map((ym) => {
      const grupo = porMes.get(ym);
      return { mes: ym, rotulo: nomeDoMes(ym), entraram: grupo.length,
        colunas: COLUNAS_COHORT.map((n) => {
          const alvos = grupo.map((c) => [c, somarMeses(c.entrada, n)]);
          if (alvos.some(([, a]) => a > dia)) return { mes: n, pct: null, ficaram: null };
          const ficaram = alvos.filter(([c, a]) => !c.saida || c.saida > a).length;
          return { mes: n, ficaram, pct: Math.round((ficaram / grupo.length) * 100) };
        }) };
    });
    return { colunas: COLUNAS_COHORT, linhas, semEntrada: (clientes || []).filter((c) => c && !c.entrada).length };
  }

  // Contratos dos clientes ativos. Renovação em breve = em 0 a 30 dias; vencida = antes de hoje
  // (contrato encerrado não entra em nenhuma das duas). Receita mensal ativa = soma do valor mensal
  // (do contrato; sem ele, o do cadastro) de quem estava ativo no último dia do período (ou hoje, se
  // o período não acabou), sem contrato encerrado nem contrato que ainda não começou.
  // Tempo de casa (LTV) e tempo restante de cada linha: ver tempoDeCasa, logo abaixo.
  // Totais novos: ltvMedio (meses, média de quem tem data), receitaLtv (soma de valor mensal × meses
  // de casa), restanteMedio (dias e meses até a renovação, só contratos abertos que ainda não venceram)
  // e novos (clientes com entrada dentro do período, inclusive quem já saiu; o anterior para comparar).
  function contratos({ clientes = [], contratos: lista = [], hoje, tipo = 'mensal', mes } = {}) {
    const dia = diaDeHoje(hoje);
    const p = periodo(tipo, mes || dia.slice(0, 7));
    const contratoDe = new Map((lista || []).map((c) => [String(c.cliente_id), c]));
    const base = (clientes || []).filter((c) => c && c.id != null);
    const linhas = base.filter((c) => c.ativo).map((c) => {
      const ct = contratoDe.get(String(c.id)) || null;
      const dias = ct?.renovacao ? diasEntre(dia, ct.renovacao) : null;
      const aberto = ct?.status !== 'encerrado';
      const valor = valorDe(c, ct);
      return { id: String(c.id), nome: c.nome, temContrato: Boolean(ct), valor, valorDoCadastro: ct?.valor_mensal == null && c.valor != null,
        inicio: ct?.inicio || null, renovacao: ct?.renovacao || null, status: ct?.status || null, observacao: ct?.observacao || '',
        diasRenovacao: dias, emBreve: aberto && dias != null && dias >= 0 && dias <= 30, vencida: aberto && dias != null && dias < 0,
        ...tempoDeCasa(c, ct, dia, valor) };
    }).sort((a, b) => (a.diasRenovacao ?? 1e9) - (b.diasRenovacao ?? 1e9) || compararNomes(a.nome, b.nome));
    const comLtv = linhas.filter((l) => l.mesesLtv != null);
    const comReceitaLtv = linhas.filter((l) => l.receitaLtv != null);
    const comRestante = linhas.filter((l) => l.diasRestantes != null);
    const diasRestantesMedio = comRestante.length ? Math.round(comRestante.reduce((t, l) => t + l.diasRestantes, 0) / comRestante.length) : null;
    const novosEm = (q) => base.map((c) => ({ c, ...entradaDe(c, contratoDe.get(String(c.id)) || null) }))
      .filter((x) => x.entrada && x.entrada >= q.inicio && x.entrada <= q.fim && x.entrada <= dia)
      .map((x) => ({ id: String(x.c.id), nome: x.c.nome, entrada: x.entrada, fonteEntrada: x.fonte, ativo: Boolean(x.c.ativo), saida: x.c.saida || null }))
      .sort((a, b) => b.entrada.localeCompare(a.entrada) || compararNomes(a.nome, b.nome));
    const novos = novosEm(p), novosAnterior = novosEm(p.anterior);
    const receitaEm = (iso) => {
      let total = 0;
      for (const c of base) {
        const ct = contratoDe.get(String(c.id));
        if (ct?.status === 'encerrado' || !ativoEm(c, iso) || (ct?.inicio && ct.inicio > iso)) continue;
        const v = valorDe(c, ct);
        if (v != null) total += v;
      }
      return Math.round(total * 100) / 100;
    };
    const receita = receitaEm(p.fim < dia ? p.fim : dia);
    const receitaAnterior = receitaEm(p.anterior.fim < dia ? p.anterior.fim : dia);
    const comValor = linhas.filter((l) => l.valor != null && l.status !== 'encerrado');
    return { periodo: p, linhas,
      emBreve: linhas.filter((l) => l.emBreve), vencidas: linhas.filter((l) => l.vencida),
      semContrato: linhas.filter((l) => !l.temContrato).length,
      receita, receitaAnterior, ticketMedio: comValor.length ? Math.round((comValor.reduce((t, l) => t + l.valor, 0) / comValor.length) * 100) / 100 : null,
      ltvMedio: media1(comLtv.map((l) => l.mesesLtv)), semDataLtv: linhas.length - comLtv.length,
      receitaLtv: comReceitaLtv.length ? reais2(comReceitaLtv.reduce((t, l) => t + l.receitaLtv, 0)) : null, semReceitaLtv: linhas.length - comReceitaLtv.length,
      restanteMedio: diasRestantesMedio == null ? null : { dias: diasRestantesMedio, meses: Math.round((diasRestantesMedio / DIAS_MES) * 10) / 10, contratos: comRestante.length },
      novos, novosAnterior: novosAnterior.length,
      variacao: { receita: variacao(receita, receitaAnterior, 'maior'), novos: variacao(novos.length, novosAnterior.length, 'maior') } };
  }

  // ── Tempo de casa (LTV), tempo restante e séries mensais ───────────────────────
  // Entrada = início do contrato; sem ele, a `entrada` que o servidor manda (criado_no_monday do
  // cadastro; sem ele, o primeiro evento do cliente — `entrada_fonte` diz qual). Sem nenhuma, "sem
  // data": fica fora das médias e das somas de LTV. Meses = dias ÷ 30,44 com uma casa (a mesma conta
  // do "tempo até sair" do churn). Contrato que começa no futuro conta 0 mês.
  const DIAS_MES = 30.44;
  const mesesEntre = (de, ate) => Math.max(0, Math.round((diasEntre(de, ate) / DIAS_MES) * 10) / 10);
  const media1 = (l) => (l.length ? Math.round((l.reduce((t, v) => t + v, 0) / l.length) * 10) / 10 : null);
  const reais2 = (v) => Math.round(v * 100) / 100;
  const FONTES_ENTRADA = Object.freeze({ contrato: 'início do contrato', cadastro: 'entrada no cadastro', historico: 'primeiro registro do cliente' });
  function entradaDe(c, ct) {
    if (ct?.inicio && ISO.test(String(ct.inicio).slice(0, 10))) return { entrada: String(ct.inicio).slice(0, 10), fonte: 'contrato' };
    const e = String(c?.entrada || '').slice(0, 10);
    if (!ISO.test(e)) return { entrada: null, fonte: null };
    return { entrada: e, fonte: FONTES_ENTRADA[c.entrada_fonte] ? c.entrada_fonte : 'cadastro' };
  }
  // Para uma linha: entrada, de onde ela veio, meses de casa até `dia` (ou até a saída), receita
  // estimada do LTV (valor mensal × meses; sem valor ou sem data, null) e o tempo até a renovação
  // (só contrato aberto com renovação de hoje em diante; vencida ou sem data = null).
  function tempoDeCasa(c, ct, dia, valor = valorDe(c, ct)) {
    const { entrada, fonte } = entradaDe(c, ct);
    const ate = c?.saida && c.saida < dia ? c.saida : dia;
    const mesesLtv = entrada ? mesesEntre(entrada, ate) : null;
    const dias = ct?.renovacao && ct.status !== 'encerrado' ? diasEntre(dia, ct.renovacao) : null;
    const diasRestantes = dias != null && dias >= 0 ? dias : null;
    return { entrada, fonteEntrada: fonte, mesesLtv,
      receitaLtv: mesesLtv != null && valor != null ? reais2(valor * mesesLtv) : null,
      diasRestantes, mesesRestantes: diasRestantes == null ? null : Math.round((diasRestantes / DIAS_MES) * 10) / 10 };
  }

  // Séries mês a mês (os `meses` mais recentes até `ate`, AAAA-MM; padrão: o mês de hoje). Para cada mês,
  // na data de referência (último dia do mês; no mês corrente, hoje):
  //  - ativos: entrou até a data (sem entrada conhecida conta como antigo) e não tinha saído — a mesma
  //    regra do churn;
  //  - novos: entrada dentro do mês; saídas: saída dentro do mês (a mesma do churn);
  //  - ltvMedio: média dos meses de casa dos ativos com data de entrada;
  //  - ticketMedio: receita mensal ativa ÷ clientes ativos com valor (as regras da receita de contratos():
  //    sem contrato encerrado nem contrato que ainda não começou).
  // Meses do começo sem nada (sem ativo, novo ou saída) saem, deixando pelo menos `minimo`.
  function serieMensal({ clientes = [], contratos: lista = [], hoje, ate, meses = 12, minimo = 6 } = {}) {
    const dia = diaDeHoje(hoje);
    const mesHoje = dia.slice(0, 7);
    const fimYm = /^\d{4}-\d{2}$/.test(String(ate || '')) && ate <= mesHoje ? ate : mesHoje;
    const contratoDe = new Map((lista || []).map((c) => [String(c.cliente_id), c]));
    const fichas = (clientes || []).filter((c) => c && c.id != null).map((c) => {
      const ct = contratoDe.get(String(c.id)) || null;
      return { c, ct, ...entradaDe(c, ct), saida: c.saida || null, valor: valorDe(c, ct) };
    });
    const pontos = [];
    for (let i = Math.max(1, meses) - 1; i >= 0; i--) {
      const ym = somarMeses(`${fimYm}-01`, -i).slice(0, 7);
      const ini = `${ym}-01`, fim = `${ym}-${dois(ultimoDia(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))))}`;
      const ref = fim < dia ? fim : dia;
      const ativos = fichas.filter((f) => ativoEm(f, ref));
      const comData = ativos.filter((f) => f.entrada);
      let receita = 0, comValor = 0;
      for (const f of ativos) {
        if (f.ct?.status === 'encerrado' || (f.ct?.inicio && f.ct.inicio > ref) || f.valor == null) continue;
        receita += f.valor; comValor++;
      }
      pontos.push({ mes: ym, rotulo: `${ym.slice(5, 7)}/${ym.slice(2, 4)}`, ref, agora: ym === mesHoje,
        ativos: ativos.length,
        novos: fichas.filter((f) => f.entrada && f.entrada >= ini && f.entrada <= ref).length,
        saidas: fichas.filter((f) => f.saida && f.saida >= ini && f.saida <= ref).length,
        ltvMedio: media1(comData.map((f) => mesesEntre(f.entrada, ref))),
        receita: reais2(receita), comValor,
        ticketMedio: comValor ? reais2(receita / comValor) : null });
    }
    while (pontos.length > minimo && !pontos[0].ativos && !pontos[0].novos && !pontos[0].saidas) pontos.shift();
    return { meses: pontos, semEntrada: fichas.filter((f) => !f.entrada).length };
  }

  // Contas por head: quantos clientes cada head (líder) tem, a nota média de saúde da carteira dele
  // e a receita mensal somada. `clientes` = calcular().clientes (nota e heads do cadastro); `base` e
  // `contratos` = os do servidor (valor mensal pelo id; contrato encerrado não soma). Cliente com
  // vários heads conta para cada um; sem head vai para "Sem head", por último. Ordem: mais contas primeiro.
  function contasPorHead({ clientes = [], base = [], contratos: lista = [] } = {}) {
    const contratoDe = new Map((lista || []).map((c) => [String(c.cliente_id), c]));
    const porId = new Map((base || []).filter((c) => c && c.id != null).map((c) => [String(c.id), c]));
    const grupos = new Map();
    for (const c of clientes || []) {
      if (!c) continue;
      for (const h of (c.heads && c.heads.length ? c.heads : [SEM_HEAD])) {
        if (!grupos.has(h)) grupos.set(h, []);
        grupos.get(h).push(c);
      }
    }
    return [...grupos].map(([head, deles]) => {
      const media = Math.round(deles.reduce((t, c) => t + c.score, 0) / deles.length);
      const risco = riscoDaNota(media);
      let receita = 0, comValor = 0;
      for (const c of deles) {
        const b = c.id ? porId.get(String(c.id)) : null, ct = b ? contratoDe.get(String(b.id)) || null : null;
        const v = b && ct?.status !== 'encerrado' ? valorDe(b, ct) : null;
        if (v != null) { receita += v; comValor++; }
      }
      return { head, semHead: head === SEM_HEAD, contas: deles.length, media, risco, nivel: RISCOS[risco].nivel,
        alto: deles.filter((c) => c.risco === 'alto').length,
        receita: comValor ? reais2(receita) : null, semValor: deles.length - comValor,
        clientes: [...deles].sort((a, b) => (a.score - b.score) || compararNomes(a.nome, b.nome))
          .map((c) => ({ id: c.id || '', nome: c.nome, score: c.score, risco: c.risco, nivel: c.nivel })) };
    }).sort((a, b) => (Number(a.semHead) - Number(b.semHead)) || (b.contas - a.contas) || compararNomes(a.head, b.head));
  }

  // Histórico mensal da nota: as médias guardadas no servidor (vybe_carteira_saude_mensal) com o mês
  // corrente trocado pela conta de agora. `anterior` = o último mês guardado antes do corrente.
  function historicoSaude({ meses = [], atual = null, hoje } = {}) {
    const mesAtual = `${diaDeHoje(hoje).slice(0, 7)}-01`;
    const serie = (meses || []).filter((m) => m && m.mes && m.mes !== mesAtual)
      .map((m) => ({ mes: m.mes, media: Number(m.media), alto: Number(m.alto ?? 0), clientes: Number(m.clientes ?? 0), agora: false }));
    if (atual && atual.media != null) serie.push({ mes: mesAtual, media: atual.media, alto: atual.alto, clientes: atual.total, agora: true });
    serie.sort((a, b) => a.mes.localeCompare(b.mes));
    const anterior = serie.filter((m) => m.mes < mesAtual).pop() || null;
    return { serie: serie.slice(-12), anterior,
      variacao: { media: variacao(atual?.media ?? null, anterior?.media ?? null, 'maior'), alto: variacao(atual?.alto ?? null, anterior?.alto ?? null, 'menor') } };
  }

  const api = Object.freeze({ calcular, churn, cohort, contratos, historicoSaude, serieMensal, contasPorHead, tempoDeCasa, periodo, variacao,
    REGRAS, RISCOS, SEM_HEAD, riscoDaNota, MOTIVOS_CHURN, TIPOS_CHURN, COLUNAS_COHORT, FONTES_ENTRADA, DIAS_MES,
    util: Object.freeze({ headsDe, chaveNome, somarMeses, nomeDoMes, entradaDe }) });
  raiz.VybeCarteiraSaude = api;
  if (raiz.window && typeof raiz.window === 'object' && raiz.window !== raiz) raiz.window.VybeCarteiraSaude = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
