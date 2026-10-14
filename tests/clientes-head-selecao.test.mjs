import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('head: alternar reflete seleção acessível e envia os IDs escolhidos', async () => {
  const fonte = fs.readFileSync('vybe-clientes.js', 'utf8');
  const trecho = fonte.slice(fonte.indexOf('function pintarHeadsDoCliente()'), fonte.indexOf('// ── Ativo ou inativo'));
  const caixa = {innerHTML:''};
  let enviado;
  const ctx = vm.createContext({
    HEADS_ESCOLHIDOS:new Set(['1']), HEADS_DO_CLIENTE:{id:4},
    PESSOAS_DO_CADASTRO:[{id:1,nome:'Pessoa A'},{id:2,nome:'Pessoa B'}],
    document:{getElementById:()=>caixa,querySelectorAll:()=>[]},
    safeText:String, pessoaPeloNome:n=>({name:n}), ownerAvatarHtml:()=>'',
    gravarCadastroDeCliente:async d=>{enviado=d;}, closeWorkflowModal:()=>{},
    showToast:()=>{},
  });
  vm.runInContext(trecho,ctx);
  ctx.escolherHeadDoCliente('1');
  ctx.escolherHeadDoCliente('2');
  assert.deepEqual([...ctx.HEADS_ESCOLHIDOS],['2']);
  assert.match(caixa.innerHTML,/class="dono-pessoa selected" aria-pressed="true"/);
  assert.match(caixa.innerHTML,/aria-pressed="false"/);
  await ctx.salvarHeadsDoCliente();
  assert.equal(enviado.id,4);
  assert.deepEqual([...enviado.pessoas],['2']);
});
