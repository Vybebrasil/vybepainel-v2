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

// Solicitacoes e um quadro proprio, com grupos e vocabulario proprios. Ate aqui
// nenhuma regra falava dele — e como a mesma chave de status existe nos dois
// (feito, alteracao, pode_fazer), uma regra escrita para um pegaria o outro sem
// avisar. Por isso a condicao 'board_em' nasce junto com estas.
export const BOARD_DEMANDAS = 8385559107;
export const GRUPOS_DEMANDAS = {
  ideias: 'group_mm187437',
  a_fazer: 'novo_grupo_mkmkjdqd',
  em_execucao: 'novo_grupo_mkkyfhtw',
  concluidas: 'novo_grupo_mkkyx8pv',
};
const PAULO = '68035537';

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
const AUDIOVISUAL = ['reels', 'video', 'motion'];
const DESIGN = ['card', 'carrossel', 'feed', 'story', 'fotografia', 'feed_story'];

const SEMENTE = [
  { nome: 'Aprovado para agendar vai para publicações com a Tainara', ordem: 10,
    gatilho: { tipo: 'status', para: 'para_agendar' }, condicao: null,
    acoes: [
      { tipo: 'captacao', para: 'editado' },
      { tipo: 'grupo', para: GRUPOS.publicacoes },
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['80146924'] },
      { tipo: 'update', texto: 'Encaminhado para agendamento.' },
    ] },

  // FOTOGRAFIA JA CAPTADA SAI DE PRODUCAO PARA A EDICAO.
  //
  // Uma foto em Producao com a captacao FEITA nao esta mais esperando ser
  // tirada: esta esperando ser tratada. Quem trata sao Deivid, Bia e Jady, no
  // grupo Design & Edicao, com a peca liberada para fazer.
  //
  // Sao TRES regras porque ha tres caminhos para a peca chegar nesse estado, e o
  // motor casa uma regra por tipo de gatilho: o status vira "Pode Fazer", o
  // status vira "Finalizado", ou a captacao vira "Feita" com o status ja num dos
  // dois. Uma regra so pegaria um caminho e deixaria os outros parados.
  //
  // Vem ANTES das regras 20/21 e 41 de proposito: as tres tambem casariam com
  // uma fotografia, e a primeira que move de grupo e a que vale.
  { nome: 'Fotografia captada e liberada em Produção vai para Design com Deivid, Bia e Jady', ordem: 18,
    gatilho: { tipo: 'status', para: 'pode_fazer' },
    condicao: { formato_em: ['fotografia'], grupo_em: [GRUPOS.producao],
                captacao_em: ['captacao_feita'] },
    acoes: [
      { tipo: 'grupo', para: GRUPOS.design },
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['68997024', '71130408', '100482777'] },
      { tipo: 'status', para: 'pode_fazer' },
    ] },

  { nome: 'Fotografia captada e finalizada em Produção vai para Design com Deivid, Bia e Jady', ordem: 19,
    gatilho: { tipo: 'status', para: 'finalizado' },
    condicao: { formato_em: ['fotografia'], grupo_em: [GRUPOS.producao],
                captacao_em: ['captacao_feita'] },
    acoes: [
      { tipo: 'grupo', para: GRUPOS.design },
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['68997024', '71130408', '100482777'] },
      { tipo: 'status', para: 'pode_fazer' },
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

  // PECA EM FINALIZADOS NAO TEM DONO.
  //
  // Enquanto o nome de alguem fica na peca entregue, ela continua contando na
  // fila dessa pessoa e aparecendo na mesa dela — trabalho encerrado ocupando
  // espaco de trabalho por fazer. 'replace' com a lista vazia limpa: o motor
  // apaga os responsaveis e nao poe ninguem no lugar.
  //
  // Sao DUAS regras porque ha dois caminhos para a peca chegar em Finalizados, e
  // o motor para na primeira regra que move de grupo — uma regra so nao pegaria
  // os dois. Esta cuida de quem chega vindo de Publicacoes...
  { nome: 'Finalizado em Gestão de publicações vai para Finalizados, sem dono', ordem: 22,
    gatilho: { tipo: 'status', para: 'finalizado' },
    condicao: { grupo_em: [GRUPOS.publicacoes] },
    acoes: [
      { tipo: 'grupo', para: GRUPOS.finalizados },
      { tipo: 'responsaveis', modo: 'replace', pessoas: [] },
    ] },

  // ...e esta, de quem ja estava em Finalizados quando foi marcada.
  { nome: 'Finalizado em Finalizados libera o responsável', ordem: 23,
    gatilho: { tipo: 'status', para: 'finalizado' },
    condicao: { grupo_em: [GRUPOS.finalizados] },
    acoes: [{ tipo: 'responsaveis', modo: 'replace', pessoas: [] }] },

  // "Feito" contava como pronta e abria a revisao de material igual a
  // "Finalizado", mas nenhuma automacao o escutava: a peca parava ali com dono.
  // Paulo em 02/09/2026: "o feito tambem e finalizado, pode limpar o
  // responsavel". Vale nos dois quadros — nos dois ele quer dizer a mesma coisa.
  { nome: 'Feito também é fim: libera o responsável', ordem: 24,
    gatilho: { tipo: 'status', para: 'feito' }, condicao: null,
    acoes: [{ tipo: 'responsaveis', modo: 'replace', pessoas: [] }] },

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

  // AS ETAPAS QUE SO EXISTEM NAS SOLICITACOES.
  //
  // Orcamento e impressao nao tem equivalente em Producao, e por isso nenhuma
  // regra falava delas: a peca entrava no status e ficava com o dono anterior,
  // que nao e quem faz orcamento. As tres sao do Paulo, e a primeira tambem
  // muda de grupo — orcar ja e execucao.
  { nome: 'Para Orçar vai para Em Execução com o Paulo', ordem: 42,
    gatilho: { tipo: 'status', para: 'para_orcar' },
    condicao: { board_em: [BOARD_DEMANDAS] },
    acoes: [
      { tipo: 'grupo', para: GRUPOS_DEMANDAS.em_execucao },
      { tipo: 'responsaveis', modo: 'replace', pessoas: [PAULO] },
    ] },

  { nome: 'Em Orçamento continua com o Paulo', ordem: 43,
    gatilho: { tipo: 'status', para: 'em_orcamento' },
    condicao: { board_em: [BOARD_DEMANDAS] },
    acoes: [{ tipo: 'responsaveis', modo: 'replace', pessoas: [PAULO] }] },

  { nome: 'Em impressão continua com o Paulo', ordem: 44,
    gatilho: { tipo: 'status', para: 'em_impressao' },
    condicao: { board_em: [BOARD_DEMANDAS] },
    acoes: [{ tipo: 'responsaveis', modo: 'replace', pessoas: [PAULO] }] },

  // A alteracao chega para quem mandou aprovar, nao para quem estava com a peca
  // antes. Quem mandou sai do registro de quem trocou o status naquela vez.
  { nome: 'Alteração volta para quem mandou aprovar', ordem: 45,
    gatilho: { tipo: 'status', para: 'alteracao' },
    condicao: { board_em: [BOARD_DEMANDAS] },
    acoes: [{ tipo: 'responsaveis', modo: 'replace', origem: 'quem_mandou_aprovar', pessoas: [] }] },

  { nome: 'Captação agendada fica com o Ademir', ordem: 40,
    gatilho: { tipo: 'captacao', para: 'captacao_agendada' }, condicao: null,
    acoes: [
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['78158742'] },
      { tipo: 'status', para: 'cap_agendada' },
    ] },

  { nome: 'Fotografia captada em Produção vai para Design com Deivid, Bia e Jady', ordem: 39,
    gatilho: { tipo: 'captacao', para: 'captacao_feita' },
    condicao: { formato_em: ['fotografia'], grupo_em: [GRUPOS.producao],
                status_em: ['pode_fazer', 'finalizado'] },
    acoes: [
      { tipo: 'grupo', para: GRUPOS.design },
      { tipo: 'responsaveis', modo: 'replace', pessoas: ['68997024', '71130408', '100482777'] },
      { tipo: 'status', para: 'pode_fazer' },
    ] },

  // O motor NAO para na primeira regra quando o gatilho e captacao — so quando e
  // status. Entao esta precisa excluir fotografia na mao: sem isso ela rodaria
  // depois da de cima e trocaria os tres nomes pelo do Reriston.
  { nome: 'Captação feita passa para o Reriston', ordem: 41,
    gatilho: { tipo: 'captacao', de: 'captacao_agendada', para: 'captacao_feita' },
    condicao: { formato_nao_em: ['fotografia'] },
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

// Cada regra volta com o proprio historico resumido. Sem isto, a tela mostrava
// doze regras identicas em aparencia e ninguem sabia dizer quais estavam mesmo
// trabalhando — a unica forma de descobrir era ler o registro inteiro e cruzar
// nome por nome na mao.
export async function listar() {
  await criarSchemaAutomacoes();
  const sql = database();
  return sql`SELECT a.id, a.nome, a.ativa, a.ordem, a.gatilho, a.condicao, a.acoes,
      a.origem, a.alterada_em,
      COALESCE(e.total, 0)::int AS execucoes_total,
      COALESCE(e.em_30_dias, 0)::int AS execucoes_30_dias,
      e.ultima_em
    FROM vybe_automacoes a
    LEFT JOIN (
      SELECT automacao_id, COUNT(*) AS total, MAX(em) AS ultima_em,
             COUNT(*) FILTER (WHERE em > NOW() - INTERVAL '30 days') AS em_30_dias
        FROM vybe_automacao_execucoes GROUP BY automacao_id
    ) e ON e.automacao_id = a.id
    ORDER BY a.ordem, a.id`;
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
// Mesma normalização que gera a chave no catálogo. Comparar os dois lados por
// aqui deixa a regra funcionar tanto com 'reels' quanto com 'Reels', sem voltar
// a depender do texto exato do rótulo.
function normaliza(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function atende(condicao, item) {
  if (!condicao) return true;
  // Formato é comparado por chave do catálogo, não pelo rótulo: renomear
  // "Vídeo" no Monday não pode parar o roteamento de audiovisual.
  const formatos = () => (item.formato_chaves || []).map(normaliza);

  // Formato é multi-seleção: "Carrossel, Fotografia" atende regra de qualquer um.
  if (condicao.formato_em) {
    const alvo = condicao.formato_em.map(normaliza);
    if (!formatos().some((p) => alvo.includes(p))) return false;
  }
  // "apenas" é mais estrito: TODOS os formatos do item precisam estar na lista.
  // O Monday distingue as duas coisas e a diferença muda o resultado num item
  // com dois formatos.
  if (condicao.formato_apenas) {
    const fs = formatos();
    const alvo = condicao.formato_apenas.map(normaliza);
    if (!fs.length || !fs.every((p) => alvo.includes(p))) return false;
  }
  // De qual grupo o item está saindo. Sem isto, "finalizado" tem um destino só,
  // e no Monday ele tem três, dependendo de onde a peça está.
  // Em que quadro a peca esta. As chaves de status se repetem entre Producao e
  // Solicitacoes: sem isto, "alteracao" numa solicitacao dispararia a regra
  // escrita para conteudo, e vice-versa.
  // "todos MENOS estes". Sem isto, uma regra geral e uma especifica para o mesmo
  // gatilho disputam a mesma peca — e a geral, escrita antes, ganha por ordem.
  if (condicao.formato_nao_em) {
    const alvo = condicao.formato_nao_em.map(normaliza);
    if (formatos().some((p) => alvo.includes(p))) return false;
  }
  // Em que ponto da captacao a peca esta. Sem isto nao da para escrever "so
  // depois de captada", que e o que separa foto pronta para editar de foto que
  // ainda vai ser tirada.
  if (condicao.captacao_em && !condicao.captacao_em.includes(normaliza(item.captacao_chave))) return false;
  if (condicao.board_em && !condicao.board_em.map(Number).includes(Number(item.board_id))) return false;
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
  const item = (await sql`SELECT c.id, c.titulo, c.formato_chaves, c.status_chave, c.grupo_id, c.board_id,
      c.captacao_chave,
      (SELECT cl.nome FROM vybe_conteudo_clientes vcc JOIN vybe_clientes cl ON cl.id=vcc.cliente_id
        WHERE vcc.conteudo_id=c.id LIMIT 1) AS cliente
    FROM vybe_conteudos c WHERE c.id=${conteudoId}`)[0];
  if (!item) return { aplicadas: [] };

  const regras = await sql`SELECT * FROM vybe_automacoes WHERE ativa ORDER BY ordem, id`;
  const aplicadas = [];
  // O que a regra mudou aqui e precisa aparecer lá. Enquanto o Monday tinha
  // regras próprias isso convergia sozinho; desligadas, ele fica para trás — e
  // o painel, que ainda lê do espelho, mostraria o estado velho.
  const paraOMonday = { grupo: null, colunas: {} };

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
        item.grupo_id = acao.para;
        paraOMonday.grupo = acao.para;
        feitas.push(`grupo → ${acao.para}`);
      } else if (acao.tipo === 'status') {
        await sql`UPDATE vybe_conteudos SET status_chave=${acao.para}, status_em=NOW(), atualizado_em=NOW() WHERE id=${item.id}`;
        item.status_chave = acao.para;
        // A chave se repete entre os dois quadros ("feito", "alteracao"): sem o
        // board, esta busca devolvia o status do quadro errado. E indice nulo
        // virava 0 pelo Number(), gravando outro status no Monday em silencio.
        // A chave se repete entre os dois quadros ("feito", "alteracao"): sem o
        // board, esta busca devolvia o status do quadro errado. E etiqueta que
        // nasceu no painel nao tem numero do Monday — nao ha o que espelhar, e
        // Number(null) daria 0, que e o numero de outra etiqueta.
        const alvo = (await sql`SELECT monday_index, rotulo FROM vybe_status
          WHERE chave=${acao.para} AND board_id=${item.board_id}`)[0];
        if (alvo && alvo.monday_index !== null && alvo.monday_index !== undefined) {
          paraOMonday.colunas.status = { index: Number(alvo.monday_index) };
        }
        feitas.push(`status → ${acao.para}`);
      } else if (acao.tipo === 'responsaveis') {
        // DEVOLVER A PECA A QUEM A MANDOU.
        //
        // Ate aqui uma acao so sabia nomear gente fixa. "Alteracao volta para
        // quem mandou aprovar" nao tem nome fixo: depende de quem apertou o
        // botao daquela vez. A resposta ja esta guardada — cada troca de status
        // registra quem a fez — e e de la que a pessoa sai.
        //
        // So conta a familia da espera ("Para Aprovacao", "Em Aprovacao",
        // "Aguardando Aprovacao"). "Aprovado" tambem fala de aprovacao e e o
        // lado oposto: quem aprovou nao e quem mandou.
        let pessoas = Array.isArray(acao.pessoas) ? acao.pessoas : [];
        if (acao.origem === 'quem_mandou_aprovar') {
          const autor = (await sql`SELECT p.monday_user_id
              FROM vybe_conteudo_eventos e JOIN vybe_pessoas p ON p.id = e.autor_id
             WHERE e.conteudo_id=${item.id} AND e.tipo='status'
               AND (e.para ILIKE 'para aprova%' OR e.para ILIKE 'em aprova%'
                 OR e.para ILIKE 'aguardando aprova%' OR e.para ILIKE 'ag. aprova%')
             ORDER BY e.em DESC LIMIT 1`)[0];
          // Sem registro de quem mandou, a acao inteira nao acontece. Um
          // 'replace' que nao sabe para quem devolver apagaria o responsavel e
          // deixaria a peca sem dono — pior do que nao fazer nada.
          if (!autor?.monday_user_id) { feitas.push('sem registro de quem mandou aprovar'); continue; }
          pessoas = [String(autor.monday_user_id)];
        }
        if (acao.modo === 'replace') await sql`DELETE FROM vybe_conteudo_responsaveis WHERE conteudo_id=${item.id}`;
        // 'add' entra depois de quem já está: a ordem define o responsável
        // principal, e quem foi chamado para ajudar não vira dono da peça.
        const base = acao.modo === 'replace' ? 0
          : Number((await sql`SELECT COALESCE(MAX(ordem), -1) + 1 AS n
              FROM vybe_conteudo_responsaveis WHERE conteudo_id=${item.id}`)[0].n);
        await sql`INSERT INTO vybe_conteudo_responsaveis (conteudo_id, pessoa_id, ordem)
          SELECT ${item.id}, p.id, ${base} + o.ord - 1
            FROM UNNEST(${pessoas}::text[]) WITH ORDINALITY AS o(uid, ord)
            JOIN vybe_pessoas p ON p.monday_user_id = o.uid
          ON CONFLICT DO NOTHING`;
        // Manda a lista final, não o delta: 'add' no Monday sobrescreveria.
        const atuais = await sql`SELECT p.monday_user_id FROM vybe_conteudo_responsaveis r
          JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id=${item.id}
          ORDER BY r.ordem, p.nome`;
        paraOMonday.colunas.person = {
          personsAndTeams: atuais.map((a) => ({ id: Number(a.monday_user_id), kind: 'person' })),
        };
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
        const cap = (await sql`SELECT rotulo, monday_index FROM vybe_captacao WHERE chave=${acao.para}`)[0];
        await sql`UPDATE vybe_conteudos SET captacao_chave=${acao.para},
            captacao=${cap?.rotulo || null}, atualizado_em=NOW() WHERE id=${item.id}`;
        if (cap) paraOMonday.colunas.status_1__1 = { index: Number(cap.monday_index) };
        feitas.push(`captação → ${cap?.rotulo || acao.para}`);
      }
    }

    await sql`INSERT INTO vybe_automacao_execucoes (automacao_id, conteudo_id, resultado)
      VALUES (${regra.id}, ${item.id}, ${JSON.stringify({ evento: assinatura, feitas })}::jsonb)`;
    aplicadas.push({ id: regra.id, nome: regra.nome, feitas });

    // A primeira regra que casar por status "finalizado" define o destino: sem
    // isto, a regra genérica de ordem 90 desfaria o roteamento por formato.
    if (evento.tipo === 'status' && feitas.some((f) => f.startsWith('grupo'))) break;
  }
  return { aplicadas, paraOMonday };
}

