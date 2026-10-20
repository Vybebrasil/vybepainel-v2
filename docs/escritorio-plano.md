# Escritório (Vybelândia): plano, estado e próximos passos

Documento de passagem entre agentes (Claude, Codex) e sessões. Quem pegar o
trabalho do Escritório lê isto antes de mexer, e quem terminar uma etapa
atualiza este arquivo no mesmo commit. As regras fixas continuam no `AGENTS.md`;
aqui ficam o plano em andamento, as decisões recentes e o que falta.

Última atualização: 18/10/2026.

## Objetivo

As salas comuns precisam ficar com a qualidade dos quartos de construtores do
Habbo (cliente Nitro, servidor Arcturus): bonitas, ricas em detalhe e sem defeito de
montagem. Também precisam funcionar como o Habbo: sentar, subir escada, empilhar.

## Plano aprovado pelo Paulo

1. O Café é a sala modelo. Está pronto e foi aprovado; nesta rodada as paredes
   ganharam mais detalhe.
2. Refazer do zero, no motor, as outras salas comuns, cada uma com a
   referência aprovada:
   - **Convivência** (`recepcao`): saguão branco com colunas e mezanino, sem
     enfeite de São João. Feita duas vezes; precisa ser refeita pelo processo
     novo (ver "Processo").
   - **Reunião**: madeira escura com patamar. Montada; falta revisar no
     processo novo.
   - **Foco**: biblioteca com mezanino e escada. Montada em 18/10 (ver "Foco").
   - **Auditório**: teatro com balcão. Montado em 18/10 (ver "Auditório").
   - **Produção**: estúdio de foto e vídeo. Montada em 18/10 (ver "Produção").
   - **Jogos**: fliperama escuro com neon. Montado em 18/10 (ver "Jogos").
   - **Academia**: moderna, com tijolo vermelho e vidro. Montada em 18/10 (ver "Academia").
   - **Lounge**: bar-garagem "Garage 93 Vinyl". Refeito do zero em 18/10 (ver "Lounge").
   - **Centro de Operação**: sala de controle com os agentes dos clientes. Montada em 19/10 (ver "Centro de Operação").
3. Depois, detalhar mais os ambientes.
4. Levar as regras do motor para o editor do painel (quem administra monta as
   salas vendo).
5. Zerar os escritórios pessoais (segundo reinício; ver "Decisões").

## Processo de cada sala (aprovado em 18/10/2026)

Riqueza não é quantidade. Uma cota de peças por ladrilho virou entulho: livro
e vela em toda mesinha, vaso no guarda-corpo inteiro. O Paulo pediu um
trabalho de arquiteto com design de interiores.

1. **Projeto antes de montar, aprovado pelo Paulo:**
   - conceito e uma referência;
   - planta com zonas, caminho livre e ponto de destaque de cada canto;
   - lista curada de peças, escolhidas vendo a arte e cada uma com o seu papel
     (parede, chão, sobre a mesa, pendurada, assento e para onde olha).
2. **Cada canto conta uma história,** como na referência da garagem que o
   Paulo mandou (bar, oficina, DJ). O detalhe vem de objetos que servem
   àquele canto: miudezas nas superfícies e nas paredes, e não peças soltas
   espalhadas.
3. **Montar canto por canto** em `scripts/cenas/<id>.mjs`, gerar com
   `node scripts/escritorio-compor.mjs` e conferir no navegador, também no
   zoom 2×.

## Estado do motor de construção

Peças: `scripts/escritorio-construcao.mjs`. Verificador:
`scripts/escritorio-auditar.mjs`. Testes: `tests/escritorio-motor-cenas.test.mjs`.

**Regras que já existem:**
- apoio pela ficha do Habbo, direção do assento e tapete centrado;
- espaço na parede medido pela arte;
- peça pendurada medida pela arte;
- figurante só em assento de verdade;
- "foto" de visibilidade (no verificador).

**Regras novas de 18/10/2026, a pedido do Paulo:**
- **Mezanino não invade o térreo:** nada embaixo dele, fora da fileira da beira
  (como o balcão do Café).
- **"Escada é onde dá escada":**
  - o último degrau chega no andar de cima, dentro do vão do guarda-corpo;
  - o pé tem chão livre;
  - as laterais ficam livres.
- **Conjunto de estar no esquadro** (`estar()`):
  - mesa centrada e colada no sofá;
  - poltronas viradas para ela;
  - tapete cobrindo o conjunto com a mesma sobra dos dois lados;
  - o que vai na mesa fica no ladrilho longe do sofá;
  - criado-mudo só no lado "depois" (no "antes", o sofá o tapa na tela).
- **Criado-mudo** nunca atrás do encosto de um assento.
- **Tapete:** nenhum móvel com metade em cima e metade fora.
- **Parede rica:**
  - um item a cada 3 ladrilhos (peça larga vale mais);
  - pelo menos 3 tipos de item;
  - 60% do comprimento ocupado.

**Feito em 18/10/2026: a cota de "riqueza" saiu.** No lugar entraram regras
de composição em `fechar()`:
- toda peça que não é obra pertence a um canto, declarado com
  `s.canto(nome, { funcao, destaque })`, e o destaque precisa estar nele;
- mesinha (1×1) leva no máximo dois objetos;
- o mesmo acessório em cima de móveis se repete no máximo 3 + área/100 vezes;
- no guarda-corpo, enfeite só com ritmo, via `mezanino({ enfeite: { classes, cada } })`.

O Café recebeu os cantos sem mudar nenhuma peça. A Reunião e a Convivência
foram limpas (sem plantas e velas espalhadas, sem guarda-corpo entulhado). A
Convivência ainda espera o projeto novo, que precisa da aprovação do Paulo.

**A fazer, aprovado:**
1. **Ensinar o motor a fazer quartos como a garagem:**
   - peça de chão montada na parede na altura certa (moto, guitarra),
     conferindo que encosta nela;
   - "composição intencional": dentro do mesmo conjunto uma peça pode tapar
     a outra (garrafas na prateleira na frente da geladeira); a foto cobra a
     peça principal do conjunto;
   - miudeza de chão (papel amassado, mancha, cone, pneus) permitida dentro de
     um canto, e não espalhada;
   - parede dividida em vãos por pilares, cada vão com um tema;
   - extrair as peças que faltarem do acervo, já permitido (`scripts/habbo-extrair.mjs`).
2. **Refazer a Convivência** pelo processo novo, levando o projeto ao Paulo
   antes de montar; depois revisar o Café e a Reunião com o mesmo olhar.

**Lições que viraram regra (não repetir):**
- **Peça pendurada** do Habbo já vem desenhada no teto: a altura é zero. O
  lustre alto na frente da sala tapa o fundo (a foto acusa).
- **`exe_light`** é luminária de fio longo: no salão parece um poste fincado
  na escada ou na mesa.
- **Escala da tela:** ladrilhos com o mesmo `x − y` ficam um embaixo do outro;
  o de `x + y` maior tapa o de trás.
- **O verificador também tem uma regra por ladrilho:**
  - item de parede não fica em cima de outro no mesmo ladrilho;
  - nem atrás de móvel alto encostado.

## Conferência geral do motor (18/10/2026, noite)

Os defeitos de sentido que o Paulo apontou na Reunião:
- computador virado ao contrário;
- escada ao contrário e com a mureta sobrando;
- poltronas ao lado da lareira.

Eles viraram regras conferidas contra o Habbo:
- **Frentes conferidas na arte** (`assets/escritorio/habbo/frentes.json`): as 98
  peças das cenas foram vistas na vitrine (`node scripts/escritorio-vitrine.mjs`
  e o trecho no console do painel). A rosa do Habbo vale para 97; a escadinha
  da varanda tem mapa próprio. Usar a frente de peça fora da lista é erro.
- **Quem senta** fica na direção do móvel (Arcturus: `setRotation(item.getRotation())`).
- **Tela, computador e caixa** em cima da mesa olham para um assento, ou para o
  chão livre de quem fica em pé (atendente).
- **Assento virado para ponto focal** (lareira, TV, palco, fliperama) fica na
  frente dele, nunca do lado.
- **Caminho do Habbo** (Arcturus `MAXIMUM_STEP_HEIGHT = 1,5`; até 2 para entrar
  em assento; assento se atravessa; desce livre; diagonal só barrada com os
  dois lados fechados): da porta, a pessoa chega a todo assento, canto e andar.
