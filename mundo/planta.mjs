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
      { id: 'orquestrador', nome: 'Orquestração', agente: 'VYBES', papel: 'Recebe pedidos (WhatsApp, central, painel), entende a intenção e entrega ao setor certo. Toda decisão vira tarefa.',
        skills: ['Entender o pedido', 'Escolher o setor', 'Abrir e acompanhar tarefas', 'Resumo do dia'], estado: 'ativo', modulo: { tipo: 'modo', alvo: 'vybes' } },
    ],
  },
  {
    id: 'comercial', nivel: 1, nome: 'Comercial e Sucesso do Cliente', resumo: 'Linha de frente: lead, proposta e atendimento.',
    cor: '#0D74CE',
    setores: [
      { id: 'sdr', nome: 'SDR / Pré-vendas', agente: 'Qualificador', papel: 'Lê formulários e qualifica leads dos canais de atração.',
        skills: ['Mapa de empresas de Irecê (público)', 'Consultar CNPJ', 'Temperatura do lead', 'Agendar diagnóstico'], estado: 'sombra', modulo: { tipo: 'quadro', alvo: 'clientes' } },
      { id: 'closing', nome: 'Closing / Contratos', agente: 'Closer', papel: 'Elabora e negocia propostas e contratos.',
        skills: ['Minuta de proposta (Vybe On-demand)', 'Contrato no LexFlow', 'Link de assinatura'], estado: 'planejado', modulo: { tipo: 'quadro', alvo: 'clientes' } },
      { id: 'concierge', nome: 'Concierge / CS', agente: 'Atendimento', papel: 'Ponto de contato e triagem do cliente.',
        skills: ['Transcrever áudios', 'Organizar briefing', 'Abrir tarefa', 'Esclarecimentos de rotina'], estado: 'sombra', modulo: { tipo: 'modo', alvo: 'clientes' } },
    ],
  },
  {
    id: 'criacao', nivel: 2, nome: 'Criação e Audiovisual', resumo: 'O estúdio: texto, arte e vídeo.',
    cor: '#D6409F',
    setores: [
      { id: 'copy', nome: 'Copy e Conceito', agente: 'Redator', papel: 'Mantém a voz de cada cliente em todos os formatos.',
        skills: ['Planejamento do mês (já publica no painel)', 'Roteiros de vídeo', 'E-mail marketing (SendPulse)'], estado: 'ativo', modulo: { tipo: 'quadro', alvo: 'producao' } },
      { id: 'design', nome: 'Design Visual', agente: 'Diretor de Arte', papel: 'Apoio conceitual para a equipe visual.',
        skills: ['Referências', 'Moodboards', 'Desdobrar copy em formatos'], estado: 'sombra', modulo: { tipo: 'modo', alvo: 'controler' } },
      { id: 'edicao', nome: 'Pós-produção', agente: 'Assistente de Edição', papel: 'Decupagem do material captado (FX30, Hollyland).',
        skills: ['Ler transcrições', 'Minutagem de cortes para Reels', 'Roteiro de decupagem'], estado: 'planejado', modulo: { tipo: 'modo', alvo: 'producao' } },
    ],
  },
  {
    id: 'financeiro', nivel: 3, nome: 'Financeiro', resumo: 'Entrada, saída e fiscal. Começa só lendo.',
    cor: '#18A957',
    setores: [
      { id: 'receber', nome: 'Cobrança', agente: 'Contas a Receber', papel: 'Garante a entrada e cuida da inadimplência com tom corporativo.',
        skills: ['Consultar pagamentos', 'Link Pix/Boleto atualizado', 'Régua de cobrança'], estado: 'planejado', modulo: { tipo: 'link', alvo: 'financas', url: 'https://vybe-financas.vercel.app/' } },
      { id: 'tesouraria', nome: 'Tesouraria', agente: 'Contas a Pagar', papel: 'Controla SaaS e freelancers.',
        skills: ['OCR de faturas', 'Cruzar com orçamento aprovado'], estado: 'planejado', modulo: { tipo: 'link', alvo: 'financas', url: 'https://vybe-financas.vercel.app/' } },
      { id: 'controladoria', nome: 'Controladoria e Fiscal', agente: 'Controller', papel: 'Ponte com a contabilidade e documentos fiscais.',
        skills: ['Emitir NFS-e', 'DRE por projeto', 'Pacote contábil do mês'], estado: 'planejado', modulo: { tipo: 'link', alvo: 'financas', url: 'https://vybe-financas.vercel.app/' } },
    ],
  },
  {
    id: 'tecnologia', nivel: 4, nome: 'Tecnologia e Automação', resumo: 'A sala de máquinas.',
    cor: '#8E4EC6',
    setores: [
      { id: 'dev', nome: 'Desenvolvimento Web', agente: 'DevAgent', papel: 'Ajuda a construir a infraestrutura técnica.',
        skills: ['Código Next.js/React', 'Esquemas de banco', 'Ler documentação de APIs'], estado: 'planejado', modulo: null },
      { id: 'automacao', nome: 'Engenharia de Automação', agente: 'Arquiteto de Processos', papel: 'As automações invisíveis da agência.',
        skills: ['Regras que movem e avisam (já rodam no painel)', 'Webhooks', 'Cenários Make.com'], estado: 'ativo', modulo: { tipo: 'quadro', alvo: 'automacoes' } },
      { id: 'iot', nome: 'Hardware e IoT', agente: 'Sistemas Embarcados', papel: 'Projetos físicos e eletrônicos.',
        skills: ['C++ para ESP32', 'Comandos AT (SIM800L)'], estado: 'planejado', modulo: null },
    ],
  },
  {
    id: 'estrategia', nivel: 5, nome: 'Estratégia e Performance', resumo: 'Centro de comando: anúncios e números.',
    cor: '#F76808',
    setores: [
      { id: 'midia', nome: 'Mídia Paga', agente: 'Growth e Ads', papel: 'Analisa e protege o dinheiro investido em anúncios.',
        skills: ['Criativos rodando (Hub)', 'ROAS', 'Alerta de campanha'], estado: 'sombra', modulo: null },
      { id: 'bi', nome: 'Business Intelligence', agente: 'Analista de Dados', papel: 'Visão global unindo operação e tráfego.',
        skills: ['Cruzar andares', 'Painéis operacionais', 'Resumo semanal da diretoria'], estado: 'sombra', modulo: { tipo: 'quadro', alvo: 'performance' } },
    ],
  },
  {
    id: 'terraco', nivel: 6, nome: 'Terraço · Escritório', resumo: 'A equipe junta: salas, voz, jogos e VybeCoins.',
    cor: '#38D9C5',
    setores: [
      { id: 'escritorio', nome: 'Escritório da equipe', agente: null, papel: 'O Escritório de sempre, com tudo que ele tem.',
        skills: [], estado: 'ativo', modulo: { tipo: 'modo', alvo: 'escritorio' } },
    ],
  },
];

