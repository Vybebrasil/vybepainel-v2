import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { prepararAcao, confirmarAcao } from '../server/assistente-acoes.js';

// Ações pelo WhatsApp: permissão por papel, confirmação assinada de uso único e execução pelas funções do painel.
const segredo = 's'.repeat(40), PROD = 7829537690;
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,admin boolean,ativo boolean,pode_entrar boolean,monday_user_id bigint);
    INSERT INTO vybe_pessoas VALUES(1,'Paulo Martins','paulo@x',true,true,true,1),(2,'Jady Lima','jady@x',false,true,true,100482777),
      (3,'Tainara Sodré','tai@x',false,true,true,80146924),(4,'Deivid Souza','deivid@x',false,true,true,68997024),(5,'Ewerton','ew@x',false,true,true,68036687);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id bigint,titulo text,formato text,board_id bigint,status_chave text,removido_em timestamptz,veiculacao date);
    INSERT INTO vybe_conteudos VALUES(10,NULL,'Card A','Card',${PROD},'pode_fazer',NULL),(11,12863070737,'Reels B','Reels',${PROD},'para_agendar',NULL),
      (12,NULL,'Card C','Card',${PROD},'para_aprovacao',NULL),(13,NULL,'Reels D','Reels',${PROD},'para_aprovacao',NULL);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text);
    INSERT INTO vybe_status VALUES(${PROD},'pode_fazer','Pode Fazer'),(${PROD},'para_agendar','Para agendar'),(${PROD},'agendado','Agendado'),
      (${PROD},'para_aprovacao','Para aprovação'),(${PROD},'alteracao','Alteração'),(${PROD},'finalizado','Finalizado');
    CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);INSERT INTO vybe_clientes VALUES(7,'Hebravet');
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);INSERT INTO vybe_conteudo_clientes VALUES(10,7),(11,7),(12,7),(13,7);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);INSERT INTO vybe_conteudo_responsaveis VALUES(10,2),(12,2);
    CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint);INSERT INTO vybe_cliente_pessoas VALUES(7,5);
    CREATE TABLE vybe_escritorio_funcoes(pessoa_id bigint,funcao text);INSERT INTO vybe_escritorio_funcoes VALUES(3,'agendamento');`);
  return { db, sql };
}
const feitos = [];
const executar = {
  comentar: async (sql, quem, a) => { feitos.push(['comentar', quem.pessoa.email, a]); },
  trocarStatus: async (sql, quem, a) => { feitos.push(['status', quem.pessoa.email, a]); await sql`UPDATE vybe_conteudos SET status_chave=${a.para} WHERE id=${Number(String(a.item).replace('vybe:', '')) || 11}`; return { para: a.para }; },
};

test('ações: permissões por papel, confirmação de uso único e execução pelas funções do painel', async () => {
  const { db, sql } = await banco();
  try {
    // Comentar: qualquer pessoa vinculada.
    const c = await prepararAcao(sql, 2, { acao: 'comentar', item: '10', texto: 'falta a legenda' }, segredo);
    assert.match(c.resumo, /Comentar em "Card A" \(Hebravet\):\n“falta a legenda”/);
    assert.equal(c.link, 'https://vybepainel-v2.vercel.app/?atividade=vybe:10');
    const ok = await confirmarAcao(sql, 2, c.codigo, segredo, { executar });
    assert.match(ok.feito, /Comentário registrado em "Card A"/);
    assert.deepEqual(feitos.at(-1), ['comentar', 'jady@x', { item: 'vybe:10', texto: 'falta a legenda' }]);
    await assert.rejects(() => confirmarAcao(sql, 2, c.codigo, segredo, { executar }), /já foi usada/);
    // Outra pessoa não confirma; código adulterado e expirado não valem.
    const c2 = await prepararAcao(sql, 2, { acao: 'comentar', item: 'vybe:10', texto: 'oi' }, segredo);
    await assert.rejects(() => confirmarAcao(sql, 3, c2.codigo, segredo, { executar }), /Só quem pediu/);
    await assert.rejects(() => confirmarAcao(sql, 2, c2.codigo.slice(0, -2) + 'xx', segredo, { executar }), /inválida/);
    await assert.rejects(() => confirmarAcao(sql, 2, c2.codigo, segredo, { executar, agora: Date.now() + 6 * 60e3 }), /expirou/);

    // Agendado: só função agendamento (Tainara); pelo número do Monday.
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'status', item: '12863070737', para: 'agendado' }, segredo), /agendamento/);
    const ag = await prepararAcao(sql, 3, { acao: 'status', item: '12863070737', para: 'Agendado' }, segredo);
    assert.match(ag.resumo, /Mudar "Reels B" \(Hebravet\)\nde \*Para agendar\* para \*Agendado\*/);
    assert.match((await confirmarAcao(sql, 3, ag.codigo, segredo, { executar })).feito, /"Reels B" agora está em \*agendado\*/);
    assert.deepEqual(feitos.at(-1), ['status', 'tai@x', { item: '12863070737', para: 'agendado' }]);

    // Mandar para aprovação: só responsáveis; status desconhecido lista as opções.
    await assert.rejects(() => prepararAcao(sql, 3, { acao: 'status', item: '10', para: 'para aprovação' }, segredo), /responsáveis/);
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'status', item: '10', para: 'voando' }, segredo), /Opções: .*Para aprovação/);
    const ap = await prepararAcao(sql, 2, { acao: 'status', item: '10', para: 'para aprovação' }, segredo);
    // Mudou antes do SIM: não executa.
    await sql`UPDATE vybe_conteudos SET status_chave='alteracao' WHERE id=10`;
    await assert.rejects(() => confirmarAcao(sql, 2, ap.codigo, segredo, { executar }), /mudou para Alteração/);

    // Em aprovação: design é do Deivid; vídeo é do head do cliente (Ewerton). Admin pode tudo.
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'status', item: '12', para: 'para agendar' }, segredo), /só quem aprova/);
    assert.ok((await prepararAcao(sql, 4, { acao: 'status', item: '12', para: 'para agendar' }, segredo)).codigo);
    await assert.rejects(() => prepararAcao(sql, 4, { acao: 'status', item: '13', para: 'para agendar' }, segredo), /só quem aprova/);
    assert.ok((await prepararAcao(sql, 5, { acao: 'status', item: '13', para: 'alteração' }, segredo)).codigo);
    assert.ok((await prepararAcao(sql, 1, { acao: 'status', item: '10', para: 'finalizado' }, segredo)).codigo);
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'status', item: '10', para: 'finalizado' }, segredo), /administração/);
  } finally { await db.close(); }
});

test('criar demanda: nome no padrão, prazo 2 dias antes, cliente e responsável sem ambiguidade, SIM cria pelo cadastro do painel', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec("INSERT INTO vybe_clientes VALUES(8,'Gonzalez'),(9,'Gonzalez Pães');ALTER TABLE vybe_clientes ADD COLUMN ativo boolean DEFAULT true;");
    const agora = Date.parse('2026-10-26T15:00:00Z');
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'criar', titulo: 'Agenda Musical', formato: 'card', cliente: 'Gonz', veiculacao: '2026-10-30' }, segredo, agora), /Mais de um cliente/);
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'criar', titulo: 'Agenda Musical', formato: 'banner', cliente: 'Gonzalez', veiculacao: '2026-10-30' }, segredo, agora), /Formato desconhecido/);
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'criar', titulo: 'Agenda Musical', formato: 'card', cliente: 'Gonzalez', veiculacao: '2026-10-20' }, segredo, agora), /veiculação/);
    const p = await prepararAcao(sql, 2, { acao: 'criar', titulo: 'Agenda Musical', formato: 'card', cliente: 'Gonzalez', veiculacao: '2026-10-30', responsavel: 'Jady' }, segredo, agora);
    assert.equal(p.resumo, '🆕 Criar na Produção:\n*Card - Agenda Musical* (Gonzalez)\nveicula 30/10 · prazo da equipe 28/10 · Jady');
    const criados = [];
    const executarCriar = { criarConteudo: async (s, quem, dados) => { criados.push([quem.pessoa.email, dados]); return { conteudo_id: 99, item_id: 'vybe:99' }; } };
    const ok = await confirmarAcao(sql, 2, p.codigo, segredo, { agora, executar: executarCriar });
    assert.equal(ok.feito, '✅ Criada: *Card - Agenda Musical* (Gonzalez).');
    assert.equal(ok.link, 'https://vybepainel-v2.vercel.app/?atividade=vybe:99');
    assert.deepEqual(criados[0], ['jady@x', { titulo: 'Card - Agenda Musical', cliente: 'Gonzalez', formato: 'Card', veiculacao: '2026-10-30', prazo: '2026-10-28', responsaveis: ['100482777'] }]);
    await assert.rejects(() => confirmarAcao(sql, 2, p.codigo, segredo, { agora, executar: executarCriar }), /já foi usada/);
  } finally { await db.close(); }
});

test('ação sem número: acha a peça da própria pessoa pelo cliente ou título; várias viram lista com número', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_status ADD COLUMN final boolean DEFAULT false;
      CREATE TABLE IF NOT EXISTS vybe_conteudos_extra(x int);
      ALTER TABLE vybe_conteudos ADD COLUMN prazo date;
      INSERT INTO vybe_clientes VALUES(8,'Brussolo Ristorante');
      INSERT INTO vybe_conteudos VALUES(20,NULL,'Reels - Massa da casa','Reels',${PROD},'pode_fazer',NULL,'2026-10-27');
      INSERT INTO vybe_conteudo_clientes VALUES(20,8);INSERT INTO vybe_conteudo_responsaveis VALUES(20,2);`);
    // Jady (2): uma peça do Brussolo → segue para a confirmação daquela peça.
    const r = await prepararAcao(sql, 2, { acao: 'status', busca: 'brussulo', para: 'Pode Fazer' }, segredo).catch((e) => e);
    assert.match(String(r.message || r.resumo), /Massa da casa|já está em Pode Fazer/);
    // Hebravet: duas peças abertas da Jady → lista com os números.
    await db.exec(`UPDATE vybe_conteudos SET veiculacao='2099-01-05' WHERE id=10; UPDATE vybe_conteudos SET veiculacao='2099-01-02' WHERE id=12;`);
    const varias = await prepararAcao(sql, 2, { acao: 'status', busca: 'hebravet', para: 'Em andamento' }, segredo).catch((e) => e);
    // Em ordem de veiculação, numeradas, com dia da semana e status; a próxima a veicular marcada.
    assert.match(varias.message, /Achei 2 peças com "hebravet"\. Qual delas\?\n1\. ⭐ Card C \(Hebravet\) · veicula sex 02\/01 · Para aprovação · nº vybe:12\n2\. Card A \(Hebravet\) · veicula seg 05\/01 · Pode Fazer · nº vybe:10/);
    assert.match(varias.message, /a posição \(ex\.: \*1\*\), a data \(ex\.: \*02\/01\*\) ou \*a próxima\* \(⭐\)\.$/);
    // A data falada já escolhe.
    const doDia = await prepararAcao(sql, 2, { acao: 'comentar', busca: 'hebravet 05/01', texto: 'oi' }, segredo);
    assert.match(doDia.resumo, /Card A/);
    // Do jeito que veio do áudio do Reriston: "tareza", "Bruce Lou" (= Brussolo) e "vou iniciar" no meio da frase.
    for (const frase of ['tareza que eu tenho para hoje do cliente brussulo vou iniciar', 'não é tareza, é tarefa. E o cliente que eu disse é o Bruce Lou', 'brussolo']) {
      const r2 = await prepararAcao(sql, 2, { acao: 'status', busca: frase, para: 'Para aprovação' }, segredo).catch((e) => e);
      assert.match(String(r2.resumo || r2.message), /Massa da casa/, frase);
    }
    // Peça de outra pessoa nunca entra: Tainara (3) não é responsável por nada do Brussolo.
    const nada = await prepararAcao(sql, 3, { acao: 'status', busca: 'brussolo', para: 'Em andamento' }, segredo).catch((e) => e);
    assert.match(nada.message, /Não achei peça aberta sua \(nem dos clientes em que você é head\) com "brussolo"/);
  } finally { await db.close(); }
});

