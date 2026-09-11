// Por que uma regra não pegou uma peça.
//
// "Não aconteceu nada" era a mesma resposta para três problemas diferentes:
// nenhuma regra se aplica, a regra está desligada, a regra nem existe. Estes
// testes cobrem a parte que transforma silêncio em motivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { condicaoQueBarra, desencontroDoGatilho } from '../vybe_automacoes.js';

const PRODUCAO = 'novo_grupo57911__1';
const DESIGN = 'novo_grupo__1';
const foto = {
  formato_chaves: ['fotografia'], grupo_id: PRODUCAO,
  captacao_chave: 'captacao_feita', status_chave: 'pode_fazer', board_id: 7829537690,
};

test('condição atendida não barra nada', () => {
  assert.equal(condicaoQueBarra(null, foto), null);
  assert.equal(condicaoQueBarra({ formato_em: ['fotografia'], grupo_em: [PRODUCAO] }, foto), null);
});

test('a recusa diz qual campo barrou, o que pedia e o que a peça tem', () => {
  const porFormato = condicaoQueBarra({ formato_em: ['reels'] }, foto);
  assert.equal(porFormato.campo, 'formato');
  assert.equal(porFormato.modo, 'um_de');
  assert.deepEqual(porFormato.exigido, ['reels']);
  assert.deepEqual(porFormato.tem, ['fotografia']);

  // O caso real: a peça já tinha saído de Produção, e por isso a regra não pegou.
  const porGrupo = condicaoQueBarra({ formato_em: ['fotografia'], grupo_em: [PRODUCAO] },
    { ...foto, grupo_id: DESIGN });
  assert.equal(porGrupo.campo, 'grupo');
  assert.deepEqual(porGrupo.tem, [DESIGN]);

  const porCaptacao = condicaoQueBarra({ captacao_em: ['captacao_feita'] },
    { ...foto, captacao_chave: 'captacao_agendada' });
  // Campo é chave, não rótulo: 'captacao', e quem escreve "captação" com til é a
  // tela, que tem a lista de nomes.
  assert.equal(porCaptacao.campo, 'captacao');
  assert.deepEqual(porCaptacao.tem, ['captacao_agendada']);

  // Número vira texto: o quadro é 7829537690 e a comparação na tela é de string.
  const porQuadro = condicaoQueBarra({ board_em: [8385559107] }, foto);
  assert.equal(porQuadro.campo, 'quadro');
  assert.deepEqual(porQuadro.exigido, ['8385559107']);
  assert.deepEqual(porQuadro.tem, ['7829537690']);
});

test('a primeira condição que barra é a que explica', () => {
  // Peça errada no formato E no grupo: a resposta aponta o formato, que é a
  // primeira lida. Dizer as duas seria correto e inútil — quem lê quer um passo.
  const r = condicaoQueBarra({ formato_em: ['reels'], grupo_em: [DESIGN] }, foto);
  assert.equal(r.campo, 'formato');
});

test('condição de exclusão explica que a peça está na lista proibida', () => {
  const r = condicaoQueBarra({ formato_nao_em: ['fotografia', 'reels'] }, foto);
  assert.equal(r.campo, 'formato');
  // 'nenhum_de' é o que vira "qualquer um menos …" na tela. O servidor devolve o
  // fato; a frase é escrita uma vez só, onde os nomes das etiquetas existem.
  assert.equal(r.modo, 'nenhum_de');
  assert.deepEqual(r.exigido, ['fotografia', 'reels']);
  assert.deepEqual(r.tem, ['fotografia']);

  const s = condicaoQueBarra({ status_nao_em: ['pode_fazer'] }, foto);
  assert.equal(s.campo, 'status');
  assert.equal(s.modo, 'nenhum_de');
});

test('peça sem o campo não passa por acidente', () => {
  // Campo vazio já respondeu "—" e deixou passar em outras partes do painel.
  const semFormato = condicaoQueBarra({ formato_em: ['fotografia'] }, { ...foto, formato_chaves: [] });
  assert.equal(semFormato.campo, 'formato');
  assert.deepEqual(semFormato.tem, []);

  const semGrupo = condicaoQueBarra({ grupo_em: [PRODUCAO] }, { ...foto, grupo_id: null });
  assert.equal(semGrupo.campo, 'grupo');
  // Lista vazia, e não o traço: "—" é coisa de tela, e um campo vazio que chega
  // como texto já passou por condição em outras partes do painel.
  assert.deepEqual(semGrupo.tem, []);
});

