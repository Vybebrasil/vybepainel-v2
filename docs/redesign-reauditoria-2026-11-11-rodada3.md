# Re-auditoria da 3ª rodada × branch `codex/redesign-rodada3` (6106c4f2) — 11/11/2026

- Código: `6106c4f2` (main publicada `2179ee81` + `codex/r3-telas` + `codex/r3-moldura`). Árvore limpa no começo e no fim.
- Auditor independente (não participou das frentes). Só leitura do produto; este arquivo é a única coisa escrita no repo.
- Demos locais: vazia na porta 4475, cheia (`DEMO_VOLUME=1`) na 4476 e a main publicada (`2179ee81`, extraída numa pasta de
  rascunho) na 4477 para comparar o tema antigo. As três foram encerradas no fim. Senha demo-local, `souDonoDaSessao` forçado.
- Motores e tamanhos: Chromium (build 1234) e WebKit, em 1440×900, 1110×650 e 390×844.
- Fotos e medidas: `C:/Users/pichau/AppData/Local/Temp/claude/b43b1c40185e2413/d71683a7-2ed3-47b7-9ff3-858e4e30c1bb/scratchpad/aud3/`
  (`fotos/varre/` e `fotos/varre-cheia/` = varredura, nome `<motor>-<tamanho>-<tela>.png`, `c`/`w` = Chromium/WebKit e
  `g`/`m`/`c` = 1440/1110/390; `fotos/caixa/`, `aviso/`, `agenda/`, `carteira/`, `dica/`, `gaveta/`, `mobfim/`, `mobfim-cheia/`,
  `plural/`, `regress/`; `folhas/` = montagens; os `.json`, `.log` e `.mjs` ficam na raiz da pasta).
- Critério igual ao das re-auditorias anteriores: FEITO = todo item na tela; PELA METADE = falta item, dito qual.

## O que NÃO foi conferido

- `npm run check` não foi rodado por mim (o coordenador informou 1779 testes passando no conjunto).
- Celular é emulação (viewport de 390 nos dois motores de computador), não um iPhone. O WebKit é o do Playwright no Windows:
  não tem o dicionário de hifenização do macOS nem o campo de data do Safari (ver itens 8 e 9).
- Estados cheios de Comercial, Finanças, Contratos e Churn: a demo cheia só enche produção, agenda e saúde. Churn **com** saída
  (Mensal/Anual à vista, lista de quem saiu, barras) não foi visto; só o estado sem saída.
- Não reabri: cartão rápido (07), planejamento e prévia (24/25/27), página de aprovação do cliente (26). Nada mudou nelas.
- Tema antigo: só Painel e Agenda (Semana e Mês) a 1440 no WebKit e no Chromium, comparados com a main publicada.
- Loja e Decorar: só que abrem sem erro e sem rolagem lateral (móveis seguem fora por decisão do Paulo).
- A dica "Tela de trabalho" foi forçada em cada tela (`VybeTutorial.dica('modulo', {forcar:true})`), além do caminho natural de
  primeira vez. O que cada pessoa vê depende da primeira tela antiga que ela abrir.
- Menção do WhatsApp fica 12 s (decisão que espera o Paulo); não julguei.

## Contagem

Dos 10 itens da terceira rodada:

| Situação | Qtd | Itens |
|---|---|---|
| FEITO | 7 | 2 (um X com a gaveta), 4 (títulos), 5 (fundo sólido), 6 (celular acima da barra), 8 (Agenda), 9 (dica e Nova reunião), 10 (Churn e Saúde) |
| PELA METADE | 3 | 1 (caixa numa posição só), 3 (aviso curto), 7 (plurais) |

Dos 5 quadros que estavam pela metade na segunda rodada: 04 e 18 passam a FEITO; 00 Main, 00 Sistema e 29 seguem PELA METADE,
cada um por uma sobra pequena (plurais; caixa das 4 telas da Carteira; aviso no celular). **63 FEITO, 3 PELA METADE, 2 FORA.**
Nenhuma regressão que quebre tela (seção C).

## A) Varredura das telas do dock

