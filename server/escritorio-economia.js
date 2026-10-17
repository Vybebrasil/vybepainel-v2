import { readFileSync } from 'node:fs';
const catalogo = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/catalogo.json', import.meta.url), 'utf8'));
const quartos = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/quartos.json', import.meta.url), 'utf8'));
export const MOVEIS_ESSENCIAIS = quartos.essenciais;
const classes = new Set([...catalogo.map(m => m.classe),'computer_laptop','uni_laptop','computer_old','steampunk_computer','easter_c23_solarpunkcomputer']);
export function precoMovel(classe) {
 if (!classes.has(classe)) throw Object.assign(new Error('Este móvel ainda não está disponível na loja.'), {status:400});
 return MOVEIS_ESSENCIAIS.includes(classe) ? 0 : 25;
}
export async function economiaPronta(sql) {
 const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_carteiras') IS NOT NULL AS existe`;
 return Boolean(r?.existe);
}
export async function carregarEconomia(sql, pessoaId) {
 if (!await economiaPronta(sql)) return {disponivel:false, motivo:'A loja aguarda a migração revisada do banco.'};
 const [carteira] = await sql`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`;
 const inventario = await sql`SELECT classe,quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoaId}`;
 const conquistas = await sql`SELECT origem,criado_em FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE 'conquista:%' ORDER BY criado_em`;
 return {disponivel:true,saldo:Number(carteira?.saldo || 0),inventario,conquistas,essenciais:MOVEIS_ESSENCIAIS,preco:25};
}
export async function comprarMovel(sql, pessoaId, {classe,chave}={}) {
 const preco = precoMovel(classe);
 if (!/^[a-f0-9-]{36}$/i.test(String(chave || ''))) throw Object.assign(new Error('Identificador da compra inválido.'),{status:400});
 if (!preco) throw Object.assign(new Error('Os móveis essenciais já são gratuitos.'),{status:400});
 if (!await economiaPronta(sql)) throw Object.assign(new Error('Loja indisponível: migração pendente.'),{status:503});
 return sql.comTransacao(async tx => {
  await tx`INSERT INTO vybe_escritorio_carteiras(pessoa_id) VALUES(${pessoaId}) ON CONFLICT DO NOTHING`;
  const [c] = await tx`SELECT saldo FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId} FOR UPDATE`;
  const origem = 'compra:'+chave+':'+classe;
  // A chave é global por pessoa, inclusive se a repetição tentar outro produto.
  const [anterior] = await tx`SELECT origem FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem LIKE ${'compra:'+chave+':%'}`;
  if (anterior && anterior.origem !== origem) throw Object.assign(new Error('Identificador de compra já utilizado.'),{status:409});
  if (!anterior) {
   if (Number(c.saldo)<preco) throw Object.assign(new Error('VybeCoins insuficientes.'),{status:409});
   await tx`UPDATE vybe_escritorio_carteiras SET saldo=saldo-${preco} WHERE pessoa_id=${pessoaId}`;
   await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade) VALUES(${pessoaId},${origem},${-preco})`;
   await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoaId},${classe},1)
    ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
  }
  return carregarEconomia(tx,pessoaId);
 });
}
