// vybe-material.js — a arte da peça: ver em tamanho real, baixar, trocar, e o
// material bruto que a origina.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes. São dois blocos que estavam a trezentas
// linhas de distância um do outro no arquivo antigo, tratando do mesmo assunto —
// o que entra na peça e o que sai dela.
//
// Carrega DEPOIS de vybe-risco.js: as funções daqui leem DETALHE_DA_GAVETA e
// activeWorkspaceAssets e chamam workspaceDeliveryInfo, declarados lá.

let PREVIA_MATERIAL=[];
// Painel flutuante para conferir a arte em tamanho de verdade. Dentro do modal a
// imagem cabe em 38% da altura da tela, o que serve para reconhecer a peça mas
// não para conferir texto pequeno — e conferir é justamente o que se pede ali.
let PREVIA_GRANDE_INDICE = 0;
// De qual peca e a previa aberta. Vazio quando ela vem de um portao, onde a
// pergunta e "esta certo?" e nao "quero trocar isto".
let PREVIA_DA_PECA = '';
function trocarMaterialDaPrevia(event) {
  const id = PREVIA_DA_PECA;
  if (!id) return;
  fecharPreviaGrande();
  abrirEntregaRapida(id, event);
}

function abrirPreviaGrande(indice = 0) {
  if (!PREVIA_MATERIAL.length) return;
  PREVIA_GRANDE_INDICE = Math.max(0, Math.min(indice, PREVIA_MATERIAL.length - 1));
  let caixa = document.getElementById('previa-grande');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.id = 'previa-grande';
    caixa.className = 'previa-grande';
    caixa.innerHTML = `
      <div class="previa-grande-vidro">
        <div class="previa-grande-topo">
          <span id="previa-grande-nome"></span>
          <button type="button" id="previa-baixar" class="previa-grande-baixar"
            onclick="baixarDaPrevia(event)">↓ Baixar</button>
          <button type="button" id="previa-trocar" class="previa-grande-trocar"
            onclick="trocarMaterialDaPrevia(event)">⤓ Trocar material</button>
          <button class="x-fechar" type="button" onclick="fecharPreviaGrande()" aria-label="Fechar">✕</button>
        </div>
        <div class="previa-grande-palco">
          <button type="button" class="previa-grande-seta" onclick="passarPreviaGrande(-1)" aria-label="Anterior">❮</button>
          <div id="previa-grande-media" class="previa-grande-media"></div>
          <button type="button" class="previa-grande-seta" onclick="passarPreviaGrande(1)" aria-label="Próxima">❯</button>
        </div>
      </div>`;
    document.body.appendChild(caixa);
    // Clicar fora fecha; dentro, não — senão fecha ao tentar arrastar a imagem.
    caixa.addEventListener('click', (e) => { if (e.target === caixa) fecharPreviaGrande(); });
    document.addEventListener('keydown', teclaPreviaGrande);
  }
  caixa.style.display = 'flex';
  pintarPreviaGrande();
}

