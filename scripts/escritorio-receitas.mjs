// Receitas de canto: a camada do designer de interiores do motor (decisão
// do Paulo em 18/10/2026: "um arquiteto e um designer de interiores", não
// "vários objetos jogados na sala"). Cada receita monta uma composição
// conhecida, com as peças da coleção da sala (s.colecao) pedidas pelo
// papel, e com as relações entre elas feitas por construção: na frente de,
// ladeando, simétrico, virado para. Tudo passa pelas regras do motor
// (scripts/escritorio-construcao.mjs): apoio, frente conferida, caminho.
import { pegadaDe, dirDaFrente } from "./escritorio-construcao.mjs";

// Lareira no meio de um trecho de parede (fundo, y = 0, ou esquerda, x = 0),
// duas poltronas na frente dela, uma de cada lado, viradas para o fogo;
// tapete no eixo; abajur de pé junto de cada poltrona e o mesmo grupo de
// itens de parede dos dois lados (espelhado). em: primeiro ladrilho da
// lareira ao longo da parede.
export function estarLareira(s, { nome = "lareira", funcao = "conversar perto do fogo", x, em = x, parede = "fundo", tapete = true, abajures = true, arte = null, alturaArte = 1.2, folga = 1 }) {
  const lareira = s.de("lareira"), poltrona = s.de("poltrona");
  if (!lareira || !poltrona) return null;
  s.canto(nome, { funcao, destaque: lareira });
  // ao(a, b): a ao longo da parede, b saindo dela para a sala.
  const ao = (a, b) => (parede === "fundo" ? [a, b] : [b, a]);
  const fora = parede === "fundo" ? [0, 1] : [1, 0];
  const d = dirDaFrente(lareira, fora[0], fora[1]), [pw, ph] = pegadaDe(lareira, d), lw = parede === "fundo" ? pw : ph;
  if (tapete && s.tem("tapete")) { const [ax, ay] = ao(em - 1, 1), [bx, by] = ao(em + lw, 2); s.tapete(s.de("tapete"), Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)); }
  s.por(lareira, ...ao(em, 0), { dir: d });
  // Cada poltrona olha ao longo da parede, para a frente da lareira (na
  // parede da esquerda, olhar para o canto da lareira virava para a parede).
  const esq = s.assento(poltrona, ...ao(em - 1, 1), ao(em, 1));
  const dir = s.assento(poltrona, ...ao(em + lw, 1), ao(em + lw - 1, 1));
  if (abajures && s.tem("abajur")) { s.por(s.de("abajur"), ...ao(em - 2, 1)); s.por(s.de("abajur"), ...ao(em + lw + 1, 1)); }
  // Parede: o mesmo grupo de itens dos dois lados, em trechos de 3 ladrilhos
  // a "folga" ladrilhos da lareira (o desenho dela passa do ladrilho),
  // espelhado: o de dentro fica perto do fogo.
  if (arte) {
    const grupo = [arte].flat();
    const antes = parede === "fundo" ? grupo : [...grupo].reverse(), depois = parede === "fundo" ? [...grupo].reverse() : grupo;
    s.parede(parede, { de: em - 3 - folga, ate: em - folga, altura: alturaArte }, antes);
    s.parede(parede, { de: em + lw + folga, ate: em + lw + 3 + folga, altura: alturaArte }, depois);
  }
  return { esq, dir };
}

// Mesa longa de reunião: tampos lado a lado no eixo x a partir de (x, y),
// cadeiras nos dois lados compridos e nas cabeceiras, todas viradas para a
// mesa; lustre no centro; na frente de cada lugar, o que a pessoa usa
// (alternando o que se pede em "porLugar"); telas viradas para os lugares
// pedidos (índice do lugar).
// passo: de quantos em quantos ladrilhos vai uma cadeira (2 deixa folga entre
// os lugares; com cadeira executiva larga, 1 virava uma parede de encostos).
export function mesaReuniao(s, { nome = "mesa de reunião", funcao = "reunir a equipe", x, y, tampos = 2, porLugar = [], telas = [], centro = [], passo = 1 }) {
  const mesa = s.de("mesa"), cadeira = s.de("cadeira");
  if (!mesa || !cadeira) return null;
  s.canto(nome, { funcao, destaque: mesa });
  const [mw, mh] = pegadaDe(mesa, 0), comp = mw * tampos;
  for (let i = 0; i < tampos; i++) s.por(mesa, x + i * mw, y);
  const lugares = [];
  // Lugares centrados no comprimento da mesa.
  const sobra = (comp - 1) % passo, ini = Math.floor(sobra / 2);
  for (let i = ini; i < comp; i += passo) {
    lugares.push({ cad: s.assento(cadeira, x + i, y - 1, [x + i, y]), mesa: [x + i, y] });
    lugares.push({ cad: s.assento(cadeira, x + i, y + mh, [x + i, y + mh - 1]), mesa: [x + i, y + mh - 1] });
  }
  s.assento(cadeira, x - 1, y, [x, y]);
  s.assento(cadeira, x + comp, y + mh - 1, [x + comp - 1, y + mh - 1]);
  if (s.tem("lustre")) s.pendente(s.de("lustre"), x + Math.floor((comp - 1) / 2), y);
  telas.forEach((i) => { const l = lugares[i]; s.emCima(l.mesa[0], l.mesa[1], s.de("tela"), { olha: [l.cad.x, l.cad.y] }); });
  const usados = new Set(telas.map((i) => lugares[i].mesa.join(",")));
  for (const [cx, cy, c] of centro) if (!usados.has(`${cx},${cy}`)) { usados.add(`${cx},${cy}`); s.emCima(cx, cy, c); }
  let k = 0;
  for (const l of lugares) {
    const kk = l.mesa.join(",");
    if (usados.has(kk) || !porLugar.length) continue;
    usados.add(kk);
    s.emCima(l.mesa[0], l.mesa[1], porLugar[k++ % porLugar.length]);
  }
  return lugares;
}

// Recepção de frente para a porta: balcão com a frente virada para quem
// chega, atendente em pé atrás, tela virada para o atendente, plantas iguais
// dos dois lados do balcão (simétrico).
// pecas: quantas peças de balcão lado a lado (balcão de módulos de 1).
export function recepcao(s, { nome = "recepção", funcao = "receber quem chega", x, y, porta, atendente, sobre = [], pecas = 1 }) {
  const balcao = s.de("balcao");
  if (!balcao) return null;
  s.canto(nome, { funcao, destaque: balcao });
  let larg = 0, it = null;
  for (let i = 0; i < pecas; i++) { it = s.por(balcao, x + larg, y, { olha: porta }); if (!it) return null; larg += it.pw; }
  const meio = x + Math.floor((larg - 1) / 2);
  if (s.tem("tela")) s.emCima(meio, y, s.de("tela"), { olha: [meio, y - 1] });
  sobre.forEach(([dx, c]) => s.emCima(x + dx, y, c));
  if (atendente) s.figurante({ figura: atendente, x: meio, y: y - 1, dir: 4 });
  if (s.tem("planta")) { s.por(s.de("planta"), x - 1, y); s.por(s.de("planta"), x + larg, y); }
  return it;
}
