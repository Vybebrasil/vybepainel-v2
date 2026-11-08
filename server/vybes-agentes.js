// Perfil dos agentes, mapa do cérebro e pendências do WhatsApp (Paulo, 08/11/2026), lidos da central do VYBES.
// A central (C:\whatsapp-ia, central.js) é a única fonte: aqui só passa adiante, com o crachá de quem está logado
// guardado no servidor (cookie), sem seguir redirecionamento, com limite de tamanho e com a resposta limpa (só texto,
// número, booleano, lista e objeto, cortados). Nada é calculado de novo aqui: não existe segunda regra de negócio.
//   GET  /api/cosmos/agentes/perfil?setor=   → perfil do agente (rotinas com motor e fontes, achados, números, projeção)
//   GET  /api/cosmos/cerebro/mapa            → nós e ligações do cérebro, com origem e motor (Qwen, lógica, Vybe OS)
//   GET  /api/cosmos/whatsapp/pendencias     → atendimento (clientes esperando, time sem resolver) e "para você"
//   GET  /api/cosmos/agentes/estudos?cliente → estudo do cliente (setor, concorrentes, ameaças, oportunidades)
//   POST /api/cosmos/agentes/rotinas         → ligar/desligar rotina (a central aceita só dos donos)
//   POST /api/cosmos/agentes/achados         → resolvido / ignorar / errado; lição: incorporar / contestar
const TUNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const SETOR = /^[a-z]{2,20}$/;

function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status }); }

function entrada(urlEntrada) {
  let u; try { u = new URL(urlEntrada); } catch { throw erro('Entrada da central inválida.', 502); }
  if (!TUNEL.test(u.origin) || u.username || u.password || u.hash || u.pathname !== '/entrar' || !u.searchParams.get('t')) throw erro('Entrada da central inválida.', 502);
  return { origem: u.origin, cookie: `vybes_quem=${encodeURIComponent(u.searchParams.get('t'))}` };
}

// Cópia limpa da resposta: corta textos, listas e profundidade. A tela escapa tudo de novo ao desenhar.
export function limparJson(v, { texto = 2000, lista = 400, fundo = 7 } = {}, nivel = 0) {
  if (v == null || typeof v === 'boolean') return v ?? null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v.slice(0, texto);
  if (nivel >= fundo) return null;
  if (Array.isArray(v)) return v.slice(0, lista).map((x) => limparJson(x, { texto, lista, fundo }, nivel + 1));
  if (typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v).slice(0, 80)) if (/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k)) out[k] = limparJson(x, { texto, lista, fundo }, nivel + 1);
    return out;
  }
  return null;
}

async function lerCorpo(r, limite) {
  if (Number(r.headers?.get?.('content-length')) > limite) throw new Error('limite');
  const leitor = r.body?.getReader?.();
  if (!leitor) { const t = await r.text(); if (Buffer.byteLength(t) > limite) throw new Error('limite'); return t; }
  const partes = []; let bytes = 0;
  try { while (true) { const { done, value } = await leitor.read(); if (done) break; bytes += value.byteLength; if (bytes > limite) throw new Error('limite'); partes.push(Buffer.from(value)); } }
  catch (e) { try { await leitor.cancel(); } catch {} throw e; }
  return Buffer.concat(partes).toString('utf8');
}

async function chamarCentral(urlEntrada, caminho, { metodo = 'GET', corpo = null, limite = 512 * 1024, fetchImpl = globalThis.fetch } = {}) {
  const { origem, cookie } = entrada(urlEntrada);
  let r;
  try {
    r = await fetchImpl(`${origem}${caminho}`, { method: metodo, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Cookie: cookie, Accept: 'application/json', ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, ...(corpo ? { body: JSON.stringify(corpo) } : {}) });
  } catch { throw erro('A central do VYBES não respondeu.', 504); }
  let d = {};
  try { d = JSON.parse(await lerCorpo(r, limite)); } catch { if (r.ok) throw erro('Resposta inválida da central.', 502); }
  if (r.status === 404 && !d?.erro) throw erro('A central ainda não tem esta leitura: reinicie o VYBES com a versão nova.', 503);
  if (r.status === 403) throw erro(d?.erro === 'SO_DONOS' ? 'Só os donos mudam isso.' : 'Sua conta não pode ver isso na central.', 403);
  return { status: r.status, d };
}

export async function lerPerfilAgente(urlEntrada, setor, opcoes = {}) {
  if (!SETOR.test(String(setor || ''))) throw erro('Agente inválido.', 400);
  const { status, d } = await chamarCentral(urlEntrada, `/api/cosmos/agentes/perfil?setor=${encodeURIComponent(setor)}`, opcoes);
  if (status === 404) throw erro('Agente não encontrado.', 404);
  if (status >= 400 || d?.ok !== true || !d.perfil || d.perfil.setor !== setor) throw erro('Não foi possível ler o perfil do agente.', 502);
  return { ok: true, fonte: 'central-vybes', lidoEm: Date.now(), geradoEm: String(d.geradoEm || ''), perfil: limparJson(d.perfil) };
}

