// Metas do Comercial e formulário público de captura de leads (Paulo, 08/11/2026; inspirado no AgencyFlow).
//
// Onde guarda (sem migração nova): vybe_carteira_config (chave/valor jsonb, já criada pelas migrações do Irecity,
// 2026-11-07-carteira.sql). Chaves:
//   comercial_metas      { 'AAAA-MM': { mrr, avulso, negocios, leads } }   (só donos editam)
//   comercial_formulario { token, ativo, criado_por, criado_por_nome, gerado_em } (só donos geram, trocam e desligam)
// Sem a tabela, a aba Funil abre e mostra "aguardando a migração"; salvar responde 503 explicado.
//
// Formulário (/lead/<token>, api/painel.js area=lead, sem login): quem preenche vira oportunidade na primeira etapa
// do funil (Empresa, fase Novo) com legado.origem = 'formulario' e os dados de contato em legado.contato.
// A oportunidade fica em nome do dono que gerou o link (criado_por é obrigatório no CRM); o histórico diz
// "Formulário de leads". Nada aqui envia mensagem: retornar o contato é trabalho da equipe.
// Segurança: token aleatório de 24 bytes no link (trocar invalida o antigo); campo isca (honeypot); limite por campo
// (shared/comercial-calculos.js validarLead); limite de envios por IP (memória da instância + contagem no banco pelo
// hash do IP, que não guarda o IP em si) e um teto geral por 10 minutos; tudo que volta à tela passa por esc();
// as respostas não trazem id, nome de quem gerou nem erro do banco.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import calc from '../shared/comercial-calculos.js';

export const CHAVE_METAS = 'comercial_metas';
export const CHAVE_FORMULARIO = 'comercial_formulario';
export const AVISO_CONFIG = 'Metas e formulário de leads aguardando a migração 2026-11-07-carteira.sql (tabela vybe_carteira_config). O Paulo aplica.';
export const LIMITE_IP_MINUTO = 3;
export const LIMITE_IP_DIA = 20;
export const LIMITE_GERAL_10MIN = 40;
const TETO_CORPO = 8000;

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const semTabela = (e) => e?.code === '42P01';
export const tokenComFormato = (t) => /^[A-Za-z0-9_-]{32}$/.test(String(t || ''));
const hash = (s) => createHash('sha256').update(String(s)).digest();

async function lerConfig(sql, chave) {
  const [l] = await sql`SELECT valor FROM vybe_carteira_config WHERE chave=${chave}`;
  const v = l?.valor; if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return v ?? null;
}

// ---------- Painel (sessão) ----------
// Para a aba Funil: metas por mês e o estado do formulário. O token só vai para dono (quem copia o link).
export async function configComercial(sql, { dono = false } = {}) {
  try {
    const [metas, form] = await Promise.all([lerConfig(sql, CHAVE_METAS), lerConfig(sql, CHAVE_FORMULARIO)]);
    const formulario = form && form.token ? { ativo: Boolean(form.ativo), gerado_em: form.gerado_em || null, ...(dono && form.ativo ? { token: form.token } : {}) } : { ativo: false, gerado_em: null };
    return { disponivel: true, metas: metas && typeof metas === 'object' && !Array.isArray(metas) ? metas : {}, formulario };
  } catch (e) {
    if (!semTabela(e)) throw e;
    return { disponivel: false, aviso: AVISO_CONFIG, metas: {}, formulario: { ativo: false, gerado_em: null } };
  }
}

// aplicar: 'mes' (só o mês) ou 'resto_do_ano' (do mês escolhido até dezembro).
export async function salvarMetas(sql, quem, b) {
  const mes = String(b.mes || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) falhar('Mês inválido (use AAAA-MM).');
  const metas = calc.validarMetas(b.metas);
  const aplicar = b.aplicar === 'resto_do_ano' ? 'resto_do_ano' : 'mes';
  const meses = aplicar === 'mes' ? [mes] : Array.from({ length: 13 - Number(mes.slice(5)) }, (_, i) => mes.slice(0, 5) + String(Number(mes.slice(5)) + i).padStart(2, '0'));
  const novo = Object.fromEntries(meses.map((m) => [m, metas]));
  try {
    // Junta no JSON que já existe (outro mês salvo por outra pessoa não se perde).
    await sql`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por, atualizado_em) VALUES (${CHAVE_METAS}, ${JSON.stringify(novo)}::jsonb, ${quem.id}, now())
      ON CONFLICT (chave) DO UPDATE SET valor = vybe_carteira_config.valor || EXCLUDED.valor, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`;
  } catch (e) { if (semTabela(e)) falhar(AVISO_CONFIG, 503); throw e; }
  return { meses, metas };
}

