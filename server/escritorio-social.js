// Escritório: post-its nas paredes e presentes de móveis entre colegas
// (migrations/2026-10-18-escritorio-postits-presentes.sql). Identidade e
// permissões vêm da sessão; o navegador só escolhe texto, cor e lugar.
import { carregarEconomia, MOVEIS_ESSENCIAIS } from './escritorio-economia.js';
import { partesDaCamada } from './escritorio-quartos.js';

const CAMADA = /^(sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge)$/;
const CORES = ['amarelo', 'rosa', 'azul', 'verde'];
const LIMITE_POR_CENA = 40;
const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });

export async function socialPronto(sql) {
 const [r] = await sql`SELECT (to_regclass('public.vybe_escritorio_postits') IS NOT NULL AND to_regclass('public.vybe_escritorio_presentes') IS NOT NULL) AS existe`;
 return Boolean(r?.existe);
}
const exigirTabelas = async (sql) => { if (!await socialPronto(sql)) throw erro('Post-its e presentes aguardam a migração do banco.', 503); };

export async function listarPostits(sql, camada) {
 if (!CAMADA.test(String(camada))) throw erro('Sala inválida.');
 if (!await socialPronto(sql)) return [];
 const linhas = await sql`SELECT t.id,t.lado,t.posicao,t.altura,t.cor,t.texto,t.pessoa_id,p.nome,t.criado_em FROM vybe_escritorio_postits t
  JOIN vybe_pessoas p ON p.id=t.pessoa_id WHERE t.camada=${camada} ORDER BY t.criado_em LIMIT ${LIMITE_POR_CENA}`;
 return linhas.map((l) => ({ ...l, id: String(l.id), pessoa_id: String(l.pessoa_id), posicao: Number(l.posicao), altura: Number(l.altura), lado: Number(l.lado) }));
}
// Qualquer pessoa da equipe cola recado numa sala (como num escritório de
// verdade); apagar é de quem escreveu, do dono do quarto ou de quem administra.
export async function colarPostit(sql, pessoa, { camada, lado, posicao, altura = 0.55, cor, texto }) {
 await exigirTabelas(sql);
 const t = String(texto || '').replace(/\s+/g, ' ').trim();
 if (!CAMADA.test(String(camada))) throw erro('Sala inválida.');
 if (![0, 1].includes(Number(lado)) || !(Number(posicao) >= 0 && Number(posicao) <= 20) || !(Number(altura) >= 0 && Number(altura) <= 1)) throw erro('Lugar inválido na parede.');
 if (!CORES.includes(cor)) throw erro('Cor inválida.');
 if (!t || t.length > 280) throw erro('Escreva de 1 a 280 caracteres.');
 return sql.comTransacao(async (tx) => {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${'postits:' + camada}))`;
  const [n] = await tx`SELECT count(*)::int AS n FROM vybe_escritorio_postits WHERE camada=${camada}`;
  if (n.n >= LIMITE_POR_CENA) throw erro(`Esta sala já tem ${LIMITE_POR_CENA} post-its. Tire algum antes.`, 409);
  const [r] = await tx`INSERT INTO vybe_escritorio_postits(camada,lado,posicao,altura,cor,texto,pessoa_id)
   VALUES(${camada},${Number(lado)},${Math.round(Number(posicao) * 100) / 100},${Math.round(Number(altura) * 100) / 100},${cor},${t},${pessoa.id}) RETURNING id`;
  return String(r.id);
 });
}
export async function apagarPostit(sql, pessoa, salas, id) {
 await exigirTabelas(sql);
 if (!/^\d{1,18}$/.test(String(id))) throw erro('Post-it inválido.');
 const [p] = await sql`SELECT camada,pessoa_id FROM vybe_escritorio_postits WHERE id=${id}`;
 if (!p) throw erro('Esse post-it já saiu da parede.', 404);
 const dono = salas.find((s) => s.id === partesDaCamada(p.camada)?.raiz)?.pessoa_id;
 if (String(p.pessoa_id) !== String(pessoa.id) && String(dono) !== String(pessoa.id) && !pessoa.admin) throw erro('Só quem escreveu ou o dono da sala tira este post-it.', 403);
 await sql`DELETE FROM vybe_escritorio_postits WHERE id=${id}`;
 return p.camada;
}
// Presente: uma unidade guardada (não colocada em nenhum andar) passa para a
// outra pessoa, na mesma transação, com a carteira de inventário bloqueada.
export async function darPresente(sql, pessoa, salas, { para, classe, chave }) {
 await exigirTabelas(sql);
 if (!/^\d{1,18}$/.test(String(para)) || String(para) === String(pessoa.id)) throw erro('Escolha outra pessoa da equipe.');
 if (typeof classe !== 'string' || !/^[a-z0-9_]{1,64}$/i.test(classe) || MOVEIS_ESSENCIAIS.includes(classe) || classe.startsWith('vybeimg_')) throw erro('Este móvel não se dá de presente.');
 if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(chave))) throw erro('Pedido inválido.');
 return sql.comTransacao(async (tx) => {
  const [alvo] = await tx`SELECT id FROM vybe_pessoas WHERE id=${para} AND ativo=TRUE AND pode_entrar=TRUE`;
  if (!alvo) throw erro('Essa pessoa não está na equipe do escritório.', 404);
  // Repetiu o mesmo pedido (rede instável): devolve o resultado sem dar de novo.
  const [ja] = await tx`SELECT de_pessoa FROM vybe_escritorio_presentes WHERE chave=${chave}`;
  if (ja) {
   if (String(ja.de_pessoa) !== String(pessoa.id)) throw erro('Pedido inválido.');
   return { repetido: true, economia: await carregarEconomia(tx, pessoa.id) };
  }
  // (Sem a tabela da loja não há marcos; uma consulta que falha abortaria a transação.)
  const [loja] = await tx`SELECT to_regclass('public.vybe_escritorio_catalogo') IS NOT NULL AS existe`;
  if (loja?.existe && (await tx`SELECT 1 FROM vybe_escritorio_catalogo WHERE classe=${classe} AND marco IS NOT NULL`).length)
   throw erro('Móvel de marco é pessoal: não se dá de presente.', 409);
  const [inv] = await tx`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoa.id} AND classe=${classe} FOR UPDATE`;
  const sala = salas.find((s) => s.pessoa_id === String(pessoa.id))?.id;
  const colocadas = sala ? (await tx`SELECT itens FROM vybe_escritorio_mapa WHERE camada=${sala} OR camada=${sala + '-andar-1'}`)
   .flatMap((m) => m.itens || []).filter((it) => it[0] === classe).length : 0;
  if (!inv || Number(inv.quantidade) - colocadas < 1) throw erro('Guarde uma unidade desse móvel (tire do quarto) antes de dar de presente.', 409);
  if (Number(inv.quantidade) === 1) await tx`DELETE FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoa.id} AND classe=${classe}`;
  else await tx`UPDATE vybe_escritorio_inventario SET quantidade=quantidade-1 WHERE pessoa_id=${pessoa.id} AND classe=${classe}`;
  await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${para},${classe},1)
   ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
  await tx`INSERT INTO vybe_escritorio_presentes(chave,de_pessoa,para_pessoa,classe) VALUES(${chave},${pessoa.id},${para},${classe})`;
  return { repetido: false, economia: await carregarEconomia(tx, pessoa.id) };
 });
}

// ---------------------------------------------------------------------------
// Troca de móveis entre colegas, como no Habbo (migrations/2026-10-19-escritorio-trocas.sql).
// Quem propõe dá alguns móveis guardados e pede outros; quem recebe aceita ou
// recusa. Na aceitação tudo é conferido de novo e trocado numa transação.
export async function trocasProntas(sql) {
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_trocas') IS NOT NULL AS existe`;
 return Boolean(r?.existe);
}
const exigirTrocas = async (sql) => { if (!await trocasProntas(sql)) throw erro('A troca de móveis aguarda a migração do banco.', 503); };
// Lista [[classe, quantidade]] limpa: só móveis que se trocam, sem repetir classe.
function itensDaTroca(lista) {
 if (!Array.isArray(lista) || lista.length > 12) throw erro('Escolha até 12 móveis de cada lado.');
 const por = new Map();
 for (const it of lista) {
  const [classe, qtd] = Array.isArray(it) ? it : [it?.classe, it?.quantidade];
  const n = Number(qtd);
  if (typeof classe !== 'string' || !/^[a-z0-9_]{1,64}$/i.test(classe) || MOVEIS_ESSENCIAIS.includes(classe) || classe.startsWith('vybeimg_')) throw erro('Este móvel não se troca.');
  if (!Number.isInteger(n) || n < 1 || n > 20) throw erro('Quantidade inválida.');
  por.set(classe, (por.get(classe) || 0) + n);
 }
 return [...por.entries()];
}
// Unidades guardadas (fora do quarto e do segundo andar) de cada classe.
async function guardadas(tx, pessoaId, salas, classes) {
 const sala = salas.find((s) => String(s.pessoa_id) === String(pessoaId))?.id;
 const colocadas = new Map();
 if (sala) for (const m of await tx`SELECT itens FROM vybe_escritorio_mapa WHERE camada=${sala} OR camada=${sala + '-andar-1'}`)
  for (const it of m.itens || []) colocadas.set(it[0], (colocadas.get(it[0]) || 0) + 1);
 const inv = await tx`SELECT classe,quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoaId} AND classe = ANY(${classes})`;
 return new Map(classes.map((c) => [c, Math.max(0, Number(inv.find((i) => i.classe === c)?.quantidade || 0) - (colocadas.get(c) || 0))]));
}
async function semMarco(tx, classes) {
 const [loja] = await tx`SELECT to_regclass('public.vybe_escritorio_catalogo') IS NOT NULL AS existe`;
 if (loja?.existe && classes.length && (await tx`SELECT 1 FROM vybe_escritorio_catalogo WHERE classe = ANY(${classes}) AND marco IS NOT NULL`).length)
  throw erro('Móvel de marco é pessoal: não entra em troca.', 409);
}
async function conferirLado(tx, pessoaId, salas, itens, quem) {
 if (!itens.length) return;
 const livres = await guardadas(tx, pessoaId, salas, itens.map(([c]) => c));
 for (const [classe, n] of itens) if ((livres.get(classe) || 0) < n)
  throw erro(quem === 'eu' ? 'Guarde no inventário os móveis que você vai dar (tire do quarto) antes de propor.' : 'A outra pessoa não tem esses móveis guardados agora.', 409);
}
export async function listarTrocas(sql, pessoa) {
 if (!await trocasProntas(sql)) return { disponivel: false, recebidas: [], enviadas: [] };
 const linhas = await sql`SELECT t.id,t.de_pessoa,t.para_pessoa,t.oferece,t.pede,t.estado,t.criado_em,t.resolvido_em,a.nome AS de_nome,b.nome AS para_nome
  FROM vybe_escritorio_trocas t JOIN vybe_pessoas a ON a.id=t.de_pessoa JOIN vybe_pessoas b ON b.id=t.para_pessoa
  WHERE (t.de_pessoa=${pessoa.id} OR t.para_pessoa=${pessoa.id}) AND (t.estado='aberta' OR t.resolvido_em > now() - interval '7 days')
  ORDER BY t.criado_em DESC LIMIT 40`;
 const limpa = (l) => ({ ...l, id: String(l.id), de_pessoa: String(l.de_pessoa), para_pessoa: String(l.para_pessoa) });
 return { disponivel: true, recebidas: linhas.filter((l) => String(l.para_pessoa) === String(pessoa.id)).map(limpa), enviadas: linhas.filter((l) => String(l.de_pessoa) === String(pessoa.id)).map(limpa) };
}
export async function proporTroca(sql, pessoa, salas, { para, oferece, pede, chave }) {
 await exigirTrocas(sql);
 if (!/^\d{1,18}$/.test(String(para)) || String(para) === String(pessoa.id)) throw erro('Escolha outra pessoa da equipe.');
 if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(chave))) throw erro('Pedido inválido.');
 const da = itensDaTroca(oferece || []), quer = itensDaTroca(pede || []);
 if (!da.length && !quer.length) throw erro('Escolha pelo menos um móvel para trocar.');
 return sql.comTransacao(async (tx) => {
  const [alvo] = await tx`SELECT id FROM vybe_pessoas WHERE id=${para} AND ativo=TRUE AND pode_entrar=TRUE`;
  if (!alvo) throw erro('Essa pessoa não está na equipe do escritório.', 404);
  const [ja] = await tx`SELECT id,de_pessoa FROM vybe_escritorio_trocas WHERE chave=${chave}`;
  if (ja) { if (String(ja.de_pessoa) !== String(pessoa.id)) throw erro('Pedido inválido.'); return { repetido: true, id: String(ja.id) }; }
  await semMarco(tx, [...da, ...quer].map(([c]) => c));
  await conferirLado(tx, pessoa.id, salas, da, 'eu');
  await conferirLado(tx, para, salas, quer, 'outro');
  const [t] = await tx`INSERT INTO vybe_escritorio_trocas(chave,de_pessoa,para_pessoa,oferece,pede) VALUES(${chave},${pessoa.id},${para},${JSON.stringify(da)}::jsonb,${JSON.stringify(quer)}::jsonb) RETURNING id`;
  return { repetido: false, id: String(t.id) };
 });
}
async function mover(tx, de, para, itens) {
 for (const [classe, n] of itens) {
  const [inv] = await tx`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${de} AND classe=${classe}`;
  if (Number(inv.quantidade) === n) await tx`DELETE FROM vybe_escritorio_inventario WHERE pessoa_id=${de} AND classe=${classe}`;
  else await tx`UPDATE vybe_escritorio_inventario SET quantidade=quantidade-${n} WHERE pessoa_id=${de} AND classe=${classe}`;
  await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${para},${classe},${n})
   ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+${n}`;
 }
}
// acao: "aceitar" e "recusar" (quem recebeu) ou "cancelar" (quem propôs).
export async function responderTroca(sql, pessoa, salas, { id, acao }) {
 await exigirTrocas(sql);
 if (!/^\d{1,18}$/.test(String(id)) || !['aceitar', 'recusar', 'cancelar'].includes(acao)) throw erro('Pedido inválido.');
 return sql.comTransacao(async (tx) => {
  const [t] = await tx`SELECT * FROM vybe_escritorio_trocas WHERE id=${id} FOR UPDATE`;
  if (!t) throw erro('Troca não encontrada.', 404);
  const eu = String(pessoa.id), de = String(t.de_pessoa), para = String(t.para_pessoa);
  if (acao === 'cancelar' ? eu !== de : eu !== para) throw erro('Só quem recebeu responde; só quem propôs cancela.', 403);
  if (t.estado !== 'aberta') return { estado: t.estado, repetido: true, economia: await carregarEconomia(tx, pessoa.id) };
  if (acao !== 'aceitar') {
   await tx`UPDATE vybe_escritorio_trocas SET estado=${acao === 'recusar' ? 'recusada' : 'cancelada'},resolvido_em=now() WHERE id=${id}`;
   return { estado: acao === 'recusar' ? 'recusada' : 'cancelada', economia: await carregarEconomia(tx, pessoa.id) };
  }
  const da = itensDaTroca(t.oferece || []), quer = itensDaTroca(t.pede || []);
  // Os dois inventários trancados, sempre na mesma ordem (menor id primeiro),
  // para duas trocas ao mesmo tempo não travarem uma à outra.
  await tx`SELECT 1 FROM vybe_escritorio_inventario WHERE pessoa_id IN (${de},${para}) ORDER BY pessoa_id,classe FOR UPDATE`;
  await semMarco(tx, [...da, ...quer].map(([c]) => c));
  await conferirLado(tx, de, salas, da, 'outro');
  await conferirLado(tx, para, salas, quer, 'eu');
  await mover(tx, de, para, da);
  await mover(tx, para, de, quer);
  await tx`UPDATE vybe_escritorio_trocas SET estado='aceita',resolvido_em=now() WHERE id=${id}`;
  return { estado: 'aceita', economia: await carregarEconomia(tx, pessoa.id) };
 });
}
