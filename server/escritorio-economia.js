// Loja do Escritório: saldo, inventário, compra e, desde a fase 2
// (docs/escritorio-pontos.md), raridade, estoque e vitrine da semana. Faixas e
// móveis limitados ficam em vybe_escritorio_raridades/vybe_escritorio_catalogo
// (migrations/2026-10-17-escritorio-loja.sql); quem não está na tabela é comum.
import { readFileSync } from 'node:fs';
import { resumoPontos, diaBahia, inicioDaSemana, nivelPorXp, somarDias } from './escritorio-pontos.js';
import { conferirMarcos, MARCOS, partesDoMarco, nomeDoMarco, titulosDaPessoa } from './escritorio-marcos.js';
import { roupaDaClasse } from './escritorio-roupas.js';
const catalogo = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/catalogo.json', import.meta.url), 'utf8'));
const quartos = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/quartos.json', import.meta.url), 'utf8'));
export const MOVEIS_ESSENCIAIS = quartos.essenciais;
// Nome do móvel para mensagens (o do catálogo; sem ele, a classe).
export const nomeDoMovel = (classe) => catalogo.find((m) => m.classe === classe)?.nome || classe;
const classes = new Set([...catalogo.map(m => m.classe),'computer_laptop','uni_laptop','computer_old','steampunk_computer','easter_c23_solarpunkcomputer']);
// Sem a tabela de faixas (antes da migração da fase 2) vale o preço único.
export const PRECO_COMUM = 25;
export function precoMovel(classe) {
 // Roupa do personagem (skins): o preço vem da faixa; grátis é a linha com preço 0.
 if (String(classe).startsWith('roupa:')) { if (!roupaDaClasse(classe)) throw Object.assign(new Error('Esta peça não existe no catálogo.'), {status:400}); return PRECO_COMUM; }
 if (!classes.has(classe)) throw Object.assign(new Error('Este móvel ainda não está disponível na loja.'), {status:400});
 return MOVEIS_ESSENCIAIS.includes(classe) ? 0 : PRECO_COMUM;
}
export async function economiaPronta(sql) {
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_carteiras') IS NOT NULL AS existe`;
 return Boolean(r?.existe);
}
export async function lojaPronta(sql) {
 const [r] = await sql`SELECT (to_regclass('public.vybe_escritorio_catalogo') IS NOT NULL AND to_regclass('public.vybe_escritorio_raridades') IS NOT NULL) AS existe`;
 return Boolean(r?.existe);
}
// Sorteio fixo da vitrine: o mesmo número para a mesma semana e o mesmo móvel
// em qualquer servidor (FNV-1a), sem nada aleatório na hora da compra.
export function sorteioVitrine(semana, classe) {
 let h = 0x811c9dc5;
 for (const ch of `${semana}:${classe}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
 return h;
}
// Vitrine da semana: por faixa com vagas, os móveis sem marco que ainda têm
// estoque (ou que esgotaram nesta mesma semana, para a vitrine não mudar no
// meio), ordenados pelo sorteio da semana.
export function vitrineDaSemana({ semana, raridades, itens, vendidosNaSemana = [] }) {
 const recentes = new Set(vendidosNaSemana);
 const vitrine = [];
 for (const r of raridades) {
  if (!r.vitrine) continue;
  const candidatos = itens.filter(i => i.raridade === r.chave && !i.marco && (i.restante === null || i.restante > 0 || recentes.has(i.classe)));
  candidatos.sort((a, b) => sorteioVitrine(semana, a.classe) - sorteioVitrine(semana, b.classe) || (a.classe < b.classe ? -1 : 1));
  vitrine.push(...candidatos.slice(0, r.vitrine).map(i => i.classe));
 }
 return vitrine;
}
// Faixas, móveis limitados e a vitrine, como a loja mostra. `restante` null =
// sem limite. Comuns não aparecem em `itens`.
export async function carregarLoja(sql, agora = new Date()) {
 if (!await lojaPronta(sql)) return null;
 const semana = inicioDaSemana(diaBahia(agora));
 const raridades = (await sql`SELECT chave,nome,ordem,preco,estoque,vitrine FROM vybe_escritorio_raridades ORDER BY ordem`)
  .map(r => ({ chave: r.chave, nome: r.nome, preco: Number(r.preco), estoque: r.estoque === null ? null : Number(r.estoque), vitrine: Number(r.vitrine) }));
 const porChave = Object.fromEntries(raridades.map(r => [r.chave, r]));
 const linhas = await sql`SELECT classe,raridade,estoque,vendidos,preco,marco FROM vybe_escritorio_catalogo ORDER BY classe`;
 const itens = linhas.map(l => {
  const faixa = porChave[l.raridade], estoque = l.estoque === null ? faixa?.estoque ?? null : Number(l.estoque);
  return { classe: l.classe, raridade: l.raridade, preco: l.preco === null ? faixa?.preco ?? PRECO_COMUM : Number(l.preco),
   restante: estoque === null ? null : Math.max(0, estoque - Number(l.vendidos)), marco: l.marco || null };
 });
 const vendidosNaSemana = (await sql`SELECT DISTINCT substring(origem from '^compra:[^:]+:(.*)$') AS classe FROM vybe_escritorio_moedas
  WHERE origem LIKE 'compra:%' AND vybe_dia_bahia(criado_em) >= ${semana}::date`).map(v => v.classe);
 return { semana, raridades, itens, vitrine: vitrineDaSemana({ semana, raridades, itens, vendidosNaSemana }) };
}
// O que a loja sabe de um móvel: faixa, preço, quantos restam e se pode ser
// comprado nesta semana. Sem a tabela (ou móvel comum), preço único.
export function infoMovel(loja, classe) {
 const comum = { classe, raridade: 'comum', nome: 'Comum', preco: precoMovel(classe), restante: null, marco: null, naVitrine: true, exigeVitrine: false };
 if (!loja) return comum;
 const item = loja.itens.find(i => i.classe === classe);
 if (!item) return { ...comum, preco: MOVEIS_ESSENCIAIS.includes(classe) ? 0 : loja.raridades.find(r => r.chave === 'comum')?.preco ?? PRECO_COMUM };
 const faixa = loja.raridades.find(r => r.chave === item.raridade);
 // Roupa é visual, não exemplar (Paulo, 21/10/2026: "mais caro", não mais
 // escasso): o preço segue a faixa, sem estoque e sem esperar a vitrine.
 if (classe.startsWith('roupa:')) return { ...item, nome: faixa?.nome || item.raridade, restante: null, exigeVitrine: false, naVitrine: true };
 const exigeVitrine = Boolean(faixa?.vitrine);
 return { ...item, nome: faixa?.nome || item.raridade, exigeVitrine, naVitrine: !exigeVitrine || loja.vitrine.includes(classe) };
}
export async function carregarEconomia(sql, pessoaId, { agora = new Date(), loja = true, marcos = true } = {}) {
 if (!await economiaPronta(sql)) return {disponivel:false, motivo:'A loja aguarda a migração revisada do banco.'};
 // Marcos primeiro: o móvel de um marco recém-conquistado já aparece no inventário.
 const lista = marcos ? await conferirMarcos(sql, pessoaId, agora) : null;
 const [[carteira], inventario, conquistas] = await Promise.all([
  sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`,
  sql`SELECT classe,quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoaId}`,
  sql`SELECT origem,criado_em FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE 'conquista:%' ORDER BY criado_em`]);
 // Pontos (XP, meta e extrato) chegam depois da migração própria; sem ela, null.
 return {disponivel:true,saldo:Number(carteira?.saldo || 0),inventario,conquistas,essenciais:MOVEIS_ESSENCIAIS,preco:PRECO_COMUM,
  pontos:await resumoPontos(sql,pessoaId,agora), marcos: lista, titulos: lista ? await titulosDaPessoa(sql, pessoaId) : null, ...(loja ? await extrasDaLoja(sql, pessoaId, agora) : {})};
}
// Só com a loja (janela do catálogo, compras): a entrada do escritório fica leve.
async function extrasDaLoja(sql, pessoaId, agora) {
 // Ao mesmo tempo: uma consulta por vez levava ~8 s com a loja aberta.
 const [loja, origens, ritmo] = await Promise.all([carregarLoja(sql, agora), origensDoInventario(sql, pessoaId), ritmoDeMoedas(sql, pessoaId, agora)]);
 const kits = (await kitsDaLoja(sql, agora, loja)).filter((k) => !String(k.classes[0]).startsWith('roupa:'));
 return { loja: loja && { ...loja, itens: loja.itens.filter((i) => !i.classe.startsWith('roupa:')) }, origens, ritmo, kits };
}
// Como a pessoa conseguiu cada móvel (para os filtros do inventário):
// compra, kit, presente, troca ou prêmio (Paulo, 20/10/2026).
async function origensDoInventario(sql, pessoaId) {
 const [ex] = await sql`SELECT to_regclass('public.vybe_escritorio_presentes') IS NOT NULL AS presentes, to_regclass('public.vybe_escritorio_trocas') IS NOT NULL AS trocas,
   to_regclass('public.vybe_escritorio_catalogo') IS NOT NULL AS catalogo`;
 const o = {};
 const por = (classe, tipo) => { if (classe) (o[classe] ||= new Set()).add(tipo); };
 for (const r of await sql`SELECT substring(origem from '^compra:[^:]+:(.*)$') AS classe FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE 'compra:%'`) por(r.classe, 'compra');
 for (const r of await sql`SELECT origem FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE 'kit:%'`) for (const c of String(r.origem).split(':').slice(3)) por(c, 'compra');
 if (ex?.presentes) for (const r of await sql`SELECT classe FROM vybe_escritorio_presentes WHERE para_pessoa=${pessoaId}`) por(r.classe, 'presente');
 if (ex?.trocas) for (const r of await sql`SELECT oferece, pede, de_pessoa FROM vybe_escritorio_trocas WHERE estado='aceita' AND (de_pessoa=${pessoaId} OR para_pessoa=${pessoaId})`) {
  const recebeu = String(r.de_pessoa) === String(pessoaId) ? r.pede : r.oferece;
  for (const it of Array.isArray(recebeu) ? recebeu : []) por(Array.isArray(it) ? it[0] : it?.classe, 'troca');
 }
 if (ex?.catalogo) for (const r of await sql`SELECT i.classe FROM vybe_escritorio_inventario i JOIN vybe_escritorio_catalogo c ON c.classe=i.classe AND c.marco IS NOT NULL WHERE i.pessoa_id=${pessoaId}`) por(r.classe, 'premio');
 return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]]));
}
// Moedas e XP por dia nos últimos 7 dias (sem compras) e a média de moedas
// por dia: o "no seu ritmo" da loja e o gráfico da carteira.
async function ritmoDeMoedas(sql, pessoaId, agora = new Date()) {
 const hoje = diaBahia(agora), desde = somarDias(hoje, -6);
 // Antes da migração dos pontos o razão não tem XP: só as moedas.
 if (!await pontosProntosEconomia(sql)) {
  const so = await sql`SELECT TO_CHAR((criado_em AT TIME ZONE 'America/Bahia')::date,'YYYY-MM-DD') AS dia, COALESCE(sum(quantidade) FILTER (WHERE quantidade > 0),0)::int AS moedas
    FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND (criado_em AT TIME ZONE 'America/Bahia')::date >= ${desde}::date AND origem NOT LIKE 'compra:%' AND origem NOT LIKE 'kit:%' AND origem NOT LIKE 'reembolso:%' GROUP BY 1`;
  const dias = Array.from({ length: 7 }, (_, k) => { const dia = somarDias(desde, k), l = so.find((x) => x.dia === dia); return { dia, moedas: Number(l?.moedas || 0), xp: 0 }; });
  return { dias, porDia: Math.round((dias.reduce((t, d) => t + d.moedas, 0) / 7) * 10) / 10 };
 }
 const linhas = await sql`SELECT TO_CHAR((criado_em AT TIME ZONE 'America/Bahia')::date,'YYYY-MM-DD') AS dia, COALESCE(sum(quantidade) FILTER (WHERE quantidade > 0),0)::int AS moedas, COALESCE(sum(pontos),0)::int AS xp
   FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND (criado_em AT TIME ZONE 'America/Bahia')::date >= ${desde}::date AND origem NOT LIKE 'compra:%' AND origem NOT LIKE 'kit:%' AND origem NOT LIKE 'reembolso:%' GROUP BY 1`;
 const dias = Array.from({ length: 7 }, (_, k) => { const dia = somarDias(desde, k), l = linhas.find((x) => x.dia === dia); return { dia, moedas: Number(l?.moedas || 0), xp: Number(l?.xp || 0) }; });
 const total = dias.reduce((t, d) => t + d.moedas, 0);
 return { dias, porDia: Math.round((total / 7) * 10) / 10 };
}
// Kits da loja (Paulo, 20/10/2026): conjuntos prontos com desconto, na tabela
// vybe_escritorio_kits. O preço é a soma dos preços atuais menos o desconto.
export async function kitsDaLoja(sql, agora = new Date(), lojaCarregada = null) {
 const [ex] = await sql`SELECT to_regclass('public.vybe_escritorio_kits') IS NOT NULL AS existe`;
 if (!ex?.existe) return [];
 const loja = lojaCarregada || await carregarLoja(sql, agora);
 const kits = await sql`SELECT chave, nome, descricao, classes, desconto FROM vybe_escritorio_kits WHERE ativo ORDER BY ordem, chave`;
 return kits.map((k) => {
  const itens = k.classes.map((c) => infoMovel(loja, c));
  const cheio = itens.reduce((t, i) => t + Number(i.preco || 0), 0);
  const disponivel = itens.every((i) => !i.marco && i.restante !== 0 && i.naVitrine && i.preco > 0);
  return { chave: k.chave, nome: k.nome, descricao: k.descricao, classes: k.classes, desconto: Number(k.desconto), cheio, preco: Math.round(cheio * (1 - Number(k.desconto))), disponivel };
 });
}
// Compra de um kit: tudo ou nada, na mesma transação e com a mesma trava da
// compra avulsa; repetir a mesma chave não cobra de novo.
export async function comprarKit(sql, pessoaId, { kit, chave, corpo } = {}, agora = new Date()) {
 if (!/^[a-f0-9-]{36}$/i.test(String(chave || ''))) throw Object.assign(new Error('Identificador da compra inválido.'),{status:400});
 if (!/^[a-z0-9_-]{1,40}$/.test(String(kit || ''))) throw Object.assign(new Error('Kit inválido.'),{status:400});
 return sql.comTransacao(async tx => {
  const [k] = await tx`SELECT chave, classes, desconto FROM vybe_escritorio_kits WHERE chave=${kit} AND ativo`;
  if (!k) throw Object.assign(new Error('Este kit não está à venda.'),{status:404});
  await tx`INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(${pessoaId}) ON CONFLICT DO NOTHING`;
  const [c] = await tx`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId} FOR UPDATE`;
  const origem = ['kit', chave, kit, ...k.classes].join(':');
  const [anterior] = await tx`SELECT origem FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE ${'kit:' + chave + ':%'}`;
  if (anterior && anterior.origem !== origem) throw Object.assign(new Error('Identificador de compra já utilizado.'),{status:409});
  if (!anterior) {
   for (const classe of [...k.classes].sort()) await tx`SELECT classe FROM vybe_escritorio_catalogo WHERE classe=${classe} FOR UPDATE`;
   const loja = await carregarLoja(tx, agora);
   // Kit de roupa (visual completo): paga só as peças que faltam; as grátis e
   // as que a pessoa já tem entram sem cobrar e sem repetir no inventário.
   const roupa = k.classes.every((c) => c.startsWith('roupa:'));
   const tem = roupa ? new Set((await tx`SELECT classe FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoaId} AND classe = ANY(${k.classes})`).map((r) => r.classe)) : new Set();
   // Skin completa tem as peças dos dois corpos: entra só o que serve no de quem compra.
   const serve = (c) => !roupa || !['M', 'F'].includes(corpo) || ['U', corpo].includes(roupaDaClasse(c)?.genero);
   const comprar = roupa ? k.classes.filter((c) => serve(c) && !tem.has(c) && infoMovel(loja, c).preco) : k.classes;
   if (!comprar.length) throw Object.assign(new Error('Você já tem todas as peças deste kit.'),{status:409});
   let cheio = 0;
   for (const classe of comprar) {
    const info = infoMovel(loja, classe);
    if (info.marco || !info.preco) throw Object.assign(new Error('Este kit tem um móvel que não se compra.'),{status:409});
    if (info.restante === 0) throw Object.assign(new Error('Um móvel do kit esgotou.'),{status:409});
    if (!info.naVitrine) throw Object.assign(new Error('Um móvel do kit não está à venda esta semana.'),{status:409});
    cheio += info.preco;
   }
   const preco = Math.round(cheio * (1 - Number(k.desconto)));
   if (Number(c.saldo) < preco) throw Object.assign(new Error('VybeCoins insuficientes.'),{status:409});
   await tx`UPDATE vybe_escritorio_carteiras SET saldo=saldo-${preco} WHERE pessoa_id=${pessoaId}`;
   await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(${pessoaId},${origem},${-preco})`;
   for (const classe of comprar) {
    await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoaId},${classe},1)
     ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
    if (infoMovel(loja, classe).restante !== null) await tx`UPDATE vybe_escritorio_catalogo SET vendidos=vendidos+1 WHERE classe=${classe}`;
   }
  }
  return carregarEconomia(tx, pessoaId, { agora });
 });
}
export async function comprarMovel(sql, pessoaId, {classe,chave,quantidade=1,precoEsperado}={}, agora = new Date()) {
 const precoBase = precoMovel(classe);
 if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 1500) throw Object.assign(new Error("Quantidade entre 1 e 1500."),{status:400});
 if (!/^[a-f0-9-]{36}$/i.test(String(chave || ''))) throw Object.assign(new Error('Identificador da compra inválido.'),{status:400});
 if (!precoBase) throw Object.assign(new Error('Os móveis essenciais já são gratuitos.'),{status:400});
 if (!await economiaPronta(sql)) throw Object.assign(new Error('Loja indisponível: migração pendente.'),{status:503});
 return sql.comTransacao(async tx => {
  await tx`INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(${pessoaId}) ON CONFLICT DO NOTHING`;
  const [c] = await tx`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId} FOR UPDATE`;
  const origem = 'compra:'+chave+(quantidade===1 ? '' : '-q'+quantidade)+':'+classe;
  // A chave é global por pessoa, inclusive se a repetição tentar outro produto.
  const [anterior] = await tx`SELECT origem FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND (origem LIKE ${'compra:'+chave+':%'} OR origem LIKE ${'compra:'+chave+'-q%:%'})`;
  if (anterior && anterior.origem !== origem) throw Object.assign(new Error('Identificador de compra já utilizado.'),{status:409});
  if (!anterior) {
   // Sempre nesta ordem (carteira, depois o móvel) para duas compras ao mesmo
   // tempo não travarem uma à outra. A linha do móvel, trancada, é relida
   // com as vendas já feitas: o último exemplar vai para uma pessoa só.
   let limitado = false, preco = precoBase;
   if (await lojaPronta(tx)) {
    await tx`SELECT classe FROM vybe_escritorio_catalogo WHERE classe=${classe} FOR UPDATE`;
    const info = infoMovel(await carregarLoja(tx, agora), classe);
    if (info.marco) throw Object.assign(new Error('Este móvel não se compra: vem com um marco da ficha.'),{status:400});
    if (!info.preco) throw Object.assign(new Error('Esta peça já é grátis.'),{status:400});
    if (info.restante === 0) throw Object.assign(new Error('Esgotado: todos os exemplares já foram comprados.'),{status:409});
    if (info.restante !== null && info.restante < quantidade) throw Object.assign(new Error('Estoque insuficiente para esta quantidade.'),{status:409});
    if (!info.naVitrine) throw Object.assign(new Error('Este móvel não está na vitrine desta semana.'),{status:409});
    limitado = info.restante !== null; preco = info.preco;
   }
   if(precoEsperado !== undefined && (!Number.isSafeInteger(precoEsperado) || precoEsperado!==preco)) throw Object.assign(new Error("O preço mudou. Atualize a loja e confirme o valor novamente."),{status:409});
   preco *= quantidade;
   if (Number(c.saldo)<preco) throw Object.assign(new Error('VybeCoins insuficientes.'),{status:409});
   await tx`UPDATE vybe_escritorio_carteiras SET saldo=saldo-${preco} WHERE pessoa_id=${pessoaId}`;
   await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(${pessoaId},${origem},${-preco})`;
   await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoaId},${classe},${quantidade})
    ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+EXCLUDED.quantidade`;
   if (limitado) await tx`UPDATE vybe_escritorio_catalogo SET vendidos=vendidos+${quantidade} WHERE classe=${classe}`;
  }
  return carregarEconomia(tx,pessoaId,{ agora });
 });
}
// Perfil aberto a toda a equipe (decisão do Paulo, 19/10/2026; sem ranking):
// saldo de VybeCoins, nível/XP, conquistas e os móveis de cada um. Números de
// desempenho no trabalho (entregas, prazo) continuam só na ficha da própria
// pessoa e com quem administra; o extrato do razão também.
export async function perfilPublico(sql, pessoaId) {
 if (!await economiaPronta(sql)) return { disponivel: false };
 const comXp = await pontosProntosEconomia(sql);
 const [c] = comXp ? await sql`SELECT saldo,xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`
  : await sql`SELECT saldo,0 AS xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`;
 const inventario = await sql`SELECT classe,quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoaId} ORDER BY quantidade DESC, classe`;
 const [q] = await sql`SELECT count(*)::int AS n FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE 'conquista:%'`;
 // Marcos já conquistados (só leitura: conceder fica com a ficha da própria pessoa).
 const [tm] = await sql`SELECT to_regclass('public.vybe_escritorio_marcos') IS NOT NULL AS existe`;
 const feitos = tm?.existe ? await sql`SELECT marco,em FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId} ORDER BY em` : [];
 // O troféu de cada nível, para a vitrine do perfil de quem visita.
 const [tt] = await sql`SELECT to_regclass('public.vybe_escritorio_trofeus') IS NOT NULL AS existe`;
 const trofeus = tt?.existe ? await sql`SELECT marco||':'||nivel AS chave, classe FROM vybe_escritorio_trofeus` : [];
 const marcos = feitos.map((f) => { const { marco, nivel } = partesDoMarco(f.marco), m = MARCOS.find((x) => x.id === marco); return m ? { id: f.marco, nome: nomeDoMarco(f.marco), nivel, dica: m.unidade, em: f.em, classe: trofeus.find((t) => t.chave === f.marco)?.classe || null } : null; }).filter(Boolean);
 return { disponivel: true, saldo: Number(c?.saldo || 0), ...nivelPorXp(c?.xp || 0), conquistas: q?.n || 0, inventario, marcos };
}
async function pontosProntosEconomia(sql) {
 const [r] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='vybe_escritorio_carteiras' AND column_name='xp') AS existe`;
 return Boolean(r?.existe);
}
