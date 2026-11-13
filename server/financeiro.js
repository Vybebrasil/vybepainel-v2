// server/financeiro.js — o Financeiro do Vybe OS sem o Vybe Finanças (Paulo, 13/11/2026: "quero me livrar 100% de lá").
//
// GET  /api/painel?area=financeiro[&mes=AAAA-MM]   tudo que as telas usam, já calculado (shared/financeiro-extrato.js)
// POST /api/painel?area=financeiro { acao, ... }
//   previa       { csv }                 lê o extrato do BB e devolve a prévia com as sugestões — NÃO grava nada
//   importar     { csv }                 grava os lançamentos novos (reimportar o mesmo arquivo não duplica)
//   editar       { id, mudanca }         o lado real de um lançamento: categoria, partes, status, cliente, competência…
//   conferir_varios { ids, conferido }   marca vários como conferidos de uma vez
//   regra_salvar { regra, reaplicar }    regra do Paulo ("Pix para X = combustível"); reaplica nos não conferidos
//   regra_remover { id }
//   fixo_salvar  { fixo } / fixo_remover { id }
//   cartao_salvar { item } / cartao_remover { id }
//   cenario_salvar { cenario } / cenario_remover { id }
//
// Quem: só os quatro donos (server/donos.js), sempre. Dinheiro da Vybe não passa por "quem administra".
// Onde: vybe_carteira_config (chave/valor jsonb), sem migração — chaves financeiro_*. Cada escrita lê com FOR UPDATE e
// grava na mesma transação. Quando o volume pedir (alguns milhares de lançamentos), vira tabela própria com migração
// revisada pelo Paulo; o formato das transações já é o de uma linha.
import X from '../shared/financeiro-extrato.js';
import { ehDonoPessoa } from './donos.js';
import { autenticarAssistente } from './assistente-servico.js';

export const CHAVES = Object.freeze({ extrato: 'financeiro_extrato', regras: 'financeiro_regras', fixos: 'financeiro_fixos', cartao: 'financeiro_cartao', cenarios: 'financeiro_cenarios', vorcaro: 'financeiro_vorcaro' });
const VAZIO = { extrato: { transacoes: [], importacoes: [] }, regras: [], fixos: [], cartao: [], cenarios: [], vorcaro: { propostas: [] } };
const LIMITE_CSV = 2_000_000;

const erro = (status, message) => Object.assign(new Error(message), { status });
const hojeNaBahia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const json = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } } return v ?? null; };

async function lerTudo(sql) {
  const linhas = await sql`SELECT chave, valor FROM vybe_carteira_config WHERE chave LIKE 'financeiro\_%'`;
  const por = new Map(linhas.map((l) => [l.chave, json(l.valor)]));
  const out = {};
  for (const [k, chave] of Object.entries(CHAVES)) out[k] = por.get(chave) ?? structuredClone(VAZIO[k]);
  if (!Array.isArray(out.extrato?.transacoes)) out.extrato = structuredClone(VAZIO.extrato);
  for (const k of ['regras', 'fixos', 'cartao', 'cenarios']) if (!Array.isArray(out[k])) out[k] = [];
  if (!Array.isArray(out.vorcaro?.propostas)) out.vorcaro = { propostas: [] };
  return out;
}
// Lê uma chave travada, aplica a mudança e grava (uma transação).
async function mudar(sql, parte, pessoaId, fn) {
  const chave = CHAVES[parte];
  return sql.comTransacao(async (tx) => {
    await tx`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por) VALUES (${chave}, ${JSON.stringify(VAZIO[parte])}::jsonb, ${pessoaId}) ON CONFLICT (chave) DO NOTHING`;
    const [l] = await tx`SELECT valor FROM vybe_carteira_config WHERE chave=${chave} FOR UPDATE`;
    const atual = json(l?.valor) ?? structuredClone(VAZIO[parte]);
    const { valor, resposta } = await fn(atual);
    await tx`UPDATE vybe_carteira_config SET valor=${JSON.stringify(valor)}::jsonb, atualizado_por=${pessoaId}, atualizado_em=now() WHERE chave=${chave}`;
    return resposta;
  });
}

