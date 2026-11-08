// Fachada conceito por nicho (Paulo, 08/11/2026: "faz uma arte conceito com o nicho do cliente e a logo dele";
// as fotos reais de cada fachada ele manda depois e entram como fachada própria). Cada nicho é um desenho em blocos
// na escala da loja do Centro, com a placa da logo sempre no mesmo lugar (acima da porta).
//
// Coordenadas: x ao longo da fachada (-2.5 a 2.5), z para a frente (fachada em z ≈ 1.6), y para cima.
// C(x, y, z, w, h, d, cor, luz?) põe um bloco; luz = brilha (letreiro, neon, vitrine acesa).
// Cada desenho devolve { placa: { y, w, h, z } }: onde vai a logo.
import { idDaSede } from './sedes.mjs';
// Identidade visual de cada cliente ativo, do cérebro do VYBES (whatsapp-ia/identidade-visual.js): segmento e paleta.
import IDENTIDADES from './identidades.json' with { type: 'json' };

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Clientes conhecidos: o nicho certo, sem depender do segmento escrito no cadastro.
const POR_CLIENTE = {
  brussolo: 'restaurante', gonzalez: 'restaurante', diacenter: 'clinica', dialab: 'clinica', hebravet: 'pet',
  antonov: 'academia', voa: 'loja', lions: 'academia', hellen: 'escritorio', conectasim: 'tecnologia',
  experimente: 'loja', ace: 'associacao', serragrande: 'deposito', copirece: 'agro', mangaba: 'tecnologia', alpha1: 'tecnologia',
};

