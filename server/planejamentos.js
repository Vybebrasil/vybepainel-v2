// Planejamentos mensais dos clientes (docs/planejamentos-plano.md,
// migrations/2026-10-20-planejamentos.sql). O agente do cliente publica, o
// head revisa e edita, manda para o cliente por um link e o cliente aprova ou
// pede ajustes. Identidade e permissão vêm da sessão; o link do cliente é um
// segredo de uso externo (só o hash fica no banco).
import { alertasDosClientes } from './alertas-clientes.js';
import { createHash, randomBytes } from 'node:crypto';
import { criarConteudoNaTransacao } from '../api/conteudo.js';
import { BOARD_PRODUCAO, BOARD_DEMANDAS } from './grupos.js';

const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
const ESTADOS = ['revisar', 'enviado', 'aprovado', 'ajustes', 'cadastrado', 'arquivado'];
const DIAS_DO_LINK = 30;
export const hashDoLink = (token) => createHash('sha256').update(String(token)).digest('hex');

export async function planejamentosProntos(sql) {
 const [r] = await sql`SELECT (to_regclass('public.vybe_planejamentos') IS NOT NULL AND to_regclass('public.vybe_planejamento_eventos') IS NOT NULL) AS existe`;
 return Boolean(r?.existe);
}
const exigir = async (sql) => { if (!await planejamentosProntos(sql)) throw erro('Os planejamentos aguardam a migração do banco.', 503); };

// --- Conteúdo padrão ---------------------------------------------------------
// Todos os clientes usam a mesma estrutura (o documento sai sempre igual); a
// identidade (cores, logo, fonte, tom) vem do cadastro do cliente.
const texto = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const lista = (v, max, f) => (Array.isArray(v) ? v : []).slice(0, max).map(f).filter(Boolean);
const dataIso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
export const FORMATOS = ['Card', 'Carrossel', 'Reels', 'Fotografia', 'Vídeo', 'Stories', 'Outro'];
export function normalizarConteudo(c = {}) {
 const o = c && typeof c === 'object' ? c : {};
 return {
  resumo: texto(o.resumo, 1500),
  numeros: lista(o.numeros, 8, (n) => (texto(n?.rotulo, 60) ? { rotulo: texto(n.rotulo, 60), valor: texto(n.valor, 20) } : null)),
  linhas: lista(o.linhas, 8, (l) => (texto(l?.titulo, 80) ? { titulo: texto(l.titulo, 80), texto: texto(l.texto, 600) } : null)),
  datas: lista(o.datas, 20, (d) => (texto(d?.nome, 80) ? { data: texto(d.data, 20), nome: texto(d.nome, 80), texto: texto(d.texto, 300) } : null)),
  pecas: lista(o.pecas, 80, (p) => {
   const data = dataIso(p?.data);
   if (!data && !texto(p?.tema, 160)) return null;
   const formato = FORMATOS.find((f) => f.toLowerCase() === String(p?.formato || '').toLowerCase()) || (texto(p?.formato, 30) ? 'Outro' : 'Card');
   // conteudo_id: a demanda criada a partir da peça (cadastrarPecas).
   const cid = /^\d{1,18}$/.test(String(p?.conteudo_id || '')) ? String(p.conteudo_id) : null;
   return { data, formato, tema: texto(p?.tema, 160), legenda: texto(p?.legenda, 2200), referencia: texto(p?.referencia, 600), observacao: texto(p?.observacao, 400), ...(cid ? { conteudo_id: cid } : {}) };
  }).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999')),
  observacoes: texto(o.observacoes, 2000),
 };
}
export function mesDoTexto(v) {
 const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(v || ''));
 if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw erro('Informe o mês como AAAA-MM.');
 return `${m[1]}-${m[2]}-01`;
}

