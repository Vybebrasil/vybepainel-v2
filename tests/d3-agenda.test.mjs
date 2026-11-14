// Direção 3 · grupo "agenda" (quadros D3-Agenda, D3-Planejamentos, D3-Impressoes, D3-Projetos, D3-Creators,
// D3-Fornecedores, D3-Toolkit e a Agenda do D3-Celular): o bloco de ação laranja no lugar da fala, quatro números, as
// tabelas com faixas de seção e o CSS preso ao id de cada janela. SAFE: só lê os arquivos.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const css = ler('padrao-v2/d3-agenda.css'), semComentario = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('o fragmento d3-agenda.css não força nada, usa os tokens e prende cada regra ao id da janela', () => {
  assert.doesNotMatch(semComentario, /!important|html body\.mundo/);
  const regras = semComentario.split('}').map((r) => r.trim()).filter((r) => r && !r.startsWith('@media') && /\{/.test(r));
  for (const r of regras) assert.match(r.replace(/^@media[^{]*\{\s*/, ''), /^(:is\()?#(pv2-agenda|vv-planejamentos|vv-impressoes|vv-pessoas|vv-comercial|vv-ferramentas)/, r.slice(0, 80));
  assert.ok((semComentario.match(/var\(--d3-/g) || []).length > 100, 'as cores vêm dos tokens --d3-*');
  assert.match(ler('vybe-mundo-padrao-v2.css'), /padrao-v2\/d3-agenda\.css/, 'o juntador levou o fragmento');
});

test('Agenda: bloco de ação do Lucas, quatro números, faixa da semana, Na ordem de fazer e o lado', () => {
  const js = ler('vybe-captacoes.js');
  for (const t of ['d3AcaoHtml({ agente: "L", ...acao })', 'rotulo: "Gravações para fechar"', 'rotulo: "Peças sem roteiro"', 'rotulo: "Captações sem peças"', 'rotulo: "Captações na semana"',
    'class="d3ag-card d3ag-faixa"', '<h3>Na ordem de fazer</h3>', '<h3>Esperando captação</h3>', '<h3>Roteiros</h3>', 'class="pv2-linha v2-abre d3ag-abre"', '>Fechar gravação</button>'])
    assert.ok(js.includes(t), t);
  // Nenhuma função some: grade por hora, inspetor, tipos, atalhos e a navegação continuam.
  for (const t of ['pv2aGrade()', 'captAlternarInspetor()', "captTipo('${t}')", 'T hoje · ← → navega', 'captNavegar(-1)', 'captNavegar(1)', 'captVerDia(', 'captAbrirMontar(', 'captCadastrar(']) assert.ok(js.includes(t), t);
  assert.doesNotMatch(js, /Lucas · Audiovisual e captação/);
  assert.match(ler('padrao-v2/agenda-celular.css'), /#pv2-agenda \.capt-fab\{display:grid;width:56px;height:56px;border-radius:16px;background:var\(--d3-tinta\);color:#FFFFFF/);
});

test('Planejamentos, Impressões, Projetos e Toolkit: bloco de ação, números D3 e sem frase explicativa', () => {
  const plj = ler('vybe-mundo-planejamentos.js'), imp = ler('vybe-mundo-impressoes.js'), pes = ler('vybe-mundo-pessoas.js'), fer = ler('vybe-mundo-ferramentas.js');
  assert.match(plj, /window\.d3AcaoHtml\(\{ agente: 'A'/); assert.match(plj, /rotulo: 'Peças para aprovar'/); assert.match(plj, /d3pl-sec/);
  assert.match(imp, /window\.d3AcaoHtml\(\{ agente: 'N'/); assert.match(imp, /rotulo: 'Entregues no mês', valor: String\(doMes\.length\), serie:/); assert.match(imp, /Escolher gráfica/);
  assert.match(pes, /agente: 'H', frase: corpo/); for (const t of ['Em andamento', 'Etapas vencidas', 'Etapas feitas', 'Próxima entrega']) assert.ok(pes.includes(`rotulo: '${t}'`), t);
  assert.match(fer, /window\.d3AcaoHtml\(\{ agente: 'V'/); assert.doesNotMatch(fer, /<p class="p2-sub">\$\{esc\(f\.frase\)\}<\/p>/);
  // Os botões do alto ficam brancos: o laranja cheio é só o bloco de ação.
  assert.doesNotMatch(plj, /class="p2-btn p"/); assert.doesNotMatch(imp, /class="p2-btn p"/);
});

test('Fornecedores e Creators entram na Direção 3 da janela do Comercial, com o subtítulo curto e Ajuda', () => {
  const com = ler('vybe-mundo-comercial.js');
  assert.match(com, /const D3 = new Set\(\[[^\]]*'fornecedores', 'creators'[^\]]*\]\);/);
  assert.match(com, /SUB_D3 = \{ fornecedores: 'gráficas, estúdios e parceiros', creators: 'Irecê e região' \}/);
  assert.match(com, /quem: 'Nestor · Compras', agente: 'N'/); assert.match(com, /quem: 'VYBES · Agência', agente: 'V'/);
  // Campanhas gravadas desde 14/11/2026 (vybe_creator_campanhas): o número e a ficha "Em campanha" vêm do servidor.
  assert.match(com, /rotulo: 'Em campanha', valor: num\(nCamp\.length\)/); assert.match(com, /campanha: \['Em campanha', emCamp\]/);
  assert.match(com, /d\.campanhas_disponivel === false \? \{ rotulo: 'Em campanha', valor: '—', sub: 'sem registro ainda' \}/, 'sem a tabela, o vazio honesto');
});
