// vybe-mundo-peca.js — A peça de um achado, aberta de dentro do boletim ou da página Agentes (Paulo, 09/11/2026: "se eu
// clicasse ali, talvez podia abrir um HUD com o calendário para me mostrar onde está aquela demanda, e eu clicar, abrir a
// demanda com mais informações ... alterar qualquer coisa nessa demanda específica"; "tem que ser mais útil para o agente
// poder resolver o problema. E não ficar só me mostrando que tem algo errado").
//
// Não é outro editor: lê a peça carregada no painel (findOperationalItem, pelo mesmo `vybe:ID` que o achado traz) e grava
// pelas mesmas funções do painel (gravarResponsaveisDaPeca, moverDataDoItem), que passam pelo servidor e conferem a
// permissão de quem está logado. A demanda completa abre na gaveta de sempre (openItemWorkspace).
//   - O calendário: duas semanas em volta da peça, com o prazo, a veiculação, hoje e as outras peças do mesmo cliente.
//   - A sugestão do agente: quem passa a fazer e o prazo, lidos da proposta (quando a central manda) ou do texto da
//     sugestão ("Passar para Ewerton (...) com prazo seg 10/11"). "Aplicar a sugestão" preenche e grava.
//   - Depois de gravar, o achado pode ser marcado como resolvido pela mesma rota da página Agentes (etapa=achado).
(() => {
  const G = window;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const st = { aberto: false, ref: '', achado: null, setor: '', msg: '', erro: false, salvando: false, inicio: '' };
  let raiz = null, voltarFoco = null;

  // ---------- funções puras (os testes chamam direto) ----------
  const isoDe = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const dataDe = (iso) => new Date(iso + 'T00:00:00Z');
  const somar = (iso, n) => { const d = dataDe(iso); d.setUTCDate(d.getUTCDate() + n); return isoDe(d); };
  // "10/11" vira data no ano de hoje; um mês muito antes do de hoje é do ano seguinte (dezembro olhando janeiro).
  function isoDoDiaMes(dd, mm, hoje) {
    const ano = Number(hoje.slice(0, 4)), mesHoje = Number(hoje.slice(5, 7)), m = Number(mm), d = Number(dd);
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
    const y = m < mesHoje - 6 ? ano + 1 : m > mesHoje + 6 ? ano - 1 : ano;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // A sugestão do agente em campos: { responsavel: 'Ewerton', prazo: '2026-11-10', grupo, status } (o que houver).
  function sugestaoDe(achado, hoje) {
    const p = achado?.proposta && typeof achado.proposta === 'object' ? achado.proposta : null;
    const txt = String(achado?.sugestao || '');
    const nome = (p?.responsavel && String(p.responsavel)) || (/Passar para (.+?)\s*(?:\(|\bcom prazo\b|[;,]|\.\s|\.?$)/i.exec(txt) || [])[1] || '';
    let prazo = p?.prazo && ISO.test(String(p.prazo)) ? String(p.prazo) : '';
    if (!prazo) { const m = /com prazo (?:\S+ )?(\d{1,2})\/(\d{1,2})/i.exec(txt); if (m) prazo = isoDoDiaMes(m[1], m[2], hoje); }
    const out = {};
    if (nome.trim()) out.responsavel = nome.trim();
    if (prazo) out.prazo = prazo;
    if (p?.grupo) out.grupo = String(p.grupo);
    if (p?.status) out.status = String(p.status);
    return Object.keys(out).length ? out : null;
  }
  // Quem da equipe é o nome da sugestão ("Ewerton", "Ewerton L.", "Bia").
  function pessoaDoNome(nome, equipe) {
    const n = norm(nome).replace(/\.$/, ''); if (!n) return null;
    return equipe.find((u) => norm(u.name) === n) || equipe.find((u) => norm(u.name).startsWith(n)) || equipe.find((u) => n.startsWith(norm(u.name).split(' ')[0]) && norm(u.name).split(' ')[0].length >= 3) || null;
  }
  // As duas semanas do calendário: começa na segunda da semana da data que manda (prazo, senão veiculação, senão hoje).
  function diasDoCalendario(item, hoje) {
    const ancora = [item?.prazo_iso, item?.veiculacao_iso, hoje].find((x) => ISO.test(String(x || '')));
    const d = dataDe(ancora), seg = somar(ancora, -((d.getUTCDay() + 6) % 7));
    return Array.from({ length: 14 }, (_, i) => somar(seg, i));
  }
  // As peças do mesmo cliente que caem em cada dia (por prazo ou veiculação), sem a própria peça.
  function vizinhas(item, todas, dias) {
    const cli = new Set([item?.cliente, ...(item?.clientes || [])].filter(Boolean).map(norm)), por = {};
    for (const x of todas) {
      if (!x || String(x.id) === String(item?.id)) continue;
      const cx = [x.cliente, ...(x.clientes || [])].filter(Boolean).map(norm);
      if (!cx.some((c) => cli.has(c))) continue;
      for (const [campo, rot] of [['prazo_iso', 'prazo'], ['veiculacao_iso', 'veicula']]) if (dias.includes(x[campo])) (por[x[campo]] ||= []).push({ id: String(x.id), nome: x.nome || 'Peça', rot });
    }
    return por;
  }

  // ---------- leitura do painel ----------
  const hojeIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
  const peca = (ref) => { try { return typeof G.findOperationalItem === 'function' ? G.findOperationalItem(ref) : null; } catch { return null; } };
  const todasAsPecas = () => [...(typeof G.DADOS !== 'undefined' && Array.isArray(G.DADOS) ? G.DADOS : []), ...(typeof G.DADOS_DEMANDAS !== 'undefined' && Array.isArray(G.DADOS_DEMANDAS) ? G.DADOS_DEMANDAS : [])];
  const equipe = () => (typeof G.TEAM_USERS !== 'undefined' && Array.isArray(G.TEAM_USERS) ? G.TEAM_USERS : []);
  const ehPedido = (item) => { try { return typeof G.isRequestItem === 'function' && G.isRequestItem(item); } catch { return false; } };
  const responsaveisDe = (item) => { try { return typeof G.ownerUsersFor === 'function' ? G.ownerUsersFor(item) : []; } catch { return []; } };
  const quemPode = (item) => { try { const r = typeof G.ownerEligibility === 'function' ? G.ownerEligibility(item) : null; return r?.users?.length ? r.users : equipe(); } catch { return equipe(); } };
  const dm = (iso) => (ISO.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
  const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

  function calendarioHtml(item, hoje) {
    const dias = diasDoCalendario(item, hoje), viz = vizinhas(item, todasAsPecas(), dias);
    const celula = (iso, i) => {
      const marcas = [];
      if (iso === item.prazo_iso) marcas.push('<em class="vpc-m prazo">Prazo</em>');
      if (iso === item.veiculacao_iso) marcas.push('<em class="vpc-m veicula">Veicula</em>');
      const outras = viz[iso] || [];
      return `<li class="${iso === hoje ? 'hoje' : ''}${iso < hoje ? ' passado' : ''}${marcas.length ? ' marcado' : ''}" ${i % 7 > 4 ? 'data-fim' : ''}>
        <small>${SEMANA[i % 7]} <b>${Number(iso.slice(8, 10))}</b>${iso === hoje ? ' · hoje' : ''}</small>${marcas.join('')}
        ${outras.slice(0, 2).map((o) => `<button type="button" class="vpc-outra" data-vpc-peca="${esc(o.id)}" title="${esc(o.nome)} (${o.rot})">${esc(o.nome)}</button>`).join('')}${outras.length > 2 ? `<small class="vpc-mais">+${outras.length - 2}</small>` : ''}</li>`;
    };
    return `<div class="vpc-cal" role="group" aria-label="Duas semanas em volta da peça"><ol>${dias.map(celula).join('')}</ol>
      <p class="vpc-legenda"><span><i class="prazo"></i>prazo</span><span><i class="veicula"></i>veiculação</span><span><i class="outra"></i>outras peças do cliente</span></p></div>`;
  }

  function pintar() {
    if (!st.aberto) { if (raiz) raiz.hidden = true; return; }
    if (!raiz) {
      raiz = document.createElement('div'); raiz.className = 'vpc-fundo'; raiz.hidden = true;
      raiz.innerHTML = '<div class="vpc-janela" role="dialog" aria-modal="true" aria-labelledby="vpc-titulo"></div>';
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('submit', aoEnviar);
      document.body.append(raiz);
    }
    const jan = raiz.querySelector('.vpc-janela'), item = peca(st.ref), hoje = hojeIso(), a = st.achado;
    const fechar = '<button type="button" class="vpc-fechar" data-vpc-fechar aria-label="Fechar a peça"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    if (!item) {
      jan.innerHTML = `<div class="vpc-topo"><span><small>${a?.cliente ? esc(a.cliente) : 'Peça'}</small><h2 id="vpc-titulo">${esc(a?.titulo || 'Peça do achado')}</h2></span>${fechar}</div>
        <div class="vpc-corpo"><p class="vpc-vazio">Esta peça não está carregada no painel agora: pode estar em outro quadro, arquivada ou já ter saído da fila.</p>
        ${a?.fato ? `<p class="vpc-viu"><b>O que o agente viu</b>${esc(a.fato)}${a.sugestao ? `<small>${esc(a.sugestao)}</small>` : ''}</p>` : ''}</div>
        <div class="vpc-pe"><button type="button" class="vpc-botao" data-vpc-fechar>Fechar</button><button type="button" class="vpc-botao principal" data-vpc-completa>Tentar abrir a demanda</button></div>`;
      raiz.hidden = false; return;
    }
    const pedido = ehPedido(item), campoVeic = pedido ? 'conclusao_iso' : 'veiculacao_iso', rotVeic = pedido ? 'Conclusão' : 'Veiculação';
    const atuais = responsaveisDe(item), pode = quemPode(item), sug = sugestaoDe(a, hoje), pessoaSug = sug?.responsavel ? pessoaDoNome(sug.responsavel, equipe()) : null;
    const opcoes = [...new Map([...atuais, ...pode, ...(pessoaSug ? [pessoaSug] : [])].map((u) => [String(u.id), u])).values()];
    const atual = atuais[0] ? String(atuais[0].id) : '';
    const status = typeof G.statusCor === 'function' ? G.statusCor(item) : esc(item.status || 'Sem status');
    const cli = (item.clientes?.length ? item.clientes : [item.cliente]).filter(Boolean).map((c) => (typeof G.cliCor === 'function' ? G.cliCor(c) : esc(c))).join(' ');
    const atrasada = ISO.test(String(item.prazo_iso || '')) && item.prazo_iso < hoje, veicPassou = ISO.test(String(item[campoVeic] || '')) && item[campoVeic] < hoje;
    jan.innerHTML = `<div class="vpc-topo"><span><small>${cli}${item.grupo ? ` · ${esc(item.grupo)}` : ''}${item.formato ? ` · ${esc(item.formato)}` : ''}</small><h2 id="vpc-titulo">${esc(item.nome || 'Peça')}</h2>
        <span class="vpc-linha">${status}<span>${atuais.length ? 'Com ' + esc(atuais.map((u) => u.name.split(' ')[0]).join(', ')) : '<em class="vpc-falta">Sem responsável</em>'}</span>
        <span class="${atrasada ? 'vpc-ruim' : ''}">Prazo ${dm(item.prazo_iso)}${atrasada ? ' (passou)' : ''}</span><span class="${veicPassou ? 'vpc-ruim' : ''}">${rotVeic} ${dm(item[campoVeic])}${veicPassou ? ' (passou)' : ''}</span></span></span>${fechar}</div>
      <div class="vpc-corpo">
        ${a ? `<div class="vpc-viu"><b>${esc(st.setor ? 'O que o agente viu' : 'O achado')}</b><span>${esc(a.fato || '')}</span>${a.sugestao ? `<small><b>Sugestão:</b> ${esc(a.sugestao)}</small>` : ''}</div>` : ''}
        ${calendarioHtml(item, hoje)}
        <form class="vpc-form" data-vpc-form>
          <label><span>Responsável</span><select name="responsavel"><option value="">Sem responsável</option>${opcoes.map((u) => `<option value="${esc(u.id)}" ${String(u.id) === atual ? 'selected' : ''}>${esc(u.name)}${pessoaSug && String(u.id) === String(pessoaSug.id) ? ' · sugestão do agente' : ''}</option>`).join('')}</select></label>
          <label><span>Prazo</span><input type="date" name="prazo" value="${esc(item.prazo_iso || '')}"></label>
          <label><span>${rotVeic}</span><input type="date" name="veiculacao" value="${esc(item[campoVeic] || '')}"></label>
          ${a && st.setor ? '<label class="vpc-check"><input type="checkbox" name="resolver" checked><span>Marcar o achado como resolvido ao salvar</span></label>' : ''}
          <div class="vpc-acoes">${sug && (pessoaSug || sug.prazo) ? `<button type="button" class="vpc-botao sugestao" data-vpc-sugestao${st.salvando ? ' disabled' : ''}>Aplicar a sugestão${pessoaSug ? ': ' + esc(pessoaSug.name.split(' ')[0]) : ''}${sug.prazo ? ' até ' + dm(sug.prazo) : ''}</button>` : ''}
            <button type="submit" class="vpc-botao principal"${st.salvando ? ' disabled' : ''}>${st.salvando ? 'Salvando…' : 'Salvar'}</button></div>
          ${sug?.grupo || sug?.status ? `<p class="vpc-nota">O agente também sugere mover para ${esc([sug.grupo, sug.status].filter(Boolean).join(' · '))}: isso se faz na demanda completa.</p>` : ''}
        </form>
        ${st.msg ? `<p class="vpc-msg${st.erro ? ' erro' : ''}" role="status">${esc(st.msg)}</p>` : ''}
      </div>
      <div class="vpc-pe"><button type="button" class="vpc-botao" data-vpc-fechar>Fechar</button><button type="button" class="vpc-botao" data-vpc-completa>Abrir a demanda completa</button></div>`;
    raiz.hidden = false;
  }

  // Grava só o que mudou, campo a campo, pelas funções do painel. Em erro, para e mostra o que houve (sem fingir sucesso).
  async function salvar(valores) {
    const item = peca(st.ref); if (!item || st.salvando) return;
    const pedido = ehPedido(item), campoVeic = pedido ? 'conclusao_iso' : 'veiculacao_iso', feitos = [];
    st.salvando = true; st.msg = ''; st.erro = false; pintar();
    try {
      const atuais = responsaveisDe(item).map((u) => String(u.id));
      if (valores.responsavel != null && !(atuais.length === (valores.responsavel ? 1 : 0) && (!valores.responsavel || atuais[0] === String(valores.responsavel)))) {
        if (typeof G.gravarResponsaveisDaPeca !== 'function') throw new Error('O painel ainda não carregou a edição de responsáveis.');
        await G.gravarResponsaveisDaPeca(item, valores.responsavel ? [String(valores.responsavel)] : []); feitos.push('responsável');
      }
      for (const [campo, chave, rot] of [['prazo', 'prazo_iso', 'prazo'], ['veiculacao', campoVeic, pedido ? 'conclusão' : 'veiculação']]) {
        const v = String(valores[campo] || '');
        if (!ISO.test(v) || v === String(item[chave] || '')) continue;
        if (typeof G.moverDataDoItem !== 'function') throw new Error('O painel ainda não carregou a edição de datas.');
        await G.moverDataDoItem(item, campo === 'prazo' ? 'prazo' : 'veiculacao', v, { request: pedido }); feitos.push(rot);
      }
      if (!feitos.length) { st.msg = 'Nada mudou na peça.'; return; }
      st.msg = `Salvo: ${feitos.join(', ')}.`;
      if (valores.resolver && st.achado?.chave && st.setor) {
        const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'achado', chave: st.achado.chave, acao: 'resolvido' }) });
        const d = await r.json().catch(() => ({}));
        st.msg += r.ok || d.error === 'Esse achado já foi fechado.' ? ' Achado marcado como resolvido.' : ` O achado continua aberto: ${d.error || 'a central não confirmou'}.`;
        G.dispatchEvent?.(new CustomEvent('vybe:achado-mudou', { detail: { setor: st.setor, chave: st.achado.chave } }));
      }
    } catch (e) { st.erro = true; st.msg = (feitos.length ? `Salvo: ${feitos.join(', ')}. ` : '') + `Parou: ${e?.message || 'não foi possível salvar agora.'}`; }
    finally { st.salvando = false; pintar(); }
  }
  function aoEnviar(e) {
    const f = e.target.closest('[data-vpc-form]'); if (!f) return; e.preventDefault();
    const v = Object.fromEntries(new FormData(f)); salvar({ ...v, resolver: v.resolver === 'on' });
  }
  function aoClicar(e) {
    if (e.target === raiz) { fechar(); return; }
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-vpc-fechar')) { fechar(); return; }
    if (b.hasAttribute('data-vpc-completa')) { const ref = st.ref; fechar(); G.dispatchEvent?.(new CustomEvent('vybe:peca-completa', { detail: { ref } })); if (typeof G.openItemWorkspace === 'function') G.openItemWorkspace(ref); return; }
    if (b.dataset.vpcPeca) { abrir(b.dataset.vpcPeca); return; }
    if (b.hasAttribute('data-vpc-sugestao')) {
      const f = raiz.querySelector('[data-vpc-form]'), sug = sugestaoDe(st.achado, hojeIso()), p = sug?.responsavel ? pessoaDoNome(sug.responsavel, equipe()) : null;
      if (p && f?.responsavel) f.responsavel.value = String(p.id);
      if (sug?.prazo && f?.prazo) f.prazo.value = sug.prazo;
      salvar({ ...Object.fromEntries(new FormData(f)), resolver: Boolean(f?.resolver?.checked) });
    }
  }
  // abrir('vybe:123', { achado, setor }): achado é o do perfil do agente (fato, sugestão, chave, proposta).
  function abrir(ref, { achado = null, setor = '' } = {}) {
    const mesmaPeca = st.aberto && st.ref === String(ref);
    st.ref = String(ref || ''); if (!mesmaPeca) { st.achado = achado; st.setor = setor; } st.msg = ''; st.erro = false; st.aberto = true;
    if (!raiz || raiz.hidden) voltarFoco = document.activeElement;
    pintar(); setTimeout(() => raiz?.querySelector('.vpc-fechar')?.focus(), 0);
  }
  function fechar() { st.aberto = false; pintar(); try { voltarFoco?.focus?.(); } catch { /* o botão saiu da tela */ } voltarFoco = null; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.aberto) { e.stopPropagation(); fechar(); } }, true);

  G.VybePeca = { abrir, fechar, aberto: () => st.aberto, sugestaoDe, pessoaDoNome, diasDoCalendario, vizinhas, isoDoDiaMes };
})();
