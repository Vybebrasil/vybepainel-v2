// V2 · S, frente d (19/11/2026): as funções novas de Automações › Nova regra, Recado para todos e Meu perfil. Cada uma é
// tirada do arquivo de verdade e roda num contexto isolado: nada de rede, nada gravado, nenhum recado enviado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const trecho = (fonte, de, ate) => { const i = fonte.indexOf(de), j = fonte.indexOf(ate, i + 1); assert.ok(i >= 0 && j > i, `achei ${de}`); return fonte.slice(i, j); };
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const auto = ler('vybe-automacoes-ui.js');

function regra(rascunho, catalogos = {}) {
  const ctx = {
    safeText: esc, CATALOGOS: catalogos, pinturas: 0,
    fetch: () => { throw new Error('o ensaio não pode chamar a rede'); },
    nomeDeStatus: (s) => `S:${s}`, nomeDeGrupo: (g) => `G:${g}`, nomeDeCaptacao: (c) => `C:${c}`, nomeDeFormato: (f) => `F:${f}`,
    nomeDePessoa: (p) => `Pessoa ${p}`, primeiroNome: (n) => String(n).split(' ')[0] + String(n).split(' ')[1],
    rotuloDoCatalogo: (lista, chave) => `${lista}:${chave}`, frasearGatilho: (g) => `virar ${g.para || g.tipo}`,
  };
  vm.createContext(ctx);
  const codigo = trecho(auto, 'const jsArgRegra', 'function fraseDoRascunhoHtml')
    + trecho(auto, 'function ensaioDoRascunho', 'function pintarConstrutor');
  vm.runInContext(`let RASCUNHO = ${JSON.stringify(rascunho)}; function pintarConstrutor() { pinturas++; }\n${codigo}\nthis.api = { ensaioDoRascunho, ensaiarRascunho, escolhaDeVariosRegra, escolhaDeUmRegra, ensaio: () => ENSAIO_DO_RASCUNHO };`, ctx);
  return ctx;
}

test('Nova regra: o ensaio monta a peça só na tela, sem rede, e diz o que mudaria', () => {
  const r = { gatilho: { tipo: 'status', para: 'aprovado' }, condicao: { formato_em: ['reels'], grupo_em: ['g1'] },
    acoes: [{ tipo: 'grupo', para: 'g2' }, { tipo: 'responsaveis', modo: 'replace', pessoas: [7] }, { tipo: 'update' }, { tipo: 'notificar' }] };
  const ctx = regra(r);
  const { peca, mudou } = ctx.api.ensaioDoRascunho(r);
  assert.equal(peca.formato, 'reels');
  assert.equal(peca.status, 'aprovado', 'o gatilho de status vira o status da peça de teste');
  assert.equal(peca.grupo, 'g2');
  assert.deepEqual(JSON.parse(JSON.stringify(peca.responsaveis)), ['7']);
  assert.equal(peca.comentarios, 1);
  assert.equal(peca.avisos, 1);
  assert.deepEqual(JSON.parse(JSON.stringify([...mudou].sort())), ['grupo', 'responsaveis']);
  ctx.api.ensaiarRascunho();
  assert.equal(ctx.pinturas, 1);
  assert.match(ctx.api.ensaio(), /^Numa peça de F:reels, quando virar aprovado: fica no grupo G:g2, com Pessoa7, um comentário escrito, o responsável avisado\./);
  assert.match(ctx.api.ensaio(), /Ensaio só na tela: nada foi gravado nem avisado\.$/);
});

test('Nova regra: sem gatilho ou sem ação, o Testar pede o que falta', () => {
  const ctx = regra({ gatilho: { tipo: 'status' }, acoes: [] });
  ctx.api.ensaiarRascunho();
  assert.equal(ctx.api.ensaio(), 'Para testar, escolha o gatilho e pelo menos uma ação.');
});

