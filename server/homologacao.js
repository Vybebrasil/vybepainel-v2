// Bloqueia integrações externas antes de qualquer chamada de rede na homologação.
export function exigirIntegracoesAtivas() {
  if (process.env.VYBE_HOMOLOGACAO === '1') {
    throw new Error('Integrações externas desativadas neste ambiente de homologação.');
  }
}
