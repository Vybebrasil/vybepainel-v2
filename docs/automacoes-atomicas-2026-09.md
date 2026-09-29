# Automações atômicas e retomada — 29/09/2026

## Comportamento

O motor confirma todas as regras aplicadas a um evento na mesma transação:
grupo, responsáveis, status alterado pela regra, captação, notas, notificações e
registro de execução. Se qualquer ação falhar, todos esses efeitos são revertidos.
A mudança de status solicitada pela pessoa continua sendo uma gravação anterior,
confirmada separadamente; a interface informa quando seu encaminhamento falhou.

O diagnóstico existente “por que não rodou?” oferece “Tentar encaminhamento
novamente” para eventos de status de Produção. A API exige sessão, vínculo do
evento com a atividade, atividade não removida e o evento de status mais recente.
Não cria outra troca de status. Uma ocorrência já aplicada não repete efeitos,
inclusive fora da antiga janela de dois minutos. Uma etapa mais recente impede
a retomada antiga. Não há repetição automática escondida nem reparo retroativo
das execuções parciais anteriores a esta implementação.

## Implementação

`server/transacao-automacoes.js` mantém o transporte HTTP existente e oferece
uma conexão do `Pool` apenas para o motor. A execução abre BEGIN, usa limites
de espera e duração das consultas, confirma ou reverte e libera a conexão.
Não há dependência nova, variável nova ou migração de schema.

O driver instalado suporta transações interativas por WebSocket com Node 22+;
o ciclo de conexão segue a [documentação oficial do Neon](https://github.com/neondatabase/serverless).
Os chamadores ativos em Conteúdo, Painel e Cron usam a mesma fábrica.

A atividade é bloqueada antes da deduplicação. A ocorrência do histórico
identifica status nativos; lembretes usam identidade com dia, campo e intervalo.
Destinos de responsável, status e captação inválidos abortam a execução.
As regras e destinatários existentes não são substituídos.

## Evidências e limites

- `npm run check`: sintaxe, ordem global, 211 testes e build aprovados.
- `git diff --check`: aprovado.
- PostgreSQL isolado/PGlite: falhas no meio e no último registro revertem os
  efeitos; falha na segunda regra reverte também a primeira; retomadas repetidas
  não duplicam notas/notificações; evento antigo é recusado; dono inválido não
  remove o anterior; lembretes podem executar no próximo dia.
- O mesmo adaptador SQL é usado nas transações de teste. Testes de ciclo de
  conexão verificam parâmetros, commit, rollback e fechamento em erro.
- Interface local: diagnóstico com resposta controlada, recusa real da demo,
  nova tentativa, atualização da fila e ausência de erros de JavaScript.
  Screenshots conferidos em 1440×1000 e 390×844.
- Teste de interface cobre duplo envio, preservação de outro modal e distinção
  entre erro de escrita e erro de releitura. Endpoint exige sessão.

Não houve gravação em produção. A conexão WebSocket com Neon real ainda precisa
de homologação em banco isolado antes de publicação; PGlite não prova conectividade
de rede. As tentativas paralelas são verificadas no ambiente isolado, cuja fila
de transações não reproduz toda a concorrência de um servidor Neon real.
O botão de retomada trata status de Produção; não inclui captação, Solicitações
ou uploads do Drive. Esta etapa não publica o código.
