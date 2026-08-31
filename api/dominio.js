// api/dominio.js — cria e popula as tabelas de domínio a partir do espelho.
//
// Passo 2 da saída do Monday. Este endpoint SÓ LÊ o espelho e SÓ ESCREVE nas tabelas
// novas (vybe_clientes, vybe_pessoas, vybe_status, vybe_conteudos e os vínculos).
// Não toca em vybe_mirror_*, não fala com o Monday e o painel ainda não lê daqui —
// rodar isto não pode alterar o que o time vê.
//
// Protegido pelo mesmo MIRROR_ADMIN_KEY do api/operational-mirror.js:
//
//   curl -X POST ".../api/dominio?action=popular" -H "Authorization: Bearer $CHAVE"
//   curl      ".../api/dominio?action=resumo"     -H "Authorization: Bearer $CHAVE"

import { definirSenha, listarPessoas } from '../vybe_sessao.js';
import { quemChama } from '../vybe_acesso.js';
import { neon } from '@neondatabase/serverless';
import { indicadoresIndependencia, listarSnapshots, historicoSaude, registrarSnapshotOperacional } from '../vybe_observabilidade.js';
import { sanearBaseMestre } from '../vybe_saneamento.js';
import { importarFotosDaEquipe, importarCadastroClientes, importarAcessos, popularDemandas, desfazerMigracaoDrive, migrarArquivosParaDrive, importarCatalogoOpcoes, importarCatalogoCaptacao, importarColunasExtra, importarHistoricoStatus, criarSchema, popularDoEspelho, resumo, sincronizarHistorico, perfilArquivos, sincronizarEquipe, definirAcesso, eventos,
  importarSubitens,
  corrigirEtiquetasConcluidas,
} from '../vybe_dominio_store.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

