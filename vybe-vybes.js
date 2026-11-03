// VYBES dentro do Vybe OS (decisão do Paulo, 02/11/2026: "é o nosso VYBES dentro lá, não uma interface nova").
// O cartão VYBES da tela de módulos abre a central de verdade (a que roda no PC do Paulo) com o crachá de quem está
// logado: Paulo, Vinícius, Ewerton e Deivid veem e agem; o resto só vê. Regras no servidor (server/vybes.js) e na central.
let vybesAbrindo = false;
async function chooseVybesMode() {
  if (vybesAbrindo) return;
  vybesAbrindo = true;
  // A janela abre já no clique (senão o navegador bloqueia) e recebe o endereço quando o crachá chega.
  const janela = window.open('', 'vybes');
  try {
    const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa: 'entrar' }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || 'Não foi possível abrir o VYBES agora.');
    if (janela) janela.location.href = d.url; else location.href = d.url;
  } catch (erro) {
    if (janela) janela.close();
    showToast(erro.message, 'error', 6000);
  } finally { vybesAbrindo = false; }
}

// A linha de baixo do cartão: se a central está no ar e o que quem olha pode fazer nela. Só pergunta com a tela de
// módulos aberta, e no máximo a cada 2 min (o bot republica o túnel a cada 3). Sem resposta, a linha fica vazia.
let vybesConferidoEm = 0;
async function conferirCartaoVybes(forcar = false) {
  const cartao = document.getElementById('station-vybes'), linha = document.getElementById('metrica-vybes');
  const gate = document.getElementById('mode-gate');
  if (!cartao || !linha || !gate || getComputedStyle(gate).display === 'none' || document.hidden) return;
  if (!forcar && Date.now() - vybesConferidoEm < 120e3) return;
  vybesConferidoEm = Date.now();
  try {
    const r = await fetch('/api/painel?area=vybes', { credentials: 'same-origin' });
    if (!r.ok) throw new Error();
    const { noAr, agir } = await r.json();
    cartao.classList.toggle('fora', !noAr);
    linha.innerHTML = noAr ? `<b>Ao vivo</b><span>${agir ? 'você vê e pede ações' : 'você acompanha tudo'}</span>`
      : '<b>Fora do ar</b><span>volta quando o PC do Paulo ligar</span>';
  } catch { cartao.classList.remove('fora'); linha.textContent = ''; vybesConferidoEm = Date.now() - 105e3; } // tenta de novo em 15 s
}
setInterval(conferirCartaoVybes, 10e3);
document.addEventListener('visibilitychange', () => conferirCartaoVybes());
conferirCartaoVybes(true);
