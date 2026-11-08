// Página pública /aprovar-pecas/<token> (server/conteudo-aprovacao.js tem as regras).
// Servida por api/painel.js (area=aprovar_pecas), sem sessão: o token é o segredo.
//   GET                      a página (HTML, padrão Irecity claro, cabe no celular)
//   GET  &arquivo=<id>       o arquivo da peça (proxy do Drive; só peças do cliente do link em aprovação)
//   POST {conteudo_id, acao, nome, comentario}  a resposta (JSON)
import { randomBytes } from 'node:crypto';
import { pecasDoLink, arquivoDoLink, responderPeca, LIMITE_COMENTARIO, LIMITE_NOME } from './conteudo-aprovacao.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const corpoDe = (req) => (req.body && typeof req.body === 'object' ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })());
const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const diaHora = (d) => { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); } catch { return ''; } };
const TETO_ARQUIVO = 60 * 1024 * 1024;

function cabecalhos(res, nonce) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  if (nonce) res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self'; media-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`);
}

const CSS = `*{box-sizing:border-box}body{margin:0;background:#F6F3EE;color:#1F1D1A;font:500 15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
.topo{display:flex;align-items:center;gap:12px;max-width:760px;margin:0 auto;padding:22px 16px 6px}
.marca{width:40px;height:40px;border-radius:12px;background:#FF7A2F;color:#fff;display:grid;place-items:center;font:800 15px system-ui;flex:none}
.kicker{font:700 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#A84E00;margin:0}
h1{font:700 26px/1.15 "Space Grotesk",system-ui,sans-serif;letter-spacing:-.02em;margin:2px 0 0}
main{max-width:760px;margin:0 auto;padding:8px 16px 48px}
.intro{color:#6B675F;margin:6px 0 18px;font-size:14px}
.cartao{background:#fff;border:1px solid #E6E0D6;border-radius:18px;box-shadow:0 1px 2px rgba(31,29,26,.05),0 8px 24px rgba(31,29,26,.05);padding:16px;margin:0 0 14px}
.cartao h2{font:700 18px/1.25 "Space Grotesk",system-ui,sans-serif;margin:0 0 4px;letter-spacing:-.01em;overflow-wrap:anywhere}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.pilula{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;font:700 11.5px system-ui;background:#F1F2F3;color:#5B6268}
.pilula.espera{background:#EAF1FF;color:#1F4FA8}
.pilula.ok{background:#E7F6EE;color:#11613A}.pilula.ajuste{background:#FCE7F1;color:#A3366F}
.midias{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0 0 12px}
.midias a{display:block;border-radius:12px;overflow:hidden;border:1px solid #E6E0D6;background:#FBFAF7;color:#C2490C;font:700 13px system-ui;text-decoration:none}
.midias img{display:block;width:100%;height:auto;max-height:420px;object-fit:contain;background:#FBFAF7}
.midias .arq{padding:14px 12px;overflow-wrap:anywhere}
.midias.uma{grid-template-columns:1fr}
.sem-midia{color:#6B675F;font-size:13px;margin:0 0 12px}
.acoes{display:flex;flex-wrap:wrap;gap:8px}
button{font:inherit}
.btn{appearance:none;height:40px;padding:0 16px;border-radius:12px;border:1px solid #E6E0D6;background:#fff;color:#1F1D1A;font:600 14px system-ui;cursor:pointer}
.btn:hover{border-color:#FF7A2F;color:#C2490C}
.btn.principal{background:#FF7A2F;border-color:#FF7A2F;color:#fff;font-weight:700;box-shadow:0 8px 20px -8px #E8602E}
.btn.principal:hover{background:#E8602E;color:#fff}
.btn:focus-visible,textarea:focus-visible,input:focus-visible{outline:0;box-shadow:0 0 0 3px rgba(255,122,47,.22);border-color:#FF7A2F}
.btn[disabled]{opacity:.55;cursor:default}
.ajuste{margin-top:10px;display:none}.ajuste.aberto{display:block}
textarea,input{width:100%;border:1px solid #E6E0D6;border-radius:12px;background:#fff;color:#1F1D1A;font:500 15px system-ui;padding:10px 12px;color-scheme:light}
textarea{min-height:96px;resize:vertical}
.conta{display:block;text-align:right;color:#6B675F;font-size:12px;margin:4px 0 8px}
.nome{margin:0 0 18px}.nome label{display:block;font:700 12px system-ui;color:#6B675F;margin:0 0 6px}
.nome input{height:44px}
.resposta{padding:12px 14px;border-radius:12px;font:600 14px system-ui;margin-top:10px}
.resposta.ok{background:#E7F6EE;color:#11613A}.resposta.ajuste{background:#FCE7F1;color:#A3366F}.resposta.erro{background:#FFF1F1;color:#B42318}
.vazio{text-align:center;padding:32px 18px}.vazio b{display:block;font:700 18px "Space Grotesk",system-ui;margin-bottom:4px}.vazio span{color:#6B675F}
.historico h3{font:700 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#A84E00;margin:22px 0 8px}
.historico li{list-style:none;padding:8px 0;border-top:1px solid #F0EBE3;font-size:13.5px}.historico ul{padding:0;margin:0}
.historico small{color:#6B675F}
.rodape{color:#6B675F;font-size:12px;text-align:center;margin-top:26px}
@media (max-width:480px){h1{font-size:22px}.acoes .btn{flex:1 1 100%}.midias{grid-template-columns:1fr}}`;