55 entradas × 2 motores × 3 tamanhos × 2 demos (vazia e cheia) = 660 passadas.

| Verificação | Resultado |
|---|---|
| Erro de script (`pageerror`) | 0 em 660. Nas medições à parte apareceu duas vezes, no Chromium e no WebKit a 1110, o aviso "ResizeObserver loop completed with undelivered notifications" (benigno, sem efeito na tela) |
| `console.error` depois do login | 0 (antes do login há 5 respostas 401 da tela de entrada, como antes) |
| Resposta 4xx/5xx depois do login | 0 |
| Rolagem lateral | 0 em 660 |
| Tela que não abriu | 0 |
| Conteúdo atrás do dock no fim da rolagem (computador) | nenhum |
| Conteúdo atrás da barra no fim da rolagem (celular) | nenhum, nas 49 telas, nas duas demos (item 6) |
| Janela por cima do dock | nenhuma. Nova reunião, Ranking, Conquistas e Loja são modais com fundo, como antes |
| Janela translúcida | nenhuma janela de trabalho. Gestão, Performance e as 5 visões de setor: `rgb(246,243,238)`, sem desfoque. Hoje e painel do cliente sobre o 3D seguem em vidro (0,62 e 0,8), como já eram |
| Cortado | (a) rótulos dos pinos saindo da tela no Centro e no Prédio a 390, como antes; (b) demo cheia, Painel e Hoje: o chip "Para aprovação" passa 14 px do `.day-activity-actions` (356–447 em 356–433) e o formato vira "F…"; a rodada 3 não tocou nesse bloco (já existia, só aparece com a demo cheia); (c) Agenda › Semana a 1110: a data comemorativa "★ Proclamação da República" passa 13 px da borda da semana (900–1061 em 62–1048) |

## B) Os 10 itens da terceira rodada

### 1. Caixa de tela cheia/fechar numa posição só — PELA METADE

Medido em 48 janelas (46 do dock mais Conta › Equipe e as visões de setor) × 2 motores × 3 tamanhos, demo cheia.

- **Feito:** X de 34×34 com borda `1px rgb(230,224,214)` e fundo branco em todas. A 1440 e a 1110, 42 janelas com o X a 17 px da
  direita e 17 px do alto; no celular, 37 janelas a 12/12. ⛶ de 34×34 a 8 px do X, na mesma altura, nas 11 janelas que têm tela
  cheia. Igual no Chromium e no WebKit.
- **Nenhuma ação invade a caixa:** Painel "+ Novo conteúdo" a 23 px da caixa; Conta › Equipe "Novo colaborador" a 13 px;
  Clientes "Novo cliente" a 23 px; Agenda "Marcar captação" a 55 px; Diário "Registrar agora", IA "Atualizar" e Automações "Nova
  regra" a 13 px. Menor folga medida: 8 px (o "?" e o "Atualizar" que fazem parte da mesma fileira).
- **Falta:** as 4 telas da Carteira (**Saúde da carteira, Onboarding, Contratos, Churn**) têm o X a **23,6 px** do alto no
  computador e a **26,3 px** no celular (as outras: 17 e 12). São 4 de 46 fora do lugar, nos dois motores e nos três tamanhos.
  Causa: a frente Telas pôs a frase no cabeçalho (`.vc-frase`), o cabeçalho ficou mais alto e o `#vv-carteira .vc-topo` centra
  os botões na altura; a frente Moldura subiu os botões só de `#vv-conteudo` e `#vv-comercial`. É defeito da junção das duas
  frentes. Foto: `fotos/caixa/w-g-cheia-churn.png`, `folhas/cel-caixa-1.png`.
- No celular o X não cobre mais o começo do título em nenhuma tela (Painel, Demandas, Clientes, Diário conferidos na foto).
- Continua, dito pela frente: o título das telas antigas começa mais baixo (y 30 a 48) que o das novas (17 a 23).
- Minhas tarefas e Direção de arte não são janelas (abrem no Hoje): não têm caixa.

### 2. Com a gaveta aberta, só um X — FEITO

