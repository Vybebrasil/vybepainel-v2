// Bloqueia integrações externas antes de qualquer chamada de rede na homologação.
export function previewVybeAiIsolada(config = process.env) {
  return config.VERCEL_ENV === 'preview' &&
    config.VERCEL_GIT_COMMIT_REF === 'feature/vybe-ai-readonly-integration';
}

export function exigirSaidaExternaAtiva() {
  if (previewVybeAiIsolada()) {
    throw Object.assign(new Error('Integrações externas desativadas neste ambiente de homologação.'), { status: 503 });
  }
}

export function exigirIntegracoesAtivas() {
  exigirSaidaExternaAtiva();
  if (process.env.VYBE_HOMOLOGACAO === '1') {
    throw new Error('Integrações externas desativadas neste ambiente de homologação.');
  }
}
