// vybe-arquivos.js — os arquivos de uma peça: ler, mostrar, enviar e remover.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes.
//
// Um assunto só, que estava em duas pontas do arquivo antigo separadas por 850
// linhas: de um lado a leitura e a miniatura de cada anexo; do outro o envio,
// que tem dois caminhos — o pequeno passa pela nossa função, o grande vai direto
// ao Drive em pedaços, porque o teto de 3 MB nunca foi do Drive e sim do tamanho
// que a função aceita por chamada.
//
// Carrega DEPOIS de vybe-risco.js: chama fetchWorkspaceItem,
// renderWorkspaceDrawer e findOperationalItem, declarados lá.

function workspaceFileColumnAssetIds(detail) {
  const column = (detail?.column_values || []).find(entry => String(entry?.id || '') === COLUNAS.producao.arquivos);
  if (!column?.value) return new Set();
  try {
    const value = typeof column.value === 'string' ? JSON.parse(column.value) : column.value;
    return new Set((value?.files || []).map(file => String(file?.assetId || file?.asset_id || file?.id || '')).filter(Boolean));
  } catch (error) { return new Set(); }
}
function workspaceAssetsForDetail(detail) {
  const columnAssetIds = workspaceFileColumnAssetIds(detail);
  const columnAssetCount = columnAssetIds.size;
  const collected = [
    // 'no_drive' guarda a resposta do servidor ANTES de a linha abaixo misturar
    // nela os arquivos da coluna do Monday. Sem essa separacao nao havia como
    // saber se a restricao de apagar um por vez se aplica ao arquivo.
    ...(detail?.assets || []).map(asset => ({ ...asset, source: asset.onde === 'drive' ? 'Drive da Vybe' : 'Arquivo legado', no_drive: Boolean(asset.removable || asset.onde === 'drive'), removable: Boolean(asset.removable || columnAssetIds.has(String(asset?.id || ''))), column_asset_count: columnAssetCount })),
    ...(detail?.updates || []).flatMap(update => (update?.assets || []).map(asset => ({ ...asset, source: 'Arquivo do histórico', removable: false, column_asset_count: columnAssetCount })))
  ];
  const used = new Set();
  return collected.filter(asset => {
    const key = String(asset?.id || `${asset?.name || ''}:${asset?.url || ''}`);
    if (!key || used.has(key)) return false;
    used.add(key);
    return true;
  });
}
function workspaceAssetPreviewFailed(image) {
  const fallback = String(image?.dataset?.fallbackSrc || '');
  if (fallback && image.dataset.fallbackTried !== 'true') {
    image.dataset.fallbackTried = 'true';
    image.src = fallback;
    return;
  }
  image.closest('.workspace-asset-preview')?.classList.add('preview-failed');
}
function workspaceAssetPreview(asset) {
  const href = asset.public_url || asset.url || '';
  const thumbnail = asset.url_thumbnail || '';
  const isImage = Boolean(thumbnail || /\.(png|jpe?g|webp|gif|avif|mp4|mov|webm)(?:$|[?#])/i.test(String(asset.name || href)));
  if (!isImage) return `<div class="workspace-asset-preview workspace-asset-file">${safeText((asset.file_extension || 'ARQ').toUpperCase())}</div>`;
  const src = thumbnail || href;
  if (!src) return `<div class="workspace-asset-preview workspace-asset-file">IMG</div>`;
  const fallback = thumbnail && href && thumbnail !== href ? ` data-fallback-src="${safeText(href)}"` : '';
  return `<div class="workspace-asset-preview"><img src="${safeText(src)}"${fallback} alt="Prévia de ${safeText(asset.name)}" loading="eager" onerror="workspaceAssetPreviewFailed(this)"><div class="workspace-asset-preview-fallback"><b>Prévia indisponível</b><small>Abra o material para conferir o arquivo.</small></div></div>`;
}
function workspaceAssetCard(asset) {
  const href = asset.public_url || asset.url || '#';
  // Arquivo no Drive apaga um por um. A trava de "todos de uma vez" era do
  // Monday, que so deixa limpar a coluna inteira — e ela sobrou aplicada a tudo:
  // dependia de column_asset_count, contado a partir da coluna do Monday, que
  // hoje vem vazia. A conta dava 0, nunca 1, e o botao nao aparecia para
  // arquivo nenhum. Era por isso que nao dava para excluir.
  const removal = !asset.removable
    ? `<span class="workspace-asset-locked">${safeText(asset.source || 'ARQUIVO')}</span>`
    : (asset.no_drive || asset.column_asset_count === 1)
      ? `<button type="button" class="workspace-asset-remove"
          onclick="event.preventDefault();event.stopPropagation();requestWorkspaceFileRemoval('${safeText(asset.id)}')">Remover</button>`
      : `<span class="workspace-asset-locked" title="Este arquivo ainda mora na coluna do Monday, que só permite limpar todos de uma vez.">Arquivo de coluna</span>`;
  const isImage = Boolean(asset.url_thumbnail || /\\.(png|jpe?g|webp|gif|avif|mp4|mov|webm)(?:$|[?#])/i.test(String(asset.name || href)));
    const openAction = isImage 
      ? `<a class="workspace-asset-open" href="${safeText(href)}" onclick="event.preventDefault(); event.stopPropagation(); openVybeLightbox('${safeText(href)}', '${safeText(asset.name)}')">ABRIR ↗</a>` 
      : `<a class="workspace-asset-open" href="${safeText(href)}" target="_blank" rel="noopener">ABRIR ↗</a>`;
    const clickPreview = isImage ? `onclick="openVybeLightbox('${safeText(href)}', '${safeText(asset.name)}')"` : "";
    return `<article class="workspace-asset" ${clickPreview} style="${isImage ? 'cursor:pointer;' : ''}">${workspaceAssetPreview(asset)}<div class="workspace-asset-name" title="${safeText(asset.name)}">${safeText(asset.name)}</div><small>${safeText(workspaceBytes(asset.file_size))} · ${safeText(asset.source || 'Arquivo')}</small><div class="workspace-asset-actions">${openAction}${removal}</div></article>`;
}
// Remover arquivo estava recusando SOLICITACAO.
//
// A peca era procurada so em DADOS e DADOS_ALL — as duas listas de Producao.
// Solicitacao vive em DADOS_DEMANDAS, entao a busca voltava vazia e a funcao
// caia no aviso "Migracao deste arquivo ainda nao foi concluida", que nao tem
// nada a ver: da frente, um botao que nao apaga e uma explicacao errada. Este
// painel ja tem uma funcao que procura nas tres listas — findOperationalItem —
// e era so usa-la, como o resto da tela faz.
//
// De quebra, a recusa passou a dizer O QUE esta faltando, em vez de repetir a
// mesma frase para tres motivos diferentes.
async function requestWorkspaceFileRemoval(assetId) {
  const asset = activeWorkspaceAssets.find((entry) => String(entry?.id || '') === String(assetId));
  const item = (typeof findOperationalItem === 'function' ? findOperationalItem(activeWorkspaceItemId) : null)
    || (DADOS || []).find((entry) => String(entry.id) === String(activeWorkspaceItemId))
    || (typeof DADOS_ALL !== 'undefined' ? (DADOS_ALL || []).find((entry) => String(entry.id) === String(activeWorkspaceItemId)) : null);
  if (!asset) return showToast('Arquivo não encontrado nesta atividade — recarregue a página.', 'err', 6000);
  if (!item) return showToast('Atividade não encontrada — recarregue a página e tente de novo.', 'err', 6000);
  if (!asset.removable || !asset.local_id) {
    return showToast('Este arquivo veio do Monday e ainda não foi copiado para o Drive da Vybe; '
      + 'por isso não pode ser removido daqui.', 'info', 8000);
  }
  // A arte aparece DENTRO da pergunta. Antes o clique no Remover subia para o
  // cartao e abria a arte em tela cheia; so depois de fechar e que vinha a
  // pergunta — a conferencia acontecia longe da decisao. Agora e uma coisa so:
  // ve o que vai apagar e decide ali.
  const previa = asset.url_thumbnail || asset.public_url || asset.url || '';
  const confirmado = typeof perguntarNoPainel === 'function'
    ? await perguntarNoPainel({
        titulo: 'Remover este arquivo?',
        imagem: previa ? { url: previa, nome: asset.name } : null,
        texto: 'Ele sai desta atividade e vai para a lixeira do Drive da Vybe. A remoção fica registrada no histórico, e um administrador consegue recuperar.',
        confirmar: 'Mover para a lixeira', perigo: true })
    : window.confirm(`Mover o arquivo "${asset.name}" para a lixeira do Drive da Vybe?`);
  if (!confirmado) return;
  try {
    const resposta = await fetch('/api/painel?area=peca', {
      method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'same-origin',
      body:JSON.stringify({ item:item.id, arquivo_id:asset.local_id }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados?.error || `Falha ao remover (${resposta.status})`);
    showToast('✓ Arquivo movido para a lixeira do Drive', 'ok');
    renderWorkspaceDrawer(await fetchWorkspaceItem(item.id), item);
  } catch (error) { showToast(`Não foi possível remover o arquivo: ${error.message}`, 'err', 8000); }
}

function handleWorkspaceDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  const input = document.getElementById('workspace-file-input');
  if (!input || !event.dataTransfer?.files?.[0]) return;
  const transfer = new DataTransfer(); transfer.items.add(event.dataTransfer.files[0]); input.files = transfer.files;
  uploadWorkspaceFile(input);
}
// Enviar arquivo de uma peça, num lugar só.
//
// A gaveta lateral já fazia isso; a coluna ARQUIVO da mesa individual precisa do
// mesmo envio. Duas implementações da mesma gravação viram duas verdades — uma
// aceitando tamanho que a outra recusa, uma criando pasta no Drive que a outra
// não cria.
//
// Devolve a resposta do servidor porque quem chama da mesa precisa do id do
// arquivo no Drive para desenhar a miniatura sem ir buscar de novo.
const ARQUIVO_TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
// Ate aqui o arquivo cabe dentro de uma chamada nossa; acima disso ele vai
// direto para o Drive. O teto de 3 MB nunca foi do Drive — era o tamanho maximo
// que a nossa funcao aceita por chamada, e o base64 engorda o arquivo em um
// terco no caminho. O destino sempre aceitou muito mais.
const ARQUIVO_PELO_SERVIDOR = 3 * 1024 * 1024;
const ARQUIVO_LIMITE = 200 * 1024 * 1024;

async function enviarArquivoDaPeca(itemId, file, aoAndar) {
  if (!itemId || !file) throw new Error('Informe a peça e o arquivo.');
  if (!ARQUIVO_TIPOS.includes(file.type)) throw new Error('Envie PNG, JPG, WEBP ou PDF.');
  if (file.size > ARQUIVO_LIMITE) {
    throw new Error('Arquivo acima de 200 MB. Suba no Drive e registre o link aqui.');
  }
  const corpo = { item: String(itemId), nome: file.name, mime: file.type };

  if (file.size > ARQUIVO_PELO_SERVIDOR) return enviarArquivoGrande(corpo, file, aoAndar);

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await fetch('/api/painel?area=peca', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, conteudo: base64 }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) throw new Error(explicarFalhaDeArquivo(json, res.status, file));
  return json;
}

// Erro de upload que chega como "HTTP 500" ou como a frase crua do Google nao
// diz a quem esta na frente da tela o que fazer. Estas sao as falhas que
// aparecem de verdade, traduzidas para a acao correspondente. O texto original
// vai inteiro para o console: e ele que precisa chegar a quem for consertar.
function explicarFalhaDeArquivo(json, status, file) {
  const cru = String(json?.error || json?.errors?.[0]?.message || `HTTP ${status}`);
  console.error('Falha ao anexar arquivo', { status, resposta: json, arquivo: file && {
    nome: file.name, tipo: file.type, bytes: file.size } });
  const tem = (...termos) => termos.some((t) => cru.toLowerCase().includes(t));
  if (tem('quota', 'storage limit', 'storagequotaexceeded')) {
    return 'O Drive da Vybe está sem espaço para receber arquivo novo. '
      + `Avise quem administra — nada do que já subiu se perdeu. (${cru})`;
  }
  if (tem('permission', 'forbidden', 'insufficient', '403')) {
    return `O Vybe não tem permissão de escrita nessa pasta do Drive. (${cru})`;
  }
  if (tem('não configurada', 'nao configurada', 'service_account', 'drive_pasta_raiz')) {
    return `A ligação com o Drive está sem configuração no servidor. (${cru})`;
  }
  if (tem('não encontrado', 'nao encontrado', '404')) {
    return `Esta peça não existe no banco — recarregue a página e tente de novo. (${cru})`;
  }
  if (status === 413 || tem('payload', 'too large', 'request entity')) {
    return 'O arquivo é grande demais para esta via. Tente de novo — acima de 3 MB '
      + `ele deveria ir direto ao Drive. (${cru})`;
  }
  return cru;
}

// Arquivo grande vai em pedacos, todos pela nossa API.
//
// A primeira tentativa mandava os bytes do navegador direto para o Google, o que
// seria o caminho mais curto. Nao funciona: a sessao e aberta pelo servidor, sem
// cabecalho de origem, e o Google recusa um envio que venha de outra origem —
// "Failed to fetch", sem explicacao nenhuma na tela.
//
// Entao os bytes voltam a passar por nos, fatiados. Cada pedaco cabe folgado no
// limite da funcao e o arquivo inteiro deixa de ter teto. O preco e uma ida por
// pedaco; por isso a barra de progresso, para a espera ter rosto.
const PEDACO_DO_ENVIO = 2 * 1024 * 1024; // multiplo de 256 KB, como o Drive exige

async function enviarArquivoGrande(corpo, file, aoAndar) {
  const abertura = await fetch('/api/painel?area=peca', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, etapa: 'abrir' }),
  });
  const dadosDaAbertura = await abertura.json().catch(() => ({}));
  if (!abertura.ok || !dadosDaAbertura?.sessao) {
    // Mesma traducao do envio pequeno: falha do Drive tem de dizer o que fazer.
    throw new Error(explicarFalhaDeArquivo(dadosDaAbertura, abertura.status, file));
  }

  const total = file.size;
  let enviado = 0;
  let arquivo = null;
  while (enviado < total) {
    const pedaco = file.slice(enviado, Math.min(enviado + PEDACO_DO_ENVIO, total));
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(pedaco);
    });
    const parte = await fetch('/api/painel?area=peca', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...corpo, etapa: 'parte', sessao: dadosDaAbertura.sessao,
                             inicio: enviado, total, conteudo: base64 }),
    });
    const d = await parte.json().catch(() => ({}));
    if (!parte.ok) throw new Error(d?.error || `Envio interrompido em ${Math.round(enviado / 1048576)} MB.`);
    enviado = d.concluido ? total : (Number(d.recebido) || enviado + pedaco.size);
    if (typeof aoAndar === 'function') aoAndar(Math.min(100, Math.round((enviado / total) * 100)));
    if (d.concluido) { arquivo = d; break; }
  }
  if (!arquivo?.id) throw new Error('O Drive não confirmou o arquivo no fim do envio.');

  const registro = await fetch('/api/painel?area=peca', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, etapa: 'registrar', drive_file_id: arquivo.id, bytes: total }),
  });
  const json = await registro.json().catch(() => ({}));
  if (!registro.ok) throw new Error(json?.error || `Arquivo no Drive, mas não registrado (${registro.status}).`);
  return json;
}