test('troca de status devolve a checagem da peça: briefing, OFF e captação (o bot pergunta o que falta)', async () => {
  const { db, sql } = await banco();
  try {
    // Banco antigo, sem as colunas: a troca acontece e a checagem fica nula.
    const a = await prepararAcao(sql, 1, { acao: 'status', item: 'vybe:13', para: 'Pode Fazer' }, segredo);
    assert.equal((await confirmarAcao(sql, 1, a.codigo, segredo, { executar })).checagem, null);
    await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN briefing text; ALTER TABLE vybe_conteudos ADD COLUMN off_audio_chave text; ALTER TABLE vybe_conteudos ADD COLUMN captacao_chave text;
      CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint,tipo text,em timestamptz,autor_id bigint);
      CREATE TABLE vybe_conteudo_updates(conteudo_id bigint,corpo text);
      CREATE TABLE vybe_opcoes(coluna_id text,chave text,rotulo text);INSERT INTO vybe_opcoes VALUES('color_mkynd7j8','com_off','Com OFF');
      CREATE TABLE vybe_captacao(chave text,rotulo text);INSERT INTO vybe_captacao VALUES('agendada','Agendada');
      UPDATE vybe_conteudos SET captacao_chave='agendada' WHERE id=13;`);
    const b = await prepararAcao(sql, 1, { acao: 'status', item: 'vybe:13', para: 'Alteração' }, segredo);
    assert.deepEqual((await confirmarAcao(sql, 1, b.codigo, segredo, { executar })).checagem, { briefing: false, off: null, captacao: 'Agendada', video: true });
    await db.exec(`UPDATE vybe_conteudos SET off_audio_chave='com_off' WHERE id=13; INSERT INTO vybe_conteudo_updates VALUES(13,'ROTEIRO: abertura na academia');`);
    const c = await prepararAcao(sql, 1, { acao: 'status', item: 'vybe:13', para: 'Pode Fazer' }, segredo);
    assert.deepEqual((await confirmarAcao(sql, 1, c.codigo, segredo, { executar })).checagem, { briefing: true, off: 'Com OFF', captacao: 'Agendada', video: true });
  } finally { await db.close(); }
});

test('captação: "tá gravando" e "gravou" mudam o campo Captação (gatilho das automações), não o status; quem toca a peça pode', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN captacao_chave text;
      CREATE TABLE vybe_captacao(chave text,rotulo text);
      INSERT INTO vybe_captacao VALUES('agendada','Captação Agendada'),('andamento','Captação em Andamento'),('feita','Captação Feita');
      UPDATE vybe_conteudos SET captacao_chave='agendada' WHERE id=13;`);
    const trocas = [];
    const exec = { ...executar, trocarEscolha: async (s, quem, a) => { trocas.push([quem.pessoa.email, a]); await s`UPDATE vybe_conteudos SET captacao_chave=${a.para}, status_chave='pode_fazer' WHERE id=13`; return { para: 'Captação Feita', automacoes: [{ id: 1 }] }; } };
    // Ewerton é head do cliente (Hebravet): pode. Tainara (agendamento, sem vínculo com a peça): não.
    await assert.rejects(() => prepararAcao(sql, 3, { acao: 'captacao', item: 'vybe:13', para: 'Captação em Andamento' }, segredo), /captação desta peça/);
    await assert.rejects(() => prepararAcao(sql, 5, { acao: 'captacao', item: 'vybe:13', para: 'Captação Agendada' }, segredo), /já está em Captação Agendada/);
    await assert.rejects(() => prepararAcao(sql, 5, { acao: 'captacao', item: 'vybe:13', para: 'Gravando' }, segredo), /Opções: Captação Agendada, Captação em Andamento, Captação Feita/);
    const a = await prepararAcao(sql, 5, { acao: 'captacao', item: 'vybe:13', para: 'Captação Feita' }, segredo);
    assert.match(a.resumo, /Captação de "Reels D" \(Hebravet\)\nde \*Captação Agendada\* para \*Captação Feita\*/);
    const ok = await confirmarAcao(sql, 5, a.codigo, segredo, { executar: exec });
    assert.deepEqual(trocas.at(-1), ['ew@x', { item: 'vybe:13', campo: 'captacao', para: 'feita' }]);
    assert.match(ok.feito, /Captação de "Reels D" agora está em \*Captação Feita\*\. Status: \*Pode Fazer\*\. As automações do painel rodaram\./);
  } finally { await db.close(); }
});

