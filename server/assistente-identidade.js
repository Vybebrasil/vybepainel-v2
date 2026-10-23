// Identificadores WhatsApp da integração Vybe AI.
// Não converte @lid em telefone: são identidades distintas até confirmação explícita.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function validarJid(jid) {
  if (typeof jid !== 'string') return false;
  return /^(?:[1-9][0-9]{5,19})@(?:lid|c\.us)$/.test(jid);
}

export function identificadorProtegido(jid, segredo) {
  if (!validarJid(jid)) throw new TypeError('Identificador WhatsApp inválido.');
  if (typeof segredo !== 'string' || segredo.length < 32)
    throw new TypeError('Segredo de vinculação inválido.');
  return createHmac('sha256', segredo).update('jid:v1:' + jid).digest('hex');
}

export function criarDesafioVinculacao(segredo, agora = Date.now()) {
  if (typeof segredo !== 'string' || segredo.length < 32)
    throw new TypeError('Segredo de vinculação inválido.');
  if (!Number.isFinite(agora)) throw new TypeError('Data inválida.');
  const codigo = randomBytes(10).toString('hex');
  const expiraEm = new Date(agora + 10 * 60_000).toISOString();
  return {
    codigo,
    codigoHash: createHmac('sha256', segredo).update('codigo:v1:' + codigo).digest('hex'),
    expiraEm
  };
}

export function validarDesafio({ codigo, codigoHash, expiraEm, usadoEm }, segredo, agora = Date.now()) {
  if (usadoEm || typeof codigo !== 'string' || !/^[0-9a-f]{20}$/.test(codigo)) return false;
  if (typeof codigoHash !== 'string' || !/^[0-9a-f]{64}$/.test(codigoHash)) return false;
  if (typeof segredo !== 'string' || segredo.length < 32) return false;
  const expira = Date.parse(expiraEm);
  if (!Number.isFinite(expira) || !Number.isFinite(agora) || agora >= expira) return false;
  const calculado = createHmac('sha256', segredo).update('codigo:v1:' + codigo).digest();
  return timingSafeEqual(calculado, Buffer.from(codigoHash, 'hex'));
}
