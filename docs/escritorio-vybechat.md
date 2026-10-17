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
- Sala da música (`vybe-escritorio-musica.js`): a Pista do Lounge tem o bot de
  música do VybeChat. A fila (até 50 links de vídeo/playlist do YouTube) e o
  ponto em que a música está ficam no Worker (`music:*`, guardados no storage da
  sala); cada navegador toca o próprio player do YouTube só enquanto a pessoa
  está na Pista. Mexer na fila exige estar no Lounge. Volume é por pessoa.
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

O editor existente distingue loja e inventário. Mesa, cadeira, computador básico
e cacto são gratuitos; cada unidade extra custa 25 moedas. A compra bloqueia a
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

Migração não aplicada a produção. Persistência foi verificada com PGlite isolado. A demo
simula somente o estado visual em memória e não comprova banco remoto, presença
ou mídia. A ativação depende de revisar/aplicar a migração e verificar o preview
antes da promoção.

Validação local: `npm run check` passou com 383 testes; as regressões adicionais
verificaram a preservação do inventário ao recomeçar a decoração e todos os modelos
iniciais nas seis plantas. Build e `git diff --check` passaram. Fluxo de criação,
saldo, inventário e compra simulada foram conferidos no navegador em desktop e
390×844; sem erros de console nesse fluxo. A compra demonstrativa consumiu 25 de
50 moedas apenas em memória. A faixa da demo intercepta o centro de alguns
botões da navegação móvel; a conferência usou a parte descoberta dos controles.
Checks do commit final devem ser confirmados no PR antes de promover.
