import { criarFonteAgentes, apresentarAgente, referenciaDaPeca, ESTADOS_REAIS } from './atividade-agentes.mjs';
// Entrada do mundo voxel (empacotada com o three.js pelo build; carregada sob
// demanda por vybe-mundo.js). Monta Irecê, o Prédio da Vybe e os clientes.
import { criarMotor } from './motor.mjs';
import { relogioBahia, horarioDaCaptacao, priorizarCaptacoes, faseDaVan } from './captacoes.mjs';
import { construirIrece, CENTRO_RECORTE } from './irece.mjs';
import { construirPredio } from './predio.mjs';
import { criarClientes } from './clientes.mjs';
import { PLANTA, ESTADOS, ZONAS_DO_PREDIO } from './planta.mjs';
import { Obra } from './voxel.mjs';
import { MARCOS, construirMarcos } from './marcos.mjs';
import { construirAnimais } from './animais.mjs';
import * as Empresas from './empresas.mjs';
import LOCAIS from './locais.json' with { type: 'json' };

export { PLANTA, ESTADOS };
export { abrirAndar } from './sala.mjs';
export { avatarVoxel, lerFigura, iconeMovel, tipoDoMovel, desenharPreviaAvatar } from './avatar.mjs';
export { CATALOGO, pecaDaClasse } from './catalogo.mjs';

