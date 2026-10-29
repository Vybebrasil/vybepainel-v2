// Ações da Vybe AI pelo WhatsApp, sempre em dois passos (Paulo, 26/10/2026: "tudo autorizado").
// 1) prepararAcao confere quem pede, a peça e a permissão, e devolve o resumo + um código assinado
//    (5 min, só para essa pessoa, uso único). 2) confirmarAcao, depois do "SIM", confere tudo de novo e
//    executa com as MESMAS funções do painel (trocarStatus/comentar): histórico, automações e Monday iguais.
// Quem pode: comentar = qualquer pessoa vinculada; Agendado/Publicado = função agendamento; mandar para
// aprovação = responsáveis da peça; decidir uma peça em aprovação = quem aprova (vídeo: heads do cliente,
// ou Vinícius e Ewerton; o resto: Deivid), a mesma regra dos avisos; administração pode tudo.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import vm from 'node:vm';
import { codigoDoPainel, linkDaAtividade } from './assistente-rotinas.js';
import { tabelaRegras } from './assistente-regras.js';
import { marcarEncaixe } from './assistente-encaixe.js';
import { gruposDoQuadro } from './grupos.js';

const VALIDADE_MS = 5 * 60e3;
const normal = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const comoChave = (v) => normal(v).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const ehVideo = (c) => /^(reels|video|motion)/.test(normal(c.formato || c.titulo));
const negar = (mensagem) => Object.assign(new Error(mensagem), { status: 403, publica: true });
const invalido = (mensagem) => Object.assign(new Error(mensagem), { status: 400, publica: true });
const b64 = (s) => Buffer.from(s).toString('base64url');
const assinar = (dados, segredo) => createHmac('sha256', segredo).update('vybe-ai-acao-v1:' + dados).digest('base64url');

async function pessoaAtiva(sql, pessoaId) {
  const [p] = await sql`SELECT id::text AS id, nome, email, COALESCE(admin, false) AS admin, monday_user_id::text AS monday_id
    FROM vybe_pessoas WHERE id = ${pessoaId} AND ativo IS TRUE AND pode_entrar IS TRUE`;
  if (!p) throw negar('Pessoa sem acesso ao Vybe OS.');
  return p;
}
// O que falta na peça para o próximo passo (Paulo, 27/10/2026: "tem briefing? tem OFF? já foi mandado pro cliente?"):
// o bot pergunta só o que estiver faltando. Briefing: o campo ou um comentário com as marcas do formulário. OFF e
// captação: o rótulo escolhido no painel (vazio = ninguém marcou). Sem as tabelas (banco antigo), não pergunta nada.
async function checagemDaPeca(sql, c) {
  try {
    const { MARCAS_BRIEFING } = await import('./briefing.js');
    const [l] = await sql`SELECT (COALESCE(btrim(x.briefing), '') <> ''
        OR EXISTS (SELECT 1 FROM vybe_conteudo_eventos e WHERE e.conteudo_id = x.id AND e.tipo = 'briefing')
        OR EXISTS (SELECT 1 FROM vybe_conteudo_updates u WHERE u.conteudo_id = x.id AND u.corpo ~* ${MARCAS_BRIEFING})) AS briefing,
      (SELECT o.rotulo FROM vybe_opcoes o WHERE o.coluna_id = 'color_mkynd7j8' AND o.chave = x.off_audio_chave) AS off,
      (SELECT k.rotulo FROM vybe_captacao k WHERE k.chave = x.captacao_chave) AS captacao
      FROM vybe_conteudos x WHERE x.id = ${Number(c.id)}`;
    if (!l) return null;
    return { briefing: Boolean(l.briefing), off: l.off || null, captacao: l.captacao || null, video: ehVideo(c) };
  } catch { return null; }
}
// Peça pelo número do painel (vybe:N ou N curto) ou pelo número do Monday (N longo).
async function pecaPorReferencia(sql, ref) {
  const texto = String(ref || '').trim();
  const local = /^vybe:\d{1,12}$/.test(texto) ? Number(texto.slice(5)) : /^\d{1,8}$/.test(texto) ? Number(texto) : null;
  const monday = /^\d{9,20}$/.test(texto) ? texto : null;
  if (local === null && monday === null) throw invalido('Informe o número da peça (o do link do painel).');
  const [c] = await sql`SELECT c.id::text AS id, c.monday_item_id::text AS monday_item_id, c.titulo, c.formato, c.board_id::text AS board_id,
      s.rotulo AS status,
      COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id ORDER BY cl.nome), '{}') AS clientes,
      COALESCE(ARRAY(SELECT r.pessoa_id::text FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id = c.id), '{}') AS responsaveis,
      COALESCE(ARRAY(SELECT h.pessoa_id::text FROM vybe_conteudo_clientes cc JOIN vybe_cliente_pessoas h ON h.cliente_id = cc.cliente_id WHERE cc.conteudo_id = c.id), '{}') AS heads
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL AND (c.id = ${local} OR c.monday_item_id::text = ${monday})`;
  if (!c) throw invalido('Não encontrei essa peça no Vybe OS.');
  return { ...c, ref: c.monday_item_id || 'vybe:' + c.id };
}
// Peça sem número (Reriston, 27/10/2026: "coloque a tarefa que tenho hoje do Brussolo como em andamento"): procura só
// entre as peças abertas em que a própria pessoa é responsável, pelo nome do cliente ou por um pedaço do título.
// Uma só: segue para a confirmação. Várias: lista com o número de cada uma. Nenhuma: diz isso.
const semAcento = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// Palavras que não identificam peça (do jeito que se fala e do que a transcrição de áudio erra).
const GENERICAS = new Set(('a o as os um uma de da do das dos na no em para pra pro por com que eu tu ele ela minha meu minhas meus essa esse '
  + 'tarefa tareza tarefas demanda demandas peca pecas card cards reels post posts carrossel story video arte atividade job trabalho '
  + 'tenho to estou tava hoje agora amanha cliente clientes coloque coloca colocar muda mude mudar passa passe marca marque bota bote '
  + 'deixa deixe poe ponha atualiza status como vou iniciar comecar comecando fazendo andamento execucao nao e era disse falei quis '
  + 'dizer isso aquela aquele sim ok certo vybe ia ja furar furo atrasar atrasada gravando gravou gravacao captacao captando '
  + 'data janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro').split(' '));
// Forma "pelo som" (Reriston, 27/10/2026: o áudio escreveu "Bruce Lou" para Brussolo): c/ç/z/ss viram s, ou vira o,
// letras dobradas viram uma, sem acento.
const pelaFala = (w) => semAcento(w).replace(/ph/g, 'f').replace(/ch/g, 'x').replace(/lh/g, 'l').replace(/nh/g, 'n').replace(/qu/g, 'k')
  .replace(/c(?=[ei])/g, 's').replace(/c/g, 'k').replace(/[zç]/g, 's').replace(/ou/g, 'o').replace(/w/g, 'v').replace(/y/g, 'i').replace(/(.)\1+/g, '$1');
