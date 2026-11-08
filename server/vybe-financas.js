// server/vybe-financas.js — leitura do Vybe Finanças (Postgres do Supabase do repositório Vybebrasil/vybe-financas),
// SÓ LEITURA. Paulo, 08/11/2026: o dinheiro da agência mora no Finanças; o Vybe OS só lê e mostra (Comercial, Carteira, RH).
//
// Conexão: uma variável, VYBE_FINANCAS_DB_URL (Vercel, Production) = string do pooler do Supabase em modo transação
// (porta 6543) com o papel vybe_os_leitura, que só tem SELECT nas tabelas abaixo e uma política de RLS que mostra só as
// linhas do dono da Vybe (docs/vybe-financas-acesso-leitura.sql; passo a passo em docs/vybe-financas.md).
// Sem a variável: configurado() = false e a área responde { conectado: false, motivo: 'Conectar o Vybe Finanças' }.
//
// Como lê:
//  - pacote postgres (porsager), prepare:false (pooler em modo transação), 1 conexão, ssl obrigatório;
//  - cada leitura numa transação BEGIN READ ONLY com statement_timeout de 6 s, só SELECT;
//  - as colunas que vieram de migrações mais novas do Finanças (paid_date, employee_id, bonus, signed_date, pdf_*,
//    a tabela de histórico de remuneração e a de contratos) são conferidas no information_schema antes;
//  - cache em memória por consulta (3 min; falha fica 30 s para não travar cada tela);
//  - erro nunca leva a URL, a senha nem a mensagem crua do Postgres: só uma frase em português e um código.
// Nada aqui grava no Finanças nem no banco do Vybe OS.
import postgres from 'postgres';

export const VARIAVEL = 'VYBE_FINANCAS_DB_URL';
export const MOTIVO_DESCONECTADO = 'Conectar o Vybe Finanças';
export const TABELAS = Object.freeze(['clients', 'transactions', 'employees', 'employee_compensation_history', 'subscriptions', 'contracts']);
const LIMITE_LINHAS = 50000;

export class ErroFinancas extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.name = 'ErroFinancas'; this.codigo = codigo; }
}
const MENSAGENS = {
  tempo: 'O Vybe Finanças demorou para responder. Tente de novo em instantes.',
  login: 'O Vybe OS não conseguiu entrar no banco do Vybe Finanças: confira usuário e senha em VYBE_FINANCAS_DB_URL na Vercel.',
  permissao: 'O papel de leitura do Vybe OS não tem acesso a alguma tabela do Finanças: rode de novo o SQL de acesso (docs/vybe-financas-acesso-leitura.sql).',
  leitura: 'O Vybe Finanças não respondeu a leitura agora. Tente de novo em instantes.',
  rede: 'Não deu para falar com o banco do Vybe Finanças agora (rede). Tente de novo em instantes.',
};
const erro = (codigo) => new ErroFinancas(codigo, MENSAGENS[codigo] || MENSAGENS.leitura);
// Erro do Postgres/rede → código seguro (a mensagem original nunca sai daqui).
export function traduzirErro(e) {
  if (e instanceof ErroFinancas) return e;
  const c = String(e?.code || '');
  if (['28P01', '28000', '3D000'].includes(c)) return erro('login');
  if (c === '42501') return erro('permissao');
  if (['57014', 'CONNECT_TIMEOUT'].includes(c)) return erro('tempo');
  if (['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED'].includes(c)) return erro('rede');
  return erro('leitura');
}

export const urlValida = (url) => /^postgres(ql)?:\/\/[^\s]+$/.test(String(url || ''));
export const OPCOES_CONEXAO = Object.freeze({ prepare: false, max: 1, idle_timeout: 20, connect_timeout: 6, ssl: 'require' });

