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

// ---------- Roteiro da semana: juntar as captações por dia e bairro (só sugestão; a agenda não muda) ----------
// Paulo, 07/11/2026: economizar o deslocamento da vanzinha. Para cada dia com 2 ou mais captações,
// diz onde elas caem ("Terça: 3 captações no Centro e na Lagoa — junte num roteiro") e a ordem
// sugerida pelo vizinho mais próximo, saindo da Vybe e voltando a ela. Posições em células do
// mundo (1 célula = 10 m), as mesmas dos pinos dos clientes.
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const RUA = /^(r\.|rua\b|av\.?\b|avenida\b|tv\.?\b|travessa\b|pra[cç]a\b|p[cç]a\.?\b|rod\.?\b|rodovia\b|estrada\b|alameda\b)/i;
const NAO_BAIRRO = /\d|irec[eê]|bahia|^ba$|cep|andar|sala\b|loja\b|ltda|center|centro comercial|shopping|edif|galeria|complexo|fora de/i;

// O bairro no fim do endereço ("R. Lafaiete Coutinho, 217 - Alto do Moura" → "Alto do Moura").
// Só confia quando o endereço tem uma rua e o bairro vem num trecho separado.
export function bairroDoEndereco(endereco) {
  const partes = String(endereco || '').split(/\s+[-–]\s+/).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2 || !partes.some((p) => RUA.test(p))) return '';
  for (let i = partes.length - 1; i >= 0; i--) if (!RUA.test(partes[i]) && !NAO_BAIRRO.test(partes[i])) return partes[i];
  return '';
}
const preposicao = (bairro) => (/a$/i.test(String(bairro).split(/\s+/)[0]) ? 'na' : 'no');
const listaComE = (l) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);
export function nomeDoDia(dia) {
  const d = new Date(`${dia}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(dia || '') : DIAS_SEMANA[d.getUTCDay()];
}
const distancia = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function percurso(origem, pontos) {
  let total = 0, atual = origem;
  for (const p of pontos) { total += distancia(atual, p); atual = p; }
  return pontos.length ? total + distancia(atual, origem) : 0;
}
// Vizinho mais próximo, saindo da origem (a Vybe).
export function ordemPorVizinho(origem, pontos) {
  const resto = [...pontos], ordem = [];
  let atual = origem;
  while (resto.length) {
    let k = 0;
    for (let i = 1; i < resto.length; i++) if (distancia(atual, resto[i]) < distancia(atual, resto[k])) k = i;
    atual = resto.splice(k, 1)[0]; ordem.push(atual);
  }
  return ordem;
}
const km = (celulas) => Math.round(celulas / 10) / 10; // 1 célula = 10 m

/**
 * @param {Array} eventos agenda de area=captacoes ({ dia, tipo, cliente, inicio, local })
 * @param {object} [op]
 * @param {Function} [op.pontoDe] (cliente) → { x, z, bairro? } | null
 * @param {{x:number,z:number}} [op.origem] a Vybe
 * @param {string} [op.desde] AAAA-MM-DD: ignora dias anteriores
 */
export function roteirosDaSemana(eventos = [], { pontoDe = () => null, origem = { x: 0, z: 0 }, desde = '' } = {}) {
  const porDia = new Map();
  for (const e of eventos || []) {
    if (e?.tipo !== 'captacao' || !e.cliente || !e.dia || (desde && e.dia < desde)) continue;
    if (!porDia.has(e.dia)) porDia.set(e.dia, []);
    porDia.get(e.dia).push(e);
  }
  const dias = [], diasDoBairro = new Map();
  for (const [dia, lista] of [...porDia].sort(([a], [b]) => a.localeCompare(b))) {
    const paradas = lista.map((e) => {
      const p = pontoDe(e.cliente) || null;
      const bairro = String(p?.bairro || bairroDoEndereco(e.local) || '').trim();
      return { cliente: e.cliente, inicio: e.inicio || '', bairro, x: p?.x, z: p?.z, noMapa: Number.isFinite(p?.x) && Number.isFinite(p?.z) };
    });
    // Bairros do dia, na ordem em que mais aparecem; o nome com acento vence o sem acento.
    const bairros = new Map();
    for (const p of paradas) {
      if (!p.bairro) continue;
      const k = semAcento(p.bairro), b = bairros.get(k) || { nome: p.bairro, n: 0 };
      if (/[^\x00-\x7F]/.test(p.bairro) && !/[^\x00-\x7F]/.test(b.nome)) b.nome = p.bairro;
      b.n++; bairros.set(k, b);
      if (!diasDoBairro.has(k)) diasDoBairro.set(k, { nome: b.nome, dias: new Set() });
      diasDoBairro.get(k).dias.add(dia); if (/[^\x00-\x7F]/.test(b.nome)) diasDoBairro.get(k).nome = b.nome;
    }
    if (paradas.length < 2) continue;
    const nomes = [...bairros.values()].sort((a, b) => b.n - a.n).map((b) => `${preposicao(b.nome)} ${b.nome}`);
    const rotulo = nomeDoDia(dia);
    const frase = `${rotulo}: ${paradas.length} captações${nomes.length ? ' ' + listaComE(nomes) : ''} — junte num roteiro`;
    const comPonto = paradas.filter((p) => p.noMapa), semPonto = paradas.filter((p) => !p.noMapa);
    const ordem = [...ordemPorVizinho(origem, comPonto), ...semPonto];
    const pelaHora = [...comPonto].sort((a, b) => (a.inicio || '99:99').localeCompare(b.inicio || '99:99'));
    const sugerido = percurso(origem, ordem.filter((p) => p.noMapa)), naAgenda = percurso(origem, pelaHora);
    dias.push({ dia, rotulo, quantas: paradas.length, bairros: nomes, frase,
      ordem: ordem.map(({ cliente, bairro, inicio, noMapa }) => ({ cliente, bairro, inicio, noMapa })),
      km: km(sugerido), economia: comPonto.length > 1 ? Math.max(0, km(naAgenda - sugerido)) : 0, semMapa: semPonto.length });
  }
  // O mesmo bairro em dias diferentes: dá para juntar num dia só?
  const juntar = [...diasDoBairro.values()].filter((b) => b.dias.size > 1).map((b) => {
    const nomesDias = [...b.dias].sort().map((d) => { const n = nomeDoDia(d).toLowerCase(); return `${/^(s[aá]bado|domingo)$/.test(n) ? 'no' : 'na'} ${n}`; });
    return { bairro: b.nome, dias: [...b.dias].sort(), frase: `${b.nome} tem captação ${listaComE(nomesDias)}: dá para juntar num dia só?` };
  });
  return { dias, juntar };
}