const pares = (t) => { const m = new Map(); for (let i = 0; i < t.length - 1; i++) { const x = t.slice(i, i + 2); m.set(x, (m.get(x) || 0) + 1); } return m; };
const parecido = (a, b) => { const ma = pares(a), mb = pares(b); let c = 0; for (const [x, n] of ma) c += Math.min(n, mb.get(x) || 0); const t = Math.max(0, a.length - 1) + Math.max(0, b.length - 1); return t ? (2 * c) / t : 0; };
// Peça sem número (Reriston, 27/10/2026: "coloque a tarefa que eu tenho hoje do Brussolo como em andamento"): procura só
// entre as peças abertas em que a própria pessoa é responsável. Cada palavra que sobra (cliente, pedaço do título) conta
// ponto se bate pelo começo ou pelo som com o cliente ou o título; duas palavras juntas também ("bruce lou" = brusolo).
// A peça com mais pontos, se for só uma, segue para a confirmação; empate vira lista com o número; nada, diz isso.
async function pecaDaPessoaPorBusca(sql, pessoaId, busca, { comoHead = false, recentes = false, todas = false } = {}) {
  const termos = semAcento(busca).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((x) => x.length >= 3 && !GENERICAS.has(x));
  if (!termos.length) throw invalido('Diga o cliente ou um pedaço do título da peça (ou o número dela).');
  const consultas = [...termos.map((t) => [t]), ...termos.slice(1).map((t, i) => [termos[i], t])];
  const linhas = await sql`SELECT c.id::text AS id, c.monday_item_id::text AS monday_item_id, c.titulo, c.prazo::text AS prazo,
      c.veiculacao::text AS veiculacao, s.rotulo AS status,
      COALESCE(ARRAY(SELECT cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id WHERE cc.conteudo_id = c.id), '{}') AS clientes
    FROM vybe_conteudos c LEFT JOIN vybe_status s ON s.board_id = c.board_id AND s.chave = c.status_chave
    WHERE c.removido_em IS NULL
      -- Alteração e comentário também valem para a peça já agendada que veicula de ontem em diante (Ewerton, 27/10/2026:
      -- "a agenda de hoje" já estava agendada e não aparecia na lista).
      AND (NOT COALESCE(s.final, false) OR (${recentes} AND c.veiculacao >= (now() AT TIME ZONE 'America/Bahia')::date - 1))
      -- Quem faz captação (Mizinho) procura em todas as peças: a captação não é dele como responsável.
      AND (${todas} OR EXISTS (SELECT 1 FROM vybe_conteudo_responsaveis r WHERE r.conteudo_id = c.id AND r.pessoa_id = ${pessoaId})
        -- Captação: o head do cliente também acha as peças dos clientes dele (Ewerton, 27/10/2026: "o reels da MR Fit").
        OR (${comoHead} AND EXISTS (SELECT 1 FROM vybe_conteudo_clientes cc JOIN vybe_cliente_pessoas h ON h.cliente_id = cc.cliente_id
          WHERE cc.conteudo_id = c.id AND h.pessoa_id = ${pessoaId})))
    ORDER BY c.prazo NULLS LAST, c.id LIMIT 200`;
  const pontos = (l) => {
    const palavras = semAcento(l.titulo + ' ' + l.clientes.join(' ')).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((x) => x.length >= 3);
    const alvos = [...palavras, ...palavras.slice(1).map((w, i) => palavras[i] + w)];
    let n = 0;
    for (const q of consultas) {
      const junto = q.join(''), som = pelaFala(junto);
      const bate = alvos.some((w) => w.startsWith(junto.slice(0, Math.max(4, Math.ceil(junto.length * 0.6)))) || parecido(som, pelaFala(w)) >= 0.6);
      if (bate) n += q.length;
    }
    return n;
  };
  const notas = linhas.map((l) => ({ l, n: pontos(l) })).filter((x) => x.n > 0);
  const melhor = Math.max(0, ...notas.map((x) => x.n));
  let achadas = notas.filter((x) => x.n === melhor).map((x) => x.l);
  // Empate: o formato falado desempata ("o reels da MR Fit" entre o card e o reels do mesmo cliente).
  const formato = ['reels', 'card', 'carrossel', 'story', 'video', 'motion', 'foto', 'feed'].find((f) => semAcento(busca).split(/[^a-z0-9]+/).some((w) => w.startsWith(f)));
  if (achadas.length > 1 && formato) { const doFormato = achadas.filter((l) => semAcento(l.titulo).startsWith(formato)); if (doFormato.length) achadas = doFormato; }
  // Data falada desempata também ("a agenda musical de 29/10").
  // "24 de outubro" vale como 24/10 (Ewerton, 27/10/2026: "vídeo com data de 24 de outubro").
  const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const porExtenso = /\b(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.exec(semAcento(busca));
  const data = /\b(\d{1,2})\/(\d{1,2})\b/.exec(busca) || (porExtenso ? [porExtenso[0], porExtenso[1], String(MESES.indexOf(porExtenso[2]) + 1)] : null);
  if (achadas.length > 1 && data) { const dm = data[1].padStart(2, '0') + '/' + data[2].padStart(2, '0'); const doDia = achadas.filter((l) => curtoDia(l.veiculacao) === dm); if (doDia.length) achadas = doDia; }
  const pedido = termos.join(' ');
  if (!achadas.length) throw invalido(`Não achei peça aberta sua (nem dos clientes em que você é head) com "${pedido.slice(0, 60)}". Responda com o nome do cliente ou o número da peça (o do link).`);
  // Várias (Ewerton, 27/10/2026: cinco "Agenda Musical" da Gonzalez): em ordem de veiculação, com o dia da semana e o status,
  // numeradas, e a próxima a veicular marcada; a resposta pode ser a posição, a data ou "a próxima".
  if (achadas.length > 1) {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());
    const ordem = [...achadas].sort((a, b) => String(a.veiculacao || '9999').localeCompare(String(b.veiculacao || '9999')));
    const proxima = ordem.find((l) => l.veiculacao && String(l.veiculacao).slice(0, 10) >= hoje);
    throw invalido(`🔎 Achei ${achadas.length} peças com "${pedido.slice(0, 60)}". Qual delas?\n` +
      ordem.slice(0, 8).map((l, i) => `${i + 1}. ${l === proxima ? '⭐ ' : ''}${l.titulo || 'Sem título'} (${l.clientes.join(' / ') || 'sem cliente'})` +
        ` · ${l.veiculacao ? 'veicula ' + semanaCurta(l.veiculacao) + ' ' + curtoDia(l.veiculacao) + (String(l.veiculacao).slice(0, 10) === hoje ? ' (hoje)' : '') : 'sem veiculação'} · ${l.status || 'sem status'} · nº ${l.monday_item_id || 'vybe:' + l.id}`).join('\n') +
      `\n\nResponda citando esta mensagem com a posição (ex.: *1*)${proxima ? `, a data (ex.: *${curtoDia(proxima.veiculacao)}*) ou *a próxima* (⭐)` : ' ou o nº'}.`);
  }
  return achadas[0].monday_item_id || 'vybe:' + achadas[0].id;
}
const curtoDia = (iso) => (iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) : '');
const semanaCurta = (iso) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(String(iso).slice(0, 10) + 'T12:00:00Z').getUTCDay()];
// Quem faz o próximo passo (Paulo, 27/10/2026: "sempre que o JARVIS deixar um comentário, marca quem tem que fazer"):
// os responsáveis da peça, menos quem pediu. No comentário do painel vai "@Nome"; para o bot, o marcador
// {{pessoa:ID:Nome}}, que ele troca pela menção do WhatsApp (ou pelo nome, se a pessoa não estiver na conversa).
async function proximoPassoDe(sql, c, pessoaId) {
  try {
    return (await sql`SELECT p.nome, p.monday_user_id::text AS monday_id FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id
      WHERE r.conteudo_id = ${Number(c.id)} AND p.id <> ${Number(pessoaId)} ORDER BY r.ordem`).filter((x) => x.nome);
  } catch { return []; }
}
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0];
const linhaPainel = (ps) => (ps.length ? `\n\n👉 Próximo passo: ${ps.map((x) => '@' + primeiroNome(x.nome)).join(', ')}` : '');
const linhaBot = (ps) => (ps.length ? `\n👉 Próximo passo: ${ps.map((x) => (x.monday_id ? `{{pessoa:${x.monday_id}:${primeiroNome(x.nome)}}}` : primeiroNome(x.nome))).join(', ')}` : '');
async function temFuncao(sql, pessoaId, funcao) {
  const [t] = await sql`SELECT to_regclass('public.vybe_escritorio_funcoes') IS NOT NULL AS ok`;
  if (!t?.ok) return false;
  const [f] = await sql`SELECT 1 AS ok FROM vybe_escritorio_funcoes WHERE pessoa_id = ${pessoaId} AND funcao = ${funcao}`;
  return Boolean(f);
}
// Mesma regra dos avisos de status (assistente-avisos.js): quem aprova a peça.
function aprovadores(c) {
  const P = vm.runInContext('PESSOAS', codigoDoPainel().ctx);
  if (ehVideo(c)) return { pessoas: c.heads, monday: c.heads.length ? [] : [P.VINICIUS, P.EWERTON_L].filter(Boolean).map(String) };
  return { pessoas: [], monday: [P.DEIVID].filter(Boolean).map(String) };
}
async function conferirPermissao(sql, p, c, alvo) {
  if (p.admin) return;
  const { ctx } = codigoDoPainel();
  const fluxo = (rotulo) => normal(ctx.operationalFlowStatus({ status: rotulo || '', board_id: Number(c.board_id) }));
  const de = fluxo(c.status), para = fluxo(alvo.rotulo);
  if (['para aprovacao', 'em aprovacao'].includes(de)) {
    const a = aprovadores(c);
    if (a.pessoas.includes(p.id) || (p.monday_id && a.monday.includes(p.monday_id))) return;
    throw negar('Esta peça está em aprovação: só quem aprova pode decidir o próximo status.');
  }
  if (['agendado', 'publicado', 'postado'].includes(para)) {
    if (await temFuncao(sql, p.id, 'agendamento')) return;
    throw negar('Marcar como agendado ou publicado é de quem faz o agendamento.');
  }
  if (['para aprovacao', 'em aprovacao'].includes(para)) {
    if (c.responsaveis.includes(p.id)) return;
    throw negar('Só os responsáveis da peça mandam para aprovação.');
  }
  throw negar('Essa mudança de status é só pelo painel ou com a administração.');
}
// Campo Captação (Paulo, 27/10/2026): é separado do status e é gatilho das automações do painel ("Captação Feita"
// muda o grupo e passa para quem edita). Pelo WhatsApp: "tá gravando" = Captação em Andamento, "gravou" = Captação
// Feita. Pode quem toca a peça: responsáveis, heads do cliente, função captação, administração.
async function captacaoDaPeca(sql, c, para) {
  const lista = await sql`SELECT chave, rotulo FROM vybe_captacao`;
  const p = normal(para), k = comoChave(para);
  const alvo = lista.find((s) => s.chave === String(para)) || lista.find((s) => normal(s.rotulo) === p) || lista.find((s) => comoChave(s.rotulo) === k);
  if (!alvo) throw invalido(`Captação "${String(para).slice(0, 40)}" não existe. Opções: ${lista.map((s) => s.rotulo).join(', ')}.`);
  const [atual] = await sql`SELECT k.rotulo FROM vybe_conteudos x LEFT JOIN vybe_captacao k ON k.chave = x.captacao_chave WHERE x.id = ${Number(c.id)}`;
  return { alvo, atual: atual?.rotulo || '' };
}
async function conferirPermissaoCaptacao(sql, p, c) {
  if (p.admin || c.responsaveis.includes(p.id) || c.heads.includes(p.id) || await temFuncao(sql, p.id, 'captacao') || await temFuncao(sql, p.id, 'producao')) return;
  throw negar('A captação desta peça é de quem é responsável por ela, dos heads do cliente ou de quem faz captação.');
}
async function statusDoQuadro(sql, c, para) {
  const lista = await sql`SELECT chave, rotulo FROM vybe_status WHERE board_id = ${c.board_id}`;
  const p = normal(para), k = comoChave(para);
  const alvo = lista.find((s) => s.chave === String(para)) || lista.find((s) => normal(s.rotulo) === p) || lista.find((s) => comoChave(s.rotulo) === k);
  if (!alvo) throw invalido(`Status "${String(para).slice(0, 40)}" não existe neste quadro. Opções: ${lista.map((s) => s.rotulo).join(', ')}.`);
  return alvo;
}

