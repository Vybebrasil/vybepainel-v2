// Os clientes ativos da Vybe como sedes em Irecê, em anéis à volta da agência.
// A sede tem a cara do negócio (sedes.mjs); a cor vem da situação: no farol do
// telhado e no número da placa.
import * as THREE from 'three';
import { ruido } from './irece.mjs';
import { construirSede, idDaSede, COMPLEXOS, VIZINHOS } from './sedes.mjs';
import { Obra } from './voxel.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function tipoDoSegmento(seg) {
  const s = String(seg || '').toLowerCase();
  if (/prefeit|c[aâ]mara|governo|secretar|p[uú]blic/.test(s)) return 'publico';
  if (/restaur|aliment|padar|lanch|bar|caf|pizz|a[cç]a[ií]|sorvet|comida/.test(s)) return 'comida';
  if (/cl[ií]nic|sa[uú]de|m[eé]dic|odont|hospital|farm|est[eé]tic|laborat/.test(s)) return 'saude';
  if (/moda|loja|varej|cal[cç]ad|[oó]tica|joia|boutique|cosm/.test(s)) return 'loja';
  if (/academ|fit|esporte|crossfit|luta/.test(s)) return 'academia';
  if (/escola|educa|curso|faculd|col[eé]gio/.test(s)) return 'escola';
  if (/cooperat|agro|rural|feij|semente|m[aá]quina/.test(s)) return 'agro';
  return 'escritorio';
}

// Junta quem divide terreno e encosta quem é vizinho. Devolve "ocupações" de lote, já na ordem.
export function ocuparLotes(lista) {
  const porId = new Map();
  for (const c of lista) { const id = idDaSede(c.nome); if (id) porId.set(id, c); }
  const usados = new Set(), ocupacoes = [];
  const urgencia = (c) => c.peso * 1000 + c.total;
  const ordem = [...lista].sort((a, b) => urgencia(b) - urgencia(a));
  for (const c of ordem) {
    if (usados.has(c)) continue;
    const id = idDaSede(c.nome);
    const complexo = id && COMPLEXOS.find((g) => g.membros.includes(id));
    if (complexo) {
      const membros = complexo.membros.map((m) => porId.get(m)).filter(Boolean);
      membros.forEach((m) => usados.add(m));
      ocupacoes.push({ tipo: 'complexo', clientes: membros });
      continue;
    }
    usados.add(c); ocupacoes.push({ tipo: 'sede', clientes: [c] });
    const par = id && VIZINHOS.find((v) => v.includes(id));
    if (par) for (const outro of par.filter((x) => x !== id).map((x) => porId.get(x)).filter(Boolean)) {
      if (usados.has(outro)) continue;
      usados.add(outro); ocupacoes.push({ tipo: 'sede', clientes: [outro], vizinhoDe: c.nome });
    }
  }
  return ocupacoes;
}

