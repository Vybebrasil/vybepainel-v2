import { tokenGoogle } from '../vybe_drive.js';
const FUSO = 'America/Bahia';
const ESCOPO = 'https://www.googleapis.com/auth/calendar.events.readonly';
export function configuracaoAgenda() {
  let conta={};
  try {conta=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');} catch {}
  return {agenda:process.env.GOOGLE_CALENDAR_ID || 'gestaovybe@gmail.com',
    conta_servico:typeof conta.client_email==='string' && /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.gserviceaccount\.com$/.test(conta.client_email)?conta.client_email:null,
    projeto:typeof conta.project_id==='string' && /^[a-z0-9-]+$/.test(conta.project_id)?conta.project_id:null};
}
const normal = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dataLocal = v => new Intl.DateTimeFormat('en-CA', { timeZone:FUSO,year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(v));
const horaLocal = v => new Intl.DateTimeFormat('pt-BR', { timeZone:FUSO,hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).format(new Date(v));
// Captação pela cor do Google Agenda da Vybe (Paulo, 21/10/2026: "cada cor
// significa uma coisa e o azul é captação"): azul é a cor padrão da agenda
// (sem colorId) ou os azuis 1/7/9; amarelo (5) é reunião e grafite (8) é
// pessoal. Reunião, consulta e aniversário pintados de azul não contam, nem o
// freela do Mizinho.
const AZUIS = new Set(['', '1', '7', '9']);
export function ehCaptacaoNaAgenda(e) {
  const t = normal(e.summary);
  return AZUIS.has(String(e.colorId || '')) && !/^(reuniao|consulta|niver|aniversario|almoco|jantar)\b/.test(t)
    && !/\bmizinho\b.*\b(trabalha|freela|folga)\b/.test(t);
}
// O tipo de cada evento na agenda única (Captações e Escritório): captação
// pela cor azul, reunião pelo amarelo ou pelo título, o resto é compromisso.
export function tipoNaAgenda(e) {
  if (ehCaptacaoNaAgenda(e)) return 'captacao';
  return String(e.colorId || '') === '5' || /^(reuniao|call|alinhamento)\b/.test(normal(e.summary)) ? 'reuniao' : 'outro';
}
function horasNaSemana(e) {
  if (!e.start.dateTime || !e.end.dateTime) return { inicio:'', fim:'' };
  const inicio = horaLocal(e.start.dateTime), fim = horaLocal(e.end.dateTime);
  if (dataLocal(e.end.dateTime) === dataLocal(e.start.dateTime)) return { inicio, fim };
  return fim === '00:00' && (new Date(e.end.dateTime) - new Date(e.start.dateTime)) <= 864e5 ? { inicio, fim:'23:59' } : { inicio:'', fim:'' };
}
export function gravacoesDaAgenda(eventos) {
  const vistos = new Set();
  return eventos.filter(e => {
    if (!e.id || vistos.has(e.id) || e.status==='cancelled' || e.visibility==='private'
      || e.colorId==='5' || (e.eventType && e.eventType!=='default')
      || /\b(aguardo|pessoal|aniversario|ferias|folga)\b/.test(normal(e.summary)) || !e.start || !e.end) return false;
    vistos.add(e.id); return true;
  }).map(e => ({ id:e.id,cor:String(e.colorId || ''),captacao:ehCaptacaoNaAgenda(e),tipo:tipoNaAgenda(e),ambiguo:!/\b(gravacao|captacao)\b/.test(normal(e.summary)),titulo:String(e.summary || '').replace(/\s+/g,' ').trim(),
    dia:e.start.date || dataLocal(e.start.dateTime),
    // Evento que passa de um dia para o outro vai para a faixa "dia todo" da
    // semana (um aniversário de sábado a domingo não ocupa a coluna inteira).
    ...horasNaSemana(e),
    link:/^https:\/\/www\.google\.com\/calendar\//.test(String(e.htmlLink || '')) ? e.htmlLink : '',
    horario:e.start.date ? 'Dia inteiro · horário não informado' : `${horaLocal(e.start.dateTime)} às ${horaLocal(e.end.dateTime)}`,
    fimDia:e.end.dateTime ? dataLocal(e.end.dateTime) : '',local:String(e.location || '').replace(/\s+/g,' ').trim(),
  })).sort((a,b) => a.dia.localeCompare(b.dia) || a.horario.localeCompare(b.horario));
}
export async function listarAgendaProducao(dia, { buscar=fetch,obterToken=tokenGoogle,dias=6 } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia)) || !Number.isFinite(Date.parse(`${dia}T12:00:00Z`))
    || new Date(`${dia}T12:00:00Z`).toISOString().slice(0,10)!==dia) {
    throw Object.assign(new Error('Informe uma data válida.'), {status:400});
  }
  const fim=new Date(`${dia}T12:00:00Z`); fim.setUTCDate(fim.getUTCDate()+Math.min(31,Math.max(1,Number(dias)||6)));
  const calendarId=process.env.GOOGLE_CALENDAR_ID || 'gestaovybe@gmail.com';
  if(obterToken===tokenGoogle && !process.env.GOOGLE_SERVICE_ACCOUNT) {
    throw Object.assign(new Error('A integração do Google não está configurada no servidor. Cadastre GOOGLE_SERVICE_ACCOUNT na Vercel e compartilhe a agenda da Vybe com essa conta de serviço.'),{status:503,publica:true});
  }
  const token=await obterToken(ESCOPO);
  const params=new URLSearchParams({timeMin:`${dia}T00:00:00-03:00`,timeMax:`${fim.toISOString().slice(0,10)}T00:00:00-03:00`,
    singleEvents:'true',orderBy:'startTime',showDeleted:'false',timeZone:FUSO,maxResults:'250',
    fields:'items(id,summary,status,start,end,location,visibility,colorId,eventType,description,htmlLink),nextPageToken'});
  const eventos=[]; const paginas=new Set(); let pagina;
  do {
    if(pagina) params.set('pageToken',pagina);
    const r=await buscar(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw Object.assign(new Error([403,404].includes(r.status)
      ? 'O painel não tem acesso à agenda da Vybe. Confira o compartilhamento com a conta de serviço e a ativação da Calendar API.'
      : 'Não foi possível consultar o Google Agenda. Tente novamente.'),{status:502,publica:true});
    const corpo=await r.json();
    if(!Array.isArray(corpo.items)) throw new Error('O Google Agenda retornou uma resposta inválida.');
    eventos.push(...corpo.items); pagina=corpo.nextPageToken;
    if(pagina && (paginas.has(pagina)||paginas.size>=20)) throw new Error('Não foi possível carregar toda a agenda. Tente novamente.');
    paginas.add(pagina);
  } while(pagina);
  return {ok:true,inicio:dia,fim:fim.toISOString().slice(0,10),fuso:FUSO,eventos:gravacoesDaAgenda(eventos)};
}
