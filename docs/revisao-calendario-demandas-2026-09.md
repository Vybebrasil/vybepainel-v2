# Calendário de Demandas — revisão de 26/09/2026

O calendário de Demandas passava pelos filtros do Gestor antes de aplicar os
filtros da própria aba. Equipe, origem e exclusão do feed podiam esconder pedidos
sem um filtro correspondente visível. A lista “mais neste dia” voltava à seleção
geral, usando inclusive outro modo de data.

## Correções

- O recorte de solicitações em `managerCalendarItems` reutiliza
  `filtrarDemandasBase` e `getDemandaDateIso`, como as tabelas. Clientes secundários
  são respeitados e uma atividade continua contando uma única vez.
- A abertura do dia recebe o contexto de Demandas e usa o mesmo recorte.
- Cabeçalho e contador consideram as datas visíveis na grade, incluindo dias de
  meses adjacentes que fazem parte dela.
- O popover do dia fecha ao redimensionar a janela. A altura e a rolagem da lista
  foram ajustadas para não cortar atividades no limite genérico dos menus.

## Verificação

- Três regressões em `tests/calendario-demandas.test.mjs`: filtros próprios e
  cliente secundário, alternância Prazo/Conclusão, contagem por período e lista do
  dia com o mesmo recorte.
- `npm run check`: 169 testes, sintaxe, escopo global e build aprovados.
- Chrome na demo local, 1440×1000 e 390×844: sete solicitações fictícias somente
  na memória do navegador; seis com o status escolhido, todas com um cliente
  secundário. Filtros conflitantes do Gestor foram mantidos para reproduzir o bug.
  Contador e lista do dia exibiram seis; o item de outro status ficou de fora.
- Lista fechou ao redimensionar, reabriu no celular e o último item ficou
  acessível. Screenshots inspecionados após a animação; sem erros JavaScript.
- `git diff --check` aprovado.

Não houve alterações de API, banco, schema ou dados de produção. Esta revisão
cobre o calendário de Demandas e o popover compartilhado do dia, não uma auditoria
visual geral nem operações de arrastar ou salvar datas.