// Prazo realista (Paulo, 27/10/2026): quanto esse formato costuma levar da criação até ir para aprovação, nos últimos
// 120 dias (com a pessoa, se tiver responsável e histórico dela; senão, o time todo). Mediana de 5+ peças; prazo da
// equipe abaixo de 60% disso vira um aviso no resumo (a criação continua permitida).
export function avisoDePrazo({ amostras, diasDisponiveis, formato, nome }) {
  const ds = amostras.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (ds.length < 5) return null;
  const mediana = ds[Math.floor(ds.length / 2)];
  if (diasDisponiveis >= mediana * 0.6 || mediana < 1) return null;
  const d = Math.max(1, Math.round(mediana));
  return `⏱️ ${formato}${nome ? ' com ' + nome : ''} costuma levar ~${d} dia(s) até ir para aprovação; esse prazo dá ${Math.max(0, diasDisponiveis)}. Quer ajustar a veiculação ou o responsável?`;
}
async function prazoRealista(sql, d, agora) {
  try {
    const amostrasDe = (mondayId) => sql`SELECT EXTRACT(EPOCH FROM (MIN(e2.em) - MIN(e1.em))) / 86400 AS dias
      FROM vybe_conteudos c JOIN vybe_conteudo_eventos e1 ON e1.conteudo_id = c.id AND e1.tipo = 'criacao'
      JOIN vybe_conteudo_eventos e2 ON e2.conteudo_id = c.id AND e2.tipo = 'status' AND e2.para ILIKE 'para aprova%'
      WHERE c.formato ILIKE ${d.formato + '%'} AND e1.em >= now() - interval '120 days'
        AND (${mondayId}::text IS NULL OR EXISTS (SELECT 1 FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = c.id AND p.monday_user_id::text = ${mondayId}::text))
      GROUP BY c.id`;
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date(agora));
    const diasDisponiveis = Math.round((Date.parse(d.prazo) - Date.parse(hoje)) / 864e5);
    let amostras = d.responsavel ? (await amostrasDe(d.responsavel.monday_id)).map((x) => Number(x.dias)) : [];
    let nome = d.responsavel ? d.responsavel.nome.split(' ')[0] : null;
    if (amostras.length < 5) { amostras = (await amostrasDe(null)).map((x) => Number(x.dias)); nome = null; }
    return avisoDePrazo({ amostras, diasDisponiveis, formato: d.formato, nome });
  } catch { return null; }
}

