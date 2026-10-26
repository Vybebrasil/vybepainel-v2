import {exigirAdministradorPrivado} from './assistente-exclusivo.js';
import {validarConversa,autorizarConversa} from './assistente-politica.js';
import {createHash} from 'node:crypto';
import {sessaoDoPedido} from '../vybe_sessao.js';
import {autenticarAssistente} from './assistente-servico.js';
import {identificadorProtegido,validarJid} from './assistente-identidade.js';

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

// Canal técnico: token dedicado e identidade privada exclusiva, sem dados pessoais.
// Reutiliza o token do bot apenas para estes dois metadados; não concede admin.
export async function diagnosticoBancoBotAssistente(req, res, criarBanco, config = process.env) {
  res.setHeader('Cache-Control', 'no-store');
  if (config.VERCEL_ENV !== 'preview' || config.VYBE_HOMOLOGACAO !== '1'
      || config.VERCEL_GIT_COMMIT_REF !== 'feature/vybe-ai-readonly-integration')
    return res.status(404).json({error:'Não encontrado.'});
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error:'Método não permitido.'});
  }
  if (req.query?.canal !== 'bot') return res.status(403).json({error:'Canal não autorizado.'});
  if (!autenticarAssistente(req, config.VYBE_AI_BOT_TOKEN))
    return res.status(401).json({error:'Não autorizado.'});
  try {
    exigirAdministradorPrivado(req.body?.jid,req.body?.contexto,config);
    validarConversa(req.body?.jid,req.body?.contexto,config);
  } catch { return res.status(403).json({error:'Não autorizado.'}); }
  try {
    const banco=criarBanco();
    await autorizarConversa(banco,req.body.jid,req.body.contexto,config.VYBE_AI_LINK_SECRET,config);
    const metadados=await consultarIdentidadeBanco(banco, config.DATABASE_URL);
    await autorizarConversa(banco,req.body.jid,req.body.contexto,config.VYBE_AI_LINK_SECRET,config);
    return res.status(200).json(metadados);
  } catch(erro) {
    if(erro.status===403)return res.status(403).json({error:'Não autorizado.'});
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
  const verificarVinculo=req.query?.consulta==='diagnostico_vinculo';
  const metodo=verificarVinculo?'POST':'GET';
  if (req.method !== metodo) {
    res.setHeader('Allow', metodo);
    return res.status(405).json({error:'Método não permitido.'});
  }
  if (req.query?.canal) return res.status(403).json({error:'Use uma sessão administrativa do painel.'});
  if(verificarVinculo) {
    const origem='https://vybepainel-v2-git-feature-vybe-ai-readonly-integration-vybe-hub.vercel.app';
    if(req.headers?.origin!==origem)return res.status(403).json({error:'Não autorizado.'});
    if(!req.body||Object.keys(req.body).length!==1||!validarJid(req.body.jid))
      return res.status(400).json({error:'Pedido inválido.'});
    if(typeof config.VYBE_AI_LINK_SECRET!=='string'||config.VYBE_AI_LINK_SECRET.length<32)
      return res.status(503).json({error:'Verificação indisponível.'});
  }
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
    if(verificarVinculo) {
      const sql=obterBanco();
      const [contas]=await sql.transaction([sql`SELECT nome, email FROM vybe_pessoas
        WHERE id=${Number(pessoa.id)} AND ativo IS TRUE AND pode_entrar IS TRUE AND admin IS TRUE
          AND senha_hash IS NOT NULL AND senha_hash<>''`],{readOnly:true});
      if(contas.length!==1||contas[0].nome!=='Paulo Teste AI — fictício'||!String(contas[0].email||'').endsWith('@vybe.invalid'))
        return res.status(403).json({error:'Não autorizado.'});
      const metadados=await consultarIdentidadeBanco(obterBanco(),config.DATABASE_URL);
      if(metadados.identificador_banco!=='sha256:f15a33699c956ed4263414a0fd8be51bdeb3791dbde745afa8c82e4929c2d3b0')
        return res.status(503).json({error:'Verificação indisponível.'});
      const hash=identificadorProtegido(req.body.jid,config.VYBE_AI_LINK_SECRET);
      const [linhas]=await sql.transaction([sql`SELECT EXISTS (
        SELECT 1 FROM vybe_ai_vinculos v JOIN vybe_pessoas p ON p.id=v.pessoa_id
        WHERE v.jid_hash=${hash} AND v.pessoa_id=${Number(pessoa.id)} AND v.revogado_em IS NULL
          AND p.nome='Paulo Teste AI — fictício' AND p.email LIKE '%@vybe.invalid'
          AND p.ativo IS TRUE AND p.pode_entrar IS TRUE AND p.admin IS TRUE
          AND p.senha_hash IS NOT NULL AND p.senha_hash<>''
      ) AS corresponde`],{readOnly:true});
      if(typeof linhas[0]?.corresponde!=='boolean')throw new Error('Resultado inválido.');
      return res.status(200).json({resultado:linhas[0].corresponde?'CORRESPONDE':'NÃO CORRESPONDE'});
    }
    return res.status(200).json({ok:true,...await consultarIdentidadeBanco(obterBanco(), config.DATABASE_URL)});
  } catch {
    // Objetos do driver podem conter conexão, parâmetros e dados da sessão.
    return res.status(503).json({error:'Não foi possível verificar o banco.'});
  }
}
