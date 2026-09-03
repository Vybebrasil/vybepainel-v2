/* ============================================================================
   CALENDARIO SAZONAL
   ----------------------------------------------------------------------------
   As datas do ano — nacionais, internacionais e municipais — mes por mes, para
   quem esta cadastrando conteudo escolher uma e ja cair no fluxo de cadastro
   com a data, o titulo e um comeco de briefing preenchidos.

   Por que uma lista escrita aqui e nao uma consulta a algum servico:
   nao existe fonte publica estavel de datas comemorativas brasileiras, e o que
   uma agencia usa nao e "todo feriado que existe" — e o punhado de datas que
   rende conteudo. Esta lista e curada com esse criterio.

   As datas que mudam de ano para ano (Carnaval, Pascoa, Dia das Maes, Black
   Friday) NAO estao na lista: elas sao calculadas, senao a lista venceria em
   31 de dezembro e ninguem lembraria de atualizar.
   ========================================================================== */

// [dia, nome, escopo, destaque, feriado]
//   escopo:   'n' nacional · 'i' internacional · 'e' Bahia e regiao · 'm' municipal
//   destaque: 1 quando a data costuma virar post de verdade
//   feriado:  1 quando o pais para (importa para agendar publicacao)
const SAZONAL_FIXAS = [
  // ---- JANEIRO ----
  ['01-01', 'Confraternização Universal (Ano Novo)', 'n', 1, 1],
  ['01-01', 'Janeiro Branco — Saúde Mental', 'n', 1, 0],
  ['01-01', 'Dia Mundial da Paz', 'i', 0, 0],
  ['01-06', 'Dia de Reis', 'n', 0, 0],
  ['01-08', 'Dia do Fotógrafo', 'n', 1, 0],
  ['01-11', 'Dia Mundial do Obrigado', 'i', 0, 0],
  ['01-20', 'Dia do Farmacêutico', 'n', 0, 0],
  ['01-20', 'Dia de São Sebastião — feriado no Rio de Janeiro (RJ)', 'm', 0, 0],
  ['01-21', 'Dia Mundial da Religião', 'i', 0, 0],
  ['01-24', 'Dia Nacional do Aposentado', 'n', 0, 0],
  ['01-25', 'Aniversário de São Paulo (SP)', 'm', 0, 0],
  ['01-26', 'Dia Mundial da Educação Ambiental', 'i', 0, 0],
  ['01-27', 'Dia Internacional em Memória do Holocausto', 'i', 0, 0],
  ['01-28', 'Dia Internacional da Proteção de Dados', 'i', 0, 0],
  ['01-30', 'Dia da Saudade', 'n', 1, 0],

  // ---- FEVEREIRO ----
  ['02-01', 'Fevereiro Roxo e Laranja — Lúpus, Alzheimer e Leucemia', 'n', 0, 0],
  ['02-02', 'Dia de Iemanjá', 'e', 1, 0],
  ['02-04', 'Dia Mundial do Câncer', 'i', 1, 0],
  ['02-05', 'Dia Nacional da Mamografia', 'n', 0, 0],
  ['02-11', 'Dia Internacional das Mulheres e Meninas na Ciência', 'i', 0, 0],
  ['02-13', 'Dia Mundial do Rádio', 'i', 0, 0],
  ['02-14', "Dia dos Namorados no exterior (Valentine's Day)", 'i', 1, 0],
  ['02-17', 'Dia do Gato', 'i', 1, 0],
  ['02-19', 'Dia do Esportista', 'n', 0, 0],
  ['02-21', 'Dia Internacional da Língua Materna', 'i', 0, 0],

  // ---- MARÇO ----
  ['03-01', 'Março Lilás — Prevenção do Câncer do Colo do Útero', 'n', 0, 0],
  ['03-01', 'Aniversário do Rio de Janeiro (RJ)', 'm', 0, 0],
  ['03-03', 'Dia Mundial da Vida Selvagem', 'i', 0, 0],
  ['03-04', 'Dia Mundial da Obesidade', 'i', 0, 0],
  ['03-08', 'Dia Internacional da Mulher', 'i', 1, 0],
  ['03-14', 'Dia Nacional dos Animais', 'n', 1, 0],
  ['03-15', 'Dia Mundial do Consumidor', 'i', 1, 0],
  ['03-19', 'Dia de São José', 'n', 0, 0],
  ['03-20', 'Dia Internacional da Felicidade', 'i', 1, 0],
  ['03-21', 'Dia Internacional da Síndrome de Down', 'i', 0, 0],
  ['03-22', 'Dia Mundial da Água', 'i', 1, 0],
  ['03-24', 'Dia Mundial de Combate à Tuberculose', 'i', 0, 0],
  ['03-27', 'Dia Mundial do Teatro', 'i', 0, 0],
  ['03-30', 'Dia Mundial do Transtorno Bipolar', 'i', 0, 0],
  ['03-31', 'Dia da Saúde e Nutrição', 'n', 0, 0],

  // ---- ABRIL ----
  ['04-01', 'Dia da Mentira', 'n', 1, 0],
  ['04-01', 'Abril Azul — Conscientização do Autismo', 'n', 1, 0],
  ['04-02', 'Dia Mundial de Conscientização do Autismo', 'i', 1, 0],
  ['04-07', 'Dia Mundial da Saúde', 'i', 1, 0],
  ['04-08', 'Dia Mundial de Combate ao Câncer', 'i', 0, 0],
  ['04-13', 'Dia do Beijo', 'n', 1, 0],
  ['04-15', 'Dia Mundial do Desenhista', 'n', 1, 0],
  ['04-18', 'Dia Nacional do Livro Infantil', 'n', 0, 0],
  ['04-19', 'Dia dos Povos Indígenas', 'n', 1, 0],
  ['04-21', 'Tiradentes', 'n', 1, 1],
  ['04-22', 'Descobrimento do Brasil', 'n', 0, 0],
  ['04-22', 'Dia Mundial da Terra', 'i', 1, 0],
  ['04-23', 'Dia Mundial do Livro', 'i', 0, 0],
  ['04-28', 'Dia da Educação', 'n', 0, 0],

  // ---- MAIO ----
  ['05-01', 'Dia do Trabalho', 'n', 1, 1],
  ['05-01', 'Maio Amarelo — Segurança no Trânsito', 'n', 1, 0],
  ['05-03', 'Dia Mundial da Liberdade de Imprensa', 'i', 0, 0],
  ['05-08', 'Dia Mundial da Cruz Vermelha', 'i', 0, 0],
  ['05-12', 'Dia Internacional da Enfermagem', 'i', 0, 0],
  ['05-13', 'Dia da Abolição da Escravatura', 'n', 0, 0],
  ['05-15', 'Dia Internacional da Família', 'i', 1, 0],
  ['05-17', 'Dia Mundial da Internet', 'i', 0, 0],
  ['05-18', 'Dia Nacional de Combate ao Abuso e à Exploração Sexual de Crianças e Adolescentes', 'n', 1, 0],
  ['05-22', 'Dia Internacional da Biodiversidade', 'i', 0, 0],
  ['05-25', 'Dia do Orgulho Nerd', 'i', 1, 0],
  ['05-28', 'Dia Internacional de Luta pela Saúde da Mulher', 'i', 0, 0],
  ['05-31', 'Emancipação Política de Irecê (1933) — aniversário da cidade', 'm', 1, 1],
  ['05-31', 'Dia Mundial sem Tabaco', 'i', 0, 0],

  // ---- JUNHO ----
  ['06-01', 'Junho Vermelho — Doação de Sangue', 'n', 0, 0],
  ['06-05', 'Dia Mundial do Meio Ambiente', 'i', 1, 0],
  ['06-08', 'Dia Mundial dos Oceanos', 'i', 0, 0],
  ['06-12', 'Dia dos Namorados', 'n', 1, 0],
  ['06-13', 'Dia de Santo Antônio', 'n', 0, 0],
  ['06-14', 'Dia Mundial do Doador de Sangue', 'i', 0, 0],
  ['06-24', 'São João — Festa Junina', 'n', 1, 0],
  ['06-26', 'Dia Internacional de Combate às Drogas', 'i', 0, 0],
  ['06-29', 'São Pedro — encerramento dos festejos juninos', 'n', 1, 0],
  ['06-28', 'Dia Internacional do Orgulho LGBTQIA+', 'i', 1, 0],

  // ---- JULHO ----
  ['07-01', 'Julho Amarelo — Hepatites Virais', 'n', 0, 0],
  ['07-02', 'Independência da Bahia — feriado estadual', 'e', 1, 1],
  ['07-09', 'Revolução Constitucionalista — feriado em São Paulo (SP)', 'm', 0, 0],
  ['07-10', 'Dia da Pizza', 'n', 1, 0],
  ['07-13', 'Dia Mundial do Rock', 'i', 1, 0],
  ['07-14', 'Dia Mundial da Liberdade de Pensamento', 'i', 0, 0],
  ['07-20', 'Dia do Amigo', 'n', 1, 0],
  ['07-25', 'Dia do Escritor', 'n', 0, 0],
  ['07-26', 'Dia dos Avós', 'n', 1, 0],
  ['07-27', 'Dia Nacional de Prevenção de Acidentes de Trabalho', 'n', 0, 0],
  ['07-28', 'Dia do Agricultor', 'n', 1, 0],
  ['07-28', 'Dia Mundial de Combate às Hepatites Virais', 'i', 0, 0],
  ['07-30', 'Dia Internacional da Amizade', 'i', 1, 0],

  // ---- AGOSTO ----
  ['08-01', 'Agosto Dourado — Aleitamento Materno', 'n', 1, 0],
  ['08-01', 'Agosto Lilás — Enfrentamento à Violência contra a Mulher', 'n', 1, 0],
  ['08-04', 'São Domingos de Gusmão — padroeiro de Irecê', 'm', 1, 1],
  ['08-05', 'Dia Nacional da Saúde', 'n', 0, 0],
  ['08-07', 'Dia da Lei Maria da Penha', 'n', 0, 0],
  ['08-08', 'Dia Mundial do Gato', 'i', 1, 0],
  ['08-11', 'Dia do Estudante e Dia do Advogado', 'n', 1, 0],
  ['08-12', 'Dia Internacional da Juventude', 'i', 0, 0],
  ['08-19', 'Dia Mundial da Fotografia', 'i', 1, 0],
  ['08-22', 'Dia do Folclore', 'n', 1, 0],
  ['08-25', 'Dia do Soldado', 'n', 0, 0],
  ['08-27', 'Dia do Psicólogo', 'n', 0, 0],
  ['08-31', 'Dia do Nutricionista', 'n', 0, 0],

  // ---- SETEMBRO ----
  ['09-01', 'Setembro Amarelo — Prevenção ao Suicídio', 'n', 1, 0],
  ['09-05', 'Dia da Amazônia', 'n', 0, 0],
  ['09-07', 'Independência do Brasil', 'n', 1, 1],
  ['09-08', 'Dia Mundial da Alfabetização', 'i', 0, 0],
  ['09-10', 'Dia Mundial de Prevenção ao Suicídio', 'i', 1, 0],
  ['09-15', 'Dia do Cliente', 'n', 1, 0],
  ['09-21', 'Dia da Árvore', 'n', 1, 0],
  ['09-21', 'Dia Mundial do Alzheimer', 'i', 0, 0],
  ['09-22', 'Dia Mundial sem Carro', 'i', 0, 0],
  ['09-23', 'Início da Primavera', 'n', 1, 0],
  ['09-27', 'Dia Nacional da Doação de Órgãos', 'n', 0, 0],
  ['09-29', 'Dia Mundial do Coração', 'i', 0, 0],
  ['09-30', 'Dia da Secretária', 'n', 1, 0],

  // ---- OUTUBRO ----
  ['10-01', 'Outubro Rosa — Prevenção do Câncer de Mama', 'n', 1, 0],
  ['10-01', 'Dia Internacional do Idoso', 'i', 0, 0],
  ['10-04', 'Dia Mundial dos Animais', 'i', 1, 0],
  ['10-05', 'Dia Mundial do Professor', 'i', 0, 0],
  ['10-08', 'Dia do Nordestino', 'e', 1, 0],
  ['10-10', 'Dia Mundial da Saúde Mental', 'i', 1, 0],
  ['10-12', 'Dia das Crianças', 'n', 1, 1],
  ['10-12', 'Nossa Senhora Aparecida', 'n', 1, 1],
  ['10-15', 'Dia do Professor', 'n', 1, 0],
  ['10-16', 'Dia Mundial da Alimentação', 'i', 1, 0],
  ['10-18', 'Dia do Médico', 'n', 0, 0],
  ['10-24', 'Dia das Nações Unidas', 'i', 0, 0],
  ['10-28', 'Dia do Servidor Público', 'n', 0, 0],
  ['10-31', 'Halloween — Dia das Bruxas', 'i', 1, 0],

  // ---- NOVEMBRO ----
  ['11-01', 'Novembro Azul — Saúde do Homem', 'n', 1, 0],
  ['11-01', 'Dia Mundial do Veganismo', 'i', 0, 0],
  ['11-02', 'Finados', 'n', 1, 1],
  ['11-14', 'Dia Mundial do Diabetes', 'i', 0, 0],
  ['11-15', 'Proclamação da República', 'n', 1, 1],
  ['11-19', 'Dia da Bandeira', 'n', 0, 0],
  ['11-20', 'Dia da Consciência Negra', 'n', 1, 1],
  ['11-21', 'Dia Mundial da Televisão', 'i', 0, 0],
  ['11-25', 'Dia Internacional pela Eliminação da Violência contra a Mulher', 'i', 1, 0],
  ['11-27', 'Dia Nacional de Combate ao Câncer', 'n', 0, 0],

  // ---- DEZEMBRO ----
  ['12-01', 'Dezembro Vermelho — Prevenção ao HIV e Aids', 'n', 0, 0],
  ['12-01', 'Dia Mundial de Combate à Aids', 'i', 0, 0],
  ['12-03', 'Dia Internacional da Pessoa com Deficiência', 'i', 0, 0],
  ['12-08', 'Dia da Família', 'n', 1, 0],
  ['12-10', 'Dia Internacional dos Direitos Humanos', 'i', 0, 0],
  ['12-13', 'Dia de Santa Luzia', 'n', 0, 0],
  ['12-20', 'Dia Internacional da Solidariedade Humana', 'i', 0, 0],
  ['12-21', 'Início do Verão', 'n', 1, 0],
  ['12-24', 'Véspera de Natal', 'n', 1, 0],
  ['12-25', 'Natal', 'n', 1, 1],
  ['12-31', 'Réveillon — Véspera de Ano Novo', 'n', 1, 0]
];

