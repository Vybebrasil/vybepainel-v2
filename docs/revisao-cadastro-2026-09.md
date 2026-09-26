# Revisão do envio de cadastros — 26/09/2026

Escopo: formulário compartilhado de conteúdo e demanda, recuperação de falha
parcial do lote e recarga das listas depois de criar. Não é uma auditoria completa
de todas as telas ou permissões.

## Problemas corrigidos

- A recuperação de falha usava o título como identidade. Dois cartões com o mesmo
  título, um criado e outro recusado, voltavam juntos para a lista e a repetição
  duplicava o primeiro. Agora só os objetos dos cartões recusados permanecem,
  com suas datas, briefing e arquivos.
- Desabilitar o botão não impedia outro envio pelo atalho do teclado. O envio tem
  trava única, impede navegação/fechamento/reabertura do formulário durante a
  operação e libera a interface no `finally`, inclusive quando há erro.
- `refreshData` não devolvia a promessa de atualização e só considerava a tela
  aberta. Agora aguarda as leituras e inclui Demandas quando esse foi o quadro
  cadastrado a partir de outra tela. Não esvazia as listas antes da resposta.

## Evidências

- Cinco regressões em `tests/cadastro-envio.test.mjs`: títulos iguais com falha
  parcial e nova tentativa; envio simultâneo; liberação após exceção; recarga do
  quadro criado; preservação dos dados existentes quando a recarga falha.
- `npm run check`: 166 testes aprovados, incluindo os testes existentes de
  PostgreSQL isolado/PGlite, sintaxe, escopo global e build.
- Chrome na demonstração local: cadastro pelo grupo A Fazer, cliente e tipo de
  demanda, título, prazo e conclusão distintos, revisão do grupo e envio recusado
  pela demo. Com a requisição local retardada no navegador, Ctrl+Enter e Escape
  durante o envio mantiveram uma única requisição e o formulário aberto.
- Após a recusa, rascunho preservado, formulário liberado e sem erros de JavaScript.
  Screenshots conferidos em 1440×1000 e 390×844; nenhuma alteração de CSS.
- `git diff --check` aprovado.

## Limites

A demo recusa gravações: a inspeção visual não comprova persistência real. As
regressões de envio usam respostas controladas; escrita transacional continua
coberta pelos testes existentes de banco isolado. Não foram criados dados reais,
alterados schema/segredos ou enviados arquivos ao Drive. A trava evita envios
concorrentes neste formulário; não oferece idempotência entre abas ou quando a
conexão cai depois de o servidor confirmar uma gravação.