// VÁRIOS ARQUIVOS DE UMA VEZ.
//
// O campo aceitava um por vez, e um carrossel de dez paginas virava dez idas ao
// botao — sendo que a pessoa ja tinha as dez selecionadas na pasta.
//
// Vao um atras do outro, e nao todos juntos, de proposito: cada arquivo grande
// e fatiado em pedacos, e disparar dez em paralelo multiplicaria as idas ao
// servidor sem acelerar nada. Um que falha nao derruba os outros — o aviso do
// fim diz quantos foram e quais nao deram.
// Entregar deixou de exigir a gaveta aberta: as duas funcoes de entrega —
// arquivo e link — passam a receber de QUAL peca se trata, em vez de deduzir
// da gaveta. A gaveta continua chamando sem informar nada e continua valendo o
// que ela tem aberto; a linha da fila informa e nao precisa abrir nada.
async function uploadWorkspaceFile(input, itemId) {
  const alvo = String(itemId || activeWorkspaceItemId || '');
  const arquivos = [...(input?.files || [])];
  if (!arquivos.length || !alvo) return;
  const item = findOperationalItem(alvo);
  const total = arquivos.length;
  const foram = []; const falhas = [];
  try {
    for (let i = 0; i < total; i += 1) {
      const file = arquivos[i];
      const deQuantos = total > 1 ? ` (${i + 1} de ${total})` : '';
      const mega = (file.size / 1048576).toFixed(1).replace('.', ',');
      showToast(`Enviando ${file.name} (${mega} MB)${deQuantos}…`, 'info', 60000);
      try {
        // Arquivo de 40 MB leva vinte idas ao servidor. Sem contar em voz alta,
        // a tela parece travada e a pessoa fecha no meio.
        await enviarArquivoDaPeca(alvo, file, (pct) => {
          if (pct < 100) showToast(`Enviando ${file.name}${deQuantos} · ${pct}%`, 'info', 60000);
        });
        foram.push(file.name);
      } catch (erro) { falhas.push({ nome: file.name, motivo: erro.message }); }
    }
    if (foram.length) {
      showToast(foram.length === 1
        ? '✓ Arquivo anexado no Drive da Vybe'
        : `✓ ${foram.length} arquivos anexados no Drive da Vybe`, 'ok', 6000);
    }
    if (falhas.length) {
      // Uma caixa por falha viraria uma fila de caixas. Uma so, com a lista.
      await perguntarNoPainel({
        titulo: falhas.length === 1 ? 'Um arquivo não subiu' : `${falhas.length} arquivos não subiram`,
        texto: falhas.map((f) => `${f.nome}: ${f.motivo}`).join('\n'),
        confirmar: 'Entendi',
      });
    }
    // A gaveta so se redesenha se for a desta peca que esta aberta.
    if (item && String(activeWorkspaceItemId) === alvo && document.getElementById('workspace-drawer')) {
      renderWorkspaceDrawer(await fetchWorkspaceItem(alvo), item);
    } else if (foram.length && typeof renderOutboundItemPatch === 'function') {
      renderOutboundItemPatch('entrega pela linha');
    }
  } finally { if (input) input.value = ''; }
}
