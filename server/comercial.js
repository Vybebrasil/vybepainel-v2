// Comercial e finanças da agência (Paulo, 07/11/2026; inspirado no AgencyFlow). Evolui o CRM de prospecção
// (server/crm.js): o funil é o mesmo vybe_crm_oportunidades, com as fases do time e os motivos de perda do histórico.
// Contas em shared/comercial-calculos.js (funções puras, as mesmas da tela). Nada aqui envia mensagem nem cria schema:
// as tabelas vêm de migrations/2026-11-07-comercial.sql (aplicação manual).
//
// Quem vê (conferido aqui, nunca pela tela):
//  - Funil, pacotes (sem custo/margem), orçamentos e creators: toda sessão pessoal lê.
//  - Editar funil, orçamentos e creators: administração, donos e Atendimento (podeEditarCrm).
//  - Dinheiro da agência (finanças por cliente, custo e margem dos pacotes, recebimentos, contas a pagar,
//    inadimplência, fornecedores com BV) e editar pacotes: só os donos (Paulo, Vinícius, Ewerton, Deivid) e administração.
import calc from '../shared/comercial-calculos.js';
import { ehDono, podeEditarCrm, etapasCrm } from './crm.js';
import { configComercial, salvarMetas, gerarFormulario, desligarFormulario, ultimosLeads } from './comercial-leads.js';
import { lancamentosDoFinancas } from './vybe-financas-api.js';
import { ehDonoPessoa } from './donos.js';
import { fonteLocal } from './financas-local.js';

export const ABAS_COMERCIAL = ['funil', 'pacotes', 'orcamentos', 'financas', 'creators', 'recebimentos', 'contas', 'inadimplencia', 'fornecedores', 'caixa'];
export const ABAS_SO_DONOS = new Set(['financas', 'recebimentos', 'contas', 'inadimplencia', 'fornecedores', 'caixa']);
const ACOES_SO_DONOS = new Set(['pacote_salvar', 'financas_salvar', 'recebivel_salvar', 'recebivel_receber', 'recebivel_proximo', 'recebivel_cancelar',
  'conta_salvar', 'conta_pagar', 'conta_cancelar', 'fornecedor_salvar', 'fornecedor_arquivar', 'capacidade_salvar', 'etapas_salvar',
  'metas_salvar', 'formulario_gerar', 'formulario_desligar']);
const ACOES_COMERCIAL = new Set(['orcamento_criar', 'orcamento_status', 'creator_salvar', 'creator_arquivar']);
// O financeiro (Paulo, 11/11/2026): com a fonte no banco do Vybe OS (VYBE_FINANCAS_FONTE=local), estas abas e ações são
// só dos quatro donos; administração sem ser dono fica de fora. Pela ponte vale a regra de antes.
export const ABAS_FINANCEIRO = new Set(['financas', 'recebimentos', 'contas', 'inadimplencia', 'caixa']);
const ACOES_FINANCEIRO = new Set(['financas_salvar', 'recebivel_salvar', 'recebivel_receber', 'recebivel_proximo', 'recebivel_cancelar', 'conta_salvar', 'conta_pagar', 'conta_cancelar']);
const TABELA_DA_ACAO = { recebivel_salvar: 'recebiveis', recebivel_receber: 'recebiveis', recebivel_proximo: 'recebiveis', recebivel_cancelar: 'recebiveis',
  conta_salvar: 'contas', conta_pagar: 'contas', conta_cancelar: 'contas' };
// Linha que o importador trouxe do Finanças (origem_financas_id) é espelho: não se edita nem se dá baixa por aqui.
// to_jsonb deixa a consulta valer antes e depois da migração 2026-11-11-financas-base.sql.
async function ehImportado(sql, tabela, id) {
  const [l] = tabela === 'recebiveis'
    ? await sql`SELECT 1 AS sim FROM vybe_comercial_recebiveis r WHERE r.id=${id} AND (to_jsonb(r) ->> 'origem_financas_id') IS NOT NULL`
    : await sql`SELECT 1 AS sim FROM vybe_comercial_contas k WHERE k.id=${id} AND (to_jsonb(k) ->> 'origem_financas_id') IS NOT NULL`;
  return Boolean(l);
}

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const texto = (v, max, campo, obrigatorio = false) => {
  if (v != null && typeof v !== 'string') falhar(`${campo} inválido.`);
  const s = (v || '').trim(); if (s.length > max) falhar(`${campo}: máximo de ${max} caracteres.`);
  if (obrigatorio && !s) falhar(`Informe ${campo.toLowerCase()}.`); return s;
};
const idValido = (v, campo = 'ID') => { const s = String(v ?? ''); if (!/^[1-9]\d{0,15}$/.test(s)) falhar(`${campo} inválido.`); return s; };
const idOpcional = (v, campo) => (v == null || v === '' ? null : idValido(v, campo));
const numero = (v, { min = 0, max = 1e8, campo, inteiro = false, obrigatorio = false } = {}) => {
  if (v == null || v === '') { if (obrigatorio) falhar(`Informe ${campo.toLowerCase()}.`); return 0; }
  const n = Number(v); if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) falhar(`${campo} inválido.`);
  return inteiro ? n : Math.round(n * 100) / 100;
};
const data = (v, campo, obrigatorio = true) => {
  if (v == null || v === '') { if (obrigatorio) falhar(`Informe ${campo.toLowerCase()}.`); return null; }
  if (!calc.ehData(String(v))) falhar(`${campo} inválida.`); return String(v);
};
const umDe = (v, lista, campo) => { if (!lista.includes(v)) falhar(`${campo} inválido.`); return v; };
export const hojeNaBahia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);

export async function papeis(sql, pessoa) {
  const dono = ehDono(pessoa);
  return { dono, comercial: dono || await podeEditarCrm(sql, pessoa) };
}

