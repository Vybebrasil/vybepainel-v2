// server/impressoes.js — Impressões com módulo próprio (Paulo, 09/11/2026).
//
//   GET  /api/painel?area=impressoes            lista, etapas, clientes, fornecedores, equipe, resumo e por fornecedor,
//                                               regras do Nestor e os impressos que aguardam o Nestor
//   POST /api/painel?area=impressoes  { acao }  impressao_salvar | impressao_etapa | cotacao_salvar | cotacao_escolher (gestão)
//                                               | regra_salvar | regra_remover (donos)
//
// Antes, impresso era só uma demanda em Solicitações com o status "Em impressão": sem fornecedor, sem dia do pedido e
// sem saber em que ponto estava. Agora cada impressão tem cliente (cadastro ativo), projeto ou campanha, a arte na
// esteira (a demanda das Solicitações), fornecedor, material, quantidade, especificação, arquivo e responsável, e
// anda por etapas datadas (vybe_impressao_eventos guarda de onde, para onde, quem e quando).
//
// Regras (decididas aqui; a tela só reflete):
//  - Toda a equipe vê, cadastra e move as etapas. Valor só sai e só é gravado pela gestão (donos e administração).
//  - Impressão nova de cliente sem arte ligada abre a arte na esteira (Solicitações, formato Impresso), pelo mesmo
//    cadastro do painel. Quando a arte chega ao fim (ou é aprovada) na esteira, a impressão passa de "Arte" para
//    "Orçamento" sozinha.
//  - Mandar o arquivo, imprimir, ficar pronto ou entregar pede fornecedor. O primeiro envio grava o dia do pedido;
//    "Entregue" grava o dia da entrega. Atrasada = previsão vencida e ainda não entregue.
import { ehDonoPessoa } from './donos.js';
import { nomeDoAgente, rotuloDoAgente } from './conta-vybes.js';
// Registro feito pela conta do VYBES: quem aparece é o agente que assina a nota ("Nestor, pela conversa com…" vira
// "Nestor · VYBES"; Paulo, 19/11/2026: "os comentários dos agentes vão como eles"). Sem assinatura válida, "VYBES".
const ASSINA_NOTA = /^([\p{L}]+(?:[ -][\p{L}]+)*),/u;
export const autorDoEvento = ({ autor_servico: servico, ...e }) => (servico ? { ...e, autor_nome: rotuloDoAgente(nomeDoAgente(ASSINA_NOTA.exec(String(e.nota || ''))?.[1] || ''), e.autor_nome) } : e);
// Valor da impressão e cotações são dinheiro: só os quatro donos (auditoria 15/11/2026; antes ehGestao, que inclui a coordenação).
const ehGestao = (pessoa) => ehDonoPessoa(pessoa);

export const ETAPAS = Object.freeze([
  ['arte', 'Arte'], ['orcamento', 'Orçamento'], ['aprovado', 'Aprovado pelo cliente'], ['arquivo_enviado', 'Arquivo enviado'],
  ['em_impressao', 'Em impressão'], ['pronto', 'Pronto para retirada'], ['entregue', 'Entregue'], ['cancelado', 'Cancelado'],
]);
const CHAVES = new Set(ETAPAS.map(([k]) => k));
const COM_FORNECEDOR = new Set(['arquivo_enviado', 'em_impressao', 'pronto', 'entregue']);
const FECHADAS = new Set(['entregue', 'cancelado']);
const BOARD_SOLICITACOES = 8385559107;

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const texto = (v, max, campo, obrigatorio = false) => {
  if (v != null && typeof v !== 'string') falhar(`${campo} inválido.`);
  const s = (v || '').trim();
  if (s.length > max) falhar(`${campo}: máximo de ${max} caracteres.`);
  if (obrigatorio && !s) falhar(`Informe ${campo.toLowerCase()}.`);
  return s;
};
const idValido = (v, campo = 'ID') => { const s = String(v ?? ''); if (!/^[1-9]\d{0,15}$/.test(s) || !Number.isSafeInteger(Number(s))) falhar(`${campo} inválido.`); return s; };
const idOuNulo = (v, campo) => (v == null || v === '' ? null : idValido(v, campo));
const dataOuNula = (v, campo) => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + 'T12:00:00Z'))) falhar(`${campo}: data inválida.`);
  return v;
};
const hojeBahia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(agora);
const semTabela = (e) => e?.code === '42P01';

let criarPeca = null;
export function usarCriacaoDePeca(f) { criarPeca = f; } // só para os testes

const CLIENTE_ATIVO = (sql, id) => sql`SELECT id::text AS id, nome FROM vybe_clientes
  WHERE id = ${id} AND apagado_em IS NULL AND (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false))`;

// A arte terminou (status final) ou foi aprovada na esteira: a impressão sai de "Arte" para "Orçamento".
async function andarComAArte(sql) {
  await sql`WITH prontas AS (
      UPDATE vybe_impressoes i SET etapa = 'orcamento', atualizado_em = now()
        FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
       WHERE i.conteudo_id = c.id AND i.etapa = 'arte' AND c.removido_em IS NULL
         AND (COALESCE(s.final, false) OR c.status_chave IN ('aprovado', 'para_orcar', 'em_orcamento', 'em_impressao'))
      RETURNING i.id)
    INSERT INTO vybe_impressao_eventos (impressao_id, de, para, nota) SELECT id, 'arte', 'orcamento', 'Arte concluída na esteira' FROM prontas`;
}

