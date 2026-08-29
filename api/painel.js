// api/painel.js — as telas que o painel ganhou depois do Monday.
//
// Roteador, e não um arquivo por assunto, por um motivo concreto: o plano da
// Vercel permite 12 funções por deploy e o projeto bateu no teto ao ganhar a
// primeira destas telas. Área do usuário, área do administrador e o que vier
// depois entram aqui sem custar mais nenhum slot.
//
//   /api/painel?area=automacoes   as regras que antes só existiam no Monday
//   /api/painel?area=notificacoes o que o sistema tem a dizer para quem entrou

import { neon } from '@neondatabase/serverless';
import { listar, salvar, remover, semear, criarSchemaAutomacoes, simular, ensaio, varrerAgenda } from '../vybe_automacoes.js';
import { quemChama } from '../vybe_acesso.js';
import { listarPessoas, definirSenha, definirAcesso, trocarPropriaSenha } from '../vybe_sessao.js';

const sql = () => neon(process.env.DATABASE_URL);

// ── automações ────────────────────────────────────────────────────────────────
async function areaAutomacoes(req, res, quem) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, automacoes: await listar() });
  }

  // Ler quais regras existem é útil para todo mundo entender por que uma peça
  // se moveu sozinha. Alterá-las é decisão de quem administra.
  const ehAdmin = quem.tipo === 'servico' || quem.pessoa?.admin;
  if (!ehAdmin) return res.status(403).json({ error: 'Só quem administra altera automações.' });

  if (req.method === 'POST') {
    const acao = String(req.query?.acao || req.body?.acao || 'salvar');
    if (acao === 'schema') { await criarSchemaAutomacoes(); return res.status(200).json({ ok: true, acao }); }
    if (acao === 'semear') {
      const refazer = req.query?.refazer === '1' || req.body?.refazer === true;
      return res.status(200).json({ ok: true, acao, ...(await semear({ refazer })) });
    }
    if (acao === 'simular') {
      const { conteudo_id: cid, evento } = req.body || {};
      return res.status(200).json({ ok: true, acao, ...(await simular(sql(), Number(cid), evento || {})) });
    }
    if (acao === 'agenda') {
      // seco=true conta quem seria avisado sem avisar ninguém. Antes da primeira
      // varredura isso importa: se houver muito item atrasado, o time recebe uma
      // enxurrada de uma vez e para de ler o sino.
      const seco = req.query?.seco === '1' || req.body?.seco === true;
      return res.status(200).json({ ok: true, acao, ...(await varrerAgenda(sql(), new Date(), { seco })) });
    }
    if (acao === 'ensaio') {
      const { evento, formato, grupo } = req.body || {};
      return res.status(200).json({ ok: true, acao, ...(await ensaio(sql(), evento || {}, { formato, grupo })) });
    }
    return res.status(200).json({ ok: true, acao: 'salvar', automacao: await salvar(req.body || {}) });
  }

  if (req.method === 'DELETE') {
    const id = Number(req.query?.id || req.body?.id);
    if (!id) return res.status(400).json({ error: 'Informe o id da automação.' });
    return res.status(200).json({ ok: true, removida: await remover(id) });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}

