// Ronda dos clientes no WhatsApp: as mesmas cobranças do Escritório, agrupadas por grupo e cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bancoEscritorio } from './escritorio-esquema.mjs';
import { rondaDosClientes } from '../server/assistente-avisos.js';

test('ronda: cobranças do Escritório viram mensagens por grupo, cliente cobrando e escala a partir de 3 dias', async (t) => {
  const { db, sql } = await bancoEscritorio(t);
  await db.exec(`ALTER TABLE vybe_conteudos ADD COLUMN titulo text, ADD COLUMN monday_item_id text, ADD COLUMN formato text;
    ALTER TABLE vybe_clientes ADD COLUMN segmento text, ADD COLUMN identidade jsonb NOT NULL DEFAULT '{}'::jsonb;
    CREATE TABLE vybe_cliente_pessoas(cliente_id bigint,pessoa_id bigint,ordem int DEFAULT 0);
    INSERT INTO vybe_cliente_pessoas VALUES(1,3),(2,24);
    INSERT INTO vybe_status VALUES(7829537690,'ag_info_cliente','Ag. Info Cliente',false),(7829537690,'a_fazer','A Fazer',false);
    INSERT INTO vybe_conteudos(id,board_id,titulo,formato,status_chave,prazo,veiculacao) VALUES
     (1,7829537690,'Card atrasado','Card','em_andamento','2026-10-19',NULL),
     (2,7829537690,'Card muito atrasado','Card','em_andamento','2026-10-15',NULL),
     (3,7829537690,'Reels para aprovar','Reels','para_aprovacao','2026-10-18',NULL),
     (4,7829537690,'Para agendar hoje','Card','para_agendar','2026-10-18','2026-10-20'),
     (5,7829537690,'Esperando o cliente','Card','ag_info_cliente','2026-10-19',NULL),
     (6,7829537690,'Em dia','Card','pode_fazer','2026-10-30',NULL),
     (7,7829537690,'Compartilhada atrasada','Card','em_andamento','2026-10-19',NULL);
    INSERT INTO vybe_conteudo_clientes VALUES(1,1),(2,1),(3,2),(4,1),(5,1),(6,1),(7,2);
    INSERT INTO vybe_conteudo_responsaveis VALUES(1,6,0),(2,6,0),(3,2,0),(4,6,0),(5,6,0),(6,6,0),(7,6,0),(7,7,1);
    INSERT INTO vybe_escritorio_funcoes(pessoa_id,funcao) VALUES(5,'agendamento'),(1,'gestao') ON CONFLICT (pessoa_id) DO UPDATE SET funcao=EXCLUDED.funcao;`);
  // 20/10 às 14h na Bahia.
  const msgs = await rondaDosClientes(sql, '16h', new Date('2026-10-20T17:00:00Z'));
  assert.deepEqual(msgs.map((m) => m.id), ['criacao', 'publicacoes', 'atendimento']);
  const criacao = msgs[0].texto;
  assert.match(criacao, /^🤖 \*Ronda dos clientes · 16h\*\n_Os clientes passaram cobrando o que precisa de ação:_/);
  // Mais grave/antigo primeiro; 5 dias de atraso escala para o dono do cliente (Vinícius, head do cliente 1).
  assert.match(criacao, /- 🔴 atrasada há 5 dias: Card muito atrasado → \{\{pessoa:100482777:Jady\}\} · ⬆️ \{\{pessoa:68035653:Vinícius\}\}/);
  assert.match(criacao, /- 🔴 atrasada há 1 dia: Card atrasado → \{\{pessoa:100482777:Jady\}\}\n/);
  // Peça compartilhada: uma linha, as duas pessoas marcadas.
  assert.match(criacao, /Compartilhada atrasada → \{\{pessoa:100482777:Jady\}\}, \{\{pessoa:71130408:Beatriz\}\}|Compartilhada atrasada → \{\{pessoa:71130408:Beatriz\}\}, \{\{pessoa:100482777:Jady\}\}/);
  // Aprovação de Reels cobra o dono do cliente (Ewerton, head do cliente 2), não o Deivid.
  assert.match(criacao, /Reels para aprovar → \{\{pessoa:68036687:Ewerton\}\}/);
  assert.doesNotMatch(criacao, /Em dia/);
  assert.match(msgs[1].texto, /📅 veicula 20\/10 e está para agendar: Para agendar hoje → \{\{pessoa:80146924:Tainara\}\}/);
  assert.match(msgs[2].texto, /🟡 esperando o cliente há 1 dia, lembrar o cliente: Esperando o cliente → \{\{pessoa:68035653:Vinícius\}\}/);
  await assert.rejects(() => rondaDosClientes(sql, '9h'), TypeError);
});
