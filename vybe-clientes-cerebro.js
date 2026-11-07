// vybe-clientes-cerebro.js — Cérebro do VYBES dentro do módulo Clientes.
//
// O Paulo pediu para ENXERGAR o que o VYBES sabe de cada cliente: o corpo do
// VYBES mora no módulo dele, mas a estrutura do que ele aprendeu não aparecia
// em lugar nenhum. Aqui cada cliente vira um mapa com nove categorias, e cada
// categoria responde três perguntas — o que é, por que o VYBES guarda isso e
// de onde veio — com o caminho para abrir a origem.
//
// Padrão Vybe (AGENTS.md): laranja só para ação e seleção; verde, vermelho e
// amarelo só para estado; ícone desenhado, nunca emoji; um controle por tipo
// (.vb-alternar, .vb-chip, .vb-botao, .vb-resumo); português de quem usa; e
// nada de animação contínua — o mapa desenha uma vez e só redesenha quando a
// pessoa mexe nele.

const CEREBRO_ICONES = {
  cliente: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
  identidade: '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/><path d="M12 20.5c-1.6 0-2-1.4-1-2.4.9-.9.3-2.1-1-2.1H8"/>',
  regras: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.6 7.4h.01"/>',
  ideias: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0012 3z"/>',
  atrasados: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  producao: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9.5h17M8 5l-2 4.5M13 5l-2 4.5M18 5l-2 4.5"/>',
  solicitacoes: '<path d="M6.5 3h7.5l4 4v14h-11.5z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h3"/>',
  arquivos: '<path d="M3.5 7.5a2 2 0 012-2h4l2 2.2h7a2 2 0 012 2V18a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/>',
  memoria: '<path d="M9 4.5a3 3 0 00-3 3 3 3 0 00-1.5 5.5A3 3 0 008 18a3 3 0 004 1.5V5.5A3 3 0 009 4.5z"/><path d="M15 4.5a3 3 0 013 3 3 3 0 011.5 5.5A3 3 0 0116 18a3 3 0 01-4 1.5"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  abrir: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10"/>',
  copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5"/>',
  apagar: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  mapa: '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="6" r="1.8"/><circle cx="19" cy="6" r="1.8"/><circle cx="5" cy="18" r="1.8"/><circle cx="19" cy="18" r="1.8"/><path d="M6.4 7.2l3.6 3M17.6 7.2l-3.6 3M6.4 16.8l3.6-3M17.6 16.8l-3.6-3"/>',
  lista: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  centro: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  voltar: '<path d="M15 5l-7 7 7 7"/>',
};
function cerebroIcone(nome) {
  return `<svg class="cb-ico" viewBox="0 0 24 24" aria-hidden="true">${CEREBRO_ICONES[nome] || CEREBRO_ICONES.cliente}</svg>`;
}

// As nove categorias. "porque" é a frase que o Paulo pediu: para que serve
// cada pedaço do cérebro na operação. "fonte" é a origem padrão; cada item
// ainda pode dizer a sua.
const VYBES_CEREBRO_GRUPOS = [
  { id: 'cliente', nome: 'Cliente', cor: '#ff8a35', icone: 'cliente',
    porque: 'É o centro do mapa. Tudo o que o VYBES sabe da conta se liga aqui.',
    fonte: 'Cadastro de clientes do Vybe OS' },
  { id: 'identidade', nome: 'Identidade e paleta', cor: '#e879a6', icone: 'identidade',
    porque: 'É a régua visual. Antes de aprovar ou sugerir ajuste numa peça, o VYBES compara cores, tipografia, estética e tom de voz com isto.',
    fonte: 'Estudo do VYBES sobre o perfil e o material da marca' },
  { id: 'regras', nome: 'Regras da direção de arte', cor: '#a78bfa', icone: 'regras',
    porque: 'É o filtro do Diretor de Arte do VYBES. Peça ou legenda que quebra uma destas regras vira sugestão de correção para o Deivid e para o grupo Vybe CEO.',
    fonte: 'Diretrizes do cliente estudadas pelo VYBES' },
  { id: 'instagram', nome: 'Instagram e formatos', cor: '#2dd4bf', icone: 'instagram',
    porque: 'Diz o que a conta publica e o que mais funciona nela. O VYBES usa para escolher o formato das sugestões e manter os 3 conteúdos por semana.',
    fonte: 'Auditoria do perfil do cliente no Instagram' },
  { id: 'ideias', nome: 'Banco de ideias e datas', cor: '#a3e635', icone: 'ideias',
    porque: 'São as pautas prontas para encaixar na semana. Aprovada a ideia, o VYBES cadastra a demanda com prazo, responsável e briefing.',
    fonte: 'Calendário sazonal + formatos campeões + ideias registradas aqui' },
  { id: 'atrasados', nome: 'Atrasados e pendências', cor: '#ff6b5a', icone: 'atrasados',
    porque: 'É o que está travando a conta: prazo vencido, alteração, ou esperando informação do cliente. O VYBES cobra isso primeiro nas rotinas do dia.',
    fonte: 'Quadros de Produção e Solicitações do Vybe OS' },
  { id: 'producao', nome: 'Conteúdos em produção', cor: '#fdba74', icone: 'producao',
    porque: 'Mostra se a semana do cliente está coberta. Com menos de 3 conteúdos previstos, o VYBES manda sugestão de pauta ao head e ao grupo Vybe CEO.',
    fonte: 'Quadro de Produção do Vybe OS' },
  { id: 'solicitacoes', nome: 'Solicitações da conta', cor: '#e7e5e4', icone: 'solicitacoes',
    porque: 'Pedidos avulsos e captações. Quando o cliente pede uma data de captação, o VYBES confere a agenda e pergunta no Vybe CEO antes de marcar.',
    fonte: 'Quadro de Solicitações do Vybe OS' },
  { id: 'arquivos', nome: 'Pastas, documentos e acessos', cor: '#d4a373', icone: 'arquivos',
    porque: 'Onde estão as fontes da conta: Drive, planejamento, acessos, atas e o dossiê que o VYBES lê. Endereço que falta aparece aqui para ser guardado.',
    fonte: 'Cadastro, documento de acessos e arquivos do VYBES' },
  { id: 'aprendizados', nome: 'Memória e aprendizados', cor: '#67e8f9', icone: 'memoria',
    porque: 'O que deu certo ou errado de verdade nesta conta. Pesa mais que regra genérica quando o VYBES monta uma sugestão nova.',
    fonte: 'Resultados do perfil e aprovações da equipe' },
];
const CEREBRO_ORDEM_MAPA = ['identidade', 'regras', 'instagram', 'ideias', 'atrasados', 'producao', 'solicitacoes', 'arquivos', 'aprendizados'];

// Onde mora o dossiê de cada cliente no computador do VYBES (c:\whatsapp-ia).
// O navegador não abre esses arquivos; o caminho aparece para quem quiser
// conferir ou corrigir a fonte.
const CEREBRO_DOSSIES = {
  'Academia Lions Top': 'academia-lions.md', 'Alpha1': 'alpha1.md', 'Antonov Center': 'antonov.md',
  'Brussolo Ristorante': 'brussolo.md', 'ConectaSim': 'conectasim.md', 'Copirecê': 'copirece.md',
  'DiaCenter': 'diacenter.md', 'DiaLab': 'dialab.md', 'Experimente Papelaria': 'experimente-papelaria.md',
  'Gonzalez Gastronomia': 'gonzalez.md', 'Hebravet': 'hebravet.md', 'Hellen Rocha Advocacia': 'hellen-rocha.md',
  'Serra Grande Bebidas': 'serra-grande.md', 'VÖA Sportswear': 'voa.md',
};


