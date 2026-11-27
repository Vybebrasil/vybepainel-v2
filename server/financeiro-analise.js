// server/financeiro-analise.js — o que as análises do Finanças precisam além do extrato (Paulo, 26/11/2026), e a
// montagem delas (shared/financeiro-analises.js) para a tela: DRE, recorrente, margem por cliente, a receber por idade,
// orçamento, fechamento, histórico, projeção em três cenários, lote para conferir e os achados do Vorcaro.
//
// Fontes (todas só leitura; sem a tabela, a parte fica vazia e a tela diz o que falta):
//   contratos   vybe_cliente_contratos (todos os clientes, inclusive quem saiu: o MRR do histórico precisa deles), com o
//               dia do vencimento, o fim e o reajuste (colunas de 26/11/2026); a saída de vybe_cliente_churn vale como fim
//   peças       vybe_conteudos ligados ao cliente (vybe_conteudo_clientes), não removidos nem cancelados, pelo mês da veiculação
//   risco       vybe_carteira_saude_mensal, o último mês registrado (risco alto = o pessimista perde o cliente)
//   pipeline    vybe_crm_oportunidades abertas, ponderadas pela chance da etapa (o otimista)
//   cobranças   vybe_financeiro_avisos (o "cobrar" só registra e avisa os donos: o bot NÃO fala com cliente sobre dinheiro)
import X from '../shared/financeiro-extrato.js';
import A from '../shared/financeiro-analises.js';
import { avisosRecentes } from './campos-d3.js';

const semTabela = (e) => ['42P01', '42703', '42883', '22P02', '22007', '22008'].includes(e?.code);
const dia = (v) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : '');
const json = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } } return v ?? null; };
async function talvez(fazer, vazio) { try { return await fazer(); } catch (e) { if (!semTabela(e)) console.error('[financeiro-analise]', e?.message || e); return vazio; } }

// Chance de fechar por etapa do funil (Comercial). O que não está aqui (etapa nova) conta 30%.
export const CHANCE_DA_ETAPA = Object.freeze({ empresa: 0.05, qualificacao: 0.1, abordagem_proposta: 0.15, aprovada: 0.2, contato_feito: 0.25, reuniao: 0.4, proposta_comercial: 0.6 });

