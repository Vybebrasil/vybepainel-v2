import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Motor de números da visão do dono (Paulo, 07/11/2026: os quatro sócios gerem a
// agência pelo Vybe OS). Funções puras: tudo o que as contas leem vem daqui.
const ctx = vm.createContext({ window: {} });
vm.runInContext(readFileSync('vybe-dono-metricas.js', 'utf8'), ctx);
const D = ctx.window.VybeDono;
// O resultado nasce em outro contexto (vm): o JSON deixa os objetos comparáveis.
const calcular = (entrada) => JSON.parse(JSON.stringify(D.calcular(entrada)));
const somar = (iso, n) => D.util.somarDias(iso, n);
// Hora local do dia: o dia da entrega sai o mesmo em qualquer fuso (a CI roda em UTC).
const em = (iso, h = 10) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, h).toISOString(); };

const HOJE = '2026-11-04'; // quarta-feira; semana de 02/11 a 08/11
const CLIENTES = [
  { id: 1, nome: 'Alfa', ativo: true, status: 'Ativo', planejamento_url: 'https://docs.google.com/alfa' },
  { id: 2, nome: 'Beta', ativo: true, status: 'Ativo', planejamento_url: '' },
  { id: 3, nome: 'Gama', ativo: true, status: 'Ativo' },
  { id: 4, nome: 'Inativa', ativo: false, status: 'Inativo' },
  { id: 5, nome: 'Fornecedor', ativo: true, status: 'Ativo', nao_e_cliente: true },
  { id: 6, nome: 'Encerrada', status: 'Inativo' },
];
const PESSOAS = { 10: 'Bia', 20: 'Jady', 30: 'Reriston' };
let seq = 0;
const peca = (o = {}) => ({ id: `p${++seq}`, nome: `Peça ${seq}`, clientes: [o.cliente || 'Alfa'], status: 'A Fazer',
  veiculacao_iso: '', prazo_iso: '', responsavel_ids: [], ...o });

