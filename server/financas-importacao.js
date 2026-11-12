// server/financas-importacao.js — passagem do histórico do Vybe Finanças para o banco do Vybe OS (Paulo, 11/11/2026).
//
// Fase 1 de "abolir o Vybe Finanças": o Vybe OS guarda no próprio banco o que hoje lê pela ponte
// (server/vybe-financas.js) e precisa dar OS MESMOS números. Quem roda é o script scripts/financas-importar.mjs;
// nenhuma rota do painel chama nada daqui.
//
//  lerOrigemDoFinancas  lê o Supabase do Finanças (só SELECT, pela conexão de leitura da ponte);
//  baseDaOrigem         põe o que foi lido no formato que a ponte entrega às contas (shared/financas-calculos.js);
//  planejar             função pura: o que vai para cada tabela do Vybe OS e o que fica para o Paulo decidir;
//  gravar               grava o plano numa transação, por origem_financas_id (rodar de novo não duplica);
//  conferir             as contas de shared/financas-calculos.js nas duas fontes, mês a mês: o critério é diferença zero.
//
// Regras do mapeamento (as mesmas da ponte):
//  - dia do lançamento = dia em UTC do `date` do Finanças; PAID sem paid_date usa o `date`;
//  - status fora de PAID/PENDING vira cancelado;
//  - INCOME → vybe_comercial_recebiveis, EXPENSE → vybe_comercial_contas, TRANSFER → vybe_financas_transferencias;
//  - cliente do Finanças sem par no Vybe OS NUNCA vira cliente: fica em vybe_financas_clientes_origem para decisão.
import calc from '../shared/financas-calculos.js';

const centavos = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const reais = (c) => Math.round(c) / 100;
const dinheiro = (v) => reais(centavos(v));
const dia = (v) => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
const ehUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
const uuid = (v) => (ehUuid(v) ? String(v).toLowerCase() : null);
const txt = (v) => (v == null ? '' : String(v));
const inteiro = (v, min, max) => { const n = Number(v); return v != null && Number.isInteger(n) && n >= min && n <= max ? n : null; };
const pago = (t) => t?.status === 'PAID';
const pendente = (t) => t?.status === 'PENDING';

// ---------- 1. Leitura da origem ----------
// Só nomes fixos daqui entram no SQL (nenhum valor de fora). Coluna que ainda não existe naquela versão do Finanças
// sai como NULL; tabela opcional que o papel de leitura não enxerga entra em `sem_acesso` e a importação segue.
export const TABELAS_ORIGEM = Object.freeze({
  clients: { obrigatoria: true, ordem: 'name, id', colunas: { id: 'id::text', name: 'name', cnpj: 'cnpj', contact_person: 'contact_person', email: 'email',
    phone: 'phone', active_plan: 'active_plan', monthly_fee: 'monthly_fee::float8', due_day: 'due_day', contract_status: 'contract_status' } },
  transactions: { obrigatoria: true, ordem: 'date, id', colunas: { id: 'id::text', description: 'description', amount: 'amount::float8', type: 'type', category: 'category',
    date: "to_char(date AT TIME ZONE 'UTC', 'YYYY-MM-DD')", paid_date: "to_char(paid_date, 'YYYY-MM-DD')", status: 'status', client_id: 'client_id::text',
    employee_id: 'employee_id::text', payment_method: 'payment_method', receipt_url: 'receipt_url', bank_account_id: 'bank_account_id::text',
    transfer_to_account_id: 'transfer_to_account_id::text' } },
  employees: { obrigatoria: true, ordem: 'name, id', colunas: { id: 'id::text', name: 'name', role: 'role', salary: 'salary::float8', bonus: 'bonus::float8',
    pix_key: 'pix_key', payment_day: 'payment_day', observations: 'observations' } },
  employee_compensation_history: { ordem: 'effective_month, employee_id', colunas: { id: 'id::text', employee_id: 'employee_id::text', effective_month: 'effective_month',
    salary: 'salary::float8', bonus: 'bonus::float8' } },
  subscriptions: { obrigatoria: true, ordem: 'name, id', colunas: { id: 'id::text', name: 'name', cost: 'cost::float8', renewal_day: 'renewal_day',
    payment_method: 'payment_method', active: 'active' } },
  contracts: { ordem: 'start_date DESC, id', colunas: { id: 'id::text', client_id: 'client_id::text', title: 'title', amount: 'amount::float8', status: 'status',
    start_date: "to_char(start_date, 'YYYY-MM-DD')", signed_date: "to_char(signed_date, 'YYYY-MM-DD')", end_date: "to_char(end_date, 'YYYY-MM-DD')", due_day: 'due_day',
    notes: 'notes', template_key: 'template_key', parameters: 'parameters', pdf_url: 'pdf_url', pdf_file_name: 'pdf_file_name' } },
  bank_accounts: { ordem: 'name, id', colunas: { id: 'id::text', name: 'name', institution: 'institution', initial_balance: 'initial_balance::float8',
    is_default: 'is_default', account_type: 'account_type' } },
  monthly_budgets: { ordem: 'month_key, category', colunas: { id: 'id::text', month_key: 'month_key', category: 'category', amount: 'amount::float8' } },
  period_closures: { ordem: 'month_key', colunas: { id: 'id::text', month_key: 'month_key', closed_at: 'closed_at', closed_by_email: 'closed_by_email', notes: 'notes' } },
});

// consultar(textoSql) → Promise<linhas>. No script é tx.unsafe do pacote postgres dentro de BEGIN READ ONLY.
export async function lerOrigemDoFinancas(consultar) {
  const nomes = Object.keys(TABELAS_ORIGEM);
  const cols = await consultar(`SELECT table_name::text AS tabela, column_name::text AS coluna FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN (${nomes.map((n) => `'${n}'`).join(', ')})`);
  const tem = Object.fromEntries(nomes.map((n) => [n, new Set()]));
  for (const c of cols) tem[c.tabela]?.add(c.coluna);
  const origem = { sem_acesso: [], colunas_ausentes: [] };
  for (const [nome, def] of Object.entries(TABELAS_ORIGEM)) {
    if (!tem[nome].size) {
      if (def.obrigatoria) throw Object.assign(new Error(`O papel de leitura não enxerga a tabela ${nome} do Finanças: rode de novo docs/vybe-financas-acesso-leitura.sql.`), { codigo: 'permissao' });
      origem[nome] = []; origem.sem_acesso.push(nome); continue;
    }
    const lista = Object.entries(def.colunas).map(([col, expr]) => {
      if (tem[nome].has(col)) return `${expr} AS ${col}`;
      origem.colunas_ausentes.push(`${nome}.${col}`); return `NULL AS ${col}`;
    });
    const ordem = def.ordem.split(', ').filter((o) => tem[nome].has(o.replace(/ DESC$/, ''))).join(', ');
    origem[nome] = [...await consultar(`SELECT ${lista.join(', ')} FROM public.${nome}${ordem ? ` ORDER BY ${ordem}` : ''}`)];
  }
  return origem;
}

