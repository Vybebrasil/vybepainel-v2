// Famílias de móveis que ficavam sem receita (redesign r4, quadros 34 e 35, 11/11/2026). Medido no catálogo da Loja:
// 4.252 das 8.887 peças de chão caíam no volume liso genérico e a Loja virava uma grade de blocos parecidos. Pelos
// nomes do catálogo (classe e nome, sem renomear nada) as famílias mais comuns que sobravam são estas: estátua,
// boneco, bicho e pelúcia, arco e portão, cabine de teleporte, barraca e casinha, balão, bolo e comida, ovo, abóbora,
// vaso e garrafa, pedra e cristal, barril e balde, cortina, janela solta, bandeira e bandeirola, cavalete, aquário,
// bola e dado, boneco de neve, sacola e cesta, palco e pódio, coluna, cerca e muro, fogueira, veículo, banheira e
// piscina, guarda-sol, cogumelo, relógio de chão, instrumento, disco, lápide e escada.
// Só valem para a peça que nenhuma regra antiga reconhece (tipoModelado olha estas por último), então nenhum móvel
// que já tinha receita muda. Mesma convenção do motor: frente +z, centro da pegada em 0, base 0, grade de 1/16; as
// cores são as da arte (principal, segunda, acento) e a altura, quando a arte diz, é a dela (altoArte).
export const TIPOS_FAMILIAS = [
  ['disco', /sound_?set/], // os discos de música vêm antes de qualquer palavra do nome ("Yngvie Van Halen" não é van)
  ['ovo', /(^|[_ ])egg|(^|[ _])ovos?($|[ _])|(^|[_ ])nest($|[_ ]|s|\d)|ninho/],
  ['abobora', /pumpkin|abóbora|abobora|jack.?o.?lantern/],
  ['bolo', /cake|(^|[_ ])bolo|cupcake|(^|[_ ])pie($|[_ ])|torta|muffin|donut|rosquinha|dessert|sobremesa/],
  ['comida', /food|lunch|sushi|bread|(^|[_ ])p[ãa]o($|[ _])|toast|torrad|pizza|burger|hamb[uú]rguer|sandwich|sandu[ií]che|candy|candies|sweets|doces|chocolate|choco|cookie|biscoit|fruit|fruta|apple|ma[çc][ãa]|banana|melon|melancia|cheese|queijo|icecream|ice_cream|sorvete|picnic|piquenique|tray|bandeja|meal|refei/],
  ['balao', /balloon|bal[ãa]o|bal[õo]es/],
  ['bola', /bomb|(^|[_ ])ball|bola($|[ s_])|orb($|[_ ]|\d)|sphere|esfera|discoball/],
  ['dado', /dice|(^|[_ ])die($|[_ ])|(^|[ _])dados?($|[ _])/],
  ['neve', /snowman|snow_?man|boneco de neve|bonecos de neve/],
  ['cabine', /teleport|teletransport|(^|[_ ])tele($|[_ ]|\d)|booth|cabine|phonebox|elevator|elevador|scanner/],
  ['aquario', /aquarium|aqu[áa]rio|fish_?tank|terrarium|terr[áa]rio|vivarium|ant_?farm|formigueiro/],
  ['bicho', /(^|[_ ])duck($|[_ ]|s|\d|y)|pato|penguin|pinguim|rabbit|bunny|coelh|(^|[_ ])cat($|[_ ]|s|\d)|kitten|gat[oa]($|[ s_])|gatinh|(^|[_ ])dog($|[_ ]|s|\d)|puppy|cachorr|bear|urso|teddy|plush|pel[uú]cia|dragon|drag[ãa]o|horse|cavalo|pony|p[ôo]nei|(^|[_ ])lion|le[ãa]o|leãozinho|(^|[_ ])owl|coruja|reindeer|(^|[ _])rena($|[ s_])|unicorn|unic[óo]rnio|monkey|macaco|fish|peixe|(^|[_ ])carp|carpa|frog|sapo|(^|[_ ])pig($|[_ ]|s|\d)|porc[oa]|(^|[_ ])cow|(^|[ _])vaca|(^|[_ ])bird|p[áa]ssaro|passarinho|chick|galinha|pintinho|elephant|elefante|turtle|tartaruga|dino|(^|[_ ])bee($|[_ ]|s|\d)|abelh|(^|[_ ])fox|raposa|wolf|lobo|tiger|tigre|panda|shark|tubar[ãa]o|octopus|polvo|crab|caranguejo|snail|caracol|(^|[_ ])bat($|[_ ]|s|\d)|morcego|spider|aranha|snake|cobra|deer|cervo|sheep|ovelha|goat|(^|[_ ])bode|mouse|(^|[_ ])rat($|[_ ]|o|s)|hamster|parrot|papagaio|flamingo|swan|cisne|whale|baleia|dolphin|golfinho|(^|[_ ])seal|foca|walrus|morsa|camel|camelo|giraffe|girafa|zebra|kangaroo|canguru|koala|sloth|pregui[çc]a|hedgehog|ouri[çc]o|squirrel|esquilo|kougra|acara|neopet|jaguar|on[çc]a|animal|bicho|habbo?ween_?bat|ladybug|joaninha|butterfl|borboleta|jellyfish|[aá]gua-viva|seahorse|cavalo-marinho|peacock|pav[ãa]o|toucan|tucano|crocodil|jacar[ée]|hippo|hipop[óo]tamo|rhino|rinoceronte|gorilla|gorila|yeti|monstr|monster|creature|criatura/],
  ['estatua', /statue|est[áa]tua|sculpt|escultura|(^|[_ ])bust|busto|(^|[_ ])idol|[íi]dolo|totem|gargoyle|g[áa]rgula|monument|monumento|zodiac|zod[íi]aco|(^|[_ ])skull|caveira|cr[âa]nio|mask|m[áa]scara|(^|[_ ])head($|[_ ]|s|\d)|cabe[çc]a/],
  ['boneco', /doll|boneca|boneco|matriosc|matryosh|figurine|figura|(^|[_ ])figure|skeleton|esqueleto|ghost|fantasma|zombie|zumbi|robot|rob[ôo]|android|knight|cavaleiro|armou?r|armadura|(^|[_ ])elf|elfo|angel|anjo|gnome|gnomo|santa|noel|fairy|(^|[ _])fada|mermaid|sereia|pirat|(^|[_ ])god($|[_ ]|s|\d)|deus|(^|[_ ])king|(^|[ _])rei($|[ _])|queen|rainha|alien|(^|[_ ])mummy|m[úu]mia|vampir|witch|bruxa|wizard|mago|clown|palha[çc]o|ninja|samurai|soldier|soldado|guard($|[_ ]|s|\d)|scarecrow|espantalho|mannequin|manequim|puppet|fantoche|nutcracker|quebra-nozes|garçon|waiter|gar[çc]om/],
  ['cortina', /curtain|cortina|drape|cortinado|(^|[_ ])beads|mi[çc]angas|backdrop|cen[áa]rio de fundo|veil|v[ée]u|tapestry|tape[çc]aria|(^|[_ ])cloth($|[_ ]|s)|tecido|lençol|sheet/],
  ['arco', /(^|[_ ])arch($|[_ ]|\d|way|es)|(^|[ _])arco($|[ s_])|rainbow|arco-[íi]ris|(^|[_ ])gate|port[ãa]o|portal|(^|[_ ])door|(^|[ _])porta($|[ _])|doorway|torii/],
  ['casinha', /house|(^|[ _])casa($|[ _]de|inha)|casinha|building|pr[ée]dio|edif[íi]cio|fachada|facade|cottage|chal[ée]|cabana|(^|[_ ])hut($|[_ ]|s|\d)|castle|castelo|tower|torre|church|igreja|lighthouse|farol|maquete|igloo|iglu|temple|templo|shrine|santu[áa]rio|pagod|pagode|windmill|moinho|birdhouse|kennel|casinha/],
  ['barraca', /tent($|[_ ]|s|\d)|barraca|tenda|stall|kiosk|quiosque|banquinha|banca($|[ _])|(^|[_ ])stand($|[_ ]|s|\d)|cart($|[_ ]|s|\d)|carrinho|awning|toldo|canopy|gazebo|pergola|p[ée]rgola|trellis|treli[çc]a|cub[íi]culo|cubicle|(^|[_ ])shop($|[_ ]|s|\d)|lojinha/],
  ['janela', /window|janela|vitral|(^|[_ ])glass_?wall|parede de vidro/],
  ['vaso', /vase|(^|[ _])jarr|jar($|[_ ]|s|\d)|urn($|[_ ]|s|\d)|urna|bottle|garrafa|amphora|[âa]nfora|(^|[_ ])pot($|[_ ]|s|\d)|pote($|[ s_])|potion|po[çc][ãa]o|jug($|[_ ]|s|\d)|(^|[ _])jarro|cauldron|caldeir|chaleira|teapot|kettle|(^|[_ ])mug|caneca|(^|[_ ])cup|x[íi]cara|copo|(^|[_ ])glass($|[_ ]|es)|ta[çc]a|spray|tinta|paint(?!ing)|perfume|candle?stick|castiçal/],
  ['cristal', /crystal|cristal|(^|[_ ])gem($|[_ ]|s|\d)|gema|jewel|joia|j[óo]ia|ruby|rubi|emerald|esmeralda|sapphire|safira|amethyst|ametista|quartz|quartzo|(^|[_ ])ice($|[_ ]|block|\d)|gelo|iceberg|glacier/],
  ['pedra', /rock|stone|pedra|rocha|boulder|fossil|f[óo]ssil|meteor|meteoro|pebble|seixo|cave($|[_ ]|s|\d)|caverna|coral|concha|shell($|[_ ]|s|\d)|anemone|an[êe]mona|geode|geodo|volcan|vulc[ãa]o|cliff|penhasco|mound|monte($|[ _])/],
  ['barril', /barrel|barril|(^|[_ ])keg|tonel|bucket|balde|(^|[_ ])tub($|[_ ]|s|\d)|cuba|tank($|[_ ]|s|\d)|tanque|cask/],
  ['bandeirola', /bunting|bandeirol|garland|guirlanda|pennant|fl[âa]mula|festiveflags|flags($|[_ ]|\d)|bandeirinhas/],
  ['bandeira', /flag|bandeira|banner|estandarte/],
  ['cavalete', /easel|cavalete|canvas|tela de pintura|(^|[_ ])art_?stand|quadro($|[ _]|s)|painting|pintura|poster|p[ôo]ster|frame|moldura|picture|foto|photo|(^|[_ ])board|billboard|placa|(^|[_ ])sign|plaque|shield|escudo|badge|emblema|(^|[_ ])map($|[_ ]|s|\d)|(^|[ _])mapa/],
  ['sacola', /(^|[_ ])bag($|[_ ]|s|\d)|bonusbag|sacol|bolsa|(^|[_ ])sack|saco($|[ s_])|saquinho|backpack|mochila|purse|suitcase|mala($|[ s_])|luggage|bagagem|seed|semente|kit($|[_ ]|s|\d)/],
  ['cesta', /basket|cesta|cestinha|hamper|crib|ber[çc]o|cradle/],
  ['palco', /stage|palco|platform|plataforma|podium|p[óo]dio|(^|[_ ])deck($|[_ ]|s|\d)|deque|pier|píer|bridge|ponte|dock|doca|ramp|rampa|catwalk|passarela|dais|tablado|altar/],
  ['escada', /stair|escada|ladder|degrau|steps($|[_ ])/],
  ['coluna', /pillar|column|coluna|pilar|obelisk|obelisco|pedestal|pilastra|post($|[_ ]|s|\d)|poste|(^|[_ ])pole|mastro|lamppost|bollard|baliza|hydrant|hidrante|mailbox|caixa de correio/],
  ['cerca', /fence|cerca|railing|(^|[_ ])rail($|[_ ]|s|\d)|balaustrada|balustrade|grade($|[ s_])|grid($|[_ ]|\d)|hedge|sebe|barrier|barreira|(^|[ _])corda|(^|[_ ])rope|wall($|[_ ]|s|\d)|muro|(^|[ _])parede|divider|divis[óo]ria|screen|biombo|partition/],
  ['fogueira', /fire($|[_ ]|place|pit|works|s|\d)|(^|[_ ])fogo|fogueira|campfire|bonfire|brasa|flame|chama|torch|tocha|heater|aquecedor|(^|[_ ])lava($|[_ ]|\d)|grill|churrasq|barbecue|(^|[_ ])bbq|fog[ãa]o|forge|forja|furnace|fornalha|smoke|fuma[çc]a|(^|[_ ])steam($|[_ ])|vapor|boiling/],
  ['veiculo', /(^|[_ ])car($|[_ ]|s|\d)|carro|kart|(^|[_ ])train($|[_ ]|s|\d)|(^|[ _])trem($|[ _])|locomot|wagon|vag[ãa]o|carro[çc]a|carriage|boat|barco|ship|navio|canoe|canoa|raft|jangada|submarin|bike|bicicleta|bicycle|moto|scooter|patinete|skate|truck|caminh[ãa]o|(^|[_ ])bus($|[_ ]|\d)|[ôo]nibus|taxi|t[áa]xi|tractor|trator|sled|tren[óo]|sleigh|rocket|foguete|(^|[_ ])plane($|[_ ]|s|\d)|avi[ãa]o|helicop|ufo|ovni|spaceship|nave|tank_?army|blindado|vehicle|ve[íi]culo|(^|[_ ])limo($|[_ ]|\d)|jeep|van($|[_ ]|\d)|ambul|carousel|carrossel|ferris|roda-gigante/],
  ['banheira', /bath|banho|banheira|hot_?tub|hottub|jacuzzi|(^|[_ ])spa($|[_ ]|\d)|(^|[_ ])pool($|[_ ]|s|\d)|piscina|(^|[_ ])sink|(^|[ _])pia($|[ _])|toilet|privada|vaso sanit|shower|chuveiro|bidet|basin|lavat[óo]rio|puddle|po[çc]a|(^|[_ ])pond|(^|[ _])lagoa?($|[ _])|(^|[_ ])well($|[_ ]|s|\d)|po[çc]o($|[ _])|pump|bomba d|fountain_?drink|bebedouro|bird_?bath/],
  ['guardasol', /parasol|umbrella|guarda-sol|guarda-chuva|guardasol|sombrinha|sunshade/],
  ['cogumelo', /mushroom|cogumelo|toadstool|fungo|fungus/],
  ['relogio', /clock|rel[óo]gio|hourglass|ampulheta|timer|cron[ôo]metro|sundial/],
  ['instrumento', /piano|keyboard|teclado|guitar|guitarra|viol[ãa]o|viol[ãa]o|violin|violino|cello|harp($|[_ ]|s|\d)|harpa|(^|[_ ])bass($|[_ ]|\d)|baixo el|drums|drumkit|saxo|trumpet|trompete|trombone|tuba|flute|flauta|accordion|acorde[ãa]o|microphone|microfone|(^|[_ ])mic($|[_ ]|\d)|xylophone|xilofone|organ($|[_ ]|\d)|[óo]rg[ãa]o|tambourine|pandeiro|berimbau|ukulele|cavaquinho|banjo|maraca/],
  ['disco', /sound_?set|trax|vinyl|vinil|(^|[_ ])record($|[_ ]|s|\d)|(^|[_ ])lp($|[_ ]|\d)|(^|[_ ])cd($|[_ ]|s|\d)|cassette|fita k7|song|m[úu]sica/],
  ['espelho', /mirror|espelho/],
  ['cadeado', /(^|[_ ])lock($|[_ ]|s|\d)|lovelock|padlock|cadeado|(^|[_ ])key($|[_ ]|s|\d)|(^|[ _])chaves?($|[ _])/],
  ['telhado', /roof|telhado|(^|[ _])teto($|[ _])|chimney|chamin[ée]/],
  ['bloco', /(^|[_ ])(ele)?block|bloco|(^|[_ ])tile|ladrilho|gramado|grama($|[ _])|grass|pavement|cal[çc]ada|(^|[_ ])floor|(^|[ _])piso|(^|[ _])ch[ãa]o($|[ _])/],
  ['estante', /display|mostru[áa]rio|vitrine|showcase|(^|[_ ])rack/],
  ['coluna', /(^|[_ ])tubes?($|[_ ]|\d)|(^|[ _])tubos?($|[ _])|(^|[_ ])pipes?($|[_ ]|\d)|(^|[ _])cano/],
  ['lapide', /tomb|grave($|[_ ]|s|stone|\d)|l[áa]pide|t[úu]mulo|headstone|coffin|caix[ãa]o|sarc[óo]fago|sarcophag|cross($|[_ ]|\d)|(^|[ _])cruz($|[ _])|memorial/],
];

