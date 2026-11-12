// server/financas-local.js — o financeiro lido do PRÓPRIO banco do Vybe OS (Paulo, 11/11/2026; fase 1 de abolir o Vybe Finanças).
//
// Entrega às contas (shared/financas-calculos.js) a mesma "base" que a ponte entrega (server/vybe-financas.js), só que
// tirada das tabelas do Vybe OS que o importador preencheu (scripts/financas-importar.mjs, migração
// 2026-11-11-financas-base.sql). Assim a tela e as contas não mudam: muda só de onde as linhas vêm.
//
// A chave: VYBE_FINANCAS_FONTE (Vercel). Vazia ou "ponte" = como sempre (lê o Supabase do Finanças). "local" = lê daqui.
// Voltar é apagar a variável ou pôr "ponte" (na Vercel a variável só vale depois de um Redeploy, sem mudar código).
//
// Quem vê (decidido aqui, além das rotas): dinheiro e salário só saem para os quatro donos (server/donos.js). Para
// qualquer outra pessoa a base vem sem lançamentos, sem equipe, sem assinaturas e com os valores zerados; ficam só os
// nomes dos clientes e os contratos sem valor, que a Carteira mostra para todos.
// Nesta fase só entram as linhas importadas (origem_financas_id): o que é lançado à mão no Vybe OS segue pelos
// caminhos de sempre (server/comercial.js) e nada do que vem daqui é editável.
import { ehDonoPessoa } from './donos.js';
import { ErroFinancas } from './vybe-financas.js';

export const VARIAVEL_FONTE = 'VYBE_FINANCAS_FONTE';
export const fonteFinancas = (env = process.env) => (String(env?.[VARIAVEL_FONTE] || '').trim().toLowerCase() === 'local' ? 'local' : 'ponte');
export const fonteLocal = (env = process.env) => fonteFinancas(env) === 'local';
export const MENSAGEM_SEM_IMPORTACAO = 'A chave VYBE_FINANCAS_FONTE está em "local", mas o histórico do Finanças ainda não foi importado para o Vybe OS (migração 2026-11-11-financas-base.sql e scripts/financas-importar.mjs). Volte a chave para "ponte".';
const semImportacao = () => new ErroFinancas('sem_importacao', MENSAGEM_SEM_IMPORTACAO);
const ehDia = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

