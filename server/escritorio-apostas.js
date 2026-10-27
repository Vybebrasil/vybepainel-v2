// Aposta das mesas de jogo do Escritório (xadrez, dominó…): o que cada um põe
// na mesa, a conferência antes do convite e do aceite, a cobrança quando a
// partida começa e o pagamento no fim. O razão é o mesmo da loja
// ('<jogo>:<id>:aposta|premio|devolucao', sem regra e sem XP: não entra no
// ranking nem no ritmo de trabalho).
import { itensDaTroca, semMarco, conferirLado, tirarDoInventario, porNoInventario } from './escritorio-social.js';
import { roupasDaFigura, roupaDaClasse, CLASSE_ROUPA } from './escritorio-roupas.js';

export const CAMADA = /^(praca|sala-([0-9]|1[01])(-andar-1)?|recepcao|reuniao|auditorio|producao|cafe|jogos|foco|academia|lounge|operacao|subsolo)$/;
export const MOVEL = /^[A-Za-z0-9_]{1,64}@\d{1,2},\d{1,2}$/;
export const MESA_MOEDAS_MAX = 10000;
export const erro = (mensagem, status = 400) => Object.assign(new Error(mensagem), { status });
export const idValido = (id) => { if (!/^\d{1,18}$/.test(String(id))) throw erro('Partida inválida.'); return String(id); };
export const minutosDesde = (t, agora) => (agora - new Date(t).getTime()) / 60000;

export async function nomes(sql, ids) {
 const linhas = await sql`SELECT id,nome FROM vybe_pessoas WHERE id = ANY(${ids.map(String)}::bigint[])`;
 return Object.fromEntries(linhas.map((l) => [String(l.id), l.nome]));
}

// Itens da aposta: os móveis pela regra da troca, mais as roupas do personagem
// (pedido do Paulo: "objeto ou parte de skin"), uma unidade de cada.
export function itensDaAposta(lista) {
 if (!Array.isArray(lista)) throw erro('Itens inválidos.');
 const classe = (it) => (Array.isArray(it) ? it[0] : it?.classe);
 const roupas = lista.filter((it) => CLASSE_ROUPA.test(String(classe(it))));
 const moveis = itensDaTroca(lista.filter((it) => !roupas.includes(it)));
 const vestes = [...new Set(roupas.map(classe))];
 if (vestes.some((c) => !roupaDaClasse(c))) throw erro('Essa roupa não existe no catálogo.');
 if (moveis.length + vestes.length > 12) throw erro('Escolha até 12 itens de cada lado.');
 return [...moveis, ...vestes.map((c) => [c, 1])];
}
// Roupa que a pessoa está vestindo não vai para a mesa (perderia e continuaria vestida).
async function conferirRoupas(tx, pessoaId, itens, quem) {
 const roupas = itens.map(([c]) => c).filter((c) => c.startsWith('roupa:'));
 if (!roupas.length) return;
 const [p] = await tx`SELECT preferencias->>'figura' AS figura FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoaId}`;
 const vestidas = new Set(roupasDaFigura(p?.figura || ''));
 if (roupas.some((c) => vestidas.has(c))) throw erro(quem === 'eu' ? 'Tire a roupa do personagem antes de apostar ela.' : 'A outra pessoa está vestindo essa roupa agora.', 409);
 if ((await tx`SELECT 1 FROM vybe_escritorio_catalogo WHERE classe = ANY(${roupas}) AND preco = 0`).length) throw erro('Roupa grátis não vale aposta.', 409);
}
async function conferirAposta(tx, pessoaId, salas, itens, quem) {
 if (!itens.length) return;
 await semMarco(tx, itens.map(([c]) => c));
 await conferirLado(tx, pessoaId, salas, itens, quem);
 await conferirRoupas(tx, pessoaId, itens, quem);
}

