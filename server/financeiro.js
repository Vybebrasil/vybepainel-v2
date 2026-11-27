// server/financeiro.js — o Financeiro do Vybe OS sem o Vybe Finanças (Paulo, 13/11/2026: "quero me livrar 100% de lá").
//
// GET  /api/painel?area=financeiro[&mes=AAAA-MM]   tudo que as telas usam, já calculado (shared/financeiro-extrato.js)
// POST /api/painel?area=financeiro { acao, ... }
//   previa       { csv }                 lê o extrato da conta PJ (CSV ou OFX do Santander) e devolve a prévia — NÃO grava nada
//   importar     { csv }                 grava os lançamentos novos (reimportar o mesmo arquivo, ou o OFX do mesmo período, não duplica)
//   editar       { id, mudanca }         o lado real de um lançamento: categoria, partes, status, cliente, competência…
//   conferir_varios { ids, conferido }   marca vários como conferidos de uma vez
//   regra_salvar { regra, reaplicar }    regra do Paulo ("Pix para X = combustível"); reaplica nos não conferidos
//   regra_remover { id }
//   fixo_salvar  { fixo } / fixo_remover { id }
//   cartao_salvar { item } / cartao_remover { id }
//   cartao_vencimento { cartao, dia }   o dia do mês em que a fatura do cartão vence (chave financeiro_cartoes)
//   cenario_salvar { cenario } / cenario_remover { id }
//   lancar_mao   { lancamento, fixo? }   o que não passou pelo banco; com fixo.repete (saída), vira também gasto fixo
//   apagar       { id }                  tira o lançamento e guarda na lixeira (o do banco não volta ao reimportar)
//   restaurar    { id }                  devolve o que foi apagado (o "Desfazer")
//   conferir_lote { itens: [{ id, mudanca }], regras } confirma muitos de uma vez; cada confirmação pode virar regra
//   fixo_de_lancamento { id, dia? }      "isto se repete todo mês": o lançamento vira gasto fixo (e fica ligado a ele)
//   contrato_salvar { cliente_id, valor_mensal, dia_vencimento, inicio, fim, reajuste_em, reajuste_pct, status }
//   orcamento_salvar { mes, grupos } / orcamento_copiar { de, para, pct }
//   fechar_mes { mes } / reabrir_mes { mes, motivo }  o mês fechado não aceita edição até reabrir
//   cobrar       { cliente_id, cliente_nome, atraso_dias }  só registra e avisa os donos (o bot NÃO fala com o cliente)
//   meta_salvar  { metas: { mrr, margem_pct, caixa_minimo } }
//
// Quem: só os quatro donos (server/donos.js), sempre. Dinheiro da Vybe não passa por "quem administra".
// Onde: vybe_carteira_config (chave/valor jsonb, chaves financeiro_*) e, desde 26/11/2026, as tabelas próprias de
// server/financeiro-tabelas.js: cada escrita grava o jsonb (com FOR UPDATE, na mesma transação) e espelha nas tabelas; a
// leitura vem das tabelas e volta sozinha para o jsonb se elas faltarem ou não baterem. VYBE_FIN_LER=jsonb força o jsonb.
import X from '../shared/financeiro-extrato.js';
import { ehDonoPessoa } from './donos.js';
import { autenticarAssistente } from './assistente-servico.js';
import { FONTE, baseDoExtrato, lancamentosDaBase, parteDaBase } from './financeiro-fonte.js';
import A from '../shared/financeiro-analises.js';
import { prepararTabelas, lerDasTabelas, espelharNaTransacao, garantirTabelasFinanceiro, estadoTabelas } from './financeiro-tabelas.js';
import { dadosExtras, montarAnalise } from './financeiro-analise.js';
import { registrarAviso } from './campos-d3.js';

export const CHAVES = Object.freeze({ extrato: 'financeiro_extrato', regras: 'financeiro_regras', fixos: 'financeiro_fixos', cartao: 'financeiro_cartao', cenarios: 'financeiro_cenarios', vorcaro: 'financeiro_vorcaro',
  // Vencimento da fatura por cartão (14/11/2026): { 'Cartão da agência': { dia: 20 } }, editável pelos donos.
  cartoes: 'financeiro_cartoes',
  // Salário/pró-labore combinado por pessoa (14/11/2026): { '<pessoa_id>': { valor, desde: 'AAAA-MM' } }, e os ajustes do
  // vale lançados à mão ("devolveu", "abater"): [{ id, pessoa_id, mes, tipo, valor, nota }]. Chaves novas, sem migração.
  salarios: 'financeiro_salarios', vales: 'financeiro_vales',
  // 26/11/2026: orçamento { 'AAAA-MM': { grupo: valor } }, meses fechados { 'AAAA-MM': { situacao, em, por_nome, totais } } e metas.
  orcamento: 'financeiro_orcamento', fechamentos: 'financeiro_fechamentos', metas: 'financeiro_metas',
  // 27/11/2026: os apelidos ({ '<pessoa_id>': ['Apelido'] }) e as junções de pessoas duplicadas ({ '<id que saiu>': { para,
  // em, por, desfazer } }) que ligam as saídas do extrato a quem recebeu. Chave nova no mesmo jsonb dos salários.
  pessoas_extra: 'financeiro_pessoas' });
const VAZIO = { extrato: { transacoes: [], importacoes: [] }, regras: [], fixos: [], cartao: [], cenarios: [], vorcaro: { propostas: [] }, cartoes: {}, salarios: {}, vales: [], orcamento: {}, fechamentos: {}, metas: {},
  pessoas_extra: { apelidos: {}, juntadas: {} } };
const ID_PESSOA = /^[A-Za-z0-9_-]{1,40}$/;
export function normalizarPessoasExtra(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const apelidos = {}, juntadas = {};
  for (const [id, l] of Object.entries(o.apelidos && typeof o.apelidos === 'object' ? o.apelidos : {}))
    if (ID_PESSOA.test(id) && Array.isArray(l)) { const a = [...new Set(l.map((x) => String(x || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 10); if (a.length) apelidos[id] = a; }
  for (const [id, j] of Object.entries(o.juntadas && typeof o.juntadas === 'object' ? o.juntadas : {}))
    if (ID_PESSOA.test(id) && j && ID_PESSOA.test(String(j.para || '')) && String(j.para) !== id) juntadas[id] = j;
  return { apelidos, juntadas };
}
const LIMITE_CSV = 2_000_000;

const erro = (status, message) => Object.assign(new Error(message), { status });
const hojeNaBahia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const json = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } } return v ?? null; };

