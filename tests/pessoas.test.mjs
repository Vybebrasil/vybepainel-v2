// Setor de Pessoas (server/pessoas.js). SAFE: banco PGlite em memória, nada sai daqui.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { areaSetorPessoas, ehGestao, hojeBahia } from '../server/pessoas.js';
import calc from '../shared/pessoas-calculos.js';
import handler from '../api/painel.js';

const resposta = () => ({ codigo: 0, body: null, setHeader() {}, status(n) { this.codigo = n; return this; }, json(d) { this.body = d; return this; } });
const paulo = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins', admin: false } };
const ana = { tipo: 'sessao', pessoa: { id: 2, nome: 'Ana Criação', admin: false } };
const bruno = { tipo: 'sessao', pessoa: { id: 3, nome: 'Bruno Vídeo', admin: false } };
const carla = { tipo: 'sessao', pessoa: { id: 4, nome: 'Carla Atendimento', admin: false } };
const admin = { tipo: 'sessao', pessoa: { id: 5, nome: 'Operador', admin: true } };
const hoje = hojeBahia(), dia = (n) => calc.util.somarDias(hoje, n);

async function banco(t, { migrar = true } = {}) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean, pode_entrar boolean, admin boolean DEFAULT false);
    CREATE TABLE vybe_escritorio_funcoes (pessoa_id bigint PRIMARY KEY, funcao text);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, final boolean, PRIMARY KEY (board_id, chave));
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, board_id bigint, status_chave text, prazo date, veiculacao date, status_em timestamptz, removido_em timestamptz);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint, ordem int DEFAULT 0, PRIMARY KEY (conteudo_id, pessoa_id));
    CREATE TABLE vybe_conteudo_eventos (id bigserial PRIMARY KEY, conteudo_id bigint, tipo text, de text, para text, autor_id bigint, em timestamptz NOT NULL DEFAULT now());
    INSERT INTO vybe_pessoas VALUES (1,'Paulo Martins',true,true,false),(2,'Ana Criação',true,true,false),(3,'Bruno Vídeo',true,true,false),(4,'Carla Atendimento',true,true,false),(5,'Operador',true,true,true),(6,'Saiu',false,false,false);
    INSERT INTO vybe_escritorio_funcoes VALUES (2,'criacao'),(3,'producao');
    INSERT INTO vybe_status VALUES (1,'finalizado','Finalizado',true),(1,'em_andamento','Em andamento',false),(1,'segurar_post','Segurar Post',false);`);
  if (migrar) { const m = readFileSync('migrations/2026-11-07-pessoas.sql', 'utf8'); await db.exec(m); await db.exec(m); }
  return { db, sql };
}
async function chamar(sql, quem, { body = null, query = {} } = {}) {
  const r = resposta(); await areaSetorPessoas({ method: body ? 'POST' : 'GET', body, query }, r, quem, sql); return r;
}

test('gestão = admin ou um dos quatro donos pelo primeiro nome', () => {
  for (const nome of ['Paulo Martins', 'Vinícius Damascena', 'Ewerton L.', 'Deivid']) assert.equal(ehGestao({ nome }), true, nome);
  assert.equal(ehGestao({ nome: 'Ana' }), false);
  assert.equal(ehGestao({ nome: 'Ana', admin: true }), true);
});

test('rota exige sessão pessoal: 401 sem login, 403 para serviço', async () => {
  const r = resposta(); await handler({ method: 'GET', headers: {}, query: { area: 'setor_pessoas' } }, r); assert.equal(r.codigo, 401);
  const s = resposta(); await areaSetorPessoas({ method: 'GET', query: {} }, s, { tipo: 'servico' }, () => { throw Error('não deve ler'); }); assert.equal(s.codigo, 403);
});

test('produtividade: cada um vê só o seu; ranking, pesos e metas só da gestão (e gravação também)', async (t) => {
  const { db, sql } = await banco(t);
  // Ana: 3 entregues hoje (2 no prazo, 1 depois da veiculação), 1 voltou para ajuste, 1 aberta atrasada.
  await db.exec(`INSERT INTO vybe_conteudos VALUES
    (1,1,'finalizado','${dia(2)}','${dia(2)}',now(),NULL),(2,1,'finalizado',NULL,'${dia(1)}',now(),NULL),(3,1,'finalizado',NULL,'${dia(-1)}',now(),NULL),
    (4,1,'em_andamento','${dia(-1)}',NULL,NULL,NULL),(5,1,'segurar_post','${dia(-1)}',NULL,NULL,NULL),(6,1,'finalizado',NULL,'${dia(5)}',now(),now()),
    (7,1,'finalizado',NULL,'${dia(3)}',now(),NULL);
    INSERT INTO vybe_conteudo_responsaveis VALUES (1,2,0),(2,2,0),(3,2,0),(4,2,0),(5,2,0),(6,2,0),(7,3,0);
    INSERT INTO vybe_conteudo_eventos (conteudo_id,tipo,para) VALUES (2,'status','Alteração');`);
  let r = await chamar(sql, ana);
  assert.equal(r.codigo, 200, JSON.stringify(r.body));
  assert.equal(r.body.gestao, false); assert.equal(r.body.ranking, undefined); assert.equal(r.body.pesos, undefined);
  const d = r.body.detalhe;
  assert.equal(d.id, '2'); assert.equal(d.entregues, 3); assert.equal(d.comData, 3); assert.equal(d.noPrazo, 2); assert.equal(d.ajustes, 1);
  // A atrasada só conta se a data é deste mês (no 1º dia do mês, ontem é do mês anterior).
  assert.equal(d.atrasadas, dia(-1).slice(0, 7) === hoje.slice(0, 7) ? 1 : 0);
  assert.equal(d.posicao, null, 'sem posição para quem não é da gestão');
  assert.ok(d.score >= 0 && d.score <= 100);
  r = await chamar(sql, ana, { query: { pessoa: '3' } }); assert.equal(r.codigo, 403);
  r = await chamar(sql, ana, { body: { acao: 'pesos', pesos: { prazo: 100, volume: 0, ajustes: 0, atrasos: 0 } } }); assert.equal(r.codigo, 403);
  r = await chamar(sql, paulo);
  assert.equal(r.body.gestao, true); assert.equal(r.body.ranking.length, 5); assert.deepEqual(r.body.pesos, calc.PESOS_PADRAO);
  r = await chamar(sql, paulo, { query: { pessoa: '3' } }); assert.equal(r.body.detalhe.nome, 'Bruno Vídeo');
  r = await chamar(sql, paulo, { body: { acao: 'pesos', pesos: { prazo: 100, volume: 0, ajustes: 0, atrasos: 0 } } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, { body: { acao: 'pesos', pesos: { prazo: 0, volume: 0, ajustes: 0, atrasos: 0 } } }); assert.equal(r.codigo, 400);
  r = await chamar(sql, ana); assert.equal(r.body.detalhe.score, 67, 'só o prazo pesa: 2 de 3');
  r = await chamar(sql, admin, { body: { acao: 'metas', metas: { ...calc.METAS_PADRAO, criacao: 3 } } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, admin); assert.equal(r.body.metas.criacao, 3);
  r = await chamar(sql, ana, { query: { mes: '2999-01' } }); assert.equal(r.codigo, 400);
});

test('sem a migração: leituras vazias com provisionado=false; gravação responde 503', async (t) => {
  const { sql } = await banco(t, { migrar: false });
  for (const aba of ['produtividade', 'rh', 'projetos', 'academy']) {
    const r = await chamar(sql, ana, { query: { aba } }); assert.equal(r.codigo, 200, aba + JSON.stringify(r.body)); assert.equal(r.body.provisionado, false, aba);
  }
  const a = await chamar(sql, ana, { query: { aba: 'academy' } }); assert.equal(a.body.modelo.nome, 'Primeira semana na Vybe');
  const r = await chamar(sql, ana, { body: { acao: 'pedido_criar', tipo: 'documento', titulo: 'Declaração' } }); assert.equal(r.codigo, 503);
});

test('RH: pedidos com SLA, só a gestão responde; dono do pedido só cancela', async (t) => {
  const { sql } = await banco(t);
  let r = await chamar(sql, ana, { body: { acao: 'pedido_criar', tipo: 'documento', titulo: 'Declaração de vínculo' } });
  assert.equal(r.codigo, 200); assert.equal(r.body.prazo, calc.prazoSla('documento', hoje)); const id = r.body.id;
  r = await chamar(sql, ana, { body: { acao: 'pedido_criar', tipo: 'ferias', titulo: 'Férias' } }); assert.equal(r.codigo, 400, 'férias sem datas');
  r = await chamar(sql, bruno, { body: { acao: 'pedido_criar', tipo: 'ferias', titulo: 'Férias de dezembro', inicio: dia(10), fim: dia(20) } }); const ferias = r.body.id;
  r = await chamar(sql, bruno, { query: { aba: 'rh' } }); assert.equal(r.body.pedidos.length, 1, 'cada um vê só os seus'); assert.equal(r.body.visao, undefined);
  r = await chamar(sql, ana, { body: { acao: 'pedido_status', id, status: 'resolvido' } }); assert.equal(r.codigo, 403);
  r = await chamar(sql, bruno, { body: { acao: 'pedido_status', id, status: 'cancelado' } }); assert.equal(r.codigo, 403, 'pedido de outra pessoa');
  r = await chamar(sql, ana, { body: { acao: 'pedido_status', id, status: 'cancelado' } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, { body: { acao: 'pedido_status', id: ferias, status: 'resolvido', resposta: 'Aprovadas.' } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, ana, { query: { aba: 'rh' } }); assert.equal(r.body.ferias.length, 1, 'férias aprovadas aparecem para todos');
  r = await chamar(sql, ana, { body: { acao: 'perfil', nascimento: '1995-03-14' } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, ana, { body: { acao: 'perfil', pessoa_id: '3', nascimento: '1990-01-01' } }); assert.equal(r.codigo, 403);
  r = await chamar(sql, ana, { query: { aba: 'rh' } }); assert.deepEqual(r.body.aniversarios.map((a) => a.dia), ['03-14'], 'só dia e mês');
  // Visão geral: entrada da Ana há um ano; admissão do Bruno neste período.
  await chamar(sql, paulo, { body: { acao: 'perfil', pessoa_id: '2', nascimento: '1995-03-14', entrada: calc.util.somarDias(hoje, -365) } });
  await chamar(sql, paulo, { body: { acao: 'perfil', pessoa_id: '3', entrada: hoje.slice(0, 8) + '01' } });
  r = await chamar(sql, paulo, { query: { aba: 'rh' } });
  assert.equal(r.body.visao.atual.admissoes, 1); assert.equal(r.body.visao.atual.headcount, 5); assert.equal(r.body.visao.antes.headcount, 4);
  assert.equal(r.body.pedidos.length, 2);
});

test('clima: uma resposta por trimestre, anônima, e resultado só com 3 respostas e só para a gestão', async (t) => {
  const { db, sql } = await banco(t);
  const voto = { acao: 'clima_responder', enps: 9, lideranca: 4, ambiente: 5, crescimento: 3, processos: 4, beneficios: 2, comentario: 'Bom lugar' };
  let r = await chamar(sql, ana, { body: voto }); assert.equal(r.codigo, 200);
  r = await chamar(sql, ana, { body: voto }); assert.equal(r.codigo, 409);
  r = await chamar(sql, ana, { body: { ...voto, enps: 11 } }); assert.equal(r.codigo, 400);
  const colunas = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='vybe_clima_respostas'`)).rows.map((c) => c.column_name);
  assert.ok(!colunas.some((c) => /pessoa|em$|criado/.test(c)), 'a resposta não guarda pessoa nem hora: ' + colunas);
  await chamar(sql, bruno, { body: { ...voto, enps: 3, comentario: '' } });
  r = await chamar(sql, paulo, { query: { aba: 'rh' } }); assert.equal(r.body.climaResultado.liberado, false); assert.equal(r.body.climaResultado.enps, undefined);
  await chamar(sql, carla, { body: { ...voto, enps: 7 } });
  r = await chamar(sql, ana, { query: { aba: 'rh' } }); assert.equal(r.body.climaResultado, undefined, 'resultado é da gestão'); assert.equal(r.body.clima.respondeu, true);
  r = await chamar(sql, paulo, { query: { aba: 'rh' } });
  assert.equal(r.body.climaResultado.liberado, true); assert.equal(r.body.climaResultado.respostas, 3); assert.equal(r.body.climaResultado.enps, 0);
  assert.equal(r.body.climaResultado.comentarios.length, 2);
});