// ── notificações ──────────────────────────────────────────────────────────────
// Hoje nascem só no painel. O canal é um campo próprio na tabela justamente
// para o WhatsApp entrar depois sem mexer nas regras que as geram.
async function areaNotificacoes(req, res, quem) {
  if (quem.tipo !== 'sessao') {
    return res.status(403).json({ error: 'Notificação é de pessoa, não de serviço.' });
  }
  const db = sql();
  const pessoaId = quem.pessoa.id;

  if (req.method === 'GET') {
    const linhas = await db`
      SELECT n.id, n.texto, n.canal, n.conteudo_id, n.lida_em, n.criada_em,
             c.titulo AS conteudo_nome, c.monday_item_id
        FROM vybe_notificacoes n
        LEFT JOIN vybe_conteudos c ON c.id = n.conteudo_id
       WHERE n.pessoa_id = ${pessoaId}
         AND n.criada_em > NOW() - INTERVAL '30 days'
       ORDER BY n.lida_em NULLS FIRST, n.criada_em DESC
       LIMIT 100`;
    return res.status(200).json({
      ok: true,
      nao_lidas: linhas.filter((l) => !l.lida_em).length,
      notificacoes: linhas,
    });
  }

  if (req.method === 'POST') {
    // Sem id, marca todas: é o "limpar" do sino. Com id, marca uma.
    const id = Number(req.query?.id || req.body?.id) || null;
    const marcadas = id
      ? await db`UPDATE vybe_notificacoes SET lida_em = NOW()
                  WHERE id = ${id} AND pessoa_id = ${pessoaId} AND lida_em IS NULL
                  RETURNING id`
      : await db`UPDATE vybe_notificacoes SET lida_em = NOW()
                  WHERE pessoa_id = ${pessoaId} AND lida_em IS NULL
                  RETURNING id`;
    return res.status(200).json({ ok: true, marcadas: marcadas.length });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}

// ── a própria conta ───────────────────────────────────────────────────────────
async function areaConta(req, res, quem) {
  if (quem.tipo !== 'sessao') return res.status(403).json({ error: 'Conta é de pessoa, não de serviço.' });

  if (req.method === 'GET') return res.status(200).json({ ok: true, pessoa: quem.pessoa });

  if (req.method === 'POST') {
    const { senha_atual: atual, senha_nova: nova } = req.body || {};
    if (!atual || !nova) return res.status(400).json({ error: 'Informe a senha atual e a nova.' });
    try {
      await trocarPropriaSenha(quem.pessoa.email, atual, nova);
      return res.status(200).json({ ok: true, trocada: true });
    } catch (erro) {
      // Mensagem do autenticar já é genérica de propósito; não detalhar mais.
      return res.status(400).json({ error: erro.message });
    }
  }
  return res.status(405).json({ error: 'Método não permitido.' });
}

// ── equipe (administração) ────────────────────────────────────────────────────
async function areaPessoas(req, res, quem) {
  const ehAdmin = quem.tipo === 'servico' || quem.pessoa?.admin;
  if (!ehAdmin) return res.status(403).json({ error: 'Só quem administra vê e altera a equipe.' });

  if (req.method === 'GET') return res.status(200).json({ ok: true, pessoas: await listarPessoas() });

  if (req.method === 'POST') {
    const { email, acao, senha } = req.body || {};
    if (!email || !acao) return res.status(400).json({ error: 'Informe o e-mail e a ação.' });

    // Tirar de si mesmo o poder de administrar deixaria a operação sem ninguém
    // que possa devolver — e sem serviço de e-mail para recuperar.
    const proprio = quem.tipo === 'sessao' && String(quem.pessoa.email).toLowerCase() === String(email).toLowerCase();
    if (proprio && (acao === 'tirar_admin' || acao === 'bloquear')) {
      return res.status(400).json({ error: 'Peça a outro administrador — você não pode remover o próprio acesso.' });
    }

    if (acao === 'senha') {
      if (!senha) return res.status(400).json({ error: 'Informe a nova senha.' });
      return res.status(200).json({ ok: true, pessoa: await definirSenha(email, senha) });
    }
    const mapa = {
      liberar:     { pode_entrar: true },
      bloquear:    { pode_entrar: false },
      tornar_admin:{ admin: true },
      tirar_admin: { admin: false },
      destravar:   { destravar: true },
    };
    if (!mapa[acao]) return res.status(400).json({ error: `Ação desconhecida: ${acao}` });
    return res.status(200).json({ ok: true, pessoa: await definirAcesso(email, mapa[acao]) });
  }
  return res.status(405).json({ error: 'Método não permitido.' });
}

const AREAS = { automacoes: areaAutomacoes, notificacoes: areaNotificacoes,
                conta: areaConta, pessoas: areaPessoas };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const quem = quemChama(req);
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar.' });

  const area = AREAS[String(req.query?.area || '')];
  if (!area) {
    return res.status(400).json({ error: 'Informe area=' + Object.keys(AREAS).join('|') });
  }

  try {
    return await area(req, res, quem);
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