- **Escada pela subida do desenho.** Cada escada tem tipo conferido na
  vitrine:
  - "degrau": o desenho tem a altura da ficha e empilha até chegar rente
    (folga 0,15);
  - escada inteira: o desenho sobe um andar numa peça só, com corrimão.
    Exemplo: a escadinha da varanda pisa a 0,5 e mostra a subida de 1. Vai
    sozinha, nunca empilhada.

  A escada não precisa existir pela física (no Habbo sobe-se direto até 1,5),
  mas tem de fazer sentido no desenho. Na Reunião, uma escadinha de varanda
  vence o tablado de 1 nível. (Tirar a escada não era solução, Paulo.)

## Desenho do motor: arquiteto + designer de interiores (Paulo, 18/10/2026)

O Paulo quer que as salas sejam pensadas como por um arquiteto e um designer
de interiores, "e não só vários objetos jogados na sala". O motor fica em três
camadas:

1. **Arquiteto (estrutura):**
   - programa da sala: uso e lotação;
   - circulação: caminho livre da porta a cada canto;
   - níveis: mezanino e escada onde fazem sentido;
   - eixo com ponto focal.

   O motor confere caminho, escada e eixo.
2. **Designer (composições):** cada canto é uma receita testada ("estar com
   lareira", "mesa de reunião", "recepção", "bar", "biblioteca", "oficina"),
   com relações entre as peças: na frente de, ladeando, simétrico, virado
   para. Cada receita é conferida no zoom uma vez. Cada sala tem uma coleção
   de móveis e uma paleta, e a receita usa a coleção da sala.
3. **Acabamento:** o detalhe vem da receita (o que faz sentido naquele uso),
   com limite por superfície e sem repetir à toa.

Por baixo das três camadas: a tabela de frentes conferidas na arte
(`assets/escritorio/habbo/frentes.json`). A vitrine do navegador mostrou que a
convenção de direção muda de peça para peça: `hween_c20_porchstairs` sobe ao
contrário do que a fórmula supunha, enquanto `xmas_c18_stagestairs` e as
cadeiras seguem a rosa do Habbo (0 norte, 2 leste, 4 sul, 6 oeste; quem senta
fica na direção do móvel, como no Arcturus).

## Camada do designer: receitas e coleção (18/10/2026, feito)

- **`scripts/escritorio-receitas.mjs`** tem as receitas. Cada uma monta um
  canto com relações feitas por construção e passa pelas regras do motor.
  - `estarLareira`: lareira centrada; poltronas na frente, uma de cada lado;
    abajur junto de cada uma; o mesmo grupo de itens de parede espelhado dos
    dois lados.
  - `mesaReuniao`: tampos lado a lado; cadeiras nos lados e nas cabeceiras;
    lustre no centro; telas viradas para lugares escolhidos; o que cada
    pessoa usa na frente do lugar.
  - `recepcao`: balcão virado para a porta; atendente atrás; tela para ele;
    plantas iguais dos dois lados.
  - `s.estar` (no motor): estar de sofá no esquadro.
- **`s.colecao(papeis, { acentos })`:** a coleção da sala diz a peça de cada
  papel (sofá, poltrona, lustre…). Declarada a coleção, peça que não está nela
  nem nos acentos é recusada: um estilo por sala. As receitas pedem pelo papel
  (`s.de("poltrona")`).
- **A Reunião já usa** a coleção e as receitas da lareira e da mesa.
- **Próximo:** receitas de bar, biblioteca, oficina e espera, e o projeto da
  Convivência para o Paulo aprovar, com zonas, receita de cada canto, coleção
  e peças vistas na arte.

## Projeto da Convivência (montado em 18/10/2026; Paulo pediu "continue como ficar melhor")

**Conceito:** saguão do Hotel Vybelândia, de mármore branco com dourado e
azul-claro. Quem entra pela porta (que vem da Praça) vê, no mesmo eixo, a
fonte e, atrás dela, a recepção.

**Zonas** (ladrilhos x,y; sala de 20×18; porta em x 9–10 no fundo da tela):
- **Mezanino** (x 0–15, y 0–4): mármore preto, biblioteca e estar elegante,
  janelas e arandelas na parede do fundo. A escada de palco sobe em x 13–14
  até o vão do guarda-corpo.
- **Recepção** (balcão em x 9–11, y 7): no eixo da porta, com atendente atrás.
- **Fonte** (x 9–11, y 11–13): `paris15_ltdfountain`, o ponto focal.
- **Estar dos aquários:** na parede da esquerda.
- **Chegada:** perto da porta, à esquerda (banco, malas, relógio de pé,
  cabideiro).
- **Estar azul:** à direita, sob o lustre.
- **Café do saguão:** à direita, com mesinhas.
- **Máquinas e teleporte da Praça:** no canto do fundo à direita.
- **Entrada:** ciprestes dos dois lados da porta.

**Coleção** (coleção Elegant do Habbo, creme, dourado e azul):
- sofá `elegant_c17_sofa`;
- poltrona `elegant_c17_chair`;
- mesa de centro `elegant_c17_table`;
- criado `elegant_c17_smalltable`;
- tapete `elegant_c17_carpet`;
- armário `elegant_c17_cupboard`;
- fonte `paris15_ltdfountain`;
- coluna `bling11_pillar`;
- estátua `bling11_statue1`;
- ciprestes `hotel_c18_cypress`;
- árvore `hotel_c18_tree`;
- relógio `romantique_clock`;
- flores `wed_plant`.

O lustre Bling (`bling_c15_chandalier`) só cabe com a parede 1 nível mais
alta.

**Decidido:** café do saguão no lugar dos fliperamas (a sala Jogos já tem os
fliperamas) e a coleção azul e dourada.

**Montagem** (`scripts/cenas/recepcao.mjs`, com receitas e coleção):
- **Recepção:** receita com dois balcões da linha Vanilla (`js_exe_bardesk`)
  em x 9–10, no eixo da porta.
- **Fonte:** no centro (x 9–11, y 11–13), com bancos de mármore dos dois lados.
- **Escada de palco:** em x 14–15 até o vão.
- **Guarda-corpo:** flor e vela alternadas, uma a cada dois blocos.
- **Luz:** arandelas, abajur pequeno de mesa (`classic1_lamp`), velas nas
  mesas e tochas na porta.
- **Ficou de fora:**
  - os abajures de pé cinzas, de estúdio moderno, por estilo;
  - os ciprestes, altos demais na frente da sala;
  - o lustre Elegant: pendurado na frente, ele tapava a recepção ou
    parecia pendurado na escada.
- **Lições do saguão:** peças altas (Elegant 3,5; árvores 3,7 a 8) tapam o
  que fica atrás na tela. Por isso o criado-mudo não pode ficar atrás da
  poltrona da ponta (regra nova no `estar`), banco fica do lado ou na frente
  da fonte, e peça alta não vai na frente da sala.
- **Foto em vez de ladrilho:** nas salas com a foto conferida, as regras
  antigas por ladrilho para item de parede ("atrás de móvel alto" e "em cima
  de outro item") cedem lugar à medida da foto. Elas barravam até quadro
  acima do sofá.

**Reunião:** lustre trocado pelo Dark Elegant (`darkelegant_c20_light`), que
tem corrente e lê como pendurado. Os sem corrente parecem candelabro em pé, e
o gótico tem caveira, já reprovada. A parede subiu para 5 níveis para ele
caber.

## Foco (montada em 18/10/2026)

- **Planta e mezanino:** a planta ficou plana. O patamar de 1 nível deu lugar
  a um mezanino de construtor a 3, no fundo (y 0–4), com tábuas
  `classic9_floor2`. O térreo é de pedra (`classic9_floor1`). A parede subiu
  para 6 níveis.
- **Coleção:** Library do Habbo (`classic9_*`) e peças antigas
  (`antique_c21_*`), com a lareira de chalé escuro.
- **Galeria de estantes no mezanino:** janela entre arandelas, globo, busto e
  relógio.
- **Térreo:**
  - mesa de estudo no eixo da porta, com abajur antigo de mesa (a luminária
    da biblioteca é de pé e em cima da mesa parecia poste);
  - lustre Dark Elegant;
  - estantes e lareira de leitura na parede da esquerda (a receita da lareira
    agora serve à parede da esquerda; as poltronas olham ao longo da parede);
  - balcão da bibliotecária perto da porta.
- **Escada de palco** (`xmas_c18_stagestairs`) até o vão em x 10–11.
- **Lição:** no mapa, a escada de construtor dos quartos
  (`bc_stairs_recolorable`, em `MAPA_PASSAVEIS`) se atravessa sem dar altura;
  ela só veste a escada da planta dos quartos pessoais. O caminho do motor
  agora usa a mesma regra do mapa, e `escada()` recusa essa peça para subir
  andar.
- **Regra de parede rica:** passou a contar móvel alto encostado (1,5 nível ou
  mais: estante, armário, lareira) pela largura.

## Auditório (montado em 18/10/2026)

- **Planta nova**, em degraus de 1 nível (o Habbo sobe direto):
  - palco no nível 1, no fundo;
  - fosso no nível 0;
  - quatro fileiras de plateia nos níveis 0 a 3, cada uma no seu degrau;
  - foyer no nível 4, junto da porta;
  - camarote no nível 5, na parede da esquerda (x 0–2), um degrau acima do
    foyer.
- **Peças:**
  - tela de cinema e estrutura de luz pendurada sobre o palco;
  - refletores e púlpito no canto esquerdo do palco, que dá vista ao camarote;
  - poltronas vermelhas na plateia, com passadeira no corredor do eixo da
    porta, e pretas no camarote;
  - no foyer: bilheteria, pipoca, banco e dois projetores apontando para a
    tela.
- **Regras novas:**
  - "Composição intencional" de plateia: assentos iguais virados para o
    mesmo lado formam fileira, e a de trás pode cobrir um pouco a da frente
    (na foto e no par).
  - A bilheteria (cabine) não precisa de foco.
  - Item de parede só onde a parede existe (canto recortado da planta).
- **Lição:** a tela (6×1) na direção errada ficava ao longo da parede da
  esquerda. Peça de parede do fundo se orienta por `olha` (frente conferida),
  não por número de direção.

## Produção (montada em 18/10/2026)

- **Planta em L, mantida;** parede subiu para 3 níveis (luz de teto do
  estúdio, `army_c15_light`).
- **Coleções:** a linha Studio do Habbo (`modern_c17_*`), a moderna `hc26`,
  equipamento `studio_*` e as caixas e estantes `army_c15`.
- **Cantos:**
  - **Set de gravação no patamar:** parede de tijolo como fundo, sofá e
    poltronas de entrevista, refletores e luz de chão.
  - **Câmera de grua:** filma o set de lado, do recuo, porque a arte só vira
    para leste ou sul.
  - **Ilha de edição no recuo:** três estações com tela virada para a cadeira.
  - **Podcast:** mesa de som e mesa comprida com as duas cadeiras do mesmo
    lado (a mesa cobriria quem sentasse do outro lado), cada uma com o seu
    microfone.
  - **Acervo de equipamentos.**
  - **Mesa de pauta no meio,** com quadro de avisos.
  - **Espera do cliente.**

## Jogos (montado em 18/10/2026)

- **Luz:** "noite" do mapa (`MAPA_LUZES_RGB.noite`). Ela escurece a sala, e o
  neon e as telas brilham; a parede subiu para 4 níveis.
- **O que não serve como parede escura:**
  - o papel `pixel_wall_black` é uma parede clara com pixels pretos, e não
    serve;
  - as paredes oficiais do Habbo vão só até tons médios;
  - a parede cyberpunk (`cpunk_c15_wall`) é item de parede, não papel, e
    ficaria atrás das máquinas.
- **Cantos:**
  - **Fileira de fliperamas** na parede do fundo, com neon entre as máquinas
    (sem encostar uma na outra) e quadrinhos de pixel acima.
  - **Pinballs** na parede da esquerda.
  - **Sinuca e pebolim** sob as luzes neon.
  - **Canto do gamer,** com tela virada para a cadeira.
  - **Sala do videogame,** com pufes virados para o console, sobre o tapete
    neon.
  - **Lanchonete** perto da porta.

## Academia (montada em 18/10/2026)

- **Tijolo:** é a parede oficial do Habbo `plano:parede:1901` (tijolo
  vermelho). As outras texturas de tijolo enganam: 1801 é tijolo branco, que
  com luz fria fica azulado, e 1902 é bege. O "bloco de tijolo vermelho da
  cidade" (`nyc_c23_buildingred`) aparece cinza.
- **Ambiente:** luz quente, parede de 4 níveis.
- **Paredes:** janelas altas (`window_skyscraper`), ventiladores industriais e
  arandelas.
- **Cantos:**
  - esteiras no patamar;
  - pesos com espelhos;
  - colchonetes e cama elástica;
  - bar de sucos;
  - vestiário com armários, banco e divisória de blocos de vidro;
  - luz industrial de teto (`army_c15_light`). As luzes verdes HabboLympix
    pareciam cápsulas soltas.
- **Regra nova:** figurante pode ficar de pé em peça onde se pisa (esteira,
  colchonete).

## Lounge (refeito em 18/10/2026)

- **Referência:** bar-garagem "Garage 93 Vinyl", a oficina que vira bar de
  vinil.
- **Ambiente:** parede de tijolo `plano:parede:1901`, luz de bar, parede de 3
  níveis (para as lâmpadas de bulbo).
- **Cantos:**
  - **Bar de caixotes** na parede da esquerda, com garrafas, velas, cafeteira
    e canecas; banquetas de barril; geladeira, máquina de lanche e estantes;
    pichação.
  - **Garagem no fundo,** com destaque para a moto montada na parede e a
    guitarra ao lado; armário, carrinho de ferramentas, pôsteres, placa de
    lata, pneus empilhados, cone laranja (cor 130 da peça recolorível),
    ferramentas no chão e o mecânico.
  - **Palco do DJ,** um degrau acima, com escadinha de varanda, mesa de DJ,
    neon, disco na parede, violão, microfone, caixas e refletor.
  - **Salão,** com mesa de carretel e cadeiras de caixote, e sofá pichado.
  - **Jogos perto da porta:** fliperama, jukebox, sinuca, ratoeira e rato.
- **Regras novas:**
  - **Peça montada na parede** (`por(..., { naParede: altura })`, o
    empilhador do Habbo): encostada, com o lado comprido rente e acima do
    chão. O verificador só aceita "sem nada embaixo" nessa condição.
  - **Balcão de módulos iguais lado a lado** (caixotes do bar) é composição
    intencional na foto.

## Para continuar no Codex (passagem de 18/10/2026)

O Paulo continua a partir daqui no Codex, porque o crédito do Claude acabou.
Estado exato:

- **Branch:** `codex/escritorio-proximo`, com cerca de 51 commits locais à
  frente de `origin/main`. Nada foi publicado nem enviado. Antes de publicar,
  comparar com `origin/main` atualizado (regra do `AGENTS.md`).
- **Árvore de trabalho:** limpa nos arquivos do motor. Existem centenas de
  `assets/escritorio/habbo/*.png/json` não rastreados, extraídos do acervo e
  não usados. Não adicionar em massa: só os usados pelas cenas, com o script
  de "usados" (ler o bloco `ESCRITORIO_CENAS_COMPOSTAS` e adicionar
  `assets/escritorio/habbo/<classe>.json/png`).
- **Para mexer numa sala comum:** editar `scripts/cenas/<id>.mjs`, rodar
  `node scripts/escritorio-compor.mjs` (gera o bloco e roda o verificador;
  tem de sair sem erro), depois `npm run check` e `git diff --check`.
- **Peça nova:**
  1. extrair do acervo: `node scripts/habbo-extrair.mjs ~/Downloads/Vybe-acervo-habbo <classe>`;
  2. conferir a frente na vitrine (`node scripts/escritorio-vitrine.mjs <classe>` e
     colar o trecho no console do painel);
  3. anotar a peça em `assets/escritorio/habbo/frentes.json`, como "regra" ou
     com o mapa; escada também precisa do tipo em `escadas`.
- **Ver no navegador:** `npm run dev`, abrir `http://localhost:4321`, entrar
  no Escritório e escolher a sala. Conferir em 1× e em 2×, canto por canto,
  antes de mostrar ao Paulo. Build e verificador aprovados não provam beleza.
- **Pendências:** os quatro itens de "Próximos passos" abaixo. O Paulo ainda
  não revisou Foco, Auditório, Produção, Jogos, Academia e Lounge, que foram
  montados com "continue".
- **Jeito de trabalhar que o Paulo pediu:**
  - **Projeto antes de montar:** arquiteto e designer, com receitas, coleção
    e cantos com história.
  - **Detalhe:** nunca encher a sala para bater número.
  - **Defeito que ele apontar:** vira regra no motor ou no verificador, com
    teste, e não remendo de coordenada.
  - **Linguagem:** responder em português simples (ele não é desenvolvedor).
  - **Passagem:** atualizar este documento a cada etapa.

## Próximos passos (depois das salas comuns)

### Conferência inicial no Codex — 18/10/2026

- Retomado o commit `1eebaa9`, na branch `codex/escritorio-proximo`, sem
  modificar as cenas deixadas pelo Claude. São 52 commits locais em relação
  ao `origin/main` disponível; o remoto ainda precisa ser atualizado antes
  de qualquer integração.
- Regeneração das cenas sem alteração de fonte; `npm run check` aprovado:
  463 testes, sintaxe, ordem global e build. O verificador não encontrou
  erros nas nove salas comuns. Os 56 avisos de desenho são dos padrões
  pessoais `sala-0` a `sala-8`, não das salas comuns refeitas.
- Conferência inicial em desktop (1280×720) de Foco, Auditório, Produção,
  Jogos, Academia e Lounge em 1× e detalhes em 2×. Navegação e zoom funcionaram,
  sem erros no console durante a sessão. Ainda não é uma aprovação visual
  do Paulo nem uma revisão exaustiva de cada canto ou do celular.
- Galeria local com composição e detalhes em:
  `/Users/paulomartins/.codex/visualizations/2026/09/07/01a07dec-ba57-7d53-a027-0b53cc92bfba/revisao-escritorio-2026-10-18/index.html`.
  Demonstração desta conferência: `http://127.0.0.1:4362/`.
- As 256 classes usadas pelo bloco composto têm JSON e PNG rastreados;
  nenhum dos arquivos extraídos não rastreados precisou ser adicionado.
- Não houve push, publicação, teste de mídia real ou escrita no banco.
  Continuam pendentes a revisão do Paulo, o transporte das regras ao editor
  e a decisão de devolução das moedas antes do segundo reinício.

1. **Paulo revisar as salas no navegador.** Todas as salas comuns já estão no
   motor: Café, Convivência, Reunião, Foco, Auditório, Produção, Jogos,
   Academia e Lounge. Corrigir o que ele apontar, sempre como regra no motor
   ou no verificador.
2. **Publicar** quando ele autorizar (PR, checks e preview, como diz o
   `CHECKLIST-DEPLOY.md`). Hoje está tudo só em commits locais na branch
   `codex/escritorio-proximo`.
3. **Levar as regras do motor para o editor do painel,** onde quem administra
   monta as salas vendo: frente conferida, caminho do Habbo, altura da
   escada, composição e coleção.
4. **Segundo reinício dos escritórios pessoais** (ver "Decisões"). Antes,
   perguntar se as VybeCoins gastas em móveis voltam.

## Decisões do Paulo que valem

- **Segundo reinício** (decisão de 18/10/2026):
  - depois dos espaços públicos e das regras no editor, zerar decoração e
    inventário dos escritórios pessoais, sem guardar cópia;
  - preservar saldo, XP e conquistas;
  - fazer em migração nova e revisável, aplicada só com o "Aprovado" dele (a
    de 17/10 não se repete).
  - **Decidido em 18/10/2026:** devolver as moedas gastas em móveis pelo valor
    de cada compra no razão. Paulo autorizou levar as regras ao editor,
    publicar e seguir o fluxo; melhorias visuais individuais das salas ficam
    para depois. O reinício usa migração nova, sem backup novo de decoração,
    preservando saldo anterior, XP e conquistas.
- **Segurança:**
  - nunca entrar em conta do Paulo (Habbo, Gmail), digitar senha nem
    automatizar a conta dele;
  - não abrir arquivos de login do Habbo nem descompilar o cliente do Habbo;
  - não copiar código GPL do Nitro ou do Arcturus: só portar regras.
- **Publicação** só com autorização do Paulo na hora. Banco de produção só
  com "Aprovado" dele.

## Onde está o trabalho

- **Branch:** `codex/escritorio-proximo`, com commits locais ainda não
  publicados (`git log origin/main..HEAD`).
- **Verificação:**
  - `npm run check` (463 testes passando em 18/10);
  - `node scripts/escritorio-compor.mjs` (gera as cenas e roda o verificador);
  - conferir no navegador: `npm run dev`, depois Escritório → sala.

## Continuação autorizada — editor e devolução (18/10/2026)

- Paulo revisou e apontou que as salas ainda têm problemas visuais. Pediu
  publicar esta etapa e deixar melhorias individuais para depois; não registrar
  as salas como visualmente aprovadas.
- `origin/main` atualizado e integrado no merge `8718603`: publicação #217 do
  Claude preservada, mantendo o motor, as nove cenas e as regras posteriores.
- O editor usa o mesmo verificador `scripts/escritorio-auditar.mjs`, agora
  importável sem executar a CLI. A ação consultiva `construcao-conferir` no
  endpoint existente valida permissão, camada e planta pelo servidor. Mostra
  apoio, frente, acesso, sobreposição e desenho; antes de salvar, pede revisão
  se houver problemas. Não bloqueia uma escolha visual intencional.
- Categoria **Da sala** reaproveita as classes da composição e da edição, sem
  catálogo paralelo. A edição preserva também o sétimo campo dos móveis
  (fundo, Wired, troféu e manequim), antes perdido ao abrir o editor.
- Migração `2026-10-18-escritorio-reinicio-reembolso.sql`: recibo único por
  compra (`reembolso:compra:<id>`), devolução do valor pago sem XP, inventários
  vazios, decoração/pintura/andares pessoais reiniciados, sem cópia nova.
  Salas comuns e seus históricos são preservados. O marcador impede repetir
  o reset e apagar compras posteriores.
- Testes isolados confirmaram reembolso, idempotência, preservação de XP,
  conquistas e cenas comuns. A verificação completa passou com 467 testes
  antes do ajuste final da posição do botão de conferência.
- **Concluído em 18/10/2026, 21h53 (Bahia):** PR #218 integrado em
  `26c4963cb0b2ad011146a54bc1200896c0a4f9ec`; Vercel
  `dpl_3C1HeMnhMw8u7fWNSygSMSHp4YT1` READY. Domínio oficial
  `https://vybepainel-v2.vercel.app` serve `7a23bafc3c66`, a mesma versão
  do preview `vybepainel-v2-jnpg4az3c-vybe-hub.vercel.app`.
- **Migração executada uma vez:** 8 perfis reiniciados, 5 camadas pessoais
  limpas, 16 unidades de inventário removidas. Não havia nenhum débito de
  compra no razão, portanto reembolso efetivo = 0; saldo total permaneceu
  14.897. Releitura confirmou inventário vazio, nenhuma camada pessoal com
  móveis, 58.787 XP, 78 conquistas e um marcador de reinício. Nunca repetir.
- **Validação final:** 469 testes passaram localmente, no CI do PR, no CI de
  main e no build da Vercel. Corrigidos dois pares de artes usados pelos
  testes do motor que o Claude havia deixado só no Mac (`xmas_c24_wallpaper`
  e `recycler_mantelbooks`); os demais extraídos continuam não rastreados.
  `git diff --check` aprovado. Preview e produção: versão HTTP 200,
  Escritório sem sessão HTTP 401, Monday HTTP 410. No navegador, entrada do
  preview e editor local com conferência do Café e filtro Da sala.
- **Limites:** a conferência no editor reaproveita o verificador consultivo;
  não é o gerador automático de receitas. Mídia real, revisão completa de
  celular e uso autenticado do editor no deployment não foram validados
  nesta etapa. Não houve escrita fictícia em produção.
- **Próximo trabalho:** melhorar cada sala individualmente a partir dos
  defeitos apontados pelo Paulo. O editor e o segundo reinício com regra de
  reembolso estão entregues; não repetir a limpeza ao continuar.

### Correção das plantas pessoais — 18/10, após revisão das escadas

- Em trabalho local na branch `codex/quartos-escadas-paredes`: as escadas da
  estrutura passam a ser desenhadas pela diferença real entre os pisos. A
  peça fixa de mobília não representava a subida inteira. Prévia e quarto
  usam a mesma geometria, sem alterar máscaras, portas ou móveis salvos.
- Paredes reentrantes que encobriam outro braço do quarto viram cortes baixos;
  os limites físicos continuam iguais. A parede padrão usa material oficial
  contínuo, evitando a faixa escura repetida em paredes mais altas.
- Regressões cobrem todos os modelos com escada, caminho até o patamar,
  quatro direções e recortes das plantas U, terraços e mirante.
- Conferência visual local: grade de prévias, quarto Terraços e Loft com
  mirante; console sem erros nessa conferência. `npm run check` aprovado
  (testes e build), assim como `git diff --check`. Não houve
  escrita em produção nem repetição do reset. Validação de caminhada aqui
  é automatizada; mídia não faz parte desta correção.

### Menus de construção e loja — 19/10/2026

- Branch `codex/editor-loja-clareza`, derivada da correção das escadas:
  Inventário e Loja são as entradas principais; saldo em carteira fixa na
  rolagem, categorias do inventário em seletor e filtros de localização
  preservados. Acervo compartilhado explica que não usa saldo pessoal.
- Barra de edição em duas linhas no desktop, ações de salvar/cancelar
  separadas das ferramentas, Salvar destacado e “Empilhar livre” no lugar
  do rótulo genérico Construtor. Reaproveita os mesmos handlers e permissões.
- Cartões da loja explicitam Comprar e preço por unidade; falta de saldo
  aparece no cartão. Preços por raridade ficam em detalhes recolhidos.
  Compras continuam no endpoint transacional existente, sem nova carteira.
- Revisão local do inventário, filtro Plantas e Loja. Compra fictícia de
  500 reduziu saldo de 700 para 200 e adicionou o móvel ao inventário; isto
  verifica a UI da demonstração, não persistência no banco de produção.
  Revisão de celular físico e mídia não realizadas nesta etapa.
- `npm run check`: 473 testes e build aprovados; `git diff --check` limpo.
  Também conferido o editor da Convivência e console sem erros. Entrega
  local, sem publicação ou alteração de dados reais.

### Grade de construção — revisão da gravação de 19/10/2026

- A comparação anterior de deslocamento não verificou a sobreposição visual:
  a grade (z=2) ficava sob os pisos decorativos, na faixa 1000–1899. O piso
  claro ainda reduzia o contraste. A gravação mostra a diferença entre a
  Convivência e o quarto pessoal mesmo com Grade ligada.
- Correção local em `codex/grade-construcao`: grade na faixa 1900, abaixo
  das paredes/móveis, traço mais legível com sombra de contraste. Nenhuma
  mudança na física, encaixe, classificação de móveis ou ordem Nitro.
- Prévia conferida na Convivência em 1×; os móveis continuam cobrindo a
  grade corretamente. Plataformas feitas com móveis mantêm sua profundidade;
  esta correção mostra a grade do piso base, não cria grade sobre mesas ou
  pisos suspensos. Não houve gravação em produção.
- Conferidos também o quarto individual e o console (sem erros nessa
  revisão). `npm run check`: 473 testes e build aprovados;
  `git diff --check` limpo. Ainda local, sem publicar esta correção.

### Inventário e seleção — continuação de 19/10/2026

- Retirado o número ambíguo da aba Inventário. O resumo distingue modelos
  gratuitos, unidades próprias e unidades guardadas (sem somar o estoque
  ilimitado dos essenciais). Filtro de origem: todos, essenciais e adquiridos;
  busca, localização e tipo continuam combinados no mesmo fluxo.
- A barra do móvel selecionado fica no rodapé acima dos controles de voz,
  com nome da peça e rolagem horizontal se necessário; não acompanha mais o
  móvel nem precisa de um loop de animação permanente para se posicionar.
- Navegador local: seleção de origem vazia, essenciais e colocação de cacto;
  barra fora da peça e console sem erros. Regressão verifica contagens e
  filtro de adquiridos. `npm run check` (473 testes e build) e diff aprovados.
  Sem escrita real; entrega local. Celular físico ainda não conferido.

### Cursor dos pisos públicos — gravação de 08h05 de 19/10/2026

- A gravação revela um defeito diferente da grade: `passarPonteiro` escolhia
  a origem do móvel sob o pixel, inclusive dos pisos decorativos 2×2. O
  cursor parecia saltar casas porque seguia a peça inteira, não o tile.
- `mapaAlvoCursor` mantém o tile do mouse para pisos/tapetes e preserva o
  alvo de interação dos outros móveis. Sem alterar física ou coordenadas
  salvas; não há mudança de escala ou de passo no editor.
- Navegador local na Convivência: quatro casas vizinhas produziram posições
  distintas (456,351), (488,367), (456,383), (424,367), um tile por vez.
  Regressões cobrem os quatro tiles do piso, chão vazio e móvel interativo.
  `npm run check`: 475 testes e build aprovados; diff limpo. Correção local
  em `codex/cursor-tiles-piso`, com a publicação #221 preservada na base.

### Criação e permissão dos quartos — 19/10/2026

- Decisão do Paulo: decoração privada só pelo dono (inclusive se quem visita
  administra); ambientes públicos e Praça só por Paulo. O servidor usa a
  identidade da sessão vinculada à sala-0, nunca um nome enviado pelo cliente.
  A checagem compartilhada protege salvar, imagens, histórico/restauração e
  conferência do editor; seletor visual também filtra as áreas permitidas.
- Tamanho vem antes dos formatos, com medidas, escolha atual e custo zero
  explícitos. Cartões mostram a descrição do tamanho exibido (antes herdavam
  a descrição da última/maior opção). Botão confirma o tamanho escolhido.
  Meu espaço mostra a planta atual e “Aumentar ou reformar meu quarto”.
- Modelo Essencial simplificado para mesa, computador, cadeira e tapete;
  os outros essenciais continuam disponíveis no inventário. Não alteramos
  quartos já salvos nem aumentamos a sala de Tainara automaticamente.
- Revisão local: Médio e Grande na criação, modelo Essencial no Pequeno,
  seletor de Paulo só com áreas públicas e próprio quarto. Regressões de
  autorização recusam administrador no quarto alheio e em áreas públicas.
  Persistência/contas reais, mídia e celular físico não foram testados.
- Verificação final: `npm run check` aprovado com 477 testes e build;
  `git diff --check` limpo. O teste antigo de gravação por administrador foi
  atualizado para a nova regra e também passou isoladamente. Entrega local
  em `codex/quartos-criacao-permissoes`, sem publicar ou alterar salas reais.

### Terceiro reinício dos quartos — 19/10/2026

- Pedido do Paulo: antes de publicar, todos refazem o quarto no novo
  criador e os quartos atuais são limpos.
- Migração `2026-10-19-escritorio-quartos-recriar.sql` (marcador
  `quartos-criacao-2026-10-19`): esvazia quartos pessoais e andares,
  inventário e pintura, marca `quarto_configurado=false` e devolve o preço
  das compras ainda não devolvidas (as já devolvidas em 18/10 ficam como
  estão). XP, conquistas, saldo anterior, salas comuns e Praça intactos.
  Teste: `tests/escritorio-quartos-recriar.test.mjs`.
- Ordem: publicar esta branch, conferir o site no ar e só então aplicar a
  migração uma vez em produção, com "Aprovado" do Paulo.
- **Executada em 19/10/2026**, depois da publicação #222 (site oficial
  conferido): 7 quartos configurados e 7 camadas pessoais esvaziadas, 1 móvel
  guardado removido, 1 compra ainda não devolvida (120 VybeCoins) devolvida.
  XP total igual antes e depois; salas comuns sem camada salva, intactas.
  Marcador `quartos-criacao-2026-10-19` gravado. Não repetir.

### Melhorias gerais após o vídeo do Paulo — 19/10/2026 (em andamento)

Branch `codex/escritorio-melhorias-gerais`. Pedido: cenários travando e
"mal feitos", melhorar a lista de salas, recriar os quartos iniciais e a
decoração inicial "bem feito".

- **Painel de conversa:** o título vem sempre do lugar atual
  (`escritorioTituloChamada`); antes ficava com o nome da sala anterior.
- **Lista de salas (lateral):** Espaços primeiro (Praça no topo), cada linha
  mostra quem está lá; quartos individuais num grupo recolhível. O cartão
  flutuante "Quem está onde" começa recolhido (não cobre a cena). Botões de
  quem está online quebram linha em vez de cortar.
- **Lentidão:** listas laterais só são refeitas quando muda lugar, status ou
  quem está online (a presença chega a cada passo); etiquetas dos bonecos
  idem. Móveis animados guardam cada quadro desenhado (`MAPA_CACHE_CAMADAS`,
  e `cacheDesenho` nos de parede) e o canvas só muda de tamanho quando precisa
  (eram ~170 redimensionamentos por segundo na Convivência).
- **Escada da planta:** degraus dentro do próprio ladrilho, com a madeira do
  piso (`mapaFaceDePiso`), lateral escondida ao lado do mezanino. Laterais do
  desnível em quarto pessoal usam o piso, não a cor da parede.
- **Guarda-corpo:** estado 1 da `hotel_c18_rail` (reto, sem pontas viradas),
  sem peças sobrepostas; trecho ímpar fica aberto do lado da escada.
- **Plantas:** Terraços e Loft com mirante perderam o vão escuro no piso.
- **Decoração inicial:** modelos redesenhados (mesa encostada, luminária e
  planta de um lado, estante do outro). `scripts/escritorio-quartos-modelos.mjs`
  calcula `ancoras` por planta (mesa no fundo, mesmo patamar, porta chega às
  cadeiras e a todo o quarto, pé da escada livre) e grava em `quartos.json`;
  servidor (`ancoraDoModelo`) e criador usam a mesma âncora. Modelo que não
  cabe numa planta não é oferecido nela (hoje só `niveis`/`niveis-m` ficam
  só com Em branco e Essencial). Teste: `tests/escritorio-quartos-modelos.test.mjs`.
- **Salas comuns (mesma branch):**
  - Foco: mezanino a 2 níveis e escada `hotel_c18_stairs` (pedra clara,
    3 degraus, conferida na vitrine e anotada em `frentes.json`) no lugar
    da pilha de `xmas_c18_stagestairs`; saiu o lustre de corrente longa.
  - Reunião: `mesaReuniao` ganhou `passo` (cadeira a cada 2 ladrilhos);
    8 lugares em vez de 14 e sem lustre sobre a mesa.
  - Academia: planta de 20 × 16 para 14 × 12; esteiras em duas fileiras,
    luz industrial só sobre os pontos de uso (1,2 nível mais alta).
  - Enquadramento: a altura dos patamares entra na conta e a 1× só abre
    quando cabe 92% (antes 80%; o Auditório abria cortado).
- Revisão das outras salas (pedido "revisa tudo antes de publicar"):
  - Café: saíram os dois lustres pendurados no salão (na altura do rosto
    ou tapando o balcão) e o garçom parado no corredor.
  - Auditório: saíram as treliças de luz na frente da tela e os
    projetores soltos no corredor.
  - Produção e Academia: luz industrial 1,2 nível mais alta.
  - Convivência: mezanino a 2 níveis e a mesma `hotel_c18_stairs` do Foco.
  - Praça: tocha tiki (com caveira, já reprovada) trocada por luminária de jardim.
  - Jogos e Lounge: revistos, sem mudança.
  - Regra nova no motor: peça pendurada desce no máximo até 3,5 níveis
    (antes 3; o boneco em pé tem ~3,4 e a luz ficava no rosto).
  - Celular: a lista em cartões segue a ordem da lateral (Praça e espaços
    comuns primeiro).
- Não verificado: título da conversa com chamada real (a demonstração não
  conecta voz) e desempenho com a equipe inteira online.

### Física e FPS — 19/10/2026 (tarde)

- Vídeo do Paulo no próprio quarto: dava para pular do mezanino atravessando
  o guarda-corpo e cortar na diagonal pela quina do patamar. `mapaPassa`
  agora não desce mais de 1,5 da borda de um patamar da planta (exceto para
  a soleira da porta) e não anda na diagonal quando os quatro ladrilhos não
  têm o mesmo nível. Pular de móvel empilhado continua livre.
- Auditório travando: a luz da sala era um filtro de CSS em cada canvas
  (289 no Auditório, 555 na Convivência) e o feixe do refletor andava por
  left/top. Agora móveis e paredes são pintados com a cor da luz uma vez
  (`tingir` em `vybe-escritorio-mapa.js`); o filtro ficou só no chão, nos
  bonecos, na paisagem e nas imagens da equipe; o feixe anda por transform.
  Teste: "luz da sala não vira filtro de CSS em cada móvel".
- Medição de FPS ao vivo não foi possível (aba do navegador em segundo
  plano); conferido o número de elementos filtrados e a aparência.

### Pessoas, ranking, perfil e edição — 19/10/2026

- Lateral: "Quartos da equipe" em cartões com o rosto do dono, ponto de status
  e quantas pessoas estão lá; clicar abre ver perfil, entrar no quarto,
  chamar para cá, convidar para conversar, ir até e recado
  (`abrirMenuQuartoEscritorio`).
- Barra da esquerda: "Ranking" (aba `ranking`) por XP, VybeCoins, móveis ou
  conquistas; clicar abre o perfil.
- Perfil de qualquer pessoa: VybeCoins, nível/XP, conquistas e inventário
  (`escritorioPerfilJogoHtml`); números de trabalho em seção à parte, só
  para a própria pessoa e quem administra.
- Edição do próprio quarto em quatro seções: Inventário, Loja (saldo
  compacto), Carteira (saldo, nível, marcos, preços) e Decorar (piso e
  paredes, imagens, conjuntos). A aba lateral virou "Edição".
- Teste: `tests/escritorio-perfil-ranking.test.mjs`. Conferência visual
  pendente pela prévia da Vercel (a aba local ficou em segundo plano).

### Inventário, troca e números da ficha — 19/10/2026 (noite)

- Inventário como o do Habbo: aba própria na barra da esquerda (sacola),
  fora da edição. Cada móvel mostra guardados e no quarto; ações colocar no
  quarto, trocar e dar de presente. Trocas: proposta (o que dá, o que pede),
  quem recebe aceita ou recusa, quem propôs cancela; aviso pelo balão
  (`trc=`). Servidor em `server/escritorio-social.js`, migração
  `2026-10-19-escritorio-trocas.sql` (**ainda não aplicada**), teste
  `tests/escritorio-trocas.test.mjs`.
- Ficha: números de trabalho vêm do servidor (`resumoTrabalho`), com as
  mesmas entregas do XP e da meta. Antes contavam só Solicitações no
  navegador e a Criação aparecia "sem demanda".
- XP da Gestão (pergunta do Paulo): a leitura do banco mostrou que a Gestão
  só tem como "entrega" o dia sem furo, então o bônus de chegada deu 1
  entrega ao Paulo (10 XP), enquanto Atendimento recebeu pela carteira
  (Vinícius 1.110, Ewerton 757) e Agendamento por 1.772 agendamentos. Desde
  a instalação (17/10, sábado) ainda não houve fechamento de dia útil, por
  isso dia sem furo e dia sem vencida ainda não apareceram (o primeiro é na
  virada de 19 para 20/10). Paulo criou 650 demandas com briefing desde
  31/08. Decisão pendente do Paulo: como a Gestão passa a ganhar.
- 19/10/2026: o ranking saiu (decisão do Paulo: sem comparação, sem
  estrelismo). O perfil de cada pessoa mostra nível, XP, moedas, marcos
  conquistados e inventário.

### Centro de Operação — 19/10/2026 (noite)

- Pedido do Paulo: os agentes de conteúdo de cada cliente viram NPCs, cada um
  na sua mesa com o nome do cliente. Sala comum nova `operacao` (22 × 15),
  montada pelo motor (`scripts/cenas/operacao.mjs`), na lista
  `DESENHO_CONFERIDO`, chat escrito da Convivência.
- Conceito: sala de controle. Fundo com telão (monitores e mapas) e relógios;
  duas fileiras de 8 estações dos dois lados do corredor da porta (16
  postos); na frente, a mesa de aprovação dos heads (esquerda) e a espera com
  café (direita). Mesma coleção da ilha de edição da Produção; telas variadas
  (`army_c15_deskcomp` e `computer_laptop` conferidos na vitrine em 19/10).
- Postos: o figurante com `posto` só aparece quando o painel põe ali um
  cliente ativo (`acao=operacao` de `area=planejamentos`; quem tem planejamento
  vem primeiro). Etiqueta com o nome do cliente e a situação; clique abre o
  planejamento. Para o head, a sala mostra na lista "N para você revisar".
- Zona `operacao` aceita no servidor, no editor, nos post-its e no Worker. As
  regras do banco são ampliadas pela migração
  `2026-10-20-planejamentos.sql` (aplicada em 19/10/2026). Worker publicado em
  19/10/2026 (código colado pelo Paulo no editor da Cloudflare, versão de
  `services/escritorio/worker.js` do #230).
- Pendente: Paulo conferir a sala no zoom; com mais de 16 clientes ativos, os
  que sobram ficam sem mesa (o Escritório avisa).

### Música em toda jukebox — 19/10/2026 (noite)

- Pedido do Paulo: toda jukebox ou objeto que faz música abre o nosso player
  do YouTube, não só no Lounge. Fila por sala no Worker (`musica:<zona>`; o
  Lounge mantém a fila guardada). A lista de aparelhos é `ESCRITORIO_SOM`.
  Instrumentos (piano, guitarra, bateria) ficaram de fora, porque não tocam
  gravação. Teste no `tests/escritorio.test.mjs` (Worker com filas
  separadas). Worker publicado em 19/10/2026.

### Agentes fantasiados — 19/10/2026 (noite)

- Cada agente do Centro de Operação veste a fantasia do segmento do cliente
  (`ESCRITORIO_FANTASIAS`, peças escolhidas vendo a arte do Habbo) e senta de
  frente para quem entra. Etiqueta com nome e ponto; situação no hover.
- Publicar o Worker: o login da Cloudflare pelo Terminal falhou neste Mac; o
  caminho que funcionou foi colar `worker.js` (arquivo único) em Workers →
  vybe-escritorio → Editar código → Implantar. Conferir com `/health`.

### Clientes cobrando nos quartos — 19/10/2026 (noite)

- Brincadeira pedida pelo Paulo: o cliente da demanda que pede ação vai ao
  quarto de quem deve agir e reclama em balão (`server/escritorio-cobrancas.js`,
  rota `escritorio/cobrancas`, `vybe-escritorio-missoes.js`).
- Quem é cobrado:

  | Situação da demanda | Quem é cobrado |
  | --- | --- |
  | Atrasada ou vencendo | o responsável |
  | Aprovação interna ou Falta D.A. | o Deivid |
  | Para agendar com a veiculação chegando ou passada | o agendamento |
  | Sem responsável | o head do cliente |
  | Esperando o próprio cliente | o cliente vai ao quarto do head pedir "me cobra" |

- Quando cobra: 1 dia de atraso; demanda do dia depois do meio-dia (Bahia);
  prazo amanhã sem ter começado.
- Decisões do Paulo: todos no quarto veem; sem limite (muita coisa vira
  protesto); sem exceção de foco.
- Um cliente grita por vez, em rodízio. Clique abre a demanda. Resolvida, o
  cliente agradece e vai embora.
- 19/10 (noite, depois do teste do Paulo):
  - um boneco por cliente, com a quantidade de demandas no nome, e o quadro
    "Cobrando neste quarto" na coluna, com cada demanda e o motivo;
  - fantasia por cliente, pelo que cada um é (títulos das demandas): VOA
    estilista, Lions leão (`ha-5379`), Gonzalez chef de avental, Serra Grande
    motorista, Antonov atleta, Mangaba dev de moletom, Alpha1 técnico de TI;
    o segmento fica de reserva;
  - óculos em preto viram óculos escuros: usar a cor 1408.

### Interface de jogo — 19/10/2026 (noite)

- Pedido do Paulo: todas as telas do Escritório com cara de jogo, fluidas e
  com hierarquia. As áreas comuns servem para explorar e bater papo, então quem
  está online aparece sem precisar rolar.
- Camada visual única no fim de `vybe-styles.css` (tokens `--jg-*`): trilho,
  lateral, abas, botões com relevo, inventário em slots, cartões da loja com o
  brilho da raridade, barra do editor, missões, Meu espaço, criador e diálogos.
  Respeita `prefers-reduced-motion`.
- Navegador de salas (`vybe-escritorio.js`), em ordem de importância:
  1. faixa do Centro de Operação (sala principal), com contadores;
  2. "Agora no escritório": só as salas e os quartos ocupados, com rostos,
     nomes e Entrar;
  3. "Espaços", em grade de 3 com a arte do Habbo de cada sala
     (`ESCRITORIO_ARTE_SALA`, desenhada pelo próprio motor do mapa);
  4. "Quartos da equipe".
- "Fora do escritório" vira uma lista que abre e fecha. A placa do topo ganha
  o emblema da sala.
- Ao construir, a coluna de cobranças e missões sai da frente da sala. Em telas
  médias a barra do editor esconde a dica.

### Zoom e catálogo — 19/10/2026 (noite)

- Zoom: cada troca de nível (0,5×/1×/2×) leva 220 ms, com o ponto sob o
  cursor parado na tela. Um gesto do trackpad troca um nível só; o embalo não
  pula outro. A variável `--contra` dos letreiros só muda em passos de 5%:
  mudar a cada quadro recalculava o estilo de todos e travava a animação.
- Catálogo (botão na barra, fora da construção): todos os móveis com filtro
  por raridade (com contagem), ordem por preço ou raridade, categoria, busca
  e "Só o que dá para comprar". O clique abre a mesma prévia da loja.
  Comprar fora do editor manda o móvel para o Inventário; os essenciais
  grátis continuam no editor do quarto.
- Agentes do Centro de Operação (Paulo: "não precisa supor nada"): cada
  fantasia vem da marca real, conferida no Instagram de cada cliente (lista
  "Seguindo" da @asuavybe, bio e logo), nas contas de anúncio da Vybe e no
  Drive. Roupa nas cores da marca e peça que diz o que o cliente é. O Alpha1
  é o lobo do mascote (máscara `fa-3771`). Cada agente tem um bordão do
  próprio perfil; um fala por vez. Use as cores comuns da paleta: as do clube
  não pegam no top feminino nem no blazer.
- Pendente: redesenhar o Centro de Operação com espaço livre para a equipe
  trabalhar.

### Construção e catálogo mais claros — 19/10/2026 (noite)

- Um catálogo só, com as mesmas peças na construção (Inventário, Loja,
  acervo) e no Catálogo da barra. Tem categorias em seções (Atalhos, Móveis,
  Decoração, Ambientes, Construção, Jogos e efeitos, Estilos e coleções) e as
  faixas de raridade como filtro à parte, com contagem.
- A Vitrine da semana é uma categoria (a padrão da Loja), não um bloco fixo
  no topo, que escondia a troca de categoria.
- Cartão compacto, 3 por linha: nome e uma linha com faixa e preço (ou
  quantos são seus, no Inventário). O clique sempre abre a ficha (animação,
  onde fica, uso) com Comprar e/ou Colocar. Arrastar continua colocando direto.
- Barra do editor numa linha (área, ferramentas, ajudas, histórico, Mais e
  Salvar). A instrução do momento ("Estante na mão · clique no piso…") fica
  numa faixa abaixo, com Cancelar. Peça de parede pede o piso junto da parede.
- A Carteira cabe na lateral.

### Centro de Operação com lugar para o time — 19/10/2026 (noite)

- A sala cresceu para 26×18 e foi redesenhada (`scripts/cenas/operacao.mjs`):
  - os 16 agentes ficam à esquerda;
  - à direita, 6 mesas livres do time, separadas do corredor por canteiros;
  - a parede de servidores fica no fundo à direita;
  - na frente: a mesa de aprovação com estante e globo, o balcão iluminado
    para conversar em pé e a espera com aquário.
- Nada alto em cima das mesas: as luminárias tapavam o rosto de quem está
  sentado. O verificador agora cobra isso. A mesa pode cobrir o corpo, mas o
  que está em cima dela não pode tapar o rosto. A luz vem de luminárias de
  chão ao lado das cadeiras e de pendentes na frente das fileiras.
- Se houver camada salva da sala `operacao` no banco, ela vale no lugar deste
  padrão (regra das salas comuns).
- Caminhada: o imager do Habbo só troca o passo com o parâmetro `frame`; com
  `frame_num` os 4 quadros vinham iguais e o boneco deslizava. Corrigido, com
  teste (`tests/escritorio-boneco.test.mjs`).
- Clientes visitantes folgados (Paulo): metade senta nos assentos livres e os
  outros ficam de pé com folga. A cada 4 s um deles anda pelo caminho do mapa
  até outro lugar ou senta. Só se amontoam no meio quando falta lugar.
- Filtros do catálogo: a entrada do escritório traz a carteira sem a tabela da
  loja; ao abrir o Catálogo ela é buscada (`garantirLojaEscritorio`). Antes,
  no site, tudo parecia comum a 25 moedas e as faixas sumiam. A lista longa de
  categorias virou duas fileiras de fichas (seção e categorias dela, com
  contagem). "Dá para comprar" vira ficha, e a ordem fica no topo da lista.

### Painel do agente e cobrança — 19/10/2026 (noite)

- Clicar no cliente que cobra num quarto abre primeiro um cartão com o que ele
  cobra (motivo, título, status). Cada demanda abre inteira na gaveta.
- O painel do agente (Centro de Operação) reaproveita o painel, sem regra nova:
  - números do cliente de `clientMasterRecords` (a conta da tela de Clientes);
  - o quadro de planejamentos da ficha do cliente (documento para revisar e
    mandar ao cliente, "Começar um planejamento aqui");
  - "pede atenção" com os avisos do servidor, uma linha por peça;
  - portas para a ficha do cliente e para a Agenda mensal filtrada no
    cliente (onde há a visão do quadro).
- Regra (Paulo): demandas, contagens e calendário usam o que o painel já tem.
  Não escrever outro calendário nem outra leitura de status no Escritório.

### Janela do catálogo, inventário, zoom contínuo e agenda do cliente — 19/10/2026 (noite)

- Catálogo e Inventário viram uma janela só, como no Habbo: abas Loja e
  Inventário. A Loja tem árvore de categorias, busca, faixas de raridade,
  "À venda agora" e ordem. O Inventário mostra os seus, os guardados, os no
  quarto e as Trocas (`escritorioTrocasHtml`). O clique abre a ficha
  (comprar, colocar, trocar, dar de presente). As abas antigas da lateral
  saíram. Na construção, a lateral tem caixa de categoria agrupada e
  raridade, mais "Abrir o catálogo completo".
- "Fora da vitrine" virou "Só na vitrine". A ficha explica que épicos e
  lendários só se compram na semana em que entram na vitrine (troca na
  segunda).
- Zoom contínuo entre 0,5× e 2× durante o gesto, ancorado no cursor. O ímã
  encaixa em 0,5×/1×/2× ao soltar perto deles. Os botões vão de nível em
  nível. AGENTS.md atualizado.
- Painel do agente: resumo da Agenda mensal do cliente com as funções da
  própria Agenda (`managerCalendarItems`, `managerCalendarMonthMeta`, cores
  e `managerCalendarOpen`). Só o desenho é do Escritório.
- Melhorias seguintes (Paulo: "faça todas as melhorias"):
  - na janela, a ficha abre na coluna da direita, sem outra janela por cima
    (no celular, sobe como folha);
  - comprar fora da construção abre o editor do quarto com o móvel na mão;
  - no próprio quarto, a lateral da construção tem só as abas Móveis,
    Carteira e Decorar. Móveis traz busca, "Usados por você" para arrastar e
    as portas para o inventário e a loja. Os essenciais grátis ficam em
    Inventário → Essenciais grátis;
  - os filtros antigos do inventário da lateral (`escritorioFiltrarMeus`)
    saíram, sem segunda versão.
- Construção só para construir (Paulo: "tá tudo meio ruim aí"): no próprio
  quarto, a lateral tem Móveis e Piso e paredes.
  - Móveis: os seus e os grátis numa grade, com busca e "Tudo · Meus ·
    Grátis"; os usados por último vêm primeiro.
  - Embaixo: "Comprar mais na loja" e "Trocas e presentes".
  - A Carteira saiu da construção: é a terceira aba da janela (Loja ·
    Inventário · Carteira), e o saldo no topo leva até ela.

### Painel do agente, Agenda e demandas editáveis — 20/10/2026

- **Painel do agente** (`pintarAgenteOperacaoEscritorio`): cabeçalho numa faixa
  com o boneco do agente na fantasia do cliente e a etiqueta da carteira. Os
  números viram abas que trocam a lista da direita: atrasadas
  (`prazo_atrasado`), para aprovar, esta semana (`dataDoCartaoDia`) e
  esperando o cliente (`riskActionOwner`). O padrão é "Próximas peças".
  "Pede atenção" vazio vira uma linha. O calendário ganhou legenda.
- **Agenda** na barra lateral (`abrirAgendaEscritorio`): a semana do Google
  Agenda da Vybe, só leitura. Usa a mesma consulta da Produção
  (`area=agenda_producao`), agora aberta a toda a equipe com sessão (estações
  abertas). Evento privado, pessoal, folga, férias e aniversário continuam
  fora; o diagnóstico da conta de serviço segue só com quem administra.
- **Demandas no jogo abrem o cartão rápido do painel** (`abrirMissaoEscritorio`
  → `abrirCartaoRapido`): status, datas, responsável, prioridade, renomear e
  "…" com Arquivar; "Abrir detalhes" leva à gaveta. Vale para missões,
  cobranças, painel do agente e calendário. Sem a peça carregada, abre a
  gaveta como antes.
- **Clientes que cobram, com o significado certo dos status** (Paulo,
  20/10/2026): "Aguardo" é esperar marcar a gravação com o cliente, e não o
  cliente mandar algo. Virou o pedido `marcar_gravacao` (vai para o head, como
  lembrete). "Ag. Aprovação Cliente" fala de aprovação. O balão de quem fala
  leva a cor do status da demanda (`v.cores` em `montarVisitantes`). Mudou uma
  demanda no painel (`renderOutboundItemPatch`): o Escritório reconsulta
  cobranças e missões em 2,5 s, e o cliente zerado agradece e sai.
- **Coluna da direita**: cobranças, missões e música dividem a altura da
  coluna; o cabeçalho fica sempre à vista e só a lista rola. Nada vaza por
  baixo da barra nem do aviso.
- **Veiculação chegou e a peça nem começou** (Paulo, 20/10/2026): novo pedido
  `postar_parada` em `server/escritorio-cobrancas.js`. Status A Fazer, Pode
  Fazer ou Nova demanda com veiculação hoje ou já passada manda o cliente ao
  quarto do head (sem head, gestão), dizendo quem está com a peça (`com`), para
  o head cobrar. Uma peça aparece uma vez por pessoa; "vence" agora exige
  prazo amanhã de forma explícita.
- `postar_parada` vai também a quem tem as funções agendamento e gestão
  (`vybe_escritorio_funcoes`; hoje Tainara e Paulo), além dos heads do cliente
  (Paulo, 20/10/2026: eles cuidam do dia a dia do que posta e entrega).

### Ficha como HUD de jogo — 20/10/2026

- `abrirFichaEscritorio` virou HUD: topo com o personagem, selo do nível, barra
  de XP e moedas; abas Resumo, Como ganhar, Conquistas, Inventário e Trabalho
  (as duas de números só para a própria pessoa e quem administra).
- O servidor manda `ganhos` (7 dias agrupados por regra) e `regras` da função
  (`regrasDaFuncao`, tabela `vybe_escritorio_regras`): a ficha explica de onde
  vem cada coisa sem valor no código. Cada regra cai num grupo só.
- Conquistas mostram o móvel de prêmio como medalha.

### Fantasias dos clientes e avatar editável — 20/10/2026

- Fantasias refeitas (Paulo): Copirecê é a Zene (foto em Drive/FOTOS ZENE:
  cachos, óculos, vestido longo laranja florido, pipoca); Serra Grande é
  motorista no estilo Heineken (boné e camisa verdes, lata verde); VÖA e
  Antonov com roupa de academia e garrafinha; ConectaSim técnico com fone e
  tablet. Cada fantasia tem um objeto de mão (5º campo, "crr" do Habbo,
  conferido no gerador de imagens).
- "Editar avatar" no painel do agente (head do cliente e quem administra):
  abre o mesmo criador dos jogadores com destino no cliente e escolha do
  objeto de mão; salva em `vybe_clientes.identidade.personagem`
  (`area=planejamentos&acao=personagem`). Salvar a identidade preserva o
  personagem. Vale para o agente e para o cliente que visita os quartos.

### Objeto de mão, rolagem com chamada e conquistas com objeto — 20/10/2026

- Jogadores escolhem o objeto de mão no criador (perfil `mao`, só `crr=N`);
  café/lanche da pose vale por cima (#263).
- `renderEscritorio` só põe `body.no-escritorio` com o painel na tela: com a
  chamada ligada ele se redesenhava por trás e travava a rolagem do painel
  (Deivid, duas telas; #264).
- Toda conquista dá um móvel (tabela em `docs/escritorio-pontos.md`), com dez
  conquistas novas por fazer as coisas (adiantado, de primeira, semana sem
  atraso, planejamento aprovado, presente, troca, segundo andar, post-its).
  `2026-10-20-escritorio-conquistas.sql` (marcador `conquistas-2026-10-20`)
  devolve, uma vez, o móvel a quem já tinha a conquista: os reinícios de
  18 e 19/10 apagaram os troféus.
- Bolo por peça (Paulo, 20/10/2026): fatias por papel, Mizinho em toda foto e
  vídeo, DA com 10% da Criação, recomeço com o histórico refeito. Detalhes em
  `docs/escritorio-pontos.md`; migração `2026-10-20-escritorio-bolo-por-peca.sql`
  (marcador `bolo-2026-10-20`) e as compras descontadas
  (`2026-10-20-escritorio-bolo-compras.sql`), aplicadas em 20/10/2026 depois do
  OK do Paulo (#266), com as conquistas refeitas no meio. Saldo e XP batem com o razão.

### Ranking, ficha do móvel nova e barra do jogo — 20/10/2026

- Ranking da semana (Paulo mudou a decisão de 19/10): botão Ranking, abas
  Geral (% da meta), XP da semana, Por atividade e Agência; pódio e bônus
  pagos no fechamento da semana (`2026-10-20-escritorio-ranking.sql`).
- Ficha do móvel redesenhada e imediata: dono com a fotinha, raridade, preço,
  origem com ícones, "Ver no catálogo"; a origem é buscada já ao passar o
  mouse (rota leve, sem carregar o escritório inteiro). Brilho no móvel sob o
  mouse. Assento e cama abrem a ficha com Sentar/Deitar; duplo clique senta.
- "Minha sala" e "Painel" em destaque na barra de baixo.