// O pedido de desafio, conferido antes de abrir a transação: a pessoa chamada,
// o móvel, as moedas (iguais para os dois) e os itens de cada lado.
export function lerDesafio(pessoa, { para, camada, movel, moedas = 0, oferece = [], pede = [], chave }) {
 if (!/^\d{1,18}$/.test(String(para)) || String(para) === String(pessoa.id)) throw erro('Escolha outra pessoa da equipe.');
 if (!CAMADA.test(String(camada)) || !MOVEL.test(String(movel))) throw erro('Mesa inválida.');
 if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(chave))) throw erro('Pedido inválido.');
 const n = Number(moedas);
 if (!Number.isInteger(n) || n < 0 || n > MESA_MOEDAS_MAX) throw erro(`Aposte de 0 a ${MESA_MOEDAS_MAX.toLocaleString('pt-BR')} VybeCoins.`);
 return { para: String(para), camada, movel, chave, n, da: itensDaAposta(oferece || []), quer: itensDaAposta(pede || []) };
}
// Dentro da transação do convite: a pessoa existe e os dois têm o que apostam.
export async function conferirDesafio(tx, pessoa, salas, { para, n, da, quer }) {
 const [alvo] = await tx`SELECT id FROM vybe_pessoas WHERE id=${para} AND ativo=TRUE AND pode_entrar=TRUE`;
 if (!alvo) throw erro('Essa pessoa não está na equipe do escritório.', 404);
 if (n) {
  const [c] = await tx`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoa.id}`;
  if (Number(c?.saldo || 0) < n) throw erro('Você não tem essas VybeCoins para apostar.', 409);
 }
 await conferirAposta(tx, pessoa.id, salas, da, 'eu');
 await conferirAposta(tx, para, salas, quer, 'outro');
}

// Aceite (quem responde é o desafiado): confere tudo de novo e tira a aposta
// das duas carteiras e dos dois inventários. `razao` = '<jogo>:<id>'.
export async function cobrarAposta(tx, j, salas, razao) {
 // Carteiras e inventários trancados sempre na mesma ordem (menor id primeiro).
 const dois = [String(j.desafiante), String(j.desafiado)].sort((a, b) => Number(a) - Number(b));
 const n = Number(j.moedas) || 0;
 if (n) {
  for (const p of dois) await tx`INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(${p}) ON CONFLICT DO NOTHING`;
  const cart = await tx`SELECT pessoa_id,saldo FROM vybe_escritorio_carteiras WHERE pessoa_id IN (${dois[0]},${dois[1]}) ORDER BY pessoa_id FOR UPDATE`;
  for (const c of cart) if (Number(c.saldo) < n) throw erro(String(c.pessoa_id) === String(j.desafiado) ? 'Você não tem as VybeCoins da aposta.' : 'Quem chamou não tem mais as VybeCoins da aposta.', 409);
 }
 await tx`SELECT 1 FROM vybe_escritorio_inventario WHERE pessoa_id IN (${dois[0]},${dois[1]}) ORDER BY pessoa_id,classe FOR UPDATE`;
 const daqui = itensDaAposta(j.itens_desafiante || []), dali = itensDaAposta(j.itens_desafiado || []);
 await conferirAposta(tx, j.desafiante, salas, daqui, 'outro');
 await conferirAposta(tx, j.desafiado, salas, dali, 'eu');
 if (n) for (const p of dois) {
  await tx`UPDATE vybe_escritorio_carteiras SET saldo=saldo-${n} WHERE pessoa_id=${p}`;
  await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(${p},${`${razao}:aposta`},${-n})`;
 }
 await tirarDoInventario(tx, j.desafiante, daqui);
 await tirarDoInventario(tx, j.desafiado, dali);
}

// Fim da partida: prêmio para quem ganhou (vencedor = id da pessoa), ou cada
// um recebe o seu de volta (vencedor = null).
export async function pagarAposta(tx, j, vencedor, razao) {
 const n = Number(j.moedas) || 0;
 const daqui = [...(j.itens_desafiante || [])], dali = [...(j.itens_desafiado || [])];
 const creditar = async (p, origem, valor) => {
  const [r] = await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(${p},${origem},${valor}) ON CONFLICT(pessoa_id,origem) DO NOTHING RETURNING id`;
  if (r) await tx`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(${p},${valor}) ON CONFLICT(pessoa_id) DO UPDATE SET saldo=vybe_escritorio_carteiras.saldo+EXCLUDED.saldo`;
 };
 if (vencedor == null) {
  if (n) { await creditar(j.desafiante, `${razao}:devolucao`, n); await creditar(j.desafiado, `${razao}:devolucao`, n); }
  await porNoInventario(tx, j.desafiante, daqui);
  await porNoInventario(tx, j.desafiado, dali);
 } else {
  if (n) await creditar(vencedor, `${razao}:premio`, 2 * n);
  await porNoInventario(tx, vencedor, [...daqui, ...dali]);
 }
}
