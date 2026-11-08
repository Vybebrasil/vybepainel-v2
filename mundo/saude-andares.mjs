// Prédio vivo: a saúde de cada andar, na escala de urgência do padrão visual
// (docs/padrao-visual.md, item 3). Função pura: recebe o que o painel já sabe e
// devolve, por andar, o nível (1 crítico … 6 andando), a cor da faixa de luz e
// o motivo numa frase (aparece ao passar o mouse no andar).
//
// Regras iniciais (Paulo, 07/11/2026):
// - Criação (Produção/Criação, 2º andar): âmbar com demanda atrasada; vermelho com mais de 5.
// - Comercial (1º andar, onde fica o Atendimento): âmbar com peça parada em aprovação há mais
//   de 3 dias; vermelho com peça parada há mais de 7 dias. Junta o que `VybeComercial.dados()`
//   disser, quando existir.
// - Financeiro (3º andar): o que `VybeCarteira.dados()` disser, quando existir; sem leitura, neutro.
// Os outros andares não entram aqui (seguem a regra dos agentes, em vybe-mundo.js).

export const URGENCIA = {
  1: { nome: 'Crítico', cor: '#D93D42' },
  2: { nome: 'Alto', cor: '#E8A317' },
  3: { nome: 'Bloqueio', cor: '#B45FC4' },
  4: { nome: 'Espera', cor: '#3B6FD4' },
  5: { nome: 'Neutro', cor: '#9AA3A8' },
  6: { nome: 'Andando', cor: '#18A957' },
};
export const ANDARES_COM_SAUDE = ['criacao', 'comercial', 'financeiro'];

const DIA = 86400000;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const estado = (nivel, motivo) => ({ nivel, cor: URGENCIA[nivel].cor, motivo });
const maisUrgente = (...lista) => lista.filter(Boolean).reduce((a, b) => (b.nivel < a.nivel ? b : a));

// Mesma leitura de situacaoDaPeca (vybe-mundo.js) para quando ela não é passada.
function situacaoPadrao(item, hoje) {
  const st = String(item?.status || '');
  if (/finalizad|feito|conclu|publicad|postad/i.test(st)) return 'concluida';
  const veic = String(item?.veiculacao_iso || ''), prazo = String(item?.prazo_iso || '');
  if ((veic && veic < hoje) || item?.prazo_atrasado || (prazo && prazo < hoje)) return 'atrasada';
  return 'aberta';
}

// "Para Aprovação", "Em aprovação", "Ag. aprovação cliente"… (não "Aprovado").
export const EM_APROVACAO = /aprova[cç]/i;
function diasParado(item, hoje) {
  const desde = Date.parse(String(item?.status_updated_at || item?.status_desde || '').slice(0, 10) + 'T00:00:00Z');
  const ref = Date.parse(hoje + 'T00:00:00Z');
  return Number.isFinite(desde) && Number.isFinite(ref) ? Math.floor((ref - desde) / DIA) : null;
}

// Leitura de um módulo irmão (VybeComercial / VybeCarteira) que ainda pode não existir.
// Aceita { nivel, motivo } (ou { saude: { nivel, motivo } }) ou contadores conhecidos
// (vencidos, inadimplentes, atrasados, parados, semRetorno: número ou lista).
const CONTADORES = [['vencidos', 'cobrança vencida', 'cobranças vencidas'], ['inadimplentes', 'cliente inadimplente', 'clientes inadimplentes'],
  ['atrasados', 'item atrasado', 'itens atrasados'], ['parados', 'negócio parado', 'negócios parados'], ['semRetorno', 'contato sem retorno', 'contatos sem retorno']];
export function lerModulo(dados, rotulo) {
  if (!dados || typeof dados !== 'object') return estado(5, `Sem leitura do ${rotulo} ainda.`);
  const s = dados.saude && typeof dados.saude === 'object' ? dados.saude : dados;
  const n = Number(s.nivel);
  if (Number.isInteger(n) && URGENCIA[n]) return estado(n, String(s.motivo || `${rotulo}: ${URGENCIA[n].nome.toLowerCase()}.`));
  for (const [chave, um, varios] of CONTADORES) {
    if (!(chave in dados)) continue;
    const q = Array.isArray(dados[chave]) ? dados[chave].length : Number(dados[chave]) || 0;
    if (q > 5) return estado(1, `${plural(q, um, varios)} no ${rotulo}.`);
    if (q > 0) return estado(2, `${plural(q, um, varios)} no ${rotulo}.`);
    return estado(6, `Nada pendente no ${rotulo}.`);
  }
  return estado(5, `O ${rotulo} ainda não diz como está.`);
}

