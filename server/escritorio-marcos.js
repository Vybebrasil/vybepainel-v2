// Conquistas da ficha em níveis (decisão do Paulo, 20/10/2026): cada escada
// sobe de Bronze para Prata, Ouro e Diamante, com metas altas, pensadas para
// meses de trabalho; há uma escada por tipo de entrega (Card, Reels,
// Carrossel…) e uma por função. As sociais (quarto, presente, troca…) têm um
// nível só. Metas e troféus ficam na tabela vybe_escritorio_trofeus
// (migrations/2026-10-20-escritorio-conquistas-niveis.sql); aqui fica só como
// cada número é contado. Cada nível alcançado dá a conquista (regra
// "conquista" × nível) e o troféu do nível, uma vez só, na mesma transação.
// A pessoa fica com todos os troféus da escada (Paulo, 20/10/2026: para expor
// no quarto a evolução, do Bronze ao Diamante).
import { nivelPorXp, diaBahia, somarDias, diaDaSemana } from './escritorio-pontos.js';

export const NIVEIS = ['', 'Bronze', 'Prata', 'Ouro', 'Diamante'];
// Títulos (Paulo, 21/10/2026: "títulos que ficam sob a cabeça do jogador:
// O Fazedor de Card, O Rei do Impresso, Máquina de Cards"). Cada nível de
// escada libera um; a pessoa escolhe qual mostrar (só os que tem).
export const TITULOS = {
  entregas: ['Mão na Massa', 'Produtivo', 'Incansável', 'Lenda da Vybe'],
  cards: ['Aprendiz de Cards', 'Fazedor de Cards', 'Máquina de Cards', 'Lenda dos Cards'],
  carrosseis: ['Montador de Carrossel', 'Arquiteto de Carrossel', 'Mestre do Carrossel', 'Rei do Carrossel'],
  reels: ['Cortador', 'Editor de Reels', 'Fábrica de Reels', 'Lenda dos Reels'],
  stories: ['Contador de Histórias', 'Rei dos Stories', 'Mestre dos Stories', 'Lenda dos Stories'],
  fotografias: ['Retocador', 'Tratador de Fotos', 'Mestre da Edição', 'Lenda da Foto'],
  videos: ['Editor', 'Montador de Vídeo', 'Cineasta', 'Lenda do Vídeo'],
  impressos: ['Gráfico', 'Mestre da Gráfica', 'Rei do Impresso', 'Imperador do Impresso'],
  implementacoes: ['Construtor Digital', 'Implementador', 'Arquiteto Digital', 'Mestre das Implementações'],
  motions: ['Animador', 'Designer de Movimento', 'Mestre do Motion', 'Lenda do Motion'],
  nivel: ['Experiente', 'Veterano', 'Elite', 'Mítico'],
  adiantado: ['Pontual', 'Adiantado', 'Relâmpago', 'Senhor do Tempo'],
  deprimeira: ['Caprichoso', 'Certeiro', 'Sem Alteração', 'Perfeição'],
  embalo: ['Aquecendo', 'Pegando Fogo', 'Em Chamas', 'Imparável'],
  clientes: ['Multitarefa', 'Polivalente', 'Faz de Tudo', 'Onipresente'],
  semana: ['Semana Limpa', 'Sem Atraso', 'Relógio Suíço', 'Impecável'],
  filaemdia: ['Organizado', 'Fila em Dia', 'Zero Pendência', 'Inabalável'],
  meta: ['Bateu a Meta', 'Constante', 'Consistente', 'Infalível'],
  meta_turbo: ['Turbinado', 'Acelerado', 'Foguete', 'Supersônico'],
  podio: ['No Pódio', 'Medalhista', 'Campeão', 'Dinastia'],
  artilheiro: ['Artilheiro', 'Craque', 'Camisa 10', 'Bola de Ouro'],
  painel: ['Presente', 'Ligado', 'Conectado', 'Onipresente no Painel'],
  da: ['Olho Crítico', 'Diretor', 'Diretor de Arte Sênior', 'O Crivo'],
  agendamento: ['Postador', 'Agendador Nato', 'Relógio da Postagem', 'Nunca Atrasa'],
  carteira: ['Anfitrião', 'Guardião de Clientes', 'Head de Ouro', 'Lenda do Atendimento'],
  cadastros: ['Cadastrador', 'Organizador', 'Arquivista', 'Mestre do Cadastro'],
  gravacoes: ['Na Rua', 'Rodado', 'Estrada', 'Lenda das Gravações'],
  fotos_captadas: ['Olho Treinado', 'Caçador de Luz', 'Mestre da Lente', 'Lenda da Câmera'],
  videos_captados: ['Câmera na Mão', 'Diretor de Cena', 'Mestre da Captação', 'Lenda do Set'],
  briefings: ['Escritor', 'Roteirista', 'Mente Criativa', 'O Visionário'],
  agencia: ['Guardião', 'Comandante', 'General', 'Dono do Jogo'],
  planejamentos: ['Planejador', 'Estrategista', 'Mestre do Plano', 'Visionário do Mês'],
  jogos: ['Jogador de Mesa', 'Competidor', 'Rei da Mesa', 'Lenda das Mesas'],
  quarto: ['Decorador'], andar2: ['Construtor'], presente: ['Generoso'], troca: ['Negociante'], postits: ['Recadeiro'],
};
const TIPO_TITULO = { cards: 'Cards', carrosseis: 'Carrosséis', reels: 'Reels', stories: 'Stories', fotografias: 'Fotos' };
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
// O título da Copa de cada mês (marco "copa_2026_09:1"); vale como Diamante.
export function copaDoMarco(marco) {
  const m = String(marco).match(/^copa_(\d{4})_(\d{2})$/);
  return m ? { ano: m[1], mes: Number(m[2]), texto: `Campeão da Copa · ${MESES_CURTOS[Number(m[2]) - 1]}/${m[1].slice(2)}` } : null;
}
export function tituloDe(marco, nivel) {
  const copa = copaDoMarco(marco);
  if (copa) return copa.texto;
  const lista = TITULOS[marco];
  if (lista) return lista[Math.min(lista.length, Math.max(1, nivel)) - 1] || null;
  const m = String(marco).match(/^(agendados|carteira)_(\w+)$/);
  if (m) { const tipo = TIPO_TITULO[m[2]] || m[2]; return m[1] === 'agendados' ? [`Postador de ${tipo}`, `Agenda de ${tipo}`, `Mestre dos ${tipo} Postados`, `Lenda dos ${tipo} Postados`][nivel - 1] : [`Head de ${tipo}`, `Guardião de ${tipo}`, `Mestre de ${tipo}`, `Lenda de ${tipo}`][nivel - 1]; }
  return null;
}
// Notícias da semana na entrada do Escritório (Paulo, 21/10/2026): quem
// subiu de nível numa escada nos últimos 7 dias, com o título que ganhou.
export async function noticiasDaEquipe(sql, agora = new Date()) {
  if (!await marcosProntos(sql)) return [];
  const linhas = await sql`SELECT m.pessoa_id, p.nome, m.marco, m.em FROM vybe_escritorio_marcos m JOIN vybe_pessoas p ON p.id=m.pessoa_id
    WHERE m.em >= ${agora}::timestamptz - interval '7 days' AND p.ativo ORDER BY m.em DESC LIMIT 12`;
  return linhas.map((l) => { const { marco, nivel } = partesDoMarco(l.marco), m = MARCOS.find((x) => x.id === marco), copa = copaDoMarco(marco);
    if (copa) return { pessoa: String(l.pessoa_id), nome: l.nome, escada: 'Copa Vybe', nivel: 4, nomeNivel: '', titulo: copa.texto, copa: true, em: l.em };
    return m ? { pessoa: String(l.pessoa_id), nome: l.nome, escada: m.nome, nivel: MARCOS_SOCIAIS.has(marco) ? 0 : nivel, nomeNivel: MARCOS_SOCIAIS.has(marco) ? '' : NIVEIS[nivel] || '', titulo: tituloDe(marco, nivel), em: l.em } : null; }).filter(Boolean);
}
// Os títulos que a pessoa tem (um por nível alcançado, do maior para o menor).
export async function titulosDaPessoa(sql, pessoaId) {
  if (!await marcosProntos(sql)) return [];
  const feitos = await sql`SELECT marco FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId}`;
  return feitos.map((f) => { const { marco, nivel } = partesDoMarco(f.marco); const texto = tituloDe(marco, nivel); return texto ? { chave: f.marco, texto, nivel: copaDoMarco(marco) ? 4 : MARCOS_SOCIAIS.has(marco) ? 1 : nivel } : null; })
    .filter(Boolean).sort((a, b) => b.nivel - a.nivel || a.texto.localeCompare(b.texto, 'pt-BR'));
}
// Entregas de quem executou a peça (Criação e Produção): as escadas de entrega,
// ritmo e qualidade contam só elas. Gestão, Atendimento e Agendamento sobem
// pela escada da própria função (Paulo, 20/10/2026: "conquistas mais difíceis").
// Desde 20/10/2026 (Paulo: "o Mizinho não devia ganhar uma parcela?") a
// Produção tem escadas próprias, contadas por dia de gravação e por peça
// captada, e as peças dela não contam nas escadas da Criação.
const EXECUCAO = ['peca_criacao'];
// Formatos de cada escada de entrega (chave de vybe_escritorio_complexidade).
const FORMATOS = {
  cards: ['card', 'feed', 'post', 'avulso', 'feed/story'], carrosseis: ['carrossel'], reels: ['reels'],
  stories: ['story'], fotografias: ['fotografia'], videos: ['video', 'motion', 'capa videos'], impressos: ['impresso'], implementacoes: ['implementacao'], motions: ['motion'],
};
const NOME_TIPO = { cards: 'Cards', carrosseis: 'Carrosséis', reels: 'Reels', stories: 'Stories', fotografias: 'Fotografias' };
export const MARCOS = [
  { id: 'entregas', nome: 'Entregas', unidade: 'entregas', valor: (n) => n.total },
  { id: 'cards', nome: 'Cards', unidade: 'cards entregues', valor: (n) => n.formatos.cards },
  { id: 'carrosseis', nome: 'Carrosséis', unidade: 'carrosséis entregues', valor: (n) => n.formatos.carrosseis },
  { id: 'reels', nome: 'Reels', unidade: 'reels entregues', valor: (n) => n.formatos.reels },
  { id: 'stories', nome: 'Stories', unidade: 'stories entregues', valor: (n) => n.formatos.stories },
  { id: 'fotografias', nome: 'Fotografias', unidade: 'fotografias entregues', valor: (n) => n.formatos.fotografias },
  { id: 'videos', nome: 'Vídeos e motions', unidade: 'vídeos entregues', valor: (n) => n.formatos.videos },
  { id: 'impressos', nome: 'Impressos', unidade: 'impressos entregues', valor: (n) => n.formatos.impressos },
  { id: 'implementacoes', nome: 'Implementações', unidade: 'demandas de implementação concluídas', valor: (n) => n.formatos.implementacoes || 0 },
  { id: 'motions', nome: 'Motion', unidade: 'motions entregues', valor: (n) => n.formatos.motions || 0 },
  { id: 'nivel', nome: 'Nível', unidade: 'de nível', valor: (n) => n.nivel },
  { id: 'adiantado', nome: 'Adiantado', unidade: 'entregas antes do prazo', valor: (n) => n.antes },
  { id: 'deprimeira', nome: 'De primeira', unidade: 'peças aprovadas sem alteração', valor: (n) => n.deprimeira },
  { id: 'embalo', nome: 'Em chamas', unidade: 'dias úteis seguidos com entrega', valor: (n) => n.seqMax },
  { id: 'clientes', nome: 'Muitos clientes', unidade: 'clientes diferentes num mês', valor: (n) => n.clientesMax },
  { id: 'semana', nome: 'Semana sem atraso', unidade: 'semanas com 15+ entregas, todas no prazo', valor: (n) => n.semanasLimpas },
  { id: 'filaemdia', nome: 'Fila em dia', unidade: 'dias fechados sem demanda vencida', valor: (n) => n.regras.dia_sem_vencida || 0 },
  { id: 'meta', nome: 'Meta em dia', unidade: 'semanas com a meta batida', valor: (n) => (n.regras.meta_semanal || 0) + (n.regras.meta_semanal_130 || 0) + (n.regras.meta_semanal_160 || 0) },
  // Escadas das regras de 21/10/2026 (valor por papel e ranking).
  { id: 'meta_turbo', nome: 'Meta turbinada', unidade: 'semanas com 160% da meta', valor: (n) => n.regras.meta_semanal_160 || 0 },
  { id: 'podio', nome: 'Pódio', unidade: 'semanas no pódio do ranking', valor: (n) => (n.regras.ranking_1 || 0) + (n.regras.ranking_2 || 0) + (n.regras.ranking_3 || 0) },
  // A escada da Copa (Paulo, 21/10/2026: "sentindo falta do da Copa do Mundo"): semanas em 1º.
  { id: 'artilheiro', nome: 'Artilheiro', unidade: 'semanas em 1º no ranking', valor: (n) => n.regras.ranking_1 || 0 },
  { id: 'painel', nome: 'No painel', unidade: 'dias com as 10 ações do painel', valor: (n) => n.diasPainelCheio },
  { id: 'da', nome: 'Direção de arte', unidade: 'aprovações como DA', valor: (n) => n.regras.peca_da || 0 },
  { id: 'agendamento', nome: 'Agendamento', unidade: 'peças agendadas ou finalizadas', valor: (n) => n.regras.peca_agendamento || 0 },
  { id: 'carteira', nome: 'Carteira', unidade: 'peças da carteira', valor: (n) => n.regras.peca_atendimento || 0 },
  { id: 'cadastros', nome: 'Cadastros', unidade: 'demandas cadastradas', valor: (n) => n.regras.cadastro || 0 },
  // Categorias por tipo também para quem agenda, atende e gere (Paulo, 20/10/2026:
  // equilibrar com quem executa, que tem uma escada por tipo de peça).
  ...['cards', 'carrosseis', 'reels', 'stories', 'fotografias'].flatMap((f) => [
    { id: 'agendados_' + f, nome: `${NOME_TIPO[f]} ${f === 'fotografias' ? 'postadas' : 'postados'}`, unidade: `${NOME_TIPO[f].toLowerCase()} ${f === 'fotografias' ? 'postadas' : 'postados'}`, valor: (n) => n.porRegra.peca_agendamento?.[f] || 0 },
    { id: 'carteira_' + f, nome: `${NOME_TIPO[f]} da carteira`, unidade: `${NOME_TIPO[f].toLowerCase()} da carteira`, valor: (n) => n.porRegra.peca_atendimento?.[f] || 0 },
  ]),
  { id: 'gravacoes', nome: 'Dias de gravação', unidade: 'dias com captação', valor: (n) => n.diasCaptacao },
  { id: 'fotos_captadas', nome: 'Fotos captadas', unidade: 'fotos captadas', valor: (n) => n.porRegra.peca_producao?.fotografias || 0 },
  { id: 'videos_captados', nome: 'Vídeos captados', unidade: 'vídeos e reels captados', valor: (n) => (n.porRegra.peca_producao?.videos || 0) + (n.porRegra.peca_producao?.reels || 0) },
  { id: 'briefings', nome: 'Briefings no cadastro', unidade: 'cadastros com briefing', valor: (n) => n.regras.briefing || 0 },
  { id: 'agencia', nome: 'Peças da agência', unidade: 'peças da agência acompanhadas', valor: (n) => n.regras.peca_gestao || 0 },
  { id: 'planejamentos', nome: 'Planejamentos', unidade: 'planejamentos aprovados', valor: (n) => n.planejamentos },
  // Jogos do escritório (Paulo, 27/10/2026): vitórias no xadrez, dominó, pôquer e sinuca.
  { id: 'jogos', nome: 'Mesas de jogo', unidade: 'vitórias nas mesas', valor: (n) => n.vitoriasMesa },
  // Sociais: um nível só.
  { id: 'quarto', nome: 'Meu quarto', unidade: 'quarto montado', valor: (n) => (n.quarto ? 1 : 0), origem: 'conquista:meu-quarto' },
  { id: 'andar2', nome: 'Segundo andar', unidade: 'segundo andar montado', valor: (n) => (n.andar2 ? 1 : 0) },
  { id: 'presente', nome: 'Presenteador', unidade: 'presentes dados', valor: (n) => n.presentes },
  { id: 'troca', nome: 'Negociante', unidade: 'trocas feitas', valor: (n) => n.trocas },
  { id: 'postits', nome: 'Recadeiro', unidade: 'post-its colados', valor: (n) => n.postits },
];
// Critérios junto das contagens do servidor: a ficha não deduz trabalho pelo cargo.
export function criterioDoMarco(id) {
  const especificos = {
    entregas: 'Demandas com crédito de execução para você. Captação, agendamento e carteira têm contagens próprias. Uma demanda pode conter várias peças.',
    nivel: 'Seu nível pelo XP total da carteira. É diferente do XP do trabalho usado na Copa; conquistas também podem aumentar seu nível.',
    gravacoes: 'Dias distintos com peças creditadas à sua captação. Não conta sessões de gravação nem comprova quantas gravações houve no mesmo dia.',
    fotos_captadas: 'Peças de fotografia com crédito de captação para você. Várias peças podem vir da mesma sessão.',
    videos_captados: 'Peças de vídeo, motion e reels com crédito de captação para você. Não é quantidade de sessões.',
    briefings: 'Cadastros com briefing preenchido e crédito para você. O registro atual não comprova quem escreveu o texto originalmente.',
    cadastros: 'Cadastros creditados à sua sessão, inclusive peças cadastradas em lote. Não comprova autoria do briefing nem execução da peça.',
    agendamento: 'Peças com crédito de agendamento ou finalização para você. O crédito não comprova publicação na rede social.',
    carteira: 'Peças concluídas com crédito de head para você. Acompanhar a carteira não significa executar a criação.',
    agencia: 'Peças com crédito geral da agência para você. Não equivale a criação ou captação.',
    videos: 'Execuções de demandas classificadas como vídeo, motion ou capa de vídeo. Motion também tem sua especialidade; as contagens não devem ser somadas.',
    fotografias: 'Execuções de demandas classificadas como Fotografia. O formato sozinho não diferencia seleção, tratamento e criação original.',
    implementacoes: 'Demandas com Implementação como primeiro formato e crédito de execução para você. Ser head ou apenas alterar o status não basta.',
    motions: 'Demandas com Motion como primeiro formato e crédito de execução para você. Também participam da categoria Vídeos e motions.',
    da: 'Aprovações com crédito de direção de arte para você; não conta somente estar vinculado à demanda.',
    meta: 'Semanas com crédito de meta atingida, incluindo os degraus de 100%, 130% ou 160%. Alterar pesos de XP não muda essa contagem automaticamente.',
    meta_turbo: 'Semanas com crédito do degrau de 160% da meta. Uma mesma semana não deve pagar vários degraus.',
    painel: 'Dias com pelo menos 10 ações creditadas no painel. Não conta tempo online.',
    podio: 'Fechamentos semanais com prêmio de primeiro, segundo ou terceiro lugar. A posição provisória não conta.',
    artilheiro: 'Fechamentos semanais com prêmio de primeiro lugar. É diferente do título mensal da Copa.',
    jogos: 'Vitórias contra outra pessoa da equipe no xadrez, dominó, pôquer e sinuca (desistência e tempo contam). Vale uma por jogo, adversário e dia; empate não conta.',
    planejamentos: 'Planejamentos aprovados ou cadastrados que você enviou para aprovação. Não comprova autoria de todo o conteúdo.',
    adiantado: 'Execuções registradas em dia anterior ao prazo cadastrado. Não usa veiculação como substituto do prazo.',
    deprimeira: 'Peças com crédito de aprovação de primeira para você.',
    embalo: 'Maior sequência de dias úteis com execução. Sábado e domingo não quebram a sequência.',
    clientes: 'Maior quantidade de clientes distintos atendidos por suas execuções em um mês; uma peça com vários clientes continua sendo uma execução.',
    semana: 'Semanas com pelo menos 15 execuções com prazo, sem nenhuma dessas execuções após o prazo.',
    filaemdia: 'Fechamentos de dia com crédito de fila sem demanda vencida.',
  };
  if (especificos[id]) return especificos[id];
  if (id.startsWith('agendados_')) return 'Peças deste formato com crédito de agendamento ou finalização para você; não comprova publicação.';
  if (id.startsWith('carteira_')) return 'Peças deste formato com crédito de head da carteira; não é execução da peça.';
  if (MARCOS_SOCIAIS.has(id)) return 'Conquista do uso do Escritório, concedida uma vez. Seus prêmios não entram no XP do ranking de trabalho.';
  return 'Demandas deste formato com crédito de execução para você. Conta a demanda, não cada tela, variação ou arquivo; reabrir e concluir não deve repetir o crédito.';
}
// "entregas:3" → { marco: 'entregas', nivel: 3 }.
export function partesDoMarco(chave) {
  const [marco, n] = String(chave || '').split(':');
  return { marco, nivel: Number(n) || 1 };
}
export function nomeDoMarco(chave) {
  const { marco, nivel } = partesDoMarco(chave), m = MARCOS.find((x) => x.id === marco);
  if (!m) return chave;
  return MARCOS_SOCIAIS.has(marco) ? m.nome : `${m.nome} ${NIVEIS[nivel] || ''}`.trim();
}
const MARCOS_SOCIAIS = new Set(['quarto', 'andar2', 'presente', 'troca', 'postits']);
export async function marcosProntos(sql) {
  const [r] = await sql`SELECT (to_regclass('public.vybe_escritorio_marcos') IS NOT NULL AND to_regclass('public.vybe_escritorio_entregas') IS NOT NULL
    AND to_regclass('public.vybe_escritorio_trofeus') IS NOT NULL) AS existe`;
  return Boolean(r?.existe);
}
// Dia útil anterior (pula sábado e domingo), em AAAA-MM-DD sem fuso.
function diaUtilAntes(iso) {
  let d = iso;
  do d = somarDias(d, -1); while (diaDaSemana(d) > 5);
  return d;
}
// Vitórias nas mesas (xadrez, dominó, pôquer, sinuca) para a escada de
// conquistas: conta uma por jogo, adversário e dia, para dois colegas não
// subirem a escada jogando a mesma partida o dia inteiro.
async function vitoriasNasMesas(sql, pessoaId) {
 const [ex] = await sql`SELECT to_regclass('public.vybe_escritorio_xadrez') IS NOT NULL AS xadrez, to_regclass('public.vybe_escritorio_partidas') IS NOT NULL AS partidas`;
 const dia = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
 const chaves = new Set();
 if (ex?.xadrez) for (const l of await sql`SELECT brancas, pretas, resultado, terminado_em FROM vybe_escritorio_xadrez WHERE estado='fim'
   AND ((resultado='brancas' AND brancas=${pessoaId}) OR (resultado='pretas' AND pretas=${pessoaId}))`)
  chaves.add(`xadrez:${String(l.brancas) === String(pessoaId) ? l.pretas : l.brancas}:${dia(l.terminado_em)}`);
 // Pôquer em grupo: quem ganhou venceu cada um dos outros da mesa.
 const LADOS = ['desafiante', 'desafiado', 'jogador3', 'jogador4'];
 if (ex?.partidas) for (const l of await sql`SELECT jogo, desafiante, desafiado, mais, resultado, terminado_em FROM vybe_escritorio_partidas WHERE estado='fim'
   AND resultado <> 'empate' AND bot IS NULL AND (desafiante=${pessoaId} OR desafiado=${pessoaId} OR ${pessoaId} = ANY(mais))`) {
  const mesa = [l.desafiante, l.desafiado, ...(l.mais || [])].map(String);
  if (mesa[LADOS.indexOf(l.resultado)] !== String(pessoaId)) continue;
  for (const outro of mesa) if (outro !== String(pessoaId)) chaves.add(`${l.jogo}:${outro}:${dia(l.terminado_em)}`);
 }
 return chaves.size;
}
// Os números que as escadas olham, de todo o histórico.
export async function numerosDosMarcos(sql, pessoaId) {
  const [[ex]] = await Promise.all([sql`SELECT to_regclass('public.vybe_escritorio_presentes') IS NOT NULL AS presentes,
    to_regclass('public.vybe_escritorio_trocas') IS NOT NULL AS trocas, to_regclass('public.vybe_escritorio_postits') IS NOT NULL AS postits,
    to_regclass('public.vybe_planejamento_eventos') IS NOT NULL AS planejamentos, to_regprocedure('vybe_formato_chave(text)') IS NOT NULL AS formato,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='vybe_conteudos' AND column_name='formato') AS colformato`]);
  const contar = (existe, consulta) => existe ? consulta().then((r) => Number(r[0]?.n || 0)) : Promise.resolve(0);
  const [[t], diasLinhas, [cl], [c], regrasLinhas, [a], semanas, formatos, presentes, trocas, postits, planejamentos, [pf], [captacao], [painelCheio], [quarto]] = await Promise.all([
    sql`SELECT count(*) AS n FROM vybe_escritorio_entregas WHERE pessoa_id=${pessoaId} AND regra = ANY(${EXECUCAO}::text[])`,
    sql`SELECT DISTINCT TO_CHAR(dia,'YYYY-MM-DD') AS dia FROM vybe_escritorio_entregas WHERE pessoa_id=${pessoaId} AND regra = ANY(${EXECUCAO}::text[])`,
    sql`SELECT COALESCE(max(n),0) AS n FROM (SELECT date_trunc('month', e.dia) m, count(DISTINCT cc.cliente_id) n FROM vybe_escritorio_entregas e
      JOIN vybe_conteudo_clientes cc ON cc.conteudo_id=e.conteudo_id WHERE e.pessoa_id=${pessoaId} AND e.regra = ANY(${EXECUCAO}::text[]) GROUP BY 1) x`,
    sql`SELECT xp FROM vybe_escritorio_carteiras WHERE pessoa_id=${pessoaId}`,
    sql`SELECT regra, count(DISTINCT origem)::int AS n FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND regra IS NOT NULL GROUP BY regra`,
    sql`SELECT count(*) FILTER (WHERE e.dia < c.prazo) AS antes FROM vybe_escritorio_entregas e JOIN vybe_conteudos c ON c.id=e.conteudo_id
      WHERE e.pessoa_id=${pessoaId} AND e.regra = ANY(${EXECUCAO}::text[]) AND c.prazo IS NOT NULL`,
    sql`SELECT count(*)::int AS n FROM (SELECT date_trunc('week', e.dia) s FROM vybe_escritorio_entregas e JOIN vybe_conteudos c ON c.id=e.conteudo_id
      WHERE e.pessoa_id=${pessoaId} AND e.regra = ANY(${EXECUCAO}::text[]) AND c.prazo IS NOT NULL GROUP BY 1 HAVING count(*) >= 15 AND count(*) FILTER (WHERE e.dia > c.prazo) = 0) x`,
    ex.formato && ex.colformato
      ? sql`SELECT e.regra, vybe_formato_chave(split_part(c.formato, ',', 1)) AS f, count(DISTINCT e.conteudo_id)::int AS n FROM vybe_escritorio_entregas e
          JOIN vybe_conteudos c ON c.id=e.conteudo_id WHERE e.pessoa_id=${pessoaId} AND e.regra IN ('peca_criacao','peca_producao','peca_agendamento','peca_atendimento') GROUP BY 1,2`
      : Promise.resolve([]),
    contar(ex.presentes, () => sql`SELECT count(*) AS n FROM vybe_escritorio_presentes WHERE de_pessoa=${pessoaId}`),
    contar(ex.trocas, () => sql`SELECT count(*) AS n FROM vybe_escritorio_trocas WHERE estado='aceita' AND (de_pessoa=${pessoaId} OR para_pessoa=${pessoaId})`),
    contar(ex.postits, () => sql`SELECT count(*) AS n FROM vybe_escritorio_postits WHERE pessoa_id=${pessoaId}`),
    contar(ex.planejamentos, () => sql`SELECT count(DISTINCT p.id) AS n FROM vybe_planejamentos p
      JOIN vybe_planejamento_eventos ev ON ev.planejamento_id=p.id AND ev.tipo='enviado' AND ev.autor_id=${pessoaId}
      WHERE p.estado IN ('aprovado','cadastrado')`),
    sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoaId}`,
    sql`SELECT count(DISTINCT dia)::int AS n FROM vybe_escritorio_entregas WHERE pessoa_id=${pessoaId} AND regra='peca_producao'`,
    sql`SELECT count(*)::int AS n FROM (SELECT split_part(origem,':',2) d FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND regra='acao_painel' GROUP BY 1 HAVING count(*) >= 10) x`,
    sql`SELECT EXISTS(SELECT 1 FROM vybe_escritorio_moedas WHERE pessoa_id=${pessoaId} AND origem='conquista:meu-quarto') OR EXISTS(
      SELECT 1 FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoaId} AND preferencias->>'quarto_configurado'='true') AS sim`,
  ]);
  // Maior sequência de dias úteis com entrega no histórico.
  const dias = new Set(diasLinhas.map((x) => x.dia));
  let seqMax = 0;
  for (const d of dias) {
    if (diaDaSemana(d) > 5 || dias.has(proximoUtil(d, -1))) continue; // começa só no início de uma sequência
    let n = 0, x = d;
    while (dias.has(x) && n < 800) { n++; x = proximoUtil(x, 1); }
    seqMax = Math.max(seqMax, n);
  }
  const regras = Object.fromEntries(regrasLinhas.map((r) => [r.regra, Number(r.n)]));
  const vitoriasMesa = await vitoriasNasMesas(sql, pessoaId);
  const somar = (linhas) => Object.fromEntries(Object.keys(FORMATOS).map((k) => [k, linhas.filter((f) => FORMATOS[k].includes(f.f)).reduce((s, f) => s + Number(f.n), 0)]));
  const porFormato = somar(formatos.filter((f) => EXECUCAO.includes(f.regra)));
  const porRegra = Object.fromEntries(['peca_agendamento', 'peca_atendimento', 'peca_producao'].map((r) => [r, somar(formatos.filter((f) => f.regra === r))]));
  return { hoje: diaBahia(), total: Number(t.n), seqMax, clientesMax: Number(cl.n), nivel: nivelPorXp(c?.xp || 0).nivel, regras, antes: Number(a.antes),
    diasCaptacao: Number(captacao?.n || 0), diasPainelCheio: Number(painelCheio?.n || 0), deprimeira: regras.criacao_aprovada || 0, semanasLimpas: Number(semanas[0]?.n || 0), formatos: porFormato, porRegra, presentes, trocas, postits, planejamentos,
    vitoriasMesa, quarto: Boolean(quarto?.sim), andar2: (pf?.preferencias?.sala_andares || []).some((x) => x?.andar === 1 && x.quarto_configurado === true) };
}
function proximoUtil(iso, passo) {
  let d = iso;
  do d = somarDias(d, passo); while (diaDaSemana(d) > 5);
  return d;
}
// Lista das escadas da pessoa (nível alcançado, próximo alvo, troféus),
// concedendo os níveis novos: registro em vybe_escritorio_marcos ("id:nível"),
// conquista no razão (regra × nível) e o troféu no inventário, na mesma
// transação. Repetir não concede de novo.
export async function conferirMarcos(sql, pessoaId, agora = new Date()) {
  if (!await marcosProntos(sql)) return null;
  const [n, feitosLinhas, trofeus, [regra]] = await Promise.all([
    numerosDosMarcos(sql, pessoaId),
    sql`SELECT marco,em FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId}`,
    // Prêmio de cada nível na tabela (desde 21/10/2026); sem ele, regra × nível.
    sql`SELECT * FROM vybe_escritorio_trofeus ORDER BY marco, nivel`,
    sql`SELECT moedas, pontos FROM vybe_escritorio_regras WHERE chave='conquista' AND ativa`,
  ]);
  const feitos = new Map(feitosLinhas.map((f) => [f.marco, f.em]));
  const lista = [];
  for (const m of MARCOS) {
    const premio = (x, campo) => x[campo] != null ? Number(x[campo]) : regra ? Number(regra[campo]) * Number(x.nivel) : 0;
    const degraus = trofeus.filter((x) => x.marco === m.id).map((x) => ({ nivel: Number(x.nivel), meta: Number(x.meta), classe: x.classe, moedas: premio(x, 'moedas'), pontos: premio(x, 'pontos') }));
    if (!degraus.length) continue;
    const valor = Number(m.valor(n) || 0);
    for (const d of degraus) {
      const chave = `${m.id}:${d.nivel}`;
      if (feitos.has(chave) || valor < d.meta) continue;
      const em = await sql.comTransacao(async (tx) => {
        const [novo] = await tx`INSERT INTO vybe_escritorio_marcos(pessoa_id,marco) VALUES(${pessoaId},${chave}) ON CONFLICT DO NOTHING RETURNING em`;
        if (!novo) return null;
        if (d.moedas || d.pontos) await tx`SELECT vybe_lancar_pontos(${pessoaId},${d.nivel === 1 && m.origem ? m.origem : 'conquista:' + chave},'conquista',NULL,${d.moedas},${d.pontos})`;
        if (d.classe) await tx`INSERT INTO vybe_escritorio_inventario(pessoa_id,classe,quantidade) VALUES(${pessoaId},${d.classe},1)
          ON CONFLICT(pessoa_id,classe) DO UPDATE SET quantidade=vybe_escritorio_inventario.quantidade+1`;
        return novo.em;
      });
      feitos.set(chave, em || (await sql`SELECT em FROM vybe_escritorio_marcos WHERE pessoa_id=${pessoaId} AND marco=${chave}`)[0]?.em || null);
    }
    const alcancados = degraus.filter((d) => feitos.has(`${m.id}:${d.nivel}`));
    const nivel = alcancados.length ? Math.max(...alcancados.map((d) => d.nivel)) : 0;
    const proximo = degraus.find((d) => d.nivel === nivel + 1) || null;
    const social = MARCOS_SOCIAIS.has(m.id);
    lista.push({
      id: m.id, nome: m.nome, criterio: criterioDoMarco(m.id), nivel, nomeNivel: social ? (nivel ? 'Conquistado' : '') : NIVEIS[nivel] || '', social, valor, unidade: m.unidade,
      proximo: proximo ? { nivel: proximo.nivel, nome: social ? 'Conquistado' : NIVEIS[proximo.nivel], meta: proximo.meta, classe: proximo.classe } : null,
      degraus: degraus.map((d) => ({ ...d, nome: social ? 'Conquistado' : NIVEIS[d.nivel], ok: feitos.has(`${m.id}:${d.nivel}`), em: feitos.get(`${m.id}:${d.nivel}`) || null,
        titulo: tituloDe(m.id, d.nivel) })),
      titulo: nivel ? tituloDe(m.id, nivel) : null,
      // Compatível com as telas antigas: ok, em, dica e o móvel do próximo nível (ou do último).
      ok: nivel > 0, em: alcancados.length ? feitos.get(`${m.id}:${nivel}`) : null,
      dica: proximo ? `${proximo.meta.toLocaleString('pt-BR')} ${m.unidade}` : 'Nível máximo',
      moveis: [(proximo || degraus.at(-1))?.classe].filter(Boolean),
    });
  }
  return lista;
}
// Revisão única quando as regras de contagem mudam: tira os níveis que a
// pessoa não alcança mais pela conta nova (registro, conquista do razão e uma
// unidade do troféu). Com `tirarDoQuarto` (Paulo, 21/10/2026: "remove o item"),
// se a única unidade está num quarto da pessoa, ela sai do quarto também. O
// saldo para no zero e o razão recebe o ajuste. Repetir com a mesma chave não faz nada.
export async function revisarNiveisEscritorio(sql, chave, { tirarDoQuarto = false } = {}) {
  if (!await marcosProntos(sql)) return { disponivel: false };
  const [ja] = await sql`SELECT 1 FROM vybe_escritorio_reinicios WHERE chave=${chave}`;
  if (ja) return { disponivel: true, repetida: true, tirados: 0 };
  const trofeus = await sql`SELECT marco, nivel, meta, classe FROM vybe_escritorio_trofeus`;
  const pessoas = await sql`SELECT DISTINCT pessoa_id FROM vybe_escritorio_marcos ORDER BY 1`;
  let tirados = 0;
  for (const { pessoa_id: p } of pessoas) {
    const n = await numerosDosMarcos(sql, p);
    for (const f of await sql`SELECT marco FROM vybe_escritorio_marcos WHERE pessoa_id=${p}`) {
      const { marco, nivel } = partesDoMarco(f.marco), m = MARCOS.find((x) => x.id === marco), t = trofeus.find((x) => x.marco === marco && Number(x.nivel) === nivel);
      // A Copa não é escada: ganha no fechamento do mês e nunca sai na revisão.
      if (copaDoMarco(marco)) continue;
      if (m && t && Number(m.valor(n) || 0) >= Number(t.meta)) continue;
      await sql.comTransacao(async (tx) => {
        await tx`DELETE FROM vybe_escritorio_marcos WHERE pessoa_id=${p} AND marco=${f.marco}`;
        const origem = nivel === 1 && m?.origem ? m.origem : 'conquista:' + f.marco;
        const [l] = await tx`DELETE FROM vybe_escritorio_moedas WHERE pessoa_id=${p} AND origem=${origem} RETURNING quantidade, pontos`;
        if (l) {
          const [c] = await tx`UPDATE vybe_escritorio_carteiras SET saldo=GREATEST(0, saldo-${Number(l.quantidade)}), xp=GREATEST(0, xp-${Number(l.pontos)}) WHERE pessoa_id=${p} RETURNING saldo`;
          const [r] = await tx`SELECT COALESCE(sum(quantidade),0)::int AS s FROM vybe_escritorio_moedas WHERE pessoa_id=${p}`;
          if (c && Number(c.saldo) !== Number(r.s)) await tx`INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade,pontos) VALUES(${p},${'ajuste:' + chave + ':' + f.marco},${Number(c.saldo) - Number(r.s)},0)`;
        }
        if (t?.classe) {
          const [i] = await tx`SELECT quantidade FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${t.classe} FOR UPDATE`;
          const [noQuarto] = await tx`SELECT count(*)::int AS n FROM vybe_escritorio_mapa m, jsonb_array_elements(m.itens) it WHERE m.camada ~ '^sala-[0-9]+(-andar-1)?$' AND it->>0=${t.classe} AND m.atualizado_por=${p}`;
          const sobra = i && Number(i.quantidade) > Number(noQuarto?.n || 0);
          if (i && !sobra && tirarDoQuarto && Number(noQuarto?.n || 0) > 0) {
            // A unidade está num quarto da pessoa: sai da camada (a primeira que tiver).
            const [cam] = await tx`SELECT m.camada, m.itens FROM vybe_escritorio_mapa m WHERE m.camada ~ '^sala-[0-9]+(-andar-1)?$' AND m.atualizado_por=${p}
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(m.itens) it WHERE it->>0=${t.classe}) ORDER BY m.camada LIMIT 1 FOR UPDATE`;
            if (cam) {
              const itens = Array.isArray(cam.itens) ? cam.itens : [];
              const k = itens.findIndex((it) => Array.isArray(it) && it[0] === t.classe);
              if (k >= 0) { itens.splice(k, 1); await tx`UPDATE vybe_escritorio_mapa SET itens=${JSON.stringify(itens)}::jsonb WHERE camada=${cam.camada}`; }
            }
          }
          if (i && (sobra || tirarDoQuarto)) {
            if (Number(i.quantidade) <= 1) await tx`DELETE FROM vybe_escritorio_inventario WHERE pessoa_id=${p} AND classe=${t.classe}`;
            else await tx`UPDATE vybe_escritorio_inventario SET quantidade=quantidade-1 WHERE pessoa_id=${p} AND classe=${t.classe}`;
          }
        }
      });
      tirados++;
    }
  }
  await sql`INSERT INTO vybe_escritorio_reinicios(chave) VALUES(${chave})`;
  return { disponivel: true, tirados };
}
// No fechamento do dia: confere todo mundo que tem função, para o nível não
// esperar a pessoa abrir a ficha.
export async function conferirMarcosDaEquipe(sql, agora = new Date()) {
  if (!await marcosProntos(sql)) return { disponivel: false };
  const pessoas = await sql`SELECT pessoa_id FROM vybe_escritorio_funcoes ORDER BY pessoa_id`;
  let novos = 0;
  for (const p of pessoas) {
    const antes = Number((await sql`SELECT count(*) AS n FROM vybe_escritorio_marcos WHERE pessoa_id=${p.pessoa_id}`)[0].n);
    await conferirMarcos(sql, p.pessoa_id, agora);
    novos += Number((await sql`SELECT count(*) AS n FROM vybe_escritorio_marcos WHERE pessoa_id=${p.pessoa_id}`)[0].n) - antes;
  }
  return { disponivel: true, pessoas: pessoas.length, novos };
}
