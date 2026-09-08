# Verificação e promoção

## Antes de publicar

- Executar `npm ci`, `npm run check` e `git diff --check`.
- Publicar a branch de revisão e aguardar CI e preview da Vercel.
- Usar banco e credenciais de homologação nos testes de escrita.
- Confirmar autenticação Bearer no consumidor Nexus e segredo no webhook de status.
- Registrar commit e deployment anterior e confirmar a recuperação do banco.

## Interface

- Login, seleção de operador, entrada nas seis estações e logout.
- Nenhuma tarefa antiga ou sucesso de sincronização aparece antes do login.
- Gestor mostra a peça fictícia; filtros e calendário abrem.
- Navegação nos dias 29, 30 e 31 não pula meses; conferir mudança de ano.
- Conferir Performance, Conta & Equipe, Cadastros e telas sem registros.
- Console e layout em desktop e celular.
- Conferir o artefato com `npm run build` e `VYBE_DEV_BUILD=1 npm run dev`.

## APIs e autenticação em homologação

- Sem sessão: conteúdo, conta, espelho e indicadores retornam 401.
- Webhook de status sem segredo retorna 401; challenge não grava.
- Login válido funciona e senha incorreta é recusada.
- Bloqueio de pessoa impede sua próxima requisição com cookie já existente.
- Retirada de administração impede APIs administrativas com o cookie antigo.
- Troca da própria senha renova o navegador atual e invalida cookies anteriores.
- Cookie malformado não concede acesso nem causa erro de decodificação.
- Backend, arquivos de ambiente, dependências e testes não são arquivos públicos.

## Gravações — somente em homologação

- Criar conteúdo, alterar status, responsáveis e datas; conferir o banco.
- Falha no meio da troca de responsáveis preserva vínculos e histórico anteriores.
- Unificação de status atualiza peças, subitens e catálogo juntos; falha reverte tudo.
- Subitem local resolve seu ID remoto depois da criação da réplica.
- Falha Monday preserva a escrita Vybe e deixa a pendência visível.
- Interrupção do worker é recuperada; criações incertas não são repetidas sozinhas.
- Alterações da mesma peça respeitam a ordem na réplica.
- Remover a última peça deixa a tela vazia, sem recuperar o cache antigo.
- Verificar comentários, anexos, restauração e automações com um item descartável.

## Regras atuais

Prazo de Ouro e prazo posterior à veiculação geram avisos de planejamento,
não bloqueios gerais. O checklist antigo exigia recusas já removidas do produto.
Esta revisão preserva essa decisão. Validar os avisos e a persistência.
Regras específicas de equipe/formato devem seguir o comportamento aprovado,
sem reintroduzir decisões antigas apenas por constarem em documentos.

## Banco e promoção

São adicionadas, de forma idempotente, `sessao_versao` em `vybe_pessoas` e
`claim_token` na fila. Não há exclusão de tabelas operacionais. Confirmar que o
papel do banco pode executar essas adições antes da promoção.

Após promover: testar login, recusas sem autenticação, HTML sem dados antigos,
assets com hash e saúde da fila. Testes locais não validam credenciais externas.

Rollback: reverter a revisão e publicar novamente, sem remover as colunas novas.
A versão anterior reintroduz as falhas corrigidas; preferir corrigir a configuração
ou aplicar um hotfix mantendo as proteções.
