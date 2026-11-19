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
  assert.match(topo, /class="g2-topo vs-topo"><h2>Produção<\/h2><small class="d3s-topo-sub">[^<]+ · \d\d:\d\d<\/small><span class="g2-seg"/);
  for (const s of ['Produção', 'Clientes', 'Comercial', 'RH', 'Finanças']) assert.ok(topo.includes(`>${s}</button>`), s);
  assert.match(topo, /data-setor-ir="setor:producao" aria-pressed="true"/);
  // Direção 3 (quadro D3-VisaoSetor): o atualizar fica só no ícone redondo; a hora vai na dica e ao lado do título.
  assert.match(topo, /class="g2-btn g2-atualizar d3s-atualizar" data-setor-atualizar title="Atualizado \d\d:\d\d" aria-label="Atualizar \(atualizado \d\d:\d\d\)"><svg/);
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

const RESPOSTAS_GESTAO = (u) => (u.includes('aba=inadimplencia') ? { total: 10400, clientes: [{ cliente_nome: 'Cliente B', atraso_mais_antigo: 18 }, { cliente_nome: 'Cliente C', atraso_mais_antigo: 4 }] } : u.includes('aba=financas') ? { resumo: { receita: 1 } } : u.includes('aba=funil') ? { mes: { kpis: { atual: {} }, progresso: [] } } : {});
test('Gestão (prancha V2-M-Gestao): topo no vidro, quatro cartões por área, o laranja do que pesa, a semana e o Abrir', async () => {
  const t = montar({ respostas: RESPOSTAS_GESTAO });
  const destino = t.novo();
  t.ctx.VybeSetor.pintarEm(destino, 'setor:agencia', { ...contexto(numeros()), nome: 'Gestão' });
  assert.match(destino.innerHTML, /class="d3m-d-topo vs-em-topo">.*<h2>Gestão<\/h2>.*data-gestao-aba="performance">Performance.*data-gestao-aba="historico".*data-setor-sub="equipe".*a agência inteira · .* · atualizado às \d\d:\d\d.*data-vs-tipo="mensal".*data-vs-mes.*data-d3m-busca.*data-setor-atualizar.*data-gestao-cheia.*data-gestao-fechar/s);
  await esperar();
  const h = t.parte('.vs-corpo').innerHTML;
  assert.equal(t.parte('.g2-vaga').innerHTML, '', 'o botão do que pesa fica no cartão laranja');
  const ordem = ['d3m-d-g-cartoes', 'aria-label="Produção"', 'aria-label="Finanças, só donos"', 'aria-label="Clientes"', 'aria-label="Comercial"', 'd3m-d-g-lado', 'd3m-laranja', 'd3m-d-g-semana', 'd3m-d-g-abrir', '<details class="g2-mais"'].map((c) => h.indexOf(c));
  assert.ok(ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1])), ordem.join(','));
  // Produção: o número abre as atrasadas (a conta fica na dica) e cada linha leva à lista dela.
  assert.match(h, /data-espiar="atrasadas" title="Atrasada: a data do cliente[^"]*" class="d3m-d-numero r">3<\/button><span>peças atrasadas<\/span>/);
  assert.match(h, /data-espiar="alerta:1" class="d3m-d-lin"><i class="r"><\/i><span>3 de 4 prontas para hoje<\/span><small>vão ao ar hoje<\/small>/);
  assert.match(h, /data-espiar="emRisco" class="d3m-d-lin"><i class="a"><\/i><span>2 com risco de furo<\/span><small>em 2 dias<\/small>/);
  assert.match(h, /data-gestao-aba="performance">ver por etapa/);
  // Finanças (só donos): o que está em atraso, com os dias, leva ao setor.
  assert.match(h, /<h3>Finanças <small>· só donos<\/small><\/h3>.*?data-setor-ir="setor:financas">abrir Finanças/s);
  assert.match(h, /data-setor-ir="setor:financas" class="d3m-d-lin"><i class="r"><\/i><span>R\$ 10,4 mil em atraso<\/span><small>há 18 dias<\/small>/);
  // Clientes e Comercial
  assert.match(h, /data-espiar="alerta:3" class="d3m-d-lin"><i class="a"><\/i><span>Cliente D sem conteúdo<\/span><small>nesta semana<\/small>/);
  assert.match(h, /data-setor-sub="funil" class="d3m-d-lin"><i class="a"><\/i><span>Nenhuma meta definida<\/span>.*?data-setor-sub="funil">definir metas|data-setor-sub="funil">definir metas.*?<span>Nenhuma meta definida<\/span>/s);
  // O laranja: o número, a frase e os dois botões.
  assert.match(h, /VYBES · onde pesa agora<\/span>\s*<div class="d3m-lar-txt"><b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">vai ao ar hoje sem estar pronta<\/span><small>É a Produção\. Mais 3 áreas pedem ação\.<\/small>/);
  assert.match(h, /<button type="button" class="d3m-btn l" data-espiar="alerta:1">Abrir a de hoje<\/button><button type="button" class="d3m-btn l s" data-gestao-aba="performance">Ver por etapa<\/button>/);
  // Esta semana em linha, com hoje marcado, e o Abrir.
  assert.match(h, /data-gestao-aba="semana" title="Ver a semana"><svg class="d3m-d-g-sem-graf"[^>]*><path class="meta" d="[^"]+"\/><path class="fio" d="[^"]+"\/><circle/, 'prontas e previstas em linha');
  assert.match(h, /<span class="on">qui<\/span>/, 'hoje marcado no eixo');
  assert.match(h, /<b>4 \/ 10<\/b><small>na semana<\/small>.*<b>8<\/b><small>semana que vem<\/small>/s);
  assert.match(h, /aria-label="Abrir">.*data-gestao-aba="performance".*data-gestao-aba="historico".*data-g2-mais.*data-gestao-aba="time"><span><b>Time e bots<\/b> <small>· 0 online<\/small>/s);
  const resto = h.slice(h.indexOf('<details class="g2-mais">'));
  for (const b of ['Entregas por semana', 'Clientes prioritários', 'Carga do time']) assert.ok(resto.includes(b), `${b} continua a um clique`);
});

