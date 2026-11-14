// Página pública /aprovar-pecas/<token> (server/conteudo-aprovacao.js tem as regras).
// Servida por api/painel.js (area=aprovar_pecas), sem sessão: o token é o segredo.
//   GET                      a página (HTML, padrão Irecity claro, cabe no celular)
//   GET  &arquivo=<id>       o arquivo da peça (proxy do Drive; só peças do cliente do link em aprovação)
//   POST {conteudo_id, acao, nome, comentario}  a resposta (JSON)
//   POST {acao:'vista', conteudo_id}            o cliente passou pela arte inteira da peça
//   POST {acao:'aprovar_vistas', nome, conteudo_ids}  "Aprovar todas as vistas" (aprovarVistas)
import { randomBytes } from 'node:crypto';
import { pecasDoLink, arquivoDoLink, responderPeca, registrarVista, aprovarVistas, LIMITE_COMENTARIO, LIMITE_NOME } from './conteudo-aprovacao.js';
import { LOGO_VYBE } from './vybe-logo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const corpoDe = (req) => (req.body && typeof req.body === 'object' ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })());
const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const diaHora = (d) => { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); } catch { return ''; } };
const TETO_ARQUIVO = 60 * 1024 * 1024;
// "bytes=ini-fim", "bytes=ini-" ou "bytes=-ultimos"; uma faixa só (o player não pede várias). null = arquivo inteiro.
export function faixaPedida(cabecalho, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(cabecalho || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  const ini = m[1] === '' ? Math.max(0, total - Number(m[2])) : Number(m[1]);
  const fim = m[1] === '' || m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  return ini <= fim && ini < total ? { ini, fim } : { invalida: true };
}

function cabecalhos(res, nonce) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  if (nonce) res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`);
}

const F = 'Inter,system-ui,-apple-system,"Segoe UI",sans-serif';
// Direção 3 (14/11/2026): fundo areia, cartão branco com canto 20, Aprovar em preto, Pedir ajuste no claro e o status
// em pílula clara com a bolinha na cor do catálogo; cheia só no ajuste (âmbar). A marca da Vybe continua no topo.
const CSS = `*{box-sizing:border-box}body{margin:0;background:#EAE6DE;color:#1F1D1A;font:400 15px/1.5 ${F};-webkit-text-size-adjust:100%}
.topo{display:flex;align-items:center;gap:12px;max-width:760px;margin:0 auto;padding:22px 16px 6px}
.marca{width:44px;height:44px;border-radius:12px;background:#1F1D1A;display:grid;place-items:center;flex:none}.marca img{width:32px;height:auto;display:block}
.kicker{font:600 12px ${F};letter-spacing:0;color:#6B665E;margin:0}
h1{font:700 26px/1.15 "Inter Tight",${F};letter-spacing:-.02em;margin:2px 0 0;overflow-wrap:anywhere}
main{max-width:760px;margin:0 auto;padding:8px 16px 48px}
.intro{color:#6B665E;margin:6px 0 14px;font-size:14px}.intro b{color:#1F1D1A;font-weight:600}
.progresso{display:flex;align-items:center;gap:10px;margin:0 0 18px;font:600 13px ${F};color:#6B665E}.progresso > span b{color:#1F1D1A}
.progresso i{flex:1;height:6px;border-radius:999px;background:#FFFFFF;overflow:hidden}.progresso i b{display:block;height:100%;width:0;background:#1F1D1A;border-radius:999px;transition:width .6s cubic-bezier(.22,1,.36,1)}
.cartao{background:#FFFFFF;border:0;border-radius:20px;padding:18px;margin:0 0 12px;animation:chega .45s cubic-bezier(.22,1,.36,1) both}
@keyframes chega{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.cartao h2{font:600 17px/1.3 "Inter Tight",${F};margin:0 0 8px;letter-spacing:-.01em;overflow-wrap:anywhere}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.pilula{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:999px;font:600 12px ${F};background:#F3F1EC;color:#4A463F;white-space:nowrap}
.pilula:is(.espera,.sem,.ok,.ajuste)::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:#C4C4C4}
.pilula.espera::before{background:#579BFC}.pilula.ok::before{background:#00C875}
.pilula.ajuste{display:inline-flex;margin:0;background:#FFF4D6;color:#7A4A00}.pilula.ajuste::before{background:#FDAB3D}
.video{margin:0 0 12px;border-radius:14px;overflow:hidden;background:#1F1D1A}
.video video{display:block;width:100%;max-height:70vh;background:#1F1D1A}
.video figcaption{display:flex;justify-content:space-between;gap:8px;padding:8px 12px;color:#F3F1EC;font:600 12.5px ${F}}
.video figcaption a{color:#FFFFFF}
.galeria{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;border-radius:14px;scrollbar-width:none;overscroll-behavior-x:contain}
.galeria::-webkit-scrollbar{display:none}
.galeria img{flex:0 0 100%;width:100%;max-height:70vh;object-fit:contain;scroll-snap-align:center;background:#F9F8F5;border:0;border-radius:14px}
.galeria:focus-visible{outline:2px solid #1F1D1A;outline-offset:2px}
.contador{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0 12px;font:600 12.5px ${F};color:#6B665E}
.contador .pontos{display:flex;gap:4px}.contador .pontos i{width:6px;height:6px;border-radius:50%;background:#E6E0D6}.contador .pontos i.on{background:#1F1D1A}
.imagem{display:block;width:100%;max-height:70vh;object-fit:contain;margin:0 0 12px;border-radius:14px;border:0;background:#F9F8F5}
.arquivos{display:grid;gap:6px;margin:0 0 12px}
.arquivos a{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;border:0;background:#F3F1EC;color:#1F1D1A;font:600 13px ${F};text-decoration:none;overflow-wrap:anywhere}
.arquivos svg{flex:none}
.sem-arte{display:flex;gap:10px;align-items:flex-start;margin:0;padding:12px 14px;border-radius:12px;background:#F3F1EC;color:#4A463F;font-size:14px}
.sem-arte svg{flex:none;margin-top:2px}
.acoes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button{font:inherit}
.btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:44px;padding:0 18px;border-radius:999px;border:0;background:#F3F1EC;color:#1F1D1A;font:500 14.5px ${F};cursor:pointer;transition:background-color .2s,transform .14s}
.btn:hover{background:#E6E0D6}.btn:active{transform:scale(.98)}
.btn.sim,.btn.principal{background:#1F1D1A;color:#FFFFFF;font-weight:600}
.btn.sim:hover,.btn.principal:hover{background:#4A463F;color:#FFFFFF}
.btn:focus-visible,.video a:focus-visible,.arquivos a:focus-visible{outline:2px solid #1F1D1A;outline-offset:2px}
.btn[disabled]{opacity:.5;cursor:default}
.ajuste{margin-top:10px;display:none}.ajuste.aberto{display:block}
.ajuste .kicker{display:block;margin:0 0 6px;color:#1F1D1A;font-size:12.5px}
textarea,input{width:100%;border:0;border-radius:12px;background:#F9F8F5;box-shadow:inset 0 0 0 1px #E6E0D6;color:#1F1D1A;font:400 15px ${F};padding:10px 14px;color-scheme:light}
textarea:focus-visible,input:focus-visible{outline:0;background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #1F1D1A}
textarea{min-height:96px;resize:vertical}
.conta{display:block;text-align:right;color:#6B665E;font-size:12px;margin:4px 0 8px}
.nome{margin:0 0 18px}.nome label{display:block;font:600 12.5px ${F};color:#1F1D1A;margin:0 0 6px}
.nome input{height:44px;background:#FFFFFF;box-shadow:none}.nome input:focus-visible{box-shadow:inset 0 0 0 1.5px #1F1D1A}
.resposta{padding:12px 14px;border-radius:12px;font:600 14px ${F};margin-top:10px}
.resposta.ok{background:#E8F5EC;color:#11613A}.resposta.ajuste{background:#FFF4D6;color:#7A4A00}.resposta.erro{background:#FDECEE;color:#B42318}
.vazio{text-align:center;padding:32px 18px}.vazio b{display:block;font:600 18px "Inter Tight",${F};margin-bottom:4px}.vazio span{color:#6B665E}
.historico h3{font:600 12px ${F};letter-spacing:0;color:#6B665E;margin:22px 0 8px}
.historico li{list-style:none;padding:8px 0;border-top:1px solid #E6E0D6;font-size:13.5px}.historico ul{padding:0;margin:0}
.historico small{color:#6B665E}
.rodape{color:#6B665E;font-size:12px;text-align:center;margin-top:26px}
.lote{display:none}.lote.on{display:block}.lote.feito [data-acao="lote-abrir"],.lote.feito .nota{display:none}
.resposta p{margin:8px 0 0}.lote.feito .resposta{margin-top:0}
.lote .nota{color:#6B665E;font-size:13.5px;margin:8px 0 0}
.btn.largo{width:100%;height:48px}
.lote .confirma{display:none}.lote.confirmando .confirma{display:block}.lote.confirmando [data-acao="lote-abrir"],.lote.confirmando .nota{display:none}
.lote .confirma p{margin:0 0 8px;font-size:14.5px}
.lote .confirma ul{margin:0 0 12px;padding:0 0 0 18px;font-size:14px;color:#4A463F}.lote .confirma li{margin:2px 0;overflow-wrap:anywhere}
.lote .fora{margin:10px 0 0;padding:0;list-style:none;font-size:13.5px;color:#4A463F}.lote .fora li{padding:6px 0;border-top:1px solid #F1EDE6}
@media (max-width:480px){h1{font-size:22px}.cartao{padding:14px}}
@media (prefers-reduced-motion:reduce){.galeria{scroll-behavior:auto}.progresso i b,.btn{transition:none}.cartao{animation:none}}`;

function paginaSimples(res, codigo, titulo, msg) {
  const nonce = randomBytes(16).toString('base64');
  cabecalhos(res, nonce);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(codigo).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Vybe</title><style nonce="${nonce}">${CSS}</style></head><body><div class="topo"><div class="marca"><img src="${LOGO_VYBE}" alt="Vybe"></div><div><p class="kicker">Vybe · Aprovação</p><h1>${esc(titulo)}</h1></div></div><main><div class="cartao vazio"><b>${esc(titulo)}</b><span>${esc(msg)}</span></div></main></body></html>`);
}

const ICONE_CLIPE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10.5 4.5 5.4 9.6a1.4 1.4 0 0 0 2 2l5.3-5.3a2.8 2.8 0 0 0-4-4L3.4 7.6a4.2 4.2 0 0 0 6 6l4.1-4.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const ICONE_ESPERA = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const ICONE_CHECK = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.2 8.4 6.6 11.6 12.8 4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
    return `<article class="cartao" data-peca="${esc(p.id)}"${temArte ? '' : ' data-sem-arte'}${p.vista ? ' data-vista' : ''}>
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
  // Progresso no topo (quadro 26): com o registro de vista no banco, "1 de 3 vistas · 0 respondidas" e a
  // barra das vistas; sem ele (migração não aplicada), só o que existe, as respondidas nesta página.
  const comVistas = Boolean(dados.vistas);
  const vistasJa = pecas.filter((p) => p.vista).length;
  const progresso = !pecas.length ? '' : comVistas
    ? `<p class="progresso" data-modo="vistas"><span><b data-vistas>${vistasJa}</b> de ${pecas.length} <span data-vistas-rot>${vistasJa === 1 ? 'vista' : 'vistas'}</span> · <b data-feitas>0</b> <span data-feitas-rot>respondidas</span></span><i aria-hidden="true"><b data-barra></b></i></p>`
    : `<p class="progresso"><span><b data-feitas>0</b> de ${pecas.length} ${pecas.length === 1 ? 'respondida' : 'respondidas'}</span><i aria-hidden="true"><b data-barra></b></i></p>`;
  // "Aprovar todas as vistas" no fim (quadro 26). A página liga quando há duas ou mais para aprovar.
  const lote = comArte ? `<section class="cartao lote" data-lote aria-live="polite">
    <button type="button" class="btn sim largo" data-acao="lote-abrir">${ICONE_CHECK}<span data-lote-rot>${comVistas ? 'Aprovar todas as vistas' : 'Aprovar todas'}</span></button>
    <p class="nota" data-lote-nota></p>
    <div class="confirma"><p data-lote-pergunta></p><ul data-lote-lista></ul>
      <div class="acoes"><button type="button" class="btn" data-acao="lote-voltar">Voltar</button><button type="button" class="btn sim" data-acao="lote-confirmar">Aprovar</button></div></div>
    <div class="saida"></div>
  </section>` : '';
  const semArte = pecas.length - comArte;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<title>Aprovação de peças · ${esc(cliente)}</title><style nonce="${nonce}">${CSS}</style></head><body>
<div class="topo"><div class="marca"><img src="${LOGO_VYBE}" alt="Vybe"></div><div><p class="kicker">Vybe · Aprovação de peças</p><h1>${esc(cliente)}</h1></div></div>
<main><p class="intro">${pecas.length ? `${pecas.length === 1 ? 'Uma peça espera' : `${pecas.length} peças esperam`} a sua aprovação.${comArte ? ' Veja cada uma e toque em <b>Aprovar</b> ou em <b>Pedir ajuste</b>.' : ''}${semArte ? ` ${semArte === 1 ? 'Uma ainda está' : `${semArte} ainda estão`} sem a arte.` : ''}` : 'Obrigado por acompanhar a sua produção com a Vybe.'} Este link vale até ${esc(diaHora(expira_em))}.</p>
${progresso}
${comArte ? `<div class="nome"><label for="nome">Seu nome</label><input id="nome" maxlength="${LIMITE_NOME}" autocomplete="name" placeholder="Quem está aprovando"></div>` : ''}
${pecas.length ? cartoes + lote : vazio}${historico}
<p class="rodape">Este link é só seu. Ele mostra apenas as peças em aprovação da sua empresa.</p></main>
<script nonce="${nonce}">(()=>{const nome=document.getElementById('nome');try{nome&&(nome.value=localStorage.getItem('vybe.aprovar.nome')||'')}catch{}
const VISTAS=${comVistas ? 'true' : 'false'};
const cartoes=[...document.querySelectorAll('.cartao[data-peca]')],total=cartoes.length,lote=document.querySelector('[data-lote]');
const plural=(n,um,varios)=>n===1?um:varios;
const respondida=c=>c.dataset.respondida==='1',comArte=c=>!c.hasAttribute('data-sem-arte'),vista=c=>c.hasAttribute('data-vista')||respondida(c);
const paraLote=()=>cartoes.filter(c=>comArte(c)&&!respondida(c)&&(!VISTAS||c.hasAttribute('data-vista')));
const saida=(c,cls,t)=>{const s=c.querySelector('.saida');s.innerHTML='';const d=document.createElement('div');d.className='resposta '+cls;d.textContent=t;s.append(d);return d};
const loteAtualiza=()=>{if(!lote||lote.dataset.ocupado)return;const n=paraLote().length;
const faltam=VISTAS?cartoes.filter(c=>comArte(c)&&!respondida(c)&&!c.hasAttribute('data-vista')).length:0;
lote.classList.toggle('on',n>=2||lote.dataset.resultado==='1');lote.classList.toggle('feito',n<2);if(n<2)lote.classList.remove('confirmando');
lote.querySelector('[data-lote-rot]').textContent=(VISTAS?'Aprovar todas as vistas':'Aprovar todas')+' ('+n+')';
lote.querySelector('[data-lote-nota]').textContent=VISTAS?(faltam?'Aprova as '+n+' peças que você já viu. '+plural(faltam,'Falta ver 1; ela fica','Faltam ver '+faltam+'; elas ficam')+' para depois.':'Aprova de uma vez as '+n+' peças que você já viu.'):'Aprova de uma vez as '+n+' peças com arte que ainda esperam a sua resposta.'};
const contar=()=>{const feitas=cartoes.filter(respondida).length,vistas=cartoes.filter(vista).length;
const f=document.querySelector('[data-feitas]'),b=document.querySelector('[data-barra]'),fr=document.querySelector('[data-feitas-rot]'),v=document.querySelector('[data-vistas]'),vr=document.querySelector('[data-vistas-rot]');
if(f)f.textContent=feitas;if(fr)fr.textContent=plural(feitas,'respondida','respondidas');if(v)v.textContent=vistas;if(vr)vr.textContent=plural(vistas,'vista','vistas');
if(b)b.style.width=(total?Math.round((VISTAS?vistas:feitas)/total*100):0)+'%';loteAtualiza()};
const marcarRespondida=(c,acao)=>{c.dataset.respondida='1';const a=c.querySelector('.acoes'),j=c.querySelector('.ajuste'),p=c.querySelector('.pilula.espera');if(a)a.remove();if(j)j.remove();
if(p){p.className='pilula '+(acao==='aprovar'?'ok':'ajuste');p.textContent=acao==='aprovar'?'Aprovada':'Ajuste pedido'}
saida(c,acao==='aprovar'?'ok':'ajuste',acao==='aprovar'?'Aprovada. Obrigado! A Vybe segue com a publicação.':'Pedido de ajuste enviado. A Vybe ajusta e manda de novo.')};
// Vista (quadro 26): a peça conta como vista quando o cliente passou pela arte inteira: cada imagem ao menos 60% na
// tela por 1,2 s já carregada (na galeria, cada uma), o vídeo tocado, o arquivo aberto. O servidor confere de novo.
try{if(VISTAS&&'IntersectionObserver' in window){const falta=new Map(),relogios=new Map();
const enviar=async(c,tentativa=0)=>{if(c.hasAttribute('data-vista')||c.dataset.enviando)return;c.dataset.enviando='1';
try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'vista',conteudo_id:c.dataset.peca})});const d=await r.json().catch(()=>({}));
if(r.ok&&d.vista){c.setAttribute('data-vista','');contar()}else if(r.status>=500&&tentativa<2)setTimeout(()=>enviar(c,tentativa+1),4000)}
catch{if(tentativa<2)setTimeout(()=>enviar(c,tentativa+1),4000)}finally{delete c.dataset.enviando}};
const viu=(c,el)=>{const s=falta.get(c);if(!s||!s.has(el))return;s.delete(el);if(!s.size)enviar(c)};
const io=new IntersectionObserver(es=>es.forEach(e=>{const el=e.target;clearTimeout(relogios.get(el));
if(e.isIntersecting&&e.intersectionRatio>=.6)relogios.set(el,setTimeout(()=>{if(el.complete&&el.naturalWidth){io.unobserve(el);viu(el.closest('.cartao'),el)}},1200))}),{threshold:[0,.6]});
cartoes.filter(c=>comArte(c)&&!c.hasAttribute('data-vista')).forEach(c=>{const s=new Set();falta.set(c,s);
c.querySelectorAll('.galeria img,img.imagem').forEach(img=>{s.add(img);io.observe(img);img.addEventListener('load',()=>{if(s.has(img)){io.unobserve(img);io.observe(img)}})});
c.querySelectorAll('.video').forEach(f=>{const v=f.querySelector('video');if(!v)return;s.add(v);v.addEventListener('play',()=>viu(c,v));f.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>viu(c,v)))});
c.querySelectorAll('.arquivos a').forEach(a=>{s.add(a);a.addEventListener('click',()=>viu(c,a))})})}}catch{}
const mmss=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
document.querySelectorAll('.video video').forEach(v=>{const pinta=()=>{if(isFinite(v.duration)&&v.duration>0){const d=v.closest('.video').querySelector('[data-duracao]');if(d)d.textContent=' · '+mmss(v.duration)}};v.addEventListener('loadedmetadata',pinta);pinta()});
document.querySelectorAll('.galeria').forEach(g=>{const n=g.children.length,pos=g.nextElementSibling.querySelector('[data-pos]'),pts=[...g.nextElementSibling.querySelectorAll('.pontos i')];let i0=0;
const ver=()=>{const i=Math.max(0,Math.min(n-1,Math.round(g.scrollLeft/Math.max(1,g.clientWidth+8))));if(i===i0)return;i0=i;pos.textContent=(i+1)+' de '+n;pts.forEach((p,k)=>p.classList.toggle('on',k===i))};
g.addEventListener('scroll',ver,{passive:true});g.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();g.scrollBy({left:(e.key==='ArrowRight'?1:-1)*(g.clientWidth+8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})})});
document.addEventListener('input',e=>{const t=e.target;if(t.tagName==='TEXTAREA'){const c=t.closest('.cartao').querySelector('[data-conta]');c.textContent=t.value.length+'/${LIMITE_COMENTARIO}'}});
const nomeOuAviso=c=>{const n=(nome&&nome.value||'').trim();if(!n){saida(c,'erro','Escreva seu nome no topo da página antes de responder.');nome&&nome.focus()}return n};
// "Aprovar todas as vistas": confirma com a lista, manda numa vez só e mostra o que ficou de fora e por quê.
const noLote=async(b,acao)=>{if(acao==='lote-voltar'){lote.classList.remove('confirmando');lote.querySelector('[data-acao="lote-abrir"]').focus();return}
const n=nomeOuAviso(lote);if(!n)return;const pecas=paraLote();if(!pecas.length){loteAtualiza();return}
if(acao==='lote-abrir'){lote.querySelector('.saida').innerHTML='';lote.querySelector('[data-lote-pergunta]').textContent='Aprovar '+pecas.length+' peças em nome de '+n+'?';
const ul=lote.querySelector('[data-lote-lista]');ul.innerHTML='';pecas.forEach(c=>{const li=document.createElement('li');li.textContent=c.querySelector('h2').textContent;ul.append(li)});
lote.querySelector('[data-acao="lote-confirmar"]').textContent='Aprovar '+pecas.length;lote.classList.add('confirmando');lote.querySelector('[data-acao="lote-confirmar"]').focus();return}
try{localStorage.setItem('vybe.aprovar.nome',n)}catch{}
lote.querySelectorAll('button').forEach(x=>x.disabled=true);lote.dataset.ocupado='1';
try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'aprovar_vistas',nome:n,conteudo_ids:pecas.map(c=>c.dataset.peca)})});
const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Nada foi aprovado: não foi possível registrar agora. Tente de novo.');
const ok=d.aprovadas||[],fora=d.recusadas||[];ok.forEach(a=>{const c=cartoes.find(x=>x.dataset.peca===String(a.conteudo_id));if(c)marcarRespondida(c,'aprovar')});
fora.forEach(f=>{const c=cartoes.find(x=>x.dataset.peca===String(f.conteudo_id));if(c&&/ainda não viu/.test(f.motivo||''))c.removeAttribute('data-vista')});
const res=saida(lote,ok.length?'ok':'erro',ok.length?plural(ok.length,'1 peça aprovada.',ok.length+' peças aprovadas.')+' Obrigado! A Vybe segue com a publicação.'+(d.aviso?' '+d.aviso:''):'Nenhuma peça foi aprovada.');
if(fora.length){const t=document.createElement('p');t.textContent=plural(fora.length,'Ficou de fora:','Ficaram de fora:');res.append(t);const ul=document.createElement('ul');ul.className='fora';
fora.forEach(f=>{const li=document.createElement('li');const c=cartoes.find(x=>x.dataset.peca===String(f.conteudo_id));const bb=document.createElement('b');bb.textContent=f.titulo||(c&&c.querySelector('h2').textContent)||'Peça';li.append(bb,' — '+f.motivo);ul.append(li)});res.append(ul)}
lote.dataset.resultado='1'}
catch(err){saida(lote,'erro',err.message)}
finally{delete lote.dataset.ocupado;lote.classList.remove('confirmando');lote.querySelectorAll('button').forEach(x=>x.disabled=false);contar()}};
document.addEventListener('click',async e=>{const b=e.target.closest('button[data-acao]');if(!b)return;const acao=b.dataset.acao;
if(acao.startsWith('lote-'))return noLote(b,acao);const c=b.closest('.cartao');
if(acao==='abrir-ajuste'){const a=c.querySelector('.ajuste');a.classList.toggle('aberto');b.setAttribute('aria-expanded',a.classList.contains('aberto'));if(a.classList.contains('aberto'))a.querySelector('textarea').focus();return}
const n=nomeOuAviso(c);if(!n)return;
const comentario=acao==='ajuste'?c.querySelector('textarea').value.trim():'';if(acao==='ajuste'&&!comentario){saida(c,'erro','Escreva o que precisa ajustar.');return}
try{localStorage.setItem('vybe.aprovar.nome',n)}catch{}
c.querySelectorAll('button').forEach(x=>x.disabled=true);
try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conteudo_id:c.dataset.peca,acao,nome:n,comentario})});
const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Não foi possível registrar agora. Tente de novo.');
marcarRespondida(c,acao);contar()}
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
        const corpo = corpoDe(req);
        const r = corpo.acao === 'vista' ? await registrarVista(sql, token, corpo)
          : corpo.acao === 'aprovar_vistas' ? await aprovarVistas(sql, token, corpo, fazer)
          : await responderPeca(sql, token, corpo, fazer);
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
      res.setHeader('Content-Disposition', `${seguro ? 'inline' : 'attachment'}; filename="${nome.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nome)}`);
      res.setHeader('Cache-Control', 'private, no-store');
      // Pedaço do arquivo (Range): o player do Safari/iPhone só toca vídeo de quem responde por partes (206).
      const parte = /^video\//.test(tipo) ? faixaPedida(req.headers?.range, bytes.length) : null;
      if (parte) {
        res.setHeader('Accept-Ranges', 'bytes');
        if (parte.invalida) { res.setHeader('Content-Range', `bytes */${bytes.length}`); return res.status(416).end(); }
        res.setHeader('Content-Range', `bytes ${parte.ini}-${parte.fim}/${bytes.length}`);
        res.setHeader('Content-Length', String(parte.fim - parte.ini + 1));
        return res.status(206).end(bytes.subarray(parte.ini, parte.fim + 1));
      }
      if (/^video\//.test(tipo)) res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', String(bytes.length));
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
