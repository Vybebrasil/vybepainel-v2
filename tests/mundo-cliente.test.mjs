// SAFE: roda vybe-mundo-cliente.js num vm com dados fixos, relógio fixo e janelas falsas; sem rede,
// sem banco e sem gravar nada (pljPedir e as janelas do ciclo são espiões).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const FONTE = readFileSync('vybe-mundo-cliente.js', 'utf8');
const HOJE = '2026-11-11'; // quarta-feira: a semana vai de 09/11 a 15/11

const PECAS = [
  { id: 1, nome: 'Card Black Friday', cliente: 'Padaria Sol', status: 'Ag. Aprovação Cliente', status_updated_at: '2026-11-05T12:00:00Z', veiculacao_iso: '2026-11-20', prazo_iso: '2026-11-18', responsavel: 'Bia' },
  { id: 2, nome: 'Reels do pão', cliente: 'Padaria Sol', status: 'Ag. Info Cliente', status_updated_at: '2026-11-10T12:00:00Z', veiculacao_iso: '2026-11-12', prazo_iso: '2026-11-12', responsavel: 'Jady' },
  { id: 3, nome: 'Carrossel cardápio', cliente: 'Padaria Sol', status: 'Aguardo', status_updated_at: '2026-11-09T12:00:00Z', veiculacao_iso: '2026-11-19', prazo_iso: '2026-11-08', responsavel: 'Bia' },
  { id: 4, nome: 'Story promoção', cliente: 'Padaria Sol', status: 'Em andamento', veiculacao_iso: '2026-11-14', prazo_iso: '2026-11-13', responsavel: 'Deivid' },
  { id: 5, nome: 'Post aniversário', cliente: 'Padaria Sol', status: 'Finalizado', veiculacao_iso: '2026-11-17', prazo_iso: '2026-11-10', responsavel: 'Bia' },
  { id: 6, nome: 'Arte interna', cliente: 'Padaria Sol', status: 'Para aprovação', veiculacao_iso: '2026-11-25', prazo_iso: '2026-11-21', responsavel: 'Bia' },
  { id: 7, nome: 'De outro cliente', cliente: 'Outra Loja', status: 'Ag. Aprovação Cliente', status_updated_at: '2026-11-01T12:00:00Z', veiculacao_iso: '2026-11-13' },
  { id: 8, nome: 'Campanha conjunta', clientes: ['Outra Loja', 'Padaria Sol'], status: 'Em andamento', veiculacao_iso: '2026-12-06', responsavel: 'Bia' },
  { id: 9, nome: 'Fora do calendário', cliente: 'Padaria Sol', status: 'A Fazer', veiculacao_iso: '2026-12-07', responsavel: 'Bia' },
];

function ambiente({ admin = false, pecas = PECAS, cadastro = [{ id: 42, nome: 'Padaria Sol', ativo: true, status: 'Ativo', planejamento_url: 'https://docs.google.com/document/d/abc/edit' }], extra = {} } = {}) {
  const chamadas = [];
  const espiao = (nome) => (...a) => { chamadas.push([nome, ...a]); };
  const c = vm.createContext({
    URL, // do navegador; o vm só traz os objetos da linguagem
    hojeDeVerdade: () => HOJE,
    DADOS_ALL: pecas,
    CADASTRO_CLIENTES: cadastro,
    souAdmin: () => admin,
    openItemWorkspace: espiao('openItemWorkspace'),
    abrirPlanejamento: espiao('abrirPlanejamento'),
    abrirDesativarNoCiclo: espiao('abrirDesativarNoCiclo'),
    abrirApagarNoCiclo: espiao('abrirApagarNoCiclo'),
    ...extra,
  });
  c.window = c;
  vm.runInContext(FONTE, c, { filename: 'vybe-mundo-cliente.js' });
  return { api: c.VybeClientePlaca, chamadas, c };
}
// Recorta uma seção do HTML pelo marcador data-vv-cli-secao.
function secao(html, nome) {
  const i = html.indexOf(`data-vv-cli-secao="${nome}"`);
  assert.ok(i >= 0, `seção ${nome} presente`);
  const j = html.indexOf('data-vv-cli-secao=', i + 20);
  return html.slice(i, j < 0 ? undefined : j);
}
const ids = (trecho) => [...trecho.matchAll(/data-vv-cli-peca="([^"]+)"/g)].map((m) => m[1]);

