// Página pública /aprovar-pecas/<token> (server/conteudo-aprovacao.js tem as regras).
// Servida por api/painel.js (area=aprovar_pecas), sem sessão: o token é o segredo.
//   GET                      a página (HTML, padrão Irecity claro, cabe no celular)
//   GET  &arquivo=<id>       o arquivo da peça (proxy do Drive; só peças do cliente do link em aprovação)
//   POST {conteudo_id, acao, nome, comentario}  a resposta (JSON)
import { randomBytes } from 'node:crypto';
import { pecasDoLink, arquivoDoLink, responderPeca, LIMITE_COMENTARIO, LIMITE_NOME } from './conteudo-aprovacao.js';
import { LOGO_VYBE } from './vybe-logo.js';

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
  if (nonce) res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`);
}

const CSS = `*{box-sizing:border-box}body{margin:0;background:#F6F3EE;color:#1F1D1A;font:500 15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
.topo{display:flex;align-items:center;gap:12px;max-width:760px;margin:0 auto;padding:22px 16px 6px}
.marca{width:44px;height:44px;border-radius:12px;background:#1F1D1A;display:grid;place-items:center;flex:none}.marca img{width:32px;height:auto;display:block}
.kicker{font:700 11px system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A84E00;margin:0}
h1{font:700 26px/1.15 "Space Grotesk",system-ui,sans-serif;letter-spacing:-.02em;margin:2px 0 0;overflow-wrap:anywhere}
main{max-width:760px;margin:0 auto;padding:8px 16px 48px}
.intro{color:#6B675F;margin:6px 0 14px;font-size:14px}
.progresso{display:flex;align-items:center;gap:10px;margin:0 0 18px;font:600 13px system-ui,-apple-system,"Segoe UI",sans-serif;color:#6B675F}
.progresso i{flex:1;height:6px;border-radius:3px;background:#E6E0D6;overflow:hidden}.progresso i b{display:block;height:100%;width:0;background:#11613A;border-radius:3px;transition:width .3s cubic-bezier(.2,.8,.2,1)}
.cartao{background:#fff;border:1px solid #E6E0D6;border-radius:18px;box-shadow:0 1px 2px rgba(31,29,26,.05),0 8px 24px rgba(31,29,26,.05);padding:16px;margin:0 0 14px}
.cartao h2{font:700 18px/1.25 "Space Grotesk",system-ui,sans-serif;margin:0 0 4px;letter-spacing:-.01em;overflow-wrap:anywhere}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.pilula{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;font:700 11.5px system-ui,-apple-system,"Segoe UI",sans-serif;background:#F1F2F3;color:#5B6268}
.pilula.espera{background:#EAF1FF;color:#1F4FA8}.pilula.sem{background:#F3EFE8;color:#6B675F}
.pilula.ok{background:#E7F6EE;color:#11613A}.pilula.ajuste{background:#FCE7F1;color:#A3366F}
.video{margin:0 0 12px;border-radius:14px;overflow:hidden;background:#1F1D1A}
.video video{display:block;width:100%;max-height:70vh;background:#1F1D1A}
.video figcaption{display:flex;justify-content:space-between;gap:8px;padding:8px 12px;color:#E9E4DC;font:600 12.5px system-ui,-apple-system,"Segoe UI",sans-serif}
.video figcaption a{color:#FFB98F}
.galeria{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;border-radius:14px;scrollbar-width:none;overscroll-behavior-x:contain}
.galeria::-webkit-scrollbar{display:none}
.galeria img{flex:0 0 100%;width:100%;max-height:70vh;object-fit:contain;scroll-snap-align:center;background:#FBFAF7;border:1px solid #E6E0D6;border-radius:14px}
.galeria:focus-visible{outline:0;box-shadow:0 0 0 3px rgba(255,122,47,.32)}
.contador{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0 12px;font:600 12.5px system-ui,-apple-system,"Segoe UI",sans-serif;color:#6B675F}
.contador .pontos{display:flex;gap:4px}.contador .pontos i{width:6px;height:6px;border-radius:50%;background:#D9D2C6}.contador .pontos i.on{background:#1F1D1A}
.imagem{display:block;width:100%;max-height:70vh;object-fit:contain;margin:0 0 12px;border-radius:14px;border:1px solid #E6E0D6;background:#FBFAF7}
.arquivos{display:grid;gap:6px;margin:0 0 12px}
.arquivos a{display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;border:1px solid #E6E0D6;background:#FBFAF7;color:#C2490C;font:700 13px system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;overflow-wrap:anywhere}
.arquivos svg{flex:none}
.sem-arte{display:flex;gap:10px;align-items:flex-start;margin:0;padding:12px 14px;border-radius:12px;background:#F3EFE8;color:#5E5A53;font-size:14px}
.sem-arte svg{flex:none;margin-top:2px}
.acoes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button{font:inherit}
.btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:44px;padding:0 16px;border-radius:12px;border:1px solid #E6E0D6;background:#fff;color:#1F1D1A;font:600 14.5px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
.btn:hover{border-color:#FF7A2F;color:#C2490C}
.btn.sim{background:#11613A;border-color:#11613A;color:#fff;font-weight:700}
.btn.sim:hover{background:#0D4F2F;color:#fff}
.btn.principal{background:#FF7A2F;border-color:#FF7A2F;color:#fff;font-weight:700;box-shadow:0 8px 20px -8px #E8602E}
.btn.principal:hover{background:#E8602E;color:#fff}
.btn:focus-visible,textarea:focus-visible,input:focus-visible,.video a:focus-visible,.arquivos a:focus-visible{outline:0;box-shadow:0 0 0 3px rgba(255,122,47,.32);border-color:#FF7A2F}
.btn[disabled]{opacity:.55;cursor:default}
.ajuste{margin-top:10px;display:none}.ajuste.aberto{display:block}
textarea,input{width:100%;border:1px solid #E6E0D6;border-radius:12px;background:#fff;color:#1F1D1A;font:500 15px system-ui,-apple-system,"Segoe UI",sans-serif;padding:10px 12px;color-scheme:light}
textarea{min-height:96px;resize:vertical}
.conta{display:block;text-align:right;color:#6B675F;font-size:12px;margin:4px 0 8px}
.nome{margin:0 0 18px}.nome label{display:block;font:700 12px system-ui,-apple-system,"Segoe UI",sans-serif;color:#6B675F;margin:0 0 6px}
.nome input{height:44px}
.resposta{padding:12px 14px;border-radius:12px;font:600 14px system-ui,-apple-system,"Segoe UI",sans-serif;margin-top:10px}
.resposta.ok{background:#E7F6EE;color:#11613A}.resposta.ajuste{background:#FCE7F1;color:#A3366F}.resposta.erro{background:#FFF1F1;color:#B42318}
.vazio{text-align:center;padding:32px 18px}.vazio b{display:block;font:700 18px "Space Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;margin-bottom:4px}.vazio span{color:#6B675F}
.historico h3{font:700 11px system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#A84E00;margin:22px 0 8px}
.historico li{list-style:none;padding:8px 0;border-top:1px solid #F0EBE3;font-size:13.5px}.historico ul{padding:0;margin:0}
.historico small{color:#6B675F}
.rodape{color:#6B675F;font-size:12px;text-align:center;margin-top:26px}
@media (max-width:480px){h1{font-size:22px}.cartao{padding:14px}}
@media (prefers-reduced-motion:reduce){.galeria{scroll-behavior:auto}.progresso i b{transition:none}}`;

function paginaSimples(res, codigo, titulo, msg) {
  const nonce = randomBytes(16).toString('base64');
  cabecalhos(res, nonce);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(codigo).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Vybe</title><style nonce="${nonce}">${CSS}</style></head><body><div class="topo"><div class="marca"><img src="${LOGO_VYBE}" alt="Vybe"></div><div><p class="kicker">Vybe · Aprovação</p><h1>${esc(titulo)}</h1></div></div><main><div class="cartao vazio"><b>${esc(titulo)}</b><span>${esc(msg)}</span></div></main></body></html>`);
}

const ICONE_CLIPE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10.5 4.5 5.4 9.6a1.4 1.4 0 0 0 2 2l5.3-5.3a2.8 2.8 0 0 0-4-4L3.4 7.6a4.2 4.2 0 0 0 6 6l4.1-4.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const ICONE_ESPERA = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
export const TEXTO_SEM_ARTE = 'A arte ainda não está aqui. A Vybe avisa quando chegar; não dá para aprovar sem ver.';

// A arte da peça: vídeo com player na página, várias imagens como galeria de deslizar (carrossel),
// uma imagem inteira e o resto (PDF etc.) como link. Tudo pela mesma rota /arquivo/<id>.
function midiasHtml(p, base) {
  const src = (a) => `${esc(base)}/arquivo/${esc(a.id)}`;
  const videos = p.arquivos.filter((a) => a.video), imagens = p.arquivos.filter((a) => a.imagem && !a.video), outros = p.arquivos.filter((a) => !a.imagem && !a.video);
  const v = videos.map((a) => `<figure class="video"><video controls preload="metadata" playsinline src="${src(a)}" aria-label="${esc(a.nome)}">Seu navegador não toca este vídeo aqui. <a href="${src(a)}" target="_blank" rel="noopener noreferrer">Abrir ${esc(a.nome)}</a></video>
    <figcaption><span>Vídeo<span data-duracao></span></span><a href="${src(a)}" target="_blank" rel="noopener noreferrer">Abrir em tela cheia</a></figcaption></figure>`).join('');
  const img = (a, i, n) => `<img src="${src(a)}" alt="${esc(n > 1 ? `Imagem ${i + 1} de ${n}: ${a.nome}` : a.nome)}" loading="lazy">`;
  const g = imagens.length > 1
    ? `<div class="galeria" tabindex="0" role="group" aria-label="Carrossel com ${imagens.length} imagens; deslize para ver">${imagens.map((a, i) => img(a, i, imagens.length)).join('')}</div>
    <p class="contador"><span data-pos aria-live="polite">1 de ${imagens.length}</span><span class="pontos" aria-hidden="true">${imagens.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</span></p>`
    : imagens.length ? img(imagens[0], 0, 1).replace('<img ', '<img class="imagem" ') : '';
  const o = outros.length ? `<div class="arquivos">${outros.map((a) => `<a href="${src(a)}" target="_blank" rel="noopener noreferrer">${ICONE_CLIPE}Abrir ${esc(a.nome)}</a>`).join('')}</div>` : '';
  return v + g + o;
}

export function paginaHtml(dados, { nonce, base }) {
  const { cliente, expira_em, pecas, respondidas } = dados;
  const cartoes = pecas.map((p) => {
    const temArte = p.arquivos.length > 0;
    // Sem arte, sem aprovar: a peça aparece, mas os botões só surgem quando o arquivo chega
    // (o servidor também recusa aprovar sem arquivo, em responderPeca).
    const corpo = temArte
      ? `${midiasHtml(p, base)}
      <div class="acoes"><button type="button" class="btn" data-acao="abrir-ajuste" aria-expanded="false">Pedir ajuste</button><button type="button" class="btn sim" data-acao="aprovar">Aprovar</button></div>
      <div class="ajuste"><label class="kicker" for="aj-${esc(p.id)}">O que precisa mudar?</label>
        <textarea id="aj-${esc(p.id)}" maxlength="${LIMITE_COMENTARIO}" placeholder="Ex.: trocar a foto principal e corrigir o horário para 19h."></textarea>
        <span class="conta" data-conta>0/${LIMITE_COMENTARIO}</span>
        <button type="button" class="btn principal" data-acao="ajuste">Enviar pedido de ajuste</button></div>`
      : `<p class="sem-arte">${ICONE_ESPERA}<span>${TEXTO_SEM_ARTE}</span></p>`;
    return `<article class="cartao" data-peca="${esc(p.id)}"${temArte ? '' : ' data-sem-arte'}>
      <h2>${esc(p.titulo || 'Peça')}</h2>
      <div class="meta">${p.formato ? `<span class="pilula">${esc(p.formato)}</span>` : ''}${p.veiculacao ? `<span class="pilula">Publica em ${esc(dataBr(p.veiculacao))}</span>` : ''}${temArte ? '<span class="pilula espera">Esperando sua aprovação</span>' : '<span class="pilula sem">Esperando a arte</span>'}</div>
      ${corpo}
      <div class="saida" aria-live="polite"></div>
    </article>`;
  }).join('');
  const comArte = pecas.filter((p) => p.arquivos.length).length;
  const historico = respondidas.length ? `<section class="historico"><h3>Já respondidas por este link</h3><ul>${respondidas.map((r) =>
    `<li><b>${esc(r.titulo)}</b> — ${r.acao === 'aprovar' ? 'aprovada' : 'ajuste pedido'} por ${esc(r.nome)} <small>· ${esc(diaHora(r.em))}</small></li>`).join('')}</ul></section>` : '';
  const vazio = `<div class="cartao vazio"><b>Nada esperando sua aprovação agora</b><span>Quando a Vybe mandar novas peças, elas aparecem aqui neste mesmo link.</span></div>`;
  // Progresso: só o que existe de verdade, as peças respondidas nesta página.
  const progresso = pecas.length ? `<p class="progresso"><span><b data-feitas>0</b> de ${pecas.length} ${pecas.length === 1 ? 'respondida' : 'respondidas'}</span><i aria-hidden="true"><b data-barra></b></i></p>` : '';
  const semArte = pecas.length - comArte;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<title>Aprovação de peças · ${esc(cliente)}</title><style nonce="${nonce}">${CSS}</style></head><body>
<div class="topo"><div class="marca"><img src="${LOGO_VYBE}" alt="Vybe"></div><div><p class="kicker">Vybe · Aprovação de peças</p><h1>${esc(cliente)}</h1></div></div>
<main><p class="intro">${pecas.length ? `${pecas.length === 1 ? 'Uma peça espera' : `${pecas.length} peças esperam`} a sua aprovação.${comArte ? ' Veja cada uma e toque em <b>Aprovar</b> ou em <b>Pedir ajuste</b>.' : ''}${semArte ? ` ${semArte === 1 ? 'Uma ainda está' : `${semArte} ainda estão`} sem a arte.` : ''}` : 'Obrigado por acompanhar a sua produção com a Vybe.'} Este link vale até ${esc(diaHora(expira_em))}.</p>
${progresso}
${comArte ? `<div class="nome"><label for="nome">Seu nome</label><input id="nome" maxlength="${LIMITE_NOME}" autocomplete="name" placeholder="Quem está aprovando"></div>` : ''}
${pecas.length ? cartoes : vazio}${historico}
<p class="rodape">Este link é só seu. Ele mostra apenas as peças em aprovação da sua empresa.</p></main>
<script nonce="${nonce}">(()=>{const nome=document.getElementById('nome');try{nome&&(nome.value=localStorage.getItem('vybe.aprovar.nome')||'')}catch{}
const total=document.querySelectorAll('.cartao[data-peca]').length;let feitas=0;
const contar=()=>{const f=document.querySelector('[data-feitas]'),b=document.querySelector('[data-barra]');if(f)f.textContent=feitas;if(b)b.style.width=(total?Math.round(feitas/total*100):0)+'%'};
const saida=(c,cls,t)=>{const s=c.querySelector('.saida');s.innerHTML='';const d=document.createElement('div');d.className='resposta '+cls;d.textContent=t;s.append(d)};
const mmss=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
document.querySelectorAll('.video video').forEach(v=>{const pinta=()=>{if(isFinite(v.duration)&&v.duration>0){const d=v.closest('.video').querySelector('[data-duracao]');if(d)d.textContent=' · '+mmss(v.duration)}};v.addEventListener('loadedmetadata',pinta);pinta()});
document.querySelectorAll('.galeria').forEach(g=>{const n=g.children.length,pos=g.nextElementSibling.querySelector('[data-pos]'),pts=[...g.nextElementSibling.querySelectorAll('.pontos i')];let i0=0;
const ver=()=>{const i=Math.max(0,Math.min(n-1,Math.round(g.scrollLeft/Math.max(1,g.clientWidth+8))));if(i===i0)return;i0=i;pos.textContent=(i+1)+' de '+n;pts.forEach((p,k)=>p.classList.toggle('on',k===i))};
g.addEventListener('scroll',ver,{passive:true});g.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();g.scrollBy({left:(e.key==='ArrowRight'?1:-1)*(g.clientWidth+8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})})});
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
feitas++;contar();
saida(c,acao==='aprovar'?'ok':'ajuste',acao==='aprovar'?'Aprovada. Obrigado! A Vybe segue com a publicação.':'Pedido de ajuste enviado. A Vybe ajusta e manda de novo.')}
catch(err){c.querySelectorAll('button').forEach(x=>x.disabled=false);saida(c,'erro',err.message)}});contar();})();</script>
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
