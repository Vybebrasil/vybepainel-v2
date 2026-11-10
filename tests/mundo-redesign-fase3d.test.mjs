// Redesign fase 3d (10/11/2026; quadros 39–42, 45 e 47 do moodboard): Toolkit, Academy, avisos do sino, Conversa e
// Notas, avisos curtos e o celular.
// SAFE: lê os arquivos e roda trechos num contexto vm com DOM e rede falsos; nada de rede, banco ou envio real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ler = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const js = ler('vybe-mundo.js'), css = ler('vybe-mundo.css');
const bloco3d = css.slice(css.indexOf('FASE 3d (10/11/2026'));

// DOM mínimo para o aviso curto: criar, anexar, classes, atributos, ouvintes e remover.
function domFalso({ mundo = true } = {}) {
  const ids = {};
  const novo = (tag) => {
    const el = { tagName: tag.toUpperCase(), children: [], dataset: {}, atributos: {}, ouvintes: {}, className: '', innerHTML: '', parentNode: null,
      setAttribute(k, v) { this.atributos[k] = String(v); if (k === 'id') { this.id = v; ids[v] = this; } },
      getAttribute(k) { return this.atributos[k] ?? null; },
      addEventListener(t, f) { (this.ouvintes[t] ||= []).push(f); },
      append(...nos) { for (const n of nos) { n.parentNode = this; this.children.push(n); if (n.id) ids[n.id] = n; } },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; },
      querySelectorAll(sel) { return sel === '.vv-aviso-curto' ? this.children.filter((c) => c.className.split(' ').includes('vv-aviso-curto')) : []; },
      get firstElementChild() { return this.children[0] || null; },
    };
    Object.defineProperty(el, 'id', { get() { return this._id; }, set(v) { this._id = v; if (v) ids[v] = this; }, configurable: true });
    return el;
  };
  const body = novo('body');
  body.classList = { contains: (c) => mundo && c === 'mundo' };
  return { document: { body, createElement: novo, getElementById: (id) => ids[id] || null } };
}
function avisoCurto(opcoes) {
  const fonte = ler('vybe-core.js');
  const trecho = fonte.slice(fonte.indexOf('// ─── Aviso curto do mundo'), fonte.indexOf('// ─── GraphQL Query'));
  const ctx = { ...domFalso(opcoes), setTimeout: () => 0, clearTimeout() {} };
  vm.createContext(ctx); vm.runInContext(trecho, ctx);
  return ctx;
}

test('aviso curto: um desenho só (ícone neutro, título inteiro, frase e até duas ações), no canto de cima, só no mundo', () => {
  const ctx = avisoCurto();
  const feito = [];
  const el = ctx.mostrarAvisoCurto({ icone: 'mencao', titulo: 'Bia <mencionou> você', frase: '@Operador troca a capa', acoes: [
    { rotulo: 'Abrir a peça', principal: true, fazer: () => feito.push('peca') }, { rotulo: 'Abrir a conversa', fazer: () => feito.push('conversa') }, { rotulo: 'Terceira', fazer() {} }] });
  assert.ok(el, 'cria o aviso');
  assert.equal(ctx.document.getElementById('vv-wa-avisos').children.length, 1, 'na caixa #vv-wa-avisos (canto de cima à direita)');
  assert.match(el.innerHTML, /Bia &lt;mencionou&gt; você/, 'o título vai inteiro e escapado');
  assert.equal((el.innerHTML.match(/data-aviso-curto=/g) || []).length, 2, 'no máximo duas ações');
  assert.match(el.innerHTML, /class="vc-acao" data-aviso-curto="0">Abrir a peça/, 'a menção leva direto à peça, como ação principal');
  assert.equal(el.getAttribute('role'), 'status');
  el.ouvintes.click[0]({ target: { closest: () => ({ dataset: { avisoCurto: '0' } }) } });
  assert.deepEqual(feito, ['peca']);
  const erro = ctx.mostrarAvisoCurto({ erro: true, titulo: 'Não deu para entrar na chamada' });
  assert.equal(erro.getAttribute('role'), 'alert');
  assert.match(erro.className, /\berro\b/, 'cor só para erro');
  for (let i = 0; i < 4; i++) ctx.mostrarAvisoCurto({ titulo: 'Aviso ' + i });
  assert.equal(ctx.document.getElementById('vv-wa-avisos').children.length, 3, 'empilha no máximo três');
  assert.equal(avisoCurto({ mundo: false }).mostrarAvisoCurto({ titulo: 'x' }), null, 'fora do mundo fica o aviso antigo');
  assert.doesNotMatch(bloco3d, /\.vv-aviso-curto[^{]*\{[^}]*inset 3px/, 'sem faixa colorida na borda');
  assert.match(bloco3d, /body\.mundo #toast:is\(\.ok,\.err,\.info\)\{border-left-width:1px\}/, 'o #toast também sem a faixa');
});

test('sino: aviso novo vira aviso curto com "Abrir a peça"; a primeira leitura não avisa; abrir a peça não abre a caixa antiga', async () => {
  const fonte = ler('vybe-notificacoes.js');
  const avisos = [];
  let resposta = { nao_lidas: 1, notificacoes: [{ id: '1', texto: 'Prazo amanhã', conteudo_id: '50', conteudo_nome: 'Card A', lida_em: null, criada_em: '2026-11-10T10:00:00Z' }] };
  const ctx = { document: { getElementById: () => null, querySelector: () => null, addEventListener() {} }, fetch: async () => ({ ok: true, json: async () => resposta }),
    mostrarAvisoCurto: (o) => { avisos.push(o); return {}; }, console };
  vm.createContext(ctx); vm.runInContext(fonte, ctx);
  await ctx.carregarNotificacoes();
  assert.equal(avisos.length, 0, 'a primeira leitura só conta (o sino mostra)');
  resposta = { nao_lidas: 2, notificacoes: [{ id: '2', texto: 'Vinícius mencionou você: troca a capa', conteudo_id: '51', conteudo_nome: 'Card B', lida_em: null, criada_em: '2026-11-10T11:00:00Z' }, ...resposta.notificacoes] };
  await ctx.carregarNotificacoes();
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].icone, 'mencao');
  assert.equal(avisos[0].frase, 'Vinícius mencionou você: troca a capa', 'a frase inteira');
  assert.equal(avisos[0].acoes.map((a) => a.rotulo).join(' | '), 'Abrir a peça | Ver avisos');
  assert.ok(fonte.includes('if (notificacoesAbertas) alternarNotificacoes();'), 'abrir a peça pelo painel novo não abre a caixa antiga');
});