// Substantivo principal do nome do catálogo (redesign r4, 2ª passada): "Pia de Limo" é uma pia, não um carro;
// "Porta-Janela La Parisienne" é uma janela, não um bolo. Em português o substantivo vem primeiro ("Adesivo de
// Morcego", "Sacola de provisões 3"); em inglês, por último ("Garden Bird Bath", "Ice Hockey Pro Statue"). A palavra
// tem de ser inteira (sem acento, minúscula). Quem o nome decide aqui não passa pelas regras de palavra solta.
const NUCLEO = (pares) => new Map(pares.flatMap(([t, ps]) => ps.split(' ').map((p) => [p, t])));
export const NUCLEO_PT = NUCLEO([
  ['mesa', 'mesa mesinha escrivaninha balcao bancada'], ['barril', 'barris'], ['palco', 'prancha'], ['planta', 'ervas'], ['bicho', 'croco louva-a-deus pardais'], ['bandeirola', 'fitas'], ['vaso', 'incenso'], ['banheira', 'riacho'], ['boneco', 'matriosca artesao'], ['fogueira', 'fumaca'], ['pedra', 'estrume'], ['caixa', 'fita envelope aderecos'], ['bicho', 'pinguinha pardal'], ['coluna', 'ancora adaga'], ['maquina', 'controlador'], ['livros', 'licao'], ['vaso', 'ceramicas'], ['instrumento', 'flauta'], ['cabine', 'teleport teloucoporte'], ['maquina', 'gravadora dispensador exaustor ventilador'], ['estante', 'mostrador expositor'], ['barraca', 'banca confeitaria padaria cafeteria'], ['cavalete', 'menu quadros projeto'], ['comida', 'tigela'], ['livros', 'diario'], ['adesivo', 'borrao'], ['tapete', 'pista buraco'], ['bloco', 'areia'], ['som', 'gramofone'], ['vaso', 'drink bebida sombras maquiagem'], ['coluna', 'mastro tridente'], ['veiculo', 'borda proa popa'], ['barril', 'canhao'], ['bola', 'piao pinhata'], ['cristal', 'estrela'], ['planta', 'arbustos'], ['cadeira', 'cadeira banco banquinho banqueta'], ['poltrona', 'poltrona trono'],
  ['sofa', 'sofa'], ['cama', 'cama beliche berco'], ['estante', 'estante prateleira mostruario vitrine'], ['armario', 'armario gaveteiro comoda criado-mudo'],
  ['planta', 'planta plantas arbusto flor flores topiaria canteiro samambaia cacto bonsai'], ['arvore', 'arvore pinheiro'],
  ['luminaria', 'luminaria lampada abajur lustre luz lanterna iluminacao candelabro'], ['tapete', 'tapete caminho passadeira'],
  ['estatua', 'estatua busto escultura idolo totem mascara caveira cranio'], ['boneco', 'boneco boneca gnomo espantalho cavaleiro robo manequim fantoche'],
  ['bicho', 'ursinho pato patinho coelho coelhinho pinguim dragao cavalo gato gatinho cachorro peixe pelucia leao leaozinho coruja rena unicornio macaco sapo porco vaca passaro galinha elefante tartaruga abelha raposa lobo tigre panda tubarao polvo caranguejo caracol morcego aranha cobra ovelha rato hamster papagaio flamingo cisne baleia golfinho foca camelo girafa zebra borboleta joaninha'],
  ['trofeu', 'trofeu taca medalha'], ['fonte', 'fonte chafariz cachoeira'], ['arco', 'portao portal porta arco entrada'],
  ['janela', 'janela janelas porta-janela vitral'], ['banheira', 'pia banheira piscina privada chuveiro poco lago lagoa jacuzzi ofuro'],
  ['sacola', 'sacola saco saquinho bolsa mochila sementes mala kit'], ['caixa', 'caixa caixote arca bau presente presentes'],
  ['bloco', 'bloco piso chao gramado grama ladrilho tabua calcada'], ['cerca', 'parede muro cerca divisoria grade biombo sebe'],
  ['maquina', 'maquina geladeira fogao forno'], ['vaso', 'garrafa jarro jarra pote pocao vaso urna caldeirao xicara caneca copo'],
  ['barril', 'barril balde tonel tanque'], ['bolo', 'bolo torta cupcake'], ['comida', 'prato bandeja geleia doces doce sorvete lanche pao torrada pizza fruta frutas fruto biscoito sushi'],
  ['cesta', 'cesta cestinha'], ['bola', 'bola bolas'], ['ovo', 'ovo ovos ninho'], ['cadeado', 'cadeado chave'], ['veiculo', 'carrinho carro barco navio trem carroca treno kart moto bicicleta'],
  ['barraca', 'barraca banquinha quiosque tenda loja lojinha toldo coreto'], ['casinha', 'casa casinha chale cabana torre castelo templo igreja fachada predio edificio santuario'],
  ['palco', 'palco plataforma ponte altar podio passarela rampa'], ['escada', 'escada escadas'], ['coluna', 'pilar coluna poste obelisco pedestal tubo hidrante'],
  ['telhado', 'telhado teto chamine'], ['balao', 'balao baloes'], ['espelho', 'espelho'], ['relogio', 'relogio ampulheta'], ['globo', 'globo'],
  ['livros', 'livro livros revista'], ['aquario', 'aquario terrario'], ['cristal', 'cristal cristais gelo'], ['pedra', 'pedra pedras rocha rochas coral concha fossil'],
  ['bandeira', 'bandeira estandarte'], ['bandeirola', 'bandeirola bandeirolas bandeirinhas guirlanda'], ['cortina', 'cortina cortinas'],
  ['telefone', 'telefone'], ['tela', 'televisao computador monitor tela notebook'], ['instrumento', 'piano teclado guitarra violao harpa bateria orgao microfone'],
  ['lapide', 'lapide tumba tumulo sarcofago caixao'], ['cogumelo', 'cogumelo cogumelos'], ['adesivo', 'adesivo adesivos'], ['lareira', 'lareira'],
  ['fogueira', 'fogueira fogos tocha churrasqueira aquecedor'], ['cavalete', 'cavalete placa quadro escudo mapa'], ['letreiro', 'letreiro'],
  ['som', 'som radio jukebox'], ['impressora', 'impressora'], ['lixeira', 'lixeira lixo'], ['louca', 'bule chaleira'], ['guardasol', 'guarda-sol guarda-chuva sombrinha'],
  ['dado', 'dado dados'], ['abobora', 'abobora'], ['cabine', 'teleporte teletransporte cabine elevador'], ['disco', 'vinil'],
]);
export const NUCLEO_EN = NUCLEO([
  ['mesa', 'table desk counter workbench'], ['caixa', 'envelope costume'], ['coluna', 'hammer'], ['cortina', 'net'], ['cavalete', 'signs signage'], ['coluna', 'anchor dagger'], ['bandeirola', 'rope'], ['vaso', 'mokapot'], ['maquina', 'pastamaker mochamaster mocchamaster'], ['luminaria', 'lightstick'], ['veiculo', 'trolley'], ['planta', 'shrub herbs'], ['vaso', 'drink milkshake smoothie juice tubes makeup can'], ['coluna', 'hoop pipes trident'], ['som', 'gramophone'], ['barril', 'cannon'], ['bola', 'pinata'], ['estante', 'expositor'], ['cavalete', 'blueprint menu'], ['cadeira', 'chair stool bench seat'], ['poltrona', 'armchair throne recliner'], ['sofa', 'sofa couch loveseat'],
  ['cama', 'bed futon hammock bunkbed'], ['estante', 'shelf shelves bookcase bookshelf display rack'], ['armario', 'cabinet wardrobe dresser drawer drawers locker closet cupboard nightstand'],
  ['planta', 'plant plants bush flower flowers cactus fern bonsai hedge'], ['arvore', 'tree'], ['luminaria', 'lamp light lights lantern chandelier'], ['tapete', 'rug carpet mat path'],
  ['estatua', 'statue bust sculpture idol totem mask skull'], ['boneco', 'doll robot knight gnome scarecrow mannequin puppet figure'],
  ['bicho', 'plush plushie plushy teddy duck bear bunny rabbit cat kitten dog puppy fish carp penguin dragon horse pony owl lion monkey frog pig cow bird chick elephant turtle fox wolf tiger panda shark octopus crab snail bat spider snake sheep mouse hamster parrot flamingo swan whale dolphin seal unicorn butterfly reindeer'],
  ['trofeu', 'trophy medal'], ['fonte', 'fountain waterfall'], ['arco', 'gate door arch portal doorway archway'], ['janela', 'window windows'],
  ['banheira', 'sink bath bathtub tub pool toilet shower pump well pond jacuzzi'], ['sacola', 'bag sack backpack satchel suitcase kit seeds'], ['caixa', 'box crate chest present gift'],
  ['bloco', 'tile floor block pavement grass'], ['cerca', 'wall fence railing divider partition'], ['maquina', 'machine fridge oven stove microwave'],
  ['vaso', 'bottle jar vase pot potion urn cauldron mug'], ['barril', 'barrel bucket keg'], ['bolo', 'cake pie cupcake'], ['comida', 'tray plate food snack candy sweets dish'],
  ['cesta', 'basket hamper'], ['bola', 'ball'], ['ovo', 'egg eggs nest'], ['cadeado', 'lock padlock lovelock key'], ['veiculo', 'cart car boat ship train sled sleigh bike kart truck van'],
  ['barraca', 'stall tent kiosk shop awning gazebo'], ['casinha', 'house cottage hut tower castle building temple church shrine'], ['palco', 'stage platform bridge podium'],
  ['escada', 'stairs ladder staircase'], ['coluna', 'pillar column pole post pedestal hydrant'], ['telhado', 'roof chimney'], ['balao', 'balloon balloons'], ['espelho', 'mirror'],
  ['relogio', 'clock hourglass'], ['globo', 'globe'], ['livros', 'book books'], ['aquario', 'terrarium aquarium'], ['cristal', 'crystal crystals'], ['pedra', 'rock rocks stone stones boulder coral shell fossil'],
  ['bandeira', 'flag banner'], ['bandeirola', 'bunting flags garland'], ['cortina', 'curtain curtains drape beads backdrop'], ['telefone', 'phone telephone'],
  ['tela', 'tv television computer screen monitor laptop'], ['instrumento', 'piano guitar drums harp organ microphone synth keyboard'], ['lapide', 'tomb grave gravestone coffin'],
  ['cogumelo', 'mushroom mushrooms'], ['adesivo', 'sticker stickers decal'], ['lareira', 'fireplace'], ['fogueira', 'fire campfire bonfire fireworks torch heater grill bbq'],
  ['cavalete', 'easel sign board scoreboard billboard shield map'], ['som', 'speaker stereo jukebox radio'], ['impressora', 'printer'], ['lixeira', 'bin trash'],
  ['louca', 'teapot kettle'], ['guardasol', 'umbrella parasol'], ['neve', 'snowman'], ['dado', 'dice'], ['abobora', 'pumpkin'], ['cabine', 'teleport booth scanner elevator'],
  ['disco', 'vinyl record'],
]);
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const RUIDO = /^(\d+|[ivx]+|ltd|hc|deluxe|mini|super|pack|grande|pequeno|pequena|big|small|large|giant|rare|raro|name)$/;
// tipo pelo substantivo principal do nome, ou null.
export function tipoPeloNucleo(nome) {
  const limpo = semAcento(nome).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\- ]+/g, ' ').trim();
  if (!limpo) return null;
  const p = limpo.split(/\s+/).filter((x) => !RUIDO.test(x));
  if (p[0] === 'boneco' && p[1] === 'de' && p[2] === 'neve') return 'neve';
  if (p[0] === 'ninho' && p[1] === 'de' && /^corvos?$/.test(p[2] || '')) return 'coluna'; // o cesto da gávea, no mastro
  if (p[0] && NUCLEO_PT.has(p[0])) return NUCLEO_PT.get(p[0]);
  if (p[0] === 'estrela' && p[1] === 'do' && p[2] === 'mar') return 'bicho';
  if (p[0] === 'gelo' && p[1] === 'seco') return 'fogueira'; // a fumaça
  const of = p.indexOf('of');
  if (of > 0 && NUCLEO_EN.has(p[of - 1])) return NUCLEO_EN.get(p[of - 1]); // "Basket of Pumpkins" é cesta
  const ultima = p[p.length - 1];
  if (ultima && NUCLEO_EN.has(ultima)) return NUCLEO_EN.get(ultima);
  return null;
}

