// api/sessao.js — entrar, sair e saber quem está logado.
//
//   POST   /api/sessao  { email, senha }  → cria a sessão (cookie assinado)
//   GET    /api/sessao                    → devolve quem está logado, ou 401
//   DELETE /api/sessao                    → encerra a sessão
//
// Sem CORS aberto aqui: cookie de sessão só faz sentido na própria origem, e
// deixar '*' com credenciais é justamente o que não se deve fazer.

import { autenticar, assinarSessao, sessaoDoPedido, cabecalhoDeCookie } from '../vybe_sessao.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const sessao = sessaoDoPedido(req);
      if (!sessao) return res.status(401).json({ error: 'Sem sessão.' });
      return res.status(200).json({
        ok: true,
        pessoa: { id: sessao.id, nome: sessao.nome, email: sessao.email, admin: sessao.admin },
      });
    }

    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', cabecalhoDeCookie(''));
      return res.status(200).json({ ok: true, encerrada: true });
    }

    if (req.method === 'POST') {
      const { email, senha } = req.body || {};
      if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });
      const pessoa = await autenticar(email, senha);
      res.setHeader('Set-Cookie', cabecalhoDeCookie(assinarSessao(pessoa)));
      return res.status(200).json({ ok: true, pessoa });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (erro) {
    // Erro de credencial é 401; o resto é falha nossa.
    const credencial = /incorretos|tentativas/i.test(erro.message);
    return res.status(credencial ? 401 : 500).json({ error: erro.message });
  }
}
