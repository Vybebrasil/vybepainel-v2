// O assistente do Deivid na Criação (vybe-mundo-criacao.js): a conversa do dia, delegar pela carga e pelo que cada um já
// fez, cobrar o que parou, confirmado × sugestão por cliente e o que mudou. Nada grava sem Aprovar → Confirmar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function carregar() {
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, Intl, setTimeout, CustomEvent: class {},
    document: { addEventListener() {}, dispatchEvent() {} }, localStorage: { getItem: () => null, setItem() {} } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-criacao.js', 'utf8'), ctx);
  return ctx.VybeCriacao.util;
}
const json = (x) => JSON.parse(JSON.stringify(x));
const HOJE = '2026-11-10';
const DEIVID = '1', BIA = '2', JADY = '3', RERISTON = '4';
const time = [{ id: DEIVID, name: 'Deivid', disciplina: 'design' }, { id: BIA, name: 'Bia', disciplina: 'design' }, { id: JADY, name: 'Jady', disciplina: 'design' }, { id: RERISTON, name: 'Reriston', disciplina: 'audiovisual' }];
const peso = (d) => (/reels/i.test(d.formato || '') ? 3 : /carrossel/i.test(d.formato || '') ? 2 : 1);
const limite = (u) => (String(u.id) === RERISTON ? 24 : 14);
const finalizada = (d) => d.status === 'Finalizado';
const peca = (id, o) => ({ id, nome: 'Peça ' + id, cliente: 'VOA', formato: 'Card', status: 'A fazer', responsavel_ids: [BIA], ...o });

test('perfil: carga pelo peso do formato, entregas de 90 dias por formato e cliente, e a mediana cadastro → entrega', () => {
  const U = carregar();
  const todas = [peca(1, { formato: 'Carrossel' }), peca(2), peca(3, { status: 'Finalizado', status_updated_at: '2026-11-05T15:00:00Z', criado_em: '2026-11-01' }),
    peca(4, { status: 'Finalizado', status_updated_at: '2026-11-08', criado_em: '2026-11-04', cliente: 'Hebravet' }), peca(5, { status: 'Finalizado', status_updated_at: '2026-07-01', criado_em: '2026-06-20' })];
  const [p] = U.perfis({ todas, time: [time[1]], hoje: HOJE, peso, limite, finalizada });
  assert.equal(p.carga, 3); assert.equal(p.abertas, 2); assert.equal(p.entregues, 2, 'entrega de julho fica fora dos 90 dias');
  assert.deepEqual(json(p.porFormato), { Card: 2 }); assert.deepEqual(json(p.porCliente), { VOA: 1, Hebravet: 1 }); assert.equal(p.dias, 4);
});

test('delegar: tira produção simples da mesa do Deivid e de quem passou do limite, para a mesma disciplina, sem lotar ninguém', () => {
  const U = carregar();
  const perfis = [{ id: DEIVID, nome: 'Deivid', disciplina: 'design', carga: 5, limite: 14, porFormato: {}, porCliente: {}, dias: null },
    { id: BIA, nome: 'Bia', disciplina: 'design', carga: 16, limite: 14, porFormato: { Card: 9 }, porCliente: { VOA: 4 }, dias: 2 },
    { id: JADY, nome: 'Jady', disciplina: 'design', carga: 12, limite: 14, porFormato: { Card: 3 }, porCliente: { VOA: 6 }, dias: 3 },
    { id: RERISTON, nome: 'Reriston', disciplina: 'audiovisual', carga: 2, limite: 24, porFormato: {}, porCliente: {}, dias: 1 }];
  const x = (d, ids) => ({ d, ids, sit: 'fazer' });
  const itens = [x(peca(10, { responsavel_ids: [DEIVID], veiculacao_iso: '2026-11-13' }), [DEIVID, DEIVID]), // o painel repete o id (responsavel_ids + responsavel_id)
    x(peca(11, { veiculacao_iso: '2026-11-12' }), [BIA]), x(peca(12, { veiculacao_iso: '2026-11-14' }), [BIA]),
    x(peca(13, { status: 'Em andamento' }), [BIA]), x(peca(14, { formato: 'Reels' }), [BIA])];
  const s = U.sugerirDelegacoes({ itens, perfis, hoje: HOJE, peso, deivid: DEIVID });
  assert.equal(s[0].id, '10', 'a mesa do Deivid primeiro'); assert.equal(s[0].para.id, JADY);
  assert.match(s[0].porque, /Deivid fica livre para a direção de arte/);
  assert.ok(s.every((d) => d.para.id !== DEIVID), 'nunca empurra peça para o Deivid');
  assert.ok(!s.some((d) => d.id === '13'), 'peça já em andamento não troca de mão');
  assert.equal(s.find((d) => d.id === '14')?.para.id, RERISTON, 'Reels vai para quem faz vídeo');
  assert.equal(s.filter((d) => d.para.id === JADY).length, 2, 'a Jady tem folga de 2 pontos: não recebe mais do que cabe');
  assert.ok(!s.some((d) => d.id === '12'), 'sem folga em ninguém do design, a peça fica onde está');
});

