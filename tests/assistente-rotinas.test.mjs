import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { conexao } from './postgres.mjs';
import { rotinaDoDia, codigoDoPainel, itensDoDia } from '../server/assistente-rotinas.js';
import { atenderBotAssistente } from '../server/assistente-servico.js';
import { identificadorProtegido } from '../server/assistente-identidade.js';

const PROD = 7829537690, DEM = 8385559107, dia = '2026-10-26';
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,monday_user_id text,ativo boolean,pode_entrar boolean,senha_hash text,admin boolean);
    CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text,final boolean);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,board_id bigint,titulo text,formato text,etapa text,prazo date,veiculacao date,status_em timestamptz,briefing text,status_chave text,monday_item_id text,removido_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint,ordem int);
    CREATE TABLE vybe_ai_vinculos(id bigserial,pessoa_id bigint,jid_hash char(64) UNIQUE,criado_em timestamptz DEFAULT NOW(),revogado_em timestamptz);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins','68035537',true,true,'x',true),(2,'Deivid Souza','68997024',true,true,'x',false),
      (3,'Jady Amynne Oliveira Lima','100482777',true,true,'x',false),(4,'Tainara Lima','80146924',true,true,'x',false);
    INSERT INTO vybe_clientes VALUES (10,'Cliente A'),(11,'Cliente B');
    INSERT INTO vybe_status VALUES (${PROD},'pode_fazer','Pode Fazer',false),(${PROD},'finalizado','Finalizado',true),(${PROD},'para_agendar','Para agendar',true),
      (${PROD},'para_aprovacao','Para aprovação',false),(${PROD},'ag_aprovacao_cliente','Ag. Aprovação Cliente',false),(${DEM},'nova_demanda','Nova Demanda',false),(${DEM},'feito','Feito',true);
    INSERT INTO vybe_conteudos VALUES
      (100,${PROD},'Card - Promo','Card',NULL,'${dia}','${dia}',NULL,'briefing','para_aprovacao','m100',NULL),
      (101,${PROD},'Reels - Bastidor','Reels',NULL,'2026-10-24','${dia}',NULL,'b','pode_fazer','m101',NULL),
      (102,${PROD},'Carrossel - Dicas','Carrossel',NULL,'2026-10-24','${dia}',NULL,'b','finalizado','m102',NULL),
      (103,${PROD},'Card - Agendar','Card',NULL,'2026-10-24','${dia}',NULL,'b','para_agendar','m103',NULL),
      (104,${PROD},'Story - Cliente decide','Story',NULL,'2026-10-24','${dia}',NULL,'b','ag_aprovacao_cliente','m104',NULL),
      (105,${PROD},'Removido','Card',NULL,'${dia}','${dia}',NULL,'b','pode_fazer','m105','2026-10-01'),
      (200,${DEM},'Panfleto evento','Impresso',NULL,'2026-10-25','${dia}',NULL,NULL,'nova_demanda','d200',NULL),
      (201,${DEM},'Antiga concluída','Impresso',NULL,'2026-01-01','2026-01-02',NULL,NULL,'feito','d201',NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (100,10),(101,10),(102,11),(103,10),(104,11),(105,10),(200,11),(201,11);
    INSERT INTO vybe_conteudo_responsaveis VALUES (100,3,0),(101,2,0),(102,3,0),(103,4,0),(104,3,0),(200,2,0);`);
  return { db, sql };
}

test('painel: gerador, tradução de status e equipe vêm dos arquivos do próprio painel', () => {
  const { ctx, equipe } = codigoDoPainel();
  assert.equal(typeof ctx.resumosPorGrupo, 'function');
  assert.equal(ctx.operationalFlowStatus({ origem: 'solicitacao', status: 'Nova Demanda' }), 'A Fazer');
  assert.deepEqual(equipe.map((p) => p.nome), ['Reriston', 'Bia', 'Deivid', 'Jady', 'Paulo', 'Vinícius', 'Ewerton']);
  assert.equal(equipe.find((p) => p.nome === 'Deivid').aprovacoesExtras, true);
});

test('itens: mesmos campos do painel; Solicitação usa a conclusão; removidas e concluídas antigas ficam fora', async () => {
  const { db, sql } = await banco();
  try {
    const itens = await itensDoDia(sql, dia);
    assert.deepEqual(itens.map((i) => i.id).sort(), ['d200', 'm100', 'm101', 'm102', 'm103', 'm104']);
    const pedido = itens.find((i) => i.id === 'd200');
    assert.equal(pedido.origem, 'solicitacao'); assert.equal(pedido.conclusao_iso, dia); assert.equal(pedido.veiculacao_iso, dia);
    const card = itens.find((i) => i.id === 'm100');
    assert.deepEqual(card.responsavel_ids, ['100482777']); assert.equal(card.responsavel, 'Jady Amynne Oliveira Lima'); assert.equal(card.tem_briefing, true);
  } finally { await db.close(); }
});

test('manhã: é exatamente o texto do gerador do painel para os mesmos itens', async () => {
  const { db, sql } = await banco();
  try {
    const r = await rotinaDoDia(sql, { momento: 'manha', dia }, '2026-10-26T08:00:00-03:00');
    const ids = r.mensagens.map((m) => m.id);
    assert.ok(ids.includes('geral') && ids.includes('publicacoes') && ids.includes('criacao') && ids.includes('conferencia'));
    assert.ok(!ids.includes('producao')); // agenda de gravações vem do Google Agenda, fora desta rotina
    // Referência independente: o arquivo do painel rodado como nos testes do resumo.
    const itens = await itensDoDia(sql, dia), { ctx: painel, equipe } = codigoDoPainel();
    const ref = vm.createContext({ itens, dia, equipe, statusDoPainel: (i) => painel.operationalFlowStatus(i) });
    vm.runInContext(fs.readFileSync('vybe-resumo.js', 'utf8'), ref);
    const esperado = vm.runInContext(`resumosPorGrupo(itens,dia,{statusDe:statusDoPainel,clientesDe:i=>i.clientes,equipe,geradoEm:'2026-10-26T08:00:00-03:00'})`, ref);
    assert.match(r.mensagens.find((m) => m.id === 'geral').texto, /Panfleto evento .* · A Fazer ·/); // status traduzido como no painel
    assert.equal(r.mensagens.find((m) => m.id === 'geral').texto, esperado.find((m) => m.id === 'geral').texto);
    assert.match(r.mensagens.find((m) => m.id === 'publicacoes').texto, /^Bom dia, Tai!/);
    assert.match(r.mensagens.find((m) => m.id === 'criacao').texto, /Deivid · aprovações extras[\s\S]*Card - Promo/);
    assert.equal(r.base.data, dia);
    assert.deepEqual(r.base.itens.map((x) => x.id).sort(), ['m100', 'm101', 'm102', 'm103', 'm104']);
    assert.ok(painel); assert.equal(r.equipe.find((p) => p.nome === 'Deivid').id, '68997024');
  } finally { await db.close(); }
});

test('meio-dia e fim do dia: risco, espera do cliente, prazo vencido e percentual', async () => {
  const { db, sql } = await banco();
  try {
    const meio = (await rotinaDoDia(sql, { momento: 'meio_dia', dia })).mensagens[0].texto;
    assert.match(meio, /^🕐 \*Meio-dia, como estamos\? Seg 26\/10\*/);
    assert.match(meio, /Conteúdos que veiculam hoje: 5 · ✅ 1 entregues · 📅 1 para agendar · ⏳ 3 em aberto/);
    // Dividido por status; dentro de cada status, o prazo mais antigo primeiro.
    assert.match(meio, /🔴 Veiculam hoje e ainda não saíram \(2\)\*\n_Para aprovação \(1\)_\n- Card - Promo \(Cliente A\) · Jady\n_Pode Fazer \(1\)_\n- Reels - Bastidor \(Cliente A\) · Deivid/);
    assert.match(meio, /🟡 Veiculam hoje, esperando o cliente \(1\)/);
    assert.match(meio, /Solicitações com conclusão hoje em aberto \(1\)\*\n_A Fazer \(1\)_\n- Panfleto evento \(Cliente B\) · Deivid/);
    assert.match(meio, /⚠️ 2 atividades com prazo vencido/);
    // Aguardo / Aguardo Redação com prazo hoje: fora da cobrança, como no gerador do painel.
    await sql`INSERT INTO vybe_status VALUES (${PROD},'aguardo','Aguardo',false)`;
    await sql`INSERT INTO vybe_conteudos VALUES (106,${PROD},'Reels - Esperando gravação','Reels',NULL,${dia},'2026-10-30',NULL,'b','aguardo','m106',NULL)`;
    await sql`INSERT INTO vybe_conteudo_responsaveis VALUES (106,1,0)`;
    const meio2 = (await rotinaDoDia(sql, { momento: 'meio_dia', dia })).mensagens[0].texto;
    assert.doesNotMatch(meio2, /Esperando gravação/);
    assert.match(meio2, /⏳ 1 com prazo hoje aguardando informação, redação ou gravação \(fora da cobrança\)/);
    const fim = (await rotinaDoDia(sql, { momento: 'fim_dia', dia })).mensagens[0].texto;
    assert.match(fim, /^🌙 \*Fechamento de Seg 26\/10\*\n\n📊 20% dos conteúdos de hoje entregues: 1 de 5/);
    assert.match(fim, /🔴 Não saíram hoje \(3\)/); assert.match(fim, /Amanhã \(Ter 27\/10\): 0 conteúdos/);
  } finally { await db.close(); }
});

test('validação: momento, dia e base anterior', async () => {
  for (const p of [{ momento: 'noite', dia }, { momento: 'manha', dia: '26/10' }, { momento: 'manha', dia, baseAnterior: { data: dia, itens: [{ id: 1 }] } }])
    await assert.rejects(() => rotinaDoDia(() => { throw Error('não consultar'); }, p), TypeError);
});

test('endpoint: rotina só para administrador vinculado, no privado', async () => {
  const { db, sql } = await banco();
  const segredo = 's'.repeat(40), grupo = '123456789-123@g.us', admin = '1111111111@lid', jady = '3333333333@lid';
  const config = { VYBE_AI_ATIVA: '1', VYBE_AI_BOT_TOKEN: 'A'.repeat(64), VYBE_AI_LINK_SECRET: segredo, VYBE_AI_GRUPOS_IDS: grupo, VYBE_AI_ESCOPO: 'equipe' };
  try {
    await sql`INSERT INTO vybe_ai_vinculos(pessoa_id,jid_hash) VALUES (1,${identificadorProtegido(admin, segredo)}),(3,${identificadorProtegido(jady, segredo)})`;
    const chamar = async (jid, contexto, rotina) => {
      const res = { status(n) { this.codigo = n; return this; }, json(d) { this.dados = d; return this; } };
      await atenderBotAssistente({ method: 'POST', headers: { authorization: 'Bearer ' + config.VYBE_AI_BOT_TOKEN }, body: { jid, contexto, consulta: 'rotina', rotina } }, res, () => sql, config);
      return res;
    };
    const privado = (j) => ({ tipo: 'privado', participantes: [j], grupos_remetente: [grupo], observado_em: Date.now() });
    const ok = await chamar(admin, privado(admin), { momento: 'meio_dia', dia });
    assert.equal(ok.codigo, 200); assert.match(ok.dados.mensagens[0].texto, /Meio-dia/);
    assert.equal((await chamar(jady, privado(jady), { momento: 'meio_dia', dia })).codigo, 403);
    assert.equal((await chamar(admin, { tipo: 'grupo', grupo_id: grupo, participantes: [admin, jady], grupos_remetente: [grupo], observado_em: Date.now() }, { momento: 'meio_dia', dia })).codigo, 403);
    assert.equal((await chamar(admin, privado(admin), { momento: 'x', dia })).codigo, 400);
  } finally { await db.close(); }
});

test('dia da agência: resumo com as regras da rotina e o que cada pessoa tem aberto hoje', async () => {
  const { mensagemDiaAgencia } = await import('../server/assistente-rotinas.js');
  const dia = '2026-10-26';
  const item = (nome, status, responsavel, extra = {}) => ({ id: nome, nome, status, responsavel, responsavel_ids: responsavel ? ['1'] : [], clientes: ['Cli'],
    origem: 'producao_conteudo', veiculacao_iso: dia, prazo_iso: dia, ...extra });
  const itens = [
    item('Card A', 'Finalizado', 'Jady Lima'),
    item('Card B', 'Pode Fazer', 'Jady Lima, Deivid Souza'),
    item('Reels C', 'Em andamento', 'Reriston Souza'),
    item('Card velho', 'Pode Fazer', 'Jady Lima', { prazo_iso: '2026-10-20', veiculacao_iso: '2026-10-30' }),
    item('Pedido', 'A Fazer', 'Deivid Souza', { origem: 'solicitacao', conclusao_iso: dia }),
  ];
  const t = mensagemDiaAgencia(itens, dia, (i) => i.status, 'Seg 26/10');
  assert.match(t, /^🏢 \*Dia da agência · Seg 26\/10\*/);
  assert.match(t, /📊 Veiculam hoje: 3 · ✅ 1 entregues · 📅 0 para agendar · ⏳ 2 em aberto/);
  assert.match(t, /📌 Solicitações com conclusão hoje: 1 · 1 em aberto/);
  assert.match(t, /⚠️ 1 atividade\(s\) com prazo vencido/);
  assert.match(t, /\*Deivid\* — ⏳ 2 em aberto\n- Card B \(Cli\) · Pode Fazer\n- Pedido \(Cli\) · A Fazer/);
  assert.match(t, /\*Jady\* — ✅ 1 · ⏳ 1 em aberto · 🔴 1 atrasada\(s\)\n- Card B \(Cli\) · Pode Fazer/);
  assert.match(t, /\*Reriston\* — ⏳ 1 em aberto\n- Reels C \(Cli\) · Em andamento/);
});

test('meu dia: só as peças da pessoa autenticada, com link, atrasadas e prazo amanhã', async () => {
  const { mensagemMeuDia } = await import('../server/assistente-rotinas.js');
  const dia = '2026-10-26';
  const item = (id, nome, status, ids, extra = {}) => ({ id, nome, status, responsavel: ids.map((x) => ({ 1: 'Jady Lima', 2: 'Deivid Souza' })[x]).join(', '), responsavel_ids: ids.map(String),
    clientes: ['Cli'], origem: 'producao_conteudo', veiculacao_iso: dia, prazo_iso: dia, ...extra });
  const itens = [item('11', 'Card pronto', 'Finalizado', [1]), item('12', 'Card aberto', 'Pode Fazer', [1, 2]), item('vybe:13', 'Do Deivid', 'Pode Fazer', [2]),
    item('14', 'Card velho', 'Pode Fazer', [1], { prazo_iso: '2026-10-20', veiculacao_iso: '2026-10-30' }), item('15', 'Card de amanhã', 'Pode Fazer', [1], { prazo_iso: '2026-10-27', veiculacao_iso: '2026-10-28' })];
  const t = mensagemMeuDia(itens, dia, (i) => i.status, 'Seg 26/10', { nome: 'Jady Lima', monday_id: '1' });
  assert.match(t, /^📅 \*Seu dia, Jady · Seg 26\/10\*\n\n✅ 1 pronta\(s\) hoje · ⏳ 1 em aberto · 🔴 1 atrasada\(s\)/);
  assert.match(t, /\*⏳ Em aberto hoje \(1\)\*\n- Card aberto \(Cli\) · Pode Fazer\n  🔗 https:\/\/vybepainel-v2\.vercel\.app\/\?atividade=12/);
  assert.match(t, /\*🔴 Atrasadas \(1\)\*\n- Card velho \(Cli\) · Pode Fazer · prazo 20\/10/);
  assert.match(t, /\*🔭 Prazo amanhã \(1\)\*\n- Card de amanhã/);
  assert.doesNotMatch(t, /Do Deivid/);
  assert.match(mensagemMeuDia([], dia, (i) => i.status, 'Seg 26/10', { nome: 'Jady Lima', monday_id: '1' }), /Nada previsto pra você/);
});

test('fechamento da semana: fechadas, quem executou, ranking, atrasadas e prévia da segunda', async () => {
  const { mensagemSemana } = await import('../server/assistente-rotinas.js');
  const t = mensagemSemana({ inicio: '2026-10-26', dia: '2026-10-30', producao: 40, solicitacoes: 3, execucao: new Map([['Jady', 12], ['Beatriz', 15]]), agendamento: new Map([['Tainara', 38]]),
    ranking: [{ posicao: 1, nome: 'Beatriz Rocha', xp: 900 }, { posicao: 2, nome: 'Jady Lima', xp: 700 }], agencia: { pecas: 43, meta: 40, pct: 108, bateu: true }, atrasadas: 4,
    segunda: { dia: '2026-11-02', conteudos: 12, prontos: 5, paraAgendar: 3, abertos: 4 } });
  assert.match(t, /^🏁 \*Fechamento da semana · 26\/10 a 30\/10\*\n\n📣 Conteúdos fechados: 40 · 📌 Solicitações concluídas: 3\n🎯 Agência: 43 de 40 peças da meta \(108%\) 🎉/);
  assert.match(t, /\*Quem executou\*: Beatriz 15 · Jady 12\n📅 Agendamento: Tainara 38/);
  assert.match(t, /\*Ranking da semana\*\n🥇 Beatriz · 900 XP\n🥈 Jady · 700 XP/);
  assert.match(t, /⚠️ Seguem atrasadas: 4\n🔭 Segunda \(02\/11\): 12 conteúdo\(s\) · ✅ 5 pronto\(s\) · 📅 3 para agendar · ⏳ 4 em aberto/);
});

test('resumo para o cliente: publicados, aguardando aprovação do cliente e próxima semana', async () => {
  const { mensagemResumoCliente } = await import('../server/assistente-rotinas.js');
  const t = mensagemResumoCliente({ cliente: 'Hebravet', inicio: '2026-10-26', dia: '2026-10-30',
    publicados: [{ titulo: 'Reels - Rotina interna', veiculacao: '2026-10-27' }], aprovacao: [{ titulo: 'Card - Vacina', veiculacao: '2026-11-03' }], proxima: [] });
  assert.match(t, /^Olá, time Hebravet! 👋 Segue o resumo da semana \(26\/10 a 30\/10\):\n\n✅ \*Publicados\* \(1\)\n- Reels - Rotina interna · 27\/10/);
  assert.match(t, /🕐 \*Aguardando a aprovação de vocês\* \(1\)\n- Card - Vacina · veicula 03\/11/);
  assert.match(t, /📅 \*Próxima semana\* \(0\)\n- Ainda sem conteúdos programados\.[\s\S]*— Equipe Vybe$/);
});

test('riscos: peça parada perto da veiculação vai para o responsável; sobrecarga vai para a administração', async () => {
  const { riscosDoDia } = await import('../server/assistente-rotinas.js');
  const dia = '2026-10-26';
  const item = (id, nome, status, ids, extra = {}) => ({ id, nome, status, responsavel: ids.map((x) => ({ 1: 'Jady Lima', 2: 'Deivid Souza', 3: 'Reriston Souza' })[x]).join(', '),
    responsavel_ids: ids.map(String), clientes: ['Cli'], origem: 'producao_conteudo', veiculacao_iso: '2026-10-27', prazo_iso: '2026-10-26', status_updated_at: '2026-10-20T10:00:00Z', ...extra });
  const itens = [
    item('11', 'Card parado', 'Pode Fazer', [1]),
    item('12', 'Card em aprovação', 'Para aprovação', [1]),
    item('13', 'Card mexido ontem', 'Pode Fazer', [2], { status_updated_at: '2026-10-25T10:00:00Z' }),
    item('14', 'Card longe', 'Pode Fazer', [2], { veiculacao_iso: '2026-11-10' }),
    ...[1, 2, 3, 4, 5, 6].map((n) => item('2' + n, 'Reels ' + n, 'Em andamento', [3], { prazo_iso: '2026-10-27', veiculacao_iso: '2026-11-05' })),
  ];
  const r = riscosDoDia(itens, dia, (i) => i.status);
  assert.deepEqual(r.pessoas.map((p) => [p.monday_id, p.ids]), [['1', ['11']]]);
  assert.match(r.pessoas[0].texto, /Risco de furo\* · Card parado \(Cli\)\nveicula 27\/10 e está em \*Pode Fazer\* há 6 dias\n🔗 https:\/\/vybepainel-v2\.vercel\.app\/\?atividade=11/);
  assert.match(r.sobrecarga, /Sobrecarga amanhã \(27\/10\)\*\n- Reriston: 6 peças com prazo amanhã\nCom pouca coisa: Jady, Deivid/);
  assert.equal(riscosDoDia(itens.slice(0, 4), dia, (i) => i.status).sobrecarga, null);
});
