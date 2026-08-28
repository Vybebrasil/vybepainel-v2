// api/conteudos.js — a lista de conteúdos vinda das tabelas de domínio.
//
// Alternativa ao /api/operational-mirror, que hoje devolve 3,35 MB: a resposta do
// Monday inteira, com os column_values crus e os updates de cada item, para o
// navegador transformar em objetos depois. Aqui o recorte e a transformação já
// vêm prontos do banco.
//
// A regra de recorte é a mesma que o processItems aplica hoje no navegador —
// precisa de pelo menos um cliente ativo e de pelo menos uma das duas datas. A
// diferença é onde ela mora: em vybe_clientes.ativo em vez de uma constante no
// vybe-config.js.
//
// Exige sessão do painel ou a chave de serviço. Era leitura pública, como o
// /api/operational-mirror ainda era — a operação inteira saía por uma URL.

import { listarConteudos } from '../vybe_dominio_store.js';
import { bloqueou } from '../vybe_acesso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (bloqueou(req, res)) return;

  try {
    const inicio = Date.now();
    const { board_id, status, pessoas, itens } = await listarConteudos();
    return res.status(200).json({
      ok: true,
      board_id,
      total: itens.length,
      gerado_em: new Date().toISOString(),
      ms: Date.now() - inicio,
      status,
      pessoas,
      itens,
    });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
