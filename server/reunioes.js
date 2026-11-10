// Reuniões e onboarding do cliente (Paulo, 09/11/2026).
//
// "Uma reunião de rotina com cliente gera pauta e precisa estar linkada a um cliente; o bot sugere a pauta; a ata (texto
// ou gravação) vira demandas cadastradas." E o onboarding de marca nova feito todo por dentro do sistema: cadastro,
// perguntas do negócio, SWOT e acessos, por um link que serve tanto para o cliente preencher sozinho quanto para
// preencher junto com ele na reunião.
//
// As atas já existiam (vybe_cliente_reunioes: data + resumo); aqui elas ganham tipo, pauta, participantes, gravação no
// Drive, transcrição e sugestões. O questionário fica em vybe_clientes.onboarding_respostas; os acessos recebidos pelo link
// vão para o documento de acessos do cliente (vybe_acessos.doc_conteudo, que só a administração abre) e nunca voltam
// para a tela pública.

import { createHash, randomBytes } from 'node:crypto';
import { CAMPOS_CADASTRO, SECOES_CADASTRO, salvarCadastro, valorDoCampo, garantirSchemaDoCadastro } from './clientes-cadastro.js';
import { ehDonoPessoa } from './donos.js';

export const TIPOS_REUNIAO = Object.freeze({ rotina: 'Rotina com o cliente', onboarding: 'Onboarding / kickoff', alinhamento: 'Alinhamento', comercial: 'Comercial', interna: 'Interna' });

// As perguntas do onboarding. "secao" agrupa na tela; "swot" vira os quatro quadros.
export const QUESTOES = Object.freeze([
  { chave: 'historia', secao: 'negocio', rotulo: 'Como a empresa começou e o que ela faz hoje' },
  { chave: 'produtos', secao: 'negocio', rotulo: 'Produtos ou serviços principais (e qual é o carro-chefe)' },
  { chave: 'diferenciais', secao: 'negocio', rotulo: 'O que diferencia a marca dos concorrentes' },
  { chave: 'publico', secao: 'negocio', rotulo: 'Quem é o cliente ideal (idade, região, o que busca, como decide a compra)' },
  { chave: 'concorrentes', secao: 'negocio', rotulo: 'Principais concorrentes: o que admira e o que não gosta neles' },
  { chave: 'objetivos', secao: 'negocio', rotulo: 'O que espera da Vybe nos próximos 3 meses' },
  { chave: 'sazonalidade', secao: 'negocio', rotulo: 'Datas e épocas mais importantes para o negócio' },
  { chave: 'tom', secao: 'marca', rotulo: 'Como a marca fala: palavras que usa e que evita' },
  { chave: 'nao_fazer', secao: 'marca', rotulo: 'O que nunca fazer ou postar' },
  { chave: 'referencias', secao: 'marca', rotulo: 'Perfis e marcas que admira (links)' },
  { chave: 'aprovacao', secao: 'marca', rotulo: 'Quem aprova os conteúdos e como prefere receber' },
  { chave: 'forcas', secao: 'swot', rotulo: 'Forças' },
  { chave: 'fraquezas', secao: 'swot', rotulo: 'Fraquezas' },
  { chave: 'oportunidades', secao: 'swot', rotulo: 'Oportunidades' },
  { chave: 'ameacas', secao: 'swot', rotulo: 'Ameaças' },
]);
export const ACESSOS_PEDIDOS = Object.freeze([
  ['instagram', 'Instagram (usuário e senha)'], ['facebook', 'Facebook / Business Manager'], ['google', 'Google (Gmail, YouTube, Meu Negócio)'],
  ['site', 'Site, domínio e hospedagem'], ['tiktok', 'TikTok'], ['outros', 'Outros acessos'],
]);
// No link, o cadastro sem a parte de contrato (valor e vencimento são combinados com a Vybe, não preenchidos pelo cliente).
const CAMPOS_LINK = CAMPOS_CADASTRO.filter((c) => c.secao !== 'contrato');

const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });
const hash = (t) => createHash('sha256').update(String(t)).digest('hex');
const txt = (v, max) => String(v ?? '').trim().slice(0, max);