// ---------- Leitura ----------
const SEM_CUSTO = ['horas', 'custo_hora', 'captacoes', 'custo_captacao', 'custo', 'margem', 'margem_percentual', 'zona_critica'];
async function pacotes(sql, dono) {
  const linhas = await sql`SELECT id::text, nome, tipo, preco::float8 AS preco, entregas, horas::float8 AS horas, custo_hora::float8 AS custo_hora,
    captacoes, custo_captacao::float8 AS custo_captacao, carga, ativo, versao::text FROM vybe_comercial_pacotes ORDER BY ativo DESC, nome`;
  return linhas.map((p) => { const c = calc.pacoteComMargem(p); if (!dono) for (const k of SEM_CUSTO) delete c[k]; return c; });
}
// Capacidade × vendas: capacidade por cargo + quem tem qual cargo (id do painel e id legado das demandas).
async function capacidade(sql) {
  const linhas = await sql`SELECT cargo, capacidade_mensal FROM vybe_comercial_capacidade`;
  let pessoas;
  try { pessoas = await sql`SELECT p.id::text, p.monday_user_id::text, f.funcao AS cargo FROM vybe_pessoas p JOIN vybe_escritorio_funcoes f ON f.pessoa_id=p.id WHERE p.ativo AND p.pode_entrar`; }
  catch (e) { if (e.code !== '42703') throw e; pessoas = await sql`SELECT p.id::text, f.funcao AS cargo FROM vybe_pessoas p JOIN vybe_escritorio_funcoes f ON f.pessoa_id=p.id WHERE p.ativo AND p.pode_entrar`; }
  return { capacidades: Object.fromEntries(linhas.map((l) => [l.cargo, l.capacidade_mensal])), pessoas, cargos: calc.CARGOS };
}
const capacidadeOuNada = (sql) => capacidade(sql).catch((e) => { if (e.code === '42P01') return null; throw e; });
// Dia de Irecê de um timestamp (o mês de um lead ou de um ganho é o do calendário daqui, não o do UTC).
const diaNaBahia = (v) => { if (v == null || v === '') return null; const d = v instanceof Date ? v : new Date(v); return Number.isFinite(d.getTime()) ? hojeNaBahia(d) : null; };
async function oportunidadesDoFunil(sql) {
  let comValor = true, linhas;
  // criado_em/encerrado_em, quem cadastrou e a origem (formulário) alimentam metas, corrida comercial e gráficos do mês.
  try {
    linhas = await sql`SELECT o.id::text, o.nome, o.etapa, o.versao::text, o.valor_mensal::float8 AS valor_mensal, o.valor_avulso::float8 AS valor_avulso,
      o.pacote_id::text, o.proxima_acao, to_char(o.proxima_acao_data,'YYYY-MM-DD') AS proxima_acao_data, p.nome AS responsavel_nome, o.aprovada_por::text,
      o.criado_em, o.encerrado_em, c.nome AS criado_por_nome, o.legado->>'origem' AS origem
      FROM vybe_crm_oportunidades o LEFT JOIN vybe_pessoas p ON p.id=o.responsavel LEFT JOIN vybe_pessoas c ON c.id=o.criado_por
      ORDER BY o.atualizado_em DESC, o.id DESC LIMIT 2000`;
  } catch (e) {
    if (e.code !== '42703') throw e; // sem as colunas novas: funil sem valor, ainda útil
    comValor = false;
    linhas = await sql`SELECT o.id::text, o.nome, o.etapa, o.versao::text, o.proxima_acao, to_char(o.proxima_acao_data,'YYYY-MM-DD') AS proxima_acao_data,
      p.nome AS responsavel_nome, o.aprovada_por::text, o.criado_em, o.encerrado_em, c.nome AS criado_por_nome, o.legado->>'origem' AS origem
      FROM vybe_crm_oportunidades o LEFT JOIN vybe_pessoas p ON p.id=o.responsavel LEFT JOIN vybe_pessoas c ON c.id=o.criado_por
      ORDER BY o.atualizado_em DESC, o.id DESC LIMIT 2000`;
  }
  for (const o of linhas) {
    o.criado_dia = diaNaBahia(o.criado_em); o.ganho_dia = o.etapa === 'ganho' ? diaNaBahia(o.encerrado_em) : null;
    delete o.criado_em; delete o.encerrado_em;
    if (o.origem !== 'formulario') o.origem = null;
  }
  const perdas = await sql`SELECT DISTINCT ON (oportunidade_id) oportunidade_id::text, de_etapa, detalhes FROM vybe_crm_historico
    WHERE tipo='etapa' AND para_etapa='perdido' ORDER BY oportunidade_id, id DESC`;
  const porId = new Map(perdas.map((h) => [h.oportunidade_id, h]));
  for (const o of linhas) if (o.etapa === 'perdido') {
    const h = porId.get(o.id); o.etapa_antes_perda = h?.de_etapa || null;
    o.motivo_perda = h?.detalhes?.motivo_perda || null; o.motivo_texto = h?.detalhes?.motivo_texto || '';
  }
  return { linhas, comValor };
}
// Entradas na etapa Proposta comercial (histórico do CRM) desde um dia: "propostas enviadas" do mês.
async function propostasDesde(sql, desde) {
  const linhas = await sql`SELECT oportunidade_id::text, quando FROM vybe_crm_historico
    WHERE tipo='etapa' AND para_etapa='proposta_comercial' AND quando >= (${desde}::date - interval '1 day') ORDER BY id`;
  return linhas.map((l) => ({ oportunidade_id: l.oportunidade_id, dia: diaNaBahia(l.quando) })).filter((l) => l.dia);
}
// Metas, KPIs do mês × anterior, corrida comercial e séries dos últimos 6 meses (shared/comercial-calculos.js).
async function mesComercial(sql, r, linhas, query, hoje) {
  const p = periodoDaConsulta(query, hoje);
  // Gráficos: os 6 meses que terminam no mês escolhido (no anual, em dezembro, ou no mês atual se for o ano corrente).
  const mesFinal = p.tipo === 'anual' ? (p.mes.slice(0, 4) === hoje.slice(0, 4) ? hoje.slice(0, 7) : p.mes.slice(0, 4) + '-12') : p.mes;
  const inicioSerie = calc.somarMeses(mesFinal + '-01', -5);
  const propostas = await propostasDesde(sql, [p.anterior.inicio, inicioSerie].sort()[0]);
  const config = await configComercial(sql, { dono: r.dono });
  const dados = { oportunidades: linhas, propostas };
  const kpis = calc.kpisComerciais(dados, p), metas = calc.metasDoPeriodo(config.metas, p);
  let leads = null;
  if (r.comercial) { try { leads = await ultimosLeads(sql); } catch (e) { if (!['42P01', '42703'].includes(e.code)) throw e; leads = []; } }
  const saida = { periodo: p, hoje, kpis, propostas, metas,
    progresso: calc.progressoMetas(metas, kpis.atual), ranking: calc.rankingFechamentos(linhas, p), series: calc.seriesMensais(dados, mesFinal, 6),
    config_disponivel: config.disponivel, aviso_config: config.aviso || '', formulario: config.formulario, leads_formulario: leads, valores: r.dono,
    metas_por_mes: config.metas };
  return r.dono ? saida : semDinheiro(saida);
}
// Quem não é dono vê as quantidades (leads, propostas, negócios) e a posição na corrida, sem os valores em reais.
function semDinheiro(m) {
  const tira = (o) => { const { mrr, avulso, total, ...resto } = o || {}; return resto; };
  return { ...m, metas_por_mes: undefined, kpis: { atual: tira(m.kpis.atual), anterior: tira(m.kpis.anterior), variacao: tira(m.kpis.variacao) },
    metas: { negocios: m.metas.negocios, leads: m.metas.leads, meses_com_meta: m.metas.meses_com_meta, definida: m.metas.definida },
    progresso: m.progresso.filter((x) => x.tipo !== 'dinheiro'), series: m.series.map(tira),
    ranking: { linhas: m.ranking.linhas.map(tira), sem_atribuicao: { quantidade: m.ranking.sem_atribuicao.quantidade } } };
}
async function lerFunil(sql, r, query = {}, hoje = hojeNaBahia()) {
  const { linhas, comValor } = await oportunidadesDoFunil(sql);
  const etapas = await etapasCrm(sql), fases = calc.montarFases(etapas);
  let lista = [];
  try { lista = await pacotes(sql, r.dono); } catch (e) { if (e.code !== '42P01') throw e; }
  return { etapas, fases, motivos: calc.MOTIVOS_PERDA, oportunidades: linhas, resumo: calc.resumoFunil(linhas, fases),
    produtos: calc.produtoCampeao(linhas, lista), pacotes: lista.filter((p) => p.ativo).map(({ id, nome, tipo, preco, carga }) => ({ id, nome, tipo, preco, carga })),
    valor_disponivel: comValor, capacidade: await capacidadeOuNada(sql), mes: await mesComercial(sql, r, linhas, query, hoje) };
}
async function lerOrcamentos(sql, query) {
  if (query.id) {
    const [o] = await sql`SELECT o.id::text, o.cliente_nome, o.oportunidade_id::text, o.itens, o.desconto_percentual::float8 AS desconto_percentual,
      to_char(o.validade,'YYYY-MM-DD') AS validade, o.observacoes, o.status, o.criado_em, p.nome AS criado_por_nome
      FROM vybe_comercial_orcamentos o LEFT JOIN vybe_pessoas p ON p.id=o.criado_por WHERE o.id=${idValido(query.id)}`;
    if (!o) falhar('Orçamento não encontrado.', 404);
    return { orcamento: { ...o, totais: calc.totalOrcamento(o) } };
  }
  const lista = await sql`SELECT o.id::text, o.cliente_nome, o.itens, o.desconto_percentual::float8 AS desconto_percentual,
    to_char(o.validade,'YYYY-MM-DD') AS validade, o.status, o.criado_em, p.nome AS criado_por_nome
    FROM vybe_comercial_orcamentos o LEFT JOIN vybe_pessoas p ON p.id=o.criado_por ORDER BY o.criado_em DESC, o.id DESC LIMIT 200`;
  // Oportunidades abertas do funil, para o orçamento nascer ligado a uma delas (auditoria 09/11, A2).
  const abertas = await Promise.resolve(sql`SELECT id::text, nome, etapa FROM vybe_crm_oportunidades WHERE etapa NOT IN ('ganho','perdido') ORDER BY nome LIMIT 500`).catch(() => []);
  return { orcamentos: lista.map((o) => ({ ...o, totais: calc.totalOrcamento(o) })), oportunidades: abertas, pacotes: (await pacotes(sql, false)).filter((p) => p.ativo), capacidade: await capacidade(sql) };
}
async function lerFinancas(sql, hoje = hojeNaBahia(), pessoa = null) {
  const linhas = await sql`SELECT c.id::text AS cliente_id, c.nome AS cliente_nome, f.valor_mensal::float8 AS valor_mensal, f.pacote_id::text,
    COALESCE(f.status_pagamento,'em_dia') AS status_pagamento, COALESCE(f.observacao,'') AS observacao, f.versao::text, f.atualizado_em,
    p.nome AS pacote_nome, p.horas::float8 AS horas, p.custo_hora::float8 AS custo_hora, p.captacoes, p.custo_captacao::float8 AS custo_captacao, p.preco::float8 AS pacote_preco
    FROM vybe_clientes c LEFT JOIN vybe_comercial_financas_cliente f ON f.cliente_id=c.id LEFT JOIN vybe_comercial_pacotes p ON p.id=f.pacote_id
    WHERE (COALESCE(c.ativo,true) AND NOT COALESCE(c.nao_e_cliente,false)) ORDER BY c.nome`;
  const entradas = linhas.map((l) => ({ ...l, pacote: l.pacote_id ? { horas: l.horas, custo_hora: l.custo_hora, captacoes: l.captacoes, custo_captacao: l.custo_captacao } : null }));
  // Com o Finanças ligado: a mensalidade dele quando o Vybe OS não tem valor, e o status de pagamento pelos lançamentos
  // vencidos dele (antes "Inadimplentes 0" convivia com R$ 41 mil em atraso na Visão geral).
  const fin = await doFinancas(sql, hoje, pessoa);
  if (fin) {
    const atraso = new Map(calc.inadimplencia(fin.recebiveis, hoje).clientes.filter((c) => c.cliente_id).map((c) => [String(c.cliente_id), c.atraso_mais_antigo]));
    for (const l of entradas) {
      const v = fin.porVybe[String(l.cliente_id)];
      if (!l.valor_mensal && v?.valor_mensal) l.valor_mensal = v.valor_mensal;
      if (atraso.has(String(l.cliente_id))) l.status_pagamento = atraso.get(String(l.cliente_id)) > 30 ? 'inadimplente' : 'atrasado';
    }
  }
  const clientes = entradas.map(({ horas, custo_hora, captacoes, custo_captacao, pacote, ...l }) =>
    ({ ...l, valor_mensal: l.valor_mensal || 0, ...calc.financasCliente({ valor_mensal: l.valor_mensal, pacote }) }));
  return { fonte: fin ? 'Vybe Finanças' : 'Vybe OS', clientes, resumo: calc.resumoFinancas(entradas.filter((l) => l.valor_mensal > 0)),
    pacotes: (await pacotes(sql, true)).filter((x) => x.ativo), zona_critica: calc.ZONA_CRITICA, status: calc.STATUS_PAGAMENTO };
}
const RECEBIVEIS = (sql) => sql`SELECT r.id::text, r.tipo, r.cliente_id::text, c.nome AS cliente_nome, r.descricao, r.categoria, r.ciclo,
  r.valor::float8 AS valor, r.valor_recebido::float8 AS valor_recebido, to_char(r.vencimento,'YYYY-MM-DD') AS vencimento,
  to_char(r.recebido_em,'YYYY-MM-DD') AS recebido_em, r.cancelado
  FROM vybe_comercial_recebiveis r LEFT JOIN vybe_clientes c ON c.id=r.cliente_id
  WHERE (to_jsonb(r) ->> 'origem_financas_id') IS NULL ORDER BY r.vencimento DESC, r.id DESC LIMIT 5000`;
