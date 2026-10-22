# Escritório integrado ao Vybe OS

## Escopo implementado nesta revisão

O módulo Escritório usa sessão individual da Vybe. Seis espaços comuns, avatar
em SVG, mesa por pessoa, prévia de aparência, chat escrito por ala, presença e
convites por proximidade compõem a primeira versão. O chat escrito tem seis
grupos (Convivência, Criação, Atendimento, Produção, Reunião e Foco), não um por
sala do mapa: cada sala individual usa o grupo da ala em que fica, e o cabeçalho
da aba Conversa diz onde a pessoa está e com quem divide o chat. O catálogo inicial permite roupa,
pele, cabelo, cor da mesa e um objeto decorativo. Não é um editor livre de pisos,
paredes e móveis como o SoWork.

A movimentação é por clique ou setas; o caminho do clique desvia de sala
trancada e de quem está parado, e clicar num móvel leva ao chão ao lado dele.
Aproximar-se permite enviar convite à conversa da sala; só Disponível recebe
convites. No corredor e no Foco, onde não há voz, o convite marca a conversa
numa sala (a de quem convida ou a Recepção) e os dois vão até lá; o Worker
repassa essa sala no convite (17/10/2026, exige novo deploy do Worker). Ficar numa sala
(1,2 s) entra na conversa dela com o microfone ligado; sair da sala sai da conversa
(decisão do Paulo, 16/10/2026). A câmera começa desligada. A conversa é
compartilhada com quem está na mesma sala; não é áudio espacial privado por
distância. Foco e corredor não oferecem chamada.

A barra compacta mantém presença, lista de colegas e acesso à chamada enquanto
as atividades do painel estão abertas. Estado de presença não é medida de jornada
ou produtividade. Nenhuma gravação de reunião é iniciada.

## Reaproveitamento do VybeChat

A origem consultada é `/Users/paulomartins/Downloads/VybeChat`:

- `client/src/lib/worker-realtime.ts`: formato `{type,payload}` e entrada de presença;
- `cloudflare-worker/vybechat-realtime/src/index.js`: preparação de reunião e
  participante RealtimeKit, adaptada em `server/escritorio-chamadas.js`;
- mesmo SDK RealtimeKit 2.0.1, carregado apenas ao entrar em uma conversa.

Não foi transplantado o shell React para o frontend global do painel. Não foram
copiados código de acesso compartilhado, consulta de equipe ao Monday, OAuth do
Manus, banco MySQL ou fallback de identidade livre. O VybeChat existente não foi
alterado nem substituído em produção.

## Autoridade e acesso

- Neon: pessoas, personalização, histórico de mensagens e identificadores de reuniões.
- Durable Object: apenas conexões, posição e disponibilidade transitórias.
- RealtimeKit: transporte de áudio, vídeo e compartilhamento de tela.
- `/api/painel?area=escritorio`: usa a sessão existente. `pessoa_id`, nome e papel do
  corpo não escolhem a autoria. Endpoints de serviço não entram como pessoa.
- Token HMAC exclusivo, válido por cinco minutos, enviado no primeiro evento do
  WebSocket (nunca em URL/localStorage). Nova entrada consulta novamente a sessão.
  Bloqueios passam a impedir renovação; conexões já emitidas podem durar até cinco
  minutos. Conexão encerrada fecha a chamada. Tokens individuais da mídia não são
  revogados na Cloudflare por este módulo; retirada administrativa imediata de uma
  reunião permanece um trabalho adicional antes de uso com convidados externos.
- Worker aceita somente `VYBE_ORIGIN`, autentica antes de transmitir presença e
  valida salas, coordenadas, tamanho/frequência de eventos. Chat não aceita texto
  pelo WebSocket: o evento só invalida a leitura autenticada no Neon.

## Ativação externa pendente

Nada deste documento aplica migração ou publica serviços automaticamente.

1. Revisar `migrations/2026-10-15-escritorio.sql`, aplicar primeiro em banco isolado,
   depois em produção no momento autorizado. Leitura nunca cria tabelas.
2. Criar/deployar o serviço de `services/escritorio/wrangler.jsonc`. É um Worker
   separado, `vybe-escritorio`, que preserva o VybeChat já publicado.
3. Definir `ESCRITORIO_SESSION_SECRET` com o mesmo valor aleatório de pelo menos 32
   caracteres na Vercel e no Worker. Usar a interface de secrets, sem colocar a
   chave em chat, código ou arquivos versionados. Manter segredo separado do login.
4. Na Vercel, definir `ESCRITORIO_WORKER_URL` com a URL HTTPS desse Worker e as
   variáveis `CLOUDFLARE_ACCOUNT_ID`, `REALTIMEKIT_APP_ID`,
   `CLOUDFLARE_REALTIME_API_TOKEN`, `REALTIMEKIT_PRESET_NAME` do motor de chamadas.
   O token Realtime Admin fica somente no servidor. Não habilitar gravação automática.
5. `VYBE_ORIGIN` no Worker deve ser exatamente o domínio do painel. Em homologação,
   usar Worker e banco separados; não ampliar origem de produção para localhost.
   O ambiente `homologacao` do Wrangler fixa o Worker separado e a origem do
   preview da branch `codex/escritorio-vybechat`. Implantar com
   `npx wrangler deploy --env homologacao`, a partir de `services/escritorio`.
   Não executar o deploy padrão durante o piloto. O segredo desse ambiente é
   próprio; não é herdado do Worker de produção.
6. Reimplantar o painel depois das variáveis. Confirmar com duas contas de teste
   autorizadas: entrada, saída, reconexão/expiração, isolamento de identidade,
   mensagem, convite, microfone, câmera, tela e retorno às atividades. Conferir
   Safari e celular com dispositivos reais, sem criar atividades fictícias em produção.

Sem migração a API responde 503 com indicação de configuração. Sem Worker a
interface não simula presença. Sem credenciais RealtimeKit a chamada informa erro.
A demonstração local mostra pessoas fictícias e prévia, bloqueia gravações e não
liga microfone/câmera; persistência é verificada em PostgreSQL isolado nos testes.

## Limitações antes de substituir o Discord

Validar chamadas reais e custos na conta Cloudflare, moderação/retirada imediata de
participantes, notificações fora do navegador, histórico paginado e políticas de
retenção. A primeira versão não oferece mensagens diretas, upload de anexos,
reuniões privadas ou editor livre de mapa. Não remover o Discord antes de um piloto
com a equipe confirmar comunicação estável.

## Conferência externa em 15/10/2026

Após login do responsável na Cloudflare, foi confirmado:

- Worker existente `vybechat-realtime`, implantado do commit remoto
  `b5cf15e175813803c81920fd256d81558e535740` do VybeChat. A pasta local é mais
  antiga e ainda contém referências ao roster Monday; esse caminho não foi usado.
- `/health` responde `callEngine: legacy`. Não havia aplicativo RealtimeKit nessa
  conta: o motor SFU constava no código, mas não estava configurado no serviço.
