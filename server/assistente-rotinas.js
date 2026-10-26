// Rotinas do dia da Vybe AI no WhatsApp (manhã, meio-dia, fim do dia).
// A manhã é o MESMO gerador do painel (vybe-resumo.js, botão "Resumo do dia"), executado
// numa sandbox como nos testes; a equipe, os IDs e a tradução de status das Solicitações
// também vêm dos arquivos do painel. Nada aqui redefine regra de status ou de pessoa.
// Somente leitura: não envia mensagens, não altera banco.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOARD_DEMANDAS, BOARD_PRODUCAO } from './grupos.js';

const raiz = () => process.cwd();
const ler = (arquivo) => readFileSync(join(raiz(), arquivo), 'utf8');
function trecho(texto, inicio, fim) {
  const a = texto.indexOf(inicio), b = texto.indexOf(fim, a + inicio.length);
  if (a < 0 || b < 0) throw new Error('Trecho do painel não encontrado: ' + inicio);
  return texto.slice(a, b);
}

let painel = null;
// Carrega uma vez por instância: gerador, tradução de status e equipe do resumo.
export function codigoDoPainel() {
  if (painel) return painel;
  const ctx = vm.createContext({ BOARD_DEMANDAS_ID: BOARD_DEMANDAS, BOARD_ID: BOARD_PRODUCAO });
  vm.runInContext(ler('vybe-resumo.js'), ctx);
  vm.runInContext(trecho(ler('vybe-demandas.js'), 'function operationalFlowStatus', 'function normalizeContentForOperational'), ctx);
  vm.runInContext(trecho(ler('vybe-config.js'), 'const PESSOAS', '// Quem responde'), ctx);
  // A equipe do resumo mora dentro de buildDailySummary: executa só para capturar a configuração.
  vm.runInContext(trecho(ler('vybe-gestor.js'), 'function buildDailySummary', 'async function selectDailySummary'), ctx);
  const opcoes = vm.runInContext(`(() => { const r = resumosPorGrupo; let o;
    resumosPorGrupo = (itens, dia, op) => { o = op; return []; };
    buildDailySummary('2026-01-01', { conteudos: [], solicitacoes: [] });
    resumosPorGrupo = r; return o; })()`, Object.assign(ctx, {
    DADOS_ALL: [], DADOS: [], DADOS_DEMANDAS: [], panelMode: 'gestor',
    itemNaCarteira: () => true, normalizeRequestForOperational: (x) => x, clientesDoItem: (x) => x,
  }));
  if (!Array.isArray(opcoes?.equipe) || !opcoes.equipe.length) throw new Error('Equipe do resumo não encontrada no painel.');
  painel = { ctx, equipe: JSON.parse(JSON.stringify(opcoes.equipe)) };
  return painel;
}

const somarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const textoData = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');

// Mesmos campos que o painel entrega ao gerador (vybe-core/vybe-demandas), a partir do banco.
export async function itensDoDia(sql, dia) {
  const de = somarDias(dia, -7), ate = somarDias(dia, 3);
  const linhas = await sql`SELECT c.id::text, c.monday_item_id, c.board_id::text, c.titulo, c.formato, c.etapa,
      c.prazo::text AS prazo, c.veiculacao::text AS veiculacao, c.status_em::text AS status_em,
      CASE WHEN c.briefing IS NULL THEN NULL ELSE btrim(c.briefing) <> '' END AS tem_briefing,
      s.rotulo AS status, COALESCE(s.final, false) AS final,
      COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id ORDER BY cl.nome), '{}') AS clientes,
      COALESCE(ARRAY(SELECT p.monday_user_id FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id AND p.monday_user_id IS NOT NULL ORDER BY r.ordem), '{}') AS responsavel_ids,
      COALESCE(ARRAY(SELECT p.nome FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id ORDER BY r.ordem), '{}') AS responsaveis
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND c.board_id IN (${BOARD_PRODUCAO}, ${BOARD_DEMANDAS})
      AND (NOT COALESCE(s.final, false) OR c.veiculacao BETWEEN ${de}::date AND ${ate}::date OR c.prazo BETWEEN ${de}::date AND ${ate}::date)`;
  return linhas.map((l) => {
    const pedido = String(l.board_id) === String(BOARD_DEMANDAS);
    const base = {
      id: l.monday_item_id ? String(l.monday_item_id) : 'vybe:' + l.id, nome: l.titulo || '',
      cliente: l.clientes[0] || '', clientes: l.clientes, status: l.status || '',
      prazo_iso: textoData(l.prazo), responsavel: l.responsaveis.join(', '), responsavel_ids: l.responsavel_ids.map(String),
      formato: l.formato || '', tipo_demanda: l.formato || '', grupo: l.etapa || '',
      tem_briefing: typeof l.tem_briefing === 'boolean' ? l.tem_briefing : null, status_updated_at: l.status_em || '',
      board_id: Number(l.board_id),
    };
    // Solicitações: a "Conclusão" do Monday fica gravada em veiculacao (vybe_dominio_store);
    // o painel usa conclusão (ou prazo) como data operacional, como normalizeRequestForOperational.
    if (pedido) {
      const conclusao = textoData(l.veiculacao);
      return { ...base, origem: 'solicitacao', conclusao_iso: conclusao, veiculacao_iso: conclusao || base.prazo_iso };
    }
    return { ...base, origem: 'producao_conteudo', veiculacao_iso: textoData(l.veiculacao) };
  });
}

