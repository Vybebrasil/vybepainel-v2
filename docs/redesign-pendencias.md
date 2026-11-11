# Redesign do moodboard: o que está feito e o que falta (passagem, 10/11/2026)

Arquivo para quem continuar este trabalho, inclusive outra conta do Claude, sem se perder.
Comece por aqui, depois leia `AGENTS.md` e `docs/redesign-auditoria-2026-11-10.md`.

## Contexto em 5 linhas
- O Paulo aprovou o moodboard INTEIRO: https://claude.ai/artifact/Q3rexVtqwYWCqUCJ7U2yb3 (quadros 00 a 66; cada um tem o
  "Depois" e a lista "o que muda", `qd-muda`). Leia pela ferramenta Artifact, action "read", `paths: ["project/<arquivo>.dc.html"]`;
  o índice `project/canvas.json` dá o arquivo de cada número.
- A regra dele: **nenhuma informação sai da tela** ("se tirar as infos vira um jogo"). Redesenhar é mudar a forma, não tirar dado.
- Uma auditoria de 10/11 (em `docs/redesign-auditoria-2026-11-10.md`) achou que só 9 quadros estavam feitos de verdade.
  O que estava como "pronto" não estava. **Não diga que um quadro está feito sem conferir cada item da lista na tela, com foto.**