Aberta a partir de Demandas, Painel e Agenda, e com a tela de trás em tela cheia, nos 6 conjuntos: um X só à vista (o da gaveta,
33×30); `.vv-canto-modulo` com `display:none`. No celular o único controle do alto é o "Voltar" da gaveta. Fotos: `folhas/gav.png`,
`folhas/gav-cel.png`. Observação: o X da gaveta não fica na posição da caixa (está a 64 px do alto, dentro da gaveta) e, com ela
aberta, a tela de trás fica sem tela cheia; é o desenho escolhido.

### 3. Aviso curto — PELA METADE

Música com clique de verdade e WhatsApp (chega sozinho de 30 em 30 s), vigiados a cada 120 ms do nascer ao sumir.

| Cenário | Onde caiu | O que cobre |
|---|---|---|
| 1110 com a gaveta | encolhido, 736–1096 × 246–311, dentro da gaveta | nenhum controle; **não cai mais no dock** |
| 1440 com a gaveta | à esquerda da gaveta, 314–654 × 150–283 | nada |
| Clientes 1440 e 1110 | no cabeçalho, à esquerda de "Cadastros" | nada; **"Buscar cliente", "Completar" e "Colunas" livres** (cobre parte da frase do cabeçalho e do texto do alerta) |
| Minha sala 1440 e 1110 | abaixo da faixa da sala, 1086–1426 × 126–259 | nada; **Convidar e Decorar livres** |
| Painel, Agenda, Conta › Equipe | vaga livre mais perto do canto | nada |
| Celular, QR Code e Minha sala | encolhido, logo acima da barra (699–764) ou do dock das salas (630–695) | nada |
| Celular com a gaveta | encolhido, 591–656 | **"Arquivo" 38% e "Link" 38%** (a sobra dita pela frente; confirmada nos dois motores) |
| Celular, Clientes e Painel | faixa do título, 38–298 × 4–69 (260 px) | nenhum controle, mas **não dá para ler**: o título vira "A mú…" / "Vybe - Rest…" e a frase "Entr…" / "Clien…" (40 px de 616 da frase), e o aviso fica em cima do título da janela ("Cl…", "Pa…") |
| Celular, Hoje | encolhido, 207–272 (a um quarto da altura, sobre o cartão do VYBES) | nada com um aviso; com dois empilhados (Chromium), o segundo cobriu 38% da linha "1 AGORA 80 peças…" |

- **Tempo:** Música com o mouse 5,9 a 6,1 s; com o foco do teclado no botão do aviso 7,8 a 8,0 s (era 13,5 s); WhatsApp 6,6 a
  7,1 s. Feito.
- **Encolhido dá para ler?** No computador e acima da barra no celular, sim: título inteiro em até 2 linhas (13 px), frase numa
  linha com reticências (12 px), ação ao lado. Na faixa do título do celular, **não**.
- **Falta:** (a) o aviso na faixa do título do celular (ilegível e por cima do título); (b) "Arquivo"/"Link" com a gaveta no
  celular; (c) no Hoje do celular ele ainda fica no terço de cima da tela, sobre o conteúdo.
- Fotos: `folhas/aviso-cel.png`, `folhas/aviso-desk.png`, `fotos/aviso/`.

### 4. Títulos — FEITO

Nenhum título de 25 px ou mais em nenhuma janela do mundo, nos 6 conjuntos. Agenda ("Agenda e captações") e Conta ("Perfil",
"Equipe"): 22 px/700 no computador, 19 px no celular, como as demais. (No tema antigo o título segue em 28 px, de propósito.)

### 5. Visões gerais, Gestão e Performance com fundo sólido — FEITO

Produção, Clientes, Comercial, Finanças, Recursos Humanos, Gestão › Visão geral e Performance: `rgb(246,243,238)`, alfa 1, sem
`backdrop-filter`, a 1440 e a 1110 nos dois motores. No celular o setor abre o menu (branco, sólido); Gestão e Performance
sólidas.

### 6. Celular: fim da rolagem acima da barra — FEITO