function eVideoDoMaterial(a) {
  const onde = a?.name || a?.public_url || a?.url || '';
  return /\.(mp4|mov|webm|m4v)(?:$|[?#])/i.test(String(onde));
}

function pintarPreviaGrande() {
  const a = PREVIA_MATERIAL[PREVIA_GRANDE_INDICE];
  if (!a) return;
  const palco = document.getElementById('previa-grande-media');
  const nome = document.getElementById('previa-grande-nome');
  // Video tinha caixa propria antes. Agora e a mesma caixa: quem abre um .mp4
  // pela lista de arquivos ganha as setas, o nome e o botao de baixar junto.
  if (palco) {
    const fonte = safeText(a.public_url || a.url || a.url_thumbnail || '');
    palco.innerHTML = eVideoDoMaterial(a)
      ? `<video id="previa-grande-img" src="${fonte}" controls autoplay playsinline></video>`
      : `<img id="previa-grande-img" src="${fonte}" alt="${safeText(a.name || '')}">`;
  }
  if (nome) nome.textContent = `(${PREVIA_GRANDE_INDICE + 1}/${PREVIA_MATERIAL.length}) ${a.name || ''}`;
  // Baixar precisa do id do arquivo no banco: e por ele que o servidor acha os
  // bytes. Previa de coisa que nao esta na peca (um link colado, por exemplo)
  // nao tem esse id, e o botao nao aparece em vez de aparecer quebrado.
  const baixar = document.getElementById('previa-baixar');
  if (baixar) baixar.style.display = a.local_id ? '' : 'none';
  // "Trocar material" so aparece quando se sabe de qual peca e a previa — ela
  // tambem abre de dentro de portoes, onde trocar o arquivo nao faz sentido.
  const trocar = document.getElementById('previa-trocar');
  if (trocar) trocar.style.display = PREVIA_DA_PECA ? '' : 'none';
  document.querySelectorAll('.previa-grande-seta').forEach((b) => {
    b.style.visibility = PREVIA_MATERIAL.length > 1 ? 'visible' : 'hidden';
  });
}

function passarPreviaGrande(passo) {
  if (!PREVIA_MATERIAL.length) return;
  PREVIA_GRANDE_INDICE = (PREVIA_GRANDE_INDICE + passo + PREVIA_MATERIAL.length) % PREVIA_MATERIAL.length;
  pintarPreviaGrande();
  trocarPreviaMaterial(PREVIA_GRANDE_INDICE);
}

// O navegador ignora o atributo `download` num link de outro dominio: ele abre
// a imagem em vez de salvar. Por isso o download passa pelo painel, que devolve
// os bytes com Content-Disposition: attachment — mesma origem, salva de verdade.
function baixarDaPrevia(evento) {
  evento?.stopPropagation?.();
  const a = PREVIA_MATERIAL[PREVIA_GRANDE_INDICE];
  if (!a?.local_id) return showToast('Este arquivo não tem cópia guardada para baixar.', 'info', 6000);
  const link = document.createElement('a');
  link.href = `/api/painel?area=baixar&arquivo=${encodeURIComponent(a.local_id)}`;
  link.download = a.name || '';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Havia DUAS caixas de prévia no painel: esta e uma escrita solta no index.html,
// com outro visual e sem "trocar material". A dos arquivos da gaveta chamava a
// outra. Agora e uma so, e este e o nome que os arquivos ja chamavam.
function openVybeLightbox(src, name) {
  const todos = (typeof activeWorkspaceAssets !== 'undefined' && activeWorkspaceAssets) || [];
  const mostraveis = todos.filter((a) => a?.url_thumbnail || eVideoDoMaterial(a)
    || /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i.test(String(a?.name || a?.public_url || a?.url || '')));
  const mesmo = (a) => (a.public_url || a.url || '') === src || (a.name && a.name === name);
  // Sem a lista da peça — ou com um arquivo que não está nela — abre só ele.
  PREVIA_MATERIAL = mostraveis.some(mesmo) ? mostraveis : [{ name, url: src, public_url: src }];
  PREVIA_DA_PECA = '';
  const onde = Math.max(0, PREVIA_MATERIAL.findIndex(mesmo));
  abrirPreviaGrande(onde);
}

function fecharPreviaGrande() {
  const caixa = document.getElementById('previa-grande');
  if (caixa) caixa.style.display = 'none';
}

// Só responde às teclas com o painel aberto: ESC dentro do modal de checklist
// continua fechando o checklist, não a imagem.
function teclaPreviaGrande(e) {
  const caixa = document.getElementById('previa-grande');
  if (!caixa || caixa.style.display === 'none') return;
  if (e.key === 'Escape') { e.stopPropagation(); fecharPreviaGrande(); }
  if (e.key === 'ArrowLeft') passarPreviaGrande(-1);
  if (e.key === 'ArrowRight') passarPreviaGrande(1);
}

function trocarPreviaMaterial(indice){ const asset=PREVIA_MATERIAL[indice]; if(!asset) return; PREVIA_GRANDE_INDICE=indice; const img=document.getElementById('material-review-img'); const legenda=document.getElementById('material-review-caption'); if(img){ img.src=asset.url_thumbnail||asset.public_url||asset.url||''; img.alt=`Prévia de ${asset.name||'material'}`; } if(legenda) legenda.textContent=`(${indice+1}/${PREVIA_MATERIAL.length}) ${asset.name||''}`; document.querySelectorAll('#material-review-strip button').forEach((b,i)=>b.classList.toggle('ativa',i===indice)); }

// ── O MATERIAL BRUTO: O CAMINHO DE ENTRADA ───────────────────────────────────
//
// A entrega, logo acima, e o que SAI da peca. Faltava o que ENTRA nela: os
// videos captados que quem edita precisa baixar antes de comecar.
//
// O sintoma foi um Reels com roteiro completo e nenhum arquivo: o link da pasta
// tinha sido colado numa atualizacao solta, e a tela de briefing — a unica que o
// editor abre — nao mostra atualizacao nenhuma. O material existia e ele nao
// achava. Nao era falta de registro, era falta de LUGAR para registrar.
//
// Agora tem campo proprio, que viaja na lista. Isso e o que permite o cartao
// dizer "falta o bruto" antes de alguem abrir a peca.
const FORMATOS_QUE_PEDEM_BRUTO = /reels|v[ií]deo|video|motion|fotografia|foto|stories|tiktok|audiovisual/i;
function pedeMaterialBruto(item) {
  return FORMATOS_QUE_PEDEM_BRUTO.test(String(item?.formato || item?.tipo_conteudo || ''));
}

// A coluna manda; o historico e resgate. O resgate existe porque as pecas que ja
// estao no quadro tiveram o link colado a mao numa atualizacao — entregar um
// campo que so funciona para peca nova seria entregar um campo vazio.
//
// O que conta como resgate: atualizacao que e praticamente so um link. Nao vale
// a da ENTREGA (que ja tem dono, logo acima) nem texto longo com um link no
// meio, que e recado, nao endereco de pasta. Pasta do Drive vem primeiro: e o
// formato real do material bruto, uma pasta com os arquivos captados.
function materialBrutoDaPeca(detail, item) {
  const doCampo = String(detail?.material_bruto || item?.material_bruto || '').trim();
  if (doCampo) return { url: doCampo, origem: 'campo', quando: detail?.material_bruto_em || '' };

  const entrega = workspaceDeliveryInfo(detail || {});
  const candidatos = (detail?.updates || [])
    .map((update) => {
      const texto = workspacePlainText(update?.body || '');
      const url = workspaceUrlFromText(texto);
      const sobra = texto.replace(url, '').replace(/^\s*\[Vybe OS[^\]]*\]\s*/i, '').trim();
      return { update, texto, url, sobra };
    })
    .filter((e) => e.url && e.url !== entrega?.url)
    .filter((e) => !/Link de entrega|Link final|Entrega final/i.test(e.texto))
    .filter((e) => e.sobra.length <= 60 || /material bruto|arquivos brutos|material captado|pasta da capta/i.test(e.texto));
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => (/\/folders\//.test(b.url) - /\/folders\//.test(a.url))
    || String(b.update?.created_at || '').localeCompare(String(a.update?.created_at || '')));
  const achado = candidatos[0];
  return { url: achado.url, origem: 'histórico', quando: achado.update?.created_at || '',
           autor: achado.update?.creator?.name || '' };
}

async function gravarMaterialBruto(itemId, link) {
  const resposta = await fetch('/api/conteudo', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'material_bruto', item: String(itemId), link: String(link || '') }),
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.error || 'Não foi possível salvar.');
  // A lista e a gaveta leem de lugares diferentes; sem os dois, o cartao continua
  // dizendo que falta material logo depois de alguem registrar.
  const naLista = typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null;
  if (naLista) naLista.material_bruto = dados.para || '';
  if (DETALHE_DA_GAVETA && String(DETALHE_DA_GAVETA.id ?? '') === String(itemId)) {
    DETALHE_DA_GAVETA.material_bruto = dados.para || '';
  }
  return dados;
}

