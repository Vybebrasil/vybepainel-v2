// VYBES dentro do Vybe OS (decisão do Paulo, 02/11/2026: "é o nosso VYBES dentro lá, não uma interface nova").
// A faixa VYBES da tela inicial abre a central de verdade (a que roda no PC do Paulo) com o crachá de quem está logado:
// Paulo, Vinícius, Ewerton e Deivid veem e agem; o resto só vê. Regras no servidor (server/vybes.js) e na central.
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