// Construção (redesign r5, quadro 35): as categorias de construção (divisórias, blocos, pisos, acabamentos) saíam todas
// num cubo de material. Pelo nome, cada uma vira o que é; o que o nome não diz continua bloco.
export const TIPOS_CONSTRUCAO = [
  ['janela', /window|janela|vitral/],
  ['escada', /stair|escada|ladder|degrau|(^|[_ ])steps?($|[_ ])/],
  ['porta', /(^|[_ ])door|porta($|[ _-]|s)|(^|[_ ])gate|port[ãa]o|turnstile|catraca/],
  ['arco', /(^|[_ ])arch|(^|[ _])arco($|[ _])|portal|archway/],
  ['coluna', /pillar|pilar|column|coluna|(^|[_ ])post($|[_ ]|s|\d)|(^|[ _])poste|(^|[_ ])pole|obelisk|obelisco|tubes?($|[_ ])|tubos?($|[ _])/],
  ['canto', /corner|(^|[ _])canto($|[ _])|crnr|(^|[_ ])angle|quina/],
  ['cerca', /fence|fnc|cerca|railing|(^|[_ ])rail|grade($|[ _])|(^|[_ ])rope|corda|buoy|boia|hedge|sebe|shrub|(^|[_ ])maze|labirinto|barrier|barreira|bars/],
  ['divisoria', /divider|dvdr|divis|divisor|screen|biombo|partition|shoji|panel|painel/],
  ['parede', /wall|parede|muro|muralha|brick|tijolo|facade|fachada/],
  ['palco', /stage|palco|platform|plataforma|catwalk|passarela|(^|[_ ])deck/],
];
export function tipoDeConstrucao(texto) {
  const t = String(texto || '').toLowerCase();
  return (TIPOS_CONSTRUCAO.find(([, r]) => r.test(t)) || [null])[0];
}

