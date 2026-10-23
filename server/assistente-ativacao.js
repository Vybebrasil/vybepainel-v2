// Desligada por padrão. Lista vazia não libera ninguém, nem administradores.
export function assistenteAtivo(config = process.env) {
  return config.VYBE_AI_ATIVA === '1';
}
export function pessoaLiberadaAssistente(id, config = process.env) {
  if (!assistenteAtivo(config) || !Number.isSafeInteger(id) || id <= 0) return false;
  return String(config.VYBE_AI_PESSOAS_LIBERADAS || '').split(',')
    .some(valor => /^[1-9]\d*$/.test(valor.trim()) && Number(valor.trim()) === id);
}