// Pedir o link, gravar e redesenhar o que estiver aberto. Um caminho so, chamado
// do cartao, da gaveta e da tela de briefing.
async function pedirMaterialBruto(itemId, event) {
  event?.stopPropagation?.();
  const item = typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null;
  const atual = String(item?.material_bruto || '');
  const url = await perguntarNoPainel({
    titulo: atual ? 'Trocar o link do material bruto' : 'Link do material bruto',
    texto: 'A pasta com o que foi captado — os vídeos e fotos que quem edita precisa baixar. '
      + 'Aparece na tela de briefing, que é onde quem produz vai procurar.',
    campo: { valor: atual, dica: 'https://drive.google.com/drive/folders/…' },
    confirmar: atual ? 'Trocar link' : 'Registrar link',
  });
  if (url === null || url === undefined) return;
  try {
    const feito = await gravarMaterialBruto(itemId, url);
    showToast(feito.para ? '✓ Material bruto registrado' : '✓ Link do material bruto removido', 'ok', 4000);
    if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos();
    if (typeof renderFocusDesk === 'function') renderFocusDesk();
    if (String(activeWorkspaceItemId) === String(itemId) && document.getElementById('workspace-drawer')) {
      renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), findOperationalItem(itemId));
    }
    if (document.getElementById('brief-overlay') && BRIEFING_ABERTO?.item
        && String(BRIEFING_ABERTO.item.id) === String(itemId)) {
      fecharBriefing(); await abrirBriefing(itemId);
    }
  } catch (erro) { showToast(`Não foi possível salvar: ${erro.message}`, 'err', 7000); }
}

