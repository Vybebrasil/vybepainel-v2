import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fonte = fs.readFileSync('cadastros_governed_v2.js', 'utf8');
const adiar = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function cadastro(criar, itens) {
  const btn = { focus(){} }, overlay = { setAttribute(){}, removeAttribute(){} };
  const chamadas = { refresh: [], fechou: 0, avisos: [] };
  const state = { board: 'demandas', client: 'Cliente', format: 'Card', itens, assignees: [] };
  const c = vm.createContext({ state, window: {}, fcEnviando: false, fcPasso: 0,
    FC_PASSOS: ['itens'], FC_FALTA: {}, fcRespondido: () => true, fcSincronizarDaTela(){},
    cadastrosDestiny: () => ({ group:'grupo', status:'Pode Fazer' }), fcGrupoDoQuadro: g => g,
    document: { getElementById: id => id === 'fc-overlay' ? overlay : btn },
    cadastroNomeNoBanco: n => n, fcCriarUm: criar, fcEspelharPrimeiro(){}, fcDesenharPasso(){},
    showToast: (...args) => chamadas.avisos.push(args),
    refreshData: async o => chamadas.refresh.push(o.boardCriado),
    fcCloseModal: () => chamadas.fechou++, enviarArquivoDaPeca: async () => {},
  });
  vm.runInContext(fonte.slice(fonte.indexOf('  window.fcSubmit ='), fonte.indexOf('  window.fcToggleDropdown =')), c);
  return { c, state, btn, overlay, chamadas, enviar: () => c.window.fcSubmit() };
}

test('falha parcial de títulos iguais mantém somente o cartão que falhou e seus arquivos', async () => {
  const a = { titulo:'Mesmo título', prazo:'2026-10-01', arquivos:[] };
  const b = { titulo:'Mesmo título', prazo:'2026-10-02', arquivos:[{name:'referencia.png'}] };
  const enviados = [];
  const t = cadastro(async item => {
    enviados.push(item);
    return { ok: item === a || enviados.length > 2, id:'vybe:1', nome:'Card - Mesmo título', erro:'falha temporária' };
  }, [a,b]);
  await t.enviar();
  assert.equal(t.state.itens.length, 1);
  assert.equal(t.state.itens[0], b);
  assert.equal(t.state.itens[0].arquivos[0].name, 'referencia.png');
  await t.enviar();
  assert.deepEqual(enviados, [a,b,b]);
  assert.deepEqual(t.chamadas.refresh, ['demandas','demandas']);
});

test('envios simultâneos executam uma única gravação e liberam o formulário ao terminar', async () => {
  const pendente = adiar(); let gravacoes = 0;
  const t = cadastro(async () => { gravacoes++; await pendente.promise; return {ok:true,id:'vybe:1'}; }, [{titulo:'Um'}]);
  const primeiro = t.enviar();
  await t.enviar();
  assert.equal(gravacoes,1);
  assert.equal(t.overlay.inert,true);
  pendente.resolve(); await primeiro;
  assert.equal(t.overlay.inert,false);
  assert.equal(t.btn.disabled,false);
  assert.equal(t.chamadas.fechou,1);
});

test('erro inesperado libera o formulário para correção sem apagar o rascunho', async () => {
  const item = {titulo:'Um'};
  const t = cadastro(async () => { throw new Error('interrompido'); }, [item]);
  await assert.rejects(t.enviar(), /interrompido/);
  assert.equal(t.overlay.inert,false);
  assert.equal(t.c.fcEnviando,false);
  assert.equal(t.state.itens[0],item);
  assert.equal(t.chamadas.fechou,0);
});

test('atualização aguarda ambos os quadros e recarrega demanda criada pela Produção', async () => {
  const fonteRefresh = fs.readFileSync('vybe-clientes.js','utf8');
  const producao = adiar(), demandas = adiar(); const chamadas = [];
  const c = vm.createContext({activeBoard:'producao', refreshProducao: () => { chamadas.push('producao'); return producao.promise; },
    refreshDemandas: () => { chamadas.push('demandas'); return demandas.promise; },renderClientesBoard(){} });
  vm.runInContext(fonteRefresh.slice(fonteRefresh.indexOf('function refreshData(')), c);
  let terminou = false;
  const atualizacao = c.refreshData({boardCriado:'demandas'}).then(() => { terminou = true; });
  producao.resolve(); await Promise.resolve();
  assert.equal(terminou,false);
  demandas.resolve(); await atualizacao;
  assert.deepEqual(chamadas,['producao','demandas']);
});

test('falha na atualização não limpa os dados existentes', async () => {
  const fonteRefresh = fs.readFileSync('vybe-clientes.js','utf8');
  const existentes = [{id:'vybe:9'}];
  const c = vm.createContext({activeBoard:'demandas',DADOS_DEMANDAS:existentes,
    refreshProducao: async () => {},refreshDemandas: async () => { throw new Error('sem rede'); },renderClientesBoard(){} });
  vm.runInContext(fonteRefresh.slice(fonteRefresh.indexOf('function refreshData(')),c);
  await assert.rejects(c.refreshData(),/sem rede/);
  assert.equal(c.DADOS_DEMANDAS,existentes);
});
