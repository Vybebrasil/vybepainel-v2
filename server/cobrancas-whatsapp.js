// Cobrança pelo WhatsApp (Paulo, 10/11/2026: no painel do Deivid o botão "Cobrar" só gerava a mensagem para ele mesmo
// copiar e mandar; "ao clicar, o bot cobra de verdade").
//
// O caminho:
// 1. Um dono clica em Cobrar → Confirmar na Criação do Hoje (vybe-mundo-criacao.js). O painel chama area=cobrancas com a
//    peça e para quem. Aqui o pedido é conferido: só dono pede; só entra quem É responsável da peça no banco e é pessoa
//    ativa da equipe (nunca cliente, nunca grupo); o texto é montado aqui, com o título e o cliente do banco.
// 2. O VYBES (bot) busca os pedidos (consulta 'cobrancas'): a busca já marca "enviando", então o mesmo pedido nunca sai
//    duas vezes, nem se o bot cair no meio. Ele acha o WhatsApp da pessoa pelo vínculo dela nos grupos internos e manda
//    no privado, assinado pelo agente dono da cobrança.
// 3. O bot devolve o resultado (consulta 'cobranca_resultado'): "enviado" ou "falhou" com o motivo. O painel mostra.
//
// Agente dono da cobrança: quem é do audiovisual (EQUIPES.audiovisual do painel) é cobrado pelo Lucas (Pós-produção);
// o resto do time da Criação, pelo Danilo (Design Visual, o braço direito do Deivid).
import vm from 'node:vm';
import { ehDonoPessoa, ehAmploPessoa } from './donos.js';
import { BOARD_DEMANDAS, BOARD_PRODUCAO } from './grupos.js';

export const AGENTES_DA_COBRANCA = Object.freeze({ design: 'Danilo', edicao: 'Lucas' });
const ESPERA_MAX_H = 12;          // pedido que o bot não pegou nesse tempo não sai mais (cobrança velha não vale)
const SEM_CONFIRMAR_MIN = 10;     // "enviando" há mais que isso: o bot pegou e não disse o que houve

const prontas = new WeakSet();
export async function garantirTabelaCobrancas(db) {
  if (prontas.has(db)) return;
  await db`CREATE TABLE IF NOT EXISTS vybe_cobrancas_whatsapp (
    id BIGSERIAL PRIMARY KEY,
    conteudo_id BIGINT NOT NULL,
    ref TEXT NOT NULL,
    titulo TEXT NOT NULL,
    cliente TEXT,
    pessoa_id BIGINT NOT NULL,
    pessoa_nome TEXT NOT NULL,
    setor TEXT NOT NULL,
    texto TEXT NOT NULL,
    pedido_por BIGINT NOT NULL,
    pedido_por_nome TEXT,
    dia DATE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pedido',
    motivo TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pego_em TIMESTAMPTZ,
    resolvido_em TIMESTAMPTZ,
    UNIQUE (conteudo_id, pessoa_id, dia)
  )`;
  await db`CREATE INDEX IF NOT EXISTS vybe_cobrancas_whatsapp_estado ON vybe_cobrancas_whatsapp (estado, criado_em)`;
  prontas.add(db);
}

const falhar = (status, msg) => { throw Object.assign(new Error(msg), { status }); };
const limpo = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const primeiro = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';
const hojeBahia = (agora = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date(agora));
const idLocal = (ref) => (/^vybe:\d{1,18}$/.test(String(ref)) ? Number(String(ref).slice(5)) : -1);

// Quem é do audiovisual, pela mesma lista do painel (vybe-config.js EQUIPES). Sem a lista, ninguém: cai no Danilo.
let audiovisualDoPainel = null;
async function audiovisual() {
  if (audiovisualDoPainel) return audiovisualDoPainel;
  try {
    const { codigoDoPainel } = await import('./assistente-rotinas.js');
    audiovisualDoPainel = new Set([...vm.runInContext('EQUIPES.audiovisual', codigoDoPainel().ctx)].map(String));
  } catch { audiovisualDoPainel = new Set(); }
  return audiovisualDoPainel;
}
export const setorDaCobranca = (mondayId, doAudiovisual) => (mondayId && doAudiovisual.has(String(mondayId)) ? 'edicao' : 'design');

// O texto que a pessoa recebe (a assinatura do agente é o bot que põe: whatsapp-ia/core/assinatura-agentes.js).
export function textoDaCobranca({ nome, titulo, cliente, por, oque, quando, pedidoPor, link }) {
  const sobre = `"${titulo}"${cliente ? ` (${cliente})` : ''}`;
  return [`${primeiro(nome)}, sobre ${sobre}${por ? `: ${por}` : ''}.`,
    `Consegue ${oque}${quando ? ' ' + quando : ''}?`,
    `_Cobrança pedida ${pedidoPor ? 'por ' + primeiro(pedidoPor) : 'pela direção de arte'} no Vybe OS._${link ? '\n🔗 ' + link : ''}`].join('\n\n');
}

