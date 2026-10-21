// Documento padrão do planejamento. Um desenho só, o da Vybe, para todos os
// clientes; do cliente entram o nome e o logo (Paulo, 20/10/2026: "manter um
// padrão Vybe e a gente adiciona a marca do cliente"). Serve para a prévia do
// painel, para o documento salvo no Drive e para a página de aprovação do
// cliente, onde ele pode pedir ajuste peça a peça.
import { createHash } from 'node:crypto';
import { LOGO_VYBE } from './vybe-logo.js';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = (v) => { try { const u = new URL(String(v)); return ['https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// Dentro do quadro (srcdoc) do painel e do VybeHub, um link "#peca-3" abriria
// a página de fora no lugar do documento (Paulo, 20/10/2026: "me levou pra
// tela inicial"). Os links internos só rolam até o lugar.
const LINKS_INTERNOS = `<script>document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;e.preventDefault();if(document.body.classList.contains('modo-um'))return;
document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({behavior:'smooth',block:'start'});});</script>`;
export function nomeDoMes(mes) { const [a, m] = String(mes).split('-').map(Number); return `${MESES[m - 1]} de ${a}`; }
const dia = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); if (!d) return ''; const w = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${SEMANA[w]}`; };
// Cores dos formatos, as mesmas no calendário e nas fichas.
const CORES_FORMATO = { Card: '#d9534f', Carrossel: '#c98a12', Reels: '#7b4bd6', Fotografia: '#2f8f5b', 'Vídeo': '#2c6fb3', Stories: '#d1497a', Outro: '#6b7280' };
const PAINEL = () => process.env.PAINEL_URL || 'https://vybepainel-v2.vercel.app';
// O agente costuma numerar o tema ("01 · Vai ter 13º?"); o número já está na ficha.
const semNumero = (t) => String(t || '').replace(/^\s*\d{1,2}\s*[·.\-–:)]\s*/, '');
const ehVideo = (f) => ['Reels', 'Vídeo'].includes(f);

// Planejamentos publicados antes dos campos objetivo/telas trazem tudo junto
// na referência ("Objetivo: … Texto das telas: Tela 1: … | Tela 2: …").
// Separa na hora de mostrar, sem mexer no que está guardado.
export function separarReferencia(ref = '') {
 let r = String(ref || ''), objetivo = '', telas = [];
 const mo = /^\s*Objetivo:\s*([\s\S]*?)(?=\s*Texto das telas:|$)/i.exec(r);
 if (mo) { objetivo = mo[1].trim(); r = r.slice(mo[0].length); }
 const mt = /^\s*Texto das telas:\s*([\s\S]*)$/i.exec(r);
 if (mt) { telas = mt[1].split(/\s*(?:\||\n)\s*(?=Tela\s*\d+\s*:)/i).map((t) => t.replace(/^Tela\s*\d+\s*:\s*/i, '').trim()).filter(Boolean); r = ''; }
 return { objetivo, telas, resto: r.trim() };
}
// Assinatura do conteúdo da peça: a decisão do head ou do cliente vale para
// esta versão da peça. Se a peça mudar, a decisão deixa de valer (Paulo,
// 20/10/2026: aprovar peça por peça; o que não mudou continua aprovado).
export function assinaturaDaPeca(p) {
 const c = [p.data, p.formato, p.tema, p.linha, p.objetivo, (p.telas || []).join('\u0001'), p.legenda, p.referencia, p.observacao].map((v) => String(v || '')).join('\u0002');
 return createHash('sha1').update(c).digest('hex').slice(0, 12);
}
// Peças prontas para mostrar, com a assinatura e as decisões que valem para
// elas. paraCliente: a revisão interna do head não sai para o cliente.
export function pecasComRevisao(conteudo, { paraCliente = false } = {}) {
 const rev = conteudo?.revisoes || {};
 return (conteudo?.pecas || []).map((p) => {
  const assinatura = assinaturaDaPeca(p), r = rev[assinatura] || {};
  return { ...pecaParaMostrar(p), assinatura, revisao_cliente: r.cliente || null, ...(paraCliente ? {} : { revisao_head: r.head || null }) };
 });
}
export function resumoDaRevisao(pecas) {
 const n = pecas.length, conta = (f) => pecas.filter(f).length;
 return { total: n, head_ok: conta((p) => p.revisao_head?.estado === 'ok'), head_ajustar: conta((p) => p.revisao_head?.estado === 'ajustar'),
  cliente_aprovadas: conta((p) => p.revisao_cliente?.estado === 'aprovada'), cliente_ajustes: conta((p) => p.revisao_cliente?.estado === 'ajuste') };
}
export function pecaParaMostrar(p) {
 if (p.objetivo || p.telas?.length || !p.referencia) return p;
 const s = separarReferencia(p.referencia);
 if (!s.objetivo && !s.telas.length) return p;
 return { ...p, objetivo: s.objetivo, telas: s.telas, referencia: s.resto };
}

function calendario(mes, pecas) {
 const [a, m] = String(mes).split('-').map(Number);
 const dias = new Date(Date.UTC(a, m, 0)).getUTCDate(), inicio = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7; // segunda primeiro
 const por = new Map();
 pecas.forEach((p, i) => { if (p.data?.startsWith(`${a}-${String(m).padStart(2, '0')}`)) { const d = Number(p.data.slice(8)); por.set(d, [...(por.get(d) || []), [p, i]]); } });
 const celulas = [...Array(inicio).fill('<td class="vazio"></td>')];
 for (let d = 1; d <= dias; d++) celulas.push(`<td><b>${d}</b>${(por.get(d) || []).map(([p, i]) => `<a href="#peca-${i + 1}" style="--f:${CORES_FORMATO[p.formato] || '#6b7280'}">${esc(p.formato)}</a>`).join('')}</td>`);
 while (celulas.length % 7) celulas.push('<td class="vazio"></td>');
 const linhas = [];
 for (let i = 0; i < celulas.length; i += 7) linhas.push(`<tr>${celulas.slice(i, i + 7).join('')}</tr>`);
 return `<div class="rolar"><table class="cal"><thead><tr>${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table></div>`;
}

// A resposta do cliente em cada peça: aprovar ou pedir ajuste, salva na hora
// (Paulo, 20/10/2026: "o cliente vai aprovando ou reprovando cada conteúdo").
function decisaoDaPeca(x, n, respondendo) {
 const r = x.revisao_cliente;
 const situacao = r?.estado === 'aprovada' ? `<p class="sit ok">Aprovada${r.nome ? ` por ${esc(r.nome)}` : ''}</p>`
  : r?.estado === 'ajuste' ? `<p class="sit ajuste">Ajuste pedido${r.nome ? ` por ${esc(r.nome)}` : ''}: ${esc(r.nota)}</p>` : '';
 if (!respondendo) return situacao ? `<div class="decisao">${situacao}</div>` : '';
 return `<div class="decisao" data-assinatura="${esc(x.assinatura)}" data-estado="${esc(r?.estado || '')}">${situacao || '<p class="sit">Sem resposta ainda</p>'}
<div class="acoes"><button type="button" class="sim" data-acao="aprovada">Aprovar esta peça</button><button type="button" class="nao" data-acao="abrir">Pedir ajuste</button>${r ? '<button type="button" class="link" data-acao="limpar">Desfazer</button>' : ''}</div>
<div class="nota" hidden><label>O que mudar na peça ${n}?<textarea rows="3" maxlength="1500" placeholder="Ex.: trocar a foto, mudar o título, mudar o dia…">${r?.estado === 'ajuste' ? esc(r.nota) : ''}</textarea></label><button type="button" class="sim" data-acao="ajuste">Enviar este ajuste</button></div></div>`;
}
// A revisão interna do head no próprio documento (Paulo, 20/10/2026: "tava
// ruim pro head ver e aprovar o documento e cada conteúdo"). Mostra também o
// que o cliente respondeu na rodada anterior.
// Os campos guardados da peça, para o head editar ali mesmo (Paulo, 20/10/2026).
const CAMPOS_DA_PECA = ['data', 'formato', 'tema', 'linha', 'objetivo', 'telas', 'legenda', 'referencia', 'observacao'];
function decisaoDoHead(x, n, revisando, i) {
 const h = x.revisao_head, c = x.revisao_cliente;
 const doCliente = c ? `<p class="sit ${c.estado === 'aprovada' ? 'ok' : 'ajuste'}">Cliente: ${c.estado === 'aprovada' ? 'aprovou' : `pediu ajuste: ${esc(c.nota)}`}</p>` : '';
 const sit = h?.estado === 'ok' ? `<p class="sit ok">OK na revisão${h.por ? ` de ${esc(h.por)}` : ''}</p>` : h?.estado === 'ajustar' ? `<p class="sit ajuste">Ajustar: ${esc(h.nota)}</p>` : '<p class="sit">Ainda não revisada</p>';
 if (!revisando) return `<div class="decisao">${doCliente}${h ? sit : ''}</div>`;
 return `<div class="decisao" data-assinatura="${esc(x.assinatura)}" data-indice="${i}" data-peca="${esc(JSON.stringify(Object.fromEntries(CAMPOS_DA_PECA.map((k) => [k, x[k] ?? (k === 'telas' ? [] : '')]))))}" data-estado="${h?.estado === 'ok' ? 'aprovada' : h?.estado === 'ajustar' ? 'ajuste' : ''}">${doCliente}${sit}
<div class="acoes"><button type="button" class="sim" data-acao="ok">Peça OK</button><button type="button" class="nao" data-acao="abrir">Ajustar</button><button type="button" class="nao" data-acao="editar">Editar peça</button>${h ? '<button type="button" class="link" data-acao="limpar">Desfazer</button>' : ''}</div>
<div class="nota" hidden><label>O que ajustar na peça ${n}? (o agente lê)<textarea rows="3" maxlength="1500">${h?.estado === 'ajustar' ? esc(h.nota) : ''}</textarea></label><button type="button" class="sim" data-acao="ajustar">Salvar ajuste</button></div></div>`;
}
function fichaDaPeca(x0, i, { paraCliente, respondendo, revisor, revisando }) {
 const x = x0.assinatura ? x0 : pecaParaMostrar(x0);
 const n = String(i + 1).padStart(2, '0'), corF = CORES_FORMATO[x.formato] || '#6b7280';
 // Telas numeradas ao lado da legenda, como no PDF do agente.
 const telas = x.telas?.length ? `<div class="telas"><b>Texto das telas</b><ol>${x.telas.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>` : '';
 const legenda = x.legenda ? `<div class="bloco"><b>${ehVideo(x.formato) ? 'Roteiro' : 'Legenda'}</b><p>${esc(x.legenda)}</p></div>` : '';
 const referencia = x.referencia ? (paraCliente
  ? `<details class="ref"><summary>${ehVideo(x.formato) ? 'Referência do vídeo' : 'Referência'}</summary><p>${esc(x.referencia)}</p></details>`
  : `<div class="ref"><b>${ehVideo(x.formato) ? 'Referência do vídeo' : 'Referência'}</b><p>${esc(x.referencia)}</p></div>`) : '';
 return `<article class="peca" id="peca-${i + 1}" style="--f:${corF}">
<header><span class="num">${n}</span><span class="tag">${esc(x.formato)}</span><span class="quando">${esc(x.data ? dia(x.data) : 'sem data')}</span>${x.linha ? `<span class="linha">${esc(x.linha)}</span>` : ''}</header>
<h3>${esc(semNumero(x.tema) || 'Sem tema')}</h3>
${x.objetivo ? `<p class="objetivo">${esc(x.objetivo)}</p>` : ''}
${telas ? `<div class="duas">${telas}${legenda}</div>` : legenda}
${referencia}
${x.observacao ? `<div class="decidir"><b>Para você decidir</b><p>${esc(x.observacao)}</p></div>` : ''}
${x.ajuste_cliente && !x.revisao_cliente && !respondendo ? `<div class="pedido"><b>Ajuste pedido</b><p>${esc(x.ajuste_cliente)}</p></div>` : ''}
${paraCliente ? decisaoDaPeca(x, n, respondendo) : revisor === 'head' ? decisaoDoHead(x, n, revisando, i) : ''}
</article>`;
}

// paraCliente: página do link (token no endereço do envio), com a resposta.
// modo: 'link' (página /aprovar/<token>) ou 'portal' (dentro do VybeHub, que
// conversa com a página por postMessage e grava com o login do cliente).
// revisor 'head': a prévia do painel, com a revisão interna peça a peça
// (grava pela janela do painel, por postMessage).
export function documentoHtml(p, { paraCliente = false, token = '', aviso = '', modo = 'link', revisor = '' } = {}) {
 const id = p.identidade || {}, base = PAINEL();
 const logo = url(id.logo) || (id.logo_drive && p.cliente_id ? `${base}/api/painel?area=logo&c=${encodeURIComponent(p.cliente_id)}` : '');
 const c = p.conteudo || {}, pecas = pecasComRevisao(c, { paraCliente });
 const contagem = {};
 for (const x of pecas) contagem[x.formato] = (contagem[x.formato] || 0) + 1;
 const numeros = c.numeros?.length ? c.numeros : [{ rotulo: pecas.length === 1 ? 'publicação no mês' : 'publicações no mês', valor: String(pecas.length) }, ...Object.entries(contagem).map(([f, n]) => ({ rotulo: f, valor: String(n) }))];
 const respondendo = paraCliente && p.estado === 'enviado';
 const revisando = revisor === 'head' && ['revisar', 'ajustes'].includes(p.estado);
 const quando = p.respondido_em ? ` em ${new Date(p.respondido_em).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })}` : '';
 const resposta = p.estado === 'aprovado' || p.estado === 'cadastrado' ? `<div class="resposta ok"><b>Planejamento aprovado</b><p>Aprovado por ${esc(p.resposta_nome || 'cliente')}${quando}. Obrigado! A Vybe já começa a produzir.</p></div>`
  : p.estado === 'ajustes' ? `<div class="resposta"><b>Ajustes recebidos</b><p>${esc(p.resposta_nome || 'O cliente')} pediu ajustes${quando}. A Vybe vai revisar e mandar uma nova versão por este mesmo caminho.</p>${p.resposta_texto ? `<p class="texto">${esc(p.resposta_texto)}</p>` : ''}</div>` : '';
 const respondidas = pecas.filter((x) => x.revisao_cliente).length;
 // Dois jeitos de aprovar, à escolha do cliente e trocáveis a qualquer hora
 // (Paulo, 20/10/2026): uma peça por vez, como o cadastro do painel, ou o
 // documento inteiro. O calendário aparece nos dois.
 const comoUsar = respondendo ? `<div class="como" id="como"><div class="como-topo"><b>Como você quer aprovar?</b>
<div class="modos" role="group" aria-label="Modo de aprovação"><button type="button" data-modo="um" aria-pressed="false">Uma peça por vez</button><button type="button" data-modo="doc" aria-pressed="false">Documento completo</button></div></div>
<p class="dica-modo" data-so="um">Você vê uma peça de cada vez: aprove ou peça ajuste, e a próxima aparece. Fica salvo na hora, dá para parar e voltar depois.</p>
<p class="dica-modo" data-so="doc">Todas as peças na mesma página. Em cada uma, toque em <i>Aprovar esta peça</i> ou <i>Pedir ajuste</i>. Fica salvo na hora.</p>
<label class="quem">Quem está respondendo?<input id="quem" maxlength="80" autocomplete="name" placeholder="Seu nome" value="${esc(p.resposta_nome || '')}"></label>
<p class="progresso"><span id="progresso">${respondidas} de ${pecas.length} peças respondidas</span><i><b id="barra" style="width:${pecas.length ? Math.round((respondidas / pecas.length) * 100) : 0}%"></b></i></p></div>
<div class="escolha" id="escolha" hidden><div role="dialog" aria-modal="true" aria-labelledby="escolha-titulo"><small>Planejamento de ${esc(nomeDoMes(p.mes))}</small><h2 id="escolha-titulo">Como você prefere aprovar?</h2>
<button type="button" data-modo="um"><b>Uma peça por vez</b><span>Você vê uma peça, aprova ou pede ajuste e passa para a próxima. Mais leve.</span></button>
<button type="button" data-modo="doc"><b>Documento completo</b><span>Todas as ${pecas.length} peças na mesma página, como um documento.</span></button>
<small>Dá para trocar a qualquer momento.</small></div></div>` : '';
 const secao = (n, rotulo, titulo) => `<h2><small>${n} · ${rotulo}</small>${titulo}</h2>`;
 const corpo = `<div class="so-doc">${secao('01', 'Visão do mês', 'O que vamos comunicar')}${c.resumo ? `<p class="resumo">${esc(c.resumo)}</p>` : ''}
<div class="numeros">${numeros.map((x) => `<div><b>${esc(x.valor)}</b><span>${esc(x.rotulo)}</span></div>`).join('')}</div>
${c.linhas?.length ? `${secao('02', 'Linhas de conteúdo', 'Os assuntos do mês')}<div class="linhas">${c.linhas.map((l) => `<div><b>${esc(l.titulo)}</b><p>${esc(l.texto)}</p></div>`).join('')}</div>` : ''}
${c.datas?.length ? `${secao('03', 'Datas', 'Datas que orientam o mês')}<div class="rolar"><table class="datas"><tbody>${c.datas.map((d) => `<tr><td>${esc(d.data)}</td><td><b>${esc(d.nome)}</b></td><td>${esc(d.texto)}</td></tr>`).join('')}</tbody></table></div>` : ''}
</div>
${secao('04', 'Calendário', esc(nomeDoMes(p.mes).replace(/^./, (x) => x.toUpperCase())))}${calendario(p.mes, pecas)}
${respondendo ? `<nav class="cal-mini" aria-label="Peças do mês">${pecas.map((x, i) => `<a href="#peca-${i + 1}" style="--f:${CORES_FORMATO[x.formato] || '#6b7280'}" data-n="${i}"><b>${esc(x.data ? `${x.data.slice(8, 10)}/${x.data.slice(5, 7)}` : '--')}</b><span>${esc(x.formato)}</span></a>`).join('')}</nav>` : ''}
<section id="area-pecas">${secao('05', 'Peças', 'Uma a uma')}${respondendo ? `<div class="navega"><button type="button" class="nao" data-ir="-1">← Anterior</button><span id="pos"></span><button type="button" class="nao" data-ir="1">Próxima →</button></div>` : ''}<div class="pecas">${pecas.map((x, i) => fichaDaPeca(x, i, { paraCliente, respondendo, revisor, revisando })).join('')}</div></section>
${c.observacoes ? `<div class="so-doc">${secao('06', 'Observações', 'Para combinar')}<div class="obs">${esc(c.observacoes)}</div></div>` : ''}`;
 const formulario = respondendo ? `<section class="aprovar" id="aprovar"><button type="button" class="link voltar-pecas" data-ir="pecas">← Voltar às peças</button><h2><small>Sua resposta</small>Enviar para a Vybe</h2>
<p class="contagem" id="contagem" aria-live="polite"></p>
<label>Comentário geral (opcional)<textarea id="geral" rows="3" maxlength="4000" placeholder="Algo sobre o mês todo?"></textarea></label>
<div class="botoes"><button type="button" class="sim" id="concluir">Enviar respostas</button></div>
<p class="erro" id="erro" role="alert" hidden></p>
<small>Se pedir ajuste em alguma peça, a Vybe ajusta e manda de novo só para você conferir. As peças aprovadas continuam aprovadas.</small></section>` : '';
 // Só na página do cliente. As respostas vão pelo link (fetch) ou pelo VybeHub (postMessage).
 const script = respondendo ? `<script>(()=>{const MODO=${JSON.stringify(modo)},URL_=${JSON.stringify(`/aprovar/${token}`)};let seq=0;const espera={};
function falar(rota,dados){if(MODO==='portal'){return new Promise((ok,nao)=>{const id=++seq;espera[id]={ok,nao};parent.postMessage({vybe:'planejamento',id,rota,dados},'*');});}
return fetch(URL_,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rota,...dados})}).then(r=>r.json().then(d=>{if(!r.ok)throw new Error(d.error||'Não deu para salvar.');return d;}));}
addEventListener('message',e=>{if(e.source!==parent||!e.data||e.data.vybe!=='planejamento-resposta')return;const w=espera[e.data.id];if(!w)return;delete espera[e.data.id];e.data.ok?w.ok(e.data):w.nao(new Error(e.data.erro||'Não deu para salvar.'));});
const quem=document.getElementById('quem'),erro=document.getElementById('erro');
const mostrarErro=t=>{erro.textContent=t;erro.hidden=!t;if(t)alert(t);};
function contar(){const ds=[...document.querySelectorAll('.decisao[data-assinatura]')],r=ds.filter(d=>d.dataset.estado).length,aj=ds.filter(d=>d.dataset.estado==='ajuste').length;
document.getElementById('progresso').textContent=r+' de '+ds.length+' peças respondidas';document.getElementById('barra').style.width=(ds.length?Math.round(r/ds.length*100):0)+'%';
const falta=ds.length-r;document.getElementById('contagem').textContent=aj?aj+(aj===1?' peça com ajuste pedido.':' peças com ajuste pedido.')+(falta?' '+falta+' sem resposta contam como aprovadas.':''):(falta?falta+(falta===1?' peça sem resposta conta como aprovada.':' peças sem resposta contam como aprovadas.'):'Todas as peças aprovadas.');
document.getElementById('concluir').textContent=aj?'Enviar '+aj+(aj===1?' ajuste':' ajustes')+' para a Vybe':'Aprovar planejamento';document.body.classList.toggle('tem-ajuste',aj>0);}
function pintar(d,estado,nota){d.dataset.estado=estado||'';const s=d.querySelector('.sit'),nome=quem.value.trim();s.className='sit'+(estado==='aprovada'?' ok':estado==='ajuste'?' ajuste':'');
s.textContent=estado==='aprovada'?'Aprovada por '+nome:estado==='ajuste'?'Ajuste pedido por '+nome+': '+nota:'Sem resposta ainda';d.querySelector('.nota').hidden=true;
let lim=d.querySelector('[data-acao=limpar]');if(estado&&!lim){lim=document.createElement('button');lim.type='button';lim.className='link';lim.dataset.acao='limpar';lim.textContent='Desfazer';d.querySelector('.acoes').append(lim);}if(!estado&&lim)lim.remove();contar();}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-acao]');if(!b)return;const d=b.closest('.decisao');if(!d)return;const a=b.dataset.acao;
if(a==='abrir'){d.querySelector('.nota').hidden=false;d.querySelector('textarea').focus();return;}
if(!quem.value.trim()){mostrarErro('Escreva seu nome no topo antes de responder.');quem.focus();return;}
const nota=a==='ajuste'?d.querySelector('textarea').value.trim():'';if(a==='ajuste'&&!nota){mostrarErro('Conte o que precisa mudar nesta peça.');return;}
b.disabled=true;try{await falar('marcar',{assinatura:d.dataset.assinatura,estado:a,nota,nome:quem.value.trim()});mostrarErro('');pintar(d,a==='limpar'?'':a,nota);if(a!=='limpar')document.dispatchEvent(new Event('vybe-respondida'));}catch(x){mostrarErro(x.message);}finally{b.disabled=false;}});
document.getElementById('concluir').addEventListener('click',async e=>{if(!quem.value.trim()){mostrarErro('Escreva seu nome no topo antes de enviar.');quem.focus();return;}
const aj=document.querySelectorAll('.decisao[data-estado=ajuste]').length,b=e.currentTarget;b.disabled=true;
try{await falar('responder',{acao:aj?'ajustes':'aprovar',nome:quem.value.trim(),texto:document.getElementById('geral').value.trim()});if(MODO!=='portal')location.reload();}catch(x){mostrarErro(x.message);b.disabled=false;}});
const pecasEl=[...document.querySelectorAll('.pecas .peca')];let atual=0,modo='';
function mostrar(i,rolar=true){atual=Math.max(0,Math.min(pecasEl.length-1,i));pecasEl.forEach((el,k)=>el.classList.toggle('atual',k===atual));
document.getElementById('pos').textContent='Peça '+(atual+1)+' de '+pecasEl.length;document.querySelector('[data-ir="-1"]').disabled=atual===0;
const prox=document.querySelector('[data-ir="1"]');prox.textContent=atual===pecasEl.length-1?'Ir para o envio →':'Próxima →';
document.body.classList.remove('no-envio');document.querySelectorAll('.cal-mini a').forEach((a,k)=>{a.classList.toggle('atual',k===atual);a.classList.toggle('feita',!!pecasEl[k].querySelector('.decisao')?.dataset.estado);});
document.querySelector('.cal-mini a.atual')?.scrollIntoView({inline:'center',block:'nearest'});if(rolar)scrollTo({top:0,behavior:'smooth'});}
function irEnvio(){document.body.classList.add('no-envio');scrollTo({top:0,behavior:'smooth'});}
function aplicarModo(m){modo=m;document.body.classList.toggle('modo-um',m==='um');document.body.classList.toggle('modo-doc',m==='doc');document.getElementById('escolha').hidden=true;
document.querySelectorAll('.modos [data-modo]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.modo===m)));try{localStorage.setItem('vybe-modo-aprovacao',m);}catch(x){}
if(m==='um'){const livre=pecasEl.findIndex(el=>!el.querySelector('.decisao')?.dataset.estado);mostrar(livre<0?0:livre,false);}else document.body.classList.remove('no-envio');}
document.addEventListener('click',e=>{const m=e.target.closest('[data-modo]');if(m){aplicarModo(m.dataset.modo);return;}
const ir=e.target.closest('[data-ir]');if(ir){if(ir.dataset.ir==='pecas'){mostrar(atual);return;}if(ir.dataset.ir==='1'&&atual===pecasEl.length-1){irEnvio();return;}mostrar(atual+Number(ir.dataset.ir));return;}
const cal=e.target.closest('.cal a[href^="#peca-"],.cal-mini a');if(cal&&modo==='um'){e.preventDefault();mostrar(Number(cal.getAttribute('href').slice(6))-1);}});
// Uma peça por vez: respondeu, vai para a próxima sem resposta.
document.addEventListener('vybe-respondida',()=>{if(modo!=='um')return;setTimeout(()=>{const livre=pecasEl.findIndex((el,k)=>k>atual&&!el.querySelector('.decisao')?.dataset.estado);
const qualquer=pecasEl.findIndex(el=>!el.querySelector('.decisao')?.dataset.estado);const alvo=livre>=0?livre:qualquer;if(alvo>=0)mostrar(alvo);else irEnvio();},450);});
let salvo='';try{salvo=localStorage.getItem('vybe-modo-aprovacao')||'';}catch(x){}
if(salvo==='um'||salvo==='doc')aplicarModo(salvo);else{document.getElementById('escolha').hidden=false;document.body.classList.add('modo-doc');}
if(MODO==='portal'){const h=()=>parent.postMessage({vybe:'planejamento-altura',h:document.documentElement.scrollHeight},'*');new ResizeObserver(h).observe(document.body);addEventListener('load',h);h();}
contar();})();</script>` : (modo === 'portal' ? `<script>(()=>{const h=()=>parent.postMessage({vybe:'planejamento-altura',h:document.documentElement.scrollHeight},'*');new ResizeObserver(h).observe(document.body);addEventListener('load',h);h();})();</script>` : '');
 const scriptHead = revisando ? `<script>(()=>{let seq=0;const espera={};
const falar=(dados)=>new Promise((ok,nao)=>{const id=++seq;espera[id]={ok,nao};parent.postMessage({vybe:'planejamento-head',id,dados},'*');});
addEventListener('message',e=>{if(e.source!==parent||!e.data||e.data.vybe!=='planejamento-head-resposta')return;const w=espera[e.data.id];if(!w)return;delete espera[e.data.id];e.data.ok?w.ok(e.data):w.nao(new Error(e.data.erro||'Não deu para salvar.'));});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-acao]');if(!b)return;const d=b.closest('.decisao');if(!d)return;const a=b.dataset.acao;
if(a==='abrir'){d.querySelector('.nota').hidden=false;d.querySelector('textarea').focus();return;}
if(a==='editar'){abrirEdicao(d);return;}
const nota=a==='ajustar'?d.querySelector('textarea').value.trim():'';if(a==='ajustar'&&!nota){alert('Escreva o que ajustar nesta peça.');return;}
b.disabled=true;try{await falar({assinatura:d.dataset.assinatura,estado:a,nota});const s=[...d.querySelectorAll('.sit')].pop();
d.dataset.estado=a==='ok'?'aprovada':a==='ajustar'?'ajuste':'';s.className='sit'+(a==='ok'?' ok':a==='ajustar'?' ajuste':'');s.textContent=a==='ok'?'OK na revisão':a==='ajustar'?'Ajustar: '+nota:'Ainda não revisada';d.querySelector('.nota').hidden=true;}
catch(x){alert(x.message);}finally{b.disabled=false;}});
const dlg=document.getElementById('editar-peca');let editando=null;
function abrirEdicao(d){editando=d;const p=JSON.parse(d.dataset.peca);for(const el of dlg.querySelectorAll('[name]')){const v=p[el.name];el.value=Array.isArray(v)?v.join('\\n'):(v||'');}
dlg.querySelector('h3').textContent='Editar a peça '+String(Number(d.dataset.indice)+1).padStart(2,'0');dlg.showModal();dlg.querySelector('[name=tema]').focus();}
dlg.querySelector('[data-fechar]').addEventListener('click',()=>dlg.close());
dlg.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const b=dlg.querySelector('[type=submit]');const peca=Object.fromEntries([...dlg.querySelectorAll('[name]')].map(el=>[el.name,el.name==='telas'?el.value.split('\\n').map(t=>t.trim()).filter(Boolean):el.value.trim()]));
b.disabled=true;b.textContent='Salvando…';try{await falar({acao:'editar',indice:Number(editando.dataset.indice),peca});dlg.close();}catch(x){alert(x.message);}finally{b.disabled=false;b.textContent='Salvar a peça';}});
addEventListener('message',e=>{if(e.source===parent&&e.data?.vybe==='planejamento-ir'){document.getElementById('peca-'+e.data.n)?.scrollIntoView({block:'start'});}});})();</script>` : '';
 const dialogoEdicao = revisando ? `<dialog id="editar-peca" class="editar"><form method="dialog"><h3>Editar a peça</h3>
