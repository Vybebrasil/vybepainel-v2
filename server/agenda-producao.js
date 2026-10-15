import { tokenGoogle } from '../vybe_drive.js';
const FUSO = 'America/Bahia';
const ESCOPO = 'https://www.googleapis.com/auth/calendar.events.readonly';
const normal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dataLocal = v => new Intl.DateTimeFormat('en-CA', { timeZone:FUSO,year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(v));
const horaLocal = v => new Intl.DateTimeFormat('pt-BR', { timeZone:FUSO,hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).format(new Date(v));
export function gravacoesDaAgenda(eventos) {
  const vistos = new Set();
  return eventos.filter(e => {
    if (!e.id || vistos.has(e.id) || e.status==='cancelled' || e.visibility==='private'
      || !/\b(gravacao|captacao|mizinho)\b/.test(normal(e.summary)) || !e.start || !e.end) return false;
    vistos.add(e.id); return true;
  }).map(e => ({ id:e.id,titulo:String(e.summary || '').replace(/\s+/g,' ').trim(),
    dia:e.start.date || dataLocal(e.start.dateTime),
    horario:e.start.date ? 'Dia inteiro · horário não informado' : `${horaLocal(e.start.dateTime)} às ${horaLocal(e.end.dateTime)}`,
    fimDia:e.end.dateTime ? dataLocal(e.end.dateTime) : '',local:String(e.location || '').replace(/\s+/g,' ').trim(),
  })).sort((a,b) => a.dia.localeCompare(b.dia) || a.horario.localeCompare(b.horario));
}
export async function listarAgendaProducao(dia, { buscar=fetch,obterToken=tokenGoogle } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia)) || !Number.isFinite(Date.parse(`${dia}T12:00:00Z`))
    || new Date(`${dia}T12:00:00Z`).toISOString().slice(0,10)!==dia) {
    throw Object.assign(new Error('Informe uma data válida.'), {status:400});
  }
  const fim=new Date(`${dia}T12:00:00Z`); fim.setUTCDate(fim.getUTCDate()+7);
  const calendarId=process.env.GOOGLE_CALENDAR_ID || 'gestaovybe@gmail.com';
  const token=await obterToken(ESCOPO);
  const params=new URLSearchParams({timeMin:`${dia}T00:00:00-03:00`,timeMax:`${fim.toISOString().slice(0,10)}T00:00:00-03:00`,
    singleEvents:'true',orderBy:'startTime',showDeleted:'false',timeZone:FUSO,maxResults:'250',
    fields:'items(id,summary,status,start,end,location,visibility),nextPageToken'});
  const eventos=[]; const paginas=new Set(); let pagina;
  do {
    if(pagina) params.set('pageToken',pagina);
    const r=await buscar(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw Object.assign(new Error([403,404].includes(r.status)
      ? 'O painel não tem acesso à agenda da Vybe. Confira o compartilhamento com a conta de serviço e a ativação da Calendar API.'
      : 'Não foi possível consultar o Google Agenda. Tente novamente.'),{status:502});
    const corpo=await r.json();
    if(!Array.isArray(corpo.items)) throw new Error('O Google Agenda retornou uma resposta inválida.');
    eventos.push(...corpo.items); pagina=corpo.nextPageToken;
    if(pagina && (paginas.has(pagina)||paginas.size>=20)) throw new Error('Não foi possível carregar toda a agenda. Tente novamente.');
    paginas.add(pagina);
  } while(pagina);
  return {ok:true,inicio:dia,fim:fim.toISOString().slice(0,10),fuso:FUSO,eventos:gravacoesDaAgenda(eventos)};
}
