// Pacote de produção (Paulo, 10/11/2026: "como esse fluxo fica redondo? pra os nossos bots assumirem esse tipo de
// operação?"). Um chat do Claude terminou o roteiro de uma diária de captação (FAQ da Antonov) e parou: o conector só lia
// e registrava, não criava peça, não marcava captação e não falava com o grupo. Daí o chat foi pelo navegador e apagou
// sem querer um briefing.
//
// O caminho agora:
// 1. O chat entrega o pacote (peças, documento/roteiro, captação sugerida) pela ferramenta propor_pacote_producao
//    (server/mcp-ecossistema.js). Nada é criado: o pacote fica "proposto".
// 2. O VYBES (bot) lê os pacotes propostos (consulta 'pacotes'), avisa o grupo Produção com o resumo e o link do
//    documento e marca "avisado" (consulta 'pacote_avisado').
// 3. Um dos donos responde "ok pacote N" (consulta 'pacote_executar'): aqui as peças nascem em Produção pelas mesmas
//    ações do WhatsApp (assistente-acoes.js, criar), com "Agendar Captação", o documento no briefing e ligadas ao
//    roteiro; a captação sugerida vai para a agenda. "recusa pacote N" descarta.
// A partir daí seguem as automações de sempre (Heitor, Ademir, Reriston, aprovação).
import { prepararAcao, confirmarAcao } from './assistente-acoes.js';
import { ehDonoPessoa, ehAmploPessoa, mondayDaPessoa } from './donos.js';
import { incluirRoteiro, ligar, docDoLink } from './roteiros.js';

const MAX_PECAS = 20;
const prontas = new WeakSet();
export async function garantirTabelaPacotes(db) {
  if (prontas.has(db)) return;
  await db`CREATE TABLE IF NOT EXISTS vybe_pacotes_producao (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    titulo TEXT NOT NULL,
    documento TEXT,
    pecas JSONB NOT NULL DEFAULT '[]',
    captacao JSONB,
    recado TEXT,
    origem TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'proposto',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    avisado_em TIMESTAMPTZ,
    decidido_por BIGINT,
    decidido_em TIMESTAMPTZ,
    resultado JSONB
  )`;
  await db`CREATE INDEX IF NOT EXISTS vybe_pacotes_producao_estado ON vybe_pacotes_producao (estado, criado_em)`;
  prontas.add(db);
}