async function ler(sql, pessoa, query = {}) {
  const hoje = hojeBahia(), gestao = ehGestao(pessoa), todas = String(query.todas || '') === '1';
  // ?leitura=1 (relatório técnico, Paulo 26/11/2026): só lê; a arte concluída anda para Orçamento quando a tela abre.
  if (String(query.leitura || '') !== '1') await andarComAArte(sql);
  const linhas = await sql`SELECT i.id::text, i.titulo, i.cliente_id::text, cl.nome AS cliente_nome, i.projeto_id::text, pj.nome AS projeto_nome,
      i.conteudo_id::text, s.rotulo AS demanda_status, COALESCE(s.final, false) AS demanda_final,
      i.fornecedor_id::text, f.nome AS fornecedor_nome, i.material, i.quantidade, i.especificacao, i.arquivo_url, i.etapa,
      i.responsavel::text, p.nome AS responsavel_nome, i.pedido_em::text, i.previsao::text, i.entregue_em::text,
      i.valor::float8 AS valor, i.observacao, i.criado_em, i.atualizado_em
    FROM vybe_impressoes i
      LEFT JOIN vybe_clientes cl ON cl.id = i.cliente_id
      LEFT JOIN vybe_projetos pj ON pj.id = i.projeto_id
      LEFT JOIN vybe_conteudos c ON c.id = i.conteudo_id AND c.removido_em IS NULL
      LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
      LEFT JOIN vybe_comercial_fornecedores f ON f.id = i.fornecedor_id
      LEFT JOIN vybe_pessoas p ON p.id = i.responsavel
    -- Fechadas só dos últimos 90 dias; ?todas=1 traz o histórico inteiro (as impressas antigas das Solicitações).
    WHERE ${todas} OR i.etapa NOT IN ('entregue', 'cancelado') OR COALESCE(i.entregue_em, i.atualizado_em::date) >= (now() - interval '90 days')::date
    ORDER BY (i.etapa IN ('entregue', 'cancelado')), i.previsao NULLS LAST, i.id`;
  const ids = linhas.map((l) => l.id);
  const eventos = ids.length ? (await sql`SELECT e.impressao_id::text AS impressao_id, e.de, e.para, e.nota, p.nome AS autor_nome, e.em,
        COALESCE((to_jsonb(p) ->> 'servico') = 'true', false) AS autor_servico
      FROM vybe_impressao_eventos e LEFT JOIN vybe_pessoas p ON p.id = e.autor_id
     WHERE e.impressao_id::text = ANY(${ids}::text[]) ORDER BY e.em, e.id`).map(autorDoEvento) : [];
  const porImpressao = new Map();
  for (const e of eventos) (porImpressao.get(e.impressao_id) || porImpressao.set(e.impressao_id, []).get(e.impressao_id)).push(e);
  const impressoes = linhas.map((l) => {
    const { valor, ...resto } = l;
    const atrasada = !FECHADAS.has(l.etapa) && Boolean(l.previsao) && l.previsao < hoje;
    return { ...resto, ...(gestao ? { valor } : {}), atrasada, eventos: porImpressao.get(l.id) || [] };
  });
  const [clientes, fornecedores, pessoas, projetos] = await Promise.all([
    sql`SELECT id::text, nome FROM vybe_clientes WHERE apagado_em IS NULL AND (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false)) ORDER BY nome`,
    fornecedoresAtivos(sql),
    sql`SELECT id::text, nome FROM vybe_pessoas WHERE ativo AND pode_entrar ORDER BY nome`,
    Promise.resolve(sql`SELECT id::text, nome, cliente_id::text FROM vybe_projetos WHERE status NOT IN ('concluido','cancelado') ORDER BY inicio DESC, id DESC`).catch(() => []),
  ]);
  // Histórico de cada fornecedor em TODAS as impressões (não só as da tela): base do ranking da cotação.
  const historico = await sql`SELECT fornecedor_id::text AS fornecedor_id, COUNT(*) FILTER (WHERE etapa = 'entregue')::int AS entregues,
      COUNT(*) FILTER (WHERE etapa = 'entregue' AND previsao IS NOT NULL AND entregue_em IS NOT NULL AND entregue_em <= previsao)::int AS no_prazo,
      COUNT(*) FILTER (WHERE etapa = 'entregue' AND previsao IS NOT NULL AND entregue_em IS NOT NULL)::int AS com_previsao,
      ROUND(AVG(entregue_em - pedido_em) FILTER (WHERE etapa = 'entregue' AND pedido_em IS NOT NULL AND entregue_em IS NOT NULL))::int AS prazo_medio_dias
    FROM vybe_impressoes WHERE fornecedor_id IS NOT NULL GROUP BY fornecedor_id`;
  const ranking = rankingFornecedores(fornecedores, historico);
  // Cotações: só os donos veem (têm valor). Quem está antes da gráfica sem fornecedor recebe a sugestão de para quem pedir.
  const cotacoes = gestao && ids.length ? await sql`SELECT k.id::text, k.impressao_id::text, k.fornecedor_id::text, f.nome AS fornecedor_nome,
      k.valor::float8 AS valor, k.prazo_dias, k.observacao, k.escolhida, k.criado_em
    FROM vybe_impressao_cotacoes k JOIN vybe_comercial_fornecedores f ON f.id = k.fornecedor_id
    WHERE k.impressao_id::text = ANY(${ids}::text[]) ORDER BY k.valor, k.prazo_dias NULLS LAST` : [];
  const cotacoesDe = new Map();
  for (const k of cotacoes) (cotacoesDe.get(k.impressao_id) || cotacoesDe.set(k.impressao_id, []).get(k.impressao_id)).push(k);
  for (const i of impressoes) {
    if (gestao) i.cotacoes = cotacoesDe.get(i.id) || [];
    if (['arte', 'orcamento', 'aprovado'].includes(i.etapa) && !i.fornecedor_id) i.sugestao = ranking.slice(0, 3);
  }
  // Regras do Nestor e os impressos que esperam por ele (Paulo, 19/11/2026). regras = null: a tabela ainda não existe.
  const regras = await lerRegras(sql);
  const aguardando = (await impressosAguardando(sql)).map((p) => ({ ...p, proposta: propostaDoImpresso(p, regraDoImpresso(regras || [], p), hoje) }));
  return { hoje, gestao, todas, etapas: ETAPAS.map(([id, nome]) => ({ id, nome })), impressoes, clientes, fornecedores, pessoas, projetos,
    resumo: resumir(impressoes), porFornecedor: porFornecedor(impressoes, fornecedores), ranking,
    regras: regras || [], regras_ligadas: regras !== null, aguardando };
}

// Fornecedor com cidade, UF e telefone (bloco 9 da migração); sem as colunas ainda, segue sem elas.
async function fornecedoresAtivos(sql) {
  try {
    return await sql`SELECT id::text, nome, categoria, cidade, uf, telefone FROM vybe_comercial_fornecedores WHERE ativo ORDER BY (categoria <> 'grafica'), nome`;
  } catch (e) {
    if (e?.code !== '42703') throw e;
    return sql`SELECT id::text, nome, categoria, '' AS cidade, '' AS uf, '' AS telefone FROM vybe_comercial_fornecedores WHERE ativo ORDER BY (categoria <> 'grafica'), nome`;
  }
}

