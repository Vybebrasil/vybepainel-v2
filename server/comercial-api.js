import { lerComercial, escreverComercial } from './comercial.js';
// GET /api/painel?area=comercial&aba=funil|pacotes|orcamentos|financas|creators|recebimentos|contas|inadimplencia|fornecedores
//   (&mes=AAAA-MM&periodo=mensal|anual nas abas de dinheiro; &id= num orçamento). POST { acao, ... }.
// Exige sessão pessoal; papéis conferidos em server/comercial.js. Sem a migração, 503 explicando qual aplicar.
export async function areaComercial(req, res, quem, criarBanco) {
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar o Comercial.' });
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'O Comercial exige uma sessão pessoal.' });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const sql = criarBanco();
    if (req.method === 'POST') return res.status(200).json({ ok: true, ...await escreverComercial(sql, quem.pessoa, req.body || {}) });
    return res.status(200).json({ ok: true, ...await lerComercial(sql, quem.pessoa, req.query || {}) });
  } catch (e) {
    if (e.code === '42P01' || e.code === '42703')
      return res.status(503).json({ error: 'Comercial ainda não provisionado. Peça ao Paulo para aplicar as migrações 2026-11-07-crm-prospeccao.sql e 2026-11-07-comercial.sql.', migracao_pendente: true });
    if (e.code === '23514' || e.code === '22003') return res.status(400).json({ error: 'Valor fora do permitido.' });
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível acessar o Comercial. Tente novamente.' });
  }
}
