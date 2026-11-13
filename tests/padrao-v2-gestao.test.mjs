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
  assert.match(t.parte('.g2-vaga').innerHTML, /class="g2-btn p" data-espiar="atrasadas">Resolver as 3<\/button>/, 'um botão cheio, no cabeçalho');
  const ordem = ['g2-fala', 'g2-tres', 'g2-pede', 'g2-mods', '<details class="g2-mais"'].map((c) => h.indexOf(c));
  assert.ok(ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1])), 'frase, três números, pede ação, módulos e o resto em mostrar');
  assert.match(h, /Heitor · Coordenação de produção<\/span><b>3 peças já passaram da data do cliente<\/b> e 1 vai ao ar hoje sem estar pronta\. Da semana, 4 de 10 estão prontas; quem segura a fila é a etapa de Alteração, com 5 paradas\./);
  assert.equal((h.match(/class="g2-card g2-kpi"/g) || []).length, 3, 'três números, não seis');
  assert.match(h, /Prontas da semana<\/small>.*?4<\/span> <em>de 10<\/em>.*?--v:40%/s);
  assert.match(h, /<span class="g2-pill r">3 atrasadas<\/span><button type="button" class="g2-lin-txt" data-g2-abre aria-expanded="true">Peças furando a data do cliente<\/button>/, 'a primeira linha já abre no lugar');
  assert.match(h, /Card A, ia ao ar em 02\/11/);
  assert.match(h, /<span class="g2-pill r">Hoje<\/span>.*?data-vs-peca="10">Abrir a peça/s);
  assert.match(h, /<span class="g2-pill a">2 dias<\/span><button[^>]*><b>2 peças<\/b> com risco de furo<\/button>/);
  assert.match(h, /g2-resto.*?Com o cliente.*?data-espiar="alerta:4">Cobrar.*?\+ 1 · .*?mostrar/s, 'a quinta linha fica em mostrar');
  assert.match(h, /data-setor-sub="conteudo"><small>Aprovação de conteúdo<\/small><span><b>0<\/b>em aprovação/);
  assert.match(h, /data-setor-sub="impressoes"><small>Impressões<\/small><span>abrir<\/span>/, 'módulo sem número na tela não ganha número inventado');
  assert.match(h, /data-g2-mais><small>Carga do time<\/small><span><b>6<\/b>na maior fila/);
  const resto = h.slice(h.indexOf('<details class="g2-mais">'));
  for (const b of ['Entregas por semana', 'Carga do time', 'Onde trava', 'Clientes com atraso', 'Cobertura da semana', 'Próximos compromissos']) assert.ok(resto.includes(b), `${b} continua a um clique`);
});

