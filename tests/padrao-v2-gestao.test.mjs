// Padrão v2 (moodboard aprovado em 12/11/2026): Gestão, Performance e Visão do setor pelos quadros "depois".
// SAFE: vm com DOM de mentira e fetch dublê; nada grava nem envia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8');
const esperar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 1)); };
function montar({ respostas = () => ({}), extra = {} } = {}) {
  const partes = new Map();
  const parte = (sel) => { if (!partes.has(sel)) partes.set(sel, { innerHTML: '', remove() {} }); return partes.get(sel); };
  const novo = () => ({ hidden: true, innerHTML: '', className: '', scrollTop: 0, dataset: {}, isConnected: true, setAttribute() {}, addEventListener() {}, querySelector: parte });
  const el = novo();
  const ctx = { console, Intl, Date, Math, JSON, Object, Array, String, Number, Promise, Error, Set, Map, URL, localStorage: { getItem: () => null, setItem() {} },
    document: { createElement: () => el, body: { append() {}, classList: { add() {}, remove() {} } }, querySelector: () => null },
    fetch: async (url) => ({ ok: true, status: 200, json: async () => respostas(String(url)) }), ...extra };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(ler('vybe-dono-metricas.js'), ctx);
  vm.runInContext(ler('vybe-mundo-setor.js'), ctx);
  vm.runInContext(ler('vybe-mundo-performance.js'), ctx);
  return { ctx, el, parte, novo };
}
const numeros = () => ({
  geradoEm: '2026-11-12T12:00:00Z',
  hoje: { dia: '2026-11-12', atrasadas: 3, furos: 3, prazoInternoVencido: 0, emRisco: 2, faltam: 1, previstas: 4, lista: { atrasadas: [{ id: '7', nome: 'Card A', cliente: 'Cliente A', veiculacao_iso: '2026-11-02' }] } },
  semana: { previstas: 10, previstasEntregues: 4, entregues: 4, porDia: [{ dia: '2026-11-09', previstas: 4, entregues: 2 }, { dia: '2026-11-12', previstas: 3, entregues: 0 }, { dia: '2026-11-14', previstas: 0, entregues: 0 }] },
  historico: { mediaNoPrazoPct: null, medianaEntregues: 0, semanas: [] }, projecao: { proximaSemana: { previstas: 8, capacidadeMediana: 0 } },
  cobertura: { meta: 3, clientesAtivos: 5, semConteudo: ['Cliente D'], semPlanejamento: [] }, time: [{ pessoa: 'Bia', abertas: 6, atrasadas: 2, emRisco: 1 }], clientes: [{ cliente: 'Cliente A', saude: 'critico', atrasadas: 3, emRisco: 0 }], gargalos: [{ status: 'Alteração', qtd: 5, idadeMedianaDias: 3 }],
  alertas: [
    { nivel: 1, texto: '3 peças furando a data do cliente (veiculação vencida): Card A, Card B', ref: { tipo: 'pecas', ids: ['7', '8', '9'] } },
    { nivel: 2, texto: '1 peça vai ao ar hoje sem estar pronta: Card C', ref: { tipo: 'pecas', ids: ['10'] } },
    { nivel: 2, texto: '2 peças com risco de furo nos próximos 2 dias: Card D, Card E', ref: { tipo: 'pecas', ids: ['11', '12'] } },
    { nivel: 2, texto: '1 cliente sem nenhum conteúdo nesta semana: Cliente D', ref: { tipo: 'clientes', nomes: ['Cliente D'] } },
    { nivel: 4, texto: '2 peças esperando o cliente (aprovação ou informação): Card F, Card G', ref: { tipo: 'pecas', ids: ['13', '14'] } },
  ],
});
const SUBS = [{ id: 'gestor', nome: 'Painel de trabalho' }, { id: 'tarefas', nome: 'Minhas tarefas' }, { id: 'conteudo', nome: 'Aprovação de conteúdo' }, { id: 'impressoes', nome: 'Impressões' }];
const contexto = (N) => ({ nome: 'Produção', subs: SUBS, numeros: () => N, fila: () => ({ itens: [] }), agenda: () => [{ dia: '2026-11-13' }], abrirSub() {}, irSetor() {}, aoFechar() {} });

