import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { conexao } from './postgres.mjs';
import { areaImpressoes, definirPeloAgente, impressoesParaAgente, regraDoImpresso, propostaDoImpresso } from '../server/impressoes.js';

// Paulo, 19/11/2026: "impresso: quem vai ditar as regras é o Nestor (já falei que os bots que organizam e tomam conta dos
// setores)". Impresso sem responsável não cai mais na regra geral de Design & Edição: fica aguardando o Nestor, que propõe
// responsável, prazo e gráfica pelas regras de Impressos (dos donos) e aplica pelo caminho dos agentes.
const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins', monday_user_id: '68035537' } };
const ana = { tipo: 'sessao', pessoa: { id: 2, nome: 'Ana', admin: false } };
const chamar = async (sql, quem, body) => { const r = resposta(); await areaImpressoes({ method: body ? 'POST' : 'GET', body, query: {} }, r, quem, sql); return r; };

async function banco(t, { regras = true } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean, pode_entrar boolean, monday_user_id text, admin boolean DEFAULT false);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false, apagado_em timestamptz);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, board_id bigint, titulo text, formato text, status_chave text, prazo date, removido_em timestamptz,
      status_em timestamptz, criado_em timestamptz, briefing text, veiculacao date, atualizado_em timestamptz);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint, ordem int, PRIMARY KEY (conteudo_id, pessoa_id));
    CREATE TABLE vybe_conteudo_eventos (id bigserial PRIMARY KEY, conteudo_id bigint, tipo text, de text, para text, autor_id bigint, texto text, em timestamptz DEFAULT now());
    CREATE TABLE vybe_projetos (id bigserial PRIMARY KEY, nome text, cliente_id bigint, inicio date DEFAULT now(), status text DEFAULT 'planejado');
    CREATE TABLE vybe_comercial_fornecedores (id bigserial PRIMARY KEY, nome text, categoria text, ativo boolean DEFAULT true, contato text DEFAULT '', observacoes text DEFAULT '', criado_por bigint);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins',true,true,'68035537'),(2,'Ana',true,true,NULL),(4,'Danilo Souza',true,true,NULL),(5,'Vybes',true,true,NULL);
    INSERT INTO vybe_clientes (id, nome) VALUES (27,'VOA');
    INSERT INTO vybe_status VALUES (8385559107,'nova_demanda','Nova Demanda',false),(8385559107,'feito','Feito',true);
    INSERT INTO vybe_conteudos (id, board_id, titulo, formato, status_chave, prazo, briefing, veiculacao) VALUES
      (600,8385559107,'Impresso - Adesivo da vitrine','Impresso','nova_demanda',NULL,'arte simples, só o logo','2026-11-30'),
      (601,8385559107,'Impresso - Banner da feira','Impresso','nova_demanda','2026-11-25',NULL,NULL),
      (602,8385559107,'Impresso - Cardápio','Impresso','nova_demanda',NULL,NULL,NULL),
      (603,8385559107,'Impresso - Antigo','Impresso','feito',NULL,NULL,NULL),
      (604,8385559107,'Card - Promoção','Card','nova_demanda',NULL,NULL,NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (600,27),(601,27),(602,27),(603,27),(604,27);
    INSERT INTO vybe_conteudo_responsaveis VALUES (602,2,0);
    INSERT INTO vybe_comercial_fornecedores (id, nome, categoria) VALUES (70,'Gráfica Irecê','grafica');`);
  const migs = ['2026-11-09-impressoes.sql', '2026-11-09-impressoes-fornecedores.sql', ...(regras ? ['2026-11-19-impressao-regras.sql'] : [])];
  for (const arq of migs) { const m = readFileSync('migrations/' + arq, 'utf8'); await db.exec(m); await db.exec(m); }
  return { db, sql };
}

test('qual regra vale: a palavra casa por inteiro, sem acento; sem palavra, a padrão; nada, null', () => {
  const regras = [
    { id: '1', nome: 'Arte simples', palavras: ['arte simples', 'adesivo'], ativa: true, responsavel_nome: 'Danilo Souza', prazo_dias: 3 },
    { id: '2', nome: 'Desligada', palavras: ['banner'], ativa: false },
    { id: '3', nome: 'Padrão', palavras: [], ativa: true, responsavel_nome: 'Ana' },
  ];
  assert.equal(regraDoImpresso(regras, { titulo: 'Impresso - ADESIVO de vitrine' }).id, '1');
  assert.equal(regraDoImpresso(regras, { titulo: 'Tag', briefing: 'Arte Simples, só o logo' }).id, '1');
  assert.equal(regraDoImpresso(regras, { titulo: 'Adesivos' }).id, '3', 'palavra inteira: adesivos não é adesivo');
  assert.equal(regraDoImpresso(regras, { titulo: 'Banner' }).id, '3', 'regra desligada não vale');
  assert.equal(regraDoImpresso(regras.slice(0, 2), { titulo: 'Banner' }), null);
  const p = propostaDoImpresso({ veiculacao: '2026-11-20' }, regras[0], '2026-11-19');
  assert.deepEqual([p.responsavel, p.prazo, p.regra], ['Danilo Souza', '2026-11-20', 'Arte simples'], 'prazo de 3 dias não passa da veiculação');
  assert.equal(propostaDoImpresso({ prazo: '2026-12-01' }, regras[0], '2026-11-19').prazo, null, 'peça com prazo fica com o dela');
});

test('aguardando o Nestor: Impresso aberto e sem responsável, com a proposta da regra; regras são dos donos', async (t) => {
  const { sql } = await banco(t);
  let r = await chamar(sql, ana);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.aguardando.map((p) => p.conteudo_id), ['601', '600'], 'sem o que tem responsável, o fechado e o Card');
  assert.equal(r.body.aguardando[0].proposta, null, 'sem regra, o Nestor não inventa');
  assert.equal(r.body.regras_ligadas, true);
  r = await chamar(sql, ana, { acao: 'regra_salvar', nome: 'Arte simples', palavras: 'adesivo, arte simples', responsavel: '4', prazo_dias: 3 });
  assert.equal(r.codigo, 403, 'só os donos mexem nas regras');
  r = await chamar(sql, paulo, { acao: 'regra_salvar', nome: 'Vazia' }); assert.equal(r.codigo, 400, 'regra sem quem, prazo nem gráfica');
  r = await chamar(sql, paulo, { acao: 'regra_salvar', nome: 'Arte simples', palavras: 'adesivo, arte simples', responsavel: '4', prazo_dias: 3, fornecedor_id: '70', ordem: 10 });
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  const id = r.body.id;
  r = await chamar(sql, paulo);
  const adesivo = r.body.aguardando.find((p) => p.conteudo_id === '600');
  assert.deepEqual([adesivo.proposta.regra, adesivo.proposta.responsavel, adesivo.proposta.fornecedor, adesivo.proposta.prazo_dias], ['Arte simples', 'Danilo Souza', 'Gráfica Irecê', 3]);
  assert.equal(r.body.aguardando.find((p) => p.conteudo_id === '601').proposta, null, 'banner não casa com a regra');
  const agente = await impressoesParaAgente(sql);
  assert.deepEqual(agente.regras.map((x) => [x.nome, x.responsavel, x.fornecedor]), [['Arte simples', 'Danilo Souza', 'Gráfica Irecê']]);
  assert.deepEqual(agente.aguardando.map((p) => p.conteudo_id), ['601', '600']);
  r = await chamar(sql, paulo, { acao: 'regra_salvar', id, nome: 'Arte simples', palavras: ['adesivo'], responsavel: '4', prazo_dias: 2, ativa: false });
  assert.equal(r.codigo, 200);
  assert.equal((await impressoesParaAgente(sql)).regras.length, 0, 'desligada sai da lista do Nestor');
  r = await chamar(sql, paulo, { acao: 'regra_remover', id }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, { acao: 'regra_remover', id }); assert.equal(r.codigo, 404);
});

test('sem a migração aplicada: a tela abre, sem regras, e gravar regra diz o que falta', async (t) => {
  const { sql } = await banco(t, { regras: false });
  let r = await chamar(sql, paulo);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.regras_ligadas, r.body.regras.length, r.body.aguardando.length], [false, 0, 2]);
  r = await chamar(sql, paulo, { acao: 'regra_salvar', nome: 'X', responsavel: '4' });
  assert.equal(r.codigo, 503); assert.match(r.body.error, /2026-11-19-impressao-regras\.sql/);
});

test('o Nestor aplica: responsável, prazo vazio e gráfica da impressão; nunca passa por cima de quem já definiu', async (t) => {
  const { sql } = await banco(t);
  // A migração de 09/11 já trouxe a impressão dessa arte das Solicitações (etapa Arte, sem gráfica nem responsável).
  const [imp] = await sql`SELECT id::text AS id FROM vybe_impressoes WHERE conteudo_id = 600`;
  const r = await definirPeloAgente(sql, 5, { conteudo_id: '600', responsavel: 'danilo', prazo: '2026-11-22', fornecedor: 'grafica irece', regra: 'Arte simples' });
  assert.deepEqual([r.responsavel, r.prazo, r.fornecedor, r.mudou], ['Danilo Souza', '2026-11-22', 'Gráfica Irecê', ['responsavel', 'prazo', 'fornecedor']]);
  const [c] = await sql`SELECT prazo::text AS prazo FROM vybe_conteudos WHERE id = 600`; assert.equal(c.prazo, '2026-11-22');
  const evs = await sql`SELECT tipo, de, para, autor_id::text AS autor, texto FROM vybe_conteudo_eventos WHERE conteudo_id = 600 ORDER BY id`;
  assert.deepEqual(evs.map((e) => [e.tipo, e.de, e.para, e.autor]), [['responsavel', 'aguardando o Nestor', 'Danilo Souza', '5'], ['prazo', null, '2026-11-22', '5']]);
  assert.equal(evs[0].texto, 'Nestor, pela regra “Arte simples”');
  const [i] = await sql`SELECT responsavel::text AS resp, fornecedor_id::text AS forn FROM vybe_impressoes WHERE id = ${imp.id}`;
  assert.deepEqual([i.resp, i.forn], ['4', '70']);
  const [ev] = await sql`SELECT nota FROM vybe_impressao_eventos WHERE impressao_id = ${imp.id} ORDER BY id DESC LIMIT 1`;
  assert.equal(ev.nota, 'Nestor, pela regra “Arte simples”: arte com Danilo Souza, gráfica Gráfica Irecê');
  assert.equal((await impressoesParaAgente(sql)).aguardando.some((p) => p.conteudo_id === '600'), false, 'com dono, sai do aguardando');
  await assert.rejects(definirPeloAgente(sql, 5, { conteudo_id: '600', responsavel: 'Ana' }), /já tem responsável/);
  await assert.rejects(definirPeloAgente(sql, 5, { conteudo_id: '604', responsavel: 'Ana' }), /não é Impresso/);
  await assert.rejects(definirPeloAgente(sql, 5, { conteudo_id: '601', responsavel: 'Fulano' }), /não está ativo/);
  await assert.rejects(definirPeloAgente(sql, 5, { conteudo_id: '601', responsavel: 'Ana', fornecedor: 'Gráfica X' }), /não está cadastrada/);
  const b = await definirPeloAgente(sql, 5, { conteudo_id: '601', responsavel: 'Ana', prazo: '2026-11-21' });
  assert.deepEqual([b.prazo, b.mudou], ['2026-11-25', ['responsavel']], 'peça com prazo fica com o dela');
});

test('cadastro: Impresso não cai em Design & Edição; sem ninguém somado, fica aguardando o Nestor', () => {
  const perfis = readFileSync('vybe-perfis.js', 'utf8');
  const c = { EQUIPES: { design: ['d1', 'd2', 'd3'], audiovisual: ['a1'], motion: ['m1'] } };
  vm.createContext(c);
  vm.runInContext(perfis.slice(perfis.indexOf('function cadastrosDestiny'), perfis.indexOf('// A lista sai de DADOS_ALL')), c);
  for (const pronto of [true, false]) {
    const d = c.cadastrosDestiny('Impresso', pronto, false, []);
    assert.deepEqual([[...d.assignees], d.aguardando, d.status], [[], 'Nestor', 'Nova Demanda']);
  }
  assert.deepEqual([...c.cadastrosDestiny('Impresso', true, false, ['x9']).assignees], ['x9'], 'quem a pessoa somou continua');
  assert.deepEqual([...c.cadastrosDestiny('Card', true, false, []).assignees], ['d1', 'd2', 'd3'], 'os outros formatos seguem a regra de sempre');
});

test('criação no servidor deixa escrito no histórico que o impresso aguarda o Nestor', () => {
  const fonte = readFileSync('api/conteudo.js', 'utf8');
  assert.match(fonte, /if \(!responsaveis\.length && \/impresso\/i\.test\(String\(formato \|\| ''\)\) && dados\.aguarda_nestor !== false\)/);
  assert.match(fonte, /texto: 'Impresso aguarda o Nestor'/);
  assert.match(readFileSync('server/impressoes.js', 'utf8'), /aguarda_nestor: !d\.responsavel/);
});