export async function lerTudo(sql, { env = process.env } = {}) {
  // As tabelas próprias (server/financeiro-tabelas.js): criadas e copiadas do jsonb no primeiro uso. Se não der, o jsonb.
  const tab = String(env?.VYBE_FIN_LER || '').toLowerCase() !== 'jsonb' && await prepararTabelas(sql) ? await lerDasTabelas(sql, env) : null;
  const linhas = tab
    ? await sql`SELECT chave, CASE WHEN chave = 'financeiro_extrato' THEN valor - 'transacoes' - 'lixeira' ELSE valor END AS valor FROM vybe_carteira_config WHERE chave LIKE 'financeiro\_%'`
    : await sql`SELECT chave, valor FROM vybe_carteira_config WHERE chave LIKE 'financeiro\_%'`;
  const por = new Map(linhas.map((l) => [l.chave, json(l.valor)]));
  if (tab) {
    const ext = por.get(CHAVES.extrato) || {};
    por.set(CHAVES.extrato, { ...ext, transacoes: tab.transacoes, lixeira: tab.lixeira });
    for (const k of ['regras', 'fixos', 'cartao', 'cenarios', 'cartoes', 'orcamento', 'fechamentos']) por.set(CHAVES[k], tab[k]);
  }
  const out = {};
  for (const [k, chave] of Object.entries(CHAVES)) out[k] = por.get(chave) ?? structuredClone(VAZIO[k]);
  if (!Array.isArray(out.extrato?.transacoes)) out.extrato = structuredClone(VAZIO.extrato);
  for (const k of ['regras', 'fixos', 'cartao', 'cenarios']) if (!Array.isArray(out[k])) out[k] = [];
  if (!Array.isArray(out.vorcaro?.propostas)) out.vorcaro = { propostas: [] };
  if (!out.cartoes || typeof out.cartoes !== 'object' || Array.isArray(out.cartoes)) out.cartoes = {};
  if (!out.salarios || typeof out.salarios !== 'object' || Array.isArray(out.salarios)) out.salarios = {};
  if (!Array.isArray(out.vales)) out.vales = [];
  for (const k of ['orcamento', 'fechamentos', 'metas']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  out.pessoas_extra = normalizarPessoasExtra(out.pessoas_extra);
  Object.defineProperty(out, 'fonte', { value: tab ? 'tabelas' : 'jsonb', enumerable: false });
  return out;
}
// Lê uma chave travada, aplica a mudança e grava (uma transação).
async function mudar(sql, parte, pessoaId, fn) {
  const chave = CHAVES[parte];
  return sql.comTransacao(async (tx) => {
    await tx`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por) VALUES (${chave}, ${JSON.stringify(VAZIO[parte])}::jsonb, ${pessoaId}) ON CONFLICT (chave) DO NOTHING`;
    const [l] = await tx`SELECT valor FROM vybe_carteira_config WHERE chave=${chave} FOR UPDATE`;
    const atual = json(l?.valor) ?? structuredClone(VAZIO[parte]);
    const antes = structuredClone(atual);
    const { valor, resposta } = await fn(atual);
    await tx`UPDATE vybe_carteira_config SET valor=${JSON.stringify(valor)}::jsonb, atualizado_por=${pessoaId}, atualizado_em=now() WHERE chave=${chave}`;
    await espelharNaTransacao(tx, [{ parte, antes, depois: valor }], pessoaId);
    return resposta;
  });
}

// Várias chaves travadas na mesma transação (lançar uma proposta mexe nas propostas e no extrato juntos).
// Ids do banco que um dono apagou: o reimportar não os traz de volta.
const idsApagados = (extrato = {}) => new Set((extrato.lixeira || []).map((t) => t.id));
async function mudarVarias(sql, partes, pessoaId, fn, { depois = null } = {}) {
  return sql.comTransacao(async (tx) => {
    const atuais = {};
    for (const parte of partes) {
      const chave = CHAVES[parte];
      await tx`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por) VALUES (${chave}, ${JSON.stringify(VAZIO[parte])}::jsonb, ${pessoaId}) ON CONFLICT (chave) DO NOTHING`;
      const [l] = await tx`SELECT valor FROM vybe_carteira_config WHERE chave=${chave} FOR UPDATE`;
      atuais[parte] = json(l?.valor) ?? structuredClone(VAZIO[parte]);
    }
    const antes = structuredClone(atuais);
    const { valores, resposta } = await fn(atuais);
    for (const [parte, valor] of Object.entries(valores))
      await tx`UPDATE vybe_carteira_config SET valor=${JSON.stringify(valor)}::jsonb, atualizado_por=${pessoaId}, atualizado_em=now() WHERE chave=${CHAVES[parte]}`;
    await espelharNaTransacao(tx, Object.entries(valores).map(([parte, valor]) => ({ parte, antes: antes[parte], depois: valor })), pessoaId);
    // O que mais precisa ir junto na mesma transação (a junção de pessoas marca a que saiu em vybe_pessoas).
    if (typeof depois === 'function') await depois(tx, resposta);
    return resposta;
  });
}

// Clientes ativos com a mensalidade (o "previsto" do mês a mês): contrato do Vybe OS, senão o valor de Finanças por cliente.
export async function clientesComMensalidade(sql) {
  let linhas;
  try {
    linhas = await sql`SELECT c.id::text AS cliente_id, c.nome AS cliente_nome,
      COALESCE(k.valor_mensal, f.valor_mensal)::float8 AS valor_mensal, k.inicio, k.renovacao AS fim, k.observacao, (k.cliente_id IS NOT NULL) AS tem_contrato, COALESCE(c.ativo,true) AS ativo,
      k.extra
    FROM vybe_clientes c
    LEFT JOIN LATERAL (SELECT cliente_id, valor_mensal, inicio, renovacao, to_jsonb(k) ->> 'observacao' AS observacao,
      jsonb_build_object('dia_vencimento', to_jsonb(k) -> 'dia_vencimento', 'fim', to_jsonb(k) -> 'fim', 'reajuste_em', to_jsonb(k) -> 'reajuste_em', 'reajuste_pct', to_jsonb(k) -> 'reajuste_pct', 'status', to_jsonb(k) -> 'status') AS extra
      FROM vybe_cliente_contratos k WHERE k.cliente_id=c.id ORDER BY (to_jsonb(k)->>'origem_financas_id') IS NULL DESC, k.atualizado_em DESC NULLS LAST LIMIT 1) k ON true
    LEFT JOIN vybe_comercial_financas_cliente f ON f.cliente_id=c.id
    WHERE NOT COALESCE(c.nao_e_cliente,false) ORDER BY c.nome`;
  } catch (e) {
    // Banco sem os contratos da Carteira: a mensalidade de Finanças por cliente; sem ela também, os clientes sem mensalidade.
    if (e.code !== '42P01' && e.code !== '42703') throw e;
    try {
      linhas = await sql`SELECT c.id::text AS cliente_id, c.nome AS cliente_nome, f.valor_mensal::float8 AS valor_mensal, NULL AS inicio, NULL AS fim, NULL AS observacao, false AS tem_contrato, COALESCE(c.ativo,true) AS ativo
        FROM vybe_clientes c LEFT JOIN vybe_comercial_financas_cliente f ON f.cliente_id=c.id ORDER BY c.nome`;
    } catch (e2) {
      if (e2.code !== '42P01' && e2.code !== '42703') throw e2;
      linhas = await sql`SELECT id::text AS cliente_id, nome AS cliente_nome, NULL::float8 AS valor_mensal, NULL AS inicio, NULL AS fim, NULL AS observacao, false AS tem_contrato, true AS ativo FROM vybe_clientes ORDER BY nome`;
    }
  }
  const dia = (v) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : '');
  // O contrato completo (26/11/2026): dia do vencimento, fim (vazio = sem fim) e reajuste. Sem as colunas, vazios.
  return linhas.map(({ extra, ...l }) => { const x = json(extra) || {};
    return { ...l, valor_mensal: Number(l.valor_mensal) || 0, inicio: dia(l.inicio), fim: dia(x.fim), renovacao: dia(l.fim), observacao: l.observacao || '', tem_contrato: Boolean(l.tem_contrato),
      dia_vencimento: Number(x.dia_vencimento) || null, reajuste_em: dia(x.reajuste_em), reajuste_pct: x.reajuste_pct == null ? null : Number(x.reajuste_pct), status: x.status || (l.tem_contrato ? 'ativo' : '') }; });
}

// O time (sócios incluídos) para o "Para quem" do extrato e a conta de cada pessoa. Sem a tabela: ninguém.
// A conta do VYBES (servico, server/conta-vybes.js) não recebe nem paga: fica fora.
// 27/11/2026: quem foi juntado a outra pessoa (juntada_em_id) também fica fora; tem_login diz quem entra no painel e dono
// quem é dono, para a junção nunca tirar de cena a pessoa que entra no sistema.
// Acesso de verdade (o mesmo critério do login, vybe_sessao.js): pode_entrar E (senha OU já entrou alguma vez). Ter e-mail
// sozinho não é acesso (28/11/2026: o cadastro sem acesso do Ewerton aparecia como "entra no painel" e travava a junção).
// Dono pela regra única de server/donos.js (flag dono, id do Monday ou id da conta), nunca por uma coluna solta.
const sim = (v) => v === true || v === 't' || v === 'true';
export function acessoDaPessoa(l = {}) {
  const tem_login = sim(l.pode_entrar) && (Boolean(l.senha_hash) || sim(l.tem_senha) || Boolean(l.ultimo_acesso));
  const dono = ehDonoPessoa({ id: Number(l.id), monday_user_id: l.monday_user_id ?? null, dono: sim(l.dono) });
  return { tem_login, dono };
}
export async function pessoasDoTime(sql) {
  const comAcesso = (p) => { const { pode_entrar, tem_senha, ultimo_acesso, monday_user_id, dono, ...resto } = p; return { ...resto, ...acessoDaPessoa(p) }; };
  try { return (await sql`SELECT id::text, nome, to_jsonb(p) ->> 'pode_entrar' AS pode_entrar, ((to_jsonb(p) ->> 'senha_hash') IS NOT NULL) AS tem_senha,
      to_jsonb(p) ->> 'ultimo_acesso' AS ultimo_acesso, to_jsonb(p) ->> 'monday_user_id' AS monday_user_id, to_jsonb(p) ->> 'dono' AS dono FROM vybe_pessoas p
    WHERE COALESCE(ativo, true) AND (to_jsonb(p) ->> 'servico') IS DISTINCT FROM 'true' AND (to_jsonb(p) ->> 'juntada_em_id') IS NULL ORDER BY nome`).map(comAcesso); }
  catch (e) { if (e.code !== '42P01' && e.code !== '42703') throw e; try { return (await sql`SELECT id::text, nome, to_jsonb(p) ->> 'pode_entrar' AS pode_entrar, ((to_jsonb(p) ->> 'senha_hash') IS NOT NULL) AS tem_senha,
      to_jsonb(p) ->> 'ultimo_acesso' AS ultimo_acesso, to_jsonb(p) ->> 'monday_user_id' AS monday_user_id, to_jsonb(p) ->> 'dono' AS dono FROM vybe_pessoas p
    WHERE (to_jsonb(p) ->> 'servico') IS DISTINCT FROM 'true' AND (to_jsonb(p) ->> 'juntada_em_id') IS NULL ORDER BY nome`).map(comAcesso); } catch { return []; } }
}

