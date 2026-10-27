// Ações da Vybe AI pelo WhatsApp, sempre em dois passos (Paulo, 26/10/2026: "tudo autorizado").
// 1) prepararAcao confere quem pede, a peça e a permissão, e devolve o resumo + um código assinado
//    (5 min, só para essa pessoa, uso único). 2) confirmarAcao, depois do "SIM", confere tudo de novo e
//    executa com as MESMAS funções do painel (trocarStatus/comentar): histórico, automações e Monday iguais.
// Quem pode: comentar = qualquer pessoa vinculada; Agendado/Publicado = função agendamento; mandar para
// aprovação = responsáveis da peça; decidir uma peça em aprovação = quem aprova (vídeo: heads do cliente,
// ou Vinícius e Ewerton; o resto: Deivid), a mesma regra dos avisos; administração pode tudo.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import vm from 'node:vm';
import { codigoDoPainel, linkDaAtividade } from './assistente-rotinas.js';

const VALIDADE_MS = 5 * 60e3;
const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const comoChave = (v) => normal(v).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const ehVideo = (c) => /^(reels|video|motion)/.test(normal(c.formato || c.titulo));
const negar = (mensagem) => Object.assign(new Error(mensagem), { status: 403, publica: true });
const invalido = (mensagem) => Object.assign(new Error(mensagem), { status: 400, publica: true });
const b64 = (s) => Buffer.from(s).toString('base64url');
const assinar = (dados, segredo) => createHmac('sha256', segredo).update('vybe-ai-acao-v1:' + dados).digest('base64url');

async function pessoaAtiva(sql, pessoaId) {
  const [p] = await sql`SELECT id::text AS id, nome, email, COALESCE(admin, false) AS admin, monday_user_id::text AS monday_id
    FROM vybe_pessoas WHERE id = ${pessoaId} AND ativo IS TRUE AND pode_entrar IS TRUE`;
  if (!p) throw negar('Pessoa sem acesso ao Vybe OS.');
  return p;
}
// Peça pelo número do painel (vybe:N ou N curto) ou pelo número do Monday (N longo).
async function pecaPorReferencia(sql, ref) {
  const texto = String(ref || '').trim();
  const local = /^vybe:\d{1,12}$/.test(texto) ? Number(texto.slice(5)) : /^\d{1,8}$/.test(texto) ? Number(texto) : null;
  const monday = /^\d{9,20}$/.test(texto) ? texto : null;
  if (local === null && monday === null) throw invalido('Informe o número da peça (o do link do painel).');
  const [c] = await sql`SELECT c.id::text AS id, c.monday_item_id::text AS monday_item_id, c.titulo, c.formato, c.board_id::text AS board_id,
      s.rotulo AS status,
      COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id ORDER BY cl.nome), '{}') AS clientes,
      COALESCE(ARRAY(SELECT r.pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id = c.id), '{}') AS responsaveis,
      COALESCE(ARRAY(SELECT h.pessoa_id::text FROM vybe_conteudo_clientes cc JOIN vybe_cliente_pessoas h ON h.cliente_id = cc.cliente_id WHERE cc.conteudo_id = c.id), '{}') AS heads
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND (c.id = ${local} OR c.monday_item_id::text = ${monday})`;
  if (!c) throw invalido('Não encontrei essa peça no Vybe OS.');
  return { ...c, ref: c.monday_item_id || 'vybe:' + c.id };
}
async function temFuncao(sql, pessoaId, funcao) {
  const [t] = await sql`SELECT to_regclass('public.vybe_escritorio_funcoes') IS NOT NULL AS ok`;
  if (!t?.ok) return false;
  const [f] = await sql`SELECT 1 AS ok FROM vybe_escritorio_funcoes WHERE pessoa_id = ${pessoaId} AND funcao = ${funcao}`;
  return Boolean(f);
}
// Mesma regra dos avisos de status (assistente-avisos.js): quem aprova a peça.
function aprovadores(c) {
  const P = vm.runInContext('PESSOAS', codigoDoPainel().ctx);
  if (ehVideo(c)) return { pessoas: c.heads, monday: c.heads.length ? [] : [P.VINICIUS, P.EWERTON_L].filter(Boolean).map(String) };
  return { pessoas: [], monday: [P.DEIVID].filter(Boolean).map(String) };
}
async function conferirPermissao(sql, p, c, alvo) {
  if (p.admin) return;
  const { ctx } = codigoDoPainel();
  const fluxo = (rotulo) => normal(ctx.operationalFlowStatus({ status: rotulo || '', board_id: Number(c.board_id) }));
  const de = fluxo(c.status), para = fluxo(alvo.rotulo);
  if (['para aprovacao', 'em aprovacao'].includes(de)) {
    const a = aprovadores(c);
    if (a.pessoas.includes(p.id) || (p.monday_id && a.monday.includes(p.monday_id))) return;
    throw negar('Esta peça está em aprovação: só quem aprova pode decidir o próximo status.');
  }
  if (['agendado', 'publicado', 'postado'].includes(para)) {
    if (await temFuncao(sql, p.id, 'agendamento')) return;
    throw negar('Marcar como agendado ou publicado é de quem faz o agendamento.');
  }
  if (['para aprovacao', 'em aprovacao'].includes(para)) {
    if (c.responsaveis.includes(p.id)) return;
    throw negar('Só os responsáveis da peça mandam para aprovação.');
  }
  throw negar('Essa mudança de status é só pelo painel ou com a administração.');
}
async function statusDoQuadro(sql, c, para) {
  const lista = await sql`SELECT chave, rotulo FROM vybe_status WHERE board_id = ${c.board_id}`;
  const p = normal(para), k = comoChave(para);
  const alvo = lista.find((s) => s.chave === String(para)) || lista.find((s) => normal(s.rotulo) === p) || lista.find((s) => comoChave(s.rotulo) === k);
  if (!alvo) throw invalido(`Status "${String(para).slice(0, 40)}" não existe neste quadro. Opções: ${lista.map((s) => s.rotulo).join(', ')}.`);
  return alvo;
}

