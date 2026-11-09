// FICHA DO BAR DA SINUCA: números, tacos, conquistas e títulos de cada um.
//
// Paulo, 04/11/2026: "os tacos fodas também têm que aparecer no perfil de cada
// jogador... ver os troféus que o outro cara tem". Paulo, 08/11/2026: "quero
// que tenha mais conquistas... alguns engraçados, alguns fodas", "pense nas
// conquistas e títulos negativos também (perdedor, azarão...)" e "zera as
// vitórias e os tacos de cada um (o que tiver no histórico que for de
// conquista pode deixar)".
//
// Tudo sai das partidas terminadas (sem tabela nova). As partidas novas da
// regra de bar guardam os números de cada lado em mesa.stats (escritorio-
// sinuca.js: bolas seguidas, suicidas, cegadas, saída...); as antigas não têm,
// então só valem para as conquistas de resultado.
//
// ZERADO (SINUCA_ZERADA_EM): vitórias, derrotas, ranking, sequência, tacos e,
// desde 09/11/2026 (Paulo: "zera as conquistas, vitórias, derrotas"), também as
// conquistas contam só as partidas terminadas a partir daí. Nada é apagado.
export const SINUCA_ZERADA_EM = '2026-11-09T05:00:00.000Z';
// Os testes antigos gravam partidas com now(): eles trocam a data por aqui.
export const sinucaZeradaEm = () => process.env.VYBE_SINUCA_ZERADA_EM || SINUCA_ZERADA_EM;
export const TACOS_SINUCA = ['casa', 'bronze', 'prata', 'ouro', 'lenda'];

// Raridade: comum, raro, épico e lendário (as boas) e zoeira (as que ninguém
// quer ter, mas todo bar tem). O título de cada um é a conquista mais rara;
// o apelido é a zoeira mais pesada que ele carrega.
export const RARIDADES = { comum: 1, raro: 2, epico: 3, lendario: 4 };