const SAZONAL_ESCOPOS = {
  n: { nome: 'Nacional',      cor: '#00c875' },
  i: { nome: 'Internacional', cor: '#579bfc' },
  e: { nome: 'Bahia',         cor: '#a25ddc' },
  m: { nome: 'Municipal',     cor: '#ff9f43' }
};

const SAZONAL_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                       'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ---------------------------------------------------------------------------
   As datas que andam
   Pascoa manda em Carnaval, Sexta-feira Santa e Corpus Christi. O resto e
   "enesimo dia da semana tal do mes tal". Calcular custa dez linhas e vale por
   nao ter que reescrever a lista todo ano.
   ------------------------------------------------------------------------- */

// Computo eclesiastico (algoritmo de Meeus/Jones/Butcher) — devolve a Pascoa.
function sazonalPascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function sazonalIso(data) { return data.toISOString().slice(0, 10); }

function sazonalSomarDias(data, dias) {
  const nova = new Date(data.getTime());
  nova.setUTCDate(nova.getUTCDate() + dias);
  return nova;
}

// Ex.: 2o domingo de maio = sazonalEnesimoDiaDaSemana(ano, 4, 0, 2)
function sazonalEnesimoDiaDaSemana(ano, mesZeroBase, diaDaSemana, enesimo) {
  const primeiro = new Date(Date.UTC(ano, mesZeroBase, 1));
  const desloca = (diaDaSemana - primeiro.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(ano, mesZeroBase, 1 + desloca + (enesimo - 1) * 7));
}

