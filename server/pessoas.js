// server/pessoas.js — o setor de Pessoas (Paulo, 07/11/2026).
//
//   GET  /api/painel?area=setor_pessoas&aba=produtividade|rh|projetos|academy|recrutamento|documentos
//   POST /api/painel?area=setor_pessoas  { acao, ... }
//
// Quem vê o quê (decidido aqui, no servidor; a tela só reflete):
//  - Gestão = quem administra (vybe_pessoas.admin) e os quatro donos (Paulo, Vinícius,
//    Ewerton e Deivid, pelo id da pessoa, server/donos.js — não pelo primeiro nome).
//  - Produtividade: cada pessoa recebe só o próprio score e o próprio detalhe. O ranking
//    completo, o detalhe de outra pessoa, os pesos e as metas só saem para a gestão; só a
//    gestão grava pesos, metas e capacidade.
//  - RH: cada um vê e abre os próprios pedidos; a gestão vê todos e responde. Aniversários
//    (só dia e mês) e férias aprovadas aparecem para todos. Clima: qualquer um responde uma
//    vez por trimestre; o resultado só sai agregado, só para a gestão e só com 3 ou mais
//    respostas. A resposta não guarda pessoa nem hora (migração 2026-11-07-pessoas.sql).
//    08/11/2026: prazo de resposta por tipo configurável pelos donos, data desejada, tempo médio
//    de resposta, e a pesquisa de clima com período que os donos abrem e encerram (eNPS +
//    liderança, comunicação, reconhecimento, carga de trabalho e ambiente), uma resposta por
//    pessoa, mesmo anonimato e mesmo mínimo de 3 (migração 2026-11-08-rh-pedidos-clima.sql).
//  - Projetos: todos veem; a gestão cria e edita; o responsável marca a própria etapa. Projeto com cliente: cada
//    etapa aberta vira demanda na esteira (Solicitações de Demandas) e fica feita quando a demanda termina (09/11).
//  - Academy: todos veem as trilhas e marcam as próprias aulas; a gestão edita e atribui.
//  - Recrutamento e Documentos: só a gestão (dados pessoais de candidatos e contratos).
// Sem a migração aplicada, as leituras voltam vazias com provisionado=false (e a
// produtividade funciona com os pesos padrão); as gravações respondem 503.
import calc from '../shared/pessoas-calculos.js';
import { ehDonoPessoa } from './donos.js';

// Gestão = quem administra e os quatro donos, pela regra única de server/donos.js (nunca pelo primeiro nome).
export const ehGestao = (pessoa) => Boolean(pessoa && (pessoa.admin || ehDonoPessoa(pessoa)));

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const texto = (v, max, campo, obrigatorio = false) => {
  if (v != null && typeof v !== 'string') falhar(`${campo} inválido.`);
  const s = (v || '').trim();
  if (s.length > max) falhar(`${campo}: máximo de ${max} caracteres.`);
  if (obrigatorio && !s) falhar(`Informe ${campo.toLowerCase()}.`);
  return s;
};
const idValido = (v, campo = 'ID') => { const s = String(v ?? ''); if (!/^[1-9]\d{0,15}$/.test(s) || !Number.isSafeInteger(Number(s))) falhar(`${campo} inválido.`); return s; };
const idOuNulo = (v, campo) => (v == null || v === '' ? null : idValido(v, campo));
const data = (v, campo, obrigatoria = false) => {
  if (v == null || v === '') { if (obrigatoria) falhar(`Informe ${campo.toLowerCase()}.`); return null; }
  if (!calc.util.dataValida(v)) falhar(`${campo}: data inválida.`);
  return v;
};
const linkValido = (v, campo) => { const s = texto(v, 1000, campo); if (s && !/^https:\/\/[^\s]+$/.test(s)) falhar(`${campo}: use um endereço que comece com https://`); return s; };
const umDe = (v, lista, campo) => { if (!lista.includes(v)) falhar(`${campo} inválido.`); return v; };
export const hojeBahia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(agora);
const semTabela = (e) => e?.code === '42P01' || e?.code === '42883';
// Leitura de tabela do setor: sem a migração, devolve o vazio e marca o estado.
async function ler(estado, consulta, vazio = []) {
  try { return await consulta; } catch (e) { if (semTabela(e)) { estado.provisionado = false; return vazio; } throw e; }
}

// ---------- configuração (pesos, metas, capacidade, etapas) ----------
async function config(sql, estado) {
  const linhas = await ler(estado, sql`SELECT chave, valor FROM vybe_pessoas_config`);
  const m = Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
  return {
    pesos: calc.normalizarPesos(m.pesos),
    metas: { ...calc.METAS_PADRAO, ...(m.metas && typeof m.metas === 'object' ? m.metas : {}) },
    capacidade: Number(m.capacidade?.semana) > 0 ? Number(m.capacidade.semana) : calc.CAPACIDADE_PADRAO,
    etapas: Array.isArray(m.etapas_recrutamento) && !calc.validarEtapas(m.etapas_recrutamento) ? m.etapas_recrutamento : [...calc.ETAPAS_RECRUTAMENTO_PADRAO],
  };
}
async function gravarConfig(tx, quem, chave, valor) {
  await tx`INSERT INTO vybe_pessoas_config (chave, valor, atualizado_por, atualizado_em) VALUES (${chave}, ${JSON.stringify(valor)}::jsonb, ${quem.id}, now())
    ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor, atualizado_por=EXCLUDED.atualizado_por, atualizado_em=now()`;
}

// Pessoa da equipe = ativa E com acesso (ativo AND pode_entrar). Regra única para Equipe, RH, Projetos, Carteira,
// heads dos clientes e carga do Comercial (auditoria 09/11: o RH contava 14 com contas duplicadas e sem acesso,
// a Equipe 9). tests/regra-pessoa-equipe.test.mjs vigia as consultas.
async function pessoasAtivas(sql, estado) {
  const pessoas = await sql`SELECT id::text AS id, nome FROM vybe_pessoas WHERE ativo AND pode_entrar ORDER BY nome`;
  const funcoes = await ler({ ...estado }, sql`SELECT pessoa_id::text AS pessoa_id, funcao FROM vybe_escritorio_funcoes`);
  const cargo = new Map(funcoes.map((f) => [f.pessoa_id, f.funcao]));
  return pessoas.map((p) => ({ ...p, cargo: calc.CARGOS[cargo.get(p.id)] ? cargo.get(p.id) : 'padrao' }));
}

