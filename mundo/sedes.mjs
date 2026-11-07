// A sede de cada cliente em voxel, com a cara do negócio e o nome no letreiro.
// Construída em coordenadas locais (frente para +z, centro no 0); clientes.mjs
// posiciona e gira a frente para a agência.
//
// Regras do Paulo (06/11/2026): DiaCenter e DiaLab ficam vizinhas, mas são
// empresas diferentes (duas sedes). Antonov, Hebravet e VOA dividem um
// complexo, mas cada uma tem a sua loja, a sua cor e o seu letreiro.
import { Obra, semAcento } from './voxel.mjs';

const chave = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Quem divide terreno: o primeiro nome do grupo recebe o lote; os outros entram nele.
export const COMPLEXOS = [{ id: 'complexo-antonov', membros: ['antonov', 'voa', 'hebravet'] }];
// Quem fica lado a lado (lotes vizinhos).
export const VIZINHOS = [['diacenter', 'dialab']];

export function idDaSede(nome) {
  const k = chave(nome);
  if (/brussolo/.test(k)) return 'brussolo';
  if (/gonzalez/.test(k)) return 'gonzalez';
  if (/^antonov/.test(k)) return 'antonov';
  if (/^voa$|^voa/.test(k)) return 'voa';
  if (/hebravet/.test(k)) return 'hebravet';
  if (/lions/.test(k)) return 'lions';
  if (/diacenter/.test(k)) return 'diacenter';
  if (/dialab/.test(k)) return 'dialab';
  if (/copirec/.test(k)) return 'copirece';
  if (/serragrande/.test(k)) return 'serragrande';
  if (/conectasim/.test(k)) return 'conectasim';
  if (/experimente/.test(k)) return 'experimente';
  if (/^ace|associacaocomercial/.test(k)) return 'ace';
  if (/alpha1|alphaone/.test(k)) return 'alpha1';
  if (/hellenrocha/.test(k)) return 'hellen';
  if (/mangaba/.test(k)) return 'mangaba';
  return null;
}
export const chaveDoCliente = chave;

// Calçada, meio-fio e um pouco de verde: todo lote começa assim.
function lote(o, L = 7.6) {
  o.caixa(0, 0, 0, L, .1, L, '#E3DACA');
  for (const s of [-1, 1]) { o.caixa(s * (L / 2 - .1), .1, 0, .2, .06, L, '#C9C1AE'); o.caixa(0, .1, s * (L / 2 - .1), L, .06, .2, '#C9C1AE'); }
}
// Corpo com rodapé, platibanda e janelas nas quatro faces.
function corpo(o, { w, d, h, cor, base = '#8E857A', plat = '#B9B2A4', janela = '#5D7884', acesa = .25, corLuz = '#FFE2A8', x = 0, z = 0, andar = .9, sem = [] }) {
  o.caixa(x, .1, z, w + .06, .25, d + .06, base).caixa(x, .1, z, w, h, d, cor).caixa(x, .1 + h, z, w + .16, .2, d + .16, plat);
  for (let a = 0; a * andar + .55 < h - .2; a++) {
    const y0 = .45 + a * andar;
    if (!sem.includes('frente')) o.janelas({ x0: x - w / 2 + .2, x1: x + w / 2 - .2, y0, y1: y0 + .36, z: z + d / 2 + .02, cor: janela, acesa, corLuz, semente: a + 3 });
    if (!sem.includes('fundo')) o.janelas({ x0: x - w / 2 + .2, x1: x + w / 2 - .2, y0, y1: y0 + .36, z: z - d / 2 - .02, cor: janela, acesa, corLuz, semente: a + 7 });
    for (const s of [-1, 1]) o.janelas({ x0: z - d / 2 + .2, x1: z + d / 2 - .2, y0, y1: y0 + .36, z: x + s * (w / 2 + .02), eixo: 'z', cor: janela, acesa, corLuz, semente: a + 11 + s });
  }
}
function porta(o, x, z, { w = .6, h = .8, cor = '#3A3F44', vidro = false } = {}) {
  if (vidro) o.luz(x, .12, z, w, h, .06, '#FFE2A8'); else o.caixa(x, .12, z, w, h, .06, cor);
  o.caixa(x, .12 + h, z, w + .12, .07, .08, '#2B2F33');
}
function toldo(o, x, y, z, w, cores) {
  const n = Math.max(2, Math.round(w / .3));
  for (let i = 0; i < n; i++) o.caixa(x - w / 2 + (i + .5) * w / n, y, z, w / n, .09, .55, cores[i % cores.length]);
}
function placa(o, nome, { y, z, cor = '#FFFFFF', fundo = '#1F1D1A', aceso = true, px = .085 }) {
  return o.letreiro(nome, { x: 0, y, z, px, cor, fundo, aceso });
}

