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
