import { textoDoHistorico } from './texto-historico.js';
// Resgate somente de leitura, comum à fila e ao detalhe. O campo explícito
// (inclusive uma remoção registrada) prevalece sobre notas históricas.
export function resolverMaterialBruto({ material_bruto = '', material_bruto_em = '', material_bruto_definido = false, historico_bruto = [] } = {}) {
  const campo = String(material_bruto || '').trim();
  if (campo) return { url: campo, origem: 'campo', quando: material_bruto_em || '' };
  if (material_bruto_definido) return null;
  const notas = historico_bruto.map(u => {
    const texto = textoDoHistorico(u.corpo);
    const url = (texto.match(/https?:\/\/[^\s<>"']+/i)?.[0] || '').replace(/[),.;]+$/, '');
    return { u, texto, url, sobra: texto.replace(url, '').replace(/^\s*\[Vybe OS[^\]]*\]\s*/i, '').trim() };
  });
  const entregas = new Set(notas.filter(n => /Link de entrega|Link final|Entrega final/i.test(n.texto)).map(n => n.url));
  const candidatos = notas.filter(n => n.url && !entregas.has(n.url))
    .filter(n => n.sobra.length <= 60 || /material bruto|arquivos brutos|material captado|pasta da capta/i.test(n.texto));
  candidatos.sort((a,b) => Number(/\/folders\//.test(b.url)) - Number(/\/folders\//.test(a.url))
    || String(b.u.criado_em || '').localeCompare(String(a.u.criado_em || '')) || Number(b.u.id || 0) - Number(a.u.id || 0));
  const achado = candidatos[0];
  return achado ? { url: achado.url, origem: 'histórico', quando: achado.u.criado_em || '' } : null;
}