function sazonalMoveis(ano) {
  const pascoa = sazonalPascoa(ano);
  const nasMaes = sazonalEnesimoDiaDaSemana(ano, 4, 0, 2);   // 2o domingo de maio
  const nosPais = sazonalEnesimoDiaDaSemana(ano, 7, 0, 2);   // 2o domingo de agosto
  // Black Friday e a sexta seguinte a 4a quinta de novembro (Thanksgiving).
  const blackFriday = sazonalSomarDias(sazonalEnesimoDiaDaSemana(ano, 10, 4, 4), 1);

  return [
    { iso: sazonalIso(sazonalSomarDias(pascoa, -48)), nome: 'Segunda-feira de Carnaval', escopo: 'n', destaque: 1, feriado: 0 },
    { iso: sazonalIso(sazonalSomarDias(pascoa, -47)), nome: 'Carnaval',                   escopo: 'n', destaque: 1, feriado: 1 },
    { iso: sazonalIso(sazonalSomarDias(pascoa, -46)), nome: 'Quarta-feira de Cinzas',     escopo: 'n', destaque: 0, feriado: 0 },
    { iso: sazonalIso(sazonalSomarDias(pascoa,  -2)), nome: 'Sexta-feira Santa',          escopo: 'n', destaque: 1, feriado: 1 },
    { iso: sazonalIso(pascoa),                        nome: 'Páscoa',                     escopo: 'n', destaque: 1, feriado: 0 },
    { iso: sazonalIso(sazonalSomarDias(pascoa,  60)), nome: 'Corpus Christi',             escopo: 'n', destaque: 1, feriado: 1 },
    { iso: sazonalIso(nasMaes),                       nome: 'Dia das Mães',               escopo: 'n', destaque: 1, feriado: 0 },
    { iso: sazonalIso(nosPais),                       nome: 'Dia dos Pais',               escopo: 'n', destaque: 1, feriado: 0 },
    { iso: sazonalIso(blackFriday),                   nome: 'Black Friday',               escopo: 'i', destaque: 1, feriado: 0 },
    { iso: sazonalIso(sazonalSomarDias(blackFriday, 3)), nome: 'Cyber Monday',            escopo: 'i', destaque: 1, feriado: 0 }
  ];
}

