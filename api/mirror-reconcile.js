import { getMirrorHealth, reconcileMirror, mondayQuery } from '../operational_mirror_store.js';
import { neon } from '@neondatabase/serverless';
import { varrerAgenda } from '../vybe_automacoes.js';
import { processarFilaReplica, saudeFilaReplica } from '../vybe_replica_queue.js';
import { registrarSnapshotOperacional, registrarSaude } from '../vybe_observabilidade.js';

function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  return supplied === secret;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Reconciliação programada não autorizada.' });

  const sql = neon(process.env.DATABASE_URL);
  try {
    // A fila é processada antes de conferir a réplica: o banco Vybe manda; o
    // Monday apenas recebe a cópia enquanto permanecer como contingência.
    let replica = null;
    try { replica = await processarFilaReplica(sql, mondayQuery, { limite: 50 }); }
    catch (erro) { console.error('Fila de réplica falhou:', erro.message); replica = { erro: erro.message }; }

    let result = null;
    let health = null;
    try {
      result = await reconcileMirror('scheduled_integrity');
      health = await getMirrorHealth();
    } catch (erro) {
      // A indisponibilidade da réplica não derruba automações nem a fila própria.
      console.error('Reconciliação da contingência Monday falhou:', erro.message);
      health = { erro: erro.message };
    }

    let agenda = null;
    try { agenda = await varrerAgenda(sql); }
    catch (erro) { console.error('Varredura de automações por data falhou:', erro.message); agenda = { erro: erro.message }; }

    const replicaHealth = await saudeFilaReplica(sql);
    const estadoReplica = replica?.erro || Number(replicaHealth.falhas || 0) > 0 ? 'atencao' : 'ok';
    await registrarSaude(sql, 'replica_monday', estadoReplica, { execucao: replica, fila: replicaHealth });
    await registrarSaude(sql, 'automacoes', agenda?.erro ? 'erro' : 'ok', agenda || {});
    const snapshot = await registrarSnapshotOperacional(sql, 'cron_integridade');

    return res.status(200).json({
      ok: true,
      result,
      health,
      agenda,
      replica,
      replica_health: replicaHealth,
      snapshot: { id: snapshot.id, data_referencia: snapshot.data_referencia, atualizado_em: snapshot.atualizado_em },
      autoridade: 'vybe',
    });
  } catch (error) {
    console.error('Scheduled integrity cycle failed:', error.message);
    return res.status(500).json({ error: error.message || 'Falha no ciclo de integridade.' });
  }
}
