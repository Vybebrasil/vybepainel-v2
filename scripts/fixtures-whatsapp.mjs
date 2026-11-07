// WhatsApp interno na prévia local (dados fictícios): o mesmo formato da central (server/vybes-whatsapp.js valida igual),
// com volume parecido com o de verdade (9 grupos internos, clientes, mídia, menções, mensagem apagada) e uma mensagem nova a
// cada 30 s, para ver não lidas, aviso na tela e notificação sem o PC do Paulo. Nada de dado real aqui.
import { createHash } from 'node:crypto';
import { validarCaixa } from '../server/vybes-whatsapp.js';

const INICIO = Date.now();
const id = (n) => createHash('sha256').update('demo-wa:' + n).digest('hex').slice(0, 20);
const GRUPOS = [
  ['Produção', 'interno'], ['Correção', 'interno'], ['Saída de Publicações', 'interno'], ['#VYBE - Criação', 'interno'],
  ['Atendimento & Planejamento', 'interno'], ['VYBE - Geral', 'interno'], ['Mídia Paga', 'interno'], ['Diretoria', 'interno'], ['Vybe CEO', 'interno'],
  ['#Vybe - Padaria Demonstração', 'cliente', 'Padaria Demonstração'], ['#Vybe - Clínica Exemplo', 'cliente', 'Clínica Exemplo'],
  ['#VYBE - Loja Teste', 'cliente', 'Loja Teste'], ['#Vybe - Academia Modelo', 'cliente', 'Academia Modelo'], ['Vybe - Restaurante Fictício', 'cliente', 'Restaurante Fictício'],
];
const EQUIPE = ['Design demonstração', 'Edição demonstração', 'Atendimento demonstração', 'Produção demonstração', 'VYBES'];
const FALAS = [
  ['texto', null, 'Subi a arte do carrossel na pasta, quem puder revisar 🙏'],
  ['imagem', '📷 Foto', 'Versão 2 com o logo maior'],
  ['texto', null, 'Cliente pediu pra trocar a foto da capa e manter o texto.'],
  ['audio', '🎤 Áudio', ''],
  ['texto', null, 'Combinado! Sai amanhã às 9h.'],
  ['documento', '📄 Documento', 'briefing-novembro.pdf'],
  ['texto', null, 'Alguém consegue cobrir a captação de quinta à tarde? A agenda tá apertada e o cliente pediu pra ser no fim do dia, depois das 17h, por causa da luz.'],
  ['video', '🎥 Vídeo', 'Corte final do reels'],
];
// Número de ordem único e crescente no tempo, como o da central: as antigas primeiro, e uma nova a cada 30 s num grupo.
function todas() {
  const passos = Math.floor((Date.now() - INICIO) / 30000), brutas = [];
  GRUPOS.forEach((g, gi) => { const n = 18 + (gi % 5) * 4; for (let i = 0; i < n; i++) brutas.push({ gi, i, em: INICIO - (n - i) * 47 * 60e3 - gi * 3 * 60e3 }); });
  for (let k = 1; k <= passos; k++) brutas.push({ gi: (k * 5) % GRUPOS.length, i: 100 + k, em: INICIO + k * 30000 });
  return brutas.sort((a, b) => a.em - b.em).map(({ gi, i, em }, s) => {
    const g = GRUPOS[gi], [tipo, midia, texto] = FALAS[(i + gi) % FALAS.length];
    const autor = g[1] === 'cliente' && i % 3 === 0 ? 'Cliente ' + g[2].split(' ')[0] : EQUIPE[(i + gi) % EQUIPE.length];
    const paraVoce = i % 7 === 3, minha = i % 5 === 1;
    return { gi, m: { seq: s + 1, em, autor: minha ? 'Operador de teste' : autor, minha, vybes: !minha && autor === 'VYBES',
      tipo, midia, texto: paraVoce ? '@Operador de teste ' + (texto || 'pode olhar?') : texto, mencoes: paraVoce ? ['Operador de teste'] : [], paraVoce: paraVoce && !minha,
      citada: i % 6 === 5 ? 'Subi a arte do carrossel na pasta' : null, apagada: i % 13 === 12, editada: i % 11 === 10 } };
  });
}
export function demoWhatsapp(url) {
  const tudo = todas();
  const conversas = GRUPOS.map((g, gi) => ({ g, gi, id: id(gi), msgs: tudo.filter((x) => x.gi === gi).map((x) => x.m).slice(-120) }));
  const seq = Math.max(...conversas.flatMap((c) => c.msgs.map((m) => m.seq)));
  const base = { ok: true, somenteLeitura: true, geradoEm: new Date().toISOString(), gruposLidosEm: new Date(INICIO).toISOString(), seq,
    eu: { nome: 'Operador de teste', pessoa: '1', socio: true, vinculado: true } };
  const alvo = url.searchParams.get('conversa');
  if (alvo) {
    const c = conversas.find((x) => x.id === alvo);
    if (!c) return [404, { error: 'Conversa não encontrada ou fora dos seus grupos.' }];
    return [200, validarCaixa({ ...base, conversa: { id: c.id, nome: c.g[0], tipo: c.g[1], cliente: c.g[2] || null, mensagens: c.msgs } }, { conversa: alvo })];
  }
  const corte = (t) => String(t || '').replace(/\s+/g, ' ').slice(0, 110);
  const lista = conversas.map((c) => { const u = c.msgs.at(-1); return { id: c.id, nome: c.g[0], tipo: c.g[1], cliente: c.g[2] || null, total: c.msgs.length,
    ultima: { seq: u.seq, em: u.em, autor: u.autor, minha: u.minha, apagada: u.apagada, midia: u.midia, texto: u.apagada ? '' : corte(u.texto) },
    recebidas: c.msgs.filter((m) => !m.minha && !m.apagada).slice(-60).map((m) => m.seq) }; }).sort((a, b) => b.ultima.em - a.ultima.em);
  const mencoes = conversas.flatMap((c) => c.msgs.filter((m) => m.paraVoce && !m.apagada).map((m) => ({ ...m, conversa: c.id, grupo: c.g[0], texto: corte(m.texto) })))
    .sort((a, b) => b.seq - a.seq).slice(0, 50);
  return [200, validarCaixa({ ...base, conversas: lista, mencoes })];
}
