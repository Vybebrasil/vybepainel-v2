// api/sessao.js — entrar, sair e saber quem está logado.
//
//   GET    /api/sessao?rostos=1           → os rostos da porta (público)
//   GET    /api/sessao                    → devolve quem está logado, ou 401
//   POST   /api/sessao  { pessoa_id | email, senha }  → cria a sessão (cookie assinado)
//   DELETE /api/sessao                    → encerra a sessão
//
// A lista de rostos é o único trecho aberto sem sessão. Ela mostra rosto e
// primeiro nome de quem já tem senha — nunca e-mail, nunca sobrenome. Quem abrir
// a URL fica sabendo quem trabalha aqui; a senha continua sendo tudo que separa
// isso de entrar, e o bloqueio por tentativas continua valendo.
//
// Sem CORS aberto aqui: cookie de sessão só faz sentido na própria origem, e
// deixar '*' com credenciais é justamente o que não se deve fazer.

import { autenticar, autenticarPorId, listarRostos, assinarSessao, sessaoDoPedido, cabecalhoDeCookie }
  from '../vybe_sessao.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET' && req.query?.rostos) {
      return res.status(200).json({ ok: true, rostos: await listarRostos() });
    }

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
      const { email, senha, pessoa_id: pessoaId } = req.body || {};
      if (!senha || (!email && !pessoaId)) {
        return res.status(400).json({ error: 'Informe quem é você e a senha.' });
      }
      const pessoa = pessoaId ? await autenticarPorId(pessoaId, senha) : await autenticar(email, senha);
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
