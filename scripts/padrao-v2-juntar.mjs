// Padrão v2 (12/11/2026): cada grupo de telas escreveu o próprio CSS em padrao-v2/<grupo>.css. Este script junta os
// fragmentos, em ordem alfabética, em vybe-mundo-padrao-v2.css, a última folha do index.html (carrega depois de todas
// as vybe-mundo-*.css e entra no build com hash, como as outras). Rodar de novo sempre que mudar um fragmento.
import { readdir, readFile, writeFile } from 'node:fs/promises';
const pasta = new URL('../padrao-v2/', import.meta.url);
const nomes = (await readdir(pasta)).filter((f) => f.endsWith('.css')).sort();
const partes = [];
for (const n of nomes) partes.push(`/* ===== padrao-v2/${n} ===== */\r\n${(await readFile(new URL(n, pasta), 'utf8')).replace(/\r?\n/g, '\r\n').trimEnd()}\r\n`);
await writeFile(new URL('../vybe-mundo-padrao-v2.css', import.meta.url), `/* Gerado por scripts/padrao-v2-juntar.mjs a partir de padrao-v2/*.css. Não editar aqui. */\r\n${partes.join('\r\n')}`);
console.log(`vybe-mundo-padrao-v2.css: ${nomes.length} fragmentos (${nomes.join(', ')})`);