<div class="campos"><label>Dia<input type="date" name="data"></label><label>Formato<select name="formato">${['Card', 'Carrossel', 'Reels', 'Fotografia', 'Vídeo', 'Stories', 'Outro'].map((f) => `<option>${f}</option>`).join('')}</select></label><label class="largo">Tema<input name="tema" maxlength="200"></label>
<label>Linha de conteúdo<input name="linha" maxlength="80"></label><label class="largo">Objetivo<input name="objetivo" maxlength="800"></label></div>
<label>Texto das telas (uma por linha)<textarea name="telas" rows="5"></textarea></label>
<label>Legenda ou roteiro<textarea name="legenda" rows="6" maxlength="5000"></textarea></label>
<label>Referência<textarea name="referencia" rows="2" maxlength="6000"></textarea></label>
<label>Para o cliente decidir<textarea name="observacao" rows="2" maxlength="1500"></textarea></label>
<div class="botoes"><button type="submit" class="sim">Salvar a peça</button><button type="button" class="nao" data-fechar>Cancelar</button></div>
<small>Salvar cria uma versão nova do planejamento. A peça editada fica com o seu OK.</small></form></dialog>` : '';
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(p.titulo)} · ${esc(p.cliente)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap">
<style>
:root{--vybe:#e8602e;--vybe-2:#ff9d00;--tinta:#17171b;--sub:#5d6068;--papel:#f7f5f1;--cartao:#fff;--linha:#e7e2d9;--escuro:#141418}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--papel);color:var(--tinta);font:15.5px/1.6 Manrope,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
main{max-width:940px;margin:0 auto;padding:20px 16px 72px}
.capa{position:relative;overflow:hidden;background:radial-gradient(120% 140% at 100% 0%,#e8602e55,transparent 55%),radial-gradient(80% 90% at 0% 100%,#ff9d0022,transparent 60%),var(--escuro);color:#fff;border-radius:22px;padding:28px 28px 32px;display:grid;gap:18px}
.marcas{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.marcas .vybe{height:30px;width:auto}.marcas i{opacity:.5;font-style:normal;font-size:18px}
.marcas .cli{display:flex;align-items:center;height:46px;padding:6px 12px;border-radius:12px;background:#fff}.marcas .cli img{max-height:34px;max-width:150px;object-fit:contain}
.marcas .cli-nome{font:700 15px Sora,sans-serif;padding:8px 12px;border:1px solid #ffffff33;border-radius:12px}
.capa small{color:#ffb98f;letter-spacing:.12em;text-transform:uppercase;font:700 11.5px Manrope,sans-serif}
.capa h1{margin:0;font:800 clamp(30px,6vw,48px)/1.05 Sora,sans-serif;text-wrap:balance}.capa p{margin:0;color:#d9d9de;font-size:16px}
.capa .meta{display:flex;flex-wrap:wrap;gap:8px}.capa .meta span{padding:4px 10px;border-radius:99px;background:#ffffff14;border:1px solid #ffffff22;font-size:12.5px;font-weight:600}
h2{font:800 22px/1.2 Sora,sans-serif;margin:44px 0 14px;text-wrap:balance}h2 small{display:block;color:var(--vybe);font:700 11px Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px}
.resumo{max-width:68ch;font-size:16.5px}
.numeros{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:18px 0}
.numeros div{background:var(--cartao);border:1px solid var(--linha);border-radius:16px;padding:14px 16px;display:grid;gap:2px}.numeros div:first-child{background:var(--escuro);color:#fff;border-color:var(--escuro)}
.numeros b{font:800 30px/1 Sora,sans-serif;color:var(--vybe);font-variant-numeric:tabular-nums}.numeros span{font-size:13px;font-weight:600}
.linhas{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.linhas div{background:var(--cartao);border:1px solid var(--linha);border-top:3px solid var(--vybe);border-radius:14px;padding:14px 16px}
.linhas b{font:700 15px Sora,sans-serif}.linhas p{margin:6px 0 0;color:#3c3f45}
.rolar{overflow-x:auto;border-radius:14px}table{width:100%;border-collapse:collapse;background:var(--cartao)}
.datas td{padding:11px 14px;border-bottom:1px solid var(--linha);vertical-align:top}.datas tr:last-child td{border-bottom:0}.datas td:first-child{color:var(--vybe);font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.cal{min-width:620px;table-layout:fixed}.cal th{background:var(--escuro);color:#fff;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:9px}.cal td{height:78px;vertical-align:top;border:1px solid var(--linha);padding:6px}
.cal td.vazio{background:#efebe3}.cal b{font-size:12px;color:var(--sub)}.cal a{display:block;margin-top:4px;padding:2px 6px;border-radius:6px;background:color-mix(in srgb,var(--f) 14%,#fff);border-left:3px solid var(--f);font-size:10.5px;font-weight:700;color:var(--tinta);text-decoration:none}
.pecas{display:grid;gap:14px}.peca{background:var(--cartao);border:1px solid var(--linha);border-left:4px solid var(--f);border-radius:16px;padding:18px 20px;display:grid;gap:10px;scroll-margin-top:16px}
.peca header{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.peca .num{font:800 20px/1 Sora,sans-serif;color:var(--f);font-variant-numeric:tabular-nums}
.peca .tag{padding:3px 10px;border-radius:99px;background:var(--f);color:#fff;font-size:11.5px;font-weight:700}.peca .quando{color:var(--sub);font-size:13.5px;font-weight:600;font-variant-numeric:tabular-nums}
.peca h3{margin:0;font:700 18px/1.3 Sora,sans-serif;text-wrap:balance}.peca p{margin:0;white-space:pre-wrap}
.peca .linha{color:var(--sub);font-size:12.5px;font-weight:600}.peca .linha::before{content:"· ";}
.peca .objetivo{color:#3c3f45;font-size:14.5px;max-width:75ch}
.duas{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start}
@media(max-width:640px){.duas{grid-template-columns:minmax(0,1fr)}}
.telas ol{margin:0;padding:0;list-style:none;counter-reset:t;display:grid;gap:8px}
.telas li{counter-increment:t;display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;font-size:14px;line-height:1.5}
.telas li::before{content:counter(t);display:grid;place-items:center;width:20px;height:20px;margin-top:1px;border-radius:50%;background:color-mix(in srgb,var(--f) 18%,#fff);color:var(--tinta);font-size:11px;font-weight:800}
.duas .bloco{background:#faf8f4;border-left:3px solid var(--f);border-radius:0 12px 12px 0;padding:10px 12px}
.bloco b,.telas b,.ref b,.decidir b,.pedido b{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--sub);margin-bottom:4px}
.ref{background:#faf8f4;border:1px solid var(--linha);border-radius:12px;padding:10px 12px;font-size:14px;color:#3c3f45}.ref summary{cursor:pointer;font-weight:700;color:var(--tinta)}.ref[open] summary{margin-bottom:6px}
.decidir{background:#fff6e5;border:1px solid #f1d39a;border-radius:12px;padding:10px 12px;font-size:14px}.decidir b{color:#9a6200}
.pedido{background:#fdecec;border:1px solid #f3b9b9;border-radius:12px;padding:10px 12px;font-size:14px}.pedido b{color:#a33}
.pedir{border-top:1px dashed var(--linha);padding-top:10px}.pedir summary{cursor:pointer;font-weight:700;color:var(--vybe);list-style:none}.pedir summary::before{content:"+ "}.pedir[open] summary::before{content:"− "}
.pedir label{display:grid;gap:6px;margin-top:8px;font-size:14px;font-weight:600}
.decisao{border-top:1px dashed var(--linha);padding-top:12px;display:grid;gap:8px}
.decisao .sit{margin:0;font-weight:700;font-size:14px;color:var(--sub)}.decisao .sit.ok{color:#1f7a4a}.decisao .sit.ok::before{content:"✓ "}.decisao .sit.ajuste{color:#a33}
.decisao .acoes{display:flex;flex-wrap:wrap;gap:8px}.decisao .acoes button{padding:10px 14px;font-size:14px}
.decisao[data-estado=aprovada]{background:#eef8f1;margin:0 -20px -18px;padding:12px 20px 16px;border-radius:0 0 16px 16px}
.decisao[data-estado=ajuste]{background:#fdf0f0;margin:0 -20px -18px;padding:12px 20px 16px;border-radius:0 0 16px 16px}
.decisao .nota{display:grid;gap:8px}.decisao .nota[hidden]{display:none}.decisao .nota button{justify-self:start}.decisao .nota label{display:grid;gap:6px;font-weight:600;font-size:14px}
button.link{background:none;border:0;color:var(--sub);text-decoration:underline;padding:10px 6px}
.quem{display:grid;gap:6px;margin-top:12px;font-weight:700}.progresso{display:grid;gap:6px;margin:12px 0 0;font-weight:700;font-size:14px}
.progresso i{display:block;height:8px;border-radius:99px;background:#efebe3;overflow:hidden}.progresso b{display:block;height:100%;background:var(--vybe);border-radius:99px;transition:width .3s}
.erro{margin:0;color:#a33;font-weight:700}
dialog.editar{width:min(760px,calc(100vw - 24px));max-height:calc(100vh - 24px);border:0;border-radius:20px;padding:22px;box-shadow:0 30px 80px #0006}
dialog.editar::backdrop{background:#0008}dialog.editar h3{margin:0 0 12px;font:800 20px Sora,sans-serif}
dialog.editar form{display:grid;gap:10px}dialog.editar label{display:grid;gap:4px;font-weight:700;font-size:13px}
dialog.editar .campos{display:grid;grid-template-columns:160px 150px 1fr;gap:10px}dialog.editar .campos .largo{grid-column:span 1}
@media(max-width:640px){dialog.editar .campos{grid-template-columns:1fr 1fr}dialog.editar .campos .largo{grid-column:1/-1}}
select{font:inherit;padding:10px;border:1px solid var(--linha);border-radius:12px;background:#fff}
.como-topo{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.modos{display:inline-flex;padding:4px;border-radius:999px;background:#efebe3;gap:4px}.modos button{padding:8px 14px;border-radius:999px;background:none;color:var(--sub);font-size:14px}
.modos button[aria-pressed=true]{background:var(--escuro);color:#fff}
.dica-modo{display:none;margin:8px 0 0;color:#3c3f45;font-size:14.5px}.modo-um .dica-modo[data-so=um],.modo-doc .dica-modo[data-so=doc]{display:block}
.modo-um .so-doc{display:none}.modo-um .pecas .peca{display:none}.modo-um .pecas .peca.atual{display:grid;box-shadow:0 18px 50px #0000001a}
/* Uma peça por vez: só uma coisa na tela (Paulo, 20/10/2026). */
.modo-um .capa,.modo-um #resposta>h2,.modo-um #resposta>.rolar,.modo-um #area-pecas>h2,.modo-um .dica-modo,.modo-um .ir,.modo-um footer,.modo-um .resposta{display:none!important}
.modo-um main{padding-top:12px}
.modo-um .como{position:sticky;top:0;z-index:6;margin:0;padding:10px 14px;display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;box-shadow:0 8px 24px #0000000f}
.modo-um .como .como-topo{grid-column:1/-1}.modo-um .como .quem{margin:0;grid-template-columns:auto 1fr;align-items:center;font-size:13px}.modo-um .como .quem input{padding:7px 10px}
.modo-um .como .progresso{margin:0;min-width:180px;font-size:12.5px}
.cal-mini{display:none}.modo-um .cal-mini{display:flex;gap:6px;overflow-x:auto;padding:12px 2px 4px;scrollbar-width:thin}
.cal-mini a{flex:none;display:grid;gap:1px;padding:6px 10px;border-radius:12px;background:#fff;border:1px solid var(--linha);border-left:3px solid var(--f);color:var(--tinta);text-decoration:none;font-size:11px}
.cal-mini a b{font-size:12.5px;font-variant-numeric:tabular-nums}.cal-mini a.feita{background:#eef8f1}.cal-mini a.atual{outline:2px solid var(--vybe);outline-offset:1px}
.modo-um #area-pecas{margin-top:14px}.modo-um .pecas .peca.atual{min-height:min(62vh,640px);align-content:start}
.modo-um .aprovar,.modo-um.no-envio #area-pecas,.modo-um.no-envio .cal-mini{display:none}.modo-um.no-envio .aprovar{display:block;margin-top:14px}
@media(max-width:640px){.modo-um .como{grid-template-columns:1fr}.modo-um .como .quem{grid-template-columns:1fr}.modo-um .como .progresso{min-width:0}
.modo-um .pecas .peca.atual{min-height:0}.modo-um .navega span{font-size:13px;text-align:center}.modos button{padding:8px 10px;font-size:13px}}
.voltar-pecas{display:none}.modo-um .voltar-pecas{display:inline-block;padding:0 0 8px}
.navega{display:none}.modo-um #area-pecas{display:flex;flex-direction:column}.modo-um .navega{display:flex;order:2;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 0}
.navega span{font-weight:800;font-variant-numeric:tabular-nums}.navega button:disabled{opacity:.4;cursor:default}
.escolha{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:16px;background:#17171bcc;backdrop-filter:blur(4px)}.escolha[hidden]{display:none}
.escolha > div{width:min(560px,100%);display:grid;gap:12px;padding:24px;border-radius:22px;background:var(--papel);box-shadow:0 30px 80px #0007}
.escolha h2{margin:0}.escolha small{color:var(--sub)}.escolha button{display:grid;gap:4px;text-align:left;padding:16px 18px;border-radius:16px;background:#fff;border:1px solid var(--linha);color:var(--tinta)}
.escolha button:hover,.escolha button:focus-visible{border-color:var(--vybe)}.escolha button b{font:800 17px Sora,sans-serif}.escolha button span{font-weight:500;color:var(--sub);font-size:14px}
.obs{background:var(--cartao);border:1px dashed var(--linha);border-radius:14px;padding:14px 16px;white-space:pre-wrap}
.como{margin:18px 0 0;background:var(--cartao);border:1px solid var(--linha);border-radius:16px;padding:14px 18px}.como b{font:700 15px Sora,sans-serif}.como ol{margin:6px 0 0;padding-left:20px}
.aprovar{margin-top:44px;background:var(--cartao);border:2px solid var(--vybe);border-radius:20px;padding:22px}.aprovar h2{margin-top:0}.aprovar label{display:grid;gap:6px;margin:12px 0;font-weight:700}
.aprovar small{color:var(--sub)}.contagem{margin:0;font-weight:700}.tem-ajuste .contagem{color:#a33}
input,textarea{font:inherit;padding:11px 12px;border:1px solid var(--linha);border-radius:12px;background:#fff;width:100%}
.botoes{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}button{font:inherit;font-weight:800;padding:13px 20px;border-radius:14px;border:0;cursor:pointer}
.sim{background:var(--vybe);color:#fff}.nao{background:#fff;color:var(--tinta);border:1px solid var(--linha)}
button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid var(--vybe-2);outline-offset:2px}
.resposta{margin:20px 0 0;padding:16px 18px;border-radius:16px;background:#fff3d6;border:1px solid #ecd49a}.resposta.ok{background:#e4f4ea;border-color:#a6d8b8}.resposta b{font:700 16px Sora,sans-serif}.resposta p{margin:4px 0 0}.resposta .texto{white-space:pre-wrap;color:#3c3f45}
.aviso{margin:16px 0 0;padding:12px 16px;border-radius:12px;background:#fde8e8;border:1px solid #f3b4b4}
.ir{position:sticky;bottom:12px;z-index:5;display:flex;justify-content:center;margin-top:24px}.ir a{padding:12px 20px;border-radius:99px;background:var(--escuro);color:#fff;font-weight:800;text-decoration:none;box-shadow:0 10px 30px #0004}
footer{margin-top:52px;color:var(--sub);font-size:12.5px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}footer img{height:16px;filter:invert(1);opacity:.7;vertical-align:middle;margin-right:6px}
@media print{.aprovar,.pedir,.ir,.como{display:none}main{padding:0}.peca{break-inside:avoid}}
${revisor ? '.no-painel main{max-width:1180px;padding-top:96px;padding-bottom:110px}.no-painel .peca,.no-painel #area-pecas{scroll-margin-top:100px}' : ''}
</style></head><body class="${revisor ? 'no-painel' : ''}"><main>
<header class="capa"><div class="marcas"><img class="vybe" src="${LOGO_VYBE}" alt="Vybe"><i aria-hidden="true">×</i>${logo ? `<span class="cli"><img src="${esc(logo)}" alt="${esc(p.cliente)}"></span>` : `<span class="cli-nome">${esc(p.cliente)}</span>`}</div>
<div><small>Planejamento de conteúdo · ${esc(nomeDoMes(p.mes))}</small><h1>${esc(p.cliente)}</h1></div>
${p.titulo && p.titulo !== 'Planejamento de conteúdo' ? `<p>${esc(p.titulo)}</p>` : ''}
<div class="meta"><span>${pecas.length} ${pecas.length === 1 ? 'peça' : 'peças'}</span><span>${esc(nomeDoMes(p.mes))}</span><span>Versão ${esc(p.versao)}</span></div></header>
${aviso ? `<div class="aviso" role="alert">${esc(aviso)}</div>` : ''}${resposta}${comoUsar}
${respondendo ? `<div id="resposta">${corpo}${formulario}</div><div class="ir"><a href="#aprovar">Ir para o envio</a></div>` : corpo}
<footer><span><img src="${LOGO_VYBE}" alt="">Feito pela Vybe para ${esc(p.cliente)} · ${esc(nomeDoMes(p.mes))}</span><span>Versão ${esc(p.versao)}</span></footer>
</main>${dialogoEdicao}${script}${scriptHead}${LINKS_INTERNOS}</body></html>`;
}
