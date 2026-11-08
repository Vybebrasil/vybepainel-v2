// Carteira de clientes (Paulo, 07/11/2026, inspirado no AgencyFlow): o servidor do módulo Carteira
// (vybe-mundo-carteira.js). Rota GET/POST /api/painel?area=carteira.
//
// Lê:
//  - sinais para a nota de saúde (vybe-carteira-saude.js): voltas para "Alteração" nos últimos 30
//    dias e a mediana de dias em "Ag. Aprovação Cliente" nos últimos 60, pelo histórico de status
//    (vybe_conteudo_eventos). Falhou: a tela calcula só com o que tem.
//  - a base dos clientes para churn e cohort: entrada (início do contrato; sem ele, criado_no_monday;
//    sem ele, o primeiro evento do cliente) e saída (registro de churn; sem ele, desativado_em).
//  - onboarding, etapas configuradas, contratos, churn e o histórico mensal da nota, nas tabelas da
//    migração 2026-11-07-carteira.sql. Sem a tabela, a parte volta { disponivel: false } (a tela
//    mostra "aguardando ativação"); nada aqui cria tabela.
// Escreve (sempre numa transação, com a linha travada):
//  - onboarding: quem administra, a equipe de Atendimento e os heads do próprio cliente.
//  - etapas do onboarding, contratos e churn: só quem administra.
//  - nota do mês (saude_registrar): qualquer sessão pessoal; só o mês corrente, nota 0–100, com os
//    motivos e os heads (é o que GET acao=saude devolve).
// Leituras para outras partes (sessão da equipe ou serviço):
//  - GET area=carteira&acao=saude → { clientes: [{ cliente, clienteId, score, risco, motivos[], head, mes, registrado_em }] }
//    (a última nota guardada de cada cliente ativo, do menor score para o maior). A nota é calculada
//    no painel e guardada a cada abertura da Carteira: `registrado_em` diz de quando ela é.
//  - GET area=carteira&acao=onboarding → { etapas: [{ cliente, clienteId, etapa, etapaId, paradaDesde (ISO),
//    diasParada, responsavel, pct }] } (onboardings abertos, o mais parado primeiro), para cobrar etapa travada.
//  - POST area=carteira acao=clima (bot, só serviço ou quem administra) → grava o clima do grupo:
//    { clientes: { "<nome do cliente>": { pontos: -20..10, motivo, em } } } → { gravados[], ignorados[] }.
// Não envia mensagens.

export const ETAPAS_PADRAO = Object.freeze([
  { id: 'boas_vindas', nome: 'Boas-vindas', itens: [['mensagem', 'Mensagem de boas-vindas enviada'], ['grupo', 'Grupo do cliente criado no WhatsApp'], ['equipe', 'Head e equipe apresentados ao cliente']] },
  { id: 'contrato', nome: 'Contrato', itens: [['assinado', 'Contrato assinado'], ['escopo', 'Plano e escopo no cadastro do cliente'], ['valor', 'Valor e vencimento combinados']] },
  { id: 'acessos', nome: 'Acessos', itens: [['meta', 'Meta: Business Manager, Instagram e Facebook'], ['drive', 'Pasta do cliente no Drive'], ['logins', 'Logins guardados em Acessos'], ['marca', 'Logo, fontes e identidade recebidos']] },
  { id: 'kickoff', nome: 'Kickoff', itens: [['reuniao', 'Reunião de kickoff feita'], ['briefing', 'Briefing e tom de voz registrados'], ['ata', 'Ata do kickoff no painel']] },
  { id: 'primeiro_mes', nome: 'Primeiro mês', itens: [['planejamento', 'Planejamento do 1º mês aprovado'], ['publicadas', 'Primeiras peças publicadas'], ['conversa30', 'Conversa de 30 dias com o cliente']] },
].map((e) => Object.freeze({ id: e.id, nome: e.nome, itens: e.itens.map(([id, texto]) => Object.freeze({ id, texto })) })));

