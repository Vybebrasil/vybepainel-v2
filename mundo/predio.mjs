import { apresentarAgente, ESTADOS_REAIS } from './atividade-agentes.mjs';
// O Prédio da Vybe em voxel, no estilo do Centro comercial (Paulo, 08/11/2026: maquete "fofa", blocos grandes,
// quina escurecida, cores vivas mas suaves). Andares só de agentes (1º ao 5º: uma mesa por agente e as outras
// livres para os que entrarem), andares do time humano (o time todo junto, o estúdio e o terraço) e a recepção.
// Fachada: frente e lado direito de vidro com caixilho branco grosso; fundo e esquerda em blocos creme com
// janelões. Ao focar, os andares de cima saem e o andar fica à vista. No topo, o V do VYBES.
import * as THREE from 'three';
import { PLANTA, zonasDoAndar, MESAS_POR_ANDAR, nomeDoNivel } from './planta.mjs';
import { blocos, ruido } from './irece.mjs';
import { Obra } from './voxel.mjs';
import { desenharBoneco, figuraDaPessoa, figuraDoAgente } from './avatar.mjs';

const LADO = 11;     // largura do prédio (o prédio é o herói da maquete)
const PE = 2.3;      // pé-direito de cada andar
const ABRE = 1.9;    // quanto cada andar sobe na vista aberta
const TOPO = PLANTA.length; // o terraço é o último andar; o V do VYBES flutua acima dele
const Y0 = .25;      // piso de cada andar (em cima da laje)
const ESCALA_BONECO = .6;
const claro = (c, t) => '#' + new THREE.Color(c).lerp(new THREE.Color('#FFFFFF'), t).getHexString();
const escuro = (c, t) => '#' + new THREE.Color(c).lerp(new THREE.Color('#1F1D1A'), t).getHexString();

// Mesas dos andares de agentes: 3 colunas × 2 fileiras, cada agente de frente para a fachada de vidro.
export function mesasDoAndar(n = MESAS_POR_ANDAR) {
  const cols = 3, linhas = Math.ceil(n / cols), w = (LADO - .8) / cols, d = Math.min(4.4, (LADO - 2.2) / linhas);
  return Array.from({ length: n }, (_, i) => ({ x: -LADO / 2 + .4 + w * (i % cols + .5), z: -LADO / 2 + 1 + d * (Math.floor(i / cols) + .5), w, d }));
}

