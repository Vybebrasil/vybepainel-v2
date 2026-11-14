import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Padrão v2 (13/11/2026): os quadros "Login e entrada" e "VYBES e Criar" do moodboard aprovado.
const ler = (arq) => fs.readFileSync(arq, 'utf8').replace(/\r\n/g, '\n');
const login = ler('vybe-login.js');
const mundo = ler('vybe-mundo.js');
const cadastro = ler('cadastros_governed_v2.js');
const css = ler('padrao-v2/entrada.css');
function funcao(src, nome) {
  const i = src.indexOf(`function ${nome}(`);
  assert.ok(i >= 0, `achei ${nome}`);
  let n = 0;
  for (let k = src.indexOf('{', src.indexOf(')', i)); k < src.length; k++) { if (src[k] === '{') n++; else if (src[k] === '}' && --n === 0) return src.slice(i, k + 1); }
  throw new Error('chaves de ' + nome);
}

test('login: sem a cena antes, um campo por vez (quem, senha; ou e-mail e depois senha)', () => {
  const montar = funcao(login, 'montarTelaDeLogin');
  for (const velho of ['login-chegar', 'Entrar na Vybelândia', 'vybelandiaCenaHtml', "dataset.etapa = 'cena'"]) assert.ok(!montar.includes(velho), `saiu ${velho}`);
  assert.match(montar, /gate\.dataset\.etapa = 'login'/);
  assert.match(montar, /data-passo="quem"/);
  // Os ids que o resto do sistema e as provas usam continuam os mesmos.
  for (const id of ['login-form', 'login-rostos-lista', 'login-email', 'login-senha', 'login-erro', 'login-entrar', 'login-titulo']) assert.match(montar, new RegExp(`id="${id}"`), id);
  for (const t of ['Quem é você?', 'Sua senha', '>Trocar<', 'Outra pessoa', 'Não estou na lista']) assert.ok(montar.includes(t), t);
  assert.match(funcao(login, 'passoDoLogin'), /botao\.textContent = passo === 'email' \? 'Continuar' : 'Entrar'/);
});

test('login: cumprimenta quem entrou por último neste computador e não muda o que vai ao servidor', () => {
  assert.match(funcao(login, 'pintarRostos'), /const ultimo = ultimoRosto\(\);[\s\S]*escolherRosto\(ultimo\)/);
  assert.match(funcao(login, 'escolherRosto'), /passoDoLogin\('senha'\)/);
  assert.match(funcao(login, 'pintarOutros'), /ROSTOS\.filter\(\(r\) => !ESCOLHIDO \|\| r\.id !== ESCOLHIDO\.id\)\.slice\(0, 4\)/);
  assert.match(login, /body: JSON\.stringify\(ESCOLHIDO \? \{ pessoa_id: ESCOLHIDO\.id, senha \} : \{ email, senha \}\)/);
  assert.match(login, /window\.VYBE_ACABOU_DE_ENTRAR = true;\n      gate\.remove\(\);\n      iniciarPainel\(\);/);
  // O e-mail confere só o formato e passa para a senha, sem ir ao servidor antes da hora.
  const iniEnvio = login.indexOf("form.addEventListener('submit'"), envio = login.slice(iniEnvio, login.indexOf("const resposta = await fetch('/api/sessao'", iniEnvio));
  assert.match(envio, /if \(form\.dataset\.passo === 'email'\) \{[\s\S]*passoDoLogin\('senha'\);[\s\S]*return;\n    \}/);
  // Sair limpa o navegador, menos o último rosto e o "Continuar" de cada pessoa.
  assert.match(funcao(login, 'sairDaSessao'), /!chave\.startsWith\('vybe\.continuar\.'\)/);
});

