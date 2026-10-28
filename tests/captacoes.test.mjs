// Captações da Produção (Paulo, 21/10/2026): junta as peças em "Agendar
// Captação" de um cliente num dia, marca cada uma pelo caminho do painel, cria o
// evento na agenda, marca "Gravado" peça a peça e cancela devolvendo as peças.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { pecasSemMaterial, pecasParaCaptar, listarCaptacoes, montarCaptacao, marcarGravado, cancelarCaptacao, sincronizarAgenda, eventoDaCaptacao, CAPTACAO, clienteDoEvento, agendaDeCaptacoes, fecharGravacao, vincularCliente, criarEvento, outrasPecasDoCliente, reagendarCaptacao, apagarCaptacao } from '../server/captacoes.js';
import { ehCaptacaoNaAgenda } from '../server/agenda-producao.js';

const PRODUCAO = 7829537690;
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, cor text, final boolean DEFAULT false);
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, titulo text, formato text, prazo date, veiculacao date, briefing text,
      status_chave text, captacao_chave text, board_id bigint, removido_em timestamptz, material_bruto text);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    CREATE TABLE vybe_conteudo_responsaveis (conteudo_id bigint, pessoa_id bigint);
    CREATE TABLE vybe_cliente_pessoas (cliente_id bigint, pessoa_id bigint);
    INSERT INTO vybe_pessoas VALUES (1, 'Paulo Martins'), (28, 'Ademir Dourado Santana'), (5, 'Vinícius Head');
    INSERT INTO vybe_cliente_pessoas VALUES (1, 5);
    INSERT INTO vybe_clientes VALUES (1, 'Brussolo'), (2, 'DiaCenter');
    INSERT INTO vybe_status VALUES (${PRODUCAO}, 'aguardo', 'Aguardo', '#ff8a35');
    INSERT INTO vybe_conteudos VALUES
      (10, 'Reels - Prato do dia', 'Reels', '2026-11-03', '2026-11-05', 'Roteiro: abrir na cozinha', 'aguardo', 'agendar_captacao', ${PRODUCAO}, NULL),
      (11, 'Foto - Sobremesa', 'Fotografia', '2026-11-04', '2026-11-06', '', 'aguardo', 'agendar_captacao', ${PRODUCAO}, NULL),
      (12, 'Reels - Exame', 'Reels', NULL, NULL, '', 'aguardo', 'agendar_captacao', ${PRODUCAO}, NULL),
      (13, 'Card - Promo', 'Card', NULL, NULL, '', 'pode_fazer', NULL, ${PRODUCAO}, NULL);
    INSERT INTO vybe_conteudo_clientes VALUES (10, 1), (11, 1), (12, 2), (13, 1);`);
  await db.exec(readFileSync('migrations/2026-10-21-producao-captacoes.sql', 'utf8'));
  await db.exec(readFileSync('migrations/2026-10-21-producao-captacoes-evento.sql', 'utf8'));
  // O trocarEscolha do painel, reduzido ao que importa aqui: a chave muda.
  // A peça tem de chegar como "vybe:<id>" (o id puro não acha nada no painel).
  const trocas = [];
  const trocar = async (s, quem, { item, campo, para }) => {
    assert.match(String(item), /^vybe:\d+$/, 'a peça vai ao painel como vybe:<id>');
    const id = String(item).slice(5);
    trocas.push([id, campo, para]); await s`UPDATE vybe_conteudos SET captacao_chave = ${para} WHERE id = ${id}`;
  };
  const eventos = [];
  const agenda = async (acao, k) => { eventos.push([acao, k.evento_google || k.cliente]); if (acao === 'criar') return 'ev-1'; return null; };
  return { db, sql, trocar, trocas, agenda, eventos };
}
const quem = { tipo: 'sessao', pessoa: { id: 1, nome: 'Paulo Martins' } };

test('monta a captação com as peças do cliente, marca cada uma e cria o evento', async (t) => {
  const { sql, trocar, trocas, agenda, eventos } = await banco(t);
  assert.deepEqual((await pecasParaCaptar(sql)).map((p) => p.id), ['10', '11', '12']);
  const r = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', inicio: '09:00', fim: '11:00', local: 'Restaurante', pecas: ['10', '11'] }, { trocar, agenda });
  assert.deepEqual(r.avisos, []);
  assert.deepEqual(trocas, [['10', 'captacao', CAPTACAO.agendada], ['11', 'captacao', CAPTACAO.agendada]]);
  assert.deepEqual(eventos, [['criar', 'Brussolo']]);
  // Saem da fila e aparecem na agenda de captações, com o roteiro.
  assert.deepEqual((await pecasParaCaptar(sql)).map((p) => p.id), ['12']);
  const { captacoes } = await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' });
  assert.equal(captacoes.length, 1);
  assert.equal(captacoes[0].cliente, 'Brussolo');
  assert.equal(captacoes[0].na_agenda, true);
  assert.equal(captacoes[0].pecas[0].briefing, 'Roteiro: abrir na cozinha');
});

test('recusa peça de outro cliente, fora da fila ou já marcada; nada fica pela metade', async (t) => {
  const { sql, trocar, trocas, agenda } = await banco(t);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10', '12'] }, { trocar, agenda }), /Reels - Exame/);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['13'] }, { trocar, agenda }), /Card - Promo/);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '28/10', pecas: ['10'] }, { trocar, agenda }), /dia/);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', inicio: '11:00', fim: '09:00', pecas: ['10'] }, { trocar, agenda }), /fim/);
  assert.equal(trocas.length, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_captacoes`)[0].n, 0);
  await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10'] }, { trocar, agenda });
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-29', pecas: ['10'] }, { trocar, agenda }), /Prato do dia/);
});

