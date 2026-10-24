'use strict';
const {falha} = require('./diagnostico.js');
// Homologação apenas. Não possui URL padrão de produção nem recebe SQL/pessoa_id.
class ErroVybe extends Error {
  constructor(status) { super('Consulta Vybe OS não concluída.'); this.status = status; }
}
async function lerJsonLimitado(response, limite = 131072) {
  if (!response.body) throw new Error('Resposta ausente.');
  const reader = response.body.getReader(); const partes = []; let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limite) throw new Error('Resposta excede limite.');
      partes.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}
function configurarApi(env = process.env) {
  const token = String(env.VYBE_AI_BOT_TOKEN || '').trim();
  if (!/^[A-Za-z0-9_-]{48,256}$/.test(token)) throw new Error('Credencial de homologação ausente ou inválida.');
  const url = new URL(env.VYBE_API_URL || '');
  if (!['vybepainel-v2-cdry1gf5f-vybe-hub.vercel.app','vybepainel-v2-git-feature-vybe-ai-readonly-integration-vybe-hub.vercel.app'].includes(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash ||
      !/^vybepainel-v2-[a-z0-9-]+-vybe-hub\.vercel\.app$/.test(url.hostname) || url.hostname.includes('-git-main-'))
    throw new Error('Use somente a URL explícita de Preview do Vybe OS.');
  return {base: url.origin, token};
}
async function consultaVybe({jid, consulta, codigo, contexto, ferramenta, argumentos}, {env = process.env, fetchImpl = fetch} = {}) {
  if (env.VYBE_API_HABILITADA !== '1') throw new ErroVybe(503);
  const {base, token} = configurarApi(env);
  if (!/^[1-9][0-9]{5,19}@(lid|c\.us)$/.test(jid || '')) throw new Error('Identidade inválida.');
  if (!['minhas_demandas', 'vinculacao_confirmar', 'autorizar_contexto', 'operacional'].includes(consulta)) throw new Error('Consulta inválida.');
  if (!contexto || !['grupo','privado'].includes(contexto.tipo)) throw new Error('Contexto obrigatório.');
  if (consulta === 'operacional' && (typeof ferramenta !== 'string' || !argumentos || typeof argumentos !== 'object' || Array.isArray(argumentos))) throw new Error('Ferramenta inválida.');
  if (consulta === 'vinculacao_confirmar' && !/^[a-f0-9]{20}$/.test(codigo || '')) throw new Error('Código inválido.');
  try {
    const r = await fetchImpl(base + '/api/painel?area=assistente&canal=bot', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: JSON.stringify({jid, consulta, contexto, ...(consulta === 'operacional' ? {ferramenta, argumentos} : {}), ...(consulta === 'vinculacao_confirmar' ? {codigo} : {})})
    });
    if (!r.ok) throw new ErroVybe(r.status); // Não logar corpo remoto ou headers.
    let data; try { data = await lerJsonLimitado(r); } catch { throw falha('FORMATO_API'); }
    if (data.ok !== true || (['minhas_demandas','operacional'].includes(consulta) && !Array.isArray(data.itens))) throw falha('FORMATO_API');
    return data;
  } catch (e) { if (e instanceof ErroVybe || e.categoria) throw e; throw falha(['TimeoutError','AbortError'].includes(e.name)?'API_TIMEOUT':'API_INDISPONIVEL'); }
}
module.exports = {consultaVybe, configurarApi, lerJsonLimitado, ErroVybe};
