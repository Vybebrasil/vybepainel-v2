export const textoDoHistorico = corpo => String(corpo || '').replace(/<\/(p|div|li|h[1-6]|tr)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/&#(\d+);/g, (_,n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff))).trim();
