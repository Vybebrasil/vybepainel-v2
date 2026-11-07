// Relógio e prioridade das vans, independentes do fuso do aparelho.
const formatoBahia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function relogioBahia(data = new Date()) {
  const p = Object.fromEntries(formatoBahia.formatToParts(data).map(({ type, value }) => [type, value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, minutos: +p.hour * 60 + +p.minute + +p.second / 60 };
}
export function minutosDoHorario(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
}
export function horarioDaCaptacao(cap) {
  const ini = minutosDoHorario(cap.inicio);
  let fim = minutosDoHorario(cap.fim) ?? (ini == null ? null : ini + 60);
  if (ini != null && fim < ini) fim += 1440;
  return { ini, fim };
}
export function priorizarCaptacoes(lista, agora = relogioBahia()) {
  const prioridade = (c) => {
    const { ini, fim } = horarioDaCaptacao(c);
    if (ini == null) return [2, 0];
    if (ini <= agora.minutos && agora.minutos < fim) return [0, fim];
    return ini > agora.minutos ? [1, ini] : [3, -fim];
  };
  return lista.filter((c) => !c.dia || c.dia === agora.dia).map((cap, i) => ({ cap, i, p: prioridade(cap) }))
    .sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1] || a.i - b.i).map(({ cap }) => cap);
}
export function faseDaVan(v, t, agora = relogioBahia()) {
  if (v.ini == null) {
    const ida = v.total / 7, ciclo = ida * 2 + 8, tc = (t + v.fase) % ciclo;
    return { d: tc < ida ? tc * 7 : tc < ida + 4 ? v.total : tc < ida * 2 + 4 ? v.total - (tc - ida - 4) * 7 : 0, volta: tc >= ida + 4 && tc < ida * 2 + 4, fase: '' };
  }
  // A lista recebida é do dia; depois da virada, uma van antiga não reinicia.
  const dias = v.dia ? (Date.parse(agora.dia + 'T00:00:00Z') - Date.parse(v.dia + 'T00:00:00Z')) / 86400000 : 0;
  const m = agora.minutos + dias * 1440;
  if (v.dia && v.dia > agora.dia || m < v.ini - 30) return { d: 0, volta: false, fase: 'espera' };
  if (m < v.ini) return { d: v.total * (m - (v.ini - 30)) / 30, volta: false, fase: 'indo' };
  if (m < v.fim) return { d: v.total, volta: false, fase: 'gravando' };
  if (m < v.fim + 30) return { d: v.total * (1 - (m - v.fim) / 30), volta: true, fase: 'voltando' };
  return { d: 0, volta: true, fase: 'feita' };
}
