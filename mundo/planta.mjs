// Planta do Prédio da Vybe: andares, setores e o agente de cada sala.
//
// Fonte: "Estrutura do Sistema Multi-Agentes - Vybe" (Paulo, 06/11/2026).
// Todos os agentes são o próprio VYBES trabalhando naquele setor (mesma
// personalidade, core/identidade.js na central); muda só o que ele pode usar.
//
// estado: 'ativo'    → já existe e trabalha hoje (com a regra atual do painel)
//         'sombra'   → existe a base; o agente só PROPÕE, alguém aprova
//         'planejado'→ falta ligar as ferramentas; a sala existe e mostra o que falta
//
// modulo: a porta para o que o Vybe OS já faz naquele setor (tipo 'link' abre um sistema irmão, como o Vybe Finanças). Nada aqui recria
// uma tela: a sala abre o módulo existente (switchBoard / choose*Mode).

export const PLANTA = [
  {
    id: 'terreo', nivel: 0, nome: 'Recepção', resumo: 'Onde o VYBES recebe tudo e decide quem faz.',
    cor: '#FF7A2F',
    setores: [
      { id: 'orquestrador', nome: 'Orquestração', agente: 'VYBES', funcao: 'Orquestrador', papel: 'Recebe pedidos (WhatsApp, central, painel), entende a intenção e entrega ao setor certo. Toda decisão vira tarefa.',
        skills: ['Entender o pedido', 'Escolher o setor', 'Abrir e acompanhar tarefas', 'Resumo do dia'], estado: 'ativo', modulo: { tipo: 'modo', alvo: 'vybes' } },
    ],
  },
  {
    id: 'comercial', nivel: 1, nome: 'Comercial e Sucesso do Cliente', resumo: 'Linha de frente: lead, proposta e atendimento.',
    cor: '#0D74CE',
    setores: [
      { id: 'sdr', nome: 'SDR / Pré-vendas', agente: 'Otávio', funcao: 'Qualificador', papel: 'Lê formulários e qualifica leads dos canais de atração.',
        skills: ['Mapa de empresas de Irecê (público)', 'Consultar CNPJ', 'Temperatura do lead', 'Agendar diagnóstico'], estado: 'planejado', modulo: { tipo: 'quadro', alvo: 'clientes' } },
      { id: 'closing', nome: 'Closing / Contratos', agente: 'Beto', funcao: 'Closer', papel: 'Elabora e negocia propostas e contratos.',
        skills: ['Funil comercial e motivos de perda', 'Pacotes e orçamento', 'Capacidade × vendas', 'Contrato no LexFlow'], estado: 'planejado', modulo: { tipo: 'janela', alvo: 'comercial', aba: 'funil' } },
      { id: 'concierge', nome: 'Concierge / CS', agente: 'Mateus', funcao: 'Atendimento', papel: 'Ponto de contato e triagem do cliente.',
        skills: ['Transcrever áudios', 'Organizar briefing', 'Abrir tarefa', 'Esclarecimentos de rotina'], estado: 'sombra', modulo: { tipo: 'modo', alvo: 'clientes' } },
    ],
  },
  {
    id: 'criacao', nivel: 2, nome: 'Criação e Audiovisual', resumo: 'O estúdio: texto, arte e vídeo.',
    cor: '#D6409F',
    setores: [
      { id: 'copy', nome: 'Copy e Conceito', agente: 'Augusto', funcao: 'Redator', papel: 'Mantém a voz de cada cliente em todos os formatos.',
        skills: ['Planejamento do mês (já publica no painel)', 'Roteiros de vídeo', 'E-mail marketing (SendPulse)'], estado: 'ativo', modulo: { tipo: 'quadro', alvo: 'producao' } },
      { id: 'design', nome: 'Design Visual', agente: 'Danilo', funcao: 'Braço direito da Direção de Arte', papel: 'Revisa a arte e leva referências ao Deivid, o diretor de arte, e aprende a linha dele.',
        skills: ['Referências', 'Moodboards', 'Desdobrar copy em formatos'], estado: 'sombra', modulo: { tipo: 'modo', alvo: 'controler' } },
      { id: 'edicao', nome: 'Pós-produção', agente: 'Lucas', funcao: 'Assistente de Edição', papel: 'Decupagem do material captado (FX30, Hollyland).',
        skills: ['Ler transcrições', 'Minutagem de cortes para Reels', 'Roteiro de decupagem'], estado: 'planejado', modulo: { tipo: 'modo', alvo: 'producao' } },
      { id: 'coordenacao', nome: 'Coordenação de Produção', agente: 'Heitor', funcao: 'Coordenador de Produção', papel: 'Distribui as demandas pela carga do time, acha demanda sem dono ou no grupo errado e cuida dos prazos da semana.',
        skills: ['Fila sem dono', 'Carga do time', 'Semana equilibrada', 'Aprende com a redistribuição real'], estado: 'sombra', modulo: { tipo: 'quadro', alvo: 'producao' } },
    ],
  },
  {
    id: 'financeiro', nivel: 3, nome: 'Financeiro', resumo: 'Entrada, saída e fiscal. Começa só lendo.',
    cor: '#18A957',
    setores: [
      { id: 'receber', nome: 'Cobrança', agente: 'Renato', funcao: 'Contas a Receber', papel: 'Garante a entrada e cuida da inadimplência com tom corporativo.',
        skills: ['Consultar pagamentos', 'Link Pix/Boleto atualizado', 'Régua de cobrança'], estado: 'planejado', modulo: { tipo: 'link', alvo: 'financas', url: 'https://vybe-financas.vercel.app/' } },
      { id: 'tesouraria', nome: 'Tesouraria', agente: 'Vorcaro', funcao: 'Contas a Pagar', papel: 'Controla SaaS e freelancers.',
        skills: ['OCR de faturas', 'Cruzar com orçamento aprovado'], estado: 'planejado', modulo: { tipo: 'link', alvo: 'financas', url: 'https://vybe-financas.vercel.app/' } },
      { id: 'controladoria', nome: 'Controladoria e Fiscal', agente: 'Moreira', funcao: 'Controller', papel: 'Ponte com a contabilidade e documentos fiscais.',
        skills: ['Emitir NFS-e', 'DRE por projeto', 'Pacote contábil do mês'], estado: 'planejado', modulo: { tipo: 'link', alvo: 'financas', url: 'https://vybe-financas.vercel.app/' } },
      // Compras (Paulo, 09/11/2026; bot core/agentes.js): cotação com as gráficas, impressões paradas e a base de fornecedores.
      { id: 'compras', nome: 'Compras e Fornecedores', agente: 'Nestor', funcao: 'Comprador', papel: 'Cota com as gráficas, cobra impressão parada e cuida da base de fornecedores.',
        skills: ['Pedido de orçamento pronto', 'Impressões atrasadas e paradas', 'Base de fornecedores (completa, sem duplicada)'], estado: 'sombra', modulo: { tipo: 'janela', alvo: 'impressoes' } },
    ],
  },
  {
    id: 'tecnologia', nivel: 4, nome: 'Tecnologia e Automação', resumo: 'A sala de máquinas.',
    cor: '#8E4EC6',
    setores: [
      { id: 'dev', nome: 'Desenvolvimento Web', agente: 'Clarice', funcao: 'DevAgent', papel: 'Ajuda a construir a infraestrutura técnica.',
        skills: ['Código Next.js/React', 'Esquemas de banco', 'Ler documentação de APIs'], estado: 'planejado', modulo: null },
      { id: 'automacao', nome: 'Engenharia de Automação', agente: 'Cícero', funcao: 'Arquiteto de Processos', papel: 'As automações invisíveis da agência.',
        skills: ['Regras que movem e avisam (já rodam no painel)', 'Webhooks', 'Cenários Make.com'], estado: 'ativo', modulo: { tipo: 'quadro', alvo: 'automacoes' } },
      { id: 'iot', nome: 'Hardware e IoT', agente: 'Raul', funcao: 'Sistemas Embarcados', papel: 'Projetos físicos e eletrônicos.',
        skills: ['C++ para ESP32', 'Comandos AT (SIM800L)'], estado: 'planejado', modulo: null },
    ],
  },
  {
    id: 'estrategia', nivel: 5, nome: 'Estratégia e Performance', resumo: 'Centro de comando: anúncios e números.',
    cor: '#F76808',
    setores: [
      { id: 'midia', nome: 'Mídia Paga', agente: 'Breno', funcao: 'Growth e Ads', papel: 'Analisa e protege o dinheiro investido em anúncios.',
        skills: ['Criativos rodando (Hub)', 'ROAS', 'Alerta de campanha'], estado: 'sombra', modulo: { tipo: 'link', alvo: 'vybehub', url: 'https://vybehub.vercel.app/admin' } },
      { id: 'bi', nome: 'Business Intelligence', agente: 'Alex', funcao: 'Analista de Dados', papel: 'Visão global unindo operação e tráfego.',
        skills: ['Cruzar andares', 'Painéis operacionais', 'Resumo semanal da diretoria'], estado: 'sombra', modulo: { tipo: 'quadro', alvo: 'performance' } },
    ],
  },
  // Andares do time humano (Paulo, 08/11/2026). O 6º andar "Time Vybe" (as salas de cada um e a reunião) saiu em
  // 09/11/2026 (Paulo: "aquela parte visual do andar dos humanos e o fluxo de entrar lá podemos tirar... deixar as
  // salas no esquema Discord em relação à voz"): essas salas ficam só como voz, na barra de salas, e cada pessoa tem
  // o quarto dela em "Minha sala" (mundo/quarto.mjs). As zonas são as MESMAS do Escritório (Worker não muda).
  {
    id: 'estudio', nivel: 6, tipo: 'equipe', nome: 'Estúdio e Operação', resumo: 'Gravação, apresentações, operação e foco.',
    cor: '#12A594',
    setores: [
      { id: 'estudio', nome: 'Estúdio e salas de trabalho', agente: null, papel: 'Produção audiovisual, auditório, centro de operação e a sala de foco.',
        skills: [], estado: 'ativo', modulo: { tipo: 'modo', alvo: 'escritorio' } },
    ],
  },
  {
    id: 'terraco', nivel: 7, tipo: 'equipe', nome: 'Terraço · Escritório', resumo: 'A pausa do time: café, jogos, lounge e academia.',
    cor: '#38D9C5',
    setores: [
      { id: 'escritorio', nome: 'Escritório da equipe', agente: null, papel: 'O Escritório de sempre, com tudo que ele tem.',
        skills: [], estado: 'ativo', modulo: { tipo: 'modo', alvo: 'escritorio' } },
    ],
  },
];

