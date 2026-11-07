// O Prédio da Vybe em voxel: um andar por departamento, uma sala por setor e a
// baia do agente em cada sala. Fachada de vidro; ao focar, os andares se abrem
// (vista explodida) para ver a operação por dentro. No topo, o ser do VYBES.
import * as THREE from 'three';
import { PLANTA, zonasDoAndar } from './planta.mjs';
import { blocos, ruido } from './irece.mjs';
import { Obra } from './voxel.mjs';

const LADO = 11;     // largura do prédio (unidades = 10 m na escala da cidade; o prédio é o herói)
const PE = 2.3;      // pé-direito de cada andar
const ABRE = 1.9;    // quanto cada andar sobe na vista aberta

// Fonte de 5×5 pontos para o letreiro.
const LETRAS = {
  V: ['10001', '10001', '10001', '01010', '00100'], Y: ['10001', '01010', '00100', '00100', '00100'],
  B: ['11110', '10001', '11110', '10001', '11110'], E: ['11111', '10000', '11110', '10000', '11111'],
};

export function construirPredio(motor, { x, z, y }) {
  const raiz = new THREE.Group();
  raiz.position.set(x, y, z);
  motor.adicionar(raiz);

  const vidro = new THREE.MeshStandardMaterial({ color: '#8FA9B2', transparent: true, opacity: .26, roughness: .08, metalness: .2, depthWrite: false });
  const andares = [];
  const salas = new Map(); // setorId → { monitor, figura, estado }
  const animaveis = [];
  const agentesRot = []; // { r, andarIdx, setor, sx } — nome do agente sobre a mesa, visível no andar em foco
  const centros = new Map(); // zona → { g, x, z, w } (salas da equipe)

  // Calçada / praça da Vybe em volta.
  raiz.add(blocos([
    { x: 0, y: -.05, z: 0, w: LADO + 6, h: .12, d: LADO + 6, cor: '#EFE7D6' },
    { x: 0, y: .05, z: 0, w: LADO + 1.2, h: .1, d: LADO + 1.2, cor: '#D9D2C2' },
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: a * (LADO / 2 + 2), y: 0, z: b * (LADO / 2 + 2), w: 1.2, h: .5, d: 1.2, cor: '#C9C1AE' })),
  ]));
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) raiz.add(blocos([
    { x: a * (LADO / 2 + 2), y: .5, z: b * (LADO / 2 + 2), w: .2, h: .8, d: .2, cor: '#7A5534' },
    { x: a * (LADO / 2 + 2), y: 1.2, z: b * (LADO / 2 + 2), w: 1.1, h: 1, d: 1.1, cor: '#5FA34E' },
  ]));

  for (const andar of PLANTA) {
    const g = new THREE.Group();
    g.userData.nivel = andar.nivel;
    g.position.y = andar.nivel * PE + .15;
    raiz.add(g);
    const terraco = andar.id === 'terraco', terreo = andar.id === 'terreo';
    const pecas = [];
    // Laje: piso claro por dentro, borda preta por fora (a caixa preta da maquete da Vybe).
    pecas.push({ x: 0, y: 0, z: 0, w: LADO, h: .22, d: LADO, cor: terraco ? '#C99A6B' : '#F4F1EA' });
    pecas.push({ x: 0, y: .02, z: 0, w: LADO + .16, h: .2, d: LADO + .16, cor: '#1C1C1F' });
    if (!terraco) fachada(g, andar, terreo);
    else {
      // Guarda-corpo do terraço.
      for (const [px, pz, w, d] of [[0, -LADO / 2, LADO, .12], [0, LADO / 2, LADO, .12], [-LADO / 2, 0, .12, LADO], [LADO / 2, 0, .12, LADO]]) pecas.push({ x: px, y: .22, z: pz, w, h: .55, d, cor: '#DDE6E8' });
    }
    // Salas: o andar dividido em faixas, uma por setor.
    const n = andar.setores.length;
    andar.setores.forEach((setor, s) => {
      const largura = (LADO - .6) / n, sx = -LADO / 2 + .3 + largura * (s + .5);
      const piso = new THREE.Color(andar.cor).lerp(new THREE.Color('#FFFFFF'), .58 + (s % 2) * .1);
      if (!terraco) pecas.push({ x: sx, y: .22, z: 0, w: largura - .12, h: .03, d: LADO - .6, cor: '#' + piso.getHexString() });
      if (s > 0 && !terraco) pecas.push({ x: -LADO / 2 + .3 + largura * s, y: .25, z: -LADO / 4 - .2, w: .1, h: .55, d: LADO / 2 - .7, cor: '#F8F8F6' });
      const sala = mobiliar(pecas, { andar, setor, sx, largura, terraco, terreo });
      salas.set(setor.id, sala);
      // Caixa invisível de clique (a sala inteira).
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(largura, PE, LADO), new THREE.MeshBasicMaterial({ visible: false }));
      caixa.position.set(sx, PE / 2, 0);
      caixa.userData.alvo = { tipo: 'setor', andar: andar.id, setor: setor.id };
      g.add(caixa); motor.clicavel(caixa);
      if (sala.figura) g.add(sala.figura);
      if (setor.agente) {
        const est = sala.estado;
        const r = motor.rotulo({ pos: new THREE.Vector3(x + sx, y + andar.nivel * PE + 2.6, z + 1), classe: 'rotulo-agente escondido ' + est,
          html: `<b>${setor.agente}</b><small>${setor.nome}${est === 'planejado' ? ' · falta ligar' : est === 'sombra' ? ' · aprendendo' : ''}</small>`, distMax: 140, prioridade: 3,
          aoClicar: () => motor.emitirClique?.({ tipo: 'setor', andar: andar.id, setor: setor.id }) });
        r.forcarEscondido = true; r.el.hidden = true;
        agentesRot.push({ r, andarIdx: andares.length, nivel: andar.nivel, setor: setor.id, andarId: andar.id, sx });
      }
      if (sala.monitor) g.add(sala.monitor);
    });
    g.add(blocos(pecas, { sombra: true }));
    salasDaEquipe(g, andar, terreo, terraco);
    if (!terraco) {
      const parede = new THREE.Mesh(new THREE.BoxGeometry(LADO - .05, PE - .25, LADO - .05), vidro);
      parede.position.y = .22 + (PE - .25) / 2; parede.renderOrder = 2;
      g.add(parede);
    }
    const r = motor.rotulo({ pos: new THREE.Vector3(x + LADO / 2 + .4, y + andar.nivel * PE + 1.2, z), classe: 'rotulo-andar escondido',
      html: `<i style="--c:${andar.cor}"></i><b>${andar.nivel === 0 ? 'Térreo' : andar.nivel === 6 ? 'Terraço' : andar.nivel + 'º'}</b><span>${andar.nome.replace(/^Terraço · /, '')}</span>`, distMax: 260, prioridade: 5 - andar.nivel / 10 });
    r.forcarEscondido = true; r.el.hidden = true;
    andares.push({ andar, g, rotulo: r });
  }
  // ---------- Salas da equipe (o Escritório dentro do prédio) ----------
  // A frente de cada andar tem as salas pessoais e os espaços comuns daquele andar,
  // com as MESMAS zonas do Escritório (voz, presença e trancas não mudam).
  function salasDaEquipe(g, andar, terreo, terraco) {
    const zonas = zonasDoAndar(andar.id);
    if (!zonas.length) return;
    const o = new Obra(), y0 = .25, M = LADO / 2;
    const marcar = (z, x, zz, w, d) => {
      centros.set(z.id, { g, x, z: zz, w });
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(w, PE, d), new THREE.MeshBasicMaterial({ visible: false }));
      caixa.position.set(x, PE / 2, zz); caixa.userData.alvo = { tipo: 'zona', zona: z.id, andar: andar.id };
      g.add(caixa); motor.clicavel(caixa);
    };
    if (terreo) { marcar(zonas[0], 0, 2.6, LADO - .6, 5); return; }
    if (terraco) {
      const quad = { cafe: [-2.9, -2.9], jogos: [-1.5, 0], lounge: [2.9, 2.6], academia: [2.9, -2.9] };
      for (const z of zonas) {
        const [x, zz] = quad[z.id] || [0, 0];
        if (z.id === 'cafe') { o.caixa(x, y0, zz, 2.2, .6, .6, '#6B4A2E').caixa(x, y0 + .6, zz, 2.3, .06, .7, '#E8E1D3'); for (const k of [-.8, 0, .8]) o.caixa(x + k, y0, zz + .7, .3, .45, .3, '#2B2F33'); o.luz(x - .7, y0 + .66, zz, .2, .25, .2, '#FFE2B0'); }
        if (z.id === 'academia') { for (const k of [-.8, .8]) o.caixa(x + k, y0, zz, .9, .1, 1.6, '#2B2F33'); o.caixa(x, y0 + .5, zz, 1.8, .06, .06, '#9AA3A8'); for (const k of [-.9, .9]) o.caixa(x + k, y0 + .35, zz, .12, .35, .35, '#1F1D1A'); }
        if (z.id === 'lounge') { o.caixa(x, y0, zz + 1, 2.2, .35, .7, '#8E4EC6').caixa(x - 1.2, y0, zz, .7, .35, 2, '#8E4EC6'); o.caixa(x + .9, y0, zz - .9, .5, .9, .4, '#3A3F44').luz(x + .9, y0 + .7, zz - .68, .35, .12, .02, '#FF7A2F'); }
        marcar(z, x, zz, 3.2, 3.2);
      }
      g.add(o.montar()); return;
    }
    const n = zonas.length, w = (LADO - .7) / n, zc = M / 2 + .05, d = M - .9;
    zonas.forEach((z, k) => {
      const x = -M + .35 + w * (k + .5), pessoal = Boolean(z.dono);
      o.caixa(x, y0 - .02, zc, w - .08, .03, d, pessoal ? '#E4C9A3' : '#D6E6F2');
      if (k > 0) o.caixa(x - w / 2, y0, zc, .08, .95, d, '#F8F8F6').caixa(x - w / 2, y0 + .95, zc, .08, .5, d, '#CFE6EC');
      o.caixa(x, y0, zc - d / 2 + .05, w - .1, 1.25, .08, '#F2EEE6');
      o.letreiro((z.dono || z.nome).slice(0, Math.max(4, Math.floor((w - .2) / .2))), { x, y: y0 + 1.05, z: zc - d / 2 + .1, px: .05, cor: '#1F1D1A', fundo: pessoal ? '#FFFFFF' : '#FFE6D6' });
      if (pessoal) {
        o.caixa(x, y0, zc - .5, Math.min(1.1, w - .3), .55, .5, '#C99A6B').caixa(x, y0, zc + .15, .35, .4, .35, '#3A3F44');
        o.luz(x, y0 + .58, zc - .62, .5, .32, .05, '#9FF0C8').caixa(x + w / 2 - .3, y0, zc + d / 2 - .35, .3, .3, .3, '#C9A271').caixa(x + w / 2 - .3, y0 + .3, zc + d / 2 - .35, .38, .45, .38, '#5FA34E');
      } else if (z.id === 'reuniao') { o.caixa(x, y0, zc, w * .55, .5, 1.2, '#FFFFFF'); for (const a of [-1, 1]) for (const b of [-.5, 0, .5]) o.caixa(x + b * w * .5, y0, zc + a * .85, .3, .4, .3, '#2B2F33'); o.luz(x, y0 + .4, zc - d / 2 + .14, w * .6, .55, .03, '#BFE3EA'); }
      else if (z.id === 'producao') { o.caixa(x - .3, y0, zc, .06, .9, .06, '#2B2F33').caixa(x - .3, y0 + .9, zc, .35, .22, .25, '#1F1D1A').luz(x - .3, y0 + .96, zc + .14, .12, .1, .02, '#E5484D'); o.caixa(x + .5, y0, zc + .4, .06, 1.1, .06, '#2B2F33').luz(x + .5, y0 + 1.1, zc + .4, .4, .3, .1, '#FFF1D2'); }
      else if (z.id === 'operacao') { for (const a of [-1, 0, 1]) o.luz(x + a * w * .28, y0 + .5, zc - d / 2 + .14, w * .26, .55, .03, ['#9FF0C8', '#BFE3EA', '#FFD6A8'][a + 1]); o.caixa(x, y0, zc - .2, w * .8, .5, .5, '#2B2F33'); }
      else if (z.id === 'auditorio') { for (let r2 = 0; r2 < 3; r2++) for (let c = -2; c <= 2; c++) o.caixa(x + c * .38, y0 + r2 * .08, zc - .3 + r2 * .6, .3, .38, .3, '#B5462F'); o.luz(x, y0 + .45, zc - d / 2 + .14, w * .7, .6, .03, '#FFFFFF'); }
      else if (z.id === 'foco') { for (const a of [-1, 1]) o.caixa(x + a * w * .22, y0, zc, .9, .5, .5, '#FFFFFF').caixa(x + a * w * .22, y0 + .5, zc - .2, .9, .5, .06, '#C9D6CF'); }
      marcar(z, x, zc, w - .1, d);
    });
    g.add(o.montar());
  }

  // Quem está em cada sala: bonecos voxel na zona da presença do Escritório.
  let grupoPessoas = [], rotulosPessoas = [];
  const CORES_ROUPA = { laranja: '#FF9548', azul: '#78AAFF', verde: '#72CCAC', roxo: '#AC9BFF', rosa: '#EF9FBC', grafite: '#64738A' };
  function presenca(lista) {
    motor.invalidar();
    for (const m of grupoPessoas) m.parent?.remove(m);
    for (const r of rotulosPessoas) motor.removerRotulo(r);
    grupoPessoas = []; rotulosPessoas = [];
    const porZona = new Map();
    for (const p of lista) { if (!centros.has(p.zona)) continue; if (!porZona.has(p.zona)) porZona.set(p.zona, []); porZona.get(p.zona).push(p); }
    for (const [zona, gente] of porZona) {
      const c = centros.get(zona), o = new Obra();
      gente.forEach((p, i) => {
        const px = c.x + (i - (gente.length - 1) / 2) * Math.min(.55, c.w / Math.max(1, gente.length)), pz = c.z + .3 + (i % 2) * .3;
        o.pessoa(px / 1.5, .25 / 1.5, pz / 1.5, { roupa: CORES_ROUPA[p.roupa] || p.cor || '#FF7A2F' });
      });
      const malha = o.montar(); malha.scale.setScalar(1.5); c.g.add(malha); grupoPessoas.push(malha);
      const r = motor.rotulo({ pos: new THREE.Vector3(), classe: 'rotulo-pessoas', html: gente.map((p) => `<b>${String(p.nome).split(' ')[0].replace(/[<>&]/g, '')}</b>`).join(''), distMax: 220, prioridade: 3 });
      r.centro = c; rotulosPessoas.push(r);
    }
  }
  motor.animar(() => { for (const r of rotulosPessoas) { r.pos.set(x + r.centro.x, y + r.centro.g.position.y + 2.2, z + r.centro.z); r.el.hidden = !r.centro.g.visible; } });

  // Fachada de cada andar, como a maquete da Vybe: frente e lado direito de vidro com
  // caixilho preto fino; fundo e lado esquerdo em ripado preto com frestas de LED quente;
  // a coluna laranja na quina da frente (com VYBE no alto) e a marquise laranja acesa.
  function fachada(g, andar, terreo) {
    const o = new Obra(), H = PE - .22, y0 = .22, M = LADO / 2;
    // Ripado: fundo (-z) e lado esquerdo (-x).
    for (let a = -M; a <= M; a += .24) {
      const cor = Math.round((a + M) / .24) % 2 ? '#1C1C1F' : '#2A2A2E';
      o.caixa(a, y0, -M - .06, .12, H, .1, cor);
      o.caixa(-M - .06, y0, a, .1, H, .12, cor);
    }
    for (const a of [-M + 1.6, -1.2, 2.4]) { o.luz(a, y0 + .1, -M - .12, .05, H - .2, .03, '#FF9A4A'); o.luz(-M - .12, y0 + .1, a, .03, H - .2, .05, '#FF9A4A'); }
    // Caixilhos da frente (+z) e do lado direito (+x).
    for (let k = 0; k <= 6; k++) { const p = -M + k * LADO / 6; o.caixa(p, y0, M + .03, .06, H, .06, '#1C1C1F'); o.caixa(M + .03, y0, p, .06, H, .06, '#1C1C1F'); }
    // Coluna laranja na quina da frente.
    o.caixa(-M + 1.3, y0 - .02, M + .1, 2.6, H + .04, .22, '#FF6A1F');
    if (andar.nivel === 5) o.letreiro('VYBE', { x: -M + 1.3, y: y0 + H / 2, z: M + .22, px: .15, cor: '#FFFFFF', aceso: true });
    // Luz quente no teto de cada sala (vista de fora pelo vidro).
    for (const a of [-3, 0, 3]) o.luz(a + .8, y0 + H - .06, 0, 1.6, .05, 6, '#FFE2B0');
    if (terreo) {
      // Marquise laranja acesa, contornando frente e lado direito, e o "vybe." no vidro.
      o.luz(.9, y0 + H - .3, M + .55, LADO - 1.6, .26, 1.1, '#FF7A2F');
      o.luz(M + .55, y0 + H - .3, 0, 1.1, .26, LADO + 1, '#FF7A2F');
      o.letreiro('vybe.', { x: 2.6, y: y0 + 1.25, z: M + .07, px: .13, cor: '#FFFFFF', aceso: true });
      // Gente da equipe no térreo (o atendimento é de gente; os agentes são o VYBES).
      o.pessoa(-2.2, y0, 3.2, { roupa: '#FF7A2F' }).pessoa(-1.7, y0, 3.5, { roupa: '#2B2F33', cabelo: '#6B4A2E' }).pessoa(3.6, y0, 2.2, { roupa: '#F4F1EA' });
    } else {
      o.luz(.9, y0 + H - .05, M + .14, LADO - 1.6, .06, .06, '#FF7A2F');
      o.luz(M + .14, y0 + H - .05, 0, .06, .06, LADO, '#FF7A2F');
      if (andar.nivel % 2) o.pessoa(3.4, y0, 1.6, { roupa: andar.nivel === 3 ? '#18A957' : '#FF7A2F' });
    }
    g.add(o.montar());
  }

  // ----- O ser do VYBES, flutuando sobre o terraço -----
  const ser = new THREE.Group();
  const cubos = [];
  const R = 1.9, b = .32;
  for (let i = -R; i <= R; i += b) for (let j = -R; j <= R; j += b) for (let k = -R; k <= R; k += b) {
    const d = Math.hypot(i, j, k);
    if (d <= R && d > R - b * 1.2) cubos.push([i, j, k]);
  }
  const matSer = new THREE.MeshStandardMaterial({ roughness: .3, metalness: .1, emissive: '#5B4BD6', emissiveIntensity: .55 });
  const casca = new THREE.InstancedMesh(new THREE.BoxGeometry(b * .9, b * .9, b * .9), matSer, cubos.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  cubos.forEach(([i, j, k], n) => {
    m.makeTranslation(i, j, k); casca.setMatrixAt(n, m);
    const t = (j + R) / (2 * R);
    casca.setColorAt(n, c.set('#8B7DFF').lerp(new THREE.Color('#FF9A5C'), Math.max(0, t - .35) * 1.2).offsetHSL(0, 0, (ruido(n, 3) - .5) * .1));
  });
  casca.castShadow = true;
  ser.add(casca);
  const nucleo = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: '#FFE3C8' }));
  ser.add(nucleo);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(2.9, .07, 6, 48), new THREE.MeshBasicMaterial({ color: '#FFB27A', transparent: true, opacity: .75 }));
  anel.rotation.x = Math.PI / 2.3; ser.add(anel);
  const luz = new THREE.PointLight('#A89BFF', 6, 22, 1.6); ser.add(luz);
  ser.position.y = PE * 7 + 3.2;
  ser.userData.alvo = { tipo: 'vybes' };
  motor.clicavel(ser);
  raiz.add(ser);
  const rotuloSer = motor.rotulo({ pos: new THREE.Vector3(x, y + PE * 7 + 6.6, z), classe: 'rotulo-vybes', html: '<i></i><b>VYBES</b>', distMax: 700, prioridade: 10 });

  // ----- Animação: ser respirando, agentes trabalhando, andares abrindo -----
  let abre = 0, abreQuer = 0, estadoSer = 'calmo', foco = null;
  const tira = new Map(); // nível → quanto o andar subiu para fora da vista (foco num andar)
  motor.animar((t, dt) => {
    let abrindo = Math.abs(abreQuer - abre) > .001;
    abre += (abreQuer - abre) * (1 - Math.pow(.002, dt));
    for (const a of andares) {
      // Com um andar em foco, os de cima saem para o alto e somem: a sala fica à vista.
      const quer = foco !== null && a.andar.nivel > foco ? 60 : 0;
      const t0 = tira.get(a.andar.nivel) || 0; abrindo = abrindo || Math.abs(quer - t0) > .001;
      const t1 = t0 + (quer - t0) * (1 - Math.pow(.004, dt));
      tira.set(a.andar.nivel, t1);
      a.g.position.y = a.andar.nivel * PE + .15 + a.andar.nivel * ABRE * abre + t1;
      a.g.visible = t1 < 45;
      a.rotulo.el.hidden = !abreQuer || t1 > 2;
    }
    ser.visible = foco === null;
    vidro.opacity = foco !== null ? .04 : .3 - .22 * abre;
    const pulso = estadoSer === 'alerta' ? 1 + Math.sin(t * 7) * .06 : 1 + Math.sin(t * 1.6) * .035;
    casca.scale.setScalar(pulso);
    casca.rotation.y = t * .25; anel.rotation.z = t * .6;
    ser.position.y = PE * 7 + 3.2 + Math.sin(t * .9) * .25 + abre * 6 * ABRE;
    nucleo.material.color.setHSL(estadoSer === 'alerta' ? .0 : .07, 1, .82 + Math.sin(t * 2) * .06);
    luz.intensity = 5 + Math.sin(t * 1.6) * 1.2;
    rotuloSer.pos.y = y + ser.position.y + 3.4;
    for (const a of andares) a.rotulo.pos.y = y + a.g.position.y + 1.2;
    for (const ag of agentesRot) { const a = andares[ag.andarIdx]; if (!a) continue; ag.r.pos.y = y + a.g.position.y + 2.6; const ver = foco === ag.nivel && a.g.visible; ag.r.el.hidden = !ver; ag.r.forcarEscondido = !ver; }
    for (const f of animaveis) f(t);
    return abrindo || (ser.visible && motor.emVista(ser)) || [...salas.values()].some((s) => s.figura && motor.emVista(s.figura));
  });

  function mobiliar(pecas, { andar, setor, sx, largura, terraco, terreo }) {
    const zMesa = -LADO / 2 + 2.2, estado = setor.estado;
    if (terraco) {
      // O Escritório no terraço: mesa de sinuca, ombrelones, sofás e plantas.
      pecas.push({ x: -1.5, y: .22, z: 0, w: 3.2, h: .55, d: 1.8, cor: '#5A3A22' }, { x: -1.5, y: .77, z: 0, w: 2.9, h: .06, d: 1.5, cor: '#1F8A4C' });
      for (const [px, pz, cor] of [[2.6, -2.6, '#FF7A2F'], [2.6, 2.4, '#38D9C5'], [-3.6, 3.4, '#F7C948']]) {
        pecas.push({ x: px, y: .22, z: pz, w: .12, h: 1.6, d: .12, cor: '#E9E4DA' }, { x: px, y: 1.8, z: pz, w: 2, h: .14, d: 2, cor });
        pecas.push({ x: px + .7, y: .22, z: pz, w: .5, h: .4, d: .5, cor: '#F4F1EA' }, { x: px - .7, y: .22, z: pz, w: .5, h: .4, d: .5, cor: '#F4F1EA' });
      }
      for (const [px, pz] of [[-4.6, -4.4], [4.5, -4.5], [4.4, 4.6], [-4.6, 0]]) pecas.push({ x: px, y: .22, z: pz, w: .7, h: .5, d: .7, cor: '#C9A271' }, { x: px, y: .72, z: pz, w: .9, h: .9, d: .9, cor: '#4F9A4E' });
      return {};
    }
    if (terreo) {
      // Recepção: balcão curvo, porta e o totem do VYBES.
      pecas.push({ x: sx, y: .25, z: -1, w: 4.2, h: .8, d: .7, cor: '#FFFFFF' }, { x: sx, y: .25, z: -1.4, w: 4.2, h: .9, d: .12, cor: '#FF7A2F' });
      pecas.push({ x: sx - 2.4, y: .25, z: -.4, w: .7, h: .8, d: 1.6, cor: '#FFFFFF' }, { x: sx + 2.4, y: .25, z: -.4, w: .7, h: .8, d: 1.6, cor: '#FFFFFF' });
      pecas.push({ x: 0, y: .22, z: LADO / 2 - .02, w: 2.4, h: 1.8, d: .14, cor: '#3A3F44' });
      for (const px of [-4, -3, 3, 4]) pecas.push({ x: px, y: .25, z: 3.2, w: .8, h: .45, d: .8, cor: '#E8E1D3' });
      pecas.push({ x: -4.4, y: .25, z: -4.4, w: .7, h: .5, d: .7, cor: '#C9A271' }, { x: -4.4, y: .75, z: -4.4, w: .9, h: 1.2, d: .9, cor: '#4F9A4E' });
    } else {
      // Baia: mesa, cadeira e estante, mais um sofá de espera.
      pecas.push({ x: sx, y: .25, z: zMesa, w: Math.min(2.6, largura - .6), h: .62, d: .9, cor: '#C99A6B' });
      pecas.push({ x: sx, y: .25, z: zMesa + 1, w: .6, h: .45, d: .6, cor: '#3A3F44' });
      pecas.push({ x: sx - largura / 2 + .45, y: .25, z: -LADO / 2 + .8, w: .5, h: 1.6, d: .9, cor: '#E3D8C4' });
      for (let k = 0; k < 3; k++) pecas.push({ x: sx - largura / 2 + .45, y: .55 + k * .45, z: -LADO / 2 + .8 + (ruido(k, sx * 9) - .5) * .4, w: .52, h: .22, d: .3, cor: ['#FF7A2F', '#0D74CE', '#D6409F', '#18A957'][(ruido(k + 3, sx) * 4) | 0] });
    }
    // Monitor: aceso quando o agente trabalha; apagado quando a sala espera ligar.
    const ligado = estado !== 'planejado';
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(.9, .55, .08), new THREE.MeshBasicMaterial({ color: ligado ? '#9FF0C8' : '#2C3A33' }));
    monitor.position.set(sx, .25 + .62 + .35, (terreo ? -1 : zMesa) - .25);
    let figura = null;
    if (setor.agente && ligado) {
      // O agente é o VYBES naquele setor: figura de luz lilás (sombra = translúcida).
      figura = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#B9B0FF', emissive: '#6A5CFF', emissiveIntensity: .7, transparent: estado === 'sombra', opacity: estado === 'sombra' ? .55 : 1 });
      const corpo = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .32), mat); corpo.position.y = .62;
      const cabeca = new THREE.Mesh(new THREE.BoxGeometry(.36, .36, .36), mat); cabeca.position.y = 1.15;
      const pernas = new THREE.Mesh(new THREE.BoxGeometry(.44, .32, .3), mat); pernas.position.y = .16;
      figura.add(corpo, cabeca, pernas);
      figura.position.set(sx, .25, (terreo ? -1 : zMesa) + (terreo ? -.55 : .75));
      figura.rotation.y = Math.PI; figura.scale.setScalar(1.5);
      if (terreo) figura.rotation.y = 0;
      const fase = ruido(sx * 13, andar.nivel) * 6;
      animaveis.push((t) => { cabeca.position.y = 1.15 + Math.sin(t * 3 + fase) * .03; corpo.rotation.z = Math.sin(t * 1.3 + fase) * .03;
        monitor.material.color.setHSL(.42, .7, .72 + Math.sin(t * 4 + fase) * .05); });
    }
    return { monitor, figura, estado };
  }

  return {
    LADO, PE, raiz,
    focar: (nivel) => { foco = nivel ?? null; motor.invalidar(); },
    presenca,
    zonas: () => [...centros.keys()],
    // Posição de cada agente no mundo (para as sinapses do cérebro).
    posDoSetor: (id) => { const ag = agentesRot.find((q) => q.setor === id); const a = ag && andares[ag.andarIdx]; return a ? { x: x + ag.sx, y: y + a.g.position.y + 1.6, z: z + 1, nivel: ag.nivel, andar: ag.andarId } : null; },
    agentes: () => agentesRot.map((q) => ({ setor: q.setor, andar: q.andarId, nivel: q.nivel })),
    abrir: (sim) => {
      motor.invalidar();
      abreQuer = sim ? 1 : 0;
      if (!sim) foco = null;
      for (const a of andares) { a.rotulo.el.hidden = !sim; a.rotulo.el.classList.toggle('escondido', !sim); }
    },
    aberto: () => abreQuer > 0,
    alturaDoAndar: (nivel) => y + nivel * PE + nivel * ABRE * abreQuer,
    alerta: (sim) => { const estado = sim ? 'alerta' : 'calmo'; if (estadoSer !== estado) { estadoSer = estado; motor.invalidar(); } },
    salas,
  };
}
