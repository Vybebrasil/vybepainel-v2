// Bancos em memória (PGlite) para o importador do Finanças: usados pelo ensaio do --dry-run, pela demonstração
// (--demo) e pelos testes. Nada aqui toca banco de verdade nem vai para o site (o build não empacota scripts/).
// Os dados da demonstração são inventados: nenhum cliente, pessoa ou valor é real.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { sqlDaConexao } from '../server/transacao-automacoes.js';

const raiz = new URL('../', import.meta.url);
const migracao = (nome) => readFileSync(new URL(`migrations/${nome}.sql`, raiz), 'utf8');

// As tabelas do Supabase do Finanças que o importador lê (supabase_schema.sql do repositório vybe-financas, sem auth/RLS).
export const ESQUEMA_FINANCAS = `
CREATE TABLE clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL, cnpj text, contact_person text, email text, phone text,
  active_plan text, monthly_fee numeric, due_day integer, contract_status text, created_at timestamptz DEFAULT now());
CREATE TABLE bank_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL, institution text DEFAULT '', initial_balance numeric DEFAULT 0,
  is_default boolean DEFAULT false, account_type text NOT NULL DEFAULT 'checking', created_at timestamptz DEFAULT now());
CREATE TABLE employees (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL, role text NOT NULL, salary numeric NOT NULL, bonus numeric NOT NULL DEFAULT 0,
  pix_key text, payment_day integer, observations text);
CREATE TABLE employee_compensation_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE, user_id uuid,
  effective_month text NOT NULL, salary numeric NOT NULL, bonus numeric NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now(), UNIQUE (employee_id, effective_month));
CREATE TABLE subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL, cost numeric NOT NULL, renewal_day integer, payment_method text, active boolean DEFAULT true);
CREATE TABLE contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE, title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'Ativo', start_date date NOT NULL, signed_date date, end_date date, due_day integer NOT NULL DEFAULT 1, notes text,
  template_key text NOT NULL DEFAULT 'vybe-os-marketing', parameters jsonb NOT NULL DEFAULT '{}', pdf_url text, pdf_file_name text, created_at timestamptz DEFAULT now());
CREATE TABLE transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, description text NOT NULL, amount numeric NOT NULL, type text NOT NULL, category text NOT NULL,
  date timestamptz DEFAULT now(), status text NOT NULL, client_id uuid, employee_id uuid REFERENCES employees(id) ON DELETE SET NULL, payment_method text, receipt_url text,
  bank_account_id uuid, paid_date date, transfer_to_account_id uuid);
CREATE TABLE monthly_budgets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, month_key text NOT NULL, category text NOT NULL, amount numeric(12,2) NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now());
CREATE TABLE period_closures (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, month_key text NOT NULL, closed_at timestamptz NOT NULL DEFAULT now(), closed_by_email text, notes text);
`;

// Um "Finanças" vazio em memória. `sem`: tabelas que o papel de leitura não enxergaria (ex.: ['bank_accounts']).
export async function criarFinancas({ sem = [] } = {}) {
  const db = new PGlite();
  await db.exec(ESQUEMA_FINANCAS);
  const consultar = async (texto) => {
    // Simula a falta de permissão: a tabela some do information_schema e a leitura dela falharia.
    if (/information_schema\.columns/.test(texto)) return (await db.query(texto)).rows.filter((l) => !sem.includes(l.tabela));
    for (const t of sem) if (new RegExp(`FROM public\\.${t}\\b`).test(texto)) throw Object.assign(new Error('permission denied'), { code: '42501' });
    return (await db.query(texto)).rows;
  };
  // O mínimo do pacote postgres que a ponte (server/vybe-financas.js) usa: sql.begin('read only', fn) com etiqueta.
  const etiqueta = async (partes, ...valores) => {
    const texto = partes.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, '');
    return (await db.query(texto, valores)).rows.filter((l) => !(/information_schema\.columns/.test(texto) && sem.includes(l.tabela)));
  };
  const comoPostgres = { begin: async (_modo, fn) => fn(etiqueta), end: async () => {} };
  return { db, consultar, comoPostgres };
}

