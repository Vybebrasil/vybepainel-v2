// Pente-fino de 09/11/2026 (quadro 14 do moodboard do redesign): o que estava quebrado além do visual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync('vybe-mundo.js', 'utf8'), css = readFileSync('vybe-mundo.css', 'utf8'), legado = readFileSync('vybe-styles.css', 'utf8');

test('Esc fecha o balão do painel antigo, não a tela de trás; trocar de tela fecha os balões', () => {
  assert.match(js, /const SEL_BALOES = '\.status-editor, \.status-editor-backdrop';/);
  assert.match(js, /if \(campo\) \{ campo\.blur\(\); return; \}\r?\n\s*if \(fecharBaloesAntigos\(\)\) \{ janelaNoEsc = null; return; \}/);
  assert.match(js, /function limparTela\(\) \{\r?\n\s*fecharBaloesAntigos\(\);/);
  for (const f of ['closeStatusEditor', 'fecharSeletorDeDono', 'fecharEscolha', 'fecharMenuDoGrupo', 'fecharMenuDeLote']) assert.ok(js.includes(`'${f}'`), f);
});

test('o dock acende o item certo (Conversas, Equipe, Aprovação de conteúdo, visão geral, Minhas tarefas)', () => {
  assert.match(js, /if \(!document\.getElementById\('vv-whatsapp'\)\?\.hidden && document\.getElementById\('vv-whatsapp'\)\?\.isConnected\) return;\r?\n\s*if \(placa\(\) && !placa\(\)\.hidden\) return;/);
  assert.match(js, /criacaoPeloDock && visaoHoje === 'criacao' && !body\.classList\.contains\('mundo-modulo'\) \? 'direcao' : 'hoje'/);
  assert.match(js, /if \(modulo && !window\.VybeSetor\?\.aberto\?\.\(\)\) marcarTrilhoDoModulo\(\);/);
  // Minhas tarefas abre o Hoje na aba Minhas tarefas e acende o item dele (quadro 31, 10/11/2026).
  assert.match(js, /if \(id === 'tarefas'\) \{ visaoHoje = 'tarefas';/);
  assert.match(js, /usarTrilho\.tarefas \? 'tarefas' : 'hoje'/);
  assert.match(readFileSync('vybe-mundo-conteudo.js', 'utf8'), /aberto: \(\) => st\.aberto/);
  assert.match(js, /window\.dispatchEvent\?\.\(new CustomEvent\('vybe:trocar-tela'\)\);/, 'trocar de tela avisa');
  assert.match(readFileSync('vybe-mundo-whatsapp.js', 'utf8'), /addEventListener\?\.\('vybe:trocar-tela', \(\) => \{ if \(st\.aberto\) fechar\(\); \}\)/, 'e as Conversas fecham');
});

test('Finanças sem frase quebrada nem recado de documentação; prévia sem dizer "entregue"', () => {
  const c = readFileSync('vybe-mundo-comercial.js', 'utf8');
  // Quadros 20 e 56 (10/11/2026): nada de passo a passo para a equipe; o motivo fica em "Ver o que falta" (quem administra).
  assert.doesNotMatch(c, /O passo a passo está na aba/);
  assert.match(c, /if \(!completo\) return ativacao\('', '', tecnico\);/);
  assert.doesNotMatch(c, /docs\/vybe-financas\.md\.<\/p>/);
  const m = readFileSync('vybe-material.js', 'utf8');
  assert.doesNotMatch(m, /A peça está marcada como entregue/);
  assert.match(m, /titulo: 'Ainda sem material'/);
});

test('janelas de módulo com as cores claras, acima do dock; lote claro; planejamento legível', () => {
  assert.match(css, /body\.mundo :is\(#vv-impressoes,#vv-comercial,#vv-carteira,#vv-pessoas,#vv-conteudo,#vv-ferramentas,#vv-agentes\)\{\s*--surface:#FFFFFF;[^}]*--text:#1F1D1A/);
  assert.match(css, /\.vv-wa,#vv-comercial,#vv-pessoas,#vv-conteudo,#vv-impressoes\)\{bottom:calc/);
  assert.match(css, /html body\.mundo:is\(\.palco-modulo,\.mundo-modulo,\.mundo-gestao\) #vv-wa-avisos\{top:calc\(var\(--vv-m,14px\) \+ 136px\)\}/);
  assert.ok(legado.includes(':where(body:not(.mundo)) .grupos-lote{bottom:24px!important;'), 'a barra escura do lote só no tema antigo');
  assert.match(css, /html body\.mundo \.grupos-lote\{bottom:calc\(var\(--vv-m,14px\) \+ var\(--vv-dock-alto,0px\) \+ 24px\);background:rgba\(255,255,255,\.96\)/);
  assert.match(css, /html body\.mundo \.plj-ed-cab h3\{color:#1F1D1A\}/);
  assert.match(css, /html body\.mundo \.plj-ed-lista\{background:#F6F3EE;/);
  assert.match(css, /html body\.mundo \.plj-flut\{background:rgba\(255,255,255,\.96\)/);
  const novo = css.slice(css.indexOf('Pente-fino de 09/11/2026 (quadro 14'));
  assert.doesNotMatch(novo, /!important/, 'o bloco novo não usa !important');
});
