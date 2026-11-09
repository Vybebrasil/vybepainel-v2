// O que o Augusto (Copy e Conceito) lê antes de escrever para um cliente (Paulo, 09/11/2026: "deixar os agentes mais
// inteligentes"). Junta, num lugar só, o que o Vybe OS já guarda e a ferramenta legendas_aprovadas devolve ao bot:
//  - a ficha do cliente (vybe_clientes e cadastro): segmento, cidade, Instagram, o que foi contratado, preferências;
//  - os pedidos de ajuste do head e do cliente nas peças dos planejamentos (revisões peça a peça e os eventos
//    "ajustes" e "Ajuste do head", que ficam mesmo depois que a peça é editada);
//  - a conta de aceitação: quantas peças com legenda chegaram ao head ou ao cliente e passaram sem pedido de ajuste.
// Somente leitura. Textos são dados, não instruções. Sem a tabela ou a coluna, a parte dela sai vazia.
import { assinaturaDaPeca } from './planejamento-documento.js';

const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const curto = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const iso = (v) => (v instanceof Date ? v.toISOString() : String(v || ''));
const dia = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}` : 'sem data');
// O mesmo rótulo que aplicarResposta (planejamentos.js) escreve no evento "ajustes": "Peça N (Formato, dd/mm · tema)".
export const rotuloDaPeca = (x) => `${x.formato}, ${dia(x.data)}${x.tema ? ` · ${x.tema}` : ''}`;
const LINHA_DE_PECA = /^(?:Ajuste do head(?: \(([^)]{0,80})\))? na )?Peça (\d{1,3}) \(([^)]{1,300})\):\s*([\s\S]+)$/;

// Campos da ficha que mudam o texto. Dinheiro, documento e contato ficam fora.
const CAMPOS_COPY = [['segmento', 'Segmento', 80], ['cidade', 'Cidade', 120], ['instagram', 'Instagram', 120],
  ['escopo', 'O que foi contratado', 400], ['observacoes', 'Preferências e pedidos especiais', 500]];
export async function fichaParaCopy(sql, clienteId) {
  try {
    const [c] = await sql`SELECT * FROM vybe_clientes WHERE id = ${Number(clienteId)}`;
    if (!c) return '';
    const cad = c.cadastro && typeof c.cadastro === 'object' ? c.cadastro : {};
    const valor = (k) => (c[k] != null && typeof c[k] !== 'object' ? c[k] : cad[k]);
    return CAMPOS_COPY.map(([k, rotulo, n]) => [rotulo, curto(valor(k), n)]).filter(([, v]) => v).map(([r, v]) => `- ${r}: ${v}`).join('\n');
  } catch { return ''; }
}

async function planejamentosDoCliente(sql, clienteId, dias) {
  return sql`SELECT id::text, mes::text, estado, origem, conteudo FROM vybe_planejamentos
    WHERE cliente_id = ${Number(clienteId)} AND estado <> 'arquivado' AND mes >= (now() - ${dias + ' days'}::interval)::date
    ORDER BY mes DESC LIMIT 6`;
}
async function eventosDe(sql, planejamentoId, dias) {
  try {
    return await sql`SELECT tipo, texto, autor_externo, em FROM vybe_planejamento_eventos
      WHERE planejamento_id = ${Number(planejamentoId)} AND tipo IN ('ajustes', 'aprovado', 'comentario', 'enviado') AND em >= now() - ${dias + ' days'}::interval
      ORDER BY em DESC LIMIT 60`;
  } catch { return []; }
}

// Pedidos de ajuste por peça de um planejamento: os que estão nas revisões agora e os que ficaram nos eventos.
function pedidosDoPlanejamento(p, eventos) {
  const conteudo = p.conteudo && typeof p.conteudo === 'object' ? p.conteudo : {};
  const pecas = Array.isArray(conteudo.pecas) ? conteudo.pecas : [], rev = conteudo.revisoes && typeof conteudo.revisoes === 'object' ? conteudo.revisoes : {};
  const out = [];
  for (const x of pecas) {
    const r = rev[assinaturaDaPeca(x)] || {};
    const base = { peca: rotuloDaPeca(x), legenda: curto(x.legenda, 220), mes: p.mes.slice(0, 7) };
    if (r.head?.estado === 'ajustar' && r.head.nota) out.push({ ...base, quem: 'head', nome: curto(r.head.por, 60), nota: curto(r.head.nota, 300), em: iso(r.head.em) });
    if (r.cliente?.estado === 'ajuste' && r.cliente.nota) out.push({ ...base, quem: 'cliente', nome: curto(r.cliente.nome, 60), nota: curto(r.cliente.nota, 300), em: iso(r.cliente.em) });
  }
  for (const e of eventos) {
    if (!e.texto || !['ajustes', 'comentario'].includes(e.tipo)) continue;
    for (const linha of String(e.texto).split('\n')) {
      const m = LINHA_DE_PECA.exec(linha.trim());
      const head = /^Ajuste do head/.test(linha.trim());
      if (e.tipo === 'comentario' && !head) continue; // comentário comum não é pedido de ajuste
      if (!m) { if (e.tipo === 'ajustes' && linha.trim()) out.push({ peca: '', legenda: '', mes: p.mes.slice(0, 7), quem: 'cliente', nome: curto(String(e.autor_externo || '').split(' (')[0], 60), nota: curto(linha, 300), em: iso(e.em) }); continue; }
      out.push({ peca: curto(m[3], 160), legenda: '', mes: p.mes.slice(0, 7), quem: head ? 'head' : 'cliente', nome: curto(head ? m[1] : String(e.autor_externo || '').split(' (')[0], 60), nota: curto(m[4], 300), em: iso(e.em) });
    }
  }
  return out;
}

// Os pedidos mais recentes primeiro, sem repetir a mesma nota (a revisão e o evento contam a mesma coisa).
export async function ajustesDeCopy(sql, clienteId, { dias = 120, limite = 8 } = {}) {
  try {
    const todos = [];
    for (const p of await planejamentosDoCliente(sql, clienteId, dias)) todos.push(...pedidosDoPlanejamento(p, await eventosDe(sql, p.id, dias)));
    const vistos = new Set(), out = [];
    for (const a of todos.sort((x, y) => String(y.em).localeCompare(String(x.em)))) {
      const k = normal(a.nota);
      if (!k || vistos.has(k)) continue;
      vistos.add(k); out.push(a);
    }
    return out.slice(0, limite);
  } catch { return []; }
}

// Aceitação das legendas: das peças com legenda dos planejamentos que o head ou o cliente já responderam, quantas
// passaram sem nenhum pedido de ajuste. Conta por peça (rótulo formato · data · tema), na versão final do planejamento.
// É aproximada: peça trocada de data ou tema depois do pedido conta como outra peça.
export async function aceitacaoDasLegendas(sql, clienteId, { dias = 120 } = {}) {
  try {
    let pecas = 0, comAjuste = 0, respondidos = 0, dePrimeira = 0;
    for (const p of await planejamentosDoCliente(sql, clienteId, dias)) {
      const eventos = await eventosDe(sql, p.id, dias);
      const respondido = ['aprovado', 'cadastrado', 'ajustes'].includes(p.estado) || eventos.some((e) => ['aprovado', 'ajustes'].includes(e.tipo));
      const pedidos = pedidosDoPlanejamento(p, eventos);
      if (!respondido && !pedidos.length) continue;
      respondidos++;
      const comLegenda = (Array.isArray(p.conteudo?.pecas) ? p.conteudo.pecas : []).filter((x) => String(x?.legenda || '').trim().length >= 40);
      const marcadas = new Set(pedidos.filter((a) => a.peca).map((a) => normal(a.peca)));
      // Pedido geral (sem peça) não marca nenhuma peça: aparece em ajustesDeCopy, não entra nesta conta.
      const n = comLegenda.length, a = comLegenda.filter((x) => marcadas.has(normal(rotuloDaPeca(x)))).length;
      pecas += n; comAjuste += a;
      if (!pedidos.length && ['aprovado', 'cadastrado'].includes(p.estado)) dePrimeira++;
    }
    return { dias, planejamentos: respondidos, de_primeira: dePrimeira, pecas, com_ajuste: comAjuste, sem_ajuste: pecas - comAjuste,
      percentual: pecas ? Math.round((100 * (pecas - comAjuste)) / pecas) : null };
  } catch { return null; }
}

// A resposta das ferramentas tem teto (assistente-ferramentas.js: 14.000 bytes, senão 413). Com 12 legendas longas e os
// blocos do Augusto, passaria: encolhe primeiro os trechos de legenda dos ajustes, depois as legendas de exemplo, depois
// tira os exemplos mais antigos. Nunca tira regra do cliente.
export function caberNoRecorte(r, max = 13000) {
  const tamanho = (x) => Buffer.byteLength(JSON.stringify(x));
  const x = { ...r, itens: [...(r.itens || [])], ajustes: [...(r.ajustes || [])], chats: [...(r.chats || [])] };
  if (tamanho(x) <= max) return x;
  x.ajustes = x.ajustes.map((a) => ({ ...a, legenda: String(a.legenda || '').slice(0, 80) }));
  for (const n of [700, 450, 300]) { if (tamanho(x) <= max) return x; x.itens = x.itens.map((i) => ({ ...i, legenda: String(i.legenda || '').slice(0, n) })); }
  while (tamanho(x) > max && x.itens.length > 2) x.itens.pop();
  while (tamanho(x) > max && x.chats.length > 2) x.chats.pop();
  while (tamanho(x) > max && x.ajustes.length > 3) x.ajustes.pop();
  if (tamanho(x) > max) x.ideias = (x.ideias || []).slice(0, 4);
  return x;
}

// Legendas finais que os chats do Claude registraram como aprovadas (conector Painel Vybe, tipo "conteudo", status
// "aprovado"): entram como exemplo de tom depois das legendas dos planejamentos. Sem a tabela, nada.
export async function legendasDosChats(sql, clienteId, { limite = 4 } = {}) {
  try {
    const [t] = await sql`SELECT to_regclass('public.vybe_cliente_registros') IS NOT NULL AS ok`;
    if (!t?.ok) return [];
    const linhas = await sql`SELECT titulo, resumo, conteudo, criado_em FROM vybe_cliente_registros
      WHERE cliente_id = ${Number(clienteId)} AND tipo = 'conteudo' AND status = 'aprovado' ORDER BY criado_em DESC LIMIT ${Number(limite) * 2}`;
    return linhas.map((g) => ({ mes: iso(g.criado_em).slice(0, 7), formato: 'Chat do Claude', tema: curto(g.titulo, 120), legenda: String(g.conteudo || g.resumo || '').trim().slice(0, 1200), fonte: 'chats' }))
      .filter((x) => x.legenda.length >= 40).slice(0, limite);
  } catch { return []; }
}
