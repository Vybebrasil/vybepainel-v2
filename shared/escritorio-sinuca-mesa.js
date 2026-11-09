// Mesa da sinuca: a mesa de bar do Brasil (pano de 165 × 93 cm, bola de 54 mm;
// Paulo, 04/11/2026: "estamos seguindo essas medidas?") aumentada 20% nas mesmas
// proporções ("aumentar em 20% o tamanho da mesa, mantendo as proporções"): pano
// de 198 × 111,6 cm com a bola de 54 mm. Fonte única para colisões, mira,
// animação, a arte 2D (assets/jogos/mesa-vybe.webp, desenhada desta geometria) e o 3D.
const ESCRITORIO_SINUCA_MESA = (() => {
  // Branca de 5,7 cm, como na mesa de bar com ficheiro (a máquina separa a branca
  // pelo tamanho); as coloridas de 5,4 cm (Paulo, 04/11/2026).
  const PANO_CM = { largura: 165 * 1.2, altura: 93 * 1.2 }, BOLA_CM = 5.4, BRANCA_CM = 5.7;
  const pano = { x: 144, y: 134, largura: 2464, altura: Math.round(2464 * PANO_CM.altura / PANO_CM.largura) };
  const arte = { arquivo: '/assets/jogos/mesa-vybe.webp', largura: pano.largura + 2 * pano.x, altura: pano.altura + 2 * pano.y, pano };
  // As coordenadas gravadas continuam 100 × 50; o y vale metricaY em unidades de x.
  const metricaY = (PANO_CM.altura / PANO_CM.largura) * 2;
  const D = BOLA_CM / (PANO_CM.largura / 100), yU = (m) => m / metricaY;   // diâmetro da bola em unidades; métrico → y gravado
  // Bocas e cortes medidos em bolas (a mesa simétrica de antes, sem as tortas da
  // arte gerada): canto com boca de 1,5 bola (nariz a 1,06 bola da quina nas duas
  // tabelas) e o corte indo 0,8 bola para trás; meio com 2,3 bolas de boca.
  const mx = ([a,b,c,d]) => [100-a,b,100-c,d], my = ([a,b,c,d]) => [a,50-b,c,50-d];
  const longo = [1.06 * D, 0, 0.39 * D, yU(-0.8 * D)], lado = [0, yU(1.06 * D), -0.8 * D, yU(0.39 * D)], meio0 = [50 - 1.132 * D, 0, 50 - 0.9 * D, yU(-0.75 * D)];
  // Cima E/D, baixo E/D, esquerda cima/baixo, direita cima/baixo,
  // meio cima E/D e meio baixo E/D.
  const dentes = [longo, mx(longo), my(longo), mx(my(longo)), lado, my(lado), mx(lado), mx(my(lado)),
    meio0, mx(meio0), my(meio0), mx(my(meio0))];
  const nariz=(a,b)=>[...dentes[a].slice(0,2),...dentes[b].slice(0,2)];
  const paredes=[nariz(0,8),nariz(9,1),nariz(2,10),nariz(11,3),nariz(4,5),nariz(6,7),...dentes];
  // Região sem apoio da ardósia, dentro da abertura escura: só começa a cair
  // quando o centro passa da borda. Sem atração para o buraco. [x, y, raio em y]
  const cx = -0.34 * D, cy = yU(-0.34 * D), rc = yU(0.816 * D), my0 = yU(-0.522 * D), rm = yU(0.806 * D);
  const buracos=[[cx,cy,rc],[50,my0,rm],[100-cx,cy,rc],[cx,50-cy,rc],[50,50-my0,rm],[100-cx,50-cy,rc]];
  const canto={};
  for(const [k,h,v,sx,sy] of [['tl',0,4,1,1],['tr',1,6,-1,1],['bl',2,5,1,-1],['br',3,7,-1,-1]]) {
    const X=sx===1?0:100,Y=sy===1?0:50;
    canto[k]=[[sx*(dentes[h][0]-X),sx*(dentes[h][2]-X)],[sy*(dentes[v][1]-Y),sy*(dentes[v][3]-Y)]];
  }
  const meio={cima:[[50-dentes[8][0],50-dentes[8][2]],[dentes[9][0]-50,dentes[9][2]-50]],
    baixo:[[50-dentes[10][0],50-dentes[10][2]],[dentes[11][0]-50,dentes[11][2]-50]]};
  // Força como o braço de quem taca (Paulo, 29/10/2026: "17% quase não anda...
  // pensa como um ser humano batendo, de 0,1% tocar devagarzinho até 100% a
  // pancada"): a barra é quase a velocidade do taco, em reta, e só o fim curva
  // para a pancada. Na branca sozinha, pano de bar: 10% anda ~20 cm, 17% meio
  // metro, 30% quase a mesa inteira, 50% umas 3 tabelas. Saída forte (Paulo,
  // 04/11/2026: simulador de boteco; a saída de 7 m/s não abria o triângulo):
  // 100% = 9 m/s, a saída de quem joga bem no bar (profissionais passam de 10 m/s,
  // medido por Onoda). O termo f^6 só pesa no fim: até 75% a barra é a de antes.
  const forcaMinima=0.001;
  // Paulo, 08/11/2026 ("às vezes 20% parece bater fraco demais"): a mesa ficou
  // 20% maior em 04/11 e a barra continuou a mesma, então a reta subiu de 3,4
  // para 4,1 m/s: 20% agora anda ~1,1 m (antes ~0,8 m, nem meia mesa), 10% uns
  // 30 cm e 100% continua 9 m/s.
  const velocidade=(valor)=>{
    const f=Math.max(0,Math.min(1,Number(valor)||0));
    return 4.1*f+4.9*f**6;
  };
  // O contrário (m/s → barra), para os bots pensarem em velocidade de verdade.
  const forcaDaVelocidade=(v)=>{let a=0,b=1;for(let i=0;i<40;i++){const m=(a+b)/2;if(velocidade(m)<v)a=m;else b=m;}return (a+b)/2;};
  return {arte,paredes,buracos,canto,meio,forcaMinima,velocidade,forcaDaVelocidade,metricaY,pano:PANO_CM,bola:BOLA_CM,branca:BRANCA_CM};
})();
if(typeof module!=='undefined'&&module.exports) module.exports=ESCRITORIO_SINUCA_MESA;
