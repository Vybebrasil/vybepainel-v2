/* ============================================================================
   BARRA DO TOPO DO PORTÃO
   ----------------------------------------------------------------------------
   A linha de cima do portão das estações dizia "CENTRAL OPERACIONAL // PRONTA"
   — uma frase que não informa nada. Agora ela carrega o que a pessoa quer saber
   antes de escolher onde vai trabalhar: que horas são, que dia é, quanto está
   pesando a fila dela e como está o tempo lá fora.

   Os números NÃO são calculados aqui. Quem sabe o que é "minha atividade" é o
   focusOwnItems, que o Modo Foco já usa — escrever a mesma regra de novo daria
   dois números diferentes para a mesma pergunta, que é como este painel junta
   bug.
   ========================================================================== */

// Irecê, BA — a cidade da Vybe. É o padrão porque abre com resposta na tela em
// vez de abrir com um pedido de permissão: quem estiver noutro lugar clica e
// troca, e a escolha fica guardada.
const TOPO_CASA = { lat: -11.3042, lon: -41.8558, nome: 'Irecê' };

const TOPO_CEU = {
  0:  ['☀️', 'céu limpo'],       1:  ['🌤️', 'sol entre nuvens'],
  2:  ['⛅', 'parcialmente nublado'], 3: ['☁️', 'nublado'],
  45: ['🌫️', 'neblina'],         48: ['🌫️', 'neblina'],
  51: ['🌦️', 'garoa'],           53: ['🌦️', 'garoa'],  55: ['🌦️', 'garoa forte'],
  61: ['🌧️', 'chuva fraca'],     63: ['🌧️', 'chuva'],  65: ['🌧️', 'chuva forte'],
  66: ['🌧️', 'chuva gelada'],    67: ['🌧️', 'chuva gelada'],
  71: ['🌨️', 'neve'],            73: ['🌨️', 'neve'],   75: ['🌨️', 'neve forte'],
  80: ['🌦️', 'pancadas'],        81: ['🌧️', 'pancadas'], 82: ['⛈️', 'pancadas fortes'],
  95: ['⛈️', 'tempestade'],      96: ['⛈️', 'tempestade'], 99: ['⛈️', 'tempestade'],
};

let TOPO_RELOGIO = null;
let TOPO_TEMPO = null;

/* ── hora e data ──────────────────────────────────────────────────────────── */

function pintarRelogioDoTopo() {
  const agora = new Date();
  const hora = document.getElementById('topo-hora');
  const data = document.getElementById('topo-data');
  if (hora) hora.textContent = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (data) {
    const texto = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    data.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
  }
}

/* ── os números de quem está logado ───────────────────────────────────────── */

// A sessão guarda nome e e-mail; a fila é indexada pelo id do Monday. Quem faz
// essa ponte é o pessoaPeloNome, que já existe e casa pelo primeiro nome.
function operadorDoTopo() {
  const eu = typeof pessoaLogada === 'function' ? pessoaLogada() : null;
  if (!eu?.nome || typeof pessoaPeloNome !== 'function') return null;
  const achado = pessoaPeloNome(eu.nome);
  return achado?.id ? achado : null;
}

