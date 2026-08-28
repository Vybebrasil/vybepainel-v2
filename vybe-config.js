// vybe-config.js — configuração: colunas do Monday, pessoas, papéis e estado global
// Extraído do <script> inline do index.html; carregado em ordem, escopo global preservado.
// ─── Configuração ─────────────────────────────────────────────────────────────
const MONDAY_TOKEN  = ''; // token gerenciado pelo proxy Vercel
const MONDAY_API    = '/api/monday'; // proxy relay local (server-side)
const BOARD_ID      = 7829537690;

// ─── Colunas do Monday ────────────────────────────────────────────────────────
// Os ids opacos do Monday ficam só aqui. Renomeou/trocou uma coluna no board?
// Ajuste nesta tabela e o resto do painel acompanha.
const COLUNAS = Object.freeze({
  producao: Object.freeze({
    cliente:     'lista_suspensa_mkmqnjbv',
    formato:     'lista_suspensa0__1',
    etapa:       'lista_suspensa__1',
    prazo:       'data',
    veiculacao:  'data__1',
    status:      'status',
    captacao:    'status_1__1',
    responsavel: 'person',
    arquivos:    'file_mkwtx2j4',
  }),
  demandas: Object.freeze({
    cliente:     'lista_suspensa_mkmet5gs',
    formato:     'dropdown_mkv8d52z',
    prioridade:  'color_mkwtgakv',
    prazo:       'data',
    veiculacao:  'data_mkky6jx',
    status:      'status',
    responsavel: 'person',
  }),
});


// ─── Pessoas e papéis ─────────────────────────────────────────────────────────
// Fonte única de verdade da equipe. Entrou alguém, saiu alguém ou mudou de
// disciplina? Só aqui. Nenhum ID solto deve voltar para o meio da lógica.
const PESSOAS = Object.freeze({
  PAULO:     '68035537',
  VINICIUS:  '68035653',
  EWERTON_L: '68036687',
  RERISTON:  '68036697',
  DEIVID:    '68997024',
  BEATRIZ:   '71130408',
  ADEMIR:    '78158742',
  TAINARA:   '80146924',
  EWERTON_S: '98079733',
  BRENO:     '99331644',
  EDUARDO:   '99331648',
  JADY:      '100482777',
});

// Quem responde por cada etapa do fluxo de produção.
const EQUIPES = Object.freeze({
  design:               Object.freeze([PESSOAS.DEIVID, PESSOAS.BEATRIZ, PESSOAS.JADY]),
  audiovisual:          Object.freeze([PESSOAS.RERISTON]),
  motion:               Object.freeze([PESSOAS.DEIVID, PESSOAS.BEATRIZ, PESSOAS.RERISTON]),
  publicacao:           Object.freeze([PESSOAS.TAINARA, PESSOAS.PAULO, PESSOAS.VINICIUS]),
  aprovacaoAudiovisual: Object.freeze([PESSOAS.PAULO, PESSOAS.VINICIUS, PESSOAS.EWERTON_L, PESSOAS.EWERTON_S]),
});


// Mapa de normalização: nome no board Demandas → nome canônico (igual ao board Produção)
const CLIENTES_ALIAS = {
  'ace':                    'Ace - Associação Comercial',
  'academia lions top':     'Academia Lions',
  'corrida dogrun':         'Dogrun',
  'diacenter':              'DiaCenter',
  'eskinão':               'Eskinao',
  'experimente papelaria':  'Experimente Papelaria',
  'experimente':             'Experimente Papelaria',
  'gonzalez':               'Gonzalez Advocacia',
  'hellen rocha':           'Hellen',
  'igor lopes':             'Igor R. Lopes',
  'menina dos óculos':      'Menina dos Oculos',
  'vöa':                    'VÖA Sportswear',
  'debull':                 'De Bull',
  'irecemodas':             'Irece Modas',
  'irece modas':            'Irece Modas',
  'larissa fernanda':       'Larissa Fernanda',
  'daiana miron':           'Daiana Miron',
  'conectásim':             'ConectaSim',
  'conectasim':             'ConectaSim',
  'copirecê':               'Copirecê',
  'serra grande':           'Serra Grande Bebidas',
  'feijão panela de ouro':  'Feijão Panela de Ouro',
};

// Normaliza o nome do cliente para evitar duplicatas entre os boards
function normalizarCliente(nome) {
  if (!nome) return nome;
  const key = nome.trim().toLowerCase();
  return CLIENTES_ALIAS[key] || nome.trim();
}

const CLIENTES_INATIVOS = new Set([
  'acquaville','blog ace','camarote sertão','camarote sertao','cavaco de pau',
  'comunidade facilite entre mães','comunidade facilite entre maes',
  'comunidade fora da curva','daniela filgueira','dialab','dogrun',
  'facilite aprender','feijão panela de ouro','feijao panela de ouro',
  'gyn protect','igor r. lopes','igor r lopes','lucas deotti','vila real',
  'vybe','armazém container','armazem container','fa','psi - jaine','psi jaine'
]);

const GROUP_MAP = {
  'group_title':          'Redação',
  'novo_grupo__1':        'Design & Edição',
  'novo_grupo57911__1':   'Produção (Foto e Vídeo)',
  'novo_grupo22352__1':   'Gestão de publicações',
  'novo_grupo31348__1':   'Finalizados'
};

// ─── Estado Global ────────────────────────────────────────────────────────────────────────────────────
let DADOS = [], DIAS_S1 = [], DIAS_S2 = [], HOJE_ISO = '', META = {};
let currentWeek = 1, currentFilter = 'all', currentDayFilter = '';
let dateMode = 'veiculacao'; // 'veiculacao' ou 'prazo'
let MONTH_OFFSET = 0; // 0 = mês atual, +1 = próximo, -1 = anterior

function changeMonth(delta) {
  MONTH_OFFSET += delta;
  refreshData();
}

function getMonthName(offset) {
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return months[d.getMonth()] + ' ' + d.getFullYear();
}

function updateMonthNav() {
  const el = document.getElementById('month-nav-label');
  if (el) el.textContent = getMonthName(MONTH_OFFSET);
}

