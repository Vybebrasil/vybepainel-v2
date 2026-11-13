import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { montarPecaDeCabeca, PECAS_MODELADAS, PECAS_EFEITO, temReceitaDeCabeca, RECEITAS_DE_CABECA } from '../mundo/pecas-cabeca.mjs';

test('peças de cabeça modeladas: cada item da tabela tem receita e sai em caixas na medida da cabeça', () => {
  for (const [item, receita] of Object.entries(PECAS_MODELADAS)) {
    assert.ok(RECEITAS_DE_CABECA.includes(receita), item);
    const p = montarPecaDeCabeca(item + '-61', '#8A5A3C', '#2B1D14');
    assert.ok(p.caixas.length >= 4, item + ' tem detalhe');
    for (const c of p.caixas) {
      assert.ok(Math.abs(c.x) < 1 && Math.abs(c.z) < 1, item + ': caixa longe da cabeça');
      assert.ok(c.y > .4 && c.y < 3, item + ': caixa fora da altura da cabeça');
    }
  }
  assert.equal(montarPecaDeCabeca('ha-3567-1408').cobre, 1, 'a cabeça de cavalo toma o lugar da cabeça');
  assert.ok(temReceitaDeCabeca('ha-6273-76-66'), 'as cores do item não mudam a receita');
  assert.ok(PECAS_EFEITO.has('fa-5948'), 'fumaça é efeito: não vira bloco');
});

test('personagem item a item: cada peça do Habbo lida sozinha, a falha não fica guardada, e o boneco mantém a cabeça', () => {
  const mh = fs.readFileSync('mundo/moveis-habbo.mjs', 'utf8');
  assert.match(mh, /export function pecaVoxelDoHabbo/);
  assert.match(mh, /const sozinha = CABECA_PADRAO \+ '\.' \+ parte/, 'cada item sobre a cabeça padrão, sozinho');
  assert.match(mh, /CACHE\.delete\(chave\); return null;/, 'falha do Habbo não fica guardada');
  assert.match(mh, /fotosEmCurso < 3/, 'fila das fotos: o Habbo recusa rajada');
  const av = fs.readFileSync('mundo/avatar.mjs', 'utf8');
  assert.match(av, /a\.cobre > \.55 && a\.caixas\?\.length/, 'só a máscara modelada toma o lugar da cabeça: proporção sempre a mesma');
  assert.match(av, /const naCasca/, 'peça esculpida veste o cubo da cabeça por fora');
  assert.match(av, /janela do rosto/, 'cabelo não cobre o rosto');
  const vp = fs.readFileSync('vybe-mundo-personagem.js', 'utf8');
  assert.match(vp, /\['hd', 'Rosto'\], \['hr', 'Cabelo'\]/, 'uma aba por tipo de item do Habbo');
  assert.match(vp, /data-vp="peca"/); assert.match(vp, /avatarVoxelFiel/);
});
