// Frente s-y (25/11/2026): o checklist mostra a peça, a legenda e o briefing. Paulo: "tem vários checklists mas não dá
// pra ver nada... deixa a publicação com a legenda e o briefing, pra conferir o briefing, legenda e o conteúdo".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pecaDoPlanejamento, pecaDoPlanejamentoEm } from '../server/planejamentos.js';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const portoes = ler('vybe-portoes.js'), briefing = ler('vybe-briefing.js'), material = ler('vybe-material.js'), status = ler('vybe-status.js');
const trecho = (fonte, de, ate) => { const i = fonte.indexOf(de); assert.ok(i >= 0, `sem ${de}`); const f = fonte.indexOf(ate, i); assert.ok(f > i, `sem ${ate}`); return fonte.slice(i, f); };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function mesa() {
  const c = vm.createContext({ safeText: esc, corDoClienteV2: () => '#3B5BA9' });
  vm.runInContext(trecho(briefing, 'function briefingDaPeca', '// O mesmo indicador'), c);
  vm.runInContext(trecho(briefing, 'function briefingEhTitulo', '// O que aparece sem precisar abrir'), c);
  vm.runInContext(trecho(material, 'function legendaDaPrevia', 'function fichaDaPreviaHtml'), c);
  vm.runInContext(trecho(material, 'function eVideoDoMaterial', '// ── VÍDEO NO OLHO'), c);
  vm.runInContext(trecho(status, 'function statusContextPreviewAssets', 'function statusContextPreviewAsset('), c);
  vm.runInContext(trecho(portoes, 'const VBJ_ICONES', 'function abrirJanelaV2'), c);
  vm.runInContext(trecho(portoes, 'function janelaDeConferenciaHtml', 'function openQualityGate'), c);
  return c;
}
// Valores do vm vêm de outro realm: compara pela forma.
const igual = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const imagem = (n, extra = {}) => ({ id: `a${n}`, local_id: n, name: `arte-${n}.png`, file_extension: 'png', url_thumbnail: `/mini/${n}?sz=400`, public_url: `/mini/${n}?sz=1920`, link_drive: `https://drive.google.com/file/d/A${n}/view`, ...extra });

test('mídia: anexo primeiro (carrossel com todas as imagens), o vídeo anexado toca até 60 MB', () => {
  const c = mesa();
  const carrossel = c.midiaDaConferencia({ assets: [imagem(1), imagem(2), imagem(3)] }, { tipo: 'video', quadro: '/q' });
  assert.equal(carrossel.fonte, 'anexo', 'com anexo, o link de entrega não entra');
  igual(carrossel.itens.map((x) => [x.tipo, x.src, x.imagem]), [['imagem', '/mini/1?sz=1920', 0], ['imagem', '/mini/2?sz=1920', 1], ['imagem', '/mini/3?sz=1920', 2]]);
  const video = c.midiaDaConferencia({ assets: [{ local_id: 9, name: 'reels.mp4', file_extension: 'mp4', file_size: 20e6, url_thumbnail: '/capa', link_drive: 'https://drive.google.com/file/d/V/view' }, imagem(4, { name: 'capa.png' })] });
  assert.equal(video.itens[0].tipo, 'video');
  assert.equal(video.itens[0].src, '/api/painel?area=baixar&arquivo=9');
  assert.equal(video.itens[1].tipo, 'imagem', 'a capa vem depois do vídeo');
  const grande = c.midiaDaConferencia({ assets: [{ local_id: 9, name: 'bruto.mov', file_extension: 'mov', file_size: 900e6, url_thumbnail: '/capa' }] });
  assert.equal(grande.itens[0].src, '', 'acima de 60 MB não toca aqui: a capa com Abrir');
  assert.equal(grande.itens[0].capa, '/capa');
});

