import { bootstrapMirror, getMirrorDelta, getMirrorHealth, getMirrorSnapshot, reconcileMirror } from '../operational_mirror_store.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}
function isAdmin(req) {
  const secret = process.env.MIRROR_ADMIN_KEY;
  if (!secret) return false;
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/i,'') || String(req.query?.key || req.body?.key || '');
  return supplied === secret;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      const action = String(req.query?.action || 'snapshot');
      if (action === 'health') return res.status(200).json(await getMirrorHealth());
      if (action === 'delta') return res.status(200).json(await getMirrorDelta(req.query?.since || 0));
      return res.status(200).json(await getMirrorSnapshot());
    }
    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      // Reconciliação manual é pública, mas possui trava central de 60 segundos no banco.
      // Isso permite que "Atualizar Dados" fortaleça a mesma base usada por toda a equipe.
      if (action === 'reconcile') {
        const result = await reconcileMirror('manual_panel');
        return res.status(200).json({ ok: true, action, ...result });
      }
      if (!isAdmin(req)) return res.status(401).json({ error: 'Não autorizado para reconstruir o espelho.' });
      if (action === 'bootstrap') {
        const result = await bootstrapMirror();
        return res.status(200).json({ ok: true, action, ...result });
      }
      return res.status(400).json({ error: 'Ação inválida.' });
    }
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Operational mirror API failed:', error.message);
    return res.status(500).json({ error: error.message || 'Falha no espelho operacional.' });
  }
}
