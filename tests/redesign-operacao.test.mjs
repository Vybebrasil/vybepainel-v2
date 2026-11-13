// Redesign, frente operação (10/11/2026; quadros 04, 06, 28 e 65 do moodboard): Agenda e captações, gaveta da demanda,
// celular (um dock só com Voz) e cartão da captação.
// SAFE: lê os arquivos e roda vybe-captacoes.js num contexto vm com DOM falso; nada de rede, banco ou envio real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const captJs = ler('vybe-captacoes.js'), mundoJs = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');
const gaveta = ler('vybe-gaveta.js'), gestor = ler('vybe-gestor.js'), log = ler('vybe-log.js'), producao = ler('production_governed_v2.js');
const bloco = css.slice(css.indexOf('/* ===== Frente operação do redesign'));

function contextoCaptacoes(hoje = '2026-11-10') {
  const doc = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({}) };
  const ctx = { document: doc, console, Intl, Date, Math, Number, String, Set, Map, Array, Object, JSON, RegExp, setTimeout: () => 0,
    hojeDeVerdade: () => hoje, safeText: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
    cliCor: (n) => `<span class="cli">${n}</span>`, vbEstadoHtml: () => '', showToast() {}, CSS: { escape: (s) => s } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = () => {}; ctx.matchMedia = () => ({ matches: false });
  vm.createContext(ctx);
  vm.runInContext(captJs, ctx);
  return ctx;
}

test('04: "Marcar captação" no cabeçalho; o "+ Novo" sai da barra e as abas entram nela', () => {
  assert.ok(producao.includes('class="vb-botao principal capt-marcar" onclick="captMarcarCaptacao()"'));
  assert.ok(producao.includes('window.prodV2AbasHtml = function()'), 'as abas da agenda numa função só');
  assert.ok(!captJs.includes('class="capt-tb-criar"'), 'o "+ Novo" não volta para a barra');
  assert.ok(captJs.includes('${typeof prodV2AbasHtml === "function" ? prodV2AbasHtml() : ""}'));
  assert.ok(captJs.includes('else if (k === "n") captMarcarCaptacao();'), 'o atalho N abre o mesmo formulário');
  assert.ok(captJs.includes('class="capt-tb-nav"'), 'Hoje, setas e o período andam juntos quando a barra quebra');
});

