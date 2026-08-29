import { markEventProcessed, mirrorItemFromEvent, registerEvent } from '../operational_mirror_store.js';
import { neon } from '@neondatabase/serverless';
import { aplicarDeEvento } from '../vybe_automacoes.js';
function cors(res) { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Cache-Control', 'no-store'); }
function isAuthorized(req) { const secret = process.env.MIRROR_WEBHOOK_SECRET; if (!secret) return false; const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, ''); const key = String(req.query?.key || ''); return bearer === secret || key === secret; }
export default async function handler(req, res) { cors(res); if (req.method === 'OPTIONS') return res.status(200).end(); if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' }); const body = req.body || {}; if (body.challenge) { return res.status(200).json({ challenge: body.challenge }); } if (!isAuthorized(req)) return res.status(401).json({ error: 'Evento não autorizado.' }); const event = body.event || body; try { const registration = await registerEvent(event); if (!registration.accepted) return res.status(200).json({ ok: true, duplicate: true, trigger_uuid: registration.trigger_uuid }); try { const mirrored = await mirrorItemFromEvent(event); await markEventProcessed(registration.trigger_uuid);
    // Mudanca feita direto no Monday tambem precisa acionar as nossas regras.
    // Falha aqui nao pode perder o evento do espelho, que e a razao deste
    // endpoint existir.
    try { await aplicarDeEvento(neon(process.env.DATABASE_URL), event); }
    catch (erro) { console.error('Automacoes do webhook falharam:', erro.message); }
    return res.status(200).json({ ok: true, duplicate: false, trigger_uuid: registration.trigger_uuid, mirrored }); } catch (processingError) { await markEventProcessed(registration.trigger_uuid, processingError.message || 'Falha ao espelhar item'); throw processingError; } } catch (error) { console.error('Monday event processing failed:', error.message); return res.status(500).json({ error: error.message || 'Falha ao processar evento.' }); } }