// Guardar no campo o link que a tela achou no historico. E a migracao das pecas
// antigas feita uma peca por vez, por quem esta olhando para ela — e nao uma
// varredura adivinhando qual link de qual atualizacao era o material bruto.
async function fixarMaterialBruto(itemId, url, event) {
  event?.stopPropagation?.();
  try {
    await gravarMaterialBruto(itemId, url);
    showToast('✓ Link fixado no campo · o cartão para de cobrar', 'ok', 4000);
    if (typeof renderVisaoDeGrupos === 'function') renderVisaoDeGrupos();
    if (typeof renderFocusDesk === 'function') renderFocusDesk();
    if (String(activeWorkspaceItemId) === String(itemId) && document.getElementById('workspace-drawer')) {
      renderWorkspaceDrawer(await fetchWorkspaceItem(itemId), findOperationalItem(itemId));
    }
    if (document.getElementById('brief-overlay') && BRIEFING_ABERTO?.item
        && String(BRIEFING_ABERTO.item.id) === String(itemId)) {
      fecharBriefing(); await abrirBriefing(itemId);
    }
  } catch (erro) { showToast(`Não foi possível fixar: ${erro.message}`, 'err', 7000); }
}

// Clicar no botao do cartao: se tem link, abre; se nao tem, pergunta. Um botao
// que as vezes abre e as vezes pede e melhor do que dois botoes que se alternam.
function abrirMaterialBruto(itemId, event) {
  event?.stopPropagation?.();
  const item = typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null;
  const url = String(item?.material_bruto || '');
  if (!url) return pedirMaterialBruto(itemId, event);
  window.open(url, '_blank', 'noopener');
}

function botaoDeMaterialBrutoHtml(item) {
  if (!pedeMaterialBruto(item)) return '';
  const tem = Boolean(String(item?.material_bruto || '').trim());
  return `<button type="button" class="focus-brief-btn bruto${tem ? '' : ' faltando'}"
    onclick="abrirMaterialBruto('${safeText(String(item.id))}',event)"
    title="${tem ? 'Abrir a pasta com o material captado' : 'Nenhum material bruto registrado · clique para colar o link da pasta'}"
    aria-label="Material bruto">🎬<span>${tem ? 'Bruto' : 'Sem bruto'}</span></button>`;
}

// A faixa na tela de briefing e na gaveta. E o mesmo desenho nos dois lugares
// porque e a mesma informacao — e porque quem produz aprende um lugar so.
function faixaDeMaterialBrutoHtml(detail, item, { compacta = false } = {}) {
  const bruto = materialBrutoDaPeca(detail, item);
  if (!bruto) {
    if (!pedeMaterialBruto(item)) return '';
    return `<div class="material-bruto faltando">
      <div class="material-bruto-copy"><span>Material bruto</span>
        <b>Nenhuma pasta registrada</b>
        <small>Quem edita não tem o que baixar. Cole aqui o link da pasta com o que foi captado.</small></div>
      <div class="material-bruto-acoes">
        <button type="button" class="material-bruto-add" onclick="pedirMaterialBruto('${safeText(String(item.id))}',event)">REGISTRAR LINK</button>
      </div></div>`;
  }
  const quando = String(bruto.quando || '').replace('T', ' ').slice(0, 16);
  return `<div class="material-bruto">
    <div class="material-bruto-copy"><span>Material bruto${bruto.origem === 'histórico' ? ' · encontrado no histórico' : ''}</span>
      <b>Pasta do material captado</b>
      <small>${safeText(bruto.url.replace(/^https?:\/\//, '').slice(0, 64))}${bruto.url.length > 71 ? '…' : ''}${quando ? ` · ${safeText(quando)}` : ''}</small></div>
    <div class="material-bruto-acoes">
      <a class="material-bruto-abrir" href="${safeText(bruto.url)}" target="_blank" rel="noopener">ABRIR PASTA ↗</a>
      <button type="button" class="material-bruto-copiar" onclick="copiarBriefingTexto('${safeText(bruto.url)}','Link do material bruto')">Copiar</button>
      ${compacta ? '' : (bruto.origem === 'histórico'
        // O link resgatado do historico nao esta no CAMPO — e por isso o cartao
        // ainda diz "sem bruto". Um clique arruma os dois, sem ninguem ter de
        // copiar e colar de volta o endereco que a tela ja encontrou.
        ? `<button type="button" class="material-bruto-copiar" onclick="fixarMaterialBruto('${safeText(String(item.id))}','${safeText(bruto.url)}',event)"
             title="Guardar este link no campo da peça — assim o cartão para de dizer que falta material">Fixar</button>`
        : `<button type="button" class="material-bruto-copiar" onclick="pedirMaterialBruto('${safeText(String(item.id))}',event)">Trocar</button>`)}
    </div></div>`;
}