// ---------- produtividade ----------
async function fatosDoMes(sql, { de, ate, hoje }) {
  const corte = hoje < ate ? hoje : calc.util.somarDias(ate, 1);
  const linhas = await sql`SELECT r.pessoa_id::text AS pessoa_id,
      count(*) FILTER (WHERE COALESCE(s.final,false) AND (c.status_em AT TIME ZONE 'America/Bahia')::date BETWEEN ${de}::date AND ${ate}::date)::int AS entregues,
      count(*) FILTER (WHERE COALESCE(s.final,false) AND (c.status_em AT TIME ZONE 'America/Bahia')::date BETWEEN ${de}::date AND ${ate}::date
        AND COALESCE(c.veiculacao, c.prazo) IS NOT NULL)::int AS com_data,
      count(*) FILTER (WHERE COALESCE(s.final,false) AND (c.status_em AT TIME ZONE 'America/Bahia')::date BETWEEN ${de}::date AND ${ate}::date
        AND (c.status_em AT TIME ZONE 'America/Bahia')::date <= COALESCE(c.veiculacao, c.prazo))::int AS no_prazo,
      count(*) FILTER (WHERE NOT COALESCE(s.final,false) AND c.status_chave IS DISTINCT FROM 'segurar_post'
        AND LEAST(c.prazo, c.veiculacao) >= ${de}::date AND LEAST(c.prazo, c.veiculacao) < ${corte}::date)::int AS atrasadas
    FROM vybe_conteudos c JOIN vybe_conteudo_responsaveis r ON r.conteudo_id = c.id
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL GROUP BY 1`;
  let ajustes = null;
  try {
    ajustes = new Map((await sql`SELECT r.pessoa_id::text AS pessoa_id, count(DISTINCT e.conteudo_id)::int AS n
      FROM vybe_conteudo_eventos e JOIN vybe_conteudo_responsaveis r ON r.conteudo_id = e.conteudo_id
      WHERE e.tipo = 'status' AND lower(e.para) IN ('alteração','alteracao')
        AND (e.em AT TIME ZONE 'America/Bahia')::date BETWEEN ${de}::date AND ${ate}::date GROUP BY 1`).map((l) => [l.pessoa_id, Number(l.n)]));
  } catch (e) { if (!semTabela(e) && e?.code !== '42703') throw e; }
  // Entrega de quem cria, produz ou atende (Paulo, 08/11/2026: o ranking dava 0 para quase toda a equipe): a peça SAIR
  // DAS MÃOS da pessoa no mês — o histórico de status mostra a passagem para aprovação, para agendar ou finalização.
  // Antes só contava o status final (Agendado/Finalizado), que quem marca é o agendamento: só a Tainara pontuava.
  // Vale o maior dos dois (status final ou passagem), com a data do cliente mandando no "no prazo".
  try {
    const passagens = await sql`SELECT r.pessoa_id::text AS pessoa_id,
        count(DISTINCT e.conteudo_id)::int AS entregues,
        count(DISTINCT e.conteudo_id) FILTER (WHERE COALESCE(c.veiculacao, c.prazo) IS NOT NULL)::int AS com_data,
        count(DISTINCT e.conteudo_id) FILTER (WHERE (e.em AT TIME ZONE 'America/Bahia')::date <= COALESCE(c.veiculacao, c.prazo))::int AS no_prazo
      FROM vybe_conteudo_eventos e
      JOIN vybe_conteudo_responsaveis r ON r.conteudo_id = e.conteudo_id
      JOIN vybe_conteudos c ON c.id = e.conteudo_id
      WHERE e.tipo = 'status' AND c.removido_em IS NULL
        AND lower(e.para) IN ('para aprovação','para aprovacao','em aprovação','em aprovacao','aprovação interna','aprovacao interna',
          'aguardando aprovação','aguardando aprovacao','ag. aprovação cliente','ag. aprovacao cliente','para agendar','agendado',
          'aprovado','finalizado','feito','concluído','concluido')
        AND (e.em AT TIME ZONE 'America/Bahia')::date BETWEEN ${de}::date AND ${ate}::date
      GROUP BY 1`;
    const porPessoa = new Map(linhas.map((l) => [l.pessoa_id, l]));
    for (const p of passagens) {
      const f = porPessoa.get(p.pessoa_id) || { pessoa_id: p.pessoa_id, entregues: 0, com_data: 0, no_prazo: 0, atrasadas: 0 };
      if (Number(p.entregues) > Number(f.entregues || 0)) porPessoa.set(p.pessoa_id, { ...f, entregues: p.entregues, com_data: p.com_data, no_prazo: p.no_prazo });
    }
    return { porPessoa, ajustes };
  } catch (e) { if (!semTabela(e) && e?.code !== '42703') throw e; }
  return { porPessoa: new Map(linhas.map((l) => [l.pessoa_id, l])), ajustes };
}
async function produtividade(sql, quem, query, estado) {
  const hoje = hojeBahia(), mes = query.mes ? String(query.mes) : hoje.slice(0, 7);
  if (!calc.util.mesValido(mes) || mes > hoje.slice(0, 7)) falhar('Mês inválido.');
  const gestao = ehGestao(quem), { de, ate } = calc.util.limitesDoMes(mes);
  const [cfg, pessoas, fatos] = await Promise.all([config(sql, estado), pessoasAtivas(sql, estado), fatosDoMes(sql, { de, ate, hoje })]);
  const linhas = pessoas.map((p) => {
    const f = fatos.porPessoa.get(p.id) || {};
    return { id: p.id, nome: p.nome, cargo: p.cargo, cargoNome: calc.CARGOS[p.cargo],
      entregues: Number(f.entregues || 0), comData: Number(f.com_data || 0), noPrazo: Number(f.no_prazo || 0), atrasadas: Number(f.atrasadas || 0),
      ajustes: fatos.ajustes ? (fatos.ajustes.get(p.id) || 0) : null,
      metaMes: Number(cfg.metas[p.cargo] ?? cfg.metas.padrao), meta: calc.metaProporcional(cfg.metas[p.cargo] ?? cfg.metas.padrao, mes, hoje) };
  });
  const lista = calc.ranking(linhas, cfg.pesos);
  const eu = String(quem.id), pedida = query.pessoa ? idValido(query.pessoa, 'Pessoa') : eu;
  if (pedida !== eu && !gestao) falhar('Cada pessoa vê só o próprio detalhe. O ranking é da gestão.', 403);
  // O detalhe não leva a posição para quem não é da gestão (nada de comparação exposta).
  const detalhe = (p) => p && (gestao ? p : { ...p, posicao: null });
  const base = { mes, hoje, de, ate, fonte: { ajustes: fatos.ajustes ? 'Histórico de status (Alteração)' : 'Sem histórico de status: ajustes fora da conta' },
    componentes: calc.COMPONENTES.map(([id, nome]) => ({ id, nome })), detalhe: detalhe(lista.find((p) => p.id === pedida)) || null };
  if (!gestao) return base;
  return { ...base, ranking: lista, pesos: cfg.pesos, metas: cfg.metas, capacidade: cfg.capacidade, cargos: calc.CARGOS };
}

