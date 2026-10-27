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

## A tela é o calendário (26/10/2026, depois)

- Paulo: "quero o padrão de calendário: abre e vê o calendário; clicando ou
  passando o mouse aparecem as coisas", com o Calendário do Mac como
  referência.
- Uma barra de vidro só (`capt-toolbar`): ‹ Hoje ›, o mês e a semana, Semana
  ou Lista, os tipos como filtro, "Precisa de você" com o número de
  pendências e "+ Marcar captação". Saiu a fileira de números do topo.
- A semana ocupa a largura toda. O painel de pendências virou inspetor: abre e
  fecha pelo botão da barra (lembrado no navegador).
- Passar o mouse num bloco mostra a prévia (`agPreviaEntrar`, `captPreviaHtml`:
  cliente, horário, local, estado e peças com roteiro); clicar abre o cartão
  com as ações, como antes. O Escritório usa a mesma semana sem a prévia.
- O que já passou recua (dia e evento esmaecidos), menos o que pede ação.
- Peça com prazo vencido há mais de 30 dias sai das listas e da fila
  (`captParada`); "Ver paradas" no inspetor mostra quais são. "Falta fechar"
  conta só a partir de 26/10/2026 (`CAPT_FECHAR_DESDE`).

## Polimento em quatro rodadas (26/10/2026, depois)

- Blocos com o cliente em destaque (`agPartesDoTitulo` tira o "Captação -" e
  o nome do cliente do resto do título), legenda dos pontos de estado e
  atalhos de teclado (T hoje, ← → navega, D S M L troca a visão, N marca,
  P pendências). Só a grade rola.
- Cartão com a ação da vez em cima (`captAcaoPrincipal`: escolher o que vai
  ser gravado, fechar a gravação ou cadastrar), peças no meio, Google e
  cancelar no pé.
- Inspetor com três pendências (Fechar gravação, Sem peças, Sem roteiro) e a
  fila "Esperando captação" embaixo, de onde se arrasta o cliente.
- Marcar, Levar peças e Fechar gravação abrem num painel lateral
  (`captAbrirFolha`), com o calendário à vista.
- Visões Dia, Semana, Mês e Lista. O Mês pede 42 dias à rota (`dias`, até 42;
  o Google Agenda passou a aceitar 42). O Dia tem a coluna das horas e o
  Roteiro do dia (`captRoteiroDoDiaHtml`): cada captação com as peças, o
  roteiro aberto e "Gravado" de um toque. No celular a aba abre no Dia, só
  com o roteiro.
- Animações de entrada sem opacidade: com `html.vb-ocioso` elas pausam no
  primeiro quadro e o painel ficava invisível.

## Peças gravadas a mais e roteiro da gravação (26/10/2026, noite)

- Paulo: "o Mizinho fez 4 materiais na Lions e só 2 estavam no sistema" e
  "pra não perder os roteiros… eles são feitos e ficam sempre nos Docs, no
  mesmo Gmail da agência que todos usam".
- No "Fechar gravação", "+ Adicionar peça gravada" (título, formato e, se já
  se sabe, o dia de ir ao ar). Ao fechar, cada peça nasce pelo cadastro do
  painel (`criarConteudoNaTransacao`, o mesmo do "Cadastrar as peças" do
  planejamento), com o destino e a equipe de `cadastrosDestiny` com material
  pronto (Reels/Vídeo para a edição, Fotografia e Design para o design), a
  pasta do Drive como material bruto, ligada e gravada na captação, e depois
  vai para "Captação Feita" pelo `trocarEscolha`. Com o dia de ir ao ar, o
  prazo segue `prazoDaPeca`.
- Roteiro: o link do Google Docs, no "Fechar gravação" ou em "Ligar roteiro"
  no cartão de uma captação montada (`roteiroDaCaptacao`). Entra na biblioteca
  da aba Roteiros, se ainda não estiver, e liga às peças da captação. PDF e
  DOCX do grupo são só cópias e não entram. Falha ao ligar vira aviso.
- Sem migração.

## Versão sóbria (26/10/2026, noite)

- Paulo: "um design mais sóbrio não ficaria melhor?", com as leis de UX
  (Hick, Fitts, Jakob, Von Restorff, Miller, Prägnanz, Occam, Pareto…) como régua.
- Barra no lugar do Google Agenda e do Mac: "+ Captação", "Hoje", ‹ › e o
  período à esquerda; a pendência que importa como texto ("N gravações para
  fechar"), "Exibir" (tipos, Lista, painel de pendências, atalhos) e
  Dia/Semana/Mês à direita. Sem a fileira de filtros e sem a legenda.
- Uma cor de destaque: só a ação do cartão é laranja. Blocos neutros com uma
  barra fina da cor do tipo; âmbar só em "falta fechar" (estado com
  `chave: "fechar"`). Hoje em negrito sublinhado, sem a bola laranja.
- Cartão curto: o cliente, o título do Google (se for outro), quando, o
  progresso ("1 de 2 peças gravadas"), a ação e só as peças desta captação.
  As do cliente que esperam ficam no formulário.
- Sem vidro: barra, cartão, prévia e painel lateral com fundo liso.
- O cabeçalho do módulo não mostra "Prazo Base / Veiculação" nas Captações.

## Próximas etapas

3. Aprovação do roteiro pelo head, peça a peça.
4. Conferência opcional do cliente pelo VybeHub (`area=portal`, como os
   planejamentos).
5. "Roteiro do dia" no celular para o Mizinho, com "Gravado".
6. Edição (Reriston) ligada ao roteiro, à captação e à pasta do Drive.
7. Atalho "Captação de hoje" no Escritório.
