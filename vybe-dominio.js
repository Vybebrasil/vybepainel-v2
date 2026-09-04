// vybe-dominio.js — leitura vinda das tabelas próprias, em vez do espelho do Monday.
//
// O /api/operational-mirror devolve 3,16 MB: a resposta do Monday inteira, com os
// column_values crus e os updates de cada item. O /api/conteudos devolve 604 KB
// já recortados, com os catálogos de status e pessoas viajando uma vez em vez de
// repetidos por item.
//
// A conversão abaixo devolve os itens ao formato do Monday e entrega ao
// processItemsAll que já existe. Reimplementar a derivação de semana, dia,
// atraso e formato de data criaria duas verdades que divergiriam com o tempo;
// assim a regra continua num lugar só.

const CONTEUDOS_API = '/api/conteudos';
const VYBE_EMERGENCY_SOURCE_KEY = 'vybe_emergency_source_v1';
const VYBE_EMERGENCY_WRITE_KEY = 'vybe_emergency_write_v1';
let CATALOGO_CAPTACAO = [];
let CATALOGO_OPCOES = [];
// A LISTA DE STATUS DAS SOLICITACOES, COMO ELA E.
//
// Ela ja vinha do servidor em toda leitura de Demandas e era jogada fora. Sem
// ela, a tela so conhecia os status que alguma solicitacao estava usando naquele
// momento, mais uma lista escrita a mao no codigo. Duas consequencias: um status
// existente mas vazio ficava invisivel — nao dava para ver nem para tirar — e um
// nome da lista escrita a mao era oferecido mesmo quando o quadro nao o tinha.
let CATALOGO_STATUS_DEMANDAS = [];
let DOMINIO_ULTIMA_RESPOSTA = null;

// O banco da Vybe é a autoridade de leitura. O espelho do Monday permanece
// disponível somente como contingência administrativa explícita durante o corte.
// Uma preferência antiga do navegador nunca pode devolver autoridade ao Monday.
// Emergência documentada (somente administradores):
//   localStorage.setItem('vybe_emergency_source_v1','espelho')
// Para voltar ao modo normal:
//   localStorage.removeItem('vybe_emergency_source_v1')
function fonteDeLeitura() {
  try { return localStorage.getItem(VYBE_EMERGENCY_SOURCE_KEY) === 'espelho' ? 'espelho' : 'dominio'; }
  catch { return 'dominio'; }
}
function espelhoSomenteObservador() { return fonteDeLeitura() === 'dominio'; }

// Leitura incompleta nao pode passar por leitura boa: sem o catalogo de status
// as pecas aparecem sem a cor da etiqueta, e quem olha conclui que o dado e
// esse. O aviso sai uma vez por tipo de falha — repetir a cada releitura viraria
// barulho que se aprende a ignorar.
const FALHAS_JA_AVISADAS = new Set();
function avisarSeVeioIncompleto(dados) {
  const faltou = Array.isArray(dados?.degradado) ? dados.degradado : [];
  if (!faltou.length || typeof showToast !== 'function') return;
  const chave = faltou.slice().sort().join(',');
  if (FALHAS_JA_AVISADAS.has(chave)) return;
  FALHAS_JA_AVISADAS.add(chave);
  const nomes = { status: 'status', captacao: 'captação', opcoes: 'formatos e etiquetas' };
  showToast(`As peças carregaram, mas ${faltou.map((f) => nomes[f] || f).join(' e ')} não. `
    + 'As cores e os nomes desses campos podem aparecer em branco até isso se resolver.', 'info', 10000);
}

async function buscarDominio() {
  const resposta = await fetch(CONTEUDOS_API, { credentials: 'same-origin', cache: 'no-store' });
  if (!resposta.ok) throw new Error(`Domínio indisponível (${resposta.status})`);
  const dados = await resposta.json();
  if (!dados?.itens) throw new Error('Resposta do domínio sem itens.');
  avisarSeVeioIncompleto(dados);
  DOMINIO_ULTIMA_RESPOSTA = dados;
  return dados;
}