// As consultas. `tem` = colunas que existem (information_schema), por tabela: { transactions: Set([...]) }.
// Datas saem como texto AAAA-MM-DD (o `date` das transações é timestamptz: dia em UTC, como o Finanças faz com o ISO).
const CONSULTAS = {
  clients: (tx) => tx`SELECT id::text, name, COALESCE(cnpj, '') AS cnpj, COALESCE(monthly_fee, 0)::float8 AS monthly_fee, due_day, contract_status
    FROM clients ORDER BY name`,
  transactions: (tx, tem, desde) => (tem.transactions.has('paid_date')
    ? (tem.transactions.has('employee_id')
      ? tx`SELECT id::text, description, amount::float8 AS amount, type, category, to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          to_char(paid_date, 'YYYY-MM-DD') AS paid_date, status, client_id::text, employee_id::text FROM transactions
          WHERE date >= ${desde}::date OR paid_date >= ${desde}::date OR status = 'PENDING' ORDER BY date LIMIT ${LIMITE_LINHAS}`
      : tx`SELECT id::text, description, amount::float8 AS amount, type, category, to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          to_char(paid_date, 'YYYY-MM-DD') AS paid_date, status, client_id::text, NULL::text AS employee_id FROM transactions
          WHERE date >= ${desde}::date OR paid_date >= ${desde}::date OR status = 'PENDING' ORDER BY date LIMIT ${LIMITE_LINHAS}`)
    : tx`SELECT id::text, description, amount::float8 AS amount, type, category, to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        NULL::text AS paid_date, status, client_id::text, NULL::text AS employee_id FROM transactions
        WHERE date >= ${desde}::date OR status = 'PENDING' ORDER BY date LIMIT ${LIMITE_LINHAS}`),
  employees: (tx, tem) => (tem.employees.has('bonus')
    ? tx`SELECT id::text, name, role, COALESCE(salary, 0)::float8 AS salary, COALESCE(bonus, 0)::float8 AS bonus, payment_day FROM employees ORDER BY name`
    : tx`SELECT id::text, name, role, COALESCE(salary, 0)::float8 AS salary, 0::float8 AS bonus, payment_day FROM employees ORDER BY name`),
  employee_compensation_history: (tx, tem) => (tem.employee_compensation_history.size
    ? tx`SELECT employee_id::text, effective_month, salary::float8 AS salary, COALESCE(bonus, 0)::float8 AS bonus
        FROM employee_compensation_history ORDER BY effective_month`
    : Promise.resolve([])),
  subscriptions: (tx) => tx`SELECT id::text, name, COALESCE(cost, 0)::float8 AS cost, renewal_day, COALESCE(active, true) AS active
    FROM subscriptions ORDER BY name`,
  contracts: (tx, tem) => {
    const c = tem.contracts;
    if (!c.size) return Promise.resolve([]);
    if (c.has('signed_date') && c.has('pdf_url'))
      return tx`SELECT id::text, client_id::text, title, amount::float8 AS amount, status, to_char(start_date, 'YYYY-MM-DD') AS start_date,
        to_char(signed_date, 'YYYY-MM-DD') AS signed_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, due_day,
        (pdf_url IS NOT NULL OR pdf_file_name IS NOT NULL) AS tem_pdf FROM contracts ORDER BY start_date DESC`;
    return tx`SELECT id::text, client_id::text, title, amount::float8 AS amount, status, to_char(start_date, 'YYYY-MM-DD') AS start_date,
      NULL::text AS signed_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, due_day, false AS tem_pdf FROM contracts ORDER BY start_date DESC`;
  },
};
const NOMES = { clients: 'clientes', transactions: 'transacoes', employees: 'funcionarios', employee_compensation_history: 'historico', subscriptions: 'assinaturas', contracts: 'contratos' };
const OBRIGATORIAS = ['clients', 'transactions', 'employees', 'subscriptions'];

export function criarConectorFinancas({ env = process.env, criarSql = (url, op) => postgres(url, op), agora = () => Date.now(),
  tempoMs = 6000, cacheMs = 3 * 60 * 1000, falhaMs = 30 * 1000 } = {}) {
  const url = String(env?.[VARIAVEL] ?? '').trim();
  const cache = new Map();
  let sql = null;
  const banco = () => (sql ||= criarSql(url, { ...OPCOES_CONEXAO }));
  const guardado = (k) => { const g = cache.get(k); return g && !g.erro && agora() < g.ate ? g : null; };

  // Uma transação só de leitura, com tempo curto; o relógio daqui também corta (rede parada não segura a tela).
  async function lerNaTransacao(fn) {
    let timer;
    const relogio = new Promise((_, falha) => { timer = setTimeout(() => falha(erro('tempo')), tempoMs * 2 + 1000); });
    try {
      return await Promise.race([banco().begin('read only', async (tx) => {
        await tx`SELECT set_config('statement_timeout', ${String(tempoMs)}, true)`;
        return fn(tx);
      }), relogio]);
    } catch (e) { throw traduzirErro(e); }
    finally { clearTimeout(timer); }
  }

  // Tudo o que as telas usam. `desde` (AAAA-MM-DD) corta as transações antigas já pagas: ficam as dos últimos meses
  // (séries, margem) e todas as pendentes (inadimplência).
  async function lerBase({ desde }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desde || ''))) throw erro('leitura');
    const chaves = Object.fromEntries(TABELAS.map((t) => [t, t === 'transactions' ? `${t}|${desde}` : t]));
    const faltam = TABELAS.filter((t) => !guardado(chaves[t]));
    for (const t of faltam) { const g = cache.get(chaves[t]); if (g?.erro && agora() < g.ate) throw g.erro; }
    if (faltam.length) {
      try {
        const lidos = await lerNaTransacao(async (tx) => {
          const cols = await tx`SELECT table_name::text AS tabela, column_name::text AS coluna FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name::text = ANY(${[...TABELAS]}::text[])`;
          const tem = Object.fromEntries(TABELAS.map((t) => [t, new Set()]));
          for (const c of cols) tem[c.tabela]?.add(c.coluna);
          // Sem SELECT numa tabela obrigatória, ela nem aparece no information_schema: avisa para rodar o SQL de acesso.
          if (OBRIGATORIAS.some((t) => !tem[t].size)) throw erro('permissao');
          const saida = {};
          for (const t of faltam) saida[t] = await CONSULTAS[t](tx, tem, desde);
          return saida;
        });
        for (const t of faltam) cache.set(chaves[t], { dados: [...lidos[t]], ate: agora() + cacheMs });
      } catch (e) {
        const seguro = traduzirErro(e);
        for (const t of faltam) cache.set(chaves[t], { erro: seguro, ate: agora() + falhaMs });
        throw seguro;
      }
    }
    return Object.fromEntries(TABELAS.map((t) => [NOMES[t], cache.get(chaves[t]).dados]));
  }

  return {
    configurado: () => urlValida(url),
    urlValida: () => !url || urlValida(url),
    faltando: () => (url ? [] : [VARIAVEL]),
    lerBase,
    limpar() { cache.clear(); },
    async fechar() { const s = sql; sql = null; if (s?.end) await s.end({ timeout: 1 }).catch(() => {}); },
  };
}

// Um conector por instância do servidor (o cache e a conexão valem entre as chamadas da mesma função quente).
let padrao = null;
export function conectorPadrao() { return (padrao ||= criarConectorFinancas()); }
