
  // Central C6: uma única navegação de estações; CADASTROS abre e retorna para a central sem revelar um modo persistido.
  (function(){
    const cleanCadastrosRoute = () => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('open-cadastros') && !url.searchParams.has('station-cards-c5')) return;
      url.searchParams.delete('open-cadastros');
      url.searchParams.delete('station-cards-c5');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)};
    const reopenStationGate = () => {
      cleanCadastrosRoute();
      if (typeof window.openModeGate === 'function') window.openModeGate();
      window.requestAnimationFrame(() => {
        const station = document.getElementById('station-cadastros');
        station?.focus({preventScroll:true})})};
    const originalCloseCadastros = window.closeCadastrosGoverned;
    window.closeCadastrosGoverned = () => {
      const overlay = document.getElementById('cadastros-preview-overlay');
      const estavaAberto = Boolean(overlay);
      overlay?.remove();
      if (estavaAberto) reopenStationGate()};
    const openCadastrosFallback = () => {
      if (typeof window.showToast === 'function') window.showToast('Não foi possível inicializar CADASTROS. Nenhuma criação foi enviada; atualize a página e tente novamente.', 'err', 7000)};
    const openCadastrosModule = () => {
      try {
        if (typeof window.openCadastrosGoverned === 'function') { window.openCadastrosGoverned(); return}
      } catch (error) { console.warn('Controlador CADASTROS v2 indisponível; usando recuperação.', error)}
      const recovery = document.createElement('script');
      recovery.src = `/cadastros_governed_v2.js?recovery=${Date.now()}`;
      recovery.async = true;
      recovery.onload = () => {
        try {
          if (typeof window.openCadastrosGoverned === 'function') { window.openCadastrosGoverned(); return}
        } catch (error) { console.warn('Recuperação CADASTROS falhou.', error)}
        openCadastrosFallback()};
      recovery.onerror = openCadastrosFallback;
      document.head.appendChild(recovery)};
    window.openCadastrosStation = () => {
      if (typeof window.openModeGate === 'function') window.openModeGate();
      window.requestAnimationFrame(() => window.setTimeout(openCadastrosModule, 40))};
    const daStation = document.getElementById('station-da-controler');
    daStation?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      window.chooseDaControllerMode?.()});
    const legacyRoute = new URLSearchParams(window.location.search);
    if (legacyRoute.get('open-cadastros') === '1') {
      cleanCadastrosRoute();
      window.requestAnimationFrame(() => window.setTimeout(window.openCadastrosStation, 80))}
  })();



  setInterval(() => {
    document.querySelectorAll('.live-timer').forEach(el => {
      const start = new Date(el.dataset.start).getTime();
      if (!start || isNaN(start)) return;
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      el.innerHTML = `&#9201; ${h}:${m}:${s}`})}, 1000);