export const ESTADOS = {
  ativo: { rotulo: 'Trabalhando', cor: '#18A957' },
  sombra: { rotulo: 'Modo sombra: propõe, você aprova', cor: '#8E4EC6' },
  planejado: { rotulo: 'Sala pronta, falta ligar', cor: '#7A8B82' },
};

// ---------- O Escritório dentro do prédio (Paulo, 06/11/2026: "o Habbo vai virar o voxel") ----------
// As zonas continuam as MESMAS do Escritório (presença, voz por sala, trancas e
// convites no Worker não mudam); só o lugar delas passa a ser um andar do prédio.
// Salas pessoais: os donos fixos de server/escritorio-mapa.js (DONOS_ESCRITORIO).
export const ZONAS_DO_PREDIO = {
  recepcao: { andar: 'terreo', nome: 'Convivência' },
  reuniao: { andar: 'comercial', nome: 'Sala de reunião' },
  producao: { andar: 'criacao', nome: 'Produção (audiovisual)' },
  foco: { andar: 'financeiro', nome: 'Foco (silêncio)' },
  operacao: { andar: 'tecnologia', nome: 'Centro de Operação' },
  auditorio: { andar: 'estrategia', nome: 'Auditório' },
  cafe: { andar: 'terraco', nome: 'Café' },
  jogos: { andar: 'terraco', nome: 'Jogos' },
  lounge: { andar: 'terraco', nome: 'Lounge' },
  academia: { andar: 'terraco', nome: 'Academia' },
  'sala-0': { andar: 'estrategia', nome: 'Sala do Paulo', dono: 'Paulo' },
  'sala-1': { andar: 'comercial', nome: 'Sala do Vinícius', dono: 'Vinícius' },
  'sala-2': { andar: 'comercial', nome: 'Sala do Ewerton', dono: 'Ewerton' },
  'sala-3': { andar: 'criacao', nome: 'Sala do Deivid', dono: 'Deivid' },
  'sala-4': { andar: 'criacao', nome: 'Sala da Bia', dono: 'Bia' },
  'sala-5': { andar: 'criacao', nome: 'Sala da Jady', dono: 'Jady' },
  'sala-6': { andar: 'criacao', nome: 'Sala do Mizinho', dono: 'Mizinho' },
  'sala-7': { andar: 'criacao', nome: 'Sala da Taynara', dono: 'Taynara' },
  'sala-8': { andar: 'criacao', nome: 'Sala do Reriston', dono: 'Reriston' },
};
export const zonasDoAndar = (andar) => Object.entries(ZONAS_DO_PREDIO).filter(([, z]) => z.andar === andar).map(([id, z]) => ({ id, ...z }));
