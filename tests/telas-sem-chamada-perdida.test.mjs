// Função apagada e chamada esquecida: o painel só quebra na hora em que alguém
// clica. Foi o que aconteceu com a mesa do DA — daPlanningBulkToolbarHtml saiu
// numa limpeza e ficou uma chamada dela em openDaIndividualPlanningDesk; o
// "Organizar agenda" parou de abrir e nenhum teste viu.
//
// Este teste lê os arquivos na ordem do index.html, junta o que cada um declara
// e cobra as chamadas às funções do painel (os nomes com prefixo nosso). Chamada
// protegida por `typeof x === 'function'` não conta: ali a ausência é prevista.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// O prefixo exige uma maiúscula depois: pega daPlanningX, filaX, renderX, e
// deixa de fora variáveis locais de nome curto (grupos, mesa) chamadas como
// função dentro de um escopo que este teste não enxerga.
const PREFIXOS = /^(daPlanning|daController|daDaily|daTactical|fila|acao|mesa|fc|render|repintar|montar|abrirMenu|grupo|lote)[A-Z][A-Za-z]*$/;

function declaradas(fontes) {
  const nomes = new Set();
  for (const { texto } of fontes) {
    for (const m of texto.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) nomes.add(m[1]);
    for (const m of texto.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/g)) nomes.add(m[1]);
    for (const m of texto.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) nomes.add(m[1]);
  }
  return nomes;
}

test('nenhuma tela chama função do painel que não existe mais', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const arquivos = [...html.matchAll(/src="\/([a-z0-9_.-]+\.js)"/g)].map((m) => m[1]);
  assert.ok(arquivos.length > 20, 'o index.html deve listar os arquivos do painel');
  const fontes = arquivos.map((arquivo) => ({ arquivo, texto: fs.readFileSync(arquivo, 'utf8') }));
  const existe = declaradas(fontes);

  const perdidas = [];
  for (const { arquivo, texto } of fontes) {
    for (const m of texto.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const nome = m[1];
      if (!PREFIXOS.test(nome) || existe.has(nome)) continue;
      // `typeof nome === 'function'` logo antes é guarda explícita.
      const antes = texto.slice(Math.max(0, m.index - 120), m.index);
      if (new RegExp(`typeof\\s+${nome}\\s*===?\\s*'function'`).test(antes)) continue;
      perdidas.push(`${nome} em ${arquivo}`);
    }
  }
  assert.deepEqual([...new Set(perdidas)], [], 'chamadas sem função declarada');
});
