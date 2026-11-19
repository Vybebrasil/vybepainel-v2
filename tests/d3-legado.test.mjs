// Direção 3 nas janelas que ficaram do legado (14/11/2026): confirmar em preto, janela clara com canto 20, nada de
// laranja cheio fora do bloco de ação; páginas públicas (aprovação de peças, 404 local, link de onboarding vencido) na
// paleta areia/branco/tinta, em UTF-8.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';

const raiz = new URL('../', import.meta.url);
const ler = (f) => readFileSync(new URL(f, raiz), 'utf8');
const css = ler('padrao-v2/d3-legado.css').replace(/\/\*[\s\S]*?\*\//g, ' ');
const regra = (sel) => { const i = css.indexOf(sel + '{'); assert.ok(i >= 0, `falta a regra ${sel}`); return css.slice(i, css.indexOf('}', i)); };

test('janelas do legado: confirmar em preto e janela branca com canto 20', () => {
  assert.match(regra('dialog.clientes-vinculo-dialog.clientes-vinculo-dialog footer button[data-salvar]'), /background:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('dialog.clientes-vinculo-dialog.clientes-vinculo-dialog'), /border-radius:var\(--d3-r-cartao\);background:(?:var\(--d3-cartao\)|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(regra('#cartao-rapido .cr-rodape .cr-abrir'), /background:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('#ag-cartao.ag-cartao'), /--ds-acao:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('#da-today-production-overlay .da-today-production-modal'), /background:(?:var\(--d3-cartao\)|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(ler('padrao-v2/notas.css'), /\.vbl-fundo #vbl-janela \.vbl-botao\.principal\{background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\))/);
  assert.match(regra('dialog.appearance-dialog.appearance-dialog .appearance-done'), /background:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('.vv-personagem.vv-personagem'), /--ds-acao:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('#office-ficha :is(.ofc-dia-barra,.ofc-escada-barra) > i'), /background:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('#ofc-aviso-novo .aviso-form [type=submit]'), /background:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('#ofc-tutorial .tut-acoes .abr-primario'), /background:(?:var\(--d3-tinta\)|var\(--d3-(?:tinta|fume-contra|contra)(?:,[^)]*\))?\))/);
  assert.match(regra('#previa-grande .previa-grande-vidro'), /background:(?:var\(--d3-cartao\)|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(ler('padrao-v2/notas.css'), /#v2-notas \.v2nt-btn\.p\{background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\))/);
  assert.doesNotMatch(css, /--d3-acao\b|#C2490C/i, 'o laranja cheio não entra nestas janelas');
});

test('dia do calendário: as cores antigas com !important leem a variável da janela', () => {
  const mundo = ler('vybe-mundo.css');
  assert.match(mundo, /\.manager-calendar-event:not\(#vv-x\)\{background:var\(--d3-ev-fundo,/);
  assert.match(regra('#dia-do-calendario.dia-do-calendario'), /--d3-ev-fundo:(?:var\(--d3-cartao\)|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\))/);
  assert.match(regra('#dia-do-calendario .dia-do-calendario-lista .manager-calendar-event-status::before'), /background:var\(--event-color/);
  // As janelas que agora são da Direção 3 saíram das listas escuras com !important da folha antiga.
  assert.doesNotMatch(ler('vybe-padrao.css'), /\.da-today-production-overlay\{|\.da-today-production-modal\{|\.da-today-timeline-empty\{/);
});

test('aprovação pública de peças: paleta da Direção 3, sem mudar as ações', async () => {
  const { paginaHtml } = await import('../server/conteudo-aprovacao-pagina.js');
  const html = paginaHtml({ cliente: 'Cliente X', expira_em: new Date().toISOString(), respondidas: [],
    pecas: [{ id: 'p1', titulo: 'Card', formato: 'Card', veiculacao: '2026-11-20', arquivos: [{ id: 'a1', nome: 'c.png', imagem: true }] }] }, { nonce: 'n', base: '/aprovar-pecas/t' });
  assert.match(html, /body\{margin:0;background:(?:#EAE6DE|var\(--d3-(?:areia|borda)(?:,[^)]*\))?\))/);
  assert.match(html, /\.cartao\{background:(?:#FFFFFF|var\(--d3-(?:cartao|contra|escuro-texto)(?:,[^)]*\))?\));border:0;border-radius:20px/);
  assert.match(html, /\.btn\.sim,\.btn\.principal\{background:(?:#1F1D1A|var\(--d3-(?:tinta|fume-contra|tinta-fixa)(?:,[^)]*\))?\))/);
  assert.match(html, /\.pilula\.espera::before\{background:#579BFC\}/);
  assert.match(html, /data-acao="abrir-ajuste"[^>]*>Pedir ajuste<\/button><button type="button" class="btn sim" data-acao="aprovar">Aprovar/);
  assert.match(html, /<div class="marca"><img src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /#FF7A2F|#F6F3EE/);
});

test('404 do servidor local e link de onboarding vencido: página D3 em UTF-8', async () => {
  const { paginaD3Html } = await import('../server/pagina-d3.js');
  const p = paginaD3Html({ titulo: 'Não encontrado.', rotulo: '404', acao: { texto: 'Abrir o Vybe OS', href: '/' } });
  assert.match(p, /<meta charset="utf-8">/);
  assert.match(p, /background:(?:#EAE6DE|var\(--d3-(?:areia|borda)(?:,[^)]*\))?\))/);
  assert.match(p, /<h1>Não encontrado\.<\/h1>/);
  assert.match(p, /class="acao" href="\/"/);
  assert.match(ler('server/reunioes.js'), /paginaD3Html\(\{ titulo: 'Link expirado'/);

  const { createDevServer } = await import('../scripts/dev-server.mjs');
  const server = createDevServer();
  const pedir = (url) => new Promise((resolve) => {
    const req = Readable.from([]); Object.assign(req, { url, method: 'GET', headers: {} });
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h); return this; },
      end(d) { resolve({ status: this.statusCode, headers: this.headers, body: d?.toString() || '' }); } };
    server.emit('request', req, res);
  });
  const nada = await pedir('/rota-que-nao-existe');
  assert.equal(nada.status, 404);
  assert.match(nada.headers['Content-Type'], /text\/html; charset=utf-8/);
  assert.match(nada.body, /Não encontrado\./);
  assert.equal((await pedir('/instalar.html')).status, 200);
  assert.equal((await pedir('/instalar')).status, 200);
});
