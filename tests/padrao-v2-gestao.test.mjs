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
  assert.match(h, /<small class="d3s-quem">Heitor · Coordenação<\/small>O gargalo é a distribuição: 3 peças sem responsável\.<\/span><button type="button" class="d3-acao-btn" data-espiar="perf:proc\|semResponsavel" title="O gargalo é a distribuição, não a etapa: 3 das 4 peças abertas estão sem responsável e 2 já passaram da data\. Nada saiu em 30 dias[^"]*">Distribuir as 3<\/button>/);
  for (const r of ['Abertas', 'Atrasadas', 'Em alteração', 'Sem responsável']) assert.ok(h.includes(`<span class="d3-num-rot">${r}</span>`), r);
  assert.match(h, /50% da fila/);
  assert.match(h, /Sem responsável<\/span><b class="d3-num-v">3<small> \/ 4<\/small><\/b><span class="d3-barra" style="--v:75%">/);
  assert.match(h, /<span class="g2-pill r">3<\/span><p class="g2-lin-txt"><b>Sem responsável<\/b> · ninguém vai fazer<\/p>.*?Ver quais são/s);
  assert.match(h, /<b>Atrasadas<\/b> · 2 em A Fazer.*?Abrir as 2</s);
  // Direção 3 (quadro D3-Performance): os zerados viram pílulas na linha "Zerados".
  assert.match(h, /<div class="g2-zerados" aria-label="Zerados"><span>Zerados<\/span><span class="g2-zero"[^>]*>Solicitações vencidas<\/span><span class="g2-zero"[^>]*>Sem briefing<\/span><span class="g2-zero"[^>]*>Captação a agendar/);
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