test('mídia: sem anexo, o link de entrega (previa_entrega / video_entrega); "nada" só sem arquivo e sem link', () => {
  const c = mesa();
  const reels = c.midiaDaConferencia({ assets: [] }, { tipo: 'video', thumb: '/mini?id=X', quadro: '/api/painel?area=video_entrega&id=X&e=s', abrir: 'https://drive.google.com/file/d/X/view', nome: 'voa.mp4', fonte: 'entrega' });
  assert.equal(reels.fonte, 'entrega');
  assert.deepEqual([reels.itens[0].tipo, reels.itens[0].src, reels.itens[0].capa], ['video', '/api/painel?area=video_entrega&id=X&e=s', '/mini?id=X']);
  // a miniatura que o Conteúdo mediu e achou preta não vira capa
  const preta = c.midiaDaConferencia({}, { tipo: 'video', thumb: null, quadroDe: '/preta', video: '/api/painel?area=video_entrega&id=X&e=s', abrir: 'u' });
  assert.equal(preta.itens[0].capa, '');
  const carrosselDaPasta = c.midiaDaConferencia({}, { tipo: 'imagem', thumb: '/mini?id=Y', n: 4, abrir: 'u' });
  igual([carrosselDaPasta.itens[0].tipo, carrosselDaPasta.n], ['imagem', 4]);
  const soLink = c.midiaDaConferencia({}, { tipo: 'link', thumb: null, abrir: 'https://exemplo.test/pasta' });
  assert.deepEqual([soLink.fonte, soLink.itens.length, soLink.abrir], ['entrega', 0, 'https://exemplo.test/pasta']);
  assert.equal(c.midiaDaConferencia({}, null).fonte, 'nada');
  assert.equal(c.midiaDaConferencia({ assets: [{ name: 'contrato.pdf', file_extension: 'pdf' }] }).fonte, 'nada', 'PDF sem miniatura não é mídia');
});

