import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Padrão v2 (12/11/2026): a aba Para aprovar do Conteúdo é o quadro "Aprovação de conteúdo" do moodboard.
const js = fs.readFileSync('vybe-mundo-conteudo.js', 'utf8');
const css = fs.readFileSync('padrao-v2/conteudo.css', 'utf8');
const trecho = js.slice(js.indexOf('// ---------- Para aprovar'), js.indexOf('// ---------- Equilíbrio ----------'));
const emOrdem = (texto, partes) => { const pos = partes.map((x) => texto.indexOf(x)); return pos.every((p, k) => p >= 0 && (k === 0 || p > pos[k - 1])) ? true : pos.join(','); };

test('o topo é o do quadro D3: título com o mês ao lado, as três abas, a ajuda e o fechar', () => {
  const topo = js.slice(js.indexOf('<div class="v2c-topo">'), js.indexOf('const ajuda = st.ajuda'));
  assert.equal(emOrdem(topo, ['<h2>Aprovação</h2>', 'data-vc-mes="-1"', 'v2c-mes-nome', 'data-vc-mes="1"', 'data-vc-aba="aprovar"', 'class="d3a-n"', 'data-vc-aba="equilibrio"', 'data-vc-aba="links"', 'data-vc-ajuda', 'data-vc-fechar']), true);
  assert.doesNotMatch(topo, /vc-titulo|<small>/, 'sem subtítulo');
});

test('a tela monta, nesta ordem, a fala, o baralho e, ao lado, a fila e o equilíbrio', () => {
  const corpo = trecho.slice(trecho.indexOf('function corpoAprovar'));
  assert.equal(emOrdem(corpo, ['class="v2c-apr d3a"', 'acaoHtml(f)', 'numerosHtml(f)', 'class="v2c-cols"', 'mesaHtml(f)', 'class="v2c-lado"', 'filaHtml(f)', 'cartaoEquilibrio()']), true);
  assert.ok(trecho.includes('<section class="d3-acao d3a-acao" aria-label="Augusto · Copy e conteúdo">'));
  assert.ok(trecho.includes("data-vc-apr-lote>${am === 1 ? 'Aprovar a de amanhã' : `Aprovar as ${am} de amanhã`}"));
  const nums = trecho.slice(trecho.indexOf('function numerosHtml'), trecho.indexOf('// Coluna esquerda'));
  assert.equal(emOrdem(nums, ["rotulo: 'Esperando você'", "rotulo: 'Mais antiga'", "rotulo: 'Com o cliente'", "rotulo: 'Aprovadas pelo cliente'"]), true);
});

test('o cartão traz arte, nome, cliente, quando veicula, objetivo, quem fez e a legenda', () => {
  const carta = trecho.slice(trecho.indexOf('<article class="v2-carta v2c-carta"'), trecho.indexOf('function falaHtml'));
  assert.equal(emOrdem(carta, ['class="v2c-arte', 'class="v2c-nome"', 'cliHtml(i.cliente)', 'avsHtml(fez)', 'PILULA_OBJETIVO[o]', 'class="d3a-dados"', 'class="v2c-leg"']), true);
  const carta0 = trecho.slice(trecho.indexOf('function cartaHtml'), trecho.indexOf('<article class="v2-carta v2c-carta"'));
  assert.equal(emOrdem(carta0, ["['no ar'", "['espera'", "['arte'", "['head'"]), true);
  assert.ok(trecho.includes("papel: 'Fez a peça'")); assert.ok(trecho.includes("papel: 'Head do cliente'"));
  assert.ok(trecho.includes('data-vc-apr-passo="-1" aria-label="Anterior"') && trecho.includes('data-vc-apr-passo="1" aria-label="Próxima"'), 'as setas do quadro passam a carta');
});

test('aprovar as de amanhã passa pelo portão, uma por vez, e nada grava direto', () => {
  assert.ok(trecho.includes("const deAmanha = (fila) => fila.filter((i) => String(i.veiculacao || '').slice(0, 10) === somaDia(hoje(), 1));"));
  const lote = trecho.slice(trecho.indexOf('function seguirLote'), trecho.indexOf('function tentarLote'));
  assert.ok(lote.includes("decidir('aprovar', true);"));
  assert.ok(trecho.includes('if (fila.some((i) => String(i.ref) === st.loteRef)) return;'), 'só segue quando a peça do portão saiu da fila');
  assert.doesNotMatch(trecho, /fetch\(|updateFocusStatus|commitStatusChange/);
});

test('o que saiu do cartão continua a um toque: abrir a peça pela arte, a lista e a explicação na ajuda', () => {
  assert.ok(trecho.includes('data-vc-apr-ver="${k}" title="Abrir a peça"'));
  assert.ok(trecho.includes('data-vc-apr-lista>ver em lista</button>'));
  assert.ok(js.includes('Em <b>Para aprovar</b>, Aprovar manda a peça para Para agendar e Pedir alteração devolve com o seu recado.'));
  assert.ok(js.includes("if (t.dataset.vcEqCliente !== undefined) { st.aba = 'equilibrio'; st.cliente = t.dataset.vcEqCliente;"));
});

test('o CSS do quadro: medidas do padrão, pelo id da janela, sem forçar regra antiga', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  assert.ok(css.split(/\r?\n/).filter((l) => /^\s*[#.]/.test(l)).every((l) => l.trimStart().startsWith('#vv-conteudo.vc')), 'toda regra começa pelo id da janela');
  assert.ok(css.includes('.v2c-mesa .v2-baralho{flex:none;width:350px;height:452px'));
  assert.ok(css.includes('.v2c-card{box-sizing:border-box;border-radius:20px;padding:18px;background:#FFFFFF'));
  assert.ok(css.includes('.v2c-seg button[aria-selected="true"]{background:#FFFFFF;color:#1F1D1A'));
  assert.ok(css.includes('.v2c-btn.g{height:38px'));
});