// O que a ponte entrega às contas, a partir da origem inteira (mesmos COALESCE de server/vybe-financas.js).
export function baseDaOrigem(o) {
  return {
    clientes: o.clients.map((c) => ({ id: c.id, name: c.name, cnpj: c.cnpj || '', monthly_fee: Number(c.monthly_fee) || 0, due_day: c.due_day ?? null, contract_status: c.contract_status ?? null })),
    transacoes: o.transactions.map((t) => ({ id: t.id, description: t.description, amount: t.amount, type: t.type, category: t.category, date: t.date ?? null,
      paid_date: t.paid_date ?? null, status: t.status, client_id: t.client_id ?? null, employee_id: t.employee_id ?? null })),
    funcionarios: o.employees.map((e) => ({ id: e.id, name: e.name, role: e.role, salary: Number(e.salary) || 0, bonus: Number(e.bonus) || 0, payment_day: e.payment_day ?? null })),
    historico: o.employee_compensation_history.map((h) => ({ employee_id: h.employee_id, effective_month: h.effective_month, salary: h.salary, bonus: Number(h.bonus) || 0 })),
    assinaturas: o.subscriptions.map((s) => ({ id: s.id, name: s.name, cost: Number(s.cost) || 0, renewal_day: s.renewal_day ?? null, active: s.active ?? true })),
    contratos: o.contracts.map((c) => ({ id: c.id, client_id: c.client_id, title: c.title, amount: c.amount, status: c.status, start_date: c.start_date ?? null,
      signed_date: c.signed_date ?? null, end_date: c.end_date ?? null, due_day: c.due_day ?? null, tem_pdf: Boolean(c.pdf_url || c.pdf_file_name) })),
  };
}

// ---------- 2. Plano (função pura) ----------
const TIPO_CONTA = { checking: 'corrente', credit_card: 'cartao_credito', cash: 'dinheiro', other: 'outro' };
const cortar = (v, max, ajustes, onde) => { const s = txt(v); if (s.length <= max) return s; ajustes.push({ onde, motivo: `texto cortado em ${max} caracteres` }); return s.slice(0, max); };

