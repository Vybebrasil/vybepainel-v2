// TORCIDA DA SINUCA (Paulo, 08/11/2026: "quem tá assistindo pode apostar na
// partida contra quem assiste, contra quem joga... pode apostar na jogada de
// quem tá jogando (aposto 100 que não mata essa bola)"). Base do rascunho de
// 29/10 (worktree vybe-os-sinuca, nunca publicado), refeita para a mesa de hoje.
//
// Aposta é sempre de duas pessoas (quem oferece e quem topa), em VybeCoins:
// - 'vitoria': quem ganha a partida (escolha = lado).
// - 'tacada': a próxima tacada de quem está na vez (escolha 'mata' ou 'nao').
//   Mata = encaçapa bola dele (ou o ás na hora) sem falta.
// A oferta pode ir para alguém (da mesa ou da torcida) ou ficar aberta para
// qualquer um topar. Ninguém aposta contra si: quem joga só aposta na própria
// vitória e, na própria tacada, só que mata. As moedas dos dois saem no aceite
// (razão em vybe_escritorio_moedas, origem única: nada é cobrado duas vezes) e
// o prêmio (o dobro) vai para quem acertou. Oferta que ninguém topou expira; a
// partida que acaba empatada devolve.
//
// O livro fica na própria partida (mesa.torcida), sob a trava da partida.
import { erro, idValido, nomes, pessoasDaMesa } from './escritorio-apostas.js';

export const TORCIDA_MAX = 1000;         // por aposta
const ABERTAS_MAX = 6;                   // ofertas e apostas em aberto por pessoa, por mesa
const PRESENCA_MS = 65000;               // quem mandou sinal de vida há menos que isso está assistindo
const LADOS = ['desafiante', 'desafiado'];
const ABERTA = new Set(['oferta', 'aceita']);
const chaveValida = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(v);
const livro = (mesa) => mesa?.torcida?.apostas || {};
const presentes = (mesa, agora = Date.now()) => Object.entries(mesa?.torcida?.assistindo || {}).filter(([, em]) => agora - Number(em) < PRESENCA_MS).map(([id]) => id);
const ladoDe = (j, id) => LADOS.find((l) => j[l] != null && String(j[l]) === String(id));
const contrario = (a) => (a.tipo === 'vitoria' ? (a.escolha === 'desafiante' ? 'desafiado' : 'desafiante') : a.escolha === 'mata' ? 'nao' : 'mata');
const vale = (j) => j.jogo === 'sinuca' && !j.bot && !(j.mais || []).length;

// Quem joga não aposta contra si mesmo.
function conferirLado(j, a, pessoa, escolha) {
 const lado = ladoDe(j, pessoa);
 if (!lado) return;
 if (a.tipo === 'vitoria' && escolha !== lado) throw erro('Quem joga só aposta na própria vitória.', 409);
 if (a.tipo === 'tacada' && a.tacador === lado && escolha !== 'mata') throw erro('Na sua tacada, você só aposta que mata.', 409);
}

