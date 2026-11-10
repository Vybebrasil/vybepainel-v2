// Redesign dos quadros 57 a 60 (Paulo, 10/11/2026: "executa tudo"): Comercial e Finanças com números, próximos passos e
// meta mesmo sem dados; o funil em colunas com os motivos de perda como filtro; Finanças por cliente com todos os
// clientes ativos e o aviso neutro; a Equipe com retrato, situação, um botão principal e as ações raras no "Mais".
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ler = (f) => readFileSync(f, 'utf8');
const esperar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 2)); };

function elemento(tag) {
  return { tagName: tag.toUpperCase(), dataset: {}, hidden: false, innerHTML: '', ouvintes: {}, scrollTop: 0, attrs: {}, classList: { add() {}, remove() {} },
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); },
    q: {}, querySelector(sel) { return (this.q[sel] ||= { innerHTML: '', scrollTop: 0, focus() {}, querySelector: () => null }); },
    querySelectorAll: () => [], contains: () => false, append() {}, focus() {} };
}
function contexto(respostas, extra = {}) {
  const criados = [], corpo = elemento('body');
  const doc = { body: corpo, activeElement: null, createElement: (t) => { const e = elemento(t); criados.push(e); return e; },
    getElementById: (id) => criados.find((e) => e.id === id) || null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const pedidos = [];
  const ctx = vm.createContext({ document: doc, console, setTimeout, clearTimeout, Intl, Date, JSON, Math, Number, String, Object, Array, Promise, Error, Map, Set, URL, encodeURIComponent, confirm: () => true,
    fetch: async (url, op = {}) => {
      pedidos.push({ url: String(url), op });
      const r = respostas(String(url), op);
      return { ok: r.status === 200, status: r.status, json: async () => r.corpo };
    }, ...extra });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = () => {};
  return { ctx, doc, criados, pedidos };
}
const vazioOk = () => ({ status: 200, corpo: { ok: true } });

test('Comercial e Finanças: sem dados, a visão geral mostra os números, os próximos passos e a meta (não uma frase solta)', async () => {
  const em20 = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const { ctx, criados } = contexto((url) => {
    if (url.includes('area=carteira')) return { status: 200, corpo: { ok: true, contratos: { lista: [{ cliente_id: '2', renovacao: em20, status: 'ativo' }] } } };
    if (url.includes('aba=pacotes')) return { status: 200, corpo: { ok: true, pacotes: [] } };
    if (url.includes('area=vybe_financas')) return { status: 200, corpo: { ok: true, conectado: false } };
    return vazioOk(); // o que a demonstração e um banco vazio devolvem
  }, { CADASTRO_CLIENTES: [{ id: '1', nome: 'Academia Lions' }, { id: '2', nome: 'Alpha1' }, { id: '3', nome: 'Saiu', ativo: false }] });
  vm.runInContext(ler('vybe-mundo-setor.js'), ctx);
  const visao = criados.find((e) => e.className?.includes('vv-setor-visao'));
  const subs = ['funil', 'pacotes', 'orcamentos', 'contratos'].map((id) => ({ id, nome: id }));
  ctx.VybeSetor.abrir('setor:comercial', { nome: 'Comercial', subs, abrirSub() {}, irSetor() {} });
  await esperar();
  const html = visao.querySelector('.vs-corpo').innerHTML;
  assert.doesNotMatch(html, /Sem números do Comercial agora/);
  for (const t of ['Leads novos', 'Propostas enviadas', 'Negócios fechados', 'Clientes ativos', 'Próximos passos', 'Meta do mês']) assert.ok(html.includes(t), t);
  assert.match(html, /data-setor-sub="funil">Abrir o funil/, 'cada número leva à aba');
  assert.match(html, /Cadastrar os pacotes da Vybe/);
  assert.match(html, /1 contrato renova em 30 dias/);
  assert.match(html, /<b class="vs-kpi-valor">2<\/b>/, 'clientes ativos do cadastro, sem os inativos');
  assert.match(html, /Nenhuma meta definida/);

  ctx.VybeSetor.abrir('setor:financas', { nome: 'Finanças', subs: ['financas', 'recebimentos', 'contas', 'inadimplencia'].map((id) => ({ id, nome: id })), abrirSub() {}, irSetor() {} });
  await esperar();
  const fin = visao.querySelector('.vs-corpo').innerHTML;
  assert.doesNotMatch(fin, /Sem números de Finanças agora/);
  for (const t of ['Receita contratada', 'Recebido', 'Em atraso', 'Próximos passos', 'Ligar o Vybe Finanças', 'Meta de vendas do mês']) assert.ok(fin.includes(t), t);
  assert.match(fin, /data-setor-ir="setor:comercial"/, 'a meta mora no Funil: o botão leva ao Comercial');
});

function comercial(respostas, extra) {
  const c = contexto(respostas, extra);
  vm.runInContext(ler('shared/comercial-calculos.js'), c.ctx);
  vm.runInContext(ler('vybe-mundo-comercial.js'), c.ctx);
  const janela = () => c.criados.find((e) => e.id === 'vv-comercial');
  const clicar = (dataset) => janela().ouvintes.click[0]({ target: { closest: () => ({ dataset }) } });
  return { ...c, janela, clicar };
}

test('Funil: uma coluna por fase mesmo vazio, Novo lead no título e os motivos de perda como filtro do Perdido', async () => {
  const calc = (await import('../shared/comercial-calculos.js')).default;
  const ops = [{ id: '1', nome: 'Padaria Sol', etapa: 'empresa' }, { id: '2', nome: 'Pet Feliz', etapa: 'perdido', motivo_perda: 'preco' }, { id: '3', nome: 'Loja Azul', etapa: 'perdido', motivo_perda: 'timing' }];
  let comDados = false;
  const { ctx, janela, clicar, pedidos } = comercial((url) => {
    if (url.includes('area=crm')) return { status: 200, corpo: { ok: true, id: '9', criada: true } };
    if (!comDados) return vazioOk();
    return { status: 200, corpo: { ok: true, pode: { editar_comercial: true }, etapas: [], fases: calc.FASES, motivos: calc.MOTIVOS_PERDA, oportunidades: ops, resumo: calc.resumoFunil(ops, calc.FASES), valor_disponivel: true } };
  });
  ctx.VybeComercial.abrir('funil'); await esperar();
  let html = janela().innerHTML;
  assert.equal((html.match(/<section class="vc-coluna/g) || []).length, calc.FASES.length, 'sem resposta do funil, as fases padrão vazias');
  assert.doesNotMatch(html, /Novo lead/, 'só quem edita o comercial vê o botão');

  comDados = true; ctx.VybeComercial.abrir('funil'); await esperar();
  html = janela().innerHTML;
  assert.match(html.slice(0, html.indexOf('vc-abas')), /data-vc="lead"[^>]*>.*Novo lead/, 'Novo lead no topo, ao lado do título');
  assert.match(html, /data-vc-motivo="preco"[^>]*>Preço <b>1<\/b>/);
  assert.doesNotMatch(html, /role="tablist" aria-label="Fases do funil"/, 'as fases não são mais abas');
  assert.ok(html.includes('Pet Feliz') && html.includes('Loja Azul'));
  clicar({ vcMotivo: 'preco' });
  html = janela().innerHTML;
  assert.ok(html.includes('Pet Feliz') && !html.includes('Loja Azul'), 'o filtro mostra só as perdas com o motivo');

  clicar({ vc: 'lead' });
  assert.match(janela().innerHTML, /aria-label="Novo lead"/);
  // Enviar a folha cria a empresa pelo mesmo CRM do 1º andar.
  const form = { elements: { nome: { value: 'Ótica Nova' }, cnpj: { value: '' }, setor_empresa: { value: 'Ótica' } } };
  await janela().ouvintes.submit[0]({ target: { closest: () => form }, preventDefault() {} });
  const criar = pedidos.find((p) => p.url.includes('area=crm') && p.op.method === 'POST');
  assert.deepEqual(JSON.parse(criar.op.body), { acao: 'criar', etapa: 'empresa', nome: 'Ótica Nova', cnpj: '', setor_empresa: 'Ótica' });
});

test('Finanças por cliente: os clientes ativos aparecem sem contrato e o aviso do Vybe Finanças é neutro', async () => {
  const { ctx, janela } = comercial((url) => (url.includes('aba=financas') ? { status: 200, corpo: { ok: true, pode: { ver_dinheiro: true }, clientes: [] } } : vazioOk()), {
    souDonoDaSessao: () => true, CADASTRO_CLIENTES: [{ id: '1', nome: 'Antonov' }, { id: '2', nome: 'Academia Lions' }],
    VybeFinancas: { estado: () => ({ dados: { conectado: false, motivo: 'Falta a ligação do banco', passos: ['Ligar'] } }), carregar: async () => {} },
  });
  ctx.VybeComercial.abrir('financas'); await esperar();
  const html = janela().innerHTML;
  assert.doesNotMatch(html, /Nenhum cliente ativo/);
  assert.ok(html.indexOf('Academia Lions') < html.indexOf('Antonov'), 'em ordem alfabética');
  assert.equal((html.match(/>sem contrato</g) || []).length, 2);
  assert.match(html, /class="vc-nota"/);
  assert.doesNotMatch(html, /só leitura|class="vc-aviso"/);
  assert.match(html, /Falta a ligação do banco/, 'o motivo continua na tela');
});

test('Equipe: retrato, situação escrita, um botão principal e as ações raras no Mais; perigoso só lá dentro', () => {
  const doc = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null };
  const ctx = vm.createContext({ document: doc, console, Date, String, Number, Math, JSON, Object, Array, setTimeout, clearTimeout,
    safeText: (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    escritorioCabecaUrl: (q) => (String(q) === '2' ? 'https://www.habbo.com/habbo-imaging/avatarimage?figure=hd-180&headonly=1' : null) });
  vm.runInContext(ler('vybe-conta.js'), ctx);
  ctx.__equipe = [{ id: '1', nome: 'Eu Mesmo', email: 'eu@x', admin: true, pode_entrar: true, ativo: true, tem_senha: true, ultimo_acesso: new Date().toISOString() },
    { id: '2', nome: 'Bia', email: 'bia@x', admin: true, pode_entrar: true, ativo: true, tem_senha: true, ultimo_acesso: null },
    { id: '3', nome: 'Ex', email: 'ex@x', admin: false, pode_entrar: false, ativo: false }];
  vm.runInContext('EQUIPE = globalThis.__equipe; globalThis.__html = blocoEquipe({ email: "eu@x" })', ctx);
  const html = ctx.__html, linhas = html.split('class="eq-linha').slice(1);
  assert.match(linhas[1], /<img src="https:\/\/www\.habbo\.com\/habbo-imaging[^"]*"/, 'o boneco do Escritório (o mundo troca pelo voxel)');
  assert.match(linhas[1], /liberado · entrou há|liberado · nunca entrou/);
  const fora = (l) => l.slice(0, l.indexOf('class="eq-mais"') >>> 0);
  assert.match(fora(linhas[1]), />Definir senha</, 'um botão principal');
  assert.doesNotMatch(fora(linhas[1]), /Tirar admin|subsolo/i, 'as ações raras não ficam soltas');
  assert.match(linhas[1], /eq-mais-menu[\s\S]*Tirar admin[\s\S]*eq-mais-perigo[\s\S]*Mandar para o subsolo/);
  assert.doesNotMatch(linhas[0], /Tirar admin|Tirar acesso|subsolo<\/span>/, 'ninguém se tira o próprio acesso');
  assert.match(linhas[2], /no subsolo do Escritório[\s\S]*>Reativar</);
  assert.match(html, /conta-secao-topo[\s\S]*Novo colaborador<\/button><\/header>/, 'Novo colaborador à direita do título');
});

test('CSS: o redesign entra no fim, sem !important; o tema escuro da conta vale só fora do mundo', () => {
  const css = ler('vybe-mundo.css'), bloco = css.slice(css.indexOf('COMERCIAL E FINANÇAS, VISÕES GERAIS (redesign, quadro 57'));
  assert.ok(bloco.length > 100 && bloco.includes('CONTA E EQUIPE (redesign, quadro 60'));
  assert.doesNotMatch(bloco, /!important|html body\.mundo/);
  const com = ler('vybe-mundo-comercial.css'), funil = com.slice(com.indexOf('Redesign do Funil'));
  assert.doesNotMatch(funil, /!important/);
  assert.match(funil, /#vv-comercial \.vc-nota\{/);
  const ap = ler('vybe-appearance.css');
  assert.ok(ap.includes(':where(body:not(.mundo)).vybe-desktop .conta-barra {'));
  assert.ok(ap.includes(':where(body:not(.mundo)).vybe-desktop .conta-aba.ativa {'));
  assert.doesNotMatch(ler('vybe-conta.js'), /--tom:/, 'ícones do menu neutros');
});