// Um Vybe OS em memória com as tabelas que o financeiro usa e a migração nova já aplicada.
// clientes: [{ id, nome, cnpj?, ativo?, financas_cliente_id? }] · pessoas: [{ id, nome }].
export async function criarVybeDeEnsaio({ clientes = [], pessoas = [], comMigracao = true } = {}) {
  const db = new PGlite();
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, pode_entrar boolean DEFAULT true, admin boolean DEFAULT false, monday_user_id text);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY, funcao text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, cnpj text, apagado_em timestamptz, nao_e_cliente boolean DEFAULT false);`);
  for (const m of ['2026-11-07-crm-prospeccao', '2026-11-07-comercial', '2026-11-07-carteira']) await db.exec(migracao(m));
  if (comMigracao) await db.exec(migracao('2026-11-11-financas-base'));
  for (const p of pessoas) await db.query('INSERT INTO vybe_pessoas (id, nome) VALUES ($1, $2)', [p.id, p.nome]);
  for (const c of clientes) {
    await db.query('INSERT INTO vybe_clientes (id, nome, cnpj, ativo) VALUES ($1, $2, $3, $4)', [c.id, c.nome, c.cnpj || null, c.ativo !== false]);
    if (comMigracao && c.financas_cliente_id) await db.query('UPDATE vybe_clientes SET financas_cliente_id = $1 WHERE id = $2', [c.financas_cliente_id, c.id]);
  }
  const sql = sqlDaConexao(db);
  sql.comTransacao = (executar) => db.transaction((tx) => executar(sqlDaConexao(tx)));
  return { db, sql };
}

// ---------- Demonstração (dados inventados) ----------
export const DEMO_VYBE = Object.freeze({
  clientes: [{ id: 10, nome: 'Padaria Aurora', cnpj: '11222333000144' }, { id: 11, nome: 'Clínica Horizonte' }, { id: 12, nome: 'Mercado Serra Azul' },
    { id: 13, nome: 'Academia Pulso' }, { id: 14, nome: 'Loja Antiga', ativo: false }],
  pessoas: [{ id: 1, nome: 'Dono Um' }, { id: 2, nome: 'Dona Dois' }, { id: 3, nome: 'Ana Lima' }, { id: 4, nome: 'Bruno Costa Silva' }],
});
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function criarFinancasDeDemonstracao(opcoes) {
  const fin = await criarFinancas(opcoes);
  await fin.db.exec(`
    INSERT INTO clients (id, name, cnpj, monthly_fee, due_day, contract_status) VALUES
      ('${U(1)}', 'Padaria Aurora Ltda', '11.222.333/0001-44', 2500, 5, 'Ativo'),
      ('${U(2)}', 'Clinica Horizonte', NULL, 1800, 10, 'Ativo'),
      ('${U(3)}', 'Serra Azul', NULL, 3200.50, 15, 'Ativo'),
      ('${U(4)}', 'Restaurante que saiu', NULL, 900, 20, 'Encerrado'),
      ('${U(5)}', 'Cliente sem lançamento', NULL, 1200, 8, 'Ativo');
    INSERT INTO bank_accounts (id, name, institution, initial_balance, is_default, account_type) VALUES
      ('${U(21)}', 'Conta principal', 'Banco A', 1000, true, 'checking'), ('${U(22)}', 'Cartão', 'Banco B', 0, false, 'credit_card');
    INSERT INTO employees (id, name, role, salary, bonus, pix_key, payment_day) VALUES
      ('${U(31)}', 'Ana Lima', 'Designer', 3000, 200, 'chave-ana', 5), ('${U(32)}', 'Bruno Costa', 'Editor', 2600, 0, NULL, 5), ('${U(33)}', 'Freela Externo', 'Redator', 1500, 0, NULL, NULL);
    INSERT INTO employee_compensation_history (employee_id, effective_month, salary, bonus) VALUES
      ('${U(31)}', '1970-01', 2500, 0), ('${U(31)}', '2026-09', 3000, 200), ('${U(32)}', '1970-01', 2600, 0), ('${U(33)}', '2026-10', 1500, 0);
    INSERT INTO subscriptions (id, name, cost, renewal_day, payment_method, active) VALUES
      ('${U(41)}', 'Editor de vídeo', 120.90, 3, 'Cartão', true), ('${U(42)}', 'Banco de imagens', 89, 12, 'Cartão', true), ('${U(43)}', 'Ferramenta antiga', 50, 1, NULL, false);
    INSERT INTO contracts (id, client_id, title, amount, status, start_date, signed_date, end_date, due_day, notes, parameters, pdf_file_name) VALUES
      ('${U(51)}', '${U(1)}', 'Marketing mensal', 2500, 'Ativo', '2026-01-10', '2026-01-08', '2027-01-09', 5, 'Renovação automática', '{"meses":12}', 'aurora.pdf'),
      ('${U(52)}', '${U(1)}', 'Contrato anterior', 2000, 'Encerrado', '2025-01-10', NULL, '2026-01-09', 5, NULL, '{}', NULL),
      ('${U(53)}', '${U(4)}', 'Marketing mensal', 900, 'Cancelado', '2025-06-01', NULL, '2026-08-31', 20, NULL, '{}', NULL),
      ('${U(54)}', '${U(3)}', 'Tráfego pago', 3200.50, 'Pendente', '2026-11-01', NULL, NULL, 15, NULL, '{}', NULL);
    INSERT INTO transactions (id, description, amount, type, category, date, status, client_id, employee_id, payment_method, receipt_url, bank_account_id, paid_date, transfer_to_account_id) VALUES
      ('${U(101)}', 'Mensalidade - Padaria Aurora Ltda', 2500, 'INCOME', 'Mensalidade', '2026-09-05T12:00:00Z', 'PAID', '${U(1)}', NULL, 'Pix', 'https://exemplo.test/c1.pdf', '${U(21)}', '2026-09-06', NULL),
      ('${U(102)}', 'Mensalidade - Padaria Aurora Ltda', 2500, 'INCOME', 'Mensalidade', '2026-10-05T12:00:00Z', 'PAID', '${U(1)}', NULL, 'Pix', NULL, '${U(21)}', NULL, NULL),
      ('${U(103)}', 'Mensalidade - Padaria Aurora Ltda', 2500, 'INCOME', 'Mensalidade', '2026-11-05T12:00:00Z', 'PENDING', '${U(1)}', NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(104)}', 'Mensalidade - Clinica Horizonte', 1800, 'INCOME', 'Mensalidade', '2026-09-10T12:00:00Z', 'PENDING', '${U(2)}', NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(105)}', 'Mensalidade - Clinica Horizonte', 1800, 'INCOME', 'Mensalidade', '2026-10-10T12:00:00Z', 'PAID', '${U(2)}', NULL, 'Boleto', NULL, '${U(21)}', '2026-10-13', NULL),
      ('${U(106)}', 'Mensalidade - Serra Azul', 3200.50, 'INCOME', 'Mensalidade', '2026-10-15T12:00:00Z', 'PAID', '${U(3)}', NULL, 'Pix', NULL, '${U(21)}', '2026-11-02', NULL),
      ('${U(107)}', 'Mensalidade - Restaurante que saiu', 900, 'INCOME', 'Mensalidade', '2026-07-20T12:00:00Z', 'PENDING', '${U(4)}', NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(108)}', 'Mensalidade - Academia Pulso', 1500, 'INCOME', 'Mensalidade', '2026-10-08T12:00:00Z', 'PENDING', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(109)}', 'Site institucional', 4000, 'INCOME', 'Projeto', '2026-10-31T23:30:00-03:00', 'PAID', '${U(3)}', NULL, 'Pix', NULL, '${U(21)}', '2026-11-03', NULL),
      ('${U(110)}', 'Mensalidade - Serra Azul', 0, 'INCOME', 'Mensalidade', '2026-08-15T12:00:00Z', 'PENDING', '${U(3)}', NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(111)}', 'Fatura cancelada', 700, 'INCOME', 'Projeto', '2026-09-20T12:00:00Z', 'CANCELLED', '${U(2)}', NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(112)}', 'Cliente apagado no Finanças', 650, 'INCOME', 'Projeto', '2026-10-20T12:00:00Z', 'PAID', '${U(99)}', NULL, 'Pix', NULL, '${U(23)}', '2026-10-21', NULL),
      ('${U(201)}', 'Salário - Ana Lima', 3200, 'EXPENSE', 'Salário/Prolabore', '2026-10-05T12:00:00Z', 'PAID', NULL, '${U(31)}', 'Pix', NULL, '${U(21)}', '2026-10-05', NULL),
      ('${U(202)}', 'Salário - Bruno', 2600, 'EXPENSE', 'Salário/Prolabore', '2026-10-05T12:00:00Z', 'PAID', NULL, NULL, 'Pix', NULL, '${U(21)}', '2026-10-06', NULL),
      ('${U(203)}', 'Vale - Ana', 300, 'EXPENSE', 'Outros', '2026-10-20T12:00:00Z', 'PAID', NULL, '${U(31)}', 'Pix', NULL, '${U(21)}', '2026-10-20', NULL),
      ('${U(204)}', 'Salário - Ana Lima', 3200, 'EXPENSE', 'Salário/Prolabore', '2026-11-05T12:00:00Z', 'PENDING', NULL, '${U(31)}', NULL, NULL, NULL, NULL, NULL),
      ('${U(205)}', 'Simples Nacional', 812.37, 'EXPENSE', 'Impostos (DAS)', '2026-10-20T12:00:00Z', 'PAID', NULL, NULL, 'Boleto', 'https://exemplo.test/das.pdf', '${U(21)}', '2026-10-19', NULL),
      ('${U(206)}', 'Internet', 149.90, 'EXPENSE', 'Internet', '2026-10-12T12:00:00Z', 'PAID', NULL, NULL, 'Cartão', NULL, '${U(22)}', NULL, NULL),
      ('${U(207)}', 'Anúncios da Padaria', 600, 'EXPENSE', 'Tráfego', '2026-10-18T12:00:00Z', 'PAID', '${U(1)}', NULL, 'Cartão', NULL, '${U(22)}', '2026-10-18', NULL),
      ('${U(208)}', 'Gráfica', 380, 'EXPENSE', 'Fornecedores', '2026-11-12T12:00:00Z', 'PENDING', '${U(3)}', NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(209)}', 'Compra cancelada', 999, 'EXPENSE', 'Equipamento', '2026-09-02T12:00:00Z', 'CANCELLED', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      ('${U(210)}', 'Aluguel', 1800, 'EXPENSE', 'Aluguel', '2026-09-10T12:00:00Z', 'PAID', NULL, NULL, 'Pix', NULL, '${U(21)}', '2026-09-10', NULL),
      ('${U(301)}', 'Pagamento da fatura do cartão', 749.90, 'TRANSFER', 'Transferência', '2026-10-25T12:00:00Z', 'PAID', NULL, NULL, NULL, NULL, '${U(21)}', '2026-10-25', '${U(22)}');
    INSERT INTO monthly_budgets (id, month_key, category, amount) VALUES ('${U(61)}', '2026-10', 'Tráfego', 800), ('${U(62)}', '2026-10', 'Internet', 150);
    INSERT INTO period_closures (id, month_key, closed_at, closed_by_email, notes) VALUES ('${U(71)}', '2026-09', '2026-10-03T14:00:00Z', 'dono@exemplo.test', 'Fechado sem pendências');
  `);
  return fin;
}