// ---------- Junção de pessoas duplicadas (Paulo, 27/11/2026: a mesma pessoa cadastrada duas vezes) ----------
// Nunca sozinha: só pela ação pessoa_juntar, que só um dono chama (pegarDono). Quem fica é a de mais dados, nesta ordem:
// entra no painel (acessoDaPessoa: pode_entrar e senha ou acesso), é dono, tem combinado, vales, lançamentos ligados à mão, apelidos; empate, o menor id.
// Recusa juntar quando as duas têm login (credencial não se move) ou quando a que sairia é dono.
export function dadosDaPessoaNaJuncao(base, id, linha = {}) {
  const s = base.salarios?.[id];
  let manuais = 0;
  for (const t of base.extrato?.transacoes || []) for (const p of X.pedacos(t)) if (String(p.pessoa_id || '') === id) manuais++;
  return { id, tem_login: Boolean(linha.tem_login), dono: Boolean(linha.dono), salario: s && !s.fora && Number(s.valor) > 0 ? 1 : 0,
    vales: (base.vales || []).filter((a) => String(a.pessoa_id) === id).length, lancamentos: manuais, apelidos: (normalizarPessoasExtra(base.pessoas_extra).apelidos[id] || []).length };
}
export function quemFicaNaJuncao(a, b) {
  const v = (x) => [x.tem_login ? 1 : 0, x.dono ? 1 : 0, x.salario, x.vales, x.lancamentos, x.apelidos, -Number(x.id) || 0];
  const va = v(a), vb = v(b);
  for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return va[i] > vb[i] ? a.id : b.id;
  return a.id;
}
// O que a junção muda nas chaves do Financeiro (pura, para testar): toda referência ao id que sai passa para quem fica, e
// o "desfazer" guarda exatamente o que mudou. a = { extrato, salarios, vales, pessoas_extra } (o jsonb atual).
export function juntarNaBase(a, de, para, { nomeDe = '', nomePara = '', por = '', em = new Date().toISOString() } = {}) {
  const lancamentos = [];
  const transacoes = (a.extrato?.transacoes || []).map((t) => {
    let mudou = false;
    const real = { ...t.real };
    if (String(real.pessoa_id || '') === de) { real.pessoa_id = para; real.pessoa_nome = nomePara || real.pessoa_nome; mudou = true; }
    if (Array.isArray(real.partes) && real.partes.some((p) => String(p.pessoa_id || '') === de)) {
      real.partes = real.partes.map((p) => (String(p.pessoa_id || '') === de ? { ...p, pessoa_id: para, pessoa_nome: nomePara || p.pessoa_nome } : p)); mudou = true;
    }
    if (!mudou) return t;
    lancamentos.push(t.id);
    return { ...t, real };
  });
  const salarios = { ...(a.salarios || {}) };
  const salarioDe = salarios[de] ?? null, salarioPara = salarios[para] ?? null;
  // O combinado: fica o de quem fica; se só a que sai tinha, ele passa.
  const paraTem = salarioPara && !salarioPara.fora && Number(salarioPara.valor) > 0;
  const moveu = Boolean(salarioDe && !salarioDe.fora && !paraTem);
  if (moveu) salarios[para] = salarioDe;
  delete salarios[de];
  const valesMovidos = (a.vales || []).filter((x) => String(x.pessoa_id) === de).map((x) => x.id);
  const vales = (a.vales || []).map((x) => (String(x.pessoa_id) === de ? { ...x, pessoa_id: para } : x));
  const extra = normalizarPessoasExtra(a.pessoas_extra);
  const apelidosAntes = { de: extra.apelidos[de] || null, para: extra.apelidos[para] || null };
  // O nome de quem sai vira apelido de quem fica: o Pix no nome antigo continua achando a pessoa.
  const novos = [...new Set([...(extra.apelidos[para] || []), ...(extra.apelidos[de] || []), ...(nomeDe ? [nomeDe] : [])])].slice(0, 10);
  const apelidos = { ...extra.apelidos };
  if (novos.length) apelidos[para] = novos;
  delete apelidos[de];
  // Quem tinha sido juntado à que sai passa a apontar para quem fica.
  const juntadas = Object.fromEntries(Object.entries(extra.juntadas).map(([k, j]) => [k, String(j.para) === de ? { ...j, para } : j]));
  juntadas[de] = { para, nome: nomeDe, para_nome: nomePara, em, por, desfazer: { lancamentos, vales: valesMovidos, salario_de: salarioDe, salario_para: salarioPara, apelidos: apelidosAntes } };
  return { valores: { extrato: { ...(a.extrato || {}), transacoes }, salarios, vales, pessoas_extra: { apelidos, juntadas } },
    resumo: { de, para, lancamentos: lancamentos.length, vales: valesMovidos.length, salario_movido: moveu } };
}
// Desfazer a junção: volta para quem saiu só o que a junção levou (o que mudou depois fica).
export function separarNaBase(a, de) {
  const extra = normalizarPessoasExtra(a.pessoas_extra);
  const j = extra.juntadas[de];
  if (!j) return null;
  const para = String(j.para), d = j.desfazer || {};
  const ids = new Set(d.lancamentos || []), nomeDe = j.nome || '';
  const transacoes = (a.extrato?.transacoes || []).map((t) => {
    if (!ids.has(t.id)) return t;
    const real = { ...t.real };
    if (String(real.pessoa_id || '') === para) { real.pessoa_id = de; real.pessoa_nome = nomeDe || real.pessoa_nome; }
    if (Array.isArray(real.partes)) real.partes = real.partes.map((p) => (String(p.pessoa_id || '') === para ? { ...p, pessoa_id: de, pessoa_nome: nomeDe || p.pessoa_nome } : p));
    return { ...t, real };
  });
  const vIds = new Set(d.vales || []);
  const vales = (a.vales || []).map((x) => (vIds.has(x.id) && String(x.pessoa_id) === para ? { ...x, pessoa_id: de } : x));
  const salarios = { ...(a.salarios || {}) };
  if (d.salario_de) salarios[de] = d.salario_de;
  if (d.salario_para) salarios[para] = d.salario_para; else if (d.salario_de) delete salarios[para];
  const apelidos = { ...extra.apelidos };
  if (d.apelidos?.para) apelidos[para] = d.apelidos.para; else delete apelidos[para];
  if (d.apelidos?.de) apelidos[de] = d.apelidos.de;
  const juntadas = { ...extra.juntadas };
  delete juntadas[de];
  return { valores: { extrato: { ...(a.extrato || {}), transacoes }, salarios, vales, pessoas_extra: { apelidos, juntadas } }, resumo: { de, para } };
}
// Em vybe_pessoas a que sai fica marcada (juntada_em_id = quem fica) e inativa, nunca apagada: desfazer devolve como estava.
async function linhasDaJuncao(sql, ids) {
  const out = new Map();
  for (const id of ids) {
    const [l] = await sql`SELECT id::text, nome, to_jsonb(p) ->> 'ativo' AS ativo, to_jsonb(p) ->> 'monday_user_id' AS monday_user_id, to_jsonb(p) ->> 'juntada_em_id' AS juntada_em_id,
      to_jsonb(p) ->> 'pode_entrar' AS pode_entrar, ((to_jsonb(p) ->> 'senha_hash') IS NOT NULL) AS tem_senha, to_jsonb(p) ->> 'ultimo_acesso' AS ultimo_acesso, to_jsonb(p) ->> 'dono' AS dono
      FROM vybe_pessoas p WHERE id::text = ${id}`;
    if (l) out.set(id, { id: l.id, nome: l.nome, ativo: l.ativo, juntada_em_id: l.juntada_em_id, ...acessoDaPessoa(l) });
  }
  return out;
}
// A regra única de ligação saída → pessoa (shared/financeiro-extrato.js › ligadorPessoas), com os apelidos, as junções e os
// clientes (nome de cliente no "Pago a" não vira pessoa). A mesma função serve Pessoas, Hoje e a Projeção.
export function ligadorDaBase(base, pessoas = [], clientes = []) {
  const extra = normalizarPessoasExtra(base.pessoas_extra);
  return X.ligadorPessoas(pessoas, { apelidos: extra.apelidos, juntadas: extra.juntadas, salarios: base.salarios || {}, lista: base.extrato?.transacoes || [],
    clientes: (clientes || []).map((c) => ({ id: c.cliente_id ?? c.id, nome: c.cliente_nome ?? c.nome })) });
}
// A conta de cada pessoa (combinado × pago × vale), para quem tem salário combinado ou lançamento ligado (27/11/2026: pela
// regra única, não só pelo "Pessoa do time"). Quem foi juntado a outra pessoa some daqui: tudo dele conta em quem ficou.
export function contasDasPessoas(base, pessoas = [], { hoje, clientes = [], ligar = null }) {
  const lista = base.extrato.transacoes, ate = hoje.slice(0, 7);
  const extra = normalizarPessoasExtra(base.pessoas_extra);
  const liga = ligar || ligadorDaBase(base, pessoas, clientes);
  const fora = new Set(Object.entries(base.salarios || {}).filter(([, s]) => s?.fora).map(([id]) => id));
  const juntou = (id) => Boolean(extra.juntadas[id]);
  const ids = new Set(Object.keys(base.salarios || {}).filter((id) => !fora.has(id) && !juntou(id)));
  const nome = new Map(pessoas.map((p) => [String(p.id), p.nome]));
  for (const t of lista) for (const p of X.pedacos(t)) {
    const l = liga(t, p);
    if (!l || !l.tipo) continue;
    const id = String(l.pessoa_id);
    if (!fora.has(id) && !juntou(id)) ids.add(id);
    if (!nome.has(id)) nome.set(id, l.pessoa_nome || p.pessoa_nome || 'Pessoa');
  }
  const dups = X.pessoasDuplicadas(pessoas, { juntadas: extra.juntadas });
  return [...ids].map((id) => ({ nome: nome.get(id) || 'Pessoa',
    ...X.contaPessoa(lista, id, { salario: base.salarios?.[id] || null, ajustes: (base.vales || []).filter((a) => String(a.pessoa_id) === id), ate, ligar: liga }),
    apelidos: extra.apelidos[id] || [],
    // Possível duplicado (Paulo, 27/11/2026): nunca junta sozinho; a tela mostra o aviso e o botão de juntar.
    duplicados: dups.filter((d) => d.ids.includes(id)).map((d) => { const o = d.ids[0] === id ? 1 : 0; return { pessoa_id: d.ids[o], nome: d.nomes[o] }; }) }))
    .sort((a, b) => b.vale - a.vale || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function montar(base, clientes, { mes, hoje, pessoas = [], extras = null }) {
  const lista = base.extrato.transacoes;
  const meses = X.mesesDa(lista);
  const mesAtual = mes || meses[meses.length - 1] || hoje.slice(0, 7);
  const mesesCliente = (() => { const fim = hoje.slice(0, 7), out = []; for (let i = 5; i >= 0; i--) out.push(X.somarMeses(fim, -i)); return out; })();
  const contratos = clientes.filter((c) => c.ativo && c.valor_mensal > 0).map((c) => ({ cliente_id: c.cliente_id, cliente_nome: c.cliente_nome, valor_mensal: c.valor_mensal, inicio: c.inicio, fim: c.fim || '', dia_vencimento: c.dia_vencimento || null }));
  const projBase = X.baseDaProjecao(lista);
  const ligar = ligadorDaBase(base, pessoas, clientes);
  const extraPes = normalizarPessoasExtra(base.pessoas_extra);
  const out = {
    hoje, mes: mesAtual, meses,
    categorias: X.CATEGORIAS, regras_padrao: X.REGRAS_PADRAO, regras: base.regras,
    transacoes: lista, importacoes: base.extrato.importacoes || [],
    // Lixeira (os 30 últimos apagados), para restaurar sem depender do "Desfazer" de poucos segundos.
    apagados: (base.extrato.lixeira || []).slice(0, 30).map((t) => ({ id: t.id, data: t.banco.data, historico: t.banco.historico, valor: t.banco.valor,
      do_banco: t.banco.saldo != null, apagado_em: t.apagado_em || '', apagado_por: t.apagado_por || '' })),
    total_apagados: (base.extrato.lixeira || []).length,
    resumo: X.resumo(lista, { mes: mesAtual }),
    serie: meses.map((m) => { const r = X.resumo(lista, { mes: m }); return { mes: m, entradas: r.entradas, saidas: r.saidas, cartao: r.cartao_e_transferencias, resultado: r.resultado, saldo_final: r.saldo_final, a_revisar: r.a_revisar }; }),
    a_revisar: lista.filter((t) => !t.real.conferido).length,
    clientes: clientes.map((c) => ({ id: c.cliente_id, nome: c.cliente_nome, mensalidade: c.valor_mensal, ativo: c.ativo, inicio: c.inicio || '', renovacao: c.renovacao || '', observacao: c.observacao || '', tem_contrato: Boolean(c.tem_contrato),
      dia_vencimento: c.dia_vencimento || null, fim: c.fim || '', reajuste_em: c.reajuste_em || '', reajuste_pct: c.reajuste_pct ?? null, status: c.status || '' })),
    por_cliente: { meses: mesesCliente, desde: meses[0] || '', linhas: X.porCliente(lista, contratos, mesesCliente, { desde: meses[0] || '9999-12', mesAtual: hoje.slice(0, 7) }) },
    fixos: base.fixos, fixos_analise: X.analisarFixos(base.fixos, lista, mesAtual, base.cartao),
    cartao: (() => {
      // O dia do vencimento de cada cartão; a fatura de AAAA-MM vence no dia dele nesse mês (dia 31 em mês curto = último dia).
      const venc = Object.fromEntries(Object.entries(base.cartoes || {}).map(([k, v]) => [k, Number(v?.dia) || null]).filter(([, d]) => d >= 1 && d <= 31));
      const vence = (cartao, fatura) => { const d = venc[cartao]; if (!d || !/^\d{4}-\d{2}$/.test(fatura)) return null; const ult = new Date(Date.UTC(Number(fatura.slice(0, 4)), Number(fatura.slice(5, 7)), 0)).getUTCDate(); return `${fatura}-${String(Math.min(d, ult)).padStart(2, '0')}`; };
      return { itens: base.cartao, faturas: X.cartao(base.cartao, lista).map((f) => ({ ...f, vence: vence(f.cartao, f.fatura) })), pagamentos_sem_fatura: X.pagamentosSemFatura(lista), vencimentos: venc };
    })(),
    projecao: { base: projBase, cenarios: base.cenarios },
    pessoas: pessoas.map((p) => ({ id: String(p.id), nome: p.nome, apelidos: extraPes.apelidos[String(p.id)] || [] })), salarios: base.salarios || {}, vales: base.vales || [],
    contas_pessoas: contasDasPessoas(base, pessoas, { hoje, clientes, ligar }),
    // 27/11/2026 (só acrescenta): de quem é cada saída pela regra única (o Movimento mostra e deixa trocar), os possíveis
    // duplicados (juntar só quando um dono clica) e as junções e apelidos guardados.
    ligacoes_pessoas: X.ligacoesPessoas(lista, ligar),
    pessoas_duplicadas: X.pessoasDuplicadas(pessoas, { juntadas: extraPes.juntadas }).map((d) => {
      const [a, b] = d.ids.map((id) => dadosDaPessoaNaJuncao(base, id, pessoas.find((p) => String(p.id) === id) || {}));
      const fica = quemFicaNaJuncao(a, b), sai = fica === a.id ? b.id : a.id, nomeDeId = (id) => d.nomes[d.ids.indexOf(id)];
      return { ...d, fica, sai, fica_nome: nomeDeId(fica), sai_nome: nomeDeId(sai), dados: { [a.id]: a, [b.id]: b },
        bloqueio: a.tem_login && b.tem_login ? 'As duas entram no painel: resolva o acesso na Equipe antes de juntar.' : '' };
    }),
    pessoas_extra: extraPes,
    vorcaro: (() => {
      const propostas = base.vorcaro?.propostas || [];
      const juntadas = new Set(propostas.filter((p) => p.estado === 'juntada').map((p) => p.transacao_id));
      return { propostas: propostas.slice(-200).map((p) => (p.estado === 'pendente' ? { ...p, candidatos: X.candidatosDaProposta(p, lista, juntadas).slice(0, 3).map((t) => ({ id: t.id, data: t.banco.data, historico: t.banco.historico, valor: t.banco.valor })) } : p)) };
    })(),
  };
  // As análises (Análise, Projeção, Fechamento, o lote e os achados do Vorcaro). Sem os dados extras (teste antigo, bot), os
  // contratos são os da mensalidade e o resto fica vazio.
  const ext = extras || { contratos: clientes.filter((c) => c.valor_mensal > 0).map((c) => ({ cliente_id: c.cliente_id, cliente_nome: c.cliente_nome, valor_mensal: c.valor_mensal, inicio: c.inicio || '', fim: c.fim || '',
    dia_vencimento: c.dia_vencimento || null, reajuste_em: c.reajuste_em || '', reajuste_pct: c.reajuste_pct ?? null, ativo: c.ativo !== false })), pecas: [], risco: [], pipeline: [], avisos: null };
  const comSaldo = lista.filter((t) => t.banco.saldo != null);
  const saldoHoje = comSaldo.length ? comSaldo[comSaldo.length - 1].banco.saldo : 0;
  out.analise = montarAnalise(base, ext, { hoje, saldo_hoje: saldoHoje, cartao: out.cartao, por_cliente: out.por_cliente, serie: out.serie, fixos_analise: out.fixos_analise,
    clientes_ativos: clientes.filter((c) => c.ativo !== false).map((c) => ({ cliente_id: String(c.cliente_id), cliente_nome: c.cliente_nome })),
    pessoas: pessoas.map((p) => ({ id: String(p.id), nome: p.nome })), ligar });
  out.orcamento = base.orcamento || {}; out.fechamentos = base.fechamentos || {}; out.metas = base.metas || {};
  out.fonte_dados = base.fonte || 'jsonb';
  return out;
}

function pegarDono(quem) {
  if (!quem) throw erro(401, 'Entre no painel para acessar o Financeiro.');
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) throw erro(403, 'O Financeiro exige uma sessão pessoal.');
  if (!ehDonoPessoa(quem.pessoa)) throw erro(403, 'O Financeiro é só dos donos.');
  return quem.pessoa;
}
const nomeDe = (p) => String(p?.nome || p?.name || p?.id || '');

export async function lerFinanceiro(sql, quem, q = {}, { hoje = hojeNaBahia() } = {}) {
  pegarDono(quem);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(q.mes || '')) ? q.mes : '';
  const [base, clientes, pessoas] = await Promise.all([lerTudo(sql), clientesComMensalidade(sql), pessoasDoTime(sql)]);
  if (q.parte) return parteDoExtrato(String(q.parte), base, clientes, { mes: mes || hoje.slice(0, 7), hoje, pessoas });
  // A conta de uma pessoa (o cartão "Financeiro" da pessoa): combinado × pago × vale, mês a mês, e os Pix que compõem.
  if (q.pessoa) {
    const id = String(q.pessoa);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) throw erro(400, 'Pessoa inválida.');
    const ligar = ligadorDaBase(base, pessoas, clientes);
    const c = contasDasPessoas({ ...base, salarios: base.salarios?.[id] ? { [id]: base.salarios[id] } : {}, vales: base.vales.filter((a) => String(a.pessoa_id) === id) }, pessoas, { hoje, clientes, ligar }).find((x) => x.pessoa_id === id)
      || { nome: pessoas.find((p) => String(p.id) === id)?.nome || 'Pessoa', ...X.contaPessoa(base.extrato.transacoes, id, { ate: hoje.slice(0, 7), ligar }) };
    return { hoje, conta: c, ajustes: base.vales.filter((a) => String(a.pessoa_id) === id) };
  }
  const extras = await dadosExtras(sql);
  const r = montar(base, clientes, { mes, hoje, pessoas, extras });
  r.tabelas = await estadoTabelas(sql).catch(() => null);
  return r;
}

