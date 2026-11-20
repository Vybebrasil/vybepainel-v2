// Pranchas V2-R das janelas e formulários (19/11/2026): Criar, cartão rápido, notas, aparência, clientes da peça,
// cadastro do cliente, nova demanda e o menu de status com o portão de motivo nos três temas.
// SAFE: só lê arquivos (e roda funções puras num vm quando dá); nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const semComentario = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const fragmentos = readdirSync('padrao-v2').filter((f) => /^zm-r-a-.*\.css$/.test(f)).map((f) => `padrao-v2/${f}`);

test('fragmentos zm-r-a: sem !important, sem html body.mundo, sem :has com [style], sem cor escrita', () => {
  assert.ok(fragmentos.length >= 1);
  for (const f of fragmentos) {
    const cru = ler(f), css = semComentario(cru);
    assert.doesNotMatch(css, /!important/, f);
    assert.doesNotMatch(css, /html body\.mundo/, f);
    assert.doesNotMatch(css, /:has\([^)]*\[style/, f);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b(?![\w-])/, `${f}: cor escrita em vez de token`);
  }
});

test('a junção leva os fragmentos zm-r-a para vybe-mundo-padrao-v2.css', () => {
  const junto = ler('vybe-mundo-padrao-v2.css');
  for (const f of fragmentos) assert.ok(junto.includes(`/* ===== ${f} ===== */`), f);
});