test('captação por busca: o head do cliente acha a peça pelo nome falado ("o reels da Hebravet que ia furar já tá gravando")', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN captacao_chave text; ALTER TABLE vybe_conteudos ADD COLUMN prazo date;
      CREATE TABLE vybe_captacao(chave text,rotulo text);INSERT INTO vybe_captacao VALUES('andamento','Captação em Andamento');
      ALTER TABLE vybe_status ADD COLUMN final boolean;
      UPDATE vybe_conteudos SET titulo='Reels - Treino na Hebravet' WHERE id=13; UPDATE vybe_conteudos SET removido_em=now() WHERE id=11;`);
    const a = await prepararAcao(sql, 5, { acao: 'captacao', busca: 'o reels do treino da hebravet que ia furar', para: 'Captação em Andamento' }, segredo);
    assert.match(a.resumo, /Captação de "Reels - Treino na Hebravet"/);
    // Status: o head também acha a peça pela busca; a permissão segue a mesma regra (vídeo em aprovação: o head aprova).
    const st = await prepararAcao(sql, 5, { acao: 'status', busca: 'hebravet treino', para: 'Pode Fazer' }, segredo);
    assert.match(st.resumo, /Mudar "Reels - Treino na Hebravet"/);
    // Data por extenso desempata ("24 de outubro" = 24/10) e não conta como palavra do título.
    await db.exec(`UPDATE vybe_conteudos SET veiculacao='2026-10-24' WHERE id=13; INSERT INTO vybe_conteudos VALUES(14,NULL,'Reels - Outro da Hebravet','Reels',${PROD},'para_aprovacao',NULL,'2026-10-30'); INSERT INTO vybe_conteudo_clientes VALUES(14,7);`);
    const porData = await prepararAcao(sql, 5, { acao: 'alteracao', busca: 'reels da hebravet com data de 24 de outubro', texto: 'adicionar ilustrações' }, segredo);
    assert.match(porData.resumo, /Treino na Hebravet/);
  } finally { await db.close(); }
});

test('busca por peça: o formato falado desempata entre peças do mesmo cliente', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN prazo date; ALTER TABLE vybe_status ADD COLUMN final boolean;
      INSERT INTO vybe_conteudo_responsaveis VALUES(13,2); UPDATE vybe_conteudos SET status_chave='pode_fazer' WHERE id=13;`);
    const s = await prepararAcao(sql, 2, { acao: 'status', busca: 'o reels da hebravet', para: 'Para aprovação' }, segredo).catch((e) => e);
    assert.doesNotMatch(String(s.message || s.resumo), /Achei \d peças/);
    assert.match(String(s.resumo || s.message), /Reels D/);
  } finally { await db.close(); }
});

