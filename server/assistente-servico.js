import { createHash, timingSafeEqual } from 'node:crypto';

// Credencial EXCLUSIVA do bot. Nunca reutilizar MIRROR_ADMIN_KEY ou SESSAO_SECRET.
export function autenticarAssistente(req, tokenConfigurado) {
  if (typeof tokenConfigurado !== 'string' || tokenConfigurado.length < 48) return false;
  const header = String(req?.headers?.authorization || '');
  const match = /^Bearer ([A-Za-z0-9_-]{48,256})$/.exec(header);
  if (!match) return false;
  const esperado = createHash('sha256').update(tokenConfigurado).digest();
  const recebido = createHash('sha256').update(match[1]).digest();
  return timingSafeEqual(esperado, recebido);
}
