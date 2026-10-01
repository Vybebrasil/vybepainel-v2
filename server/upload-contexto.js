import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function chave() {
  const segredo = process.env.SESSAO_SECRET || process.env.MIRROR_ADMIN_KEY;
  if (!segredo) throw new Error('Sessão de upload não configurada.');
  return createHash('sha256').update(`vybe-upload:${segredo}`).digest();
}
function dono(quem) { return quem?.tipo === 'sessao' ? `pessoa:${quem.pessoa.id}` : 'servico'; }
export function protegerUpload(dados, quem) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave(), iv);
  const bytes = Buffer.concat([cifra.update(JSON.stringify({ ...dados, dono: dono(quem), expira: Date.now() + 7 * 86400000 })), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), bytes]).toString('base64url');
}
export function abrirContextoUpload(contexto, quem, item) {
  try {
    if (typeof contexto !== 'string' || contexto.length > 12000) throw Error();
    const bytes = Buffer.from(contexto, 'base64url');
    const cifra = createDecipheriv('aes-256-gcm', chave(), bytes.subarray(0, 12));
    cifra.setAuthTag(bytes.subarray(12, 28));
    const dados = JSON.parse(Buffer.concat([cifra.update(bytes.subarray(28)), cifra.final()]).toString());
    if (dados.dono !== dono(quem) || dados.item !== String(item)) throw Error();
    if (dados.expira <= Date.now()) { const erro = new Error('A sessão de envio expirou.'); erro.code = 'UPLOAD_EXPIRADO'; throw erro; }
    return dados;
  } catch (erro) { if (erro.code === 'UPLOAD_EXPIRADO') throw erro; throw new Error('Sessão de envio inválida ou expirada. Use a conta que iniciou o envio.'); }
}
