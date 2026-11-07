// Animais do Centro de Irecê: cachorro caramelo andando pelas ruas, jumentos e cabras pastando na
// beira da cidade e galinhas ciscando nos quintais. Só aparecem e se mexem com a câmera perto.
import { Obra } from './voxel.mjs';

const semente = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function cachorro(cor) {
  const o = new Obra();
  o.caixa(0, .14, 0, .18, .16, .42, cor).caixa(0, .24, .24, .16, .15, .16, cor).caixa(0, .22, .33, .08, .06, .08, '#3A2A1E')
    .caixa(-.06, .33, .22, .05, .07, .04, cor).caixa(.06, .33, .22, .05, .07, .04, cor).caixa(0, .24, -.24, .04, .04, .16, cor);
  for (const [a, b] of [[-.06, .14], [.06, .14], [-.06, -.14], [.06, -.14]]) o.caixa(a, 0, b, .05, .14, .05, cor);
  return o.montar({ sombra: false });
}
function jumento() {
  const o = new Obra(), cor = '#8A7B6E';
  o.caixa(0, .42, 0, .32, .32, .8, cor).caixa(0, .66, .46, .2, .36, .2, cor).caixa(0, .72, .62, .16, .16, .26, '#6E6157')
    .caixa(-.06, .92, .5, .05, .2, .05, cor).caixa(.06, .92, .5, .05, .2, .05, cor).caixa(0, .6, .3, .06, .12, .3, '#3A332D');
  for (const [a, b] of [[-.1, .28], [.1, .28], [-.1, -.28], [.1, -.28]]) o.caixa(a, 0, b, .08, .42, .08, '#6E6157');
  return o.montar({ sombra: true });
}
function cabra(cor) {
  const o = new Obra();
  o.caixa(0, .26, 0, .22, .2, .46, cor).caixa(0, .42, .26, .14, .16, .16, cor).caixa(-.05, .52, .24, .03, .1, .03, '#5A4A3A').caixa(.05, .52, .24, .03, .1, .03, '#5A4A3A')
    .caixa(0, .34, .34, .05, .08, .03, '#E9E1CF');
  for (const [a, b] of [[-.07, .15], [.07, .15], [-.07, -.15], [.07, -.15]]) o.caixa(a, 0, b, .05, .26, .05, '#4A3E33');
  return o.montar({ sombra: false });
}
function galinha(cor) {
  const o = new Obra();
  o.caixa(0, .08, 0, .12, .12, .16, cor).caixa(0, .18, .08, .07, .08, .07, cor).caixa(0, .2, .13, .03, .03, .04, '#E2A11B').caixa(0, .25, .08, .03, .04, .05, '#D93D42');
  o.caixa(-.02, 0, 0, .02, .08, .02, '#E2A11B').caixa(.02, 0, 0, .02, .08, .02, '#E2A11B');
  return o.montar({ sombra: false });
}