// [chave, ícone, nome, como se ganha, raridade, teste(dados)]. O teste devolve
// verdadeiro ou o número de vezes (aparece "×3" na ficha).
const CATALOGO = [
 // Resultado (vale a história toda).
 ['primeira', '🎱', 'Primeira vitória', 'Ganhou uma partida da equipe', 'comum', (d) => d.vit],
 ['ze', '🧢', 'Derrubou o Zé', 'Venceu o Zé do Taco', 'comum', (d) => d.bots.facil],
 ['tio', '🍺', 'Derrubou o Tio', 'Venceu o Tio do Boteco', 'raro', (d) => d.bots.medio],
 ['baianinho', '👑', 'Derrubou o Baianinho', 'Venceu o Baianinho', 'lendario', (d) => d.bots.lendario],
 ['embalado', '🔥', 'Embalado', '3 vitórias seguidas', 'comum', (d) => d.maiorSeq >= 3],
 ['imparavel', '⚡', 'Imparável', '5 vitórias seguidas', 'raro', (d) => d.maiorSeq >= 5],
 ['dono-da-rua', '🦁', 'Dono da rua', '10 vitórias seguidas', 'lendario', (d) => d.maiorSeq >= 10],
 ['valendo', '💰', 'Valendo', 'Ganhou partida apostada', 'comum', (d) => d.valendo],
 ['tubarao', '🦈', 'Tubarão', 'Ganhou 5 partidas valendo moedas', 'epico', (d) => d.valendo >= 5],
 ['veterano', '🎯', 'Veterano', '25 vitórias na equipe', 'raro', (d) => d.vit >= 25],
 ['cem', '🏛️', 'Patrimônio do bar', '100 vitórias na equipe', 'lendario', (d) => d.vit >= 100],
 ['frequentador', '🪑', 'Cadeira cativa', 'Jogou 50 partidas', 'comum', (d) => d.jogos >= 50],
 ['dono', '🏆', 'Dono do salão', '1º no ranking da sinuca', 'epico', (d) => d.posicao === 1],
 ['carrasco', '🪓', 'Carrasco', 'Ganhou 5 seguidas do mesmo adversário', 'epico', (d) => d.carrasco],
 ['azarao', '🐴', 'Azarão', 'Venceu quem tinha o dobro das suas vitórias', 'raro', (d) => d.azarao],
 ['gigante', '🗿', 'Matador de gigante', 'Venceu o 1º do ranking', 'epico', (d) => d.gigante],
 ['madrugada', '🌙', 'Coruja do boteco', 'Ganhou uma partida depois da meia-noite', 'comum', (d) => d.madrugada],
 // Jogo jogado (só as partidas com os números da mesa).
 ['saida', '💥', 'Saída matadora', 'Matou 2 bolas na saída', 'raro', (d) => d.saida2],
 ['saida3', '☄️', 'Saída de cinema', 'Matou 3 bolas ou mais na saída', 'epico', (d) => d.saida3],
 ['dois', '🐇', 'Dois coelhos', '2 bolas suas numa tacada só', 'comum', (d) => d.uma2],
 ['tres', '🎆', 'Três de uma vez', '3 bolas suas numa tacada só', 'epico', (d) => d.uma3],
 ['cinco', '🖐️', 'Cinco seguidas', 'Matou 5 bolas seguidas sem errar', 'raro', (d) => d.seq5],
 ['fominha', '😤', 'Fominha', 'Matou 7 bolas seguidas sem errar', 'epico', (d) => d.seq7],
 ['mesa-limpa', '🧹', 'Mesa limpa', 'Ganhou matando o grupo e o ás sem passar a vez', 'lendario', (d) => d.mesaLimpa],
 ['virada', '🔄', 'Virada histórica', 'Ganhou estando 4 bolas atrás', 'epico', (d) => d.virada],
 ['pneu', '🛞', 'Deu um pneu', 'Ganhou sem o outro matar nenhuma bola', 'raro', (d) => d.deuPneu],
 ['limpinho', '🧼', 'Jogo limpo', 'Ganhou sem fazer nenhuma falta', 'raro', (d) => d.semFalta],
 ['relampago', '⏱️', 'Relâmpago', 'Ganhou com 12 tacadas ou menos', 'epico', (d) => d.relampago],
 // Rodada de 09/11/2026 (Paulo: "adicionar mais conquistas positivas e negativas").
 ['quatro', '🎰', 'Quádrupla', '4 bolas suas numa tacada só', 'lendario', (d) => d.uma4],
 ['sniper', '🔭', 'Sniper', 'Ganhou matando em 6 de cada 10 tacadas (8 tacadas ou mais)', 'epico', (d) => d.sniper],
 ['paredao', '🧱', 'Paredão', 'Ganhou sem falta enquanto o outro fez 3 ou mais', 'raro', (d) => d.paredao],
 ['vinganca', '🗡️', 'Vingança', 'Ganhou de quem tinha te vencido 3 vezes seguidas', 'raro', (d) => d.vinganca],
 ['rodou', '🗺️', 'Rodou o bar', 'Venceu 5 adversários diferentes', 'raro', (d) => d.adversarios >= 5],
 ['desmontou', '🤖', 'Desmontou o bar', 'Venceu os três bots da casa', 'epico', (d) => d.bots.facil && d.bots.medio && d.bots.lendario],
 ['banqueiro', '🏦', 'Banqueiro', 'Ganhou 1.000 VybeCoins somando as partidas valendo', 'epico', (d) => d.ganhoMoedas >= 1000],
 ['maratona', '🏃', 'Maratonista', 'Ganhou uma partida de 30 tacadas suas ou mais', 'comum', (d) => d.maratona],
 ['cafe', '☕', 'Café com taco', 'Ganhou uma partida antes das 9h', 'comum', (d) => d.cafe],
 ['happy', '🍻', 'Happy hour', 'Ganhou numa sexta depois das 18h', 'comum', (d) => d.happy],
 // Zoeira: as que ninguém quer, mas todo bar tem.
 ['pe-frio', '🧊', 'Pé-frio', '5 derrotas seguidas', 'zoeira', (d) => d.maiorDerrotas >= 5],
 ['saco', '🥊', 'Saco de pancada', '20 derrotas na equipe', 'zoeira', (d) => d.der >= 20],
 ['fregues', '🛒', 'Freguês', 'Perdeu 5 seguidas para o mesmo adversário', 'zoeira', (d) => d.fregues],
 ['zebra', '🦓', 'Deu zebra', 'Perdeu para quem tinha metade das suas vitórias', 'zoeira', (d) => d.zebrado],
 ['levou-pneu', '🍩', 'Tomou um pneu', 'Perdeu sem matar nenhuma bola', 'zoeira', (d) => d.levouPneu],
 ['praia', '🏖️', 'Morreu na praia', 'Perdeu com só o ás faltando', 'zoeira', (d) => d.praia],
 ['apressado', '🏃', 'Apressadinho', 'Matou o ás antes da hora e perdeu', 'zoeira', (d) => d.asCedo],
 ['kamikaze', '🪂', 'Kamikaze', 'Suicida logo na saída', 'zoeira', (d) => d.saidaSuic],
 ['mao-alface', '🥬', 'Mão de alface', '3 suicidas numa partida só', 'zoeira', (d) => d.suic3],
 ['cego', '🦯', 'Cego do bar', 'Cegou 3 vezes numa partida só', 'zoeira', (d) => d.cego3],
 ['caridoso', '🎁', 'Papai Noel', 'Matou 3 bolas do outro numa partida', 'zoeira', (d) => d.caridoso],
 ['arregao', '🏳️', 'Arregão', 'Desistiu de uma partida', 'zoeira', (d) => d.desistiu],
 ['dormiu', '😴', 'Dormiu no ponto', 'Perdeu por tempo ou sumiu da mesa', 'zoeira', (d) => d.dormiu],
 ['pato', '🦆', 'Pato', 'Perdeu 3 partidas valendo moedas', 'zoeira', (d) => d.valendoPerdeu >= 3],
 ['amarelou', '🐔', 'Amarelou', 'Perdeu estando 4 bolas na frente', 'zoeira', (d) => d.amarelou],
 ['quase', '😬', 'Bateu na trave', 'Perdeu com só uma bola sua e o ás faltando', 'zoeira', (d) => d.quase],
 ['mira-torta', '🙈', 'Mira torta', 'Errou 15 tacadas numa partida só', 'zoeira', (d) => d.miraTorta],
 ['cartao', '🟨', 'Cartão amarelo', '5 faltas numa partida só', 'zoeira', (d) => d.faltas5],
 ['fregues-bot', '🔌', 'Freguês da máquina', 'Perdeu 5 vezes para os bots', 'zoeira', (d) => d.botsPerdeu >= 5],
 ['insonia', '🦉', 'Insônia', 'Perdeu uma partida depois da meia-noite', 'zoeira', (d) => d.insonia],
 ['chinelo', '🩴', 'Pé de chinelo', '10 partidas na equipe sem nenhuma vitória', 'zoeira', (d) => d.jogos >= 10 && d.vit === 0],
];
// O peso de cada zoeira para escolher o apelido (a mais vergonhosa primeiro).
const PESO_ZOEIRA = { chinelo: 10, 'levou-pneu': 9, amarelou: 9, fregues: 8, quase: 6, cartao: 5, 'mira-torta': 4, 'fregues-bot': 3, insonia: 2, 'mao-alface': 7, praia: 7, arregao: 6, zebra: 6, 'pe-frio': 5, kamikaze: 5, cego: 4, apressado: 4, caridoso: 3, pato: 3, saco: 2, dormiu: 1 };
// Os títulos que aparecem embaixo do nome, pela conquista mais rara.
const TITULOS = { 'mesa-limpa': 'O Faxineiro', baianinho: 'Matador de Lenda', 'dono-da-rua': 'Dono da Rua', cem: 'Patrimônio do Bar', dono: 'Dono do Salão', 'saida3': 'Canhão da Saída',
 tres: 'Mão de Ouro', fominha: 'O Fominha', virada: 'Rei da Virada', relampago: 'O Relâmpago', carrasco: 'O Carrasco', gigante: 'Matador de Gigante', tubarao: 'Tubarão do Bar',
 imparavel: 'Imparável', veterano: 'Veterano', tio: 'Freguês do Tio', azarao: 'O Azarão', pneu: 'Borracheiro', limpinho: 'Jogo Limpo', saida: 'Saída Matadora', cinco: 'Mão Quente',
 quatro: 'O Caça-Níquel', sniper: 'Sniper', desmontou: 'Desmanche', banqueiro: 'Banqueiro', paredao: 'Paredão', vinganca: 'O Vingador', rodou: 'Rodado',
 maratona: 'Maratonista', cafe: 'Madrugador', happy: 'Rei do Happy Hour',
 embalado: 'Embalado', ze: 'Aprendiz', dois: 'Dois Coelhos', valendo: 'Apostador', frequentador: 'Cadeira Cativa', madrugada: 'Coruja', primeira: 'Estreante' };