test('entrada: só logo depois do login, antes do passeio, com a fala, Continuar (se houver) e três atalhos', () => {
  assert.match(mundo, /if \(window\.VYBE_ACABOU_DE_ENTRAR && !APP_AGENDA\) \{ window\.VYBE_ACABOU_DE_ENTRAR = false; vigiarContinuar\(\); mostrarEntrada\(\); \}/);
  assert.match(mundo, /if \(entradaAberta\) tourDepoisDaEntrada = true; else window\.VybeTutorial\?\.iniciar\?\.\(\);/);
  const html = funcao(mundo, 'entradaHtml');
  // Direção 3 (quadro D3-Entrada): faixa laranja, linhas Agora/Depois/Em seguida, três números e a agenda do dia.
  assert.match(html, /class="d3-acao d3en-acao"/);
  for (const q of ["lin('Agora'", "lin('Depois'", "lin('Em seguida'"]) assert.ok(html.includes(q), q);
  assert.match(html, /aria-label="Agenda do dia"/);
  assert.match(html, /<h2 id="v2en-cont-t">Continuar<\/h2>/);
  assert.match(html, /const cont = c \?/, 'sem nada guardado, o cartão não aparece');
  assert.match(html, /\$\{c\.total \? `<span class="d3-barra"/, 'barra só com o dado de progresso');
  for (const a of ["num('hoje'", "num('tarefas'", "num('aprovacoes'"]) assert.ok(html.includes(a), a);
  const acao = funcao(mundo, 'acaoDaEntrada');
  assert.match(acao, /fecharEntrada\(\);/);
  assert.match(acao, /usarTrilho\('tarefas'\)/);
  assert.match(acao, /window\.VybeConteudo\.abrir\(\{ aba: 'aprovar' \}\)/);
});

test('Continuar de onde parou: guardado no navegador por pessoa, com try/catch, a partir do que a pessoa abre', () => {
  const ler = funcao(mundo, 'lerContinuar'), guardar = funcao(mundo, 'guardarContinuar'), vigiar = funcao(mundo, 'vigiarContinuar');
  assert.match(ler, /try \{[^}]*localStorage\.getItem\(CHAVE_CONTINUAR \+ id\)/);
  assert.match(guardar, /try \{ localStorage\.setItem\(CHAVE_CONTINUAR \+ id, JSON\.stringify\(\{ \.\.\.x, quando: new Date\(\)\.toISOString\(\) \}\)\); \} catch/);
  for (const f of ['openItemWorkspace', 'openDemandaWorkspace', 'abrirPlanejamento', 'abrirClienteDetalhe']) assert.ok(vigiar.includes(`embrulhar('${f}'`), f);
  assert.match(vigiar, /const r = f\.apply\(this, a\);/, 'a função original continua sendo chamada, com o mesmo retorno');
  // Progresso só quando o planejamento traz a revisão.
  assert.match(vigiar, /rv\.total && \['revisar', 'ajustes'\]\.includes\(p\.estado\)/);
  // O "quando" diz hoje, ontem ou a data.
  const ctx = {}; vm.createContext(ctx); vm.runInContext(`${funcao(mundo, 'quandoAbriu')}`, ctx);
  const agora = new Date(); agora.setHours(18, 47, 0, 0);
  assert.equal(ctx.quandoAbriu(agora.toISOString()), 'hoje, 18:47');
  assert.equal(ctx.quandoAbriu(new Date(agora.getTime() - 864e5).toISOString()), 'ontem, 18:47');
  assert.equal(ctx.quandoAbriu('nada'), '');
});

test('Criar: quatro tipos, Demanda abre no lugar e segue para o cadastro de sempre; os outros abrem as telas que existem', () => {
  const painel = funcao(mundo, 'criarPainelHtml');
  for (const t of ['>Demanda<', "'Planejamento'", "'Conteúdo'", "'Reunião'", 'Como chega na equipe', 'Produção de conteúdo', 'Solicitação de demanda', 'Calendário sazonal']) assert.ok(painel.includes(t), t);
  assert.match(painel, /class="v2-abre v2cr-dem" aria-expanded="\$\{criarAberto\}"/);
  assert.match(painel, /window\.fcPreviaDoCriar\(criarBoard\)/, 'a prévia pelas regras do cadastro');
  assert.match(funcao(mundo, 'cadastroDoCriar'), /window\.openCadastrosGoverned\(inicial\)/);
  assert.match(funcao(mundo, 'cadastroDoCriar'), /const inicial = \{ board, \.\.\.\(criarCliente \? \{ client: criarCliente \} : \{\}\) \};/);
  const cliques = mundo.slice(mundo.indexOf("const b = e.target.closest?.('.v2cr [data-criar], .v2cr [data-criar-board]')"), mundo.indexOf("document.addEventListener('change', (e) => { const s = e.target.closest?.('.v2cr [data-criar-cliente]')"));
  assert.match(cliques, /a === 'conteudo'\) cadastroDoCriar\('producao'\)/);
  assert.match(cliques, /a === 'reuniao'\) \{ fecharCriar\(\); if \(window\.VybeReunioes\?\.abrir\) window\.VybeReunioes\.abrir\(\);/);
  assert.match(funcao(mundo, 'planejamentoDoCriar'), /window\.novoPlanejamento\(String\(c\.id\), c\.nome\)/);
  assert.match(funcao(mundo, 'planejamentoDoCriar'), /window\.VybePlanejamentos\.abrir\(\)/);
  assert.match(funcao(mundo, 'usarTrilho'), /criar: \(\) => abrirCriar\(\)/);
});

test('a prévia do Criar usa o quadro e a regra de entrada do cadastro, sem mexer nele', () => {
  const quadros = cadastro.slice(cadastro.indexOf('const FC_QUADROS = {'), cadastro.indexOf('const FC_PRIORIDADES'));
  const ini = cadastro.indexOf('window.fcPreviaDoCriar = function'), previa = cadastro.slice(ini, cadastro.indexOf('\n};', ini) + 3);
  const ctx = { window: {}, TEAM_USERS: [{ id: 7, name: 'Beatriz Lima' }], fcCorDeStatus: (s) => ({ color: s === 'A Fazer' ? '#c4c4c4' : '#579bfc' }),
    cadastrosDestiny: () => ({ group: 'novo_grupo__1', status: 'A Fazer', assignees: [7] }), chaveDeStatus: (s) => String(s).toLowerCase().replace(/\s+/g, '_') };
  vm.createContext(ctx); vm.runInContext(`${quadros}\n${previa}`, ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.fcPreviaDoCriar('producao'))), { formato: 'Formato', grupo: 'Design & Edição', status: 'A Fazer', cor: '#c4c4c4', equipe: 'Beatriz' });
  const dem = ctx.window.fcPreviaDoCriar('demandas');
  assert.equal(dem.grupo, 'Novas Demandas/Ideias', 'grupo de outro quadro cai no primeiro deste');
  assert.equal(dem.status, 'Nova Demanda');
  assert.equal(dem.formato, 'Tipo de demanda');
});

test('Hoje sem fila: a conversa do VYBES com as abas, as sugestões e "Pergunte ao VYBES", ao lado do Criar', () => {
  const pintar = funcao(mundo, 'desenharHoje');
  const semFila = pintar.slice(pintar.indexOf('if (!fila) {'), pintar.indexOf('const abertas = fila.itens'));
  assert.match(semFila, /<div class="v2vb-grade">\$\{conversaHtml\(\)\}\$\{criarPainelHtml\('hoje'\)\}<\/div>/);
  assert.match(semFila, /Dia de: escolher/);
  const conversa = funcao(mundo, 'conversaHtml');
  for (const t of ['data-conversa-ag=', 'data-conversa-sug=', 'O que temos para hoje?', 'Quem está travado?', 'Semana da agência', 'Pergunte ou peça ao', 'data-conversa-voz', '>Perguntar<', 'data-pergunta']) assert.ok(conversa.includes(t), t);
  assert.match(mundo, /vybes: \['VYBES', 'Agência inteira'\], danilo: \['Danilo', 'Direção de arte'\], heitor: \['Heitor', 'Coordenação de produção'\]/);
  // A resposta é da central: aqui fica o pedido enviado, sem resposta inventada.
  assert.match(funcao(mundo, 'perguntarAoVybes'), /chamar\('chooseVybesMode', \{ pedido: setor \? `\[\$\{setor\}\] \$\{t\}` : t \}\)/);
  assert.match(conversa, /pedido enviado ao VYBES: a resposta abre na janela dele/);
});

test('CSS: fragmento sem !important nem html body.mundo, com as medidas dos quadros', () => {
  assert.doesNotMatch(css, /!important|html body\.mundo/);
  assert.match(css, /#login-gate \.v2lg\{[^}]*width:380px;[^}]*padding:28px;border-radius:28px;background:#FFFFFF/);
  assert.match(css, /#login-gate \.v2lg-campo > input\{[^}]*height:46px;[^}]*border-radius:999px;background:#F9F8F5;box-shadow:inset 0 0 0 1\.5px #1F1D1A/);
  assert.match(css, /#login-gate \.v2lg-entrar\{[^}]*height:46px;[^}]*background:#1F1D1A/);
  assert.match(css, /#vv-entrada \.v2en-btn\{[^}]*height:44px;padding:0 22px;[^}]*background:#1F1D1A/, 'Direção 3: o laranja cheio fica só para o bloco de ação');
  assert.match(css, /:is\(#vv-hoje,#vv-criar\) \.v2cr-det\{display:grid;grid-template-columns:minmax\(0,1fr\) 190px;gap:12px/);
  assert.match(css, /:is\(#vv-hoje,#vv-criar\) \.v2cr-tipo\{[^}]*height:128px;/);
  assert.match(css, /#vv-hoje \.v2vb-bal\{[^}]*border-radius:6px 18px 18px 18px;background:#F4F1FB/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  // A regra antiga do portão (com !important) agora tem o fundo do quadro.
  assert.match(ler('vybe-mundo.css'), /#login-gate\.irecity\{background:linear-gradient\(180deg,#F1EEE8 0%,#E6E0D6 100%\)!important\}/);
});
