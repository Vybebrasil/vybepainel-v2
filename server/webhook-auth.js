import { timingSafeEqual } from 'node:crypto';

export function webhookAutorizado(req) {
  const segredo = String(process.env.MIRROR_WEBHOOK_SECRET || '').trim();
  const enviado = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
    || String(req.query?.key || '').trim();
  if (!segredo || !enviado) return false;
  const a = Buffer.from(segredo), b = Buffer.from(enviado);
  return a.length === b.length && timingSafeEqual(a, b);
}