export function construirAnimais(motor, irece, dados) {
  const cx = dados.w / 2, cz = dados.h / 2;
  const animais = [];
  // Trechos de rua dentro do recorte (cachorros andam neles, ida e volta).
  const trechos = [];
  for (const r of dados.ruas) {
    if (r.l > 2.8) continue; // nas avenidas largas não
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const a = { x: r.p[i] - cx, z: r.p[i + 1] - cz }, b = { x: r.p[i + 2] - cx, z: r.p[i + 3] - cz };
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      if (L > 6 && irece.noRecorte(a.x, a.z, 8) && irece.noRecorte(b.x, b.z, 8)) trechos.push({ a, b, L });
    }
  }
  const CORES_CAO = ['#C98A4B', '#D9A066', '#8A5A35', '#EADBC8', '#3A2E26'];
  for (let k = 0; k < 34 && trechos.length; k++) {
    const t = trechos[Math.floor(semente(k + 1) * trechos.length)], g = cachorro(CORES_CAO[k % CORES_CAO.length]);
    motor.adicionar(g);
    animais.push({ g, tipo: 'cao', t, fase: semente(k + 9) * 10, vel: .5 + semente(k + 3) * .6, lado: semente(k + 5) < .5 ? -.9 : .9 });
  }
  // Pasto na beira da cidade: pontos do recorte que não são rua nem cidade.
  let n = 0;
  for (let k = 0; k < 400 && n < 26; k++) {
    const ang = semente(k * 3 + 1) * Math.PI * 2, raio = 70 + semente(k * 7 + 2) * 40;
    const x = 4 + Math.cos(ang) * raio, z = 18 + Math.sin(ang) * raio;
    if (!irece.noRecorte(x, z, 6) || irece.ehRua(x, z) || !irece.livreParaLote(x, z)) continue;
    const jeg = n % 4 === 0, g = jeg ? jumento() : cabra(['#EFE8DA', '#8A6B4E', '#2F2A26', '#C9B79C'][n % 4]);
    g.position.set(x, irece.alturaEm(x, z), z); g.rotation.y = semente(k) * 6.28; motor.adicionar(g);
    animais.push({ g, tipo: 'pasto', x, z, fase: semente(k + 4) * 6, raio: .8 + semente(k + 6) }); n++;
  }
  // Galinhas nos quintais perto do centro.
  n = 0;
  for (let k = 0; k < 600 && n < 30; k++) {
    const x = 4 + (semente(k * 5 + 3) - .5) * 160, z = 18 + (semente(k * 11 + 7) - .5) * 160;
    if (!irece.noRecorte(x, z, 10) || irece.ehRua(x, z) || !irece.livreParaLote(x, z)) continue;
    for (let q = 0; q < 3; q++) {
      const gx = x + (q - 1) * .3, gz = z + (q % 2) * .25, g = galinha(['#F4F1EA', '#B5462F', '#2B2F33'][q]);
      g.position.set(gx, irece.alturaEm(gx, gz), gz); g.rotation.y = semente(k + q) * 6.28; motor.adicionar(g);
      animais.push({ g, tipo: 'galinha', fase: semente(k + q * 3) * 6 });
    }
    n++;
  }
  let visiveis = true;
  motor.animar((t) => {
    const c = motor.camera.position, perto = c.y < 130;
    if (perto !== visiveis) { visiveis = perto; for (const a of animais) a.g.visible = perto; if (!perto) return true; }
    if (!perto) return false;
    let mexeu = false;
    for (const a of animais) {
      if (a.tipo === 'cao') {
        const s = ((t * a.vel + a.fase) % (a.t.L * 2)), f = s < a.t.L ? s / a.t.L : 2 - s / a.t.L, volta = s >= a.t.L;
        const dx = (a.t.b.x - a.t.a.x) / a.t.L, dz = (a.t.b.z - a.t.a.z) / a.t.L;
        const x = a.t.a.x + (a.t.b.x - a.t.a.x) * f - dz * a.lado, z = a.t.a.z + (a.t.b.z - a.t.a.z) * f + dx * a.lado;
        a.g.position.set(x, irece.alturaEm(x, z) + .08 + Math.abs(Math.sin(t * 9 + a.fase)) * .03, z);
        a.g.rotation.y = Math.atan2(dx, dz) + (volta ? Math.PI : 0);
      } else if (a.tipo === 'pasto') {
        a.g.rotation.y += Math.sin(t * .3 + a.fase) * .002;
        a.g.position.x = a.x + Math.sin(t * .05 + a.fase) * a.raio; a.g.position.z = a.z + Math.cos(t * .04 + a.fase) * a.raio;
      } else a.g.rotation.x = Math.max(0, Math.sin(t * 3 + a.fase)) * .5; // galinha ciscando
      mexeu = true;
    }
    return mexeu;
  });
  return { quantos: animais.length };
}
