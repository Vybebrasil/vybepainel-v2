# Re-auditoria da quinta rodada × 68 quadros: branch `codex/redesign-rodada4` (151883b2), 11/11/2026

- Código: `151883b2` = a auditoria final (`e019e76b`/`b4970df3`) + `codex/r5-financas` (88376883) + `codex/r5-loja` (7689186c)
  + `codex/r5-celular-painel` (f5d3f78d) + o ajuste dos testes (151883b2). Árvore limpa no começo e no fim. Este arquivo é a
  única coisa escrita no repositório (sem commit, sem push).
- Auditor independente: não participei das frentes. A fonte da verdade são os quadros aprovados (`zip-legado/`) e a lista
  `qd-muda`. A linha de base é `docs/redesign-auditoria-final-2026-11-11.md` (64 FEITO / 4 PELA METADE).
- Demos locais: vazia na 4511, cheia (`DEMO_VOLUME=1`) na 4512 e, para comparar, **a base sem a frente celular-painel**
  (`17db99cb`, extraída com `git archive` numa pasta de rascunho e servida na 4513, demo cheia). As três foram encerradas no fim.
  Senha demo-local, `souDonoDaSessao` forçado.
- Motores: WebKit e Chromium (build 1234) do Playwright. Tamanhos: 1440×900, 1110×650 e 390×844 (celular emulado).
- Scripts, medidas e fotos ficam em
  `C:/Users/pichau/AppData/Local/Temp/claude/b43b1c40185e2413/d71683a7-2ed3-47b7-9ff3-858e4e30c1bb/scratchpad/aud5/`:
  - `loja5.mjs` e `catalogo.mjs` (Loja), `fin.mjs` e `finmob.mjs` (Finanças), `aviso5.mjs` e `aviso5g.mjs` (aviso curto),
    `tempos.mjs`, `antigas.mjs`, `atividade.mjs` e `esc.mjs` (telas antigas), `varre.mjs` e `plural.mjs` (varredura);
  - os `.json` e `.log` de cada medida ficam na raiz da pasta, e as fotos em `fotos/` (`loja/`, `fin/`, `aviso5/`,
    `antigas/`, `varre/`, `varre-cheia/`, `jogo/`, `extra/`, `plural/`). As montagens são `fotos/folha-*.png`.
- Critério igual ao da auditoria final. FEITO quer dizer que todo item do `qd-muda` aparece na tela. PELA METADE quer dizer
  que falta item, e o relatório diz qual. FORA só entra por decisão registrada do Paulo.

## Contagem

| Situação | Qtd | Quadros |
|---|---|---|
| FEITO | 67 | 00 Main, 00 Sistema, 01–34, 36–66 (17, 20, 26, 40, 49 e 63 com \*) |
| PELA METADE | 1 | **35** (item 2: nomes ainda em inglês ou com o código cru da peça) |
| FORA | 0 | |

Comparado com a auditoria final (64/4/0), passam a FEITO: **00 Main** (regra 4), **20** (Finanças) e **29** (regras 4 e 6).
O **35** fica PELA METADE só pelo item 2: o item 1 (voxel) está feito por completo.
Fora dos 68, as telas antigas no Safari melhoraram, mas ainda não chegam ao tempo das novas (detalhes abaixo).

## O que NÃO foi conferido

- O celular foi testado por emulação: 390 nos motores de computador, não num iPhone de verdade. O WebKit de Windows não usa
  a placa de vídeo, e por isso cada quadro de animação custa ~90–100 ms. Os tempos absolutos são maiores que no Safari do
  Mac. O que vale é a comparação entre telas e com a base.
- **20, itens 2 e 3 (barra "para onde vai o dinheiro" com %, "Paguei" na linha):** as duas demos não têm conta lançada nem
  Vybe Finanças ligado. Por isso só vi o estado vazio ("Nenhuma conta neste período" e o aviso de que a divisão aparece com a
  primeira conta). O que segue com valores foi conferido pelo código e pelos testes (`tests/redesign-negocio.test.mjs`),
  daí o asterisco.