const prontos = new WeakSet();
export async function garantirSchemaReunioes(db) {
  if (prontos.has(db)) return;
  await garantirSchemaDoCadastro(db);
  await db`CREATE TABLE IF NOT EXISTS vybe_cliente_reunioes (id BIGSERIAL PRIMARY KEY, cliente_id BIGINT NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    data DATE NOT NULL, resumo TEXT NOT NULL, autor TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  for (const coluna of [
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'rotina'`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS titulo TEXT`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS participantes TEXT`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS pauta TEXT`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS gravacao_drive_id TEXT`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS gravacao_bytes BIGINT`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS transcricao TEXT`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS sugestoes JSONB`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'registrada'`,
    db`ALTER TABLE vybe_cliente_reunioes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ`,
    db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS onboarding_respostas JSONB NOT NULL DEFAULT '{}'::jsonb`,
    db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS onboarding_link_hash TEXT`,
    db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS onboarding_link_expira TIMESTAMPTZ`,
  ]) await coluna;
  prontos.add(db);
}

// Quem mexe: administração, os quatro donos ou o head do cliente.
export async function podeMexer(db, pessoa, clienteId) {
  if (pessoa?.admin || ehDonoPessoa(pessoa)) return true;
  const [h] = await db`SELECT 1 AS ok FROM vybe_cliente_pessoas WHERE cliente_id=${Number(clienteId)} AND pessoa_id=${Number(pessoa?.id) || 0}`;
  return Boolean(h);
}

// ── reuniões ─────────────────────────────────────────────────────────────────
const publica = (r) => r && ({ id: String(r.id), cliente_id: String(r.cliente_id), data: String(r.data instanceof Date ? r.data.toISOString() : r.data).slice(0, 10),
  tipo: r.tipo, titulo: r.titulo || TIPOS_REUNIAO[r.tipo] || 'Reunião', participantes: r.participantes || '', pauta: r.pauta || '', ata: r.resumo || '',
  autor: r.autor || '', gravacao: r.gravacao_drive_id ? { id: r.gravacao_drive_id, bytes: Number(r.gravacao_bytes) || null } : null,
  transcricao: r.transcricao || '', sugestoes: r.sugestoes || null, estado: r.estado || 'registrada', criado_em: r.criado_em });

export async function listarReunioes(db, clienteId) {
  return (await db`SELECT * FROM vybe_cliente_reunioes WHERE cliente_id=${Number(clienteId)} ORDER BY data DESC, id DESC LIMIT 100`).map(publica);
}

function limparReuniao(b = {}) {
  const tipo = Object.prototype.hasOwnProperty.call(TIPOS_REUNIAO, b.tipo) ? b.tipo : 'rotina';
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.data || '')) ? b.data : null;
  return { tipo, data, titulo: txt(b.titulo, 160), participantes: txt(b.participantes, 600), pauta: txt(b.pauta, 6000), ata: txt(b.ata, 60000) };
}

export async function salvarReuniao(db, { id, clienteId, autor, ...b }) {
  const r = limparReuniao(b);
  if (id) {
    const [n] = await db`UPDATE vybe_cliente_reunioes SET tipo=${r.tipo}, titulo=${r.titulo || null}, participantes=${r.participantes || null},
        pauta=${r.pauta || null}, resumo=${r.ata}, data=COALESCE(${r.data}::date, data), atualizado_em=NOW(),
        estado=CASE WHEN estado='registrada' AND ${r.ata}<>'' THEN 'com_ata' ELSE estado END
      WHERE id=${Number(id)} RETURNING *`;
    if (!n) throw erro('Reunião não encontrada.', 404);
    await atualizarUltimaReuniao(db, n.cliente_id);
    return publica(n);
  }
  if (!Number(clienteId)) throw erro('Escolha o cliente da reunião.');
  const [n] = await db`INSERT INTO vybe_cliente_reunioes (cliente_id, data, resumo, autor, tipo, titulo, participantes, pauta, estado, atualizado_em)
    VALUES (${Number(clienteId)}, COALESCE(${r.data}::date, CURRENT_DATE), ${r.ata}, ${autor || null}, ${r.tipo}, ${r.titulo || null},
      ${r.participantes || null}, ${r.pauta || null}, ${r.ata ? 'com_ata' : 'registrada'}, NOW()) RETURNING *`;
  await atualizarUltimaReuniao(db, n.cliente_id);
  return publica(n);
}
async function atualizarUltimaReuniao(db, clienteId) {
  try { await db`UPDATE vybe_clientes SET ultima_reuniao=(SELECT MAX(data) FROM vybe_cliente_reunioes WHERE cliente_id=${clienteId} AND (resumo<>'' OR gravacao_drive_id IS NOT NULL)) WHERE id=${clienteId}`; }
  catch { /* coluna antiga ausente em banco de teste */ }
}

export async function registrarGravacao(db, id, { driveId, bytes }) {
  if (!driveId) throw erro('Informe o arquivo criado no Drive.');
  const [n] = await db`UPDATE vybe_cliente_reunioes SET gravacao_drive_id=${String(driveId)}, gravacao_bytes=${Number(bytes) || null},
      estado='gravada', atualizado_em=NOW() WHERE id=${Number(id)} RETURNING *`;
  if (!n) throw erro('Reunião não encontrada.', 404);
  await atualizarUltimaReuniao(db, n.cliente_id);
  return publica(n);
}

// Pauta sugerida com o que o sistema já sabe do cliente: o que ficou da última reunião, aprovações paradas, demandas
// atrasadas e o que os chats do Claude registraram. Lógica fixa; o bot pode refinar depois.
export async function sugerirPauta(db, clienteId) {
  const id = Number(clienteId);
  const itens = [];
  const [ult] = await db`SELECT data, resumo FROM vybe_cliente_reunioes WHERE cliente_id=${id} AND resumo<>'' ORDER BY data DESC, id DESC LIMIT 1`;
  if (ult) itens.push(`Retomar o que ficou da reunião de ${String(ult.data instanceof Date ? ult.data.toISOString() : ult.data).slice(0, 10).split('-').reverse().join('/')}: ${txt(ult.resumo.replace(/\s+/g, ' '), 200)}`);
  try {
    const pl = await db`SELECT TO_CHAR(mes,'MM/YYYY') AS mes, estado FROM vybe_planejamentos WHERE cliente_id=${id} AND estado IN ('revisar','ajustes','enviado','aprovado')`;
    for (const p of pl) itens.push(p.estado === 'enviado' ? `Aprovação do planejamento de ${p.mes} (está com o cliente)` : p.estado === 'aprovado' ? `Planejamento de ${p.mes} aprovado: confirmar o cronograma` : `Planejamento de ${p.mes} em revisão interna`);
  } catch { /* sem planejamentos */ }
  try {
    const [a] = await db`SELECT COUNT(*)::int AS n FROM vybe_conteudos c JOIN vybe_conteudo_clientes v ON v.conteudo_id=c.id
      WHERE v.cliente_id=${id} AND c.removido_em IS NULL AND c.status_chave='ag_aprovacao_cliente'`;
    if (a?.n) itens.push(`${a.n} peça${a.n > 1 ? 's' : ''} esperando a aprovação do cliente`);
    const [i] = await db`SELECT COUNT(*)::int AS n FROM vybe_conteudos c JOIN vybe_conteudo_clientes v ON v.conteudo_id=c.id
      WHERE v.cliente_id=${id} AND c.removido_em IS NULL AND c.status_chave IN ('ag_info_cliente','falta_info')`;
    if (i?.n) itens.push(`${i.n} demanda${i.n > 1 ? 's' : ''} esperando informação do cliente`);
  } catch { /* sem conteúdos */ }
  try {
    const regs = await db`SELECT titulo FROM vybe_cliente_registros WHERE cliente_id=${id} AND tipo IN ('decisao','aprendizado') ORDER BY criado_em DESC LIMIT 3`;
    for (const g of regs) itens.push(`Confirmar com o cliente: ${txt(g.titulo, 120)}`);
  } catch { /* sem registros */ }
  itens.push('Próximos passos, responsáveis e datas');
  return itens;
}

// ── onboarding ───────────────────────────────────────────────────────────────
export async function linkDoOnboarding(db, clienteId, { painel = process.env.PAINEL_URL || 'https://vybepainel-v2.vercel.app' } = {}) {
  const token = randomBytes(24).toString('base64url');
  const [c] = await db`UPDATE vybe_clientes SET onboarding_link_hash=${hash(token)}, onboarding_link_expira=NOW() + INTERVAL '30 days'
    WHERE id=${Number(clienteId)} AND apagado_em IS NULL RETURNING id, nome`;
  if (!c) throw erro('Cliente não encontrado.', 404);
  return { url: `${painel.replace(/\/$/, '')}/onboarding/${token}`, cliente: c.nome, expira_em_dias: 30 };
}

async function clienteDoToken(db, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(token || ''))) return null;
  const [c] = await db`SELECT * FROM vybe_clientes WHERE onboarding_link_hash=${hash(token)} AND onboarding_link_expira > NOW() AND apagado_em IS NULL`;
  return c || null;
}

export async function respostasDoOnboarding(db, clienteId) {
  const [c] = await db`SELECT id, nome, onboarding_respostas, onboarding_link_expira FROM vybe_clientes WHERE id=${Number(clienteId)}`;
  if (!c) throw erro('Cliente não encontrado.', 404);
  return { respostas: c.onboarding_respostas || {}, link_ativo: Boolean(c.onboarding_link_expira && new Date(c.onboarding_link_expira) > new Date()) };
}

// Grava o que veio do link: cadastro (validado pelas mesmas regras da ficha), respostas e SWOT, e os acessos no
// documento de acessos (só acrescenta; nada volta para a tela).
export async function salvarOnboarding(db, cliente, body = {}, { por = 'link', agora = new Date() } = {}) {
  const campos = {};
  for (const c of CAMPOS_LINK) if (Object.prototype.hasOwnProperty.call(body.campos || {}, c.chave)) campos[c.chave] = body.campos[c.chave];
  if (Object.keys(campos).length) await salvarCadastro(db, cliente.id, campos, { veDinheiro: false });
  const respostas = { ...(cliente.onboarding_respostas || {}) };
  for (const q of QUESTOES) {
    if (!Object.prototype.hasOwnProperty.call(body.respostas || {}, q.chave)) continue;
    const v = txt(body.respostas[q.chave], 4000);
    if (v) respostas[q.chave] = v; else delete respostas[q.chave];
  }
  respostas._atualizado_em = agora.toISOString(); respostas._por = por;
  await db`UPDATE vybe_clientes SET onboarding_respostas=${JSON.stringify(respostas)}::jsonb WHERE id=${cliente.id}`;
  const acessos = ACESSOS_PEDIDOS.map(([k, rot]) => [rot, txt(body.acessos?.[k], 1500)]).filter(([, v]) => v);
  if (acessos.length) {
    const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', dateStyle: 'short', timeStyle: 'short' }).format(agora);
    const bloco = `\n\n— Recebido pelo onboarding (${por === 'link' ? 'link do cliente' : 'na reunião'}) em ${quando} —\n` + acessos.map(([r, v]) => `${r}:\n${v}`).join('\n\n');
    const [a] = await db`SELECT id FROM vybe_acessos WHERE cliente_id=${cliente.id} ORDER BY atualizado_em DESC NULLS LAST LIMIT 1`;
    if (a) await db`UPDATE vybe_acessos SET doc_conteudo=COALESCE(doc_conteudo,'') || ${bloco}, doc_atualizado_em=NOW(), atualizado_em=NOW() WHERE id=${a.id}`;
    else await db`INSERT INTO vybe_acessos (nome, cliente_id, doc_conteudo, doc_atualizado_em) VALUES (${'Dados & Acessos - ' + cliente.nome}, ${cliente.id}, ${bloco.trim()}, NOW())`;
  }
  return { ok: true, acessos_recebidos: acessos.length };
}

// ── página do link ───────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function htmlDoOnboarding(cliente, token) {
  const r = cliente.onboarding_respostas || {};
  const campo = (c) => {
    const v = valorDoCampo(cliente, c);
    const id = `c_${c.chave}`;
    const entrada = c.tipo === 'longo' ? `<textarea id="${id}" name="${c.chave}" data-g="campos" rows="3">${esc(v)}</textarea>`
      : c.tipo === 'opcao' ? `<select id="${id}" name="${c.chave}" data-g="campos"><option value="">Escolher…</option>${c.opcoes.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input id="${id}" name="${c.chave}" data-g="campos" value="${esc(v)}" ${c.tipo === 'data' ? 'type="date"' : c.tipo === 'email' ? 'type="email"' : c.tipo === 'url' ? 'type="url" placeholder="https://"' : 'type="text"'}>`;
    return `<label class="${c.largo ? 'largo' : ''}"><span>${esc(c.rotulo)}</span>${entrada}</label>`;
  };
  const pergunta = (q) => `<label class="largo"><span>${esc(q.rotulo)}</span><textarea name="${q.chave}" data-g="respostas" rows="${q.secao === 'swot' ? 4 : 3}">${esc(r[q.chave] || '')}</textarea></label>`;
  const secoesCadastro = SECOES_CADASTRO.filter((s) => s.id !== 'contrato').map((s) => {
    const cs = CAMPOS_LINK.filter((c) => c.secao === s.id);
    return cs.length ? `<fieldset><legend>${esc(s.titulo)}</legend><div class="grade">${cs.map(campo).join('')}</div></fieldset>` : '';
  }).join('');
  const bloco = (titulo, sub, secao) => `<fieldset><legend>${titulo}</legend>${sub ? `<p class="sub">${sub}</p>` : ''}<div class="grade ${secao === 'swot' ? 'swot' : ''}">${QUESTOES.filter((q) => q.secao === secao).map(pergunta).join('')}</div></fieldset>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Onboarding · ${esc(cliente.nome)} · Vybe</title><style>
:root{--papel:#F6F3EE;--tinta:#1F1D1A;--apagado:#6B675F;--linha:#E6E0D6;--laranja:#FF7A2F;--acao:#C2490C}
*{box-sizing:border-box}body{margin:0;background:var(--papel);color:var(--tinta);font:15px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 120px}header h1{font-size:24px;margin:6px 0}header p{color:var(--apagado);margin:0}
.marca{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:8px;background:var(--laranja);color:#fff;font-weight:800}
fieldset{border:1px solid var(--linha);border-radius:18px;background:#fff;margin:16px 0;padding:16px}legend{font-weight:800;font-size:16px;padding:0 6px}
.sub{color:var(--apagado);margin:0 0 10px;font-size:13.5px}.grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.grade.swot{grid-template-columns:repeat(2,minmax(0,1fr))}label{display:flex;flex-direction:column;gap:5px;min-width:0}label.largo{grid-column:1/-1}.swot label{grid-column:auto}
label span{font-weight:600;font-size:13px}input,select,textarea{width:100%;border:1px solid var(--linha);border-radius:12px;padding:9px 12px;font:inherit;background:#fff;color:var(--tinta);color-scheme:light}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--laranja);box-shadow:0 0 0 3px rgba(255,122,47,.18)}
.barra{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);border-top:1px solid var(--linha);padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:center}
button{border:0;border-radius:12px;background:var(--laranja);color:#fff;font-weight:700;padding:12px 22px;font-size:15px;cursor:pointer}button:disabled{opacity:.6}
#aviso{font-size:13.5px;color:var(--apagado)}#aviso.ok{color:#11613A;font-weight:700}#aviso.erro{color:#B42318;font-weight:700}
.cofre{background:#FAF5EE;border-radius:12px;padding:10px 12px;font-size:13px;color:var(--apagado);margin-bottom:10px}
@media (max-width:640px){.grade,.grade.swot{grid-template-columns:1fr}}
</style></head><body><main>
<header><span class="marca">V</span><h1>Bem-vindo à Vybe, ${esc(cliente.nome)}!</h1><p>Estas respostas são o ponto de partida do nosso trabalho. Preencha no seu tempo: dá para salvar e voltar depois pelo mesmo link. Nada aqui é público.</p></header>
<form id="f" onsubmit="return false">
${secoesCadastro}
${bloco('Sobre o negócio', 'Conte com as suas palavras. Respostas curtas também ajudam.', 'negocio')}
${bloco('A marca', '', 'marca')}
${bloco('Análise SWOT', 'Forças e fraquezas são de dentro da empresa; oportunidades e ameaças vêm do mercado.', 'swot')}
<fieldset><legend>Acessos</legend><p class="cofre">🔒 Os acessos vão direto para o cofre da Vybe, que só a administração abre. Depois de enviados, eles não aparecem mais nesta página.</p>
<div class="grade">${ACESSOS_PEDIDOS.map(([k, rot]) => `<label class="largo"><span>${esc(rot)}</span><textarea name="${k}" data-g="acessos" rows="2" autocomplete="off" placeholder="usuário / senha / observações"></textarea></label>`).join('')}</div></fieldset>
</form></main>
<div class="barra"><span id="aviso">As respostas ficam salvas para a Vybe.</span><button id="salvar" type="button">Salvar respostas</button></div>
<script>
const b=document.getElementById('salvar'),a=document.getElementById('aviso');
b.onclick=async()=>{const corpo={campos:{},respostas:{},acessos:{}};document.querySelectorAll('[data-g]').forEach(e=>{corpo[e.dataset.g][e.name]=e.value});
 b.disabled=true;a.className='';a.textContent='Salvando…';
 try{const r=await fetch(location.pathname+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Não foi possível salvar.');a.className='ok';a.textContent='Salvo! Obrigado. Você pode voltar e completar depois.';
  document.querySelectorAll('[data-g="acessos"]').forEach(e=>e.value='');}
 catch(e){a.className='erro';a.textContent=e.message}finally{b.disabled=false}};
</script></body></html>`;
}

export async function paginaDoOnboarding(req, res, db) {
  await garantirSchemaReunioes(db);
  const token = String(req.query?.t || '');
  const cliente = await clienteDoToken(db, token);
  if (!cliente) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send('<!doctype html><meta charset="utf-8"><title>Link expirado</title><p style="font:16px system-ui;padding:32px">Este link de onboarding não vale mais. Peça um novo para a Vybe.</p>');
  }
  if (req.method === 'POST') {
    // ?junto=1: aberto pela Vybe para preencher com o cliente na reunião (fica registrado assim no cofre).
    try { return res.status(200).json(await salvarOnboarding(db, cliente, req.body || {}, { por: req.query?.junto === '1' ? 'reuniao' : 'link' })); }
    catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); throw e; }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  return res.status(200).send(htmlDoOnboarding(cliente, token));
}

// ── transcrição pelo bot (fase 2) ────────────────────────────────────────────
// O bot (PC do Paulo) transcreve com o transcrever.py (faster-whisper) e o Qwen sugere resumo, decisões e demandas.
// O áudio sai do Drive em trechos de até 2,5 MB (cabem na resposta da função); a transcrição volta por outra consulta.
export const TRECHO_AUDIO = 2.5 * 1024 * 1024;

export async function reunioesParaTranscrever(db) {
  return (await db`SELECT r.id::text AS id, c.nome AS cliente, r.tipo, r.titulo, TO_CHAR(r.data, 'YYYY-MM-DD') AS data, r.gravacao_drive_id AS arquivo,
      r.gravacao_bytes AS bytes, r.pauta, r.resumo AS ata, r.participantes
    FROM vybe_cliente_reunioes r JOIN vybe_clientes c ON c.id = r.cliente_id
    WHERE r.gravacao_drive_id IS NOT NULL AND r.transcricao IS NULL AND r.estado NOT IN ('transcricao_falhou')
    ORDER BY r.atualizado_em NULLS LAST LIMIT 2`).map((r) => ({ ...r, bytes: Number(r.bytes) || null }));
}

export async function trechoDaGravacao(db, { id, inicio = 0 }, baixarTrecho) {
  const [r] = await db`SELECT gravacao_drive_id AS arquivo, gravacao_bytes AS bytes FROM vybe_cliente_reunioes WHERE id=${Number(id)}`;
  if (!r?.arquivo) throw erro('Reunião sem gravação.', 404);
  const total = Number(r.bytes) || 0, de = Math.max(0, Number(inicio) || 0);
  if (total && de >= total) return { fim: true, inicio: de, total, conteudo: '' };
  const ate = total ? Math.min(total - 1, de + TRECHO_AUDIO - 1) : de + TRECHO_AUDIO - 1;
  const bytes = await baixarTrecho(r.arquivo, de, ate);
  return { inicio: de, total, conteudo: bytes.toString('base64'), fim: !bytes.length || (total ? de + bytes.length >= total : bytes.length < TRECHO_AUDIO) };
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
function limparDemanda(d = {}) {
  const titulo = txt(d.titulo, 200);
  if (!titulo) return null;
  return { titulo, formato: txt(d.formato, 60), responsavel: txt(d.responsavel, 80), briefing: txt(d.briefing, 3000),
    prazo: DATA.test(String(d.prazo || '')) ? d.prazo : null, veiculacao: DATA.test(String(d.veiculacao || '')) ? d.veiculacao : null, conteudo_id: null };
}

export async function guardarTranscricao(db, { id, transcricao, resumo, decisoes, demandas, falhou }) {
  if (falhou) {
    await db`UPDATE vybe_cliente_reunioes SET estado='transcricao_falhou', atualizado_em=NOW() WHERE id=${Number(id)}`;
    return { ok: true };
  }
  const sugestoes = { resumo: txt(resumo, 4000), decisoes: (Array.isArray(decisoes) ? decisoes : []).map((x) => txt(x, 400)).filter(Boolean).slice(0, 20),
    demandas: (Array.isArray(demandas) ? demandas : []).map(limparDemanda).filter(Boolean).slice(0, 20), em: new Date().toISOString() };
  const [n] = await db`UPDATE vybe_cliente_reunioes SET transcricao=${txt(transcricao, 60000)}, sugestoes=${JSON.stringify(sugestoes)}::jsonb,
      resumo=CASE WHEN resumo='' THEN ${sugestoes.resumo} ELSE resumo END, estado='transcrita', atualizado_em=NOW()
    WHERE id=${Number(id)} RETURNING id`;
  if (!n) throw erro('Reunião não encontrada.', 404);
  return { ok: true, demandas: sugestoes.demandas.length };
}

// Cadastra no quadro de Solicitações as demandas escolhidas (com o que a pessoa ajustou na tela). Uma transação só.
export async function cadastrarDemandasDaReuniao(db, quem, { id, demandas }, { criarConteudoNaTransacao, boardDemandas }) {
  const [r] = await db`SELECT r.id, r.cliente_id, r.sugestoes, r.titulo, r.tipo, TO_CHAR(r.data,'DD/MM/YYYY') AS data, c.nome AS cliente
    FROM vybe_cliente_reunioes r JOIN vybe_clientes c ON c.id = r.cliente_id WHERE r.id=${Number(id)}`;
  if (!r) throw erro('Reunião não encontrada.', 404);
  const escolhidas = (Array.isArray(demandas) ? demandas : []).map(limparDemanda).filter(Boolean).slice(0, 20);
  if (!escolhidas.length) throw erro('Escolha ao menos uma demanda.');
  const origem = `Saiu da reunião "${r.titulo || TIPOS_REUNIAO[r.tipo] || 'reunião'}" de ${r.data}.`;
  const criadas = await db.comTransacao(async (tx) => {
    const feitas = [];
    for (const d of escolhidas) {
      const c = await criarConteudoNaTransacao(tx, quem, { board: boardDemandas, titulo: d.titulo, cliente: r.cliente, formato: d.formato || null,
        prazo: d.prazo, veiculacao: d.veiculacao, status: 'nova_demanda', briefing: [d.briefing, origem, d.responsavel ? `Responsável sugerido: ${d.responsavel}.` : ''].filter(Boolean).join('\n\n') });
      feitas.push({ titulo: d.titulo, conteudo_id: String(c.conteudo_id) });
    }
    const sug = r.sugestoes || {};
    sug.cadastradas = [...(sug.cadastradas || []), ...feitas];
    await tx`UPDATE vybe_cliente_reunioes SET sugestoes=${JSON.stringify(sug)}::jsonb, estado='cadastrada', atualizado_em=NOW() WHERE id=${r.id}`;
    return feitas;
  });
  return { ok: true, criadas };
}