// ---------- RH ----------
// Migração 2026-11-08-rh-pedidos-clima.sql: prazos configuráveis, data desejada, hora da resposta e a
// pesquisa de clima com período. Sem ela, o RH antigo segue e a tela avisa "aguardando a migração".
const MIGRACAO_RH = '2026-11-08-rh-pedidos-clima.sql';
const AGUARDANDO_RH = `Esta parte do RH está aguardando a migração ${MIGRACAO_RH}. Peça ao Paulo para aplicar.`;
const DIMS_PESQUISA = calc.DIMENSOES_PESQUISA.map(([k]) => k);
async function prazosRh(sql, estadoRh) {
  const linhas = await ler(estadoRh, sql`SELECT tipo, dias_uteis FROM vybe_rh_prazos`);
  return calc.normalizarPrazos(Object.fromEntries(linhas.map((l) => [l.tipo, Number(l.dias_uteis)])));
}
async function pesquisasDeClima(sql, estadoRh, { gestao, eu, hoje }) {
  const pesquisas = await ler(estadoRh, sql`SELECT id::text AS id, titulo, abre::text AS abre, fecha::text AS fecha, encerrada_em
    FROM vybe_clima_pesquisas ORDER BY abre DESC, id DESC LIMIT 24`);
  const lista = pesquisas.map((p) => ({ ...p, situacao: calc.situacaoPesquisa(p, hoje) }));
  const atual = lista.find((p) => p.situacao === 'aberta') || lista.find((p) => p.situacao === 'agendada') || null;
  const [participou] = atual ? await ler(estadoRh, sql`SELECT 1 AS sim FROM vybe_clima_pesquisa_participacao WHERE pesquisa_id = ${atual.id} AND pessoa_id = ${eu}`) : [];
  const saida = { atual: atual && { id: atual.id, titulo: atual.titulo, abre: atual.abre, fecha: atual.fecha, situacao: atual.situacao, respondeu: Boolean(participou) },
    dimensoes: calc.DIMENSOES_PESQUISA.map(([id, nome]) => ({ id, nome })), minimo: calc.MINIMO_CLIMA };
  if (!gestao) return saida;
  // Só a gestão vê resultado, só agregado e só com o mínimo de respostas. Comentários embaralhados.
  const ids = lista.map((p) => p.id);
  const respostas = ids.length ? await ler(estadoRh, sql`SELECT pesquisa_id::text AS pesquisa_id, enps, lideranca, comunicacao, reconhecimento, carga, ambiente, comentario
    FROM vybe_clima_pesquisa_respostas WHERE pesquisa_id::text = ANY(${ids}::text[])`) : [];
  const [{ n: equipe } = { n: 0 }] = await sql`SELECT count(*)::int AS n FROM vybe_pessoas WHERE ativo AND pode_entrar`;
  const historico = calc.historicoClima(lista.map((p) => {
    const minhas = respostas.filter((r) => r.pesquisa_id === p.id);
    const resultado = calc.agregarClima(minhas, calc.MINIMO_CLIMA, calc.DIMENSOES_PESQUISA);
    if (resultado.liberado) resultado.comentarios = minhas.map((r) => r.comentario).filter(Boolean).sort(() => Math.random() - .5);
    return { id: p.id, titulo: p.titulo, abre: p.abre, fecha: p.fecha, situacao: p.situacao, resultado };
  }));
  return { ...saida, equipe: Number(equipe) || 0, historico };
}
async function rh(sql, quem, query, estado) {
  const hoje = hojeBahia(), gestao = ehGestao(quem), eu = String(quem.id);
  const trimestre = gestao && /^\d{4}-T[1-4]$/.test(String(query.trimestre || '')) ? String(query.trimestre) : calc.trimestreDe(hoje);
  const estadoRh = { provisionado: true };
  const prazos = await prazosRh(sql, estadoRh);
  // As colunas da migração de 08/11 (data desejada, hora da resposta) saem por to_jsonb: a mesma
  // consulta vale antes e depois dela. O tempo de resposta usa a hora da resposta (ou, nos pedidos
  // antigos, a última atualização, que é quando o status mudou).
  const pedidos = await ler(estado, sql`SELECT r.*, r.id::text AS id, r.pessoa_id::text AS pessoa_id, p.nome AS pessoa_nome, r.inicio::text AS inicio, r.fim::text AS fim, r.prazo::text AS prazo,
      (r.criado_em AT TIME ZONE 'America/Bahia')::date::text AS criado_dia, to_jsonb(r)->>'data_desejada' AS data_desejada,
      CASE WHEN r.status IN ('resolvido','recusado') THEN (COALESCE((to_jsonb(r)->>'respondido_em')::timestamptz, r.atualizado_em) AT TIME ZONE 'America/Bahia')::date::text END AS respondido_dia
    FROM vybe_rh_pedidos r JOIN vybe_pessoas p ON p.id = r.pessoa_id
    WHERE (${gestao} OR r.pessoa_id = ${eu})
    ORDER BY (r.status IN ('aberto','andamento')) DESC, CASE WHEN r.status IN ('aberto','andamento') THEN r.prazo END, r.id DESC LIMIT ${gestao ? 300 : 100}`);
  const pesquisa = await pesquisasDeClima(sql, estadoRh, { gestao, eu, hoje });
  const perfis = await ler(estado, sql`SELECT f.pessoa_id::text AS pessoa_id, p.nome, p.ativo, f.nascimento::text AS nascimento, f.entrada::text AS entrada, f.saida::text AS saida
    FROM vybe_rh_perfil f JOIN vybe_pessoas p ON p.id = f.pessoa_id`);
  const ferias = await ler(estado, sql`SELECT r.pessoa_id::text AS pessoa_id, p.nome, r.inicio::text AS inicio, r.fim::text AS fim
    FROM vybe_rh_pedidos r JOIN vybe_pessoas p ON p.id = r.pessoa_id
    WHERE r.tipo = 'ferias' AND r.status = 'resolvido' AND r.fim >= ${calc.util.somarDias(hoje, -31)}::date ORDER BY r.inicio`);
  const [participou] = await ler(estado, sql`SELECT 1 AS sim FROM vybe_clima_participacao WHERE trimestre = ${calc.trimestreDe(hoje)} AND pessoa_id = ${eu}`);
  const meu = perfis.find((p) => p.pessoa_id === eu);
  const saida = {
    hoje, gestao,
    // `formulario`: os tipos que se abrem hoje (os outros só aparecem em pedidos antigos).
    tipos: Object.entries(calc.TIPOS_RH).map(([id, [nome]]) => ({ id, nome, dias: prazos[id], formulario: calc.TIPOS_PEDIDO.includes(id) })), status: calc.STATUS_RH,
    pedidos: pedidos.map((r) => ({ ...r, sla: calc.situacaoSla(r, hoje),
      atrasoUteis: calc.situacaoSla(r, hoje) === 'atrasado' ? calc.diasUteisEntre(r.prazo, hoje) : 0,
      idadeDias: r.criado_dia ? Math.max(0, calc.util.diasEntre(r.criado_dia, hoje)) : null })),
    // Números da fila: de todos para a gestão; dos próprios pedidos para quem pediu.
    indicadores: calc.indicadoresPedidos(pedidos, hoje),
    // false = a migração de 08/11 ainda não foi aplicada (prazos fixos, sem reembolso, sem pesquisa com período).
    rhPronto: estadoRh.provisionado, migracaoRh: MIGRACAO_RH,
    pesquisa,
    aniversarios: perfis.filter((p) => p.ativo && p.nascimento).map((p) => ({ pessoa_id: p.pessoa_id, nome: p.nome, dia: p.nascimento.slice(5) }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    ferias,
    meuPerfil: { nascimento: meu?.nascimento || null },
    clima: { trimestre: calc.trimestreDe(hoje), respondeu: Boolean(participou), dimensoes: calc.DIMENSOES.map(([id, nome]) => ({ id, nome })), minimo: calc.MINIMO_CLIMA },
  };
  if (!gestao) return saida;
  // Visão geral (só gestão): headcount, admissões, desligamentos e tempo médio de casa.
  const tipo = query.periodo === 'anual' ? 'anual' : 'mensal', ref = calc.util.mesValido(String(query.ref || '')) ? String(query.ref) : hoje.slice(0, 7);
  const periodo = calc.periodoDe(tipo, ref);
  const perfilDe = new Map(perfis.map((p) => [p.pessoa_id, p]));
  const quadro = (await sql`SELECT id::text AS id, (ativo AND pode_entrar) AS ativo FROM vybe_pessoas`).flatMap((p) => {
    const f = perfilDe.get(p.id);
    if (!p.ativo && !f?.saida) return []; // saiu sem data registrada: fora das contas
    return [{ id: p.id, entrada: f?.entrada || null, saida: f?.saida || null }];
  });
  const respostas = await ler(estado, sql`SELECT enps, lideranca, ambiente, crescimento, processos, beneficios, comentario FROM vybe_clima_respostas WHERE trimestre = ${trimestre}`);
  const resultado = calc.agregarClima(respostas);
  // Comentários só junto do resultado liberado, embaralhados e sem nada que ligue à pessoa.
  if (resultado.liberado) resultado.comentarios = respostas.map((r) => r.comentario).filter(Boolean).sort(() => Math.random() - .5);
  return { ...saida, prazos, perfis: perfis.map(({ ativo, ...p }) => p), pessoas: (await pessoasAtivas(sql, estado)).map(({ id, nome }) => ({ id, nome })),
    visao: { periodo, ...calc.indicadoresRh(quadro, periodo), semEntrada: quadro.filter((p) => !p.entrada).length },
    climaResultado: { trimestre, ...resultado } };
}

// ---------- projetos e carga ----------
// Tudo que um projeto com cliente gera de trabalho entra na esteira do Vybe OS (Paulo, 09/11): cada etapa ainda aberta
// e sem demanda vira uma demanda em "Solicitações de Demandas", pelo MESMO cadastro do painel, do planejamento e da
// captação (api/conteudo.js), com o cliente do projeto, o responsável da etapa e o fim da etapa como prazo. Daí em
// diante a demanda anda na esteira e o projeto lê a situação dela. Projeto interno (sem cliente) não gera demanda.
let criarPeca = null;
export function usarCriacaoDePeca(f) { criarPeca = f; } // só para os testes
const BOARD_SOLICITACOES = 8385559107;
async function etapasNaEsteira(tx, quem, projeto) {
  const abertas = await tx`SELECT id::text AS id, nome, responsavel::text AS responsavel, inicio::text AS inicio, fim::text AS fim
    FROM vybe_projeto_etapas WHERE projeto_id = ${projeto.id} AND conteudo_id IS NULL AND NOT feita ORDER BY ordem, id`;
  if (!abertas.length) return [];
  const criar = criarPeca || (await import('../api/conteudo.js')).criarConteudoNaTransacao;
  const criadas = [];
  for (const e of abertas) {
    const briefing = [`Projeto: ${projeto.nome} (${projeto.inicio} a ${projeto.fim})`, `Etapa: ${e.nome} (${e.inicio} a ${e.fim})`, projeto.descricao].filter(Boolean).join('\n');
    const r = await criar(tx, quem, { board: BOARD_SOLICITACOES, status: 'nova_demanda', titulo: `${projeto.nome} · ${e.nome}`.slice(0, 240),
      cliente: projeto.cliente, prazo: e.fim, briefing, responsaveis: [] });
    // O responsável vai pelo id da pessoa: o cadastro só liga pelo usuário do Monday, que nem todo mundo tem.
    if (e.responsavel) await tx`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem) VALUES (${r.conteudo_id}, ${e.responsavel}, 0) ON CONFLICT DO NOTHING`;
    await tx`UPDATE vybe_projeto_etapas SET conteudo_id = ${r.conteudo_id} WHERE id = ${e.id}`;
    criadas.push({ etapa_id: e.id, demanda_id: String(r.conteudo_id) });
  }
  return criadas;
}
async function projetos(sql, quem, query, estado) {
  const hoje = hojeBahia(), gestao = ehGestao(quem);
  const semana = calc.util.dataValida(String(query.semana || '')) ? calc.util.inicioDaSemana(String(query.semana)) : calc.util.inicioDaSemana(hoje);
  const fim = calc.util.somarDias(semana, 6);
  const [cfg, pessoas] = await Promise.all([config(sql, estado), pessoasAtivas(sql, estado)]);
  const lista = await ler(estado, sql`SELECT id::text AS id, nome, tipo, cliente, cliente_id::text AS cliente_id, descricao, inicio::text AS inicio, fim::text AS fim, status
    FROM vybe_projetos WHERE status <> 'cancelado' OR fim >= ${calc.util.somarDias(hoje, -30)}::date ORDER BY inicio, id`);
  // A etapa ligada a uma demanda mostra a situação dela na esteira e conta como feita quando a demanda chega ao fim.
  const etapas = await ler(estado, sql`SELECT e.id::text AS id, e.projeto_id::text AS projeto_id, e.nome, e.responsavel::text AS responsavel, p.nome AS responsavel_nome,
      e.inicio::text AS inicio, e.fim::text AS fim, e.esforco, (e.feita OR COALESCE(s.final, false)) AS feita, e.ordem,
      c.id::text AS demanda_id, s.rotulo AS demanda_status, c.prazo::text AS demanda_prazo, COALESCE(s.final, false) AS demanda_final
    FROM vybe_projeto_etapas e LEFT JOIN vybe_pessoas p ON p.id = e.responsavel
      LEFT JOIN vybe_conteudos c ON c.id = e.conteudo_id AND c.removido_em IS NULL
      LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    ORDER BY e.projeto_id, e.ordem, e.id`);
  const porProjeto = new Map();
  for (const e of etapas) (porProjeto.get(e.projeto_id) || porProjeto.set(e.projeto_id, []).get(e.projeto_id)).push(e);
  const comEtapas = lista.map((p) => ({ ...p, etapas: porProjeto.get(p.id) || [] }));
  const pecas = await sql`SELECT r.pessoa_id::text AS pessoa_id, LEAST(c.prazo, c.veiculacao)::text AS data
    FROM vybe_conteudos c JOIN vybe_conteudo_responsaveis r ON r.conteudo_id = c.id
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND NOT COALESCE(s.final,false) AND c.status_chave IS DISTINCT FROM 'segurar_post'
      AND LEAST(c.prazo, c.veiculacao) BETWEEN ${calc.util.somarDias(semana, -14)}::date AND ${fim}::date`;
  const ativos = comEtapas.filter((p) => !['concluido', 'cancelado'].includes(p.status));
  // Clientes ativos para a escolha do projeto (a mesma regra única: ativo e não marcado "não é cliente").
  const clientes = await Promise.resolve(sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE apagado_em IS NULL AND (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false)) ORDER BY nome`).catch(() => []);
  return { hoje, gestao, semana, fim, capacidade: cfg.capacidade, clientes, pessoas: pessoas.map(({ id, nome }) => ({ id, nome })),
    projetos: comEtapas, linha: calc.linhaDoTempo(comEtapas.filter((p) => p.status !== 'cancelado'), hoje),
    carga: calc.cargaDaSemana({ pessoas, pecas, etapas: ativos.flatMap((p) => p.etapas), inicio: semana, capacidade: cfg.capacidade }) };
}

// ---------- Academy ----------
async function academy(sql, quem, query, estado) {
  const gestao = ehGestao(quem), eu = String(quem.id);
  const trilhas = await ler(estado, sql`SELECT id::text AS id, nome, descricao, ordem FROM vybe_academy_trilhas ORDER BY ordem, id`);
  const aulas = await ler(estado, sql`SELECT id::text AS id, trilha_id::text AS trilha_id, titulo, tipo, link, minutos, ordem FROM vybe_academy_aulas ORDER BY trilha_id, ordem, id`);
  const atribuicoes = await ler(estado, gestao
    ? sql`SELECT a.trilha_id::text AS trilha_id, a.pessoa_id::text AS pessoa_id, p.nome, a.prazo::text AS prazo FROM vybe_academy_atribuicoes a JOIN vybe_pessoas p ON p.id = a.pessoa_id`
    : sql`SELECT a.trilha_id::text AS trilha_id, a.pessoa_id::text AS pessoa_id, a.prazo::text AS prazo FROM vybe_academy_atribuicoes a WHERE a.pessoa_id = ${eu}`);
  const progresso = await ler(estado, gestao
    ? sql`SELECT aula_id::text AS aula_id, pessoa_id::text AS pessoa_id FROM vybe_academy_progresso`
    : sql`SELECT aula_id::text AS aula_id, pessoa_id::text AS pessoa_id FROM vybe_academy_progresso WHERE pessoa_id = ${eu}`);
  const feitasDe = (pid) => progresso.filter((x) => x.pessoa_id === pid).map((x) => x.aula_id);
  const lista = trilhas.map((t) => {
    const minhas = aulas.filter((a) => a.trilha_id === t.id);
    return { ...t, aulas: minhas, minha: atribuicoes.some((a) => a.trilha_id === t.id && a.pessoa_id === eu),
      progresso: calc.progressoDaTrilha(minhas, feitasDe(eu)),
      ...(gestao ? { atribuidas: atribuicoes.filter((a) => a.trilha_id === t.id).map((a) => ({ ...a, progresso: calc.progressoDaTrilha(minhas, feitasDe(a.pessoa_id)) })) } : {}) };
  });
  return { gestao, trilhas: lista, feitas: feitasDe(eu), modelo: estado.provisionado === false ? calc.TRILHA_PADRAO : null,
    ...(gestao ? { pessoas: (await pessoasAtivas(sql, estado)).map(({ id, nome }) => ({ id, nome })) } : {}) };
}

// ---------- Recrutamento e Documentos (só gestão) ----------
async function recrutamento(sql, quem, query, estado) {
  const hoje = hojeBahia(), cfg = await config(sql, estado);
  const tipo = query.periodo === 'anual' ? 'anual' : 'mensal', ref = calc.util.mesValido(String(query.ref || '')) ? String(query.ref) : hoje.slice(0, 7);
  const periodo = calc.periodoDe(tipo, ref);
  const vagas = await ler(estado, sql`SELECT id::text AS id, titulo, cargo, descricao, status, aberta_em::text AS aberta_em, fechada_em::text AS fechada_em
    FROM vybe_rh_vagas ORDER BY (status = 'aberta') DESC, aberta_em DESC, id DESC`);
  const candidatos = await ler(estado, sql`SELECT id::text AS id, vaga_id::text AS vaga_id, nome, contato, etapa, observacao, criado_em::text AS criado_em, contratado_em::text AS contratado_em
    FROM vybe_rh_candidatos ORDER BY atualizado_em DESC, id DESC`);
  const atual = calc.tempoMedioContratacao(candidatos, periodo), antes = calc.tempoMedioContratacao(candidatos, periodo.antes);
  return { hoje, etapas: cfg.etapas, vagas, candidatos, periodo,
    indicadores: { abertas: vagas.filter((v) => v.status === 'aberta').length, candidatos: candidatos.length,
      tempoMedio: atual, tempoMedioAntes: antes, vs: calc.versus(atual.dias, antes.dias) } };
}
async function documentos(sql, quem, query, estado) {
  const hoje = hojeBahia();
  const lista = await ler(estado, sql`SELECT d.id::text AS id, d.pessoa_id::text AS pessoa_id, p.nome AS pessoa_nome, d.tipo, d.titulo, d.inicio::text AS inicio,
      d.renovacao::text AS renovacao, d.status, d.link, d.observacao FROM vybe_rh_documentos d JOIN vybe_pessoas p ON p.id = d.pessoa_id ORDER BY d.renovacao NULLS LAST, d.id`);
  const docs = lista.map((d) => ({ ...d, situacao: calc.situacaoDocumento(d, hoje) }));
  return { hoje, tipos: calc.TIPOS_DOCUMENTO, avisoDias: calc.AVISO_RENOVACAO_DIAS, documentos: docs,
    avisos: docs.filter((d) => ['vencido', 'renovar'].includes(d.situacao)).length,
    pessoas: (await pessoasAtivas(sql, estado)).map(({ id, nome }) => ({ id, nome })) };
}

// ---------- escrita ----------
async function pessoaAtiva(tx, id) {
  if (!(await tx`SELECT id FROM vybe_pessoas WHERE id = ${id} AND ativo AND pode_entrar`).length) falhar('Pessoa indisponível.');
}
async function escrever(sql, quem, b) {
  const acao = String(b.acao || ''), gestao = ehGestao(quem), eu = String(quem.id), hoje = hojeBahia();
  const soGestao = () => { if (!gestao) falhar('Só os donos e quem administra fazem isso.', 403); };
  switch (acao) {
    case 'pesos': {
      soGestao(); const erro = calc.validarPesos(b.pesos); if (erro) falhar(erro);
      const v = Object.fromEntries(calc.COMPONENTES.map(([k]) => [k, b.pesos[k]]));
      await sql.comTransacao((tx) => gravarConfig(tx, quem, 'pesos', v)); return { pesos: v };
    }
    case 'metas': {
      soGestao(); const erro = calc.validarMetas(b.metas); if (erro) falhar(erro);
      const v = Object.fromEntries(Object.keys(calc.CARGOS).map((k) => [k, b.metas[k]]));
      await sql.comTransacao((tx) => gravarConfig(tx, quem, 'metas', v)); return { metas: v };
    }
    case 'capacidade': {
      soGestao(); const n = b.semana; if (!Number.isInteger(n) || n < 1 || n > 200) falhar('Capacidade: de 1 a 200 itens por semana.');
      await sql.comTransacao((tx) => gravarConfig(tx, quem, 'capacidade', { semana: n })); return { capacidade: n };
    }
    case 'etapas_recrutamento': {
      soGestao(); const erro = calc.validarEtapas(b.etapas); if (erro) falhar(erro);
      const v = b.etapas.map((e) => e.trim());
      await sql.comTransacao((tx) => gravarConfig(tx, quem, 'etapas_recrutamento', v)); return { etapas: v };
    }
    case 'pedido_criar': {
      // Tipos do formulário (férias/folga, documento, reembolso, equipamento, outro); "folha" e
      // "beneficio" ficam só nos pedidos antigos.
      const tipo = umDe(b.tipo, calc.TIPOS_PEDIDO, 'Tipo'), titulo = texto(b.titulo, 200, 'Assunto', true), descricao = texto(b.descricao, 2000, 'Descrição');
      const inicio = data(b.inicio, 'Primeiro dia', tipo === 'ferias'), fim = data(b.fim, 'Último dia', tipo === 'ferias');
      if (inicio && fim && fim < inicio) falhar('O último dia vem depois do primeiro.');
      const desejada = tipo === 'ferias' ? null : data(b.data_desejada, 'Data desejada');
      const estadoRh = { provisionado: true }, prazo = calc.prazoSla(tipo, hoje, await prazosRh(sql, estadoRh));
      try {
        const [r] = await sql`INSERT INTO vybe_rh_pedidos (pessoa_id, tipo, titulo, descricao, inicio, fim, prazo, data_desejada)
          VALUES (${eu}, ${tipo}, ${titulo}, ${descricao}, ${inicio}::date, ${fim}::date, ${prazo}::date, ${desejada}::date) RETURNING id::text AS id, prazo::text AS prazo`;
        return r;
      } catch (e) {
        // Antes da migração de 08/11: sem a coluna da data desejada (vai na descrição) e sem o tipo reembolso.
        if (e?.code === '23514' && tipo === 'reembolso') falhar('Reembolso ' + AGUARDANDO_RH.charAt(0).toLowerCase() + AGUARDANDO_RH.slice(1), 503);
        if (e?.code !== '42703') throw e;
        if (tipo === 'reembolso') falhar(AGUARDANDO_RH, 503);
        const desc = desejada ? `${descricao}${descricao ? '\n' : ''}Data desejada: ${desejada.slice(8, 10)}/${desejada.slice(5, 7)}/${desejada.slice(0, 4)}`.slice(0, 2000) : descricao;
        const [r] = await sql`INSERT INTO vybe_rh_pedidos (pessoa_id, tipo, titulo, descricao, inicio, fim, prazo)
          VALUES (${eu}, ${tipo}, ${titulo}, ${desc}, ${inicio}::date, ${fim}::date, ${prazo}::date) RETURNING id::text AS id, prazo::text AS prazo`;
        return r;
      }
    }
    case 'pedido_status': {
      const id = idValido(b.id), status = umDe(b.status, Object.keys(calc.STATUS_RH), 'Status'), resposta = texto(b.resposta, 2000, 'Resposta');
      // Recusar pede o motivo: quem pediu precisa saber por quê.
      if (status === 'recusado' && !resposta) falhar('Escreva o motivo da recusa para quem pediu.');
      const respondeu = ['resolvido', 'recusado'].includes(status);
      // Hora da resposta (tempo médio): a coluna só existe depois da migração de 08/11.
      const comHora = respondeu && (await sql`SELECT 1 AS sim FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'vybe_rh_pedidos' AND column_name = 'respondido_em'`).length > 0;
      return sql.comTransacao(async (tx) => {
        const [p] = await tx`SELECT pessoa_id::text AS pessoa_id, status FROM vybe_rh_pedidos WHERE id = ${id} FOR UPDATE`;
        if (!p) falhar('Pedido não encontrado.', 404);
        const proprio = p.pessoa_id === eu;
        // Quem pediu só cancela o próprio pedido ainda aberto; o resto é da gestão.
        if (!gestao && !(proprio && status === 'cancelado' && p.status === 'aberto')) falhar('Só a gestão responde pedidos ao RH.', 403);
        if (calc.ENCERRADOS_RH.includes(p.status) && status !== p.status) falhar('Este pedido já foi encerrado.', 409);
        await tx`UPDATE vybe_rh_pedidos SET status = ${status}, resposta = CASE WHEN ${resposta} = '' THEN resposta ELSE ${resposta} END,
          respondido_por = ${gestao ? eu : null}, atualizado_em = now() WHERE id = ${id}`;
        if (comHora) await tx`UPDATE vybe_rh_pedidos SET respondido_em = COALESCE(respondido_em, now()) WHERE id = ${id}`;
        return { id, status };
      });
    }
    case 'prazos_rh': {
      soGestao(); const erro = calc.validarPrazos(b.prazos); if (erro) falhar(erro);
      const v = Object.fromEntries(calc.TIPOS_PEDIDO.map((k) => [k, b.prazos[k]]));
      try {
        await sql.comTransacao(async (tx) => {
          for (const [tipo, dias] of Object.entries(v)) await tx`INSERT INTO vybe_rh_prazos (tipo, dias_uteis, atualizado_por, atualizado_em) VALUES (${tipo}, ${dias}, ${eu}, now())
            ON CONFLICT (tipo) DO UPDATE SET dias_uteis = EXCLUDED.dias_uteis, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`;
        });
      } catch (e) { if (semTabela(e)) falhar(AGUARDANDO_RH, 503); throw e; }
      // Vale para os pedidos novos; quem já pediu mantém o prazo que recebeu.
      return { prazos: v };
    }
    case 'pesquisa_abrir': {
      soGestao();
      const p = { titulo: typeof b.titulo === 'string' ? b.titulo.trim() : b.titulo, abre: b.abre || hoje, fecha: b.fecha };
      const erro = calc.validarPesquisa(p, hoje); if (erro) falhar(erro);
      try {
        return await sql.comTransacao(async (tx) => {
          // Uma pesquisa por vez: se há outra aberta ou agendada, os donos encerram antes.
          const [outra] = await tx`SELECT id FROM vybe_clima_pesquisas WHERE encerrada_em IS NULL AND fecha >= ${hoje}::date LIMIT 1`;
          if (outra) falhar('Já existe uma pesquisa aberta ou agendada. Encerre a atual antes de abrir outra.', 409);
          const [r] = await tx`INSERT INTO vybe_clima_pesquisas (titulo, abre, fecha, criada_por) VALUES (${p.titulo}, ${p.abre}::date, ${p.fecha}::date, ${eu}) RETURNING id::text AS id`;
          return r;
        });
      } catch (e) { if (semTabela(e)) falhar(AGUARDANDO_RH, 503); throw e; }
    }
    case 'pesquisa_encerrar': {
      soGestao(); const id = idValido(b.id, 'Pesquisa');
      try {
        const [ok] = await sql`UPDATE vybe_clima_pesquisas SET encerrada_em = COALESCE(encerrada_em, now()) WHERE id = ${id} RETURNING id::text AS id`;
        if (!ok) falhar('Pesquisa não encontrada.', 404);
        return ok;
      } catch (e) { if (semTabela(e)) falhar(AGUARDANDO_RH, 503); throw e; }
    }
    case 'pesquisa_responder': {
      // Anônima: a resposta vai sem pessoa e sem hora; a participação (para não votar duas vezes)
      // vai sem a resposta e sem hora, em tabela separada.
      const id = idValido(b.pesquisa_id, 'Pesquisa');
      const r = { enps: b.enps, comentario: b.comentario ?? '', ...Object.fromEntries(DIMS_PESQUISA.map((k) => [k, b[k]])) };
      const erro = calc.validarResposta(r, calc.DIMENSOES_PESQUISA); if (erro) falhar(erro);
      const comentario = r.comentario.trim();
      try {
        await sql.comTransacao(async (tx) => {
          const [p] = await tx`SELECT abre::text AS abre, fecha::text AS fecha, encerrada_em FROM vybe_clima_pesquisas WHERE id = ${id}`;
          if (!p) falhar('Pesquisa não encontrada.', 404);
          if (calc.situacaoPesquisa(p, hoje) !== 'aberta') falhar('Esta pesquisa não está aberta para respostas.', 409);
          await tx`INSERT INTO vybe_clima_pesquisa_participacao (pesquisa_id, pessoa_id) VALUES (${id}, ${eu})`;
          await tx`INSERT INTO vybe_clima_pesquisa_respostas (pesquisa_id, enps, lideranca, comunicacao, reconhecimento, carga, ambiente, comentario)
            VALUES (${id}, ${r.enps}, ${r.lideranca}, ${r.comunicacao}, ${r.reconhecimento}, ${r.carga}, ${r.ambiente}, ${comentario})`;
        });
      } catch (e) {
        if (e?.code === '23505') falhar('Você já respondeu esta pesquisa. Obrigado!', 409);
        if (semTabela(e)) falhar(AGUARDANDO_RH, 503);
        throw e;
      }
      return { pesquisa_id: id };
    }
    case 'perfil': {
      const alvo = b.pessoa_id ? idValido(b.pessoa_id, 'Pessoa') : eu;
      if (alvo !== eu) soGestao();
      // Só muda o campo que veio no pedido (o formulário de aniversário não apaga a entrada).
      const mexeNasc = 'nascimento' in b, nascimento = data(b.nascimento, 'Nascimento');
      // Entrada e saída são do RH: só a gestão mexe (e só quando mandou o campo).
      const mexeDatas = gestao && ('entrada' in b || 'saida' in b);
      const entrada = mexeDatas ? data(b.entrada, 'Entrada') : null, saidaD = mexeDatas ? data(b.saida, 'Saída') : null;
      if (entrada && saidaD && saidaD < entrada) falhar('A saída vem depois da entrada.');
      return sql.comTransacao(async (tx) => {
        await pessoaAtiva(tx, alvo);
        await tx`INSERT INTO vybe_rh_perfil (pessoa_id, nascimento, entrada, saida) VALUES (${alvo}, ${nascimento}::date, ${entrada}::date, ${saidaD}::date)
          ON CONFLICT (pessoa_id) DO UPDATE SET nascimento = CASE WHEN ${mexeNasc} THEN EXCLUDED.nascimento ELSE vybe_rh_perfil.nascimento END,
            entrada = CASE WHEN ${mexeDatas} THEN EXCLUDED.entrada ELSE vybe_rh_perfil.entrada END,
            saida = CASE WHEN ${mexeDatas} THEN EXCLUDED.saida ELSE vybe_rh_perfil.saida END, atualizado_em = now()`;
        return { pessoa_id: alvo };
      });
    }
    case 'clima_responder': {
      const r = { enps: b.enps, comentario: b.comentario ?? '', ...Object.fromEntries(calc.DIMENSOES.map(([k]) => [k, b[k]])) };
      const erro = calc.validarResposta(r); if (erro) falhar(erro);
      const trimestre = calc.trimestreDe(hoje), comentario = r.comentario.trim();
      try {
        await sql.comTransacao(async (tx) => {
          await tx`INSERT INTO vybe_clima_participacao (trimestre, pessoa_id) VALUES (${trimestre}, ${eu})`;
          await tx`INSERT INTO vybe_clima_respostas (trimestre, enps, lideranca, ambiente, crescimento, processos, beneficios, comentario)
            VALUES (${trimestre}, ${r.enps}, ${r.lideranca}, ${r.ambiente}, ${r.crescimento}, ${r.processos}, ${r.beneficios}, ${comentario})`;
        });
      } catch (e) { if (e?.code === '23505') falhar('Você já respondeu a pesquisa deste trimestre. Obrigado!', 409); throw e; }
      return { trimestre };
    }
    case 'projeto_salvar': {
      soGestao();
      const id = idOuNulo(b.id, 'Projeto'), nome = texto(b.nome, 200, 'Nome do projeto', true);
      const tipo = umDe(b.tipo || 'outro', ['evento', 'lancamento', 'site', 'campanha', 'outro'], 'Tipo');
      const status = umDe(b.status || 'planejado', ['planejado', 'andamento', 'concluido', 'cancelado'], 'Status');
      const descricao = texto(b.descricao, 2000, 'Descrição');
      // Cliente pelo cadastro (auditoria 09/11): com cliente_id, o nome vem do cadastro ativo; sem ele, projeto interno.
      const clienteId = idOuNulo(b.cliente_id, 'Cliente');
      let cliente = clienteId ? '' : texto(b.cliente, 200, 'Cliente');
      if (clienteId) {
        const [c] = await sql`SELECT nome FROM vybe_clientes WHERE id = ${clienteId} AND apagado_em IS NULL AND (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false))`;
        if (!c) falhar('Escolha um cliente ativo da lista.');
        cliente = c.nome;
      }
      const inicio = data(b.inicio, 'Início', true), fim = data(b.fim, 'Fim', true);
      if (fim < inicio) falhar('O fim do projeto vem depois do início.');
      if (!Array.isArray(b.etapas) || b.etapas.length > 40) falhar('Até 40 etapas por projeto.');
      const etapas = b.etapas.map((e, i) => {
        const ini = data(e?.inicio, `Etapa ${i + 1}: início`, true), f = data(e?.fim, `Etapa ${i + 1}: fim`, true);
        if (f < ini) falhar(`Etapa ${i + 1}: o fim vem depois do início.`);
        const esforco = e.esforco == null ? 1 : e.esforco;
        if (![1, 2, 3].includes(esforco)) falhar(`Etapa ${i + 1}: esforço de 1 a 3.`);
        return { id: idOuNulo(e.id, 'Etapa'), nome: texto(e.nome, 200, `Etapa ${i + 1}: nome`, true), responsavel: idOuNulo(e.responsavel, 'Responsável'), inicio: ini, fim: f, esforco, feita: e.feita === true, ordem: i };
      });
      return sql.comTransacao(async (tx) => {
        for (const e of etapas) if (e.responsavel) await pessoaAtiva(tx, e.responsavel);
        let pid = id;
        if (pid) {
          const [ok] = await tx`UPDATE vybe_projetos SET nome=${nome}, tipo=${tipo}, status=${status}, cliente=${cliente}, cliente_id=${clienteId}, descricao=${descricao}, inicio=${inicio}::date, fim=${fim}::date, atualizado_em=now()
            WHERE id=${pid} RETURNING id`;
          if (!ok) falhar('Projeto não encontrado.', 404);
        } else {
          [{ id: pid }] = await tx`INSERT INTO vybe_projetos (nome, tipo, status, cliente, cliente_id, descricao, inicio, fim, criado_por)
            VALUES (${nome}, ${tipo}, ${status}, ${cliente}, ${clienteId}, ${descricao}, ${inicio}::date, ${fim}::date, ${eu}) RETURNING id::text AS id`;
        }
        const manter = etapas.filter((e) => e.id).map((e) => e.id);
        await tx`DELETE FROM vybe_projeto_etapas WHERE projeto_id = ${pid} AND NOT (id::text = ANY(${manter}::text[]))`;
        for (const e of etapas) {
          if (e.id) {
            const [ok] = await tx`UPDATE vybe_projeto_etapas SET nome=${e.nome}, responsavel=${e.responsavel}, inicio=${e.inicio}::date, fim=${e.fim}::date, esforco=${e.esforco}, feita=${e.feita}, ordem=${e.ordem}
              WHERE id=${e.id} AND projeto_id=${pid} RETURNING id`;
            if (!ok) falhar('Etapa não encontrada neste projeto.', 404);
          } else await tx`INSERT INTO vybe_projeto_etapas (projeto_id, nome, responsavel, inicio, fim, esforco, feita, ordem)
            VALUES (${pid}, ${e.nome}, ${e.responsavel}, ${e.inicio}::date, ${e.fim}::date, ${e.esforco}, ${e.feita}, ${e.ordem})`;
        }
        const demandas = clienteId && !['concluido', 'cancelado'].includes(status)
          ? await etapasNaEsteira(tx, { tipo: 'sessao', pessoa: quem }, { id: pid, nome, cliente, descricao, inicio, fim }) : [];
        return { id: String(pid), demandas };
      });
    }
    case 'etapa_feita': {
      const id = idValido(b.id, 'Etapa'), feita = b.feita === true;
      return sql.comTransacao(async (tx) => {
        const [e] = await tx`SELECT responsavel::text AS responsavel FROM vybe_projeto_etapas WHERE id = ${id} FOR UPDATE`;
        if (!e) falhar('Etapa não encontrada.', 404);
        if (!gestao && e.responsavel !== eu) falhar('Só o responsável pela etapa ou a gestão marcam como feita.', 403);
        await tx`UPDATE vybe_projeto_etapas SET feita = ${feita} WHERE id = ${id}`;
        return { id, feita };
      });
    }
    case 'trilha_salvar': {
      soGestao();
      const id = idOuNulo(b.id, 'Trilha'), nome = texto(b.nome, 200, 'Nome da trilha', true), descricao = texto(b.descricao, 2000, 'Descrição');
      if (!Array.isArray(b.aulas) || b.aulas.length > 60) falhar('Até 60 aulas por trilha.');
      const aulas = b.aulas.map((a, i) => {
        const minutos = a?.minutos == null ? 10 : a.minutos;
        if (!Number.isInteger(minutos) || minutos < 1 || minutos > 600) falhar(`Aula ${i + 1}: minutos de 1 a 600.`);
        return { id: idOuNulo(a.id, 'Aula'), titulo: texto(a.titulo, 200, `Aula ${i + 1}: título`, true), tipo: umDe(a.tipo || 'video', ['video', 'doc'], 'Tipo'), link: linkValido(a.link, `Aula ${i + 1}: link`), minutos, ordem: i + 1 };
      });
      return sql.comTransacao(async (tx) => {
        let tid = id;
        try {
          if (tid) { const [ok] = await tx`UPDATE vybe_academy_trilhas SET nome=${nome}, descricao=${descricao} WHERE id=${tid} RETURNING id`; if (!ok) falhar('Trilha não encontrada.', 404); }
          else [{ id: tid }] = await tx`INSERT INTO vybe_academy_trilhas (nome, descricao) VALUES (${nome}, ${descricao}) RETURNING id::text AS id`;
        } catch (e) { if (e?.code === '23505') falhar('Já existe uma trilha com esse nome.', 409); throw e; }
        const manter = aulas.filter((a) => a.id).map((a) => a.id);
        await tx`DELETE FROM vybe_academy_aulas WHERE trilha_id = ${tid} AND NOT (id::text = ANY(${manter}::text[]))`;
        for (const a of aulas) {
          if (a.id) {
            const [ok] = await tx`UPDATE vybe_academy_aulas SET titulo=${a.titulo}, tipo=${a.tipo}, link=${a.link}, minutos=${a.minutos}, ordem=${a.ordem} WHERE id=${a.id} AND trilha_id=${tid} RETURNING id`;
            if (!ok) falhar('Aula não encontrada nesta trilha.', 404);
          } else await tx`INSERT INTO vybe_academy_aulas (trilha_id, titulo, tipo, link, minutos, ordem) VALUES (${tid}, ${a.titulo}, ${a.tipo}, ${a.link}, ${a.minutos}, ${a.ordem})`;
        }
        return { id: String(tid) };
      });
    }
    case 'trilha_atribuir': {
      soGestao();
      const trilha = idValido(b.trilha_id, 'Trilha'), pessoa = idValido(b.pessoa_id, 'Pessoa'), prazo = data(b.prazo, 'Prazo');
      return sql.comTransacao(async (tx) => {
        await pessoaAtiva(tx, pessoa);
        if (!(await tx`SELECT id FROM vybe_academy_trilhas WHERE id = ${trilha}`).length) falhar('Trilha não encontrada.', 404);
        if (b.remover === true) await tx`DELETE FROM vybe_academy_atribuicoes WHERE trilha_id = ${trilha} AND pessoa_id = ${pessoa}`;
        else await tx`INSERT INTO vybe_academy_atribuicoes (trilha_id, pessoa_id, atribuido_por, prazo) VALUES (${trilha}, ${pessoa}, ${eu}, ${prazo}::date)
          ON CONFLICT (trilha_id, pessoa_id) DO UPDATE SET prazo = EXCLUDED.prazo`;
        return { trilha_id: trilha, pessoa_id: pessoa };
      });
    }
    case 'aula_feita': {
      // Cada um marca só as próprias aulas.
      const aula = idValido(b.aula_id, 'Aula');
      if (!(await sql`SELECT id FROM vybe_academy_aulas WHERE id = ${aula}`).length) falhar('Aula não encontrada.', 404);
      if (b.feita === false) await sql`DELETE FROM vybe_academy_progresso WHERE aula_id = ${aula} AND pessoa_id = ${eu}`;
      else await sql`INSERT INTO vybe_academy_progresso (aula_id, pessoa_id) VALUES (${aula}, ${eu}) ON CONFLICT DO NOTHING`;
      return { aula_id: aula, feita: b.feita !== false };
    }
    case 'vaga_salvar': {
      soGestao();
      const id = idOuNulo(b.id, 'Vaga'), titulo = texto(b.titulo, 200, 'Título da vaga', true), cargo = texto(b.cargo, 100, 'Cargo'), descricao = texto(b.descricao, 2000, 'Descrição');
      const status = umDe(b.status || 'aberta', ['aberta', 'pausada', 'fechada'], 'Status');
      if (id) {
        const [ok] = await sql`UPDATE vybe_rh_vagas SET titulo=${titulo}, cargo=${cargo}, descricao=${descricao}, status=${status},
          fechada_em = CASE WHEN ${status} = 'fechada' THEN COALESCE(fechada_em, ${hoje}::date) ELSE NULL END WHERE id=${id} RETURNING id::text AS id`;
        if (!ok) falhar('Vaga não encontrada.', 404); return ok;
      }
      const [r] = await sql`INSERT INTO vybe_rh_vagas (titulo, cargo, descricao, status, aberta_em, criado_por) VALUES (${titulo}, ${cargo}, ${descricao}, ${status}, ${hoje}::date, ${eu}) RETURNING id::text AS id`;
      return r;
    }
    case 'candidato_salvar':
    case 'candidato_mover': {
      soGestao();
      const cfg = await config(sql, {});
      const etapa = umDe(b.etapa, cfg.etapas, 'Etapa');
      // "Contratado" = etapa Aprovado/Contratado; sem ela, a penúltima (a última é a saída).
      const contratado = cfg.etapas.find((e) => /^(aprovad|contratad)/i.test(e)) || cfg.etapas[cfg.etapas.length - 2];
      const dataContratacao = etapa === contratado ? hoje : null;
      if (acao === 'candidato_mover') {
        const id = idValido(b.id, 'Candidato');
        const [ok] = await sql`UPDATE vybe_rh_candidatos SET etapa=${etapa}, contratado_em = CASE WHEN ${dataContratacao}::date IS NULL THEN NULL ELSE COALESCE(contratado_em, ${dataContratacao}::date) END,
          atualizado_em=now() WHERE id=${id} RETURNING id::text AS id`;
        if (!ok) falhar('Candidato não encontrado.', 404); return ok;
      }
      const id = idOuNulo(b.id, 'Candidato'), vaga = idValido(b.vaga_id, 'Vaga'), nome = texto(b.nome, 200, 'Nome', true), contato = texto(b.contato, 200, 'Contato'), observacao = texto(b.observacao, 2000, 'Observação');
      if (!(await sql`SELECT id FROM vybe_rh_vagas WHERE id = ${vaga}`).length) falhar('Vaga não encontrada.', 404);
      if (id) {
        const [ok] = await sql`UPDATE vybe_rh_candidatos SET vaga_id=${vaga}, nome=${nome}, contato=${contato}, observacao=${observacao}, etapa=${etapa},
          contratado_em = CASE WHEN ${dataContratacao}::date IS NULL THEN NULL ELSE COALESCE(contratado_em, ${dataContratacao}::date) END, atualizado_em=now() WHERE id=${id} RETURNING id::text AS id`;
        if (!ok) falhar('Candidato não encontrado.', 404); return ok;
      }
      const [r] = await sql`INSERT INTO vybe_rh_candidatos (vaga_id, nome, contato, observacao, etapa, criado_em, contratado_em)
        VALUES (${vaga}, ${nome}, ${contato}, ${observacao}, ${etapa}, ${hoje}::date, ${dataContratacao}::date) RETURNING id::text AS id`;
      return r;
    }
    case 'documento_salvar': {
      soGestao();
      const id = idOuNulo(b.id, 'Documento'), pessoa = idValido(b.pessoa_id, 'Pessoa'), tipo = umDe(b.tipo, Object.keys(calc.TIPOS_DOCUMENTO), 'Tipo');
      const titulo = texto(b.titulo, 200, 'Título', true), inicio = data(b.inicio, 'Início'), renovacao = data(b.renovacao, 'Renovação');
      const status = umDe(b.status || 'ativo', ['ativo', 'encerrado'], 'Status'), link = linkValido(b.link, 'Link'), observacao = texto(b.observacao, 2000, 'Observação');
      if (inicio && renovacao && renovacao < inicio) falhar('A renovação vem depois do início.');
      return sql.comTransacao(async (tx) => {
        await pessoaAtiva(tx, pessoa);
        if (id) {
          const [ok] = await tx`UPDATE vybe_rh_documentos SET pessoa_id=${pessoa}, tipo=${tipo}, titulo=${titulo}, inicio=${inicio}::date, renovacao=${renovacao}::date,
            status=${status}, link=${link}, observacao=${observacao}, atualizado_em=now() WHERE id=${id} RETURNING id::text AS id`;
          if (!ok) falhar('Documento não encontrado.', 404); return ok;
        }
        const [r] = await tx`INSERT INTO vybe_rh_documentos (pessoa_id, tipo, titulo, inicio, renovacao, status, link, observacao)
          VALUES (${pessoa}, ${tipo}, ${titulo}, ${inicio}::date, ${renovacao}::date, ${status}, ${link}, ${observacao}) RETURNING id::text AS id`;
        return r;
      });
    }
    default: falhar('Ação desconhecida.');
  }
}

const LEITURAS = { produtividade, rh, projetos, academy, recrutamento, documentos };
const SO_GESTAO = new Set(['recrutamento', 'documentos']);

export async function areaSetorPessoas(req, res, quem, sql) {
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar Pessoas.' });
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'Pessoas exige uma sessão pessoal.' });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  const pessoa = quem.pessoa, gestao = ehGestao(pessoa);
  try {
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...(await escrever(sql, pessoa, req.body || {})) });
    const aba = String(req.query?.aba || 'produtividade');
    const ler = LEITURAS[aba];
    if (!ler) return res.status(400).json({ error: 'Informe aba=' + Object.keys(LEITURAS).join('|') });
    if (SO_GESTAO.has(aba) && !gestao) return res.status(403).json({ error: 'Esta aba é só dos donos e de quem administra.' });
    const estado = { provisionado: true };
    const dados = await ler(sql, pessoa, req.query || {}, estado);
    return res.status(200).json({ ok: true, aba, eu: { id: String(pessoa.id), nome: pessoa.nome }, gestao, provisionado: estado.provisionado, ...dados });
  } catch (e) {
    if (semTabela(e)) return res.status(503).json({ error: 'O setor de Pessoas ainda não foi ligado no banco. Peça ao Paulo para aplicar a migração 2026-11-07-pessoas.sql.' });
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[pessoas]', e);
    return res.status(500).json({ error: 'Não foi possível acessar Pessoas. Tente novamente.' });
  }
}
