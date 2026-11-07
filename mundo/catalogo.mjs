// Catálogo voxel próprio da Vybe (Paulo, 06/11/2026: "Catálogo voxel próprio").
// Cada peça está ligada a um item que a loja já vende (catalogo-ligacao.json, gerado
// uma vez a partir de assets/escritorio/habbo/catalogo.json): comprar, guardar no
// inventário, preço e decoração salva continuam pelo mesmo servidor, pela classe.
// Item antigo sem peça própria vira a peça voxel padrão do mesmo tipo.
import { Obra } from './voxel.mjs';
import LIGACAO from './catalogo-ligacao.json' with { type: 'json' };

export const CATALOGO = LIGACAO;
const PORCLASSE = new Map(LIGACAO.map((p) => [p.classe, p]));
const PADRAO = { cadeira: 'cadeira_escritorio', sofa: 'sofa', cama: 'cama', mesa: 'mesa_trabalho', planta: 'planta_costela', luminaria: 'luminaria_piso',
  estante: 'estante_livros', som: 'caixa_som', tela: 'tv', quadro: 'quadro_abstrato', tapete: 'tapete_ret', maquina: 'frigobar', trofeu: 'trofeu', bau: 'bau', caixa: 'caixa' };
const CORES = ['#FF7A2F', '#0D74CE', '#18A957', '#8E4EC6', '#E5484D', '#F7C948', '#D6409F', '#38D9C5', '#B07A45', '#64738A'];

