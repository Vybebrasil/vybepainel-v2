// O questionário do onboarding alimenta o ecossistema (Paulo, 09/11/2026: "um ecossistema, não vários sistemas").
// O que o cliente responde uma vez (vybe_clientes.onboarding_respostas, server/reunioes.js) passa a ser lido por:
//  - a memória do cliente do VYBES (assistente-memoria.js);
//  - o Augusto, no contexto de copy (copy-cliente.js fichaParaCopy);
//  - os chats do Claude, na ferramenta consultar_cliente (mcp-ecossistema.js);
//  - e o "O que nunca fazer" vira regra do cliente (vybe_ai_regras_cliente), que a memória, as legendas e a revisão de
//    arte (Danilo) já leem.
// Somente formatação e leitura; o texto é do cliente, então é dado, nunca instrução.

export const ROTULOS_ONBOARDING = Object.freeze([
  ['publico', 'Cliente ideal'], ['produtos', 'Produtos e carro-chefe'], ['diferenciais', 'Diferenciais'],
  ['tom', 'Como a marca fala'], ['nao_fazer', 'O que nunca fazer'], ['referencias', 'Referências que admira'],
  ['objetivos', 'O que espera da Vybe'], ['sazonalidade', 'Datas importantes'], ['aprovacao', 'Quem aprova e como'],
  ['concorrentes', 'Concorrentes'], ['historia', 'História'],
  ['forcas', 'Forças'], ['fraquezas', 'Fraquezas'], ['oportunidades', 'Oportunidades'], ['ameacas', 'Ameaças'],
]);
// O que muda o texto de uma legenda (o resto, como SWOT e quem aprova, fica na memória e no chat).
export const CHAVES_COPY = Object.freeze(['publico', 'produtos', 'diferenciais', 'tom', 'nao_fazer', 'referencias', 'sazonalidade', 'objetivos']);

const curto = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const lerJson = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(String(v || '{}')) || {}; } catch { return {}; } };

// [['Cliente ideal', 'mulheres de 25 a 35…'], …] na ordem acima, só o que foi respondido.
export function respostasEmPares(respostas, { chaves = null, n = 300 } = {}) {
  const r = lerJson(respostas);
  return ROTULOS_ONBOARDING.filter(([k]) => !chaves || chaves.includes(k)).map(([k, rot]) => [rot, curto(r[k], n)]).filter(([, v]) => v);
}
export const respostasEmLinhas = (respostas, opcoes) => respostasEmPares(respostas, opcoes).map(([r, v]) => `- ${r}: ${v}`);

// Respostas do cliente, ou {} sem a coluna (banco antigo ou de teste).
export async function respostasDoCliente(sql, clienteId) {
  try {
    const [c] = await sql`SELECT onboarding_respostas FROM vybe_clientes WHERE id = ${Number(clienteId)}`;
    return lerJson(c?.onboarding_respostas);
  } catch { return {}; }
}

// "O que nunca fazer": uma regra por linha (ou por ponto e vírgula), como as regras de marca dos chats.
export function regrasDoNaoFazer(texto) {
  return String(texto || '').split(/\r?\n|;/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length >= 4).slice(0, 12).map((l) => `Nunca: ${l.slice(0, 290)}`);
}

// ── Checklist que se marca sozinho ─────────────────────────────────────────────
// Quando o sistema já sabe que algo foi feito, a esteira marca o item (Paulo, 09/11/2026: "tá completo? falta algo?"):
//  questionário respondido → Kickoff · Briefing e tom de voz; acessos recebidos → Acessos · Logins guardados;
//  reunião de kickoff gravada ou com ata → Kickoff · Reunião feita (e Ata do kickoff, com ata).
// Só em onboarding aberto, só item que existe nas etapas configuradas e só o que ainda não estava marcado. Quem marcou
// fica "Vybe OS (automático)". Sem as tabelas da carteira, não faz nada.
export const POR_SISTEMA = 'Vybe OS (automático)';
export async function marcarNaEsteira(sql, clienteId, marcas = [], { agora = new Date() } = {}) {
  if (!marcas.length) return 0;
  try {
    const { etapasConfiguradas } = await import('./carteira.js');
    const [o] = await sql`SELECT etapas FROM vybe_cliente_onboarding WHERE cliente_id = ${Number(clienteId)} AND encerrado_em IS NULL`;
    if (!o) return 0;
    const { etapas } = await etapasConfiguradas(sql);
    const atual = lerJson(o.etapas);
    let n = 0;
    for (const [eid, iid] of marcas) {
      const etapa = etapas.find((e) => e.id === eid);
      if (!etapa || !etapa.itens.some((i) => i.id === iid)) continue;
      const dela = { responsavel_id: null, feitos: {}, ...(atual[eid] || {}) };
      if (dela.feitos?.[iid]) continue;
      dela.feitos = { ...(dela.feitos || {}), [iid]: { em: agora.toISOString(), por: POR_SISTEMA, auto: true } };
      dela.atualizado_em = agora.toISOString();
      atual[eid] = dela;
      n++;
    }
    if (n) await sql`UPDATE vybe_cliente_onboarding SET etapas = ${JSON.stringify(atual)}::jsonb, atualizado_em = now() WHERE cliente_id = ${Number(clienteId)}`;
    return n;
  } catch { return 0; }
}

// "O que nunca fazer" do questionário vira regra do cliente (a mesma tabela das regras de marca dos chats).
export async function regrasDoQuestionario(sql, clienteId, naoFazer) {
  const regras = regrasDoNaoFazer(naoFazer);
  if (!regras.length) return 0;
  try {
    const { tabelaRegras } = await import('./assistente-regras.js');
    await tabelaRegras(sql);
    let novas = 0;
    for (const texto of regras) {
      const [ja] = await sql`SELECT 1 AS ok FROM vybe_ai_regras_cliente WHERE cliente_id = ${Number(clienteId)} AND removida_em IS NULL AND LOWER(texto) = LOWER(${texto}) LIMIT 1`;
      if (ja) continue;
      await sql`INSERT INTO vybe_ai_regras_cliente (cliente_id, texto) VALUES (${Number(clienteId)}, ${texto})`;
      novas++;
    }
    return novas;
  } catch { return 0; }
}
