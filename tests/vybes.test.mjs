import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conexao } from './postgres.mjs';
import { guardarEstadoVybes, lerEstadoVybes, acaoVybes, podeAgirNoVybes, semConversas } from '../server/vybes.js';

// Paulo (1), Vinícius (2), Ewerton (3) e Deivid (4) são autores de recado hoje; Bia (5) não.
async function banco() {
  const { db, sql } = conexao();
  await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text, ativo boolean);
    INSERT INTO vybe_pessoas VALUES (1,'Paulo',true),(2,'Vinícius',true),(3,'Ewerton L.',true),(4,'Deivid',true),(5,'Bia',true);
    CREATE TABLE vybe_escritorio_avisos_autores (pessoa_id bigint PRIMARY KEY);
    INSERT INTO vybe_escritorio_avisos_autores VALUES (1),(2),(3),(4);`);
  await db.exec(readFileSync(new URL('../migrations/2026-11-02-vybes.sql', import.meta.url), 'utf8'));
  return { db, sql };
}
const sessao = (id) => ({ tipo: 'sessao', pessoa: { id } });
const ESTADO = {
  geradoEm: 1, estadoDia: { frase: 'Dia com 2 pontos de atenção.' },
  prioridades: [{ id: 'hoje', titulo: 'Hoje: Reels da VOA ainda não saiu', fato: 'Para aprovação' },
    { id: 'clientes', titulo: 'Gonzalez esperando resposta', fato: 'Precisamos das guarnições', itens: [{ titulo: 'Gonzalez', detalhe: 'texto do cliente' }] }],
  whatsapp: { clientes: [{ cliente: 'Gonzalez', n: 3, ultimo: 'Precisamos das guarnições' }], esperando: [{ cliente: 'Gonzalez', minutos: 540, texto: 'Precisamos das guarnições' }],
    internos: { n: 3, grupos: ['Produção', 'Vybe CEO'], alertas: [{ grupo: 'Diretoria', autor: 'Paulo', texto: 'assunto da direção' }, { grupo: 'Produção', autor: 'Reriston', texto: 'travado no áudio' }],
      mensagens: [{ grupo: 'Vybe CEO', texto: 'reservado' }, { grupo: 'Produção', texto: 'ok' }] } },
  jornada: [{ tipo: 'whatsapp', texto: 'Gonzalez pediu as guarnições', dados: { clientes: [] } }, { tipo: 'dia', texto: 'Primeiro, o hoje' }],
};

test('vybes: a migração cria o estado e copia quem age (os autores de recado de hoje)', async () => {
  const { sql } = await banco();
  const ops = await sql`SELECT pessoa_id::int AS id FROM vybe_vybes_operadores ORDER BY pessoa_id`;
  assert.deepEqual(ops.map((o) => o.id), [1, 2, 3, 4]);
  assert.equal(await podeAgirNoVybes(sql, sessao(2)), true);
  assert.equal(await podeAgirNoVybes(sql, sessao(5)), false);
  assert.equal(await podeAgirNoVybes(sql, { tipo: 'servico' }), false);
});

test('vybes: o estado publicado nunca guarda Diretoria nem Vybe CEO; uma linha só', async () => {
  const { sql } = await banco();
  await guardarEstadoVybes(sql, ESTADO);
  await guardarEstadoVybes(sql, { ...ESTADO, geradoEm: 2 });
  const linhas = await sql`SELECT estado FROM vybe_vybes_estado`;
  assert.equal(linhas.length, 1); assert.equal(linhas[0].estado.geradoEm, 2);
  const i = linhas[0].estado.whatsapp.internos;
  assert.deepEqual(i.grupos, ['Produção']);
  assert.deepEqual(i.alertas.map((a) => a.grupo), ['Produção']);
  assert.deepEqual(i.mensagens.map((m) => m.grupo), ['Produção']);
  await assert.rejects(guardarEstadoVybes(sql, [1, 2]), /Estado inválido/);
});

test('vybes: quem age vê tudo; quem só vê não recebe o texto das conversas', async () => {
  const { sql } = await banco();
  await guardarEstadoVybes(sql, ESTADO);
  const op = await lerEstadoVybes(sql, sessao(3));
  assert.equal(op.podeAgir, true);
  assert.equal(op.estado.whatsapp.esperando[0].texto, 'Precisamos das guarnições');
  const ve = await lerEstadoVybes(sql, sessao(5));
  assert.equal(ve.podeAgir, false);
  assert.equal(ve.estado.whatsapp.esperando[0].texto, undefined);
  assert.equal(ve.estado.whatsapp.clientes[0].ultimo, undefined);
  assert.deepEqual(ve.estado.whatsapp.internos, { n: 3, grupos: ['Produção'] });
  assert.equal(ve.estado.prioridades[1].fato, '');
  assert.match(ve.estado.jornada[0].texto, /disponível para quem acompanha/);
  assert.equal(ve.estado.prioridades[0].fato, 'Para aprovação', 'o que não é conversa continua igual');
  assert.equal(JSON.stringify(semConversas(null)), '{}');
});

test('vybes: quem só vê não toma ação; quem age passa pelo executor das ações (preparar → confirmar)', async () => {
  const { sql } = await banco();
  const segredo = 'x'.repeat(40);
  await assert.rejects(acaoVybes(sql, sessao(5), { etapa: 'preparar', pedido: { acao: 'status', item: 'vybe:1', para: 'Para agendar' } }, { segredo }), (e) => e.status === 403 && /só Paulo, Vinícius, Ewerton e Deivid/.test(e.message));
  // Operador chega ao executor: uma ação que ele não conhece volta a recusa dele (prova que a chamada foi feita lá).
  await assert.rejects(acaoVybes(sql, sessao(4), { etapa: 'preparar', pedido: { acao: 'apagar_tudo' } }, { segredo }), /Ação desconhecida/);
  await assert.rejects(acaoVybes(sql, sessao(4), { etapa: 'outra' }, { segredo }), /Informe a etapa/);
});
