// Redesign, frente "sistema" (quadros 00, 29 e 30 do moodboard, 10/11/2026): as peças que valem para o sistema
// inteiro. O seletor do padrão no lugar do <select> nativo no mundo, o texto clicável como botão discreto, o foco
// laranja só do teclado, o rodapé técnico fora do mundo e o zero discreto do vbResumoHtml.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// Carrega vybe-seletor.js com o mínimo do navegador e guarda os ouvintes que ele registra.
function carregarSeletor({ mundo = true } = {}) {
  const ouvintes = [];
  const body = { classList: { contains: (c) => c === 'mundo' && mundo } };
  const ctx = {
    console, Date, Math, String, Number,
    window: { addEventListener: (tipo, fn, op) => ouvintes.push({ tipo, op }) },
    document: { body, readyState: 'complete', addEventListener() {} },
    Node: function Node() {},
  };
  vm.createContext(ctx);
  vm.runInContext(ler('vybe-seletor.js') + '\n;this.__s = { seletorElegivel, seletorOpcoes, seletorNormaliza, seletorNome };', ctx);
  return { ...ctx.__s, ouvintes };
}

function campo({ multiple = false, size = 0, disabled = false, nativo = false, opcoes = [] } = {}) {
  const grupo = { tagName: 'OPTGROUP', label: 'Grupo A', disabled: false };
  return {
    tagName: 'SELECT', multiple, size, disabled,
    closest: (s) => (s === '[data-nativo]' && nativo ? {} : null),
    getAttribute: (n) => (n === 'aria-label' ? 'Ordem' : null),
    options: opcoes.map(([texto, extra = {}]) => ({ textContent: texto, label: '', disabled: !!extra.desligada, hidden: !!extra.escondida,
      parentElement: extra.grupo ? grupo : { tagName: 'SELECT' } })),
  };
}

test('seletor: só <select> simples, ligado e no mundo ganha o menu do padrão', () => {
  const s = carregarSeletor();
  assert.equal(s.seletorElegivel(campo()), true);
  assert.equal(s.seletorElegivel(campo({ multiple: true })), false);
  assert.equal(s.seletorElegivel(campo({ size: 5 })), false);
  assert.equal(s.seletorElegivel(campo({ disabled: true })), false);
  assert.equal(s.seletorElegivel(campo({ nativo: true })), false);
  assert.equal(s.seletorElegivel({ tagName: 'INPUT', closest: () => null }), false);
  const fora = carregarSeletor({ mundo: false });
  assert.equal(fora.seletorElegivel(campo()), false, 'fora do mundo fica o do navegador');
});

test('seletor: as opções vêm do <select> na hora (grupo, desligada e escondida)', () => {
  const s = carregarSeletor();
  const ops = s.seletorOpcoes(campo({ opcoes: [['Em destaque'], ['Mais caros', { grupo: true }], ['Antiga', { escondida: true }], ['Esgotado', { desligada: true }]] }));
  assert.deepEqual(JSON.parse(JSON.stringify(ops.map((o) => [o.i, o.texto, o.grupo, o.desligada]))), [[0, 'Em destaque', '', false], [1, 'Mais caros', 'Grupo A', false], [3, 'Esgotado', '', true]]);
  assert.equal(s.seletorNormaliza('  Março '), 'marco', 'busca sem acento');
  assert.equal(s.seletorNome(campo()), 'Ordem');
});

