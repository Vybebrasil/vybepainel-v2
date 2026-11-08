import { validarAgentes } from '../mundo/atividade-agentes.mjs';
// VYBES dentro do Vybe OS (decisão do Paulo, 02/11/2026: "é o nosso VYBES dentro lá, não uma interface nova").
// A central do VYBES roda no PC do Paulo (o ser, a voz, o WhatsApp, o modelo local) e fica acessível por um túnel.
// O bot publica aqui o endereço atual do túnel (consulta `vybes_publicar`); o cartão VYBES da tela de módulos pede um crachá
// (`entradaVybes`) e abre a central com ele. O crachá diz quem é e se pode agir; a central confere a assinatura.
// - Quem age: todos da equipe que entraram no painel (Paulo, 04/11/2026: "todos podem agir"). As ações pedidas na central
//   chegam pelo bot (consulta `vybes_acao`) e passam pelo MESMO executor das ações do assistente, com a permissão da
//   pessoa; o que sai no WhatsApp em nome dela leva o nome dela (whatsapp-ia/core/donos.js). A tabela
//   vybe_vybes_operadores ficou guardada, sem decidir mais nada.
// - Quem é dono (d:true no crachá): os quatro donos pela regra única de server/donos.js (id do Monday,
//   VYBE_AI_ADMIN_PESSOA_ID ou VYBE_DONOS_IDS). O crachá leva também o id do Monday (m), para a central conferir.
// Migração: migrations/2026-11-02-vybes.sql.
import { createHmac } from 'node:crypto';
import { prepararAcao, confirmarAcao } from './assistente-acoes.js';
import { lerWhatsappDaCentral } from './vybes-whatsapp.js';
import { ETAPAS_LEITURA, lerEtapa, mudarNaCentral } from './vybes-agentes.js';
import { ehDonoPessoa, mondayDaPessoa } from './donos.js';

const TUNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const CRACHA_VALE_MS = 2 * 60e3;
const TUNEL_VELHO_MS = 10 * 60e3;

function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status }); }

