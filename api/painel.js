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
import { mondayQuery } from '../operational_mirror_store.js';
import { pastaDoConteudo, enviarParaDrive } from '../vybe_drive.js';
import { listar, salvar, remover, semear, criarSchemaAutomacoes, simular, ensaio, varrerAgenda, execucoes } from '../vybe_automacoes.js';
import { quemChama } from '../vybe_acesso.js';
import { listarPessoas, definirSenha, definirAcesso, trocarPropriaSenha } from '../vybe_sessao.js';

const sql = () => neon(process.env.DATABASE_URL);

// ── automações ────────────────────────────────────────────────────────────────
async function areaAutomacoes(req, res, quem) {
  if (req.method === 'GET') {
    if (req.query?.historico === '1') {
      return res.status(200).json({ ok: true, execucoes: await execucoes({
        limite: Math.min(Number(req.query?.limite) || 60, 200),
        conteudoId: req.query?.conteudo_id ? Number(req.query.conteudo_id) : null,
      }) });
    }
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

// ── a peça aberta no drawer ───────────────────────────────────────────────────
//
// O drawer buscava anexos, comentários e histórico de status direto do Monday, a
// cada abertura. Era o último lugar do dia a dia que ainda dependia dele.
//
// A resposta sai no formato que o Monday devolvia, de propósito: o painel já
// sabe montar a tela a partir dele, e a conta de tempo em cada etapa continua
// num lugar só. Traduzir aqui é mais barato que ter duas contas divergindo.
const COLUNA_ARQUIVOS = 'file_mkwtx2j4';

async function areaPeca(req, res, quem) {
  if (req.method === 'POST') return anexarNaPeca(req, res, quem);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const item = String(req.query?.item || '');
  if (!item) return res.status(400).json({ error: 'Informe o item.' });

  const db = sql();
  // A ficha completa da peça. O drawer mostrava formato, prazo e status; o resto
  // só dava para ver abrindo o Monday — que é justamente o que estamos deixando
  // de fazer.
  const c = (await db`
    SELECT c.id, c.titulo, c.criado_em, c.etapa AS grupo, c.grupo_id,
           c.prazo, c.veiculacao,
           c.captacao_chave, c.prioridade_chave, c.off_audio_chave,
           c.tipo_conteudo_chaves, c.formato_chaves,
           s.rotulo  AS status,
           k.rotulo  AS captacao,
           (SELECT STRING_AGG(o.rotulo, ', ' ORDER BY x.ord)
              FROM UNNEST(c.formato_chaves) WITH ORDINALITY AS x(chave, ord)
              JOIN vybe_opcoes o ON o.coluna_id='lista_suspensa0__1' AND o.chave=x.chave) AS formato,
           (SELECT STRING_AGG(o.rotulo, ', ' ORDER BY x.ord)
              FROM UNNEST(c.tipo_conteudo_chaves) WITH ORDINALITY AS x(chave, ord)
              JOIN vybe_opcoes o ON o.coluna_id='lista_suspensa__1' AND o.chave=x.chave) AS tipo_conteudo,
           (SELECT o.rotulo FROM vybe_opcoes o
             WHERE o.coluna_id='color_mm164yv8' AND o.chave=c.prioridade_chave) AS prioridade,
           (SELECT o.rotulo FROM vybe_opcoes o
             WHERE o.coluna_id='color_mkynd7j8' AND o.chave=c.off_audio_chave) AS off_audio,
           (SELECT STRING_AGG(p.nome, ', ' ORDER BY r.ordem, p.nome)
              FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id=r.pessoa_id
             WHERE r.conteudo_id=c.id) AS responsaveis,
           (SELECT STRING_AGG(p.nome, ', ' ORDER BY e.ordem, p.nome)
              FROM vybe_conteudo_editores e JOIN vybe_pessoas p ON p.id=e.pessoa_id
             WHERE e.conteudo_id=c.id) AS editores,
           (SELECT STRING_AGG(cl.nome, ', ')
              FROM vybe_conteudo_clientes vc JOIN vybe_clientes cl ON cl.id=vc.cliente_id
             WHERE vc.conteudo_id=c.id) AS clientes
      FROM vybe_conteudos c
      LEFT JOIN vybe_status   s ON s.chave = c.status_chave
      LEFT JOIN vybe_captacao k ON k.chave = c.captacao_chave
     WHERE c.monday_item_id = ${item}`)[0];
  if (!c) return res.status(404).json({ error: 'Conteúdo não encontrado no banco.' });

  const [arquivos, updates, eventos, catCaptacao, catOpcoes] = await Promise.all([
    db`SELECT monday_asset_id, nome, extensao, tamanho_bytes, url_monday, url_publica,
              url_drive, drive_file_id, criado_em
         FROM vybe_conteudo_arquivos
         WHERE conteudo_id = ${c.id} AND ausente_em IS NULL
         ORDER BY criado_em DESC NULLS LAST`,
    db`SELECT monday_update_id, corpo, autor, criado_em
         FROM vybe_conteudo_updates WHERE conteudo_id = ${c.id}
        ORDER BY criado_em DESC NULLS LAST LIMIT 12`,
    db`SELECT tipo, de, para, em FROM vybe_conteudo_eventos
        WHERE conteudo_id = ${c.id} AND tipo = 'status' ORDER BY em DESC LIMIT 50`,
    // Os catálogos viajam junto: sem eles a tela não tem como oferecer as opções
    // de captação, tipo, prioridade e OFF sem uma segunda ida ao servidor.
    db`SELECT chave, rotulo, ativa FROM vybe_captacao ORDER BY monday_index`,
    db`SELECT coluna_id, chave, rotulo, ativa FROM vybe_opcoes ORDER BY coluna_id, indice`,
  ]);

  // O Monday assina as URLs dos arquivos com UMA HORA de validade. Guardar o
  // link no banco é inútil: uma hora depois o anexo aparece quebrado. Os
  // metadados são nossos; a URL é pedida na hora.
  //
  // É a última dependência real do Monday no dia a dia, e ela só sai quando os
  // arquivos saírem de lá — não é problema de código, é migração de storage.
  const frescas = new Map();
  // Arquivo já no Drive não precisa de URL renovada — o link de lá é estável.
  const ids = arquivos.filter((a) => !a.url_drive).map((a) => a.monday_asset_id).filter(Boolean);
  if (ids.length) {
    try {
      const r = await mondayQuery(
        `query($ids: [ID!]!) { assets(ids: $ids) { id url public_url url_thumbnail } }`,
        { ids: ids.map(String) }
      );
      for (const a of r?.assets || []) frescas.set(String(a.id), a);
    } catch (erro) {
      console.error('URLs de anexo não renovadas; usando as guardadas:', erro.message);
    }
  }

  const assets = arquivos.map((a) => ({
    id: a.monday_asset_id, name: a.nome,
    // O link que o Drive devolve ao enviar é a PÁGINA de visualização
    // (/file/d/.../view). Num <img> isso dá imagem quebrada — foi o que
    // aconteceu. Para exibir é preciso o endereço de conteúdo.
    url: a.drive_file_id
      ? `https://drive.google.com/thumbnail?id=${a.drive_file_id}&sz=w1920`
      : frescas.get(String(a.monday_asset_id))?.url || a.url_monday,
    // A miniatura do Monday é uma URL "protected_static": exige sessão do Monday
    // no navegador e devolve 406 sem ela. Ninguém do time está logado lá — esse
    // era o motivo de a prévia aparecer indisponível. A assinada abre para
    // qualquer um, então é ela que vai.
    url_thumbnail: a.drive_file_id
      ? `https://drive.google.com/thumbnail?id=${a.drive_file_id}&sz=w400`
      : frescas.get(String(a.monday_asset_id))?.public_url || a.url_publica || null,
    public_url: a.drive_file_id
      ? `https://drive.google.com/thumbnail?id=${a.drive_file_id}&sz=w1920`
      : frescas.get(String(a.monday_asset_id))?.public_url || a.url_publica,
    // A página de visualização continua útil para abrir e baixar no Drive.
    link_drive: a.url_drive || null,
    onde: a.url_drive ? 'drive' : 'monday',
    file_extension: a.extensao,
    file_size: a.tamanho_bytes === null ? null : Number(a.tamanho_bytes),
    created_at: a.criado_em,
  }));

  return res.status(200).json({
    ok: true,
    id: item,
    name: c.titulo,
    created_at: c.criado_em,
    catalogos: { captacao: catCaptacao, opcoes: catOpcoes },
    ficha: {
      cliente: c.clientes, grupo: c.grupo, grupo_id: c.grupo_id, status: c.status,
      captacao: c.captacao, off_audio: c.off_audio, tipo_conteudo: c.tipo_conteudo,
      formato: c.formato, prioridade: c.prioridade,
      prazo: c.prazo, veiculacao: c.veiculacao,
      responsaveis: c.responsaveis, editores: c.editores,
      captacao_chave: c.captacao_chave, prioridade_chave: c.prioridade_chave,
      off_audio_chave: c.off_audio_chave, tipo_conteudo_chaves: c.tipo_conteudo_chaves,
      formato_chaves: c.formato_chaves,
    },
    assets,
    column_values: [{
      id: COLUNA_ARQUIVOS,
      value: JSON.stringify({ files: assets.map((a) => ({ assetId: a.id })) }),
    }],
    updates: updates.map((u) => ({
      id: u.monday_update_id, body: u.corpo,
      created_at: u.criado_em, creator: { name: u.autor || '' }, assets: [],
    })),
    // O Monday carimba atividade em microssegundos e o painel divide por 10.000.
    activity_logs: eventos.map((e) => ({
      id: null, event: 'update_column_value',
      created_at: String(new Date(e.em).getTime() * 10000),
      data: JSON.stringify({ previous_value: { label: { text: e.de } }, value: { label: { text: e.para } } }),
    })),
  });
}

// Anexo novo vai para o Drive, não para o Monday. Enviar para lá seria refazer o
// acervo que acabamos de tirar de dentro dele — em duas semanas estaríamos com o
// mesmo problema, só que menor.
async function anexarNaPeca(req, res, quem) {
  const { item, nome, mime, conteudo } = req.body || {};
  if (!item || !nome || !conteudo) {
    return res.status(400).json({ error: 'Informe item, nome e conteúdo do arquivo.' });
  }
  const db = sql();
  const c = (await db`SELECT c.id, c.veiculacao, c.prazo,
      (SELECT cl.nome FROM vybe_conteudo_clientes vc JOIN vybe_clientes cl ON cl.id=vc.cliente_id
        WHERE vc.conteudo_id=c.id LIMIT 1) AS cliente
    FROM vybe_conteudos c WHERE c.monday_item_id = ${String(item)}`)[0];
  if (!c) return res.status(404).json({ error: 'Conteúdo não encontrado no banco.' });

  const pastaId = await pastaDoConteudo({ cliente: c.cliente, data: c.veiculacao || c.prazo });
  const enviado = await enviarParaDrive({ conteudo, nome: String(nome), mime, pastaId });

  const ext = String(nome).includes('.') ? `.${String(nome).split('.').pop().toLowerCase()}` : null;
  const linha = (await db`INSERT INTO vybe_conteudo_arquivos
      (conteudo_id, nome, extensao, tamanho_bytes, url_drive, drive_file_id, criado_em, migrado_em)
    VALUES (${c.id}, ${String(nome)}, ${ext}, ${enviado.bytes}, ${enviado.link}, ${enviado.id}, NOW(), NOW())
    RETURNING id`)[0];

  await db`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, para, autor_id, em)
    VALUES (${c.id}, 'anexo', ${String(nome)},
            ${quem.tipo === 'sessao' ? quem.pessoa.id : null}, NOW())`;

  return res.status(200).json({ ok: true, arquivo_id: linha.id, drive_file_id: enviado.id,
                                link: enviado.link, bytes: enviado.bytes });
}

const AREAS = { automacoes: areaAutomacoes, notificacoes: areaNotificacoes,
                conta: areaConta, pessoas: areaPessoas, peca: areaPeca };

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
