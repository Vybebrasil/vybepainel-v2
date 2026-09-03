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

// Emoji de tempo e uma loteria: cada sistema desenha o seu, com contorno
// proprio e cor propria, e no meio de uma barra monocromatica um adesivo
// colorido salta como corpo estranho. Estes sao desenhados em linha, herdam a
// cor do texto e tem todos o mesmo peso.
const TOPO_TRACO = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const NUVEM = `<path d="M6.2 17h8.6a3.4 3.4 0 0 0 .3-6.8A5 5 0 0 0 5.6 11 3 3 0 0 0 6.2 17Z" ${TOPO_TRACO}/>`;
const TOPO_DESENHO = {
  sol: `<circle cx="12" cy="12" r="4" ${TOPO_TRACO}/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" ${TOPO_TRACO}/>`,
  solNuvem: `<circle cx="8.5" cy="6.6" r="2.5" ${TOPO_TRACO}/><path d="M8.5 1.7v1.3M4.4 2.5l.9.9M2.2 6.6h1.3M12.6 2.5l-.9.9" ${TOPO_TRACO}/>${NUVEM}`,
  nuvem: NUVEM,
  chuva: `${NUVEM}<path d="M9 19.5 8.2 21.5M13 19.5l-.8 2M17 19.5l-.8 2" ${TOPO_TRACO}/>`,
  tempestade: `${NUVEM}<path d="m12.4 18-2 2.9h2.6l-1.8 2.8" ${TOPO_TRACO}/>`,
  neblina: `<path d="M4 9h13M6 13h13M4 17h11" ${TOPO_TRACO}/>`,
  neve: `${NUVEM}<path d="M9 20h.01M13 20h.01M11 22h.01M15 22h.01" ${TOPO_TRACO} stroke-width="2.4"/>`,
};

function iconeDoCeu(qual) {
  return `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">${TOPO_DESENHO[qual] || TOPO_DESENHO.nuvem}</svg>`;
}

const TOPO_CEU = {
  0:  ['sol', 'céu limpo'],          1:  ['solNuvem', 'sol entre nuvens'],
  2:  ['solNuvem', 'parcialmente nublado'], 3: ['nuvem', 'nublado'],
  45: ['neblina', 'neblina'],        48: ['neblina', 'neblina'],
  51: ['chuva', 'garoa'],            53: ['chuva', 'garoa'],  55: ['chuva', 'garoa forte'],
  61: ['chuva', 'chuva fraca'],      63: ['chuva', 'chuva'],  65: ['chuva', 'chuva forte'],
  66: ['chuva', 'chuva gelada'],     67: ['chuva', 'chuva gelada'],
  71: ['neve', 'neve'],              73: ['neve', 'neve'],    75: ['neve', 'neve forte'],
  80: ['chuva', 'pancadas'],         81: ['chuva', 'pancadas'], 82: ['tempestade', 'pancadas fortes'],
  95: ['tempestade', 'tempestade'],  96: ['tempestade', 'tempestade'], 99: ['tempestade', 'tempestade'],
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

// Tres numeros do mesmo tamanho brigando entre si escondiam a historia: com 67
// atrasadas de 76, o "1 para hoje" nao e uma informacao ao lado — e um detalhe
// de rodape. A barra passa a dizer UMA coisa, com uma medida embaixo: quanto da
// fila esta vencido. Os outros numeros ficam, em voz baixa.
//
// Trocar o HTML inteiro a cada trinta segundos jogaria fora a animacao no meio
// dela e trocaria o elemento debaixo do cursor. Monta uma vez, depois so troca
// o que mudou — e o que mudou ganha uma batida.
function pintarKpisDoTopo() {
  const caixa = document.getElementById('topo-fila');
  if (!caixa) return;
  const k = kpisDoTopo();
  if (!k) {
    if (caixa.dataset.montado !== '1') caixa.innerHTML = '<span class="topo-fila-vazio">Carregando sua fila…</span>';
    return;
  }

  if (caixa.dataset.montado !== '1') {
    caixa.innerHTML = `<span class="topo-fila-frase">
        <b id="topo-fila-num">0</b><span id="topo-fila-rotulo"></span></span>
      <span class="topo-fila-medida"><i id="topo-fila-cheio"></i></span>`;
    caixa.dataset.montado = '1';
  }

  const atrasadas = k.atrasadas;
  const parte = k.abertas ? Math.round((atrasadas / k.abertas) * 100) : 0;
  // Sem nada vencido a barra nao tem por que gritar: ela conta a fila, e nao o
  // atraso, e a medida fica no tom neutro.
  const rotulo = atrasadas
    ? ` atrasada${atrasadas === 1 ? '' : 's'} de ${k.abertas}${k.hoje ? ` · ${k.hoje} para hoje` : ''}`
    : ` na fila${k.hoje ? ` · ${k.hoje} para hoje` : ' · nada vencido'}`;

  caixa.classList.toggle('em-atraso', atrasadas > 0);
  caixa.title = atrasadas
    ? `${atrasadas} de ${k.abertas} com prazo vencido — abrir o Modo Foco`
    : `${k.abertas} na sua fila — abrir o Modo Foco`;
  caixa.onclick = () => chooseFocusUser(String(k.user.id));

  const cheio = document.getElementById('topo-fila-cheio');
  if (cheio) cheio.style.width = `${atrasadas ? Math.max(parte, 3) : 0}%`;
  document.getElementById('topo-fila-rotulo').textContent = rotulo;

  const numero = document.getElementById('topo-fila-num');
  const valor = String(atrasadas || k.abertas);
  if (numero.textContent === valor) return;
  numero.textContent = valor;
  caixa.classList.remove('mudou');
  // Forcar o layout entre tirar e por reinicia a animacao; sem isso, dois
  // valores seguidos so animariam o primeiro.
  void caixa.offsetWidth;
  caixa.classList.add('mudou');
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
    const [desenho, texto] = TOPO_CEU[t.codigo] || ['nuvem', 'tempo'];
    alvo.innerHTML = `<span class="topo-clima-icone">${iconeDoCeu(desenho)}</span>
      <b>${t.grau}<i>°</i></b><span class="topo-clima-onde">${safeText(lugar.nome)} · ${texto}</span>`;
  } catch {
    // Sem internet ou serviço fora: a barra continua servindo para hora, data e
    // fila. Um erro no tempo não pode deixar buraco no topo.
    alvo.innerHTML = `<span class="topo-clima-icone">${iconeDoCeu('nuvem')}</span>`
      + '<span class="topo-clima-onde">tempo indisponível</span>';
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