test('falha do Google vira aviso guardado e a captação continua', async (t) => {
  const { sql, trocar } = await banco(t);
  const agenda = async () => { throw new Error('a conta do painel não pode mudar a agenda'); };
  const r = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10'] }, { trocar, agenda });
  assert.match(r.avisos[0], /Google Agenda/);
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.equal(k.na_agenda, false);
  assert.match(k.aviso, /não pode mudar a agenda/);
});

test('gravado peça a peça fecha a captação; cancelar devolve só as não gravadas', async (t) => {
  const { sql, trocar, trocas, agenda, eventos } = await banco(t);
  const { id } = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10', '11'] }, { trocar, agenda });
  assert.deepEqual(await marcarGravado(sql, quem, { captacao_id: id, conteudo_id: '10' }, { trocar }), { estado: 'agendada', faltam: 1 });
  assert.equal(trocas.at(-1)[2], CAPTACAO.feita);
  await assert.rejects(marcarGravado(sql, quem, { captacao_id: id, conteudo_id: '12' }, { trocar }), /não é desta captação/);
  await cancelarCaptacao(sql, quem, { id }, { trocar, agenda });
  assert.deepEqual(trocas.at(-1), ['11', 'captacao', CAPTACAO.pronta]);
  assert.deepEqual(eventos.at(-1), ['apagar', 'ev-1']);
  assert.deepEqual((await pecasParaCaptar(sql)).map((p) => p.id), ['11', '12']);
  assert.equal((await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes.length, 0);
});

test('liga as peças a uma captação que já está no Google sem criar nem apagar o evento', async (t) => {
  const { sql, trocar, trocas, agenda, eventos } = await banco(t);
  const { id } = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-23', inicio: '07:00', fim: '08:00', pecas: ['10'], evento_google: 'g1brussolo' }, { trocar, agenda });
  assert.deepEqual(eventos, []);
  assert.deepEqual(trocas, [['10', 'captacao', CAPTACAO.agendada]]);
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.deepEqual([k.evento_google, k.evento_do_painel, k.na_agenda], ['g1brussolo', false, true]);
  // O mesmo evento não recebe outra captação; "tentar de novo" não reescreve o evento.
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-23', pecas: ['11'], evento_google: 'g1brussolo' }, { trocar, agenda }), /já tem peças/);
  assert.deepEqual(await sincronizarAgenda(sql, id, { agenda }), []);
  assert.deepEqual(eventos, []);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-23', pecas: ['11'], evento_google: 'x y' }, { trocar, agenda }), /inválido/);
  // Cancelar solta as peças e deixa o evento de quem marcou no Google.
  await cancelarCaptacao(sql, quem, { id }, { trocar, agenda });
  assert.deepEqual(eventos, []);
  assert.deepEqual(trocas.at(-1), ['10', 'captacao', CAPTACAO.pronta]);
});

test('fotografia sem banco de fotos aparece e pode ir para a captação; o resto continua fora', async (t) => {
  const { sql, trocar, trocas, agenda } = await banco(t);
  await sql`INSERT INTO vybe_status VALUES (${PRODUCAO}, 'falta_info', 'Falta Info', '#ff5ac4', false), (${PRODUCAO}, 'finalizado', 'Finalizado', '#00c875', true)`;
  await sql`INSERT INTO vybe_conteudos (id, titulo, formato, status_chave, captacao_chave, board_id, material_bruto) VALUES
    (20, 'Fotografia - A escolha do DA', 'Fotografia', 'falta_info', NULL, ${PRODUCAO}, NULL),
    (21, 'Fotografia - com material', 'Fotografia', 'falta_info', NULL, ${PRODUCAO}, 'https://drive.google.com/x'),
    (22, 'Fotografia - pronta', 'Fotografia', 'finalizado', NULL, ${PRODUCAO}, NULL),
    (23, 'Fotografia - para agendar', 'Fotografia', 'para_agendar', NULL, ${PRODUCAO}, NULL)`;
  await sql`INSERT INTO vybe_conteudo_clientes VALUES (20, 1), (21, 1), (22, 1), (23, 1)`;
  // Reels já cadastrado sem roteiro nem captação também vai ser gravado; card não.
  await sql`INSERT INTO vybe_status VALUES (${PRODUCAO}, 'aguardo_redacao', 'Aguardo Redação', '#ff5ac4', false)`;
  await sql`INSERT INTO vybe_conteudos (id, titulo, formato, status_chave, captacao_chave, board_id) VALUES
    (24, 'Reels - FAQ 2', 'Reels', 'aguardo_redacao', NULL, ${PRODUCAO}), (25, 'Card - Horário', 'Card', 'aguardo_redacao', NULL, ${PRODUCAO})`;
  const fotos = await pecasSemMaterial(sql);
  assert.deepEqual(fotos.map((p) => [p.id, p.status, p.tipo]), [['20', 'Falta Info', 'foto'], ['24', 'Aguardo Redação', 'video']]);
  await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['20', '10'] }, { trocar, agenda });
  assert.deepEqual(trocas.map((x) => x[0]), ['20', '10']);
  assert.deepEqual((await pecasSemMaterial(sql)).map((p) => p.id), ['24']);
  // Foto com material, pronta ou para agendar não entra numa captação.
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['21'] }, { trocar, agenda }), /com material/);
  await assert.rejects(montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['22'] }, { trocar, agenda }), /pronta/);
});