const CONTAS = (sql) => sql`SELECT k.id::text, k.grupo, k.descricao, k.fornecedor_id::text, f.nome AS fornecedor_nome, k.valor::float8 AS valor,
  to_char(k.vencimento,'YYYY-MM-DD') AS vencimento, to_char(k.pago_em,'YYYY-MM-DD') AS pago_em, k.cancelada
  FROM vybe_comercial_contas k LEFT JOIN vybe_comercial_fornecedores f ON f.id=k.fornecedor_id
  WHERE (to_jsonb(k) ->> 'origem_financas_id') IS NULL ORDER BY k.vencimento DESC, k.id DESC LIMIT 5000`;
// As duas listas acima são só o que foi lançado à mão no Vybe OS: o que o importador trouxe do Finanças
// (origem_financas_id) chega pela fonte "local" (server/financas-local.js), como leitura, e nunca em dobro.
const dentro = (d, p) => d >= p.inicio && d <= p.fim;
// Com o Vybe Finanças ligado, ele é a fonte do dinheiro (Paulo, 08/11); falha ou desligado: as tabelas do Vybe OS.
async function doFinancas(sql, hoje, pessoa) { try { return await lancamentosDoFinancas(sql, { hoje, pessoa }); } catch { return null; } }
const ehDoFinancas = (id) => /^fin:/.test(String(id || ''));
function periodoDaConsulta(query, hoje) { return calc.periodo(query.mes || hoje.slice(0, 7), query.periodo === 'anual' ? 'anual' : 'mensal'); }
async function lerRecebimentos(sql, query, hoje, pessoa) {
  const fin = await doFinancas(sql, hoje, pessoa);
  const p = periodoDaConsulta(query, hoje), todos = fin ? fin.recebiveis : await RECEBIVEIS(sql);
  const clientes = await sql`SELECT id::text, nome FROM vybe_clientes WHERE (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false)) ORDER BY nome`;
  const lista = todos.filter((r) => dentro(r.vencimento, p)).map((r) => ({ ...r, ...calc.statusRecebivel(r, hoje) }));
  return { periodo: p, hoje, fonte: fin ? 'Vybe Finanças' : 'Vybe OS', resumo: calc.resumoRecebimentos(todos, p, hoje), recebiveis: lista, clientes, ciclos: Object.keys(calc.CICLOS) };
}
async function lerContas(sql, query, hoje, pessoa) {
  const fin = await doFinancas(sql, hoje, pessoa);
  const p = periodoDaConsulta(query, hoje), [todas, receb] = fin ? [fin.contas, fin.recebiveis] : await Promise.all([CONTAS(sql), RECEBIVEIS(sql)]);
  const rec = calc.resumoRecebimentos(receb, p, hoje);
  const fornecedores = await sql`SELECT id::text, nome FROM vybe_comercial_fornecedores WHERE ativo ORDER BY nome`;
  return { periodo: p, hoje, fonte: fin ? 'Vybe Finanças' : 'Vybe OS', faturamento: rec.atual.a_receber, faturamento_anterior: rec.anterior.a_receber,
    resumo: calc.resumoContas(todas, p, hoje, rec.atual.a_receber, rec.anterior.a_receber), contas: todas.filter((c) => dentro(c.vencimento, p)),
    grupos: calc.GRUPOS_CONTAS, fornecedores };
}
async function lerInadimplencia(sql, hoje, pessoa) {
  const fin = await doFinancas(sql, hoje, pessoa);
  const r = calc.inadimplencia(fin ? fin.recebiveis : await RECEBIVEIS(sql), hoje);
  // Junta o status de pagamento informado à mão em Finanças por cliente (não muda as faturas).
  const manuais = await sql`SELECT f.cliente_id::text, c.nome AS cliente_nome, f.status_pagamento FROM vybe_comercial_financas_cliente f
    JOIN vybe_clientes c ON c.id=f.cliente_id WHERE f.status_pagamento <> 'em_dia' ORDER BY c.nome`;
  return { hoje, fonte: fin ? 'Vybe Finanças' : 'Vybe OS', ...r, marcados_a_mao: manuais };
}
async function lerCaixa(sql, hoje, pessoa) {
  const fin = await doFinancas(sql, hoje, pessoa);
  const [receb, contas] = fin ? [fin.recebiveis, fin.contas] : await Promise.all([RECEBIVEIS(sql), CONTAS(sql)]);
  const recorrentes = receb.filter((r) => r.tipo === 'recorrente' && !r.cancelado), fixas = contas.filter((c) => ['fixa', 'folha'].includes(c.grupo) && !c.cancelada);
  // A tela recalcula com o risco de churn da Carteira (window.VybeCarteira), que só existe no navegador.
  return { hoje, previsao: calc.previsaoCaixa({ recebiveis: recorrentes, contas: fixas, hoje }), recebiveis: recorrentes, contas: fixas };
}
async function lerFornecedores(sql) {
  let lista;
  try {
    lista = await sql`SELECT id::text, nome, categoria, bv_percentual::float8 AS bv_percentual, contato, observacoes, ativo, cidade, uf, telefone
      FROM vybe_comercial_fornecedores ORDER BY ativo DESC, nome`;
  } catch (e) {
    if (e?.code !== '42703') throw e; // sem a cidade ainda (bloco 9 da migração)
    lista = await sql`SELECT id::text, nome, categoria, bv_percentual::float8 AS bv_percentual, contato, observacoes, ativo, '' AS cidade, '' AS uf, '' AS telefone
      FROM vybe_comercial_fornecedores ORDER BY ativo DESC, nome`;
  }
  // O que cada fornecedor está imprimindo agora (server/impressoes.js); sem o módulo ainda, a lista segue sem isso.
  const imp = await Promise.resolve(sql`SELECT fornecedor_id::text AS id, COUNT(*) FILTER (WHERE etapa NOT IN ('entregue','cancelado'))::int AS abertas,
      COUNT(*) FILTER (WHERE etapa NOT IN ('entregue','cancelado') AND previsao < (now() AT TIME ZONE 'America/Bahia')::date)::int AS atrasadas,
      COUNT(*) FILTER (WHERE etapa = 'entregue')::int AS entregues
    FROM vybe_impressoes WHERE fornecedor_id IS NOT NULL GROUP BY fornecedor_id`).catch(() => []);
  const porId = new Map(imp.map((x) => [x.id, x]));
  const vazio = { abertas: 0, atrasadas: 0, entregues: 0 };
  return { fornecedores: lista.map((f) => ({ ...f, impressoes: (({ id, ...r }) => r)(porId.get(f.id) || { id: null, ...vazio }) })), categorias: calc.CATEGORIAS_FORNECEDOR };
}
async function lerCreators(sql) {
  const lista = await sql`SELECT id::text, nome, arroba, seguidores, engajamento::float8 AS engajamento, nicho, cidade, contato, observacoes
    FROM vybe_comercial_creators WHERE ativo ORDER BY seguidores DESC, nome LIMIT 2000`;
  return { creators: lista, opcoes: calc.opcoesCreators(lista) };
}

