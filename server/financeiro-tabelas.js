// server/financeiro-tabelas.js — o Finanças sai do jsonb e passa a ter tabelas de verdade (Paulo, 26/11/2026: "preciso
// que seja FODA, COMPLETO"; o OK para criar tabelas é de 14/11/2026).
//
// Até aqui tudo morava em vybe_carteira_config (chaves financeiro_*), um jsonb por assunto. Agora:
//   vybe_fin_lancamentos        um lançamento por linha (o lado do banco, o lado real e o documento inteiro), com índices
//                                por data, competência, cliente e pessoa; o apagado fica na mesma tabela (apagado_em)
//   vybe_fin_lancamento_partes  as partes de um lançamento dividido (boleto de 3 clientes, Pix de duas categorias)
//   vybe_fin_regras             as regras do Paulo, na ordem (vale a primeira que bate)
//   vybe_fin_fixos              os gastos fixos
//   vybe_fin_cartao_itens       os itens das faturas do cartão; vybe_fin_cartoes: o dia do vencimento de cada cartão
//   vybe_fin_cenarios           os cenários guardados do "E se"
//   vybe_financas_orcamento_mensal  orçamento mês × grupo (tabela da migração 2026-11-11, reaproveitada: as linhas do
//                                Vybe OS têm categoria 'grupo:<nome>' e origem_financas_id vazio)
//   vybe_financas_fechamentos   os meses fechados (tabela da migração 2026-11-11, reaproveitada, com 3 colunas a mais)
//   vybe_fin_estado             o registro da cópia do jsonb (quando, quantas linhas) e se as tabelas estão em dia
// E nos contratos (vybe_cliente_contratos): dia_vencimento, fim, reajuste_em e reajuste_pct.
//
// Como funciona (e como voltar):
//  1. A migração é ADITIVA e idempotente, aplicada pelo servidor no primeiro uso (o padrão de server/migracoes-campos.js):
//     CREATE TABLE/INDEX IF NOT EXISTS e ADD COLUMN IF NOT EXISTS. Nada de DROP, nada de mudar tipo.
//  2. A cópia do jsonb para as tabelas roda UMA vez, quando as tabelas estão vazias (estado sem registro). Ela NÃO apaga
//     nem altera o jsonb, e grava em vybe_fin_estado quando foi feita e quantas linhas copiou.
//  3. Toda escrita continua gravando o jsonb (como antes) e, na MESMA transação, espelha a mudança nas tabelas. Se o
//     espelho falhar, a escrita no jsonb fica (savepoint) e as tabelas são marcadas "dessincronizado": a leitura volta
//     para o jsonb e a próxima chamada refaz a cópia a partir dele.
//  4. A leitura vem das tabelas. Se a tabela não existir, falhar, ou a conta de linhas não bater com o jsonb, a leitura
//     volta sozinha para o jsonb. Para forçar o jsonb (voltar atrás sem deploy de código): VYBE_FIN_LER=jsonb.
const BLOCOS = Object.freeze([
  { nome: 'fin_tabelas', depende: 'vybe_carteira_config', pronto: ['tabela', 'vybe_fin_estado'], comandos: [
    `CREATE TABLE IF NOT EXISTS vybe_fin_lancamentos (
      id text PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 80),
      data date NOT NULL,
      ordem integer NOT NULL DEFAULT 0,
      historico text NOT NULL DEFAULT '',
      valor numeric(14,2) NOT NULL,
      saldo numeric(14,2),
      formato text NOT NULL DEFAULT '',
      categoria text NOT NULL DEFAULT 'a_classificar',
      competencia text NOT NULL DEFAULT '',
      cliente_id text NOT NULL DEFAULT '',
      pessoa_id text NOT NULL DEFAULT '',
      fixo_id text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'pago',
      conferido boolean NOT NULL DEFAULT false,
      apagado_em timestamptz,
      doc jsonb NOT NULL CHECK (jsonb_typeof(doc) = 'object'),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS vybe_fin_lancamentos_data ON vybe_fin_lancamentos (data, ordem)`,
    `CREATE INDEX IF NOT EXISTS vybe_fin_lancamentos_competencia ON vybe_fin_lancamentos (competencia)`,
    `CREATE INDEX IF NOT EXISTS vybe_fin_lancamentos_cliente ON vybe_fin_lancamentos (cliente_id) WHERE cliente_id <> ''`,
    `CREATE INDEX IF NOT EXISTS vybe_fin_lancamentos_pessoa ON vybe_fin_lancamentos (pessoa_id) WHERE pessoa_id <> ''`,
    `CREATE TABLE IF NOT EXISTS vybe_fin_lancamento_partes (
      lancamento_id text NOT NULL REFERENCES vybe_fin_lancamentos(id) ON DELETE CASCADE,
      n integer NOT NULL,
      valor numeric(14,2) NOT NULL,
      categoria text NOT NULL DEFAULT '',
      cliente_id text NOT NULL DEFAULT '',
      pessoa_id text NOT NULL DEFAULT '',
      competencia text NOT NULL DEFAULT '',
      doc jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (lancamento_id, n)
    )`,
    `CREATE INDEX IF NOT EXISTS vybe_fin_lancamento_partes_cliente ON vybe_fin_lancamento_partes (cliente_id) WHERE cliente_id <> ''`,
    `CREATE TABLE IF NOT EXISTS vybe_fin_regras (id text PRIMARY KEY, pos integer NOT NULL, doc jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS vybe_fin_fixos (id text PRIMARY KEY, pos integer NOT NULL, nome text NOT NULL DEFAULT '', valor numeric(14,2) NOT NULL DEFAULT 0, dia smallint, ativo boolean NOT NULL DEFAULT true, doc jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS vybe_fin_cartao_itens (id text PRIMARY KEY, pos integer NOT NULL, cartao text NOT NULL DEFAULT '', fatura text NOT NULL DEFAULT '', valor numeric(14,2) NOT NULL DEFAULT 0, categoria text NOT NULL DEFAULT '', doc jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS vybe_fin_cartao_itens_fatura ON vybe_fin_cartao_itens (cartao, fatura)`,
    `CREATE TABLE IF NOT EXISTS vybe_fin_cartoes (cartao text PRIMARY KEY, dia_vencimento smallint CHECK (dia_vencimento BETWEEN 1 AND 31), atualizado_em timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS vybe_fin_cenarios (id text PRIMARY KEY, pos integer NOT NULL, nome text NOT NULL DEFAULT '', doc jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now())`,
    // Orçamento e fechamentos: as tabelas que a migração 2026-11-11-financas-base.sql criou (iguais, sem as FKs, para
    // poderem nascer aqui também). Se já existem, nada muda nelas além das colunas novas do fechamento.
    `CREATE TABLE IF NOT EXISTS vybe_financas_orcamento_mensal (
      id bigserial PRIMARY KEY,
      mes text NOT NULL CHECK (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
      categoria text NOT NULL CHECK (length(trim(categoria)) BETWEEN 1 AND 120),
      valor numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
      origem_financas_id uuid UNIQUE,
      atualizado_por bigint,
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (mes, categoria)
    )`,
    `CREATE TABLE IF NOT EXISTS vybe_financas_fechamentos (
      mes text PRIMARY KEY CHECK (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
      fechado_em timestamptz NOT NULL DEFAULT now(),
      fechado_por bigint,
      fechado_por_email text NOT NULL DEFAULT '' CHECK (length(fechado_por_email) <= 200),
      observacoes text NOT NULL DEFAULT '' CHECK (length(observacoes) <= 4000),
      totais jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(totais) = 'object'),
      documento_url text NOT NULL DEFAULT '' CHECK (length(documento_url) <= 2000),
      origem_financas_id uuid UNIQUE
    )`,
    `ALTER TABLE vybe_financas_fechamentos ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'fechado'`,
    `ALTER TABLE vybe_financas_fechamentos ADD COLUMN IF NOT EXISTS fechado_por_nome text NOT NULL DEFAULT ''`,
    `ALTER TABLE vybe_financas_fechamentos ADD COLUMN IF NOT EXISTS doc jsonb`,
    // Por último: é a marca de que o bloco terminou.
    `CREATE TABLE IF NOT EXISTS vybe_fin_estado (chave text PRIMARY KEY, valor jsonb NOT NULL, em timestamptz NOT NULL DEFAULT now())`,
  ] },
  { nome: 'fin_contratos', depende: 'vybe_cliente_contratos', pronto: ['coluna', 'vybe_cliente_contratos', 'reajuste_pct'], comandos: [
    // O contrato completo (26/11/2026): o dia do vencimento real, o fim (vazio = sem fim) e o reajuste (data e %).
    `ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS dia_vencimento smallint CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31)`,
    `ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS fim date`,
    `ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS reajuste_em date`,
    `ALTER TABLE vybe_cliente_contratos ADD COLUMN IF NOT EXISTS reajuste_pct numeric(6,2) CHECK (reajuste_pct IS NULL OR reajuste_pct BETWEEN -100 AND 300)`,
  ] },
]);
export const BLOCOS_FINANCEIRO = BLOCOS;