- Criado somente o aplicativo isolado `vybe-escritorio-homologacao`, ID
  `38362049-97af-40cf-a3b1-6d1b6a0291ee`, para preparar o piloto. Nenhuma reunião
  foi iniciada, nenhum dispositivo ativado e nenhuma credencial foi criada.
- O preset padrão existente é `group_call_participant` (com sublinhados),
  permitindo áudio, vídeo e tela, sem controles de host. Esse é o padrão do
  adaptador. Não usar `group-call-host`: esse nome não existe no aplicativo criado.
- Não houve aplicação da migração em produção, alteração do Worker atual,
  publicação do módulo no painel ou alegação de chamada real funcionando.

### Preparação posterior do preview

- O responsável criou o token e salvou `CLOUDFLARE_REALTIME_API_TOKEN`; a interface
  confirmou o nome em Preview, Production e Development, sem revelar o valor.
- `CLOUDFLARE_ACCOUNT_ID`, `REALTIMEKIT_APP_ID` e `REALTIMEKIT_PRESET_NAME` foram
  cadastrados como Config somente em Preview para o aplicativo isolado acima.
- PR #129 permanece em rascunho. O primeiro preview e os checks do commit
  `42f4d25` passaram; isso não valida presença, chamadas nem escrita remota.
- A migração, banco isolado, Worker e segredo compartilhado de sessão ainda
  precisam de configuração antes de iniciar testes com pessoas.
- Banco isolado criado em seguida: `codex-escritorio-homologacao`,
  `br-tiny-mud-acdko4uj`, projeto `bold-silence-70503527`, com expiração
  automática em 16/10/2026 às 21h36 (America/Bahia). O preview ainda precisa do
  override de conexão dessa cópia; não testar escrita com a conexão compartilhada.
- Serviço `vybe-escritorio-homologacao` conectado, com autorização do responsável,
  somente ao repositório do painel e à branch `codex/escritorio-vybechat`.
  Builds automáticas de outras branches permanecem desabilitadas. A primeira
  build tentou `main` antes de a seleção de branch estar disponível e falhou por
  diretório ausente; não publicou o código do escritório.
- Em seguida, a build da branch publicou o Worker separado. `/health` em
  `https://vybe-escritorio-homologacao.gestaovybe.workers.dev` retornou
  `{"ok":true,"service":"vybe-escritorio"}`. Esse teste não comprova WebSocket
  autenticado ou chamada: o segredo de sessão ainda falta.
- A migração foi aplicada somente em `br-tiny-mud-acdko4uj`; uma consulta posterior
  confirmou as três tabelas `vybe_escritorio_perfis`, `vybe_escritorio_mensagens`
  e `vybe_escritorio_salas`. Nenhuma migração foi aplicada na origem `main`.
- `VYBE_HOMOLOGACAO=1` e `ESCRITORIO_WORKER_URL` foram preparados para o override
  exclusivo da branch do escritório. O cadastro de `DATABASE_URL` dessa cópia e
  de `ESCRITORIO_SESSION_SECRET` nas duas plataformas requer conclusão pelo
  responsável. Não iniciar escrita pelo preview antes de conferir esses cadastros.

## Mapa e arte (16/10/2026)

- O escritório é um mapa único (`vybe-escritorio-planta.js`) desenhado por
  `vybe-escritorio-mapa.js`: piso e paredes em canvas; cada móvel, divisória e
  personagem é um elemento com z-index pela profundidade. A presença continua em
  porcentagem no Worker; a sala de conversa é a do ambiente onde a pessoa está.
- Nove salas individuais de 8×8 (Paulo, Vinícius, Ewerton, Deivid, Bia, Jady,
  Mizinho, Taynara, Reriston), ligadas pelo primeiro nome. Planta de
  17/10/2026 (decisão do Paulo): prédio 60×48 em volta de um pátio central,
  Atendimento e Criação ao fundo com a porta para o corredor, Produção na
  lateral esquerda com a porta para a direita; só a parede do prédio e a do
  fundo de cada sala são altas (`alta` no ambiente), o resto é baixo. A pintura
  da sala passou a ter 64 ladrilhos e 32 trechos de parede (formato antigo de
  10×10 é descartado pelo servidor). O desenho de cada sala é o mesmo em todas
  (`escritorioMoveisDaSala`), espelhado na diagonal nas salas de porta à direita.
  Arrumação de sala salva antes de `ESCRITORIO_PLANTA_DESDE` também é
  descartada (mesma regra do mapa geral): as salas mudaram de tamanho e lugar.
- Divisórias baixas sem dono são de vidro (translúcidas): o lado de dentro da
  sala vizinha não some atrás delas. Nos vãos de parede baixa não há porta,
  só a soleira; a porta de vidro fica nos vãos de parede média.
- Animação dos móveis: um tique a cada 100 ms, com `frameRepeat` da arte e uma
  sequência por móvel quando há várias. Com "reduzir movimento" o cenário
  continua animado, só na metade do ritmo; a preferência desliga a inércia da
  câmera, o fundo e os pulsos de aviso.
- Vida dos bonecos (como no Habbo): parado, pisca de vez em quando (gesto `eyb`
  do imager), mexe a boca enquanto o balão de fala está aberto (`spk`), acena
  alternando o quadro de aceno com o de pé, vira a cabeça para quem está perto
  (até 90° do corpo, de preferência para quem está falando) e fecha os olhos
  quando a pessoa está ausente. O passo tem o ritmo do Habbo: uma passada de 4
  quadros por ladrilho (`MAPA_PASSO_MS`, 240 ms), e a velocidade do próprio
  boneco segue a mesma conta.
- Salas pessoais cheias como no Habbo: mobília encostada nas paredes do fundo
  e da esquerda (as que aparecem por trás), meio livre para andar, faixa da
  porta e os corredores dos dois lados da mesa sem móvel, e detalhes pequenos
  animados (xícara fumegando, impressora, globo, neon, tela). A frente de todo
  móvel vira para quem olha o mapa (direções 4 e 2).
- A arte é do Habbo (Sulake), obtida pelo habboassets.com. **Uso interno**,
  autorizado pelo Paulo em 16/10/2026, ciente de que não há licença: não usar em
  material público, comercial ou de cliente.
- A arte não é arquivo público do site: fica em `assets/escritorio/habbo`, vai
  junto da função (`includeFiles` no `vercel.json`) e sai por
  `/api/painel?area=escritorio&acao=arte`, só com sessão. Para adicionar um
  móvel: `node scripts/habbo-moveis.mjs <classe>`. Os bonecos vêm do imager do
  Habbo no navegador de cada pessoa (pose, direção e andar).
- Abertura da Vybelândia (`vybe-escritorio-abertura.js`): cena animada com
  `assets/vybelandia.webp`, criador de personagem (peças do Habbo conferidas por
  corpo) e boas-vindas. Cada pessoa vê uma vez por versão (`ESCRITORIO_ABERTURA`,
  guardada em `perfil.abertura`); para todos verem de novo, troque a data.