// clientesVybe: [{ id, nome, cnpj, financas_cliente_id }] (os ativos, a mesma lista que a ponte usa para ligar);
// pessoasVybe: [{ id, nome }].
export function planejar(origem, { clientesVybe = [], pessoasVybe = [] } = {}) {
  const ajustes = [], naoImportados = [];
  const valor = (v, onde) => { const n = Number(v); if (v != null && Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) ajustes.push({ onde, motivo: 'valor com mais de 2 casas, arredondado' }); return dinheiro(v); };
  const naoNegativo = (v, onde) => { const x = valor(v, onde); if (x < 0) { ajustes.push({ onde, motivo: 'valor negativo, gravado como zero' }); return 0; } return x; };
  const diaDoMes = (v, onde) => { if (v == null) return null; const n = inteiro(v, 1, 31); if (n == null) ajustes.push({ onde, motivo: `dia ${v} fora de 1 a 31, gravado vazio` }); return n; };

  // Clientes: a ligação é a da ponte (id já gravado, CNPJ, nome, nome parecido com um candidato só).
  const base = baseDaOrigem(origem);
  const ligacao = calc.ligarClientes(base.clientes, clientesVybe);
  const nomeFin = Object.fromEntries(base.clientes.map((c) => [c.id, c.name]));
  const clientes = origem.clients.filter((c) => { if (uuid(c.id)) return true; naoImportados.push({ tabela: 'clients', id: txt(c.id), motivo: 'id fora do formato' }); return false; }).map((c) => {
    const par = ligacao.porFinancas[c.id] || null;
    return { origem_financas_id: uuid(c.id), nome: cortar(c.name, 300, ajustes, `cliente ${c.id}`), cnpj: txt(c.cnpj).slice(0, 40), contato: txt(c.contact_person).slice(0, 200),
      email: txt(c.email).slice(0, 200), telefone: txt(c.phone).slice(0, 60), plano: txt(c.active_plan).slice(0, 200), valor_mensal: valor(c.monthly_fee, `cliente ${c.id}`),
      dia_vencimento: c.due_day == null ? null : Number(c.due_day), status_contrato: txt(c.contract_status).slice(0, 40),
      cliente_id: par ? String(par.vybe_id) : null, ligado_por: par ? par.por : '' };
  });
  // O que passa a ficar gravado em vybe_clientes.financas_cliente_id: um cliente do Finanças por cliente do Vybe OS.
  const jaLigado = new Map(clientesVybe.filter((v) => v.financas_cliente_id).map((v) => [String(v.id), String(v.financas_cliente_id).toLowerCase()]));
  const ligacoes = [], conflitos = [], vistos = new Map();
  for (const c of clientes) {
    if (!c.cliente_id) continue;
    const atual = jaLigado.get(c.cliente_id);
    if (atual && atual !== c.origem_financas_id) { conflitos.push({ cliente_id: c.cliente_id, nome: c.nome, motivo: 'o cliente do Vybe OS já está ligado a outro cliente do Finanças' }); continue; }
    if (vistos.has(c.cliente_id)) { conflitos.push({ cliente_id: c.cliente_id, nome: c.nome, motivo: `dois clientes do Finanças para o mesmo cliente do Vybe OS (o outro: ${vistos.get(c.cliente_id)})` }); continue; }
    vistos.set(c.cliente_id, c.nome);
    if (!atual) ligacoes.push({ cliente_id: c.cliente_id, fin: c.origem_financas_id });
  }

  // Contas bancárias: as de bank_accounts e, sem acesso a ela, só a referência que os lançamentos trazem.
  const contasBancarias = origem.bank_accounts.filter((b) => uuid(b.id)).map((b) => ({ origem_financas_id: uuid(b.id), nome: cortar(b.name, 120, ajustes, `conta bancária ${b.id}`).trim() || 'Conta sem nome',
    instituicao: txt(b.institution).slice(0, 120), tipo: TIPO_CONTA[b.account_type] || (b.account_type ? 'outro' : 'corrente'), saldo_inicial: valor(b.initial_balance, `conta bancária ${b.id}`),
    padrao: Boolean(b.is_default), nome_pendente: false }));
  const temConta = new Set(contasBancarias.map((b) => b.origem_financas_id));
  for (const t of origem.transactions) for (const id of [uuid(t.bank_account_id), uuid(t.transfer_to_account_id)]) {
    if (!id || temConta.has(id)) continue;
    temConta.add(id);
    contasBancarias.push({ origem_financas_id: id, nome: `Conta do Finanças ${id.slice(0, 8)}`, instituicao: '', tipo: 'corrente', saldo_inicial: 0, padrao: false, nome_pendente: true });
  }

  // Equipe: liga à pessoa do Vybe OS só quando o nome bate inteiro e é único dos dois lados; parecido vira sugestão.
  // (Nome de gente não passa pela regra dos clientes, que tira "me", "sa" e "grupo" do nome.)
  const nomeGente = (s) => txt(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const contar = (lista, chave) => { const m = new Map(); for (const x of lista) { const k = chave(x); if (k) m.set(k, [...(m.get(k) || []), x]); } return m; };
  const pessoasPorNome = contar(pessoasVybe, (p) => nomeGente(p.nome)), funcionariosPorNome = contar(origem.employees, (e) => nomeGente(e.name));
  const equipe = origem.employees.filter((e) => { if (uuid(e.id)) return true; naoImportados.push({ tabela: 'employees', id: txt(e.id), motivo: 'id fora do formato' }); return false; }).map((e) => {
    const n = nomeGente(e.name), iguais = pessoasPorNome.get(n) || [];
    const exata = n && iguais.length === 1 && funcionariosPorNome.get(n).length === 1 ? iguais[0] : null;
    const parecidas = exata || !n ? [] : pessoasVybe.filter((p) => { const pn = nomeGente(p.nome); return pn && (pn.startsWith(n + ' ') || n.startsWith(pn + ' ') || pn.split(' ')[0] === n.split(' ')[0]); });
    return { origem_financas_id: uuid(e.id), nome: cortar(e.name, 160, ajustes, `funcionário ${e.id}`).trim() || 'Sem nome', cargo: txt(e.role).slice(0, 160),
      salario: naoNegativo(e.salary, `funcionário ${e.id}`), bonus: naoNegativo(e.bonus, `funcionário ${e.id}`), dia_pagamento: diaDoMes(e.payment_day, `funcionário ${e.id}`),
      chave_pix: txt(e.pix_key).slice(0, 200), observacoes: txt(e.observations).slice(0, 4000), pessoa_id: exata ? String(exata.id) : null,
      sugestao: parecidas.length === 1 ? { pessoa_id: String(parecidas[0].id), pessoa_nome: parecidas[0].nome } : null };
  });
  const temEquipe = new Set(equipe.map((e) => e.origem_financas_id));
  const historico = [];
  for (const h of origem.employee_compensation_history) {
    if (!temEquipe.has(uuid(h.employee_id))) { naoImportados.push({ tabela: 'employee_compensation_history', id: txt(h.id), motivo: 'funcionário não existe mais' }); continue; }
    if (!calc.ehMes(h.effective_month)) { naoImportados.push({ tabela: 'employee_compensation_history', id: txt(h.id), motivo: `mês de vigência inválido (${txt(h.effective_month)})` }); continue; }
    historico.push({ equipe: uuid(h.employee_id), vigente_desde: h.effective_month, salario: naoNegativo(h.salary, `histórico ${h.id}`), bonus: naoNegativo(h.bonus, `histórico ${h.id}`) });
  }

  const assinaturas = origem.subscriptions.filter((s) => uuid(s.id)).map((s) => ({ origem_financas_id: uuid(s.id), nome: cortar(s.name, 160, ajustes, `assinatura ${s.id}`).trim() || 'Assinatura',
    custo: valor(s.cost, `assinatura ${s.id}`), dia_renovacao: diaDoMes(s.renewal_day, `assinatura ${s.id}`), forma_pagamento: txt(s.payment_method).slice(0, 60), ativo: s.active ?? true }));

  const contratos = origem.contracts.filter((c) => uuid(c.id)).map((c) => {
    const par = ligacao.porFinancas[c.client_id] || null;
    let parametros = c.parameters; if (typeof parametros === 'string') { try { parametros = JSON.parse(parametros); } catch { parametros = {}; } }
    if (!parametros || typeof parametros !== 'object' || Array.isArray(parametros)) parametros = {};
    return { origem_financas_id: uuid(c.id), cliente_id: par ? String(par.vybe_id) : null, financas_cliente_id: uuid(c.client_id), titulo: cortar(c.title, 300, ajustes, `contrato ${c.id}`),
      valor_mensal: naoNegativo(c.amount, `contrato ${c.id}`), inicio: dia(c.start_date), assinado_em: dia(c.signed_date), fim: dia(c.end_date), dia_vencimento: diaDoMes(c.due_day, `contrato ${c.id}`),
      status: calc.STATUS_CONTRATO[c.status] || 'ativo', status_origem: txt(c.status).slice(0, 40), observacao: cortar(c.notes, 8000, ajustes, `contrato ${c.id}`),
      modelo: txt(c.template_key).slice(0, 120), parametros, pdf_url: txt(c.pdf_url).slice(0, 2000), pdf_nome: txt(c.pdf_file_name).slice(0, 300) };
  });

  // Lançamentos. O cliente e o tipo do recebível saem da mesma função que a tela usa hoje (recebiveisDoFinancas), que
  // também liga pelo nome da descrição "Mensalidade - Nome"; ela pula valor zero, por isso a cópia com valor 1.
  const receitas = origem.transactions.filter((t) => t.type === 'INCOME');
  const comoATela = new Map(calc.recebiveisDoFinancas(receitas.map((t) => ({ ...t, amount: 1 })), ligacao.porFinancas, nomeFin, clientesVybe).map((r) => [r.id, r]));
  const recebiveis = [], contas = [], transferencias = [];
  for (const t of origem.transactions) {
    const id = uuid(t.id), venc = dia(t.date), onde = `lançamento ${t.id}`;
    if (!id) { naoImportados.push({ tabela: 'transactions', id: txt(t.id), motivo: 'id fora do formato' }); continue; }
    if (!venc) { naoImportados.push({ tabela: 'transactions', id, motivo: 'sem data' }); continue; }
    const cancelado = !pago(t) && !pendente(t);
    const baixa = pago(t) ? dia(t.paid_date) || venc : cancelado ? dia(t.paid_date) : null;
    const comum = { origem_financas_id: id, descricao: cortar(t.description, 1000, ajustes, onde), categoria: cortar(t.category, 120, ajustes, onde), valor: valor(t.amount, onde),
      forma_pagamento: txt(t.payment_method).slice(0, 60), comprovante_url: txt(t.receipt_url).slice(0, 2000), conta: uuid(t.bank_account_id) };
    if (t.type === 'INCOME') {
      const tela = comoATela.get('fin:' + t.id), cliente = tela?.cliente_id ? String(tela.cliente_id) : null;
      const recorrente = Boolean(cliente) && tela?.tipo === 'recorrente';
      recebiveis.push({ ...comum, tipo: recorrente ? 'recorrente' : 'pontual', ciclo: recorrente ? 'mensal' : null, cliente_id: cliente, financas_cliente_id: uuid(t.client_id),
        valor_recebido: pago(t) ? Math.max(comum.valor, 0) : 0, vencimento: venc, recebido_em: baixa, cancelado });
    } else if (t.type === 'EXPENSE') {
      const par = t.client_id ? ligacao.porFinancas[t.client_id] : null;
      contas.push({ ...comum, grupo: calc.grupoDaDespesa(t), cliente_id: par ? String(par.vybe_id) : null, financas_cliente_id: uuid(t.client_id),
        equipe: temEquipe.has(uuid(t.employee_id)) ? uuid(t.employee_id) : null, vencimento: venc, pago_em: baixa, cancelada: cancelado });
    } else if (t.type === 'TRANSFER') {
      transferencias.push({ ...comum, data: venc, efetivada_em: baixa, cancelada: cancelado, conta_destino: uuid(t.transfer_to_account_id) });
    } else naoImportados.push({ tabela: 'transactions', id, motivo: `tipo desconhecido (${txt(t.type)})` });
  }

  const orcamentos = [], fechamentos = [];
  for (const b of origem.monthly_budgets) {
    if (!uuid(b.id) || !calc.ehMes(b.month_key) || !txt(b.category).trim()) { naoImportados.push({ tabela: 'monthly_budgets', id: txt(b.id), motivo: 'mês ou categoria inválidos' }); continue; }
    orcamentos.push({ origem_financas_id: uuid(b.id), mes: b.month_key, categoria: txt(b.category).trim().slice(0, 120), valor: naoNegativo(b.amount, `orçamento ${b.id}`) });
  }
  for (const f of origem.period_closures) {
    if (!uuid(f.id) || !calc.ehMes(f.month_key)) { naoImportados.push({ tabela: 'period_closures', id: txt(f.id), motivo: 'mês inválido' }); continue; }
    const quando = f.closed_at instanceof Date ? f.closed_at.toISOString() : txt(f.closed_at) || null;
    fechamentos.push({ origem_financas_id: uuid(f.id), mes: f.month_key, fechado_em: quando, fechado_por_email: txt(f.closed_by_email).slice(0, 200), observacoes: txt(f.notes).slice(0, 4000) });
  }

  const lidas = Object.keys(TABELAS_ORIGEM).filter((n) => !(origem.sem_acesso || []).includes(n));
  return { clientes, ligacoes, contas_bancarias: contasBancarias, equipe, historico, assinaturas, contratos, recebiveis, contas, transferencias, orcamentos, fechamentos, lidas,
    pendencias: {
      clientes_sem_par: ligacao.sem_par.map((c) => ({ financas_id: c.financas_id, nome: c.nome, status: c.status })),
      clientes_por_nome_parecido: ligacao.ligados.filter((l) => l.por === 'nome_parecido').map((l) => ({ financas_nome: l.financas_nome, vybe_nome: l.vybe_nome })),
      clientes_do_vybe_sem_par: ligacao.vybe_sem_par,
      conflitos_de_ligacao: conflitos,
      equipe_sem_par: equipe.filter((e) => !e.pessoa_id).map((e) => ({ nome: e.nome, sugestao: e.sugestao ? e.sugestao.pessoa_nome : '' })),
      contas_bancarias_sem_nome: contasBancarias.filter((b) => b.nome_pendente).length,
      nao_importados: naoImportados, ajustes, sem_acesso: [...(origem.sem_acesso || [])], colunas_ausentes: [...(origem.colunas_ausentes || [])],
    } };
}

// ---------- 3. Gravação (uma transação; por origem_financas_id) ----------
export const VARIAVEL_GRAVAR = 'VYBE_FINANCAS_IMPORTAR';
export const VALOR_GRAVAR = 'GRAVAR';
export const podeGravar = (env = process.env) => String(env?.[VARIAVEL_GRAVAR] || '') === VALOR_GRAVAR;

const lotes = (lista, n = 400) => { const out = []; for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n)); return out; };
async function subir(lista, executar) {
  let novos = 0, atualizados = 0;
  for (const lote of lotes(lista)) for (const r of await executar(JSON.stringify(lote))) { if (r.novo) novos++; else atualizados++; }
  return { novos, atualizados };
}
const ids = (lista) => JSON.stringify(lista.map((x) => x.origem_financas_id));

