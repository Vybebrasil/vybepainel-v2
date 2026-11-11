# Re-auditoria da 2ª rodada × branch `codex/redesign-fase2-resto` (accecadc) — 10/11/2026, noite

- Código: começou em `21d3054a` e terminou em `accecadc` ("Revert Merge branch 'codex/r2-moveis'"): no meio da auditoria a frente
  de móveis saiu do branch por decisão do Paulo. Tudo o que é Minha sala, Loja e Decorar foi refeito depois da reversão.
- Auditor independente (não participou das frentes). Só leitura do produto; este arquivo é a única coisa escrita no repo.
- Demo local na porta 4465 (encerrada no fim), senha demo-local, `souDonoDaSessao` forçado onde a tela é de dono.
- Motores e tamanhos: Chromium (build 1234) e WebKit, em 1440×900, 1110×650 e 390×844.
- Fotos e medidas: `C:/Users/pichau/AppData/Local/Temp/claude/a620ea75f3634c99/d71683a7-2ed3-47b7-9ff3-858e4e30c1bb/scratchpad/aud2/fotos/`
  (`varre/` = varredura, nome `<motor>-<tamanho>-<tela>.png` com `c`/`w` = Chromium/WebKit e `g`/`m`/`c` = 1440/1110/390;
  `mobfim/` = fim da rolagem no celular; na raiz, as fotos por quadro). Os `.json` e `.mjs` na pasta acima de `fotos/`.
- Critério igual ao da re-auditoria anterior: FEITO = todo item na tela; PELA METADE = falta item, dito qual; FORA = fora por
  decisão do Paulo ou por razão da frente.

## O que NÃO foi conferido (para ninguém ler isto como garantia total)

- `npm run check` não foi rodado por mim depois da reversão (`accecadc`). O "1773 testes" vale para `21d3054a`.
- A demo tem dados fictícios e quase tudo vazio: estados cheios (funil com leads, contas lançadas, contratos com valor,
  impressões em etapas) não foram vistos.
- Não reabri: 07 cartão rápido, 24/25/27 planejamento e prévia, 26 página de aprovação do cliente (nada mudou nelas nesta rodada).
- Celular é emulação (viewport de 390 no Chromium e no WebKit de computador), não um iPhone.
- A varredura clica o dock por script. O que dependia de clique de verdade (aviso curto, dock aceso) foi refeito com o mouse.
- Menu da conta: a dica de primeira vez roubou o foco na medida; a busca por contorno lilás na tela inteira não achou nenhum.

## Contagem

Dos 18 quadros que estavam pela metade:

| Situação | Qtd | Quadros |
|---|---|---|
| FEITO | 11 | 01, 06, 13, 20, 23, 28, 30, 32, 54, 59, 60 |
| PELA METADE | 5 | 00 Main, 00 Sistema, 04, 18, 29 |
| FORA | 2 | 26 (sem rota em lote, como antes), 34 (item 4, decisão do Paulo nesta rodada) |

Somando com os 50 que já estavam feitos: **61 FEITO, 5 PELA METADE, 2 FORA**. Nenhum dos 50 regrediu na amostra (seção E).

## A) Varredura das telas do dock

55 entradas do dock (as 50 telas mais as 5 visões gerais de setor) × 2 motores × 3 tamanhos = 330 passadas.

| Verificação | Resultado |
|---|---|
| Erro de script (`pageerror`) | 0 em 330 |
| `console.error` | 0 depois do login (antes do login há 5 respostas 401, da tela de entrada) |
| Rolagem lateral | 0 em 330 |
| Tela que não abriu | 0 |
| Telas 3D repetidas depois da reversão (Centro, Prédio, Minha sala, Loja, Ranking, Conquistas) | 0 erro nos 2 motores e 3 tamanhos |
| Janela por cima do dock (computador) | nenhuma. Loja, Ranking, Conquistas e Nova reunião são modais com fundo: o dock fica atrás do fundo, por desenho |
| Conteúdo atrás do dock no fim da rolagem (computador) | nenhum |
| Conteúdo atrás da barra no fim da rolagem (celular) | 9 telas, ver D5 |
| Janela translúcida | Busca, Criar e gaveta: sólidas. Restam com 0,97 + desfoque: `.vv-gestao` (Gestão › Visão geral, Performance) e `.vv-setor-visao` (visão geral de Produção, Clientes, Comercial, Finanças, RH). Não vi texto vazando nas fotos (o Hoje some por trás), mas a regra pede sólido. Hoje e painel do cliente sobre o 3D seguem em vidro (0,62 e 0,8), como já eram |
| Cortado | Agenda › Mês (reticências, ver 04); rótulos dos pinos saindo da tela no Centro e no Prédio a 390 ("DiaLab · em dia" de -34 a 82) |