// A base inteira, sem conferir quem pede: só para o importador e os testes. As rotas usam criarConectorLocal.
export async function lerBaseLocal(sql, { desde = null } = {}) {
  if (desde != null && !ehDia(desde)) throw new ErroFinancas('leitura', 'Data inválida.');
  const corte = desde || '0001-01-01';
  let rodadas;
  try { rodadas = await sql`SELECT count(*)::int AS n FROM vybe_financas_importacoes`; }
  catch (e) { if (e?.code === '42P01') throw semImportacao(); throw e; }
  if (!rodadas[0]?.n) throw semImportacao();
  const [clientes, receitas, despesas, transferencias, funcionarios, historico, assinaturas, contratos] = await Promise.all([
    sql`SELECT origem_financas_id::text AS id, nome AS name, cnpj, valor_mensal::float8 AS monthly_fee, dia_vencimento AS due_day, status_contrato AS contract_status
      FROM vybe_financas_clientes_origem ORDER BY nome, origem_financas_id`,
    // O mesmo recorte da ponte: o que vence ou foi pago desde o corte e tudo o que está pendente.
    sql`SELECT origem_financas_id::text AS id, descricao AS description, valor::float8 AS amount, 'INCOME' AS type, categoria AS category,
        to_char(vencimento, 'YYYY-MM-DD') AS date, to_char(recebido_em, 'YYYY-MM-DD') AS paid_date,
        CASE WHEN cancelado THEN 'CANCELLED' WHEN recebido_em IS NOT NULL THEN 'PAID' ELSE 'PENDING' END AS status, financas_cliente_id::text AS client_id, NULL::text AS employee_id
      FROM vybe_comercial_recebiveis WHERE origem_financas_id IS NOT NULL
        AND (vencimento >= ${corte}::date OR recebido_em >= ${corte}::date OR (NOT cancelado AND recebido_em IS NULL))`,
    sql`SELECT k.origem_financas_id::text AS id, k.descricao AS description, k.valor::float8 AS amount, 'EXPENSE' AS type, k.categoria AS category,
        to_char(k.vencimento, 'YYYY-MM-DD') AS date, to_char(k.pago_em, 'YYYY-MM-DD') AS paid_date,
        CASE WHEN k.cancelada THEN 'CANCELLED' WHEN k.pago_em IS NOT NULL THEN 'PAID' ELSE 'PENDING' END AS status, k.financas_cliente_id::text AS client_id,
        e.origem_financas_id::text AS employee_id
      FROM vybe_comercial_contas k LEFT JOIN vybe_financas_equipe e ON e.id = k.equipe_id WHERE k.origem_financas_id IS NOT NULL
        AND (k.vencimento >= ${corte}::date OR k.pago_em >= ${corte}::date OR (NOT k.cancelada AND k.pago_em IS NULL))`,
    sql`SELECT origem_financas_id::text AS id, descricao AS description, valor::float8 AS amount, 'TRANSFER' AS type, categoria AS category,
        to_char(data, 'YYYY-MM-DD') AS date, to_char(efetivada_em, 'YYYY-MM-DD') AS paid_date,
        CASE WHEN cancelada THEN 'CANCELLED' WHEN efetivada_em IS NOT NULL THEN 'PAID' ELSE 'PENDING' END AS status, NULL::text AS client_id, NULL::text AS employee_id
      FROM vybe_financas_transferencias WHERE origem_financas_id IS NOT NULL
        AND (data >= ${corte}::date OR efetivada_em >= ${corte}::date OR (NOT cancelada AND efetivada_em IS NULL))`,
    sql`SELECT COALESCE(origem_financas_id::text, 'vybe:' || id) AS id, nome AS name, cargo AS role, salario::float8 AS salary, bonus::float8 AS bonus, dia_pagamento AS payment_day
      FROM vybe_financas_equipe WHERE ativo ORDER BY nome, id`,
    sql`SELECT COALESCE(e.origem_financas_id::text, 'vybe:' || e.id) AS employee_id, h.vigente_desde AS effective_month, h.salario::float8 AS salary, h.bonus::float8 AS bonus
      FROM vybe_financas_equipe_historico h JOIN vybe_financas_equipe e ON e.id = h.equipe_id WHERE e.ativo ORDER BY h.vigente_desde, e.id`,
    sql`SELECT COALESCE(origem_financas_id::text, 'vybe:' || id) AS id, nome AS name, custo::float8 AS cost, dia_renovacao AS renewal_day, ativo AS active
      FROM vybe_financas_assinaturas ORDER BY nome, id`,
    sql`SELECT origem_financas_id::text AS id, financas_cliente_id::text AS client_id, titulo AS title, valor_mensal::float8 AS amount, status_origem AS status,
        to_char(inicio, 'YYYY-MM-DD') AS start_date, to_char(assinado_em, 'YYYY-MM-DD') AS signed_date, to_char(fim, 'YYYY-MM-DD') AS end_date, dia_vencimento AS due_day,
        (pdf_url <> '' OR pdf_nome <> '') AS tem_pdf
      FROM vybe_cliente_contratos WHERE origem_financas_id IS NOT NULL ORDER BY inicio DESC NULLS LAST, origem_financas_id`,
  ]);
  const transacoes = [...receitas, ...despesas, ...transferencias].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  return { clientes: [...clientes], transacoes, funcionarios: [...funcionarios], historico: [...historico], assinaturas: [...assinaturas], contratos: [...contratos] };
}

// O que sobra para quem não é dono: nenhum lançamento, nenhuma remuneração, nenhum valor.
export function semDinheiroNemSalario(base) {
  return { clientes: base.clientes.map((c) => ({ ...c, monthly_fee: 0 })), transacoes: [], funcionarios: [], historico: [], assinaturas: [],
    contratos: base.contratos.map((c) => ({ ...c, amount: 0 })) };
}

// A mesma interface do conector da ponte (configurado, lerBase), para as rotas trocarem de fonte sem saber qual é.
// `pessoa` é a da sessão: sem ela, ou sem ser um dos quatro donos, a base sai sem dinheiro nem salário.
export function criarConectorLocal(sql, { pessoa = null, env = process.env } = {}) {
  const dono = ehDonoPessoa(pessoa, env);
  return {
    local: true,
    dono,
    configurado: () => true,
    urlValida: () => true,
    faltando: () => [],
    async lerBase({ desde } = {}) { const base = await lerBaseLocal(sql, { desde }); return dono ? base : semDinheiroNemSalario(base); },
    limpar() {},
    async fechar() {},
  };
}