// Várias chaves travadas na mesma transação (lançar uma proposta mexe nas propostas e no extrato juntos).
async function mudarVarias(sql, partes, pessoaId, fn) {
  return sql.comTransacao(async (tx) => {
    const atuais = {};
    for (const parte of partes) {
      const chave = CHAVES[parte];
      await tx`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por) VALUES (${chave}, ${JSON.stringify(VAZIO[parte])}::jsonb, ${pessoaId}) ON CONFLICT (chave) DO NOTHING`;
      const [l] = await tx`SELECT valor FROM vybe_carteira_config WHERE chave=${chave} FOR UPDATE`;
      atuais[parte] = json(l?.valor) ?? structuredClone(VAZIO[parte]);
    }
    const { valores, resposta } = await fn(atuais);
    for (const [parte, valor] of Object.entries(valores))
      await tx`UPDATE vybe_carteira_config SET valor=${JSON.stringify(valor)}::jsonb, atualizado_por=${pessoaId}, atualizado_em=now() WHERE chave=${CHAVES[parte]}`;
    return resposta;
  });
}

// Clientes ativos com a mensalidade (o "previsto" do mês a mês): contrato do Vybe OS, senão o valor de Finanças por cliente.
async function clientesComMensalidade(sql) {
  let linhas;
  try {
    linhas = await sql`SELECT c.id::text AS cliente_id, c.nome AS cliente_nome,
      COALESCE(k.valor_mensal, f.valor_mensal)::float8 AS valor_mensal, k.inicio, k.renovacao AS fim, COALESCE(c.ativo,true) AS ativo
    FROM vybe_clientes c
    LEFT JOIN LATERAL (SELECT valor_mensal, inicio, renovacao FROM vybe_cliente_contratos k WHERE k.cliente_id=c.id ORDER BY (to_jsonb(k)->>'origem_financas_id') IS NULL DESC, k.atualizado_em DESC NULLS LAST LIMIT 1) k ON true
    LEFT JOIN vybe_comercial_financas_cliente f ON f.cliente_id=c.id
    WHERE NOT COALESCE(c.nao_e_cliente,false) ORDER BY c.nome`;
  } catch (e) {
    // Banco sem os contratos da Carteira: a mensalidade de Finanças por cliente; sem ela também, os clientes sem mensalidade.
    if (e.code !== '42P01' && e.code !== '42703') throw e;
    try {
      linhas = await sql`SELECT c.id::text AS cliente_id, c.nome AS cliente_nome, f.valor_mensal::float8 AS valor_mensal, NULL AS inicio, NULL AS fim, COALESCE(c.ativo,true) AS ativo
        FROM vybe_clientes c LEFT JOIN vybe_comercial_financas_cliente f ON f.cliente_id=c.id ORDER BY c.nome`;
    } catch (e2) {
      if (e2.code !== '42P01' && e2.code !== '42703') throw e2;
      linhas = await sql`SELECT id::text AS cliente_id, nome AS cliente_nome, NULL::float8 AS valor_mensal, NULL AS inicio, NULL AS fim, true AS ativo FROM vybe_clientes ORDER BY nome`;
    }
  }
  const dia = (v) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : '');
  return linhas.map((l) => ({ ...l, valor_mensal: Number(l.valor_mensal) || 0, inicio: dia(l.inicio), fim: '', renovacao: dia(l.fim) }));
}

