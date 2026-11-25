// Frente s-z (25/11/2026): navegar no Checklist de qualidade. Recado da equipe sobre o print do card da Gonzalez ("02 DE
// DEZEMBRO - GONZALEZ - QUARTA SEM PRESSA - 01.png", "anexo da peça", sem setas): "no caso aqui, um botão pra ir pro
// próximo ou voltar"; Paulo: "arruma, entendeu?". SAFE: funções puras no vm, PGlite em memória e Drive de mentira.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { areaPreviaEntrega, previaDaEntrega, escolherDaPasta, esquecerPreviasDaEntrega, miniaturaAssinada } from '../server/previa-entrega.js';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const portoes = ler('vybe-portoes.js'), material = ler('vybe-material.js'), status = ler('vybe-status.js');
const trecho = (fonte, de, ate) => { const i = fonte.indexOf(de); assert.ok(i >= 0, `sem ${de}`); const f = fonte.indexOf(ate, i); assert.ok(f > i, `sem ${ate}`); return fonte.slice(i, f); };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const igual = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);

const salvo = process.env.SESSAO_SECRET;
before(() => { process.env.SESSAO_SECRET = 'segredo-ficticio-da-frente-s-z'; });
after(() => { if (salvo === undefined) delete process.env.SESSAO_SECRET; else process.env.SESSAO_SECRET = salvo; });

function mesa() {
  const c = vm.createContext({ safeText: esc, corDoClienteV2: () => '#3B5BA9' });
  vm.runInContext(trecho(material, 'function eVideoDoMaterial', '// ── VÍDEO NO OLHO'), c);
  vm.runInContext(trecho(status, 'function statusContextPreviewAssets', 'function statusContextPreviewAsset('), c);
  vm.runInContext(trecho(portoes, 'function normalizedWorkflowStatus', 'function statusNeedsHandoff'), c);
  vm.runInContext(trecho(portoes, 'const VBJ_ICONES', 'function abrirJanelaV2'), c);
  vm.runInContext(trecho(portoes, 'function janelaDeConferenciaHtml', 'function openQualityGate'), c);
  vm.runInContext(trecho(portoes, 'function fitaDaConferenciaHtml', 'function pintarFitaDaConferencia'), c);
  vm.runInContext(trecho(portoes, 'let FILA_DA_CONFERENCIA', 'function filaDaConferenciaAgora'), c);
  vm.runInContext(trecho(portoes, 'function filaDaConferenciaHtml', '// Chamada por cada conferência'), c);
  return c;
}
const GONZALEZ = '02 DE DEZEMBRO - GONZALEZ - QUARTA SEM PRESSA';
const anexo = (id, nome) => ({ id, local_id: id.length, name: nome, file_extension: 'png', url_thumbnail: `/mini/${id}?sz=400`, public_url: `/mini/${id}?sz=1920`, link_drive: `https://drive.google.com/file/d/${id}/view` });

test('arquivos: o 01 anexado junta com o 02 e o 03 da pasta de entrega, na ordem do número do nome, sem repetir', () => {
  const c = mesa();
  const pasta = { tipo: 'imagem', fonte: 'entrega', n: 3, abrir: 'https://drive.google.com/drive/folders/P', itens: [
    { id: 'd03', tipo: 'imagem', nome: `${GONZALEZ} - 03.png`, thumb: '/m/d03?sz=480', grande: '/m/d03?sz=1600', abrir: 'u3' },
    { id: 'd01', tipo: 'imagem', nome: `${GONZALEZ} - 01.png`, thumb: '/m/d01?sz=480', grande: '/m/d01?sz=1600', abrir: 'u1' },
    { id: 'd02', tipo: 'imagem', nome: `${GONZALEZ} - 02.png`, thumb: '/m/d02?sz=480', grande: '/m/d02?sz=1600', abrir: 'u2' }] };
  // Hoje (s-y): com anexo, o link de entrega nem entrava, e a janela mostrava só o 01.
  const soAnexo = c.midiaDaConferencia({ assets: [anexo('d01', `${GONZALEZ} - 01.png`)] });
  assert.equal(soAnexo.itens.length, 1);
  const m = c.midiaDaConferencia({ assets: [anexo('d01', `${GONZALEZ} - 01.png`)] }, pasta);
  assert.equal(m.fonte, 'anexo');
  assert.equal(m.comPasta, true);
  igual(m.itens.map((x) => [x.nome.slice(-6), x.src]), [['01.png', '/mini/d01?sz=1920'], ['02.png', '/m/d02?sz=1600'], ['03.png', '/m/d03?sz=1600']], 'o 01 é o anexo (o mesmo id da pasta entra uma vez só)');
  igual(m.itens.map((x) => x.imagem), [0, 1, 2], 'todas abrem na Prévia grande');
  igual(m.material.map((a) => a.name.slice(-6)), ['01.png', '02.png', '03.png']);
  assert.equal(m.itens[1].origem, 'entrega');
  // Anexos fora de ordem também ordenam pelo número do fim do nome (o "02" do "02 DE DEZEMBRO" não conta).
  const fora = c.midiaDaConferencia({ assets: [anexo('a3', `${GONZALEZ} - 03.png`), anexo('a1', `${GONZALEZ} - 01.png`), anexo('a2', `${GONZALEZ} - 02.png`)] });
  igual(fora.itens.map((x) => x.nome.slice(-6)), ['01.png', '02.png', '03.png']);
  // O mesmo arquivo pelo nome (outro id) também não repete.
  const mesmoNome = c.midiaDaConferencia({ assets: [anexo('outroid0001', `${GONZALEZ} - 01.png`)] }, pasta);
  assert.equal(mesmoNome.itens.length, 3);
  // Sem número: a ordem de antes (o vídeo antes da capa).
  const semNumero = c.midiaDaConferencia({ assets: [{ id: 'v', local_id: 9, name: 'reels.mp4', file_extension: 'mp4', file_size: 1e6, url_thumbnail: '/capa' }, anexo('capa', 'capa.png')] });
  igual(semNumero.itens.map((x) => x.tipo), ['video', 'imagem']);
  assert.equal(c.numeroDoArquivo(`${GONZALEZ} - 01.png`), 1);
  assert.equal(c.numeroDoArquivo('VOA_macacoes_v3.mp4'), 3);
  assert.equal(c.numeroDoArquivo('capa.png'), null);
});