// Devolve os itens ao formato que o processItemsAll espera.
function dominioComoItensDoMonday(dados) {
  const status = new Map((dados.status || []).map((s) => [s.chave, s]));
  const pessoas = new Map((dados.pessoas || []).map((p) => [String(p.id), p.nome]));
  aplicarFotosDoBanco(dados.pessoas);
  const captacao = new Map((dados.captacao || []).map((c) => [c.chave, c.rotulo]));
  // Tipo de conteúdo, OFF/áudio e prioridade existiam no banco e paravam aqui:
  // a ponte emitia sete colunas e essas três não estavam entre elas, então
  // nenhuma tela tinha como mostrar.
  const porColuna = (colunaId) => new Map((dados.opcoes || [])
    .filter((o) => o.coluna_id === colunaId).map((o) => [o.chave, o]));
  const catTipo = porColuna('lista_suspensa__1');
  const catOff = porColuna('color_mkynd7j8');
  const catPrio = porColuna('color_mm164yv8');
  // O catálogo era lido e jogado fora. A tabela por grupo precisa dele para
  // oferecer as opções de captação sem uma segunda ida ao servidor.
  CATALOGO_OPCOES = dados.opcoes || [];
  CATALOGO_CAPTACAO = (dados.captacao || []).map((c) => ({
    chave: c.chave, rotulo: c.rotulo, cor: c.cor || '', borda: c.borda || '', ativa: c.ativa !== false,
  }));
  const C = COLUNAS.producao;

  return (dados.itens || []).map((item) => {
    const st = status.get(item.status_chave) || {};
    const clientes = item.clientes && item.clientes.length ? item.clientes : [item.cliente].filter(Boolean);
    const ids = item.responsavel_ids || [];

    return {
      id: item.id,
      name: item.nome || '',
      updated_at: item.updated_at || '',
      group: { id: item.grupo_id || '', title: item.grupo || '' },
      updates: item.contexto_status ? [item.contexto_status] : [],
      column_values: [
        { id: C.cliente, text: clientes.join(', '), value: null },
        { id: C.formato, text: item.formato || '', value: null },
        {
          id: C.status,
          text: st.rotulo || '',
          index: st.indice ?? null,
          label_style: { color: st.cor || '', border: st.borda || '' },
          updated_at: item.status_updated_at || '',
          value: null,
        },
        { id: C.captacao, text: captacao.get(item.captacao_chave) || '', value: null },
        { id: C.etapa, text: item.tipo_conteudo
            || (item.tipo_conteudo_chaves || []).map((k) => catTipo.get(k)?.rotulo).filter(Boolean).join(', '),
          value: null },
        { id: 'color_mkynd7j8', text: catOff.get(item.off_audio_chave)?.rotulo || '',
          label_style: { color: catOff.get(item.off_audio_chave)?.cor || '',
                         border: catOff.get(item.off_audio_chave)?.borda || '' }, value: null },
        { id: 'color_mm164yv8', text: catPrio.get(item.prioridade_chave)?.rotulo || '',
          label_style: { color: catPrio.get(item.prioridade_chave)?.cor || '',
                         border: catPrio.get(item.prioridade_chave)?.borda || '' }, value: null },
        { id: C.prazo, text: item.prazo_iso || '', value: null },
        { id: C.veiculacao, text: item.veiculacao_iso || '', value: null },
        {
          id: C.responsavel,
          // O processItems monta o campo 'responsavel' a partir do TEXTO desta
          // coluna, não do value. Mandar vazio apagaria o nome de quem responde
          // pela peça na tela inteira.
          text: ids.map((i) => pessoas.get(String(i))).filter(Boolean).join(', '),
          value: ids.length
            ? JSON.stringify({ personsAndTeams: ids.map((id) => ({ id: Number(id), kind: 'person' })) })
            : null,
        },
      ],
    };
  });
}

// Mesmo contrato do applyMirrorSnapshot: monta DADOS e entrega ao painel.
async function puxarDominio() {
  const dados = await buscarDominio();
  const brutos = dominioComoItensDoMonday(dados);
  const meta = calcWeeks();
  const todos = processItemsAll(brutos, meta);
  if (!todos.length) return false;

  const opcoes = (dados.status || []).map((s) => ({
    index: s.indice, label: s.rotulo, color: s.cor, border: s.borda,
  }));
  applyCachedProductionDataset(todos, opcoes);
  saveProductionCache();
  cacheSyncLabel(`Banco próprio · ${todos.length} conteúdos · ${dados.total} no recorte`);
  setSyncHealth('healthy', `Lendo do banco da Vybe às ${new Date().toLocaleTimeString('pt-BR')}`);
  return true;
}