- **26 (página do cliente):** não foi reaberta. Nada da quinta rodada mexe nela, e vale o que diz a auditoria final (só com a
  migração `2026-11-11-aprovacao-vistas.sql`).
- **Loja, catálogo inteiro na tela:** rolei na tela 360 cartões por categoria a 1440 e 120 a 390, nos dois motores.
  O catálogo inteiro (12.809 peças em 6 seções) foi conferido chamando `retratoDoMovel`, a mesma função que a Loja usa, só
  no Chromium. Ninguém comprou nem pôs peça na sala: a demo não grava.
- "Tocar fora devolve a pílula" deu certo no Chromium. No WebKit, o meu toque de teste caiu num cartão do Hoje e a tela
  mudou, então o aviso foi recolocado numa faixa livre. Não é defeito, mas também não é prova.
- `npm run check` não rodei (precisaria do build). Rodei só `npm test`; o resultado está no fim deste arquivo.

## Os 4 que estavam pela metade, item a item

### 35 Loja e 29 regra 4 (tudo voxel)

| Medida | Resultado |
|---|---|
| Arte do Habbo à vista, rolando cada categoria (Destaques, Jogos com a equipe, Vitrine, Catálogo Vybe, Móveis, Decoração, Ambientes, Construção, Jogos e efeitos, Estilos e coleções) | **0** em todas. WebKit 1440 cheia: 2.065 cartões, 2.065 voxel. Chromium 1440 cheia: idem. WebKit e Chromium 390 cheia: 824 cartões, 824 voxel. WebKit 1440 vazia: 829, 829 voxel. Na auditoria final, Construção tinha 50/138 do Habbo |
| Catálogo inteiro (`retratoDoMovel` em cada peça das 6 seções, Chromium) | Móveis 1.674/1.674, Decoração 2.623/2.623, Ambientes 2.600/2.600, Construção 696/696, Jogos e efeitos 16/16, Estilos 5.200/5.200 saem em voxel. **0 sem voxel** |
| Quadrado vazio ou brilhando depois de esperar | 0. A espera até a página à vista virar voxel foi de mediana 15–620 ms e **máximo 6,8 s** (WebKit 1440 cheia, Decoração, na primeira abertura). Chromium: no máximo 170 ms |
| 404 / `console.error` / erro de script na Loja | 0 resposta ≥ 400 depois do login (eram 15 respostas 404 na rodada anterior). Os únicos `console.error` são os 401 de antes do login (iguais em toda tela) |
| Inventário, Decorar, Conquistas, Ranking | 0 imagem do Habbo (`jogo.mjs`) |
| Item 2: nomes em português | **Não está fechado.** Os 10 exemplos da auditoria final saíram ("Scanner de corpo", "Multicoloridos"…). No catálogo inteiro, porém, ainda há **~80 nomes crus ou meio em inglês de 8.165**. Exemplos: `survival dystopiafence`, `survival dystopiawall`, `hween gallerywall`, `sanrio chococatclock`, `sanrio twinstarsballoons`, `sanrio kuromidesk`, `Carpa pcnc`, `Mesa wl`, `wl rdesk`, `pcnc wtable`, `Builderwall experimental`, `Fliperama Pato Attack`, `Dança de fliperama Attack`, `Máquina Kind`, `Get Frank`, `Frank Needs YOU.`, `K abine de Fotos`, `Yt`, `Ação link`, e 37 que são só o código da peça (`lidotile`, `prizetrophy2`, `hole1x1test`, `elmeri`, `westhim`, `gaming_c18_hs4`…). **Aparecem na tela sem procurar**: "Carpa pcnc" nas primeiras páginas (inclusive a 390); "sanrio chococatclock", "sanrio twinstarsballoons", "survival dystopiafence/wall" e "hween gallerywall" nas 360 primeiras. A lista está em `aud5/nomes-cru.txt` e `nomes-suspeitos.txt` |
| Itens 3 e 4 | Feitos (raridade como etiqueta, preço em linha própria, ordem e categorias em chips, janela acima do dock) |