test('palco: vídeo tocável (controles, mudo, parado em 1 s), carrossel com setas e contador, "Sem prévia" só sem mídia', () => {
  const c = mesa();
  const video = c.palcoDaConferenciaHtml(c.midiaDaConferencia({}, { tipo: 'video', quadro: '/q?a=1', abrir: 'u', nome: 'voa.mp4' }));
  assert.match(video, /<video id="material-review-video" class="vbc-video" src="\/q\?a=1#t=1" controls muted playsinline preload="metadata"/);
  assert.doesNotMatch(video, /Sem prévia/);
  const tres = c.midiaDaConferencia({ assets: [imagem(1), imagem(2), imagem(3)] });
  const html = c.palcoDaConferenciaHtml(tres, 1);
  assert.match(html, /vbc-seta antes[^]*vbc-seta depois/);
  assert.match(html, /2 de 3 · arte-2\.png/);
  assert.match(html, /onclick="abrirPreviaGrande\(1\)"/);
  assert.match(html, /data-fallback-src="\/mini\/2\?sz=400"/, 'a miniatura de 400 é a reserva da imagem grande');
  assert.match(c.palcoDaConferenciaHtml(c.midiaDaConferencia({})), /<b>Sem prévia<\/b>Nenhum arquivo ou link de entrega/);
  assert.match(c.palcoDaConferenciaHtml(c.midiaDaConferencia({}, { tipo: 'link', abrir: 'u' })), /O link de entrega não pôde ser lido aqui/);
  const capa = c.palcoDaConferenciaHtml(c.midiaDaConferencia({}, { tipo: 'video', thumb: '/capa', abrir: 'u' }));
  assert.match(capa, /<img id="material-review-img" src="\/capa"[^>]*alt="Capa do vídeo[^]*vbc-play/);
});

test('legenda: a do planejamento aprovado, senão a do briefing; sem nenhuma, "Sem legenda cadastrada"', () => {
  const c = mesa();
  const plano = c.textosDaConferencia({ planejamento: { legenda: 'Legenda que o cliente aprovou.' }, briefing: 'LEGENDA DO POST\nLegenda: outra' });
  igual({ ...plano.legenda }, { texto: 'Legenda que o cliente aprovou.', origem: 'do planejamento aprovado' });
  const doBriefing = c.textosDaConferencia({ briefing: 'Objetivo: vender\nLEGENDA DO POST\nLegenda: Matrículas abertas! Chame no WhatsApp.' });
  igual({ ...doBriefing.legenda }, { texto: 'Matrículas abertas! Chame no WhatsApp.', origem: 'do briefing' });
  const sem = c.textosDaConferencia({ briefing: '' });
  assert.equal(sem.legenda.texto, '');
  assert.match(c.legendaDaConferenciaHtml(sem.legenda), /Sem legenda cadastrada/);
  assert.match(c.legendaDaConferenciaHtml({ texto: 'a <b>b</b>' }), /<p class="vbc-legenda-txt">a &lt;b&gt;b&lt;\/b&gt;<\/p>/);
});

test('briefing: o essencial primeiro (objetivo, mensagem, CTA, referências, observações), o resto sem repetir; sem nada, "Sem briefing"', () => {
  const c = mesa();
  const b = c.textosDaConferencia({ briefing_origem: 'cadastro', briefing: 'BRIEFING\nObjetivo: Abrir matrículas\nMensagem/Copy: Garanta a vaga\nCTA: Chame no WhatsApp\nReferências: Feed de novembro\nObservações: Sem foto de criança\nPúblico-Alvo: Pais\nLEGENDA DO POST\nLegenda: texto da legenda' }).briefing;
  igual(b.essencial.map((x) => x.rotulo), ['Objetivo', 'Mensagem', 'CTA', 'Referências', 'Observações']);
  assert.equal(b.origem, 'do cadastro da peça');
  igual(b.secoes.map((s) => [s.titulo, s.linhas.map((l) => l.rotulo)]), [['BRIEFING', ['Público-Alvo']]], 'sem a legenda e sem o que já está no essencial');
  const html = c.briefingDaConferenciaHtml(b);
  assert.match(html, /<dl class="vbc-essencial"><div><dt>Objetivo<\/dt><dd>Abrir matrículas<\/dd><\/div>/);
  assert.match(html, /Briefing completo[^]*<p class="vbc-bl-par"><span>Público-Alvo<\/span> Pais<\/p>/);
  assert.doesNotMatch(html, /class="brief-/, 'classes próprias: as brief-* têm cor fixa no CSS antigo');
  // Sem briefing na peça, o pedido do planejamento
  const plano = c.textosDaConferencia({ planejamento: { objetivo: 'Venda', tema: 'Flared 30%', referencia: 'Reels de inverno', telas: ['Tela 1', 'Tela 2'], ajuste_cliente: 'Trocar a música' } }).briefing;
  igual(plano.essencial.map((x) => [x.rotulo, x.valor]), [['Objetivo', 'Venda'], ['Mensagem', 'Flared 30%'], ['Referências', 'Reels de inverno'], ['Ajuste do cliente', 'Trocar a música']]);
  assert.equal(plano.origem, 'do planejamento');
  assert.equal(plano.secoes[0].titulo, 'Telas');
  const nada = c.textosDaConferencia({}).briefing;
  assert.equal(nada.tem, false);
  assert.match(c.briefingDaConferenciaHtml(nada), /Sem briefing/);
});

test('a janela: peça, checklist, legenda e briefing; cada caixa diz o que confere sem mudar o texto que o histórico registra', () => {
  const c = mesa();
  assert.equal(c.alvoDoCheckDaConferencia('Copy, legenda e CTA revisados'), 'legenda');
  assert.equal(c.alvoDoCheckDaConferencia('Capa, áudio e proporção validados'), 'peca');
  assert.equal(c.alvoDoCheckDaConferencia('Capa e última página com CTA confirmadas'), 'peca');
  assert.equal(c.alvoDoCheckDaConferencia('Confirmei que legenda, CTA, canal e data de publicação estão corretos'), 'legenda');
  assert.equal(c.alvoDoCheckDaConferencia('Cliente e responsável pela publicação confirmados'), '');
  const checks = ['Arquivo final correto e sem versão provisória', 'Copy, legenda e CTA revisados', 'Cliente e responsável pela publicação confirmados', 'Capa, áudio e proporção validados'];
  const html = c.janelaDeConferenciaHtml({ item: { nome: 'Reels Macacões', cliente: 'VOA', formato: 'Reels', status: 'Para aprovação' }, option: { label: 'Para agendar' },
    titulo: 'Checklist de qualidade', sub: 's', cab: 'c', idForm: 'quality-checklist-form', mudar: 'updateQualityGateState()', checks, nota: 'n', idBotao: 'quality-submit', onclick: 'submitQualityChecklist()', acao: 'Continuar' });
  for (const id of ['material-review-preview', 'vbc-bloco-peca', 'vbc-legenda', 'vbc-legenda-corpo', 'vbc-legenda-copiar', 'vbc-briefing', 'vbc-briefing-corpo']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /<label class="vbc-check" data-alvo="legenda" data-alvo-rotulo="legenda"><input type="checkbox"  name="quality-checklist-form-1">/);
  assert.match(html, /<label class="vbc-check"><input type="checkbox"  name="quality-checklist-form-2">/, 'sem alvo, sem etiqueta');
  // o texto da caixa (o que submitQualityChecklist lê com textContent) é só o da caixa
  const labels = [...html.matchAll(/<label class="vbc-check"[^>]*>([^]*?)<\/label>/g)].map((m) => m[1].replace(/<svg[^]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim());
  igual(labels, checks);
  // o que o portão grava e quem pode trocar não mudou
  assert.match(portoes, /`\[Vybe OS · Checklist de qualidade\]\\nDestino: \$\{flow\.option\.label\}\\nFormato: \$\{flow\.item\.formato \|\| flow\.item\.tipo \|\| 'Conteúdo'\}\\nValidado: \$\{checks\.join\(' \| '\)\}`/);
  assert.match(portoes, /const checks=\[\.\.\.form\.querySelectorAll\('label'\)\]\.map\(label=>label\.textContent\.trim\(\)\)/);
  assert.equal((portoes.match(/'vbc vbc-mesa/g) || []).length, 3, 'as três conferências abrem a mesa');
});

test('servidor: a peça do planejamento aprovado vem no detalhe (legenda e pedido), só leitura', async () => {
  const planos = [{ mes: '2026-12-01', conteudo: { pecas: [{ conteudo_id: '7', legenda: 'Outra' }] } },
    { mes: '2026-11-01', conteudo: { pecas: [{ conteudo_id: '42', legenda: 'Macacões 30% OFF\r\nlink na bio', objetivo: 'Venda', tema: 'Flared', telas: ['T1', { texto: 'T2' }], referencia: 'Ref', observacao: 'Obs', ajuste_cliente: 'Trocar a música' }] } }];
  assert.deepEqual(pecaDoPlanejamentoEm(planos, 42), { legenda: 'Macacões 30% OFF\nlink na bio', objetivo: 'Venda', tema: 'Flared', linha: '', telas: ['T1', 'T2'], referencia: 'Ref', observacao: 'Obs', ajuste_cliente: 'Trocar a música', mes: '2026-11-01' });
  assert.equal(pecaDoPlanejamentoEm(planos, 99), null);
  const consultas = [];
  const sql = (partes, ...valores) => { const q = partes.join('?'); consultas.push([q, valores]); return Promise.resolve(/to_regclass/.test(q) ? [{ existe: true }] : planos); };
  assert.equal((await pecaDoPlanejamento(sql, 42)).legenda, 'Macacões 30% OFF\nlink na bio');
  const q = consultas.find(([x]) => /vybe_planejamentos/.test(x) && !/to_regclass/.test(x));
  assert.match(q[0], /^SELECT mes, conteudo FROM vybe_planejamentos/);
  assert.match(q[0], /cliente_id IN \(SELECT cliente_id FROM vybe_conteudo_clientes WHERE conteudo_id = \?\)/);
  assert.deepEqual(q[1], [42, ['aprovado', 'cadastrado']]);
  assert.equal(consultas.some(([x]) => /INSERT|UPDATE|DELETE/i.test(x)), false);
  assert.equal(await pecaDoPlanejamento(sql, 'vybe:1'), null, 'id inválido nem consulta');
  const semTabela = (partes) => Promise.resolve(/to_regclass/.test(partes.join('?')) ? [{ existe: false }] : planos);
  assert.equal(await pecaDoPlanejamento(semTabela, 42), null);
  assert.match(ler('api/painel.js'), /const planejamento = await pecaDoPlanejamento\(db, c\.id\)\.catch\(\(\) => null\);[^]*?planejamento,/);
});

test('CSS da mesa: fragmento próprio, só tokens, sem !important, sem :has e sem html body.mundo', () => {
  const css = ler('padrao-v2/s-y.css').replace(/\/\*[^]*?\*\//g, '');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /html\s+body\.mundo/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b(?![-\w])/i, 'cor só por token');
  assert.match(css, /#workflow-modal\.vbj\.vbc\.vbc-mesa\{[^}]*top:calc\(78px/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/s-y.css ===== */'), 'juntado no padrao-v2');
});