async function creditar(tx, pessoa, origem, valor) {
 const [novo] = await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(${pessoa},${origem},${valor}) ON CONFLICT(pessoa_id,origem) DO NOTHING RETURNING id`;
 if (novo) await tx`INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo) VALUES(${pessoa},${valor}) ON CONFLICT(pessoa_id) DO UPDATE SET saldo=vybe_escritorio_carteiras.saldo+EXCLUDED.saldo`;
}
async function pagar(tx, j, a, ganhador, motivo) {
 const origem = `sinuca:${j.id}:torcida:${a.id}`;
 if (ganhador) { await creditar(tx, ganhador, `${origem}:premio`, a.valor * 2); a.estado = 'paga'; a.ganhador = ganhador; }
 else { for (const p of [a.de, a.com]) await creditar(tx, p, `${origem}:devolucao`, a.valor); a.estado = 'devolvida'; }
 a.motivo = motivo; a.fim = new Date().toISOString();
}

// O que a tela recebe: quem assiste e as apostas (com os nomes).
export async function vistaTorcida(sql, j, eu) {
 if (!vale(j)) return null;
 const ap = Object.values(livro(j.mesa)).sort((x, y) => String(y.em).localeCompare(String(x.em))).slice(0, 30);
 const ids = [...new Set([...presentes(j.mesa), ...ap.flatMap((a) => [a.de, a.para, a.com].filter(Boolean))])];
 const nome = ids.length ? await nomes(sql, ids) : {};
 const quem = (id) => (id ? { id: String(id), nome: nome[id] || 'Alguém' } : null);
 return { eu: String(eu), max: TORCIDA_MAX, assistindo: presentes(j.mesa).filter((id) => !pessoasDaMesa(j).includes(id)).map(quem),
  apostas: ap.map((a) => ({ ...a, de: quem(a.de), para: quem(a.para), com: quem(a.com) })) };
}

// assistindo · aposta-oferecer · aposta-topar · aposta-cancelar
export async function acaoTorcida(sql, pessoa, pedido) {
 const id = idValido(pedido.id), eu = String(pessoa.id);
 return sql.comTransacao(async (tx) => {
  const [j] = await tx`SELECT * FROM vybe_escritorio_partidas WHERE id=${id} FOR UPDATE`;
  if (!j || j.jogo !== 'sinuca') throw erro('Mesa de sinuca não encontrada.', 404);
  if (!vale(j)) throw erro('Nesta mesa não tem aposta da torcida.', 409);
  if (j.estado !== 'jogando') throw erro('Esta partida já terminou.', 409);
  const mesa = j.mesa, torcida = (mesa.torcida ||= { apostas: {}, assistindo: {} });
  torcida.apostas ||= {}; torcida.assistindo ||= {};
  const gravar = () => tx`UPDATE vybe_escritorio_partidas SET mesa=jsonb_set(mesa,'{torcida}',${JSON.stringify(torcida)}::jsonb) WHERE id=${id}`;
  if (pedido.acao === 'assistindo') {
   const agora = Date.now();
   torcida.assistindo = Object.fromEntries(Object.entries(torcida.assistindo).filter(([, em]) => agora - Number(em) < PRESENCA_MS));
   torcida.assistindo[eu] = agora; await gravar(); return { assistindo: true };
  }
  if (!chaveValida(pedido.aposta)) throw erro('Aposta inválida.');
  const apostas = torcida.apostas;
  if (pedido.acao === 'aposta-oferecer') {
   if (apostas[pedido.aposta]) { if (apostas[pedido.aposta].de !== eu) throw erro('Aposta inválida.', 409); return { repetido: true }; }
   const valor = Number(pedido.valor), tipo = pedido.tipo;
   if (!Number.isSafeInteger(valor) || valor < 1 || valor > TORCIDA_MAX) throw erro(`Aposte de 1 a ${TORCIDA_MAX} VybeCoins.`);
   if (!['vitoria', 'tacada'].includes(tipo) || !(tipo === 'vitoria' ? LADOS : ['mata', 'nao']).includes(pedido.escolha)) throw erro('Escolha no que você aposta.');
   let para = null;
   if (pedido.para != null && pedido.para !== '') {
    para = String(idValido(pedido.para));
    if (para === eu) throw erro('Escolha outra pessoa.');
    if (![...pessoasDaMesa(j), ...presentes(mesa)].includes(para)) throw erro('Essa pessoa não está nesta mesa agora.', 409);
   }
   if (Object.values(apostas).filter((a) => (a.de === eu || a.com === eu) && ABERTA.has(a.estado)).length >= ABERTAS_MAX) throw erro(`Você já tem ${ABERTAS_MAX} apostas abertas nesta mesa.`, 409);
   const [c] = await tx`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${eu}`;
   if (Number(c?.saldo || 0) < valor) throw erro('Você não tem essas VybeCoins.', 409);
   const a = { id: pedido.aposta, de: eu, para, com: null, tipo, escolha: pedido.escolha, valor, rodada: mesa.n || 0, tacador: mesa.vez, estado: 'oferta', em: new Date().toISOString() };
   conferirLado(j, a, eu, a.escolha);
   if (para) conferirLado(j, a, para, contrario(a));
   apostas[a.id] = a; await gravar(); return { oferecida: true };
  }
  const a = apostas[pedido.aposta];
  if (!a) throw erro('Aposta não encontrada.', 404);
  if (pedido.acao === 'aposta-cancelar') {
   if (a.de !== eu) throw erro('Só quem ofereceu cancela.', 403);
   if (a.estado !== 'oferta') throw erro('Esta aposta já foi topada.', 409);
   a.estado = 'cancelada'; a.fim = new Date().toISOString(); await gravar(); return { cancelada: true };
  }
  if (pedido.acao !== 'aposta-topar') throw erro('Pedido inválido.');
  if (a.estado === 'aceita' && a.com === eu) return { repetido: true };
  if (a.estado !== 'oferta') throw erro('Esta oferta não está mais aberta.', 409);
  if (a.de === eu) throw erro('Você não pode topar a sua própria aposta.', 409);
  if (a.para && a.para !== eu) throw erro('Esta oferta é para outra pessoa.', 403);
  if (a.tipo === 'tacada' && (a.rodada !== (mesa.n || 0) || a.tacador !== mesa.vez)) throw erro('O taco já bateu: essa oferta expirou.', 409);
  conferirLado(j, a, eu, contrario(a));
  const ids = [a.de, eu].sort((x, y) => Number(x) - Number(y));
  for (const p of ids) await tx`INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(${p}) ON CONFLICT DO NOTHING`;
  const contas = await tx`SELECT pessoa_id,saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=ANY(${ids}::bigint[]) ORDER BY pessoa_id FOR UPDATE`;
  for (const p of ids) if (Number(contas.find((c) => String(c.pessoa_id) === p)?.saldo || 0) < a.valor) throw erro(p === eu ? 'Você não tem essas VybeCoins.' : 'Quem ofereceu não tem mais essas VybeCoins.', 409);
  for (const p of ids) {
   const [novo] = await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(${p},${`sinuca:${id}:torcida:${a.id}:aposta`},${-a.valor}) ON CONFLICT(pessoa_id,origem) DO NOTHING RETURNING id`;
   if (!novo) throw erro('Esta aposta já foi cobrada. Atualize a mesa.', 409);
   await tx`UPDATE vybe_escritorio_carteiras SET saldo=saldo-${a.valor} WHERE pessoa_id=${p}`;
  }
  a.com = eu; a.estado = 'aceita'; a.aceita = new Date().toISOString();
  await gravar(); return { topada: true };
 });
}