const chaveNome = (s) => sem(s).replace(/[^a-z0-9]+/g, ' ').trim();
// Acha o cliente no cérebro pelo nome ou apelido (com e sem acento, nos dois sentidos).
export function identidadeDoCliente(nome) {
  const n = chaveNome(nome); if (n.length < 3) return null;
  return IDENTIDADES.clientes.find((c) => [c.nome, ...(c.apelidos || [])].map(chaveNome).some((a) => a && (a === n || (a.length > 3 && n.includes(a)) || (n.length > 3 && a.includes(n))))) || null;
}
// Paleta da marca para a loja: clara (parede), escura (detalhes), marca (toldo, faixa, neon) e acento.
const luz = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return .5; const v = parseInt(m[1], 16); return (.299 * (v >> 16) + .587 * ((v >> 8) & 255) + .114 * (v & 255)) / 255; };
const sat = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return 0; const v = parseInt(m[1], 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255; return (Math.max(r, g, b) - Math.min(r, g, b)) / 255; };
export function paletaDaLoja(paleta = [], reserva = '#FF7A2F') {
  const l = paleta.filter((h) => /^#[0-9a-f]{6}$/i.test(h));
  if (!l.length) return { claro: '#F6E7C8', escuro: '#2F3337', marca: reserva, acento: '#FFFFFF' };
  const porLuz = [...l].sort((a, b) => luz(b) - luz(a)), porSat = [...l].sort((a, b) => sat(b) - sat(a));
  const claro = luz(porLuz[0]) > .78 ? porLuz[0] : '#F4F1EA';
  const escuro = luz(porLuz[porLuz.length - 1]) < .3 ? porLuz[porLuz.length - 1] : '#2B2F33';
  // A ordem da paleta no cérebro é a ordem de importância da marca: a primeira cor com vida é a marca.
  const vivas = l.filter((h) => h !== claro && h !== escuro && sat(h) > .18);
  const marca = vivas[0] || porSat.find((h) => h !== claro && h !== escuro) || porSat[0];
  const acento = vivas[1] || porSat.find((h) => h !== claro && h !== escuro && h !== marca) || '#FFFFFF';
  return { claro, escuro, marca, acento };
}

export function nichoDoCliente(nome, segmento = '') {
  const id = idDaSede(nome); if (id && POR_CLIENTE[id]) return POR_CLIENTE[id];
  const ident = identidadeDoCliente(nome);
  const s = sem(segmento + ' ' + nome + ' ' + (ident?.segmento || ''));
  if (/parque|aquatic|lazer|event/.test(s)) return 'lazer';
  if (/advoc|direito|juridic|previdenc|contab/.test(s)) return 'escritorio';
  if (/mandato|parlament|vereador|deputad|prefeit/.test(s)) return 'associacao';
  if (/restaur|pizz|lanch|hamburg|steak|bar\b|cafe|padar|sorvet|acai|doce|gastronom|comida/.test(s)) return 'restaurante';
  if (/moda|roupa|sportswear|athleisure|calcad|boutique|papelar/.test(s)) return 'loja';
  if (/feijao|aliment.*embal|agroind/.test(s)) return 'agro';
  if (/vet|pet\b|petshop|animal/.test(s)) return 'pet';
  if (/clinic|saude|medic|odont|hospital|farm|estetic|laborat|hemodial/.test(s)) return 'clinica';
  if (/academ|fit|crossfit|esporte|luta|pilates/.test(s)) return 'academia';
  if (/advoc|contab|escritor|consult|imobil|segur|juridic/.test(s)) return 'escritorio';
  if (/escola|colegio|curso|educa|faculd/.test(s)) return 'escola';
  if (/cooperat|agro|rural|semente|feij|maquina|fazenda/.test(s)) return 'agro';
  if (/associa|sindic|prefeit|camara|govern|public/.test(s)) return 'associacao';
  if (/bebida|distribu|deposit|atacad|transport|logist/.test(s)) return 'deposito';
  if (/telefon|celular|internet|tecnolog|software|\bia\b|ai\b|digital|informat/.test(s)) return 'tecnologia';
  return 'loja';
}

const PLACA = (y, w = 2.4, h = 1) => ({ placa: { y, w, h, z: 1.66 } });
export const NICHOS = {
  // Restaurante: varanda com pergolado, mesas com guarda-sol na cor da marca e luzes quentes.
  restaurante(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -1, 5, 3.4, 2.4, P.claro); C(0, 3.52, -1, 5.2, .25, 2.6, '#7A5236');
    C(0, .12, .18, 4.4, 2.2, .1, P.escuro); C(0, .3, .22, 4, 1.8, .05, '#FFD9A0', true);
    for (const x of [-2.4, 2.4]) C(x, .12, 1.5, .2, 2.8, .2, '#6E4B33');
    for (let k = 0; k < 8; k++) C(-2.45 + k * .7, 2.92, 1, .16, .12, 2.1, '#5E4029');
    for (const x of [-1.5, 0, 1.5]) { C(x, .12, 1.3, .6, .55, .6, '#6E4B33'); C(x, .67, 1.3, .08, .9, .08, '#4A4F55'); C(x, 1.5, 1.3, 1.1, .12, 1.1, P.marca); C(x, 2.7, 1.2, .22, .22, .22, '#FFD08A', true); }
    return PLACA(3.6, 2.4, 1);
  },
  // Clínica: volume branco, vidro grande, cruz acesa e canteiro.
  clinica(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.4, 5, 3.8, 3.8, P.claro); C(0, 3.92, -.4, 5.2, .22, 4, P.escuro);
    C(0, .25, 1.52, 3.4, 2.2, .08, '#9CC9DA', true); C(0, .12, 1.56, 1, 2.1, .06, '#E8F4F8', true);
    C(-2, 2.5, 1.56, .25, .8, .05, P.acento === '#FFFFFF' ? '#2BB57A' : P.acento, true); C(-2, 2.77, 1.56, .8, .25, .05, P.acento === '#FFFFFF' ? '#2BB57A' : P.acento, true);
    C(0, 2.55, 1.54, 5, .12, .08, P.marca);
    for (const x of [-2.1, 2.1]) { C(x, .12, 2.05, .9, .4, .5, '#D9D2C2'); C(x, .52, 2.05, .8, .35, .4, '#5FA34E'); }
    return PLACA(2.9, 2.6, .9);
  },
  // Pet: clínica com a vitrine verde e uma casinha de cachorro na frente.
  pet(C, cor, P = paletaDaLoja([], cor)) {
    const r = NICHOS.clinica(C, cor, P);
    C(1.9, .12, 2.1, .8, .55, .7, '#C9764A'); C(1.9, .67, 2.1, .9, .25, .8, '#8E4E2F');
    return r;
  },
  // Academia: fachada escura, vidro com aparelhos e faixa de neon na cor da marca.
  academia(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.4, 5.2, 4.4, 3.8, P.escuro); C(0, 4.52, -.4, 5.4, .2, 4, '#111315');
    C(0, .3, 1.52, 4.6, 2.4, .08, '#1C2024'); C(0, .4, 1.56, 4.4, 2.2, .04, '#5A6066', true);
    for (const x of [-1.6, -.4, .8, 2]) { C(x, .3, 1.1, .6, 1.1, .3, '#111315'); C(x, 1.2, 1.1, .7, .08, .08, '#9AA3A8'); }
    C(0, 2.85, 1.58, 5, .14, .05, P.marca, true); C(0, 4.2, 1.58, 5, .1, .05, P.acento, true);
    return PLACA(3.5, 2.6, .9);
  },
  // Loja: vitrine grande, toldo listrado na cor da marca e vasos.
  loja(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.35, 5, 3.4, 3.9, P.claro); C(0, 3.52, -.35, 5.25, .3, 4.15, '#FFFFFF');
    C(-.7, .4, 1.6, 2.6, 1.8, .08, '#BFE0EC', true); C(-.7, .32, 1.64, 2.8, .1, .12, '#FFFFFF');
    C(1.45, .12, 1.6, .95, 2.05, .1, P.escuro);
    for (let f = 0; f < 7; f++) C(-2.5 + (5 / 7) * (f + .5), 2.38, 2.1, 5 / 7, .16, 1.15, f % 2 ? (P.acento === P.claro ? '#FFFFFF' : P.acento) : P.marca);
    for (const s of [-1, 1]) { C(s * 2.55, .12, 2.35, .5, .45, .5, '#B5462F'); C(s * 2.55, .57, 2.35, .6, .6, .6, '#5FA34E'); }
    return PLACA(2.95, 2.6, .7);
  },
  // Escritório (advocacia, contabilidade): dois andares, janelas em fita e colunas na entrada.
  escritorio(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.4, 5, 4.6, 3.8, P.claro); C(0, 4.72, -.4, 5.2, .22, 4, '#C9C1AE');
    for (const y of [.5, 2.6]) for (const x of [-1.6, 0, 1.6]) C(x, y, 1.52, 1.1, 1.3, .08, P.escuro);
    C(0, 2.2, 1.6, 5, .14, .3, P.marca);
    for (const x of [-.7, .7]) C(x, .12, 2.1, .3, 2.1, .3, '#F4F1EA');
    C(0, 2.22, 2.1, 1.9, .14, .7, '#F4F1EA');
    return PLACA(4, 2.2, .7);
  },
  // Escola: prédio com relógio, portão e pátio.
  escola(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.6, 5, 3.6, 3.4, P.claro); C(0, 3.72, -.6, 5.2, .3, 3.6, P.marca);
    for (const x of [-1.6, 0, 1.6]) C(x, .8, 1.12, 1, 1.2, .08, '#4E6A78');
    C(0, 3.9, .9, .9, .9, .2, '#FFFFFF'); C(0, 4.15, 1.02, .1, .4, .02, '#1F1D1A');
    for (let k = 0; k < 9; k++) C(-2.4 + k * .6, .12, 2.2, .08, .9, .08, '#4A4F55');
    return PLACA(2.6, 2.4, .8);
  },
  // Agro / cooperativa: galpão, silo e um trator na cor da marca.
  agro(C, cor, P = paletaDaLoja([], cor)) {
    C(-.6, .12, -.4, 3.8, 3.4, 3.8, P.claro); C(-.6, 3.52, -.4, 4, .25, 4, P.marca);
    C(-.6, .12, 1.52, 1.8, 2.2, .08, '#8B6A44');
    for (let k = 0; k < 5; k++) C(1.9, .12 + k * .9, -1, 1.3 - (k === 4 ? .4 : 0), .9, 1.3 - (k === 4 ? .4 : 0), k % 2 ? '#C9CFD2' : '#B9BEC1');
    C(1.7, .12, 1.7, 1.2, .5, .8, P.acento); C(1.5, .62, 1.7, .6, .5, .6, P.acento); for (const z of [1.3, 2.1]) C(2.1, .12, z, .4, .5, .3, '#1F1D1A');
    return PLACA(2.6, 2, .8);
  },
  // Associação / instituição: colunas, frontão e bandeira.
  associacao(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.6, 5, 3.4, 3.4, '#F4F4F2'); C(0, 3.52, -.6, 5.4, .3, 3.8, '#D8D2C6');
    for (const x of [-1.8, -.6, .6, 1.8]) C(x, .12, 1.4, .35, 3.3, .35, '#FFFFFF');
    C(0, .12, 1.12, 1.2, 2.2, .08, '#6B4E3A');
    C(2.4, .12, 2.1, .08, 4, .08, '#4A4F55'); C(2.75, 3.4, 2.1, .7, .45, .04, P.marca); C(0, 3.52, -.6, 5.4, .1, 3.8, P.marca);
    return PLACA(2.7, 2.6, .7);
  },
  // Depósito / distribuidora: galpão de zinco, portão de carga e engradados.
  deposito(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.4, 5.4, 3.4, 3.8, '#E3E5E6');
    for (let k = 0; k < 6; k++) C(0, 3.5 + k * .08, -1.9 + k * .7, 5.6, .1, .7, k % 2 ? '#B9BEC1' : '#A7AEB2');
    C(-.6, .12, 1.52, 2.6, 2.4, .08, '#7E8589'); for (let k = 0; k < 8; k++) C(-.6, .3 + k * .28, 1.57, 2.5, .04, .04, '#5F6569');
    C(0, 2.7, 1.56, 5.2, .45, .05, P.marca, true);
    for (const [x, y] of [[1.6, .12], [2.2, .12], [1.9, .52]]) C(x, y, 2.1, .5, .4, .5, k2(x));
    function k2(x) { return x > 2 ? '#F2C14E' : '#D62828'; }
    return PLACA(3.05, 2.4, .6);
  },
  // Lazer / parque aquático: portal nas cores da marca, toboágua e piscina.
  lazer(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -1.6, 5, 2.6, 1.4, P.claro);
    for (const x of [-2.2, 2.2]) C(x, .12, 1.6, .5, 3.4, .5, P.marca);
    C(0, 3.5, 1.6, 4.9, .5, .5, P.marca);
    C(-.4, .02, .6, 3.2, .14, 1.8, '#4FB6E3');
    for (let k = 0; k < 5; k++) C(1.4 - k * .25, .4 + k * .55, -.6 + k * .2, .5, .14, .5, P.acento === '#FFFFFF' ? '#FACC15' : P.acento);
    return PLACA(3.1, 2.4, .8);
  },
  // Tecnologia / telefonia: caixa de vidro moderna, faixa acesa e antena no topo.
  tecnologia(C, cor, P = paletaDaLoja([], cor)) {
    C(0, .12, -.4, 5, 3.8, 3.8, P.escuro); C(0, .25, 1.52, 4.6, 2.3, .08, '#7FB3D5', true);
    C(0, 2.65, 1.56, 5, .12, .05, P.marca, true); C(0, 3.92, -.4, 5.2, .15, 4, '#1F2B36');
    C(1.8, 4.07, -.8, .1, 1.6, .1, '#9AA3A8'); C(1.8, 5.5, -.8, .3, .3, .3, P.acento, true);
    return PLACA(3, 2.6, .8);
  },
};
