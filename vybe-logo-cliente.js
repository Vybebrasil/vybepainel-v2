// vybe-logo-cliente.js — a logo do cliente, uma fonte só para todas as telas (Planejamentos, Clientes, ficha, Produção,
// Feed, Aprovação, Agenda e o Seu dia).
// Paulo, 16/11/2026: "em planejamentos vi que alguns clientes têm a logo e outros não... deixa todos com sua logo... pega
// do insta ou do drive". Antes cada tela lia a foto do Instagram que o Feed já tinha lido (FEED.perfis): sem abrir o Feed,
// ou com o cliente longe do que o Feed pediu, ficavam as iniciais; e o @ só vinha do cadastro, por nome exato.
//
// Ordem: 1. a logo do cadastro (a escolhida no planejamento ou o campo "Logo (link no Drive)" da ficha)
//        2. a foto do perfil do Instagram (o @ do cadastro; sem ele, o do cérebro do cliente)
//        3. a logo da pasta do cliente no Drive (Banco de Marca / logo)
//        4. as iniciais
// A imagem tenta a próxima fonte quando a de agora falha (logoProximaFonte) e a fonte que falhou não é pedida de novo.
const LOGO_FALHOU = new Set();
function logoNormCliente(x) { return String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function logoLinhaDoCliente(nome) {
  const linhas = typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : [];
  const n = logoNormCliente(String(nome || '').split(',')[0]);
  if (!n) return null;
  const exata = linhas.find((c) => logoNormCliente(c.nome) === n);
  if (exata) return exata;
  // O nome da peça nem sempre é o do cadastro ("VOA" e "VÖA Sportswear"): a mesma chave com apelidos da tela de Clientes.
  try { if (typeof cadastroDoCliente === 'function') return cadastroDoCliente(String(nome).split(',')[0].trim()) || null; } catch { /* sem a tela de Clientes */ }
  return null;
}
function logoUsuarioIg(bruto) {
  if (typeof feedUsuario === 'function') return feedUsuario(bruto);
  let s = String(bruto || '').trim(); const url = s.match(/instagram\.com\/([^/?#\s]+)/i); if (url) s = url[1];
  s = s.replace(/^@+/, '').replace(/\/+$/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : '';
}
// O @ do Instagram do cliente: o do cadastro; sem ele, o do cérebro (VYBES_CEREBRO_BASE), como o Feed faz.
function instagramDoClienteLogo(nome, linha = logoLinhaDoCliente(nome)) {
  const doCadastro = logoUsuarioIg(linha?.cadastro?.instagram || linha?.instagram || '');
  if (doCadastro) return doCadastro;
  const base = typeof VYBES_CEREBRO_BASE !== 'undefined' && Array.isArray(VYBES_CEREBRO_BASE) ? VYBES_CEREBRO_BASE : [];
  const n = logoNormCliente(linha?.nome || String(nome || '').split(',')[0]);
  if (!n) return '';
  const d = base.find((x) => logoNormCliente(x.nome) === n || (x.apelidos || []).some((a) => logoNormCliente(a) === n) || logoNormCliente(x.nome).startsWith(n) || n.startsWith(logoNormCliente(x.nome)));
  return logoUsuarioIg(d?.instagram || '');
}
// Um número curto do que muda a logo: trocar o @ ou o link no cadastro renova o cache do navegador.
function logoVersao(txt) { let h = 5381; for (const ch of String(txt || '')) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); }
// As fontes da logo, na ordem; as que já falharam ficam de fora.
function fontesDaLogoDoCliente(nome) {
  const linha = logoLinhaDoCliente(nome);
  const id = /^\d{1,18}$/.test(String(linha?.id ?? '')) ? String(linha.id) : '';
  const linkDaFicha = String(linha?.cadastro?.logo_url || '').trim();
  const fontes = [];
  if (id && (linha.tem_logo || /^https:\/\//.test(linkDaFicha))) fontes.push(`/api/painel?area=logo&c=${id}&fonte=cadastro&v=${logoVersao(linkDaFicha)}`);
  const usuario = instagramDoClienteLogo(nome, linha);
  if (usuario) {
    const perfil = typeof FEED !== 'undefined' ? FEED.perfis?.get?.(usuario) : null;
    // O Feed já leu o perfil: a foto de lá; leu e deu erro: pula o Instagram; não leu: o servidor lê só a foto.
    if (perfil && !perfil.erro && perfil.foto && typeof feedFotoIg === 'function') fontes.push(feedFotoIg(perfil.foto));
    else if (!perfil || !perfil.erro) fontes.push(`/api/painel?area=feed_instagram&avatar=${encodeURIComponent(usuario)}`);
  }
  if (id) fontes.push(`/api/painel?area=logo&c=${id}&fonte=drive`);
  return [...new Set(fontes)].filter((u) => u && !LOGO_FALHOU.has(u));
}
function logoEsc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function iniciaisDaLogo(nome) { return String(nome || '').trim().slice(0, 2).toUpperCase(); }
// A logo pronta para a tela: <img> com as próximas fontes guardadas, ou as iniciais. classe vazia: as iniciais saem como
// texto solto (os avatares do "como fica no Instagram" já têm o próprio quadro).
function logoDoClienteHtml(nome, { classe = 'd3v-foto', iniciais = iniciaisDaLogo(nome), estilo = '' } = {}) {
  if (!nome) return '';
  const fontes = fontesDaLogoDoCliente(nome);
  const cls = classe ? ` class="${logoEsc(classe)}"` : '';
  const st = estilo ? ` style="${logoEsc(estilo)}"` : '';
  if (!fontes.length) return classe ? `<i${cls}${st} aria-hidden="true">${logoEsc(iniciais)}</i>` : logoEsc(iniciais);
  // Tamanho de partida (confere 19/11/2026: centenas de logos sem tamanho pulavam o layout ao chegar). Toda classe de
  // quadro (d3v-foto, vfa-av, vle-av…) fixa largura e altura no CSS, que vence o atributo; ele só vale até o CSS e dá
  // a proporção quadrada. Sem classe, o quadro é de quem chama (o "como fica no Instagram" do Conteúdo, que estica a
  // imagem a 100%): 64, o mesmo tamanho que a foto do Feed já levava ali, só para a reserva quadrada antes do CSS.
  const tam = classe ? ' width="28" height="28"' : ' width="64" height="64"';
  return `<img${cls}${st} src="${logoEsc(fontes[0])}" data-logo-mais="${logoEsc(fontes.slice(1).join(' '))}" data-logo-ini="${logoEsc(iniciais)}" alt="" loading="lazy" decoding="async" onerror="logoProximaFonte(this)"${tam}>`;
}
// A fonte de agora falhou (404, sem perfil, imagem quebrada): a próxima; sem nenhuma, as iniciais no lugar.
function logoProximaFonte(img) {
  if (!img) return;
  const atual = img.getAttribute('src'); if (atual) LOGO_FALHOU.add(atual);
  const mais = String(img.dataset.logoMais || '').split(' ').filter((u) => u && !LOGO_FALHOU.has(u));
  if (mais.length) { img.dataset.logoMais = mais.slice(1).join(' '); img.setAttribute('src', mais[0]); return; }
  const ini = img.dataset.logoIni || '';
  if (!img.className) { img.replaceWith(document.createTextNode(ini)); return; }
  const i = document.createElement('i');
  i.className = img.className;
  const st = img.getAttribute('style'); if (st) i.setAttribute('style', st);
  i.setAttribute('aria-hidden', 'true');
  i.textContent = ini;
  img.replaceWith(i);
}