## B) Os 18 quadros, item a item

| Quadro | Tela | Situação | O que foi medido / o que falta | Foto |
|---|---|---|---|---|
| 00 Main | Regras gerais | PELA METADE | Feito: zeros em linha discreta no Hoje, no Recrutamento e no painel do cliente na Cidade; rótulo de setor saiu de todos os títulos; "1 peça em aberto" no elevador; "Ver o achado" nos Agentes. Falta: (a) Saúde da carteira ainda tem cartões com "0" grande (Risco alto, Risco médio); (b) dois cabeçalhos fora do padrão: Agenda (h3 de 28 px, recuo de 80 px, sem frase) e Conta ("Perfil"/"Equipe" em 28 px); (c) três plurais errados novos: "1 peças, paradas há 0 dias" (Visão geral da Produção › Onde trava), "1 falhas" (Agentes › Como o VYBES pensa, fila do Qwen), "1 demandas a alterar" (barra do lote nas Demandas) | varre/w-g-setor_producao, w-g-18-carteira, w-g-54-agentes-como-pensa, w-g-23-lote-responsavel |
| 00 Sistema | Peças do depois | PELA METADE | Feito: X sempre em caixa com borda (34 ou 36 px), título de 22 px/700 em 40 das telas medidas, período do Ranking em laranja (fundo rgb 255,237,226, texto 194,73,12). Falta: a caixa fica em três lugares (16/12 px do canto nas telas antigas, 17/17 a 17/24 nas novas, 23/19 nas visões gerais; Planejamentos 41/55) e o título começa em 23/19 nas novas e 48/30 a 48/48 nas antigas; a ação do cabeçalho entra na caixa ⛶/X no Painel (5 px) e em Conta › Equipe (8 px). "A Fazer" cinza é a cor do catálogo (fora) | w-g-01-barra-pendentes, w-g-60-conta-equipe, w-g-cab-* |
| 01 | Painel de trabalho | FEITO | Barra em 1 linha a 1440 nos dois motores (altura 38 px, um só meio em y=234), sem filtro e com filtro. Com filtro ligado, Veiculação/Prazo entra em "Mais filtros" e aparece "Limpar filtros". A 1110 são 2 linhas (82 px), fora do pedido. Setas dos chips na linha do texto. Ressalva: "+ Novo conteúdo" encosta 5 px na caixa ⛶ | w-g-01-barra-sem-filtro, -pendentes, c-g-01-* |
| 04 | Agenda e captações | PELA METADE | Feito na Semana e no Dia: 11 eventos, fundo branco, só o traço na cor, nenhum texto cortado no WebKit ("Cliente demonstração 09:00–11:00 · 2 peças" inteiro). Falta: (a) na vista Mês os eventos seguem com reticências ("10:00 Cliente B (…", "09:30 Reunião d…", "Proclamação da R…") e dois têm fundo tingido (verde e vermelho); (b) evento estreito lado a lado (64 px) perde o horário, e no Chromium a 1110 o título corta em altura (52 de 65 px); (c) o cabeçalho não entrou no padrão | w-g-04-agenda-semana, w-g-04-agenda-mes, c-m-04-agenda-semana |
| 06 | Gaveta da demanda | FEITO | Com clique de verdade o aviso da Música some em 6,0 s (5,9 a 6,1 nos dois motores, 1440 e 1110). A 1440 ele vai para a esquerda da gaveta (x 314–654; gaveta 668–1428) e não cobre nenhum controle. Gaveta sólida (rgb 250,248,244). Ressalvas em D3 (1110) e nos defeitos (dois X) | w-g-06-gaveta-com-aviso, w-g-aviso-musica-mouse-gaveta |
| 13 | Conta e equipe (fase 2) | FEITO | A conta é a própria janela: menu à esquerda com linha divisória, conteúdo à direita, sem cartão sobre cartão. Item ativo laranja-claro: FORA (o 60 manda). Sobra muito vazio à direita e a divisória para em y=612 | w-g-13-conta |
| 18 | Carteira, Contratos, Churn, Onboarding | PELA METADE | Contratos feito: sem Mensal/Anual, sem gráfico de zeros ("Ainda sem histórico para mostrar"), explicação no ⓘ (balão de 340 px, texto escuro em fundo branco). Falta o mesmo no Churn: Mensal/Anual numa tela sem nenhuma saída e parágrafo técnico no rodapé ("Saída = desativação no cadastro (a data do registro de churn…)", "cohort"). Saúde: título "Saúde", o dock diz "Saúde da carteira" | w-g-18-contratos, w-g-18-churn, w-g-18-carteira |
| 20 | Contas a pagar | FEITO | "Nova conta" no cabeçalho com a lista vazia (x=1198, y=36); o vazio só aponta para o botão do alto | w-g-20-contas |
| 23 | Menus, lote, balões | FEITO | Menu de status sem "Nova etiqueta" e sem "Ordem" (só as escolhas, atual marcado, Esc fecha só o menu). Menu do grupo com a seção "Etiquetas de status": "Nova etiqueta…" e "Ordem das etiquetas…". Responsável em lote com busca ("Buscar pessoa", filtra ao digitar). Barra do lote clara, acima do dock | w-g-23-menu-status-gestor, w-g-23-menu-grupo, w-g-23-lote-responsavel |
| 26 | Aprovação do cliente | FORA | Sem mudança: não há rota para "aprovar todas" nem registro de "vista". Não reaberta | — |
| 28 | Celular: gaveta e docks | FEITO | Gaveta de 0,0 a 390,844, sólida, barra de baixo por cima (772–836), Comentar e Passar bastão em 713–755 e descobertos, nada da gaveta atrás da barra no fim da rolagem, tocar na barra fecha. Igual nos dois motores. Ressalva: o aviso do WhatsApp aparece no meio da gaveta (D3) | w-c-28-gaveta, w-c-28-gaveta-fim |
| 29 | Diagnóstico do sistema | PELA METADE | Regra 2: Loja fora do dock lateral (feito); cabeçalhos ainda com diferenças (00 Sistema). Regra 4: FORA (Paulo). Regra 6: o aviso não cobre mais X nem tela cheia, mas cobre o campo "Buscar cliente" inteiro nos Clientes, 44% de Convidar e Decorar na Minha sala e o dock lateral a 1110 | w-g-av-clientes-1s, w-g-av-minha-sala-1s |
| 30 | Botões e controles | FEITO | "Ver o que falta" é botão em Funil, Contas, Finanças, Contratos e Onboarding (118×28 ou 34, com borda); "Atualizar" do cérebro é botão; "Abrir a semana" é botão; mês do Recrutamento no seletor de período; nenhum campo nativo visível nessas telas. Achado fora da lista anterior: "Nova reunião" usa `input type=date` | w-g-30-recrutamento, w-g-30-ficha-cerebro |
| 32 | Cidade e HUD | FEITO | Hoje de 340 px sobre o 3D com "Agenda de hoje · 14h · Captação"; zeros numa linha; painel do cliente com zeros discretos e "Abrir o cliente" | w-g-32-cidade, w-g-32-cidade-hoje-agenda, w-g-32-cidade-painel-cliente |
| 34 | Minha sala | FORA | Item 4 fora por decisão do Paulo (frente revertida). Depois da reversão: sala, Decorar e Loja abrem sem erro nos dois motores; Hoje estreito, faixa da sala, Convidar e Decorar no lugar | w-g-34-minha-sala, w-g-34-decorar |
| 54 | Sinapses | FEITO | A Sinapses ficou com o estudo, o selo Qwen e "De onde vem cada coisa"; o diagnóstico abre em Agentes › "Como o VYBES pensa" pelo botão, com o dock aceso em Agentes. "Refazer o estudo": FORA como antes. Sobra: "Fichas .md dos clientes" e "(só leitura)" na lista de fontes | w-g-54-sinapses, w-g-54-agentes-como-pensa |
| 59 | Finanças por cliente | FEITO | Tabela de 6 colunas, 15 linhas com "sem contrato", totais e contagens no rodapé da tabela; aviso sem nome de sistema | w-g-59-financas, w-g-59-financas-fim |
| 60 | Conta e equipe | FEITO | Menu lateral da página, linhas da equipe dentro da largura, "Definir senha" + "Mais". Defeito novo: "Novo colaborador" entra 8 px na caixa ⛶/X | w-g-60-conta-equipe |

