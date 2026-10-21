// Raridade das roupas pelo desenho (Paulo, 21/10/2026: "o que for animado e
// diferente, mais foda, sempre vai ser mais caro"; "uma cabeça de herói é mais
// caro que um chapéu"). Gera a migração que reclassifica as roupas e cadastra
// as skins completas, a partir de:
//  - medidas do desenho de cada peça sobre um boneco básico (imager do Habbo,
//    direção 2): área que muda, quanto sai do contorno do corpo e quanto cobre
//    o rosto (scratchpad, conferidas vendo a arte em 21/10/2026);
//  - assets/escritorio/habbo/roupas_animadas.json (peças com animação);
//  - o "club" do catálogo de figuras (peças de assinante no Habbo).
// Faixas: Comum (o resto), Incomum (assinante), Raro (diferente), Épico (muito
// diferente: cabeça inteira, máscara, armadura, asas; ou animada), Lendário
// (animada e diferente, efeitos e bichinhos animados). As grátis não mudam.
//
// Uso: node scripts/escritorio-raridade-roupas.mjs <medidas.json> <navegador.json> <kits.json> > migrations/....sql
import { readFileSync } from 'node:fs';
const [medidasArq, navegadorArq, kitsArq] = process.argv.slice(2);
const fig = JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/figuras.json', import.meta.url)));
const animadas = new Set(Object.keys(JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/roupas_animadas.json', import.meta.url)))));
const skinsSql = readFileSync(new URL('../migrations/2026-10-21-escritorio-skins.sql', import.meta.url), 'utf8');
const gratis = new Set([...skinsSql.split('-- raras:')[0].matchAll(/'roupa:([a-z]{2}-\d+)'/g)].map((m) => m[1]));
const medidas = JSON.parse(readFileSync(medidasArq));
const navegador = JSON.parse(readFileSync(navegadorArq));
const kits = JSON.parse(readFileSync(kitsArq));

const faixa = {};
const ordem = ['comum', 'incomum', 'raro', 'epico', 'lendario'];
const subir = (k, f) => { if (ordem.indexOf(f) > ordem.indexOf(faixa[k] || 'comum')) faixa[k] = f; };
// Assinante no Habbo: Incomum.
for (const [t, tp] of Object.entries(fig.tipos)) for (const s of tp.s) if (s[2] > 0) subir(`${t}-${s[0]}`, 'incomum');
// Cabelo, rosto, camisa, calça e sapato: medidos no navegador (lista pronta).
for (const [t, l] of Object.entries(navegador)) {
  for (const id of l.e.split(',').filter(Boolean)) subir(`${t}-${id}`, 'epico');
  for (const id of l.r.split(',').filter(Boolean)) subir(`${t}-${id}`, 'raro');
}
// Cabeça, chapéu, máscara, acessórios, casacos, bichinhos e efeitos: medidas.
const porTipo = {};
for (const [k, v] of Object.entries(medidas)) if (v) (porTipo[k.split('-')[0]] ||= []).push([k, ...v]);
for (const [t, l] of Object.entries(porTipo)) {
  const areas = l.map((x) => x[1]).sort((a, b) => a - b), med = areas[areas.length >> 1] || 1;
  for (const [k, area, fora, rosto] of l) {
    if (['ha', 'he', 'fa'].includes(t)) {
      // Cobre o rosto (capacete, máscara, cabeça de bicho): Épico. Chapéu alto
      // só passa do contorno por cima (cartola, chapéu de palha): Raro.
      if (rosto >= 170 && area >= 450) subir(k, 'epico');
      else if (rosto >= 130 || fora >= 80 || area >= 1.6 * med) subir(k, 'raro');
    } else if (['ca', 'cc'].includes(t)) {
      // Asas e peças enormes: Épico; boia, lanterna, mochila grande: Raro.
      if (fora >= 400) subir(k, 'epico');
      else if (fora >= 80 || area >= 1.6 * med) subir(k, 'raro');
    } else if (['pt', 'mc'].includes(t)) subir(k, 'raro');
  }
}
// Animadas: Épico; animadas e diferentes (efeito, bichinho, ou já Raro+): Lendário.
for (const k of animadas) subir(k, ['mc', 'pt'].includes(k.split('-')[0]) || ordem.indexOf(faixa[k] || 'comum') >= 2 ? 'lendario' : 'epico');
// Grátis continua grátis, a não ser que seja diferente (Raro para cima): a
// cabeça de macaco do rosto livre passa a ser paga.
for (const k of gratis) if (ordem.indexOf(faixa[k] || 'comum') < 2) delete faixa[k];
const viraramPagas = Object.keys(faixa).filter((k) => gratis.has(k));

const listas = Object.fromEntries(ordem.slice(1).map((f) => [f, Object.keys(faixa).filter((k) => faixa[k] === f).sort()]));
const arr = (l) => l.map((k) => `'roupa:${k}'`).reduce((s, c, i) => s + (i ? ',' : '') + (i % 10 === 0 ? '\n ' : '') + c, '');

// Skins completas: as peças dos dois corpos, menos rosto e cabelo básicos (a pessoa fica com os dela).
const basicas = new Set(['hd-180', 'hd-600', 'hr-100', 'hr-515']);
const kitSql = kits.map((k, i) => {
  const classes = [...new Set([k.M, k.F].flatMap((f) => f.split('.').map((p) => p.split('-').slice(0, 2).join('-'))))].filter((c) => !basicas.has(c));
  for (const c of classes) { const [t, id] = c.split('-'); if (!fig.tipos[t]?.s.some((s) => s[0] === Number(id))) throw new Error(`${k.nome}: ${c} não existe no catálogo`); }
  if (classes.length > 12) throw new Error(`${k.nome}: ${classes.length} peças`);
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  return ` (${q('visual-' + k.chave)},${q(k.nome)},${q(k.descricao || '')},ARRAY[${classes.map((c) => q('roupa:' + c)).join(',')}],0.15,${200 + i},${q(`M:${k.M}|F:${k.F}`)})`;
}).join(',\n');

console.log(`-- Raridade das roupas pelo desenho, skins completas e personagens recriados
-- (decisões do Paulo em 21/10/2026: "o que for animado e diferente sempre vai
-- ser mais caro"; skins "no estilo do Tibia"; "resetar pra todos terem a
-- experiência de fazer o herói de novo"). Gerada por
-- scripts/escritorio-raridade-roupas.mjs; não editar à mão.
-- Não mexe em saldo, XP, inventário, conquistas nem nas peças grátis.
-- Roupa não tem estoque nem vitrine (server/escritorio-economia.js, infoMovel).
-- Grátis que viraram pagas por serem diferentes: ${viraramPagas.length}.
-- Contagem: incomum ${listas.incomum.length}, raro ${listas.raro.length}, épico ${listas.epico.length}, lendário ${listas.lendario.length}.
BEGIN;
-- 1. Raridade: as linhas pagas de roupa são refeitas; quem não está em lista é Comum.
DELETE FROM vybe_escritorio_catalogo WHERE classe LIKE 'roupa:%' AND preco IS DISTINCT FROM 0;
${ordem.slice(1).map((f) => `INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[${arr(listas[f])}
]),'${f}' ON CONFLICT (classe) DO ${f === 'incomum' ? 'NOTHING' : 'UPDATE SET raridade=EXCLUDED.raridade, preco=NULL'};`).join('\n')}
-- 2. Skins completas (o visual dos dois corpos) no lugar dos kits de duas peças.
ALTER TABLE vybe_escritorio_kits ADD COLUMN IF NOT EXISTS visual text NOT NULL DEFAULT '';
UPDATE vybe_escritorio_kits SET ativo=false WHERE chave IN ('skin-praia','skin-policial','skin-heroi','skin-lobo');
INSERT INTO vybe_escritorio_kits(chave,nome,descricao,classes,desconto,ordem,visual) VALUES
${kitSql}
ON CONFLICT (chave) DO UPDATE SET nome=EXCLUDED.nome, descricao=EXCLUDED.descricao, classes=EXCLUDED.classes, desconto=EXCLUDED.desconto, ordem=EXCLUDED.ordem, visual=EXCLUDED.visual, ativo=true;
-- 3. Personagens recriados uma vez: guarda o visual de cada um e limpa visual,
-- looks e a abertura (o criador abre de novo na entrada). Quarto, inventário,
-- moedas e XP ficam.
CREATE TABLE IF NOT EXISTS vybe_escritorio_personagens_reinicio (
 chave text PRIMARY KEY,
 criado_em timestamptz NOT NULL DEFAULT now(),
 perfis jsonb NOT NULL
);
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_personagens_reinicio WHERE chave='personagens-2026-10-21') THEN
  RAISE NOTICE 'Personagens já recriados; nada a fazer.';
  RETURN;
 END IF;
 INSERT INTO vybe_escritorio_personagens_reinicio(chave,perfis)
 SELECT 'personagens-2026-10-21', coalesce(jsonb_agg(jsonb_build_object('pessoa_id',pessoa_id,'figura',preferencias->'figura','looks',preferencias->'looks','abertura',preferencias->'abertura')),'[]'::jsonb)
 FROM vybe_escritorio_perfis;
 UPDATE vybe_escritorio_perfis SET preferencias=preferencias - 'figura' - 'looks' - 'abertura', atualizado_em=now();
END $$;
COMMIT;`);