Nota: **35 continua PELA METADE** (item 2). A regra 4 do 29 está **feita**.
Fotos: `fotos/loja/*-Constru_o-2.png`, `*-Destaques-0.png`; medidas em `loja5-*.json` e `catalogo-voxel-chromium.json`.

### 20 Finanças e 00 Main regra 4 (zero vira uma linha)

| Tela (1440, dois motores, vazia e cheia) | Resultado |
|---|---|
| Recebimentos | Os 4 cartões viraram a linha "nenhum recebimento lançado no período · recebido: sem dado · pendente: sem dado · inadimplente: sem dado". "Novo recebimento" aparece **uma vez só, no cabeçalho** (no celular vira o "+" do cabeçalho), e o vazio aponta para "o botão do alto da tela". Mensal/Anual e o mês em alternador |
| Inadimplência | Linha "nada em atraso · 0 clientes · 0 críticos (+30 dias) · 0 faturas", "Para quem administra: Ver o que falta" e o vazio com "Ver recebimentos". 0 cartão |
| Contas a pagar | Linha de resumo, "Nova conta" só no cabeçalho, sem a frase quebrada |
| Orçamentos | Sem pacote: "Ir para Pacotes" (botão), sem o título repetido no corpo |
| Visão geral de Finanças, Comercial, Clientes, Pessoas e Produção; Gestão e Performance; Funil, Pacotes, Contratos, Churn, Carteira, IA e custos | **0 cartão com 0, "R$ 0,00" ou "—"** (`fin.mjs`, 19 telas × 2 demos). Os zeros caem na linha discreta (`vs-zeros`). Os cartões que sobram têm número (Clientes ativos 15, Atrasadas 80…) |
| Celular 390, pelo caminho do usuário (Mais → setor → item do menu, toques de verdade) | Finanças (Visão geral, Por cliente, Recebimentos, Contas, Inadimplência), Comercial (Visão geral, CRM e funil, Produtos e pacotes, Orçamentos, Contratos, Churn) e Gestão (Visão geral, Diário, Performance, IA e custos, Automações): **0 cartão de zero**, 0 rolagem lateral |

Nota: **20 FEITO\*** e **00 Main FEITO**. Fotos: `fotos/folha-fin-g.png`, `fotos/folha-fin-c.png`, `fotos/fin/`.
Ficam como acabamento, fora da lista:
- no celular, a Visão geral de Finanças empilha as 6 linhas "sem dado" (ocupam meia tela) e os botões ↻/✕ do cabeçalho
  descem para uma segunda linha;
- textos como "Receita contratada: sem dado · margem — · custo —" e "Negócios fechados: sem dado · negócios ganhos"
  ficam truncados ou repetidos.

### 29 regra 6: aviso curto no celular sobre controle

O aviso foi disparado pelo próprio `mostrarAvisoCurto`, uma vez como o do WhatsApp (título, frase, Abrir/Responder) e outra
como o da Música. Também usei o botão real "Música da sala" do Mais. Medição a cada 250 ms durante 2,6 s: os controles à
vista por baixo do aviso.

| Cenário (390) | WebKit cheia | Chromium cheia | WebKit vazia |
|---|---|---|---|
| 51 telas do dock (Hoje … Minha sala) | **0 controle coberto** em 51/51 | 0 em 51/51 | 0 em 51/51 |
| Com gaveta (Painel e Demandas) | 0 (faixa em 550–632, acima de Comentar/Passar bastão) | 0 | 0 |
| Com o Mais aberto | 0 (pílula na barra do topo) | 0 | 0 |
| Música de verdade (Mais → Música da sala, Hoje) | 0 (faixa) | 0 | 0 |

- Onde o aviso cai: na faixa livre perto do pé na maioria das telas. Vira pílula em Produção e Comercial (o menu do setor
  aberto) e com o Mais aberto. Vai direto para o sino em Agenda, Clientes e Conversas, onde a janela cobre a barra do topo.