export async function iniciarMundo(canvas, { dadosUrl, crmUrl, reduzirMovimento = false } = {}) {
  // Não alocar WebGL enquanto os dados ainda podem falhar ou ficar aguardando rede.
  const [dados] = await Promise.all([fetch(dadosUrl, { signal: AbortSignal.timeout(20000) }).then((r) => {
    if (!r.ok) throw new Error('Não foi possível carregar o mapa de Irecê.');
    return r.json();
  }), Empresas.carregarEmpresas(crmUrl)]);
  const motor = criarMotor(canvas, { reduzirMovimento });
  try {
  // A Vybe no endereço dela (mundo/locais.json: x/z ou rua). Sem local, perto do centro de Irecê.
  const vybeLocal = LOCAIS?.vybe && Number.isFinite(LOCAIS.vybe.x) ? LOCAIS.vybe : null;
  const reservas = { predio: { x: vybeLocal?.x ?? 0, z: vybeLocal?.z ?? 0, r: vybeLocal ? 6 : 9, exato: !!vybeLocal }, lotes: { quantos: 40, raioMin: 14, raioMax: 100, r: 3, folga: 0 }, marcos: MARCOS };
  if (LOCAIS?.vybe?.rua && !vybeLocal) {
    // Rua da Vybe: primeiro acha a rua (sem montar a cidade), depois reserva o terreno perto dela.
    const r = construirIrece.pontoSemMontar?.(dados, LOCAIS.vybe.rua); if (r) { reservas.predio.x = r.x; reservas.predio.z = r.z; }
  }
  const irece = construirIrece(motor, dados, { reservas, comercios: Empresas.EMPRESAS.filter((e) => e.cnpj && (e.onde === 'rua' || e.onde === 'numero')) });
  const base = reservas.predio.achado || { x: 0, z: 0 };
  const predio = construirPredio(motor, { x: base.x, z: base.z, y: irece.alturaEm(base.x, base.z) + .05 });
  const clientes = criarClientes(motor, irece, reservas.lotes.achados || []);
  construirMarcos(motor, irece, motor.THREE);
  construirAnimais(motor, irece, dados);
  Empresas.construirEmpresas(motor, irece, motor.THREE);
  let posicoes = [];

  // Lugares reais (igrejas, praças, escolas) aparecem de perto.
  for (const l of irece.lugares) {
    if (!/igreja|par[oó]quia|catedral|pra[cç]a|mercado|hospital|est[aá]dio|escola|col[eé]gio/i.test(l.nome)) continue;
    motor.rotulo({ pos: new motor.THREE.Vector3(l.x, irece.alturaEm(l.x, l.z) + 2, l.z), classe: 'rotulo-lugar', html: l.nome.replace(/[<>&]/g, ''), distMax: 160, prioridade: -1 });
  }

  const VISTAS = {
    // A cidade abre com a Vybe no meio da tela.
    cidade: { alvo: { x: base.x, z: base.z }, dist: 290, incl: .86, giro: -.75 },
    predio: { alvo: { x: base.x, y: 15, z: base.z }, dist: 175, incl: .42, giro: -.6 },
  };
  motor.voar(VISTAS.cidade, 1);

  // ---------- Passarinhos: bandos em V circulando sobre a cidade (uma malha só, leve) ----------
  {
    const T3 = motor.THREE, BANDOS = 5, POR = 7;
    const asa = new T3.InstancedMesh(new T3.BoxGeometry(.32, .03, .09), new T3.MeshBasicMaterial({ color: '#4A4F55' }), BANDOS * POR * 2);
    asa.frustumCulled = false; motor.adicionar(asa);
    const bandos = Array.from({ length: BANDOS }, (_, k) => ({ cx: CENTRO_RECORTE.x + (k - 2) * 70, cz: CENTRO_RECORTE.z + ((k * 37) % 5 - 2) * 55, r: 60 + k * 18, alt: 34 + k * 5, vel: .05 + k * .012, fase: k * 1.7 }));
    const m4 = new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Euler(), p = new T3.Vector3(), sc = new T3.Vector3();
    motor.animar((t) => {
      let n = 0;
      for (const b of bandos) {
        const a0 = t * b.vel + b.fase, hx = b.cx + Math.cos(a0) * b.r, hz = b.cz + Math.sin(a0) * b.r, dir = a0 + Math.PI / 2;
        for (let i = 0; i < POR; i++) {
          const fila = Math.ceil(i / 2), lado = i === 0 ? 0 : (i % 2 ? 1 : -1);
          const bx = hx - Math.cos(dir) * fila * .7 + Math.cos(dir + Math.PI / 2) * lado * fila * .5;
          const bz = hz - Math.sin(dir) * fila * .7 + Math.sin(dir + Math.PI / 2) * lado * fila * .5;
          const bate = Math.sin(t * 9 + i * .7 + b.fase) * .55;
          for (const s2 of [-1, 1]) {
            e.set(0, -dir, s2 * bate); q.setFromEuler(e);
            p.set(bx + Math.cos(dir + Math.PI / 2) * s2 * .1, b.alt + Math.sin(t * .8 + i) * .4, bz + Math.sin(dir + Math.PI / 2) * s2 * .1);
            sc.set(.55, 1, 1); m4.compose(p, q, sc); asa.setMatrixAt(n++, m4);
          }
        }
      }
      asa.instanceMatrix.needsUpdate = true; asa.computeBoundingSphere();
      return motor.emVista(asa);
    });
  }

  // ---------- Vans da Vybe: as captações do dia, pelas ruas, da agência até o cliente ----------
  const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let vans = [], captacoes = [], selecaoVans = '';
  function novaVan() {
    const o = new Obra();
    o.caixa(0, .18, 0, 1.1, .55, 2.2, '#FF7A2F').caixa(0, .73, -.15, 1.06, .42, 1.6, '#FF7A2F').caixa(0, .73, .72, 1, .34, .3, '#BFD9E2');
    for (const s of [-1, 1]) o.caixa(s * .54, .78, -.2, .03, .26, 1.1, '#BFD9E2');
    o.letreiro('VYBE', { x: 0, y: .45, z: 1.12, px: .05, cor: '#FFFFFF', aceso: true });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) o.caixa(a * .5, 0, b * .7, .2, .36, .36, '#1F1D1A');
    o.luz(-.35, .3, 1.11, .18, .1, .02, '#FFF6D8').luz(.35, .3, 1.11, .18, .1, .02, '#FFF6D8');
    const g = o.montar(); g.scale.setScalar(.9); motor.adicionar(g); return g;
  }
  // A van segue o relógio da agenda: 30 min antes sai da agência, durante a captação fica parada na
  // porta do cliente ("gravando"), depois volta. Sem horário marcado, faz ida e volta contínua.
  function definirCaptacoes(lista) {
    captacoes = lista; atualizarVans();
  }
  function atualizarVans() {
    const agora = relogioBahia();
    const lista = priorizarCaptacoes(captacoes, agora).filter((cap) => posicoes.some((p) => norm(p.nome) === norm(cap.cliente) || norm(p.nome).length > 3 && norm(cap.cliente).includes(norm(p.nome)))).slice(0, 6);
    const chave = JSON.stringify([agora.dia, lista]);
    if (chave === selecaoVans) return false;
    selecaoVans = chave;
    for (const v of vans) { motor.cena.remove(v.g); motor.removerRotulo(v.r); }
    vans = [];
    lista.forEach((cap, n) => {
      const destino = posicoes.find((p) => norm(p.nome) === norm(cap.cliente)) || posicoes.find((p) => norm(cap.cliente).includes(norm(p.nome)) && norm(p.nome).length > 3);
      if (!destino) return;
      const rota = irece.caminho(base.x + 8 + n * 1.6, base.z + 8, destino.x, destino.z);
      if (!rota || rota.length < 2) return;
      const comp = [0]; for (let i = 1; i < rota.length; i++) comp.push(comp[i - 1] + Math.hypot(rota[i].x - rota[i - 1].x, rota[i].z - rota[i - 1].z));
      const g = novaVan();
      const nome = String(cap.cliente).replace(/[<>&]/g, ''), hora = cap.inicio ? cap.inicio.replace(':00', 'h').replace(':', 'h') : '';
      const r = motor.rotulo({ pos: new motor.THREE.Vector3(), classe: 'rotulo-van', html: `<b>Captação</b> ${nome}${hora ? ' · ' + hora : ''}`, distMax: 420, prioridade: 4 });
      const { ini, fim } = horarioDaCaptacao(cap);
      vans.push({ g, r, rota, comp, total: comp[comp.length - 1], fase: Math.random() * 10, ini, fim, nome, hora, fase0: '', dia: cap.dia || agora.dia });
    });
  }
  motor.animar((t) => {
    let mudou = atualizarVans();
    const agora = relogioBahia();
    for (const v of vans) {
      const { d, volta, fase } = faseDaVan(v, t, agora);
      const deslocou = Math.abs(d - (v.dAnterior ?? -1)) > .0001; v.dAnterior = d;
      mudou = mudou || ((deslocou || fase !== v.fase0) && motor.emVista(v.g));
      if (fase !== v.fase0) {
        v.fase0 = fase;
        const txt = { espera: `sai às ${v.hora}`, indo: 'a caminho', gravando: 'gravando agora', voltando: 'voltando', feita: 'feita' }[fase];
        v.r.el.innerHTML = `<b>Captação</b> ${v.nome}${txt ? ' · ' + txt : v.hora ? ' · ' + v.hora : ''}`;
        v.r.el.classList.toggle('gravando', fase === 'gravando');
      }
      let i = 1; while (i < v.comp.length - 1 && v.comp[i] < d) i++;
      const a = v.rota[i - 1], b = v.rota[i], k = Math.min(1, Math.max(0, (d - v.comp[i - 1]) / Math.max(.001, v.comp[i] - v.comp[i - 1])));
      const x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k, y = a.y + (b.y - a.y) * k;
      v.g.position.set(x, y + .02, z);
      if (Math.hypot(b.x - a.x, b.z - a.z) > .01) v.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + (volta ? Math.PI : 0);
      v.r.pos.set(x, y + 2.4, z);
    }
    return mudou;
  });

  // ---------- Cérebro: o VYBES ligado a cada cliente (cor = situação; pulsos = peças em aberto) ----------
  const T = motor.THREE;
  let cerebro = null;
  // ---------- Cérebro arquitetado: o VYBES no centro, as camadas de memória em volta e as sinapses ----------
  // Núcleo (VYBES, um só, Qwen local) -> 5 camadas de memória -> agentes nas mesas do prédio e clientes na cidade.
  // Cada cliente recebe um fio por origem do que o VYBES sabe dele (central, painel, referência, nota), com a
  // espessura da quantidade; os pulsos correm na cor da situação. Nada é inventado: os números vêm do painel.
  const ORIGENS = { central: '#8E7CFF', operacao: '#FF7A2F', referencia: '#3B9EFF', navegador: '#9AA3A8' };
  const CAMADAS = [
    { id: 'identidade', nome: 'Identidade', cor: '#FF7A2F' }, { id: 'clientes', nome: 'Memória dos clientes', cor: '#8E7CFF' },
    { id: 'conversas', nome: 'Conversas', cor: '#18A957' }, { id: 'trabalho', nome: 'Trabalho do painel', cor: '#3B9EFF' },
    { id: 'agentes', nome: 'Agentes dos andares', cor: '#D6409F' },
  ];
  function curvaEntre(a, b, alto = .3) { const m = a.clone().lerp(b, .5); m.y += a.distanceTo(b) * alto + 3; return new T.QuadraticBezierCurve3(a, m, b); }
  function mostrarCerebro(ligar, lista = [], { camadas = {}, agentes = [], aoNo = null } = {}) {
    motor.invalidar();
    if (cerebro) { motor.cena.remove(cerebro.g); cerebro.g.traverse((o) => { if (o.userData?.alvo) motor.naoClicavel(o); o.geometry?.dispose?.(); o.material?.dispose?.(); }); cerebro.rotulos.forEach((r) => motor.removerRotulo(r)); cerebro = null; }
    if (!ligar) return;
    const g = new T.Group(), pulsos = [], rotulos = [];
    const C = new T.Vector3(base.x, 46, base.z);
    const mat = (cor, op = 1) => new T.MeshBasicMaterial({ color: cor, toneMapped: false, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
    // Núcleo: dois hemisférios de voxels (o cérebro do VYBES), com sulcos.
    const nucleo = new T.Group(), cubo = new T.BoxGeometry(.9, .9, .9);
    const mN = new T.MeshStandardMaterial({ color: '#B9B0FF', emissive: '#6A5CFF', emissiveIntensity: .55, roughness: .4 });
    const mL = new T.MeshStandardMaterial({ color: '#FFD3B0', emissive: '#FF7A2F', emissiveIntensity: .45, roughness: .4 });
    const pts = [];
    for (let xx = -5; xx <= 5; xx++) for (let yy = -3; yy <= 4; yy++) for (let zz = -4; zz <= 4; zz++) {
      const e = (xx / 5.2) ** 2 + (yy / 3.6) ** 2 + (zz / 4.4) ** 2; if (e > 1 || e < .62) continue;
      if (xx === 0 && yy > -2) continue; // fissura entre os hemisférios
      if (Math.sin(xx * 1.7 + zz * 1.3 + yy * 2.1) > .72) continue; // sulcos
      pts.push([xx, yy, zz]);
    }
    const inst = new T.InstancedMesh(cubo, mN, pts.length), inst2 = new T.InstancedMesh(cubo, mL, pts.length);
    const dm = new T.Object3D(); let a1 = 0, a2 = 0;
    for (const [xx, yy, zz] of pts) { dm.position.set(xx, yy, zz); dm.updateMatrix(); if (((xx * 7 + yy * 3 + zz * 5) % 9 + 9) % 9 === 0) inst2.setMatrixAt(a2++, dm.matrix); else inst.setMatrixAt(a1++, dm.matrix); }
    inst.count = a1; inst2.count = a2; nucleo.add(inst, inst2); nucleo.position.copy(C); nucleo.scale.setScalar(1.35); g.add(nucleo);
    const alvoN = new T.Mesh(new T.SphereGeometry(5, 8, 8), new T.MeshBasicMaterial({ visible: false })); alvoN.position.copy(C); alvoN.userData.alvo = { tipo: 'cerebro', no: 'nucleo' }; g.add(alvoN); motor.clicavel(alvoN);
    rotulos.push(motor.rotulo({ pos: C.clone().add(new T.Vector3(0, 8.5, 0)), classe: 'rotulo-cerebro nucleo', html: '<b>VYBES</b><small>orquestra tudo · Qwen local</small>', distMax: 900, prioridade: 6, aoClicar: () => aoNo?.('nucleo') }));
    // Camadas de memória em anel.
    const posCam = {};
    CAMADAS.forEach((cm, k) => {
      const ang = k / CAMADAS.length * Math.PI * 2 - Math.PI / 2, P = C.clone().add(new T.Vector3(Math.cos(ang) * 21, -2 + (k % 2) * 3, Math.sin(ang) * 21));
      posCam[cm.id] = P;
      const no = new T.Mesh(new T.BoxGeometry(2.4, 2.4, 2.4), mat(cm.cor)); no.position.copy(P); no.userData.alvo = { tipo: 'cerebro', no: cm.id }; g.add(no); motor.clicavel(no);
      const casca = new T.Mesh(new T.BoxGeometry(3.4, 3.4, 3.4), mat(cm.cor, .18)); casca.position.copy(P); g.add(casca);
      const cv = curvaEntre(C, P, .12);
      g.add(new T.Mesh(new T.TubeGeometry(cv, 24, .16, 5, false), mat(cm.cor, .55)));
      for (let q = 0; q < 2; q++) { const m = new T.Mesh(new T.BoxGeometry(.5, .5, .5), mat('#FFFFFF')); g.add(m); pulsos.push({ m, curva: cv, fase: q / 2, vel: .35 }); }
      const v = camadas[cm.id];
      rotulos.push(motor.rotulo({ pos: P.clone().add(new T.Vector3(0, 2.8, 0)), classe: 'rotulo-cerebro', html: `<i style="--c:${cm.cor}"></i><b>${cm.nome}</b>${v ? `<small>${String(v).replace(/[<>&]/g, '')}</small>` : ''}`, distMax: 700, prioridade: 5, aoClicar: () => aoNo?.(cm.id) }));
    });
    // Sinapses dos agentes: da camada Agentes até a mesa de cada um no prédio.
    for (const ag of agentes) {
      const pos = predio.posDoSetor?.(ag.setor); if (!pos) continue;
      const fim = new T.Vector3(pos.x, pos.y, pos.z), cv = curvaEntre(posCam.agentes, fim, .08);
      const ativo = ag.estado === 'executando' && ag.conectado;
      g.add(new T.Mesh(new T.TubeGeometry(cv, 32, ativo ? .09 : .05, 4, false), mat('#D6409F', ativo ? .5 : .18)));
      if (ativo) { const m = new T.Mesh(new T.BoxGeometry(.35, .35, .35), mat('#FFE3F3')); g.add(m); pulsos.push({ m, curva: cv, fase: Math.random(), vel: .45 }); }
    }
    // Sinapses dos clientes: um fio por origem do conhecimento.
    for (const cli of lista) {
      const p = posicoes.find((x) => x.nome === cli.nome); if (!p) continue;
      const fim = new T.Vector3(p.x, irece.alturaEm(p.x, p.z) + 6, p.z);
      const org = Object.entries(cli.origens || {}).filter(([, v]) => v > 0);
      if (!org.length) org.push(['operacao', Math.max(1, cli.total || 1)]);
      org.forEach(([k, v], idx) => {
        const desvio = (idx - (org.length - 1) / 2) * .9;
        const ini = posCam.clientes.clone().add(new T.Vector3(desvio, 0, 0)), fimK = fim.clone().add(new T.Vector3(desvio * .5, 0, 0));
        const cv = curvaEntre(ini, fimK, .22);
        g.add(new T.Mesh(new T.TubeGeometry(cv, 40, .06 + Math.min(.26, v * .02), 5, false), mat(ORIGENS[k] || '#9AA3A8', .55)));
      });
      const cvP = curvaEntre(posCam.clientes, fim, .22);
      const np = Math.max(1, Math.min(5, Math.round((cli.total || 0) / 5)));
      for (let q = 0; q < np; q++) { const m = new T.Mesh(new T.BoxGeometry(.5, .5, .5), mat(cli.cor || '#FFFFFF')); g.add(m); pulsos.push({ m, curva: cvP, fase: q / np, vel: cli.situacao === 'atrasada' ? .5 : .22 }); }
      const no = new T.Mesh(new T.BoxGeometry(1.3, 1.3, 1.3), mat(cli.cor || '#8E7CFF')); no.position.copy(fim); no.userData.alvo = { tipo: 'cliente', nome: cli.nome }; g.add(no); motor.clicavel(no);
    }
    motor.adicionar(g);
    cerebro = { g, pulsos, nucleo, rotulos, lista, opcoes:{camadas,agentes,aoNo} };
  }
  motor.animar((t) => {
    if (!cerebro) return;
    for (const p of cerebro.pulsos) p.m.position.copy(p.curva.getPoint((t * p.vel + p.fase) % 1));
    cerebro.nucleo.rotation.y = t * .18;
    cerebro.nucleo.scale.setScalar(1.35 + Math.sin(t * 1.8) * .04);
    return motor.emVista(cerebro.g);
  });

  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function naBase(nome, inteiro = false) {
    const n = semAcento(nome); if (n.length < 3) return null;
    const junto = n.replace(/ /g, ''), sigla = semAcento(String(nome).split(/\s+-\s+/)[0]);
    const cand = Empresas.EMPRESAS.filter((e) => e.cnpj && e.x != null).filter((e) => { const f = semAcento(e.nome), r = semAcento(e.razao), fj = f.replace(/ /g, '');
      return f === n || f.startsWith(n + ' ') || r.startsWith(n + ' ') || (n.length >= 6 && (f.includes(n) || r.includes(n)))
        || (junto.length >= 6 && (fj === junto || fj.startsWith(junto))) || (sigla !== n && sigla.length >= 3 && (f === sigla || f.startsWith(sigla + ' '))); });
    if (!cand.length) return null;
    cand.sort((a, b) => (a.onde === 'numero' ? 0 : a.onde === 'rua' ? 1 : 2) - (b.onde === 'numero' ? 0 : b.onde === 'rua' ? 1 : 2) || Number(b.matriz) - Number(a.matriz));
    const e = cand[0];
    return inteiro ? e : { x: e.x, z: e.z };
  }
  let ultimoComPonto = [];
  // ---------- Camada de prospecção: empresas (não clientes) como pinos pequenos na cor da etapa do CRM ----------
  let camadaPros = null;
  function mostrarEmpresasNoMapa(lista = []) {
    if (camadaPros) { motor.cena.remove(camadaPros.g); camadaPros.g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); camadaPros.rotulos.forEach((r) => motor.removerRotulo(r)); camadaPros = null; }
    if (!lista.length) { motor.invalidar(); return 0; }
    const T3 = motor.THREE, g = new T3.Group(), rotulos = [];
    const haste = new T3.InstancedMesh(new T3.BoxGeometry(.07, 1, .07), new T3.MeshBasicMaterial({ color: '#5A6268' }), lista.length);
    const cabeca = new T3.InstancedMesh(new T3.BoxGeometry(.42, .42, .42), new T3.MeshBasicMaterial({ toneMapped: false }), lista.length);
    const m4 = new T3.Matrix4(), cor = new T3.Color();
    lista.forEach((e, k) => {
      const y = irece.alturaEm(e.x, e.z);
      m4.makeScale(1, 1.6, 1).setPosition(e.x, y + .8, e.z); haste.setMatrixAt(k, m4);
      m4.makeTranslation(e.x, y + 1.75, e.z); cabeca.setMatrixAt(k, m4); cabeca.setColorAt(k, cor.set(e.cor));
      if (e.rotulo) rotulos.push(motor.rotulo({ pos: new T3.Vector3(e.x, y + 2.3, e.z), classe: 'rotulo-prospect', html: `<i style="--c:${e.cor}"></i>${String(e.nome).replace(/[<>&]/g, '')}${e.etapa ? `<small>${String(e.etapa).replace(/[<>&]/g, '')}</small>` : ''}`, distMax: e.distMax || 70, prioridade: e.prioridade || -3, aoClicar: () => e.aoClicar?.() }));
    });
    haste.computeBoundingSphere(); cabeca.computeBoundingSphere(); if (cabeca.instanceColor) cabeca.instanceColor.needsUpdate = true;
    g.add(haste, cabeca); motor.adicionar(g);
    camadaPros = { g, rotulos };
    return lista.length;
  }
  return {
    mostrarEmpresasNoMapa,
    situacaoDosAndares: (m) => predio.situacaoDosAndares?.(m),
    noRecorte: (x, z) => irece.noRecorte(x, z),
    get empresas() { return Empresas.EMPRESAS; }, get fonteEmpresas() { return Empresas.FONTE_EMPRESAS; }, tipoLegivel: Empresas.TIPO_LEGIVEL, agencia: { x: base.x, z: base.z },
    focarPonto(x, z, dist = 80, incl = .7, giro) { predio.abrir(false); motor.voar({ alvo: { x, y: irece.alturaEm(x, z), z }, dist, incl, ...(giro == null ? {} : { giro }) }); },
    cerebro(ligar, lista, opcoes) { if (ligar) { predio.abrir(false); predio.focar(null); } mostrarCerebro(ligar, lista, opcoes); if (ligar) motor.voar({ alvo: { x: base.x, y: 40, z: base.z }, dist: 120, incl: .32, giro: -.75 }); },
    criarFonteAgentes, apresentarAgente, referenciaDaPeca, estadosReais: ESTADOS_REAIS, atividadeAgentes: predio.atividadeAgentes,
    atualizarAgentesCerebro(agentes,camadas) { if(cerebro) mostrarCerebro(true,cerebro.lista,{...cerebro.opcoes,agentes,camadas}); },
    agentesDoPredio: () => predio.agentes?.() || [],
    definirCaptacoes,
    diaNaBahia: () => relogioBahia().dia,
    destruir: motor.destruir,
    planta: PLANTA, estados: ESTADOS, zonasDoPredio: ZONAS_DO_PREDIO, presenca: predio.presenca,
    aoClicar: motor.aoClicar, aoPassar: motor.aoPassar,
    zoom: motor.zoom, girar90: motor.girar90, areaLivre: motor.areaLivre, pausar: motor.pausar,
    verCidade() { predio.abrir(false); motor.voar({ ...VISTAS.cidade, alvo: { ...VISTAS.cidade.alvo, y: 0 } }); },
    verPredio() { predio.abrir(true); predio.focar(null); motor.voar(VISTAS.predio); },
    focarAndar(nivel) {
      predio.abrir(true); predio.focar(nivel);
      if (nivel === null) { motor.voar(VISTAS.predio); return; }
      motor.voar({ alvo: { x: base.x, y: nivel * 4.2 + .6, z: base.z - 1 }, dist: 64, incl: 1.0, giro: -.45 });
    },
    focarCliente(nome) {
      const p = posicoes.find((c) => c.nome === nome);
      if (p) { predio.abrir(false); motor.voar({ alvo: { x: p.x, y: irece.alturaEm(p.x, p.z) + 1.5, z: p.z }, dist: 95, incl: .62, giro: Math.atan2(-p.x, -p.z) + Math.PI + .5 }); }
    },
    // Conferência: onde cada cliente deveria estar (ponto real) e onde a sede ficou.
    desempenho: () => motor.desempenho(),
    orcamento: () => { const lista = []; motor.cena.traverse((o) => { if (!o.isMesh || !o.visible) return; let vis = true, p = o.parent; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; } if (!vis) return; const g = o.geometry; const tri = ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1); lista.push({ tipo: o.isInstancedMesh ? 'inst' : 'mesh', tri: Math.round(tri), mat: o.material?.type, n: o.isInstancedMesh ? o.count : 1, sombra: o.castShadow }); }); lista.sort((a, b) => b.tri - a.tri); return { total: lista.reduce((n, x) => n + x.tri, 0), top: lista.slice(0, 12) }; },
    conferirClientes: () => ultimoComPonto.map((c) => { const p = posicoes.find((x) => x.nome === c.nome); return { nome: c.nome, ponto: c.ponto, sede: p ? { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 } : null, dist: c.ponto && p ? Math.round(Math.hypot(c.ponto.x - p.x, c.ponto.z - p.z) * 10) : null }; }),
    // O cliente na base de CNPJ (nome fantasia ou razão social): é o endereço oficial dele.
    acharNaBase: (nome) => naBase(nome, true),
    definirClientes(lista, opcoes) {
      // Cada cliente no lugar dele: local fixo (locais.json) > endereço do cadastro (rua do mapa) > lote perto da agência.
      const fixos = LOCAIS?.clientes || {};
      const comPonto = lista.map((c) => {
        const f = fixos[c.nome], cadastro = naBase(c.nome, true);
        const confirmado = f && Number.isFinite(f.x) && Number.isFinite(f.z) && /google maps/i.test(f.fonte || '') && !f.conferir;
        const pt = f && Number.isFinite(f.x) ? f : f?.rua ? irece.pontoDoEndereco(f.rua) : (cadastro || irece.pontoDoEndereco(c.endereco));
        const definida = f && Number.isFinite(f.x) && Number.isFinite(f.z) && !/google maps/i.test(f.fonte || '');
        const precisao = confirmado ? 'confirmada' : definida ? 'definida' : cadastro && pt === cadastro ? cadastro.onde : pt ? 'rua' : 'sem';
        return { ...c, ponto: pt || null, precisao };
      });
      posicoes = clientes.definir(comPonto, opcoes);
      ultimoComPonto = comPonto;
    },
    alertaVybes: predio.alerta,
    predioAberto: predio.aberto,
    estado: motor.estado, projetar: motor.projetar,
  };
  } catch (erro) { motor.destruir(); throw erro; }
}