test('pedido de alteração: comentário na peça e, com permissão, status Alteração; head acha pela busca', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN prazo date; ALTER TABLE vybe_status ADD COLUMN final boolean;
      UPDATE vybe_conteudos SET titulo='Card - Agenda Musical' WHERE id=10;`);
    feitos.length = 0;
    // Ewerton (head da Hebravet, sem permissão de status nessa etapa): fica só o comentário.
    const a = await prepararAcao(sql, 5, { acao: 'alteracao', busca: 'agenda musical da hebravet', texto: 'quarta para Maria Luísa e sexta para Greyce Pires' }, segredo);
    assert.match(a.resumo, /Pedido de alteração em "Card - Agenda Musical" \(Hebravet\):\n“quarta para Maria Luísa e sexta para Greyce Pires”\n\(fica registrado como comentário/);
    const ok = await confirmarAcao(sql, 5, a.codigo, segredo, { executar });
    assert.match(ok.feito, /Pedido de alteração registrado em "Card - Agenda Musical": “quarta para Maria Luísa e sexta para Greyce Pires”\. Status segue \*Pode Fazer\*/);
    assert.deepEqual(feitos, [['comentar', 'ew@x', { item: 'vybe:10', texto: '🔧 Alteração pedida pelo WhatsApp: quarta para Maria Luísa e sexta para Greyce Pires' }]]);
    // Administração: comentário e status.
    const b = await prepararAcao(sql, 1, { acao: 'alteracao', item: 'vybe:10', texto: 'trocar a foto' }, segredo);
    assert.match(b.resumo, /e status de \*Pode Fazer\* para \*Alteração\*/);
    const ok2 = await confirmarAcao(sql, 1, b.codigo, segredo, { executar });
    assert.match(ok2.feito, /: “trocar a foto”\. Agora está em \*alteracao\*/);
    assert.deepEqual(feitos.slice(1).map((f) => f[0]), ['comentar', 'status']);
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'alteracao', item: 'vybe:10', texto: ' ' }, segredo), /Diga o que precisa mudar/);
  } finally { await db.close(); }
});

test('alteração acha também a peça já agendada que veicula hoje (e a marca como a próxima)', async () => {
  const { db, sql } = await banco();
  try {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());
    await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN prazo date; ALTER TABLE vybe_status ADD COLUMN final boolean DEFAULT false;
      UPDATE vybe_status SET final=true WHERE chave='agendado';
      UPDATE vybe_conteudos SET titulo='Card - Agenda Musical', veiculacao='${hoje}', status_chave='agendado' WHERE id=10;
      UPDATE vybe_conteudos SET titulo='Card - Agenda Musical', veiculacao='2099-01-02' WHERE id=12;`);
    const r = await prepararAcao(sql, 5, { acao: 'alteracao', busca: 'agenda musical hebravet', texto: 'sexta é Greyce' }, segredo).catch((e) => e);
    assert.match(r.message, /1\. ⭐ Card - Agenda Musical \(Hebravet\) · veicula \S+ \d\d\/\d\d \(hoje\) · Agendado · nº vybe:10\n2\. Card - Agenda Musical/);
    // Troca de status não mexe em peça já agendada: a mesma busca acha só a outra.
    const s = await prepararAcao(sql, 2, { acao: 'status', busca: 'agenda musical hebravet', para: 'Alteração' }, segredo).catch((e) => e);
    assert.doesNotMatch(String(s.message || s.resumo), /Achei/);
  } finally { await db.close(); }
});

