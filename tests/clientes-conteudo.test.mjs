import test from 'node:test';
import assert from 'node:assert/strict';
import { conexao } from './postgres.mjs';
import { substituirClientes } from '../server/clientes-conteudo.js';
async function base() {
  const {db,sql}=conexao();
  await db.exec(`CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,ativo boolean);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,clientes_texto text,atualizado_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint REFERENCES vybe_conteudos,cliente_id bigint REFERENCES vybe_clientes,PRIMARY KEY(conteudo_id,cliente_id));
    CREATE TABLE vybe_conteudo_eventos(conteudo_id bigint REFERENCES vybe_conteudos,tipo text,de text,para text,autor_id bigint);
    INSERT INTO vybe_clientes VALUES(1,'Cliente A',true),(2,'Cliente B',true),(3,'Inativo',false);
    INSERT INTO vybe_conteudos VALUES(10,'Cliente A','2020-01-01');
    INSERT INTO vybe_conteudo_clientes VALUES(10,1);`);
  return {db,sql};
}
test('dois clientes, uma peça: substitui vínculos, atualiza leitura e audita autoria',async()=>{
  const {db,sql}=await base();try {
    const r=await substituirClientes(sql,{conteudoId:10,clientes:['2','1','2'],autorId:7});
    assert.deepEqual(r.clientes,['Cliente B','Cliente A']);
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudos`)[0].n,1);
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_clientes`)[0].n,2);
    assert.equal((await sql`SELECT clientes_texto FROM vybe_conteudos`)[0].clientes_texto,'Cliente B, Cliente A');
    assert.equal((await sql`SELECT atualizado_em > '2020-01-01' AS mudou FROM vybe_conteudos`)[0].mudou,true);
    assert.equal((await sql`SELECT autor_id FROM vybe_conteudo_eventos`)[0].autor_id,7);
    await substituirClientes(sql,{conteudoId:10,clientes:['2'],autorId:7});
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_clientes`)[0].n,1);
    assert.equal((await sql`SELECT cliente_id FROM vybe_conteudo_clientes`)[0].cliente_id,2);
  } finally {await db.close();}
});
test('rejeita lista vazia, IDs inválidos, desconhecidos e novo vínculo inativo sem alterar a peça',async()=>{
  const {db,sql}=await base();try {
    for(const clientes of [[],null,['abc'],['999'],['3']]) await assert.rejects(substituirClientes(sql,{conteudoId:10,clientes}));
    assert.equal((await sql`SELECT cliente_id FROM vybe_conteudo_clientes`)[0].cliente_id,1);
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_eventos`)[0].n,0);
  } finally {await db.close();}
});
test('falha no histórico desfaz toda a alteração; cliente inativo existente pode ser preservado',async()=>{
  const {db,sql}=await base();try {
    await sql`UPDATE vybe_clientes SET ativo=false WHERE id=1`;
    await substituirClientes(sql,{conteudoId:10,clientes:['1','2']});
    await db.exec(`ALTER TABLE vybe_conteudo_eventos ADD CONSTRAINT falha CHECK(para <> 'Cliente B')`);
    await assert.rejects(substituirClientes(sql,{conteudoId:10,clientes:['2']}));
    assert.equal((await sql`SELECT COUNT(*)::int AS n FROM vybe_conteudo_clientes`)[0].n,2);
    assert.equal((await sql`SELECT clientes_texto FROM vybe_conteudos`)[0].clientes_texto,'Cliente A, Cliente B');
  } finally {await db.close();}
});

test('leitura preserva todos os clientes sem duplicar a peça e agrupa em ambas as contas',async()=>{
  const {default:vm}=await import('node:vm');const {readFileSync}=await import('node:fs');
  const c=vm.createContext({console,Date,clienteDesativado:()=>false,aplicarFotosDoBanco(){}});
  // vybe-demandas.js entra porque processItemsAll pergunta se uma peça atrasada
  // está concluída, e essa resposta passa pelo operationalFlowStatus de lá. O prazo
  // é uma data já passada de propósito: com '2026-09-16' o teste passava até o dia
  // 16 e quebrava a partir do 17 (UTC), em toda PR, sem ninguém ter mexido em nada.
  for(const file of ['vybe-config.js','vybe-core.js','vybe-dominio.js','vybe-demandas.js','vybe-gestor.js']) vm.runInContext(readFileSync(file,'utf8'),c);
  const result=vm.runInContext(`(() => {
    const base={itens:[{id:'vybe:10',nome:'Compartilhado',clientes:['Cliente A','Cliente B'],prazo_iso:'2026-09-01'}],status:[],pessoas:[]};
    const itens=processItemsAll(dominioComoItensDoMonday(base),calcWeeks());
    return {total:itens.length,clientes:itens[0].clientes,segundo:itemTemCliente(itens[0],'Cliente B'),grupos:Object.keys(groupByCliente(itens))};
  })()`,c);
  assert.equal(result.total,1);assert.equal(result.segundo,true);
  assert.deepEqual(Array.from(result.clientes),['Cliente A','Cliente B']);
  assert.deepEqual(Array.from(result.grupos),['Cliente A','Cliente B']);
});