- Salas individuais têm as duas paredes do fundo altas, na cor da sala
  (`divisorias` com 5º campo de cor em `vybe-escritorio-planta.js`). O painel
  do acervo ladrilha só a parte desenhada da arte (`mapaRecorteOpaco`); a base
  e o topo da parede seguem a cor da sala, não um cinza fixo. Antes, parede
  pintada de "alta" mostrava uma faixa escura acima do painel.
- Fundo do mapa (17/10/2026, decisão do Paulo): a praça da Vybelândia é uma
  imagem parada, `assets/escritorio-fundo.webp` (1672×941), com os cantos da
  praça em `escritorioPlantaComMesas` (`fundo.praca`). O vídeo da cidade ficou
  só na abertura: no mapa chegava borrado, disputava atenção e gastava CPU.
- Corredores do prédio usam a calçada clara da praça (`texturaCorredor`), cada
  porta tem soleira própria no piso e o letreiro em neon da sala fica acima da
  porta, não em cima dela. O desenho da porta recua meio ladrilho até a linha
  da parede (`mapaPosicaoPorta`): a arte do Habbo fica no meio do ladrilho e a
  porta aparecia solta, meio passo à frente do vão.
- Quadros e tapetes da equipe (`migrations/2026-10-17-escritorio-imagens.sql`,
  tabela `vybe_escritorio_imagens`): PNG/JPG/WEBP até 1,5 MB, tipo conferido
  pelos bytes no servidor. O dono da sala (ou administrador) envia pelo editor,
  aba Imagens; quadro vai na parede alta do fundo (até 6×3 ladrilhos), tapete no
  piso (até 6×6; no mapa geral, só tapete e só administrador). No mapa o item é
  `["vybeimg_<id>", x, y, dir]`; apagar a imagem tira o item da camada na mesma
  transação. O arquivo sai por `/api/painel?area=escritorio&acao=imagem&id=`,
  só com sessão. Sem a migração, o editor avisa e o resto do mapa segue igual.
- Música das salas (`vybe-escritorio-musica.js`): o bot de música do VybeChat.
  Desde 19/10/2026 (decisão do Paulo), toda jukebox ou aparelho de som
  (`ESCRITORIO_SOM`: rádio, vitrola, toca-discos, DJ, caixas, trax) abre o
  player, em qualquer sala. Cada sala (zona) tem a sua fila no Worker, com até
  50 links de vídeo ou playlist do YouTube, o ponto da música e o storage
  `musica:<zona>` (o Lounge continua em `musica`). O estado vai só para quem
  está na sala. Cada navegador toca o próprio player enquanto a pessoa está
  numa sala com aparelho de som, e só quem está na sala mexe na fila. Volume é
  por pessoa. A Praça não tem zona e fica sem música.
- Qualidade da tela mostrada: quem mostra escolhe Nítida, Equilibrada ou Leve;
  quem assiste pede (`screen:quality`) e quem mostra aplica com um clique. O
  RealtimeKit não entrega qualidades diferentes da tela para cada espectador.
- Conversa única (`escritorioCanal`): espaços abertos → canal `escritorio`;
  sala trancada → canal da zona. O SDK não toca áudio
  (`experimentalAudioPlayback: false`); `escritorioTocarVozes` toca só quem
  está na mesma zona (presença do Worker), com volume por pessoa. Cada pessoa
  reaproveita o participante (`vybe_escritorio_salas`, chave
  `p:<pessoa>:<canal>`, token renovado em `/participants/<id>/token`). A tela
  mostrada vai sem áudio do sistema. Falha ou queda tentam de novo sozinhas
  (1 s, 2 s, 4 s… até 30 s).


## Quartos próprios — fase 1 (17/10/2026)

As salas pessoais passam a ser cenas próprias de 8×8, em coordenadas locais.
No mapa geral ficam fachadas, portas, letreiros e contagem de ocupantes. Entrar
pela porta (ou escolher a sala) troca a cena; a soleira e “Voltar ao mapa” levam
à saída da fachada. Cada cena mostra apenas as pessoas que estão nela.

A zona `sala-N` continua identificando presença, trancas, convites e voz. Esta
fase não muda Worker, API nem schema. O editor recebe a planta da cena atual;
modelo, piso e paredes continuam usando as estruturas existentes. A fase 2 de
modelos e redefinição de arrumação não foi implementada nesta revisão.

A retomada incluiu correções para limitar o céu ao mapa geral e enquadrar o
quarto na área disponível ao redimensionar a janela. O observador de tamanho
é desconectado ao destruir a cena.

Verificação: os 56 testes específicos e a auditoria de planta passaram antes
desses ajustes visuais; o check completo final também passou com 376 testes e build. A cena
do quarto foi aberta na demo desktop; a conferência do editor e do celular
ficou incompleta porque o navegador deixou de responder. A demo não conecta
presença nem mídia e não comprova voz entre pessoas ou persistência remota.
Conferir essas superfícies e os checks do commit final antes de promover.


### Criação do quarto e VybeCoin — implementação local

Solicitado por Paulo em 17/10/2026. O criador existente agora conduz por planta,
mobília inicial (vazio/essencial/boas conversas), acabamento e confirmação. O
catálogo único `assets/escritorio/habbo/quartos.json` define plantas e itens
iniciais para navegador e servidor. Plantas: compacto, retangular, amplo, L,
dividido e níveis. Níveis usam altura na projeção, seleção e deslocamento; só a
escada conecta os patamares. A soleira conserva a identidade da sala e a voz.

Perfil guarda `sala_planta` e `quarto_configurado`; a camada da sala continua
responsável pelos móveis. A configuração é transacional e idempotente. Móveis
já salvos são preservados, desde que caibam na planta, e entram no inventário.
O endpoint de perfil não permite forjar configuração nem trocar a planta.

O editor existente distingue loja e inventário. Mesa, cadeira, computador básico,
cacto, tapete, estante baixa e luminária são gratuitos; cada unidade extra custa 25 moedas. A compra bloqueia a
carteira e usa chave idempotente. Salvamento verifica inventário do dono, número
de unidades, medidas reais, patamares e escada livre; cópia e histórico não
concedem móveis. A loja não concede acesso a salas de outra pessoa.

Regra confirmada por Paulo: 10 moedas por demanda finalizada e 50 por conquista.
A migração `2026-10-17-escritorio-vybecoins.sql` adiciona carteiras, razão,
inventário e recibo global da demanda. O trigger acompanha o evento de status na
mesma transação, antes das automações retirarem responsáveis. Cada executor
recebe 10 apenas na primeira finalização da atividade (`Finalizado` ou `Feito`,
conforme a equivalência já usada nas automações). Reabrir ou trocar de
executor não recompensa de novo. Demandas já finalizadas antes da migração são
marcadas sem crédito retroativo. Conquistas únicas: montar o quarto, primeira,
quinta e décima demanda concluída. Não há moedas por mera presença.