// tx: etiqueta de SQL dentro de UMA transação (sql.comTransacao). Só toca linhas com origem_financas_id (as que este
// importador criou); o que foi lançado à mão no Vybe OS nunca é alterado nem apagado.
export async function gravar(tx, plano, { env = process.env } = {}) {
  if (!podeGravar(env)) throw Object.assign(new Error(`Gravação bloqueada: defina ${VARIAVEL_GRAVAR}=${VALOR_GRAVAR} para gravar.`), { codigo: 'bloqueado' });
  const [{ ja }] = await tx`SELECT (SELECT count(*) FROM vybe_comercial_recebiveis WHERE origem_financas_id IS NOT NULL)::int
    + (SELECT count(*) FROM vybe_comercial_contas WHERE origem_financas_id IS NOT NULL)::int AS ja`;
  const lancamentos = plano.recebiveis.length + plano.contas.length + plano.transferencias.length;
  if (!lancamentos && ja) throw Object.assign(new Error('A origem veio sem nenhum lançamento e o Vybe OS já tem lançamentos importados: nada foi gravado nem removido.'), { codigo: 'origem_vazia' });
  const r = {};

  if (plano.ligacoes.length) {
    const linhas = await tx`UPDATE vybe_clientes c SET financas_cliente_id = x.fin FROM jsonb_to_recordset(${JSON.stringify(plano.ligacoes)}::jsonb) AS x(cliente_id bigint, fin uuid)
      WHERE c.id = x.cliente_id AND c.financas_cliente_id IS NULL AND NOT EXISTS (SELECT 1 FROM vybe_clientes o WHERE o.financas_cliente_id = x.fin) RETURNING c.id`;
    r.clientes_ligados = linhas.length;
  } else r.clientes_ligados = 0;

  r.clientes_origem = await subir(plano.clientes, (j) => tx`INSERT INTO vybe_financas_clientes_origem AS o
      (origem_financas_id, nome, cnpj, contato, email, telefone, plano, valor_mensal, dia_vencimento, status_contrato, cliente_id, ligado_por, decisao)
    SELECT x.origem_financas_id, x.nome, x.cnpj, x.contato, x.email, x.telefone, x.plano, x.valor_mensal, x.dia_vencimento, x.status_contrato, x.cliente_id, x.ligado_por,
      CASE WHEN x.cliente_id IS NULL THEN 'pendente' ELSE 'ligar' END
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, nome text, cnpj text, contato text, email text, telefone text, plano text, valor_mensal numeric,
      dia_vencimento integer, status_contrato text, cliente_id bigint, ligado_por text)
    ON CONFLICT (origem_financas_id) DO UPDATE SET nome = EXCLUDED.nome, cnpj = EXCLUDED.cnpj, contato = EXCLUDED.contato, email = EXCLUDED.email, telefone = EXCLUDED.telefone,
      plano = EXCLUDED.plano, valor_mensal = EXCLUDED.valor_mensal, dia_vencimento = EXCLUDED.dia_vencimento, status_contrato = EXCLUDED.status_contrato,
      cliente_id = EXCLUDED.cliente_id, ligado_por = EXCLUDED.ligado_por,
      decisao = CASE WHEN EXCLUDED.cliente_id IS NOT NULL THEN 'ligar' WHEN o.decisao = 'ignorar' THEN 'ignorar' ELSE 'pendente' END, importado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.contas_bancarias = await subir(plano.contas_bancarias, (j) => tx`INSERT INTO vybe_financas_contas_bancarias AS b (origem_financas_id, nome, instituicao, tipo, saldo_inicial, padrao, nome_pendente)
    SELECT x.origem_financas_id, x.nome, x.instituicao, x.tipo, x.saldo_inicial, x.padrao, x.nome_pendente
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, nome text, instituicao text, tipo text, saldo_inicial numeric, padrao boolean, nome_pendente boolean)
    ON CONFLICT (origem_financas_id) DO UPDATE SET
      nome = CASE WHEN EXCLUDED.nome_pendente THEN b.nome ELSE EXCLUDED.nome END, instituicao = CASE WHEN EXCLUDED.nome_pendente THEN b.instituicao ELSE EXCLUDED.instituicao END,
      tipo = CASE WHEN EXCLUDED.nome_pendente THEN b.tipo ELSE EXCLUDED.tipo END, saldo_inicial = CASE WHEN EXCLUDED.nome_pendente THEN b.saldo_inicial ELSE EXCLUDED.saldo_inicial END,
      padrao = CASE WHEN EXCLUDED.nome_pendente THEN b.padrao ELSE EXCLUDED.padrao END, nome_pendente = b.nome_pendente AND EXCLUDED.nome_pendente, ativo = true, atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.equipe = await subir(plano.equipe, (j) => tx`INSERT INTO vybe_financas_equipe AS e (origem_financas_id, nome, cargo, salario, bonus, dia_pagamento, chave_pix, observacoes, pessoa_id)
    SELECT x.origem_financas_id, x.nome, x.cargo, x.salario, x.bonus, x.dia_pagamento, x.chave_pix, x.observacoes,
      CASE WHEN EXISTS (SELECT 1 FROM vybe_financas_equipe o WHERE o.pessoa_id = x.pessoa_id) THEN NULL ELSE x.pessoa_id END
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, nome text, cargo text, salario numeric, bonus numeric, dia_pagamento integer, chave_pix text, observacoes text, pessoa_id bigint)
    ON CONFLICT (origem_financas_id) DO UPDATE SET nome = EXCLUDED.nome, cargo = EXCLUDED.cargo, salario = EXCLUDED.salario, bonus = EXCLUDED.bonus, dia_pagamento = EXCLUDED.dia_pagamento,
      chave_pix = EXCLUDED.chave_pix, observacoes = EXCLUDED.observacoes, pessoa_id = COALESCE(e.pessoa_id, EXCLUDED.pessoa_id), ativo = true, atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.historico = await subir(plano.historico, (j) => tx`INSERT INTO vybe_financas_equipe_historico (equipe_id, vigente_desde, salario, bonus)
    SELECT e.id, x.vigente_desde, x.salario, x.bonus FROM jsonb_to_recordset(${j}::jsonb) AS x(equipe uuid, vigente_desde text, salario numeric, bonus numeric)
      JOIN vybe_financas_equipe e ON e.origem_financas_id = x.equipe
    ON CONFLICT (equipe_id, vigente_desde) DO UPDATE SET salario = EXCLUDED.salario, bonus = EXCLUDED.bonus
    RETURNING (xmax = 0) AS novo`);

  r.assinaturas = await subir(plano.assinaturas, (j) => tx`INSERT INTO vybe_financas_assinaturas (origem_financas_id, nome, custo, dia_renovacao, forma_pagamento, ativo)
    SELECT x.origem_financas_id, x.nome, x.custo, x.dia_renovacao, x.forma_pagamento, x.ativo
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, nome text, custo numeric, dia_renovacao integer, forma_pagamento text, ativo boolean)
    ON CONFLICT (origem_financas_id) DO UPDATE SET nome = EXCLUDED.nome, custo = EXCLUDED.custo, dia_renovacao = EXCLUDED.dia_renovacao, forma_pagamento = EXCLUDED.forma_pagamento,
      ativo = EXCLUDED.ativo, atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.contratos = await subir(plano.contratos, (j) => tx`INSERT INTO vybe_cliente_contratos (origem_financas_id, cliente_id, financas_cliente_id, titulo, valor_mensal, inicio, assinado_em, fim,
      dia_vencimento, status, status_origem, observacao, modelo, parametros, pdf_url, pdf_nome, importado_em)
    SELECT x.origem_financas_id, x.cliente_id, x.financas_cliente_id, x.titulo, x.valor_mensal, x.inicio, x.assinado_em, x.fim, x.dia_vencimento, x.status, x.status_origem, x.observacao,
      x.modelo, COALESCE(x.parametros, '{}'::jsonb), x.pdf_url, x.pdf_nome, now()
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, cliente_id bigint, financas_cliente_id uuid, titulo text, valor_mensal numeric, inicio date, assinado_em date, fim date,
      dia_vencimento integer, status text, status_origem text, observacao text, modelo text, parametros jsonb, pdf_url text, pdf_nome text)
    ON CONFLICT (origem_financas_id) DO UPDATE SET cliente_id = EXCLUDED.cliente_id, financas_cliente_id = EXCLUDED.financas_cliente_id, titulo = EXCLUDED.titulo,
      valor_mensal = EXCLUDED.valor_mensal, inicio = EXCLUDED.inicio, assinado_em = EXCLUDED.assinado_em, fim = EXCLUDED.fim, dia_vencimento = EXCLUDED.dia_vencimento,
      status = EXCLUDED.status, status_origem = EXCLUDED.status_origem, observacao = EXCLUDED.observacao, modelo = EXCLUDED.modelo, parametros = EXCLUDED.parametros,
      pdf_url = EXCLUDED.pdf_url, pdf_nome = EXCLUDED.pdf_nome, importado_em = now(), atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.recebiveis = await subir(plano.recebiveis, (j) => tx`INSERT INTO vybe_comercial_recebiveis (origem_financas_id, tipo, cliente_id, financas_cliente_id, descricao, categoria, ciclo, valor,
      valor_recebido, vencimento, recebido_em, cancelado, forma_pagamento, comprovante_url, conta_bancaria_id, importado_em)
    SELECT x.origem_financas_id, x.tipo, x.cliente_id, x.financas_cliente_id, x.descricao, x.categoria, x.ciclo, x.valor, x.valor_recebido, x.vencimento, x.recebido_em, x.cancelado,
      x.forma_pagamento, x.comprovante_url, b.id, now()
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, tipo text, cliente_id bigint, financas_cliente_id uuid, descricao text, categoria text, ciclo text, valor numeric,
      valor_recebido numeric, vencimento date, recebido_em date, cancelado boolean, forma_pagamento text, comprovante_url text, conta uuid)
      LEFT JOIN vybe_financas_contas_bancarias b ON b.origem_financas_id = x.conta
    ON CONFLICT (origem_financas_id) DO UPDATE SET tipo = EXCLUDED.tipo, cliente_id = EXCLUDED.cliente_id, financas_cliente_id = EXCLUDED.financas_cliente_id, descricao = EXCLUDED.descricao,
      categoria = EXCLUDED.categoria, ciclo = EXCLUDED.ciclo, valor = EXCLUDED.valor, valor_recebido = EXCLUDED.valor_recebido, vencimento = EXCLUDED.vencimento,
      recebido_em = EXCLUDED.recebido_em, cancelado = EXCLUDED.cancelado, forma_pagamento = EXCLUDED.forma_pagamento, comprovante_url = EXCLUDED.comprovante_url,
      conta_bancaria_id = EXCLUDED.conta_bancaria_id, importado_em = now(), atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.contas = await subir(plano.contas, (j) => tx`INSERT INTO vybe_comercial_contas (origem_financas_id, grupo, descricao, categoria, valor, vencimento, pago_em, cancelada, cliente_id,
      financas_cliente_id, equipe_id, forma_pagamento, comprovante_url, conta_bancaria_id, importado_em)
    SELECT x.origem_financas_id, x.grupo, x.descricao, x.categoria, x.valor, x.vencimento, x.pago_em, x.cancelada, x.cliente_id, x.financas_cliente_id, e.id, x.forma_pagamento,
      x.comprovante_url, b.id, now()
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, grupo text, descricao text, categoria text, valor numeric, vencimento date, pago_em date, cancelada boolean,
      cliente_id bigint, financas_cliente_id uuid, equipe uuid, forma_pagamento text, comprovante_url text, conta uuid)
      LEFT JOIN vybe_financas_equipe e ON e.origem_financas_id = x.equipe
      LEFT JOIN vybe_financas_contas_bancarias b ON b.origem_financas_id = x.conta
    ON CONFLICT (origem_financas_id) DO UPDATE SET grupo = EXCLUDED.grupo, descricao = EXCLUDED.descricao, categoria = EXCLUDED.categoria, valor = EXCLUDED.valor,
      vencimento = EXCLUDED.vencimento, pago_em = EXCLUDED.pago_em, cancelada = EXCLUDED.cancelada, cliente_id = EXCLUDED.cliente_id, financas_cliente_id = EXCLUDED.financas_cliente_id,
      equipe_id = EXCLUDED.equipe_id, forma_pagamento = EXCLUDED.forma_pagamento, comprovante_url = EXCLUDED.comprovante_url, conta_bancaria_id = EXCLUDED.conta_bancaria_id,
      importado_em = now(), atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.transferencias = await subir(plano.transferencias, (j) => tx`INSERT INTO vybe_financas_transferencias (origem_financas_id, descricao, categoria, valor, data, efetivada_em, cancelada,
      conta_origem_id, conta_destino_id, forma_pagamento, comprovante_url)
    SELECT x.origem_financas_id, x.descricao, x.categoria, x.valor, x.data, x.efetivada_em, x.cancelada, o.id, d.id, x.forma_pagamento, x.comprovante_url
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, descricao text, categoria text, valor numeric, data date, efetivada_em date, cancelada boolean, conta uuid,
      conta_destino uuid, forma_pagamento text, comprovante_url text)
      LEFT JOIN vybe_financas_contas_bancarias o ON o.origem_financas_id = x.conta
      LEFT JOIN vybe_financas_contas_bancarias d ON d.origem_financas_id = x.conta_destino
    ON CONFLICT (origem_financas_id) DO UPDATE SET descricao = EXCLUDED.descricao, categoria = EXCLUDED.categoria, valor = EXCLUDED.valor, data = EXCLUDED.data,
      efetivada_em = EXCLUDED.efetivada_em, cancelada = EXCLUDED.cancelada, conta_origem_id = EXCLUDED.conta_origem_id, conta_destino_id = EXCLUDED.conta_destino_id,
      forma_pagamento = EXCLUDED.forma_pagamento, comprovante_url = EXCLUDED.comprovante_url, atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);

  r.orcamentos = await subir(plano.orcamentos, (j) => tx`INSERT INTO vybe_financas_orcamento_mensal (origem_financas_id, mes, categoria, valor)
    SELECT x.origem_financas_id, x.mes, x.categoria, x.valor FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, mes text, categoria text, valor numeric)
    ON CONFLICT (origem_financas_id) DO UPDATE SET mes = EXCLUDED.mes, categoria = EXCLUDED.categoria, valor = EXCLUDED.valor, atualizado_em = now()
    RETURNING (xmax = 0) AS novo`);
  r.fechamentos = await subir(plano.fechamentos, (j) => tx`INSERT INTO vybe_financas_fechamentos (origem_financas_id, mes, fechado_em, fechado_por_email, observacoes)
    SELECT x.origem_financas_id, x.mes, COALESCE(x.fechado_em, now()), x.fechado_por_email, x.observacoes
    FROM jsonb_to_recordset(${j}::jsonb) AS x(origem_financas_id uuid, mes text, fechado_em timestamptz, fechado_por_email text, observacoes text)
    ON CONFLICT (origem_financas_id) DO UPDATE SET mes = EXCLUDED.mes, fechado_em = EXCLUDED.fechado_em, fechado_por_email = EXCLUDED.fechado_por_email, observacoes = EXCLUDED.observacoes
    RETURNING (xmax = 0) AS novo`);

  // O que saiu do Finanças desde a última rodada sai daqui também (só linha importada). Equipe e conta bancária ficam
  // inativas em vez de apagadas (podem ter vale ou lançamento apontando), e quem saiu da equipe mantém o histórico de
  // remuneração. Tabela que não deu para ler não remove nada.
  const fora = (lista) => ids(lista), leu = (t) => plano.lidas.includes(t);
  const apagadas = (linhas) => linhas.length;
  r.removidos = {
    recebiveis: apagadas(await tx`DELETE FROM vybe_comercial_recebiveis WHERE origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.recebiveis)}::jsonb) AS v) RETURNING id`),
    contas: apagadas(await tx`DELETE FROM vybe_comercial_contas WHERE origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.contas)}::jsonb) AS v) RETURNING id`),
    transferencias: apagadas(await tx`DELETE FROM vybe_financas_transferencias WHERE origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.transferencias)}::jsonb) AS v) RETURNING id`),
    contratos: !leu('contracts') ? 0 : apagadas(await tx`DELETE FROM vybe_cliente_contratos WHERE origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.contratos)}::jsonb) AS v) RETURNING id`),
    assinaturas: apagadas(await tx`DELETE FROM vybe_financas_assinaturas WHERE origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.assinaturas)}::jsonb) AS v) RETURNING id`),
    historico: !leu('employee_compensation_history') ? 0 : apagadas(await tx`DELETE FROM vybe_financas_equipe_historico h USING vybe_financas_equipe e
      WHERE e.id = h.equipe_id AND e.origem_financas_id IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.equipe)}::jsonb) AS v) AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(${JSON.stringify(plano.historico)}::jsonb) AS x(equipe uuid, vigente_desde text)
        WHERE x.equipe = e.origem_financas_id AND x.vigente_desde = h.vigente_desde) RETURNING h.id`),
    equipe_inativada: apagadas(await tx`UPDATE vybe_financas_equipe SET ativo = false, atualizado_em = now() WHERE ativo AND origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.equipe)}::jsonb) AS v) RETURNING id`),
    contas_bancarias_inativadas: !leu('bank_accounts') ? 0 : apagadas(await tx`UPDATE vybe_financas_contas_bancarias SET ativo = false, atualizado_em = now() WHERE ativo
      AND origem_financas_id IS NOT NULL AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.contas_bancarias)}::jsonb) AS v) RETURNING id`),
    clientes_origem: apagadas(await tx`DELETE FROM vybe_financas_clientes_origem
      WHERE origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.clientes)}::jsonb) AS v) RETURNING origem_financas_id`),
    orcamentos: !leu('monthly_budgets') ? 0 : apagadas(await tx`DELETE FROM vybe_financas_orcamento_mensal WHERE origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.orcamentos)}::jsonb) AS v) RETURNING id`),
    fechamentos: !leu('period_closures') ? 0 : apagadas(await tx`DELETE FROM vybe_financas_fechamentos WHERE origem_financas_id IS NOT NULL
      AND origem_financas_id NOT IN (SELECT v::uuid FROM jsonb_array_elements_text(${fora(plano.fechamentos)}::jsonb) AS v) RETURNING mes`),
  };
  // Só contagens no registro da rodada (nenhum valor em dinheiro, nenhum nome).
  await tx`INSERT INTO vybe_financas_importacoes (resumo) VALUES (${JSON.stringify({ ...r, sem_par: plano.pendencias.clientes_sem_par.length,
    nao_importados: plano.pendencias.nao_importados.length, ajustes: plano.pendencias.ajustes.length, sem_acesso: plano.pendencias.sem_acesso })}::jsonb)`;
  return r;
}