export async function lerComercial(sql, pessoa, query = {}, { hoje = hojeNaBahia() } = {}) {
  const aba = query.aba || 'funil';
  if (!ABAS_COMERCIAL.includes(aba)) falhar('Aba desconhecida.');
  const r = await papeis(sql, pessoa);
  if (ABAS_SO_DONOS.has(aba) && !r.dono) falhar('Só os donos e a administração veem o dinheiro da agência.', 403);
  if (ABAS_FINANCEIRO.has(aba) && fonteLocal() && !ehDonoPessoa(pessoa)) falhar('O financeiro é só dos donos.', 403);
  const dados = aba === 'funil' ? await lerFunil(sql, r, query, hoje)
    : aba === 'pacotes' ? { pacotes: await pacotes(sql, r.dono), capacidade: await capacidade(sql), produtos: calc.produtoCampeao((await oportunidadesDoFunil(sql).catch((e) => { if (e.code === '42P01') return { linhas: [] }; throw e; })).linhas, await pacotes(sql, false)) }
    : aba === 'orcamentos' ? await lerOrcamentos(sql, query)
    : aba === 'financas' ? await lerFinancas(sql, hoje, pessoa)
    : aba === 'recebimentos' ? await lerRecebimentos(sql, query, hoje, pessoa)
    : aba === 'contas' ? await lerContas(sql, query, hoje, pessoa)
    : aba === 'inadimplencia' ? await lerInadimplencia(sql, hoje, pessoa)
    : aba === 'fornecedores' ? await lerFornecedores(sql)
    : aba === 'caixa' ? await lerCaixa(sql, hoje, pessoa)
    : await lerCreators(sql);
  return { aba, pode: { ver_dinheiro: r.dono, editar_comercial: r.comercial, editar_pacotes: r.dono }, ...dados };
}