// Criar demanda na Produção, pelo mesmo cadastro do painel. Nome no padrão "Formato - Título" (vybe-nomenclatura);
// prazo da equipe 2 dias antes da veiculação (nunca antes de hoje). Cliente e responsável pelo nome, sem ambiguidade.
const FORMATOS = ['Card', 'Carrossel', 'Reels', 'Story', 'Fotografia', 'Feed', 'Vídeo', 'Motion'];
// Solicitações de Demandas (Taynara e Deivid, 29/10/2026: "arte para backdrop" não é conteúdo): o mesmo cadastro, no
// quadro de Solicitações, com o "Tipo de demanda" dele, sem veiculação e com o prazo de entrega obrigatório.
const COLUNA_TIPO_DEMANDA = 'dropdown_mkv8d52z';
async function montarCriacao(sql, pedido, agora) {
  const demandas = ['demandas', 'solicitacoes', 'solicitacao'].includes(normal(pedido.quadro));
  const board = demandas ? BOARD_DEMANDAS_CRIACAO : BOARD_PRODUCAO_CRIACAO;
  const titulo = String(pedido.titulo || '').replace(/\s+/g, ' ').trim();
  if (titulo.length < 3 || titulo.length > 150) throw invalido(demandas ? 'Diga o que é a demanda (3 a 150 letras).' : 'Diga o título da peça (3 a 150 letras).');
  let formato = null;
  if (demandas) {
    if (String(pedido.formato || '').trim()) {
      const tipos = await semErro(() => sql`SELECT chave, rotulo FROM vybe_opcoes WHERE coluna_id = ${COLUNA_TIPO_DEMANDA} ORDER BY indice`);
      formato = opcaoDaLista(tipos, pedido.formato, 'Tipo de demanda').rotulo;
    }
  } else {
    formato = FORMATOS.find((f) => normal(f) === normal(pedido.formato));
    if (!formato) throw invalido(`Formato desconhecido. Use: ${FORMATOS.join(', ')}.`);
  }
  const veiculacao = String(pedido.veiculacao || '');
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date(agora));
  if (!demandas && (!/^\d{4}-\d{2}-\d{2}$/.test(veiculacao) || veiculacao < hoje)) throw invalido('Diga a data de veiculação (hoje ou depois).');
  if (demandas && veiculacao && (!/^\d{4}-\d{2}-\d{2}$/.test(veiculacao) || veiculacao < hoje)) throw invalido('A data de veiculação tem que ser hoje ou depois.');
  if (demandas && !pedido.prazo) throw invalido('Diga o prazo de entrega da demanda.');
  const menos2 = veiculacao ? new Date(Date.parse(veiculacao + 'T12:00:00Z') - 2 * 864e5).toISOString().slice(0, 10) : hoje;
  const prazo = menos2 < hoje ? hoje : menos2;
  const clientes = await sql`SELECT nome FROM vybe_clientes WHERE COALESCE(ativo, true) AND nome ILIKE ${'%' + String(pedido.cliente || '').trim() + '%'} ORDER BY nome LIMIT 5`;
  const cliente = clientes.length === 1 ? clientes[0] : clientes.find((c) => normal(c.nome) === normal(pedido.cliente));
  if (!String(pedido.cliente || '').trim() || !cliente) throw invalido(clientes.length ? `Mais de um cliente com esse nome: ${clientes.map((c) => c.nome).join(', ')}.` : 'Não achei esse cliente.');
  // Um ou mais responsáveis (o cadastro guiado pergunta "pra quem?"), cada um pelo nome, sem ambiguidade.
  const nomes = [...new Set([pedido.responsavel, ...(Array.isArray(pedido.responsaveis) ? pedido.responsaveis : [])]
    .map((n) => String(n || '').trim()).filter(Boolean))].slice(0, 5);
  const responsaveis = [];
  for (const n of nomes) {
    const ps = await sql`SELECT nome, monday_user_id::text AS monday_id FROM vybe_pessoas WHERE ativo IS TRUE AND monday_user_id IS NOT NULL AND nome ILIKE ${n + '%'} LIMIT 5`;
    const r = ps.length === 1 ? ps[0] : ps.find((x) => normal(x.nome) === normal(n));
    if (!r) throw invalido(ps.length ? `Mais de uma pessoa com esse nome: ${ps.map((p) => p.nome).join(', ')}.` : `Não achei o responsável "${n.slice(0, 40)}".`);
    if (!responsaveis.some((x) => x.monday_id === r.monday_id)) responsaveis.push(r);
  }
  const responsavel = responsaveis[0] || null;
  // Cadastro guiado (Paulo, 28/10/2026: "qual grupo, qual status, qual status de captação, pra quem, qual veiculação,
  // qual prazo"): cada campo só entra quando vem no pedido e é conferido contra o que existe no quadro de Produção.
  let prazoFinal = prazo;
  if (pedido.prazo) {
    const pz = String(pedido.prazo);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pz) || pz < hoje) throw invalido('Diga o prazo da equipe (hoje ou depois).');
    if (veiculacao && pz > veiculacao) throw invalido('O prazo da equipe não pode passar da veiculação.');
    prazoFinal = pz;
  }
  const status = pedido.status ? opcaoDaLista(await sql`SELECT chave, rotulo FROM vybe_status WHERE board_id = ${board}`, pedido.status, 'Status') : null;
  if (demandas && pedido.captacao) throw invalido('Solicitações de Demandas não têm captação.');
  const captacao = pedido.captacao ? opcaoDaLista(await sql`SELECT chave, rotulo FROM vybe_captacao`, pedido.captacao, 'Captação') : null;
  let grupo = null;
  if (pedido.grupo) {
    const g = opcaoDaLista((await gruposDoQuadro(sql, board)).map((x) => ({ chave: x.grupo_id, rotulo: x.titulo })), pedido.grupo, 'Grupo');
    grupo = { id: g.chave, titulo: g.rotulo };
  }
  // Briefing junto (áudio do cliente pedindo peça nova, 27/10/2026): vai no campo de briefing da peça criada.
  const briefing = String(pedido.briefing || '').trim().slice(0, 3000);
  return { titulo: formato ? `${formato} - ${titulo}` : titulo, ...(formato ? { formato } : {}), cliente: cliente.nome, ...(veiculacao ? { veiculacao } : {}), prazo: prazoFinal, responsavel,
    ...(demandas ? { quadro: 'demandas' } : {}),
    ...(responsaveis.length > 1 ? { responsaveis } : {}), ...(status ? { status } : {}), ...(captacao ? { captacao } : {}), ...(grupo ? { grupo } : {}),
    ...(briefing ? { briefing } : {}) };
}
const BOARD_PRODUCAO_CRIACAO = 7829537690, BOARD_DEMANDAS_CRIACAO = 8385559107;
// Lista que falha (tabela ainda não criada neste banco) vira lista vazia, sem derrubar o resto.
async function semErro(consulta) { try { return await consulta(); } catch { return []; } }
// Escolha pela chave ou pelo rótulo, sem acento e sem caixa; fora da lista, diz as opções.
function opcaoDaLista(lista, valor, nome) {
  const v = normal(valor);
  const achada = lista.find((x) => normal(x.chave) === v) || lista.find((x) => normal(x.rotulo) === v);
  if (!achada) throw invalido(`${nome} desconhecido: "${String(valor).slice(0, 40)}". Opções: ${lista.map((x) => x.rotulo).join(', ')}.`);
  return { chave: achada.chave, rotulo: achada.rotulo };
}
// Opções do cadastro guiado no WhatsApp: as mesmas listas que o painel usa para a Produção.
export async function opcoesDeCriacao(sql) {
  const grupos = (b) => gruposDoQuadro(sql, b).then((l) => l.map((g) => ({ chave: g.grupo_id, rotulo: g.titulo }))).catch(() => []);
  const status = (b) => semErro(() => sql`SELECT chave, rotulo FROM vybe_status WHERE board_id = ${b} ORDER BY ordem, monday_index`);
  const [gp, sp, captacao, pessoas, gd, sd, tipos] = await Promise.all([
    grupos(BOARD_PRODUCAO_CRIACAO), status(BOARD_PRODUCAO_CRIACAO),
    semErro(() => sql`SELECT chave, rotulo FROM vybe_captacao ORDER BY monday_index`),
    semErro(() => sql`SELECT nome FROM vybe_pessoas WHERE ativo IS TRUE AND monday_user_id IS NOT NULL ORDER BY nome`),
    grupos(BOARD_DEMANDAS_CRIACAO), status(BOARD_DEMANDAS_CRIACAO),
    semErro(() => sql`SELECT chave, rotulo FROM vybe_opcoes WHERE coluna_id = ${COLUNA_TIPO_DEMANDA} ORDER BY indice`),
  ]);
  // Produção no nível de cima (compatível com o bot de antes); Solicitações em "demandas".
  return { grupos: gp, status: sp, captacao, pessoas: pessoas.map((p) => p.nome), demandas: { grupos: gd, status: sd, tipos } };
}