// ---------- 4. Conferência ----------
const statusDe = (t) => (pago(t) ? 'PAID' : pendente(t) ? 'PENDING' : 'CANCELADO');
// Soma e quantidade por mês × tipo × status e por cliente, total em atraso, folha do mês e número de contratos.
export function agregados(base, { hoje, mes = String(hoje).slice(0, 7) }) {
  const porMes = new Map(), porCliente = new Map();
  for (const t of base.transacoes) {
    const m = String(t.date || '').slice(0, 7) || 'sem data', k = `${m}|${t.type}|${statusDe(t)}`;
    const a = porMes.get(k) || { mes: m, tipo: t.type, status: statusDe(t), quantidade: 0, soma: 0 };
    a.quantidade++; a.soma += centavos(t.amount); porMes.set(k, a);
    if (t.type !== 'INCOME' && t.type !== 'EXPENSE') continue;
    const c = t.client_id ? String(t.client_id) : '(sem cliente)', b = porCliente.get(c) || { cliente: c, receitas: 0, soma_receitas: 0, despesas: 0, soma_despesas: 0 };
    if (t.type === 'INCOME') { b.receitas++; b.soma_receitas += centavos(t.amount); } else { b.despesas++; b.soma_despesas += centavos(t.amount); }
    porCliente.set(c, b);
  }
  const inad = calc.inadimplencia(base.transacoes, hoje), folha = calc.folhaDoMes(base.funcionarios, base.historico, mes);
  return {
    por_mes: [...porMes.values()].map((a) => ({ ...a, soma: reais(a.soma) })).sort((a, b) => `${a.mes}|${a.tipo}|${a.status}`.localeCompare(`${b.mes}|${b.tipo}|${b.status}`)),
    por_cliente: [...porCliente.values()].map((b) => ({ ...b, soma_receitas: reais(b.soma_receitas), soma_despesas: reais(b.soma_despesas) })).sort((a, b) => a.cliente.localeCompare(b.cliente)),
    em_atraso: { total: inad.total, faturas: inad.faturas, clientes: inad.clientes.length },
    folha: { mes, total: folha.total, pessoas: folha.quantidade },
    contratos: base.contratos.length, clientes: base.clientes.length, assinaturas: base.assinaturas.length, lancamentos: base.transacoes.length,
  };
}

