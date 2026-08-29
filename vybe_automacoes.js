// vybe_automacoes.js — as regras de operação da Vybe, agora no código de vocês.
//
// Estas regras existiam só dentro do Monday, configuradas no board. Ninguém tinha
// a lista: roteamento por formato, quem aprova o quê, o que acontece ao finalizar.
// No dia que o Monday for desligado elas sumiriam sem aviso, e nada as substituiria.
//
// Uma descoberta do inventário que vale registrar: "Finalizado" não é fim de linha.
// Em três regras ele move a peça para a próxima etapa e devolve o status para
// "Pode Fazer". É fluxo de trabalho, não conclusão.
//
// As regras ficam em tabela, não em código, porque quem manda nelas é a operação —
// dá para criar, editar e desativar sem deploy.

import { neon } from '@neondatabase/serverless';

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

export const GRUPOS = {
  finalizados: 'novo_grupo31348__1',
  producao: 'novo_grupo57911__1',
  design: 'novo_grupo__1',
  redacao: 'group_title',
  publicacoes: 'novo_grupo22352__1',
};

export async function criarSchemaAutomacoes() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS vybe_automacoes (
    id        BIGSERIAL PRIMARY KEY,
    nome      TEXT NOT NULL,
    ativa     BOOLEAN NOT NULL DEFAULT TRUE,
    ordem     INT NOT NULL DEFAULT 100,
    gatilho   JSONB NOT NULL,
    condicao  JSONB,
    acoes     JSONB NOT NULL,
    origem    TEXT,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alterada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Notificação nasce só dentro do painel. O canal fica num campo próprio para
  // WhatsApp entrar depois sem mexer nas regras.
  await sql`CREATE TABLE IF NOT EXISTS vybe_notificacoes (
    id          BIGSERIAL PRIMARY KEY,
    pessoa_id   BIGINT NOT NULL REFERENCES vybe_pessoas(id) ON DELETE CASCADE,
    conteudo_id BIGINT REFERENCES vybe_conteudos(id) ON DELETE CASCADE,
    canal       TEXT NOT NULL DEFAULT 'painel',
    texto       TEXT NOT NULL,
    lida_em     TIMESTAMPTZ,
    criada_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS vybe_notificacoes_idx
    ON vybe_notificacoes (pessoa_id, lida_em NULLS FIRST, criada_em DESC)`;

  // Registro do que cada automação fez. Sem isto, regra que dispara errado é
  // invisível — foi assim que a divergência de grupo passou despercebida.
  await sql`CREATE TABLE IF NOT EXISTS vybe_automacao_execucoes (
    id           BIGSERIAL PRIMARY KEY,
    automacao_id BIGINT REFERENCES vybe_automacoes(id) ON DELETE SET NULL,
    conteudo_id  BIGINT REFERENCES vybe_conteudos(id) ON DELETE CASCADE,
    resultado    JSONB,
    em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  return { ok: true };
}

// ── as regras que estavam no Monday ───────────────────────────────────────────
const AUDIOVISUAL = ['Reels', 'Vídeo', 'Motion'];
const DESIGN = ['Card', 'Carrossel', 'Feed', 'Story', 'Fotografia', 'Feed/Story'];

const SEMENTE = [
  { nome: 'Aprovado para agendar vai para publicações com a Tainara', ordem: 10,
    gatilho: { tipo: 'status', para: 'para_agendar' }, condicao: null,
    acoes: [
      { tipo: 'captacao', para: 'agendado' },
      { tipo: 'grupo', para: GRUPOS.publicacoes },
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['80146924'] },
      { tipo: 'update', texto: 'Encaminhado para agendamento.' },
    ] },

  { nome: 'Audiovisual finalizado em Produção volta para edição com o Reriston', ordem: 20,
    gatilho: { tipo: 'status', para: 'finalizado' },
    condicao: { formato_em: AUDIOVISUAL, grupo_em: [GRUPOS.producao] },
    acoes: [
      { tipo: 'grupo', para: GRUPOS.design },
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['68036697'] },
      { tipo: 'status', para: 'pode_fazer' },
    ] },

  { nome: 'Design finalizado em Produção volta para edição com Deivid e Beatriz', ordem: 21,
    gatilho: { tipo: 'status', para: 'finalizado' },
    condicao: { formato_em: DESIGN, grupo_em: [GRUPOS.producao] },
    acoes: [
      { tipo: 'grupo', para: GRUPOS.design },
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['68997024', '71130408'] },
      { tipo: 'status', para: 'pode_fazer' },
    ] },

  { nome: 'Finalizado em Gestão de publicações vai para Finalizados', ordem: 22,
    gatilho: { tipo: 'status', para: 'finalizado' },
    condicao: { grupo_em: [GRUPOS.publicacoes] },
    acoes: [{ tipo: 'grupo', para: GRUPOS.finalizados }] },

  { nome: 'Aprovação de audiovisual chama Vinícius, Ewerton e Paulo', ordem: 30,
    gatilho: { tipo: 'status', de: 'em_andamento', para: 'para_aprovacao' },
    condicao: { formato_apenas: AUDIOVISUAL },
    acoes: [{ tipo: 'responsaveis', modo: 'add', pessoas: ['68035653', '68036687', '68035537'] }] },

  { nome: 'Aprovação de design chama Deivid e Beatriz', ordem: 31,
    gatilho: { tipo: 'status', de: 'em_andamento', para: 'para_aprovacao' },
    condicao: { formato_em: DESIGN },
    acoes: [{ tipo: 'responsaveis', modo: 'add', pessoas: ['68997024', '71130408'] }] },

  { nome: 'Alteração que volta para aprovação chama o Deivid', ordem: 32,
    gatilho: { tipo: 'status', de: 'alteracao', para: 'para_aprovacao' },
    condicao: { formato_em: DESIGN },
    acoes: [{ tipo: 'responsaveis', modo: 'add', pessoas: ['68997024'] }] },

  { nome: 'Captação a agendar fica com o Ademir', ordem: 40,
    gatilho: { tipo: 'captacao', para: 'agendar_captacao' }, condicao: null,
    acoes: [
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['78158742'] },
      { tipo: 'status', para: 'cap_agendada' },
    ] },

  { nome: 'Captação agendada passa para o Reriston', ordem: 41,
    gatilho: { tipo: 'captacao', de: 'agendar_captacao', para: 'cap_agendada' }, condicao: null,
    acoes: [
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['68036697'] },
      { tipo: 'grupo', para: GRUPOS.design },
      { tipo: 'status', para: 'pode_fazer' },
    ] },

  // ── por data: rodam pela tarefa agendada, não por mudança de estado ──
  { nome: 'Avisa um dia antes do prazo', ordem: 50,
    gatilho: { tipo: 'data', campo: 'prazo', dias: -1, hora: '10:45' }, condicao: null,
    acoes: [{ tipo: 'notificar', texto: 'Sua entrega vence amanhã: {titulo} ({cliente}).' }] },

  { nome: 'Cobra no dia da veiculação o que não foi finalizado', ordem: 51,
    gatilho: { tipo: 'data', campo: 'veiculacao', dias: 0, hora: '11:00' },
    condicao: { status_nao_em: ['agendado', 'finalizado', 'para_agendar'] },
    acoes: [{ tipo: 'notificar', texto: 'Veicula hoje e ainda não está pronto: {titulo} ({cliente}).' }] },

  { nome: 'Cobra um dia depois da veiculação', ordem: 52,
    gatilho: { tipo: 'data', campo: 'veiculacao', dias: 1, hora: '11:00' },
    condicao: { status_nao_em: ['agendado', 'finalizado'] },
    acoes: [{ tipo: 'notificar', texto: 'Veiculou ontem e continua em aberto: {titulo} ({cliente}).' }] },
];

// Semeia as regras importadas. Com refazer=true, corrige as que já existem em vez
// de não fazer nada: a conferência contra o Monday achou divergências depois da
// primeira semeadura, e sem isto só daria para arrumar uma por uma na mão.
// Regra criada no painel nunca é tocada.
export async function semear({ refazer = false } = {}) {
  await criarSchemaAutomacoes();
  const sql = database();
  const existentes = Number((await sql`SELECT COUNT(*)::int AS n FROM vybe_automacoes`)[0].n);
  if (existentes && !refazer) return { ja_existiam: existentes, criadas: 0, atualizadas: 0 };

  let criadas = 0, atualizadas = 0;
  const nomes = [];
  for (const r of SEMENTE) {
    nomes.push(r.nome);
    const g = JSON.stringify(r.gatilho);
    const c = r.condicao ? JSON.stringify(r.condicao) : null;
    const a = JSON.stringify(r.acoes);
    const mexida = await sql`UPDATE vybe_automacoes
        SET ordem=${r.ordem}, gatilho=${g}::jsonb, condicao=${c}::jsonb, acoes=${a}::jsonb,
            alterada_em=NOW()
      WHERE nome=${r.nome} AND origem='importada do Monday' RETURNING id`;
    if (mexida.length) { atualizadas += 1; continue; }
    await sql`INSERT INTO vybe_automacoes (nome, ordem, gatilho, condicao, acoes, origem)
      VALUES (${r.nome}, ${r.ordem}, ${g}::jsonb, ${c}::jsonb, ${a}::jsonb, 'importada do Monday')`;
    criadas += 1;
  }
  // Semente que deixou de existir — a regra genérica que eu tinha inventado — sai.
  const orfas = await sql`DELETE FROM vybe_automacoes
    WHERE origem='importada do Monday' AND NOT (nome = ANY(${nomes})) RETURNING nome`;
  return { ja_existiam: existentes, criadas, atualizadas, removidas: orfas.map((o) => o.nome) };
}

export async function listar() {
  await criarSchemaAutomacoes();
  const sql = database();
  return sql`SELECT id, nome, ativa, ordem, gatilho, condicao, acoes, origem, alterada_em
    FROM vybe_automacoes ORDER BY ordem, id`;
}

export async function salvar(dados) {
  await criarSchemaAutomacoes();
  const sql = database();
  const { id, nome, ativa = true, ordem = 100, gatilho, condicao = null, acoes } = dados;
  if (!nome || !gatilho || !acoes) throw new Error('Informe nome, gatilho e ações.');
  const g = JSON.stringify(gatilho);
  const c = condicao ? JSON.stringify(condicao) : null;
  const a = JSON.stringify(acoes);
  if (id) {
    const r = await sql`UPDATE vybe_automacoes SET nome=${nome}, ativa=${!!ativa}, ordem=${ordem},
        gatilho=${g}::jsonb, condicao=${c}::jsonb, acoes=${a}::jsonb, alterada_em=NOW()
      WHERE id=${id} RETURNING *`;
    if (!r.length) throw new Error(`Automação ${id} não existe.`);
    return r[0];
  }
  return (await sql`INSERT INTO vybe_automacoes (nome, ativa, ordem, gatilho, condicao, acoes, origem)
    VALUES (${nome}, ${!!ativa}, ${ordem}, ${g}::jsonb, ${c}::jsonb, ${a}::jsonb, 'criada no painel')
    RETURNING *`)[0];
}

export async function remover(id) {
  const sql = database();
  const r = await sql`DELETE FROM vybe_automacoes WHERE id=${id} RETURNING nome`;
  if (!r.length) throw new Error(`Automação ${id} não existe.`);
  return r[0];
}

// ── execução ──────────────────────────────────────────────────────────────────
function atende(condicao, item) {
  if (!condicao) return true;
  const formatos = () => String(item.formato || '').split(',').map((s) => s.trim()).filter(Boolean);

  // Formato é multi-seleção: "Carrossel, Fotografia" atende regra de qualquer um.
  if (condicao.formato_em) {
    if (!formatos().some((p) => condicao.formato_em.includes(p))) return false;
  }
  // "apenas" é mais estrito: TODOS os formatos do item precisam estar na lista.
  // O Monday distingue as duas coisas e a diferença muda o resultado num item
  // com dois formatos.
  if (condicao.formato_apenas) {
    const fs = formatos();
    if (!fs.length || !fs.every((p) => condicao.formato_apenas.includes(p))) return false;
  }
  // De qual grupo o item está saindo. Sem isto, "finalizado" tem um destino só,
  // e no Monday ele tem três, dependendo de onde a peça está.
  if (condicao.grupo_em && !condicao.grupo_em.includes(item.grupo_id)) return false;
  if (condicao.status_nao_em && condicao.status_nao_em.includes(item.status_chave)) return false;
  if (condicao.status_em && !condicao.status_em.includes(item.status_chave)) return false;
  return true;
}

function casaGatilho(gatilho, evento) {
  if (gatilho.tipo !== evento.tipo) return false;
  // Evento de data casa por campo e defasagem, não por 'de'/'para' de estado.
  if (gatilho.tipo === 'data') {
    return gatilho.campo === evento.campo && Number(gatilho.dias || 0) === Number(evento.dias || 0);
  }
  if (gatilho.para && gatilho.para !== evento.para) return false;
  if (gatilho.de && gatilho.de !== evento.de) return false;
  return true;
}

// Aplica as regras que casam com o evento. Devolve o que mudou, para o chamador
// replicar no Monday enquanto ele ainda existir.
export async function aplicar(sql, conteudoId, evento) {
  const item = (await sql`SELECT c.id, c.titulo, c.formato, c.status_chave, c.grupo_id,
      (SELECT cl.nome FROM vybe_conteudo_clientes vcc JOIN vybe_clientes cl ON cl.id=vcc.cliente_id
        WHERE vcc.conteudo_id=c.id LIMIT 1) AS cliente
    FROM vybe_conteudos c WHERE c.id=${conteudoId}`)[0];
  if (!item) return { aplicadas: [] };

  const regras = await sql`SELECT * FROM vybe_automacoes WHERE ativa ORDER BY ordem, id`;
  const aplicadas = [];

  const assinatura = JSON.stringify(evento);
  for (const regra of regras) {
    if (!casaGatilho(regra.gatilho, evento)) continue;
    if (!atende(regra.condicao, item)) continue;

    // A mesma mudança chega por dois caminhos: o painel grava e replica no
    // Monday, e o Monday devolve um webhook contando o que acabou de acontecer.
    // Mover de grupo duas vezes não faz mal, mas notificar e comentar sim.
    const repetida = await sql`SELECT 1 FROM vybe_automacao_execucoes
      WHERE automacao_id=${regra.id} AND conteudo_id=${item.id}
        AND em > NOW() - INTERVAL '2 minutes'
        AND resultado->>'evento' = ${assinatura} LIMIT 1`;
    if (repetida.length) continue;

    const feitas = [];
    for (const acao of regra.acoes || []) {
      if (acao.tipo === 'grupo') {
        await sql`UPDATE vybe_conteudos SET grupo_id=${acao.para}, atualizado_em=NOW() WHERE id=${item.id}`;
        feitas.push(`grupo → ${acao.para}`);
      } else if (acao.tipo === 'status') {
        await sql`UPDATE vybe_conteudos SET status_chave=${acao.para}, status_em=NOW(), atualizado_em=NOW() WHERE id=${item.id}`;
        item.status_chave = acao.para;
        feitas.push(`status → ${acao.para}`);
      } else if (acao.tipo === 'responsaveis') {
        if (acao.modo === 'replace') await sql`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=${item.id}`;
        await sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id)
          SELECT ${item.id}, id FROM vybe_pessoas WHERE monday_user_id = ANY(${acao.pessoas})
          ON CONFLICT DO NOTHING`;
        feitas.push(`responsáveis ${acao.modo}`);
      } else if (acao.tipo === 'update') {
        await sql`INSERT INTO vybe_conteudo_updates (conteudo_id, corpo, autor, criado_em)
          VALUES (${item.id}, ${acao.texto}, 'Automação', NOW())`;
        feitas.push('update');
      } else if (acao.tipo === 'notificar') {
        const texto = String(acao.texto || '')
          .replace('{titulo}', item.titulo || '').replace('{cliente}', item.cliente || 'sem cliente');
        await sql`INSERT INTO vybe_notificacoes (pessoa_id, conteudo_id, texto)
          SELECT r.pessoa_id, ${item.id}, ${texto} FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id=${item.id}`;
        feitas.push('notificação');
      } else if (acao.tipo === 'captacao') {
        feitas.push(`captação → ${acao.para} (só no Monday por enquanto)`);
      }
    }

    await sql`INSERT INTO vybe_automacao_execucoes (automacao_id, conteudo_id, resultado)
      VALUES (${regra.id}, ${item.id}, ${JSON.stringify({ evento: assinatura, feitas })}::jsonb)`;
    aplicadas.push({ id: regra.id, nome: regra.nome, feitas });

    // A primeira regra que casar por status "finalizado" define o destino: sem
    // isto, a regra genérica de ordem 90 desfaria o roteamento por formato.
    if (evento.tipo === 'status' && feitas.some((f) => f.startsWith('grupo'))) break;
  }
  return { aplicadas };
}

