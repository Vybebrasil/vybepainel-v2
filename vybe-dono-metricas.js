// vybe-dono-metricas.js — o motor de números da visão do dono.
//
// Paulo, 07/11/2026: os quatro donos (Paulo, Vinícius, Ewerton e Deivid) gerem a
// agência pelo Vybe OS. Este arquivo só faz contas: recebe as peças, o cadastro de
// clientes e, se houver, os planejamentos, e devolve os números da produção. Não lê
// DOM, não busca nada na rede e não lê os globais do painel: quem chama passa os
// dados (no painel, DADOS_ALL, CADASTRO_CLIENTES e TEAM_USERS). A única coisa que
// ele deixa no escopo global é VybeDono (window.VybeDono no navegador).
//
//   VybeDono.calcular({ demandas, clientes, planejamentos = null, pessoas = null,
//                       finalizado = null, hoje = new Date() })
//
// ── Definições ──────────────────────────────────────────────────────────────────
// A data do cliente manda; só clientes ativos do cadastro contam.
//
// Datas
// - "Dia" é o dia local de quem abre o painel (YYYY-MM-DD). `hoje` pode vir como Date
//   ou como texto YYYY-MM-DD. Datas sem hora (veiculacao_iso, prazo_iso) são
//   comparadas como texto, sem passar por fuso. Datas com hora (status_updated_at,
//   criado_em) viram o dia local.
// - Data da peça = veiculação (o dia em que o cliente publica). Sem veiculação, o
//   prazo. O prazo (prazo_iso) é a entrega interna da equipe e fica em segundo plano.
// - Semana = segunda a domingo.
//
// Clientes
// - Ativo = cadastro com `ativo` diferente de false, status sem "Inativo"/"Apagado" e
//   sem a marca "não é cliente" (a mesma leitura do Cérebro do cliente).
// - Uma peça entra quando pelo menos um dos clientes dela (clientes[] ou cliente) é
//   ativo, comparando o nome sem acento, caixa ou pontuação. Peça de vários clientes
//   conta uma vez nos totais da agência e uma vez em cada cliente ativo dela.
// - Se o cadastro ainda não carregou (lista vazia), contam os clientes das próprias
//   peças (menos "Sem cliente") e `fonte.clientes` avisa.
//
// Estados da peça
// - Entregue (pronta para a operação) = status Finalizado, Feito, Concluído, Aprovado
//   (solicitação), Para agendar, Agendado, Publicado ou Postado: o "Pronto" do radar
//   de risco (RISK_READY_STATUSES) e o `vybe_status.final` do banco. Os nomes de
//   solicitação passam pela mesma junção de operationalFlowStatus. Quem chama pode
//   trocar a regra por `finalizado(d)`. Para agendar e Agendado não viram
//   "publicado": as contagens por status saem separadas (feitasPorStatus,
//   entreguesPorStatus).
// - Dia da entrega = dia local de status_updated_at (a última troca de status) de uma
//   peça entregue. O painel não guarda outro dia de conclusão; se a peça trocar de
//   um status final para outro (Para agendar → Agendado), a entrega anda junto.
// - Aberta = não entregue. Pausada = "Segurar Post": aberta, mas não atrasa nem
//   corre risco.
// - Esquecida = aberta, não pausada, com a data mais nova (veiculação ou prazo)
//   vencida há mais de 30 dias. Fica fora de atrasadas, risco, gargalos e time e
//   aparece só como contagem (alerta de limpeza).
// - Atrasada = aberta, não pausada nem esquecida, com a veiculação vencida
//   ("furo": fura a data do cliente) ou com o prazo interno vencido. Furos vêm antes.
// - Janela de produção = aberta, não pausada nem esquecida, com veiculação ou prazo
//   até 7 dias à frente (o Prazo de Ouro) ou já vencido.
// - Sem andamento = status que não começou (A Fazer, Pode Fazer, Nova Demanda),
//   travado (Alteração, Falta Info, Falta D.A, Falta OFF, Aguardo, Aguardo Redação,
//   Ag. Interno), esperando o cliente (Ag. Aprovação Cliente, Ag. Info Cliente) ou
//   sem troca de status há 3 dias ou mais.
// - Em risco (de furo) = aberta, não pausada, não atrasada, com veiculação ou prazo
//   entre hoje e daqui a 2 dias, e operational_risk crítico/alto ou sem andamento.
// - Dias parada = dias desde status_updated_at (sem ela, desde criado_em).
//
// Hoje
// - previstas = peças com a data da peça hoje (qualquer status).
// - feitas = peças entregues com o dia da entrega hoje (qualquer data da peça).
// - previstasFeitas = previstas de hoje já entregues; faltam = previstas de hoje
//   abertas e não pausadas; pausadas = previstas de hoje em Segurar Post.
//   (previstas = previstasFeitas + faltam + pausadas.)
// - atrasadas e emRisco como acima; furos = atrasadas com a veiculação vencida.
// - paraAgendar = peças em "Para agendar" com veiculação hoje ou vencida (pronta e
//   ainda não agendada: o mesmo aviso das cobranças do Escritório).
//
// Semana
// - previstas = peças com a data da peça na semana; entregues = peças com o dia da
//   entrega na semana; porDia = os 7 dias, de segunda a domingo.
//
// Cobertura (meta de 3 posts por semana, Cérebro do cliente)
// - Conta os conteúdos (não as solicitações) de cada cliente ativo com a data da peça
//   na semana, em qualquer status. sem3 = abaixo de 3; semConteudo = nenhum.
// - Planejamento: com `planejamentos` (lista de GET /api/painel?area=planejamentos,
//   ou os postos de acao=operacao, ou o corpo da resposta), o cliente tem
//   planejamento quando há um não arquivado do mês atual ou de um mês seguinte. Sem
//   essa lista, vale o link `planejamento_url` do cadastro, que diz que existe um
//   documento, mas não de que mês. `fonte.planejamento` diz qual valeu.
//
// Clientes (saúde, do pior para o melhor)
// - abertas = não entregues e não esquecidas (as pausadas entram); semana e
//   proximaSemana = a mesma conta da cobertura.
// - crítico: veiculação vencida, 3 ou mais atrasadas, ou nenhum conteúdo nesta
//   semana nem na próxima.
// - atenção: alguma atrasada ou em risco, menos de 3 posts nesta semana ou na
//   próxima, ou sem planejamento.
// - ok: o resto. `motivos` diz o porquê em frases curtas.
//
// Gargalos
// - Peças na janela de produção agrupadas pelo status. Mediana dos dias parada e a
//   peça parada há mais tempo. Pior primeiro: mais peças-dia paradas (soma dos dias).
//
// Time
// - Cada peça conta para cada responsável (responsavel_ids). abertas = abertas não
//   pausadas nem esquecidas. atrasadas, emRisco e "paradas" deixam de fora o que
//   espera o cliente (a ação é do head). entregues7d = entregas nos últimos 7 dias,
//   com hoje. Dias parada = mediana na janela de produção. `cobrar` = frases curtas:
//   atrasadas, risco de furo, paradas há 3+ dias, sem briefing. Pior primeiro.
// - Nome: mapa `pessoas` ({id: nome}, lista [{id, name}] ou Map; no painel,
//   TEAM_USERS). Sem ele, o texto do campo Responsável da peça.
//
// Heads (a carteira de cada líder, do pior para o melhor)
// - Os heads vêm do cadastro do cliente (`heads`: lista ou texto "Nome A, Nome B"), a
//   mesma leitura de vybe-carteira-saude.js. Cliente com dois heads entra na carteira
//   de cada um; cliente sem head (ou cadastro sem carregar) entra em "Sem head".
// - contas = clientes ativos da carteira; saude = quantos crítico/atenção/ok (a saúde
//   de Clientes) e a pior. abertas, atrasadas e emRisco contam cada peça uma vez por
//   head, mesmo que ela tenha dois clientes da mesma carteira (abertas como em
//   Clientes; atrasadas e emRisco como em Hoje).
// - semana.previstas = peças com a data da peça nesta semana; semana.entregues = as
//   previstas da semana já entregues; semana.pct = entregues ÷ previstas (0 a 100, null
//   sem previstas). `lista` traz as peças contadas em atrasadas e emRisco.
// - Pior primeiro: pior saúde, mais furos, atrasadas e riscos. "Sem head" vai por último.
//
// Histórico (12 semanas, da mais antiga à atual)
// - entregues por semana do dia da entrega; noPrazo = entregue até a data da peça
//   (veiculação); atrasadasEntregues = depois dela. Sem data, não entra em nenhum dos
//   dois. medianaEntregues = mediana das semanas completas, a partir da primeira
//   semana com entrega (semanas vazias antes dela são falta de dado, não de
//   produção). mediaNoPrazoPct = no prazo ÷ (no prazo + atrasadas) nas 12 semanas.
//   tendencia = média das 4 últimas semanas completas contra as 4 anteriores
//   (±10%); com menos semanas, metade contra metade; com menos de 4, estável.
//
// Projeção
// - proximaSemana: previstas (data da peça na semana que vem, qualquer status),
//   capacidadeMediana = medianaEntregues, folga = capacidade − previstas, risco alto
//   acima de 110% da capacidade, médio acima de 90%. Sem histórico: médio se houver
//   peça prevista. proximas4 = as 4 semanas seguintes.
//
// Alertas (escala de urgência de docs/padrao-visual.md)
// - 1 crítico: veiculação vencida, pronta sem agendar com veiculação vencida, prazo
//   interno vencido. 2 alto: vai ao ar hoje e não está pronta, para agendar hoje,
//   risco de furo, cliente sem conteúdo na semana. 3 bloqueio: peças travadas,
//   o maior gargalo, próxima semana acima da capacidade. 4 espera: esperando o
//   cliente. 5 neutro: sem responsável, sem briefing, abaixo de 3 posts, sem
//   planejamento, esquecidas. 6 andando: tudo de hoje pronto, entregas subindo.
// - `ref` aponta o que o alerta cita: { tipo: 'pecas', ids }, { tipo: 'clientes',
//   nomes }, { tipo: 'status', status } ou { tipo: 'semana', inicio }.
//
// Desempenho: uma passada pelas peças e contas em mapas. Com 2.100 peças, cerca de
// 5 ms no Node (07/11/2026; dentro do vm do teste, uns 15 ms). O teste
// tests/dono-metricas.test.mjs cobra menos de 50 ms.

