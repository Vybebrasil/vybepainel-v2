# Troca de grupos e responsáveis — 28/09/2026

## Correções

- Mover atividade e registrar histórico de grupo agora acontecem na mesma
  instrução PostgreSQL. O registro usa a etapa anterior lida sob bloqueio e o
  título atual do destino. Destino inexistente ou de outro quadro não grava.
- Responsáveis continuam usando a transação existente. Corpo sem uma lista
  explícita é recusado; somente `[]` representa remoção de todos.
- Editor individual e lote compartilham a mesma gravação de responsáveis.
  Os dois gravadores usam apenas a API nativa, sem fallback para Monday.
- Há bloqueio de envio simultâneo por atividade e tipo de alteração nesta página.
- Após confirmação, os editores e o lote reutilizam `renderOutboundItemPatch`
  para atualizar tabelas, calendários, contadores e visões operacionais, mantendo
  os critérios de filtro existentes. O cache de produção é atualizado.
- Releitura do detalhe preserva os campos de comentário e link ainda não enviados
  e verifica se a mesma gaveta continua aberta. Falha de releitura após salvar
  recebe aviso de atualização, sem alegar falha na gravação.

## Evidências

`npm run check` aprovado: 190 testes, sintaxe/escopo global e build.
`git diff --check` aprovado.

Regressões PostgreSQL/PGlite cobrem rollback de grupo e histórico, com e sem o
catálogo de grupos, preservação de clientes e responsáveis, múltiplos responsáveis,
deduplicação, remoção explícita, rejeição de IDs inválidos e pessoas inativas.
Os testes existentes de responsáveis também cobrem rollback após falha de inserção.

Regressões da interface cobrem erros, rascunhos, resposta atrasada, envio repetido,
uso do título retornado pelo servidor e falhas parciais no lote. O handler recusa
ambas as operações sem sessão com HTTP 401. As permissões vigentes de integrantes
não foram alteradas.

Chrome na demonstração local, 1440×1000 e 390×844: os seletores abrem, as operações
chegam a `/api/conteudo`, a recusa de escrita da demo preserva dados e rascunho e
não há erros JavaScript não tratados. Screenshots foram inspecionadas. A escrita
persistida foi validada no PGlite, não na demonstração nem em produção.

## Limites

O comentário adicional de disciplina continua separado do histórico transacional
de responsáveis; falha nele não desfaz uma atribuição salva. O editor individual
informa essa diferença. O bloqueio de envio é local à página, não resolve edições
conflitantes entre abas ou usuários. Esta revisão não altera schema, regras de
filtro, permissões de papéis, automações ou a aparência global.

Publicação não faz parte desta etapa; requer solicitação e o fluxo de preview/CI.
