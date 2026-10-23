// Fluxo de vinculação: funções de banco, sem exposição HTTP.
// Origem da pessoa deve ser uma sessão pessoal autenticada.
// Consumo deve ocorrer exclusivamente após recebimento do código no privado
// do WhatsApp, por um conector de servidor autenticado e auditado.
import { criarDesafioVinculacao, identificadorProtegido } from './assistente-identidade.js';

async function comPessoa(sql, pessoaId, executar) {
  return sql.comTransacao(async tx => {
    await tx`SELECT id FROM vybe_pessoas WHERE id=${pessoaId} FOR UPDATE`;
    return executar(tx);
  });
}

export async function estadoVinculacao(sql, pessoaId) {
  if (!Number.isSafeInteger(pessoaId) || pessoaId <= 0) throw new TypeError('Pessoa inválida.');
  const [schema] = await sql`SELECT to_regclass('public.vybe_ai_vinculos') IS NOT NULL
    AND to_regclass('public.vybe_ai_desafios') IS NOT NULL AS pronta`;
  if (!schema?.pronta) return { disponivel: false, vinculado: false };
  const [r] = await sql`SELECT count(*)::int AS quantidade FROM vybe_ai_vinculos
    WHERE pessoa_id=${pessoaId} AND revogado_em IS NULL`;
  return { disponivel: true, vinculado: Number(r.quantidade) > 0 };
}

export async function revogarVinculacao(sql, pessoaId) {
  if (!Number.isSafeInteger(pessoaId) || pessoaId <= 0) throw new TypeError('Pessoa inválida.');
  return comPessoa(sql, pessoaId, async tx => {
    await tx`UPDATE vybe_ai_vinculos SET revogado_em=NOW() WHERE pessoa_id=${pessoaId} AND revogado_em IS NULL`;
    await tx`UPDATE vybe_ai_desafios SET usado_em=NOW() WHERE pessoa_id=${pessoaId} AND usado_em IS NULL`;
    return { vinculado: false };
  });
}

export async function emitirCodigo(sql, pessoaId, segredo, agora = Date.now()) {
  if (!Number.isSafeInteger(pessoaId) || pessoaId <= 0) throw new TypeError('Pessoa inválida.');
  const desafio = criarDesafioVinculacao(segredo, agora);
  return comPessoa(sql, pessoaId, async tx => {
    const linhas = await tx`
      INSERT INTO vybe_ai_desafios (pessoa_id, codigo_hash, expira_em)
      SELECT p.id, ${desafio.codigoHash}, ${desafio.expiraEm}::timestamptz
      FROM vybe_pessoas p
      WHERE p.id = ${pessoaId} AND p.ativo IS TRUE AND p.pode_entrar IS TRUE
        AND p.senha_hash IS NOT NULL
        AND (SELECT COUNT(*) FROM vybe_ai_desafios d
             WHERE d.pessoa_id = p.id AND d.criado_em > NOW() - INTERVAL '1 hour') < 3
      RETURNING id
    `;
    if (linhas.length !== 1) return null;
    return { codigo: desafio.codigo, expiraEm: desafio.expiraEm };
  });
}

export async function consumirCodigo(sql, jid, codigo, segredo) {
  if (typeof codigo !== 'string' || !/^[0-9a-f]{20}$/.test(codigo)) return false;
  const jidHash = identificadorProtegido(jid, segredo);
  // CTE atômica: só consome código vigente e ainda não usado.
  // A unicidade do JID evita transferir um WhatsApp já associado a outra pessoa.
  // A API chamadora precisa aplicar rate limit e restringir ao privado.
  const { createHmac } = await import('node:crypto');
  const codigoHash = createHmac('sha256', segredo).update('codigo:v1:' + codigo).digest('hex');
  return sql.comTransacao(async tx => {
    // Mesma trava da emissão e revogação: nenhuma confirmação pendente
    // pode ressuscitar o vínculo depois de uma revogação concorrente.
    const pessoas = await tx`SELECT p.id FROM vybe_pessoas p JOIN vybe_ai_desafios d ON d.pessoa_id=p.id
      WHERE d.codigo_hash=${codigoHash} FOR UPDATE OF p`;
    if (!pessoas.length) return false;
    const linhas = await tx`
      WITH consumido AS (
        UPDATE vybe_ai_desafios d SET usado_em = NOW()
        FROM vybe_pessoas p
        WHERE d.pessoa_id = p.id AND d.codigo_hash = ${codigoHash}
          AND d.usado_em IS NULL AND d.expira_em > NOW()
          AND p.ativo IS TRUE AND p.pode_entrar IS TRUE
          AND p.senha_hash IS NOT NULL
        RETURNING d.pessoa_id
      ), vinculo AS (
        INSERT INTO vybe_ai_vinculos (pessoa_id, jid_hash)
        SELECT pessoa_id, ${jidHash} FROM consumido
        ON CONFLICT (jid_hash) DO UPDATE SET revogado_em=NULL, criado_em=NOW()
        WHERE vybe_ai_vinculos.pessoa_id=EXCLUDED.pessoa_id AND vybe_ai_vinculos.revogado_em IS NOT NULL
        RETURNING pessoa_id
      )
      SELECT pessoa_id FROM vinculo
    `;
    return linhas.length === 1;
  });
}