test('Esperando o cliente: só as peças do cliente paradas com ele, atrasada primeiro, dias pelo status_updated_at', () => {
  const { api } = ambiente();
  const s = secao(api.html('Padaria Sol'), 'espera');
  assert.deepEqual(ids(s), ['3', '1', '2']); // 6 (aprovação interna), 7 (outro cliente) e 4 (andando) ficam fora
  assert.match(s, /vv-cli-conta">3</);
  assert.match(s, /class="vv-cli-linha u1" data-vv-cli-peca="3"/);
  assert.match(s, /<em class="vv-cli-tag u1">atrasada · há 2 dias<\/em>/);
  assert.match(s, /class="vv-cli-linha u2" data-vv-cli-peca="1"/, 'parada há mais de 3 dias = âmbar');
  assert.match(s, /<em class="vv-cli-tag u2">há 6 dias<\/em>/);
  assert.match(s, /<em class="vv-cli-tag u3b">há 1 dia<\/em>/, 'falta informação, parada há pouco: bloqueio lilás');
});

test('Esperando o cliente usa os mesmos status do radar de risco (riskActionOwner)', () => {
  const risco = readFileSync('vybe-risco.js', 'utf8').replace(/\r\n/g, '\n');
  const ini = risco.indexOf('function riskActionOwner');
  const fim = risco.indexOf('\n}\n', ini) + 2;
  assert.ok(ini >= 0 && fim > ini, 'riskActionOwner encontrado em vybe-risco.js');
  const c = vm.createContext({ assignedIds: () => ['1'], TEAM_USERS: [] });
  vm.runInContext(risco.slice(ini, fim), c);
  const doCliente = ['A Fazer', 'Pode Fazer', 'Em andamento', 'Falta Info', 'Ag. Info Cliente', 'Aguardo', 'Ag. Aprovação Cliente', 'Para aprovação', 'Alteração', 'Falta D.A', 'Ag. Interno', 'Para agendar']
    .filter((status) => c.riskActionOwner({ status }).source === 'cliente');
  const { api } = ambiente();
  assert.deepEqual([...api.ESPERA_DO_CLIENTE].sort(), doCliente.sort());
});

test('Esta semana: veiculação de segunda a domingo, com dia e status, e "x de 3" âmbar abaixo da meta', () => {
  const { api } = ambiente();
  const s = secao(api.html('Padaria Sol'), 'semana');
  assert.match(s, /Esta semana · 09\/11 a 15\/11/);
  assert.deepEqual(ids(s), ['2', '4']);
  assert.match(s, /<span class="vv-cli-meta falta"[^>]*>2 de 3<\/span>/);
  assert.match(s, /<small>Qui<\/small><b>12<\/b>/);
  assert.match(s, /<small>Sáb<\/small><b>14<\/b>/);
  assert.match(s, /Story promoção[\s\S]*?vv-cli-tag u6">Em andamento/);
  assert.match(s, /Reels do pão[\s\S]*?vv-cli-tag u3b">Ag\. Info Cliente/);
  // terceira peça na semana (inclusive já finalizada: post publicado conta) → verde
  const { api: api3 } = ambiente({ pecas: [...PECAS, { id: 10, nome: 'Post domingo', cliente: 'Padaria Sol', status: 'Finalizado', veiculacao_iso: '2026-11-15' }] });
  assert.match(secao(api3.html('Padaria Sol'), 'semana'), /<span class="vv-cli-meta ok"[^>]*>3 de 3<\/span>/);
});

test('Próximas 4 semanas: 28 dias desde a segunda, pontos por peça, hoje destacado e fora do período fica fora', () => {
  const { api } = ambiente();
  const s = secao(api.html('Padaria Sol'), 'calendario');
  const dias = [...s.matchAll(/<button type="button" class="([^"]+)" data-vv-cli-dia="([^"]+)"/g)].map((m) => [m[2], m[1]]);
  assert.equal(dias.length, 28);
  assert.equal(dias[0][0], '2026-11-09');
  assert.equal(dias[27][0], '2026-12-06');
  assert.match(Object.fromEntries(dias)['2026-11-11'], /\bhoje\b/);
  assert.match(Object.fromEntries(dias)['2026-11-10'], /\bpassado\b/);
  const pontos = (iso) => (s.match(new RegExp(`data-vv-cli-dia="${iso}"[^>]*><span>\\d+</span><em>(.*?)</em>`))?.[1].match(/<i/g) || []).length;
  assert.equal(pontos('2026-11-12'), 1);
  assert.equal(pontos('2026-12-06'), 1, 'peça com vários clientes entra no calendário de cada um');
  assert.equal(pontos('2026-11-11'), 0);
  assert.match(s, /data-vv-cli-dia="2026-11-17"[^>]*><span>17<\/span><em><i class="feita"><\/i>/);
  assert.ok(!s.includes('2026-12-07'), 'a peça de 07/12 está fora das 4 semanas');
  assert.match(s, /data-vv-cli-dia="2026-11-13"[^>]* disabled/);
  assert.match(s, /data-vv-cli-dia="2026-12-01"[^>]*><span>1\/12<\/span>/, 'a virada do mês aparece no dia 1');
  assert.match(s, /vv-cli-conta">7 peças</);
  assert.match(s, /data-vv-cli-lista="2026-11-20" hidden>[\s\S]*data-vv-cli-peca="1"/);
});

test('Planejamentos: link do cadastro, a consulta da ficha (pljPedir) e erro que não vira lista vazia', async () => {
  // Sem a consulta carregada: só o link do cadastro, com o estado explicado.
  const semConsulta = secao(ambiente().api.html('Padaria Sol'), 'planejamentos');
  assert.match(semConsulta, /href="https:\/\/docs\.google\.com\/document\/d\/abc\/edit" target="_blank" rel="noopener noreferrer"/);
  assert.match(semConsulta, /Só o link do cadastro/);
  assert.match(semConsulta, /docs\.google\.com/);

  const pedidos = [];
  const PLJ = { revisar: { rotulo: 'Para revisar' }, enviado: { rotulo: 'Com o cliente' } };
  const { api, chamadas, c } = ambiente({ extra: {
    pljPedir: async (q) => { pedidos.push(q); return { disponivel: true, planejamentos: [
      { id: 'p1', mes: '2026-11-01', titulo: 'Novembro', versao: 2, estado: 'enviado' }, { id: 'p2', mes: '2026-12-01', titulo: 'Dezembro', versao: 1, estado: 'revisar' }] }; },
  } });
  c.PLJ_ESTADOS = PLJ;
  const html = api.html('Padaria Sol');
  assert.match(secao(html, 'planejamentos'), /data-vv-cli-plj="42">[\s\S]*Buscando os planejamentos/);
  const { raiz, clicar, caixas } = domFalso(html);
  await api.ligar(raiz);
  assert.deepEqual(pedidos, ['cliente_id=42']);
  assert.match(caixas[0].innerHTML, /data-vv-cli-plj-abrir="p2"[\s\S]*vv-cli-tag u2">Para revisar[\s\S]*data-vv-cli-plj-abrir="p1"[\s\S]*vv-cli-tag u4">Com o cliente/);
  clicar({ vvCliPljAbrir: 'p2' });
  assert.deepEqual(chamadas.at(-1), ['abrirPlanejamento', 'p2']);
  await api.ligar(raiz); // redesenho da mesma placa: não busca de novo o que já carregou nem liga o clique duas vezes
  assert.equal(pedidos.length, 1);
  clicar({ vvCliPeca: '3' });
  assert.deepEqual(chamadas.filter(([n]) => n === 'openItemWorkspace'), [['openItemWorkspace', '3']]);

  const erro = ambiente({ extra: { pljPedir: async () => { throw new Error('o painel não respondeu'); } } });
  const d2 = domFalso(erro.api.html('Padaria Sol'));
  await erro.api.ligar(d2.raiz);
  assert.match(d2.caixas[0].innerHTML, /vv-cli-nota erro">Não foi possível buscar os planejamentos: o painel não respondeu/);
});

test('Desativar e Apagar: escondidos para quem não administra; para admin chamam o ciclo com os argumentos do legado', () => {
  const comum = ambiente({ admin: false });
  const html = comum.api.html('Padaria Sol');
  assert.ok(!html.includes('data-vv-cli-desativar') && !html.includes('data-vv-cli-apagar'));
  const d = domFalso(html);
  comum.api.ligar(d.raiz);
  d.clicar({}, 'data-vv-cli-desativar'); // botão forjado: sem admin não abre a janela
  assert.equal(comum.chamadas.length, 0);

  const adm = ambiente({ admin: true });
  const h2 = adm.api.html('Padaria Sol');
  assert.match(secao(h2, 'acoes'), /data-vv-cli-desativar/);
  assert.match(secao(h2, 'acoes'), /data-vv-cli-apagar disabled aria-disabled="true"/, 'cliente ativo: apagar só depois de desativar');
  const d2 = domFalso(h2);
  adm.api.ligar(d2.raiz);
  d2.clicar({}, 'data-vv-cli-desativar');
  const [nome, tipo, id, cliente, opcoes] = adm.chamadas.at(-1);
  assert.deepEqual([nome, tipo, id, cliente], ['abrirDesativarNoCiclo', 'cliente', '42', 'Padaria Sol']);
  assert.equal(typeof opcoes.depois, 'function');
  d2.clicar({}, 'data-vv-cli-apagar', true); // desabilitado: nada
  assert.equal(adm.chamadas.length, 1);

  const inativo = ambiente({ admin: true, cadastro: [{ id: 42, nome: 'Padaria Sol', ativo: false, status: 'Inativo' }] });
  const h3 = inativo.api.html('Padaria Sol');
  assert.ok(!h3.includes('data-vv-cli-desativar'));
  assert.match(h3, /data-vv-cli-apagar title="Apaga o cadastro para sempre/);
  const d3 = domFalso(h3);
  inativo.api.ligar(d3.raiz);
  d3.clicar({}, 'data-vv-cli-apagar');
  assert.deepEqual(inativo.chamadas.at(-1).slice(0, 4), ['abrirApagarNoCiclo', 'cliente', '42', 'Padaria Sol']);
});

test('sem dados não quebra e escapa o nome', () => {
  const { api } = ambiente({ pecas: [], cadastro: [] });
  const html = api.html('<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img'));
  assert.match(html, /Nada esperando o cliente agora/);
  assert.match(html, /0 de 3/);
  assert.match(html, /Nenhuma veiculação nas próximas 4 semanas/);
  assert.match(html, /ainda não tem cadastro no painel/);
  assert.equal(api.html(''), '');
});

// DOM mínimo para ligar(): uma raiz que guarda o ouvinte de clique, a caixa dos planejamentos e
// botões falsos que respondem a closest() como os de verdade.
function domFalso(html) {
  const bloco = { dataset: { vvCliId: html.match(/data-vv-cli-id="([^"]*)"/)?.[1] || '', vvCliCliente: html.match(/data-vv-cli-cliente="([^"]*)"/)?.[1] || '' } };
  const caixas = [...html.matchAll(/data-vv-cli-plj="([^"]+)"/g)].map((m) => ({ dataset: { vvCliPlj: m[1] }, isConnected: true, innerHTML: '' }));
  const ouvintes = [];
  const raiz = {
    addEventListener: (tipo, fn) => { if (tipo === 'click') ouvintes.push(fn); },
    querySelectorAll: (sel) => (sel === '[data-vv-cli-plj]' ? caixas : []),
    querySelector: () => null,
    contains: () => true,
  };
  const clicar = (dataset, atributo = '', disabled = false) => {
    const botao = { dataset, disabled, hasAttribute: (n) => n === atributo, closest: (sel) => (sel === '.vv-cli' ? bloco : null), getAttribute: () => null };
    const alvo = { closest: () => botao };
    ouvintes.forEach((fn) => fn({ target: alvo }));
  };
  return { raiz, clicar, caixas, ouvintes };
}

// ---------- Visão única (Paulo, 07/11/2026): saúde, contrato e financeiro, peças do mês, clima e cérebro ----------
const RESUMO = readFileSync('vybe-relatorio-resumo.js', 'utf8');
function visao({ socio = false, admin = false, extra = {}, pecas } = {}) {
  const amb = ambiente({ admin, pecas, extra: { operadorDoTopo: () => ({ name: socio ? 'Paulo Henrique' : 'Bia Souza' }), ...extra } });
  vm.runInContext(RESUMO, amb.c);
  return amb;
}
const CARTEIRA = { dados: () => ({ clientes: [
  { cliente_id: 42, cliente: 'Padaria Sol', saude: 'atenção', pontuacao: 62, motivos: ['Pagamento atrasado', { texto: 'Grupo sem resposta há 5 dias' }],
    contrato: { plano: 'Social + Tráfego', valor_mensal: 2500, renovacao: '2027-01-10' }, clima: { nivel: 'tenso', resumo: 'Cliente cobrou a arte do sábado.', atualizado_em: '2026-11-10T15:00:00Z' } },
  { cliente_id: 7, cliente: 'Outra Loja', saude: 'ok' },
] }) };
const COMERCIAL = { dados: () => [{ cliente: 'padaria sol', financeiro: { em_aberto: 1200.5, ultimo_pagamento: '2026-10-05', situacao: 'Atrasado' } }] };

test('visão única: sem os outros módulos, saúde e negócio somem e o mês aparece com o botão do relatório', () => {
  const { api } = visao({ socio: true });
  const html = api.html('Padaria Sol');
  assert.ok(!html.includes('data-vv-cli-secao="saude"'), 'sem Carteira e sem VybeDono: sem bloco de saúde');
  assert.ok(!html.includes('data-vv-cli-secao="negocio"'));
  assert.ok(!html.includes('data-vv-cli-secao="clima"'));
  const s = secao(html, 'mes');
  assert.match(s, /Peças de novembro de 2026/);
  assert.match(s, /data-vv-cli-relatorio="2026-11"/);
  // Novembro pela veiculação: 1, 2, 3, 4, 5 e 6 (a conjunta e a 9 são de dezembro).
  assert.match(s, /vv-cli-conta">6</);
  assert.match(s, /<b class="u1">1<\/b><small>atrasadas/, 'atrasada como no resto do mundo: a 3 tem o prazo vencido');
  assert.ok(html.indexOf('data-vv-cli-secao="mes"') < html.indexOf('data-vv-cli-secao="espera"'), 'o mês vem antes da operação');
});

test('visão única: Carteira e Comercial alimentam saúde, contrato, financeiro e clima; dinheiro só para donos e admin', () => {
  const dono = visao({ socio: true, extra: { VybeCarteira: CARTEIRA, VybeComercial: COMERCIAL } });
  const html = dono.api.html('Padaria Sol');
  const saude = secao(html, 'saude');
  assert.match(saude, /vv-cli-tag u2">Atenção · 62/);
  assert.match(saude, /Pagamento atrasado[\s\S]*Grupo sem resposta há 5 dias/);
  const negocio = secao(html, 'negocio');
  assert.match(negocio, /Plano<\/dt><dd>Social \+ Tráfego/);
  assert.match(negocio, /Mensalidade<\/dt><dd>R\$\s?2\.500,00/);
  assert.match(negocio, /Renovação<\/dt><dd>10\/01\/2027/);
  assert.match(negocio, /Em aberto<\/dt><dd>R\$\s?1\.200,50/);
  assert.match(negocio, /Situação<\/dt><dd>Atrasado/);
  assert.match(secao(html, 'clima'), /Cliente cobrou a arte do sábado/);

  const equipe = visao({ socio: false, extra: { VybeCarteira: CARTEIRA, VybeComercial: COMERCIAL } });
  const h2 = equipe.api.html('Padaria Sol');
  assert.ok(!h2.includes('data-vv-cli-secao="negocio"'), 'equipe não vê contrato nem financeiro');
  assert.ok(h2.includes('data-vv-cli-secao="saude"'), 'a saúde todos veem');
  const admin = visao({ admin: true, extra: { VybeCarteira: CARTEIRA } });
  assert.ok(admin.api.html('Padaria Sol').includes('data-vv-cli-secao="negocio"'));
});

test('visão única: sem Carteira, a saúde vem da Gestão (VybeDono)', () => {
  const amb = visao({ extra: {} });
  vm.runInContext(readFileSync('vybe-dono-metricas.js', 'utf8'), amb.c);
  const s = secao(amb.api.html('Padaria Sol'), 'saude');
  assert.match(s, /vv-cli-tag u2">Atenção/);
  assert.match(s, /1 peça com o prazo interno vencido/); // a peça 3 (prazo 08/11)
  assert.match(s, /Pela produção/);
});

test('visão única: objetivo e aprovação pelo VybeConteudo; botão do relatório chama VybeRelatorio.abrir', () => {
  const abertos = [];
  const { api } = visao({ extra: {
    VybeConteudo: { dados: () => ({ 1: { objetivo: 'Conversão', aprovacao: 'Aprovada' }, 4: { objetivo: 'Atração' } }) },
    VybeRelatorio: { abrir: (...a) => abertos.push(a) },
  } });
  const html = api.html('Padaria Sol');
  const s = secao(html, 'mes');
  assert.match(s, /vv-cli-obj conversao">Conversão[^<]*<\/span>[^<]*aprovação: Aprovada/);
  assert.match(s, /vv-cli-equilibrio/);
  assert.match(s, /Conversão <b>50%<\/b>/);
  const { raiz, clicar } = domFalso(html);
  api.ligar(raiz);
  clicar({ vvCliRelatorio: '2026-11' });
  assert.deepEqual(abertos, [['Padaria Sol', '2026-11']]);
});

test('visão única: cérebro do cliente com o estudo do VYBES e o botão do canvas', () => {
  const { api } = visao({ extra: {
    abrirModalCerebroCliente: () => {},
    encontrarBaseCerebro: () => ({ segmento: 'Padaria artesanal', tom: 'Acolhedor e simples.', paleta: [{ nome: 'Trigo', hex: '#E8C07A' }, { nome: 'ruim', hex: 'red;x' }] }),
  } });
  const s = secao(api.html('Padaria Sol'), 'cerebro');
  assert.match(s, /Padaria artesanal[\s\S]*Acolhedor e simples/);
  assert.match(s, /background:#E8C07A/);
  assert.ok(!s.includes('red;x'), 'cor fora do formato não entra no estilo');
  assert.match(s, /data-cerebro-cliente="Padaria Sol">Abrir o cérebro/);
});
