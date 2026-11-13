import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { validarPacote, proporPacote, pacotesParaAvisar, marcarAvisado, executarPacote, recusarPacote } from '../server/pacotes-producao.js';
import { executarFerramenta, FERRAMENTAS } from '../server/mcp-ecossistema.js';

// Pacote de produção (Paulo, 10/11/2026): o chat do Claude propõe, o VYBES avisa o grupo Produção, um dono dá o ok e as
// peças nascem em Produção ligadas ao roteiro, com a captação sugerida na agenda.
const segredo = 's'.repeat(40), PROD = 7829537690;
const agora = Date.parse('2026-11-10T15:00:00Z');
const DOC = 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit';
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas(id bigint PRIMARY KEY,nome text,email text,admin boolean,ativo boolean,pode_entrar boolean,monday_user_id bigint);
    INSERT INTO vybe_pessoas VALUES(1,'Paulo Martins','paulo@x',true,true,true,68035537),(2,'Jady Lima','jady@x',false,true,true,100482777);
    CREATE TABLE vybe_conteudos(id bigint PRIMARY KEY,monday_item_id bigint,titulo text,formato text,board_id bigint,status_chave text,removido_em timestamptz,veiculacao date);
    CREATE TABLE vybe_status(board_id bigint,chave text,rotulo text);
    CREATE TABLE vybe_clientes(id bigint PRIMARY KEY,nome text,apagado_em timestamptz,ativo boolean DEFAULT true,nao_e_cliente boolean DEFAULT false,cnpj text,segmento text,endereco text,email text,telefone text,plano text,valor numeric,cadastro jsonb);
    INSERT INTO vybe_clientes(id,nome) VALUES(8,'Antonov'),(9,'Hebravet');
    CREATE TABLE vybe_conteudo_clientes(conteudo_id bigint,cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis(conteudo_id bigint,pessoa_id bigint);
    CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint);
    CREATE TABLE vybe_escritorio_funcoes(pessoa_id bigint,funcao text);
    CREATE TABLE vybe_captacao(chave text,rotulo text,monday_index int);INSERT INTO vybe_captacao VALUES('agendar','Agendar Captação',1),('agendada','Captação Agendada',2);`);
  await db.exec(readFileSync(new URL('../migrations/2026-10-21-producao-roteiros.sql', import.meta.url), 'utf8'));
  return { db, sql };
}
const pacote = {
  titulo: 'Diária Tira-dúvidas (FAQ)', documento: DOC,
  pecas: [
    { titulo: 'FAQ 03 · Wellhub, TotalPass e diária', veiculacao: '2026-12-01', briefing: 'Perguntas 09 e 10.' },
    { titulo: 'FAQ 04 · Tour pela academia', formato: 'Reels', veiculacao: '2026-12-08', prazo: '2026-12-07', briefing: 'Perguntas 15, 16, 19 e 20.' },
  ],
  captacao: { dia: '2026-11-12', inicio: '08:00', fim: '12:00', local: 'Antonov' },
  recado: 'Confirmar o professor (com CREF) e os valores dos planos.',
};

test('o pacote é conferido antes de entrar: datas, peças, captação e link', () => {
  assert.throws(() => validarPacote({ ...pacote, pecas: [] }, { agora }), /de 1 a 20 peças/);
  assert.throws(() => validarPacote({ ...pacote, pecas: [{ titulo: 'FAQ', veiculacao: '2026-11-01' }] }, { agora }), /veiculação precisa ser/);
  assert.throws(() => validarPacote({ ...pacote, pecas: [{ titulo: 'FAQ 1', veiculacao: '2026-12-01', prazo: '2026-12-05' }] }, { agora }), /prazo precisa/);
  assert.throws(() => validarPacote({ ...pacote, captacao: { dia: '2026-11-12', inicio: '12:00', fim: '08:00' } }, { agora }), /início e fim/);
  assert.throws(() => validarPacote({ ...pacote, documento: 'javascript:alert(1)' }, { agora }), /link https/);
  const p = validarPacote(pacote, { agora });
  assert.equal(p.pecas[0].formato, 'Reels');
  assert.equal(p.captacao.inicio, '08:00');
});

test('chat propõe pelo conector, VYBES avisa uma vez, dono dá o ok: peças em Produção, roteiro ligado e captação na agenda', async () => {
  const { db, sql } = await banco();
  // O conector não recebe a data: o relógio fica no dia do pacote (10/11/2026) para a captação de 12/11 não virar passado.
  const relogio = Date.now; Date.now = () => agora;
  try {
    assert.ok(FERRAMENTAS.some((f) => f.name === 'propor_pacote_producao'));
    // Pelo conector do Claude (só registra; nada nasce em Produção).
    await assert.rejects(() => executarFerramenta(sql, 'propor_pacote_producao', { ...pacote, cliente: 'Antonov', pecas: [] }, { conta: 'gestao' }), (e) => e.deUso && /peças/.test(e.message));
    const msg = await executarFerramenta(sql, 'propor_pacote_producao', { ...pacote, cliente: 'antonov' }, { conta: 'gestao' });
    assert.match(msg, /Pacote de produção #1 registrado para Antonov: 2 peça\(s\), captação sugerida qui 12\/11 das 08:00 às 12:00\. Nada foi criado ainda/);
    assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_conteudos`)[0].n, 0);

    // O VYBES lê o que falta avisar e manda o texto pronto ao grupo Produção.
    const [p] = await pacotesParaAvisar(sql);
    assert.equal(p.cliente, 'Antonov');
    assert.match(p.texto, /^📦 \*Pacote de produção #1\* · \*Antonov\*\n\*Diária Tira-dúvidas \(FAQ\)\*\n📄 Documento: https:\/\/docs\.google\.com/);
    assert.match(p.texto, /🎬 Captação sugerida: qui 12\/11, das 08:00 às 12:00 · Antonov _\(a confirmar com o cliente\)_/);
    assert.match(p.texto, /• ter 01\/12 · Reels - FAQ 03 · Wellhub, TotalPass e diária\n• ter 08\/12 · Reels - FAQ 04/);
    assert.match(p.texto, /⚠️ \*Antes da captação:\* Confirmar o professor/);
    assert.match(p.texto, /responde \*ok pacote 1\*.*\*recusa pacote 1\* descarta/s);
    assert.deepEqual(await marcarAvisado(sql, 1), { avisado: true });
    assert.deepEqual(await pacotesParaAvisar(sql), []);
    assert.deepEqual(await marcarAvisado(sql, 1), { avisado: false });

    // Quem não é dono não aprova.
    await assert.rejects(() => executarPacote(sql, 2, 1, segredo, { config: {}, agora }), /Só os donos/);

    const criados = [], escolhas = [], encaixes = [];
    const executar = {
      criarConteudo: async (s, quem, dados) => {
        const id = 500 + criados.length; criados.push(dados);
        await s`INSERT INTO vybe_conteudos(id,titulo,formato,board_id,status_chave) VALUES(${id},${dados.titulo},${dados.formato},${PROD},'a_fazer')`;
        return { conteudo_id: id };
      },
      trocarEscolha: async (s, quem, a) => { escolhas.push(a); },
      marcarEncaixe: async (s, quem, v) => { encaixes.push(v); return 1; },
    };
    const r = await executarPacote(sql, 1, 1, segredo, { config: {}, agora, executar, lerDoc: async () => '' });
    assert.equal(r.estado, 'executado');
    assert.deepEqual(criados.map((d) => [d.titulo, d.cliente, d.veiculacao, d.prazo]), [
      ['Reels - FAQ 03 · Wellhub, TotalPass e diária', 'Antonov', '2026-12-01', '2026-11-29'],
      ['Reels - FAQ 04 · Tour pela academia', 'Antonov', '2026-12-08', '2026-12-07']]);
    assert.match(criados[0].briefing, /^Perguntas 09 e 10\.\n\n📄 Roteiro\/documento: https:\/\/docs\.google\.com.*\n\n🎬 Captação sugerida: qui 12\/11, das 08:00 às 12:00 · Antonov \(a confirmar com o cliente\)\n\n📦 Pacote de produção #1/s);
    assert.deepEqual(escolhas.map((e) => [e.item, e.para]), [['vybe:500', 'agendar'], ['vybe:501', 'agendar']]);
    assert.deepEqual(encaixes, ['2026-11-12|8@08:00-12:00']);
    const ligadas = await sql`SELECT r.titulo, rc.conteudo_id::int AS c FROM vybe_roteiro_conteudos rc JOIN vybe_roteiros r ON r.id = rc.roteiro_id ORDER BY rc.conteudo_id`;
    assert.deepEqual(ligadas.map((x) => [x.titulo, x.c]), [['Diária Tira-dúvidas (FAQ) · Antonov', 500], ['Diária Tira-dúvidas (FAQ) · Antonov', 501]]);
    assert.match(r.texto, /^✅ \*Pacote #1\* · \*Antonov\*: 2 de 2 peça\(s\) cadastrada\(s\) em Produção \(Agendar Captação\)\./);
    assert.match(r.texto, /📄 Ligadas ao roteiro no painel \(2\)\./);
    assert.match(r.texto, /🎬 Captação sugerida marcada na agenda: qui 12\/11, das 08:00 às 12:00\. Quando o cliente confirmar, mudem para "Captação Agendada"\./);
    assert.match(r.texto, /📌 Falta com o cliente: Confirmar o professor/);

    // O ok repetido não cria de novo; recusar depois também não.
    await assert.rejects(() => executarPacote(sql, 1, 1, segredo, { config: {}, agora, executar }), /já foi cadastrado/);
    await assert.rejects(() => recusarPacote(sql, 1, 1, { config: {} }), /já foi cadastrado/);
    assert.equal(criados.length, 2);
  } finally { Date.now = relogio; await db.close(); }
});

