// Auditório: teatro com camarote (plano do Paulo, 18/10/2026). Palco elevado
// no fundo, com a tela, púlpito, refletores e luzes de palco; plateia de poltronas vermelhas em degraus de 1 nível (o Habbo sobe
// direto), com corredor no eixo da porta; camarote de poltronas pretas na
// parede da esquerda, um degrau acima do foyer; no foyer da porta,
// bilheteria, pipoca e a cabine de projeção no eixo da tela.
import { novaCena } from "../escritorio-construcao.mjs";

const FIGURAS = {
  palestrante: "hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110",
  plateia1: "hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62",
  plateia2: "hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62",
  camarote: "hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110",
  bilheteiro: "hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62",
};

export default function auditorio() {
  const s = novaCena("auditorio");
  s.colecao({ poltrona: "theatre_seat", camarote: "theatre_seat_b", tela: "cine_screen", refletor: "spotlight",
pulpito: "uni_lectern", bilheteria: "cine_ticket_booth", pipoca: "cine_popcorn" }, {
    acentos: ["xmas_c16_woodtile", "theatre_carpet", "theatre_plant", "cine_light1", "cine_light2", "studio_lights1", "lodge_dark_divider", "doormat_plain", "habw_mirror", "cine_bench"],
  });
  s.casca(null, 1, ["xmas_c16_woodtile", 0]);

  // --- Palco (nível 1, y 0–3): cortina, tela, púlpito, refletores ---
  s.canto("palco", { funcao: "apresentar para a plateia", destaque: "cine_screen" });
  s.por("cine_screen", 7, 0, { olha: [9, 6] });
  // Púlpito no canto esquerdo do palco: a plateia vê a tela e o camarote vê quem fala.
  s.por("uni_lectern", 2, 2, { olha: [9, 10] });
  s.figurante({ figura: FIGURAS.palestrante, x: 3, y: 2, dir: 4 });
  s.por("spotlight", 6, 3, { olha: [9, 1] });
  s.por("spotlight", 13, 3, { olha: [10, 1] });
  // Sem treliças de luz penduradas na frente da tela (Paulo, 19/10/2026:
  // dominavam o palco); a luz vem dos refletores e das arandelas.
  s.parede("fundo", { de: 2.5, ate: 4.5, altura: 1.6 }, ["cine_light2", "cine_light1", "cine_light2"]);
  s.parede("fundo", { de: 15.5, ate: 18, altura: 1.6 }, ["cine_light2", "cine_light1", "cine_light2"]);
  s.parede("fundo", { de: 18, ate: 20, altura: 1 }, ["habw_mirror"]);

  // --- Plateia: três fileiras, cada uma no seu degrau, corredor no meio ---
  s.canto("plateia", { funcao: "assistir sentado", destaque: "theatre_seat" });
  const lugares = [];
  for (const y of [5, 7, 9, 11]) for (const x of [5, 6, 7, 8, 11, 12, 13, 14]) lugares.push(s.assento("theatre_seat", x, y, [x, 0]));
  s.figurante({ figura: FIGURAS.plateia1, sentado: lugares[1] });
  s.figurante({ figura: FIGURAS.plateia2, sentado: lugares[13] });
  // Passadeira vermelha no corredor, ladrilho a ladrilho (cada um no seu degrau).
  for (let y = 4; y < 16; y++) for (const x of [9, 10]) if (y !== 15) s.por("theatre_carpet", x, y);
  s.parede("esquerda", { de: 2, ate: 4, altura: 2.6 }, ["cine_light2", "cine_light1"]);

  // --- Camarote na parede da esquerda (nível 5), guarda-corpo na beira ---
  s.canto("camarote", { funcao: "assistir do alto", destaque: "theatre_seat_b" });
  for (const y of [5, 7, 9, 11]) s.por("lodge_dark_divider", 2, y, { dir: 6 });
  const cam = [];
  for (const y of [6, 8, 10]) for (const x of [0, 1]) cam.push(s.assento("theatre_seat_b", x, y, [x, 0]));
  s.figurante({ figura: FIGURAS.camarote, sentado: cam[3] });
  s.parede("esquerda", { de: 6, ate: 14, altura: 1.8 }, ["cine_light2", "cine_light1", "cine_light2", "cine_light1"]);

  // --- Foyer da porta: bilheteria, pipoca, projeção no eixo ---
  s.canto("foyer", { funcao: "comprar o ingresso e esperar a sessão", destaque: "cine_ticket_booth" });
  s.por("cine_ticket_booth", 6, 14, { olha: [6, 16] });
  s.figurante({ figura: FIGURAS.bilheteiro, x: 7, y: 14, dir: 4 });
  s.por("cine_popcorn", 4, 14, { dir: 4 });
  // Bancos de espera no foyer, dos dois lados do corredor.
  s.assento("cine_bench", 12, 14, [13, 10]);
  s.por("theatre_plant", 18, 5);
  s.por("theatre_plant", 18, 9);
  s.por("theatre_plant", 3, 15);
  s.parede("esquerda", { de: 14, ate: 16, altura: 1 }, ["habw_mirror"]);
  s.por("theatre_plant", 16, 15);
  // Projetores soltos no chão do corredor saíram: pareciam largados ali.
  return s.fechar();
}
