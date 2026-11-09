// vybe-datas-comemorativas.js — as datas do calendário sazonal dentro da agenda (Paulo, 08/11/2026).
//
// "Traz pro calendário também as datas comemorativas, em menos destaque que os compromissos da agenda, com um
// hover com sugestão de conteúdo para os clientes (imagino que o bot do Redator faria isso)."
//
// As datas vêm de vybe-sazonal.js (datasSazonaisDoAno), que é carregado sob demanda: aqui ele é pedido quando o
// navegador folga, e quem desenha a agenda escuta 'vybe-datas-prontas' para redesenhar.
// Só entram as datas que costumam virar post (destaque) e os feriados; profissões e sabores só quando há um
// cliente daquele ramo. A sugestão por cliente é uma regra simples (ramo × tipo da data), marcada como rascunho;
// "Pedir ao Redator" manda a data e os clientes para o VYBES (chooseVybesMode), onde o agente Redator responde.
(() => {
  const G = window;
  let pronto = typeof G.datasSazonaisDoAno === 'function';
  const cache = new Map();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function carregar() {
    if (pronto) return Promise.resolve();
    const p = typeof G.carregarSobDemanda === 'function' ? G.carregarSobDemanda('sazonal') : Promise.reject(new Error('sem sob-demanda'));
    return p.then(() => { pronto = typeof G.datasSazonaisDoAno === 'function'; cache.clear(); if (pronto) document.dispatchEvent(new CustomEvent('vybe-datas-prontas')); }).catch(() => {});
  }
  const depois = (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 5000 }) : setTimeout(f, 2500));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => depois(carregar)); else depois(carregar);

  // Ramo do cliente pelo segmento do cadastro (a mesma ideia de mundo/clientes.mjs, tipoDoSegmento).
  function ramo(seg) {
    const s = sem(seg);
    if (/prefeit|camara|governo|secretar|public/.test(s)) return 'publico';
    if (/restaur|aliment|padar|lanch|bar\b|caf|pizz|acai|sorvet|comida|bebida|hamburg|doce/.test(s)) return 'comida';
    if (/clinic|saude|medic|odont|hospital|farm|estetic|laborat|vet/.test(s)) return 'saude';
    if (/moda|loja|varej|calcad|otica|joia|boutique|cosm|papelar|celular|eletro/.test(s)) return 'loja';
    if (/academ|fit|esporte|crossfit|luta/.test(s)) return 'academia';
    if (/escola|educa|curso|faculd|colegio/.test(s)) return 'escola';
    if (/cooperat|agro|rural|feij|semente|maquina/.test(s)) return 'agro';
    return 'empresa';
  }
  const IDEIA = {
    comida: 'prato ou produto do dia ligado à data, com oferta e stories de bastidor',
    saude: 'conteúdo educativo curto + recado de cuidado da equipe',
    loja: 'vitrine com o produto que combina com a data e chamada para a loja',
    academia: 'desafio ou treino temático com a turma',
    escola: 'homenagem com alunos e professores',
    agro: 'homenagem ao produtor da região, com foto do campo',
    publico: 'mensagem institucional com serviço útil para a população',
    empresa: 'post institucional com a equipe e a cara da marca',
  };
  // Quais ramos a data chama (vazio = todos os clientes, se a data for forte).
  function ramosDaData(d) {
    const n = sem(d.nome);
    if (d.tema === 'sabor' || /pizza|cerveja|vinho|cafe|chocolate|queijo|hamburg|sushi|sorvete|confeit|gastronom/.test(n)) return ['comida'];
    if (/medic|saude|enferm|rosa|novembro azul|setembro amarelo|janeiro branco|cancer|dentist|odont|farmac|nutri|psicolog|fisioter|veterin|mamograf/.test(n)) return ['saude'];
    if (/professor|estudante|educac|aulas|livro/.test(n)) return ['escola'];
    if (/agricult|feijao|campo|rural|produtor/.test(n)) return ['agro'];
    if (/esport|educacao fisica|atleta|corrida|futebol/.test(n)) return ['academia'];
    if (/maes|pais|namorados|criancas|natal|black friday|cyber|consumidor|cliente|avos|amigo/.test(n)) return ['loja', 'comida', 'saude', 'academia', 'empresa'];
    if (d.tema === 'profissao') return ['__nenhum'];
    return [];
  }
  function clientes() {
    const cad = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
    return cad.filter((c) => (typeof clienteAtivo === 'function' ? clienteAtivo(c) : c.ativo !== false)).map((c) => ({ nome: c.nome, ramo: ramo(c.segmento || c.ramo || '') }));
  }
  // Sugestões da data: um rascunho por cliente que combina; feriado avisa o horário de funcionamento.
  function sugestoes(d) {
    const todos = clientes(), r = ramosDaData(d);
    const alvo = r.includes('__nenhum') ? [] : r.length ? todos.filter((c) => r.includes(c.ramo)) : d.destaque ? todos : [];
    const lista = alvo.map((c) => ({ cliente: c.nome, ideia: IDEIA[c.ramo] || IDEIA.empresa }));
    if (d.feriado) lista.unshift({ cliente: 'Todos os clientes', ideia: 'aviso de horário de funcionamento no feriado (story ou post)' });
    return lista;
  }
  // Datas que aparecem na agenda: fortes ou feriado; profissão/sabor só com cliente do ramo.
  function relevante(d) {
    if (d.feriado) return true;
    if (!d.destaque) return false;
    if (d.tema === 'profissao' || d.tema === 'sabor') return sugestoes(d).length > 0;
    return true;
  }
  function doAno(ano) {
    if (!pronto) return [];
    if (!cache.has(ano)) cache.set(ano, G.datasSazonaisDoAno(ano).filter(relevante));
    return cache.get(ano);
  }
  function doDia(iso) { return doAno(Number(String(iso).slice(0, 4))).filter((d) => d.iso === iso); }
  function proximas(desde, dias = 14) {
    const ate = new Date(`${desde}T12:00:00Z`); ate.setUTCDate(ate.getUTCDate() + dias);
    const fim = ate.toISOString().slice(0, 10), anos = [...new Set([desde.slice(0, 4), fim.slice(0, 4)])].map(Number);
    return anos.flatMap(doAno).filter((d) => d.iso >= desde && d.iso <= fim);
  }
  const br = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  // Chip discreto (menos destaque que um compromisso): estrela, nome curto, e o cartão de sugestão no hover/clique.
  function chipHtml(d, { curto = false } = {}) {
    const nome = curto ? d.nome.split(/ — | - /)[0] : d.nome;
    return `<button type="button" class="vd-chip${d.feriado ? ' feriado' : ''}" data-comemorativa="${esc(d.iso)}|${esc(d.nome)}" title="${esc(d.nome)}"><i aria-hidden="true">★</i><span>${esc(nome)}</span></button>`;
  }
  function chipsDoDia(iso, opcoes = {}) {
    const l = doDia(iso); if (!l.length) return '';
    const max = opcoes.max || 1;
    return `<div class="vd-chips">${l.slice(0, max).map((d) => chipHtml(d, { curto: true })).join('')}${l.length > max ? `<span class="vd-mais">+${l.length - max}</span>` : ''}</div>`;
  }
  function cartaoHtml(d) {
    const s = sugestoes(d), prazo = typeof G.sazonalPrazoDe === 'function' ? G.sazonalPrazoDe(d.iso) : '';
    return `<button type="button" class="vd-x" data-vd-fechar aria-label="Fechar" title="Fechar (Esc)">×</button><div class="vd-cartao-topo"><small>${br(d.iso)}${d.feriado ? ' · feriado' : ''}${prazo ? ' · cadastrar até ' + br(prazo) : ''}</small><b>${esc(d.nome)}</b></div>
      ${s.length ? `<ul>${s.slice(0, 6).map((x) => `<li><b>${cliCor(x.cliente)}</b> ${esc(x.ideia)}</li>`).join('')}</ul>${s.length > 6 ? `<p class="vd-dica">e mais ${s.length - 6} clientes</p>` : ''}`
        : '<p class="vd-dica">Nenhum cliente do ramo desta data. Vale só se combinar com a marca.</p>'}
      <p class="vd-dica">Rascunho pela regra do ramo de cada cliente. O Redator escreve a sugestão de verdade.</p>
      <div class="vd-acoes"><button type="button" class="vd-botao" data-vd-redator>Pedir ao Redator</button>${typeof G.sazonalEscolher === 'function' || typeof G.openCadastrosGoverned === 'function' ? '<button type="button" class="vd-botao principal" data-vd-cadastrar>Cadastrar conteúdo</button>' : ''}</div>`;
  }

  // Cartão flutuante: passa o mouse (ou foca, ou toca) no chip.
  let cartao = null, aberto = null, saida = null;
  function mostrar(chip) {
    clearTimeout(saida);
    const [iso, ...resto] = chip.dataset.comemorativa.split('|'), nome = resto.join('|');
    const d = doDia(iso).find((x) => x.nome === nome) || { iso, nome, destaque: 1 };
    if (!cartao) {
      cartao = document.createElement('div'); cartao.className = 'vd-cartao'; cartao.setAttribute('role', 'dialog');
      cartao.addEventListener('mouseenter', () => clearTimeout(saida)); cartao.addEventListener('mouseleave', esconderDepois);
      cartao.addEventListener('click', (e) => {
        if (e.target.closest('[data-vd-fechar]')) { esconder(); return; }
        if (!aberto) return;
        if (e.target.closest('[data-vd-redator]')) {
          const s = sugestoes(aberto).filter((x) => x.cliente !== 'Todos os clientes').map((x) => x.cliente).slice(0, 12);
          const pedido = `[Redator] Sugira conteúdos para ${aberto.nome} (${br(aberto.iso)}) para ${s.length ? s.join(', ') : 'os clientes que combinarem com a data'}. Uma ideia por cliente, com formato e gancho.`;
          if (typeof G.chooseVybesMode === 'function') G.chooseVybesMode({ pedido }); esconder();
        } else if (e.target.closest('[data-vd-cadastrar]')) {
          const d2 = aberto; esconder();
          if (typeof G.sazonalEscolher === 'function') G.sazonalEscolher(d2.iso, d2.nome);
          else G.openCadastrosGoverned?.({ veic: d2.iso, titulo: d2.nome });
        }
      });
      document.body.append(cartao);
    }
    aberto = d; cartao.innerHTML = cartaoHtml(d); cartao.hidden = false;
    const r = chip.getBoundingClientRect(), w = Math.min(320, innerWidth - 16);
    cartao.style.width = w + 'px';
    cartao.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    const h = cartao.offsetHeight, embaixo = r.bottom + 8 + h < innerHeight;
    cartao.style.top = (embaixo ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  }
  function esconder() { if (cartao) cartao.hidden = true; aberto = null; }
  function esconderDepois() { clearTimeout(saida); saida = setTimeout(esconder, 220); }
  document.addEventListener('mouseover', (e) => { const c = e.target.closest?.('[data-comemorativa]'); if (c) mostrar(c); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest?.('[data-comemorativa]')) esconderDepois(); });
  document.addEventListener('focusin', (e) => { const c = e.target.closest?.('[data-comemorativa]'); if (c) mostrar(c); });
  document.addEventListener('click', (e) => {
    const c = e.target.closest?.('[data-comemorativa]');
    if (c) { e.stopPropagation(); e.preventDefault(); mostrar(c); return; }
    if (cartao && !cartao.hidden && !e.target.closest?.('.vd-cartao')) esconder();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cartao && !cartao.hidden) { e.preventDefault(); esconder(); } });

  G.VybeDatas = { carregar, pronto: () => pronto, doDia, proximas, chipHtml, chipsDoDia, sugestoes, ramo, relevante };
})();