test('o evento da agenda leva cliente, peças, local e horário de Irecê', () => {
  const e = eventoDaCaptacao({ cliente: 'Brussolo', dia: '2026-10-28', inicio: '09:00', fim: null, local: 'Restaurante', observacao: 'Levar luz',
    pecas: [{ titulo: 'Reels - Prato do dia', formato: 'Reels' }, { titulo: 'Foto - Sobremesa', formato: 'Fotografia' }] }, 'https://painel');
  assert.equal(e.summary, 'Captação · Brussolo · 2 peças');
  assert.equal(e.start.dateTime, '2026-10-28T09:00:00-03:00');
  assert.equal(new Date(e.end.dateTime).toISOString(), '2026-10-28T14:00:00.000Z');
  assert.match(e.description, /1\. Reels - Prato do dia \(Reels\)/);
  assert.match(e.description, /Levar luz/);
  const diaTodo = eventoDaCaptacao({ cliente: 'X', dia: '2026-12-31', inicio: null, fim: null, local: '', observacao: '', pecas: [] });
  assert.deepEqual([diaTodo.start.date, diaTodo.end.date], ['2026-12-31', '2027-01-01']);
});

test('a agenda do Google conta: azul é captação, reunião e pessoal ficam fora, e o cliente sai do título', async (t) => {
  assert.equal(ehCaptacaoNaAgenda({ summary: 'Captação - Antonov - Iago' }), true);
  assert.equal(ehCaptacaoNaAgenda({ summary: 'Lions - Banco de imagem', colorId: '9' }), true);
  assert.equal(ehCaptacaoNaAgenda({ summary: 'Reunião Lions' }), false);
  assert.equal(ehCaptacaoNaAgenda({ summary: 'Reunião galego', colorId: '5' }), false);
  assert.equal(ehCaptacaoNaAgenda({ summary: 'Consulta Vinicius', colorId: '8' }), false);
  assert.equal(ehCaptacaoNaAgenda({ summary: 'Mizinho - freela - Dra Luisa' }), false);
  const clientes = [{ id: '1', nome: 'Brussolo Ristorante' }, { id: '2', nome: 'Antonov' }, { id: '3', nome: 'Grupo Serra Grande' }];
  assert.equal(clienteDoEvento('Captação Brussolo - experiência de casal', clientes)?.id, '1');
  assert.equal(clienteDoEvento('Captação aula de dança - antonov', clientes)?.id, '2');
  assert.equal(clienteDoEvento('Captação outubro Rosa Serra grande', clientes)?.id, '3');
  assert.equal(clienteDoEvento('Fotos experimente', clientes), null);
  const { sql } = await banco(t);
  const listar = async () => ({ eventos: [
    { id: 'g1', titulo: 'Captação - Brussolo', dia: '2026-10-23', horario: '07:00 às 08:00', inicio: '07:00', fim: '08:00', local: '', captacao: true, tipo: 'captacao' },
    { id: 'g2', titulo: 'Reunião Brussolo', dia: '2026-10-23', horario: '09:00 às 10:00', inicio: '09:00', fim: '10:00', local: '', captacao: false, tipo: 'reuniao' }] });
  // A semana inteira vem, cada evento com o tipo: a tela pinta e conta só as captações.
  const agenda = await agendaDeCaptacoes(sql, { listar, inicio: '2026-10-19' });
  assert.deepEqual(agenda.map((e) => [e.id, e.tipo, e.cliente, e.inicio]), [['g1', 'captacao', 'Brussolo', '07:00'], ['g2', 'reuniao', 'Brussolo', '09:00']]);
});