const VYBES_CEREBRO_BASE = [
  {
    nome: 'Brussolo Ristorante',
    apelidos: ['brussolo', 'brussolo ristorante', 'restaurante brussolo'],
    instagram: '@brussoloristorante',
    seguidores: '1.964 seguidores · Inaugurado em 26/09/2026',
    segmento: 'Alta Gastronomia Ítalo-Sertaneja · Irecê-BA',
    tom: 'Polido, maduro e apaixonado ("Gastronomia de Raiz. Técnica e Alma"). Conta a origem do prato unindo técnica italiana e ingredientes do sertão/Bahia (aipim, abóbora, rabada, queijo coalho, dendê).',
    paleta: [
      { nome: 'Maroon / Bordô', hex: '#5A1818' },
      { nome: 'Argila / Terracota', hex: '#A8543A' },
      { nome: 'Linho / Ecru', hex: '#F2ECE1' },
      { nome: 'Teal Profundo', hex: '#143B3F' },
      { nome: 'Dourado Latão', hex: '#C29B53' }
    ],
    tipografia: 'Serifa clássica editorial italiana (títulos) + sans-serif limpa e discreta (corpo). Nunca usar fonte varejista ou balão promocional.',
    estetica: 'Luz quente intimista de restaurante noturno, close na textura real do prato em louça orgânica, salão com plantas naturais, adega de madeira e jardim vertical.',
    linhaEditorial: [
      'Prato da Sexta — história, técnica e origem do prato no almoço executivo (12h às 15h)',
      'Tavola per Due — menu completo para dois no almoço de terça a quinta (R$ 139,90)',
      'Raiz e Técnica — encontro entre Itália e sertão (gnocchi de aipim, tortelli de abóbora)',
      'À mesa do Brussolo — vinhos, drinks autorais, sobremesas e experiência no salão'
    ],
    regras: [
      'Nunca colocar preço sobreposto no vídeo/Reels da Tavola per Due (preço vai só na legenda ou no final)',
      'Proibido português de Portugal ("gastronómico", "menu a partilhar") — usar sempre PT-BR',
      'Toda peça com vinho ou bebida alcoólica exige aviso obrigatório de consumo responsável (Lei 9.294/96)',
      'Black Friday sem desconto varejista; Consciência Negra sem apropriação superficial',
      'Nunca confundir nem reaproveitar ângulo do Gonzalez Gastronomia'
    ],
    aprendizados: [
      'Carrossel de pessoas na inauguração bateu 195 likes (6x a média de foto de prato isolado)',
      'Reels com pessoas (chef Francis/Miguel, brinde, serviço) batem 4,3 mil a 5,2 mil views',
      'Abertura aprovada na Tavola per Due: "Um almoço no Brussolo para ser dividido a dois."'
    ],
    formatos: [
      'Reels de Bastidor / Chef contando história do prato',
      'Carrossel Editorial Raiz & Técnica',
      'Reels Prato da Sexta (montagem real na cozinha)',
      'Campanha Tavola per Due'
    ],
    datas: [
      'Terça a Quinta: Tavola per Due (almoço executivo para dois)',
      'Toda Sexta: Série Prato da Sexta (Risoto de Rabada, Polvo, Ossobuco)',
      '19/11: Chegada do Beaujolais Nouveau (3ª quinta de novembro)',
      '26/11: Comemoração de 2 meses de casa'
    ]
  },
  {
    nome: 'Gonzalez Gastronomia',
    apelidos: ['gonzalez', 'gonzalez gastronomia', 'restaurante gonzalez'],
    instagram: '@gonzalezgastronomia',
    seguidores: '9.865 seguidores · 1.076 posts · Irecê-BA',
    segmento: 'Gastronomia Ibérica & Latino-Americana Autoral',
    tom: 'Caloroso, autoral e cheio de personalidade ("Cozinha de alma espanhola e coração brasileiro"). Chef Luiz Gonzalez é o rosto central da marca.',
    paleta: [
      { nome: 'Preto Carvão', hex: '#181818' },
      { nome: 'Âmbar / Fogo', hex: '#D96B27' },
      { nome: 'Vinho Espanhol', hex: '#7A1C1C' },
      { nome: 'Creme Quente', hex: '#F4EFE6' },
      { nome: 'Ouro Velho', hex: '#B8860B' }
    ],
    tipografia: 'Tipografia forte de personalidade ibérica/autoral; contraste alto sobre fundo escuro ou foto real.',
    estetica: 'Fogo alto, frigideira fumegando, paella borbulhando, iluminação quente da casa nova e presença constante do chef Luiz Gonzalez.',
    linhaEditorial: [
      'Chef Luiz Gonzalez na Bancada — carisma, preparo no fogo e convite pessoal',
      'Menu Executivo (Terça a Domingo, 11h30 às 15h) — entrada, prato principal e sobremesa',
      'Quinta Delas — noite com música ao vivo e benefícios para mesas femininas',
      'Clássicos Ibéricos & Mar — Paella, Polvo, Camarão, Filé à Parmegiana e Drinks'
    ],
    regras: [
      'Distinção estrita: Gonzalez = ibérico/latino-americano com chef Luiz na frente; nunca cruzar pauta com Brussolo',
      'Toda peça com sangria, vinho ou drink exige frase de consumo responsável',
      'Em vídeo do Menu Executivo, mostrar os 3 passos reais (entrada + principal + sobremesa)'
    ],
    aprendizados: [
      'Reels com o chef Luiz falando olhando para a câmera batem 5.900 a 9.950 views (3x a 5x mais que vídeo só de prato)',
      'Anúncio da casa nova com o chef teve 518 likes e 82 comentários — o público segue a pessoa do Luiz'
    ],
    formatos: [
      'Reels com Chef Luiz na Bancada / Fogo Alto',
      'Reels Menu Executivo Completo (3 tempos)',
      'Convite Quinta Delas (música ao vivo)',
      'Close-up Cinematográfico de Paella / Frutos do Mar'
    ],
    datas: [
      'Terça a Domingo: Menu Executivo no almoço',
      'Toda Quinta: Quinta Delas no jantar',
      '20/11: Feriado de sexta — almoço prolongado',
      'Novembro/Dezembro: Reservas de confraternizações de fim de ano'
    ]
  },
  {
    nome: 'VÖA Sportswear',
    apelidos: ['voa', 'voa sportswear', 'vöa', 'vöa sportswear'],
    instagram: '@use.voa',
    seguidores: '2.570 seguidores · Antonov Center, Irecê-BA',
    segmento: 'Moda Fitness Autoral & Activewear',
    tom: 'Direto, confiante e próximo ("Criada para acompanhar seu ritmo"). Fala de mulher para mulher sobre caimento real, cós que não enrola, zero transparência e compressão.',
    paleta: [
      { nome: 'Verde Militar / Oliva', hex: '#4A5D4E' },
      { nome: 'Marrom Café / Cacau', hex: '#4E3629' },
      { nome: 'Vermelho Cereja', hex: '#8B1E24' },
      { nome: 'Azul Cobalto', hex: '#1F3A60' },
      { nome: 'Off-White / Areia', hex: '#EAE5DF' }
    ],
    tipografia: 'Sans-serif geométrica minimalista, espaçamento editorial de moda, sem poluição de selos.',
    estetica: 'Luz natural valorizando a textura da poliamida/canelado, vídeo em movimento real de treino (agachamento, corrida) e provador com a fundadora.',
    linhaEditorial: [
      'Teste em Movimento — peça testada no treino real (agachamento, corrida, mobilidade)',
      'Três Formas de Usar — versatilidade do treino ao dia a dia (ex: Macaquinho VÖA)',
      'Detalhes de Engenharia Têxtil — zero transparência, cós anatômico, secagem rápida',
      'Comunidade VÖA — clientes e embaixadoras treinando em Irecê'
    ],
    regras: [
      'Sempre grafar "VÖA" com trema no Ö',
      'Zero promessa estética de corpo ("emagrece", "corpo perfeito") — focar no desempenho da peça',
      'Não prometer desconto na Black Week sem condição comercial confirmada pela cliente',
      'Evitar catálogo frio sem rosto humano: vídeos com a dona/clientes convertem até 4x mais'
    ],
    aprendizados: [
      'Reels da fundadora apresentando a loja bateu 8.817 views e 199 likes (melhor post da história da conta)',
      'Foto com rosto e movimento rende 3x a 4x mais engajamento que foto de cabide/arara'
    ],
    formatos: [
      'Reels com a Fundadora / Provador em Movimento',
      'Reels "1 Peça, 3 Momentos" (Treino, Rua, Viagem)',
      'Carrossel Close-up de Tecido & Costura'
    ],
    datas: [
      '23 a 27/11: Black Week VÖA (campanha principal do mês)',
      'Dezembro: Looks de treino de férias e presentes de Natal'
    ]
  },
  {
    nome: 'Academia Lions Top',
    apelidos: ['academia lions', 'academia lions top', 'lions', 'lions top'],
    instagram: '@academialionstop',
    seguidores: '5.573 seguidores · Rua Rio Iguaçu, 67, Irecê-BA',
    segmento: 'Academia & Treinamento Físico ("O Território dos Fortes")',
    tom: 'Direto, acolhedor, energético e sem clichê ("O território dos fortes é feito de quem não desiste").',
    paleta: [
      { nome: 'Preto Lions', hex: '#111111' },
      { nome: 'Amarelo / Dourado Leão', hex: '#F5B301' },
      { nome: 'Cinza Aço', hex: '#2B2D31' },
      { nome: 'Branco', hex: '#F8F9FA' }
    ],
    tipografia: 'Display condensada forte e esportiva em caixa-alta nos títulos + sans-serif limpa nos apoios.',
    estetica: 'Contraste preto e amarelo/dourado, alunos reais treinando, professores presentes no salão e equipamentos novos.',
    linhaEditorial: [
      'Orientação Prática de Treino — execução correta com os professores da Lions',
      'Cultura de Constância — segunda-feira, treino de sexta, disciplina real',
      'Bastidores & Comunidade — alunos reais, recepção, estrutura e horários'
    ],
    regras: [
      'Nunca usar banco de imagens genérico quando houver foto/vídeo real da Lions',
      'Distinção estrita da Antonov Center: Lions é "O Território dos Fortes" (comunidade, garra e proximidade)',
      'Sempre validar informações técnicas de exercício com os professores antes de postar'
    ],
    aprendizados: [
      'Vídeos curtos com professores corrigindo movimento e alunos reais geram mais salvamentos e directs de matrícula'
    ],
    formatos: [
      'Reels de Dica Prática de Execução no Aparelho',
      'Reels Comunidade / Energia do Treino na Lions',
      'Carrossel Mito vs. Verdade no Treino'
    ],
    datas: [
      'Novembro Azul: Saúde do homem e constância no treino',
      '20/11: Aviso de funcionamento no feriado',
      'Projeto Verão / Fim de Ano sem parar'
    ]
  },
  {
    nome: 'Antonov Center',
    apelidos: ['antonov', 'antonov academia', 'antonov center'],
    instagram: '@antonovcenter',
    seguidores: '15,5 mil seguidores · Irecê-BA',
    segmento: 'Academia Premium & Alta Performance (3.000 m²)',
    tom: 'Motivador, profissional, direto e inclusivo ("Estrutura que acelera o seu desempenho"). Diretriz do Vinícius: reduzir jargão de aviação e manter comunicação direta.',
    paleta: [
      { nome: 'Preto Hangar', hex: '#0F1115' },
      { nome: 'Prata / Titânio', hex: '#C7CDD6' },
      { nome: 'Azul Tecnológico', hex: '#1E64D8' },
      { nome: 'Branco Puro', hex: '#FFFFFF' }
    ],
    tipografia: 'Sans-serif geométrica tecnológica, grid limpo e moderno.',
    estetica: 'Hangar climatizado de 3.000 m², telão de LED, lockers com reconhecimento facial, bebedouro por pedal (higiene), 18+ treinadores.',
    linhaEditorial: [
      'Estrutura & Diferenciais Reais (3.000 m², avaliação física inclusa, Wellhub Silver / TotalPass)',
      'Treino, Mobilidade & Saúde (com validação dos professores)',
      'Comunidade em Movimento (aulas de dança, entrevistas com alunos, Antonov Run)'
    ],
    regras: [
      'Pautas 100% separadas da Hebravet e da VÖA (mesmo prédio, contas independentes)',
      'Nunca reaproveitar ângulo ou pauta da Academia Lions Top',
      'Não inventar função do vaso sanitário tecnológico nem usar "preço de inauguração" sem prazo final',
      'Proibido promessa de emagrecimento rápido ou antes/depois'
    ],
    aprendizados: [
      'Reels da aula de dança bateu 9.294 views; entrevista com aluno Hiago bateu 6.819 views e 970 likes',
      'Fotos reais da estrutura com legenda concreta performam muito melhor que frase motivacional (217 vs 22 likes)'
    ],
    formatos: [
      'Reels de Comunidade / Entrevista com Alunos e Aulas Coletivas',
      'Carrossel Explicativo (Planos First Class, Avaliação Física, Mobilidade)',
      'Fotografia de Estrutura com Benefício Concreto'
    ],
    datas: [
      'Novembro Azul: Saúde masculina e avaliação física',
      '19/11: Aviso de horário do feriado de 20/11',
      '27/11: Black Friday Antonov',
      '06/12: Comemoração de 6 meses de inauguração'
    ]
  },
  {
    nome: 'Hebravet',
    apelidos: ['hebravet', 'clinica hebravet', 'hebravet clinica veterinaria'],
    instagram: '@hebravetoficial',
    seguidores: '6.030 seguidores · Antonov Center, Loja 01',
    segmento: 'Clínica Veterinária & Pet Shop',
    tom: 'Técnico e acolhedor ("A evolução do cuidado animal"). Traduz medicina veterinária em linguagem simples e respeitosa para o tutor.',
    paleta: [
      { nome: 'Preto Fosco', hex: '#121316' },
      { nome: 'Verde-Limão Neon', hex: '#B8FF01' },
      { nome: 'Branco', hex: '#FFFFFF' },
      { nome: 'Cinza Escuro', hex: '#262930' }
    ],
    tipografia: 'Fonte Inter (sans-serif moderna); contraste marcante entre fundo preto fosco e acentos verde-limão neon.',
    estetica: 'Visual clínico de ponta (preto + verde neon) humanizado pelos doutores (Dr. Heuler Bastos, Dra. Jamila Braz, Dra. Jaine Mendes) e pets reais.',
    linhaEditorial: [
      'Segunda: Carrossel Educativo ("Cuidado que orienta" — carrapato/erliquiose, raiva, calor no sertão)',
      'Quarta: Serviços, Exames no Local, Banho & Tosa e Especialidades (cardiologia, ortopedia)',
      'Sábado: Sabadou / Pet da Semana (com autorização do tutor)'
    ],
    regras: [
      'Conteúdo clínico é educativo: nunca receitar remédio/dose e sempre convidar à avaliação presencial',
      'Não usar "24h" ou "emergência na madrugada" até confirmação oficial do funcionamento noturno',
      'Toda sigla/doença técnica (erliquiose, babesiose) precisa da explicação simples ("doença do carrapato")',
      'Cirurgia/internação: nunca usar imagem que choque'
    ],
    aprendizados: [
      'História dos fundadores, rosto do veterinário (Dr. Heuler / Dra. Jamila) e casos reais rendem 5x a 10x mais que card só de texto',
      'Anúncio de especialidade com nome da médica e data foi o melhor formato estático do mês'
    ],
    formatos: [
      'Reels com Dr. Heuler / Dra. Jamila explicando dúvida real do tutor',
      'Carrossel Educativo de Prevenção ("Cuidado que orienta")',
      'Card de Especialidade / Curso com Nome do Profissional'
    ],
    datas: [
      '07 e 08/11: Curso de Laboratório Clínico (parceria Divet)',
      '18/11: Novembro Azul dos Cães (prevenção da próstata em pets)',
      '27/11: Black Friday Hebravet',
      '30/11: Cuidados com fogos de artifício no fim de ano'
    ]
  },
  {
    nome: 'DiaCenter',
    apelidos: ['diacenter', 'clinica diacenter'],
    instagram: '@diacenterbahia',
    seguidores: '6.720 seguidores · Irecê e Seabra-BA',
    segmento: 'Saúde · Clínica de Hemodiálise & Nefrologia (11 Anos)',
    tom: 'Humano, acolhedor, responsável e educativo ("Quem entende de vida, cuida de você por inteiro"). Sem alarmismo e sem linguagem comercial.',
    paleta: [
      { nome: 'Azul Petróleo DiaCenter', hex: '#006888' },
      { nome: 'Verde Cuidado', hex: '#98C078' },
      { nome: 'Branco Clínico', hex: '#F7FAFC' },
      { nome: 'Azul Profundo', hex: '#003F54' }
    ],
    tipografia: 'Sans-serif humanista de alta legibilidade para pacientes renais e familiares.',
    estetica: 'Meta de 60% do feed com rostos reais da equipe multidisciplinar (nefrologia, enfermagem, nutrição, psicologia, fisioterapia, serviço social) e tecnologia DORA 6000.',
    linhaEditorial: [
      'Educação Prática para o Paciente Renal (controle de líquidos, fósforo, potássio, fístula)',
      'Gente DiaCenter (as 6 áreas da equipe que cuidam por inteiro em Irecê e Seabra)',
      'Direitos do Paciente (TFD, primeira sessão, encaminhamento)',
      'Collabs com @labdiacenter (prevenção e exame de creatinina)'
    ],
    regras: [
      'Proibido promessa médica, diagnóstico individual ou valores de referência/doses sem orientação médica',
      'Sempre encerrar orientações de saúde remetendo ao médico ou à equipe multiprofissional',
      'Proibido banco de imagens genérico em post principal e proibido foto de paciente sem autorização'
    ],
    aprendizados: [
      'Reels educativos puxam alcance massivo fora da base (Dia Mundial do Rim: 239 mil contas alcançadas)',
      'Série de nutrição prática ("Fruta na hemodiálise: proibida ou permitida?") gera alto salvamento'
    ],
    formatos: [
      'Carrossel Prático de Nutrição & Rotina na Hemodiálise',
      'Reels com Equipe Multidisciplinar (Nefrologia, Nutrição, Psicologia)',
      'Post Collab com @labdiacenter (Creatinina & Prevenção Renal)'
    ],
    datas: [
      '03/11: Novembro Azul (rim também é assunto de homem)',
      '12/11: Collab Creatinina com @labdiacenter',
      '14/11: Dia Mundial do Diabetes (principal causa de doença renal)',
      'Dezembro: Campanha "Unidos pelo Cuidado" e Dezembro Vermelho'
    ]
  },
  {
    nome: 'DiaLab',
    apelidos: ['dialab', 'diacenter laboratorio prime', 'laboratorio prime', 'labdiacenter'],
    instagram: '@labdiacenter',
    seguidores: 'Unidade Prime · Recanto das Árvores, Irecê-BA',
    segmento: 'Saúde · Laboratório de Análises Clínicas Prime',
    tom: 'Acolhedor, leve, educativo e premium acessível ("Mais que exames. Uma experiência de cuidado"). Foge do clima frio de hospital.',
    paleta: [
      { nome: 'Marrom Prime', hex: '#5B3A29' },
      { nome: 'Creme Acolhedor', hex: '#F5EFE6' },
      { nome: 'Dourado Suave', hex: '#C8A253' },
      { nome: 'Areia Quente', hex: '#E4D5C3' }
    ],
    tipografia: 'Fontes Calming (títulos elegantes) e Montserrat (corpo limpo e didático).',
    estetica: 'Paleta terrosa acolhedora (marrom, creme e dourado) com símbolo da borboleta. Destaques: Desjejum Prime, estacionamento fácil, atendimento infantil com mascote urso e Certificado de Coragem.',
    linhaEditorial: [
      'Check-ups Preventivos & Saúde (Novembro Azul, Check-up Kids, Diabetes, Creatinina)',
      'Diferenciais da Experiência Prime (Desjejum Prime, laudo no celular, coleta infantil sem trauma)',
      'Médicos Parceiros & Collabs com @diacenterbahia'
    ],
    regras: [
      'PROIBIDO mostrar agulha entrando na pele ou sangue em destaque',
      'Evitar o termo "Black Friday" em saúde (usar "Semana do Check-up")',
      'Materiais da ABRALAB devem ser 100% recriados na identidade marrom/creme/dourado do Prime',
      'Vagas de emprego entram apenas nos Stories, nunca no feed'
    ],
    aprendizados: [
      'Card do endocrinologista Dr. Luciano Dourado teve 5x a 10x o engajamento médio (serviço concreto + médico conhecido)',
      'Vlog da influenciadora mostrando a experiência real (coleta + Desjejum Prime) humaniza a conta'
    ],
    formatos: [
      'Card de Especialista / Médico Parceiro com Data',
      'Reels de Experiência Real (Coleta Infantil / Desjejum Prime)',
      'Carrossel Mitos e Verdades sobre Exames'
    ],
    datas: [
      'Novembro Azul: Saúde do homem além da próstata',
      '12/11: Exame de Creatinina (collab com @diacenterbahia)',
      '14/11: Dia Mundial do Diabetes',
      '20/11: Dia do Biomédico'
    ]
  },
  {
    nome: 'Hellen Rocha Advocacia',
    apelidos: ['hellen rocha', 'hellen rocha advocacia', 'dra hellen rocha', 'hellen'],
    instagram: '@hellenrochax',
    seguidores: '4.148 seguidores (verificada) · Irecê e Jussara-BA',
    segmento: 'Direito Previdenciário (INSS & Trabalhador Rural)',
    tom: 'Acessível, próximo, didático e responsável ("Defendendo Direitos, Valorizando Histórias"). Padrão de linguagem do interior: zero juridiquês, gancho na vida real da pessoa.',
    paleta: [
      { nome: 'Taupe Institucional', hex: '#9E8E7C' },
      { nome: 'Preto Traço Fino', hex: '#1A1A1A' },
      { nome: 'Off-White Papel', hex: '#F6F3EE' },
      { nome: 'Bege Médio', hex: '#C9BBAE' }
    ],
    tipografia: 'Clássica e super legível para público rural e idosos; traço preto fino e monograma "HR".',
    estetica: 'Fundo taupe (RGB 158, 142, 124), traço preto fino, monograma HR e capas de carrossel sempre com o rosto da Dra. Hellen Rocha.',
    linhaEditorial: [
      'Terça: Carrossel Educativo com rosto da Hellen na capa (regras do INSS traduzidas em termos simples)',
      'Quinzenal: Série "Alerta de Golpe" (falso advogado, consignado, falsa prova de vida)',
      'Território Rural (documentos da roça, salário-maternidade rural, BPC/LOAS)',
      'Fotos "A escolha do DA" (10 anos de advocacia em Irecê e Jussara)'
    ],
    regras: [
      'REGRA CRÍTICA OAB (Provimento 205/2021): publicidade 100% informativa; proibido "analise seu caso", promessa de benefício ou tom comercial',
      'Proibido juridiquês sem tradução ("acórdão" → "decisão final", "inconstitucional" → "derruba a exigência")',
      'Toda informação jurídica passa pela validação da Dra. Hellen'
    ],
    aprendizados: [
      'Reels de Alerta de Golpe bateu 16,7 mil views (maior da conta) e Dia do Agricultor bateu 10,7 mil views',
      'Foto pessoal da Hellen rende 55 a 76 likes contra apenas 7 a 14 likes em card só de texto (sempre usar rosto na capa!)'
    ],
    formatos: [
      'Reels de Alerta de Golpe (Utilidade Pública compartilhável)',
      'Reels / Carrossel Direitos do Trabalhador Rural',
      'Carrossel Educativo com Rosto da Hellen na Capa'
    ],
    datas: [
      '06/11 e 19/11: Alertas de Golpe (Falso Advogado e Falso Reembolso)',
      '13/11: 7 anos da Reforma da Previdência (regras de transição 2027)',
      '14/11 e 18/11: Pauta Rural (documentos da roça para o INSS)',
      '03/12: Dia Internacional da Pessoa com Deficiência (aposentadoria e BPC)'
    ]
  },
  {
    nome: 'Copirecê',
    apelidos: ['copirece', 'cooperativa copirece', 'puro milho'],
    instagram: '@copirece',
    seguidores: '16,9 mil seguidores · Irecê-BA',
    segmento: 'Agroindústria & Cooperativismo Familiar (Puro Milho)',
    tom: 'Gente do campo falando com orgulho, simplicidade e verdade ("Tradição que alimenta"). Divide todo mérito com as +600 famílias cooperadas.',
    paleta: [
      { nome: 'Amarelo Milho Vivo', hex: '#F2B705' },
      { nome: 'Verde Campo Cooperativo', hex: '#1E6B3A' },
      { nome: 'Terracota Raiz', hex: '#B84A27' },
      { nome: 'Creme Cuscuz', hex: '#FFF8E7' }
    ],
    tipografia: 'Forte, acolhedora e regional, destacando o selo Não Transgênico (QIMA/IBD) e a marca Puro Milho.',
    estetica: 'Fotos reais da lavoura com nome e comunidade do cooperado, linha Puro Milho (Flocão, Flocão Crioulo Vermelho, Penne sem glúten, Creme de Milho) e receitas tradicionais.',
    linhaEditorial: [
      'Toda Quarta: Receita Puro Milho (canjiquinha, mungunzá, cuscuz, penne)',
      'Campo & Cooperado com Nome e Lugar (Lagoa do Leite, Mata do Milho, João Dourado)',
      'Produto & Origem Não Transgênica (certificação QIMA/IBD, Flocão Vermelho em parceria com chef Rodrigo Oliveira / Mocotó)',
      'Cooperativismo & Alimentação Escolar (PNAE)'
    ],
    regras: [
      'PROIBIDO usar a palavra "merenda" (a presidente Zene odeia: usar sempre "alimentação escolar")',
      'Proibido afirmar "orgânico" ou "livre de agrotóxicos" na linha convencional (o selo é Não Transgênico)',
      'Proibido repetir a mesma foto em vários slides do carrossel',
      'Na lista Forbes da presidente Zene Vieira, manter tom coletivo do cooperativismo e nunca reproduzir logo da Forbes'
    ],
    aprendizados: [
      'Posts de campo com cooperado nomeado e comunidade são os campeões do perfil',
      'Ganchos fortes aprovados: "Nem todo flocão é igual" e valorização de quem planta na região'
    ],
    formatos: [
      'Fotografia / Reels de Cooperado Nomeado no Campo',
      'Receita de Quarta-feira com Produto Puro Milho',
      'Carrossel Origem & Certificação Não Transgênica (QIMA/IBD)'
    ],
    datas: [
      'Toda Quarta: Receita da Semana (Canjiquinha, Mungunzá, Penne)',
      '14/11: Plantio das Águas na região de Irecê',
      '20/11: Consciência Negra (herança africana do mungunzá)',
      '25/11: Aniversário da Copirecê (fundada em 1970/1971)'
    ]
  },
  {
    nome: 'Serra Grande Bebidas',
    apelidos: ['serra grande', 'serra grande bebidas', 'grupo serra grande', 'sergranbel'],
    instagram: '@gruposerragrandeoficial',
    seguidores: '7.398 seguidores · Irecê e Seabra-BA',
    segmento: 'Distribuição de Bebidas B2B · Revenda Heineken (40 Anos)',
    tom: 'Próximo, humano e regional, valorizando motoristas, equipe e o dono de bar/mercado. Ancorado em números, rotas e fatos reais.',
    paleta: [
      { nome: 'Verde Serra Grande / Heineken', hex: '#008248' },
      { nome: 'Azul Institucional', hex: '#0B3B60' },
      { nome: 'Dourado Selo 40 Anos', hex: '#D4AF37' },
      { nome: 'Branco / Gelo', hex: '#F4F7F6' }
    ],
    tipografia: 'Robusta e direta para leitura rápida do comerciante; selo oficial "40 anos (1986-2026)".',
    estetica: 'Carretas de 40 anos na estrada, câmaras frias, motoristas reais (Santiago, Nilson) e portfólio Heineken, Amstel, Amstel Ultra, Baden Baden, Praya e FYS.',
    linhaEditorial: [
      'Utilidade para o PDV (planejamento de estoque antes de feriados, organização de freezer, mix de especiais e 0.0)',
      'Série "Pé na Estrada" (rotina dos motoristas nas rotas de Irecê, Seabra e Chapada)',
      'Série "A Rota dos 40 Anos" (história com fundador Zé Abreu)',
      'Série "Reconhecendo Talentos" & Ações Internas (SIPATMA, Novembro Azul na Filial Seabra/Irecê)'
    ],
    regras: [
      'Proibido publicar preço, desconto ou promoção de bebida (na Black Friday, abordar planejamento de estoque)',
      'Em causas de saúde (Outubro Rosa, Novembro Azul), PROIBIDO colocar cerveja ou brinde na arte',
      'CTA oficial: "fale com o seu vendedor" ou telefones fixos (evitar "link na bio")',
      'Respeitar antecedência logística das rotas ao lembrar feriados'
    ],
    aprendizados: [
      'Títulos em pergunta para o lojista ("Seu freezer está vendendo por você?") funcionam muito bem',
      'Peças sobre feriado precisam sair com antecedência de rota (nunca na véspera do feriado)'
    ],
    formatos: [
      'Carrossel Utilidade para Bares & Mercados (Giro de Freezer / Mix)',
      'Reels Série "Pé na Estrada" e "A Rota dos 40 Anos"',
      'Cobertura de Eventos Internos nas Filiais (Irecê & Seabra)'
    ],
    datas: [
      '09/11: Cobertura Reunião Novembro Azul na Filial Seabra',
      '20/11: Planejamento de estoque para o feriadão de sexta',
      '27/11: Black Friday (planejamento de estoque e giro no PDV)',
      '30/11: 1ª parcela do 13º e pedidos combinados de Natal/Réveillon'
    ]
  },
  {
    nome: 'ConectaSim',
    apelidos: ['conectasim', 'conecta sim', 'conectasim provedor'],
    instagram: '@conectasimprovedor',
    seguidores: '6.155 seguidores · 10+ cidades e povoados na região de Irecê',
    segmento: 'Provedor de Internet Fibra Óptica Regional',
    tom: 'Leve, próximo e regional ("Diga sim à conectividade" / desmarketização). Entrega utilidade prática e atendimento 100% humano.',
    paleta: [
      { nome: 'Vinho ConectaSim', hex: '#650E2E' },
      { nome: 'Laranja Vibrante', hex: '#EE8D58' },
      { nome: 'Vermelho Quente', hex: '#D93829' },
      { nome: 'Branco Leitura', hex: '#FFFFFF' }
    ],
    tipografia: 'Moderna e amigável, contraste forte vinho + laranja.',
    estetica: 'Pessoas reais usando internet sem travar (família, gamer, home office) e presença nas cidades (Irecê, Ibipeba, América Dourada, Canarana, Segredo, Cabano, Cascável).',
    linhaEditorial: [
      'Wi-Fi sem Mistério (dicas práticas de roteador e sinal)',
      'Sábado: Fds Conectado (dicas de filmes/séries na Max, Paramount+ e ConectaSim TV)',
      'ConectaSim de Perto / Cidade Atendida (expansão nos municípios e povoados)',
      'Colabs com influenciadores locais (Raira França, Sávio gamer, Mateus)'
    ],
    regras: [
      'Nunca citar o nome antigo "Intersousa" nem inventar chip/telefonia',
      'Não usar preços antigos sem tabela vigente confirmada',
      'Fotos de equipe em campo precisam citar cidade/povoado e serviço real'
    ],
    aprendizados: [
      'Reels com Raira abrindo direto no benefício e falando com o povo do povoado ("Ô, meu povo de Segredo, vem cá...") foi aprovado após 3 ajustes',
      'Conteúdo de utilidade (Wi-Fi x Internet) e humor com a equipe dão personalidade ao feed'
    ],
    formatos: [
      'Carrossel Sábado "Fds Conectado" (Max & Paramount+)',
      'Carrossel "Wi-Fi sem Mistério" (Utilidade Prática)',
      'Reels Regional por Cidade / Povoado Atendido'
    ],
    datas: [
      'Todo Sábado: Carrossel Fds Conectado',
      '20/11: Aviso de atendimento no feriado',
      '23 a 27/11: Semana Black Friday ConectaSim',
      '30/11: Gancho do 13º e férias de dezembro com casa cheia'
    ]
  },
  {
    nome: 'Alpha1',
    apelidos: ['alpha1', 'alpha 1', 'alpha1 consultoria'],
    instagram: '@alpha1consultoria_',
    seguidores: '1.409 seguidores · Maceió-AL & 17 estados',
    segmento: 'Conectividade Corporativa B2B & Continuidade de Rede',
    tom: 'Confiante, executivo e direto ("Aqui sua empresa não navega, ela voa!" / "Mentalidade Alfa"). Fala a língua do dono/CFO/TI (faturamento, ERP parado, redundância).',
    paleta: [
      { nome: 'Azul Alpha Corporativo', hex: '#25467A' },
      { nome: 'Azul Noite Tech', hex: '#0F213C' },
      { nome: 'Ciano Rede', hex: '#38BDF8' },
      { nome: 'Branco / Prata', hex: '#F1F5F9' }
    ],
    tipografia: 'Executiva B2B, números de impacto em destaque (17 estados, 99,9%, +1.200 pontos).',
    estetica: 'Azul Alpha (#25467A), fotos reais do CEO Jairo Ribeiro, eventos BNI/AlphaTech e o mascote oficial Lobo.',
    linhaEditorial: [
      'Custo de Parada / Downtime (prejuízo de loja, supermercado ou hotel fora do ar)',
      'Série "O Lobo Explica" (mascote traduzindo failover, MPLS, Hotspot LGPD)',
      'Jairo Responde & Bastidores B2B (cases como restaurante Anamá e @alpha1eventos)'
    ],
    regras: [
      'Nunca posicionar como provedor residencial comum ("entregamos operação que não para")',
      'Sempre explicar siglas técnicas (failover, MPLS, LGPD)',
      'Preservar o mascote Lobo nas peças ilustradas/explicativas'
    ],
    aprendizados: [
      'Post "12 horas fora do ar? Prejuízo de centenas de milhares de reais" e fotos do Jairo/eventos rendem 10x a 15x mais que card frio',
      'Trocar CTA "Comente BASE" por Salvar, Encaminhar para o Sócio/TI e Direct'
    ],
    formatos: [
      'Post / Carrossel Custo de Downtime na Operação B2B',
      'Fotografia Executiva com CEO Jairo Ribeiro & Collabs',
      'Série Ilustrada "O Lobo Explica"'
    ],
    datas: [
      '06, 13, 23 e 27/11: Contagem e Plantão de Rede para a Black Friday do Varejo',
      '16/11: Internet para Eventos de Fim de Ano (collab @alpha1eventos)',
      '25/11: Alta Temporada na Hotelaria de Maceió (Wi-Fi + Alpha TV)'
    ]
  },
  {
    nome: 'Experimente Papelaria',
    apelidos: ['experimente', 'experimente papelaria'],
    instagram: '@experimentepapelaria',
    seguidores: '14,2 mil seguidores · Irecê-BA',
    segmento: 'Papelaria Criativa, Volta às Aulas & Programa Escola Viva',
    tom: 'Criativo, poético, curioso e acolhedor ("Toda descoberta começa com experimentação!"). Foco no processo criativo e parceria com gestores escolares.',
    paleta: [
      { nome: 'Roxo Experimente', hex: '#6D28D9' },
      { nome: 'Lilás Criativo', hex: '#A78BFA' },
      { nome: 'Amarelo Destaque', hex: '#FACC15' },
      { nome: 'Off-White Papel', hex: '#FDFBF7' }
    ],
    tipografia: 'Expressiva e acolhedora; assinatura "Experi-mente".',
    estetica: 'Universo roxo criativo, produtos licenciados em uso real, bastidores de pedidos com a dona e identidade institucional do Programa Escola Viva.',
    linhaEditorial: [
      'Vitrine & Bastidores (2 fotos/semana de produto em uso + vídeos de pedidos)',
      'Guia de Escolha (1 carrossel/semana: agenda x planner 2027, presentes por perfil)',
      'Datas & Purple Friday (a Black Friday roxa da Experimente)',
      'Programa Escola Viva (quinzenal para diretores de escolas públicas sobre PDDE e gestão)'
    ],
    regras: [
      'No Escola Viva, NUNCA escrever "na nossa escola" (a Experimente é parceira das escolas)',
      'Proibido português de Portugal ("secretária", "teu kit") e "link na bio" sem loja ativa',
      'Evitar foto de produto solto sem contexto humano'
    ],
    aprendizados: [
      'Reels de história/bastidor com a dona e entregas reais (35 kits de professores) batem 5x mais engajamento que foto de produto isolado',
      'Campanha de Volta às Aulas em novembro/janeiro ("De Volta ao Experimento" + app de 280 listas escolares) define o faturamento do ano'
    ],
    formatos: [
      'Reels de Bastidor e História com a Dona da Experimente',
      'Carrossel Guia de Escolha (Planners 2027 / Presentes)',
      'Carrossel Programa Escola Viva para Gestores Escolares'
    ],
    datas: [
      '12/11: Dia do Diretor de Escola (Programa Escola Viva)',
      '14/11: Dia Nacional da Alfabetização',
      '18 a 28/11: Campanha Purple Friday 2026',
      '30/11: Temporada de Amigo Secreto & Preparação Volta às Aulas 2027'
    ]
  },
  {
    nome: 'João Bacelar',
    apelidos: ['joao bacelar', 'deputado joao bacelar', 'campanha 2288'],
    instagram: '@deputadojoaobacelar',
    seguidores: 'Deputado Federal (5º mandato) · Bahia',
    segmento: 'Mandato Parlamentar & Prestação de Contas',
    tom: 'Institucional, municipalista e focado em entregas concretas nas cidades da base (Porto Seguro, Monte Santo, Quijingue, Canarana, Ibititá).',
    paleta: [
      { nome: 'Azul Institucional Mandato', hex: '#1D4ED8' },
      { nome: 'Verde Bahia / Brasil', hex: '#15803D' },
      { nome: 'Amarelo Destaque', hex: '#EAB308' }
    ],
    tipografia: 'Forte e direta, destacando o nome do município e a entrega realizada.',
    estetica: 'Fotos reais nas cidades da base e atuação na Comissão de Minas e Energia.',
    linhaEditorial: [
      'Série "Aqui tem João Bacelar" (carrossel com uma cidade por edição mostrando obras e recursos)',
      'Atuação Parlamentar na Bahia e em Brasília'
    ],
    regras: [
      'REGRA CRÍTICA TSE (Res. 23.610/2019 e 23.755/2026): PROIBIDO pedido explícito de voto em pré-campanha',
      'Não confundir com @deputadobacelar (outro político)'
    ],
    aprendizados: [
      'Carrosséis municipalistas citando cidade e entrega concreta geram compartilhamento nas lideranças locais'
    ],
    formatos: [
      'Carrossel Série "Aqui tem João Bacelar" (1 município por edição)'
    ],
    datas: [
      'Aniversários de emancipação dos municípios da base na Bahia'
    ]
  },
  {
    nome: 'DeBull Restaurante',
    apelidos: ['debull', 'de bull', 'debull restaurante'],
    instagram: '@debullrestaurante',
    seguidores: 'Steakhouse & Burger · Irecê-BA',
    segmento: 'Steakhouse & Hambúrguer Premium',
    tom: 'Marcante, apetitoso, premium e descontraído sem perder qualidade.',
    paleta: [
      { nome: 'Preto Brasa', hex: '#141413' },
      { nome: 'Vermelho Fogo', hex: '#B91C1C' },
      { nome: 'Âmbar Dourado', hex: '#D97706' }
    ],
    tipografia: 'Display forte estilo steakhouse sobre fundo escuro.',
    estetica: 'Brasa, fogo, suculência e cortes nobres em close-up.',
    linhaEditorial: ['Cortes na Brasa & Ponto da Carne', 'Hambúrgueres Artesanais & Experiência DeBull'],
    regras: ['Não repetir ângulos do Brussolo ou Gonzalez', 'Evitar artes frias que tirem o apetite visual'],
    aprendizados: ['Close-up de corte suculento na grelha é o maior gerador de desejo no feed'],
    formatos: ['Reels de Brasa & Corte', 'Fotografia Close-up de Burger/Steak'],
    datas: ['Quinta a Domingo: Movimento de Steakhouse & Happy Hour']
  },
  {
    nome: 'Irecê Modas',
    apelidos: ['irece modas', 'irecemodas'],
    instagram: '@irecemodas',
    seguidores: 'Multimarcas Premium · Irecê-BA',
    segmento: 'Moda Multimarcas Premium (Schutz, NV, Animale, Osklen)',
    tom: 'Elegante, comercial, refinado e direto.',
    paleta: [
      { nome: 'Preto Editorial', hex: '#111111' },
      { nome: 'Off-White Luxo', hex: '#F8F6F0' },
      { nome: 'Nude / Areia', hex: '#D6C7B2' }
    ],
    tipografia: 'Serifa fashion editorial + sans-serif minimalista.',
    estetica: 'Curadoria de grifes nacionais (Schutz, NV, Animale, Fórum, Osklen, Richards, Le\'Cecci).',
    linhaEditorial: ['Lançamentos & Curadoria de Marcas', 'Looks por Ocasião & Provador'],
    regras: ['Evitar linguagem popular demais que destoe do posicionamento premium das marcas'],
    aprendizados: ['Provador mostrando combinação completa de marcas aumenta conversão no WhatsApp'],
    formatos: ['Reels de Provador Premium', 'Carrossel Curadoria da Semana'],
    datas: ['Novembro/Dezembro: Looks de Confraternização, Natal e Réveillon']
  },
  {
    nome: 'Acquaville Park Show',
    apelidos: ['acquaville', 'acquavile', 'acquaville park show'],
    instagram: '@acquavilleirece',
    seguidores: '~48 mil seguidores · Irecê-BA',
    segmento: 'Parque Aquático, Lazer & Verão',
    tom: 'Solar, alegre, familiar e convidativo.',
    paleta: [
      { nome: 'Azul Piscina', hex: '#0284C7' },
      { nome: 'Amarelo Sol', hex: '#FACC15' },
      { nome: 'Laranja Verão', hex: '#F97316' }
    ],
    tipografia: 'Dinâmica, solar e festiva.',
    estetica: 'Sol, piscinas, toboáguas, bar molhado, quiosques, restaurante e área infantil.',
    linhaEditorial: ['Atrações & Estrutura para a Família', 'Agenda de Fim de Semana, Feriados e Verão'],
    regras: ['Sempre transmitir energia solar, segurança e lazer familiar'],
    aprendizados: ['Reels de parque cheio no sol com famílias e crianças lideram compartilhamentos'],
    formatos: ['Reels de Fim de Semana no Parque', 'Carrossel Estrutura Completa (Quiosques & Toboáguas)'],
    datas: ['Feriados de Novembro (02/11, 15/11, 20/11) e Temporada de Verão/Dezembro']
  },
  {
    nome: 'Feijão Panela de Ouro',
    apelidos: ['feijao panela de ouro', 'panela de ouro'],
    instagram: '@feijaopaneladeouro',
    seguidores: '930 seguidores · Irecê-BA',
    segmento: 'Alimentos · Feijão Embalado',
    tom: 'Acolhedor, familiar e tradicional ("Levando qualidade à mesa de sua família").',
    paleta: [
      { nome: 'Dourado Panela de Ouro', hex: '#D97706' },
      { nome: 'Marrom Grão', hex: '#5C3A21' },
      { nome: 'Vermelho Tradição', hex: '#B91C1C' }
    ],
    tipografia: 'Familiar e direta.',
    estetica: 'Grãos selecionados, caldo encorpado, mesa de família e tradição regional.',
    linhaEditorial: ['Receitas de Família & Dicas de Preparo', 'Qualidade dos Grãos & Produção'],
    regras: ['Ancorar sempre na qualidade real do grão e no sabor caseiro'],
    aprendizados: ['Fotos e receitas de feijão fresquinho na mesa geram identificação imediata'],
    formatos: ['Card / Carrossel de Receita Caseira', 'Reels de Preparo & Qualidade do Grão'],
    datas: ['Almoço de Domingo em Família e Receitas de Fim de Ano']
  }
];


