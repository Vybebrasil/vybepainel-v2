# Movimentação de datas — 26/09/2026

Escopo: arrasto no calendário, editor de data de solicitação, gravação unitária
nativa e preservação de dados em erro. Não inclui auditoria geral de mudanças de
grupo, status ou responsáveis.

## Correções

- Células do calendário de Demandas recebem arrasto e usam seu próprio modo
  Prazo/Conclusão. O calendário do Gestor continua usando seu modo de data.
- O transporte do arrasto preserva IDs nativos com dois-pontos (`vybe:123`), mesmo
  sem a variável global do arrasto. Conteúdos não são aceitos como solicitações
  ao serem soltos na grade de Demandas.
- O editor antigo de solicitações passa a reutilizar `moverDataDoItem`, com a
  API nativa. Foi removido desse caminho o fallback para Monday.
- A mesma atividade não admite duas gravações simultâneas de data nesta página.
  A interface só muda os campos após a confirmação da escrita; erros preservam
  datas e vínculos. Demandas é redesenhada após salvar, e conclusão recebe esse
  nome no aviso, sem aplicar o Prazo de Ouro de conteúdos.
- No servidor, atualização unitária da data e evento de histórico são atômicos.
  Uma falha de histórico reverte a data. Não há migração de schema.

## Evidências

- Regressões de frontend: ID nativo, modo Conclusão independente do Gestor,
  preservação em erro, liberação para nova tentativa, concorrência e separação
  entre prazo e veiculação de conteúdo.
- PGlite nos dois quadros: mudança através de `trocarData`, leitura posterior,
  preservação da outra data e dos dois vínculos de clientes, criação do histórico
  e rollback após erro induzido no histórico.
- Chrome na demonstração local: arrasto real entre células e envio pelo editor;
  ambas as requisições usaram `/api/conteudo`, com a ação nativa `veiculacao`
  (campo que armazena a conclusão de Demandas). Demo recusou ambas as gravações.
  Datas locais e rascunho preservados; sem erros JavaScript.
- Screenshots do editor em 1440×1000 e 390×844 inspecionados.

A demo não comprova persistência: essa parte foi verificada no banco isolado.
Não foram feitas gravações de teste, mudanças de schema ou alterações de
credenciais em produção. A trava local não serializa edições entre diferentes
pessoas ou abas. O editor legado foi exercitado diretamente no navegador; a
entrada principal do calendário continua abrindo o resumo da atividade.

Verificação final: `npm run check` aprovado com 175 testes, sintaxe, escopo global
e build; `git diff --check` sem erros.