// Gera (ou troca) o token do link: o antigo deixa de valer na hora.
export async function gerarFormulario(sql, quem) {
  const token = randomBytes(24).toString('base64url');
  const valor = { token, ativo: true, criado_por: String(quem.id), criado_por_nome: String(quem.nome || ''), gerado_em: new Date().toISOString() };
  try {
    await sql`INSERT INTO vybe_carteira_config (chave, valor, atualizado_por, atualizado_em) VALUES (${CHAVE_FORMULARIO}, ${JSON.stringify(valor)}::jsonb, ${quem.id}, now())
      ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`;
  } catch (e) { if (semTabela(e)) falhar(AVISO_CONFIG, 503); throw e; }
  return { token, ativo: true };
}
export async function desligarFormulario(sql, quem) {
  try {
    await sql`UPDATE vybe_carteira_config SET valor = valor || '{"ativo":false}'::jsonb, atualizado_por = ${quem.id}, atualizado_em = now() WHERE chave = ${CHAVE_FORMULARIO}`;
  } catch (e) { if (semTabela(e)) falhar(AVISO_CONFIG, 503); throw e; }
  return { ativo: false };
}

// Últimos leads do formulário (com o contato, para a equipe retornar). Só para quem edita o Comercial.
export async function ultimosLeads(sql, limite = 8) {
  const linhas = await sql`SELECT o.id::text, o.nome, o.etapa, o.criado_em, o.legado->'contato' AS contato FROM vybe_crm_oportunidades o
    WHERE o.legado->>'origem' = 'formulario' ORDER BY o.id DESC LIMIT ${Math.max(1, Math.min(50, limite))}`;
  return linhas.map((l) => {
    let c = l.contato; if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = {}; } }
    c = c && typeof c === 'object' ? c : {};
    const t = (k, max) => String(c[k] || '').slice(0, max);
    return { id: l.id, nome: l.nome, etapa: l.etapa, criado_em: l.criado_em instanceof Date ? l.criado_em.toISOString() : String(l.criado_em || ''),
      contato: { nome: t('nome', 120), empresa: t('empresa', 160), whatsapp: t('whatsapp', 20), cidade: t('cidade', 80), interesse: t('interesse', 60), mensagem: t('mensagem', 300) } };
  });
}

// ---------- Público (sem sessão) ----------
// Formulário ativo cujo token confere (comparação em tempo constante). null = indisponível (sem dizer por quê).
export async function formularioDoToken(sql, token) {
  if (!tokenComFormato(token)) return null;
  let f;
  try { f = await lerConfig(sql, CHAVE_FORMULARIO); } catch (e) { if (semTabela(e)) return null; throw e; }
  if (!f?.ativo || !tokenComFormato(f.token) || !/^[1-9]\d{0,15}$/.test(String(f.criado_por || ''))) return null;
  return timingSafeEqual(hash(f.token), hash(token)) ? f : null;
}

// Limite por IP na memória da instância (primeira barreira, barata). O banco confere de novo (vale entre instâncias).
const recentes = new Map();
export function limiteNaMemoria(chave, agora = Date.now(), { max = LIMITE_IP_MINUTO, janela = 60000 } = {}) {
  if (recentes.size > 5000) for (const [k, v] of recentes) if (!v.some((t) => agora - t < janela)) recentes.delete(k);
  const lista = (recentes.get(chave) || []).filter((t) => agora - t < janela);
  if (lista.length >= max) { recentes.set(chave, lista); return false; }
  lista.push(agora); recentes.set(chave, lista); return true;
}
export const esquecerLimites = () => recentes.clear();
export function ipDe(req) {
  const h = req.headers || {}, encaminhado = String(h['x-forwarded-for'] || '').split(',')[0].trim();
  return String(h['x-real-ip'] || encaminhado || req.socket?.remoteAddress || 'desconhecido').slice(0, 64);
}
// Hash do IP com o token como sal: dá para contar envios sem guardar o IP (e trocar o link zera o vínculo).
const ipHash = (ip, token) => createHash('sha256').update(`${ip}|${token}`).digest('hex').slice(0, 32);
async function dentroDoLimiteNoBanco(sql, ip) {
  const [r] = await sql`SELECT
      count(*) FILTER (WHERE legado->>'ip' = ${ip} AND criado_em > now() - interval '1 minute')::int AS minuto,
      count(*) FILTER (WHERE legado->>'ip' = ${ip} AND criado_em > now() - interval '1 day')::int AS dia,
      count(*) FILTER (WHERE criado_em > now() - interval '10 minutes')::int AS geral
    FROM vybe_crm_oportunidades WHERE legado->>'origem' = 'formulario' AND criado_em > now() - interval '1 day'`;
  return r.minuto < LIMITE_IP_MINUTO && r.dia < LIMITE_IP_DIA && r.geral < LIMITE_GERAL_10MIN;
}

