// A vida do Centro comercial (Paulo, 08/11/2026: "o mundo tá muito pobre… mais vivo, detalhado"): gente andando
// nas calçadas, o time que está online passeando na praça com o próprio boneco, água no chafariz e na cachoeira,
// pássaros, ilhotas e nuvens que se mexem devagar, e as lojas reagindo ao cliente (chão vermelho pulsando com peça
// atrasada, confete com peça pronta). Tudo anima só à vista; "Reduzir movimento" deixa tudo parado no lugar.
// O motor já reduz os quadros com a página parada e para de desenhar depois de 1 minuto sem ninguém mexer.
import * as THREE from 'three';
import { Obra } from './voxel.mjs';
import { ruido } from './irece.mjs';
import { desenharBoneco, figuraDaPessoa } from './avatar.mjs';

const CHAO = .12;
const PEDESTRES = 16;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ponto num quadrado de meia-largura h, pelo perímetro (0..8h), e a direção do passo.
function noQuadrado(d, h) {
  const P = 8 * h, u = ((d % P) + P) % P, lado = Math.floor(u / (2 * h)), k = u - lado * 2 * h - h;
  return [[k, -h, 1, 0], [h, k, 0, 1], [-k, h, -1, 0], [-h, -k, 0, -1]][lado];
}