export function pecaDaClasse(classe, tipo) {
  const p = PORCLASSE.get(classe);
  if (p) return p;
  let h = 0; for (const c of String(classe)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return { id: 'antigo:' + classe, nome: null, categoria: 'Acervo antigo', desenho: PADRAO[tipo] || 'caixa', cor: CORES[Math.abs(h) % CORES.length], classe };
}

const PRETO = '#2B2F33', MADEIRA = '#B07A45', BRANCO = '#F4F1EA', VERDE = '#3E8F4E';
// Desenho de cada peça, em ladrilhos (1 = um ladrilho do Escritório), apoiada em y = 0, frente para +z.
export function obraDaPeca(desenho, cor) {
  const o = new Obra();
  const D = {
    cadeira_escritorio() { for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; o.caixa(Math.cos(a) * .22, 0, Math.sin(a) * .22, .08, .06, .08, PRETO); } o.caixa(0, .06, 0, .06, .3, .06, '#9AA3A8').caixa(0, .36, 0, .5, .1, .5, cor).caixa(0, .46, -.22, .5, .5, .08, cor).caixa(-.26, .46, 0, .06, .16, .36, PRETO).caixa(.26, .46, 0, .06, .16, .36, PRETO); },
    cadeira_gamer() { D.cadeira_escritorio(); o.caixa(0, .96, -.22, .36, .22, .08, cor).caixa(0, .6, -.17, .2, .3, .02, PRETO).caixa(-.18, .5, -.18, .06, .5, .04, PRETO).caixa(.18, .5, -.18, .06, .5, .04, PRETO); },
    poltrona() { o.caixa(0, .08, 0, .8, .32, .7, cor).caixa(0, .4, -.28, .8, .45, .14, cor).caixa(-.36, .4, 0, .1, .2, .7, cor).caixa(.36, .4, 0, .1, .2, .7, cor); for (const [a, b] of [[-.3, -.25], [.3, -.25], [-.3, .25], [.3, .25]]) o.caixa(a, 0, b, .06, .08, .06, MADEIRA); },
    banco() { o.caixa(0, .4, 0, 1.2, .08, .36, cor); for (const a of [-.5, .5]) o.caixa(a, 0, 0, .08, .4, .3, PRETO); },
    pufe() { o.caixa(0, 0, 0, .55, .36, .55, cor).caixa(0, .36, 0, .45, .06, .45, cor); },
    sofa() { o.caixa(0, .08, 0, 1.7, .3, .8, cor).caixa(0, .38, -.3, 1.7, .45, .2, cor).caixa(-.78, .38, 0, .14, .22, .8, cor).caixa(.78, .38, 0, .14, .22, .8, cor).caixa(-.4, .38, .05, .7, .08, .6, cor).caixa(.4, .38, .05, .7, .08, .6, cor); for (const a of [-.7, .7]) o.caixa(a, 0, 0, .1, .08, .6, PRETO); },
    sofa_l() { D.sofa(); o.caixa(.55, .08, .75, .6, .3, .9, cor).caixa(.78, .38, .75, .14, .22, .9, cor); },
    mesa_trabalho() { o.caixa(0, .72, 0, 1.6, .06, .75, cor); for (const a of [-.74, .74]) o.caixa(a, 0, 0, .06, .72, .66, PRETO); o.caixa(.45, .48, 0, .5, .24, .66, cor); },
    mesa_reuniao() { o.caixa(0, .72, 0, 2.2, .07, 1.1, cor).caixa(-.7, 0, 0, .2, .72, .5, PRETO).caixa(.7, 0, 0, .2, .72, .5, PRETO); },
    mesa_bistro() { o.caixa(0, 0, 0, .4, .04, .4, PRETO).caixa(0, .04, 0, .06, .68, .06, PRETO).caixa(0, .72, 0, .6, .04, .6, cor); },
    mesa_centro() { o.caixa(0, .32, 0, 1, .06, .6, cor); for (const [a, b] of [[-.44, -.24], [.44, -.24], [-.44, .24], [.44, .24]]) o.caixa(a, 0, b, .06, .32, .06, PRETO); o.caixa(.2, .38, 0, .2, .14, .14, '#E5484D'); },
    planta_costela() { o.caixa(0, 0, 0, .4, .35, .4, BRANCO); for (let k = 0; k < 7; k++) { const a = k * .9; o.caixa(Math.cos(a) * .2, .35 + k * .1, Math.sin(a) * .2, .3, .05, .22, VERDE); o.caixa(Math.cos(a) * .1, .35, Math.sin(a) * .1, .03, .1 + k * .1, .03, '#2E6B3A'); } },
    planta_palmeira() { o.caixa(0, 0, 0, .45, .35, .45, '#C9773E').caixa(0, .35, 0, .08, .8, .08, '#7A5534'); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; o.caixa(Math.cos(a) * .3, 1.12, Math.sin(a) * .3, Math.abs(Math.cos(a)) * .4 + .1, .05, Math.abs(Math.sin(a)) * .4 + .1, VERDE); } },
    planta_cacto() { o.caixa(0, 0, 0, .35, .25, .35, '#C9773E').caixa(0, .25, 0, .18, .7, .18, '#4F9A4E').caixa(-.15, .45, 0, .12, .1, .1, '#4F9A4E').caixa(-.2, .5, 0, .1, .25, .1, '#4F9A4E').caixa(.15, .55, 0, .12, .1, .1, '#4F9A4E').caixa(.2, .6, 0, .1, .2, .1, '#4F9A4E').caixa(0, .95, 0, .1, .06, .1, '#FF8FAB'); },
    planta_samambaia() { o.caixa(0, .7, 0, .3, .25, .3, BRANCO); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; o.caixa(Math.cos(a) * .25, .55 - k % 2 * .2, Math.sin(a) * .25, .12, .3, .12, VERDE); } o.caixa(-.2, 0, -.2, .05, .7, .05, PRETO); },
    planta_arvore() { o.caixa(0, 0, 0, .5, .4, .5, '#8E857A').caixa(0, .4, 0, .1, .6, .1, '#7A5534').caixa(0, 1, 0, .8, .6, .8, '#5FA34E').caixa(0, 1.5, 0, .5, .3, .5, '#5FA34E'); for (const [a, b] of [[.3, .3], [-.3, .1]]) o.caixa(a, 1.2, b, .1, .1, .1, '#F76808'); },
    planta_suculenta() { o.caixa(0, 0, 0, .7, .2, .35, '#C9773E'); for (const a of [-.22, 0, .22]) o.caixa(a, .2, 0, .14, .14, .14, '#7DBB5E').caixa(a, .3, 0, .08, .08, .08, '#9FD38C'); },
    luminaria_piso() { o.caixa(0, 0, 0, .35, .05, .35, PRETO).caixa(0, .05, 0, .04, 1.3, .04, '#9AA3A8').caixa(0, 1.3, 0, .36, .3, .36, cor).luz(0, 1.28, 0, .26, .04, .26, '#FFE7A3'); },
    luminaria_mesa() { o.caixa(0, 0, 0, .25, .04, .25, PRETO).caixa(0, .04, 0, .03, .3, .03, '#9AA3A8').caixa(.08, .32, 0, .24, .14, .2, cor).luz(.08, .3, 0, .16, .03, .14, '#FFE7A3'); },
    neon_vybe() { o.caixa(0, .9, 0, 1.3, .5, .06, '#1F1D1A'); o.letreiro('VYBE', { x: 0, y: 1.15, z: .05, px: .07, cor: '#FF7A2F', aceso: true }); },
    pendente() { o.caixa(0, 1.9, 0, .02, .5, .02, PRETO).caixa(0, 1.7, 0, .36, .2, .36, cor).luz(0, 1.68, 0, .2, .04, .2, '#FFE7A3'); },
    estante_livros() { o.caixa(0, 0, 0, 1, 1.7, .4, cor); for (let k = 0; k < 4; k++) { o.caixa(0, .2 + k * .4, .02, .92, .04, .36, '#E3D8C4'); for (let l = 0; l < 6; l++) o.caixa(-.38 + l * .15, .24 + k * .4, .03, .1, .28, .28, CORES[(k * 6 + l) % 10]); } },
    nicho() { o.caixa(0, 1, 0, .9, .5, .3, cor).caixa(0, 1.04, .02, .8, .42, .26, '#E3D8C4').caixa(-.2, 1.08, .02, .14, .2, .14, '#5FA34E').caixa(.2, 1.08, .02, .2, .14, .14, '#FF7A2F'); },
    estante_trofeus() { o.caixa(0, 0, 0, 1, 1.6, .4, '#3A3F44'); for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) o.caixa(-.3 + l * .3, .2 + k * .5, .04, .14, .28, .14, ['#F7C948', '#C4C9CC', '#C9773E'][k]); },
    quadro_vybe() { o.caixa(0, 1, 0, 1, .7, .06, '#1F1D1A').luz(0, 1.05, .04, .9, .6, .02, '#FF7A2F'); o.letreiro('VYBE', { x: 0, y: 1.35, z: .06, px: .06, cor: '#FFFFFF', aceso: true }); },
    quadro_abstrato() { o.caixa(0, 1, 0, .9, .7, .06, '#6B4A2E').luz(0, 1.05, .04, .8, .6, .02, '#F4F1EA'); o.luz(-.15, 1.15, .05, .3, .3, .02, cor).luz(.18, 1.1, .05, .22, .4, .02, '#F7C948').luz(0, 1.45, .05, .5, .06, .02, '#1F1D1A'); },
    quadro_mapa() { o.caixa(0, 1, 0, 1, .7, .06, '#6B4A2E').luz(0, 1.05, .04, .9, .6, .02, '#CFE3A0'); for (let k = 0; k < 5; k++) o.luz(-.35 + k * .18, 1.1 + (k % 2) * .2, .05, .12, .05, .02, '#ABA69C'); o.luz(.1, 1.3, .05, .08, .08, .02, '#FF7A2F'); },
    quadro_foto() { o.caixa(0, 1, 0, .8, .6, .06, '#F4F1EA').luz(0, 1.06, .04, .7, .48, .02, '#9FC7D6'); for (let k = 0; k < 4; k++) o.luz(-.24 + k * .16, 1.1, .05, .1, .22, .02, CORES[k]); },
    tapete_redondo() { for (let r = 3; r > 0; r--) o.caixa(0, .01 * (4 - r), 0, r * .5, .02, r * .5, r % 2 ? cor : BRANCO); },
    tapete_ret() { o.caixa(0, 0, 0, 2, .02, 1.4, cor).caixa(0, .01, 0, 1.8, .02, 1.2, BRANCO).caixa(0, .02, 0, 1.6, .02, 1, cor); },
    tapete_listras() { for (let k = 0; k < 7; k++) o.caixa(-.9 + k * .3, 0, 0, .3, .02, 1.3, k % 2 ? cor : BRANCO); },
    monitor_duplo() { o.caixa(0, 0, 0, .3, .04, .2, PRETO).caixa(0, .04, 0, .05, .3, .05, PRETO); for (const a of [-.32, .32]) { o.caixa(a, .3, 0, .6, .38, .05, '#1F1D1A').luz(a, .33, .03, .54, .32, .02, cor); } },
    tv() { o.caixa(0, 0, 0, 1.4, .4, .4, cor === '#F4F1EA' ? BRANCO : '#3A3F44').caixa(0, .45, 0, 1.3, .75, .06, '#1F1D1A').luz(0, .5, .04, 1.2, .65, .02, '#5BD1FF'); },
    projetor() { o.caixa(0, .1, 0, 1.8, 1.2, .04, '#FFFFFF').luz(0, .2, .03, 1.7, 1, .02, '#EAF6FF').caixa(0, 1.3, 0, 1.9, .08, .1, PRETO); },
    caixa_som() { o.caixa(0, 0, 0, .45, .9, .4, cor).caixa(0, .2, .21, .3, .3, .02, '#1F1D1A').caixa(0, .6, .21, .2, .2, .02, '#1F1D1A').luz(0, .82, .21, .1, .03, .02, '#FF7A2F'); },
    toca_discos() { o.caixa(0, 0, 0, .8, .5, .5, cor).caixa(0, .5, 0, .7, .06, .45, '#2B2F33').caixa(-.05, .56, 0, .36, .02, .36, '#1F1D1A').luz(-.05, .57, 0, .1, .01, .1, '#E5484D').caixa(.25, .56, -.1, .04, .04, .3, '#9AA3A8'); },
    jukebox() { o.caixa(0, 0, 0, .8, 1.3, .55, '#6B2A2A').luz(0, .9, .28, .6, .3, .02, '#FFC977').luz(0, .55, .28, .5, .2, .02, cor); for (const s of [-1, 1]) o.luz(s * .38, .1, .1, .04, 1.1, .3, '#FF7A2F'); },
    fliperama() { o.caixa(0, 0, 0, .7, 1.7, .6, '#1F1D1A').luz(0, 1, .28, .52, .42, .02, '#5BD1FF').luz(0, 1.55, .31, .62, .14, .02, cor).caixa(0, .75, .36, .6, .08, .26, PRETO).caixa(-.12, .83, .4, .07, .1, .07, '#E5484D').caixa(.12, .83, .4, .07, .07, .07, '#F7C948'); for (const s of [-1, 1]) o.luz(s * .37, .1, 0, .02, 1.5, .58, cor); },
    console() { D.tv(); o.caixa(0, .4, .15, .4, .08, .25, '#F4F1EA').caixa(.25, .4, .25, .18, .04, .1, '#1F1D1A'); },
    camera_tripe() { for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; o.caixa(Math.cos(a) * .2, 0, Math.sin(a) * .2, .04, .9, .04, PRETO); } o.caixa(0, .9, 0, .38, .26, .22, '#1F1D1A').caixa(0, .95, .15, .14, .14, .1, '#3A3F44').luz(.12, 1.1, 0, .04, .04, .04, '#E5484D'); },
    softbox() { o.caixa(0, 0, 0, .04, 1.3, .04, PRETO).caixa(0, 1.3, 0, .6, .6, .3, '#2B2F33').luz(0, 1.33, .16, .52, .52, .02, '#FFFFFF'); },
    ring_light() { o.caixa(0, 0, 0, .04, 1.2, .04, PRETO); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; o.luz(Math.cos(a) * .25, 1.45 + Math.sin(a) * .25, 0, .1, .1, .05, '#FFF1D2'); } },
    fundo_verde() { o.caixa(0, 0, 0, .05, 1.9, .05, PRETO).caixa(1.6, 0, 0, .05, 1.9, .05, PRETO).luz(.8, .05, .02, 1.5, 1.8, .02, '#3DDC84'); },
    cafeteira() { o.caixa(0, 0, 0, .9, .8, .5, MADEIRA).caixa(0, .8, 0, .95, .05, .55, BRANCO).caixa(-.15, .85, 0, .35, .45, .3, '#9AA3A8').caixa(-.15, .87, .18, .1, .06, .04, '#1F1D1A').caixa(.22, .85, 0, .1, .1, .1, '#FFFFFF'); },
    frigobar() { o.caixa(0, 0, 0, .6, .9, .55, cor).caixa(.22, .45, .28, .04, .3, .03, '#9AA3A8'); },
    bebedouro() { o.caixa(0, 0, 0, .4, .9, .4, BRANCO).caixa(0, .9, 0, .32, .45, .32, '#BFE3EA').caixa(0, .6, .21, .1, .06, .04, '#0D74CE'); },
    relogio() { o.caixa(0, 1.3, 0, .5, .5, .06, cor).caixa(0, 1.33, .03, .42, .42, .02, '#FFFFFF').caixa(0, 1.45, .05, .03, .14, .02, '#1F1D1A').caixa(.06, 1.38, .05, .12, .03, .02, '#1F1D1A'); },
    globo() { o.caixa(0, 0, 0, .3, .05, .3, MADEIRA).caixa(0, .05, 0, .04, .3, .04, MADEIRA).caixa(0, .4, 0, .4, .4, .4, cor).caixa(.08, .5, .2, .14, .12, .02, '#18A957').caixa(-.1, .45, .2, .1, .14, .02, '#18A957'); },
    vinil_parede() { for (let k = 0; k < 3; k++) { o.caixa(-.5 + k * .5, 1.2, 0, .4, .4, .04, '#1F1D1A').caixa(-.5 + k * .5, 1.36, .03, .12, .1, .02, CORES[k]); } },
    aquario() { o.caixa(0, 0, 0, 1, .6, .4, '#3A3F44').caixa(0, .6, 0, 1, .55, .4, '#BFE3EA').luz(0, .62, 0, .9, .45, .3, '#3FB4C7'); o.caixa(-.2, .8, .1, .12, .06, .04, '#FF7A2F').caixa(.2, .9, -.05, .1, .05, .04, '#F7C948'); },
    escultura() { o.caixa(0, 0, 0, .4, .7, .4, '#E8E1D3').caixa(0, .7, 0, .2, .3, .2, cor).caixa(0, 1, 0, .28, .28, .28, cor); },
    trofeu() { o.caixa(0, 0, 0, .4, .12, .4, '#3A3F44').caixa(0, .12, 0, .1, .25, .1, cor).caixa(0, .37, 0, .36, .3, .36, cor).caixa(-.22, .45, 0, .08, .16, .08, cor).caixa(.22, .45, 0, .08, .16, .08, cor); },
    cama() { o.caixa(0, 0, 0, 1, .3, 1.8, MADEIRA).caixa(0, .3, .05, .94, .16, 1.65, BRANCO).caixa(0, .46, -.65, .7, .12, .3, '#FFFFFF').caixa(0, .4, .35, .96, .1, .9, cor).caixa(0, 0, -.9, 1, .8, .1, MADEIRA); },
    bau() { o.caixa(0, 0, 0, .8, .45, .55, '#8A5A3C').caixa(0, .45, 0, .84, .18, .58, '#6B4A2E').caixa(0, .32, .29, .16, .2, .02, '#F7C948'); },
    caixa() { o.caixa(0, 0, 0, .7, .7, .7, cor).caixa(0, .7, 0, .74, .1, .74, '#FFFFFF').caixa(0, 0, .36, .1, .8, .02, '#FFFFFF'); },
  };
  (D[desenho] || D.caixa)();
  return o;
}
