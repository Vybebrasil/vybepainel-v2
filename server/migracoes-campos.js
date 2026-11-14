// Campos e registros que faltavam para os quadros D3 (Paulo, 14/11/2026: "o que o sistema não guarda o dado pode guardar
// e criar a tabela"). Mesmo padrão de server/migracoes-irecity.js: o servidor aplica no primeiro uso, uma instrução por
// vez via sql.query() (driver HTTP do Neon e PGlite dos testes). Tudo ADITIVO e idempotente: CREATE TABLE/INDEX IF NOT
// EXISTS e ADD COLUMN IF NOT EXISTS; nada de DROP, nada de mudar tipo, nenhum UPDATE em dado que já existe.
// O registro em .sql: migrations/2026-11-14-campos-d3.sql (o mesmo texto, bloco a bloco).
//
// Cada bloco só roda quando a tabela de que ele depende existe (banco parcial, testes com só um pedaço do esquema) e
// não roda de novo quando o último objeto dele já está lá. Falhou (sem permissão, banco fora): tenta de novo depois de
// 10 minutos, sem travar a tela — quem lê usa to_jsonb()/COALESCE e funciona antes e depois da migração.

export const BLOCOS_CAMPOS = Object.freeze([
  { nome: 'orcamentos_aprovado_em', depende: 'vybe_comercial_orcamentos', pronto: ['coluna', 'vybe_comercial_orcamentos', 'aprovado_por'], comandos: [
    // 1. O dia em que o orçamento virou aprovado (status 'aceito'); o passado sai de atualizado_em na leitura.
    `ALTER TABLE vybe_comercial_orcamentos ADD COLUMN IF NOT EXISTS aprovado_em timestamptz`,
    `ALTER TABLE vybe_comercial_orcamentos ADD COLUMN IF NOT EXISTS aprovado_por bigint`,
  ] },
  { nome: 'inadimplencia_avisos', depende: 'vybe_pessoas', pronto: ['tabela', 'vybe_financeiro_avisos'], comandos: [
    // 2. Aviso aos sócios de um cliente em atraso: só registro interno (e o sino do Vybe OS). Nada sai por WhatsApp.
    `CREATE TABLE IF NOT EXISTS vybe_financeiro_avisos (
      id bigserial PRIMARY KEY,
      cliente_id bigint,
      cliente_nome text NOT NULL CHECK (length(trim(cliente_nome)) BETWEEN 1 AND 200),
      nivel smallint NOT NULL CHECK (nivel IN (3, 10, 30)),
      atraso_dias integer CHECK (atraso_dias IS NULL OR atraso_dias BETWEEN 0 AND 10000),
      quem bigint NOT NULL REFERENCES vybe_pessoas(id),
      quem_nome text NOT NULL DEFAULT '',
      para jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(para) = 'array'),
      em timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS vybe_financeiro_avisos_cliente ON vybe_financeiro_avisos (cliente_id, em DESC)`,
    `CREATE INDEX IF NOT EXISTS vybe_financeiro_avisos_em ON vybe_financeiro_avisos (em DESC)`,
  ] },
  { nome: 'recebivel_forma', depende: 'vybe_pessoas', pronto: ['tabela', 'vybe_comercial_recebivel_forma'], comandos: [
    // 3. Forma de pagamento do recebimento, do nosso lado e pelo id do recebimento (vale para o lançado no Vybe OS e
    //    para o que vem do Finanças, "fin:…", que aqui é só leitura).
    `CREATE TABLE IF NOT EXISTS vybe_comercial_recebivel_forma (
      recebivel text PRIMARY KEY CHECK (recebivel ~ '^[A-Za-z0-9:_-]{1,80}$'),
      forma text NOT NULL CHECK (forma IN ('pix','boleto','cartao','transferencia')),
      atualizado_por bigint REFERENCES vybe_pessoas(id),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )`,
  ] },
  // 4. Vencimento da fatura por cartão: vybe_carteira_config, chave 'financeiro_cartoes' (sem migração).
  { nome: 'ia_agente_cliente', depende: 'ai_usage_events', pronto: ['coluna', 'ai_usage_events', 'cliente'], comandos: [
    // 5. Gasto de IA por agente e por cliente, nas gravações novas (jarvis_usage.js logUsageEvent).
    `ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS agente text`,
    `ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS cliente text`,
    `CREATE INDEX IF NOT EXISTS ai_usage_events_agente_idx ON ai_usage_events (agente, created_at DESC)`,
  ] },
  { nome: 'creator_campanhas', depende: 'vybe_comercial_creators', pronto: ['tabela', 'vybe_creator_campanhas'], comandos: [
    // 6. Campanhas dos creators: quem, para qual cliente, de quando a quando e em que pé está.
    `CREATE TABLE IF NOT EXISTS vybe_creator_campanhas (
      id bigserial PRIMARY KEY,
      creator_id bigint NOT NULL REFERENCES vybe_comercial_creators(id),
      cliente_id bigint,
      cliente_nome text NOT NULL CHECK (length(trim(cliente_nome)) BETWEEN 1 AND 200),
      inicio date NOT NULL,
      fim date,
      status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada','ativa','encerrada','cancelada')),
      observacao text NOT NULL DEFAULT '' CHECK (length(observacao) <= 1000),
      criado_por bigint NOT NULL REFERENCES vybe_pessoas(id),
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      CHECK (fim IS NULL OR fim >= inicio)
    )`,
    `CREATE INDEX IF NOT EXISTS vybe_creator_campanhas_creator ON vybe_creator_campanhas (creator_id, inicio DESC)`,
  ] },
  { nome: 'crm_origem', depende: 'vybe_crm_oportunidades', pronto: ['coluna', 'vybe_crm_oportunidades', 'origem'], comandos: [
    // 7. De onde veio a oportunidade, gravado na criação; as antigas são lidas pelo legado/histórico (sem UPDATE).
    `ALTER TABLE vybe_crm_oportunidades ADD COLUMN IF NOT EXISTS origem text CHECK (origem IS NULL OR origem IN ('sdr','manual','formulario'))`,
  ] },
  { nome: 'minha_sala', depende: 'vybe_pessoas', pronto: ['tabela', 'vybe_sala_focos'], comandos: [
    // 8. Minha sala: a cor da sala de cada pessoa e o cronômetro de foco (um aberto por pessoa).
    `CREATE TABLE IF NOT EXISTS vybe_sala_preferencias (
      pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
      cor text CHECK (cor IS NULL OR cor ~ '^#[0-9a-f]{6}$'),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS vybe_sala_focos (
      id bigserial PRIMARY KEY,
      pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
      inicio timestamptz NOT NULL DEFAULT now(),
      fim timestamptz,
      item text NOT NULL DEFAULT '' CHECK (length(item) <= 80),
      rotulo text NOT NULL DEFAULT '' CHECK (length(rotulo) <= 200),
      CHECK (fim IS NULL OR fim >= inicio)
    )`,
    `CREATE INDEX IF NOT EXISTS vybe_sala_focos_pessoa ON vybe_sala_focos (pessoa_id, inicio DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS vybe_sala_focos_um_aberto ON vybe_sala_focos (pessoa_id) WHERE fim IS NULL`,
  ] },
  { nome: 'peca_complemento', depende: 'vybe_pessoas', pronto: ['tabela', 'vybe_peca_complemento'], comandos: [
    // 9. Hora de publicação da peça: o Monday não tem o campo, então fica do nosso lado, pelo id da peça no painel.
    `CREATE TABLE IF NOT EXISTS vybe_peca_complemento (
      item text PRIMARY KEY CHECK (item ~ '^(vybe:)?[0-9]{1,20}$'),
      publicar_hora time,
      atualizado_por bigint REFERENCES vybe_pessoas(id),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )`,
  ] },
  // 10. Meta da carteira (nota) e meta de acerto dos agentes: vybe_carteira_config, chaves 'meta_carteira' e
  //     'meta_acerto_agentes' (a mesma de server/series-historicas.js), sem migração.
]);