## C) Os 8 defeitos do conjunto

| # | Defeito | Situação | Medida |
|---|---|---|---|
| 1 | Aviso curto não some e cobre janela | FEITO, com sobras | Some em 6,0 s com clique de mouse. Não cobre mais X, tela cheia nem os botões da gaveta. Sobras em D3. Quando o último gesto foi de teclado, o foco no botão do aviso o segura (escolha da frente): medi 13,5 s parado nesse caso |
| 2 | Janelas translúcidas | FEITO | Busca rgb(251,250,247), Criar rgb(250,248,244), gaveta rgb(250,248,244), todas sem desfoque, em 1440 e 390. Sobram as visões gerais em 0,97 (seção A) |
| 3 | Gaveta no celular não cobre a tela | FEITO | Ver 28 |
| 4 | Loja cobre o dock lateral | FEITO | Loja começa em x=268 (Chromium) e 275 (WebKit) a 1440 e em 244 a 1110; o dock termina em 230 |
| 5 | Anel lilás no WebKit | FEITO | Nenhum contorno lilás no menu da conta, em Camadas, no painel do cliente e na caixa ⛶/X. Pelo teclado o anel é laranja (3 px, rgba 255,122,47,0,22) |
| 6 | Ajuda com contorno laranja grosso | FEITO | Nenhum elemento da Ajuda com contorno ou borda de 2 px ou mais |
| 7 | Faixa do Hoje sob a Equipe online | FEITO | A janela termina em 806 como as outras (dock em 813) |
| 8 | Textos e chips | PELA METADE | Feito: elevador, Agentes, chips das Conquistas em 2 linhas sem corte, setas dos chips. Novo: os três plurais do 00 Main |