(function (raiz) {
  'use strict';

  const REGRAS = Object.freeze({
    metaPostsSemana: 3,
    riscoDias: 2,
    janelaProducaoDias: 7,
    esquecidaDias: 30,
    paradaDias: 3,
    semanasHistorico: 12,
    semanasProjecao: 4,
  });

  // ── Status ─────────────────────────────────────────────────────────────────────
  const cacheDeChaves = new Map();
  const chaveTexto = (valor) => {
    const s = String(valor ?? '');
    let k = cacheDeChaves.get(s);
    if (k === undefined) {
      k = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (cacheDeChaves.size < 5000) cacheDeChaves.set(s, k);
    }
    return k;
  };
  // A mesma junção dos nomes de solicitação de operationalFlowStatus (vybe-demandas.js).
  const SINONIMOS = new Map([
    ['nova demanda', 'a fazer'], ['em execucao', 'em andamento'], ['feito', 'finalizado'],
    ['aguardando info', 'falta info'], ['aguardando aprovacao', 'para aprovacao'], ['em aprovacao', 'para aprovacao'],
  ]);
  const ROTULOS = new Map([
    ['a fazer', 'A Fazer'], ['em andamento', 'Em andamento'], ['finalizado', 'Finalizado'],
    ['falta info', 'Falta Info'], ['para aprovacao', 'Para aprovação'],
  ]);
  const chaveStatus = (status) => { const k = chaveTexto(status); return SINONIMOS.get(k) || k; };
  const ENTREGUE = new Set(['finalizado', 'concluido', 'concluida', 'concluidas', 'aprovado', 'para agendar', 'agendado', 'publicado', 'postado']);
  const PAUSADA = new Set(['segurar post']);
  const NAO_COMECOU = new Set(['a fazer', 'pode fazer']);
  const TRAVADA = new Set(['alteracao', 'falta info', 'falta d a', 'falta off', 'aguardo', 'aguardo redacao', 'ag interno']);
  const ESPERA_CLIENTE = new Set(['ag aprovacao cliente', 'ag info cliente']);
  const RISCO_OPERACIONAL_ALTO = new Set(['critical', 'high']);

  // ── Datas ──────────────────────────────────────────────────────────────────────
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const dois = (n) => String(n).padStart(2, '0');
  const ehData = (x) => Boolean(x) && typeof x.getTime === 'function' && !Number.isNaN(x.getTime());
  const diaLocal = (data) => `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
  // Data sem hora fica como está; com hora, vira o dia local.
  const soData = (valor) => { const s = String(valor ?? '').slice(0, 10); return ISO.test(s) ? s : ''; };
  const diaDe = (valor) => {
    if (!valor) return '';
    if (ehData(valor)) return diaLocal(valor);
    const s = String(valor).trim();
    if (ISO.test(s)) return s;
    if (!/^\d{4}-\d{2}-\d{2}[T ]\d/.test(s)) return soData(s);
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    return ehData(d) ? diaLocal(d) : soData(s);
  };
  const emUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const somarDias = (iso, n) => new Date(emUtc(iso) + n * 864e5).toISOString().slice(0, 10);
  const diasEntre = (de, ate) => Math.round((emUtc(ate) - emUtc(de)) / 864e5);
  const inicioDaSemana = (iso) => somarDias(iso, -((new Date(emUtc(iso)).getUTCDay() + 6) % 7));

  // ── Números ────────────────────────────────────────────────────────────────────
  const mediana = (valores) => {
    const v = valores.filter(Number.isFinite).sort((a, b) => a - b);
    if (!v.length) return 0;
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  const mediaDe = (valores) => (valores.length ? valores.reduce((t, x) => t + x, 0) / valores.length : 0);
  const umaCasa = (x) => Math.round(x * 10) / 10;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const encurtar = (t, max = 42) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);
  const nomesDasPecas = (lista, max = 2) => lista.slice(0, max).map((p) => encurtar(p.nome)).join(', ') + (lista.length > max ? '…' : '');
  const nomesDosClientes = (lista, max = 3) => lista.slice(0, max).join(', ') + (lista.length > max ? '…' : '');
  const compararNomes = (a, b) => String(a).localeCompare(String(b), 'pt-BR');
  // Heads do cadastro: lista ou texto separado por vírgula (a mesma regra de vybe-carteira-saude.js).
  const SEM_HEAD = 'Sem head';
  const headsDe = (c) => {
    const lista = Array.isArray(c?.heads) ? c.heads : String(c?.heads || '').split(',');
    const nomes = [];
    for (const n of lista) { const s = String(n || '').trim(); if (s && !nomes.includes(s)) nomes.push(s); }
    return nomes;
  };

  // ── Entradas ───────────────────────────────────────────────────────────────────
  const ativoNoCadastro = (c) => Boolean(c) && c.ativo !== false && !c.nao_e_cliente
    && !/inativ|apagad/i.test(String(c.status || ''));
  // {id: nome}, [{id, name|nome}] ou Map.
  const mapaDePessoas = (entrada) => {
    const m = new Map();
    if (!entrada) return m;
    const nomeDe = (v) => String((v && typeof v === 'object' ? (v.name ?? v.nome) : v) ?? '').trim();
    if (typeof entrada.get === 'function' && typeof entrada.forEach === 'function') {
      entrada.forEach((v, k) => { if (nomeDe(v)) m.set(String(k), nomeDe(v)); });
    } else if (Array.isArray(entrada)) {
      for (const u of entrada) if (u && u.id != null && nomeDe(u)) m.set(String(u.id), nomeDe(u));
    } else if (typeof entrada === 'object') {
      for (const [k, v] of Object.entries(entrada)) if (nomeDe(v)) m.set(String(k), nomeDe(v));
    }
    return m;
  };
  // Responsáveis da peça, sem repetir; sem lista, o responsavel_id.
  const idsDe = (d) => {
    const lista = Array.isArray(d.responsavel_ids) && d.responsavel_ids.length ? d.responsavel_ids : [d.responsavel_id];
    const ids = [];
    for (const x of lista) { if (x == null || x === '') continue; const s = String(x); if (!ids.includes(s)) ids.push(s); }
    return ids;
  };
  // Planos de GET area=planejamentos, postos de acao=operacao ou o corpo da resposta.
  const listaDePlanos = (entrada) => {
    if (!entrada) return null;
    let lista = entrada;
    if (!Array.isArray(lista)) {
      if (entrada.disponivel === false) return null;
      lista = Array.isArray(entrada.planejamentos) ? entrada.planejamentos : Array.isArray(entrada.postos) ? entrada.postos : null;
      if (!lista) return null;
    }
    const planos = [];
    for (const x of lista) {
      if (!x || typeof x !== 'object') continue;
      if ('planejamento' in x) {
        if (x.planejamento) planos.push({ ...x.planejamento, cliente_id: x.planejamento.cliente_id ?? x.cliente_id, cliente: x.planejamento.cliente ?? x.cliente });
      } else planos.push(x);
    }
    return planos;
  };

  function calcular(entrada) {
    const {
      demandas = [], clientes = [], planejamentos = null, pessoas = null, finalizado = null, hoje = new Date(), graficoSemana = {},
    } = entrada || {};
    const R = REGRAS;
    const agora = ehData(hoje) ? hoje : new Date();
    const dia = typeof hoje === 'string' && ISO.test(hoje.slice(0, 10)) ? hoje.slice(0, 10) : diaLocal(agora);

    const limiteRisco = somarDias(dia, R.riscoDias);
    const fimDaJanela = somarDias(dia, R.janelaProducaoDias);
    const limiteEsquecida = somarDias(dia, -R.esquecidaDias);
    const seteDiasAtras = somarDias(dia, -6);
    const inicioSem = inicioDaSemana(dia), fimSem = somarDias(inicioSem, 6);
    const inicioProx = somarDias(inicioSem, 7), fimProx = somarDias(inicioSem, 13);
    const semanasHist = Array.from({ length: R.semanasHistorico }, (_, i) => somarDias(inicioSem, -7 * (R.semanasHistorico - 1 - i)));
    const semanasFuturas = Array.from({ length: R.semanasProjecao }, (_, i) => somarDias(inicioSem, 7 * (i + 1)));
    const primeiroDiaContado = semanasHist[0], ultimoDiaContado = somarDias(semanasFuturas[semanasFuturas.length - 1], 6);
    const contaSemana = new Map([...semanasHist, ...semanasFuturas].map((s) => [s, { previstas: 0, abertas: 0, entregues: 0, noPrazo: 0, atrasadasEntregues: 0 }]));
    const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(inicioSem, i));
    const contaDia = new Map(diasDaSemana.map((d) => [d, { previstas: 0, entregues: 0 }]));
    // O recorte do gráfico não muda o hoje real, os alertas ou a cobertura da agência.
    const campoGrafico = graficoSemana?.campo === 'prazo' ? 'prazo' : 'veiculacao';
    const inicioGrafico = inicioDaSemana(soData(graficoSemana?.referencia) || dia);
    const diasGrafico = Array.from({ length: 7 }, (_, i) => somarDias(inicioGrafico, i));
    const contaGrafico = new Map(diasGrafico.map((d) => [d, { previstas: 0, entregues: 0 }]));
    const cacheSemana = new Map();
    const semanaDe = (iso) => { let s = cacheSemana.get(iso); if (!s) { s = inicioDaSemana(iso); cacheSemana.set(iso, s); } return s; };
    // Dias parada: poucos dias distintos para milhares de peças.
    const utcHoje = emUtc(dia), cacheUtc = new Map();
    const diasAteHoje = (iso) => { let u = cacheUtc.get(iso); if (u === undefined) { u = emUtc(iso); cacheUtc.set(iso, u); } return Math.round((utcHoje - u) / 864e5); };

    // ── Clientes ativos ──────────────────────────────────────────────────────────
    const cadastro = (Array.isArray(clientes) ? clientes : []).filter((c) => c && String(c.nome || '').trim());
    const cadastroCarregado = cadastro.length > 0;
    const nomePorChave = new Map();
    const porCliente = new Map();
    const novoCliente = (nome, cad) => ({ cliente: nome, cad, abertas: 0, atrasadas: 0, furos: 0, emRisco: 0, esquecidas: 0, semana: 0, proximaSemana: 0, pecasAtrasadas: [], pecasEmRisco: [] });
    for (const c of cadastro) {
      if (!ativoNoCadastro(c)) continue;
      const nome = String(c.nome).trim(), k = chaveTexto(nome);
      if (!k || nomePorChave.has(k)) continue;
      nomePorChave.set(k, nome);
      porCliente.set(nome, novoCliente(nome, c));
    }
    const clienteAtivo = (nome) => {
      const k = chaveTexto(nome);
      if (!k || k === 'sem cliente') return null;
      if (cadastroCarregado) return nomePorChave.get(k) || null;
      if (!nomePorChave.has(k)) {
        const n = String(nome).trim();
        nomePorChave.set(k, n);
        porCliente.set(n, novoCliente(n, null));
      }
      return nomePorChave.get(k);
    };

    // ── Pessoas ──────────────────────────────────────────────────────────────────
    const mapaPessoas = mapaDePessoas(pessoas);
    const nomesResolvidos = new Map();
    const nomeDoResponsavel = (id, d, i, ids) => {
      if (nomesResolvidos.has(id)) return nomesResolvidos.get(id);
      let nome = mapaPessoas.get(id) || '';
      if (!nome) {
        const partes = String(d.responsavel || '').split(',').map((x) => x.trim()).filter(Boolean);
        if (partes.length === ids.length) nome = partes[i];
      }
      if (!nome) return `Pessoa ${id}`;
      nomesResolvidos.set(id, nome);
      return nome;
    };

    // ── Peças: uma passada ───────────────────────────────────────────────────────
    const ehEntregue = typeof finalizado === 'function'
      ? (d) => Boolean(finalizado(d))
      : (d) => ENTREGUE.has(chaveStatus(d.status));
    const pecas = [];
    const vistos = new Set();
    let lidas = 0, repetidas = 0, semClienteAtivo = 0, entreguesSemDia = 0;
    for (const d of Array.isArray(demandas) ? demandas : []) {
      if (!d || typeof d !== 'object') continue;
      lidas++;
      const id = d.id == null ? '' : String(d.id);
      if (id) { if (vistos.has(id)) { repetidas++; continue; } vistos.add(id); }
      const nomes = Array.isArray(d.clientes) && d.clientes.length ? d.clientes : [d.cliente];
      const deles = [];
      for (const n of nomes) { const c = clienteAtivo(n); if (c && !deles.includes(c)) deles.push(c); }
      if (!deles.length) { semClienteAtivo++; continue; }
      const chave = chaveStatus(d.status);
      const veic = soData(d.veiculacao_iso), prazo = soData(d.prazo_iso);
      const diaStatus = diaDe(d.status_updated_at);
      const desde = diaStatus || diaDe(d.criado_em);
      const p = {
        d, id, nome: String(d.nome ?? d.name ?? '').trim() || 'Sem título', clientes: deles,
        status: String(d.status ?? '').trim(), chave, entregue: ehEntregue(d),
        veic, prazo, data: veic || prazo, dataMin: !veic ? prazo : !prazo ? veic : (veic < prazo ? veic : prazo),
        diaStatus, idade: desde ? Math.max(0, diasAteHoje(desde)) : null,
        ids: idsDe(d),
        conteudo: d.origem !== 'solicitacao',
        pausada: false, esquecida: false, furo: false, prazoVencido: false, atrasada: false,
        naJanela: false, esperaCliente: false, semAndamento: false, emRisco: false,
      };
      if (p.entregue && !diaStatus) entreguesSemDia++;
      if (!p.entregue) {
        p.pausada = PAUSADA.has(chave);
        const maisNova = veic > prazo ? veic : prazo;
        p.esquecida = !p.pausada && Boolean(maisNova) && maisNova < limiteEsquecida;
        const viva = !p.pausada && !p.esquecida;
        p.furo = viva && Boolean(veic) && veic < dia;
        p.prazoVencido = viva && Boolean(prazo) && prazo < dia;
        p.atrasada = p.furo || p.prazoVencido;
        p.naJanela = viva && Boolean(p.dataMin) && p.dataMin <= fimDaJanela;
        p.esperaCliente = ESPERA_CLIENTE.has(chave);
        p.semAndamento = NAO_COMECOU.has(chave) || TRAVADA.has(chave) || p.esperaCliente || (p.idade != null && p.idade >= R.paradaDias);
        const perto = (x) => Boolean(x) && x >= dia && x <= limiteRisco;
        p.emRisco = viva && !p.atrasada && (perto(veic) || perto(prazo))
          && (RISCO_OPERACIONAL_ALTO.has(String(d.operational_risk?.level || '')) || p.semAndamento);
      }
      pecas.push(p);
    }

    const responsavelDe = (p) => (p.ids.length
      ? p.ids.map((pid, i) => nomeDoResponsavel(pid, p.d, i, p.ids)).join(', ')
      : String(p.d.responsavel || '').trim());
    const peca = (p) => ({ id: p.id, nome: p.nome, cliente: p.clientes[0], status: p.status, veiculacao_iso: p.veic, prazo_iso: p.prazo, responsavel: responsavelDe(p) });
    const rotuloDe = (p) => ROTULOS.get(p.chave) || p.status || 'Sem status';
    const porData = (a, b) => (a.dataMin < b.dataMin ? -1 : a.dataMin > b.dataMin ? 1 : a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0);
    const porAtraso = (a, b) => (Number(b.furo) - Number(a.furo)) || porData(a, b);

    // ── Contas ───────────────────────────────────────────────────────────────────
    const previstasHoje = [], feitasHoje = [], atrasadas = [], emRisco = [], esquecidas = [];
    const paraAgendarHoje = [], paraAgendarVencidas = [], travadas = [], esperando = [], semResponsavel = [], semBriefing = [];
    let previstasEntreguesSemana = 0;
    const entreguesPorStatusSemana = new Map();
    const gargalos = new Map();
    const porPessoa = new Map();
    const fichaDaPessoa = (pid, p, i) => {
      let t = porPessoa.get(pid);
      if (!t) {
        t = { pessoaId: pid, pessoa: '', abertas: 0, entregues7d: 0, atrasadas: [], emRisco: [], paradas: [], semBriefing: [], idades: [] };
        porPessoa.set(pid, t);
      }
      if (!t.pessoa || t.pessoa.startsWith('Pessoa ')) t.pessoa = nomeDoResponsavel(pid, p.d, i, p.ids);
      return t;
    };

    for (const p of pecas) {
      // Agência
      if (p.data === dia) previstasHoje.push(p);
      if (p.entregue && p.diaStatus === dia) feitasHoje.push(p);
      if (p.atrasada) atrasadas.push(p);
      if (p.emRisco) emRisco.push(p);
      if (p.esquecida) esquecidas.push(p);
      if (p.chave === 'para agendar' && p.veic) {
        if (p.veic === dia) paraAgendarHoje.push(p);
        else if (p.veic < dia && p.veic >= limiteEsquecida) paraAgendarVencidas.push(p);
      }
      if (p.naJanela) {
        if (TRAVADA.has(p.chave)) travadas.push(p);
        if (p.esperaCliente) esperando.push(p);
        if (!p.ids.length) semResponsavel.push(p);
        if (p.d.tem_briefing === false) semBriefing.push(p);
        let g = gargalos.get(p.chave);
        if (!g) { g = { status: rotuloDe(p), qtd: 0, idades: [], maisAntiga: null, pecas: [] }; gargalos.set(p.chave, g); }
        g.qtd++;
        g.pecas.push(p);
        if (p.idade != null) {
          g.idades.push(p.idade);
          if (!g.maisAntiga || p.idade > g.maisAntiga.idade || (p.idade === g.maisAntiga.idade && porData(p, g.maisAntiga) < 0)) g.maisAntiga = p;
        }
      }
      // Semanas e dias
      const previstoGrafico = contaGrafico.get(campoGrafico === 'prazo' ? p.prazo : p.veic);
      if (previstoGrafico) previstoGrafico.previstas++;
      const entregueGrafico = p.entregue && contaGrafico.get(p.diaStatus);
      if (entregueGrafico) entregueGrafico.entregues++;
      if (p.data && p.data >= primeiroDiaContado && p.data <= ultimoDiaContado) {
        const s = contaSemana.get(semanaDe(p.data));
        if (s) { s.previstas++; if (!p.entregue) s.abertas++; }
        const c = contaDia.get(p.data);
        if (c) { c.previstas++; if (p.entregue) previstasEntreguesSemana++; }
      }
      if (p.entregue && p.diaStatus && p.diaStatus >= primeiroDiaContado && p.diaStatus <= ultimoDiaContado) {
        const s = contaSemana.get(semanaDe(p.diaStatus));
        if (s) {
          s.entregues++;
          if (p.data) { if (p.diaStatus <= p.data) s.noPrazo++; else s.atrasadasEntregues++; }
        }
        const c = contaDia.get(p.diaStatus);
        if (c) { c.entregues++; const r = rotuloDe(p); entreguesPorStatusSemana.set(r, (entreguesPorStatusSemana.get(r) || 0) + 1); }
      }
      // Clientes
      for (const nome of p.clientes) {
        const st = porCliente.get(nome);
        if (!st) continue;
        if (p.esquecida) st.esquecidas++;
        else if (!p.entregue) st.abertas++;
        if (p.atrasada) { st.atrasadas++; st.pecasAtrasadas.push(p); if (p.furo) st.furos++; }
        if (p.emRisco) { st.emRisco++; st.pecasEmRisco.push(p); }
        if (p.conteudo && p.data) {
          if (p.data >= inicioSem && p.data <= fimSem) st.semana++;
          else if (p.data >= inicioProx && p.data <= fimProx) st.proximaSemana++;
        }
      }
      // Time
      p.ids.forEach((pid, i) => {
        const t = fichaDaPessoa(pid, p, i);
        if (p.entregue) { if (p.diaStatus && p.diaStatus >= seteDiasAtras && p.diaStatus <= dia) t.entregues7d++; return; }
        if (p.esquecida || p.pausada) return;
        t.abertas++;
        if (p.esperaCliente) return;
        if (p.atrasada) t.atrasadas.push(p);
        else if (p.emRisco) t.emRisco.push(p);
        else if (p.naJanela && p.idade != null && p.idade >= R.paradaDias) t.paradas.push(p);
        if (p.naJanela) {
          if (p.idade != null) t.idades.push(p.idade);
          if (p.d.tem_briefing === false) t.semBriefing.push(p);
        }
      });
    }

    // ── Hoje ─────────────────────────────────────────────────────────────────────
    atrasadas.sort(porAtraso);
    emRisco.sort(porData);
    const faltam = previstasHoje.filter((p) => !p.entregue && !p.pausada)
      .sort((a, b) => (Number(b.semAndamento) - Number(a.semAndamento)) || porData(a, b));
    const contarPorStatus = (lista) => {
      const m = {};
      for (const p of lista) { const r = rotuloDe(p); m[r] = (m[r] || 0) + 1; }
      return m;
    };
    const furos = atrasadas.filter((p) => p.furo), soPrazoInterno = atrasadas.filter((p) => !p.furo);
    const blocoHoje = {
      dia,
      previstas: previstasHoje.length,
      feitas: feitasHoje.length,
      faltam: faltam.length,
      atrasadas: atrasadas.length,
      emRisco: emRisco.length,
      previstasFeitas: previstasHoje.filter((p) => p.entregue).length,
      pausadas: previstasHoje.filter((p) => !p.entregue && p.pausada).length,
      furos: furos.length,
      prazoInternoVencido: soPrazoInterno.length,
      esquecidas: esquecidas.length,
      paraAgendar: { hoje: paraAgendarHoje.length, vencidas: paraAgendarVencidas.length },
      feitasPorStatus: contarPorStatus(feitasHoje),
      lista: { faltam: faltam.map(peca), emRisco: emRisco.map(peca), atrasadas: atrasadas.map(peca) },
    };

    // ── Semana ───────────────────────────────────────────────────────────────────
    const estaSemana = contaSemana.get(inicioSem);
    const blocoSemana = {
      inicio: inicioSem, fim: fimSem,
      previstas: estaSemana.previstas, entregues: estaSemana.entregues,
      previstasEntregues: previstasEntreguesSemana,
      entreguesPorStatus: Object.fromEntries(entreguesPorStatusSemana),
      porDia: diasDaSemana.map((d) => ({ dia: d, ...contaDia.get(d) })),
    };

    // ── Planejamento ─────────────────────────────────────────────────────────────
    const planos = listaDePlanos(planejamentos);
    const mesAtual = dia.slice(0, 7);
    const planoDoCliente = new Map();
    if (planos) {
      const nomePorId = new Map();
      for (const st of porCliente.values()) if (st.cad?.id != null) nomePorId.set(String(st.cad.id), st.cliente);
      for (const pl of planos) {
        if (String(pl.estado || '') === 'arquivado') continue;
        const mes = String(pl.mes || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(mes) || mes < mesAtual) continue;
        const nome = (pl.cliente_id != null && nomePorId.get(String(pl.cliente_id))) || nomePorChave.get(chaveTexto(pl.cliente));
        if (!nome || !porCliente.has(nome)) continue;
        const atual = planoDoCliente.get(nome);
        if (!atual || mes < atual.mes) planoDoCliente.set(nome, { mes, estado: String(pl.estado || '') });
      }
    }
    const sabePlanejamento = Boolean(planos) || cadastroCarregado;
    const temPlanejamentoDe = (st) => {
      if (planos) return planoDoCliente.has(st.cliente);
      if (!sabePlanejamento) return null;
      return Boolean(String(st.cad?.planejamento_url || '').trim());
    };

    // ── Clientes ─────────────────────────────────────────────────────────────────
    const META = R.metaPostsSemana;
    const ORDEM_SAUDE = { critico: 0, atencao: 1, ok: 2 };
    const listaClientes = [...porCliente.values()].map((st) => {
      const temPlanejamento = temPlanejamentoDe(st);
      const motivos = [];
      if (st.furos) motivos.push(`${plural(st.furos, 'peça', 'peças')} com a veiculação vencida`);
      if (st.atrasadas - st.furos) motivos.push(`${plural(st.atrasadas - st.furos, 'peça', 'peças')} com o prazo interno vencido`);
      if (st.emRisco) motivos.push(`${plural(st.emRisco, 'peça', 'peças')} com risco de furo`);
      if (!st.semana) motivos.push('sem conteúdo nesta semana');
      else if (st.semana < META) motivos.push(`${st.semana}/${META} posts nesta semana`);
      if (st.proximaSemana < META) motivos.push(`próxima semana ${st.proximaSemana}/${META}`);
      if (temPlanejamento === false) motivos.push('sem planejamento');
      if (st.esquecidas) motivos.push(`${plural(st.esquecidas, 'aberta esquecida', 'abertas esquecidas')} (data de mais de ${R.esquecidaDias} dias)`);
      const critico = st.furos > 0 || st.atrasadas >= 3 || (!st.semana && !st.proximaSemana);
      const atencao = st.atrasadas > 0 || st.emRisco > 0 || st.semana < META || st.proximaSemana < META || temPlanejamento === false;
      const gravidade = st.furos * 100 + st.atrasadas * 20 + st.emRisco * 8 + Math.max(0, META - st.semana) * 5
        + Math.max(0, META - st.proximaSemana) * 2 + (temPlanejamento === false ? 3 : 0);
      return {
        cliente: st.cliente, abertas: st.abertas, atrasadas: st.atrasadas, furos: st.furos, emRisco: st.emRisco,
        semana: st.semana, proximaSemana: st.proximaSemana, esquecidas: st.esquecidas,
        temPlanejamento, planejamento: planoDoCliente.get(st.cliente) || null,
        saude: critico ? 'critico' : atencao ? 'atencao' : 'ok', motivos, gravidade,
        // As peças por trás dos números (o mini painel do número lista exatamente o que foi contado).
        lista: { atrasadas: st.pecasAtrasadas.sort(porAtraso).map(peca), emRisco: st.pecasEmRisco.sort(porData).map(peca) },
        pendencias: pecas.filter((p) => p.clientes.includes(st.cliente) && (p.atrasada || p.emRisco || p.esquecida))
          .sort(porAtraso).map((p) => ({ ...peca(p), cliente: st.cliente, motivos: [
            p.furo && 'Veiculação vencida', p.prazoVencido && 'Prazo interno vencido',
            p.emRisco && 'Risco de furo', p.esquecida && 'Aberta esquecida',
          ].filter(Boolean) })),
      };
    }).sort((a, b) => (ORDEM_SAUDE[a.saude] - ORDEM_SAUDE[b.saude]) || (b.gravidade - a.gravidade) || compararNomes(a.cliente, b.cliente));
    for (const c of listaClientes) delete c.gravidade;

    // ── Cobertura ────────────────────────────────────────────────────────────────
    const porQtd = (a, b) => (a.qtd - b.qtd) || compararNomes(a.cliente, b.cliente);
    const cobertura = {
      meta: META,
      clientesAtivos: listaClientes.length,
      sem3: listaClientes.filter((c) => c.semana < META).map((c) => ({ cliente: c.cliente, qtd: c.semana })).sort(porQtd),
      semConteudo: listaClientes.filter((c) => !c.semana).map((c) => c.cliente).sort(compararNomes),
      semPlanejamento: listaClientes.filter((c) => c.temPlanejamento === false).map((c) => c.cliente).sort(compararNomes),
      proximaSemanaSem3: listaClientes.filter((c) => c.proximaSemana < META).map((c) => ({ cliente: c.cliente, qtd: c.proximaSemana })).sort(porQtd),
    };

    // ── Gargalos ─────────────────────────────────────────────────────────────────
    const listaGargalos = [...gargalos.values()].map((g) => ({
      status: g.status, qtd: g.qtd, idadeMedianaDias: umaCasa(mediana(g.idades)),
      pecasDia: g.idades.reduce((t, x) => t + x, 0),
      maisAntiga: g.maisAntiga ? peca(g.maisAntiga) : null,
      maisAntigaDias: g.maisAntiga ? g.maisAntiga.idade : null,
      lista: g.pecas.sort((a, b) => (b.idade || 0) - (a.idade || 0) || porData(a, b)).map(peca),
    })).sort((a, b) => (b.pecasDia - a.pecasDia) || (b.qtd - a.qtd) || compararNomes(a.status, b.status));

    // ── Time ─────────────────────────────────────────────────────────────────────
    const listaTime = [...porPessoa.values()].filter((t) => t.abertas || t.entregues7d).map((t) => {
      t.atrasadas.sort(porAtraso); t.emRisco.sort(porData); t.paradas.sort((a, b) => (b.idade - a.idade) || porData(a, b));
      const cobrar = [];
      if (t.atrasadas.length) cobrar.push(`${plural(t.atrasadas.length, 'peça atrasada', 'peças atrasadas')}: ${nomesDasPecas(t.atrasadas)}`);
      if (t.emRisco.length) cobrar.push(`${plural(t.emRisco.length, 'peça', 'peças')} com risco de furo: ${nomesDasPecas(t.emRisco)}`);
      if (t.paradas.length) cobrar.push(`${plural(t.paradas.length, 'peça parada', 'peças paradas')} há ${R.paradaDias}+ dias: ${nomesDasPecas(t.paradas)}`);
      if (t.semBriefing.length) cobrar.push(`${t.semBriefing.length} sem briefing`);
      return {
        pessoaId: t.pessoaId, pessoa: t.pessoa, abertas: t.abertas, atrasadas: t.atrasadas.length, emRisco: t.emRisco.length,
        paradas: t.paradas.length, semBriefing: t.semBriefing.length, entregues7d: t.entregues7d,
        idadeMedianaDias: umaCasa(mediana(t.idades)), cobrar,
        lista: { atrasadas: t.atrasadas.map(peca), emRisco: t.emRisco.map(peca), paradas: t.paradas.map(peca) },
        _peso: t.atrasadas.length * 10 + t.emRisco.length * 5 + t.paradas.length * 2 + t.semBriefing.length,
      };
    }).sort((a, b) => (b._peso - a._peso) || (b.abertas - a.abertas) || compararNomes(a.pessoa, b.pessoa));
    for (const t of listaTime) delete t._peso;

    // ── Heads ────────────────────────────────────────────────────────────────────
    const saudePorCliente = new Map(listaClientes.map((c) => [c.cliente, c.saude]));
    const porHead = new Map();
    const headsDoCliente = new Map();
    for (const st of porCliente.values()) {
      const hs = headsDe(st.cad);
      const lista = hs.length ? hs : [SEM_HEAD];
      headsDoCliente.set(st.cliente, lista);
      for (const h of lista) {
        let x = porHead.get(h);
        if (!x) { x = { head: h, contas: [], abertas: 0, atrasadas: [], emRisco: [], previstas: 0, entregues: 0 }; porHead.set(h, x); }
        x.contas.push(st.cliente);
      }
    }
    for (const p of pecas) {
      const hs = new Set();
      for (const nome of p.clientes) for (const h of headsDoCliente.get(nome) || []) hs.add(h);
      for (const h of hs) {
        const x = porHead.get(h);
        if (!x) continue;
        if (!p.entregue && !p.esquecida) x.abertas++;
        if (p.atrasada) x.atrasadas.push(p);
        if (p.emRisco) x.emRisco.push(p);
        if (p.data && p.data >= inicioSem && p.data <= fimSem) { x.previstas++; if (p.entregue) x.entregues++; }
      }
    }
    const NOMES_SAUDE = ['critico', 'atencao', 'ok'];
    const listaHeads = [...porHead.values()].map((x) => {
      const saude = { critico: 0, atencao: 0, ok: 0, pior: 'ok' };
      for (const c of x.contas) saude[saudePorCliente.get(c) || 'ok']++;
      saude.pior = NOMES_SAUDE.find((k) => saude[k] > 0) || 'ok';
      x.atrasadas.sort(porAtraso); x.emRisco.sort(porData);
      const furosHead = x.atrasadas.filter((p) => p.furo).length;
      return {
        head: x.head, semHead: x.head === SEM_HEAD,
        contas: x.contas.length,
        clientes: [...x.contas].sort((a, b) => (ORDEM_SAUDE[saudePorCliente.get(a)] - ORDEM_SAUDE[saudePorCliente.get(b)]) || compararNomes(a, b)),
        saude,
        abertas: x.abertas, atrasadas: x.atrasadas.length, furos: furosHead, emRisco: x.emRisco.length,
        semana: { previstas: x.previstas, entregues: x.entregues, pct: x.previstas ? Math.round((x.entregues / x.previstas) * 100) : null },
        lista: { atrasadas: x.atrasadas.map(peca), emRisco: x.emRisco.map(peca) },
        _peso: saude.critico * 1000 + furosHead * 100 + x.atrasadas.length * 20 + x.emRisco.length * 8 + saude.atencao * 5,
      };
    }).sort((a, b) => (Number(a.semHead) - Number(b.semHead)) || (ORDEM_SAUDE[a.saude.pior] - ORDEM_SAUDE[b.saude.pior])
      || (b._peso - a._peso) || compararNomes(a.head, b.head));
    for (const h of listaHeads) delete h._peso;

    // ── Histórico ────────────────────────────────────────────────────────────────
    const semanas = semanasHist.map((s) => {
      const c = contaSemana.get(s);
      return { inicio: s, previstas: c.previstas, entregues: c.entregues, noPrazo: c.noPrazo, atrasadasEntregues: c.atrasadasEntregues };
    });
    const completas = semanas.slice(0, -1);
    const primeiraComEntrega = completas.findIndex((s) => s.entregues > 0);
    const serie = primeiraComEntrega < 0 ? [] : completas.slice(primeiraComEntrega).map((s) => s.entregues);
    const medianaEntregues = umaCasa(mediana(serie));
    let tendencia = 'estavel', mediaRecente = 0;
    if (serie.length >= 4) {
      const n = Math.min(4, Math.floor(serie.length / 2));
      mediaRecente = mediaDe(serie.slice(-n));
      const anterior = mediaDe(serie.slice(-2 * n, -n));
      const variacao = anterior ? (mediaRecente - anterior) / anterior : (mediaRecente > 0 ? 1 : 0);
      tendencia = variacao > 0.1 ? 'subindo' : variacao < -0.1 ? 'caindo' : 'estavel';
    }
    const noPrazo = semanas.reduce((t, s) => t + s.noPrazo, 0), foraDoPrazo = semanas.reduce((t, s) => t + s.atrasadasEntregues, 0);
    const historico = {
      semanas, medianaEntregues,
      mediaNoPrazoPct: noPrazo + foraDoPrazo ? umaCasa((noPrazo / (noPrazo + foraDoPrazo)) * 100) : null,
      tendencia,
    };

    // ── Projeção ─────────────────────────────────────────────────────────────────
    const proxima = contaSemana.get(inicioProx);
    const capacidade = medianaEntregues;
    const projecao = {
      proximaSemana: {
        inicio: inicioProx, previstas: proxima.previstas, abertas: proxima.abertas, capacidadeMediana: capacidade,
        folga: umaCasa(capacidade - proxima.previstas),
        risco: capacidade <= 0 ? (proxima.previstas > 0 ? 'medio' : 'baixo')
          : proxima.previstas > capacidade * 1.1 ? 'alto' : proxima.previstas > capacidade * 0.9 ? 'medio' : 'baixo',
      },
      proximas4: semanasFuturas.map((s) => ({ inicio: s, previstas: contaSemana.get(s).previstas, abertas: contaSemana.get(s).abertas })),
    };

    // ── Alertas ──────────────────────────────────────────────────────────────────
    const alertas = [];
    const refPecas = (lista) => ({ tipo: 'pecas', ids: lista.map((p) => p.id) });
    const alertaDePecas = (nivel, lista, frase) => { if (lista.length) alertas.push({ nivel, texto: `${frase}: ${nomesDasPecas(lista)}`, ref: refPecas(lista) }); };
    alertaDePecas(1, furos, `${plural(furos.length, 'peça furando', 'peças furando')} a data do cliente (veiculação vencida)`);
    alertaDePecas(1, paraAgendarVencidas.sort(porData), `${plural(paraAgendarVencidas.length, 'peça pronta', 'peças prontas')} sem agendar com a veiculação vencida`);
    alertaDePecas(1, soPrazoInterno, `${plural(soPrazoInterno.length, 'peça', 'peças')} com o prazo interno vencido`);
    alertaDePecas(2, faltam, `${plural(faltam.length, 'peça vai', 'peças vão')} ao ar hoje sem estar ${faltam.length === 1 ? 'pronta' : 'prontas'}`);
    alertaDePecas(2, paraAgendarHoje.sort(porData), `${plural(paraAgendarHoje.length, 'peça', 'peças')} para agendar com veiculação hoje`);
    alertaDePecas(2, emRisco, `${plural(emRisco.length, 'peça', 'peças')} com risco de furo nos próximos ${R.riscoDias} dias`);
    if (cobertura.semConteudo.length) alertas.push({ nivel: 2, texto: `${plural(cobertura.semConteudo.length, 'cliente', 'clientes')} sem nenhum conteúdo nesta semana: ${nomesDosClientes(cobertura.semConteudo)}`, ref: { tipo: 'clientes', nomes: cobertura.semConteudo } });
    if (travadas.length) {
      const partes = Object.entries(contarPorStatus(travadas)).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · ');
      alertas.push({ nivel: 3, texto: `${plural(travadas.length, 'peça travada', 'peças travadas')} na janela de produção (${partes})`, ref: refPecas(travadas) });
    }
    const pior = listaGargalos[0];
    if (pior && pior.qtd >= 3 && pior.idadeMedianaDias >= 2) alertas.push({ nivel: 3, texto: `Gargalo: ${pior.qtd} peças em ${pior.status}, paradas há ${pior.idadeMedianaDias} dias (mediana)`, ref: { tipo: 'status', status: pior.status } });
    if (projecao.proximaSemana.risco === 'alto') alertas.push({ nivel: 3, texto: `Próxima semana: ${proxima.previstas} peças previstas para uma capacidade de ${capacidade} por semana`, ref: { tipo: 'semana', inicio: inicioProx } });
    alertaDePecas(4, esperando.sort(porData), `${plural(esperando.length, 'peça esperando', 'peças esperando')} o cliente (aprovação ou informação)`);
    alertaDePecas(5, semResponsavel.sort(porData), `${plural(semResponsavel.length, 'peça', 'peças')} sem responsável na janela de produção`);
    alertaDePecas(5, semBriefing.sort(porData), `${plural(semBriefing.length, 'peça', 'peças')} sem briefing na janela de produção`);
    const abaixo = cobertura.sem3.filter((x) => x.qtd > 0).map((x) => x.cliente);
    if (abaixo.length) alertas.push({ nivel: 5, texto: `${plural(abaixo.length, 'cliente', 'clientes')} abaixo de ${META} posts nesta semana: ${nomesDosClientes(abaixo)}`, ref: { tipo: 'clientes', nomes: abaixo } });
    const proxAbaixo = cobertura.proximaSemanaSem3.map((x) => x.cliente);
    if (proxAbaixo.length) alertas.push({ nivel: 5, texto: `${plural(proxAbaixo.length, 'cliente', 'clientes')} abaixo de ${META} posts na próxima semana: ${nomesDosClientes(proxAbaixo)}`, ref: { tipo: 'clientes', nomes: proxAbaixo } });
    if (cobertura.semPlanejamento.length) alertas.push({ nivel: 5, texto: `${plural(cobertura.semPlanejamento.length, 'cliente', 'clientes')} sem planejamento: ${nomesDosClientes(cobertura.semPlanejamento)}`, ref: { tipo: 'clientes', nomes: cobertura.semPlanejamento } });
    if (esquecidas.length) alertas.push({ nivel: 5, texto: `${plural(esquecidas.length, 'peça aberta', 'peças abertas')} com data de mais de ${R.esquecidaDias} dias: finalizar, reprogramar ou apagar`, ref: refPecas(esquecidas) });
    if (previstasHoje.length && !faltam.length) alertas.push({ nivel: 6, texto: `Tudo o que vai ao ar hoje está pronto (${plural(previstasHoje.length, 'peça', 'peças')})` });
    if (tendencia === 'subindo') alertas.push({ nivel: 6, texto: `Entregas subindo: média de ${umaCasa(mediaRecente)} por semana nas últimas semanas` });
    alertas.sort((a, b) => a.nivel - b.nivel);

    // ── Fonte ────────────────────────────────────────────────────────────────────
    const fonte = {
      demandas: `${plural(lidas, 'peça lida', 'peças lidas')}; ${pecas.length} de clientes ativos${semClienteAtivo ? ` (${semClienteAtivo} sem cliente ativo ${semClienteAtivo === 1 ? 'ficou' : 'ficaram'} de fora)` : ''}`,
      clientes: cadastroCarregado
        ? `Cadastro de clientes: ${porCliente.size} ativos de ${cadastro.length}`
        : 'O cadastro de clientes ainda não carregou: valem os clientes das próprias peças',
      finalizado: typeof finalizado === 'function'
        ? 'Regra de entrega informada por quem chamou'
        : 'Entregue = Finalizado, Feito, Concluído, Aprovado, Para agendar, Agendado, Publicado ou Postado',
      pessoas: mapaPessoas.size ? 'Nomes do mapa de pessoas (TEAM_USERS)' : 'Nomes do campo Responsável das peças',
      planejamento: planos
        ? 'Planejamentos do banco: um não arquivado do mês atual ou seguinte'
        : sabePlanejamento
          ? 'Pelo link de planejamento do cadastro (planejamento_url): não diz de que mês'
          : 'Sem dado de planejamento',
      datas: `Dia local ${dia}; a veiculação manda (sem ela, o prazo); entrega = dia da última troca de status`,
      contagem: { lidas, consideradas: pecas.length, semClienteAtivo, repetidas, entreguesSemDia },
    };

    return {
      geradoEm: agora.toISOString(),
      fonte,
      hoje: blocoHoje,
      semana: blocoSemana,
      graficoSemana: { campo: campoGrafico, inicio: inicioGrafico, fim: diasGrafico[6], porDia: diasGrafico.map((dia) => ({ dia, ...contaGrafico.get(dia) })) },
      cobertura,
      clientes: listaClientes,
      gargalos: listaGargalos,
      time: listaTime,
      heads: listaHeads,
      historico,
      projecao,
      alertas,
    };
  }

  const pessoasDe = (lista) => Object.fromEntries(mapaDePessoas(lista));
  const api = Object.freeze({
    calcular,
    REGRAS,
    // entregue: a mesma regra de "Entregue" das contas acima (usada pela Carteira, vybe-carteira-saude.js).
    util: Object.freeze({ diaLocal, diaDe, somarDias, diasEntre, inicioDaSemana, mediana, chaveStatus, ativoNoCadastro, pessoasDe,
      entregue: (status) => ENTREGUE.has(chaveStatus(status)), headsDe, SEM_HEAD }),
  });
  raiz.VybeDono = api;
  if (raiz.window && typeof raiz.window === 'object' && raiz.window !== raiz) raiz.window.VybeDono = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
