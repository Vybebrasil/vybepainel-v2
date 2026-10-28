import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerirEncaixes, mensagemEncaixe } from '../server/assistente-encaixe.js';

// Encaixe de captação: janelas livres nos próximos dias úteis, dois clientes por janela, quem veicula antes primeiro.
test('encaixe: pula fim de semana e horário ocupado; dois clientes por janela de 2 h', () => {
  const pecas = [
    { cliente_id: '3', cliente: 'MR Fit', veiculacao: '2026-11-03' }, { cliente_id: '3', cliente: 'MR Fit', veiculacao: '2026-11-05' },
    { cliente_id: '4', cliente: 'Antonov', veiculacao: '2026-11-04' }, { cliente_id: '5', cliente: 'Hebravet', veiculacao: '2026-11-10' },
  ];
  // 30/10 (sex): 8h-10h ocupado. 31/10 e 01/11 são fim de semana.
  const eventos = [{ dia: '2026-10-30', inicio: '08:30', fim: '09:30' }];
  const s = sugerirEncaixes({ dia: '2026-10-29', eventos, pecas });
  assert.deepEqual(s.map((x) => [x.dia, x.inicio, x.clientes.map((c) => c.cliente + '@' + c.inicio + '-' + c.fim)]), [
    ['2026-10-30', '10:00', ['MR Fit@10:00-11:00', 'Antonov@11:00-12:00']],
    ['2026-10-30', '14:00', ['Hebravet@14:00-16:00']],
  ]);
  const t = mensagemEncaixe(s, 4);
  assert.match(t, /^🎬 \*Encaixe de captação\*\n4 peça\(s\) esperando gravação\.\n\n1\. \*sex 30\/10 · 10h às 12h\* → MR Fit \(2 peças, 10h\) \+ Antonov \(1 peça, 11h\) · cód 2026-10-30\|3@10:00-11:00,4@11:00-12:00/);
  assert.equal(mensagemEncaixe([], 0), null);
});
