// vybe-mundo-cliente.js — o Centro de Operação do cliente na placa do Irecity.
//
// Clicar num cliente na cidade abre a placa (mostrarCliente, vybe-mundo.js). Estes blocos levam
// para ela o que o Centro de Operação do Escritório mostrava (abrirAgenteOperacaoEscritorio e
// escritorioListasDoAgente, vybe-escritorio.js) e ainda faltava no Irecity.
// Visão única (Paulo, 07/11/2026), no alto da placa, primeiro no celular:
//   · Saúde: a da Carteira (VybeCarteira.dados(), se existir); senão a da Gestão (VybeDono.calcular).
//   · Contrato e financeiro: só donos e quem administra, e só se VybeCarteira/VybeComercial existirem.
//   · Peças do mês: VybeRelatorioResumo.resumoDoMes (vybe-relatorio-resumo.js), com status, objetivo e
//     aprovação (VybeConteudo, se existir) e o botão "Relatório do mês" (VybeRelatorio.abrir).
//   · Clima do grupo: só se a Carteira trouxer. · Cérebro: o estudo do VYBES e o botão do canvas.
//   `fontes(nome)` junta essas leituras para o relatório também. Depois, a operação:
//   · Esperando o cliente: peças cuja próxima ação é do cliente (a mesma regra do radar de risco,
//     riskActionOwner em vybe-risco.js) e há quantos dias estão paradas (status_updated_at).
//   · Esta semana: peças com veiculação de segunda a domingo e a meta de 3 posts por semana.
//   · Próximas 4 semanas: mini calendário das veiculações, um ponto por peça.
//   · Planejamentos: a mesma consulta da ficha do cliente (pljPedir, vybe-planejamentos.js) e o
//     link do cadastro (planejamento_url), quando houver.
//   · Desativar e Apagar para sempre: as janelas do ciclo de vida (vybe-ciclo.js), só para quem
//     administra, com os mesmos argumentos do Escritório e do subsolo.
// Nada aqui grava: os cliques abrem as janelas de sempre (openItemWorkspace, abrirPlanejamento,
// abrirDesativarNoCiclo, abrirApagarNoCiclo), e quem grava e confere é o servidor.
//
// Uso em mostrarCliente: no fim do HTML da placa, `${window.VybeClientePlaca?.html(c.nome) || ''}`;
// depois de pôr na tela, `window.VybeClientePlaca?.ligar(p)`. Visual em vybe-mundo-cliente.css.
(() => {
  // Status na cor do quadro (statusCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function statusCor(d) { const g = globalThis.statusCor; return typeof g === 'function' && g !== statusCor ? g(d) : String(d?.status || 'Sem status').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  const G = typeof window !== 'undefined' ? window : globalThis;

  // Meta da agência: 3 posts por cliente por semana (a mesma da Visão do dono).
  const META_SEMANA = 3;
  // Parada há mais que isto (dias) fica âmbar na lista "Esperando o cliente".
  const PARADA_DIAS = 3;
  const MAX_LINHAS = 5;
  const MAX_SEMANA = 7;
  const SEMANAS = 4;
  const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  // Os status em que quem destrava é o cliente: a lista de riskActionOwner (vybe-risco.js), a mesma
  // do "esperando o cliente" do Centro de Operação. tests/mundo-cliente.test.mjs confere que
  // continuam iguais. "Para aprovação" é a aprovação interna (fica com a agência).
  const ESPERA_DO_CLIENTE = Object.freeze(['Falta Info', 'Ag. Info Cliente', 'Aguardo', 'Ag. Aprovação Cliente']);
  // Estado do planejamento → escala de urgência (docs/padrao-visual.md, item 3).
  const NIVEL_DO_PLANEJAMENTO = { revisar: 'u2', ajustes: 'u3a', enviado: 'u4', aprovado: 'u6', cadastrado: 'u6', arquivado: 'u5' };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
  const lista = (v) => (Array.isArray(v) ? v : []);
  const chamar = (nome, ...a) => (typeof G[nome] === 'function' ? G[nome](...a) : undefined);
  const souAdminAqui = () => { try { return typeof souAdmin === 'function' && Boolean(souAdmin()); } catch { return false; } };

  // ---------- Datas: dias sem hora, sem deslocamento de fuso ----------
  const pad = (n) => String(n).padStart(2, '0');
  const dataLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hojeIso = () => (typeof hojeDeVerdade === 'function' ? hojeDeVerdade() : dataLocal(new Date()));
  const dia = (v) => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
  const meioDia = (iso) => new Date(`${iso}T12:00:00Z`);
  const somar = (iso, n) => { const x = meioDia(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const segundaDe = (iso) => somar(iso, -((meioDia(iso).getUTCDay() + 6) % 7));
  const diasEntre = (de, ate) => Math.round((meioDia(ate) - meioDia(de)) / 864e5);
  const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const diaDaSemana = (iso) => DIAS_CURTOS[(meioDia(iso).getUTCDay() + 6) % 7];
  // status_updated_at vem com hora: o dia é o do relógio local, como em hojeDeVerdade.
  function diaDoCarimbo(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : dataLocal(d);
  }

  // ---------- Peças do cliente, pelas regras do painel ----------
  function todasAsPecas() {
    // Conteúdos e solicitações juntos, sem repetir (a mesma fonte do Centro de Operação).
    if (typeof unifiedOperationalItems === 'function') { try { return lista(unifiedOperationalItems()); } catch { /* cai para DADOS_ALL */ } }
    return lista(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : null);
  }
  const normCliente = (n) => (typeof normalizarCliente === 'function' ? normalizarCliente(String(n || '')) : String(n || '').trim());
  const chaveCliente = (n) => normCliente(n).toLowerCase();
  const clientesDe = (d) => (typeof clientesDoItem === 'function' ? clientesDoItem(d) : (Array.isArray(d?.clientes) ? d.clientes : [d?.cliente]).filter(Boolean));
  const ehSolicitacao = (d) => (typeof isRequestItem === 'function' ? isRequestItem(d) : d?.origem === 'solicitacao');
  const statusDoFluxo = (d) => (typeof operationalFlowStatus === 'function' ? operationalFlowStatus(d) : String(d?.status || '').trim());
  const fechada = (d) => (typeof isFinishedItem === 'function' ? isFinishedItem(d) : /^(finalizado|feito|conclu[ií]do)$/i.test(statusDoFluxo(d)));
  // Atraso é o do mundo inteiro (situacaoDaPecaNoMundo, vybe-mundo.js): veiculação ou prazo vencidos.
  function atrasada(d, hoje) {
    if (typeof G.situacaoDaPecaNoMundo === 'function') return G.situacaoDaPecaNoMundo(d, hoje) === 'atrasada';
    if (fechada(d)) return false;
    const veic = dia(d?.veiculacao_iso), prazo = dia(d?.prazo_iso);
    return Boolean((veic && veic < hoje) || d?.prazo_atrasado || (prazo && prazo < hoje));
  }
  const semResponsavel = (d) => !(lista(d?.responsavel_ids).length || d?.responsavel_id || String(d?.responsavel || '').replace(/[—–-]/g, '').trim());
  // Nível da escala de urgência (docs/padrao-visual.md, item 3) para a etiqueta de cada peça.
  function nivel(d, hoje) {
    if (fechada(d)) return 'u6';
    if (atrasada(d, hoje)) return 'u1';
    if (dia(d?.veiculacao_iso) === hoje || dia(d?.prazo_iso) === hoje) return 'u2';
    const st = statusDoFluxo(d);
    if (/altera|ajuste|corre/i.test(st)) return 'u3a';
    if (/falta|info/i.test(st)) return 'u3b';
    if (/aprova|aguardo/i.test(st)) return 'u4';
    if (semResponsavel(d)) return 'u5';
    return 'u6';
  }
  const esperaDoCliente = (d) => !fechada(d) && ESPERA_DO_CLIENTE.includes(statusDoFluxo(d));
  function diasParada(d, hoje) {
    const desde = diaDoCarimbo(d?.status_updated_at);
    if (desde) return Math.max(0, diasEntre(desde, hoje));
    const horas = Number(d?.operational_risk?.hours_in_status);
    return d?.operational_risk?.hours_in_status != null && Number.isFinite(horas) && horas >= 0 ? Math.floor(horas / 24) : null;
  }
  const quantoTempo = (n) => (n === null ? 'sem data da etapa' : n === 0 ? 'desde hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`);

  function cadastroDe(nome) {
    if (typeof cadastroDoCliente === 'function') { try { const c = cadastroDoCliente(nome); if (c) return c; } catch { /* procura abaixo */ } }
    const alvo = chaveCliente(nome);
    return lista(typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : null).find((c) => chaveCliente(c?.nome) === alvo) || null;
  }
  function linkSeguro(v) {
    if (typeof linkDeCliente === 'function') return linkDeCliente(v);
    try { const u = new URL(String(v || '').trim()); return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
  }

  // ---------- Fontes de outros módulos (só se existirem) ----------
  // VybeCarteira (saúde, risco, contrato, clima), VybeConteudo (objetivo e aprovação das peças) e
  // VybeComercial (financeiro) nascem em outras frentes. Aqui só se lê `X.dados()` quando o módulo
  // existe; o formato é lido com folga (lista, { clientes }, { itens }, objeto por id ou por nome) e,
  // sem o módulo ou sem o cliente nele, o bloco some ou cai na fonte que o painel já tem.
  // Sócio (dono) pela informação do servidor (sessão, server/donos.js), não pelo primeiro nome.
  function souSocioAqui() {
    try { return typeof souDonoDaSessao === 'function' && souDonoDaSessao(); } catch { return false; }
  }
  // Contrato e financeiro: só os donos e quem administra (o servidor de cada módulo confere de novo).
  const veNegocio = () => souAdminAqui() || souSocioAqui();
  function dadosDe(nomeModulo) {
    const m = G[nomeModulo];
    if (!m || typeof m.dados !== 'function') return null;
    try { return m.dados() ?? null; } catch { return null; }
  }
  const ehObjeto = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  function registrosDe(dados) {
    if (Array.isArray(dados)) return dados;
    if (dados instanceof Map) return [...dados.values()];
    if (!ehObjeto(dados)) return [];
    for (const k of ['clientes', 'itens', 'lista', 'registros']) if (Array.isArray(dados[k])) return dados[k];
    return Object.entries(dados).filter(([, v]) => ehObjeto(v)).map(([k, v]) => ({ _chave: k, ...v }));
  }
  function registroDoCliente(dados, cad, nome) {
    if (!dados) return null;
    const id = cad?.id != null ? String(cad.id) : '', chave = chaveCliente(cad?.nome || nome);
    return registrosDe(dados).find((r) => ehObjeto(r) && (
      (id && [r.cliente_id, r.clienteId, r._chave].some((v) => v != null && String(v) === id))
      || [r.cliente, r.nome, r.cliente_nome, r._chave].some((v) => typeof v === 'string' && chaveCliente(v) === chave))) || null;
  }
  // Saúde: a da Carteira, se houver; senão a da Gestão (VybeDono.calcular, que já está na main).
  const SAUDE_NIVEL = { critico: ['Crítico', 'u1'], atencao: ['Atenção', 'u2'], ok: ['Em dia', 'u6'] };
  function nivelDaSaude(v) {
    const t = String(typeof v === 'object' && v ? (v.nivel ?? v.estado ?? v.saude ?? '') : v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/crit|alto|grave|risco|vermel/.test(t)) return 'critico';
    if (/aten|medio|moder|amarel|alert/.test(t)) return 'atencao';
    if (/\bok\b|bom|boa|saud|baixo|verde|em dia|estavel/.test(t)) return 'ok';
    return '';
  }
  const frases = (v) => lista(v).map((x) => (typeof x === 'string' ? x : x?.texto || x?.motivo || x?.titulo || '')).map((s) => String(s).trim()).filter(Boolean);
  function saudeDe(nome, cad) {
    const r = registroDoCliente(dadosDe('VybeCarteira'), cad, nome);
    const nivelCarteira = r ? nivelDaSaude(r.saude ?? r.risco ?? r.estado) : '';
    if (r && nivelCarteira) {
      const pontos = Number(r.pontuacao ?? r.score ?? r.nota ?? (ehObjeto(r.saude) ? r.saude.pontuacao : NaN));
      return { fonte: 'Carteira', nivel: nivelCarteira, pontos: Number.isFinite(pontos) ? pontos : null,
        motivos: frases(r.motivos ?? r.alertas ?? r.sinais ?? (ehObjeto(r.saude) ? r.saude.motivos : null)) };
    }
    const D = G.VybeDono;
    if (!D?.calcular) return null;
    const pecas = todasAsPecas();
    if (!pecas.length) return null;
    try {
      const clientes = lista(typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : null);
      const c = lista(D.calcular({ demandas: pecas, clientes, hoje: hojeIso() })?.clientes).find((x) => chaveCliente(x.cliente) === chaveCliente(cad?.nome || nome));
      return c ? { fonte: 'Gestão', nivel: c.saude, pontos: null, motivos: frases(c.motivos) } : null;
    } catch { return null; }
  }
  // Campos de contrato/financeiro: os conhecidos com rótulo; o resto (texto, número, sim/não) com o nome do campo.
  const CAMPOS = [
    ['plano', 'Plano'], ['pacote', 'Pacote'], ['servicos', 'Serviços'], ['valor_mensal', 'Mensalidade'], ['mensalidade', 'Mensalidade'], ['valor', 'Valor'],
    ['inicio', 'Início'], ['fim', 'Fim'], ['vencimento', 'Vencimento'], ['renovacao', 'Renovação'], ['dia_pagamento', 'Dia do pagamento'],
    ['situacao', 'Situação'], ['status', 'Situação'], ['em_aberto', 'Em aberto'], ['aberto', 'Em aberto'], ['atrasado', 'Atrasado'],
    ['recebido', 'Recebido'], ['faturado', 'Faturado'], ['ultimo_pagamento', 'Último pagamento'], ['proximo_vencimento', 'Próximo vencimento'], ['margem', 'Margem'],
  ];
  const DINHEIRO = /valor|mensal|aberto|atrasad|recebid|faturad|preco|receita|custo/i;
  const IGNORAR = /^(_chave|id|cliente|cliente_id|clienteId|nome|cliente_nome|saude|risco|estado|motivos|alertas|sinais|clima|clima_grupo|humor|contrato|financeiro|pontuacao|score|nota)$/;
  function valorLegivel(chave, v) {
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (typeof v === 'number' && Number.isFinite(v)) return DINHEIRO.test(chave) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : v.toLocaleString('pt-BR');
    const s = String(v ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
    return s.slice(0, 80);
  }
  function camposDe(obj, max = 6) {
    if (!ehObjeto(obj)) return [];
    const usados = new Set(), saida = [];
    for (const [k, rotuloCampo] of CAMPOS) {
      if (saida.length >= max || !Object.hasOwn(obj, k) || usados.has(rotuloCampo)) continue;
      const v = valorLegivel(k, obj[k]);
      if (v) { saida.push([rotuloCampo, v]); usados.add(rotuloCampo); }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (saida.length >= max || IGNORAR.test(k) || CAMPOS.some(([c]) => c === k) || !['string', 'number', 'boolean'].includes(typeof v)) continue;
      const t = valorLegivel(k, v);
      if (t) saida.push([k.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()), t]);
    }
    return saida;
  }
  function negocioDe(nome, cad) {
    if (!veNegocio()) return null;
    const carteira = registroDoCliente(dadosDe('VybeCarteira'), cad, nome);
    const comercial = registroDoCliente(dadosDe('VybeComercial'), cad, nome);
    const contrato = camposDe(ehObjeto(carteira?.contrato) ? carteira.contrato : null);
    const financeiro = camposDe(ehObjeto(comercial?.financeiro) ? comercial.financeiro : comercial);
    return contrato.length || financeiro.length ? { contrato, financeiro } : null;
  }
  // Clima do grupo: só se a Carteira trouxer (texto ou { nivel, resumo, atualizado_em }).
  function climaDe(nome, cad) {
    const r = registroDoCliente(dadosDe('VybeCarteira'), cad, nome);
    const c = r ? (r.clima ?? r.clima_grupo ?? r.humor) : null;
    if (!c) return null;
    if (typeof c === 'string') return { resumo: c.trim().slice(0, 240), nivel: nivelDaSaude(c), quando: '' };
    if (!ehObjeto(c)) return null;
    const resumo = String(c.resumo ?? c.texto ?? c.rotulo ?? '').trim().slice(0, 240);
    const nivelC = nivelDaSaude(c.nivel ?? c.estado ?? c.sentimento ?? resumo);
    return resumo || nivelC ? { resumo, nivel: nivelC, quando: diaDoCarimbo(c.atualizado_em ?? c.data) } : null;
  }
  // Objetivo e aprovação da peça: o campo da própria peça, ou VybeConteudo (objetivoDe/aprovacaoDe, ou dados() por peça).
  let cacheConteudo = { em: 0, mapa: null };
  function mapaConteudo() {
    if (Date.now() - cacheConteudo.em < 5000) return cacheConteudo.mapa;
    const regs = registrosDe(dadosDe('VybeConteudo'));
    const mapa = regs.length ? new Map() : null;
    for (const r of regs) {
      const id = r?.peca_id ?? r?.demanda_id ?? r?.conteudo_id ?? r?.id ?? r?._chave;
      if (id != null) mapa.set(String(id), r);
    }
    cacheConteudo = { em: Date.now(), mapa };
    return mapa;
  }
  function doConteudo(d, fn, campos) {
    for (const c of campos) if (d?.[c]) return d[c];
    const C = G.VybeConteudo;
    if (C && typeof C[fn] === 'function') { try { const v = C[fn](d); if (v) return v; } catch { /* segue para dados() */ } }
    const r = mapaConteudo()?.get(String(d?.id));
    for (const c of campos) if (r?.[c]) return r[c];
    return '';
  }
  const objetivoDe = (d) => doConteudo(d, 'objetivoDe', ['objetivo']);
  const aprovacaoDe = (d) => { const v = doConteudo(d, 'aprovacaoDe', ['aprovacao', 'status_aprovacao']); return String((typeof v === 'object' && v ? v.status ?? v.rotulo : v) || '').trim(); };
  // Tudo o que a ficha e o relatório leem dos outros módulos, numa chamada (VybeRelatorio usa também).
  function fontes(nomeCliente) {
    const nome = normCliente(nomeCliente), cad = cadastroDe(nome);
    return { nome: cad?.nome || nome, cadastro: cad, saude: saudeDe(nome, cad), negocio: negocioDe(nome, cad), clima: climaDe(nome, cad), objetivoDe, aprovacaoDe, veNegocio: veNegocio() };
  }

  // ---------- Pedaços de HTML ----------
  const nota =(texto, extra = '') => `<p class="vv-cli-nota${extra ? ' ' + extra : ''}">${esc(texto)}</p>`;
  const rotulo = (texto, lado = '') => `<div class="vv-cli-rotulo"><span>${esc(texto)}</span>${lado}</div>`;
  const tituloDaPeca = (d) => String(d?.nome || d?.titulo || 'Peça sem título').trim();

  function linhaEspera(d, hoje) {
    const parada = diasParada(d, hoje), atr = atrasada(d, hoje);
    const u = atr ? 'u1' : parada !== null && parada > PARADA_DIAS ? 'u2' : nivel(d, hoje);
    const veic = dia(d.veiculacao_iso);
    const apoio = [statusDoFluxo(d), veic ? `veiculação ${diaMes(veic)}` : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="vv-cli-linha ${u}" data-vv-cli-peca="${esc(d.id)}" title="${esc(`${tituloDaPeca(d)} · ${apoio}`)}">
      <span class="vv-cli-meio"><b>${esc(tituloDaPeca(d))}</b><small>${esc(apoio)}</small></span>
      <em class="vv-cli-tag ${u}">${esc(atr ? `atrasada · ${quantoTempo(parada)}` : quantoTempo(parada))}</em></button>`;
  }
  function linhaComDia(d, hoje) {
    const veic = dia(d.veiculacao_iso), u = nivel(d, hoje);
    const apoio = String(d.responsavel || '').trim() || 'sem responsável';
    return `<button type="button" class="vv-cli-linha${u === 'u1' || u === 'u2' ? ' ' + u : ''}" data-vv-cli-peca="${esc(d.id)}" title="${esc(`${tituloDaPeca(d)} · ${d.status || ''}`)}">
      <span class="vv-cli-quando${veic === hoje ? ' hoje' : ''}"><small>${veic === hoje ? 'Hoje' : diaDaSemana(veic)}</small><b>${esc(veic.slice(8, 10))}</b></span>
      <span class="vv-cli-meio"><b>${esc(tituloDaPeca(d))}</b><small>${esc(apoio)}</small></span>
      <em class="vv-cli-tag vv-cli-status">${statusCor(d)}</em></button>`;
  }

  function blocoEspera(pecas, hoje) {
    const esperando = pecas.filter(esperaDoCliente).map((d) => ({ d, atr: atrasada(d, hoje), parada: diasParada(d, hoje) }))
      .sort((a, b) => (a.atr === b.atr ? 0 : a.atr ? -1 : 1) || (b.parada ?? -1) - (a.parada ?? -1) || tituloDaPeca(a.d).localeCompare(tituloDaPeca(b.d)));
    const conta = `<span class="vv-cli-conta">${esperando.length}</span>`;
    return `<section class="vv-cli-secao" data-vv-cli-secao="espera">${rotulo('Esperando o cliente', conta)}
      ${esperando.length ? esperando.slice(0, MAX_LINHAS).map((x) => linhaEspera(x.d, hoje)).join('') : nota('Nada esperando o cliente agora.')}
      ${esperando.length > MAX_LINHAS ? nota(`e mais ${esperando.length - MAX_LINHAS} em Abrir o cliente`) : ''}</section>`;
  }

  function blocoSemana(conteudos, hoje) {
    const seg = segundaDe(hoje), dom = somar(seg, 6);
    const daSemana = conteudos.filter((d) => { const v = dia(d.veiculacao_iso); return v && v >= seg && v <= dom; })
      .sort((a, b) => dia(a.veiculacao_iso).localeCompare(dia(b.veiculacao_iso)) || tituloDaPeca(a).localeCompare(tituloDaPeca(b)));
    const n = daSemana.length, bateu = n >= META_SEMANA;
    const meta = `<span class="vv-cli-meta ${bateu ? 'ok' : 'falta'}" title="Meta: ${META_SEMANA} posts por semana">${n} de ${META_SEMANA}</span>`;
    return `<section class="vv-cli-secao" data-vv-cli-secao="semana">${rotulo(`Esta semana · ${diaMes(seg)} a ${diaMes(dom)}`, meta)}
      ${n ? daSemana.slice(0, MAX_SEMANA).map((d) => linhaComDia(d, hoje)).join('') : nota('Nenhuma peça com veiculação nesta semana.')}
      ${n > MAX_SEMANA ? nota(`e mais ${n - MAX_SEMANA} nesta semana`) : ''}</section>`;
  }

  function blocoCalendario(conteudos, hoje) {
    const inicio = segundaDe(hoje), fim = somar(inicio, SEMANAS * 7 - 1);
    const porDia = new Map();
    for (const d of conteudos) {
      const v = dia(d.veiculacao_iso);
      if (!v || v < inicio || v > fim) continue;
      if (!porDia.has(v)) porDia.set(v, []);
      porDia.get(v).push(d);
    }
    let total = 0;
    const celulas = Array.from({ length: SEMANAS * 7 }, (_, i) => {
      const iso = somar(inicio, i), pecas = porDia.get(iso) || [];
      total += pecas.length;
      const pontos = pecas.slice(0, 3).map((d) => `<i${fechada(d) ? ' class="feita"' : ''}></i>`).join('') + (pecas.length > 3 ? `<b>+${pecas.length - 3}</b>` : '');
      const classes = ['vv-cli-dia', iso === hoje ? 'hoje' : '', iso < hoje ? 'passado' : '', pecas.length ? 'tem' : ''].filter(Boolean).join(' ');
      // O dia 1 leva o mês (1/12): a virada aparece no meio da grade.
      const numero = iso.slice(8, 10) === '01' ? `1/${Number(iso.slice(5, 7))}` : Number(iso.slice(8, 10));
      return `<button type="button" class="${classes}" data-vv-cli-dia="${iso}" aria-pressed="false"${pecas.length ? '' : ' disabled'} aria-label="${esc(`${diaDaSemana(iso)} ${diaMes(iso)}${iso === hoje ? ', hoje' : ''}: ${pecas.length} ${pecas.length === 1 ? 'peça' : 'peças'}`)}"><span>${numero}</span><em>${pontos}</em></button>`;
    }).join('');
    const listas = [...porDia.keys()].sort().map((iso) => `<div class="vv-cli-dia-lista" data-vv-cli-lista="${iso}" hidden>
      ${porDia.get(iso).sort((a, b) => tituloDaPeca(a).localeCompare(tituloDaPeca(b))).map((d) => linhaComDia(d, hoje)).join('')}</div>`).join('');
    return `<section class="vv-cli-secao" data-vv-cli-secao="calendario">${rotulo('Próximas 4 semanas', `<span class="vv-cli-conta">${total} ${total === 1 ? 'peça' : 'peças'}</span>`)}
      <div class="vv-cli-cal" role="group" aria-label="Veiculações das próximas 4 semanas">${DIAS_CURTOS.map((d) => `<span class="vv-cli-cal-sem" aria-hidden="true">${d.charAt(0)}</span>`).join('')}${celulas}</div>
      ${total ? `<p class="vv-cli-nota" data-vv-cli-dica>Cada ponto é uma peça pela veiculação. Toque num dia com pontos para ver as peças.</p>${listas}` : nota('Nenhuma veiculação nas próximas 4 semanas.')}</section>`;
  }

  function blocoPlanejamentos(cad) {
    const id = cad?.id != null ? String(cad.id) : '';
    const consulta = id && typeof pljPedir === 'function';
    const url = linkSeguro(cad?.planejamento_url);
    let host = '';
    try { host = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
    const link = url ? `<a class="vv-cli-linha" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-vv-cli-plj-link>
      <span class="vv-cli-meio"><b>Link do planejamento</b><small>${esc(host || 'no cadastro do cliente')}</small></span><em class="vv-cli-tag u5">no cadastro ↗</em></a>` : '';
    const caixa = consulta ? `<div class="vv-cli-plj" data-vv-cli-plj="${esc(id)}">${nota('Buscando os planejamentos…')}</div>`
      : nota(!id ? 'Este cliente ainda não tem cadastro no painel.' : url ? 'Só o link do cadastro: o planejamento não é acompanhado no painel.' : 'Os planejamentos não estão disponíveis nesta tela.');
    return `<section class="vv-cli-secao" data-vv-cli-secao="planejamentos">${rotulo('Planejamentos')}${caixa}${link}</section>`;
  }

  function blocoAcoes(cad) {
    if (!souAdminAqui() || cad?.id == null) return '';
    const inativo = cad.ativo === false || /inativ/i.test(String(cad.status || ''));
    // O servidor só apaga quem já foi desativado (server/ciclo-de-vida.js); o botão diz isso antes.
    return `<div class="vv-cli-acoes" data-vv-cli-secao="acoes">
      ${inativo ? '' : '<button type="button" class="vv-cli-perigo" data-vv-cli-desativar title="Desce para o subsolo: sai da cidade, das listas e do portal no Hub. Peças e histórico ficam; dá para reviver.">Desativar</button>'}
      <button type="button" class="vv-cli-perigo" data-vv-cli-apagar${inativo ? ' title="Apaga o cadastro para sempre: não tem volta."' : ' disabled aria-disabled="true" title="Só se apaga quem já foi desativado: desative antes."'}>Apagar para sempre</button>
      ${inativo ? '' : nota('Apagar para sempre só depois de desativar.')}</div>`;
  }

  // ---------- Visão única: saúde, contrato e financeiro, peças do mês, clima e cérebro ----------
  const MAX_MES = 6;
  function blocoSaude(s) {
    if (!s || !SAUDE_NIVEL[s.nivel]) return '';
    const [rot, u] = SAUDE_NIVEL[s.nivel];
    const lado = `<em class="vv-cli-tag ${u}">${esc(rot)}${s.pontos != null ? ` · ${esc(s.pontos)}` : ''}</em>`;
    const motivos = s.motivos.slice(0, 3);
    return `<section class="vv-cli-secao" data-vv-cli-secao="saude">${rotulo('Saúde do cliente', lado)}
      ${motivos.length ? `<ul class="vv-cli-motivos">${motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : nota('Nada pedindo atenção.')}
      ${nota(s.fonte === 'Carteira' ? 'Pela Carteira.' : 'Pela produção (as mesmas contas da Gestão).', 'fonte')}</section>`;
  }
  const grade = (campos) => `<dl class="vv-cli-grade">${campos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  function blocoNegocio(n) {
    if (!n) return '';
    return `<section class="vv-cli-secao" data-vv-cli-secao="negocio">${rotulo('Contrato e financeiro', '<span class="vv-cli-conta">só donos</span>')}
      ${n.contrato.length ? `<p class="vv-cli-sub">Contrato</p>${grade(n.contrato)}` : ''}
      ${n.financeiro.length ? `<p class="vv-cli-sub">Financeiro</p>${grade(n.financeiro)}` : ''}</section>`;
  }
  const NIVEL_OBJETIVO = { atracao: 'Atração', educacao: 'Educação', conversao: 'Conversão' };
  function equilibrioHtml(obj) {
    if (!obj?.disponivel) return '';
    const partes = obj.itens.filter((o) => o.total);
    return `<div class="vv-cli-equilibrio" role="img" aria-label="${esc(obj.itens.map((o) => `${o.rotulo} ${o.pct}%`).join(', '))}">
      <div class="vv-cli-barra">${partes.map((o) => `<i style="flex:${o.total};background:${o.cor}"></i>`).join('')}</div>
      <p>${obj.itens.map((o) => `<span><i style="background:${o.cor}"></i>${esc(o.rotulo)} <b>${o.pct}%</b></span>`).join('')}${obj.semObjetivo ? `<span class="sem">${obj.semObjetivo} sem objetivo</span>` : ''}</p></div>`;
  }
  function blocoMes(nome, hoje, f) {
    const R = G.VybeRelatorioResumo;
    const mes = hoje.slice(0, 7);
    const botao = `<button type="button" class="vv-cli-secundario" data-vv-cli-relatorio="${esc(mes)}">Relatório do mês</button>`;
    if (!R?.resumoDoMes) return `<section class="vv-cli-secao" data-vv-cli-secao="mes">${rotulo('Peças do mês')}${nota('O resumo do mês não carregou nesta tela.')}</section>`;
    let r;
    try { r = R.resumoDoMes({ pecas: todasAsPecas(), cliente: nome, mes, hoje, objetivoDe: f.objetivoDe, ehSolicitacao: ehSolicitacao }); } catch { r = null; }
    if (!r) return '';
    const porId = new Map(todasAsPecas().map((d) => [String(d?.id), d]));
    // Atrasada aqui é a do mundo inteiro (veiculação ou prazo vencidos), a mesma da barra vermelha da linha.
    const atrasadas = r.pecas.filter((p) => !p.entregue && porId.has(p.id) && atrasada(porId.get(p.id), hoje)).length;
    // Número grande só no que tem número (Padrão Vybe): o zero e o "sem medida" viram a linha discreta (vbResumoHtml).
    const quadros = [[r.total, 'no mês', ''], [r.entregues, 'entregues', ''], [atrasadas, 'atrasadas', 'u1'], [r.noPrazoPct == null ? null : r.noPrazoPct + '%', 'no prazo', '']];
    const ladrilhos = (l) => (l.length ? `<div class="vv-cli-kpis">${l.map(([v, t, cls]) => `<div><b${cls && v ? ` class="${cls}"` : ''}>${v == null ? '–' : v}</b><small>${t}</small></div>`).join('')}</div>` : '');
    const semNumero = ([v]) => v == null || v === 0;
    const kpis = typeof window.vbResumoHtml !== 'function' ? ladrilhos(quadros)
      : ladrilhos(quadros.filter((q) => !semNumero(q))) + (quadros.some(semNumero) ? `<div class="vs-resumo vv-radar-zeros">${window.vbResumoHtml(quadros.filter(semNumero).map(([v, t]) => (v == null ? { rotulo: 'no prazo: sem entrega para medir', tom: 'zero' } : { valor: 0, rotulo: t })))}</div>` : '');
    // Primeiro o que ainda não saiu (atrasadas antes), depois as entregues; dentro, pela data.
    const ordem = [...r.pecas].sort((a, b) => (a.entregue - b.entregue) || (b.atrasada - a.atrasada) || a.data.localeCompare(b.data));
    const linhas = ordem.slice(0, MAX_MES).map((p) => {
      const d = porId.get(p.id) || { id: p.id, status: p.status, veiculacao_iso: p.data };
      const u = nivel(d, hoje), aprov = aprovacaoDe(d);
      const apoio = [`${diaMes(p.data)}`, p.formato !== 'Sem formato' ? p.formato : '', aprov ? `aprovação: ${aprov}` : ''].filter(Boolean).join(' · ');
      const obj = p.objetivo ? `<span class="vv-cli-obj ${p.objetivo}">${esc(NIVEL_OBJETIVO[p.objetivo])}</span>` : '';
      return `<button type="button" class="vv-cli-linha${u === 'u1' || u === 'u2' ? ' ' + u : ''}" data-vv-cli-peca="${esc(p.id)}" title="${esc(`${p.nome} · ${p.status}`)}">
        <span class="vv-cli-meio"><b>${esc(p.nome)}</b><small>${obj}${esc(apoio)}</small></span><em class="vv-cli-tag vv-cli-status">${statusCor({ ...d, status: p.status || d?.status })}</em></button>`;
    }).join('');
    return `<section class="vv-cli-secao" data-vv-cli-secao="mes">${rotulo(`Peças de ${r.rotuloMes}`, `<span class="vv-cli-conta">${r.total}</span>`)}
      ${kpis}${equilibrioHtml(r.objetivos)}
      ${r.total ? linhas : nota('Nenhum conteúdo com data neste mês.')}
      ${r.total > MAX_MES ? nota(`e mais ${r.total - MAX_MES} no relatório do mês`) : ''}
      <div class="vv-cli-botoes">${botao}</div></section>`;
  }
  function blocoClima(c) {
    if (!c) return '';
    const [rot, u] = SAUDE_NIVEL[c.nivel] || ['Sem leitura', 'u5'];
    return `<section class="vv-cli-secao" data-vv-cli-secao="clima">${rotulo('Clima do grupo', `<em class="vv-cli-tag ${u}">${esc(c.nivel === 'ok' ? 'Tranquilo' : rot)}</em>`)}
      ${c.resumo ? `<p class="vv-cli-texto">${esc(c.resumo)}</p>` : ''}${c.quando ? nota(`Lido em ${diaMes(c.quando)}.`, 'fonte') : ''}</section>`;
  }
  // O cérebro do cliente: o que o VYBES já sabe (vybe-clientes-cerebro.js) e o botão que abre o Canvas
  // de Sinapses pelo mesmo caminho da placa (data-cerebro-cliente, tratado em vybe-mundo.js).
  function blocoCerebro(nome) {
    if (typeof abrirModalCerebroCliente !== 'function') return '';
    let base = null;
    try { base = typeof encontrarBaseCerebro === 'function' ? encontrarBaseCerebro(nome) : null; } catch { base = null; }
    const paleta = lista(base?.paleta).slice(0, 6).map((c) => `<i title="${esc(c.nome)}" style="background:${/^#[0-9a-f]{3,8}$/i.test(c.hex) ? c.hex : '#E6E0D6'}"></i>`).join('');
    const tom = String(base?.tom || '').trim();
    return `<section class="vv-cli-secao" data-vv-cli-secao="cerebro">${rotulo('Cérebro do cliente')}
      ${base ? `${base.segmento ? `<p class="vv-cli-sub">${esc(base.segmento)}</p>` : ''}${tom ? `<p class="vv-cli-texto">${esc(tom.length > 180 ? tom.slice(0, 177) + '…' : tom)}</p>` : ''}${paleta ? `<div class="vv-cli-paleta" aria-label="Paleta da marca">${paleta}</div>` : ''}`
        : nota('O VYBES ainda não tem estudo próprio deste cliente: o cérebro mostra o que a operação já registrou.')}
      <div class="vv-cli-botoes"><button type="button" class="vv-cli-secundario" data-cerebro-cliente="${esc(nome)}">Abrir o cérebro</button></div></section>`;
  }

  // ---------- API ----------
  function html(nomeCliente) {
    const nome = normCliente(nomeCliente);
    if (!nome) return '';
    const hoje = hojeIso(), chave = chaveCliente(nome);
    const pecas = todasAsPecas().filter((d) => clientesDe(d).some((c) => chaveCliente(c) === chave));
    // Semana e calendário contam posts: só conteúdos (solicitação não é post).
    const conteudos = pecas.filter((d) => !ehSolicitacao(d));
    const f = fontes(nome), cad = f.cadastro, nomeCad = cad?.nome || nome;
    // Primeiro no celular: o que decide (saúde, dinheiro, o mês) no alto; a operação do dia a dia embaixo.
    return `<div class="vv-cli" data-vv-cli-cliente="${esc(nomeCad)}" data-vv-cli-id="${esc(cad?.id ?? '')}">
      ${blocoSaude(f.saude)}${blocoNegocio(f.negocio)}${blocoMes(nomeCad, hoje, f)}${blocoClima(f.clima)}${blocoCerebro(nomeCad)}
      ${blocoEspera(pecas, hoje)}${blocoSemana(conteudos, hoje)}${blocoCalendario(conteudos, hoje)}${blocoPlanejamentos(cad)}${blocoAcoes(cad)}</div>`;
  }

  function planejamentosHtml(planos) {
    if (!planos.length) return nota('Nenhum planejamento no painel ainda. Quando o agente do cliente publicar, aparece aqui.');
    const ordenados = [...planos].sort((a, b) => String(b.mes || '').localeCompare(String(a.mes || '')));
    return ordenados.slice(0, 3).map((p) => {
      const mes = typeof pljMes === 'function' ? pljMes(p.mes) : String(p.mes || '').slice(0, 7);
      const estado = (typeof PLJ_ESTADOS !== 'undefined' && PLJ_ESTADOS[p.estado]?.rotulo) || p.estado || 'Sem estado';
      const apoio = [p.titulo, p.versao ? `versão ${p.versao}` : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="vv-cli-linha" data-vv-cli-plj-abrir="${esc(p.id)}"><span class="vv-cli-meio"><b>${esc(mes || 'Sem mês')}</b><small>${esc(apoio)}</small></span><em class="vv-cli-tag ${NIVEL_DO_PLANEJAMENTO[p.estado] || 'u5'}">${esc(estado)}</em></button>`;
    }).join('') + (ordenados.length > 3 ? nota(`e mais ${ordenados.length - 3} em Abrir o cliente`) : '');
  }
  // A consulta da ficha do cliente (GET, só leitura). Erro aparece como erro, não como lista vazia.
  async function carregarPlanejamentos(caixa) {
    if (caixa.dataset.vvCliCarregado) return;
    caixa.dataset.vvCliCarregado = '1';
    const id = caixa.dataset.vvCliPlj;
    if (!id || typeof pljPedir !== 'function') return;
    try {
      const d = await pljPedir(`cliente_id=${encodeURIComponent(id)}`);
      if (!caixa.isConnected) return;
      caixa.innerHTML = d?.disponivel ? planejamentosHtml(lista(d.planejamentos)) : nota('Os planejamentos ainda não foram ligados no banco.');
    } catch (erro) {
      if (caixa.isConnected) caixa.innerHTML = nota(`Não foi possível buscar os planejamentos: ${erro?.message || 'o painel não respondeu'}`, 'erro');
    }
  }

  function alternarDia(bloco, botao) {
    const iso = botao.dataset.vvCliDia, aberto = botao.getAttribute('aria-pressed') === 'true';
    bloco.querySelectorAll('[data-vv-cli-dia]').forEach((b) => b.setAttribute('aria-pressed', String(!aberto && b === botao)));
    bloco.querySelectorAll('[data-vv-cli-lista]').forEach((l) => { l.hidden = aberto || l.dataset.vvCliLista !== iso; });
    const dica = bloco.querySelector('[data-vv-cli-dica]');
    if (dica) dica.hidden = !aberto;
  }

  const ligados = new WeakSet();
  const depoisDe = new WeakMap();
  // Depois de desativar/apagar: quem chamou decide (ligar(raiz, { depois })); sem isso, recarrega o
  // cadastro (o cliente sai da cidade) e fecha a placa pelo próprio botão de fechar.
  async function depoisDoCiclo(raiz) {
    const proprio = depoisDe.get(raiz);
    if (typeof proprio === 'function') return proprio();
    if (typeof ensureClientMasterSources === 'function') { try { await ensureClientMasterSources(true); } catch { /* a placa fecha mesmo assim */ } }
    raiz.querySelector?.('[data-fechar]')?.click();
  }
  function aoClicar(e, raiz) {
    const alvo = e.target?.closest?.('[data-vv-cli-peca],[data-vv-cli-dia],[data-vv-cli-plj-abrir],[data-vv-cli-relatorio],[data-vv-cli-desativar],[data-vv-cli-apagar]');
    if (!alvo || (raiz.contains && !raiz.contains(alvo)) || alvo.disabled) return;
    const bloco = alvo.closest('.vv-cli');
    if (!bloco) return;
    if (alvo.dataset.vvCliPeca) { chamar('openItemWorkspace', String(alvo.dataset.vvCliPeca)); return; }
    if (alvo.dataset.vvCliDia) { alternarDia(bloco, alvo); return; }
    if (alvo.dataset.vvCliPljAbrir) { chamar('abrirPlanejamento', String(alvo.dataset.vvCliPljAbrir)); return; }
    if (alvo.dataset.vvCliRelatorio) { G.VybeRelatorio?.abrir?.(bloco.dataset.vvCliCliente, alvo.dataset.vvCliRelatorio); return; }
    // O servidor confere de novo; aqui só não abre a janela para quem não administra.
    const id = bloco.dataset.vvCliId, nome = bloco.dataset.vvCliCliente;
    if (!souAdminAqui() || !id || !nome) return;
    const fim = { depois: () => depoisDoCiclo(raiz) };
    if (alvo.hasAttribute('data-vv-cli-desativar')) chamar('abrirDesativarNoCiclo', 'cliente', id, nome, fim);
    else if (alvo.hasAttribute('data-vv-cli-apagar')) chamar('abrirApagarNoCiclo', 'cliente', id, nome, fim);
  }
  // Pode ser chamado a cada vez que a placa é redesenhada: o clique é ligado uma vez por raiz e os
  // planejamentos são buscados para os blocos novos.
  function ligar(raiz, { depois } = {}) {
    if (!raiz?.querySelectorAll) return Promise.resolve();
    if (typeof depois === 'function') depoisDe.set(raiz, depois); else depoisDe.delete(raiz);
    if (!ligados.has(raiz)) { ligados.add(raiz); raiz.addEventListener('click', (e) => aoClicar(e, raiz)); }
    return Promise.all([...raiz.querySelectorAll('[data-vv-cli-plj]')].map(carregarPlanejamentos));
  }

  G.VybeClientePlaca = Object.freeze({ html, ligar, fontes, ESPERA_DO_CLIENTE, META_SEMANA });
})();