test('avisos do sino: painel preso no sino, tipo num ícone neutro, frase inteira, ação em cada linha e "Novo" escrito', () => {
  assert.ok(js.includes("p.className = 'vv-avisos-painel'; p.setAttribute('role', 'dialog')"), 'painel, não a janela no meio da tela');
  assert.ok(!js.includes("m.className = 'vv-avisos-menu'"), 'sem o menu de escolha antigo');
  for (const t of ['<h3>Esperando você</h3>', '<h3>Nos seus clientes</h3>', '<h3>Notificações</h3>', 'data-aviso-lidos>Marcar como lidos', 'data-aviso-centro>Ir ao Centro de Operação'])
    assert.ok(js.includes(t), t);
  assert.ok(js.includes('<em class="vv-aviso-novo">Novo</em>'), 'não lido com a palavra, não só a cor');
  assert.ok(js.includes(">Abrir a peça</button>` : ''"), 'a notificação abre a peça');
  assert.ok(js.includes("typeof notificacoesNaoLidas === 'number'"), 'o número do sino conta as notificações (o ponto antigo não tem número)');
  assert.match(bloco3d, /\.vv-avisos-painel\{position:fixed;z-index:770;/);
});

test('Toolkit: o dock abre a Visão geral com os cartões das ferramentas e os usados por último', () => {
  assert.ok(js.includes("{ id: 'toolkit', nome: 'Visão geral', dica: 'As ferramentas e o que você usou por último', mod: ['VybeFerramentas', 'inicio'] }"));
  assert.ok(js.includes("if (id === 'setor:toolkit') { usarTrilho('toolkit'); return; }"), 'antes abria em branco');
  const fonte = ler('vybe-mundo-ferramentas.js');
  const guardado = {};
  const ctx = { window: {}, localStorage: { getItem: (k) => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } }, addEventListener() {}, console };
  ctx.window.addEventListener = () => {};
  vm.createContext(ctx); vm.runInContext(fonte, ctx);
  const F = ctx.window.VybeFerramentas;
  assert.deepEqual({ ...F._rotuloDoUso({ tipo: 'qr', dados: { texto: 'https://brussolo.com.br/cardapio' } }) }, { titulo: 'brussolo.com.br/cardapio', sub: 'QR Code' });
  assert.equal(F._rotuloDoUso({ tipo: 'whatsapp', dados: { numero: '(74) 99999-1234', mensagem: 'Oi' } }).sub, 'Link do WhatsApp · "Oi"');
  assert.ok(fonte.includes("const ABAS = [['inicio', 'Visão geral'],"));
  assert.ok(fonte.includes('class="vf-amostra outra'), 'a cor do QR pela paleta do sistema, com "Outra" para a marca do cliente');
  assert.ok(!fonte.includes('<label class="vf-cor"><span>Cor</span><input type="color"'), 'sem a cor nativa solta');
});

test('Academy: o vazio tem o botão de começar e a frase útil; quem não monta sabe a quem pedir', () => {
  const fonte = ler('vybe-mundo-pessoas.js');
  assert.ok(fonte.includes("acao('Montar a primeira trilha', 'data-vp-trilha-modelo')"));
  assert.ok(fonte.includes("perto('[data-vp-trilha-modelo]')") && fonte.includes('TRILHA_PADRAO'), 'a primeira trilha começa pelo modelo, para editar');
  assert.ok(fonte.includes('Quem monta as trilhas são os donos e o RH: peça a eles a sua.'));
});