// Para quem pedir orçamento: gráficas primeiro; perto (Irecê) antes de longe; quem já entregou, no prazo e rápido, antes.
// Sem histórico ainda, entra depois de quem já provou, com o motivo dizendo isso.
const semAcento = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function rankingFornecedores(fornecedores = [], historico = [], { cidade = 'Irecê' } = {}) {
  const h = new Map(historico.map((x) => [String(x.fornecedor_id), x]));
  const aqui = semAcento(cidade);
  return fornecedores.map((f) => {
    const x = h.get(String(f.id)) || {};
    const pontual = x.com_previsao ? x.no_prazo / x.com_previsao : null;
    const local = semAcento(f.cidade) === aqui;
    const partes = [f.cidade ? `${f.cidade}${f.uf ? '/' + f.uf : ''}` : 'cidade não cadastrada'];
    if (x.entregues) partes.push(`${x.entregues} ${x.entregues === 1 ? 'entrega' : 'entregas'}`);
    if (pontual != null) partes.push(`${Math.round(pontual * 100)}% no prazo`);
    if (x.prazo_medio_dias != null) partes.push(`${x.prazo_medio_dias} ${x.prazo_medio_dias === 1 ? 'dia' : 'dias'} em média`);
    if (!x.entregues) partes.push('sem histórico ainda');
    return { fornecedor_id: String(f.id), nome: f.nome, categoria: f.categoria, cidade: f.cidade || '', telefone: f.telefone || '', local,
      entregues: x.entregues || 0, pontualidade: pontual, prazo_medio_dias: x.prazo_medio_dias ?? null, motivo: partes.join(' · ') };
  }).sort((a, b) => (Number(b.categoria === 'grafica') - Number(a.categoria === 'grafica')) || (Number(b.local) - Number(a.local))
    || (Number(b.entregues > 0) - Number(a.entregues > 0)) || ((b.pontualidade ?? 0) - (a.pontualidade ?? 0))
    || ((a.prazo_medio_dias ?? 999) - (b.prazo_medio_dias ?? 999)) || (b.entregues - a.entregues) || a.nome.localeCompare(b.nome));
}

// Texto do pedido de orçamento que o agente de Compras prepara para alguém da equipe mandar ao fornecedor (o agente não
// manda nada: falar com fornecedor é falar em nome da Vybe, sempre com aprovação de gente).
export function pedidoDeCotacao(i, fornecedor = null) {
  const linhas = [`Olá${fornecedor?.nome ? ', ' + fornecedor.nome : ''}! Aqui é da Vybe. Pode passar um orçamento para:`, '', `• ${i.titulo}`];
  if (i.material) linhas.push(`• Material: ${i.material}`);
  if (i.quantidade) linhas.push(`• Quantidade: ${i.quantidade}`);
  if (i.especificacao) linhas.push(`• Especificação: ${i.especificacao}`);
  if (i.previsao) linhas.push(`• Precisamos até ${i.previsao.slice(8, 10)}/${i.previsao.slice(5, 7)}`);
  linhas.push('', 'Com o valor e o prazo de entrega, por favor. Obrigado!');
  return linhas.join('\n');
}

// Leitura para o agente (consulta 'impressoes' do assistente, só no privado da administração): o que está aberto, a
// quem pedir e o texto do pedido, a base de fornecedores com o que falta e o histórico de cada um.
export async function impressoesParaAgente(sql) {
  const r = await ler(sql, { id: 0, admin: true });
  const abertas = r.impressoes.filter((i) => !FECHADAS.has(i.etapa));
  return {
    hoje: r.hoje, resumo: r.resumo, ranking: r.ranking, porFornecedor: r.porFornecedor,
    abertas: abertas.map((i) => ({ id: i.id, titulo: i.titulo, cliente: i.cliente_nome || '', etapa: i.etapa, fornecedor: i.fornecedor_nome || '',
      previsao: i.previsao, atrasada: i.atrasada, pedido_em: i.pedido_em, cotacoes: (i.cotacoes || []).length,
      sugestao: (i.sugestao || []).map((s) => ({ nome: s.nome, telefone: s.telefone, motivo: s.motivo })),
      pedido: !i.fornecedor_id && ['orcamento', 'aprovado'].includes(i.etapa) ? pedidoDeCotacao(i, i.sugestao?.[0]) : '' })),
    fornecedores: r.fornecedores.map((f) => ({ id: f.id, nome: f.nome, categoria: f.categoria, cidade: f.cidade, uf: f.uf, telefone: f.telefone,
      falta: [!f.cidade && 'cidade', !f.telefone && 'telefone'].filter(Boolean) })),
    // Impressos sem responsável que esperam o Nestor, cada um com a proposta da regra que casou (null: falta regra).
    regras_ligadas: r.regras_ligadas,
    regras: r.regras.filter((x) => x.ativa).map((x) => ({ id: x.id, nome: x.nome, palavras: x.palavras || [], responsavel: x.responsavel_nome || '',
      prazo_dias: x.prazo_dias, fornecedor: x.fornecedor_nome || '' })),
    aguardando: r.aguardando.map((p) => ({ conteudo_id: p.conteudo_id, titulo: p.titulo, cliente: p.cliente || '', status: p.status || '', prazo: p.prazo,
      veiculacao: p.veiculacao, impressao_id: p.impressao_id, proposta: p.proposta })),
  };
}

// ── Regras de Impressos do Nestor (Paulo, 19/11/2026: "impresso: quem vai ditar as regras é o Nestor") ──────────────
// Impresso que nasce sem responsável NÃO cai na regra geral de Design & Edição (vybe-perfis.js cadastrosDestiny): fica
// "aguardando o Nestor". Aguardando = formato Impresso, aberto (status não final), sem ninguém em vybe_conteudo_responsaveis
// e sem a impressão cancelada. Não há coluna nova: sai do próprio estado da peça, então vale também para as antigas.
// As regras (vybe_impressao_regras, migrations/2026-11-19-impressao-regras.sql) são dos donos; o Nestor consulta, propõe
// e, pelo caminho dos agentes no bot (porta; em sombra, só com o "sim" de um dono), aplica com definirPeloAgente.
export const ehImpresso = (formato) => /impresso/i.test(String(formato || ''));

async function lerRegras(sql) {
  try {
    return await sql`SELECT r.id::text AS id, r.nome, r.palavras, r.responsavel::text AS responsavel, p.nome AS responsavel_nome, r.prazo_dias,
        r.fornecedor_id::text AS fornecedor_id, f.nome AS fornecedor_nome, r.observacao, r.ordem, r.ativa, r.alterado_em
      FROM vybe_impressao_regras r LEFT JOIN vybe_pessoas p ON p.id = r.responsavel LEFT JOIN vybe_comercial_fornecedores f ON f.id = r.fornecedor_id
      ORDER BY r.ordem, r.id`;
  } catch (e) { if (semTabela(e)) return null; throw e; }
}

