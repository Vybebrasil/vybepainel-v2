# Mundo voxel do Vybe OS: o que foi feito, o que falta e como fazer certo

Documento de passagem (iniciado em 06/11/2026). Qualquer pessoa ou IA que continuar este trabalho deve ler **inteiro** antes de mexer, e atualizar as seções "Feito" e "A fazer" no mesmo commit de cada etapa.

Leia também, nesta ordem:
1. `AGENTS.md` deste repositório (regras de engenharia). Tem uma seção "Mundo voxel" com as decisões principais.
2. `C:\Users\pichau\Desktop\GUIA-VISUAL-E-TECNICO-VALE-AO-VIVO.md`: o guia visual de referência (o "Vale ao Vivo").
3. `C:\Users\pichau\Desktop\Estrutura do Sistema Multi-Agentes - Vybe.docx`: os andares, setores e agentes.
4. No bot (`C:\whatsapp-ia`): `AGENTS.md`, `core/identidade.js`, `core/agentes.js` e `agentes.test.js`.

---

## 1. A ideia, nas palavras do Paulo

- Uma **cara nova e "foda"** para o Vybe OS, sem perder **nenhum** módulo nem função. Tudo continua funcionando como hoje; muda a roupagem.
- **O mapa é o mundo; as interfaces são peças de vidro pousadas nele.** O mundo é Irecê em voxel, com o **Prédio da Vybe** e a **sede de cada cliente**.
- O **VYBES deixa de ser só o "Jarvis das demandas"** e passa a orquestrar a agência inteira. Cada setor do prédio tem um agente, e todos os agentes são **o próprio VYBES** (mesma personalidade, de `core/identidade.js`); muda só o que cada um pode usar.
- **O Habbo vai embora.** O Escritório passa a ser o Prédio da Vybe. Cada andar é um escritório aberto onde todos se veem, e **a voz só liga quando a pessoa entra numa sala** (a de alguém ou um espaço comum).
- Ao clicar num agente, ele aparece trabalhando na mesa dele e o painel mostra **o dia dele**: o que está fazendo, o que fez e o que espera aprovação.
- **A roupagem nova é em TUDO** (Paulo, 06/11/2026): acabou o visual antigo e tudo o que for do Habbo. Cada módulo, janela e aviso ganha o padrão "Vybe Voxel".
- Tudo **local** até o Paulo pedir para publicar.

## 2. Onde está o trabalho

| O quê | Onde |
|---|---|
| Worktree do Vybe OS | `C:\Projetos-Vybe\vybe-os-mundo`, branch `codex/mundo-voxel` (criada a partir de `origin/main` 641a040), ainda sem commit |
| `node_modules` | junção (atalho) para `C:\Projetos-Vybe\vybe-os-planejamento-arraste\node_modules`, porque o checkout principal não tem o three. Não rodar `npm install` sem autorização. |
| Prévia com dados de demonstração | `.claude/launch.json` em `C:\whatsapp-ia`: **vybe-os-mundo** (porta 4450, `DEMO_VOLUME=1`, senha `demo-local`) |
| Prévia com dados reais (só leitura) | **vybe-os-mundo-real** (porta 4451, `VYBE_DEV_UPSTREAM` = produção). O Paulo entra com o login dele; o servidor local bloqueia as escritas. |
| Cérebro (bot) | `C:\whatsapp-ia\core\agentes.js` e `agentes.test.js`. Ainda não está ligado ao `bot.js`. |
| Tentativa anterior (Gemini) | guardada em `arquivo/tentativa-gemini-voxel/`. Não é usada. O original continua fora do Git em `vybe-os/public/voxel`. |

## 3. Arquitetura (não mudar sem motivo)

```
index.html
 ├─ vybe-mundo.css   tokens do kit "Vybe Voxel" + pele do mundo (tudo escopado em body.mundo)
 └─ vybe-mundo.js    camada do mundo: liga/desliga, HUD (trilho, Hoje, Agenda, placas), dados do painel → 3D
       └─ import() sob demanda: /assets/mundo/mundo-3d.js  (o build empacota com o three e põe hash)
             mundo/mundo-3d.mjs   entrada: monta tudo e devolve a API (verCidade, verPredio, focarAndar…)
             mundo/motor.mjs      renderizador, câmera de maquete, controles de mapa, tilt-shift, rótulos HTML, pausa
             mundo/irece.mjs      relevo e ruas reais (assets/mundo/irece.json), casas, árvores, nuvens, reserva de lotes
             mundo/voxel.mjs      "Obra": blocos finos em InstancedMesh, luzes, letreiro (fonte 3×5), árvore, pessoa, carro
             mundo/predio.mjs     Prédio da Vybe (fachada da maquete), andares, salas dos agentes, salas da equipe, presença
             mundo/planta.mjs     PLANTA (andares, setores, agentes, estado, módulo) e ZONAS_DO_PREDIO (Escritório → andar)
             mundo/sedes.mjs      sede de cada cliente; COMPLEXOS e VIZINHOS
             mundo/clientes.mjs   coloca as sedes nos lotes, farol e placa na cor da situação
             mundo/sala.mjs       abrirAndar: o andar por dentro (escritório aberto)
```