/**
 * @param {object} p
 * @param {Array} p.itens peças/demandas do painel (sem repetição)
 * @param {string} p.hoje AAAA-MM-DD
 * @param {Function} [p.situacao] (item, hoje) → 'atrasada' | 'concluida' | …
 * @param {object} [p.comercial] window.VybeComercial?.dados?.()
 * @param {object} [p.carteira] window.VybeCarteira?.dados?.()
 * @param {object} [p.agentes] { [andarId]: ['falhou', 'aguardando_aprovacao', …] }
 * @returns {{ [andarId]: { nivel: number, cor: string, motivo: string } }}
 */
export function saudeDosAndares({ itens = [], hoje, situacao = situacaoPadrao, comercial = null, carteira = null, agentes = {} } = {}) {
  const vistos = new Set();
  const abertas = [];
  for (const i of itens || []) {
    const id = i?.id ?? i;
    if (vistos.has(id)) continue; vistos.add(id);
    if (situacao(i, hoje) !== 'concluida') abertas.push(i);
  }
  const doAgente = (andar) => {
    const e = agentes?.[andar] || [];
    if (e.includes('falhou')) return estado(1, 'Um agente do andar falhou na última tarefa.');
    const q = e.filter((x) => x === 'aguardando_aprovacao').length;
    return q ? estado(4, `${plural(q, 'proposta do agente espera', 'propostas dos agentes esperam')} aprovação.`) : null;
  };

  // Criação: demandas atrasadas.
  const atrasadas = abertas.filter((i) => situacao(i, hoje) === 'atrasada').length;
  const criacao = !itens?.length ? estado(5, 'Sem demandas carregadas no painel.')
    : atrasadas > 5 ? estado(1, `${atrasadas} demandas atrasadas: mais de 5.`)
    : atrasadas ? estado(2, `${plural(atrasadas, 'demanda atrasada', 'demandas atrasadas')}.`)
    : estado(6, 'Nenhuma demanda atrasada.');

  // Atendimento: peças paradas em aprovação.
  const emAprovacao = abertas.filter((i) => EM_APROVACAO.test(String(i?.status || ''))).map((i) => diasParado(i, hoje));
  const paradas = emAprovacao.filter((d) => d != null), semData = emAprovacao.length - paradas.length;
  const mais7 = paradas.filter((d) => d > 7).length, mais3 = paradas.filter((d) => d > 3).length;
  const atendimento = !itens?.length ? estado(5, 'Sem peças carregadas no painel.')
    : mais7 ? estado(1, `${plural(mais7, 'peça parada', 'peças paradas')} em aprovação há mais de 7 dias.`)
    : mais3 ? estado(2, `${plural(mais3, 'peça parada', 'peças paradas')} em aprovação há mais de 3 dias.`)
    : paradas.length ? estado(6, `${plural(paradas.length, 'peça', 'peças')} em aprovação, todas há 3 dias ou menos.`)
    // Sem a data da troca de status não dá para medir o tempo parado: neutro, e diz por quê.
    : semData ? estado(5, `${plural(semData, 'peça', 'peças')} em aprovação sem a data em que ${semData === 1 ? 'entrou' : 'entraram'}.`)
    : estado(6, 'Nenhuma peça parada em aprovação.');
  // O Comercial só pesa quando o módulo existe; sem ele, o andar fica com o Atendimento.
  const comercialMod = comercial ? lerModulo(comercial, 'Comercial') : null;

  return {
    criacao: maisUrgente(criacao, doAgente('criacao')),
    comercial: maisUrgente(atendimento, comercialMod, doAgente('comercial')),
    financeiro: maisUrgente(lerModulo(carteira, 'Financeiro'), doAgente('financeiro')),
  };
}
