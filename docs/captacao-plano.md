# Captação da Produção

Decisão do Paulo (21/10/2026): o fluxo de captação fica dentro do painel e
todos usam. O roteiro de cada peça, a captação marcada, a gravação e a edição
ficam ligados; a conferência do cliente é opcional, como no planejamento.

## Etapa 1 (esta)

- **Para captar**: as peças da Produção em "Agendar Captação" (as que estão em
  Aguardo esperando gravação), por cliente, com o roteiro (o briefing da peça).
- **Montar captação**: escolhe as peças, dia, horário, local e observação. As
  peças viram "Captação Agendada" pelo mesmo caminho do painel
  (`trocarEscolha`, com as automações) e a captação entra no Google Agenda da
  Vybe (`gestaovybe@gmail.com`, conta de serviço com "Fazer alterações").
  Falha do Google vira aviso guardado e "Tentar de novo".
- **Captações marcadas**: dia, horário, local, peças com "Gravado" (vira
  "Captação Feita"); tudo gravado fecha a captação. "Cancelar" tira da agenda
  e devolve as não gravadas para "Agendar Captação".
- Tabelas `vybe_captacoes` e `vybe_captacao_pecas`
  (`migrations/2026-10-21-producao-captacoes.sql`); regras em
  `server/captacoes.js`; tela em `vybe-captacoes.js` (aba Captações da Produção).

## Agenda real (21/10/2026, depois)

- Paulo: "tem captação marcada e não tá contando; cada cor no Google Agenda
  significa uma coisa e o azul é captação". A tela lê os eventos azuis do
  Google Agenda da Vybe (cor padrão da agenda ou 1/7/9; amarelo 5 é reunião,
  grafite 8 é pessoal; "Reunião…", "Consulta…" e o freela do Mizinho ficam
  fora — `ehCaptacaoNaAgenda`) dos próximos 21 dias e liga cada evento ao
  cliente pelo nome no título (`clienteDoEvento`).
- Esquerda: agenda de captações por dia ("Hoje", "Amanhã"); a montada no
  painel mostra as peças e o "Gravado". Direita: fila por cliente que abre,
  da mais urgente (prazo vencido) para as outras, com "vencidas", "sem
  roteiro" e a próxima captação marcada; busca por cliente.

## Agenda única (21/10/2026, depois do pedido do Paulo: "uma tem que conversar com a outra")

- Uma semana só, desenhada como calendário (`agendaSemanaHtml` em
  `vybe-captacoes.js`): colunas por dia, horas, eventos pelo horário e lado a
  lado quando se cruzam; no celular, a faixa de dias e a lista do dia. Cada
  evento vem com o tipo do servidor (`tipoNaAgenda`): azul é captação,
  amarelo ou "Reunião…" no título é reunião, o resto é compromisso.
- Cada uma continua no seu lugar: Captações abre pelo painel geral (Produção)
  e a "Agenda da semana" abre pelo ícone no Escritório, só para consulta, com
  "Ver em Captações" na captação escolhida.
- Na Produção a agenda conversa com a fila: clicar num evento abre o detalhe
  ao lado; numa captação azul marcada direto no Google aparecem as peças do
  cliente esperando e "Levar peças para esta captação", que liga as peças ao
  evento sem criar outro (`evento_google`, `evento_do_painel = false`,
  `migrations/2026-10-21-producao-captacoes-evento.sql`). Esse evento é de
  quem o marcou: o painel não o reescreve nem o apaga; cancelar só solta as
  peças. Arrastar um cliente da fila para um horário, ou clicar num horário
  vazio, abre "Marcar captação" com o dia e a hora.

## Etapa 2: biblioteca de roteiros (21/10/2026)

- Aba "Roteiros" na Produção (`vybe-roteiros.js`, `server/roteiros.js`,
  `area=roteiros`). O roteiro continua no Google Docs; a biblioteca guarda o
  doc, o cliente, as peças que ele descreve e os conteúdos que saíram dele
  (`vybe_roteiros`, `vybe_roteiro_conteudos`,
  `migrations/2026-10-21-producao-roteiros.sql`).
- Por mês, do mais novo; filtro por cliente e busca por título ou peça. Cada
  roteiro abre com as peças, os conteúdos ligados (status e data de ir ao ar),
  "Abrir no Docs" e "Ligar conteúdos": os conteúdos do cliente perto da data
  do roteiro, os que parecem ter saído dele primeiro, e busca pelo nome.
- Os 21 roteiros antigos foram lidos pelo Drive do Paulo e entram pela
  `2026-10-21-producao-roteiros-importacao.sql`, só com as ligações claras
  (7 conteúdos); o resto a equipe liga na tela.
- Novos roteiros: "Buscar no Drive" traz os docs com "roteiro" no nome que a
  conta do painel enxerga (drive compartilhado da Vybe e pastas
  compartilhadas com ela), com o cliente pelo nome do doc. Doc no "Meu Drive"
  de alguém não aparece: entra por "Incluir roteiro", colando o link.
- Na Captação, a peça ligada a um roteiro mostra "Roteiro no Docs" e deixa de
  contar como "sem roteiro".

## Próximas etapas

3. Aprovação do roteiro pelo head, peça a peça.
4. Conferência opcional do cliente pelo VybeHub (`area=portal`, como os
   planejamentos).
5. "Roteiro do dia" no celular para o Mizinho, com "Gravado".
6. Edição (Reriston) ligada ao roteiro, à captação e à pasta do Drive.
7. Atalho "Captação de hoje" no Escritório.
