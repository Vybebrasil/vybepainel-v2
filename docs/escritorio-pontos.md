# Pontos (XP) e VybeCoins por função — plano

Plano escrito em 17/10/2026 e aprovado pelo Paulo no mesmo dia ("Aprovado:
funções como listadas, Produção conta para a Criação, valores de partida,
atraso uma vez por pessoa por dia, chegada 2 moedas/entrega com teto 200 e
10 XP/entrega"). A fase 1 está implementada: migração
`migrations/2026-10-17-escritorio-pontos.sql`, fechamento em
`server/escritorio-pontos.js`, testes em `tests/escritorio-pontos.test.mjs`.
Os valores ficam na tabela `vybe_escritorio_regras` e as funções em
`vybe_escritorio_funcoes`: mudar lá vale na hora, sem deploy.

## Como está hoje

- 10 VybeCoins por demanda finalizada no quadro de Solicitações (uma vez por
  demanda, para cada responsável), 50 por conquista (montar o quarto, 1ª, 5ª e
  10ª demanda). Moedas compram móveis extras na loja (25 cada).
- Nível e marcos da ficha são calculados no navegador, contando demandas
  concluídas. Não existe meta, perda por atraso nem perda por alteração.
- Resultado: quem é da Criação ganha muito; Atendimento, agendamento, produção
  e gestão quase nada, porque o trabalho deles não termina em "Finalizado".

## O que muda

Passam a existir duas contas separadas:

- **XP (pontos)**: só sobe. Define nível e marcos. Perder prazo não tira XP.
- **VybeCoins**: compram na loja; podem ser perdidas por atraso e por alteração;
  nunca ficam negativas (a perda para no zero).

Cada pessoa tem uma **função** (guardada em tabela, editável): Criação
(Reriston, Deivid, Bia, Jady), Atendimento (Vinícius, Ewerton L.), Agendamento
(Tainara), Produção (Mizinho), Gestão (Paulo). A função decide quais eventos
contam para a pessoa.

Tudo é derivado do que o painel já registra: mudanças de status, responsáveis,
clientes vinculados e a carteira (azul/laranja), prazo, veiculação, captação,
material bruto e briefing. Não há ponto por tempo online.

## Eventos propostos

### Na hora (gatilho no banco, junto com o evento)

| # | Evento | Quem ganha | Moedas | XP |
|---|--------|-----------|-------:|---:|
| 1 | Demanda de Solicitações vai para Finalizado/Feito (1ª vez) | cada responsável | +10 | +10 |
| 2 | …e dentro do prazo (no dia do prazo ou antes) | cada responsável | +5 | +5 |
| 3 | Peça de Produção vai para "Para aprovação" (1ª vez) | responsáveis da Criação | +10 | +10 |
| 4 | Peça de Produção chega em "Para agendar"/"Agendado" sem ter voltado para Alteração | responsáveis da Criação | +5 | +5 |
| 5 | Status vai para "Alteração" | responsáveis da Criação naquele momento | −5 | 0 |
| 6 | Demanda/peça de cliente da carteira finalizada (1) ou aprovada sem alteração (4) | head da carteira (azul: Ewerton, laranja: Vinícius) | +5 | +5 |
| 7 | Status vai para "Agendado" (1ª vez) | Tainara | +5 | +5 |
| 8 | "Captação Feita" ou link de material bruto registrado (1ª vez) | Mizinho | +10 | +10 |
| 9 | Demanda criada já com briefing | quem criou, se for da Gestão | +2 | +2 |

Regra 5 vale no máximo uma vez por peça por dia.

### Fechamento do dia (00:00 da Bahia, no ciclo diário que já existe; só dias úteis)

| # | Evento | Quem | Moedas | XP |
|---|--------|------|-------:|---:|
| 10 | Criação: fechou o dia sem demanda vencida (tinha fila ou entregou algo) | cada pessoa da Criação | +5 | +5 |
| 11 | Criação: fechou o dia com demanda vencida ainda aberta | cada pessoa da Criação | −5 (uma vez por dia, não por demanda) | 0 |
| 12 | Agendamento: nada "Para agendar" com veiculação vencida | Tainara | +5 | +5 |
| 13 | Gestão: dia sem furo (nada que veiculava hoje ficou aberto; mesmo critério do resumo do dia) | Paulo | +10 | +10 |
| 14 | Dia ativo: fez ao menos uma ação registrada no painel | todos | 0 | +2 |

### Fechamento da semana (segunda 00:00, mesma rotina)

| # | Evento | Quem | Moedas | XP |
|---|--------|------|-------:|---:|
| 15 | Bateu a meta semanal pessoal | quem bateu | +50 | +50 |

**Meta semanal** = média de "entregas" da pessoa nas últimas 8 semanas
completas, arredondada, mínimo 1. Com menos de 8 semanas de histórico usa as
que existem. "Entrega" depende da função: Criação = eventos 1 e 3; Atendimento =
evento 6; Agendamento = evento 7; Produção = evento 8; Gestão = dias sem furo.
O bônus é igual para todo mundo: ganha quem supera a própria média.

### Chegada (uma vez, na instalação)

| # | Evento | Quem | Moedas | XP |
|---|--------|------|-------:|---:|
| 16 | Histórico já registrado no painel | todos | 2 por entrega, teto 200 | 10 por entrega, sem teto |

As 346 demandas antigas foram marcadas sem moedas na instalação da loja. O
bônus de chegada reconhece esse histórico: o nível já começa fiel ao que a
pessoa entregou e as moedas dão um saldo inicial sem inflar a loja. Quem
entregou uma demanda antiga é descoberto assim, nessa ordem: responsáveis que
ainda estão na demanda; se a automação limpou, os nomes do último registro de
"Responsáveis" antes da finalização; por último, quem marcou o status.

## Já decidido pelo Paulo (não precisa responder)

- XP nunca cai; penalidades só em moedas; saldo nunca negativo.
- Meta semanal por pessoa a partir da média das últimas 8 semanas; bônus igual
  para quem bate a própria meta.
- Bônus de chegada pelo histórico, com teto.
- Loja com raridade (comum, raro, muito raro, lendário), estoque limitado e
  vitrine semanal; alguns itens só por marco, sem compra.
- Não premiar horas online; premiar dias ativos.

## Decididas pelo Paulo em 17/10/2026

1. **Funções**: como listadas; Paulo é Gestão.
2. **Quadro de Produção** conta para a Criação ("Para aprovação" = entrega;
   "Para agendar" sem alteração = aprovada).
3. **Valores** das tabelas acima como ponto de partida.
4. **Atraso**: uma perda por pessoa por dia útil, para no zero.
5. **Chegada**: 2 moedas por entrega histórica (teto 200) e 10 XP por entrega.
6. Leitura do banco de produção autorizada (só leitura), feita antes da migração.

## O que a leitura de produção mostrou (17/10/2026)

- A Criação entrega quase tudo no quadro de Produção: 50 a 90 peças por
  semana vão para "Para aprovação" (Bia ~23, Jady ~22, Reriston ~9 por semana,
  nas últimas 8). Solicitações finalizadas são raras (2 a 5 por semana, quase
  todas do Deivid). Sem a decisão 2, Criação não teria meta nem pontos de fato.
- A Tainara quase não usa "Agendado": ela leva a peça de "Para agendar" direto
  para "Finalizado" (399 vezes em 8 semanas, contra 18 "Agendado"). Por isso a
  regra 7 conta as duas saídas, só para quem é do Agendamento (Paulo também
  finaliza, 76 vezes, e não ganha por isso).
- Quem aprova (manda para "Para agendar") é Bia (395) e Deivid (166), Paulo (74).
  50 de 620 aprovações tiveram alteração antes.
- Captação feita e material bruto são sempre registrados pelo Paulo (31 e 35
  peças); por isso a regra 8 credita quem é da Produção, não quem clicou.
- Paulo cria ~80 peças por semana, todas com briefing (o cadastro exige): a
  regra 9 a +2 rende ~160 moedas por semana para ele. Se ficar alto, basta
  mudar o valor na tabela.
- Atrasadas hoje (prazo passado, ainda com responsável): Paulo 38, Bia 19,
  Deivid 11, Vinícius 11, Ewerton 9, Tainara 6, Jady 6, Reriston 5. A perda
  diária só olha status em que a peça está na mão de quem executa (A Fazer,
  Pode Fazer, Em andamento, Alteração, Nova Demanda, Em execução).
- As automações apagam os responsáveis ao marcar "Feito" sem registrar o
  evento de responsáveis; a reconstrução do histórico usa o último registro
  da tela ou quem marcou o status. 14 das 33 demandas finalizadas ainda tinham
  responsável; outras 14 tinham registro; o resto foi por quem marcou.

## Ainda não decidido (fica para depois)

- Deivid aprova 166 peças em 8 semanas como direção de arte e não ganha por
  aprovar. Se o Paulo quiser, vira uma regra nova ("aprovou como D.A.") na
  tabela, sem mexer no resto.
- Com a janela de 7 dias, se o ciclo diário ficar parado mais de uma semana, os
  dias mais antigos não fecham (sem perda nem bônus); a semana ainda fecha.

## Fases

1. **Fase 1 (esta PR)**: tabelas de regras e funções; XP no razão; tabela de
   entregas com o histórico reconstruído; gatilho com os eventos 1–9;
   fechamento do dia e da semana (10–15) dentro do ciclo diário já agendado
   (`/api/mirror-reconcile`); bônus de chegada (16); API devolve XP, nível,
   meta da semana e extrato; ficha mostra nível pelo XP do servidor, meta da
   semana e os últimos ganhos/perdas. Testes em PGlite para cada regra e para
   repetição (nenhum evento credita duas vezes). Nada aplicado em produção sem
   "Aprovado".
2. **Fase 2**: loja com raridade, preço por faixa, estoque e vitrine semanal;
   itens só por marco; marcos calculados no servidor.
3. **Fase 3**: metas do dia na tela e extrato completo.

## Como garantir que não duplica nem some

- Cada crédito tem uma origem única por pessoa (por exemplo
  `entrega:123`, `prazo:123`, `dia:2026-10-17:sem-vencida`,
  `semana:2026-10-13:meta`): repetir o evento ou rodar o ciclo duas vezes não
  credita de novo.
- Evento instantâneo entra na mesma transação do status: se o status não
  gravar, o ponto também não.
- O ciclo diário fecha os dias ainda não fechados (até 7 para trás): se um dia
  a rotina falhar, o próximo fecha o que ficou.
- A perda para no zero: com saldo 3 e perda de 5, o razão registra −3; com
  saldo 0, registra 0 (fica anotado que aconteceu, sem dívida).
- A instalação marca os 7 dias e as 2 semanas anteriores como fechados: o
  primeiro ciclo não cobra nem premia o passado; o histórico entra só pela
  chegada.