// A migração 2026-11-02-vybes.sql aplicada pelo próprio servidor no primeiro uso (autorizada pelo Paulo em
// 02/11/2026; mesmo padrão de vybe_ai_acoes em assistente-acoes.js). Só cria; a cópia de quem age acontece uma vez,
// quando a tabela nasce — depois, mudar quem age é mudar a tabela, e nada aqui repõe ninguém.
let tabelasVybes = null;
export function garantirTabelasVybes(sql) {
  if (!tabelasVybes) tabelasVybes = (async () => {
    const [r] = await sql`SELECT to_regclass('public.vybe_vybes_operadores') IS NOT NULL AS ok`;
    if (r?.ok) return;
    await sql.query(`CREATE TABLE IF NOT EXISTS vybe_vybes_estado (id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      estado jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS vybe_vybes_operadores (pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
      desde timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`INSERT INTO vybe_vybes_operadores (pessoa_id) SELECT pessoa_id FROM vybe_escritorio_avisos_autores ON CONFLICT (pessoa_id) DO NOTHING`);
  })().catch((e) => { tabelasVybes = null; throw e; });
  return tabelasVybes;
}
export function esquecerTabelasVybes() { tabelasVybes = null; } // só para os testes (cada um tem um banco novo)

// O que o bot publica: só o endereço do túnel (e quando) e se o WhatsApp do bot está conectado. Nada de dado de cliente
// passa por aqui. Com o WhatsApp desconectado a central continua no ar (o túnel segue valendo) e o cartão diz isso.
export async function guardarEstadoVybes(sql, estado) {
  if (!estado || typeof estado !== 'object' || Array.isArray(estado)) throw erro('Estado inválido.', 400);
  const tunel = estado.tunel == null ? null : String(estado.tunel);
  if (tunel !== null && !TUNEL.test(tunel)) throw erro('Endereço do túnel inválido.', 400);
  const e = { versao: 2, tunel, whatsapp: estado.whatsapp !== false };
  await garantirTabelasVybes(sql);
  await sql`INSERT INTO vybe_vybes_estado (id, estado, atualizado_em) VALUES (1, ${JSON.stringify(e)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, atualizado_em = now()`;
  return { guardado: true };
}

// Quem age (Paulo, 04/11/2026: "os comandos funcionam com todos e todos podem agir"): qualquer pessoa ativa da equipe que
// entrou no painel (convidado e serviço, não). A tabela vybe_vybes_operadores fica guardada, sem uso para decidir.
export async function podeAgirNoVybes(sql, quem) {
  const id = Number(quem?.pessoa?.id);
  if (quem?.tipo !== 'sessao' || !Number.isInteger(id) || id <= 0) return false;
  const [r] = await sql`SELECT 1 AS ok FROM vybe_pessoas WHERE id = ${id} AND ativo IS TRUE`;
  return Boolean(r?.ok);
}

// Mesmo formato do crachá que a central confere (entrada-vybes.js no PC): corpo base64url + HMAC com a chave derivada
// da credencial que os dois já compartilham (VYBE_AI_BOT_TOKEN), só para isto.
export function assinarCracha(dados, base = process.env.VYBE_AI_BOT_TOKEN) {
  const b = String(base || '').trim();
  if (!/^[A-Za-z0-9_-]{48,256}$/.test(b)) throw erro('VYBES indisponível agora.', 503);
  const chave = createHmac('sha256', b).update('vybes-entrada-v1').digest();
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return corpo + '.' + createHmac('sha256', chave).update(corpo).digest('base64url');
}

// Dono pela sessão (vybe_sessao.js já calcula) ou, sem ela, pelo id do Monday no banco.
async function donoDaSessao(sql, quem, env = process.env) {
  const p = quem?.pessoa;
  if (!p) return false;
  if (typeof p.dono === 'boolean') return p.dono || ehDonoPessoa({ id: p.id }, env);
  return ehDonoPessoa({ id: p.id, monday_user_id: (await mondayDaPessoa(sql, p.id)) || null }, env);
}

// Cartão VYBES na tela de módulos: se a central está no ar (o bot publicou o túnel há pouco), se o WhatsApp do bot está
// conectado, se quem olha pode agir e se é dono (a tela dos agentes usa isto, não o primeiro nome).
export async function estadoVybes(sql, quem, { agora = Date.now() } = {}) {
  const id = Number(quem?.pessoa?.id);
  if (quem?.tipo !== 'sessao' || !Number.isInteger(id) || id <= 0) throw erro('Entre no painel para abrir o VYBES.', 401);
  await garantirTabelasVybes(sql);
  const [linha] = await sql`SELECT estado, atualizado_em FROM vybe_vybes_estado WHERE id = 1`;
  const tunel = linha?.estado?.tunel;
  const noAr = Boolean(tunel && TUNEL.test(tunel) && agora - Date.parse(linha.atualizado_em) <= TUNEL_VELHO_MS);
  // whatsapp: false só quando o bot publicou que está sem WhatsApp (estado antigo, sem o campo, conta como conectado).
  return { noAr, whatsapp: noAr ? linha.estado.whatsapp !== false : null, agir: await podeAgirNoVybes(sql, quem), dono: await donoDaSessao(sql, quem) };
}

// Cartão VYBES: o link de entrada na central, com o crachá de quem está logado (vale 2 min; a central troca por um cookie).
export async function entradaVybes(sql, quem, { env = process.env, agora = Date.now() } = {}) {
  const id = Number(quem?.pessoa?.id);
  if (quem?.tipo !== 'sessao' || !Number.isInteger(id) || id <= 0) throw erro('Entre no painel para abrir o VYBES.', 401);
  await garantirTabelasVybes(sql);
  const [linha] = await sql`SELECT estado, atualizado_em FROM vybe_vybes_estado WHERE id = 1`;
  const tunel = linha?.estado?.tunel;
  if (!tunel || !TUNEL.test(tunel) || agora - Date.parse(linha.atualizado_em) > TUNEL_VELHO_MS)
    throw erro('O VYBES do PC do Paulo está desligado agora. Tente de novo em alguns minutos.', 503);
  const [p] = await sql`SELECT id, nome FROM vybe_pessoas WHERE id = ${id} AND ativo IS TRUE`;
  if (!p) throw erro('Pessoa inativa.', 403);
  const agir = await podeAgirNoVybes(sql, quem);
  // Os quatro donos (server/donos.js), não só o Paulo; m vai junto para a central aplicar a mesma regra.
  const m = await mondayDaPessoa(sql, id);
  const dono = ehDonoPessoa({ id, monday_user_id: m || null }, env);
  const t = assinarCracha({ p: id, n: String(p.nome || '').slice(0, 60), a: agir, d: dono, m, e: agora + CRACHA_VALE_MS }, env.VYBE_AI_BOT_TOKEN);
  return { url: `${tunel}/entrar?t=${encodeURIComponent(t)}`, agir };
}

// Ação pedida na central por quem entrou pelo Vybe OS: só quem age; o resto é o executor das ações do assistente
// (que confere a permissão da pessoa em cada ação, como no WhatsApp). preparar → resumo + código; confirmar → executa.
export async function acaoVybes(sql, quem, corpo, { segredo = process.env.VYBE_AI_LINK_SECRET, executar } = {}) {
  if (!(await podeAgirNoVybes(sql, quem))) throw erro('Entre no painel com a sua conta da equipe para pedir ações ao VYBES.', 403);
  const pessoaId = Number(quem.pessoa.id);
  if (corpo?.etapa === 'preparar') return prepararAcao(sql, pessoaId, corpo.pedido, segredo);
  if (corpo?.etapa === 'confirmar') return confirmarAcao(sql, pessoaId, corpo.codigo, segredo, executar ? { executar } : {});
  throw erro('Informe a etapa: preparar ou confirmar.', 400);
}

// O VYBES responde na sala do Escritório (Paulo, 04/11/2026): a pergunta vai à central pelo túnel, com o crachá recém-
// assinado de quem chamou no cabeçalho (vale 2 min e só na rota da sala, na central). Volta a fala curta e o áudio na voz
// da central (base64, até ~300 KB). A central decide o que responder com as permissões dessa pessoa.
export async function perguntarVybes(sql, quem, texto, { env = process.env, agora = Date.now(), fetchImpl = globalThis.fetch } = {}) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!t) throw erro('Diga a pergunta.', 400);
  const { url } = await entradaVybes(sql, quem, { env, agora });
  const u = new URL(url), cracha = u.searchParams.get('t');
  let r;
  try {
    r = await fetchImpl(`${u.origin}/api/cosmos/sala`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vybes-Cracha': cracha },
      body: JSON.stringify({ texto: t }), signal: AbortSignal.timeout(28000) });
  } catch { throw erro('O VYBES não respondeu agora.', 504); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 429) return { fala: String(d.fala || 'Tô terminando outra conversa. Já te respondo.').slice(0, 400), audio: null, ocupado: true };
  if (!r.ok) throw erro(r.status === 403 ? 'Sua conta não pode perguntar ao VYBES pela sala.' : 'O VYBES não respondeu agora.', r.status === 403 ? 403 : 502);
  const audio = typeof d.audio === 'string' && /^[A-Za-z0-9+/=]+$/.test(d.audio) && d.audio.length <= 400000 ? d.audio : null;
  return { fala: String(d.fala || '').slice(0, 600), audio, tipo: /^audio\/(?:mpeg|ogg|wav)$/.test(String(d.tipo || '')) ? d.tipo : 'audio/mpeg' };
}

// Leitura do estudo existente: o crachá fica no servidor e nunca volta ao JavaScript.
export async function lerCerebroDaCentral(urlEntrada, { fetchImpl = globalThis.fetch } = {}) {
  const u = new URL(urlEntrada);
  if (!TUNEL.test(u.origin) || u.pathname !== '/entrar' || !u.searchParams.get('t'))
    throw erro('Entrada da central inválida.', 502);
  let r;
  try {
    r = await fetchImpl(`${u.origin}/api/cosmos/ideias`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Cookie: `vybes_quem=${encodeURIComponent(u.searchParams.get('t'))}`, Accept: 'application/json' }
    });
  } catch { throw erro('A central do VYBES não respondeu à leitura.', 504); }
  if (!r.ok) throw erro('Não foi possível consultar o estudo do VYBES.', r.status === 403 ? 403 : 502);
  const texto = await r.text();
  if (texto.length > 2 * 1024 * 1024) throw erro('Estudo maior que o limite de leitura.', 502);
  let d; try { d = JSON.parse(texto); } catch { throw erro('Resposta inválida da central.', 502); }
  if (d?.ok !== true || !Array.isArray(d.clientes)) throw erro('Resposta inválida da central.', 502);
  return { ok: true, fonte: 'central-vybes', lidoEm: Date.now(), geradoEm: d.geradoEm || null,
    estudando: d.estudando || null, clientes: d.clientes };
}

// O token da entrada só vira cookie no servidor. Não segue redirecionamentos nem devolve o crachá.
export async function lerAgentesDaCentral(urlEntrada, { fetchImpl = globalThis.fetch } = {}) {
 let u;
 try { u=new URL(urlEntrada); } catch { throw erro('Entrada da central inválida.',502); }
 if(!TUNEL.test(u.origin) || u.username || u.password || u.hash || u.pathname!=='/entrar' || !u.searchParams.get('t')) throw erro('Entrada da central inválida.',502);
 let r;
 try { r=await fetchImpl(`${u.origin}/api/cosmos/agentes`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Cookie:`vybes_quem=${encodeURIComponent(u.searchParams.get('t'))}`,Accept:'application/json'}}); }
 catch { throw erro('A central do VYBES não respondeu à leitura.',504); }
 if(!r.ok) throw erro('Não foi possível consultar os agentes do VYBES.',r.status===403?403:502);
 const limite=256*1024; let corpo='';
 try {
  if(Number(r.headers?.get('content-length'))>limite) throw new Error('limite');
  const leitor=r.body?.getReader();
  if(leitor){const partes=[];let bytes=0;try{while(true){const {done,value}=await leitor.read();if(done)break;bytes+=value.byteLength;if(bytes>limite)throw new Error('limite');partes.push(Buffer.from(value));}corpo=Buffer.concat(partes).toString('utf8');}finally{await leitor.cancel().catch(()=>{});}}
  else {corpo=await r.text();if(Buffer.byteLength(corpo)>limite)throw new Error('limite');}
  const bruto=JSON.parse(corpo), dados=validarAgentes(bruto);
  return {...dados,atribuicoes:validarAtribuicoes(bruto.atribuicoes),rotinas:validarRotinas(bruto.rotinas),fonte:'central-vybes',lidoEm:Date.now()};
 } catch { try { await r.body?.cancel(); } catch {} throw erro('Resposta inválida da central.',502); }
}

// Atribuições dos agentes (Paulo, 08/11/2026): a central guarda; aqui só passa o que tem forma certa.
const SETOR_ID = /^[a-z]{2,20}$/, TXT = (v, n) => typeof v === 'string' && v.length <= n, DATA = (v) => v == null || (TXT(v, 40) && Number.isFinite(Date.parse(v)));
export function validarAtribuicoes(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 300).filter((a) => a && TXT(a.id, 60) && SETOR_ID.test(a.setor) && TXT(a.texto, 500) && TXT(a.cliente || '', 80)
    && ['uma_vez', 'diaria', 'semanal', 'mensal'].includes(a.frequencia) && ['ativa', 'pausada', 'concluida'].includes(a.estado)
    && TXT(a.horario || '', 10) && DATA(a.proxima) && DATA(a.ultimaVez) && DATA(a.criadaEm) && TXT(a.criadaPor || '', 60))
    .map((a) => ({ id: a.id, setor: a.setor, texto: a.texto, cliente: a.cliente || '', frequencia: a.frequencia, frequenciaTexto: TXT(a.frequenciaTexto, 30) ? a.frequenciaTexto : '',
      horario: a.horario || '', estado: a.estado, proxima: a.proxima || null, ultimaVez: a.ultimaVez || null, criadaEm: a.criadaEm || null, criadaPor: a.criadaPor || '',
      vezes: Number.isInteger(a.vezes) && a.vezes >= 0 ? a.vezes : 0 }));
}
export function validarRotinas(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return {};
  const out = {};
  for (const [k, v] of Object.entries(r).slice(0, 40)) if (SETOR_ID.test(k) && Array.isArray(v))
    out[k] = v.slice(0, 12).filter((x) => x && TXT(x.horario, 12) && TXT(x.texto, 200)).map((x) => ({ horario: x.horario, texto: x.texto }));
  return out;
}
// Dar ou mudar uma atribuição: o crachá de quem está logado vai junto; a central só aceita dos donos.
export async function atribuirNaCentral(urlEntrada, corpo, { fetchImpl = globalThis.fetch } = {}) {
  let u; try { u = new URL(urlEntrada); } catch { throw erro('Entrada da central inválida.', 502); }
  if (!TUNEL.test(u.origin) || u.pathname !== '/entrar' || !u.searchParams.get('t')) throw erro('Entrada da central inválida.', 502);
  const b = corpo || {}, acao = String(b.acao || '');
  if (!['criar', 'pausar', 'retomar', 'concluir', 'remover'].includes(acao)) throw erro('Ação inválida.', 400);
  const envio = acao === 'criar'
    ? { acao, setor: String(b.setor || '').slice(0, 20), texto: String(b.texto || '').slice(0, 500), cliente: String(b.cliente || '').slice(0, 80),
        frequencia: String(b.frequencia || 'uma_vez'), horario: String(b.horario || '09:00').slice(0, 5), inicio: String(b.inicio || '').slice(0, 10) }
    : { acao, id: String(b.id || '').slice(0, 60) };
  let r;
  try {
    r = await fetchImpl(`${u.origin}/api/cosmos/agentes/atribuicoes`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Cookie: `vybes_quem=${encodeURIComponent(u.searchParams.get('t'))}` }, body: JSON.stringify(envio) });
  } catch { throw erro('A central do VYBES não respondeu.', 504); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 404) throw erro('A central ainda não tem atribuições: reinicie o VYBES com a versão nova.', 503);
  if (r.status === 403) throw erro('Só os donos (Paulo, Vinícius, Ewerton e Deivid) dão atribuições aos agentes.', 403);
  if (!r.ok || d.ok !== true) throw erro({ SETOR_INVALIDO: 'Agente inválido.', TEXTO_CURTO: 'Escreva o que o agente deve fazer.', FREQUENCIA_INVALIDA: 'Frequência inválida.',
    HORARIO_INVALIDO: 'Horário inválido.', NAO_ENCONTRADA: 'Atribuição não encontrada.', LIMITE: 'Limite de atribuições ativas.' }[d.erro] || 'A central recusou a atribuição.', 400);
  const [a] = validarAtribuicoes([d.atribuicao]);
  return { ok: true, atribuicao: a || null };
}

export async function areaVybes(req, res, quem, sql) {
  try {
    // WhatsApp interno (server/vybes-whatsapp.js): só leitura; a central filtra pelo crachá de quem está logado.
    if (req.method === 'GET' && req.query?.etapa === 'whatsapp') {
      const conversa = req.query.conversa == null ? null : String(req.query.conversa);
      if (conversa != null && !/^[a-f0-9]{20}$/.test(conversa)) throw erro('Conversa inválida.', 400);
      const { url } = await entradaVybes(sql, quem);
      return res.status(200).json(await lerWhatsappDaCentral(url, { conversa }));
    }
    if (req.method === 'GET' && ['cerebro','agentes'].includes(req.query?.etapa)) {
      const { url } = await entradaVybes(sql, quem);
      return res.status(200).json(await (req.query.etapa==='agentes'?lerAgentesDaCentral:lerCerebroDaCentral)(url));
    }
    // Perfil do agente, mapa do cérebro, pendências do WhatsApp e estudo do cliente (server/vybes-agentes.js).
    if (req.method === 'GET' && ETAPAS_LEITURA.includes(req.query?.etapa)) {
      const { url } = await entradaVybes(sql, quem);
      return res.status(200).json(await lerEtapa(req.query.etapa, url, req.query));
    }
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await estadoVybes(sql, quem)) });
    if (req.method === 'POST' && req.body?.etapa === 'entrar') return res.status(200).json({ ok: true, ...(await entradaVybes(sql, quem)) });
    if (req.method === 'POST' && req.body?.etapa === 'atribuir') {
      const { url } = await entradaVybes(sql, quem);
      return res.status(200).json(await atribuirNaCentral(url, req.body));
    }
    if (req.method === 'POST' && ['rotina', 'achado'].includes(req.body?.etapa)) {
      const { url } = await entradaVybes(sql, quem);
      return res.status(200).json(await mudarNaCentral(url, req.body));
    }
    if (req.method === 'POST' && req.body?.etapa === 'perguntar') return res.status(200).json({ ok: true, ...(await perguntarVybes(sql, quem, req.body?.texto)) });
    return res.status(405).json({ error: 'Use o cartão VYBES para abrir a central.' });
  } catch (e) {
    const status = e.status || (e instanceof TypeError ? 400 : 500);
    return res.status(status).json({ error: status >= 500 && status !== 503 ? 'Não foi possível abrir o VYBES agora.' : e.message });
  }
}
