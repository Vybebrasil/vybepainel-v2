/* Vybe OS — Cadastro Rápido + Prévia Ao Vivo */

// ── CRIAR EM ESCALA ──────────────────────────────────────────────────────────
//
// Dez fotografias a cada três dias eram dez cartões criados à mão, com a data
// digitada em cada um. Aqui se diz quantos, a primeira veiculação e o intervalo,
// e os cartões nascem com as datas: veiculação no ritmo pedido e prazo sete dias
// antes (o Prazo de Ouro). Fim de semana não é pulado — a data é a que a conta
// dá. O limite de 60 é trava contra um zero a mais digitado sem querer.
const CADASTRO_ESCALA_MAX = 60;

// Cor de cada status nas etiquetas do cadastro (uma tabela só, usada pelos
// seletores, pela prévia e pelas listas). Os valores seguem o vocabulário de
// cores compartilhado com o quadro; o que não está aqui vem de
// vybe_status.cor (corDeStatus), e o resto fica cinza.
const FC_CORES_STATUS = {
  'Captação Agendada': { color: '#ffcb00', bg: 'rgba(255,203,0,0.15)', border: 'rgba(255,203,0,0.3)' },
  'Captação Feita': { color: '#00c875', bg: 'rgba(0,200,117,0.15)', border: 'rgba(0,200,117,0.3)' },
  'Feito': { color: '#00c875', bg: 'rgba(0,200,117,0.15)', border: 'rgba(0,200,117,0.3)' },
  'Agendar Captação': { color: '#df2f4a', bg: 'rgba(226,68,92,0.15)', border: 'rgba(226,68,92,0.3)' },
  'Editado': { color: '#037f4c', bg: 'rgba(3,127,76,0.15)', border: 'rgba(3,127,76,0.3)' },
  'A fazer': { color: '#c4c4c4', bg: 'rgba(196,196,196,0.15)', border: 'rgba(196,196,196,0.3)' },
  'Captação em Andamento': { color: '#579bfc', bg: 'rgba(87,155,252,0.15)', border: 'rgba(87,155,252,0.3)' },
  'Aguardo Redação': { color: '#ff5ac4', bg: 'rgba(255,90,196,0.15)', border: 'rgba(255,90,196,0.3)' },
};
// Status do quadro: só a cor do banco (vybe_status.cor, pelo catálogo do painel em corDeStatus; auditoria 09/11, A5).
// As cores de captação acima são da coluna de captação, que não é vybe_status.
function fcCorDeStatus(s) {
  if (FC_CORES_STATUS[s]) return FC_CORES_STATUS[s];
  const c = typeof corDeStatus === 'function' ? corDeStatus(s) : null;
  if (c?.cor) return { color: c.cor, bg: `color-mix(in srgb, ${c.cor} 15%, transparent)`, border: `color-mix(in srgb, ${c.borda || c.cor} 30%, transparent)` };
  return { color: '#8888a8', bg: 'rgba(136,136,168,0.12)', border: 'rgba(136,136,168,0.25)' };
}
function cadastroDatasEmEscala(inicio, quantidade, intervalo) {
  const q = Number(quantidade), passo = Number(intervalo);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio || ''))) throw new Error('Informe a primeira veiculação.');
  if (!Number.isInteger(q) || q < 1) throw new Error('Informe quantos conteúdos criar.');
  if (q > CADASTRO_ESCALA_MAX) throw new Error(`No máximo ${CADASTRO_ESCALA_MAX} por vez.`);
  if (!Number.isInteger(passo) || passo < 1 || passo > 365) throw new Error('O intervalo precisa ser de 1 a 365 dias.');
  const somar = (iso, dias) => {
    const [a, m, d] = String(iso).split('-').map(Number);
    const data = new Date(Date.UTC(a, m - 1, d + dias));
    return data.toISOString().slice(0, 10);
  };
  return Array.from({ length: q }, (_, n) => {
    const veic = somar(inicio, n * passo);
    return { veic, prazo: somar(veic, -7) };
  });
}
// Colar a lista de títulos: um por linha; linhas vazias não contam.
function cadastroTitulosColados(texto) {
  return String(texto || '').replace(/\r\n/g, '\n').split('\n')
    .map((l) => l.replace(/^\s*(?:\d+[.)-]\s*|[-*•]\s+)/, '').trim()).filter(Boolean);
}

// O NOME QUE O BANCO CONHECE.
//
// O painel mostra o cliente pelo apelido (normalizarCliente: "Hellen Rocha" vira
// "Hellen", "Voa Sportswear" vira "VOA"), e a lista de escolha do cadastro nasce
// desses nomes. O servidor procura pelo nome do cadastro de clientes: mandar o
// apelido dava "Cliente não cadastrado: Hellen" para um cliente com calendário
// cheio. Aqui o apelido volta a ser o nome do cadastro — pela MESMA tabela de
// apelidos, sem adivinhar por pedaço de nome. Sem correspondência única, segue o
// nome como está e o servidor diz o que faltou.
function cadastroNomeNoBanco(nome, fichas, normalizar) {
  const alvo = String(nome || '').trim();
  if (!alvo) return alvo;
  const lista = Array.isArray(fichas) ? fichas.filter((c) => c && c.nome) : [];
  const chave = (t) => String(t || '').trim().toLocaleLowerCase('pt-BR');
  const exato = lista.find((c) => chave(c.nome) === chave(alvo));
  if (exato) return exato.nome;
  if (typeof normalizar !== 'function') return alvo;
  const pelaTabela = lista.filter((c) => chave(normalizar(c.nome)) === chave(alvo));
  const ativos = pelaTabela.filter((c) => c.ativo !== false);
  const unico = ativos.length === 1 ? ativos[0] : (!ativos.length && pelaTabela.length === 1 ? pelaTabela[0] : null);
  return unico ? unico.nome : alvo;
}