function kpisDoTopo() {
  const user = operadorDoTopo();
  if (!user || typeof focusOwnItems !== 'function') return null;
  let meus = [];
  // A fila pode ainda não ter chegado quando o portão abre. Sem número é melhor
  // que número errado: a barra mostra travessão e se corrige no próximo minuto.
  try { meus = focusOwnItems(user) || []; } catch { return null; }
  if (!meus.length && !(typeof DADOS_ALL !== 'undefined' && DADOS_ALL?.length)) return null;

  const hoje = (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date().toISOString().slice(0, 10);
  const referencia = (d) => (typeof focusReferenceDate === 'function'
    ? focusReferenceDate(d, user) : (d.prazo_iso || d.veiculacao_iso || ''));
  return {
    user,
    abertas: meus.length,
    hoje: meus.filter((d) => referencia(d) === hoje).length,
    atrasadas: meus.filter((d) => d.prazo_atrasado).length,
  };
}

function pintarKpisDoTopo() {
  const caixa = document.getElementById('topo-kpis');
  if (!caixa) return;
  const k = kpisDoTopo();
  if (!k) {
    caixa.innerHTML = '<span class="topo-kpi-vazio">Carregando sua fila…</span>';
    return;
  }
  const bloco = (valor, rotulo, classe, dica) => `
    <button type="button" class="topo-kpi ${classe}" title="${dica}"
      onclick="chooseFocusUser('${String(k.user.id)}')">
      <b>${valor}</b><span>${rotulo}</span></button>`;
  caixa.innerHTML = bloco(k.abertas, 'na minha fila', '', 'Abrir o Modo Foco com a sua fila')
    + bloco(k.hoje, 'para hoje', k.hoje ? 'atencao' : '', 'Suas atividades com data de hoje')
    + bloco(k.atrasadas, 'atrasada' + (k.atrasadas === 1 ? '' : 's'),
        k.atrasadas ? 'critico' : '', 'Suas atividades com prazo vencido');
}

/* ── o tempo lá fora ──────────────────────────────────────────────────────── */

function ondeVerOTempo() {
  try {
    const guardado = JSON.parse(localStorage.getItem('vybeTopoLugar') || 'null');
    if (guardado?.lat && guardado?.lon) return guardado;
  } catch { /* localStorage bloqueado: fica a casa */ }
  return TOPO_CASA;
}

async function buscarTempoDoTopo(lugar) {
  const chave = `vybeTopoTempo:${lugar.lat.toFixed(2)},${lugar.lon.toFixed(2)}`;
  try {
    const guardado = JSON.parse(sessionStorage.getItem(chave) || 'null');
    // Meia hora: a temperatura não muda a cada abertura do portão, e cada
    // abertura seria uma consulta a mais sem nenhuma informação nova.
    if (guardado && Date.now() - guardado.em < 30 * 60 * 1000) return guardado.dados;
  } catch { /* segue e consulta */ }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lugar.lat}&longitude=${lugar.lon}`
    + '&current=temperature_2m,weather_code&timezone=auto';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`tempo indisponível (${r.status})`);
  const d = await r.json();
  const dados = {
    grau: Math.round(Number(d?.current?.temperature_2m)),
    codigo: Number(d?.current?.weather_code ?? 0),
  };
  if (!Number.isFinite(dados.grau)) throw new Error('resposta sem temperatura');
  try { sessionStorage.setItem(chave, JSON.stringify({ em: Date.now(), dados })); } catch { /* sem cache */ }
  return dados;
}

async function pintarTempoDoTopo() {
  const alvo = document.getElementById('topo-clima');
  if (!alvo) return;
  const lugar = ondeVerOTempo();
  alvo.title = lugar === TOPO_CASA
    ? 'Tempo em Irecê · clique para usar a sua localização'
    : 'Tempo onde você está · clique para voltar para Irecê';
  try {
    const t = await buscarTempoDoTopo(lugar);
    const [icone, texto] = TOPO_CEU[t.codigo] || ['🌡️', 'tempo'];
    alvo.innerHTML = `<span class="topo-clima-icone">${icone}</span>
      <b>${t.grau}°</b><span class="topo-clima-onde">${safeText(lugar.nome)} · ${texto}</span>`;
  } catch {
    // Sem internet ou serviço fora: a barra continua servindo para hora, data e
    // fila. Um erro no tempo não pode deixar buraco no topo.
    alvo.innerHTML = '<span class="topo-clima-icone">🌡️</span><span class="topo-clima-onde">tempo indisponível</span>';
  }
}

// Trocar entre a cidade da agência e onde a pessoa está. A permissão só é
// pedida quando ela clica — pedir na abertura seria uma caixa do navegador em
// cima de quem só queria escolher uma estação.
function usarMinhaLocalizacaoNoTopo() {
  if (ondeVerOTempo() !== TOPO_CASA) {
    try { localStorage.removeItem('vybeTopoLugar'); } catch { /* nada a fazer */ }
    return pintarTempoDoTopo();
  }
  if (!navigator.geolocation) return showToast('Este navegador não informa a localização.', 'info');
  showToast('Buscando onde você está…', 'info', 3000);
  navigator.geolocation.getCurrentPosition((pos) => {
    const lugar = { lat: Number(pos.coords.latitude.toFixed(4)),
                    lon: Number(pos.coords.longitude.toFixed(4)), nome: 'onde você está' };
    try { localStorage.setItem('vybeTopoLugar', JSON.stringify(lugar)); } catch { /* sem guardar */ }
    pintarTempoDoTopo();
  }, () => showToast('Não consegui a sua localização. Continua mostrando Irecê.', 'info', 6000),
    { timeout: 8000, maximumAge: 10 * 60 * 1000 });
}

/* ── liga e desliga ───────────────────────────────────────────────────────── */

function ligarBarraDoTopo() {
  pintarRelogioDoTopo();
  pintarKpisDoTopo();
  pintarTempoDoTopo();
  if (TOPO_RELOGIO) return;
  // Um relógio por minuto, e os números junto: a fila muda enquanto o portão
  // fica aberto na tela de quem foi tomar café.
  TOPO_RELOGIO = setInterval(() => { pintarRelogioDoTopo(); pintarKpisDoTopo(); }, 30_000);
}

function desligarBarraDoTopo() {
  if (!TOPO_RELOGIO) return;
  clearInterval(TOPO_RELOGIO);
  TOPO_RELOGIO = null;
}
