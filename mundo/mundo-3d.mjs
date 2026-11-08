import { criarFonteAgentes, apresentarAgente, referenciaDaPeca, ESTADOS_REAIS } from './atividade-agentes.mjs';
// Entrada do mundo voxel (empacotada com o three.js pelo build; carregada sob
// demanda por vybe-mundo.js). Monta Irecê, o Prédio da Vybe e os clientes.
import { criarMotor } from './motor.mjs';
import { relogioBahia, horarioDaCaptacao, priorizarCaptacoes, faseDaVan, roteirosDaSemana, bairroDoEndereco } from './captacoes.mjs';
import { saudeDosAndares, URGENCIA } from './saude-andares.mjs';
import { construirCentro } from './centro.mjs';
import { construirPredio } from './predio.mjs';
import { criarVida, noiteDaHora } from './vida.mjs';
import { PLANTA, ESTADOS, ZONAS_DO_PREDIO, MESAS_POR_ANDAR } from './planta.mjs';
import { Obra } from './voxel.mjs';
import LOCAIS from './locais.json' with { type: 'json' };

export { PLANTA, ESTADOS };
// Leitura dos agentes sem montar a cena (Hoje, Gestão e a página Agentes com o Centro fechado).
export { criarFonteAgentes, apresentarAgente, referenciaDaPeca, ESTADOS_REAIS };
export { abrirAndar } from './sala.mjs';
export { avatarVoxel, lerFigura, iconeMovel, tipoDoMovel, desenharPreviaAvatar, desenharBoneco, figuraDaPessoa, figuraDoAgente, avatarDoAgente } from './avatar.mjs';
export { CATALOGO, pecaDaClasse } from './catalogo.mjs';

