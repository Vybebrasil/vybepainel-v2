// server/impressoes.js — Impressões com módulo próprio (Paulo, 09/11/2026).
//
//   GET  /api/painel?area=impressoes            lista, etapas, clientes, fornecedores, equipe, resumo e por fornecedor
//   POST /api/painel?area=impressoes  { acao }  impressao_salvar | impressao_etapa
//
// Antes, impresso era só uma demanda em Solicitações com o status "Em impressão": sem fornecedor, sem dia do pedido e
// sem saber em que ponto estava. Agora cada impressão tem cliente (cadastro ativo), projeto ou campanha, a arte na
// esteira (a demanda das Solicitações), fornecedor, material, quantidade, especificação, arquivo e responsável, e
// anda por etapas datadas (vybe_impressao_eventos guarda de onde, para onde, quem e quando).
//
// Regras (decididas aqui; a tela só reflete):
//  - Toda a equipe vê, cadastra e move as etapas. Valor só sai e só é gravado pela gestão (donos e administração).
//  - Impressão nova de cliente sem arte ligada abre a arte na esteira (Solicitações, formato Impresso), pelo mesmo
//    cadastro do painel. Quando a arte chega ao fim (ou é aprovada) na esteira, a impressão passa de "Arte" para
//    "Orçamento" sozinha.
//  - Mandar o arquivo, imprimir, ficar pronto ou entregar pede fornecedor. O primeiro envio grava o dia do pedido;
//    "Entregue" grava o dia da entrega. Atrasada = previsão vencida e ainda não entregue.
import { ehGestao } from './pessoas.js';

export const ETAPAS = Object.freeze([
  ['arte', 'Arte'], ['orcamento', 'Orçamento'], ['aprovado', 'Aprovado pelo cliente'], ['arquivo_enviado', 'Arquivo enviado'],
  ['em_impressao', 'Em impressão'], ['pronto', 'Pronto para retirada'], ['entregue', 'Entregue'], ['cancelado', 'Cancelado'],
]);
const CHAVES = new Set(ETAPAS.map(([k]) => k));
const COM_FORNECEDOR = new Set(['arquivo_enviado', 'em_impressao', 'pronto', 'entregue']);
const FECHADAS = new Set(['entregue', 'cancelado']);
const BOARD_SOLICITACOES = 8385559107;

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
const dataOuNula = (v, campo) => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + 'T12:00:00Z'))) falhar(`${campo}: data inválida.`);
  return v;
};
const hojeBahia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(agora);
const semTabela = (e) => e?.code === '42P01';

let criarPeca = null;
export function usarCriacaoDePeca(f) { criarPeca = f; } // só para os testes

const CLIENTE_ATIVO = (sql, id) => sql`SELECT id::text AS id, nome FROM vybe_clientes
  WHERE id = ${id} AND apagado_em IS NULL AND (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false))`;

// A arte terminou (status final) ou foi aprovada na esteira: a impressão sai de "Arte" para "Orçamento".
async function andarComAArte(sql) {
  await sql`WITH prontas AS (
      UPDATE vybe_impressoes i SET etapa = 'orcamento', atualizado_em = now()
        FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
       WHERE i.conteudo_id = c.id AND i.etapa = 'arte' AND c.removido_em IS NULL
         AND (COALESCE(s.final, false) OR c.status_chave IN ('aprovado', 'para_orcar', 'em_orcamento', 'em_impressao'))
      RETURNING i.id)
    INSERT INTO vybe_impressao_eventos (impressao_id, de, para, nota) SELECT id, 'arte', 'orcamento', 'Arte concluída na esteira' FROM prontas`;
}