test('Criar: janela no vidro fumê, folha de canto 12, escolha com rádio, prévia em rótulo e valor, tipos dizem o que abrem', () => {
  const css = ler('padrao-v2/zm-r-a-1-criar.css');
  assert.match(css, /#vv-criar \.v2cr-janela\{width:min\(840px,100%\);[^}]*border-radius:var\(--d3-r-janela\);background:var\(--d3-fume-forte\)/);
  assert.match(css, /#vv-criar \.v2cr \.v2cr-dem\{padding:0;border-radius:12px;background:var\(--d3-folha\)/);
  assert.match(css, /\.v2cr-op\[aria-checked="true"\] \.v2cr-radio\{box-shadow:inset 0 0 0 5px var\(--d3-tinta\)\}/);
  assert.match(css, /\.v2cr-btn\{height:34px;[^}]*border-radius:var\(--d3-r-botao\)/);
  const js = ler('vybe-mundo.js');
  assert.match(js, /class="v2cr-janela d3-tema"/, 'no Escuro a folha escurece junto');
  assert.match(js, /o que entra na Vybe começa aqui · /);
  assert.match(js, /<i class="v2cr-radio" aria-hidden="true"><\/i>/);
  assert.match(js, /kv\('Prazos', 'calculados no passo 3'\)/);
  for (const t of ['abre Planejamentos', 'abre o cadastro completo', 'abre Reuniões']) assert.ok(js.includes(t), t);
  // os gatilhos de sempre continuam
  for (const a of ['data-criar="sair"', 'data-criar="demanda"', 'data-criar="continuar"', 'data-criar="sazonal"', 'data-criar-cliente', 'data-criar="sem-cliente"']) assert.ok(js.includes(a), a);
  // o Criar dentro do Hoje mantém a frase do pé
  assert.match(js, /\$\{jan \? '' : '<p class="v2cr-pe">Demanda e Conteúdo seguem/);
});

test('Cartão rápido: vidro fumê, quatro campos em cima, Mais campos em grade, preso ao lado da linha quando cobriria', () => {
  const css = ler('padrao-v2/zm-r-a-2-cartao.css');
  assert.match(css, /\.cr-essenciais \.cr-linha\{display:grid;grid-template-columns:108px minmax\(0,1fr\)/);
  assert.match(css, /\.cr-grade\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.cr-rodape \.cr-abrir\{[^}]*background:var\(--d3-fume-texto\);color:var\(--d3-fume-contra\)/);
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /html body\.mundo \.cartao-rapido\{background:var\(--d3-fume-forte\)!important;[^}]*border-radius:var\(--d3-r-janela\)!important/);
  const agenda = ler('vybe-agenda.js');
  assert.match(agenda, /cartao\.className = 'cartao-rapido d3-tema'/);
  assert.match(agenda, /function ancorarCartaoNaLinha\(cartao, rect\)/);
  assert.match(agenda, /<small class="cr-mais-recolher">recolher<\/small>/);
  assert.match(agenda, /linha\('OFF e áudio'/);
  assert.match(agenda, /linha\('Cadastro', /);
  // Bia (18/11/2026): o formato fica no bloco de cima, como 5º campo, e não se repete em Mais campos.
  const ess = agenda.slice(agenda.indexOf('cr-campos cr-essenciais'), agenda.indexOf('<details class="cr-mais"'));
  assert.ok(ess.includes("'Tipo de demanda' : 'Formato', pillEditavel(item, 'formato')"));
  // o fluxo e os botões de sempre
  for (const t of ["openStatusEditor", "vybeDono(item, 'cr-dono'", "openPlanningEditor", "renomearPeca", "abrirClientesDoItem", "abrirSeletorDeGrupo", "ontoggle=\"window.CR_MAIS_ABERTO=this.open\""]) assert.ok(agenda.includes(t), t);
});

test('Cartão rápido: data curta com o dia da semana', async () => {
  const agenda = ler('vybe-agenda.js');
  const ini = agenda.indexOf("const DIA_SEM = "), fim = agenda.indexOf('const palavrasCli');
  const dataCurta = new Function(`${agenda.slice(ini, fim)}; return dataCurta;`)();
  assert.equal(dataCurta('2026-11-19'), 'qui, 19/11');
  assert.equal(dataCurta('2026-11-20T10:00:00Z'), 'sex, 20/11');
  assert.equal(dataCurta(''), '—');
});

test('Notas grande: três colunas (cadernos, lista, nota aberta) no vidro, com as variáveis no lugar dos valores fixos', () => {
  const notas = ler('vybe-notas.js');
  assert.match(notas, /function notasGrandeHtml\(\)/);
  assert.match(notas, /<div class="notas-conteudo notas-3\$\{aberta \? ' com-nota' : ''\}">/);
  assert.match(notas, /\$\{aberta \? notaGrandeHtml\(\) : '<div class="notas-editor notas-editor-vazio">/);
  assert.match(notas, /<span class="notas-caderno-rot">Caderno escolhido<\/span>/);
  assert.match(notas, /arraste pelo topo, mude o tamanho pelo canto/);
  assert.match(notas, /Number\(g\.largura\) \|\| 880/);
  for (const t of ['onclick="renomearCadernoAtual()"', 'onclick="apagarCadernoAtual()"', 'onclick="mandarNotaParaPeca()"', 'onclick="voltarParaAsNotas()"', 'onclick="apagarNotaAberta()"', 'onclick="salvarNotaAgora()"', 'onpointerdown="notasArrastar(event)"', 'onpointerdown="notasRedimensionar(event)"']) assert.ok(notas.includes(t), t);
  const css = ler('padrao-v2/zm-r-a-3-notas.css');
  assert.match(css, /\.notas-conteudo\.notas-3\{display:grid;grid-template-columns:176px minmax\(0,256px\) minmax\(0,1fr\)/);
  assert.match(css, /@container \(max-width:759px\)/);
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /:is\(section\.notas-janela,#notas-janela\):not\(#ds-a\):not\(#ds-b\)\{background:var\(--d3-fume-forte\)!important/);
  assert.match(mundo, /background:var\(--nt-fundo,transparent\)!important;color:var\(--nt-cor,inherit\)!important/);
});

test('Notas pequena: vidro fumê, contagem de notas e cadernos embaixo do título', () => {
  const css = ler('padrao-v2/zm-r-a-3-notas.css');
  assert.match(css, /#v2-notas\.v2nt\{width:372px;[^}]*background:var\(--d3-fume-forte\)/);
  assert.match(css, /#v2-notas\.v2nt \.v2nt-chip\[aria-pressed="true"\]\{background:var\(--d3-fume-texto\);color:var\(--d3-fume-contra\)\}/);
  const notas = ler('vybe-notas.js');
  assert.match(notas, /janela\.className = 'v2nt d3-tema'/);
  assert.match(notas, /janela\.className = 'notas-janela d3-tema'/);
});

test('Aparência: os quatro temas ligados ao VybeTema, a barra do vidro com as pontas e as chaves na folha', () => {
  const ap = ler('vybe-appearance.js');
  assert.match(ap, /\[\['fume', 'Fumê', 'o padrão'\], \['claro', 'Claro', 'luz de manhã'\], \['escuro', 'Escuro', 'para a noite'\], \['auto', 'Auto', 'segue o sistema'\]\]/);
  assert.match(ap, /if \(r\?\.checked\) window\.VybeTema\?\.trocar\?\.\(r\.value\)/);
  assert.match(ap, /document\.addEventListener\('vybe:tema', marcarTema\)/);
  assert.match(ap, /<small><span>mais transparente · 65%<\/span><span>mais sólido · 100%<\/span><\/small>/);
  assert.match(ap, /<footer class="appearance-pe"><p>O tema também troca no menu da sua conta\.<\/p><button class="appearance-done" value="done">Concluído<\/button><\/footer>/);
  // ids e o gatilho de sempre
  for (const t of ['id="appearance-glass"', 'id="appearance-value"', 'id="appearance-motion"', "closest('[data-open-appearance]')"]) assert.ok(ap.includes(t), t);
  const mundo = ler('vybe-mundo.js');
  assert.match(mundo, /const folha = form\.querySelector\('\.appearance-folha'\);/);
  assert.match(mundo, /<b>Mundo voxel nos módulos<\/b><small>Irecê e o Prédio da Vybe · precisa de WebGL<\/small>/);
  const css = ler('padrao-v2/zm-r-a-4-aparencia.css');
  assert.match(css, /\.appearance-temas\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.appearance-tema:has\(> input:checked\) \.appearance-previa\{box-shadow:0 0 0 2px var\(--d3-folha\),0 0 0 4px var\(--d3-tinta\)\}/);
  const legado = ler('vybe-mundo.css');
  assert.match(legado, /dialog\.appearance-dialog:not\(#vv-x\)\{background:var\(--d3-fume-forte\)!important/);
});

test('Clientes da peça: título novo, nome da peça, dois grupos, avatar e "inativo", contagem no pé', () => {
  const agenda = ler('vybe-agenda.js');
  assert.match(agenda, /<h2 id="clientes-vinculo-titulo">Clientes da peça<\/h2>/);
  assert.ok(!agenda.includes('Clientes da atividade</h2>'), 'o título antigo saiu');
  assert.match(agenda, /a peça continua uma só<\/p>/);
  assert.match(agenda, /lista\.append\(grupo\(`Escolhidos · \$\{escolhidos\.length\}`\)\)/);
  assert.match(agenda, /t\.className = 'clientes-vinculo-inativo'; t\.textContent = 'inativo'/);
  assert.match(agenda, /textContent=`\$\{n\} escolhido\$\{n===1\?'':'s'\}`/);
  assert.match(agenda, /dialog\.className = 'clientes-vinculo-dialog d3-tema'/);
  // a busca segue sendo o primeiro campo (dialog.querySelector('input')) e os botões de sempre
  const ini = agenda.indexOf('dialog.innerHTML = `<header class="clientes-vinculo-cab">');
  const html = agenda.slice(ini, agenda.indexOf('`;', ini));
  assert.ok(html.indexOf('<input type="search"') < html.indexOf('clientes-vinculo-lista'));
  for (const t of ['data-cancelar>', 'data-salvar disabled', "chamar('clientes', {clientes:selecionados()})", "chamar('clientes_opcoes')"]) assert.ok(agenda.includes(t), t);
  const css = ler('padrao-v2/zm-r-a-5-clientes-peca.css');
  assert.match(css, /dialog\.clientes-vinculo-dialog\.clientes-vinculo-dialog\.d3-tema\{[^}]*background:var\(--d3-fume-forte\)/);
  assert.match(css, /footer button\[data-salvar\]\{background:var\(--d3-fume-texto\);box-shadow:none;color:var\(--d3-fume-contra\)/);
});

test('Cadastro do cliente: marca o opcional, cada etapa diz o que falta e o erro fica embaixo do campo', async () => {
  const ficha = ler('vybe-clientes-ficha.js');
  assert.match(ficha, /const obrig = campo\.obrigatorio \? '' : ' <i class="cad-opc">· opcional<\/i>';/);
  assert.ok(!ficha.includes('class="cad-obrig"'), 'o ponto de obrigatório saiu');
  assert.match(ficha, /rotulo\.textContent = n \? `\$\{n === 1 \? 'falta' : 'faltam'\} \$\{n\}` : 'completo'/);
  assert.match(ficha, /aviso\.textContent = falta \? 'Falta para fechar a ficha' : ''/);
  assert.match(ficha, /classList\.add\('cad-modal', 'cad-cliente', 'd3-tema'\)/);
  assert.match(ficha, /um cadastro só: vale no Vybe OS, no cérebro, nos bots e no Hub/);
  // cadastro de cliente é só cliente: nada de demanda ou conteúdo nesta janela
  const ini = ficha.indexOf('function abrirCadastroCompleto'), fim = ficha.indexOf('function irParaEtapaDoCadastro');
  assert.doesNotMatch(ficha.slice(ini, fim), /openCadastrosGoverned|cad-route|cad-format/);
  for (const t of ['onclick="passoDoCadastro(-1)"', 'onclick="passoDoCadastro(1)"', 'onclick="salvarCadastroCompleto(this)"', "onclick=\"irParaEtapaDoCadastro('${s.id}')\""]) assert.ok(ficha.includes(t), t);
  // o campo renderizado
  const ini2 = ficha.indexOf('function campoDoCadastroHtml'), fim2 = ficha.indexOf('function abrirCadastroCompleto');
  const campo = new Function('fichaEsc', `${ficha.slice(ini2, fim2)}; return campoDoCadastroHtml;`)((v) => String(v ?? ''));
  const opc = campo({ chave: 'razao', rotulo: 'Razão social', tipo: 'texto' }, '');
  assert.match(opc, /<span>Razão social <i class="cad-opc">· opcional<\/i><\/span>/);
  assert.doesNotMatch(opc, /data-obrig/);
  const obr = campo({ chave: 'cidade', rotulo: 'Cidade', tipo: 'texto', obrigatorio: true }, '');
  assert.match(obr, /data-obrig="cidade"><span>Cidade<\/span>/);
  assert.match(obr, /<small class="cad-erro-campo" id="cad-cidade-falta" aria-live="polite"><\/small>/);
  const css = ler('padrao-v2/zm-r-a-6-cadastro-cliente.css');
  assert.match(css, /--wm-fundo:var\(--d3-fume-forte\)/);
  assert.match(css, /\.cad-campo\.cad-falta :is\(input,select,textarea\)\{--wm-campo-borda:var\(--d3-perigo\)/);
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /background:var\(--wm-fundo,var\(--d3-cartao\)\)!important/);
  assert.match(mundo, /\.workflow-primary\{background:var\(--wm-pri-fundo,var\(--d3-acao\)\)!important/);
  assert.match(ler('vybe-styles.css'), /\{width:var\(--wm-largura,min\(940px,94vw\)\)!important\}/);
});

test('Nova demanda: casca no vidro, rádio no O quê, responsável em caixa, "A data do cliente é" e a semana por pessoa', () => {
  const cad = ler('cadastros_governed_v2.js');
  assert.match(cad, /<span class="nd-radio" aria-hidden="true"><\/span>/);
  assert.match(cad, /<p class="nd-rot">A data do cliente é<\/p>/);
  assert.match(cad, /Demanda usa a conclusão; conteúdo usa a veiculação\./);
  assert.match(cad, /<span>Prazo interno <span class="nd-sub">· 7 dias antes<\/span><\/span>/);
  assert.match(cad, /<div class="nd-resp">/);
  assert.match(cad, /sem dono vai para a triagem/);
  assert.match(cad, /<p class="nd-sub nd-previa-rot">Como chega na equipe<\/p>/);
  assert.match(cad, />Criar em escala<\/button>/);
  assert.match(cad, /<button type="button" class="nd-lk nd-sazonal" onclick="abrirCalendarioSazonal\(\)">Começar pelo calendário sazonal<\/button>/);
  // Cadastro em etapas (Paulo, 20/11/2026): "N de 4 · etapa" no topo e uma folha por vez.
  assert.match(cad, /texto\.textContent = `\$\{fcEtapa \+ 1\} de \$\{FC_ETAPAS\.length\} · \$\{FC_ETAPAS\[fcEtapa\]\}`/);
  assert.match(cad, /<div class="nd-card nd-passo-folha d3-tema">/);
  // ids e gatilhos de sempre
  for (const t of ['id="fc-prazo"', 'id="fc-no-ar"', 'id="fc-semana"', 'id="fc-mais-chip"', 'id="fc-submit-btn"', 'id="fc-voltar-btn"', 'id="fc-busca-cliente"', 'onclick="fcAceitarRegra(', 'onclick="fcAbrirPessoas()"']) assert.ok(cad.includes(t), t);
  const css = ler('padrao-v2/zm-r-a-7-nova-demanda.css');
  assert.match(css, /#fc-overlay#fc-overlay \.nd\{width:min\(1300px,calc\(100vw - 32px\)\);[^}]*background:var\(--d3-fume-forte\)/);
  assert.match(css, /\.nd-pe \.nd-btn\.k\{background:var\(--d3-fume-texto\);box-shadow:none;color:var\(--d3-fume-contra\)/);
});

test('Nova demanda: a pré-validação do Cadastros antigo (datas) e o atalho antigo abre o fluxo novo', () => {
  const cad = ler('cadastros_governed_v2.js');
  const ini = cad.indexOf('  function fcConferirDatas('), fim = cad.indexOf('  window.fcConferirDatas');
  const conferir = new Function('todayIso', 'state', `${cad.slice(ini, fim)}; return fcConferirDatas;`)(() => '2026-11-19', { itens: [] });
  assert.equal(conferir([{ veic: '2026-11-18', prazo: '2026-11-11' }], '2026-11-19'), 'A data do cliente não pode ficar antes de hoje.');
  assert.equal(conferir([{ veic: '2026-11-25', prazo: '2026-11-26' }], '2026-11-19'), 'O prazo interno precisa ser até a data do cliente.');
  assert.equal(conferir([{ veic: '2026-11-25', prazo: '2026-11-18' }], '2026-11-19'), '');
  // A conferência das datas roda ao sair das Datas (no conteúdo aberto) e de novo antes de cadastrar (em todos).
  assert.match(cad, /if \(fcEtapa === 2\) \{ const datas = fcConferirDatas\(\[state\.itens\[fcItemAtivo\(\)\]\]\); if \(datas\) return fcAvisarDatas\(datas\); \}/);
  assert.match(cad, /const datas = fcConferirDatas\(\);\s+if \(datas\) return fcAvisarDatas\(datas\);\s+return fcSubmit\(\);/);
  const perfis = ler('vybe-perfis.js');
  assert.match(perfis, /function openCadastrosGovernedLegacy\(\)\{if\(typeof window\.openCadastrosGoverned==='function'\)\{document\.getElementById\('cadastros-preview-overlay'\)\?\.remove\(\);return window\.openCadastrosGoverned\(\);\}/);
});

test('Nova demanda: a semana por pessoa conta quem faz e quem tem peça no dia, contra a régua', () => {
  const cad = ler('cadastros_governed_v2.js');
  const ini = cad.indexOf('  function fcSemanaPessoas('), fim = cad.indexOf('  function fcSemanaHtml(');
  const getOffsetDate = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fn = new Function('FC_REGUA', 'state', 'getOffsetDate', 'fcEquipeFinal', 'fcRegraDoFormato', `${cad.slice(ini, fim)}; return fcSemanaPessoas;`)(
    { pecas: 6, videos: 4 }, { format: 'Card', itens: [] }, getOffsetDate, () => [], () => ({ dest: {} }));
  const p = (id, veic, rid, extra = {}) => ({ id, veiculacao_iso: veic, responsavel_ids: [rid], formato: 'Card', status: 'A Fazer', ...extra });
  const itens = [p(1, '2026-11-25', 'a'), p(2, '2026-11-25', 'a'), p(3, '2026-11-25', 'b'), p(4, '2026-11-25', 'b', { status: 'Finalizado' }), p(5, '2026-11-24', 'c')];
  const users = [{ id: 'a', name: 'Ana Souza' }, { id: 'b', name: 'Beto' }, { id: 'c', name: 'Caio' }, { id: 'd', name: 'Duda' }];
  const s = fn({ veic: '2026-11-25' }, { itens, equipe: ['d'], formato: 'Card', novos: [{ veic: '2026-11-25' }], users });
  assert.equal(s.regua, 6); assert.equal(s.seg, '2026-11-23');
  assert.deepEqual(s.linhas.map((l) => [l.nome, l.valor]), [['Duda', 1], ['Ana', 2], ['Beto', 1]], 'quem faz primeiro (com a peça nova), depois quem tem peça no dia; finalizada não conta');
  assert.equal(fn({ veic: '' }, { itens, users }), null);
});

test('Portão de motivo nos três temas: "Quem faz" no lugar de "Responsáveis", título do pedido e folha dentro do vidro', () => {
  const st = ler('vybe-status.js');
  assert.match(st, /\{nome:'Quem faz',campo:'status-context-next-owner',html:responsible\}/);
  assert.match(st, /<span id="status-context-owners-label">Quem faz a próxima ação<em/);
  assert.match(st, /rows\.push\(\['Quem faz',/);
  assert.ok(!st.includes("nome:'Responsáveis'"), 'o nome antigo saiu da etapa');
  assert.match(st, /\(\{ 'alteração': 'Pedir alteração' \}\)/);
  assert.match(st, /<\/header><div class="status-gate-folha">/);
  assert.match(st, /<small>Nada muda até você confirmar\.<\/small>/);
  assert.match(st, /String\(etapas\[atual\]\.dataset\.name\|\|''\)\.toLowerCase\(\)/);
  const css = ler('padrao-v2/zm-r-a-8-portao-temas.css');
  assert.match(css, /#workflow-modal\.status-context-dialog\{[^}]*--wm-fundo:var\(--d3-fume-forte\)/);
  assert.match(css, /--wm-titulo-display:block/);
  assert.match(css, /\.v2-st-dica\.v2-st-dica\{color:var\(--d3-fume-apagado\)\}/, 'a dica do menu passa de 4,5:1');
  const padrao = ler('vybe-padrao.css');
  assert.match(padrao, /\.status-context-dialog \.context-title\{display:var\(--wm-titulo-display,none\)!important\}/);
  assert.match(padrao, /\.context-progress\{font:var\(--wm-progresso-fonte,600 12px var\(--mac-ui\)\)!important;color:var\(--wm-progresso-cor,#ff9a5c\)!important\}/);
});

