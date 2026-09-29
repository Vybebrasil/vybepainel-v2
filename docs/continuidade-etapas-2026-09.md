# Continuidade entre etapas — 29/09/2026

Revisão posterior: [automações atômicas e retomada](automacoes-atomicas-2026-09.md)
substitui a limitação de ações parcialmente gravadas descrita abaixo.

## Escopo e correções

Revisão do fluxo de status de Produção, reutilizando o motor e as regras
existentes. Não altera destinatários nem semeia regras em produção.

- Cada troca nativa informa ao motor o ID do evento já gravado. Assim, um novo
  ciclo pela mesma etapa não é confundido com uma repetição em dois minutos.
- Se o status foi salvo e o encaminhamento falhou, a API informa
  `automacao_pendente`. A tela avisa para conferir grupo e responsável.
- A API relê o estado também após erro parcial na automação, pois ações
  anteriores podem ter mudado grupo ou dono.
- O efeito da automação sincroniza a lista de responsáveis e o campo singular
  legado. Retirar todos os responsáveis passa a liberar a fila imediatamente.

## Evidências

Os testes de `tests/status-confirmacao.test.mjs` executam as regras de `SEMENTE`
em PostgreSQL isolado, por meio da mesma função `trocarStatus` usada pela API:

1. Finalização em Produção encaminha Reels ou Card para Design & Edição,
   com os responsáveis previstos e status Pode Fazer.
2. Em andamento → Para aprovação chama os aprovadores previstos.
3. Alteração → Em andamento → Para aprovação, repetido em menos de dois minutos,
   executa novamente a regra. Reentregar a mesma ocorrência mantém a deduplicação
   da regra já executada.
4. Para agendar leva à Gestão de publicações com o responsável previsto.
5. Agendado → Finalizado move para Finalizados, retira responsáveis e preserva
   os dois vínculos de clientes.
6. Falha forçada após mudança de grupo devolve o estado parcial e o aviso.

No Chrome local, uma resposta controlada confirmou o aviso de encaminhamento
incompleto, atualização de grupo/status e retirada do dono legado, sem erros de
JavaScript. A demo recusou a escrita real, preservando o estado anterior. O banco
isolado verifica persistência; a resposta simulada verifica a interface.

## Limitações

Não foram alterados dados de produção nem conferidas as regras atualmente
personalizadas no banco de produção. A evidência usa as regras padrão do projeto.
As ações de uma automação ainda não formam uma transação única; o aviso torna a
falha parcial explícita, mas não a repara automaticamente.
O fluxo específico de Solicitações não foi modificado nesta etapa. A passagem
manual de bastão continua registrando contexto, sem trocar responsável sozinha.
Não houve revisão visual geral, alteração de Drive ou publicação nesta etapa.