const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

// Meio-dia e fim do dia: leitura do mesmo recorte, com os rótulos de status do fluxo do painel.
function retrato(itens, dia, statusDe) {
  const s = (i) => normal(statusDe(i));
  const pedido = (i) => i.origem === 'solicitacao';
  const entregue = (i) => pedido(i) ? ['finalizado', 'feito', 'aprovado', 'concluido'].includes(s(i)) : ['finalizado', 'agendado', 'publicado', 'postado'].includes(s(i));
  const pronto = (i) => !pedido(i) && s(i) === 'para agendar';
  const pausa = (i) => s(i) === 'segurar post';
  const cliente = (i) => ['ag. info cliente', 'ag. aprovacao cliente'].includes(s(i));
  // Mesmo grupo do gerador do painel: esperando informação, redação ou gravação fica fora da cobrança.
  const faltaInfo = (i) => ['aguardo', 'aguardo redacao', 'falta info', 'falta d.a', 'falta off', 'ag. interno'].includes(s(i));
  const aberto = (i) => !entregue(i) && !pronto(i);
  const conteudosHoje = itens.filter((i) => !pedido(i) && i.veiculacao_iso === dia);
  const pedidosHoje = itens.filter((i) => pedido(i) && i.conclusao_iso === dia);
  const atrasadas = itens.filter((i) => aberto(i) && !pausa(i) && !cliente(i) && i.prazo_iso && i.prazo_iso < dia && i.responsavel_ids.length);
  return { s, pedido, entregue, pronto, pausa, cliente, faltaInfo, aberto, conteudosHoje, pedidosHoje, atrasadas };
}
function linhaItem(i) {
  const pessoas = i.responsavel ? i.responsavel.split(',').map(primeiroNome).filter(Boolean).join(', ') : 'sem responsável';
  return `- ${i.nome || 'Sem título'} (${(i.clientes || []).join(' / ') || 'Sem cliente'}) · ${pessoas}`;
}
// Cada bloco dividido por status (pedido do Paulo, 26/10/2026), status com mais itens primeiro;
// dentro do status, o prazo mais antigo primeiro.
function bloco(titulo, lista, statusDe, max = 15) {
  if (!lista.length) return [];
  const porStatus = new Map();
  for (const i of lista) { const s = statusDe(i) || 'Sem status'; if (!porStatus.has(s)) porStatus.set(s, []); porStatus.get(s).push(i); }
  const grupos = [...porStatus.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'pt-BR'));
  const linhas = ['', `*${titulo} (${lista.length})*`];
  let mostrados = 0;
  for (const [status, itens] of grupos) {
    itens.sort((a, b) => String(a.prazo_iso || '9999').localeCompare(String(b.prazo_iso || '9999')) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const cabe = itens.slice(0, Math.max(0, max - mostrados));
    linhas.push(`_${status} (${itens.length})_`, ...cabe.map(linhaItem));
    if (cabe.length < itens.length) linhas.push(`- e mais ${itens.length - cabe.length} em ${status} no painel.`);
    mostrados += cabe.length;
  }
  return linhas;
}

export function mensagemMeioDia(itens, dia, statusDe, rotuloDia) {
  const r = retrato(itens, dia, statusDe);
  const entregues = r.conteudosHoje.filter(r.entregue).length, prontos = r.conteudosHoje.filter(r.pronto).length;
  const risco = r.conteudosHoje.filter((i) => r.aberto(i) && !r.pausa(i));
  const prazoHoje = itens.filter((i) => r.aberto(i) && !r.pausa(i) && i.prazo_iso === dia);
  return [`🕐 *Meio-dia, como estamos? ${rotuloDia}*`, '',
    `📊 Conteúdos que veiculam hoje: ${r.conteudosHoje.length} · ✅ ${entregues} entregues · 📅 ${prontos} para agendar · ⏳ ${risco.length} em aberto`,
    ...bloco('🔴 Veiculam hoje e ainda não saíram', risco.filter((i) => !r.cliente(i)), statusDe),
    ...bloco('🟡 Veiculam hoje, esperando o cliente', risco.filter(r.cliente), statusDe),
    ...bloco('⏰ Prazo da equipe vence hoje', prazoHoje.filter((i) => !r.cliente(i) && !r.faltaInfo(i) && !risco.includes(i)), statusDe),
    ...(prazoHoje.some((i) => r.faltaInfo(i) && !risco.includes(i)) ? ['', `- ⏳ ${prazoHoje.filter((i) => r.faltaInfo(i) && !risco.includes(i)).length} com prazo hoje aguardando informação, redação ou gravação (fora da cobrança).`] : []),
    ...bloco('📌 Solicitações com conclusão hoje em aberto', r.pedidosHoje.filter(r.aberto), statusDe),
    '', `- ⚠️ ${r.atrasadas.length} atividades com prazo vencido, com responsável, fora pausas e espera do cliente.`,
    '', 'Ainda dá tempo, time! Quem travou, avisa aqui. 💪'].join('\n');
}

