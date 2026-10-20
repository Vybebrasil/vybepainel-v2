// Documento padrão do planejamento. Um desenho só, o da Vybe, para todos os
// clientes; do cliente entram o nome e o logo (Paulo, 20/10/2026: "manter um
// padrão Vybe e a gente adiciona a marca do cliente"). Serve para a prévia do
// painel, para o documento salvo no Drive e para a página de aprovação do
// cliente, onde ele pode pedir ajuste peça a peça.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = (v) => { try { const u = new URL(String(v)); return ['https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
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

function fichaDaPeca(x0, i, { paraCliente, respondendo }) {
 const x = pecaParaMostrar(x0);
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
${x.ajuste_cliente && !respondendo ? `<div class="pedido"><b>Ajuste pedido</b><p>${esc(x.ajuste_cliente)}</p></div>` : ''}
${respondendo ? `<details class="pedir"><summary>Pedir ajuste nesta peça</summary><label>O que você quer mudar na peça ${n}?<textarea name="ajuste_${i}" rows="3" maxlength="1500" placeholder="Ex.: trocar a foto, mudar o título, mudar o dia…"></textarea></label></details>` : ''}
</article>`;
}

// paraCliente: página do link (token no endereço do envio), com a resposta.
export function documentoHtml(p, { paraCliente = false, token = '', aviso = '' } = {}) {
 const id = p.identidade || {}, logo = url(id.logo), base = PAINEL();
 const c = p.conteudo || {}, pecas = c.pecas || [];
 const contagem = {};
 for (const x of pecas) contagem[x.formato] = (contagem[x.formato] || 0) + 1;
 const numeros = c.numeros?.length ? c.numeros : [{ rotulo: pecas.length === 1 ? 'publicação no mês' : 'publicações no mês', valor: String(pecas.length) }, ...Object.entries(contagem).map(([f, n]) => ({ rotulo: f, valor: String(n) }))];
 const respondendo = paraCliente && p.estado === 'enviado';
 const quando = p.respondido_em ? ` em ${new Date(p.respondido_em).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })}` : '';
 const resposta = p.estado === 'aprovado' || p.estado === 'cadastrado' ? `<div class="resposta ok"><b>Planejamento aprovado</b><p>Aprovado por ${esc(p.resposta_nome || 'cliente')}${quando}. Obrigado! A Vybe já começa a produzir.</p></div>`
  : p.estado === 'ajustes' ? `<div class="resposta"><b>Ajustes recebidos</b><p>${esc(p.resposta_nome || 'O cliente')} pediu ajustes${quando}. A Vybe vai revisar e mandar uma nova versão por este mesmo caminho.</p>${p.resposta_texto ? `<p class="texto">${esc(p.resposta_texto)}</p>` : ''}</div>` : '';
 const comoUsar = respondendo ? `<div class="como"><b>Como aprovar</b><ol><li>Leia o mês e as peças.</li><li>Em qualquer peça, toque em <i>Pedir ajuste nesta peça</i> e escreva o que mudar.</li><li>No fim da página, escreva seu nome e aprove ou envie os ajustes.</li></ol></div>` : '';
 const secao = (n, rotulo, titulo) => `<h2><small>${n} · ${rotulo}</small>${titulo}</h2>`;
 const corpo = `${secao('01', 'Visão do mês', 'O que vamos comunicar')}${c.resumo ? `<p class="resumo">${esc(c.resumo)}</p>` : ''}
