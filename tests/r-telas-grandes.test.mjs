import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Telas grandes nas pranchas V2-R (aprovadas pelo Paulo, 19/11/2026): Saúde da carteira, Agenda (Mês e Dia), Cérebro do
// cliente, Loja, Toolkit, Metas no Comercial (com meta por pessoa) e a fila dos Agentes com filtros por tipo.
const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const naOrdem = (texto, partes) => { let p = -1; for (const parte of partes) { const i = texto.indexOf(parte, p + 1); assert.ok(i > p, parte); p = i; } };
const cssR = (nome) => ler(`padrao-v2/${nome}`);
const guardaCss = (css, nome) => {
  assert.doesNotMatch(css, /!important/, `${nome}: sem !important`);
  assert.doesNotMatch(css, /html body\.mundo/, `${nome}: sem html body.mundo`);
  assert.doesNotMatch(css, /:has\([^)]*\[style/, `${nome}: sem :has com [style]`);
  assert.doesNotMatch(css.replace(/rgba?\([^)]*\)/g, ''), /#[0-9a-fA-F]{3,8}\b/, `${nome}: só tokens, sem cor escrita`);
  assert.ok(fs.readFileSync(`padrao-v2/${nome}`, 'utf8').includes('\r\n'), `${nome}: CRLF`);
};

test('Saúde da carteira na prancha V2-R: vidro como Contratos e Churn, quatro números, a lista com filtros na cabeça e o laranja do Mateus ao lado', () => {
  const js = ler('vybe-mundo-carteira.js');
  assert.match(js, /const TELAS_M = new Set\(\['contratos', 'churn', 'saude'\]\);/);
  assert.match(js, /\{ churn: abaChurn, contratos: abaContratos, saude: abaSaudeM \}\[estado\.aba\]/);
  const tela = js.slice(js.indexOf('  function abaSaudeM() {'), js.indexOf('  // Contas por head: quantos clientes'));
  naOrdem(tela, ['data-tela="saude-v2"', "rotulo: 'Nota média'", "rotulo: 'Precisam de você'", "rotulo: 'Tranquilos'", "rotulo: 'Peças vencidas'", 'data-vc-mais="saude"', 'sem urgência, em Todos', "segM('Filtrar por risco'", 'data-vc-ordem-gira',
    'larMq(AGENTE', '<b>O que mais pesa</b>', '<b>Como tira ponto</b>']);
  // Os mesmos data-vc-* de antes: filtro, head, visão, linha que abre no lugar, abrir o cliente e as vencidas.
  for (const a of ['data-vc-risco=', 'data-vc-head', 'data-vc-visao=', 'data-vc-atrasadas', 'data-vc-cliente=', 'data-vc-ir="churn"', 'data-vc-como']) assert.ok(js.slice(js.indexOf('  function linhaSaudeM('), js.indexOf('  // Contas por head: quantos clientes')).includes(a), a);
  assert.match(js, /if \(d\.vcOrdemSaude\) \{ estado\.ordem\.saude = d\.vcOrdemSaude;/);
  // Receita só para quem vê dinheiro.
  assert.match(tela, /nota\$\{din \? ' e receita' : ''\}/);
  guardaCss(cssR('zm-r-b-1-saude.css'), 'zm-r-b-1-saude.css');
});

test('Agenda: a aba Dia ao lado de Semana, Mês e Roteiros; Mês e Dia nas pranchas V2-R, com as funções de sempre', () => {
  const js = ler('vybe-captacoes.js'), prod = ler('production_governed_v2.js');
  assert.match(js, /const seg = \[\["dia", "Dia"\], \["semana", "Semana"\], \["mes", "Mês"\], \["roteiros", "Roteiros"\]\]/);
  assert.doesNotMatch(js.slice(js.indexOf('function agv2TopoHtml()'), js.indexOf('function d3mcTrocaHtml(')), /captVista\('dia'\)" title="Dia \(D\)"/, 'o Dia saiu da seta do título');
  assert.match(prod, /v === 'mes' \|\| v === 'dia' \? atual === v/);
  assert.match(prod, /captVerDia\(atual === 'mes' \|\| CAPT\.semana === agSegunda\(h\) \? h : CAPT\.semana\)/);
  const r = js.slice(js.indexOf('// MÊS e DIA nas pranchas V2-R'), js.indexOf('function agv2Html({ todos, pend }) {'));
  naOrdem(r, ['function agv2MesHtml(', 'data-comemorativa=', "captVerDia('${dia}')", 'function agv2LadoMesHtml(', '<b>Datas que pedem peça</b>', '<b>Hoje, hora a hora</b>',
    'function agv2RoteiroDoDiaHtml(', 'captAbrirFechar(', 'captAbrirMontar(', 'captSelecionar(', 'captGravado(', 'Escrever roteiro', 'function agv2DiaHtml(', 'agv2GradeHtml(eventos, [dia])', 'peça sem roteiro', 'function agv2LadoDiaHtml(', 'Ainda de ontem', 'Amanhã']);
  // O small leva classe: a regra antiga de small sem classe dentro da .container não pinta por cima.
  assert.doesNotMatch(r, /<small>/);
  assert.match(js, /if \(CAPT\.vista === "dia"\) return `<div id="agv2" class="d3m-c-corpo agv2 agv2-v-dia">/);
  assert.match(js, /const corpo = CAPT\.vista === "mes" \? agv2MesHtml\(eventos\) : agv2GradeHtml\(eventos\);/);
  guardaCss(cssR('zm-r-b-2-agenda.css'), 'zm-r-b-2-agenda.css');
});

test('Cérebro do cliente nas pranchas V2-R: a ficha em 3 × 3, a atividade em tabela, o estudo em dois por dois e a consulta de cada aba', () => {
  const js = ler('vybe-clientes-cerebro.js');
  const ficha = js.slice(js.indexOf('function renderDossieNeuralClienteHtml('), js.indexOf('// Cartão dentro da ficha do cliente'));
  naOrdem(ficha, ['class="cb-r-grade"', 'id="cb-bloco-${gid}"', 'class="cb-r-cab"', "cerebroSelecionar('grupo','${gid}')", 'class="cb-r-cor"', "cerebroSelecionar('item'", 'mais ${resto}', 'por quê · de onde vem', '${acao}']);
  assert.match(js, /const CEREBRO_NOVO_DA_AREA = \{ regras: \['regras', '\+ regra'\], ideias: \['ideias', '\+ ideia'\], aprendizados: \['memoria', '\+ lembrança'\] \};/);
  const ativ = js.slice(js.indexOf('function renderAtividadeCerebroHtml('), js.indexOf('// A mesma regra governa pintura'));
  naOrdem(ativ, ['class="cb-r-ativ"', 'role="table"', '<span role="columnheader">Origem</span>', '<span role="columnheader">Quando</span>', 'abrirRegistroCerebro(', 'Ver os ${registros.length} registros na ficha', 'Ver toda a atividade', 'mostrando ${lista.length} de ${registros.length}']);
  const sin = js.slice(js.indexOf('function renderEstudoClienteCerebroHtml('), js.indexOf('function renderDiagnosticoCerebroHtml('));
  naOrdem(sin, ['Estudo de ', "cerebroMotorHtml('qwen')", 'Consultar de novo', 'Setor', 'Posicionamento', "area('Oportunidades'", "area('Ameaças'", "area('Concorrentes'", "area('Ideias'", 'Para confirmar']);
  const lado = js.slice(js.indexOf('  // Pranchas V2-R-Cerebro-Cliente, -Atividade e -Sinapses'), js.indexOf('// Põe as duas colunas de fora da folha'));
  naOrdem(lado, ['filtrarOrigemCerebro(', 'Rede de clientes', '<b>No cérebro</b>', 'Atividade de todos', 'Alex · para confirmar', 'De onde vem cada coisa', 'Como o Alex estuda', 'Diagnóstico em Agentes']);
  // Nenhum small sem classe nestes trechos: a regra antiga de small sem classe dentro de #painel-* pintaria por cima.
  for (const t of [ficha, ativ, sin, lado]) assert.doesNotMatch(t, /<small>/);
  guardaCss(cssR('zm-r-b-3-cerebro.css'), 'zm-r-b-3-cerebro.css');
});

test('Loja: Inventário e Carteira nas pranchas V2-R, com as funções de compra, troca e ficha de sempre', () => {
  const loja = ler('vybe-escritorio-loja.js'), ed = ler('vybe-escritorio-editor.js');
  assert.match(loja, /if \(\(aba === "carteira" \|\| aba === "inventario"\) && document\.getElementById\("office-catalogo"\)\?\.classList\.contains\("d3m-f-lojaj"\)\) return escritorioLojaLadoV2Html\(aba\);/);
  assert.match(ed, /d\.classList\.contains\("d3m-f-lojaj"\) && typeof escritorioCarteiraV2Html === "function" \? escritorioCarteiraV2Html\(\) : `<div class="ofc-catj-carteira">\$\{escritorioCarteiraHtml\(\)\}<\/div>`/);
  const ct = loja.slice(loja.indexOf('function escritorioCarteiraV2Html('), loja.indexOf('function escritorioLojaLadoV2Html('));
  naOrdem(ct, ['"Saldo disponível"', '"Nível"', '"Nesta semana"', 'Últimos 7 dias', 'De onde vieram', '["tudo", "Tudo"], ["compras", "Compras"], ["vendas", "Vendas"], ["devolucoes", "Devoluções"]', 'Histórico de compras', 'abrirPreviaMovelEscritorio(']);
  const lado = loja.slice(loja.indexOf('function escritorioLojaLadoV2Html('));
  naOrdem(lado, ['Como ganhar mais', 'Preços e raridades', 'Meu perfil', 'proposta de troca', 'Ver a troca', "responderTrocaEscritorio('", 'Guarda-roupa', 'abrirTrocaEscritorio()']);
  assert.match(ed, /<i class="ofc-movel-onde">\$\{meu\.noQuarto \? "no quarto" : "guardado"\}<\/i>/);
  assert.match(ed, /item\("todos", "Todos", /);
  guardaCss(cssR('zm-r-b-4-loja.css'), 'zm-r-b-4-loja.css');
});

test('Toolkit: QR, WhatsApp e ROI nas pranchas V2-R, calculando enquanto digita, sem botão de gerar nem calcular', async () => {
  const js = ler('vybe-mundo-ferramentas.js');
  for (const t of ['>Gerar QR</button>', '>Criar link</button>', '>Calcular</button>']) assert.ok(!js.includes(t), `sem ${t}`);
  const abas = js.slice(js.indexOf('  function abaQR() {'), js.indexOf('  function corpoDaAba()'));
  naOrdem(abas, ['Pronto para baixar', 'data-vf="png"', 'data-vf="svg"', 'Pronto para copiar', 'data-vf="copiar"', 'data-vf="qr-do-link"', 'Assim chega no WhatsApp', 'O retorno', ' a Vybe no mês</span>', "tile('Retorno'", 'data-vf="copiar-roi"', 'data-vf="orcamento"']);
  assert.ok(js.includes('data-vf-cor="${c}"'), 'a cor em fichas com o nome');
  for (const t of ['data-vf-ecc=', 'data-vf-conta="qr.texto"', 'data-vf-conta="wa.mensagem"', 'class="vf-previa d3m-r-tk-previa']) assert.ok(abas.includes(t), t);
  assert.match(js, /if \(a === 'orcamento'\)/);
  assert.match(js, /qr: `\$\{nome\} · o código muda enquanto você escreve, sem botão de gerar`/);
  // A conta do ROI é a mesma da proposta (VybeComercialCalculos.roiCampanha): 1.500 ÷ (180 × 35%) = 24 vendas; 40 vendas dão 68%.
  const calc = (await import('node:module')).createRequire(import.meta.url)('../shared/comercial-calculos.js').roiCampanha({ investimento: '1500', ticket: '180', margem: '35', vendas: '40' });
  assert.equal(calc.empate, 24); assert.equal(calc.roi, 68);
  guardaCss(cssR('zm-r-b-5-toolkit.css'), 'zm-r-b-5-toolkit.css');
});

test('Comercial: Metas é a terceira visão do funil (Quadro, Lista, Metas), com a meta da agência e a corrida com a meta de cada pessoa', () => {
  const js = ler('vybe-mundo-comercial.js');
  assert.match(js, /if \(v\.visao === 'metas'\) return metasM\(x\);/);
  assert.match(js, /\[\['quadro', 'Quadro'\], \['lista', 'Lista'\], \['metas', 'Metas'\]\]/);
  assert.match(js, /v\.visao = id === 'lista' \|\| id === 'metas' \? id : 'quadro';/);
  const tela = js.slice(js.indexOf('  function metasM(x) {'), js.indexOf('  function formMetasPessoa() {'));
  naOrdem(tela, ['data-vc-periodo=', 'da agência inteira', 'data-vc="metas">Editar metas', 'Últimos 6 meses', 'Corrida comercial', 'data-vc="metas-pessoa"', 'mp.aviso', "larM('d3m-d-cm-pesa'", '<b>Editar metas</b><span>só os donos</span>', 'Formulário de leads', 'a meta é da agência, a corrida é por pessoa']);
  // Editar é só para donos (editar_pacotes, a mesma regra das metas da agência) e o dinheiro só com val.
  assert.match(tela, /const editaMetas = Boolean\(p\.editar_pacotes && m\?\.config_disponivel !== false\);/);
  assert.match(tela, /const progresso = \(m\?\.progresso \|\| \[\]\)\.filter\(\(y\) => val \|\| y\.tipo !== 'dinheiro'\);/);
  const form = js.slice(js.indexOf('  function formMetasPessoa() {'), js.indexOf('  const d3Tem = (...listas)'));
  assert.match(form, /comercial\(\{ acao: 'metas_pessoa_salvar', mes, aplicar: v\.aplicar,/);
  assert.match(js, /'metas-pessoa': formMetasPessoa,/);
  guardaCss(cssR('zm-r-b-6-metas.css'), 'zm-r-b-6-metas.css');
});

test('Agentes: a fila em lista no vidro, com Cartões | Lista e os filtros por tipo (Todos, Para decidir, Esperando, Achados)', () => {
  const js = ler('vybe-mundo-agentes.js');
  assert.match(js, /const emM = \(\) => st\.vista === 'fila';/);
  assert.match(js, /if \(emM\(\)\) return listaMHtml\(\{ F, dono, lendo \}\);/);
  assert.match(js, /const TIPOS_FILA = \[\['todos', 'Todos'\], \['decidir', 'Para decidir'\], \['esperando', 'Esperando'\], \['achados', 'Achados'\]\];/);
  const lista = js.slice(js.indexOf('  function listaMHtml('), js.indexOf('  function filaMHtml('));
  naOrdem(lista, ["secao('Para decidir'", "secao('Achados urgentes'", "secao('Esperando confirmação'", "secao('Achados para acompanhar'", 'data-vga-tipo-fila=', '<b>Por agente</b>', 'laranjaFilaHtml(F, dono, lendo)', 'centralMHtml()']);
  assert.match(lista, /itemFilaHtml\(it, dono\)/, 'as linhas são as de sempre, com as mesmas rotas de decidir');
  assert.match(js, /if \(b\.dataset\.vgaTipoFila\) \{ st\.tipoFila = b\.dataset\.vgaTipoFila; pintar\(\); return; \}/);
  assert.match(js, /if \(b\.hasAttribute\('data-vga-cartoes'\)\) \{ st\.lista = false; pintar\(\); return; \}/);
  assert.match(js, /data-vga-cartoes aria-pressed="\$\{!st\.lista\}">Cartões<\/button><button type="button" data-vga-lista="1" aria-pressed="\$\{Boolean\(st\.lista\)\}">Lista<\/button>/);
  guardaCss(cssR('zm-r-b-7-agentes.css'), 'zm-r-b-7-agentes.css');
});