export async function contratosCompletos(sql) {
  return talvez(async () => {
    const linhas = await sql`SELECT to_jsonb(k) AS k, c.nome AS cliente_nome, COALESCE(c.ativo, true) AS ativo
      FROM vybe_cliente_contratos k JOIN vybe_clientes c ON c.id = k.cliente_id`;
    const saidas = await talvez(async () => sql`SELECT cliente_id::text AS cliente_id, max(saiu_em) AS saiu_em, max(receita_mensal)::float8 AS receita FROM vybe_cliente_churn GROUP BY cliente_id`, []);
    const saiu = new Map(saidas.map((s) => [String(s.cliente_id), dia(s.saiu_em)]));
    // Um por cliente: o lançado à mão no Vybe OS antes do importado do Finanças, o mais novo antes.
    const por = new Map();
    for (const l of linhas) {
      const k = json(l.k) || {};
      const id = String(k.cliente_id);
      const atual = por.get(id);
      const peso = (x) => [x.origem_financas_id ? 0 : 1, String(x.atualizado_em || '')];
      if (atual) { const [a1, a2] = peso(atual.k), [b1, b2] = peso(k); if (a1 > b1 || (a1 === b1 && a2 >= b2)) continue; }
      por.set(id, { k, nome: l.cliente_nome, ativo: l.ativo });
    }
    return [...por].map(([id, { k, nome, ativo }]) => {
      const encerrado = ['encerrado'].includes(String(k.status || '')) || !ativo;
      const fim = dia(k.fim) || saiu.get(id) || (encerrado ? dia(k.atualizado_em) : '');
      return { cliente_id: id, cliente_nome: nome, valor_mensal: Number(k.valor_mensal) || 0, inicio: dia(k.inicio), fim, renovacao: dia(k.renovacao), status: k.status || 'ativo',
        dia_vencimento: Number(k.dia_vencimento) || null, reajuste_em: dia(k.reajuste_em), reajuste_pct: k.reajuste_pct == null ? null : Number(k.reajuste_pct), ativo: Boolean(ativo) && !encerrado };
    }).sort((a, b) => a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR'));
  }, []);
}

export async function pecasPorClienteMes(sql) {
  return talvez(async () => (await sql`SELECT cc.cliente_id::text AS cliente_id, left(to_jsonb(c) ->> 'veiculacao', 7) AS mes, count(*)::int AS pecas
    FROM vybe_conteudos c JOIN vybe_conteudo_clientes cc ON cc.conteudo_id = c.id
    WHERE (to_jsonb(c) ->> 'removido_em') IS NULL AND COALESCE(to_jsonb(c) ->> 'status_chave', '') NOT ILIKE '%cancel%' AND (to_jsonb(c) ->> 'veiculacao') IS NOT NULL
    GROUP BY 1, 2`).filter((l) => /^\d{4}-\d{2}$/.test(String(l.mes || ''))), []);
}

export async function riscoAlto(sql) {
  return talvez(async () => (await sql`SELECT cliente_id::text AS cliente_id FROM vybe_carteira_saude_mensal WHERE risco = 'alto' AND mes = (SELECT max(mes) FROM vybe_carteira_saude_mensal)`).map((l) => String(l.cliente_id)), []);
}

export async function pipelineAberto(sql) {
  return talvez(async () => (await sql`SELECT to_jsonb(o) AS o FROM vybe_crm_oportunidades o`).map((l) => json(l.o) || {})
    .filter((o) => !['ganho', 'perdido'].includes(String(o.etapa || '')) && !o.apagado_em && !o.removido_em)
    .map((o) => ({ id: String(o.id), nome: String(o.empresa || o.nome || o.titulo || 'Oportunidade').slice(0, 80), etapa: String(o.etapa || ''), valor_mensal: Number(o.valor_mensal) || 0, valor_avulso: Number(o.valor_avulso) || 0,
      chance: CHANCE_DA_ETAPA[String(o.etapa || '')] ?? 0.3 }))
    .filter((o) => o.valor_mensal > 0 || o.valor_avulso > 0), []);
}

export async function dadosExtras(sql) {
  const [contratos, pecas, risco, pipeline, avisos] = await Promise.all([contratosCompletos(sql), pecasPorClienteMes(sql), riscoAlto(sql), pipelineAberto(sql),
    talvez(() => avisosRecentes(sql), { disponivel: false, lista: [], ultimo_por_cliente: {}, contagem_por_cliente: {} })]);
  return { contratos, pecas, risco, pipeline, avisos };
}

const ultimoDia = (mes) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
// Os meses "fechados" do extrato: os que o extrato cobre inteiros, antes do mês de hoje.
// fin3 (26/11/2026): em produção o extrato tinha 2 lançamentos no fim de julho e depois só de 17/08 em diante; a regra
// antiga olhava só o primeiro lançamento com saldo (17/08), marcava agosto como parcial e deixava julho, quase vazio,
// entrar na base (a média de cada cliente saía com um mês zerado). Agora um mês só é fechado se:
//   o começo está coberto: o primeiro lançamento do mês é até o dia 7, ou o extrato vinha do mês anterior sem buraco
//     (no máximo 10 dias entre o último lançamento de lá e o primeiro daqui); e
//   o fim está coberto: o último lançamento do mês é nos 7 últimos dias, ou o extrato segue no mês seguinte sem buraco.
// O mês de início do extrato, se pego pela metade, e o mês corrente ficam fora; o que vem antes do primeiro mês coberto
// também (não há como saber o que saiu). O mês do primeiro lançamento com saldo que começa depois do dia 5, sem o extrato
// vir colado do mês anterior, também é parcial (a regra de antes, que já pegava agosto).
// meses = a base (os fechados; sem nenhum fechado, os parciais, e a confiança diz quantos meses); fechados; parciais = os
// que têm lançamento, antes de hoje, e não fecham; completos = os que têm o fim coberto (o MRR "com o extrato" e os
// meses sem fechar usam estes, como antes).
const BURACO = 10, PERTO = 7;
export function mesesDaBase(lista, hoje) {
  const datas = lista.map((t) => t.banco.data).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort();
  const doBanco = lista.filter((t) => t.banco.saldo != null).map((t) => t.banco.data).sort();
  const meses = X.mesesDa(lista).filter((m) => m < hoje.slice(0, 7));
  const porMes = new Map();
  for (const d of datas) { const m = d.slice(0, 7), x = porMes.get(m); if (x) x.ult = d; else porMes.set(m, { pri: d, ult: d }); }
  const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  const primeiroSaldo = doBanco[0] || '';
  const cobre = (m) => {
    const x = porMes.get(m);
    if (!x) return { comeco: false, fim: false };
    const ant = porMes.get(X.somarMeses(m, -1)), prox = porMes.get(X.somarMeses(m, 1));
    let comeco = Number(x.pri.slice(8, 10)) <= PERTO || Boolean(ant && dias(ant.ult, x.pri) <= BURACO);
    if (primeiroSaldo && primeiroSaldo.slice(0, 7) === m && primeiroSaldo.slice(8, 10) > '05' && !(ant && dias(ant.ult, primeiroSaldo) <= BURACO)) comeco = false;
    const fim = Number(x.ult.slice(8, 10)) > ultimoDia(m) - PERTO || Boolean(prox && dias(x.ult, prox.pri) <= BURACO);
    return { comeco, fim };
  };
  const c = new Map(meses.map((m) => [m, cobre(m)]));
  const fechados = meses.filter((m) => c.get(m).comeco && c.get(m).fim);
  const parciais = meses.filter((m) => !fechados.includes(m));
  const completos = meses.filter((m) => c.get(m).fim);
  return { meses: fechados.length ? fechados : parciais, fechados, completos, parciais };
}

// Tudo o que as abas Análise, Projeção e Fechamento mostram, a partir do que montar() já tem.
// clientes_ativos: [{ cliente_id, cliente_nome }] (vybe_clientes ativos): a receita da base e a cobertura de contratos (fin2).
export function montarAnalise(base, extras, { hoje, saldo_hoje = 0, fixos_analise = null, cartao = null, por_cliente = null, serie = [], clientes_ativos = null, pessoas = null, ligar = null }) {
  const lista = base.extrato.transacoes;
  const todosMeses = X.mesesDa(lista);
  const { meses: mesesBase, completos, parciais } = mesesDaBase(lista, hoje);
  const contratos = extras.contratos || [];
  const ativos = contratos.filter((c) => c.ativo && c.valor_mensal > 0);
  const nomes = Object.fromEntries([...(clientes_ativos || []).map((c) => [String(c.cliente_id), c.cliente_nome]), ...contratos.map((c) => [c.cliente_id, c.cliente_nome])]);
  // A projeção primeiro (fin2): a receita da base dela (contrato, senão a média do extrato) alimenta o MRR estimado, a
  // cobertura, a confiança e o equilíbrio. Sem contrato cadastrado nada vira "perdido" nem zero.
  const atraso = A.atrasoMedioPago(lista, ativos);
  const projecao = A.projecao3({ hoje, saldo_hoje, lista, meses_base: mesesBase, contratos: ativos, clientes_ativos, fixos: base.fixos, salarios: base.salarios, pessoas: pessoas || [], ligar, itensCartao: base.cartao, risco: extras.risco || [],
    pipeline: extras.pipeline || [], atraso_medio: atraso ?? 10, horizonte: 12 });
  const conf = projecao.confianca;
  const mesesAnalise = todosMeses.length ? A.mesesEntre(todosMeses[0], hoje.slice(0, 7) > todosMeses[todosMeses.length - 1] ? todosMeses[todosMeses.length - 1] : hoje.slice(0, 7)) : [];
  const dreC = A.dre(lista, { meses: mesesAnalise, base: 'competencia', itensCartao: base.cartao });
  const dreX = A.dre(lista, { meses: mesesAnalise, base: 'caixa' });
  // MRR: do primeiro contrato (até 14 meses antes de hoje) até hoje.
  const ini = A.mesesEntre(X.somarMeses(hoje.slice(0, 7), -13), hoje.slice(0, 7));
  // O que entrou de quem não tem contrato, nos meses fechados do extrato (a linha "com o extrato" do MRR).
  const foraDeContrato = A.entradasForaDeContrato(lista, completos, ativos);
  const semContrato = Object.fromEntries(completos.map((m, i) => [m, foraDeContrato[i]]));
  const rec = A.recorrente(contratos, ini, { hoje, estimado: projecao.receita_base, semContratoPorMes: semContrato });
  const margem = A.margemClientes(lista, { meses: mesesAnalise, pecas: extras.pecas || [], nomes, itensCartao: base.cartao });
  const porCli = por_cliente?.linhas || [];
  const ag = A.aging(porCli, contratos, { hoje, semCliente: A.semClientePorMes(lista) });
  const cobrados = new Set(Object.values(extras.avisos?.ultimo_por_cliente || {}).filter((a) => a.cliente_id).map((a) => String(a.cliente_id)));
  for (const i of ag.itens) { const a = extras.avisos?.ultimo_por_cliente?.['id:' + i.cliente_id]; i.cobrado_em = a?.em || ''; i.cobrado_por = a?.quem_nome || ''; }
  const mesHoje = hoje.slice(0, 7);
  const orcamento = base.orcamento || {};
  const orc = A.orcadoReal(orcamento, lista, mesHoje);
  const orcMeses = [...new Set([...Object.keys(orcamento), ...todosMeses.slice(-6), mesHoje])].sort().slice(-7).map((m) => A.orcadoReal(orcamento, lista, m));
  const fechamentos = base.fechamentos || {};
  const fechados = new Set(Object.entries(fechamentos).filter(([, f]) => f?.situacao === 'fechado').map(([m]) => m));
  const checklists = todosMeses.filter((m) => m < mesHoje).map((m) => ({ ...A.checklistFechamento({ lista, mes: m, faturas: cartao?.faturas || [], pagamentosSemFatura: cartao?.pagamentos_sem_fatura || [], aging: ag, cobrados }),
    fechado: fechados.has(m), registro: fechamentos[m] || null }));
  const hist = A.historico(serie);
  const fixosMes = projecao.premissas.fixos, comb = projecao.premissas.combinados;
  // O equilíbrio e a meta de MRR pelo MRR estimado (contratos + quem paga todo mês sem contrato); o de contrato vai junto.
  const eq = { ...A.equilibrio({ mrr: rec.mrr_estimado, fixos: fixosMes, combinados: comb, variaveis: projecao.premissas.variaveis_base }), mrr_contrato: rec.mrr, estimado: rec.mrr_estimado !== rec.mrr };
  const receitaPorCliente = margem.linhas.map((l) => [l.cliente_nome, l.receita]);
  const metas = A.metas(base.metas || {}, { mrr: rec.mrr_estimado, margem_pct: dreC.margem_total, menor_saldo: projecao.base.menor_saldo });
  const parado = A.extratoParado(lista, hoje);
  const saidaMedia = mesesBase.length ? mesesBase.reduce((s, m) => s + X.resumo(lista, { mes: m }).saidas, 0) / mesesBase.length : 0;
  const achados = A.achados({ hoje, mrr: rec, margem, receitaPorCliente, projecao, orcamento: orc, fechados, mesesExtrato: completos, parado, saidaMediaMes: saidaMedia,
    valorAbertos: 0 });
  return {
    confianca: conf, meses_base: mesesBase, meses_parciais: parciais, meses: mesesAnalise,
    extrato_parado: parado, contratos, clientes_ativos: clientes_ativos || null, dre: { competencia: dreC, caixa: dreX }, recorrente: rec, margem, aging: ag,
    orcamento: { atual: orc, meses: orcMeses, guardado: orcamento, sugestao: A.sugerirOrcamento(lista, mesesBase.slice(-3)), grupos: A.GRUPOS_ORCAMENTO },
    fechamento: { meses: checklists, fechados: [...fechados] }, historico: hist, projecao, equilibrio: eq, metas, metas_guardadas: base.metas || {},
    atraso_medio_dias: atraso, pipeline: extras.pipeline || [], risco: extras.risco || [], cobrancas: (extras.avisos?.lista || []).slice(0, 30),
    lote: A.lote(lista, { ligar }), repetidas: A.repetidas(lista, base.fixos), achados,
    fixos_mes: fixos_analise ? fixos_analise.total_previsto ?? null : null,
  };
}