const ordem = (iso) => (iso ? new Date(iso).getTime() : 0);
const horaBahia = (iso) => (new Date(new Date(iso).getTime() - 3 * 3600e3)).getUTCHours();

// `partidas`: as terminadas da sinuca, 1×1 (sem dupla), com desafiante,
// desafiado, resultado, motivo, bot, moedas, terminado_em e stats
// ({desafiante, desafiado} de mesa.stats). Pode trazer partidas de outras
// pessoas: servem para saber quantas vitórias o adversário tinha na hora.
// `posicao`: a posição no ranking (que já conta só depois de zerar).
export function fichaSinuca(id, partidas, posicao = null, { desde = null } = {}) {
 id = String(id);
 const corte = desde ? ordem(desde) : 0;
 const lista = [...partidas].filter((l) => ordem(l.terminado_em) >= corte).sort((a, b) => ordem(a.terminado_em) - ordem(b.terminado_em));
 // Vitórias de cada um até cada partida (para azarão e zebra) e o líder na hora.
 const vitAte = new Map(), lider = { id: null, v: 0 };
 let vit = 0, der = 0, seq = 0, maior = 0, valendo = 0;     // depois de zerar
 const d = { vit: 0, der: 0, jogos: 0, maiorSeq: 0, maiorDerrotas: 0, valendo: 0, valendoPerdeu: 0, bots: { facil: 0, medio: 0, lendario: 0 }, botsZerado: { facil: 0, medio: 0, lendario: 0 }, posicao: null,
  carrasco: false, fregues: false, azarao: 0, zebrado: 0, gigante: 0, madrugada: 0, saida2: 0, saida3: 0, uma2: 0, uma3: 0, seq5: 0, seq7: 0, mesaLimpa: 0, virada: 0, deuPneu: 0, semFalta: 0, relampago: 0,
  levouPneu: 0, praia: 0, asCedo: 0, saidaSuic: 0, suic3: 0, cego3: 0, caridoso: 0, desistiu: 0, dormiu: 0,
  uma4: 0, sniper: 0, paredao: 0, vinganca: 0, adversarios: 0, ganhoMoedas: 0, maratona: 0, cafe: 0, happy: 0, amarelou: 0, quase: 0, miraTorta: 0, faltas5: 0, botsPerdeu: 0, insonia: 0,
  tTot: 0, bTot: 0, fTot: 0, seqMax: 0, saidaMax: 0, nStats: 0 };
 const vencidos = new Set();
 let seqT = 0, derT = 0;
 const contra = new Map();     // sequência contra cada adversário: + ganhando, - perdendo
 for (const l of lista) {
  const a = l.desafiante != null ? String(l.desafiante) : null, b = l.desafiado != null ? String(l.desafiado) : null;
  const meu = a === id ? 'desafiante' : b === id ? 'desafiado' : null;
  const venc = l.resultado === 'desafiante' ? a : l.resultado === 'desafiado' ? b : null;
  const perd = l.resultado === 'desafiante' ? b : l.resultado === 'desafiado' ? a : null;
  const vAntes = (p) => vitAte.get(p) || 0, liderAntes = lider.id;
  if (!l.bot && venc && perd) { vitAte.set(venc, vAntes(venc) + 1); if (vitAte.get(venc) > lider.v) { lider.id = venc; lider.v = vitAte.get(venc); } }
  if (!meu || !l.resultado) continue;
  const ganhou = l.resultado === meu, depois = ordem(l.terminado_em) >= corte, outroLado = meu === 'desafiante' ? 'desafiado' : 'desafiante';
  const st = l.stats?.[meu], so = l.stats?.[outroLado];
  // Números da mesa (valem contra bot também).
  if (st) {
   d.tTot += st.t || 0; d.bTot += st.b || 0; d.fTot += st.faltas || 0; d.nStats++;
   d.seqMax = Math.max(d.seqMax, st.maxSeq || 0); d.saidaMax = Math.max(d.saidaMax, st.saida || 0);
   if (st.saida >= 2 && st.saida < 3) d.saida2++; if (st.saida >= 3) d.saida3++;
   if (st.uma >= 2) d.uma2++; if (st.uma >= 3) d.uma3++;
   if (st.maxSeq >= 5) d.seq5++; if (st.maxSeq >= 7) d.seq7++;
   if (st.uma >= 4) d.uma4++; if ((st.t || 0) - (st.b || 0) >= 15) d.miraTorta++; if (st.faltas >= 5) d.faltas5++;
   if (st.saidaSuic) d.saidaSuic++; if (st.suic >= 3) d.suic3++; if (st.cego >= 3) d.cego3++; if (st.outro >= 3) d.caridoso++;
   if (ganhou) {
    if (st.maxVis >= 8) d.mesaLimpa++;
    if (st.atras >= 4) d.virada++;
    if (so && so.b === 0) d.deuPneu++;
    if (st.faltas === 0) d.semFalta++;
    if (st.t <= 12) d.relampago++;
    if (st.t >= 8 && st.b / st.t >= 0.6) d.sniper++;
    if (st.faltas === 0 && so && so.faltas >= 3) d.paredao++;
    if (st.t >= 30) d.maratona++;
   } else if (l.resultado !== 'empate') {
    if (st.b === 0) d.levouPneu++;
    if (st.restam === 0) d.praia++;
    if (st.restam === 1) d.quase++;
    if (so && so.atras >= 4) d.amarelou++;
   }
  }
  if (!ganhou && l.resultado !== 'empate') {
   if (l.motivo === 'um-cedo' && l.stats?.[meu]) d.asCedo++;
   if (l.motivo === 'desistencia') d.desistiu++;
   if (l.motivo === 'tempo' || l.motivo === 'abandono') d.dormiu++;
  }
  if (l.bot) {
   const nivel = String(l.bot).split(':')[1];
   if (ganhou && nivel in d.bots) { d.bots[nivel]++; if (depois) d.botsZerado[nivel]++; }
   if (!ganhou && l.resultado !== 'empate') d.botsPerdeu++;
   continue;
  }
  if (l.resultado === 'empate') { seq = 0; seqT = 0; derT = 0; continue; }
  const adv = ganhou ? perd : venc;
  d.jogos++;
  const c = contra.get(adv) || 0;
  if (ganhou) {
   d.vit++; seqT++; derT = 0; d.maiorSeq = Math.max(d.maiorSeq, seqT);
   if (Number(l.moedas) > 0) { d.valendo++; d.ganhoMoedas += Number(l.moedas); }
   if (c <= -3) d.vinganca++;
   vencidos.add(adv); d.adversarios = vencidos.size;
   if (l.terminado_em) { const h = horaBahia(l.terminado_em), dia = new Date(ordem(l.terminado_em) - 3 * 3600e3).getUTCDay(); if (h >= 5 && h < 9) d.cafe++; if (dia === 5 && h >= 18) d.happy++; }
   contra.set(adv, c > 0 ? c + 1 : 1); if (contra.get(adv) >= 5) d.carrasco = true;
   if (vAntes(adv) >= 3 && vAntes(adv) >= 2 * Math.max(1, vAntes(id) - 1)) d.azarao++;
   if (liderAntes && liderAntes === adv) d.gigante++;
   if (l.terminado_em && horaBahia(l.terminado_em) < 5) d.madrugada++;
  } else {
   d.der++; derT++; seqT = 0; d.maiorDerrotas = Math.max(d.maiorDerrotas, derT);
   if (Number(l.moedas) > 0) d.valendoPerdeu++;
   if (l.terminado_em && horaBahia(l.terminado_em) < 5) d.insonia++;
   contra.set(adv, c < 0 ? c - 1 : -1); if (contra.get(adv) <= -5) d.fregues = true;
   // Quem perdeu era o favorito: o vencedor tinha metade (ou menos) das vitórias dele.
   const minhas = vAntes(id), dele = vAntes(adv) - 1;
   if (minhas >= 4 && dele * 2 <= minhas) d.zebrado++;
  }
  if (depois) {
   if (ganhou) { vit++; seq++; maior = Math.max(maior, seq); if (Number(l.moedas) > 0) valendo++; } else { der++; seq = 0; }
  }
 }
 const pos = vit ? posicao : null;
 d.posicao = pos;
 const tem = { casa: true, bronze: (pos && pos <= 8) || vit >= 5, prata: (pos && pos <= 3) || d.botsZerado.medio > 0, ouro: pos === 1 || vit >= 25, lenda: d.botsZerado.lendario > 0 };
 const tacos = TACOS_SINUCA.filter((t) => tem[t]);
 const trofeus = CATALOGO.map(([chave, icone, nome, texto, raridade, teste]) => {
  const v = teste(d), n = typeof v === 'number' ? v : v ? 1 : 0;
  return { chave, icone, nome, texto, raridade, zoeira: raridade === 'zoeira', tem: n > 0, vezes: n };
 });
 const boas = trofeus.filter((t) => t.tem && !t.zoeira).sort((x, y) => RARIDADES[y.raridade] - RARIDADES[x.raridade]);
 const zoeiras = trofeus.filter((t) => t.tem && t.zoeira).sort((x, y) => (PESO_ZOEIRA[y.chave] || 0) - (PESO_ZOEIRA[x.chave] || 0));
 const titulo = boas.length ? { chave: boas[0].chave, nome: TITULOS[boas[0].chave] || boas[0].nome, raridade: boas[0].raridade, texto: boas[0].texto, icone: boas[0].icone } : null;
 const apelido = zoeiras.length ? { chave: zoeiras[0].chave, nome: zoeiras[0].nome, icone: zoeiras[0].icone, texto: zoeiras[0].texto } : null;
 // ATRIBUTOS DA CARTA (Paulo, 08/11/2026: "quero tudo parecendo JOGO"): a ficha
 // vira carta de jogador com nota geral e seis atributos de 30 a 99, tirados das
 // partidas que têm os números da mesa (sem números, um meio-termo).
 const lim = (v) => Math.max(30, Math.min(99, Math.round(v)));
 const jogosTodos = d.vit + d.der;
 const atributos = {
  pre: d.tTot ? lim(30 + (d.bTot / d.tTot) * 120) : 50,
  seq: d.nStats ? lim(35 + d.seqMax * 9) : 50,
  sai: d.nStats ? lim(40 + d.saidaMax * 18) : 50,
  lim: d.tTot ? lim(99 - (d.fTot / d.tTot) * 150) : 60,
  vit: jogosTodos ? lim(30 + (100 * d.vit / jogosTodos) * 0.69) : 50,
  exp: lim(30 + jogosTodos * 2.3),
 };
 const nota = Math.round(Object.values(atributos).reduce((a, b) => a + b, 0) / 6);
 return { id, nota, atributos, vitorias: vit, derrotas: der, jogos: vit + der, posicao: pos, sequencia: seq, maior_sequencia: maior, valendo, bots: d.bots, tacos, taco: tacos[tacos.length - 1], trofeus,
  destaques: boas.slice(0, 3).map((t) => t.chave), titulo, apelido, historico: { vitorias: d.vit, derrotas: d.der }, zerada_em: desde };
}