// Compara sem depender da ordem das listas nem das chaves (a ordem de empates não é número).
function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico).map((x) => JSON.stringify(x)).sort().map((s) => JSON.parse(s));
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonico(v[k])]));
  return v === undefined ? null : v;
}
const igual = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));
const mesesDaBase = (base, hoje) => {
  const dias = base.transacoes.flatMap((t) => [t.date, t.paid_date]).filter(Boolean).map((d) => String(d).slice(0, 7)).filter(calc.ehMes).sort();
  const de = dias[0] || hoje.slice(0, 7), ate = [dias[dias.length - 1] || hoje.slice(0, 7), hoje.slice(0, 7)].sort()[1], out = [];
  for (let m = de; m <= ate && out.length < 240; m = calc.somarMeses(m, 1)) out.push(m);
  return out;
};

// Como o cliente foi ligado (cnpj, nome ou, depois de gravado, id) não é número: sai da comparação.
function semComoLigou(v) {
  if (Array.isArray(v)) return v.map(semComoLigou);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'por' && k !== 'ligado_por').map(([k, x]) => [k, semComoLigou(x)]));
  return v;
}
// Linha a linha, além das contas (um salário-base com histórico, por exemplo, não entra em conta nenhuma). Só o que
// é o mesmo dado escrito de dois jeitos é igualado: texto vazio × nulo, baixa de PAID sem paid_date (= o date),
// status fora de PAID/PENDING (= cancelado), e o que o Vybe OS não guarda por não ter uso (funcionário numa receita).
function linhasComparaveis(b) {
  const s = (v) => (v == null ? '' : String(v)), n = (v) => (v == null ? null : Number(v));
  return {
    clientes: b.clientes.map((c) => ({ id: c.id, nome: s(c.name), cnpj: s(c.cnpj), mensalidade: centavos(c.monthly_fee), dia: n(c.due_day), status: s(c.contract_status) })),
    transacoes: b.transacoes.map((t) => ({ id: t.id, descricao: s(t.description), valor: centavos(t.amount), tipo: t.type, categoria: s(t.category), dia: s(t.date), status: statusDe(t),
      baixa: pago(t) ? s(t.paid_date) || s(t.date) : '', cliente: t.type === 'TRANSFER' ? '' : s(t.client_id), funcionario: t.type === 'EXPENSE' ? s(t.employee_id) : '' })),
    funcionarios: b.funcionarios.map((f) => ({ id: f.id, nome: s(f.name).trim() || 'Sem nome', cargo: s(f.role), salario: centavos(f.salary), bonus: centavos(f.bonus), dia: n(f.payment_day) })),
    historico: b.historico.filter((h) => calc.ehMes(h.effective_month)).map((h) => ({ funcionario: h.employee_id, mes: h.effective_month, salario: centavos(h.salary), bonus: centavos(h.bonus) })),
    assinaturas: b.assinaturas.map((a) => ({ id: a.id, nome: s(a.name).trim() || 'Assinatura', custo: centavos(a.cost), dia: n(a.renewal_day), ativa: a.active !== false })),
    contratos: b.contratos.map((c) => ({ id: c.id, cliente: s(c.client_id), titulo: s(c.title), valor: centavos(c.amount), status: s(c.status), inicio: s(c.start_date), assinatura: s(c.signed_date),
      fim: s(c.end_date), dia: n(c.due_day), pdf: Boolean(c.tem_pdf) })),
  };
}
// As funções de shared/financas-calculos.js nas duas bases (antes = ponte, depois = banco do Vybe OS), mês a mês.
// vybe: os clientes ativos do Vybe OS como estão hoje; vybeDepois: os mesmos depois da gravação (já com
// financas_cliente_id). Assim a conta de "antes" é a de hoje de verdade. Critério: diferencas.length === 0.
export function conferir(antes, depois, vybe, { hoje, vybeDepois = vybe }) {
  const diferencas = [], contas = [];
  const comparar = (nome, mes, fn) => { const a = semComoLigou(fn(antes, vybe)), d = semComoLigou(fn(depois, vybeDepois)); contas.push(nome);
    if (!igual(a, d)) diferencas.push({ conta: nome, mes: mes || '', antes: a, depois: d }); };
  const ligar = (b, v) => calc.ligarClientes(b.clientes, v);
  const nomes = (b) => Object.fromEntries(b.clientes.map((c) => [c.id, c.name]));
  for (const mes of new Set([...mesesDaBase(antes, hoje), ...mesesDaBase(depois, hoje)])) {
    comparar('resumoMes', mes, (b) => calc.resumoMes(b.transacoes, b.clientes, mes));
    comparar('despesasPorCategoria', mes, (b) => calc.despesasPorCategoria(b.transacoes, mes));
    comparar('folhaDoMes', mes, (b) => calc.folhaDoMes(b.funcionarios, b.historico, mes));
    comparar('margemPorCliente', mes, (b) => calc.margemPorCliente(b.transacoes, mes, 3));
    comparar('serieMensal', mes, (b) => calc.serieMensal(b.transacoes, mes, 12, 6));
  }
  comparar('custosFixos', '', (b) => calc.custosFixos(b.assinaturas));
  comparar('inadimplencia', '', (b) => calc.inadimplencia(b.transacoes, hoje));
  comparar('ligarClientes', '', (b, v) => ligar(b, v));
  comparar('contratosDoFinancas', '', (b, v) => calc.contratosDoFinancas(b.contratos, ligar(b, v), nomes(b), hoje));
  comparar('recebiveisDoFinancas', '', (b, v) => calc.recebiveisDoFinancas(b.transacoes, ligar(b, v).porFinancas, nomes(b), v));
  comparar('contasDoFinancas', '', (b) => calc.contasDoFinancas(b.transacoes));
  comparar('agregados', '', (b) => agregados(b, { hoje }));
  comparar('linhas', '', (b) => linhasComparaveis(b));
  return { iguais: !diferencas.length, contas_feitas: contas.length, diferencas };
}
export const basesIguais = igual;