As duas migrações (`2026-10-17-escritorio-vybecoins.sql` e
`2026-10-17-escritorio-mapa-versoes.sql`) foram aplicadas em produção em
17/10/2026 com autorização do Paulo, em transação única cada, depois de
conferir no próprio banco as tabelas e colunas usadas pelo gatilho (346
demandas antigas marcadas sem crédito). Persistência foi verificada com PGlite
isolado. A demo simula somente o estado visual em memória e não comprova banco
remoto, presença ou mídia.

Telas de criação (17/10/2026, depois do primeiro uso do Paulo): cada planta,
modelo e o acabamento são desenhados pelo próprio renderizador do escritório
(`criadorMontarPrevias`, `planta.previa`), com o piso e a cor de parede
escolhidos e o boneco da pessoa na porta; piso e parede são amostras (as mesmas
listas que o servidor aceita), não listas de texto. A regra "a decoração atual
cabe nesta planta?" é conferida no navegador (`criadorDecoracaoCabe`, espelho de
`validarPisoQuarto` sem medidas) e aparece em cada planta; quando não cabe, a
opção "Manter minha decoração" fica desligada com o motivo e a pessoa começa de
um modelo (os móveis vão para o inventário). Se o servidor ainda recusar, a
pessoa volta ao passo da mobília com a mensagem, em vez de ficar presa no fim.

Validação local: `npm run check` passou com 383 testes; as regressões adicionais
verificaram a preservação do inventário ao recomeçar a decoração e todos os modelos
iniciais nas seis plantas. Build e `git diff --check` passaram. Fluxo de criação,
saldo, inventário e compra simulada foram conferidos no navegador em desktop e
390×844; sem erros de console nesse fluxo. A compra demonstrativa consumiu 25 de
50 moedas apenas em memória. A faixa da demo intercepta o centro de alguns
botões da navegação móvel; a conferência usou a parte descoberta dos controles.
Checks do commit final devem ser confirmados no PR antes de promover.

### Pontos (XP) e VybeCoins por função — fase 1 (17/10/2026)

Plano, valores e decisões do Paulo em `docs/escritorio-pontos.md`. Resumo:

- Duas contas na carteira: `saldo` (VybeCoins, compram na loja e podem cair por
  atraso ou alteração, nunca abaixo de zero) e `xp` (só sobe; define o nível).
  O razão `vybe_escritorio_moedas` ganhou `pontos`, `regra` e `conteudo_id`; a
  perda com saldo zero fica registrada com quantidade 0.
- `vybe_escritorio_funcoes` diz quem é Criação, Atendimento (com a carteira
  azul/laranja), Agendamento, Produção ou Gestão; `vybe_escritorio_regras`
  guarda moedas, XP, teto, se conta como entrega e se está ativa. Mudar valor
  ou desligar regra é um `UPDATE`, sem deploy.
- Instantâneo (gatilho `vybe_demanda_moedas`, função `vybe_pontuar_evento`):
  Solicitações finalizada (+prazo, +carteira), Produção enviada para aprovação
  (primeira vez), aprovada sem alteração (+carteira), volta para alteração (uma
  perda por peça por dia), agendou (saiu de Para agendar/Agendado para
  Agendado/Finalizado, por quem é do Agendamento), captação feita ou material
  bruto (primeira vez), criada com briefing (Gestão).
- Fechamento (`server/escritorio-pontos.js`, chamado por `/api/mirror-reconcile`
  às 00:00 da Bahia): dia útil sem demanda vencida ou com vencida (só status em
  que a peça está na mão de quem executa, `STATUS_NA_MAO`), nada "Para agendar"
  vencido, dia sem furo (veicula hoje e ainda aberta), dia ativo (só XP); na
  segunda, a semana: meta = média de entregas da função nas últimas 8 semanas
  completas desde a primeira entrega (mínimo 1), bônus igual para quem bate.
  Dias que ficaram para trás fecham com o estado atual (até 7); a instalação
  marca os 7 dias e as 2 semanas anteriores para o primeiro ciclo não fechar o
  passado.
- Histórico: `vybe_escritorio_entregas` é reconstruída na migração (Solicitações:
  responsáveis atuais → último registro de responsáveis → quem marcou; Produção:
  quem mandou aprovar se for da Criação, senão responsáveis da Criação; agendou;
  captação; carteira) e recebe o bônus de chegada (2 moedas e 10 XP por
  entrega, sem teto).
- A ficha mostra nível pelo XP do servidor, meta da semana e os últimos
  lançamentos só para a própria pessoa; para quem administra, os números das
  demandas continuam como antes.
- Validação: `tests/escritorio-pontos.test.mjs` cobre cada regra, repetição,
  rollback, regra desligada, fechamento do dia e da semana e a reconstrução do
  histórico em PGlite. Migração não aplicada em produção nesta revisão.

### Loja com raridade, estoque, vitrine e marcos — fase 2 (17/10/2026)

Plano e decisões do Paulo em `docs/escritorio-pontos.md` (seção "Fase 2").
Resumo:

- Faixas em `vybe_escritorio_raridades` (comum 25, raro 120, muito raro 500,
  lendário 1.500; estoque por móvel 10/3/1; vitrine 6 + 2) e os móveis que não
  são comuns em `vybe_escritorio_catalogo` (lista gerada por
  `scripts/escritorio-raridades.mjs`; a tabela é a autoridade depois de
  aplicada). Essenciais continuam grátis. Estoque é da equipe toda.
- Vitrine da semana (`vitrineDaSemana`): sorteio fixo pela chave da semana
  (mesma segunda do fechamento) e pelo móvel, entre os que ainda têm estoque
  ou esgotaram na própria semana; muito raro e lendário só se compram quando
  estão nela. `carregarEconomia` devolve `loja` (faixas, itens limitados,
  vitrine) para o editor; a entrada não carrega a loja.
- Compra (`comprarMovel`): tranca a carteira e depois a linha do móvel,
  confere marco, estoque, vitrine e saldo, grava razão com a chave única e
  soma `vendidos`. Repetição da chave devolve o mesmo resultado sem cobrar.
- Marcos (`server/escritorio-marcos.js`): calculados pelas entregas, XP, metas
  e fila; concedidos ao abrir a ficha ou a loja e no ciclo diário
  (`conferirMarcosDaEquipe` em `/api/mirror-reconcile`); registro em
  `vybe_escritorio_marcos`, conquista pela regra `conquista` (origens antigas
  `conquista:primeira-demanda`/`dez-demandas`/`meu-quarto` reaproveitadas) e
  o móvel do marco no inventário, na mesma transação. O gatilho deixou de dar
  as conquistas de 1ª/5ª/10ª demanda. Quem administra vê os marcos de outra
  pessoa (`acao=economia&pessoa=ID`).
- Tela: loja mostra saldo, faixas, vitrine da semana, etiqueta de raridade,
  "restam N", "Esgotado", "Fora da vitrine" e "Só por marco"; grupos "Vitrine
  da semana", "Raros", "Muito raros" e "Lendários". A ficha lista os marcos do
  servidor com data e o móvel que cada um dá; o cálculo no navegador saiu.