async function impressosAguardando(sql) {
  return sql`SELECT c.id::text AS conteudo_id, c.titulo, c.formato, c.briefing, c.prazo::text AS prazo, c.veiculacao::text AS veiculacao, s.rotulo AS status,
      (SELECT cl.nome FROM vybe_conteudo_clientes v JOIN vybe_clientes cl ON cl.id = v.cliente_id WHERE v.conteudo_id = c.id ORDER BY cl.nome LIMIT 1) AS cliente,
      i.id::text AS impressao_id, i.material
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
      LEFT JOIN vybe_impressoes i ON i.conteudo_id = c.id
    WHERE c.removido_em IS NULL AND c.formato ILIKE '%impresso%' AND NOT COALESCE(s.final, false) AND COALESCE(i.etapa, '') <> 'cancelado'
      AND NOT EXISTS (SELECT 1 FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id = c.id)
    ORDER BY c.prazo NULLS LAST, c.id LIMIT 200`;
}

// Qual regra vale para a peça: a primeira ativa (pela ordem) com uma palavra que aparece no título, material ou briefing;
// sem nenhuma, a regra padrão (sem palavras). Nenhuma: null (o Nestor avisa que falta regra, não inventa).
export function regraDoImpresso(regras = [], peca = {}) {
  const texto = ` ${normal([peca.titulo, peca.material, peca.briefing].filter(Boolean).join(' '))} `;
  const ativas = (regras || []).filter((r) => r && r.ativa !== false);
  const palavrasDe = (r) => (r.palavras || []).map(normal).filter(Boolean);
  return ativas.find((r) => palavrasDe(r).some((p) => texto.includes(` ${p} `))) || ativas.find((r) => !palavrasDe(r).length) || null;
}

// O que o Nestor propõe pela regra. O prazo conta a partir de hoje e nunca passa da veiculação; peça que já tem prazo
// fica com o dela (quem pôs manda).
export function propostaDoImpresso(peca = {}, regra = null, hoje = hojeBahia()) {
  if (!regra) return null;
  let prazo = null;
  if (!peca.prazo && regra.prazo_dias != null) {
    prazo = somarDias(hoje, Number(regra.prazo_dias));
    if (peca.veiculacao && prazo > peca.veiculacao) prazo = peca.veiculacao;
  }
  return { regra_id: regra.id, regra: regra.nome, responsavel: regra.responsavel_nome || '', prazo, prazo_dias: regra.prazo_dias ?? null,
    fornecedor: regra.fornecedor_nome || '', observacao: regra.observacao || '' };
}

async function salvarRegra(sql, pessoa, b) {
  if (!ehGestao(pessoa)) falhar('As regras de Impressos são dos donos; quem aplica é o Nestor.', 403);
  const id = idOuNulo(b.id, 'Regra');
  const nome = texto(b.nome, 120, 'Nome da regra', true), observacao = texto(b.observacao, 500, 'Observação');
  const palavras = [...new Set((Array.isArray(b.palavras) ? b.palavras : String(b.palavras || '').split(','))
    .map((p) => String(p ?? '').trim()).filter(Boolean))];
  if (palavras.length > 20 || palavras.some((p) => p.length > 60)) falhar('Palavras: até 20, com até 60 letras cada.');
  const responsavel = idOuNulo(b.responsavel, 'Responsável'), fornecedor = idOuNulo(b.fornecedor_id, 'Gráfica');
  const prazo = b.prazo_dias == null || b.prazo_dias === '' ? null : Number(b.prazo_dias);
  if (prazo != null && (!Number.isInteger(prazo) || prazo < 0 || prazo > 120)) falhar('Prazo em dias, de 0 a 120.');
  const ordem = b.ordem == null || b.ordem === '' ? 100 : Number(b.ordem);
  if (!Number.isInteger(ordem) || ordem < 0 || ordem > 10000) falhar('Ordem: um número de 0 a 10000.');
  const ativa = b.ativa !== false && b.ativa !== 'false';
  if (!responsavel && prazo == null && !fornecedor) falhar('A regra precisa dizer quem faz, o prazo ou a gráfica.');
  return semRegras(sql.comTransacao(async (tx) => {
    if (responsavel && !(await tx`SELECT 1 FROM vybe_pessoas WHERE id = ${responsavel} AND ativo AND pode_entrar`).length) falhar('Responsável indisponível.');
    if (fornecedor && !(await tx`SELECT 1 FROM vybe_comercial_fornecedores WHERE id = ${fornecedor} AND ativo`).length) falhar('Escolha uma gráfica ativa.');
    if (id) {
      const [r] = await tx`UPDATE vybe_impressao_regras SET nome = ${nome}, palavras = ${palavras}::text[], responsavel = ${responsavel}, prazo_dias = ${prazo},
          fornecedor_id = ${fornecedor}, observacao = ${observacao}, ordem = ${ordem}, ativa = ${ativa}, alterado_em = now() WHERE id = ${id} RETURNING id::text AS id`;
      if (!r) falhar('Regra não encontrada.', 404);
      return { id: r.id };
    }
    const [r] = await tx`INSERT INTO vybe_impressao_regras (nome, palavras, responsavel, prazo_dias, fornecedor_id, observacao, ordem, ativa, criado_por)
      VALUES (${nome}, ${palavras}::text[], ${responsavel}, ${prazo}, ${fornecedor}, ${observacao}, ${ordem}, ${ativa}, ${String(pessoa.id)}) RETURNING id::text AS id`;
    return { id: r.id };
  }));
}

async function removerRegra(sql, pessoa, b) {
  if (!ehGestao(pessoa)) falhar('As regras de Impressos são dos donos; quem aplica é o Nestor.', 403);
  const id = idValido(b.id, 'Regra');
  const [r] = await semRegras(sql`DELETE FROM vybe_impressao_regras WHERE id = ${id} RETURNING id::text AS id`);
  if (!r) falhar('Regra não encontrada.', 404);
  return { id: r.id };
}
// Sem a migração aplicada, gravar regra diz isso (e não o aviso genérico de Impressões).
const semRegras = (p) => Promise.resolve(p).catch((e) => {
  if (semTabela(e)) falhar('As regras do Nestor ainda não estão no banco (migrations/2026-11-19-impressao-regras.sql).', 503);
  throw e;
});

