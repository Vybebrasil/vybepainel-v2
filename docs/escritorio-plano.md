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

**A fazer, aprovado:**
1. **Tirar a cota de "riqueza"** (peças ≥ 0,45 × área em `fechar()`) e trocar
   por regras de composição:
   - toda peça pertence a um canto declarado, com função e ponto de destaque;
   - mesinha leva no máximo um ou dois objetos que façam sentido para o uso;
   - há limite para repetir a mesma peça;
   - guarda-corpo leva decoração com ritmo, ou nenhuma.
2. **Ensinar o motor a fazer quartos como a garagem:**
   - peça de chão montada na parede na altura certa (moto, guitarra),
     conferindo que encosta nela;
   - "composição intencional": dentro do mesmo conjunto uma peça pode tapar
     a outra (garrafas na prateleira na frente da geladeira); a foto cobra a
     peça principal do conjunto;
   - miudeza de chão (papel amassado, mancha, cone, pneus) permitida dentro de
     um canto, e não espalhada;
   - parede dividida em vãos por pilares, cada vão com um tema;
   - extrair as peças que faltarem do acervo, já permitido (`scripts/habbo-extrair.mjs`).
3. **Refazer a Convivência** pelo processo novo, levando o projeto ao Paulo
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
  - `npm run check` (456 testes passando em 18/10);
  - `node scripts/escritorio-compor.mjs` (gera as cenas e roda o verificador);
  - conferir no navegador: `npm run dev`, depois Escritório → sala.