- Validação: `tests/escritorio-loja.test.mjs` (preço por faixa e por móvel,
  estoque esgotado com compras concorrentes, vitrine por semana, móvel só por
  marco, marcos idempotentes, conquistas antigas não pagas duas vezes,
  repetição da chave). Loja e ficha conferidas na demo em desktop e 375×812.
  Migração não aplicada em produção nesta revisão.

### Plantas por formato, área comum e reinício (17/10/2026)

- Catálogo único com 26 plantas (8 formatos; 6×6 até 12×12) e seis plantas
  legadas preservadas para leitura. Porta, escada e modelos iniciais seguem
  cada tamanho. Criador: formato/tamanho → mobília → acabamento → confirmação.
- Editor reúne Meus móveis e Loja; inventário mostra unidades livres; loja
  conserva preços, raridade, estoque, vitrine semanal e marcos do servidor.
- A área comum mantém as mesmas zonas e portas, com menos móveis, materiais
  coordenados e lounge aberto. Não muda salas de voz nem o Worker.
- Decisão explícita de Paulo: começar os quartos E os inventários do zero,
  preservando moedas, XP e conquistas. Operação revisável em
  `migrations/2026-10-17-escritorio-quartos-reinicio.sql`, fora do build e sem
  aplicação automática. A transação guarda perfis completos, inventário e
  camadas em `vybe_escritorio_quartos_reinicio` e decoração no histórico;
  limpa os inventários e pintura, marca o quarto não configurado e remove a
  camada geral salva para usar o novo padrão. A chave única evita repetir.
- Recuperação: primeiro exportar a linha `formatos-2026-10-17` da tabela de
  reinício. `perfis`, `camadas` e `inventario` contêm as linhas originais com
  IDs, versões e datas. Restaurar em transação somente após conferir mudanças
  feitas depois do reset; não sobrescrever compras ou decoração posteriores.
- Validação local: suíte completa e auditoria de circulação; regressões de
  reinício idempotente com backup e da integração inventário/loja em PGlite/VM.
  A demo não comprova escrita em produção nem funcionamento de voz/vídeo.

### Construção e interação — referências e melhorias (17/10/2026)

Trechos inspecionados das referências enviadas pelo Paulo:
- https://www.youtube.com/watch?v=MojE_8e-t7I — quartos e coleções antigas.
- https://www.youtube.com/watch?v=0Aql5ztnV60 — construção de cozinha moderna.
- https://www.youtube.com/watch?v=QjvLdnI9cpE — apartamento contemporâneo.

O editor existente é reaproveitado: barra compacta com Selecionar/Mover visão,
Espaço temporário para câmera, grade alternável e atalhos. Opções menos usadas
ficam recolhidas. Construção e arquitetura / Janelas e portas são filtros do
mesmo catálogo (não importam nem concedem móveis novos).

A entrada no editor interrompe a rota do personagem; não altera a velocidade,
a presença ou a voz. A prévia usa posição final com ajuste fino e altura de apoio;
cliques atrasados e arrastos cancelados não inserem/movem peças. A escada livre
segue a mesma restrição do servidor. Duplicar/colar respeita o inventário local
carregado, sem substituir a validação transacional ao salvar. Guardar remove o
móvel do quarto, preservando a unidade comprada no inventário.

Verificação: regressões de quantidade, bordas, escadas, câmera, interrupção,
prévia em mesa e resposta atrasada. Demo desktop inspecionada, sem erros de console;
a demo não comprova persistência nem mídia em produção.

### Espaços comuns como cenas e mapa em quarteirões (17/10/2026, noite)

