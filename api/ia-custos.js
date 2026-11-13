import { quemChama } from '../vybe_acesso.js';
import { ehDonoPessoa } from '../server/donos.js';
// api/ia-custos.js — extrato do que a IA ja custou.
//
// Este arquivo era api/jarvis.js e chamava Claude, GPT e Gemini a cada comando
// do assistente. O assistente saiu: gastava token por pergunta e ninguem
// operava por ele. O que sobra e o extrato — leitura do que ja foi gasto, sem
// chamar modelo nenhum, para a aba IA & Custos continuar mostrando o historico.

import { getUsageDashboard, updateUsageSettings } from '../jarvis_usage.js';

export default async function handler(req, res) {
  // IA e custos é dinheiro: só os donos (Paulo, 13/11/2026). O serviço (chave do espelho) continua lendo. Uma leitura de
  // sessão só (antes, bloqueou e depois quemChama liam duas vezes).
  let quem;
  try { quem = await quemChama(req); } catch { return res.status(503).json({ error: 'Não foi possível verificar o acesso. Tente novamente.' }); }
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar estes dados.' });
  if (quem.tipo !== 'servico' && !ehDonoPessoa(quem.pessoa)) return res.status(403).json({ error: 'IA e custos é só dos donos.' });
  try {
    if (req.method === 'GET') return res.status(200).json(await getUsageDashboard(req.query?.days));
    if (req.method === 'POST') {
      const corpo = req.body || {};
      const settings = await updateUsageSettings({
        brl_per_usd: corpo.brl_per_usd,
        monthly_budget_brl: corpo.monthly_budget_brl,
        gemini_billing: corpo.gemini_billing,
      });
      return res.status(200).json({ settings, dashboard: await getUsageDashboard(corpo.days || 30) });
    }
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (erro) {
    console.error('Extrato de IA falhou:', erro.message);
    return res.status(500).json({ error: 'Não foi possível carregar o extrato de IA.' });
  }
}