// As partes que as telas antigas pediam ao Vybe Finanças (area=vybe_financas&parte=comercial|rh), agora tiradas do
// extrato (server/financeiro-fonte.js). Sem extrato importado: conectado false e o passo para importar.
export const PARTES_EXTRATO = Object.freeze(['comercial', 'rh']);
export const PASSOS_EXTRATO = Object.freeze(['Abra Finanças › Movimento › Importar.', 'Importe o extrato da conta PJ do Santander, em OFX ou CSV (prévia antes de gravar).']);
export function parteDoExtrato(parte, base, clientes, { mes, hoje, pessoas = [] }) {
  if (!PARTES_EXTRATO.includes(parte)) throw erro(400, 'Parte desconhecida.');
  const pode = { ver_dinheiro: true, ver_salarios: true };
  const b = baseDoExtrato(base, clientes, { hoje });
  if (!b.lancamentos) return { parte, mes, hoje, conectado: false, fonte: FONTE, motivo: 'Importe o extrato do banco', passos: PASSOS_EXTRATO, faltando: [], pode };
  const r = { parte, mes, hoje, conectado: true, fonte: FONTE, origem_dados: 'extrato', pode, ...parteDaBase(parte, b, { mes, hoje }) };
  // RH › Folha: o vale acumulado e o combinado de cada pessoa (a conta da pessoa), na mesma linha.
  if (parte === 'rh') {
    const contas = contasDasPessoas({ salarios: {}, vales: [], ...base }, pessoas, { hoje, clientes });
    const porId = new Map(contas.map((c) => [c.pessoa_id, c]));
    r.folha.funcionarios = r.folha.funcionarios.map((f) => { const c = f.pessoa_id ? porId.get(String(f.pessoa_id)) : null;
      return { ...f, vale: c ? c.vale : null, combinado: c?.salario?.valor ?? null, a_pagar: c ? c.a_pagar : null }; });
    r.vales = contas.map(({ pessoa_id, nome, vale, a_pagar, salario }) => ({ pessoa_id, nome, vale, a_pagar, combinado: salario?.valor ?? null }));
  }
  return r;
}

// Recebíveis e contas do extrato para as abas de dinheiro do Comercial (server/comercial.js). Só os quatro donos:
// quem não é dono recebe null (nada), nunca uma lista vazia que pareça zero. Sem nenhum lançamento importado também
// null: as abas mostram só o que foi lançado à mão no Vybe OS (nunca o Vybe Finanças) e a Visão pede o extrato.
export async function lancamentosDoExtrato(sql, { pessoa = null, hoje = hojeNaBahia() } = {}) {
  if (!ehDonoPessoa(pessoa)) return null;
  const [base, clientes] = await Promise.all([lerTudo(sql), clientesComMensalidade(sql)]);
  const b = baseDoExtrato(base, clientes, { hoje });
  if (!b.lancamentos) return null;
  return { ...lancamentosDaBase(b), lancamentos: b.lancamentos, meses: b.meses, projecao: X.baseDaProjecao(base.extrato.transacoes) };
}

