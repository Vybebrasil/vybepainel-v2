import { apresentarAgente, ESTADOS_REAIS } from './atividade-agentes.mjs';
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

  const vidro = new THREE.MeshStandardMaterial({ color: '#B9D6DE', transparent: true, opacity: .22, roughness: .08, metalness: .2, depthWrite: false });
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
  // Praça da Vybe: canteiros de grama, bancos, bicicletário e o totem com a marca na entrada.
  {
    const o = new Obra(), M = LADO / 2, F = LADO / 2 + 2.6;
    for (const [px, pz, w, d] of [[-F + .6, 0, 1.2, LADO - 1], [0, -F + .6, LADO - 1, 1.2]]) { o.caixa(px, .02, pz, w, .14, d, '#CFC6B2').caixa(px, .16, pz, w - .2, .06, d - .2, '#7FB069'); }
    for (const k of [-3, 0, 3]) { o.caixa(-F + .6, .2, k, .5, .5 + Math.abs(k) * .06, .5, '#5FA34E'); o.caixa(k, .2, -F + .6, .5, .45, .5, '#4C8F3F'); }
    for (const k of [-3.2, 3.2]) o.caixa(k, .05, M + 2.1, 1.6, .28, .45, '#B98552').caixa(k, .05, M + 2.1, .12, .22, .4, '#5A6268');
    for (let k = 0; k < 4; k++) o.caixa(M + 2.2, .05, -2 + k * .55, .06, .5, .4, '#5A6268');
    o.caixa(-M + 1.3, .05, M + 2.6, .5, 2.4, .5, '#1F1D1A').luz(-M + 1.3, 1.4, M + 2.86, .36, .9, .02, '#FF7A2F');
    raiz.add(o.montar());
  }
  { // as quatro árvores da praça do prédio, em cachos
    const o = new Obra();
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) o.arvore(a * (LADO / 2 + 2), .45, b * (LADO / 2 + 2), { s: 1.25, cor: a * b > 0 ? '#5FA34E' : '#4F9A4E', fruta: a > 0 && b < 0 ? '#F2C230' : null });
    raiz.add(o.montar());
  }

  for (const andar of PLANTA) {
    const g = new THREE.Group();
    g.userData.nivel = andar.nivel;
    g.position.y = andar.nivel * PE + .15;
    raiz.add(g);
    const terraco = andar.id === 'terraco', terreo = andar.id === 'terreo';
    const pecas = [];
    // Laje: piso claro por dentro, borda preta por fora (a caixa preta da maquete da Vybe).
    pecas.push({ x: 0, y: 0, z: 0, w: LADO, h: .22, d: LADO, cor: terraco ? '#C99A6B' : '#F4F1EA' });
    pecas.push({ x: 0, y: .02, z: 0, w: LADO + .3, h: .2, d: LADO + .3, cor: '#ECE7DD' }, { x: 0, y: .2, z: 0, w: LADO + .32, h: .03, d: LADO + .32, cor: '#3A3F44' });
    if (!terraco) fachada(g, andar, terreo);
    else {
      // Guarda-corpo do terraço.
      for (const [px, pz, w, d] of [[0, -LADO / 2, LADO, .12], [0, LADO / 2, LADO, .12], [-LADO / 2, 0, .12, LADO], [LADO / 2, 0, .12, LADO]]) {
        pecas.push({ x: px, y: .22, z: pz, w, h: .08, d, cor: '#3A3F44' }, { x: px, y: .3, z: pz, w: w > 1 ? w : .04, h: .5, d: d > 1 ? d : .04, cor: '#CFE6EC' }, { x: px, y: .8, z: pz, w: w + .04, h: .05, d: d + .04, cor: '#8A939A' });
        for (let k = 0; k <= 10; k++) pecas.push({ x: w > 1 ? px - w / 2 + k * w / 10 : px, y: .22, z: d > 1 ? pz - d / 2 + k * d / 10 : pz, w: .05, h: .6, d: .05, cor: '#8A939A' });
      }
    }
    // Salas: o andar dividido em faixas, uma por setor.
    const n = andar.setores.length;
    andar.setores.forEach((setor, s) => {
      const largura = (LADO - .6) / n, sx = -LADO / 2 + .3 + largura * (s + .5);
      // Piso de madeira clara; a cor do setor fica no tapete da sala (antes o piso inteiro era colorido).
      if (!terraco) pecas.push({ x: sx, y: .22, z: 0, w: largura - .12, h: .03, d: LADO - .6, cor: s % 2 ? '#E9DFCF' : '#EFE7DA' });
      if (s > 0 && !terraco && !terreo) {
        // Divisória de vidro entre as salas: rodapé, montantes de alumínio, vidro claro e travessa no alto.
        const dx = -LADO / 2 + .3 + largura * s, z0 = -LADO / 2 + .35, z1 = -.55, dz = z1 - z0, zc = (z0 + z1) / 2;
        pecas.push({ x: dx, y: .25, z: zc, w: .08, h: .12, d: dz, cor: '#D9D2C2' });
        pecas.push({ x: dx, y: .37, z: zc, w: .04, h: 1.15, d: dz, cor: '#D7E8EE' });
        pecas.push({ x: dx, y: 1.52, z: zc, w: .07, h: .06, d: dz, cor: '#8A939A' });
        for (let k = 0; k <= 4; k++) pecas.push({ x: dx, y: .25, z: z0 + dz * k / 4, w: .07, h: 1.33, d: .07, cor: '#8A939A' });
      }
      const sala = mobiliar(pecas, { andar, setor, sx, largura, terraco, terreo });
      salas.set(setor.id, sala);
      // Caixa invisível de clique (a sala inteira).
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(largura, PE, LADO), new THREE.MeshBasicMaterial({ visible: false }));
      caixa.position.set(sx, PE / 2, 0);
      caixa.userData.alvo = { tipo: 'setor', andar: andar.id, setor: setor.id };
      g.add(caixa); motor.clicavel(caixa);
      if (sala.figura) g.add(sala.figura);
      if (setor.agente) {
        const est = 'indisponivel';
        const r = motor.rotulo({ pos: new THREE.Vector3(x + sx, y + andar.nivel * PE + 2.6, z + 1), classe: 'rotulo-agente escondido ' + est,
          html: `<b>${setor.agente}</b><small>${setor.nome} · sem leitura da central</small><span class="det"><em>${setor.papel || ''}</em><span class="op">Sem leitura da central agora.</span><span class="sk">${(setor.skills || []).slice(0, 4).map((k) => `<i>${k}</i>`).join('')}</span></span>`, distMax: 140, prioridade: 3,
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
    // Faixa de luz da situação do andar (verde em dia, amarelo pede aprovação, vermelho atraso/falha).
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(LADO + .42, .09, LADO + .42), new THREE.MeshBasicMaterial({ color: '#18A957', toneMapped: false }));
    faixa.position.y = .08; g.add(faixa);
    andares.push({ andar, g, rotulo: r, faixa });
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
      o.caixa(x, y0 - .02, zc, w - .08, .03, d, pessoal ? '#EBE1D2' : '#E4ECF0');
      if (pessoal) o.caixa(x, y0, zc + .1, w - .7, .02, d - 1, '#' + new THREE.Color(andar.cor).lerp(new THREE.Color('#FFFFFF'), .7).getHexString());
      if (k > 0) o.caixa(x - w / 2, y0, zc, .08, .95, d, '#F8F8F6').caixa(x - w / 2, y0 + .95, zc, .08, .5, d, '#CFE6EC');
      o.caixa(x, y0, zc - d / 2 + .05, w - .1, 1.25, .08, '#F2EEE6');
      o.letreiro((z.dono || z.nome).slice(0, Math.max(4, Math.floor((w - .2) / .2))), { x, y: y0 + 1.05, z: zc - d / 2 + .1, px: .05, cor: '#1F1D1A', fundo: pessoal ? '#FFFFFF' : '#FFE6D6' });
      if (pessoal) {
        // sala pessoal: mesa com tampo e pés, monitor aceso, cadeira com encosto, poltrona, planta e quadro
        const mw = Math.min(1.2, w - .35);
        o.caixa(x, y0 + .55, zc - .5, mw, .05, .55, '#D8B48A');
        for (const k of [-1, 1]) o.caixa(x + k * (mw / 2 - .04), y0, zc - .5, .05, .55, .5, '#F4F1EA');
        o.caixa(x, y0 + .6, zc - .68, .04, .2, .04, '#3A3F44').luz(x, y0 + .72, zc - .68, .55, .32, .04, '#9FD9F0');
        o.caixa(x, y0, zc + .12, .38, .3, .38, '#2B2F33').caixa(x, y0 + .3, zc + .3, .38, .38, .06, '#2B2F33');
        o.caixa(x - w / 2 + .35, y0, zc + d / 2 - .45, .5, .3, .5, '#8E4EC6').caixa(x - w / 2 + .35, y0 + .3, zc + d / 2 - .22, .5, .3, .08, '#8E4EC6');
        o.caixa(x + w / 2 - .3, y0, zc + d / 2 - .35, .3, .3, .3, '#C9A271').caixa(x + w / 2 - .3, y0 + .3, zc + d / 2 - .35, .38, .45, .38, '#5FA34E').caixa(x + w / 2 - .3, y0 + .72, zc + d / 2 - .35, .22, .22, .22, '#7FB069');
        o.luz(x - w / 4, y0 + .85, zc - d / 2 + .1, .35, .26, .02, ['#FFB27A', '#9FD9F0', '#C7B8FF', '#A8E6B8'][(ruido(x * 7, zc) * 4) | 0]);
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
    // Fundo (-z) e lado esquerdo (-x): brise de madeira com folga entre as ripas; a luz das salas aparece no meio.
    for (let a = -M + .2; a <= M - .1; a += .42) {
      const cor = Math.round((a + M) / .42) % 3 ? '#B98552' : '#A8743F';
      o.caixa(a, y0, -M - .1, .14, H, .14, cor);
      o.caixa(-M - .1, y0, a, .14, H, .14, cor);
    }
    // Pilares de concreto claro nas quinas.
    for (const [px, pz] of [[-M, -M], [M, -M], [-M, M], [M, M]]) o.caixa(px, y0 - .02, pz, .34, H + .04, .34, '#ECE7DD');
    // Caixilhos finos de alumínio na frente (+z) e no lado direito (+x).
    for (let k = 1; k < 6; k++) { const p = -M + k * LADO / 6; o.caixa(p, y0, M + .03, .05, H, .05, '#5A6268'); o.caixa(M + .03, y0, p, .05, H, .05, '#5A6268'); }
    o.caixa(0, y0 + H * .55, M + .03, LADO, .04, .05, '#5A6268').caixa(M + .03, y0 + H * .55, 0, .05, .04, LADO, '#5A6268');
    // Coluna laranja na quina da frente: a marca da Vybe, sobe o prédio inteiro.
    o.caixa(-M + 1.3, y0 - .02, M + .12, 2.4, H + .04, .2, '#FF6A1F');
    if (andar.nivel === 5) o.letreiro('VYBE', { x: -M + 1.3, y: y0 + H / 2, z: M + .24, px: .15, cor: '#FFFFFF', aceso: true });
    // Luz quente no teto das salas, vista de fora pelo vidro: luminárias lineares finas, num desenho separado
    // que some quando se entra no andar (antes eram placas de 1,6×6 que cobriam as salas na vista de dentro).
    const teto = new Obra();
    for (const a of [-3.4, -.6, 2.2]) for (const b of [-2.6, 0, 2.6]) teto.luz(a + .8, y0 + H - .05, b, 1.4, .04, .14, '#FFE2B0');
    const tetoM = teto.montar({ sombra: false }); g.add(tetoM); g.userData.teto = tetoM;
    // Jardineira com plantas na borda da frente (andares de cima).
    if (!terreo) {
      o.caixa(1.2, y0 - .02, M + .32, LADO - 3.2, .26, .34, '#ECE7DD');
      for (let k = 0; k < 7; k++) o.caixa(-2.2 + k * 1.05, y0 + .24, M + .32, .42, .22 + (k % 3) * .08, .26, k % 2 ? '#5FA34E' : '#4C8F3F');
      if (andar.nivel % 2) o.pessoa(3.4, y0, 1.6, { roupa: andar.nivel === 3 ? '#18A957' : '#FF7A2F' });
    } else {
      // Térreo: marquise laranja acesa, porta de vidro, "vybe." no vidro e gente no atendimento.
      o.luz(.9, y0 + H - .3, M + .55, LADO - 1.6, .22, 1.1, '#FF7A2F');
      o.luz(M + .55, y0 + H - .3, 0, 1.1, .22, LADO + 1, '#FF7A2F');
      o.caixa(2.6, y0, M + .05, 1.6, H - .4, .06, '#3A3F44').luz(2.6, y0 + .05, M + .09, 1.4, H - .5, .02, '#BFE3EA');
      o.letreiro('vybe.', { x: -.4, y: y0 + 1.25, z: M + .07, px: .13, cor: '#FFFFFF', aceso: true });
      o.pessoa(-2.2, y0, 3.2, { roupa: '#FF7A2F' }).pessoa(-1.7, y0, 3.5, { roupa: '#2B2F33', cabelo: '#6B4A2E' }).pessoa(3.6, y0, 2.2, { roupa: '#F4F1EA' });
    }
    g.add(o.montar());
  }
  // ----- O ser do VYBES, flutuando sobre o terraço -----
  const ser = new THREE.Group();
  // O V da Vybe em voxel, laranja (Paulo, 07/11/2026: "troca por um V da Vybe", "muda de roxo pra laranja"):
  // dois braços inclinados que se encontram embaixo, em três camadas de cubinhos, girando devagar.
  const cubos = [];
  const R = 1.9, b = .2, ALT = 3.8, LARG = 4.4, GROSSO = .95;
  const distSeg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
  for (let i = -LARG / 2; i <= LARG / 2 + 1e-6; i += b) for (let j = -ALT / 2; j <= ALT / 2 + 1e-6; j += b) {
    const d = Math.min(distSeg(i, j, -LARG / 2 + GROSSO / 2, ALT / 2 - GROSSO / 2, 0, -ALT / 2 + GROSSO / 2), distSeg(i, j, LARG / 2 - GROSSO / 2, ALT / 2 - GROSSO / 2, 0, -ALT / 2 + GROSSO / 2));
    if (d <= GROSSO / 2) for (const k of [-b, 0, b]) cubos.push([i, j, k]);
  }
  const matSer = new THREE.MeshStandardMaterial({ roughness: .35, metalness: .1, emissive: '#E8602E', emissiveIntensity: .45 });
  const casca = new THREE.InstancedMesh(new THREE.BoxGeometry(b * .9, b * .9, b * .9), matSer, cubos.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  cubos.forEach(([i, j, k], n) => {
    m.makeTranslation(i, j, k); casca.setMatrixAt(n, m);
    const t = (j + ALT / 2) / ALT;
    casca.setColorAt(n, c.set('#E8602E').lerp(new THREE.Color('#FFB27A'), t * .9).offsetHSL(0, 0, (ruido(n, 3) - .5) * .12));
  });
  casca.castShadow = true;
  ser.add(casca);
  const nucleo = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: '#FFE3C8' }));
  nucleo.visible = false; ser.add(nucleo); // o miolo era da esfera; o V não tem
  const anel = new THREE.Mesh(new THREE.TorusGeometry(2.9, .07, 6, 48), new THREE.MeshBasicMaterial({ color: '#FFB27A', transparent: true, opacity: .75 }));
  anel.rotation.x = Math.PI / 2.3; ser.add(anel);
  const luz = new THREE.PointLight('#FFB07A', 6, 22, 1.6); ser.add(luz);
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
      a.rotulo.el.hidden = true;
      if (a.g.userData.teto) a.g.userData.teto.visible = foco === null && abre < .05;
    }
    ser.visible = foco === null;
    vidro.opacity = foco !== null ? .04 : .22 - .16 * abre;
    const pulso = estadoSer === 'alerta' ? 1 + Math.sin(t * 7) * .06 : 1 + Math.sin(t * 1.6) * .035;
    casca.scale.setScalar(pulso);
    casca.rotation.y = t * .25; anel.rotation.z = t * .6;
    ser.position.y = PE * 7 + 3.2 + Math.sin(t * .9) * .25 + abre * 6 * ABRE;
    nucleo.material.color.setHSL(estadoSer === 'alerta' ? .0 : .07, 1, .82 + Math.sin(t * 2) * .06);
    luz.intensity = 5 + Math.sin(t * 1.6) * 1.2;
    rotuloSer.pos.y = y + ser.position.y + 3.4;
    for (const a of andares) a.rotulo.pos.y = y + a.g.position.y + 1.2;
    for (const ag of agentesRot) { const a = andares[ag.andarIdx]; if (!a) continue; ag.r.pos.y = y + a.g.position.y + 2.6; const ver = foco === ag.nivel && a.g.visible; ag.r.el.hidden = !ver; ag.r.forcarEscondido = !ver; }
    let agenteAnimado = false;
    for (const f of animaveis) agenteAnimado = (f(t) === true) || agenteAnimado;
    return abrindo || (ser.visible && motor.emVista(ser)) || agenteAnimado;
  });

  function mobiliar(pecas, { andar, setor, sx, largura, terraco, terreo }) {
    const zMesa = -LADO / 2 + 2.2;
    if (terraco) {
      // O Escritório no terraço (Paulo, 07/11/2026: "muito mal feito"): deque de tábuas, sinuca de verdade (pés, caçapas,
      // tacos), ombrelones listrados em degraus com mesinha e cadeiras, sofás com almofadas, floreiras com flores,
      // bar com bancos e um cordão de luzinhas no guarda-corpo.
      for (let k = 0; k < 26; k++) pecas.push({ x: 0, y: .222, z: -LADO / 2 + .4 + k * .44, w: LADO - .3, h: .012, d: .03, cor: '#A87B52' }); // juntas do deque
      // sinuca
      const sx0 = -1.5;
      pecas.push({ x: sx0, y: .72, z: 0, w: 3.2, h: .14, d: 1.8, cor: '#5A3A22' }, { x: sx0, y: .8, z: 0, w: 2.9, h: .07, d: 1.5, cor: '#1F8A4C' });
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pecas.push({ x: sx0 + a * 1.4, y: .22, z: b * .72, w: .2, h: .5, d: .2, cor: '#4A2E1A' });
      for (const [a, b] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) pecas.push({ x: sx0 + a * 1.43, y: .84, z: b * .74, w: .14, h: .04, d: .14, cor: '#14171A' });
      for (const [px, pz, c] of [[-.6, .2, '#F7C948'], [-.3, -.3, '#E5484D'], [-1.1, 0, '#0D74CE'], [-2.4, .1, '#F4F1EA']]) pecas.push({ x: sx0 + px + 1.5, y: .87, z: pz, w: .1, h: .1, d: .1, cor: c });
      pecas.push({ x: sx0 - .4, y: .88, z: .45, w: 1.9, h: .03, d: .03, cor: '#D8B48A' }, { x: sx0 + 2.3, y: .22, z: -1.6, w: .3, h: 1.1, d: .1, cor: '#5A3A22' });
      // ombrelones: haste, copa em três degraus com gomos, mesinha e duas cadeiras
      for (const [px, pz, cor] of [[2.6, -2.6, '#FF7A2F'], [2.6, 2.4, '#38D9C5'], [-3.6, 3.4, '#F7C948']]) {
        pecas.push({ x: px, y: .22, z: pz, w: .5, h: .05, d: .5, cor: '#8A939A' }, { x: px, y: .27, z: pz, w: .08, h: 1.7, d: .08, cor: '#E9E4DA' });
        for (const [w, yy] of [[2.1, 1.82], [1.5, 1.93], [.8, 2.03]]) {
          pecas.push({ x: px, y: yy, z: pz, w, h: .1, d: w, cor });
          for (const g of [-1, 1]) pecas.push({ x: px + g * w * .25, y: yy + .001, z: pz, w: w * .17, h: .102, d: w + .004, cor: '#FFFFFF' });
        }
        pecas.push({ x: px, y: 1.6, z: pz, w: 2.15, h: .06, d: .06, cor }, { x: px, y: 1.6, z: pz, w: .06, h: .06, d: 2.15, cor });
        pecas.push({ x: px, y: .62, z: pz, w: .7, h: .05, d: .7, cor: '#F4F1EA' });
        for (const g of [-1, 1]) {
          pecas.push({ x: px + g * .75, y: .22, z: pz, w: .42, h: .26, d: .42, cor: '#E9E4DA' }, { x: px + g * .75, y: .48, z: pz, w: .46, h: .08, d: .44, cor: '#F4F1EA' });
          pecas.push({ x: px + g * .95, y: .5, z: pz, w: .07, h: .4, d: .44, cor: '#E9E4DA' });
        }
      }
      // sofás em L com almofadas
      for (const [px, pz, giro, alm] of [[4.6, 0, 1, '#FF7A2F'], [-4.4, -1.4, -1, '#38D9C5']]) {
        pecas.push({ x: px, y: .22, z: pz, w: .9, h: .28, d: 2.6, cor: '#E8E1D3' }, { x: px, y: .5, z: pz, w: .86, h: .1, d: 2.5, cor: '#F4F1EA' });
        pecas.push({ x: px + giro * .38, y: .5, z: pz, w: .18, h: .5, d: 2.6, cor: '#E8E1D3' });
        for (const g of [-1, 1]) pecas.push({ x: px, y: .5, z: pz + g * 1.24, w: .9, h: .3, d: .14, cor: '#E8E1D3' });
        for (const k of [-.8, 0, .8]) pecas.push({ x: px + giro * .22, y: .6, z: pz + k, w: .14, h: .3, d: .45, cor: k ? alm : '#FFFFFF' });
      }
      // floreiras: caixa de madeira, cachos verdes e flores
      for (const [px, pz] of [[-4.6, -4.4], [4.5, -4.5], [4.4, 4.6], [-4.6, 1.6], [0, -4.6], [-1, 4.6]]) {
        pecas.push({ x: px, y: .22, z: pz, w: .8, h: .45, d: .8, cor: '#B98552' }, { x: px, y: .62, z: pz, w: .7, h: .06, d: .7, cor: '#6E4B33' });
        for (const [a, b, c, cr] of [[0, 0, .3, '#4F9A4E'], [.2, .18, 0, '#5FA34E'], [-.2, .15, .1, '#3F8A3E'], [.15, -.2, .05, '#6FB35C'], [-.18, -.18, .15, '#4F9A4E']]) pecas.push({ x: px + a, y: .66 + c, z: pz + b, w: .42, h: .4, d: .42, cor: cr });
        for (const [a, b] of [[.3, .05], [-.05, .32], [-.3, -.1]]) pecas.push({ x: px + a, y: 1.02, z: pz + b, w: .09, h: .09, d: .09, cor: ['#E87FB0', '#F2C230', '#FFFFFF'][(Math.abs(a * 10) | 0) % 3] });
      }
      // bar no canto, com bancos
      pecas.push({ x: 1.4, y: .22, z: 4.5, w: 2.6, h: .78, d: .55, cor: '#1F1D1A' }, { x: 1.4, y: 1, z: 4.5, w: 2.7, h: .06, d: .65, cor: '#D8B48A' }, { x: 1.4, y: .5, z: 4.22, w: 2.5, h: .05, d: .02, cor: '#FF7A2F' });
      for (const k of [-.8, 0, .8]) pecas.push({ x: 1.4 + k, y: .22, z: 3.9, w: .06, h: .5, d: .06, cor: '#8A939A' }, { x: 1.4 + k, y: .72, z: 3.9, w: .32, h: .06, d: .32, cor: '#FF7A2F' });
      // cordão de luzinhas no guarda-corpo
      for (let k = 0; k < 18; k++) for (const lado of [-1, 1]) pecas.push({ x: -LADO / 2 + .4 + k * (LADO - .8) / 17, y: .84, z: lado * (LADO / 2 - .02), w: .07, h: .07, d: .07, cor: '#FFE2A8' });
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
      // Sala do agente: tapete na cor do setor, mesa com tampo e pés, cadeira com encosto, dois monitores,
      // luminária, estante com livros, planta no canto e um telão na parede com o painel do setor.
      const W = Math.min(2.4, largura - .7), cor = new THREE.Color(andar.cor);
      const tapete = '#' + cor.clone().lerp(new THREE.Color('#FFFFFF'), .72).getHexString(), borda = '#' + cor.clone().lerp(new THREE.Color('#FFFFFF'), .35).getHexString();
      pecas.push({ x: sx, y: .25, z: zMesa + .35, w: largura - .9, h: .02, d: 2.9, cor: borda }, { x: sx, y: .26, z: zMesa + .35, w: largura - 1.05, h: .02, d: 2.75, cor: tapete });
      // mesa: tampo fino, dois painéis laterais e gaveteiro
      pecas.push({ x: sx, y: .84, z: zMesa, w: W, h: .06, d: .85, cor: '#D8B48A' });
      for (const a of [-1, 1]) pecas.push({ x: sx + a * (W / 2 - .04), y: .25, z: zMesa, w: .06, h: .6, d: .8, cor: '#F4F1EA' });
      pecas.push({ x: sx + W / 2 - .38, y: .25, z: zMesa + .05, w: .5, h: .5, d: .6, cor: '#F4F1EA' });
      // segundo monitor (o primeiro é o que acende na cor do estado do agente), teclado e caneca
      pecas.push({ x: sx + .62, y: .9, z: zMesa - .26, w: .05, h: .32, d: .05, cor: '#3A3F44' }, { x: sx + .62, y: 1.08, z: zMesa - .25, w: .62, h: .38, d: .05, cor: '#22272B' });
      pecas.push({ x: sx, y: .9, z: zMesa + .12, w: .6, h: .03, d: .18, cor: '#3A3F44' }, { x: sx - .7, y: .9, z: zMesa + .1, w: .1, h: .12, d: .1, cor: '#FF7A2F' });
      // cadeira: base, assento e encosto
      const zc = zMesa + .78;
      pecas.push({ x: sx, y: .25, z: zc, w: .44, h: .05, d: .44, cor: '#3A3F44' }, { x: sx, y: .3, z: zc, w: .07, h: .22, d: .07, cor: '#5A6268' });
      pecas.push({ x: sx, y: .52, z: zc, w: .5, h: .08, d: .48, cor: '#2B2F33' }, { x: sx, y: .6, z: zc + .24, w: .5, h: .55, d: .07, cor: '#2B2F33' });
      // estante com livros na lateral
      const ex = sx - largura / 2 + .42, ez = -LADO / 2 + 1;
      pecas.push({ x: ex, y: .25, z: ez, w: .42, h: 1.55, d: 1, cor: '#F4F1EA' });
      for (let k = 0; k < 3; k++) {
        pecas.push({ x: ex + .03, y: .5 + k * .45, z: ez, w: .38, h: .03, d: .92, cor: '#E3D8C4' });
        for (let l = 0; l < 4; l++) pecas.push({ x: ex + .06, y: .53 + k * .45, z: ez - .34 + l * .2 + (ruido(k, l + sx) - .5) * .05, w: .3, h: .22 + ruido(l, k) * .1, d: .12, cor: ['#FF7A2F', '#0D74CE', '#D6409F', '#18A957', '#E2A11B', '#3A3F44'][(ruido(k * 4 + l, sx) * 6) | 0] });
      }
      // planta no canto
      const px = sx + largura / 2 - .45, pz = -LADO / 2 + .75;
      pecas.push({ x: px, y: .25, z: pz, w: .4, h: .38, d: .4, cor: '#C9A271' }, { x: px, y: .63, z: pz, w: .55, h: .45, d: .55, cor: '#4F9A4E' }, { x: px, y: 1.05, z: pz, w: .38, h: .35, d: .38, cor: '#5FA34E' }, { x: px, y: 1.38, z: pz, w: .2, h: .22, d: .2, cor: '#7FB069' });
      // luminária pendente sobre a mesa
      pecas.push({ x: sx, y: 1.75, z: zMesa, w: .03, h: .3, d: .03, cor: '#5A6268' }, { x: sx, y: 1.6, z: zMesa, w: .5, h: .16, d: .5, cor: '#1F1D1A' });
      // telão na parede do fundo: moldura escura e barrinhas na cor do setor (o painel do setor)
      const tz = -LADO / 2 + .22;
      pecas.push({ x: sx + .1, y: 1.0, z: tz, w: Math.min(1.8, largura - 1.4), h: .9, d: .06, cor: '#1F2328' });
      for (let k = 0; k < 5; k++) { const h = .18 + ruido(k, sx * 3 + andar.nivel) * .5; pecas.push({ x: sx + .1 - .6 + k * .3, y: 1.1, z: tz + .04, w: .16, h, d: .02, cor: k % 2 ? andar.cor : borda }); }
    }
    // Sem leitura da central, a mesa fica neutra e não simula trabalho.
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(terreo ? .9 : .72, terreo ? .55 : .42, .06), new THREE.MeshBasicMaterial({ color: '#2C3A33' }));
    monitor.position.set(terreo ? sx : sx - .3, terreo ? .25 + .62 + .35 : 1.1, (terreo ? -1 : zMesa) - .25);
    let figura = null;
    const sala = { monitor, figura: null, estado: 'indisponivel', conectado: false };
    if (setor.agente) {
      // O agente é o VYBES naquele setor: figura neutra até receber o estado observado.
      figura = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#7A8B82', emissive: '#7A8B82', emissiveIntensity: .2, transparent: true, opacity: .2 });
      const corpo = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .32), mat); corpo.position.y = .62;
      const cabeca = new THREE.Mesh(new THREE.BoxGeometry(.36, .36, .36), mat); cabeca.position.y = 1.15;
      const pernas = new THREE.Mesh(new THREE.BoxGeometry(.44, .32, .3), mat); pernas.position.y = .16;
      figura.add(corpo, cabeca, pernas);
      figura.position.set(sx, .25, (terreo ? -1 : zMesa) + (terreo ? -.55 : .75));
      figura.rotation.y = Math.PI; figura.scale.setScalar(terreo ? 1.5 : 1.15);
      if (terreo) figura.rotation.y = 0;
      const fase = ruido(sx * 13, andar.nivel) * 6;
      sala.figura = figura;
      animaveis.push((t) => {
        if (sala.estado !== 'executando' || !sala.conectado) return false;
        cabeca.position.y = 1.15 + Math.sin(t * 3 + fase) * .03; corpo.rotation.z = Math.sin(t * 1.3 + fase) * .03;
        monitor.material.color.setHSL(.57, .7, .65 + Math.sin(t * 4 + fase) * .08);
        return motor.emVista(monitor) || motor.emVista(figura);
      });
    }
    return sala;
  }

  function atividadeAgentes(agentes = [], conectado = false) {
    const porSetor = new Map(agentes.map(a => [a.setor, a]));
    let mudou = false;
    const hora = (v) => { const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
    const limpa = (t) => String(t || '').replace(/[<>&]/g, '');
    for (const [id, sala] of salas) {
      if (!sala.monitor) continue;
      const atual = apresentarAgente(porSetor.get(id));
      // Cartão do hover: o que está fazendo agora, desde quando, quantas em curso e as últimas execuções.
      const rh = agentesRot.find(a => a.setor === id)?.r, op = rh?.el.querySelector('.op');
      if (op) {
        const ult = (atual.ultimos || []).slice(0, 3).map((e) => `<span class="u ${e.estado}"><b>${hora(e.em)}</b> ${limpa(e.tarefa)}${e.erro ? ' · ' + limpa(e.erro) : ''}</span>`).join('');
        const html = !conectado ? 'Sem leitura da central agora.' : `${atual.tarefa ? `<span class="agora"><b>Agora:</b> ${limpa(atual.tarefa)}${atual.desde ? ' · desde ' + hora(atual.desde) : ''}</span>` : '<span class="agora">Sem tarefa em curso.</span>'}${atual.emCurso ? `<span class="agora">${atual.emCurso} em curso</span>` : ''}${ult || '<span class="u">Nenhuma execução registrada.</span>'}`;
        if (op.innerHTML !== html) op.innerHTML = html;
      }
      const assinatura = atual.estado + ':' + conectado;
      if (sala.assinatura === assinatura) continue;
      sala.assinatura = assinatura; sala.estado = atual.estado; sala.conectado = conectado; mudou = true;
      const cor = conectado ? atual.cor : '#7A8B82';
      sala.monitor.material.color.set(cor);
      if (sala.figura) {
        sala.figura.children.forEach(m => { if (m.material) { m.material.color.set(cor); m.material.emissive.set(cor); m.material.opacity = conectado ? (atual.estado === 'sem_execucao' ? .2 : .85) : .3; } });
        if (atual.estado !== 'executando' || !conectado) { sala.figura.children[0].rotation.z = 0; sala.figura.children[1].position.y = 1.15; }
      }
      const r = agentesRot.find(a => a.setor === id)?.r;
      if (r) { r.el.classList.remove(...Object.keys(ESTADOS_REAIS)); r.el.classList.add(atual.estado); r.el.style.setProperty('--ag-cor', cor); r.el.querySelector('small').textContent = atual.rotulo + (conectado ? '' : ' · última leitura'); }
    }
    if (mudou) motor.invalidar();
  }

  const CORES_SIT = { verde: '#18A957', amarelo: '#E2A11B', vermelho: '#D93D42', cinza: '#9AA3A8' };
  function situacaoDosAndares(mapa = {}) {
    let mudou = false;
    for (const a of andares) { const c = CORES_SIT[mapa[a.andar.id]] || CORES_SIT.cinza; if ('#' + a.faixa.material.color.getHexString().toUpperCase() !== c.toUpperCase()) { a.faixa.material.color.set(c); mudou = true; } }
    if (mudou) motor.invalidar?.();
  }
  return {
    situacaoDosAndares,
    LADO, PE, raiz, atividadeAgentes,
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