export function familias({ C, L, G, tom, lum, sat, hexRgb, esfera, octogono, pernas, LIVROS, METAL }) {
  const PRETO = '#2B2F33', BRANCO = '#F4EFE6', MADEIRA = '#C08A5B', MADEIRA_ESC = '#8A5A3C', AGUA = '#7FC8E8', VIDRO = '#BFE6F2';
  const alto = (altoArte, padrao, min = .2, max = 2.6) => Math.max(min, Math.min(max, altoArte > G ? altoArte : padrao));
  const viva = (cor, reserva) => (sat(cor) > .2 ? cor : reserva);
  const clara = (cor, reserva) => (lum(cor) > .45 ? cor : reserva);
  const escura = (cor, reserva) => (lum(cor) < .5 ? cor : reserva);
  // Disco deitado (octógono baixo) e cilindro em pé: as peças redondas das famílias.
  const disco = (o, x, y, z, raio, h, cor) => octogono(o, x, y, z, raio, h, cor);
  // Bola achatada/esticada: fatias de octógono pela altura (fy estica em y).
  const bolha = (o, x, y, z, raio, fy, cor, cor2 = null) => {
    const n = Math.max(3, Math.round(raio * 2 * fy / G));
    for (let k = 0; k < n; k++) {
      const t = (k + .5) / n * 2 - 1, rr = raio * Math.sqrt(Math.max(0, 1 - t * t)); if (rr < G / 2) continue;
      octogono(o, x, y + k * raio * 2 * fy / n, z, rr, raio * 2 * fy / n + G / 8, cor2 && k % 2 ? cor2 : cor);
    }
  };
  const R = {
    // Estátua, busto, ídolo, máscara: pedestal de duas pedras e a figura em cima (corpo que afina, ombros, cabeça).
    estatua(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, 1.1, .5), pedra = clara(cor.segunda, '#CFC6B2'), c = cor.principal;
      const ph = Math.min(.3, H * .2);
      C(o, 0, 0, 0, s * .7, ph * .4, s * .7, tom(pedra, -.12)); C(o, 0, ph * .4, 0, s * .58, ph * .6, s * .58, pedra);
      C(o, 0, ph - G / 2, 0, s * .62, G, s * .62, tom(pedra, .12));
      const corpo = H - ph, busto = /bust|busto|head|cabe|mask|m[áa]scara|skull|caveira|cr[âa]nio/.test(classe);
      if (busto) { // busto: ombros largos e cabeça grande
        C(o, 0, ph, 0, s * .44, corpo * .35, s * .3, c);
        bolha(o, 0, ph + corpo * .35, 0, Math.min(s * .2, corpo * .32), 1.1, tom(c, .08));
        return;
      }
      octogono(o, 0, ph, 0, s * .17, corpo * .45, tom(c, -.06)); // pernas/manto
      octogono(o, 0, ph + corpo * .45, 0, s * .14, corpo * .3, c); // tronco
      C(o, 0, ph + corpo * .68, 0, s * .4, G * 2, s * .18, c); // ombros
      for (const a of [-1, 1]) C(o, a * s * .18, ph + corpo * .4, 0, G * 2, corpo * .3, G * 2, tom(c, -.1)); // braços
      bolha(o, 0, ph + corpo * .75, 0, Math.min(s * .11, corpo * .12), 1, tom(c, .1));
      if (sat(cor.acento) > .3 && cor.acento !== c) C(o, 0, ph + corpo * .97, 0, s * .12, G * 1.5, s * .12, cor.acento); // coroa/enfeite
    },
    // Boneco, boneca, robô, fantasma, cavaleiro: de pé, sem pedestal, cabeça grande como os bonecos do mundo.
    boneco(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, .9, .35, 2.2), c = cor.principal, pele = /robot|rob|android|armou|armadura|knight|cavaleiro/.test(classe) ? METAL : clara(cor.segunda, '#F0C7A0');
      if (/ghost|fantasma/.test(classe)) { // fantasma: lençol em degraus com olhos
        bolha(o, 0, H * .35, 0, s * .2, 1.3, clara(c, BRANCO));
        C(o, 0, 0, 0, s * .4, H * .45, s * .4, clara(c, BRANCO)); for (const a of [-1, 1]) C(o, a * s * .07, H * .58, s * .19, G * 1.5, G * 2, G / 2, PRETO);
        return;
      }
      if (/matriosc|matryosh|nesting/.test(classe)) { bolha(o, 0, 0, 0, s * .2, 1.3, c, tom(c, -.08)); bolha(o, 0, s * .45, 0, s * .14, 1.1, c); C(o, 0, s * .52, s * .12, s * .14, s * .12, G, pele); return; }
      for (const a of [-1, 1]) C(o, a * s * .07, 0, 0, s * .1, H * .38, s * .12, tom(c, -.25)); // pernas
      C(o, 0, H * .38, 0, s * .32, H * .3, s * .2, c); // tronco
      for (const a of [-1, 1]) C(o, a * s * .2, H * .4, 0, s * .08, H * .26, s * .1, tom(c, -.08)); // braços
      C(o, 0, H * .68, 0, s * .3, H * .26, s * .26, pele); // cabeça
      for (const a of [-1, 1]) C(o, a * s * .06, H * .8, s * .13, G, G, G / 2, PRETO); // olhos
      C(o, 0, H * .94, 0, s * .32, H * .06, s * .28, viva(cor.acento, tom(c, -.2))); // cabelo/chapéu
    },
    // Bicho e pelúcia: corpo, cabeça na frente, orelhas, patas e rabo; peixe deitado com barbatana.
    bicho(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), c = cor.principal, c2 = cor.segunda !== c ? cor.segunda : tom(c, .2), H = alto(altoArte, .55, .25, 1.6);
      if (/fish|peixe|carp|shark|tubar|whale|baleia|dolphin|golfinho/.test(classe)) {
        const y = Math.max(G * 2, H * .3), L0 = s * .7;
        C(o, 0, 0, 0, G * 3, y, G * 3, PRETO); // haste do troféu/expositor
        C(o, 0, y, 0, L0 * .55, s * .22, s * .14, c); C(o, L0 * .05, y + G, 0, L0 * .4, s * .22, s * .16, tom(c, .08));
        C(o, -L0 * .38, y + G, 0, s * .12, s * .2, G * 1.5, tom(c, -.12)); // rabo
        C(o, 0, y + s * .22, 0, s * .16, G * 2, G, c2); C(o, L0 * .22, y + s * .12, s * .08, G, G, G / 2, PRETO);
        return;
      }
      if (/snail|caracol|turtle|tartaruga/.test(classe)) {
        C(o, 0, 0, 0, s * .6, G * 2, s * .3, c2); bolha(o, -G, G * 2, 0, s * .2, .8, c, tom(c, -.1)); C(o, s * .28, G, 0, s * .12, s * .14, s * .14, c2);
        return;
      }
      const corpo = H * .55, cw = s * .42, cd = s * .55, perna = H * .2;
      for (const a of [-1, 1]) for (const b of [-1, 1]) C(o, a * cw * .3, 0, b * cd * .3, s * .1, perna, s * .1, tom(c, -.15));
      C(o, 0, perna, 0, cw, corpo - perna, cd, c); C(o, 0, perna, cd * .1, cw * .7, (corpo - perna) * .6, cd * .5, c2); // barriga
      const ch = H * .4, cy = corpo - G * 2;
      C(o, 0, cy, cd * .38, cw * .82, ch, s * .34, tom(c, .05)); // cabeça
      C(o, 0, cy + ch * .15, cd * .38 + s * .17, cw * .4, ch * .3, G * 1.5, c2); // focinho
      for (const a of [-1, 1]) C(o, a * cw * .2, cy + ch * .6, cd * .38 + s * .17, G, G * 1.5, G / 2, PRETO); // olhos
      const orelhaAlta = /rabbit|bunny|coelh|donkey|burro/.test(classe), chifre = /dragon|drag|unicorn|unic|reindeer|rena|deer|cervo|goat|bode/.test(classe);
      for (const a of [-1, 1]) C(o, a * cw * .28, cy + ch, cd * .32, s * .08, orelhaAlta ? ch * .9 : ch * .3, s * .08, chifre ? viva(cor.acento, '#E8D9B0') : tom(c, -.08));
      if (/dragon|drag|bird|p[áa]ssaro|(^|[_ ])owl|coruja|duck|(^|[ _])pato|penguin|pinguim|chick|galinha|parrot|papagaio|bat|morcego|butterfl|borboleta/.test(classe))
        for (const a of [-1, 1]) C(o, a * (cw / 2 + G), perna + G * 2, -G, G * 1.5, (corpo - perna) * .7, cd * .6, tom(c, -.12)); // asas
      else C(o, 0, corpo * .7, -cd / 2 - G, s * .08, s * .08, s * .14, tom(c, -.1)); // rabo
    },
    // Arco, portão, portal, arco-íris: duas colunas e a verga; o arco-íris em faixas coloridas.
    arco(o, { w, d, cor, classe, altoArte = 0 }) {
      const H = alto(altoArte, 1.4, .6, 2.6), lw = w - G * 2, c = cor.principal, pd = Math.min(d - G * 2, G * 5);
      if (/rainbow|arco-[íi]ris/.test(classe)) {
        const cores = ['#E5484D', '#FF7A2F', '#F2C230', '#18A957', '#0D74CE', '#8E4EC6'];
        cores.forEach((k, i) => { const r = lw / 2 - i * G * 1.5, a = H - i * G * 1.5; for (const s of [-1, 1]) C(o, s * (r - G * .75), 0, 0, G * 1.5, a - G * 1.5, pd, k); C(o, 0, a - G * 1.5, 0, r * 2, G * 1.5, pd, k); });
        return;
      }
      const porta = /door|porta|gate|port[ãa]o/.test(classe) && !/portal/.test(classe);
      for (const s of [-1, 1]) { C(o, s * (lw / 2 - G * 2), 0, 0, G * 4, H - G * 3, pd, c); C(o, s * (lw / 2 - G * 2), 0, 0, G * 5, G * 2, pd + G, tom(c, -.15)); }
      C(o, 0, H - G * 3, 0, lw, G * 3, pd + G, tom(c, .06)); C(o, 0, H - G * 4, 0, lw - G * 6, G, pd - G, tom(c, -.1));
      if (porta) { const pw = lw - G * 8; C(o, 0, 0, 0, pw, H - G * 4, G * 1.5, viva(cor.segunda, tom(c, -.2))); C(o, pw / 2 - G * 2, (H - G * 4) / 2, G, G, G * 2, G, viva(cor.acento, '#F2C230')); }
      else if (/portal|magic|m[áa]gic/.test(classe)) L(o, 0, G * 2, 0, lw - G * 8, H - G * 6, G, viva(cor.acento, '#9AD8F0'));
    },
    // Cabine de teleporte, telefone, scanner: caixa alta com porta de vidro e luz no topo.
    cabine(o, { w, d, cor, altoArte = 0 }) {
      const H = alto(altoArte, 1.7, .9, 2.4), s = Math.min(w, d) - G * 2, c = cor.principal;
      C(o, 0, 0, 0, s, G * 2, s, tom(c, -.2)); C(o, 0, G * 2, 0, s, H - G * 4, s, c); C(o, 0, H - G * 2, 0, s + G, G * 2, s + G, tom(c, .1));
      L(o, 0, G * 4, s / 2, s - G * 5, H - G * 10, G / 2, VIDRO); C(o, s / 2 - G * 3, H * .45, s / 2 + G / 4, G, G * 3, G / 2, METAL);
      L(o, 0, H - G * 4, s / 2, s - G * 4, G * 1.5, G / 2, viva(cor.acento, '#FFC977'));
    },
    // Casinha, prédio, castelo, igreja, maquete: paredes, porta, janelas acesas e telhado em degraus.
    casinha(o, { w, d, cor, classe, altoArte = 0 }) {
      const H = alto(altoArte, 1.3, .4, 2.6), lw = w - G * 2, ld = d - G * 2, c = clara(cor.principal, '#EFE4CF'), teto = viva(cor.acento, '#C2553D');
      const torre = /tower|torre|castle|castelo|lighthouse|farol|church|igreja/.test(classe), corpo = torre ? H * .75 : H * .6;
      C(o, 0, 0, 0, lw, corpo, ld, c); C(o, 0, 0, 0, lw + G / 2, G * 2, ld + G / 2, tom(c, -.2));
      C(o, 0, G * 2, ld / 2, Math.min(lw * .25, G * 5), corpo * .45, G, escura(cor.segunda, MADEIRA_ESC)); // porta
      for (const a of [-1, 1]) L(o, a * lw * .3, corpo * .45, ld / 2, Math.min(lw * .16, G * 4), Math.min(corpo * .22, G * 4), G / 2, '#FFE3A1');
      if (torre) for (let k = 0; k < 4; k++) C(o, -lw / 2 + G * 2 + k * (lw - G * 4) / 3, corpo, -ld / 2 + G * 2, G * 3, G * 3, G * 3, tom(c, -.08)); // ameias
      const n = Math.max(3, Math.round((H - corpo) / (G * 2)));
      for (let k = 0; k < n; k++) { const t = 1 - k / n; C(o, 0, corpo + k * (H - corpo) / n, 0, lw * t + G * 2, (H - corpo) / n, ld + G * 2, k % 2 ? tom(teto, -.08) : teto); }
    },
    // Barraca, quiosque, banca, toldo, pérgola: balcão com tampo, postes e cobertura listrada.
    barraca(o, { w, d, cor, classe, altoArte = 0 }) {
      const H = alto(altoArte, 1.5, .6, 2.6), lw = w - G * 2, ld = d - G * 2, c = cor.principal, listra = viva(cor.acento, '#E5484D');
      if (/tent|barraca|tenda|cub[íi]culo|cubicle/.test(classe) && !/stall|banca|kiosk|quiosque/.test(classe)) { // barraca de pano: prisma em degraus
        const n = Math.max(4, Math.round(H / (G * 2)));
        for (let k = 0; k < n; k++) { const t = 1 - k / n; C(o, 0, k * H / n, 0, lw * t + G * 2, H / n, ld, k % 2 ? listra : c); }
        C(o, 0, 0, ld / 2, lw * .25, H * .45, G, PRETO);
        return;
      }
      const balcao = Math.min(.8, H * .5), madeira = escura(cor.segunda, MADEIRA);
      if (!/awning|toldo|canopy|gazebo|pergola|p[ée]rgola|trellis|treli/.test(classe)) {
        C(o, 0, 0, ld / 2 - G * 5, lw, balcao, G * 8, madeira); C(o, 0, balcao, ld / 2 - G * 5, lw + G, G * 2, G * 9, tom(madeira, .12));
        for (let k = 0; k < 3; k++) C(o, -lw / 3 + k * lw / 3, balcao + G * 2, ld / 2 - G * 5, G * 3, G * 2, G * 3, LIVROS[(k * 2) % LIVROS.length]); // mercadoria
      }
      for (const a of [-1, 1]) for (const b of [-1, 1]) C(o, a * (lw / 2 - G), 0, b * (ld / 2 - G), G * 2, H - G * 3, G * 2, tom(madeira, -.1));
      const faixas = Math.max(3, Math.round(lw / (G * 3)));
      for (let k = 0; k < faixas; k++) C(o, -lw / 2 + (k + .5) * lw / faixas, H - G * 3, 0, lw / faixas, G * 2, ld + G, k % 2 ? BRANCO : listra);
      C(o, 0, H - G, 0, lw - G * 2, G, ld - G, tom(listra, -.1));
    },
    // Balões: fios finos e três bolas de cores vivas presas num peso.
    balao(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, 1.4, .6, 2.4), cores = [viva(cor.principal, '#E5484D'), viva(cor.acento, '#0D74CE'), viva(cor.segunda, '#F2C230')];
      C(o, 0, 0, 0, G * 3, G * 2, G * 3, PRETO);
      [[-1, 0], [1, -.4], [0, .5]].forEach(([a, b], k) => {
        const x = a * s * .2, z = b * s * .2, r = Math.min(s * .21, H * .18), y = H - r * 2.4 - k * G * 2;
        C(o, x / 2, G * 2, z / 2, G / 2, y - G * 2, G / 2, '#E8E2D6'); bolha(o, x, y, z, r, 1.2, cores[k]);
      });
    },
    // Bolo e torta: andares redondos com cobertura e a cereja; prato embaixo.
    bolo(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d), massa = clara(cor.principal, '#F2D8B5'), cobertura = viva(cor.acento, '#F49AC1'), H = alto(altoArte, .5, .2, 1.2);
      disco(o, 0, 0, 0, s * .32, G, BRANCO);
      const n = H > .45 ? 3 : 2;
      for (let k = 0; k < n; k++) { const r = s * (.26 - k * .06), y = G + k * H / n; disco(o, 0, y, 0, r, H / n - G, massa); disco(o, 0, y + H / n - G, 0, r + G / 2, G, cobertura); }
      C(o, 0, G + H, 0, G * 2, G * 2, G * 2, '#D7263D');
    },
    // Comida, lanche, doce, bandeja: prato/bandeja com montinhos coloridos.
    comida(o, { w, d, cor, classe }) {
      const s = Math.min(w, d), bandeja = /tray|bandeja|picnic|piquenique|pcnc|lunch/.test(classe), base = bandeja ? escura(cor.segunda, MADEIRA) : BRANCO;
      if (bandeja) { C(o, 0, 0, 0, s * .8, G, s * .6, base); for (const a of [-1, 1]) C(o, 0, G, a * (s * .3 - G / 2), s * .8, G, G, tom(base, -.1)); }
      else disco(o, 0, 0, 0, s * .3, G, base);
      const cores = [viva(cor.principal, '#D9774B'), viva(cor.acento, '#E5484D'), clara(cor.segunda, '#F2C230'), '#18A957'];
      for (let k = 0; k < 5; k++) { const a = k * 1.3, rr = k ? s * .14 : 0; C(o, Math.cos(a) * rr, G, Math.sin(a) * rr, G * 3, G * (2 + (k % 3)), G * 3, cores[k % cores.length]); }
    },
    // Ovo: elipse em fatias com pintas, num ninho ou suporte.
    ovo(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, .45, .2, 1.4), c = cor.principal, r = Math.min(s * .26, H * .38);
      if (/nest|ninho|basket|cest/.test(classe)) { disco(o, 0, 0, 0, s * .32, G * 3, '#B8874F'); disco(o, 0, G * 2, 0, s * .26, G, '#8A5A3C'); }
      else disco(o, 0, 0, 0, r * .8, G, tom(c, -.25));
      bolha(o, 0, G, 0, r, 1.35, c);
      if (cor.acento !== c) for (let k = 0; k < 5; k++) { const a = k * 1.9, y = G + r * (.6 + (k % 3) * .55); C(o, Math.cos(a) * r * .8, y, Math.sin(a) * r * .8, G * 1.5, G * 1.5, G * 1.5, cor.acento); }
    },
    // Abóbora: bola achatada em gomos com o cabinho; se for de Halloween, a cara acesa.
    abobora(o, { w, d, cor, classe }) {
      const s = Math.min(w, d), c = viva(cor.principal, '#E8792B'), r = s * .3;
      bolha(o, 0, 0, 0, r, .7, c, tom(c, -.08));
      for (const a of [-1, 1]) C(o, a * r * .5, G, 0, G, r * 1.2, r * 2 - G, tom(c, -.14)); // gomos
      C(o, 0, r * 1.4, 0, G * 1.5, G * 3, G * 1.5, '#4F7A3A');
      if (/lantern|face|halloween|hween|enfeiti/.test(classe)) { for (const a of [-1, 1]) L(o, a * r * .35, r * .75, r - G, G * 2, G * 1.5, G, '#FFC24D'); L(o, 0, r * .35, r - G, r * .8, G, G, '#FFC24D'); }
    },
    // Vaso, jarra, garrafa, pote, poção, caldeirão, tinta: o perfil redondo com bojo, gargalo e boca.
    vaso(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), c = cor.principal, H = alto(altoArte, .55, .15, 1.6), r = Math.min(s * .26, H * .4);
      if (/cauldron|caldeir/.test(classe)) { disco(o, 0, 0, 0, r, G * 2, PRETO); bolha(o, 0, G, 0, r, .7, escura(c, '#3A3F44')); L(o, 0, r * 1.3, 0, r * 1.2, G, r * 1.2, viva(cor.acento, '#7CE07A')); return; }
      if (/spray|tinta|paint|balde/.test(classe)) { disco(o, 0, 0, 0, r * .7, H * .8, c); disco(o, 0, H * .8, 0, r * .4, G * 2, METAL); C(o, 0, H * .8 + G * 2, 0, G * 1.5, G * 1.5, G * 1.5, viva(cor.acento, PRETO)); return; }
      const garrafa = /bottle|garrafa|potion|po[çc][ãa]o|perfume/.test(classe), bojo = garrafa ? r * .7 : r;
      disco(o, 0, 0, 0, bojo * .7, G, tom(c, -.15));
      bolha(o, 0, G, 0, bojo, garrafa ? 1.1 : .85, c);
      const yb = G + bojo * 2 * (garrafa ? 1.1 : .85) - G;
      disco(o, 0, yb, 0, bojo * (garrafa ? .3 : .55), Math.max(G * 2, H - yb - G), tom(c, .06));
      disco(o, 0, Math.max(yb + G * 2, H - G), 0, bojo * (garrafa ? .34 : .66), G, garrafa ? viva(cor.acento, '#8A5A3C') : tom(c, .14));
      if (cor.acento !== c && !garrafa) disco(o, 0, G + bojo * .7, 0, bojo + G / 2, G * 1.5, cor.acento); // faixa pintada
    },
    // Cristal, gelo, gema: prismas que brilham saindo de uma base de pedra.
    cristal(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, .7, .2, 2), brilho = viva(cor.principal, viva(cor.acento, '#9AD8F0'));
      C(o, 0, 0, 0, s * .6, G * 2, s * .5, '#8E8577'); C(o, G, G * 2, 0, s * .45, G, s * .4, '#A39A8C');
      [[0, 0, 1], [-.18, .08, .6], [.17, -.06, .7], [.06, .16, .45]].forEach(([a, b, f], k) => {
        const x = a * s, z = b * s, h = H * f, l = s * (k ? .1 : .16);
        L(o, x, G * 3, z, l, h - G * 3, l, k % 2 ? tom(brilho, .15) : brilho); C(o, x, G * 3 + h - G * 3, z, l * .5, G * 2, l * .5, tom(brilho, .4));
      });
    },
    // Pedra, rocha, coral, concha, fóssil: blocos empilhados irregulares (sempre os mesmos para a mesma peça).
    pedra(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, .45, .12, 1.6), c = cor.principal, k0 = String(classe).length;
      const ruido = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233 + k0) * 43758.5453; return v - Math.floor(v); };
      const n = Math.max(3, Math.round(H / (G * 2)));
      for (let k = 0; k < n; k++) {
        const t = 1 - k / n, lx = s * (.25 + .5 * t) * (.85 + ruido(k, 1) * .3), lz = s * (.2 + .45 * t) * (.85 + ruido(k, 2) * .3);
        C(o, (ruido(k, 3) - .5) * G * 3, k * H / n, (ruido(k, 4) - .5) * G * 3, lx, H / n, lz, [c, tom(c, -.08), tom(c, .06)][k % 3]);
      }
      if (/coral|anemone|an[êe]mona/.test(classe)) for (let k = 0; k < 4; k++) L(o, (ruido(k, 5) - .5) * s * .4, H, (ruido(k, 6) - .5) * s * .3, G * 1.5, G * (3 + k), G * 1.5, viva(cor.acento, '#FF7AB6'));
    },
    // Barril, balde, tonel, tanque: cilindro com cintas e a tampa.
    barril(o, { w, d, cor, classe, altoArte = 0 }) {
      let H = alto(altoArte, .6, .2, 1.6);
      const s = Math.min(w, d), madeira = escura(cor.principal, MADEIRA), r = s * .28, balde = /bucket|balde|tub/.test(classe);
      const Hb = balde ? H : Math.min(H, s * .75); // barril baixo e bojudo, nunca uma coluna
      disco(o, 0, 0, 0, balde ? r * .8 : r * .82, Hb, madeira);
      if (!balde) { disco(o, 0, Hb * .12, 0, r * .93, Hb * .76, tom(madeira, .04)); disco(o, 0, Hb * .3, 0, r, Hb * .4, tom(madeira, .08)); }
      for (const y of [Hb * .14, Hb * .8]) disco(o, 0, y, 0, (balde ? r * .8 : r * .95) + G / 2, G * 1.5, '#7E858C');
      H = Hb;
      if (/water|[áa]gua|ice|gelo/.test(classe)) L(o, 0, H - G, 0, r * 1.3, G, r * 1.3, AGUA);
      else disco(o, 0, H - G / 2, 0, r * .8, G, tom(madeira, -.15));
    },
    // Cortina, miçangas, pano de fundo: varão em cima e as dobras do pano até o chão.
    cortina(o, { w, d, cor, altoArte = 0 }) {
      const H = alto(altoArte, 1.6, .6, 2.6), lw = w - G * 2, c = cor.principal, z = -d / 2 + G * 3;
      C(o, 0, H - G * 2, z, lw + G, G * 1.5, G * 1.5, escura(cor.segunda, MADEIRA_ESC));
      for (const a of [-1, 1]) C(o, a * (lw / 2), 0, z, G * 1.5, H - G * 2, G * 1.5, escura(cor.segunda, MADEIRA_ESC));
      const n = Math.max(4, Math.round(lw / (G * 2)));
      for (let k = 0; k < n; k++) C(o, -lw / 2 + G * 1.5 + (k + .5) * (lw - G * 3) / n, G, z + (k % 2 ? G : 0), (lw - G * 3) / n, H - G * 3, G * 1.5, k % 2 ? tom(c, -.1) : c);
      if (cor.acento !== c) C(o, 0, H - G * 4, z + G * 1.5, lw - G * 3, G * 1.5, G / 2, cor.acento); // bandô
    },
    // Janela solta no chão: caixilho com vidro aceso e a cruz.
    janela(o, { w, d, cor, altoArte = 0 }) {
      const H = alto(altoArte, 1.5, .5, 2.6), lw = w - G * 2, c = clara(cor.principal, BRANCO), z = -d / 2 + G * 2;
      C(o, 0, 0, z, lw, G * 2, G * 3, tom(c, -.1)); C(o, 0, H - G * 2, z, lw, G * 2, G * 3, c);
      for (const a of [-1, 1]) C(o, a * (lw / 2 - G), G * 2, z, G * 2, H - G * 4, G * 3, c);
      L(o, 0, G * 2, z, lw - G * 4, H - G * 4, G, VIDRO);
      C(o, 0, G * 2, z + G, G, H - G * 4, G * 1.5, c); C(o, 0, H / 2, z + G, lw - G * 4, G, G * 1.5, c);
    },
    // Bandeira e estandarte: mastro com a ponta e o pano em duas faixas.
    bandeira(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, 1.6, .6, 2.6), x0 = -s * .3;
      C(o, x0, 0, 0, G * 4, G * 2, G * 4, '#5C5248'); C(o, x0, G * 2, 0, G * 1.5, H - G * 2, G * 1.5, METAL); C(o, x0, H, 0, G * 2, G * 2, G * 2, '#F2C230');
      const pw = s * .55, ph = Math.min(H * .35, s * .5);
      C(o, x0 + pw / 2 + G, H - ph - G, 0, pw, ph / 2, G, viva(cor.principal, '#E5484D'));
      C(o, x0 + pw / 2 + G, H - ph / 2 - G, 0, pw, ph / 2, G, viva(cor.acento, viva(cor.segunda, '#F2C230')));
    },
    // Bandeirola e guirlanda: dois postes e a corda com os triângulos coloridos.
    bandeirola(o, { w, d, cor, classe, altoArte = 0 }) {
      if (w < 1.2) { R.bandeira(o, { w, d, cor, classe, altoArte }); return; } // peça de um ladrilho: uma bandeira só
      const H = alto(altoArte, 1.4, .5, 2.4), lw = w - G * 2, cores = [viva(cor.principal, '#E5484D'), viva(cor.acento, '#F2C230'), viva(cor.segunda, '#0D74CE'), '#18A957'];
      for (const a of [-1, 1]) { C(o, a * (lw / 2 - G), 0, 0, G * 1.5, H, G * 1.5, MADEIRA_ESC); }
      C(o, 0, H - G * 2, 0, lw, G / 2, G / 2, '#E8E2D6');
      const n = Math.max(3, Math.round(lw / (G * 3)));
      for (let k = 0; k < n; k++) { // triângulos em degraus, a corda caindo um pouco no meio
        const x = -lw / 2 + G * 2 + (k + .5) * (lw - G * 4) / n, c = cores[k % cores.length], y = H - G * 2 - Math.sin((k + .5) / n * Math.PI) * G * 3;
        C(o, x, y - G * 2, 0, G * 3, G * 2, G / 2, c); C(o, x, y - G * 3.5, 0, G * 2, G * 1.5, G / 2, c); C(o, x, y - G * 4.5, 0, G, G, G / 2, c);
      }
    },
    // Cavalete, quadro, placa de pé: três pernas e a tela pintada nas cores da arte.
    cavalete(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, 1.3, .4, 2.2), madeira = escura(cor.segunda, MADEIRA), tw = Math.min(s * .7, w - G * 2);
      if (/sign|placa|board|plaque|shield|escudo|badge|emblem|(^|[_ ])map|mapa/.test(classe)) { // placa num poste
        C(o, 0, 0, 0, G * 4, G, G * 4, tom(madeira, -.2)); C(o, 0, G, 0, G * 1.5, H * .6, G * 1.5, madeira);
        C(o, 0, H * .55, 0, tw, H * .4, G * 1.5, clara(cor.principal, BRANCO)); C(o, 0, H * .62, G, tw - G * 4, H * .26, G / 2, viva(cor.acento, PRETO));
        return;
      }
      for (const a of [-1, 1]) C(o, a * tw * .35, 0, G * 2, G * 1.5, H, G * 1.5, madeira);
      C(o, 0, 0, -s * .2, G * 1.5, H * .85, G * 1.5, madeira); C(o, 0, H * .35, G * 2, tw * .8, G * 1.5, G * 3, madeira);
      const th = H * .5, y = H * .38;
      C(o, 0, y, G * 3, tw * .85, th, G, BRANCO);
      C(o, -tw * .15, y + th * .15, G * 3.5, tw * .4, th * .4, G / 2, cor.principal); C(o, tw * .18, y + th * .45, G * 3.5, tw * .35, th * .35, G / 2, viva(cor.acento, cor.segunda));
    },
    // Aquário e terrário: móvel embaixo, vidro aceso, água, peixinhos e plantinhas.
    aquario(o, { w, d, cor, classe, altoArte = 0 }) {
      const lw = w - G * 2, ld = Math.min(d - G * 2, .6), H = alto(altoArte, 1.1, .4, 2), base = H * .45, terra = /terrar|vivar|ant|formig/.test(classe);
      C(o, 0, 0, 0, lw, base, ld, escura(cor.segunda, MADEIRA_ESC));
      C(o, 0, base, 0, lw, G, ld, PRETO);
      L(o, 0, base + G, 0, lw - G, H - base - G * 2, ld - G, terra ? '#D9F2D0' : AGUA);
      C(o, 0, base + G, 0, lw - G * 2, G * 2, ld - G * 2, terra ? '#7A5A3A' : '#E8D7A8');
      for (let k = 0; k < 3; k++) C(o, -lw / 3 + k * lw / 3, base + G * 3, -ld / 4, G * 1.5, (H - base) * .4, G * 1.5, '#3E8F4E');
      if (!terra) for (let k = 0; k < 3; k++) C(o, -lw / 4 + k * lw / 4, base + (H - base) * (.35 + k * .15), ld / 4, G * 2, G, G, [viva(cor.acento, '#FF7A2F'), '#F2C230', '#E5484D'][k]);
      C(o, 0, H - G, 0, lw + G / 2, G, ld + G / 2, PRETO);
    },
    // Bola, bomba de banho, globo de discoteca: esfera num apoio pequeno.
    bola(o, { w, d, cor, classe }) {
      const s = Math.min(w, d), c = cor.principal, r = s * .22, disco0 = /disco/.test(classe);
      disco(o, 0, 0, 0, r * .5, G, tom(c, -.25));
      bolha(o, 0, G / 2, 0, r, 1, disco0 ? METAL : c, disco0 ? '#DDE3E8' : (cor.acento !== c ? cor.acento : null));
      if (disco0) for (let k = 0; k < 4; k++) L(o, Math.cos(k * 1.57) * r * .9, r * .9, Math.sin(k * 1.57) * r * .9, G, G, G, ['#FF7AB6', '#7FD3FF', '#F2C230', '#7CE07A'][k]);
    },
    // Dado: cubo com as pintas.
    dado(o, { w, d, cor }) {
      const s = Math.min(w, d) * .4, c = clara(cor.principal, BRANCO), p = escura(cor.acento, PRETO);
      C(o, 0, 0, 0, s, s, s, c); C(o, 0, s, 0, s - G * 2, G / 2, s - G * 2, tom(c, .06));
      for (const [a, b] of [[-1, -1], [1, 1], [0, 0], [1, -1], [-1, 1]]) C(o, a * s * .25, s * .5 + b * s * .25 - G / 2, s / 2, G * 1.2, G * 1.2, G / 2, p);
      for (const [a, b] of [[-1, -1], [1, 1]]) C(o, a * s * .25, s + G / 4, b * s * .25, G * 1.2, G / 2, G * 1.2, p);
    },
    // Boneco de neve: três bolas, chapéu, nariz de cenoura e cachecol.
    neve(o, { w, d, cor }) {
      const s = Math.min(w, d), r = s * .2, chapeu = escura(cor.segunda, PRETO);
      bolha(o, 0, 0, 0, r, .9, BRANCO); bolha(o, 0, r * 1.7, 0, r * .75, .9, '#FBF8F2'); bolha(o, 0, r * 3, 0, r * .55, .95, BRANCO);
      C(o, 0, r * 2.85, 0, r * 1.5, G * 1.5, r * 1.3, viva(cor.acento, '#E5484D')); // cachecol
      C(o, 0, r * 3.4, r * .55, G, G, G * 3, '#F28C28'); for (const a of [-1, 1]) C(o, a * r * .22, r * 3.6, r * .5, G, G, G / 2, PRETO);
      C(o, 0, r * 4, 0, r * .9, G, r * .9, chapeu); C(o, 0, r * 4 + G, 0, r * .6, r * .6, r * .6, chapeu);
    },
    // Sacola, mochila, saco de sementes, mala: corpo com dobra, alça e etiqueta.
    sacola(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), c = cor.principal, H = alto(altoArte, .45, .2, 1), bw = s * .5, bd = s * .3;
      if (/suitcase|mala|luggage|bagagem/.test(classe)) { C(o, 0, 0, 0, bw, H * .8, bd * .6, c); C(o, 0, H * .8, 0, G * 4, G * 2, G, PRETO); for (const a of [-1, 1]) C(o, a * bw * .3, 0, bd * .3, G, H * .8, G / 2, tom(c, -.2)); return; }
      C(o, 0, 0, 0, bw, H * .75, bd, c); C(o, 0, H * .75, 0, bw * .9, H * .12, bd * .8, tom(c, .1)); // corpo e boca dobrada
      C(o, 0, H * .87, 0, bw * .5, G, G, escura(cor.segunda, MADEIRA_ESC)); for (const a of [-1, 1]) C(o, a * bw * .25, H * .75, 0, G, H * .12 + G, G, escura(cor.segunda, MADEIRA_ESC)); // alça
      C(o, 0, H * .3, bd / 2, bw * .4, H * .25, G / 2, viva(cor.acento, BRANCO)); // etiqueta
    },
    // Cesta e berço: trançado em listras, alça em arco e o que vai dentro.
    cesta(o, { w, d, cor, classe }) {
      const s = Math.min(w, d), c = escura(cor.principal, '#B8874F'), bw = s * .6, bd = s * .45, h = s * .25;
      for (let k = 0; k < 4; k++) C(o, 0, k * h / 4, 0, bw - (k === 0 ? G : 0), h / 4, bd - (k === 0 ? G : 0), k % 2 ? tom(c, -.12) : c);
      if (/crib|ber[çc]o|cradle/.test(classe)) { C(o, 0, h, 0, bw - G * 2, G * 2, bd - G * 2, BRANCO); return; }
      for (let k = 0; k < 4; k++) C(o, -bw / 4 + (k % 2) * bw / 2, h, -bd / 6 + Math.floor(k / 2) * bd / 3, G * 3, G * 2, G * 3, LIVROS[k + 1]);
      for (const a of [-1, 1]) C(o, a * (bw / 2 - G), h, 0, G, h, G, c); C(o, 0, h * 2, 0, bw - G, G, G, c);
    },
    // Palco, pódio, plataforma, ponte, píer: tablado com borda e degraus; pódio em três alturas.
    palco(o, { w, d, cor, classe, alto: aFicha = 0 }) {
      const lw = w - G, ld = d - G, c = escura(cor.principal, MADEIRA), H = Math.max(G * 3, Math.min(.6, aFicha || .3));
      if (/podium|p[óo]dio/.test(classe)) {
        [[0, 1, '#F2C230'], [-1, .7, '#C9CED3'], [1, .5, '#D08A4E']].forEach(([a, f, m]) => { C(o, a * lw / 3, 0, 0, lw / 3 - G / 2, H * 2 * f, ld * .7, clara(cor.principal, BRANCO)); C(o, a * lw / 3, H * 2 * f, 0, lw / 3 - G, G, ld * .7 - G, m); });
        return;
      }
      C(o, 0, 0, 0, lw, H - G, ld, tom(c, -.15));
      const n = Math.max(3, Math.round(ld / (G * 3)));
      for (let k = 0; k < n; k++) C(o, 0, H - G, -ld / 2 + (k + .5) * ld / n, lw - G, G, ld / n - G / 4, k % 2 ? tom(c, .06) : c);
      if (/stage|palco|altar|dais|tablado/.test(classe)) { C(o, 0, 0, ld / 2 - G, lw * .4, H / 2, G * 3, tom(c, -.05)); C(o, 0, H - G, -ld / 2 + G, lw, G * 2, G * 2, viva(cor.acento, tom(c, -.25))); }
    },
    // Escada: degraus subindo para trás, com o corrimão.
    escada(o, { w, d, cor, altoArte = 0 }) {
      const lw = w - G * 2, ld = d - G * 2, c = cor.principal, H = alto(altoArte, 1, .3, 2.4), n = Math.max(3, Math.round(H / (G * 3)));
      for (let k = 0; k < n; k++) C(o, 0, 0, ld / 2 - (k + .5) * ld / n, lw, (k + 1) * H / n, ld / n, k % 2 ? tom(c, -.06) : c);
      C(o, lw / 2 - G, H, -ld / 2 + G * 2, G, G * 6, G, escura(cor.segunda, MADEIRA_ESC));
    },
    // Coluna, pilar, obelisco, poste, hidrante: base, fuste com caneluras e capitel.
    coluna(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), c = cor.principal, H = alto(altoArte, 1.4, .3, 2.6), r = s * .18;
      if (/obelisk|obelisco/.test(classe)) { const n = Math.max(3, Math.round(H / (G * 3))); for (let k = 0; k < n; k++) { const t = 1 - k / n * .6; C(o, 0, k * H / n, 0, s * .4 * t, H / n, s * .4 * t, k % 2 ? tom(c, -.05) : c); } return; }
      C(o, 0, 0, 0, r * 2.8, G * 2, r * 2.8, tom(c, -.12)); C(o, 0, G * 2, 0, r * 2.4, G, r * 2.4, tom(c, -.05));
      disco(o, 0, G * 3, 0, r, H - G * 6, c);
      for (let k = 0; k < 4; k++) C(o, Math.cos(k * 1.57 + .78) * r, G * 3, Math.sin(k * 1.57 + .78) * r, G / 2, H - G * 6, G / 2, tom(c, -.12));
      C(o, 0, H - G * 3, 0, r * 2.4, G, r * 2.4, tom(c, .05)); C(o, 0, H - G * 2, 0, r * 2.8, G * 2, r * 2.8, tom(c, .1));
      if (cor.acento !== c && sat(cor.acento) > .3) C(o, 0, H, 0, r, G * 2, r, cor.acento);
    },
    // Cerca, grade, muro, biombo: mourões e travessas (cerca) ou o pano de parede com friso (muro e biombo).
    cerca(o, { w, d, cor, classe, altoArte = 0 }) {
      const lw = w - G, c = cor.principal, H = alto(altoArte, .7, .2, 2.6), z = 0;
      if (/wall|muro|parede|screen|biombo|partition|divider|divis/.test(classe)) {
        C(o, 0, 0, z, lw, H, G * 3, c); C(o, 0, 0, z, lw + G / 2, G * 2, G * 3.5, tom(c, -.2)); C(o, 0, H - G, z, lw + G / 2, G * 1.5, G * 3.5, tom(c, .1));
        if (cor.acento !== c) C(o, 0, H * .55, z + G * 1.5, lw - G * 2, G, G / 2, cor.acento);
        return;
      }
      if (/hedge|sebe/.test(classe)) { C(o, 0, 0, z, lw, H, G * 6, viva(c, '#4F9A4E')); for (let k = 0; k < 4; k++) C(o, -lw / 2 + G * 2 + k * (lw - G * 4) / 3, H, z, G * 3, G * 1.5, G * 4, '#6BBF5E'); return; }
      const n = Math.max(2, Math.round(lw / .33) + 1);
      for (let k = 0; k < n; k++) { const x = -lw / 2 + G + k * (lw - G * 2) / (n - 1); C(o, x, 0, z, G * 2, H, G * 2, c); C(o, x, H, z, G, G, G, tom(c, .12)); }
      for (const y of [H * .3, H * .75]) C(o, 0, y, z + G, lw, G * 1.5, G, tom(c, -.08));
    },
    // Fogueira, lareira solta, churrasqueira, aquecedor, lava: lenha cruzada e a chama acesa em degraus.
    fogueira(o, { w, d, cor, classe }) {
      const s = Math.min(w, d), fogo = ['#FF7A2F', '#FFB347', '#FFE38A'];
      if (/heater|aquecedor|stove|fog[ãa]o|grill|churras|bbq|barbecue|forge|forja|furnace|fornalha/.test(classe)) {
        const c = escura(cor.principal, '#3A3F44'); C(o, 0, 0, 0, s * .5, s * .55, s * .45, c); C(o, 0, s * .55, 0, s * .55, G, s * .5, tom(c, .1));
        L(o, 0, G * 3, s * .23, s * .3, s * .25, G / 2, fogo[0]); return;
      }
      if (/smoke|fuma|steam|vapor|boiling/.test(classe)) { disco(o, 0, 0, 0, s * .2, G * 3, escura(cor.principal, '#3A3F44')); for (let k = 0; k < 4; k++) C(o, (k % 2 ? 1 : -1) * G, G * 3 + k * G * 3, 0, G * (5 - k), G * 3, G * (5 - k), '#E8E8E8'); return; }
      disco(o, 0, 0, 0, s * .3, G * 1.5, '#8E8577');
      for (const [a, b] of [[1, 0], [0, 1], [.7, .7], [-.7, .7]]) C(o, 0, G * 1.5, 0, a ? s * .5 : G * 2, G * 2, b ? s * .5 : G * 2, '#6E4B33');
      for (let k = 0; k < 3; k++) L(o, 0, G * 3 + k * G * 3, 0, s * (.28 - k * .08), G * 3, s * (.28 - k * .08), fogo[k]);
    },
    // Veículo: chassi, cabine com vidro, rodas e faróis; barco com casco e vela; trenó com esquis.
    veiculo(o, { w, d, cor, classe }) {
      const lw = w - G * 2, ld = d - G * 2, c = viva(cor.principal, '#E5484D'), comp = Math.max(lw, ld), larg = Math.min(lw, ld), deitado = lw >= ld;
      const X = (x, z) => (deitado ? [x, z] : [z, x]), B = (x, y, z, cw, h, cd, k) => { const [a, b] = X(x, z); const [e, f] = deitado ? [cw, cd] : [cd, cw]; C(o, a, y, b, e, h, f, k); };
      if (/boat|barco|ship|navio|canoe|canoa|raft|jangada/.test(classe)) {
        B(0, 0, 0, comp * .8, G * 3, larg * .5, escura(cor.segunda, MADEIRA)); B(0, G * 3, 0, comp * .9, G * 3, larg * .6, c); B(0, G * 6, 0, comp * .85, G, larg * .55, tom(c, .1));
        B(0, G * 6, 0, G * 1.5, comp * .7, G * 1.5, MADEIRA_ESC); B(comp * .12, G * 10, 0, comp * .3, comp * .45, G, BRANCO);
        return;
      }
      if (/sled|tren|sleigh/.test(classe)) { for (const a of [-1, 1]) B(0, 0, a * larg * .3, comp * .9, G, G * 1.5, METAL); B(0, G * 2, 0, comp * .7, G * 5, larg * .7, c); B(-comp * .3, G * 2, 0, G * 3, G * 10, larg * .7, tom(c, -.1)); return; }
      const roda = Math.max(G * 3, larg * .22);
      for (const a of [-1, 1]) for (const b of [-1, 1]) B(a * comp * .3, 0, b * (larg / 2 - G * 1.5), roda, roda, G * 3, PRETO);
      B(0, roda * .5, 0, comp * .9, roda, larg - G * 2, c);
      B(-comp * .05, roda * 1.5, 0, comp * .5, roda * .9, larg - G * 4, tom(c, .08));
      const [vx, vz] = X(comp * .2 + G / 2, 0); const [vw, vd] = deitado ? [G / 2, larg - G * 5] : [larg - G * 5, G / 2]; L(o, vx, roda * 1.6, vz, vw, roda * .6, vd, VIDRO);
      for (const b of [-1, 1]) { const [fx, fz] = X(comp * .45, b * larg * .28); L(o, fx, roda * .9, fz, G, G, G, '#FFE38A'); }
    },
    // Banheira, piscina, pia, poço, bomba d'água: a borda e a água acesa (com o chuveiro/torneira quando há).
    banheira(o, { w, d, cor, classe, altoArte = 0 }) {
      const lw = w - G * 2, ld = d - G * 2, c = clara(cor.principal, BRANCO), H = Math.min(.6, alto(altoArte, .45, .15, 1.5));
      if (/pump|bomba|well|po[çc]o|fountain_?drink|bebedouro/.test(classe)) {
        const s = Math.min(lw, ld), pedra = escura(cor.principal, '#8E8577');
        disco(o, 0, 0, 0, s * .3, G * 5, pedra); L(o, 0, G * 4, 0, s * .4, G, s * .4, AGUA);
        C(o, s * .2, 0, 0, G * 2, alto(altoArte, .8, .3, 1.6), G * 2, METAL); C(o, s * .1, alto(altoArte, .8, .3, 1.6) - G * 2, 0, s * .2, G, G, METAL);
        return;
      }
      if (/toilet|privada|vaso sanit/.test(classe)) { C(o, 0, 0, 0, G * 6, G * 6, G * 8, c); C(o, 0, G * 6, G, G * 7, G, G * 7, tom(c, .05)); C(o, 0, G * 6, -G * 4, G * 7, G * 7, G * 3, c); return; }
      if (/sink|pia|basin|lavat/.test(classe)) { const s = Math.min(lw, G * 10); C(o, 0, 0, -ld / 4, G * 3, .7, G * 3, c); C(o, 0, .7, -ld / 4, s, G * 3, G * 7, c); L(o, 0, .7 + G * 2, -ld / 4, s - G * 2, G, G * 5, AGUA); C(o, 0, .7 + G * 3, -ld / 4 - G * 3, G, G * 3, G, METAL); return; }
      const raso = /pool|piscina|pond|lago|puddle|po[çc]a/.test(classe), h = raso ? Math.max(G * 2, Math.min(H, G * 4)) : H;
      C(o, 0, 0, 0, lw, h, ld, raso ? tom(c, -.05) : c);
      L(o, 0, h - G * 1.5, 0, lw - G * 3, G, ld - G * 3, /lava/.test(classe) ? '#FF7A2F' : AGUA);
      C(o, 0, h - G / 2, -ld / 2 + G, lw, G, G * 2, tom(c, .08));
      if (!raso) { C(o, lw / 2 - G * 3, h, -ld / 2 + G * 2, G, G * 4, G, METAL); C(o, lw / 2 - G * 3, h + G * 3, -ld / 2 + G * 3, G, G, G * 2, METAL); }
    },
    // Guarda-sol e guarda-chuva: haste e a cobertura em gomos que descem.
    guardasol(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, 1.5, .6, 2.4), c = viva(cor.principal, '#E5484D'), b = viva(cor.acento, BRANCO);
      disco(o, 0, 0, 0, G * 3, G * 2, '#5C5248'); C(o, 0, G * 2, 0, G, H - G * 2, G, METAL);
      for (let k = 0; k < 4; k++) { const r = s * (.45 - k * .1); disco(o, 0, H - G * 4 + k * G * 1.5, 0, r, G * 1.5, k % 2 ? b : c); }
      C(o, 0, H + G * 2, 0, G, G * 2, G, METAL);
    },
    // Cogumelo: pé claro e o chapéu com pintas.
    cogumelo(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, .5, .2, 1.6), chapeu = viva(cor.principal, '#E5484D');
      disco(o, 0, 0, 0, s * .1, H * .6, '#F3E9D6');
      disco(o, 0, H * .6, 0, s * .32, H * .2, chapeu); disco(o, 0, H * .8, 0, s * .22, H * .15, tom(chapeu, .05));
      for (let k = 0; k < 5; k++) C(o, Math.cos(k * 1.26) * s * .2, H * .8 - G / 2, Math.sin(k * 1.26) * s * .2, G * 1.5, G * 1.5, G * 1.5, BRANCO);
    },
    // Relógio de chão e ampulheta: caixa alta com o mostrador e o pêndulo aceso.
    relogio(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, 1.6, .4, 2.4), madeira = escura(cor.principal, MADEIRA_ESC);
      if (/hourglass|ampulheta|timer|cron/.test(classe)) {
        for (const y of [0, H * .9]) C(o, 0, y, 0, s * .3, H * .1, s * .3, madeira);
        for (let k = 0; k < 6; k++) { const t = Math.abs(k - 2.5) / 2.5; L(o, 0, H * .1 + k * H * .8 / 6, 0, s * .06 + t * s * .16, H * .8 / 6, s * .06 + t * s * .16, k < 3 ? VIDRO : '#F2D08A'); }
        return;
      }
      C(o, 0, 0, 0, s * .45, H * .08, s * .32, tom(madeira, -.15)); C(o, 0, H * .08, 0, s * .36, H * .75, s * .26, madeira);
      C(o, 0, H * .83, 0, s * .42, H * .17, s * .3, tom(madeira, .08));
      C(o, 0, H * .85, s * .15, s * .28, s * .28, G / 2, BRANCO); C(o, 0, H * .85 + s * .14, s * .15 + G / 2, G, s * .1, G / 2, PRETO); C(o, G * 1.5, H * .85 + s * .14, s * .15 + G / 2, s * .08, G, G / 2, PRETO);
      L(o, 0, H * .2, s * .13, s * .2, H * .5, G / 2, '#F2D08A'); C(o, 0, H * .3, s * .13 + G / 2, G * 2, G * 2, G / 2, '#C9A23A');
    },
    // Instrumento: piano de armário, bateria, ou o violão/guitarra/microfone num pedestal.
    instrumento(o, { w, d, cor, classe }) {
      const s = Math.min(w, d), c = cor.principal;
      if (/piano|organ|[óo]rg|keyboard|teclado/.test(classe)) {
        const pw = Math.max(.6, w - G * 3), corpo = escura(c, '#2B2F33');
        C(o, 0, 0, -G * 2, pw, 1, G * 8, corpo); C(o, 0, .55, G * 3, pw, G * 2, G * 5, corpo);
        C(o, 0, .55 + G * 2, G * 3, pw - G * 2, G, G * 4, BRANCO); for (let k = 0; k < Math.floor(pw / (G * 2)); k++) C(o, -pw / 2 + G * 2 + k * G * 2, .55 + G * 3, G * 2, G, G / 2, G * 2, PRETO);
        for (const a of [-1, 1]) C(o, a * (pw / 2 - G * 2), 0, G * 4, G * 2, .55, G * 2, corpo);
        return;
      }
      if (/drum|bateria|tambor/.test(classe)) {
        disco(o, 0, 0, 0, s * .2, s * .3, viva(c, '#E5484D')); disco(o, 0, s * .3, 0, s * .2, G, BRANCO);
        for (const a of [-1, 1]) { disco(o, a * s * .25, s * .3, s * .1, s * .1, s * .15, viva(c, '#E5484D')); C(o, a * s * .3, 0, -s * .15, G, s * .7, G, METAL); disco(o, a * s * .3, s * .7, -s * .15, s * .12, G / 2, '#E8C35A'); }
        return;
      }
      C(o, 0, 0, 0, s * .4, G, s * .3, PRETO); C(o, 0, G, -G * 2, G, s * .5, G, METAL);
      if (/mic/.test(classe)) { C(o, 0, G + s * .5, -G * 2, G, s * .5, G, METAL); bolha(o, 0, s, -G * 2, G * 2, 1.2, '#3A3F44'); return; }
      const madeira = viva(c, MADEIRA); // violão encostado no suporte
      C(o, 0, G * 2, 0, s * .32, s * .3, G * 3, madeira); C(o, 0, G * 2 + s * .3, 0, s * .24, s * .22, G * 3, madeira);
      C(o, 0, G * 2 + s * .18, G * 1.6, G * 3, G * 3, G / 2, PRETO); C(o, 0, G * 2 + s * .52, 0, G * 1.5, s * .45, G * 1.5, MADEIRA_ESC);
      C(o, 0, G * 2 + s * .97, 0, G * 2.5, G * 3, G * 1.5, PRETO);
    },
    // Disco de música: a capa em pé num apoio com o vinil saindo de dentro.
    disco(o, { w, d, cor }) {
      const s = Math.min(w, d) * .5, capa = viva(cor.principal, '#8E4EC6');
      C(o, 0, 0, 0, s + G * 2, G, G * 4, PRETO);
      C(o, s * .15, G, 0, s * .9, s * .9, G, PRETO); C(o, s * .15, G + s * .45 - G, G / 2, G * 2, G * 2, G / 2, viva(cor.acento, '#F2C230'));
      C(o, -s * .1, G, G, s * .9, s * .9, G, capa); C(o, -s * .1, G + s * .25, G * 1.6, s * .5, s * .4, G / 4, clara(cor.segunda, BRANCO));
    },
    // Espelho de chão: moldura em pé num apoio, com o vidro claro e o reflexo em diagonal.
    espelho(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d), H = alto(altoArte, 1.5, .4, 2.4), moldura = escura(cor.principal, MADEIRA_ESC), lw = Math.min(s * .6, w - G * 2);
      for (const a of [-1, 1]) C(o, a * lw * .4, 0, 0, G * 2, G, s * .4, tom(moldura, -.15));
      C(o, 0, G, 0, lw, H - G, G * 2, moldura);
      L(o, 0, G * 3, G, lw - G * 4, H - G * 5, G / 2, '#DCEFF6');
      for (let k = 0; k < 3; k++) C(o, -lw * .15 + k * G * 2, H * .55 + k * G * 2, G * 1.4, G * 1.5, G * 1.5, G / 4, '#FFFFFF');
    },
    // Cadeado do amor, chave: o arco de metal e o corpo colorido num apoio.
    cadeado(o, { w, d, cor, classe }) {
      const s = Math.min(w, d), c = viva(cor.principal, '#E5484D'), metal = '#C9CED3';
      if (/(^|[_ ])key|chave/.test(classe)) { C(o, 0, 0, 0, s * .2, G, s * .5, metal); disco(o, 0, G, -s * .18, s * .1, G, viva(cor.acento, '#F2C230')); for (let k = 0; k < 3; k++) C(o, G * 1.5, G, s * .05 + k * G * 2, G * 2, G, G, metal); return; }
      C(o, 0, 0, 0, s * .35, G, s * .2, PRETO);
      C(o, 0, G, 0, s * .3, s * .28, s * .14, c); C(o, 0, G + s * .1, s * .07, G, G * 2, G / 2, PRETO);
      for (const a of [-1, 1]) C(o, a * s * .1, G + s * .28, 0, G * 1.5, s * .14, G * 1.5, metal); C(o, 0, G + s * .42, 0, s * .2 + G * 1.5, G * 1.5, G * 1.5, metal);
    },
    // Telhado e chaminé soltos: o prisma de telhas em degraus (a chaminé de tijolo, com a boca escura).
    telhado(o, { w, d, cor, classe, altoArte = 0 }) {
      const lw = w - G, ld = d - G, c = viva(cor.principal, '#C2553D'), H = alto(altoArte, .6, .15, 2);
      if (/chimney|chamin/.test(classe)) { C(o, 0, 0, 0, Math.min(lw, .5), H, Math.min(ld, .5), c); C(o, 0, H, 0, Math.min(lw, .5) + G, G * 2, Math.min(ld, .5) + G, tom(c, .1)); C(o, 0, H + G, 0, Math.min(lw, .5) - G * 3, G * 1.5, Math.min(ld, .5) - G * 3, PRETO); return; }
      const n = Math.max(3, Math.round(H / (G * 2)));
      for (let k = 0; k < n; k++) C(o, 0, k * H / n, 0, lw, H / n, ld * (1 - k / n) + G, k % 2 ? tom(c, -.1) : c);
    },
    // Adesivo de chão: a chapa fina com a figura recortada nas cores da arte, um degrauzinho acima do piso.
    adesivo(o, { w, d, cor }) {
      const s = Math.min(w, d), c = cor.principal, a2 = cor.acento !== c ? cor.acento : tom(c, -.25);
      C(o, 0, 0, 0, s * .7, G / 2, s * .7, BRANCO);
      C(o, 0, G / 4, 0, s * .6, G / 2, s * .6, c);
      for (const [x, z, l] of [[0, 0, .3], [-.18, -.12, .14], [.18, -.12, .14], [0, .2, .12]]) C(o, x * s, G / 2, z * s, l * s, G / 2, l * s, a2);
    },
    // Lápide, túmulo, cruz: a pedra de topo arredondado em degraus, com a inscrição.
    lapide(o, { w, d, cor, classe, altoArte = 0 }) {
      const s = Math.min(w, d), pedra = clara(cor.principal, '#B8B2A6'), H = alto(altoArte, .7, .3, 1.6);
      if (/coffin|caix[ãa]o|sarc/.test(classe)) { C(o, 0, 0, 0, s * .4, G * 5, s * .8, escura(cor.principal, MADEIRA_ESC)); C(o, 0, G * 5, 0, s * .36, G * 1.5, s * .76, tom(escura(cor.principal, MADEIRA_ESC), .1)); C(o, 0, G * 6.5, 0, G * 1.5, G / 2, s * .4, viva(cor.acento, '#F2C230')); return; }
      if (/cross|cruz/.test(classe)) { C(o, 0, 0, 0, s * .3, G * 2, s * .2, tom(pedra, -.15)); C(o, 0, G * 2, 0, G * 2.5, H - G * 2, G * 2.5, pedra); C(o, 0, H * .65, 0, s * .4, G * 2.5, G * 2.5, pedra); return; }
      C(o, 0, 0, 0, s * .6, G * 2, s * .4, '#7A9A5A'); C(o, 0, G * 2, -s * .05, s * .45, H * .75, G * 3, pedra);
      C(o, 0, G * 2 + H * .75, -s * .05, s * .35, H * .1, G * 3, pedra); C(o, 0, G * 2 + H * .85, -s * .05, s * .2, H * .08, G * 3, pedra);
      C(o, 0, H * .45, -s * .05 + G * 1.6, s * .25, G, G / 4, tom(pedra, -.3)); C(o, 0, H * .35, -s * .05 + G * 1.6, s * .2, G, G / 4, tom(pedra, -.3));
    },
    // ---------- Construção (redesign r5, quadro 35): divisórias, paredes, cantos e portas, que saíam todos num cubo ----------
    // Parede e muro: o pano alto em fiadas (tijolo, pedra) ou liso com o friso, rodapé e o capeamento em cima.
    parede(o, { w, d, cor, classe, altoArte = 0 }) {
      const lw = w - G / 2, c = cor.principal, H = alto(altoArte, 1.6, .4, 2.6), e = G * 4;
      C(o, 0, 0, 0, lw, G * 2, e + G, tom(c, -.22)); // rodapé
      if (/brick|tijolo|stone|pedra|rock|castle|castelo|medieval|dungeon|masmorra|cave|caverna|tomb|tumba|sand|areia|greek|grega|ice|gelo/.test(classe)) {
        const fh = G * 3, n = Math.max(3, Math.round((H - G * 4) / fh)), pedra = Math.max(G * 4, lw / 4);
        for (let k = 0; k < n; k++) { // fiadas desencontradas, a junta um tom abaixo
          const y = G * 2 + k * (H - G * 4) / n, desl = k % 2 ? pedra / 2 : 0;
          C(o, 0, y, 0, lw, (H - G * 4) / n, e, tom(c, -.12));
          for (let x = -lw / 2 - desl; x < lw / 2; x += pedra) { const a = Math.max(-lw / 2, x), b = Math.min(lw / 2, x + pedra - G / 2); if (b - a > G) C(o, (a + b) / 2, y + G / 4, G / 4, b - a, (H - G * 4) / n - G / 2, e, (k + Math.round(x / pedra)) % 3 ? c : tom(c, .07)); }
        }
      } else {
        C(o, 0, G * 2, 0, lw, H - G * 4, e, c);
        C(o, 0, H * .55, G / 4, lw, G, e, tom(c, -.1)); // friso
        if (cor.acento !== c && sat(cor.acento) > .25) C(o, 0, H * .55 + G, G / 2, lw - G * 2, G / 2, e, cor.acento);
      }
      C(o, 0, H - G * 2, 0, lw + G / 2, G * 2, e + G, tom(c, .1)); // capeamento
    },
    // Divisória e biombo: o pano em painéis com moldura, de pé sobre dois pés; o shoji com a grade de ripas.
    divisoria(o, { w, d, cor, classe, altoArte = 0 }) {
      const lw = w - G, c = cor.principal, H = alto(altoArte, 1.3, .3, 2.4), m = escura(cor.segunda, tom(c, -.3)), z = 0;
      const n = Math.max(2, Math.round(lw / .34));
      for (const a of [-1, 1]) C(o, a * (lw / 2 - G * 2), 0, z, G * 3, G, G * 6, m); // pés
      for (let k = 0; k < n; k++) {
        const pw = lw / n, x = -lw / 2 + pw * (k + .5);
        C(o, x, G, z, pw - G / 2, H - G, G * 2, m); // moldura do painel
        if (/shoji|japan|jap[aã]o|onsen|bamboo|bambu/.test(classe)) {
          C(o, x, G * 2, z + G / 4, pw - G * 2.5, H - G * 3, G, BRANCO);
          for (let y = G * 2 + (H - G * 3) / 4; y < H - G * 2; y += (H - G * 3) / 4) C(o, x, y, z + G / 2, pw - G * 2.5, G / 2, G, m);
          C(o, x, G * 2, z + G / 2, G / 2, H - G * 3, G, m);
        } else C(o, x, G * 2, z + G / 4, pw - G * 2.5, H - G * 3, G * 2, k % 2 ? tom(c, -.06) : c);
      }
    },
    // Canto: o L de parede (as duas abas, uma no fundo e uma do lado), com o mesmo capeamento.
    canto(o, { w, d, cor, altoArte = 0 }) {
      const s = Math.min(w, d) - G / 2, c = cor.principal, H = alto(altoArte, 1.4, .3, 2.6), e = G * 4;
      C(o, 0, 0, -s / 2 + e / 2, s, H - G * 2, e, c); C(o, -s / 2 + e / 2, 0, e / 2, e, H - G * 2, s - e, tom(c, -.05));
      C(o, 0, H - G * 2, -s / 2 + e / 2, s + G / 2, G * 2, e + G, tom(c, .1)); C(o, -s / 2 + e / 2, H - G * 2, e / 2, e + G, G * 2, s - e, tom(c, .1));
      C(o, -s / 2 + e / 2, 0, -s / 2 + e / 2, e + G, H, e + G, tom(c, -.15)); // a quina
    },
    // Porta e portão: batente com a folha em almofadas e a maçaneta; o portão é de grade (barras e travessas).
    porta(o, { w, d, cor, classe, altoArte = 0 }) {
      const lw = w - G * 2, c = cor.principal, H = alto(altoArte, 1.8, .6, 2.6), b = escura(cor.segunda, tom(c, -.3)), z = -d / 2 + G * 3;
      for (const a of [-1, 1]) C(o, a * (lw / 2 - G), 0, z, G * 2, H, G * 4, b); C(o, 0, H - G * 2, z, lw, G * 2, G * 4, b); // batente
      if (/gate|port[ãa]o|fence|cerca|turnstile|catraca/.test(classe) && !/door|porta($|[ _])/.test(classe)) {
        const n = Math.max(3, Math.round(lw / (G * 3)));
        for (let k = 0; k < n; k++) C(o, -lw / 2 + G * 2 + (k + .5) * (lw - G * 4) / n, G, z, G, H * .8, G, c);
        for (const y of [G * 2, H * .45, H * .8]) C(o, 0, y, z, lw - G * 4, G * 1.5, G * 1.5, tom(c, -.1));
        return;
      }
      const fw = lw - G * 4, fh = H - G * 3;
      C(o, 0, 0, z + G / 2, fw, fh, G * 2, c); // folha
      for (const y of [fh * .1, fh * .55]) C(o, 0, y, z + G * 1.5, fw - G * 4, fh * .35, G / 2, tom(c, -.08)); // almofadas
      if (/glass|vidro|window|janela/.test(classe)) L(o, 0, fh * .55, z + G * 1.75, fw - G * 5, fh * .33, G / 2, VIDRO);
      C(o, fw / 2 - G * 2, fh * .48, z + G * 2, G, G * 2, G, viva(cor.acento, '#F2C230')); // maçaneta
    },
  };
  return R;
}