export function criarVida(motor, centro, { reduzirMovimento = false } = {}) {
  const grupo = new THREE.Group(); motor.adicionar(grupo);
  const parado = Boolean(reduzirMovimento);
  const matLuz = new THREE.MeshBasicMaterial({ toneMapped: false });
  const cubo = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), cor = new THREE.Color();

  function boneco(f, s = .8) { const o = new Obra(); desenharBoneco(o, f, { s }); const g = o.montar({ sombra: false }); grupo.add(g); return g; }
  function soltar(g) { grupo.remove(g); g.traverse((q) => q.geometry?.dispose?.()); }

  // ---------- Gente andando na calçada do anel ----------
  let pedestres = [];
  function montarPedestres() {
    for (const p of pedestres) soltar(p.g);
    const L = centro.layout(), h0 = L.R - 1.6;
    pedestres = Array.from({ length: PEDESTRES }, (_, i) => {
      const f = figuraDaPessoa({ id: 'passante-' + i });
      return { g: boneco(f), h: h0 + (i % 2 ? .7 : -.7), d: ruido(i, 13) * 8 * h0, v: (.9 + ruido(13, i) * .7) * (i % 3 ? 1 : -1), fase: i * .7 };
    });
  }

  // ---------- O time online passeando na praça (quem não está numa sala do prédio) ----------
  let online = [], assinaturaOnline = '';
  function definirOnline(lista = []) {
    const gente = lista.filter((p) => p && p.id).slice(0, 12), assin = gente.map((p) => p.id + ':' + (p.figura || p.roupa || '')).join('|');
    if (assin === assinaturaOnline) return;
    assinaturaOnline = assin;
    for (const p of online) { soltar(p.g); motor.removerRotulo(p.r); }
    online = gente.map((p, i) => ({
      g: boneco(figuraDaPessoa(p), .85), h: 12.6, d: i / Math.max(1, gente.length) * 8 * 12.6, v: .8 + (i % 3) * .15, fase: i,
      r: motor.rotulo({ pos: new THREE.Vector3(), classe: 'rotulo-passeio', html: `<b>${esc(String(p.nome || '').split(' ')[0])}</b>`, distMax: 200, prioridade: 2 }),
    }));
    motor.invalidar();
  }

  // ---------- Partículas: chafariz, cachoeira, confete e o chão das lojas atrasadas ----------
  const GOTAS_CHAFARIZ = 10, GOTAS_CACHOEIRA = 16, PASSAROS = 4;
  const gotas = new THREE.InstancedMesh(cubo, matLuz, GOTAS_CHAFARIZ + GOTAS_CACHOEIRA);
  for (let i = 0; i < gotas.count; i++) gotas.setColorAt(i, cor.set(i < GOTAS_CHAFARIZ ? '#BFEAF8' : '#E4F6FC'));
  gotas.frustumCulled = false; grupo.add(gotas);
  const passaros = new THREE.InstancedMesh(cubo, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: .8 }), PASSAROS * 3);
  for (let i = 0; i < passaros.count; i++) passaros.setColorAt(i, cor.set(i % 3 ? '#F4F1EA' : '#3A3F44'));
  passaros.frustumCulled = false; grupo.add(passaros);

  let confete = null, alerta = null, lojas = [];
  function definirLojas() {
    lojas = centro.lojasVivas?.() || [];
    for (const m of [confete, alerta]) if (m) { grupo.remove(m); m.geometry !== cubo && m.geometry.dispose(); }
    const festa = lojas.filter((l) => l.prontas > 0 && !l.atrasada).slice(0, 8), atraso = lojas.filter((l) => l.atrasada);
    confete = festa.length ? new THREE.InstancedMesh(cubo, matLuz, festa.length * 18) : null;
    if (confete) {
      const cores = ['#FF7A2F', '#F2C14E', '#18A957', '#0D74CE', '#D6409F', '#FFFFFF'];
      for (let i = 0; i < confete.count; i++) confete.setColorAt(i, cor.set(cores[i % cores.length]));
      confete.userData.lojas = festa; confete.frustumCulled = false; grupo.add(confete);
    }
    // Peça atrasada: o chão em frente da loja pulsa em vermelho (o mesmo vermelho da bolinha de atraso).
    alerta = atraso.length ? new THREE.InstancedMesh(cubo, new THREE.MeshBasicMaterial({ color: '#E5484D', transparent: true, opacity: .5, depthWrite: false, toneMapped: false }), atraso.length) : null;
    if (alerta) {
      atraso.forEach((l, i) => {
        const fx = l.frente.x, fz = l.frente.z, deLado = l.lado % 2;
        m4.makeScale(deLado ? 1.4 : 5.4, .04, deLado ? 5.4 : 1.4).setPosition(fx + [0, .7, 0, -.7][l.lado], CHAO + .03, fz + [.7, 0, -.7, 0][l.lado]);
        alerta.setMatrixAt(i, m4);
      });
      alerta.renderOrder = 3; grupo.add(alerta);
    }
    motor.invalidar();
  }

  function passo(lista, t, dt, y = CHAO) {
    for (const p of lista) {
      if (!parado) p.d += p.v * dt;
      const [x, z, dx, dz] = noQuadrado(p.d, p.h), s = Math.sign(p.v) || 1;
      p.g.position.set(x, y + (parado ? 0 : Math.abs(Math.sin(t * 7 + p.fase)) * .06), z);
      p.g.rotation.y = Math.atan2(dx * s, dz * s);
      if (p.r) p.r.pos.set(x, y + 1.9, z);
    }
  }

  montarPedestres(); definirLojas();
  let ultimoT = 0;
  motor.animar((t, dt) => {
    if (parado && ultimoT) return false;
    ultimoT = t;
    const vista = true; // a maquete inteira está sempre à vista com o mundo aberto (fechado, o motor nem chama)
    passo(pedestres, t, dt); passo(online, t, dt);
    // Chafariz: gotas em arco saindo da taça e voltando para a bacia.
    const c = centro.chafariz?.();
    if (c) for (let i = 0; i < GOTAS_CHAFARIZ; i++) {
      const k = ((t * .9 + i / GOTAS_CHAFARIZ) % 1), a = i / GOTAS_CHAFARIZ * Math.PI * 2, r = .3 + k * 1.1;
      m4.makeScale(.14, .14, .14).setPosition(c.x + Math.cos(a) * r, c.y + .3 + Math.sin(k * Math.PI) * 1.1 - k * .9, c.z + Math.sin(a) * r);
      gotas.setMatrixAt(i, m4);
    }
    // Cachoeira: gotas descendo a face da borda.
    const q = centro.cachoeira?.();
    if (q) for (let i = 0; i < GOTAS_CACHOEIRA; i++) {
      const k = ((t * .5 + ruido(i, 3)) % 1);
      m4.makeScale(.18, .3, .18).setPosition(q.x - ruido(3, i) * .3, q.topo - k * (q.topo - q.base) - .3, q.z + (ruido(i, 9) - .5) * 2);
      gotas.setMatrixAt(GOTAS_CHAFARIZ + i, m4);
    }
    gotas.instanceMatrix.needsUpdate = true;
    // Pássaros: corpo e duas asas batendo, voando em círculo alto.
    const S = centro.layout().S;
    for (let b = 0; b < PASSAROS; b++) {
      const a = t * (.12 + b * .02) + b * 1.6, r = S * (.55 + b * .12), x = Math.cos(a) * r, z = Math.sin(a) * r, y = 22 + b * 3 + Math.sin(t + b) * 1.2;
      const giro = -a, asa = Math.sin(t * 9 + b) * .6, base = new THREE.Matrix4().makeRotationY(giro).setPosition(x, y, z);
      passaros.setMatrixAt(b * 3, m4.copy(base).multiply(new THREE.Matrix4().makeScale(.35, .3, .9)));
      for (const lado of [-1, 1]) {
        const asaM = new THREE.Matrix4().makeTranslation(lado * .4, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(lado * asa)).multiply(new THREE.Matrix4().makeTranslation(lado * .35, 0, 0)).multiply(new THREE.Matrix4().makeScale(.8, .06, .5));
        passaros.setMatrixAt(b * 3 + (lado < 0 ? 1 : 2), m4.copy(base).multiply(asaM));
      }
    }
    passaros.instanceMatrix.needsUpdate = true;
    // Ilhotas balançando e as nuvens girando devagar em volta da maquete.
    (centro.ilhotas?.() || []).forEach((m, i) => { m.position.y = m.userData.y0 + Math.sin(t * .5 + i * 2) * .5; });
    const nv = centro.nuvens?.(); if (nv) nv.rotation.y = t * .008;
    // Lojas: confete subindo e caindo sobre a loja com peça pronta; chão vermelho pulsando na atrasada.
    if (confete) confete.userData.lojas.forEach((l, j) => {
      for (let i = 0; i < 18; i++) {
        const k = ((t * .35 + ruido(i, j)) % 1), a = ruido(j, i) * Math.PI * 2, r = .4 + ruido(i + 7, j) * 2;
        m4.makeRotationFromEuler(new THREE.Euler(t * 3 + i, t * 2 + j, 0)).scale(new THREE.Vector3(.16, .16, .04)).setPosition(l.x + Math.cos(a) * r, 6.2 - k * 3.4, l.z + Math.sin(a) * r);
        confete.setMatrixAt(j * 18 + i, m4);
      }
      confete.instanceMatrix.needsUpdate = true;
    });
    if (alerta) alerta.material.opacity = .25 + Math.abs(Math.sin(t * 2.4)) * .45;
    return vista;
  });

  return {
    // À noite as nuvens (que não dependem da luz) escurecem junto com o céu.
    noite(k) { const nv = centro.nuvens?.(); if (nv) nv.material.color.set('#FFFFFF').lerp(new THREE.Color('#5A6894'), k); },
    definirOnline,
    lojasMudaram: definirLojas,
    tamanhoMudou: () => { montarPedestres(); definirLojas(); },
  };
}

// Dia e noite pela hora da Bahia: fração de "noite" (0 de dia, 1 de noite) com o amanhecer e o entardecer suaves.
export function noiteDaHora(minutos) {
  const h = ((Number(minutos) || 0) / 60) % 24;
  if (h >= 6.5 && h <= 17.5) return 0;
  if (h > 17.5 && h < 19) return (h - 17.5) / 1.5;
  if (h > 5 && h < 6.5) return 1 - (h - 5) / 1.5;
  return 1;
}
