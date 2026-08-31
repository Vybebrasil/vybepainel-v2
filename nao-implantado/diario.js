import { neon } from '@neondatabase/serverless';
import { quemChama } from '../vybe_acesso.js';
import {
  listarSnapshots,
  obterSnapshot,
  registrarSnapshotOperacional,
  excluirSnapshot,
} from '../vybe_observabilidade.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const enviado = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const manutencao = process.env.CUTOVER_MIGRATION_KEY && enviado && enviado === String(process.env.CUTOVER_MIGRATION_KEY).trim();
  const quem = quemChama(req) || (manutencao ? { tipo:'servico' } : null);
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar o Diário.' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const id = Number(req.query?.id || 0);
      if (id) {
        const snapshot = await obterSnapshot(sql, id);
        if (!snapshot) return res.status(404).json({ error: 'Snapshot não encontrado.' });
        return res.status(200).json({ ok: true, snapshot });
      }
      return res.status(200).json({ ok: true, snapshots: await listarSnapshots(sql, req.query?.limite) });
    }
    if (req.method === 'POST') {
      const snapshot = await registrarSnapshotOperacional(sql, quem.tipo === 'servico' ? 'servico' : 'manual_painel');
      return res.status(200).json({ ok: true, snapshot });
    }
    if (req.method === 'DELETE') {
      if (!(quem.tipo === 'servico' || quem.pessoa?.admin)) {
        return res.status(403).json({ error: 'Somente administradores podem excluir snapshots.' });
      }
      const id = Number(req.query?.id || req.body?.id || 0);
      if (!id) return res.status(400).json({ error: 'Informe o snapshot.' });
      const removido = await excluirSnapshot(sql, id);
      if (!removido) return res.status(404).json({ error: 'Snapshot não encontrado.' });
      return res.status(200).json({ ok: true, removido });
    }
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (erro) {
    return res.status(500).json({ error: erro.message || 'Falha no Diário.' });
  }
}
