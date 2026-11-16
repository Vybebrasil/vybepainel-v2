// Publicar o planejamento do mês pelos conectores MCP (Paulo, 16/11/2026).
//
// Duas portas chegam aqui com a MESMA gravação (P.publicarDoAgente) e o mesmo formato:
//   - o conector dos agentes (server/planejamentos-api.js, area=agentes);
//   - o Ecossistema Vybe, que os chats dos clientes usam (server/mcp-ecossistema.js, /mcp/<chave>).
// O planejamento entra em vybe_planejamentos com origem 'agente' e estado "revisar": o head revisa,
// manda ao cliente e cadastra as peças pelo painel. Nada aqui manda ao cliente nem cria peça.
// A coluna origem só aceita 'agente' ou 'painel' (migrations/2026-10-20-planejamentos.sql); quem publicou
// fica no histórico (vybe_planejamento_eventos.autor_externo): 'agente' ou 'Claude.ai · <conta>'.
import * as P from './planejamentos.js';
import { nomeDoMes } from './planejamento-documento.js';

export const FORMATO_DO_PLANEJAMENTO = `Formato padrão do planejamento Vybe (o mesmo para todos os clientes; a identidade visual vem do cadastro do cliente no painel):
- resumo: 2 a 4 frases sobre a ideia do mês, para o cliente.
- numeros (opcional): [{rotulo, valor}] — se omitido, o painel conta as peças por formato.
- linhas: [{titulo, texto}] — 2 a 4 linhas de conteúdo do mês.
- datas: [{data:"02/11 · seg", nome, texto}] — datas comerciais/feriados que orientam o mês.
- pecas: [{data:"AAAA-MM-DD", formato: Card|Carrossel|Reels|Fotografia|Vídeo|Stories|Outro, tema, linha, objetivo, telas, legenda, referencia, observacao}].
  - linha: o título de uma das linhas de conteúdo do mês.
  - objetivo: uma frase com o que a peça quer causar.
  - telas: lista com o texto de cada tela (carrossel, card, story), na ordem; uma tela por item, sem "Tela 1:".
  - legenda: a legenda pronta (ou o roteiro, em Reels e Vídeo).
  - referencia: só referência visual ou de vídeo; não repita aqui objetivo nem telas.
  - observacao: a pergunta ou o que o cliente precisa decidir ou mandar.
- observacoes: o que precisa ser combinado com o cliente.
Deixe de fora o que é interno (responsáveis, prazos de produção, pendências do painel).`;

// As duas ferramentas, com o mesmo contrato nos dois conectores.
export const FERRAMENTA_FORMATO = {
 name: 'formato_do_planejamento', title: 'Formato do planejamento do mês',
 description: 'Como o planejamento deve ser estruturado antes de publicar.',
 inputSchema: { type: 'object', properties: {} },
 annotations: { readOnlyHint: true },
};
export const FERRAMENTA_PUBLICAR = {
 name: 'publicar_planejamento', title: 'Publicar o planejamento do mês',
 description: 'Publica (ou atualiza) o planejamento do mês de um cliente no painel, para o head revisar e mandar ao cliente.',
 inputSchema: { type: 'object', required: ['cliente', 'mes', 'conteudo'], properties: {
  cliente: { type: 'string', description: 'Nome do cliente como está no painel' }, mes: { type: 'string', description: 'AAAA-MM' }, titulo: { type: 'string' },
  conteudo: { type: 'object', description: 'resumo, numeros, linhas, datas, pecas, observacoes (veja formato_do_planejamento)' } } },
};

// Grava pela função de sempre e devolve o texto que o chat lê. `por` vai para o histórico (quem publicou);
// `publicar` só muda nos testes (dublê, sem banco).
export async function publicarPlanejamento(sql, args, { por = 'agente', publicar = P.publicarDoAgente } = {}) {
 const p = await publicar(sql, args, { por });
 return `${p.novo ? 'Publicado' : 'Atualizado (versão ' + p.versao + ')'}: ${p.cliente}, ${nomeDoMes(p.mes)}, ${p.conteudo.pecas.length} peças. O head do cliente foi avisado para revisar.`;
}
