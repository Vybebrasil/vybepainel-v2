// Direção V2 nos módulos do grupo C (pranchas V2-M-Agenda, V2-M-Agenda-Roteiros e seguintes, 16/11/2026): o esqueleto
// novo de cada tela, com as funções de sempre, e os fragmentos zm-c-* só com tokens e sem !important.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fragmentos = readdirSync(new URL('../padrao-v2/', import.meta.url)).filter((f) => f.startsWith('zm-c-') && f.endsWith('.css'));

test('fragmentos zm-c-*: só tokens --d3-*, sem !important, sem html body.mundo, sem :has com [style] e sem fim de linha misturado', () => {
  assert.ok(fragmentos.includes('zm-c-base.css') && fragmentos.includes('zm-c-agenda.css'));
  const junto = ler('vybe-mundo-padrao-v2.css');
  for (const f of fragmentos) {
    const css = ler(`padrao-v2/${f}`), semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(semComentario, /!important/, f);
    assert.doesNotMatch(semComentario, /html body\.mundo/, f);
    assert.doesNotMatch(semComentario, /:has\([^)]*\[style/, f);
    assert.doesNotMatch(semComentario, /#[0-9a-fA-F]{3,8}\b/, `${f}: cor fora dos tokens`);
    assert.doesNotMatch(semComentario, /@keyframes[^{]*\{\s*(from|0%)\s*\{[^}]*opacity:\s*0[;}]/, f);
    assert.ok(!(css.includes('\r\n') && css.replaceAll('\r\n', '').includes('\n')), `${f}: fim de linha misturado`);
    assert.ok(junto.includes(`/* ===== padrao-v2/${f} ===== */`), `${f} entrou na folha junta`);
  }
});

test('Agenda V2: grade de horas no computador, com as mesmas funções; no celular fica a tela de antes', () => {
  const capt = ler('vybe-captacoes.js'), prod = ler('production_governed_v2.js'), css = ler('padrao-v2/zm-c-agenda.css');
  assert.match(capt, /function agv2Ligado\(\) \{ return typeof pv2Ligado === "function" && pv2Ligado\(\) && !captNoCelular\(\); \}/);
  assert.match(capt, /function pv2aHtml\(\{ todos, pend, nPend \}\) \{\r?\n[^\n]*\r?\n  if \(agv2Ligado\(\)\) return agv2Html\(\{ todos, pend \}\);/);
  assert.match(prod, /if \(agV2\) document\.body\.dataset\.agv2 = window\.productionV2View \|\| 'captacoes'; else delete document\.body\.dataset\.agv2;/);
  assert.match(prod, /\$\{agv2TopoHtml\(\)\}/);
  // O topo: Semana | Mês | Roteiros, as setas e Marcar captação; Dia, Feed e Calendário na seta do título.
  for (const t of ["prodAgendaVista('${v}')", 'captNavegar(-1)', 'captNavegar(1)', 'captMarcarCaptacao()', "captVista('dia')", "window.setProdV2View('feed')", "window.setProdV2View('calendar')", 'captAlternarInspetor()', 'T hoje · ← → navega']) assert.ok(capt.includes(t), t);
  // A grade: bloco abre o cartão e a prévia, horário vazio marca, cliente arrastado marca, o dia abre o Dia, a legenda filtra.
  const grade = capt.slice(capt.indexOf('function agv2BlocoHtml('), capt.indexOf('function agv2LaranjaHtml('));
  for (const t of ['captSelecionar(', "agPreviaEntrar(this,'captPreviaHtml')", 'agv2Clicar(event,', 'agv2Soltar(event,', 'agSobre(event)', "captVerDia('${d}')", 'class="agv2-agora"']) assert.ok(grade.includes(t), t);
  assert.match(capt, /function agv2Clicar\(ev, dia, ini, horas\) \{ if \(ev\.target\.closest\("\.agv2-ev"\)\) return; captMarcarEm\(dia, agv2HoraDoClique\(ev, ini, horas\)\); \}/);
  assert.match(capt, /captSoltarCliente\(cliente, ev\.currentTarget\.dataset\.dia, agv2HoraDoClique\(ev, ini, horas\)\)/);
  assert.match(capt, /class="agv2-leg t-\$\{t\}" role="switch" aria-checked="\$\{CAPT\.tipos\.has\(t\)\}" onclick="captTipo\('\$\{t\}'\)"/);
  // A gravação sem fechar vai no laranja; captação verde, reunião roxa, compromisso azul.
  assert.match(capt, /\$\{e\.estado\?\.chave === "fechar" \? " fechar" : ""\}/);
  assert.match(css, /\.agv2 \.t-captacao\{--agv2-cor:var\(--d3-mod-vybe\)/);
  assert.match(css, /\.agv2 \.t-reuniao\{--agv2-cor:var\(--d3-agente-texto\)/);
  assert.match(css, /\.agv2 \.t-outro\{--agv2-cor:var\(--d3-info\)/);
  assert.match(css, /\.agv2 \.fechar\{--agv2-cor:var\(--d3-acao\)/);
  // A consulta: o cartão laranja resolve a mais urgente; "Antes de gravar" abre o que precisa de você.
  const lado = capt.slice(capt.indexOf('function agv2LaranjaHtml('), capt.indexOf('function agv2Html('));
  for (const t of ['captAbrirFechar(', 'captAbrirMontar(', 'captCadastrar(', "captGrupo('roteiro')", "captGrupo('pecas')", 'captPendenciasHtml(pend)', "prodAgendaVista('roteiros')", '<b>Antes de gravar</b>', '<b>Hoje</b>', '<b>Abrir</b>']) assert.ok(lado.includes(t), t);
  // A janela é o vidro fumê e a grade só rola por dentro.
  assert.match(css, /body\.mundo\.mundo-modulo\[data-modo="producao"\]\[data-agv2\] #mundo-moldura\{border-radius:20px;background:var\(--d3-fume\)/);
  assert.match(css, /\.agv2-rola\{flex:1 1 0;min-height:0;overflow-x:hidden;overflow-y:auto;[^}]*container-type:size\}/);
  assert.match(css, /--agv2-hora:max\(36px,calc\(100cqh \/ var\(--agv2-n,11\)\)\)/);
  // O cartão aberto não fecha quando o clique é em outro bloco da grade nova.
  assert.match(capt, /closest\("\.ag-ev,\.agv2-ev,\.agv2-lado,\.ag-chip,/);
});

test('Roteiros V2: uma folha por roteiro, com as mesmas ações, e os clientes como filtro na consulta', () => {
  const rot = ler('vybe-roteiros.js'), capt = ler('vybe-captacoes.js');
  assert.match(rot, /if \(typeof agv2Ligado === "function" && agv2Ligado\(\)\) return rotv2Html\(\);/);
  for (const t of ["rotAbrirEditar('${r.id}')", "rotAbrirLigar('${r.id}')", 'target="_blank" rel="noopener">Abrir no Docs</a>', 'peças do roteiro', 'conteúdos que saíram dele', 'nenhum conteúdo ligado ainda', 'rotAbrirIncluir()', "rotv2Cliente('${safeText(id)}')", 'rotv2SoSem()', '<b>Por cliente</b>']) assert.ok(rot.includes(t), t);
  for (const t of ['oninput="rotv2Buscar(this.value)"', 'onclick="rotBuscarDrive(this)">Buscar no Drive</button>', 'onclick="rotAbrirIncluir()"']) assert.ok(capt.includes(t), t);
  assert.match(rot, /function rotv2Buscar\(valor\) \{ ROT\.busca = valor; const l = document\.getElementById\("rotv2-lista"\); if \(l\) l\.innerHTML = rotv2ListaHtml\(\); \}/);
});

test('Planejamentos V2: o mês numa folha, uma linha por cliente, com os botões de sempre', () => {
  const plj = ler('vybe-mundo-planejamentos.js'), css = ler('padrao-v2/zm-c-planejamentos.css'), base = ler('padrao-v2/zm-c-base.css');
  assert.ok(plj.includes("const v2 = () => typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 700px)').matches;"));
  assert.ok(plj.includes("if (v2()) return pintarV2();") && plj.includes("janela.classList?.remove('d3m-c-janela');"));
  assert.match(plj, /if \(v2\(\)\) \{ const l = janela\?\.querySelector\('#plj2-lista'\); if \(l\) l\.innerHTML = lista2Html\(contas\(\)\); return; \}/);
  const tela = plj.slice(plj.indexOf('const v2 = '), plj.indexOf('async function carregar()'));
  // Tudo o que a tela fazia continua pelos mesmos data-plj-*.
  for (const t of ['data-plj-linha="${esc(pl.id)}"', 'data-plj-abrir="${esc(pl.id)}"', 'data-plj-aba="historico"', 'data-plj-aba="editar"', 'data-plj-novo="${esc(p.cliente_id)}" data-plj-nome="${esc(p.cliente)}" ${rotuloNovo(p)}',
    'data-plj-mes="${m}"', 'data-plj-busca', 'data-plj-filtro="${id}"', 'data-plj-situacao="${id}"', 'data-plj-recarregar', 'data-plj-fechar', 'etapasHtml(pl)', 'avisosHtml(p)']) assert.ok(tela.includes(t), t);
  // A ordem da prancha: Agora, Andando e Falta; a trilha do escrito ao aprovado; o pé "De olho"; a consulta.
  for (const t of ["['Agora', 'r', lista.filter(pedeAcao)]", "['Andando', ''", "['Falta', 'a'", '<span>Escrito até aprovado</span>', '<span class="plj2-pe-rot">De olho</span>', 'Augusto · o que trava', '<b>De uma vez</b>', '<b>Onde o cliente aprova</b>', "window.d3mcTrocaHtml('Planejamentos', 'producao', 'planejamentos')"]) assert.ok(tela.includes(t), t);
  assert.match(css, /\.plj2-lista\{flex:1 1 0;min-height:0;overflow-y:auto/);
  assert.match(base, /:is\(#vv-planejamentos,#vv-impressoes,#vv-pessoas,#vv-comercial,#vv-whatsapp\)\.d3m-c-janela\.d3m-c-janela\{[^}]*background:var\(--d3-fume\)/);
  // A seta do título troca de tela pelo submenu do menu lateral.
  assert.match(ler('vybe-captacoes.js'), /function d3mcPintarTroca\(det, setor, atual\) \{/);
});

test('Impressões V2: funil das 7 etapas, linhas, colunas e tabela, com a ficha e os pedidos de sempre', () => {
  const imp = ler('vybe-mundo-impressoes.js'), css = ler('padrao-v2/zm-c-impressoes.css');
  assert.ok(imp.includes("const v2 = () => typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 700px)').matches;"));
  assert.ok(imp.includes('if (v2()) return pintarV2();'));
  const tela = imp.slice(imp.indexOf('const v2 = '), imp.indexOf('  function pintar() {'));
  // As três vistas e o que cada uma faz continuam pelos mesmos data-vi-*.
  for (const t of ['data-vi-vista="${k}"', 'data-vi-busca', 'data-vi="nova"', 'data-vi="fechar"', 'data-vi="todas"', 'data-vi="recarregar"', 'data-vi="cadastrar-fornecedor"', 'data-vi="mais"', 'data-vi="agora-nao"', 'data-vi="anterior"', 'data-vi="proxima"',
    'data-vi-decidir="atual"', 'data-vi-abrir="${esc(i.id)}"', 'data-vi-linha="${esc(i.id)}"', 'data-vi-escolher-forn="${esc(i.id)}"', 'data-vi-fornecedor="${esc(f.fornecedor_id)}"', 'data-vi-arte="${esc(i.conteudo_id)}"', 'data-vi-aba="${k}"', 'data-vi="por-grafica"',
    'ficha()', 'formulario()', 'decisoes()']) assert.ok(tela.includes(t), t);
  // Linhas: o funil filtra pela etapa; a ordem é o que pede você, o que está na gráfica e o que vem antes dela.
  assert.ok(tela.includes("data-vi-filtro=\"${on ? '' : 'etapa:' + e.id}\""));
  assert.ok(imp.includes("st.filtro.startsWith('etapa:') ? i.etapa === st.filtro.slice(6) : true"));
  for (const t of ["['Agora', 'r']", "['Na gráfica', '']", "['Antes dela', '']", '<span>Arte até entregue</span>', '<span class="imp2-pe-rot">De olho</span>', '<b>Gráficas</b>', '<span class="imp2-pe-rot">Somas</span>', '<span>A arte na esteira</span>']) assert.ok(tela.includes(t), t);
  // Etapas: arrastar o cartão muda a etapa pelo mesmo pedido do botão; sem gráfica não passa do orçamento.
  assert.ok(tela.includes("gravar({ acao: 'impressao_etapa', id, etapa: para }, `Foi para ${etapaNome(para)}.`);"));
  assert.ok(tela.includes("if (['arquivo_enviado', 'em_impressao', 'pronto', 'entregue'].includes(para) && !i.fornecedor_id) {"));
  assert.ok(imp.includes("raiz.addEventListener('dragstart', aoArrastar); raiz.addEventListener('dragover', aoPassar); raiz.addEventListener('dragleave', aoSair); raiz.addEventListener('drop', aoSoltar);"));
  // Dinheiro só para a gestão (valor, somas e gasto).
  assert.ok(tela.includes("${din ? '<span>Valor</span>' : ''}") && tela.includes("d.gestao ? tile("));
  assert.match(css, /\.imp2-funil\{flex:none;display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css, /\.imp2-quadro\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});

test('Projetos V2: abre na linha do tempo, com os cartões como aba e a página do projeto de sempre', () => {
  const pes = ler('vybe-mundo-pessoas.js'), css = ler('padrao-v2/zm-c-projetos.css');
  assert.ok(pes.includes("const v2pj = () => estado.aba === 'projetos' && typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 700px)').matches;"));
  assert.ok(pes.includes("janela.innerHTML = pj2 ? painelPj2() : htmlPainel();"));
  const tela = pes.slice(pes.indexOf('const v2pj = '), pes.indexOf('  // Escolher um projeto: o cartão fica marcado'));
  // Abre na linha do tempo; Cartões é a outra aba.
  assert.ok(tela.includes("vista = estado.v2.vista || 'tempo'"));
  assert.ok(tela.includes("[['tempo', 'Linha do tempo'], ['cartoes', 'Cartões']]"));
  // As mesmas ações: abrir o projeto, editar, novo, filtros, busca, fechar; a página, a lista e o formulário de sempre.
  for (const t of ['data-v2pj-abre="${esc(p.id)}"', 'data-forcar="1"', 'data-vp-editar-projeto="${esc(pior.p.id)}"', 'data-vp-abrir-form="projeto"', 'data-v2pj-vista="${k}"', 'data-v2p-filtro="concluidos"', 'data-v2pj-campo="tipo"', 'data-v2p-busca', 'data-vp-fechar', 'data-vp-recarregar', 'data-vp-aba="${k}"',
    'paginaProj(escolhido, d)', 'paginaProj(aberto, d)', 'listaProjetos(d)', 'barraProjetos(d, ps)', 'formProjeto(d)', 'semMigracao(d)']) assert.ok(tela.includes(t), t);
  // A etapa na linha: feita, atrasada, em curso ou a fazer; a linha vermelha é hoje (a posição vem do servidor).
  assert.ok(tela.includes("const tomEtapaPj = (e, h) => (e.feita ? 'ok' : e.fim && e.fim < h ? 'r' : e.inicio && e.inicio <= h ? 'b' : '');"));
  assert.ok(tela.includes('<i class="pj2-barra ${tom}" style="left:${e.pos.esq}%;width:${e.pos.larg}%"></i>') && tela.includes('<div class="pj2-hoje" aria-hidden="true"><i style="left:${l.hoje}%"></i></div>'));
  for (const t of ['<span class="pj2-pe-rot">De olho</span>', 'Heitor · ${c.rot}', '<b>Carga com os projetos</b>', '<b>Encerrados</b>']) assert.ok(tela.includes(t), t);
  // Novo projeto só para a gestão.
  assert.ok(tela.includes("${d?.gestao ? `<button type=\"button\" class=\"d3m-c-btn\" data-vp-abrir-form=\"projeto\">"));
  assert.match(css, /\.pj2-rola\{flex:1 1 0;min-height:0;overflow-y:auto/);
  assert.match(css, /\.pj2-barra\.r\{background:var\(--d3-perigo\)\}/);
});

test('Fornecedores V2: uma linha por fornecedor na folha, com os campos e os botões de sempre; no celular fica a tela de antes', () => {
  const com = ler('vybe-mundo-comercial.js'), css = ler('padrao-v2/zm-c-comercial.css');
  assert.ok(com.includes("const v2 = () => typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 700px)').matches;"));
  // Só estas abas trocam de esqueleto, e só no computador; o resto da janela do Comercial fica como estava.
  assert.ok(com.includes('if (v2m()) return pintarM(el, { d, erro, abas });') && com.includes('const v2m = () => Boolean(M2[st.aba]) && v2();'));
  assert.match(com, /const M2 = \{ fornecedores: \['Fornecedores', 'producao', fornecedoresM\]/);
  assert.ok(com.includes("el.className = 'vc d3m-c-janela';") && com.includes('window.d3mcTrocaHtml(nome, setor, st.aba)'));
  const tela = com.slice(com.indexOf('function fornecedoresM(d)'), com.indexOf('const M2 = '));
  // Tudo o que a tela fazia continua pelos mesmos data-*.
  for (const t of ['data-v2-linha="fo:${id}"', 'data-v2="abre" data-id="fo:${id}"', 'data-v2-campo="forn:bv:${esc(f.id)}"', 'data-v2-campo="forn:contato:${esc(f.id)}"', 'data-v2="salvar-campo" data-id="forn:bv:${esc(f.id)}"',
    'data-vc="ver-impressoes" data-id="${id}"', 'data-vc="fornecedor" data-id="${id}"', 'data-vc="arquivar-forn" data-id="${id}"', 'data-vc="fornecedor">${IM.mais}Novo fornecedor', "buscaM('forn', 'Buscar fornecedor ou contato')",
    'data-v2="abre-um" data-id="fo:${esc(bvs[0].id)}"', 'C().filtrarFornecedores(', 'carregarEntregas();']) assert.ok(tela.includes(t), t);
  // A ordem da prancha: Agora (o que falta) e Em dia; o pé "De olho"; o Nestor, o mês com as gráficas e os atalhos.
  for (const t of ["[['Agora', lista.filter(incompleto)], ['Em dia'", '<span>Fornecedor</span><span>Contato</span><span>BV</span><span>Em andamento</span><span>Entrega média</span>', '<span class="m2-pe-rot">De olho</span>',
    "'Nestor · falta para as Impressões'", '<span>com as gráficas</span>', '<b>Abrir</b>', "irM('creators', 'Creators'", 'só donos e administração']) assert.ok(tela.includes(t), t);
  // Erro (quem não pode ver) e vazio ficam no mesmo esqueleto.
  assert.ok(com.includes('<b>Não foi possível abrir ${nome}</b>${esc(erro)}') && tela.includes('<b>Nenhum fornecedor ainda</b>'));
  assert.match(css, /\.fo2-lista\{flex:1 1 0;display:flex;flex-direction:column;min-height:0;overflow-y:auto/);
  assert.match(css, /\.fo2-abre\[aria-expanded="true"\] > \.fo2-det\{display:flex\}/);
  assert.match(css, /#vv-comercial\.d3m-c-janela :is\(\.vc-folha,\.vc-abas\)\{color:var\(--d3-tinta\)\}/);
});