test('regra do cliente: head ou administração guarda com SIM; entra na memória e nas legendas', async () => {
  const { db, sql } = await banco();
  try {
    const { regrasDoCliente, regrasDaPeca } = await import('../server/assistente-regras.js');
    await db.exec('ALTER TABLE vybe_clientes ADD COLUMN ativo boolean DEFAULT true');
    assert.deepEqual(await regrasDoCliente(sql, 7), []);
    // Jady (responsável, não head) não pode; Ewerton (head da Hebravet) pode, pelo nome do cliente ou pela peça.
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'regra', cliente: 'Hebravet', texto: 'nunca usar fundo escuro' }, segredo), /administração ou com os heads/);
    const a = await prepararAcao(sql, 5, { acao: 'regra', cliente: 'hebra', texto: 'nunca usar fundo escuro' }, segredo);
    assert.match(a.resumo, /Regra para as próximas peças da \*Hebravet\*:\n“nunca usar fundo escuro”/);
    assert.match((await confirmarAcao(sql, 5, a.codigo, segredo, { executar })).feito, /Regra guardada para \*Hebravet\*/);
    await assert.rejects(() => confirmarAcao(sql, 5, a.codigo, segredo, { executar }), /já foi usada/);
    const b = await prepararAcao(sql, 1, { acao: 'regra', item: 'vybe:10', texto: 'sexta é sempre a Greyce' }, segredo);
    await confirmarAcao(sql, 1, b.codigo, segredo, { executar });
    assert.deepEqual(await regrasDoCliente(sql, 7), ['sexta é sempre a Greyce', 'nunca usar fundo escuro']);
    assert.deepEqual(await regrasDaPeca(sql, 12), ['sexta é sempre a Greyce', 'nunca usar fundo escuro']);
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'regra', cliente: 'Inexistente', texto: 'x y z' }, segredo), /Não achei o cliente/);
  } finally { await db.close(); }
});