const publica = (msg) => Object.assign(new Error(msg), { publica: true });
const texto = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const DATA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const hojeBahia = (agora = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date(agora));
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const dataCurta = (iso) => `${DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// O que o chat mandou → pacote conferido. Erro de uso volta com a frase para o chat corrigir.
export function validarPacote(a = {}, { agora = Date.now() } = {}) {
  const hoje = hojeBahia(agora);
  const titulo = texto(a.titulo, 200);
  if (titulo.length < 3) throw publica('Dê um título ao pacote (ex.: "Diária Tira-dúvidas (FAQ)").');
  const documento = texto(a.documento, 500);
  if (documento && !/^https:\/\/\S+$/.test(documento)) throw publica('O documento precisa ser um link https (Google Docs ou Drive).');
  const lista = Array.isArray(a.pecas) ? a.pecas : [];
  if (!lista.length || lista.length > MAX_PECAS) throw publica(`Mande de 1 a ${MAX_PECAS} peças.`);
  const pecas = lista.map((p, i) => {
    const n = i + 1, t = texto(p?.titulo, 140), formato = texto(p?.formato, 40) || 'Reels', veiculacao = texto(p?.veiculacao, 10), prazo = texto(p?.prazo, 10);
    if (t.length < 3) throw publica(`Peça ${n}: falta o título (3 letras ou mais).`);
    if (!DATA.test(veiculacao) || veiculacao < hoje) throw publica(`Peça ${n} (${t}): a veiculação precisa ser AAAA-MM-DD, de hoje em diante.`);
    if (prazo && (!DATA.test(prazo) || prazo > veiculacao || prazo < hoje)) throw publica(`Peça ${n} (${t}): o prazo precisa ser AAAA-MM-DD, entre hoje e a veiculação.`);
    return { titulo: t, formato, veiculacao, ...(prazo ? { prazo } : {}), briefing: texto(p?.briefing, 2500) };
  });
  let captacao = null;
  if (a.captacao && typeof a.captacao === 'object') {
    const c = a.captacao, dia = texto(c.dia, 10), inicio = texto(c.inicio, 5), fim = texto(c.fim, 5);
    if (!DATA.test(dia) || dia < hoje) throw publica('Captação: o dia precisa ser AAAA-MM-DD, de hoje em diante.');
    if (!HORA.test(inicio) || !HORA.test(fim) || fim <= inicio) throw publica('Captação: diga início e fim em HH:MM (o fim depois do início).');
    captacao = { dia, inicio, fim, local: texto(c.local, 200), obs: texto(c.obs, 500) };
  }
  return { titulo, documento, pecas, captacao, recado: texto(a.recado, 1500) };
}

export async function proporPacote(db, clienteId, args, { origem = 'chat', agora } = {}) {
  await garantirTabelaPacotes(db);
  const p = validarPacote(args, { agora });
  const [r] = await db`INSERT INTO vybe_pacotes_producao (cliente_id, titulo, documento, pecas, captacao, recado, origem)
    VALUES (${Number(clienteId)}, ${p.titulo}, ${p.documento || null}, ${JSON.stringify(p.pecas)}::jsonb, ${p.captacao ? JSON.stringify(p.captacao) : null}::jsonb, ${p.recado || null}, ${String(origem).slice(0, 80)})
    RETURNING id::text AS id`;
  return { id: r.id, ...p };
}

const json = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
function linha(row) {
  return { id: String(row.id), cliente_id: String(row.cliente_id), cliente: row.cliente || '', titulo: row.titulo, documento: row.documento || '',
    pecas: json(row.pecas) || [], captacao: json(row.captacao) || null, recado: row.recado || '', estado: row.estado, origem: row.origem };
}

// A mensagem do grupo Produção. O VYBES manda como está (sem montar nada no bot).
export function textoDoPacote(p) {
  const ordenadas = [...p.pecas].sort((a, b) => a.veiculacao.localeCompare(b.veiculacao));
  const cap = p.captacao;
  return `📦 *Pacote de produção #${p.id}* · *${p.cliente}*\n*${p.titulo}*\n`
    + (p.documento ? `📄 Documento: ${p.documento}\n` : '')
    + (cap ? `🎬 Captação sugerida: ${dataCurta(cap.dia)}, das ${cap.inicio} às ${cap.fim}${cap.local ? ` · ${cap.local}` : ''} _(a confirmar com o cliente)_\n` : '')
    + `\n🗓️ ${ordenadas.length} peça${ordenadas.length > 1 ? 's' : ''}:\n`
    + ordenadas.map((x) => `• ${dataCurta(x.veiculacao)} · ${x.formato} - ${x.titulo}`).join('\n')
    + (p.recado ? `\n\n⚠️ *Antes da captação:* ${p.recado}` : '')
    + `\n\n👉 Um dos donos responde *ok pacote ${p.id}* e eu cadastro tudo em Produção (Agendar Captação, com o documento no briefing e ligado ao roteiro)${cap ? ' e marco a captação sugerida na agenda' : ''}. *recusa pacote ${p.id}* descarta.\n\n_— VYBES_`;
}

// Os pacotes que o VYBES ainda não levou ao grupo (os mais velhos primeiro).
export async function pacotesParaAvisar(db) {
  await garantirTabelaPacotes(db);
  const rows = await db`SELECT p.*, c.nome AS cliente FROM vybe_pacotes_producao p JOIN vybe_clientes c ON c.id = p.cliente_id
    WHERE p.estado = 'proposto' ORDER BY p.criado_em LIMIT 5`;
  return rows.map(linha).map((p) => ({ ...p, texto: textoDoPacote(p) }));
}
export async function marcarAvisado(db, id) {
  await garantirTabelaPacotes(db);
  const r = await db`UPDATE vybe_pacotes_producao SET estado = 'avisado', avisado_em = NOW() WHERE id = ${Number(id)} AND estado = 'proposto' RETURNING id`;
  return { avisado: r.length > 0 };
}