// Andares só dos agentes (1º ao 5º): mesas para todos os agentes do setor e o resto livre para os que entrarem.
for (const a of PLANTA) if (!a.tipo) a.tipo = a.id === 'terreo' ? 'recepcao' : 'agentes';
export const MESAS_POR_ANDAR = 6;
// Nome do andar pelo número (o terraço é sempre o último).
export const nomeDoNivel = (a, curto = false) => (a.nivel === 0 ? 'Térreo' : a.id === 'terraco' ? 'Terraço' : a.nivel + (curto ? 'º' : 'º andar'));

export const ESTADOS = {
  ativo: { rotulo: 'Trabalhando', cor: '#18A957' },
  sombra: { rotulo: 'Modo sombra: propõe, você aprova', cor: '#8E4EC6' },
  planejado: { rotulo: 'Sala pronta, falta ligar', cor: '#7A8B82' },
};

// ---------- O Escritório dentro do prédio (Paulo, 06/11/2026: "o Habbo vai virar o voxel") ----------
// As zonas continuam as MESMAS do Escritório (presença, voz por sala, trancas e
// convites no Worker não mudam); só o lugar delas passa a ser um andar do prédio.
// Salas pessoais: os donos fixos de server/escritorio-mapa.js (DONOS_ESCRITORIO). As do time (andar SALAS_DO_TIME)
// não são lugar no prédio: só a voz, na barra de salas, e o quarto voxel de cada um em "Minha sala".
export const SALAS_DO_TIME = 'time';
export const ZONAS_DO_PREDIO = {
  recepcao: { andar: 'terreo', nome: 'Convivência' },
  reuniao: { andar: SALAS_DO_TIME, nome: 'Sala de reunião' },
  producao: { andar: 'estudio', nome: 'Produção (audiovisual)' },
  auditorio: { andar: 'estudio', nome: 'Auditório' },
  operacao: { andar: 'estudio', nome: 'Centro de Operação' },
  foco: { andar: 'estudio', nome: 'Foco (silêncio)' },
  cafe: { andar: 'terraco', nome: 'Café' },
  jogos: { andar: 'terraco', nome: 'Jogos' },
  lounge: { andar: 'terraco', nome: 'Lounge' },
  academia: { andar: 'terraco', nome: 'Academia' },
  'sala-0': { andar: SALAS_DO_TIME, nome: 'Sala do Paulo', dono: 'Paulo' },
  'sala-1': { andar: SALAS_DO_TIME, nome: 'Sala do Vinícius', dono: 'Vinícius' },
  'sala-2': { andar: SALAS_DO_TIME, nome: 'Sala do Ewerton', dono: 'Ewerton' },
  'sala-3': { andar: SALAS_DO_TIME, nome: 'Sala do Deivid', dono: 'Deivid' },
  'sala-4': { andar: SALAS_DO_TIME, nome: 'Sala da Bia', dono: 'Bia' },
  'sala-5': { andar: SALAS_DO_TIME, nome: 'Sala da Jady', dono: 'Jady' },
  'sala-6': { andar: SALAS_DO_TIME, nome: 'Sala do Mizinho', dono: 'Mizinho' },
  'sala-7': { andar: SALAS_DO_TIME, nome: 'Sala da Taynara', dono: 'Taynara' },
  'sala-8': { andar: SALAS_DO_TIME, nome: 'Sala do Reriston', dono: 'Reriston' },
};
export const zonasDoAndar = (andar) => Object.entries(ZONAS_DO_PREDIO).filter(([, z]) => z.andar === andar).map(([id, z]) => ({ id, ...z }));
