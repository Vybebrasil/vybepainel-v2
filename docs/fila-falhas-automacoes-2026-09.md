# Fila de falhas de encaminhamento — 29/09/2026

A tela Automações agora lista falhas do encaminhamento por status de Produção,
com atividade, todos os clientes, etapa, motivo seguro e número de tentativas.
Usa o histórico existente (`vybe_conteudo_eventos`, tipo `automacao_falha`),
sem nova tabela, endpoint ou migração. O evento `de` identifica a ocorrência
original de status; `para` guarda um motivo classificado, sem mensagens cruas
contendo SQL, URLs ou credenciais.

O registro da falha acontece depois do rollback, para sobreviver à tentativa.
Se o próprio banco impedir esse registro, a troca de status informa explicitamente
que não conseguiu incluir a falha na fila. Não há garantia de registrar uma queda
total do banco. Falhas anteriores à implantação, captação, cron e Solicitações
não são reconstruídas ou incluídas nesta etapa.

Uma linha reúne as tentativas do mesmo evento. A resolução é lida da execução
confirmada pelo motor, com sua data. Não executar regra alguma não resolve uma
falha. Eventos substituídos por outra etapa ou incompatíveis com o status atual
não oferecem retomada; peças removidas não oferecem ações. A retomada reutiliza
`retomar_encaminhamento` e as mesmas proteções contra duplicação/concorrência.
A consulta exige autenticação, como o restante da tela. Até 100 ocorrências são
mostradas, com pendentes primeiro e total explícito.

## Verificação

- Suíte completa: 215 testes aprovados; mais três regressões de interface aprovadas.
- `npm run check` foi iniciado, mas interrompido após sobrecarregar o ambiente local.
  As mesmas etapas foram concluídas com `node scripts/check.mjs`,
  `node --test --test-concurrency=2 tests/*.test.mjs` e `npm run build`.
- PostgreSQL/PGlite: falha sobrevive ao rollback, tentativas ficam agrupadas,
  clientes não duplicam ocorrências, ausência de regra não anuncia resolução,
  retomada bem-sucedida resolve, repetição não duplica, evento antigo e peça
  removida não permitem retomada. Falha de consulta não vira lista vazia.
- Interface: resposta antiga não substitui a mais recente, escape de HTML e
  retomada apenas em pendentes. Consulta sem sessão retorna 401.
- Navegador local com respostas controladas: fila, retomada de item fora do
  conjunto carregado, atualização para resolvida, erro de consulta, desktop e
  celular sem overflow. A demonstração não comprova escrita: persistência foi
  validada nos testes PostgreSQL isolados. Sem gravações de teste em produção.

Esta mudança permanece local até publicação solicitada e checklist de deploy.

## Ampliação para Demandas — 30/09/2026 (local)

A troca de status de Demandas passa pelo mesmo motor transacional de Produção.
Orçamento, impressão, devolução de alterações e conclusão usam as regras existentes.
Falhas de status de ambos os quadros aparecem na mesma fila; diagnóstico e retomada
aceitam Demandas e preservam a ocorrência original. Não há migração nem reprocessamento
retroativo. Captação permanece fora desta ampliação.

Verificação: `npm run check` aprovado com 221 testes, incluindo três regressões de
Demandas em PGlite (regras reais, rollback, fila, retomada sem duplicação e recusa de
eventos superados/atividades removidas). Nenhuma escrita de teste em produção.

Na gaveta, a regra compartilhada de materiais deixou de impor `overflow:hidden` à
lateral. Rolagem vertical e contenção ficam na regra original da gaveta; o documento
fica bloqueado apenas enquanto ela existir no DOM. Conferidos localmente conteúdo e
solicitação, desktop e 390 px, rolagem da lateral, fundo estável e liberação ao fechar.
Build e `git diff --check` aprovados após a correção de CSS; console sem erros.
