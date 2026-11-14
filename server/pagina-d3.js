// Página simples no padrão da Direção 3 (fundo areia, cartão branco com canto 20, ação em preto): o "não encontrado"
// do servidor local e o link de onboarding que não vale mais. Sem script e sem arquivo externo; o logo vai embutido.
import { LOGO_VYBE } from './vybe-logo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// rotulo: a linha curta acima do título (ex.: "404"). acao: { texto, href } para o botão preto, opcional.
export function paginaD3Html({ titulo, texto = '', rotulo = '', acao = null, nonce = '' } = {}) {
  const n = nonce ? ` nonce="${esc(nonce)}"` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titulo)} · Vybe</title><style${n}>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#EAE6DE;color:#1F1D1A}
body{display:grid;place-items:center;min-height:100vh;min-height:100dvh;padding:24px 16px;font:400 15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:100%;max-width:420px;display:grid;gap:14px;padding:28px 24px;border-radius:20px;background:#FFFFFF;animation:chega .45s cubic-bezier(.22,1,.36,1) both}
.marca{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#1F1D1A}.marca img{width:32px;height:auto;display:block}
.rotulo{display:inline-flex;align-items:center;gap:6px;justify-self:start;height:22px;padding:0 9px;border-radius:999px;background:#F3F1EC;color:#4A463F;font:600 12px Inter,system-ui,sans-serif}
.rotulo::before{content:"";width:7px;height:7px;border-radius:50%;background:#B5AFA5}
h1{margin:0;font:700 24px/1.2 "Inter Tight",Inter,system-ui,sans-serif;letter-spacing:-.02em}
p{margin:0;color:#6B665E}
a.acao{justify-self:start;display:inline-flex;align-items:center;height:40px;padding:0 18px;border-radius:999px;background:#1F1D1A;color:#FFFFFF;font:600 14px Inter,system-ui,sans-serif;text-decoration:none}
a.acao:hover{background:#4A463F}a.acao:focus-visible{outline:2px solid #1F1D1A;outline-offset:2px}
@keyframes chega{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){main{animation:none}}
</style></head><body><main>
<span class="marca"><img src="${LOGO_VYBE}" alt="Vybe"></span>
${rotulo ? `<span class="rotulo">${esc(rotulo)}</span>` : ''}<h1>${esc(titulo)}</h1>${texto ? `<p>${esc(texto)}</p>` : ''}
${acao?.href ? `<a class="acao" href="${esc(acao.href)}">${esc(acao.texto || 'Voltar')}</a>` : ''}
</main></body></html>`;
}