function paginaSimples(res, codigo, titulo, msg) {
  const nonce = randomBytes(16).toString('base64');
  cabecalhos(res, nonce);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(codigo).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Vybe</title><style nonce="${nonce}">${CSS}</style></head><body><div class="topo"><div class="marca" aria-hidden="true">V</div><div><p class="kicker">Vybe · Aprovação</p><h1>${esc(titulo)}</h1></div></div><main><div class="cartao vazio"><b>${esc(titulo)}</b><span>${esc(msg)}</span></div></main></body></html>`);
}

export function paginaHtml(dados, { nonce, base }) {
  const { cliente, expira_em, pecas, respondidas } = dados;
  const cartoes = pecas.map((p) => {
    const midias = p.arquivos.length
      ? `<div class="midias${p.arquivos.length === 1 ? ' uma' : ''}">${p.arquivos.map((a) => `<a href="${esc(base)}/arquivo/${esc(a.id)}" target="_blank" rel="noopener noreferrer">${a.imagem
        ? `<img src="${esc(base)}/arquivo/${esc(a.id)}" alt="${esc(a.nome)}" loading="lazy">` : `<span class="arq">Abrir ${esc(a.nome)}</span>`}</a>`).join('')}</div>`
      : '<p class="sem-midia">A Vybe ainda não anexou o arquivo desta peça aqui. Se precisar, peça pelo seu canal de atendimento.</p>';
    return `<article class="cartao" data-peca="${esc(p.id)}">
      <h2>${esc(p.titulo || 'Peça')}</h2>
      <div class="meta">${p.formato ? `<span class="pilula">${esc(p.formato)}</span>` : ''}${p.veiculacao ? `<span class="pilula">Publica em ${esc(dataBr(p.veiculacao))}</span>` : ''}<span class="pilula espera">Esperando sua aprovação</span></div>
      ${midias}
      <div class="acoes"><button type="button" class="btn principal" data-acao="aprovar">Aprovar</button><button type="button" class="btn" data-acao="abrir-ajuste" aria-expanded="false">Pedir ajuste</button></div>
      <div class="ajuste"><label class="kicker" for="aj-${esc(p.id)}">O que precisa mudar?</label>
        <textarea id="aj-${esc(p.id)}" maxlength="${LIMITE_COMENTARIO}" placeholder="Ex.: trocar a foto principal e corrigir o horário para 19h."></textarea>
        <span class="conta" data-conta>0/${LIMITE_COMENTARIO}</span>
        <button type="button" class="btn principal" data-acao="ajuste">Enviar pedido de ajuste</button></div>
      <div class="saida" aria-live="polite"></div>
    </article>`;
  }).join('');
  const historico = respondidas.length ? `<section class="historico"><h3>Já respondidas por este link</h3><ul>${respondidas.map((r) =>
    `<li><b>${esc(r.titulo)}</b> — ${r.acao === 'aprovar' ? 'aprovada' : 'ajuste pedido'} por ${esc(r.nome)} <small>· ${esc(diaHora(r.em))}</small></li>`).join('')}</ul></section>` : '';
  const vazio = `<div class="cartao vazio"><b>Nada esperando sua aprovação agora</b><span>Quando a Vybe mandar novas peças, elas aparecem aqui neste mesmo link.</span></div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<title>Aprovação de peças · ${esc(cliente)}</title><style nonce="${nonce}">${CSS}</style></head><body>
<div class="topo"><div class="marca" aria-hidden="true">V</div><div><p class="kicker">Vybe · Aprovação de peças</p><h1>${esc(cliente)}</h1></div></div>
<main><p class="intro">${pecas.length ? `${pecas.length === 1 ? 'Uma peça espera' : `${pecas.length} peças esperam`} a sua aprovação. Veja cada uma e toque em <b>Aprovar</b> ou em <b>Pedir ajuste</b>.` : 'Obrigado por acompanhar a sua produção com a Vybe.'} Este link vale até ${esc(diaHora(expira_em))}.</p>
${pecas.length ? `<div class="nome"><label for="nome">Seu nome</label><input id="nome" maxlength="${LIMITE_NOME}" autocomplete="name" placeholder="Quem está aprovando"></div>` : ''}
${pecas.length ? cartoes : vazio}${historico}
<p class="rodape">Este link é só seu. Ele mostra apenas as peças em aprovação da sua empresa.</p></main>
<script nonce="${nonce}">(()=>{const nome=document.getElementById('nome');try{nome&&(nome.value=localStorage.getItem('vybe.aprovar.nome')||'')}catch{}
const saida=(c,cls,t)=>{const s=c.querySelector('.saida');s.innerHTML='';const d=document.createElement('div');d.className='resposta '+cls;d.textContent=t;s.append(d)};
document.addEventListener('input',e=>{const t=e.target;if(t.tagName==='TEXTAREA'){const c=t.closest('.cartao').querySelector('[data-conta]');c.textContent=t.value.length+'/${LIMITE_COMENTARIO}'}});
document.addEventListener('click',async e=>{const b=e.target.closest('button[data-acao]');if(!b)return;const c=b.closest('.cartao');const acao=b.dataset.acao;
if(acao==='abrir-ajuste'){const a=c.querySelector('.ajuste');a.classList.toggle('aberto');b.setAttribute('aria-expanded',a.classList.contains('aberto'));if(a.classList.contains('aberto'))a.querySelector('textarea').focus();return}
const n=(nome&&nome.value||'').trim();if(!n){saida(c,'erro','Escreva seu nome no topo da página antes de responder.');nome&&nome.focus();return}
const comentario=acao==='ajuste'?c.querySelector('textarea').value.trim():'';if(acao==='ajuste'&&!comentario){saida(c,'erro','Escreva o que precisa ajustar.');return}
try{localStorage.setItem('vybe.aprovar.nome',n)}catch{}
c.querySelectorAll('button').forEach(x=>x.disabled=true);
try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conteudo_id:c.dataset.peca,acao,nome:n,comentario})});
const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Não foi possível registrar agora. Tente de novo.');
c.querySelector('.acoes').remove();c.querySelector('.ajuste').remove();const p=c.querySelector('.pilula.espera');
if(p){p.className='pilula '+(acao==='aprovar'?'ok':'ajuste');p.textContent=acao==='aprovar'?'Aprovada':'Ajuste pedido'}
saida(c,acao==='aprovar'?'ok':'ajuste',acao==='aprovar'?'Aprovada. Obrigado! A Vybe segue com a publicação.':'Pedido de ajuste enviado. A Vybe ajusta e manda de novo.')}
catch(err){c.querySelectorAll('button').forEach(x=>x.disabled=false);saida(c,'erro',err.message)}});})();</script>
</body></html>`;
}

export async function paginaAprovarPecas(req, res, sql, { baixarDoDrive, fazer } = {}) {
  const token = String(req.query?.t || '');
  try {
    if (req.method === 'POST') {
      cabecalhos(res);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try {
        const r = await responderPeca(sql, token, corpoDe(req), fazer);
        return res.status(200).json({ ok: true, ...r });
      } catch (e) { return res.status(e.status || 500).json({ error: e.status ? e.message : 'Não foi possível registrar agora. Tente de novo.' }); }
    }
    if (req.method !== 'GET') { cabecalhos(res); return res.status(405).json({ error: 'Método não permitido.' }); }
    if (req.query?.arquivo !== undefined) {
      cabecalhos(res);
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      let a;
      try { a = await arquivoDoLink(sql, token, req.query.arquivo); } catch (e) { return res.status(e.status === 410 ? 410 : 404).json({ error: e.message }); }
      if (Number(a.tamanho_bytes || 0) > TETO_ARQUIVO) return res.status(413).json({ error: 'Arquivo grande demais para abrir por aqui. Peça o link à Vybe.' });
      const r = await baixarDoDrive(a.drive_file_id);
      if (!r?.ok) return res.status(502).json({ error: 'Não foi possível abrir o arquivo agora.' });
      const tipo = String(r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase();
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length > TETO_ARQUIVO) return res.status(413).json({ error: 'Arquivo grande demais para abrir por aqui.' });
      // Inline só o que não executa nada no nosso endereço: imagem (menos SVG), vídeo e PDF.
      const seguro = (/^image\//.test(tipo) && tipo !== 'image/svg+xml') || /^video\//.test(tipo) || tipo === 'application/pdf';
      const nome = String(a.nome || `arquivo${a.extensao || ''}`).replace(/["\r\n]/g, '');
      res.setHeader('Content-Type', seguro ? tipo : 'application/octet-stream');
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('Content-Disposition', `${seguro ? 'inline' : 'attachment'}; filename="${nome.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nome)}`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).end(bytes);
    }
    const dados = await pecasDoLink(sql, token);
    const nonce = randomBytes(16).toString('base64');
    cabecalhos(res, nonce);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(paginaHtml(dados, { nonce, base: `/aprovar-pecas/${token}` }));
  } catch (e) {
    if (e.status === 503) return paginaSimples(res, 503, 'Aprovação indisponível', 'A Vybe está terminando de preparar esta página. Tente de novo mais tarde.');
    return paginaSimples(res, e.status === 410 ? 410 : 404, 'Link indisponível', e.status ? e.message : 'Este link não vale mais. Peça um novo à Vybe.');
  }
}