// ── conferência ───────────────────────────────────────────────────────────────

// Diz quais regras dispariam, sem executar nenhuma. Usa exatamente os mesmos
// casaGatilho e atende que a execução usa — reimplementar a comparação aqui
// criaria duas verdades, e a que ninguém testa é a que fica errada.
//
// É o que o Monday nunca ofereceu: lá só dava para descobrir o que uma regra
// faz mudando um item de verdade e vendo o que acontecia depois.
export async function simular(sql, conteudoId, evento) {
  const item = (await sql`SELECT id, titulo, formato, status_chave, grupo_id
    FROM vybe_conteudos WHERE id=${conteudoId}`)[0];
  if (!item) throw new Error(`Conteúdo ${conteudoId} não existe.`);

  const regras = await sql`SELECT * FROM vybe_automacoes WHERE ativa ORDER BY ordem, id`;
  const dispararia = [];
  for (const regra of regras) {
    if (!casaGatilho(regra.gatilho, evento)) continue;
    if (!atende(regra.condicao, item)) continue;
    dispararia.push({ id: regra.id, nome: regra.nome, ordem: regra.ordem, acoes: regra.acoes });
    if (evento.tipo === 'status' && (regra.acoes || []).some((a) => a.tipo === 'grupo')) break;
  }
  return { item, dispararia };
}

