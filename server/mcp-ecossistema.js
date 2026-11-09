// Conector "Ecossistema Vybe" para os chats do Claude (Paulo, 09/11/2026).
//
// Cada cliente tem um chat no Claude.ai (contas gestaovybe e a segunda conta, as
// duas no plano Max) que gera conteúdos, planejamentos e decisões. Este conector
// é um servidor MCP: o Claude.ai chama estas ferramentas no meio da conversa e o
// que o chat produz entra no cadastro único do cliente (server/clientes-cadastro.js),
// fica na aba Cérebro da ficha e ganha uma cópia em .md na pasta do cliente no Drive.
//
// Protocolo: MCP por HTTP (JSON-RPC 2.0 num POST só, resposta JSON, sem sessão).
// Entrada: /mcp/<chave>. Cada conta do Claude.ai tem a sua chave, guardada em
// VYBE_MCP_CHAVES ("gestao:chave1,segunda:chave2"); trocar a chave corta a conta.
// O conector só lê cadastro e só ACRESCENTA registros: não apaga, não muda status
// de peça, não fala com cliente.

import { createHash, timingSafeEqual } from 'node:crypto';
import { completude, valorDoCampo, CAMPOS_CADASTRO } from './clientes-cadastro.js';
import { tabelaRegras } from './assistente-regras.js';

export const VERSAO_PROTOCOLO = '2025-06-18';
const TIPOS = ['conteudo', 'planejamento', 'roteiro', 'decisao', 'regra_de_marca', 'aprendizado'];
const STATUS = ['rascunho', 'aprovado', 'enviado_ao_cliente'];

// ── chave por conta ──────────────────────────────────────────────────────────
export function lerChaves(texto = process.env.VYBE_MCP_CHAVES || '') {
  return String(texto).split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf(':');
    return i > 0 ? { conta: p.slice(0, i).trim(), chave: p.slice(i + 1).trim() } : null;
  }).filter((c) => c && c.conta && c.chave.length >= 24);
}
const hash = (v) => createHash('sha256').update(String(v)).digest();
export function contaDaChave(chave, chaves = lerChaves()) {
  if (!chave) return null;
  const h = hash(chave);
  let achada = null;
  for (const c of chaves) if (timingSafeEqual(h, hash(c.chave))) achada = c.conta; // compara todas: tempo igual
  return achada;
}