test('seletor: ouve na captura da janela (o Esc do menu chega antes do Esc das janelas)', () => {
  const { ouvintes } = carregarSeletor();
  for (const tipo of ['mousedown', 'keydown', 'click', 'touchend', 'scroll']) {
    const o = ouvintes.find((x) => x.tipo === tipo);
    assert.ok(o, `ouve ${tipo}`);
    assert.ok(o.op === true || o.op?.capture === true, `${tipo} na captura`);
  }
  const src = ler('vybe-seletor.js');
  assert.match(src, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(src, /dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.match(src, /new MutationObserver/);
  assert.match(src, /SELETOR_BUSCA_A_PARTIR = 9/, 'busca a partir de 9 opções (mais de 8)');
  assert.match(src, /closest\('dialog\[open\]'\)/, 'dentro de dialog modal o menu nasce no dialog (fora dele fica inerte)');
});

test('seletor: carrega sempre, antes dos módulos do mundo e depois do calendário', () => {
  const html = ler('index.html');
  const i = html.indexOf('<script src="/vybe-seletor.js"></script>');
  assert.ok(i > 0, 'vybe-seletor.js no index.html, sem sob-demanda');
  assert.ok(i > html.indexOf('/vybe-calendario.js'));
  for (const f of ['/vybe-mundo.js', '/vybe-mundo-pessoas.js', '/vybe-mundo-ferramentas.js', '/vybe-mundo-carteira.js', '/vybe-mundo-impressoes.js']) {
    assert.ok(i < html.indexOf(f), `antes de ${f} (que ouvem o Esc na captura da janela)`);
  }
});

test('peças: rodapé técnico fora do mundo, texto clicável como botão, foco sem anel do navegador, sem !important novo', () => {
  const css = ler('vybe-mundo.css');
  const bloco = css.slice(css.indexOf('PEÇAS COMPARTILHADAS DO SISTEMA, parte 2'));
  assert.ok(bloco.length > 100);
  assert.doesNotMatch(bloco, /!important/, 'o bloco novo não força nada');
  assert.doesNotMatch(bloco, /html body\.mundo/);
  assert.match(bloco, /body\.mundo > footer\{display:none\}/);
  assert.match(bloco, /button\.vb-link,a\.vb-link:not\(p a\),\.resumo-limpar,\.capt-trocar > summary/);
  assert.match(bloco, /:is\(dialog,\[tabindex="-1"\],\[role="dialog"\]/);
  assert.match(bloco, /\.vb-seletor-menu\{/);
  // os remendos que só pintavam o rodapé e o vb-link saíram
  assert.doesNotMatch(css, /mundo-modulo footer/);
  assert.doesNotMatch(css, /html body\.mundo\.mundo-modulo \.vb-link\{/);
  const total = (css.match(/!important/g) || []).length;
  assert.ok(total <= 3933, `!important em vybe-mundo.css não sobe (${total}; eram 3.942 antes desta frente)`);
});

test('vbResumoHtml: zero vira texto discreto, sem a cor de estado', () => {
  // O corte da função vale em qualquer fim de linha (checkout do Windows traz CRLF): fecha no primeiro "}" sozinho na linha.
  const src = ler('vybe-core.js');
  const ini = src.indexOf('function vbResumoHtml');
  const fecho = /\r?\n\}\r?\n/.exec(src.slice(ini));
  assert.ok(ini >= 0 && fecho, 'vbResumoHtml não foi achada no vybe-core.js');
  const fim = ini + fecho.index + fecho[0].length;
  const ctx = { safeText: (v) => String(v ?? '') };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fim) + ';this.f = vbResumoHtml;', ctx);
  const html = ctx.f([{ valor: 0, rotulo: ' atrasadas', tom: 'alerta' }, { valor: 3, rotulo: ' atrasadas', tom: 'alerta' }]);
  assert.match(html, /class="vb-resumo-item zero"><b>0<\/b>/);
  assert.match(html, /class="vb-resumo-item alerta"><b>3<\/b>/);
});

// ----- Segunda rodada (acabamento, 10/11/2026): regras gerais dos quadros 00 Main, 00 Sistema, 29, 30 e 32 -----
test('um cabeçalho de janela: vbCabecalhoHtml com o X único, sem rótulo de setor', () => {
  const core = ler('vybe-core.js');
  assert.match(core, /function vbCabecalhoHtml\(\{ titulo, texto = '', acoes = '', id = '' \}\)/);
  assert.match(core, /function vbFecharHtml\(attr = '', classe = ''\)/);
  for (const [arq, topo] of [['vybe-mundo-pessoas.js', 'vp-topo'], ['vybe-mundo-impressoes.js', 'vi-topo'], ['vybe-mundo-ferramentas.js', 'vf-topo'], ['vybe-mundo-agentes.js', 'vga-topo'], ['vybe-mundo-planejamentos.js', 'vv-plj-cabeca']]) {
    const src = ler(arq);
    assert.ok(src.includes(`class="${topo} vb-janela-topo">\${cabecalho({`), `${arq}: o topo usa o cabeçalho único`);
    assert.match(src, /botaoX\('data-/, `${arq}: o X é o do padrão`);
  }
  assert.doesNotMatch(ler('vybe-mundo-pessoas.js'), /class="vp-kicker">\$\{esc\(estado\.rotulo/);
  assert.doesNotMatch(ler('vybe-mundo-planejamentos.js'), /vv-plj-kicker/);
  const css = ler('vybe-mundo.css');
  // Um tamanho de título e a mesma caixa para o X e o ⛶ das telas antigas; o 28 px ficou no painel antigo.
  assert.match(css, /\.vv-canto-modulo \.vv-botao\{[^}]*background:#FFFFFF!important;border:1px solid #E6E0D6!important/);
  assert.match(css, /body\.mundo :is\(\.pv-cabeca \.pv-etiqueta,\.vv-g-topo \.vv-cb-kicker,#vv-carteira \.vc-topo \.vc-kicker\)\{display:none\}/);
  assert.match(ler('vybe-padrao.css'), /:where\(body:not\(\.mundo\)\) \.pv-cabeca h2\{/);
});

test('zeros em linha discreta, plural certo, mês no seletor e agenda no Hoje da Cidade', () => {
  const mundo = ler('vybe-mundo.js'), pessoas = ler('vybe-mundo-pessoas.js');
  assert.match(mundo, /function radarHtml\(V, itens\)/);
  // Padrão v2 (12/11/2026): a Agência abre com três números (o zerado fica no lugar, apagado) e a linha Também de olho.
  assert.match(mundo, /function tresNumerosHtml\(itens\)/);
  assert.match(mundo, /titulo: 'Atrasadas', valor: n0\(H\.atrasadas\), sub: .{0,90}quieto: !H\.atrasadas, attrs: 'data-espiar="atrasadas"'/);
  assert.match(mundo, /Também de olho:/);
  assert.match(mundo, /'peças em aberto', 'peça em aberto'\]/);
  assert.match(ler('vybe-mundo-agentes.js'), /x\.n === 1 \? 'Ver o achado' : `Ver os \$\{x\.n\}`/);
  assert.match(mundo, /<section class="v2a-cartao v2a-agenda">\$\{agendaDeHojeHtml\(\)\}/);
  assert.match(mundo, /class="v2t-btn" data-abrir-gestao="semana">Abrir a semana<\/button>/);
  assert.match(pessoas, /mesHtml\(ref, 'data-vp-ref-ir', estado\.periodo === 'anual'\)/);
  assert.match(pessoas, /kpisHtml\(\[\['Vagas abertas', ind\.abertas\]/);
  // O anel da dica e o foco: laranja do padrão; o contorno grosso da aparência antiga não vale no mundo.
  assert.doesNotMatch(ler('vybe-mundo-tutorial.css'), /139,125,255,\.(9|18|22)\)|0 0 0 2px #8B7DFF/);
  assert.match(ler('vybe-appearance.css'), /:where\(body:not\(\.mundo\)\)\.vybe-desktop :is\(button, a, input, select, textarea, \[tabindex\]\):focus-visible/);
});
