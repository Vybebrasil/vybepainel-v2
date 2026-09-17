// O LOG DE ATIVIDADE DE UMA PEÇA — a trajetória inteira, como o do Monday.
//
// Tudo que o painel faz numa peça já deixa um evento em vybe_conteudo_eventos,
// com quem fez e quando: criação, status, datas, grupo, título, responsáveis,
// clientes, campos da ficha, material, arquivos, comentários, tarefas, remoção.
// Faltava uma leitura que devolvesse todos juntos. Duas fontes completam:
//
// - o que as automações fizeram (vybe_automacao_execucoes), que não passa pelos
//   eventos porque quem age é a regra, não uma pessoa;
// - os comentários importados do Monday, que chegaram como updates e nunca
//   geraram evento. Os comentários feitos no painel já têm o próprio evento e
//   não entram de novo.
//
// As duas são complemento: se uma delas falhar, o log sai com os eventos em vez
// de não sair.
export const LIMITE_DO_LOG = 1000;

export async function logDaPeca(sql, conteudoId) {
  const id = Number(conteudoId);
  const [eventos, execucoes, comentariosDoMonday] = await Promise.allSettled([
    sql`SELECT e.tipo, e.de, e.para, e.texto, e.em,
               COALESCE(p.nome, '') AS autor, (e.monday_log_id IS NOT NULL) AS do_monday
          FROM vybe_conteudo_eventos e LEFT JOIN vybe_pessoas p ON p.id = e.autor_id
         WHERE e.conteudo_id = ${id}
         ORDER BY e.em DESC LIMIT ${LIMITE_DO_LOG}`,
    sql`SELECT COALESCE(a.nome, 'Automação removida') AS regra, x.resultado, x.em
          FROM vybe_automacao_execucoes x LEFT JOIN vybe_automacoes a ON a.id = x.automacao_id
         WHERE x.conteudo_id = ${id}
         ORDER BY x.em DESC LIMIT 200`,
    sql`SELECT u.corpo, COALESCE(u.autor, '') AS autor, u.criado_em AS em
          FROM vybe_conteudo_updates u
         WHERE u.conteudo_id = ${id} AND u.monday_update_id IS NOT NULL AND u.criado_em IS NOT NULL
         ORDER BY u.criado_em DESC LIMIT 200`,
  ]);
  if (eventos.status !== 'fulfilled') throw eventos.reason;
  const texto = (v) => (v === null || v === undefined ? null : String(v));
  const itens = eventos.value.map((e) => ({
    tipo: e.tipo, de: texto(e.de), para: texto(e.para), texto: texto(e.texto),
    em: new Date(e.em).toISOString(), autor: e.autor || '', do_monday: Boolean(e.do_monday),
  }));
  if (execucoes.status === 'fulfilled') {
    for (const x of execucoes.value) {
      const r = typeof x.resultado === 'string' ? JSON.parse(x.resultado) : (x.resultado || {});
      itens.push({ tipo: 'automacao', de: null, para: (r.feitas || []).join(', ') || null,
        texto: x.regra, em: new Date(x.em).toISOString(), autor: '', do_monday: false });
    }
  }
  if (comentariosDoMonday.status === 'fulfilled') {
    for (const u of comentariosDoMonday.value) {
      itens.push({ tipo: 'comentario', de: null, para: null, texto: String(u.corpo || '').slice(0, 400),
        em: new Date(u.em).toISOString(), autor: u.autor || '', do_monday: true });
    }
  }
  itens.sort((a, b) => b.em.localeCompare(a.em));
  return itens;
}
