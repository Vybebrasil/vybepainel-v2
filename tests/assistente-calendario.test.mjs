import test from 'node:test';
import assert from 'node:assert/strict';
import { mensagemCalendario, calendarioClientes } from '../server/assistente-rotinas.js';

const clientes = [{ id: '1', nome: 'Gonzalez' }, { id: '2', nome: 'Hebravet' }, { id: '3', nome: 'Copirecê' }];
const planejamentos = [{ cliente_id: '2', estado: 'enviado' }, { cliente_id: '1', estado: 'aprovado' }];
const pecas = [
 { ref: '111', titulo: 'Reels - Agenda Musical', veiculacao: '2026-11-05', status: 'Em produção', final: false, cliente_ids: ['1'] },
 { ref: 'vybe:9', titulo: 'Card - Rodízio', veiculacao: '2026-11-12', status: 'Agendado', final: true, cliente_ids: ['1'] },
];

test('carteira do mês: sem nada, só planejamento e com peças', () => {
 const t = mensagemCalendario({ mes: '2026-11', clientes, planejamentos, pecas });
 assert.match(t, /Calendário de novembro\/2026/);
 assert.match(t, /Sem nada cadastrado \(1\)\*\n- Copirecê/);
 assert.match(t, /Só planejamento.*\n- Hebravet · planejamento com o cliente/);
 assert.match(t, /- Gonzalez · 2 peça\(s\), 1 finalizada\(s\) · planejamento aprovado/);
});

test('calendário de um cliente: data, peça, status e link', () => {
 const t = mensagemCalendario({ mes: '2026-11', clientes, planejamentos, pecas, clienteId: 1 });
 assert.match(t, /Gonzalez · novembro\/2026/);
 assert.match(t, /- 05\/11 · Reels - Agenda Musical · Em produção\n  🔗 .*\?atividade=111/);
 assert.match(t, /- 12\/11 · Card - Rodízio · Agendado ✅/);
});

test('consulta: mês inteiro e cliente inválido recusado', async () => {
 const datas = [];
 const sql = async (partes, ...v) => { const q = partes.join('?'); datas.push(...v.filter((x) => typeof x === 'string' && /^\d{4}-/.test(x)));
  if (q.includes('FROM vybe_clientes')) return clientes; if (q.includes('vybe_planejamentos')) return planejamentos; return []; };
 const r = await calendarioClientes(sql, '2026-11-20');
 assert.ok(datas.includes('2026-11-01') && datas.includes('2026-11-30'));
 assert.match(r.texto, /Sem nada cadastrado \(1\)\*\n- Copirecê/);
 await assert.rejects(calendarioClientes(sql, '2026-11-01', 99), /Cliente inválido/);
});
