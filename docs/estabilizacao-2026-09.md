# Estabilização de grupos e cadastro — setembro de 2026

Base: `7e996f8` (PR 74). Não houve migração de schema, alteração de credenciais
nem gravações de teste em produção.

## Correções

- Operações estruturais de grupos são serializadas em transações. Nome e ordem
  são conferidos dentro delas, evitando decisões baseadas em leituras anteriores.
- Cadastro, movimentação de atividades e destinos de automações leem e bloqueiam
  o grupo na própria instrução de escrita. Um destino apagado é recusado.
- A exclusão preserva referências de atividades, inclusive removidas, e de
  automações. Falhas de consulta interrompem a operação; apenas a ausência
  comprovada da tabela de automações permite continuar sem essa consulta.
- Movimentação automática mantém o nome da etapa sincronizado com o grupo.
- O cadastro mostra as escolhas manuais ao redesenhar a revisão. Demandas usa os
  rótulos de demanda/conclusão. Fechar fica no cabeçalho, com um único ícone;
  Enter em botões mantém a ação do botão e Escape fecha a janela.
- Cadastro em tela estreita tem rolagem acessível. Menus de grupo respeitam o
  tamanho da tela. Grupos vazios explicam o estado sem desenhar uma tabela vazia.
- Dois overrides de grupo com `!important` foram substituídos por especificidade
  explícita. Não houve remoção geral de overrides nem reformulação global.

## Evidências e limites

- `npm run check`: sintaxe, testes e build (resultado final registrado no PR).
- PostgreSQL em memória/PGlite: proteção de vínculos, grupo removido, rollback em
  falha de consulta, nome ocupado, criação concorrente, ordenação e automações.
  A suíte existente também cobre múltiplos clientes, notas privadas, subdemandas
  e regras de cadastro em escala.
- Navegador Chrome local, dados fictícios: login, filtro por cliente, grupos
  expandidos e vazios; cadastro pelo grupo A Fazer até a revisão com título,
  briefing e datas; fechamento por Enter; notas carregadas; abertura do DA sem
  erro de JavaScript. Demandas conferida em 1440×1000 e 390×844, sem transbordamento
  horizontal da página. Cadastro e telas de grupos inspecionados em screenshots.
- Não foram submetidos cadastros reais. A demonstração não prova persistência
  operacional: essa camada foi verificada separadamente nos testes de banco.
- PGlite não substitui um teste de carga com várias conexões Neon. Não houve
  benchmark de contenção, auditoria visual de todas as telas nem teste em Safari.
  Locks estruturais abrangem o catálogo de grupos inteiro; esse caminho deve
  permanecer restrito às ações administrativas, não às leituras frequentes.