async function ler(sql, pessoa) {
  const hoje = hojeBahia(), gestao = ehGestao(pessoa);
  await andarComAArte(sql);
  const linhas = await sql`SELECT i.id::text, i.titulo, i.cliente_id::text, cl.nome AS cliente_nome, i.projeto_id::text, pj.nome AS projeto_nome,
      i.conteudo_id::text, s.rotulo AS demanda_status, COALESCE(s.final, false) AS demanda_final,
      i.fornecedor_id::text, f.nome AS fornecedor_nome, i.material, i.quantidade, i.especificacao, i.arquivo_url, i.etapa,
      i.responsavel::text, p.nome AS responsavel_nome, i.pedido_em::text, i.previsao::text, i.entregue_em::text,
      i.valor::float8 AS valor, i.observacao, i.criado_em, i.atualizado_em
    FROM vybe_impressoes i
      LEFT JOIN vybe_clientes cl ON cl.id = i.cliente_id
      LEFT JOIN vybe_projetos pj ON pj.id = i.projeto_id
      LEFT JOIN vybe_conteudos c ON c.id = i.conteudo_id AND c.removido_em IS NULL
      LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
      LEFT JOIN vybe_comercial_fornecedores f ON f.id = i.fornecedor_id
      LEFT JOIN vybe_pessoas p ON p.id = i.responsavel
    WHERE i.etapa NOT IN ('entregue', 'cancelado') OR i.atualizado_em >= now() - interval '90 days'
    ORDER BY (i.etapa IN ('entregue', 'cancelado')), i.previsao NULLS LAST, i.id`;
  const ids = linhas.map((l) => l.id);
  const eventos = ids.length ? await sql`SELECT e.impressao_id::text AS impressao_id, e.de, e.para, e.nota, p.nome AS autor_nome, e.em
      FROM vybe_impressao_eventos e LEFT JOIN vybe_pessoas p ON p.id = e.autor_id
     WHERE e.impressao_id::text = ANY(${ids}::text[]) ORDER BY e.em, e.id` : [];
  const porImpressao = new Map();
  for (const e of eventos) (porImpressao.get(e.impressao_id) || porImpressao.set(e.impressao_id, []).get(e.impressao_id)).push(e);
  const impressoes = linhas.map((l) => {
    const { valor, ...resto } = l;
    const atrasada = !FECHADAS.has(l.etapa) && Boolean(l.previsao) && l.previsao < hoje;
    return { ...resto, ...(gestao ? { valor } : {}), atrasada, eventos: porImpressao.get(l.id) || [] };
  });
  const [clientes, fornecedores, pessoas, projetos] = await Promise.all([
    sql`SELECT id::text, nome FROM vybe_clientes WHERE apagado_em IS NULL AND (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false)) ORDER BY nome`,
    sql`SELECT id::text, nome, categoria FROM vybe_comercial_fornecedores WHERE ativo ORDER BY (categoria <> 'grafica'), nome`,
    sql`SELECT id::text, nome FROM vybe_pessoas WHERE ativo AND pode_entrar ORDER BY nome`,
    Promise.resolve(sql`SELECT id::text, nome, cliente_id::text FROM vybe_projetos WHERE status NOT IN ('concluido','cancelado') ORDER BY inicio DESC, id DESC`).catch(() => []),
  ]);
  return { hoje, gestao, etapas: ETAPAS.map(([id, nome]) => ({ id, nome })), impressoes, clientes, fornecedores, pessoas, projetos,
    resumo: resumir(impressoes), porFornecedor: porFornecedor(impressoes, fornecedores) };
}

export function resumir(impressoes) {
  const porEtapa = Object.fromEntries(ETAPAS.map(([k]) => [k, 0]));
  for (const i of impressoes) porEtapa[i.etapa] = (porEtapa[i.etapa] || 0) + 1;
  const abertas = impressoes.filter((i) => !FECHADAS.has(i.etapa));
  return { abertas: abertas.length, atrasadas: abertas.filter((i) => i.atrasada).length, semFornecedor: abertas.filter((i) => !i.fornecedor_id).length, porEtapa };
}

// Para a tela do fornecedor: o que ele tem agora, o que está atrasado e quantos dias leva do pedido à entrega.
export function porFornecedor(impressoes, fornecedores = []) {
  const nome = new Map(fornecedores.map((f) => [f.id, f.nome]));
  const m = new Map();
  for (const i of impressoes) {
    if (!i.fornecedor_id) continue;
    const f = m.get(i.fornecedor_id) || { fornecedor_id: i.fornecedor_id, nome: i.fornecedor_nome || nome.get(i.fornecedor_id) || '', abertas: 0, atrasadas: 0, entregues: 0, dias: [] };
    if (!FECHADAS.has(i.etapa)) { f.abertas++; if (i.atrasada) f.atrasadas++; }
    if (i.etapa === 'entregue') {
      f.entregues++;
      if (i.pedido_em && i.entregue_em) f.dias.push(Math.round((Date.parse(i.entregue_em) - Date.parse(i.pedido_em)) / 864e5));
    }
    m.set(i.fornecedor_id, f);
  }
  return [...m.values()].map(({ dias, ...f }) => ({ ...f, prazo_medio_dias: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null }))
    .sort((a, b) => b.abertas - a.abertas || a.nome.localeCompare(b.nome));
}