export function montar(base, clientes, { mes, hoje }) {
  const lista = base.extrato.transacoes;
  const meses = X.mesesDa(lista);
  const mesAtual = mes || meses[meses.length - 1] || hoje.slice(0, 7);
  const mesesCliente = (() => { const fim = hoje.slice(0, 7), out = []; for (let i = 5; i >= 0; i--) out.push(X.somarMeses(fim, -i)); return out; })();
  const contratos = clientes.filter((c) => c.ativo && c.valor_mensal > 0).map((c) => ({ cliente_id: c.cliente_id, cliente_nome: c.cliente_nome, valor_mensal: c.valor_mensal, inicio: c.inicio }));
  const projBase = X.baseDaProjecao(lista);
  return {
    hoje, mes: mesAtual, meses,
    categorias: X.CATEGORIAS, regras_padrao: X.REGRAS_PADRAO, regras: base.regras,
    transacoes: lista, importacoes: base.extrato.importacoes || [],
    resumo: X.resumo(lista, { mes: mesAtual }),
    serie: meses.map((m) => { const r = X.resumo(lista, { mes: m }); return { mes: m, entradas: r.entradas, saidas: r.saidas, cartao: r.cartao_e_transferencias, resultado: r.resultado, saldo_final: r.saldo_final, a_revisar: r.a_revisar }; }),
    a_revisar: lista.filter((t) => !t.real.conferido).length,
    clientes: clientes.map((c) => ({ id: c.cliente_id, nome: c.cliente_nome, mensalidade: c.valor_mensal, ativo: c.ativo })),
    por_cliente: { meses: mesesCliente, desde: meses[0] || '', linhas: X.porCliente(lista, contratos, mesesCliente, { desde: meses[0] || '9999-12', mesAtual: hoje.slice(0, 7) }) },
    fixos: base.fixos, fixos_analise: X.analisarFixos(base.fixos, lista, mesAtual, base.cartao),
    cartao: { itens: base.cartao, faturas: X.cartao(base.cartao, lista), pagamentos_sem_fatura: X.pagamentosSemFatura(lista) },
    projecao: { base: projBase, cenarios: base.cenarios },
    vorcaro: (() => {
      const propostas = base.vorcaro?.propostas || [];
      const juntadas = new Set(propostas.filter((p) => p.estado === 'juntada').map((p) => p.transacao_id));
      return { propostas: propostas.slice(-200).map((p) => (p.estado === 'pendente' ? { ...p, candidatos: X.candidatosDaProposta(p, lista, juntadas).slice(0, 3).map((t) => ({ id: t.id, data: t.banco.data, historico: t.banco.historico, valor: t.banco.valor })) } : p)) };
    })(),
  };
}

function pegarDono(quem) {
  if (!quem) throw erro(401, 'Entre no painel para acessar o Financeiro.');
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) throw erro(403, 'O Financeiro exige uma sessão pessoal.');
  if (!ehDonoPessoa(quem.pessoa)) throw erro(403, 'O Financeiro é só dos donos.');
  return quem.pessoa;
}
const nomeDe = (p) => String(p?.nome || p?.name || p?.id || '');

export async function lerFinanceiro(sql, quem, q = {}) {
  pegarDono(quem);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(q.mes || '')) ? q.mes : '';
  const [base, clientes] = await Promise.all([lerTudo(sql), clientesComMensalidade(sql)]);
  return montar(base, clientes, { mes, hoje: hojeNaBahia() });
}

