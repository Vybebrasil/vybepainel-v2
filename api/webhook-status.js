import { neon } from '@neondatabase/serverless';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Responder ao Challenge inicial do Monday (validação do Webhook)
  if (req.body && req.body.challenge) {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  // 2. Processar o payload do Webhook
  // Evento esperado: change_column_value
  const event = req.body?.event;
  if (!event || event.type !== 'update_column_value') {
    return res.status(200).json({ status: 'ignored' });
  }

  if (event.columnId !== 'status') {
    return res.status(200).json({ status: 'ignored', message: 'Not the main status column' });
  }

  if (!event) {
    return res.status(200).json({ status: 'ignored', message: 'Not an update_column_value event' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Garantir que a tabela existe
    await sql`
      CREATE TABLE IF NOT EXISTS vybe_status_logs (
          id SERIAL PRIMARY KEY,
          board_id BIGINT NOT NULL,
          item_id TEXT NOT NULL,
          user_id TEXT,
          column_id TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          raw_payload JSONB
      );
    `;

    // Extrair os dados do evento
    const boardId = event.boardId;
    const itemId = event.pulseId;
    const userId = event.userId;
    const columnId = event.columnId;
    
    // previousValue e value geralmente vêm como strings JSON ou objetos
    // Ex: "{\"label\":{\"index\":2,\"text\":\"Em andamento\",\"style\":{\"color\":\"#fdab3d\",\"border\":\"#e99729\"}}}"
    let oldStatus = null;
    let newStatus = null;
    
    try {
      const prev = typeof event.previousValue === 'string' ? JSON.parse(event.previousValue) : event.previousValue;
      if (prev && prev.label && prev.label.text) oldStatus = prev.label.text;
      
      const curr = typeof event.value === 'string' ? JSON.parse(event.value) : event.value;
      if (curr && curr.label && curr.label.text) newStatus = curr.label.text;
    } catch (e) {
      console.warn("Failed to parse status text", e);
    }

    await sql`
      INSERT INTO vybe_status_logs (board_id, item_id, user_id, column_id, old_status, new_status, raw_payload)
      VALUES (${boardId}, ${itemId}, ${userId}, ${columnId}, ${oldStatus}, ${newStatus}, ${JSON.stringify(event)})
    `;

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: error.message });
  }
}