49 telas × 2 motores, demo cheia (e a vazia no WebKit): nenhum texto ou botão atrás da barra (772–836). As janelas terminam em
764; o Hoje vai de 64 a 764 e não fica por cima da barra. QR Code: "Baixar PNG" e "Baixar SVG" inteiros acima da barra. Agentes:
último "Ver o achado" visível. Conversas: última conversa visível. Fotos: `folhas/mobfim.png`, `fotos/mobfim-cheia/`.
Não rodei a demo vazia no Chromium (o script caiu); a cheia passou nos dois.

### 7. Plurais — PELA METADE

Texto de 54 telas do dock e das abas de cada janela, nas duas demos, mais os três pontos da rodada 2.

- **Feito:** "1 demanda a alterar" (lote), fila do Qwen em "Como o VYBES pensa", "1 achado em aberto", "1 cliente sem nenhum
  conteúdo", "1 peça", "1 só na operação", "+1 outra" na Agenda. Os três erros da rodada 2 sumiram.
- **Falta (demo vazia):**
  - Performance › Por formato: **"1 abertas · no prazo —"** (`vybe-mundo-performance.js:184`).
  - Hoje › Faltam hoje: **"0 de 1 feitas"** (`vybe-mundo.js:846`).
  - Visão geral da Produção: **"Nesta semana, 0 de 1 previstas prontas."** (`vybe-mundo-setor.js:384`).
- Demo cheia: nenhum "1 <plural>" achado.

### 8. Agenda — FEITO, com ressalvas

Com 94 compromissos no mês e conflitos de 2, 3 e 4 no mesmo horário, injetados pela rota do Playwright.

- **Mês, computador:** fundo branco em todos (o `rgb(251,248,244)` medido é só o do mouse em cima); só o traço de 3 px na cor do
  tipo; nome em até 3 linhas; nenhum compromisso sai da célula; "+2 outras" é botão e abre o dia (`dia 2026-10-26`). O que já
  passou fica a 0,5 de opacidade.
- **Mês, celular:** faixa cheia na cor do tipo (amarelo, azul, cinza), texto `rgb(31,29,26)`, contraste mínimo 5,19:1, sem
  apagar o que passou, até 4 linhas, "+1" abre o dia. Legível. (Pedido do Paulo; não é defeito.)
- **Semana a 1110** (coluna de 88 a 90 px): dois ou mais que se cruzam viram pilha na largura inteira, cada um com "09:00
  Título"; o que não cabe vira "+3" (rótulo "Mais 3 às 09:00: abrir o dia"); dois de meia hora viram o botão **"2 às 16:30"**,
  que abre o dia. Nenhum bloco estoura a altura, nenhum horário cortado, nenhum bloco por cima de outro, todos de fundo branco.
- **Semana a 1440** (coluna de 137 px): dois lado a lado de 64 px com "08:00"; três ou mais em pilha.
- **Ressalvas:**
  - Reticências continuam depois da 3ª linha: a 1110 (célula de 97 px), 39 de 94 compromissos do mês terminam em "…"; a 1440,
    1 de 94. A data "Dia Internacional pela Eliminação da Vio…" também corta a 1110. (Dito pela frente; o nome inteiro está na
    prévia.)
  - No WebKit do Windows a palavra quebra sem hífen ("demonstraçã/o", "Empreend/edora", "Consciênci/a Negra"); no Chromium
    sai com hífen ("demonstra-ção"). No Safari do Mac depende do dicionário do sistema: **não conferível aqui**.
  - Bloco estreito a 1440: "Alinhamen/to da…" (palavra partida e reticências em 64 px).
  - O bloco de meia hora sozinho ("Almoço") segue sem horário (dito pela frente).
  - A 1110 a barra da Agenda (abas, mês, Dia/Semana/Mês) gruda no alto e ocupa 150 dos 542 px da janela; os dias da semana
    (seg 9, ter 10…) rolam para fora e não dá para saber de que dia é a coluna. Já era assim; a rodada 3 não mexeu.
- Fotos: `fotos/agenda/` (`w-g-cheia-mes`, `w-m-cheia-mes-meio`, `c-m-cheia-semana`, `w-g-cheia-semana`), `folhas/ag-cel.png`.

### 9. Dica de primeira vez e Nova reunião — FEITO, com ressalva

