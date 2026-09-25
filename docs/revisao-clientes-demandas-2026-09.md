# Clientes em Gestor e Demandas — 25/09/2026

Revisão localizada dos filtros por cliente e das entradas de cadastro.

## Correções

- Nomes com apóstrofos e aspas passam como atributos de dados nos botões de
  Demandas e do calendário do Gestor, sem compor código JavaScript inline.
- Cadastro por grupo e “Nova demanda” preservam o cliente explicitamente
  selecionado em Demandas. Uma busca parcial não vira cliente automaticamente.
- A lista de clientes do cadastro inclui vínculos secundários e clientes que
  aparecem apenas em solicitações, sem duplicar nomes.

## Verificação

- `npm run check`: 154 testes aprovados, sintaxe e build aprovados.
- `git diff --check`: aprovado.
- Chrome com demonstração local em 1440 × 1000 e 390 × 844: busca sem resultado,
  limpar filtros, seleção de cliente com aspas, cadastro em grupo vazio,
  preservação de cliente e grupo, layout sem overflow horizontal e console sem
  erros JavaScript nos fluxos exercitados.
- Respostas fictícias interceptadas apenas no navegador de teste: uma atividade
  com dois clientes permanece uma atividade no total; cliente secundário pode
  filtrar Demandas e calendário do Gestor.
- Regressões novas cobrem nomes com aspas, contexto explícito versus busca
  parcial, ausência de vazamento entre quadros e opções com múltiplos vínculos.

Não houve escrita em produção, alteração de schema ou publicação nesta etapa.
A abertura do cadastro foi verificada; a demonstração bloqueia gravações e não
comprova persistência desse formulário. Não constitui revisão integral dos
módulos nem validação de todas as combinações de filtros.
