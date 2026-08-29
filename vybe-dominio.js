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

// Fonte de leitura. Agora o padrão é o banco da Vybe; o espelho do Monday fica
// como caminho de volta, e a queda para ele é automática se o banco falhar.
//
// A troca só veio depois de rodar o processItemsAll do painel sobre as duas
// fontes e comparar os 23 campos do objeto final, item a item: as diferenças que
// sobraram são formato de carimbo de hora, e em dois casos o banco entrega mais
// do que o espelho — ele resolve o índice de status que o espelho perdeu e não
// trunca o histórico em 3 updates.
//
// Para voltar sem deploy, no console:
//   localStorage.setItem('vybe_fonte','espelho')  → volta a ler do Monday
//   localStorage.removeItem('vybe_fonte')         → volta ao banco da Vybe
function fonteDeLeitura() {
  try { return localStorage.getItem('vybe_fonte') || 'dominio'; } catch { return 'dominio'; }
}

async function buscarDominio() {
  const resposta = await fetch(CONTEUDOS_API, { credentials: 'same-origin' });
  if (!resposta.ok) throw new Error(`Domínio indisponível (${resposta.status})`);
  const dados = await resposta.json();
  if (!dados?.itens) throw new Error('Resposta do domínio sem itens.');
  return dados;
}

// Devolve os itens ao formato que o processItemsAll espera.
function dominioComoItensDoMonday(dados) {
  const status = new Map((dados.status || []).map((s) => [s.chave, s]));
  const pessoas = new Map((dados.pessoas || []).map((p) => [String(p.id), p.nome]));
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
        { id: C.captacao, text: item.captacao || '', value: null },
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
// Desligar sem deploy, no console:
//   localStorage.setItem('vybe_escrita','monday')  → volta a gravar só no Monday
//   localStorage.removeItem('vybe_escrita')        → volta à escrita dupla
function escritaDupla() {
  try { return localStorage.getItem('vybe_escrita') !== 'monday'; } catch { return true; }
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
  if (typeof isRequestItem === 'function' && isRequestItem(item)) return false;
  const devolve = corpo?._devolve;
  if (devolve) { corpo = { ...corpo }; delete corpo._devolve; }
  try {
    const r = await gravarNoDominio(corpo);
    if (String(r.replica_monday || '').startsWith('falhou')) {
      console.warn('Gravado no banco, mas o Monday não recebeu:', r.replica_monday);
      showToast('✓ Salvo no Vybe · réplica no Monday falhou, será reconciliada', 'info', 6000);
    }
    return devolve ? r : true;
  } catch (erro) {
    console.warn('Escrita dupla falhou; usando o caminho antigo.', erro);
    return false;
  }
}