// Todas as datas de um ano, ja ordenadas por dia.
function datasSazonaisDoAno(ano) {
  const fixas = SAZONAL_FIXAS.map(([dia, nome, escopo, destaque, feriado]) => ({
    iso: `${ano}-${dia}`, nome, escopo, destaque, feriado, movel: 0
  }));
  const moveis = sazonalMoveis(ano).map((d) => ({ ...d, movel: 1 }));
  return fixas.concat(moveis).sort((a, b) => a.iso.localeCompare(b.iso) || a.nome.localeCompare(b.nome));
}

/* ---------------------------------------------------------------------------
   A tela
   ------------------------------------------------------------------------- */

let SAZONAL_FILTRO = { ano: 0, mes: 0, escopo: 'todos', soFortes: false, busca: '' };

function garantirEstilosSazonais() {
  if (document.getElementById('sazonal-estilos')) return;
  const s = document.createElement('style');
  s.id = 'sazonal-estilos';
  s.textContent = `
    .sz-overlay { position:fixed; inset:0; background:rgba(0,0,0,.72); backdrop-filter:blur(10px);
      z-index:690; display:flex; align-items:center; justify-content:center; padding:20px;
      opacity:0; transition:opacity .25s ease; }
    .sz-overlay.aberto { opacity:1; }
    .sz-modal { width:100%; max-width:760px; max-height:calc(100vh - 40px); display:flex; flex-direction:column;
      background:radial-gradient(circle at top right, rgba(255,255,255,.05), transparent 70%), rgba(15,20,25,.9);
      backdrop-filter:blur(30px) saturate(1.2); border:1px solid rgba(255,255,255,.1); border-radius:24px;
      box-shadow:0 30px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.1);
      font-family:var(--mac-ui, sans-serif); transform:scale(.96) translateY(16px);
      transition:transform .35s cubic-bezier(.175,.885,.32,1.1); }
    .sz-overlay.aberto .sz-modal { transform:scale(1) translateY(0); }

    .sz-topo { padding:24px 28px 16px; border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0; }
    .sz-kicker { font:800 11px monospace; color:#00f0ff; letter-spacing:1px; text-transform:uppercase; }
    .sz-titulo-linha { display:flex; align-items:center; gap:14px; margin-top:10px; }
    .sz-titulo { font:700 22px/1.2 var(--mac-ui, sans-serif); color:#fff; margin:0; flex:1; }
    .sz-ano { display:flex; align-items:center; gap:2px; background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.1); border-radius:999px; padding:3px; }
    .sz-ano b { font:700 14px var(--mac-ui, sans-serif); color:#fff; padding:0 8px; min-width:46px; text-align:center;
      font-variant-numeric:tabular-nums; }
    .sz-ano button { width:26px; height:26px; border:0; border-radius:999px; background:transparent;
      color:#9fb4bf; cursor:pointer; font-size:14px; line-height:1; }
    .sz-ano button:hover { background:rgba(255,255,255,.1); color:#fff; }
    .sz-fechar { width:30px; height:30px; border:0; border-radius:999px; background:rgba(255,255,255,.07);
      color:#9fb4bf; cursor:pointer; font-size:18px; line-height:1; }
    .sz-fechar:hover { background:rgba(255,255,255,.14); color:#fff; }
    .sz-sub { font:400 13px/1.5 var(--mac-ui, sans-serif); color:#849aa6; margin:8px 0 0; }

    .sz-filtros { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:16px; }
    .sz-chip { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); color:#9fb4bf;
      border-radius:999px; padding:5px 13px; font:600 12px var(--mac-ui, sans-serif); cursor:pointer;
      transition:background .15s, color .15s, border-color .15s; }
    .sz-chip:hover { background:rgba(255,255,255,.1); color:#fff; }
    .sz-chip.ativo { background:#00f0ff; border-color:#00f0ff; color:#061016; }
    .sz-busca { flex:1; min-width:150px; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.12);
      border-radius:999px; padding:6px 14px; color:#fff; font:400 13px var(--mac-ui, sans-serif); outline:none; }
    .sz-busca:focus { border-color:rgba(0,240,255,.5); }

    .sz-meses { display:flex; gap:5px; overflow-x:auto; padding:14px 28px 0; flex-shrink:0;
      scrollbar-width:none; }
    .sz-meses::-webkit-scrollbar { display:none; }
    .sz-mes { flex-shrink:0; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.03);
      color:#849aa6; border-radius:10px; padding:6px 9px; font:700 11px var(--mac-ui, sans-serif);
      letter-spacing:.3px; text-transform:uppercase; cursor:pointer; }
    .sz-mes:hover { background:rgba(255,255,255,.09); color:#fff; }
    .sz-mes.ativo { background:rgba(0,240,255,.14); border-color:rgba(0,240,255,.45); color:#7fe8f5; }
    .sz-mes.vazio { opacity:.35; }

    .sz-lista { flex:1; overflow-y:auto; padding:14px 28px 8px; display:flex; flex-direction:column; gap:8px; }
    .sz-grupo { font:800 10px monospace; color:#5c7481; letter-spacing:1.4px; text-transform:uppercase;
      margin:10px 0 2px; }
    .sz-grupo:first-child { margin-top:0; }

    .sz-data { display:flex; align-items:center; gap:14px; width:100%; text-align:left;
      background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:14px;
      padding:11px 14px; cursor:pointer; transition:background .15s, border-color .15s, transform .12s; }
    .sz-data:hover { background:rgba(0,240,255,.07); border-color:rgba(0,240,255,.35); transform:translateX(2px); }
    .sz-data.passou { opacity:.42; }
    .sz-dia { flex-shrink:0; width:44px; text-align:center; }
    .sz-dia b { display:block; font:700 19px var(--mac-ui, sans-serif); color:#fff; line-height:1;
      font-variant-numeric:tabular-nums; }
    .sz-dia span { display:block; font:600 9px monospace; color:#5c7481; letter-spacing:.8px;
      text-transform:uppercase; margin-top:3px; }
    .sz-corpo { flex:1; min-width:0; }
    .sz-nome { display:block; font:600 14px/1.35 var(--mac-ui, sans-serif); color:#e8f2f6; }
    .sz-marcas { display:flex; flex-wrap:wrap; gap:6px; margin-top:5px; }
    .sz-marca { font:700 9px monospace; letter-spacing:.6px; text-transform:uppercase;
      border-radius:999px; padding:2px 7px; border:1px solid; }
    .sz-acao { flex-shrink:0; font:600 12px var(--mac-ui, sans-serif); color:#00f0ff; opacity:0;
      transition:opacity .15s; }
    .sz-data:hover .sz-acao { opacity:1; }

    .sz-vazio { text-align:center; color:#5c7481; font:400 13px var(--mac-ui, sans-serif); padding:38px 10px; }
    .sz-rodape { padding:12px 28px 20px; border-top:1px solid rgba(255,255,255,.06); flex-shrink:0;
      font:400 12px/1.5 var(--mac-ui, sans-serif); color:#5c7481; }


    @media (max-width:640px) {
      .sz-overlay { padding:0; }
      .sz-modal { max-width:100%; height:100vh; max-height:100vh; border-radius:0; border:none; }
      .sz-topo, .sz-meses, .sz-lista, .sz-rodape { padding-left:18px; padding-right:18px; }
    }`;
  document.head.appendChild(s);
}