// Roda o motor de verdade contra um conteúdo descartável e apaga tudo depois.
// Sem isto, a única forma de saber se as ações gravam certo seria mexer num
// card real do time — e um erro de SQL só apareceria no trabalho de alguém.
// As chaves estrangeiras apagam em cascata, então não sobra rastro.
export async function ensaio(sql, evento, { formato = 'Reels', grupo = 'ensaio' } = {}) {
  const marca = `[ensaio] ${new Date().toISOString()}`;
  // Só evento de status carrega chave de status em 'de' — num evento de captação
  // o 'de' é 'agendar_captacao', que não existe em vybe_status.
  const partida = evento.tipo === 'status' ? (evento.de || 'em_andamento') : 'em_andamento';
  const criado = (await sql`INSERT INTO vybe_conteudos (titulo, formato, status_chave, grupo_id)
    VALUES (${marca}, ${formato}, ${String(partida)}, ${String(grupo)})
    RETURNING id`)[0];
  try {
    // O motor roda DEPOIS da gravação: quem chama já escreveu o status novo.
    // Sem imitar isso, o ensaio mostraria o status antigo e mentiria sobre o
    // estado final.
    if (evento.tipo === 'status' && evento.para) {
      await sql`UPDATE vybe_conteudos SET status_chave=${String(evento.para)} WHERE id=${criado.id}`;
    }
    const { aplicadas } = await aplicar(sql, criado.id, evento);
    const depois = (await sql`SELECT status_chave, grupo_id FROM vybe_conteudos WHERE id=${criado.id}`)[0];
    const responsaveis = await sql`SELECT p.nome FROM vybe_conteudo_responsaveis r
      JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id=${criado.id} ORDER BY p.nome`;
    const notificacoes = await sql`SELECT COUNT(*)::int AS n FROM vybe_notificacoes WHERE conteudo_id=${criado.id}`;
    return {
      formato, grupo_inicial: grupo, evento, aplicadas,
      resultado: {
        status: depois?.status_chave, grupo: depois?.grupo_id,
        responsaveis: responsaveis.map((r) => r.nome),
        notificacoes: notificacoes[0]?.n || 0,
      },
    };
  } finally {
    await sql`DELETE FROM vybe_conteudos WHERE id=${criado.id}`;
  }
}

