# Entrega, anexos e passagem de bastão — 28/09/2026

## Correções

- A passagem de bastão exige confirmação da escrita. Falhas mantêm o formulário;
  envios simultâneos pelo botão são bloqueados. A resposta não fecha outro modal.
- A leitura dos detalhes mantém o último link de entrega e a última passagem,
  além das 12 notas recentes (até 14 atualizações, sem duplicação).
- Comentário e histórico são gravados na mesma transação. O registro de anexo
  e seu histórico também são atômicos.
- Após upload, a atualização reutiliza a proteção de identidade da gaveta e
  preserva rascunhos. Falha de releitura não é apresentada como falha de upload.

## Verificação

- `npm run check`: sintaxe, ordem global, 200 testes e build aprovados.
- `git diff --check`: aprovado.
- Cinco regressões em `tests/entregas-bastao.test.mjs`: rollback de comentário
  e anexo no PGlite, leitura após 15 novas notas, recusa de bastão, envio
  simultâneo e falha de releitura após confirmação.
- Chrome na demonstração local: recusa de gravação mantém os campos e libera
  nova tentativa; nenhum erro de JavaScript observado.

## Limites

Não foram feitas gravações nem uploads em produção. O teste de anexos valida
metadados no PostgreSQL isolado; não certifica o fluxo externo do Drive.
Upload no Drive e transação PostgreSQL não são uma operação atômica: falha de
registro após upload pode deixar arquivo no Drive sem vínculo no painel.
A passagem manual registra contexto, sem atribuir automaticamente outra pessoa.
Sua nota e a eventual mudança de status são operações separadas.
Esta revisão trata esses fluxos; não constitui revisão visual geral.

Alterações preparadas localmente, sem publicação nesta etapa.
