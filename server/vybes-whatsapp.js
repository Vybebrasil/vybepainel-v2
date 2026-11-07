// WhatsApp interno do Vybe OS (Paulo, 07/11/2026): leitura, pelo túnel, do espelho dos grupos que o VYBES guarda no PC
// do Paulo (core/caixa-whatsapp.js no bot; rota GET /api/cosmos/whatsapp da central). Mesmo caminho dos agentes
// (lerAgentesDaCentral): só GET, sem seguir redirecionamento, crachá no servidor (nunca volta ao navegador).
// Quem vê o quê é decidido na central, pelo crachá (donos: tudo; equipe: os grupos de que participa no WhatsApp).
// Aqui o formato é conferido campo a campo e só o que a tela usa segue adiante. Nada aqui envia mensagem.
const TUNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const LIMITE_BYTES = 1024 * 1024;
const ID = /^[a-f0-9]{20}$/;

function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status }); }
const invalida = () => { throw erro('Resposta inválida da central.', 502); };
const txt = (v, n, vazio = false) => (typeof v === 'string' && v.length <= n && (vazio || v.length) ? v : invalida());
const txtOuNulo = (v, n) => (v == null ? null : txt(v, n, true));
const inteiro = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : invalida());
const bool = (v) => (typeof v === 'boolean' ? v : invalida());
const data = (v) => (typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : invalida());
const lista = (v, max) => (Array.isArray(v) && v.length <= max ? v : invalida());
const tipoConversa = (v) => (v === 'interno' || v === 'cliente' ? v : invalida());
const TIPOS_MSG = new Set(['texto', 'imagem', 'video', 'audio', 'documento', 'figurinha', 'localizacao', 'contato', 'enquete', 'outro']);

function mensagem(m) {
  if (!m || typeof m !== 'object') invalida();
  return { seq: inteiro(m.seq), em: inteiro(m.em), autor: txt(m.autor, 40), minha: bool(m.minha), vybes: bool(m.vybes),
    tipo: TIPOS_MSG.has(m.tipo) ? m.tipo : invalida(), midia: txtOuNulo(m.midia, 30), texto: txt(m.texto, 2000, true),
    mencoes: lista(m.mencoes, 50).map((x) => txt(x, 60)), paraVoce: bool(m.paraVoce), citada: txtOuNulo(m.citada, 200),
    apagada: bool(m.apagada), editada: bool(m.editada) };
}

export function validarCaixa(d, { conversa = null } = {}) {
  if (d?.ok !== true || d.somenteLeitura !== true || !d.eu || typeof d.eu !== 'object') invalida();
  const base = { ok: true, somenteLeitura: true, geradoEm: data(d.geradoEm), gruposLidosEm: d.gruposLidosEm == null ? null : data(d.gruposLidosEm),
    seq: inteiro(d.seq), eu: { nome: txt(d.eu.nome, 60, true), socio: bool(d.eu.socio), vinculado: bool(d.eu.vinculado),
      // Só para guardar as lidas de cada pessoa no aparelho: o id dela no Vybe OS (o próprio crachá; nada de telefone).
      pessoa: d.eu.pessoa == null ? null : /^\d{1,20}$/.test(String(d.eu.pessoa)) ? String(d.eu.pessoa) : invalida() } };
  if (conversa) {
    const c = d.conversa;
    if (!c || c.id !== conversa) invalida();
    return { ...base, conversa: { id: c.id, nome: txt(c.nome, 80, true), tipo: tipoConversa(c.tipo), cliente: txtOuNulo(c.cliente, 60),
      mensagens: lista(c.mensagens, 150).map(mensagem) } };
  }
  const vistos = new Set();
  const conversas = lista(d.conversas, 200).map((c) => {
    if (!c || !ID.test(c.id) || vistos.has(c.id)) invalida();
    vistos.add(c.id);
    const u = c.ultima || invalida();
    return { id: c.id, nome: txt(c.nome, 80, true), tipo: tipoConversa(c.tipo), cliente: txtOuNulo(c.cliente, 60), total: inteiro(c.total),
      ultima: { seq: inteiro(u.seq), em: inteiro(u.em), autor: txt(u.autor, 40), minha: bool(u.minha), apagada: bool(u.apagada),
        midia: txtOuNulo(u.midia, 30), texto: txt(u.texto, 200, true) },
      recebidas: lista(c.recebidas, 80).map(inteiro) };
  });
  const mencoes = lista(d.mencoes, 60).map((m) => {
    if (!m || !vistos.has(m.conversa)) invalida();
    return { ...mensagem(m), conversa: m.conversa, grupo: txt(m.grupo, 80, true), texto: txt(m.texto, 200, true) };
  });
  return { ...base, conversas, mencoes };
}

export async function lerWhatsappDaCentral(urlEntrada, { conversa = null, fetchImpl = globalThis.fetch } = {}) {
  if (conversa != null && !ID.test(String(conversa))) throw erro('Conversa inválida.', 400);
  let u;
  try { u = new URL(urlEntrada); } catch { throw erro('Entrada da central inválida.', 502); }
  if (!TUNEL.test(u.origin) || u.username || u.password || u.hash || u.pathname !== '/entrar' || !u.searchParams.get('t'))
    throw erro('Entrada da central inválida.', 502);
  let r;
  try {
    r = await fetchImpl(`${u.origin}/api/cosmos/whatsapp${conversa ? `?conversa=${conversa}` : ''}`, { method: 'GET', redirect: 'error',
      signal: AbortSignal.timeout(20000), headers: { Cookie: `vybes_quem=${encodeURIComponent(u.searchParams.get('t'))}`, Accept: 'application/json' } });
  } catch { throw erro('A central do VYBES não respondeu à leitura do WhatsApp.', 504); }
  if (r.status === 404 && conversa) { try { await r.body?.cancel(); } catch {} throw erro('Conversa não encontrada ou fora dos seus grupos.', 404); }
  if (!r.ok) { try { await r.body?.cancel(); } catch {} throw erro('Não foi possível ler o WhatsApp do VYBES agora.', r.status === 403 ? 403 : 502); }
  let corpo = '';
  try {
    if (Number(r.headers?.get('content-length')) > LIMITE_BYTES) throw new Error('limite');
    const leitor = r.body?.getReader();
    if (leitor) {
      const partes = []; let bytes = 0;
      try {
        while (true) { const { done, value } = await leitor.read(); if (done) break; bytes += value.byteLength; if (bytes > LIMITE_BYTES) throw new Error('limite'); partes.push(Buffer.from(value)); }
        corpo = Buffer.concat(partes).toString('utf8');
      } finally { await leitor.cancel().catch(() => {}); }
    } else { corpo = await r.text(); if (Buffer.byteLength(corpo) > LIMITE_BYTES) throw new Error('limite'); }
    return { ...validarCaixa(JSON.parse(corpo), { conversa }), fonte: 'central-vybes', lidoEm: Date.now() };
  } catch { try { await r.body?.cancel(); } catch {} throw erro('Resposta inválida da central.', 502); }
}