test('cobrar: parada com a data chegando ou prazo vencido; aprovação fica fora; quando e como destravar', () => {
  const U = carregar(), x = (d, quem = ['Bia'], sit = 'fazer') => ({ d, ids: [BIA], quem, sit });
  const c = U.sugerirCobrancas({ hoje: HOJE, agora: new Date('2026-11-10T10:00:00-03:00'), itens: [
    x(peca(20, { status: 'Em andamento', status_updated_at: '2026-11-06', veiculacao_iso: '2026-11-11' })),
    x(peca(21, { status: 'Para aprovação', status_updated_at: '2026-11-01', veiculacao_iso: '2026-11-11' })),
    x(peca(22, { status: 'Alteração', prazo_iso: '2026-11-08', veiculacao_iso: '2026-11-13', status_updated_at: '2026-11-09' })),
    x(peca(23, { status: 'Em andamento', status_updated_at: '2026-11-09', veiculacao_iso: '2026-11-12' })),
    x(peca(24, { status: 'Aguardando informação', status_updated_at: '2026-11-05', veiculacao_iso: '2026-11-14' }))] });
  assert.deepEqual(json(c.map((s) => s.id)), ['20', '22', '24']);
  assert.equal(c[0].oque, 'mandar a prévia'); assert.equal(c[0].quando, 'agora'); assert.equal(c[0].parado, 4);
  assert.match(c[0].mensagem, /^Bia, sobre "Peça 20" \(VOA\): parada há 4 dias em Em andamento/);
  assert.deepEqual(json(c[0].para), [BIA], 'para quem o bot manda: os ids de quem responde pela peça');
  assert.equal(c[1].oque, 'devolver o ajuste'); assert.equal(c[1].quando, 'hoje até as 14h');
  assert.match(c[2].destravar, /head do cliente/, 'esperando informação: destrava com o head antes de cobrar o time');
});

test('clientes: confirmado são as peças abertas; sugestão vem das regras e dos achados do Danilo, sempre separada', () => {
  const U = carregar();
  const x = (d) => ({ d, ids: [BIA], sit: 'fazer' });
  const itens = [x(peca(30, { status: 'Alteração' })), x(peca(31, { status: 'Ajuste' })), x(peca(32, { cliente: 'DiaLab' }))];
  const passado = [1, 2, 3, 4].map((i) => peca(40 + i, { status: 'Finalizado', veiculacao_iso: `2026-11-0${i}` }));
  const r = U.clientesConfirmadoSugestao({ itens, todas: [...itens.map((i) => i.d), ...passado], hoje: HOJE, finalizada,
    achados: [{ cliente: 'DiaLab', fato: 'Capas de Reels com 3 fontes diferentes', sugestao: 'Padronizar', ref: 'vybe:32', chave: 'k1' }] });
  const voa = r.find((c) => c.cliente === 'VOA'), dl = r.find((c) => c.cliente === 'DiaLab');
  assert.equal(voa.confirmadas.length, 2);
  assert.ok(voa.sugestoes.some((s) => /Nada marcado para ir ao ar até 16\/11/.test(s.texto)), 'buraco no calendário de quem costuma postar');
  assert.ok(voa.sugestoes.some((s) => /2 peças voltaram para ajuste/.test(s.texto)));
  assert.ok(voa.sugestoes.every((s) => s.origem === 'regra'));
  assert.deepEqual(json(dl.sugestoes), [{ origem: 'danilo', texto: 'Capas de Reels com 3 fontes diferentes · Padronizar', ref: 'vybe:32', chave: 'k1' }]);
});