// ---------- 5. Relatório ----------
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const totais = (b) => Object.fromEntries(['clientes', 'transacoes', 'funcionarios', 'historico', 'assinaturas', 'contratos'].map((k) => [k, b[k].length]));
export function relatorio({ modo, quando, hoje, origem, plano, antes, depois, conferencia, gravacao = null, segunda = null, ponte = null, avisos = [] }) {
  const L = [], p = plano.pendencias, a = agregados(antes, { hoje }), d = depois ? agregados(depois, { hoje }) : null;
  const nomeDe = Object.fromEntries(antes.clientes.map((c) => [c.id, c.name]));
  L.push(`# Importação do Vybe Finanças para o Vybe OS — ${modo}`, '', `Gerado em ${quando}. Dia de referência: ${hoje}.`, '');
  for (const x of avisos) L.push(`> ${x}`, '');
  L.push('## Resultado', '');
  L.push(conferencia ? (conferencia.iguais ? `**Diferença zero**: ${conferencia.contas_feitas} contas de \`shared/financas-calculos.js\` deram o mesmo resultado nas duas fontes.`
    : `**${conferencia.diferencas.length} diferença(s)** em ${conferencia.contas_feitas} contas. Não ligar a chave \`VYBE_FINANCAS_FONTE=local\` antes de resolver.`) : 'Conferência não feita.', '');
  if (ponte) L.push(ponte.igual ? 'A leitura do importador é igual à leitura da ponte (`server/vybe-financas.js`).' : '**A leitura do importador difere da leitura da ponte.** Conferir antes de gravar.', '');
  L.push('## O que foi lido do Finanças e para onde vai', '', '| Do Finanças | Linhas | No Vybe OS | Linhas |', '| --- | ---: | --- | ---: |',
    `| clients | ${origem.clients.length} | vybe_financas_clientes_origem | ${plano.clientes.length} |`,
    `| transactions | ${origem.transactions.length} | recebíveis + contas + transferências | ${plano.recebiveis.length} + ${plano.contas.length} + ${plano.transferencias.length} |`,
    `| employees | ${origem.employees.length} | vybe_financas_equipe | ${plano.equipe.length} |`,
    `| employee_compensation_history | ${origem.employee_compensation_history.length} | vybe_financas_equipe_historico | ${plano.historico.length} |`,
    `| subscriptions | ${origem.subscriptions.length} | vybe_financas_assinaturas | ${plano.assinaturas.length} |`,
    `| contracts | ${origem.contracts.length} | vybe_cliente_contratos | ${plano.contratos.length} |`,
    `| bank_accounts | ${origem.bank_accounts.length} | vybe_financas_contas_bancarias | ${plano.contas_bancarias.length} |`,
    `| monthly_budgets | ${origem.monthly_budgets.length} | vybe_financas_orcamento_mensal | ${plano.orcamentos.length} |`,
    `| period_closures | ${origem.period_closures.length} | vybe_financas_fechamentos | ${plano.fechamentos.length} |`, '');
  if (gravacao) {
    L.push('## O que a gravação fez', '', '| Tabela | Novos | Atualizados |', '| --- | ---: | ---: |');
    for (const [k, v] of Object.entries(gravacao)) if (v && typeof v === 'object' && 'novos' in v) L.push(`| ${k} | ${v.novos} | ${v.atualizados} |`);
    L.push('', `Clientes do Vybe OS que ganharam \`financas_cliente_id\`: ${gravacao.clientes_ligados}. Removidos por terem saído do Finanças: ${Object.values(gravacao.removidos).reduce((s, n) => s + n, 0)}.`, '');
  }
  if (segunda) {
    const novos = Object.values(segunda).reduce((s, v) => s + (v && typeof v === 'object' && 'novos' in v ? v.novos : 0), 0);
    L.push(`Segunda rodada seguida (idempotência): ${novos} linha(s) nova(s)${novos ? ' — **deveria ser zero**' : ', nada duplicado'}.`, '');
  }
  L.push('## Antes × depois', '', '| | Antes (ponte) | Depois (Vybe OS) |', '| --- | ---: | ---: |');
  const lin = (rotulo, x, y) => L.push(`| ${rotulo} | ${x} | ${d ? y : '—'} |`);
  lin('Lançamentos', a.lancamentos, d?.lancamentos); lin('Clientes do Finanças', a.clientes, d?.clientes); lin('Contratos', a.contratos, d?.contratos);
  lin('Assinaturas', a.assinaturas, d?.assinaturas); lin('Total em atraso', brl(a.em_atraso.total), brl(d?.em_atraso.total)); lin('Faturas em atraso', a.em_atraso.faturas, d?.em_atraso.faturas);
  lin(`Folha de ${a.folha.mes}`, brl(a.folha.total), brl(d?.folha.total)); lin('Pessoas na folha', a.folha.pessoas, d?.folha.pessoas);
  L.push('', '### Por mês × tipo × status', '', '| Mês | Tipo | Status | Qtd antes | Soma antes | Qtd depois | Soma depois | |', '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |');
  const chave = (x) => `${x.mes}|${x.tipo}|${x.status}`, dm = new Map((d?.por_mes || []).map((x) => [chave(x), x]));
  for (const x of a.por_mes) { const y = dm.get(chave(x)); dm.delete(chave(x));
    L.push(`| ${x.mes} | ${x.tipo} | ${x.status} | ${x.quantidade} | ${brl(x.soma)} | ${y ? y.quantidade : d ? 0 : '—'} | ${y ? brl(y.soma) : d ? brl(0) : '—'} | ${!d ? '' : y && y.quantidade === x.quantidade && y.soma === x.soma ? 'igual' : '**difere**'} |`); }
  for (const y of dm.values()) L.push(`| ${y.mes} | ${y.tipo} | ${y.status} | 0 | ${brl(0)} | ${y.quantidade} | ${brl(y.soma)} | **difere** |`);
  L.push('', '### Por cliente', '', '| Cliente (no Finanças) | Receitas antes | Soma | Despesas antes | Soma | Depois |', '| --- | ---: | ---: | ---: | ---: | --- |');
  const dc = new Map((d?.por_cliente || []).map((x) => [x.cliente, x]));
  for (const x of a.por_cliente) { const y = dc.get(x.cliente); dc.delete(x.cliente);
    L.push(`| ${nomeDe[x.cliente] || (x.cliente === '(sem cliente)' ? x.cliente : 'cliente apagado no Finanças')} | ${x.receitas} | ${brl(x.soma_receitas)} | ${x.despesas} | ${brl(x.soma_despesas)} | ${!d ? '—' : y && igual(x, y) ? 'igual' : '**difere**'} |`); }
  for (const y of dc.values()) L.push(`| ${nomeDe[y.cliente] || y.cliente} | 0 | ${brl(0)} | 0 | ${brl(0)} | **difere** (só no depois) |`);
  if (conferencia && !conferencia.iguais) {
    L.push('', '## Diferenças nas contas', '');
    for (const x of conferencia.diferencas.slice(0, 40)) L.push(`- ${x.conta}${x.mes ? ' de ' + x.mes : ''}`);
    if (conferencia.diferencas.length > 40) L.push(`- … e mais ${conferencia.diferencas.length - 40}`);
  }
  L.push('', '## Para o Paulo decidir', '', `### Clientes do Finanças sem par no Vybe OS (${p.clientes_sem_par.length})`, '',
    'Não viram cliente do Vybe OS. O histórico deles entra e aparece com o nome de lá, como hoje.', '');
  for (const c of p.clientes_sem_par) L.push(`- ${c.nome}${c.status ? ` (${c.status})` : ''}`);
  L.push('', `### Ligados por nome parecido (${p.clientes_por_nome_parecido.length}) — conferir`, '');
  for (const c of p.clientes_por_nome_parecido) L.push(`- "${c.financas_nome}" (Finanças) → "${c.vybe_nome}" (Vybe OS)`);
  L.push('', `### Clientes ativos do Vybe OS sem cadastro no Finanças (${p.clientes_do_vybe_sem_par.length})`, '');
  for (const c of p.clientes_do_vybe_sem_par) L.push(`- ${c.nome}`);
  if (p.conflitos_de_ligacao.length) { L.push('', `### Ligações que não foram gravadas (${p.conflitos_de_ligacao.length})`, ''); for (const c of p.conflitos_de_ligacao) L.push(`- ${c.nome}: ${c.motivo}`); }
  L.push('', `### Equipe do Finanças sem pessoa do Vybe OS (${p.equipe_sem_par.length})`, '', 'Entram na folha pelo nome de lá; a ligação com a pessoa do painel fica para decidir.', '');
  for (const e of p.equipe_sem_par) L.push(`- ${e.nome}${e.sugestao ? ` — parecido com "${e.sugestao}"` : ''}`);
  L.push('', '## O que não entrou ou foi ajustado', '');
  L.push(`- Tabelas que o papel de leitura não enxerga: ${p.sem_acesso.length ? p.sem_acesso.join(', ') + ' (liberar com docs/vybe-financas-acesso-importacao.sql)' : 'nenhuma'}.`);
  if (p.colunas_ausentes.length) L.push(`- Colunas que esta versão do Finanças não tem: ${p.colunas_ausentes.join(', ')}.`);
  L.push(`- Contas bancárias só com a referência do lançamento, sem nome: ${p.contas_bancarias_sem_nome}.`);
  L.push(`- Linhas não importadas: ${p.nao_importados.length}.`);
  const motivos = new Map(); for (const n of p.nao_importados) motivos.set(`${n.tabela}: ${n.motivo}`, (motivos.get(`${n.tabela}: ${n.motivo}`) || 0) + 1);
  for (const [m, n] of motivos) L.push(`  - ${m} (${n})`);
  L.push(`- Valores ou textos ajustados: ${p.ajustes.length}.`);
  const aj = new Map(); for (const n of p.ajustes) aj.set(n.motivo, (aj.get(n.motivo) || 0) + 1);
  for (const [m, n] of aj) L.push(`  - ${m} (${n})`);
  L.push('', `Linhas por tabela na leitura das contas — antes: ${JSON.stringify(totais(antes))}${depois ? `; depois: ${JSON.stringify(totais(depois))}` : ''}.`, '');
  return L.join('\n');
}