async function evento(tx, id, de, para, nota, autor) {
  await tx`INSERT INTO vybe_impressao_eventos (impressao_id, de, para, nota, autor_id) VALUES (${id}, ${de}, ${para}, ${nota || ''}, ${autor})`;
}

async function salvar(sql, pessoa, b) {
  const gestao = ehGestao(pessoa), eu = String(pessoa.id);
  const id = idOuNulo(b.id, 'Impressão');
  const d = {
    titulo: texto(b.titulo, 200, 'O que imprimir', true), material: texto(b.material, 80, 'Material'), especificacao: texto(b.especificacao, 2000, 'Especificação'),
    observacao: texto(b.observacao, 2000, 'Observação'), arquivo_url: texto(b.arquivo_url, 1000, 'Arquivo'),
    cliente_id: idOuNulo(b.cliente_id, 'Cliente'), projeto_id: idOuNulo(b.projeto_id, 'Projeto'), conteudo_id: idOuNulo(b.conteudo_id, 'Arte'),
    fornecedor_id: idOuNulo(b.fornecedor_id, 'Fornecedor'), responsavel: idOuNulo(b.responsavel, 'Responsável'), previsao: dataOuNula(b.previsao, 'Previsão'),
  };
  if (d.arquivo_url && !/^https:\/\/\S+$/.test(d.arquivo_url)) falhar('Arquivo: use um endereço que comece com https://');
  const q = b.quantidade == null || b.quantidade === '' ? null : Number(b.quantidade);
  if (q != null && (!Number.isInteger(q) || q < 1 || q > 10000000)) falhar('Quantidade: um número inteiro a partir de 1.');
  const valor = gestao && b.valor != null && b.valor !== '' ? Number(b.valor) : undefined;
  if (valor !== undefined && (!Number.isFinite(valor) || valor < 0)) falhar('Valor inválido.');
  return sql.comTransacao(async (tx) => {
    let cliente = null;
    if (d.cliente_id) { [cliente] = await CLIENTE_ATIVO(tx, d.cliente_id); if (!cliente) falhar('Escolha um cliente ativo da lista.'); }
    if (d.fornecedor_id && !(await tx`SELECT 1 FROM vybe_comercial_fornecedores WHERE id = ${d.fornecedor_id} AND ativo`).length) falhar('Escolha um fornecedor ativo.');
    if (d.responsavel && !(await tx`SELECT 1 FROM vybe_pessoas WHERE id = ${d.responsavel} AND ativo AND pode_entrar`).length) falhar('Responsável indisponível.');
    if (d.projeto_id && !(await tx`SELECT 1 FROM vybe_projetos WHERE id = ${d.projeto_id}`).length) falhar('Projeto não encontrado.');
    if (d.conteudo_id && !(await tx`SELECT 1 FROM vybe_conteudos WHERE id = ${d.conteudo_id} AND removido_em IS NULL`).length) falhar('Arte não encontrada na esteira.');
    if (id) {
      const [antes] = await tx`SELECT etapa FROM vybe_impressoes WHERE id = ${id} FOR UPDATE`;
      if (!antes) falhar('Impressão não encontrada.', 404);
      if (COM_FORNECEDOR.has(antes.etapa) && !d.fornecedor_id) falhar('Nesta etapa a impressão precisa de fornecedor.');
      try {
        await tx`UPDATE vybe_impressoes SET titulo=${d.titulo}, material=${d.material}, quantidade=${q}, especificacao=${d.especificacao}, observacao=${d.observacao},
          arquivo_url=${d.arquivo_url}, cliente_id=${d.cliente_id}, projeto_id=${d.projeto_id}, conteudo_id=${d.conteudo_id}, fornecedor_id=${d.fornecedor_id},
          responsavel=${d.responsavel}, previsao=${d.previsao}::date, atualizado_em=now() WHERE id=${id}`;
      } catch (e) { if (e?.code === '23505') falhar('Essa arte já está ligada a outra impressão.', 409); throw e; }
      if (valor !== undefined) await tx`UPDATE vybe_impressoes SET valor=${valor} WHERE id=${id}`;
      return { id };
    }
    // Nova: sem arte ligada e com cliente, a arte nasce na esteira (Solicitações, formato Impresso).
    let conteudoId = d.conteudo_id, arte = null;
    if (!conteudoId && cliente && b.criar_arte !== false) {
      const criar = criarPeca || (await import('../api/conteudo.js')).criarConteudoNaTransacao;
      const briefing = [d.material && `Material: ${d.material}`, q && `Quantidade: ${q}`, d.especificacao, d.observacao].filter(Boolean).join('\n');
      const r = await criar(tx, { tipo: 'sessao', pessoa }, { board: BOARD_SOLICITACOES, status: 'nova_demanda', formato: 'Impresso',
        titulo: `Impresso - ${d.titulo}`.slice(0, 240), cliente: cliente.nome, prazo: d.previsao, briefing, responsaveis: [] });
      conteudoId = String(r.conteudo_id); arte = conteudoId;
      if (d.responsavel) await tx`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem) VALUES (${conteudoId}, ${d.responsavel}, 0) ON CONFLICT DO NOTHING`;
    }
    let novo;
    try {
      [novo] = await tx`INSERT INTO vybe_impressoes (titulo, material, quantidade, especificacao, observacao, arquivo_url, cliente_id, projeto_id, conteudo_id,
          fornecedor_id, responsavel, previsao, valor, criado_por)
        VALUES (${d.titulo}, ${d.material}, ${q}, ${d.especificacao}, ${d.observacao}, ${d.arquivo_url}, ${d.cliente_id}, ${d.projeto_id}, ${conteudoId},
          ${d.fornecedor_id}, ${d.responsavel}, ${d.previsao}::date, ${valor ?? null}, ${eu}) RETURNING id::text AS id`;
    } catch (e) { if (e?.code === '23505') falhar('Essa arte já está ligada a outra impressão.', 409); throw e; }
    await evento(tx, novo.id, null, 'arte', arte ? 'Arte aberta nas Solicitações' : '', eu);
    return { id: novo.id, arte_id: arte };
  });
}