// A tacada que acabou de sair matou? Bola do grupo de quem tacou (ou o ás na
// hora certa, que é vitória), sem falta. Mesa aberta: qualquer bola sem falta.
export function tacadaMatou(u, grupo) {
 if (!u || u.falta) return false;
 const meu = (n) => n === 1 || !grupo || (grupo === 'pares' ? n % 2 === 0 : grupo === 'impares' ? n % 2 === 1 : true);
 return (u.caiu || []).some((n) => n > 0 && meu(n));
}
// Depois de uma jogada (antes de gravar a mesa nova): acerta as apostas da
// tacada que saiu e expira as ofertas dela. `depois` é a mesa nova (muda aqui).
export async function liquidarTacada(tx, j, depois) {
 if (!vale(j) || !depois?.torcida?.apostas) return;
 const rodada = j.mesa?.n || 0, u = depois.ultimo;
 for (const a of Object.values(depois.torcida.apostas)) {
  if (a.tipo !== 'tacada' || a.rodada !== rodada || !ABERTA.has(a.estado)) continue;
  if (a.estado === 'oferta') { a.estado = 'expirada'; a.fim = new Date().toISOString(); continue; }
  if (!u || u.lado !== a.tacador || u.falta === 'tempo') { await pagar(tx, j, a, null, 'A vez passou sem tacada: devolvida.'); continue; }
  const matou = tacadaMatou(u, j.mesa?.grupos?.[a.tacador]), ganhou = (a.escolha === 'mata') === matou;
  await pagar(tx, j, a, ganhou ? a.de : a.com, matou ? 'Matou.' : 'Não matou.');
 }
}
// No fim da partida (já gravada): paga as da vitória, devolve as da tacada que
// ficaram no ar e expira as ofertas.
export async function liquidarPartida(tx, j, resultado) {
 if (!vale(j)) return;
 const [atual] = await tx`SELECT mesa FROM vybe_escritorio_partidas WHERE id=${j.id}`;
 const torcida = atual?.mesa?.torcida;
 if (!torcida?.apostas) return;
 let mudou = false;
 for (const a of Object.values(torcida.apostas)) {
  if (!ABERTA.has(a.estado)) continue;
  mudou = true;
  if (a.estado === 'oferta') { a.estado = 'expirada'; a.fim = new Date().toISOString(); continue; }
  if (a.tipo === 'vitoria' && LADOS.includes(resultado)) await pagar(tx, j, a, a.escolha === resultado ? a.de : a.com, 'Resultado da partida.');
  else await pagar(tx, j, a, null, resultado === 'empate' ? 'Empate: devolvida.' : 'A partida acabou antes: devolvida.');
 }
 if (mudou) await tx`UPDATE vybe_escritorio_partidas SET mesa=jsonb_set(mesa,'{torcida}',${JSON.stringify(torcida)}::jsonb) WHERE id=${j.id}`;
}
