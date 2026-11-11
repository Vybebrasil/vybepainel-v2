# Auditoria final dos 68 quadros × branch `codex/redesign-rodada4` (e019e76b) — 11/11/2026

- Código: `e019e76b` = main publicada (`346136cc`, #645) + `codex/r4-aprovacao` (26) + `codex/r4-moveis` (34/35) + `codex/r4-sobras`
  + `codex/r4-abertura`. Árvore limpa no começo e no fim; este arquivo é a única coisa escrita no repo (sem commit, sem push).
- Auditor independente (não participou das frentes). Fonte da verdade: os PNGs aprovados (`zip-legado/`) e a lista `qd-muda`
  de cada quadro (extraída de `project/*.dc.html` pelo `canvas.json`). Histórico: `docs/redesign-pendencias.md` e as três
  re-auditorias anteriores.
- Demos locais: vazia na 4491 e cheia (`DEMO_VOLUME=1`) na 4492, senha demo-local, `souDonoDaSessao` forçado. Encerradas no fim.
- Motores e tamanhos: Chromium (build 1234) e WebKit (Playwright), 1440×900, 1110×650 e 390×844.
- Fotos, medidas e scripts: `C:/Users/pichau/AppData/Local/Temp/claude/b43b1c40185e2413/d71683a7-2ed3-47b7-9ff3-858e4e30c1bb/scratchpad/audfinal/`
  - `fotos/varre/` e `fotos/varre-cheia/` = varredura (`<motor>-<tamanho>-<tela>.png`, `w`/`c` = WebKit/Chromium, `g`/`m`/`c` = 1440/1110/390);
  - `fotos/lado/qNN.jpg` = quadro aprovado ao lado da tela de hoje; `q/` = os 68 quadros em JPG;
  - `fotos/jogo/` (Loja, inventário, Decorar, Conquistas, Ranking, Minha sala, celular), `fotos/extra/` (topo, ficha, Sinapses,
    Mapa, agente, prévia, planejamento, menus, lote, captação, gaveta, TV, Música, Criar, Camadas), `fotos/agenda/`, `fotos/dica/`,
    `fotos/aviso/`, `fotos/caixa/`, `fotos/esc-*`; `fotos/folha-*.png` = montagens;
  - os `.json`/`.log` de cada medida e os `.mjs` ficam na raiz da pasta.
- Critério: FEITO = todo item do `qd-muda` na tela; PELA METADE = falta item, dito qual; FORA = só por decisão registrada do
  Paulo. Diferença do "Depois" que não está no `qd-muda` vai como "fora da lista" e não muda a nota. FEITO\* = conferido pelo
  código/testes porque a demo não mostra.

## Contagem

| Situação | Qtd | Quadros |
|---|---|---|
| FEITO | 64 | 00 Sistema, 01–19, 21–28, 30–34, 36–66 (17, 26, 40, 49 e 63 com \*) |
| PELA METADE | 4 | **00 Main**, **20**, **29**, **35** |
| FORA | 0 | (26 e 34, que estavam FORA, agora estão feitos) |

Comparado com a rodada 3 (63/3/2): 00 Sistema passa a FEITO (X da Carteira no lugar); 26 e 34 saem de FORA para FEITO;
**20 e 35 voltam para PELA METADE** — não regrediram: as rodadas anteriores não abriram Recebimentos/Inadimplência (só Contas)
e pularam a Loja ("móveis fora"). Agora que os móveis entraram, a Loja foi conferida categoria por categoria.

## O que NÃO foi conferido

- `npm run check` não rodei (informado: 1790 testes). Rodei só `node --test tests/aprovacao-lote.test.mjs`: 8/8 passam.
- **26 (página do cliente)**: a demo não serve `/aprovar-pecas`; conferido pelo código (`server/conteudo-aprovacao-pagina.js`)
  e pelos 8 testes. Não vi a página na tela. O "1 de N vistas" e "Aprovar todas as vistas" só existem com a migração
  `migrations/2026-11-11-aprovacao-vistas.sql` aplicada no Neon; sem ela a página mostra "respondidas" e "Aprovar todas".
- Celular é emulação (390 nos dois motores de computador), não um iPhone. WebKit do Windows não tem o campo de data nem a
  hifenização do Safari do Mac (Nova reunião mostra "2026-11-11"; Mês quebra palavra sem hífen).
- Demo sem central dos agentes: "Dar autonomia" (63) só com `modo.real`; TV desligada (o clipe no alto do 44 não aparece);
  Creators sem `pode.editar_comercial` (botão "Novo creator"/"Cadastrar creator" só pelo código, 17/49).
- Peça da Loja que hoje sai na arte do Habbo, depois de posta na sala: não comprei nem pus (a demo bloqueia gravação).
- Tema antigo (fora do mundo): não reaberto nesta rodada (nada da r4 mexe nele; `vybe-quadro-entra` foi para `:where(body:not(.mundo))`).
- Plurais: varredura de texto de todas as telas e abas só no WebKit 1440 da demo vazia (nenhum "1 <plural>").

## Tabela dos 68 quadros

| Quadro | Tela | Nota | Motivo / medida | Foto |
|---|---|---|---|---|
| 00 Main | Regras gerais | **PELA METADE** | Regra 4 ("zero vira uma linha") falha em **Recebimentos** (4 cartões "—": A receber, Recebido, Pendente, Inadimplente) e **Inadimplência** (cartões "—", 0, 0, 0). O resto vale: um cabeçalho, uma janela por vez (busca fecha ao abrir o sino), sem rodapé técnico, plural certo (nenhum "1 <plural>" em 54 telas e suas abas), `!important` não subiu (9.195 = publicada) | varre-cheia/w-g-recebimentos, w-g-inadimplencia, folha-20 |
| 00 Sistema | Peças do depois | FEITO | Caixa ⛶/X: X 34×34 a 17/17 px em todas as janelas a 1440 (a Carteira entrou no lugar), 12/12 no celular; nenhuma ação invade; título 22 px/700 | run-caixa-webkit-g/c.log |
| 01 | Painel de trabalho | FEITO | Cabeçalho único com Modos e "+ Novo conteúdo"; números com ação; barra numa linha a 1440; sem busca do meio | lado/q01 |
| 02 | Agenda da semana | FEITO | ‹ semana ›, Redes/Demandas/Pendências uma vez, traço laranja no hoje; status e formato do cartão inteiros (nenhum chip cortado nas duas demos) | varre-cheia/w-g-gestor |
| 03 | Demandas | FEITO | Recortes com contagem, chips, grupo com traço, menu Colunas. Fora da lista: "limpar tudo" ainda é texto clicável | varre-cheia/w-g-demandas |
| 04 | Agenda e captações | FEITO | Mês a 1110 com 94 compromissos: 0 cortado, 0 reticências, letra 10,5 px, "+N outras" é botão; Semana: dias presos abaixo da barra ao rolar (cabeça em 258–356 com a página e a grade roladas); data comemorativa quebra dentro da coluna. Ressalvas: no WebKit palavra quebra sem hífen ("demonstraçã/o", "Empreend/edora"); no Mês rolado, os números do dia aparecem no vão acima da barra presa | agenda/w-m-cheia-mes-meio, w-m-cheia-semana-rolada |
| 05 | Gestão de clientes | FEITO | Aviso só do que pede ação ("Completar"), chips, alternador, colunas no menu | varre-cheia/w-g-clientes |
| 06 | Gaveta | FEITO | Um X, campos no topo, "Sem briefing" primeiro, Comentar/Passar bastão acima do dock. Esc com a gaveta (clique de verdade: título → cartão → "Abrir a peça") fecha só a gaveta; o 2º Esc fecha o Painel | esc-w-g-cheia-gestor-* |
| 07 | Cartão rápido | FEITO | Clique de verdade no título: cartão em x 356–686 (à direita do dock), 4 campos, "Abrir a peça" principal. (Por `el.click()` sintético ele cai em 0,0 atrás do dock — só no script) | esc-w-g-cheia-gestor-cartao |
| 08 | Criar | FEITO | "Etapa 1 de 5 · Onde", calendário sazonal junto, sem "Cadastro rápido", sem desfoque | extra/w-g-cheia-criar-1, -2 |
| 09 | Busca e janelas | FEITO | Busca vazia com atalhos, resultados com cor, sem rodapé de contagem; abrir o sino fecha a busca | extra/w-g-cheia-busca-* |
| 10 | Diário | FEITO | (o gráfico de estado depende do que o registro guarda — dito pela frente) | varre-cheia/w-g-diario |
| 11 | Automações | FEITO | Regras primeiro, Falhas em aba, "Mais", ⓘ da prioridade | varre-cheia/w-g-automacoes |
| 12 | IA e custos | FEITO | Números numa linha, vazio único, sem "tokens" | varre-cheia/w-g-ai-usage |
| 13 | Conta e equipe | FEITO | Menu à esquerda dentro da janela, divisória até o fim, dados em rótulo \| valor, WhatsApp numa linha. Item ativo laranja-claro: FORA (o 60 manda) | varre-cheia/w-g-conta |
| 14 | Pente-fino | FEITO | Esc com o menu de status fecha só o menu (Demandas, clique de verdade); lote claro acima do dock (742–788, dock em 813); sem frase quebrada; dock aceso certo | extra/w-g-cheia-menu-status, -lote |
| 15 | Visões gerais | FEITO | Pede ação primeiro, números numa linha, fundo sólido | varre-cheia/w-g-setor_* |
| 16 | Aprovação e Projetos | FEITO | Barra por cliente; Projetos com um vazio | lado/q16 |
| 17 | Fornecedores, Impressões, Creators | FEITO\* | Títulos, etapas, ação no cabeçalho; botão de Creators depende de `pode.editar_comercial` (código `vybe-mundo-comercial.js:696/932`) | lado/q17 |
| 18 | Carteira, Contratos, Churn, Onboarding | FEITO | Números numa linha, ⓘ, Mensal/Anual só onde muda, esteira | lado/q18 |
| 19 | Funil, Pacotes, Orçamentos | FEITO | Funil em colunas, títulos do dock, Novo lead/Novo pacote. Fora da lista: Orçamentos sem pacote não tem botão (só o texto "os donos cadastram na aba Pacotes") e repete "Orçamentos" no corpo | varre-cheia/w-g-orcamentos |
| 20 | Finanças | **PELA METADE** | Contas: feito. **Recebimentos**: 4 cartões de "—" (item 4) e "Novo recebimento" duas vezes, na barra da seção e no vazio, não no cabeçalho (item 3). **Inadimplência**: 4 cartões ("—", 0, 0, 0) (item 4) | folha-20 |
| 21 | RH e Academy | FEITO | | varre-cheia/w-g-recrutamento, -academy |
| 22 | Equipe online | FEITO | | varre-cheia/w-g-equipe |
| 23 | Menus, lote, balões | FEITO | Status com o atual marcado, sem Nova etiqueta/Ordem; Responsável com "Buscar pessoa"; Esc fecha só o menu; lote claro com "Mais". Fora da lista: para quem gere etiquetas, cada status tem uma chave liga/desliga laranja (`chaveDaEtiquetaHtml`, vybe-agenda.js:1740) — o "Depois" mostra só as escolhas | zoom-status.png |
| 24 | Planejamento: documento | FEITO | Trilha das etapas, ações em ícone. Fora da lista: o escolhedor escuro "Como você quer revisar?" (de 21/10) abre por cima do documento | extra/w-g-cheia-plj-doc |
| 25 | Planejamento: editor | FEITO | Menu claro, "pedido" marcado, barra numa linha, sem campo nativo | extra/w-g-cheia-plj-editor |
| 26 | Aprovação do cliente | FEITO\* | Pelo código e 8 testes: `<video controls playsinline>` com a duração (`loadedmetadata`), galeria "1 de N", sem arte não há botão (`TEXTO_SEM_ARTE`), "1 de 3 vistas" no topo, Aprovar verde (#11613A), logo (`LOGO_VYBE`), "Aprovar todas as vistas" no fim (transação; o resto volta com motivo), vídeo por Range/206. **Só com a migração aplicada**; sem ela: "respondidas" e "Aprovar todas" | — |
| 27 | Prévia | FEITO | Fundo escuro só na mídia, ficha clara ao lado, "peça 1 de 5", "Ainda sem material" + "Entregar material" | extra/w-g-cheia-previa |
| 28 | Celular: gaveta e docks | FEITO | Gaveta de tela cheia, um X, Comentar/Passar bastão acima da barra (sobra do aviso: ver 29) | aviso/w-c-cheia-gaveta-musica |
| 29 | Diagnóstico | **PELA METADE** | Regra 4 (tudo voxel): a Loja ainda mostra arte do Habbo (ver 35). Regra 6 (aviso não cobre botão): no celular o aviso fica ~8 s acima da barra **por cima de controles**: Painel "Veiculação", "Prazo", "Mais filtros" 100% e "Pessoa"/"Status" 43%; Clientes, linhas e "Marcar" de 3 clientes; Hoje, cartões "Atrasadas"/"Risco de furo" 62%; gaveta, "Arquivo"/"Link" 39%. No computador: 0 controle coberto (Gaveta, Clientes, Minha sala, Jogos) | aviso/w-c-cheia-*, run-aviso-webkit-c.log |
| 30 | Botões e controles | FEITO | Nova reunião com a seta do padrão nos dois menus e ícone desenhado na data; calendário do painel abre e grava. Fora da lista: "limpar tudo" (Demandas) ainda é texto | dica/w-g-cheia-reuniao-calendario |
| 31 | Hoje | FEITO | | varre-cheia/w-g-hoje |
| 32 | Cidade e HUD | FEITO | Pinos com nome inteiro na tela a 390. Ressalva: no celular os rótulos ficam sob os controles do mapa e sob a legenda ("Experimente Papelaria", "Hebravet", "DiaCenter") | folha-pinos |
| 33 | Prédio | FEITO | Idem: "Gonzalez · 1 atrasada" sob o elevador e os controles a 390 | folha-pinos |
| 34 | Minha sala | FEITO | Sala inteira em voxel (nenhuma peça com cara de Habbo na foto, 1440/1110/390), Hoje estreito, faixa da sala, Convidar e Decorar; Decorar com ícones voxel ("Guardados" e "Na sala 27"), 0 imagem do Habbo à vista | jogo/w-g-cheia-minha-sala, -decorar |
| 35 | Loja | **PELA METADE** | Item 1: depois de esperar e rolar, ícones do Habbo à vista: Móveis 7/120, Decoração 10/129, Ambientes 8/120, **Construção 50/138**, Estilos 22/120 (Destaques, Vitrine e Catálogo Vybe: 0); em Construção muitos ficam como quadrado vazio por segundos e depois viram a arte do Habbo. Item 2: nomes em inglês ("Body Scanner", "Caterpillar", "Assento Gum Drop", "Banheira Fragrant", "Balanço Dove", "Bancada Survivor", "Cerca de palco Multicoloured", "De chuva soaked Windows", "Baú do mar Locked", "Balão em miniatura Air quente"). Itens 3 e 4: feitos | jogo/w-g-cheia-loja-moveis, w-g-scan-Constru_o, loja-scan-webkit-g.json |
| 36 | Ranking | FEITO | | varre-cheia/w-g-ranking |
| 37 | Conquistas | FEITO | Troféus, estante e medalhas em voxel | jogo/w-g-cheia-conquistas |
| 38 | Jogos e Equipe | FEITO | | varre-cheia/w-g-jogos |
| 39 | Toolkit | FEITO | | varre-cheia/w-g-toolkit, -qr |
| 40 | Academy | FEITO\* | "Nova trilha" só para gestão (código) | varre-cheia/w-g-academy |
| 41 | Sino | FEITO | | extra/w-g-cheia-avisos |
| 42 | Conversa e Notas | FEITO | | extra/w-g-cheia-notas, -conversa |
| 43 | Camadas | FEITO | | extra/w-g-cheia-camadas-pros |
| 44 | TV e Música | FEITO | TV sem fundo desfocado, alternador, Desligar à esquerda; Música oferece "Entrar no Lounge". Clipe no alto: TV desligada na demo | extra/w-g-cheia-dock-TV, -Musica |
| 45 | Avisos curtos | FEITO | Um desenho, ícone neutro; Música some em 6 s com o mouse (computador) | aviso/ |
| 46 | Menus do topo | FEITO | Quem você é + saldo no alto, Aparência em alternador | extra/w-g-cheia-conta-menu |
| 47 | Celular | FEITO | Topo com 3, barra com Criar no meio, 0 rolagem lateral em 49 telas × 2 motores × 2 demos | varre*/?-c-* |
| 48 | Planejamentos | FEITO | | varre-cheia/w-g-planejamentos |
| 49 | Fornecedores e Creators | FEITO\* | Idem 17 | varre-cheia/w-g-fornecedores |
| 50 | Gestão de clientes | FEITO | | varre-cheia/w-g-clientes |
| 51 | Ficha | FEITO | | extra/w-g-cheia-ficha-geral |
| 52 | Ecossistema | FEITO | | extra/w-g-cheia-ficha-ecossistema |
| 53 | Cérebro na ficha | FEITO | Sem Claude/Qwen/conector/código de cor no texto | extra/w-g-cheia-ficha-cerebro |
| 54 | Sinapses | FEITO | Fontes no português ("Fichas dos clientes", "o VYBES só lê"), "De onde vem cada coisa", "Ver o diagnóstico em Agentes"; estudo de Alpha1 com selo Qwen, data e "Consultar de novo" ("Refazer" não existe na central, como antes) | extra/w-g-cheia-sinapses, -sinapses-alpha1 |
| 55 | Mapa do Cérebro | FEITO | | extra/w-g-cheia-mapa |
| 56 | Avisos de ativação | FEITO | | varre-cheia/w-g-onboarding |
| 57 | Comercial visão geral | FEITO | | varre-cheia/w-g-setor_comercial |
| 58 | Funil | FEITO | | varre-cheia/w-g-funil |
| 59 | Finanças por cliente | FEITO | | varre-cheia/w-g-financas |
| 60 | Conta e equipe | FEITO | "Novo colaborador" a 23 px da caixa | run-caixa-webkit-g.log |
| 61 | RH pedidos e calendário | FEITO | | varre-cheia/w-g-rh |
| 62 | Agentes | FEITO | | extra/w-g-cheia-agentes |
| 63 | Página do agente | FEITO\* | Retrato voxel, gráfico laranja; "Dar autonomia" só com a central real (código). Fora da lista: achados com faixa vermelha na borda | extra/w-g-cheia-agente-pagina |
| 64 | Criar | FEITO | | extra/w-g-cheia-criar-* |
| 65 | Cartão da captação | FEITO | Apagar à esquerda, Trocar cliente botão, peças listadas | extra/w-g-cheia-captacao-cartao |
| 66 | Busca, Ajuda, Boletim | FEITO | "Nova" lilás: FORA (decisão do Paulo, fica) | extra/w-g-cheia-ajuda, -boletim |

## Varredura (B)

55 entradas do dock × 2 motores × 3 tamanhos × 2 demos = 660 passadas (Clientes e Minha sala no Chromium cheio refeitos à parte,
o Playwright perdeu a promessa; na segunda vez abriram sem nada).

| Verificação | Resultado |
|---|---|
| Erro de script (`pageerror`) | 0, fora 1 "ResizeObserver loop completed…" (WebKit 1110, Minhas tarefas, benigno) |
| `console.error` / 4xx depois do login | **Novo:** demo vazia, Loja: 15 respostas 404 `/api/painel?area=escritorio&acao=arte&arquivo=<móvel>.json` (ex.: `hween_c24_neonpumpkinwitch2`, `garden_staringbush`, `greek_r19_tiledbath`) e Ranking 1 (`trophy_torch.json`). É o retrato voxel pedindo uma arte que não está na pasta; a peça cai na imagem do Habbo (ver 35). Na rodada 3 era 0 |
| Rolagem lateral | 0 em 660 |
| Tela que não abriu | 0 |
| Atrás do dock (computador) / da barra (celular) no fim da rolagem | 0 |
| Janela por cima do dock | só os modais com fundo (Nova reunião, Ranking, Conquistas; a Loja no celular), como antes |
| Janela translúcida | nenhuma janela de trabalho. `#mundo-moldura` tem `backdrop-filter` mas fundo alfa 1 (sem efeito). Hoje e painel do cliente sobre o 3D seguem em vidro (0,62/0,8), como sempre |
| Cortado | nenhum botão/chip/título cortado (o título das peças no Painel passa 3 px, sem reticência visível). Rótulos de pino sob controles a 390 (32/33) |

## Quarta rodada (C)

| Item | Nota | Medida |
|---|---|---|
| Telas antigas abrindo como as novas: tempo | **PELA METADE no WebKit** | Clique de verdade no dock até a tela parada (inclui a entrada de 420 ms), mediana de 3, demo cheia 1440. **Chromium**: Painel 628, Demandas 502, Agenda 764, Clientes 560, Diário 500, IA 481, Automações 486, Conta 486 × Projetos 553, Carteira 523 — igual às novas. **WebKit (Safari)**: Painel **848**, Clientes 778, Agenda 719, Demandas 662, Conta 610, Diário 597, IA 596, Automações 567 × **Projetos 424**, Carteira 471. A animação é a mesma (`vv-janela-desliza` 420 ms × `vv-janela` 420 ms); o que muda é quando ela começa: ~370 ms depois do clique no Painel, ~150–250 nas outras antigas, ~0 em Projetos. Melhorou muito (a frente mediu 844 → 388 pela métrica dela), mas no Safari o Painel ainda leva o dobro de Projetos |
| Sem piscar o Painel | FEITO | nenhum quadro com o cabeçalho do Painel visível ao abrir Demandas, Agenda, Clientes, Diário, IA, Automações e Conta |
| Fundo bege | FEITO | entre o dock e a janela: `rgb(239,235,228)` em todos os quadros, antigas e novas, nos dois motores; nenhum céu azul |
| Esc com gaveta | FEITO | Painel (WebKit 1440): 1º Esc fecha só a gaveta, 2º fecha o Painel |
| Ícones voxel: Loja/inventário/Decorar/Conquistas | **PELA METADE** | Inventário, Decorar, Conquistas, Ranking, Destaques/Vitrine/Catálogo Vybe: 100% voxel. Móveis, Decoração, Ambientes, Construção e Estilos: 6% a 36% na arte do Habbo (35) |
| Loja/Decorar no celular sem o Escritório | FEITO | Loja aberta direto (Escritório não carregado): abre, pede a base sozinha, ícones em ~9,5 s (demo; ~5 s com "Carregando a loja…" numa seção e dois ícones do Habbo por um instante antes do voxel). Decorar: ícones voxel em 3,7 s, sem "Sala livre" nem "Monte o seu quarto" |
| Minha sala sem peça com cara de Habbo | FEITO | foto a 1440/1110/390 |
| Dica "Tela de trabalho" | FEITO | Forçada nas 8 antigas × 3 tamanhos (WebKit, cheia): nenhum controle à vista sob o balão (a medida acusa itens dos menus "Modos"/"Mais", que estão escondidos; conferido na foto). No celular, em Agenda e Clientes fica sobre o título, como a frente descreveu. As dicas grandes ("Gestor", "Agenda da Produção", "Clientes") ainda cobrem controles (ex.: "Ações de 12/11", "Adicionar atividade") — não são a "Tela de trabalho" |
| Agenda Mês a 1110 / dias fixos | FEITO | ver 04 |
| Nova reunião | FEITO | um cabeçalho (título + frase + X, sem "Vybe OS · Reunião"), ícone desenhado, `.vcal` claro dentro da tela |
| Conta | FEITO | ver 13 |
| Sinapses | FEITO | ver 54 |
| Plurais | FEITO | 0 achado; "1 aberta", "0 de 1 feita", "0 de 1 prevista pronta" corrigidos |

## Regressões (D)

Nenhuma tela quebrou, nenhuma ação deixou de funcionar, nada saiu da tela. Novos nesta rodada:

1. Console com 404 na Loja e no Ranking (demo vazia), do retrato voxel pedindo arte que não existe na pasta (`server/escritorio.js:376`, `enviarArteEscritorio`).
2. Loja no celular: dois ícones do Habbo aparecem por ~1 s antes do voxel.

Já existiam e continuam (acabamento): aviso no celular por cima de controles (29); pinos sob controles a 390; WebKit quebra
palavra sem hífen; no Mês rolado os números do dia aparecem acima da barra presa; "limpar tudo" texto clicável; chaves
liga/desliga no menu de status (gestão); o painel Decorar cobre a ponta direita da barra do topo (WhatsApp, Boletim, sino, conta)
enquanto está aberto; botão "+" flutuante da Agenda no celular sobre o domingo do Mês.

## Causa provável do que falta

| Defeito | Onde |
|---|---|
| Recebimentos: 4 cartões e "Novo recebimento" duas vezes | `vybe-mundo-comercial.js:566-577` (`kpi(...)` × 4, `botaoNovo('Novo recebimento')` na seção + `vazio(…, 'Novo recebimento')`); Contas já usa a linha de resumo |
| Inadimplência: 4 cartões | `vybe-mundo-comercial.js:624` e `:634` (`kpi('Em atraso'…)`, `kpi('Críticos (+30 dias)'…)`) |
| Loja com arte do Habbo | `retratoDoMovel` sem a arte `.json` da peça (404 em `acao=arte`) cai no `<img src="https://www.habboassets.com/…">` de `vybe-escritorio-loja.js:171/198`; famílias de `mundo/moveis-familias.mjs` não cobrem Construção (janelas, divisórias, cercas) |
| Nomes em inglês | tradução do catálogo (palavras de linha do Habbo: Gum Drop, Fragrant, Dove, Survivor, Multicoloured, Locked, soaked Windows, Body Scanner, Caterpillar) |
| Aviso do celular sobre controles | `ajustarAvisosCurtos` (vybe-core.js), ramo `W <= 600`: sempre acima da barra, mesmo cobrindo botão |
| Safari: antigas mais lentas | primeira pintura das antigas ainda espera a troca de classe do body e o desenho do módulo (Painel: ~370 ms antes da entrada começar) |

## Veredito

**Pode publicar.** Nada bloqueia: 660 passadas sem erro de script, sem rolagem lateral, nada atrás do dock ou da barra, nenhuma
janela translúcida, nenhuma tela quebrada; as quatro frentes fazem o que dizem, com exceção da Loja. Para a página do cliente
(26), aplicar a migração `2026-11-11-aprovacao-vistas.sql` junto da publicação (sem ela a página funciona, mas sem "vistas").

**Mas não é verdade que o moodboard está inteiro feito:** 64 de 68. Pela metade, em ordem de conserto:

1. **35/29 Loja**: arte do Habbo em parte do catálogo (Construção 36%) e nomes em inglês.
2. **20/00 Main**: Recebimentos e Inadimplência ainda com os 4 cartões de "—"/0 e o botão de criar duplicado.
3. **29**: aviso curto no celular cobre controles por ~8 s.
4. (acabamento, fora dos 68) no Safari o Painel de trabalho ainda abre em ~0,85 s contra ~0,42 s de Projetos pontuais.
