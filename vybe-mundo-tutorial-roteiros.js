// vybe-mundo-tutorial-roteiros.js — o que o VYBES explica em cada tela, na primeira vez que a pessoa abre (Paulo, 16/11/2026).
// Aqui só mora o TEXTO e para onde ele aponta. O mecanismo (recorte, Pular, Voltar, Próximo, Esc, setas, primeira vez por
// pessoa, Ajuda do VYBES) é o do vybe-mundo-tutorial.js; estes roteiros entram por VybeTutorial.registrarTelas.
//
// COMO COMPLETAR OU CRIAR O ROTEIRO DE UMA TELA
//   1. Copie um bloco { id, nome, se, cobre, passos } e troque os valores.
//   2. id: curto e fixo (é o nome guardado como "já vi"). Trocar o id faz o tutorial aparecer de novo para todo mundo.
//   3. se: um seletor CSS que só está à vista com a tela aberta (pode ser uma lista: vale o primeiro que achar).
//      A ordem dos blocos importa: a primeira tela da lista que casa é a que vale. Por isso os menus vêm antes das telas
//      e as telas (módulos) vêm antes do Hoje, que fica por baixo de tudo.
//   4. passos: de 3 a 8, cada um com
//        alvo:   seletor CSS da parte da tela (ou lista: vale o primeiro à vista). Se não existir na tela, o passo é
//                pulado sem erro; então pode apontar para uma parte que só alguns veem (dono, coordenação).
//        titulo: duas ou três palavras.
//        texto:  a fala do VYBES, uma ou duas frases. "{nome}" vira o primeiro nome da pessoa (ou "senhor", para os donos).
//        lado:   (opcional) direita, esquerda, baixo ou cima: de que lado do alvo o balão prefere ficar.
//   5. cobre: (opcional) dicas de primeira vez do vybe-mundo-tutorial.js que este roteiro já explica (ex.: 'trilho:clientes').
//      Elas contam como vistas, e a dica não aparece depois do tutorial.
//   6. Confira na tela: abra a tela e, no menu Conta, clique em "Ajuda do VYBES". Ele refaz o tutorial dessa tela.
//      No console, VybeTutorial.telaAtual() diz qual roteiro casou e VybeTutorial.estado() o que está aberto.
//   Quando uma tela for remontada e os nomes das classes mudarem, é só acertar os seletores `se` e `alvo` aqui.
//
// A VOZ: é o VYBES de sempre (a personalidade mora na central, em core/identidade.js e core/frases.js; aqui não se copia).
// Conversa, não relatório: frases curtas e ligadas, sem rótulo ("Atenção:", "Dica:"), dizendo para que a coisa serve e o
// que fazer com ela. Uma ideia por passo.
(() => {
  const T = typeof window !== 'undefined' ? window.VybeTutorial : globalThis.VybeTutorial;
  if (!T || typeof T.registrarTelas !== 'function') return;

  // A Produção no padrão V2 vale na vista Semana (as outras vistas seguem a tela de antes).
  const PRODUCAO = 'body.mundo-modulo[data-modo="gestor"][data-pv2-vista="semana"]';
  const HOJE = 'body:not(.mundo-modulo) #vv-hoje';

  T.registrarTelas([
    // ============================================================ MENUS (o que abre do HUD)
    {
      id: 'menu-conta', nome: 'Menu da Conta', resumo: 'Quem você é, a aparência e onde me chamar.',
      se: '#mundo-hud .vv-menu-conta', cobre: ['ferr:conta', 'ferr:aparencia'],
      passos: [
        { alvo: '.vv-menu-conta .vv-menu-quem', lado: 'esquerda', titulo: 'Você',
          texto: 'Esse é o seu menu, {nome}. Em cima está você, com o seu papel e o saldo de VybeCoins.' },
        { alvo: '.vv-menu-conta [data-conta-acao="conta"]', lado: 'esquerda', titulo: 'Minha conta',
          texto: 'Senha, foto e acessos ficam em Minha conta, e logo abaixo o seu perfil, com nível e conquistas.' },
        { alvo: '.vv-menu-conta .vv-menu-tema-linha', lado: 'esquerda', titulo: 'Aparência',
          texto: 'Aqui você troca o tema quando quiser: Fumê, Claro, Escuro ou Auto, que acompanha o seu computador.' },
        { alvo: '.vv-menu-conta [data-conta-acao="ajuda"]', lado: 'esquerda', titulo: 'Ajuda do VYBES',
          texto: 'E se bater dúvida em alguma tela, é só clicar aqui que eu explico de novo a tela em que você estiver.' },
      ],
    },
    {
      id: 'menu-avisos', nome: 'Avisos', resumo: 'O que pede ação primeiro e como marcar como lido.',
      se: '#mundo-hud .vv-avisos-painel',
      passos: [
        { alvo: '.vv-avisos-painel .vv-avisos-corpo', lado: 'esquerda', titulo: 'Avisos',
          texto: 'Aqui chegam os avisos, e os que pedem alguma ação sua vêm primeiro. Clicar num aviso leva direto à peça.' },
        { alvo: '.vv-avisos-painel .vv-avisos-pe', lado: 'esquerda', titulo: 'Tudo lido',
          texto: 'No pé você marca tudo como lido de uma vez, e o número vermelho do sino some.' },
      ],
    },
    {
      id: 'menu-agenda', nome: 'Agenda do topo', resumo: 'Os próximos compromissos e as datas do mês.',
      se: 'body.ver-agenda #mundo-hud #vv-agenda',
      passos: [
        { alvo: '#vv-agenda #vv-agenda-lista .vv-evento', lado: 'esquerda', titulo: 'Próximos compromissos',
          texto: 'Essa é a agenda da Vybe, a mesma do Google: captações, reuniões e compromissos, na ordem em que acontecem.' },
        { alvo: '#vv-agenda .vd-agenda', lado: 'esquerda', titulo: 'Datas comemorativas',
          texto: 'Logo abaixo ficam as datas comemorativas que vêm aí, para ninguém lembrar do Dia das Mães na véspera.' },
        { alvo: '#vv-agenda .vv-agenda-abrir', lado: 'esquerda', titulo: 'Agenda completa',
          texto: 'E por aqui você abre a agenda inteira, com a semana e o mês.' },
      ],
    },
    {
      id: 'menu-chat', nome: 'Chat da equipe', resumo: 'A conversa da sala, os recados e as notas.',
      se: 'section.vv-conversa', cobre: ['ferr:conversa'],
      passos: [
        { alvo: '.vv-conversa .vv-conversa-abas', lado: 'esquerda', titulo: 'Três abas',
          texto: 'O chat tem três abas: a conversa da sala em que você está, os recados que deixaram para você e as suas notas.' },
        { alvo: '.vv-conversa .vv-conversa-log', lado: 'esquerda', titulo: 'A conversa',
          texto: 'A conversa é de quem está na mesma sala que você. Mudou de sala, mudou a conversa.' },
        { alvo: '.vv-conversa .vv-conversa-form', lado: 'esquerda', titulo: 'Escrever',
          texto: 'Escreva aqui embaixo e mande com Enter. Simples assim.' },
      ],
    },
    {
      id: 'menu-setor', nome: 'Menu de um setor', resumo: 'O que tem dentro de cada ícone do menu lateral.',
      se: '#mundo-hud .vv-setor[role="menu"]',
      passos: [
        { alvo: '.vv-setor .vv-setor-topo', lado: 'direita', titulo: 'Um setor',
          texto: 'Cada ícone do menu lateral é um setor da agência, e isso é o que tem dentro deste.' },
        { alvo: '.vv-setor [data-submodulo="__visao"]', lado: 'direita', titulo: 'Visão geral',
          texto: 'A Visão geral resume o setor inteiro numa tela só. É um bom lugar para começar.' },
        { alvo: '.vv-setor [role="menuitem"]:not([data-submodulo="__visao"])', lado: 'direita', titulo: 'As telas',
          texto: 'Depois vêm as telas do setor, cada uma com uma linha dizendo para que serve. Clicou, abriu em tela cheia.' },
      ],
    },

    // ============================================================ PRODUÇÃO (padrão V2)
    {
      id: 'producao', nome: 'Produção', resumo: 'A semana de entregas: a régua, o dia, a carga e o que trava.',
      se: PRODUCAO + ' .pv2-casa #pv2-painel', cobre: ['trilho:gestor', 'modulo'],
      passos: [
        { alvo: '#pv2-painel .d3m-tit', lado: 'baixo', titulo: 'Produção',
          texto: 'Essa é a Produção, {nome}: tudo o que a agência entrega, arrumado pela semana.' },
        { alvo: '#pv2-vistas', lado: 'baixo', titulo: 'Jeitos de ver',
          texto: 'Aqui você troca o jeito de ver: a Semana, o Mês, o Feed de cada cliente, os Grupos e a Equipe.' },
        { alvo: '#pv2-regua', lado: 'baixo', titulo: 'A régua da semana',
          texto: 'Cada casa é um dia, com quantas peças já ficaram prontas. Clique num dia e a lista de baixo passa a ser a dele.' },
        { alvo: '#pv2-semana', lado: 'baixo', titulo: 'O dia',
          texto: 'Essa é a lista do dia escolhido: cliente, peça, a trilha das etapas, o status e quem faz. Clicar numa linha abre a peça inteira.' },
        { alvo: '#pv2-alto', lado: 'esquerda', titulo: 'O que trava hoje',
          texto: 'No laranja o Heitor, que coordena a produção, diz o que está travando o dia, e o botão já leva até lá.' },
        { alvo: ['#pv2-carga', '#pv2-trava'], lado: 'esquerda', titulo: 'Carga e gargalo',
          texto: 'Aqui fica quanto cada pessoa tem na mão hoje contra o limite dela e, logo abaixo, em que etapa a semana está parando.' },
        { alvo: '#pv2-pe', lado: 'cima', titulo: 'De olho',
          texto: 'No pé ficam os contadores do que merece atenção, e clicar em um deles filtra a tela.' },
        { alvo: '#pv2-painel .d3p-novo', lado: 'baixo', titulo: 'Novo conteúdo',
          texto: 'E peça nova se cadastra aqui. Esc ou o × fecham a Produção e voltam para o seu dia.' },
      ],
    },
    {
      id: 'feed', nome: 'Feed dos clientes', resumo: 'O Instagram de cada cliente, com o que falta postar.',
      se: 'body.vfd-aberto #vfd-camada',
      passos: [
        { alvo: '#vfd-camada .vfd-c-tit', lado: 'baixo', titulo: 'Feed dos clientes',
          texto: 'Esse é o Feed: o Instagram de cada cliente como vai ficar, com o que já tem arte e o que ainda falta.' },
        { alvo: '#vfd-camada .vfd-vista', lado: 'baixo', titulo: 'Período',
          texto: 'Aqui você escolhe olhar as próximas quatro semanas ou o mês inteiro.' },
        { alvo: '#vfd-camada .vfd-filtros', lado: 'baixo', titulo: 'Carteira e head',
          texto: 'E aqui filtra por carteira ou por head, para ver só os seus clientes.' },
        { alvo: ['#vfd-camada .vfd-c-palco .vfd-frente', '#vfd-camada .vfd-c-palco'], titulo: 'O perfil',
          texto: 'No meio fica o perfil do cliente. Os quadrados com X são dias sem post, e o + cria a peça já na data certa.' },
        { alvo: '#vfd-camada .vfd-c-doca', lado: 'cima', titulo: 'Trocar de cliente',
          texto: 'As setas passam de um cliente para o outro.' },
      ],
    },

    // ============================================================ MÓDULOS (roteiros iniciais, nos elementos de hoje)
    {
      id: 'agenda', nome: 'Agenda e captações', resumo: 'As gravações da semana e o que falta para cada uma.',
      se: 'body.mundo-modulo[data-modo="producao"] #pv2-agenda', cobre: ['trilho:agenda', 'modulo'],
      passos: [
        { alvo: '#pv2-agenda-topo h2', lado: 'baixo', titulo: 'Agenda',
          texto: 'Essa é a Agenda da produção: as captações e reuniões da semana. É a mesma agenda do Google da Vybe.' },
        { alvo: '#pv2-agenda .d3-acao', lado: 'baixo', titulo: 'O que pede ação',
          texto: 'A faixa laranja mostra o que está pendente agora, como uma gravação de ontem que ninguém fechou.' },
        { alvo: '#pv2-agenda .d3ag-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Esses são os números da semana: gravações para fechar, peças sem roteiro e captações sem peça ligada.' },
        { alvo: '#pv2a-corpo', lado: 'cima', titulo: 'Na ordem de fazer',
          texto: 'Aqui está cada compromisso na ordem de fazer. Na captação você escolhe as peças, vê o roteiro e fecha a gravação.' },
        { alvo: '#pv2-agenda-topo .d3ag-vistas', lado: 'baixo', titulo: 'Semana, mês e roteiros',
          texto: 'Por aqui você troca para o mês inteiro ou para os roteiros.' },
        { alvo: '#pv2-agenda-topo .d3ag-marcar', lado: 'baixo', titulo: 'Marcar captação',
          texto: 'E uma captação nova se marca aqui, e ela já vai para o Google Agenda.' },
      ],
    },
    {
      id: 'aprovacao', nome: 'Aprovação de conteúdo', resumo: 'O que espera aprovação, o que está com o cliente e o equilíbrio do mês.',
      se: '#vv-conteudo.vc',
      passos: [
        { alvo: '#vv-conteudo .v2c-topo h2', lado: 'baixo', titulo: 'Aprovação',
          texto: 'Aqui passa tudo o que precisa de um sim antes de ir ao ar, {nome}.' },
        { alvo: '#vv-conteudo .v2c-seg', lado: 'baixo', titulo: 'As abas',
          texto: 'São quatro abas: o que espera a aprovação daqui de dentro, o que está com o cliente, o equilíbrio do mês e os links.' },
        { alvo: '#vv-conteudo .d3a-acao', lado: 'baixo', titulo: 'O que está parado',
          texto: 'Essa faixa diz o que está parado há mais tempo. Costuma ser por onde vale começar.' },
        { alvo: '#vv-conteudo .d3a-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Esses são os números da fila: quantas peças esperam, há quanto tempo e com quem.' },
        { alvo: '#vv-conteudo .v2c-cols', lado: 'cima', titulo: 'A fila',
          texto: 'E aqui está a fila, com a arte de cada peça. Dá para aprovar ou pedir alteração sem sair da tela.' },
        { alvo: '#vv-conteudo [data-vc-ajuda]', lado: 'baixo', titulo: 'Como funciona',
          texto: 'Se quiser a regra completa da aprovação, ela está neste botão.' },
      ],
    },
    {
      id: 'planejamentos', nome: 'Planejamentos', resumo: 'O planejamento do mês de cada cliente, do rascunho ao cadastro.',
      se: '#vv-planejamentos.vv-plj',
      passos: [
        { alvo: '#vv-planejamentos .vb-cabecalho-texto', lado: 'baixo', titulo: 'Planejamentos',
          texto: 'Aqui fica o planejamento do mês de cada cliente. O agente de conteúdo escreve, o head revisa e o cliente aprova.' },
        { alvo: '#vv-planejamentos > .d3-acao', lado: 'baixo', titulo: 'O que pede ação',
          texto: 'A faixa laranja mostra quem está esperando você agora, com o botão para abrir direto.' },
        { alvo: '#vv-planejamentos .d3pl-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Esses são os números do mês: quem já tem planejamento, quem pede ação e quem ainda está sem.' },
        { alvo: '#vv-planejamentos .p2-filtros', lado: 'baixo', titulo: 'Busca e filtros',
          texto: 'A busca acha o cliente pelo nome, e os filtros mostram só os seus ou só os que pedem ação.' },
        { alvo: '#vv-planejamentos .p2-lista', lado: 'cima', titulo: 'A lista',
          texto: 'Cada linha é um cliente, com a versão, o status e as peças. Clicar abre o planejamento inteiro para revisar e mandar.' },
      ],
    },
    {
      id: 'clientes', nome: 'Clientes', resumo: 'A carteira: o que pede ação, os números e a lista.',
      se: 'body.mundo-modulo[data-modo="clientes"] #painel-clientes #clientes-hero', cobre: ['trilho:clientes', 'modulo'],
      passos: [
        { alvo: '#clientes-hero .pv-cabeca', lado: 'baixo', titulo: 'Clientes',
          texto: 'Essa é a carteira, {nome}: todo cliente ativo da Vybe, com o que cada um tem em aberto.' },
        { alvo: '#clientes-aviso', lado: 'baixo', titulo: 'O que pede ação',
          texto: 'A faixa laranja aponta o que está mais urgente na carteira agora.' },
        { alvo: '#kpi-grid-clientes', lado: 'baixo', titulo: 'Os números',
          texto: 'Esses são os números da carteira: quantos clientes, quantos com atraso e quanto está em aberto.' },
        { alvo: '#clientes-visao-topo', lado: 'baixo', titulo: 'Como ver',
          texto: 'Aqui você troca entre a lista, as fichas e o cérebro de cada cliente, que é tudo o que eu sei dele.' },
        { alvo: '#panel-clientes-lista .cli-barra', lado: 'baixo', titulo: 'Busca e carteiras',
          texto: 'Já sabe o nome? Comece pela busca. Os filtros ao lado separam a carteira do Vinícius e a do Ewerton.' },
        { alvo: '#grid-clientes-lista', lado: 'cima', titulo: 'A lista',
          texto: 'Cada linha é um cliente, e o nome leva a cor da carteira dele. Clicar abre a ficha completa.' },
        { alvo: '#clientes-acoes .d3f-novo', lado: 'baixo', titulo: 'Novo cliente',
          texto: 'E cliente novo se cadastra aqui.' },
      ],
    },
    {
      id: 'gestao', nome: 'Gestão', resumo: 'A agência inteira num olhar: alertas, setores e a semana.',
      se: '.vv-gestao .vs-agencia .d3g', cobre: ['trilho:gestao'],
      passos: [
        { alvo: '.vv-gestao .g2-topo h2', lado: 'baixo', titulo: 'A agência inteira',
          texto: 'Essa é a Gestão, {nome}: a agência inteira num olhar só, do jeito que um dono precisa ver.' },
        { alvo: '.vv-gestao .vs-periodo', lado: 'baixo', titulo: 'Período',
          texto: 'Aqui você escolhe o período, e todos os números da tela acompanham.' },
        { alvo: '.vv-gestao .d3g > .d3-acao', lado: 'baixo', titulo: 'O alerta',
          texto: 'A faixa laranja é o que mais preocupa agora, com o botão para ver do que se trata.' },
        { alvo: '.vv-gestao .d3g-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Esses são os números que seguram a operação: atrasos, alertas, entregas e o dinheiro.' },
        { alvo: '.vv-gestao .d3g-setores', lado: 'direita', titulo: 'Os setores',
          texto: 'Aqui está cada setor com a situação dele. Clicar leva para a visão geral do setor.' },
        { alvo: '.vv-gestao .d3g-semana', lado: 'esquerda', titulo: 'A semana',
          texto: 'E aqui a semana em andamento: o previsto contra o que já ficou pronto.' },
      ],
    },
    {
      id: 'financeiro', nome: 'Financeiro · Vorcaro', resumo: 'A tesouraria: o caixa, o que entra, o que sai e o que pede atenção.',
      se: '#vv-comercial .fv2[data-tela="fx-vorcaro"]',
      passos: [
        { alvo: '#vv-comercial .fv2-topo .fv2-ola', lado: 'baixo', titulo: 'A Tesouraria',
          texto: 'Esse é o Vorcaro, o agente que cuida da tesouraria, {nome}. Só os quatro donos veem esta tela.' },
        { alvo: '#vv-comercial .fv2-in > .d3-acao', lado: 'baixo', titulo: 'O que pede atenção',
          texto: 'A faixa laranja é o que ele quer que alguém olhe agora, como um lançamento que ainda não foi conferido.' },
        { alvo: '#vv-comercial .d3f-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Esses são os números do caixa, e cada um leva para o detalhe dele.' },
        { alvo: '#vv-comercial .fx-tres', lado: 'cima', titulo: 'O detalhe',
          texto: 'Embaixo está o detalhe, com o que entra, o que sai e o que ainda espera conferência.' },
        { alvo: '#vv-comercial [data-fx="mao-abrir"]', lado: 'baixo', titulo: 'Lançar à mão',
          texto: 'E se precisar lançar alguma coisa por conta própria, é por este botão.' },
      ],
    },
    {
      id: 'financas-cliente', nome: 'Finanças por cliente', resumo: 'Quanto cada cliente paga, custa e deixa de margem.',
      se: '#vv-comercial.d3c .d3c-fin',
      passos: [
        { alvo: '#vv-comercial .d3c-topo h2', lado: 'baixo', titulo: 'Finanças por cliente',
          texto: 'Aqui a conta é por cliente: quanto ele paga, quanto custa e o que sobra. Também é só para os donos.' },
        { alvo: '#vv-comercial .d3c-per', lado: 'baixo', titulo: 'Mês ou ano',
          texto: 'Você escolhe olhar o mês ou o ano inteiro, e ao lado troca de mês.' },
        { alvo: '#vv-comercial .v2c-corpo > .d3-acao', lado: 'baixo', titulo: 'O que pede ação',
          texto: 'A faixa laranja aponta o que mais pesa na conta agora.' },
        { alvo: '#vv-comercial .d3c-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Esses são os números do período, com o que está no vermelho em destaque.' },
        { alvo: '#vv-comercial .d3c-fin', lado: 'cima', titulo: 'Cliente a cliente',
          texto: 'E aqui está a lista, cliente a cliente, com quem pede ação separado à esquerda.' },
        { alvo: '#vv-comercial .d3c-novo', lado: 'baixo', titulo: 'Lançar',
          texto: 'Receita ou custo novo entra por aqui.' },
      ],
    },

    // ============================================================ HOJE (padrão V2): uma aba, um roteiro
    {
      id: 'hoje-agencia', nome: 'Hoje · Agência', resumo: 'A operação inteira num olhar: números, o laranja, a fila e a consulta.',
      se: HOJE + ' .d3q.d3h-agc',
      passos: [
        { alvo: '#vv-hoje .d3h-ola', lado: 'baixo', titulo: 'O seu dia',
          texto: 'Esse é o Hoje, {nome}. Ele abre na aba Agência, que é a operação inteira num olhar só.' },
        { alvo: '#vv-hoje .d3h-topo .vv-seg', lado: 'baixo', titulo: 'As abas',
          texto: 'Aqui você troca o ponto de vista: a Agência, a Criação, a Coordenação da semana e as suas próprias tarefas.' },
        { alvo: '#vv-hoje .d3h-nums', lado: 'baixo', titulo: 'Os quatro números',
          texto: 'Esses são os números do dia: o que atrasou, o que vai ao ar hoje, o que ficou pronto na semana e o que espera uma decisão sua. Cada um abre a lista dele.' },
        { alvo: '#vv-hoje .d3q-acao', lado: 'esquerda', titulo: 'O laranja',
          texto: 'O cartão laranja é o que há de mais grave agora, e só existe um por tela. Se for começar por algum lugar, comece por ele.' },
        { alvo: '#vv-hoje .d3h-pede', lado: 'direita', titulo: 'Pede ação',
          texto: 'Aqui está a fila do que pede ação, na ordem de urgência, e no pé dela o que vale ficar de olho.' },
        { alvo: '#vv-hoje .d3h-decidir', lado: 'direita', titulo: 'Para você decidir',
          texto: 'Essas são as artes esperando a sua aprovação. Dá para aprovar ou pedir alteração daqui mesmo.' },
        { alvo: '#vv-hoje .d3q-olho', lado: 'esquerda', titulo: 'Clientes de olho',
          texto: 'E esses são os clientes que mais preocupam hoje, com o motivo ao lado.' },
        { alvo: '#vv-hoje .d3h-lado', lado: 'esquerda', titulo: 'A coluna de consulta',
          texto: 'À direita fica o que é só para consultar: o mês, a agenda de hoje, o WhatsApp e o que os agentes viram.' },
      ],
    },
    {
      id: 'hoje-criacao', nome: 'Hoje · Criação', resumo: 'O dia do time de arte: a fila, o que aprovar e o que voltou.',
      se: HOJE + ' .d3q.d3h-cr',
      passos: [
        { alvo: '#vv-hoje .d3h-ola', lado: 'baixo', titulo: 'Criação',
          texto: 'Essa é a aba da Criação: o dia do time de arte, do jeito que a direção de arte olha.' },
        { alvo: '#vv-hoje .d3h-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Em cima, os números da criação: o que espera aprovação, o que voltou com ajuste e o que está atrasado.' },
        { alvo: '#vv-hoje .d3h-danilo', lado: 'direita', titulo: 'A fila do Danilo',
          texto: 'O Danilo, o agente da criação, monta a fila: o que delegar e o que cobrar agora, já com a sugestão de quem pega cada peça.' },
        { alvo: '#vv-hoje .d3q-acao', lado: 'esquerda', titulo: 'Para aprovar agora',
          texto: 'No laranja ficam as artes para aprovar, uma de cada vez e em tamanho grande, para olhar direito antes de dizer sim.' },
        { alvo: '#vv-hoje .d3h-ajustes', lado: 'cima', titulo: 'Pediram ajuste',
          texto: 'Embaixo está o que voltou com pedido de ajuste, para nada se perder no caminho.' },
        { alvo: '#vv-hoje .d3h-time', lado: 'esquerda', titulo: 'O time',
          texto: 'E à direita o time, com quanto cada pessoa tem na mão hoje.' },
      ],
    },
    {
      id: 'hoje-tarefas', nome: 'Hoje · Minhas tarefas', resumo: 'A sua fila, o que pede você e a semana.',
      se: HOJE + ' .d3q.d3h-tf',
      passos: [
        { alvo: '#vv-hoje .d3h-ola', lado: 'baixo', titulo: 'Minhas tarefas',
          texto: 'Essa é a sua aba, {nome}: só o que está no seu nome.' },
        { alvo: '#vv-hoje .d3h-topo .v2t-dia', lado: 'baixo', titulo: 'Dia de quem',
          texto: 'Por aqui dá para olhar o dia de outra pessoa do time, sem sair da tela.' },
        { alvo: '#vv-hoje .d3h-nums', lado: 'baixo', titulo: 'Os números',
          texto: 'Em cima, o seu dia em números: o que é para hoje, o que atrasou, o que você já fez na semana e o que espera decisão.' },
        { alvo: '#vv-hoje .d3h-tarefas', lado: 'direita', titulo: 'A sua fila',
          texto: 'Essa é a fila. Os filtros separam hoje, a semana, as atrasadas e as feitas, e clicar numa linha abre a peça inteira, com briefing e arquivos.' },
        { alvo: '#vv-hoje .d3q-acao', lado: 'esquerda', titulo: 'O que pede você',
          texto: 'No laranja fica o que pede você agora, e o botão dele já leva para lá.' },
        { alvo: '#vv-hoje .d3h-semana', lado: 'cima', titulo: 'A semana',
          texto: 'No pé, a semana em linha: as prontas contra as previstas, dia a dia.' },
        { alvo: '#vv-hoje .d3h-lado', lado: 'esquerda', titulo: 'A consulta',
          texto: 'E à direita o que é só consulta: o mês, a agenda, o WhatsApp esperando você e as aprovações.' },
      ],
    },
    {
      id: 'hoje-coordenacao', nome: 'Hoje · Coordenação', resumo: 'A grade pessoa por dia, os indicadores e as sugestões do Heitor.',
      se: HOJE + ' .d3q.d3h-co',
      passos: [
        { alvo: '#vv-hoje .d3h-ola', lado: 'baixo', titulo: 'Coordenação',
          texto: 'Essa é a Coordenação: quem faz o quê e em que dia. É daqui que se distribui o trabalho.' },
        { alvo: '#vv-hoje .d3h-topo .v2o-periodo', lado: 'baixo', titulo: 'Dia, semana ou mês',
          texto: 'Você escolhe olhar o dia, a semana ou o mês inteiro, e a grade muda junto.' },
        { alvo: '#vv-hoje .v2o-inds', lado: 'baixo', titulo: 'Os indicadores',
          texto: 'Esses são os indicadores da produção. Clicar em um abre a lista das peças que estão nele.' },
        { alvo: '#vv-hoje .d3v-lar-faixa', lado: 'baixo', titulo: 'O Heitor',
          texto: 'No laranja o Heitor avisa quando alguém passou do limite do dia.' },
        { alvo: '#vv-hoje .v2o-sem .v2o-fichas', lado: 'baixo', titulo: 'Por pessoa',
          texto: 'Por aqui você olha uma pessoa só, quem está sem ninguém ou o time todo.' },
        { alvo: '#vv-hoje .v2o-sem', lado: 'cima', titulo: 'A grade',
          texto: 'Essa é a grade: cada linha é uma pessoa e cada casa um dia, com quantas peças ela tem contra o limite. Arrastar uma peça muda de pessoa ou de dia.' },
        { alvo: '#vv-hoje .v2o-heitor', lado: 'cima', titulo: 'Sugestões do Heitor',
          texto: 'E no pé o Heitor sugere como redistribuir. Ele só sugere, e quem decide é você.' },
      ],
    },
  ]);
})();
