// ─── CICLO DE VIDA DE CLIENTE E DE COLABORADOR, NUM LUGAR SÓ ─────────────────
//
// Entrar, sair, voltar e ser apagado eram quatro gestos espalhados: o cliente
// se desativava na tela de Clientes, a pessoa só tinha "bloquear" na Equipe, e
// as duas importações do Monday regravavam o `ativo` de todo mundo a cada vez
// que rodavam — quem tinha saído voltava sozinho, sem ninguém ligar uma coisa à
// outra. Aqui é o único lugar que muda esse estado, com as mesmas regras para
// os dois e uma linha de história a cada mudança.
//
// - desativar: some das listas, da mesa do Centro de Operação e do login; vai
//   para o subsolo do Escritório. Nada se perde e dá para desfazer.
// - reativar: volta como estava (heads, mesa, quem entrava continua entrando).
// - apagar: só de quem já está no subsolo. Tira o cadastro, os acessos e o
//   boneco para sempre. A linha fica, com o nome congelado, porque peças,
//   demandas, atas e planejamentos apontam para ela — apagar a linha
//   arrastaria a história de todo mundo que trabalhou com aquele cliente.
//
// `ciclo_em` marca que a decisão foi tomada aqui. Depois dela, importação do
// Monday não mexe mais no `ativo`: quem decide é o Vybe OS.

function invalido(mensagem, status = 400) {
  return Object.assign(new Error(mensagem), { status });
}
const idValido = (v) => ['string', 'number'].includes(typeof v) && Number.isSafeInteger(Number(v)) && Number(v) > 0;
const limpo = (v, max = 300) => String(v ?? '').trim().slice(0, max);

