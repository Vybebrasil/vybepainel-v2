// Biblioteca de roteiros da Produção (decisão do Paulo, 21/10/2026;
// docs/captacao-plano.md, etapa 2). O roteiro continua no Google Docs; aqui fica
// a referência do doc, o cliente, as peças que ele descreve e os conteúdos do
// painel que saíram dele, para ver por cliente e por mês o que cada roteiro
// gerou. Toda a equipe vê e liga (estações abertas); o servidor confere roteiro,
// conteúdo e cliente. Novos docs entram pelo Drive que a conta do painel
// enxerga (roteirosNoDrive) ou colando o link.
import { roteirosNoDrive, textoDoDoc } from '../vybe_drive.js';
import { clienteDoEvento } from './captacoes.js';

const FUSO = 'America/Bahia';
const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
const idValido = (v) => /^\d{1,18}$/.test(String(v || ''));
const normal = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());

export async function roteirosProntos(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_roteiros') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}
async function exigirTabelas(sql) {
  if (!(await roteirosProntos(sql))) throw erro('Os roteiros aguardam a migração do banco.', 503);
}

// Aceita o link do Docs (…/document/d/<id>/edit) ou o próprio id.
export function docDoLink(link) {
  const t = String(link || '').trim();
  const m = t.match(/\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,100})/) || t.match(/^([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : '';
}
export const linkDoDoc = (id) => `https://docs.google.com/document/d/${id}/edit`;

// As peças de um roteiro são as linhas que abrem cada bloco: "Roteiro 1: …",
// "Reels 2 – …", "Vídeo 3". Sem elas o roteiro vale como uma peça só.
const ABRE_PECA = /^\s*(?:#+\s*)?(roteiro|reels?|v[ií]deo|story|stories|post|carrossel|card)\s*(?:n[ºo°.]?\s*)?(\d{1,2})\b\s*[:\-–—.)]?\s*(.*)$/i;
export function pecasDoTexto(texto) {
  const vistos = new Set(), pecas = [];
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const m = linha.match(ABRE_PECA);
    if (!m) continue;
    const tipo = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), resto = m[3].replace(/\s+/g, ' ').trim().replace(/^["“]|["”]$/g, '');
    const chave = `${normal(tipo)}${m[2]}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    pecas.push(`${tipo} ${Number(m[2])}${resto ? `: ${resto}` : ''}`.slice(0, 160));
    if (pecas.length >= 30) break;
  }
  return pecas;
}

// Todos os roteiros, do mais novo para o mais antigo, com os conteúdos ligados.
export async function listarRoteiros(sql) {
  await exigirTabelas(sql);
  const linhas = await sql`SELECT r.id::text AS id, r.doc_id, r.titulo, r.cliente_id::text AS cliente_id, cl.nome AS cliente,
      r.criado_em::text AS criado_em, r.pecas, r.origem,
      COALESCE(json_agg(json_build_object('id', c.id::text, 'titulo', c.titulo, 'formato', c.formato,
        'veiculacao', c.veiculacao::text, 'prazo', c.prazo::text, 'status', s.rotulo, 'status_cor', s.cor) ORDER BY COALESCE(c.veiculacao, c.prazo), c.id) FILTER (WHERE c.id IS NOT NULL), '[]') AS conteudos
    FROM vybe_roteiros r
    LEFT JOIN vybe_clientes cl ON cl.id = r.cliente_id
    LEFT JOIN vybe_roteiro_conteudos rc ON rc.roteiro_id = r.id
    LEFT JOIN vybe_conteudos c ON c.id = rc.conteudo_id AND c.removido_em IS NULL
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE r.removido_em IS NULL
    GROUP BY r.id, cl.nome
    ORDER BY r.criado_em DESC, r.id DESC`;
  return linhas.map((r) => ({ ...r, link: linkDoDoc(r.doc_id) }));
}

async function roteiro(sql, id) {
  if (!idValido(id)) throw erro('Roteiro inválido.');
  const [r] = await sql`SELECT id, doc_id, titulo, cliente_id, criado_em::text AS criado_em, pecas FROM vybe_roteiros WHERE id = ${id} AND removido_em IS NULL`;
  if (!r) throw erro('Roteiro não encontrado.', 404);
  return r;
}

// Palavras que contam para dizer que um conteúdo saiu do roteiro.
const VAZIAS = new Set('para com que uma dos das por sua seu voce nao mais como sobre isso essa esse tem ter ainda depois antes todo toda reels reel video videos foto fotografia card carrossel stories story post roteiro roteiros captacao entrevista'.split(' '));
const palavras = (s) => normal(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length >= 4 && !VAZIAS.has(w));
export function notaDoCandidato(r, c) {
  const doRoteiro = new Set(palavras([r.titulo, ...(r.pecas || [])].join(' ')));
  const comuns = new Set(palavras(c.titulo).filter((w) => doRoteiro.has(w))).size;
  const dia = c.veiculacao || c.prazo;
  const dias = dia ? (new Date(`${dia}T12:00:00Z`) - new Date(`${r.criado_em}T12:00:00Z`)) / 864e5 : null;
  const perto = dias !== null && dias >= -7 && dias <= 60;
  return comuns * 2 + (perto ? 1 : 0) + (perto && /reels|v[ií]deo|story|stories/i.test(`${c.formato} ${c.titulo}`) ? 1 : 0);
}

// Conteúdos do cliente do roteiro para ligar: os que parecem ter saído dele
// primeiro (palavras em comum, data perto do roteiro, formato de vídeo).
export async function candidatos(sql, { roteiro_id, busca = '' } = {}) {
  await exigirTabelas(sql);
  const r = await roteiro(sql, roteiro_id);
  const termo = String(busca || '').trim().slice(0, 80);
  if (!r.cliente_id && !termo) return { candidatos: [], aviso: 'Escolha o cliente do roteiro ou busque o conteúdo pelo nome.' };
  const desde = new Date(`${r.criado_em}T12:00:00Z`); desde.setUTCDate(desde.getUTCDate() - 30);
  const ate = new Date(`${r.criado_em}T12:00:00Z`); ate.setUTCDate(ate.getUTCDate() + 120);
  const linhas = await sql`SELECT c.id::text AS id, c.titulo, c.formato, c.veiculacao::text AS veiculacao, c.prazo::text AS prazo,
      s.rotulo AS status, s.cor AS status_cor,
      EXISTS (SELECT 1 FROM vybe_roteiro_conteudos rc WHERE rc.roteiro_id = ${r.id} AND rc.conteudo_id = c.id) AS ligado
    FROM vybe_conteudos c
    LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL
      AND (${r.cliente_id}::bigint IS NULL OR EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc WHERE cc.conteudo_id = c.id AND cc.cliente_id = ${r.cliente_id}))
      AND (${termo} = '' OR c.titulo ILIKE ${'%' + termo.replace(/[%_\\]/g, '\\$&') + '%'})
      AND (${termo} <> '' OR COALESCE(c.veiculacao, c.prazo, c.criado_em::date) BETWEEN ${desde.toISOString().slice(0, 10)}::date AND ${ate.toISOString().slice(0, 10)}::date)
    ORDER BY COALESCE(c.veiculacao, c.prazo) DESC NULLS LAST, c.id DESC
    LIMIT 200`;
  const lista = linhas.map((c) => ({ ...c, nota: notaDoCandidato(r, c) }))
    .sort((a, b) => Number(b.ligado) - Number(a.ligado) || b.nota - a.nota || String(b.veiculacao || b.prazo || '').localeCompare(String(a.veiculacao || a.prazo || '')))
    .slice(0, 40).map(({ nota, ...c }) => ({ ...c, sugerido: nota >= 2 }));
  return { candidatos: lista };
}

export async function ligar(sql, quem, { roteiro_id, conteudo_id, desfazer = false } = {}) {
  await exigirTabelas(sql);
  const r = await roteiro(sql, roteiro_id);
  if (!idValido(conteudo_id)) throw erro('Conteúdo inválido.');
  if (desfazer) { await sql`DELETE FROM vybe_roteiro_conteudos WHERE roteiro_id = ${r.id} AND conteudo_id = ${conteudo_id}`; return { ligado: false }; }
  const [c] = await sql`SELECT id FROM vybe_conteudos WHERE id = ${conteudo_id} AND removido_em IS NULL`;
  if (!c) throw erro('Conteúdo não encontrado.', 404);
  await sql`INSERT INTO vybe_roteiro_conteudos (roteiro_id, conteudo_id, ligado_por) VALUES (${r.id}, ${conteudo_id}, ${quem.pessoa?.id || null}) ON CONFLICT DO NOTHING`;
  return { ligado: true };
}

async function clienteValido(sql, id) {
  if (id === '' || id === null || id === undefined) return null;
  if (!idValido(id)) throw erro('Cliente inválido.');
  const [c] = await sql`SELECT id FROM vybe_clientes WHERE id = ${id}`;
  if (!c) throw erro('Cliente não encontrado.', 404);
  return c.id;
}
const tituloValido = (t) => {
  const v = String(t || '').replace(/\s+/g, ' ').trim();
  if (!v) throw erro('Dê um nome ao roteiro.');
  if (v.length > 300) throw erro('O nome passou de 300 caracteres.');
  return v;
};

// Colar o link de um doc. Se a conta do painel enxerga o doc, as peças saem do
// texto; se não, o roteiro fica com o link e o aviso.
export async function incluirRoteiro(sql, quem, d = {}, { ler = textoDoDoc } = {}) {
  await exigirTabelas(sql);
  const doc = docDoLink(d.link);
  if (!doc) throw erro('Cole o link do Google Docs do roteiro.');
  const titulo = tituloValido(d.titulo), cliente = await clienteValido(sql, d.cliente_id);
  const [ja] = await sql`SELECT id, removido_em FROM vybe_roteiros WHERE doc_id = ${doc}`;
  if (ja && !ja.removido_em) throw erro('Esse roteiro já está na biblioteca.', 409);
  const avisos = [];
  let pecas = [];
  try { pecas = pecasDoTexto(await ler(doc)); }
  catch { avisos.push('O painel não enxerga esse doc, então as peças não foram lidas. Compartilhe o doc com a pasta da Vybe no Drive para ler.'); }
  const [r] = await sql`INSERT INTO vybe_roteiros (doc_id, titulo, cliente_id, criado_em, pecas, origem, incluido_por)
    VALUES (${doc}, ${titulo}, ${cliente}, ${hoje()}::date, ${JSON.stringify(pecas)}::jsonb, 'painel', ${quem.pessoa?.id || null})
    ON CONFLICT (doc_id) DO UPDATE SET titulo = EXCLUDED.titulo, cliente_id = EXCLUDED.cliente_id, pecas = EXCLUDED.pecas, removido_em = NULL
    RETURNING id::text AS id`;
  return { id: r.id, avisos };
}

export async function editarRoteiro(sql, quem, d = {}) {
  await exigirTabelas(sql);
  const r = await roteiro(sql, d.id);
  if (d.remover) { await sql`UPDATE vybe_roteiros SET removido_em = now() WHERE id = ${r.id}`; return { removido: true }; }
  const titulo = tituloValido(d.titulo ?? r.titulo), cliente = await clienteValido(sql, d.cliente_id ?? r.cliente_id);
  await sql`UPDATE vybe_roteiros SET titulo = ${titulo}, cliente_id = ${cliente} WHERE id = ${r.id}`;
  return { id: String(r.id) };
}

// Busca no Drive os docs de roteiro que ainda não estão na biblioteca e os
// inclui com o cliente pelo nome do doc (o mesmo casamento da agenda).
export async function sincronizarDoDrive(sql, quem, { buscar = roteirosNoDrive, ler = textoDoDoc } = {}) {
  await exigirTabelas(sql);
  const [docs, clientes, conhecidos] = await Promise.all([
    buscar(),
    sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE COALESCE(ativo, true)`,
    sql`SELECT doc_id FROM vybe_roteiros`,
  ]);
  const ja = new Set(conhecidos.map((r) => r.doc_id));
  const novos = [];
  for (const f of docs.filter((x) => x.id && !ja.has(x.id)).slice(0, 25)) {
    let pecas = [];
    try { pecas = pecasDoTexto(await ler(f.id)); } catch { /* fica sem peças; o link vale */ }
    const cliente = clienteDoEvento(f.nome, clientes);
    const criado = /^\d{4}-\d{2}-\d{2}$/.test(f.criado) ? f.criado : hoje();
    const [r] = await sql`INSERT INTO vybe_roteiros (doc_id, titulo, cliente_id, criado_em, pecas, origem, incluido_por)
      VALUES (${f.id}, ${String(f.nome).slice(0, 300) || 'Roteiro'}, ${cliente?.id || null}, ${criado}::date, ${JSON.stringify(pecas)}::jsonb, 'drive', ${quem.pessoa?.id || null})
      ON CONFLICT (doc_id) DO NOTHING RETURNING id::text AS id`;
    if (r) novos.push({ id: r.id, titulo: f.nome, cliente: cliente?.nome || '' });
  }
  return { novos };
}

// Para a Captação: o roteiro de cada peça, quando ela saiu de um doc.
export async function roteirosDosConteudos(sql, ids = []) {
  const validos = [...new Set(ids.map(String).filter(idValido))];
  if (!validos.length || !(await roteirosProntos(sql))) return new Map();
  const linhas = await sql`SELECT rc.conteudo_id::text AS conteudo_id, r.titulo, r.doc_id
    FROM vybe_roteiro_conteudos rc JOIN vybe_roteiros r ON r.id = rc.roteiro_id AND r.removido_em IS NULL
    WHERE rc.conteudo_id = ANY(${validos}::bigint[]) ORDER BY r.criado_em DESC`;
  const mapa = new Map();
  for (const l of linhas) if (!mapa.has(l.conteudo_id)) mapa.set(l.conteudo_id, { titulo: l.titulo, link: linkDoDoc(l.doc_id) });
  return mapa;
}

// Clientes para escolher ao incluir ou corrigir um roteiro.
export const clientesDosRoteiros = (sql) => sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE COALESCE(ativo, true) ORDER BY nome`;