export async function registrarLead(sql, f, dados, ip) {
  const nome = (dados.empresa || dados.nome).slice(0, 200), zap = calc.formatarWhatsapp(dados.whatsapp);
  const contato = { nome: dados.nome, empresa: dados.empresa, whatsapp: dados.whatsapp, cidade: dados.cidade, interesse: dados.interesse, mensagem: dados.mensagem };
  const legado = JSON.stringify({ origem: 'formulario', contato, ip, recebido_em: new Date().toISOString() });
  const proxima = `Retornar pelo WhatsApp ${zap}${dados.interesse ? ' · interesse: ' + dados.interesse : ''}`.slice(0, 2000);
  const obs = [`Chegou pelo formulário de leads: ${dados.nome}${dados.empresa ? ' (' + dados.empresa + ')' : ''}${dados.cidade ? ', ' + dados.cidade : ''}.`,
    `WhatsApp: ${zap}.`, dados.interesse ? `Interesse: ${dados.interesse}.` : '', dados.mensagem ? `Mensagem: ${dados.mensagem}` : ''].filter(Boolean).join(' ').slice(0, 4000);
  return sql.comTransacao(async (tx) => {
    const [o] = await tx`INSERT INTO vybe_crm_oportunidades (chave_empresa, nome, setor_empresa, etapa, criado_por, proxima_acao, legado)
      VALUES (${'form:' + randomBytes(9).toString('hex')}, ${nome}, '', 'empresa', ${f.criado_por}, ${proxima}, ${legado}::jsonb) RETURNING id, etapa`;
    await tx`INSERT INTO vybe_crm_historico (oportunidade_id, quem, quem_nome, de_etapa, para_etapa, tipo, observacao, detalhes)
      VALUES (${o.id}, ${f.criado_por}, 'Formulário de leads', NULL, ${o.etapa}, 'criacao', ${obs}, ${JSON.stringify({ origem: 'formulario' })}::jsonb)`;
    return { id: String(o.id) };
  });
}