function sazonalHojeIso() {
  if (typeof HOJE_ISO === 'string' && HOJE_ISO) return HOJE_ISO;
  return new Date().toISOString().slice(0, 10);
}

// O ano do calendario nao e "o ano de hoje" e sim o ano que ainda tem datas
// pela frente: abrir em 28 de dezembro num ano so de datas vencidas seria
// abrir numa tela cinza.
function sazonalAnoDeAbertura() {
  const hoje = sazonalHojeIso();
  const ano = Number(hoje.slice(0, 4));
  return hoje.slice(5) > '12-20' ? ano + 1 : ano;
}

function sazonalFiltrar(lista) {
  const f = SAZONAL_FILTRO;
  const busca = f.busca.trim().toLowerCase();
  return lista.filter((d) => {
    if (f.escopo !== 'todos' && d.escopo !== f.escopo) return false;
    if (f.soFortes && !d.destaque) return false;
    if (busca && !d.nome.toLowerCase().includes(busca)) return false;
    if (f.mes && Number(d.iso.slice(5, 7)) !== f.mes) return false;
    return true;
  });
}

function sazonalLinhaHtml(d, hoje) {
  const dia = d.iso.slice(8, 10);
  const semana = ['dom','seg','ter','qua','qui','sex','sáb'][new Date(d.iso + 'T12:00:00').getDay()];
  const escopo = SAZONAL_ESCOPOS[d.escopo] || SAZONAL_ESCOPOS.n;
  const marcas = [`<span class="sz-marca" style="color:${escopo.cor};border-color:${escopo.cor}55;background:${escopo.cor}18">${escopo.nome}</span>`];
  if (d.feriado) marcas.push('<span class="sz-marca" style="color:#ff5c7c;border-color:#ff5c7c55;background:#ff5c7c18">Feriado</span>');
  if (d.movel)   marcas.push('<span class="sz-marca" style="color:#849aa6;border-color:#849aa655;background:#849aa618">Muda todo ano</span>');
  const nome = typeof esc === 'function' ? esc(d.nome) : d.nome;
  return `<button type="button" class="sz-data ${d.iso < hoje ? 'passou' : ''}"
      onclick="sazonalEscolher('${d.iso}', this.dataset.nome)" data-nome="${nome.replace(/"/g, '&quot;')}">
      <span class="sz-dia"><b>${dia}</b><span>${semana}</span></span>
      <span class="sz-corpo"><span class="sz-nome">${nome}</span>
        <span class="sz-marcas">${marcas.join('')}</span></span>
      <span class="sz-acao">Cadastrar →</span>
    </button>`;
}

