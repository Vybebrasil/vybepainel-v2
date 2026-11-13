// Peças de cabeça modeladas (Paulo, 13/11/2026: "Vinícius é uma cabeça de cavalo... olha essas referências e olha
// como nosso motor fez, não tem sentido"). Esculpir pela silhueta do Habbo (frente × perfil) dá um borrão: a cabeça de
// cavalo virava um bloco marrom. Como nos móveis (moveis-voxel.mjs), item conhecido é MONTADO por uma receita própria,
// peça por peça, nas cores do item no Habbo; o que ainda não tem receita continua esculpido. Item novo vira receita aqui.
//
// Medidas da NOSSA cabeça (desenharBoneco em avatar.mjs): queixo em y 0,92, altura 0,74, largura 0,78, profundidade
// 0,72, frente em +z. Cada receita devolve caixas { x, y, z, w, h, d, cor } (y é o pé da caixa) e diz se cobre a cabeça
// inteira (máscara: a cabeça e o rosto do boneco dão lugar a ela).
const YC = .92, H = .74, W = .78, D = .72, TOPO = YC + H, FR = D / 2;
const mistura = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) || 0), x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const escuro = (c, t = .3) => mistura(c, '#1F1D1A', t), claro = (c, t = .3) => mistura(c, '#FFFFFF', t);

const RECEITAS = {
  // Cabeça de cavalo (referências voxel do Paulo): crânio alto, focinho comprido para a frente com a ponta mais clara e
  // as narinas, olhos grandes dos lados com brilho, orelhas em pé e a crina caindo pela nuca até o pescoço.
  cabecaCavalo(cor, cor2) {
    const c = [], add = (x, y, z, w, h, d, k) => c.push({ x, y, z, w, h, d, cor: k });
    const pelo = cor, sombra = escuro(cor, .18), ponta = claro(cor, .22), crina = cor2 && cor2 !== cor ? cor2 : escuro(cor, .55);
    add(0, YC - .16, -.04, .5, .3, .5, sombra);                         // pescoço
    add(0, YC + .02, -.02, .7, .56, .66, pelo);                         // crânio
    add(0, YC + .58, -.04, .62, .14, .58, pelo);                        // alto da cabeça
    add(0, YC + .02, .42, .5, .38, .4, pelo);                           // focinho
    add(0, YC - .02, .66, .46, .32, .14, ponta);                        // ponta do focinho
    add(0, YC - .04, .44, .44, .08, .5, sombra);                        // queixo
    for (const s of [-1, 1]) {
      add(s * .12, YC + .14, .735, .08, .08, .02, '#2B1D14');           // narina
      add(s * .355, YC + .34, .14, .02, .16, .16, '#1F1D1A');           // olho
      add(s * .362, YC + .44, .17, .02, .05, .05, '#FFFFFF');           // brilho do olho
      add(s * .2, YC + .72, -.14, .12, .2, .1, sombra);                 // orelha
      add(s * .2, YC + .9, -.14, .08, .1, .07, pelo);                   // ponta da orelha
      add(s * .2, YC + .74, -.11, .06, .14, .02, claro(cor, .3));       // dentro da orelha
    }
    for (let k = 0; k < 6; k++) add(0, YC + .66 - k * .16, -.36 - (k > 2 ? .02 : 0), .16, .2, .14, crina); // crina pela nuca
    add(0, YC + .66, .1, .2, .12, .2, crina);                            // topete
    return { caixas: c, cobre: 1 };
  },
  // Chapéu de bruxo: aba larga e redonda em degraus, a faixa e o cone em gomos que diminuem e dobram para trás.
  chapeuBruxo(cor, cor2) {
    const c = [], add = (x, y, z, w, h, d, k) => c.push({ x, y, z, w, h, d, cor: k });
    const aba = TOPO - .08, faixa = cor2 && cor2 !== cor ? cor2 : claro(cor, .35);
    add(0, aba, 0, 1.36, .05, 1.1, escuro(cor, .12));
    add(0, aba, 0, 1.12, .06, 1.3, escuro(cor, .12));
    add(0, aba + .02, 0, 1.2, .05, 1.2, cor);
    add(0, aba + .05, 0, .86, .1, .8, faixa);
    const gomos = [[.82, .76, 0, 0], [.66, .62, -.02, .2], [.52, .48, -.06, .38], [.38, .34, -.12, .54], [.26, .24, -.2, .68], [.16, .14, -.3, .8], [.1, .1, -.42, .88]];
    let y = aba + .15;
    for (const [w, d, z, k] of gomos) { add(0, y, z, w, .2, d, k > .5 ? escuro(cor, .08) : cor); y += .18; }
    add(0, y - .02, -.52, .08, .08, .08, faixa);                        // pontinha
    return { caixas: c, cobre: 0 };
  },
  // Óculos escuros: lentes largas, ponte e hastes até as orelhas.
  oculosEscuros(cor) {
    const c = [], add = (x, y, z, w, h, d, k) => c.push({ x, y, z, w, h, d, cor: k });
    const armacao = escuro(cor, .2), lente = mistura(cor, '#101418', .55);
    for (const s of [-1, 1]) { add(s * .17, YC + .25, FR + .01, .24, .14, .04, armacao); add(s * .17, YC + .27, FR + .035, .2, .1, .02, lente); add(s * .4, YC + .32, FR / 2, .03, .04, FR + .06, armacao); }
    add(0, YC + .33, FR + .02, .1, .03, .03, armacao);
    return { caixas: c, cobre: 0 };
  },
  // Bigode e barba cheia, colados no rosto.
  bigodeBarba(cor) {
    const c = [], add = (x, y, z, w, h, d, k) => c.push({ x, y, z, w, h, d, cor: k });
    add(0, YC + .14, FR + .01, .34, .07, .05, cor);
    for (const s of [-1, 1]) add(s * .2, YC + .1, FR + .01, .08, .08, .05, cor);
    add(0, YC - .04, FR - .04, .7, .16, .12, cor);
    add(0, YC - .1, FR - .1, .5, .1, .14, escuro(cor, .15));
    return { caixas: c, cobre: 0 };
  },
};

// Item do Habbo (tipo-número) → receita. O número é o do item no figuredata (as cores não mudam a receita).
export const PECAS_MODELADAS = Object.freeze({
  'ha-3567': 'cabecaCavalo',
  'ha-6273': 'chapeuBruxo',
  'ea-1404': 'oculosEscuros',
  'fa-6304': 'bigodeBarba',
});
// Itens que são efeito (fumaça, brilho, aura): não viram bloco nenhum.
export const PECAS_EFEITO = Object.freeze(new Set(['fa-5948']));

export const chaveDaPeca = (parte) => String(parte || '').split('-').slice(0, 2).join('-');
export function temReceitaDeCabeca(parte) { return Boolean(PECAS_MODELADAS[chaveDaPeca(parte)]); }
// A peça modelada do item, nas cores dele: { caixas, cobre } ou null.
export function montarPecaDeCabeca(parte, cor = '#8A5A3C', cor2 = null) {
  const f = RECEITAS[PECAS_MODELADAS[chaveDaPeca(parte)]];
  return f ? f(cor || '#8A5A3C', cor2) : null;
}
export const RECEITAS_DE_CABECA = Object.keys(RECEITAS);
