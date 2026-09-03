/* ============================================================================
   CALENDÁRIO DOS CAMPOS DE DATA
   ----------------------------------------------------------------------------
   O calendário que aparecia ao clicar num campo de data era o do navegador —
   branco, com a fonte do sistema, no meio de um painel escuro. Não dá para
   pintá-lo: nenhum navegador permite estilizar aquele painel. A única forma de
   mudá-lo é o painel ter o seu próprio, que é o que este arquivo é.

   Ele vale para TODO campo de data do painel, sem tocar em nenhum deles: um
   ouvinte na captura pega o clique em qualquer `input[type=date]`, segura o
   calendário do navegador e abre este no lugar.

   O que ele escreve volta pelo próprio campo, com os eventos `input` e `change`
   disparados — é assim que os `onchange="saveDaPlanningGridDeadline(...)"` e os
   `oninput="fcItemCampo(...)"` que já existem continuam funcionando sem saber
   que o calendário mudou.
   ========================================================================== */

const CAL_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const CAL_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

let CAL_CAMPO = null;   // o input que abriu
let CAL_MES = null;     // primeiro dia do mês na tela

function calHoje() {
  if (typeof HOJE_ISO === 'string' && HOJE_ISO) return HOJE_ISO;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Data em ISO sem passar por fuso: `new Date('2026-08-24')` é meia-noite UTC e
// vira 23 de agosto em Irecê. Aqui tudo é ano/mês/dia puro.
function calIso(ano, mes, dia) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
function calDoIso(iso) {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  return (a && m && d) ? { ano: a, mes: m - 1, dia: d } : null;
}
function calDiaDaSemana(ano, mes, dia) {
  return new Date(Date.UTC(ano, mes, dia)).getUTCDay();
}
function calDiasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function garantirEstilosDoCalendario() {
  if (document.getElementById('vybe-cal-estilos')) return;
  const s = document.createElement('style');
  s.id = 'vybe-cal-estilos';
  s.textContent = `
    /* O ícone do calendário do navegador some: quem abre agora é o nosso. */
    input[type="date"]::-webkit-calendar-picker-indicator{display:none!important;
      -webkit-appearance:none;appearance:none}

    .vcal{position:fixed;z-index:2400;width:284px;padding:14px 14px 12px;border-radius:18px;
      background:linear-gradient(168deg,rgba(30,27,24,.92),rgba(13,12,11,.95));
      backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);
      border:1px solid rgba(255,255,255,.12);
      box-shadow:0 34px 70px -24px rgba(0,0,0,.92), inset 0 1px 0 rgba(255,255,255,.1);
      font-family:var(--mac-ui,system-ui);opacity:0;transform:translateY(-6px) scale(.98);
      transition:opacity .16s cubic-bezier(.32,.72,0,1),transform .16s cubic-bezier(.32,.72,0,1)}
    .vcal.aberto{opacity:1;transform:none}

    .vcal-topo{display:flex;align-items:center;gap:6px;margin-bottom:12px}
    .vcal-mes{flex:1;min-width:0;color:#fff;font:600 14px var(--mac-ui);letter-spacing:-.3px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .vcal-passo{width:26px;height:26px;flex:none;display:grid;place-items:center;border:0;
      border-radius:8px;background:rgba(255,255,255,.06);color:#c9b49c;cursor:pointer;
      font-size:13px;line-height:1;transition:background .15s,color .15s}
    .vcal-passo:hover{background:rgba(255,255,255,.14);color:#fff}

    .vcal-semana{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px}
    .vcal-semana span{text-align:center;color:#7d6a58;font:600 9.5px var(--mac-ui);
      letter-spacing:.6px;text-transform:uppercase}

    .vcal-grade{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
    .vcal-dia{height:33px;display:grid;place-items:center;border:0;border-radius:9px;
      background:none;color:#e4d6c6;font:500 13px var(--mac-ui);cursor:pointer;
      font-variant-numeric:tabular-nums;
      transition:background .14s,color .14s,transform .14s}
    .vcal-dia:hover{background:rgba(255,255,255,.1)}
    .vcal-dia:active{transform:scale(.92)}
    .vcal-dia.fora{color:#5b4b3d}
    /* Hoje se marca com um ponto, não com um preenchimento: preenchimento é o
       que diz "escolhido", e os dois iguais confundem. */
    .vcal-dia.hoje{position:relative;color:#ffbf64;font-weight:700}
    .vcal-dia.hoje::after{content:'';position:absolute;bottom:5px;width:3px;height:3px;
      border-radius:999px;background:currentColor}
    .vcal-dia.escolhido{background:#ff8a1f;color:#160c03;font-weight:700}
    .vcal-dia.escolhido::after{background:#160c03}
    .vcal-dia.escolhido:hover{background:#ff9a3c}
    .vcal-dia:disabled{opacity:.25;cursor:default;background:none}
    .vcal-dia:focus-visible{outline:2px solid rgba(255,190,112,.9);outline-offset:1px}

    .vcal-pe{display:flex;gap:7px;margin-top:11px;padding-top:11px;
      border-top:1px solid rgba(255,255,255,.08)}
    .vcal-pe button{flex:1;border:1px solid rgba(255,255,255,.1);border-radius:9px;
      background:rgba(255,255,255,.04);color:#c9b49c;padding:6px 0;cursor:pointer;
      font:600 11px var(--mac-ui);transition:background .15s,color .15s}
    .vcal-pe button:hover{background:rgba(255,255,255,.11);color:#fff}
    .vcal-pe button.vcal-limpar:hover{background:rgba(255,92,124,.16);color:#ffd7de}

    @media(prefers-reduced-motion:reduce){.vcal{transition:none}.vcal-dia{transition:none}}`;
  document.head.appendChild(s);
}

function calDentroDoLimite(iso) {
  if (!CAL_CAMPO) return true;
  const min = CAL_CAMPO.getAttribute('min');
  const max = CAL_CAMPO.getAttribute('max');
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

function pintarCalendario() {
  const caixa = document.getElementById('vybe-cal');
  if (!caixa || !CAL_MES) return;
  const { ano, mes } = CAL_MES;
  const escolhido = CAL_CAMPO?.value || '';
  const hoje = calHoje();
  const primeiro = calDiaDaSemana(ano, mes, 1);
  const dias = calDiasNoMes(ano, mes);
  const antes = calDiasNoMes(ano, mes === 0 ? 11 : mes - 1);

  const celulas = [];
  // Os dias do mês anterior e do seguinte entram apagados: sem eles a primeira
  // semana fica com buracos, e buraco parece falta de dado.
  for (let i = primeiro - 1; i >= 0; i -= 1) celulas.push({ dia: antes - i, fora: -1 });
  for (let d = 1; d <= dias; d += 1) celulas.push({ dia: d, fora: 0 });
  while (celulas.length % 7) celulas.push({ dia: celulas.length - primeiro - dias + 1, fora: 1 });

  // So a primeira letra: com text-transform:capitalize saia "Agosto De 2026".
  const nomeDoMes = CAL_MESES[mes];
  caixa.querySelector('.vcal-mes').textContent =
    `${nomeDoMes[0].toUpperCase()}${nomeDoMes.slice(1)} de ${ano}`;
  caixa.querySelector('.vcal-grade').innerHTML = celulas.map((c) => {
    const m = mes + c.fora;
    const iso = calIso(m < 0 ? ano - 1 : m > 11 ? ano + 1 : ano, (m + 12) % 12, c.dia);
    const pode = calDentroDoLimite(iso);
    return `<button type="button" class="vcal-dia${c.fora ? ' fora' : ''}${
      iso === hoje ? ' hoje' : ''}${iso === escolhido ? ' escolhido' : ''}"
      data-iso="${iso}" ${pode ? '' : 'disabled'}
      aria-label="${c.dia} de ${CAL_MESES[(m + 12) % 12]}">${c.dia}</button>`;
  }).join('');
}

window.calAndarMes = function(passo) {
  if (!CAL_MES) return;
  const total = CAL_MES.mes + passo;
  CAL_MES = { ano: CAL_MES.ano + Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
  pintarCalendario();
};

// Escrever pelo campo, e não por baixo dele: os `onchange` e `oninput` que já
// existem em cada tela continuam sendo quem grava.
function calEscolher(iso) {
  if (!CAL_CAMPO) return;
  CAL_CAMPO.value = iso;
  CAL_CAMPO.dispatchEvent(new Event('input', { bubbles: true }));
  CAL_CAMPO.dispatchEvent(new Event('change', { bubbles: true }));
  fecharCalendario();
}

window.fecharCalendario = function() {
  const caixa = document.getElementById('vybe-cal');
  if (!caixa) return;
  caixa.classList.remove('aberto');
  setTimeout(() => caixa.remove(), 160);
  CAL_CAMPO = null;
  CAL_MES = null;
};

function abrirCalendarioNoCampo(campo) {
  garantirEstilosDoCalendario();
  document.getElementById('vybe-cal')?.remove();
  CAL_CAMPO = campo;
  const atual = calDoIso(campo.value) || calDoIso(calHoje());
  CAL_MES = { ano: atual.ano, mes: atual.mes };

  const caixa = document.createElement('div');
  caixa.id = 'vybe-cal';
  caixa.className = 'vcal';
  caixa.setAttribute('role', 'dialog');
  caixa.innerHTML = `
    <div class="vcal-topo">
      <button type="button" class="vcal-passo" onclick="calAndarMes(-1)" aria-label="Mês anterior">‹</button>
      <span class="vcal-mes"></span>
      <button type="button" class="vcal-passo" onclick="calAndarMes(1)" aria-label="Próximo mês">›</button>
    </div>
    <div class="vcal-semana">${CAL_SEMANA.map((d) => `<span>${d[0]}</span>`).join('')}</div>
    <div class="vcal-grade"></div>
    <div class="vcal-pe">
      <button type="button" class="vcal-hoje">Hoje</button>
      <button type="button" class="vcal-limpar">Limpar</button>
    </div>`;
  document.body.appendChild(caixa);

  caixa.querySelector('.vcal-grade').addEventListener('click', (e) => {
    const dia = e.target.closest('.vcal-dia');
    if (dia && !dia.disabled) calEscolher(dia.dataset.iso);
  });
  caixa.querySelector('.vcal-hoje').onclick = () => {
    const h = calHoje();
    if (calDentroDoLimite(h)) return calEscolher(h);
    const d = calDoIso(h);
    CAL_MES = { ano: d.ano, mes: d.mes };
    pintarCalendario();
  };
  caixa.querySelector('.vcal-limpar').onclick = () => calEscolher('');

  pintarCalendario();
  posicionarCalendario(campo, caixa);
  requestAnimationFrame(() => { if (CAL_CAMPO === campo) posicionarCalendario(campo, caixa); });
  requestAnimationFrame(() => caixa.classList.add('aberto'));
  setTimeout(() => caixa.classList.add('aberto'), 40);
}

// Abaixo do campo quando cabe; acima quando não cabe. E preso na tela nas
// laterais — um campo de data na ponta direita da tabela jogaria metade do
// calendário para fora.
function posicionarCalendario(campo, caixa) {
  const r = campo.getBoundingClientRect();
  const alt = caixa.offsetHeight || 332;
  const larg = caixa.offsetWidth || 284;
  // innerHeight pode vir zero — aba em segundo plano, painel escondido, janela
  // ainda montando. Zero fazia a conta do limite dar negativo e o calendario ia
  // parar no canto da tela, longe do campo que o abriu.
  const altura = window.innerHeight || document.documentElement.clientHeight || 0;
  const largura = window.innerWidth || document.documentElement.clientWidth || 0;
  const abaixo = altura - r.bottom;
  const topo = (!altura || abaixo >= alt + 10 || abaixo >= r.top) ? r.bottom + 6 : r.top - alt - 6;
  const teto = altura ? Math.min(topo, altura - alt - 8) : topo;
  const esquerda = largura ? Math.min(r.left, largura - larg - 8) : r.left;
  caixa.style.top = `${Math.max(8, teto)}px`;
  caixa.style.left = `${Math.max(8, esquerda)}px`;
}

/* ── a porta de entrada ─────────────────────────────────────────────────────
   Na captura, e no mousedown: o calendário do navegador abre no gesto de
   apertar, não no clique completo. Esperar o clique deixaria os dois na tela.  */
document.addEventListener('mousedown', (evento) => {
  const campo = evento.target?.closest?.('input[type="date"]');
  if (!campo || campo.disabled || campo.readOnly) return;
  // Uma tela que queira o calendário do navegador é só marcar o campo.
  if (campo.hasAttribute('data-calendario-nativo')) return;
  // Segurar o gesto e o que impede o calendario do navegador de aparecer junto.
  // Mas segurar o gesto tambem tira o foco do campo — e sem foco ninguem digita
  // a data, que continua sendo o caminho mais rapido para quem sabe o dia. Por
  // isso o foco e devolvido na mao: campo focado nao abre o painel do
  // navegador, so posiciona o cursor nos numeros.
  evento.preventDefault();
  evento.stopPropagation();
  campo.focus({ preventScroll: true });
  if (CAL_CAMPO === campo) return fecharCalendario();
  abrirCalendarioNoCampo(campo);
}, true);

// Digitou a data com o calendario aberto? O dia marcado acompanha, senao a tela
// mostraria um mes e o campo, outro.
document.addEventListener('input', (evento) => {
  if (CAL_CAMPO && evento.target === CAL_CAMPO) {
    const d = calDoIso(CAL_CAMPO.value);
    if (d) CAL_MES = { ano: d.ano, mes: d.mes };
    pintarCalendario();
  }
});

// Pelo teclado o campo continua sendo um campo: dá para digitar a data. Espaço
// e seta para baixo abrem o calendário, como num seletor de verdade.
document.addEventListener('keydown', (evento) => {
  const caixa = document.getElementById('vybe-cal');
  if (caixa && evento.key === 'Escape') { evento.preventDefault(); return fecharCalendario(); }
  const campo = evento.target?.closest?.('input[type="date"]');
  if (!campo || campo.disabled || campo.readOnly) return;
  if (campo.hasAttribute('data-calendario-nativo')) return;
  if (evento.key === 'ArrowDown' || evento.key === ' ') {
    evento.preventDefault();
    if (!caixa) abrirCalendarioNoCampo(campo);
  }
}, true);

document.addEventListener('mousedown', (evento) => {
  const caixa = document.getElementById('vybe-cal');
  if (caixa && !evento.target.closest('#vybe-cal') && !evento.target.closest('input[type="date"]')) {
    fecharCalendario();
  }
});

// Rolar com o calendário aberto o deixaria pendurado longe do campo. Fechar é
// mais honesto do que persegui-lo a cada quadro.
window.addEventListener('scroll', () => { if (document.getElementById('vybe-cal')) fecharCalendario(); }, true);
window.addEventListener('resize', () => { if (document.getElementById('vybe-cal')) fecharCalendario(); });