async function existe(sql, [tipo, tabela, coluna]) {
  if (tipo === 'tabela') { const [r] = await sql`SELECT (to_regclass(${'public.' + tabela}) IS NOT NULL) AS ok`; return Boolean(r?.ok); }
  const [r] = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ${tabela} AND column_name = ${coluna}) AS ok`;
  return Boolean(r?.ok);
}

const feitos = new Set();
let promessa = null, falha = 0;
export function garantirMigracoesCampos(sql) {
  if (promessa && falha && Date.now() - falha > 10 * 60e3) { promessa = null; falha = 0; }
  if (!promessa) promessa = (async () => {
    for (const b of BLOCOS_CAMPOS) {
      if (feitos.has(b.nome)) continue;
      try {
        if (!(await existe(sql, ['tabela', b.depende]))) continue; // a base dele ainda não está: tenta na próxima vez
        if (!(await existe(sql, b.pronto))) for (const cmd of b.comandos) await sql.query(cmd);
        feitos.add(b.nome);
      } catch (e) { falha = Date.now(); console.error(`[migracoes-campos] ${b.nome} aguardando:`, e?.message || e); }
    }
    // Algum bloco esperou a base: a próxima chamada confere de novo (barato: duas consultas de catálogo por bloco).
    if (feitos.size < BLOCOS_CAMPOS.length && !falha) promessa = null;
  })();
  return promessa;
}
export function esquecerMigracoesCampos() { promessa = null; falha = 0; feitos.clear(); }