function lerCsv(b) {
  const csv = String(b.csv || '');
  if (!csv.trim()) throw erro(400, 'Mande o conteúdo do extrato (OFX ou CSV).');
  if (csv.length > LIMITE_CSV) throw erro(400, 'Arquivo grande demais para um extrato.');
  const lido = X.lerExtrato(csv);
  if (!lido.lancamentos.length) throw erro(400, lido.avisos[0] || 'Nenhum lançamento no arquivo.');
  return lido;
}
// O mês fechado não aceita mudança (reabrir antes). Vale para o mês do banco e para a competência.
function travadoNoMes(fechamentos, t, mudanca = {}) {
  const f = fechamentos || {};
  const meses = [t?.banco?.data?.slice(0, 7), t?.real?.competencia, mudanca?.competencia].filter((m) => /^\d{4}-\d{2}$/.test(String(m || '')));
  const m = meses.find((x) => f[x]?.situacao === 'fechado');
  if (m) throw erro(409, `O mês ${m.split('-').reverse().join('/')} está fechado. Reabra em Fechamento para mudar.`);
}
async function fechamentosAtuais(sql) {
  try { const [l] = await sql`SELECT valor FROM vybe_carteira_config WHERE chave = ${CHAVES.fechamentos}`; return json(l?.valor) || {}; }
  catch (e) { if (e.code === '42P01') return {}; throw e; }
}
function porId(lista, id, nome = 'Lançamento') {
  const i = lista.findIndex((x) => x.id === String(id || ''));
  if (i < 0) throw erro(404, `${nome} não encontrado.`);
  return i;
}
function salvarNaLista(lista, item) {
  const i = lista.findIndex((x) => x.id === item.id);
  if (i >= 0) lista[i] = item; else lista.push(item);
  return lista;
}