test('trocar responsável (redistribuir): só administração; troca de quem é para quem, com SIM', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_conteudo_responsaveis ADD COLUMN ordem int DEFAULT 0;`);
    const trocas = [];
    const exec = { ...executar, trocarResponsaveis: async (s, quem, a) => { trocas.push([quem.pessoa.email, a]); } };
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'responsavel', item: 'vybe:10', de: 'Jady', para: 'Deivid' }, segredo), /só com a administração/);
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'responsavel', item: 'vybe:10', de: 'Deivid', para: 'Jady' }, segredo), /não é responsável/);
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'responsavel', item: 'vybe:10', de: 'Jady', para: 'Fulano' }, segredo), /Não achei "Fulano"/);
    const a = await prepararAcao(sql, 1, { acao: 'responsavel', item: 'vybe:10', de: 'Jady', para: 'Deivid' }, segredo);
    assert.match(a.resumo, /Trocar responsável de "Card A" \(Hebravet\)\nde \*Jady Lima\* para \*Deivid Souza\*/);
    const ok = await confirmarAcao(sql, 1, a.codigo, segredo, { executar: exec });
    assert.match(ok.feito, /"Card A" agora é de \*Deivid Souza\*/);
    assert.deepEqual(trocas, [['paulo@x', { item: 'vybe:10', pessoas: ['68997024'] }]]);
  } finally { await db.close(); }
});

test('criar com briefing (áudio do cliente pedindo peça nova): o resumo mostra e a peça nasce com ele', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS vybe_clientes_extra(x int); ALTER TABLE vybe_clientes ADD COLUMN ativo boolean DEFAULT true; INSERT INTO vybe_clientes VALUES(9,'Gonzalez Gastronomia',true);`);
    const p = await prepararAcao(sql, 1, { acao: 'criar', formato: 'Card', cliente: 'Gonzalez', titulo: 'Rodízio de quarta', veiculacao: '2099-01-07', briefing: 'Rodízio de pizza toda quarta, foto da pizza de calabresa, tom elegante.' }, segredo);
    assert.match(p.resumo, /\n📝 Briefing: “Rodízio de pizza toda quarta, foto da pizza de calabresa, tom elegante\.”$/);
    const criados = [];
    await confirmarAcao(sql, 1, p.codigo, segredo, { executar: { criarConteudo: async (s, quem, dados) => { criados.push(dados); return { conteudo_id: 9 }; } } });
    assert.equal(criados[0].briefing, 'Rodízio de pizza toda quarta, foto da pizza de calabresa, tom elegante.');
  } finally { await db.close(); }
});

