// Fluxo de vinculação: funções de banco, sem exposição HTTP.
// Origem da pessoa deve ser uma sessão pessoal autenticada.
// Consumo deve ocorrer exclusivamente após recebimento do código no privado
// do WhatsApp, por um conector de servidor autenticado e auditado.
import { criarDesafioVinculacao, identificadorProtegido } from './assistente-identidade.js';

export async function emitirCodigo(sql, pessoaId, segredo, agora = Date.now()) {
  if (!Number.isSafeInteger(pessoaId) || pessoaId <= 0) throw new TypeError('Pessoa inválida.');
  const desafio = criarDesafioVinculacao(segredo, agora);
  const linhas = await sql`
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
}

export async function consumirCodigo(sql, jid, codigo, segredo) {
  if (typeof codigo !== 'string' || !/^[0-9a-f]{20}$/.test(codigo)) return false;
  const jidHash = identificadorProtegido(jid, segredo);
  // CTE atômica: só consome código vigente e ainda não usado.
  // A unicidade do JID evita transferir um WhatsApp já associado a outra pessoa.
  // A API chamadora precisa aplicar rate limit e restringir ao privado.
  const { createHmac } = await import('node:crypto');
  const codigoHash = createHmac('sha256', segredo).update('codigo:v1:' + codigo).digest('hex');
  const linhas = await sql`
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
      ON CONFLICT (jid_hash) DO NOTHING
      RETURNING pessoa_id
    )
    SELECT pessoa_id FROM vinculo
  `;
  return linhas.length === 1;
}