- Publicação: o Paulo autorizou publicar quando tudo estiver pronto e conferido ("quando finalizar tá tudo aprovado, pode
  publicar pra todos usarem"). Siga `CHECKLIST-DEPLOY.md`: PR, `[preview]` no último commit, CI do commit exato, merge com
  `--match-head-commit`, conferir a produção (vybepainel-v2.vercel.app) e que `/api/monday` responde 410.
- Commits: `git -c user.name="Paulo Martins" -c user.email="gestaovybe@gmail.com" commit`, mensagem em português terminando
  com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Onde está o trabalho
- **Branch de junção:** `codex/redesign-fase2-resto` (pasta `C:/Projetos-Vybe/vybe-os-boletim`), a partir da main de 10/11
  (depois do #639). Já junta, com `npm run check` passando:
  - Cliente (quadros 24 e 26) — coluna "Pedidos do cliente" no documento do planejamento; página de aprovação do cliente
    com vídeo no player, galeria "1 de N", sem arte sem aprovar (o servidor recusa com 409).
  - Produção (15 e 16) — Visão geral com "Pede ação" primeiro; Aprovação de conteúdo com uma barra por cliente; Projetos
    pontuais com um estado vazio só.
  - Gestão (10, 11, 12) — Diário, Automações ("Quando… então…", Falhas em aba, "Mais"), IA e custos (linha de números,
    gráfico por dia, sem "tokens").
  - Peça (23 e 27) — menu de responsável com busca e disciplina primeiro; lote com "Mais"; prévia com a ficha clara ao lado.
  - Moldura única — as telas antigas (Painel de trabalho, Demandas, Agenda, Clientes, Diário, IA, Automações, Conta)
    abrem na mesma janela das novas (pedido do Paulo: "não parece que tá integrado").
  - Hoje e Painel (31, 01, 02, 03) — "De quem é este dia?", guia, agenda de hoje e o que os agentes viram; Painel com um
    cabeçalho, números com ação e uma barra só; agenda da semana com seletor; Demandas com chips.
  - Clientes e Cérebro (05, 53, 54, 55) — avisos só do que pede ação, chips Ativos/Inativos/Carteira, menos colunas (menu Colunas), head na cor da carteira; ficha do cérebro em português; Sinapses com rótulos em português e o selo Qwen; Mapa do Cérebro claro, acima do dock, com X e filtros em chips. Fora: "Refazer o estudo" (não existe no servidor; há "Consultar de novo").
  - Negócio (13, 18, 19, 20, 56, 58, 59, 60) — seletor de período (vbMesHtml), números numa linha, migração só para quem administra atrás de "Ver o que falta", Novo lead e Novo pacote no cabeçalho, Onboarding com esteira, WhatsApp da conta numa linha. Fora: item ativo do menu da conta segue laranja (o 60 manda sobre o 13).
  - Minha sala (34) — Hoje estreito com a agenda dentro, faixa com nome da sala e quem está nela, Decorar e Convidar.
- **Todas as 17 frentes já estão juntas neste branch** (10/11/2026, noite), com `npm run check` passando e as 47 telas do dock
  abrindo sem erro de script no Chromium e no WebKit (1440, 1110 e 390). Além das de cima: Operação (04, 06, 28, 65), Topo (08,
  09, 41, 42, 44, 45, 46, 64, 66), Time (17, 21, 22, 25, 39, 40, 48, 49, 61, 62, 63), Mundo (32, 33, 35, 36, 37, 43) e Sistema
  (00, 29, 30: seletor do padrão no lugar de todo select no mundo, texto clicável como botão, foco, sem rodapé técnico).
- **Re-auditoria de 10/11 (noite):** 50 quadros FEITOS, 18 PELA METADE, nenhum sem fazer, sem regressões
  (`docs/redesign-reauditoria-2026-11-10.md`, item por item). Este branch foi publicado com isso.
- **Falta (segunda rodada):** os 18 pela metade e os defeitos listados na re-auditoria (aviso curto que não some e cobre
  botões da gaveta; janelas translúcidas na busca, no Criar e na gaveta do celular; Loja por cima do dock lateral; contorno
  lilás no WebKit em menu da conta, Camadas e painel do cliente; plurais "1 peças"/"Ver os 1"; chips cortados nas Conquistas).

## Segunda rodada: frente Acabamento (branch `codex/r2-acabamento`, 10/11/2026, noite)
Regras gerais e defeitos do conjunto (quadros 00 Main, 00 Sistema, 29, 30 e 32), conferidos no Chromium e no WebKit em
1440×900, 1110×650 e 390×844.
- Aviso curto: some sozinho (Música 6 s, WhatsApp 7 s; só o mouse que se mexe em cima ou o foco do teclado seguram) e
  sai de cima dos controles da janela (`ajustarAvisosCurtos`, vybe-core.js): com painel à direita fica ao lado dele;
  sem vaga, desce até uma faixa livre. Em tela estreita (1110) com a gaveta aberta ele fica por cima do dock lateral.
- Busca, Criar e gaveta com fundo sólido; Loja à direita do dock lateral; Equipe online com o mesmo fim das outras
  janelas; período do Ranking em laranja; chips das Conquistas quebram em linhas.
- Foco: o contorno grosso da aparência antiga ficou em `:where(body:not(.mundo))`; o anel da dica é laranja.
- Um cabeçalho (`vbCabecalhoHtml` + `vbFecharHtml`): Pessoas, Impressões, Toolkit, Agentes e Planejamentos pelo JS; as
  telas antigas, a Gestão, Fornecedores/Creators e as janelas `vc-topo` pelo CSS (título de 22 px, sem rótulo de setor,
  X e ⛶ na mesma caixa). O HTML das telas da frente Negócio não foi tocado.
- Zeros em linha discreta (Hoje, painel do cliente na Cidade, Recrutamento), plurais, mês no seletor de período em
  Pessoas, "Abrir a semana" como botão e a agenda do dia no Hoje da Cidade.

## Terceira rodada: frente Telas (branch `codex/r3-telas`, 11/11/2026)
Quadros 04, 18 e 00 Main, conferidos no Chromium e no WebKit em 1440×900, 1110×650 e 390×844, com a agenda cheia.
- Agenda › Mês: no computador o compromisso é branco com o traço na cor do tipo (saiu o fundo tingido de "gravada" e
  "falta fechar"). No celular fica a faixa cheia na cor do tipo, do jeito do Google Agenda (pedido do Paulo, 09/11),
  agora com o texto escuro (branco dava 3,3:1 sobre o azul; escuro dá 5:1 ou mais nas três cores) e sem apagar o que
  já passou. Nos dois, o nome quebra em até 3 linhas (4 no celular) e o "+N" abre o dia.
- Agenda › Semana: o bloco estreito (dois lado a lado) mostra o título e o começo do horário ("09:00"); o intervalo
  inteiro fica no rótulo, na prévia e no cartão. Quando a coluna não dá 60 px para cada um (2 abaixo de 120 px, 3
  abaixo de 180, 4 ou mais abaixo de 240), os que se cruzam viram uma pilha na faixa de horas do grupo, cada um com
  "09:00 Título" na largura inteira; o que não cabe fica no "+N", que abre o dia (`agendaSemanaHtml`, `acoes.verDia`).
  A hora da grade continua em 66 px.
- Dica de primeira vez: `evitar` na dica (vybe-mundo-tutorial.js) lista o que o balão não pode cobrir; a "Tela de
  trabalho" não abre mais em cima de "Marcar captação" nem da ação do cabeçalho das outras telas.
- Nova reunião: o calendário já era o do painel (vybe-calendario.js); o ícone do navegador no campo some desde o
  começo no mundo e o campo ganhou o ícone desenhado.
- Churn: sem nenhuma saída, Mensal/Anual não aparece; sem saída, sem entrada com data e sem retenção, um estado vazio
  só (`vbEstadoHtml`); a explicação da conta foi para o ⓘ do título. Saúde da carteira: título igual ao do dock, frase
  no cabeçalho (as quatro telas da Carteira ganharam a frase) e os quatro cartões viraram a linha de números
  (`vbResumoHtml`), cada risco abrindo o mesmo painel de antes.
- Ficou como estava: o rótulo "Vybe OS · Reunião" em cima do título da Nova reunião; no bloco de meia hora da Semana
  não cabe o horário (só o título, como já era); nome com mais linhas do que o bloco comporta termina em reticências
  na última linha (o nome inteiro está na prévia e no cartão).

## Como continuar
1. Para cada frente da tabela: entre na pasta, veja `git status` e `git diff`. Se o trabalho estiver pela metade, termine
   os itens que faltam do quadro (pela auditoria), verifique e faça o commit no branch dela. Se a pasta não existir mais,
   recrie a partir do branch de junção:
   `git -C C:/Projetos-Vybe/vybe-os-boletim worktree add C:/Projetos-Vybe/vybe-os-r-<frente> -b codex/r-<frente> codex/redesign-fase2-resto`.
2. Junte cada branch pronto no `codex/redesign-fase2-resto` (`git merge --no-ff codex/r-<frente>`). Os conflitos costumam ser
   blocos somados no fim de `vybe-mundo.css`: fique com os dois blocos, cada um com o próprio `/* ====` de abertura, e
   confira que os comentários abrem e fecham na mesma conta. Conflito em JS: leia os dois lados e junte à mão.
3. `npm run check` e `git diff --check` no conjunto.
4. Varra todas as telas no Chromium e no WebKit (motor do Safari, o Mac do Paulo) em 1440×900, 1110×650 e 390×844:
   sem erro de script, sem rolagem lateral, nada atrás do dock, nada cortado.
5. **Re-audite os 66 quadros** contra a tela, item por item, com foto. Só o que estiver FEITO de verdade vai ao ar; o que
   ficar pela metade, diga ao Paulo exatamente o quê.
6. Último commit com `[preview]`, push, PR, CI do commit exato, merge, conferir produção. Diga o que mudou, o que foi
   validado e o que ficou de fora.

## Regras das frentes (resumo do AGENTS.md para este trabalho)
- JS global sem framework; preserve nomes de handlers e a ordem do `index.html`.
- Sem `!important` novo e sem `html body.mundo…` em código novo; regra legada que atrapalha vira `:where(body:not(.mundo)) …`.
- Peças prontas: `vbCabecalhoHtml`, `vbResumoHtml`, `vbEstadoHtml`, `vb-alternar`, `vb-chip`, `--pc-*`. Status com
  `statusCor`, cliente com `cliCor`. Ícone desenhado, nunca emoji. Português de quem usa.
- Decisões do Paulo que FICAM: selo "Qwen" das Sinapses visível ("saber de onde vem tudo"); "Nova" lilás da Ajuda; texto
  branco no botão laranja; cores de categoria do dock; avisos do WhatsApp no canto de cima à direita; Minha sala sem nada
  por cima do quarto; player do clipe e HUDs das demandas no 3D continuam (regra 0).
- Demo local: `PORT=<porta> node scripts/dev-server.mjs`; senha demo-local; botão `[data-modo="irecity"]`;
  `window.souDonoDaSessao=()=>true` destrava as telas de dono (só a vista). A demo bloqueia gravações.
- Playwright (WebKit) já foi usado a partir de uma pasta de rascunho fora do repo; se não existir, instale numa pasta
  própria (`npm i playwright && npx playwright install webkit`).

## Itens conhecidos que ficaram de fora (ditos pelas frentes, decidir com o Paulo)
- 10 Diário: o gráfico usa os números que o registro guarda (data à frente, sem data, prazo passado); não há "feito/atrasado" no banco.
- 11 Automações: não existe filtro "Quadro: todos" no código.
- 26 Aprovação do cliente: não há rota para "aprovar todas" nem registro de "vista"; o progresso conta as respondidas.
- 27 Prévia: a ficha é só leitura (aprovar por ela abriria os portões de conferência por baixo).
- 23: "Nova etiqueta" e "Ordem" continuam no menu de status; responsável em lote ainda sem busca.
- 34 Minha sala: feito na frente `codex/r2-moveis` (10/11, noite): objetos pequenos, peças de parede e o que não tem receita
  saem do motor (`mundo/moveis-voxel.mjs`: receitas novas, `generico` e `montarDeParede`). Só a imagem que a pessoa pendura
  (`vybeimg_*`) continua ponto a ponto, porque é a imagem dela. Os ícones da lista do Decorar ainda mostram a arte antiga.
- 02: o cartão da semana manteve a caixa de marcar e o formato (são do lote).
- 03: escolher outras colunas não existe; "+ Nova aqui" ficou "+ Nova demanda".
- Celular: o X da janela cobre o começo do título no Painel e nas Demandas.

## Já publicado em 10/11/2026
- #637 fase 3 (3b, 3c, 3d, Clientes, Comercial, RH e Agentes) — a auditoria mostrou que vários desses quadros ainda estão pela metade.
- #639 conserto: o documento do planejamento voltou a abrir em tela cheia.

## Segunda rodada (10/11/2026, noite): o que entrou e o que ficou
- Juntas neste branch: `codex/r2-operacao` (01, 04, 23, 28), `codex/r2-negocio` (13, 18, 20, 54, 59, 60 e parte do 30) e
  `codex/r2-acabamento` (00, 29, 30, 32 e os defeitos do conjunto). Re-auditoria independente em
  `docs/redesign-reauditoria-2026-11-10-rodada2.md`: 61 FEITO, 5 PELA METADE, 2 FORA, sem regressão.
- **Móveis e ícones da Loja ficaram de fora por decisão do Paulo** ("não precisa refazer ainda"). O trabalho está guardado
  no branch `codex/r2-moveis` (commit 49c0d2a0) e foi revertido aqui (accecadc). Para retomar, reverta essa reversão
  (`git revert accecadc`) em vez de juntar o branch de novo, senão o git não traz as mudanças.
- Pela metade, para uma terceira rodada: ação do cabeçalho encostando na caixa de tela cheia/fechar (Painel, Conta › Equipe);
  aviso curto sobre o dock a 1110 com a gaveta, no meio da tela no celular e sobre "Buscar cliente"; Churn com Mensal/Anual
  sem dado e parágrafo técnico no rodapé; zeros grandes na Saúde da carteira; vista Mês da agenda (reticências e fundo
  tingido); título de 28 px na Agenda e na Conta; visões gerais de setor/Gestão/Performance em 0,97; no celular, fim da
  rolagem atrás da barra no QR Code (Baixar PNG/SVG), Agentes e Conversas.
- Decisões que esperam o Paulo: posição do aviso quando há janela aberta; menção do WhatsApp 12 s; "Como o VYBES pensa" só
  para donos (página Agentes); "Nova etiqueta" e "Ordem" só no menu do grupo; hora da grade da agenda em 66 px.

## Terceira rodada: frente Moldura (branch `codex/r3-moldura`, 11/11/2026)
O que é da moldura de toda janela (quadros 00 Main, 00 Sistema e 29), conferido no Chromium e no WebKit em 1440×900,
1110×650 e 390×844, com a demo cheia (`DEMO_VOLUME=1`). O CSS está no bloco "Terceira rodada · moldura", no fim de
`vybe-mundo.css`.
- Caixa de tela cheia/fechar num lugar só: X de 34 px a 17 px do canto de cima à direita da janela (12 px no celular), ⛶ a
  8 px dele, nas 46 janelas do dock. Nas telas antigas o cabeçalho termina `--vv-caixa-vao` (58 px) antes da borda, para a
  ação ("+ Novo conteúdo", "Novo colaborador") não entrar na caixa. O vão flutuante da rodada anterior nunca valeu (o
  `body:before` do tema antigo é `position:fixed`) e saiu; um float de verdade estreitaria a Agenda e a Conta inteiras.
- Gaveta da demanda aberta: a caixa da tela de trás some (`body.mundo:has(> #workspace-drawer)`), fica só o X da gaveta.
- Aviso curto (`ajustarAvisosCurtos`, vybe-core.js): nunca sobre controle (botão, campo, linha clicável, dock lateral,
  barra de baixo). Ordem: canto de cima à direita; ao lado do painel da direita, sem entrar no dock; a vaga livre mais
  perto do canto; encolhido (`#vv-wa-avisos.compacto`); só então onde cobre menos. No celular (pós-auditoria): sempre
  encolhido logo acima da barra de baixo, na largura da tela, com o texto em até duas linhas; ali ele fica por cima do
  fim da janela por alguns segundos. A pilha só sobe se não cobrir botão ou linha clicável; senão o mais novo espera o
  primeiro sair. O foco do teclado segura no máximo 8 s (`AVISO_CURTO_TETO_FOCO`).
- Dica "Tela de trabalho" (`evitar` em `vybe-mundo-tutorial.js`): nunca sobre a ação do cabeçalho, "Completar" dos
  Clientes, o menu da Conta, o dock lateral e a barra de baixo; dos demais controles, fica onde cobre menos. O balão tem
  320×245 px e em tela cheia de botões (Clientes e Agenda no celular) não há vaga sem nenhum: falta um balão menor.
- Título de 22 px na Agenda e na Conta; Gestão, Performance e visões de setor com fundo sólido.
- Celular: com a barra de baixo à vista, toda janela e o Hoje terminam acima dela (`--vv-pe-barra` entra na conta do
  `bottom`). Antes iam até o pé da tela; o Hoje ficava por cima da barra.
- Plurais: "1 dia de atraso", "1 entregue", "1 falha", "1 cliente", "1 peça" e parecidos em Agentes, Boletim, Comercial,
  Finanças, Pessoas, Performance, visões de setor, Hoje e Cérebro.
- Ficou de fora: o título das telas antigas ainda começa mais baixo (34 a 48 px) que o das janelas novas (17 px); a
  página rola por trás das janelas novas no WebKit com barra clássica (já era assim).

## Terceira rodada (11/11/2026): fechamento
- Juntas em `codex/redesign-rodada3`: `codex/r3-telas` (Agenda Mês/Semana, dica, Nova reunião, Churn, Saúde) e
  `codex/r3-moldura` (caixa de tela cheia/fechar, um X com a gaveta, aviso curto, títulos, fundos, celular acima da barra,
  plurais). Re-auditoria independente em `docs/redesign-reauditoria-2026-11-11-rodada3.md`: 63 FEITO, 3 PELA METADE, 2 FORA,
  sem regressão; depois dela entraram o X da Carteira, três plurais e o aviso do celular acima da barra.
- Continua pela metade: a dica "Tela de trabalho" ainda cobre controles em telas cheias (precisa de balão menor ou lugar
  fixo); no celular o aviso curto cobre por ~6 s o fim da janela e, com a gaveta aberta, 39% de "Arquivo" e "Link";
  reticências depois da 3ª linha no Mês a 1110. Móveis e Loja seguem fora (decisão do Paulo, branch `codex/r2-moveis`).
