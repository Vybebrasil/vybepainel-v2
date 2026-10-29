// Mesa enviada pelo Paulo em 28/10/2026, sem esticar a arte.
// Fonte única para colisões, mira, animação e recortes.
const ESCRITORIO_SINUCA_MESA = (() => {
  const arte = { arquivo: '/assets/jogos/mesa-vybe.webp', largura: 2752, altura: 1536,
    pano: { x: 144, y: 134, largura: 2464, altura: 1266 } };
  // Pontos medidos na referência de 2048 × 1143; conversão à imagem original.
  const ponto = ([x,y]) => [(x*arte.largura/2048-arte.pano.x)*100/arte.pano.largura,
    (y*arte.altura/1143-arte.pano.y)*50/arte.pano.altura];
  const dente = (a,b) => [...ponto(a),...ponto(b)];
  // Cima E/D, baixo E/D, esquerda cima/baixo, direita cima/baixo,
  // meio cima E/D e meio baixo E/D: cada corte tem sua própria inclinação.
  const dentes = [
    dente([149,100],[126,60]), dente([1897,100],[1921,60]),
    dente([149,1042],[126,1081]), dente([1897,1042],[1921,1081]),
    dente([107,151],[62,117]), dente([107,981],[62,1017]),
    dente([1940,152],[1985,119]), dente([1940,981],[1985,1018]),
    dente([965,100],[977,60]), dente([1083,100],[1072,60]),
    dente([965,1042],[978,1081]), dente([1083,1042],[1071,1081]),
  ];
  for(let i=0;i<4;i++) dentes[i][1]=i<2?0:50;
  for(let i=4;i<8;i++) dentes[i][0]=i<6?0:100;
  for(let i=8;i<12;i++) dentes[i][1]=i<10?0:50;
  const nariz=(a,b)=>[...dentes[a].slice(0,2),...dentes[b].slice(0,2)];
  const paredes=[nariz(0,8),nariz(9,1),nariz(2,10),nariz(11,3),nariz(4,5),nariz(6,7),...dentes];
  // Região sem apoio da ardósia, dentro da abertura escura: só começa a
  // cair quando o centro passa da borda. Sem atração para o buraco.
  const buracos=[[89,85,43],[1026,74,43],[1961,84,43],[88,1060,42],[1026,1071,41],[1961,1060,42]]
    .map(([x,y,r])=>[...ponto([x,y]),r*50*arte.altura/(1143*arte.pano.altura)]);
  const canto={};
  for(const [k,h,v,sx,sy] of [['tl',0,4,1,1],['tr',1,6,-1,1],['bl',2,5,1,-1],['br',3,7,-1,-1]]) {
    const X=sx===1?0:100,Y=sy===1?0:50;
    canto[k]=[[sx*(dentes[h][0]-X),sx*(dentes[h][2]-X)],[sy*(dentes[v][1]-Y),sy*(dentes[v][3]-Y)]];
  }
  const meio={cima:[[50-dentes[8][0],50-dentes[8][2]],[dentes[9][0]-50,dentes[9][2]-50]],
    baixo:[[50-dentes[10][0],50-dentes[10][2]],[dentes[11][0]-50,dentes[11][2]-50]]};
  // Abaixo de 5%, estende a curva até zero, sem o impulso mínimo antigo.
  // Acima disso conserva a calibração do pano e das tacadas existentes.
  const forcaMinima=0.001;
  const velocidade=(valor)=>{
    const f=Math.max(0,Math.min(1,Number(valor)||0));
    // Hermite: valor e derivada contínuos na junção com a calibração existente.
    if(f>=0.05)return 0.1+6.9*f**2.5;
    const u=f/0.05,v=0.1+6.9*0.05**2.5,m0=v,m1=0.05*17.25*0.05**1.5;
    return (u*u*u-2*u*u+u)*m0+(-2*u*u*u+3*u*u)*v+(u*u*u-u*u)*m1;
  };
  return {arte,paredes,buracos,canto,meio,forcaMinima,velocidade,metricaY:arte.pano.altura/(arte.pano.largura/2)};
})();
if(typeof module!=='undefined'&&module.exports) module.exports=ESCRITORIO_SINUCA_MESA;