// ── ferramentas ──────────────────────────────────────────────────────────────
export const FERRAMENTAS = [
  {
    name: 'listar_clientes',
    title: 'Listar clientes ativos da Vybe',
    description: 'Lista os clientes ativos do Vybe OS com o nome exato do painel. Use antes de registrar, para escrever o nome do cliente igual ao do sistema.',
    inputSchema: { type: 'object', properties: { busca: { type: 'string', description: 'Parte do nome (opcional).' } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'consultar_cliente',
    title: 'Consultar a ficha do cliente',
    description: 'Lê do Vybe OS o cadastro do cliente (contrato, responsável, canais, escopo, observações), o que falta no cadastro e os últimos registros feitos pelos chats. Use no começo do trabalho para não usar informação velha.',
    inputSchema: { type: 'object', properties: { cliente: { type: 'string', description: 'Nome do cliente como está no Vybe OS.' } }, required: ['cliente'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'registrar',
    title: 'Registrar no ecossistema Vybe',
    description: 'Grava no Vybe OS uma entrega definitiva deste chat (conteúdo aprovado, planejamento, roteiro, decisão do cliente, regra de marca ou aprendizado). Vai para a ficha do cliente, o cérebro do VYBES e uma cópia .md na pasta do cliente no Drive. Não use para conversa solta, testes ou ideias descartadas.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nome do cliente como está no Vybe OS.' },
        tipo: { type: 'string', enum: TIPOS },
        titulo: { type: 'string', description: 'Frase curta.' },
        status: { type: 'string', enum: STATUS },
        resumo: { type: 'string', description: 'O que foi feito, em 3 a 5 linhas.' },
        decisoes: { type: 'string', description: 'O que muda daqui para frente (tom, cores, proibições, preferências). Vazio se nada mudou.' },
        proximos_passos: { type: 'string', description: 'Quem faz o quê e até quando.' },
        conteudo: { type: 'string', description: 'O texto completo da entrega (legenda, roteiro, planejamento em markdown). Opcional.' },
      },
      required: ['cliente', 'tipo', 'titulo', 'resumo'],
      additionalProperties: false,
    },
  },
];

const semSinais = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function erroDeUso(msg) { return Object.assign(new Error(msg), { deUso: true }); }

// O nome que o chat escreveu → um cliente ativo. Igual sem acento/espaço, ou um
// único que contém o outro. Mais de um parecido: devolve as opções, nunca chuta.
export function acharCliente(nome, clientes) {
  const alvo = semSinais(nome);
  if (!alvo) throw erroDeUso('Informe o nome do cliente.');
  const exato = clientes.find((c) => semSinais(c.nome) === alvo);
  if (exato) return exato;
  const parecidos = clientes.filter((c) => { const n = semSinais(c.nome); return n.length >= 3 && alvo.length >= 3 && (n.includes(alvo) || alvo.includes(n)); });
  if (parecidos.length === 1) return parecidos[0];
  const lista = (parecidos.length ? parecidos : clientes).slice(0, 25).map((c) => c.nome).join(', ');
  throw erroDeUso(parecidos.length
    ? `Mais de um cliente parecido com "${nome}": ${lista}. Repita com o nome exato.`
    : `Cliente "${nome}" não encontrado entre os ativos do Vybe OS. Clientes ativos: ${lista}. Se for cliente novo, ele precisa ser cadastrado no Vybe OS antes.`);
}

const texto = (v, max) => String(v ?? '').trim().slice(0, max);

export function validarRegistro(a = {}) {
  const r = {
    tipo: texto(a.tipo, 40), titulo: texto(a.titulo, 200), status: texto(a.status, 40) || 'rascunho',
    resumo: texto(a.resumo, 4000), decisoes: texto(a.decisoes, 8000), proximos: texto(a.proximos_passos, 4000),
    conteudo: texto(a.conteudo, 60000),
  };
  if (!TIPOS.includes(r.tipo)) throw erroDeUso(`tipo precisa ser um de: ${TIPOS.join(', ')}.`);
  if (!STATUS.includes(r.status)) throw erroDeUso(`status precisa ser um de: ${STATUS.join(', ')}.`);
  if (!r.titulo) throw erroDeUso('Informe o título.');
  if (!r.resumo) throw erroDeUso('Informe o resumo.');
  return r;
}

// As linhas de um registro de regra de marca que viram regras: as "decisões" (ou, sem elas, o resumo), uma por linha,
// sem marcador de lista. No máximo 12, cada uma com até 300 caracteres.
export function regrasDoRegistro(r) {
  return String(r.decisoes || r.resumo || '').split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length >= 4).slice(0, 12).map((l) => l.slice(0, 300));
}

export function registroEmMarkdown({ cliente, conta, em, r }) {
  const dia = String(em).slice(0, 10);
  return `---\nregistro_vybe: true\ncliente: ${cliente}\ndata: ${dia}\ntipo: ${r.tipo}\ntitulo: ${r.titulo.replace(/\n/g, ' ')}\nstatus: ${r.status}\norigem: Claude.ai (${conta})\n---\n`
    + `## Resumo\n${r.resumo}\n`
    + (r.decisoes ? `\n## Decisões e regras novas\n${r.decisoes}\n` : '')
    + (r.proximos ? `\n## Próximos passos\n${r.proximos}\n` : '')
    + (r.conteudo ? `\n## Conteúdo\n${r.conteudo}\n` : '');
}

