# Escritório integrado ao Vybe OS

## Escopo implementado nesta revisão

O módulo Escritório usa sessão individual da Vybe. Seis espaços comuns, avatar
em SVG, mesa por pessoa, prévia de aparência, chat por sala, presença e convites
por proximidade compõem a primeira versão. O catálogo inicial permite roupa,
pele, cabelo, cor da mesa e um objeto decorativo. Não é um editor livre de pisos,
paredes e móveis como o SoWork.

A movimentação é por clique ou setas. Aproximar-se permite enviar convite à
conversa da sala; só Disponível recebe convites. Entrar exige ação explícita e
começa com câmera/microfone desligados. A conversa é compartilhada com quem entra
na mesma sala; não é áudio espacial privado por distância. Foco não oferece chamada.

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
