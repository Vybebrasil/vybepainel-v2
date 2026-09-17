// vybe-resumo.js — o Resumo do dia para o grupo de Criação no WhatsApp.
//
// A mensagem separava por área (Audiovisual, Design) e por pessoa, e o status
// vinha escondido no meio da linha. Quem lia no grupo não conseguia responder o
// que importa de manhã: o que ainda falta executar, o que precisa de alteração,
// o que está travado, o que já dá para postar e o que já foi ao ar. Agora a
// mensagem é dividida por ETAPA, na ordem de quem precisa agir primeiro, e
// termina com o que ficou atrasado de dias anteriores.
//
// A montagem do texto mora aqui, sem tela: recebe as peças e duas funções (a
// data de referência e o status de fluxo de cada peça), e o teste confere a
// mensagem inteira.

const RESUMO_ETAPAS = [
  { chave: 'alterar', titulo: 'ALTERAR', emoji: '⚠️', status: ['alteração'] },
  { chave: 'travado', titulo: 'TRAVADO — FALTA INFORMAÇÃO', emoji: '⛔',
    status: ['falta info', 'aguardo', 'falta d.a', 'falta off', 'aguardo redação', 'ag. interno',
      'segurar post', 'ag. info cliente'] },
  { chave: 'executar', titulo: 'EXECUTAR HOJE', emoji: '▶️',
    status: ['em andamento', 'a fazer', 'pode fazer', 'cap. agendada', 'agendando cap'] },
  { chave: 'aprovacao', titulo: 'AGUARDANDO APROVAÇÃO', emoji: '👀',
    status: ['para aprovação', 'ag. aprovação cliente', 'em aprovação'] },
  { chave: 'postar', titulo: 'PRONTO PARA POSTAR', emoji: '📲', status: ['para agendar'] },
  { chave: 'agendado', titulo: 'AGENDADO', emoji: '🗓️', status: ['agendado'] },
  // Em Solicitações, "Aprovado" é entrega concluída: não há post, mas a peça saiu.
  { chave: 'postado', titulo: 'JÁ POSTADO / CONCLUÍDO', emoji: '✅',
    status: ['finalizado', 'feito', 'concluído', 'concluido', 'aprovado'] },
];
// Atrasada é o que não saiu: agendado e concluído já cumpriram a data.
const RESUMO_NAO_ATRASA = new Set(['agendado', 'finalizado', 'feito', 'concluído', 'concluido', 'aprovado']);
const RESUMO_JANELA_DE_ATRASO_DIAS = 30;
const RESUMO_LIMITE_DE_ATRASADAS = 15;

function resumoTexto(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }

function resumoDiaCurto(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function resumoDiasAntes(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "Jady Amynne Oliveira Lima, Vinícius Damascena" vira "Jady, Vinícius": no
// grupo todo mundo se conhece pelo primeiro nome, e a linha cabe no celular.
function resumoPessoas(responsavel) {
  const nomes = resumoTexto(responsavel).split(',').map((n) => n.trim().split(' ')[0]).filter(Boolean);
  return nomes.length ? nomes.join(', ') : 'sem responsável';
}

function resumoLinha(item, { dia = '' } = {}) {
  const nome = resumoTexto(item.nome) || 'Sem título';
  const formato = resumoTexto(item.formato);
  // "Reels - Visita Pablo (Reels)" repetia o formato que já está no nome.
  const mostraFormato = formato && formato !== '—'
    && !nome.toLocaleLowerCase('pt-BR').startsWith(formato.toLocaleLowerCase('pt-BR'));
  const cliente = resumoTexto(item.cliente) || 'Sem cliente';
  const motivo = resumoTexto(item.status_context?.reason);
  return `• ${dia ? `${dia} — ` : ''}${cliente} — ${nome}${mostraFormato ? ` (${formato})` : ''} · ${resumoPessoas(item.responsavel)}`
    + (motivo ? ` — motivo: ${motivo}` : '');
}

function resumoDoDiaTexto(itens, dayIso, { referencia = 'Veiculação', dataDe, statusDe }) {
  const status = (item) => resumoTexto(statusDe(item)).toLocaleLowerCase('pt-BR');
  const ordenar = (a, b) => resumoTexto(a.cliente).localeCompare(resumoTexto(b.cliente), 'pt-BR')
    || resumoTexto(a.nome).localeCompare(resumoTexto(b.nome), 'pt-BR');
  const doDia = itens.filter((item) => dataDe(item) === dayIso);
  const linhas = [
    `*RESUMO DE CRIAÇÃO — ${resumoDiaCurto(dayIso)}*`,
    `_${doDia.length} peça${doDia.length === 1 ? '' : 's'} com ${referencia.toLocaleLowerCase('pt-BR')} neste dia_`,
  ];

  const conhecidos = new Set(RESUMO_ETAPAS.flatMap((e) => e.status));
  for (const etapa of RESUMO_ETAPAS) {
    const pecas = doDia.filter((item) => etapa.status.includes(status(item))).sort(ordenar);
    if (!pecas.length) continue;
    // O emoji fica fora dos asteriscos: colado neles, o WhatsApp pode não aplicar o negrito.
    linhas.push('', `${etapa.emoji} *${etapa.titulo} (${pecas.length})*`);
    if (etapa.chave === 'executar') {
      const andando = pecas.filter((item) => status(item) === 'em andamento');
      const aComecar = pecas.filter((item) => status(item) !== 'em andamento');
      if (andando.length) linhas.push('Em andamento:', ...andando.map((i) => resumoLinha(i)));
      if (aComecar.length) linhas.push('A começar:', ...aComecar.map((i) => resumoLinha(i)));
    } else {
      linhas.push(...pecas.map((i) => resumoLinha(i)));
    }
  }
  // Status fora do mapa não some da mensagem: aparece com o nome dele.
  const outros = doDia.filter((item) => !conhecidos.has(status(item))).sort(ordenar);
  if (outros.length) {
    linhas.push('', `*OUTROS STATUS (${outros.length})*`,
      ...outros.map((i) => `${resumoLinha(i)} — ${resumoTexto(statusDe(i)) || 'sem status'}`));
  }
  if (!doDia.length) linhas.push('', 'Nenhuma peça com data neste dia.');

  const desde = resumoDiasAntes(dayIso, RESUMO_JANELA_DE_ATRASO_DIAS);
  const atrasadas = itens.filter((item) => {
    const data = dataDe(item);
    return data && data < dayIso && data >= desde && !RESUMO_NAO_ATRASA.has(status(item));
  }).sort((a, b) => String(dataDe(a)).localeCompare(String(dataDe(b))) || ordenar(a, b));
  if (atrasadas.length) {
    linhas.push('', `🔥 *ATRASADAS DE DIAS ANTERIORES (${atrasadas.length})*`,
      ...atrasadas.slice(0, RESUMO_LIMITE_DE_ATRASADAS).map((i) => resumoLinha(i, { dia: resumoDiaCurto(dataDe(i)) })));
    if (atrasadas.length > RESUMO_LIMITE_DE_ATRASADAS) {
      linhas.push(`_+ ${atrasadas.length - RESUMO_LIMITE_DE_ATRASADAS} outras no painel_`);
    }
  }
  return linhas.join('\n');
}