// ---------- Escrita ----------
function dadosPacote(b) {
  const entregas = Array.isArray(b.entregas) ? b.entregas : String(b.entregas || '').split('\n');
  const lista = entregas.map((e) => texto(String(e ?? ''), 200, 'Entrega')).filter(Boolean);
  if (lista.length > 40) falhar('No máximo 40 entregas por pacote.');
  return { nome: texto(b.nome, 120, 'Nome', true), tipo: umDe(b.tipo, ['recorrente', 'avulso'], 'Tipo'), preco: numero(b.preco, { campo: 'Preço' }),
    entregas: JSON.stringify(lista), horas: numero(b.horas, { campo: 'Horas', max: 10000 }), custo_hora: numero(b.custo_hora, { campo: 'Custo por hora', max: 100000 }),
    captacoes: numero(b.captacoes, { campo: 'Captações', max: 1000, inteiro: true }), custo_captacao: numero(b.custo_captacao, { campo: 'Custo por captação', max: 1000000 }),
    carga: JSON.stringify(cargaValida(b.carga)), ativo: b.ativo !== false };
}
function cargaValida(c) {
  if (c == null || c === '') return {};
  if (typeof c !== 'object' || Array.isArray(c)) falhar('Carga do pacote inválida.');
  const ok = calc.CARGOS.map((x) => x.id), saida = {};
  for (const [k, v] of Object.entries(c)) { if (!ok.includes(k)) falhar('Cargo inválido na carga do pacote.'); const n = numero(v, { campo: 'Carga', max: 1000, inteiro: true }); if (n) saida[k] = n; }
  return saida;
}
async function salvarPacote(sql, quem, b) {
  const d = dadosPacote(b);
  if (!b.id) {
    const [p] = await sql`INSERT INTO vybe_comercial_pacotes (nome,tipo,preco,entregas,horas,custo_hora,captacoes,custo_captacao,carga,ativo,criado_por)
      VALUES (${d.nome},${d.tipo},${d.preco},${d.entregas}::jsonb,${d.horas},${d.custo_hora},${d.captacoes},${d.custo_captacao},${d.carga}::jsonb,${d.ativo},${quem.id}) RETURNING id::text`;
    return { id: p.id };
  }
  const [p] = await sql`UPDATE vybe_comercial_pacotes SET nome=${d.nome},tipo=${d.tipo},preco=${d.preco},entregas=${d.entregas}::jsonb,horas=${d.horas},
    custo_hora=${d.custo_hora},captacoes=${d.captacoes},custo_captacao=${d.custo_captacao},carga=${d.carga}::jsonb,ativo=${d.ativo},atualizado_em=now(),versao=versao+1
    WHERE id=${idValido(b.id)} AND versao::text=${String(b.versao)} RETURNING id::text`;
  if (!p) falhar('Pacote alterado por outra pessoa (ou não existe). Atualize antes de salvar.', 409);
  return { id: p.id };
}
async function criarOrcamento(sql, quem, b) {
  const validade = data(b.validade, 'Validade');
  const desconto = numero(b.desconto_percentual, { campo: 'Desconto', max: 100 }), observacoes = texto(b.observacoes, 4000, 'Observações');
  const oportunidade = idOpcional(b.oportunidade_id, 'Oportunidade');
  // Com a oportunidade escolhida, o cliente pode vir dela (o nome da empresa no funil).
  let cliente = texto(b.cliente_nome, 200, 'Cliente');
  if (!cliente && oportunidade) cliente = String((await sql`SELECT nome FROM vybe_crm_oportunidades WHERE id=${oportunidade}`)[0]?.nome || '').slice(0, 200);
  if (!cliente) falhar('Informe o cliente ou escolha a oportunidade do funil.');
  if (!Array.isArray(b.itens) || !b.itens.length || b.itens.length > 30) falhar('Escolha de 1 a 30 pacotes.');
  const ids = b.itens.map((i) => idValido(i?.pacote_id, 'Pacote'));
  const achados = await sql`SELECT id::text, nome, tipo, preco::float8 AS preco, entregas, carga FROM vybe_comercial_pacotes WHERE id = ANY(${ids}::bigint[]) AND ativo`;
  const itens = b.itens.map((i, n) => {
    const p = achados.find((x) => x.id === ids[n]); if (!p) falhar('Pacote não encontrado ou inativo.');
    return { pacote_id: p.id, nome: p.nome, tipo: p.tipo, preco: p.preco, entregas: p.entregas, carga: p.carga, quantidade: numero(i.quantidade ?? 1, { campo: 'Quantidade', min: 1, max: 100, inteiro: true }) };
  });
  if (oportunidade && !(await sql`SELECT id FROM vybe_crm_oportunidades WHERE id=${oportunidade}`).length) falhar('Oportunidade não encontrada.');
  const [o] = await sql`INSERT INTO vybe_comercial_orcamentos (cliente_nome,oportunidade_id,itens,desconto_percentual,validade,observacoes,criado_por)
    VALUES (${cliente},${oportunidade},${JSON.stringify(itens)}::jsonb,${desconto},${validade}::date,${observacoes},${quem.id}) RETURNING id::text`;
  return { id: o.id };
}
async function salvarFinancas(sql, quem, b) {
  const cliente = idValido(b.cliente_id, 'Cliente'), pacote = idOpcional(b.pacote_id, 'Pacote');
  const valor = numero(b.valor_mensal, { campo: 'Valor mensal' }), status = umDe(b.status_pagamento || 'em_dia', calc.STATUS_PAGAMENTO.map((s) => s.id), 'Status de pagamento');
  const obs = texto(b.observacao, 1000, 'Observação');
  if (!(await sql`SELECT id FROM vybe_clientes WHERE id=${cliente}`).length) falhar('Cliente não encontrado.', 404);
  if (pacote && !(await sql`SELECT id FROM vybe_comercial_pacotes WHERE id=${pacote}`).length) falhar('Pacote não encontrado.');
  const versao = b.versao == null || b.versao === '' ? null : String(b.versao);
  const [f] = versao == null
    ? await sql`INSERT INTO vybe_comercial_financas_cliente (cliente_id,valor_mensal,pacote_id,status_pagamento,observacao,atualizado_por)
        VALUES (${cliente},${valor},${pacote},${status},${obs},${quem.id}) ON CONFLICT (cliente_id) DO NOTHING RETURNING cliente_id::text`
    : await sql`UPDATE vybe_comercial_financas_cliente SET valor_mensal=${valor},pacote_id=${pacote},status_pagamento=${status},observacao=${obs},
        atualizado_por=${quem.id},atualizado_em=now(),versao=versao+1 WHERE cliente_id=${cliente} AND versao::text=${versao} RETURNING cliente_id::text`;
  if (!f) falhar('Finanças do cliente alteradas por outra pessoa. Atualize antes de salvar.', 409);
  return { cliente_id: f.cliente_id };
}
function dadosCreator(b) {
  return { nome: texto(b.nome, 120, 'Nome', true), arroba: texto(b.arroba, 60, '@').replace(/^@*/, '').replace(/\s+/g, ''),
    seguidores: numero(b.seguidores, { campo: 'Seguidores', max: 1e9, inteiro: true }), engajamento: numero(b.engajamento, { campo: 'Engajamento', max: 100 }),
    nicho: texto(b.nicho, 60, 'Nicho'), cidade: texto(b.cidade, 60, 'Cidade'), contato: texto(b.contato, 200, 'Contato'), observacoes: texto(b.observacoes, 2000, 'Observações') };
}
async function salvarCreator(sql, quem, b) {
  const d = dadosCreator(b);
  if (!b.id) {
    const [c] = await sql`INSERT INTO vybe_comercial_creators (nome,arroba,seguidores,engajamento,nicho,cidade,contato,observacoes,criado_por)
      VALUES (${d.nome},${d.arroba},${d.seguidores},${d.engajamento},${d.nicho},${d.cidade},${d.contato},${d.observacoes},${quem.id}) RETURNING id::text`;
    return { id: c.id };
  }
  const [c] = await sql`UPDATE vybe_comercial_creators SET nome=${d.nome},arroba=${d.arroba},seguidores=${d.seguidores},engajamento=${d.engajamento},nicho=${d.nicho},
    cidade=${d.cidade},contato=${d.contato},observacoes=${d.observacoes},atualizado_em=now() WHERE id=${idValido(b.id)} AND ativo RETURNING id::text`;
  if (!c) falhar('Creator não encontrado.', 404);
  return { id: c.id };
}
function dadosRecebivel(b) {
  const tipo = umDe(b.tipo, ['recorrente', 'pontual'], 'Tipo');
  const d = { tipo, cliente_id: idOpcional(b.cliente_id, 'Cliente'), descricao: texto(b.descricao, 200, 'Descrição'), categoria: texto(b.categoria, 60, 'Categoria'),
    ciclo: tipo === 'recorrente' ? umDe(b.ciclo, Object.keys(calc.CICLOS), 'Ciclo') : null,
    valor: numero(b.valor, { campo: 'Valor', min: 0.01, obrigatorio: true }), vencimento: data(b.vencimento, 'Vencimento') };
  if (tipo === 'recorrente' && !d.cliente_id) falhar('Recebível recorrente precisa do cliente.');
  if (tipo === 'pontual' && !d.descricao) falhar('Informe a descrição do recebimento pontual.');
  return d;
}
async function salvarRecebivel(sql, quem, b) {
  const d = dadosRecebivel(b);
  if (d.cliente_id && !(await sql`SELECT id FROM vybe_clientes WHERE id=${d.cliente_id}`).length) falhar('Cliente não encontrado.', 404);
  if (!b.id) {
    const [r] = await sql`INSERT INTO vybe_comercial_recebiveis (tipo,cliente_id,descricao,categoria,ciclo,valor,vencimento,criado_por)
      VALUES (${d.tipo},${d.cliente_id},${d.descricao},${d.categoria},${d.ciclo},${d.valor},${d.vencimento}::date,${quem.id}) RETURNING id::text`;
    return { id: r.id };
  }
  const [r] = await sql`UPDATE vybe_comercial_recebiveis SET tipo=${d.tipo},cliente_id=${d.cliente_id},descricao=${d.descricao},categoria=${d.categoria},ciclo=${d.ciclo},
    valor=${d.valor},vencimento=${d.vencimento}::date,atualizado_em=now() WHERE id=${idValido(b.id)} AND NOT cancelado RETURNING id::text`;
  if (!r) falhar('Recebível não encontrado.', 404);
  return { id: r.id };
}
async function receber(sql, b) {
  const id = idValido(b.id), valor = numero(b.valor_recebido, { campo: 'Valor recebido', obrigatorio: true }), quando = data(b.recebido_em, 'Data do recebimento');
  const [r] = await sql`UPDATE vybe_comercial_recebiveis SET valor_recebido=LEAST(${valor}::numeric, valor), recebido_em=${quando}::date, atualizado_em=now()
    WHERE id=${id} AND NOT cancelado RETURNING id::text`;
  if (!r) falhar('Recebível não encontrado.', 404);
  return { id: r.id };
}
async function proximoCiclo(sql, quem, b) {
  return sql.comTransacao(async (tx) => {
    const [r] = await tx`SELECT id, tipo, cliente_id, descricao, categoria, ciclo, valor, to_char(vencimento,'YYYY-MM-DD') AS vencimento
      FROM vybe_comercial_recebiveis WHERE id=${idValido(b.id)} AND NOT cancelado FOR UPDATE`;
    if (!r) falhar('Recebível não encontrado.', 404);
    if (r.tipo !== 'recorrente') falhar('Só o recorrente tem próximo ciclo.');
    const venc = calc.proximoVencimento(r.vencimento, r.ciclo);
    // Já lançado: não duplica a fatura do mesmo cliente e vencimento.
    const [ja] = await tx`SELECT id::text FROM vybe_comercial_recebiveis WHERE tipo='recorrente' AND cliente_id=${r.cliente_id} AND vencimento=${venc}::date AND NOT cancelado`;
    if (ja) return { id: ja.id, criado: false };
    const [n] = await tx`INSERT INTO vybe_comercial_recebiveis (tipo,cliente_id,descricao,categoria,ciclo,valor,vencimento,criado_por)
      VALUES ('recorrente',${r.cliente_id},${r.descricao},${r.categoria},${r.ciclo},${r.valor},${venc}::date,${quem.id}) RETURNING id::text`;
    return { id: n.id, criado: true, vencimento: venc };
  });
}
async function salvarConta(sql, quem, b) {
  const d = { grupo: umDe(b.grupo, calc.GRUPOS_CONTAS.map((g) => g.id), 'Grupo'), descricao: texto(b.descricao, 200, 'Descrição', true),
    fornecedor_id: idOpcional(b.fornecedor_id, 'Fornecedor'), valor: numero(b.valor, { campo: 'Valor', min: 0.01, obrigatorio: true }), vencimento: data(b.vencimento, 'Vencimento') };
  if (d.fornecedor_id && !(await sql`SELECT id FROM vybe_comercial_fornecedores WHERE id=${d.fornecedor_id}`).length) falhar('Fornecedor não encontrado.');
  if (!b.id) {
    const [c] = await sql`INSERT INTO vybe_comercial_contas (grupo,descricao,fornecedor_id,valor,vencimento,criado_por)
      VALUES (${d.grupo},${d.descricao},${d.fornecedor_id},${d.valor},${d.vencimento}::date,${quem.id}) RETURNING id::text`;
    return { id: c.id };
  }
  const [c] = await sql`UPDATE vybe_comercial_contas SET grupo=${d.grupo},descricao=${d.descricao},fornecedor_id=${d.fornecedor_id},valor=${d.valor},
    vencimento=${d.vencimento}::date,atualizado_em=now() WHERE id=${idValido(b.id)} AND NOT cancelada RETURNING id::text`;
  if (!c) falhar('Conta não encontrada.', 404);
  return { id: c.id };
}
async function salvarFornecedor(sql, quem, b) {
  const d = { nome: texto(b.nome, 120, 'Nome', true), categoria: umDe(b.categoria, calc.CATEGORIAS_FORNECEDOR.map((c) => c.id), 'Categoria'),
    bv: numero(b.bv_percentual, { campo: 'BV', max: 100 }), contato: texto(b.contato, 200, 'Contato'), observacoes: texto(b.observacoes, 2000, 'Observações'),
    // Banco de fornecedores por cidade e região (Paulo, 09/11).
    cidade: texto(b.cidade, 80, 'Cidade'), uf: texto(b.uf, 2, 'UF').toUpperCase(), telefone: texto(b.telefone, 40, 'Telefone') };
  if (d.uf && !/^[A-Z]{2}$/.test(d.uf)) falhar('UF: duas letras, como BA.');
  // Sem as colunas de cidade ainda (bloco 9 da migração), grava o resto e a cidade espera.
  const tentar = async (comCidade, semCidade) => { try { return await comCidade(); } catch (e) { if (e?.code !== '42703') throw e; return semCidade(); } };
  if (!b.id) {
    const [f] = await tentar(
      () => sql`INSERT INTO vybe_comercial_fornecedores (nome,categoria,bv_percentual,contato,observacoes,cidade,uf,telefone,criado_por)
        VALUES (${d.nome},${d.categoria},${d.bv},${d.contato},${d.observacoes},${d.cidade},${d.uf},${d.telefone},${quem.id}) RETURNING id::text`,
      () => sql`INSERT INTO vybe_comercial_fornecedores (nome,categoria,bv_percentual,contato,observacoes,criado_por)
        VALUES (${d.nome},${d.categoria},${d.bv},${d.contato},${d.observacoes},${quem.id}) RETURNING id::text`);
    return { id: f.id };
  }
  const fid = idValido(b.id);
  const [f] = await tentar(
    () => sql`UPDATE vybe_comercial_fornecedores SET nome=${d.nome},categoria=${d.categoria},bv_percentual=${d.bv},contato=${d.contato},
      observacoes=${d.observacoes},cidade=${d.cidade},uf=${d.uf},telefone=${d.telefone},atualizado_em=now() WHERE id=${fid} AND ativo RETURNING id::text`,
    () => sql`UPDATE vybe_comercial_fornecedores SET nome=${d.nome},categoria=${d.categoria},bv_percentual=${d.bv},contato=${d.contato},
      observacoes=${d.observacoes},atualizado_em=now() WHERE id=${fid} AND ativo RETURNING id::text`);
  if (!f) falhar('Fornecedor não encontrado.', 404);
  return { id: f.id };
}
// Funil configurável (donos): a ordem do meio do funil e etapas novas. As do SDR (início), Ganho e Perdido não mudam;
// as do padrão não saem; etapa nova com oportunidade dentro não pode ser tirada.
async function salvarEtapas(sql, quem, b) {
  if (!Array.isArray(b.etapas) || !b.etapas.length || b.etapas.length > 12) falhar('Envie de 1 a 12 etapas do meio do funil.');
  const atuais = await etapasCrm(sql), extrasAtuais = new Set(atuais.filter((e) => e.extra).map((e) => e.id)), usados = new Set();
  const lista = b.etapas.map((e) => {
    const id = String(e?.id || '');
    if (calc.ETAPAS_MEIO_PADRAO.includes(id)) { usados.add(id); return { id, nome: atuais.find((x) => x.id === id)?.nome || id, extra: false }; }
    const nome = texto(e?.nome, 60, 'Nome da etapa', true);
    if (id && extrasAtuais.has(id)) { usados.add(id); return { id, nome, extra: true }; }
    if (id) falhar('Etapa desconhecida.');
    const base = 'x_' + (nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'etapa');
    let novo = base, n = 2; while (usados.has(novo) || extrasAtuais.has(novo)) novo = base + '_' + n++;
    usados.add(novo); return { id: novo, nome, extra: true };
  });
  if (new Set(lista.map((e) => e.id)).size !== lista.length) falhar('Etapa repetida.');
  for (const id of calc.ETAPAS_MEIO_PADRAO) if (!usados.has(id)) falhar('As etapas do padrão não saem do funil (só mudam de ordem).');
  const tiradas = [...extrasAtuais].filter((id) => !usados.has(id));
  return sql.comTransacao(async (tx) => {
    if (tiradas.length) {
      const [ocupada] = await tx`SELECT etapa FROM vybe_crm_oportunidades WHERE etapa = ANY(${tiradas}::text[]) LIMIT 1`;
      if (ocupada) falhar('Há oportunidades nessa etapa. Mova-as antes de tirar a etapa do funil.', 409);
    }
    await tx`DELETE FROM vybe_crm_etapas_config`;
    for (const [i, e] of lista.entries()) await tx`INSERT INTO vybe_crm_etapas_config (etapa,nome,ordem,extra,atualizado_por) VALUES (${e.id},${e.nome},${i},${e.extra},${quem.id})`;
    return { etapas: lista };
  });
}
async function salvarCapacidade(sql, quem, b) {
  const c = b.capacidades; if (!c || typeof c !== 'object' || Array.isArray(c)) falhar('Capacidade inválida.');
  const ok = calc.CARGOS.map((x) => x.id), linhas = Object.entries(c).map(([cargo, v]) => {
    if (!ok.includes(cargo)) falhar('Cargo inválido.'); return [cargo, numero(v, { campo: 'Capacidade', max: 100000, inteiro: true })];
  });
  return sql.comTransacao(async (tx) => {
    for (const [cargo, n] of linhas) await tx`INSERT INTO vybe_comercial_capacidade (cargo,capacidade_mensal,atualizado_por) VALUES (${cargo},${n},${quem.id})
      ON CONFLICT (cargo) DO UPDATE SET capacidade_mensal=EXCLUDED.capacidade_mensal, atualizado_por=EXCLUDED.atualizado_por, atualizado_em=now()`;
    return { cargos: linhas.length };
  });
}
async function marcar(sql, consulta, id) { const [r] = await consulta; if (!r) falhar('Registro não encontrado.', 404); return { id: r.id }; }