const SEDES = {
  // Restaurante clássico com iluminação noturna: arcos acesos, varanda com cordão de luz e mesas.
  brussolo(o, nome) {
    lote(o);
    corpo(o, { w: 5.2, d: 3.6, h: 2.1, cor: '#F1E3C8', z: -.9, acesa: .7, corLuz: '#FFD08A', sem: ['frente'] });
    for (const x of [-1.8, -.6, .6, 1.8]) { o.luz(x, .45, .92, .7, .95, .05, '#FFC977'); o.caixa(x, 1.4, .93, .82, .12, .06, '#B5462F'); }
    o.caixa(0, 2.2, -.9, 5.6, .35, 4, '#B5462F'); o.caixa(0, 2.55, -.9, 4.4, .25, 2.8, '#C8553D');
    toldo(o, 0, 1.55, 1.25, 5.2, ['#1F7A43', '#F4EFE6']);
    o.caixa(0, .1, 2.6, 6.6, .08, 2.4, '#C99A6B');
    for (const x of [-2.4, -.8, .8, 2.4]) { o.caixa(x, .18, 2.6, .55, .38, .55, '#FFFFFF'); o.luz(x, .58, 2.6, .07, .1, .07, '#FFB347'); o.caixa(x + .38, .18, 2.6, .18, .28, .18, '#6B4A2E'); o.caixa(x - .38, .18, 2.6, .18, .28, .18, '#6B4A2E'); }
    for (let i = 0; i < 14; i++) o.luz(-3.2 + i * .5, 1.75 - Math.sin(i * .45) * .08, 3.7, .08, .08, .08, '#FFE7A3');
    for (const x of [-3.3, 3.3]) o.caixa(x, .1, 3.7, .1, 1.8, .1, '#2B2F33');
    placa(o, nome.replace(/ristorante/i, '').trim(), { y: 2.0, z: 1.0, cor: '#FFE7A3', fundo: '#3A2618' });
    o.arvore(-3.2, .1, -3, { cor: '#4F9A4E', fruta: '#F7C948' }).arvore(3.2, .1, -3, { cor: '#5FA34E' });
  },
  // Sede ibérica com deck: paredes brancas, telha, deck de madeira e ombrelones.
  gonzalez(o, nome) {
    lote(o);
    corpo(o, { w: 4.8, d: 3.4, h: 1.7, cor: '#FBF7EF', z: -1.2, acesa: .5 });
    for (let k = 0; k < 4; k++) o.caixa(0, 1.8 + k * .14, -1.2, 5.2 - k * .9, .14, 3.8, k % 2 ? '#C8553D' : '#B5462F');
    o.caixa(0, .1, 1.9, 6.8, .22, 3, '#B07A45');
    for (let i = 0; i < 12; i++) o.caixa(-3.3 + i * .6, .32, 1.9, .04, .01, 3, '#8A5A3C');
    for (const [x, c] of [[-2.2, '#E5484D'], [0, '#F7C948'], [2.2, '#E5484D']]) {
      o.caixa(x, .32, 2.1, .08, 1.5, .08, '#E9E4DA').caixa(x, 1.8, 2.1, 1.6, .12, 1.6, c).caixa(x, 1.92, 2.1, .9, .1, .9, c);
      o.caixa(x, .32, 2.1, .6, .4, .6, '#FFFFFF');
    }
    for (const x of [-3.3, 3.3]) for (let k = 0; k < 6; k++) o.caixa(x, .32, .5 + k * .5, .12, .45, .12, '#8A5A3C');
    porta(o, 0, .5, { vidro: true, w: .9, h: 1 });
    placa(o, nome, { y: 1.55, z: .52, cor: '#FFFFFF', fundo: '#B5462F' });
    o.arvore(-3, .1, -3.1, { fruta: '#F76808' }).arvore(3.1, .1, -3.2, { s: .8 });
  },
  // Centro médico: branco e azul, cruz acesa, entrada de vidro com marquise.
  diacenter(o, nome) {
    lote(o);
    corpo(o, { w: 5.4, d: 3.8, h: 2.9, cor: '#F6F9FB', z: -.6, janela: '#6FA8C9', acesa: .3, sem: ['frente'] });
    o.caixa(0, .1, 1.35, 5.4, .35, .1, '#1D6FB8');
    for (let a = 0; a < 3; a++) o.caixa(0, .55 + a * .9, 1.34, 4.6, .45, .06, '#8CC3E3');
    o.caixa(0, 1.3, 2.1, 3.2, .12, 1.6, '#1D6FB8'); for (const x of [-1.5, 1.5]) o.caixa(x, .1, 2.8, .12, 1.2, .12, '#E8EEF0');
    porta(o, 0, 1.4, { vidro: true, w: 1.4, h: 1.05 });
    o.luz(2.2, 3.2, -.6, .25, .8, .25, '#E5484D').luz(2.2, 3.47, -.6, .8, .25, .25, '#E5484D');
    placa(o, nome, { y: 2.8, z: 1.42, cor: '#FFFFFF', fundo: '#1D6FB8' });
    o.carro(-2.6, .1, 2.9, { cor: '#FFFFFF', girar: true });
  },
  // Laboratório prime: branco com faixa verde-água, frasco aceso no topo.
  dialab(o, nome) {
    lote(o);
    corpo(o, { w: 4.4, d: 3.4, h: 2.2, cor: '#FFFFFF', z: -.7, janela: '#5FB8B0', acesa: .35, sem: ['frente'] });
    o.caixa(0, .1, 1.02, 4.4, 2.2, .06, '#E6F4F2'); o.caixa(0, 1.5, 1.05, 4.4, .16, .06, '#14A39A');
    porta(o, -1.2, 1.06, { vidro: true, w: 1, h: 1 }); o.luz(1, .5, 1.06, 1.6, .6, .05, '#BFF3EC');
    o.caixa(1.4, 2.4, -.7, .5, .5, .5, '#14A39A').caixa(1.4, 2.9, -.7, .22, .35, .22, '#14A39A').luz(1.4, 2.5, -.48, .32, .22, .05, '#9FF0E0');
    placa(o, nome, { y: 2.0, z: 1.09, cor: '#14A39A', fundo: '#FFFFFF', aceso: false });
    o.arvore(-2.9, .1, 2.8, { s: .8 });
  },
  // Complexo moderno com fachada de vidro: três lojas, cada uma com cor e letreiro próprios.
  complexo(o, membros) {
    lote(o, 8.6);
    const lojas = { antonov: { cor: '#1E2A6B', luz: '#9FC1FF' }, voa: { cor: '#1F1D1A', luz: '#FFFFFF' }, hebravet: { cor: '#2E8B57', luz: '#C6F7D9' } };
    o.caixa(0, .1, -1.1, 7.8, 3.1, 3.6, '#E8ECEF'); o.caixa(0, 3.2, -1.1, 8, .22, 3.8, '#A4ACB0');
    for (let k = 0; k <= 12; k++) o.caixa(-3.9 + k * .65, .35, .72, .06, 2.8, .06, '#4A5056');
    for (let a = 0; a < 3; a++) o.caixa(0, .4 + a * .95, .7, 7.8, .78, .04, a ? '#9FC7D6' : '#BFE3EA');
    const ordem = ['antonov', 'voa', 'hebravet'];
    ordem.forEach((id, i) => {
      const x = -2.6 + i * 2.6, l = lojas[id], nome = membros[id];
      o.caixa(x, .1, 1.1, 2.4, .12, .8, l.cor); o.caixa(x, 1.25, 1.1, 2.5, .14, .9, l.cor);
      if (i) o.caixa(x - 1.3, .1, .9, .12, 3.1, .5, '#C4C9CC');
      o.luz(x, .25, .76, 2, .95, .04, l.luz);
      if (nome) o.letreiro(nome.length > 9 ? nome.slice(0, 9) : nome, { x, y: 1.75, z: .78, px: .075, cor: l.cor === '#1F1D1A' ? '#FFFFFF' : '#FFFFFF', fundo: l.cor, aceso: true });
      else o.caixa(x, 1.6, .78, 1.6, .5, .05, '#D9D4C8');
    });
    // Detalhes de cada uma: pegada (vet), arara (moda), losango (Antonov).
    o.caixa(2.6, 3.45, -1.1, .5, .35, .4, '#2E8B57').caixa(2.35, 3.8, -1.1, .14, .14, .14, '#2E8B57').caixa(2.85, 3.8, -1.1, .14, .14, .14, '#2E8B57');
    o.caixa(0, .3, 1.5, 1.2, .06, .06, '#B9B2A4'); for (let k = 0; k < 5; k++) o.caixa(-.5 + k * .25, .1, 1.5, .16, .2, .12, ['#F76808', '#FFFFFF', '#D6409F', '#1F1D1A', '#0D74CE'][k]);
    o.caixa(-2.6, 3.45, -1.1, .55, .55, .1, '#1E2A6B');
    o.carro(-3, .1, 3.3).carro(-1.5, .1, 3.3, { cor: '#FFFFFF' }).carro(1.8, .1, 3.3, { cor: '#2B2F33' });
    for (const x of [-3.6, 3.6]) o.arvore(x, .1, 2.2, { s: .7 });
  },
  // Ginásio com letreiro: telhado em arco por degraus, amarelo e preto, quadra ao lado.
  lions(o, nome) {
    lote(o);
    o.caixa(-.6, .1, -.8, 5.6, 1.9, 4.2, '#2B2F33');
    for (let k = 0; k < 6; k++) { const w = 5.8 - [0, .2, .6, 1.2, 2, 3][k]; o.caixa(-.6, 2 + k * .16, -.8, w, .16, 4.4, k % 2 ? '#F7C948' : '#E2A11B'); }
    o.luz(-.6, .4, 1.36, 4.2, .8, .05, '#FFF1B8');
    for (let k = 0; k < 7; k++) o.caixa(-2.9 + k * .75, .35, 1.37, .08, .9, .06, '#1F1D1A');
    placa(o, nome.replace(/academia/i, '').trim() || nome, { y: 2.0, z: 1.4, cor: '#F7C948', fundo: '#1F1D1A', px: .1 });
    o.caixa(3, .1, 2, 1.8, .08, 3, '#2F8F5B'); o.caixa(3, .18, 2, 1.6, .02, .06, '#FFFFFF');
    o.caixa(3, .1, .55, .06, .9, .06, '#FFFFFF').caixa(3, .1, 3.45, .06, .9, .06, '#FFFFFF');
    o.pessoa(2.7, .18, 1.6, { roupa: '#F7C948' }).pessoa(3.3, .18, 2.6, { roupa: '#E5484D' });
  },
  // Cooperativa agrícola: silos, barracão de metal e caminhão.
  copirece(o, nome) {
    lote(o, 8.2);
    for (const [x, z, h] of [[-2.6, -2.2, 4.6], [-1.1, -2.2, 4.6], [.4, -2.2, 4]]) {
      o.caixa(x, .1, z, 1.2, h, .7, '#C9CFD2').caixa(x, .1, z, .7, h, 1.2, '#C9CFD2');
      for (let k = 0; k < 4; k++) o.caixa(x, .6 + k * h / 4, z, 1.25, .06, .75, '#8E979B');
      o.caixa(x, h + .1, z, .8, .3, .8, '#8E979B').caixa(x, h + .4, z, .4, .2, .4, '#8E979B');
    }
    o.caixa(-1.1, 4.9, -1.6, 3.4, .12, .12, '#5A6268');
    o.caixa(2.3, .1, -.6, 3, 1.6, 3.6, '#E8E4DA'); for (let k = 0; k < 7; k++) o.caixa(2.3, 1.7 + Math.sin(k / 6 * Math.PI) * .5, -2.4 + k * .6, 3.2, .1, .62, '#9AA3A8');
    o.caixa(2.3, .1, 1.22, 1.6, 1.1, .06, '#5A6268');
    placa(o, nome, { y: 1.45, z: 1.26, cor: '#FFFFFF', fundo: '#2E7D32' });
    o.carro(-1.8, .1, 2.6, { cor: '#2E7D32' }); o.caixa(-.6, .1, 2.6, 1.6, .7, .55, '#C9A271');
    for (let k = 0; k < 8; k++) o.caixa(-3.5 + k * .9, .1, 3.6, .7, .2, .5, k % 2 ? '#A8D27A' : '#C9B97C');
  },
  // Centro de distribuição: galpão com docas e carretas na estrada.
  serragrande(o, nome) {
    lote(o, 8.2);
    o.caixa(0, .1, -1.2, 7, 2.2, 4.2, '#EEF1F3'); o.caixa(0, 2.3, -1.2, 7.2, .18, 4.4, '#5A6268');
    o.caixa(0, 1.6, .92, 7, .5, .06, '#0D4F8C');
    for (let k = 0; k < 4; k++) o.caixa(-2.6 + k * 1.75, .1, .92, 1.2, 1.2, .06, '#9AA3A8');
    placa(o, nome.replace(/bebidas/i, '').trim(), { y: 1.85, z: .98, cor: '#FFFFFF', fundo: '#0D4F8C', px: .08 });
    for (const [x, c] of [[-2.2, '#E5484D'], [1.4, '#0D74CE']]) {
      o.caixa(x + 1.15, .12, 2.6, .9, .75, .7, c).caixa(x + 1.4, .55, 2.6, .35, .3, .66, '#BFD9E2');
      o.caixa(x - .3, .12, 2.6, 2.4, 1, .7, '#F4F1EA').caixa(x - .3, .55, 2.97, 1.6, .3, .02, c);
      for (const a of [-1.3, -.6, .3, 1.4]) for (const s of [-1, 1]) o.caixa(x + a, .02, 2.6 + s * .33, .26, .26, .1, '#1F1D1A');
    }
    for (let k = 0; k < 6; k++) o.caixa(3.3, .1, -3 + k * .4, .6, .45, .35, ['#8A5A3C', '#C99A6B'][k % 2]);
  },
  // Torre de telecomunicação com antenas e fibra, e o escritório ao pé.
  conectasim(o, nome) {
    lote(o);
    const H = 9;
    for (let k = 0; k < 18; k++) {
      const y = .1 + k * H / 18, lado = 1.4 - k * .06, cor = Math.floor(k / 3) % 2 ? '#FFFFFF' : '#E5484D';
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) o.caixa(2 + a * lado / 2, y, -1.6 + b * lado / 2, .12, H / 18 + .01, .12, cor);
      if (k % 2 === 0) { o.caixa(2, y, -1.6 - lado / 2, lado, .05, .05, '#9AA3A8'); o.caixa(2, y, -1.6 + lado / 2, lado, .05, .05, '#9AA3A8'); }
    }
    for (const [a, b] of [[.45, 0], [-.45, 0], [0, .45]]) o.caixa(2 + a, H - 1.2, -1.6 + b, .14, .7, .3, '#F4F1EA');
    o.luz(2, H + .2, -1.6, .18, .18, .18, '#FF3B30');
    corpo(o, { w: 3.6, d: 2.6, h: 1.4, cor: '#F4F7FA', x: -1.4, z: 0, janela: '#7A5CE0', acesa: .4 });
    o.caixa(-1.4, .1, 1.32, 3.6, .3, .06, '#5B3CC4');
    placa(o, nome, { y: 1.25, z: 1.36, cor: '#FFFFFF', fundo: '#5B3CC4', px: .075 });
    for (let k = 0; k < 6; k++) o.luz(-3.2 + k * 1.1, .12, 3.4, .5, .04, .04, '#7FE7FF');
  },
  // Papelaria criativa lilás/roxa: lápis gigante no telhado e vitrine colorida.
  experimente(o, nome) {
    lote(o);
    corpo(o, { w: 4.6, d: 3.4, h: 2, cor: '#C9B6F2', z: -.8, janela: '#6B4FB8', acesa: .5, sem: ['frente'] });
    o.caixa(0, .1, .92, 4.6, .3, .06, '#6B4FB8');
    const cores = ['#F76808', '#F7C948', '#18A957', '#0D74CE', '#D6409F', '#E5484D'];
    cores.forEach((c, k) => o.luz(-1.9 + k * .38, .55, .96, .3, .7, .04, c));
    porta(o, 1.4, .95, { vidro: true, w: .8, h: .95 });
    toldo(o, 0, 1.4, 1.2, 4.6, ['#8E4EC6', '#FFFFFF']);
    o.caixa(-.4, 2.25, -.8, 3, .38, .38, '#F7C948').caixa(1.25, 2.25, -.8, .4, .38, .38, '#F2C9A0').caixa(1.55, 2.32, -.8, .2, .24, .24, '#2B2F33').caixa(-2, 2.25, -.8, .3, .38, .38, '#FF8FAB');
    placa(o, nome.replace(/papelaria/i, '').trim(), { y: 1.85, z: .98, cor: '#FFFFFF', fundo: '#6B4FB8' });
    o.arvore(-3, .1, 2.6, { s: .7, cor: '#7DBB5E' });
  },
  // Associação comercial: institucional, colunas e bandeira.
  ace(o, nome) {
    lote(o);
    corpo(o, { w: 5, d: 3.4, h: 2.3, cor: '#F2EEE6', z: -.9, acesa: .3, sem: ['frente'] });
    for (const x of [-1.8, -.6, .6, 1.8]) o.caixa(x, .1, 1.1, .3, 2.3, .3, '#FFFFFF');
    o.caixa(0, 2.4, .9, 5.2, .3, .9, '#E9E1CF'); o.caixa(0, .1, 1.3, 4.6, .14, .9, '#D9D2C2');
    porta(o, 0, .82, { w: .9, h: 1.1, cor: '#6B4A2E' });
    o.caixa(-3, .1, 2.4, .07, 2.8, .07, '#C9C1AE').caixa(-2.55, 2.4, 2.4, .8, .5, .04, '#18A957').caixa(-2.55, 2.55, 2.42, .3, .2, .04, '#F7C948');
    placa(o, 'ACE', { y: 2.55, z: 1.38, cor: '#1D3557', fundo: '#F2EEE6', aceso: false, px: .12 });
  },
  // Escritório moderno de vidro.
  alpha1(o, nome) {
    lote(o);
    o.caixa(0, .1, -.6, 4.2, 3.2, 3.4, '#9FC7D6'); for (let k = 0; k <= 7; k++) o.caixa(-2.1 + k * .6, .1, 1.12, .07, 3.2, .06, '#2B2F33');
    for (let a = 1; a < 4; a++) o.caixa(0, .1 + a * .8, 1.12, 4.2, .06, .06, '#2B2F33');
    o.caixa(0, 3.3, -.6, 4.4, .2, 3.6, '#2B2F33');
    placa(o, nome, { y: 3.1, z: 1.2, cor: '#FFFFFF', fundo: '#0D74CE' });
    o.arvore(2.8, .1, 2.4, { s: .8 }).arvore(-2.8, .1, 2.4, { s: .8 });
  },
  // Marca pessoal: estúdio boutique em tons nude e rosa.
  hellen(o, nome) {
    lote(o);
    corpo(o, { w: 4, d: 3, h: 1.9, cor: '#F3DCD2', z: -.8, janela: '#B98B80', acesa: .45, sem: ['frente'] });
    o.luz(-.6, .35, .72, 2.2, 1.1, .05, '#FFE4DA'); porta(o, 1.3, .72, { w: .7, h: 1.1, cor: '#B76E79' });
    o.caixa(0, 1.6, .9, 4.2, .1, .5, '#B76E79');
    placa(o, nome, { y: 2.2, z: .78, cor: '#B76E79', fundo: '#FFF6F2', aceso: false, px: .075 });
    for (const x of [-1.9, 1.9]) o.caixa(x, .1, 1.4, .5, .5, .5, '#E8D3C4').caixa(x, .6, 1.4, .6, .7, .6, '#7DBB5E');
  },
  // Startup de tecnologia: cubo de vidro escuro com neon verde.
  mangaba(o, nome) {
    lote(o);
    o.caixa(0, .1, -.6, 3.8, 2.6, 3.4, '#2B2F33'); o.luz(0, .5, 1.12, 3.2, 1.6, .04, '#163A2B');
    for (let k = 0; k < 6; k++) o.luz(-1.6 + k * .64, .5, 1.15, .06, 1.6, .04, '#3DFFA0');
    o.luz(0, 2.7, -.6, 3.9, .06, 3.5, '#3DFFA0');
    placa(o, nome, { y: 2.45, z: 1.18, cor: '#3DFFA0', fundo: '#111412' });
    o.caixa(2.6, .1, 2, .9, .9, .9, '#F7C948').caixa(2.6, 1, 2, .2, .3, .2, '#5FA34E');
  },
};