window.sazonalDesenhar = function() {
  const caixa = document.getElementById('sz-lista');
  if (!caixa) return;
  const f = SAZONAL_FILTRO;
  const todas = datasSazonaisDoAno(f.ano);
  const hoje = sazonalHojeIso();

  // A faixa de meses mostra quais meses tem algo depois do filtro: um mes que
  // ficaria vazio avisa antes do clique, em vez de premiar com uma tela em branco.
  const semMes = { ...f, mes: 0 };
  const antes = SAZONAL_FILTRO;
  SAZONAL_FILTRO = semMes;
  const semFiltroDeMes = sazonalFiltrar(todas);
  SAZONAL_FILTRO = antes;
  const porMes = {};
  semFiltroDeMes.forEach((d) => { const m = Number(d.iso.slice(5, 7)); porMes[m] = (porMes[m] || 0) + 1; });

  const faixa = document.getElementById('sz-meses');
  if (faixa) {
    faixa.innerHTML = `<button type="button" class="sz-mes ${f.mes === 0 ? 'ativo' : ''}"
        onclick="sazonalMes(0)">Ano todo</button>`
      + SAZONAL_MESES.map((nome, i) => `<button type="button"
        class="sz-mes ${f.mes === i + 1 ? 'ativo' : ''} ${porMes[i + 1] ? '' : 'vazio'}"
        onclick="sazonalMes(${i + 1})">${nome.slice(0, 3)}</button>`).join('');
  }

  const lista = sazonalFiltrar(todas);
  if (!lista.length) {
    caixa.innerHTML = '<div class="sz-vazio">Nenhuma data com esses filtros.</div>';
    return;
  }

  let mesAtual = 0;
  caixa.innerHTML = lista.map((d) => {
    const m = Number(d.iso.slice(5, 7));
    const cabecalho = m !== mesAtual ? `<div class="sz-grupo">${SAZONAL_MESES[m - 1]} de ${f.ano}</div>` : '';
    mesAtual = m;
    return cabecalho + sazonalLinhaHtml(d, hoje);
  }).join('');
};