function lerCsv(b) {
  const csv = String(b.csv || '');
  if (!csv.trim()) throw erro(400, 'Mande o conteúdo do extrato (CSV).');
  if (csv.length > LIMITE_CSV) throw erro(400, 'Arquivo grande demais para um extrato.');
  const lido = X.lerCsvBB(csv);
  if (!lido.lancamentos.length) throw erro(400, lido.avisos[0] || 'Nenhum lançamento no arquivo.');
  return lido;
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
  switch (acao) {
    case 'previa': {
      const lido = lerCsv(b);
      const [base, clientes] = await Promise.all([lerTudo(sql), clientesComMensalidade(sql)]);
      const novas = X.transacoesDoCsv(lido, base.regras, clientes.filter((c) => c.ativo).map((c) => ({ id: c.cliente_id, nome: c.cliente_nome })));
      const { novas: n, repetidas } = X.mesclar(base.extrato.transacoes, novas);
      const ja = new Set(base.extrato.transacoes.map((t) => t.id));
      return { previa: true, agencia: lido.agencia, conta: lido.conta, avisos: lido.avisos, novas: n, repetidas,
        transacoes: novas.map((t) => ({ ...t, ja_importada: ja.has(t.id) })), resumo: X.resumo(novas), meses: X.mesesDa(novas).map((m) => X.resumo(novas, { mes: m })) };
    }
    case 'importar': {
      const lido = lerCsv(b);
      const [{ regras }, clientes] = await Promise.all([lerTudo(sql), clientesComMensalidade(sql)]);
      return mudar(sql, 'extrato', pid, (atual) => {
        const novas = X.transacoesDoCsv(lido, regras, clientes.filter((c) => c.ativo).map((c) => ({ id: c.cliente_id, nome: c.cliente_nome })));
        const m = X.mesclar(atual.transacoes || [], novas);
        const datas = novas.map((t) => t.banco.data).sort();
        const registro = { em: new Date().toISOString(), por: nomeDe(pessoa), agencia: lido.agencia, conta: lido.conta, de: datas[0], ate: datas[datas.length - 1], novas: m.novas, repetidas: m.repetidas };
        return { valor: { ...atual, transacoes: m.lista, importacoes: [...(atual.importacoes || []), registro].slice(-50) }, resposta: { importado: registro } };
      });
    }
    case 'editar':
      return mudar(sql, 'extrato', pid, (atual) => {
        const lista = atual.transacoes || [];
        const i = porId(lista, b.id);
        const r = X.aplicarEdicao(lista[i], b.mudanca || {}, nomeDe(pessoa));
        if (r.erro) throw erro(400, r.erro);
        lista[i] = { ...lista[i], real: r.real };
        return { valor: { ...atual, transacoes: lista }, resposta: { transacao: lista[i] } };
      });
    case 'conferir_varios':
      return mudar(sql, 'extrato', pid, (atual) => {
        const ids = new Set((Array.isArray(b.ids) ? b.ids : []).map(String));
        let n = 0;
        const lista = (atual.transacoes || []).map((t) => {
          if (!ids.has(t.id)) return t;
          const r = X.aplicarEdicao(t, { conferido: b.conferido !== false }, nomeDe(pessoa)); n++;
          return { ...t, real: r.real };
        });
        return { valor: { ...atual, transacoes: lista }, resposta: { conferidos: n } };
      });
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
        ajuste_entradas_pct: Math.max(-100, Math.min(300, Number(c.ajuste_entradas_pct) || 0)) };
      return mudar(sql, 'cenarios', pid, (atual) => ({ valor: salvarNaLista(Array.isArray(atual) ? atual : [], limpo), resposta: { cenario: limpo } }));
    }
    case 'cenario_remover':
      return mudar(sql, 'cenarios', pid, (atual) => { const l = (atual || []).filter((x) => x.id !== String(b.id || '')); return { valor: l, resposta: { removido: (atual || []).length - l.length } }; });
    case 'lancar_mao': {
      const r = X.normalizarProposta({ ...(b.lancamento || {}), origem: 'mao', autor: nomeDe(pessoa) });
      if (r.erro) throw erro(400, r.erro);
      return mudarVarias(sql, ['vorcaro', 'extrato'], pid, (a) => {
        const p = { ...r.proposta, estado: 'lancada', decidido_por: nomeDe(pessoa) };
        const tr = X.transacaoDaProposta(p, nomeDe(pessoa)); p.transacao_id = tr.id;
        const m = X.mesclar(a.extrato.transacoes || [], [tr]);
        return { valores: { vorcaro: { propostas: [...(a.vorcaro.propostas || []), p].slice(-1000) }, extrato: { ...a.extrato, transacoes: m.lista } }, resposta: { transacao: tr } };
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
  if (req.method === 'GET') return res.status(200).json({ ok: true, categorias: X.CATEGORIAS.map(({ id, nome, tipo }) => ({ id, nome, tipo })) });
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
    if (e.code === '42P01') return res.status(503).json({ error: 'Falta a tabela vybe_carteira_config (migração 2026-11-07-carteira.sql).', migracao_pendente: true });
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível acessar o Financeiro. Tente novamente.' });
  }
}