// ---------- famílias de parede (redesign r4): 337 das 710 peças de parede caíam no painel liso ----------
// Valem depois das regras de parede que já existiam (tipoDeParede olha estas por último). Convenção de parede: x ao
// longo dela (centro 0), y para cima (base 0), z saindo da parede (a parede em z = 0); w × h é o retângulo da arte.
export const TIPOS_PAREDE_FAMILIAS = [
  ['lareira', /fireplace|lareira|frplc|(^|[_ ])fp($|[_ ]|\d)/],
  ['fonte', /fountain|fonte|waterfall|wfall|cascata|cachoeira/],
  ['tela', /(^|[_ ])tv($|[_ ]|\d)|tel[ãa]o|televis|screen|monitor|countdown|(^|[_ ])year\d|display/],
  ['arandela', /luzes|(^|[ _])luz($|[ _])|(^|[_ ])lights?($|[_ ])|(^|[_ ])led($|[_ ])/],
  ['adesivo', /stick(y|ies|er)|post_?it|adesivo|(^|[_ ])card|(^|[ _])carta|tar[ôo]|calendar|calend[áa]rio|(^|[_ ])note|bilhete|kakejiku|(^|[_ ])sheet/],
  ['armas', /sword|scimitar|espada|ninja|knife|faca|forquilha|pitchfork|shield|escudo|crest|bras[ãa]o|ferradura|horse_?shoe|machado|(^|[_ ])axe/],
  ['instrumento', /guitar|guitarra|surf|prancha|viol[ãa]o|violin/],
  ['enfeite', /bauble|enfeite|ornament|stocking|(^|[ _])meias? d[eo] natal|wreath|guirlanda|apanhador|dreamc|bolinha|na corda|wallskull|(^|[_ ])stars?($|[_ ])|estrela/],
  ['cabeca', /mounted|(^|[_ ])hd\d|cr[âa]nio|skull|caveira|jaws|deer|(^|[_ ])head|cabe[çc]a|mask|m[áa]scara|trof[ée]u|troph|javali|alce|(^|[ _])rena($|[ _])/],
  ['alvo', /dart|(^|[ _])alvo|target|bullet|(^|[_ ])hole|buraco/],
  ['cortina', /curtain|curt($|[_ ]|\d)|cortina|fabric|tecido|sequin|drape|wallrug|tape[çc]aria|tapestry|bordado/],
  ['armario', /(^|[_ ])safe|cofre|wardrobe|wdrobe|roupeiro|oven|forno|sink|(^|[ _])pia($|[ _])|urinal|holder|cabinet|sensor|turbine|turbina|(^|[_ ])fan($|[_ ])|speakers?|walltable|(^|[_ ])can($|[_ ])|crank|plaque/],
  ['paisagem', /(^|[_ ])bg($|[_ ]|\d)|background|landscape|paisagem|sunset|p[ôo]r do sol|horizon|(^|[_ ])sky|c[ée]u|(^|[_ ])view|vista|cityscape|cidade|city|montanha|mountain|savana|savanna|dunas|dunes|paradise|neopia|olympus|seabg|loadscreen|(^|[_ ])build\d|(^|[_ ])big\d|buildings|campestre|horizonte|selvagem|town|fuji/],
  ['revestimento', /wall|parede|muro|muralha|wallpaper|papel de parede|revestimento|isolamento|painel de madeira|(^|[_ ])crnr|(^|[ _])canto|stone|pedras|garagem|cabana|cover/],
];

