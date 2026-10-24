# Ponte OS → Hub: preparação local de homologação

Escopo operacional amplo aprovado preservado. Não altera contas, grupos,
vínculos, permissões, banco ou Production. Bot Windows intacto e simulação
obrigatória. Este documento prepara ações futuras; não as autoriza nem as executa.

## Estado comprovado em 24/10/2026

- Hub: deployment `2Jr4i5YHaAXomZGC5sVecuiyfyCa`, Preview READY, commit
  `7ea46dc1b48dda4bc6faf7443ca8074a59988c43`, branch `codex/vybe-ai-metricas`.
- Destino fixado: `https://vybehub-dnhk8djpc-vybe-hub.vercel.app`.
- Teste autenticado na rota real retornou HTTP 200: uma fixture esperada,
  origem `homologacao_fixture` e marca DADOS FICTÍCIOS DE HOMOLOGAÇÃO.
- Token dedicado reinserido pelo operador no Hub a partir do armazenamento
  protegido Windows; mesmo token preparado anteriormente para o OS. Nenhum
  valor secreto pertence a este documento ou ao repositório.
- As quatro Config do OS foram salvas somente em Preview Branches →
  `feature/vybe-ai-readonly-integration`: URL e origem iguais ao destino acima,
  `VYBE_AI_HUB_CLIENTES={"900000201":"cliente-ficticio-ai"}` e
  `VYBE_AI_HUB_ATIVO=1`. Os dois Secrets existentes foram preservados.
- OS local parte de `f38dae69c53b83023aa569548f63ae94e45da53a`. Estas
  configurações só entram em uma nova Function após publicação autorizada.
- Não houve publicação do OS, alteração de bancos ou reinício do bot nesta etapa.

## Automation Bypass e autenticação da aplicação

O cliente OS mantém `Authorization: Bearer` com `VYBE_OS_METRICAS_TOKEN`.
Somente em `VERCEL_ENV=preview` e na branch
`feature/vybe-ai-readonly-integration`, exige também:

- `VYBE_AI_HUB_VERCEL_BYPASS_SECRET`: Secret independente emitido para o Hub.
- `VYBE_AI_HUB_VERCEL_BYPASS_ORIGIN`: Config com a origem HTTPS exata do
  deployment Hub conferido (sem barra final, caminho, parâmetros ou credenciais).

O bypass vai apenas no header `x-vercel-protection-bypass`, nunca em URL,
cookie, resposta ou log. A origem precisa ser igual à URL configurada. Ausência,
origem divergente ou segredo igual ao da ponte nega antes de banco/HTTP.
Exige os 32 caracteres aceitos pelo formulário oficial da Vercel; o token da
aplicação permanece independente e tem seu contrato anterior preservado.
Redirecionamentos permanecem proibidos. Fora dessa Preview, não encaminha bypass
e preserva o comportamento anterior, inclusive erros originais de transporte.

**Limite do provedor:** Automation Bypass é por projeto e vale em todos os seus
deployments; não é uma credencial nativamente limitada à branch. A restrição do
cliente e das variáveis não reduz a capacidade intrínseca do segredo. Não o
confundir com o bypass do próprio projeto OS. Não selecionar outro segredo como
`VERCEL_AUTOMATION_BYPASS_SECRET` padrão nem modificar a seleção existente.

Depois de autorização específica, criar um segredo adicional nomeado para o
piloto em Hub / Settings / Deployment Protection / Protection Bypass for
Automation. Guardar o original em gerenciador protegido pelo usuário, sem chat,
arquivos de texto, argumentos ou logs. Não desabilitar proteção e não gerar link
de compartilhamento. Se a UI exigir alterar configuração geral ou o segredo
padrão, parar antes de salvar.

Se a capacidade por projeto não for aceitável, a alternativa oficial é Trusted
Sources com OIDC, regra somente `vybepainel-v2:preview → vybehub:preview`, sem
autorizar Production. Exige outra preparação de código/configuração; não foi
implementada nem habilitada nesta etapa. A regra é de ambiente, não de branch.

Fontes oficiais:
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources

## Segredo dedicado da ponte

Não usar Reveal Value, não exportar Secrets e não reutilizar token do bot,
SESSAO_SECRET, PORTAL_CHAVE ou bypass da Vercel.

1. O operador procura manualmente o original no armazenamento protegido usado
   ao configurá-lo no Hub. Não enviar o valor ao assistente.
2. Se disponível, inserir diretamente no campo Secret do OS, somente Preview
   Branches → `feature/vybe-ai-readonly-integration`.
3. Se não disponível, solicitar autorização específica para substituição
   coordenada apenas das duas Previews. Gerar um novo valor aleatório de 64
   caracteres alfanuméricos no gerenciador protegido e inserir o mesmo valor
   como `VYBE_OS_METRICAS_TOKEN` no Hub e OS, em suas branches exclusivas.
