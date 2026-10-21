// Roupas do personagem como itens da loja (skins; decisão do Paulo,
// 21/10/2026): o básico é grátis, o resto se compra na faixa dos móveis
// (vybe_escritorio_raridades), e os kits (Praia, Policial, Herói, Lobo…) são
// linhas de vybe_escritorio_kits. Cada peça é a classe "roupa:<tipo>-<conjunto>"
// no mesmo catálogo, inventário e razão dos móveis — sem tabela nova.
// O que é grátis e o que é raro fica na tabela (migrations/2026-10-21-escritorio-skins.sql):
// linha com preço 0 é grátis; sem linha, Comum.
import { readFileSync } from "node:fs";

const FIGURAS = JSON.parse(readFileSync(new URL("../assets/escritorio/habbo/figuras.json", import.meta.url), "utf8"));
const CONJUNTOS = new Map(Object.entries(FIGURAS.tipos).flatMap(([t, v]) => v.s.map((s) => [`${t}-${s[0]}`, { t, id: s[0], genero: s[1], club: s[2] }])));
export const CLASSE_ROUPA = /^roupa:([a-z]{2})-(\d{1,5})$/;

// "roupa:hr-828" → o conjunto do catálogo de figuras, ou null.
export function roupaDaClasse(classe) {
  const m = CLASSE_ROUPA.exec(String(classe || ""));
  return m ? CONJUNTOS.get(`${m[1]}-${m[2]}`) || null : null;
}
// Peças da figura do Habbo ("hd-180-1.hr-828-61") como classes de roupa.
export function roupasDaFigura(figura) {
  return String(figura || "").split(".").map((p) => p.split("-")).filter((p) => p.length >= 2).map(([t, id]) => `roupa:${t}-${id}`);
}
// As skins valem depois da migração: sem nenhuma linha de roupa no catálogo,
// o criador continua livre como antes (publicar o código não trava ninguém).
export async function skinsAtivas(sql) {
  const [t] = await sql`SELECT to_regclass('public.vybe_escritorio_catalogo') IS NOT NULL AS existe`;
  if (!t?.existe) return false;
  const [r] = await sql`SELECT 1 AS sim FROM vybe_escritorio_catalogo WHERE classe LIKE 'roupa:%' LIMIT 1`;
  return Boolean(r?.sim);
}
// Ao salvar o personagem: cada peça precisa ser grátis, ser da pessoa ou já
// estar no visual salvo dela (ninguém perde o que já veste).
export async function conferirFiguraDaPessoa(tx, pessoaId, figura, figuraSalva = "") {
  if (!(await skinsAtivas(tx))) return;
  const pecas = [...new Set(roupasDaFigura(figura))];
  const ja = new Set(roupasDaFigura(figuraSalva));
  const inventadas = pecas.filter((c) => !roupaDaClasse(c));
  if (inventadas.length) throw Object.assign(new Error("O personagem tem uma peça que não existe no catálogo."), { status: 400 });
  const resto = pecas.filter((c) => !ja.has(c));
  if (!resto.length) return;
  const gratis = new Set((await tx`SELECT classe FROM vybe_escritorio_catalogo WHERE classe = ANY(${resto}) AND preco = 0`).map((r) => r.classe));
  const minhas = new Set((await tx`SELECT classe FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoaId} AND classe = ANY(${resto})`).map((r) => r.classe));
  const faltam = resto.filter((c) => !gratis.has(c) && !minhas.has(c));
  if (faltam.length) throw Object.assign(new Error(`Faltam ${faltam.length === 1 ? "1 peça" : faltam.length + " peças"} no seu guarda-roupa. Compre no criador para salvar.`), { status: 409, faltam });
}
// O que o criador precisa: preço de cada faixa, as peças com linha própria
// (grátis e raras), as que a pessoa tem e os kits de roupa.
export async function roupasDaPessoa(sql, pessoaId) {
  if (!(await skinsAtivas(sql))) return { ativo: false };
  const [raridades, linhas, meus, kits] = await Promise.all([
    sql`SELECT chave, nome, preco FROM vybe_escritorio_raridades ORDER BY ordem`,
    sql`SELECT classe, raridade, preco FROM vybe_escritorio_catalogo WHERE classe LIKE 'roupa:%'`,
    sql`SELECT classe FROM vybe_escritorio_inventario WHERE pessoa_id=${pessoaId} AND classe LIKE 'roupa:%'`,
    sql`SELECT chave, nome, descricao, classes, desconto FROM vybe_escritorio_kits WHERE ativo AND classes[1] LIKE 'roupa:%' ORDER BY ordem, chave`,
  ]);
  const faixa = Object.fromEntries(raridades.map((r) => [r.chave, { nome: r.nome, preco: Number(r.preco) }]));
  const preco = (classe) => { const l = linhas.find((x) => x.classe === classe); return l ? (l.preco ?? faixa[l.raridade]?.preco ?? 0) : faixa.comum?.preco ?? 25; };
  return {
    ativo: true,
    faixas: faixa,
    // classe → [raridade, preço] só para as peças com linha (o resto é Comum).
    pecas: Object.fromEntries(linhas.map((l) => [l.classe, [l.raridade, l.preco === null ? null : Number(l.preco)]])),
    meus: meus.map((m) => m.classe),
    kits: kits.map((k) => {
      const cheio = k.classes.reduce((t, c) => t + Number(preco(c) || 0), 0);
      return { chave: k.chave, nome: k.nome, descricao: k.descricao, classes: k.classes, desconto: Number(k.desconto), cheio, preco: Math.round(cheio * (1 - Number(k.desconto))) };
    }),
  };
}
