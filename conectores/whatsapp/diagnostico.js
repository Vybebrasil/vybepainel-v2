'use strict';
const CODIGOS=new Set(['AUTENTICACAO','AUTORIZACAO','API_HTTP','API_TIMEOUT','API_INDISPONIVEL','FORMATO_API','OLLAMA_HTTP','OLLAMA_TIMEOUT','OLLAMA_INDISPONIVEL','MODELO_INVALIDO','MODELO_VAZIO','FERRAMENTA_DESCONHECIDA','ARGUMENTOS_REJEITADOS','LIMITE_TEMPO','LIMITE_FERRAMENTAS','LIMITE_CONTEXTO','LIMITE_RODADAS','FORMATACAO','INTERNO']);
function falha(codigo){const e=new Error('Operação não concluída.');e.categoria=CODIGOS.has(codigo)?codigo:'INTERNO';return e;}
function categoriaErro(e){if(CODIGOS.has(e?.categoria))return e.categoria;if(e?.status===401)return 'AUTENTICACAO';if(e?.status===403)return 'AUTORIZACAO';if(e?.status===413)return 'LIMITE_CONTEXTO';if(e?.status===400)return 'ARGUMENTOS_REJEITADOS';if(Number.isInteger(e?.status))return 'API_HTTP';return 'INTERNO';}
module.exports={falha,categoriaErro};