test('recusa descarta sem criar; peça com erro não derruba as outras; pacote inexistente avisa', async () => {
  const { db, sql } = await banco();
  try {
    await proporPacote(sql, 8, pacote, { agora });
    assert.match((await recusarPacote(sql, 1, 1, { config: {} })).texto, /Pacote #1 descartado\. Nada foi cadastrado\./);
    await assert.rejects(() => executarPacote(sql, 1, 1, segredo, { config: {}, agora }), /foi recusado/);
    await assert.rejects(() => executarPacote(sql, 1, 99, segredo, { config: {}, agora }), /Não achei o pacote #99/);
    await proporPacote(sql, 8, { titulo: 'Sem documento', pecas: [{ titulo: 'Peça boa', veiculacao: '2026-12-01' }, { titulo: 'Peça ruim', formato: 'Banner', veiculacao: '2026-12-02' }] }, { agora });
    const executar = { criarConteudo: async () => ({ conteudo_id: 700 }), trocarEscolha: async () => {} };
    const r = await executarPacote(sql, 1, 2, segredo, { config: {}, agora, executar });
    assert.equal(r.criadas.length, 1);
    assert.match(r.texto, /1 de 2 peça\(s\)/);
    assert.match(r.texto, /Não entraram:\n• Banner - Peça ruim: Formato desconhecido/);
    assert.equal(r.roteiro, null);
    assert.equal(r.agenda, null);
  } finally { await db.close(); }
});