// Compara as duas fontes item a item, sem alterar a tela. É o que decide se dá
// para trocar: enquanto houver divergência, o espelho continua mandando.
async function compararFontes() {
  const [espelho, dominio] = await Promise.all([mirrorRequest(), buscarDominio()]);
  const meta = calcWeeks();
  const a = processItemsAll(Array.isArray(espelho?.items) ? espelho.items : [], meta);
  const b = processItemsAll(dominioComoItensDoMonday(dominio), meta);

  const chave = (d) => [d.cliente, d.nome, d.status, d.formato, d.prazo_iso, d.veiculacao_iso,
                        (d.responsavel_ids || []).join('+'), d.semana, d.grupo].join('~');
  const mapaA = new Map(a.map((d) => [String(d.id), d]));
  const mapaB = new Map(b.map((d) => [String(d.id), d]));

  const soEspelho = [...mapaA.keys()].filter((id) => !mapaB.has(id));
  const soDominio = [...mapaB.keys()].filter((id) => !mapaA.has(id));
  const divergentes = [];
  for (const [id, d] of mapaA) {
    const o = mapaB.get(id);
    if (o && chave(d) !== chave(o)) {
      const campos = ['cliente','nome','status','formato','prazo_iso','veiculacao_iso','semana','grupo']
        .filter((c) => String(d[c] ?? '') !== String(o[c] ?? ''));
      divergentes.push({ id, campos, espelho: campos.map((c) => d[c]), dominio: campos.map((c) => o[c]) });
    }
  }
  return {
    espelho: a.length, dominio: b.length,
    so_no_espelho: soEspelho.length, so_no_dominio: soDominio.length,
    divergentes: divergentes.length,
    exemplos: divergentes.slice(0, 5),
    identico: !soEspelho.length && !soDominio.length && !divergentes.length,
  };
}

// ── escrita ───────────────────────────────────────────────────────────────────
// Grava pelo /api/conteudo, que escreve no banco e replica no Monday. Só vale
// para o board de Produção: itens do board de Demandas não estão no domínio e
// continuam pelo caminho antigo.
//
// A gravação própria é obrigatória. A contingência de escrita direta no Monday
// só pode ser ativada conscientemente por um administrador durante incidente:
//   localStorage.setItem('vybe_emergency_write_v1','monday')
// Para voltar ao modo normal:
//   localStorage.removeItem('vybe_emergency_write_v1')
function escritaDupla() {
  try { return localStorage.getItem(VYBE_EMERGENCY_WRITE_KEY) !== 'monday'; }
  catch { return true; }
}