// O Nestor aplica a regra num impresso que espera por ele (consulta 'impressao_definir' do assistente; no bot, sai pela
// porta dos agentes: em sombra, só depois do "sim" de um dono). Nunca passa por cima de gente:
// - a peça precisa ser Impresso e estar SEM responsável (alguém já pôs: recusa, quem definiu manda);
// - o prazo só entra se a peça ainda não tem; a gráfica só entra na impressão ligada que ainda não tem.
// Cada mudança fica no histórico da peça (e da impressão) com a assinatura "Nestor, pela regra …".
export async function definirPeloAgente(sql, pessoaId, b = {}) {
  const autor = idValido(pessoaId, 'Pessoa'), conteudo = idValido(b.conteudo_id, 'Peça');
  const nomeResp = texto(b.responsavel, 120, 'Responsável', true), nomeForn = texto(b.fornecedor, 120, 'Gráfica');
  const prazo = dataOuNula(b.prazo, 'Prazo'), regra = texto(b.regra, 120, 'Regra');
  const assina = `Nestor, ${regra ? `pela regra “${regra}”` : 'pelas regras de Impressos'}`.slice(0, 200);
  const rodar = (f) => (sql.comTransacao ? sql.comTransacao(f) : f(sql));
  return rodar(async (tx) => {
    const [c] = await tx`SELECT id::text AS id, titulo, formato, prazo::text AS prazo FROM vybe_conteudos WHERE id = ${conteudo} AND removido_em IS NULL FOR UPDATE`;
    if (!c) falhar('Peça não encontrada.', 404);
    if (!ehImpresso(c.formato)) falhar('Essa peça não é Impresso: a regra do Nestor vale só para Impressos.', 409);
    const ja = await tx`SELECT p.nome FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = ${conteudo}`;
    if (ja.length) falhar(`A peça já tem responsável (${ja.map((x) => x.nome).join(', ')}): quem definiu manda.`, 409);
    const pessoas = await tx`SELECT id::text AS id, nome FROM vybe_pessoas WHERE ativo AND pode_entrar`;
    const inteiro = pessoas.filter((p) => normal(p.nome) === normal(nomeResp));
    const candidatos = inteiro.length ? inteiro : pessoas.filter((p) => normal(p.nome).split(' ')[0] === normal(nomeResp).split(' ')[0]);
    if (candidatos.length !== 1) falhar(candidatos.length ? `Mais de uma pessoa chamada ${nomeResp}: a regra precisa do nome inteiro.` : `${nomeResp} não está ativo na equipe.`);
    const resp = candidatos[0];
    let forn = null;
    if (nomeForn) {
      forn = (await tx`SELECT id::text AS id, nome FROM vybe_comercial_fornecedores WHERE ativo`).find((f) => normal(f.nome) === normal(nomeForn)) || null;
      if (!forn) falhar('Gráfica não está cadastrada (ativa) em Fornecedores.');
    }
    const mudou = ['responsavel'];
    await tx`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem) VALUES (${conteudo}, ${resp.id}, 0)`;
    await tx`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, autor_id, texto) VALUES (${conteudo}, 'responsavel', 'aguardando o Nestor', ${resp.nome}, ${autor}, ${assina})`;
    if (prazo && !c.prazo) {
      await tx`UPDATE vybe_conteudos SET prazo = ${prazo}::date WHERE id = ${conteudo}`;
      await tx`INSERT INTO vybe_conteudo_eventos (conteudo_id, tipo, de, para, autor_id, texto) VALUES (${conteudo}, 'prazo', NULL, ${prazo}, ${autor}, ${assina})`;
      mudou.push('prazo');
    }
    await tx`UPDATE vybe_conteudos SET atualizado_em = now() WHERE id = ${conteudo}`;
    const [imp] = await tx`SELECT id::text AS id, etapa, fornecedor_id::text AS fornecedor_id, responsavel::text AS responsavel FROM vybe_impressoes WHERE conteudo_id = ${conteudo} FOR UPDATE`;
    if (imp) {
      const partes = [];
      if (!imp.responsavel) { await tx`UPDATE vybe_impressoes SET responsavel = ${resp.id} WHERE id = ${imp.id}`; partes.push(`arte com ${resp.nome}`); }
      if (forn && !imp.fornecedor_id) { await tx`UPDATE vybe_impressoes SET fornecedor_id = ${forn.id} WHERE id = ${imp.id}`; partes.push(`gráfica ${forn.nome}`); mudou.push('fornecedor'); }
      if (partes.length) {
        await tx`UPDATE vybe_impressoes SET atualizado_em = now() WHERE id = ${imp.id}`;
        await evento(tx, imp.id, imp.etapa, imp.etapa, `${assina}: ${partes.join(', ')}`.slice(0, 500), autor);
      }
    }
    return { conteudo_id: conteudo, titulo: c.titulo, responsavel: resp.nome, prazo: mudou.includes('prazo') ? prazo : c.prazo, fornecedor: forn?.nome || null,
      impressao_id: imp?.id || null, mudou };
  });
}

export function resumir(impressoes) {
  const porEtapa = Object.fromEntries(ETAPAS.map(([k]) => [k, 0]));
  for (const i of impressoes) porEtapa[i.etapa] = (porEtapa[i.etapa] || 0) + 1;
  const abertas = impressoes.filter((i) => !FECHADAS.has(i.etapa));
  return { abertas: abertas.length, atrasadas: abertas.filter((i) => i.atrasada).length, semFornecedor: abertas.filter((i) => !i.fornecedor_id).length, porEtapa };
}

// Para a tela do fornecedor: o que ele tem agora, o que está atrasado e quantos dias leva do pedido à entrega.
export function porFornecedor(impressoes, fornecedores = []) {
  const nome = new Map(fornecedores.map((f) => [f.id, f.nome]));
  const m = new Map();
  for (const i of impressoes) {
    if (!i.fornecedor_id) continue;
    const f = m.get(i.fornecedor_id) || { fornecedor_id: i.fornecedor_id, nome: i.fornecedor_nome || nome.get(i.fornecedor_id) || '', abertas: 0, atrasadas: 0, entregues: 0, dias: [] };
    if (!FECHADAS.has(i.etapa)) { f.abertas++; if (i.atrasada) f.atrasadas++; }
    if (i.etapa === 'entregue') {
      f.entregues++;
      if (i.pedido_em && i.entregue_em) f.dias.push(Math.round((Date.parse(i.entregue_em) - Date.parse(i.pedido_em)) / 864e5));
    }
    m.set(i.fornecedor_id, f);
  }
  return [...m.values()].map(({ dias, ...f }) => ({ ...f, prazo_medio_dias: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null }))
    .sort((a, b) => b.abertas - a.abertas || a.nome.localeCompare(b.nome));
}

async function evento(tx, id, de, para, nota, autor) {
  await tx`INSERT INTO vybe_impressao_eventos (impressao_id, de, para, nota, autor_id) VALUES (${id}, ${de}, ${para}, ${nota || ''}, ${autor})`;
}

