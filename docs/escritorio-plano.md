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
   - **Foco**: biblioteca com mezanino e escada. A fazer.
   - **Auditório**: teatro com balcão. A fazer.
   - **Produção**: estúdio de foto e vídeo. A fazer.
   - **Jogos**: fliperama escuro com neon. A fazer.
   - **Academia**: moderna, com tijolo vermelho e vidro. A fazer.
   - **Lounge**: por último, também do zero. Não remendar a versão antiga.
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

## Decisões do Paulo que valem

- **Segundo reinício** (decisão de 18/10/2026):
  - depois dos espaços públicos e das regras no editor, zerar decoração e
    inventário dos escritórios pessoais, sem guardar cópia;
  - preservar saldo, XP e conquistas;
  - fazer em migração nova e revisável, aplicada só com o "Aprovado" dele (a
    de 17/10 não se repete).
  - **Falta decidir:** as VybeCoins gastas em móveis voltam ou não? Perguntar
    antes de preparar.
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
  - `npm run check` (461 testes passando em 18/10);
  - `node scripts/escritorio-compor.mjs` (gera as cenas e roda o verificador);
  - conferir no navegador: `npm run dev`, depois Escritório → sala.
