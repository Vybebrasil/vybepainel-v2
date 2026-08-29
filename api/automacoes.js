// api/automacoes.js — criar, editar, desativar e apagar as regras de operação.
//
// As regras vivem em tabela justamente para isto: mudar quem aprova o quê, ou
// para onde vai uma peça finalizada, deixa de exigir deploy — e deixa de estar
// escondido na configuração de um fornecedor.

import { listar, salvar, remover, semear, criarSchemaAutomacoes } from '../vybe_automacoes.js';
import { quemChama } from '../vybe_acesso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const quem = quemChama(req);
  if (!quem) return res.status(401).json({ error: 'Entre no painel para ver as automações.' });

  // Alterar regra de operação é coisa de administrador; ler, qualquer um pode.
  const ehAdmin = quem.tipo === 'servico' || quem.pessoa?.admin;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, automacoes: await listar() });
    }
    if (!ehAdmin) return res.status(403).json({ error: 'Só administrador altera automações.' });

    if (req.method === 'POST') {
      const acao = String(req.query?.acao || req.body?.acao || 'salvar');
      if (acao === 'schema') { await criarSchemaAutomacoes(); return res.status(200).json({ ok: true, acao }); }
      if (acao === 'semear') return res.status(200).json({ ok: true, acao, ...(await semear()) });
      return res.status(200).json({ ok: true, acao: 'salvar', automacao: await salvar(req.body || {}) });
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'Informe o id.' });
      return res.status(200).json({ ok: true, removida: await remover(Number(id)) });
    }
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
