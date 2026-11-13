// Fluxo do botão principal da peça (Paulo, 13/11/2026: "pode deixar o botão principal seguir o próximo status pela
// ordem, mas deixa algo pra eu poder editar essa ordem e escolher como vai funcionar essa ordem lá mesmo").
//
// A ordem em si já é a ordem do catálogo de status (vybe_status.ordem, editada em "Ordem das etiquetas"). Aqui fica só
// COMO o botão usa essa ordem, por quadro:
//   ordem      → envia para o status seguinte da lista (o padrão);
//   proprio    → cada status pode ter o próximo escolhido à mão; o que não tiver escolha segue a lista;
//   perguntar  → o botão abre o menu de status, sem sugerir.
// No modo próprio, '-' como próximo quer dizer "aqui pergunta" (o botão abre o menu).
//
// Guardado em vybe_carteira_config (chave/valor jsonb que já existe; sem migração nova), chave 'fluxo_status':
//   { boards: { "<board_id>": { modo, proximo: { "<chave do status>": "<chave do próximo>" | "-" } } } }
export const CHAVE_FLUXO_STATUS = 'fluxo_status';
export const MODOS_FLUXO = ['ordem', 'proprio', 'perguntar'];

const chaveOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 80;

export function normalizarFluxoDoQuadro(v) {
  const modo = MODOS_FLUXO.includes(v?.modo) ? v.modo : 'ordem';
  const proximo = {};
  if (v?.proximo && typeof v.proximo === 'object' && !Array.isArray(v.proximo)) {
    for (const [de, para] of Object.entries(v.proximo)) {
      if (!chaveOk(de) || !chaveOk(para) || de === para) continue;
      proximo[de] = para;
    }
  }
  return { modo, proximo };
}

export function normalizarFluxo(v) {
  const boards = {};
  const origem = v?.boards && typeof v.boards === 'object' && !Array.isArray(v.boards) ? v.boards : {};
  for (const [board, cfg] of Object.entries(origem)) {
    if (!/^\d{1,20}$/.test(board)) continue;
    boards[board] = normalizarFluxoDoQuadro(cfg);
  }
  return { boards };
}

// As chaves precisam existir no catálogo do quadro ('-' é a única exceção, do lado do próximo).
export function conferirFluxoDoQuadro(cfg, chavesConhecidas) {
  const conhecidas = new Set(chavesConhecidas);
  for (const [de, para] of Object.entries(cfg.proximo)) {
    if (!conhecidas.has(de)) return `"${de}" não está nesta lista de status.`;
    if (para !== '-' && !conhecidas.has(para)) return `"${para}" não está nesta lista de status.`;
  }
  return '';
}

export async function lerFluxoStatus(db) {
  try {
    const [linha] = await db`SELECT valor FROM vybe_carteira_config WHERE chave=${CHAVE_FLUXO_STATUS}`;
    return normalizarFluxo(linha?.valor);
  } catch {
    // Sem a tabela (banco sem as migrações do Irecity), vale o padrão: seguir a ordem da lista.
    return normalizarFluxo(null);
  }
}

export async function gravarFluxoDoQuadro(db, board, cfg, pessoaId) {
  const atual = await lerFluxoStatus(db);
  atual.boards[String(board)] = normalizarFluxoDoQuadro(cfg);
  await db`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por, atualizado_em)
    VALUES (${CHAVE_FLUXO_STATUS}, ${JSON.stringify(atual)}::jsonb, ${pessoaId || null}, now())
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`;
  return atual;
}