// Fechar gravação (Paulo, 26/10/2026): o Mizinho marca o que gravou e cola a
// pasta do Drive; a pasta vira o material bruto das peças e a captação fecha.
async function comFechamento(t) {
  const b = await banco(t);
  await b.sql`ALTER TABLE vybe_conteudos ADD COLUMN material_bruto_em timestamptz, ADD COLUMN atualizado_em timestamptz`;
  await b.sql`CREATE TABLE vybe_conteudo_eventos (conteudo_id bigint, tipo text, de text, para text, autor_id bigint)`;
  await b.db.exec(readFileSync('migrations/2026-10-26-producao-fechar-gravacao.sql', 'utf8'));
  return b;
}
const DRIVE = 'https://drive.google.com/drive/folders/lions-26-10';

test('fechar uma captação que só está no Google cria a captação, liga o que foi gravado e leva a pasta para as peças', async (t) => {
  const { sql, trocar, trocas } = await comFechamento(t);
  const r = await fecharGravacao(sql, quem, { evento_google: 'g1brussolo', cliente_id: '1', dia: '2026-10-26', inicio: '14:00', fim: '16:00',
    gravadas: ['10', '11'], drive: DRIVE, observacao: 'Supino gravado a mais' }, { trocar });
  assert.deepEqual([r.gravadas, r.soltas, r.com_drive, r.avisos], [2, 0, 2, []]);
  assert.deepEqual(trocas, [['10', 'captacao', CAPTACAO.feita], ['11', 'captacao', CAPTACAO.feita]]);
  assert.deepEqual((await sql`SELECT id::text, material_bruto FROM vybe_conteudos WHERE id IN (10, 11) ORDER BY id`).map((l) => l.material_bruto), [DRIVE, DRIVE]);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_conteudo_eventos WHERE tipo = 'material_bruto' AND para = ${DRIVE}`)[0].n, 2);
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.deepEqual([k.estado, k.evento_google, k.evento_do_painel, k.drive_link, k.fechada_por, k.observacao_final],
    ['gravada', 'g1brussolo', false, DRIVE, 'Paulo Martins', 'Supino gravado a mais']);
  assert.ok(k.fechada_em);
  assert.deepEqual(k.pecas.map((p) => [p.id, p.gravado, p.status]), [['10', true, 'Aguardo'], ['11', true, 'Aguardo']]);
  // A mesma gravação não fecha duas vezes.
  await assert.rejects(fecharGravacao(sql, quem, { captacao_id: k.id, gravadas: ['10'] }, { trocar }), /já foi fechada/);
});

test('fechar a captação do painel solta o que não foi gravado e não apaga material que a peça já tinha', async (t) => {
  const { sql, trocar, trocas, agenda } = await comFechamento(t);
  await sql`UPDATE vybe_conteudos SET material_bruto = 'https://drive.google.com/antigo' WHERE id = 11`;
  const { id } = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-26', pecas: ['10', '11'] }, { trocar, agenda });
  await marcarGravado(sql, quem, { captacao_id: id, conteudo_id: '11' }, { trocar });
  trocas.length = 0;
  // 11 já tinha "Gravado": desmarcada aqui, continua gravada; 10 não foi gravada e se solta.
  await assert.rejects(fecharGravacao(sql, quem, { captacao_id: id, gravadas: [] }, { trocar }), /ao menos uma/);
  const r = await fecharGravacao(sql, quem, { captacao_id: id, gravadas: ['11'], drive: DRIVE }, { trocar });
  assert.deepEqual([r.soltas, r.com_drive], [1, 0]);
  assert.deepEqual(trocas, [['10', 'captacao', CAPTACAO.pronta]]);
  assert.equal((await sql`SELECT material_bruto FROM vybe_conteudos WHERE id = 11`)[0].material_bruto, 'https://drive.google.com/antigo');
  assert.deepEqual((await pecasParaCaptar(sql)).map((p) => p.id), ['10', '12']);
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.deepEqual(k.pecas.map((p) => p.id), ['11']);
});

test('fechar recusa peça de outro cliente, link que não é endereço e evento sem cliente; nada fica pela metade', async (t) => {
  const { sql, trocar, trocas } = await comFechamento(t);
  const base = { evento_google: 'g1brussolo', cliente_id: '1', dia: '2026-10-26' };
  await assert.rejects(fecharGravacao(sql, quem, { ...base, gravadas: ['10', '12'] }, { trocar }), /Reels - Exame/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, gravadas: ['13'] }, { trocar }), /Card - Promo/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, gravadas: ['10'], drive: 'pasta do lions' }, { trocar }), /http/);
  await assert.rejects(fecharGravacao(sql, quem, { evento_google: 'g1semcliente', dia: '2026-10-26', gravadas: ['10'] }, { trocar }), /cliente/);
  assert.equal(trocas.length, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_captacoes`)[0].n, 0);
});