// ── regras por data ───────────────────────────────────────────────────────────

// As três regras de aviso não dependem de ninguém mexer em nada: elas olham o
// calendário. Rodam pela tarefa diária, não pela troca de status.
//
// Sobre o horário: as regras guardam 10:45 e 11:00, herdados do Monday, mas o
// plano da Vercel dispara tarefa agendada uma vez por dia. O horário fica
// gravado e passa a valer quando houver disparo por hora — ou quando a
// notificação sair para o WhatsApp, onde a hora importa de verdade. No sino
// dentro do painel, a pessoa vê quando abre.
export async function varrerAgenda(sql, hoje = new Date(), { seco = false } = {}) {
  const dia = hoje.toISOString().slice(0, 10);
  const regras = await sql`SELECT * FROM vybe_automacoes
    WHERE ativa AND gatilho->>'tipo' = 'data' ORDER BY ordem, id`;

  const resumo = [];
  for (const regra of regras) {
    const campo = regra.gatilho.campo === 'prazo' ? 'prazo' : 'veiculacao';
    const dias = Number(regra.gatilho.dias || 0);
    const excluir = regra.condicao?.status_nao_em || [];

    // dias:-1 em prazo é "um dia antes", ou seja prazo = hoje + 1.
    const alvos = campo === 'prazo'
      ? await sql`SELECT id, titulo, formato, status_chave FROM vybe_conteudos
          WHERE prazo = (${dia}::date - ${dias}::int)
            AND (${excluir}::text[] = '{}' OR NOT (status_chave = ANY(${excluir})))`
      : await sql`SELECT id, titulo, formato, status_chave FROM vybe_conteudos
          WHERE veiculacao = (${dia}::date - ${dias}::int)
            AND (${excluir}::text[] = '{}' OR NOT (status_chave = ANY(${excluir})))`;

    let avisados = 0;
    for (const item of alvos) {
      if (!atende(regra.condicao, item)) continue;

      // Cobrança repetida vira ruído e a pessoa para de ler o sino. Uma por
      // regra, por item, por dia.
      const jaHoje = await sql`SELECT 1 FROM vybe_automacao_execucoes
        WHERE automacao_id=${regra.id} AND conteudo_id=${item.id}
          AND em >= ${dia}::date LIMIT 1`;
      if (jaHoje.length) continue;

      if (seco) { avisados += 1; continue; }
      const { aplicadas } = await aplicar(sql, item.id, {
        tipo: 'data', campo, dias, para: regra.gatilho.para ?? null,
      });
      if (aplicadas.length) avisados += 1;
    }
    resumo.push({ regra: regra.nome, candidatos: alvos.length, avisados });
  }
  return { dia, seco, regras: resumo };
}