## D) Pontos de atenção

1. **Loja e Decorar**: pulado por ordem do coordenador. Só conferido que abrem sem erro.
2. **Cabeçalho único**: Funil, Pacotes, Contratos, Saúde, Onboarding, Fornecedores e Gestão estão coerentes entre si (22 px, sem rótulo,
   X em caixa). Diferenças visíveis: Conta em 28 px e Agenda em 28 px com outro recuo e sem frase; a ação do cabeçalho encosta na
   caixa ⛶/X no Painel e em Conta › Equipe.
3. **Aviso curto**:
   - 1110 com a gaveta aberta: confirmado. O aviso fica em x 14–324 (WebKit) ou 14–294 (Chromium), y 150–318, sobre 216×168 px do dock
     lateral, cobrindo 6 itens (Produção, Visão geral, Painel de trabalho, Minhas tarefas, Demandas, Projetos pontuais) por 6 s.
   - 1440: não cobre controle de janela e some em 6 s. Cobre "Buscar cliente" nos Clientes (100%) e parte de "Completar" e "Colunas";
     na Minha sala cobre 44% de Convidar e de Decorar.
   - 390: o aviso do WhatsApp aparece no meio da tela (y 400–515 no QR Code, 465–595 na gaveta), por cima do conteúdo.
4. **Barra do Painel**: 1 linha a 1440 nos dois motores, com e sem filtro.
5. **Celular, fim da rolagem atrás da barra (772–836)**, igual nos dois motores:
   - com botão ou linha clicável escondida: **QR Code** ("Baixar PNG" e "Baixar SVG" em 773–807, inalcançáveis), **Agentes** (último
     "Ver o achado" em 761–789), **Conversas** (última conversa em 735–793);
   - só texto: Saúde da carteira (até 806), Churn (779), Gestão › Visão geral (792), Performance (792), Toolkit › Visão geral (792),
     Pedidos e calendário (787).
   - Contratos, citado pela frente: no fim da rolagem não ficou nada atrás da barra. As telas antigas (Painel, Demandas, Clientes,
     Agenda, Conta) terminam acima dela. A gaveta em tela cheia está certa.