test('Gestão: a agência por setor, a semana dia a dia e as abas em "Abrir:" no pé', async () => {
  const t = montar({ respostas: (u) => (u.includes('aba=inadimplencia') ? { total: 10400, clientes: [{ cliente_nome: 'Cliente B', atraso_mais_antigo: 18 }, { cliente_nome: 'Cliente C', atraso_mais_antigo: 4 }] } : u.includes('aba=financas') ? { resumo: { receita: 1 } } : u.includes('aba=funil') ? { mes: { kpis: { atual: {} }, progresso: [] } } : {}) });
  const destino = t.novo();
  t.ctx.VybeSetor.pintarEm(destino, 'setor:agencia', { ...contexto(numeros()), nome: 'Gestão' });
  assert.match(destino.innerHTML, /<h2>A agência inteira<\/h2>.*data-vs-tipo="mensal".*data-vs-mes.*Atualizado \d\d:\d\d/s);
  await esperar();
  const h = t.parte('.vs-corpo').innerHTML;
  assert.match(t.parte('.g2-vaga').innerHTML, /Abrir as 3 atrasadas/);
  assert.match(h, /VYBES · Agência inteira<\/span><b>3 peças já passaram da data do cliente<\/b> e, das 10 previstas para a semana, só <b>4 estão prontas<\/b>\. O que pesa hoje é a Produção: 1 vai ao ar sem estar pronta\./);
  assert.match(h, /Ver a conta<\/button>/);
  const linhas = [...h.slice(h.indexOf('g2-pede'), h.indexOf('g2-semana')).matchAll(/<b>(Produção|Finanças|Clientes|Comercial)<\/b>/g)].map((m) => m[1]);
  assert.deepEqual(linhas, ['Produção', 'Finanças', 'Clientes', 'Comercial'], 'um setor por linha, o mais grave primeiro');
  assert.match(h, /<span class="g2-pill r">18 dias<\/span><p class="g2-lin-txt"><b>Finanças<\/b> · R\$ 10,4 mil em atraso, de 2 clientes<\/p>.*?data-setor-ir="setor:financas">Abrir Finanças/s);
  assert.match(h, /<span class="g2-pill a">Sem meta<\/span>.*?nenhuma meta definida para novembro.*?data-setor-sub="funil">Definir metas/s);
  assert.match(h, /data-gestao-aba="performance">Ver por etapa/);
  assert.match(h, /Esta semana<\/h3>.*?<span>Seg<\/span>.*?2 de 4<\/span>.*?<b>Qui<\/b> · hoje.*?g2-dia-qt ruim">0 de 3/s);
  assert.doesNotMatch(h, /<span>Sáb<\/span>/, 'fim de semana só aparece com peça');
  assert.match(h, /<nav class="g2-abrir".*?data-gestao-aba="performance">Performance<.*?data-gestao-aba="historico">Histórico e projeção<.*?Negócios por mês<.*?data-setor-sub="equipe">Equipe online · 0</s);
});

test('Gestão sem dado e sem alerta: "sem números agora" e "Nada pede ação agora"', async () => {
  const N = { ...numeros(), alertas: [], hoje: { dia: '2026-11-12', atrasadas: 0, emRisco: 0, faltam: 0, lista: {} }, cobertura: { clientesAtivos: 5 }, clientes: [] };
  let t = montar();
  t.ctx.VybeSetor.pintarEm(t.novo(), 'setor:agencia', { ...contexto(N), nome: 'Gestão' }); await esperar();
  assert.match(t.parte('.vs-corpo').innerHTML, /<b>Finanças<\/b> · sem números agora/);
  assert.equal(t.parte('.g2-vaga').innerHTML, '', 'sem atrasada, sem botão cheio');
  t = montar({ respostas: (u) => (u.includes('aba=financas') ? { resumo: { receita: 1 } } : u.includes('aba=funil') ? { mes: { kpis: { atual: {} }, progresso: [{ nome: 'Negócios', meta: 2, realizado: 2, batida: true, percentual: 100 }] } } : {}) });
  t.ctx.VybeSetor.pintarEm(t.novo(), 'setor:agencia', { ...contexto(N), nome: 'Gestão' }); await esperar();
  assert.match(t.parte('.vs-corpo').innerHTML, /Nada pede ação agora\./);
});

test('Performance: frase do Heitor, três números, pede ação, entregas e a fila por etapa', () => {
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
  assert.match(h, /<h2>Performance da operação<\/h2>.*?data-perf-dias="30" aria-pressed="true">30 dias<.*?class="g2-btn p" data-espiar="perf:proc\|semResponsavel">Distribuir as 3</s);
  assert.match(h, /Heitor · Coordenação de produção<\/span>O gargalo é dono, não etapa: <b>3 das 4 peças abertas estão sem responsável<\/b> e <b>2 já passaram da data<\/b>\. Nada saiu em 30 dias, então ainda não dá para medir prazo nem tempo de entrega\./);
  assert.equal((h.match(/class="g2-card g2-kpi"/g) || []).length, 3);
  for (const r of ['Abertas agora', 'Atrasadas agora', 'Em alteração']) assert.ok(h.includes(`<small>${r}</small>`), r);
  assert.match(h, /50% da fila/);
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