(function() {
  const esc = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function todayIso() {
    return (typeof HOJE_ISO !== 'undefined' && HOJE_ISO) ? HOJE_ISO : new Date().toISOString().slice(0,10);
  }
  
  function getOffsetDate(iso, days) {
    if(!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }

  function ensureFastCadastrosStyles() {
    if(document.getElementById('fast-cad-styles')) return;
    const style = document.createElement('style');
    style.id = 'fast-cad-styles';
    style.textContent = `
      .fc-overlay { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); z-index:670; display:flex; justify-content:center; align-items:center; opacity:0; transition:opacity 0.3s ease; }
      .fc-overlay.open { opacity:1; }
      
      .fc-modal { background:radial-gradient(circle at top right, rgba(255,255,255,0.05), transparent 70%), rgba(15,20,25,0.85); backdrop-filter:blur(30px) saturate(1.2); width:100%; max-width:960px; border:1px solid rgba(255,255,255,0.1); border-radius:24px; display:flex; flex-direction:row; box-shadow:0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); font-family:var(--mac-ui, sans-serif); transform:scale(0.95) translateY(20px); transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1); margin: 20px; max-height: calc(100vh - 40px); }
      .fc-overlay.open .fc-modal { transform:scale(1) translateY(0); }

      .fc-main-col { flex:1; display:flex; flex-direction:column; min-width:0; border-right:1px solid rgba(255,255,255,0.06); }
      
      /* Só segura o X (quadro 08): sem o rótulo "Cadastro rápido" e sem a faixa vazia em cima da pergunta. */
      .fc-header { position:relative; height:0; padding:0; flex-shrink:0; }
      .fc-sazonal-btn { align-self:flex-start; display:inline-flex; align-items:center; gap:7px; margin-top:4px;
        background:rgba(255,176,0,.1); border:1px solid rgba(255,176,0,.32); color:#ffd9a6;
        border-radius:999px; padding:6px 14px; font:600 12px var(--mac-ui, sans-serif); cursor:pointer;
        transition:background .15s, color .15s; }
      .fc-sazonal-btn:hover { background:rgba(255,176,0,.2); color:#fff; }
      .fc-title-input { background:transparent; border:none; color:#fff; font:800 32px/1.2 var(--mac-ui, sans-serif); width:100%; outline:none; letter-spacing:-0.5px; }
      .fc-title-input::placeholder { color:rgba(255,255,255,0.2); }

      .fc-body { padding:24px 32px; display:flex; flex-direction:column; gap:20px; overflow-y:auto;  flex:1; }
      .fc-body::-webkit-scrollbar { width: 6px; }
      .fc-body::-webkit-scrollbar-track { background: transparent; }
      .fc-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
      .fc-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      
      @keyframes fcErrorPulse {
         0% { box-shadow: 0 0 0 0 rgba(255, 99, 122, 0.4); border-color: #ff637a; }
         70% { box-shadow: 0 0 0 8px rgba(255, 99, 122, 0); border-color: #ff637a; }
         100% { box-shadow: 0 0 0 0 rgba(255, 99, 122, 0); border-color: rgba(255,255,255,0.1); }
      }
      .fc-error-pulse { animation: fcErrorPulse 1.5s ease; border-color: #ff637a !important; }
      .fc-title-input.fc-error-pulse { border-bottom: 1px solid #ff637a !important; }
      
      .fc-row { display:flex; align-items:flex-start; gap:20px; }
      .fc-destino { display:inline-flex; gap:2px; padding:2px; margin:0 0 14px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); border-radius:8px; }
      .fc-destino-btn { border:0; background:transparent; color:#9cafba; cursor:pointer;
        padding:6px 13px; border-radius:6px; font:600 12px var(--mac-ui); letter-spacing:0;
        transition:background .14s, color .14s; }
      .fc-destino-btn:hover { color:#e7ecf5; }
      .fc-destino-btn.ativo { background:var(--accent,#ff6b00); color:#fff; }
      .fc-label { width:120px; color:#9cafba; font-size:13px; font-weight:600; flex-shrink:0; margin-top:12px; letter-spacing:0.3px; }
      
      .fc-input-wrap { flex:1; min-width:0; }
      .fc-input { width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:14px; font-weight:500; padding:12px 16px; border-radius:12px; outline:none; transition:all 0.2s; font-family:var(--mac-ui, sans-serif); }
      .fc-input:hover { background:rgba(0,0,0,0.4); border-color:rgba(255,255,255,0.15); }
      .fc-input:focus { border-color:#ffb000; background:rgba(0,0,0,0.5); box-shadow:0 0 0 3px rgba(255,176,0,0.1); }
      
      select.fc-input { appearance:none; cursor:pointer; }
      select.fc-input option { background:#151a21; color:#fff; }
      
      .fc-persons { display:flex; gap:8px; flex-wrap:wrap; }
      .fc-person-btn { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:30px; padding:6px 14px 6px 6px; display:flex; align-items:center; gap:8px; color:#b8d7df; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
      .fc-person-btn:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.2); }
      .fc-person-btn.active { background:rgba(255,176,0,0.1); border-color:#ffb000; color:#fff; box-shadow:0 4px 12px rgba(255,176,0,0.2); }
      /* Quem a regra escolheu ja nasce ligado. O selo explica por que, e deixa
         claro que tirar dali e uma excecao consciente, nao um descuido. */
      .fc-person-regra, .fc-person-tirado { font-style:normal; font-size:9.5px; font-weight:700;
        letter-spacing:0.06em; text-transform:uppercase; padding:2px 6px; border-radius:999px; }
      .fc-person-regra { background:rgba(255,176,0,0.16); color:#8fe9f5; }
      .fc-person-tirado { background:rgba(255,159,169,0.14); color:#ff9fa9; }
      .fc-person-btn.tirado { border-style:dashed; border-color:rgba(255,159,169,0.32); }
      .fc-person-btn.tirado:hover { border-color:rgba(255,159,169,0.6); }
      .fc-avatar { width:24px; height:24px; border-radius:50%; overflow:hidden; display:flex; justify-content:center; align-items:center; font-size:11px; font-weight:800; color:#fff; }
      .fc-avatar img { width:100%; height:100%; object-fit:cover; }

      .fc-footer { padding:24px 32px; display:flex; justify-content:flex-end; gap:16px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.2); flex-shrink:0; }
      .fc-btn-cancel { background:transparent; border:none; color:#849aa6; font-size:14px; font-weight:600; cursor:pointer; padding:12px 20px; transition:color 0.2s; }
      .fc-btn-cancel:hover { color:#fff; }
      .fc-btn-create { background:linear-gradient(135deg, #ffb000, #ff6b00); color:#120902; border:none; padding:12px 28px; border-radius:12px; font-size:14px; font-weight:800; cursor:pointer; transition:all 0.2s; box-shadow:0 10px 20px rgba(255,176,0,0.2); }
      .fc-btn-create:hover { transform:translateY(-2px); box-shadow:0 15px 25px rgba(255,176,0,0.3); }
      .fc-btn-create:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
      
      textarea.fc-input { resize:vertical; min-height:80px; line-height:1.5; }
      
      .fc-checkbox-group { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
      .fc-checkbox-row { display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(0,0,0,0.2); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); transition:all 0.2s; }
      .fc-checkbox-row:hover { background:rgba(0,0,0,0.3); border-color:rgba(255,255,255,0.1); }
      .fc-checkbox-row input { accent-color:#ffb000; width:18px; height:18px; cursor:pointer; }
      .fc-checkbox-row span { color:#d9e2e5; font-size:13px; font-weight:500; }
      
      .fc-custom-dropdown { position:relative; width:100%; font-family:var(--mac-ui, sans-serif); }
      .fc-dropdown-value { width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:13px; font-weight:700; padding:10px 16px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:all 0.2s; }
      .fc-dropdown-value:hover { background:rgba(0,0,0,0.5); }
      .fc-dropdown-value::after { content:''; width:10px; height:10px; display:inline-block; background:#849aa6;
        -webkit-mask:var(--seta-baixo) center/contain no-repeat; mask:var(--seta-baixo) center/contain no-repeat; }
      .fc-dropdown-list { position:absolute; top:calc(100% + 4px); left:0; width:100%; background:#1a2026; border:1px solid rgba(255,255,255,0.1); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:100; display:none; flex-direction:column; padding:6px; max-height:200px; overflow-y:auto; }
      .fc-dropdown-list.open { display:flex; }
      .fc-dropdown-list::-webkit-scrollbar { width:4px; }
      .fc-dropdown-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:4px; }
      .fc-dropdown-item { padding:8px 12px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700; display:flex; align-items:center; transition:background 0.2s; }
      .fc-dropdown-item:hover { filter:brightness(1.2); }
      
      .fc-auto-group { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; background:rgba(255,255,255,0.02); padding:16px; border-radius:16px; border:1px dashed rgba(255,255,255,0.1); }
      .fc-auto-col { display:flex; flex-direction:column; gap:8px; }
      .fc-auto-col label { font-size:11px; color:#849aa6; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }

      .fc-side-col { width:340px; padding:32px 24px; background:rgba(0,0,0,0.2); display:flex; flex-direction:column; position:relative; }
      .fc-close { z-index:50; position:absolute; top:24px; right:24px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#849aa6; font-size:0; cursor:pointer; line-height:1; width:36px; height:36px; border-radius:50%; display:flex; justify-content:center; align-items:center; transition:all 0.2s; }
      .fc-close:hover { background:rgba(255,255,255,0.1); color:#fff; transform:scale(1.05); }
      
      .fc-side-title { font:800 11px monospace; color:#849aa6; letter-spacing:1px; margin-bottom:24px; }
      .fc-preview-card { background:radial-gradient(circle at top left, rgba(255,255,255,0.05), transparent), rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:16px; box-shadow:0 10px 30px rgba(0,0,0,0.3); }
      .fc-prev-head { display:flex; flex-direction:column; gap:4px; }
      .fc-prev-head b { color:#fff; font:800 18px/1.2 var(--mac-ui, sans-serif); word-break:break-word; }
      .fc-prev-head span { color:#b8d7df; font:600 13px var(--mac-ui, sans-serif); }
      
      .fc-prev-body { display:flex; flex-direction:column; gap:12px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.06); }
      .fc-prev-item { display:flex; flex-direction:column; gap:4px; }
      .fc-prev-item small { font:800 10px monospace; color:#627885; text-transform:uppercase; letter-spacing:0.5px; }
      .fc-prev-item div { color:#eef8fc; font:500 13px var(--mac-ui, sans-serif); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .fc-prev-tag { background:rgba(255,176,0,0.1); color:#ffb000; border:1px solid rgba(255,176,0,0.2); font:800 10px monospace; padding:2px 8px; border-radius:4px; text-transform:uppercase; }
      
      .fc-prev-users { display:flex; gap:6px; flex-wrap:wrap; }
      .fc-prev-users .fc-avatar { width:20px; height:20px; border:1px solid rgba(255,255,255,0.1); }
      
      .fc-helper-text { margin-top:24px; font-size:12px; color:#627885; line-height:1.5; font-family:var(--mac-ui, sans-serif); }
      
      @media(max-width: 900px) {
        .fc-modal { flex-direction:column; overflow-y:auto; }
        .fc-main-col { flex:none; border-right:none; border-bottom:1px solid rgba(255,255,255,0.06); }
        .fc-side-col { width:100%; box-sizing:border-box; border-radius:0 0 24px 24px; }
        .fc-body { overflow:visible; }
      }
      @media(max-width: 600px) {
        .fc-row { flex-direction:column; gap:8px; }
        .fc-label { margin-top:0; width:100%; }
        .fc-auto-group { grid-template-columns:1fr; }
        .fc-modal { margin:12px; height:auto; max-height:calc(100dvh - 24px); }
        .fc-body { padding:20px 24px; }
      }
    
      /* ─── Fluxo guiado ──────────────────────────────────────────────────── */
      .fc-trilha { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:26px; }
      .fc-trilha-passo { border:0; border-radius:999px; padding:4px 11px; cursor:pointer;
        background:rgba(255,255,255,.05); color:#7d8b96; font:600 10.5px var(--mac-ui,system-ui);
        transition:background-color .14s var(--curva), color .14s var(--curva); }
      .fc-trilha-passo:disabled { opacity:.4; cursor:default; }
      .fc-trilha-texto { display:none; }
      .fc-trilha-passo.feito { background:rgba(255,176,0,.10); color:#ffcf8a; }
      .fc-trilha-passo.agora { background:#ffb000; color:#061016; }
      .fc-pergunta { margin:0 0 5px; color:#fff; font:700 27px/1.15 var(--mac-ui,system-ui); letter-spacing:-.02em; }
      .fc-sub { margin:0 0 22px; color:#7d8b96; font:500 13px/1.45 var(--mac-ui,system-ui); }
      .fc-resposta { min-height:230px; }
      .fc-guia-rodape { display:flex; justify-content:flex-end; gap:10px; margin-top:26px;
        padding-top:18px; border-top:1px solid rgba(255,255,255,.07); }

      .fc-escolhas { display:flex; flex-wrap:wrap; gap:7px; max-height:320px; overflow-y:auto; padding:2px; }
      .fc-escolha { border:1px solid rgba(255,255,255,.11); border-radius:10px; padding:9px 14px;
        background:rgba(255,255,255,.03); color:#dfe6ec; cursor:pointer;
        font:600 13px var(--mac-ui,system-ui); text-align:left;
        transition:border-color .14s var(--curva), background-color .14s var(--curva); }
      .fc-escolha:hover { border-color:rgba(255,176,0,.5); background:rgba(255,176,0,.07); }
      .fc-escolha.marcada { border-color:#ffb000; background:rgba(255,176,0,.13); color:#fff; }
      .fc-escolha.grande { display:block; width:100%; padding:16px 18px; margin-bottom:9px; }
      .fc-escolha.grande b { display:block; font:700 16px var(--mac-ui,system-ui); }
      .fc-escolha.grande small { display:block; margin-top:3px; color:#7d8b96; font:500 12px var(--mac-ui,system-ui); }

      .fc-busca, .fc-campo, .fc-campo-grande, .fc-campo-texto { width:100%; box-sizing:border-box;
        border:1px solid rgba(255,255,255,.12); border-radius:10px; background:rgba(0,0,0,.28);
        color:#fff; font:600 14px var(--mac-ui,system-ui); padding:11px 13px;
        transition:border-color .14s var(--curva); }
      .fc-busca { margin-bottom:11px; }
      .fc-campo-grande { font:700 22px var(--mac-ui,system-ui); padding:14px; }
      .fc-campo-texto { min-height:130px; resize:vertical; font:500 14px/1.65 var(--mac-ui,system-ui); }
      .fc-busca:focus, .fc-campo:focus, .fc-campo-grande:focus, .fc-campo-texto:focus {
        border-color:#ffb000; outline:none; }
      .fc-dica { margin:11px 0 0; color:#7d8b96; font:500 12px var(--mac-ui,system-ui); }
      .fc-dica b { color:#bfe9f2; }

      .fc-datas { display:flex; gap:12px; flex-wrap:wrap; }
      .fc-datas label { flex:1 1 180px; display:block; }
      .fc-datas span { display:block; margin-bottom:6px; color:#7d8b96;
        font:600 10.5px var(--mac-ui,system-ui); text-transform:uppercase; letter-spacing:.05em; }

      .fc-atalhos { display:grid; gap:8px; margin-top:14px; }
      .fc-atalho { display:flex; align-items:flex-start; gap:10px; padding:11px 13px;
        border:1px solid rgba(255,255,255,.10); border-radius:10px; cursor:pointer;
        color:#dfe6ec; font:600 13px var(--mac-ui,system-ui);
        transition:border-color .14s var(--curva), background-color .14s var(--curva); }
      .fc-atalho:hover { border-color:rgba(255,176,0,.4); background:rgba(255,176,0,.05); }
      .fc-atalho input { margin-top:2px; accent-color:#ffb000; }
      .fc-atalho small { display:block; color:#7d8b96; font:500 11.5px var(--mac-ui,system-ui); }
      .fc-bloco-equipe { margin-top:20px; }
      .fc-bloco-equipe .fc-dica { margin:0 0 10px; }
      .fc-objetivo { margin:0 0 14px; } .fc-objetivo .fc-dica { display:block; margin:0 0 8px; } .fc-objetivo .fc-escolhas { display:flex; flex-wrap:wrap; gap:8px; }
      .fc-objetivo .fc-escolha { display:inline-flex; align-items:center; gap:8px; } .fc-objetivo-ponto { width:10px; height:10px; border-radius:50%; flex:none; }

      .fc-itens { display:grid; grid-template-columns:minmax(0,1fr); gap:10px; max-height:min(58vh,520px); overflow-y:auto; padding:2px; }
      /* A coluna automática crescia até o campo de data e o cartão vazava para a
         direita no celular. minmax(0,1fr) prende o cartão à largura da lista. */
      .fc-itens > .fc-item { min-width:0; }
      .fc-item input, .fc-item textarea { min-width:0; max-width:100%; box-sizing:border-box; }
      .fc-item { display:grid; gap:8px; padding:12px; border:1px solid rgba(255,255,255,.10);
        border-radius:12px; background:rgba(255,255,255,.02); }
      .fc-item:focus-within { border-color:rgba(255,176,0,.42); }
      .fc-item-topo { display:flex; align-items:center; gap:10px; }
      .fc-item-topo b { display:grid; place-items:center; width:20px; height:20px; flex:none;
        border-radius:50%; background:rgba(255,176,0,.14); color:#ffcf8a;
        font:700 10px var(--mac-ui,system-ui); }
      .fc-item-topo span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        color:#7d8b96; font:600 11.5px var(--mac-ui,system-ui); }
      .fc-item-datas { display:flex; gap:10px; flex-wrap:wrap; }
      .fc-item-datas label { flex:1 1 150px; }
      .fc-item-datas span { display:block; margin-bottom:4px; color:#7d8b96;
        font:600 10px var(--mac-ui,system-ui); text-transform:uppercase; letter-spacing:.05em; }
      .fc-item .fc-campo-texto { min-height:132px; max-height:340px; line-height:1.65; padding:12px 13px; }

      /* Arquivos de referencia: a area inteira do cartao aceita o arraste, e a
         faixa abaixo do briefing e o alvo visivel para quem prefere clicar. */
      .fc-item.arrastando { border-color:rgba(255,176,0,.6); background:rgba(255,176,0,.06); }
      .fc-arqs { display:flex; align-items:center; gap:9px; width:100%; box-sizing:border-box;
        border:1px dashed rgba(255,255,255,.18); border-radius:10px; padding:9px 12px;
        background:rgba(255,255,255,.02); color:#7d8b96; cursor:pointer;
        font:500 12px var(--mac-ui,system-ui); text-align:left;
        transition:border-color .15s, color .15s, background .15s; }
      .fc-arqs:hover { border-color:rgba(255,176,0,.45); color:#ffd9a6; background:rgba(255,176,0,.05); }
      .fc-arqs b { font:700 14px var(--mac-ui,system-ui); color:#ffd9a6; }
      .fc-arqs small { margin-left:auto; color:#5c6b76; font-size:11px; }
      .fc-arq-lista { display:flex; flex-wrap:wrap; gap:6px; }
      .fc-arq { display:inline-flex; align-items:center; gap:7px; max-width:100%;
        background:rgba(255,176,0,.08); border:1px solid rgba(255,176,0,.28); border-radius:999px;
        padding:4px 5px 4px 11px; color:#cfeef5; font:500 12px var(--mac-ui,system-ui); }
      .fc-arq span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:210px; }
      .fc-arq small { color:#6f8590; font-size:10px; font-variant-numeric:tabular-nums; }
      .fc-arq button { width:18px; height:18px; flex:none; border:0; border-radius:999px;
        background:rgba(255,255,255,.1); color:#9fb4bf; cursor:pointer; font-size:12px; line-height:1; }
      .fc-arq button:hover { background:rgba(255,92,124,.25); color:#fff; }
      .fc-itens-acoes { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .fc-mais { border:1px dashed rgba(255,176,0,.34); border-radius:10px; padding:8px 12px;
        background:transparent; color:#ffcf8a; cursor:pointer; font:600 12px var(--mac-ui,system-ui);
        transition:background-color .14s var(--curva), border-color .14s var(--curva); }
      .fc-mais:hover { background:rgba(255,176,0,.08); border-color:#ffb000; }
      .fc-nova-opcao { display:grid; gap:12px; padding:18px; margin-top:16px;
        border:1px solid var(--mac-border,rgba(255,255,255,.16)); border-radius:16px;
        background:var(--mac-surface,rgba(255,255,255,.04)); }
      .fc-nova-opcao label { font-size:15px; font-weight:600; color:#f5f5f7; }
      .fc-nova-opcao p { margin:0; font-size:13px; line-height:1.5; color:#afb5c2; }
      .fc-nova-opcao [role="alert"] { color:#ff9cae; }
      .fc-nova-opcao input { width:100%; min-width:0; box-sizing:border-box; }
      .fc-resposta > .fc-mais { margin-top:14px; }
      .fc-auto-col > .fc-mais { align-self:flex-start; }
      .fc-escala { display:grid; gap:12px; margin:0 0 14px; padding:16px; border:1px solid rgba(255,176,0,.28);
        border-radius:14px; background:rgba(255,176,0,.05); }
      .fc-escala b { color:#e7ecf5; font:600 14px var(--mac-ui, system-ui); }
      .fc-escala small { color:#9da4b4; font:400 12px/1.45 var(--mac-ui, system-ui); }
      .fc-escala-campos { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
      .fc-escala-campos label { display:grid; gap:6px; color:#9da4b4; font:500 12px var(--mac-ui, system-ui); }
      .fc-escala-acoes { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .fc-escala-previa { color:#ffe4b7; font:500 12.5px var(--mac-ui, system-ui); }
      .fc-item-data { margin-left:auto; padding:3px 9px; border-radius:999px; background:rgba(255,255,255,.07);
        color:#e7ecf5; font:600 12px var(--mac-ui, system-ui); font-variant-numeric:tabular-nums; white-space:nowrap; }
      @media (max-width:640px) { .fc-escala-campos { grid-template-columns:1fr; } }
      /* Preencher em lista: lista curta à esquerda, conteúdo escolhido à direita. */
      .fc-preencher { display:grid; grid-template-columns:minmax(200px, 260px) minmax(0, 1fr); gap:14px; min-height:0; }
      .fc-lista { display:flex; flex-direction:column; gap:8px; min-width:0; }
      .fc-lista-topo { display:grid; gap:2px; }
      .fc-lista-topo b { color:#e7ecf5; font:600 13px var(--mac-ui, system-ui); }
      .fc-lista-topo small { color:#ffb0bc; font:500 12px var(--mac-ui, system-ui); }
      .fc-lista-linhas { position:relative; display:grid; gap:2px; max-height:min(52vh, 460px); overflow-y:auto; padding:2px; }
      .fc-lista-linha { display:grid; grid-template-columns:14px auto minmax(0,1fr); align-items:center; gap:8px;
        padding:8px 10px; border:0; border-radius:9px; background:transparent; color:#c3cad6; text-align:left; cursor:pointer;
        font:500 12.5px var(--mac-ui, system-ui); }
      .fc-lista-linha:hover { background:rgba(255,255,255,.06); }
      .fc-lista-linha.ativa { background:rgba(255,176,0,.12); color:#fff; }
      .fc-lista-linha i { font-style:normal; font-size:10px; color:#ff9aa8; }
      .fc-lista-linha.pronta i { color:#6ee7a8; font-size:12px; }
      .fc-lista-data { color:#9da4b4; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .fc-lista-linha.ativa .fc-lista-data { color:#ffe4b7; }
      .fc-lista-titulo { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .fc-lista-acoes { display:flex; flex-wrap:wrap; gap:6px; }
      .fc-editor { display:flex; flex-direction:column; gap:10px; min-width:0; padding:14px; border:1px solid rgba(255,255,255,.08);
        border-radius:14px; background:rgba(255,255,255,.02); }
      .fc-editor-topo { display:flex; align-items:center; gap:10px; color:#9da4b4; font:500 12.5px var(--mac-ui, system-ui); }
      .fc-editor-topo b { color:#e7ecf5; font-weight:600; }
      .fc-editor-topo .icone-btn { margin-left:auto; }
      .fc-editor-briefing { min-height:min(34vh, 300px) !important; }
      .fc-editor-nav { display:flex; flex-wrap:wrap; gap:8px; }
      .fc-editor-nav .primario { margin-left:auto; border-style:solid; background:rgba(255,176,0,.12); color:#fff4e8; }
      .fc-editor-nav button:disabled { opacity:.4; cursor:default; }
      .fc-editor-dica { color:#7d8594; font:500 11.5px var(--mac-ui, system-ui); }
      .fc-lista-select { display:none; }
      @media (max-width:760px) {
        .fc-preencher { grid-template-columns:1fr; }
        .fc-lista-linhas, .fc-lista-topo { display:none; }
        .fc-lista { order:2; }
        .fc-lista-select { display:block; width:100%; height:36px; padding:0 10px; border:1px solid rgba(255,255,255,.12);
          border-radius:10px; background:rgba(255,255,255,.04); color:#e7ecf5; font:500 13px var(--mac-ui, system-ui); }
        .fc-editor-dica { display:none; }
      }
`;
    document.head.appendChild(style);
  }

  let fcEnviando = false;

  let state = {
    // Cinco cards com briefings e veiculacoes diferentes: o que se repete e
    // cliente, formato e destino; o que muda e titulo, data e briefing. Entao a
    // lista guarda so o que muda, e o resto continua valendo para o lote todo.
    itens: [{ titulo: '', veic: '', prazo: '', brief: '' }],
    // Objetivo do lote (Atração, Educação ou Conversão): opcional, vale para todos os cartões.
    objetivo: '',
    title: '',
    client: '', clients: [],
    format: '',
    veic: '',
    prazo: '',
    brief: '',
    assignees: [],
    // Quem a regra escolheu e a pessoa tirou a mao. Sem guardar, a regra devolvia
    // o nome no proximo redesenho e o clique parecia nao ter funcionado.
    removidos: [],
    materialReady: false,
    materialBruto: '',
    briefReady: false,
    manualGroup: undefined,
    manualStatus: undefined,
    manualCap: undefined,
    // 'producao' ou 'demandas'. Antes não existia: tudo ia para Produção, e
    // Solicitações só recebia item criado dentro do Monday.
    board: 'producao',
    prioridade: ''
  };

// O que muda entre os dois quadros. Grupos, status e o terceiro campo não são
// os mesmos — em Produção é Captação, em Demandas é Prioridade.
const FC_QUADROS = {
  producao: {
    id: 7829537690,
    nome: 'Produção de conteúdo',
    // Os grupos vêm do banco (vybe-grupos.js); a lista fixa é a rede para
    // quando a leitura ainda não chegou.
    get grupos() { return (typeof gruposParaCadastro === 'function' && gruposParaCadastro('producao')) || this.gruposFixos; },
    gruposFixos: [
      { val: 'group_title', label: 'Redação' },
      { val: 'novo_grupo__1', label: 'Design & Edição' },
      { val: 'novo_grupo57911__1', label: 'Produção (Foto e Vídeo)' },
      { val: 'novo_grupo22352__1', label: 'Gestão de publicações' },
      { val: 'novo_grupo31348__1', label: 'Finalizados' }
    ],
    status: ['A Fazer','Aguardo Redação','Pode Fazer','Falta D.A','Em andamento','Aguardo',
             'Ag. Aprovação Cliente','Ag. Info Cliente','Falta Info','Segurar Post','Agendado',
             'Finalizado','Feito'],
    formatos: null,
    rotuloFormato: 'Formato'
  },
  demandas: {
    id: 8385559107,
    nome: 'Solicitação de demanda',
    get grupos() { return (typeof gruposParaCadastro === 'function' && gruposParaCadastro('demandas')) || this.gruposFixos; },
    gruposFixos: [
      { val: 'group_mm187437', label: 'Novas Demandas/Ideias' },
      { val: 'novo_grupo_mkmkjdqd', label: 'A Fazer' },
      { val: 'novo_grupo_mkkyfhtw', label: 'Em Execução' },
      { val: 'novo_grupo_mkkyx8pv', label: 'Concluídas' }
    ],
    status: ['Nova Demanda','Aguardando Info.','Para Orçar','Em Orçamento','Pode Fazer',
             'Em execução','Em impressão','Em aprovação','Alteração','Aprovado','Feito'],
    formatos: ['Impresso','Fotografia','Card','Digital','Texto','Vídeo','Design','Avulso',
               'Post','Implementação','Planejamento','Reunião'],
    rotuloFormato: 'Tipo de demanda'
  }
};
const FC_PRIORIDADES = ['', 'Crítica', 'Alta', 'Média', 'Baixa', 'Preventiva'];
function fcQuadro() { return FC_QUADROS[state.board] || FC_QUADROS.producao; }
// O mesmo catálogo usado nas tabelas; listas fixas apenas antes da primeira leitura.
function fcConfigOpcao(campo) {
  const cfg = {
    client: { nome: 'cliente', titulo: 'Novo cliente' },
    format: { nome: fcQuadro().rotuloFormato.toLowerCase(), titulo: state.board === 'demandas' ? 'Novo tipo de demanda' : 'Novo formato', coluna: state.board === 'demandas' ? 'dropdown_mkv8d52z' : 'lista_suspensa0__1' },
    manualGroup: { nome: 'grupo', titulo: 'Novo grupo' },
    manualStatus: { nome: 'status', titulo: 'Novo status', coluna: `status:${fcQuadro().id}` },
    manualCap: { nome: 'captação', titulo: 'Nova opção de captação', coluna: 'status_1__1' },
    prioridade: { nome: 'prioridade', titulo: 'Nova prioridade', coluna: 'color_mkwtgakv' }
  };
  return cfg[campo];
}
function fcListaCatalogo(campo) {
  if (campo === 'manualGroup') return fcQuadro().grupos.map(g => g.label);
  let fonte;
  if (campo === 'manualStatus') fonte = state.board === 'demandas'
    ? (typeof CATALOGO_STATUS_DEMANDAS === 'undefined' ? [] : CATALOGO_STATUS_DEMANDAS)
    : (typeof STATUS_OPTIONS === 'undefined' ? [] : STATUS_OPTIONS);
  else if (campo === 'manualCap') fonte = typeof CATALOGO_CAPTACAO === 'undefined' ? [] : CATALOGO_CAPTACAO;
  else fonte = (typeof CATALOGO_OPCOES === 'undefined' ? [] : CATALOGO_OPCOES)
    .filter(o => o.coluna_id === fcConfigOpcao(campo).coluna);
  if (fonte.length) return fonte.filter(o => o.ativa !== false).map(o => o.rotulo || o.label);
  if (campo === 'format') return fcQuadro().formatos || CADASTROS_FORMATS;
  if (campo === 'manualStatus') return fcQuadro().status;
  if (campo === 'prioridade') return FC_PRIORIDADES.filter(Boolean);
  return ['Captação Agendada', 'Captação Feita', 'Agendar Captação', 'Editado', 'A fazer', 'Captação em Andamento'];
}
function fcStatusSugerido(sugerido) {
  const opcoes = fcListaCatalogo('manualStatus');
  // O destino automático foi escrito para Produção. Demandas deve usar um
  // status do seu próprio catálogo, inclusive quando um tipo acaba de nascer.
  return opcoes.find(s => chaveDeStatus(s) === chaveDeStatus(sugerido))
    || opcoes.find(s => chaveDeStatus(s) === (state.board === 'demandas' ? 'nova_demanda' : 'a_fazer'))
    || opcoes[0] || sugerido;
}
function fcPodeAdicionar(campo) {
  if (!fcConfigOpcao(campo)) return false;
  if (campo === 'client') return typeof podeEditarClientes === 'function' && podeEditarClientes();
  if (campo === 'manualGroup') return typeof podeEditarGrupos === 'function' && podeEditarGrupos();
  return typeof podeGerirEtiquetas === 'function' && podeGerirEtiquetas();
}
function fcAdicionarOpcaoHtml(campo) {
  return fcPodeAdicionar(campo) ? `<button type="button" class="nd-chip nd-novo" data-adicionar="${campo}"
    onclick="fcAbrirNovaOpcao('${campo}')">${esc(fcConfigOpcao(campo).titulo)}</button>` : '';
}
window.fcAbrirNovaOpcao = function(campo) {
  if (fcEnviando || !fcPodeAdicionar(campo)) return;
  fcSincronizarDaTela();
  document.getElementById('fc-nova-opcao')?.remove();
  document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
  const cfg = fcConfigOpcao(campo);
  const caixa = document.createElement('div');
  caixa.id = 'fc-nova-opcao'; caixa.className = 'fc-nova-opcao'; caixa.dataset.campo = campo;
  caixa.innerHTML = `<label for="fc-nova-opcao-nome">${esc(cfg.titulo)}</label>
    <p>Fica disponível para toda a equipe, mesmo se você cancelar este cadastro.</p>
    <input id="fc-nova-opcao-nome" class="fc-campo" autocomplete="off" maxlength="${campo === 'client' ? 120 : 40}" placeholder="Nome da opção">
    <p id="fc-nova-opcao-erro" role="alert" hidden></p>
    <div class="fc-itens-acoes"><button type="button" class="fc-btn-cancel" onclick="fcCancelarNovaOpcao()">Cancelar</button>
    <button type="button" class="fc-btn-create" onclick="fcSalvarNovaOpcao()">Salvar e selecionar</button></div>`;
  document.querySelector('#fc-guia .fc-resposta').appendChild(caixa);
  caixa.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.stopPropagation(); void fcSalvarNovaOpcao(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fcCancelarNovaOpcao(); }
  });
  document.getElementById('fc-nova-opcao-nome').focus();
};
window.fcCancelarNovaOpcao = function() {
  if (fcEnviando) return;
  const caixa = document.getElementById('fc-nova-opcao');
  const campo = caixa?.dataset.campo; caixa?.remove();
  document.querySelector(`[data-adicionar="${campo}"]`)?.focus();
};
window.fcSalvarNovaOpcao = async function() {
  const caixa = document.getElementById('fc-nova-opcao');
  if (!caixa || fcEnviando) return;
  const campo = caixa.dataset.campo, cfg = fcConfigOpcao(campo);
  const input = document.getElementById('fc-nova-opcao-nome');
  const aviso = document.getElementById('fc-nova-opcao-erro');
  const nome = input.value.trim();
  const erro = texto => { aviso.textContent = texto; aviso.hidden = false; };
  if (!fcPodeAdicionar(campo)) return erro('Só quem administra pode adicionar opções.');
  if (!nome) { input.focus(); return erro('Escreva o nome para continuar.'); }
  if (campo === 'format' && nome.includes(',')) return erro('Cadastre um tipo por vez, sem vírgula no nome.');
  const lista = campo === 'client' ? cadastrosClientOptions() : fcListaCatalogo(campo);
  const existente = lista.find(n => n.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0);
  if (existente) return erro(`“${existente}” já está na lista. Cancele e selecione essa opção.`);
  fcEnviando = true;
  const overlay = document.getElementById('fc-overlay');
  overlay.inert = true; overlay.setAttribute('aria-busy', 'true');
  aviso.hidden = false; aviso.textContent = 'Salvando…';
  let salvo = false;
  try {
    let valor;
    if (campo === 'client') {
      const d = await gravarCadastroDeCliente({ acao: 'criar', nome }, 'Cliente criado só com o nome. Depois, complete a ficha em Clientes → Cadastro.');
      if (!d.cliente?.nome) throw new Error('O servidor não confirmou o cliente.');
      valor = typeof normalizarCliente === 'function' ? normalizarCliente(d.cliente.nome) : d.cliente.nome;
      const i = CADASTRO_CLIENTES.findIndex(c => String(c.id) === String(d.cliente.id));
      if (i < 0) CADASTRO_CLIENTES.push(d.cliente); else CADASTRO_CLIENTES[i] = { ...CADASTRO_CLIENTES[i], ...d.cliente };
    } else if (campo === 'manualGroup') {
      const d = await mudarGrupo(state.board, { acao: 'criar', titulo: nome, cor: '#579bfc' });
      if (!d?.grupo_id) throw new Error('Não foi possível criar o grupo. Confira a mensagem e tente novamente.');
      valor = d.grupo_id;
    } else {
      const d = await chamarEtiqueta({ acao: 'criar', coluna: cfg.coluna, rotulo: nome });
      if (!d.etiqueta?.chave) throw new Error('O servidor não confirmou a opção.');
      valor = d.etiqueta.rotulo;
      // A resposta da gravação é autoritativa; não depende de uma segunda leitura.
      const o = d.etiqueta;
      if (campo === 'manualStatus') {
        if (state.board === 'demandas') CATALOGO_STATUS_DEMANDAS.push(o);
        else STATUS_OPTIONS.push({ ...o, label: o.rotulo, color: o.cor });
      } else if (campo === 'manualCap') CATALOGO_CAPTACAO.push(o);
      else CATALOGO_OPCOES.push({ ...o, coluna_id: cfg.coluna });
    }
    if (campo === 'client') { state.clients = [...new Set([...(state.clients || (state.client ? [state.client] : [])), valor])]; state.client = state.clients[0]; }
    else state[campo] = valor;
    salvo = true;
  } catch (e) { erro(e.message || 'Não foi possível salvar. Tente novamente.'); }
  finally { fcEnviando = false; overlay.inert = false; overlay.removeAttribute('aria-busy'); }
  if (salvo) {
    fcDesenharPasso();
    document.querySelector(`[data-adicionar="${campo}"]`)?.focus();
    showToast('Opção salva e selecionada. Você pode continuar.', 'ok');
  } else input.focus();
};
// A regra de entrada (cadastrosDestiny) foi escrita para Produção e devolve os
// grupos de lá. Em Solicitações isso punha Impresso e Design no "Design &
// Edição" de Produção — um grupo que não existe no quadro. Grupo de outro quadro
// cai no primeiro grupo deste.
function fcGrupoDoQuadro(grupo) {
  const grupos = fcQuadro().grupos;
  return grupos.some((g) => g.val === grupo) ? grupo : grupos[0].val;
}

  window.fcTrocarQuadro = function(qual) {
    if (state.board === qual) return;
    state.board = qual;
    // Grupo e status do quadro anterior não existem no novo — deixar para trás
    // faria o servidor recusar a criação com "status não existe neste board".
    state.manualGroup = undefined;
    state.manualStatus = undefined;
    state.manualCap = undefined;
    state.prioridade = '';
    state.format = '';
    document.querySelectorAll('.fc-destino-btn').forEach((b) => b.classList.remove('ativo'));
    document.getElementById(`fc-destino-${qual}`)?.classList.add('ativo');
    const rotulo = document.getElementById('fc-label-formato');
    if (rotulo) rotulo.textContent = fcQuadro().rotuloFormato;
    fcMontarFormatos();
    if (typeof renderCustomDropdownsGlobal === 'function') renderCustomDropdownsGlobal();
    updateDestinyUI();
  };

  // A lista de formato muda de quadro: Produção usa os formatos de conteúdo,
  // Demandas usa "Tipo de demanda", que é outra coluna e outra lista.
  window.fcMontarFormatos = function() {
    const campo = document.getElementById('fc-format-input');
    if (!campo) return;
    const quadro = fcQuadro();
    const lista = fcListaCatalogo('format');
    campo.innerHTML = `<option value="">Selecionar ${quadro.rotuloFormato.toLowerCase()}...</option>`
      + lista.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    campo.value = state.format || '';
  };

  function updateDestinyUI() {
     if(typeof cadastrosDestiny !== 'function') return;
     const formatName = state.format || 'Formato Padrão';
     const dest = cadastrosDestiny(formatName, state.briefReady, state.materialReady, state.assignees);
     
     {
         const groups = Object.fromEntries(fcQuadro().grupos.map(g=>[g.val,g.label]));
         const grupo = fcGrupoDoQuadro(state.manualGroup !== undefined ? state.manualGroup : dest.group);
         fcSelectDropdown('manualGroup', grupo, groups[grupo] || grupo, null, false);
     }
     
     {
         const statusAtual = state.manualStatus !== undefined ? state.manualStatus : fcStatusSugerido(dest.status);
         const getCol = fcCorDeStatus;
         const col = getCol(statusAtual).color;
         fcSelectDropdown('manualStatus', statusAtual, statusAtual, {color: col}, false);
     }
     
     {
         const capVal = state.manualCap !== undefined ? state.manualCap : (dest.capture ? 'Agendar Captação' : '');
         const capText = capVal || '- Nenhuma -';
         const getCol = fcCorDeStatus;
         const col = capVal ? getCol(capVal).color : null;
         fcSelectDropdown('manualCap', capVal, capText, col ? {color: col} : null, false);
     }
     
     updateLivePreview(dest);
  }
  
  function updateLivePreview(dest) {
     const titleEl = document.getElementById('fc-prev-title');
     const clientEl = document.getElementById('fc-prev-client');
     const groupEl = document.getElementById('fc-prev-group');
     const statusEl = document.getElementById('fc-prev-status');
     const datesEl = document.getElementById('fc-prev-dates');
     const usersEl = document.getElementById('fc-prev-users');
     
     if(!titleEl) return;
     
     const formatText = state.format || 'Formato';
     const titleText = state.title || 'Título pendente';
     const n = (state.itens || []).length;
     // Em lote a previa mostra o primeiro e diz quantos vem atras — o destino e
     // a equipe sao os mesmos para todos, entao um cartao ja representa o lote.
     titleEl.textContent = n > 1
       ? `${formatText} - ${titleText}  +${n - 1}`
       : `${formatText} - ${titleText}`;
     // Os clientes com o ponto da carteira de cada um.
     const escolhidos = state.clients?.length ? state.clients : (state.client ? [state.client] : []);
     const carteira = (c) => (typeof carteiraDoCliente === 'function' ? carteiraDoCliente(c) : '');
     if (escolhidos.length) clientEl.innerHTML = escolhidos.map((c) => `<span class="nd-cli" data-carteira="${esc(carteira(c))}">${esc(c)}</span>`).join(' ');
     else clientEl.textContent = 'Cliente não selecionado';

     const groups = Object.fromEntries(fcQuadro().grupos.map(g=>[g.val,g.label]));
     const finalGroup = fcGrupoDoQuadro(state.manualGroup !== undefined ? state.manualGroup : dest.group);
     const finalGroupLabel = groups[finalGroup] || 'Redação';
     const finalStatus = state.manualStatus !== undefined ? state.manualStatus : fcStatusSugerido(dest.status);
     const finalCap = state.manualCap !== undefined ? state.manualCap : (dest.capture ? 'Agendar Captação' : '');

     groupEl.textContent = finalGroupLabel;

     // A pílula tira o fundo claro e o texto escuro da cor que o status tem no quadro.
     const pilula = (rotulo, cor) => `<span class="nd-pill" style="--c:${cor}">${esc(rotulo)}</span>`;
     statusEl.innerHTML = pilula(finalStatus, fcCorDeStatus(finalStatus).color)
       + (finalCap ? pilula(`Captação: ${finalCap}`, fcCorDeStatus(finalCap).color) : '');

     const diaDaSemana = (iso) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${iso}T12:00:00`).getDay()];
     datesEl.textContent = state.veic
       ? `${state.board === 'demandas' ? 'conclusão' : 'no ar'} ${diaDaSemana(state.veic)} ${state.veic.slice(8, 10)}/${state.veic.slice(5, 7)}`
       : 'sem data';

     const users = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
     const assignedUsers = fcEquipeFinal(dest).map(id => users.find(u => String(u.id) === String(id))).filter(Boolean);
     
     usersEl.textContent = assignedUsers.length
       ? assignedUsers.map((u) => String(u.name).split(' ')[0]).join(', ')
       : 'triagem';
  }

  window.fcHandleInput = function(key, val) {
     // Era `if(isManual)`, e isManual nao existe aqui: e parametro de
     // fcSelectDropdown, outra funcao. Toda tecla no titulo, toda troca de
     // cliente e todo checkbox estouravam ReferenceError e nada chegava no
     // state — por isso a previa nunca saia de "Cliente nao selecionado".
     state[key] = val;
     
     if(key === 'veic' && val) {
        state.prazo = getOffsetDate(val, -7);
        const pEl = document.getElementById('fc-prazo');
        if(pEl) pEl.value = state.prazo;
     }

     updateDestinyUI();
  };
  
  // A EQUIPE QUE VAI DE VERDADE.
  //
  // Antes existiam dois conjuntos: o que a regra escolhe (dest.assignees) e os
  // "extras" que a pessoa soma. Nao havia como TIRAR quem veio da regra — as
  // fichas de baixo so somavam, e as tres bolinhas da previa eram intocaveis.
  //
  // Agora quem manda e esta funcao, e ela e a unica: as fichas, a previa e o que
  // vai para o servidor leem daqui. Ler de lugares diferentes era o que fazia a
  // tela e o resultado discordarem.
  function fcEquipeFinal(dest) {
     const fora = new Set((state.removidos || []).map(String));
     return (dest?.assignees || []).map(String).filter((id) => !fora.has(id));
  }

  window.fcTogglePerson = function(id) {
     const chave = String(id);
     const dest = typeof cadastrosDestiny === 'function'
       ? cadastrosDestiny(state.format || '', state.briefReady, state.materialReady, state.assignees) : { assignees: [] };
     const daRegra = (dest.assignees || []).map(String).includes(chave)
       && !(state.assignees || []).map(String).includes(chave);
     const estaDentro = fcEquipeFinal(dest).includes(chave);

     if (estaDentro) {
        // Tirar tem dois jeitos, porque a pessoa pode ter entrado por dois
        // caminhos: se foi somada a mao, some da lista de extras; se veio da
        // regra, entra na lista de removidos — senao a regra a traria de volta.
        state.assignees = (state.assignees || []).filter((x) => String(x) !== chave);
        if (daRegra) state.removidos = [...new Set([...(state.removidos || []).map(String), chave])];
     } else {
        state.removidos = (state.removidos || []).filter((x) => String(x) !== chave);
        if (!(dest.assignees || []).map(String).includes(chave)) state.assignees.push(id);
     }
     state.pessoasAbertas = true;
     fcDesenharPasso();
     Array.from(document.querySelectorAll('#fc-persons-container .nd-chip')).find((b) => b.getAttribute('onclick') === `fcTogglePerson('${id}')`)?.focus({ preventScroll: true });
  };

  function renderPersons() {
     const container = document.getElementById('fc-persons-container');
     if(!container) return;
     const users = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
     const dest = typeof cadastrosDestiny === 'function'
       ? cadastrosDestiny(state.format || '', state.briefReady, state.materialReady, state.assignees) : { assignees: [] };
     const dentro = new Set(fcEquipeFinal(dest));
     const porRegra = new Set((dest.assignees || []).map(String)
       .filter((id) => !(state.assignees || []).map(String).includes(id)));
     const fora = new Set((state.removidos || []).map(String));
     container.innerHTML = users.map(u => {
        const id = String(u.id);
        const active = dentro.has(id);
        // Marcar quem veio da regra explica por que a ficha ja nasceu ligada, e
        // deixa claro que tirar dali e uma excecao consciente, nao um descuido.
        const selo = active && porRegra.has(id) ? '<i class="nd-selo" title="Escolhido pela regra do formato">regra</i>'
          : (fora.has(id) ? '<i class="nd-selo" title="A regra escolheria, você tirou">tirado</i>' : '');
        return `<button type="button" role="checkbox" aria-checked="${active}" class="nd-chip${active ? ' on' : ''}"
               onclick="fcTogglePerson('${u.id}')" title="${active ? 'Clique para tirar' : 'Clique para somar'} ${esc(u.name)}">
             <span class="nd-av">${esc(String(u.name).trim().slice(0, 2).toUpperCase())}</span>${esc(u.name.split(' ')[0])}${selo}</button>`;
     }).join('');
  }

  // Cria UM conteudo. O laco de fora repete isto para cada cartao da lista.
  async function fcCriarUm(item, dest, finalGroup, finalStatus, finalCap) {
     const normalized = `${state.format} - ${String(item.titulo).trim()}`;

     try {
        // Grava no banco da Vybe, que é a fonte da verdade. O id devolvido
        // (externo legado ou "vybe:<id>") já deixa o conteúdo operável.
        let itemId = null;
        const pelaEscritaDupla = await tentarEscritaDupla({ id: '' }, {
           acao: 'criar', board: fcQuadro().id,
           titulo: normalized, cliente: state.clienteNoBanco || state.client, clientes: state.clientesNoBanco, formato: state.format,
           prazo: item.prazo, veiculacao: item.veic, status: chaveDeStatus(finalStatus),
           grupo_id: finalGroup, briefing: item.brief,
           // "Tipo de conteúdo" só existe em Produção, e lá "Post" (3) é o único
           // rótulo que não está desativado no board.
           tipo_conteudo: state.board === 'demandas' ? null : 3,
           captacao: state.board === 'demandas' ? null : (finalCap || null),
           prioridade: state.board === 'demandas' ? (state.prioridade || null) : null,
           material_bruto: state.materialBruto || null,
           objetivo: state.board === 'demandas' ? null : (state.objetivo || null),
           responsaveis: fcEquipeFinal(dest),
           _devolve: true,
        });
        if (pelaEscritaDupla?.item_id) itemId = String(pelaEscritaDupla.item_id);
        // O ID local mantém o conteúdo imediatamente operável. A fila liga esse
        // registro ao ID externo quando a contingência do Monday voltar.
        else if (pelaEscritaDupla?.conteudo_id) {
          itemId = `vybe:${pelaEscritaDupla.conteudo_id}`;
          showToast('✓ Criado no Vybe · cópia de contingência enfileirada', 'info', 7000);
        }
        // Sem id do banco não há para onde recorrer: o Monday está encerrado.
        if(!itemId && !pelaEscritaDupla?.conteudo_id) throw new Error('O banco não devolveu o ID do conteúdo criado.');

        const hellen = state.client.toLowerCase().includes('hellen rocha') ? '<li>✅ Validar informações jurídicas com a Hellen antes de publicar</li>' : '';
        const captureLine = finalCap ? `<li>📸 Agendar e confirmar captação externa</li>` : '';
        const update = `<p><strong>🚀 CHECKLIST DE PRÉ-PRODUÇÃO</strong></p><p><strong>Briefing:</strong> ${esc(item.brief)}</p><ul><li>✅ Revisar copy e adaptar ao tom da marca</li><li>✅ Selecionar referências visuais / banco de imagens</li><li>✅ Montar layout no padrão do cliente</li>${captureLine}<li>✅ Enviar para aprovação antes de publicar</li>${hellen}</ul>`;
        
        // O checklist usa o mesmo ID do conteúdo, inclusive o ID próprio vybe:.
        // Assim o histórico nasce no banco e a cópia externa pode chegar depois.
        if (itemId) { try { await postItemUpdate(itemId, update); } catch (erro) { console.warn('Conteúdo criado, mas o checklist não foi registrado.', erro); } }

        return { ok: true, id: itemId, nome: normalized };
     } catch (e) {
        return { ok: false, nome: normalized, erro: e.message };
     }
  }

  window.fcSubmit = async function() {
     if (fcEnviando) return;
     fcSincronizarDaTela();
     const faltando = FC_PASSOS.find((q) => !fcRespondido(q));
     if (faltando) {
        fcPasso = FC_PASSOS.indexOf(faltando);
        fcDesenharPasso();
        return typeof showToast === 'function'
          ? showToast(FC_FALTA[faltando] || 'Falta responder esta.', 'info') : null;
     }

     const dest = cadastrosDestiny(state.format, state.briefReady, state.materialReady, state.assignees);
     const finalGroup = fcGrupoDoQuadro(state.manualGroup !== undefined ? state.manualGroup : dest.group);
     const finalStatus = state.manualStatus !== undefined ? state.manualStatus : fcStatusSugerido(dest.status);
     const finalCap = state.manualCap !== undefined ? state.manualCap : (dest.capture ? 'Agendar Captação' : '');

     const btn = document.getElementById('fc-submit-btn');
     const rotuloBotao = btn?.textContent;
     const total = state.itens.length;
     const overlay = document.getElementById('fc-overlay');
     let fechar = false;
     fcEnviando = true;
     if (overlay) { overlay.inert = true; overlay.setAttribute('aria-busy', 'true'); }
     try {
     // A ficha de clientes e a mesma da tela Clientes; carregada uma vez, serve
     // para todos os cartoes da lista.
     if (btn) { btn.disabled = true; btn.textContent = 'Conferindo o cliente...'; }
     if (typeof ensureClientMasterSources === 'function') {
       try { await ensureClientMasterSources(); } catch { /* segue com o nome da tela */ }
     }
     state.clientesNoBanco = (state.clients?.length ? state.clients : [state.client]).map(nome => cadastroNomeNoBanco(nome,
       typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : [],
       typeof normalizarCliente === 'function' ? normalizarCliente : null));
     state.clienteNoBanco = state.clientesNoBanco[0];
     const feitos = [];
     const falhas = [];
     const itensFalhos = [];
     const arquivosQueFalharam = [];

     // Cada resultado pertence ao cartão, mesmo quando os títulos são iguais.
     for (let n = 0; n < total; n++) {
        if (btn) { btn.disabled = true; btn.textContent = total > 1 ? `Criando ${n + 1} de ${total}...` : 'Criando...'; }
        const r = await fcCriarUm(state.itens[n], dest, finalGroup, finalStatus, finalCap);
        (r.ok ? feitos : falhas).push(r);
        if (!r.ok) itensFalhos.push(state.itens[n]);
        // Arquivo so tem onde ser pendurado depois que a peca existe. Se o
        // envio falhar a peca FICA: ela ja esta criada, e refazer o cadastro
        // duplicaria o conteudo por causa de uma imagem.
        if (r.ok && r.id) {
          const refs = state.itens[n].arquivos || [];
          for (let k = 0; k < refs.length; k += 1) {
            if (btn) btn.textContent = `Enviando referência ${k + 1} de ${refs.length}...`;
            try { await enviarArquivoDaPeca(r.id, refs[k]); }
            catch (erro) { arquivosQueFalharam.push(`${refs[k].name}: ${erro.message}`); }
          }
        }
     }

     // O aviso de referencia que nao subiu NAO pode ser um toast: showToast usa
     // um elemento so, e o "✓ conteudos criados" logo abaixo apagaria a unica
     // frase que diz o que deu errado. A mesa de planejamento ja tinha passado
     // por isto e resolveu com uma caixa que fica na tela e sai copiada.
     const contarFalhaDeArquivo = () => {
        if (!arquivosQueFalharam.length) return;
        const texto = arquivosQueFalharam.join('\n');
        if (typeof daPlanningContarFalhaDeEnvio === 'function') {
           daPlanningContarFalhaDeEnvio(arquivosQueFalharam.length === 1
              ? arquivosQueFalharam[0].split(':')[0]
              : `${arquivosQueFalharam.length} referências`,
              `O conteúdo foi criado. As referências abaixo não subiram — dá para anexar de novo pela peça.\n\n${texto}`);
        } else if (typeof showToast === 'function') {
           showToast(`Conteúdo criado, mas as referências não subiram: ${texto}`, 'err', 12000);
        }
     };

     if (!falhas.length) {
        if (typeof showToast === 'function') {
          showToast(total > 1 ? `✓ ${total} conteúdos criados` : '✓ Conteúdo criado', 'ok');
        }
        fechar = true;
        contarFalhaDeArquivo();
        if (typeof refreshData === 'function') await refreshData({ boardCriado: state.board });
        return;
     }

     // Parcial: os que entraram ficam, e a lista guarda so os que faltaram —
     // assim da para corrigir e tentar de novo sem duplicar o que ja existe.
     state.itens = itensFalhos;
     fcEspelharPrimeiro();
     fcPasso = FC_PASSOS.indexOf('itens');
     fcDesenharPasso();
     if (typeof showToast === 'function') {
        showToast(`${feitos.length} de ${total} criados. Ficaram na lista os ${falhas.length} que falharam: ${falhas[0].erro}`, 'err', 10000);
     }
     contarFalhaDeArquivo();
     if (feitos.length && typeof refreshData === 'function') await refreshData({ boardCriado: state.board });
     } finally {
       fcEnviando = false;
       if (overlay) { overlay.inert = false; overlay.removeAttribute('aria-busy'); }
       if (btn) { btn.disabled = false; btn.textContent = rotuloBotao; }
       if (fechar) fcCloseModal();
       else document.getElementById('fc-submit-btn')?.focus();
     }
  };

  window.fcToggleDropdown = function(id) {
       const list = document.getElementById(id);
       const isOpen = list.classList.contains('open');
       document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
       if(!isOpen) list.classList.add('open');
    };
    
    window.fcSelectDropdown = function(key, val, text, colorObj, isManual = true) {
       // Gravava sempre, ignorando isManual. Quem chama com isManual=false e o
       // calculo automatico, so para MOSTRAR o destino sugerido — ao gravar, o
       // sugerido virava escolha manual na primeira vez que a tela desenhava, e
       // dali em diante o grupo nunca mais seguia o formato: escolher Reels ou
       // Card continuava caindo em Redacao.
       if (isManual) state[key] = val;
       document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
       
       const valEl = document.getElementById('fc-val-' + key);
       if(valEl) {
           valEl.textContent = text;
           if(colorObj) {
               valEl.style.background = colorObj.color;
               valEl.style.color = '#fff';
               if(colorObj.color === '#c4c4c4' || colorObj.color === '#ffcb00') valEl.style.color = '#000';
               valEl.style.border = 'none';
           } else {
               valEl.style.background = '#F9F8F5';
               valEl.style.color = '#1F1D1A';
               valEl.style.border = 'none';
           }
       }
       // Estava fora do if e chamava de volta o caminho automatico:
       // updateDestinyUI -> fcSelectDropdown(false) -> updateDestinyUI, sem fim.
       // Antes parava porque o automatico gravava no state e a condicao de la
       // deixava de valer — parava por causa do bug. Redesenhar so faz sentido
       // quando foi a pessoa que escolheu.
       if (isManual) updateDestinyUI();
    };


  // ─── Fluxo guiado ───────────────────────────────────────────────────────────
  // A tela pedia as onze informacoes de uma vez, num formulario que so dizia se
  // estava certo depois de clicar em Criar. Agora e uma pergunta por vez, e a
  // previa da direita vai se montando conforme cada resposta entra — quem
  // cadastra ve para onde a peca esta indo antes de terminar.
  const FC_PASSOS = ['board', 'client', 'format', 'itens', 'destino'];
  let fcPasso = 0;

  // TRÊS ETAPAS NA TELA, AS MESMAS CINCO CONFERÊNCIAS POR BAIXO (padrão v2, quadro "Nova demanda em etapas").
  //
  // A tela mostra três cartões lado a lado: O quê (quadro, formato e título), Para quem (clientes e responsável)
  // e Quando (a data do cliente; o prazo interno sai dela). Objetivo, briefing, arquivo, grupo e status de entrada
  // ficam em "Mais campos". O que é conferido antes de criar não mudou: FC_PASSOS e fcRespondido são os de sempre,
  // e quando falta algo a tela leva para o cartão (ou para Mais campos) onde a resposta mora.
  const FC_ETAPAS = ['O quê', 'Para quem', 'Quando'];
  const FC_ETAPA_SUB = ['formato e título', 'um ou mais clientes', 'a data do cliente manda'];
  const FC_FALTA_ETAPA = ['Escolha o formato e escreva o título.', 'Escolha o cliente.', 'Escolha a data.'];
  let fcEtapa = 0;
  const fcTemTexto = (v) => Boolean(String(v || '').trim());
  function fcEtapaFeita(n) {
    if (n === 0) return Boolean(state.format) && state.itens.every((i) => fcTemTexto(i.titulo));
    if (n === 1) return Boolean(state.client);
    return state.itens.every((i) => i.veic && i.prazo);
  }
  // Em qual cartão mora a resposta que falta para a conferência p.
  function fcEtapaDoPasso(p) {
    if (p === 'board' || p === 'format') return 0;
    if (p === 'client') return 1;
    if (p === 'itens') return state.itens.some((i) => !fcTemTexto(i.titulo)) ? 0 : 2;
    return 2;
  }

  function fcRespondido(p) {
    if (p === 'board')  return true;
    if (p === 'client') return !!state.client;
    if (p === 'format') return !!state.format;
    if (p === 'itens')  return state.itens.length > 0 && state.itens.every(
      (i) => String(i.titulo || '').trim() && i.veic && i.prazo && String(i.brief || '').trim());
    return true;
  }

  // Objetivo da peça (módulo Conteúdo, vybe-mundo-conteudo.js): a bolinha de Atração, Educação ou
  // Conversão. Opcional; vale para todos os conteúdos do lote e pode ser trocado depois na peça.
  const FC_OBJETIVOS = [['atracao', 'Atração', '#1F7AE0', 'traz gente nova'], ['educacao', 'Educação', '#0E8F6E', 'explica e gera confiança'],
    ['conversao', 'Conversão', '#C2490C', 'chama para comprar']];
  function fcObjetivoHtml() {
    return `<div class="fc-objetivo nd-objetivo"><p class="nd-rot">Objetivo da peça <span class="nd-neutro">opcional · vale para todos os conteúdos</span></p>
      <div class="nd-fileira" role="radiogroup" aria-label="Objetivo da peça">${FC_OBJETIVOS.map(([v, r, cor, dica]) => `
        <button type="button" role="radio" class="nd-chip${state.objetivo === v ? ' on' : ''}" aria-checked="${state.objetivo === v}"
          title="${dica}" onclick="fcEscolherObjetivo('${v}')"><i class="nd-ponto" style="background:${cor}" aria-hidden="true"></i>${r}</button>`).join('')}</div></div>`;
  }
  window.fcEscolherObjetivo = function(valor) {
    state.objetivo = state.objetivo === valor ? '' : valor;
    const caixa = document.querySelector('#fc-overlay .fc-objetivo');
    if (caixa) caixa.outerHTML = fcObjetivoHtml();
    document.querySelector('#fc-overlay .fc-objetivo .nd-chip.on, #fc-overlay .fc-objetivo .nd-chip')?.focus({ preventScroll: true });
  };

  const FC_ICONE = {
    visto: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    producao: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 15l4-4 4 4 3-3 5 5"/></svg>',
    demandas: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v10H9l-5 4z"/></svg>',
    seta: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    erro: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>',
  };
  const fcTecla = (acao) => `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();${acao}}"`;
  // O cliente com o ponto da carteira dele, como no resto do padrão.
  function fcClienteHtml(nome) {
    const carteira = typeof carteiraDoCliente === 'function' ? carteiraDoCliente(nome) : '';
    return `<span class="nd-cli" data-carteira="${esc(carteira)}">${esc(nome)}</span>`;
  }
  function fcIniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/);
    return ((partes[0] || '').slice(0, 2)).toUpperCase();
  }
  function fcErroHtml(id, texto) {
    return `<p class="nd-erro" id="${id}" role="alert" hidden>${FC_ICONE.erro}<span>${esc(texto)}</span></p>`;
  }
  // Os próximos quatro dias (domingo fica de fora) e "outra", que abre o campo de data.
  function fcDiasSugeridos() {
    const dias = [];
    for (let n = 1; dias.length < 4 && n < 10; n += 1) {
      const iso = getOffsetDate(todayIso(), n);
      if (new Date(`${iso}T12:00:00`).getDay() !== 0) dias.push(iso);
    }
    return dias;
  }
  function fcRegraDoFormato() {
    const dest = typeof cadastrosDestiny === 'function'
      ? cadastrosDestiny(state.format || '', state.briefReady, state.materialReady, state.assignees) : { assignees: [] };
    const somados = (state.assignees || []).map(String);
    const daRegra = (dest.assignees || []).map(String).filter((id) => !somados.includes(id));
    return { dest, daRegra };
  }

  function fcCartaoOQueHtml(n, it) {
    const lista = fcListaCatalogo('format');
    return `
      ${['producao', 'demandas'].map((q) => `
        <button type="button" role="radio" aria-checked="${state.board === q}" class="nd-tipo${state.board === q ? ' on' : ''}" onclick="fcEscolherQuadro('${q}')">
          <span class="nd-ico">${FC_ICONE[q]}</span>
          <span class="nd-tipo-txt"><b>${esc(FC_QUADROS[q].nome)}</b><span class="nd-sub">${q === 'producao' ? 'o que a Vybe produz e publica' : 'pedido que chega e passa pela triagem'}</span></span></button>`).join('')}
      <p class="nd-rot" id="fc-label-formato">${esc(fcQuadro().rotuloFormato)}</p>
      <div class="nd-fileira" role="radiogroup" aria-labelledby="fc-label-formato">${lista.map((f) => `
        <button type="button" role="radio" aria-checked="${state.format === f}" class="nd-chip${state.format === f ? ' on' : ''}"
          data-valor="${esc(f)}" onclick="fcEscolherFormato(this.dataset.valor)">${esc(f)}</button>`).join('')}${fcAdicionarOpcaoHtml('format')}</div>
      ${fcErroHtml('fc-erro-formato', 'Escolha o formato.')}
      <label class="nd-rot" for="fc-titulo">Título${state.itens.length > 1 ? ` <span>${n + 1} de ${state.itens.length}</span>` : ''}</label>
      <input type="text" id="fc-titulo" class="nd-campo" data-item="${n}" data-campo="titulo" autocomplete="off"
        placeholder="Ex.: Promoção de sábado" value="${esc(it.titulo)}" aria-describedby="fc-erro-titulo" oninput="fcItemCampo(${n},'titulo',this.value)">
      ${fcErroHtml('fc-erro-titulo', 'Escreva o título.')}
      <p class="nd-sub nd-fim"><button type="button" class="nd-lk" onclick="abrirCalendarioSazonal()">Começar pelo calendário sazonal</button></p>`;
  }

  function fcCartaoParaQuemHtml() {
    const clientes = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
    const escolhidos = state.clients?.length ? state.clients : (state.client ? [state.client] : []);
    // Seis à vista (os escolhidos primeiro); o resto abre no "+ N" ou aparece ao buscar.
    const ordem = [...clientes.filter((c) => escolhidos.includes(c)), ...clientes.filter((c) => !escolhidos.includes(c))];
    const aVista = Math.max(6, escolhidos.length);
    const resto = Math.max(0, ordem.length - aVista);
    const users = typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : [];
    const { dest, daRegra } = fcRegraDoFormato();
    const pessoa = (id) => users.find((u) => String(u.id) === String(id));
    const sugeridos = daRegra.map(pessoa).filter(Boolean);
    const dentro = new Set(fcEquipeFinal(dest));
    const aceita = sugeridos.length > 0 && sugeridos.every((u) => dentro.has(String(u.id)));
    const nomes = sugeridos.map((u) => String(u.name).split(' ')[0]);
    const outros = users.filter((u) => !daRegra.includes(String(u.id))).slice(0, 3);
    const fala = sugeridos.length ? `
      <div class="nd-fala">
        <span class="nd-ag" aria-hidden="true">R</span>
        <div class="nd-fala-txt">
          <p><span class="nd-quem">Regra de entrada · ${esc(state.format)}</span>Sugiro ${sugeridos.length > 1 ? '' : 'o responsável '}<b>${esc(nomes.join(', '))}</b>: é quem a regra do formato escolhe.</p>
          <div class="nd-fala-acoes">
            <span class="nd-avs">${sugeridos.slice(0, 3).map((u) => `<span class="nd-av v2-pop" title="${esc(u.name)}">${esc(fcIniciais(u.name))}</span>`).join('')}</span>
            <button type="button" class="nd-btn s${aceita ? ' feito' : ''}" onclick="fcAceitarRegra(${aceita ? 'false' : 'true'})"
              title="${aceita ? 'Clique para tirar da demanda' : 'Clique para pôr na demanda'}">${aceita ? `${FC_ICONE.visto}${esc(nomes.join(', '))}` : 'Aceitar'}</button>
          </div>
        </div>
      </div>` : `<p class="nd-sub">${state.format ? 'A regra deste formato não indica ninguém.' : 'Escolha o formato para ver quem a regra de entrada indica.'}</p>`;
    return `
      <label class="nd-fora" for="fc-busca-cliente">Buscar cliente</label>
      <input type="search" class="nd-busca" id="fc-busca-cliente" placeholder="Buscar cliente" autocomplete="off"
          oninput="fcFiltrar('fc-lista-cliente', this.value)">
      <div class="nd-fileira nd-clientes${state.clientesTodos ? ' todos' : ''}" id="fc-lista-cliente">${ordem.map((c, i) => {
          const marcado = escolhidos.includes(c);
          return `
          <button type="button" role="checkbox" class="nd-chip${marcado ? ' on' : ''}${i >= aVista ? ' nd-resto' : ''}"
            aria-checked="${marcado}" aria-label="${esc(c)}" data-busca="${esc(String(c).toLowerCase())}"
            data-valor="${esc(c)}" onclick="fcAlternarCliente(this.dataset.valor)">${fcClienteHtml(c)}</button>`;
        }).join('')}${resto ? `<button type="button" class="nd-chip nd-mais-clientes" onclick="fcMostrarClientes()">+ ${resto}</button>` : ''}${fcAdicionarOpcaoHtml('client')}</div>
      ${fcErroHtml('fc-erro-cliente', 'Escolha o cliente.')}
      <p class="nd-rot">Responsável</p>
      ${fala}
      <div class="nd-ou">${sugeridos.length ? '<span class="nd-sub">ou</span>' : ''}<span class="nd-avs">${outros.map((u) => `<span class="nd-av" title="${esc(u.name)}">${esc(fcIniciais(u.name))}</span>`).join('')}</span>
        <button type="button" class="nd-lk escuro" aria-expanded="${Boolean(state.pessoasAbertas)}" aria-controls="fc-persons-container" onclick="fcAbrirPessoas()">escolher outra pessoa</button></div>
      <div class="nd-fileira nd-pessoas" id="fc-persons-container"${state.pessoasAbertas ? '' : ' hidden'}></div>
      <p class="nd-sub nd-fim">Sem responsável, a demanda entra na triagem.</p>`;
  }

  function fcCartaoQuandoHtml(n, it) {
    const demanda = state.board === 'demandas';
    const dias = fcDiasSugeridos();
    const outra = Boolean(state.outraData) || Boolean(it.veic && !dias.includes(it.veic));
    const dia = (iso) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${iso}T12:00:00`).getDay()];
    const curto = (iso) => (iso ? `${dia(iso)} ${iso.slice(8, 10)}/${iso.slice(5, 7)}` : 'sem data');
    return `
      <span class="nd-seg" role="group" aria-label="Qual data"><span class="${demanda ? '' : 'on'}" title="Produção de conteúdo usa a data de veiculação">Veiculação</span><span class="${demanda ? 'on' : ''}" title="Solicitação de demanda usa a data de conclusão">Conclusão</span></span>
      <div class="nd-dias" role="radiogroup" aria-label="${demanda ? 'Conclusão' : 'Veiculação'}">${dias.map((iso) => `
        <button type="button" role="radio" aria-checked="${!outra && it.veic === iso}" class="nd-dia${!outra && it.veic === iso ? ' on' : ''}" onclick="fcEscolherDia('${iso}')">${dia(iso)}<b>${iso.slice(8, 10)}</b></button>`).join('')}
        <button type="button" role="radio" aria-checked="${outra}" class="nd-dia${outra ? ' on' : ''}" onclick="fcEscolherDia('')">outra<b>···</b></button></div>
      <label class="nd-data"${outra ? '' : ' hidden'}><span class="nd-sub">${demanda ? 'Conclusão' : 'Veiculação'}</span>
        <input type="date" id="fc-veic" class="nd-campo" data-item="${n}" data-campo="veic" value="${esc(it.veic)}" oninput="fcItemCampo(${n},'veic',this.value);fcPintarTrilho()"></label>
      ${fcErroHtml('fc-erro-data', 'Escolha a data.')}
      <p class="nd-rot">O sistema calcula o resto</p>
      <div class="nd-trilhos">
        <label class="nd-trilho"><i></i><span>Prazo interno <span class="nd-sub">7 dias antes</span></span>
          <input type="date" id="fc-prazo" class="nd-prazo" data-item="${n}" data-campo="prazo" value="${esc(it.prazo)}" title="Prazo de entrega interno · clique para mudar" oninput="fcItemCampo(${n},'prazo',this.value)"></label>
        <div class="nd-trilho"><i class="ar"></i><span>${demanda ? 'Entrega ao cliente' : 'No ar'}</span><b id="fc-no-ar">${esc(curto(it.veic))}</b></div>
      </div>
      <p class="nd-sub nd-fim">${demanda ? 'Conclusão vale para o que não vai ao ar: o prazo é a entrega ao cliente.' : 'Veiculação é o dia em que a peça vai ao ar. Conclusão vale para a solicitação de demanda.'}</p>`;
  }

  // Mais campos: objetivo, briefing, arquivo, grupo e status de entrada, e as ferramentas de lote.
  function fcMaisCamposHtml(n, it) {
    const esc2 = (t) => esc(String(t == null ? '' : t));
    const demanda = state.board === 'demandas';
    const varios = state.itens.length > 1;
    const prontos = state.itens.filter(fcItemPronto).length;
    const faltam = fcFaltamTexto();
    return `
      ${demanda ? '' : fcObjetivoHtml()}
      <div class="nd-mais-grade">
        <div class="nd-mais-col" ondragover="fcArrastando(event,this,true)" ondragleave="fcArrastando(event,this,false)" ondrop="fcSoltarArquivos(event,${n},this)">
          <label class="nd-rot" for="fc-brief">Briefing${varios ? ` · ${n + 1} de ${state.itens.length}` : ''} <span>obrigatório</span></label>
          <textarea id="fc-brief" class="nd-area fc-campo-texto" data-item="${n}" data-campo="brief" aria-describedby="fc-erro-brief"
            placeholder="Objetivo, referência, contexto..."
            oninput="fcItemCampo(${n},'brief',this.value);fcCrescerTexto(this)">${esc2(it.brief)}</textarea>
          ${fcErroHtml('fc-erro-brief', 'Falta o briefing.')}
          ${fcArquivosHtml(n, it)}
        </div>
        <div class="nd-mais-col">
          <div class="fc-auto-group nd-destino" id="fc-auto-group-container"></div>
          <div class="nd-atalhos">
            <label class="nd-atalho"><input type="checkbox" ${state.briefReady ? 'checked' : ''}
              onchange="fcHandleInput('briefReady', this.checked)">
              <span>Os briefings já estão prontos <small>pula a Redação</small></span></label>
            <label class="nd-atalho"><input type="checkbox" ${state.materialReady ? 'checked' : ''}
              onchange="fcHandleInput('materialReady', this.checked);fcDesenharPasso()">
              <span>O material bruto já foi fornecido <small>ignora a Captação</small></span></label>
          </div>
          ${state.materialReady ? `<div class="fc-bruto nd-bruto">
            <label class="nd-rot" for="fc-bruto-link">Link da pasta do material bruto</label>
            <input id="fc-bruto-link" class="nd-campo" type="url" value="${(state.materialBruto || '').replace(/"/g, '&quot;')}"
              placeholder="https://drive.google.com/drive/folders/…"
              oninput="fcHandleInput('materialBruto', this.value)">
            <p class="nd-sub">O link aparece na tela de briefing, onde quem edita procura os arquivos.</p>
          </div>` : ''}
        </div>
      </div>
      <div class="nd-lote" onkeydown="fcTeclaNoEditor(event)">
        <p class="nd-rot">${varios ? `Lote <span class="nd-neutro" id="fc-lista-contador">${prontos} de ${state.itens.length} prontos</span> <span id="fc-lista-faltam">${esc2(faltam)}</span>` : 'Mais de um de uma vez'}</p>
        ${state.escalaAberta ? fcEscalaHtml(esc2) : ''}
        ${varios ? `<div class="fc-lista-linhas nd-lista">${state.itens.map((x, i) => fcLinhaDaListaHtml(x, i, esc2)).join('')}</div>` : ''}
        <div class="nd-fileira">
          <button type="button" class="nd-chip" onclick="fcAdicionarItem()">+ ${demanda ? 'outra demanda' : 'outro conteúdo'}</button>
          <button type="button" class="nd-chip" onclick="fcAbrirEscala()">Criar em escala</button>
          ${varios ? `<button type="button" class="nd-chip" onclick="fcColarTitulos()">Colar títulos</button>
          <button type="button" class="nd-chip" onclick="fcEscalonarDatas()">Datas de sete em sete dias</button>
          <button type="button" class="nd-chip" onclick="fcProximoSemBriefing()" ${faltam ? '' : 'disabled'}>Próximo que falta</button>
          <button type="button" class="nd-chip nd-perigo" onclick="fcTirarItem(${n})">Tirar este da lista</button>` : ''}
        </div>
      </div>`;
  }

  window.fcEscolherFormato = function(valor) {
    if (fcEnviando) return;
    fcSincronizarDaTela();
    state.format = valor;
    fcDesenharPasso();
    document.querySelector('#fc-guia [data-etapa="0"] .nd-chip.on')?.focus({ preventScroll: true });
  };
  window.fcMostrarClientes = function() {
    state.clientesTodos = true;
    document.getElementById('fc-lista-cliente')?.classList.add('todos');
  };
  window.fcAbrirPessoas = function() {
    state.pessoasAbertas = !state.pessoasAbertas;
    const caixa = document.getElementById('fc-persons-container');
    if (caixa) caixa.hidden = !state.pessoasAbertas;
    document.querySelector('#fc-guia [aria-controls="fc-persons-container"]')?.setAttribute('aria-expanded', String(Boolean(state.pessoasAbertas)));
  };
  // Aceitar põe na demanda quem a regra indica; clicar de novo tira (os mesmos "removidos" de sempre).
  window.fcAceitarRegra = function(aceitar) {
    if (fcEnviando) return;
    fcSincronizarDaTela();
    const { daRegra } = fcRegraDoFormato();
    const fora = new Set((state.removidos || []).map(String));
    daRegra.forEach((id) => { if (aceitar) fora.delete(id); else fora.add(id); });
    state.removidos = [...fora];
    fcDesenharPasso();
  };
  window.fcEscolherDia = function(iso) {
    if (fcEnviando) return;
    fcSincronizarDaTela();
    const n = fcItemAtivo();
    state.outraData = !iso;
    if (iso) fcItemCampo(n, 'veic', iso);
    fcDesenharPasso();
    if (!iso) document.getElementById('fc-veic')?.focus();
    else document.querySelector('#fc-guia .nd-dia.on')?.focus({ preventScroll: true });
  };
  window.fcPintarTrilho = function() {
    const it = state.itens[fcItemAtivo()];
    const alvo = document.getElementById('fc-no-ar');
    if (alvo && it) alvo.textContent = it.veic ? fcDiaCurto(it.veic).toLowerCase() : 'sem data';
  };
  window.fcAlternarMais = function(abrir) {
    state.maisAberto = abrir === undefined ? !state.maisAberto : Boolean(abrir);
    const mais = document.getElementById('fc-mais');
    mais?.setAttribute('aria-expanded', String(state.maisAberto));
    // Fechado, o que está dentro não entra na ordem do Tab.
    if (mais?.firstElementChild) mais.firstElementChild.inert = !state.maisAberto;
    document.getElementById('fc-mais-chip')?.setAttribute('aria-expanded', String(state.maisAberto));
    if (state.maisAberto) setTimeout(() => document.getElementById('fc-mais')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  };

  // Referencias do conteudo. Os arquivos ficam guardados em memoria ate a peca
  // existir: so depois de criada e que ela tem um id para pendurar arquivo, e o
  // envio usa enviarArquivoDaPeca, o mesmo caminho da mesa de planejamento e da
  // entrega rapida — nao ha um segundo jeito de subir arquivo neste painel.
  function fcArquivosHtml(n, it) {
    const lista = it.arquivos || [];
    const chips = lista.map((f, i) => `
      <span class="fc-arq"><span title="${esc(f.name)}">${esc(f.name)}</span>
        <small>${fcTamanho(f.size)}</small>
        <button type="button" title="Tirar este arquivo"
          onclick="fcTirarArquivo(${n},${i})">×</button></span>`).join('');
    return `<button type="button" class="fc-arqs" onclick="fcEscolherArquivos(${n})">
        <b>+</b> ${lista.length ? 'Adicionar mais referências' : 'Arraste referências aqui ou clique para escolher'}
        <small>PNG, JPG, WEBP ou PDF</small></button>
      ${chips ? `<div class="fc-arq-lista">${chips}</div>` : ''}`;
  }

  function fcTamanho(bytes) {
    const mb = Number(bytes || 0) / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(Number(bytes || 0) / 1024))} KB`;
  }

  // As regras de tipo e tamanho sao as do envio (ARQUIVO_TIPOS, ARQUIVO_LIMITE).
  // Barrar aqui evita descobrir que o PSD nao serve depois de a peca ja existir.
  function fcArquivosAceitos(n, entrada) {
    const it = state.itens[n];
    if (!it) return;
    const tipos = typeof ARQUIVO_TIPOS !== 'undefined'
      ? ARQUIVO_TIPOS : ['image/png','image/jpeg','image/webp','application/pdf'];
    const limite = typeof ARQUIVO_LIMITE !== 'undefined' ? ARQUIVO_LIMITE : 200 * 1024 * 1024;
    const recusados = [];
    const aceitos = [...entrada].filter((f) => {
      if (!tipos.includes(f.type)) { recusados.push(`${f.name}: só PNG, JPG, WEBP ou PDF`); return false; }
      if (f.size > limite) { recusados.push(`${f.name}: passa de 200 MB`); return false; }
      return true;
    });
    if (!aceitos.length && !recusados.length) return;
    it.arquivos = (it.arquivos || []).concat(aceitos);
    fcDesenharPasso();
    if (recusados.length && typeof showToast === 'function') {
      showToast(recusados.join(' · '), 'err', 8000);
    } else if (aceitos.length && typeof showToast === 'function') {
      showToast(aceitos.length === 1
        ? `${aceitos[0].name} vai junto com o conteúdo.`
        : `${aceitos.length} referências vão junto com o conteúdo.`, 'ok');
    }
  }

  window.fcEscolherArquivos = function(n) {
    let input = document.getElementById('fc-arq-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file'; input.multiple = true; input.hidden = true; input.id = 'fc-arq-input';
      input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
      input.onchange = () => { fcArquivosAceitos(Number(input.dataset.item), input.files); input.value = ''; };
      document.body.appendChild(input);
    }
    input.dataset.item = String(n);
    input.value = '';
    input.click();
  };

  // Sem o preventDefault no dragover o navegador ABRE o arquivo solto e o
  // cadastro inteiro vai embora com o que ja estava preenchido.
  window.fcArrastando = function(evento, caixa, entrando) {
    evento.preventDefault();
    if (caixa) caixa.classList.toggle('arrastando', !!entrando);
  };

  window.fcSoltarArquivos = function(evento, n, caixa) {
    evento.preventDefault();
    if (caixa) caixa.classList.remove('arrastando');
    fcSincronizarDaTela();
    fcArquivosAceitos(n, evento.dataTransfer?.files || []);
  };

  window.fcTirarArquivo = function(n, i) {
    const it = state.itens[n];
    if (!it || !it.arquivos) return;
    fcSincronizarDaTela();
    it.arquivos.splice(i, 1);
    fcDesenharPasso();
  };

  // O briefing acompanha o que esta escrito em vez de esconder em tres linhas.
  // O teto vem do CSS: passando dele o campo rola, e nao empurra o botao de
  // criar para fora da tela.
  window.fcCrescerTexto = function(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  };

  // Redesenhar o passo a cada tecla arrancaria o campo debaixo do dedo. Aqui so
  // guarda, preenche o prazo e atualiza a previa e o aviso.
  window.fcDataDigitada = function(campo, valor) {
    fcHandleInput(campo, valor);
    if (campo === 'veic') {
      const p = document.getElementById('fc-prazo');
      if (p && state.prazo) p.value = state.prazo;
    }
    const dica = document.getElementById('fc-dica-datas');
    if (dica) {
      dica.textContent = state.veic && state.prazo
        ? `Prazo de ouro em ${state.prazo.split('-').reverse().join('/')} — sete dias antes da veiculação.`
        : 'Informe a veiculação; o prazo de ouro se preenche sozinho.';
    }
  };

  // O que a pessoa ve na tela e o campo, nao o state. Se um evento se perdeu, o
  // botao barrava com a tela cheia. Antes de julgar, le o que esta escrito.
  function fcSincronizarDaTela() {
    document.querySelectorAll('[data-item][data-campo]').forEach((el) => {
      const it = state.itens[Number(el.dataset.item)];
      if (it && el.value !== undefined && it[el.dataset.campo] !== el.value) {
        it[el.dataset.campo] = el.value;
      }
    });
    fcEspelharPrimeiro();
  }

  const FC_FALTA = {
    board: 'Escolha onde cadastrar.',
    client: 'Escolha o cliente.',
    format: 'Escolha o formato.',
    itens: 'Cada conteúdo precisa de título, data de veiculação e briefing.',
  };


  // Espelha o primeiro item nos campos antigos: a previa e as regras de entrada
  // foram escritas para um conteudo so e continuam funcionando.
  function fcEspelharPrimeiro() {
    const um = state.itens[0] || {};
    state.title = um.titulo || '';
    state.veic = um.veic || '';
    state.prazo = um.prazo || '';
    state.brief = um.brief || '';
  }

  // Nao redesenha o passo: redesenhar a cada tecla arrancaria o campo debaixo
  // do dedo e perderia o cursor. So o topo do cartao e a previa acompanham.
  window.fcItemCampo = function(n, campo, valor) {
    const it = state.itens[n];
    if (!it) return;
    it[campo] = valor;
    if (campo === 'veic' && valor) {
      it.prazo = getOffsetDate(valor, -7);
      const p = document.querySelector(`[data-item="${n}"][data-campo="prazo"]`);
      if (p) p.value = it.prazo;
    }
    if (campo === 'titulo') {
      const topo = document.querySelectorAll('.fc-item-topo span')[n];
      if (topo) topo.textContent = `${state.format || 'Formato'} - ${valor || 'sem título'}`;
    }
    fcAtualizarLista(n);
    fcEspelharPrimeiro();
    updateDestinyUI();
    fcPintarProgresso();
    const aviso = { titulo: 'fc-erro-titulo', brief: 'fc-erro-brief', veic: 'fc-erro-data' }[campo];
    if (aviso && valor) { const el = document.getElementById(aviso); if (el) el.hidden = true; document.getElementById({ titulo: 'fc-titulo', brief: 'fc-brief' }[campo] || '')?.classList.remove('er'); }
  };

  window.fcAdicionarItem = function() {
    // A data segue a cadencia do que ja existe: sete dias depois da ultima.
    const ultima = [...state.itens].reverse().find((i) => i.veic)?.veic || '';
    state.itens.push({ titulo: '', veic: ultima ? getOffsetDate(ultima, 7) : '',
                       prazo: ultima ? getOffsetDate(ultima, 0) : '', brief: '', arquivos: [] });
    state.itemAtivo = state.itens.length - 1;
    state.outraData = false;
    fcEspelharPrimeiro();
    fcEtapa = 0;
    fcDesenharPasso();
    // O titulo do novo conteudo e onde a pessoa vai escrever agora.
    document.getElementById('fc-titulo')?.focus();
  };

  function fcDiaCurto(iso) {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return `${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]} ${iso.slice(8,10)}/${iso.slice(5,7)}`;
  }

  // ── PREENCHER EM LISTA ─────────────────────────────────────────────────────
  const fcItemPronto = (it) => Boolean(String(it.titulo || '').trim() && it.veic && it.prazo && String(it.brief || '').trim());
  function fcItemAtivo() {
    const n = Number(state.itemAtivo) || 0;
    state.itemAtivo = Math.min(Math.max(n, 0), state.itens.length - 1);
    return state.itemAtivo;
  }
  function fcFaltamTexto() {
    const semTitulo = state.itens.filter((i) => !String(i.titulo || '').trim()).length;
    const semBriefing = state.itens.filter((i) => !String(i.brief || '').trim()).length;
    const partes = [];
    if (semTitulo) partes.push(`${semTitulo} sem título`);
    if (semBriefing) partes.push(`${semBriefing} sem briefing`);
    return partes.join(' · ');
  }
  function fcLinhaDaListaHtml(it, n, esc2) {
    const ativo = n === state.itemAtivo;
    return `<button type="button" class="fc-lista-linha ${ativo ? 'ativa' : ''} ${fcItemPronto(it) ? 'pronta' : ''}"
        data-lista="${n}" onclick="fcIrParaConteudo(${n})" aria-current="${ativo}">
        <i aria-hidden="true">${fcItemPronto(it) ? '✓' : '●'}</i>
        <span class="fc-lista-data">${esc2(it.veic ? fcDiaCurto(it.veic) : 'sem data')}</span>
        <span class="fc-lista-titulo">${esc2(it.titulo || 'sem título')}</span>
      </button>`;
  }
  window.fcIrParaConteudo = function(n) {
    if (!state.itens.length) return;
    fcSincronizarDaTela();
    state.itemAtivo = Math.min(Math.max(Number(n) || 0, 0), state.itens.length - 1);
    state.outraData = false;
    fcDesenharPasso();
    const alvo = String(state.itens[state.itemAtivo]?.titulo || '').trim() && state.maisAberto
      ? document.getElementById('fc-brief') : document.getElementById('fc-titulo');
    alvo?.focus({ preventScroll: true });
    fcMostrarNaLista(state.itemAtivo);
  };
  // Rola so a lista, e so o necessario: scrollIntoView tambem arrastaria a
  // janela do cadastro, e uma linha ja visivel nao deve sair do lugar.
  function fcMostrarNaLista(n) {
    const lista = document.querySelector('.fc-lista-linhas');
    const linha = lista?.querySelector(`.fc-lista-linha[data-lista="${n}"]`);
    if (!lista || !linha || !lista.clientHeight) return;
    // Medido pelo offset dentro da lista (position:relative): a janela entra
    // com escala, e medidas de tela sairiam proporcionalmente erradas.
    const topo = linha.offsetTop;
    const base = topo + linha.offsetHeight;
    if (topo < lista.scrollTop) lista.scrollTop = topo;
    else if (base > lista.scrollTop + lista.clientHeight) lista.scrollTop = base - lista.clientHeight;
  }
  window.fcProximoSemBriefing = function() {
    const total = state.itens.length;
    for (let passo = 1; passo <= total; passo += 1) {
      const n = (state.itemAtivo + passo) % total;
      if (!fcItemPronto(state.itens[n])) return fcIrParaConteudo(n);
    }
  };
  window.fcTeclaNoEditor = function(evento) {
    if (!(evento.metaKey || evento.ctrlKey)) return;
    if (evento.key === 'ArrowDown') { evento.preventDefault(); fcIrParaConteudo(state.itemAtivo + 1); }
    if (evento.key === 'ArrowUp') { evento.preventDefault(); fcIrParaConteudo(state.itemAtivo - 1); }
  };
  // Escrever no editor atualiza a linha da lista e o contador sem redesenhar a
  // tela — redesenhar tiraria o cursor do campo a cada letra.
  function fcAtualizarLista(n) {
    // A linha muda no lugar: trocar o elemento inteiro a cada letra fazia o
    // Safari devolver a lista para o topo.
    const linha = document.querySelector(`.fc-lista-linha[data-lista="${n}"]`);
    if (!linha) return;
    const it = state.itens[n];
    const pronto = fcItemPronto(it);
    linha.classList.toggle('pronta', pronto);
    const icone = linha.querySelector('i');
    if (icone) icone.textContent = pronto ? '✓' : '●';
    const data = linha.querySelector('.fc-lista-data');
    if (data) data.textContent = it.veic ? fcDiaCurto(it.veic) : 'sem data';
    const titulo = linha.querySelector('.fc-lista-titulo');
    if (titulo) titulo.textContent = it.titulo || 'sem título';
    const prontos = state.itens.filter(fcItemPronto).length;
    const cont = document.getElementById('fc-lista-contador');
    if (cont) cont.textContent = `${prontos} de ${state.itens.length} prontos`;
    const faltam = document.getElementById('fc-lista-faltam');
    if (faltam) faltam.textContent = fcFaltamTexto();
    const opcao = document.querySelector(`.fc-lista-select option[value="${n}"]`);
    if (opcao) opcao.textContent = `${n + 1} de ${state.itens.length} · ${it.veic ? fcDiaCurto(it.veic) : 'sem data'} · ${it.titulo || 'sem título'}`;
  }

  function fcEscalaHtml(esc2) {
    const e = state.escala || {};
    let previa = '';
    try {
      const datas = cadastroDatasEmEscala(e.inicio, Number(e.quantidade), Number(e.intervalo));
      previa = `${datas.length} ${state.board==='demandas'?'demandas':'conteúdos'} · ${fcDiaCurto(datas[0].veic)} até ${fcDiaCurto(datas[datas.length - 1].veic)}`;
    } catch (erro) { previa = e.inicio || e.quantidade ? erro.message : ''; }
    return `<div class="fc-escala">
        <div><b>Criar em escala</b><br><small>${esc2(state.format || 'O formato')} para ${esc2(state.clients?.length ? state.clients.join(', ') : (state.client || 'o cliente'))}. Os cartões nascem com as datas; depois você cola título e briefing em cada um.</small></div>
        <div class="fc-escala-campos">
          <label>Quantidade<input type="number" class="fc-campo" min="1" max="${CADASTRO_ESCALA_MAX}" value="${esc2(e.quantidade || '')}"
            oninput="fcEscalaCampo('quantidade',this.value)" placeholder="Ex.: 10"></label>
          <label>Primeira ${state.board==='demandas'?'conclusão':'veiculação'}<input type="date" class="fc-campo" value="${esc2(e.inicio || '')}"
            oninput="fcEscalaCampo('inicio',this.value)"></label>
          <label>A cada quantos dias<input type="number" class="fc-campo" min="1" max="365" value="${esc2(e.intervalo || '')}"
            oninput="fcEscalaCampo('intervalo',this.value)" placeholder="Ex.: 3"></label>
        </div>
        <div class="fc-escala-acoes">
          <button type="button" class="fc-mais" onclick="fcGerarEscala()">Gerar cartões</button>
          <button type="button" class="fc-mais" onclick="fcFecharEscala()">Cancelar</button>
          <span class="fc-escala-previa" id="fc-escala-previa">${esc2(previa)}</span>
        </div>
      </div>`;
  }

  window.fcAbrirEscala = function() {
    const primeira = state.itens.find((i) => i.veic)?.veic || '';
    state.escala = state.escala || { quantidade: '', inicio: primeira, intervalo: '' };
    state.escalaAberta = true;
    state.maisAberto = true;
    fcDesenharPasso();
    document.querySelector('.fc-escala input')?.focus();
  };
  window.fcFecharEscala = function() { state.escalaAberta = false; fcDesenharPasso(); };
  window.fcEscalaCampo = function(campo, valor) {
    state.escala = { ...(state.escala || {}), [campo]: valor };
    const alvo = document.getElementById('fc-escala-previa');
    if (!alvo) return;
    try {
      const e = state.escala;
      const datas = cadastroDatasEmEscala(e.inicio, Number(e.quantidade), Number(e.intervalo));
      alvo.textContent = `${datas.length} ${state.board==='demandas'?'demandas':'conteúdos'} · ${fcDiaCurto(datas[0].veic)} até ${fcDiaCurto(datas[datas.length - 1].veic)}`;
    } catch (erro) { alvo.textContent = erro.message; }
  };

  window.fcGerarEscala = async function() {
    const e = state.escala || {};
    let datas;
    try { datas = cadastroDatasEmEscala(e.inicio, Number(e.quantidade), Number(e.intervalo)); }
    catch (erro) { return typeof showToast === 'function' ? showToast(erro.message, 'info', 5000) : null; }
    const preenchidos = state.itens.filter((i) => String(i.titulo || '').trim() || String(i.brief || '').trim());
    if (preenchidos.length && typeof perguntarNoPainel === 'function') {
      const sim = await perguntarNoPainel({ titulo: `Trocar os cartões por ${datas.length} novos?`,
        texto: `${preenchidos.length} cartão${preenchidos.length === 1 ? ' já tem' : 'ões já têm'} título ou briefing e ${preenchidos.length === 1 ? 'será trocado' : 'serão trocados'}.`,
        confirmar: 'Trocar' });
      if (!sim) return;
    }
    state.itens = datas.map(({ veic, prazo }) => ({ titulo: '', veic, prazo, brief: '', arquivos: [] }));
    state.escalaAberta = false;
    state.itemAtivo = 0;
    fcEspelharPrimeiro();
    fcDesenharPasso();
    document.querySelector('[data-campo="titulo"]')?.focus();
    if (typeof showToast === 'function') showToast(`✓ ${datas.length} cartões com as datas. Agora é colar título e briefing.`, 'ok', 5000);
  };

  // Uma lista de títulos colada de uma vez: um por linha, na ordem dos cartões.
  // Numeração ("1.", "2)") e marcadores ("-", "•") de quem copiou de outro lugar
  // saem sozinhos.
  window.fcColarTitulos = async function() {
    if (typeof perguntarNoPainel !== 'function') return;
    const texto = await perguntarNoPainel({ titulo: 'Colar títulos',
      texto: `Um título por linha, na ordem dos cartões (${state.itens.length}). Numeração e marcadores saem sozinhos.`,
      confirmar: 'Preencher', larga: true, campo: { valor: '', dica: 'Um título por linha', linhas: 12 } });
    if (texto === null || texto === undefined) return;
    const titulos = cadastroTitulosColados(texto);
    if (!titulos.length) return;
    titulos.slice(0, state.itens.length).forEach((t, n) => { state.itens[n].titulo = t; });
    fcEspelharPrimeiro();
    fcDesenharPasso();
    const sobra = titulos.length - state.itens.length;
    if (typeof showToast === 'function') {
      showToast(sobra > 0 ? `${state.itens.length} títulos preenchidos · ${sobra} ficaram de fora (há só ${state.itens.length} cartões)`
        : `✓ ${titulos.length} título${titulos.length === 1 ? '' : 's'} preenchido${titulos.length === 1 ? '' : 's'}`, sobra > 0 ? 'info' : 'ok', 5000);
    }
  };

  window.fcTirarItem = function(n) {
    if (state.itens.length <= 1) return;
    state.itens.splice(n, 1);
    fcEspelharPrimeiro();
    fcDesenharPasso();
  };

  // Cinco cards costumam sair um por semana. Isto preenche a partir da primeira
  // data ja informada, e nao toca em quem ja tem data escolhida a mao.
  window.fcEscalonarDatas = function() {
    const base = state.itens.find((i) => i.veic)?.veic;
    if (!base) return typeof showToast === 'function'
      ? showToast('Informe a veiculação do primeiro para escalonar os outros.', 'info') : null;
    const inicio = state.itens.findIndex((i) => i.veic);
    state.itens.forEach((it, n) => {
      if (n <= inicio) return;
      it.veic = getOffsetDate(base, 7 * (n - inicio));
      it.prazo = getOffsetDate(it.veic, -7);
    });
    fcEspelharPrimeiro();
    fcDesenharPasso();
  };

  window.fcFiltrar = function(listaId, termo) {
    const t = String(termo || '').toLowerCase().trim();
    const lista = document.getElementById(listaId);
    // Buscando, todos os clientes entram na conta (os recolhidos no "+ N" também).
    lista?.classList?.toggle('buscando', Boolean(t));
    document.querySelectorAll('#' + listaId + ' [data-busca]').forEach((b) => {
      b.style.display = !t || (b.dataset.busca || '').includes(t) ? '' : 'none';
    });
  };

  window.fcAlternarCliente = function(valor) {
    if (fcEnviando) return;
    const selecionados = state.clients?.length ? state.clients : (state.client ? [state.client] : []);
    state.clients = selecionados.includes(valor) ? selecionados.filter(c => c !== valor) : [...selecionados, valor];
    state.client = state.clients[0] || '';
    const busca = document.getElementById('fc-busca-cliente')?.value || '';
    fcDesenharPasso();
    const campo = document.getElementById('fc-busca-cliente');
    if (campo) { campo.value = busca; fcFiltrar('fc-lista-cliente', busca); }
    Array.from(document.querySelectorAll('#fc-lista-cliente [data-valor]')).find(b => b.dataset.valor === valor)?.focus();
  };

  window.fcResponder = function(chave, valor) {
    fcHandleInput(chave, valor);
    fcDesenharPasso();
  };

  window.fcEscolherQuadro = function(qual) {
    if (fcEnviando) return;
    fcSincronizarDaTela();
    if (state.board !== qual) {
      state.board = qual;
      // Grupo e status do quadro anterior nao existem no novo.
      state.manualGroup = state.manualStatus = state.manualCap = undefined;
      state.prioridade = ''; state.format = '';
    }
    fcDesenharPasso();
    document.querySelector('#fc-guia .nd-tipo.on')?.focus({ preventScroll: true });
  };

  // Os três cartões ficam sempre na tela: ir para uma etapa só muda qual está em destaque.
  window.fcIrPara = function(n) {
    if (fcEnviando) return;
    if (n < 0 || n >= FC_ETAPAS.length || n === fcEtapa) return;
    fcEtapa = n;
    fcPintarProgresso();
  };

  window.fcAvancar = function() {
    if (fcEnviando) return;
    fcSincronizarDaTela();
    if (fcEtapa >= FC_ETAPAS.length - 1 || FC_PASSOS.every((q) => fcRespondido(q))) return fcSubmit();
    if (!fcEtapaFeita(fcEtapa)) {
      fcMostrarFaltas();
      return typeof showToast === 'function' ? showToast(FC_FALTA_ETAPA[fcEtapa], 'info') : null;
    }
    fcEtapa++;
    fcPintarProgresso();
    fcFocarEtapa();
  };

  window.fcVoltar = function() {
    if (fcEnviando) return;
    if (fcEtapa > 0) { fcEtapa--; fcPintarProgresso(); fcFocarEtapa(); } else fcCloseModal();
  };

  function fcFocarEtapa() {
    const alvo = fcEtapa === 0 ? (state.format ? '#fc-titulo' : '[data-etapa="0"] .nd-chip')
      : fcEtapa === 1 ? '#fc-busca-cliente' : '[data-etapa="2"] .nd-dia.on, [data-etapa="2"] .nd-dia';
    document.querySelector(`#fc-guia ${alvo}`)?.focus({ preventScroll: true });
  }

  // O erro fica embaixo do campo que falta (famílias de subtela, formulário).
  function fcMostrarFaltas() {
    const it = state.itens[fcItemAtivo()] || {};
    const faltas = {
      'fc-erro-formato': !state.format,
      'fc-erro-titulo': !fcTemTexto(it.titulo),
      'fc-erro-cliente': !state.client,
      'fc-erro-data': !(it.veic && it.prazo),
      'fc-erro-brief': !fcTemTexto(it.brief),
    };
    const campos = { 'fc-erro-titulo': 'fc-titulo', 'fc-erro-cliente': 'fc-busca-cliente', 'fc-erro-brief': 'fc-brief' };
    Object.entries(faltas).forEach(([id, falta]) => {
      const aviso = document.getElementById(id);
      if (aviso) aviso.hidden = !falta;
      const campo = campos[id] && document.getElementById(campos[id]);
      if (campo) { campo.classList.toggle('er', falta); if (falta) campo.setAttribute('aria-invalid', 'true'); else campo.removeAttribute('aria-invalid'); }
    });
  }

  // O que muda sem redesenhar: a etapa em destaque, o visto das feitas, a barra e o botão.
  window.fcPintarProgresso = function() {
    const janela = document.querySelector('#fc-overlay .nd');
    if (!janela) return;
    janela.querySelectorAll('[data-etapa]').forEach((cartao) => {
      const n = Number(cartao.dataset.etapa), agora = n === fcEtapa, feita = fcEtapaFeita(n);
      cartao.classList.toggle('agora', agora);
      if (agora) cartao.setAttribute('aria-current', 'step'); else cartao.removeAttribute('aria-current');
      const num = cartao.querySelector('.nd-num');
      if (num) { num.className = `nd-num${agora ? ' on' : feita ? ' ok' : ''}`; num.innerHTML = feita && !agora ? FC_ICONE.visto : String(n + 1); }
      const sub = cartao.querySelector('.nd-cab .nd-sub');
      if (sub) sub.textContent = feita && !agora ? 'feito' : FC_ETAPA_SUB[n];
    });
    const texto = janela.querySelector('.fc-trilha-texto');
    if (texto) texto.textContent = `Etapa ${fcEtapa + 1} de ${FC_ETAPAS.length}`;
    const barra = janela.querySelector('.nd-barra > i');
    if (barra) barra.style.setProperty('--v', `${Math.round(((fcEtapa + 1) / FC_ETAPAS.length) * 100)}%`);
    const pronto = FC_PASSOS.every((q) => fcRespondido(q));
    const botao = document.getElementById('fc-submit-btn');
    const varios = state.itens.length > 1;
    if (botao && !fcEnviando) botao.textContent = fcEtapa >= FC_ETAPAS.length - 1 || pronto
      ? (varios ? `Criar ${state.itens.length} demandas` : 'Criar demanda') : 'Continuar';
    const voltar = document.getElementById('fc-voltar-btn');
    if (voltar) voltar.textContent = fcEtapa > 0 ? 'Voltar' : 'Cancelar';
    const semBriefing = state.itens.some((i) => !fcTemTexto(i.brief));
    const nota = document.getElementById('fc-nota');
    if (nota) {
      const soFaltaBriefing = semBriefing && [0, 1, 2].every((n) => fcEtapaFeita(n));
      nota.classList.toggle('falta', soFaltaBriefing);
      nota.textContent = soFaltaBriefing ? 'Falta o briefing: ele fica em Mais campos.'
        : `Mais campos guarda ${state.board === 'demandas' ? 'prioridade' : 'objetivo'}, briefing, arquivo, grupo e status de entrada.`;
    }
    document.getElementById('fc-mais-chip')?.classList.toggle('falta', semBriefing);
  };

  window.fcDesenharPasso = function() {
    const caixa = document.getElementById('fc-guia');
    if (!caixa) return;
    // fcPasso é o recado de quem conferiu (abrir, criar, calendário): diz qual resposta falta. A tela leva
    // para o cartão dela, ou abre Mais campos quando o que falta é o briefing.
    let focar = '';
    if (fcPasso >= 0) {
      const p = FC_PASSOS[fcPasso];
      fcPasso = -1;
      if (p === 'itens') {
        const falta = state.itens.findIndex((i) => !fcItemPronto(i));
        if (falta >= 0) {
          state.itemAtivo = falta;
          const it = state.itens[falta];
          if (fcTemTexto(it.titulo) && it.veic && it.prazo) { state.maisAberto = true; focar = 'brief'; }
        }
      }
      const nova = fcEtapaDoPasso(p);
      if (nova !== fcEtapa || !caixa.dataset.aberto) focar = focar || 'etapa';
      fcEtapa = nova;
      if (caixa.dataset.aberto && !fcRespondido(p)) focar = focar || 'faltas';
    }
    const primeiro = !caixa.dataset.aberto;
    caixa.dataset.aberto = '1';
    const rolagem = caixa.scrollTop || 0;
    const lista = caixa.querySelector('.fc-lista-linhas')?.scrollTop || 0;
    const busca = document.getElementById('fc-busca-cliente')?.value || '';
    const n = fcItemAtivo();
    const it = state.itens[n];
    const cartao = (i, corpo) => `
      <section class="nd-card nd-etapa" data-etapa="${i}" onpointerdown="fcIrPara(${i})" onfocusin="fcIrPara(${i})">
        <div class="nd-cab" onclick="fcIrPara(${i})" title="Etapa ${i + 1}: ${esc(FC_ETAPAS[i])}"><span class="nd-num">${i + 1}</span><h2>${esc(FC_ETAPAS[i])}</h2><span class="nd-sub">${esc(FC_ETAPA_SUB[i])}</span></div>
        ${corpo}
      </section>`;
    caixa.innerHTML = `
      <div class="nd-etapas">${cartao(0, fcCartaoOQueHtml(n, it))}${cartao(1, fcCartaoParaQuemHtml())}${cartao(2, fcCartaoQuandoHtml(n, it))}</div>
      <div class="fc-resposta nd-vaga"></div>
      <div class="nd-card nd-previa">
        <div class="nd-previa-txt">
          <p class="nd-sub">Como vai chegar na equipe</p>
          <p class="nd-previa-linha"><b id="fc-prev-title"></b><span id="fc-prev-client"></span><span id="fc-prev-status"></span>
            <span class="nd-sub">grupo <span id="fc-prev-group"></span> · <span id="fc-prev-users"></span> · <span id="fc-prev-dates"></span></span></p>
        </div>
        <button type="button" class="nd-chip" id="fc-mais-chip" aria-expanded="${Boolean(state.maisAberto)}" aria-controls="fc-mais" onclick="fcAlternarMais()">Mais campos · 5${FC_ICONE.seta}</button>
      </div>
      <div class="v2-abre nd-mais" id="fc-mais" aria-expanded="${Boolean(state.maisAberto)}"><div class="v2-mais"${state.maisAberto ? '' : ' inert'}><div><div class="nd-card nd-mais-dentro">${fcMaisCamposHtml(n, it)}</div></div></div></div>`;

    renderPersons();
    renderCustomDropdownsGlobal();
    // Briefing vindo do calendario sazonal ou de uma volta ao passo ja chega
    // escrito: sem isto ele apareceria cortado na altura minima.
    caixa.querySelectorAll('.fc-campo-texto').forEach((t) => fcCrescerTexto(t));
    updateDestinyUI();
    fcPintarProgresso();
    if (busca) { const campo = document.getElementById('fc-busca-cliente'); if (campo) { campo.value = busca; fcFiltrar('fc-lista-cliente', busca); } }
    if (!primeiro) {
      caixa.scrollTop = rolagem;
      const linhas = caixa.querySelector('.fc-lista-linhas');
      if (linhas) linhas.scrollTop = lista;
    }
    if (focar === 'brief' || focar === 'faltas') fcMostrarFaltas();
    if (focar === 'brief') { const campo = document.getElementById('fc-brief'); campo?.focus({ preventScroll: true }); setTimeout(() => campo?.scrollIntoView({ block: 'center' }), 320); }
    else if (focar) fcFocarEtapa();
  };

    // Aceita o que quem chama ja sabe: {client, veic, prazo, board}. Quem abre
    // pelo calendario ja escolheu o dia e, se o calendario estiver num cliente
    // so, ja escolheu o cliente — perguntar de novo seria pedir para digitar o
    // que a tela ja tem na mao.
    window.openCadastrosGoverned = function(inicial) {
    if (fcEnviando) return;
    ensureFastCadastrosStyles();
    
    const existing = document.getElementById('fc-overlay');
    if(existing) existing.remove();

    state = { itens: [{ titulo: '', veic: '', prazo: '', brief: '' }], title: '', client: '', clients: [], format: '', veic: '', prazo: '', brief: '', assignees: [], removidos: [], materialReady: false, materialBruto: '', briefReady: false, manualGroup: undefined, manualStatus: undefined, manualCap: undefined, board: 'producao', prioridade: '', objetivo: '' };
    
    const inicio = (inicial && typeof inicial === 'object') ? inicial : {};
    if (inicio.board === 'demandas' || inicio.board === 'producao') state.board = inicio.board;
    if(inicio.grupo_id) {
      // Só grupo do quadro: um grupo de fora (sobra de importação) seria
      // recusado pelo servidor na hora de criar.
      const grupo=String(inicio.grupo_id);
      if(fcQuadro().grupos.some(g=>g.val===grupo)) state.manualGroup=grupo;
    }
    // So aceita cliente que exista na lista do passo: guardar um nome que a tela
    // nao mostra deixaria o resumo falando de um cliente que ninguem escolheu.
    //
    // A comparacao ignora caixa e acento porque o mesmo cliente chega escrito de
    // dois jeitos vindo do Monday — 'ConectaSim' no filtro do calendario e
    // 'Conectasim' na lista daqui, e o cadastro perguntava de novo um cliente
    // que ja estava escolhido. O que NAO se faz e aproximar por pedaco do nome:
    // dois clientes podem comecar igual, e chutar entre eles cadastraria a peca
    // no cliente errado. (Este comentario citava 'Gonzalez' e 'Gonzalez
    // Advocacia' como exemplo de dois clientes de verdade — nao sao: o cliente e
    // Gonzalez Gastronomia, e o segundo nome nunca existiu.)
    const listaDeClientes = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
    const chaveCliente = (nome) => String(nome || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (inicio.client) {
      const alvo = chaveCliente(inicio.client);
      const achado = alvo && listaDeClientes.find((c) => chaveCliente(c) === alvo);
      if (achado) { state.client = achado; state.clients = [achado]; }
    }
    if (inicio.veic) {
      state.itens[0].veic = inicio.veic;
      state.itens[0].prazo = inicio.prazo || getOffsetDate(inicio.veic, -7);
    }
    // O calendario sazonal manda tambem o nome da data e um comeco de briefing:
    // sem isso quem escolheu "Dia do Cliente" teria que redigitar "Dia do
    // Cliente" na linha seguinte.
    if (inicio.titulo) state.itens[0].titulo = inicio.titulo;
    if (['atracao', 'educacao', 'conversao'].includes(inicio.objetivo)) state.objetivo = inicio.objetivo;
    if (inicio.brief)  state.itens[0].brief  = inicio.brief;
    if (inicio.veic || inicio.titulo || inicio.brief) fcEspelharPrimeiro();

    // Exposta porque a troca de quadro precisa redesenhar grupo, status e a
    // terceira coluna — e ela mora dentro desta função.
    window.renderCustomDropdownsGlobal = () => renderCustomDropdowns();
    function renderCustomDropdowns() {
        const getCol = fcCorDeStatus;
        
        const quadro = fcQuadro();
        const groups = quadro.grupos;
        const statuses = fcListaCatalogo('manualStatus');
        const caps = ['', ...fcListaCatalogo('manualCap')];
        const ehDemanda = state.board === 'demandas';
        
        const html = `
           <div class="fc-auto-col" id="col-manualGroup">
              <label>Grupo / Destino</label>${fcAdicionarOpcaoHtml('manualGroup')}
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-manualGroup" onclick="fcToggleDropdown('fc-list-group')">Redação</div>
                 <div class="fc-dropdown-list" id="fc-list-group">
                    ${groups.map(g => `<div class="fc-dropdown-item" data-val="${esc(g.val)}" data-label="${esc(g.label)}" onclick="fcSelectDropdown('manualGroup', this.dataset.val, this.dataset.label)">${esc(g.label)}</div>`).join('')}
                 </div>
              </div>
           </div>
           
           <div class="fc-auto-col" id="col-manualStatus">
              <label>Status Inicial</label>${fcAdicionarOpcaoHtml('manualStatus')}
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-manualStatus" onclick="fcToggleDropdown('fc-list-status')" style="background:#c4c4c4; color:#000; border:none;">A Fazer</div>
                 <div class="fc-dropdown-list" id="fc-list-status">
                    ${statuses.map(s => {
                        const col = getCol(s).color;
                        const txt = (col === '#c4c4c4' || col === '#ffcb00') ? '#000' : '#fff';
                        return `<div class="fc-dropdown-item" data-valor="${esc(s)}" onclick="fcSelectDropdown('manualStatus', this.dataset.valor, this.dataset.valor, {color:'${col}'})" style="background:${col}; color:${txt}; margin-bottom:4px;">${esc(s)}</div>`;
                    }).join('')}
                 </div>
              </div>
           </div>
           
           ${ehDemanda ? `
           <div class="fc-auto-col" id="col-prioridade">
              <label>Prioridade</label>${fcAdicionarOpcaoHtml('prioridade')}
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-prioridade" onclick="fcToggleDropdown('fc-list-prio')">${esc(state.prioridade || '- Nenhuma -')}</div>
                 <div class="fc-dropdown-list" id="fc-list-prio">
                    ${['', ...fcListaCatalogo('prioridade')].map(pr => {
                        const col = getCol(pr).color;
                        const txt = (col === '#c4c4c4' || col === '#ffcb00') ? '#000' : '#fff';
                        if(!pr) return `<div class="fc-dropdown-item" onclick="fcSelectDropdown('prioridade', '', '- Nenhuma -')" style="color:#849aa6; margin-bottom:4px;">- Nenhuma -</div>`;
                        return `<div class="fc-dropdown-item" data-valor="${esc(pr)}" onclick="fcSelectDropdown('prioridade', this.dataset.valor, this.dataset.valor, {color:'${col}'})" style="background:${col}; color:${txt}; margin-bottom:4px;">${esc(pr)}</div>`;
                    }).join('')}
                 </div>
              </div>
           </div>` : `
           <div class="fc-auto-col" id="col-manualCap">
              <label>Captação Externa</label>${fcAdicionarOpcaoHtml('manualCap')}
              <div class="fc-custom-dropdown">
                 <div class="fc-dropdown-value" id="fc-val-manualCap" onclick="fcToggleDropdown('fc-list-cap')">- Nenhuma -</div>
                 <div class="fc-dropdown-list" id="fc-list-cap">
                    ${caps.map(s => {
                        if(!s) return `<div class="fc-dropdown-item" onclick="fcSelectDropdown('manualCap', '', '- Nenhuma -')" style="color:#849aa6; margin-bottom:4px;">- Nenhuma -</div>`;
                        const col = getCol(s).color;
                        const txt = (col === '#c4c4c4' || col === '#ffcb00') ? '#000' : '#fff';
                        return `<div class="fc-dropdown-item" data-valor="${esc(s)}" onclick="fcSelectDropdown('manualCap', this.dataset.valor, this.dataset.valor, {color:'${col}'})" style="background:${col}; color:${txt}; margin-bottom:4px;">${esc(s)}</div>`;
                    }).join('')}
                 </div>
              </div>
           </div>`}
        `;

        // Guarda: no fluxo por etapas este bloco so existe no ultimo passo.
        const caixa = document.getElementById('fc-auto-group-container');
        if (!caixa) return;
        caixa.innerHTML = html;

        // Era registrado toda vez que a lista era redesenhada — um ouvinte novo
        // por redesenho, todos vivos ao mesmo tempo.
        const capa = document.getElementById('fc-overlay');
        if (capa && !capa.dataset.fechaDropdown) {
            capa.dataset.fechaDropdown = '1';
            capa.addEventListener('click', (e) => {
                if(!e.target.closest('.fc-custom-dropdown')) {
                    document.querySelectorAll('.fc-dropdown-list').forEach(el => el.classList.remove('open'));
                }
            });
        }
    }
    
    const clients = typeof cadastrosClientOptions === 'function' ? cadastrosClientOptions() : [];
    const formats = typeof CADASTROS_FORMATS !== 'undefined' ? CADASTROS_FORMATS : ['Reels','Vídeo','Fotografia','Carrossel','Post Único','Motion','Stories'];

    const overlay = document.createElement('div');
    overlay.id = 'fc-overlay';
    overlay.className = 'fc-overlay';
    overlay.onclick = e => { if(e.target === overlay) fcCloseModal(); };

    // Errar o alvo por dois centimetros nao pode custar o cadastro inteiro: sem
    // isto o navegador abre o arquivo solto e a janela vai embora com tudo que
    // ja foi preenchido. Com um conteudo so na lista, o arquivo ainda vai para
    // o lugar certo; com varios, avisa em qual cartao soltar.
    overlay.ondragover = (e) => e.preventDefault();
    overlay.ondrop = (e) => {
      e.preventDefault();
      if (e.target.closest?.('.nd-mais-col')) return;
      const temArquivo = (e.dataTransfer?.files || []).length > 0;
      if (!temArquivo) return;
      // O arquivo solto em qualquer ponto da janela vai para o conteúdo que está aberto.
      fcSoltarArquivos(e, fcItemAtivo(), null);
      fcAlternarMais(true);
    };

    overlay.innerHTML = `
      <div class="nd" role="dialog" aria-modal="true" aria-labelledby="fc-nd-titulo">
        <div class="nd-topo">
          <h1 id="fc-nd-titulo">Nova demanda</h1>
          <span class="nd-sub fc-trilha-texto">Etapa ${fcEtapa + 1} de ${FC_ETAPAS.length}</span>
          <button type="button" aria-label="Fechar cadastro" class="nd-btn s nd-x" onclick="fcCloseModal()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="v2-barra nd-barra" role="progressbar" aria-label="Etapas do cadastro" aria-valuemin="1" aria-valuemax="3"><i style="--v:33%;--c:#FF7A2F"></i></div>
        <div class="nd-corpo" id="fc-guia"></div>
        <div class="nd-pe">
          <p class="nd-sub" id="fc-nota"></p>
          <button type="button" class="nd-btn" id="fc-voltar-btn" onclick="fcVoltar()">Voltar</button>
          <button type="button" class="nd-btn k principal" id="fc-submit-btn" onclick="fcAvancar()">Criar demanda</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    // Desenhar o primeiro passo NAO espera quadro de animacao: em aba fora de
    // foco o requestAnimationFrame nao dispara, e o cadastro abria vazio. Quem
    // precisa do quadro e so a transicao de entrada.
    // Sem nada pronto, comeca do comeco. Com o calendario tendo respondido
    // cliente e data, abre direto na primeira pergunta que falta — o passo
    // pulado continua no trilho do topo, a um clique de distancia.
    fcPasso = 0;
    fcEtapa = 0;
    if (!inicio.escolherQuadro && (inicio.client || inicio.veic || inicio.board || inicio.titulo)) {
      const pendente = FC_PASSOS.findIndex((q) => !fcRespondido(q));
      fcPasso = pendente < 0 ? FC_PASSOS.length - 1 : pendente;
    }
    fcDesenharPasso();
    if (typeof ensureClientMasterSources === 'function') void ensureClientMasterSources().then(() => {
      if (document.getElementById('fc-overlay') === overlay && !fcEnviando && !overlay.contains(document.activeElement)
          && !document.getElementById('fc-nova-opcao') && !document.getElementById('fc-busca-cliente')?.value) fcDesenharPasso();
    }).catch(() => {});
    requestAnimationFrame(() => {
       overlay.classList.add('open');
       
       // Bind title input live update safely
       overlay.addEventListener('keydown', function(e) {
           if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
               e.preventDefault();
               fcSubmit();
           }
       });
       
       // Enter avanca; dentro do briefing ele quebra linha, como se espera.
       overlay.addEventListener('keydown', function(e) {
           if (e.defaultPrevented || e.ctrlKey || e.metaKey) return;
           if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fcCloseModal(); return; }
           if (e.key === 'Enter' && !e.shiftKey && !['TEXTAREA','BUTTON','SELECT','A'].includes(e.target.tagName)) {
               e.preventDefault();
               fcAvancar();
           }
       });
    });
  };

  // Chamada pelo calendario sazonal com o cadastro JA aberto. Reabrir do zero
  // jogaria fora o cliente e o formato que a pessoa acabou de escolher, entao
  // aqui a data so entra na lista: ocupa o conteudo em branco se houver um, e
  // senao vira mais um conteudo — escolher tres datas cadastra as tres juntas.
  window.fcPreencherDoCalendario = function(dados) {
    if (!dados || !dados.veic) return;
    fcSincronizarDaTela();
    const vazio = state.itens.findIndex(
      (i) => !String(i.titulo || '').trim() && !i.veic && !String(i.brief || '').trim());
    const item = { titulo: dados.titulo || '', veic: dados.veic,
                   prazo: dados.prazo || getOffsetDate(dados.veic, -7), brief: dados.brief || '' };
    if (vazio >= 0) state.itens[vazio] = item; else state.itens.push(item);
    fcEspelharPrimeiro();

    // Vai para a primeira pergunta que ainda falta. Com cliente e formato ja
    // respondidos isso cai na lista de conteudos, que e onde a data aparece.
    const pendente = FC_PASSOS.findIndex((q) => !fcRespondido(q));
    fcPasso = pendente < 0 ? FC_PASSOS.indexOf('itens') : pendente;
    fcDesenharPasso();
    if (typeof showToast === 'function') {
      showToast(`${dados.titulo || 'Data'} entrou no cadastro — veiculação em ${dados.veic.split('-').reverse().join('/')}.`, 'ok');
    }
  };

  window.fcCloseModal = function() {
    if (fcEnviando) return;
    const existing = document.getElementById('fc-overlay');
    if(existing) {
       existing.classList.remove('open');
       setTimeout(() => existing.remove(), 300);
    }
  };

  window.showCadastrosPreview = () => window.openCadastrosGoverned();

})();