// ── o gatilho: a regra nem é sobre esta mudança ───────────────────────────────

test('gatilho que bate não tem desencontro', () => {
  const g = { tipo: 'captacao', para: 'captacao_feita' };
  assert.equal(desencontroDoGatilho(g, { tipo: 'captacao', para: 'captacao_feita' }), null);
  // Gatilho sem 'de' aceita vir de qualquer lugar — é como as regras 38 e 39
  // estão escritas, e exigir 'de' ali pararia o roteamento de captação.
  assert.equal(desencontroDoGatilho(g, { tipo: 'captacao', de: 'qualquer', para: 'captacao_feita' }), null);
});

test('regra de outro assunto se separa da que escuta outra etiqueta', () => {
  // As duas não aparecem juntas no diagnóstico: a primeira são as quarenta
  // regras que não têm nada a ver com o que a pessoa mexeu; a segunda é a
  // resposta mais comum para "mudei e não aconteceu nada".
  const outro = desencontroDoGatilho({ tipo: 'status', para: 'finalizado' },
    { tipo: 'captacao', para: 'captacao_feita' });
  assert.equal(outro.outroAssunto, true);

  const perto = desencontroDoGatilho({ tipo: 'captacao', para: 'captacao_agendada' },
    { tipo: 'captacao', para: 'captacao_feita' });
  assert.equal(perto.outroAssunto, undefined);
  assert.equal(perto.campo, 'para');
  assert.equal(perto.exigido, 'captacao_agendada');
  assert.equal(perto.tem, 'captacao_feita');
});

test('gatilho com origem exigida diz de onde a peça tinha que vir', () => {
  // É a regra 41, "Captação feita passa para o Reriston": ela só roda saindo de
  // "captação agendada". Quem marcou captação feita numa peça que estava em
  // outro ponto precisa ler isso, não silêncio.
  const r = desencontroDoGatilho({ tipo: 'captacao', de: 'captacao_agendada', para: 'captacao_feita' },
    { tipo: 'captacao', de: 'a_captar', para: 'captacao_feita' });
  assert.equal(r.campo, 'de');
  assert.equal(r.exigido, 'captacao_agendada');
  assert.equal(r.tem, 'a_captar');
});

test('gatilho de data compara o campo e a antecedência', () => {
  const g = { tipo: 'data', campo: 'veiculacao', dias: 1 };
  assert.equal(desencontroDoGatilho(g, { tipo: 'data', campo: 'veiculacao', dias: 1 }), null);
  assert.equal(desencontroDoGatilho(g, { tipo: 'data', campo: 'prazo', dias: 1 }).campo, 'data');
  assert.equal(desencontroDoGatilho(g, { tipo: 'data', campo: 'veiculacao', dias: 0 }).campo, 'dias');
  // Gatilho de data não olha 'de'/'para': uma data não "vem de" nada.
  assert.equal(desencontroDoGatilho({ tipo: 'data', campo: 'prazo', dias: -1 },
    { tipo: 'data', campo: 'prazo', dias: -1, para: 'nada a ver' }), null);
});

// ── o diagnóstico inteiro, contra um banco de verdade ─────────────────────────
//
// As duas partes acima são puras. Esta prova o que o painel vai mostrar: a peça
// existe, tem histórico, e a pergunta "por que não rodou?" tem que virar uma
// lista de motivos nomeados — incluindo a regra que está desligada e a que
// escuta outra etiqueta, que nenhuma tela sabia dizer.
import { conexao } from './postgres.mjs';
import { simular } from '../vybe_automacoes.js';

const PRODUCAO_BOARD = 7829537690;

async function bancoDoDiagnostico() {
  const { db, sql } = conexao();
  await db.exec(`
    CREATE TABLE vybe_conteudos (id int primary key, monday_item_id text, titulo text,
      board_id bigint, grupo_id text, status_chave text, captacao_chave text, formato_chaves text[]);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text);
    CREATE TABLE vybe_captacao (chave text primary key, rotulo text);
    CREATE TABLE vybe_conteudo_eventos (conteudo_id int, tipo text, de text, para text,
      em timestamptz DEFAULT NOW());
    CREATE TABLE vybe_automacoes (id int primary key, nome text, ativa boolean, ordem int,
      gatilho jsonb, condicao jsonb, acoes jsonb);
    INSERT INTO vybe_captacao VALUES ('a_captar','À captar'),('captacao_agendada','Captação agendada'),
      ('captacao_feita','Captação Feita');
    INSERT INTO vybe_status VALUES (${PRODUCAO_BOARD},'pode_fazer','Pode Fazer'),
      (${PRODUCAO_BOARD},'finalizado','Finalizado');
    INSERT INTO vybe_conteudos VALUES
      (7,'12863044303','Hebravet | Carrossel',${PRODUCAO_BOARD},'${DESIGN}','pode_fazer','captacao_feita',
       ARRAY['carrossel']);
  `);
  return sql;
}

