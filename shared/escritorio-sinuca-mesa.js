// Mesa da sinuca: medidas da arte enviada pelo Paulo (28/10/2026), simétricas desde 04/11/2026.
// Fonte única para colisões, mira, animação e recortes.
const ESCRITORIO_SINUCA_MESA = (() => {
  const arte = { arquivo: '/assets/jogos/mesa-vybe.webp', largura: 2752, altura: 1536,
    pano: { x: 144, y: 134, largura: 2464, altura: 1266 } };
  // Pontos medidos na referência de 2048 × 1143; conversão à imagem original.
  const ponto = ([x,y]) => [(x*arte.largura/2048-arte.pano.x)*100/arte.pano.largura,
    (y*arte.altura/1143-arte.pano.y)*50/arte.pano.altura];
  // Mesa 100% de cima e simétrica (Paulo, 04/11/2026: "a boca do meio uma maior
  // que a outra... não devia ser 100% alinhada? os cortes das bocas estão
  // 100%?"): a arte antiga, gerada, tinha a boca do meio de cima com raio 43 e a
  // de baixo 41, e os cortes dos cantos de baixo ~10 px fora do espelho dos de
  // cima. Agora só o quarto de cima à esquerda é medido (a média das quatro
  // medidas antigas, espelhadas) e o resto é espelho exato, em x = 50 e y = 25.
  // A arte (assets/jogos/mesa-vybe.webp) é desenhada a partir desta geometria.
  const dente = (a,b) => [...ponto(a),...ponto(b)];
  const mx = ([a,b,c,d]) => [100-a,b,100-c,d], my = ([a,b,c,d]) => [a,50-b,c,50-d];
  const longo = dente([150,100],[126.5,60.5]), lado = dente([107.5,156.25],[62.5,121.25]), meio0 = dente([965,100],[977,60.5]);
  // Cima E/D, baixo E/D, esquerda cima/baixo, direita cima/baixo,
  // meio cima E/D e meio baixo E/D.
  const dentes = [longo, mx(longo), my(longo), mx(my(longo)), lado, my(lado), mx(lado), mx(my(lado)),
    meio0, mx(meio0), my(meio0), mx(my(meio0))];
  for(let i=0;i<4;i++) dentes[i][1]=i<2?0:50;
  for(let i=4;i<8;i++) dentes[i][0]=i<6?0:100;
  for(let i=8;i<12;i++) dentes[i][1]=i<10?0:50;
  const nariz=(a,b)=>[...dentes[a].slice(0,2),...dentes[b].slice(0,2)];
  const paredes=[nariz(0,8),nariz(9,1),nariz(2,10),nariz(11,3),nariz(4,5),nariz(6,7),...dentes];
  // Região sem apoio da ardósia, dentro da abertura escura: só começa a
  // cair quando o centro passa da borda. Sem atração para o buraco.
  const raio = (r) => r*50*arte.altura/(1143*arte.pano.altura);
  const [cx, cy] = ponto([88,83.5]), [, my0] = ponto([1024,72.5]);
  const buracos=[[cx,cy,raio(42.5)],[50,my0,raio(42)],[100-cx,cy,raio(42.5)],[cx,50-cy,raio(42.5)],[50,50-my0,raio(42)],[100-cx,50-cy,raio(42.5)]];
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
  const velocidade=(valor)=>{
    const f=Math.max(0,Math.min(1,Number(valor)||0));
    return 3.4*f+5.6*f**6;
  };
  return {arte,paredes,buracos,canto,meio,forcaMinima,velocidade,metricaY:arte.pano.altura/(arte.pano.largura/2)};
})();
if(typeof module!=='undefined'&&module.exports) module.exports=ESCRITORIO_SINUCA_MESA;