// Apara espaço e quebra de linha dos dois lados: colar valor no painel da Vercel
// costuma trazer um \n junto, e a chave passa a nunca bater.
function autorizado(req) {
  const origem = quemChama(req);
  if (origem?.tipo === 'servico' || origem?.pessoa?.admin) return true;
  const segredo = String(process.env.MIRROR_ADMIN_KEY || '').trim();
  const manutencao = String(process.env.CUTOVER_MIGRATION_KEY || '').trim();
  const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const enviado = String(req.query?.key || req.body?.key || bearer || '').trim();
  return Boolean((segredo && enviado === segredo) || (manutencao && enviado === manutencao));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!autorizado(req)) return res.status(401).json({ error: 'Não autorizado.' });

  const action = String(req.query?.action || req.body?.action || 'resumo');

  try {
    if (action === 'arquivos') {
      return res.status(200).json({ ok: true, action, ...(await perfilArquivos()) });
    }
    if (action === 'eventos') {
      return res.status(200).json({ ok: true, action, eventos: await eventos(req.query?.limite) });
    }
    if (action === 'resumo') {
      return res.status(200).json({ ok: true, action, ...(await resumo()) });
    }
    if (action === 'saude') {
      const sql = neon(process.env.DATABASE_URL);
      return res.status(200).json({ ok: true, action, ...(await indicadoresIndependencia(sql)), eventos: await historicoSaude(sql, req.query?.limite) });
    }
    if (action === 'snapshots') {
      const sql = neon(process.env.DATABASE_URL);
      return res.status(200).json({ ok: true, action, snapshots: await listarSnapshots(sql, req.query?.limite) });
    }
    if (action === 'saneamento') {
      const sql = neon(process.env.DATABASE_URL);
      return res.status(200).json({ ok: true, action, ...(await sanearBaseMestre(sql, { aplicar: false })) });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Use POST para schema e popular.' });
    }
    if (action === 'schema') {
      await criarSchema();
      return res.status(200).json({ ok: true, action, ...(await resumo()) });
    }
    if (action === 'snapshot') {
      const sql = neon(process.env.DATABASE_URL);
      return res.status(200).json({ ok: true, action, snapshot: await registrarSnapshotOperacional(sql, 'manual_admin') });
    }
    if (action === 'sanear') {
      const sql = neon(process.env.DATABASE_URL);
      return res.status(200).json({ ok: true, action, ...(await sanearBaseMestre(sql, { aplicar: true })) });
    }
    if (action === 'drive_conferir') {
      const { conferirDrive } = await import('../vybe_drive.js');
      return res.status(200).json({ ok: true, action, ...(await conferirDrive()) });
    }
    if (action === 'drive_desfazer') {
      return res.status(200).json({ ok: true, action, ...(await desfazerMigracaoDrive()) });
    }
    if (action === 'drive_migrar') {
      const q = { ...(req.query || {}), ...(req.body || {}) };
      return res.status(200).json({ ok: true, action,
        ...(await migrarArquivosParaDrive({ limite: Number(q.limite) || 8 })) });
    }
    if (action === 'fotos_equipe') {
      const q = { ...(req.query || {}), ...(req.body || {}) };
      return res.status(200).json({ ok: true, action,
        ...(await importarFotosDaEquipe({ refazer: q.refazer === '1' || q.refazer === true })) });
    }
    if (action === 'cadastro_clientes') {
      return res.status(200).json({ ok: true, action, ...(await importarCadastroClientes()) });
    }
    if (action === 'acessos') {
      return res.status(200).json({ ok: true, action, ...(await importarAcessos()) });
    }
    if (action === 'subitens') {
      return res.status(200).json({ ok: true, action, ...(await importarSubitens()) });
    }
    if (action === 'etiquetas_concluidas') {
      return res.status(200).json({ ok: true, action, ...(await corrigirEtiquetasConcluidas()) });
    }
    if (action === 'popular_demandas') {
      return res.status(200).json({ ok: true, action, ...(await popularDemandas()) });
    }
    if (action === 'catalogo_opcoes') {
      return res.status(200).json({ ok: true, action, ...(await importarCatalogoOpcoes()) });
    }
    if (action === 'catalogo_captacao') {
      return res.status(200).json({ ok: true, action, ...(await importarCatalogoCaptacao()) });
    }
    if (action === 'colunas_extra') {
      const q = { ...(req.query || {}), ...(req.body || {}) };
      return res.status(200).json({ ok: true, action, ...(await importarColunasExtra({
        cursor: q.cursor || null, paginas: Number(q.paginas) || 4,
      })) });
    }
    if (action === 'historico_status') {
      const q = { ...(req.query || {}), ...(req.body || {}) };
      if (!q.de || !q.ate) return res.status(400).json({ error: 'Informe de e ate (ISO).' });
      return res.status(200).json({ ok: true, action, ...(await importarHistoricoStatus({
        de: String(q.de), ate: String(q.ate),
        pagina: Number(q.pagina) || 1, paginas: Number(q.paginas) || 8,
      })) });
    }
    if (action === 'pessoas') {
      return res.status(200).json({ ok: true, action, pessoas: await listarPessoas() });
    }
    if (action === 'senha') {
      // Definir/redefinir senha. É o caminho do administrador, e também o que
      // cria a primeira senha — sem ele não haveria como o primeiro entrar.
      const email = req.query?.email || req.body?.email;
      const senha = req.query?.senha || req.body?.senha;
      const admin = (req.query?.admin ?? req.body?.admin);
      if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });
      const pessoa = await definirSenha(email, senha, {
        admin: admin === undefined ? null : String(admin) !== 'false',
      });
      return res.status(200).json({ ok: true, action, pessoa });
    }
    if (action === 'equipe') {
      return res.status(200).json({ ok: true, action, ...(await sincronizarEquipe()) });
    }
    if (action === 'acesso') {
      const email = req.query?.email || req.body?.email;
      const pode = String(req.query?.pode ?? req.body?.pode ?? 'true') !== 'false';
      if (!email) return res.status(400).json({ error: 'Informe o e-mail.' });
      return res.status(200).json({ ok: true, action, pessoa: await definirAcesso(email, pode) });
    }
    if (action === 'historico') {
      // Paginado: passe o proximo_cursor da resposta anterior para continuar.
      // board permite concluir Produção e Solicitações com a mesma rotina.
      const cursor = req.query?.cursor || req.body?.cursor || null;
      const paginas = Number(req.query?.paginas || req.body?.paginas || 3);
      const board = Number(req.query?.board || req.body?.board || 7829537690);
      const lote = Number(req.query?.lote || req.body?.lote || 20);
      return res.status(200).json({ ok: true, action, ...(await sincronizarHistorico(cursor, paginas, board, lote)) });
    }
    if (action === 'popular') {
      const resultado = await popularDoEspelho();
      return res.status(200).json({ ok: true, action, ...resultado, tabelas: await resumo() });
    }
    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (erro) {
    return res.status(500).json({ error: erro.message });
  }
}