export const CONTRATO_STATUS = Object.freeze(['ativo', 'negociando', 'aviso_previo', 'encerrado']);
export const CHURN_TIPOS = Object.freeze(['cancelamento', 'nao_renovou', 'pausa']);
export const CHURN_MOTIVOS = Object.freeze(['preco', 'resultado', 'atendimento', 'fechou_empresa', 'internalizou', 'outro']);
const MIGRACAO = '2026-11-07-carteira.sql';

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const ID = /^[1-9]\d{0,15}$/;
const idValido = (v, campo = 'ID') => { const s = String(v ?? ''); if (!ID.test(s)) falhar(`${campo} inválido.`); return s; };
const SLUG = /^[a-z0-9_-]{1,40}$/;
const texto = (v, max, campo, obrigatorio = false) => {
  if (v != null && typeof v !== 'string') falhar(`${campo} inválido.`);
  const s = String(v || '').trim();
  if (obrigatorio && !s) falhar(`Informe ${campo.toLowerCase()}.`);
  if (s.length > max) falhar(`${campo}: máximo de ${max} caracteres.`);
  return s;
};
function dataValida(v, campo) {
  if (v == null || v === '') return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) !== s) falhar(`${campo}: data inválida.`);
  return s;
}
function valorValido(v, campo) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) falhar(`${campo} inválido.`);
  return Math.round(n * 100) / 100;
}
export const hojeBahia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());
const somar = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const diaDe = (v) => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const numero = (v) => (v == null || v === '' ? null : Number(v));
const semTabela = (e) => e?.code === '42P01';
// Uma parte que depende da migração: sem a tabela, { disponivel: false }.
async function parte(ler) {
  try { return { disponivel: true, ...(await ler()) }; }
  catch (e) { if (semTabela(e)) return { disponivel: false, migracao: MIGRACAO }; throw e; }
}

// ── Etapas do onboarding ─────────────────────────────────────────────────────────
export function validarEtapas(lista) {
  if (!Array.isArray(lista) || !lista.length || lista.length > 12) falhar('O onboarding precisa de 1 a 12 etapas.');
  const ids = new Set();
  return lista.map((e) => {
    if (!e || typeof e !== 'object') falhar('Etapa inválida.');
    const id = String(e.id || '');
    if (!SLUG.test(id) || ids.has(id)) falhar('Identificador de etapa inválido ou repetido.');
    ids.add(id);
    const nome = texto(e.nome, 40, 'Nome da etapa', true);
    const itens = Array.isArray(e.itens) ? e.itens : [];
    if (itens.length > 15) falhar(`${nome}: no máximo 15 itens.`);
    const idsItens = new Set();
    return { id, nome, itens: itens.map((i) => {
      const iid = String(i?.id || '');
      if (!SLUG.test(iid) || idsItens.has(iid)) falhar(`${nome}: item com identificador inválido ou repetido.`);
      idsItens.add(iid);
      return { id: iid, texto: texto(i?.texto, 120, 'Item', true) };
    }) };
  });
}
async function etapasConfiguradas(sql) {
  const [linha] = await sql`SELECT valor FROM vybe_carteira_config WHERE chave='onboarding_etapas'`;
  if (!linha) return { etapas: ETAPAS_PADRAO, padrao: true };
  try { return { etapas: validarEtapas(typeof linha.valor === 'string' ? JSON.parse(linha.valor) : linha.valor), padrao: false }; }
  catch { return { etapas: ETAPAS_PADRAO, padrao: true }; }
}

// ── Leituras ─────────────────────────────────────────────────────────────────────
export async function sinaisDaCarteira(sql, dia) {
  const desde30 = somar(dia, -30), desde60 = somar(dia, -60);
  const linhas = await sql`WITH ev AS (
      SELECT e.conteudo_id, e.para, e.em,
             LEAD(e.em) OVER (PARTITION BY e.conteudo_id ORDER BY e.em) AS saiu
        FROM vybe_conteudo_eventos e WHERE e.tipo = 'status' AND e.em >= ${desde60}::date)
    SELECT cc.cliente_id::text AS cliente_id,
      COUNT(*) FILTER (WHERE ev.para ILIKE '%altera%' AND ev.em >= ${desde30}::date)::int AS ajustes30,
      COUNT(*) FILTER (WHERE ev.para ILIKE '%aprova%cliente%' AND ev.saiu IS NOT NULL)::int AS aprovacoes,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ev.saiu - ev.em)) / 86400)
        FILTER (WHERE ev.para ILIKE '%aprova%cliente%' AND ev.saiu IS NOT NULL) AS aprovacao_dias
    FROM ev JOIN vybe_conteudo_clientes cc ON cc.conteudo_id = ev.conteudo_id
    GROUP BY cc.cliente_id`;
  const porCliente = {};
  for (const l of linhas) {
    const med = numero(l.aprovacao_dias);
    porCliente[l.cliente_id] = { ajustes30: Number(l.ajustes30) || 0, aprovacoes: Number(l.aprovacoes) || 0, aprovacao_dias: med == null ? null : Math.round(med * 10) / 10 };
  }
  return { porCliente, desde: desde60 };
}

