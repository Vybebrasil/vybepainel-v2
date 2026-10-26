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

## Perguntas que a tela responde (21/10/2026, pedido do Paulo)

- "Quais captações tem na semana, que dia?": Semana ou Lista (título inteiro,
  hora, cliente, estado); a legenda é o filtro (só captações por padrão; um
  clique liga reuniões e compromissos), com a contagem de cada tipo.
- "Tem roteiro? Está cadastrado?": cada captação tem um estado, igual no
  bloco, na lista e no detalhe (`captEstado`): pronta, falta roteiro, peças
  esperando, nada no sistema ou cliente não reconhecido. Cada peça mostra se
  tem roteiro (briefing ou Docs), a captação e o prazo.
- "O que precisa de mim?": o painel do lado, pelos próximos 30 dias
  (`captPendencias`): ligar peças, cadastrar (abre o formulário de cadastro
  com o cliente), marcar captação (cliente com peças sem data) e escrever
  roteiro. Os números do topo abrem o grupo.
- Evento que passa de um dia para o outro vai para "dia todo" (`horasNaSemana`).
- Clicar num evento abre o cartão ao lado do bloco (`agCartaoAbrir`, no
  celular sobe de baixo), o mesmo nas Captações e no Escritório.
- Peças que vão ser gravadas e ainda não estão na Captação
  (`pecasSemMaterial`): foto ou vídeo da Produção sem material bruto, sem
  status de captação e ainda por fazer. A captação de fotos pelo título
  ("Banco de imagem", "Fotos", "Ensaio") recebe as fotografias; as outras, os
  vídeos. Vídeo sem roteiro entra em "Escrever roteiro". O status da peça não
  muda; só a captação vira "Captação Agendada" ao levar.

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

## Fechar gravação (26/10/2026)

- Paulo: "preciso que o Mizinho finalize a captação que ele fez direto no
  sistema, dando um check na agenda da gravação, com o link que foi pro Drive,
  e veja o que aquela gravação gerou e está ligado de demanda".
- "Fechar gravação" no cartão de toda captação de hoje ou de antes, montada no
  painel ou só no Google Agenda (aí a captação nasce no painel ligada ao
  evento, sem mexer nele). O formulário traz as peças ligadas (marcadas) e as do
  cliente esperando captação; o Mizinho marca o que gravou, cola a pasta do
  Drive e uma observação (`captAbrirFechar`, `fecharGravacao`).
- Numa transação: as marcadas ficam gravadas; as ligadas desmarcadas (sem
  "Gravado" antes) se soltam e voltam para "Agendar Captação"; a pasta vira o
  material bruto de cada peça marcada que ainda não tem um, com registro no
  histórico da peça (`vybe_conteudo_eventos`, tipo `material_bruto`); a
  captação fica "gravada" com `drive_link`, `fechada_em`, `fechada_por` e
  `observacao_final` (`migrations/2026-10-26-producao-fechar-gravacao.sql`).
  Depois, cada peça vai para "Captação Feita" pelo `trocarEscolha`.
- Gravação fechada mostra quem fechou e quando, "Material bruto no Drive" e
  "O que esta gravação gerou", com o status de agora de cada peça.
- Captação que já aconteceu (dia passado, ou hoje com o horário acabado) e não
  foi fechada aparece como "Falta fechar" no bloco e no grupo "Fechar
  gravação" do painel do lado (últimos 7 dias; a rota traz `recentes`). A
  fechada peça a peça antes (tudo "Gravado") não pede de novo.
- Antes da migração, a lista funciona igual e fechar responde 503.

## Próximas etapas

3. Aprovação do roteiro pelo head, peça a peça.
4. Conferência opcional do cliente pelo VybeHub (`area=portal`, como os
   planejamentos).
5. "Roteiro do dia" no celular para o Mizinho, com "Gravado".
6. Edição (Reriston) ligada ao roteiro, à captação e à pasta do Drive.
7. Atalho "Captação de hoje" no Escritório.
