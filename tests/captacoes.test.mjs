// Captações da Produção (Paulo, 21/10/2026): junta as peças em "Agendar
// Captação" de um cliente num dia, marca cada uma pelo caminho do painel, cria o
// evento na agenda, marca "Gravado" peça a peça e cancela devolvendo as peças.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { pecasSemMaterial, pecasParaCaptar, listarCaptacoes, montarCaptacao, marcarGravado, cancelarCaptacao, sincronizarAgenda, eventoDaCaptacao, CAPTACAO, clienteDoEvento, agendaDeCaptacoes, fecharGravacao } from '../server/captacoes.js';
import { ehCaptacaoNaAgenda } from '../server/agenda-producao.js';

const PRODUCAO = 7829537690;
async function banco(t) {
  const { db, sql } = conexao(); t.after(() => db.close());
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text);
    CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true);
    CREATE TABLE vybe_status (board_id bigint, chave text, rotulo text, cor text, final boolean DEFAULT false);
    CREATE TABLE vybe_conteudos (id bigint PRIMARY KEY, titulo text, formato text, prazo date, veiculacao date, briefing text,
      status_chave text, captacao_chave text, board_id bigint, removido_em timestamptz, material_bruto text);
    CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
    INSERT INTO vybe_pessoas VALUES (1, 'Paulo Martins'), (28, 'Ademir Dourado Santana');
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
  const trocas = [];
  const trocar = async (s, quem, { item, campo, para }) => { trocas.push([item, campo, para]); await s`UPDATE vybe_conteudos SET captacao_chave = ${para} WHERE id = ${item}`; };
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
  return { ...b, criar, criadas, prazo: (veic) => veic };
}
const ROTEIRO = 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit';
const destino = { grupo_id: 'novo_grupo__1', status: 'pode_fazer', responsaveis: ['9'] };

test('fechar cadastra as peças gravadas a mais, já gravadas, com a pasta e em "Captação Feita"', async (t) => {
  const { sql, trocar, trocas, criar, criadas, prazo } = await comPecasNovas(t);
  const r = await fecharGravacao(sql, quem, { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: ['10'], drive: DRIVE,
    novas: [{ titulo: 'Abdominal', formato: 'Reels', destino }, { titulo: 'Reels - Tríceps', formato: 'Reels', veiculacao: '2026-11-10', destino }] }, { trocar, criar, prazo });
  assert.deepEqual([r.gravadas, r.novas, r.avisos], [3, 2, []]);
  // Título com o formato na frente, sem repetir; destino e pasta da regra.
  assert.deepEqual(criadas.map((d) => [d.titulo, d.status, d.grupo_id, d.material_bruto, d.veiculacao, d.cliente]),
    [['Reels - Abdominal', 'pode_fazer', 'novo_grupo__1', DRIVE, null, 'Brussolo'], ['Reels - Tríceps', 'pode_fazer', 'novo_grupo__1', DRIVE, '2026-11-10', 'Brussolo']]);
  const novas = (await sql`SELECT id::text FROM vybe_conteudos WHERE id > 13 ORDER BY id`).map((l) => l.id);
  assert.deepEqual(trocas.map((x) => x[0]), ['10', ...novas]);
  assert.ok(trocas.every((x) => x[2] === CAPTACAO.feita));
  const [k] = (await listarCaptacoes(sql, { de: '2026-10-01', ate: '2026-11-30' })).captacoes;
  assert.deepEqual(k.pecas.map((p) => [p.id, p.gravado]), [['10', true], [novas[0], true], [novas[1], true]]);
});

test('o roteiro do Docs entra na biblioteca e liga às peças da gravação; link que não é Docs é recusado', async (t) => {
  const { sql, trocar, criar, prazo } = await comPecasNovas(t);
  await assert.rejects(fecharGravacao(sql, quem, { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: ['10'], roteiro: 'https://drive.google.com/file/d/x/view' }, { trocar, criar, prazo }), /Google Docs/);
  const r = await fecharGravacao(sql, quem, { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: ['10', '11'], roteiro: ROTEIRO,
    novas: [{ titulo: 'Supino', formato: 'Reels', destino }] }, { trocar, criar, prazo });
  // O doc não é lido no teste (sem Google): vira aviso, e mesmo assim liga.
  assert.ok(r.avisos.every((a) => /não enxerga/.test(a)));
  const [rot] = await sql`SELECT id, titulo, cliente_id::text AS cliente FROM vybe_roteiros`;
  assert.equal(rot.cliente, '1');
  assert.match(rot.titulo, /^Roteiro Brussolo 26\/10\/2026$/);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_roteiro_conteudos WHERE roteiro_id = ${rot.id}`)[0].n, 3);
  // O mesmo doc numa próxima gravação não duplica a biblioteca.
  await fecharGravacao(sql, quem, { evento_google: 'g2lions', cliente_id: '1', dia: '2026-10-27', gravadas: [], roteiro: ROTEIRO, novas: [{ titulo: 'Rosca', formato: 'Reels', destino }] }, { trocar, criar, prazo });
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_roteiros`)[0].n, 1);
});

test('peça nova sem título, formato estranho ou sem destino é recusada antes de gravar qualquer coisa', async (t) => {
  const { sql, trocar, trocas, criar, prazo } = await comPecasNovas(t);
  const base = { evento_google: 'g1lions', cliente_id: '1', dia: '2026-10-26', gravadas: [] };
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [{ titulo: '', formato: 'Reels', destino }] }, { trocar, criar, prazo }), /título/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [{ titulo: 'X', formato: 'Podcast', destino }] }, { trocar, criar, prazo }), /Formato/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [{ titulo: 'X', formato: 'Reels' }] }, { trocar, criar, prazo }), /Destino/);
  await assert.rejects(fecharGravacao(sql, quem, { ...base, novas: [] }, { trocar, criar, prazo }), /ao menos uma/);
  assert.equal(trocas.length, 0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM vybe_captacoes`)[0].n, 0);
});
