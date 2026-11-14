// server/uma-vez.js — a migração aditiva roda uma vez por banco em cada instância, e não a cada requisição.
//
// O painel abre um cliente novo do Neon por chamada (api/painel.js sql()), então os guardas antigos por WeakSet(db) nunca
// pegavam: ALTER TABLE vybe_clientes a cada request, até no GET público do onboarding (confere de 14/11/2026). Aqui a
// chave é o banco, não o objeto: o cliente do Neon (server/transacao-automacoes.js) carrega `identidadeDoBanco`, e todos
// os clientes do mesmo banco dividem a mesma promessa, como em server/migracoes-historico.js. Quem não tem a marca (o
// PGlite dos testes) usa o próprio objeto. Se falhar, a promessa é esquecida e a próxima chamada tenta de novo.
const porBanco = new Map();
const porObjeto = new WeakMap();

export function umaVez(nome, db, fazer) {
  const identidade = db && typeof db.identidadeDoBanco === 'string' ? db.identidadeDoBanco : null;
  const mapa = identidade ? porBanco : (porObjeto.get(db) || (porObjeto.set(db, new Map()), porObjeto.get(db)));
  const chave = identidade ? `${nome}|${identidade}` : nome;
  let p = mapa.get(chave);
  if (!p) {
    p = Promise.resolve().then(() => fazer(db)).catch((erro) => { mapa.delete(chave); throw erro; });
    mapa.set(chave, p);
  }
  return p;
}

// Para os testes: esquece o que já rodou nos bancos marcados.
export function esquecerUmaVez() { porBanco.clear(); }