**Regras de ouro da arquitetura:**
1. **O mundo não é outro painel.** `vybe-mundo.js` só chama funções que já existem: `chooseManagerMode`, `chooseFocusUser`, `chooseDaControllerMode`, `chooseProductionMode`, `chooseClientMode`, `chooseVybesMode({pedido})`, `openCadastrosStation`, `switchBoard`, `openItemWorkspace`, `abrirClienteDetalhe`, `irParaSalaEscritorio`, `escritorioIrPara`, `captVerDia`. Nunca recrie modal, formulário, regra ou endpoint.
2. **Dados:** use o mesmo estado global do painel (`DADOS_ALL`, `DADOS_DEMANDAS`, `CADASTRO_CLIENTES`, `clientesDoItem`, `isFinishedItem`, `hojeDeVerdade`, `operadorDoTopo`, `focusOwnItems`, `focusReferenceDate`, `escritorio.*`) e os endpoints existentes, **só para leitura**: `area=captacoes`, `area=planejamentos&acao=pendentes`, `area=automacoes&historico=1` / `&falhas=1`, `area=vybes` (GET devolve `noAr`).
3. **O Escritório antigo é o motor.** Presença, voz por zona, trancas, convites, jogos e VybeCoins continuam no `vybe-escritorio*.js` e no Worker. O mundo cobre a tela, e o desenho antigo pausa com `body.mundo-sobre-escritorio` (em `mapaForaDeVista`, no arquivo `vybe-escritorio-mapa.js`). **Nunca criar zonas novas nem mudar as do Worker.** As salas do prédio são as mesmas zonas: `sala-0…8`, `recepcao`, `reuniao`, `auditorio`, `producao`, `cafe`, `jogos`, `foco`, `academia`, `lounge`, `operacao`.
4. **Camadas (z-index):** `#painel-escritorio` e `#mode-gate` usam 600 → mundo 601, tela de módulos 602, HUD 603, cartão do mouse 604, andar por dentro 606 → avisos ficam acima (`.office-dock` 630, `.plj-aviso` 640) e as janelas também (655 em diante). Não coloque nada do mundo acima de 630.
5. **Armadilhas já encontradas:**
   - O tema do painel usa `#mode-gate#mode-gate` e `#workspace-title`, com especificidade alta. Para vencer, o CSS do mundo usa `html body.mundo #mode-gate#mode-gate …`.
   - `html.vb-ocioso` pausa todas as animações. Uma animação de entrada pausada fica invisível (opacidade 0), por isso as entradas do mundo são isentas.
   - `body.no-escritorio` esconde e pausa a tela de módulos. No mundo há uma regra que sobrepõe isso.
   - Dentro do HUD do mundo (`#mundo-hud`), um `<header>` herda um fundo escuro de uma regra global. Use `div`.
   - Escrever CSS ou JS pelo heredoc do Bash quebra com aspas. Use o Write/Edit ou um script Python salvo em arquivo.
   - No Windows, editar arquivos por Python troca CRLF por LF. É inofensivo (o Git normaliza), mas confira o `git diff --stat`.
   - Com a aba do navegador escondida, o `requestAnimationFrame` para e a câmera só anda quando há screenshot. Para medir de verdade, a janela precisa estar na frente.

## 4. Padrão visual "Vybe Voxel" (vale para o mundo e para TODOS os módulos)

Ele é baseado no guia do Vale ao Vivo, traduzido para a Vybe. Os tokens ficam no topo de `vybe-mundo.css` (prefixo `--vv-`, e `--sit-` para situações).