// Centro comercial (Paulo, 08/11/2026): no lugar do mapa de Irecê (relevo, ruas, 5.148 empresas, ~3,9 MB de dados),
// uma maquete pequena com o Prédio da Vybe no meio e uma loja por cliente ativo. Nada é baixado além deste módulo.
export async function iniciarMundo(canvas, { reduzirMovimento = false, quantos = 32 } = {}) {
  const motor = criarMotor(canvas, { reduzirMovimento });
  try {
  // `irece` continua sendo o nome do chão para o resto deste arquivo (caminho, alturaEm), agora é o centro.
  const irece = construirCentro(motor, { quantos });
  const base = { x: 0, z: 0 };
  const predio = construirPredio(motor, { x: 0, z: 0, y: irece.alturaEm() + .02 });
  // A vida do Centro (gente, água, pássaros, lojas reagindo) e o dia e a noite pela hora da Bahia.
  const vida = criarVida(motor, irece, { reduzirMovimento });
  const clientes = { definir: (lista, opcoes) => { const r = irece.definir(lista, opcoes); vida.tamanhoMudou(); return r; } };
  // horaManual (Paulo, 08/11/2026: "o usuário escolher dia, noite ou automático"): null segue a hora real da Bahia;
  // um número (0–24) fixa a hora do mundo para quem escolheu.
  let noite = -1, conferiuHora = -1e9, horaManual = null;
  motor.animar((t) => {
    if (t - conferiuHora < 30) return false;
    conferiuHora = t;
    const k = Math.round(noiteDaHora(horaManual != null ? horaManual * 60 : relogioBahia().minutos) * 20) / 20;
    if (k === noite) return false;
    noite = k; motor.ambiente(k); vida.noite(k); return true;
  });
  let posicoes = [];

  const VISTAS = {
    cidade: { alvo: { x: 0, y: 4, z: 0 }, dist: 330, incl: .74, giro: -.75 },
    predio: { alvo: { x: 0, y: 17, z: 0 }, dist: 195, incl: .42, giro: -.6 },
  };
  motor.voar(VISTAS.cidade, 1);

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

  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function naBase() { return null; } // a base de CNPJ não é mais baixada no Centro
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
    // Prédio vivo e roteiro das captações (funções puras; aqui só ganham as posições do mapa).
    saudeDosAndares, urgencia: URGENCIA,
    roteirosDaSemana(eventos, desde) {
      const fixos = LOCAIS?.clientes || {};
      const acharSede = (c) => posicoes.find((p) => norm(p.nome) === norm(c)) || posicoes.find((p) => norm(p.nome).length > 3 && norm(c).includes(norm(p.nome)));
      const pontoDe = (cliente) => {
        const sede = acharSede(cliente); if (!sede) return null;
        const f = fixos[sede.nome] || {}, base = naBase(sede.nome, true);
        return { x: sede.x, z: sede.z, bairro: f.bairro || bairroDoEndereco(f.endereco) || bairroDoEndereco(ultimoComPonto.find((c) => c.nome === sede.nome)?.endereco) || base?.bairro || '' };
      };
      return roteirosDaSemana(eventos, { pontoDe, origem: { x: base.x, z: base.z }, desde });
    },
    noRecorte: (x, z) => irece.noRecorte(x, z),
    empresas: [], fonteEmpresas: '', tipoLegivel: () => '', agencia: { x: base.x, z: base.z },
    focarPonto(x, z, dist = 80, incl = .7, giro) { predio.abrir(false); motor.voar({ alvo: { x, y: irece.alturaEm(x, z), z }, dist, incl, ...(giro == null ? {} : { giro }) }); },
    criarFonteAgentes, apresentarAgente, referenciaDaPeca, estadosReais: ESTADOS_REAIS, atividadeAgentes: predio.atividadeAgentes,
    definirCaptacoes,
    diaNaBahia: () => relogioBahia().dia,
    destruir: motor.destruir,
    planta: PLANTA, estados: ESTADOS, zonasDoPredio: ZONAS_DO_PREDIO, mesasPorAndar: MESAS_POR_ANDAR, presenca: (lista = []) => {
      predio.presenca(lista);
      // Quem está online mas fora das salas do prédio passeia na praça com o próprio boneco.
      const zonas = new Set(predio.zonas());
      vida.definirOnline(lista.filter((p) => !zonas.has(p.zona)));
    },
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
      if (p) { predio.abrir(false); const l = p.loja || p; motor.voar({ alvo: { x: l.x, y: 2.5, z: l.z }, dist: 70, incl: .5, giro: Math.atan2(-l.x, -l.z) + .35 }); }
    },
    // Conferência: onde cada cliente deveria estar (ponto real) e onde a sede ficou.
    desempenho: () => motor.desempenho(),
    // Conferência do dia e da noite (0 dia, 1 noite); o relógio da Bahia volta a mandar em até 30 s.
    definirHora: (h) => { horaManual = Number.isFinite(Number(h)) && h !== null ? Math.max(0, Math.min(24, Number(h))) : null; noite = -1; conferiuHora = -1e9; motor.invalidar(); },
    ambiente: (k) => { motor.ambiente(k); vida.noite(k); noite = -1; conferiuHora = performance.now() / 1000; },
    orcamento: () => { const lista = []; motor.cena.traverse((o) => { if (!o.isMesh || !o.visible) return; let vis = true, p = o.parent; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; } if (!vis) return; const g = o.geometry; const tri = ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1); lista.push({ tipo: o.isInstancedMesh ? 'inst' : 'mesh', tri: Math.round(tri), mat: o.material?.type, n: o.isInstancedMesh ? o.count : 1, sombra: o.castShadow }); }); lista.sort((a, b) => b.tri - a.tri); return { total: lista.reduce((n, x) => n + x.tri, 0), top: lista.slice(0, 12) }; },
    conferirClientes: () => ultimoComPonto.map((c) => { const p = posicoes.find((x) => x.nome === c.nome); return { nome: c.nome, ponto: c.ponto, sede: p ? { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 } : null, dist: c.ponto && p ? Math.round(Math.hypot(c.ponto.x - p.x, c.ponto.z - p.z) * 10) : null }; }),
    // O cliente na base de CNPJ (nome fantasia ou razão social): é o endereço oficial dele.
    acharNaBase: (nome) => naBase(nome, true),
    definirClientes(lista, opcoes) {
      posicoes = clientes.definir(lista, opcoes);
      ultimoComPonto = lista.map((c) => ({ ...c, ponto: null, precisao: 'centro' }));
    },
    alertaVybes: predio.alerta,
    predioAberto: predio.aberto,
    estado: motor.estado, projetar: motor.projetar,
  };
  } catch (erro) { motor.destruir(); throw erro; }
}
