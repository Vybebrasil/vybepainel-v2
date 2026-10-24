// Consulta pontual, somente após publicação autorizada. Não recebe credenciais
// por argumento, não cria arquivos e não inicializa o bot/WhatsApp.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {configurarApi,lerJsonLimitado} from '../conectores/whatsapp/vybe-api.js';

const PREVIEW='https://vybepainel-v2-git-feature-vybe-ai-readonly-integration-vybe-hub.vercel.app';
const REFERENCIA='sha256:f15a33699c956ed4263414a0fd8be51bdeb3791dbde745afa8c82e4929c2d3b0';
class ErroConsulta extends Error {}

export function correspondeHomologacao(dados) {
  return dados?.banco==='neondb' && dados?.identificador_banco===REFERENCIA;
}

export async function consultarBancoPreview({
  lerToken=()=>readFile('C:/whatsapp-ia/token-vybe.txt','utf8'), buscar=fetch,
}={}) {
  try {
    const {base,token}=configurarApi({VYBE_API_URL:PREVIEW,VYBE_AI_BOT_TOKEN:String(await lerToken()).trim()});
    const resposta=await buscar(base+'/api/painel?area=assistente&canal=bot&consulta=diagnostico_banco_bot',{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',
    });
    if(!resposta.ok) {
      const status=Number.isInteger(resposta.status) && resposta.status>=400 && resposta.status<=599 ? resposta.status : 'inesperado';
      throw new ErroConsulta('Diagnóstico recusado: HTTP '+status+'. Nenhuma correspondência confirmada.');
    }
    const dados=await lerJsonLimitado(resposta,4096);
    if(!dados || typeof dados!=='object' || Array.isArray(dados)
      || Object.keys(dados).length!==2
      || typeof dados.banco!=='string' || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(dados.banco)
      || typeof dados.identificador_banco!=='string' || !/^sha256:[a-f0-9]{64}$/.test(dados.identificador_banco))
      throw new ErroConsulta('Resposta de diagnóstico inválida. Nenhuma correspondência confirmada.');
    return {banco:dados.banco,identificador_banco:dados.identificador_banco};
  } catch(erro) {
    if(erro instanceof ErroConsulta)throw erro;
    // Erros de arquivo/rede podem carregar caminhos, headers ou outros detalhes.
    throw new ErroConsulta('Consulta não concluída. Confira o token local e o acesso à Preview, sem exibir credenciais.');
  }
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    if(process.argv.length!==2)throw new ErroConsulta('Execute sem argumentos. O token é lido somente do arquivo local existente.');
    const dados=await consultarBancoPreview();
    console.log(JSON.stringify(dados));
    const corresponde=correspondeHomologacao(dados);
    console.log(corresponde?'Destino corresponde à referência de homologação.':'Divergência: destino não corresponde à referência de homologação.');
    process.exitCode=corresponde?0:2;
  } catch(erro) {
    console.error(erro instanceof ErroConsulta?erro.message:'Consulta não concluída.');
    process.exitCode=1;
  }
}