test('Conversa e Notas: a coluna para acima do dock; Notas é a terceira aba, no mesmo lugar e desenho', () => {
  const conversa = ler('vybe-mundo-conversa.js'), notas = ler('vybe-notas.js'), ccss = ler('vybe-mundo-conversa.css'), aparencia = ler('vybe-appearance.css');
  assert.ok(conversa.includes("[['conversa', 'Conversa'], ['recados', 'Recados'], ['notas', 'Notas']]"));
  assert.ok(conversa.includes("if (aba === 'notas') { abrirNotasNaColuna(); return; }"));
  assert.ok(notas.includes("janela.className = 'notas-janela' + (notasNaColuna() ? ' na-coluna' : '');"));
  assert.ok(notas.includes('notasIrParaAba') && notas.includes('class="notas-discreto"'), 'abas no topo das Notas; renomear e apagar como botões discretos');
  assert.ok(notas.includes("notasIcone('fechar')") && !notas.includes("'⤢'") && !notas.includes("'▣'"), 'ícones desenhados no lugar de ⤢ ▣ —');
  assert.ok(ccss.includes('.vv-conversa-topo{flex:none;display:flex;flex-direction:row;'), 'abas e X na mesma linha');
  assert.ok(ccss.includes('bottom:var(--vv-coluna-fundo,84px)') && css.includes('bottom:var(--vv-coluna-fundo,var(--vv-m))!important'), 'a coluna termina acima do dock');
  assert.match(bloco3d, /body\.mundo\{--vv-coluna-fundo:calc\(var\(--vv-m,14px\) \+ var\(--vv-dock-alto,0px\) \+ 6px\)\}/);
  assert.ok(aparencia.includes('.notas-janela.cheia:not(.na-coluna) { inset: 16px !important;'), 'a janela solta antiga não manda na coluna');
});

test('celular: topo com busca, avisos e conta; cinco lugares embaixo com Criar no meio; "Mais" com o resto; dock em cartão', () => {
  assert.ok(js.includes('data-cel="conversas"') && js.includes('data-cel="mais" aria-haspopup="dialog"'));
  assert.ok(js.includes("const FERR_NO_TOPO_CEL = ['busca', 'avisos', 'conta'];"));
  assert.ok(js.includes("const NA_BARRA_CEL = ['hoje', 'criar', 'setor:producao'];"));
  assert.ok(js.includes('orig.click();'), 'cada item do "Mais" chama o mesmo botão de antes (cadeado e destino iguais)');
  assert.ok(js.includes('<b>Fora das salas</b>') && js.includes('data-dock="entrar" title="Entrar na chamada'), 'fora de uma sala, o cartão com Entrar');
  assert.ok(js.includes('data-dock-extra'), 'o resto do dock vai para o "Mais", sem sumir');
  assert.ok(js.includes("body.classList.toggle('cel-na-sala'"), 'dentro de uma sala o dock toma o lugar da barra de baixo');
  assert.ok(js.includes("Math.ceil(innerHeight - topo - margem)"), 'a altura do dock é medida na tela estreita');
  const cel = bloco3d.slice(bloco3d.indexOf('@media (max-width:600px){\n  body.mundo .vv-barra-topo'));
  assert.ok(cel.includes('body.mundo .vv-trilho{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));'), 'cinco lugares, sem rolar de lado');
  assert.ok(cel.includes('body.mundo .vv-trilho [data-trilho="criar"]{order:2}'), 'Criar no meio');
  assert.ok(cel.includes('body.mundo .vv-dock-salas-faixa > .vq-dock{flex-wrap:wrap;'), 'na chamada o dock quebra linha em vez de cortar o último botão');
});

test('janela de módulo por cima de uma tela antiga: o topo do mundo e o canto antigo não cobrem o cabeçalho dela', () => {
  assert.ok(css.includes('html body.mundo.mundo-modulo:not(.palco-modulo) #mundo-hud > .vv-topo{display:flex!important}'), 'com palco-modulo vale a regra que esconde o HUD');
  assert.ok(css.includes('body.mundo.mundo-modulo:not(.palco-modulo) .vv-canto-modulo{display:flex}'));
  assert.ok(!css.includes('html body.mundo.mundo-modulo #mundo-hud > .vv-topo{display:flex!important}'));
  assert.ok(bloco3d.includes('body.mundo .vc-camada > #vv-carteira{height:100%}'), 'a Carteira termina acima do dock');
});

test('fase 3d sem forçar nada: nenhum !important nem html body.mundo no bloco novo', () => {
  assert.ok(bloco3d.length > 1000);
  assert.doesNotMatch(bloco3d, /!important/);
  assert.doesNotMatch(bloco3d, /html body\.mundo/);
  assert.doesNotMatch(ler('vybe-mundo-ferramentas.css'), /!important/);
});