export function mensagemFimDoDia(itens, dia, statusDe, rotuloDia, rotuloAmanha) {
  const r = retrato(itens, dia, statusDe);
  const total = r.conteudosHoje.length, feitos = r.conteudosHoje.filter(r.entregue).length;
  const pct = total ? Math.round((feitos * 100) / total) : 0;
  const naoSairam = r.conteudosHoje.filter((i) => !r.entregue(i) && !r.pronto(i) && !r.pausa(i));
  const amanha = somarDias(dia, 1), deAmanha = itens.filter((i) => !r.pedido(i) && i.veiculacao_iso === amanha);
  return [`🌙 *Fechamento de ${rotuloDia}*`, '',
    `📊 ${pct}% dos conteúdos de hoje entregues: ${feitos} de ${total}${pct >= 90 && total ? ' 🎉' : ''}`,
    `- 📅 ${r.conteudosHoje.filter(r.pronto).length} ficaram para agendar · ⏸️ ${r.conteudosHoje.filter(r.pausa).length} segurados`,
    ...bloco('🔴 Não saíram hoje', naoSairam, statusDe),
    ...bloco('📌 Solicitações de hoje que não concluíram', r.pedidosHoje.filter(r.aberto), statusDe),
    '', `- ⚠️ ${r.atrasadas.length} atividades seguem com prazo vencido.`,
    `- 🔭 Amanhã (${rotuloAmanha}): ${deAmanha.length} conteúdos · ${deAmanha.filter(r.entregue).length} já entregues · ${deAmanha.filter(r.pronto).length} para agendar · ${deAmanha.filter(r.aberto).length} em aberto.`,
    '', 'Valeu, time! Amanhã a gente fecha o que ficou. 🚀'].join('\n');
}

const MOMENTOS = ['manha', 'meio_dia', 'fim_dia'];
// Monta as mensagens da rotina; baseAnterior é a lista da manhã anterior guardada pelo bot.
export async function rotinaDoDia(sql, { momento, dia, baseAnterior = null }, agoraIso = new Date().toISOString()) {
  if (!MOMENTOS.includes(momento)) throw new TypeError('Momento inválido.');
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  if (baseAnterior !== null && (typeof baseAnterior !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(baseAnterior.data || '') || !Array.isArray(baseAnterior.itens) || baseAnterior.itens.length > 2000 || baseAnterior.itens.some((x) => typeof x?.id !== 'string' || x.id.length > 64)))
    throw new TypeError('Base anterior inválida.');
  const { ctx, equipe } = codigoDoPainel();
  const itens = await itensDoDia(sql, dia);
  const statusDe = (i) => ctx.operationalFlowStatus(i);
  const rotulo = (iso) => ctx.resumoDiaCurto(iso);
  let mensagens;
  if (momento === 'manha') {
    ctx.__itens = itens; ctx.__dia = dia; ctx.__opcoes = { statusDe, clientesDe: (i) => i.clientes, equipe, baseAnterior, geradoEm: agoraIso };
    mensagens = JSON.parse(JSON.stringify(vm.runInContext('resumosPorGrupo(__itens, __dia, __opcoes)', ctx)));
  } else if (momento === 'meio_dia') {
    mensagens = [{ id: 'geral', nome: 'Geral', texto: mensagemMeioDia(itens, dia, statusDe, rotulo(dia)) }];
  } else {
    mensagens = [{ id: 'geral', nome: 'Geral', texto: mensagemFimDoDia(itens, dia, statusDe, rotulo(dia), rotulo(somarDias(dia, 1))) }];
  }
  // A base da manhã (conteúdos que veiculam hoje) volta para o bot guardar e mandar amanhã.
  const base = momento === 'manha' ? { data: dia, itens: itens.filter((i) => i.origem !== 'solicitacao' && i.veiculacao_iso === dia).map((i) => ({ id: i.id })) } : null;
  // Apelidos usados no texto do gerador (ex.: "Bia", e "Tai" fixo em "Bom dia, Tai!") → ID do Monday, para o bot marcar com @.
  const pessoasPainel = vm.runInContext('PESSOAS', ctx);
  const apelidos = [...equipe.map((p) => ({ nome: p.nome, id: String(p.id) })), ...(pessoasPainel.TAINARA ? [{ nome: 'Tai', id: String(pessoasPainel.TAINARA) }] : [])];
  return { momento, dia, mensagens: mensagens.filter((m) => !m.agenda || m.texto), base,
    equipe: equipe.map((p) => ({ id: String(p.id), nome: p.nome })), apelidos, fontes: [{ modulo: 'rotina', id: dia.replace(/-/g, '') }] };
}