test('04: o evento não corta o nome: cliente fora do título da reunião, linhas pelo tamanho do bloco', () => {
  const c = contextoCaptacoes();
  const partes = (e) => JSON.parse(JSON.stringify(c.agPartesDoTitulo(e)));
  assert.deepEqual(partes({ tipo: 'reuniao', titulo: 'Reunião de pauta - Cliente B', cliente: 'Cliente B (fictício)' }), { nome: 'Reunião de pauta', resto: 'Cliente B (fictício)' });
  assert.deepEqual(partes({ tipo: 'outro', titulo: 'Cliente C (fictício)', cliente: 'Cliente C (fictício)' }), { nome: 'Cliente C (fictício)', resto: '' });
  assert.deepEqual(partes({ tipo: 'captacao', titulo: 'Captação - Cliente C - fachada', cliente: 'Cliente C (fictício)' }), { nome: 'Cliente C (fictício)', resto: 'fachada' });
  const ev = (id, inicio, fim, titulo) => ({ id, titulo, dia: '2026-11-11', inicio, fim, tipo: 'reuniao' });
  const html = c.agendaSemanaHtml({ inicio: '2026-11-09', eventos: [ev('a', '09:00', '10:00', 'Uma hora'), ev('b', '13:00', '13:30', 'Meia hora')] });
  assert.match(html, /data-ev="a" class="ag-ev t-reuniao[^"]*"[^>]*--linhas:2;/, '1 h: título em duas linhas e o horário embaixo');
  assert.match(html, /data-ev="b" class="ag-ev mini/, '30 min: só o título');
  // A grade abre no primeiro compromisso (09:00), não às 07:00.
  assert.match(html, /data-ag-rolar="(\d+)"/);
  assert.equal(Number(html.match(/data-ag-rolar="(\d+)"/)[1]), 2 * vm.runInContext('AG_HORA_PX', c));
  assert.ok(css.includes('@container (max-width:72px)') && css.includes('-webkit-line-clamp:var(--linhas-estreito,2)'), 'estreito quebra entre palavras, sem reticências na primeira linha');
});

test('65: "Trocar cliente" é botão e as peças esperando aparecem no cartão', () => {
  const c = contextoCaptacoes();
  vm.runInContext(`CAPT.pecas = [
    { id: '1', titulo: 'Reels - Prato do dia', formato: 'Reels', prazo: '2026-11-18', clientes: [{ id: 'c1' }] },
    { id: '2', titulo: 'Ambiente', formato: 'Foto', clientes: [{ id: 'c1' }] },
    { id: '3', titulo: 'De outro cliente', formato: 'Card', prazo: '2026-11-12', clientes: [{ id: 'c2' }] }];`, c);
  const e = { id: 'g1', tipo: 'captacao', titulo: 'Captação - Cliente A', dia: '2026-11-14', inicio: '', cliente: 'Cliente A', cliente_id: 'c1' };
  e.estado = c.captEstado(e);
  const html = c.captDetalheHtml(e);
  assert.ok(html.includes('<summary class="vb-botao"') && html.includes('>Trocar cliente</summary>'));
  assert.ok(!html.includes('Não é este cliente? Trocar'));
  assert.ok(html.includes('2 peças esperando'));
  assert.ok(!html.includes('peças do cliente esperando'), 'sem repetir a conta do selo');
  assert.ok(html.includes('>Reels - Prato do dia</button>'), 'o formato não se repete quando já está no título');
  assert.ok(html.includes('>Foto · Ambiente</button>'));
  assert.ok(!html.includes('De outro cliente'));
  assert.ok(html.indexOf('Reels - Prato do dia') < html.indexOf('Ambiente'), 'quem tem prazo vem antes');
});

test('06: copiar link e log de atividade viram ícones com nome acessível e dica', () => {
  // Padrão v2 (quadro da gaveta): três ícones no topo (link, mais ações, fechar); o log da peça mora no "mais ações" e na aba Histórico.
  assert.ok(gaveta.includes('${botaoDeLinkHtml(item, { icone: true })}${menuDeAcoesDaPecaHtml(item, { linkELog: true })}'));
  assert.ok(gaveta.includes('${botaoDoLogHtml(item.id, { demanda: true, icone: true })}'), 'na solicitação o log segue como ícone');
  assert.ok(gestor.includes(`\${icone ? ' aria-label="Copiar link"' : ''}`) && gestor.includes('title="Copiar o link desta atividade para mandar no grupo"'));
  assert.ok(log.includes(`\${icone ? ' aria-label="Log de atividade"' : ''}`) && log.includes('title="Log de atividade:'));
  assert.ok(gestor.includes("botao.classList.contains('so-icone') ? visto"), 'o visto entra no lugar do ícone, sem mudar a largura');
  assert.ok(css.includes(':not(:has(button,a,input,select)){filter:brightness(.6) saturate(1.35)}'), 'o escurecer do rótulo não pega o grupo de botões');
  assert.ok(ler('vybe-padrao.css').includes(':where(body:not(.mundo)) #workspace-drawer :is(.workspace-action,.workspace-close,'), 'o botão escuro do tema antigo fica no tema antigo');
});

test('28: um dock só no celular (Voz no lugar do cartão), gaveta em tela cheia com ‹ e o "⋯"', () => {
  assert.ok(mundoJs.includes('data-cel="voz" aria-expanded="false" aria-controls="vv-dock-salas-faixa"'));
  assert.ok(mundoJs.includes("if (qual === 'voz') {") && mundoJs.includes('abrirVozCel(!vozCelAberta())'));
  assert.ok(mundoJs.includes("faixaDock.id = 'vv-dock-salas-faixa'"));
  assert.ok(bloco.includes('body.mundo.dock-cartao:not(.cel-voz-aberta) .vv-dock-salas-faixa{display:none}'), 'fora da chamada o cartão fica guardado no Voz');
  assert.ok(bloco.includes('body.mundo .vv-trilho [data-cel="voz"]{order:3;'));
  assert.ok(!bloco.includes('.vq-dock{display:none') && !/na-chamada[^{]*\.vv-dock-salas-faixa\{display:none/.test(bloco), 'na chamada o microfone continua à vista');
  assert.ok(gaveta.includes('class="workspace-voltar"') && gaveta.includes('menuDeAcoesDaPecaHtml(item, { linkELog: true })'));
  assert.ok(gaveta.includes('class="workspace-mais-cel" onclick="fecharMenusDaGaveta();copiarLinkDaAtividade('));
  assert.ok(gaveta.includes('${gavetaObjetivoHtml(item)}') && gaveta.includes('vc.campoObjetivoHtml(item)') && bloco.includes('.vc-objetivo-campo{display:inline-flex;flex-wrap:nowrap;'), 'Objetivo numa linha');
  assert.ok(gaveta.includes('<div class="gv2-corpo">') && !gaveta.includes('style="flex:1;overflow-y:auto;padding:22px 24px 0;'));
});

test('frente operação sem forçar nada: nenhum !important nem html body.mundo no bloco novo', () => {
  assert.ok(bloco.length > 1000);
  assert.doesNotMatch(bloco, /!important/);
  assert.doesNotMatch(bloco, /html body\.mundo/);
});

// ---- 3ª rodada (11/11/2026, quadro 04): bloco estreito com o horário, pilha na coluna apertada e o Mês sem fundo ----
const bloco3 = css.split('/* ==== Terceira rodada · Telas')[1] || '';
const reuniao = (id, inicio, fim, titulo) => ({ id, titulo, dia: '2026-11-11', inicio, fim, tipo: 'reuniao' });

test('04 (3ª rodada): no bloco estreito fica o começo do horário; o intervalo inteiro segue no rótulo', () => {
  const c = contextoCaptacoes();
  const html = c.agendaSemanaHtml({ inicio: '2026-11-09', eventos: [reuniao('a', '09:00', '10:00', 'Pauta'), reuniao('b', '13:00', '14:00', 'Alinhamento')] });
  assert.match(html, /data-ev="a"[^>]*aria-label="Reunião: Pauta, [^"]*09:00–10:00"/, 'o intervalo completo no rótulo');
  assert.match(html, /<b data-hora="09:00">Pauta<\/b><small><span class="ag-h"><span class="ag-h-ini">09:00<\/span><span class="ag-h-resto">–10:00<\/span><\/span><\/small>/);
  assert.doesNotMatch(html, /data-ev="a" class="ag-ev[^"]*junto/, 'sozinho na hora não entra em pilha');
  assert.ok(css.includes('body.mundo .ag-col .ag-ev .ag-h-resto{display:none}'), 'estreito: só o começo');
  assert.doesNotMatch(css, /body\.mundo \.ag-col \.ag-ev:not\(\.mini\) small\{display:none\}/, 'o horário não some mais no bloco estreito');
});

test('04 (3ª rodada): dois na mesma hora levam as medidas da pilha; o "+N" abre o dia e só existe onde há a vista Dia', () => {
  const c = contextoCaptacoes();
  const semana = (eventos, acoes = {}) => c.agendaSemanaHtml({ inicio: '2026-11-09', eventos, acoes });
  let html = semana([reuniao('a', '09:00', '10:00', 'Pauta'), reuniao('b', '09:00', '10:00', 'Alinhamento')]);
  assert.match(html, /data-ev="a" class="ag-ev junto n2 t-reuniao[^"]*" style="--e-top:[\d.]+px;--e-alt:30px;--linhas-emp:2;top:var\(--emp-top,[\d.]+px\);height:var\(--emp-alt,64px\);left:var\(--emp-esq,calc\(0% \+ 2px\)\);width:var\(--emp-larg,calc\(50% - 4px\)\);/);
  assert.match(html, /data-ev="b" class="ag-ev junto n2 /);
  assert.doesNotMatch(html, /ag-junto-mais|junto-fora/, 'dois cabem na hora: ninguém fica de fora');
  // Quatro na mesma hora: um fica à vista e o "+3" abre o dia.
  html = semana(['a', 'b', 'c', 'd'].map((id) => reuniao(id, '09:00', '10:00', 'Reunião ' + id)), { verDia: 'captVerDia' });
  assert.equal((html.match(/ junto-fora/g) || []).length, 3);
  assert.match(html, /<button type="button" hidden class="ag-junto-mais n4" style="top:[\d.]+px;height:16px" onclick="event\.stopPropagation\(\);agPreviaSair\(true\);captVerDia\('2026-11-11'\)" aria-label="Mais 3 às 09:00: abrir o dia" title="Abrir o dia">\+3<\/button>/);
  // Sem a vista Dia (agenda do Escritório) não há "+N": todos seguem na pilha.
  assert.doesNotMatch(semana(['a', 'b', 'c', 'd'].map((id) => reuniao(id, '09:00', '10:00', 'Reunião ' + id))), /ag-junto-mais|junto-fora/);
  // Dois de meia hora: não cabe nem um com o horário; um botão diz quantos são e abre o dia.
  html = semana([reuniao('a', '09:00', '09:30', 'Pauta'), reuniao('b', '09:00', '09:30', 'Alinhamento')], { verDia: 'captVerDia' });
  assert.match(html, /class="ag-junto-mais n2 gm"[^>]*aria-label="2 compromissos às 09:00: abrir o dia"[^>]*>2 às 09:00<\/button>/);
  assert.match(html, /data-ev="a" class="ag-ev mini junto n2 gm junto-fora /);
  assert.ok(captJs.includes('previa: "captPreviaHtml", verDia: "captVerDia" } });'), 'a semana das Captações sabe abrir o dia');
  // A pilha só liga quando a coluna aperta: quem decide é a largura da coluna, no CSS.
  assert.match(bloco3, /body\.mundo \.ag-col\{container:agcol \/ inline-size\}/);
  assert.match(bloco3, /@container agcol \(max-width:119px\)\{\s*body\.mundo \.ag-col \.ag-ev\.junto\{--emp-top:var\(--e-top\);--emp-alt:var\(--e-alt\);--emp-esq:2px;--emp-larg:calc\(100% - 4px\)/);
  assert.match(bloco3, /@container agcol \(min-width:120px\) and \(max-width:179px\)\{\s*body\.mundo \.ag-col \.ag-ev\.junto:is\(:not\(\.n2\),\.gm\)\{/);
  assert.match(bloco3, /body\.mundo \.ag-col \.ag-ev\.junto b::before\{content:attr\(data-hora\)/, 'na pilha, "09:00 Título"');
  assert.equal(vm.runInContext('AG_HORA_PX', c), 66, 'a hora da grade não cresceu');
});

test('04 (3ª rodada): no Mês o nome quebra em linhas; branco com o traço no computador, faixa cheia com texto escuro no celular', () => {
  assert.match(bloco3, /body\.mundo \.capt-cal \.capt-mes \.ag-chip\{[^}]*background:#FFFFFF;box-shadow:inset 3px 0 0 var\(--ag-cor\),inset 0 0 0 1px/);
  assert.match(bloco3, /body\.mundo \.capt-cal \.capt-mes \.ag-chip span\{[^}]*-webkit-line-clamp:3;[^}]*white-space:normal;text-overflow:clip/);
  assert.match(bloco3, /body\.mundo \.capt-cal \.capt-mes \.ag-chip i\{display:none\}/, 'a cor fica só no traço');
  // Celular: a faixa cheia na cor do tipo fica (Paulo, 09/11/2026: "igual ao Google Agenda"), com texto que se lê.
  const celular = bloco3.slice(bloco3.indexOf('@media (max-width:700px){'));
  assert.match(celular, /body\.mundo \.capt-cal \.capt-mes \.ag-chip,body\.mundo \.capt-cal \.capt-mes \.ag-chip:hover\{[^}]*background:var\(--ag-cor\);box-shadow:none/);
  assert.match(celular, /body\.mundo \.capt-cal\.vista-mes \.capt-mes \.ag-chip\.passou\{opacity:1\}/, 'o que passou não apaga: apagado não se lia sobre a cor');
  assert.match(css, /\.capt-cal\.vista-mes \.capt-mes \.ag-chip\.ag-chip\{color:#1F1D1A!important\}/, 'texto escuro: 5:1 ou mais no azul, no amarelo e no cinza');
  assert.doesNotMatch(css, /\.capt-mes \.ag-chip\.ag-chip\{color:#FFFFFF/, 'branco sobre o azul dava 3,3:1');
  assert.ok(captJs.includes('onclick="event.stopPropagation();captVerDia(\'${dia}\')">+${lista.length - max}'), 'o "+N" abre o dia');
});

test('3ª rodada · Telas sem forçar nada: nenhum !important nem html body.mundo no bloco novo; a data do formulário com ícone desenhado', () => {
  assert.ok(bloco3.length > 1500);
  assert.doesNotMatch(bloco3, /!important/);
  assert.doesNotMatch(bloco3, /html body\.mundo/);
  assert.match(bloco3, /body\.mundo input\[type="date"\]::-webkit-calendar-picker-indicator\{display:none\}/, 'o ícone do navegador some desde o começo');
  assert.match(ler('vybe-clientes-reunioes.js'), /<label class="cad-campo cad-data"><span>Data<\/span><input id="reu-data" type="date"[^>]*><svg class="cad-data-ico" viewBox="0 0 24 24" aria-hidden="true">/);
});