test('arquivos: sem anexo, todos os da pasta (não só o primeiro com "1 de N na pasta"); vídeo da pasta pelo quadro assinado', () => {
  const c = mesa();
  const m = c.midiaDaConferencia({ assets: [] }, { tipo: 'imagem', fonte: 'entrega', n: 2, abrir: 'https://drive.google.com/drive/folders/P', thumb: '/m/1',
    itens: [{ id: 'i2', tipo: 'imagem', nome: 'lamina 2.png', thumb: '/m/2', grande: '/g/2', abrir: 'u2' }, { id: 'i1', tipo: 'imagem', nome: 'lamina 1.png', thumb: '/m/1', grande: '/g/1', abrir: 'u1' },
      { id: 'v1', tipo: 'video', nome: 'bastidor.mp4', thumb: '/m/v', quadro: '/api/painel?area=video_entrega&id=v1&e=s', abrir: 'uv' }] });
  assert.equal(m.fonte, 'entrega');
  assert.equal(m.abrir, 'https://drive.google.com/drive/folders/P', 'Abrir leva à pasta');
  igual(m.itens.map((x) => [x.tipo, x.src]), [['imagem', '/g/1'], ['imagem', '/g/2'], ['video', '/api/painel?area=video_entrega&id=v1&e=s']]);
  const html = c.palcoDaConferenciaHtml(m, 1);
  assert.match(html, /<span class="vbc-midia-conta" aria-live="polite">2 de 3<\/span>/);
  assert.doesNotMatch(html, /na pasta/, 'com a lista inteira, sem "1 de N na pasta"');
  assert.match(html, /aria-label="Arquivo anterior"[^]*aria-label="Próximo arquivo"/);
  // a reserva de quem ainda manda só a capa (servidor antigo): continua "1 de N na pasta"
  assert.match(c.palcoDaConferenciaHtml(c.midiaDaConferencia({}, { tipo: 'imagem', thumb: '/m/1', n: 4, abrir: 'u' })), /1 de 4 na pasta/);
  // a fita: uma miniatura por arquivo, a da vez marcada; com um arquivo só, nada
  const fita = c.fitaDaConferenciaHtml(m, 1);
  assert.equal((fita.match(/class="vbc-fita-item/g) || []).length, 3);
  assert.match(fita, /class="vbc-fita-item on" aria-label="Arquivo 2 de 3: lamina 2\.png" aria-current="true"[^>]*onclick="irParaPreviaDaConferencia\(1\)"/);
  assert.equal(c.fitaDaConferenciaHtml({ itens: [m.itens[0]] }, 0), '');
});

test('servidor: a pasta manda a lista inteira (itens) pela ordem do nome, com a miniatura assinada; a capa do baralho não muda', async () => {
  const DRIVE = { PastaGonzalez01: [3, 1, 2].map((n) => ({ id: `gonz-lamina-0${n}`, name: `${GONZALEZ} - 0${n}.png`, mimeType: 'image/png', hasThumbnail: true })) };
  const p = await previaDaEntrega('https://drive.google.com/drive/folders/PastaGonzalez01', { cliente: 'Gonzalez', formato: 'Card' }, { listar: async (id) => DRIVE[id] || [] });
  assert.deepEqual([p.tipo, p.nome.slice(-6), p.n], ['imagem', '01.png', 3], 'a capa e o 1/N de sempre');
  assert.deepEqual(p.itens.map((x) => x.nome.slice(-6)), ['01.png', '02.png', '03.png']);
  const g = new URL(p.itens[1].grande, 'http://x').searchParams;
  assert.deepEqual([g.get('area'), g.get('id'), g.get('sz')], ['miniatura', 'gonz-lamina-02', '1600']);
  assert.ok(miniaturaAssinada('gonz-lamina-02', g.get('e')), 'a grande leva a mesma assinatura (ela não depende do tamanho)');
  assert.equal(escolherDaPasta([{ id: 'x', nome: 'a.png', tipo: 'imagem', caminho: '' }], {}).grupo, undefined, 'um arquivo só não leva lista');
});

test('servidor: area=previa_entrega com todos=1 lê a pasta mesmo com anexo; sem todos=1, como antes', async (t) => {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
  CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id text,titulo text,formato text,removido_em timestamptz);
  INSERT INTO vybe_conteudos(id,monday_item_id,titulo,formato) VALUES(11651,'9900','Card - Rodízio | Dezembro começa à mesa','Card');
  CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
  CREATE TABLE vybe_conteudo_arquivos(id serial PRIMARY KEY,conteudo_id bigint,drive_file_id text,ausente_em timestamptz);
  INSERT INTO vybe_conteudo_arquivos(conteudo_id,drive_file_id) VALUES(11651,'gonz-lamina-01');
  CREATE TABLE vybe_conteudo_updates(id serial PRIMARY KEY,conteudo_id bigint,corpo text,criado_em timestamptz);
  INSERT INTO vybe_conteudo_updates(conteudo_id,corpo,criado_em) VALUES(11651,'<p>[Vybe OS · Link de entrega] https://drive.google.com/drive/folders/PastaGonzalez01</p>','2026-11-24');`);
  esquecerPreviasDaEntrega();
  const DRIVE = { PastaGonzalez01: [1, 2, 3].map((n) => ({ id: `gonz-lamina-0${n}`, name: `${GONZALEZ} - 0${n}.png`, mimeType: 'image/png', hasThumbnail: true })) };
  const resposta = () => { const r = { codigo: 0, corpo: null }; r.status = (x) => { r.codigo = x; return r; }; r.setHeader = () => {}; r.json = (x) => { r.corpo = x; return r; }; return r; };
  const pedir = async (query) => { const r = resposta(); await areaPreviaEntrega({ method: 'GET', query }, r, { tipo: 'sessao', pessoa: { id: 3 } }, { db: sql, listar: async (id) => DRIVE[id] || [], arquivo: async () => null }); return r; };
  let r = await pedir({ item: '9900' });
  assert.deepEqual([r.corpo.previa, r.corpo.motivo], [null, 'tem_arquivo'], 'o baralho continua com a prévia do anexo');
  r = await pedir({ item: '9900', todos: '1' });
  assert.equal(r.codigo, 200);
  assert.deepEqual(r.corpo.previa.itens.map((x) => x.id), ['gonz-lamina-01', 'gonz-lamina-02', 'gonz-lamina-03']);
});

test('fila: a de "Para aprovar agora" quando a peça está nela; senão o mesmo status no quadro; o mesmo destino; sem fila clara, nada', () => {
  const c = mesa();
  const op = { label: 'Para agendar' };
  const opcoes = (p) => (p.sem ? [{ label: 'Alteração' }] : [{ label: 'Para agendar' }, { label: 'Alteração' }]);
  const peca = (id, extra = {}) => ({ id, nome: `Peça ${id}`, status: 'Para aprovação', ...extra });
  const aprovar = ['10', '11', '12', '13'].map((id) => ({ ref: id, item: peca(id, id === '12' ? { sem: true } : {}) }));
  const f = c.filaDaConferenciaDe({ item: peca('11'), option: op, aprovar, quadro: [], opcoesDe: opcoes });
  assert.equal(f.origem, 'aprovar');
  igual(f.pecas.map((x) => x.item.id), ['10', '11', '13'], 'a que não tem o mesmo destino fica fora');
  assert.equal(f.indice, 1);
  assert.equal(f.pecas[2].option.label, 'Para agendar');
  const html = c.filaDaConferenciaHtml(f);
  assert.match(html, /Anterior<\/button><span class="vbc-fila-conta" aria-live="polite">2 de 3<\/span><button[^>]*>Próxima/);
  assert.doesNotMatch(html, /disabled/);
  assert.match(c.filaDaConferenciaHtml({ ...f, indice: 0 }), /onclick="passarPecaDaConferencia\(-1\)"[^>]* disabled/);
  // fora da fila de aprovação: as do mesmo status no quadro, pela data do cliente
  const quadro = [peca('20', { veiculacao_iso: '2026-12-05' }), peca('21', { status: 'Em andamento' }), peca('22', { veiculacao_iso: '2026-12-02' }), peca('23', { veiculacao_iso: '2026-12-03' })];
  const q = c.filaDaConferenciaDe({ item: peca('23', { veiculacao_iso: '2026-12-03' }), option: op, aprovar, quadro, opcoesDe: opcoes });
  assert.equal(q.origem, 'quadro');
  igual(q.pecas.map((x) => x.item.id), ['22', '23', '20']);
  assert.equal(q.indice, 1);
  // sem fila clara: peça sozinha no status, ou fora do quadro e da fila
  assert.equal(c.filaDaConferenciaDe({ item: peca('30'), option: op, aprovar: [], quadro: [peca('30')], opcoesDe: opcoes }), null);
  assert.equal(c.filaDaConferenciaDe({ item: peca('31'), option: op, aprovar, quadro, opcoesDe: opcoes }), null);
  assert.equal(c.filaDaConferenciaDe({ item: peca('11'), option: null, aprovar, quadro, opcoesDe: opcoes }), null);
  assert.equal(c.filaDaConferenciaHtml(null), '');
});

test('a janela: a fila nas três conferências, "Conferir a próxima" só depois de a troca dar certo, teclas e o que o portão grava', () => {
  for (const porta of ['qualidade', 'material', 'visual']) assert.match(portoes, new RegExp(`ligarFilaDaConferencia\\(item, option, '${porta}'\\)`));
  // a vizinha é guardada antes de fechar (a troca tira esta da fila) e só é oferecida com a troca confirmada
  assert.equal((portoes.match(/const seguinte ?= ?proximaDaConferencia\(\);/g) || []).length, 3);
  assert.equal((portoes.match(/oferecerProximaConferencia\(seguinte, await commitStatusChange\(item, ?option\)\)/g) || []).length, 3);
  assert.match(status, /\n  return confirmado;\r?\n\}/, 'commitStatusChange diz se a troca entrou');
  const ofertar = trecho(portoes, 'function oferecerProximaConferencia', 'abrirJanelaV2(');
  assert.match(ofertar, /if \(!ok \|\| !seguinte\) return;/);
  assert.match(ofertar, /normalizedWorkflowStatus\(agora\?\.status\) !== normalizedWorkflowStatus\(seguinte\.status\)/, 'só se a vizinha ainda está no status de origem');
  // trocar de peça reabre a janela do zero (os checks não passam) com a mesma conferência
  const passar = trecho(portoes, 'function passarPecaDaConferencia', '// A que vem depois');
  assert.match(passar, /closeWorkflowModal\(\);\s*abrirConferenciaDaFila\(alvo\.item, alvo\.option, f\.porta\)/);
  const tecla = trecho(portoes, 'function teclaDaConferencia', "if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', teclaDaConferencia");
  assert.match(tecla, /e\.key === 'PageDown' \|\| \(e\.shiftKey && e\.key === 'ArrowRight'\)/);
  assert.match(tecla, /e\.key === 'PageUp' \|\| \(e\.shiftKey && e\.key === 'ArrowLeft'\)/);
  assert.match(tecla, /tag === 'TEXTAREA'/, 'escrevendo, as setas são do texto');
  assert.match(tecla, /tag === 'VIDEO'/, 'no vídeo, as setas são do tempo');
  // o que o checklist registra, a regra de liberar o botão e quem muda o status não mudaram
  assert.match(portoes, /`\[Vybe OS · Checklist de qualidade\]\\nDestino: \$\{flow\.option\.label\}\\nFormato: \$\{flow\.item\.formato \|\| flow\.item\.tipo \|\| 'Conteúdo'\}\\nValidado: \$\{checks\.join\(' \| '\)\}`/);
  assert.match(portoes, /button\.disabled=\[\.\.\.form\.querySelectorAll\('input\[type=checkbox\]'\)\]\.some\(input => !input\.checked\);/);
  assert.match(ler('vybe-mundo-conteudo.js'), /itemDaFila: itemDoPainel, decisaoDaFila, filaParaAprovar,/);
});

test('CSS da navegação: fragmento próprio, só tokens, sem !important, sem :has, sem html body.mundo; botões de 34', () => {
  const css = ler('padrao-v2/s-z.css').replace(/\/\*[^]*?\*\//g, '');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /html\s+body\.mundo/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b(?![-\w])/i, 'cor só por token');
  assert.doesNotMatch(css, /(?:rgba?|hsla?)\(/, 'cor só por token');
  assert.match(css, /\.vbc-fila-btn\{height:34px;min-height:34px;[^}]*border-radius:var\(--d3-r-botao\)/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('/* ===== padrao-v2/s-z.css ===== */'), 'juntado no padrao-v2');
});
