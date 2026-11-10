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
- 34 Minha sala: peças de parede e móveis sem receita ainda com cara do Habbo (precisa receita nova em `mundo/moveis-voxel.mjs`).
- 02: o cartão da semana manteve a caixa de marcar e o formato (são do lote).
- 03: escolher outras colunas não existe; "+ Nova aqui" ficou "+ Nova demanda".
- Celular: o X da janela cobre o começo do título no Painel e nas Demandas.

## Já publicado em 10/11/2026
- #637 fase 3 (3b, 3c, 3d, Clientes, Comercial, RH e Agentes) — a auditoria mostrou que vários desses quadros ainda estão pela metade.
- #639 conserto: o documento do planejamento voltou a abrir em tela cheia.