const tabelaPronta = new WeakSet();
export async function garantirTabelaDeRegistros(db) {
  if (tabelaPronta.has(db)) return;
  await db`CREATE TABLE IF NOT EXISTS vybe_cliente_registros (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, titulo TEXT NOT NULL, status TEXT NOT NULL,
    resumo TEXT NOT NULL, decisoes TEXT, proximos TEXT, conteudo TEXT,
    origem TEXT NOT NULL, drive_id TEXT, drive_erro TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS vybe_cliente_registros_cliente ON vybe_cliente_registros (cliente_id, criado_em DESC)`;
  // Quando as linhas do registro viraram regras do cliente. Vazio = ainda não: os registros de regra de marca feitos antes
  // desta coluna existir (retrospectiva de 09/11) são convertidos uma vez, sem repetir regra igual.
  await db`ALTER TABLE vybe_cliente_registros ADD COLUMN IF NOT EXISTS regras_em TIMESTAMPTZ`;
  tabelaPronta.add(db);
  await converterRegrasPendentes(db).catch((e) => console.error('[mcp-ecossistema] regras pendentes', e));
}

// Cada linha das decisões de um registro de regra de marca vira uma regra em vybe_ai_regras_cliente (lida pela revisão de
// arte, pelas legendas e pela memória do VYBES). Devolve quantas regras novas entraram.
async function regrasDoRegistroParaCliente(db, clienteId, r) {
  await tabelaRegras(db);
  let novas = 0;
  for (const texto of regrasDoRegistro(r)) {
    const [ja] = await db`SELECT 1 AS ok FROM vybe_ai_regras_cliente WHERE cliente_id=${clienteId} AND removida_em IS NULL AND LOWER(texto)=LOWER(${texto}) LIMIT 1`;
    if (ja) continue;
    await db`INSERT INTO vybe_ai_regras_cliente (cliente_id, texto) VALUES (${clienteId}, ${texto})`;
    novas++;
  }
  return novas;
}

export async function converterRegrasPendentes(db) {
  const pendentes = await db`SELECT id, cliente_id, resumo, decisoes FROM vybe_cliente_registros
    WHERE tipo = 'regra_de_marca' AND regras_em IS NULL ORDER BY criado_em LIMIT 200`;
  let novas = 0;
  for (const g of pendentes) {
    novas += await regrasDoRegistroParaCliente(db, g.cliente_id, g);
    await db`UPDATE vybe_cliente_registros SET regras_em = NOW() WHERE id = ${g.id}`;
  }
  return { registros: pendentes.length, regras: novas };
}

async function clientesAtivos(db) {
  return db`SELECT id, nome, cnpj, segmento, endereco, email, telefone, plano, valor, cadastro FROM vybe_clientes
    WHERE apagado_em IS NULL AND COALESCE(ativo, true) AND NOT COALESCE(nao_e_cliente, false) ORDER BY nome`;
}

// O que o chat pode ler do cadastro: sem valor e vencimento (dinheiro fica no painel).
function cadastroParaChat(c) {
  const linhas = CAMPOS_CADASTRO.filter((k) => !k.dinheiro).map((k) => [k.rotulo, valorDoCampo(c, k)]).filter(([, v]) => v);
  return linhas.map(([r, v]) => `- ${r}: ${v}`).join('\n');
}

