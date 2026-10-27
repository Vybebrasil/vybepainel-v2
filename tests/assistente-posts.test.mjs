import test from 'node:test';
import assert from 'node:assert/strict';
import { mensagemResultadoPosts } from '../server/assistente-hub.js';

// Resultado dos posts de ontem: alcance contra a média do cliente (30 dias), salvamentos e compartilhamentos.
test('resultado dos posts: só os de ontem, comparados com a média; cliente sem post ontem fica de fora', () => {
  const p = (date, alcance, extra = {}) => ({ date, alcance, tipo: 'Reels', legenda: 'Treino de perna', ...extra });
  const texto = mensagemResultadoPosts('2026-10-27', [
    { cliente: 'MR Fit', posts: [p('2026-10-26T15:00:00+0000', 3200, { salvamentos: 41, compartilhamentos: 12 }), p('2026-10-20T15:00:00+0000', 1000), p('2026-10-18T15:00:00+0000', 1200), p('2026-10-15T15:00:00+0000', 800)] },
    { cliente: 'Copirecê', posts: [p('2026-10-26T20:00:00+0000', 300, { tipo: 'Post', legenda: 'Milho' }), p('2026-10-20T15:00:00+0000', 1000), p('2026-10-19T15:00:00+0000', 1000), p('2026-10-18T15:00:00+0000', 1000)] },
    { cliente: 'Hebravet', posts: [p('2026-10-20T15:00:00+0000', 1000)] },
  ]);
  assert.match(texto, /^📈 \*Resultado dos posts de ontem \(26\/10\)\*/);
  assert.match(texto, /\*MR Fit\*\n🔥 Reels “Treino de perna”: alcance \*3\.200\* \(3,2x a média\), 41 salvamentos, 12 compartilhamentos/);
  assert.match(texto, /\*Copirecê\*\n📉 Post “Milho”: alcance \*300\* \(30% da média\)/);
  assert.doesNotMatch(texto, /Hebravet/);
  // Post das 23h de ontem no horário da Bahia (02h UTC de hoje) conta como ontem.
  assert.match(mensagemResultadoPosts('2026-10-27', [{ cliente: 'X', posts: [p('2026-10-27T02:00:00+0000', 500)] }]), /\*X\*\n📊 Reels/);
  assert.equal(mensagemResultadoPosts('2026-10-27', [{ cliente: 'X', posts: [] }]), null);
});
