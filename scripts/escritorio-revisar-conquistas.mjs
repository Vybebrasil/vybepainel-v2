// Uma vez, depois de migrations/2026-10-21-escritorio-conquistas-dificeis.sql
// (decisão do Paulo, 21/10/2026: "não zera todos, só o que a pessoa vai perder
// na regra nova"): tira de cada pessoa os níveis que a meta nova não alcança,
// com a conquista do razão e o troféu (inclusive do quarto), e confere a
// equipe de novo para conceder o que a regra nova já dá. Marcador
// conquistas-dificeis-2026-10-21; repetir não faz nada.
// Uso: DATABASE_URL vindo de um arquivo, para a credencial não ir ao shell:
//   node scripts/escritorio-revisar-conquistas.mjs <arquivo-com-a-url>
import { readFileSync } from 'node:fs';
import { bancoComTransacoes } from '../server/transacao-automacoes.js';
import { revisarNiveisEscritorio, conferirMarcosDaEquipe } from '../server/escritorio-marcos.js';

const sql = bancoComTransacoes(readFileSync(process.argv[2], 'utf8').trim());
const r = await revisarNiveisEscritorio(sql, 'conquistas-dificeis-2026-10-21', { tirarDoQuarto: true });
console.log('revisão:', JSON.stringify(r));
if (!r.repetida) console.log('conferência:', JSON.stringify(await conferirMarcosDaEquipe(sql)));