export async function lerMapaCerebro(urlEntrada, opcoes = {}) {
  const { status, d } = await chamarCentral(urlEntrada, '/api/cosmos/cerebro/mapa', { limite: 1024 * 1024, ...opcoes });
  if (status >= 400 || d?.ok !== true || !Array.isArray(d.nos) || !Array.isArray(d.ligacoes)) throw erro('Não foi possível ler o mapa do cérebro.', 502);
  return { ok: true, fonte: 'central-vybes', lidoEm: Date.now(), ...limparJson({ geradoEm: d.geradoEm, contagem: d.contagem, geradoDe: d.geradoDe, nos: d.nos, ligacoes: d.ligacoes }, { lista: 800 }) };
}

export async function lerPendencias(urlEntrada, opcoes = {}) {
  const { status, d } = await chamarCentral(urlEntrada, '/api/cosmos/whatsapp/pendencias', opcoes);
  if (status >= 400 || d?.ok !== true || !d.atendimento) throw erro('Não foi possível ler as pendências do WhatsApp.', 502);
  return { ok: true, fonte: 'central-vybes', lidoEm: Date.now(), ...limparJson({ geradoEm: d.geradoEm, eu: d.eu, atendimento: d.atendimento, paraVoce: d.paraVoce }) };
}

export async function lerEstudoCliente(urlEntrada, cliente, opcoes = {}) {
  const c = String(cliente || '').trim().slice(0, 80);
  const { status, d } = await chamarCentral(urlEntrada, `/api/cosmos/agentes/estudos${c ? '?cliente=' + encodeURIComponent(c) : ''}`, opcoes);
  if (status === 404) return { ok: true, fonte: 'central-vybes', cliente: c, ultimo: null };
  if (status >= 400 || d?.ok !== true) throw erro('Não foi possível ler o estudo do cliente.', 502);
  return { ok: true, fonte: 'central-vybes', lidoEm: Date.now(), ...limparJson(c ? { cliente: d.cliente, ultimo: d.ultimo, anteriores: d.anteriores } : { estudos: d.estudos }) };
}

const ERROS = { ROTINA_INVALIDA: 'Rotina inválida.', ROTINA_FIXA: 'Essa rotina é de lembrete pedido pela pessoa e não desliga por aqui.', ACAO_INVALIDA: 'Ação inválida.',
  NAO_ENCONTRADO: 'Esse achado já foi fechado.', NAO_ENCONTRADA: 'Lição não encontrada.' };
export async function mudarNaCentral(urlEntrada, corpo, opcoes = {}) {
  const b = corpo || {}, etapa = String(b.etapa || '');
  let caminho, envio;
  if (etapa === 'rotina') {
    if (!['ligar', 'desligar'].includes(b.acao)) throw erro('Ação inválida.', 400);
    caminho = '/api/cosmos/agentes/rotinas'; envio = { id: String(b.id || '').slice(0, 40), acao: b.acao };
  } else if (etapa === 'achado') {
    if (b.licao ? !['incorporar', 'contestar'].includes(b.acao) : !['resolvido', 'ignorar', 'errado'].includes(b.acao)) throw erro('Ação inválida.', 400);
    caminho = '/api/cosmos/agentes/achados'; envio = b.licao ? { licao: String(b.licao).slice(0, 60), acao: b.acao } : { chave: String(b.chave || '').slice(0, 200), acao: b.acao };
  } else throw erro('Ação inválida.', 400);
  const { status, d } = await chamarCentral(urlEntrada, caminho, { metodo: 'POST', corpo: envio, limite: 64 * 1024, ...opcoes });
  if (status >= 400 || d?.ok !== true) throw erro(ERROS[d?.erro] || 'A central recusou a mudança.', status === 400 ? 400 : 502);
  return { ok: true };
}

// Leituras GET da área VYBES que este módulo atende (o roteador em server/vybes.js e o servidor de desenvolvimento usam).
export const ETAPAS_LEITURA = ['perfil', 'mapa', 'pendencias', 'estudo'];
export async function lerEtapa(etapa, urlEntrada, query = {}, opcoes = {}) {
  if (etapa === 'perfil') return lerPerfilAgente(urlEntrada, query.setor, opcoes);
  if (etapa === 'mapa') return lerMapaCerebro(urlEntrada, opcoes);
  if (etapa === 'pendencias') return lerPendencias(urlEntrada, opcoes);
  if (etapa === 'estudo') return lerEstudoCliente(urlEntrada, query.cliente, opcoes);
  throw erro('Leitura inválida.', 400);
}
