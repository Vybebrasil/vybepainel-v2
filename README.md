# Vybe OS — Painel de Produção

Sistema interno de produção, demandas, clientes, calendário e equipe. O banco
PostgreSQL da Vybe (Neon) é a autoridade; Monday recebe uma cópia de contingência,
e Google Drive armazena arquivos. Atualizações periódicas consultam a Vybe mesmo
quando o Monday está indisponível.

## Desenvolvimento

Requer Node.js 22 ou superior. Execute `npm ci` e `npm run dev`; abra
`http://127.0.0.1:4321`, escolha Operador e use `demo-local`.
O padrão é uma base fictícia, sem acesso à produção. Gravações operacionais são
bloqueadas na demonstração; os testes de PostgreSQL em memória verificam escrita.

`VYBE_DEV_UPSTREAM` aponta explicitamente o proxy para homologação. Cookies de
sessão são encaminhados nos dois sentidos. O proxy é somente leitura, exceto login
e logout. `VYBE_DEV_ALLOW_WRITES=1` habilita escrita explicitamente; nunca use essa
opção com produção para testes. Essas variáveis pertencem ao processo; o servidor
de demonstração não carrega arquivos `.env` automaticamente.

## Verificação e build

`npm run check` verifica sintaxe, escopo global, testes Node e build. Os testes de
integração usam PostgreSQL compilado para WASM (PGlite), em memória e sem rede,
para verificar rollback, vínculos, catálogo e recuperação da fila.

`npm run build` produz `dist/`. A Vercel executa `npm run check` antes da publicação.
Somente `dist/` é servido estaticamente; `api/` mantém as funções de servidor.
Estilos e scripts têm nomes com hash. O build preserva a ordem e os nomes globais usados
pelos handlers HTML; Chart.js carrega apenas quando Performance precisa dele.

Para conferir o artefato local: `VYBE_DEV_BUILD=1 npm run dev` após o build.
O GitHub Actions executa a mesma verificação em push e pull request.
Consulte [CHECKLIST-DEPLOY.md](CHECKLIST-DEPLOY.md) antes de promover.

## Organização

| Caminho | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da interface, sem tarefas capturadas |
| `vybe-styles.css` | Estilos |
| `vybe-stations.js` | Navegação das estações e temporizadores |
| `vybe-*.js` | Módulos do navegador, em ordem explícita e escopo compartilhado |
| `api/` | Endpoints da Vercel |
| `server/` | Operações transacionais e autenticação de webhooks |
| `vybe_sessao.js`, `vybe_acesso.js` | Credenciais, sessão e autorização |
| `vybe_replica_queue.js` | Intenções duráveis e recuperação da réplica |
| `scripts/`, `tests/` | Ferramentas e regressões |

Os módulos extensos do frontend ainda devem ser separados incrementalmente,
junto com testes das telas afetadas. Esta revisão não reescreve regras de negócio.

## Credenciais e compatibilidade

- `DATABASE_URL`: banco do ambiente correspondente.
- `SESSAO_SECRET`: assinatura da sessão; por compatibilidade, usa
  `MIRROR_ADMIN_KEY` se ausente. Prefira segredo dedicado.
- `MIRROR_ADMIN_KEY`: chamadas de serviço; nunca publicar no navegador.
- `MIRROR_WEBHOOK_SECRET`: autenticação dos dois webhooks Monday.
- `CRON_SECRET`: autorização do ciclo diário.
- `MONDAY_TOKEN`: integração Monday. Drive mantém suas variáveis existentes.
- `VYBE_HOMOLOGACAO=1`: bloqueia chamadas externas de Monday e Drive no servidor.
  Usar somente no preview isolado; pendências de réplica desse banco são de teste
  e nunca devem ser processadas contra as integrações reais.

Sessões são verificadas contra a pessoa atual em cada requisição. Bloqueio e
mudança de papel valem no próximo acesso à API. Trocar a própria senha renova o
cookie atual e invalida cookies anteriores.

O consumidor Nexus deve chamar os indicadores do seu servidor com
`Authorization: Bearer <MIRROR_ADMIN_KEY>`. Os webhooks `/api/monday-events` e
`/api/webhook-status` exigem `MIRROR_WEBHOOK_SECRET` no Bearer ou em `?key=...`.
O challenge permanece público e não grava. Configure os consumidores antes de
promover: as chamadas antigas sem credencial passarão a retornar 401.

## Recuperação da réplica

A intenção é persistida antes de chamar Monday. Operações da mesma referência
mantêm a ordem. O worker recupera posse abandonada após dez minutos. Criações e
comentários com resultado incerto exigem conferência para evitar duplicações.

O ciclo diário mantém o agendamento existente e processa até 100 operações em
um orçamento de 40 segundos. Administradores também podem consultar e processar
a fila em **Conta & Equipe → Manutenção** ou em `/api/dominio?action=replica`.
Só autorize repetir uma criação depois de conferir que ela não existe na origem.
Se já existir, a vinculação exige manutenção técnica; não crie uma segunda cópia.

As novas colunas `sessao_versao` e `claim_token` são adicionadas idempotentemente.
Rollback de código não exige removê-las; versões anteriores reintroduzem as
falhas de acesso. Prefira hotfix que preserve as proteções.

Referências: [configuração da Vercel](https://vercel.com/docs/project-configuration)
e [duração das funções](https://vercel.com/docs/functions/configuring-functions/duration).