- **Pílula:** fica entre a lupa (15–51) e o sino (301–335), em x 57–295 e y 14–48, sem tocar nos dois. Tocar abre o aviso
  inteiro logo abaixo da barra (y 60–158), com Abrir e Responder. No Chromium, tocar fora devolve a pílula (no WebKit, ver
  "não conferido"). Esc devolve o aviso para o lugar dele.
- **Sino:** o aviso que foi direto para o sino acende o número (5 → 6, "Avisos · 6 para ver"). Ao abrir, aparece
  "Chegaram agora" com o título, a frase, "há 0 min" e o botão "Abrir", nos dois motores.
- Computador (aviso de antes, WebKit 1440, 14 telas): 0 controle coberto.
  Ressalva: com a **Loja aberta, o aviso fica atrás da janela** e só a ponta com o ✕ aparece (x 1395–1426).

Nota: **29 FEITO.** Fotos: `fotos/folha-aviso5.png`, `fotos/aviso5/`. Medidas: `aviso5-*.json`, `run-aviso5-*.log`.

### Telas antigas no Safari (fora dos 68)

O tempo vai do clique de verdade no dock até a tela parada. Mediana de 3, demo cheia, 1440, rodado sozinho na máquina.
"Base" é `17db99cb`, sem a frente celular-painel.

| Tela | WebKit base | **WebKit branch** | Chromium branch |
|---|---|---|---|
| Painel de trabalho | 876 | **583** | 553 |
| Demandas | 624 | **556** | 470 |
| Agenda | 770 | **605** | 504 |
| Clientes | 731 | **562** | 484 |
| Diário | 632 | **603** | 475 |
| IA e custos | 612 | **548** | 468 |
| Automações | 571 | **557** | 482 |
| Conta | 623 | **546** | 469 |
| Projetos pontuais (nova) | 510 | **428** | 565 |
| Carteira (nova) | 469 | **462** | 529 |

- Melhorou em todas as telas antigas (Painel −293 ms). No Chromium, as antigas já abrem tão rápido quanto as novas ou mais.
  **No WebKit, ainda ficam 85–175 ms acima de Projetos** (Painel 583 × 428, +36%). Na auditoria final a diferença era o dobro.
  Hoje é pouco mais que um quadro de animação deste WebKit sem placa de vídeo.
  Classifico como **acabamento, não bloqueio**. Precisa ser confirmado num Safari de verdade.
- Nenhum quadro mostrou o cabeçalho do Painel ao abrir outra tela antiga, e o fundo entre o dock e a janela ficou bege
  (`rgb(239,235,228)`) em todos os quadros.
- **Conteúdo igual ao da base:** a assinatura (texto e cartões) de cada uma das 7 semanas do Painel foi idêntica no branch e
  na base: semanas 1–6 com 11/74/77/73/66/0 cartões. Também bateram os chips com número ("Requer ação 57", "Vence hoje 92",
  "Mês 301"…), Demandas, Agenda, Clientes (15), Diário, IA, Automações, Conta, Projetos e Carteira. Nenhum `.vv-abrindo`
  ficou preso.
- Esc com a gaveta (Painel, clique de verdade no título → cartão → "Abrir a peça"): o 1º Esc fecha só a gaveta e o 2º
  fecha o Painel.
- `?atividade=vybe:1002` abre a gaveta certa ("Motion - Bastidores") em 1,9–2,3 s, mas **falha às vezes, no branch e na
  base**: 1 de 4 tentativas em cada um. A gaveta não abre, e o URL perde o parâmetro.
  Não é regressão desta rodada, mas é um defeito que já existia (ver Regressões).

## Varredura (todas as telas do dock)

55 entradas do dock × 2 motores × 3 tamanhos × 2 demos = 660 passadas (`varre.mjs`, o mesmo script da auditoria final).