async function salvar(sql, pessoa, b) {
  const gestao = ehGestao(pessoa), eu = String(pessoa.id);
  const id = idOuNulo(b.id, 'Impressão');
  const d = {
    titulo: texto(b.titulo, 200, 'O que imprimir', true), material: texto(b.material, 80, 'Material'), especificacao: texto(b.especificacao, 2000, 'Especificação'),
    observacao: texto(b.observacao, 2000, 'Observação'), arquivo_url: texto(b.arquivo_url, 1000, 'Arquivo'),
    cliente_id: idOuNulo(b.cliente_id, 'Cliente'), projeto_id: idOuNulo(b.projeto_id, 'Projeto'), conteudo_id: idOuNulo(b.conteudo_id, 'Arte'),
    fornecedor_id: idOuNulo(b.fornecedor_id, 'Fornecedor'), responsavel: idOuNulo(b.responsavel, 'Responsável'), previsao: dataOuNula(b.previsao, 'Previsão'),
  };
  if (d.arquivo_url && !/^https:\/\/\S+$/.test(d.arquivo_url)) falhar('Arquivo: use um endereço que comece com https://');
  const q = b.quantidade == null || b.quantidade === '' ? null : Number(b.quantidade);
  if (q != null && (!Number.isInteger(q) || q < 1 || q > 10000000)) falhar('Quantidade: um número inteiro a partir de 1.');
  const valor = gestao && b.valor != null && b.valor !== '' ? Number(b.valor) : undefined;
  if (valor !== undefined && (!Number.isFinite(valor) || valor < 0)) falhar('Valor inválido.');
  return sql.comTransacao(async (tx) => {
    let cliente = null;
    if (d.cliente_id) { [cliente] = await CLIENTE_ATIVO(tx, d.cliente_id); if (!cliente) falhar('Escolha um cliente ativo da lista.'); }
    if (d.fornecedor_id && !(await tx`SELECT 1 FROM vybe_comercial_fornecedores WHERE id = ${d.fornecedor_id} AND ativo`).length) falhar('Escolha um fornecedor ativo.');
    if (d.responsavel && !(await tx`SELECT 1 FROM vybe_pessoas WHERE id = ${d.responsavel} AND ativo AND pode_entrar`).length) falhar('Responsável indisponível.');
    if (d.projeto_id && !(await tx`SELECT 1 FROM vybe_projetos WHERE id = ${d.projeto_id}`).length) falhar('Projeto não encontrado.');
    if (d.conteudo_id && !(await tx`SELECT 1 FROM vybe_conteudos WHERE id = ${d.conteudo_id} AND removido_em IS NULL`).length) falhar('Arte não encontrada na esteira.');
    if (id) {
      const [antes] = await tx`SELECT etapa FROM vybe_impressoes WHERE id = ${id} FOR UPDATE`;
      if (!antes) falhar('Impressão não encontrada.', 404);
      if (COM_FORNECEDOR.has(antes.etapa) && !d.fornecedor_id) falhar('Nesta etapa a impressão precisa de fornecedor.');
      try {
        await tx`UPDATE vybe_impressoes SET titulo=${d.titulo}, material=${d.material}, quantidade=${q}, especificacao=${d.especificacao}, observacao=${d.observacao},
          arquivo_url=${d.arquivo_url}, cliente_id=${d.cliente_id}, projeto_id=${d.projeto_id}, conteudo_id=${d.conteudo_id}, fornecedor_id=${d.fornecedor_id},
          responsavel=${d.responsavel}, previsao=${d.previsao}::date, atualizado_em=now() WHERE id=${id}`;
      } catch (e) { if (e?.code === '23505') falhar('Essa arte já está ligada a outra impressão.', 409); throw e; }
      if (valor !== undefined) await tx`UPDATE vybe_impressoes SET valor=${valor} WHERE id=${id}`;
      return { id };
    }
    // Nova: sem arte ligada e com cliente, a arte nasce na esteira (Solicitações, formato Impresso).
    let conteudoId = d.conteudo_id, arte = null;
    if (!conteudoId && cliente && b.criar_arte !== false) {
      const criar = criarPeca || (await import('../api/conteudo.js')).criarConteudoNaTransacao;
      const briefing = [d.material && `Material: ${d.material}`, q && `Quantidade: ${q}`, d.especificacao, d.observacao].filter(Boolean).join('\n');
      const r = await criar(tx, { tipo: 'sessao', pessoa }, { board: BOARD_SOLICITACOES, status: 'nova_demanda', formato: 'Impresso',
        titulo: `Impresso - ${d.titulo}`.slice(0, 240), cliente: cliente.nome, prazo: d.previsao, briefing, responsaveis: [], aguarda_nestor: !d.responsavel });
      conteudoId = String(r.conteudo_id); arte = conteudoId;
      if (d.responsavel) await tx`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem) VALUES (${conteudoId}, ${d.responsavel}, 0) ON CONFLICT DO NOTHING`;
    }
    let novo;
    try {
      [novo] = await tx`INSERT INTO vybe_impressoes (titulo, material, quantidade, especificacao, observacao, arquivo_url, cliente_id, projeto_id, conteudo_id,
          fornecedor_id, responsavel, previsao, valor, criado_por)
        VALUES (${d.titulo}, ${d.material}, ${q}, ${d.especificacao}, ${d.observacao}, ${d.arquivo_url}, ${d.cliente_id}, ${d.projeto_id}, ${conteudoId},
          ${d.fornecedor_id}, ${d.responsavel}, ${d.previsao}::date, ${valor ?? null}, ${eu}) RETURNING id::text AS id`;
    } catch (e) { if (e?.code === '23505') falhar('Essa arte já está ligada a outra impressão.', 409); throw e; }
    await evento(tx, novo.id, null, 'arte', arte ? 'Arte aberta nas Solicitações' : '', eu);
    return { id: novo.id, arte_id: arte };
  });
}