- Agenda: a dica (a natural "Agenda da Produção" e a "Tela de trabalho" forçada) **não cobre "Marcar captação"** em nenhum dos
  6 conjuntos. Também livres: "+ Novo conteúdo" (Painel), "+ Nova demanda", "Novo cliente", "Registrar agora", "Atualizar",
  "Nova regra" e "Mais" (Automações). O balão fica sempre dentro da tela.
- **Ressalva:** nos Clientes a "Tela de trabalho" fica em cima do botão **"Completar"** do alerta (1440 e 1110, dois motores);
  não é ação de cabeçalho, mas é botão. No celular, na Conta, o balão cobre o menu ("Perfil", "Senha").
- Nova reunião: o campo de data tem o ícone desenhado (svg de 16 px dentro do campo) e abre o calendário do painel (`.vcal`,
  claro, 35 dias, dentro da tela); escolher um dia grava a data. No Chromium aparece um ícone só. No WebKit do Playwright o
  campo mostra "2026-11-11" (ali não existe campo de data); no Safari de verdade o formato é o do sistema: **não conferível**.
- Ficaram como estavam: o rótulo "Vybe OS · Reunião" em cima do título; "Cliente" e "Tipo" seguem `<select>` do navegador
  nesse formulário.
- Fotos: `folhas/dica-g.png`, `folhas/dica-c.png`.

### 10. Churn e Saúde da carteira — FEITO