// ── Estado da tela ────────────────────────────────────────────────────────────
const CEREBRO_STATE = {
  clienteFoco: 'todos',
  abaInterna: 'atividade',     // 'atividade' | 'mapa' | 'ficha'
  busca: '',
  buscaConhecimento: '',
  fonteFiltro: 'todas',
  ampliado: false,
  gruposAtivos: new Set(VYBES_CEREBRO_GRUPOS.map(g => g.id)),
  selecionado: null,           // { tipo: 'cliente'|'grupo'|'item', id }
  hover: null,
  grupoExpandido: null,
  grupoZoom: null,
  caixasRotulos: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  nodes: [],
  links: [],
  itens: new Map(),            // id do item -> item (com ações executáveis)
  arrastandoNo: null,
  arrastandoPan: false,
  moveu: false,
  mouseUltX: 0,
  mouseUltY: 0,
  desenhoPedido: false,
  desenhar: null,
};

function cerebroEsc(v) { return typeof safeText === 'function' ? safeText(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cerebroAspas(v) { return cerebroEsc(String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
function cerebroGrupo(id) { return VYBES_CEREBRO_GRUPOS.find(g => g.id === id) || VYBES_CEREBRO_GRUPOS[0]; }

function normalizarChaveCerebro(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function encontrarBaseCerebro(nomeCliente) {
  const q = normalizarChaveCerebro(nomeCliente);
  if (!q) return null;
  for (const item of VYBES_CEREBRO_BASE) {
    if (normalizarChaveCerebro(item.nome) === q) return item;
    if (item.apelidos.some(a => q === a || (q.length >= 4 && (` ${q} `).includes(` ${a} `)) || (a.length >= 4 && a.startsWith(q)))) return item;
  }
  return null;
}

// Rótulo curto para o mapa; o texto inteiro fica no inspetor.
function rotuloConcisoSinapse(texto) {
  const s = String(texto || '').trim();
  if (!s) return 'Sem título';
  const antesDoTraco = s.split(/\s+[—–]\s+/)[0];
  if (antesDoTraco.length >= 4 && antesDoTraco.length <= 30) return antesDoTraco.trim();
  const limpo = s.replace(/^REGRA CRÍTICA[^:]*:\s*/i, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (limpo.length <= 30) return limpo;
  let acc = '';
  for (const p of limpo.split(' ')) {
    if ((acc + ' ' + p).trim().length > 28) break;
    acc = (acc + ' ' + p).trim();
  }
  return (acc || limpo.slice(0, 27)) + '…';
}

// ── O que foi acrescentado no painel ──────────────────────────────────────────
// Regras, ideias e aprendizados novos. Ficam neste navegador até existir uma
// rota no servidor para o VYBES (bot) ler — a tela diz isso em cada item, para
// ninguém achar que o bot já está usando.
const CEREBRO_CHAVE_LOCAL = 'vybe_cerebro_custom_v1';
function cerebroLerExtras() {
  try { return JSON.parse(localStorage.getItem(CEREBRO_CHAVE_LOCAL) || '{}') || {}; } catch { return {}; }
}
function cerebroGravarExtras(dados) {
  try { localStorage.setItem(CEREBRO_CHAVE_LOCAL, JSON.stringify(dados)); return true; } catch { return false; }
}
function cerebroExtrasDo(nome) {
  const todos = cerebroLerExtras();
  const k = normalizarChaveCerebro(nome);
  const e = todos[k] || {};
  return { regras: e.regras || [], ideias: e.ideias || [], memoria: e.memoria || [] };
}
function cerebroQuemSou() {
  try { return (typeof sessaoAtual === 'function' && sessaoAtual()?.nome) || 'Painel'; } catch { return 'Painel'; }
}

// ── Datas e estados dos itens operacionais ────────────────────────────────────
const CEREBRO_CONCLUIDO = ['feito', 'finalizado', 'concluidas', 'concluida', 'concluído', 'concluídas', 'publicado'];
function cerebroHojeIso() { return (typeof HOJE_ISO === 'string' && HOJE_ISO) || new Date().toISOString().slice(0, 10); }
function cerebroIso(v) { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function cerebroDataBr(iso) { return iso ? iso.split('-').reverse().slice(0, 2).join('/') : ''; }
function cerebroTituloItem(i) { return String(i.nome || i.name || i.titulo || i.title || 'Sem título').trim(); }
function cerebroEstaConcluido(i) { return CEREBRO_CONCLUIDO.includes(normalizarChaveCerebro(i.status).replace(/ /g, '')) || CEREBRO_CONCLUIDO.includes(String(i.status || '').toLowerCase()); }
function cerebroPrazoIso(i) { return cerebroIso(i.prazo_iso) || cerebroIso(i.prazo) || cerebroIso(i.veiculacao_iso) || cerebroIso(i.veiculacao); }
function cerebroVeicIso(i) { return cerebroIso(i.veiculacao_iso) || cerebroIso(i.veiculacao); }
function cerebroEstaAtrasado(i) {
  if (cerebroEstaConcluido(i)) return false;
  if (i.prazo_atrasado) return true;
  const p = cerebroPrazoIso(i);
  return Boolean(p) && p < cerebroHojeIso();
}
function cerebroEstaPendente(i) {
  return !cerebroEstaConcluido(i) && /altera|ag\.?\s*info|falta\s*info|aguardando|cliente/i.test(String(i.status || ''));
}
function cerebroResponsaveis(i) {
  const ids = (i.responsavel_ids && i.responsavel_ids.length ? i.responsavel_ids : [i.responsavel_id]).filter(Boolean).map(String);
  const time = typeof TEAM_USERS === 'undefined' ? [] : TEAM_USERS;
  const nomes = ids.map(id => time.find(u => String(u.id) === id)?.name).filter(Boolean);
  return nomes.length ? nomes.join(', ') : String(i.responsavel || '').trim();
}

// ── Monta o cérebro de um cliente ─────────────────────────────────────────────
// Devolve as nove categorias com todos os itens (nada cortado). O mapa mostra
// só uma parte de cada; a ficha completa e o inspetor mostram tudo.
function cerebroDoCliente(nomeCliente) {
  const base = encontrarBaseCerebro(nomeCliente);
  const nome = base?.nome || nomeCliente;
  const registros = typeof clientMasterRecords === 'function' ? clientMasterRecords() : [];
  const rec = registros.find(r => chaveClienteAtividadeCerebro(r.name) === chaveClienteAtividadeCerebro(nome)
      || (base && encontrarBaseCerebro(r.name)?.nome === base.nome)) || { name: nome, content: [], requests: [], meta: {} };
  const nomeNoCadastro = rec.name || nome;
  const f = typeof cadastroDoCliente === 'function' ? (cadastroDoCliente(nomeNoCadastro) || {}) : {};
  const meta = rec.meta || (typeof clientMasterLinkedData === 'function' ? clientMasterLinkedData(nomeNoCadastro) : {}) || {};
  const idCadastro = typeof idDoCliente === 'function' ? idDoCliente(nomeNoCadastro) : '';
  const extras = cerebroExtrasDo(nome);
  const dossie = CEREBRO_DOSSIES[nome] ? `.vybe-ai-local/clientes/${CEREBRO_DOSSIES[nome]}` : '';
  const fonteEstudo = dossie
    ? `Dossiê do VYBES: c:\\whatsapp-ia\\${dossie.replace(/\//g, '\\')} e identidade-visual.js`
    : 'Estudo do VYBES em c:\\whatsapp-ia\\identidade-visual.js (ainda sem dossiê próprio)';
  const head = String(f.heads || meta.head || f.responsavel || '').trim();
  const link = (v) => (typeof linkDeCliente === 'function' ? linkDeCliente(v) : (/^https?:\/\//.test(String(v || '')) ? String(v) : ''));
  const instaUrl = base?.instagram ? `https://www.instagram.com/${base.instagram.replace(/^@/, '')}/` : '';
  const copiar = (texto, aviso) => () => {
    try { navigator.clipboard.writeText(texto); if (typeof showToast === 'function') showToast(aviso || 'Copiado.', 'success', 2500); }
    catch { if (typeof showToast === 'function') showToast('Não consegui copiar; selecione o texto.', 'info', 4000); }
  };

  const cats = {};
  CEREBRO_ORDEM_MAPA.forEach(id => { cats[id] = []; });
  let seq = 0;
  const add = (cat, item) => { cats[cat].push({ id: `${cat}-${seq++}`, grupo: cat, acoes: [], ...item }); };

  // 1. Identidade e paleta
  if (base) {
    (base.paleta || []).forEach(c => add('identidade', {
      titulo: `${c.nome} ${c.hex}`, curto: c.nome, cor: c.hex, hex: c.hex,
      detalhe: `Cor oficial da marca: ${c.nome} (${c.hex}).`,
      porque: 'Peça com cor fora desta paleta vira sugestão de ajuste para o Deivid.',
      fonte: fonteEstudo,
      acoes: [{ rotulo: `Copiar ${c.hex}`, icone: 'copiar', fazer: copiar(c.hex, `${c.hex} copiado.`) }],
    }));
    add('identidade', { titulo: 'Tipografia', detalhe: base.tipografia, fonte: fonteEstudo,
      porque: 'Fonte errada é o desvio de marca mais fácil de notar; o VYBES confere em toda peça.' });
    add('identidade', { titulo: 'Estética e fotografia', detalhe: base.estetica, fonte: fonteEstudo,
      porque: 'Define luz, enquadramento e cenário que a conta usa. Serve de briefing visual para captação.' });
    add('identidade', { titulo: 'Tom de voz', detalhe: base.tom, fonte: fonteEstudo,
      porque: 'As legendas que o VYBES sugere seguem este tom; legenda fora dele volta com sugestão.' });
  }

  // 2. Regras da direção de arte
  (base?.regras || []).forEach(r => add('regras', { titulo: rotuloConcisoSinapse(r), detalhe: r, fonte: fonteEstudo }));
  extras.regras.forEach(r => add('regras', {
    titulo: rotuloConcisoSinapse(r.texto), detalhe: r.texto, extra: { tipo: 'regras', id: r.id },
    fonte: `Acrescentada no painel por ${r.autor || 'alguém'} em ${cerebroDataBr(cerebroIso(r.em))} · guardada neste navegador (o bot ainda não lê)`,
  }));

  // 3. Instagram e formatos
  const fonteInsta = base?.instagram ? `Auditoria do perfil ${base.instagram} · ${base.seguidores || ''}`.trim() : 'Sem perfil estudado';
  const abrirInsta = instaUrl ? [{ rotulo: 'Abrir perfil no Instagram', icone: 'abrir', href: instaUrl }] : [];
  (base?.linhaEditorial || []).forEach(l => add('instagram', {
    titulo: rotuloConcisoSinapse(l), detalhe: l, sub: 'Linha editorial', fonte: fonteInsta, fonteLink: instaUrl, acoes: abrirInsta,
    porque: 'É uma das linhas fixas da conta. Sugestão nova precisa caber em uma delas.' }));
  (base?.formatos || []).forEach(fm => add('instagram', {
    titulo: rotuloConcisoSinapse(fm), detalhe: fm, sub: 'Formato que mais funciona', fonte: fonteInsta, fonteLink: instaUrl, acoes: abrirInsta,
    porque: 'Formato com melhor resultado no perfil; tem prioridade nas sugestões semanais.' }));

  // 4. Banco de ideias e datas
  const criarConteudo = (titulo, brief) => () => {
    if (typeof openCadastrosGoverned !== 'function') {
      if (typeof showToast === 'function') showToast('O cadastro de conteúdo não está disponível nesta tela.', 'warning', 4500);
      return;
    }
    openCadastrosGoverned({ board: 'producao', client: nomeNoCadastro, titulo, brief });
  };
  const formatos = base?.formatos || [];
  const linhas = base?.linhaEditorial || [];
  (base?.datas || []).forEach((dt, i) => {
    const formato = formatos.length ? formatos[i % formatos.length] : 'Formato a definir';
    const linha = linhas.length ? linhas[i % linhas.length] : '';
    const brief = `Gancho: ${dt}\nFormato sugerido: ${formato}${linha ? `\nLinha editorial: ${linha}` : ''}\n\nObjetivo:\nEstrutura:\nLegenda:\n\nCuidados (regras da conta):\n${(base?.regras || []).slice(0, 3).map(r => `- ${r}`).join('\n')}`;
    add('ideias', {
      titulo: rotuloConcisoSinapse(dt), detalhe: `${dt}\n\nFormato sugerido: ${formato}${linha ? `\nLinha editorial: ${linha}` : ''}`,
      sub: 'Data ou série da conta',
      porque: 'Data com gancho real para este cliente. O formato veio dos formatos que mais funcionam no perfil.',
      fonte: `${fonteEstudo} · calendário sazonal`,
      acoes: [{ rotulo: 'Criar conteúdo no painel', icone: 'mais', principal: true, fazer: criarConteudo(`${rotuloConcisoSinapse(dt)} — ${nome}`, brief) }],
    });
  });
  extras.ideias.forEach(ideia => {
    const brief = `Formato: ${ideia.formato || '—'}\n\nEstrutura / gancho:\n${ideia.gancho || '—'}\n\nLegenda:\n${ideia.legenda || '—'}\n\nPor que funciona:\n${ideia.porque || '—'}`;
    add('ideias', {
      titulo: ideia.titulo, sub: ideia.formato || 'Ideia registrada', extra: { tipo: 'ideias', id: ideia.id },
      detalhe: `${ideia.titulo}${ideia.formato ? `\nFormato: ${ideia.formato}` : ''}${ideia.gancho ? `\n\nEstrutura: ${ideia.gancho}` : ''}${ideia.legenda ? `\n\nLegenda: ${ideia.legenda}` : ''}`,
      porque: ideia.porque || 'Ideia registrada pela equipe no cérebro do cliente.',
      fonte: `Registrada no painel por ${ideia.autor || 'alguém'} em ${cerebroDataBr(cerebroIso(ideia.em))} · guardada neste navegador (o bot ainda não lê)`,
      acoes: [{ rotulo: 'Criar conteúdo no painel', icone: 'mais', principal: true, fazer: criarConteudo(ideia.titulo, brief) }],
    });
  });

  // 5, 6, 7. Operação: tudo que existe no painel para o cliente
  const itemOperacional = (i, quadro) => {
    const prazo = cerebroPrazoIso(i);
    const veic = cerebroVeicIso(i);
    const quem = cerebroResponsaveis(i);
    const fonteQuadro = quadro === 'request' ? 'Quadro de Solicitações' : 'Quadro de Produção';
    return {
      titulo: cerebroTituloItem(i), origem:'operacao', idOperacional:String(i.id), quadro, status:i.status || 'Sem status', veiculacao:veic, responsavel:quem,
      briefing:String(i.briefing || i.descricao || ''),
      sub: [i.status || 'Sem status', prazo ? `prazo ${cerebroDataBr(prazo)}` : '', veic && veic !== prazo ? `vai ao ar ${cerebroDataBr(veic)}` : ''].filter(Boolean).join(' · '),
      detalhe: [`Status: ${i.status || 'sem status'}`, prazo ? `Prazo: ${cerebroDataBr(prazo)}` : 'Sem prazo', veic ? `Veiculação: ${cerebroDataBr(veic)}` : '',
        quem ? `Responsável: ${quem}` : 'Sem responsável', i.formato ? `Formato: ${i.formato}` : ''].filter(Boolean).join('\n'),
      fonte: `${fonteQuadro} · item #${i.id}`,
      prazo,
      acoes: [{ rotulo: 'Abrir no painel', icone: 'abrir', principal: true,
        fazer: (ev) => (typeof abrirCartaoRapido === 'function' ? abrirCartaoRapido(i.id, ev, quadro) : null) }],
    };
  };
  const conteudos = (rec.content || []).filter(i => !cerebroEstaConcluido(i));
  const pedidos = (rec.requests || []).filter(i => !cerebroEstaConcluido(i));
  const porPrazo = (a, b) => String(cerebroPrazoIso(a) || '9999').localeCompare(String(cerebroPrazoIso(b) || '9999'));
  const travados = new Set();
  [...conteudos.map(i => [i, 'content']), ...pedidos.map(i => [i, 'request'])]
    .sort((a, b) => porPrazo(a[0], b[0]))
    .forEach(([i, quadro]) => {
      const atrasado = cerebroEstaAtrasado(i);
      const pendente = cerebroEstaPendente(i);
      if (!atrasado && !pendente) return;
      travados.add(String(i.id));
      add('atrasados', { ...itemOperacional(i, quadro), tom: atrasado ? 'alerta' : 'atencao',
        porque: atrasado ? 'Prazo vencido. O VYBES cobra o responsável e avisa o head da conta.'
          : 'Parado esperando alteração ou informação. O VYBES lembra quem precisa responder.' });
    });
  conteudos.filter(i => !travados.has(String(i.id))).sort(porPrazo).forEach(i => add('producao', itemOperacional(i, 'content')));
  pedidos.filter(i => !travados.has(String(i.id))).sort(porPrazo).forEach(i => add('solicitacoes', itemOperacional(i, 'request')));

  // 8. Pastas, documentos e acessos
  const aspasNome = nomeNoCadastro;
  const guardarNoDocumento = () => (typeof abrirDocumentoDoCliente === 'function'
    ? abrirDocumentoDoCliente(String(meta.acessoId || ''), aspasNome, idCadastro) : null);
  const porta = (titulo, url, faltando, comoGuardar, porque, fonte) => {
    if (url) add('arquivos', { titulo, sub: 'Abre em outra aba', detalhe: url, porque, fonte, fonteLink: url,
      acoes: [{ rotulo: `Abrir ${titulo.toLowerCase()}`, icone: 'abrir', principal: true, href: url }] });
    else add('arquivos', { titulo, sub: 'Sem endereço guardado', tom: 'atencao', detalhe: faltando, porque, fonte,
      acoes: comoGuardar ? [{ rotulo: 'Guardar endereço', icone: 'mais', fazer: comoGuardar }] : [] });
  };
  porta('Pasta no Drive', link(meta.drive || f.pasta_drive),
    'Ninguém guardou o endereço da pasta deste cliente ainda.', guardarNoDocumento,
    'É de onde saem fotos, vídeos e artes. O VYBES aponta a pasta quando cadastra uma demanda.',
    'Documento de acessos do cliente · campo Pasta no Drive');
  porta('Planejamento', link(f.planejamento_url || meta.planning),
    'Sem link do planejamento no cadastro.', () => (typeof abrirFichaDeCliente === 'function' ? abrirFichaDeCliente(aspasNome) : null),
    'É o combinado do mês com o cliente. As sugestões de pauta precisam conversar com ele.',
    'Cadastro do cliente · campo Link do planejamento');
  const outro = link(meta.link);
  if (outro || meta.temManus) porta(/manus\.im/i.test(outro) ? 'Projeto no Manus' : 'Link externo', outro,
    'Marcado como tendo projeto no Manus, mas sem endereço.', guardarNoDocumento,
    'Material de apoio da conta guardado fora do Vybe OS.', 'Documento de acessos do cliente · campo Link');
  add('arquivos', {
    titulo: 'Documento de acessos', sub: meta.doc ? 'Logins e senhas da conta' : 'Ainda sem documento',
    tom: meta.doc ? '' : 'atencao',
    detalhe: meta.doc ? 'Logins, senhas e telefones da conta. Só abre para quem administra.' : 'Este cliente ainda não tem documento de acessos. Abra para escrever o primeiro.',
    porque: 'Sem acesso ao Instagram ou ao gerenciador, nada é publicado. O VYBES avisa quando falta.',
    fonte: 'Vybe OS · Dados e acessos',
    acoes: [{ rotulo: meta.doc ? 'Abrir documento' : 'Escrever documento', icone: 'abrir', principal: true, fazer: guardarNoDocumento }],
  });
  if (idCadastro) add('arquivos', {
    titulo: 'Atas de reunião', sub: Number(f.atas) ? `${f.atas} ata(s)` : 'Nenhuma ata registrada',
    detalhe: 'O que ficou combinado nas reuniões com o cliente, com data e autor.',
    porque: 'Combinado de reunião vira regra ou ideia; o VYBES lê para não sugerir o que o cliente já recusou.',
    fonte: 'Cadastro do cliente · Atas de reunião',
    acoes: [{ rotulo: 'Abrir atas', icone: 'abrir', principal: true, fazer: () => abrirAtasDoCliente(aspasNome) }],
  });
  if (instaUrl) add('arquivos', { titulo: 'Perfil no Instagram', sub: base.instagram, detalhe: instaUrl, fonteLink: instaUrl,
    porque: 'É a vitrine que o VYBES estuda para revisar peças como diretor de arte.', fonte: fonteInsta,
    acoes: [{ rotulo: 'Abrir perfil', icone: 'abrir', principal: true, href: instaUrl }] });
  add('arquivos', {
    titulo: 'Dossiê do VYBES', sub: dossie ? dossie.split('/').pop() : 'Sem dossiê próprio', tom: dossie ? '' : 'atencao',
    detalhe: dossie
      ? `Arquivo que o VYBES lê antes de falar deste cliente:\nc:\\whatsapp-ia\\${dossie.replace(/\//g, '\\')}\n\nRegras gerais com clientes:\nc:\\whatsapp-ia\\conhecimento\\diretrizes-clientes.md\n\nFica no computador do VYBES; o navegador não abre esse arquivo.`
      : 'Este cliente ainda não tem dossiê em c:\\whatsapp-ia\\.vybe-ai-local\\clientes. O que aparece aqui veio do estudo geral de identidade visual.',
    porque: 'É a memória escrita do VYBES. Corrigir lá muda o que ele responde no WhatsApp e na central.',
    fonte: 'Computador do VYBES (c:\\whatsapp-ia)',
    acoes: dossie ? [{ rotulo: 'Copiar caminho', icone: 'copiar', fazer: copiar(`c:\\whatsapp-ia\\${dossie.replace(/\//g, '\\')}`, 'Caminho copiado.') }] : [],
  });

  // 9. Memória e aprendizados
  (base?.aprendizados || []).forEach(a => add('aprendizados', { titulo: rotuloConcisoSinapse(a), detalhe: a, fonte: `${fonteInsta} · ${fonteEstudo}` }));
  extras.memoria.forEach(m => add('aprendizados', {
    titulo: rotuloConcisoSinapse(m.texto), detalhe: m.texto, extra: { tipo: 'memoria', id: m.id },
    fonte: `Registrado no painel por ${m.autor || 'alguém'} em ${cerebroDataBr(cerebroIso(m.em))} · guardado neste navegador (o bot ainda não lê)`,
  }));

  // A mesma coleção alimenta o mapa, a ficha e a atividade.
  const estudo = cerebroEstudoDoCliente(nome);
  if (estudo) {
    const origem = { origem:'central', fonte:'Central local do VYBES · estudo disponível', atualizadoEm:CEREBRO_ATIVIDADE.dados?.geradoEm || null, consultadoEm:CEREBRO_ATIVIDADE.dados?.lidoEm || null };
    (estudo.ideias || []).forEach((i,idx) => add('ideias', { ...origem, id:`central:${chaveClienteAtividadeCerebro(nome)}:ideia:${idx}`, titulo:i.titulo, sub:i.formato || 'Sugestão', formato:i.formato, detalhe:i.briefing || i.porque, estrutura:i.estrutura, legenda:i.legenda, porque:i.porque, veiculacao:i.veicula, estado:'Sugestão do VYBES' }));
    (estudo.oportunidades || []).forEach((i,idx) => add('ideias', { ...origem, id:`central:${chaveClienteAtividadeCerebro(nome)}:oportunidade:${idx}`, titulo:rotuloConcisoSinapse(i.texto), detalhe:i.texto, estado:'Oportunidade identificada' }));
    (estudo.aprendizados || []).forEach((i,idx) => add('aprendizados', { ...origem, id:`central:${chaveClienteAtividadeCerebro(nome)}:aprendizado:${idx}`, titulo:rotuloConcisoSinapse(i.texto), detalhe:i.texto, prova:i.prova, incorporado:i.salvo === true, estado:i.salvo ? 'Já consta na ficha' : 'Candidato a aprendizado' }));
    (estudo.pendencias || []).forEach((texto,idx) => add('atrasados', { ...origem, id:`central:${chaveClienteAtividadeCerebro(nome)}:pendencia:${idx}`, titulo:rotuloConcisoSinapse(texto), detalhe:texto, fonte:'Ficha local lida pela central do VYBES', estado:'Pendência da ficha', tom:'atencao' }));
  }
  const origens = { central:0, operacao:0, referencia:0, navegador:0 };
  Object.values(cats).flat().forEach(it => {
    it.origem = it.extra ? 'navegador' : it.origem || 'referencia';
    origens[it.origem]++;
    if (it.origem === 'referencia') it.fonte = `Referência transcrita no painel. ${it.fonte || ''} O conteúdo da fonte não foi relido nesta consulta.`;
  });
  const termo = normalizarChaveCerebro(CEREBRO_STATE.buscaConhecimento);
  CEREBRO_ORDEM_MAPA.forEach(id => {
    cats[id] = cats[id].filter(it => (CEREBRO_STATE.fonteFiltro === 'todas' || it.origem === CEREBRO_STATE.fonteFiltro)
      && (!termo || normalizarChaveCerebro([it.titulo,it.detalhe,it.prova,it.estrutura,it.legenda].filter(Boolean).join(' ')).includes(termo)));
    cats[id].sort((a,b) => Number(b.origem === 'central') - Number(a.origem === 'central'));
  });

  // Ações de criar e apagar, ligadas a cada item ou categoria
  Object.values(cats).flat().forEach(it => {
    if (it.extra) it.acoes.push({ rotulo: 'Apagar', icone: 'apagar', perigo: true, fazer: () => cerebroApagarExtra(nome, it.extra.tipo, it.extra.id) });
  });

  const atrasados = cats.atrasados.filter(i => i.tom === 'alerta').length;
  return {
    nome, nomeNoCadastro, base, f, meta, head, idCadastro, instaUrl, dossie, estudo, origens,
    categorias: cats,
    resumo: {
      atrasados,
      pendencias: cats.atrasados.length - atrasados,
      producao: cats.producao.length,
      solicitacoes: cats.solicitacoes.length,
      ideias: cats.ideias.length,
      regras: cats.regras.length,
      concluidos: (rec.content || []).concat(rec.requests || []).filter(cerebroEstaConcluido).length,
    },
  };
}

// Clientes que aparecem na lista: os estudados + os ativos do cadastro.
function cerebroListaDeClientes() {
  const nomes = new Map();
  VYBES_CEREBRO_BASE.forEach(b => nomes.set(normalizarChaveCerebro(b.nome), b.nome));
  const registros = typeof clientMasterRecords === 'function' ? clientMasterRecords() : [];
  registros.forEach(r => {
    const f = typeof cadastroDoCliente === 'function' ? cadastroDoCliente(r.name) : null;
    const ativo = f ? (!/inativ/i.test(String(f.status || '')) && f.ativo !== false && !f.nao_e_cliente) : false;
    if (!ativo) return;
    const base = encontrarBaseCerebro(r.name);
    const nome = base ? base.nome : r.name;
    if (!nomes.has(normalizarChaveCerebro(nome))) nomes.set(normalizarChaveCerebro(nome), nome);
  });
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ── Grafo (posições fixas, calculadas uma vez) ────────────────────────────────
const CEREBRO_FOLHAS_NO_MAPA = 7;
function construirGrafoCerebro(clienteAlvo = 'todos') {
  const nodes = [];
  const links = [];
  const mapa = new Map();
  const addNode = (n) => { if (mapa.has(n.id)) return mapa.get(n.id); n.x0 = n.x; n.y0 = n.y; nodes.push(n); mapa.set(n.id, n); return n; };
  const addLink = (a, b) => { if (mapa.has(a) && mapa.has(b) && a !== b) links.push({ source: mapa.get(a), target: mapa.get(b) }); };
  CEREBRO_STATE.itens = new Map();

  if (!clienteAlvo || clienteAlvo === 'todos') {
    const lista = cerebroListaDeClientes();
    lista.forEach((nome, i) => {
      const anel = i < 8 ? 0 : 1;
      const qtd = anel === 0 ? Math.min(8, lista.length) : Math.max(1, lista.length - 8);
      const pos = anel === 0 ? i : i - 8;
      const ang = -Math.PI / 2 + (pos / qtd) * Math.PI * 2 + (anel ? Math.PI / qtd : 0);
      const r = anel === 0 ? 210 : 390;
      const base = encontrarBaseCerebro(nome);
      const c = cerebroDoCliente(nome);
      const cliNode = addNode({ id: `cli:${normalizarChaveCerebro(nome)}`, label: nome, grupo: 'cliente', nivel: 0, raio: 11,
        cor: base?.paleta?.[0]?.hex || '#ff8a35', angulo: ang, x: Math.cos(ang) * r, y: Math.sin(ang) * r,
        alerta: c.resumo.atrasados > 0,
        dados: { cliente: nome, paleta: base?.paleta || [], resumo: c.resumo, instagram: base?.instagram || '', segmento: base?.segmento || '' } });

      // Pilares orbitais ao redor de cada cliente na visão geral
      CEREBRO_ORDEM_MAPA.forEach((gid, sIdx) => {
        const itens = c.categorias[gid] || [];
        if (!itens.length) return;
        const sAng = ang + ((sIdx / CEREBRO_ORDEM_MAPA.length) - 0.5) * 1.5;
        const sDist = 38 + (sIdx % 2) * 12;
        const pNode = addNode({
          id: `cli:${normalizarChaveCerebro(nome)}:${gid}`,
          label: `${cerebroGrupo(gid).nome} (${itens.length})`,
          grupo: gid, nivel: 1, raio: 4.5,
          cor: cerebroGrupo(gid).cor,
          angulo: sAng,
          x: cliNode.x + Math.cos(sAng) * sDist,
          y: cliNode.y + Math.sin(sAng) * sDist,
          dados: { cliente: nome, grupoId: gid }
        });
        addLink(cliNode.id, pNode.id);
      });
    });
    const compartilhados = new Map();
    const registros = typeof clientMasterRecords === 'function' ? clientMasterRecords() : [];
    registros.forEach(rec => (rec.content || []).forEach(item => {
      if (!item.id) return;
      const nome = lista.find(n => chaveClienteAtividadeCerebro(n) === chaveClienteAtividadeCerebro(rec.name));
      if (!nome) return;
      const clientes = compartilhados.get(String(item.id)) || new Set(); clientes.add(nome); compartilhados.set(String(item.id),clientes);
    }));
    const ligados = new Set();
    compartilhados.forEach(clientes => { const nomes=[...clientes]; for(let i=0;i<nomes.length;i++) for(let j=i+1;j<nomes.length;j++) {
      const a=`cli:${normalizarChaveCerebro(nomes[i])}`, b=`cli:${normalizarChaveCerebro(nomes[j])}`, chave=[a,b].sort().join('|');
      if (!ligados.has(chave)) { addLink(a,b); ligados.add(chave); }
    }});
    return { nodes, links, listaClientes: lista };
  }

  const c = cerebroDoCliente(clienteAlvo);
  const cliId = `cli:${normalizarChaveCerebro(c.nome)}`;
  addNode({ id: cliId, label: c.nome, grupo: 'cliente', nivel: 0, raio: 18, cor: c.base?.paleta?.[0]?.hex || '#ff8a35',
    angulo: 0, x: 0, y: 0, dados: { cliente: c.nome } });
  CEREBRO_ORDEM_MAPA.forEach((gid, idx) => {
    const g = cerebroGrupo(gid);
    const itens = c.categorias[gid];
    itens.forEach(it => CEREBRO_STATE.itens.set(it.id, it));
    const semente = idx * 2.399963;
    const hx=Math.cos(semente)*240, hy=Math.sin(semente)*210;
    const ang = Math.atan2(hy,hx);
    const hubId = `grp:${gid}`;
    const rotulos = { identidade:'Identidade da marca', regras:'Direção de arte', instagram:'Instagram e formatos', ideias:'Ideias e datas', atrasados:'Pendências', producao:'Produção', solicitacoes:'Solicitações', arquivos:'Fontes e acessos', aprendizados:'Aprendizados' };
    addNode({ id: hubId, label: `${rotulos[gid] || g.nome} · ${itens.length}`, grupo: gid, nivel: 1, raio: 9 + Math.min(5, itens.length * 0.5),
      cor: g.cor, angulo: ang, x: hx, y: hy, alerta: gid === 'atrasados' && itens.length > 0,
      dados: { grupoId: gid } });
    addLink(cliId, hubId);
    const visiveis = itens.slice(0, CEREBRO_FOLHAS_NO_MAPA);
    const resto = itens.length - visiveis.length;
    const total = visiveis.length + (resto > 0 ? 1 : 0);
    const abertura = Math.min(0.62, 0.13 * total);
    visiveis.forEach((it, i) => {
      const t = total === 1 ? 0 : i / (total - 1) - 0.5;
      const a = ang + t * abertura;
      const r = 115 + (i % 2) * 55;
      addNode({ id: `it:${it.id}`, label: it.curto || rotuloConcisoSinapse(it.titulo.replace(/^(?:Fotografia|Card|Reels|Carrossel|Story|Feed)\s*[-–]\s*/i,'')), grupo: gid, nivel: 2, raio: it.hex ? 7 : 5.5,
        cor: it.cor || (it.tom === 'alerta' ? '#ff6b5a' : it.tom === 'atencao' ? '#f5c542' : g.cor),
        angulo: a, x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r, dados: { itemId: it.id } });
      addLink(hubId, `it:${it.id}`);
    });
    if (resto > 0) {
      const a = ang + 0.5 * abertura;
      addNode({ id: `mais:${gid}`, label: `+${resto} na lista`, grupo: gid, nivel: 2, raio: 5, cor: '#8b8f9c', angulo: a,
        x: hx + Math.cos(a) * 180, y: hy + Math.sin(a) * 180, dados: { grupoId: gid } });
      addLink(hubId, `mais:${gid}`);
    }
  });
  return { nodes, links, listaClientes: [c.nome], cerebro: c };
}

// ── Tela ──────────────────────────────────────────────────────────────────────
function renderCerebroVybesHtml(clienteFixo = null) {
  if (clienteFixo) CEREBRO_STATE.clienteFoco=clienteFixo;
  const todos=CEREBRO_STATE.clienteFoco==='todos';
  const grafo=construirGrafoCerebro(CEREBRO_STATE.clienteFoco);
  CEREBRO_STATE.nodes=grafo.nodes; CEREBRO_STATE.links=grafo.links;
  const c=grafo.cerebro || null;
  if (todos && CEREBRO_STATE.abaInterna==='ficha') CEREBRO_STATE.abaInterna='mapa';
  if (!cerebroSelecaoExiste(CEREBRO_STATE.selecionado)) CEREBRO_STATE.selecionado=null;
  const detalhe=['grupo','item'].includes(CEREBRO_STATE.selecionado?.tipo);
  const lista=[...new Set([...cerebroListaDeClientes(),...(CEREBRO_ATIVIDADE.dados?.clientes || []).map(x=>typeof clientMasterCanonicalName==='function'?clientMasterCanonicalName(x.cliente):x.cliente)])];
  const d=CEREBRO_ATIVIDADE.dados;
  const fonte=CEREBRO_ATIVIDADE.carregando ? 'Consultando a central…' : CEREBRO_ATIVIDADE.erro ? 'Central indisponível' : d ? `Central consultada às ${cerebroHora(d.lidoEm)}` : 'Central ainda não consultada';
  const total=c ? Object.values(c.categorias).flat().length : lista.length;
  const cabecalho=`<header class="cb-topo"><div class="cb-identidade">${cerebroIcone('mapa')}<div><b>CÉREBRO DO VYBES</b><small>Conhecimento, contexto e atividade</small></div></div>
    <label class="cb-cliente-seletor"><span>Cliente</span><select aria-label="Cliente do cérebro" onchange="focarClienteNoCerebro(this.value)"><option value="todos" ${todos?'selected':''}>Todos os clientes</option>${lista.map(n=>`<option value="${cerebroEsc(n)}" ${chaveClienteAtividadeCerebro(n)===chaveClienteAtividadeCerebro(CEREBRO_STATE.clienteFoco)?'selected':''}>${cerebroEsc(n)}</option>`).join('')}</select></label>
    <div class="vb-alternar" role="group" aria-label="Forma de ver o cérebro">${[['mapa','Mapa'],['atividade','Atividade'],...(!todos?[['ficha','Ficha']]:[])].map(([id,nome])=>`<button type="button" aria-pressed="${CEREBRO_STATE.abaInterna===id}" onclick="alternarAbaCerebro('${id}')">${nome}</button>`).join('')}</div>
    <button type="button" class="vb-botao cb-ampliar" onclick="ampliarCerebro()" aria-label="${CEREBRO_STATE.ampliado?'Recolher':'Ampliar'} cérebro">${CEREBRO_STATE.ampliado?'Recolher':'Ampliar'}</button></header>`;
  const controles=`<div class="cb-ferramentas"><label class="cb-pesquisa"><span>Buscar no conhecimento</span><input id="cb-busca-conhecimento" type="search" placeholder="Ideia, regra, peça ou aprendizado…" value="${cerebroEsc(CEREBRO_STATE.buscaConhecimento)}" oninput="pesquisarConhecimentoCerebro(this)" aria-label="Buscar no conhecimento"></label>
    <label class="cb-origem-filtro"><span>Origem</span><select aria-label="Filtrar por origem" onchange="filtrarOrigemCerebro(this.value)">${[['todas','Todas as fontes'],['central','Central do VYBES'],['operacao','Operação do painel'],['referencia','Referências cadastradas'],['navegador','Notas deste navegador']].map(([id,n])=>`<option value="${id}" ${CEREBRO_STATE.fonteFiltro===id?'selected':''}>${n}</option>`).join('')}</select></label>
    <button type="button" class="vb-botao" onclick="carregarAtividadeCerebro()" ${CEREBRO_ATIVIDADE.carregando?'disabled':''}>${CEREBRO_ATIVIDADE.carregando?'Consultando…':'Atualizar central'}</button></div>`;
  const contexto=`<div class="cb-contexto"><div><h2>${cerebroEsc(todos?'Rede de clientes':c.nomeNoCadastro || c.nome)}</h2><p>${cerebroEsc(todos?'As conexões entre contas vêm de conteúdos compartilhados no painel.':`${c.head?'Head: '+c.head+' · ':''}${total} registros no recorte`)}${CEREBRO_STATE.buscaConhecimento || CEREBRO_STATE.fonteFiltro!=='todas'?' · filtros ativos':''}</p></div><div class="cb-conexao ${CEREBRO_ATIVIDADE.erro?'cb-com-erro':''}"><i></i><span>${cerebroEsc(fonte)}</span></div></div>`;
  const areas=todos?'':`<details class="cb-areas"><summary>Explorar áreas</summary><div>${CEREBRO_ORDEM_MAPA.map(gid=>`<button type="button" aria-label="${cerebroEsc(cerebroGrupo(gid).nome)}, ${c.categorias[gid].length} itens" onclick="cerebroSelecionar('grupo','${gid}')"><i style="background:${cerebroGrupo(gid).cor}"></i><span>${cerebroEsc(cerebroGrupo(gid).nome)}</span><small>${c.categorias[gid].length}</small></button>`).join('')}</div></details>`;
  const caminho=`<div class="cb-mapa-trilho"><div class="cb-caminho"><button type="button" onclick="voltarRedeCerebro()">${todos?'Clientes':cerebroEsc(c.nomeNoCadastro || c.nome)}</button>${CEREBRO_STATE.grupoExpandido?`<span>›</span><button type="button" onclick="cerebroSelecionar('grupo','${CEREBRO_STATE.grupoExpandido}')">${cerebroEsc(cerebroGrupo(CEREBRO_STATE.grupoExpandido).nome)}</button>`:''}</div>${areas}</div>`;
  const mapa=`${caminho}<div class="cb-palco" id="vybes-cerebro-palco"><canvas id="vybes-cerebro-canvas" tabindex="0" aria-label="Rede de conhecimento. Use Explorar áreas para navegar pelo teclado; mais e menos para zoom, Escape para voltar."></canvas><div class="cb-palco-acoes"><button type="button" class="vb-botao" onclick="zoomCerebro(1.25)" aria-label="Aproximar mapa">+</button><button type="button" class="vb-botao" onclick="zoomCerebro(.8)" aria-label="Afastar mapa">−</button><button type="button" class="vb-botao" onclick="resetarCameraCerebro()">Enquadrar</button></div><div class="cb-mapa-rodape"><span>${todos?'Escolha um cliente para entrar na rede.':'Escolha uma área para revelar seu conteúdo.'}</span><span>Arraste para mover · + / − para explorar</span></div></div>`;
  const corpo=CEREBRO_STATE.abaInterna==='mapa'?mapa:CEREBRO_STATE.abaInterna==='ficha'&&c?renderDossieNeuralClienteHtml(c):renderAtividadeCerebroHtml();
  if (typeof window.setTimeout==='function' && !CEREBRO_ATIVIDADE.tentado) { CEREBRO_ATIVIDADE.tentado=true; window.setTimeout(carregarAtividadeCerebro,0); }
  return `<div class="vybes-cerebro-shell cb cb-${CEREBRO_STATE.abaInterna}${detalhe?' cb-com-detalhe':''}${CEREBRO_STATE.ampliado?' cb-ampliado':''}" id="vybes-cerebro-shell"><section class="cb-centro">${cabecalho}${controles}${contexto}${corpo}</section><aside class="cb-inspetor${detalhe?' cb-aberto':''}" id="vybes-cerebro-inspetor" aria-label="Detalhes da seleção" aria-live="polite"><button type="button" class="vb-link cb-fechar" onclick="recolherCerebro()">Fechar detalhes ×</button>${renderInspetorNoCerebroHtml(CEREBRO_STATE.selecionado,c)}</aside></div>`;
}

function cerebroSelecaoExiste(sel) {
  if (!sel) return false;
  if (sel.tipo === 'item') return CEREBRO_STATE.itens.has(sel.id);
  if (sel.tipo === 'grupo') return CEREBRO_STATE.clienteFoco !== 'todos';
  if (sel.tipo === 'cliente') return CEREBRO_STATE.clienteFoco === 'todos' || normalizarChaveCerebro(sel.id) === normalizarChaveCerebro(encontrarBaseCerebro(CEREBRO_STATE.clienteFoco)?.nome || CEREBRO_STATE.clienteFoco);
  return false;
}

function cerebroBotoesHtml(item) {
  return (item.acoes || []).map((a, i) => a.href
    ? `<a class="vb-botao${a.principal ? ' principal' : ''}" href="${cerebroEsc(a.href)}" target="_blank" rel="noopener">${cerebroIcone(a.icone || 'abrir')}${cerebroEsc(a.rotulo)}</a>`
    : `<button type="button" class="vb-botao${a.principal ? ' principal' : ''}${a.perigo ? ' perigo' : ''}" onclick="cerebroAcao('${cerebroEsc(item.id)}', ${i}, event)">${cerebroIcone(a.icone || 'abrir')}${cerebroEsc(a.rotulo)}</button>`).join('');
}

function cerebroNovoBotaoHtml(gid, comoPrincipal = false) {
  const rot = { regras: 'Nova regra', ideias: 'Nova ideia', memoria: 'Novo aprendizado' }[gid];
  return rot ? `<button type="button" class="vb-botao${comoPrincipal ? ' principal' : ''}" onclick="cerebroAbrirNovo('${gid}')">${cerebroIcone('mais')}${rot}</button>` : '';
}

function cerebroBlocoTexto(rotulo, texto, extra = '') {
  return texto ? `<section class="cb-insp-bloco"><h5>${cerebroEsc(rotulo)}</h5><p>${cerebroEsc(texto).replace(/\n/g, '<br>')}</p>${extra}</section>` : '';
}

function renderInspetorNoCerebroHtml(sel, c = null) {
  if (CEREBRO_STATE.clienteFoco === 'todos') {
    const nome = sel?.tipo === 'cliente' ? sel.id : null;
    if (!nome) {
      return `<div class="cb-insp-vazio">${cerebroIcone('mapa')}<b>Escolha um cliente</b>
        <p>Cada ponto é um cliente. As linhas ligam contas que o VYBES precisa tratar juntas ou manter separadas (mesmo prédio, mesmo nicho, collab).</p></div>`;
    }
    const cc = cerebroDoCliente(nome);
    return `<div class="cb-insp">
      <div class="cb-insp-tipo"><i style="background:${cerebroEsc(cc.base?.paleta?.[0]?.hex || '#ff8a35')}"></i>Cliente</div>
      <h3>${cerebroEsc(cc.nome)}</h3>
      <p class="cb-insp-sub">${cerebroEsc([cc.base?.instagram, cc.base?.segmento].filter(Boolean).join(' · '))}</p>
      ${typeof vbResumoHtml === 'function' ? vbResumoHtml([
        { valor: cc.resumo.atrasados, rotulo: 'atrasados', tom: cc.resumo.atrasados ? 'alerta' : '' },
        { valor: cc.resumo.producao, rotulo: 'em produção', tom: cc.resumo.producao < 3 ? 'atencao' : 'ok' },
        { valor: cc.resumo.ideias, rotulo: 'ideias' },
      ]) : ''}
      <div class="cb-insp-acoes"><button type="button" class="vb-botao principal" onclick="focarClienteNoCerebro('${cerebroAspas(cc.nome)}')">Abrir o cérebro deste cliente</button></div>
    </div>`;
  }
  c = c || cerebroDoCliente(CEREBRO_STATE.clienteFoco);
  if (!sel || sel.tipo === 'cliente') {
    const g = cerebroGrupo('cliente');
    return `<div class="cb-insp">
      <div class="cb-insp-tipo"><i style="background:${g.cor}"></i>Cliente</div>
      <h3>${cerebroEsc(c.nome)}</h3>
      ${cerebroBlocoTexto('O que é', [c.base?.segmento, c.base?.seguidores, c.head ? `Head: ${c.head}` : 'Sem head no cadastro'].filter(Boolean).join('\n'))}
      ${cerebroBlocoTexto('Como o cérebro está dividido', 'Nove categorias em volta do cliente. As três primeiras dizem como a marca deve parecer (identidade, regras, Instagram). Banco de ideias é o que pode entrar na semana. As três do meio são a operação de hoje no painel. Pastas guarda as fontes; memória guarda o que já se aprendeu.')}
      ${cerebroBlocoTexto('De onde vem', `Cadastro de clientes do Vybe OS + ${c.dossie ? `dossiê c:\\whatsapp-ia\\${c.dossie.replace(/\//g, '\\')}` : 'estudo geral do VYBES (sem dossiê próprio)'}`)}
      <section class="cb-insp-bloco"><h5>Categorias</h5><div class="cb-insp-cats">${CEREBRO_ORDEM_MAPA.map(gid => {
        const gg = cerebroGrupo(gid);
        return `<button type="button" class="cb-insp-cat" onclick="cerebroSelecionar('grupo','${gid}')"><i style="background:${gg.cor}"></i>${cerebroEsc(gg.nome)}<b>${c.categorias[gid].length}</b></button>`;
      }).join('')}</div></section>
    </div>`;
  }
  if (sel.tipo==='grupo') {
    const g=cerebroGrupo(sel.id),itens=c.categorias[sel.id] || [];
    const fontes=[...new Set(itens.map(i=>cerebroNomeOrigem(i.origem)))];
    return `<div class="cb-insp"><div class="cb-insp-tipo"><i style="background:${g.cor}"></i>Área de conhecimento</div><h3>${cerebroEsc(g.nome)}</h3><p>${itens.length} registros · ${cerebroEsc(fontes.join(' · '))}</p><div class="cb-insp-itens">${itens.map(it=>`<button type="button" class="cb-insp-item" onclick="cerebroSelecionar('item','${cerebroAspas(it.id)}')"><small class="cb-origem-tag">${cerebroEsc(cerebroNomeOrigem(it.origem))}${it.estado?' · '+cerebroEsc(it.estado):''}</small><b>${cerebroEsc(it.titulo)}</b><span>${cerebroEsc(String(it.detalhe || it.sub || 'Abra para conferir a origem.').slice(0,180))}</span></button>`).join('') || '<p>Nenhum registro neste recorte. Experimente limpar a busca ou mudar a origem.</p>'}</div><button type="button" class="vb-botao" onclick="cerebroIrPara('${sel.id}')">Ver esta área na ficha</button></div>`;
  }
  const it=CEREBRO_STATE.itens.get(sel.id); if(!it)return '';
  const g=cerebroGrupo(it.grupo);
  const uso=it.origem==='central'?(it.incorporado?'A central confirmou que este aprendizado já consta na ficha. O conteúdo completo dessa ficha não foi retornado.':'Registro do estudo do VYBES. Sugestão ou hipótese não vira regra automaticamente; a incorporação continua sendo revisada na central.'):it.origem==='operacao'?'Registro operacional do painel. Acompanhar uma peça não significa transformar seu conteúdo em aprendizado.':it.origem==='navegador'?'Anotação guardada neste navegador. Não alimenta o VYBES.':'Referência cadastrada na interface. O uso atual pelo VYBES não foi confirmado nesta leitura.';
  return `<div class="cb-insp"><div class="cb-insp-tipo"><button type="button" class="vb-link" onclick="cerebroSelecionar('grupo','${it.grupo}')">${cerebroEsc(g.nome)}</button></div><div class="cb-detalhe-meta"><span>${cerebroEsc(cerebroNomeOrigem(it.origem))}</span><span>${cerebroEsc(it.estado || it.status || 'Referência')}</span></div><h3>${cerebroEsc(it.titulo)}</h3>
    ${it.hex?`<div class="cb-amostra-grande" style="background:${cerebroEsc(it.hex)}"><span>${cerebroEsc(it.hex)}</span></div>`:''}
    ${cerebroBlocoTexto('Conteúdo completo',it.detalhe || it.sub || 'Esta fonte não retornou conteúdo descritivo.')}
    ${it.briefing?cerebroBlocoTexto('Briefing',it.briefing):''}${it.estrutura?cerebroBlocoTexto('Estrutura / roteiro',it.estrutura):''}${it.legenda?cerebroBlocoTexto('Legenda sugerida',it.legenda):''}
    ${it.porque?cerebroBlocoTexto('Justificativa registrada',it.porque):''}
    ${cerebroBlocoTexto('Evidência',it.prova || (it.origem==='operacao'?`Registro ${it.idOperacional} no quadro ${it.quadro==='request'?'Solicitações':'Produção'}.`:'Nenhum trecho de evidência foi retornado para este registro.'))}
    ${cerebroBlocoTexto('Origem e atualização',`${it.fonte || 'Origem não informada.'}\n${it.atualizadoEm?'Estudo: '+cerebroDataHora(it.atualizadoEm):'Data de atualização da fonte não informada.'}${it.consultadoEm?'\nConsultado: '+cerebroDataHora(it.consultadoEm):''}`)}
    ${cerebroBlocoTexto('Relações verificadas',`Cliente: ${c.nomeNoCadastro || c.nome}\nÁrea: ${g.nome}${it.idOperacional?'\nPeça vinculada: #'+it.idOperacional:''}\nNão há outros vínculos explícitos neste retorno.`)}
    ${cerebroBlocoTexto('Uso pelo VYBES',uso)}
    ${cerebroBlocoTexto('Histórico disponível',it.incorporado?'Presença na ficha confirmada nesta consulta. A API não retornou a data de incorporação nem revisões anteriores.':it.atualizadoEm?'Registro presente no estudo de '+cerebroDataHora(it.atualizadoEm)+'. Revisões anteriores não foram retornadas.':'Esta fonte não retornou histórico de revisões.')}
    <div class="cb-insp-acoes">${cerebroBotoesHtml(it)}</div></div>`;
}

// Ficha completa: as nove categorias em blocos, com tudo listado.
function renderDossieNeuralClienteHtml(cOuNome) {
  const c = typeof cOuNome === 'string' ? cerebroDoCliente(cOuNome) : cOuNome;
  c.categorias && Object.values(c.categorias).flat().forEach(it => CEREBRO_STATE.itens.set(it.id, it));
  return `<div class="cb-ficha">${CEREBRO_ORDEM_MAPA.map(gid => {
    const g = cerebroGrupo(gid);
    const itens = c.categorias[gid];
    const linhas = itens.map(it => `<div class="cb-linha${it.tom ? ' ' + it.tom : ''}">
        <button type="button" class="cb-linha-corpo" onclick="cerebroSelecionar('item','${cerebroEsc(it.id)}')">
          ${it.hex ? `<span class="cb-amostra" style="background:${cerebroEsc(it.hex)}"></span>` : ''}
          <span><b>${cerebroEsc(it.titulo)}</b>${it.sub ? `<small>${cerebroEsc(it.sub)}</small>` : ''}
          ${it.detalhe && it.detalhe !== it.titulo && gid !== 'atrasados' && gid !== 'producao' && gid !== 'solicitacoes' ? `<em>${cerebroEsc(it.detalhe.split('\n')[0])}</em>` : ''}</span>
        </button>
        <div class="cb-linha-acoes">${cerebroBotoesHtml({ ...it, acoes: (it.acoes || []).filter(a => !a.perigo).slice(0, 1).map(a => ({ ...a, principal: false })) })}</div>
      </div>`).join('');
    return `<section class="cb-bloco" id="cb-bloco-${gid}" style="--cb-cor:${g.cor}">
      <header class="cb-bloco-topo">
        <span class="cb-bloco-ico">${cerebroIcone(g.icone)}</span>
        <div><h3>${cerebroEsc(g.nome)} <small>${itens.length}</small></h3>
          <p><b>Por quê:</b> ${cerebroEsc(g.porque)}</p>
          <p class="cb-fonte"><b>De onde vem:</b> ${cerebroEsc(g.fonte)}</p></div>
        ${cerebroNovoBotaoHtml(gid)}
      </header>
      <div class="cb-bloco-corpo">${linhas || `<p class="cb-vazio-mini">${gid === 'atrasados' ? 'Nada atrasado nem parado. Bom sinal.' : 'Nada aqui ainda.'}</p>`}</div>
    </section>`;
  }).join('')}</div>`;
}

// Cartão dentro da ficha do cliente (renderClientMasterDetail)
function cerebroDoClienteCardHtml(nomeCliente) {
  const c = cerebroDoCliente(nomeCliente);
  const paleta = c.base?.paleta || [];
  return `
    <div class="client-master-detail-card cb-cartao" id="vybes-cli-cerebro-card">
      <div class="cli-ficha-topo">
        <h3>Cérebro do VYBES · Identidade Visual &amp; Sinapses</h3>
        <button type="button" class="vb-botao principal" onclick="abrirModalCerebroCliente('${cerebroAspas(c.nome)}')">Abrir Canvas de Sinapses</button>
      </div>
      <p>${c.base
        ? `O que o VYBES sabe desta conta: ${cerebroEsc(c.base.instagram || '')} · ${cerebroEsc(c.base.segmento || '')}. É com isto que ele revisa peças e sugere pautas.`
        : 'Este cliente ainda não tem estudo de identidade no VYBES. O cérebro mostra a operação, as pastas e o que a equipe registrar.'}</p>
      ${paleta.length ? `<div class="cb-cartao-paleta">${paleta.map(p => `<span title="${cerebroEsc(p.nome)}"><i style="background:${cerebroEsc(p.hex)}"></i>${cerebroEsc(p.hex)}</span>`).join('')}</div>` : ''}
      ${typeof vbResumoHtml === 'function' ? vbResumoHtml([
        { valor: c.resumo.atrasados, rotulo: 'atrasados', tom: c.resumo.atrasados ? 'alerta' : '' },
        { valor: c.resumo.pendencias, rotulo: 'pendências', tom: c.resumo.pendencias ? 'atencao' : '' },
        { valor: c.resumo.ideias, rotulo: 'ideias no banco' },
        { valor: c.resumo.regras, rotulo: 'regras de arte' },
      ]) : ''}
    </div>`;
}

// ── Ações ─────────────────────────────────────────────────────────────────────
function cerebroRepintar() {
  const grid = document.getElementById('grid-clientes-lista');
  if (!grid || (typeof visaoDeClientes === 'function' && visaoDeClientes() !== 'sinapses')) return;
  grid.innerHTML = renderCerebroVybesHtml(CEREBRO_STATE.clienteFoco);
  if (CEREBRO_STATE.abaInterna === 'mapa') iniciarMotorCanvasCerebro();
}
function cerebroPintarInspetor() {
  const insp = document.getElementById('vybes-cerebro-inspetor');
  if (insp) {
    const shell=document.getElementById('vybes-cerebro-shell');
    shell?.classList.toggle('cb-com-detalhe',['grupo','item'].includes(CEREBRO_STATE.selecionado?.tipo));
    insp.classList.toggle('cb-aberto', ['grupo','item'].includes(CEREBRO_STATE.selecionado?.tipo));
    insp.innerHTML = '<button type="button" class="vb-link cb-fechar" onclick="recolherCerebro()">Fechar detalhes ×</button>' + renderInspetorNoCerebroHtml(CEREBRO_STATE.selecionado);
  }
}
function cerebroSelecionar(tipo, id) {
  CEREBRO_STATE.selecionado = { tipo, id };
  if (tipo === 'grupo') { CEREBRO_STATE.grupoExpandido = id; document.querySelector('.cb-areas')?.removeAttribute('open'); }
  if (tipo === 'item') CEREBRO_STATE.grupoExpandido = CEREBRO_STATE.itens.get(id)?.grupo || null;
  if (tipo === 'cliente') CEREBRO_STATE.grupoExpandido = null;
  CEREBRO_STATE.hover = null;
  cerebroPintarInspetor();
  const trilho=document.querySelector('.cb-caminho');
  if(trilho && tipo==='grupo')trilho.innerHTML=`<button type="button" onclick="voltarRedeCerebro()">Cliente</button><span>›</span><span>${cerebroEsc(cerebroGrupo(id).nome)}</span>`;
  if (CEREBRO_STATE.desenhar) CEREBRO_STATE.desenhar();
  document.querySelectorAll('.cb-linha-corpo.sel').forEach(el => el.classList.remove('sel'));
}
function cerebroAcao(itemId, indice, event) {
  const it = CEREBRO_STATE.itens.get(String(itemId));
  const acao = it?.acoes?.[indice];
  if (acao?.fazer) acao.fazer(event);
}
function cerebroIrPara(gid) {
  if (CEREBRO_STATE.clienteFoco === 'todos') return;
  CEREBRO_STATE.selecionado = { tipo: 'grupo', id: gid };
  if (CEREBRO_STATE.abaInterna !== 'ficha') { CEREBRO_STATE.abaInterna = 'ficha'; cerebroRepintar(); }
  else cerebroPintarInspetor();
  setTimeout(() => document.getElementById(`cb-bloco-${gid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
}

function cerebroAbrirNovo(tipo) {
  if (CEREBRO_STATE.clienteFoco === 'todos' || typeof openWorkflowModal !== 'function') return;
  const nome = encontrarBaseCerebro(CEREBRO_STATE.clienteFoco)?.nome || CEREBRO_STATE.clienteFoco;
  const titulo = { regras: 'Nova regra de direção de arte', ideias: 'Nova ideia no banco', memoria: 'Novo aprendizado' }[tipo];
  const campos = tipo === 'ideias'
    ? `<label class="cli-campo largo"><span>Título da ideia</span><input id="cb-novo-titulo" type="text" maxlength="140" placeholder="Ex.: Bastidor do chef montando o prato da sexta"></label>
       <label class="cli-campo"><span>Formato</span><input id="cb-novo-formato" type="text" maxlength="80" placeholder="Reels, carrossel, foto…"></label>
       <label class="cli-campo largo"><span>Estrutura e gancho</span><textarea id="cb-novo-gancho" rows="3" placeholder="Abertura, desenvolvimento e chamada final"></textarea></label>
       <label class="cli-campo largo"><span>Legenda (opcional)</span><textarea id="cb-novo-legenda" rows="3"></textarea></label>
       <label class="cli-campo largo"><span>Por que funciona para este cliente</span><textarea id="cb-novo-porque" rows="2"></textarea></label>`
    : `<label class="cli-campo largo"><span>${tipo === 'regras' ? 'A regra, do jeito que o Deivid precisa ler' : 'O que aprendemos'}</span>
       <textarea id="cb-novo-texto" rows="4" placeholder="${tipo === 'regras' ? 'Ex.: Nunca usar preço sobreposto no vídeo' : 'Ex.: Reels com o chef falando para a câmera rendem 3x mais'}"></textarea></label>`;
  openWorkflowModal(`<div class="workflow-kicker"><span>Cérebro do VYBES · ${cerebroEsc(nome)}</span>
      <button class="workflow-close" type="button" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">${titulo}</h2>
    <p class="workflow-copy">Fica guardado neste navegador e aparece no cérebro na hora. O VYBES no WhatsApp ainda não lê o que é escrito aqui — para valer no bot, também precisa entrar no dossiê do cliente.</p>
    <div class="cli-form">${campos}</div>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="cerebroSalvarNovo('${tipo}')">Guardar</button></div>`);
  setTimeout(() => document.getElementById(tipo === 'ideias' ? 'cb-novo-titulo' : 'cb-novo-texto')?.focus(), 30);
}

function cerebroSalvarNovo(tipo) {
  const nome = encontrarBaseCerebro(CEREBRO_STATE.clienteFoco)?.nome || CEREBRO_STATE.clienteFoco;
  const v = (id) => String(document.getElementById(id)?.value || '').trim();
  const base = { id: `x${Date.now().toString(36)}`, autor: cerebroQuemSou(), em: new Date().toISOString() };
  let novo;
  if (tipo === 'ideias') {
    if (!v('cb-novo-titulo')) return typeof showToast === 'function' && showToast('Escreva o título da ideia.', 'warning', 3500);
    novo = { ...base, titulo: v('cb-novo-titulo'), formato: v('cb-novo-formato'), gancho: v('cb-novo-gancho'), legenda: v('cb-novo-legenda'), porque: v('cb-novo-porque') };
  } else {
    if (!v('cb-novo-texto')) return typeof showToast === 'function' && showToast('Escreva o texto antes de guardar.', 'warning', 3500);
    novo = { ...base, texto: v('cb-novo-texto') };
  }
  const todos = cerebroLerExtras();
  const k = normalizarChaveCerebro(nome);
  todos[k] = todos[k] || {};
  todos[k][tipo] = [...(todos[k][tipo] || []), novo];
  if (!cerebroGravarExtras(todos)) return typeof showToast === 'function' && showToast('O navegador não deixou guardar.', 'error', 5000);
  if (typeof closeWorkflowModal === 'function') closeWorkflowModal();
  if (typeof showToast === 'function') showToast('Guardado no cérebro deste cliente.', 'success', 3500);
  CEREBRO_STATE.selecionado = { tipo: 'grupo', id: tipo };
  cerebroRepintar();
}

async function cerebroApagarExtra(nome, tipo, id) {
  const ok = typeof perguntarNoPainel === 'function'
    ? await perguntarNoPainel({ titulo: 'Apagar este item do cérebro?', texto: 'Ele sai do cérebro deste cliente neste navegador.', confirmar: 'Apagar', perigo: true })
    : true;
  if (!ok) return;
  const todos = cerebroLerExtras();
  const k = normalizarChaveCerebro(nome);
  if (todos[k]?.[tipo]) todos[k][tipo] = todos[k][tipo].filter(x => x.id !== id);
  cerebroGravarExtras(todos);
  CEREBRO_STATE.selecionado = { tipo: 'grupo', id: tipo };
  cerebroRepintar();
}

function abrirModalCerebroCliente(nomeCliente) {
  CEREBRO_STATE.clienteFoco = encontrarBaseCerebro(nomeCliente)?.nome || nomeCliente;
  CEREBRO_STATE.abaInterna = 'atividade';
  CEREBRO_STATE.selecionado = null;
  if (typeof voltarClientesLista === 'function') voltarClientesLista();
  if (typeof trocarVisaoDeClientes === 'function') trocarVisaoDeClientes('sinapses');
}
function alternarAbaCerebro(qual) {
  CEREBRO_STATE.abaInterna = ['atividade', 'ficha', 'mapa'].includes(qual) ? qual : 'atividade';
  cerebroRepintar();
}
function focarClienteNoCerebro(qual) {
  CEREBRO_STATE.clienteFoco = qual || 'todos';
  CEREBRO_STATE.grupoExpandido = null; CEREBRO_STATE.grupoZoom = null;
  CEREBRO_STATE.selecionado = null;
  CEREBRO_STATE.panX = 0; CEREBRO_STATE.panY = 0; CEREBRO_STATE.zoom = 1;
  cerebroRepintar();
}
function filtrarCerebroVybes(termo) {
  CEREBRO_STATE.busca = String(termo || '');
  const caixa = document.getElementById('vybes-cerebro-arvore');
  if (!caixa) return;
  const t = normalizarChaveCerebro(termo);
  caixa.querySelectorAll('.cb-cli').forEach(b => { b.hidden = Boolean(t) && !normalizarChaveCerebro(b.textContent).includes(t); });
}
function alternarGrupoCerebro(gid) {
  if (CEREBRO_STATE.gruposAtivos.has(gid)) { if (CEREBRO_STATE.gruposAtivos.size > 2) CEREBRO_STATE.gruposAtivos.delete(gid); }
  else CEREBRO_STATE.gruposAtivos.add(gid);
  document.querySelectorAll('.cb-chip').forEach(b => {
    const id = (b.getAttribute('onclick') || '').match(/'([^']+)'/)?.[1];
    if (id) b.setAttribute('aria-pressed', String(CEREBRO_STATE.gruposAtivos.has(id)));
  });
  if (CEREBRO_STATE.abaInterna === 'ficha') {
    CEREBRO_ORDEM_MAPA.forEach(id => { const el = document.getElementById(`cb-bloco-${id}`); if (el) el.hidden = !CEREBRO_STATE.gruposAtivos.has(id); });
  }
  if (CEREBRO_STATE.desenhar) CEREBRO_STATE.desenhar();
}
function resetarCameraCerebro() {
  recolherCerebro();
  CEREBRO_STATE.panX = 0; CEREBRO_STATE.panY = 0; CEREBRO_STATE.zoom = 1;
  CEREBRO_STATE.nodes.forEach(n => { n.arrastado=false;n.tx=n.x0;n.ty=n.y0; });
  if (CEREBRO_STATE.desenhar) CEREBRO_STATE.desenhar();
}

function desenharPillCanvas(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Mapa: desenha sob demanda ─────────────────────────────────────────────────
// Sem física e sem laço contínuo: as posições são fixas, e o canvas só é
// redesenhado quando a pessoa passa o mouse, arrasta, aproxima ou clica.
function iniciarMotorCanvasCerebro() {
  CEREBRO_STATE.pararMotor?.();
  CEREBRO_STATE.desenhoPedido = false;
  const canvas = document.getElementById('vybes-cerebro-canvas');
  if (!canvas) { CEREBRO_STATE.desenhar = null; return; }
  const ctx = canvas.getContext('2d');
  const estilo = getComputedStyle(canvas);
  const tema = { acento: estilo.getPropertyValue('--vb-laranja').trim() || '#ff8a35', texto: estilo.getPropertyValue('--text').trim() || '#f1f2f6', mudo: estilo.getPropertyValue('--text-muted').trim() || '#8b8f9c', fonte: estilo.getPropertyValue('--mac-ui').trim() || 'system-ui, sans-serif' };
  if (!ctx) return;
  const todos = CEREBRO_STATE.clienteFoco === 'todos';
  let vivo = true, naTela = true, temporizador = null, presenca = null;
  const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const podeAnimar = () => vivo && naTela && !document.hidden && document.body.dataset.motion !== 'reduce' && !menosMovimento.matches;
  const retomar = () => { if (canvas.isConnected && podeAnimar()) pedir(); };
  CEREBRO_STATE.pararMotor = () => { vivo=false; clearTimeout(temporizador); presenca?.disconnect(); document.removeEventListener('visibilitychange',retomar); document.removeEventListener('change',retomar); };

  const medir = () => {
    const palco = canvas.parentElement;
    const rect = palco.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(320, Math.floor(rect.height));
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  // Cabe o mapa na área disponível na primeira pintura.
  const escalaBase = () => 1;
  let assinaturaLayout='';
  const reposicionar = () => {
    const largura=canvas.clientWidth, altura=canvas.clientHeight;
    const expandido=CEREBRO_STATE.grupoExpandido || (CEREBRO_STATE.zoom>=1.65?CEREBRO_STATE.grupoZoom:null);
    const nos=CEREBRO_STATE.nodes.filter(noVisivelCerebro);
    const assinatura=[largura,altura,expandido,nos.map(n=>n.id).join('|')].join(':');
    if(assinatura===assinaturaLayout)return;
    assinaturaLayout=assinatura;
    const layout=calcularLayoutRedeCerebro(nos,CEREBRO_STATE.links,{largura,altura,expandido});
    nos.forEach(n=>{const p=layout.get(n.id);n.tx=p.x-largura/2;n.ty=p.y-altura/2;n.x0=n.tx;n.y0=n.ty;
      if(!n.posicionado || !podeAnimar()){n.x=n.tx;n.y=n.ty;}n.posicionado=true;});
  };


  const visivel = (n) => noVisivelCerebro(n);
  const escala = () => escalaBase() * CEREBRO_STATE.zoom;
  const telaParaMundo = (sx, sy) => {
    const w = canvas.clientWidth, h = canvas.clientHeight, e = escala();
    return { x: (sx - w / 2 - CEREBRO_STATE.panX) / e, y: (sy - h / 2 - CEREBRO_STATE.panY) / e };
  };
  const acharNo = (sx, sy) => {
    const rotulo = CEREBRO_STATE.caixasRotulos.find(b => sx >= b.x && sx <= b.x+b.w && sy >= b.y && sy <= b.y+b.h && visivel(b.no));
    if (rotulo) return rotulo.no;
    const p = telaParaMundo(sx, sy);
    const folga = 6 / escala();
    for (let i = CEREBRO_STATE.nodes.length - 1; i >= 0; i--) {
      const n = CEREBRO_STATE.nodes[i];
      if (!visivel(n)) continue;
      const r = (n.nivel === 0 ? 27 / escala() : n.raio) + folga;
      if ((p.x - n.x) ** 2 + (p.y - n.y) ** 2 <= r * r) return n;
    }
    return null;
  };
  const selecionadoNo = () => {
    const s = CEREBRO_STATE.selecionado;
    if (!s) return null;
    if (s.tipo === 'item') return CEREBRO_STATE.nodes.find(n => n.dados?.itemId === s.id) || null;
    if (s.tipo === 'grupo') return CEREBRO_STATE.nodes.find(n => n.id === `grp:${s.id}`) || null;
    return CEREBRO_STATE.nodes.find(n => n.nivel === 0 && normalizarChaveCerebro(n.dados?.cliente) === normalizarChaveCerebro(s.id)) || null;
  };

  const pintar = () => {
    CEREBRO_STATE.desenhoPedido = false;
    if (!vivo || !canvas.isConnected) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, e = escala();
    reposicionar();
    const tempo = performance.now();
    CEREBRO_STATE.nodes.forEach(n=>{if(!n.arrastado&&Number.isFinite(n.tx)){n.x+=(n.tx-n.x)*.18;n.y+=(n.ty-n.y)*.18;if(!podeAnimar()){n.x=n.tx;n.y=n.ty;}}});
    ctx.clearRect(0, 0, w, h);
    // Profundidade do campo: textura decorativa, sem representar dados novos.
    for (let i=0;i<34;i++) { const x=((i*193+53)%997)/997*w, y=((i*137+29)%701)/701*h; ctx.fillStyle='rgba(255,255,255,0.085)'; ctx.beginPath(); ctx.arc(x,y,i%5===0?1.2:0.6,0,Math.PI*2); ctx.fill(); }
    ctx.save();
    ctx.translate(w / 2 + CEREBRO_STATE.panX, h / 2 + CEREBRO_STATE.panY);
    ctx.scale(e, e);

    const foco = CEREBRO_STATE.hover || selecionadoNo();
    const vizinhos = new Set();
    if (foco) {
      vizinhos.add(foco.id);
      CEREBRO_STATE.links.forEach(l => {
        if (l.source.id === foco.id) vizinhos.add(l.target.id);
        if (l.target.id === foco.id) vizinhos.add(l.source.id);
      });
    }
    const destaque = CEREBRO_STATE.hover || (CEREBRO_STATE.grupoExpandido ? selecionadoNo() : null);

    // Sinapses curvas: a seleção revela o trajeto; o fluxo é visual, não um status de processamento.
    CEREBRO_STATE.links.forEach((l,indice) => {
      if (!visivel(l.source) || !visivel(l.target)) return;
      const aceso = foco && foco.nivel > 0 && (l.source.id === foco.id || l.target.id === foco.id);
      const apagado = destaque && !aceso;
      const a=l.source,b=l.target, dx=b.x-a.x,dy=b.y-a.y;
      const curva=(indice%2 ? 1 : -1)*0.19;
      const c1={x:a.x+dx*.3-dy*curva,y:a.y+dy*.3+dx*curva};
      const c2={x:a.x+dx*.72+dy*curva*.35,y:a.y+dy*.72-dx*curva*.35};
      const caminho=()=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,b.x,b.y);};
      caminho();
      ctx.lineWidth=(aceso?6:2)/e;
      ctx.strokeStyle=aceso?'rgba(255,138,53,.07)':apagado?'rgba(255,255,255,.012)':'rgba(255,138,53,.035)';ctx.stroke();
      caminho();ctx.lineWidth=(aceso?1.5:.8)/e;
      ctx.strokeStyle=aceso?'rgba(255,164,91,.8)':apagado?'rgba(255,255,255,.035)':'rgba(189,155,132,.22)';ctx.stroke();
      if (!apagado && podeAnimar()) {
        const t=((tempo/6200+indice*.173)%1),u=1-t;
        const x=u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x;
        const y=u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y;
        const halo=ctx.createRadialGradient(x,y,0,x,y,8/e);halo.addColorStop(0,aceso?'rgba(255,183,125,.7)':'rgba(255,160,85,.3)');halo.addColorStop(1,'rgba(255,138,53,0)');
        ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,8/e,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=aceso?'#ffdab9':'#c9956e';ctx.beginPath();ctx.arc(x,y,(aceso?1.8:1)/e,0,Math.PI*2);ctx.fill();
      }
    });

    const rotulos = [];
    CEREBRO_STATE.nodes.forEach(n => {
      if (!visivel(n)) return;
      const apagado = destaque && !vizinhos.has(n.id);
      ctx.globalAlpha = apagado ? 0.18 : 1;
      const central = n.nivel === 0 && !todos;
      const tamanho = central ? 27/e : n.raio;
      const luz = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,central ? 92/e : 27/e);
      luz.addColorStop(0, central ? 'rgba(255,138,53,.22)' : 'rgba(255,138,53,.075)');luz.addColorStop(1,'rgba(255,138,53,0)');
      ctx.fillStyle=luz;ctx.beginPath();ctx.arc(n.x,n.y,central?92/e:27/e,0,Math.PI*2);ctx.fill();
      if (central) { ctx.beginPath();ctx.arc(n.x,n.y,39/e,0,Math.PI*2);ctx.strokeStyle='rgba(255,138,53,.18)';ctx.lineWidth=.8/e;ctx.stroke(); }
      if (n.alerta) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.raio + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff6b5a';
        ctx.lineWidth = 1.6 / e;
        ctx.stroke();
      }
      ctx.beginPath();
      if (n.nivel===1 && ['regras','ideias','aprendizados'].includes(n.grupo)) {ctx.moveTo(n.x,n.y-tamanho);ctx.lineTo(n.x+tamanho,n.y);ctx.lineTo(n.x,n.y+tamanho);ctx.lineTo(n.x-tamanho,n.y);ctx.closePath();} else if(n.nivel===1 && ['identidade','arquivos','producao'].includes(n.grupo)) {desenharPillCanvas(ctx,n.x-tamanho,n.y-tamanho,tamanho*2,tamanho*2,3/e);} else ctx.arc(n.x, n.y, tamanho, 0, Math.PI * 2);
      ctx.fillStyle = central ? '#19120e' : n.alerta ? '#ff6b5a' : n === foco ? tema.acento : n.cor;
      ctx.fill();
      const sel = n === foco;
      ctx.lineWidth = (sel ? 2.4 : 1) / e;
      ctx.strokeStyle = central || sel ? '#ff8a35' : 'rgba(255,255,255,0.18)';
      ctx.stroke();
      if (n.nivel === 0 && !todos) { ctx.font = `750 ${22/e}px ${tema.fonte}`; ctx.fillStyle = '#ff9e55'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('V', n.x, n.y + 1/e); }
      ctx.globalAlpha = 1;
      if (!apagado && (!CEREBRO_STATE.grupoExpandido || n.nivel!==1 || n.grupo===CEREBRO_STATE.grupoExpandido || n===CEREBRO_STATE.hover)) rotulos.push(n);
    });

    // Rótulos em tamanho de tela (não encolhem com o zoom) e sem se encavalar.
    ctx.restore();
    const ocupado = [];
    CEREBRO_STATE.caixasRotulos = [];
    rotulos.sort((a, b) => a.nivel - b.nivel || (b === foco) - (a === foco));
    if (foco) { rotulos.splice(rotulos.indexOf(foco), 1); rotulos.unshift(foco); }
    rotulos.forEach(n => {
      const sx = w / 2 + CEREBRO_STATE.panX + n.x * e;
      const sy = h / 2 + CEREBRO_STATE.panY + n.y * e;
      const r = n.nivel === 0 ? 40 : n.raio * e;
      const tam = n.nivel === 0 ? 14 : n.nivel === 1 ? 13 : 11.5;
      ctx.font = `${n.nivel === 2 ? 450 : 600} ${tam}px ${tema.fonte}`;
      const texto = n.label;
      const tw = ctx.measureText(texto).width;
      const bw = tw + 12, bh = tam + 8;
      let bx, by;
      const cos = Math.cos(n.angulo || 0), sin = Math.sin(n.angulo || 0);
      bx=sx-bw/2;by=sy+r+7;
      const bate = (x, y) => ocupado.some(o => x < o.x + o.w + 2 && x + bw + 2 > o.x && y < o.y + o.h + 2 && y + bh + 2 > o.y);
      let t = 0;
      while (bate(bx, by) && t < 5) { by += (sin >= 0 ? 1 : -1) * (bh + 2); t++; }
      if (t >= 5 && n !== foco) return;
      if (bx < 8 || bx + bw > w - 8 || by < 8 || by + bh > h - 46) return;
      ocupado.push({ x: bx, y: by, w: bw, h: bh });
      CEREBRO_STATE.caixasRotulos.push({ x: bx, y: by, w: bw, h: bh, no: n });
      ctx.fillStyle = n === foco && n.nivel > 0 ? 'rgba(255,138,53,0.09)' : 'rgba(8,9,13,0.84)';
      desenharPillCanvas(ctx, bx, by, bw, bh, 6);
      ctx.fill();
      if (n === foco && n.nivel > 0) { ctx.strokeStyle = '#ff8a35'; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.fillStyle = n.nivel === 2 ? tema.mudo : tema.texto;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(texto, bx + 6, by + bh / 2 + 0.5);
    });
    clearTimeout(temporizador);
    if (podeAnimar()) temporizador = setTimeout(pedir, 50);
  };
  const pedir = () => {
    if (CEREBRO_STATE.desenhoPedido) return;
    CEREBRO_STATE.desenhoPedido = true;
    requestAnimationFrame(pintar);
  };
  CEREBRO_STATE.desenhar = pedir;

  const ponto = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    const [sx, sy] = ponto(e);
    CEREBRO_STATE.moveu = false;
    CEREBRO_STATE.arrastandoNo = acharNo(sx, sy);
    CEREBRO_STATE.arrastandoPan = !CEREBRO_STATE.arrastandoNo;
    CEREBRO_STATE.mouseUltX = e.clientX; CEREBRO_STATE.mouseUltY = e.clientY;
  };
  canvas.onpointermove = (e) => {
    const [sx, sy] = ponto(e);
    const dx = e.clientX - CEREBRO_STATE.mouseUltX, dy = e.clientY - CEREBRO_STATE.mouseUltY;
    if (CEREBRO_STATE.arrastandoNo || CEREBRO_STATE.arrastandoPan) {
      if (Math.abs(dx) + Math.abs(dy) > 2) CEREBRO_STATE.moveu = true;
      if (CEREBRO_STATE.arrastandoNo && CEREBRO_STATE.moveu) { const p = telaParaMundo(sx, sy); const no=CEREBRO_STATE.arrastandoNo;no.arrastado=true;no.x=no.tx=p.x;no.y=no.ty=p.y; }
      else { CEREBRO_STATE.panX += dx; CEREBRO_STATE.panY += dy; }
      CEREBRO_STATE.mouseUltX = e.clientX; CEREBRO_STATE.mouseUltY = e.clientY;
      pedir();
      return;
    }
    const sobre = acharNo(sx, sy);
    canvas.style.cursor = sobre ? 'pointer' : 'grab';
    if (sobre !== CEREBRO_STATE.hover) { CEREBRO_STATE.hover = sobre; pedir(); }
  };
  canvas.onpointerup = (e) => {
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    const alvo = CEREBRO_STATE.arrastandoNo;
    if(alvo)alvo.arrastado=false;
    const clicou = !CEREBRO_STATE.moveu;
    CEREBRO_STATE.arrastandoNo = null; CEREBRO_STATE.arrastandoPan = false;
    if (!clicou) return;
    const [sx, sy] = ponto(e);
    const n = alvo || acharNo(sx, sy);
    if (!n) return;
    if (n.nivel === 0 && todos) focarClienteNoCerebro(n.dados.cliente);
    else if (n.nivel === 0) recolherCerebro();
    else if (n.dados?.itemId) cerebroSelecionar('item', n.dados.itemId);
    else if (n.dados?.grupoId) cerebroSelecionar('grupo', n.dados.grupoId);
  };
  canvas.onpointerleave = () => {
    CEREBRO_STATE.arrastandoNo = null; CEREBRO_STATE.arrastandoPan = false;
    if (CEREBRO_STATE.hover) { CEREBRO_STATE.hover = null; pedir(); }
  };
  canvas.onpointercancel = () => { CEREBRO_STATE.arrastandoNo=null; CEREBRO_STATE.arrastandoPan=false; };
  canvas.ondblclick = (e) => {
    const [sx, sy] = ponto(e);
    const n = acharNo(sx, sy);
    if (n?.nivel === 0 && todos) focarClienteNoCerebro(n.dados.cliente);
  };
  canvas.onwheel = (e) => {
    e.preventDefault();
    const p = telaParaMundo(...ponto(e));
    CEREBRO_STATE.grupoZoom = CEREBRO_STATE.hover?.grupo !== 'cliente' ? CEREBRO_STATE.hover?.grupo : CEREBRO_STATE.grupoZoom;
    if (!CEREBRO_STATE.grupoZoom) { const proximos = CEREBRO_STATE.nodes.filter(n => n.nivel === 1).sort((a,b) => ((a.x-p.x)**2+(a.y-p.y)**2)-((b.x-p.x)**2+(b.y-p.y)**2)); CEREBRO_STATE.grupoZoom = proximos[0]?.grupo || null; }
    zoomCerebro(e.deltaY < 0 ? 1.1 : 0.9);
  };

  canvas.onkeydown = e => { if (e.key === 'Escape') recolherCerebro(); else if (e.key === '+' || e.key === '=') zoomCerebro(1.25); else if (e.key === '-') zoomCerebro(0.8); else return; e.preventDefault(); };
  document.addEventListener('visibilitychange',retomar);
  document.addEventListener('change',retomar);
  if (typeof IntersectionObserver === 'function') { presenca = new IntersectionObserver(entries=>{naTela=entries[0]?.isIntersecting===true;if(naTela)pedir();else clearTimeout(temporizador);});presenca.observe(canvas); }
  medir();
  pedir();
  if (typeof ResizeObserver === 'function') {
    if (CEREBRO_STATE.observador) CEREBRO_STATE.observador.disconnect();
    CEREBRO_STATE.observador = new ResizeObserver(() => { if (canvas.isConnected) { medir(); pedir(); } });
    CEREBRO_STATE.observador.observe(canvas.parentElement);
  }
}

// Estado de leitura transitório; não é uma segunda memória do cliente.
const CEREBRO_ATIVIDADE = { carregando: false, dados: null, erro: '' };
async function carregarAtividadeCerebro() {
  if (CEREBRO_ATIVIDADE.carregando) return;
  CEREBRO_ATIVIDADE.tentado = true;
  CEREBRO_ATIVIDADE.carregando = true;
  CEREBRO_ATIVIDADE.erro = '';
  cerebroRepintar();
  try {
    const r = await fetch('/api/painel?area=vybes&etapa=cerebro', { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.fonte !== 'central-vybes' || !Array.isArray(d.clientes))
      throw new Error(d.error || 'A ponte de leitura do cérebro ainda não está disponível neste ambiente.');
    CEREBRO_ATIVIDADE.dados = d;
  } catch (e) { CEREBRO_ATIVIDADE.dados = null; CEREBRO_ATIVIDADE.erro = e.message; }
  finally { CEREBRO_ATIVIDADE.carregando = false; cerebroRepintar(); }
}
function chaveClienteAtividadeCerebro(nome) {
  const cadastro = typeof clientMasterCanonicalName === 'function' ? clientMasterCanonicalName(nome) : nome;
  return normalizarChaveCerebro(encontrarBaseCerebro(cadastro)?.nome || cadastro);
}
function renderAtividadeCerebroHtml() {
  const s=CEREBRO_ATIVIDADE,d=s.dados,foco=CEREBRO_STATE.clienteFoco;
  const nomes=foco==='todos'?[...new Set((d?.clientes || []).map(c=>typeof clientMasterCanonicalName==='function'?clientMasterCanonicalName(c.cliente):c.cliente))]:[foco];
  return `<div class="cb-ficha cb-fluxo"><section class="cb-estudo-status"><div><h3>${d?'Estudo e operação no mesmo contexto':'Conectando o conhecimento'}</h3><p>${d?`Estudo: ${d.geradoEm?cerebroDataHora(d.geradoEm):'sem estudo vigente'} · Consultado: ${cerebroDataHora(d.lidoEm)}`:'Aguardando consulta da central. Referências e operação continuam identificadas por origem.'}</p></div>${s.erro?`<p role="alert">${cerebroEsc(s.erro)}</p>`:''}</section>
    ${!nomes.length?'<p>Nenhum cliente retornado pela central neste momento. Isso não significa ausência de conhecimento.</p>':''}
    ${nomes.map(nome=>{const c=cerebroDoCliente(nome);const registros=Object.values(c.categorias).flat().filter(it=>it.origem==='central'||it.origem==='operacao');
    const outrosClientes = (d?.clientes || []).filter(cl => chaveClienteAtividadeCerebro(cl.cliente) !== chaveClienteAtividadeCerebro(nome));
    const outrosHtml = (!registros.length && outrosClientes.length)
      ? `<div class="cb-atividade-outros"><button type="button" class="vb-link" onclick="focarClienteNoCerebro('todos');alternarAbaCerebro('atividade')">Ver toda a atividade</button><span>· ${outrosClientes.map(cl => `${cerebroEsc(cl.cliente)} · ${(cl.ideias || []).length} sugestões`).join(', ')}</span></div>` : '';
    return `<section class="cb-atividade-cliente"><header><div><h3>${cerebroEsc(c.nomeNoCadastro || c.nome)}</h3><p>${c.estudo?.ficha?'Ficha local encontrada pela central.':'Sem ficha local associada neste retorno.'} ${cerebroEsc((c.estudo?.motivos || []).join(' · '))}</p></div><button type="button" class="vb-link" onclick="abrirRedeClienteCerebro('${cerebroAspas(nome)}')">Explorar rede</button></header>
      <div class="cb-atividade-grade">${registros.slice(0,12).map(it=>`<button type="button" class="cb-atividade-registro" onclick="abrirRegistroCerebro('${cerebroAspas(nome)}','${cerebroAspas(it.id)}')"><small>${cerebroEsc(cerebroNomeOrigem(it.origem))} · ${cerebroEsc(it.estado || it.status || cerebroGrupo(it.grupo).nome)}</small><b>${cerebroEsc(it.titulo)}</b><span>${cerebroEsc(String(it.detalhe || it.sub || '').slice(0,200))}</span>${it.prova?`<em>Trecho de origem: ${cerebroEsc(it.prova)}</em>`:''}</button>`).join('') || `<p>A consulta funcionou, mas não há atividade neste recorte para ${cerebroEsc(nome)}. Isso não significa ausência de conhecimento. Mude a origem ou explore a ficha.</p>`}</div>
      ${outrosHtml}
      ${registros.length>12?`<button type="button" class="vb-link" onclick="abrirFichaClienteCerebro('${cerebroAspas(nome)}')">Ver os ${registros.length} registros na ficha</button>`:''}</section>`;}).join('')}
  </div>`;
}

// A mesma regra governa pintura, conexões e área clicável.
function noVisivelCerebro(no) {
  if (no.grupo === 'cliente') return true;
  if (!CEREBRO_STATE.gruposAtivos.has(no.grupo)) return false;
  if (CEREBRO_STATE.clienteFoco === 'todos') return false;
  if (no.nivel === 1) return true;
  return no.grupo === CEREBRO_STATE.grupoExpandido || (CEREBRO_STATE.zoom >= 1.65 && no.grupo === CEREBRO_STATE.grupoZoom);
}
function zoomCerebro(fator) {
  CEREBRO_STATE.zoom = Math.min(3, Math.max(0.5, CEREBRO_STATE.zoom * fator));
  if (!CEREBRO_STATE.grupoZoom) CEREBRO_STATE.grupoZoom = CEREBRO_STATE.grupoExpandido || 'identidade';
  if (CEREBRO_STATE.desenhar) CEREBRO_STATE.desenhar();
}
function recolherCerebro() {
  CEREBRO_STATE.grupoExpandido = null;
  CEREBRO_STATE.grupoZoom = null;
  CEREBRO_STATE.zoom = 1;
  CEREBRO_STATE.hover = null;
  CEREBRO_STATE.selecionado = null;
  document.getElementById('vybes-cerebro-canvas')?.focus({ preventScroll: true });
  cerebroPintarInspetor();
  if (CEREBRO_STATE.desenhar) CEREBRO_STATE.desenhar();
}

function cerebroNomeOrigem(id) { return {central:'Central do VYBES',operacao:'Operação do painel',referencia:'Referência cadastrada',navegador:'Nota deste navegador'}[id] || 'Origem não informada'; }
function cerebroDataHora(v) { const d=new Date(v);return Number.isNaN(d.getTime())?'não informada':d.toLocaleString('pt-BR'); }
function cerebroHora(v) { const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function cerebroEstudoDoCliente(nome) { return (CEREBRO_ATIVIDADE.dados?.clientes || []).find(c=>chaveClienteAtividadeCerebro(c.cliente)===chaveClienteAtividadeCerebro(nome)) || null; }
function abrirRegistroCerebro(nome,id) { CEREBRO_STATE.clienteFoco=nome;CEREBRO_STATE.selecionado={tipo:'item',id};CEREBRO_STATE.grupoExpandido=null;cerebroRepintar(); }
function abrirRedeClienteCerebro(nome) { CEREBRO_STATE.abaInterna='mapa';focarClienteNoCerebro(nome); }
function abrirFichaClienteCerebro(nome) { CEREBRO_STATE.abaInterna='ficha';focarClienteNoCerebro(nome); }
function filtrarOrigemCerebro(origem) { CEREBRO_STATE.fonteFiltro=['central','operacao','referencia','navegador'].includes(origem)?origem:'todas';CEREBRO_STATE.selecionado=null;CEREBRO_STATE.grupoExpandido=null;cerebroRepintar(); }
function pesquisarConhecimentoCerebro(input) { const valor=input.value,pos=input.selectionStart;CEREBRO_STATE.buscaConhecimento=valor;clearTimeout(CEREBRO_STATE.buscaTimer);CEREBRO_STATE.buscaTimer=setTimeout(()=>{cerebroRepintar();const campo=document.getElementById('cb-busca-conhecimento');campo?.focus({preventScroll:true});campo?.setSelectionRange(pos,pos);},180); }
function ampliarCerebro() { CEREBRO_STATE.ampliado=!CEREBRO_STATE.ampliado;cerebroRepintar(); }
function voltarRedeCerebro() { recolherCerebro();cerebroRepintar(); }

// Layout determinístico por forças e colisão: usa a área real, o foco e o tamanho dos rótulos.
function calcularLayoutRedeCerebro(nos,ligacoes,{largura,altura,expandido=null}) {
  const w=Math.max(280,largura),h=Math.max(300,altura),gold=2.399963;
  const pontos=nos.map((no,i)=>{
    const contexto=expandido && no.nivel===1 && no.grupo!==expandido;
    const bw=contexto?24:no.nivel===0?Math.min(190,w*.55):Math.min(w<500?140:190,Math.max(92,no.label.length*6.4+24));
    const bh=contexto?26:no.nivel===0?116:64;
    const raio=Math.sqrt((i+.5)/(nos.length+1));
    let ax=w/2+Math.cos(i*gold)*w*.35*raio,ay=h/2+Math.sin(i*gold)*h*.32*raio;
    if(no.nivel===0 && nos.length<14){ax=w*(expandido?.22:.5);ay=h*(expandido?.65:.5);}
    if(expandido && no.nivel===1 && no.grupo===expandido){ax=w*.5;ay=h*.23;}
    if(expandido && no.nivel===2){const j=nos.filter(n=>n.nivel===2).indexOf(no),q=Math.sqrt((j+.5)/Math.max(1,nos.filter(n=>n.nivel===2).length));ax=w*.6+Math.cos(j*gold)*w*.25*q;ay=h*.55+Math.sin(j*gold)*h*.25*q;}
    return {id:no.id,no,x:ax,y:ay,ax,ay,bw,bh};
  });
  const conter=p=>{p.x=Math.max(p.bw/2+12,Math.min(w-p.bw/2-12,p.x));p.y=Math.max(p.bh/2+48,Math.min(h-p.bh/2-40,p.y));};
  pontos.forEach(conter);
  for(let passo=0;passo<180;passo++) {
    if(passo<95)pontos.forEach(p=>{p.x+=(p.ax-p.x)*.012;p.y+=(p.ay-p.y)*.012;});
    for(let i=0;i<pontos.length;i++)for(let j=i+1;j<pontos.length;j++){
      const a=pontos[i],b=pontos[j],dx=b.x-a.x,dy=b.y-a.y;
      const ox=(a.bw+b.bw)/2+10-Math.abs(dx),oy=(a.bh+b.bh)/2+10-Math.abs(dy);
      if(ox>0&&oy>0){if(ox<oy){const d=(dx>=0?1:-1)*ox*.52;a.x-=d;b.x+=d;}else{const d=(dy>=0?1:-1)*oy*.52;a.y-=d;b.y+=d;}}
    }
    pontos.forEach(conter);
  }
  return new Map(pontos.map(p=>[p.id,p]));
}