| Verificação | Resultado |
|---|---|
| Erro de script | 0, fora 1 "ResizeObserver loop completed…" (WebKit 1110, Minhas tarefas, benigno e igual ao de antes) e 1 erro do próprio Playwright (Minha sala, Chromium 1440 cheia: refeito, abriu limpo) |
| 4xx / `console.error` depois do login | **0** (a auditoria final tinha 15 respostas 404 na Loja e 1 no Ranking) |
| Rolagem lateral | 0 em 660 |
| Tela que não abriu | 0 |
| Atrás do dock ou da barra no fim da rolagem | 0 |
| Janela por cima do dock | só os modais com fundo (Nova reunião, Ranking, Conquistas, Loja no celular), como antes |
| Janela translúcida | nenhuma janela de trabalho. Continuam em vidro o Hoje e o painel do cliente sobre o 3D (0,62/0,8), como sempre |
| Cortado / fora da tela | 0 controle cortado, 0 fora da tela |
| "1 <plural>" | 0 nas 52 telas e nas abas delas, demo vazia e cheia (WebKit 1440) |

A comparação com os JSON da auditoria final dá **o mesmo resultado tela por tela**. A única diferença são os 404 da Loja,
que sumiram.

Amostra visual (WebKit e Chromium 1440, cheia; fotos em `fotos/folha-amostra-g.png`, `folha-jogo.png`, `extra/`): Hoje,
Painel, Demandas, Agenda, Clientes, ficha (Visão geral), Cidade, Minha sala, Decorar, Ranking, Conquistas, Agentes, Conta,
Comercial e Carteira. Todas iguais ao que a auditoria final aprovou: um cabeçalho, janelas sólidas, nada sob o dock, ícones
em voxel. Decorar mostra "Guardados" e "Na sala 27" em voxel.

## Regressões

Nenhuma tela quebrou, nenhuma ação deixou de funcionar e o conteúdo das telas antigas é idêntico ao da base. Não achei
regressão causada pela quinta rodada.

Defeitos que já existiam, achados agora:

1. `?atividade=` às vezes não abre a gaveta (1 de 4 no branch e 1 de 4 na base, WebKit 1440). O parâmetro some do URL e a
   tela fica no Hoje.
2. Com a Loja aberta no computador, o aviso curto fica atrás da janela e só a ponta com o ✕ aparece.

Acabamento que continua: pinos sob os controles a 390, WebKit quebrando palavra sem hífen, "limpar tudo" como texto
clicável, chaves liga/desliga no menu de status, o "+" flutuante da Agenda sobre o domingo no celular. No celular, a contagem
dos chips da Loja muda depois que a base chega (Móveis 1.636 → 1.674).

## Causa provável do que falta

| Defeito | Onde |
|---|---|
| Nomes crus ou em inglês na Loja (~80) | `shared/escritorio-nome-movel.js`: o tradutor não cobre prefixos de coleção (`sanrio`, `survival`, `hween`, `pcnc`, `wl`), nomes que são só a classe (`lidotile`, `prizetrophy2`…) nem palavras soltas ("Attack", "Kind", "Get", "Needs YOU") |
| Safari: antigas ~0,1–0,2 s acima das novas | primeira pintura ainda troca a classe do body e monta o resumo do Painel. Medido aqui, sem placa de vídeo |
| `?atividade=` intermitente | já existia na base: o parâmetro é lido e apagado antes de a lista de peças estar pronta numa parte das cargas (não investiguei o código) |

## Veredito

**Pode publicar.** Não há bloqueio. Foram 660 passadas sem erro de script, sem rolagem lateral, sem 404 e sem nada atrás do
dock. No celular o aviso cobre 0 controle em 51 telas, com e sem gaveta, nos dois motores. As semanas e os filtros das telas
antigas ficaram idênticos aos da base, e as quatro frentes fazem o que dizem.

O moodboard está em **67 de 68**. O que falta é acabamento:

1. **35, item 2:** limpar os ~80 nomes crus da Loja. Alguns aparecem logo na primeira página ("Carpa pcnc"), outros em
   Construção ("survival dystopiafence") e em Decoração ("sanrio chococatclock").
2. Safari: as telas antigas ainda ~0,15 s mais lentas que Projetos (confirmar num Mac).
3. `?atividade=` intermitente e o aviso atrás da Loja (defeitos que já existiam).

## Testes

`npm test` (sem o build) no branch: **1801 testes, 1801 passam, 0 falham** (209 s).