const publica = (r, agora) => {
  const criado = new Date(r.criado_em).getTime(), pego = r.pego_em ? new Date(r.pego_em).getTime() : 0;
  let estado = r.estado, motivo = r.motivo || '';
  if (estado === 'pedido' && agora - criado > ESPERA_MAX_H * 3600e3) { estado = 'falhou'; motivo = `O bot não pegou o pedido em ${ESPERA_MAX_H} horas (pode estar desligado).`; }
  else if (estado === 'enviando' && agora - pego > SEM_CONFIRMAR_MIN * 60e3) { estado = 'falhou'; motivo = 'O bot pegou o pedido e não confirmou o envio. Confira com a pessoa antes de cobrar de novo.'; }
  return { id: Number(r.id), ref: r.ref, conteudo_id: Number(r.conteudo_id), titulo: r.titulo, pessoa: r.pessoa_nome, setor: r.setor, agente: AGENTES_DA_COBRANCA[r.setor] || 'VYBES',
    estado, motivo, texto: r.texto, criado_em: new Date(r.criado_em).toISOString(), resolvido_em: r.resolvido_em ? new Date(r.resolvido_em).toISOString() : null };
};

// Pedido do painel. args: { item, para: [ids do Monday], oque, quando, por }.
export async function pedirCobranca(db, pessoa, args = {}, { agora = Date.now(), env = process.env, doAudiovisual = null, link = null } = {}) {
  if (!ehAmploPessoa(pessoa, env)) falhar(403, 'Só os donos da Vybe mandam cobrança pelo WhatsApp.');
  await garantirTabelaCobrancas(db);
  const ref = limpo(args.item, 40), oque = limpo(args.oque, 120), quando = limpo(args.quando, 60), por = limpo(args.por, 300);
  if (!ref) falhar(400, 'Diga qual é a peça.');
  if (oque.length < 3) falhar(400, 'Diga o que está sendo cobrado.');
  const para = [...new Set((Array.isArray(args.para) ? args.para : []).map((x) => String(x)).filter((x) => /^\d{1,15}$/.test(x)))].slice(0, 6);
  if (!para.length) falhar(400, 'Diga para quem é a cobrança.');
  const [c] = await db`SELECT c.id, c.monday_item_id, c.titulo,
      (SELECT string_agg(cl.nome, ' / ') FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id) AS cliente
    FROM vybe_conteudos c
    WHERE (c.monday_item_id::text = ${ref} OR c.id = ${idLocal(ref)}) AND c.removido_em IS NULL AND c.board_id IN (${BOARD_PRODUCAO}, ${BOARD_DEMANDAS})`;
  if (!c) falhar(404, 'Peça não encontrada.');
  // Só entra quem é responsável da peça no banco e é pessoa ativa da equipe; quem pede não cobra a si mesmo.
  const responsaveis = await db`SELECT p.id, p.nome, p.monday_user_id::text AS monday FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id
    WHERE r.conteudo_id = ${c.id} AND p.ativo IS TRUE`;
  const alvo = responsaveis.filter((p) => para.includes(String(p.monday)) && Number(p.id) !== Number(pessoa.id));
  if (!alvo.length) falhar(409, 'Ninguém para cobrar: a pessoa não é mais responsável por esta peça. Atualize a tela.');
  const av = doAudiovisual || await audiovisual();
  const dia = hojeBahia(agora), refPeca = c.monday_item_id ? String(c.monday_item_id) : 'vybe:' + c.id;
  const fazerLink = link || (await import('./assistente-rotinas.js')).linkDaAtividade;
  const titulo = limpo(c.titulo, 160) || 'Peça', cliente = limpo(c.cliente, 120);
  const cobrancas = [];
  for (const p of alvo) {
    const setor = setorDaCobranca(p.monday, av);
    const texto = textoDaCobranca({ nome: p.nome, titulo, cliente, por, oque, quando, pedidoPor: pessoa.nome, link: fazerLink(refPeca) });
    // Uma cobrança por pessoa, por peça, por dia. A que falhou pode ser pedida de novo; a que está a caminho ou já foi, não.
    const [r] = await db`INSERT INTO vybe_cobrancas_whatsapp (conteudo_id, ref, titulo, cliente, pessoa_id, pessoa_nome, setor, texto, pedido_por, pedido_por_nome, dia, criado_em)
      VALUES (${c.id}, ${refPeca}, ${titulo}, ${cliente || null}, ${p.id}, ${limpo(p.nome, 80)}, ${setor}, ${texto}, ${Number(pessoa.id)}, ${limpo(pessoa.nome, 80) || null}, ${dia}, ${new Date(agora).toISOString()})
      ON CONFLICT (conteudo_id, pessoa_id, dia) DO UPDATE SET estado = 'pedido', motivo = NULL, texto = EXCLUDED.texto, setor = EXCLUDED.setor,
        pedido_por = EXCLUDED.pedido_por, pedido_por_nome = EXCLUDED.pedido_por_nome, criado_em = EXCLUDED.criado_em, pego_em = NULL, resolvido_em = NULL
        WHERE vybe_cobrancas_whatsapp.estado = 'falhou'
          OR (vybe_cobrancas_whatsapp.estado = 'enviando' AND vybe_cobrancas_whatsapp.pego_em < ${new Date(agora - SEM_CONFIRMAR_MIN * 60e3).toISOString()})
          OR (vybe_cobrancas_whatsapp.estado = 'pedido' AND vybe_cobrancas_whatsapp.criado_em < ${new Date(agora - ESPERA_MAX_H * 3600e3).toISOString()})
      RETURNING *`;
    const linha = r || (await db`SELECT * FROM vybe_cobrancas_whatsapp WHERE conteudo_id = ${c.id} AND pessoa_id = ${p.id} AND dia = ${dia}`)[0];
    cobrancas.push({ ...publica(linha, agora), repetida: !r });
  }
  return { cobrancas };
}