test('antes da migração, fechar avisa e a lista continua funcionando', async (t) => {
  const { sql, trocar, agenda } = await banco(t);
  await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-26', pecas: ['10'] }, { trocar, agenda });
  await assert.rejects(fecharGravacao(sql, quem, { captacao_id: '1', gravadas: ['10'] }, { trocar }), (e) => e.status === 503 && /migração/.test(e.message));
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.equal(k.drive_link, undefined);
});

// Fechar gravação com o que não estava no sistema (Paulo, 26/10/2026: "o
// Mizinho fez 4 materiais na Lions e só 2 estavam lá") e o roteiro do Docs.
async function comPecasNovas(t) {
  const b = await comFechamento(t);
  await b.db.exec(readFileSync('migrations/2026-10-21-producao-roteiros.sql', 'utf8'));
  const criadas = [];
  // O cadastro do painel, reduzido: cria a peça do cliente com o destino pedido.
  const criar = async (tx, quem, d) => {
    const [{ id }] = await tx`SELECT max(id) + 1 AS id FROM vybe_conteudos`;
    await tx`INSERT INTO vybe_conteudos (id, titulo, formato, status_chave, board_id, veiculacao, prazo, material_bruto)
      VALUES (${id}, ${d.titulo}, ${d.formato}, ${d.status}, ${d.board}, ${d.veiculacao}::date, ${d.prazo}::date, ${d.material_bruto || null})`;
    await tx`INSERT INTO vybe_conteudo_clientes SELECT ${id}, id FROM vybe_clientes WHERE nome = ${d.cliente}`;
    criadas.push(d);
    return { conteudo_id: String(id), titulo: d.titulo };
  };
  // Grupo, responsáveis e comentário do painel, reduzidos: só registram.
  const painel = { chamadas: [],
    moverGrupo: async (s, q, { item, grupo_id }) => { painel.chamadas.push(['grupo', item, grupo_id]); },
    trocarResponsaveis: async (s, q, { item, pessoas }) => { painel.chamadas.push(['responsaveis', item, pessoas]); },
    comentar: async (s, q, { item, texto }) => { painel.chamadas.push(['comentario', item, texto]); } };
  return { ...b, criar, criadas, prazo: (veic) => veic, painel };
}
const ROTEIRO = 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit';
const destino = { grupo_id: 'novo_grupo__1', status: 'pode_fazer', responsaveis: ['9'] };

