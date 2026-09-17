// server/notas.js — o caderno de cada pessoa.
//
// Anotação do dia a dia e recado sobre uma demanda viviam fora do painel (papel,
// bloco de notas, mensagem para si mesmo no WhatsApp). Aqui elas ficam no banco,
// ligadas à pessoa: só quem escreveu lê. Quando a nota precisa virar recado para
// a equipe, a tela manda o texto para o histórico da peça — que continua sendo o
// único lugar de recado compartilhado.
//
// A nota aponta para a peça pelo MESMO id que a tela usa ('12672877622' ou
// 'vybe:10659'), guardado como texto: sem isso, cada leitura teria que traduzir
// o id do banco para o id da tela e vice-versa.
export const NOTA_CORPO_MAX = 20000;
export const NOTA_TITULO_MAX = 200;
export const CADERNO_PADRAO = 'Notas do dia';
export const CADERNO_MAX = 60;

// A estrutura nasce pela conferência administrativa (criarSchema), nunca por uma
// leitura. Faltando a tabela, a resposta diz o que fazer em vez de estourar.
export async function notasProntas(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_notas') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}

export async function listarNotas(sql, pessoaId, { busca = '' } = {}) {
  const termo = String(busca || '').trim();
  // A busca atravessa os cadernos: quem procura uma palavra não lembra em qual
  // caderno escreveu.
  const linhas = termo
    ? await sql`SELECT id, titulo, corpo, item_ref, caderno, criado_em, atualizado_em FROM vybe_notas
         WHERE pessoa_id = ${pessoaId}
           AND (titulo ILIKE ${'%' + termo + '%'} OR corpo ILIKE ${'%' + termo + '%'})
         ORDER BY atualizado_em DESC LIMIT 200`
    : await sql`SELECT id, titulo, corpo, item_ref, caderno, criado_em, atualizado_em FROM vybe_notas
         WHERE pessoa_id = ${pessoaId} ORDER BY atualizado_em DESC LIMIT 200`;
  return linhas.map(formatar);
}

export async function listarCadernos(sql, pessoaId) {
  const linhas = await sql`SELECT caderno, COUNT(*)::int AS notas, MAX(atualizado_em) AS mexido_em
      FROM vybe_notas WHERE pessoa_id = ${pessoaId}
     GROUP BY caderno ORDER BY MAX(atualizado_em) DESC`;
  return linhas.map((c) => ({ nome: c.caderno, notas: Number(c.notas), mexido_em: new Date(c.mexido_em).toISOString() }));
}

export async function renomearCaderno(sql, pessoaId, de, para) {
  const antigo = String(de ?? '').trim();
  const novo = String(para ?? '').replace(/\s+/g, ' ').trim().slice(0, CADERNO_MAX);
  if (!antigo || !novo) throw new Error('Informe o caderno e o nome novo.');
  const linhas = await sql`UPDATE vybe_notas SET caderno = ${novo}
    WHERE pessoa_id = ${pessoaId} AND caderno = ${antigo} RETURNING id`;
  if (!linhas.length) throw new Error('Caderno não encontrado.');
  return { de: antigo, para: novo, notas: linhas.length };
}

// Apagar caderno move as notas por padrão: o caderno é etiqueta, e apagar a
// etiqueta não pode apagar o que estava escrito sem alguém pedir.
export async function apagarCaderno(sql, pessoaId, nome, { mover = CADERNO_PADRAO, apagarNotas = false } = {}) {
  const alvo = String(nome ?? '').trim();
  if (!alvo) throw new Error('Informe o caderno.');
  if (apagarNotas) {
    const linhas = await sql`DELETE FROM vybe_notas
      WHERE pessoa_id = ${pessoaId} AND caderno = ${alvo} RETURNING id`;
    if (!linhas.length) throw new Error('Caderno não encontrado.');
    return { caderno: alvo, apagadas: linhas.length };
  }
  const destino = String(mover || CADERNO_PADRAO).trim().slice(0, CADERNO_MAX) || CADERNO_PADRAO;
  if (destino === alvo) throw new Error('Escolha outro caderno para as notas.');
  const linhas = await sql`UPDATE vybe_notas SET caderno = ${destino}
    WHERE pessoa_id = ${pessoaId} AND caderno = ${alvo} RETURNING id`;
  if (!linhas.length) throw new Error('Caderno não encontrado.');
  return { caderno: alvo, movidas: linhas.length, para: destino };
}

export async function salvarNota(sql, pessoaId, { id = null, titulo = '', corpo = '', item_ref = null, caderno = CADERNO_PADRAO } = {}) {
  const t = String(titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTA_TITULO_MAX);
  const c = String(corpo ?? '').replace(/\r\n/g, '\n');
  if (c.length > NOTA_CORPO_MAX) throw new Error(`Nota muito longa (máximo ${NOTA_CORPO_MAX} caracteres).`);
  const ref = item_ref ? String(item_ref).slice(0, 60) : null;
  const cad = String(caderno || CADERNO_PADRAO).replace(/\s+/g, ' ').trim().slice(0, CADERNO_MAX) || CADERNO_PADRAO;
  if (!t && !c.trim() && !id) throw new Error('Escreva algo antes de salvar a nota.');
  if (id) {
    // O pessoa_id entra no WHERE: nota de outra pessoa não se edita nem se
    // descobre que existe.
    const [nota] = await sql`UPDATE vybe_notas
        SET titulo = ${t || null}, corpo = ${c}, item_ref = ${ref}, caderno = ${cad}, atualizado_em = NOW()
      WHERE id = ${Number(id)} AND pessoa_id = ${pessoaId}
      RETURNING id, titulo, corpo, item_ref, caderno, criado_em, atualizado_em`;
    if (!nota) throw new Error('Nota não encontrada.');
    return formatar(nota);
  }
  const [nota] = await sql`INSERT INTO vybe_notas (pessoa_id, titulo, corpo, item_ref, caderno)
    VALUES (${pessoaId}, ${t || null}, ${c}, ${ref}, ${cad})
    RETURNING id, titulo, corpo, item_ref, caderno, criado_em, atualizado_em`;
  return formatar(nota);
}

export async function apagarNota(sql, pessoaId, id) {
  const [nota] = await sql`DELETE FROM vybe_notas
    WHERE id = ${Number(id)} AND pessoa_id = ${pessoaId} RETURNING id`;
  if (!nota) throw new Error('Nota não encontrada.');
  return Number(nota.id);
}

function formatar(n) {
  return {
    id: Number(n.id), titulo: n.titulo || '', corpo: n.corpo || '', item_ref: n.item_ref || '',
    caderno: n.caderno || CADERNO_PADRAO,
    criado_em: new Date(n.criado_em).toISOString(), atualizado_em: new Date(n.atualizado_em).toISOString(),
  };
}