test('hoje: a veiculação diz o que está previsto; feitas no dia, faltam, atrasadas e risco de furo', () => {
  const demandas = [
    peca({ nome: 'Card pronto', status: 'Finalizado', veiculacao_iso: HOJE, status_updated_at: em(HOJE), responsavel_ids: ['10'] }),
    peca({ nome: 'Reels de hoje', status: 'Em andamento', veiculacao_iso: HOJE, prazo_iso: '2026-10-28', status_updated_at: em('2026-11-03'), responsavel_ids: ['10'] }),
    peca({ nome: 'Story agendado', status: 'Agendado', veiculacao_iso: '2026-11-05', status_updated_at: em('2026-11-03') }),
    peca({ nome: 'Pronto agora', status: 'Para agendar', veiculacao_iso: '2026-11-06', status_updated_at: em(HOJE, 15) }),
    peca({ nome: 'Sem agendar', status: 'Para agendar', veiculacao_iso: '2026-11-03', status_updated_at: em('2026-11-01') }),
    peca({ nome: 'Furo da Beta', cliente: 'Beta', status: 'Alteração', veiculacao_iso: '2026-11-02', prazo_iso: '2026-10-27', status_updated_at: em('2026-10-30'), responsavel_ids: ['20'] }),
    peca({ nome: 'Card sem começar', status: 'A Fazer', veiculacao_iso: '2026-11-06', prazo_iso: '2026-11-05', status_updated_at: em('2026-11-01'), responsavel_ids: ['20'] }),
    // O prazo interno é hoje, mas vai ao ar amanhã: não é "prevista hoje". Trocou de etapa
    // hoje e o radar diz que está no prazo: está andando, não é risco.
    peca({ nome: 'Em aprovação', status: 'Para aprovação', veiculacao_iso: '2026-11-05', prazo_iso: HOJE, status_updated_at: em(HOJE), operational_risk: { level: 'safe' } }),
    // Andando também, mas o radar de risco já marcou alto.
    peca({ nome: 'SLA estourado', status: 'Para aprovação', veiculacao_iso: '2026-11-06', status_updated_at: em(HOJE), operational_risk: { level: 'high' } }),
    // Segurar Post não atrasa nem corre risco.
    peca({ nome: 'Segurado', status: 'Segurar Post', veiculacao_iso: HOJE, prazo_iso: '2026-10-20' }),
    // Data de mais de 30 dias: esquecida, fora das atrasadas.
    peca({ nome: 'Velharia', status: 'A Fazer', veiculacao_iso: '2026-09-01', prazo_iso: '2026-08-25' }),
    peca({ nome: 'Peça de cliente inativo', cliente: 'Inativa', status: 'A Fazer', veiculacao_iso: HOJE, prazo_iso: '2026-10-01' }),
  ];
  const r = calcular({ demandas, clientes: CLIENTES, pessoas: PESSOAS, hoje: HOJE });
  const h = r.hoje;
  assert.equal(h.dia, HOJE);
  assert.equal(h.previstas, 3); // Card pronto, Reels de hoje e Segurado
  assert.equal(h.previstasFeitas, 1);
  assert.equal(h.pausadas, 1);
  assert.equal(h.faltam, 1);
  assert.deepEqual(h.lista.faltam.map((p) => p.nome), ['Reels de hoje']);
  // Feita = entregue com a troca de status hoje, qualquer que seja a data da peça.
  // Pronta é só Finalizado (Paulo, 13/11/2026): "Pronto agora" foi para Para agendar hoje e não conta.
  assert.equal(h.feitas, 1);
  assert.deepEqual(h.feitasPorStatus, { Finalizado: 1 });
  // Furo (veiculação vencida) vem antes do prazo interno vencido. Para agendar com a
  // veiculação passada ("Sem agendar") não foi postada: é furo.
  assert.deepEqual(h.lista.atrasadas.map((p) => p.nome), ['Furo da Beta', 'Sem agendar', 'Reels de hoje']);
  assert.equal(h.atrasadas, 3);
  assert.equal(h.furos, 2);
  assert.equal(h.prazoInternoVencido, 1);
  // Agendado e Para agendar com a data pela frente esperam a postagem: nem atrasados nem em risco.
  assert.deepEqual(h.lista.emRisco.map((p) => p.nome), ['Card sem começar', 'SLA estourado']);
  assert.equal(h.emRisco, 2);
  for (const nome of ['Story agendado', 'Pronto agora']) {
    assert.ok(!h.lista.atrasadas.some((p) => p.nome === nome) && !h.lista.emRisco.some((p) => p.nome === nome), nome);
  }
  assert.equal(h.esquecidas, 1);
  assert.deepEqual(h.paraAgendar, { hoje: 0, vencidas: 1, agendadasVencidas: 0 });
  const furo = demandas.find((d) => d.nome === 'Furo da Beta');
  assert.deepEqual(h.lista.atrasadas[0], { id: furo.id, nome: 'Furo da Beta', cliente: 'Beta', status: 'Alteração',
    veiculacao_iso: '2026-11-02', prazo_iso: '2026-10-27', responsavel: 'Jady' });

  // Semana de segunda a domingo, um par por dia.
  assert.equal(r.semana.inicio, '2026-11-02');
  assert.equal(r.semana.fim, '2026-11-08');
  assert.deepEqual(r.semana.porDia.map((d) => d.dia), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(r.semana.porDia.find((d) => d.dia === HOJE), { dia: HOJE, previstas: 3, entregues: 1 });
  assert.equal(r.semana.entregues, 1); // só o Card pronto: Agendado e Para agendar não são entrega
  assert.deepEqual(r.semana.entreguesPorStatus, { Finalizado: 1 });

  // Alertas na escala de urgência, do 1 (crítico) ao 6 (andando).
  assert.ok(r.alertas.every((a, i, l) => !i || l[i - 1].nivel <= a.nivel), 'alertas em ordem de nível');
  assert.equal(r.alertas[0].nivel, 1);
  assert.match(r.alertas[0].texto, /^1 peça furando a data do cliente \(veiculação vencida\): Furo da Beta$/);
  assert.deepEqual(r.alertas[0].ref, { tipo: 'pecas', ids: [furo.id] });
  // O alerta de furo fica sem as que aguardam postar: elas têm o alerta próprio.
  assert.ok(r.alertas.some((a) => a.nivel === 1 && /^1 peça em Para agendar com a veiculação vencida \(não foi postada\): Sem agendar$/.test(a.texto)));
  assert.ok(r.alertas.some((a) => a.nivel === 2 && /^1 peça vai ao ar hoje sem estar pronta: Reels de hoje$/.test(a.texto)));
  assert.ok(r.alertas.some((a) => a.nivel === 2 && /risco de furo nos próximos 2 dias/.test(a.texto)));
  assert.ok(r.alertas.some((a) => a.nivel === 5 && /mais de 30 dias/.test(a.texto)));
  assert.ok(!r.alertas.some((a) => /cliente inativo/.test(a.texto)));
});

test('hoje como Date vale o dia local, inclusive perto da meia-noite', () => {
  const agora = new Date(2026, 10, 4, 23, 30);
  const r = calcular({ demandas: [peca({ veiculacao_iso: HOJE, status: 'Finalizado', status_updated_at: em(HOJE, 23) })], clientes: CLIENTES, hoje: agora });
  assert.equal(r.hoje.dia, HOJE);
  assert.equal(r.geradoEm, agora.toISOString());
  assert.equal(r.hoje.feitas, 1);
  assert.equal(D.util.inicioDaSemana('2026-11-08'), '2026-11-02'); // domingo fecha a semana
  assert.equal(D.util.inicioDaSemana('2026-11-09'), '2026-11-09');
  assert.equal(D.util.inicioDaSemana('2027-01-01'), '2026-12-28'); // virada de ano
});

test('cobertura: 3 posts por cliente na semana, cliente sem conteúdo e planejamento', () => {
  const agendado = (cliente, dia) => peca({ cliente, status: 'Agendado', veiculacao_iso: dia, status_updated_at: em('2026-11-01') });
  const andando = (cliente, dia) => peca({ cliente, status: 'Em andamento', veiculacao_iso: dia, status_updated_at: em(HOJE) });
  const demandas = [
    agendado('Alfa', '2026-11-02'), agendado('Alfa', '2026-11-05'), agendado('Alfa', '2026-11-08'),
    andando('Alfa', '2026-11-10'), andando('Alfa', '2026-11-12'), andando('Alfa', '2026-11-14'),
    agendado('Beta', '2026-11-05'), andando('Beta', '2026-11-12'),
    // Uma peça de dois clientes conta uma vez na agência e uma vez em cada cliente ativo.
    peca({ clientes: ['Beta', 'Inativa'], status: 'Agendado', veiculacao_iso: '2026-11-07', status_updated_at: em('2026-11-01') }),
    // Solicitação não é post.
    peca({ cliente: 'Beta', origem: 'solicitacao', status: 'Feito', veiculacao_iso: '2026-11-06', status_updated_at: em('2026-11-02') }),
    ...['2026-11-03', '2026-11-04', '2026-11-05'].map((d) => agendado('Inativa', d)),
  ];
  const r = calcular({ demandas, clientes: CLIENTES, hoje: HOJE });
  const C = r.cobertura;
  assert.equal(C.meta, 3);
  assert.equal(C.clientesAtivos, 3); // Fornecedor (não é cliente) e as inativas ficam fora
  assert.deepEqual(C.sem3, [{ cliente: 'Gama', qtd: 0 }, { cliente: 'Beta', qtd: 2 }]);
  assert.deepEqual(C.semConteudo, ['Gama']);
  assert.deepEqual(C.proximaSemanaSem3, [{ cliente: 'Gama', qtd: 0 }, { cliente: 'Beta', qtd: 1 }]);
  // Sem lista de planejamentos, vale o link do cadastro, e a fonte diz isso.
  assert.deepEqual(C.semPlanejamento, ['Beta', 'Gama']);
  assert.match(r.fonte.planejamento, /planejamento_url/);
  assert.equal(r.semana.previstas, 6); // 3 da Alfa, 1 da Beta, a de dois clientes e a solicitação

  // Saúde do pior para o melhor. O Agendado da Alfa de 02/11 passou da data sem
  // Finalizado: é furo e a Alfa fica crítica (Paulo, 13/11/2026: pronta é só Finalizado).
  assert.deepEqual(r.clientes.map((c) => [c.cliente, c.saude]), [['Alfa', 'critico'], ['Gama', 'critico'], ['Beta', 'atencao']]);
  const alfa = r.clientes.find((c) => c.cliente === 'Alfa');
  assert.equal(alfa.furos, 1);
  assert.deepEqual(alfa.lista.atrasadas.map((p) => [p.status, p.veiculacao_iso]), [['Agendado', '2026-11-02']]);
  assert.ok(alfa.motivos.includes('1 peça com a veiculação vencida'));
  assert.equal(alfa.semana, 3);
  assert.ok(r.alertas.some((a) => a.nivel === 1 && a.texto === `1 peça agendada com a data passada e sem Finalizado (conferir se saiu): ${demandas[0].nome}`));
  assert.equal(r.hoje.paraAgendar.agendadasVencidas, 1);
  const gama = r.clientes.find((c) => c.cliente === 'Gama');
  assert.ok(gama.motivos.includes('sem conteúdo nesta semana'));
  assert.ok(gama.motivos.includes('sem planejamento'));
  const beta = r.clientes.find((c) => c.cliente === 'Beta');
  assert.equal(beta.semana, 2);
  assert.equal(beta.proximaSemana, 1);
  assert.deepEqual(beta.motivos, ['2/3 posts nesta semana', 'próxima semana 1/3', 'sem planejamento']);
  assert.ok(r.alertas.some((a) => a.nivel === 2 && a.texto === '1 cliente sem nenhum conteúdo nesta semana: Gama'));

  // Com os planejamentos do banco: só conta um não arquivado do mês atual ou seguinte.
  const doBanco = calcular({ demandas, clientes: CLIENTES, hoje: HOJE, planejamentos: [
    { id: '7', cliente_id: '3', cliente: 'Gama', mes: '2026-11-01', estado: 'revisar' },
    { id: '8', cliente_id: '2', cliente: 'Beta', mes: '2026-11-01', estado: 'arquivado' },
    { id: '9', cliente_id: '1', cliente: 'Alfa', mes: '2026-10-01', estado: 'cadastrado' },
  ] });
  assert.deepEqual(doBanco.cobertura.semPlanejamento, ['Alfa', 'Beta']);
  assert.deepEqual(doBanco.clientes.find((c) => c.cliente === 'Gama').planejamento, { mes: '2026-11', estado: 'revisar' });
  assert.match(doBanco.fonte.planejamento, /banco/);
  // Os postos do Centro de Operação (acao=operacao) também servem.
  const postos = calcular({ demandas, clientes: CLIENTES, hoje: HOJE, planejamentos: { ok: true, postos: [
    { cliente_id: '2', cliente: 'Beta', planejamento: { id: '9', cliente_id: '2', mes: '2026-12-01', estado: 'enviado' } },
    { cliente_id: '1', cliente: 'Alfa', planejamento: null },
  ] } });
  assert.deepEqual(postos.cobertura.semPlanejamento, ['Alfa', 'Gama']);
  // Banco sem planejamentos ligados: volta para o link do cadastro.
  const desligado = calcular({ demandas, clientes: CLIENTES, hoje: HOJE, planejamentos: { disponivel: false, planejamentos: [] } });
  assert.deepEqual(desligado.cobertura.semPlanejamento, ['Beta', 'Gama']);
});

test('cliente inativo, "não é cliente" e peça sem cliente ficam fora de tudo', () => {
  const demandas = [
    peca({ cliente: 'Inativa', status: 'A Fazer', veiculacao_iso: '2026-11-02', prazo_iso: '2026-10-30', responsavel_ids: ['10'] }),
    peca({ cliente: 'Fornecedor', status: 'Alteração', veiculacao_iso: HOJE, responsavel_ids: ['10'] }),
    peca({ cliente: 'Encerrada', status: 'A Fazer', veiculacao_iso: HOJE }),
    peca({ cliente: 'Sem cliente', status: 'A Fazer', veiculacao_iso: HOJE }),
    peca({ nome: 'Da Beta e da Inativa', clientes: ['Inativa', 'beta '], status: 'Em andamento', veiculacao_iso: HOJE, status_updated_at: em(HOJE), responsavel_ids: ['20'] }),
  ];
  // A mesma peça repetida na lista entra uma vez.
  demandas.push({ ...demandas[4] });
  const r = calcular({ demandas, clientes: CLIENTES, pessoas: PESSOAS, hoje: HOJE });
  assert.equal(r.hoje.previstas, 1);
  assert.deepEqual(r.hoje.lista.faltam.map((p) => [p.nome, p.cliente]), [['Da Beta e da Inativa', 'Beta']]);
  assert.equal(r.hoje.atrasadas, 0);
  assert.deepEqual(r.clientes.map((c) => c.cliente).sort(), ['Alfa', 'Beta', 'Gama']);
  assert.deepEqual(r.time.map((t) => t.pessoa), ['Jady']);
  assert.deepEqual(r.fonte.contagem, { lidas: 6, consideradas: 1, semClienteAtivo: 4, repetidas: 1, entreguesSemDia: 0 });

  // Cadastro ainda vazio: valem os clientes das próprias peças, menos "Sem cliente".
  const semCadastro = calcular({ demandas, clientes: [], hoje: HOJE });
  assert.deepEqual(semCadastro.clientes.map((c) => c.cliente).sort(), ['Encerrada', 'Fornecedor', 'Inativa', 'beta']);
  assert.match(semCadastro.fonte.clientes, /não carregou/);
  assert.deepEqual(semCadastro.cobertura.semPlanejamento, []);
});

test('gargalos: etapa com mais peças-dia paradas primeiro, com a mediana e a peça mais antiga', () => {
  const parada = (nome, status, dias, o = {}) => peca({ nome, status, veiculacao_iso: '2026-11-09', status_updated_at: em(somar(HOJE, -dias)), ...o });
  const demandas = [
    parada('Aprovar 1', 'Para aprovação', 1),
    parada('Aprovar 4', 'Para aprovação', 4),
    // Nome de solicitação junta no mesmo estado (operationalFlowStatus).
    parada('Aprovar 6', 'Aguardando Aprovação', 6, { origem: 'solicitacao' }),
    parada('Ajuste 2', 'Alteração', 2),
    parada('Ajuste 3', 'Alteração', 3),
    // Fora da janela de produção (vai ao ar daqui a um mês): não é gargalo.
    parada('Longe', 'Para aprovação', 20, { veiculacao_iso: '2026-12-04' }),
    // Entregue não é gargalo.
    parada('Pronta', 'Finalizado', 9),
  ];
  const r = calcular({ demandas, clientes: CLIENTES, hoje: HOJE });
  assert.deepEqual(r.gargalos.map((g) => [g.status, g.qtd, g.idadeMedianaDias, g.pecasDia]),
    [['Para aprovação', 3, 4, 11], ['Alteração', 2, 2.5, 5]]);
  assert.equal(r.gargalos[0].maisAntiga.nome, 'Aprovar 6');
  assert.equal(r.gargalos[0].maisAntigaDias, 6);
  assert.ok(r.alertas.some((a) => a.nivel === 3 && a.texto === 'Gargalo: 3 peças em Para aprovação, paradas há 4 dias (mediana)'));
  assert.ok(r.alertas.some((a) => a.nivel === 3 && /^2 peças travadas na janela de produção \(Alteração 2\)$/.test(a.texto)));
});

test('time: o pior primeiro e frases curtas do que cobrar', () => {
  const demandas = [
    ...[1, 2, 3].map((n) => peca({ nome: `Card A${n}`, status: 'Em andamento', veiculacao_iso: '2026-11-10', prazo_iso: `2026-11-0${n}`,
      status_updated_at: em(HOJE), tem_briefing: true, responsavel_ids: ['10'] })),
    ...[1, 2].map((n) => peca({ nome: `Sem briefing ${n}`, status: 'Pode Fazer', veiculacao_iso: '2026-11-11', status_updated_at: em(HOJE), tem_briefing: false, responsavel_ids: ['10'] })),
    peca({ nome: 'Entregue ontem', status: 'Finalizado', veiculacao_iso: '2026-11-05', status_updated_at: em('2026-11-03'), responsavel_ids: ['10'] }),
    peca({ nome: 'Entregue há 10 dias', status: 'Finalizado', veiculacao_iso: '2026-10-26', status_updated_at: em('2026-10-25'), responsavel_ids: ['10'] }),
    peca({ nome: 'Andando', status: 'Em andamento', veiculacao_iso: '2026-11-10', status_updated_at: em(HOJE), responsavel_ids: ['20'] }),
    peca({ nome: 'Parada', status: 'Em andamento', veiculacao_iso: '2026-11-10', status_updated_at: em('2026-10-31'), responsavel_ids: ['20'] }),
    // Esperando o cliente: a cobrança é do head, não de quem executa.
    peca({ nome: 'Com o cliente', status: 'Ag. Aprovação Cliente', veiculacao_iso: '2026-11-09', prazo_iso: '2026-11-01', status_updated_at: em('2026-10-31'), responsavel_ids: ['30'] }),
    // Sem o mapa de pessoas, o nome sai do campo Responsável, na mesma ordem dos ids.
    peca({ nome: 'Dupla', status: 'Em andamento', veiculacao_iso: '2026-11-10', status_updated_at: em(HOJE), responsavel_ids: ['20', '99'], responsavel: 'Jady, Ewerton S.' }),
  ];
  const r = calcular({ demandas, clientes: CLIENTES, pessoas: PESSOAS, hoje: HOJE });
  const [bia, jady] = r.time;
  assert.equal(bia.pessoa, 'Bia');
  assert.equal(bia.abertas, 5);
  assert.equal(bia.atrasadas, 3);
  assert.equal(bia.semBriefing, 2);
  assert.equal(bia.entregues7d, 1);
  assert.deepEqual(bia.cobrar, ['3 peças atrasadas: Card A1, Card A2…', '2 sem briefing']);
  // O mini painel do número lista exatamente as peças contadas (Paulo, 08/11: clicar no número e ver o que tem por trás).
  assert.deepEqual(bia.lista.atrasadas.map((p) => p.nome), ['Card A1', 'Card A2', 'Card A3']);
  for (const t of r.time) assert.equal(t.lista.atrasadas.length, t.atrasadas);
  for (const c of r.clientes) { assert.equal(c.lista.atrasadas.length, c.atrasadas); assert.equal(c.lista.emRisco.length, c.emRisco); }
  assert.equal(jady.pessoa, 'Jady');
  assert.deepEqual(jady.cobrar, ['1 peça parada há 3+ dias: Parada']);
  assert.equal(jady.idadeMedianaDias, 0); // 0, 4 e 0 dias
  const reriston = r.time.find((t) => t.pessoa === 'Reriston');
  assert.equal(reriston.abertas, 1);
  assert.equal(reriston.atrasadas, 0);
  assert.deepEqual(reriston.cobrar, []);
  assert.ok(r.time.some((t) => t.pessoaId === '99' && t.pessoa === 'Ewerton S.'));
  assert.ok(r.alertas.some((a) => a.nivel === 4 && /^1 peça esperando o cliente/.test(a.texto)));
  // A lista de TEAM_USERS vira o mesmo mapa.
  assert.deepEqual(JSON.parse(JSON.stringify(D.util.pessoasDe([{ id: 10, name: 'Bia' }, { id: '20', nome: 'Jady' }]))), { 10: 'Bia', 20: 'Jady' });
  const comLista = calcular({ demandas, clientes: CLIENTES, pessoas: [{ id: '10', name: 'Bia' }], hoje: HOJE });
  assert.equal(comLista.time[0].pessoa, 'Bia');
});

// 11 semanas completas e a atual, com entregas montadas por semana.
function historicoCom(contas, { atrasadaPorSemanaDesde = 99 } = {}) {
  const inicio = '2026-08-17';
  const demandas = [];
  contas.forEach((n, k) => {
    const semana = somar(inicio, 7 * k);
    for (let i = 0; i < n; i++) {
      const atrasou = k >= atrasadaPorSemanaDesde && i === 0;
      demandas.push(peca({ status: 'Finalizado', status_updated_at: em(somar(semana, 2)), veiculacao_iso: somar(semana, atrasou ? 1 : 3) }));
    }
  });
  return demandas;
}

test('heads: a carteira de cada líder, cliente com dois heads e cliente sem head', () => {
  const clientes = [
    { id: 1, nome: 'Alfa', ativo: true, status: 'Ativo', heads: 'Paulo, Ewerton', planejamento_url: 'x' },
    { id: 2, nome: 'Beta', ativo: true, status: 'Ativo', heads: ['Ewerton'], planejamento_url: 'x' },
    { id: 3, nome: 'Gama', ativo: true, status: 'Ativo', planejamento_url: 'x' },
    { id: 4, nome: 'Inativa', ativo: false, status: 'Inativo', heads: 'Paulo' },
  ];
  const demandas = [
    // Alfa (Paulo e Ewerton): um furo, um risco, uma entregue da semana e uma aberta da semana.
    peca({ nome: 'Furo Alfa', cliente: 'Alfa', status: 'Alteração', veiculacao_iso: '2026-11-03', status_updated_at: em('2026-11-01') }),
    peca({ nome: 'Risco Alfa', cliente: 'Alfa', status: 'A Fazer', veiculacao_iso: '2026-11-05', status_updated_at: em('2026-11-01') }),
    peca({ nome: 'Pronta Alfa', cliente: 'Alfa', status: 'Finalizado', veiculacao_iso: '2026-11-06', status_updated_at: em(HOJE) }),
    peca({ nome: 'Aberta Alfa', cliente: 'Alfa', status: 'Em andamento', veiculacao_iso: '2026-11-07', status_updated_at: em(HOJE) }),
    // Peça de Alfa e Beta: conta uma vez para Ewerton (mesma carteira).
    peca({ nome: 'Conjunta', clientes: ['Alfa', 'Beta'], status: 'Em andamento', veiculacao_iso: '2026-11-08', status_updated_at: em(HOJE) }),
    // Gama sem head.
    peca({ nome: 'Pronta Gama', cliente: 'Gama', status: 'Agendado', veiculacao_iso: '2026-11-05', status_updated_at: em('2026-11-03') }),
    peca({ nome: 'Peça inativa', cliente: 'Inativa', status: 'A Fazer', veiculacao_iso: '2026-11-01' }),
  ];
  const r = calcular({ demandas, clientes, pessoas: PESSOAS, hoje: HOJE });
  assert.deepEqual(r.heads.map((h) => h.head), ['Ewerton', 'Paulo', 'Sem head']);
  const [ewerton, paulo, sem] = r.heads;

  assert.equal(paulo.contas, 1);
  assert.deepEqual(paulo.clientes, ['Alfa']);
  assert.deepEqual(paulo.saude, { critico: 1, atencao: 0, ok: 0, pior: 'critico' });
  assert.equal(paulo.abertas, 4); // Furo, Risco, Aberta e Conjunta
  assert.equal(paulo.atrasadas, 1);
  assert.equal(paulo.furos, 1);
  assert.equal(paulo.emRisco, 1);
  assert.deepEqual(paulo.semana, { previstas: 5, entregues: 1, pct: 20 });
  assert.deepEqual(paulo.lista.atrasadas.map((p) => p.nome), ['Furo Alfa']);
  assert.deepEqual(paulo.lista.emRisco.map((p) => p.nome), ['Risco Alfa']);
  assert.equal(paulo.lista.atrasadas[0].cliente, 'Alfa');

  // Ewerton tem Alfa e Beta; a peça conjunta conta uma vez só.
  assert.equal(ewerton.contas, 2);
  assert.deepEqual(ewerton.clientes, ['Alfa', 'Beta']);
  assert.equal(ewerton.saude.critico, 1);
  assert.equal(ewerton.saude.pior, 'critico');
  assert.equal(ewerton.abertas, 4);
  assert.deepEqual(ewerton.semana, { previstas: 5, entregues: 1, pct: 20 });

  // Sem head vai por último; cliente inativo fica de fora.
  assert.equal(sem.semHead, true);
  assert.deepEqual(sem.clientes, ['Gama']);
  // "Pronta Gama" está Agendado para 05/11: espera a postagem, não é entrega nem atraso nem risco.
  assert.equal(sem.atrasadas, 0);
  assert.equal(sem.emRisco, 0);
  assert.deepEqual(sem.semana, { previstas: 1, entregues: 0, pct: 0 });
  assert.ok(!r.heads.some((h) => h.clientes.includes('Inativa')));

  // A regra dos heads é a mesma da Carteira.
  assert.deepEqual([...D.util.headsDe({ heads: ' Ana , Bia,Ana ' })], ['Ana', 'Bia']);

  // Sem cadastro carregado, tudo vai para "Sem head".
  const semCadastro = calcular({ demandas, clientes: [], hoje: HOJE });
  assert.deepEqual(semCadastro.heads.map((h) => h.head), ['Sem head']);
  assert.equal(semCadastro.heads[0].contas, 4); // valem os clientes das próprias peças
});

test('histórico: 12 semanas, mediana das completas, no prazo e tendência', () => {
  const contas = [2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4];
  const demandas = [...historicoCom(contas, { atrasadaPorSemanaDesde: 7 }),
    peca({ status: 'Finalizado', veiculacao_iso: HOJE, status_updated_at: em(HOJE) })];
  const r = calcular({ demandas, clientes: CLIENTES, hoje: HOJE });
  const H = r.historico;
  assert.equal(H.semanas.length, 12);
  assert.equal(H.semanas[0].inicio, '2026-08-17');
  assert.equal(H.semanas[11].inicio, '2026-11-02');
  assert.deepEqual(H.semanas.map((s) => s.entregues), [...contas, 1]);
  assert.deepEqual(H.semanas.map((s) => s.previstas), [...contas, 1]);
  assert.deepEqual(H.semanas[7], { inicio: '2026-10-05', previstas: 4, entregues: 4, noPrazo: 3, atrasadasEntregues: 1 });
  assert.equal(H.medianaEntregues, 2);
  assert.equal(H.mediaNoPrazoPct, 87.1); // 27 no prazo, 4 depois da veiculação
  assert.equal(H.tendencia, 'subindo');
  assert.ok(r.alertas.some((a) => a.nivel === 6 && /^Entregas subindo/.test(a.texto)));

  assert.equal(calcular({ demandas: historicoCom([4, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1]), clientes: CLIENTES, hoje: HOJE }).historico.tendencia, 'caindo');
  // Semanas vazias antes da primeira entrega são falta de dado, não de produção.
  const curto = calcular({ demandas: historicoCom([0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3]), clientes: CLIENTES, hoje: HOJE }).historico;
  assert.equal(curto.medianaEntregues, 3);
  assert.equal(curto.tendencia, 'estavel');
  const vazio = calcular({ demandas: [], clientes: CLIENTES, hoje: HOJE }).historico;
  assert.equal(vazio.medianaEntregues, 0);
  assert.equal(vazio.mediaNoPrazoPct, null);
  assert.equal(vazio.tendencia, 'estavel');
});

test('projeção: próxima semana contra a capacidade mediana e as 4 semanas seguintes', () => {
  const futuras = (n, semana) => Array.from({ length: n }, (_, i) => peca({ status: 'A Fazer', veiculacao_iso: somar(semana, i % 7) }));
  const historico = historicoCom(Array(11).fill(4));
  const r = calcular({ demandas: [...historico, ...futuras(10, '2026-11-09'), ...futuras(2, '2026-11-16')], clientes: CLIENTES, hoje: HOJE });
  assert.deepEqual(r.projecao.proximaSemana, { inicio: '2026-11-09', previstas: 10, abertas: 10, capacidadeMediana: 4, folga: -6, risco: 'alto' });
  assert.deepEqual(r.projecao.proximas4, [
    { inicio: '2026-11-09', previstas: 10, abertas: 10 }, { inicio: '2026-11-16', previstas: 2, abertas: 2 },
    { inicio: '2026-11-23', previstas: 0, abertas: 0 }, { inicio: '2026-11-30', previstas: 0, abertas: 0 },
  ]);
  assert.ok(r.alertas.some((a) => a.nivel === 3 && a.texto === 'Próxima semana: 10 peças previstas para uma capacidade de 4 por semana'));
  const risco = (n) => calcular({ demandas: [...historico, ...futuras(n, '2026-11-09')], clientes: CLIENTES, hoje: HOJE }).projecao.proximaSemana.risco;
  assert.equal(risco(4), 'medio');
  assert.equal(risco(3), 'baixo');
  // Sem histórico não há capacidade para comparar.
  assert.equal(calcular({ demandas: futuras(5, '2026-11-09'), clientes: CLIENTES, hoje: HOJE }).projecao.proximaSemana.risco, 'medio');
});

test('regra de entrega informada por quem chama substitui a do painel', () => {
  const demandas = [
    peca({ nome: 'Concluída', status: 'Concluída pela equipe', veiculacao_iso: HOJE, status_updated_at: em(HOJE) }),
    peca({ nome: 'Finalizado de outro jeito', status: 'Finalizado', veiculacao_iso: HOJE, prazo_iso: '2026-11-01', status_updated_at: em(HOJE) }),
  ];
  const r = calcular({ demandas, clientes: CLIENTES, hoje: HOJE, finalizado: (d) => d.status === 'Concluída pela equipe' });
  assert.equal(r.hoje.feitas, 1);
  assert.deepEqual(r.hoje.lista.atrasadas.map((p) => p.nome), ['Finalizado de outro jeito']);
  assert.match(r.fonte.finalizado, /informada/);
});

test('roda rápido com 2.100 peças (folga para a suíte inteira rodando junto)', () => {
  let semente = 7;
  const sorteio = (n) => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente % n; };
  const STATUS = ['A Fazer', 'Pode Fazer', 'Em andamento', 'Para aprovação', 'Alteração', 'Falta Info', 'Ag. Aprovação Cliente',
    'Para agendar', 'Agendado', 'Finalizado', 'Finalizado', 'Finalizado', 'Segurar Post'];
  const clientes = Array.from({ length: 53 }, (_, i) => ({ id: i + 1, nome: `Cliente ${i + 1}`, ativo: i % 9 !== 0, status: i % 9 ? 'Ativo' : 'Inativo', planejamento_url: i % 2 ? 'x' : '' }));
  const pessoas = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(100 + i), `Pessoa ${i}`]));
  const demandas = Array.from({ length: 2100 }, (_, i) => {
    const veic = somar(HOJE, sorteio(240) - 160);
    return { id: String(i), nome: `Peça ${i}`, cliente: `Cliente ${1 + sorteio(53)}`, clientes: [`Cliente ${1 + sorteio(53)}`],
      status: STATUS[sorteio(STATUS.length)], veiculacao_iso: veic, prazo_iso: somar(veic, -7),
      status_updated_at: em(somar(veic, -sorteio(10)), 9 + sorteio(8)), criado_em: em(somar(veic, -20)),
      responsavel_ids: [String(100 + sorteio(12))], tem_briefing: sorteio(5) > 0, operational_risk: { level: ['safe', 'high', 'critical', 'attention'][sorteio(4)] } };
  });
  const entrada = { demandas, clientes, pessoas, hoje: HOJE };
  D.calcular(entrada);
  let melhor = Infinity;
  for (let i = 0; i < 3; i++) { const t = performance.now(); D.calcular(entrada); melhor = Math.min(melhor, performance.now() - t); }
  assert.ok(melhor < 250, `levou ${melhor.toFixed(1)} ms`);
  const r = calcular(entrada);
  assert.equal(r.fonte.contagem.lidas, 2100);
  assert.equal(r.historico.semanas.length, 12);
});