// Mudança feita direto no Monday chega por webhook. Sem isto, desligar as regras
// de lá deixaria essa mudança sem automação nenhuma — nem a deles, nem a nossa.
export async function aplicarDeEvento(sql, evento) {
  if (evento?.type !== 'update_column_value' && evento?.type !== 'change_column_value') return null;
  const coluna = evento.columnId;
  const tipo = coluna === 'status' ? 'status' : coluna === 'status_1__1' ? 'captacao' : null;
  if (!tipo) return null;

  const item = (await sql`SELECT id FROM vybe_conteudos
    WHERE monday_item_id = ${String(evento.pulseId || evento.itemId || '')}`)[0];
  if (!item) return null;

  // O webhook traz o índice da coluna; as regras falam por chave.
  const porIndice = async (indice) => {
    if (indice === null || indice === undefined) return null;
    const r = await sql`SELECT chave FROM vybe_status WHERE monday_index=${Number(indice)}`;
    return r[0]?.chave || null;
  };
  const para = tipo === 'status' ? await porIndice(evento.value?.label?.index)
                                 : evento.value?.label?.text || null;
  const de = tipo === 'status' ? await porIndice(evento.previousValue?.label?.index)
                               : evento.previousValue?.label?.text || null;
  if (!para) return null;

  return aplicar(sql, item.id, { tipo, de, para });
}

