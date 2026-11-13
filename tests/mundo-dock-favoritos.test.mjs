// Dock lateral (Paulo, 11/11/2026): área sem acesso não aparece, VybeHub como item e favoritos por pessoa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../vybe-mundo.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../vybe-mundo.css', import.meta.url), 'utf8');

test('área só dos donos some do dock para quem não tem acesso (sem borrão nem cadeado)', () => {
  assert.match(css, /\.vv-trilho \.trancado\{display:none\}/);
  assert.doesNotMatch(css, /\.vv-trilho \.trancado>span[^{]*\{filter:blur/, 'o borrão antigo saiu');
  assert.match(css, /body\.trilho-largo \.vv-trilho-grupo\[hidden\]/, 'o título do grupo vazio some no dock largo');
  assert.match(js, /const vazio = itens\.length > 0 && itens\.every\(\(b\) => b\.classList\.contains\('trancado'\)\);/);
  // Paulo, 13/11/2026: a guarda do atalho e da busca passou a ser trancadoPara (dono/coordenação e, para o dinheiro, só dono).
  assert.match(js, /if \(trancadoPara\(id\)\) \{ const b = hud\.querySelector/, 'atalho e busca continuam barrados');
  assert.match(js, /const tranca = trancadoPara\(id\);/, 'o dock usa a mesma regra');
  assert.match(js, /b\.hidden \|\| b\.classList\.contains\('trancado'\)\) continue;/, 'o Mais do celular também não mostra');
});

test('VybeHub é item do dock e abre o Hub ao lado', () => {
  assert.match(js, /\{ id: 'vybehub', grupo: 'Operação', nome: 'VybeHub',[^}]*url: 'https:\/\/vybehub\.vercel\.app\/'/);
  assert.match(js, /const fora = TRILHO\.find\(\(t\) => t && typeof t === 'object' && t\.id === id && t\.url\);/);
  assert.match(js, /if \(fora\) \{ window\.open\(fora\.url, '_blank', 'noopener'\); return; \}/);
});

test('favoritos: por pessoa, só o que abre tela, com limite e sem mostrar o que a pessoa não abre', () => {
  assert.match(js, /const chaveFav = \(\) => 'vybe\.mundo\.favoritos\.' \+/);
  assert.match(js, /operadorDoTopo\(\)\?\.id/);
  assert.match(js, /const favoritavel = \(t\) => Boolean\(t && typeof t === 'object' && !Array\.isArray\(t\.sub\) && !t\.acao && t\.id !== 'hoje'\);/);
  assert.match(js, /const FAV_MAX = 12;/);
  assert.match(js, /const favVisivel = \(x\) => Boolean\(x\) && !trancadoPara\(x\.id\) && !\(x\.setor && trancadoPara\(x\.setor\)\)/);
  assert.match(js, /if \(marca\(\) === favPintado\) return;/, 'não repinta sem mudança (os observadores do HUD)');
  assert.match(js, /const fav = e\.target\.closest\?\.\('\.vv-trilho \[data-fav\]'\); if \(fav\) \{ e\.preventDefault\(\); alternarFavorito\(fav\.dataset\.fav\); return; \}/, 'a estrela não abre o item');
  assert.match(js, /<h3>Favoritos<\/h3>/, 'no celular os favoritos vêm no Mais');
  assert.doesNotMatch(css.slice(css.indexOf('/* Favoritos do dock'), css.indexOf('/* Ver como: faixa no topo')), /!important/, 'bloco novo sem !important');
});

// Paulo, 13/11/2026: "admin e dono são a mesma coisa... Paulo, Ewerton, Vinícius e Deivid podem e veem tudo; e a Beatriz
// só não tem acesso às finanças". Roda o trecho real de vybe-mundo.js (de souDonoDeVerdade até trancadoPara).
test('cadeados: dono vê tudo, coordenação vê tudo menos o dinheiro, equipe não vê Negócio; ver como só muda a tela', async () => {
  const vm = await import('node:vm');
  const ini = js.indexOf('function souDonoDeVerdade()'), fim = js.indexOf('function aplicarCadeados()');
  assert.ok(ini > 0 && fim > ini, 'trecho das regras de acesso');
  const trecho = js.slice(ini, fim);
  const regra = ({ dono = false, coordenacao = false, verComo = '' } = {}) => {
    const ctx = vm.createContext({
      souDonoDaSessao: () => dono, souCoordenacaoDaSessao: () => coordenacao, souAdmin: () => dono || coordenacao,
      sessionStorage: { getItem: () => verComo },
      TEAM_USERS: [{ id: '68035537', dono: true }, { id: '71130408' }, { id: '70000001' }],
      EQUIPES: { coordenacao: ['71130408'] },
    });
    vm.runInContext(trecho + '\nthis.trancadoPara = trancadoPara;', ctx);
    return ctx.trancadoPara;
  };
  const NEGOCIO = ['setor:comercial', 'setor:gestao', 'agentes', 'recrutamento', 'documentos', 'visao:setor:pessoas'];
  const DINHEIRO = ['setor:financas', 'financas', 'recebimentos', 'contas', 'inadimplencia', 'vybe-financas', 'ai-usage'];
  const dono = regra({ dono: true }), beatriz = regra({ coordenacao: true }), equipe = regra();
  for (const id of [...NEGOCIO, ...DINHEIRO, 'tarefas']) assert.equal(dono(id), false, 'dono vê ' + id);
  for (const id of NEGOCIO) assert.equal(beatriz(id), false, 'coordenação vê ' + id);
  for (const id of DINHEIRO) assert.equal(beatriz(id), true, 'coordenação não vê o dinheiro: ' + id);
  for (const id of [...NEGOCIO, ...DINHEIRO]) assert.equal(equipe(id), true, 'equipe não vê ' + id);
  assert.equal(equipe('tarefas'), false, 'o que é de todos continua aberto');
  // Ver como: o dono vendo como a coordenação perde só o dinheiro; vendo como a equipe, perde Negócio e dinheiro.
  const comoBeatriz = regra({ dono: true, verComo: '71130408' }), comoEquipe = regra({ dono: true, verComo: '70000001' });
  assert.equal(comoBeatriz('setor:comercial'), false); assert.equal(comoBeatriz('setor:financas'), true);
  assert.equal(comoEquipe('setor:comercial'), true); assert.equal(comoEquipe('financas'), true);
  // A coordenação vendo como um dono não ganha o dinheiro (a sessão de verdade manda).
  const beatrizComoDono = regra({ coordenacao: true, verComo: '68035537' });
  assert.equal(beatrizComoDono('setor:comercial'), false); assert.equal(beatrizComoDono('ai-usage'), true);
});
