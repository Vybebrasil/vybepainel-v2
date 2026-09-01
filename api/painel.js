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
import { pastaDoConteudo, enviarParaDrive, tornarPublico, arquivarNoDrive, iniciarUploadNoDrive, enviarParteNoDrive } from '../vybe_drive.js';
import { listar, salvar, remover, semear, criarSchemaAutomacoes, simular, ensaio, varrerAgenda, execucoes } from '../vybe_automacoes.js';
import { quemChama } from '../vybe_acesso.js';
import { listarPessoas, definirSenha, definirAcesso, trocarPropriaSenha } from '../vybe_sessao.js';
import { listarSnapshots, obterSnapshot, registrarSnapshotOperacional, excluirSnapshot } from '../vybe_observabilidade.js';

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
    // Os catalogos vao junto porque o construtor de regras precisa oferecer
    // ESCOLHAS, nao pedir que alguem digite a chave certa de cor. E vao daqui,
    // e nao de outra tela, para a de Automacoes funcionar sozinha mesmo sendo a
    // primeira aberta na sessao.
    return res.status(200).json({ ok: true, automacoes: await listar(),
      catalogos: await catalogosDeAutomacao() });
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

// As listas que o construtor de regras oferece. Cada uma devolve a CHAVE que a
// regra guarda e o ROTULO que a pessoa le — os dois lados do mesmo item, que
// antes so existiam na cabeca de quem escrevia o JSON na mao.
async function catalogosDeAutomacao() {
  const db = sql();
  // allSettled e nao all: um catalogo que falhe nao pode derrubar a lista de
  // regras junto. O construtor perde uma lista de escolhas, a tela continua de pe.
  const [status, captacao, grupos, pessoas, formatos] = (await Promise.allSettled([
    // vybe_status nao tem coluna 'ativa' — so 'final'. Pedi-la fazia a consulta
    // inteira falhar e o construtor abria com "nada cadastrado" no lugar dos
    // status, que e o campo mais importante dele.
    db`SELECT chave, rotulo, cor FROM vybe_status
        WHERE board_id=7829537690 ORDER BY ordem, monday_index`,
    db`SELECT chave, rotulo, cor FROM vybe_captacao ORDER BY monday_index`,
    // Um mesmo nome de etapa aparece com varios grupo_id (o quadro foi refeito
    // mais de uma vez). DISTINCT no par devolvia "Finalizados" tres vezes; o
    // que a pessoa escolhe e o nome, entao a lista e por nome, e fica com o
    // grupo_id mais usado — que e o que o quadro esta mesmo usando hoje.
    db`SELECT chave, rotulo FROM (
         SELECT grupo_id AS chave, etapa AS rotulo, COUNT(*) AS n,
                ROW_NUMBER() OVER (PARTITION BY etapa ORDER BY COUNT(*) DESC) AS posto
           FROM vybe_conteudos
          WHERE grupo_id IS NOT NULL AND etapa IS NOT NULL AND removido_em IS NULL
          GROUP BY etapa, grupo_id
       ) t WHERE posto = 1 ORDER BY rotulo`,
    db`SELECT monday_user_id AS chave, nome AS rotulo, foto_url AS foto FROM vybe_pessoas
        WHERE monday_user_id IS NOT NULL ORDER BY nome`,
    db`SELECT chave, rotulo FROM vybe_opcoes
        WHERE coluna_id='lista_suspensa0__1' ORDER BY rotulo`,
  ])).map((r) => (r.status === 'fulfilled' ? r.value : []));
  return { status, captacao, grupos, pessoas, formatos };
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

  if (req.method === 'GET') {
    // A sessão carrega id, nome, e-mail e papel; a foto vive no banco e muda sem
    // que o cookie mude.
    const foto = (await sql()`SELECT foto_url FROM vybe_pessoas WHERE id=${quem.pessoa.id}`)[0];
    return res.status(200).json({ ok: true, pessoa: { ...quem.pessoa, foto_url: foto?.foto_url || null } });
  }

  if (req.method === 'POST' && req.body?.foto) {
    // A foto vai para o Drive, como qualquer arquivo nosso. Guardar imagem no
    // banco encheria a linha da pessoa de binário sem motivo.
    const { foto, nome } = req.body;
    const pastaId = await pastaDoConteudo({ cliente: 'Vybe', data: null });
    const enviado = await enviarParaDrive({
      conteudo: foto, nome: `foto-${quem.pessoa.id}-${String(nome || 'perfil')}`.slice(0, 80),
      mime: null, pastaId,
    });
    await tornarPublico(enviado.id);
    const url = `https://drive.google.com/thumbnail?id=${enviado.id}&sz=w200`;
    await sql()`UPDATE vybe_pessoas SET foto_url=${url} WHERE id=${quem.pessoa.id}`;
    return res.status(200).json({ ok: true, foto_url: url });
  }

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

// A coluna que marca "esta previa ja foi liberada". Nasce sozinha, no padrao das
// automacoes, porque a LEITURA da ficha depende dela: se ela nao existisse, a
// consulta dos arquivos falharia e o drawer inteiro parava — um preco alto
// demais por uma coluna de controle.
let previaProntaNoSchema = false;
async function garantirColunaDePrevia(db) {
  if (previaProntaNoSchema) return;
  await db`ALTER TABLE vybe_conteudo_arquivos ADD COLUMN IF NOT EXISTS previa_liberada_em TIMESTAMPTZ`;
  previaProntaNoSchema = true;
}

async function areaPeca(req, res, quem) {
  if (req.method === 'POST' && String(req.query?.acao || '') === 'liberar-previas') {
    return liberarPreviasAntigas(req, res, quem);
  }
  if (req.method === 'POST') return anexarNaPeca(req, res, quem);
  if (req.method === 'DELETE') return removerArquivoDaPeca(req, res, quem);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const item = String(req.query?.item || '');
  if (!item) return res.status(400).json({ error: 'Informe o item.' });
  const itemLocalId = item.startsWith('vybe:') ? Number(item.slice(5)) : null;

  const db = sql();
  await garantirColunaDePrevia(db);
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
     WHERE (c.monday_item_id = ${item} OR c.id = ${itemLocalId}) AND c.removido_em IS NULL`)[0];
  if (!c) return res.status(404).json({ error: 'Conteúdo não encontrado no banco.' });

  const [arquivos, updates, eventos, catCaptacao, catOpcoes] = await Promise.all([
    db`SELECT id, monday_asset_id, nome, extensao, tamanho_bytes, url_monday, url_publica,
              url_drive, drive_file_id, criado_em, previa_liberada_em
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
  // Arquivo que subiu antes de a permissao existir nao abre por link, e a previa
  // vem 403. Em vez de exigir que alguem lembre de rodar um conserto, a propria
  // abertura da peca libera os dela — poucos por vez, uma vez so na vida do
  // arquivo. Falhar aqui nao pode travar a ficha: no pior caso a previa continua
  // indisponivel e a proxima abertura tenta de novo.
  const semPrevia = arquivos.filter((a) => a.drive_file_id && !a.previa_liberada_em).slice(0, 8);
  for (const a of semPrevia) {
    try {
      await tornarPublico(String(a.drive_file_id));
      await db`UPDATE vybe_conteudo_arquivos SET previa_liberada_em=NOW() WHERE id=${a.id}`;
    } catch (erro) { console.warn('Previa nao liberada agora:', a.nome, erro.message); }
  }

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
    // Arquivo que nasceu no Drive não tem id do Monday; usa o do Drive para a
    // tela ter uma identidade estável para ele.
    id: a.drive_file_id || a.monday_asset_id || String(a.id), local_id: Number(a.id), name: a.nome,
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
    removable: Boolean(a.drive_file_id),
    file_extension: a.extensao,
    file_size: a.tamanho_bytes === null ? null : Number(a.tamanho_bytes),
    created_at: a.criado_em,
  }));

  // Subitens são a lista de tarefas dentro de uma solicitação. Só existem no
  // board de Demandas; em Produção a consulta volta vazia e a tela não mostra
  // seção nenhuma.
  const subitens = (await db`
    SELECT s.id, s.monday_item_id, s.titulo, s.prazo, s.conclusao, s.tipo, s.prioridade, s.ordem,
           st.rotulo AS status, st.cor AS status_cor, st.borda AS status_borda,
           (SELECT STRING_AGG(p.nome, ', ' ORDER BY r.ordem, p.nome)
              FROM vybe_subitem_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id
             WHERE r.subitem_id = s.id) AS responsaveis
      FROM vybe_subitens s
      LEFT JOIN vybe_status st ON st.chave = s.status_chave AND st.board_id = 8385559107
     WHERE s.pai_id = ${c.id}
     ORDER BY s.ordem, s.id`).map((r) => ({
    // 'ref' é o que a tela usa para escrever. Tarefa criada aqui com o Monday
    // fora do ar não tem id de lá — e ainda assim precisa ser editável.
    id: String(r.id), monday_item_id: r.monday_item_id || null,
    ref: String(r.monday_item_id || `vybe-subitem:${r.id}`),
    titulo: r.titulo, status: r.status || null,
    status_cor: r.status_cor || null, status_borda: r.status_borda || null,
    prazo: r.prazo, conclusao: r.conclusao, tipo: r.tipo, prioridade: r.prioridade,
    responsaveis: r.responsaveis || null,
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
    subitens,
    assets,
    // Só o que realmente está na coluna de arquivos do Monday: é dela que a tela
    // decide se pode remover pelo painel, e oferecer isso para arquivo do Drive
    // mostraria um botão que falha.
    column_values: [{
      id: COLUNA_ARQUIVOS,
      value: JSON.stringify({
        files: arquivos.filter((a) => a.monday_asset_id).map((a) => ({ assetId: a.monday_asset_id })),
      }),
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
async function removerArquivoDaPeca(req, res, quem) {
  const { item, arquivo_id: arquivoId } = req.body || {};
  if (!item || !arquivoId) return res.status(400).json({ error: 'Informe item e arquivo.' });
  const db = sql();
  const itemLocalId = String(item).startsWith('vybe:') ? Number(String(item).slice(5)) : null;
  const linha = (await db`SELECT a.id, a.nome, a.drive_file_id, a.conteudo_id
      FROM vybe_conteudo_arquivos a JOIN vybe_conteudos c ON c.id=a.conteudo_id
      WHERE a.id=${Number(arquivoId)}
        AND (c.monday_item_id=${String(item)} OR c.id=${itemLocalId})
        AND a.ausente_em IS NULL`)[0];
  if (!linha) return res.status(404).json({ error: 'Arquivo não encontrado nesta demanda.' });
  if (!linha.drive_file_id) return res.status(409).json({ error: 'Migração deste arquivo ainda não concluída.' });
  await arquivarNoDrive(linha.drive_file_id);
  await db`UPDATE vybe_conteudo_arquivos SET ausente_em=NOW() WHERE id=${linha.id}`;
  await db`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, autor_id, texto, em)
    VALUES (${linha.conteudo_id}, 'anexo_removido', ${linha.nome},
            ${quem.tipo === 'sessao' ? quem.pessoa.id : null}, 'Arquivo movido para a lixeira do Drive', NOW())`;
  return res.status(200).json({ ok: true, arquivo_id: linha.id, removido: linha.nome, reversivel: true });
}

// A peca no banco, com o que a pasta do Drive precisa saber. Os dois caminhos de
// envio — o pequeno e o grande — perguntam a mesma coisa; perguntar de dois
// jeitos daria duas respostas no dia em que um deles mudasse.
async function pecaDoBanco(item) {
  const db = sql();
  const itemLocalId = String(item).startsWith('vybe:') ? Number(String(item).slice(5)) : null;
  return (await db`SELECT c.id, c.veiculacao, c.prazo,
      (SELECT cl.nome FROM vybe_conteudo_clientes vc JOIN vybe_clientes cl ON cl.id=vc.cliente_id
        WHERE vc.conteudo_id=c.id LIMIT 1) AS cliente
    FROM vybe_conteudos c
    WHERE (c.monday_item_id = ${String(item)} OR c.id = ${itemLocalId})`)[0];
}

// Guardar a linha do arquivo e o evento no historico. Igual para quem subiu por
// aqui e para quem subiu direto no Drive.
// Conserto dos arquivos que subiram antes da permissao existir. Eles estao
// inteiros no Drive — so nao abrem por link, e por isso a previa vinha 403.
//
// Vai em lotes porque a funcao tem tempo limitado e cada arquivo e uma ida ao
// Google. Devolve quantos faltam para quem chamou repetir ate zerar. Liberar
// duas vezes o mesmo arquivo nao faz mal: o Google trata como a mesma permissao.
async function liberarPreviasAntigas(req, res, quem) {
  const ehAdmin = quem.tipo === 'servico' || quem.pessoa?.admin;
  if (!ehAdmin) return res.status(403).json({ error: 'Só quem administra libera as prévias.' });
  const db = sql();
  await garantirColunaDePrevia(db);
  const limite = Math.min(Number(req.query?.limite || req.body?.limite) || 40, 100);
  const pendentes = await db`SELECT id, drive_file_id, nome FROM vybe_conteudo_arquivos
    WHERE drive_file_id IS NOT NULL AND previa_liberada_em IS NULL
    ORDER BY id DESC LIMIT ${limite}`;
  const feitos = []; const falhos = [];
  for (const a of pendentes) {
    try {
      await tornarPublico(String(a.drive_file_id));
      await db`UPDATE vybe_conteudo_arquivos SET previa_liberada_em=NOW() WHERE id=${a.id}`;
      feitos.push(a.nome);
    } catch (erro) { falhos.push({ nome: a.nome, erro: erro.message }); }
  }
  const [{ n }] = await db`SELECT COUNT(*)::int AS n FROM vybe_conteudo_arquivos
    WHERE drive_file_id IS NOT NULL AND previa_liberada_em IS NULL`;
  return res.status(200).json({ ok: true, liberados: feitos.length, falharam: falhos, faltam: n });
}

async function registrarArquivoDaPeca(c, quem, { nome, driveId, bytes, link }) {
  const db = sql();
  // A previa da peca e servida como drive.google.com/thumbnail?id=... — e esse
  // endereco so responde para arquivo com leitura liberada por link. Sem esta
  // linha o arquivo subia certo, aparecia com nome e tamanho, e a imagem vinha
  // 403: "Previa indisponivel" numa peca que estava inteira no Drive.
  //
  // Vale para os dois caminhos de envio porque os dois terminam aqui. E falhar
  // na permissao nao pode perder o arquivo: ele ja esta no Drive e o registro
  // vale; a previa e que fica para depois.
  await garantirColunaDePrevia(db);
  let liberada = false;
  try { await tornarPublico(String(driveId)); liberada = true; }
  catch (erro) { console.warn('Arquivo salvo, mas a previa nao ficou publica:', driveId, erro.message); }
  const ext = String(nome).includes('.') ? `.${String(nome).split('.').pop().toLowerCase()}` : null;
  const linha = (await db`INSERT INTO vybe_conteudo_arquivos
      (conteudo_id, nome, extensao, tamanho_bytes, url_drive, drive_file_id, criado_em, migrado_em)
    VALUES (${c.id}, ${String(nome)}, ${ext}, ${Number(bytes) || null},
            ${link || `https://drive.google.com/file/d/${driveId}/view`}, ${String(driveId)}, NOW(), NOW())
    RETURNING id`)[0];
  if (liberada) await db`UPDATE vybe_conteudo_arquivos SET previa_liberada_em=NOW() WHERE id=${linha.id}`;
  await db`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, para, autor_id, em)
    VALUES (${c.id}, 'anexo', ${String(nome)},
            ${quem.tipo === 'sessao' ? quem.pessoa.id : null}, NOW())`;
  return { arquivo_id: linha.id, drive_file_id: String(driveId), bytes: Number(bytes) || null };
}

async function anexarNaPeca(req, res, quem) {
  const { item, nome, mime, conteudo, etapa, drive_file_id: driveId, bytes } = req.body || {};
  if (!item || !nome) return res.status(400).json({ error: 'Informe item e nome do arquivo.' });
  // Arquivo grande nao passa por aqui: a funcao aceita cerca de 4,5 MB por
  // chamada e o base64 engorda o arquivo em um terco. Nessas, o servidor so abre
  // a sessao e registra depois; os bytes vao do navegador direto para o Drive.
  // Um pedaco de arquivo grande. Nao toca no banco: so repassa ao Drive e diz
  // quanto ja entrou. O registro vem depois, na etapa 'registrar'.
  if (etapa === 'parte') {
    const { sessao, inicio, total } = req.body || {};
    if (!sessao || !conteudo || typeof inicio !== 'number' || !total) {
      return res.status(400).json({ error: 'Informe sessão, conteúdo, início e total.' });
    }
    return res.status(200).json({ ok: true,
      ...(await enviarParteNoDrive({ sessao, conteudo, inicio: Number(inicio), total: Number(total) })) });
  }
  if (etapa === 'abrir' || etapa === 'registrar') {
    const conteudoDaPeca = await pecaDoBanco(item);
    if (!conteudoDaPeca) return res.status(404).json({ error: 'Conteúdo não encontrado no banco.' });
    if (etapa === 'abrir') {
      const pastaId = await pastaDoConteudo({ cliente: conteudoDaPeca.cliente,
        data: conteudoDaPeca.veiculacao || conteudoDaPeca.prazo });
      const sessao = await iniciarUploadNoDrive({ nome: String(nome), mime, pastaId });
      return res.status(200).json({ ok: true, sessao });
    }
    if (!driveId) return res.status(400).json({ error: 'Informe o arquivo criado no Drive.' });
    return res.status(200).json({ ok: true,
      ...(await registrarArquivoDaPeca(conteudoDaPeca, quem, { nome, driveId, bytes })) });
  }
  if (!conteudo) return res.status(400).json({ error: 'Informe o conteúdo do arquivo.' });
  const c = await pecaDoBanco(item);
  if (!c) return res.status(404).json({ error: 'Conteúdo não encontrado no banco.' });

  const pastaId = await pastaDoConteudo({ cliente: c.cliente, data: c.veiculacao || c.prazo });
  const enviado = await enviarParaDrive({ conteudo, nome: String(nome), mime, pastaId });
  const registro = await registrarArquivoDaPeca(c, quem, {
    nome, driveId: enviado.id, bytes: enviado.bytes, link: enviado.link,
  });
  return res.status(200).json({ ok: true, ...registro, link: enviado.link });
}

// ── clientes ──────────────────────────────────────────────────────────────────
//
// Sem isto, criar conteúdo para um cliente novo exigia cadastrá-lo antes no
// Monday — e com o time fora de lá, viraria um pedido para o Paulo toda vez.
//
// Cliente não se apaga: desativa. A lista de conteúdos filtra por ativo, e apagar
// arrastaria junto o vínculo de todo conteúdo histórico dele.
// As reunioes do cliente: a data da ultima e as atas.
//
// Gerir cliente e, em boa parte, lembrar do que foi combinado na ultima conversa
// — e isso morava na cabeca de quem participou, ou num documento solto que
// ninguem achava. Aqui fica ao lado do cliente, com data e autor.
//
// Idempotente e chamada a cada uso, no mesmo padrao das automacoes: assim a
// tabela nasce sozinha sem depender de alguem rodar migracao.
let reunioesProntas = false;
async function garantirSchemaDeReunioes(db) {
  if (reunioesProntas) return;
  await db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS ultima_reuniao DATE`;
  await db`CREATE TABLE IF NOT EXISTS vybe_cliente_reunioes (
    id         BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    data       DATE NOT NULL,
    resumo     TEXT NOT NULL,
    autor      TEXT,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS vybe_cliente_reunioes_cliente
    ON vybe_cliente_reunioes (cliente_id, data DESC)`;
  // Nome que a operacao criou sozinha e nao e cliente — "Freela", "CMO",
  // "feijao panela de ouro". Sem um jeito de dizer isso, eles ficam para sempre
  // na lista do que falta cadastrar, e uma lista que nunca zera deixa de ser
  // lida.
  await db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nao_e_cliente BOOLEAN NOT NULL DEFAULT FALSE`;
  // NPS: a nota de 0 a 10 que o cliente deu, e quando deu. A data importa tanto
  // quanto a nota — 9 de um ano atras nao diz nada sobre hoje.
  await db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nps SMALLINT`;
  await db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS nps_em DATE`;
  // Quando um cliente saiu, quando voltou, e por que. Isso nao existia: o
  // cadastro guardava o estado de hoje e apagava a historia — e conversa de
  // renovacao vive dessa historia.
  await db`CREATE TABLE IF NOT EXISTS vybe_cliente_eventos (
    id         BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    tipo       TEXT NOT NULL,
    de         TEXT,
    para       TEXT,
    motivo     TEXT,
    autor      TEXT,
    em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS vybe_cliente_eventos_cliente
    ON vybe_cliente_eventos (cliente_id, em DESC)`;
  reunioesProntas = true;
}

async function areaClientes(req, res, quem) {
  const ehAdmin = quem.tipo === 'servico' || quem.pessoa?.admin;
  const db = sql();
  await garantirSchemaDeReunioes(db);

  if (req.method === 'GET') {
    const [linhas, acessos] = await Promise.all([
      db`SELECT c.id, c.nome, c.ativo, c.email, c.telefone, c.endereco, c.cnpj,
             c.plano, c.segmento, c.responsavel, c.status, c.planejamento_url,
             c.dashboard, c.valor, c.proxima_reuniao, c.ultima_reuniao, c.criado_no_monday,
             c.nao_e_cliente, c.nps, c.nps_em,
             (SELECT COUNT(*)::int FROM vybe_cliente_reunioes r WHERE r.cliente_id = c.id) AS atas,
             (SELECT COUNT(*)::int FROM vybe_conteudo_clientes v WHERE v.cliente_id = c.id) AS conteudos,
             (SELECT STRING_AGG(p.nome, ', ' ORDER BY cp.ordem, p.nome)
                FROM vybe_cliente_pessoas cp JOIN vybe_pessoas p ON p.id = cp.pessoa_id
               WHERE cp.cliente_id = c.id) AS heads,
             -- Sem os ids, a tela sabe QUEM e head mas nao consegue trocar: o
             -- nome sozinho nao volta para o banco.
             (SELECT ARRAY_AGG(cp.pessoa_id ORDER BY cp.ordem)
                FROM vybe_cliente_pessoas cp WHERE cp.cliente_id = c.id) AS heads_ids
        FROM vybe_clientes c ORDER BY c.ativo DESC, c.nome`,
      db`SELECT a.id, a.nome, a.cliente_id, c.nome AS cliente, a.grupo,
                a.pasta_drive AS drive, a.link, a.manus,
                CASE WHEN a.doc_id IS NOT NULL OR a.doc_conteudo IS NOT NULL THEN TRUE ELSE FALSE END AS documento,
                a.atualizado_em
           FROM vybe_acessos a LEFT JOIN vybe_clientes c ON c.id=a.cliente_id
          ORDER BY COALESCE(c.nome,a.nome)`,
    ]);
    // Quem pode ser head. Vai junto para o seletor nao precisar de outra volta ao
    // servidor — e porque a tela de clientes nao lista a equipe sozinha.
    const pessoas = await db`SELECT id, nome, monday_user_id FROM vybe_pessoas
      WHERE ativo ORDER BY nome`;
    return res.status(200).json({ ok: true, fonte: 'vybe', clientes: linhas, acessos, pessoas });
  }
  // LER a ata e de todo mundo; escrever e apagar sao de quem administra.
  //
  // O painel e aberto por escolha — o time todo ve o que o time todo faz —, e
  // uma ata que so o administrador le nao serve para o proposito dela, que e o
  // resto das pessoas saberem o que foi combinado. Por isso esta leitura passa
  // antes da tranca; o restante das acoes continua atras dela.
  if (req.method === 'POST' && req.body?.acao === 'atas') {
    const idCliente = Number(req.body?.id || 0);
    if (!idCliente) return res.status(400).json({ error: 'Informe o cliente.' });
    const [atas, eventos] = await Promise.all([
      db`SELECT id, data, resumo, autor, criado_em
           FROM vybe_cliente_reunioes WHERE cliente_id=${idCliente}
          ORDER BY data DESC, id DESC LIMIT 200`,
      // A historia de entrada e saida vem junto: quem abre as reunioes de um
      // cliente esta reconstruindo a relacao com ele, e "saiu em marco, voltou
      // em julho" faz parte dessa reconstrucao.
      db`SELECT tipo, de, para, motivo, autor, em
           FROM vybe_cliente_eventos WHERE cliente_id=${idCliente}
          ORDER BY em DESC LIMIT 50`,
    ]);
    return res.status(200).json({ ok: true, atas, eventos });
  }
  if (!ehAdmin) return res.status(403).json({ error: 'Só quem administra altera clientes.' });

  if (req.method === 'POST') {
    const { acao = 'criar', id, nome } = req.body || {};
    if (acao === 'criar') {
      const limpo = String(nome || '').trim();
      if (!limpo) return res.status(400).json({ error: 'Informe o nome do cliente.' });
      const existe = await db`SELECT id, nome, ativo FROM vybe_clientes WHERE LOWER(nome)=LOWER(${limpo})`;
      if (existe.length) {
        // Reativa em vez de recusar: cliente que voltou é o caso comum, e criar
        // um segundo com o mesmo nome partiria o histórico em dois.
        const r = await db`UPDATE vybe_clientes SET ativo=TRUE, status='Ativo'
          WHERE id=${existe[0].id} RETURNING id, nome, ativo`;
        return res.status(200).json({ ok: true, reativado: true, cliente: r[0] });
      }
      // O status preenchido e o que separa um cadastro de verdade de uma linha
      // que a importacao criou sozinha so porque o nome apareceu num conteudo.
      const r = await db`INSERT INTO vybe_clientes (nome, status) VALUES (${limpo}, 'Ativo')
        RETURNING id, nome, ativo`;
      return res.status(200).json({ ok: true, cliente: r[0] });
    }
    if (acao === 'ficha') {
      // Cadastro veio do Monday; a partir daqui ele se corrige aqui.
      const { campos } = req.body || {};
      if (!id || !campos) return res.status(400).json({ error: 'Informe o cliente e os campos.' });
      const r = await db`UPDATE vybe_clientes SET
          email=COALESCE(${campos.email ?? null}, email),
          telefone=COALESCE(${campos.telefone ?? null}, telefone),
          endereco=COALESCE(${campos.endereco ?? null}, endereco),
          cnpj=COALESCE(${campos.cnpj ?? null}, cnpj),
          plano=COALESCE(${campos.plano ?? null}, plano),
          segmento=COALESCE(${campos.segmento ?? null}, segmento),
          responsavel=COALESCE(${campos.responsavel ?? null}, responsavel),
          planejamento_url=COALESCE(${campos.planejamento_url ?? null}, planejamento_url),
          valor=COALESCE(${campos.valor ?? null}::numeric, valor),
          proxima_reuniao=COALESCE(${campos.proxima_reuniao ?? null}::date, proxima_reuniao),
          ultima_reuniao=COALESCE(${campos.ultima_reuniao ?? null}::date, ultima_reuniao),
          -- Nota nova carimba a data sozinha: anotar o NPS e depois lembrar de
          -- registrar quando foi seriam dois passos para um fato so.
          nps=COALESCE(${campos.nps ?? null}::smallint, nps),
          nps_em=CASE WHEN ${campos.nps ?? null}::smallint IS NULL THEN nps_em ELSE CURRENT_DATE END,
          -- O estado do painel do cliente e um campo do cadastro como os outros;
          -- faltava so poder edita-lo daqui, em vez de voltar ao Monday para isso.
          dashboard=COALESCE(${campos.dashboard ?? null}, dashboard)
        WHERE id=${Number(id)} RETURNING id, nome`;
      if (!r.length) return res.status(404).json({ error: 'Cliente não encontrado.' });
      return res.status(200).json({ ok: true, cliente: r[0] });
    }
    // ── atas de reuniao ────────────────────────────────────────────────────
    // Listar e de quem opera; escrever e apagar sao de quem administra, pela
    // mesma razao do resto do cadastro: sao o registro que o time inteiro le.
    // "Este nome nao e cliente." Um dedo de conversa com a lista do que falta
    // cadastrar: ela precisa poder chegar a zero, senao ninguem a le.
    if (acao === 'ignorar' || acao === 'reconhecer') {
      if (!id) return res.status(400).json({ error: 'Informe o cliente.' });
      const r = await db`UPDATE vybe_clientes SET nao_e_cliente=${acao === 'ignorar'}
        WHERE id=${Number(id)} RETURNING id, nome`;
      if (!r.length) return res.status(404).json({ error: 'Cliente não encontrado.' });
      return res.status(200).json({ ok: true, cliente: r[0] });
    }

    if (acao === 'ata-criar') {
      const { data, resumo } = req.body || {};
      const texto = String(resumo || '').trim();
      const dia = String(data || '').slice(0, 10);
      if (!id || !texto) return res.status(400).json({ error: 'Informe o cliente e o que ficou combinado.' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return res.status(400).json({ error: 'Informe a data da reunião.' });
      const autor = quem?.pessoa?.nome || 'Vybe OS';
      const r = await db`INSERT INTO vybe_cliente_reunioes (cliente_id, data, resumo, autor)
        VALUES (${Number(id)}, ${dia}::date, ${texto}, ${autor})
        RETURNING id, data, resumo, autor, criado_em`;
      // A ultima reuniao acompanha a ata mais recente: registrar a conversa e
      // ter de atualizar a data a mao seriam dois passos para um fato so.
      await db`UPDATE vybe_clientes SET ultima_reuniao = GREATEST(
          COALESCE(ultima_reuniao, ${dia}::date), ${dia}::date)
        WHERE id=${Number(id)}`;
      return res.status(200).json({ ok: true, ata: r[0] });
    }
    if (acao === 'ata-apagar') {
      const ataId = Number(req.body?.ata || 0);
      if (!ataId) return res.status(400).json({ error: 'Informe a ata.' });
      const r = await db`DELETE FROM vybe_cliente_reunioes WHERE id=${ataId} RETURNING cliente_id`;
      if (!r.length) return res.status(404).json({ error: 'Ata não encontrada.' });
      // Sem a ata que sustentava a data, a data volta a ser a da ata anterior.
      await db`UPDATE vybe_clientes SET ultima_reuniao =
          (SELECT MAX(data) FROM vybe_cliente_reunioes WHERE cliente_id=${r[0].cliente_id})
        WHERE id=${r[0].cliente_id}`;
      return res.status(200).json({ ok: true, removida: ataId });
    }

    // Head e vinculo, nao campo: mudar e trocar a lista inteira de uma vez, na
    // ordem em que a pessoa escolheu.
    if (acao === 'heads') {
      const { pessoas } = req.body || {};
      if (!id || !Array.isArray(pessoas)) return res.status(400).json({ error: 'Informe o cliente e as pessoas.' });
      const ids = pessoas.map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0);
      await db`DELETE FROM vybe_cliente_pessoas WHERE cliente_id = ${Number(id)}`;
      for (let i = 0; i < ids.length; i += 1) {
        await db`INSERT INTO vybe_cliente_pessoas (cliente_id, pessoa_id, ordem)
          VALUES (${Number(id)}, ${ids[i]}, ${i}) ON CONFLICT DO NOTHING`;
      }
      return res.status(200).json({ ok: true, pessoas: ids });
    }

    // Segmento e etiqueta compartilhada: renomear em um cliente so criaria um
    // vocabulario paralelo. Aqui a troca vale para todos que usam a etiqueta.
    if (acao === 'segmento-renomear' || acao === 'segmento-apagar') {
      const de = String(req.body?.de || '').trim();
      if (!de) return res.status(400).json({ error: 'Informe a etiqueta.' });
      const para = acao === 'segmento-apagar' ? null : String(req.body?.para || '').trim();
      if (acao === 'segmento-renomear' && !para) return res.status(400).json({ error: 'Informe o novo nome.' });
      const r = await db`UPDATE vybe_clientes SET segmento = ${para}
        WHERE LOWER(segmento) = LOWER(${de}) RETURNING id`;
      return res.status(200).json({ ok: true, clientes: r.length });
    }

    if (acao === 'renomear') {
      const limpo = String(nome || '').trim();
      if (!id || !limpo) return res.status(400).json({ error: 'Informe o cliente e o novo nome.' });
      const r = await db`UPDATE vybe_clientes SET nome=${limpo} WHERE id=${Number(id)} RETURNING id, nome, ativo`;
      if (!r.length) return res.status(404).json({ error: 'Cliente não encontrado.' });
      return res.status(200).json({ ok: true, cliente: r[0] });
    }
    if (acao === 'ativar' || acao === 'desativar') {
      if (!id) return res.status(400).json({ error: 'Informe o cliente.' });
      const antes = (await db`SELECT status, ativo FROM vybe_clientes WHERE id=${Number(id)}`)[0];
      const r = await db`UPDATE vybe_clientes
          SET ativo=${acao === 'ativar'}, status=${acao === 'ativar' ? 'Ativo' : 'Inativo'}
        WHERE id=${Number(id)} RETURNING id, nome, ativo`;
      if (r.length) {
        await db`INSERT INTO vybe_cliente_eventos (cliente_id, tipo, de, para, motivo, autor)
          VALUES (${Number(id)}, 'status',
                  ${antes?.status || (antes?.ativo === false ? 'Inativo' : 'Ativo')},
                  ${acao === 'ativar' ? 'Ativo' : 'Inativo'},
                  ${String(req.body?.motivo || '').trim() || null},
                  ${quem?.pessoa?.nome || 'Vybe OS'})`;
      }
      if (!r.length) return res.status(404).json({ error: 'Cliente não encontrado.' });
      return res.status(200).json({ ok: true, cliente: r[0] });
    }
    return res.status(400).json({ error: `Ação desconhecida: ${acao}` });
  }
  return res.status(405).json({ error: 'Método não permitido.' });
}

// ── opções das colunas ────────────────────────────────────────────────────────
//
// Formato, Tipo de conteúdo, Priority, OFF e Captação. Dá para ligar e desligar
// o que a tela oferece. Criar opção nova fica marcada como só da Vybe: enquanto
// o Monday existir, ele recusa rótulo que não conhece, então a réplica daquele
// campo é pulada — dito na hora, não descoberto depois.
const COLUNAS_EDITAVEIS = {
  lista_suspensa0__1: 'Formato do conteúdo',
  lista_suspensa__1: 'Tipo de conteúdo',
  color_mm164yv8: 'Priority',
  color_mkynd7j8: '🎙️ OFF',
};

async function areaOpcoes(req, res, quem) {
  const ehAdmin = quem.tipo === 'servico' || quem.pessoa?.admin;
  const db = sql();

  if (req.method === 'GET') {
    const [opcoes, captacao] = await Promise.all([
      db`SELECT coluna_id, chave, rotulo, indice, ativa, so_vybe FROM vybe_opcoes
          ORDER BY coluna_id, indice`,
      db`SELECT chave, rotulo, monday_index AS indice, ativa FROM vybe_captacao ORDER BY monday_index`,
    ]);
    return res.status(200).json({ ok: true, colunas: COLUNAS_EDITAVEIS, opcoes, captacao });
  }
  if (!ehAdmin) return res.status(403).json({ error: 'Só quem administra altera as opções.' });

  if (req.method === 'POST') {
    const { acao = 'alternar', coluna, chave, rotulo } = req.body || {};

    if (acao === 'alternar') {
      if (!coluna || !chave) return res.status(400).json({ error: 'Informe a coluna e a opção.' });
      const r = coluna === 'status_1__1'
        ? await db`UPDATE vybe_captacao SET ativa = NOT ativa WHERE chave=${chave} RETURNING chave, rotulo, ativa`
        : await db`UPDATE vybe_opcoes SET ativa = NOT ativa WHERE coluna_id=${coluna} AND chave=${chave}
             RETURNING chave, rotulo, ativa`;
      if (!r.length) return res.status(404).json({ error: 'Opção não encontrada.' });
      return res.status(200).json({ ok: true, opcao: r[0] });
    }

    // ── juntar dois status num só ──────────────────────────────────────────
    //
    // Solicitacoes tinham "Aguardando Aprovacao" E "Em aprovacao": dois nomes
    // para o mesmo momento da peca, herdados da epoca em que cada um escrevia o
    // seu no Monday. Vocabulario dobrado nao e detalhe — quem filtra por um nao
    // ve as do outro, e as duas listas ficam sempre pela metade.
    //
    // Juntar tem tres partes, e as tres precisam acontecer ou nenhuma serve: as
    // pecas mudam de status, o sobrevivente ganha o nome novo, e os outros somem
    // da lista. O sobrevivente e o que tem monday_index — e por ele que a copia
    // de contingencia ainda encontra a coluna certa.
    if (acao === 'unificar-status') {
      const de = Array.isArray(req.body?.de) ? req.body.de.map((x) => String(x).trim()).filter(Boolean) : [];
      const para = String(req.body?.para || '').trim();
      const board = Number(req.body?.board || 8385559107);
      if (!de.length || !para) return res.status(400).json({ error: 'Informe o status a absorver e o nome final.' });

      const chave = (v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const todos = await db`SELECT chave, rotulo, monday_index, ordem FROM vybe_status WHERE board_id=${board}`;
      // O destino conta como alvo: "junte X em Y" tanto vale quando Y ja existe
      // — e recebe as pecas — quanto quando Y ainda nao existe e um dos X vai
      // ser renomeado para ele. Exigir os dois lados sempre presentes travava
      // justamente o caso comum: sobrou um nome velho e o novo ainda nao nasceu.
      const nomes = [...new Set([...de, para])];
      const alvos = todos.filter((st) => nomes.some((nome) => chave(nome) === chave(st.rotulo)));
      if (!alvos.length) {
        return res.status(404).json({ error: 'Nenhum desses status existe nas solicitações.' });
      }
      // Sobrevive quem ja tem o nome final; senao, quem tem indice do Monday —
      // e por ele que a copia de contingencia encontra a coluna certa.
      const ordenados = [...alvos].sort((a, b) =>
        (chave(b.rotulo) === chave(para) ? 1 : 0) - (chave(a.rotulo) === chave(para) ? 1 : 0)
        || (b.monday_index === null ? 0 : 1) - (a.monday_index === null ? 0 : 1)
        || Number(a.ordem || 0) - Number(b.ordem || 0));
      const fica = ordenados[0];
      if (ordenados.length < 2) {
        // So um existe: nao ha o que mover, mas pode faltar o nome certo.
        if (chave(fica.rotulo) === chave(para)) {
          return res.status(200).json({ ok: true, acao, ficou: { chave: fica.chave, rotulo: para },
            removidos: [], pecas_movidas: 0, nota: 'Já estava unificado.' });
        }
        await db`UPDATE vybe_status SET rotulo=${para} WHERE chave=${fica.chave} AND board_id=${board}`;
        return res.status(200).json({ ok: true, acao, ficou: { chave: fica.chave, rotulo: para },
          removidos: [], pecas_movidas: 0, nota: 'Só o nome mudou; não havia outro status para absorver.' });
      }
      const saem = ordenados.slice(1).map((st) => st.chave);

      const movidas = await db`UPDATE vybe_conteudos SET status_chave=${fica.chave}, atualizado_em=NOW()
        WHERE board_id=${board} AND status_chave = ANY(${saem}) RETURNING id`;
      await db`UPDATE vybe_status SET rotulo=${para} WHERE chave=${fica.chave} AND board_id=${board}`;
      await db`DELETE FROM vybe_status WHERE board_id=${board} AND chave = ANY(${saem})`;
      return res.status(200).json({ ok: true, acao, ficou: { chave: fica.chave, rotulo: para },
        removidos: saem, pecas_movidas: movidas.length });
    }

    if (acao === 'criar') {
      const limpo = String(rotulo || '').trim();
      if (!coluna || !limpo) return res.status(400).json({ error: 'Informe a coluna e o rótulo.' });
      if (!COLUNAS_EDITAVEIS[coluna]) return res.status(400).json({ error: 'Coluna não editável.' });
      const nova = String(limpo).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const r = await db`INSERT INTO vybe_opcoes (coluna_id, chave, rotulo, indice, ativa, so_vybe)
        VALUES (${coluna}, ${nova}, ${limpo}, NULL, TRUE, TRUE)
        ON CONFLICT (coluna_id, chave) DO UPDATE SET rotulo=EXCLUDED.rotulo, ativa=TRUE
        RETURNING coluna_id, chave, rotulo, ativa, so_vybe`;
      return res.status(200).json({ ok: true, opcao: r[0],
        aviso: 'Opção criada só na Vybe. Enquanto o Monday existir, a cópia deste campo é pulada quando ela for usada.' });
    }

    // Renomear, recolorir e remover: o painel só sabia criar e ligar/desligar,
    // então mudar o nome de uma etiqueta exigia abrir o Monday.
    if (acao === 'renomear') {
      const novo = String(rotulo || '').trim();
      if (!novo) return res.status(400).json({ error: 'Informe o novo nome.' });
      const r = coluna === 'status_1__1'
        ? await db`UPDATE vybe_captacao SET rotulo=${novo} WHERE chave=${chave} RETURNING chave, rotulo`
        : await db`UPDATE vybe_opcoes SET rotulo=${novo} WHERE coluna_id=${coluna} AND chave=${chave}
             RETURNING chave, rotulo`;
      if (!r.length) return res.status(404).json({ error: 'Etiqueta não encontrada.' });
      return res.status(200).json({ ok: true, acao, etiqueta: r[0] });
    }

    if (acao === 'cor') {
      const cor = String(req.body?.cor || '').trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(cor)) return res.status(400).json({ error: 'Cor inválida; use #RRGGBB.' });
      const r = coluna === 'status_1__1'
        ? await db`UPDATE vybe_captacao SET cor=${cor}, borda=${cor} WHERE chave=${chave} RETURNING chave, cor`
        : await db`UPDATE vybe_opcoes SET cor=${cor}, borda=${cor} WHERE coluna_id=${coluna} AND chave=${chave}
             RETURNING chave, cor`;
      if (!r.length) return res.status(404).json({ error: 'Etiqueta não encontrada.' });
      return res.status(200).json({ ok: true, acao, etiqueta: r[0] });
    }

    if (acao === 'remover') {
      // Apagar uma etiqueta em uso deixaria as peças apontando para nada. O
      // painel recusa e oferece o caminho reversível: desligar.
      const coluna_bd = { 'lista_suspensa0__1': 'formato_chaves', 'lista_suspensa__1': 'tipo_conteudo_chaves' }[coluna];
      let emUso = 0;
      if (coluna === 'status_1__1') {
        emUso = Number((await db`SELECT COUNT(*)::int AS n FROM vybe_conteudos WHERE captacao_chave=${chave}`)[0].n);
      } else if (coluna_bd === 'formato_chaves') {
        emUso = Number((await db`SELECT COUNT(*)::int AS n FROM vybe_conteudos WHERE ${chave} = ANY(formato_chaves)`)[0].n);
      } else if (coluna_bd === 'tipo_conteudo_chaves') {
        emUso = Number((await db`SELECT COUNT(*)::int AS n FROM vybe_conteudos WHERE ${chave} = ANY(tipo_conteudo_chaves)`)[0].n);
      } else if (coluna === 'color_mm164yv8') {
        emUso = Number((await db`SELECT COUNT(*)::int AS n FROM vybe_conteudos WHERE prioridade_chave=${chave}`)[0].n);
      } else if (coluna === 'color_mkynd7j8') {
        emUso = Number((await db`SELECT COUNT(*)::int AS n FROM vybe_conteudos WHERE off_audio_chave=${chave}`)[0].n);
      }
      if (emUso > 0) {
        return res.status(409).json({
          error: `Esta etiqueta está em ${emUso} ${emUso === 1 ? 'peça' : 'peças'}. `
               + 'Desligue em vez de apagar: ela some das escolhas novas e as peças que já a usam continuam certas.',
          em_uso: emUso,
        });
      }
      const r = coluna === 'status_1__1'
        ? await db`DELETE FROM vybe_captacao WHERE chave=${chave} RETURNING chave, rotulo`
        : await db`DELETE FROM vybe_opcoes WHERE coluna_id=${coluna} AND chave=${chave} RETURNING chave, rotulo`;
      if (!r.length) return res.status(404).json({ error: 'Etiqueta não encontrada.' });
      return res.status(200).json({ ok: true, acao, removida: r[0] });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${acao}` });
  }
  return res.status(405).json({ error: 'Método não permitido.' });
}

// ── acessos ───────────────────────────────────────────────────────────────────
//
// Credenciais dos clientes, que no Monday viviam dentro de um documento. Só
// administrador, e o conteúdo só sai quando é pedido explicitamente por id — a
// listagem devolve metadado, para abrir a tela não derramar 43 senhas de uma vez
// em cache de navegador.
async function areaAcessos(req, res, quem) {
  if (!(quem.tipo === 'servico' || quem.pessoa?.admin)) {
    return res.status(403).json({ error: 'Só quem administra vê os acessos.' });
  }
  const db = sql();

  // Gravar o documento aqui e o ultimo passo para nao precisar mais do quadro
  // Dados & Acessos: ate agora o texto so podia ser corrigido no Monday, e o
  // painel era uma janela de leitura sobre uma copia que envelhecia.
  if (req.method === 'POST') {
    const { id, cliente, texto, pasta_drive, link } = req.body || {};
    const conteudo = typeof texto === 'string' ? texto : null;
    if (id) {
      const r = await db`UPDATE vybe_acessos SET
          doc_conteudo = COALESCE(${conteudo}, doc_conteudo),
          doc_atualizado_em = CASE WHEN ${conteudo}::text IS NULL THEN doc_atualizado_em ELSE NOW() END,
          pasta_drive = COALESCE(${pasta_drive ?? null}, pasta_drive),
          link = COALESCE(${link ?? null}, link),
          atualizado_em = NOW()
        WHERE id = ${Number(id)} RETURNING id`;
      if (!r.length) return res.status(404).json({ error: 'Acesso não encontrado.' });
      return res.status(200).json({ ok: true, id: r[0].id });
    }
    // Cliente que nunca teve ficha de acessos ganha a dele agora. Sem
    // monday_item_id: nasceu aqui, e a coluna aceita vazio.
    const clienteId = Number(cliente || 0);
    if (!clienteId) return res.status(400).json({ error: 'Informe o cliente.' });
    const dono = (await db`SELECT nome FROM vybe_clientes WHERE id = ${clienteId}`)[0];
    if (!dono) return res.status(404).json({ error: 'Cliente não encontrado.' });
    const r = await db`INSERT INTO vybe_acessos
        (nome, cliente_id, pasta_drive, link, doc_conteudo, doc_atualizado_em)
      VALUES (${`Dados & Acessos - ${dono.nome}`}, ${clienteId}, ${pasta_drive ?? null},
              ${link ?? null}, ${conteudo}, ${conteudo ? new Date().toISOString() : null})
      RETURNING id`;
    return res.status(200).json({ ok: true, id: r[0].id, criado: true });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const id = req.query?.id;
  if (id) {
    const linha = (await db`SELECT a.id, a.nome, a.doc_conteudo, a.pasta_drive, a.link,
        a.doc_atualizado_em, c.nome AS cliente
      FROM vybe_acessos a LEFT JOIN vybe_clientes c ON c.id = a.cliente_id
      WHERE a.id = ${Number(id)}`)[0];
    if (!linha) return res.status(404).json({ error: 'Acesso não encontrado.' });
    return res.status(200).json({ ok: true, acesso: linha });
  }

  const linhas = await db`SELECT a.id, a.nome, a.grupo, a.pasta_drive, a.link, a.manus,
      a.doc_id, a.doc_atualizado_em, c.nome AS cliente,
      (a.doc_conteudo IS NOT NULL AND LENGTH(a.doc_conteudo) > 0) AS tem_documento,
      COALESCE(LENGTH(a.doc_conteudo), 0) AS tamanho
    FROM vybe_acessos a LEFT JOIN vybe_clientes c ON c.id = a.cliente_id
    ORDER BY (a.grupo = 'Inativos'), a.nome`;
  return res.status(200).json({ ok: true, acessos: linhas });
}

// ── diário central ────────────────────────────────────────────────────────────
async function areaDiario(req, res, quem) {
  const db = sql();
  if (req.method === 'GET') {
    const id = Number(req.query?.id || 0);
    if (id) {
      const snapshot = await obterSnapshot(db, id);
      if (!snapshot) return res.status(404).json({ error: 'Snapshot não encontrado.' });
      return res.status(200).json({ ok: true, snapshot });
    }
    return res.status(200).json({ ok: true, snapshots: await listarSnapshots(db, req.query?.limite) });
  }
  if (req.method === 'POST') {
    const snapshot = await registrarSnapshotOperacional(db, quem.tipo === 'servico' ? 'servico' : 'manual_painel');
    return res.status(200).json({ ok: true, snapshot });
  }
  if (req.method === 'DELETE') {
    if (!(quem.tipo === 'servico' || quem.pessoa?.admin)) {
      return res.status(403).json({ error: 'Somente administradores podem excluir snapshots.' });
    }
    const id = Number(req.query?.id || req.body?.id || 0);
    if (!id) return res.status(400).json({ error: 'Informe o snapshot.' });
    const removido = await excluirSnapshot(db, id);
    if (!removido) return res.status(404).json({ error: 'Snapshot não encontrado.' });
    return res.status(200).json({ ok: true, removido });
  }
  return res.status(405).json({ error: 'Método não permitido.' });
}

// ── miniaturas de várias peças de uma vez ─────────────────────────────────────
//
// A mesa individual mostra 65 linhas. Perguntar por uma peça de cada vez seriam
// 65 idas ao servidor só para saber se existe arquivo — a tela abriria antes das
// respostas e a coluna piscaria por meio minuto. Aqui vai tudo numa pergunta só.
//
// Devolve apenas o arquivo mais recente de cada peça, e só o que a coluna
// precisa. Quem quiser a lista inteira abre a peça, que é onde ela mora.
//
// Miniatura sai só para arquivo que já está no Drive: o link de lá é estável. O
// do Monday é assinado e vale uma hora — renovar 65 assinaturas para desenhar
// uma coluna custaria mais do que a coluna vale. Nesses casos a tela diz que há
// arquivo, sem prévia.
async function areaArquivos(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const itens = String(req.query?.itens || '').split(',').map((s) => s.trim()).filter(Boolean);
  // O teto existe para uma URL não virar uma consulta sem fim; a mesa manda no
  // máximo o que uma pessoa tem em aberto, bem abaixo disso.
  if (!itens.length) return res.status(200).json({ ok: true, itens: {} });
  const ids = [...new Set(itens)].slice(0, 300);

  const linhas = await sql()`
    SELECT DISTINCT ON (c.monday_item_id)
           c.monday_item_id AS item, a.nome, a.extensao, a.drive_file_id,
           COUNT(*) OVER (PARTITION BY c.monday_item_id)::int AS total
      FROM vybe_conteudos c
      JOIN vybe_conteudo_arquivos a ON a.conteudo_id = c.id AND a.ausente_em IS NULL
     WHERE c.monday_item_id = ANY(${ids}) AND c.removido_em IS NULL
     ORDER BY c.monday_item_id, a.criado_em DESC NULLS LAST`;

  const mapa = {};
  for (const l of linhas) {
    mapa[String(l.item)] = {
      total: Number(l.total) || 1,
      nome: l.nome || '',
      extensao: l.extensao || '',
      // sz=w160 porque a célula tem 56px: pedir a imagem inteira para desenhar
      // um selo seria baixar megabytes por linha.
      thumb: l.drive_file_id ? `https://drive.google.com/thumbnail?id=${l.drive_file_id}&sz=w160` : null,
      abrir: l.drive_file_id ? `https://drive.google.com/file/d/${l.drive_file_id}/view` : null,
    };
  }
  return res.status(200).json({ ok: true, itens: mapa });
}

const AREAS = { automacoes: areaAutomacoes, acessos: areaAcessos, clientes: areaClientes, diario: areaDiario, opcoes: areaOpcoes, notificacoes: areaNotificacoes,
                conta: areaConta, pessoas: areaPessoas, peca: areaPeca, arquivos: areaArquivos };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const enviado = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const manutencao = process.env.CUTOVER_MIGRATION_KEY && enviado && enviado === String(process.env.CUTOVER_MIGRATION_KEY).trim();
  const quem = quemChama(req) || (manutencao ? { tipo:'servico' } : null);
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
