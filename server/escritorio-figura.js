// Figura do boneco do Escritório (Habbo) a partir das escolhas do perfil, ou a figura que a pessoa colou. A mesma regra
// de mapaFigura (vybe-escritorio-mapa.js): quem nunca montou o personagem fica com o boneco padrão, como no mapa.
// Usada pelo VYBES para mostrar o bonequinho de cada pessoa da equipe (Paulo, 03/11/2026).
const PELE = { clara: 1, media: 8, escura: 14 };
const ROUPA = { laranja: 1408, azul: 82, verde: 1335, roxo: 92, rosa: 1321, grafite: 64 };
const COLADA = /^[a-z]{2}-\d+(-\d+){0,2}(\.[a-z]{2}-\d+(-\d+){0,2})*$/;
export function figuraDoPerfil(preferencias) {
  let perfil = preferencias;
  if (typeof perfil === "string") { try { perfil = JSON.parse(perfil); } catch { perfil = {}; } }
  perfil = perfil && typeof perfil === "object" ? perfil : {};
  if (perfil.figura && COLADA.test(perfil.figura)) return perfil.figura;
  const pele = PELE[perfil.pele] || 8;
  const roupa = ROUPA[perfil.roupa] || 1408;
  const cabelo = { curto: "hr-828-61", longo: "hr-515-45", cacheado: "hr-3163-45", sem: "" }[perfil.cabelo || "curto"] ?? "hr-828-61";
  const corpo = perfil.cabelo === "longo" ? `hd-600-${pele}.ch-665-${roupa}.lg-700-82.sh-725-62` : `hd-180-${pele}.ch-255-${roupa}.lg-280-110.sh-305-62`;
  return [corpo, cabelo].filter(Boolean).join(".");
}