6. **"Como o VYBES pensa" para quem não é dono**: o dock mostra Agentes trancado ("Só os donos veem"); o clique dá o aviso "Só os
   donos veem esta área." e não abre. Na Sinapses não aparece o botão e o texto diz que o diagnóstico "fica na página Agentes, que é
   dos donos". Chamar `VybeAgentes.abrirCerebro()` direto também é barrado. Nenhum dado do diagnóstico vaza.
7. **Menus**: ver 23. Feito.
8. **Minha sala**: pulado por ordem do coordenador.

## E) Regressões

Amostra das telas dadas como feitas (Hoje, Painel, Demandas, Agenda, Clientes, ficha do cliente, Cidade, Minha sala, Ranking,
Conquistas, Toolkit, Agentes), nos dois motores: nenhuma quebrou, nenhum erro de script, dock aceso certo com clique de verdade.

Pioraram ou são novos nesta rodada:

1. Ação do cabeçalho encostando na caixa ⛶/X (Painel 5 px, Conta › Equipe 8 px). Antes os dois ícones não tinham caixa.
2. Aviso sobre o dock lateral a 1110 com a gaveta aberta.
3. Aviso no meio da tela no celular.
4. Plurais "1 falhas" e "1 demandas a alterar" (textos novos ou tocados nesta rodada).

Já existiam e continuam (não são desta rodada):

1. Dois X sobre a gaveta: a caixa ⛶/X da tela de trás fica por cima da gaveta, acima do X dela (agora mais visível, por causa da caixa).
2. Botões do QR Code, último achado dos Agentes e última conversa atrás da barra no celular.
3. Vista Mês da agenda com reticências.
4. A dica "Tela de trabalho" (primeira vez) cobre "Marcar captação" na Agenda.
5. "Nova reunião" com campo de data nativo e o rótulo "Vybe OS · Reunião" em cima do título.

## Causa provável, quando deu para apontar

| Defeito | Onde |
|---|---|
| Aviso sobre o dock a 1110 e no meio da tela a 390 | `ajustarAvisosCurtos` em `vybe-core.js` (ramo `painelSemVaga`, que ignora o `limite` do trilho; no celular a busca de faixa livre desce até o meio) |
| Ação do cabeçalho × caixa ⛶/X | `.vv-canto-modulo` (34 px, a 12 px do topo e 16 px da direita) contra o cabeçalho das telas `body.mundo-modulo` em `vybe-mundo.css` |
| "1 peças, paradas há…" | `vybe-mundo-setor.js:394` (bloco "Onde trava") |
| "1 falhas" | `renderDiagnosticoCerebroHtml` em `vybe-clientes-cerebro.js` (~1681, fila do Qwen) |
| "1 demandas a alterar" | `vybe-agenda.js:2347` (`lote-conta`) |
| Rodapé técnico e Mensal/Anual do Churn | `vybe-mundo-carteira.js:520` |
| Zeros grandes da Saúde | `vybe-mundo-carteira.js:251` |
| Conteúdo atrás da barra no celular | folga de baixo curta em `.vf-corpo` (22 px), `.vga-detalhe` (14 px), `#vv-wa-itens` (6 px), `.vv-gestao` (20 px), `#vc-corpo` (24 px); a barra ocupa 72 px |
| Janelas em 0,97 | `.vv-gestao` e `.vv-setor-visao` em `vybe-mundo.css` |

## Veredito

**Pode publicar.** Não achei defeito que bloqueie: nenhuma tela quebra, nenhum erro de script, nenhuma rolagem lateral, nada da rodada
tira informação nem impede uma ação que antes funcionava.

Acabamento que pode esperar, na ordem em que eu consertaria:

1. Ação do cabeçalho encostando na caixa ⛶/X (Painel e Conta › Equipe).
2. Aviso curto: dock a 1110 com a gaveta, meio da tela no celular, campo de busca dos Clientes.
3. Os três plurais.
4. Folga de baixo no celular (QR Code, Agentes, Conversas e as seis telas só de texto).
5. Churn (rodapé técnico e Mensal/Anual), zeros da Saúde, vista Mês da agenda, cabeçalho da Agenda e da Conta, visões gerais em 0,97.

Antes de publicar, rodar `npm run check` em `accecadc`: não rodei depois da reversão.