// Cotação: a gestão registra o que cada fornecedor pediu (valor e prazo) e escolhe uma. Escolher grava o fornecedor,
// o valor e, se ainda não houver, a previsão (hoje + prazo da cotação) na impressão.
async function salvarCotacao(sql, pessoa, b) {
  if (!ehGestao(pessoa)) falhar('Cotação é só dos donos.', 403);
  const impressao = idValido(b.impressao_id, 'Impressão'), fornecedor = idValido(b.fornecedor_id, 'Fornecedor');
  const valor = b.valor == null || b.valor === '' ? NaN : Number(b.valor);
  const prazo = b.prazo_dias == null || b.prazo_dias === '' ? null : Number(b.prazo_dias);
  if (!Number.isFinite(valor) || valor < 0) falhar('Informe o valor da cotação.');
  if (prazo != null && (!Number.isInteger(prazo) || prazo < 0 || prazo > 365)) falhar('Prazo em dias, de 0 a 365.');
  const observacao = texto(b.observacao, 1000, 'Observação');
  return sql.comTransacao(async (tx) => {
    if (!(await tx`SELECT 1 FROM vybe_impressoes WHERE id = ${impressao}`).length) falhar('Impressão não encontrada.', 404);
    const [f] = await tx`SELECT nome FROM vybe_comercial_fornecedores WHERE id = ${fornecedor} AND ativo`;
    if (!f) falhar('Escolha um fornecedor ativo.');
    const [k] = await tx`INSERT INTO vybe_impressao_cotacoes (impressao_id, fornecedor_id, valor, prazo_dias, observacao, criado_por)
      VALUES (${impressao}, ${fornecedor}, ${valor}, ${prazo}, ${observacao}, ${String(pessoa.id)})
      ON CONFLICT (impressao_id, fornecedor_id) DO UPDATE SET valor = EXCLUDED.valor, prazo_dias = EXCLUDED.prazo_dias, observacao = EXCLUDED.observacao
      RETURNING id::text AS id`;
    const [atual] = await tx`SELECT etapa FROM vybe_impressoes WHERE id = ${impressao}`;
    await evento(tx, impressao, atual.etapa, atual.etapa, `Cotação recebida de ${f.nome}`, String(pessoa.id));
    return { id: k.id };
  });
}
async function escolherCotacao(sql, pessoa, b) {
  if (!ehGestao(pessoa)) falhar('Cotação é só dos donos.', 403);
  const id = idValido(b.id, 'Cotação'), hoje = hojeBahia();
  return sql.comTransacao(async (tx) => {
    const [k] = await tx`SELECT k.impressao_id::text AS impressao_id, k.fornecedor_id::text AS fornecedor_id, k.valor, k.prazo_dias, f.nome
      FROM vybe_impressao_cotacoes k JOIN vybe_comercial_fornecedores f ON f.id = k.fornecedor_id WHERE k.id = ${id}`;
    if (!k) falhar('Cotação não encontrada.', 404);
    await tx`UPDATE vybe_impressao_cotacoes SET escolhida = (id = ${id}) WHERE impressao_id = ${k.impressao_id}`;
    const prevista = k.prazo_dias == null ? null : somarDias(hoje, Number(k.prazo_dias));
    const [i] = await tx`UPDATE vybe_impressoes SET fornecedor_id = ${k.fornecedor_id}, valor = ${k.valor}, atualizado_em = now(),
        previsao = COALESCE(previsao, ${prevista}::date) WHERE id = ${k.impressao_id} RETURNING etapa`;
    await evento(tx, k.impressao_id, i.etapa, i.etapa, `Cotação escolhida: ${k.nome}`, String(pessoa.id));
    return { id, impressao_id: k.impressao_id, fornecedor_id: k.fornecedor_id };
  });
}
const somarDias = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function mudarEtapa(sql, pessoa, b) {
  const id = idValido(b.id, 'Impressão'), para = String(b.etapa || ''), nota = texto(b.nota, 500, 'Nota');
  if (!CHAVES.has(para)) falhar('Etapa inválida.');
  const hoje = hojeBahia();
  return sql.comTransacao(async (tx) => {
    const [i] = await tx`SELECT etapa, fornecedor_id::text AS fornecedor_id FROM vybe_impressoes WHERE id = ${id} FOR UPDATE`;
    if (!i) falhar('Impressão não encontrada.', 404);
    if (i.etapa === para) return { id, etapa: para };
    if (COM_FORNECEDOR.has(para) && !i.fornecedor_id) falhar('Escolha o fornecedor antes de mandar para a gráfica.');
    if (para === 'cancelado' && !nota) falhar('Diga por que a impressão foi cancelada.');
    const pedido = ['arquivo_enviado', 'em_impressao'].includes(para);
    await tx`UPDATE vybe_impressoes SET etapa = ${para}, atualizado_em = now(),
        pedido_em = CASE WHEN ${pedido} THEN COALESCE(pedido_em, ${hoje}::date) ELSE pedido_em END,
        entregue_em = CASE WHEN ${para} = 'entregue' THEN ${hoje}::date WHEN ${para} = 'cancelado' THEN entregue_em ELSE NULL END
      WHERE id = ${id}`;
    await evento(tx, id, i.etapa, para, nota, String(pessoa.id));
    return { id, etapa: para };
  });
}

