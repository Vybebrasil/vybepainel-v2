// Decide se a Vercel monta este commit (o "Ignored Build Step" do vercel.json).
// Decisão do Paulo, 21/10/2026: a conta da Vercel vinha quase toda dos minutos
// de construção (91 montagens num dia, uma por correção dentro de cada PR).
// Produção sempre monta. Versão de teste (preview) só quando o commit pede,
// com "[preview]" na mensagem: a última correção antes de publicar.
// Saída 1 = montar; saída 0 = pular (é a convenção da Vercel).
const ambiente = process.env.VERCEL_ENV || '';
const mensagem = process.env.VERCEL_GIT_COMMIT_MESSAGE || '';
const montar = ambiente === 'production' || /\[preview\]/i.test(mensagem);
console.log(montar ? `Montando (${ambiente || 'sem ambiente'}).` : 'Versão de teste pulada: ponha [preview] na mensagem do commit para montar.');
process.exit(montar ? 1 : 0);