// Dia da agência sob demanda ("como tá o dia?"): o mesmo recorte e as mesmas regras de status da rotina,
// com o resumo da agência e uma visão por pessoa (Paulo, 26/10/2026: "dividido por cliente ou pessoa").
export function mensagemDiaAgencia(itens, dia, statusDe, rotuloDia, maxPorPessoa = 4) {
  const r = retrato(itens, dia, statusDe);
  const entregues = r.conteudosHoje.filter(r.entregue).length, prontos = r.conteudosHoje.filter(r.pronto).length;
  const risco = r.conteudosHoje.filter((i) => r.aberto(i) && !r.pausa(i));
  const pedidosAbertos = r.pedidosHoje.filter(r.aberto).length;
  // Do dia: veicula/conclui hoje ou tem prazo hoje.
  const doDia = itens.filter((i) => i.veiculacao_iso === dia || i.prazo_iso === dia);
  const pessoas = new Map();
  const daPessoa = (n) => { if (!pessoas.has(n)) pessoas.set(n, { prontas: 0, abertas: [], atrasadas: 0 }); return pessoas.get(n); };
  const nomes = (i) => (i.responsavel ? i.responsavel.split(',').map(primeiroNome).filter(Boolean) : []);
  for (const i of doDia) for (const n of new Set(nomes(i))) {
    const p = daPessoa(n);
    if (r.entregue(i) || r.pronto(i)) p.prontas++; else if (!r.pausa(i)) p.abertas.push(i);
  }
  for (const i of r.atrasadas) for (const n of new Set(nomes(i))) daPessoa(n).atrasadas++;
  const linhasPessoa = [...pessoas.entries()].filter(([, p]) => p.prontas || p.abertas.length || p.atrasadas)
    .sort((a, b) => b[1].abertas.length - a[1].abertas.length || b[1].atrasadas - a[1].atrasadas || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([n, p]) => {
      const resumo = [p.prontas && `✅ ${p.prontas}`, p.abertas.length && `⏳ ${p.abertas.length} em aberto`, p.atrasadas && `🔴 ${p.atrasadas} atrasada(s)`].filter(Boolean).join(' · ');
      p.abertas.sort((a, b) => String(a.prazo_iso || '9999').localeCompare(String(b.prazo_iso || '9999')));
      const lista = p.abertas.slice(0, maxPorPessoa).map((i) => `- ${i.nome || 'Sem título'} (${(i.clientes || []).join(' / ') || 'Sem cliente'}) · ${statusDe(i) || 'Sem status'}`);
      if (p.abertas.length > maxPorPessoa) lista.push(`- e mais ${p.abertas.length - maxPorPessoa} no painel`);
      return [`*${n}* — ${resumo}`, ...lista].join('\n');
    });
  return [`🏢 *Dia da agência · ${rotuloDia}*`, '',
    `📊 Veiculam hoje: ${r.conteudosHoje.length} · ✅ ${entregues} entregues · 📅 ${prontos} para agendar · ⏳ ${risco.length} em aberto`,
    `📌 Solicitações com conclusão hoje: ${r.pedidosHoje.length}${r.pedidosHoje.length ? ` · ${pedidosAbertos} em aberto` : ''}`,
    `⚠️ ${r.atrasadas.length} atividade(s) com prazo vencido, fora pausas e espera do cliente`,
    '', '*Por pessoa, hoje*', linhasPessoa.length ? linhasPessoa.join('\n\n') : '- Nada previsto para hoje.'].join('\n');
}
export async function diaDaAgencia(sql, dia) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new TypeError('Dia inválido.');
  const { ctx } = codigoDoPainel();
  const itens = await itensDoDia(sql, dia);
  return { texto: mensagemDiaAgencia(itens, dia, (i) => ctx.operationalFlowStatus(i), ctx.resumoDiaCurto(dia)), fontes: [{ modulo: 'dia_agencia', id: dia.replace(/-/g, '') }] };
}
