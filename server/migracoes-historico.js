// Séries históricas dos quadros D3 (Paulo, 14/11/2026: "o que o sistema não guarda o dado pode guardar e criar a tabela").
// Uma estrutura só para todo número que os cartões desenham em linha: um valor por dia, por série e por sujeito
// (a agência, uma pessoa, um cliente, um cargo, um agente). Quem grava e quem lê está em server/series-historicas.js.
//
// Aplicada pelo próprio servidor no primeiro uso, no padrão de server/migracoes-irecity.js (garantirMigracoesIrecity).
// Só ADITIVA e idempotente (IF NOT EXISTS): nada de DROP, nada de mudar tipo, nada de reescrever dado existente.
// Registro: migrations/2026-11-14-series-historicas.sql (o mesmo texto).
//
// vybe_serie_diaria
//   dia      — o dia de Irecê a que o valor se refere (série semanal: a segunda da semana; mensal: o dia 1 do mês).
//   serie    — o nome da série (atrasadas, carga, saude, clima, saude_media, score_semana, acerto_agente,
//              carga_cargo, funil_abertas, leads_semana). Minúsculas e sublinhado.
//   sujeito  — de quem é o valor: 'agencia', 'carteira', 'funil', o id da pessoa (vybe_pessoas.id), o id do cliente
//              (vybe_clientes.id), o cargo (criacao, producao…) ou o setor do agente (texto curto).
//   valor    — o número (null = sem dado naquele dia, diferente de zero).
//   extra    — o resto que a tela mostra junto (nome, risco, furos, capacidade…) e `origem`: de onde o valor veio
//              ('calculo_diario', 'snapshot_diario', 'saude_mensal', 'historico_status', 'crm', 'tela_central').
//   gravado_em — quando a linha foi escrita (a gravação do dia sobrescreve a linha de hoje; a do passado não muda).

export const COMANDOS_HISTORICO = [
  `CREATE TABLE IF NOT EXISTS vybe_serie_diaria (
    dia date NOT NULL,
    serie text NOT NULL CHECK (serie ~ '^[a-z_]{1,40}$'),
    sujeito text NOT NULL CHECK (length(sujeito) BETWEEN 1 AND 80),
    valor numeric,
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    gravado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (dia, serie, sujeito)
  )`,
  `CREATE INDEX IF NOT EXISTS vybe_serie_diaria_leitura ON vybe_serie_diaria (serie, sujeito, dia DESC)`,
];

let promessa = null;
export function garantirMigracoesHistorico(sql) {
  if (!promessa) promessa = (async () => {
    const [r] = await sql`SELECT to_regclass('public.vybe_serie_diaria') IS NOT NULL AS ok`;
    if (!r?.ok) for (const cmd of COMANDOS_HISTORICO) await sql.query(cmd);
  })().catch((e) => { promessa = null; throw e; });
  return promessa;
}
export function esquecerMigracoesHistorico() { promessa = null; }
