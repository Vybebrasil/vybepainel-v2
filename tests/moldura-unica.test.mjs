// Moldura única (Paulo, 10/11/2026: "os painéis antigos como o Painel de trabalho parece que abrem de outro lugar… não
// parece que tá integrado"): toda tela antiga aberta pelo dock (body.mundo-modulo) abre na mesma caixa, no mesmo
// material e com a mesma entrada das janelas novas (Comercial, Pessoas, Carteira, Gestão/visão do setor).
// SAFE: só lê o CSS e o JS; nada de rede, banco ou envio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const css = ler('vybe-mundo.css'), js = ler('vybe-mundo.js');
// --vv-pe-barra: no celular, com a barra de baixo à vista, toda janela termina acima dela (terceira rodada, 11/11/2026)
const FUNDO_JANELA = 'calc(var(--vv-m) + var(--vv-dock-alto, -6px) + 6px + var(--vv-pe-barra,0px))';

test('a tela antiga ocupa a mesma caixa das janelas novas: topo da janela, ao lado do dock e acima do dock das salas', () => {
  // janelas novas: acima do dock das salas pela mesma conta (m + dock + 6)
  assert.ok(css.includes(':is(.vv-gestao,.vc-camada,.vp-camada,.vv-missoes-camada,#vv-agentes,#vv-ferramentas,#vv-carteira,#vv-rel,.vv-plj,.vv-wa,#vv-comercial,#vv-pessoas,#vv-conteudo,#vv-impressoes){bottom:calc(var(--vv-m,14px) + var(--vv-dock-alto,74px) + 6px + var(--vv-pe-barra,0px))!important}'));
  assert.ok(css.includes('body.mundo.com-dock-salas.dock-cartao:not(.cel-voz-aberta){--vv-pe-barra:calc(58px + var(--vv-m,8px))}'), 'a folga é a barra de baixo mais as margens');
  // a área que rola e a moldura das telas antigas terminam no mesmo ponto
  assert.ok(css.includes(`html body.mundo.mundo-modulo{position:fixed!important;top:var(--vv-m)!important;bottom:${FUNDO_JANELA}!important;`));
  assert.ok(css.includes(`#mundo-moldura{display:none;position:fixed;z-index:-1;top:var(--vv-m);bottom:${FUNDO_JANELA};`));
  assert.ok(css.includes(`html body.mundo.mundo-modulo{top:0!important;left:0!important;right:0!important;bottom:${FUNDO_JANELA}!important;border-radius:0;`), 'celular igual às janelas novas');
  // nada empurra a tela antiga (ou a Gestão) para baixo da barra do mundo, que nem aparece
  assert.ok(!css.includes('html body.mundo.mundo-modulo:not(.mundo-tela-cheia){top:calc(var(--vv-m) + 62px)!important}'));
  assert.ok(!css.includes('html body.mundo .vv-gestao{top:calc(var(--vv-m) + 62px)!important}'));
  assert.ok(!css.includes('padding-top:56px!important'));
});

test('o topo do mundo some como nas janelas novas; tela cheia e fechar ficam dentro da janela', () => {
  assert.ok(css.includes('body.mundo.mundo-modulo #mundo-hud > :not(.vv-trilho){display:none!important}'));
  assert.ok(!css.includes('#mundo-hud > .vv-topo{display:flex!important}'), 'nenhuma regra traz a barra do mundo de volta');
  assert.ok(css.includes('.vv-canto-modulo{display:none;position:fixed;top:calc(var(--vv-m) + 17px);right:calc(var(--vv-m) + 17px);'), 'no canto da janela, a 17 px, como o X das janelas novas');
  assert.ok(!/vv-canto-modulo\{right:calc\(var\(--vv-m\) \* 2 \+ var\(--vv-col\)\)/.test(css), 'não fica mais ao lado da barra do mundo');
  // o cabeçalho da tela antiga termina antes do ⛶ e do X (o vão flutuante nunca valeu: o body:before antigo é fixo)
  assert.ok(!css.includes('body.mundo.mundo-modulo::before{content:"";float:right'));
  assert.ok(css.includes('body.mundo.mundo-modulo :is(.workspace-heading,.client-module-hero,.prod-v2-head,.conta-secao-topo,.pv-cabeca,.container > .vb-cabecalho){margin-right:var(--vv-caixa-vao);max-width:calc(100% - var(--vv-caixa-vao))}'));
  // com a gaveta da demanda aberta só o X dela aparece
  assert.ok(css.includes('body.mundo:has(> #workspace-drawer) .vv-canto-modulo{display:none}'));
  // os dois botões e os atalhos continuam (F alterna, Esc fecha)
  assert.ok(js.includes('data-modulo-acao="cheia"') && js.includes('data-modulo-acao="fechar"'));
  assert.ok(js.includes("if (body.classList.contains('mundo-modulo')) { fecharModulo(); return; }"));
});

test('mesmo material e mesma entrada: sombra de janela e a mola do padrão, sem outra curva', () => {
  const material = css.slice(css.indexOf('/* Material das janelas'));
  assert.match(material, /:is\([^)]*\.vv-gestao,#mundo-moldura\)\{\n  box-shadow:var\(--vv-sombra-janela\)/);
  assert.match(css, /#vv-whatsapp,#mundo-moldura\):not\(\[hidden\]\)\{\n    animation:vv-janela var\(--vv-t-janela\) var\(--vv-mola\) both\}/);
  assert.ok(css.includes('html body.mundo.mundo-modulo .container{animation:vv-janela var(--vv-t-janela) var(--vv-mola) both}'));
  assert.ok(!css.includes('.container>*:not(script):not(style){animation:vv-entra'));
  assert.ok(css.includes('body.mundo.mundo-modulo #mundo-moldura{background:#F3F1EC;'), 'papel sólido, como o Comercial');
});
