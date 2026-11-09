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
  assert.ok(css.includes('html body.mundo.com-dock-salas:not(.mundo-quarto):not(.mundo-modulo) #vv-hoje.vv-hoje{bottom:calc(var(--vv-m,14px) + var(--vv-dock-alto,74px) + 6px)!important}'));
  assert.ok(css.includes('html body.mundo.com-dock-salas :is(.vv-gestao,.vc-camada,.vp-camada,.vv-missoes-camada,#vv-agentes,#vv-ferramentas,#vv-carteira,#vv-rel,.vv-plj,.vv-wa){bottom:'));
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