test('fechar cadastra as peças gravadas a mais, já gravadas, com a pasta e em "Captação Feita"', async (t) => {
  const { sql, trocar, trocas, criar, criadas, prazo, painel } = await comPecasNovas(t);
  const r = await fecharGravacao(sql, quem, { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: ['10'], drive: DRIVE,
    novas: [{ titulo: 'Abdominal', formato: 'Reels', destino }, { titulo: 'Reels - Tríceps', formato: 'Reels', veiculacao: '2026-11-10', destino }] }, { trocar, criar, prazo, painel });
  assert.deepEqual([r.gravadas, r.novas, r.avisos], [3, 2, []]);
  // Título com o formato na frente, sem repetir; destino e pasta da regra.
  assert.deepEqual(criadas.map((d) => [d.titulo, d.status, d.grupo_id, d.material_bruto, d.veiculacao, d.cliente]),
    [['Reels - Abdominal', 'pode_fazer', 'novo_grupo__1', DRIVE, null, 'Brussolo'], ['Reels - Tríceps', 'pode_fazer', 'novo_grupo__1', DRIVE, '2026-11-10', 'Brussolo']]);
  const novas = (await sql`SELECT id::text FROM vybe_conteudos WHERE id > 13 ORDER BY id`).map((l) => l.id);
  assert.deepEqual(trocas.map((x) => x[0]), ['10', ...novas]);
  assert.ok(trocas.every((x) => x[2] === CAPTACAO.feita));
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.deepEqual(k.pecas.map((p) => [p.id, p.gravado]), [['10', true], [novas[0], true], [novas[1], true]]);
  // Só a Abdominal ficou sem dia de ir ao ar: vai para Redação, com o head do
  // cliente nos responsáveis e o aviso na peça (Paulo, 27/10/2026).
  const sem = `vybe:${novas[0]}`;
  assert.deepEqual(painel.chamadas.map((c) => c.slice(0, 2)), [['grupo', sem], ['responsaveis', sem], ['comentario', sem]]);
  assert.equal(painel.chamadas[0][2], 'group_title');
  assert.ok(painel.chamadas[1][2].includes('5'));
  assert.match(painel.chamadas[2][2], /^@Vinícius .*dia de veiculação/);
});

test('o roteiro do Docs entra na biblioteca e liga às peças da gravação; link que não é Docs é recusado', async (t) => {
  const { sql, trocar, criar, prazo, painel } = await comPecasNovas(t);
  await assert.rejects(fecharGravacao(sql, quem, { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: ['10'], roteiro: 'https://drive.google.com/file/d/x/view' }, { trocar, criar, prazo, painel }), /Google Docs/);
  const r = await fecharGravacao(sql, quem, { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: ['10', '11'], roteiro: ROTEIRO,
    novas: [{ titulo: 'Supino', formato: 'Reels', destino }] }, { trocar, criar, prazo, painel });
  // O doc não é lido no teste (sem Google): vira aviso, e mesmo assim liga.
  assert.ok(r.avisos.every((a) => /não enxerga/.test(a)));
  const [rot] = await sql`SELECT id, titulo, cliente_id::text AS cliente FROM vybe_roteiros`;
  assert.equal(rot.cliente, '1');
  assert.match(rot.titulo, /^Roteiro Brussolo 26\/10\/2026$/);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_roteiro_conteudos WHERE roteiro_id = ${rot.id}`)[0].n, 3);
  // O mesmo doc numa próxima gravação não duplica a biblioteca.
  await fecharGravacao(sql, quem, { evento_google: 'g2lions', cliente_id: '1', dia: '2026-10-27', gravadas: [], roteiro: ROTEIRO, novas: [{ titulo: 'Rosca', formato: 'Reels', destino }] }, { trocar, criar, prazo, painel });
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_roteiros`)[0].n, 1);
});