export function paredeFamilias({ C, L, G, tom, lum, sat, hexRgb, moldura, madeiraDe, LIVROS, METAL }) {
  const PRETO = '#2B2F33', CLARO = '#F7F2E8', TELA = '#1F1D1A';
  const viva = (cor, reserva) => (sat(cor) > .2 ? cor : reserva);
  return {
    // Paisagem, fundo de cena, vista: faixas de céu, morros em degraus e o sol, sem moldura (é o fundo da sala).
    paisagem(o, { w, h, cor }) {
      const ceu = lum(cor.principal) > .45 ? cor.principal : tom(cor.principal, .45), chao = cor.segunda;
      C(o, 0, 0, G / 4, w, h, G / 2, tom(ceu, -.08));
      for (let k = 0; k < 3; k++) C(o, 0, h * (.45 + k * .18), G * .6, w, h * .18, G / 4, tom(ceu, k * .08)); // céu clareando para cima
      const n = Math.max(3, Math.round(w / (G * 6)));
      for (let k = 0; k < n; k++) { const x = -w / 2 + (k + .5) * w / n, alto = h * (.2 + .25 * ((k * 7) % 5) / 4); C(o, x, 0, G * .6, w / n, alto, G / 4, k % 2 ? chao : tom(chao, -.1)); }
      const sol = Math.min(w, h) * .18; C(o, w * .25, h * .62, G * .75, sol, sol, G / 4, viva(cor.acento, '#FFC24D'));
    },
    // Revestimento de parede (tijolo, madeira, azulejo, pedra): o painel com as fiadas desencontradas.
    revestimento(o, { w, h, cor }) {
      const c = cor.principal, junta = tom(c, -.25);
      C(o, 0, 0, G / 4, w, h, G / 2, junta);
      const fiada = Math.max(G * 2, Math.min(G * 4, h / 6)), n = Math.max(2, Math.floor(h / fiada)), peca = Math.max(G * 4, Math.min(w, G * 8));
      for (let k = 0; k < n; k++) {
        const y = k * (h / n), desloc = k % 2 ? peca / 2 : 0;
        for (let x = -w / 2 - desloc; x < w / 2; x += peca) {
          const a = Math.max(-w / 2, x) + G / 4, b = Math.min(w / 2, x + peca) - G / 4; if (b - a < G) continue;
          C(o, (a + b) / 2, y + G / 4, G * .6, b - a, h / n - G / 2, G / 4, (k + Math.round(x / peca)) % 3 ? c : tom(c, .07));
        }
      }
      C(o, 0, 0, G * .9, w, G, G / 2, tom(c, -.15)); // rodapé
    },
    // Enfeite pendurado (bola de Natal, meia, guirlanda, apanhador): o fio e as peças penduradas nas cores da arte.
    enfeite(o, { w, h, cor }) {
      const cores = [viva(cor.principal, '#E5484D'), viva(cor.acento, '#F2C230'), viva(cor.segunda, '#18A957')];
      const n = w >= .8 ? 3 : w >= .4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const x = n === 1 ? 0 : -w / 2 + G * 2 + k * (w - G * 4) / (n - 1), fio = h * (.25 + .2 * (k % 2)), b = Math.max(G * 3, Math.min(w / (n + 1), h * .4));
        C(o, x, h - fio, G * 1.5, G / 2, fio, G / 2, '#C9A23A'); C(o, x, h - G, G * 1.5, G * 1.5, G, G, '#C9A23A'); // fio e o prego
        const y = h - fio - b; C(o, x, y + G, G * 2, b, b - G * 2, b * .6, cores[k % 3]); C(o, x, y, G * 2, b - G * 2, b, b * .6, cores[k % 3]); // a bola em degraus
        C(o, x - b / 4, y + b * .6, G * 2 + b * .3, G, G, G / 4, '#FFFFFF'); C(o, x, y + b, G * 2, G * 1.5, G, G, '#D9B45A'); // brilho e a tampa
      }
    },
    // Tela de parede (TV, telão, placar de contagem): moldura escura e a imagem acesa em faixas.
    tela(o, { w, h, cor }) {
      const iw = w - G * 2, ih = h - G * 2;
      C(o, 0, 0, G * .75, w, h, G * 1.5, TELA); C(o, 0, h * .3, G / 4, G * 3, G * 3, G / 2, PRETO); // a caixa e o suporte
      L(o, 0, G, G * 1.6, iw, ih, G / 4, tom(viva(cor.principal, '#5BC8F5'), .25));
      C(o, 0, G, G * 1.7, iw, ih * .3, G / 4, tom(cor.segunda, .1)); C(o, iw / 5, G + ih * .55, G * 1.7, Math.min(iw, ih) * .25, Math.min(iw, ih) * .25, G / 4, viva(cor.acento, '#FFC24D'));
    },
    // Recado, cartão, carta de tarô, calendário, pergaminho: papéis presos na parede, um sobre o outro, com o alfinete.
    adesivo(o, { w, h, cor }) {
      const papel = lum(cor.principal) > .55 ? cor.principal : CLARO, n = w >= .8 ? 3 : w >= .45 ? 2 : 1, pw = Math.min(w / n + G * 2, w), ph = Math.min(h, pw * 1.3);
      for (let k = 0; k < n; k++) {
        const x = n === 1 ? 0 : -w / 2 + pw / 2 + k * (w - pw) / (n - 1), y = (h - ph) / 2 + (k % 2 ? -G : G), z = G / 4 + k * G / 4;
        C(o, x, y, z, pw - G, ph, G / 2, k % 2 ? tom(papel, -.06) : papel);
        for (let i = 0; i < 3; i++) C(o, x - pw * .1, y + ph * (.3 + i * .18), z + G / 4, Math.max(G, pw * (.5 - i * .1)), G / 2, G / 4, tom(cor.segunda, -.2)); // as linhas escritas
        C(o, x, y + ph - G * 1.5, z + G / 2, G, G, G / 2, viva(cor.acento, '#E5484D')); // o alfinete
      }
    },
    // Cabeça montada (troféu de caça, caveira, máscara): a placa de madeira e a cabeça saindo dela, com chifres ou orelhas.
    cabeca(o, { w, h, cor, classe }) {
      const s = Math.max(G * 6, Math.min(w, h)), y0 = (h - s) / 2, c = cor.principal, placa = madeiraDe(cor);
      C(o, 0, y0 + G, G / 2, s * .7, s * .8, G, placa); C(o, 0, y0, G / 2, s * .5, s, G, placa);
      C(o, 0, y0 + s * .3, G * 2, s * .4, s * .38, G * 3, c); C(o, 0, y0 + s * .32, G * 4, s * .26, s * .22, G * 2, tom(c, .08)); // cabeça e focinho
      for (const a of [-1, 1]) C(o, a * s * .1, y0 + s * .55, G * 3.6, G, G, G / 2, PRETO); // olhos
      const chifre = /deer|alce|rena|javali|horn|chifre/.test(classe);
      for (const a of [-1, 1]) C(o, a * s * .25, y0 + s * .62, G * 2, G * 1.5, chifre ? s * .35 : s * .14, G * 1.5, chifre ? '#E8D9B0' : tom(c, -.08));
    },
    // Armas e brasões: o escudo na parede e duas lâminas cruzadas em degraus.
    armas(o, { w, h, cor, classe }) {
      const s = Math.max(G * 6, Math.min(w, h)), y0 = (h - s) / 2, metal = '#C9CED3', cabo = madeiraDe(cor);
      if (/shield|escudo|crest|bras/.test(classe)) {
        const c = viva(cor.principal, '#B5462F');
        for (let k = 0; k < 4; k++) C(o, 0, y0 + k * s / 5, G * .75, s * (.5 + k * .12), s / 5, G * 1.5, k % 2 ? tom(c, -.08) : c); // o escudo afinando para baixo
        C(o, 0, y0 + s * .8, G * .75, s * .9, s * .2, G * 1.5, tom(c, .08)); C(o, 0, y0 + s * .3, G * 1.6, s * .2, s * .3, G / 2, viva(cor.acento, '#F2C230'));
        return;
      }
      const n = Math.max(4, Math.round(s / G / 1.5));
      for (const lado of [-1, 1]) for (let k = 0; k < n; k++) { // cada lâmina é uma escada de blocos na diagonal
        const t = k / (n - 1), x = lado * (t - .5) * s * .8, y = y0 + t * s * .85;
        C(o, x, y, G * (1 + (lado + 1) / 4), G * 1.5, G * 1.5, G, k < 2 ? cabo : metal);
      }
      C(o, 0, y0 + s * .4, G * 2, G * 3, G * 3, G, viva(cor.acento, '#D9B45A'));
    },
    // Guitarra, prancha: o objeto comprido pendurado em pé, com o corpo e o braço.
    instrumento(o, { w, h, cor, classe }) {
      const c = viva(cor.principal, '#B5462F'), lw = Math.min(w * .8, h * .45);
      if (/surf|prancha/.test(classe)) { for (let k = 0; k < 5; k++) { const t = 1 - Math.abs(k - 2) / 3; C(o, 0, k * h / 5, G, lw * t, h / 5, G * 1.5, c); } C(o, 0, G, G * 1.8, G, h - G * 2, G / 4, viva(cor.acento, CLARO)); return; }
      C(o, 0, 0, G, lw, h * .3, G * 1.5, c); C(o, 0, h * .3, G, lw * .75, h * .15, G * 1.5, c); C(o, 0, h * .15, G * 1.8, G * 2, G * 2, G / 4, PRETO); // corpo e boca
      C(o, 0, h * .45, G, G * 1.5, h * .45, G, madeiraDe(cor)); C(o, 0, h * .9, G, G * 2.5, h * .1, G, PRETO); // braço e cabeça
    },
    // Alvo (dardos, buraco de bala): anéis concêntricos em degraus.
    alvo(o, { w, h, cor }) {
      const s = Math.max(G * 6, Math.min(w, h)), y0 = (h - s) / 2, cores = [PRETO, viva(cor.principal, '#E5484D'), CLARO, viva(cor.principal, '#E5484D'), '#F2C230'];
      cores.forEach((c, k) => { const l = s * (1 - k * .18); C(o, 0, y0 + (s - l) / 2, G / 2 + k * G / 4, l, l, G / 2, c); });
    },
    // Cortina e tecido de parede: o varão e as dobras até embaixo.
    cortina(o, { w, h, cor }) {
      const c = cor.principal, n = Math.max(3, Math.round(w / (G * 2)));
      C(o, 0, h - G * 1.5, G * 1.5, w, G, G, madeiraDe(cor));
      for (let k = 0; k < n; k++) C(o, -w / 2 + (k + .5) * w / n, 0, G * (.75 + (k % 2) * .5), w / n, h - G * 2, G, k % 2 ? tom(c, -.1) : c);
      if (cor.acento !== c) C(o, 0, h - G * 3, G * 2, w, G, G / 2, cor.acento);
    },
    // Armário de parede, cofre, forno, pia, aparelho: a caixa saltada com a porta e o puxador.
    armario(o, { w, h, cor }) {
      const c = cor.principal, bw = w - G, bh = h - G;
      C(o, 0, G / 2, G * 2.5, bw, bh, G * 5, c); C(o, 0, G / 2 + bh - G, G * 2.75, bw + G / 2, G, G * 5.5, tom(c, .1));
      C(o, 0, G * 1.5, G * 5.25, bw - G * 2, bh - G * 3, G / 2, tom(c, .06));
      C(o, bw / 2 - G * 2, G / 2 + bh / 2, G * 5.75, G, G * 2, G / 2, viva(cor.acento, METAL));
    },
    // Fonte de parede e cascata: a placa, a água caindo acesa e a bacia embaixo.
    fonte(o, { w, h, cor }) {
      const pedra = lum(cor.principal) > .4 ? cor.principal : '#CFC6B2';
      C(o, 0, 0, G / 2, w, h, G, tom(pedra, -.1)); C(o, 0, h - G * 2, G * 1.5, w * .5, G * 2, G * 2, pedra);
      L(o, 0, G * 3, G * 1.2, w * .3, h - G * 5, G / 2, '#9AD8F0');
      C(o, 0, 0, G * 3, w * .8, G * 3, G * 5, pedra); L(o, 0, G * 2, G * 3, w * .7, G, G * 4, '#7FC8E8');
    },
    // Lareira de parede: a moldura de pedra, a boca escura e o fogo aceso.
    lareira(o, { w, h, cor }) {
      const pedra = lum(cor.principal) > .35 ? cor.principal : '#B8B2A6', bh = Math.min(h, w * .9);
      C(o, 0, 0, G * 2, w, bh, G * 4, pedra); C(o, 0, bh - G, G * 2.5, w + G, G * 1.5, G * 5, tom(pedra, .1));
      C(o, 0, 0, G * 3.6, w * .55, bh * .6, G * .8, '#2B1D14');
      for (let k = 0; k < 3; k++) L(o, 0, G + k * G * 1.5, G * 4.1, w * (.4 - k * .1), G * 1.5, G / 2, ['#FF7A2F', '#FFB347', '#FFE38A'][k]);
    },
  };
}
