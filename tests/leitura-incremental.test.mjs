// A leitura que baixa só o que mudou.
//
// O painel baixava o quadro inteiro — 604 KB, ~1.850 peças — de 15 em 15
// segundos para descobrir se alguma coisa tinha mudado. Em onze dias isso passou
// dos 5 GB de tráfego do plano grátis do Neon e derrubou o sistema inteiro.
//
// Estes testes cobrem as duas coisas que quebram numa leitura incremental, e que
// quebram CALADAS: mudança que não carimba a peça (e some da tela) e peça que sai
// do recorte (e fica na tela para sempre).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { aplicarRecorteECarimbo, listarConteudos, idsNoRecorte } from '../vybe_dominio_store.js';

const PRODUCAO = 7829537690;

async function banco() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_clientes (id int primary key, nome text, ativo boolean);
    CREATE TABLE vybe_pessoas (id int primary key, monday_user_id text, nome text);
    CREATE TABLE vybe_conteudos (
      id int primary key, monday_item_id text, titulo text, board_id bigint,
      prazo date, veiculacao date, removido_em timestamptz,
      formato_chaves text[] DEFAULT '{}', tipo_conteudo_chaves text[] DEFAULT '{}',
      prioridade_chave text, off_audio_chave text, status_chave text, status_em timestamptz,
      captacao_chave text, etapa text, grupo_id text, material_bruto text,
      clientes_texto text, monday_atualizado_em timestamptz,
      atualizado_em timestamptz NOT NULL DEFAULT NOW());
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, cor text, borda text,
      monday_index int, final boolean DEFAULT false, ativa boolean DEFAULT true, ordem int);
    CREATE TABLE vybe_captacao (chave text primary key, rotulo text, cor text, borda text,
      monday_index int, ativa boolean DEFAULT true, ordem int);
    CREATE TABLE vybe_opcoes (coluna_id text, chave text, rotulo text, cor text, borda text,
      indice int, ativa boolean DEFAULT true, ordem int);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id int, cliente_id int);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id int, pessoa_id int, ordem int);
    CREATE TABLE vybe_conteudo_editores (conteudo_id int, pessoa_id int, ordem int);
    CREATE TABLE vybe_conteudo_updates (id int primary key, conteudo_id int, corpo text, criado_em timestamptz, autor text);
    CREATE TABLE vybe_subitens (id int primary key, pai_id int, titulo text, status_chave text);
    INSERT INTO vybe_clientes VALUES (1,'Hebravet',true),(2,'ACE',true);
    ALTER TABLE vybe_pessoas ADD COLUMN papel text;
    ALTER TABLE vybe_pessoas ADD COLUMN disciplina text;
    ALTER TABLE vybe_pessoas ADD COLUMN foto_url text;
    INSERT INTO vybe_pessoas (id,monday_user_id,nome) VALUES (10,'68036697','Reriston'),(11,'68997024','Deivid');
    INSERT INTO vybe_status VALUES (${PRODUCAO},'pode_fazer','Pode Fazer','#0ff','#0ff',1,false,true,1);
    INSERT INTO vybe_opcoes VALUES ('lista_suspensa0__1','carrossel','Carrossel','#f0f','#f0f',1,true,1);
    INSERT INTO vybe_conteudos (id,monday_item_id,titulo,board_id,veiculacao,formato_chaves,clientes_texto,status_chave)
      VALUES (1,'900','Hebravet | Carrossel',${PRODUCAO},'2026-09-20',ARRAY['carrossel'],'Hebravet','pode_fazer'),
             (2,'901','ACE | Card',${PRODUCAO},'2026-09-21',ARRAY['carrossel'],'ACE','pode_fazer');
    INSERT INTO vybe_conteudo_clientes VALUES (1,1),(2,2);
  `);
  await aplicarRecorteECarimbo(sql);
  return sql;
}

// Congela o carimbo no passado para que qualquer toque posterior seja visível.
const envelhecer = async (sql) => {
  await sql`UPDATE vybe_conteudos SET atualizado_em = NOW() - INTERVAL '1 hour'`;
  return new Date(Date.now() - 30 * 60 * 1000).toISOString();
};
const mudaramDesde = async (sql, desde) =>
  (await sql`SELECT id FROM vybe_conteudos WHERE atualizado_em > ${desde}::timestamptz ORDER BY id`)
    .map((l) => l.id);

test('mexer no responsável carimba a peça, mesmo sem tocar na tabela dela', async () => {
  const sql = await banco();
  const desde = await envelhecer(sql);
  // É o que a automação faz ao passar a peça para o Reriston: escreve em OUTRA
  // tabela. Sem o gatilho, a tela nunca fica sabendo — e "a automação não
  // funcionou" volta a ser mistério, agora por outro motivo.
  await sql`INSERT INTO vybe_conteudo_responsaveis VALUES (1, 10, 0)`;
  assert.deepEqual(await mudaramDesde(sql, desde), [1]);

  // Tirar também é mudança: a regra de Finalizados esvazia o responsável.
  const desde2 = await envelhecer(sql);
  await sql`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id = 1`;
  assert.deepEqual(await mudaramDesde(sql, desde2), [1]);
});

test('editor, tarefa e nota de contexto também carimbam a peça', async () => {
  const sql = await banco();
  for (const escrever of [
    (s) => s`INSERT INTO vybe_conteudo_editores VALUES (2, 11, 0)`,
    (s) => s`INSERT INTO vybe_subitens VALUES (99, 2, 'Revisar arte', 'pode_fazer')`,
    (s) => s`INSERT INTO vybe_conteudo_updates VALUES (77, 2, 'Contexto de status: aguardando', NOW(), 'Paulo')`,
  ]) {
    const desde = await envelhecer(sql);
    await escrever(sql);
    assert.deepEqual(await mudaramDesde(sql, desde), [2]);
  }
});

test('desativar um cliente carimba todas as peças dele', async () => {
  const sql = await banco();
  const desde = await envelhecer(sql);
  // O caso da ACE: ela foi desativada e continuou aparecendo no painel. Nada na
  // peça mudou — mudou o cliente — e por isso nada avisou a tela.
  await sql`UPDATE vybe_clientes SET ativo = false WHERE id = 2`;
  assert.deepEqual(await mudaramDesde(sql, desde), [2]);

  // E ela sai do recorte na mesma hora: peça de cliente inativo não é peça do
  // painel. Sem isto ela ficaria na tela para sempre, porque a leitura
  // incremental só manda o que mudou — nunca o que deixou de existir.
  const norecorte = (await sql`SELECT id FROM vybe_conteudos_recorte
    WHERE board_id = ${PRODUCAO} ORDER BY id`).map((l) => l.id);
  assert.deepEqual(norecorte, [1]);
});

test('o recorte exclui apagada e sem data, e não vale para Demandas', async () => {
  const sql = await banco();
  await sql`UPDATE vybe_conteudos SET removido_em = NOW() WHERE id = 1`;
  await sql`UPDATE vybe_conteudos SET veiculacao = NULL WHERE id = 2`;
  const producao = await sql`SELECT id FROM vybe_conteudos_recorte WHERE board_id = ${PRODUCAO}`;
  assert.deepEqual(producao.map((l) => l.id), []);

  // Demanda é pedido, não peça agendada: sem data e sem cliente continua valendo.
  await sql`INSERT INTO vybe_conteudos (id,monday_item_id,titulo,board_id)
    VALUES (3,'902','Pedido solto',8385559107)`;
  const demandas = await sql`SELECT id FROM vybe_conteudos_recorte WHERE board_id = 8385559107`;
  assert.deepEqual(demandas.map((l) => l.id), [3]);
});

// ── a leitura incremental de ponta a ponta ────────────────────────────────────

const ler = (sql, opcoes = {}) => listarConteudos(PRODUCAO, { sql, ...opcoes });
// Afasta as peças da folga de cinco segundos. Sem isto elas acabaram de nascer e
// voltam em toda leitura incremental — que é a folga trabalhando, não defeito.
const assentar = (sql) => sql`UPDATE vybe_conteudos SET atualizado_em = NOW() - INTERVAL '1 minute'`;

test('a leitura inteira traz tudo; a incremental traz só o que mudou', async () => {
  const sql = await banco();
  await assentar(sql);
  const cheia = await ler(sql);
  assert.deepEqual(cheia.itens.map((i) => i.id), ['900', '901']);
  assert.equal(cheia.total_no_recorte, 2);
  assert.ok(cheia.assinatura, 'a assinatura do conjunto precisa viajar sempre');
  assert.ok(Array.isArray(cheia.status), 'a leitura inteira traz os catálogos');

  // Nada mudou desde agora: a resposta vem vazia, e é esse vazio que substitui
  // os 604 KB de quatro em quatro segundos.
  const parada = await ler(sql, { desde: cheia.gerado_em, catalogos: false });
  assert.deepEqual(parada.itens, []);
  assert.equal(parada.assinatura, cheia.assinatura, 'conjunto igual, assinatura igual');
  assert.equal(parada.status, undefined, 'catálogo não viaja na leitura incremental');

  // Uma peça muda: vem ela, e só ela.
  await sql`UPDATE vybe_conteudos SET titulo = 'Hebravet | Carrossel v2',
    atualizado_em = NOW() + INTERVAL '10 seconds' WHERE id = 1`;
  const depois = await ler(sql, { desde: cheia.gerado_em, catalogos: false });
  assert.deepEqual(depois.itens.map((i) => i.id), ['900']);
  assert.equal(depois.itens[0].nome, 'Hebravet | Carrossel v2');
});

test('a assinatura muda quando uma peça entra ou sai — e só então', async () => {
  const sql = await banco();
  const { assinatura: inicial } = await ler(sql);

  // Editar uma peça não mexe no conjunto: a lista de ids continua a mesma.
  await sql`UPDATE vybe_conteudos SET titulo = 'outro nome' WHERE id = 1`;
  assert.equal((await ler(sql, { catalogos: false })).assinatura, inicial);

  // Desativar o cliente tira a peça do recorte — e AÍ a assinatura muda. É o
  // único aviso que a tela tem de que precisa apagar alguma coisa.
  await sql`UPDATE vybe_clientes SET ativo = false WHERE id = 2`;
  const depois = await ler(sql, { catalogos: false });
  assert.notEqual(depois.assinatura, inicial);
  assert.equal(depois.total_no_recorte, 1);
  assert.deepEqual(await idsNoRecorte(PRODUCAO, { sql }), ['900']);
});

test('a peça que saiu do recorte é carimbada, para a tela saber por quê', async () => {
  const sql = await banco();
  const cheia = await ler(sql);
  await sql`UPDATE vybe_clientes SET ativo = false WHERE id = 2`;
  // Ela não volta na lista de mudadas — saiu do recorte, e o recorte manda.
  // Quem avisa que ela saiu é a assinatura, e é assim que tem que ser: uma peça
  // que saiu não tem estado novo para mostrar, tem que sumir.
  const incremental = await ler(sql, { desde: cheia.gerado_em, catalogos: false });
  assert.ok(!incremental.itens.some((i) => i.id === '901'));
  assert.notEqual(incremental.assinatura, cheia.assinatura);
});

test('mudança em tabela vizinha chega na leitura incremental', async () => {
  const sql = await banco();
  await assentar(sql);
  const cheia = await ler(sql);
  // O caso que motivou os gatilhos: a automação passa a peça para o Reriston
  // escrevendo em vybe_conteudo_responsaveis. Sem carimbo, esta leitura volta
  // vazia e a tela nunca mostra o novo dono.
  await sql`INSERT INTO vybe_conteudo_responsaveis VALUES (1, 10, 0)`;
  const depois = await ler(sql, { desde: cheia.gerado_em, catalogos: false });
  assert.deepEqual(depois.itens.map((i) => i.id), ['900']);
  assert.deepEqual(depois.itens[0].responsavel_ids, ['68036697']);
});

test('a folga de cinco segundos relê o que acabou de ser gravado', () => {
  // NOW() é o início da transação: uma escrita confirmada logo depois da leitura
  // carrega um carimbo ANTERIOR ao 'gerado_em' que acabou de ser devolvido. Sem
  // a folga ela cairia no vão entre duas leituras e não apareceria nunca mais —
  // o defeito que ninguém consegue reproduzir. Reler alguns segundos é o preço.
  //
  // O teste é sobre a consulta, e está escrito onde a consulta se lê: se alguém
  // tirar o INTERVAL, este teste cai e diz por quê.
  const fonte = readFileSync(new URL('../vybe_dominio_store.js', import.meta.url), 'utf8');
  assert.match(fonte, /c\.atualizado_em > \$\{desde\}::timestamptz - INTERVAL '5 seconds'/,
    'a leitura incremental precisa reler os últimos segundos');
});

// ── o remendo no navegador ────────────────────────────────────────────────────
//
// É a metade perigosa: se ele errar, a tela mostra uma lista errada e ninguém
// recebe erro nenhum. Roda o arquivo de verdade, com um fetch de mentira.
import vm from 'node:vm';

function telaComDominio(respostas) {
  const contexto = vm.createContext({ console, setSyncHealth() {}, showToast() {} });
  const fila = [...respostas];
  contexto.fetch = async () => {
    const corpo = fila.shift();
    if (!corpo) throw new Error('a tela pediu mais leituras do que o teste previu');
    return { ok: true, json: async () => corpo };
  };
  vm.runInContext(readFileSync(new URL('../vybe-dominio.js', import.meta.url), 'utf8'), contexto);
  return contexto;
}

const peca = (id, nome, veic) => ({ id, nome, veiculacao_iso: veic });
const base = {
  incremental: false, itens: [peca('900', 'Hebravet', '2026-09-20'), peca('901', 'ACE', '2026-09-21')],
  status: [], captacao: [], opcoes: [], pessoas: [],
  gerado_em: '2026-09-11T12:00:00.000Z', assinatura: 'aaa', total: 2,
};

const pedir = async (c) => {
  vm.runInContext('resultado = buscarMudancas();', c);
  const r = await c.resultado;
  // Array.from, e não .map: a lista nasce DENTRO da sandbox, e um array de outro
  // realm reprova no deepEqual estrito mesmo tendo exatamente o mesmo conteúdo.
  return { mudou: r.mudou, ids: Array.from(r.dados.itens, (i) => i.id), dados: r.dados };
};

test('sem base anterior, a primeira leitura é inteira', async () => {
  const c = telaComDominio([base]);
  const r = await pedir(c);
  assert.equal(r.mudou, true);
  assert.deepEqual(r.ids, ['900', '901']);
});

test('resposta sem mudança não mexe em peça nenhuma, e só acerta o relógio', async () => {
  const c = telaComDominio([base, { incremental: true, mudou: false, itens: [],
    gerado_em: '2026-09-11T12:00:15.000Z', assinatura: 'aaa', total_no_recorte: 2 }]);
  await pedir(c);
  const antes = vm.runInContext('DOMINIO_ULTIMA_RESPOSTA.itens', c);
  const r = await pedir(c);
  assert.equal(r.mudou, false, 'sem mudança a tela não redesenha');
  assert.deepEqual(r.ids, ['900', '901']);
  assert.equal(r.dados.gerado_em, '2026-09-11T12:00:15.000Z', 'o relógio avança para a próxima pergunta');
  assert.equal(vm.runInContext('DOMINIO_ULTIMA_RESPOSTA.itens', c), antes, 'a lista é a mesma, não uma cópia');
});

test('peça alterada entra no lugar da antiga, e a ordem se mantém', async () => {
  const c = telaComDominio([base, { incremental: true, mudou: true,
    itens: [peca('901', 'ACE | renomeada', '2026-09-19')],
    gerado_em: '2026-09-11T12:00:15.000Z', assinatura: 'aaa', total_no_recorte: 2 }]);
  await pedir(c);
  const r = await pedir(c);
  assert.equal(r.mudou, true);
  // 19/09 passa a vir antes de 20/09: a ordem é a mesma da leitura inteira, e
  // sem isso a peça remendada saltaria de lugar na tela a cada alteração.
  assert.deepEqual(r.ids, ['901', '900']);
  assert.equal(r.dados.itens[0].nome, 'ACE | renomeada');
});

test('peça que saiu do recorte some da tela quando a assinatura muda', async () => {
  const c = telaComDominio([base, { incremental: true, mudou: true, itens: [],
    ids: ['900'], status: [], captacao: [], opcoes: [], pessoas: [],
    gerado_em: '2026-09-11T12:00:15.000Z', assinatura: 'bbb', total_no_recorte: 1 }]);
  await pedir(c);
  const r = await pedir(c);
  // O caso da ACE desativada: ela não vem como "mudada" — ela simplesmente não
  // está mais na lista de ids. Sem esta parte ela ficaria na tela para sempre.
  assert.deepEqual(r.ids, ['900']);
  assert.equal(r.dados.assinatura, 'bbb');
});

test('id que o servidor tem e a tela não faz a leitura inteira de novo', async () => {
  const c = telaComDominio([
    base,
    // O servidor diz que existe a peça 902 e não a mandou como mudada: algum
    // carimbo falhou. A tela desiste do remendo em vez de mostrar lista curta.
    { incremental: true, mudou: true, itens: [], ids: ['900', '901', '902'],
      status: [], captacao: [], opcoes: [], pessoas: [],
      gerado_em: '2026-09-11T12:00:15.000Z', assinatura: 'ccc', total_no_recorte: 3 },
    { ...base, itens: [...base.itens, peca('902', 'Nova', '2026-09-22')], assinatura: 'ccc' },
  ]);
  await pedir(c);
  const r = await pedir(c);
  assert.deepEqual(r.ids, ['900', '901', '902'], 'a rede de segurança releu tudo');
});