async function baseDosClientes(sql) {
  return sql`SELECT c.id::text, c.nome, c.ativo, c.status, COALESCE(c.nao_e_cliente, false) AS nao_e_cliente,
      c.valor, c.criado_no_monday, c.desativado_em,
      (SELECT MIN(e.em) FROM vybe_cliente_eventos e WHERE e.cliente_id = c.id) AS primeiro_evento,
      (SELECT e.motivo FROM vybe_cliente_eventos e WHERE e.cliente_id = c.id AND e.para = 'Inativo' ORDER BY e.em DESC LIMIT 1) AS motivo_saida
    FROM vybe_clientes c WHERE c.apagado_em IS NULL ORDER BY c.nome`;
}

// Clima do grupo (vybe_carteira_clima, alimentada pelo bot). Formato no topo de vybe-carteira-saude.js.
async function climaDosClientes(sql) {
  const porCliente = {};
  for (const l of await sql`SELECT cliente_id::text, pontos, motivo, origem, atualizado_em FROM vybe_carteira_clima`) {
    porCliente[l.cliente_id] = { pontos: Number(l.pontos), motivo: l.motivo || '', origem: l.origem || '', atualizado_em: l.atualizado_em };
  }
  return { porCliente };
}

async function lerOnboardings(sql) {
  return (await sql`SELECT o.cliente_id::text, c.nome AS cliente, o.etapas, o.iniciado_em, o.iniciado_por::text, o.encerrado_em, o.atualizado_em
      FROM vybe_cliente_onboarding o JOIN vybe_clientes c ON c.id = o.cliente_id
     ORDER BY o.encerrado_em NULLS FIRST, o.iniciado_em DESC`)
    .map((o) => ({ ...o, etapas: typeof o.etapas === 'string' ? JSON.parse(o.etapas) : o.etapas || {} }));
}

