import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
const files = [];
async function walk(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.claude', '.vercel', 'nao-implantado'].includes(f.name)) continue;
    const path = `${dir}/${f.name}`;
    if (f.isDirectory()) await walk(path);
    else if (/\.(js|mjs|cjs)$/.test(f.name)) files.push(path);
  }
}
await walk('.');
for (const path of files) {
  const r = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (r.status) { process.stderr.write(r.stderr); process.exit(1); }
}
const html = await readFile('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\s+src="\/([^"?]+)"\s*><\/script>/g)].map((m) => m[1]);
new vm.Script((await Promise.all(scripts.map((f) => readFile(f, 'utf8')))).join('\n;\n'));
console.log(`Sintaxe válida: ${files.length} arquivos e ordem global do frontend.`);