// Mesma regra do servidor, para o rótulo virar chave.
function chaveDeStatus(rotulo) {
  return String(rotulo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function gravarNoDominio(corpo) {
  const resposta = await fetch('/api/conteudo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.error || `Falha ao gravar (${resposta.status})`);
  return dados;
}

// true quando a escrita dupla atendeu; false quando o chamador deve seguir pelo
// caminho antigo. Com _devolve, entrega a resposta inteira: quem cria precisa do
// id que o Monday acabou de dar.
async function tentarEscritaDupla(item, corpo) {
  if (!escritaDupla()) return false;
  // Item de Demandas costumava cair fora daqui porque aquele board não existia no
  // nosso banco. Existe agora, com as mesmas tabelas — e o servidor sabe qual
  // coluna usar em cada um.
  const devolve = corpo?._devolve;
  if (devolve) { corpo = { ...corpo }; delete corpo._devolve; }
  try {
    const r = await gravarNoDominio(corpo);
    if (String(r.replica_monday || '').startsWith('pendente')) {
      console.warn('Gravado no banco; réplica do Monday entrou na fila:', r.replica_monday);
      showToast('✓ Salvo no Vybe · cópia de contingência enfileirada', 'info', 6000);
    }
    // O servidor deixou de RECUSAR combinações estranhas de data e passou a
    // devolver um aviso. Ele aparece aqui, num lugar só — quem grava não
    // precisa saber que existe.
    if (r?.aviso) showToast(`Salvo · atenção: ${r.aviso}`, 'info', 8000);
    return devolve ? r : true;
  } catch (erro) {
    console.error('Escrita no banco Vybe falhou; o Monday não receberá uma gravação paralela.', erro);
    showToast(`Não foi possível salvar no banco Vybe: ${erro.message}`, 'error', 7000);
    throw erro;
  }
}

// ── demandas ──────────────────────────────────────────────────────────────────
//
// Mesma ideia da produção: converte a resposta do banco de volta ao formato do
// Monday e entrega ao processDemandas que já existe. Reimplementar a derivação
// criaria duas verdades sobre os mesmos números.

async function buscarDemandas() {
  const resposta = await fetch(`${CONTEUDOS_API}?board=demandas`, { credentials: 'same-origin' });
  if (!resposta.ok) throw new Error(`Demandas indisponíveis (${resposta.status})`);
  const dados = await resposta.json();
  if (!dados?.itens) throw new Error('Resposta de demandas sem itens.');
  return dados;
}

function demandasComoItensDoMonday(dados) {
  const status = new Map((dados.status || []).map((s) => [s.chave, s]));
  CATALOGO_STATUS_DEMANDAS = (dados.status || []).map((s) => ({
    chave: s.chave, rotulo: s.rotulo, indice: s.indice ?? null,
    cor: s.cor || '', borda: s.borda || s.cor || '',
  }));
  const pessoas = new Map((dados.pessoas || []).map((p) => [String(p.id), p.nome]));
  const prioridades = new Map((dados.opcoes || [])
    .filter((o) => o.coluna_id === 'color_mkwtgakv').map((o) => [o.chave, o]));
  const C = COLUNAS.demandas;

  return (dados.itens || []).map((item) => {
    const st = status.get(item.status_chave) || {};
    const pr = prioridades.get(item.prioridade_chave) || {};
    const clientes = item.clientes && item.clientes.length ? item.clientes : [item.cliente].filter(Boolean);
    const ids = item.responsavel_ids || [];

    return {
      id: item.id,
      name: item.nome || '',
      updated_at: item.updated_at || '',
      group: { id: item.grupo_id || '', title: item.grupo || '' },
      updates: [],
      // Andamento das tarefas: viaja fora das colunas porque não é coluna do
      // Monday — é contagem nossa, para a fila mostrar 3/12 sem abrir a peça.
      tarefas: item.tarefas || 0,
      tarefas_feitas: item.tarefas_feitas || 0,
      column_values: [
        { id: C.cliente, text: clientes.join(', '), value: null },
        { id: C.formato, text: item.formato || '', value: null },
        { id: C.prioridade, text: pr.rotulo || '',
          label_style: { color: pr.cor || '', border: pr.borda || '' }, value: null },
        { id: C.prazo, text: item.prazo_iso || '', value: null },
        { id: C.veiculacao, text: item.veiculacao_iso || '', value: null },
        { id: C.status, text: st.rotulo || '', index: st.indice ?? null,
          label_style: { color: st.cor || '', border: st.borda || '' },
          updated_at: item.status_updated_at || '', value: null },
        { id: C.responsavel,
          text: ids.map((i) => pessoas.get(String(i))).filter(Boolean).join(', '),
          value: ids.length
            ? JSON.stringify({ personsAndTeams: ids.map((id) => ({ id: Number(id), kind: 'person' })) })
            : null },
      ],
    };
  });
}

// As fotos do time estavam escritas no código, apontando para files.monday.com —
// no dia em que o Monday sair, todo avatar quebra. Quem já trocou a própria foto
// passa a ser servido pelo Drive da Vybe; quem não trocou continua com a antiga
// até trocar.
function aplicarFotosDoBanco(pessoas) {
  if (!Array.isArray(pessoas) || typeof TEAM_USERS === 'undefined') return;
  const porId = new Map(pessoas.filter((p) => p.foto_url).map((p) => [String(p.id), p.foto_url]));
  if (!porId.size) return;
  TEAM_USERS.forEach((u) => { const nova = porId.get(String(u.id)); if (nova) u.photo = nova; });
}