// O Nestor registra o que leu na conversa com o fornecedor (Paulo, 09/11/2026: "o Nestor não era pra identificar que eu
// não cadastrei e fazer isso?"). Chega pelo assistente do bot (consulta 'impressao_registrar', privado da administração).
// - Com impressao_id: atualiza essa. Sem: procura uma aberta do mesmo fornecedor e cliente com o mesmo título; não
//   achou, cria (sem abrir arte nova na esteira: a arte já foi para a gráfica).
// - Etapa só ANDA para a frente (nunca volta, nunca cancela); fornecedor só entra se ainda não havia; previsão e valor
//   só quando a conversa disse. Cada mudança vira evento com a frase da conversa que prova.
const ORDEM = new Map(ETAPAS.filter(([k]) => k !== 'cancelado').map(([k], i) => [k, i]));
const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export async function registrarPeloAgente(sql, pessoaId, b = {}) {
  const autor = idValido(pessoaId, 'Pessoa');
  const titulo = texto(b.titulo, 200, 'O que imprimir', true), frase = texto(b.frase, 500, 'Frase', true);
  const nomeForn = texto(b.fornecedor, 120, 'Fornecedor', true), nomeCliente = texto(b.cliente, 120, 'Cliente');
  const etapa = String(b.etapa || ''); if (etapa && (!ORDEM.has(etapa) || etapa === 'arte')) falhar('Etapa inválida.');
  const previsao = dataOuNula(b.previsao, 'Previsão'), pedidoEm = dataOuNula(b.pedido_em, 'Pedido');
  const valor = b.valor == null || b.valor === '' ? null : Number(b.valor);
  if (valor != null && (!Number.isFinite(valor) || valor < 0)) falhar('Valor inválido.');
  const q = b.quantidade == null || b.quantidade === '' ? null : Number(b.quantidade);
  if (q != null && (!Number.isInteger(q) || q < 1 || q > 10000000)) falhar('Quantidade inválida.');
  const nota = `Nestor, pela conversa com ${nomeForn}: “${frase}”`.slice(0, 500);
  const rodar = (f) => (sql.comTransacao ? sql.comTransacao(f) : f(sql));
  return rodar(async (tx) => {
    const fornecedores = await tx`SELECT id::text AS id, nome FROM vybe_comercial_fornecedores WHERE ativo`;
    const forn = fornecedores.find((f) => normal(f.nome) === normal(nomeForn));
    if (!forn) falhar('Fornecedor não está cadastrado (ativo) em Fornecedores.');
    let cliente = null;
    if (nomeCliente) {
      const ativos = await tx`SELECT id::text AS id, nome FROM vybe_clientes WHERE apagado_em IS NULL AND COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false)`;
      cliente = ativos.find((c) => normal(c.nome) === normal(nomeCliente)) || ativos.find((c) => normal(c.nome).includes(normal(nomeCliente)) || normal(nomeCliente).includes(normal(c.nome))) || null;
    }
    let alvo = null;
    if (b.impressao_id) {
      [alvo] = await tx`SELECT id::text AS id, etapa, fornecedor_id::text AS fornecedor_id, cliente_id::text AS cliente_id, previsao::text AS previsao, valor FROM vybe_impressoes WHERE id = ${idValido(b.impressao_id, 'Impressão')} FOR UPDATE`;
      if (!alvo) falhar('Impressão não encontrada.', 404);
      // Impressão de um cliente só muda quando a conversa traz o MESMO cliente (09/11/2026: a sacola branca da Emballar,
      // sem cliente na conversa, foi parar na "embalagem de presente" da VOA). Sem certeza, recusa e fica o achado.
      if (alvo.cliente_id && (!cliente || cliente.id !== alvo.cliente_id)) falhar('O cliente da conversa não confere com o da impressão.', 409);
    } else {
      const abertas = await tx`SELECT id::text AS id, titulo, etapa, fornecedor_id::text AS fornecedor_id, cliente_id::text AS cliente_id, previsao::text AS previsao, valor
        FROM vybe_impressoes WHERE etapa NOT IN ('entregue','cancelado') FOR UPDATE`;
      alvo = abertas.find((i) => normal(i.titulo) === normal(titulo) && (!i.fornecedor_id || i.fornecedor_id === forn.id) && (!cliente || !i.cliente_id || i.cliente_id === cliente.id)) || null;
    }
    if (!alvo) {
      const etapaNova = etapa || 'orcamento', pedido = ['arquivo_enviado', 'em_impressao', 'pronto', 'entregue'].includes(etapaNova);
      const [novo] = await tx`INSERT INTO vybe_impressoes (titulo, quantidade, observacao, cliente_id, fornecedor_id, etapa, pedido_em, previsao, valor, criado_por)
        VALUES (${titulo}, ${q}, ${'Registrada pelo Nestor a partir da conversa com ' + forn.nome + '.'}, ${cliente?.id || null}, ${forn.id}, ${etapaNova},
          ${pedido ? pedidoEm || hojeBahia() : null}::date, ${previsao}::date, ${valor}, ${autor}) RETURNING id::text AS id`;
      await evento(tx, novo.id, null, etapaNova, nota, autor);
      return { id: novo.id, criada: true, mudou: ['criada'], cliente: cliente?.nome || null, fornecedor: forn.nome };
    }
    const mudou = [];
    const anda = etapa && ORDEM.has(alvo.etapa) && ORDEM.get(etapa) > ORDEM.get(alvo.etapa);
    if (!alvo.fornecedor_id) { await tx`UPDATE vybe_impressoes SET fornecedor_id = ${forn.id} WHERE id = ${alvo.id}`; mudou.push('fornecedor'); }
    if (cliente && !alvo.cliente_id) { await tx`UPDATE vybe_impressoes SET cliente_id = ${cliente.id} WHERE id = ${alvo.id}`; mudou.push('cliente'); }
    if (previsao && previsao !== alvo.previsao) { await tx`UPDATE vybe_impressoes SET previsao = ${previsao}::date WHERE id = ${alvo.id}`; mudou.push('previsao'); }
    if (valor != null && Number(alvo.valor) !== valor) { await tx`UPDATE vybe_impressoes SET valor = ${valor} WHERE id = ${alvo.id}`; mudou.push('valor'); }
    if (anda) {
      const pedido = ['arquivo_enviado', 'em_impressao'].includes(etapa);
      await tx`UPDATE vybe_impressoes SET etapa = ${etapa},
          pedido_em = CASE WHEN ${pedido} THEN COALESCE(pedido_em, ${pedidoEm || hojeBahia()}::date) ELSE pedido_em END,
          entregue_em = CASE WHEN ${etapa} = 'entregue' THEN ${hojeBahia()}::date ELSE entregue_em END
        WHERE id = ${alvo.id}`;
      mudou.push('etapa');
    }
    if (!mudou.length) return { id: alvo.id, criada: false, mudou };
    await tx`UPDATE vybe_impressoes SET atualizado_em = now() WHERE id = ${alvo.id}`;
    await evento(tx, alvo.id, alvo.etapa, anda ? etapa : alvo.etapa, nota, autor);
    return { id: alvo.id, criada: false, mudou, fornecedor: forn.nome };
  });
}

export async function areaImpressoes(req, res, quem, sql) {
  if (!quem) return res.status(401).json({ error: 'Entre no painel para acessar Impressões.' });
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'Impressões exige uma sessão pessoal.' });
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  const pessoa = quem.pessoa;
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await ler(sql, pessoa, req.query || {})) });
    const b = req.body || {};
    const acao = String(b.acao || '');
    const r = acao === 'impressao_salvar' ? await salvar(sql, pessoa, b)
      : acao === 'impressao_etapa' ? await mudarEtapa(sql, pessoa, b)
      : acao === 'cotacao_salvar' ? await salvarCotacao(sql, pessoa, b)
      : acao === 'cotacao_escolher' ? await escolherCotacao(sql, pessoa, b)
      : acao === 'regra_salvar' ? await salvarRegra(sql, pessoa, b)
      : acao === 'regra_remover' ? await removerRegra(sql, pessoa, b)
      : falhar('Ação desconhecida. Use impressao_salvar, impressao_etapa, cotacao_salvar, cotacao_escolher, regra_salvar ou regra_remover.');
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    if (semTabela(e)) return res.status(503).json({ error: 'Impressões ainda está sendo ligado no banco. Tente de novo em alguns minutos.' });
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[impressoes]', e);
    return res.status(500).json({ error: 'Não foi possível acessar Impressões. Tente novamente.' });
  }
}