test('mudanças desde a última olhada: nova 1ª, novo ajuste e nova atrasada', () => {
  const U = carregar(), x = (id, sit, status) => ({ d: { id, nome: 'P' + id, status }, sit });
  const antes = U.foto([x(1, 'fazer', 'A fazer'), x(2, 'fazer', 'A fazer')]);
  const m = U.mudancas(antes, U.foto([x(2, 'atrasada', 'A fazer'), x(1, 'fazer', 'Alteração'), x(3, 'fazer', 'A fazer')]));
  assert.equal(m.novaPrimeira, '2'); assert.deepEqual(json(m.novosAjustes), [{ id: '1', nome: 'P1' }]); assert.deepEqual(json(m.novasAtrasadas), [{ id: '2', nome: 'P2' }]);
  assert.deepEqual(json(U.mudancas(null, antes)), { novasAtrasadas: [], novosAjustes: [], novaPrimeira: '' });
});

test('a conversa: frases de guia na ordem do guia (primeiro, depois, enquanto isso, cobre, sua mesa)', () => {
  const U = carregar(), x = (id, o = {}) => ({ d: { id, nome: 'Peça ' + id, cliente: 'VOA', ...o }, quem: ['Bia'], ids: [BIA] });
  const ordem = [x(1), x(2), x(3)];
  const f = U.frasesDoDia({ ordem, motivo: () => 'Vai ao ar hoje', aprovar: [ordem[2]], deHoje: 1, atrasadas: 0, hoje: HOJE, souDeivid: true,
    delegacoes: [{ nome: 'Capa', cliente: 'VOA', de: { nome: 'Deivid' }, para: { nome: 'Jady Silva' } }], cobrancas: [{ nome: 'Card', cliente: 'VOA', quem: ['Bia'], quando: 'agora', oque: 'mandar a prévia' }], minhas: [ordem[1]] });
  assert.match(f[0], /^Hoje 1 peça do time vai ao ar; 1 espera aprovação\./);
  assert.match(f[1], /^Primeiro, <b>Peça 1<\/b> \(VOA\): vai ao ar hoje, com Bia\./);
  assert.match(f[2], /^Depois, confira e aprove <b>Peça 3<\/b>/);
  assert.match(f[3], /^Enquanto isso, passe <b>Capa<\/b> \(VOA\) de Deivid para <b>Jady<\/b>/);
  assert.match(f[4], /^Cobre Bia agora sobre <b>Card<\/b>/); assert.match(f[5], /^Na sua mesa: 1 peça/);
  const g = U.frasesDoDia({ ordem, motivo: () => 'Vai ao ar hoje', aprovar: [], hoje: HOJE, delegacoes: [{ id: 1, nome: 'Peça 1', de: { nome: 'Deivid' }, para: { nome: 'Jady' } }] });
  assert.match(g[1], /passe para <b>Jady<\/b> \(aprove abaixo\)/, 'a peça do topo que está para delegar não vira "faça" e "passe" ao mesmo tempo');
  assert.ok(!g.some((t) => /^Enquanto isso/.test(t)));
  assert.deepEqual(json(U.frasesDoDia({ ordem: [] })), ['O time está sem peças em aberto. Bom momento para olhar as sugestões dos clientes abaixo.']);
});

