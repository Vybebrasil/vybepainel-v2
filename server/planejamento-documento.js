// Documento padrão do planejamento (o mesmo para todos os clientes, pedido do
// Paulo em 19/10/2026): capa, visão do mês, linhas de conteúdo, datas,
// calendário e uma ficha por peça. A identidade do cliente (cores, logo,
// fonte, tom) vem do cadastro; o resto do desenho é fixo. Serve para a página
// de aprovação do cliente e para o documento salvo no Drive.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cor = (v, padrao) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : padrao);
const url = (v) => { try { const u = new URL(String(v)); return ['https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function nomeDoMes(mes) { const [a, m] = String(mes).split('-').map(Number); return `${MESES[m - 1]} de ${a}`; }
const dia = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); if (!d) return ''; const w = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${SEMANA[w]}`; };
const CORES_FORMATO = { Card: '#c0392b', Carrossel: '#c08a1e', Reels: '#7b4bd6', Fotografia: '#2f8f5b', 'Vídeo': '#2c6fb3', Stories: '#d1497a', Outro: '#6b7280' };

function calendario(mes, pecas) {
 const [a, m] = String(mes).split('-').map(Number);
 const dias = new Date(Date.UTC(a, m, 0)).getUTCDate(), inicio = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7; // segunda primeiro
 const por = new Map();
 for (const p of pecas) if (p.data?.startsWith(`${a}-${String(m).padStart(2, '0')}`)) { const d = Number(p.data.slice(8)); por.set(d, [...(por.get(d) || []), p]); }
 const celulas = [...Array(inicio).fill('<td class="vazio"></td>')];
 for (let d = 1; d <= dias; d++) celulas.push(`<td><b>${d}</b>${(por.get(d) || []).map((p) => `<span style="--f:${CORES_FORMATO[p.formato] || '#6b7280'}">${esc(p.formato)}</span>`).join('')}</td>`);
 while (celulas.length % 7) celulas.push('<td class="vazio"></td>');
 const linhas = [];
 for (let i = 0; i < celulas.length; i += 7) linhas.push(`<tr>${celulas.slice(i, i + 7).join('')}</tr>`);
 return `<table class="cal"><thead><tr>${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table>`;
}

// paraCliente: inclui o formulário de aprovação (token no endereço do envio).
export function documentoHtml(p, { paraCliente = false, token = '', aviso = '' } = {}) {
 const id = p.identidade || {};
 const principal = cor(id.cor, '#1f5f3a'), apoio = cor(id.cor_apoio, '#c9a227'), logo = url(id.logo);
 const c = p.conteudo || {}, pecas = c.pecas || [];
 const fonte = /^[A-Za-z0-9 ]{2,40}$/.test(String(id.fonte || '')) ? id.fonte : 'Inter';
 const contagem = {};
 for (const x of pecas) contagem[x.formato] = (contagem[x.formato] || 0) + 1;
 const numeros = c.numeros?.length ? c.numeros : [{ rotulo: 'publicações no mês', valor: String(pecas.length) }, ...Object.entries(contagem).map(([f, n]) => ({ rotulo: f, valor: String(n) }))];
 const resposta = p.estado === 'aprovado' ? `<div class="resposta ok">Aprovado por ${esc(p.resposta_nome || 'cliente')}${p.respondido_em ? ` em ${new Date(p.respondido_em).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })}` : ''}. Obrigado!</div>`
  : p.estado === 'ajustes' ? `<div class="resposta">Ajustes pedidos por ${esc(p.resposta_nome || 'cliente')}: ${esc(p.resposta_texto || '')}. A Vybe vai revisar e mandar de novo.</div>` : '';
 const formulario = paraCliente && p.estado === 'enviado' ? `<section class="aprovar" id="aprovar"><h2>Sua resposta</h2>
<form method="post" action="/aprovar/${esc(token)}"><label>Seu nome<input name="nome" required maxlength="80" autocomplete="name"></label>
<label>Comentário (obrigatório para pedir ajustes)<textarea name="texto" rows="4" maxlength="4000"></textarea></label>
<div class="botoes"><button name="acao" value="aprovar" class="sim">Aprovar planejamento</button><button name="acao" value="ajustes" class="nao">Pedir ajustes</button></div></form></section>` : '';
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(p.titulo)} · ${esc(p.cliente)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonte)}:wght@400;600;800&display=swap">
<style>
:root{--p:${principal};--a:${apoio};--t:#1d2227;--s:#5b6470;--fundo:#fbf9f4;--linha:#e6e1d6}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--t);font:15px/1.55 "${esc(fonte)}",Inter,system-ui,sans-serif}
main{max-width:920px;margin:0 auto;padding:24px 16px 64px}
.capa{background:var(--p);color:#fff;border-radius:20px;padding:40px 32px;display:grid;gap:12px}
.capa img{max-height:64px;max-width:200px;object-fit:contain}.capa small{opacity:.8;letter-spacing:.08em;text-transform:uppercase;font-size:12px}
.capa h1{margin:0;font-size:clamp(26px,5vw,40px);line-height:1.1;text-wrap:balance}
h2{color:var(--p);font-size:20px;margin:40px 0 12px;text-wrap:balance}h2 small{display:block;color:var(--a);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px}
.resumo{max-width:70ch}.numeros{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:16px 0}
.numeros div{background:#fff;border:1px solid var(--linha);border-radius:14px;padding:14px}.numeros div:first-child{background:var(--p);color:#fff;border-color:var(--p)}
.numeros b{display:block;font-size:30px;font-weight:800;color:var(--a);font-variant-numeric:tabular-nums}.numeros div:first-child b{color:#fff}
.linhas{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.linhas div{background:#fff;border:1px solid var(--linha);border-left:4px solid var(--a);border-radius:12px;padding:14px}
.linhas b{color:var(--p)}table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}
.datas td{padding:10px 12px;border-bottom:1px solid var(--linha);vertical-align:top}.datas td:first-child{color:#a33;font-weight:600;white-space:nowrap}
.cal th{background:var(--p);color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:8px}.cal td{height:74px;vertical-align:top;border:1px solid var(--linha);padding:6px;width:14.28%}
.cal td.vazio{background:#f3f0e8}.cal b{font-size:12px;color:var(--s)}.cal span{display:block;margin-top:4px;padding:2px 6px;border-radius:6px;background:color-mix(in srgb,var(--f) 14%,#fff);border-left:3px solid var(--f);font-size:10px;font-weight:600}
.pecas{display:grid;gap:12px}.peca{background:#fff;border:1px solid var(--linha);border-radius:14px;padding:16px;display:grid;gap:6px}
.peca header{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.peca .tag{padding:2px 8px;border-radius:99px;background:var(--a);color:#fff;font-size:11px;font-weight:700}
.peca .quando{color:var(--s);font-size:13px;font-variant-numeric:tabular-nums}.peca h3{margin:0;font-size:16px}.peca p{margin:0;white-space:pre-wrap}.peca small{color:var(--s)}
.obs{background:#fff;border:1px dashed var(--linha);border-radius:12px;padding:14px;white-space:pre-wrap}
.aprovar{margin-top:40px;background:#fff;border:2px solid var(--p);border-radius:16px;padding:20px}.aprovar label{display:grid;gap:4px;margin:10px 0;font-weight:600}
input,textarea{font:inherit;padding:10px;border:1px solid var(--linha);border-radius:10px}.botoes{display:flex;flex-wrap:wrap;gap:10px}
button{font:inherit;font-weight:700;padding:12px 18px;border-radius:12px;border:0;cursor:pointer}.sim{background:var(--p);color:#fff}.nao{background:#fff;color:var(--t);border:1px solid var(--linha)}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--a);outline-offset:2px}
.resposta{margin:24px 0;padding:16px;border-radius:14px;background:#fff3d6;border:1px solid #ecd49a}.resposta.ok{background:#e4f4ea;border-color:#a6d8b8}
.aviso{margin:16px 0;padding:12px 16px;border-radius:12px;background:#fde8e8;border:1px solid #f3b4b4}
footer{margin-top:48px;color:var(--s);font-size:12px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
@media print{.aprovar{display:none}main{padding:0}}
</style></head><body><main>
<header class="capa">${logo ? `<img src="${esc(logo)}" alt="${esc(p.cliente)}">` : ''}<small>Planejamento de conteúdo · ${esc(nomeDoMes(p.mes))}</small><h1>${esc(p.titulo)}</h1><span>${esc(p.cliente)}</span></header>
${aviso ? `<div class="aviso" role="alert">${esc(aviso)}</div>` : ''}${resposta}
<h2><small>01 · Visão do mês</small>O que vamos comunicar</h2>${c.resumo ? `<p class="resumo">${esc(c.resumo)}</p>` : ''}
<div class="numeros">${numeros.map((n) => `<div><b>${esc(n.valor)}</b>${esc(n.rotulo)}</div>`).join('')}</div>
${c.linhas?.length ? `<h2><small>02 · Linhas de conteúdo</small>Os assuntos do mês</h2><div class="linhas">${c.linhas.map((l) => `<div><b>${esc(l.titulo)}</b><p>${esc(l.texto)}</p></div>`).join('')}</div>` : ''}
${c.datas?.length ? `<h2><small>03 · Datas</small>Datas que orientam o mês</h2><table class="datas"><tbody>${c.datas.map((d) => `<tr><td>${esc(d.data)}</td><td><b>${esc(d.nome)}</b></td><td>${esc(d.texto)}</td></tr>`).join('')}</tbody></table>` : ''}
<h2><small>04 · Calendário</small>${esc(nomeDoMes(p.mes).replace(/^./, (x) => x.toUpperCase()))}</h2>${calendario(p.mes, pecas)}
<h2><small>05 · Peças</small>Uma a uma</h2><div class="pecas">${pecas.map((x, i) => `<article class="peca"><header><span class="tag" style="background:${CORES_FORMATO[x.formato] || 'var(--a)'}">${esc(x.formato)}</span><span class="quando">${esc(x.data ? dia(x.data) : 'sem data')}</span><small>#${i + 1}</small></header><h3>${esc(x.tema)}</h3>${x.legenda ? `<p>${esc(x.legenda)}</p>` : ''}${x.referencia ? `<small>Referência visual: ${esc(x.referencia)}</small>` : ''}${x.observacao ? `<small>${esc(x.observacao)}</small>` : ''}</article>`).join('') || '<p>Sem peças ainda.</p>'}</div>
${c.observacoes ? `<h2><small>06 · Observações</small>Para combinar</h2><div class="obs">${esc(c.observacoes)}</div>` : ''}
${formulario}
<footer><span>Vybe · Planejamento de conteúdo · ${esc(p.cliente)} · ${esc(nomeDoMes(p.mes))}</span><span>Versão ${esc(p.versao)}</span></footer>
</main></body></html>`;
}