window.sazonalMes    = function(m)   { SAZONAL_FILTRO.mes = m; sazonalDesenhar(); };
window.sazonalEscopo = function(e)   { SAZONAL_FILTRO.escopo = e;
  document.querySelectorAll('[data-escopo]').forEach((b) => b.classList.toggle('ativo', b.dataset.escopo === e));
  sazonalDesenhar(); };
window.sazonalFortes = function(btn) { SAZONAL_FILTRO.soFortes = !SAZONAL_FILTRO.soFortes;
  btn.classList.toggle('ativo', SAZONAL_FILTRO.soFortes); sazonalDesenhar(); };
window.sazonalBuscar = function(v)   { SAZONAL_FILTRO.busca = v || ''; sazonalDesenhar(); };
window.sazonalAno    = function(d)   { SAZONAL_FILTRO.ano += d;
  const alvo = document.getElementById('sz-ano-valor');
  if (alvo) alvo.textContent = SAZONAL_FILTRO.ano;
  sazonalDesenhar(); };

window.fecharCalendarioSazonal = function() {
  const o = document.getElementById('sz-overlay');
  if (!o) return;
  o.classList.remove('aberto');
  setTimeout(() => o.remove(), 260);
};

window.abrirCalendarioSazonal = function() {
  garantirEstilosSazonais();
  document.getElementById('sz-overlay')?.remove();

  const hoje = sazonalHojeIso();
  const ano = sazonalAnoDeAbertura();
  // Abre no mes de hoje quando o ano e o corrente; quando o calendario ja
  // pulou para o ano que vem, abre em janeiro, que e onde ele comeca.
  SAZONAL_FILTRO = {
    ano,
    mes: ano === Number(hoje.slice(0, 4)) ? Number(hoje.slice(5, 7)) : 1,
    escopo: 'todos', soFortes: false, busca: ''
  };

  const o = document.createElement('div');
  o.id = 'sz-overlay';
  o.className = 'sz-overlay';
  o.onclick = (e) => { if (e.target === o) fecharCalendarioSazonal(); };
  o.innerHTML = `
    <div class="sz-modal">
      <div class="sz-topo">
        <div class="sz-kicker">Calendário sazonal</div>
        <div class="sz-titulo-linha">
          <h2 class="sz-titulo">As datas do ano</h2>
          <div class="sz-ano">
            <button type="button" onclick="sazonalAno(-1)" title="Ano anterior">‹</button>
            <b id="sz-ano-valor">${ano}</b>
            <button type="button" onclick="sazonalAno(1)" title="Próximo ano">›</button>
          </div>
          <button type="button" class="sz-fechar" onclick="fecharCalendarioSazonal()" title="Fechar">×</button>
        </div>
        <p class="sz-sub">Clique numa data para cadastrar um conteúdo dela. A veiculação e o prazo de ouro já vêm preenchidos; o cliente e o formato você escolhe no fluxo normal.</p>
        <div class="sz-filtros">
          <button type="button" class="sz-chip ativo" data-escopo="todos" onclick="sazonalEscopo('todos')">Todas</button>
          <button type="button" class="sz-chip" data-escopo="n" onclick="sazonalEscopo('n')">Nacionais</button>
          <button type="button" class="sz-chip" data-escopo="i" onclick="sazonalEscopo('i')">Internacionais</button>
          <button type="button" class="sz-chip" data-escopo="e" onclick="sazonalEscopo('e')">Bahia</button>
          <button type="button" class="sz-chip" data-escopo="m" onclick="sazonalEscopo('m')">Municipais</button>
          <button type="button" class="sz-chip" onclick="sazonalFortes(this)">Só as principais</button>
          <input type="text" class="sz-busca" placeholder="Buscar data..." oninput="sazonalBuscar(this.value)">
        </div>
      </div>
      <div class="sz-meses" id="sz-meses"></div>
      <div class="sz-lista" id="sz-lista"></div>
      <div class="sz-rodape">Datas em cinza já passaram — dá para cadastrar mesmo assim, ou trocar o ano no topo.</div>
    </div>`;
  document.body.appendChild(o);
  sazonalDesenhar();
  // A classe 'aberto' e o que tira a tela do opacity:0. Deixar isso so no
  // requestAnimationFrame abre o calendario invisivel em aba fora de foco,
  // onde o quadro nunca chega — o cadastro ja tinha aprendido isso. O quadro
  // serve para a animacao ficar suave; o relogio garante que ela aconteca.
  requestAnimationFrame(() => o.classList.add('aberto'));
  setTimeout(() => o.classList.add('aberto'), 60);
};