export async function escreverFinanceiro(sql, quem, b = {}) {
  const pessoa = pegarDono(quem);
  const pid = Number(pessoa.id) || null;
  const acao = String(b.acao || '');
  const TRAVAM = ['editar', 'apagar', 'conferir_varios', 'conferir_lote', 'fixo_de_lancamento'];
  const fechados = TRAVAM.includes(acao) ? await fechamentosAtuais(sql) : {};
  switch (acao) {
    case 'previa': {
      const lido = lerCsv(b);
      const [base, clientes] = await Promise.all([lerTudo(sql), clientesComMensalidade(sql)]);
      const novas = X.transacoesDoCsv(lido, base.regras, clientes.filter((c) => c.ativo).map((c) => ({ id: c.cliente_id, nome: c.cliente_nome })));
      const apagados = idsApagados(base.extrato);
      const guardadas = [...base.extrato.transacoes, ...(base.extrato.lixeira || [])];
      const ja = new Set([...base.extrato.transacoes.map((t) => t.id), ...apagados]);
      // Um OFX do período que já veio em CSV (ou o contrário): o mesmo dia e valor de outro formato conta como repetido.
      const cruzado = X.casarEntreFormatos(guardadas, novas.filter((t) => !ja.has(t.id)), lido.formato || 'csv');
      const casadas = new Set(novas.filter((t) => !ja.has(t.id) && !cruzado.novas.includes(t)).map((t) => t.id));
      const n = cruzado.novas.length, repetidas = novas.length - n;
      return { previa: true, formato: lido.formato || 'csv', agencia: lido.agencia, conta: lido.conta, avisos: lido.avisos, novas: n, repetidas, de_outro_formato: cruzado.casadas,
        transacoes: novas.map((t) => ({ ...t, ja_importada: ja.has(t.id) || casadas.has(t.id) })), resumo: X.resumo(novas), meses: X.mesesDa(novas).map((m) => X.resumo(novas, { mes: m })) };
    }
    case 'importar': {
      const lido = lerCsv(b);
      const [{ regras }, clientes] = await Promise.all([lerTudo(sql), clientesComMensalidade(sql)]);
      return mudar(sql, 'extrato', pid, (atual) => {
        const novas = X.transacoesDoCsv(lido, regras, clientes.filter((c) => c.ativo).map((c) => ({ id: c.cliente_id, nome: c.cliente_nome })));
        // O que um dono apagou não volta ao reimportar o mesmo extrato (conta como repetido).
        const apagados = idsApagados(atual);
        const ids = new Set((atual.transacoes || []).map((t) => t.id));
        const cruzado = X.casarEntreFormatos([...(atual.transacoes || []), ...(atual.lixeira || [])], novas.filter((t) => !apagados.has(t.id) && !ids.has(t.id)), lido.formato || 'csv');
        const m = X.mesclar(atual.transacoes || [], cruzado.novas);
        m.repetidas = novas.length - m.novas;
        const datas = novas.map((t) => t.banco.data).sort();
        const registro = { em: new Date().toISOString(), por: nomeDe(pessoa), formato: lido.formato || 'csv', agencia: lido.agencia, conta: lido.conta, de: datas[0], ate: datas[datas.length - 1], novas: m.novas, repetidas: m.repetidas };
        return { valor: { ...atual, transacoes: m.lista, importacoes: [...(atual.importacoes || []), registro].slice(-50) }, resposta: { importado: registro } };
      });
    }
    case 'editar':
      return mudar(sql, 'extrato', pid, (atual) => {
        const lista = atual.transacoes || [];
        const i = porId(lista, b.id);
        travadoNoMes(fechados, lista[i], b.mudanca);
        const r = X.aplicarEdicao(lista[i], b.mudanca || {}, nomeDe(pessoa));
        if (r.erro) throw erro(400, r.erro);
        lista[i] = { ...lista[i], real: r.real };
        return { valor: { ...atual, transacoes: lista }, resposta: { transacao: lista[i] } };
      });
    // Apagar (Paulo, 15/11/2026: "não tem como apagar um lançamento"). Vai para a lixeira, não some: o "Desfazer" e o
    // restaurar devolvem, e o id do banco fica lembrado para o reimportar não trazer de volta. O lançado pelo WhatsApp ou à
    // mão desliga a proposta (fica descartada), para não contar duas vezes nem aparecer como lançada sem lançamento.
    case 'apagar':
      return mudarVarias(sql, ['extrato', 'vorcaro'], pid, (a) => {
        const lista = a.extrato.transacoes || [], i = porId(lista, b.id);
        travadoNoMes(fechados, lista[i]);
        const [tirada] = lista.splice(i, 1);
        const lixeira = [{ ...tirada, apagado_em: new Date().toISOString(), apagado_por: nomeDe(pessoa) }, ...(a.extrato.lixeira || []).filter((x) => x.id !== tirada.id)].slice(0, 2000);
        const propostas = (a.vorcaro.propostas || []).map((p) => (p.transacao_id === tirada.id ? { ...p, estado: 'descartada', transacao_id: '', apagada_com: tirada.id } : p));
        return { valores: { extrato: { ...a.extrato, transacoes: lista, lixeira }, vorcaro: { ...a.vorcaro, propostas } }, resposta: { apagado: tirada.id } };
      });
    case 'restaurar':
      return mudarVarias(sql, ['extrato', 'vorcaro'], pid, (a) => {
        const lixeira = a.extrato.lixeira || [], i = lixeira.findIndex((x) => x.id === String(b.id || ''));
        if (i < 0) throw erro(404, 'Esse lançamento não está na lixeira.');
        const [{ apagado_em: _e, apagado_por: _p, ...volta }] = lixeira.splice(i, 1);
        const m = X.mesclar(a.extrato.transacoes || [], [volta]);
        const propostas = (a.vorcaro.propostas || []).map((p) => (p.apagada_com === volta.id ? { ...p, estado: 'lancada', transacao_id: volta.id, apagada_com: '' } : p));
        return { valores: { extrato: { ...a.extrato, transacoes: m.lista, lixeira }, vorcaro: { ...a.vorcaro, propostas } }, resposta: { restaurado: volta.id } };
      });
    case 'conferir_varios':
      return mudar(sql, 'extrato', pid, (atual) => {
        const ids = new Set((Array.isArray(b.ids) ? b.ids : []).map(String));
        let n = 0;
        const lista = (atual.transacoes || []).map((t) => {
          if (!ids.has(t.id)) return t;
          travadoNoMes(fechados, t);
          const r = X.aplicarEdicao(t, { conferido: b.conferido !== false }, nomeDe(pessoa)); n++;
          return { ...t, real: r.real };
        });
        return { valor: { ...atual, transacoes: lista }, resposta: { conferidos: n } };
      });
    // Conferir em lote (26/11/2026: "119 a conferir em minutos"): cada item com a decisão (a sugestão do Vorcaro ou o que o
    // dono mudou). Com regras: true, cada confirmação vira uma regra salva (editável em Regras) para o próximo extrato.
    case 'conferir_lote': {
      const itens = (Array.isArray(b.itens) ? b.itens : []).slice(0, 500).filter((x) => x && x.id);
      if (!itens.length) throw erro(400, 'Nada para conferir.');
      const campos = ['categoria', 'cliente_id', 'cliente_nome', 'pessoa_id', 'pessoa_nome', 'quem', 'fixo_id', 'competencia', 'status'];
      return mudarVarias(sql, b.regras ? ['extrato', 'regras'] : ['extrato'], pid, (a) => {
        const lista = (a.extrato.transacoes || []).slice(), por = new Map(lista.map((t, i) => [t.id, i]));
        const regras = Array.isArray(a.regras) ? a.regras.slice() : [];
        let conferidos = 0, novasRegras = 0; const erros = [];
        for (const it of itens) {
          const i = por.get(String(it.id));
          if (i == null) { erros.push({ id: it.id, erro: 'não encontrado' }); continue; }
          travadoNoMes(fechados, lista[i], it.mudanca);
          const mud = Object.fromEntries(Object.entries(it.mudanca || {}).filter(([k]) => campos.includes(k)));
          const r = X.aplicarEdicao(lista[i], { ...mud, conferido: true }, nomeDe(pessoa));
          if (r.erro) { erros.push({ id: it.id, erro: r.erro }); continue; }
          lista[i] = { ...lista[i], real: r.real }; conferidos++;
          if (b.regras && it.regra !== false) {
            const proposta = A.regraDaConfirmacao(lista[i], { ...r.real, ...mud });
            const nr = proposta && X.normalizarRegra(proposta);
            if (nr?.regra && !regras.some((x) => x.id === nr.regra.id)) { regras.push(nr.regra); novasRegras++; }
          }
        }
        const valores = { extrato: { ...a.extrato, transacoes: lista } };
        if (b.regras) valores.regras = regras;
        return { valores, resposta: { conferidos, regras_novas: novasRegras, erros } };
      });
    }
    // "Isto se repete todo mês": o lançamento vira gasto fixo (nome, valor, dia e categoria dele) e fica ligado ao fixo.
    case 'fixo_de_lancamento': {
      return mudarVarias(sql, ['extrato', 'fixos'], pid, (a) => {
        const lista = (a.extrato.transacoes || []).slice(), i = porId(lista, b.id), t = lista[i];
        if (!(t.banco.valor < 0)) throw erro(400, 'Só uma saída vira gasto fixo.');
        travadoNoMes(fechados, t);
        const cat = X.CATEGORIAS.find((c) => c.id === (b.categoria || t.real.categoria) && c.tipo === 'saida')?.id || 'ferramentas';
        const nome = String(b.nome || t.real.descricao || t.banco.contraparte || t.banco.historico || 'Gasto fixo').trim().slice(0, 80);
        const f = X.normalizarFixo({ nome, valor: Math.abs(t.banco.valor), categoria: cat, dia: Number(b.dia) || Number(t.banco.data.slice(8, 10)), forma: b.forma || 'pix',
          contem: String(b.contem || t.banco.contraparte || '').slice(0, 40), inicio: t.banco.data.slice(0, 7) });
        if (f.erro) throw erro(400, f.erro);
        const r = X.aplicarEdicao(t, { fixo_id: f.fixo.id, categoria: cat }, nomeDe(pessoa));
        if (r.erro) throw erro(400, r.erro);
        lista[i] = { ...t, real: r.real };
        return { valores: { extrato: { ...a.extrato, transacoes: lista }, fixos: salvarNaLista(Array.isArray(a.fixos) ? a.fixos.slice() : [], f.fixo) }, resposta: { fixo: f.fixo, transacao: lista[i] } };
      });
    }
    // O contrato completo do cliente, editado na ficha do cliente em Finanças (só donos).
    case 'contrato_salvar': {
      const id = String(b.cliente_id || '').trim();
      if (!/^\d{1,12}$/.test(id)) throw erro(400, 'Qual cliente?');
      const data = (v, nome) => { if (v == null || v === '') return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw erro(400, `${nome}: use a data no formato AAAA-MM-DD.`); return String(v); };
      const valor = Number(String(b.valor_mensal ?? '').replace(',', '.'));
      if (!Number.isFinite(valor) || valor < 0 || valor > 10_000_000) throw erro(400, 'Valor mensal inválido.');
      const diaV = b.dia_vencimento == null || b.dia_vencimento === '' ? null : Number(b.dia_vencimento);
      if (diaV != null && (!Number.isInteger(diaV) || diaV < 1 || diaV > 31)) throw erro(400, 'O vencimento é um dia de 1 a 31.');
      const inicio = data(b.inicio, 'Início'), fim = b.sem_fim ? null : data(b.fim, 'Fim'), reajusteEm = data(b.reajuste_em, 'Reajuste');
      if (inicio && fim && fim < inicio) throw erro(400, 'O fim não pode ser antes do início.');
      const pct = b.reajuste_pct == null || b.reajuste_pct === '' ? null : Number(String(b.reajuste_pct).replace(',', '.'));
      if (pct != null && (!Number.isFinite(pct) || pct < -100 || pct > 300)) throw erro(400, 'Reajuste em % entre -100 e 300.');
      if (pct != null && !reajusteEm) throw erro(400, 'Diga a partir de quando vale o reajuste.');
      const status = ['ativo', 'negociando', 'aviso_previo', 'encerrado'].includes(String(b.status || 'ativo')) ? String(b.status || 'ativo') : 'ativo';
      const renovacao = data(b.renovacao, 'Renovação'), observacao = String(b.observacao ?? '').trim().slice(0, 1000) || null;
      if (inicio && renovacao && renovacao < inicio) throw erro(400, 'A renovação não pode ser antes do início.');
      const feitos = await garantirTabelasFinanceiro(sql);
      if (!feitos.has('fin_contratos')) throw erro(503, 'Os contratos ainda estão sendo ligados. Tente de novo em instantes.');
      return sql.comTransacao(async (tx) => {
        const [c] = await tx`SELECT id FROM vybe_clientes WHERE id=${id} FOR UPDATE`;
        if (!c) throw erro(404, 'Cliente não encontrado.');
        let [k] = await tx`UPDATE vybe_cliente_contratos k SET valor_mensal=${valor}, inicio=${inicio}, fim=${fim}, dia_vencimento=${diaV}, reajuste_em=${reajusteEm}, reajuste_pct=${pct},
            renovacao=${renovacao}, observacao=${observacao}, status=${status}, atualizado_em=now(), atualizado_por=${pid}
          WHERE k.cliente_id=${id} AND (to_jsonb(k) ->> 'origem_financas_id') IS NULL RETURNING k.cliente_id::text`;
        if (!k) [k] = await tx`INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio, fim, dia_vencimento, reajuste_em, reajuste_pct, renovacao, observacao, status, atualizado_por)
          VALUES (${id}, ${valor}, ${inicio}, ${fim}, ${diaV}, ${reajusteEm}, ${pct}, ${renovacao}, ${observacao}, ${status}, ${pid}) RETURNING cliente_id::text`;
        return { contrato: { cliente_id: k.cliente_id, valor_mensal: valor, inicio: inicio || '', fim: fim || '', dia_vencimento: diaV, reajuste_em: reajusteEm || '', reajuste_pct: pct, renovacao: renovacao || '', observacao: observacao || '', status } };
      });
    }
    case 'orcamento_salvar': {
      const mes = String(b.mes || '');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw erro(400, 'Mês no formato AAAA-MM.');
      const grupos = {};
      for (const [g, v] of Object.entries(b.grupos || {})) {
        if (!A.GRUPOS_ORCAMENTO.includes(g)) continue;
        const n = Number(String(v ?? '').replace(',', '.'));
        if (v === '' || v == null) continue;
        if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw erro(400, `Valor inválido em ${g}.`);
        grupos[g] = Math.round(n * 100) / 100;
      }
      return mudar(sql, 'orcamento', pid, (atual) => { const v = { ...(atual || {}) }; if (Object.keys(grupos).length) v[mes] = grupos; else delete v[mes]; return { valor: v, resposta: { mes, grupos } }; });
    }
    case 'orcamento_copiar': {
      const de = String(b.de || ''), para = String(b.para || '');
      if (![de, para].every((m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m))) throw erro(400, 'Mês no formato AAAA-MM.');
      const pct = Math.max(-90, Math.min(300, Number(b.pct) || 0));
      return mudar(sql, 'orcamento', pid, (atual) => {
        const grupos = A.copiarOrcamento(atual || {}, de, para, pct);
        if (!Object.keys(grupos).length) throw erro(400, 'O mês de origem não tem orçamento.');
        return { valor: { ...(atual || {}), [para]: grupos }, resposta: { mes: para, grupos } };
      });
    }
    case 'fechar_mes':
    case 'reabrir_mes': {
      const mes = String(b.mes || '');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw erro(400, 'Mês no formato AAAA-MM.');
      if (acao === 'fechar_mes' && mes >= hojeNaBahia().slice(0, 7)) throw erro(400, 'Só dá para fechar um mês que já acabou.');
      const base = acao === 'fechar_mes' ? await lerTudo(sql) : null;
      return mudar(sql, 'fechamentos', pid, (atual) => {
        const v = { ...(atual || {}) }, antes = v[mes] || null;
        const hist = [...(antes?.historico || [])];
        if (acao === 'fechar_mes') {
          const res = A.resumoContabil({ lista: base.extrato.transacoes, mes, itensCartao: base.cartao });
          const totais = { entradas: res.entradas, saidas: res.saidas, resultado_caixa: res.resultado_caixa, saldo_inicial: res.saldo_inicial, saldo_final: res.saldo_final,
            resultado_competencia: res.competencia.total_resultado, lancamentos: res.lancamentos };
          hist.push({ acao: 'fechou', em: new Date().toISOString(), por_nome: nomeDe(pessoa) });
          v[mes] = { situacao: 'fechado', em: new Date().toISOString(), por_nome: nomeDe(pessoa), totais, observacao: String(b.observacao || '').slice(0, 1000), historico: hist.slice(-20) };
        } else {
          if (antes?.situacao !== 'fechado') throw erro(409, 'Esse mês não está fechado.');
          hist.push({ acao: 'reabriu', em: new Date().toISOString(), por_nome: nomeDe(pessoa), motivo: String(b.motivo || '').slice(0, 300) });
          v[mes] = { ...antes, situacao: 'reaberto', reaberto_em: new Date().toISOString(), reaberto_por_nome: nomeDe(pessoa), historico: hist.slice(-20) };
        }
        return { valor: v, resposta: { mes, fechamento: v[mes] } };
      });
    }
    // Cobrar: só registra e avisa os outros donos (server/campos-d3.js). O bot NÃO fala com o cliente sobre dinheiro.
    case 'cobrar': {
      const r = await registrarAviso(sql, pessoa, { cliente_id: b.cliente_id || null, cliente_nome: b.cliente_nome, atraso_dias: b.atraso_dias == null ? null : Math.max(0, Math.round(Number(b.atraso_dias) || 0)) });
      return { cobranca: r };
    }
    case 'meta_salvar': {
      const m = b.metas || {}, num = (v, max) => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < -100 || n > max) throw erro(400, 'Meta inválida.'); return Math.round(n * 100) / 100; };
      const metas = { mrr: num(m.mrr, 100_000_000), margem_pct: num(m.margem_pct, 100), caixa_minimo: num(m.caixa_minimo, 100_000_000) };
      return mudar(sql, 'metas', pid, () => ({ valor: { ...metas, por: nomeDe(pessoa), em: new Date().toISOString() }, resposta: { metas } }));
    }
    case 'regra_salvar': {
      const r = X.normalizarRegra(b.regra || {});
      if (r.erro) throw erro(400, r.erro);
      const regras = await mudar(sql, 'regras', pid, (atual) => { const v = salvarNaLista(Array.isArray(atual) ? atual : [], r.regra); return { valor: v, resposta: v }; });
      let reaplicadas = 0;
      if (b.reaplicar !== false) reaplicadas = await mudar(sql, 'extrato', pid, (atual) => {
        const x = X.reaplicarRegras(atual.transacoes || [], regras);
        return { valor: { ...atual, transacoes: x.lista }, resposta: x.mudou };
      });
      return { regra: r.regra, reaplicadas };
    }
    case 'regra_remover':
      return mudar(sql, 'regras', pid, (atual) => { const l = (atual || []).filter((x) => x.id !== String(b.id || '')); return { valor: l, resposta: { removida: (atual || []).length - l.length } }; });
    case 'fixo_salvar': {
      const r = X.normalizarFixo(b.fixo || {});
      if (r.erro) throw erro(400, r.erro);
      return mudar(sql, 'fixos', pid, (atual) => ({ valor: salvarNaLista(Array.isArray(atual) ? atual : [], r.fixo), resposta: { fixo: r.fixo } }));
    }
    case 'fixo_remover':
      return mudar(sql, 'fixos', pid, (atual) => { const l = (atual || []).filter((x) => x.id !== String(b.id || '')); return { valor: l, resposta: { removido: (atual || []).length - l.length } }; });
    case 'cartao_salvar': {
      const r = X.normalizarItemCartao(b.item || {});
      if (r.erro) throw erro(400, r.erro);
      return mudar(sql, 'cartao', pid, (atual) => ({ valor: salvarNaLista(Array.isArray(atual) ? atual : [], r.item), resposta: { item: r.item } }));
    }
    case 'cartao_vencimento': {
      // { cartao, dia }: o dia do mês em que a fatura desse cartão vence (1 a 31); dia vazio tira.
      const nome = String(b.cartao || 'Cartão da agência').trim().slice(0, 60);
      if (!nome) throw erro(400, 'Qual cartão?');
      const dia = b.dia == null || b.dia === '' ? null : Number(b.dia);
      if (dia != null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) throw erro(400, 'O vencimento é um dia de 1 a 31.');
      return mudar(sql, 'cartoes', pid, (atual) => {
        const v = atual && typeof atual === 'object' && !Array.isArray(atual) ? { ...atual } : {};
        if (dia == null) delete v[nome]; else v[nome] = { dia };
        return { valor: v, resposta: { cartao: nome, dia } };
      });
    }
    case 'cartao_remover':
      return mudar(sql, 'cartao', pid, (atual) => { const l = (atual || []).filter((x) => x.id !== String(b.id || '')); return { valor: l, resposta: { removido: (atual || []).length - l.length } }; });
    case 'cenario_salvar': {
      const c = b.cenario || {};
      const nome = String(c.nome || '').trim().slice(0, 60);
      if (!nome) throw erro(400, 'Dê um nome ao cenário.');
      const limpo = { id: /^[a-z0-9-]{3,60}$/.test(String(c.id || '')) ? c.id : 'cn-' + Date.now().toString(36), nome,
        cortes: (c.cortes || []).slice(0, 30).map((x) => ({ categoria: String(x.categoria || ''), percentual: Math.max(0, Math.min(100, Number(x.percentual) || 0)) })),
        economias: (c.economias || []).slice(0, 30).map((x) => ({ nome: String(x.nome || '').slice(0, 80), valor: Math.abs(Number(x.valor) || 0), a_partir: Math.max(1, Number(x.a_partir) || 1) })),
        clientes_novos: (c.clientes_novos || []).slice(0, 10).map((x) => ({ quantos: Math.max(1, Math.min(50, Number(x.quantos) || 1)), valor: Math.abs(Number(x.valor) || 0), a_partir: Math.max(1, Number(x.a_partir) || 1) })),
        clientes_perdidos: (c.clientes_perdidos || []).slice(0, 30).map((x) => ({ nome: String(x.nome || '').slice(0, 80), valor: Math.abs(Number(x.valor) || 0), a_partir: Math.max(1, Number(x.a_partir) || 1) })),
        gastos_novos: (c.gastos_novos || []).slice(0, 30).map((x) => ({ nome: String(x.nome || '').slice(0, 80), valor: Math.abs(Number(x.valor) || 0), a_partir: Math.max(1, Number(x.a_partir) || 1) })),
        ajuste_entradas_pct: Math.max(-100, Math.min(300, Number(c.ajuste_entradas_pct) || 0)),
        // "E se" ampliado (26/11/2026): contratar alguém a partir do mês X, aumentar o preço de um cliente, perder o maior.
        contratar: (c.contratar || []).slice(0, 10).map((x) => ({ nome: String(x.nome || 'Contratação').slice(0, 80), salario: Math.abs(Number(x.salario) || 0), a_partir: Math.max(1, Math.min(12, Number(x.a_partir) || 1)) })).filter((x) => x.salario > 0),
        aumentar: (c.aumentar || []).slice(0, 30).map((x) => ({ cliente_id: String(x.cliente_id || '').slice(0, 40), cliente_nome: String(x.cliente_nome || '').slice(0, 120), pct: Math.max(-100, Math.min(300, Number(x.pct) || 0)), a_partir: Math.max(1, Math.min(12, Number(x.a_partir) || 1)) })).filter((x) => x.cliente_id && x.pct),
        perder_maior: Boolean(c.perder_maior), perder_maior_a_partir: Math.max(1, Math.min(12, Number(c.perder_maior_a_partir) || 1)) };
      for (const x of limpo.clientes_perdidos) { const id = (c.clientes_perdidos || []).find((y) => String(y.nome || '').slice(0, 80) === x.nome)?.cliente_id; if (id) x.cliente_id = String(id).slice(0, 40); }
      return mudar(sql, 'cenarios', pid, (atual) => ({ valor: salvarNaLista(Array.isArray(atual) ? atual : [], limpo), resposta: { cenario: limpo } }));
    }
    case 'salario_salvar': {
      // O combinado de uma pessoa ({ pessoa_id, valor, desde }); valor vazio tira.
      const pessoaId = String(b.pessoa_id || '').trim();
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(pessoaId)) throw erro(400, 'Qual pessoa?');
      const tirar = b.valor == null || b.valor === '';
      const r = tirar ? { salario: null } : X.normalizarSalario({ valor: b.valor, desde: b.desde });
      if (r.erro) throw erro(400, r.erro);
      return mudar(sql, 'salarios', pid, (atual) => {
        const v = atual && typeof atual === 'object' && !Array.isArray(atual) ? { ...atual } : {};
        if (tirar) delete v[pessoaId]; else v[pessoaId] = { ...r.salario, por: nomeDe(pessoa), em: new Date().toISOString() };
        return { valor: v, resposta: { pessoa_id: pessoaId, salario: v[pessoaId] || null } };
      });
    }
    case 'pessoa_fora': {
      // Tirar alguém de Pessoas (Paulo, 24/11/2026: "não consigo apagar alguém"): some da lista, do combinado e do
      // "Falta pagar"; os Pix atribuídos continuam no extrato. fora: false traz de volta (sem combinado).
      const pessoaId = String(b.pessoa_id || '').trim();
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(pessoaId)) throw erro(400, 'Qual pessoa?');
      return mudar(sql, 'salarios', pid, (atual) => {
        const v = atual && typeof atual === 'object' && !Array.isArray(atual) ? { ...atual } : {};
        if (b.fora === false) delete v[pessoaId]; else v[pessoaId] = { fora: true, por: nomeDe(pessoa), em: new Date().toISOString() };
        return { valor: v, resposta: { pessoa_id: pessoaId, fora: b.fora !== false } };
      });
    }
    case 'vale_ajuste_salvar': {
      const r = X.normalizarAjusteVale(b.ajuste || {});
      if (r.erro) throw erro(400, r.erro);
      return mudar(sql, 'vales', pid, (atual) => ({ valor: salvarNaLista(Array.isArray(atual) ? atual : [], { ...r.ajuste, por: nomeDe(pessoa) }), resposta: { ajuste: r.ajuste } }));
    }
    // Apelidos da pessoa (27/11/2026: o Pix sai com o apelido, não com o nome): o Pix ou o "Pago a" com o apelido liga a saída a ela.
    case 'pessoa_apelidos_salvar': {
      const pessoaId = String(b.pessoa_id || '').trim();
      if (!ID_PESSOA.test(pessoaId)) throw erro(400, 'Qual pessoa?');
      const lista = (Array.isArray(b.apelidos) ? b.apelidos : String(b.apelidos || '').split(/[,;\n]/)).map((x) => String(x || '').trim().slice(0, 60)).filter((x) => x.replace(/\s/g, '').length >= 3);
      return mudar(sql, 'pessoas_extra', pid, (atual) => {
        const v = normalizarPessoasExtra(atual);
        if (lista.length) v.apelidos[pessoaId] = [...new Set(lista)].slice(0, 10); else delete v.apelidos[pessoaId];
        return { valor: v, resposta: { pessoa_id: pessoaId, apelidos: v.apelidos[pessoaId] || [] } };
      });
    }
    // Juntar duas pessoas duplicadas (só quando um dono clica; nunca sozinho). { de, para }: de = a que sai, para = a que fica.
    case 'pessoa_juntar': {
      const de = String(b.de || '').trim(), para = String(b.para || '').trim();
      if (!ID_PESSOA.test(de) || !ID_PESSOA.test(para) || de === para) throw erro(400, 'Escolha as duas pessoas.');
      const linhas = await linhasDaJuncao(sql, [de, para]);
      if (!linhas.get(de) || !linhas.get(para)) throw erro(404, 'Pessoa não encontrada.');
      if (linhas.get(de).juntada_em_id || linhas.get(para).juntada_em_id) throw erro(409, 'Uma das duas já foi juntada a outra pessoa.');
      if (linhas.get(de).tem_login && linhas.get(para).tem_login) throw erro(409, 'As duas pessoas entram no painel (podem entrar e têm senha ou já entraram): juntar tiraria o acesso de uma. Resolva o acesso na Equipe primeiro.');
      if (linhas.get(de).dono) throw erro(409, 'A pessoa que sairia é dona da Vybe: inverta (ela fica).');
      const base = await lerTudo(sql);
      const fica = quemFicaNaJuncao(dadosDaPessoaNaJuncao(base, de, linhas.get(de)), dadosDaPessoaNaJuncao(base, para, linhas.get(para)));
      if (fica !== para) throw erro(409, `Quem fica é ${linhas.get(fica).nome} (tem mais dados: acesso, combinado, vales ou lançamentos). Junte na outra direção.`);
      return mudarVarias(sql, ['extrato', 'salarios', 'vales', 'pessoas_extra'], pid, (a) => {
        if (normalizarPessoasExtra(a.pessoas_extra).juntadas[de]) throw erro(409, 'Essa pessoa já foi juntada.');
        const r = juntarNaBase(a, de, para, { nomeDe: linhas.get(de).nome, nomePara: linhas.get(para).nome, por: nomeDe(pessoa) });
        // O que estava antes em vybe_pessoas, para desfazer.
        r.valores.pessoas_extra.juntadas[de].desfazer.ativo_antes = linhas.get(de).ativo;
        return { valores: r.valores, resposta: { juntou: r.resumo } };
      }, { depois: async (tx) => {
        await tx`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS juntada_em_id BIGINT`;
        await tx`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS juntada_em TIMESTAMPTZ`;
        await tx`UPDATE vybe_pessoas SET juntada_em_id = ${Number(para)}, juntada_em = now() WHERE id::text = ${de}`;
        // Inativa só se a coluna existir (o painel trata ativo; a linha nunca é apagada).
        if (linhas.get(de).ativo != null) await tx`UPDATE vybe_pessoas SET ativo = false WHERE id::text = ${de}`;
      } });
    }
    case 'pessoa_separar': {
      const de = String(b.de || '').trim();
      if (!ID_PESSOA.test(de)) throw erro(400, 'Qual pessoa?');
      let ativoAntes = null;
      return mudarVarias(sql, ['extrato', 'salarios', 'vales', 'pessoas_extra'], pid, (a) => {
        const j = normalizarPessoasExtra(a.pessoas_extra).juntadas[de];
        const r = separarNaBase(a, de);
        if (!r) throw erro(404, 'Essa pessoa não está juntada.');
        ativoAntes = j?.desfazer?.ativo_antes ?? null;
        return { valores: r.valores, resposta: { separou: r.resumo } };
      }, { depois: async (tx) => {
        await tx`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS juntada_em_id BIGINT`;
        await tx`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS juntada_em TIMESTAMPTZ`;
        await tx`UPDATE vybe_pessoas SET juntada_em_id = NULL, juntada_em = NULL WHERE id::text = ${de}`;
        if (ativoAntes != null) await tx`UPDATE vybe_pessoas SET ativo = ${ativoAntes === true || ativoAntes === 'true'} WHERE id::text = ${de}`;
      } });
    }
    case 'vale_ajuste_remover':
      return mudar(sql, 'vales', pid, (atual) => { const l = (atual || []).filter((x) => x.id !== String(b.id || '')); return { valor: l, resposta: { removido: (atual || []).length - l.length } }; });
    case 'cenario_remover':
      return mudar(sql, 'cenarios', pid, (atual) => { const l = (atual || []).filter((x) => x.id !== String(b.id || '')); return { valor: l, resposta: { removido: (atual || []).length - l.length } }; });
    case 'lancar_mao': {
      const r = X.normalizarProposta({ ...(b.lancamento || {}), origem: 'mao', autor: nomeDe(pessoa) });
      if (r.erro) throw erro(400, r.erro);
      // "Fui adicionar uma conta a pagar… não devia me perguntar se era conta fixa?" (Paulo, 15/11/2026). Saída que se
      // repete todo mês vira também gasto fixo, ligado a este lançamento (o mês dele fica coberto); dali em diante a conta
      // aparece sozinha em Contas a pagar e no Vorcaro todo mês, no dia do vencimento.
      let fixo = null;
      if (b.fixo?.repete && r.proposta.tipo === 'saida') {
        if (!X.CATEGORIAS.some((c) => c.id === r.proposta.categoria && c.tipo === 'saida')) throw erro(400, 'Escolha para onde vai a conta fixa (a categoria).');
        const f = X.normalizarFixo({ nome: b.fixo.nome || r.proposta.texto || r.proposta.quem, valor: r.proposta.valor, categoria: r.proposta.categoria,
          dia: Number(b.fixo.dia) || Number(r.proposta.data.slice(8, 10)), forma: b.fixo.forma || r.proposta.forma, inicio: r.proposta.data.slice(0, 7) });
        if (f.erro) throw erro(400, f.erro === 'Dê um nome ao gasto fixo.' ? 'Dê um nome à conta fixa (em "O que foi").' : f.erro);
        fixo = f.fixo;
      }
      return mudarVarias(sql, fixo ? ['vorcaro', 'extrato', 'fixos'] : ['vorcaro', 'extrato'], pid, (a) => {
        const p = { ...r.proposta, estado: 'lancada', decidido_por: nomeDe(pessoa) };
        const tr = X.transacaoDaProposta(p, nomeDe(pessoa)); p.transacao_id = tr.id;
        if (fixo) tr.real.fixo_id = fixo.id;
        const m = X.mesclar(a.extrato.transacoes || [], [tr]);
        const valores = { vorcaro: { propostas: [...(a.vorcaro.propostas || []), p].slice(-1000) }, extrato: { ...a.extrato, transacoes: m.lista } };
        if (fixo) valores.fixos = salvarNaLista(Array.isArray(a.fixos) ? a.fixos : [], fixo);
        return { valores, resposta: { transacao: tr, fixo } };
      });
    }
    case 'proposta_lancar':
    case 'proposta_juntar':
    case 'proposta_descartar':
      return mudarVarias(sql, ['vorcaro', 'extrato'], pid, (a) => {
        const propostas = a.vorcaro.propostas || [], i = porId(propostas, b.id, 'Proposta');
        const editaveis = ['categoria', 'cliente_id', 'cliente_nome', 'quem', 'valor', 'data', 'tipo', 'status', 'texto'];
        const p = { ...propostas[i], ...(b.mudanca ? Object.fromEntries(Object.entries(b.mudanca).filter(([k]) => editaveis.includes(k))) : {}) };
        if (p.estado !== 'pendente') throw erro(409, 'Essa proposta já foi decidida.');
        const revista = X.normalizarProposta({ ...p, id: p.id_externo || p.id }, { agora: p.recebido_em });
        if (revista.erro) throw erro(400, revista.erro);
        const q = { ...revista.proposta, id: p.id, recebido_em: p.recebido_em, origem: p.origem, decidido_por: nomeDe(pessoa) };
        let transacoes = a.extrato.transacoes || [];
        if (b.acao === 'proposta_descartar') q.estado = 'descartada';
        else if (b.acao === 'proposta_lancar') {
          const tr = X.transacaoDaProposta(q, nomeDe(pessoa)); q.estado = 'lancada'; q.transacao_id = tr.id;
          transacoes = X.mesclar(transacoes, [tr]).lista;
        } else {
          const j = porId(transacoes, b.transacao_id);
          const atual = transacoes[j].real;
          const r = X.aplicarEdicao(transacoes[j], { categoria: q.categoria === 'a_classificar' ? atual.categoria : q.categoria, cliente_id: q.cliente_id || atual.cliente_id,
            cliente_nome: q.cliente_nome || atual.cliente_nome, quem: q.quem || atual.quem, descricao: q.texto.slice(0, 160), status: q.status, conferido: true }, nomeDe(pessoa));
          if (r.erro) throw erro(400, r.erro);
          transacoes = transacoes.slice(); transacoes[j] = { ...transacoes[j], real: r.real };
          q.estado = 'juntada'; q.transacao_id = transacoes[j].id;
        }
        const novas = propostas.slice(); novas[i] = q;
        return { valores: { vorcaro: { propostas: novas }, extrato: { ...a.extrato, transacoes } }, resposta: { proposta: q } };
      });
    default:
      throw erro(400, 'Ação desconhecida no Financeiro.');
  }
}