- **Laranja Vybe (`--vv-laranja` #FF7A2F) = ação e marca.** É a única cor de botão cheio (Criar, ação principal). **Lilás (`--vv-lilas` #8B7DFF) = VYBES e agentes.** O resto fica neutro.
- **Cor = situação**, sempre com três tons (cor, fundo e texto). A ordem de importância é: atrasada > para aprovar > ajuste > sai hoje > sem briefing > a fazer > pronta > concluída. A regra única está em `situacaoDaPeca` (`vybe-mundo.js`), que dá prioridade à data do cliente (veiculação).
- **Vidro:** `--vv-vidro` (80%), `--vv-vidro-forte` (93%) e `--vv-vidro-leve` (56%), com `--vv-desfoque`, borda clara de 1 px e `--vv-sombra`. As peças ficam soltas, a 14 px das bordas (`--vv-m`).
- **Cantos:** placa 26 px, cartão 18 px, item 13 px, botão 11 px, pílula 99 px.
- **Tipografia:** Space Grotesk nos títulos (`--vv-titulo`) e a fonte do sistema no texto. Rótulo de seção em caixa-alta, 11 px, peso 800, na cor da seção, com ponto e halo.
- **Movimento:** toque com escala 0,94 + mola (`--vv-mola`); telas entram com `vv-entra`; o que está acontecendo agora pulsa. Respeitar `prefers-reduced-motion`, `body[data-motion=reduce]` e `prefers-reduced-transparency`.
- **Peças padrão:** trilho de ícones (76 px), placa lateral, cartão com faixa de situação (`box-shadow: inset 4px 0 0 var(--c)`), linha de etapas, seção com contador, cartão que aparece ao passar o mouse, aba recolhível (Agenda), selo de estado do agente.
- **Voxel:** terreno numa malha única; objetos com `InstancedMesh` (use sempre a `Obra` de `voxel.mjs`); luz de céu + sol quente + preenchimento; câmera de 22° com tilt-shift. Detalhe vem de blocos finos (0,05 a 0,3) e de luzes (`o.luz`), não de texturas.
- **Prédio da Vybe:** caixa preta ripada com frestas de LED laranja, coluna laranja com "VYBE", marquise laranja acesa no térreo, vidro com luz quente e gente dentro. Foi feito a partir da maquete que o Paulo mostrou.
- **Escritório por dentro:** é a referência da "sala-maquete" que o Paulo mandou: duas paredes, piso em ladrilhos, móveis bem detalhados.

**Checklist de cada tela nova ou reformada:**
1. O mundo aparece nas bordas, e nenhuma interface "encaixota" o mapa.
2. Tudo é vidro, com respiro.
3. A cor só vem da situação.
4. Ao abrir, dá para entender o que ficou para trás, o que é hoje e o que vem depois.
5. Passar o mouse mostra o detalhe; clicar abre a tela completa.
6. Testar em 375, 768, 1024, 1280, 1440 e 1920 px de largura: nada cobre nada e nada rola para o lado.
7. **Conferir com dados reais** (aba 4451, com o login do Paulo) antes de dar como pronta.

## 5. Feito (06/11/2026)

**Mundo**
- Irecê real: relevo do Terrain Tiles e 1.994 ruas e 65 lugares do OpenStreetMap, com o crédito na tela. Casas com telha ou laje, caixa d'água, porta virada para a rua, janelas e muro. Árvores, nuvens e água.
- Câmera de maquete: arrastar, inércia, zoom em direção ao cursor, botão direito ou Shift para girar, pinça no celular, botões + / − / girar / ver tudo, centro na área livre (`setViewOffset`), pausa quando a tela não está visível.
- Prédio da Vybe com a cara da maquete. "Prédio da Vybe" abre os andares em vista explodida; focar um andar tira os de cima da frente.
- Sedes dos 16 clientes ativos com a cara de cada negócio e o nome no letreiro. Antonov, VOA e Hebravet dividem um complexo (três lojas). DiaCenter e DiaLab ficam em lotes vizinhos, separadas. Os outros clientes recebem uma sede genérica pelo segmento.
- Farol e placa de cada cliente na cor da situação mais urgente; o farol pisca quando há atraso. Clicar abre o cliente no módulo Clientes.

**Interface**
- Kit "Vybe Voxel" em `vybe-mundo.css`.
- Trilho de ícones à esquerda: Hoje, Tarefas, Criar, Gestor, Direção, Agenda, Clientes, Prédio, VYBES e Módulos. "Módulos" mostra as estações de sempre.
- Painel "Hoje": a fila do topo, a fala do VYBES dizendo por onde começar, a lista de hoje, os próximos 6 dias e "Pergunte ao VYBES" (abre a central com o pedido).
- Aba da Agenda à direita: os próximos 3 compromissos. Ao clicar, abre a agenda das Captações, que é a agenda única, já no dia.
- Placa do prédio (andares e legenda), placa do andar (setores, agentes, salas da equipe) e placa do cliente.

**Escritório no prédio**
- `ZONAS_DO_PREDIO` liga as 9 salas pessoais e as 10 áreas comuns aos andares. Há um teste que garante isso.
- Presença em voxel, pelo modo "observar" do saguão ou pela conexão normal.
- Andar por dentro (`abrirAndar`): escritório aberto e detalhado. Clicar numa sala entra nela, com voz. Já dentro, clicar no chão faz andar (`escritorioIrPara`).
- O atalho "Voltar ao escritório" foi escondido no mundo (o microfone e a chamada ficam).

**Agentes**
- O painel do agente (clique na mesa dele) mostra o que faz agora, a fila e o que fez, lendo dados reais: Redator (planejamentos), Arquiteto de Processos (automações), Edição (captações), Diretor de Arte (fila de aprovação), BI (volume por cliente), Atendimento (avisos dos clientes) e VYBES (central no ar e atrasadas).
- No bot, `core/agentes.js` escolhe o setor de cada pedido, monta a proposta de tarefa (modo sombra), diz quem aprova e guarda as propostas em `.vybe-ai-local/agentes/propostas.jsonl`. São 7 testes.

**Segunda leva (mesma noite)**
- **Van da Vybe:** as captações de hoje (aba Agenda) viram vans laranja que saem do prédio e vão **pelas ruas reais** (busca no mapa de ruas, `irece.caminho`) até a sede do cliente, param e voltam. Cada van tem uma placa "Captação · cliente · hora".
- **Cérebro visual:** a vista "Cérebro" (botão no topo) liga o VYBES, no alto do prédio, a cada cliente por uma conexão de luz na cor da situação, com pulsos correndo por ela (a quantidade vem das peças em aberto, e o atraso acelera). A placa lista os clientes do mais urgente ao mais tranquilo.
- **Equipe no trilho:** quem está online e onde, com "Ir até", e as funções que eram do saguão do Escritório (Conversa, Recados, Missões, Ranking, Conquistas, Inventário, Catálogo, Meu personagem), chamando as mesmas funções. Também mostra as VybeCoins.
- **Entrar no painel cai no mundo**, não no saguão antigo do Escritório. Com o mundo ligado, o quadro "escritorio" (o Habbo) nunca aparece: vai para o Prédio. O saguão antigo fica escondido por baixo.
- **Roupagem dos módulos, camada 1:** com um módulo aberto, o mundo fica atrás (parado), o trilho continua à esquerda e a tela de trabalho fica numa moldura de vidro com respiro (`body.mundo-modulo`, `#mundo-moldura`).
- **Roupagem dos módulos, camada 2 (pele clara):** as variáveis do painel (`--surface`, `--text`, `--vybe-*`, `--pv-*`) trocam só dentro das áreas de trabalho (`.app-header`, `.container`, `[id^="painel-"]`), mais ajustes pontuais nas peças com cor fixa. Já está claro e conferido em Gestor, Demandas, Clientes e **Produção/Agenda (estilo Google Agenda)**.
- O modo ocioso do painel congelava a entrada dos quadros (o módulo ficava invisível). As entradas no mundo agora são isentas.

**Terceira leva**
- **Pele clara em todos os módulos:** Gestor, Demandas, Clientes, Produção/Agenda, Diário, Performance, IA e custos, Automações, Conta, Direção de arte e Modo Foco. Cada um foi conferido com o levantamento de "fundo escuro" e "texto branco sobre fundo claro" até a lista zerar, ou quase (ver o item 2 de "A fazer").
- **Janelas na pele clara:** a ficha da peça (`#workspace-drawer`), os Cadastros (`#fc-overlay`), a Busca (`.spotlight-dialog`) e a caixa de avisos (`#notif-caixa`).
  - Com o mundo aberto, a ficha da peça sobe para a camada 621. Antes ela ficava atrás do mundo, na 501.
- **O aviso dos planejamentos** (`.plj-aviso`) agora é o VYBES avisando: ilha de vidro no topo, ao centro (em telas abaixo de 1300 px e com módulo aberto, fica no rodapé), com o ponto lilás do VYBES e a faixa vermelha quando é urgente.
  - O painel escondia esse aviso com o Escritório aberto (`body.no-escritorio`); no mundo ele volta.
- **"Fora do escritório · Entrar" saiu:** no mundo, entrar é entrar numa sala. A barra (`.office-dock`) só aparece numa sala com voz, como uma pílula escura no rodapé, ao centro.
- **Armadilha nova (`vb-ocioso`):** depois de 30 s sem mexer o mouse, o painel pausa todas as animações (`vybe-energia.js`). O que abre sozinho nesse tempo (aviso, agenda, painéis do mundo) ficava congelado no quadro 0, invisível. No mundo, as entradas estão isentas. Nos testes por script, chame `vbAcordar()` antes de cada captura de tela.

**Quarta leva**
- **Avatares voxel no lugar dos bonecos do Habbo** (`mundo/avatar.mjs`). A figura que cada perfil já guarda (`hr-…`, `hd-…`, `ch-…`, `lg-…`) vira um boneco voxel com cores fixas por parte, então é sempre o mesmo boneco para a mesma pessoa e bonecos diferentes para pessoas diferentes. Ele é desenhado uma vez fora da tela e vira imagem. Com o mundo ligado, toda `<img>` do imager do Habbo (`habbo.com/habbo-imaging`, `habboassets.com/imaging`) em qualquer lugar do painel é trocada automaticamente (o observador fica em `vybe-mundo.js`). O endereço original fica em `data-habbo`. Conferido no Ranking: 17 de 17 trocados.

- **Ícones voxel no lugar da arte de móveis do Habbo** (`iconeMovel` e `tipoDoMovel` em `avatar.mjs`). O tipo vem da classe do móvel (cadeira, sofá, mesa, planta, luminária, estante, troféu, som, tela, cama, quadro, tapete, máquina, baú ou caixa) e a cor é fixa por classe. Há duas portas de troca: `mapaDesenharMovel` (o Escritório desenha os ícones de sala, troféus e baú) e as `<img>` de `habboassets.com/imaging/furniture/<classe>.png` (a Loja).
- **Pele clara nas janelas do Escritório e dos jogos:** a base `.ofc-dialogo` (Loja, Inventário, Carteira, Conquistas, Missões) e `.workflow-modal.ofc-menu-jogo` (Ranking). Conferido na Loja.
- **Decisão pendente com o Paulo:** refazer a personalização (móveis e roupas) num catálogo voxel próprio ou abolir. Hoje os 6.776 itens do Habbo aparecem como ícones genéricos por tipo, então ninguém perdeu nada, mas a variedade visual é pequena.

**Quinta leva**
- **Catálogo voxel próprio** (`mundo/catalogo.mjs` e `mundo/catalogo-ligacao.json`). São 101 peças desenhadas em voxel, cada uma ligada a um item que a loja já vende, então compra, preço, inventário e decoração continuam pelo mesmo servidor, pela classe. A Loja ganhou a seção "Catálogo Vybe" no topo e prateleiras na capa. O acervo antigo continua, e cada item dele vira a peça voxel padrão do mesmo tipo. Para refazer a ligação, rode o gerador `gera_catalogo.py` (fica na pasta de rascunho da sessão; a lógica é: para cada peça, o primeiro item da loja do mesmo tipo e categoria que ainda não foi usado).
- **Sala no andar com a decoração da pessoa:** os itens salvos (`escritorioItensDaCamada`) aparecem como peças voxel nas posições salvas. *Não conferido com uma sala decorada de verdade.*
- **Jogos no trilho.**
- **Ferramentas do cabeçalho no mundo:** busca, avisos com contador, notas, aparência e conta.
- **Vybe e clientes no lugar real** (`mundo/locais.json`). A Vybe fica pela rua ou pelo ponto informado; cada cliente pelo local fixo, depois pelo endereço do cadastro (a rua com o mesmo nome no mapa, sem serviço de fora), e por último num lote perto da agência. São 90 lotes espalhados pela cidade; os que sobram viram pracinhas. **Ainda falta o endereço da Vybe** (o arquivo começa com `vybe: null`).
- **Cidade mais rica:** cinco tipos de casa (térrea com telhado de duas águas em degraus, sobrado com varanda, comércio com toldo e placa nas avenidas, casa com muro e portão colorido, prédio baixo), cores das cidades do interior da Bahia, barrado colorido, janelas acesas, carros estacionados, postes nas avenidas e quintais com árvore frutífera.

**Qualidade:** `npm test` passa 1.076 de 1.076 e `npm run build` passa. Nada commitado nem publicado. **Não conferido:** dados reais com login, voz entre duas pessoas e desempenho no Mac do Paulo.

**Sexta leva (testada com os dados reais do Paulo, na aba 4451)**
- **Jogos abrem direto do trilho** (Jogos → Sinuca, Xadrez, Pôquer ou Mesa de Jogos). O motor vai até a sala Jogos por baixo e abre a mesa pela mesma função de sempre, com o mundo atrás. Os móveis da sala chegam depois da troca de cena, então ele espera `mapa.prontos` antes de procurar a mesa (sem isso dava "Não achei essa mesa"). No andar por dentro, clicar nas mesas também abre o jogo. **Conferido com clique:** Sinuca e Xadrez abriram com os dados reais.
- **O Escritório antigo nunca aparece** com o mundo ligado (`#painel-escritorio` fica com `visibility: hidden`); ele só roda como motor.
- **"Ver como":** quem administra escolhe qualquer pessoa no painel "Hoje" e vê o dia dela. "Meu dia" abre o Modo Foco dessa pessoa.
- **Mapa em branco corrigido:** mudar o tamanho da janela com o mundo parado apagava o desenho. Agora ele redesenha uma vez.
- **Lição:** confira no arquivo (`grep`) cada edição feita por script antes de testar. Uma troca no clique da mesa não tinha sido gravada, e o teste "passou" pelo caminho errado.

**Pedidos novos do Paulo (06/11, noite), ainda a fazer, com o como:**
1. **Endereços públicos da Vybe e dos clientes:** buscar em fontes públicas (site, Google Maps, Instagram e cadastro de CNPJ de cada empresa) e preencher `mundo/locais.json` (`rua` com o nome igual ao do mapa, ou `x`/`z`). Peça ao Paulo para conferir antes.
2. **CRM de prospecção no 1º andar (setor SDR):** a lista das empresas de Irecê a partir de dados públicos, começando pelo OpenStreetMap (`shop`, `amenity`, `office`, `craft` com nome, consultados pelo Overpass, como em `baixar-irece.mjs`). Gravar em `assets/mundo/empresas-irece.json` com nome, tipo, x/z, rua e telefone/site quando houver, e o crédito ODbL na tela. No mapa: as empresas viram placas pequenas nas casas; quem é cliente é a sede própria. No andar Comercial: a lista com filtro por tipo e bairro, distância da agência, "já é cliente?" e botão "propor abordagem", que vira proposta do agente Qualificador (`core/agentes.js`, setor `sdr`). Sem enviar mensagem a ninguém.
3. **Marcos de Irecê em voxel:** Praça do Feijão, estádio, Mercadão (mercado municipal), Praça da Prefeitura e igreja matriz. A posição sai do OpenStreetMap (os nomes estão em `areas` no `irece.json`, ou em nova consulta pelo nome). Cada um ganha o seu desenho em `mundo/marcos.mjs`, com placa no mapa.
4. **Van na empresa do cliente na hora da captação:** usar `inicio`/`fim` do evento. Antes do início, ela vai a caminho (saindo cerca de 30 min antes); entre o início e o fim, fica estacionada na sede do cliente com um pulsar "gravando"; depois do fim, volta. Hoje ela só vai e volta em ciclo.
5. **Revisar cada tela** e tirar o que ainda tem "cara de sistema de 1990": as tabelas e grades densas do Gestor e de Demandas, as listas de Clientes, o Diário, Performance (gráficos com cores do kit, ver a skill `dataviz`), Automações e Conta. Método: abrir cada uma com os dados reais, comparar com o checklist da seção 4 e reformar a peça (não só a cor): cartões com faixa de situação, linha de etapas, seções com contador e menos bordas.

## 5a. Rodada de 06/11/2026 (noite): cidade real, CRM, Perfil e pele das janelas

- **Marcos de Irecê** (`mundo/marcos.mjs`): Prefeitura (Pça. Teotônio Marques Dourado), Catedral Bom Pastor, Estádio, Mercadão, Rodoviária, Hospital Regional, Câmara, Fórum e Praça do São João, nas posições do OSM, com terreno reservado antes do prédio e dos lotes. **Praça do Feijão: o Paulo precisa dizer qual é** (não existe com esse nome em fonte pública).
- **Base de empresas** (`assets/mundo/crm-irece.json`, gerada da base de CNPJ que o Paulo mandou — `Desktop/base.json` — pelo gerador `gera-crm.mjs`, ver abaixo): 5.148 empresas ativas de Irecê, **sem sócios nem vínculos** (dados de pessoas ficam fora). O Paulo autorizou ir como arquivo público (são dados públicos). A posição vem **pela rua do endereço** no mapa (4.001); sem rua, centro do bairro com espalhamento (817) ou da cidade (330) — o CRM avisa "posição aproximada". Build copia com hash (`crm-irece-<hash>.json`). Sem o arquivo, cai na lista do OSM (`empresas-irece.json`, 98 lugares).
  *Regerar quando chegar base nova:* `node scripts/gera-crm.mjs <base.json> assets/mundo/irece.json assets/mundo/crm-irece.json` (script em `scripts/gera-crm.mjs`: filtra `municipio === 'Irecê'` e `situacao === 'Ativa'`, procura a rua em `irece.json.ruas[].n` sem acento e sem "Rua/Av", põe o ponto num trecho escolhido pelo hash do CNPJ, 1,6 célula ao lado da rua).
- **CRM de prospecção do 1º andar** (agente Qualificador/SDR, `FONTES.sdr` em `vybe-mundo.js`): busca por nome/atividade/CNPJ, setor, bairro, só associadas da ACE, mais perto da Vybe primeiro, telefone/e-mail, porte e idade da empresa, "ver no mapa". "Propor abordagem" é **modo sombra** (guarda em `localStorage` `vybe.crm.propostas`; ninguém recebe mensagem). *Próximo passo:* levar a proposta para `core/agentes.js` (registrarProposta) pela ponte da central.
- **Mapa:** uma plaquinha por empresa na cor do setor (um só desenho); nome só das 75 associadas da ACE.
- **Van da captação** segue o relógio da agenda: 30 min antes sai, durante fica **parada na porta do cliente com "gravando agora"**, depois volta.
- **Perfil no trilho** (ícone "Perfil"): abre a ficha completa que o Escritório já tinha (`abrirFichaEscritorio`: resumo, meta da semana, ganhos, como ganhar, conquistas, inventário, **Trabalho** com os números). Com "Ver como", abre o perfil da pessoa escolhida (ids do painel → ids do Escritório por `escritorioIdNasDemandas`). Na placa Equipe, "Perfis do time". Boneco voxel no palco (no lugar da sala do Habbo), "Ir para a minha sala" leva à sala no Prédio, "Piso e paredes" (Habbo) some.
- **Linha de demanda única** (`linhaDemanda` em `vybe-mundo.js`): barra e bolinha na **cor do status** (`status_color`, a regra de sempre), cliente na **cor da carteira do head** (`tagClienteHtml`), título sem CAIXA ALTA, data vermelha só se atrasou e o **olhinho** (`botaoDePreviaNaLinha`) quando já há material. Usada no Hoje e nas filas dos agentes. **Toda lista nova de demanda deve usar esse componente.**
- **Pele das janelas:** todas as `.workflow-modal` (planejamentos "Esperando você", status, bastão…) agora claras; pílulas de status geradas das cores originais (escurecidas para fundo claro); cores fixas claras do HTML dos módulos escurecidas; Diário virou linha do tempo (Hoje/Ontem, total, variação); topo dos módulos com a aba ativa laranja; trilho marca "Módulos" em Diário, Performance, IA, Automações, Conta e Demandas.
- **Detector de contraste** (rodar no console, módulo aberto): percorre os elementos visíveis, pega a luminância de `color` e do fundo efetivo (subindo nos pais) e lista "fundo escuro" e "texto com diferença < 0,3". Zerou em Produção, Demandas, Clientes, Diário, Performance, IA, Automações, Conta e nas abas do Perfil nesta rodada. Repetir a cada tela nova.

## 5a2. Rodada de 06–07/11/2026 (madrugada): cérebro, mapa real, lobby e pente fino

- **Cérebro arquitetado** (vista Cérebro): núcleo VYBES (Qwen 3.5 35B local) + 5 camadas de memória (Identidade, Memória dos clientes, Conversas, Trabalho do painel, Agentes dos andares) com números reais; sinapses até a mesa de cada agente no prédio e até cada cliente (um fio por origem: central, painel, referência, nota). Painel de cada camada diz o que guarda, onde mora e quem usa. Agente mostra "Cérebro do agente" (com o que pensa, o que lembra, como decide). Nome do agente sobre a mesa no andar em foco.
- **Cérebro do cliente** do Codex trazido do checkout principal (`vybe-clientes-cerebro.js`, testes `clientes-cerebro`/`vybes-cerebro-leitura`, ponte `lerCerebroDaCentral` em `server/vybes.js`, rota no dev-server). Botão "Sinapses" no cliente abre a visão "Cérebro VYBES" do módulo Clientes.
- **Mapa real**: ruas como faixas contínuas no traçado do OSM (asfalto, meio-fio, faixa amarela; avenidas com canteiro e nome); recorte ampliado (formato real da mancha urbana); empresas da base viram comércio no lote do endereço (posição pelo NÚMERO na rua, `scripts/gera-crm.mjs`); sem endereço exato, só no CRM. **Clientes e Vybe pelo Google Maps** em `mundo/locais.json` (Vybe: R. São Francisco 194, ao lado da Copirecê). Sem local: Alpha1 e Mangaba AI (perguntar ao Paulo). Marcos: Praça do Feijão, Atacadão (BA-052), UNEB, FAI. Pino de cliente visível em qualquer zoom com atrasadas · hoje · aprovar · em aberto.
- **Lobby Irecity**: no portão de login, Irecê ao vivo atrás e dois botões: "Entrar no Irecity" e "Modo legado". **Sem escolha guardada abre o legado** (ninguém é pego de surpresa ao publicar). Chave "Modo Irecity" na Aparência para trocar depois.
- **Escritório antigo**: no Irecity a aba (casinha) some e todo atalho (`chooseOfficeMode`, `switchBoard('escritorio')`) vai ao Prédio; o motor segue por baixo só para presença, voz e mesas de jogo.
- **Pente fino**: medição de contraste WCAG (fórmula oficial) em cada módulo; 2.391 regras antigas de texto claro escurecidas por gerador (`gera_texto_claro.py` no histórico; separar seletores respeitando parênteses, senão o CSS quebra); selecionado = fundo `--vv-acao` (#C2490C) + texto branco; caixinhas de marcar novas; cartões de peça como vidro separado; grade da linha da peça sem cortar selo/formato; cartão rápido da peça claro; Direção de Arte sem margem negativa; **rolagem dentro da moldura** (o body ocupa a área da moldura); animações curtas (clique afunda, conteúdo entra subindo, janelas surgem), desligadas com menos movimento/ocioso.
- **Falta**: vegetação mais rica e passarinhos; **otimizar o mapa** (muitos blocos: juntar por quadra, LOD por distância, desenhar só o que a câmera vê); conferir telas restantes (Tarefas/Foco, Agenda de captações, Cadastros, VYBES, gaveta da peça) com o mesmo detector; publicar (só com o Paulo pedindo; seguir `CHECKLIST-DEPLOY.md`).

## 5a3. Rodada de 07/11/2026 (tarde): cidade detalhada, V laranja e cidade que vira foto

Pedido do Paulo: "tudo muito bem detalhado e bem feito, no nível da baleia, parecendo mais com Irecê"; "ruas e detalhes
muito longe do esperado"; "áreas verdes e terrenos pobres"; "troca por um V da Vybe, de roxo pra laranja"; "otimiza tudo
pra não ficar renderizando a cidade toda o tempo todo".
- **Superfície de cubinhos** (`voxelizar`/`materialVoxel` em `voxel.mjs`): toda caixa do mundo ganha, no shader, a grade de
  voxels de 1 m com tom levemente diferente por cubinho, quina escurecida e pé da parede mais escuro. Nenhum triângulo a
  mais; de longe a grade some sozinha. Vale para casas, árvores, sedes, prédio, salas, chão e ruas (um material só).
- **Chão em alta resolução** (`irece.mjs`): o disco virou uma imagem de 8 px por célula (1,25 m). Por cima, as ruas no
  traçado real em camadas: calçada, meio-fio, leito (asfalto no centro, paralelepípedo nos bairros, terra na roça),
  faixa dupla amarela, tracejado branco e faixa de pedestre nas esquinas do centro. As faixas de rua em 3D saíram (as juntas
  viravam borrão).
- **Quarteirões de Irecê**: casas geminadas de frente para a calçada, no ângulo da rua (`blocos()` aceita `rot`), lotes de
  8 a 13 m, quintal atrás com frutífera. Loja com porta de enrolar, toldo e placa na cor do setor (empresas da base de CNPJ
  no lote do endereço). De perto: porta com batente, janela com grade, garagem, barrado, fileiras de telha, caixa-d'água,
  aquecedor solar, ar-condicionado; na calçada: nim, ipê, coqueiro, poste e carro estacionado.
- **Praças**: grama no formato real, calçada em volta, caminhos até a roda do meio, canteiros com flores, coreto (grandes) ou
  fonte, bancos, postes e mais árvores. Estádio e campo ficam de fora. **Terrenos vazios**: terra batida com mato, arbustos,
  mandacaru e, às vezes, entulho.
- **Árvores em cachos** (cidade e `Obra.arvore`): miolo de longe; cachos, tronco e flores de perto.
- **Prédio**: o ser roxo virou o **V da Vybe em voxel, laranja** (rótulo "VYBES" laranja). Terraço com deque, sinuca com pés e
  caçapas, ombrelones listrados, sofás com almofadas, floreiras, bar e cordão de luzinhas; guarda-corpo de vidro.
- **Andar por dentro** (`sala.mjs`): corredor com passadeira, plantas, bancos, luminárias e bebedouro; o canto sem sala vira
  um lounge.
- **Relevo**: degrau de 0,28 (era 0,45) e paredes dos degraus em terra clara (riscavam as ruas de marrom).
- **Cidade que vira foto** (`motor.mjs`): mexendo, todo quadro; parado, o enfeite cai para 30, 15 (6 s) e 4 qps (20 s), e
  com 1 min sem mexer o mapa para de ser desenhado até alguém mexer o mouse/teclado (ou um dado novo chegar). A sombra da
  cidade só é refeita quando a câmera anda (antes, a cada 2 s com qualquer animação); nuvens não fazem sombra. Longe do foco
  (mais de 150 células), casas e árvores ficam só na imagem do chão (telhados pintados vistos de cima): é o "cenário em PNG".
  `mundoVoxel.desempenho().laco` mostra o estado (pausado, visível, estacionado, parado há quanto tempo).
- Medido neste PC (1366×768): vista geral ~315 mil triângulos e ~6 ms por quadro; de perto ~1,1 milhão e ~6 ms.

## 5b. Conferência geral (06/11/2026): onde ficou cada coisa do painel antigo

| Do painel antigo | Agora, com o mundo ligado | Situação |
|---|---|---|
| Estações da tela de módulos (Gestor, Minhas tarefas, Direção de arte, Cadastros, Produção, Clientes, Escritório, VYBES) | Trilho (Tarefas, Criar, Gestor, Direção, Agenda, Clientes, Prédio, VYBES) e o botão "Módulos", que mostra as estações completas | ok |
| Abas do quadro (Produção, Escritório, Demandas, Clientes, Diário, Performance, IA e custos, Automações, Conta) | Barra de abas dentro da moldura do módulo, igual à de antes | ok |
| Cabeçalho: busca ⌘K, avisos, notas, aparência, conta | Ilha de ferramentas no topo do mundo (e o cabeçalho dentro do módulo) | ok no computador; **no celular a ilha some (falta)** |
| Saguão do Escritório: Conversa, Recados, Missões, Ranking, Conquistas, Inventário, Loja, Personagem e VybeCoins | Trilho → Equipe (mesmas funções) | ok |
| Mesas de jogo | Trilho → Jogos: leva à sala Jogos (terraço) e abre a mesa | ok; **não testado com partida real** (a demonstração não tem partidas) |
| Salas, presença e voz por sala | Prédio → andar por dentro (todos se veem; a voz liga na sala) | ok; **voz entre duas pessoas não testada** |
| "Minha sala" (editor de decoração) | Ainda abre o editor antigo | **falta**: editor voxel dentro do andar |
| Música da sala (jukebox), TV na sala, convite de convidado, tutorial | Ficaram só no Escritório antigo | **falta**: trazer para o andar e para Equipe |
| Agenda da semana do Escritório | Aba Agenda e agenda das Captações (agenda única) | ok |
| Avisos dos planejamentos (`.plj-aviso`) | Ilha do VYBES no topo | ok |

**Responsividade.** Abaixo de 900 px, o trilho vira uma barra embaixo (Direção e Gestor ficam pelo "Módulos"), o painel "Hoje" vira gaveta e a Agenda e as ferramentas somem. **Faltam:** a ilha de ferramentas no celular, o andar por dentro no celular (não testado) e as medições nas 6 larguras com dados reais.

**Desempenho.**
- O 3D baixa sob demanda (cerca de 840 KB minificados).
- O mundo para de desenhar com um módulo aberto, e o Habbo para debaixo do mundo.
- Avatares e ícones são desenhados uma vez e ficam guardados.
- **Falta medir no Mac.** Se pesar: baixar o `pixelRatio`, a sombra de 4096 para 2048 e tirar o tilt-shift no notebook.

**Experiência (já corrigido nesta conferência):**
- a ficha da peça ficava escondida atrás do mundo;
- o modo ocioso congelava o que abria sozinho;
- havia rolagem lateral nos módulos;
- títulos e textos saíam brancos no fundo claro;
- o aviso cobria os botões no celular;
- faltavam as ferramentas do cabeçalho no mundo.

## 6. A fazer, e como fazer certo

Cada item abaixo tem o seu "como". Siga a ordem, a menos que o Paulo peça outra.

1. **Conferir com dados reais.** Abrir a prévia `vybe-os-mundo-real` (4451); o Paulo entra. Conferir: os clientes do cadastro (só os ativos, com o nome do painel), a fila do painel "Hoje", a agenda, a presença do Escritório e o painel dos agentes. Corrigir o que aparecer.
2. **Roupagem nova por dentro dos módulos.** *Já feito:* a moldura, a pele clara de todos os módulos e as janelas principais (ficha, Cadastros, Busca, avisos). *Falta, nesta ordem:*
   - **conferir com dados reais**, porque com volume aparecem estados que a demonstração não tem: grupos cheios, popovers de status, menus de lote;
   - as outras janelas que usam `.workflow-modal` (troca de status, bastão, resumo, direção, ranking, conquistas, loja e inventário do Escritório), a coluna de conversa e recados do Escritório e o radar de aprovação do DA;
   - o lado direito dos Cadastros (a prévia ficou cinza translúcida) e o × de fechar, que está apagado;
   - os toasts (`#toast`);
   - **as janelas de jogo e de Escritório com pele própria** (`.ofc-menu-jogo`, `rk2-*`: Ranking, Conquistas, Loja, Inventário, Missões). Elas ainda estão escuras e usam arte de móveis do Habbo (`area=escritorio&acao=arte`) nos ícones. *Como:* pele clara por janela (método do item 2) e troca da arte dos móveis por ícones voxel, desenhados como o avatar (`avatar.mjs`), por categoria. A sinuca de boteco é exceção aprovada pelo Paulo (`AGENTS.md`): ela mantém a pele própria, mas sem Habbo. *Método que funcionou:* abra o módulo na prévia; rode no console o levantamento de "fundo escuro" e de "texto branco sobre fundo claro" (procure "lum(" no histórico desta etapa, ou refaça: percorra os elementos visíveis e compare a luminância de `color` com a do fundo efetivo); acrescente ajustes **só** no bloco "Pele clara" do `vybe-mundo.css`, sempre escopados em `body.mundo.mundo-modulo`; repita até zerar a lista. Para as janelas, use um escopo próprio (`body.mundo .workflow-modal …`) e confira que não sobra texto claro sobre fundo claro. *Visão original deste item:* criar uma camada de tema escopada (`body.mundo .container`, `#painel-demandas`, `#painel-clientes`…) **no `vybe-mundo.css`** que troca as cores, raios, fontes e sombras pelas do kit, sem mexer no HTML nem no JS dos módulos. Fazer **um módulo por vez**, nesta ordem: Produção/Captações (a agenda ao estilo do Google Agenda: cabeçalho Hoje ‹ › título, Dia/Semana/Mês/Lista, Criar, mini calendário, filtros por tipo e pessoa, linha vermelha do agora), Demandas, Clientes, Gestor, Direção de arte, Diário, Performance, IA e custos, Automações, Conta. A tela de trabalho vira uma placa quase opaca (97%) sobre o mundo, com 14 px de borda. Comparar antes e depois com dados reais. **Não reescrever a lógica.**
3. **Decorar a própria sala em voxel.** *Como:* mapear as classes do inventário do Habbo (`escritorio.base.economia.inventario`, `ESCRITORIO_MOVEIS_CENAS`) para peças voxel por categoria (cadeira, mesa, sofá, planta, luminária, estante, quadro, tapete, som…), numa tabela única. O dono edita só a própria sala, pela mesma rota de gravação que existe hoje (não criar outra). A loja passa a mostrar a versão voxel.
4. **Tirar a arte do Habbo.** Só depois do item 3 e com o OK do Paulo. Remover a cena antiga e a arte de `assets/escritorio/habbo`, mantendo o motor (presença, voz, zonas). Atualizar a seção "Escritório integrado" do `AGENTS.md`.
5. ~~Vanzinha da Vybe~~ (feita). Melhoria possível: captação fora de Irecê vai até a borda da maquete. Texto original: As captações do dia (`area=captacoes`, eventos do tipo `captacao` com `cliente_id`) viram uma van voxel laranja que sai do Prédio da Vybe e vai até a sede do cliente. Captação fora da cidade vai até a borda da maquete.
6. ~~Cérebro visual~~ (feito com os clientes). Falta incluir os setores como nós e as propostas dos agentes como linhas (depende do item 7). Texto original: Uma vista "Cérebro" no mundo: o VYBES no centro, os setores e os clientes como nós, e linhas animadas para cada peça em aberto ou proposta do agente (cor = situação). Clicar num nó abre a placa do cliente ou do agente.
7. **Ligar o cérebro do bot ao painel do agente.** *Como:* o bot publica um resumo das propostas (`quadroDoPredio` de `core/agentes.js`) pela mesma ponte que já existe (a central, por túnel e crachá, `server/vybes.js`). O painel do agente mostra "Propostas esperando aprovação". **Aprovar continua pelo executor que já existe** (`prepararAcao` / `confirmarAcao`), com a permissão da pessoa.
8. **Desempenho e celular.** Medir no Mac do Paulo, com a janela na frente. Se cair abaixo de 30 qps: reduzir o `pixelRatio`, tirar o tilt-shift e desenhar só quando a câmera mexe. No celular, o trilho vira barra embaixo e o painel "Hoje" vira gaveta (o CSS já tem a base).
9. **Publicar.** Só com o pedido do Paulo: commit na branch, PR, prévia na Vercel, conferência e merge. Seguir `CHECKLIST-DEPLOY.md`.

## 7. Como testar

- `node --test tests/mundo.test.mjs`: planta, módulos que existem, regra de situação, complexo e vizinhas, zonas do Escritório.
- `npm test` (a suíte inteira) e `npm run build`.
- No bot: `node --test agentes.test.js`.
- Na prévia, `window.mundoVoxel` tem ganchos de conferência que não mexem nos dados: `desenharClientes(lista)`, `desenharPresenca(lista)`, `abrirAndar('criacao')`, `camera()`, `projetar(x, y, z)`.