test('Nova regra: escolha de vários e de um são listas que abrem no lugar, com o resumo em frase', () => {
  const ctx = regra(null, { formatos: [{ chave: 'reels', rotulo: 'Reels' }, { chave: 'card', rotulo: 'Card' }], grupos: [{ chave: 'g1' }, { chave: 'g2' }] });
  const varios = ctx.api.escolhaDeVariosRegra('f', 'formatos', ['reels', 'card'], "alternar('formato',{chave})", 'qualquer formato');
  assert.match(varios, /^<details class="rg2-varios" data-k="f"><summary class="rg2-resumo"><span>formatos:reels e formatos:card<\/span><\/summary>/);
  assert.equal((varios.match(/aria-pressed="true"/g) || []).length, 2);
  const vazio = ctx.api.escolhaDeVariosRegra('f', 'formatos', [], 'x', 'qualquer formato');
  assert.match(vazio, /<summary class="rg2-resumo vazio"><span>qualquer formato<\/span><\/summary>/);
  const um = ctx.api.escolhaDeUmRegra('a0', 'grupos', 'g2', 'acoes.0.para', 'escolha o grupo');
  assert.match(um, /class="rg2-varios rg2-um"/);
  assert.match(um, /<summary class="rg2-resumo"><span>para G:g2<\/span><\/summary>/);
  assert.match(ler('padrao-v2/s-d.css'), /#automacoes-root \.rg2-resumo > span\{[^}]*color:var\(--d3-tinta\)/, 'a cor vai no span: o legado pinta todo summary de escuro com !important');
  assert.match(um, /this\.closest\(&#39;details&#39;\)\.open=false|this\.closest\('details'\)\.open=false/, 'a lista fecha ao escolher');
  assert.doesNotMatch(um + varios, /<select/, 'sem <select>: o legado pinta campo de branco com !important');
});

test('Recado para todos: a prévia mostra como a equipe vê, com o primeiro nome e sem enviar nada', () => {
  const fonte = ler('vybe-escritorio.js');
  const ctx = {
    safeText: esc, escritorio: { base: { eu: '1' } },
    ESCRITORIO_ESTILOS_AVISO: { padrao: { nome: 'Padrão', arte: 'arte_x' } },
    ESCRITORIO_DESTINOS_AVISO: { '': { rotulo: 'Só o recado' }, loja: { rotulo: 'Abrir a loja', acao: 'loja' } },
    escritorioCabecaUrl: () => '', escritorioVitrineHtml: () => '<div class="vb-vitrine"></div>', escritorioMiniaturaHtml: (c) => `<img data-c="${c}">`,
  };
  vm.createContext(ctx);
  vm.runInContext(trecho(fonte, 'function escritorioAvisoPreviaHtml', 'function abrirMandarAvisoEscritorio') + '\nthis.previa = escritorioAvisoPreviaHtml;', ctx);
  const html = ctx.previa({ titulo: 'Chegou', texto: 'Linha 1\nLinha 2', destino: '', estilo: 'padrao', autor: { id: '1', nome: 'Paulo Martins' } });
  assert.match(html, /Recado de <b>Paulo<\/b> para todos/);
  assert.match(html, /<span class="rc2-av" aria-hidden="true">PA<\/span>/, 'sem foto, as iniciais');
  assert.match(html, /<h3 id="aviso-titulo-previa">Chegou<\/h3>/);
  assert.match(html, /Linha 1<br>Linha 2/);
  assert.match(html, /<span class="rc2-ok">Entendi<\/span>/);
  assert.match(ctx.previa({ destino: 'loja', estilo: 'padrao', autor: {} }), /<span class="rc2-ok">Abrir a loja<\/span>.*|Título do recado/s);
  const janela = trecho(fonte, 'function abrirMandarAvisoEscritorio', 'function previaAvisoEscritorio');
  assert.match(janela, /<button type="submit" class="rc2-btn k">Mandar para todos<\/button>/);
  assert.match(janela, /onsubmit="event\.preventDefault\(\);enviarAvisoEscritorio\(this\)"/, 'o envio continua o mesmo, só no clique');
  const css = ler('padrao-v2/s-d.css');
  assert.match(css, /#ofc-aviso-novo :is\(\.rc2-ign,\.rc2-ok,\.rc2-btn\)\{[^}]*height:34px[^}]*border-radius:var\(--d3-r-botao\)/, 'botão de 34 com canto 8');
});

test('Meu perfil: estante por nível, oito à vista com "e mais", título com contagem e as categorias de sempre', () => {
  const fonte = ler('vybe-escritorio-ficha.js');
  const degraus = (ok) => [1, 2, 3, 4].map((n) => ({ nivel: n, nome: ['', 'Bronze', 'Prata', 'Ouro', 'Diamante'][n], meta: n * 10, ok: n <= ok, classe: `t${n}`, titulo: n <= ok ? `Título ${n}` : '', moedas: 10, pontos: 20 }));
  const marcos = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, nome: `Escada ${i}`, unidade: 'peças', nivel: i < 9 ? 1 : 4, valor: i < 9 ? 12 : 40, degraus: degraus(i < 9 ? 1 : 4), proximo: i < 9 ? { nivel: 2, nome: 'Prata', meta: 20, classe: 't2' } : null }));
  const ctx = { safeText: esc, escritorio: { base: { eu: '1', equipe: [{ id: '1', titulo: null }], economia: {} }, perfil: {} }, escritorioMiniaturaHtml: (c) => `<img data-c="${c}">`,
    ESCRITORIO_GRUPOS_CONQUISTA: [['entregas', 'Entregas', 'dica', ['m0', 'm1']]], document: { body: { classList: { contains: (c) => c === 'mundo' } } } };
  vm.createContext(ctx);
  vm.runInContext(trecho(fonte, 'const ESCRITORIO_NIVEIS_V2', 'function escolherAbaFichaEscritorio') + '\nthis.api = { escritorioEstantePorNivel, escritorioConquistasFichaV2Html, escritorioFichaV2 };', ctx);
  assert.equal(ctx.api.escritorioFichaV2(), true, 'no mundo, a ficha nova');
  const grupos = ctx.api.escritorioEstantePorNivel(marcos);
  assert.deepEqual(JSON.parse(JSON.stringify(grupos.map((g) => [g.nome, g.itens.length]))), [['Diamante', 1], ['Ouro', 1], ['Prata', 1], ['Bronze', 10]]);
  let html = ctx.api.escritorioConquistasFichaV2Html(marcos, { meu: true });
  assert.match(html, /Sua estante · 13 troféus/);
  assert.match(html, /<b>Bronze<\/b><span>10<\/span>/);
  assert.equal((html.match(/<li title="Escada \d Bronze">/g) || []).length, 8, 'oito à vista');
  assert.match(html, /e mais 2<\/button>/);
  assert.match(html, /<span class="pf2-mini"><img data-c="t1"><\/span>/, 'a miniatura voxel no lugar do ícone');
  assert.match(html, /Trocar título · 13/);
  assert.match(html, /<b>1<\/b><small>Diamante<\/small>.*<b>10<\/b><small>Bronze<\/small>/s);
  assert.match(html, /<b>Próximo troféu<\/b> · Escada \d Prata · 12 de 20/);
  assert.doesNotMatch(html, /pf2-titulos/, 'a lista de títulos só abre ao pedir');
  ctx.escritorio.cqTitulos = true;
  ctx.escritorio.pfEstante = { 1: true };
  html = ctx.api.escritorioConquistasFichaV2Html(marcos, { meu: true });
  assert.match(html, /class="pf2-titulos"/);
  assert.match(html, /Fechar títulos/);
  assert.match(html, /onclick="escolherTituloEscritorio\('nenhum'\)">Não mostrar título/);
  assert.equal((html.match(/<li title="Escada \d Bronze">/g) || []).length, 10, 'aberto, todos');
  ctx.escritorio.pfCqModo = 'categorias';
  html = ctx.api.escritorioConquistasFichaV2Html(marcos, { meu: true });
  assert.match(html, /Perto de subir/);
  assert.match(html, /onclick="escolherAbaConquistasEscritorio\('entregas'\)">Entregas · 2\/2/);
  assert.match(html, /12 de 20 · faltam 8 para Prata/);
  assert.match(html, /\+10 moedas<br>\+20 XP/, 'o prêmio do próximo nível');
});

test('Seu personagem e Meu perfil: as abas ficam fora do "Mais" da peça de abas (têm o desenho da prancha)', () => {
  assert.match(ler('vybe-core.js'), /const VB_ABAS_FORA = '[^']*\.vv-personagem-abas, \.pf2-abas/);
});
