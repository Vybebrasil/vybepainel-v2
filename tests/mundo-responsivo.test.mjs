// Responsividade geral (Paulo, 09/11/2026: "muita coisa bugada ainda, faz um teste geral de responsividade pra PC e celular")
// e o app Agenda Vybe (/agenda) abrindo direto na agenda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css'), estilos = ler('vybe-styles.css');

test('números do Hoje pela largura do próprio painel (na Minha sala o Hoje é estreito)', () => {
  assert.ok(css.includes('#vv-hoje{container-type:inline-size;container-name:hoje}'));
  assert.ok(css.includes('@container hoje (max-width:520px){html body #vv-hoje .vs-kpis.vs-kpis{--vs-cols:2}'));
});

test('nada por baixo do dock: o Hoje e as janelas dos módulos terminam acima dele; no celular o dock rola por dentro', () => {
  assert.ok(css.includes('html body.mundo.com-dock-salas:not(.mundo-quarto):not(.mundo-modulo) #vv-hoje.vv-hoje{bottom:calc(var(--vv-m,14px) + var(--vv-dock-alto,74px) + 6px + var(--vv-pe-barra,0px))!important}'));
  assert.ok(css.includes('html body.mundo.com-dock-salas :is(.vv-gestao,.vc-camada,.vp-camada,.vv-missoes-camada,#vv-agentes,#vv-ferramentas,#vv-carteira,#vv-rel,.vv-plj,.vv-wa,#vv-comercial,#vv-pessoas,#vv-conteudo,#vv-impressoes){bottom:'));
  assert.ok(css.includes('.vv-dock-salas-faixa > .vq-dock{overflow-x:auto;'));
  assert.ok(css.includes('@media (max-width:560px){html body.mundo:not(.mundo-centro) .vv-barra-topo .vv-ferr-nome{display:none}}'), 'topo só com ícones no celular');
});

test('agenda no celular: a barra quebra linha em qualquer visão (o aviso não empurra a tela de lado)', () => {
  assert.ok(estilos.includes('.capt-cal .capt-toolbar,.capt-cal .capt-tb-esq,.capt-cal .capt-tb-dir{flex-wrap:wrap;min-width:0}'));
  assert.ok(!estilos.includes('.capt-cal.vista-mes .capt-tb-dir{flex-wrap:nowrap'), 'sem a trava que empurrava a página');
});

test('/agenda (o app do Mizinho) abre direto na Agenda e captações, sem o Hoje nem o passeio; o / não muda', () => {
  assert.ok(js.includes(String.raw`const APP_AGENDA = typeof location !== 'undefined' && /^\/agenda\/?$/.test(location.pathname);`));
  assert.ok(js.includes("if (APP_AGENDA && !sincronizar.agenda) { sincronizar.agenda = true; sincronizar.tour = true; setTimeout(() => usarTrilho('agenda'), 300); }"));
});

test('varredura geral (Paulo, 09/11/2026: "todos os menus, botões, submenus"): o que ela achou ficou corrigido', () => {
  const padrao = ler('vybe-padrao.css');
  assert.match(css, /@container hoje \(max-width:620px\)\{\s*#vv-hoje \.vv-sem-col\{[^}]*\}[\s\S]*?#vv-hoje \.vv-sem-barras i:not\(\.total\)\{display:none\}/,'gráfico da semana no Hoje estreito: só o total por dia, números sem se cruzar');
  // Desde 09/11/2026 (Paulo: "fora do padrão visual") os avisos do WhatsApp ficam no canto de cima, longe do dock.
  assert.doesNotMatch(css, /#vv-wa-avisos\{[^}]*(bottom|left):/, 'avisos do WhatsApp sem a posição de baixo/esquerda');
  assert.match(ler('vybe-mundo-whatsapp.css'), /#vv-wa-avisos\{position:fixed;[^}]*top:calc\(var\(--vv-m,14px\) \+ 64px\);right:var\(--vv-m,14px\)/, 'no canto de cima à direita');
  assert.ok(css.includes('html body.mundo .vv-barra-topo .vv-botao:has(.vv-ferr-nome) .vv-badge{position:static;order:3;'), 'selo depois do nome, sem cobrir o texto');
  assert.ok(padrao.includes('.resumo{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));'), 'números do Painel de trabalho quebram linha em vez de espremer');
  assert.ok(padrao.includes('gap:4px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;'), 'abas do Painel de trabalho rolam dentro da janela');
});