// --- Quem pode -----------------------------------------------------------------
// Todos da equipe veem; editar e mandar é do head do cliente e de quem administra
// (decisão do Paulo, 19/10/2026: head do cliente e Paulo).
export async function podeEditarCliente(sql, pessoa, clienteId) {
 if (pessoa?.admin) return true;
 const [h] = await sql`SELECT 1 AS ok FROM vybe_cliente_pessoas WHERE cliente_id=${clienteId} AND pessoa_id=${pessoa?.id}`;
 return Boolean(h);
}
async function exigirEditor(sql, pessoa, clienteId) {
 if (!await podeEditarCliente(sql, pessoa, clienteId)) throw erro('Só o head do cliente e quem administra editam e enviam o planejamento.', 403);
}
async function registrar(tx, planejamentoId, tipo, { autor = null, externo = null, texto: t = null, versao = null } = {}) {
 await tx`INSERT INTO vybe_planejamento_eventos(planejamento_id,tipo,autor_id,autor_externo,texto,versao) VALUES(${planejamentoId},${tipo},${autor},${externo},${t},${versao})`;
}
const publico = (p) => p && ({ ...p, id: String(p.id), cliente_id: String(p.cliente_id), criado_por: p.criado_por ? String(p.criado_por) : null, mes: String(p.mes instanceof Date ? p.mes.toISOString() : p.mes).slice(0, 10), link_hash: undefined });

// --- Leitura -------------------------------------------------------------------
export async function listarPlanejamentos(sql, pessoa, { clienteId = null } = {}) {
 if (!await planejamentosProntos(sql)) return { disponivel: false, planejamentos: [] };
 const linhas = clienteId
  ? await sql`SELECT p.*,c.nome AS cliente FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id=p.cliente_id WHERE p.cliente_id=${clienteId} AND p.estado<>'arquivado' ORDER BY p.mes DESC LIMIT 24`
  : await sql`SELECT p.*,c.nome AS cliente FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id=p.cliente_id WHERE p.estado<>'arquivado' ORDER BY p.mes DESC, c.nome LIMIT 200`;
 const editaveis = new Set();
 for (const l of linhas) if (!editaveis.has(String(l.cliente_id)) && await podeEditarCliente(sql, pessoa, l.cliente_id)) editaveis.add(String(l.cliente_id));
 return { disponivel: true, planejamentos: linhas.map((l) => ({ ...publico(l), pode_editar: editaveis.has(String(l.cliente_id)) })) };
}
export async function detalhePlanejamento(sql, pessoa, id) {
 await exigir(sql);
 const [p] = await sql`SELECT p.*,c.nome AS cliente,c.identidade,c.email AS cliente_email FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id=p.cliente_id WHERE p.id=${id}`;
 if (!p) throw erro('Planejamento não encontrado.', 404);
 const eventos = await sql`SELECT e.tipo,e.texto,e.versao,e.em,e.autor_externo,x.nome AS autor FROM vybe_planejamento_eventos e LEFT JOIN vybe_pessoas x ON x.id=e.autor_id WHERE e.planejamento_id=${id} ORDER BY e.em DESC LIMIT 60`;
 return { ...publico(p), pode_editar: await podeEditarCliente(sql, pessoa, p.cliente_id), eventos };
}
// O que espera cada head: para revisar ou com ajustes pedidos, nos clientes dele
// (quem administra vê todos). Base do aviso na tela e no Centro de Operação.
export async function pendentesDoHead(sql, pessoa) {
 if (!await planejamentosProntos(sql)) return [];
 const linhas = pessoa?.admin
  ? await sql`SELECT p.id,p.cliente_id,c.nome AS cliente,p.mes,p.titulo,p.estado,p.atualizado_em FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id=p.cliente_id WHERE p.estado IN ('revisar','ajustes') ORDER BY p.atualizado_em`
  : await sql`SELECT p.id,p.cliente_id,c.nome AS cliente,p.mes,p.titulo,p.estado,p.atualizado_em FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id=p.cliente_id
     JOIN vybe_cliente_pessoas h ON h.cliente_id=p.cliente_id AND h.pessoa_id=${pessoa?.id} WHERE p.estado IN ('revisar','ajustes') ORDER BY p.atualizado_em`;
 return linhas.map(publico);
}

