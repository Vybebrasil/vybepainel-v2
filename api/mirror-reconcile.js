import { neon } from '@neondatabase/serverless';
import { varrerAgenda, recalcularPrioridades } from '../vybe_automacoes.js';
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
    let agenda = null;
    try { agenda = await varrerAgenda(sql); }
    catch (erro) { console.error('Varredura de automações por data falhou:', erro.message); agenda = { erro: erro.message }; }

    // A prioridade e o espelho da veiculacao, e espelho que so se atualiza
    // quando alguem mexe na peca nao e espelho: o dia passa sozinho. Roda depois
    // da varredura de agenda, com o mesmo relogio da Bahia.
    let prioridades = null;
    try { prioridades = await recalcularPrioridades(sql); }
    catch (erro) { console.error('Recalculo de prioridades falhou:', erro.message); prioridades = { erro: erro.message }; }

    await registrarSaude(sql, 'automacoes', agenda?.erro ? 'erro' : 'ok', agenda || {});
    await registrarSaude(sql, 'prioridades', prioridades?.erro ? 'erro' : 'ok', prioridades || {});
    const snapshot = await registrarSnapshotOperacional(sql, 'cron_integridade');

    return res.status(200).json({
      ok: true,
      agenda,
      prioridades,
      snapshot: { id: snapshot.id, data_referencia: snapshot.data_referencia, atualizado_em: snapshot.atualizado_em },
      autoridade: 'vybe',
    });
  } catch (error) {
    console.error('Scheduled integrity cycle failed:', error.message);
    return res.status(500).json({ error: error.message || 'Falha no ciclo de integridade.' });
  }
}