// O que o painel mostra: as cobranças de hoje (e as de ontem que ainda não fecharam), a mais nova primeiro.
export async function cobrancasDoDia(db, pessoa, { agora = Date.now(), env = process.env } = {}) {
  if (!ehAmploPessoa(pessoa, env)) falhar(403, 'Só os donos da Vybe veem as cobranças pelo WhatsApp.');
  await garantirTabelaCobrancas(db);
  const rows = await db`SELECT * FROM vybe_cobrancas_whatsapp WHERE criado_em > ${new Date(agora - 36 * 3600e3).toISOString()} ORDER BY criado_em DESC LIMIT 60`;
  const dia = hojeBahia(agora);
  return { cobrancas: rows.filter((r) => hojeBahia(new Date(r.criado_em).getTime()) === dia).map((r) => publica(r, agora)) };
}

// Bot: pega os pedidos para mandar. A própria busca marca "enviando" (uma vez só), então nada sai em dobro.
export async function cobrancasParaEnviar(db, { agora = Date.now() } = {}) {
  await garantirTabelaCobrancas(db);
  const rows = await db`UPDATE vybe_cobrancas_whatsapp SET estado = 'enviando', pego_em = ${new Date(agora).toISOString()}
    WHERE id IN (SELECT id FROM vybe_cobrancas_whatsapp WHERE estado = 'pedido' AND criado_em > ${new Date(agora - ESPERA_MAX_H * 3600e3).toISOString()} ORDER BY criado_em LIMIT 10)
      AND estado = 'pedido'
    RETURNING id, pessoa_id, pessoa_nome, setor, texto, titulo, pedido_por_nome`;
  return rows.map((r) => ({ id: Number(r.id), pessoa_id: Number(r.pessoa_id), pessoa: r.pessoa_nome, setor: r.setor, texto: r.texto, titulo: r.titulo, pedido_por: r.pedido_por_nome || '' }))
    .sort((a, b) => a.id - b.id);
}

// Bot: o que aconteceu com o pedido que ele pegou.
export async function registrarResultado(db, { id, estado, motivo } = {}, { agora = Date.now() } = {}) {
  await garantirTabelaCobrancas(db);
  if (!['enviado', 'falhou'].includes(estado)) throw new TypeError('Resultado inválido.');
  const r = await db`UPDATE vybe_cobrancas_whatsapp SET estado = ${estado}, motivo = ${estado === 'falhou' ? limpo(motivo, 300) || 'Não foi possível enviar.' : null}, resolvido_em = ${new Date(agora).toISOString()}
    WHERE id = ${Number(id) || 0} AND estado = 'enviando' RETURNING id`;
  return { registrado: r.length > 0 };
}

// area=cobrancas do painel: GET lista as de hoje; POST { acao: 'pedir', item, para, oque, quando, por }.
export async function areaCobrancas(req, res, quem, db) {
  if (quem?.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'A cobrança pelo WhatsApp exige uma sessão pessoal.' });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await cobrancasDoDia(db, quem.pessoa)) });
    if (String(req.body?.acao || '') !== 'pedir') return res.status(400).json({ error: 'Ação desconhecida. Use pedir.' });
    return res.status(200).json({ ok: true, ...(await pedirCobranca(db, quem.pessoa, req.body || {})) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[cobrancas-whatsapp]', e);
    return res.status(500).json({ error: 'Não foi possível registrar a cobrança. Tente novamente.' });
  }
}