4. Conferir escopos antes/depois sem exibir valores. Não editar credenciais de
   bancos nem de Production. Publicar primeiro Hub, depois OS. Validar o segredo
   pela chamada real autorizada, sem recriar diagnóstico público.

Alterar variável não muda snapshots de Functions antigas. Em substituição,
redeploy do Hub com o mesmo código aprovado é necessário; só então fixar a nova
origem no OS. Deployments antigos são imutáveis e sua retirada exige escopo
próprio; não afirmar que trocar a variável revogou o token em todos eles.

## Clientes: evidência READ ONLY e pendência de dados fictícios

Projetos e branches conferidos na interface do Neon, sem ler conexões:

| Ambiente | Projeto / branch Neon | Banco |
|---|---|---|
| OS | `blue-pine-55207839` / `br-proud-shadow-b66odlog` | `neondb` |
| Hub | `broad-salad-39028444` / `br-delicate-unit-b673qozr` | `neondb` |

As consultas usaram `BEGIN TRANSACTION READ ONLY`, conferiram
`current_setting('transaction_read_only') = 'on'` e terminaram com `ROLLBACK`.
Somente IDs, nomes, slug e estado dos clientes fictícios foram selecionados.

| Origem | ID | Nome exato | Slug | Estado |
|---|---|---|---|---|
| OS | `900000201` | `Cliente Ficticio AI` | não se aplica | ativo |
| Hub | `1` | `Cliente Ficticio AI` | `cliente-ficticio-ai` | active |
| Hub | `2` | `Cliente Ficticio Inativo` | `cliente-ficticio-inativo` | inactive |

O operador autorizou separadamente a correção do nome fictício do OS; foi
concluída em transação, com uma linha alterada, demais campos e vínculos
preservados. A conferência atual READ ONLY confirmou os dois clientes ativos,
mesmo nome byte a byte, com `transaction_read_only=on` e ROLLBACK nos dois lados.
O mapa conferido é `{"900000201":"cliente-ficticio-ai"}`. Não mapear o inativo.
Não normalizar, aproximar ou ignorar a comparação exata.

## Isolamento de saída do OS

`previewVybeAiIsolada` identifica ambiente e branch exatamente, independentemente
da flag opcional: SMTP é bloqueado antes de ler credenciais, criar ou reutilizar
transporte. `emailConfigurado()` retorna falso nessa Preview. Os caminhos de
planejamento reutilizam esse módulo; não há outro transporte SMTP no runtime.

O bloqueio existente de Drive/Google também passa a reconhecer essa Preview
mesmo se a flag for omitida. Calendar usa `tokenGoogle`, que bloqueia antes de
autenticar ou aproveitar cache. RealtimeKit bloqueia antes de transação/banco e
antes de HTTP, evitando criar reuniões/participantes com credenciais herdadas.
Production e outras branches preservam a lógica anterior. A ponte é a exceção
autorizada de leitura e continua exigindo autenticação e audiência no OS e
token/cliente/fingerprint/fixtures no Hub.

Este isolamento não é um firewall de saída geral: o frontend ainda pode carregar
assets públicos e o funcionamento do Escritório/Worker não foi testado ao vivo.
O piloto é da Vybe AI em simulação. Não ligar integrações reais para testar.

## Ordem futura, dependente de autorização

1. Revisar o diff novo, testes e escopos. A correção do nome, a substituição do
   token e a criação do bypass foram concluídas em etapas autorizadas anteriores.
2. Preservar os dois Secrets exclusivos do OS, o bypass adicional do Hub, a
   proteção e o segredo padrão. Somente as quatro Config aprovadas foram criadas.
3. No Hub, preservar sete configurações exclusivas e fingerprints já validados.
   Se reutilizar o token original e não mudar código, o Hub READY atual serve;
   se substituir o token, redeploy somente da branch Hub e confirmar READY.
4. Conferir a correspondência exata de clientes e preparar no OS, somente na
   branch autorizada: URL do Hub READY, ATIVO=1, mapa conferido, token da ponte,
   bypass separado e origem fixada. Preservar DATABASE_URL, VYBE_HOMOLOGACAO=1,
   sessão, vínculo, autenticação e grupos. Parar antes de Save se algo não confere.
5. Preparar novo commit `[preview]` do OS contendo os ajustes revisados. O SHA
   antigo `f38dae69` sozinho não contém estes bloqueios/cabeçalhos. Somente após
   nova autorização, conferir avanço normal, push e READY na branch do OS.
6. Validar bloqueio de requisições sem autenticação e a leitura das fixtures
   com contexto legítimo do conector, sem fabricar identidades/participantes,
   mantendo SIMULACAO=true. Não reiniciar ou substituir o bot sem autorização.
7. Em falha, desligar a ponte apenas na branch e republicar a Preview se
   autorizado; não trocar banco, relaxar verificações ou usar Production.

A ponte do Hub foi validada com o token atual. A validação publicada do fluxo
completo OS → Hub ainda depende de autorização para publicar este novo código
na branch OS e de teste com contexto legítimo, mantendo SIMULACAO=true.