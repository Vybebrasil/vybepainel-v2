# Revisão de Meu Dia e Direção de Arte — 25/09/2026

Escopo: rótulos de Meu Dia, data inicial da fila DA, cartões da equipe no celular
e mesa de planejamento. Não representa uma revisão visual de todo o produto.

## Correções

- A fila usa “Atividades a iniciar” para abranger conteúdos e solicitações.
- A direção de arte abre em hoje quando hoje pertence à janela selecionada,
  mesmo sem entregas; períodos navegados continuam respeitando seus limites.
- Cartões de equipe usam uma coluna em telas pequenas e não comprimem avatares.
- A mesa mostra agendas e filtros em linhas no celular, com rolagem vertical
  limitada quando necessária. Uma lista vazia não mostra cabeçalho de tabela.
- Abertura, mudança de filtros, Tab/Shift+Tab e fechamento preservam o foco.
  O retorno ao cartão também funciona se o painel o recriar durante a abertura.
  Escape mantém a regra existente de primeiro limpar seleção e depois fechar.

## Evidência local

- `npm run check`: 151 testes aprovados, sintaxe e build aprovados.
- `git diff --check`: aprovado; build repetido após o último ajuste de CSS.
- Chrome/Playwright: Meu Dia e DA em 1440 × 1000 e 390 × 844; screenshots
  inspecionadas; nenhum erro JavaScript capturado nesses fluxos.
- Mesa: foco inicial, filtro com redesenho, ciclo Tab/Shift+Tab, Escape e retorno
  ao cartão; seleção de toda a célula em tela pequena.
- Testes novos cobrem data inicial em fila vazia/futura e virada de mês/ano.

Dados: demonstração fictícia local. A fila criativa da fixture está vazia;
esta revisão não atesta escrita nem organização de uma agenda real cheia.
Não houve alteração de schema, dados reais ou configuração da Vercel.
