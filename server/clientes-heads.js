// IDs legados identificam as pessoas, sem depender de grafia ou homônimos.
const CARTEIRA_POR_HEAD = { '68035653': 'Vinícius', '68036687': 'Ewerton' };

function invalido(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}

export async function salvarHeadsCliente(db, clienteId, pessoas) {
  const id = Number(clienteId);
  const valido = valor => ['string', 'number'].includes(typeof valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0;
  if (!valido(clienteId) || !Array.isArray(pessoas) || pessoas.some(p => !valido(p))) {
    throw invalido('Informe o cliente e pessoas válidas.');
  }
  const ids = [...new Set(pessoas.map(Number))];
  return db.comTransacao(async tx => {
    const [cliente] = await tx`SELECT id, responsavel FROM vybe_clientes WHERE id=${id} FOR UPDATE`;
    if (!cliente) throw invalido('Cliente não encontrado.', 404);
    const heads = [];
    for (const pessoaId of ids) {
      const [pessoa] = await tx`SELECT id, monday_user_id FROM vybe_pessoas WHERE id=${pessoaId} AND ativo FOR SHARE`;
      if (!pessoa) throw invalido('Uma das pessoas não está disponível. Atualize a lista.');
      heads.push(pessoa);
    }
    const carteira = heads.length === 1 ? CARTEIRA_POR_HEAD[String(heads[0].monday_user_id)] : null;
    await tx`DELETE FROM vybe_cliente_pessoas WHERE cliente_id=${id}`;
    for (let ordem = 0; ordem < ids.length; ordem++) {
      await tx`INSERT INTO vybe_cliente_pessoas (cliente_id,pessoa_id,ordem) VALUES (${id},${ids[ordem]},${ordem})`;
    }
    if (carteira) await tx`UPDATE vybe_clientes SET responsavel=${carteira} WHERE id=${id}`;
    return { ok: true, pessoas: ids, responsavel: carteira || cliente.responsavel };
  });
}