test('comentário e alteração marcam quem faz o próximo passo (responsáveis, menos quem pediu)', async () => {
  const { db, sql } = await banco();
  try {
    await db.exec(`ALTER TABLE vybe_conteudo_responsaveis ADD COLUMN ordem int DEFAULT 0; INSERT INTO vybe_conteudo_responsaveis VALUES(13,4,0);`);
    feitos.length = 0;
    const a = await prepararAcao(sql, 5, { acao: 'alteracao', item: 'vybe:13', texto: 'adicionar ilustrações' }, segredo);
    const ok = await confirmarAcao(sql, 5, a.codigo, segredo, { executar });
    assert.equal(feitos[0][2].texto, '🔧 Alteração pedida pelo WhatsApp: adicionar ilustrações\n\n👉 Próximo passo: @Deivid');
    assert.match(ok.feito, /\n👉 Próximo passo: \{\{pessoa:68997024:Deivid\}\}$/);
    // Quem pediu e é o único responsável: sem linha de próximo passo.
    feitos.length = 0;
    const b = await prepararAcao(sql, 2, { acao: 'comentar', item: 'vybe:10', texto: 'falta a legenda' }, segredo);
    const ok2 = await confirmarAcao(sql, 2, b.codigo, segredo, { executar });
    assert.equal(feitos[0][2].texto, 'falta a legenda');
    assert.doesNotMatch(ok2.feito, /Próximo passo/);
  } finally { await db.close(); }
});

