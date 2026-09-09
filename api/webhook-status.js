// Integração encerrada: nenhum evento externo pode alterar o domínio Vybe.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ error: 'Integração Monday encerrada.', autoridade: 'vybe' });
}
