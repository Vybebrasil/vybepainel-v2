import { randomUUID } from 'node:crypto';

const MAX_ERRO = 1800;
const RETRY_MAX_MINUTOS = 360;

export async function garantirFilaReplica(sql) {
  await sql`CREATE TABLE IF NOT EXISTS vybe_replica_queue (
    id BIGSERIAL PRIMARY KEY,
    operation_key TEXT NOT NULL UNIQUE,
    operacao TEXT NOT NULL,
    referencia TEXT,
    query TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado TEXT NOT NULL DEFAULT 'pendente'
      CHECK (estado IN ('pendente','processando','concluida','falhou')),
    tentativas INT NOT NULL DEFAULT 0,
    proxima_tentativa TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_erro TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    concluido_em TIMESTAMPTZ
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_replica_queue_pendentes_idx
    ON vybe_replica_queue (proxima_tentativa, id)
    WHERE estado IN ('pendente','falhou')`;
  await sql`ALTER TABLE vybe_replica_queue ADD COLUMN IF NOT EXISTS claim_token TEXT`;
}

function mensagemErro(erro) {
  return String(erro?.message || erro || 'Falha desconhecida').slice(0, MAX_ERRO);
}

export async function enfileirarReplica(sql, { operacao, referencia, query, variables, erro, operationKey }) {
  await garantirFilaReplica(sql);
  const key = operationKey || randomUUID();
  await sql`INSERT INTO vybe_replica_queue
      (operation_key, operacao, referencia, query, variables, estado, tentativas,
       proxima_tentativa, ultimo_erro)
    VALUES (${key}, ${String(operacao || 'replica')}, ${referencia || null}, ${query},
            ${JSON.stringify(variables || {})}::jsonb, 'pendente', 0, NOW(), ${mensagemErro(erro)})
    ON CONFLICT (operation_key) DO NOTHING`;
  return key;
}

// A MESMA FILA, MAS PARA MUITAS PECAS DE UMA VEZ.
//
// enfileirarReplica faz tres idas ao banco por chamada (as duas do
// garantirFilaReplica mais a propria). Enfileirar 250 mudancas assim seriam 750
// idas — a recalculagem diaria de prioridade estouraria o tempo da funcao antes
// de terminar. E a mesma linha, a mesma chave e o mesmo conflito; muda so que
// vao todas num INSERT.
export async function enfileirarReplicaEmLote(sql, itens = []) {
  const lista = (itens || []).filter(Boolean);
  if (!lista.length) return 0;
  await garantirFilaReplica(sql);
  const linhas = lista.map((d) => ({
    operation_key: d.operationKey || randomUUID(),
    operacao: String(d.operacao || 'replica'),
    referencia: d.referencia || null,
    query: d.query,
    variables: d.variables || {},
    ultimo_erro: d.erro ? mensagemErro(d.erro) : null,
  }));
  await sql`INSERT INTO vybe_replica_queue
      (operation_key, operacao, referencia, query, variables, estado, tentativas,
       proxima_tentativa, ultimo_erro)
    SELECT f.operation_key, f.operacao, f.referencia, f.query, f.variables,
           'pendente', 0, NOW(), f.ultimo_erro
      FROM jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb)
        AS f(operation_key TEXT, operacao TEXT, referencia TEXT, query TEXT,
             variables JSONB, ultimo_erro TEXT)
    ON CONFLICT (operation_key) DO NOTHING`;
  return linhas.length;
}

export async function replicarOuEnfileirar(sql, executar, dados) {
  // A intenção fica durável antes de chamar o serviço externo.
  const key = await enfileirarReplica(sql, dados);
  const [linha] = await sql`SELECT * FROM vybe_replica_queue WHERE operation_key=${key}`;
  if (linha?.estado === 'concluida') return { estado: 'ok', operation_key: key };
  const r = linha ? await executarLinha(sql, executar, linha) : null;
  return r?.ok ? { estado: 'ok', operation_key: key, resposta: r.resposta }
    : { estado: 'pendente', operation_key: key, erro: r?.erro || 'Aguardando processamento.' };
}

