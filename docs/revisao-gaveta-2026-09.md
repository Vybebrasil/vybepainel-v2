# Detalhes da atividade — 25/09/2026

Revisão localizada da abertura assíncrona, registro de comentários e links e
cabeçalho da janela em tela pequena.

## Corrigido

- Resposta de uma abertura antiga não substitui os detalhes da atividade aberta
  depois, tanto em conteúdo quanto em solicitação.
- Salvar comentário não apaga um link ainda não enviado, nem o próximo comentário
  digitado durante a gravação. O mesmo cuidado vale ao salvar um link.
- Mudanças de atividade durante a escrita ou releitura não limpam rascunhos nem
  redesenham outra janela.
- Falha de releitura após sucesso na escrita informa “Registro salvo” e pede para
  reabrir a atividade, sem sugerir que seja reenviada.
- Registro de link bloqueia envios simultâneos para a mesma atividade.
- No celular, ações do cabeçalho quebram linhas e o botão de fechar fica visível.

## Verificação e limites

Sete regressões de concorrência executam as funções reais com respostas
controladas. A suíte completa inclui os testes PGlite existentes de vínculos de
clientes, responsáveis, rollback e histórico de subdemandas.

Chrome com demonstração local: abertura pelo resumo, detalhes em desktop e
390 × 844, rejeição de gravação preservando comentário, console sem erros
JavaScript. Screenshots da janela inspecionadas. Nenhuma escrita real, upload ao
Drive ou alteração de schema. Não atesta entrega real de arquivos nem revisão
integral de todos os editores de campos e combinações de permissões.
