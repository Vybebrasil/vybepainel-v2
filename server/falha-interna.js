// Erro que não foi tratado na área: a mensagem do banco (nome de tabela, coluna, restrição) fica no log do servidor e quem
// chama recebe uma genérica. Erro de regra com status 4xx (falhar(..., 400/403/404/409)) continua com a mensagem dele.
// Mora aqui (e não só em api/painel.js) para api/conteudo.js usar sem importar o painel inteiro, que importa o conteúdo.
export function falhaInterna(res, onde, erro) {
  const status = Number(erro?.status);
  if (Number.isInteger(status) && status >= 400 && status < 500) return res.status(status).json({ error: erro.message });
  console.error(`[api/painel] ${onde || 'área'}:`, erro?.stack || erro?.message || erro);
  return res.status(500).json({ error: 'Algo falhou do nosso lado. Tente de novo em instantes.' });
}

// Módulos antigos (api/conteudo.js) lançam a regra como `new Error('Escreva algo antes de salvar.')`, sem status. Erro do
// banco ou da rede vem de outra classe (NeonDbError, DatabaseError, TypeError) ou com `code`/`severity` (SQLSTATE).
export const ehErroDeRegra = (erro) => erro instanceof Error && erro.constructor === Error && erro.code == null && erro.severity == null;

// Status posto pelo próprio código (400 a 599, como o 503 de "Esta parte ainda está sendo ligada.") mantém a mensagem;
// regra sem status vira 400 com a mensagem dela; o resto segue o falhaInterna (500 genérico, detalhe no log).
export function falhaDeRegra(res, onde, erro) {
  const status = Number(erro?.status);
  if (Number.isInteger(status) && status >= 400 && status < 600) return res.status(status).json({ error: erro.message });
  if (erro?.status == null && ehErroDeRegra(erro)) return res.status(400).json({ error: erro.message });
  return falhaInterna(res, onde, erro);
}