export function construirPredio(motor, { x, z, y }) {
  const raiz = new THREE.Group();
  raiz.position.set(x, y, z);
  motor.adicionar(raiz);

  const vidro = new THREE.MeshStandardMaterial({ color: '#CFE8F0', transparent: true, opacity: .2, roughness: .08, metalness: .1, depthWrite: false });
  const andares = [];
  const salas = new Map(); // setorId → { luzes, tela, antena, estado, figura }
  const animaveis = [];
  const agentesRot = []; // { r, andarIdx, setor, sx, sz } — nome do agente sobre a mesa, visível no andar em foco
  const centros = new Map(); // zona → { g, x, z, w } (salas da equipe)

  // Calçada / praça da Vybe em volta.
  raiz.add(blocos([
    { x: 0, y: -.05, z: 0, w: LADO + 6, h: .12, d: LADO + 6, cor: '#EFE7D6' },
    { x: 0, y: .05, z: 0, w: LADO + 1.2, h: .1, d: LADO + 1.2, cor: '#D9D2C2' },
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: a * (LADO / 2 + 2), y: 0, z: b * (LADO / 2 + 2), w: 1.2, h: .5, d: 1.2, cor: '#C9C1AE' })),
  ]));
  // Praça da Vybe: canteiros de grama, bancos, bicicletário, o totem com a marca e as quatro árvores em cachos.
  {
    const o = new Obra(), M = LADO / 2, F = LADO / 2 + 2.6;
    for (const [px, pz, w, d] of [[-F + .6, 0, 1.2, LADO - 1], [0, -F + .6, LADO - 1, 1.2]]) { o.caixa(px, .02, pz, w, .14, d, '#CFC6B2').caixa(px, .16, pz, w - .2, .06, d - .2, '#7FB069'); }
    for (const k of [-3, 0, 3]) { o.caixa(-F + .6, .2, k, .5, .5 + Math.abs(k) * .06, .5, '#5FA34E'); o.caixa(k, .2, -F + .6, .5, .45, .5, '#4C8F3F'); }
    for (const k of [-3.2, 3.2]) o.caixa(k, .05, M + 2.1, 1.6, .28, .45, '#C99A6B').caixa(k, .05, M + 2.1, .12, .22, .4, '#5A6268');
    for (let k = 0; k < 4; k++) o.caixa(M + 2.2, .05, -2 + k * .55, .06, .5, .4, '#5A6268');
    o.caixa(-M + 1.3, .05, M + 2.6, .6, 2.4, .6, '#FFFFFF').luz(-M + 1.3, 1.3, M + 2.91, .4, 1, .02, '#FF7A2F');
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) o.arvore(a * (LADO / 2 + 2), .45, b * (LADO / 2 + 2), { s: 1.25, cor: a * b > 0 ? '#5FA34E' : '#4F9A4E', fruta: a > 0 && b < 0 ? '#F2C230' : null });
    raiz.add(o.montar());
  }

  for (const andar of PLANTA) {
    const g = new THREE.Group();
    g.userData.nivel = andar.nivel;
    g.position.y = andar.nivel * PE + .15;
    raiz.add(g);
    const terraco = andar.id === 'terraco', terreo = andar.id === 'terreo', andarIdx = andares.length;
    const o = new Obra(), pecas = [];
    laje(o, andar, terraco);
    if (terraco) { terracoMoveis(pecas); guardaCorpo(o); } else fachada(o, g, andar, terreo);
    const pendentes = []; // { sala, tela, antena } — índices nas luzes, resolvidos depois de montar
    if (andar.tipo === 'agentes') mesasDosAgentes(o, g, andar, andarIdx, pendentes);
    else if (terreo) recepcao(o, g, andar, andarIdx, pendentes);
    salasDaEquipe(o, g, andar, terreo, terraco);
    for (const b of pecas) o.caixa(b.x, b.y, b.z, b.w, b.h, b.d, b.cor);
    const malha = o.montar(), luzes = malha.children.find((m) => m.material?.type === 'MeshBasicMaterial' && !m.userData.sombraDeContato) || null;
    g.add(malha);
    for (const p of pendentes) Object.assign(p.sala, { luzes, tela: p.tela, antena: p.antena });
    if (!terraco) {
      const parede = new THREE.Mesh(new THREE.BoxGeometry(LADO - .05, PE - .25, LADO - .05), vidro);
      parede.position.y = Y0 + (PE - .25) / 2; parede.renderOrder = 2;
      g.add(parede);
    }
    const r = motor.rotulo({ pos: new THREE.Vector3(x + LADO / 2 + .4, y + andar.nivel * PE + 1.2, z), classe: 'rotulo-andar escondido',
      html: `<i style="--c:${andar.cor}"></i><b>${nomeDoNivel(andar, true)}</b><span>${andar.nome.replace(/^Terraço · /, '')}</span>`, distMax: 260, prioridade: 5 - andar.nivel / 10 });
    r.forcarEscondido = true; r.el.hidden = true;
    // Faixa de luz da situação do andar (verde em dia, amarelo pede aprovação, vermelho atraso/falha).
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(LADO + .56, .07, LADO + .56), new THREE.MeshBasicMaterial({ color: '#18A957', toneMapped: false }));
    faixa.position.y = .02; g.add(faixa);
    // Prédio vivo: a faixa é o andar inteiro no hover (motivo da cor numa frase, vybe-mundo.js).
    faixa.userData.alvo = { tipo: 'andar', andar: andar.id }; motor.clicavel(faixa);
    andares.push({ andar, g, rotulo: r, faixa });
  }

  // Laje grossa e clara, com a faixa na cor do setor (de fora se lê o andar) e a borda branca em cima.
  function laje(o, andar, terraco) {
    o.caixa(0, -.12, 0, LADO + .5, .2, LADO + .5, '#F4EFE6');
    o.caixa(0, .06, 0, LADO + .56, .12, LADO + .56, claro(andar.cor, .12));
    o.caixa(0, .18, 0, LADO + .5, .045, LADO + .5, '#FFFFFF'); // topo em .225: abaixo do piso (.23), sem brigar com ele
    o.caixa(0, Y0 - .02, 0, LADO - .2, .02, LADO - .2, terraco ? '#C99A6B' : '#F6F1E8');
  }
  function guardaCorpo(o) {
    const M = LADO / 2;
    for (const [px, pz, w, d] of [[0, -M, LADO + .4, .3], [0, M, LADO + .4, .3], [-M, 0, .3, LADO], [M, 0, .3, LADO]]) {
      o.caixa(px, Y0, pz, w, .55, d, '#FFFFFF').caixa(px, Y0 + .55, pz, w + .06, .12, d + .06, '#FF7A2F');
    }
  }

  // Fachada: fundo (-z) e esquerda (-x) em blocos creme com janelões; frente (+z) e direita (+x) de vidro com
  // caixilho branco grosso e pilares nas quinas; a coluna laranja da marca na quina da frente; jardineiras.
  function fachada(o, g, andar, terreo) {
    const H = PE - .25, M = LADO / 2, p1 = claro(andar.cor, .8), p2 = claro(andar.cor, .74);
    for (let i = 0; i < LADO; i++) {
      const a = -M + i + .5, janela = i % 3 === 1 && i < LADO - 1;
      for (const [px, pz, w, d] of [[a, -M - .05, 1, .4], [-M - .05, a, .4, 1]]) {
        if (!janela) { o.caixa(px, Y0, pz, w, H, d, i % 2 ? p1 : p2); continue; }
        o.caixa(px, Y0, pz, w, .5, d, p1).caixa(px, Y0 + H - .35, pz, w, .35, d, p1);
        o.luz(px, Y0 + .5, pz, w === 1 ? .84 : .44, H - .85, d === 1 ? .84 : .44, '#FFE2B0');
        // Detalhe de maquete (padrão voxel, 09/11/2026: "rico em detalhe"): peitoril branco saindo da parede e, em
        // janelas alternadas, o ar-condicionado com a grade, como nos prédios de Irecê.
        const fora = w === 1 ? [0, -.27] : [-.27, 0], [ox, oz] = [px + fora[0], pz + fora[1]];
        o.caixa(ox, Y0 + .44, oz, w === 1 ? 1 : .16, .07, w === 1 ? .16 : 1, '#FFFFFF');
        if ((i + andar.nivel) % 2 === 0) {
          const [ax, az] = [px + fora[0] * 1.3, pz + fora[1] * 1.3], [aw, ad] = w === 1 ? [.56, .3] : [.3, .56];
          o.caixa(ax, Y0 + .05, az, aw, .32, ad, '#E3E5E7');
          for (let k = 0; k < 3; k++) o.caixa(ax + (w === 1 ? 0 : -.16), Y0 + .1 + k * .09, az + (w === 1 ? -.16 : 0), w === 1 ? aw - .1 : .02, .04, w === 1 ? .02 : ad - .1, '#8A9096');
        }
      }
    }
    // Friso no alto de cada andar nas paredes de blocos: marca os andares de fora.
    o.caixa(0, Y0 + H - .06, -M - .3, LADO + .5, .1, .12, escuro(p1, .14)).caixa(-M - .3, Y0 + H - .06, 0, .12, .1, LADO + .5, escuro(p1, .14));
    for (const [px, pz] of [[-M, -M], [M, -M], [-M, M], [M, M]]) o.caixa(px, Y0 - .02, pz, .5, H + .04, .5, '#FFFFFF');
    for (let k = 1; k < 4; k++) { const p = -M + k * LADO / 4; o.caixa(p, Y0, M + .02, .14, H, .14, '#FFFFFF'); o.caixa(M + .02, Y0, p, .14, H, .14, '#FFFFFF'); }
    o.caixa(0, Y0 + H - .12, M + .02, LADO, .14, .16, '#FFFFFF').caixa(M + .02, Y0 + H - .12, 0, .16, .14, LADO, '#FFFFFF');
    // Coluna laranja na quina da frente: a marca da Vybe, sobe o prédio inteiro.
    o.caixa(-M + 1.3, Y0 - .02, M + .14, 2.2, H + .04, .26, '#FF7A2F');
    if (andar.nivel === TOPO - 2) o.letreiro('VYBE', { x: -M + 1.3, y: Y0 + H / 2, z: M + .3, px: .15, cor: '#FFFFFF', aceso: true });
    // Luz quente no teto das salas, vista de fora pelo vidro (some quando se entra no andar).
    const teto = new Obra();
    for (const a of [-3.2, 0, 3.2]) for (const b of [-3, 0, 3]) teto.luz(a + .6, Y0 + H - .05, b, 1.6, .05, .2, '#FFE2B0');
    const tetoM = teto.montar({ sombra: false }); tetoM.traverse((m) => m.material?.color?.set('#B9B0A2')); g.add(tetoM); g.userData.teto = tetoM;
    if (!terreo) {
      // Jardineira branca com plantas em cachos na borda da frente.
      o.caixa(1.3, Y0 - .02, M + .45, LADO - 3.4, .32, .4, '#FFFFFF');
      for (let k = 0; k < 7; k++) o.caixa(-2.1 + k * 1.05, Y0 + .3, M + .45, .5, .24 + (k % 3) * .1, .32, k % 2 ? '#5FA34E' : '#6BAF52');
      for (const k of [0, 3, 5]) o.caixa(-2.1 + k * 1.05, Y0 + .6 + (k % 3) * .1, M + .45, .12, .12, .12, ['#FF8FAB', '#F2C230', '#FFFFFF'][k % 3]);
    } else {
      // Térreo: toldo listrado como o das lojas do Centro, porta de vidro e "vybe." no vidro.
      const faixas = 9, fw = (LADO - 2.6) / faixas;
      for (let f = 0; f < faixas; f++) o.caixa(-M + 2.6 + fw * (f + .5), Y0 + H - .45, M + .6, fw, .16, 1.2, f % 2 ? '#FFFFFF' : '#FF7A2F');
      for (let f = 0; f < 7; f++) o.caixa(M + .6, Y0 + H - .49, -M + .6 + f * 1.4, 1.2, .16, 1.4, f % 2 ? '#FFFFFF' : '#FF7A2F'); // abaixo da faixa da frente e sem passar dela
      o.caixa(2.6, Y0, M + .05, 1.7, H - .45, .12, '#FFFFFF').luz(2.6, Y0 + .05, M + .1, 1.4, H - .55, .02, '#CFE8F0');
      o.letreiro('vybe.', { x: -.4, y: Y0 + 1.25, z: M + .1, px: .13, cor: '#FF7A2F', aceso: true });
    }
  }

  // Mesa do agente (ou mesa livre): tapete do setor, divisória baixa atrás com o telão do estado, mesa, cadeira e
  // o boneco de agente de frente para o vidro. Mesa livre: cadeira vazia, telão apagado e uma plantinha.
  function mesa(o, m, cor, agente) {
    const { x: mx, z: mz, w } = m, wd = Math.min(2.4, w - .7);
    o.caixa(mx, Y0, mz, w - .3, .02, m.d - .4, claro(cor, agente ? .7 : .85));
    o.caixa(mx, Y0, mz - 1.3, wd + .3, .95, .16, '#FFFFFF').caixa(mx, Y0 + .95, mz - 1.3, wd + .36, .08, .2, claro(cor, .3));
    o.caixa(mx, Y0 + .3, mz - 1.2, wd - .2, .62, .04, '#2B2F33');
    const tela = o.luzes.length;
    o.luz(mx, Y0 + .36, mz - 1.17, wd - .32, .5, .02, agente ? '#3E4A52' : '#33383D');
    o.caixa(mx, Y0 + .5, mz + .35, wd, .08, .7, '#E2C19A');
    for (const s of [-1, 1]) o.caixa(mx + s * (wd / 2 - .06), Y0, mz + .35, .1, .5, .62, '#FFFFFF');
    o.caixa(mx + .45, Y0 + .58, mz + .25, .45, .28, .04, '#2B2F33').caixa(mx + .45, Y0 + .58, mz + .3, .06, .1, .06, '#3A3F44');
    o.caixa(mx - .4, Y0 + .58, mz + .45, .4, .02, .14, '#F4F1EA');
    o.caixa(mx, Y0, mz - .45, .4, .3, .4, '#3A3F44').caixa(mx, Y0 + .3, mz - .45, .44, .07, .44, agente ? '#2B2F33' : '#9AA3A8').caixa(mx, Y0 + .37, mz - .66, .44, .42, .07, agente ? '#2B2F33' : '#9AA3A8');
    if (!agente) { o.caixa(mx - .6, Y0 + .58, mz + .4, .18, .16, .18, '#B5462F').caixa(mx - .6, Y0 + .74, mz + .4, .26, .22, .26, '#5FA34E'); return { tela, antena: -1 }; }
    const antena = desenharBoneco(o, figuraDoAgente(agente, cor), { x: mx, y: Y0, z: mz - .3, s: ESCALA_BONECO });
    return { tela, antena };
  }
  function registrarAgente(g, andar, andarIdx, setor, mx, mz, w, d) {
    const sala = { estado: 'indisponivel', conectado: false, luzes: null, tela: -1, antena: -1 };
    salas.set(setor.id, sala);
    const caixa = new THREE.Mesh(new THREE.BoxGeometry(w, PE, d), new THREE.MeshBasicMaterial({ visible: false }));
    caixa.position.set(mx, PE / 2, mz); caixa.userData.alvo = { tipo: 'setor', andar: andar.id, setor: setor.id };
    g.add(caixa); motor.clicavel(caixa);
    const r = motor.rotulo({ pos: new THREE.Vector3(x + mx, y + andar.nivel * PE + 1.95, z + mz), classe: 'rotulo-agente escondido indisponivel',
      html: `<b>${setor.agente}</b><small>${setor.nome} · sem leitura da central</small><span class="det"><em>${setor.papel || ''}</em><span class="op">Sem leitura da central agora.</span><span class="sk">${(setor.skills || []).slice(0, 4).map((k) => `<i>${k}</i>`).join('')}</span></span>`, distMax: 140, prioridade: 3,
      aoClicar: () => motor.emitirClique?.({ tipo: 'setor', andar: andar.id, setor: setor.id }) });
    r.forcarEscondido = true; r.el.hidden = true;
    agentesRot.push({ r, andarIdx, nivel: andar.nivel, setor: setor.id, andarId: andar.id, sx: mx, sz: mz });
    const fase = ruido(mx * 13, andar.nivel) * 6;
    animaveis.push((t) => {
      if (sala.estado !== 'executando' || !sala.conectado || !sala.luzes) return false;
      sala.luzes.setColorAt(sala.tela, corTmp.setHSL(.57, .7, .6 + Math.sin(t * 4 + fase) * .1)); sala.luzes.instanceColor.needsUpdate = true;
      return motor.emVista(sala.luzes);
    });
    return sala;
  }
  // Andar de agentes: uma mesa por agente do setor e as outras livres (MESAS_POR_ANDAR).
  function mesasDosAgentes(o, g, andar, andarIdx, pendentes) {
    const ags = andar.setores.filter((s) => s.agente), lugares = mesasDoAndar(Math.max(MESAS_POR_ANDAR, ags.length));
    lugares.forEach((m, i) => {
      const s = ags[i], r = mesa(o, m, andar.cor, s?.agente || null);
      if (s) pendentes.push({ sala: registrarAgente(g, andar, andarIdx, s, m.x, m.z, m.w, m.d), ...r });
    });
    // Corredor da frente: passadeira na cor do setor, sofá de espera e plantas.
    o.caixa(0, Y0, LADO / 2 - .9, LADO - 1.4, .02, .8, claro(andar.cor, .55));
    for (const k of [-4.4, 4.4]) o.caixa(k, Y0, LADO / 2 - .9, .5, .4, .5, '#C9773E').caixa(k, Y0 + .4, LADO / 2 - .9, .62, .5, .62, '#5FA34E');
  }
  // Térreo: balcão da recepção com o VYBES (o orquestrador) e a Convivência na frente.
  function recepcao(o, g, andar, andarIdx, pendentes) {
    const s = andar.setores.find((q) => q.agente);
    o.caixa(0, Y0, -2.6, 4.6, .8, .8, '#FFFFFF').caixa(0, Y0 + .8, -2.6, 4.8, .08, 1, '#E2C19A').caixa(0, Y0 + .1, -2.18, 4.4, .5, .04, '#FF7A2F');
    for (const k of [-1, 1]) o.caixa(k * 2.7, Y0, -2.1, .8, .8, 1.8, '#FFFFFF');
    o.caixa(0, Y0, -LADO / 2 + .3, 5, 1.6, .16, '#FFFFFF');
    const tela = o.luzes.length; o.luz(0, Y0 + .5, -LADO / 2 + .4, 4.4, .9, .02, '#3E4A52');
    o.letreiro('VYBES', { x: 0, y: Y0 + 1.8, z: -LADO / 2 + .45, px: .1, cor: '#FF7A2F', aceso: true });
    const antena = s ? desenharBoneco(o, figuraDoAgente(s.agente, andar.cor), { x: 0, y: Y0, z: -3.5, s: ESCALA_BONECO * 1.1 }) : -1;
    o.caixa(-4.4, Y0, -4.4, .7, .5, .7, '#C9773E').caixa(-4.4, Y0 + .5, -4.4, .9, 1.2, .9, '#4F9A4E');
    if (s) pendentes.push({ sala: registrarAgente(g, andar, andarIdx, s, 0, -3, 5, 3), tela, antena });
  }

  // ---------- Salas do time (o Escritório dentro do prédio) ----------
  // As MESMAS zonas do Escritório (voz, presença e trancas não mudam). Andar do time: as salas em grade, cada uma
  // com meia parede branca de tampo colorido, piso próprio e os móveis do tipo; o terraço tem os cantos de lazer.
  function salasDaEquipe(o, g, andar, terreo, terraco) {
    const zonas = zonasDoAndar(andar.id);
    if (!zonas.length) return;
    const marcar = (zn, cx, cz, w, d) => {
      centros.set(zn.id, { g, x: cx, z: cz, w });
      const caixa = new THREE.Mesh(new THREE.BoxGeometry(w, PE, d), new THREE.MeshBasicMaterial({ visible: false }));
      caixa.position.set(cx, PE / 2, cz); caixa.userData.alvo = { tipo: 'zona', zona: zn.id, andar: andar.id };
      g.add(caixa); motor.clicavel(caixa);
    };
    if (terreo) {
      // Convivência: sofás em L, tapete laranja, mesa de centro e plantas, na frente do balcão.
      o.caixa(-.5, Y0, 2, 5.4, .02, 3.4, '#FFD9BF').caixa(-.5, Y0, 2, 5, .025, 3, '#FF9A5C');
      o.caixa(-.5, Y0, 3.4, 3.6, .38, .7, '#F2C14E').caixa(-.5, Y0 + .38, 3.7, 3.6, .4, .14, '#F2C14E');
      o.caixa(-2.9, Y0, 2, .7, .38, 2.6, '#5CC8B8').caixa(-3.2, Y0 + .38, 2, .14, .4, 2.6, '#5CC8B8');
      o.caixa(-.5, Y0, 1.8, 1.4, .34, .8, '#C99A6B').caixa(-.3, Y0 + .34, 1.8, .16, .16, .16, '#FF7A2F');
      o.caixa(3.6, Y0, 3.6, .6, .5, .6, '#C9773E').caixa(3.6, Y0 + .5, 3.6, .8, .9, .8, '#5FA34E');
      marcar(zonas[0], 0, 2.4, LADO - .6, 5.4); return;
    }
    if (terraco) {
      const quad = { cafe: [-2.9, -2.9], jogos: [-1.5, 0], lounge: [2.9, 2.6], academia: [2.9, -2.9] };
      for (const zn of zonas) {
        const [qx, qz] = quad[zn.id] || [0, 0];
        if (zn.id === 'cafe') { o.caixa(qx, Y0, qz, 2.2, .6, .6, '#C99A6B').caixa(qx, Y0 + .6, qz, 2.3, .06, .7, '#FFFFFF'); for (const k of [-.8, 0, .8]) o.caixa(qx + k, Y0, qz + .7, .3, .45, .3, '#FF7A2F'); o.luz(qx - .7, Y0 + .66, qz, .2, .25, .2, '#FFE2B0'); }
        if (zn.id === 'academia') { for (const k of [-.8, .8]) o.caixa(qx + k, Y0, qz, .9, .1, 1.6, '#5CC8B8'); o.caixa(qx, Y0 + .5, qz, 1.8, .06, .06, '#9AA3A8'); for (const k of [-.9, .9]) o.caixa(qx + k, Y0 + .35, qz, .12, .35, .35, '#3A3F44'); }
        marcar(zn, qx, qz, 3.2, 3.2);
      }
      return;
    }
    const n = zonas.length, cols = n > 6 ? 4 : n > 2 ? 2 : n, linhas = Math.ceil(n / cols);
    const w = (LADO - .7) / cols, d = (LADO - 1.8) / linhas;
    zonas.forEach((zn, k) => {
      const cx = -LADO / 2 + .35 + w * (k % cols + .5), cz = -LADO / 2 + .45 + d * (Math.floor(k / cols) + .5), pessoal = Boolean(zn.dono);
      const tom = pessoal ? ['#FFE3CC', '#DDEFE3', '#DCE8F7', '#EFE1F7', '#FCE6B0'][k % 5] : '#E3F0F2';
      o.caixa(cx, Y0, cz, w - .12, .025, d - .12, tom);
      // Meia parede no fundo e na esquerda (as salas se veem por cima) com o tampo na cor do andar.
      o.caixa(cx, Y0, cz - d / 2 + .08, w - .1, .7, .14, '#FFFFFF').caixa(cx, Y0 + .7, cz - d / 2 + .08, w - .06, .07, .18, claro(andar.cor, .3));
      o.caixa(cx - w / 2 + .08, Y0, cz, .14, .7, d - .4, '#FFFFFF').caixa(cx - w / 2 + .08, Y0 + .7, cz, .18, .07, d - .36, claro(andar.cor, .3));
      const px = .045;
      o.letreiro((zn.dono || zn.nome).slice(0, Math.max(4, Math.floor((w - .3) / (px * 4)))), { x: cx, y: Y0 + .45, z: cz - d / 2 + .16, px, cor: '#1F1D1A' });
      if (pessoal) {
        const mw = Math.min(1.3, w - .5);
        o.caixa(cx, Y0 + .48, cz - .35, mw, .07, .55, '#E2C19A'); for (const s of [-1, 1]) o.caixa(cx + s * (mw / 2 - .05), Y0, cz - .35, .08, .48, .5, '#FFFFFF');
        o.caixa(cx, Y0 + .55, cz - .55, .5, .3, .04, '#2B2F33').luz(cx, Y0 + .58, cz - .52, .42, .22, .02, ['#9FD9F0', '#FFB27A', '#C7B8FF', '#A8E6B8'][k % 4]);
        o.caixa(cx, Y0, cz + .1, .34, .26, .34, '#3A3F44').caixa(cx, Y0 + .26, cz + .28, .36, .3, .06, '#3A3F44');
        o.caixa(cx + w / 2 - .32, Y0, cz + d / 2 - .35, .3, .28, .3, '#C9773E').caixa(cx + w / 2 - .32, Y0 + .28, cz + d / 2 - .35, .4, .4, .4, '#5FA34E');
      } else if (zn.id === 'reuniao') { o.caixa(cx, Y0 + .42, cz, w * .6, .07, d * .35, '#FFFFFF').caixa(cx, Y0, cz, .2, .42, .2, '#9AA3A8'); for (const a of [-1, 1]) for (const b of [-.3, 0, .3]) o.caixa(cx + b * w * .6, Y0, cz + a * d * .27, .28, .35, .28, '#FF7A2F'); }
      else if (zn.id === 'producao') { o.luz(cx, Y0, cz - d / 2 + .2, w * .7, 1.5, .04, '#3DDC84'); for (const a of [-1, 1]) o.caixa(cx + a * w * .3, Y0, cz + .3, .05, .9, .05, '#2B2F33').luz(cx + a * w * .3, Y0 + .9, cz + .3, .35, .25, .12, '#FFF1D2'); o.caixa(cx, Y0, cz + .9, .05, .7, .05, '#2B2F33').caixa(cx, Y0 + .7, cz + .9, .3, .2, .25, '#1F1D1A'); }
      else if (zn.id === 'operacao') { for (const a of [-1, 0, 1]) o.caixa(cx + a * w * .26, Y0 + .7, cz - d / 2 + .25, w * .24, .55, .05, '#2B2F33').luz(cx + a * w * .26, Y0 + .74, cz - d / 2 + .28, w * .22, .47, .02, ['#9FF0C8', '#BFE3EA', '#FFD6A8'][a + 1]); o.caixa(cx, Y0, cz, w * .7, .48, .5, '#FFFFFF').caixa(cx, Y0 + .48, cz, w * .72, .06, .56, '#E2C19A'); }
      else if (zn.id === 'auditorio') { for (let r2 = 0; r2 < 3; r2++) for (let c = -2; c <= 2; c++) o.caixa(cx + c * w * .17, Y0 + r2 * .08, cz + r2 * .55, w * .13, .32, .3, '#FF7A2F'); o.luz(cx, Y0 + .5, cz - d / 2 + .25, w * .7, .9, .03, '#FFFFFF'); }
      else if (zn.id === 'foco') { for (const a of [-1, 1]) o.caixa(cx + a * w * .22, Y0 + .42, cz, w * .32, .06, .5, '#E2C19A').caixa(cx + a * w * .22, Y0, cz, .08, .42, .4, '#FFFFFF').caixa(cx + a * w * .22, Y0, cz + .5, .3, .3, .3, '#5CC8B8'); }
      marcar(zn, cx, cz, w - .1, d - .1);
    });
  }

  // Quem está em cada sala: o boneco da Vybe de cada pessoa (figura do perfil) na zona da presença do Escritório.
  let grupoPessoas = [], rotulosPessoas = [];
  function presenca(lista) {
    motor.invalidar();
    for (const m of grupoPessoas) { m.parent?.remove(m); m.traverse((q) => q.geometry?.dispose?.()); }
    for (const r of rotulosPessoas) motor.removerRotulo(r);
    grupoPessoas = []; rotulosPessoas = [];
    const porZona = new Map();
    for (const p of lista) { if (!centros.has(p.zona)) continue; if (!porZona.has(p.zona)) porZona.set(p.zona, []); porZona.get(p.zona).push(p); }
    for (const [zona, gente] of porZona) {
      const c = centros.get(zona), o = new Obra(), passo = Math.min(.55, c.w / Math.max(1, gente.length));
      gente.forEach((p, i) => desenharBoneco(o, figuraDaPessoa(p), { x: c.x + (i - (gente.length - 1) / 2) * passo, y: Y0, z: c.z + .3 + (i % 2) * .3, s: .5 }));
      const malha = o.montar(); c.g.add(malha); grupoPessoas.push(malha);
      const r = motor.rotulo({ pos: new THREE.Vector3(), classe: 'rotulo-pessoas', html: gente.map((p) => `<b>${String(p.nome).split(' ')[0].replace(/[<>&]/g, '')}</b>`).join(''), distMax: 220, prioridade: 3 });
      r.centro = c; rotulosPessoas.push(r);
    }
  }
  motor.animar(() => { for (const r of rotulosPessoas) { r.pos.set(x + r.centro.x, y + r.centro.g.position.y + 1.6, z + r.centro.z); r.el.hidden = !r.centro.g.visible; } });

  function terracoMoveis(pecas) {
    {
      // O Escritório no terraço (Paulo, 07/11/2026: "muito mal feito"): deque de tábuas, sinuca de verdade (pés, caçapas,
      // tacos), ombrelones listrados em degraus com mesinha e cadeiras, sofás com almofadas, floreiras com flores,
      // bar com bancos e um cordão de luzinhas no guarda-corpo.
      for (let k = 0; k < 26; k++) pecas.push({ x: 0, y: Y0, z: -LADO / 2 + .4 + k * .44, w: LADO - .3, h: .012, d: .03, cor: '#A87B52' }); // juntas do deque
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
    }
  }

  // ----- Elevador de vidro na fachada da esquerda, a que a câmera do Prédio vê (Paulo, 08/11/2026: "deixar FODA") -----
  // Torre de vidro com montantes brancos do térreo ao terraço e a cabine laranja que vai até o andar escolhido no
  // elevador do painel (focar). Sem andar escolhido, a cabine descansa no térreo.
  const elev = { x: -LADO / 2 - .85, z: 1.5 }, alturaTorre = TOPO * PE + .4;
  {
    const o = new Obra();
    for (const [dx, dz] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) o.caixa(elev.x + dx, 0, elev.z + dz, .12, alturaTorre, .12, '#FFFFFF');
    for (let k = 0; k <= TOPO; k++) o.caixa(elev.x, k * PE + .1, elev.z, 1.32, .1, 1.32, '#FFFFFF');
    o.caixa(elev.x, alturaTorre, elev.z, 1.5, .3, 1.5, '#FF7A2F');
    raiz.add(o.montar());
    const torre = new THREE.Mesh(new THREE.BoxGeometry(1.2, alturaTorre, 1.2), vidro);
    torre.position.set(elev.x, alturaTorre / 2, elev.z); torre.renderOrder = 2; raiz.add(torre);
  }
  const cabine = (() => {
    const o = new Obra();
    o.caixa(0, 0, 0, 1.04, .12, 1.04, '#FFFFFF').caixa(0, .12, 0, 1, 1.15, 1, '#FF7A2F').caixa(0, 1.27, 0, 1.04, .12, 1.04, '#FFFFFF');
    o.luz(0, .3, .51, .7, .8, .02, '#FFE2B0').luz(-.51, .3, 0, .02, .8, .7, '#FFE2B0');
    const m = o.montar({ sombra: false }); m.position.set(elev.x, .25, elev.z); raiz.add(m); return m;
  })();
  let cabineY = .25;

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
  ser.position.y = PE * TOPO + 3.2;
  ser.userData.alvo = { tipo: 'vybes' };
  motor.clicavel(ser);
  raiz.add(ser);
  const rotuloSer = motor.rotulo({ pos: new THREE.Vector3(x, y + PE * TOPO + 6.6, z), classe: 'rotulo-vybes', html: '<i></i><b>VYBES</b>', distMax: 700, prioridade: 10 });

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
    // A cabine vai até o andar em foco (a altura dele já inclui a vista aberta); devagar no começo e no fim.
    const destino = foco !== null ? (andares.find((a) => a.andar.nivel === foco)?.g.position.y ?? 0) + .1 : .25;
    if (Math.abs(destino - cabineY) > .005) { cabineY += (destino - cabineY) * (1 - Math.pow(.02, dt)); cabine.position.y = cabineY; abrindo = true; }
    vidro.opacity = foco !== null ? .04 : .22 - .16 * abre;
    const pulso = estadoSer === 'alerta' ? 1 + Math.sin(t * 7) * .06 : 1 + Math.sin(t * 1.6) * .035;
    casca.scale.setScalar(pulso);
    casca.rotation.y = t * .25; anel.rotation.z = t * .6;
    ser.position.y = PE * TOPO + 3.2 + Math.sin(t * .9) * .25 + abre * (TOPO - 1) * ABRE; // sobe junto com o terraço (último andar) na vista aberta
    nucleo.material.color.setHSL(estadoSer === 'alerta' ? .0 : .07, 1, .82 + Math.sin(t * 2) * .06);
    luz.intensity = 5 + Math.sin(t * 1.6) * 1.2;
    rotuloSer.pos.y = y + ser.position.y + 3.4;
    for (const a of andares) a.rotulo.pos.y = y + a.g.position.y + 1.2;
    for (const ag of agentesRot) { const a = andares[ag.andarIdx]; if (!a) continue; ag.r.pos.y = y + a.g.position.y + 1.95; const ver = foco === ag.nivel && a.g.visible; ag.r.el.hidden = !ver; ag.r.forcarEscondido = !ver; }
    let agenteAnimado = false;
    for (const f of animaveis) agenteAnimado = (f(t) === true) || agenteAnimado;
    return abrindo || (ser.visible && motor.emVista(ser)) || agenteAnimado;
  });

  const corTmp = new THREE.Color();
  function atividadeAgentes(agentes = [], conectado = false) {
    const porSetor = new Map(agentes.map(a => [a.setor, a]));
    let mudou = false;
    const hora = (v) => { const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
    const limpa = (t) => String(t || '').replace(/[<>&]/g, '');
    for (const [id, sala] of salas) {
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
      // Sem leitura da central, a mesa fica neutra (telão apagado, antena cinza) e não simula trabalho.
      const cor = conectado ? atual.cor : '#7A8B82';
      if (sala.luzes) {
        if (sala.tela >= 0) sala.luzes.setColorAt(sala.tela, corTmp.set(conectado ? cor : '#3E4A52'));
        if (sala.antena >= 0) sala.luzes.setColorAt(sala.antena, corTmp.set(conectado && atual.estado !== 'sem_execucao' ? cor : '#9AA3A8'));
        sala.luzes.instanceColor.needsUpdate = true;
      }
      const r = agentesRot.find(a => a.setor === id)?.r;
      if (r) { r.el.classList.remove(...Object.keys(ESTADOS_REAIS)); r.el.classList.add(atual.estado); r.el.style.setProperty('--ag-cor', cor); r.el.querySelector('small').textContent = atual.rotulo + (conectado ? '' : ' · última leitura'); }
    }
    // Andar com agente executando acende as luzes do teto (vistas de fora pelo vidro); os outros ficam na meia-luz.
    for (const a of andares) {
      const teto = a.g.userData.teto; if (!teto) continue;
      const exec = a.andar.setores.some((q) => { const sl = salas.get(q.id); return sl?.conectado && sl.estado === 'executando'; });
      teto.traverse((m) => { if (m.material?.color) { const c = exec ? '#FFFFFF' : '#B9B0A2'; if ('#' + m.material.color.getHexString().toUpperCase() !== c.toUpperCase()) { m.material.color.set(c); mudou = true; } } });
    }
    if (mudou) motor.invalidar();
  }

  const CORES_SIT = { verde: '#18A957', amarelo: '#E2A11B', vermelho: '#D93D42', cinza: '#9AA3A8' };
  // Aceita o nome da situação ou a cor da escala de urgência (prédio vivo, saude-andares.mjs).
  function situacaoDosAndares(mapa = {}) {
    let mudou = false;
    for (const a of andares) { const v = mapa[a.andar.id], c = /^#[0-9a-f]{6}$/i.test(v || '') ? v : CORES_SIT[v] || CORES_SIT.cinza; if ('#' + a.faixa.material.color.getHexString().toUpperCase() !== c.toUpperCase()) { a.faixa.material.color.set(c); mudou = true; } }
    if (mudou) motor.invalidar?.();
  }
  return {
    situacaoDosAndares,
    LADO, PE, raiz, atividadeAgentes,
    focar: (nivel) => { foco = nivel ?? null; motor.invalidar(); },
    presenca,
    zonas: () => [...centros.keys()],
    // Posição de cada agente no mundo (para as sinapses do cérebro).
    posDoSetor: (id) => { const ag = agentesRot.find((q) => q.setor === id); const a = ag && andares[ag.andarIdx]; return a ? { x: x + ag.sx, y: y + a.g.position.y + 1.2, z: z + ag.sz, nivel: ag.nivel, andar: ag.andarId } : null; },
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