async function exigirDono(db, pessoaId, config) {
  // Pacote de produção é produção, não dinheiro: os donos e a coordenação (Paulo, 13/11/2026).
  const dono = ehAmploPessoa({ id: pessoaId, monday_user_id: await mondayDaPessoa(db, pessoaId) }, config);
  if (!dono) throw publica('Só os donos e a coordenação aprovam pacote de produção.');
}
const ESTADO_FALADO = { executando: 'já está sendo cadastrado', executado: 'já foi cadastrado', recusado: 'foi recusado', falhou: 'já foi tentado e falhou (confira o painel)' };
async function pegarParaDecidir(db, id, pessoaId, novoEstado) {
  const [p] = await db`UPDATE vybe_pacotes_producao SET estado = ${novoEstado}, decidido_por = ${Number(pessoaId)}, decidido_em = NOW()
    WHERE id = ${Number(id)} AND estado IN ('proposto', 'avisado') RETURNING *`;
  if (p) return p;
  const [ja] = await db`SELECT estado FROM vybe_pacotes_producao WHERE id = ${Number(id)}`;
  throw publica(ja ? `O pacote #${id} ${ESTADO_FALADO[ja.estado] || 'não está esperando aprovação'}.` : `Não achei o pacote #${id}.`);
}

export async function recusarPacote(db, pessoaId, id, { config = process.env } = {}) {
  await garantirTabelaPacotes(db);
  await exigirDono(db, pessoaId, config);
  await pegarParaDecidir(db, id, pessoaId, 'recusado');
  return { texto: `🗑️ Pacote #${id} descartado. Nada foi cadastrado.` };
}