// Centro de Operação: um agente por cliente ativo, com o planejamento mais
// recente de cada um (os que têm planejamento vêm primeiro). Vale para todos
// da equipe; o que cada um pode fazer continua conferido ao abrir.
export async function postosDaOperacao(sql, pessoa) {
 const pronto = await planejamentosProntos(sql);
 const clientes = await sql`SELECT id,nome,segmento,identidade->'personagem' AS personagem FROM vybe_clientes WHERE ativo IS NOT FALSE ORDER BY nome`;
 const planos = pronto ? await sql`SELECT DISTINCT ON (cliente_id) id,cliente_id,mes,estado,versao FROM vybe_planejamentos WHERE estado<>'arquivado' ORDER BY cliente_id, mes DESC` : [];
 const heads = await sql`SELECT cliente_id FROM vybe_cliente_pessoas WHERE pessoa_id=${pessoa?.id ?? null}`;
 const meus = new Set(heads.map((h) => String(h.cliente_id)));
 const porCliente = new Map(planos.map((p) => [String(p.cliente_id), publico({ ...p, cliente_id: p.cliente_id })]));
 const alertas = await alertasDosClientes(sql);
 return clientes.map((c) => ({ cliente_id: String(c.id), cliente: c.nome, segmento: c.segmento || null, personagem: c.personagem || null, meu: meus.has(String(c.id)), planejamento: porCliente.get(String(c.id)) || null,
  alertas: alertas.get(String(c.id)) || { sem_info: [], atrasadas: [], aprovar: [], total: 0 } }))
  .sort((a, b) => Number(Boolean(b.planejamento)) - Number(Boolean(a.planejamento)) || a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

// --- Agente publica ----------------------------------------------------------
// Cliente pelo id ou pelo nome (sem acento, sem caixa). Publicar de novo no
// mesmo mês vira nova versão enquanto não foi enviado; depois de enviado ou
// aprovado, o agente não sobrescreve o que o cliente está vendo.
const chave = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export async function clientePorNomeOuId(sql, cliente) {
 if (/^\d{1,18}$/.test(String(cliente || ''))) { const [c] = await sql`SELECT id,nome FROM vybe_clientes WHERE id=${cliente}`; if (c) return c; }
 const todos = await sql`SELECT id,nome FROM vybe_clientes WHERE ativo IS NOT FALSE`;
 const k = chave(cliente);
 const achados = todos.filter((c) => chave(c.nome) === k);
 if (achados.length === 1) return achados[0];
 const parecidos = todos.filter((c) => k && (chave(c.nome).includes(k) || k.includes(chave(c.nome))));
 if (parecidos.length === 1) return parecidos[0];
 throw erro(parecidos.length ? `Mais de um cliente parecido com "${cliente}": ${parecidos.map((c) => c.nome).join(', ')}.` : `Cliente "${cliente}" não encontrado no painel.`, 404);
}
export async function publicarDoAgente(sql, { cliente, mes, titulo, conteudo }) {
 await exigir(sql);
 const c = await clientePorNomeOuId(sql, cliente);
 const m = mesDoTexto(mes);
 const corpo = normalizarConteudo(conteudo);
 if (!corpo.pecas.length && !corpo.resumo) throw erro('O planejamento precisa de resumo ou de peças.');
 const t = texto(titulo, 160) || `Planejamento de ${c.nome}`;
 return sql.comTransacao(async (tx) => {
  const [atual] = await tx`SELECT id,estado,versao FROM vybe_planejamentos WHERE cliente_id=${c.id} AND mes=${m}::date AND estado<>'arquivado' FOR UPDATE`;
  if (atual && !['revisar', 'ajustes'].includes(atual.estado))
   throw erro(`O planejamento de ${c.nome} deste mês já está ${atual.estado === 'enviado' ? 'com o cliente' : atual.estado}: peça ao head para reabrir antes de publicar outra versão.`, 409);
  if (atual) {
   const [p] = await tx`UPDATE vybe_planejamentos SET titulo=${t},conteudo=${JSON.stringify(corpo)}::jsonb,versao=versao+1,estado='revisar',atualizado_em=now() WHERE id=${atual.id} RETURNING *`;
   await registrar(tx, p.id, 'nova_versao', { externo: 'agente', versao: p.versao });
   return { ...publico(p), cliente: c.nome, novo: false };
  }
  const [p] = await tx`INSERT INTO vybe_planejamentos(cliente_id,mes,titulo,conteudo,origem) VALUES(${c.id},${m}::date,${t},${JSON.stringify(corpo)}::jsonb,'agente') RETURNING *`;
  await registrar(tx, p.id, 'publicado', { externo: 'agente', versao: 1 });
  return { ...publico(p), cliente: c.nome, novo: true };
 });
}

// --- Head edita, envia e cadastra ------------------------------------------------
export async function criarNoPainel(sql, pessoa, { clienteId, mes, titulo, conteudo }) {
 await exigir(sql);
 const [c] = await sql`SELECT id,nome FROM vybe_clientes WHERE id=${clienteId}`;
 if (!c) throw erro('Cliente não encontrado.', 404);
 await exigirEditor(sql, pessoa, c.id);
 const m = mesDoTexto(mes);
 return sql.comTransacao(async (tx) => {
  const [ja] = await tx`SELECT id FROM vybe_planejamentos WHERE cliente_id=${c.id} AND mes=${m}::date AND estado<>'arquivado'`;
  if (ja) throw erro('Já existe um planejamento deste cliente para esse mês.', 409);
  const [p] = await tx`INSERT INTO vybe_planejamentos(cliente_id,mes,titulo,conteudo,origem,criado_por) VALUES(${c.id},${m}::date,${texto(titulo, 160) || `Planejamento de ${c.nome}`},${JSON.stringify(normalizarConteudo(conteudo))}::jsonb,'painel',${pessoa.id}) RETURNING *`;
  await registrar(tx, p.id, 'publicado', { autor: pessoa.id, versao: 1 });
  return publico(p);
 });
}
// Editar exige a versão que a pessoa abriu (duas edições ao mesmo tempo não se
// apagam). Editar algo já enviado volta para revisão e invalida o link antigo.
export async function editarPlanejamento(sql, pessoa, { id, versao, titulo, conteudo }) {
 await exigir(sql);
 return sql.comTransacao(async (tx) => {
  const [p] = await tx`SELECT * FROM vybe_planejamentos WHERE id=${id} FOR UPDATE`;
  if (!p) throw erro('Planejamento não encontrado.', 404);
  await exigirEditor(tx, pessoa, p.cliente_id);
  if (['aprovado', 'cadastrado', 'arquivado'].includes(p.estado)) throw erro('Este planejamento já foi aprovado: reabra antes de editar.', 409);
  if (Number(versao) !== Number(p.versao)) throw erro('Alguém salvou outra versão enquanto você editava. Recarregue para ver.', 409);
  const voltou = p.estado === 'enviado';
  const [n] = await tx`UPDATE vybe_planejamentos SET titulo=${texto(titulo, 160) || p.titulo},conteudo=${JSON.stringify(normalizarConteudo(conteudo))}::jsonb,
   versao=versao+1,estado=CASE WHEN estado='enviado' THEN 'revisar' ELSE estado END,
   link_hash=CASE WHEN estado='enviado' THEN NULL ELSE link_hash END,atualizado_em=now() WHERE id=${id} RETURNING *`;
  await registrar(tx, id, 'editado', { autor: pessoa.id, versao: n.versao, texto: voltou ? 'Editado depois de enviado: o link anterior deixou de valer.' : null });
  return publico(n);
 });
}
// Gera o link de aprovação (segredo devolvido uma vez só) e marca como enviado.
export async function enviarAoCliente(sql, pessoa, { id }) {
 await exigir(sql);
 return sql.comTransacao(async (tx) => {
  const [p] = await tx`SELECT * FROM vybe_planejamentos WHERE id=${id} FOR UPDATE`;
  if (!p) throw erro('Planejamento não encontrado.', 404);
  await exigirEditor(tx, pessoa, p.cliente_id);
  if (!['revisar', 'ajustes', 'enviado'].includes(p.estado)) throw erro('Este planejamento já foi respondido pelo cliente.', 409);
  const token = randomBytes(24).toString('base64url');
  const [n] = await tx`UPDATE vybe_planejamentos SET estado='enviado',link_hash=${hashDoLink(token)},link_expira_em=now()+${DIAS_DO_LINK + ' days'}::interval,
   enviado_em=now(),respondido_em=NULL,resposta_nome=NULL,resposta_texto=NULL,atualizado_em=now() WHERE id=${id} RETURNING *`;
  await registrar(tx, id, 'enviado', { autor: pessoa.id, versao: n.versao });
  return { ...publico(n), token };
 });
}
export async function mudarEstadoInterno(sql, pessoa, { id, estado }) {
 await exigir(sql);
 if (!['cadastrado', 'arquivado', 'revisar'].includes(estado)) throw erro('Situação inválida.');
 return sql.comTransacao(async (tx) => {
  const [p] = await tx`SELECT * FROM vybe_planejamentos WHERE id=${id} FOR UPDATE`;
  if (!p) throw erro('Planejamento não encontrado.', 404);
  await exigirEditor(tx, pessoa, p.cliente_id);
  if (estado === 'cadastrado' && p.estado !== 'aprovado') throw erro('Só se marca como cadastrado depois que o cliente aprovar.', 409);
  const [n] = await tx`UPDATE vybe_planejamentos SET estado=${estado},link_hash=CASE WHEN ${estado}='revisar' THEN NULL ELSE link_hash END,atualizado_em=now() WHERE id=${id} RETURNING *`;
  await registrar(tx, id, estado === 'revisar' ? 'editado' : estado, { autor: pessoa.id, versao: n.versao, texto: estado === 'revisar' ? 'Reaberto para revisão.' : null });
  return publico(n);
 });
}
// --- Cadastrar as peças aprovadas -------------------------------------------------
// Paulo, 20/10/2026: "tiver tudo ok ele poder cadastrar cada demanda com um
// simples botão". Uma transação: ou entram todas, ou nenhuma; o planejamento
// vira "cadastrado" junto, então clicar de novo não duplica.
const somarDias = (iso, n) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diaUtil = (iso) => { let x = iso; while ([0, 6].includes(new Date(`${x}T12:00:00Z`).getUTCDay())) x = somarDias(x, -1); return x; };
// Prazo de Ouro: 7 dias antes da veiculação (PRAZO_OURO_DIAS). Se já passou,
// hoje, mas nunca depois de 2 dias antes da veiculação (margem mínima do Paulo).
// Sábado e domingo voltam para a sexta.
export function prazoDaPeca(veiculacao, hoje) {
 const ouro = diaUtil(somarDias(veiculacao, -7));
 if (ouro >= hoje) return ouro;
 const limite = diaUtil(somarDias(veiculacao, -2));
 return hoje <= limite ? hoje : limite;
}
// O que é conteúdo vai para Produção; "Outro" é pedido avulso e entra em Solicitações.
const FORMATO_DO_PAINEL = { Card: 'Card', Carrossel: 'Carrossel', Reels: 'Reels', Fotografia: 'Fotografia', 'Vídeo': 'Vídeo', Stories: 'Story', Outro: 'Avulso' };
export function briefingDaPeca(p, mesTexto) {
 return [p.tema && `Tema: ${p.tema}`, p.legenda && `Legenda / roteiro:\n${p.legenda}`, p.referencia && `Referência: ${p.referencia}`,
  p.observacao && `Observação: ${p.observacao}`, `Do planejamento de ${mesTexto}, aprovado pelo cliente.`].filter(Boolean).join('\n\n');
}
// destinos: por formato do planejamento, o que a regra do cadastro decidiu
// (cadastrosDestiny no navegador: board, grupo, status, captação e equipe). A
// pessoa da equipe é a que mais fez peças deste cliente nos últimos 120 dias
// (o painel registra quem fez cada uma); sem histórico, fica a equipe toda.
export async function cadastrarPecas(sql, quem, { id, versao, destinos }) {
 await exigir(sql);
 const pessoa = quem?.pessoa;
 return sql.comTransacao(async (tx) => {
  const [p] = await tx`SELECT p.*,c.nome AS cliente FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id=p.cliente_id WHERE p.id=${id} FOR UPDATE OF p`;
  if (!p) throw erro('Planejamento não encontrado.', 404);
  await exigirEditor(tx, pessoa, p.cliente_id);
  if (p.estado === 'cadastrado') throw erro('As peças deste planejamento já foram cadastradas.', 409);
  if (p.estado !== 'aprovado') throw erro('Só dá para cadastrar depois que o cliente aprovar.', 409);
  if (Number(versao) !== Number(p.versao)) throw erro('O planejamento mudou enquanto você olhava. Recarregue.', 409);
  const conteudo = normalizarConteudo(p.conteudo);
  const [{ hoje }] = await tx`SELECT (now() AT TIME ZONE 'America/Bahia')::date::text AS hoje`;
  const mesTexto = new Date(`${publico(p).mes}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const historico = new Map();
  const quemFaz = async (equipe) => {
   const ids = (Array.isArray(equipe) ? equipe : []).map(String).filter((x) => /^\d{1,18}$/.test(x)).slice(0, 12);
   if (ids.length <= 1) return ids;
   const chave = ids.join(',');
   if (!historico.has(chave)) {
    const linhas = await tx`SELECT pe.monday_user_id AS uid, count(DISTINCT r.conteudo_id)::int AS n FROM vybe_conteudo_responsaveis r
     JOIN vybe_pessoas pe ON pe.id=r.pessoa_id JOIN vybe_conteudo_clientes cc ON cc.conteudo_id=r.conteudo_id JOIN vybe_conteudos c ON c.id=r.conteudo_id
     WHERE cc.cliente_id=${p.cliente_id} AND pe.monday_user_id = ANY(${ids}::text[]) AND c.removido_em IS NULL
      AND COALESCE(c.veiculacao, c.prazo) >= (now() AT TIME ZONE 'America/Bahia')::date - 120
     GROUP BY 1 ORDER BY 2 DESC, 1`;
    historico.set(chave, linhas[0] && (!linhas[1] || linhas[0].n > linhas[1].n) ? [String(linhas[0].uid)] : ids);
   }
   return historico.get(chave);
  };
  const criadas = [];
  for (const peca of conteudo.pecas) {
   if (peca.conteudo_id) continue;
   if (!peca.data) throw erro(`A peça "${peca.tema || peca.formato}" está sem dia. Reabra o planejamento e preencha.`, 400);
   const formato = FORMATO_DO_PAINEL[peca.formato] || 'Card';
   const d = destinos?.[peca.formato] || {}, avulso = peca.formato === 'Outro';
   const r = await criarConteudoNaTransacao(tx, quem, {
    board: avulso ? BOARD_DEMANDAS : BOARD_PRODUCAO, titulo: `${formato} - ${peca.tema || 'Sem tema'}`.slice(0, 240), cliente: p.cliente, formato,
    prazo: prazoDaPeca(peca.data, hoje), veiculacao: peca.data, status: avulso ? 'nova_demanda' : d.status || 'a_fazer', grupo_id: avulso ? null : d.grupo_id || null,
    briefing: briefingDaPeca(peca, mesTexto), tipo_conteudo: avulso ? null : 3,
    captacao: avulso ? null : d.captacao || null, responsaveis: avulso ? [] : await quemFaz(d.responsaveis),
   });
   peca.conteudo_id = String(r.conteudo_id);
   criadas.push(r);
  }
  if (!criadas.length) throw erro('Este planejamento não tem peças para cadastrar.', 400);
  const [n] = await tx`UPDATE vybe_planejamentos SET conteudo=${JSON.stringify(conteudo)}::jsonb,estado='cadastrado',atualizado_em=now() WHERE id=${id} RETURNING *`;
  await registrar(tx, id, 'cadastrado', { autor: pessoa.id, versao: n.versao, texto: `${criadas.length} ${criadas.length === 1 ? 'peça cadastrada' : 'peças cadastradas'} pelo botão.` });
  return { planejamento: { ...publico(n), cliente: p.cliente }, criadas: criadas.map((c) => ({ conteudo_id: String(c.conteudo_id), titulo: c.titulo })) };
 });
}
export async function comentarPlanejamento(sql, pessoa, { id, texto: t }) {
 await exigir(sql);
 const limpo = texto(t, 4000);
 if (!limpo) throw erro('Escreva o comentário.');
 const [p] = await sql`SELECT id FROM vybe_planejamentos WHERE id=${id}`;
 if (!p) throw erro('Planejamento não encontrado.', 404);
 await registrar(sql, id, 'comentario', { autor: pessoa.id, texto: limpo });
 return { ok: true };
}
export async function registrarArquivos(sql, id, { docId, pdfId }) {
 await sql`UPDATE vybe_planejamentos SET drive_doc_id=COALESCE(${docId || null},drive_doc_id),drive_pdf_id=COALESCE(${pdfId || null},drive_pdf_id) WHERE id=${id}`;
}
export async function registrarEvento(sql, id, tipo, opcoes) { await registrar(sql, id, tipo, opcoes); }

// --- Cliente (link externo) --------------------------------------------------------
export async function planejamentoDoLink(sql, token) {
 await exigir(sql);
 if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(token || ''))) throw erro('Link inválido.', 404);
 const [p] = await sql`SELECT p.*,c.nome AS cliente,c.identidade FROM vybe_planejamentos p JOIN vybe_clientes c ON c.id=p.cliente_id WHERE p.link_hash=${hashDoLink(token)}`;
 if (!p) throw erro('Este link não vale mais. Peça um novo à Vybe.', 404);
 if (p.link_expira_em && new Date(p.link_expira_em) < new Date() && p.estado === 'enviado') throw erro('Este link expirou. Peça um novo à Vybe.', 410);
 return publico(p);
}
export async function responderDoCliente(sql, token, { acao, nome, texto: t }) {
 await exigir(sql);
 if (!['aprovar', 'ajustes'].includes(acao)) throw erro('Resposta inválida.');
 const quem = texto(nome, 80), comentario = texto(t, 4000);
 if (!quem) throw erro('Escreva seu nome.');
 if (acao === 'ajustes' && !comentario) throw erro('Conte o que precisa mudar.');
 return sql.comTransacao(async (tx) => {
  const [p] = await tx`SELECT * FROM vybe_planejamentos WHERE link_hash=${hashDoLink(token)} FOR UPDATE`;
  if (!p) throw erro('Este link não vale mais. Peça um novo à Vybe.', 404);
  if (p.estado !== 'enviado') return { ...publico(p), repetido: true };
  if (p.link_expira_em && new Date(p.link_expira_em) < new Date()) throw erro('Este link expirou. Peça um novo à Vybe.', 410);
  const estado = acao === 'aprovar' ? 'aprovado' : 'ajustes';
  const [n] = await tx`UPDATE vybe_planejamentos SET estado=${estado},respondido_em=now(),resposta_nome=${quem},resposta_texto=${comentario || null},atualizado_em=now() WHERE id=${p.id} RETURNING *`;
  await registrar(tx, p.id, estado === 'aprovado' ? 'aprovado' : 'ajustes', { externo: quem, texto: comentario || null, versao: n.versao });
  return publico(n);
 });
}
export { ESTADOS };

// Aviso do head: alertas das peças dos clientes em que a pessoa é head (quem
// administra vê todos), por cliente, só onde há algo.
export async function alertasDoHead(sql, pessoa) {
 const ids = pessoa?.admin ? null : (await sql`SELECT cliente_id FROM vybe_cliente_pessoas WHERE pessoa_id=${pessoa?.id ?? null}`).map((h) => String(h.cliente_id));
 if (ids && !ids.length) return [];
 const por = await alertasDosClientes(sql, { clienteIds: ids });
 const nomes = new Map((await sql`SELECT id,nome FROM vybe_clientes`).map((c) => [String(c.id), c.nome]));
 return [...por.entries()].filter(([, a]) => a.total).map(([id, a]) => ({ cliente_id: id, cliente: nomes.get(id) || '', ...a }))
  .sort((x, y) => y.total - x.total);
}