test('Gestão para quem não é dono (ou no "ver como"): sem o cartão de Finanças, sem valor e sem pedir dinheiro ao servidor', async () => {
  const pedidos = [];
  const t = montar({ respostas: (u) => { pedidos.push(u); return RESPOSTAS_GESTAO(u); } });
  t.ctx.VybeSetor.pintarEm(t.novo(), 'setor:agencia', { ...contexto(numeros()), nome: 'Gestão', dinheiro: () => false }); await esperar();
  const h = t.parte('.vs-corpo').innerHTML;
  assert.match(h, /<div class="g2 d3m-d-g sem-fin">/);
  assert.doesNotMatch(h, /aria-label="Finanças|abrir Finanças|R\$/, 'nenhum valor na tela');
  assert.match(h, /aria-label="Produção".*aria-label="Clientes".*aria-label="Comercial"/s);
  assert.match(h, /<b>Números e gráficos<\/b> <small>· entregas, clientes e time<\/small>/);
  assert.deepEqual(pedidos.filter((u) => /area=financeiro|aba=financas|aba=recebimentos|aba=inadimplencia/.test(u)), [], 'dinheiro nem é pedido');
});

test('Gestão sem dado e sem alerta: o laranja diz que nada atrasou e os cartões dizem o que falta', async () => {
  const N = { ...numeros(), alertas: [], hoje: { dia: '2026-11-12', atrasadas: 0, emRisco: 0, faltam: 0, lista: {} }, cobertura: { clientesAtivos: 5 }, clientes: [] };
  let t = montar();
  t.ctx.VybeSetor.pintarEm(t.novo(), 'setor:agencia', { ...contexto(N), nome: 'Gestão' }); await esperar();
  let h = t.parte('.vs-corpo').innerHTML;
  assert.match(h, /<div class="d3m-lar-txt"><span class="d3-acao-frase">Nada atrasado agora\.<\/span><small>2 áreas pedem ação nos cartões ao lado\.<\/small>\s*<div class="d3m-lar-bts"><button type="button" class="d3m-btn l s"/, 'sem atrasada, sem número e sem o botão de abrir');
  assert.match(h, /class="d3m-d-numero g">0<\/b><span>nenhuma peça atrasada<\/span>/);
  assert.match(h, /class="d3m-d-numero">—<\/b><span>sem extrato no mês<\/span>/);
  assert.match(h, /<span>Nenhuma com risco de furo<\/span>/);
  assert.equal(t.parte('.g2-vaga').innerHTML, '');
  t = montar({ respostas: (u) => (u.includes('aba=financas') ? { resumo: { receita: 1 } } : u.includes('aba=funil') ? { mes: { kpis: { atual: {} }, progresso: [{ nome: 'Negócios', meta: 2, realizado: 2, batida: true, percentual: 100 }] } } : {}) });
  t.ctx.VybeSetor.pintarEm(t.novo(), 'setor:agencia', { ...contexto(N), nome: 'Gestão' }); await esperar();
  h = t.parte('.vs-corpo').innerHTML;
  assert.match(h, /Nenhuma área pede ação agora\./);
  assert.match(h, /<i class="g"><\/i><span>1 de 1 meta batida<\/span>/);
});

// Direção V2 (prancha V2-M-Performance, 16/11/2026): o esqueleto novo na casca do grupo E. As peças de estado e o topo
// moram em vybe-core.js; a tela guarda as escolhas (etapa do pé, todas as etapas, painel ou tabelas) em VybePerformance.escolher.
const comPecasE = (t) => {
  const core = ler('vybe-core.js'), k0 = core.indexOf('const D3ME_IC'), k1 = core.indexOf('// Confirmação (família 5)', k0);
  assert.ok(k0 >= 0 && k1 > k0, 'peças do grupo E em vybe-core.js');
  vm.runInContext(core.slice(k0, k1), t.ctx);
  return t;
};
test('Performance (prancha V2-M-Performance): topo no vidro, quatro números, a fila por etapa, pede ação, entregas e o laranja do Heitor', () => {
  const hoje = '2026-11-12';
  const peca = (id, o) => ({ id, nome: 'Peça ' + id, cliente: 'Cliente A', clientes: ['Cliente A'], grupo: 'Criação', formato: 'Reels', responsavel: '', status: 'A Fazer', veiculacao_iso: '2026-11-20', criado_em: '2026-11-01', ...o });
  const DADOS_ALL = [peca('1', { veiculacao_iso: '2026-11-06' }), peca('2', { veiculacao_iso: '2026-11-10', cliente: 'Cliente B', clientes: ['Cliente B'] }), peca('3', { responsavel: 'Bia', status: 'Alteração' }), peca('4', {})];
  const t = comPecasE(montar({ extra: { DADOS_ALL, DADOS_DEMANDAS: [], hojeDeVerdade: () => hoje } }));
  const P = t.ctx.VybePerformance.calcular({ demandas: DADOS_ALL, hoje, dias: 30 });
  const etapa = JSON.parse(JSON.stringify(P.etapas.find((e) => e.status === 'A Fazer')));
  assert.deepEqual(etapa.idsAtrasadas, ['1', '2']);
  assert.deepEqual(etapa.atrasadasPorCliente, [{ cliente: 'Cliente A', qtd: 1, dias: 6 }, { cliente: 'Cliente B', qtd: 1, dias: 2 }]);
  const alvo = t.novo();
  t.ctx.VybePerformance.html(alvo);
  let h = alvo.innerHTML;
  // A casca: a tela, o título com a seta das telas da Gestão, o período, a busca e "Como funciona".
  assert.match(h, /^<div class="d3m-e-tela d3m-e-perf" data-vista="painel"><div class="d3m-e-topo">/);
  assert.match(h, /d3mETroca\(this,'gestao','performance'\)/, 'a seta do título troca de tela dentro da Gestão');
  assert.match(h, /<span class="d3m-e-h" role="heading" aria-level="2">Performance<\/span>/);
  assert.match(h, /<span class="d3m-e-sub">a operação inteira · últimos 30 dias · atualizado às \d\d:\d\d<\/span>/);
  assert.match(h, /<span class="d3m-e-per vv-perf-periodo" role="group" aria-label="Período">.*?data-perf-dias="30" aria-pressed="true">30 dias</s);
  assert.match(h, /<button type="button" class="d3m-e-ico" data-perf-busca aria-label="Buscar"/);
  assert.match(h, /<details class="d3m-e-troca d3m-e-ajuda"><summary class="d3m-e-ico" aria-label="Como funciona"/);
  // Os quatro números, cada um abrindo a lista por trás dele.
  for (const r of ['Abertas', 'Atrasadas', 'Em alteração', 'Sem responsável']) assert.ok(h.includes(`<span class="d3m-e-kpi-topo"><span>${r}</span>`), r);
  assert.match(h, /data-espiar="perf:total\|atrasadas" title="Ver as peças" class="d3m-e-kpi r">.*?<b class="d3m-e-kpi-v">2<\/b><small class="d3m-e-kpi-sub">50% da fila<\/small>.*?<svg class="d3m-e-anel"/s);
  assert.match(h, /data-espiar="perf:proc\|semResponsavel" title="Ver as peças" class="d3m-e-kpi r">.*?<b class="d3m-e-kpi-v">3<small class="d3m-e-kpi-de"> \/ 4<\/small><\/b>/s);
  // O laranja do Heitor: a maior parte sem dono, então o gargalo é a distribuição; a frase inteira fica na dica.
  assert.match(h, /<section class="d3m-laranja d3m-e-perf-lar" aria-label="O que pede ação agora" title="O gargalo é a distribuição, não a etapa: 3 das 4 peças abertas estão sem responsável e 2 já passaram da data\. Nada saiu em 30 dias[^"]*">/);
  assert.match(h, /<span>Heitor · distribuição<\/span>.*?<b class="d3m-lar-num">3<\/b><span class="d3-acao-frase">peças sem responsável<\/span><small class="d3m-lar-sub">O gargalo é a distribuição, não a etapa\. 2 já passaram da data\.<\/small>/s);
  assert.match(h, /<button type="button" class="d3m-btn l" data-espiar="perf:proc\|semResponsavel">Distribuir as 3<\/button><button type="button" class="d3m-btn l s" data-perf-vista="tabelas" data-perf-foco="clientes">Ver por cliente<\/button>/);
  // Pede ação: o vermelho primeiro, cada linha com o botão de fio; os zerados no pé (três e o "+N").
  assert.match(h, /<b class="d3m-e-pd-n r">3<\/b><span class="d3m-e-pd-txt"><b>Sem responsável<\/b> <span>· ninguém vai fazer<\/span><\/span><button type="button" class="d3v-btn s d3m-e-fio" data-espiar="perf:proc\|semResponsavel">Ver quais<\/button>/);
  assert.match(h, /<b>Atrasadas<\/b> <span>· 2 em A Fazer<\/span><\/span><button type="button" class="d3v-btn s d3m-e-fio" data-espiar="perf:total\|atrasadas">Abrir as 2</);
  assert.match(h, /<div class="d3m-e-pd-zer" aria-label="Zerados"><span class="d3m-e-pd-zer-rot">Zerados<\/span><span class="d3m-e-pd-z"[^>]*><b>0<\/b><small class="d3m-e-pd-z-rot">sem briefing<\/small><\/span><span class="d3m-e-pd-z"[^>]*><b>0<\/b><small class="d3m-e-pd-z-rot">sem data<\/small>/);
  assert.match(h, /<span class="d3m-e-pd-z mais larga" title="Também zerados: [^"]*solicitações vencidas[^"]*">\+4<\/span><span class="d3m-e-pd-z mais curta"[^>]*>\+5<\/span>/);
  // Entregas: sem entrega no período, o estado vazio (a peça de estados) e o atalho do outro período.
  assert.match(h, /<section class="d3m-e-folha d3m-e-perf-ent" aria-label="Entregas por semana">.*?data-perf-dias="90">ver 3 meses<\/button>.*?<div class="d3m-e-estado d3m-e-estado-vazio grande"[^>]*>.*?<b>Nenhuma entrega registrada em 30 dias<\/b>/s);
  assert.doesNotMatch(h, /d3m-e-ent-pe/, 'sem entrega, sem o pé dos três números');
  // Onde a fila está: o número abre as peças, "N atrasadas" escolhe a etapa do pé e o pé traz as atrasadas por cliente.
  assert.match(h, /<section class="d3m-e-folha d3m-e-perf-fila" aria-label="Onde a fila está">.*?<span class="d3v-st" title="A Fazer"><i aria-hidden="true"><\/i>A Fazer<\/span>.*?data-espiar="perf:etapa\|A Fazer" title="Ver as peças">3<\/button><button type="button" class="d3m-e-fx-at" data-perf-etapa="A Fazer" aria-pressed="true" title="Ver por cliente">2 atrasadas<\/button>/s);
  assert.match(h, /<span class="d3m-e-fx-at calmo">em dia<\/span>/, 'etapa sem atraso');
  assert.match(h, /<div class="d3m-e-fx-pe"><span class="d3m-e-fx-pe-rot"[^>]*>Em A Fazer, por cliente[^<]*<\/span><span class="d3m-e-fx-cli"><i class="d3v-foto" aria-hidden="true">CA<\/i><b>Cliente A<\/b><span>1, a mais antiga há 6 dias<\/span><\/span>.*?<b>Cliente B<\/b><span>1<\/span>/s);
  assert.match(h, /<button type="button" class="d3m-e-elo" data-espiar="perf:etapaAtr\|A Fazer">abrir as 2<\/button>/);
  // A consulta no vidro: as outras abas da Gestão, as tabelas e a Produtividade do RH.
  for (const aba of ['agencia', 'agora', 'semana', 'clientes', 'time', 'historico']) assert.ok(h.includes(`<button type="button" class="d3m-vlin" data-gestao-aba="${aba}">`), aba);
  assert.match(h, /<button type="button" class="d3m-vlin" data-perf-vista="tabelas"><span><b>Tabelas<\/b> · departamento, formato, pessoa e cliente<\/span>/);
  assert.match(h, /<button type="button" class="d3m-vlin" data-perf-ir="produtividade"><span><b>Produtividade<\/b> · fica em Recursos Humanos<\/span>/);
  assert.equal(t.ctx.VybeEspiarProvedores.perf('etapaAtr|A Fazer').itens.length, 2, 'a lista por trás das atrasadas da etapa');
  // As tabelas por departamento, formato, pessoa e cliente continuam a um clique, numa folha só, com o voltar.
  t.ctx.VybePerformance.escolher({ vista: 'tabelas', foco: 'clientes' });
  t.ctx.VybePerformance.html(alvo);
  h = alvo.innerHTML;
  assert.match(h, /<div class="d3m-e-tela d3m-e-perf" data-vista="tabelas">.*?<div class="d3m-e-corpo um">.*?<section class="d3m-e-folha cresce d3m-e-perf-tabelas" aria-label="Tabelas">.*?data-perf-vista="painel">.*?Voltar para o painel<\/button>/s);
  for (const b of ['Por departamento', 'Por formato', 'Departamentos', 'Operacionais', 'Clientes']) assert.ok(h.includes(b), `${b} continua a um clique`);
  assert.ok(h.indexOf('os com mais atrasos primeiro') < h.indexOf('Por departamento'), '"Ver por cliente" abre com a tabela dos clientes em cima');
  assert.match(h, /data-espiar="perf:clientes\|atrasadas\|Cliente A"/, 'o número da tabela abre as peças');
  t.ctx.VybePerformance.escolher({ vista: 'painel' });
});

test('Performance: com entregas, o gráfico em linha e os três números no pé; sem a conta, o esqueleto parado', () => {
  const hoje = '2026-11-12';
  const peca = (id, o) => ({ id, nome: 'Peça ' + id, cliente: 'Cliente A', clientes: ['Cliente A'], grupo: 'Criação', formato: 'Reels', responsavel: 'Bia', status: 'Em Andamento', veiculacao_iso: '2026-11-20', criado_em: '2026-11-01', ...o });
  const DADOS_ALL = [peca('1', { status: 'Finalizado', status_updated_at: '2026-11-10T12:00:00Z', veiculacao_iso: '2026-11-11' }), peca('2', { status: 'Finalizado', status_updated_at: '2026-11-03T12:00:00Z', veiculacao_iso: '2026-11-02' }), peca('3', {}), peca('4', { status: 'Pode Fazer', veiculacao_iso: '2026-11-05' })];
  const t = comPecasE(montar({ extra: { DADOS_ALL, DADOS_DEMANDAS: [], hojeDeVerdade: () => hoje } }));
  const alvo = t.novo();
  t.ctx.VybePerformance.html(alvo);
  const h = alvo.innerHTML;
  assert.match(h, /<div class="d3m-e-ent-graf"><svg class="d3-graf d3g-graf"/, 'o gráfico em linha das entregas');
  assert.match(h, /<div class="d3m-e-pd-zer d3m-e-ent-pe" aria-label="Entregas no período">.*?data-espiar="perf:total\|entregues" title="Ver as peças">2<\/button><small class="d3m-e-pd-z-rot">entregues<\/small>.*?title="No prazo do cliente: 1 no prazo · 1 depois da data"><b>50%<\/b><small class="d3m-e-pd-z-rot">no prazo<\/small>.*?<small class="d3m-e-pd-z-rot">até a entrega<\/small>/s);
  // Todos com dono: o laranja mostra a etapa onde a fila trava e abre as atrasadas.
  assert.match(h, /<span>Heitor · onde trava<\/span>.*?<b class="d3m-lar-num">1<\/b><span class="d3-acao-frase">peça parada em [^<]+<\/span>.*?data-espiar="perf:total\|atrasadas">Abrir a atrasada<\/button>/s);
  assert.match(h, /<b class="d3m-e-kpi-v">0<small class="d3m-e-kpi-de"> \/ 2<\/small><\/b><small class="d3m-e-kpi-sub">todas com dono<\/small>/);
  // A etapa escolhida vale entre um desenho e outro (a Gestão redesenha a cada minuto).
  t.ctx.VybePerformance.escolher({ etapa: 'Pode Fazer', todas: true });
  t.ctx.VybePerformance.html(alvo);
  assert.match(alvo.innerHTML, /data-perf-etapa="Pode Fazer" aria-pressed="true"/);
  t.ctx.VybePerformance.escolher({ etapa: '', todas: false });
  // Sem a função da situação da peça (a produção ainda carregando): o esqueleto da tela, sem rodinha.
  const semConta = comPecasE(montar({ extra: { DADOS_ALL: [], DADOS_DEMANDAS: [] } }));
  vm.runInContext('delete this.VybeDono', semConta.ctx); delete semConta.ctx.VybeDono;
  const vazio = semConta.novo();
  semConta.ctx.VybePerformance.html(vazio);
  assert.match(vazio.innerHTML, /^<div class="d3m-e-tela d3m-e-perf" aria-busy="true">.*?d3m-e-estado-carregando/s);
});

test('Performance: o CSS da tela é um fragmento só do grupo E, com tokens, sem !important e sem html body.mundo', () => {
  const css = ler('padrao-v2/zm-e-performance.css'), casca = ler('padrao-v2/zm-e-casca.css');
  assert.doesNotMatch(css, /!important|html body\.mundo|#[0-9A-Fa-f]{3,8}\b|:has\([^)]*\[style/);
  assert.doesNotMatch(css.replace(/box-shadow:[^;}]*/g, ''), /rgba?\(/, 'rgba só em sombra');
  assert.match(css, /body\.mundo :is\(\.vv-gestao,#vv-gestao\):has\(> \.vv-perf\)\{[^}]*background:var\(--d3-fume\)/, 'a camada da Gestão vira vidro fumê só com a Performance');
  for (const sel of ['.d3m-e-fx-lin', '.d3m-e-fx-pe', '.d3m-e-par', '.d3m-e-pd-lin', '.d3m-e-pd-zer', '.d3m-e-ent-graf', '.d3m-e-perf-lar']) assert.ok(css.includes(sel), sel);
  for (const sel of ['.d3m-e-per', '.d3m-e-kpis', '.d3m-e-kpi', '.d3m-e-anel', '.d3m-e-elo', '.d3v-btn.d3m-e-fio', '.d3m-e-ajuda']) assert.ok(casca.includes(sel), sel);
  assert.match(css, /@media \(max-width:900px\)/);
  assert.ok(ler('vybe-mundo-padrao-v2.css').includes('.d3m-e-perf-fila'), 'o fragmento entra na folha junta');
});

test('CSS do grupo: um arquivo só, sem !important e sem html body.mundo', () => {
  const css = ler('padrao-v2/gestao.css');
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  for (const sel of ['.g2-topo', '.g2-fala', '.g2-tres', '.g2-pill.r', '.g2-mods-grade', '.g2-fx', '.g2-dia', '.g2-abrir', '.g2-mais']) assert.ok(css.includes(sel), sel);
  assert.match(css, /\.g2-btn\.p\{background:#C2490C/);
  assert.match(css, /\.g2-card\{[^}]*border-radius:20px;background:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(ler('vybe-mundo-setor.js') + ler('vybe-mundo-performance.js'), /<button(?! type="button")/, 'todo botão com type');
});