export async function prepararAcao(sql, pessoaId, pedido, segredo, agora = Date.now()) {
  if (!/^.{32,}$/.test(String(segredo || ''))) throw Object.assign(new Error('Ações indisponíveis.'), { status: 503 });
  const { acao, item } = pedido || {};
  if (!['status', 'comentar', 'criar', 'captacao', 'alteracao', 'regra', 'responsavel', 'agendar_captacao'].includes(acao)) throw invalido('Ação desconhecida.');
  if (acao === 'agendar_captacao') {
    // Encaixe de captação sugerido: marca na agenda (um evento por cliente). Administração ou quem faz captação.
    const p = await pessoaAtiva(sql, pessoaId), cod = String(pedido.encaixe || '');
    if (!/^\d{4}-\d{2}-\d{2}\|\d{1,18}@\d{2}:\d{2}-\d{2}:\d{2}(?:,\d{1,18}@\d{2}:\d{2}-\d{2}:\d{2}){0,3}$/.test(cod)) throw invalido('Encaixe inválido.');
    if (!p.admin && !(await temFuncao(sql, p.id, 'captacao')) && !(await temFuncao(sql, p.id, 'producao'))) throw negar('Marcar captação na agenda é da administração ou de quem faz captação.');
    const [dia, lista] = cod.split('|');
    const itens = lista.split(',').map((x) => { const [id, h] = x.split('@'); return { id, h }; });
    const nomes = await sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE id = ANY(${itens.map((x) => x.id)}::bigint[])`;
    const resumo = `📅 Marcar captação na agenda em ${dia.slice(8, 10)}/${dia.slice(5, 7)}:\n` + itens.map((x) => `- ${(nomes.find((n) => n.id === x.id) || {}).nome || 'cliente'} · ${x.h.replace('-', ' às ')}`).join('\n');
    const dados = b64(JSON.stringify({ p: p.id, c: null, a: 'agendar_captacao', v: cod, de: '', e: agora + VALIDADE_MS }));
    return { resumo, codigo: dados + '.' + assinar(dados, segredo), link: null, validade_min: 5 };
  }
  if (acao === 'regra') {
    // Regra do cliente: pela peça (cliente dela) ou pelo nome do cliente. Quem pode: administração e heads do cliente.
    const p = await pessoaAtiva(sql, pessoaId);
    const texto = String(pedido.texto || '').replace(/\s+/g, ' ').trim();
    if (texto.length < 3 || texto.length > 500) throw invalido('Diga a regra (até 500 caracteres).');
    let cliente = null;
    if (item) {
      const c = await pecaPorReferencia(sql, item);
      [cliente] = await sql`SELECT cl.id::text AS id, cl.nome FROM vybe_conteudo_clientes cc JOIN vybe_clientes cl ON cl.id = cc.cliente_id
        WHERE cc.conteudo_id = ${Number(c.id)} ORDER BY cl.nome LIMIT 1`;
    } else {
      const nome = String(pedido.cliente || pedido.busca || '').trim();
      const achados = nome.length >= 2 ? await sql`SELECT id::text AS id, nome FROM vybe_clientes WHERE COALESCE(ativo, true) AND nome ILIKE ${'%' + nome + '%'} ORDER BY nome LIMIT 5` : [];
      cliente = achados.length === 1 ? achados[0] : achados.find((x) => normal(x.nome) === normal(nome)) || null;
      if (!cliente) throw invalido(achados.length ? `Mais de um cliente com "${nome}": ${achados.map((x) => x.nome).join(', ')}.` : `Não achei o cliente "${nome.slice(0, 60)}".`);
    }
    if (!cliente) throw invalido('Essa peça não tem cliente.');
    const [head] = await sql`SELECT 1 AS ok FROM vybe_cliente_pessoas WHERE cliente_id = ${Number(cliente.id)} AND pessoa_id = ${Number(p.id)}`;
    if (!p.admin && !head) throw negar('Regra do cliente é com a administração ou com os heads do cliente.');
    const resumo = `📌 Regra para as próximas peças da *${cliente.nome}*:\n“${texto}”\n(entra nas legendas, nas revisões de arte e na memória do cliente)`;
    const dados = b64(JSON.stringify({ p: p.id, c: null, a: 'regra', v: { cliente: cliente.id, nome: cliente.nome, t: texto }, de: '', e: agora + VALIDADE_MS }));
    return { resumo, codigo: dados + '.' + assinar(dados, segredo), link: null, validade_min: 5 };
  }
  if (acao === 'criar') {
    const p = await pessoaAtiva(sql, pessoaId), d = await montarCriacao(sql, pedido, agora), aviso = await prazoRealista(sql, d, agora);
    const curto = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
    const quem = (d.responsaveis || (d.responsavel ? [d.responsavel] : [])).map((x) => x.nome.split(' ')[0]).join(', ');
    const campos = [d.grupo && '📁 ' + d.grupo.titulo, d.status && '🚦 ' + d.status.rotulo, d.captacao && '🎬 ' + d.captacao.rotulo].filter(Boolean).join(' · ');
    const resumo = `🆕 Criar ${d.quadro === 'demandas' ? 'em Solicitações de Demandas' : 'na Produção'}:\n*${d.titulo}* (${d.cliente})\n${d.veiculacao ? 'veicula ' + curto(d.veiculacao) + ' · ' : ''}${d.quadro === 'demandas' ? 'prazo de entrega' : 'prazo da equipe'} ${curto(d.prazo)}${quem ? ' · ' + quem : ' · sem responsável'}${campos ? '\n' + campos : ''}${d.briefing ? '\n📝 Briefing: “' + d.briefing.slice(0, 300) + (d.briefing.length > 300 ? '…' : '') + '”' : ''}${aviso ? '\n' + aviso : ''}`;
    const dados = b64(JSON.stringify({ p: p.id, c: null, a: 'criar', v: d, de: '', e: agora + VALIDADE_MS }));
    return { resumo, codigo: dados + '.' + assinar(dados, segredo), link: null, validade_min: 5 };
  }
  const p = await pessoaAtiva(sql, pessoaId);
  const c = await pecaPorReferencia(sql, item || (pedido.busca ? await pecaDaPessoaPorBusca(sql, Number(p.id), pedido.busca, { comoHead: true, recentes: ['alteracao', 'comentar'].includes(acao),
    todas: acao === 'captacao' && (await temFuncao(sql, Number(p.id), 'captacao') || await temFuncao(sql, Number(p.id), 'producao')) }) : item));
  const nome = `"${c.titulo || 'Sem título'}" (${c.clientes.join(' / ') || 'sem cliente'})`;
  let resumo, valor;
  if (acao === 'comentar') {
    const texto = String(pedido.texto || '').replace(/\s+/g, ' ').trim();
    if (!texto || texto.length > 1000) throw invalido('Escreva o comentário (até 1000 caracteres).');
    resumo = `💬 Comentar em ${nome}:\n“${texto}”`; valor = texto;
  } else if (acao === 'responsavel') {
    // Redistribuir (sugestão da sobrecarga): troca um responsável por outro, pela mesma função do painel. Só administração.
    if (!p.admin) throw negar('Trocar responsável pelo WhatsApp é só com a administração.');
    const atuais = await sql`SELECT p.monday_user_id::text AS id, p.nome FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id
      WHERE r.conteudo_id = ${Number(c.id)} AND p.monday_user_id IS NOT NULL ORDER BY r.ordem`;
    const quem = (lista, v) => { const t = normal(v); return lista.filter((x) => x.id === String(v) || normal(x.nome) === t || normal(x.nome).split(/\s+/)[0] === t); };
    const de = quem(atuais, pedido.de);
    if (de.length !== 1) throw invalido(`${String(pedido.de || '').slice(0, 40)} não é responsável por ${nome}.`);
    const ativos = await sql`SELECT monday_user_id::text AS id, nome FROM vybe_pessoas WHERE ativo IS TRUE AND monday_user_id IS NOT NULL`;
    const para = quem(ativos, pedido.para);
    if (para.length !== 1) throw invalido(para.length ? `Mais de uma pessoa com "${pedido.para}". Use o nome completo.` : `Não achei "${String(pedido.para || '').slice(0, 40)}" na equipe.`);
    const nova = [...new Set(atuais.map((x) => (x.id === de[0].id ? para[0].id : x.id)))];
    resumo = `👥 Trocar responsável de ${nome}\nde *${de[0].nome}* para *${para[0].nome}*`; valor = JSON.stringify({ de: de[0].id, lista: nova, nome: para[0].nome });
  } else if (acao === 'alteracao') {
    // Pedido de alteração (Ewerton, 27/10/2026: "adicione uma alteração na agenda musical do Gonzalez alterando a quarta
    // para Maria Luísa e a sexta para Greyce Pires"): o pedido vira comentário na peça e, se a pessoa pode mexer no
    // status (mesma regra das outras trocas), a peça vai para Alteração. Sem permissão, fica só o comentário.
    const texto = String(pedido.texto || '').replace(/\s+/g, ' ').trim();
    if (!texto || texto.length > 1000) throw invalido('Diga o que precisa mudar (até 1000 caracteres).');
    let alvo = null;
    try { alvo = await statusDoQuadro(sql, c, 'Alteração'); if (normal(alvo.rotulo) === normal(c.status)) alvo = null; else await conferirPermissao(sql, p, c, alvo); }
    catch { alvo = null; }
    resumo = `🔧 Pedido de alteração em ${nome}:\n“${texto}”\n` + (alvo ? `e status de *${c.status || 'sem status'}* para *${alvo.rotulo}*`
      : `(fica registrado como comentário na peça; o status segue *${c.status || 'sem status'}*)`);
    const dados = b64(JSON.stringify({ p: p.id, c: c.id, a: acao, v: { t: texto, s: alvo?.chave || null }, de: c.status || '', e: agora + VALIDADE_MS }));
    return { resumo, codigo: dados + '.' + assinar(dados, segredo), link: linkDaAtividade(c.ref), validade_min: 5 };
  } else if (acao === 'captacao') {
    const { alvo, atual } = await captacaoDaPeca(sql, c, pedido.para);
    if (normal(alvo.rotulo) === normal(atual)) throw invalido(`A captação já está em ${alvo.rotulo}.`);
    await conferirPermissaoCaptacao(sql, p, c);
    resumo = `🎬 Captação de ${nome}\nde *${atual || 'vazia'}* para *${alvo.rotulo}*\n(o status segue as automações do painel)`; valor = alvo.chave;
    const dados = b64(JSON.stringify({ p: p.id, c: c.id, a: acao, v: valor, de: atual, e: agora + VALIDADE_MS }));
    return { resumo, codigo: dados + '.' + assinar(dados, segredo), link: linkDaAtividade(c.ref), validade_min: 5 };
  } else {
    const alvo = await statusDoQuadro(sql, c, pedido.para);
    if (normal(alvo.rotulo) === normal(c.status)) throw invalido(`A peça já está em ${alvo.rotulo}.`);
    await conferirPermissao(sql, p, c, alvo);
    resumo = `🔁 Mudar ${nome}\nde *${c.status || 'sem status'}* para *${alvo.rotulo}*`; valor = alvo.chave;
  }
  const dados = b64(JSON.stringify({ p: p.id, c: c.id, a: acao, v: valor, de: c.status || '', e: agora + VALIDADE_MS }));
  return { resumo, codigo: dados + '.' + assinar(dados, segredo), link: linkDaAtividade(c.ref), validade_min: 5 };
}

export async function confirmarAcao(sql, pessoaId, codigo, segredo, { agora = Date.now(), executar } = {}) {
  const [dados, assinatura] = String(codigo || '').split('.');
  const esperada = dados ? assinar(dados, segredo) : '';
  if (!dados || !assinatura || assinatura.length !== esperada.length || !timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) throw invalido('Confirmação inválida.');
  const t = JSON.parse(Buffer.from(dados, 'base64url').toString());
  if (String(t.p) !== String(pessoaId)) throw negar('Só quem pediu pode confirmar.');
  if (!(t.e > agora)) throw invalido('A confirmação expirou. Peça de novo.');
  if (t.a === 'agendar_captacao') {
    const p = await pessoaAtiva(sql, pessoaId);
    await sql`CREATE TABLE IF NOT EXISTS vybe_ai_acoes(codigo_hash char(64) PRIMARY KEY, pessoa_id bigint NOT NULL, conteudo_id bigint NOT NULL,
      acao text NOT NULL, valor text, criado_em timestamptz NOT NULL DEFAULT now())`;
    const hashCodigo = createHash('sha256').update(String(codigo)).digest('hex');
    const [nova] = await sql`INSERT INTO vybe_ai_acoes(codigo_hash, pessoa_id, conteudo_id, acao, valor) VALUES (${hashCodigo}, ${p.id}, 0, 'agendar_captacao', ${String(t.v)})
      ON CONFLICT (codigo_hash) DO NOTHING RETURNING codigo_hash`;
    if (!nova) throw invalido('Esta confirmação já foi usada.');
    const quem = { tipo: 'sessao', pessoa: { id: Number(p.id), email: p.email, nome: `${p.nome} (WhatsApp)`, admin: p.admin } };
    const n = await (executar?.marcarEncaixe || marcarEncaixe)(sql, quem, t.v);
    return { feito: `✅ ${n} captação(ões) marcada(s) na agenda da Vybe. O Mizinho recebe o lembrete 1 hora e 30 minutos antes.`, link: null };
  }
  if (t.a === 'regra') {
    const p = await pessoaAtiva(sql, pessoaId), d = t.v;
    await sql`CREATE TABLE IF NOT EXISTS vybe_ai_acoes(codigo_hash char(64) PRIMARY KEY, pessoa_id bigint NOT NULL, conteudo_id bigint NOT NULL,
      acao text NOT NULL, valor text, criado_em timestamptz NOT NULL DEFAULT now())`;
    const hashCodigo = createHash('sha256').update(String(codigo)).digest('hex');
    const [nova] = await sql`INSERT INTO vybe_ai_acoes(codigo_hash, pessoa_id, conteudo_id, acao, valor) VALUES (${hashCodigo}, ${p.id}, 0, 'regra', ${String(d.t).slice(0, 1000)})
      ON CONFLICT (codigo_hash) DO NOTHING RETURNING codigo_hash`;
    if (!nova) throw invalido('Esta confirmação já foi usada.');
    await tabelaRegras(sql);
    await sql`INSERT INTO vybe_ai_regras_cliente(cliente_id, texto, autor_id) VALUES (${Number(d.cliente)}, ${d.t}, ${Number(p.id)})`;
    return { feito: `✅ Regra guardada para *${d.nome}*: “${d.t}”. Entra nas legendas, nas revisões de arte e na memória do cliente.`, link: null };
  }
  if (t.a === 'criar') {
    const p = await pessoaAtiva(sql, pessoaId), d = t.v;
    await sql`CREATE TABLE IF NOT EXISTS vybe_ai_acoes(codigo_hash char(64) PRIMARY KEY, pessoa_id bigint NOT NULL, conteudo_id bigint NOT NULL,
      acao text NOT NULL, valor text, criado_em timestamptz NOT NULL DEFAULT now())`;
    const hashCodigo = createHash('sha256').update(String(codigo)).digest('hex');
    const [nova] = await sql`INSERT INTO vybe_ai_acoes(codigo_hash, pessoa_id, conteudo_id, acao, valor) VALUES (${hashCodigo}, ${p.id}, 0, 'criar', ${String(d.titulo).slice(0, 300)})
      ON CONFLICT (codigo_hash) DO NOTHING RETURNING codigo_hash`;
    if (!nova) throw invalido('Esta confirmação já foi usada.');
    const quem = { tipo: 'sessao', pessoa: { id: Number(p.id), email: p.email, nome: `${p.nome} (WhatsApp)`, admin: p.admin } };
    const fazer = executar || await import('../api/conteudo.js');
    const r = await fazer.criarConteudo(sql, quem, { titulo: d.titulo, cliente: d.cliente, ...(d.formato ? { formato: d.formato } : {}), ...(d.veiculacao ? { veiculacao: d.veiculacao } : {}), prazo: d.prazo, ...(d.briefing ? { briefing: d.briefing } : {}),
      ...(d.quadro === 'demandas' ? { board: BOARD_DEMANDAS_CRIACAO } : {}),
      ...(d.status ? { status: d.status.chave } : {}), ...(d.grupo ? { grupo_id: d.grupo.id } : {}),
      responsaveis: (d.responsaveis || (d.responsavel ? [d.responsavel] : [])).map((x) => x.monday_id) });
    const ref = r?.item_id || (r?.conteudo_id ? 'vybe:' + r.conteudo_id : null);
    // Captação pela mesma troca do painel (chave, rótulo e gatilhos), logo depois de criar.
    let semCaptacao = '';
    if (d.captacao && ref) {
      try { await fazer.trocarEscolha(sql, quem, { item: ref, campo: 'captacao', para: d.captacao.chave }); }
      catch { semCaptacao = `\n⚠️ A captação (${d.captacao.rotulo}) não foi marcada; marque no painel.`; }
    }
    return { feito: `✅ Criada: *${d.titulo}* (${d.cliente}).${semCaptacao}`, link: ref ? linkDaAtividade(ref) : null };
  }
  const p = await pessoaAtiva(sql, pessoaId), c = await pecaPorReferencia(sql, 'vybe:' + t.c);
  // A peça mudou entre o pedido e o SIM: não executa sobre um estado que a pessoa não viu.
  if ((t.a === 'status' || (t.a === 'alteracao' && t.v?.s)) && normal(c.status) !== normal(t.de)) throw invalido(`A peça mudou para ${c.status} enquanto isso. Peça de novo.`);
  if (t.a === 'status') await conferirPermissao(sql, p, c, await statusDoQuadro(sql, c, t.v));
  if (t.a === 'alteracao' && t.v?.s) await conferirPermissao(sql, p, c, await statusDoQuadro(sql, c, t.v.s));
  if (t.a === 'captacao') {
    const { atual } = await captacaoDaPeca(sql, c, t.v);
    if (normal(atual) !== normal(t.de)) throw invalido(`A captação mudou para ${atual || 'vazia'} enquanto isso. Peça de novo.`);
    await conferirPermissaoCaptacao(sql, p, c);
  }
  // Uso único (e registro de quem fez o quê pelo WhatsApp).
  await sql`CREATE TABLE IF NOT EXISTS vybe_ai_acoes(codigo_hash char(64) PRIMARY KEY, pessoa_id bigint NOT NULL, conteudo_id bigint NOT NULL,
    acao text NOT NULL, valor text, criado_em timestamptz NOT NULL DEFAULT now())`;
  const hashCodigo = createHash('sha256').update(String(codigo)).digest('hex');
  const [nova] = await sql`INSERT INTO vybe_ai_acoes(codigo_hash, pessoa_id, conteudo_id, acao, valor) VALUES (${hashCodigo}, ${p.id}, ${c.id}, ${t.a}, ${String(typeof t.v === 'object' ? t.v?.t : t.v).slice(0, 1000)})
    ON CONFLICT (codigo_hash) DO NOTHING RETURNING codigo_hash`;
  if (!nova) throw invalido('Esta confirmação já foi usada.');
  // Mesma sessão que o painel usa, identificada pela pessoa do vínculo.
  const quem = { tipo: 'sessao', pessoa: { id: Number(p.id), email: p.email, nome: `${p.nome} (WhatsApp)`, admin: p.admin } };
  const fazer = executar || await import('../api/conteudo.js');
  if (t.a === 'comentar') {
    const proximos = await proximoPassoDe(sql, c, p.id);
    await fazer.comentar(sql, quem, { item: c.ref, texto: t.v + linhaPainel(proximos) });
    return { feito: `✅ Comentário registrado em "${c.titulo}".${linhaBot(proximos)}`, link: linkDaAtividade(c.ref) };
  }
  if (t.a === 'responsavel') {
    const v = JSON.parse(t.v);
    const atuais = (await sql`SELECT p.monday_user_id::text AS id FROM vybe_conteudo_responsaveis r JOIN vybe_pessoas p ON p.id = r.pessoa_id WHERE r.conteudo_id = ${Number(c.id)}`).map((x) => x.id);
    if (!atuais.includes(v.de)) throw invalido('Os responsáveis mudaram enquanto isso. Peça de novo.');
    await fazer.trocarResponsaveis(sql, quem, { item: c.ref, pessoas: v.lista });
    return { feito: `✅ "${c.titulo}" agora é de *${v.nome}*.`, link: linkDaAtividade(c.ref) };
  }
  if (t.a === 'alteracao') {
    const proximos = await proximoPassoDe(sql, c, p.id);
    await fazer.comentar(sql, quem, { item: c.ref, texto: `🔧 Alteração pedida pelo WhatsApp: ${t.v.t}${linhaPainel(proximos)}` });
    const pedidoTxt = `“${String(t.v.t).slice(0, 300)}”`;
    if (!t.v.s) return { feito: `✅ Pedido de alteração registrado em "${c.titulo}": ${pedidoTxt}. Status segue *${c.status || 'sem status'}*.${linhaBot(proximos)}`, link: linkDaAtividade(c.ref) };
    const r = await fazer.trocarStatus(sql, quem, { item: c.ref, para: t.v.s });
    return { feito: `✅ Pedido de alteração registrado em "${c.titulo}": ${pedidoTxt}. Agora está em *${r?.para || t.v.s}*.${linhaBot(proximos)}`, link: linkDaAtividade(c.ref) };
  }
  if (t.a === 'captacao') {
    const r = await fazer.trocarEscolha(sql, quem, { item: c.ref, campo: 'captacao', para: t.v });
    // Como a peça ficou depois das automações (grupo, status, quem faz).
    const depois = await pecaPorReferencia(sql, 'vybe:' + c.id);
    const mudou = normal(depois.status) !== normal(c.status) ? ` Status: *${depois.status}*.` : ` Status segue *${depois.status || 'sem status'}*.`;
    return { feito: `✅ Captação de "${c.titulo}" agora está em *${r?.para || t.v}*.${mudou}${r?.automacoes?.length ? ' As automações do painel rodaram.' : ''}`,
      link: linkDaAtividade(c.ref), checagem: await checagemDaPeca(sql, depois) };
  }
  const r = await fazer.trocarStatus(sql, quem, { item: c.ref, para: t.v });
  return { feito: `✅ "${c.titulo}" agora está em *${r?.para || t.v}*.${r?.automacao_pendente ? '\n⚠️ A automação do status ficou pendente; confira no painel.' : ''}`, link: linkDaAtividade(c.ref),
    checagem: await checagemDaPeca(sql, c) };
}