test('peça nova sem título, formato estranho ou sem destino é recusada antes de gravar qualquer coisa', async (t) => {
  const { sql, trocar, trocas, criar, prazo, painel } = await comPecasNovas(t);
  const base = { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: [] };
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [{ titulo: '', formato: 'Reels', destino }] }, { trocar, criar, prazo, painel }), /título/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [{ titulo: 'X', formato: 'Podcast', destino }] }, { trocar, criar, prazo, painel }), /Formato/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [{ titulo: 'X', formato: 'Reels' }] }, { trocar, criar, prazo, painel }), /Destino/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [] }, { trocar, criar, prazo, painel }), /ao menos uma/);
  assert.equal(trocas.length, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_captacoes`)[0].n, 0);
});

// Vincular cliente a um evento e criar evento novo (Paulo, 26/10/2026).
async function comVinculos(t) {
  const b = await banco(t);
  await b.db.exec(readFileSync('migrations/2026-10-27-agenda-clientes.sql', 'utf8'));
  return b;
}
const listarDois = async () => ({ eventos: [
  { id: 'g1sem', titulo: 'Gravação aula experimental', dia: '2026-10-27', inicio: '08:00', fim: '09:00', tipo: 'captacao' },
  { id: 'g2errado', titulo: 'Captação Brussolo', dia: '2026-10-27', inicio: '10:00', fim: '11:00', tipo: 'captacao' }] });

test('vincular cliente vale mais que o título, troca e volta a ler pelo título', async (t) => {
  const { sql } = await comVinculos(t);
  let ev = await agendaDeCaptacoes(sql, { inicio: '2026-10-26', listar: listarDois });
  assert.deepEqual(ev.map((e) => [e.id, e.cliente, e.cliente_manual]), [['g1sem', '', false], ['g2errado', 'Brussolo', false]]);
  assert.equal((await vincularCliente(sql, quem, { evento: 'g1sem', cliente_id: '2' })).cliente.nome, 'DiaCenter');
  await vincularCliente(sql, quem, { evento: 'g2errado', cliente_id: '2' });
  ev = await agendaDeCaptacoes(sql, { inicio: '2026-10-26', listar: listarDois });
  assert.deepEqual(ev.map((e) => [e.cliente, e.cliente_manual]), [['DiaCenter', true], ['DiaCenter', true]]);
  // Tirar o vínculo volta a ler pelo título.
  await vincularCliente(sql, quem, { evento: 'g2errado', cliente_id: '' });
  ev = await agendaDeCaptacoes(sql, { inicio: '2026-10-26', listar: listarDois });
  assert.equal(ev[1].cliente, 'Brussolo');
  await assert.rejects(vincularCliente(sql, quem, { evento: 'x y', cliente_id: '1' }), /inválido/);
  await assert.rejects(vincularCliente(sql, quem, { evento: 'g1sem', cliente_id: '99' }), /não encontrado/);
});

test('criar evento vai ao Google com a cor do tipo, o cliente no título e o vínculo guardado', async (t) => {
  const { sql } = await comVinculos(t);
  const pedidos = [];
  const buscar = async (url, o) => { pedidos.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ id: `novo${pedidos.length}x` }) }; };
  const obterToken = async () => 'token';
  const r = await criarEvento(sql, quem, { tipo: 'reuniao', titulo: 'Pauta de novembro', dia: '2026-10-28', inicio: '14:00', fim: '15:00', cliente_id: '1' }, { buscar, obterToken });
  assert.equal(r.titulo, 'Reunião · Pauta de novembro · Brussolo');
  assert.deepEqual([pedidos[0].colorId, pedidos[0].start.dateTime, pedidos[0].end.dateTime], ['5', '2026-10-28T14:00:00-03:00', '2026-10-28T15:00:00-03:00']);
  assert.equal((await sql`SELECT cliente_id::text AS c FROM vybe_agenda_clientes WHERE evento_google = 'novo1x'`)[0].c, '1');
  const c = await criarEvento(sql, quem, { tipo: 'captacao', dia: '2026-10-29', inicio: '09:00', cliente_id: '2' }, { buscar, obterToken });
  assert.equal(c.titulo, 'Captação · DiaCenter');
  assert.equal(pedidos[1].colorId, '9');
  // Sem fim: uma hora.
  assert.equal(new Date(pedidos[1].end.dateTime).toISOString(), '2026-10-29T13:00:00.000Z');
  await criarEvento(sql, quem, { tipo: 'outro', titulo: 'Dentista', dia: '2026-10-30' }, { buscar, obterToken });
  assert.deepEqual([pedidos[2].colorId, pedidos[2].start.date, pedidos[2].summary], ['8', '2026-10-30', 'Dentista']);
  await assert.rejects(criarEvento(sql, quem, { tipo: 'captacao', dia: '2026-10-29' }, { buscar, obterToken }), /cliente/);
  await assert.rejects(criarEvento(sql, quem, { tipo: 'festa', titulo: 'x', dia: '2026-10-29' }, { buscar, obterToken }), /captação, reunião ou compromisso/);
  await assert.rejects(criarEvento(sql, quem, { tipo: 'reuniao', titulo: 'x', dia: '2026-10-29', inicio: '10:00', fim: '09:00' }, { buscar, obterToken }), /fim/);
  assert.equal(pedidos.length, 3);
});

test('fechar aceita outra peça de foto/vídeo do cliente, mesmo com Captação Feita; card continua fora', async (t) => {
  const { sql, trocar, trocas } = await comFechamento(t);
  await sql`INSERT INTO vybe_conteudos VALUES (14, 'Reels - Mr Fit', 'Reels', '2026-10-28', '2026-10-29', '', 'pode_fazer', 'captacao_feita', ${PRODUCAO}, NULL, 'https://drive.google.com/ja-tinha')`;
  await sql`INSERT INTO vybe_conteudo_clientes VALUES (14, 1)`;
  assert.deepEqual((await outrasPecasDoCliente(sql, { cliente_id: '1' })).map((p) => p.id).sort(), ['10', '11', '14']);
  const r = await fecharGravacao(sql, quem, { evento_google: 'g1brussolo', cliente_id: '1', dia: '2026-10-27', gravadas: ['14'], drive: DRIVE }, { trocar });
  assert.deepEqual([r.gravadas, r.com_drive], [1, 0]);
  // Já estava em Captação Feita: não troca de novo e não perde o material que tinha.
  assert.deepEqual(trocas, []);
  assert.equal((await sql`SELECT material_bruto FROM vybe_conteudos WHERE id = 14`)[0].material_bruto, 'https://drive.google.com/ja-tinha');
  await assert.rejects(fecharGravacao(sql, quem, { evento_google: 'g2brussolo', cliente_id: '1', dia: '2026-10-27', gravadas: ['13'] }, { trocar }), /Card - Promo/);
});

test('reagendar muda a captação do painel e o evento dela; o do Google muda pelo PATCH', async (t) => {
  const { sql, trocar, agenda, eventos } = await banco(t);
  const { id } = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', inicio: '09:00', fim: '11:00', pecas: ['10'] }, { trocar, agenda });
  eventos.length = 0;
  await assert.rejects(reagendarCaptacao(sql, quem, { captacao_id: id, dia: '2026-10-30', inicio: '11:00', fim: '10:00' }, { agenda }), /depois do início/);
  const r = await reagendarCaptacao(sql, quem, { captacao_id: id, dia: '2026-10-30', inicio: '14:00', fim: '15:00' }, { agenda });
  assert.deepEqual(r.avisos, []);
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.deepEqual([k.dia, k.inicio, k.fim], ['2026-10-30', '14:00', '15:00']);
  assert.deepEqual(eventos, [['criar', 'ev-1']]);
  const pedidos = [];
  const buscar = async (url, o) => { pedidos.push([o.method, url.split('/events/')[1], JSON.parse(o.body).start]); return { ok: true, json: async () => ({}) }; };
  await reagendarCaptacao(sql, quem, { evento: 'g1semcaptacao', dia: '2026-11-02', inicio: '08:00' }, { buscar, obterToken: async () => 't' });
  assert.deepEqual(pedidos, [['PATCH', 'g1semcaptacao', { dateTime: '2026-11-02T08:00:00-03:00', timeZone: 'America/Bahia', date: null }]]);
});

test('apagar cancela a captação, devolve as peças e tira o evento; o evento só do Google também sai', async (t) => {
  const { sql, trocar, trocas, agenda, eventos } = await banco(t);
  const { id } = await montarCaptacao(sql, quem, { cliente_id: '1', dia: '2026-10-28', pecas: ['10'] }, { trocar, agenda });
  trocas.length = 0; eventos.length = 0;
  await apagarCaptacao(sql, quem, { captacao_id: id }, { trocar, agenda });
  assert.deepEqual(trocas, [['10', 'captacao', CAPTACAO.pronta]]);
  assert.deepEqual(eventos, [['apagar', 'ev-1']]);
  eventos.length = 0;
  await apagarCaptacao(sql, quem, { evento: 'g1sodogoogle' }, { trocar, agenda });
  assert.deepEqual(eventos, [['apagar', 'g1sodogoogle']]);
});
