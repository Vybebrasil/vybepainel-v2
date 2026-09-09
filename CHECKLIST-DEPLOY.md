# Verificação e promoção — operação independente

## Antes de publicar

- Executar `npm ci`, `npm run check` e `git diff --check`.
- Aguardar CI e preview da Vercel no commit exato da revisão.
- Testes de escrita usam banco Neon isolado e `VYBE_HOMOLOGACAO=1`.
- Confirmar `DATABASE_URL`, `SESSAO_SECRET` ou `MIRROR_ADMIN_KEY`, credenciais do
  Drive e `CRON_SECRET` em Production. Não promover os overrides de homologação.
- Registrar commit e deployment anterior e conferir recuperação do banco.

## Fluxos

- Login, logout, bloqueio de pessoa e retirada de administração com cookie existente.
- Leitura de Produção e Demandas; uma base vazia não recupera dados antigos.
- Criar conteúdo, alterar título, status, datas e responsáveis e reler do banco.
- Criar e editar subitem em Demandas com ID `vybe-subitem:`.
- Novo Agendamento usa `/api/conteudo`; histórico usa `/api/painel?area=historico`.
- Arquivos disponíveis abrem pelo Drive; registros já ausentes são preservados.
- Navegação no fim do mês e virada de ano; console e layout desktop/celular.
- Conferir Performance, Conta & Equipe, Cadastros e as seis estações.

## Monday encerrado

- `/api/monday`, `/api/monday-events`, `/api/webhook-status` e
  `/api/operational-mirror` retornam HTTP 410, inclusive para challenge.
- Preferências antigas do navegador não reativam fallback.
- Gravações nativas não aumentam a fila histórica; reprocessamento retorna 410.
- Cron mantém `/api/mirror-reconcile`, mas executa apenas automações, prioridades
  e snapshots no banco Vybe. Não é necessário configurar webhooks no Monday.
- Nexus permanece fora do escopo.

## Promoção e recuperação

Após promover: conferir commit, HTML, assets, login, recusas sem sessão e HTTP
410 nos endpoints encerrados. Não executar testes de escrita em produção.

`HOMOLOGACAO.md` registra exatamente o que foi verificado. Não tratar itens desta
lista como aprovados sem evidência. Prazo de Ouro continua sendo aviso, conforme
regra atual do produto.

As colunas novas são compatíveis. Não remover dados históricos nem filas durante
rollback. Versões antigas podem reativar a integração e falhas de acesso; preferir
hotfix que mantenha o encerramento e as proteções.
