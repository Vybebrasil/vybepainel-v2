import { getMirrorHealth, reconcileMirror } from '../operational_mirror_store.js';
import { neon } from '@neondatabase/serverless';
import { varrerAgenda } from '../vybe_automacoes.js';
function isCronAuthorized(req) { const secret = process.env.CRON_SECRET; if (!secret) return false; const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, ''); return supplied === secret; }
export default async function handler(req, res) { res.setHeader('Cache-Control', 'no-store'); if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' }); if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Reconciliação programada não autorizada.' }); try { const result = await reconcileMirror('scheduled_integrity'); const health = await getMirrorHealth();
    // As regras por data vivem aqui porque o plano permite uma tarefa agendada
    // por dia: criar uma segunda so para elas gastaria a cota inteira.
    let agenda = null;
    try { agenda = await varrerAgenda(neon(process.env.DATABASE_URL)); }
    catch (erro) { console.error('Varredura de automacoes por data falhou:', erro.message); agenda = { erro: erro.message }; }
    return res.status(200).json({ ok: true, result, health, agenda }); } catch (error) { console.error('Scheduled mirror reconciliation failed:', error.message); return res.status(500).json({ error: error.message || 'Falha na reconciliação programada.' }); } }