test('projetos: só a gestão cria; responsável marca a etapa; carga soma peças e etapas', async (t) => {
  const { db, sql } = await banco(t);
  const semana = calc.util.inicioDaSemana(hoje);
  await db.exec(`INSERT INTO vybe_conteudos VALUES (10,1,'em_andamento','${semana}',NULL,NULL,NULL),(11,1,'em_andamento','${calc.util.somarDias(semana, 2)}',NULL,NULL,NULL);
    INSERT INTO vybe_conteudo_responsaveis VALUES (10,3,0),(11,3,0);`);
  const projeto = { acao: 'projeto_salvar', nome: 'Lançamento do site', tipo: 'site', inicio: semana, fim: calc.util.somarDias(semana, 20),
    etapas: [{ nome: 'Wireframe', responsavel: '3', inicio: semana, fim: calc.util.somarDias(semana, 3), esforco: 3 }, { nome: 'Textos', responsavel: '2', inicio: calc.util.somarDias(semana, 7), fim: calc.util.somarDias(semana, 10) }] };
  let r = await chamar(sql, ana, { body: projeto }); assert.equal(r.codigo, 403);
  r = await chamar(sql, paulo, { body: projeto }); assert.equal(r.codigo, 200, JSON.stringify(r.body)); const pid = r.body.id;
  r = await chamar(sql, paulo, { body: { ...projeto, etapas: [{ nome: 'X', inicio: semana, fim: calc.util.somarDias(semana, -1) }] } }); assert.equal(r.codigo, 400);
  r = await chamar(sql, ana, { query: { aba: 'projetos' } });
  assert.equal(r.body.projetos.length, 1); const [wire, textos] = r.body.projetos[0].etapas;
  const cargaBruno = r.body.carga.find((c) => c.id === '3'); assert.equal(cargaBruno.pecas, 2); assert.equal(cargaBruno.etapas, 3); assert.equal(cargaBruno.total, 5);
  assert.ok(r.body.linha.projetos[0].pos.larg > 0);
  r = await chamar(sql, ana, { body: { acao: 'etapa_feita', id: wire.id, feita: true } }); assert.equal(r.codigo, 403, 'etapa de outra pessoa');
  r = await chamar(sql, ana, { body: { acao: 'etapa_feita', id: textos.id, feita: true } }); assert.equal(r.codigo, 200);
  // Editar mantendo uma etapa pelo id e removendo a outra.
  r = await chamar(sql, paulo, { body: { ...projeto, id: pid, etapas: [{ ...textos, feita: true }] } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, ana, { query: { aba: 'projetos' } }); assert.deepEqual(r.body.projetos[0].etapas.map((e) => [e.id, e.feita]), [[textos.id, true]]);
});

test('academy: trilha semeada, gestão atribui, cada um marca as próprias aulas', async (t) => {
  const { sql } = await banco(t);
  let r = await chamar(sql, ana, { query: { aba: 'academy' } });
  assert.equal(r.body.trilhas.length, 1, 'a migração semeia uma vez só'); const trilha = r.body.trilhas[0];
  assert.equal(trilha.nome, 'Primeira semana na Vybe'); assert.equal(trilha.aulas.length, 6);
  r = await chamar(sql, ana, { body: { acao: 'trilha_atribuir', trilha_id: trilha.id, pessoa_id: '2' } }); assert.equal(r.codigo, 403);
  r = await chamar(sql, paulo, { body: { acao: 'trilha_atribuir', trilha_id: trilha.id, pessoa_id: '2', prazo: dia(7) } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, ana, { body: { acao: 'aula_feita', aula_id: trilha.aulas[0].id } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, ana, { query: { aba: 'academy' } }); assert.equal(r.body.trilhas[0].minha, true); assert.equal(r.body.trilhas[0].progresso.concluidas, 1);
  r = await chamar(sql, paulo, { query: { aba: 'academy' } }); assert.equal(r.body.trilhas[0].atribuidas[0].progresso.pct, 17);
  const aulas = trilha.aulas.map((a) => ({ ...a, link: a.id === trilha.aulas[0].id ? 'https://drive.google.com/x' : '' }));
  r = await chamar(sql, paulo, { body: { acao: 'trilha_salvar', id: trilha.id, nome: trilha.nome, aulas } }); assert.equal(r.codigo, 200, JSON.stringify(r.body));
  r = await chamar(sql, paulo, { body: { acao: 'trilha_salvar', id: trilha.id, nome: trilha.nome, aulas: [{ titulo: 'x', link: 'javascript:alert(1)' }] } }); assert.equal(r.codigo, 400);
  r = await chamar(sql, ana, { query: { aba: 'academy' } }); assert.equal(r.body.trilhas[0].progresso.concluidas, 1, 'editar mantém o progresso');
});

test('recrutamento e documentos: só gestão; tempo de contratação e aviso de renovação', async (t) => {
  const { sql } = await banco(t);
  for (const aba of ['recrutamento', 'documentos']) { const r = await chamar(sql, ana, { query: { aba } }); assert.equal(r.codigo, 403, aba); }
  let r = await chamar(sql, ana, { body: { acao: 'vaga_salvar', titulo: 'Designer' } }); assert.equal(r.codigo, 403);
  r = await chamar(sql, paulo, { body: { acao: 'vaga_salvar', titulo: 'Designer', cargo: 'Criação' } }); const vaga = r.body.id;
  r = await chamar(sql, paulo, { body: { acao: 'candidato_salvar', vaga_id: vaga, nome: 'Fulana', etapa: 'Novos' } }); const cand = r.body.id;
  r = await chamar(sql, paulo, { body: { acao: 'candidato_mover', id: cand, etapa: 'Inexistente' } }); assert.equal(r.codigo, 400);
  r = await chamar(sql, paulo, { body: { acao: 'candidato_mover', id: cand, etapa: 'Aprovado' } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, { query: { aba: 'recrutamento' } });
  assert.equal(r.body.candidatos[0].contratado_em, hoje); assert.equal(r.body.indicadores.tempoMedio.dias, 0); assert.equal(r.body.indicadores.abertas, 1);
  r = await chamar(sql, paulo, { body: { acao: 'etapas_recrutamento', etapas: ['Triagem', 'Teste', 'Contratado', 'Não seguiu'] } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, { query: { aba: 'recrutamento' } }); assert.deepEqual(r.body.etapas, ['Triagem', 'Teste', 'Contratado', 'Não seguiu']);
  r = await chamar(sql, paulo, { body: { acao: 'documento_salvar', pessoa_id: '2', tipo: 'contrato', titulo: 'Contrato PJ', inicio: dia(-300), renovacao: dia(10) } }); assert.equal(r.codigo, 200);
  r = await chamar(sql, paulo, { body: { acao: 'documento_salvar', pessoa_id: '2', tipo: 'contrato', titulo: 'x', link: 'http://inseguro' } }); assert.equal(r.codigo, 400);
  r = await chamar(sql, admin, { query: { aba: 'documentos' } }); assert.equal(r.body.avisos, 1); assert.equal(r.body.documentos[0].situacao, 'renovar');
});