export async function prepararAcao(sql, pessoaId, pedido, segredo, agora = Date.now()) {
  if (!/^.{32,}$/.test(String(segredo || ''))) throw Object.assign(new Error('Ações indisponíveis.'), { status: 503 });
  const { acao, item } = pedido || {};
  if (!['status', 'comentar'].includes(acao)) throw invalido('Ação desconhecida.');
  const p = await pessoaAtiva(sql, pessoaId), c = await pecaPorReferencia(sql, item);
  const nome = `"${c.titulo || 'Sem título'}" (${c.clientes.join(' / ') || 'sem cliente'})`;
  let resumo, valor;
  if (acao === 'comentar') {
    const texto = String(pedido.texto || '').replace(/\s+/g, ' ').trim();
    if (!texto || texto.length > 1000) throw invalido('Escreva o comentário (até 1000 caracteres).');
    resumo = `💬 Comentar em ${nome}:\n“${texto}”`; valor = texto;
  } else {
    const alvo = await statusDoQuadro(sql, c, pedido.para);
    if (normal(alvo.rotulo) === normal(c.status)) throw invalido(`A peça já está em ${alvo.rotulo}.`);
    await conferirPermissao(sql, p, c, alvo);
    resumo = `🔁 Mudar ${nome}\nde *${c.status || 'sem status'}* para *${alvo.rotulo}*`; valor = alvo.chave;
  }
  const dados = b64(JSON.stringify({ p: p.id, c: c.id, a: acao, v: valor, de: c.status || '', e: agora + VALIDADE_MS }));
  return { resumo, codigo: dados + '.' + assinar(dados, segredo), link: linkDaAtividade(c.ref), validade_min: 5 };
}

export async function confirmarAcao(sql, pessoaId, codigo, segredo, { agora = Date.now(), executar } = {}) {
  const [dados, assinatura] = String(codigo || '').split('.');
  const esperada = dados ? assinar(dados, segredo) : '';
  if (!dados || !assinatura || assinatura.length !== esperada.length || !timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) throw invalido('Confirmação inválida.');
  const t = JSON.parse(Buffer.from(dados, 'base64url').toString());
  if (String(t.p) !== String(pessoaId)) throw negar('Só quem pediu pode confirmar.');
  if (!(t.e > agora)) throw invalido('A confirmação expirou. Peça de novo.');
  const p = await pessoaAtiva(sql, pessoaId), c = await pecaPorReferencia(sql, 'vybe:' + t.c);
  // A peça mudou entre o pedido e o SIM: não executa sobre um estado que a pessoa não viu.
  if (t.a === 'status' && normal(c.status) !== normal(t.de)) throw invalido(`A peça mudou para ${c.status} enquanto isso. Peça de novo.`);
  if (t.a === 'status') await conferirPermissao(sql, p, c, await statusDoQuadro(sql, c, t.v));
  // Uso único (e registro de quem fez o quê pelo WhatsApp).
  await sql`CREATE TABLE IF NOT EXISTS vybe_ai_acoes(codigo_hash char(64) PRIMARY KEY, pessoa_id bigint NOT NULL, conteudo_id bigint NOT NULL,
    acao text NOT NULL, valor text, criado_em timestamptz NOT NULL DEFAULT now())`;
  const hashCodigo = createHash('sha256').update(String(codigo)).digest('hex');
  const [nova] = await sql`INSERT INTO vybe_ai_acoes(codigo_hash, pessoa_id, conteudo_id, acao, valor) VALUES (${hashCodigo}, ${p.id}, ${c.id}, ${t.a}, ${String(t.v).slice(0, 1000)})
    ON CONFLICT (codigo_hash) DO NOTHING RETURNING codigo_hash`;
  if (!nova) throw invalido('Esta confirmação já foi usada.');
  // Mesma sessão que o painel usa, identificada pela pessoa do vínculo.
  const quem = { tipo: 'sessao', pessoa: { id: Number(p.id), email: p.email, nome: `${p.nome} (WhatsApp)`, admin: p.admin } };
  const fazer = executar || await import('../api/conteudo.js');
  if (t.a === 'comentar') {
    await fazer.comentar(sql, quem, { item: c.ref, texto: t.v });
    return { feito: `✅ Comentário registrado em "${c.titulo}".`, link: linkDaAtividade(c.ref) };
  }
  const r = await fazer.trocarStatus(sql, quem, { item: c.ref, para: t.v });
  return { feito: `✅ "${c.titulo}" agora está em *${r?.para || t.v}*.${r?.automacao_pendente ? '\n⚠️ A automação do status ficou pendente; confira no painel.' : ''}`, link: linkDaAtividade(c.ref) };
}
