// Correções do confere de diretor de arte, frente da-1 (casca e moldura), 19/11/2026: janela escondida some de verdade,
// vigia do aviso curto que não refaz a conta à toa, dock com rótulo de 12 e voz de 34, Criar neutro no celular, página
// que não rola de lado, controles do mapa dentro do cartão e o portão "só donos" nos três temas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (f) => readFileSync(new URL(f, raiz), 'utf8');
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const css = semComentario(ler('padrao-v2/da-casca.css'));
const junto = ler('vybe-mundo-padrao-v2.css');
const core = ler('vybe-core.js');

test('a junção traz o fragmento da casca', () => {
  assert.match(junto, /\/\* ===== padrao-v2\/da-casca\.css ===== \*\//);
});

test('janela da casca com hidden some, mesmo com o display:flex do padrão V2 (Visão geral, Comercial, Agentes)', () => {
  const regra = css.match(/:is\(([^{]+)\)\{display:none\}/);
  assert.ok(regra, 'regra da família de janelas escondidas');
  for (const parte of ['body.mundo > [hidden]', '.vv-gestao.vv-setor-visao.vst-casa.vst-casa[hidden]', 'body.mundo #vv-comercial.vc.d3m-d-m[hidden]', 'body.mundo #vv-agentes.vv-ag.d3m-d-m[hidden]'])
    assert.ok(regra[1].includes(parte), parte);
  // As regras que pedem display:flex continuam onde estão (a correção não mexe nelas): a de [hidden] precisa vencê-las.
  assert.match(junto, /\.vv-gestao\.vv-setor-visao\.vst-casa\.vst-casa\{display:flex/);
  assert.match(junto, /body\.mundo #vv-comercial\.vc\.d3m-d-m\{display:flex/);
});

test('dock: rótulo de 12 e o botão da voz com 34 de altura', () => {
  assert.match(css, /#vv-dock-salas-faixa \.vq-dock \.vq-item \.vq-rotulo\.vq-rotulo\{font-size:var\(--d3-fs-apoio\)\}/);
  assert.match(css, /#vv-dock-salas-faixa \.vq-dock\.vv-dock-salas \.vq-voz button\{height:34px;/);
  assert.match(ler('padrao-v2/0-d3-base.css'), /--d3-fs-apoio:12px/);
});

test('celular: o Criar não é laranja (um laranja por tela) e a página não rola de lado', () => {
  const cel = css.slice(css.indexOf('@media (max-width:900px)'));
  assert.match(cel, /\.vv-trilho-btn\.criar\.criar\{background:var\(--d3-fume-texto\);color:var\(--d3-fume-contra\)/);
  assert.doesNotMatch(cel, /\.criar[^{]*\{[^}]*--d3-acao/);
  assert.match(cel, /body\.mundo > \.container\{max-width:100%;overflow-x:clip\}/);
});

test('controles do mapa cabem no cartão do 3D', () => {
  assert.match(css, /\.vv-controles\.vv-ilha\.vv-ilha\{box-sizing:border-box;max-width:calc\(var\(--d3c-mw,100vw\) - 24px\);flex-wrap:wrap/);
  assert.match(ler('vybe-mundo.js'), /set\('--d3c-mw', r\.width\)/);
  assert.match(css, /@media \(max-width:1180px\)\{\s*body\.mundo\.mundo-centro\.d3c-painel[^{]*\.vv-controles\.vv-ilha\.vv-ilha\{bottom:calc\(var\(--d3c-cb,100px\) \+ 42px\)\}/);
});

test('canto do módulo não cobre os botões: Tela cheia some no tablet e o topo da Produção guarda o vão até 1180', () => {
  assert.match(css, /@media \(min-width:601px\) and \(max-width:900px\)\{\s*\.vv-canto-modulo \.vv-botao\[data-modulo-acao="cheia"\][^{]*\{display:none\}/);
  assert.match(css, /@media \(min-width:901px\) and \(max-width:1180px\)\{[^}]*#pv2-painel,#pv2-demandas\) > \.d3m-topo[^{]*\{padding-right:104px\}/);
});

test('celular dentro da sala: a barra de módulos sai e o dock fica sozinho', () => {
  assert.match(css, /@media \(max-width:600px\)\{\s*body\.mundo\.cel-na-sala #mundo-hud > \.vv-ilha\.vv-trilho\{display:none\}/);
});

test('portão "só donos": vidro do tema, letra do vidro e anel neutro (sem cor escrita)', () => {
  const r = css.match(/body\.mundo #workflow-modal\.vb-sem-acesso-janela\{([^}]+)\}/);
  assert.ok(r);
  for (const v of ['--wm-fundo:var(--d3-fume-forte)', '--wm-cor:var(--d3-fume-texto)', '--d3-tinta:var(--d3-fume-texto)', '--d3-trilho:var(--d3-fume-veu-forte)', '--ds-foco:']) assert.ok(r[1].includes(v), v);
  assert.doesNotMatch(r[1], /#[0-9A-Fa-f]{3,6}\b/);
});

test('fragmento da casca segue a guarda: sem !important, sem html body.mundo, sem :has com [style]', () => {
  assert.doesNotMatch(css, /!\s*important/);
  assert.doesNotMatch(css, /html\s+body\.mundo/);
  assert.doesNotMatch(css, /:has\([^)]*\[style/);
});

// O vigia do aviso curto: monta as duas funções com um document de mentira e conta quantas vezes a conta inteira roda.
function montarVigia() {
  const ini = core.indexOf('let AVISO_CURTO_MARCA');
  const fim = core.indexOf('if (typeof document !== \'undefined\' && typeof document.addEventListener === \'function\') {\r\n  const gesto');
  const fimLf = fim >= 0 ? fim : core.indexOf("if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {\n  const gesto");
  assert.ok(ini > 0 && fimLf > ini, 'trecho do vigia');
  const trecho = core.slice(ini, fimLf);
  const estado = { voltas: 0, controles: 5, classe: 'mundo', filhos: [{ hidden: false }] };
  const caixa = { get children() { return estado.filhos; }, className: 'pilula', getAttribute: () => 'right: 10px;' };
  const document = { getElementById: () => caixa, get body() { return { className: estado.classe }; }, querySelectorAll: () => ({ length: estado.controles }) };
  const window = { innerWidth: 1440, innerHeight: 900 };
  const fabrica = new Function('document', 'window', 'ajustarAvisosCurtos', 'AVISO_CURTO_CONTROLES', 'agora',
    `const Date = { now: () => agora.t };\n${trecho}\nreturn { vigiar: vigiarAvisosCurtos, gesto: (t) => { AVISO_CURTO_GESTO = t; } };`);
  const agora = { t: 100000 };
  const v = fabrica(document, window, () => { estado.voltas++; }, 'button', agora);
  return { v, estado, agora };
}

test('vigia do aviso curto: só refaz a conta quando a tela muda ou houve gesto (a 2ª abertura não pesa)', () => {
  const { v, estado, agora } = montarVigia();
  v.vigiar(); assert.equal(estado.voltas, 1, 'a primeira volta sempre mede');
  v.vigiar(); v.vigiar(); assert.equal(estado.voltas, 1, 'nada mudou: não mede de novo');
  estado.classe = 'mundo mundo-modulo'; v.vigiar(); assert.equal(estado.voltas, 2, 'troca de tela mede');
  v.vigiar(); assert.equal(estado.voltas, 2);
  estado.controles = 9; v.vigiar(); assert.equal(estado.voltas, 3, 'controles novos na página medem');
  v.gesto(agora.t - 500); v.vigiar(); assert.equal(estado.voltas, 4, 'gesto recente mede');
  agora.t += 5000; v.vigiar(); assert.equal(estado.voltas, 4, 'gesto antigo não mede mais');
  estado.filhos = []; v.vigiar(); assert.equal(estado.voltas, 5, 'sem aviso, a conta roda (e desliga o vigia)');
});

test('vigia do aviso curto: o relógio chama o vigia; aviso novo e aviso que sai continuam medindo na hora', () => {
  assert.match(core, /AVISO_CURTO_VIGIA = setInterval\(vigiarAvisosCurtos, 500\)/);
  assert.doesNotMatch(core, /setInterval\(ajustarAvisosCurtos/);
  assert.match(core, /contar\(\);\r?\n  ajustarAvisosCurtos\(\);/);
  assert.match(core, /document\.addEventListener\('scroll', gesto, \{ capture: true, passive: true \}\);/);
});