export async function executarFerramenta(db, nome, args = {}, { conta, salvarNoDrive = null } = {}) {
  if (nome === 'listar_clientes') {
    const busca = semSinais(args.busca);
    const lista = (await clientesAtivos(db)).filter((c) => !busca || semSinais(c.nome).includes(busca));
    return lista.length ? `Clientes ativos (${lista.length}):\n${lista.map((c) => `- ${c.nome}${c.segmento ? ` (${c.segmento})` : ''}`).join('\n')}`
      : 'Nenhum cliente ativo com esse nome.';
  }
  if (nome === 'consultar_cliente') {
    await garantirTabelaDeRegistros(db);
    const c = acharCliente(args.cliente, await clientesAtivos(db));
    const comp = completude(c);
    const regs = await db`SELECT tipo, titulo, status, resumo, decisoes, criado_em FROM vybe_cliente_registros
      WHERE cliente_id=${c.id} ORDER BY criado_em DESC LIMIT 10`;
    return `# ${c.nome}\n\n## Cadastro\n${cadastroParaChat(c) || '(vazio)'}\n\n`
      + `Cadastro com ${comp.feitos} de ${comp.total} itens essenciais.${comp.faltam.length ? ` Falta: ${comp.faltam.join(', ')}.` : ''}\n\n`
      + `## Últimos registros dos chats\n${regs.length ? regs.map((g) => `- ${String(g.criado_em instanceof Date ? g.criado_em.toISOString() : g.criado_em).slice(0, 10)} · ${g.tipo} · ${g.titulo} (${g.status})\n  ${String(g.resumo).replace(/\n/g, ' ').slice(0, 300)}${g.decisoes ? `\n  Decisões: ${String(g.decisoes).replace(/\n/g, ' ').slice(0, 300)}` : ''}`).join('\n') : '(nenhum ainda)'}`;
  }
  if (nome === 'registrar') {
    await garantirTabelaDeRegistros(db);
    const r = validarRegistro(args);
    const c = acharCliente(args.cliente, await clientesAtivos(db));
    const origem = `Claude.ai · ${conta}`;
    const [novo] = await db`INSERT INTO vybe_cliente_registros (cliente_id, tipo, titulo, status, resumo, decisoes, proximos, conteudo, origem)
      VALUES (${c.id}, ${r.tipo}, ${r.titulo}, ${r.status}, ${r.resumo}, ${r.decisoes || null}, ${r.proximos || null}, ${r.conteudo || null}, ${origem})
      RETURNING id, criado_em`;
    // Regra de marca vira regra do cliente (vybe_ai_regras_cliente): é a tabela que a memória do VYBES, as legendas
    // da Vybe IA e a revisão de arte (Danilo) já leem. Uma regra por linha; a que já existe não repete.
    let regrasNovas = 0;
    if (r.tipo === 'regra_de_marca') {
      regrasNovas = await regrasDoRegistroParaCliente(db, c.id, r);
      await db`UPDATE vybe_cliente_registros SET regras_em = NOW() WHERE id = ${novo.id}`;
    }
    const avisoRegras = regrasNovas ? ` ${regrasNovas} regra(s) nova(s) entraram nas regras do cliente: valem na revisão de arte, nas legendas e na memória do VYBES.` : '';
    // O banco é a fonte; o Drive é cópia. Falha no Drive não perde o registro.
    let drive = '';
    if (salvarNoDrive) {
      try {
        const em = novo.criado_em instanceof Date ? novo.criado_em.toISOString() : String(novo.criado_em);
        const id = await salvarNoDrive({ cliente: c, nome: `${em.slice(0, 10)} ${r.tipo} - ${r.titulo.slice(0, 80).replace(/[\\/:*?"<>|]/g, '-')}.md`,
          markdown: registroEmMarkdown({ cliente: c.nome, conta, em, r }) });
        await db`UPDATE vybe_cliente_registros SET drive_id=${id} WHERE id=${novo.id}`;
        drive = ' Cópia .md salva na pasta do cliente no Drive.';
        // O Drive voltou: reenvia as cópias deste cliente que tinham falhado (até 5 por vez).
        const pendentes = await db`SELECT id, tipo, titulo, status, resumo, decisoes, proximos, conteudo, origem, criado_em FROM vybe_cliente_registros
          WHERE cliente_id=${c.id} AND drive_id IS NULL AND drive_erro IS NOT NULL ORDER BY criado_em LIMIT 5`;
        for (const p of pendentes) {
          try {
            const emP = p.criado_em instanceof Date ? p.criado_em.toISOString() : String(p.criado_em);
            const rp = { tipo: p.tipo, titulo: p.titulo, status: p.status, resumo: p.resumo, decisoes: p.decisoes || '', proximos: p.proximos || '', conteudo: p.conteudo || '' };
            const idP = await salvarNoDrive({ cliente: c, nome: `${emP.slice(0, 10)} ${p.tipo} - ${p.titulo.slice(0, 80).replace(/[\\/:*?"<>|]/g, '-')}.md`,
              markdown: registroEmMarkdown({ cliente: c.nome, conta: String(p.origem).replace(/^Claude\.ai · /, ''), em: emP, r: rp }) });
            await db`UPDATE vybe_cliente_registros SET drive_id=${idP}, drive_erro=NULL WHERE id=${p.id}`;
          } catch { break; }
        }
      } catch (e) {
        await db`UPDATE vybe_cliente_registros SET drive_erro=${String(e.message || e).slice(0, 300)} WHERE id=${novo.id}`;
        drive = ' A cópia no Drive falhou agora; o registro está salvo no Vybe OS.';
      }
    }
    return `Registrado em ${c.nome} (registro ${novo.id}).${avisoRegras}${drive}`;
  }
  throw erroDeUso(`Ferramenta desconhecida: ${nome}.`);
}

