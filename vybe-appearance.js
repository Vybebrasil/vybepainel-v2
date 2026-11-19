// Preferências de aparência não dependem dos dados nem das permissões da operação.
(() => {
  const root = document.documentElement;
  const body = document.body;
  const key = 'vybe.appearance.v1';
  let preferences = { glass: 90, reduceMotion: false };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Number.isFinite(saved.glass)) preferences.glass = Math.max(65, Math.min(100, saved.glass));
    if (saved) preferences.reduceMotion = saved.reduceMotion === true;
  } catch { /* Preferências indisponíveis não impedem a abertura do painel. */ }
  function apply() {
    root.style.setProperty('--glass-opacity', String(preferences.glass / 100));
    body.dataset.motion = preferences.reduceMotion ? 'reduce' : 'full';
  }
  function save() {
    apply();
    try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Sessão sem armazenamento. */ }
  }
  apply();
  const dialog = document.createElement('dialog');
  // Prancha V2-R-Aparencia (19/11/2026): no vidro o título com a frase e o fechar; numa folha os quatro temas (Fumê,
  // Claro, Escuro e Auto, os mesmos do menu da Conta, por window.VybeTema), a barra do vidro com o valor e as pontas, e
  // as chaves (Reduzir movimento; o Mundo voxel entra aqui pelo vybe-mundo.js); no pé a dica e Concluído.
  // d3-tema: no tema Escuro a folha escurece junto.
  dialog.className = 'appearance-dialog d3-tema';
  dialog.setAttribute('aria-labelledby', 'appearance-title');
  const TEMAS_AP = [['fume', 'Fumê', 'o padrão'], ['claro', 'Claro', 'luz de manhã'], ['escuro', 'Escuro', 'para a noite'], ['auto', 'Auto', 'segue o sistema']];
  const previa = (id) => id === 'auto'
    ? '<span class="appearance-previa d3-previa" data-d3-tema="claro" aria-hidden="true"><i class="ap-hud"></i><i class="ap-janela"><i class="ap-folha"></i></i><span class="appearance-previa-metade d3-previa" data-d3-tema="escuro"><i class="ap-hud"></i><i class="ap-janela"><i class="ap-folha"></i></i></span></span>'
    : `<span class="appearance-previa d3-previa" data-d3-tema="${id}" aria-hidden="true"><i class="ap-hud"></i><i class="ap-janela"><i class="ap-folha"></i></i></span>`;
  dialog.innerHTML = `<form method="dialog">
    <header><span class="appearance-nome"><h2 id="appearance-title">Aparência</h2><small>seu painel, do seu jeito · fica neste navegador</small></span><button aria-label="Fechar aparência" value="close">×</button></header>
    <div class="appearance-folha">
      <fieldset class="appearance-temas"><legend>Tema</legend>
        ${TEMAS_AP.map(([id, nome, sub]) => `<label class="appearance-tema"><input type="radio" name="appearance-tema" value="${id}">${previa(id)}<b>${nome}</b><small>${sub}</small></label>`).join('')}
      </fieldset>
      <label class="appearance-field"><span class="appearance-range-label">Vidro <output id="appearance-value"></output></span>
        <input id="appearance-glass" type="range" min="65" max="100" step="1" aria-label="Opacidade do vidro">
        <small><span>mais transparente · 65%</span><span>mais sólido · 100%</span></small></label>
      <label class="appearance-check"><span class="appearance-check-txt"><b>Reduzir movimento</b><small>tira as animações de entrada e de troca de tela</small></span><input id="appearance-motion" type="checkbox" role="switch"></label>
    </div>
    <footer class="appearance-pe"><p>O tema também troca no menu da sua conta.</p><button class="appearance-done" value="done">Concluído</button></footer>
  </form>`;
  body.append(dialog);
  const marcarTema = () => {
    const atual = window.VybeTema?.escolhido?.() || 'fume';
    for (const r of dialog.querySelectorAll('input[name="appearance-tema"]')) r.checked = r.value === atual;
  };
  dialog.addEventListener('change', (event) => {
    const r = event.target.closest?.('input[name="appearance-tema"]');
    if (r?.checked) window.VybeTema?.trocar?.(r.value);
  });
  document.addEventListener('vybe:tema', marcarTema);
  const slider = dialog.querySelector('#appearance-glass');
  const output = dialog.querySelector('#appearance-value');
  const motion = dialog.querySelector('#appearance-motion');
  slider.addEventListener('input', () => {
    preferences.glass = Number(slider.value); output.value = `${preferences.glass}%`; save();
  });
  motion.addEventListener('change', () => { preferences.reduceMotion = motion.checked; save(); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-open-appearance]')) return;
    slider.value = String(preferences.glass); output.value = `${preferences.glass}%`;
    motion.checked = preferences.reduceMotion;
    marcarTema();
    if (!dialog.open) dialog.showModal();
  });
  const colors = { producao: '#ff984f', demandas: '#61d3e9', clientes: '#b39afa',
    diario: '#74c9b1', performance: '#89aaff', 'ai-usage': '#d79ce5', automacoes: '#f0c870', conta: '#b5c1d5' };
  const navigation = document.querySelector('.board-switch-bar');
  function updateAccent() {
    const current = navigation?.querySelector('.board-switch-btn.active')?.id.replace('btn-board-', '');
    root.style.setProperty('--workspace-accent', colors[current] || '#ff984f');
  }
  if (navigation) new MutationObserver(updateAccent).observe(navigation, { subtree: true, attributes: true, attributeFilter: ['class'] });
  updateAccent();
})();
