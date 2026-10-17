# Pontos (XP) e VybeCoins por função — plano

Plano escrito em 17/10/2026 para o Paulo decidir. Nada daqui está implementado
ainda. As regras finais ficam no banco, em tabela, para mudar sem deploy.

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

## Decisões abertas (precisam de resposta)

1. **Funções**: a lista acima está certa? Paulo é só Gestão (e não Atendimento)?
2. **Quadro de Produção**: a Criação ganha também pelas peças de Produção
   ("Para aprovação" = entrega; "Para agendar/Agendado" sem alteração =
   aprovada), ou só pelo quadro de Solicitações, como hoje?
3. **Valores**: as tabelas acima servem como ponto de partida? (Dá para ajustar
   depois na tabela do banco, sem deploy.)
4. **Atraso**: a perda é uma por pessoa por dia (não por demanda), só em dia
   útil, e para no zero. Confirma?
5. **Chegada**: 2 moedas por entrega histórica com teto de 200, e XP de 10 por
   entrega sem teto. Confirma?
6. **Leitura do banco de produção**: posso consultar, só leitura, os rótulos de
   status reais e quantas entregas cada pessoa fez por semana, para conferir os
   valores antes de escrever a migração?

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
- A penalidade usa `GREATEST(0, saldo - valor)`: nunca deixa saldo negativo.