async function existe(sql, [tipo, tabela, coluna]) {
  if (tipo === 'tabela') { const [r] = await sql`SELECT (to_regclass(${'public.' + tabela}) IS NOT NULL) AS ok`; return Boolean(r?.ok); }
  const [r] = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ${tabela} AND column_name = ${coluna}) AS ok`;
  return Boolean(r?.ok);
}

// Uma vez por banco em cada instância (a mesma regra de server/uma-vez.js); se falhar, tenta de novo em 10 minutos.
const porBanco = new Map(), porObjeto = new WeakMap();
function chaveDo(sql) { return typeof sql?.identidadeDoBanco === 'string' ? sql.identidadeDoBanco : null; }
function lembrar(sql) { const id = chaveDo(sql); if (id) return [porBanco, id]; if (!porObjeto.has(sql)) porObjeto.set(sql, new Map()); return [porObjeto.get(sql), 'x']; }
export function garantirTabelasFinanceiro(sql) {
  const [mapa, k] = lembrar(sql);
  const atual = mapa.get(k);
  if (atual && !(atual.falhou && Date.now() - atual.falhou > 10 * 60e3)) return atual.p;
  const reg = { p: null, falhou: 0, feitos: new Set() };
  reg.p = (async () => {
    for (const b of BLOCOS) {
      try {
        if (!(await existe(sql, ['tabela', b.depende]))) continue;
        if (!(await existe(sql, b.pronto))) for (const cmd of b.comandos) await sql.query(cmd);
        reg.feitos.add(b.nome);
      } catch (e) { reg.falhou = Date.now(); console.error(`[financeiro-tabelas] ${b.nome} aguardando:`, e?.message || e); }
    }
    if (reg.feitos.size < BLOCOS.length && !reg.falhou) mapa.delete(k); // a base de algum ainda não existe: confere de novo depois
    return reg.feitos;
  })();
  mapa.set(k, reg);
  return reg.p;
}
export function esquecerTabelasFinanceiro() { porBanco.clear(); }

// ---------- Linhas: do formato do jsonb para as tabelas ----------
const json = (v) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } } return v ?? null; };
// O lançamento inteiro vai em doc; as colunas são só para consultar (índices). apagado = estava na lixeira.
const linhaLanc = (t, apagado = false) => ({ id: String(t.id), doc: t, apagado: apagado ? (t.apagado_em || new Date().toISOString()) : null });
const assinatura = (t) => JSON.stringify(t);

// Upsert de vários lançamentos de uma vez (um comando), a partir do JSON. As partes são reescritas para esses ids.
async function gravarLancamentos(tx, linhas) {
  if (!linhas.length) return;
  for (let i = 0; i < linhas.length; i += 400) {
    const fatia = JSON.stringify(linhas.slice(i, i + 400));
    await tx.query(`INSERT INTO vybe_fin_lancamentos (id, data, ordem, historico, valor, saldo, formato, categoria, competencia, cliente_id, pessoa_id, fixo_id, status, conferido, apagado_em, doc, atualizado_em)
      SELECT e->>'id', (e->'doc'->'banco'->>'data')::date, COALESCE((e->'doc'->'banco'->>'ordem')::int, 0), COALESCE(e->'doc'->'banco'->>'historico', ''),
        (e->'doc'->'banco'->>'valor')::numeric, NULLIF(e->'doc'->'banco'->>'saldo', '')::numeric, COALESCE(e->'doc'->'banco'->>'formato', ''),
        COALESCE(e->'doc'->'real'->>'categoria', 'a_classificar'), COALESCE(e->'doc'->'real'->>'competencia', ''), COALESCE(e->'doc'->'real'->>'cliente_id', ''),
        COALESCE(e->'doc'->'real'->>'pessoa_id', ''), COALESCE(e->'doc'->'real'->>'fixo_id', ''), COALESCE(e->'doc'->'real'->>'status', 'pago'),
        COALESCE((e->'doc'->'real'->>'conferido')::boolean, false), NULLIF(e->>'apagado', '')::timestamptz, e->'doc', now()
      FROM jsonb_array_elements($1::jsonb) AS e
      ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, ordem=EXCLUDED.ordem, historico=EXCLUDED.historico, valor=EXCLUDED.valor, saldo=EXCLUDED.saldo, formato=EXCLUDED.formato,
        categoria=EXCLUDED.categoria, competencia=EXCLUDED.competencia, cliente_id=EXCLUDED.cliente_id, pessoa_id=EXCLUDED.pessoa_id, fixo_id=EXCLUDED.fixo_id, status=EXCLUDED.status,
        conferido=EXCLUDED.conferido, apagado_em=EXCLUDED.apagado_em, doc=EXCLUDED.doc, atualizado_em=now()`, [fatia]);
    await tx.query(`DELETE FROM vybe_fin_lancamento_partes WHERE lancamento_id IN (SELECT e->>'id' FROM jsonb_array_elements($1::jsonb) AS e)`, [fatia]);
    await tx.query(`INSERT INTO vybe_fin_lancamento_partes (lancamento_id, n, valor, categoria, cliente_id, pessoa_id, competencia, doc)
      SELECT e->>'id', p.n::int - 1, COALESCE((p.v->>'valor')::numeric, 0), COALESCE(p.v->>'categoria', ''), COALESCE(p.v->>'cliente_id', ''), COALESCE(p.v->>'pessoa_id', ''), COALESCE(p.v->>'competencia', ''), p.v
      FROM jsonb_array_elements($1::jsonb) AS e, jsonb_array_elements(COALESCE(e->'doc'->'real'->'partes', '[]'::jsonb)) WITH ORDINALITY AS p(v, n)`, [fatia]);
  }
}
async function tirarLancamentos(tx, ids) {
  if (!ids.length) return;
  await tx.query(`DELETE FROM vybe_fin_lancamentos WHERE id IN (SELECT jsonb_array_elements_text($1::jsonb))`, [JSON.stringify(ids)]);
}
// Listas pequenas e com ordem (regras, fixos, itens do cartão, cenários): reescreve a tabela inteira.
const LISTAS = {
  regras: { tabela: 'vybe_fin_regras', extra: '', valores: '' },
  fixos: { tabela: 'vybe_fin_fixos', extra: ', nome, valor, dia, ativo', valores: `, COALESCE(e.v->>'nome',''), COALESCE((e.v->>'valor')::numeric,0), NULLIF(e.v->>'dia','')::smallint, COALESCE((e.v->>'ativo')::boolean, true)` },
  cartao: { tabela: 'vybe_fin_cartao_itens', extra: ', cartao, fatura, valor, categoria', valores: `, COALESCE(e.v->>'cartao',''), COALESCE(e.v->>'fatura',''), COALESCE((e.v->>'valor')::numeric,0), COALESCE(e.v->>'categoria','')` },
  cenarios: { tabela: 'vybe_fin_cenarios', extra: ', nome', valores: `, COALESCE(e.v->>'nome','')` },
};
async function gravarLista(tx, parte, lista) {
  const L = LISTAS[parte];
  await tx.query(`DELETE FROM ${L.tabela}`);
  const itens = (Array.isArray(lista) ? lista : []).filter((x) => x && x.id);
  if (!itens.length) return;
  await tx.query(`INSERT INTO ${L.tabela} (id, pos, doc${L.extra}) SELECT e.v->>'id', e.n::int, e.v${L.valores} FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS e(v, n)
    ON CONFLICT (id) DO NOTHING`, [JSON.stringify(itens)]);
}
async function gravarCartoes(tx, cartoes) {
  await tx.query(`DELETE FROM vybe_fin_cartoes`);
  const l = Object.entries(cartoes && typeof cartoes === 'object' ? cartoes : {}).map(([cartao, v]) => ({ cartao, dia: Number(v?.dia) || null })).filter((x) => x.dia >= 1 && x.dia <= 31);
  if (l.length) await tx.query(`INSERT INTO vybe_fin_cartoes (cartao, dia_vencimento) SELECT e->>'cartao', (e->>'dia')::smallint FROM jsonb_array_elements($1::jsonb) AS e ON CONFLICT (cartao) DO NOTHING`, [JSON.stringify(l)]);
}
// Orçamento { 'AAAA-MM': { grupo: valor } } → linhas 'grupo:<nome>' (as importadas do Finanças ficam como estão).
async function gravarOrcamento(tx, orc, pessoaId) {
  await tx.query(`DELETE FROM vybe_financas_orcamento_mensal WHERE origem_financas_id IS NULL AND categoria LIKE 'grupo:%'`);
  const l = [];
  for (const [mes, grupos] of Object.entries(orc && typeof orc === 'object' ? orc : {})) for (const [g, v] of Object.entries(grupos || {})) if (/^\d{4}-\d{2}$/.test(mes) && Number(v) >= 0) l.push({ mes, categoria: ('grupo:' + g).slice(0, 120), valor: Number(v) || 0 });
  if (l.length) await tx.query(`INSERT INTO vybe_financas_orcamento_mensal (mes, categoria, valor, atualizado_por) SELECT e->>'mes', e->>'categoria', (e->>'valor')::numeric, $2::bigint FROM jsonb_array_elements($1::jsonb) AS e
    ON CONFLICT (mes, categoria) DO UPDATE SET valor=EXCLUDED.valor, atualizado_por=EXCLUDED.atualizado_por, atualizado_em=now() WHERE vybe_financas_orcamento_mensal.origem_financas_id IS NULL`, [JSON.stringify(l), pessoaId == null ? null : Number(pessoaId) || null]);
}
// Fechamentos { 'AAAA-MM': { situacao, em, por, por_nome, totais, historico } }: só as linhas do Vybe OS (doc preenchido).
async function gravarFechamentos(tx, fech) {
  const l = Object.entries(fech && typeof fech === 'object' ? fech : {}).filter(([mes]) => /^\d{4}-\d{2}$/.test(mes)).map(([mes, f]) => ({ mes, f }));
  await tx.query(`DELETE FROM vybe_financas_fechamentos WHERE origem_financas_id IS NULL AND doc IS NOT NULL AND mes NOT IN (SELECT e->>'mes' FROM jsonb_array_elements($1::jsonb) AS e)`, [JSON.stringify(l)]);
  if (l.length) await tx.query(`INSERT INTO vybe_financas_fechamentos (mes, fechado_em, fechado_por_nome, situacao, totais, doc)
    SELECT e->>'mes', COALESCE(NULLIF(e->'f'->>'em','')::timestamptz, now()), COALESCE(e->'f'->>'por_nome',''), COALESCE(e->'f'->>'situacao','fechado'), COALESCE(e->'f'->'totais','{}'::jsonb), e->'f'
    FROM jsonb_array_elements($1::jsonb) AS e
    ON CONFLICT (mes) DO UPDATE SET fechado_em=EXCLUDED.fechado_em, fechado_por_nome=EXCLUDED.fechado_por_nome, situacao=EXCLUDED.situacao, totais=EXCLUDED.totais, doc=EXCLUDED.doc
    WHERE vybe_financas_fechamentos.origem_financas_id IS NULL`, [JSON.stringify(l)]);
}

export const PARTES_TABELADAS = Object.freeze(['extrato', 'regras', 'fixos', 'cartao', 'cartoes', 'cenarios', 'orcamento', 'fechamentos']);

// O espelho de uma escrita: o que era (antes) e o que ficou (depois) de uma parte do jsonb.
export async function espelhar(tx, parte, antes, depois, pessoaId = null) {
  if (parte === 'extrato') {
    const mapa = (v) => { const m = new Map(); for (const t of v?.transacoes || []) m.set(String(t.id), linhaLanc(t)); for (const t of v?.lixeira || []) if (!m.has(String(t.id))) m.set(String(t.id), linhaLanc(t, true)); return m; };
    const a = mapa(antes), b = mapa(depois);
    const mudou = [...b.values()].filter((l) => { const x = a.get(l.id); return !x || assinatura(x) !== assinatura(l); });
    await gravarLancamentos(tx, mudou);
    await tirarLancamentos(tx, [...a.keys()].filter((id) => !b.has(id)));
    return mudou.length;
  }
  if (LISTAS[parte]) { await gravarLista(tx, parte, depois); return (depois || []).length; }
  if (parte === 'cartoes') { await gravarCartoes(tx, depois); return 1; }
  if (parte === 'orcamento') { await gravarOrcamento(tx, depois, pessoaId); return 1; }
  if (parte === 'fechamentos') { await gravarFechamentos(tx, depois); return 1; }
  return 0;
}

// Numa escrita (server/financeiro.js mudar/mudarVarias): espelha as partes que mudaram, dentro de um SAVEPOINT. Se o
// espelho falhar, só ele volta atrás (o jsonb fica gravado) e as tabelas ficam "dessincronizado" até a próxima cópia.
export async function espelharNaTransacao(tx, mudancas, pessoaId = null) {
  const partes = mudancas.filter((m) => PARTES_TABELADAS.includes(m.parte));
  if (!partes.length || typeof tx.query !== 'function') return { espelhado: 0 };
  await tx.query('SAVEPOINT fin_espelho');
  let emDia = false;
  try {
    const [l] = await tx.query(`SELECT valor ->> 'estado' AS estado FROM vybe_fin_estado WHERE chave = 'tabelas'`);
    emDia = l?.estado === 'ok';
    if (!emDia) { await tx.query('RELEASE SAVEPOINT fin_espelho'); return { espelhado: 0 }; }
    let n = 0;
    for (const m of partes) n += await espelhar(tx, m.parte, m.antes, m.depois, pessoaId);
    await tx.query('RELEASE SAVEPOINT fin_espelho');
    return { espelhado: n };
  } catch (e) {
    await tx.query('ROLLBACK TO SAVEPOINT fin_espelho');
    if (e.code === '42P01') return { espelhado: 0 };
    console.error('[financeiro-tabelas] espelho falhou; as tabelas ficam para refazer do jsonb:', e?.message || e);
    try { await tx.query('SAVEPOINT fin_marca'); await marcarDessincronizado(tx, e?.message); await tx.query('RELEASE SAVEPOINT fin_marca'); }
    catch { try { await tx.query('ROLLBACK TO SAVEPOINT fin_marca'); } catch { /* nada */ } }
    return { espelhado: 0, falhou: true };
  }
}

// ---------- Estado e cópia ----------
const lerFlag = (env) => String(env?.VYBE_FIN_LER || '').trim().toLowerCase();
export async function estadoTabelas(sql) {
  try { const [l] = await sql`SELECT valor FROM vybe_fin_estado WHERE chave = 'tabelas'`; return json(l?.valor) || null; }
  catch (e) { if (e.code === '42P01') return null; throw e; }
}
async function marcar(tx, valor) {
  await tx`INSERT INTO vybe_fin_estado (chave, valor, em) VALUES ('tabelas', ${JSON.stringify(valor)}::jsonb, now()) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, em = now()`;
}
// Dentro da transação de uma escrita: as tabelas estão prontas para receber o espelho?
export async function tabelasEmDia(tx) {
  try { const [l] = await tx`SELECT valor ->> 'estado' AS estado FROM vybe_fin_estado WHERE chave = 'tabelas'`; return l?.estado === 'ok'; }
  catch (e) { if (e.code === '42P01') return false; throw e; }
}
export async function marcarDessincronizado(tx, motivo) {
  try {
    const [l] = await tx`SELECT valor FROM vybe_fin_estado WHERE chave = 'tabelas'`;
    const v = json(l?.valor) || {};
    await marcar(tx, { ...v, estado: 'dessincronizado', motivo: String(motivo || '').slice(0, 300), desde: new Date().toISOString() });
  } catch { /* sem a tabela de estado: a leitura já usa o jsonb */ }
}

const CHAVES_JSONB = { extrato: 'financeiro_extrato', regras: 'financeiro_regras', fixos: 'financeiro_fixos', cartao: 'financeiro_cartao', cartoes: 'financeiro_cartoes', cenarios: 'financeiro_cenarios',
  orcamento: 'financeiro_orcamento', fechamentos: 'financeiro_fechamentos' };
// Copia o jsonb para as tabelas. Roda quando o estado não existe (primeira vez) ou está "dessincronizado" (refaz do
// jsonb, que é sempre gravado primeiro). Trava a chave do extrato para nenhuma escrita entrar no meio.
export async function copiarDoJsonb(sql, { motivo = 'primeira cópia', quem = 'servidor' } = {}) {
  const pronto = await garantirTabelasFinanceiro(sql);
  if (!pronto.has('fin_tabelas')) return { feito: false, motivo: 'sem as tabelas' };
  return sql.comTransacao(async (tx) => {
    await tx`SELECT chave FROM vybe_carteira_config WHERE chave LIKE 'financeiro_%' FOR UPDATE`;
    const [e] = await tx`SELECT valor FROM vybe_fin_estado WHERE chave = 'tabelas' FOR UPDATE`;
    const est = json(e?.valor);
    if (est?.estado === 'ok') return { feito: false, motivo: 'já copiado', estado: est };
    const linhas = await tx`SELECT chave, valor FROM vybe_carteira_config WHERE chave LIKE 'financeiro\_%'`;
    const por = new Map(linhas.map((l) => [l.chave, json(l.valor)]));
    const v = (p) => por.get(CHAVES_JSONB[p]);
    // Refazer: limpa só as linhas do Vybe OS e copia de novo.
    await tx.query(`DELETE FROM vybe_fin_lancamentos`);
    const ext = v('extrato') || {};
    const lancs = [...(ext.transacoes || []).map((t) => linhaLanc(t)), ...(ext.lixeira || []).filter((t) => !(ext.transacoes || []).some((x) => x.id === t.id)).map((t) => linhaLanc(t, true))];
    await gravarLancamentos(tx, lancs);
    for (const p of ['regras', 'fixos', 'cartao', 'cenarios']) await gravarLista(tx, p, v(p) || []);
    await gravarCartoes(tx, v('cartoes') || {});
    await gravarOrcamento(tx, v('orcamento') || {}, null);
    await gravarFechamentos(tx, v('fechamentos') || {});
    const [n] = await tx`SELECT (SELECT count(*) FROM vybe_fin_lancamentos WHERE apagado_em IS NULL)::int AS lancamentos, (SELECT count(*) FROM vybe_fin_lancamentos WHERE apagado_em IS NOT NULL)::int AS apagados,
      (SELECT count(*) FROM vybe_fin_lancamento_partes)::int AS partes, (SELECT count(*) FROM vybe_fin_regras)::int AS regras, (SELECT count(*) FROM vybe_fin_fixos)::int AS fixos,
      (SELECT count(*) FROM vybe_fin_cartao_itens)::int AS cartao, (SELECT count(*) FROM vybe_fin_cenarios)::int AS cenarios`;
    const registro = { estado: 'ok', copiado_em: new Date().toISOString(), por: quem, motivo, linhas: n,
      historico: [...(est?.historico || []), { em: new Date().toISOString(), motivo, linhas: n }].slice(-20) };
    await marcar(tx, registro);
    return { feito: true, estado: registro };
  });
}
// Garante tabelas + cópia (uma vez). Nunca lança: se não der, a leitura fica no jsonb.
export async function prepararTabelas(sql) {
  try {
    const pronto = await garantirTabelasFinanceiro(sql);
    if (!pronto.has('fin_tabelas')) return false;
    const est = await estadoTabelas(sql);
    if (est?.estado === 'ok') return true;
    await copiarDoJsonb(sql, { motivo: est ? 'refeita do jsonb (as tabelas estavam dessincronizadas)' : 'primeira cópia' });
    return true;
  } catch (e) { console.error('[financeiro-tabelas] cópia aguardando:', e?.message || e); return false; }
}

// Lê das tabelas o que o jsonb guardava, no mesmo formato de server/financeiro.js lerTudo(). null = use o jsonb.
// Confere a conta de linhas com o jsonb (barato: jsonb_array_length) para nunca mostrar menos do que existe.
export async function lerDasTabelas(sql, env = process.env) {
  if (lerFlag(env) === 'jsonb') return null;
  try {
    const est = await estadoTabelas(sql);
    if (est?.estado !== 'ok') return null;
    const [conta] = await sql`SELECT COALESCE(jsonb_array_length(valor -> 'transacoes'), 0)::int AS n FROM vybe_carteira_config WHERE chave = 'financeiro_extrato'`;
    const lancs = await sql`SELECT doc, apagado_em FROM vybe_fin_lancamentos`;
    const ativos = lancs.filter((l) => !l.apagado_em).map((l) => json(l.doc));
    if ((conta?.n || 0) !== ativos.length) { console.warn('[financeiro-tabelas] conta não bate com o jsonb; lendo o jsonb', conta?.n, ativos.length); return null; }
    const ordem = (a, b) => a.banco.data.localeCompare(b.banco.data) || (a.banco.ordem || 0) - (b.banco.ordem || 0) || a.id.localeCompare(b.id);
    const lixeira = lancs.filter((l) => l.apagado_em).map((l) => json(l.doc)).sort((a, b) => String(b.apagado_em || '').localeCompare(String(a.apagado_em || '')));
    const lista = async (tabela) => (await sql.query(`SELECT doc FROM ${tabela} ORDER BY pos`)).map((l) => json(l.doc));
    const [regras, fixos, cartao, cenarios] = await Promise.all([lista('vybe_fin_regras'), lista('vybe_fin_fixos'), lista('vybe_fin_cartao_itens'), lista('vybe_fin_cenarios')]);
    const cartoes = Object.fromEntries((await sql`SELECT cartao, dia_vencimento FROM vybe_fin_cartoes`).map((l) => [l.cartao, { dia: Number(l.dia_vencimento) }]));
    const orcamento = {};
    for (const l of await sql`SELECT mes, categoria, valor FROM vybe_financas_orcamento_mensal WHERE origem_financas_id IS NULL AND categoria LIKE 'grupo:%'`) {
      (orcamento[l.mes] ||= {})[l.categoria.slice(6)] = Number(l.valor);
    }
    const fechamentos = Object.fromEntries((await sql`SELECT mes, doc FROM vybe_financas_fechamentos WHERE doc IS NOT NULL`).map((l) => [l.mes, json(l.doc)]));
    return { transacoes: ativos.sort(ordem), lixeira, regras, fixos, cartao, cenarios, cartoes, orcamento, fechamentos, estado: est };
  } catch (e) {
    if (!['42P01', '42703'].includes(e.code)) console.error('[financeiro-tabelas] leitura das tabelas falhou; lendo o jsonb:', e?.message || e);
    return null;
  }
}

// Totais de entradas e saídas por mês, para conferir que a cópia não mudou nada (o teste e a tela de estado usam).
export function totaisPorMes(transacoes = []) {
  const m = new Map();
  for (const t of transacoes) {
    const k = String(t.banco.data).slice(0, 7), x = m.get(k) || { entradas: 0, saidas: 0, n: 0 };
    const c = Math.round(Number(t.banco.valor) * 100);
    if (c > 0) x.entradas += c; else x.saidas -= c; x.n++;
    m.set(k, x);
  }
  return Object.fromEntries([...m].sort().map(([k, x]) => [k, { entradas: x.entradas / 100, saidas: x.saidas / 100, n: x.n }]));
}