const OK_PUBLICO = 'Recebemos o seu contato. A equipe da Vybe vai falar com você pelo WhatsApp em breve.';
// Corpo do envio (JSON ou formulário sem JavaScript). Sempre um objeto simples com texto.
function corpoDe(req) {
  let b = req.body;
  if (typeof b === 'string' || Buffer.isBuffer?.(b)) {
    const s = String(b); if (s.length > TETO_CORPO) return { grande: true };
    try { b = JSON.parse(s); } catch { b = Object.fromEntries(new URLSearchParams(s)); }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return {};
  try { if (JSON.stringify(b).length > TETO_CORPO) return { grande: true }; } catch { return {}; }
  return b;
}

// Recebe um envio. Devolve { status, corpo } sem nada interno (nem id, nem quem gerou o link, nem erro do banco).
export async function receberLead(sql, req, { agora = Date.now() } = {}) {
  const token = String(req.query?.t || '');
  const f = await formularioDoToken(sql, token);
  if (!f) return { status: 404, corpo: { error: 'Formulário indisponível.' } };
  const b = corpoDe(req);
  if (b.grande) return { status: 413, corpo: { error: 'Envio grande demais.' } };
  const ip = ipHash(ipDe(req), f.token);
  if (!limiteNaMemoria(ip, agora)) return { status: 429, corpo: { error: 'Muitos envios em pouco tempo. Espere um minuto e tente de novo.' } };
  const v = calc.validarLead(b);
  if (v.isca) return { status: 200, corpo: { ok: true, mensagem: OK_PUBLICO } }; // robô: finge que deu certo
  if (v.erro) return { status: 400, corpo: { error: v.erro, campo: v.campo || null } };
  if (!await dentroDoLimiteNoBanco(sql, ip)) return { status: 429, corpo: { error: 'Muitos envios em pouco tempo. Espere um pouco e tente de novo.' } };
  await registrarLead(sql, f, v.dados, ip);
  return { status: 200, corpo: { ok: true, mensagem: OK_PUBLICO } };
}

// ---------- Página pública ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function cabecalhos(res, nonce) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', nonce
    ? `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'`
    : "default-src 'none'; frame-ancestors 'none'");
}
// Padrão visual claro do Irecity (docs/padrao-visual.md): papel #F6F3EE, tinta #1F1D1A, laranja da Vybe só no botão, cantos 8px.
const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:#F6F3EE;color:#1F1D1A;font:500 15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.topo{display:flex;align-items:center;gap:12px;max-width:560px;margin:0 auto;padding:28px 16px 4px}
.marca{width:44px;height:44px;border-radius:8px;background:#FF7A2F;color:#fff;display:grid;place-items:center;font:800 18px "Inter Tight",Inter,system-ui,sans-serif;flex:none;letter-spacing:-.02em}
.kicker{font:700 11px Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A84E00;margin:0}
h1{font:700 25px/1.15 "Inter Tight",Inter,system-ui,sans-serif;letter-spacing:-.02em;margin:2px 0 0}
main{max-width:560px;margin:0 auto;padding:6px 16px 40px}
.intro{color:#6B675F;margin:8px 0 16px;font-size:14.5px}
form,.cartao{background:#fff;border:1px solid #E6E0D6;border-radius:8px;box-shadow:0 1px 2px rgba(31,29,26,.05),0 8px 24px rgba(31,29,26,.05);padding:18px 16px}
label{display:block;margin:0 0 14px}label span{display:block;font:600 13px Inter,system-ui,sans-serif;color:#6B675F;margin:0 0 6px}label span b{color:#B42318;font-weight:700}
input,select,textarea{width:100%;min-height:46px;border:1px solid #E6E0D6;border-radius:8px;background:#fff;color:#1F1D1A;font:500 16px Inter,system-ui,sans-serif;padding:10px 12px;color-scheme:light}
textarea{min-height:110px;resize:vertical}select{appearance:auto}
input:focus,select:focus,textarea:focus,button:focus-visible{outline:0;border-color:#FF7A2F;box-shadow:0 0 0 3px rgba(255,122,47,.22)}
.dupla{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
.isca{position:absolute!important;left:-10000px!important;width:1px;height:1px;overflow:hidden}
button{appearance:none;width:100%;min-height:48px;border:0;border-radius:8px;background:#FF7A2F;color:#fff;font:700 16px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 20px -8px #E8602E}
button:hover{background:#E8602E}button[disabled]{opacity:.6;cursor:wait}
.msg{margin:12px 0 0;padding:12px 14px;border-radius:8px;font:600 14px Inter,system-ui,sans-serif;display:none}.msg.ok{display:block;background:#E7F6EE;color:#11613A}.msg.erro{display:block;background:#FDECEC;color:#B42318}
.privacidade{color:#6B675F;font-size:12.5px;margin:12px 0 0}
.cartao b{display:block;font:700 18px "Inter Tight",Inter,system-ui,sans-serif;margin:0 0 4px}.cartao span{color:#6B675F}.cartao a{color:#C2490C;font-weight:700}
.rodape{color:#6B675F;font-size:12px;text-align:center;margin-top:22px}
@media (max-width:420px){h1{font-size:22px}.dupla{grid-template-columns:1fr}}`;
const cabeca = (titulo, nonce) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#F6F3EE"><title>${esc(titulo)} · Vybe</title><style nonce="${nonce}">${CSS}</style></head><body><div class="topo"><div class="marca" aria-hidden="true">V</div><div><p class="kicker">Vybe · Agência de marketing</p><h1>${esc(titulo)}</h1></div></div>`;

export function paginaSimples(res, codigo, titulo, msg, voltar = '') {
  const nonce = randomBytes(16).toString('base64');
  cabecalhos(res, nonce);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(codigo).send(`${cabeca(titulo, nonce)}<main><div class="cartao"><b>${esc(titulo)}</b><span>${esc(msg)}</span>${voltar ? `<p><a href="${esc(voltar)}">Voltar ao formulário</a></p>` : ''}</div><p class="rodape">Vybe · Irecê, Bahia</p></main></body></html>`);
}

export function paginaFormulario(nonce) {
  const L = calc.LIMITES_LEAD;
  const campo = (nome, rotulo, extra = '', obrigatorio = false) => `<label for="f-${nome}"><span>${esc(rotulo)}${obrigatorio ? ' <b aria-hidden="true">*</b>' : ''}</span><input id="f-${nome}" name="${nome}" maxlength="${L[nome]}"${obrigatorio ? ' required' : ''}${extra}></label>`;
  return `${cabeca('Fale com a Vybe', nonce)}<main>
<p class="intro">Conte um pouco sobre você e o seu negócio. A equipe da Vybe responde pelo WhatsApp.</p>
<form method="post" novalidate data-lead>
${campo('nome', 'Seu nome', ' autocomplete="name"', true)}
${campo('empresa', 'Empresa', ' autocomplete="organization"')}
<div class="dupla">${campo('whatsapp', 'WhatsApp com DDD', ' type="tel" inputmode="tel" autocomplete="tel" placeholder="(74) 99999-9999"', true)}${campo('cidade', 'Cidade', ' autocomplete="address-level2"')}</div>
<label for="f-interesse"><span>Interesse</span><select id="f-interesse" name="interesse"><option value="">Escolha (opcional)</option>${calc.INTERESSES_LEAD.map((i) => `<option>${esc(i)}</option>`).join('')}</select></label>
<label for="f-mensagem"><span>Mensagem</span><textarea id="f-mensagem" name="mensagem" maxlength="${L.mensagem}" placeholder="O que você precisa?"></textarea></label>
<div class="isca" aria-hidden="true"><label for="f-${calc.CAMPO_ISCA}">Não preencha este campo</label><input id="f-${calc.CAMPO_ISCA}" name="${calc.CAMPO_ISCA}" tabindex="-1" autocomplete="off"></div>
<button type="submit">Enviar</button>
<p class="msg" role="status" aria-live="polite" data-msg></p>
<p class="privacidade">Usamos estes dados só para falar com você sobre o seu pedido.</p>
</form><p class="rodape">Vybe · Irecê, Bahia</p></main>
<script nonce="${nonce}">(()=>{const f=document.querySelector('[data-lead]'),m=f.querySelector('[data-msg]'),b=f.querySelector('button');
f.addEventListener('submit',async(e)=>{e.preventDefault();if(b.disabled)return;const d=Object.fromEntries(new FormData(f));
if(!String(d.nome||'').trim()||String(d.whatsapp||'').replace(/\\D/g,'').length<10){m.className='msg erro';m.textContent='Preencha o seu nome e o WhatsApp com DDD.';return;}
b.disabled=true;m.className='msg';m.textContent='';
try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const j=await r.json().catch(()=>({}));
if(r.ok&&j.ok){f.reset();m.className='msg ok';m.textContent=j.mensagem||'Recebemos o seu contato.';}else{m.className='msg erro';m.textContent=j.error||'Não foi possível enviar agora. Tente de novo.';if(j.campo){const c=f.elements[j.campo];c&&c.focus();}}}
catch{m.className='msg erro';m.textContent='Sem conexão. Tente de novo.';}finally{b.disabled=false;}});})();</script></body></html>`;
}

// Rota pública: GET mostra o formulário; POST registra (JSON para a página com JavaScript, HTML para o envio sem ele).
// criarBanco: função que devolve o sql, como nas outras áreas (link sem formato de token nem abre o banco).
export async function paginaFormularioLeads(req, res, criarBanco) {
  const token = String(req.query?.t || '');
  const json = req.method === 'POST' && String(req.headers?.['content-type'] || '').includes('application/json');
  if (!tokenComFormato(token)) {
    if (json) { cabecalhos(res); return res.status(404).json({ error: 'Formulário indisponível.' }); }
    return paginaSimples(res, 404, 'Formulário indisponível', 'Este link não está mais ativo. Fale com a Vybe pelos canais oficiais.');
  }
  try {
    const sql = criarBanco();
    if (req.method === 'POST') {
      const r = await receberLead(sql, req);
      if (json) { cabecalhos(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.status(r.status).json(r.corpo); }
      if (r.status === 200) return paginaSimples(res, 200, 'Contato recebido', r.corpo.mensagem);
      return paginaSimples(res, r.status, r.status === 404 ? 'Formulário indisponível' : 'Não foi enviado', r.corpo.error, r.status === 404 ? '' : `/lead/${tokenComFormato(token) ? token : ''}`);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { cabecalhos(res); return res.status(405).json({ error: 'Método não permitido.' }); }
    if (!await formularioDoToken(sql, token)) return paginaSimples(res, 404, 'Formulário indisponível', 'Este link não está mais ativo. Fale com a Vybe pelos canais oficiais.');
    const nonce = randomBytes(16).toString('base64');
    cabecalhos(res, nonce);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(paginaFormulario(nonce));
  } catch (e) {
    console.error('[comercial-leads]', e?.code || '', e?.message || e);
    if (json) { cabecalhos(res); return res.status(503).json({ error: 'Não foi possível enviar agora. Tente de novo em instantes.' }); }
    return paginaSimples(res, 503, 'Formulário indisponível agora', 'Tente de novo em instantes.');
  }
}