function minutosDeEspera(tentativas) {
  return Math.min(RETRY_MAX_MINUTOS, Math.max(1, 2 ** Math.min(Number(tentativas || 0), 8)));
}

export async function prepararVariables(sql, linha) {
  const variables = { ...(linha.variables || {}) };
  const resolver = async (valor, tabela) => {
    const texto = String(valor || '');
    const prefixo = tabela === 'vybe_subitens' ? 'vybe-subitem:' : 'vybe:';
    if (!texto.startsWith(prefixo)) return valor;
    const localId = Number(texto.slice(prefixo.length));
    if (!Number.isInteger(localId) || localId <= 0) throw new Error(`Referência local inválida: ${texto}`);
    const linhas = tabela === 'vybe_subitens'
      ? await sql`SELECT monday_item_id FROM vybe_subitens WHERE id=${localId}`
      : await sql`SELECT monday_item_id FROM vybe_conteudos WHERE id=${localId}`;
    if (!linhas[0]?.monday_item_id) throw new Error(`Aguardando criação da réplica para ${texto}`);
    return String(linhas[0].monday_item_id);
  };
  if (variables.item) variables.item = await resolver(variables.item,
    String(variables.item).startsWith('vybe-subitem:') ? 'vybe_subitens' : 'vybe_conteudos');
  if (variables.pai) variables.pai = await resolver(variables.pai, 'vybe_conteudos');
  if (variables.subitem) variables.subitem = await resolver(variables.subitem, 'vybe_subitens');
  return variables;
}

async function aplicarRetorno(sql, linha, resposta) {
  const referencia = String(linha.referencia || '');
  if (linha.operacao === 'criar_item') {
    const localId = Number(referencia.replace(/^conteudo:/, ''));
    const mondayId = resposta?.create_item?.id;
    if (localId && mondayId) await sql`UPDATE vybe_conteudos SET monday_item_id=${String(mondayId)}, atualizado_em=NOW() WHERE id=${localId}`;
  }
  if (linha.operacao === 'criar_subitem') {
    const localId = Number(referencia.replace(/^subitem:/, ''));
    const mondayId = resposta?.create_subitem?.id;
    if (localId && mondayId) await sql`UPDATE vybe_subitens SET monday_item_id=${String(mondayId)}, atualizado_em=NOW() WHERE id=${localId}`;
  }
}

async function executarLinha(sql, executar, linha) {
  const claim = randomUUID();
  const claimed = await sql`UPDATE vybe_replica_queue
    SET estado='processando', tentativas=tentativas+1, atualizado_em=NOW(), claim_token=${claim}
    WHERE id=${linha.id} AND estado IN ('pendente','falhou') AND proxima_tentativa <= NOW()
      AND NOT EXISTS (SELECT 1 FROM vybe_replica_queue anterior
        WHERE anterior.referencia = ${linha.referencia} AND anterior.id < ${linha.id}
          AND anterior.estado <> 'concluida')
    RETURNING tentativas`;
  if (!claimed.length) return null;
  let enviou = false;
  try {
    const variables = await prepararVariables(sql, linha);
    enviou = true;
    const resposta = await executar(linha.query, variables);
    await aplicarRetorno(sql, linha, resposta);
    await sql`UPDATE vybe_replica_queue SET estado='concluida', ultimo_erro=NULL,
      concluido_em=NOW(), atualizado_em=NOW(), claim_token=NULL WHERE id=${linha.id} AND claim_token=${claim}`;
    return { ok: true, resposta };
  } catch (erro) {
    // Criar item/comentário não é idempotente: uma resposta perdida pode esconder
    // uma criação aceita. Exige conciliação humana antes de repetir e duplicar.
    const incerta = enviou && ['criar_item','criar_subitem','comentario'].includes(linha.operacao);
    const espera = minutosDeEspera(claimed[0].tentativas);
    const mensagem = (incerta ? 'Revisão necessária antes de repetir criação: ' : '') + mensagemErro(erro);
    await sql`UPDATE vybe_replica_queue SET estado='falhou', ultimo_erro=${mensagem}, claim_token=NULL,
      proxima_tentativa=CASE WHEN ${incerta} THEN 'infinity'::timestamptz
        ELSE NOW() + (${espera}::text || ' minutes')::interval END, atualizado_em=NOW()
      WHERE id=${linha.id} AND claim_token=${claim}`;
    return { ok: false, erro: mensagem };
  }
}