// ── conferência ───────────────────────────────────────────────────────────────

// Diz quais regras dispariam, sem executar nenhuma. Usa exatamente os mesmos
// casaGatilho e atende que a execução usa — reimplementar a comparação aqui
// criaria duas verdades, e a que ninguém testa é a que fica errada.
//
// É o que o Monday nunca ofereceu: lá só dava para descobrir o que uma regra
// faz mudando um item de verdade e vendo o que acontecia depois.
export async function simular(sql, conteudoId, evento) {
  const item = (await sql`SELECT id, titulo, formato_chaves, status_chave, grupo_id
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
  // Aceita rótulo ou chave: quem ensaia digita 'Reels', o banco guarda 'reels'.
  const chaves = String(formato).split(',').map((f) => normaliza(f)).filter(Boolean);
  const marca = `[ensaio] ${new Date().toISOString()}`;
  // Só evento de status carrega chave de status em 'de' — num evento de captação
  // o 'de' é 'agendar_captacao', que não existe em vybe_status.
  const partida = evento.tipo === 'status' ? (evento.de || 'em_andamento') : 'em_andamento';
  const criado = (await sql`INSERT INTO vybe_conteudos (titulo, formato_chaves, status_chave, grupo_id)
    VALUES (${marca}, ${chaves}, ${String(partida)}, ${String(grupo)})
    RETURNING id`)[0];
  try {
    // O motor roda DEPOIS da gravação: quem chama já escreveu o status novo.
    // Sem imitar isso, o ensaio mostraria o status antigo e mentiria sobre o
    // estado final.
    if (evento.tipo === 'captacao' && evento.de) {
      await sql`UPDATE vybe_conteudos SET captacao_chave=${String(evento.de)} WHERE id=${criado.id}`;
    }
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
function dataOperacionalBahia(valor = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(valor).reduce((acc, parte) => { acc[parte.type] = parte.value; return acc; }, {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export async function varrerAgenda(sql, hoje = new Date(), { seco = false } = {}) {
  const dia = dataOperacionalBahia(hoje);
  const regras = await sql`SELECT * FROM vybe_automacoes
    WHERE ativa AND gatilho->>'tipo' = 'data' ORDER BY ordem, id`;

  const resumo = [];
  for (const regra of regras) {
    const campo = regra.gatilho.campo === 'prazo' ? 'prazo' : 'veiculacao';
    const dias = Number(regra.gatilho.dias || 0);
    const excluir = regra.condicao?.status_nao_em || [];

    // dias:-1 em prazo é "um dia antes", ou seja prazo = hoje + 1.
    const alvos = campo === 'prazo'
      ? await sql`SELECT id, titulo, formato_chaves, status_chave FROM vybe_conteudos
          WHERE removido_em IS NULL AND prazo = (${dia}::date - ${dias}::int)
            AND (${excluir}::text[] = '{}' OR NOT (status_chave = ANY(${excluir})))`
      : await sql`SELECT id, titulo, formato_chaves, status_chave FROM vybe_conteudos
          WHERE removido_em IS NULL AND veiculacao = (${dia}::date - ${dias}::int)
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
  return { dia, fuso: 'America/Bahia', seco, regras: resumo };
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
  // Captação também fala por chave, agora que tem catálogo: o evento traz o
  // rótulo e a comparação com a regra precisa ser na mesma moeda.
  const capPorRotulo = async (rotulo) => rotulo
    ? (await sql`SELECT chave FROM vybe_captacao WHERE LOWER(rotulo)=LOWER(${rotulo})`)[0]?.chave || null
    : null;
  const para = tipo === 'status' ? await porIndice(evento.value?.label?.index)
                                 : await capPorRotulo(evento.value?.label?.text);
  const de = tipo === 'status' ? await porIndice(evento.previousValue?.label?.index)
                               : await capPorRotulo(evento.previousValue?.label?.text);
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
    // As primeiras execuções guardaram o evento como objeto; depois passou a ser
    // texto, para dar para comparar contra disparo duplo. Aceita os dois.
    evento: (() => {
      const e = l.resultado?.evento;
      if (e && typeof e === 'object') return e;
      try { return JSON.parse(e || 'null'); } catch { return null; }
    })(),
  }));
}
