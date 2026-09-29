import { neon, Pool } from '@neondatabase/serverless';

// Mantém HTTP nas consultas comuns. O motor precisa de uma única conexão
// durante as leituras e decisões entre escritas (Node >=22 fornece WebSocket).
export function sqlDaConexao(conexao) {
  const sql = (partes, ...valores) => sql.query(
    partes.reduce((texto, parte, i) => texto + (i ? `$${i}` : '') + parte, ''), valores);
  sql.query = async (texto, valores = []) => (await conexao.query(texto, valores)).rows;
  sql.comTransacao = executar => executar(sql); // já está na transação do motor
  return sql;
}

export function bancoComTransacoes(url) {
  if (!url) throw new Error('DATABASE_URL não configurada.');
  const sql = neon(url);
  sql.comTransacao = executar => executarTransacaoDeAutomacao(
    new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000 }), executar);
  return sql;
}

export async function executarTransacaoDeAutomacao(pool, executar) {
  let conexao;
  try {
    conexao = await pool.connect();
    await conexao.query('BEGIN');
    await conexao.query("SET LOCAL lock_timeout = '10s'");
    await conexao.query("SET LOCAL statement_timeout = '30s'");
    const resultado = await executar(sqlDaConexao(conexao));
    await conexao.query('COMMIT');
    return resultado;
  } catch (erro) {
    if (conexao) { try { await conexao.query('ROLLBACK'); } catch {} }
    throw erro;
  } finally {
    if (conexao) conexao.release();
    await pool.end();
  }
}
