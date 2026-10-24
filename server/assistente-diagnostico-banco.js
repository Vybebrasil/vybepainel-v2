import {createHash} from 'node:crypto';
import {sessaoDoPedido} from '../vybe_sessao.js';
import {autenticarAssistente} from './assistente-servico.js';

// Identifica o destino da conexão, nunca suas credenciais. O pooler do Neon
// e a conexão direta para o mesmo endpoint precisam produzir a mesma referência.
export function identificadorBanco(url, banco) {
  const destino = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(destino.protocol)
      || !destino.hostname.endsWith('.neon.tech') || (destino.port && destino.port !== '5432')
      || typeof banco !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(banco)
      || decodeURIComponent(destino.pathname.slice(1)) !== banco)
    throw new Error('Não foi possível identificar o banco.');
  const endpoint = destino.hostname.replace(/-pooler(?=\.)/, '');
  return 'sha256:' + createHash('sha256')
    .update(JSON.stringify(['vybe-ai-banco-v1', endpoint, banco])).digest('hex');
}

async function consultarIdentidadeBanco(sql, url) {
  const [[metadados]] = await sql.transaction([sql`SELECT current_database() AS banco`], {readOnly:true});
  return {banco:metadados.banco, identificador_banco:identificadorBanco(url, metadados.banco)};
}

// Canal de operação técnica, sem sessão, identidade WhatsApp ou dados pessoais.
// Reutiliza o token do bot apenas para estes dois metadados; não concede admin.
export async function diagnosticoBancoBotAssistente(req, res, criarBanco, config = process.env) {
  res.setHeader('Cache-Control', 'no-store');
  if (config.VERCEL_ENV !== 'preview' || config.VYBE_HOMOLOGACAO !== '1'
      || config.VERCEL_GIT_COMMIT_REF !== 'feature/vybe-ai-readonly-integration')
    return res.status(404).json({error:'Não encontrado.'});
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error:'Método não permitido.'});
  }
  if (req.query?.canal !== 'bot') return res.status(403).json({error:'Canal não autorizado.'});
  if (!autenticarAssistente(req, config.VYBE_AI_BOT_TOKEN))
    return res.status(401).json({error:'Não autorizado.'});
  try {
    return res.status(200).json(await consultarIdentidadeBanco(criarBanco(), config.DATABASE_URL));
  } catch {
    return res.status(503).json({error:'Não foi possível verificar o banco.'});
  }
}

// Temporário: reutiliza o endpoint e a fábrica DATABASE_URL da aplicação.
// Não usa quemChama: credenciais de serviço/bot/manutenção não dão acesso.
export async function diagnosticoBancoAssistente(req, res, criarBanco, config = process.env) {
  res.setHeader('Cache-Control', 'no-store');
  if (config.VERCEL_ENV !== 'preview' || config.VYBE_HOMOLOGACAO !== '1'
      || config.VERCEL_GIT_COMMIT_REF !== 'feature/vybe-ai-readonly-integration')
    return res.status(404).json({error:'Não encontrado.'});
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error:'Método não permitido.'});
  }
  if (req.query?.canal) return res.status(403).json({error:'Use uma sessão administrativa do painel.'});
  try {
    let banco;
    const obterBanco = () => banco ||= criarBanco();
    const pessoa = await sessaoDoPedido(req, {buscarPessoa: async id => {
      const sql = obterBanco();
      // A função padrão inicializa o schema. Aqui todas as consultas são SELECT
      // em READ ONLY, inclusive a revalidação das permissões atuais da sessão.
      const [linhas] = await sql.transaction([sql`SELECT id, ativo, pode_entrar,
        admin, (senha_hash IS NOT NULL AND senha_hash <> '') AS senha_hash, sessao_versao
        FROM vybe_pessoas WHERE id=${id}`], {readOnly:true});
      return linhas[0];
    }});
    if (!pessoa) return res.status(401).json({error:'Entre no painel para acessar.'});
    if (!pessoa.admin) return res.status(403).json({error:'Só quem administra acessa este diagnóstico.'});
    return res.status(200).json({ok:true,...await consultarIdentidadeBanco(obterBanco(), config.DATABASE_URL)});
  } catch {
    // Objetos do driver podem conter conexão, parâmetros e dados da sessão.
    return res.status(503).json({error:'Não foi possível verificar o banco.'});
  }
}