// ── JSON-RPC ─────────────────────────────────────────────────────────────────
const resposta = (id, result) => ({ jsonrpc: '2.0', id, result });
const falha = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export async function atenderMensagem(db, msg, contexto) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return falha(msg?.id, -32600, 'Pedido inválido.');
  const { id, method, params = {} } = msg;
  const notificacao = id === undefined || id === null;
  if (method.startsWith('notifications/')) return null;
  if (method === 'initialize') {
    return resposta(id, {
      protocolVersion: VERSAO_PROTOCOLO,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'ecossistema-vybe', title: 'Ecossistema Vybe', version: '1.0.0' },
      instructions: 'Ferramentas do Vybe OS, o sistema da agência Vybe. Use consultar_cliente no começo do trabalho de um cliente e registrar ao fechar uma entrega definitiva. O nome do cliente tem de ser o do Vybe OS (listar_clientes mostra).',
    });
  }
  if (method === 'ping') return resposta(id, {});
  if (method === 'tools/list') return resposta(id, { tools: FERRAMENTAS });
  if (method === 'tools/call') {
    const nome = String(params.name || '');
    if (!FERRAMENTAS.some((f) => f.name === nome)) return falha(id, -32602, `Ferramenta desconhecida: ${nome}.`);
    try {
      const textoSaida = await executarFerramenta(db, nome, params.arguments || {}, contexto);
      return resposta(id, { content: [{ type: 'text', text: textoSaida }], isError: false });
    } catch (e) {
      if (e.deUso) return resposta(id, { content: [{ type: 'text', text: e.message }], isError: true });
      console.error('[mcp-ecossistema]', nome, e);
      return resposta(id, { content: [{ type: 'text', text: 'O Vybe OS não conseguiu concluir agora. Tente de novo em instantes.' }], isError: true });
    }
  }
  if (notificacao) return null;
  return falha(id, -32601, `Método não suportado: ${method}.`);
}

// Rota HTTP: /mcp/<chave> → /api/painel?area=mcp&chave=<chave>.
export async function areaMcp(req, res, db, { chaves = lerChaves(), salvarNoDrive = null } = {}) {
  const conta = contaDaChave(String(req.query?.chave || ''), chaves);
  if (!conta) return res.status(404).json({ error: 'Não encontrado.' });
  if (req.method === 'DELETE') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  let corpo = req.body;
  if (typeof corpo === 'string') { try { corpo = JSON.parse(corpo); } catch { return res.status(400).json(falha(null, -32700, 'JSON inválido.')); } }
  const contexto = { conta, salvarNoDrive };
  if (Array.isArray(corpo)) {
    const saidas = (await Promise.all(corpo.map((m) => atenderMensagem(db, m, contexto)))).filter(Boolean);
    return saidas.length ? res.status(200).json(saidas) : res.status(202).end();
  }
  const saida = await atenderMensagem(db, corpo, contexto);
  if (!saida) return res.status(202).end();
  return res.status(200).json(saida);
}