const regra = (id, nome, ordem, gatilho, condicao, acoes, ativa = true) =>
  `(${id},'${nome}',${ativa},${ordem},'${JSON.stringify(gatilho)}','${
    condicao ? JSON.stringify(condicao) : null}','${JSON.stringify(acoes)}')`;

test('o diagnóstico lê a última mudança da peça e nomeia cada recusa', async () => {
  const sql = await bancoDoDiagnostico();
  // A mudança que a pessoa fez de verdade: "Captação agendada" → "Captação Feita".
  // O histórico grava chave no 'de' e ROTULO no 'para' — resolver os dois é o que
  // impede o diagnóstico de acusar a etiqueta certa de ser outra.
  await sql`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para)
    VALUES (7, 'captacao', 'captacao_agendada', 'Captação Feita')`;
  await sql([`INSERT INTO vybe_automacoes VALUES ${[
    regra(1, 'Foto captada vai para Design', 38, { tipo: 'captacao', para: 'captacao_feita' },
      { formato_em: ['fotografia'] }, [{ tipo: 'grupo', para: DESIGN }]),
    regra(2, 'Captação agendada fica com o Ademir', 40,
      { tipo: 'captacao', para: 'captacao_agendada' }, null, [{ tipo: 'status', para: 'cap_agendada' }]),
    regra(3, 'Captação feita passa para o Reriston', 41,
      { tipo: 'captacao', de: 'captacao_agendada', para: 'captacao_feita' },
      { formato_nao_em: ['fotografia', 'reels'] }, [{ tipo: 'grupo', para: DESIGN }]),
    regra(4, 'Regra desligada que escuta a mesma etiqueta', 42,
      { tipo: 'captacao', para: 'captacao_feita' }, null, [{ tipo: 'update', texto: 'oi' }], false),
    regra(5, 'Finalizado sai da fila', 99, { tipo: 'status', para: 'finalizado' }, null,
      [{ tipo: 'responsaveis', modo: 'replace', pessoas: [] }]),
  ].join(',')}`]);

  const r = await simular(sql, '12863044303', { tipo: 'captacao' });

  // A peça foi encontrada pelo id do Monday, que é o que a tela tem em mãos.
  assert.equal(r.item.titulo, 'Hebravet | Carrossel');
  assert.equal(r.evento.origem, 'histórico');
  assert.equal(r.evento.de, 'captacao_agendada');
  assert.equal(r.evento.para, 'captacao_feita');

  // Carrossel vindo de captação agendada: só a 41 se aplica.
  assert.deepEqual(r.dispararia.map((x) => x.nome), ['Captação feita passa para o Reriston']);

  const por = (nome) => r.descartadas.find((d) => d.nome === nome);
  // A regra de status não entra na lista: não é sobre esta mudança.
  assert.equal(por('Finalizado sai da fila'), undefined);
  // Cada recusa diz a sua própria razão, e são três razões diferentes.
  assert.equal(por('Foto captada vai para Design').motivo, 'condição');
  assert.equal(por('Foto captada vai para Design').campo, 'formato');
  assert.equal(por('Captação agendada fica com o Ademir').motivo, 'gatilho');
  assert.equal(por('Captação agendada fica com o Ademir').campo, 'para');
  assert.equal(por('Regra desligada que escuta a mesma etiqueta').motivo, 'desligada');
});

test('sem evento nosso no histórico, o diagnóstico responde pelo estado atual', async () => {
  const sql = await bancoDoDiagnostico();
  // Peça importada do Monday: está com a captação feita e nunca passou por aqui.
  await sql([`INSERT INTO vybe_automacoes VALUES ${regra(1, 'Vai para Design', 38,
    { tipo: 'captacao', para: 'captacao_feita' }, null, [{ tipo: 'grupo', para: DESIGN }])}`]);

  const r = await simular(sql, 'vybe:7', { tipo: 'captacao' });
  assert.equal(r.evento.origem, 'estado atual');
  assert.equal(r.evento.para, 'captacao_feita');
  assert.equal(r.evento.de, null);
  assert.deepEqual(r.dispararia.map((x) => x.nome), ['Vai para Design']);
});
