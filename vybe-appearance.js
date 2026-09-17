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
  dialog.className = 'appearance-dialog';
  dialog.setAttribute('aria-labelledby', 'appearance-title');
  dialog.innerHTML = `<form method="dialog">
    <header><h2 id="appearance-title">Aparência</h2><button aria-label="Fechar aparência" value="close">×</button></header>
    <p>Seu painel, do seu jeito. Estas preferências ficam neste navegador.</p>
    <label class="appearance-field"><span class="appearance-range-label">Opacidade do vidro <output id="appearance-value"></output></span>
      <input id="appearance-glass" type="range" min="65" max="100" step="1" aria-label="Opacidade do vidro">
      <small>Mais transparente à esquerda. Mais sólido à direita.</small></label>
    <label class="appearance-check"><input id="appearance-motion" type="checkbox">Reduzir movimento</label>
    <button class="appearance-done" value="done">Concluído</button>
  </form>`;
  body.append(dialog);
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
