export default function handler(req, res) {
  const configurada = String(process.env.MIRROR_ADMIN_KEY || '').trim();
  const recebida = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    configured: Boolean(configurada),
    received: Boolean(recebida),
    matches: Boolean(configurada && recebida && configurada === recebida),
  });
}