<div class="numeros">${numeros.map((x) => `<div><b>${esc(x.valor)}</b><span>${esc(x.rotulo)}</span></div>`).join('')}</div>
${c.linhas?.length ? `${secao('02', 'Linhas de conteúdo', 'Os assuntos do mês')}<div class="linhas">${c.linhas.map((l) => `<div><b>${esc(l.titulo)}</b><p>${esc(l.texto)}</p></div>`).join('')}</div>` : ''}
${c.datas?.length ? `${secao('03', 'Datas', 'Datas que orientam o mês')}<div class="rolar"><table class="datas"><tbody>${c.datas.map((d) => `<tr><td>${esc(d.data)}</td><td><b>${esc(d.nome)}</b></td><td>${esc(d.texto)}</td></tr>`).join('')}</tbody></table></div>` : ''}
${secao('04', 'Calendário', esc(nomeDoMes(p.mes).replace(/^./, (x) => x.toUpperCase())))}${calendario(p.mes, pecas)}
${secao('05', 'Peças', 'Uma a uma')}<div class="pecas">${pecas.map((x, i) => fichaDaPeca(x, i, { paraCliente, respondendo })).join('')}</div>
${c.observacoes ? `${secao('06', 'Observações', 'Para combinar')}<div class="obs">${esc(c.observacoes)}</div>` : ''}`;
 const formulario = respondendo ? `<section class="aprovar" id="aprovar"><h2><small>Sua resposta</small>Tudo certo?</h2>
<p class="contagem" id="contagem" aria-live="polite">Nenhum ajuste marcado nas peças.</p>
<label>Seu nome<input name="nome" required maxlength="80" autocomplete="name"></label>
<label>Comentário geral (opcional)<textarea name="texto" rows="3" maxlength="4000" placeholder="Algo sobre o mês todo?"></textarea></label>
<div class="botoes"><button name="acao" value="aprovar" class="sim" id="btn-aprovar">Aprovar planejamento</button><button name="acao" value="ajustes" class="nao">Enviar pedidos de ajuste</button></div>
<small>Se marcar ajuste em alguma peça, o planejamento volta para a Vybe ajustar antes de produzir.</small></section>` : '';
 // Só na página do cliente: conta os ajustes marcados e troca o botão principal.
 const script = respondendo ? `<script>(()=>{const f=document.getElementById('resposta');if(!f)return;const c=document.getElementById('contagem'),b=document.getElementById('btn-aprovar');
const atualizar=()=>{const n=[...f.querySelectorAll('textarea[name^="ajuste_"]')].filter(t=>t.value.trim()).length;c.textContent=n?n+(n===1?' peça com ajuste marcado.':' peças com ajuste marcado.'):'Nenhum ajuste marcado nas peças.';b.textContent=n?'Enviar os ajustes':'Aprovar planejamento';b.value=n?'ajustes':'aprovar';document.body.classList.toggle('tem-ajuste',n>0);};
f.addEventListener('input',atualizar);atualizar();})();</script>` : '';
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
</style></head><body><main>
<header class="capa"><div class="marcas"><img class="vybe" src="${esc(base)}/assets/vybe-branca.png" alt="Vybe"><i aria-hidden="true">×</i>${logo ? `<span class="cli"><img src="${esc(logo)}" alt="${esc(p.cliente)}"></span>` : `<span class="cli-nome">${esc(p.cliente)}</span>`}</div>
<div><small>Planejamento de conteúdo · ${esc(nomeDoMes(p.mes))}</small><h1>${esc(p.cliente)}</h1></div>
${p.titulo && p.titulo !== 'Planejamento de conteúdo' ? `<p>${esc(p.titulo)}</p>` : ''}
<div class="meta"><span>${pecas.length} ${pecas.length === 1 ? 'peça' : 'peças'}</span><span>${esc(nomeDoMes(p.mes))}</span><span>Versão ${esc(p.versao)}</span></div></header>
${aviso ? `<div class="aviso" role="alert">${esc(aviso)}</div>` : ''}${resposta}${comoUsar}
${respondendo ? `<form id="resposta" method="post" action="/aprovar/${esc(token)}">${corpo}${formulario}</form><div class="ir"><a href="#aprovar">Ir para a resposta</a></div>` : corpo}
<footer><span><img src="${esc(base)}/assets/vybe-branca.png" alt="">Feito pela Vybe para ${esc(p.cliente)} · ${esc(nomeDoMes(p.mes))}</span><span>Versão ${esc(p.versao)}</span></footer>
</main>${script}</body></html>`;
}