export async function escreverComercial(sql, pessoa, b = {}, { hoje = hojeNaBahia() } = {}) {
  const acao = String(b.acao || '');
  if (!ACOES_SO_DONOS.has(acao) && !ACOES_COMERCIAL.has(acao)) falhar('Ação desconhecida.');
  const r = await papeis(sql, pessoa);
  if (ACOES_SO_DONOS.has(acao) && !r.dono) falhar('Só os donos e a administração mexem no dinheiro da agência.', 403);
  if (ACOES_COMERCIAL.has(acao) && !r.comercial) falhar('Só a administração, os donos e a equipe comercial editam aqui.', 403);
  // Lançamento que veio do Vybe Finanças (id "fin:…") só se mexe lá: aqui ele é leitura.
  if (ACOES_FINANCEIRO.has(acao) && fonteLocal() && !ehDonoPessoa(pessoa)) falhar('O financeiro é só dos donos.', 403);
  if (ehDoFinancas(b.id)) falhar('Este lançamento vem do Vybe Finanças: dê baixa ou edite lá. O Vybe OS só mostra.', 409);
  if (TABELA_DA_ACAO[acao] && b.id != null && b.id !== '' && await ehImportado(sql, TABELA_DA_ACAO[acao], idValido(b.id)))
    falhar('Este lançamento foi importado do Vybe Finanças: nesta fase ele é só leitura no Vybe OS.', 409);
  const id = () => idValido(b.id);
  switch (acao) {
    case 'pacote_salvar': return salvarPacote(sql, pessoa, b);
    case 'orcamento_criar': return criarOrcamento(sql, pessoa, b);
    case 'orcamento_status': return marcar(sql, sql`UPDATE vybe_comercial_orcamentos SET status=${umDe(b.status, ['rascunho', 'enviado', 'aceito', 'recusado'], 'Status')},atualizado_em=now() WHERE id=${id()} RETURNING id::text`);
    case 'financas_salvar': return salvarFinancas(sql, pessoa, b);
    case 'creator_salvar': return salvarCreator(sql, pessoa, b);
    case 'creator_arquivar': return marcar(sql, sql`UPDATE vybe_comercial_creators SET ativo=false,atualizado_em=now() WHERE id=${id()} RETURNING id::text`);
    case 'recebivel_salvar': return salvarRecebivel(sql, pessoa, b);
    case 'recebivel_receber': return receber(sql, b);
    case 'recebivel_proximo': return proximoCiclo(sql, pessoa, b);
    case 'recebivel_cancelar': return marcar(sql, sql`UPDATE vybe_comercial_recebiveis SET cancelado=true,atualizado_em=now() WHERE id=${id()} RETURNING id::text`);
    case 'conta_salvar': return salvarConta(sql, pessoa, b);
    case 'conta_pagar': return marcar(sql, sql`UPDATE vybe_comercial_contas SET pago_em=${data(b.pago_em || hoje, 'Data do pagamento')}::date,atualizado_em=now() WHERE id=${id()} AND NOT cancelada RETURNING id::text`);
    case 'conta_cancelar': return marcar(sql, sql`UPDATE vybe_comercial_contas SET cancelada=true,atualizado_em=now() WHERE id=${id()} RETURNING id::text`);
    case 'etapas_salvar': return salvarEtapas(sql, pessoa, b);
    case 'capacidade_salvar': return salvarCapacidade(sql, pessoa, b);
    case 'metas_salvar': return salvarMetas(sql, pessoa, b);
    case 'formulario_gerar': return gerarFormulario(sql, pessoa);
    case 'formulario_desligar': return desligarFormulario(sql, pessoa);
    case 'fornecedor_salvar': return salvarFornecedor(sql, pessoa, b);
    case 'fornecedor_arquivar': return marcar(sql, sql`UPDATE vybe_comercial_fornecedores SET ativo=false,atualizado_em=now() WHERE id=${id()} RETURNING id::text`);
  }
  return falhar('Ação desconhecida.');
}