/* ---------------------------------------------------------------------------
   Da data para o cadastro
   ------------------------------------------------------------------------- */

// O prazo de ouro sao sete dias antes da veiculacao. Para uma data que cai
// nesta semana, sete dias antes ja passou: nasceria atrasada. Nesse caso o
// prazo e hoje, e quem cadastra ve a data apertada em vez de um atraso.
function sazonalPrazoDe(iso) {
  const hoje = sazonalHojeIso();
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  const sete = d.toISOString().slice(0, 10);
  return sete < hoje ? (hoje < iso ? hoje : iso) : sete;
}

window.sazonalEscolher = function(iso, nome) {
  const dados = {
    veic: iso,
    prazo: sazonalPrazoDe(iso),
    titulo: nome,
    brief: `Conteúdo para ${nome} — ${iso.split('-').reverse().join('/')}.\n\nObjetivo:\nReferência:\nTom da marca:`
  };
  fecharCalendarioSazonal();
  // Se o cadastro ja esta aberto, cliente e formato podem estar escolhidos:
  // reabrir do zero jogaria fora o que a pessoa acabou de responder.
  if (document.getElementById('fc-overlay') && typeof fcPreencherDoCalendario === 'function') {
    fcPreencherDoCalendario(dados);
  } else if (typeof openCadastrosGoverned === 'function') {
    openCadastrosGoverned(dados);
  }
};