export async function processarFilaReplica(sql, executar, { limite = 100, tempoMaxMs = 40000 } = {}) {
  await garantirFilaReplica(sql);
  const inicio = Date.now();
  // A execução anterior pode ter sido encerrada pela plataforma. Só recupera
  // a posse depois de dez minutos; operações de criação ficam para revisão.
  await sql`UPDATE vybe_replica_queue SET estado='falhou', claim_token=NULL,
    ultimo_erro='Execução interrompida; verificar criação antes de repetir quando necessário.',
    proxima_tentativa=CASE WHEN operacao IN ('criar_item','criar_subitem','comentario')
      THEN 'infinity'::timestamptz ELSE NOW() END, atualizado_em=NOW()
    WHERE estado='processando' AND atualizado_em < NOW() - INTERVAL '10 minutes'`;
  const linhas = await sql`SELECT id, operation_key, operacao, referencia, query, variables, tentativas
    FROM vybe_replica_queue
    WHERE estado IN ('pendente','falhou') AND proxima_tentativa <= NOW()
    ORDER BY proxima_tentativa, id
    LIMIT ${Math.max(1, Math.min(Number(limite) || 25, 100))}`;

  const resultado = { encontradas: linhas.length, concluidas: 0, falhas: 0, adiadas: 0 };
  for (const linha of linhas) {
    if (Date.now() - inicio >= tempoMaxMs) { resultado.adiadas += 1; continue; }
    const r = await executarLinha(sql, executar, linha);
    if (r?.ok) resultado.concluidas += 1;
    else if (r) resultado.falhas += 1;
  }
  return resultado;
}

export async function saudeFilaReplica(sql) {
  await garantirFilaReplica(sql);
  const [r] = await sql`SELECT
      COUNT(*) FILTER (WHERE estado IN ('pendente','falhou','processando'))::int AS pendentes,
      COUNT(*) FILTER (WHERE estado='falhou')::int AS falhas,
      COUNT(*) FILTER (WHERE estado='falhou' AND proxima_tentativa='infinity'::timestamptz)::int AS revisao_necessaria,
      COUNT(*) FILTER (WHERE estado='concluida')::int AS concluidas,
      MIN(criado_em) FILTER (WHERE estado IN ('pendente','falhou','processando')) AS mais_antiga
    FROM vybe_replica_queue`;
  return r || { pendentes: 0, falhas: 0, concluidas: 0, mais_antiga: null };
}

export async function listarPendenciasReplica(sql) {
  await garantirFilaReplica(sql);
  return sql`SELECT id, operacao, referencia, estado, tentativas, ultimo_erro,
      proxima_tentativa='infinity'::timestamptz AS revisao_necessaria, criado_em
    FROM vybe_replica_queue WHERE estado <> 'concluida' ORDER BY id LIMIT 50`;
}

export async function retomarReplica(sql, id, confirmado) {
  if (confirmado !== true) throw new Error('Confirme que a operação ainda não foi aplicada no Monday.');
  const linhas = await sql`UPDATE vybe_replica_queue SET proxima_tentativa=NOW(),
      estado='pendente', ultimo_erro='Repetição autorizada por administrador após conferência na origem.', atualizado_em=NOW()
    WHERE id=${Number(id)} AND estado='falhou' RETURNING id`;
  if (!linhas.length) throw new Error('Pendência não encontrada ou ainda em processamento.');
  return linhas[0];
}
