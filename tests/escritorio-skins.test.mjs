// Skins do personagem (Paulo, 21/10/2026): o básico é grátis, o resto se compra
// na faixa dos móveis, os kits saem com desconto e ninguém perde o que já veste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bancoEscritorio as banco } from './escritorio-esquema.mjs';
import { comprarMovel, comprarKit } from '../server/escritorio-economia.js';
import { conferirFiguraDaPessoa, roupasDaPessoa, skinsAtivas, roupaDaClasse } from '../server/escritorio-roupas.js';
import { salvarPerfilEscritorio } from '../server/escritorio.js';

const AGORA = new Date();
const creditar = (sql, p, n) => sql`SELECT vybe_lancar_pontos(${p},${'teste:' + crypto.randomUUID()},NULL,NULL,${n},0)`;
async function comSkins(t) {
  const b = await banco(t);
  await b.db.exec(readFileSync('migrations/2026-10-20-escritorio-kits.sql', 'utf8'));
  return b;
}
// Um visual só com peças grátis da migração (rosto e as básicas).
async function visualGratis(sql) {
  const g = (await sql`SELECT classe FROM vybe_escritorio_catalogo WHERE classe LIKE 'roupa:%' AND preco=0`).map((r) => r.classe.slice(6));
  const de = (t) => g.find((c) => c.startsWith(t + '-'));
  return ['hd', 'hr', 'ch', 'lg', 'sh'].map((t) => de(t) + '-1').join('.');
}

test('antes da migração o criador continua livre; depois, só peças grátis, compradas ou já vestidas', async (t) => {
  const { db, sql } = await comSkins(t);
  assert.equal(await skinsAtivas(sql), false);
  await conferirFiguraDaPessoa(sql, 1, 'hd-180-1.ha-5277-110', '');
  await db.exec(readFileSync('migrations/2026-10-21-escritorio-skins.sql', 'utf8'));
  assert.equal(await skinsAtivas(sql), true);
  const base = await visualGratis(sql);
  await conferirFiguraDaPessoa(sql, 1, base, '');
  await assert.rejects(conferirFiguraDaPessoa(sql, 1, base + '.ha-5277-110', ''), (e) => e.status === 409 && e.faltam.includes('roupa:ha-5277'));
  // Já vestia: continua podendo.
  await conferirFiguraDaPessoa(sql, 1, base + '.ha-5277-110', base + '.ha-5277-62');
  // Peça que não existe no catálogo de figuras é recusada.
  await assert.rejects(conferirFiguraDaPessoa(sql, 1, base + '.ha-99999-1', ''), /não existe/);
  // Comprou: pode vestir. A peça marcante do kit é Rara (faixa da tabela).
  await creditar(sql, 1, 1000);
  const e = await comprarMovel(sql, 1, { classe: 'roupa:ha-5277', chave: crypto.randomUUID() }, AGORA);
  assert.equal(e.saldo, 880);
  await conferirFiguraDaPessoa(sql, 1, base + '.ha-5277-110', '');
  // Peça grátis não se compra; peça inventada também não.
  const gratis = 'roupa:' + base.split('.')[1].split('-').slice(0, 2).join('-');
  await assert.rejects(comprarMovel(sql, 1, { classe: gratis, chave: crypto.randomUUID() }, AGORA), /grátis/);
  await assert.rejects(comprarMovel(sql, 1, { classe: 'roupa:ha-99999', chave: crypto.randomUUID() }, AGORA), /não existe/);
  assert.ok(roupaDaClasse('roupa:hr-828'));
  assert.equal(roupaDaClasse('roupa:<x>'), null);
});

test('kits de roupa: preço da soma com desconto, tudo ou nada; o salvamento do perfil confere a figura', async (t) => {
  const { db, sql } = await comSkins(t);
  await db.exec(readFileSync('migrations/2026-10-21-escritorio-skins.sql', 'utf8'));
  const r = await roupasDaPessoa(sql, 1);
  assert.equal(r.ativo, true);
  const lobo = r.kits.find((k) => k.chave === 'skin-lobo');
  assert.equal(lobo.cheio, 120 + 25);
  assert.equal(lobo.preco, Math.round(145 * 0.8));
  assert.deepEqual(r.kits.map((k) => k.chave).sort(), ['skin-heroi', 'skin-lobo', 'skin-policial', 'skin-praia']);
  await creditar(sql, 1, 200);
  await comprarKit(sql, 1, { kit: 'skin-lobo', chave: crypto.randomUUID() }, AGORA);
  assert.deepEqual((await roupasDaPessoa(sql, 1)).meus.sort(), ['roupa:cc-3280', 'roupa:ha-5277']);
  // Quantas pessoas têm cada peça (ordem "Mais compradas"), sem dizer quem.
  assert.deepEqual((await roupasDaPessoa(sql, 2)).donos, { 'roupa:cc-3280': 1, 'roupa:ha-5277': 1 });
  // Salvar o perfil com peça que não tem é recusado; com as do kit, passa.
  const base = await visualGratis(sql);
  await assert.rejects(salvarPerfilEscritorio(sql, 1, { figura: base + '.ha-3535-1' }), (e) => e.status === 409);
  const salvo = await salvarPerfilEscritorio(sql, 1, { figura: base + '.ha-5277-110.cc-3280-110' });
  assert.match(salvo.figura, /ha-5277/);
});