// "ok pacote N" de um dono: cria as peças (cada uma pela ação "criar" do WhatsApp, com a permissão de quem aprovou),
// liga ao roteiro e marca a captação. Uma peça que falha não desfaz as outras; o resumo diz o que entrou e o que não.
export async function executarPacote(db, pessoaId, id, segredo, { config = process.env, agora = Date.now(), executar, lerDoc } = {}) {
  await garantirTabelaPacotes(db);
  await exigirDono(db, pessoaId, config);
  const row = await pegarParaDecidir(db, id, pessoaId, 'executando');
  const [cli] = await db`SELECT nome FROM vybe_clientes WHERE id = ${Number(row.cliente_id)}`;
  const p = linha({ ...row, cliente: cli?.nome || '' });
  // "Agendar Captação" se existir na lista de captação do quadro (a peça espera a captação; "Captação Agendada" é que
  // chama o captador, e isso só depois que o cliente confirmar a data).
  let captacaoDaPeca = null;
  try {
    const ops = await db`SELECT rotulo FROM vybe_captacao`;
    captacaoDaPeca = ops.map((o) => o.rotulo).find((r) => /^agendar\s+capta/i.test(String(r).normalize('NFD').replace(/[̀-ͯ]/g, ''))) || null;
  } catch { /* sem a lista: a peça nasce sem captação */ }
  const cap = p.captacao;
  const criadas = [], falhas = [];
  for (const x of p.pecas) {
    const briefing = [x.briefing, p.documento ? `📄 Roteiro/documento: ${p.documento}` : '',
      cap ? `🎬 Captação sugerida: ${dataCurta(cap.dia)}, das ${cap.inicio} às ${cap.fim}${cap.local ? ` · ${cap.local}` : ''} (a confirmar com o cliente)` : '',
      `📦 Pacote de produção #${p.id}: ${p.titulo}`].filter(Boolean).join('\n\n').slice(0, 3000);
    try {
      const prep = await prepararAcao(db, pessoaId, { acao: 'criar', formato: x.formato, cliente: p.cliente, titulo: x.titulo, veiculacao: x.veiculacao,
        ...(x.prazo ? { prazo: x.prazo } : {}), ...(captacaoDaPeca ? { captacao: captacaoDaPeca } : {}), briefing }, segredo, agora);
      const feito = await confirmarAcao(db, pessoaId, prep.codigo, segredo, { agora, executar });
      criadas.push({ titulo: `${x.formato} - ${x.titulo}`, veiculacao: x.veiculacao, conteudo_id: feito.conteudo_id || null, link: feito.link || null });
    } catch (e) {
      falhas.push({ titulo: `${x.formato} - ${x.titulo}`, erro: String(e?.message || e).slice(0, 200) });
    }
  }
  // Roteiro: o documento entra na biblioteca de roteiros (ou já estava) e as peças criadas ficam ligadas a ele.
  let roteiro = null;
  const quem = { tipo: 'sessao', pessoa: { id: Number(pessoaId) } };
  if (p.documento && docDoLink(p.documento) && criadas.some((c) => c.conteudo_id)) {
    try {
      let rid = null;
      try { rid = (await incluirRoteiro(db, quem, { link: p.documento, titulo: `${p.titulo} · ${p.cliente}`.slice(0, 300), cliente_id: String(p.cliente_id) }, lerDoc ? { ler: lerDoc } : undefined)).id; }
      catch (e) { if (e?.status !== 409) throw e; }
      if (!rid) {
        const [ja] = await db`SELECT id::text AS id FROM vybe_roteiros WHERE doc_id = ${docDoLink(p.documento)} AND removido_em IS NULL`;
        rid = ja?.id || null;
      }
      if (!rid) throw new Error('o roteiro não entrou na biblioteca');
      let ligadas = 0;
      for (const c of criadas) if (c.conteudo_id) { await ligar(db, quem, { roteiro_id: rid, conteudo_id: String(c.conteudo_id) }); ligadas++; }
      roteiro = { id: rid, ligadas };
    } catch (e) { roteiro = { erro: String(e?.message || e).slice(0, 200) }; }
  }
  // Captação sugerida na agenda (o captador recebe o lembrete; o card só vai para ele quando virar "Captação Agendada").
  let agenda = null;
  if (cap) {
    try {
      const prep = await prepararAcao(db, pessoaId, { acao: 'agendar_captacao', encaixe: `${cap.dia}|${p.cliente_id}@${cap.inicio}-${cap.fim}` }, segredo, agora);
      await confirmarAcao(db, pessoaId, prep.codigo, segredo, { agora, executar });
      agenda = { ok: true };
    } catch (e) { agenda = { erro: String(e?.message || e).slice(0, 200) }; }
  }
  const estado = criadas.length ? 'executado' : 'falhou';
  const resultado = { criadas, falhas, roteiro, agenda };
  await db`UPDATE vybe_pacotes_producao SET estado = ${estado}, resultado = ${JSON.stringify(resultado)}::jsonb WHERE id = ${Number(p.id)}`;
  const partes = [`${criadas.length ? '✅' : '⚠️'} *Pacote #${p.id}* · *${p.cliente}*: ${criadas.length} de ${p.pecas.length} peça(s) cadastrada(s) em Produção${captacaoDaPeca ? ` (${captacaoDaPeca})` : ''}.`];
  if (criadas.length) partes.push(criadas.map((c) => `• ${dataCurta(c.veiculacao)} · ${c.titulo}${c.link ? `\n  ${c.link}` : ''}`).join('\n'));
  if (falhas.length) partes.push(`⚠️ Não entraram:\n${falhas.map((f) => `• ${f.titulo}: ${f.erro}`).join('\n')}`);
  if (roteiro?.ligadas) partes.push(`📄 Ligadas ao roteiro no painel (${roteiro.ligadas}).`);
  else if (roteiro?.erro) partes.push(`⚠️ Não liguei ao roteiro: ${roteiro.erro}`);
  if (agenda?.ok) partes.push(`🎬 Captação sugerida marcada na agenda: ${dataCurta(cap.dia)}, das ${cap.inicio} às ${cap.fim}. Quando o cliente confirmar, mudem para "Captação Agendada".`);
  else if (agenda?.erro) partes.push(`⚠️ A captação não foi marcada na agenda: ${agenda.erro}`);
  if (p.recado) partes.push(`📌 Falta com o cliente: ${p.recado}`);
  return { texto: partes.join('\n\n'), ...resultado, estado };
}