test('situação de uma peça: a função oficial para todas as telas (auditoria 09/11)', () => {
  const s = (d) => D.util.situacaoDaPeca(d, { hoje: '2026-11-09' }).situacao;
  // Pronta é só Finalizado (Paulo, 13/11/2026): Agendado com a data passada não foi postado.
  assert.equal(s({ status: 'Agendado', veiculacao_iso: '2026-11-01' }), 'atrasada');
  assert.equal(s({ status: 'Para agendar', veiculacao_iso: '2026-11-01' }), 'atrasada');
  assert.equal(s({ status: 'Agendado', veiculacao_iso: '2026-11-10', status_updated_at: '2026-11-09T12:00:00' }), 'andamento');
  assert.equal(s({ status: 'Finalizado', veiculacao_iso: '2026-11-01' }), 'entregue');
  assert.equal(s({ status: 'Feito', veiculacao_iso: '2026-11-01' }), 'entregue'); // "Feito" não contava no Dono
  assert.equal(s({ status: 'Qualquer', status_final: true, veiculacao_iso: '2026-11-01' }), 'entregue'); // o final do banco manda
  assert.equal(s({ status: 'Segurar Post', veiculacao_iso: '2026-11-01' }), 'pausada'); // pausada não é atrasada
  assert.equal(s({ status: 'Em andamento', veiculacao_iso: '2026-09-01' }), 'esquecida');
  assert.equal(s({ status: 'Em andamento', veiculacao_iso: '2026-11-05' }), 'atrasada');
  assert.equal(s({ status: 'A Fazer', veiculacao_iso: '2026-11-10' }), 'risco');
  assert.equal(s({ status: 'Ag. Aprovação Cliente', veiculacao_iso: '2026-11-20' }), 'cliente');
  const r = D.util.situacaoDaPeca({ status: 'Em andamento', veiculacao_iso: '2026-11-20', prazo_iso: '2026-11-05' }, { hoje: '2026-11-09' });
  assert.equal(r.referencia, '2026-11-20'); // a data do cliente vem primeiro
  assert.equal(r.prazoVencido, true); assert.equal(r.furo, false);
});