// Onde o onboarding está e desde quando está parado (para a tela e para o bot cobrar etapa travada).
// - Etapa concluída = todos os itens marcados (etapa sem itens conta como concluída).
// - Etapa atual = a primeira não concluída. parada_desde = o último movimento dela (item marcado ou
//   desmarcado, responsável trocado); sem movimento, a conclusão da etapa anterior; sem ela, o início.
// - dias_parada = dias de calendário (fuso da Bahia) de parada_desde até `dia`.
const dataOk = (x) => { const d = x ? new Date(x) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const maiorData = (...v) => v.map(dataOk).filter(Boolean).reduce((m, d) => (!m || d > m ? d : m), null);
const diaBahia = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(d);
export function situacaoDoOnboarding(o, etapas, dia = hojeBahia()) {
  let anteriorConcluida = dataOk(o.iniciado_em);
  let atual = null;
  const lista = etapas.map((e) => {
    const dela = o.etapas?.[e.id] || {};
    const feitos = dela.feitos || {};
    const marcados = e.itens.filter((i) => feitos[i.id]);
    const concluida = marcados.length === e.itens.length;
    const ultimoMovimento = maiorData(dela.atualizado_em, ...marcados.map((i) => feitos[i.id]?.em));
    const x = { id: e.id, nome: e.nome, total: e.itens.length, feitos: marcados.length, concluida,
      responsavel_id: dela.responsavel_id || null, concluida_em: null, parada_desde: null, dias_parada: null };
    if (concluida) {
      anteriorConcluida = ultimoMovimento || anteriorConcluida;
      x.concluida_em = anteriorConcluida ? anteriorConcluida.toISOString() : null;
    } else if (!atual) {
      const desde = ultimoMovimento || anteriorConcluida;
      x.parada_desde = desde ? desde.toISOString() : null;
      x.dias_parada = desde ? Math.max(0, Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${diaBahia(desde)}T12:00:00Z`)) / 864e5)) : null;
      atual = x;
    }
    return x;
  });
  const total = lista.reduce((t, e) => t + e.total, 0), feitos = lista.reduce((t, e) => t + e.feitos, 0);
  return { etapas: lista, concluido: !atual, pct: total ? Math.round((feitos / total) * 100) : 100,
    atual: atual ? { id: atual.id, nome: atual.nome, responsavel_id: atual.responsavel_id, parada_desde: atual.parada_desde, dias_parada: atual.dias_parada } : null };
}

// A última nota guardada de cada cliente ativo (GET acao=saude).
export async function saudeGuardada(sql) {
  const linhas = await sql`SELECT DISTINCT ON (s.cliente_id) s.cliente_id::text, c.nome, s.score, s.risco, s.motivos, s.heads, s.mes, s.registrado_em
      FROM vybe_carteira_saude_mensal s JOIN vybe_clientes c ON c.id = s.cliente_id
     WHERE c.apagado_em IS NULL AND COALESCE(c.ativo, true)
     ORDER BY s.cliente_id, s.mes DESC`;
  return linhas.map((l) => ({ cliente: l.nome, clienteId: l.cliente_id, score: Number(l.score), risco: l.risco,
    motivos: typeof l.motivos === 'string' ? JSON.parse(l.motivos) : l.motivos || [], head: l.heads || '', mes: diaDe(l.mes), registrado_em: l.registrado_em }))
    .sort((a, b) => a.score - b.score || a.cliente.localeCompare(b.cliente, 'pt-BR'));
}
// Onboardings abertos e não concluídos, com a etapa atual e desde quando ela está parada
// (GET acao=onboarding, o formato que o bot lê). O mais parado primeiro.
export async function onboardingsAbertos(sql, dia = hojeBahia()) {
  const { etapas } = await etapasConfiguradas(sql);
  const pessoas = new Map((await sql`SELECT id::text, nome FROM vybe_pessoas`).map((p) => [p.id, p.nome]));
  return (await lerOnboardings(sql)).filter((o) => !o.encerrado_em).map((o) => ({ o, s: situacaoDoOnboarding(o, etapas, dia) }))
    .filter(({ s }) => s.atual).map(({ o, s }) => ({
      cliente: o.cliente, clienteId: o.cliente_id, etapa: s.atual.nome, etapaId: s.atual.id,
      paradaDesde: s.atual.parada_desde, diasParada: s.atual.dias_parada,
      responsavel: pessoas.get(String(s.atual.responsavel_id)) || null, pct: s.pct,
    })).sort((a, b) => (b.diasParada ?? -1) - (a.diasParada ?? -1));
}

// Clima do grupo vindo do bot (POST acao=clima): { clientes: { "<nome do cliente>": { pontos, motivo, em } } }.
// O nome é o do cadastro (sem diferença de acento, caixa ou pontuação). pontos inteiro de −20 a +10;
// motivo até 200 caracteres; em = quando o bot leu (ISO; sem ele ou no futuro, agora). Grava uma
// linha por cliente (a última vale). Nome desconhecido ou valor inválido volta em `ignorados`.
const chaveDoNome = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export async function gravarClima(sql, b) {
  const entrada = b?.clientes;
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) falhar('Envie clientes: { "<nome do cliente>": { pontos, motivo, em } }.');
  const nomes = Object.keys(entrada);
  if (nomes.length > 500) falhar('No máximo 500 clientes por vez.');
  const cadastro = new Map();
  for (const c of await sql`SELECT id::text, nome FROM vybe_clientes WHERE apagado_em IS NULL`) if (!cadastro.has(chaveDoNome(c.nome))) cadastro.set(chaveDoNome(c.nome), c);
  const validos = [], ignorados = [];
  for (const nome of nomes) {
    const v = entrada[nome], c = cadastro.get(chaveDoNome(nome));
    const pontos = Number(v?.pontos);
    if (!c) { ignorados.push({ cliente: nome, motivo: 'cliente não encontrado no cadastro' }); continue; }
    if (!Number.isInteger(pontos) || pontos < -20 || pontos > 10) { ignorados.push({ cliente: nome, motivo: 'pontos devem ser um inteiro de -20 a 10' }); continue; }
    if (v?.motivo != null && typeof v.motivo !== 'string') { ignorados.push({ cliente: nome, motivo: 'motivo inválido' }); continue; }
    const quando = v?.em ? new Date(v.em) : null;
    const em = quando && !Number.isNaN(quando.getTime()) && quando.getTime() <= Date.now() + 60_000 ? quando.toISOString() : new Date().toISOString();
    validos.push({ id: c.id, cliente: c.nome, pontos, motivo: String(v?.motivo || '').trim().slice(0, 200), em });
  }
  if (validos.length) {
    await sql.comTransacao(async (tx) => {
      for (const x of validos) {
        await tx`INSERT INTO vybe_carteira_clima (cliente_id, pontos, motivo, origem, atualizado_em) VALUES (${x.id}, ${x.pontos}, ${x.motivo}, 'bot', ${x.em})
          ON CONFLICT (cliente_id) DO UPDATE SET pontos=EXCLUDED.pontos, motivo=EXCLUDED.motivo, origem=EXCLUDED.origem, atualizado_em=EXCLUDED.atualizado_em`;
      }
    });
  }
  return { gravados: validos.map((x) => x.cliente), ignorados };
}

export async function lerCarteira(sql, quem, dia = hojeBahia()) {
  const eu = quem?.pessoa?.id != null ? String(quem.pessoa.id) : '';
  const admin = quem?.tipo === 'servico' || Boolean(quem?.pessoa?.admin);
  const [pessoas, meus, atendimento, sinais, base] = await Promise.all([
    sql`SELECT id::text, nome FROM vybe_pessoas WHERE ativo ORDER BY nome`.then((r) => r, () => []),
    eu ? sql`SELECT cliente_id::text AS id FROM vybe_cliente_pessoas WHERE pessoa_id = ${eu}`.then((r) => r.map((x) => x.id), () => []) : [],
    eu ? sql`SELECT funcao FROM vybe_escritorio_funcoes WHERE pessoa_id = ${eu}`.then((r) => r[0]?.funcao === 'atendimento', () => false) : false,
    sinaisDaCarteira(sql, dia).catch(() => null),
    baseDosClientes(sql).catch(() => null),
  ]);
  const [config, onboardingLido, contratos, churn, historico, clima] = await Promise.all([
    parte(() => etapasConfiguradas(sql)),
    parte(async () => ({ clientes: await lerOnboardings(sql) })),
    parte(async () => ({ lista: (await sql`SELECT cliente_id::text, valor_mensal, inicio, renovacao, status, observacao, atualizado_em
        FROM vybe_cliente_contratos`).map((c) => ({ ...c, valor_mensal: numero(c.valor_mensal), inicio: diaDe(c.inicio), renovacao: diaDe(c.renovacao) })) })),
    parte(async () => ({ registros: (await sql`SELECT id::text, cliente_id::text, saiu_em, tipo, motivo, detalhe, receita_mensal, registrado_em
        FROM vybe_cliente_churn ORDER BY saiu_em DESC, id DESC`).map((r) => ({ ...r, saiu_em: diaDe(r.saiu_em), receita_mensal: numero(r.receita_mensal) })) })),
    parte(async () => ({ meses: (await sql`SELECT mes, ROUND(AVG(score))::int AS media, COUNT(*)::int AS clientes,
        COUNT(*) FILTER (WHERE risco = 'alto')::int AS alto FROM vybe_carteira_saude_mensal GROUP BY mes ORDER BY mes DESC LIMIT 24`)
        .map((m) => ({ ...m, mes: diaDe(m.mes) })).reverse() })),
    parte(() => climaDosClientes(sql)),
  ]);
  const etapas = config.disponivel ? config.etapas : ETAPAS_PADRAO;
  const onboarding = onboardingLido.disponivel
    ? { ...onboardingLido, clientes: onboardingLido.clientes.map((o) => ({ ...o, situacao: situacaoDoOnboarding(o, etapas, dia) })) }
    : onboardingLido;
  // Entrada e saída de cada cliente (churn e cohort).
  const contratoDe = new Map((contratos.lista || []).map((c) => [c.cliente_id, c]));
  const churnDe = new Map();
  for (const r of churn.registros || []) if (!churnDe.has(r.cliente_id)) churnDe.set(r.cliente_id, r);
  const clientes = base ? base.filter((c) => !c.nao_e_cliente).map((c) => {
    const ct = contratoDe.get(c.id), ch = churnDe.get(c.id);
    const inativo = c.ativo === false || /inativ/i.test(String(c.status || ''));
    return { id: c.id, nome: c.nome, ativo: !inativo,
      entrada: ct?.inicio || diaDe(c.criado_no_monday) || diaDe(c.primeiro_evento),
      saida: inativo ? (ch?.saiu_em || diaDe(c.desativado_em)) : null,
      valor: ct?.valor_mensal ?? numero(c.valor), motivo_saida: inativo ? c.motivo_saida || '' : '' };
  }) : null;
  return {
    dia, eu, admin, atendimento, meus_clientes: meus,
    pode: { contratos: admin, churn: admin, etapas: admin, onboarding_todos: admin || atendimento },
    pessoas, sinais, clima, clientes,
    etapas, etapas_padrao: ETAPAS_PADRAO,
    onboarding, contratos, churn, historico, migracao: MIGRACAO,
    opcoes: { contrato_status: CONTRATO_STATUS, churn_tipos: CHURN_TIPOS, churn_motivos: CHURN_MOTIVOS },
  };
}

// ── Escritas ─────────────────────────────────────────────────────────────────────
async function podeOnboarding(sql, quem, clienteId) {
  if (quem.pessoa.admin) return true;
  const [f] = await Promise.resolve(sql`SELECT funcao FROM vybe_escritorio_funcoes WHERE pessoa_id=${quem.pessoa.id}`).catch(() => []);
  if (f?.funcao === 'atendimento') return true;
  const [h] = await Promise.resolve(sql`SELECT 1 AS ok FROM vybe_cliente_pessoas WHERE cliente_id=${clienteId} AND pessoa_id=${quem.pessoa.id}`).catch(() => []);
  return Boolean(h);
}
async function clienteAtivo(tx, id) {
  const [c] = await tx`SELECT id, nome, ativo FROM vybe_clientes WHERE id=${id} AND apagado_em IS NULL`;
  if (!c) falhar('Cliente não encontrado.', 404);
  return c;
}
const soAdmin = (quem) => { if (!quem.pessoa.admin) falhar('Só quem administra altera contratos, cancelamentos e as etapas.', 403); };

export async function escreverCarteira(sql, quem, b = {}, dia = hojeBahia()) {
  const acao = String(b.acao || '');
  const pessoaId = String(quem.pessoa.id), nomeQuem = String(quem.pessoa.nome || '');

  if (acao === 'saude_registrar') {
    const itens = Array.isArray(b.itens) ? b.itens : falhar('Informe as notas.');
    if (itens.length > 500) falhar('No máximo 500 clientes por vez.');
    const lista = itens.map((i) => {
      const score = Number(i?.score);
      if (!Number.isInteger(score) || score < 0 || score > 100) falhar('Nota inválida.');
      if (!['alto', 'medio', 'baixo'].includes(i?.risco)) falhar('Risco inválido.');
      const motivos = (Array.isArray(i?.motivos) ? i.motivos : []).slice(0, 8).map((m) => texto(String(m ?? ''), 160, 'Motivo'));
      return { id: idValido(i?.cliente_id, 'Cliente'), score, risco: i.risco, motivos, heads: texto(String(i?.heads ?? ''), 200, 'Heads') };
    });
    const mes = `${dia.slice(0, 7)}-01`;
    await sql.comTransacao(async (tx) => {
      for (const i of lista) {
        await tx`INSERT INTO vybe_carteira_saude_mensal (mes, cliente_id, score, risco, motivos, heads)
          SELECT ${mes}::date, c.id, ${i.score}, ${i.risco}, ${JSON.stringify(i.motivos)}::jsonb, ${i.heads} FROM vybe_clientes c WHERE c.id=${i.id} AND c.apagado_em IS NULL
          ON CONFLICT (mes, cliente_id) DO UPDATE SET score=EXCLUDED.score, risco=EXCLUDED.risco, motivos=EXCLUDED.motivos, heads=EXCLUDED.heads, registrado_em=now()`;
      }
    });
    return { mes, registrados: lista.length };
  }

  if (acao === 'etapas_salvar') {
    soAdmin(quem);
    const etapas = validarEtapas(b.etapas);
    await sql`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por) VALUES ('onboarding_etapas', ${JSON.stringify(etapas)}::jsonb, ${pessoaId})
      ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor, atualizado_em=now(), atualizado_por=EXCLUDED.atualizado_por`;
    return { etapas };
  }

  if (acao === 'contrato_salvar') {
    soAdmin(quem);
    const id = idValido(b.cliente_id, 'Cliente');
    const status = String(b.status || 'ativo');
    if (!CONTRATO_STATUS.includes(status)) falhar('Status de contrato inválido.');
    const d = { valor: valorValido(b.valor_mensal, 'Valor mensal'), inicio: dataValida(b.inicio, 'Início'), renovacao: dataValida(b.renovacao, 'Renovação'),
      observacao: texto(b.observacao, 1000, 'Observação') };
    if (d.inicio && d.renovacao && d.renovacao < d.inicio) falhar('A renovação não pode ser antes do início.');
    return sql.comTransacao(async (tx) => {
      await clienteAtivo(tx, id);
      const [c] = await tx`INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio, renovacao, status, observacao, atualizado_por)
        VALUES (${id}, ${d.valor}, ${d.inicio}, ${d.renovacao}, ${status}, ${d.observacao}, ${pessoaId})
        ON CONFLICT (cliente_id) DO UPDATE SET valor_mensal=EXCLUDED.valor_mensal, inicio=EXCLUDED.inicio, renovacao=EXCLUDED.renovacao,
          status=EXCLUDED.status, observacao=EXCLUDED.observacao, atualizado_em=now(), atualizado_por=EXCLUDED.atualizado_por
        RETURNING cliente_id::text`;
      return { contrato: c.cliente_id };
    });
  }

  if (acao === 'churn_registrar') {
    soAdmin(quem);
    const id = idValido(b.cliente_id, 'Cliente');
    const saiu = dataValida(b.saiu_em, 'Data de saída') || falhar('Informe a data de saída.');
    if (saiu > dia) falhar('A data de saída não pode ser no futuro.');
    if (!CHURN_TIPOS.includes(b.tipo)) falhar('Tipo de saída inválido.');
    if (!CHURN_MOTIVOS.includes(b.motivo)) falhar('Motivo inválido.');
    const detalhe = texto(b.detalhe, 1000, 'Detalhe', b.motivo === 'outro');
    const receita = valorValido(b.receita_mensal, 'Receita mensal');
    return sql.comTransacao(async (tx) => {
      await clienteAtivo(tx, id);
      const [r] = await tx`INSERT INTO vybe_cliente_churn (cliente_id, saiu_em, tipo, motivo, detalhe, receita_mensal, registrado_por)
        VALUES (${id}, ${saiu}, ${b.tipo}, ${b.motivo}, ${detalhe}, ${receita}, ${pessoaId})
        ON CONFLICT (cliente_id, saiu_em) DO UPDATE SET tipo=EXCLUDED.tipo, motivo=EXCLUDED.motivo, detalhe=EXCLUDED.detalhe,
          receita_mensal=EXCLUDED.receita_mensal, registrado_em=now(), registrado_por=EXCLUDED.registrado_por
        RETURNING id::text`;
      return { churn: r.id };
    });
  }
  if (acao === 'churn_apagar') {
    soAdmin(quem);
    const id = idValido(b.id);
    const r = await sql`DELETE FROM vybe_cliente_churn WHERE id=${id} RETURNING id`;
    if (!r.length) falhar('Registro não encontrado.', 404);
    return { apagado: String(id) };
  }

  if (!acao.startsWith('onboarding_')) falhar('Ação desconhecida.');
  const clienteId = idValido(b.cliente_id, 'Cliente');
  if (!(await podeOnboarding(sql, quem, clienteId))) falhar('Só quem administra, o Atendimento e os heads do cliente mexem no onboarding.', 403);
  const { etapas } = await etapasConfiguradas(sql);
  const etapaDe = (eid) => etapas.find((e) => e.id === String(eid || '')) || falhar('Etapa desconhecida.');

  return sql.comTransacao(async (tx) => {
    const c = await clienteAtivo(tx, clienteId);
    if (acao === 'onboarding_iniciar') {
      if (c.ativo === false) falhar('O cliente está desativado.');
      const [o] = await tx`INSERT INTO vybe_cliente_onboarding (cliente_id, iniciado_por) VALUES (${clienteId}, ${pessoaId})
        ON CONFLICT (cliente_id) DO UPDATE SET encerrado_em=NULL, atualizado_em=now() RETURNING cliente_id::text`;
      return { onboarding: o.cliente_id };
    }
    const [o] = await tx`SELECT etapas, encerrado_em FROM vybe_cliente_onboarding WHERE cliente_id=${clienteId} FOR UPDATE`;
    if (!o) falhar('Este cliente não está em onboarding.', 404);
    const atual = (typeof o.etapas === 'string' ? JSON.parse(o.etapas) : o.etapas) || {};
    if (acao === 'onboarding_encerrar' || acao === 'onboarding_reabrir') {
      await tx`UPDATE vybe_cliente_onboarding SET encerrado_em=${acao === 'onboarding_encerrar' ? new Date().toISOString() : null}, atualizado_em=now() WHERE cliente_id=${clienteId}`;
      return { onboarding: clienteId };
    }
    if (o.encerrado_em) falhar('Este onboarding já foi encerrado. Reabra para mexer.', 409);
    const etapa = etapaDe(b.etapa);
    const dela = { responsavel_id: null, feitos: {}, ...(atual[etapa.id] || {}), atualizado_em: new Date().toISOString() };
    if (acao === 'onboarding_marcar') {
      const item = etapa.itens.find((i) => i.id === String(b.item || '')) || falhar('Item desconhecido.');
      dela.feitos = { ...(dela.feitos || {}) };
      if (b.feito) dela.feitos[item.id] = { em: new Date().toISOString(), por_id: pessoaId, por: nomeQuem };
      else delete dela.feitos[item.id];
    } else if (acao === 'onboarding_responsavel') {
      if (b.pessoa_id == null || b.pessoa_id === '') dela.responsavel_id = null;
      else {
        const pid = idValido(b.pessoa_id, 'Pessoa');
        const [p] = await tx`SELECT id FROM vybe_pessoas WHERE id=${pid} AND ativo`;
        if (!p) falhar('Pessoa indisponível.');
        dela.responsavel_id = pid;
      }
    } else falhar('Ação desconhecida.');
    const novo = { ...atual, [etapa.id]: dela };
    await tx`UPDATE vybe_cliente_onboarding SET etapas=${JSON.stringify(novo)}::jsonb, atualizado_em=now() WHERE cliente_id=${clienteId}`;
    return { onboarding: clienteId, etapas: novo };
  });
}

export async function areaCarteira(req, res, quem, criarBanco) {
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar a Carteira.' });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  const acao = String(req.body?.acao || req.query?.acao || '');
  // Clima do grupo: o bot (serviço) ou quem administra. O resto das escritas: sessão pessoal.
  if (req.method === 'POST' && acao === 'clima') {
    if (!(quem.tipo === 'servico' || (quem.tipo === 'sessao' && quem.pessoa?.admin))) return res.status(403).json({ error: 'Só quem administra ou o serviço do bot grava o clima do grupo.' });
  } else if (req.method === 'POST' && (quem.tipo !== 'sessao' || !quem.pessoa?.id)) return res.status(403).json({ error: 'A Carteira exige uma sessão pessoal para alterar.' });
  try {
    const sql = criarBanco();
    if (req.method === 'POST' && acao === 'clima') return res.status(200).json({ ok: true, ...(await gravarClima(sql, req.body || {})) });
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...(await escreverCarteira(sql, quem, req.body || {})) });
    // Leituras para outras partes (bot com sessão de serviço, relatório mensal): só a lista.
    if (req.query?.acao === 'saude') return res.status(200).json({ ok: true, clientes: await saudeGuardada(sql) });
    if (req.query?.acao === 'onboarding') return res.status(200).json({ ok: true, dia: hojeBahia(), etapas: await onboardingsAbertos(sql) });
    return res.status(200).json({ ok: true, ...(await lerCarteira(sql, quem)) });
  } catch (e) {
    if (semTabela(e)) return res.status(503).json({ error: `Carteira aguardando ativação: falta aplicar a migração ${MIGRACAO}.`, aguardando: true });
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível acessar a Carteira. Tente novamente.' });
  }
}