- **Churn sem saída** (as duas demos, 6 conjuntos): Mensal/Anual escondido (`hidden`); um estado vazio só ("Nenhum cliente saiu
  até agora"); nenhum "cohort" nem "Saída = desativação…" na tela; a conta está no ⓘ de "Saídas e retenção": balão de 340 px,
  texto `rgb(31,29,26)` em branco (16,8:1), 12 px, dentro da janela a 1440, 1110 e 390; abre com o mouse e com o toque nos dois
  motores. Com o foco posto por script abriu no WebKit e não no Chromium; não testei a tecla Tab de verdade. Números numa linha discreta ("0 saídas", "R$ 0 de receita perdida por mês").
- **Saúde da carteira:** título igual ao do dock (22 px), frase no cabeçalho, quatro números numa linha (15 px; zero em cinza
  `rgb(138,132,122)`), nenhum zero grande. "0 em risco alto" e "0 em risco médio" **continuam abrindo o painel** ("Nenhum
  cliente neste risco"), dentro da tela nos três tamanhos; com a demo cheia, "14 em risco médio" abre a lista.
- Contratos e Onboarding também ganharam a frase.
- Fotos: `folhas/cart-g.png`, `folhas/cart-cel.png`.

## C) Regressões da segunda rodada e das telas FEITAS

Amostra nos dois motores (fotos em `folhas/reg-wg-1..3.png`, `folhas/regress-wg.png`, `fotos/varre-cheia/`):

| Tela | Resultado |
|---|---|
| Hoje | abre, guia do VYBES, números, agenda de hoje; no celular termina acima da barra |
| Painel | barra numa linha a 1440 nos dois motores, demo vazia e cheia (12 controles com o meio em y=234) |
| Demandas, Agenda, Clientes | abrem sem erro; chips, lote "1 demanda a alterar" |
| Ficha do cliente e ficha do cérebro | abrem; "Atualizar" é botão |
| Sinapses | "De onde vem cada coisa" e "Ver o diagnóstico em Agentes". O selo Qwen fica no estudo do cliente; em "Todos os clientes" não há estudo na demo (a rodada 3 só mexeu em plurais nesse arquivo) |
| Agentes › "Como o VYBES pensa" | abre, sem plural errado |
| Cidade, Prédio | abrem; rótulos saindo a 390, como antes |
| Minha sala e Decorar | Convidar e Decorar descobertos; Decorar entra em `vv-decorando`; sem rolagem lateral |
| Loja, Ranking, Conquistas, Toolkit | abrem, sem erro |
| Conta, Contratos, Finanças por cliente | abrem; Conta com o menu lateral |
| Gaveta no computador | sólida (`rgb(250,248,244)`), um X |
| Gaveta no celular | 0,0 a 390,844, barra por cima (772–836), Comentar e Passar bastão em 753–755, nada atrás da barra no fim; tocar na barra fecha |
| Tema antigo (fora do mundo) | Painel e Agenda (Semana e Mês) abrem sem erro e **iguais à main publicada**, foto a foto (`folhas/antigo-main.png`). A pilha da Semana não vale lá (é só `body.mundo`), como previsto |

Nada regrediu.

## D) Novo ou que piorou nesta rodada

1. **Caixa das 4 telas da Carteira 6,6 px (computador) e 14,3 px (celular) abaixo das outras** — nasceu da junção das duas
   frentes (item 1).
2. **Aviso na faixa do título do celular, ilegível** — lugar novo desta rodada (antes ficava no meio da tela) (item 3).
3. Nos Clientes a dica "Tela de trabalho" cobre "Completar" (antes cobria outra coisa; a regra nova não lista o alerta).

Já existiam e continuam:

1. Reticências na vista Mês (agora só depois da 3ª linha).
2. "Arquivo"/"Link" sob o aviso com a gaveta no celular.
3. Chip "Para aprovação" cortado no Painel com a demo cheia; data comemorativa 13 px para fora na Semana a 1110.
4. Rótulos dos pinos fora da tela no Centro e no Prédio a 390.
5. "Vybe OS · Reunião" em cima do título; dois `<select>` na Nova reunião.
6. Título das telas antigas mais baixo que o das novas; a página rola por trás das janelas novas.
7. Dias da semana somem ao rolar a Agenda a 1110.

## Causa provável

| Defeito | Onde |
|---|---|
| X da Carteira fora do lugar | `vybe-mundo.css`, bloco "Terceira rodada · moldura": `body.mundo :is(#vv-conteudo,#vv-comercial) .vc-topo{align-items:flex-start}` não inclui `#vv-carteira` (e o `padding` do celular de `#vv-carteira .vc-topo` precisa do mesmo acerto) |
| Aviso ilegível na faixa do título do celular | `ajustarAvisosCurtos` em `vybe-core.js`, ramo `W <= 600`, laço `for (const w of [larga, 300, 260, 220])`: aceita 260 px com a ação ao lado; e `#vv-wa-avisos.compacto` em `vybe-mundo.css` |
| "Arquivo"/"Link" cobertos no celular | mesmo ramo: `procurar` na faixa acima da barra aceita a posição com menos controles |
| "1 abertas" | `vybe-mundo-performance.js:184` |
| "0 de 1 feitas" | `vybe-mundo.js:846` (e a mesma frase em `zero`) |
| "0 de 1 previstas prontas" | `vybe-mundo-setor.js:384` |
| Dica sobre "Completar" | `evitar` da dica `modulo` em `vybe-mundo-tutorial.js:121` (falta o botão do alerta dos Clientes) |
| Reticências no Mês a 1110 | `-webkit-line-clamp:3` em `body.mundo .capt-cal .capt-mes .ag-chip span` (`vybe-mundo.css`) |

## Veredito

**Pode publicar.** Nada bloqueia: 660 passadas sem erro de script, sem rolagem lateral, sem nada atrás do dock ou da barra;
nenhuma tela quebrou, nenhuma informação saiu, nenhuma ação que funcionava deixou de funcionar; o tema antigo está igual à main.

Acabamento que pode esperar, na ordem em que eu consertaria:

1. X das 4 telas da Carteira no lugar das outras (uma linha de CSS).
2. Aviso no celular: não usar a faixa do título com 260 px (ilegível); "Arquivo"/"Link" com a gaveta.
3. Os três plurais ("1 abertas", "0 de 1 feitas", "0 de 1 previstas prontas").
4. Dica sobre "Completar" nos Clientes.
5. Mês a 1110 (reticências depois da 3ª linha) e a quebra de palavra sem hífen, depois de olhar no Safari de verdade.

Antes de publicar, olhar num iPhone e no Safari do Mac o que a emulação não mostra: hifenização do Mês, campo de data da Nova
reunião e o aviso curto com a barra do Safari.
