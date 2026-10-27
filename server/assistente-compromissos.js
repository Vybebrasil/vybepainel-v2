// Lembrete de compromisso pelo WhatsApp (Paulo, 27/10/2026: "sempre que tiver um compromisso na agenda, avisar a
// pessoa 1 hora antes e 30 minutos antes"). Fonte: o Google Agenda da Vybe, o mesmo do módulo de Captações.
// De quem é cada compromisso, pela convenção da agenda: azul é captação, a agenda real do Mizinho (Ademir); o resto
// (reunião, compromisso) é da agenda do Paulo, dona da conta. Quem é citado pelo nome no título também é avisado
// ("Reunião com Ewerton - Conecta"); nome que bate com duas pessoas (os dois Ewerton) não avisa ninguém por engano.
// Fica de fora: cancelado, dia inteiro, privado, folga, férias, aniversário e o que não é evento comum.
import vm from 'node:vm';
import { listarAgendaProducao, tipoNaAgenda } from './agenda-producao.js';
import { codigoDoPainel } from './assistente-rotinas.js';

const FUSO = 'America/Bahia';
const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const horaLocal = (v) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(v));
const diaLocal = (v) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(v));
// Apelidos da equipe (os mesmos do Escritório: DONOS_CADASTRO).
const APELIDOS = { mizinho: 'ADEMIR', bia: 'BEATRIZ', tai: 'TAINARA', taynara: 'TAINARA' };
export const JANELA_MIN = 75;

function dentro(e) {
  const t = normal(e.summary);
  return e.id && e.status !== 'cancelled' && e.visibility !== 'private' && e.start?.dateTime && e.end?.dateTime
    && (!e.eventType || e.eventType === 'default') && !/\b(pessoal|aniversario|niver|ferias|folga)\b/.test(t);
}

export async function compromissosProximos(sql, { agora = Date.now(), listar = listarAgendaProducao } = {}) {
  const hoje = diaLocal(agora), fim = agora + JANELA_MIN * 60e3;
  const { eventos = [] } = await listar(hoje, { dias: diaLocal(fim) === hoje ? 1 : 2, bruto: true });
  const proximos = eventos.filter((e) => dentro(e) && Date.parse(e.start.dateTime) > agora && Date.parse(e.start.dateTime) <= fim);
  if (!proximos.length) return [];
  const P = vm.runInContext('PESSOAS', codigoDoPainel().ctx);
  const equipe = await sql`SELECT nome, monday_user_id::text AS monday_id, COALESCE(admin, false) AS admin FROM vybe_pessoas WHERE ativo IS TRUE AND monday_user_id IS NOT NULL`;
  const porMonday = new Map(equipe.map((p) => [p.monday_id, p]));
  // Primeiro nome → pessoas com esse nome (dois Ewerton = ambíguo).
  const porNome = new Map();
  for (const p of equipe) { const n = normal(p.nome).split(/\s+/)[0]; if (n.length >= 3) porNome.set(n, [...(porNome.get(n) || []), p]); }
  for (const [apelido, chave] of Object.entries(APELIDOS)) { const p = porMonday.get(String(P[chave] || '')); if (p) porNome.set(apelido, [p]); }
  return proximos.map((e) => {
    const tipo = tipoNaAgenda(e);
    const donos = new Map();
    const dono = porMonday.get(String(tipo === 'captacao' ? P.ADEMIR : P.PAULO));
    if (dono) donos.set(dono.monday_id, dono);
    for (const palavra of normal(e.summary).split(/[^a-z0-9]+/)) {
      const achadas = porNome.get(palavra);
      if (achadas?.length === 1) donos.set(achadas[0].monday_id, achadas[0]);
    }
    return { id: e.id, titulo: String(e.summary || 'Compromisso').replace(/\s+/g, ' ').trim().slice(0, 200), tipo,
      inicio: new Date(e.start.dateTime).toISOString(), hora: horaLocal(e.start.dateTime), fim: horaLocal(e.end.dateTime),
      local: String(e.location || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      pessoas: [...donos.values()].map((p) => ({ monday_id: p.monday_id, nome: p.nome, admin: Boolean(p.admin) })) };
  }).filter((c) => c.pessoas.length);
}