// O que as regras andaram fazendo. No Monday isto não existia de forma legível:
// a peça se movia e ninguém sabia dizer qual regra tinha feito aquilo.
export async function execucoes({ limite = 60, conteudoId = null } = {}) {
  await criarSchemaAutomacoes();
  const sql = database();
  const linhas = conteudoId
    ? await sql`SELECT e.id, e.em, e.resultado, a.nome AS automacao, c.titulo, c.monday_item_id
         FROM vybe_automacao_execucoes e
         LEFT JOIN vybe_automacoes a ON a.id = e.automacao_id
         LEFT JOIN vybe_conteudos  c ON c.id = e.conteudo_id
        WHERE e.conteudo_id = ${conteudoId}
        ORDER BY e.em DESC LIMIT ${limite}`
    : await sql`SELECT e.id, e.em, e.resultado, a.nome AS automacao, c.titulo, c.monday_item_id
         FROM vybe_automacao_execucoes e
         LEFT JOIN vybe_automacoes a ON a.id = e.automacao_id
         LEFT JOIN vybe_conteudos  c ON c.id = e.conteudo_id
        ORDER BY e.em DESC LIMIT ${limite}`;
  return linhas.map((l) => ({
    id: l.id, em: l.em, automacao: l.automacao || '(regra excluída)',
    titulo: l.titulo, monday_item_id: l.monday_item_id,
    feitas: l.resultado?.feitas || [],
    evento: (() => { try { return JSON.parse(l.resultado?.evento || 'null'); } catch { return null; } })(),
  }));
}