// Para quem não tem sede desenhada: o tipo pelo segmento, com o nome no letreiro.
function generica(o, nome, tipo, total) {
  lote(o);
  const andares = Math.max(1, Math.min(4, Math.round(1 + Math.log2(1 + total) * .8)));
  const h = andares * .9 + .3;
  const cores = { comida: '#F3E6D8', saude: '#F6F9FB', loja: '#F6F2EA', academia: '#2B2F33', publico: '#F2EEE6', escola: '#F6F1E1', agro: '#E8E4DA', escritorio: '#EEF1F3' };
  corpo(o, { w: 4.2, d: 3.2, h, cor: cores[tipo] || '#EEF1F3', z: -.7, acesa: .3, sem: ['frente'] });
  o.luz(-.5, .35, .92, 2.2, .9, .05, '#FFF1D2'); porta(o, 1.3, .92, { w: .7, h: .9 });
  o.caixa(0, 1.35, 1.1, 4.4, .1, .5, '#5A6268');
  placa(o, nome, { y: Math.min(h, 1.9) + .25, z: .95, cor: '#FFFFFF', fundo: '#3A3F44', px: .07 });
  o.arvore(-2.8, .1, 2.6, { s: .8 });
}

// Monta a sede. 'membros' (complexo): { antonov: 'Antonov', voa: 'VOA', hebravet: 'Hebravet' }.
export function construirSede({ id, nome, tipo, total = 0, membros = null }) {
  const o = new Obra();
  if (membros) SEDES.complexo(o, membros);
  else if (id && SEDES[id]) SEDES[id](o, nome);
  else generica(o, nome, tipo, total);
  const alto = Math.max(...o.solidos.map((b) => b.y + b.h), ...o.luzes.map((b) => b.y + b.h), 2);
  return { malha: o.montar(), alto };
}
