import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function carregar() {
  const c=vm.createContext({console,window:{},document:{},localStorage:{getItem:()=>null},
    CLIENT_MASTER_HEADS:[],CLIENT_MASTER_ACESSOS:[],DADOS_ALL:[],DADOS:[],DADOS_DEMANDAS:[],
    clientesDoItem:i=>i.clientes,isRequestItem:i=>i.quadro==='demandas'});
  for(const arquivo of ['vybe-config.js','vybe-clientes.js']) vm.runInContext(fs.readFileSync(arquivo,'utf8'),c);
  return c;
}
test('cadastro mestre reutiliza apelidos da operação e reúne atividades sem duplicar totais',()=>{
  const c=carregar();
  c.CLIENT_MASTER_HEADS=[{name:'VOA',status:'Ativo'},{name:'Academia Lions',status:'Ativo'}];
  c.CLIENT_MASTER_ACESSOS=[{name:'Voa Sportswear',drive:'https://example.com/voa'},{name:'Academia Lions Top'}];
  c.DADOS_ALL=[{id:'1',clientes:['VOA','Voa Sportswear'],status:'Pode Fazer'}];
  c.DADOS_DEMANDAS=[{id:'2',clientes:['Voa Sportswear'],quadro:'demandas',status:'A Fazer'}];
  const registros=c.clientMasterRecords();
  assert.deepEqual(Array.from(registros,r=>r.name),['Academia Lions','VOA']);
  const voa=registros.find(r=>r.name==='VOA');
  assert.equal(voa.content.length,1);assert.equal(voa.requests.length,1);
  assert.equal(voa.meta.drive,'https://example.com/voa');
  assert.equal(voa.meta.status,'Ativo');
});
test('apelidos conhecidos convergem sem unir contas diferentes por semelhança',()=>{
  const c=carregar();
  for(const [a,b] of [['ACE','Ace - Associação Comercial'],['Igor Lopes','Igor R. Lopes'],['Hellen Rocha','Hellen']])
    assert.equal(c.clientMasterCanonicalName(a),c.clientMasterCanonicalName(b));
  assert.notEqual(c.clientMasterCanonicalName('DiaLab'),c.clientMasterCanonicalName('DiaCenter'));
});
test('variações legadas confirmadas convergem na operação e no cadastro mestre',()=>{
  const c=carregar();
  const familias=[['Brussolo Ristorante','Restaurante Brussolo','Brussolo'],
    ['Blindagem Monitoramento','Blindagem'],
    ['Facilite Aprender','Facilite','Facilita Assessoria','Comunidade Entre Mães Facilite'],
    ['VOA','Voa Sportswear','VÖA','VÖA Sportswear']];
  for(const [nome,...apelidos] of familias) {
    c.CLIENT_MASTER_HEADS=[{name:nome}];
    c.CLIENT_MASTER_ACESSOS=apelidos.map(name=>({name}));
    c.DADOS_ALL=apelidos.map((alias,i)=>({id:String(i),clientes:[nome,alias],status:'Pode Fazer'}));
    for(const alias of [nome,...apelidos]) {
      assert.equal(c.normalizarCliente(alias),nome);
      assert.equal(c.clientMasterCanonicalName(alias),nome);
    }
    const registros=c.clientMasterRecords();
    assert.equal(registros.length,1);
    assert.equal(registros[0].content.length,apelidos.length);
  }
});