export function criarClientes(motor, irece, lotes) {
  let grupo = null;
  const rotulos = [], alvos = [], farois = [];
  motor.animar((t) => {
    for (const f of farois) {
      const pulsa = f.userData.pulsa;
      f.material.opacity = pulsa ? .55 + Math.sin(t * 5) * .35 : .9;
      f.scale.setScalar(pulsa ? 1 + Math.sin(t * 5) * .12 : 1);
    }
  });

  function definir(lista, { aoClicar } = {}) {
    if (grupo) { motor.cena.remove(grupo); grupo.traverse((o) => o.geometry?.dispose?.()); }
    for (const r of rotulos.splice(0)) motor.removerRotulo(r);
    for (const a of alvos.splice(0)) motor.naoClicavel(a);
    farois.length = 0;
    grupo = new THREE.Group(); motor.adicionar(grupo);
    const ocupacoes = ocuparLotes(lista).slice(0, lotes.length);
    const posicoes = [];
    // Lote de cada ocupação: com endereço, o livre mais perto do endereço; sem, o próximo perto da agência.
    const livres = lotes.map((l, i) => ({ ...l, i })), escolhidos = [];
    const tirar = (l) => { livres.splice(livres.indexOf(l), 1); return l; };
    for (const oc of ocupacoes) {
      const pt = oc.clientes.find((c) => c.ponto)?.ponto;
      // Com endereço: terreno no próprio endereço (a cidade abre espaço). Sem terreno ali, o lote livre mais perto.
      const noEndereco = pt && irece.achaTerreno?.(oc.clientes.map((c) => c.nome).join('|'), pt.x, pt.z, 1);
      if (noEndereco) { escolhidos.push({ x: noEndereco.x, z: noEndereco.z, giro: noEndereco.giro, noEndereco: true, ponto: pt }); continue; }
      escolhidos.push(pt ? tirar(livres.reduce((m, l) => (Math.hypot(l.x - pt.x, l.z - pt.z) < Math.hypot(m.x - pt.x, m.z - pt.z) ? l : m), livres[0])) : null);
    }
    ocupacoes.forEach((oc, k) => { if (!escolhidos[k]) escolhidos[k] = tirar(livres[0]); });
    // Vizinhos ficam no lote seguinte do mesmo anel: o anel é ordenado por ângulo.
    ocupacoes.forEach((oc, k) => {
      const lote = escolhidos[k], y = irece.alturaEm(lote.x, lote.z);
      const raiz = new THREE.Group();
      raiz.position.set(lote.x, y, lote.z);
      raiz.rotation.y = lote.giro ?? Math.atan2(-lote.x, -lote.z); // a frente olha para a rua do endereço (ou para a agência)
      raiz.scale.setScalar(lote.noEndereco ? .42 : .9); // no endereço real a sede cabe num lote de 5 células; no anel, no de 7
      const principal = oc.clientes[0];
      const membros = oc.tipo === 'complexo' ? Object.fromEntries(oc.clientes.map((c) => [idDaSede(c.nome), c.nome])) : null;
      const sede = construirSede({ id: idDaSede(principal.nome), nome: principal.nome, tipo: tipoDoSegmento(principal.segmento), total: principal.total, membros });
      raiz.add(sede.malha);
      // Clique e farol: um por cliente (no complexo, cada loja tem o seu).
      oc.clientes.forEach((cli, i) => {
        const n = oc.clientes.length, dx = n > 1 ? -2.6 + i * 2.6 : 0;
        const caixa = new THREE.Mesh(new THREE.BoxGeometry(n > 1 ? 2.5 : 7, sede.alto + 1, n > 1 ? 4.5 : 7), new THREE.MeshBasicMaterial({ visible: false }));
        caixa.position.set(dx, (sede.alto + 1) / 2, n > 1 ? -.6 : 0);
        caixa.userData.alvo = { tipo: 'cliente', nome: cli.nome };
        raiz.add(caixa); motor.clicavel(caixa); alvos.push(caixa);
        const farol = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshBasicMaterial({ color: cli.cor, transparent: true, opacity: .9, toneMapped: false }));
        farol.position.set(dx + (n > 1 ? .8 : 2.6), sede.alto + .6, n > 1 ? -2.4 : -2.6);
        farol.userData.pulsa = cli.situacao === 'atrasada';
        raiz.add(farol); farois.push(farol);
        const pontoCli = cli.ponto || lote.ponto;
        const mundo = pontoCli && lote.noEndereco
          ? new THREE.Vector3(pontoCli.x + (n > 1 ? (i - (n - 1) / 2) * 1.2 : 0), irece.alturaEm(pontoCli.x, pontoCli.z) + sede.alto * raiz.scale.x + 1.2, pontoCli.z)
          : new THREE.Vector3(dx, sede.alto + 1.6, 0).multiplyScalar(raiz.scale.x).applyEuler(raiz.rotation).add(raiz.position);
        rotulos.push(motor.rotulo({ pos: mundo, classe: 'rotulo-cliente',
          // Pino do cliente (como na Central de Operações): bolinha da situação, nome e o resumo do que está em aberto.
          html: `<i class="pino" style="--c:${cli.cor}"></i><b>${esc(cli.nome)}</b>${[['atrasada', 'a'], ['hoje', 'h'], ['aprovar', 'p']].map(([k, c]) => cli.por?.[k] ? `<span class="m ${c}" title="${{ atrasada: 'atrasadas', hoje: 'saem hoje', aprovar: 'para aprovar' }[k]}">${cli.por[k]}</span>` : '').join('')}<span class="n" style="--c:${cli.cor}" title="em aberto">${cli.total}</span>`, distMax: Infinity, prioridade: (cli.peso || 0) + 10, fixo: true,
          aoClicar: () => aoClicar?.({ tipo: 'cliente', nome: cli.nome }) }));
        posicoes.push({ nome: cli.nome, x: raiz.position.x, z: raiz.position.z });
      });
      grupo.add(raiz);
    });
    // Lotes sem cliente: terreno gramado com árvores (espaço para crescer).
    const vazio = new Obra();
    for (const lote of livres) {
      const y = irece.alturaEm(lote.x, lote.z);
      vazio.caixa(lote.x, y, lote.z, 7, .08, 7, '#9CCB7A');
      if (ruido(lote.x | 0, lote.z | 0) > .35) vazio.arvore(lote.x - 1.5, y + .08, lote.z + 1, { s: 1.1 }).arvore(lote.x + 1.8, y + .08, lote.z - 1.4, { s: .8, fruta: '#F7C948' });
    }
    grupo.add(vazio.montar());
    return posicoes;
  }
  return { definir };
}
