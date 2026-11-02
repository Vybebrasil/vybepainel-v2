import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { prepararAcao, confirmarAcao } from '../server/assistente-acoes.js';

// Mudar data pelo Vybes (Paulo, 02/11/2026: "muda os prazos desses reels da DiaLab pro dia 03"): prazo da equipe ou
// veiculação, só administração ou head do cliente, confirmação assinada de uso único e a troca do painel (trocarData).
const segredo = 's'.repeat(40), PROD = 7829537690, DEMANDAS = 8385559107;
const agora = Date.parse('2026-11-02T15:00:00Z');
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,admin boolean,ativo boolean,pode_entrar boolean,monday_user_id bigint);
    INSERT INTO vybe_pessoas VALUES(1,'Paulo Martins','paulo@x',true,true,true,1),(2,'Jady Lima','jady@x',false,true,true,2),(5,'Ewerton','ew@x',false,true,true,5);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id bigint,titulo text,formato text,board_id bigint,status_chave text,removido_em timestamptz,veiculacao date,prazo date);
    INSERT INTO vybe_conteudos VALUES(20,NULL,'Reels - Medalha','Reels',${PROD},'pode_fazer',NULL,'2026-11-10','2026-11-08'),
      (21,NULL,'Arte - Backdrop',NULL,${DEMANDAS},'nova',NULL,'2026-11-12','2026-11-05');
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text);
    INSERT INTO vybe_status VALUES(${PROD},'pode_fazer','Pode Fazer'),(${DEMANDAS},'nova','Nova Demanda');
    CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text);INSERT INTO vybe_clientes VALUES(8,'DiaLab');
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);INSERT INTO vybe_conteudo_clientes VALUES(20,8),(21,8);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);INSERT INTO vybe_conteudo_responsaveis VALUES(20,2);
    CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint);INSERT INTO vybe_cliente_pessoas VALUES(8,5);
    CREATE TABLE vybe_escritorio_funcoes(pessoa_id bigint,funcao text);`);
  return { db, sql };
}
const feitos = [];
const executar = {
  trocarData: async (sql, quem, a) => { feitos.push([quem.pessoa.email, a]);
    await sql.query(`UPDATE vybe_conteudos SET ${a.campo === 'prazo' ? 'prazo' : 'veiculacao'}=$1 WHERE id=$2`, [a.data, Number(String(a.item).replace('vybe:', ''))]);
    return { aviso: null }; },
};

test('mudar data: prazo ou veiculação, só administração ou head, uso único e conferindo a data de antes', async () => {
  const { db, sql } = await banco();
  try {
    // Responsável que não é head nem administração: não muda data.
    await assert.rejects(() => prepararAcao(sql, 2, { acao: 'data', item: 'vybe:20', campo: 'prazo', data: '2026-11-03' }, segredo, agora), /administração ou com os heads/);
    // Campo e data obrigatórios; data no passado não vale.
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'data', item: 'vybe:20', data: '2026-11-03' }, segredo, agora), /prazo da equipe ou a veiculação/);
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'data', item: 'vybe:20', campo: 'prazo', data: '2026-11-01' }, segredo, agora), /hoje ou depois/);
    await assert.rejects(() => prepararAcao(sql, 1, { acao: 'data', item: 'vybe:20', campo: 'prazo', data: '2026-11-08' }, segredo, agora), /já é 08\/11/);

    // Head do cliente (Ewerton) muda o prazo; o resumo diz de quanto para quanto.
    const pz = await prepararAcao(sql, 5, { acao: 'data', item: 'vybe:20', campo: 'prazo', data: '2026-11-03' }, segredo, agora);
    assert.equal(pz.resumo, '📅 Mudar o prazo da equipe de "Reels - Medalha" (DiaLab)\nde *08/11* para *03/11*');
    const ok = await confirmarAcao(sql, 5, pz.codigo, segredo, { executar, agora: agora + 60e3 });
    assert.equal(ok.feito, '✅ O prazo da equipe de "Reels - Medalha" agora é *03/11*.');
    assert.deepEqual(feitos.at(-1), ['ew@x', { item: 'vybe:20', campo: 'prazo', data: '2026-11-03' }]);
    // Repetir o mesmo SIM não executa de novo (a data já não é a de antes).
    await assert.rejects(() => confirmarAcao(sql, 5, pz.codigo, segredo, { executar, agora: agora + 60e3 }), /enquanto isso|já foi usada/);

    // Veiculação antes do prazo: avisa no resumo, não barra (a mesma decisão do painel).
    const vc = await prepararAcao(sql, 1, { acao: 'data', item: 'vybe:20', campo: 'veiculacao', data: '2026-11-02' }, segredo, agora);
    assert.match(vc.resumo, /Mudar a veiculação de "Reels - Medalha" \(DiaLab\)\nde \*10\/11\* para \*02\/11\*\n⚠️ O prazo da equipe fica depois da veiculação\./);
    // A data mudou entre o pedido e o SIM: não executa.
    await sql`UPDATE vybe_conteudos SET veiculacao='2026-11-11' WHERE id=20`;
    await assert.rejects(() => confirmarAcao(sql, 1, vc.codigo, segredo, { executar, agora: agora + 60e3 }), /mudou para 11\/11 enquanto isso/);

    // Em Solicitações, a data do cliente é a de conclusão.
    const sol = await prepararAcao(sql, 1, { acao: 'data', item: 'vybe:21', campo: 'veiculacao', data: '2026-11-14' }, segredo, agora);
    assert.match(sol.resumo, /^📅 Mudar a data de conclusão de "Arte - Backdrop"/);
  } finally { await db.close(); }
});
