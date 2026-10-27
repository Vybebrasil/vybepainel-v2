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
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id bigint,titulo text,formato text,board_id bigint,status_chave text,removido_em timestamptz);
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