// O bot (Vorcaro lendo o grupo Vybe Financeiro) entrega propostas com a credencial dele (VYBE_AI_BOT_TOKEN), sem sessão:
// POST /api/painel?area=financeiro&canal=bot { acao: 'propor', propostas: [{ id_externo, autor, texto, anexo, tipo, valor,
// data, categoria, quem, cliente_nome }] }. Só entra como pendente; quem lança, junta ou descarta é um dono, na tela.
// GET devolve só as categorias (para o bot sugerir com os mesmos ids). Nunca devolve lançamento nem saldo.
export async function areaFinanceiroBot(req, res, criarBanco, config = process.env) {
  if (!autenticarAssistente(req, config.VYBE_AI_BOT_TOKEN)) return res.status(401).json({ error: 'Não autorizado.' });
  if (req.method === 'GET') return res.status(200).json({ ok: true, categorias: X.CATEGORIAS.map(({ id, nome, tipo }) => ({ id, nome, tipo })), formas: X.FORMAS_LANCAMENTO });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const b = req.body || {};
  if (b.acao !== 'propor') return res.status(400).json({ error: 'Ação desconhecida.' });
  const lista = (Array.isArray(b.propostas) ? b.propostas : []).slice(0, 50).map((p) => X.normalizarProposta({ ...p, origem: 'whatsapp' }));
  const boas = lista.filter((r) => r.proposta).map((r) => r.proposta);
  try {
    const r = await mudar(criarBanco(), 'vorcaro', null, (atual) => {
      const ja = new Set((atual.propostas || []).map((p) => p.id));
      const novas = boas.filter((p) => !ja.has(p.id));
      return { valor: { propostas: [...(atual.propostas || []), ...novas].slice(-1000) }, resposta: { recebidas: novas.length, repetidas: boas.length - novas.length } };
    });
    return res.status(200).json({ ok: true, ...r, recusadas: lista.filter((x) => x.erro).map((x) => x.erro) });
  } catch (e) {
    return res.status(e.code === '42P01' ? 503 : 500).json({ error: 'Não foi possível guardar as propostas.' });
  }
}

export async function areaFinanceiro(req, res, quem, criarBanco) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const sql = criarBanco();
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...await escreverFinanceiro(sql, quem, req.body || {}) });
    return res.status(200).json({ ok: true, ...await lerFinanceiro(sql, quem, req.query || {}) });
  } catch (e) {
    if (e.code === '42P01') { console.warn('[financeiro] falta a tabela vybe_carteira_config (migração 2026-11-07-carteira.sql):', e.message); return res.status(503).json({ error: 'Esta parte ainda está sendo ligada.', migracao_pendente: true }); }
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível acessar o Financeiro. Tente novamente.' });
  }
}
