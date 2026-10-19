// Rotas dos planejamentos (docs/planejamentos-plano.md), servidas por
// api/painel.js para não gastar outra função da Vercel:
//   area=planejamentos  painel (sessão): listar, abrir, editar, enviar…
//   /aprovar/<token>    página do cliente (sem login; o token é o segredo)
//   area=agentes        conector MCP dos agentes de conteúdo (chave própria)
import { timingSafeEqual } from 'node:crypto';
import * as P from './planejamentos.js';
import { documentoHtml, nomeDoMes } from './planejamento-documento.js';
import { enviarEmail, emailConfigurado } from './email.js';
import { pastaDePlanejamento, salvarDocumentoEPdf } from '../vybe_drive.js';

const corpoDe = (req) => (req.body && typeof req.body === 'object' ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })());
const base = (req) => process.env.PAINEL_URL || `https://${req.headers?.host || 'vybepainel-v2.vercel.app'}`;
const falha = (res, e) => res.status(e.status || 400).json({ error: e.message });

// ── Painel ───────────────────────────────────────────────────────────────────
export async function areaPlanejamentos(req, res, quem, sql) {
 const pessoa = quem?.pessoa;
 if (!pessoa) return res.status(403).json({ error: 'Entre com a sua conta para ver os planejamentos.' });
 const acao = String(req.query?.acao || corpoDe(req).acao || '');
 try {
  if (req.method === 'GET') {
   if (acao === 'detalhe') return res.status(200).json({ ok: true, planejamento: await P.detalhePlanejamento(sql, pessoa, String(req.query.id || '')) });
   if (acao === 'pendentes') return res.status(200).json({ ok: true, pendentes: await P.pendentesDoHead(sql, pessoa), alertas: await P.alertasDoHead(sql, pessoa) });
   if (acao === 'operacao') return res.status(200).json({ ok: true, postos: await P.postosDaOperacao(sql, pessoa) });
   if (acao === 'previa') {
    const p = await P.detalhePlanejamento(sql, pessoa, String(req.query.id || ''));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(documentoHtml(p));
   }
   const clienteId = /^\d{1,18}$/.test(String(req.query?.cliente_id || '')) ? String(req.query.cliente_id) : null;
   return res.status(200).json({ ok: true, ...(await P.listarPlanejamentos(sql, pessoa, { clienteId })), email: emailConfigurado() });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const b = corpoDe(req);
  if (acao === 'criar') return res.status(200).json({ ok: true, planejamento: await P.criarNoPainel(sql, pessoa, { clienteId: b.cliente_id, mes: b.mes, titulo: b.titulo, conteudo: b.conteudo }) });
  if (acao === 'editar') return res.status(200).json({ ok: true, planejamento: await P.editarPlanejamento(sql, pessoa, b) });
  if (acao === 'estado') return res.status(200).json({ ok: true, planejamento: await P.mudarEstadoInterno(sql, pessoa, b) });
  if (acao === 'comentar') return res.status(200).json(await P.comentarPlanejamento(sql, pessoa, b));
  if (acao === 'identidade') {
   if (!await P.podeEditarCliente(sql, pessoa, b.cliente_id)) return res.status(403).json({ error: 'Só o head do cliente e quem administra mudam a identidade.' });
   const limpa = { cor: /^#[0-9a-f]{6}$/i.test(b.cor || '') ? b.cor : null, cor_apoio: /^#[0-9a-f]{6}$/i.test(b.cor_apoio || '') ? b.cor_apoio : null,
    logo: /^https:\/\/\S{4,500}$/.test(b.logo || '') ? b.logo : null, fonte: /^[A-Za-z0-9 ]{2,40}$/.test(b.fonte || '') ? b.fonte : null, tom: String(b.tom || '').slice(0, 400) || null };
   await sql`UPDATE vybe_clientes SET identidade=${JSON.stringify(limpa)}::jsonb WHERE id=${b.cliente_id}`;
   return res.status(200).json({ ok: true, identidade: limpa });
  }
  if (acao === 'enviar') {
   const env = await P.enviarAoCliente(sql, pessoa, { id: b.id });
   const p = await P.detalhePlanejamento(sql, pessoa, env.id);
   const link = `${base(req)}/aprovar/${env.token}`;
   const avisos = [];
   // Drive e e-mail não seguram o envio: o link já vale; o que falhar fica avisado.
   try {
    const pasta = await pastaDePlanejamento({ cliente: p.cliente, mes: p.mes });
    const arq = await salvarDocumentoEPdf({ html: documentoHtml(p), nome: `${p.cliente} · Planejamento ${nomeDoMes(p.mes)} · v${p.versao}`, pastaId: pasta });
    await P.registrarArquivos(sql, p.id, { docId: arq.docId, pdfId: arq.pdfId });
   } catch (e) { avisos.push('Drive: ' + e.message); }
   if (b.email !== false) {
    try {
     const r = await enviarEmail({ para: p.cliente_email, assunto: `${p.cliente} · Planejamento de ${nomeDoMes(p.mes)} para aprovar`,
      html: `<p>Olá!</p><p>O planejamento de conteúdo de <b>${nomeDoMes(p.mes)}</b> está pronto para a sua aprovação.</p><p><a href="${link}">Ver e aprovar o planejamento</a></p><p>Qualquer ajuste, é só pedir pela mesma página.</p><p>Equipe Vybe</p>`,
      texto: `O planejamento de ${nomeDoMes(p.mes)} está pronto para a sua aprovação: ${link}` });
     await P.registrarEvento(sql, p.id, 'email', { autor: pessoa.id, texto: 'Cópia enviada para ' + r.para.join(', ') });
    } catch (e) { avisos.push('E-mail: ' + e.message); }
   }
   return res.status(200).json({ ok: true, link, avisos, planejamento: await P.detalhePlanejamento(sql, pessoa, env.id) });
  }
  return res.status(400).json({ error: 'Ação inválida.' });
 } catch (e) { return falha(res, e); }
}

// ── Página do cliente ───────────────────────────────────────────────────────
export async function paginaDeAprovacao(req, res, sql) {
 const token = String(req.query?.t || '');
 res.setHeader('Content-Type', 'text/html; charset=utf-8');
 res.setHeader('X-Robots-Tag', 'noindex');
 const pagina = (codigo, titulo, msg) => res.status(codigo).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#fbf9f4;color:#1d2227;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:480px;background:#fff;border:1px solid #e6e1d6;border-radius:16px;padding:24px}</style></head><body><main><h1>${titulo}</h1><p>${msg}</p></main></body></html>`);
 try {
  if (req.method === 'POST') {
   const b = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
   let aviso = '';
   try { await P.responderDoCliente(sql, token, { acao: b.acao, nome: b.nome, texto: b.texto }); }
   catch (e) { if (e.status === 404 || e.status === 410) return pagina(e.status, 'Link indisponível', e.message); aviso = e.message; }
   const p = await P.planejamentoDoLink(sql, token);
   return res.status(200).send(documentoHtml(p, { paraCliente: true, token, aviso }));
  }
  const p = await P.planejamentoDoLink(sql, token);
  return res.status(200).send(documentoHtml(p, { paraCliente: true, token }));
 } catch (e) {
  return pagina(e.status === 410 ? 410 : 404, 'Link indisponível', e.message || 'Este link não vale mais. Peça um novo à Vybe.');
 }
}

// ── Conector dos agentes (MCP por HTTP, JSON-RPC) ───────────────────────────
// Os agentes de conteúdo (projetos no Claude) adicionam o painel como conector
// personalizado: <painel>/api/painel?area=agentes&chave=<AGENTES_CHAVE>.
const FORMATO = `Formato padrão do planejamento Vybe (o mesmo para todos os clientes; a identidade visual vem do cadastro do cliente no painel):
- resumo: 2 a 4 frases sobre a ideia do mês, para o cliente.
- numeros (opcional): [{rotulo, valor}] — se omitido, o painel conta as peças por formato.
- linhas: [{titulo, texto}] — 2 a 4 linhas de conteúdo do mês.
- datas: [{data:"02/11 · seg", nome, texto}] — datas comerciais/feriados que orientam o mês.
- pecas: [{data:"AAAA-MM-DD", formato: Card|Carrossel|Reels|Fotografia|Vídeo|Stories|Outro, tema, legenda, referencia, observacao}].
- observacoes: o que precisa ser combinado com o cliente.
Deixe de fora o que é interno (responsáveis, prazos de produção, pendências do painel).`;
const FERRAMENTAS = [
 { name: 'listar_clientes', description: 'Clientes ativos no painel da Vybe (nome exato para publicar).', inputSchema: { type: 'object', properties: {} } },
 { name: 'formato_do_planejamento', description: 'Como o planejamento deve ser estruturado antes de publicar.', inputSchema: { type: 'object', properties: {} } },
 { name: 'publicar_planejamento', description: 'Publica (ou atualiza) o planejamento do mês de um cliente no painel, para o head revisar e mandar ao cliente.',
  inputSchema: { type: 'object', required: ['cliente', 'mes', 'conteudo'], properties: {
   cliente: { type: 'string', description: 'Nome do cliente como está no painel' }, mes: { type: 'string', description: 'AAAA-MM' }, titulo: { type: 'string' },
   conteudo: { type: 'object', description: 'resumo, numeros, linhas, datas, pecas, observacoes (veja formato_do_planejamento)' } } } },
 { name: 'ver_planejamento', description: 'Situação e comentários (do head e do cliente) do planejamento de um mês, para refazer ajustes.',
  inputSchema: { type: 'object', required: ['cliente', 'mes'], properties: { cliente: { type: 'string' }, mes: { type: 'string', description: 'AAAA-MM' } } } },
];
const chaveConfere = (enviada) => {
 const certa = String(process.env.AGENTES_CHAVE || '');
 if (certa.length < 24) return false;
 const a = Buffer.from(String(enviada || '')), b = Buffer.from(certa);
 return a.length === b.length && timingSafeEqual(a, b);
};
async function chamar(sql, nome, args = {}) {
 if (nome === 'listar_clientes') return (await sql`SELECT nome FROM vybe_clientes WHERE ativo IS NOT FALSE ORDER BY nome`).map((c) => c.nome).join('\n');
 if (nome === 'formato_do_planejamento') return FORMATO;
 if (nome === 'publicar_planejamento') {
  const p = await P.publicarDoAgente(sql, args);
  return `${p.novo ? 'Publicado' : 'Atualizado (versão ' + p.versao + ')'}: ${p.cliente}, ${nomeDoMes(p.mes)}, ${p.conteudo.pecas.length} peças. O head do cliente foi avisado para revisar.`;
 }
 if (nome === 'ver_planejamento') {
  const c = await P.clientePorNomeOuId(sql, args.cliente);
  const [p] = await sql`SELECT id,estado,versao,resposta_nome,resposta_texto FROM vybe_planejamentos WHERE cliente_id=${c.id} AND mes=${P.mesDoTexto(args.mes)}::date AND estado<>'arquivado'`;
  if (!p) return `Ainda não há planejamento de ${c.nome} para ${args.mes}.`;
  const ev = await sql`SELECT tipo,texto,autor_externo,em FROM vybe_planejamento_eventos WHERE planejamento_id=${p.id} AND texto IS NOT NULL ORDER BY em DESC LIMIT 10`;
  return `Situação: ${p.estado} (versão ${p.versao}).${p.resposta_texto ? `\nPedido do cliente (${p.resposta_nome}): ${p.resposta_texto}` : ''}${ev.length ? '\nComentários:\n' + ev.map((e) => `- ${e.texto}`).join('\n') : ''}`;
 }
 throw Object.assign(new Error('Ferramenta desconhecida: ' + nome), { codigo: -32601 });
}
export async function conectorAgentes(req, res, sql) {
 if (!chaveConfere(req.query?.chave)) return res.status(401).json({ error: 'Chave do conector inválida.' });
 if (req.method === 'GET') return res.status(405).json({ error: 'Use POST (MCP).' });
 const m = corpoDe(req);
 const responder = (resultado) => res.status(200).json({ jsonrpc: '2.0', id: m.id ?? null, result: resultado });
 const erroRpc = (codigo, mensagem) => res.status(200).json({ jsonrpc: '2.0', id: m.id ?? null, error: { code: codigo, message: mensagem } });
 if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return erroRpc(-32600, 'Pedido inválido.');
 if (m.id === undefined) return res.status(202).end(); // notificação (ex.: initialized)
 if (m.method === 'initialize') return responder({ protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'painel-vybe', version: '1.0.0' },
  instructions: 'Painel da Vybe: publique o planejamento mensal do cliente com publicar_planejamento depois de ler formato_do_planejamento.' });
 if (m.method === 'ping') return responder({});
 if (m.method === 'tools/list') return responder({ tools: FERRAMENTAS });
 if (m.method === 'tools/call') {
  try { return responder({ content: [{ type: 'text', text: await chamar(sql, m.params?.name, m.params?.arguments || {}) }] }); }
  catch (e) { if (e.codigo) return erroRpc(e.codigo, e.message); return responder({ content: [{ type: 'text', text: 'Não deu: ' + e.message }], isError: true }); }
 }
 return erroRpc(-32601, 'Método não suportado: ' + m.method);
}