test('prazo realista: mediana do formato (com a pessoa, se houver histórico); prazo curto vira aviso', async () => {
  const { avisoDePrazo } = await import('../server/assistente-acoes.js');
  assert.equal(avisoDePrazo({ amostras: [3, 4, 4, 5, 6], diasDisponiveis: 1, formato: 'Reels', nome: 'Jady' }), '⏱️ Reels com Jady costuma levar ~4 dia(s) até ir para aprovação; esse prazo dá 1. Quer ajustar a veiculação ou o responsável?');
  assert.equal(avisoDePrazo({ amostras: [3, 4, 4, 5, 6], diasDisponiveis: 3, formato: 'Reels', nome: 'Jady' }), null);
  assert.equal(avisoDePrazo({ amostras: [3, 4], diasDisponiveis: 0, formato: 'Reels' }), null); // pouco histórico: não opina
});

test('banco de ideias: guarda pelo nome do cliente e a pauta lê as recentes', async () => {
  const { db, sql } = await banco();
  try {
    const { guardarIdeia, ideiasDoCliente } = await import('../server/assistente-regras.js');
    await db.exec('ALTER TABLE vybe_clientes ADD COLUMN ativo boolean DEFAULT true');
    assert.deepEqual(await ideiasDoCliente(sql, 7), []);
    const r = await guardarIdeia(sql, 2, { cliente: 'hebra', texto: 'bastidores da tosa' });
    assert.equal(r.texto, '💡 Ideia guardada para *Hebravet*: “bastidores da tosa”. Entra na próxima pauta do cliente.');
    assert.deepEqual(await ideiasDoCliente(sql, 7), ['bastidores da tosa']);
    await assert.rejects(() => guardarIdeia(sql, 2, { cliente: 'Nada', texto: 'x y z' }), /Não achei o cliente/);
  } finally { await db.close(); }
});

test('marcar encaixe de captação: administração (ou captação) com SIM; código validado', async () => {
  const { db, sql } = await banco();
  try {
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'agendar_captacao', encaixe: '2026-10-30|7@10:00-11:00' }, segredo), /administração ou de quem faz captação/);
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'agendar_captacao', encaixe: 'qualquer coisa' }, segredo), /Encaixe inválido/);
    const a = await prepararAcao(sql, 1, { acao: 'agendar_captacao', encaixe: '2026-10-30|7@10:00-11:00' }, segredo);
    assert.match(a.resumo, /Marcar captação na agenda em 30\/10:\n- Hebravet · 10:00 às 11:00/);
    const marcados = [];
    const ok = await confirmarAcao(sql, 1, a.codigo, segredo, { executar: { marcarEncaixe: async (s, quem, cod) => { marcados.push(cod); return 1; } } });
    assert.deepEqual(marcados, ['2026-10-30|7@10:00-11:00']);
    assert.match(ok.feito, /1 captação\(ões\) marcada\(s\) na agenda/);
  } finally { await db.close(); }
});
