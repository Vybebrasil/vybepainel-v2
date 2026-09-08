import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const config=fs.readFileSync('vybe-config.js','utf8');
const core=fs.readFileSync('vybe-core.js','utf8');
test('fim do mês não salta fevereiro nem o mês anterior',()=>{
  for(const [iso,offset,expected] of [['2026-01-31T12:00:00Z',1,'Fevereiro 2026'],['2026-03-31T12:00:00Z',-1,'Fevereiro 2026'],['2024-01-31T12:00:00Z',1,'Fevereiro 2024'],['2026-12-31T12:00:00Z',1,'Janeiro 2027']]){
    const c=vm.createContext({Date:class extends Date{constructor(...a){super(...(a.length?a:[iso]));}},console});
    vm.runInContext(config+`; resultado=getMonthName(${offset});`,c);assert.equal(c.resultado,expected);
  }
});
test('semanas usam o mesmo mês corrigido',()=>{
  const c=vm.createContext({Date:class extends Date{constructor(...a){super(...(a.length?a:['2026-01-31T12:00:00Z']));}},console});
  vm.runInContext(config+'\n'+core+'\nMONTH_OFFSET=1; resultado=calcWeeks();',c);
  assert.equal(c.resultado.weeks[0].startIso,'2026-01-26');
  assert.equal(c.resultado.weeks.at(-1).endIso,'2026-03-01');
  assert.equal(c.resultado.weeks.length,5);
});