// A tela inteira, com o painel de mentira: o clique em Cobrar → Confirmar pede o envio (area=cobrancas) e a caixa passa
// a mostrar o que houve com cada pessoa (aguardando o bot, mandou, falhou com o motivo).
test('cobrar pelo WhatsApp: Confirmar pede o envio com os ids de quem responde pela peça e a caixa mostra o estado', async () => {
  const ouvintes = {}, chamadas = [], historico = [], relogios = [];
  let lista = [];
  const resposta = (corpo, ok = true) => ({ ok, json: async () => corpo });
  const ctx = { console, Date, JSON, Promise, Math, Number, String, Array, Object, Set, Map, Error, Intl, CustomEvent: class {},
    setTimeout: (f) => { relogios.push(f); return relogios.length; }, clearTimeout() {}, localStorage: { getItem: () => null, setItem() {} },
    document: { addEventListener: (tipo, f) => { (ouvintes[tipo] ||= []).push(f); }, dispatchEvent() {} },
    PESSOAS: { DEIVID }, souDonoDaSessao: () => true, hojeDeVerdade: () => HOJE, showToast() {},
    findOperationalItem: (id) => ({ id, nome: 'Peça ' + id }), postItemUpdate: async (id, texto) => { historico.push([id, texto]); return true; },
    fetch: async (url, o = {}) => {
      chamadas.push([url, o.method || 'GET', o.body ? JSON.parse(o.body) : null]);
      if (!String(url).includes('area=cobrancas')) return resposta({ perfil: { achados: { abertos: [] } } });
      if (o.method === 'POST') { lista = [{ id: 5, ref: '20', conteudo_id: 20, pessoa: 'Bia Souza', setor: 'design', agente: 'Danilo', estado: 'pedido', motivo: '', texto: 'Bia, sobre "Peça 20"…' }]; return resposta({ ok: true, cobrancas: lista }); }
      return resposta({ ok: true, cobrancas: lista });
    } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync('vybe-mundo-criacao.js', 'utf8'), ctx);
  const d = peca(20, { status: 'Em andamento', status_updated_at: '2026-11-06', veiculacao_iso: '2026-11-11' });
  const item = { d, ids: [BIA, DEIVID], quem: ['Bia', 'Deivid'], sit: 'fazer' };
  const membros = time.map((u) => ({ id: u.id, name: u.name }));
  const pintar = () => ctx.VybeCriacao.assistente({ itens: [item], todas: [d], ordem: [item], motivo: () => '', aprovar: [], deHoje: 0, atrasadas: 0, membros, peso, limite, finalizada, eu: DEIVID }).sugestoes;
  const esperar = () => new Promise((ok) => setImmediate(ok));
  const reler = async () => { relogios.pop()(); await esperar(); await esperar(); };
  const clicar = (attrs) => { for (const f of ouvintes.click) f({ target: { closest: () => ({ dataset: attrs, hasAttribute: (n) => n in attrs }) } }); };
  let html = pintar(); await esperar();
  assert.match(html, /data-vcr-aprovar="cobrar:20:2026-11-10">Cobrar<\/button>/);
  assert.match(html, /Cobrar manda no WhatsApp da pessoa e fica no histórico da peça\./);
  assert.match(html, /<b>Fila do Danilo<\/b>/, 'padrão v2: a fila com o nome do quadro');
  clicar({ vcrAprovar: 'cobrar:20:2026-11-10' });
  assert.match(pintar(), /Mandar a cobrança no WhatsApp de Bia e deixar no histórico da peça\?/, 'o primeiro clique só pergunta; o Deivid não cobra a si mesmo');
  assert.ok(!chamadas.some((c) => c[1] === 'POST'));
  clicar({ vcrConfirmar: 'cobrar:20:2026-11-10' }); await esperar(); await esperar();
  const post = chamadas.find((c) => c[1] === 'POST');
  assert.equal(post[0], '/api/painel?area=cobrancas');
  assert.deepEqual(json(post[2]), { acao: 'pedir', item: '20', para: [BIA], oque: 'mandar a prévia', quando: 'agora', por: 'parada há 4 dias em Em andamento · vai ao ar 11/11' });
  assert.match(historico[0][1], /Envio: pedido ao VYBES pelo WhatsApp \(Danilo\)$/);
  html = pintar();
  assert.match(html, /class="vcr-msg espera" role="status">Danilo vai mandar para Bia no WhatsApp\. Aguardando o bot…/);
  assert.doesNotMatch(html, /data-vcr-aprovar="cobrar:20/, 'pedido a caminho: sem botão para cobrar de novo');
  // O bot mandou.
  lista[0] = { ...lista[0], estado: 'enviado', resolvido_em: '2026-11-10T17:32:00.000Z' };
  assert.ok(relogios.length >= 1, 'enquanto espera o bot, a tela marca a próxima leitura');
  await reler(); html = pintar();
  assert.match(html, /class="vcr-msg" role="status">Danilo mandou para Bia no WhatsApp às 14:32\./);
  // O bot não conseguiu: o motivo aparece, com tentar de novo e copiar a mensagem.
  lista[0] = { ...lista[0], estado: 'falhou', motivo: 'Bia não está com o WhatsApp vinculado ao VYBES.' };
  ctx.VybeCriacao.util.relerCobrancas(); await esperar(); await esperar(); html = pintar();
  assert.match(html, /class="vcr-msg erro" role="status">Não foi para Bia: Bia não está com o WhatsApp vinculado ao VYBES\./);
  assert.match(html, /data-vcr-aprovar="cobrar:20:2026-11-10">Tentar de novo<\/button><button type="button" class="vc-sec" data-vcr-copiar="cobrar:20:2026-11-10"/);
});

test('nada sem o OK: aprovar só pede confirmação; grava pelas funções do painel; pergunta livre pela rota do VYBES', () => {
  const js = readFileSync('vybe-mundo-criacao.js', 'utf8'), mundo = readFileSync('vybe-mundo.js', 'utf8'), html = readFileSync('index.html', 'utf8');
  assert.match(js, /if \(b\.dataset\.vcrAprovar\) \{ st\.confirmando = b\.dataset\.vcrAprovar; repintar\(\); return; \}/, 'o primeiro clique não grava');
  assert.match(js, /await G\.gravarResponsaveisDaPeca\(item, novos\)/); assert.match(js, /await G\.postItemUpdate\(item\.id, `\[Vybe OS · Cobrança da Direção de Arte\]/);
  assert.match(js, /G\.VybePeca\?\.abrir\?\.\(s\.id, \{ achado:/, '"Ver antes" abre a peça de sempre');
  assert.match(js, /etapa: 'perguntar', texto:/); assert.match(js, /etapa=perfil&setor=design/);
  assert.match(js, /if \(!ok\) \{ st\.msg\[chave\] = \{ erro: true, texto: 'O pedido de envio foi registrado, mas a nota no histórico/, 'erro do histórico não vira sucesso');
  assert.match(js, /fetch\('\/api\/painel\?area=cobrancas', \{ method: 'POST'/, 'Cobrar pede o envio pelo WhatsApp (server/cobrancas-whatsapp.js)');
  assert.match(js, /if \(d\) st\.feitas\.add\(chave\)/, 'a cobrança continua na tela, com o estado do envio');
  assert.match(mundo, /window\.VybeCriacao\?\.assistente\?\.\(\{ itens, todas, ordem,/, 'a Criação continua em pintarCriacao');
  assert.match(mundo, /daEffortWeight\(d, u\)/, 'peso da regra do painel de direção de arte, sem cópia');
  assert.match(mundo, /document\.addEventListener\('vybe:criacao', \(\) => pintarHoje\(\)\);/);
  assert.ok(html.indexOf('/vybe-mundo-peca.js') < html.indexOf('/vybe-mundo-criacao.js'));
  assert.doesNotMatch(readFileSync('vybe-mundo.css', 'utf8').split('Criação: o assistente do Deivid')[1], /!important|html body\.mundo/);
});