Pedido do Paulo depois de comparar com as referências (quartos da Habbo News
#174 e a "Cozinha Moderna" do vídeo acima): o mapa único de 80 × 80, com
paredes internas de vidro baixo e móveis espalhados, não chegava perto delas.
Diagnóstico: faltava empilhar, faltavam paredes altas com itens e a escala
deixava tudo miúdo e vazio.

- Os oito espaços comuns (Reunião, Auditório, Produção, Café, Jogos, Foco,
  Academia, Lounge) viraram cenas próprias, pelo mesmo mecanismo dos quartos
  (`escritorioPlantaDoQuarto`, planta embutida no ambiente, sem parede na
  frente). A zona é o id do espaço — a mesma que o Worker já aceitava —, então
  voz, convites e contagens não mudaram. Recepção e Pátio continuam no mapa.
- Cada cena tem uma linha de móveis e fica preenchida do chão à parede
  (`ESCRITORIO_MOVEIS_CENAS`): Café é a cozinha moderna (bancada preta, coifa,
  armários de parede, ilha, jantar); Reunião é executiva em madeira escura;
  Auditório é cinema; Jogos é fliperama; Foco é biblioteca; Academia,
  Produção (estúdio e edição) e Lounge (bar, lareira, pista).
- No mapa geral os espaços viram prédios com telhado (mureta e caixas de ar),
  janela sobre os bancos da calçada, vasos e postes nas pontas e na porta. O
  telhado entra no recorte das paredes: fica transparente com alguém atrás.
- Empilhar como no Habbo: no editor, qualquer móvel sólido (menos assento)
  serve de base; no desenho, o de cima fica à frente; no verificador, a peça
  apoia no topo mais alto abaixo dela (nem flutua nem afunda).
- O verificador confere cada cena; janela em fachada conta como parede de fora.
- Cenas comuns não são editáveis pelo editor (a camada continua só `geral` e
  salas); o mapa geral salvo antes desta mudança deixa de valer.

### Sem mapa geral: Convivência e Praça (17/10/2026, noite)

Decisão do Paulo depois de ver os espaços comuns como cenas: o mapa geral
deixou de existir, como no Habbo (um quarto por vez, troca pelo navegador).

- A Recepção e o Pátio viraram a **Convivência** (zona `recepcao`, que o
  Worker já aceitava): balcão, sala de estar sob a janela, mural, bebedouro,
  máquinas, estantes, fonte com bancos e mesinhas de café.
- A área de fora virou a **Praça**, compacta e ao ar livre (sem paredes, chão
  por trechos: gramado, deck, calçamento, lago e piscina que não se pisam): é
  a cena de abertura e a camada `geral` do editor de quem administra. Sem
  zona, como era o corredor, e por isso sem voz. Para ter voz na Praça basta
  incluir `praca` na lista do Worker (`zonaValida`) e usar essa zona, o que
  exige publicar o Worker.
- A porta de cada sala leva à Convivência; a da Convivência leva à Praça e a
  da Praça volta. A lista de salas (inclusive a Praça) leva direto, com a
  tranca valendo. Chegada: no próprio quarto; sem quarto, na Convivência.
- Saíram o prédio, as fachadas com telhado, o minimapa, os atalhos "Ir para"
  e os elevadores; o motor de desenho ficou só com o caminho das cenas.
- A música do Lounge passou a tocar na cena inteira (antes dependia de dois
  pisos do mapa geral e tinha parado quando o Lounge virou cena).
- Paredes do mezanino dos quartos com a cor da sala e borda clara no alto.

### Mecânicas do Habbo no boneco e nas salas (17/10/2026, noite)

- Rosto (triste, surpreso, bravo; teclas 5–7), placa (coração, exclamação,
  sorriso, números; 8–9 e menu "Mais"), sentar no chão (tecla 4 ou ":sit"
  no chat) e "digitando…" no chat. Vão pelo balão de fala com o marcador
  invisível U+2063 na frente: o Worker já repassa o balão a todos, então não
  foi preciso publicar outra versão dele; quem recebe aplica e não mostra
  balão. O rosto também acompanha o texto do balão (":(", "nossa!!", ">:(").
- Quem segura café ou bebida leva o copo à boca de tempos em tempos.
- Dois cliques num móvel com estados passam para o próximo (todos veem).
- Dado do Habbo (rola e cai de 1 a 6, todos veem) na Convivência e no
  Jogos; cabines de teleporte na Convivência e na Praça levam a qualquer sala.
- Dançar não entrou: o gerador de bonecos do Habbo não desenha as danças.

### Construção livre e inventário (17/10/2026, noite)

- Altura livre (como o ladrilho de empilhar do Habbo): na barra da peça
  selecionada, "−"/"+" mudam 0,1 nível; Page Up/Page Down (Shift: 0,5);
  "No topo" apoia no que está embaixo, "No chão" volta. O servidor aceita até
  40 níveis (desde 18/10/2026, como o Habbo).
- Blocos, palcos e plataformas baixos (`MAPA_SUBIVEIS`) são pisáveis: o boneco
  sobe até 1,3 nível de um ladrilho para o vizinho e desce de qualquer altura.
  Uma torre mais alta continua sendo parede.
- Bloco e assento invisíveis (`vybe_bloco_invisivel`, `vybe_assento_invisivel`)
  são essenciais grátis; só aparecem, translúcidos, durante a edição.
- Luz do quarto (`sala_luz`: quente, fria, rosa, roxa, verde, noite) em
  Piso e paredes → Luz. Tinge piso, paredes, móveis e bonecos; nomes e balões
  ficam normais. Salva como a pintura, na hora.
- Planta desenhada (`sala_celdas`, 12 × 12 códigos sobre a planta escolhida:
  `0` mantém, `v` sem piso, `p` piso, `1`/`2` patamares). Porta e escada não
  mudam. Vai junto com os móveis no Salvar, na mesma transação, e o servidor
  confere que nenhum móvel ficou fora do piso. Trocar de planta recomeça.
- Meus móveis: filtros Todos/Colocados/Guardados e por tipo; cada cartão diz
  quantos estão aqui, no outro andar e guardados. "Guardar tudo" (Opções)
  devolve ao inventário tudo o que está no quarto.

### Física do Habbo e social (18/10/2026)

- Portões (`classic1_gate`, `plant_mazegate`, `bb_gate_g`…): fechado bloqueia,
  aberto (estado 1) se atravessa; abre e fecha com E, clique duplo, a
  alavanca (`wf_floor_switch1`) ou a placa de pressão (`wf_pressureplate`,
  abre enquanto alguém está em cima). Todos veem pelo `furni:toggle`.
- Cama: deita em qualquer ladrilho dela, virado para onde ela aponta. A
  imagem deitada do Habbo é 110 × 64 (antes saía esticada em pé, inclusive
  no "Deitar").
- Esteira rolante (`*_roller`) leva quem para em cima; gelo
  (`es_skating_ice`) faz deslizar até sair dele; água rasa (`bw_water_*`) tem
  respingo; trampolim faz pular. A física roda no navegador de quem anda; os
  outros veem pela posição.
- Subir em bloco é suave (a altura acompanha o passo); cadeira em cima de
  bloco ou patamar é assento; móvel alto em cima de bloco bloqueia. O palco do
  Auditório ganhou degraus.
- Café na mão se entrega a quem está ao lado (E). A mesa de centro ("coffee
  table") não serve mais café.
- Ausente: o boneco cochila com "z Z z".
- Decoração salva (móveis, piso, paredes, luz, planta, porta) chega na hora a
  quem está na mesma cena (comando `dec=` no balão; quem recebe relê do
  servidor).
- Porta do quarto embaixo ou à direita (`sala_porta`), em Piso e paredes →
  Planta; o servidor recusa se houver móvel no vão novo. A altura das paredes
  já era por trecho (Pintar parede → Altura).
- Post-its nas paredes das salas e presentes de móveis entre colegas dependem
  de `migrations/2026-10-18-escritorio-postits-presentes.sql`. Sem a migração,
  a parede fica sem post-its e o pedido responde "aguardam a migração".
  Presente só de unidade guardada (fora de qualquer andar), nunca essencial,
  imagem ou móvel de marco; a chave do pedido evita dar duas vezes.
- Correções: duas trocas de móveis seguidas desenhavam tudo em dobro (agora
  em fila); "Ir para Convivência" aparecia encostado em qualquer parede (agora
  só na soleira).

### Física pela ficha oficial do Habbo (18/10/2026)

- `assets/escritorio/habbo/fisica.json` sai da furnidata oficial
  (`scripts/habbo-fisica.mjs <furnidata.json>`, baixada de
  `https://www.habbo.com.br/gamedata/furnidata_json/1`): para cada móvel, se
  dá para pisar (canstandon), sentar (cansiton), deitar (canlayon), pôr coisas
  em cima (canputstuffon) e a altura. Ao trocar o catálogo, gere de novo.
- Grade igual à do servidor do Habbo (Arcturus `Room.canWalkAt/canSitAt/
  canLayAt`): em cada ladrilho vale o móvel mais alto; degrau até 1,5 e queda
  livre (`RoomLayout.MAXIMUM_STEP_HEIGHT`); deita na linha da cabeceira; o
  portão (0 fechado, 1 aberto) não muda com alguém em cima; empilhar no editor
  só em cima do que aceita coisas (a altura livre continua para o resto).
- Com a ficha, 14 assentos que estavam como parede passaram a sentar
  (poltronas da Reunião, cadeiras do Auditório, banquetas da Produção…). O
  palco do Auditório virou `classic7_stage` (no Habbo o `cine_platform` é
  assento); a bandeja que estava em cima do minibar saiu.
- O verificador (`scripts/escritorio-auditar.mjs`) usa a mesma ficha e a
  mesma grade do mapa e acusa móvel empilhado no que não aceita nada em cima.

### Mais física do Habbo (18/10/2026, noite)

- Catraca de mão única (`onewaydoor_c22_rosegold`, Arcturus
  `InteractionOneWayGate`): fechada na grade; quem está no ladrilho da frente
  (para onde ela está virada) passa e sai do outro lado; do outro lado não abre.
- Teleporte em par: nos espaços comuns, duas cabines do mesmo modelo levam uma
  à outra (a escura da Convivência e a da Praça); sem par, abre a lista.
- Na água o boneco nada (afunda até a cintura); no gelo desliza sem dar passos.
- Esteira a cada 500 ms; máquina de café, geladeira e afins se usam pela frente.
- Fora do escopo por enquanto, com o motivo:
  - esteira levando móveis: no Habbo o móvel muda de lugar no banco a cada
    passo; aqui a decoração só muda pelo editor, numa transação com versão;
  - móveis de várias alturas: a lista de alturas fica no banco do servidor do
    Habbo (items_base.multiheight), não na furnidata pública;
  - Wired: precisa de tela para ligar gatilho a efeito e de onde guardar isso.

### Construção no nível do Habbo (18/10/2026)

- Até 1.500 móveis por sala e altura até 40 (o mapa foi medido com 1.188
  blocos empilhados: 60 quadros por segundo no computador). No celular ainda
  não foi medido.
- Modo construtor no editor (botão Construtor ou tecla B): o móvel vai por cima
  de qualquer coisa, sem bloqueio; com Altura preenchida, toda peça vai nela
  (como o ":setsh" do Habbo); vazio, no topo do que estiver embaixo.
- Cor dos blocos de construção (arte "recolorable"): 20 cores, no estado do
  móvel (100 + cor × 5 + variante), sem mudar o banco. Vale para vários blocos
  selecionados e fica para os próximos.
- Blocos de construção (bc_*_recolorable) são essenciais grátis e ilimitados,
  como o Builders Club do Habbo.
- Quarto "maquete": Piso e paredes → Planta → Sem paredes, para construir as
  paredes com móveis.

### Movimento, cochilo e celular (18/10/2026)

- Passo no ritmo do Habbo: um ladrilho a cada 500 ms (antes 240 ms); a
  viagem longa pela lista continua 3× mais rápida.
- Cochilo: 5 minutos sem tecla, clique, toque ou passo, o boneco cochila
  (olhos fechados e "z Z z") e todos veem; qualquer movimento acorda. Não
  muda o status.
- Celular: o botão de ação (E) e a barra do dia ficam acima da barra de baixo
  pela altura real dela (antes cobriam o status quando a barra quebrava).

### Quarto até 20 × 20 e mezanino de blocos (18/10/2026)

- Lado máximo do quarto: 20 (LADO_QUARTO no servidor, ESCRITORIO_QUARTO_MAX no
  painel). Plantas novas: Quadrado Gigante (16 × 16), Quadrado Maquete
  (20 × 20) e Largo Gigante (20 × 12).
- Pintura do piso, trechos de parede e planta desenhada passam a ter o lado 20;
  as grades antigas (8 e 12) valem ampliadas ao ler, no servidor
  (ampliarGrade/ampliarParedes/ampliarCeldas) e no painel
  (escritorioPisosDoPerfil/…), sem perder nada.
- Convivência: mezanino montado com blocos de madeira (altura 2), degrau na
  altura 1, poltrona e planta em cima.

### Regras do servidor e do cliente do Habbo (18/10/2026, noite)

Conferidas no código aberto (Arcturus: Room, RoomLayout, PathfinderImpl,
AdjacentTileFinder; Nitro: RoomSpriteCanvas, RoomPlaneParser,
RoomVisualizationSettingsParser, RoomUnitStatusParser, AvatarVisualization) e
reescritas no nosso motor, sem copiar código (decisão do Paulo: opção 1).

- Planta de alturas: "p" chão, "1"–"9" e "A"–"Z" alturas 1 a 35, "v" sem
  piso (`escritorioNivelDoCodigo`, `CELDAS_LIVRES`). Um nível = um bloco =
  32 px (`MAPA_NIVEL_PX`), a mesma unidade dos móveis. A escada é um degrau
  de altura 1 (sem rampa); guarda-corpo onde a queda é de 2 ou mais.
- Caminho: sobe até 1,5 (até 2 para chegar a assento ou cama), desce de
  qualquer altura, diagonal barrada só com os dois lados retos fechados.
  A altura é a do piso mais a do móvel (`mapaAlturaTotal`) e acompanha o
  passo entre ladrilhos.
- Ladrilho vale pelo móvel de maior topo; cama no ladrilho vale sempre.
- Construção: pousa no topo mais alto de todos os ladrilhos ocupados; recusa
  sobre o que não aceita peça, acima de 40, móvel sólido sobre gente e na
  porta; girar confere o mesmo (`escritorioPousoHabbo`).
- Paredes: topo único no quarto, 3,6 blocos (115 px) acima do piso mais
  alto; opções do quarto `sala_espessura_parede`, `sala_espessura_piso`
  (−2 a 1, vale 2^x: 2, 4, 8 ou 16 px) e `sala_altura_parede` (+0 a +15).
- Altura por estado (InteractionMultiHeight): a lista de `customparams` da
  ficha vai no 3º campo de `fisica.json`; hoje só os elevadores
  `newbie_eleblock*` do catálogo têm.
- Sentado ou deitado: base do móvel + altura dele − 1 bloco; no chão (:sit),
  −0,5. Sombra no chão sob o boneco em pé ou andando.
- Animação dos móveis a 24 quadros por segundo.

### Ordem de desenho do Habbo (Nitro) e Wired (18/10/2026)

- Cada móvel é um contêiner sem z-index (`.mapa-movel`) com um canvas por
  grupo de camadas da arte (mesmo z) e a sombra à parte. A profundidade segue
  o renderizador aberto do Habbo (RoomGeometry, RoomSpriteCanvas,
  FurnitureVisualization): −0,70708 por ladrilho em x ou y, −0,00713 por nível
  de altura e, por camada, `(z/−1000 − camada × 0,001) × √½` (`mapaProfundidade`,
  `mapaProfCamada`, `mapaZ`). É assim que a arte do Habbo fatia móveis grandes
  (a mesa executiva tem fatias com z 1000, 2000, 3000) e põe encosto, braço e
  cobertor na frente de quem está no móvel.
- Boneco: profundidade do ladrilho arredondado na altura do piso, −0,01
  (deitado −0,409); o próprio fica 0,001 à frente. Item de parede: no plano
  da parede, meio ladrilho para trás. Paredes do fundo ficam atrás de tudo
  (planos do Habbo); mureta da frente, no plano dela. Tapetes rente ao piso
  têm faixa própria. Efeitos (seleção, luz) vão nas camadas, nunca no
  contêiner (filtro criaria contexto de empilhamento).
- Sombra com a transparência fixa do Nitro (48/255). Camadas de luz (ADD)
  somam com o que está atrás (`mix-blend-mode: plus-lighter`).
- Passagem entre estados (transitionFrom/transitionTo da arte) toca uma vez
  ao trocar de estado, como no `FurnitureAnimatedVisualization`.
- Item de parede: a posição ao longo da parede é livre (o ajuste fino de ¼
  agora aparece no desenho), como no `LegacyWallGeometry`.
- Regulador de luz do Habbo (`roomdimmer` e interruptores, essenciais): no
  próprio quarto abre a Luz do quarto (`sala_luz`); aceso quando há luz.
- Gatilhos e efeitos (Wired) em `vybe-escritorio-gatilhos.js`, com os móveis
  originais (essenciais, categoria Gatilhos). Pilha = itens `wf_*` no mesmo
  ladrilho. Gatilhos: pisar, sair, clicar, estado mudou, dizer palavra,
  entrar no quarto, a cada N segundos (só o navegador de menor id no quarto
  roda). Condições: quem disparou está no móvel; tem gente nos móveis.
  Efeitos: alternar estado, estado aleatório, mensagem, teletransportar.
  Pisar/sair valem ao entrar/deixar o móvel; efeito não dispara "estado
  mudou" (sem laço). Configuração no 7º campo do item
  (`{ m: [[x, y, classe]…], t, s }`), validada em `server/escritorio-mapa.js`
  (só em `wf_*`, até 5 móveis, texto até 100, 1–60 s). No editor: Configurar →
  Escolher móveis no mapa → Pronto.

### Camadas do móvel com o boneco, como no Nitro (18/10/2026)

- A profundidade de cada camada segue o renderizador aberto do Habbo (Nitro,
  `FurnitureVisualization`/`AvatarVisualization`): `(z / −1000 − camada × 0,001) × √½`.
  Quem senta fica em −0,01 (menos 0,00713 por nível de altura do assento) e
  quem deita em −0,409. As camadas abaixo desse valor (encosto virado para o
  fundo, braços da poltrona executiva, cobertor da cama) ficam por cima de quem
  está no móvel (`mapaProfCamada`; desde o motor por camadas, na mesma conta
  de todos os móveis — ver a seção acima).
- Sala de reunião: poltronas executivas a cada dois ladrilhos (largas, lado a
  lado entravam uma na outra), três peças espaçadas na mesa e a cerca do
  patamar sem duas peças no mesmo canto.

### Paredes na frente, giro pelas costas e peça de parede pela ficha (18/10/2026)

O Paulo apontou um armário "de lado na parede" e um piano "pregado" na parede
das janelas no Lounge e pediu a causa, não um remendo. Foram três:

- **Toda parede fica atrás de todo móvel e boneco** (Nitro: `ROOM_DEPTH_OFFSET`
  soma 1000 à profundidade das paredes). Recorte no fundo à direita (ou na
  frente à esquerda) da planta cria um trecho de parede mais à frente do piso
  ao lado dele: o que fica ali aparece pintado por cima da parede. As plantas
  das cenas não têm mais esse recorte (Convivência, Auditório, Academia e
  Lounge); recorte no fundo à esquerda e chanfro na frente não têm o problema.
  O verificador acusa "piso escondido atrás de parede recuada" e "atrás da
  parede … aparece por cima dela".
- **Giro de peça com duas direções:** o número não diz a frente (o armário
  gótico, na direção 0, já fica comprido ao longo da parede da esquerda). O
  verificador lê a frente pela forma (comprida em x olha para +y; em y, para
  +x) e acusa "de lado na parede" quando a ponta encosta e as costas não.
- **Peça de parede pela ficha:** `scripts/habbo-fisica.mjs` grava os
  `wallitemtypes` da furnidata com a marca 16 em `fisica.json`, e
  `mapaEhDeParede` usa essa marca; a forma da arte (profundidade ≤ 0,3) só
  vale para peça fora da ficha. Antes, quadros e escudos de profundidade 1
  iam para o chão.
- Lustres e ervas do acervo: a arte de muitos já vem desenhada no alto
  (ficam na altura 0); os desenhados rente ao chão sobem com altura.
  Meça a base do desenho (sprite acima do ponto do ladrilho) antes de pendurar.

### Escala e paredes/pisos oficiais do Habbo (18/10/2026)

- Zoom só em 0,5×, 1× e 2× (`NIVEIS` em `vybe-escritorio-mapa.js`), com a
  câmera parada em pixel inteiro: escala quebrada borrava a pixel art. O
  quarto abre em 1× quando quase cabe; a roda acumula até trocar de nível.
- Papéis de parede, pisos e paisagens oficiais vêm do `room.nitro` do Nitro
  (repositório j1slc/nitro-assets, autorizado pelo Paulo), em
  `assets/escritorio/habbo/habbo_quarto_planos.{json,png}`. Textura
  `plano:parede:<id>` ou `plano:piso:<id>` (id do Habbo: textura × cor, ex.
  1901 tijolo vermelho, 1401 madeira, 205 carpete vermelho, 405 ladrilho
  vinho); 32 px de textura por aresta de ladrilho, tingida pela cor do plano.
- Cenas aceitam trechos de piso (`texturas` na planta), como a Praça.

### Salas comuns construídas no editor (18/10/2026)

- Camada com o id da zona (`recepcao`, `reuniao`, `auditorio`, `producao`,
  `cafe`, `jogos`, `foco`, `academia`, `lounge`): só quem administra salva
  (`CENAS_COMUNS` em `server/escritorio-mapa.js`), sem inventário e sem planta
  desenhada; até 1500 itens. Migração `2026-10-18-escritorio-cenas-editaveis.sql`
  só amplia as chaves aceitas. Sem camada salva, vale o padrão do código;
  "Restaurar" no editor volta a ele.
- Fundo próprio da sala comum (`fundo` na planta da cena), como o vazio em
  volta dos quartos do Habbo.
- Desempenho medido na demonstração: 600 peças carregam em ~0,5 s (arte em
  cache) e ficam em 60 quadros/s parado e trocando o zoom.
- Método das cenas: bancada (a cena trocada só na página) para montar cada
  conjunto — bar, estar, sofás — e conferir de perto em 2× antes de compor a
  sala; uma coleção de móveis por sala.

### Quarto até 24 × 24 e vitrine do personagem (21/10/2026)

- Lado máximo do quarto: 24 (LADO_QUARTO no servidor, ESCRITORIO_QUARTO_MAX no
  painel; decisão do Paulo: "até 4x maior o maior de hoje"). Tamanhos novos em
  cada formato: Gigante, Colossal e Mansão (24 × 24 = 576 ladrilhos, quatro
  vezes o Enorme). As grades guardadas com lado 20 valem ampliadas ao ler, como
  as de 8 e 12; nada se perde.
- `scripts/quartos-plantas.mjs` só acrescenta plantas: as que já estão no
  catálogo (algumas ajustadas à mão, com quartos montados) ficam como estão.
  Formatos especiais ganham a Mansão dobrando a planta Enorme ladrilho a
  ladrilho, com a escada de um degrau só.
- Vitrine do personagem (`escritorioVitrineHtml`/`escritorioMontarVitrines`):
  um pedaço de 3 × 3 do quarto da pessoa pelo próprio motor do mapa — piso e
  parede dela, até dois móveis dela dos lados (nunca atrás nem na frente), o
  boneco no meio acenando ao abrir. É o único desenho do cartão do jogador:
  entrada, Meu espaço, ficha e o fundo do provador (no mesmo tamanho do
  boneco). Planta `vitrine` só no painel; não vai ao servidor.