async function mudarEtapa(sql, pessoa, b) {
  const id = idValido(b.id, 'Impressão'), para = String(b.etapa || ''), nota = texto(b.nota, 500, 'Nota');
  if (!CHAVES.has(para)) falhar('Etapa inválida.');
  const hoje = hojeBahia();
  return sql.comTransacao(async (tx) => {
    const [i] = await tx`SELECT etapa, fornecedor_id::text AS fornecedor_id FROM vybe_impressoes WHERE id = ${id} FOR UPDATE`;
    if (!i) falhar('Impressão não encontrada.', 404);
    if (i.etapa === para) return { id, etapa: para };
    if (COM_FORNECEDOR.has(para) && !i.fornecedor_id) falhar('Escolha o fornecedor antes de mandar para a gráfica.');
    if (para === 'cancelado' && !nota) falhar('Diga por que a impressão foi cancelada.');
    const pedido = ['arquivo_enviado', 'em_impressao'].includes(para);
    await tx`UPDATE vybe_impressoes SET etapa = ${para}, atualizado_em = now(),
        pedido_em = CASE WHEN ${pedido} THEN COALESCE(pedido_em, ${hoje}::date) ELSE pedido_em END,
        entregue_em = CASE WHEN ${para} = 'entregue' THEN ${hoje}::date WHEN ${para} = 'cancelado' THEN entregue_em ELSE NULL END
      WHERE id = ${id}`;
    await evento(tx, id, i.etapa, para, nota, String(pessoa.id));
    return { id, etapa: para };
  });
}

export async function areaImpressoes(req, res, quem, sql) {
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar Impressões.' });
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'Impressões exige uma sessão pessoal.' });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  const pessoa = quem.pessoa;
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await ler(sql, pessoa)) });
    const b = req.body || {};
    const acao = String(b.acao || '');
    const r = acao === 'impressao_salvar' ? await salvar(sql, pessoa, b)
      : acao === 'impressao_etapa' ? await mudarEtapa(sql, pessoa, b)
      : falhar('Ação desconhecida. Use impressao_salvar ou impressao_etapa.');
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    if (semTabela(e)) return res.status(503).json({ error: 'Impressões ainda está sendo ligado no banco. Tente de novo em alguns minutos.' });
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[impressoes]', e);
    return res.status(500).json({ error: 'Não foi possível acessar Impressões. Tente novamente.' });
  }
}
