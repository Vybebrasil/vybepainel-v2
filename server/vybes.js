// VYBES dentro do Vybe OS (decisão do Paulo, 02/11/2026: "os heads usam a interface como eu; Vinícius, Ewerton e Deivid
// veem exatamente como eu e podem tomar as ações; os outros só veem"). O VYBES roda no PC do Paulo (WhatsApp, modelo
// local, turno da noite) e publica aqui o mesmo estado que a central dele mostra (consulta `vybes_publicar` do bot).
// - Quem está em vybe_vybes_operadores vê tudo e age, pelo MESMO executor das ações do assistente
//   (prepararAcao/confirmarAcao: resumo, SIM e a permissão de cada pessoa conferida aqui no servidor).
// - O resto da equipe só vê, e sem o texto das conversas (clientes e grupos internos).
// - Diretoria e Vybe CEO nunca entram no estado publicado.
// Migração: migrations/2026-11-02-vybes.sql.
import { prepararAcao, confirmarAcao } from './assistente-acoes.js';

const LIMITE_BYTES = 700 * 1024;
const GRUPOS_RESERVADOS = /diretoria|vybe\s*ceo/i;

function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status }); }

// O que o bot manda, conferido: objeto, tamanho limitado e sem os grupos reservados da direção.
export function estadoPublicavel(estado) {
  if (!estado || typeof estado !== 'object' || Array.isArray(estado)) throw erro('Estado inválido.', 400);
  const e = structuredClone(estado);
  const internos = e?.whatsapp?.internos;
  if (internos && Array.isArray(internos.mensagens)) internos.mensagens = internos.mensagens.filter((m) => !GRUPOS_RESERVADOS.test(String(m?.grupo || '')));
  if (internos && Array.isArray(internos.alertas)) internos.alertas = internos.alertas.filter((m) => !GRUPOS_RESERVADOS.test(String(m?.grupo || '')));
  if (internos && Array.isArray(internos.grupos)) internos.grupos = internos.grupos.filter((g) => !GRUPOS_RESERVADOS.test(String(g || '')));
  const bytes = Buffer.byteLength(JSON.stringify(e));
  if (bytes > LIMITE_BYTES) throw erro('Estado grande demais.', 413);
  return { e, bytes };
}

export async function guardarEstadoVybes(sql, estado) {
  const { e, bytes } = estadoPublicavel(estado);
  await sql`INSERT INTO vybe_vybes_estado (id, estado, atualizado_em) VALUES (1, ${JSON.stringify(e)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, atualizado_em = now()`;
  return { guardado: true, bytes };
}

export async function podeAgirNoVybes(sql, quem) {
  const id = Number(quem?.pessoa?.id);
  if (quem?.tipo !== 'sessao' || !Number.isInteger(id) || id <= 0) return false;
  const [r] = await sql`SELECT 1 AS ok FROM vybe_vybes_operadores o JOIN vybe_pessoas p ON p.id = o.pessoa_id
    WHERE o.pessoa_id = ${id} AND p.ativo IS TRUE`;
  return Boolean(r?.ok);
}

// Para quem só vê: os números, nomes e peças ficam; o texto das conversas (cliente e time) sai.
export function semConversas(estado) {
  const e = structuredClone(estado || {});
  const w = e.whatsapp;
  if (w) {
    for (const c of w.clientes || []) { delete c.ultimo; delete c.texto; }
    for (const c of w.esperando || []) delete c.texto;
    if (w.internos) w.internos = { n: w.internos.n || 0, grupos: w.internos.grupos || [] };
    delete w.mensagens;
  }
  for (const s of e.jornada || []) if (s.tipo === 'whatsapp') { s.texto = 'Resumo do WhatsApp disponível para quem acompanha os clientes.'; s.dados = {}; }
  for (const p of e.prioridades || []) if (/^clientes$|^pedido-/.test(String(p.id || ''))) { p.fato = ''; p.itens = (p.itens || []).map((i) => ({ titulo: i.titulo })); }
  return e;
}

export async function lerEstadoVybes(sql, quem) {
  const [linha] = await sql`SELECT estado, atualizado_em FROM vybe_vybes_estado WHERE id = 1`;
  const podeAgir = await podeAgirNoVybes(sql, quem);
  if (!linha) return { estado: null, atualizadoEm: null, podeAgir };
  return { estado: podeAgir ? linha.estado : semConversas(linha.estado), atualizadoEm: linha.atualizado_em, podeAgir };
}

// Ação pelo VYBES: só quem é operador; o resto é o executor das ações do assistente (que confere a permissão da pessoa
// em cada ação, como no WhatsApp). preparar → resumo + código; confirmar → executa (o "SIM").
export async function acaoVybes(sql, quem, corpo, { segredo = process.env.VYBE_AI_LINK_SECRET, executar } = {}) {
  if (!(await podeAgirNoVybes(sql, quem))) throw erro('No VYBES, só Paulo, Vinícius, Ewerton e Deivid tomam ações. Você pode ver tudo.', 403);
  const pessoaId = Number(quem.pessoa.id);
  if (corpo?.etapa === 'preparar') return prepararAcao(sql, pessoaId, corpo.pedido, segredo);
  if (corpo?.etapa === 'confirmar') return confirmarAcao(sql, pessoaId, corpo.codigo, segredo, executar ? { executar } : {});
  throw erro('Informe a etapa: preparar ou confirmar.', 400);
}

export async function areaVybes(req, res, quem, sql) {
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await lerEstadoVybes(sql, quem)) });
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...(await acaoVybes(sql, quem, req.body || {})) });
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    const status = e.status || (e instanceof TypeError ? 400 : 500);
    return res.status(status).json({ error: status >= 500 ? 'Não foi possível concluir agora.' : e.message });
  }
}