let pronto = false;
// Cada teste abre um banco novo; em produção o banco é um só por processo.
export function esquecerCicloDeVidaPronto() { pronto = false; }
// Idempotente e chamada a cada uso, no padrão das automações: a coluna nasce
// sozinha sem depender de alguém rodar migração. Bancos de teste com tabelas
// mínimas também passam, porque tudo é IF NOT EXISTS.
export async function garantirCicloDeVida(db) {
  if (pronto) return;
  for (const tabela of ['vybe_clientes', 'vybe_pessoas']) {
    await db.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS desativado_em TIMESTAMPTZ`);
    await db.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS apagado_em TIMESTAMPTZ`);
    await db.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ciclo_em TIMESTAMPTZ`);
  }
  // Quem entrava antes de sair volta entrando; quem não entrava continua fora.
  await db`ALTER TABLE vybe_pessoas ADD COLUMN IF NOT EXISTS entrava_antes BOOLEAN`;
  await db`CREATE TABLE IF NOT EXISTS vybe_cliente_eventos (
    id         BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES vybe_clientes(id) ON DELETE CASCADE,
    tipo       TEXT NOT NULL,
    de         TEXT,
    para       TEXT,
    motivo     TEXT,
    autor      TEXT,
    em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE TABLE IF NOT EXISTS vybe_pessoa_eventos (
    id        BIGSERIAL PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES vybe_pessoas(id) ON DELETE CASCADE,
    tipo      TEXT NOT NULL,
    de        TEXT,
    para      TEXT,
    motivo    TEXT,
    autor     TEXT,
    em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS vybe_pessoa_eventos_pessoa ON vybe_pessoa_eventos (pessoa_id, em DESC)`;
  pronto = true;
}

async function existeTabela(tx, nome) {
  const [r] = await tx`SELECT to_regclass(${nome}) IS NOT NULL AS ok`;
  return Boolean(r?.ok);
}

const ESTADO = (linha) => (linha.apagado_em ? 'Apagado' : linha.ativo === false ? 'Inativo' : 'Ativo');

// ── cliente ──────────────────────────────────────────────────────────────────

export async function criarCliente(db, { nome, autor }) {
  await garantirCicloDeVida(db);
  const nomeLimpo = limpo(nome, 200);
  if (!nomeLimpo) throw invalido('Informe o nome do cliente.');
  return db.comTransacao(async (tx) => {
    const [existe] = await tx`SELECT id, nome, ativo, apagado_em FROM vybe_clientes WHERE LOWER(nome)=LOWER(${nomeLimpo}) FOR UPDATE`;
    if (existe?.apagado_em) {
      throw invalido(`Já existiu um cliente "${existe.nome}", apagado para sempre. Use outro nome (por exemplo, com a cidade).`, 409);
    }
    if (existe) {
      // Reativa em vez de recusar: cliente que voltou é o caso comum, e criar
      // um segundo com o mesmo nome partiria o histórico em dois.
      if (existe.ativo !== false) return { ok: true, cliente: { id: existe.id, nome: existe.nome, ativo: true }, ja_existia: true };
      return { ok: true, reativado: true, cliente: await mudarCliente(tx, existe.id, 'reativar', { autor, motivo: 'Cadastrado de novo' }) };
    }
    // O status preenchido é o que separa um cadastro de verdade de uma linha
    // que a importação criou sozinha só porque o nome apareceu num conteúdo.
    const [c] = await tx`INSERT INTO vybe_clientes (nome, status, ativo, ciclo_em) VALUES (${nomeLimpo}, 'Ativo', TRUE, NOW())
      RETURNING id, nome, ativo`;
    await tx`INSERT INTO vybe_cliente_eventos (cliente_id, tipo, de, para, autor) VALUES (${c.id}, 'status', NULL, 'Ativo', ${autor || 'Vybe OS'})`;
    return { ok: true, cliente: c };
  });
}

async function mudarCliente(tx, id, acao, { autor, motivo, confirmacao } = {}) {
  const [antes] = await tx`SELECT id, nome, ativo, status, apagado_em FROM vybe_clientes WHERE id=${id} FOR UPDATE`;
  if (!antes) throw invalido('Cliente não encontrado.', 404);
  if (antes.apagado_em) throw invalido(`${antes.nome} foi apagado para sempre e não volta.`, 409);
  const de = antes.status || ESTADO(antes);
  if (acao === 'desativar') {
    await tx`UPDATE vybe_clientes SET ativo=FALSE, status='Inativo', desativado_em=NOW(), ciclo_em=NOW() WHERE id=${id}`;
  } else if (acao === 'reativar') {
    await tx`UPDATE vybe_clientes SET ativo=TRUE, status='Ativo', desativado_em=NULL, ciclo_em=NOW() WHERE id=${id}`;
  } else if (acao === 'apagar') {
    if (antes.ativo !== false) throw invalido('Mande o cliente para o subsolo antes de apagar: só se apaga quem já foi desativado.', 409);
    if (limpo(confirmacao, 200).toLowerCase() !== String(antes.nome).trim().toLowerCase()) {
      throw invalido(`Para apagar para sempre, digite o nome exato: ${antes.nome}.`);
    }
    // O cadastro sai; o nome fica, congelado, para a história que aponta para ele.
    const colunas = new Set((await tx`SELECT column_name FROM information_schema.columns WHERE table_name='vybe_clientes'`).map((c) => c.column_name));
    const zerar = ['email', 'telefone', 'endereco', 'cnpj', 'plano', 'segmento', 'responsavel', 'planejamento_url',
      'dashboard', 'valor', 'proxima_reuniao', 'nps', 'nps_em', 'monday_item_id'].filter((c) => colunas.has(c));
    if (zerar.length) await tx.query(`UPDATE vybe_clientes SET ${zerar.map((c) => `${c}=NULL`).join(', ')} WHERE id=$1`, [id]);
    if (colunas.has('identidade')) await tx`UPDATE vybe_clientes SET identidade='{}'::jsonb WHERE id=${id}`;
    await tx`UPDATE vybe_clientes SET status='Apagado', apagado_em=NOW(), ciclo_em=NOW() WHERE id=${id}`;
    // Senhas e logins das redes do cliente: o dado mais sensível que existe dele.
    if (await existeTabela(tx, 'vybe_acessos')) await tx`DELETE FROM vybe_acessos WHERE cliente_id=${id}`;
    if (await existeTabela(tx, 'vybe_cliente_pessoas')) await tx`DELETE FROM vybe_cliente_pessoas WHERE cliente_id=${id}`;
  } else {
    throw invalido(`Ação desconhecida: ${acao}`);
  }
  const para = acao === 'apagar' ? 'Apagado' : acao === 'reativar' ? 'Ativo' : 'Inativo';
  await tx`INSERT INTO vybe_cliente_eventos (cliente_id, tipo, de, para, motivo, autor)
    VALUES (${id}, ${acao === 'apagar' ? 'apagado' : 'status'}, ${de}, ${para}, ${limpo(motivo) || null}, ${autor || 'Vybe OS'})`;
  return { id: antes.id, nome: antes.nome, ativo: acao === 'reativar' };
}

export async function cicloCliente(db, { id, acao, autor, motivo, confirmacao }) {
  if (!idValido(id)) throw invalido('Informe o cliente.');
  await garantirCicloDeVida(db);
  return db.comTransacao(async (tx) => ({ ok: true, cliente: await mudarCliente(tx, Number(id), acao, { autor, motivo, confirmacao }) }));
}

// ── colaborador ──────────────────────────────────────────────────────────────

export async function criarPessoa(db, { nome, email, papel, autor }) {
  await garantirCicloDeVida(db);
  const nomeLimpo = limpo(nome, 120);
  const emailLimpo = limpo(email, 200).toLowerCase() || null;
  if (!nomeLimpo) throw invalido('Informe o nome do colaborador.');
  if (emailLimpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) throw invalido('E-mail inválido.');
  return db.comTransacao(async (tx) => {
    if (emailLimpo) {
      const [existe] = await tx`SELECT id, nome, ativo FROM vybe_pessoas WHERE LOWER(email)=${emailLimpo} FOR UPDATE`;
      if (existe && existe.ativo !== false) return { ok: true, pessoa: { id: existe.id, nome: existe.nome, ativo: true }, ja_existia: true };
      if (existe) return { ok: true, reativado: true, pessoa: await mudarPessoa(tx, existe.id, 'reativar', { autor, motivo: 'Cadastrado de novo' }) };
    }
    // pode_entrar nasce FALSE de propósito, como na importação: o acesso se
    // libera quando quem administra define a senha, na Equipe.
    const [p] = await tx`INSERT INTO vybe_pessoas (nome, email, papel, ativo, pode_entrar, ciclo_em)
      VALUES (${nomeLimpo}, ${emailLimpo}, ${limpo(papel, 80) || null}, TRUE, FALSE, NOW()) RETURNING id, nome, ativo`;
    await tx`INSERT INTO vybe_pessoa_eventos (pessoa_id, tipo, de, para, autor) VALUES (${p.id}, 'status', NULL, 'Ativo', ${autor || 'Vybe OS'})`;
    return { ok: true, pessoa: p };
  });
}

async function mudarPessoa(tx, id, acao, { autor, autorId, motivo, confirmacao } = {}) {
  const [antes] = await tx`SELECT id, nome, ativo, admin, pode_entrar, apagado_em FROM vybe_pessoas WHERE id=${id} FOR UPDATE`;
  if (!antes) throw invalido('Colaborador não encontrado.', 404);
  if (antes.apagado_em) throw invalido(`${antes.nome} foi apagado para sempre e não volta.`, 409);
  if (autorId && String(autorId) === String(id) && acao !== 'reativar') {
    throw invalido('Peça a outro administrador — você não pode tirar a si mesmo.');
  }
  if (antes.admin && acao !== 'reativar') {
    const [outros] = await tx`SELECT COUNT(*)::int AS n FROM vybe_pessoas WHERE admin AND ativo AND id<>${id}`;
    if (!outros?.n) throw invalido('É o último administrador ativo: a operação ficaria sem ninguém que possa devolver.');
  }
  const de = ESTADO(antes);
  const vinculos = await existeTabela(tx, 'vybe_ai_vinculos');
  if (acao === 'desativar') {
    // sessao_versao derruba a sessão aberta na hora; o vínculo do WhatsApp
    // revogado faz a Vybe IA parar de responder como se ainda fosse do time.
    await tx`UPDATE vybe_pessoas SET ativo=FALSE, entrava_antes=pode_entrar, pode_entrar=FALSE,
        sessao_versao=sessao_versao+1, desativado_em=NOW(), ciclo_em=NOW() WHERE id=${id}`;
    if (vinculos) await tx`UPDATE vybe_ai_vinculos SET revogado_em=NOW() WHERE pessoa_id=${id} AND revogado_em IS NULL`;
  } else if (acao === 'reativar') {
    await tx`UPDATE vybe_pessoas SET ativo=TRUE, pode_entrar=COALESCE(entrava_antes, FALSE), entrava_antes=NULL,
        desativado_em=NULL, ciclo_em=NOW() WHERE id=${id}`;
  } else if (acao === 'apagar') {
    if (antes.ativo !== false) throw invalido('Mande o colaborador para o subsolo antes de apagar: só se apaga quem já foi desativado.', 409);
    if (limpo(confirmacao, 120).toLowerCase() !== String(antes.nome).trim().toLowerCase()) {
      throw invalido(`Para apagar para sempre, digite o nome exato: ${antes.nome}.`);
    }
    // O monday_user_id fica: sem ele, a próxima carga de conteúdo criaria uma
    // "Pessoa 123" nova para as peças antigas, em vez de apontar para esta.
    await tx`UPDATE vybe_pessoas SET email=NULL, senha_hash=NULL, senha_sal=NULL, foto_url=NULL, admin=FALSE,
        pode_entrar=FALSE, entrava_antes=NULL, sessao_versao=sessao_versao+1, apagado_em=NOW(), ciclo_em=NOW() WHERE id=${id}`;
    if (vinculos) await tx`DELETE FROM vybe_ai_vinculos WHERE pessoa_id=${id}`;
    if (await existeTabela(tx, 'vybe_ai_desafios')) await tx`DELETE FROM vybe_ai_desafios WHERE pessoa_id=${id}`;
    if (await existeTabela(tx, 'vybe_cliente_pessoas')) await tx`DELETE FROM vybe_cliente_pessoas WHERE pessoa_id=${id}`;
  } else {
    throw invalido(`Ação desconhecida: ${acao}`);
  }
  const para = acao === 'apagar' ? 'Apagado' : acao === 'reativar' ? 'Ativo' : 'Inativo';
  await tx`INSERT INTO vybe_pessoa_eventos (pessoa_id, tipo, de, para, motivo, autor)
    VALUES (${id}, ${acao === 'apagar' ? 'apagado' : 'status'}, ${de}, ${para}, ${limpo(motivo) || null}, ${autor || 'Vybe OS'})`;
  return { id: antes.id, nome: antes.nome, ativo: acao === 'reativar' };
}

export async function cicloPessoa(db, { id, acao, autor, autorId, motivo, confirmacao }) {
  if (!idValido(id)) throw invalido('Informe o colaborador.');
  await garantirCicloDeVida(db);
  return db.comTransacao(async (tx) => ({ ok: true, pessoa: await mudarPessoa(tx, Number(id), acao, { autor, autorId, motivo, confirmacao }) }));
}

// ── o subsolo ────────────────────────────────────────────────────────────────
//
// Quem está desativado e ainda não foi apagado. A data é a da saída registrada;
// quem saiu antes de existir o registro aparece com a data da última mudança de
// status que a história guardou, ou sem data.
export async function listarSubsolo(db) {
  await garantirCicloDeVida(db);
  const clientes = await db`SELECT c.id::text AS id, c.nome, c.segmento,
      c.identidade->'personagem' AS personagem,
      COALESCE(c.desativado_em, e.em) AS saiu_em, e.motivo,
      (SELECT COUNT(*)::int FROM vybe_conteudo_clientes v WHERE v.cliente_id=c.id) AS pecas
    FROM vybe_clientes c
    LEFT JOIN LATERAL (SELECT em, motivo FROM vybe_cliente_eventos WHERE cliente_id=c.id AND para='Inativo' ORDER BY em DESC LIMIT 1) e ON TRUE
    WHERE c.ativo=FALSE AND c.apagado_em IS NULL AND NOT COALESCE(c.nao_e_cliente, FALSE)
    ORDER BY COALESCE(c.desativado_em, e.em) DESC NULLS LAST, c.nome`;
  // Pessoa sem e-mail e sem login nunca foi do time: é o nome que a carga de
  // conteúdo criou para um responsável do Monday ("Pessoa 123").
  const pessoas = await db`SELECT p.id::text AS id, p.nome, p.papel, p.foto_url,
      COALESCE(p.desativado_em, e.em) AS saiu_em, e.motivo
    FROM vybe_pessoas p
    LEFT JOIN LATERAL (SELECT em, motivo FROM vybe_pessoa_eventos WHERE pessoa_id=p.id AND para='Inativo' ORDER BY em DESC LIMIT 1) e ON TRUE
    WHERE p.ativo=FALSE AND p.apagado_em IS NULL AND (p.email IS NOT NULL OR p.senha_hash IS NOT NULL OR p.desativado_em IS NOT NULL)
    ORDER BY COALESCE(p.desativado_em, e.em) DESC NULLS LAST, p.nome`;
  // O boneco que a pessoa usava no Escritório, para descer com a mesma roupa.
  if (pessoas.length && await existeTabela(db, 'vybe_escritorio_perfis')) {
    const figuras = new Map((await db`SELECT pessoa_id::text AS id, preferencias->>'figura' AS figura
      FROM vybe_escritorio_perfis WHERE pessoa_id = ANY(${pessoas.map((p) => p.id)}::bigint[])`).map((f) => [f.id, f.figura]));
    for (const p of pessoas) p.figura = figuras.get(p.id) || null;
  }
  return { ok: true, clientes, pessoas };
}