test('Visão do setor: cabeçalho do quadro (setores em fichas, Atualizado e um botão cheio) e o molde na ordem', async () => {
  const t = montar();
  t.ctx.VybeSetor.abrir('setor:producao', contexto(numeros()));
  const topo = t.el.innerHTML;
  assert.match(topo, /class="g2-topo vs-topo"><h2>Produção<\/h2><span class="g2-seg"/);
  for (const s of ['Produção', 'Clientes', 'Comercial', 'RH', 'Finanças']) assert.ok(topo.includes(`>${s}</button>`), s);
  assert.match(topo, /data-setor-ir="setor:producao" aria-pressed="true"/);
  assert.match(topo, /data-setor-atualizar title="Atualizar">.*Atualizado \d\d:\d\d<\/button>/s);
  assert.doesNotMatch(topo, /vs-atalhos|vv-cb-kicker/, 'sem o rótulo e sem as abas de cima');
  await esperar();
  const h = t.parte('.vs-corpo').innerHTML;
  // Direção 3 (quadro D3-VisaoSetor): o botão do que pede ação mora no bloco laranja do Heitor, não no cabeçalho.
  assert.equal(t.parte('.g2-vaga').innerHTML, '', 'o topo não tem botão cheio');
  assert.match(h, /class="d3-acao d3s-acao"[^>]*>.*Heitor · Coordenação<\/small><span class="d3s-frase">3 passaram da data do cliente\. Alteração segura 5\.<\/span><\/span><button type="button" class="d3-acao-btn" data-espiar="atrasadas">Resolver as 3<\/button>/s);
  const ordem = ['d3s-acao', 'd3s-nums', 'd3s-pede', 'd3s-pessoas', 'd3s-status', 'd3s-mods', '<details class="g2-mais"'].map((c) => h.indexOf(c));
  assert.ok(ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1])), 'bloco de ação, quatro números, pede ação, pessoas, status, módulos e o resto em mostrar');
  assert.equal((h.match(/class="d3-num d3s-num/g) || []).length, 4, 'quatro números');
  assert.match(h, /Prontas da semana<\/span><b class="d3-num-v">4<small> \/ 10<\/small><\/b><span class="d3-barra" style="--v:40%">/);
  assert.match(h, /title="Atrasada: a data do cliente/, 'a conta que a fala abria fica na dica do número');
  assert.match(h, /<span class="d3s-pill r">3<\/span><button type="button" class="d3s-lin-txt" data-g2-abre aria-expanded="true" title="Peças furando a data do cliente">Furando a data<\/button>/, 'a primeira linha já abre no lugar');
  assert.match(h, /Card A, ia ao ar em 02\/11/);
  assert.match(h, /<span class="d3s-pill r">Hoje<\/span>.*?data-vs-peca="10">Abrir a peça/s);
  assert.match(h, /<span class="d3s-pill a">2 dias<\/span><button[^>]*><b>2<\/b> com risco de furo<\/button>/);
  assert.match(h, /data-espiar="alerta:4">Cobrar/, 'esperando o cliente continua com o Cobrar');
  for (const v of ['Por semana', 'Onde trava', 'Cobertura', 'Agenda']) assert.match(h, new RegExp(`class="d3s-chip" data-g2-mais>${v}<`), v);
  assert.match(h, /<b>Bia<\/b><small>2 atrasadas<\/small>/, 'pessoas e carga com as atrasadas de cada um');
  assert.match(h, /data-setor-sub="conteudo" title="[^"]*"><span>Aprovação<\/span><b class="">0<\/b>/);
  assert.match(h, /data-setor-sub="impressoes" title="[^"]*"><span>Impressões<\/span><b class=""><\/b>/, 'módulo sem número na tela não ganha número inventado');
  assert.match(h, /data-g2-mais title="[^"]*"><span>Carga do time<\/span><b class="">6<\/b>/);
  const resto = h.slice(h.indexOf('<details class="g2-mais">'));
  for (const b of ['Entregas por semana', 'Carga do time', 'Onde trava', 'Clientes com atraso', 'Cobertura da semana', 'Próximos compromissos']) assert.ok(resto.includes(b), `${b} continua a um clique`);
});

test('Gestão (quadro D3-Gestao): bloco de ação curto, quatro números, Por setor com o Abrir no pé e Esta semana em linha', async () => {
  const t = montar({ respostas: (u) => (u.includes('aba=inadimplencia') ? { total: 10400, clientes: [{ cliente_nome: 'Cliente B', atraso_mais_antigo: 18 }, { cliente_nome: 'Cliente C', atraso_mais_antigo: 4 }] } : u.includes('aba=financas') ? { resumo: { receita: 1 } } : u.includes('aba=funil') ? { mes: { kpis: { atual: {} }, progresso: [] } } : {}) });
  const destino = t.novo();
  t.ctx.VybeSetor.pintarEm(destino, 'setor:agencia', { ...contexto(numeros()), nome: 'Gestão' });
  assert.match(destino.innerHTML, /<h2>A agência inteira<\/h2>.*data-vs-tipo="mensal".*data-vs-mes.*Atualizado \d\d:\d\d/s);
  await esperar();
  const h = t.parte('.vs-corpo').innerHTML;
  assert.equal(t.parte('.g2-vaga').innerHTML, '', 'o botão sai do topo e vai para o bloco laranja');
  assert.match(h, /<span class="d3-acao-frase">Produção pesa: 1 vai ao ar hoje sem estar pronta\.<\/span><button type="button" class="d3-acao-btn" data-espiar="alerta:1">Abrir a de hoje<\/button>/);
  const ordem = ['d3-acao', 'd3g-nums', 'd3g-setores', 'd3g-abrir', 'd3g-semana', '<details class="g2-mais"'].map((c) => h.indexOf(c));
  assert.ok(ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1])), ordem.join(','));
  for (const r of ['Atrasadas', 'Vão ao ar hoje', 'Semana · prontas', 'Clientes ativos']) assert.ok(h.includes(`<span class="d3-num-rot">${r}</span>`), r);
  assert.match(h, /title="Atrasada: a data do cliente/, 'a conta da fala antiga fica na dica do número');
  assert.match(h, /Semana · prontas<\/span><b class="d3-num-v">4<small> \/ 10<\/small><\/b><span class="d3-barra" style="--v:40%">/);
  const linhas = [...h.slice(h.indexOf('d3g-setores'), h.indexOf('d3g-abrir')).matchAll(/<b>(Produção|Finanças|Clientes|Comercial)<\/b>/g)].map((m) => m[1]);
  assert.deepEqual(linhas, ['Produção', 'Finanças', 'Clientes', 'Comercial'], 'um setor por linha, o mais grave primeiro');
  assert.match(h, /<span class="d3s-pill r">18 dias<\/span><span class="d3g-set-txt">R\$ 10,4 mil em atraso, de 2 clientes<\/span>.*?data-setor-ir="setor:financas">Abrir Finanças/s);
  assert.match(h, /<span class="d3s-pill a">Sem meta<\/span><span class="d3g-set-txt">nenhuma meta definida para novembro<\/span>.*?data-setor-sub="funil">Definir metas/s);
  assert.match(h, /<span class="d3s-pill n">2 com risco de furo nos próximos 2 dias<\/span>/, 'o detalhe da Produção vira pílula');
  assert.match(h, /data-gestao-aba="performance">Ver por etapa/);
  assert.match(h, /class="d3s-ver d3g-abrir"><span>Abrir<\/span><button type="button" class="d3s-chip r" data-espiar="atrasadas">3 atrasadas<\/button>.*?data-gestao-aba="historico">Histórico e projeção<.*?Negócios por mês<.*?data-setor-sub="equipe">Equipe online · 0</s);
  assert.match(h, /Esta semana<\/h3>.*?<svg class="d3-graf d3g-graf"[^>]*><polyline class="meta" points="[^"]+"\/><polyline points="[^"]+"\/><circle/s, 'prontas e previstas em linha');
  assert.match(h, /<span class="on">qui<\/span>/, 'hoje marcado no eixo');
  assert.match(h, /data-gestao-aba="semana">Ver a semana/);
  assert.doesNotMatch(h, /g2-dia-qt|class="v2-barra g2-barra"><i style="--v:\d+%;--c:#11613A"><\/i><\/div><span class="g2-dia/, 'sem as barras por dia');
  const resto = h.slice(h.indexOf('<details class="g2-mais">'));
  for (const b of ['Entregas por semana', 'Clientes prioritários', 'Carga do time']) assert.ok(resto.includes(b), `${b} continua a um clique`);
});

test('Gestão sem dado e sem alerta: "sem números agora" e "Nada pede ação agora"', async () => {
  const N = { ...numeros(), alertas: [], hoje: { dia: '2026-11-12', atrasadas: 0, emRisco: 0, faltam: 0, lista: {} }, cobertura: { clientesAtivos: 5 }, clientes: [] };
  let t = montar();
  t.ctx.VybeSetor.pintarEm(t.novo(), 'setor:agencia', { ...contexto(N), nome: 'Gestão' }); await esperar();
  assert.match(t.parte('.vs-corpo').innerHTML, /<b>Finanças<\/b><\/span><div class="d3g-set-corpo"><p><span class="d3s-pill n">Sem dado<\/span><span class="d3g-set-txt">sem números agora<\/span>/);
  assert.match(t.parte('.vs-corpo').innerHTML, /<span class="d3-acao-frase">Nada atrasado agora\.<\/span><\/section>/, 'sem atrasada, sem botão');
  assert.equal(t.parte('.g2-vaga').innerHTML, '');
  t = montar({ respostas: (u) => (u.includes('aba=financas') ? { resumo: { receita: 1 } } : u.includes('aba=funil') ? { mes: { kpis: { atual: {} }, progresso: [{ nome: 'Negócios', meta: 2, realizado: 2, batida: true, percentual: 100 }] } } : {}) });
  t.ctx.VybeSetor.pintarEm(t.novo(), 'setor:agencia', { ...contexto(N), nome: 'Gestão' }); await esperar();
  assert.match(t.parte('.vs-corpo').innerHTML, /Nada pede ação agora\./);
});

test('Performance (quadro D3-Performance): bloco do Heitor, quatro números, pede ação, entregas e a fila por etapa', () => {
  const hoje = '2026-11-12';
  const peca = (id, o) => ({ id, nome: 'Peça ' + id, cliente: 'Cliente A', clientes: ['Cliente A'], grupo: 'Criação', formato: 'Reels', responsavel: '', status: 'A Fazer', veiculacao_iso: '2026-11-20', criado_em: '2026-11-01', ...o });
  const DADOS_ALL = [peca('1', { veiculacao_iso: '2026-11-06' }), peca('2', { veiculacao_iso: '2026-11-10', cliente: 'Cliente B', clientes: ['Cliente B'] }), peca('3', { responsavel: 'Bia', status: 'Alteração' }), peca('4', {})];
  const t = montar({ extra: { DADOS_ALL, DADOS_DEMANDAS: [], hojeDeVerdade: () => hoje } });
  const P = t.ctx.VybePerformance.calcular({ demandas: DADOS_ALL, hoje, dias: 30 });
  const etapa = JSON.parse(JSON.stringify(P.etapas.find((e) => e.status === 'A Fazer')));
  assert.deepEqual(etapa.idsAtrasadas, ['1', '2']);
  assert.deepEqual(etapa.atrasadasPorCliente, [{ cliente: 'Cliente A', qtd: 1, dias: 6 }, { cliente: 'Cliente B', qtd: 1, dias: 2 }]);
  const alvo = t.novo();
  t.ctx.VybePerformance.html(alvo);
  const h = alvo.innerHTML;
  assert.match(h, /<h2 title="Performance da operação">Performance<\/h2>.*?data-perf-dias="30" aria-pressed="true">30 dias</s);
  assert.doesNotMatch(h.slice(0, h.indexOf('vs-corpo')), /g2-btn p/, 'o botão do que pede ação sai do topo');
  assert.match(h, /<small class="d3s-quem">Heitor · Coordenação<\/small>O gargalo é dono: 3 peças sem responsável\.<\/span><button type="button" class="d3-acao-btn" data-espiar="perf:proc\|semResponsavel" title="O gargalo é dono, não etapa: 3 das 4 peças abertas estão sem responsável e 2 já passaram da data\. Nada saiu em 30 dias[^"]*">Distribuir as 3<\/button>/);
  for (const r of ['Abertas', 'Atrasadas', 'Em alteração', 'Sem responsável']) assert.ok(h.includes(`<span class="d3-num-rot">${r}</span>`), r);
  assert.match(h, /50% da fila/);
  assert.match(h, /Sem responsável<\/span><b class="d3-num-v">3<small> \/ 4<\/small><\/b><span class="d3-barra" style="--v:75%">/);
  assert.match(h, /<span class="g2-pill r">3<\/span><p class="g2-lin-txt"><b>Sem responsável<\/b> · ninguém vai fazer<\/p>.*?Ver quais são/s);
  assert.match(h, /<b>Atrasadas<\/b> · 2 em A Fazer.*?Abrir as 2</s);
  assert.match(h, /zerados: Solicitações vencidas, Sem briefing, Captação a agendar/);
  assert.match(h, /Nenhuma entrega registrada em 30 dias\. Com entregas, o gráfico/);
  assert.match(h, /No prazo do cliente<\/span><b>sem dado<\/b><span>0 no prazo · 0 depois/);
  assert.match(h, /data-perf-dias="90">Ver 3 meses/);
  assert.match(h, /Onde a fila está.*?data-espiar="perf:etapa\|A Fazer"[^>]*>3<\/button><button type="button" class="g2-fx-at" data-g2-abre aria-expanded="true">2 atrasadas/s);
  assert.match(h, /Cliente A · 1 atrasada, a mais antiga há 6 dias/);
  assert.match(h, /data-espiar="perf:etapaAtr\|A Fazer">abrir as 2/);
  assert.match(h, /data-perf-ir="produtividade">RH › Produtividade/);
  const resto = h.slice(h.indexOf('<details class="g2-mais">'));
  for (const b of ['Por departamento', 'Por formato', 'Departamentos', 'Operacionais', 'Clientes']) assert.ok(resto.includes(b), `${b} continua a um clique`);
  assert.equal(t.ctx.VybeEspiarProvedores.perf('etapaAtr|A Fazer').itens.length, 2, 'a lista por trás das atrasadas da etapa');
});

test('CSS do grupo: um arquivo só, sem !important e sem html body.mundo', () => {
  const css = ler('padrao-v2/gestao.css');
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const sel of ['.g2-topo', '.g2-fala', '.g2-tres', '.g2-pill.r', '.g2-mods-grade', '.g2-fx', '.g2-dia', '.g2-abrir', '.g2-mais']) assert.ok(css.includes(sel), sel);
  assert.match(css, /\.g2-btn\.p\{background:#C2490C/);
  assert.match(css, /\.g2-card\{[^}]*border-radius:20px;background:#FFFFFF/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(ler('vybe-mundo-setor.js') + ler('vybe-mundo-performance.js'), /<button(?! type="button")/, 'todo botão com type');
});
