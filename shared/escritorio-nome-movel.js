// shared/escritorio-nome-movel.js — nome em português dos móveis do catálogo do Escritório.
//
// Regra 4 do redesign (Paulo, moodboard de 10/11/2026: "tudo que é imagem é voxel, com nome em português"):
// o acervo vem do Habbo, metade em inglês ("Blue Couch", "Magic Carpet (Stand on it!)"). Uma tradução só,
// para TODOS os itens (Loja, inventário, decorar, construção, ficha): o substantivo vai na frente, os
// adjetivos concordam com ele ("Mesa vermelha"), parênteses de aviso do Habbo ("non-tradeable", "Stand on
// it!") saem e só a cor entre parênteses fica. Palavra sem tradução (nome próprio, marca) continua como
// está. O nome original continua valendo na busca (quem chama junta os dois).
// Função pura: no navegador fica em window.VybeNomeMovel; nos testes, por module.exports.
(function (raiz) {
  // Substantivos (o primeiro achado vira o núcleo do nome). Gênero: 'a' = feminino.
  const S = {
    table: 'Mesa:a', chair: 'Cadeira:a', tree: 'Árvore:a', lamp: 'Luminária:a', sofa: 'Sofá', couch: 'Sofá', sofachair: 'Poltrona:a',
    corner: 'Canto', divider: 'Divisória:a', stool: 'Banqueta:a', rug: 'Tapete', plant: 'Planta:a', bench: 'Banco', shelf: 'Prateleira:a',
    shelves: 'Prateleiras:a', shelving: 'Estante:a', light: 'Luz:a', lights: 'Luzes:a', desk: 'Escrivaninha:a', seat: 'Assento', armchair: 'Poltrona:a',
    flower: 'Flor:a', flowers: 'Flores:a', fence: 'Cerca:a', floor: 'Piso', wall: 'Parede:a', counter: 'Balcão', block: 'Bloco', pillow: 'Almofada:a',
    stage: 'Palco', bookcase: 'Estante:a', bookshelf: 'Estante:a', carpet: 'Carpete', candles: 'Velas:a', candle: 'Vela:a', throne: 'Trono', vase: 'Vaso',
    lantern: 'Lanterna:a', lanterns: 'Lanternas:a', ball: 'Bola:a', bush: 'Arbusto', toilet: 'Vaso sanitário', loo: 'Vaso sanitário', lounge: 'Espreguiçadeira:a',
    cat: 'Gato', screen: 'Tela:a', scoreboard: 'Placar', drinks: 'Bebidas:a', tea: 'Chá', pillar: 'Pilar', chandelier: 'Lustre', box: 'Caixa:a',
    rock: 'Pedra:a', stone: 'Pedra:a', bed: 'Cama:a', garden: 'Jardim', cushion: 'Almofada:a', fan: 'Ventilador', cactus: 'Cacto', bonsai: 'Bonsai',
    gate: 'Portão', mattress: 'Colchão', computer: 'Computador', laptop: 'Notebook', notebook: 'Caderno', tv: 'TV:a', fridge: 'Geladeira:a',
    stove: 'Fogão', sink: 'Pia:a', cabinet: 'Armário', cupboard: 'Armário', wardrobe: 'Guarda-roupa', locker: 'Armário', crate: 'Caixote', pot: 'Vaso',
    torch: 'Tocha:a', palm: 'Palmeira:a', jukebox: 'Jukebox:a', clock: 'Relógio', mirror: 'Espelho', window: 'Janela:a', door: 'Porta:a',
    statue: 'Estátua:a', statuette: 'Estatueta:a', sculpture: 'Escultura:a', fountain: 'Fonte:a', printer: 'Impressora:a', whiteboard: 'Quadro branco',
    bar: 'Bar', railing: 'Grade:a', tile: 'Ladrilho', tiles: 'Ladrilhos', poster: 'Pôster', flag: 'Bandeira:a', flags: 'Bandeiras:a', sign: 'Placa:a',
    signs: 'Placas:a', basket: 'Cesta:a', balloon: 'Balão', chest: 'Baú', tray: 'Bandeja:a', rack: 'Suporte', guitar: 'Guitarra:a', bath: 'Banheira:a',
    plush: 'Pelúcia:a', plushy: 'Pelúcia:a', plushie: 'Pelúcia:a', teddy: 'Ursinho', bear: 'Urso', monkey: 'Macaco', water: 'Água:a', display: 'Expositor',
    rose: 'Rosa:a', roses: 'Rosas:a', library: 'Biblioteca:a', grass: 'Grama:a', pod: 'Cápsula:a', bubble: 'Bolha:a', cabin: 'Cabana:a', lodge: 'Chalé',
    mansion: 'Mansão:a', track: 'Trilho', book: 'Livro', books: 'Livros', bomb: 'Bomba:a', beach: 'Praia:a', tiger: 'Tigre', gift: 'Presente', card: 'Cartão',
    cards: 'Cartas:a', mall: 'Shopping', swing: 'Balanço', cloud: 'Nuvem:a', dungeon: 'Masmorra:a', trophy: 'Troféu', painting: 'Quadro', picture: 'Quadro',
    frame: 'Moldura:a', easel: 'Cavalete', temple: 'Templo', tower: 'Torre:a', head: 'Cabeça:a', hospital: 'Hospital', roof: 'Telhado', leaf: 'Folha:a',
    bag: 'Bolsa:a', sack: 'Saco', cake: 'Bolo', stack: 'Pilha:a', pile: 'Pilha:a', horse: 'Cavalo', foot: 'Pé', room: 'Sala:a', bamboo: 'Bambu', tube: 'Tubo',
    boat: 'Barco', ship: 'Navio', buoy: 'Boia:a', platform: 'Plataforma:a', saloon: 'Saloon', tent: 'Barraca:a', cube: 'Cubo', mat: 'Tapete',
    building: 'Prédio', brick: 'Tijolo', food: 'Comida:a', diner: 'Lanchonete:a', dog: 'Cachorro', puppy: 'Filhote', pug: 'Pug', plate: 'Prato',
    patio: 'Pátio', lunch: 'Almoço', console: 'Console', tatami: 'Tatame', globe: 'Globo', sand: 'Areia:a', castle: 'Castelo', fort: 'Forte',
    blossom: 'Flor:a', juice: 'Suco', can: 'Lata:a', road: 'Estrada:a', car: 'Carro', cart: 'Carrinho', pig: 'Porco', unit: 'Módulo', cafeteria: 'Lanchonete:a',
    cafe: 'Café', coffee: 'Café', shop: 'Loja:a', stall: 'Barraca:a', kiosk: 'Quiosque', banner: 'Faixa:a', board: 'Quadro', stairs: 'Escada:a',
    princess: 'Princesa:a', planter: 'Floreira:a', cottage: 'Casinha:a', house: 'Casa:a', graffiti: 'Grafite', stars: 'Estrelas:a', star: 'Estrela:a',
    logo: 'Logo', arrow: 'Seta:a', wallrug: 'Tapeçaria:a', rabbit: 'Coelho', bunny: 'Coelhinho', mask: 'Máscara:a', minibar: 'Frigobar', pumpkin: 'Abóbora:a',
    fruit: 'Fruta:a', elephant: 'Elefante', piano: 'Piano', hat: 'Chapéu', dragon: 'Dragão', space: 'Espaço', curtain: 'Cortina:a', lobby: 'Saguão',
    banana: 'Banana:a', candy: 'Doce', ceiling: 'Teto', shark: 'Tubarão', parasol: 'Guarda-sol', spaceship: 'Nave:a', bowl: 'Tigela:a', paper: 'Papel',
    leg: 'Perna:a', potion: 'Poção:a', costume: 'Fantasia:a', cream: 'Creme', crystal: 'Cristal', zone: 'Zona:a', vanity: 'Penteadeira:a', band: 'Banda:a',
    hexagon: 'Hexágono', hand: 'Mão:a', barrel: 'Barril', holder: 'Suporte', spotlight: 'Holofote', memorial: 'Memorial', sky: 'Céu', prison: 'Prisão:a',
    surfboard: 'Prancha:a', rooster: 'Galo', theater: 'Teatro', theatre: 'Teatro', circle: 'Círculo', hole: 'Buraco', attic: 'Sótão', streetlight: 'Poste',
    speakers: 'Caixas de som:a', speaker: 'Caixa de som:a', lighthouse: 'Farol', desktop: 'Computador', phone: 'Telefone', ray: 'Raio', ox: 'Boi',
    waterfall: 'Cachoeira:a', switch: 'Interruptor', cover: 'Capa:a', gnome: 'Gnomo', fairy: 'Fada:a', coat: 'Casaco', lady: 'Dama:a', station: 'Estação:a',
    safe: 'Cofre', mushroom: 'Cogumelo', video: 'Vídeo', carousel: 'Carrossel', unicorn: 'Unicórnio', earth: 'Terra:a', snack: 'Lanche', pizza: 'Pizza:a',
    shower: 'Chuveiro', wafer: 'Wafer', tomato: 'Tomate', pond: 'Lago', lagoon: 'Lagoa:a', floorboards: 'Assoalho', bedroom: 'Quarto', flamingo: 'Flamingo',
    dolly: 'Boneca:a', doll: 'Boneca:a', inn: 'Pousada:a', queen: 'Rainha:a', king: 'Rei', envelope: 'Envelope', tyre: 'Pneu', tire: 'Pneu', sea: 'Mar',
    pineapple: 'Abacaxi', club: 'Clube', pole: 'Poste', stick: 'Bastão', snowman: 'Boneco de neve', salon: 'Salão', blanket: 'Cobertor', stump: 'Toco',
    boutique: 'Butique:a', monster: 'Monstro', hedge: 'Cerca viva:a', trunk: 'Tronco', log: 'Tronco', owl: 'Coruja:a', frog: 'Sapo', camera: 'Câmera:a',
    cheese: 'Queijo', bottle: 'Garrafa:a', fireplace: 'Lareira:a', sun: 'Sol', aquarium: 'Aquário', knife: 'Faca:a', vines: 'Trepadeira:a', goat: 'Cabra:a',
    snow: 'Neve:a', rat: 'Rato', background: 'Fundo', penguin: 'Pinguim', jellyfish: 'Água-viva:a', scarecrow: 'Espantalho', teapot: 'Bule', nest: 'Ninho',
    skate: 'Skate', case: 'Estojo', fireworks: 'Fogos', moon: 'Lua:a', icecream: 'Sorvete', duck: 'Pato', ducky: 'Patinho', bird: 'Pássaro', fish: 'Peixe',
    egg: 'Ovo', heart: 'Coração', skull: 'Caveira:a', bone: 'Osso', ghost: 'Fantasma', robot: 'Robô', machine: 'Máquina:a', panel: 'Painel', angle: 'Canto',
    arch: 'Arco', bridge: 'Ponte:a', stair: 'Escada:a', step: 'Degrau', steps: 'Degraus', ladder: 'Escada:a', column: 'Coluna:a', post: 'Poste', pipe: 'Cano',
    bin: 'Lixeira:a', trash: 'Lixeira:a', tub: 'Banheira:a', hammock: 'Rede:a', umbrella: 'Guarda-chuva', bike: 'Bicicleta:a', bicycle: 'Bicicleta:a',
    drum: 'Tambor', drums: 'Bateria:a', microphone: 'Microfone', mic: 'Microfone', radio: 'Rádio', speakerbox: 'Caixa de som:a', telescope: 'Telescópio',
    map: 'Mapa', globe2: 'Globo', fireplace2: 'Lareira:a', oven: 'Forno', grill: 'Churrasqueira:a', bbq: 'Churrasqueira:a', pool: 'Piscina:a', tank: 'Tanque',
    portal: 'Portal', teleport: 'Teletransporte', teleporter: 'Teletransporte', tele: 'Teletransporte', dice: 'Dado', rocket: 'Foguete', plane: 'Avião',
    train: 'Trem', bus: 'Ônibus', truck: 'Caminhão', van: 'Van:a', tractor: 'Trator', hut: 'Cabana:a', igloo: 'Iglu', cave: 'Caverna:a', volcano: 'Vulcão',
    mountain: 'Montanha:a', hill: 'Colina:a', island: 'Ilha:a', river: 'Rio', lake: 'Lago', wave: 'Onda:a', shell: 'Concha:a', coral: 'Coral', reef: 'Recife',
    tablet: 'Tablet', pc: 'Computador', keyboard: 'Teclado', mouse: 'Mouse', cup: 'Xícara:a', mug: 'Caneca:a', glass2: 'Copo', jar: 'Pote', pan: 'Panela:a',
    kettle: 'Chaleira:a', toaster: 'Torradeira:a', blender: 'Liquidificador', microwave: 'Micro-ondas', dishwasher: 'Lava-louça:a', washer: 'Lavadora:a',
    stand: 'Suporte', pedestal: 'Pedestal', podium: 'Pódio', altar: 'Altar', cross: 'Cruz:a', tomb: 'Túmulo', grave: 'Túmulo', coffin: 'Caixão', cage: 'Gaiola:a',
    kennel: 'Casinha:a', doghouse: 'Casinha:a', bowl2: 'Tigela:a', feeder: 'Comedouro', trough: 'Cocho', hay: 'Feno', barn: 'Celeiro', windmill: 'Moinho',
    well: 'Poço', wheel: 'Roda:a', gear: 'Engrenagem:a', lever: 'Alavanca:a', button: 'Botão', pad: 'Plataforma:a', tile2: 'Ladrilho', roller: 'Esteira:a',
    rollers: 'Esteira:a', conveyor: 'Esteira:a', trampoline: 'Cama elástica:a', slide: 'Escorregador', seesaw: 'Gangorra:a', hoop: 'Aro', goal: 'Gol',
    net: 'Rede:a', bat: 'Morcego', dino: 'Dinossauro', dinosaur: 'Dinossauro', lion: 'Leão', zebra: 'Zebra:a', giraffe: 'Girafa:a', panda: 'Panda',
    cow: 'Vaca:a', sheep: 'Ovelha:a', chicken: 'Galinha:a', snake: 'Cobra:a', turtle: 'Tartaruga:a', crab: 'Caranguejo', octopus: 'Polvo', whale: 'Baleia:a',
    dolphin: 'Golfinho', fox: 'Raposa:a', wolf: 'Lobo', deer: 'Cervo', reindeer: 'Rena:a', butterfly: 'Borboleta:a', bee: 'Abelha:a', spider: 'Aranha:a',
    web: 'Teia:a', clover: 'Trevo', mushrooms: 'Cogumelos', leaves: 'Folhas:a', branch: 'Galho', root: 'Raiz:a', seed: 'Semente:a', seeds: 'Sementes:a',
    pine: 'Pinheiro', fir: 'Pinheiro', oak: 'Carvalho', willow: 'Salgueiro', cherry: 'Cerejeira:a', tulip: 'Tulipa:a', tulips: 'Tulipas:a', daisy: 'Margarida:a',
    sunflower: 'Girassol', lily: 'Lírio', lotus: 'Lótus', orchid: 'Orquídea:a', ivy: 'Hera:a', moss: 'Musgo', hedgehog: 'Ouriço', snowflake: 'Floco de neve',
    present: 'Presente', present2: 'Presente', wreath: 'Guirlanda:a', garland: 'Guirlanda:a', ornament: 'Enfeite', ornaments: 'Enfeites', bauble: 'Bola:a',
    stocking: 'Meia:a', sleigh: 'Trenó', elf: 'Elfo', santa: 'Papai Noel', reindeer2: 'Rena:a', cookie: 'Biscoito', cookies: 'Biscoitos', cupcake: 'Cupcake',
    cupcakes: 'Cupcakes', donut: 'Rosquinha:a', burger: 'Hambúrguer', hotdog: 'Cachorro-quente', popcorn: 'Pipoca:a', soda: 'Refrigerante', icecream2: 'Sorvete',
    chocolate: 'Chocolate', sweets: 'Doces', lollipop: 'Pirulito', pie: 'Torta:a', bread: 'Pão', sushi: 'Sushi', noodle: 'Macarrão', noodles: 'Macarrão',
    tea2: 'Chá', piñata: 'Piñata:a', pinata: 'Piñata:a', confetti: 'Confete', party: 'Festa:a', disco: 'Discoteca:a', dj: 'DJ', booth: 'Cabine:a',
    turntable: 'Toca-discos', record: 'Disco', records: 'Discos', vinyl: 'Vinil', harp: 'Harpa:a', violin: 'Violino', trumpet: 'Trompete', sax: 'Saxofone',
    organ: 'Órgão', bell: 'Sino', bells: 'Sinos', gong: 'Gongo', amp: 'Amplificador', amplifier: 'Amplificador', jukebox2: 'Jukebox:a',
    trolley: 'Carrinho', wagon: 'Carroça:a', carriage: 'Carruagem:a', hydrant: 'Hidrante', mailbox: 'Caixa de correio:a', booth2: 'Cabine:a',
    vending: 'Máquina:a', arcade: 'Fliperama', pinball: 'Pinball', foosball: 'Pebolim', footballtable: 'Pebolim', billiard: 'Sinuca:a', pooltable: 'Sinuca:a',
    chess: 'Xadrez', chessboard: 'Tabuleiro de xadrez', checkers: 'Damas:a', poker: 'Pôquer', roulette: 'Roleta:a', slot2: 'Caça-níquel',
    countdown: 'Contagem regressiva:a', timer: 'Cronômetro', calendar: 'Calendário', clock2: 'Relógio', hourglass: 'Ampulheta:a', compass: 'Bússola:a',
    sword: 'Espada:a', shield: 'Escudo', armor: 'Armadura:a', armour: 'Armadura:a', helmet: 'Capacete', crown: 'Coroa:a', cannon: 'Canhão', anchor: 'Âncora:a',
    wheelbarrow: 'Carrinho de mão', shovel: 'Pá:a', rake: 'Ancinho', can2: 'Lata:a', hose: 'Mangueira:a', sprinkler: 'Irrigador', scale: 'Balança:a',
    telescope2: 'Telescópio', projector: 'Projetor', camera2: 'Câmera:a', tripod: 'Tripé', spot: 'Holofote', curtains: 'Cortinas:a', blinds: 'Persiana:a',
    shutter: 'Veneziana:a', rail: 'Trilho', track2: 'Trilho', runway: 'Passarela:a', catwalk: 'Passarela:a', carpet2: 'Carpete', doormat: 'Capacho',
    towel: 'Toalha:a', basin: 'Pia:a', bathtub: 'Banheira:a', jacuzzi: 'Jacuzzi:a', sauna: 'Sauna:a', spa: 'Spa', onsen: 'Onsen', lifebuoy: 'Boia:a',
    deckchair: 'Espreguiçadeira:a', sunbed: 'Espreguiçadeira:a', hammock2: 'Rede:a', canopy: 'Dossel', bunk: 'Beliche', crib: 'Berço', cradle: 'Berço',
    dresser: 'Cômoda:a', drawer: 'Gaveta:a', drawers: 'Gaveteiro', nightstand: 'Criado-mudo', sideboard: 'Aparador', bureau: 'Escrivaninha:a',
    ottoman: 'Pufe', pouf: 'Pufe', beanbag: 'Pufe', recliner: 'Poltrona:a', chaise: 'Chaise:a', loveseat: 'Namoradeira:a', settee: 'Sofá', futon: 'Futon',
    shelf2: 'Prateleira:a', hook: 'Gancho', hanger: 'Cabide', mannequin: 'Manequim', wig: 'Peruca:a', vanity2: 'Penteadeira:a', fountain2: 'Fonte:a',
    birdbath: 'Bebedouro', birdhouse: 'Casinha de passarinho:a', bench2: 'Banco', streetlamp: 'Poste', lamppost: 'Poste', bollard: 'Balizador', cone: 'Cone',
    barrier: 'Barreira:a', fence2: 'Cerca:a', wall2: 'Parede:a', wall1: 'Parede:a', gate2: 'Portão', archway: 'Arco', tunnel: 'Túnel', pyramid: 'Pirâmide:a',
    obelisk: 'Obelisco', totem: 'Totem', idol: 'Ídolo', relic: 'Relíquia:a', artifact: 'Artefato', treasure: 'Tesouro', coin: 'Moeda:a', coins: 'Moedas:a',
    gem: 'Gema:a', jewel: 'Joia:a', diamond: 'Diamante', ruby: 'Rubi', emerald: 'Esmeralda:a', pearl: 'Pérola:a', egg2: 'Ovo', nest2: 'Ninho', hive: 'Colmeia:a',
    terrarium: 'Terrário', aquarium2: 'Aquário', bowl3: 'Aquário', bubbles: 'Bolhas:a', cloud2: 'Nuvem:a', rainbow: 'Arco-íris', sunlight: 'Luz do sol:a',
    sunset: 'Pôr do sol', moonlight: 'Luar', firepit: 'Fogueira:a', bonfire: 'Fogueira:a', campfire: 'Fogueira:a', fire: 'Fogo', smoke: 'Fumaça:a',
    mist: 'Névoa:a', fog: 'Neblina:a', ice: 'Gelo', icicle: 'Pingente de gelo', snowball: 'Bola de neve:a', igloo2: 'Iglu', sled: 'Trenó', ski: 'Esqui',
    goalpost: 'Trave:a', basketball: 'Basquete', football: 'Futebol', soccer: 'Futebol', tennis: 'Tênis', golf: 'Golfe', bowling: 'Boliche', boxing: 'Boxe',
    dumbbell: 'Haltere', treadmill: 'Esteira:a', weights: 'Pesos', yoga: 'Ioga:a', gym: 'Academia:a', ring: 'Ringue', trophy2: 'Troféu', medal: 'Medalha:a',
    cup2: 'Taça:a', plaque: 'Placa:a', badge: 'Emblema', badges: 'Emblemas', certificate: 'Certificado', diploma: 'Diploma', globe3: 'Globo', atlas: 'Atlas',
    telescope3: 'Telescópio', microscope: 'Microscópio', flask: 'Frasco', beaker: 'Béquer', laboratory: 'Laboratório', lab: 'Laboratório', robot2: 'Robô',
    satellite: 'Satélite', ufo: 'Disco voador', alien: 'Alienígena', planet: 'Planeta', comet: 'Cometa', meteor: 'Meteoro', galaxy: 'Galáxia:a',
    reactor: 'Reator', generator: 'Gerador', battery: 'Bateria:a', cable: 'Cabo', antenna: 'Antena:a', dish: 'Antena:a', server: 'Servidor', terminal: 'Terminal',
    monitor: 'Monitor', tv2: 'TV:a', set: 'Conjunto', kit: 'Kit', pack: 'Pacote', bundle: 'Pacote', collection: 'Coleção:a', piece: 'Peça:a', part: 'Parte:a',
    quarter: 'Quarto', half: 'Metade:a', section: 'Seção:a', edge: 'Borda:a', edging: 'Borda:a', border: 'Borda:a', trim: 'Acabamento', end: 'Ponta:a',
    middle: 'Meio', center: 'Centro', centre: 'Centro', back: 'Encosto', top: 'Topo', base: 'Base:a', bottom: 'Fundo', side2: 'Lateral:a',
    terrace: 'Terraço', balcony: 'Sacada:a', porch: 'Varanda:a', deck: 'Deque', dock: 'Píer', pier: 'Píer', jetty: 'Píer', bay: 'Baía:a', harbor: 'Porto',
    office: 'Escritório', studio: 'Estúdio', gallery: 'Galeria:a', museum: 'Museu', school: 'Escola:a', classroom: 'Sala de aula:a', church: 'Igreja:a',
    hall: 'Salão', kitchen: 'Cozinha:a', bathroom: 'Banheiro', dorm: 'Dormitório', academy: 'Academia:a', library2: 'Biblioteca:a', market: 'Mercado',
    bazaar: 'Bazar', fair: 'Feira:a', festival: 'Festival', circus: 'Circo', carnival: 'Carnaval', parade: 'Desfile', resort: 'Resort', hotel: 'Hotel',
    city: 'Cidade:a', town: 'Cidade:a', village: 'Vila:a', street: 'Rua:a', park: 'Parque', jungle: 'Selva:a', forest: 'Floresta:a', woods: 'Bosque',
    desert: 'Deserto', swamp: 'Pântano', farm: 'Fazenda:a', ranch: 'Rancho', countryside: 'Campo', country: 'Campo', kingdom: 'Reino', empire: 'Império',
    world: 'Mundo', land: 'Terra:a', paradise: 'Paraíso', heaven: 'Céu', hell: 'Inferno', underworld: 'Submundo', patch: 'Canteiro', bed2: 'Canteiro',
    lawn: 'Gramado', meadow: 'Prado', field: 'Campo', path: 'Caminho', walk: 'Calçada:a', sidewalk: 'Calçada:a', pavement: 'Calçada:a', cobblestone: 'Pedra:a',
    cobblestones: 'Pedras:a', gravel: 'Cascalho', concrete: 'Concreto', asphalt: 'Asfalto', marble2: 'Mármore', granite: 'Granito', wood2: 'Madeira:a',
    plank: 'Tábua:a', planks: 'Tábuas:a', beam: 'Viga:a', panel2: 'Painel', glass3: 'Vidro', window2: 'Janela:a', skylight: 'Claraboia:a', mosaic: 'Mosaico',
    pattern: 'Estampa:a', stripe: 'Listra:a', stripes: 'Listras:a', dots: 'Bolinhas:a', check: 'Xadrez', plaid: 'Xadrez', heart2: 'Coração', smiley: 'Carinha:a',
    emoji: 'Carinha:a', face: 'Rosto', portrait: 'Retrato', photo: 'Foto:a', photocard: 'Foto:a', postcard: 'Cartão-postal', letter: 'Carta:a', note: 'Bilhete',
    notes: 'Bilhetes', sticky: 'Lembrete', stickies: 'Lembretes', sticker: 'Adesivo', decal: 'Adesivo', paint: 'Tinta:a', spray: 'Spray', brush: 'Pincel',
    palette: 'Paleta:a', canvas: 'Tela:a', artwork: 'Obra:a', art: 'Arte:a', artist: 'Artista', mural: 'Mural', tapestry: 'Tapeçaria:a', scroll: 'Pergaminho',
    scrolls: 'Pergaminhos', kakejiku: 'Kakejiku', fan2: 'Leque', lanternpost: 'Poste', torii: 'Torii', pagoda: 'Pagode', shrine: 'Santuário',
    buddha: 'Buda', dragon2: 'Dragão', koi: 'Carpa:a', carp: 'Carpa:a', bamboo2: 'Bambu', sake: 'Saquê', teahouse: 'Casa de chá:a', futon2: 'Futon',
    screen2: 'Biombo', partition: 'Divisória:a', room2: 'Sala:a', supply: 'Suprimento', supplies: 'Suprimentos', equipment: 'Equipamento', tools: 'Ferramentas:a',
    tool: 'Ferramenta:a', toolbox: 'Caixa de ferramentas:a', workbench: 'Bancada:a', bench3: 'Bancada:a', anvil: 'Bigorna:a', forge: 'Forja:a',
    cauldron: 'Caldeirão', broom: 'Vassoura:a', wand: 'Varinha:a', crystalball: 'Bola de cristal:a', spellbook: 'Livro de feitiços', witch: 'Bruxa:a',
    wizard: 'Mago', vampire: 'Vampiro', zombie: 'Zumbi', mummy: 'Múmia:a', skeleton: 'Esqueleto', pumpkin2: 'Abóbora:a', cobweb: 'Teia:a', tombstone: 'Lápide:a',
    holder2: 'Suporte', sale: 'Liquidação:a', mystery: 'Mistério', sculpture2: 'Escultura:a', tribe: 'Tribo:a', mood: 'Clima', melody: 'Melodia:a',
    harmony: 'Harmonia:a', passion: 'Paixão:a', love: 'Amor', pride: 'Orgulho', dream: 'Sonho', story: 'História:a', stories: 'Histórias:a',
    storybook: 'Livro de histórias', time: 'Tempo', future: 'Futuro', boss: 'Chefe', master: 'Mestre', professor: 'Professor', builder: 'Construtor',
    pirate: 'Pirata', ninja: 'Ninja', knight: 'Cavaleiro', viking: 'Viking', samurai: 'Samurai', cowboy: 'Caubói', sheriff: 'Xerife', soldier: 'Soldado',
    chef: 'Chef', doctor: 'Médico', nurse: 'Enfermeira:a', police: 'Polícia:a', fireman: 'Bombeiro', angel: 'Anjo', devil: 'Diabo', cupid: 'Cupido',
    baby: 'Bebê', kid: 'Criança:a', girl: 'Menina:a', boy: 'Menino', lady2: 'Dama:a', man: 'Homem', woman: 'Mulher:a', family: 'Família:a', friend: 'Amigo',
    friends: 'Amigos', group: 'Grupo', team: 'Time', crew: 'Turma:a', newbie: 'Novato', gamer: 'Gamer', hipster: 'Hipster', punk2: 'Punk', goth: 'Gótico',
    plate2: 'Prato', tray2: 'Bandeja:a', menu: 'Cardápio', register: 'Caixa registradora:a', till: 'Caixa:a', counter2: 'Balcão', showcase: 'Vitrine:a',
    vitrine: 'Vitrine:a', cabinet2: 'Armário', icebox: 'Geladeira:a', cooler: 'Cooler', freezer: 'Freezer', mixer: 'Batedeira:a', grinder: 'Moedor',
    espresso: 'Expresso', cappuccino: 'Cappuccino', latte: 'Café com leite', wine: 'Vinho', beer: 'Cerveja:a', cocktail: 'Coquetel', milkshake: 'Milk-shake',
    lemonade: 'Limonada:a', water2: 'Água:a', bubblejuice: 'Suco borbulhante', potion2: 'Poção:a', cauldron2: 'Caldeirão', tap: 'Torneira:a', keg: 'Barril',
    goodie: 'Brinde', goodies: 'Brindes', prize: 'Prêmio', reward: 'Recompensa:a', voucher: 'Vale', ticket: 'Ingresso', vote: 'Voto', ballot: 'Urna:a',
    sit: 'Assento', toucan: 'Tucano', berries: 'Frutinhas:a', bananas: 'Bananas:a', cryo: 'Criogenia:a', seat2: 'Assento', lounger: 'Espreguiçadeira:a', bar2: 'Bar', lightstick: 'Bastão de luz', glowstick: 'Bastão de luz',
    // Palavras do catálogo que já são substantivos em português (o nome misturado: "Bloco azul").
    mesa: 'Mesa:a', cadeira: 'Cadeira:a', bloco: 'Bloco', parede: 'Parede:a', caixa: 'Caixa:a', porta: 'Porta:a', janela: 'Janela:a', estátua: 'Estátua:a',
    piso: 'Piso', cama: 'Cama:a', luz: 'Luz:a', sofá: 'Sofá', planta: 'Planta:a', poltrona: 'Poltrona:a', estante: 'Estante:a', armário: 'Armário',
    cortina: 'Cortina:a', tapete: 'Tapete', banco: 'Banco', vaso: 'Vaso', árvore: 'Árvore:a', luminária: 'Luminária:a', lâmpada: 'Lâmpada:a',
  };
  // Adjetivos e complementos (vão depois do substantivo). "o" no fim muda para "a" com substantivo feminino.
  const A = {
    dark: 'escuro', blue: 'azul', red: 'vermelho', black: 'preto', modern: 'moderno', yellow: 'amarelo', pink: 'rosa', white: 'branco', green: 'verde',
    large: 'grande', glass: 'de vidro', gold: 'dourado', golden: 'dourado', gilded: 'dourado', dining: 'de jantar', street: 'de rua', side: 'lateral',
    beige: 'bege', small: 'pequeno', purple: 'roxo', violet: 'violeta', gray: 'cinza', grey: 'cinza', wooden: 'de madeira', kitchen: 'de cozinha',
    picnic: 'de piquenique', chinese: 'chinês', inflatable: 'inflável', folding: 'dobrável', ancient: 'antigo', marble: 'de mármore', executive: 'executivo',
    orange: 'laranja', hanging: 'suspenso', leather: 'de couro', school: 'da escola', bathroom: 'de banheiro', solid: 'sólido', potted: 'no vaso',
    aquamarine: 'água-marinha', electric: 'elétrico', old: 'antigo', office: 'de escritório', three: 'de três lugares', two: 'de dois lugares',
    suspended: 'suspenso', 'pool-side': 'de piscina', poolside: 'de piscina', iced: 'de gelo', round: 'redondo', square: 'quadrado', long: 'comprido',
    mini: 'mini', big: 'grande', tall: 'alto', low: 'baixo', double: 'duplo', single: 'simples', silver: 'prateado', brown: 'marrom', wood: 'de madeira',
    metal: 'de metal', plastic: 'de plástico', magic: 'mágico', magical: 'mágico', mystic: 'místico', gothic: 'gótico', goth: 'gótico', elegant: 'elegante',
    classic: 'clássico', chill: 'relax', eco: 'ecológico', rainbow: 'arco-íris', greek: 'grego', hot: 'quente', zen: 'zen', punk: 'punk', grunge: 'grunge',
    public: 'público', royal: 'real', messy: 'bagunçado', rare: 'raro', ultra: 'ultra', occasional: 'de apoio', lost: 'perdido', bad: 'mau', good: 'bom',
    vanilla: 'baunilha', digitized: 'digital', korean: 'coreano', autumn: 'de outono', autumnal: 'de outono', romantique: 'romântico', romantic: 'romântico',
    transparent: 'transparente', teal: 'azul-petróleo', fluffy: 'fofo', organic: 'orgânico', rattan: 'de vime', wicker: 'de vime', splattered: 'respingado',
    'paint-splattered': 'respingado de tinta', stackable: 'empilhável', mayan: 'maia', onyx: 'de ônix', brazilian: 'brasileiro', celestial: 'celestial',
    pro: 'profissional', ancestral: 'ancestral', fabric: 'de tecido', led: 'de LED', carved: 'entalhado', industrial: 'industrial', urban: 'urbano',
    sewing: 'de costura', cosy: 'aconchegante', cozy: 'aconchegante', comfy: 'confortável', traditional: 'tradicional', plain: 'liso', thai: 'tailandês',
    tropical: 'tropical', space: 'espacial', middle: 'do meio', lupine: 'de tremoço', leafy: 'folhado', indian: 'indiano', new: 'novo', miniature: 'em miniatura',
    iridescent: 'furta-cor', interior: 'interno', crystal: 'de cristal', cream: 'creme', growing: 'crescendo', random: 'aleatório', relaxation: 'de relaxar',
    lacquer: 'laqueado', retro: 'retrô', mexican: 'mexicano', mounted: 'de parede', polished: 'polido', four: 'de quatro lugares', one: 'de um lugar',
    glowing: 'brilhante', bright: 'claro', dreamy: 'de sonho', intellectual: 'intelectual', crazy: 'maluco', easy: 'simples', snowy: 'nevado',
    rectangular: 'retangular', dusty: 'empoeirado', covered: 'coberto', outside: 'externo', outdoor: 'externo', indoor: 'interno', decorative: 'decorativo',
    blooming: 'florido', luxury: 'de luxo', luxurious: 'luxuoso', deluxe: 'de luxo', basic: 'básico', simple: 'simples', cobbled: 'de paralelepípedo',
    ultimate: 'supremo', snow: 'de neve', ice: 'de gelo', frozen: 'congelado', japanese: 'japonês', oriental: 'oriental', medieval: 'medieval',
    victorian: 'vitoriano', rustic: 'rústico', vintage: 'antigo', antique: 'antigo', elven: 'élfico', fairy: 'de fada', cute: 'fofo', funky: 'divertido',
    fancy: 'chique', chic: 'chique', posh: 'chique', shiny: 'brilhante', sparkly: 'cintilante', glitter: 'com glitter', neon: 'neon', pastel: 'pastel',
    cyber: 'cibernético', futuristic: 'futurista', steampunk: 'steampunk', pixel: 'pixelado', pixelated: 'pixelado', candy: 'de doce', chocolate: 'de chocolate',
    coffee: 'de centro', tea: 'de chá', bamboo: 'de bambu', stone: 'de pedra', rock: 'de pedra', brick: 'de tijolo', concrete: 'de concreto', paper: 'de papel',
    golden2: 'dourado', bronze: 'de bronze', copper: 'de cobre', iron: 'de ferro', steel: 'de aço', chrome: 'cromado', velvet: 'de veludo', silk: 'de seda',
    wool: 'de lã', cotton: 'de algodão', lace: 'de renda', straw: 'de palha', clay: 'de barro', ceramic: 'de cerâmica', porcelain: 'de porcelana',
    sand: 'de areia', water: 'de água', fire: 'de fogo', lava: 'de lava', sea: 'do mar', ocean: 'do oceano', beach: 'de praia', jungle: 'da selva',
    forest: 'da floresta', garden: 'de jardim', park: 'de parque', city: 'da cidade', country: 'do campo', farm: 'da fazenda', castle: 'do castelo',
    pirate: 'pirata', viking: 'viking', ninja: 'ninja', alien: 'alienígena', robot: 'robô', monster: 'monstro', haunted: 'assombrado', spooky: 'assustador',
    scary: 'assustador', christmas: 'de Natal', xmas: 'de Natal', easter: 'de Páscoa', halloween: 'de Halloween', valentine: 'dos namorados',
    birthday: 'de aniversário', party: 'de festa', summer: 'de verão', winter: 'de inverno', spring: 'de primavera', night: 'noturno', day: 'diurno',
    sun: 'de sol', moon: 'de lua', star: 'de estrela', heart: 'de coração', love: 'do amor', lucky: 'da sorte', happy: 'feliz', sad: 'triste',
    angry: 'bravo', sleepy: 'sonolento', baby: 'de bebê', kids: 'infantil', royal2: 'real', imperial: 'imperial', noble: 'nobre', grand: 'grandioso',
    giant: 'gigante', huge: 'enorme', tiny: 'minúsculo', little: 'pequeno', short: 'curto', wide: 'largo', narrow: 'estreito', thin: 'fino', thick: 'grosso',
    high: 'alto', flat: 'plano', curved: 'curvo', straight: 'reto', diagonal: 'diagonal', corner: 'de canto', angled: 'inclinado', open: 'aberto',
    closed: 'fechado', empty: 'vazio', full: 'cheio', broken: 'quebrado', cracked: 'rachado', worn: 'gasto', clean: 'limpo', dirty: 'sujo', wet: 'molhado',
    dry: 'seco', warm: 'quente', cold: 'frio', cool: 'legal', light: 'claro', heavy: 'pesado', soft: 'macio', hard: 'duro', smooth: 'liso', rough: 'áspero',
    striped: 'listrado', spotted: 'de bolinhas', checkered: 'xadrez', patterned: 'estampado', floral: 'floral', printed: 'estampado', painted: 'pintado',
    tiled: 'de ladrilho', trimmed: 'aparado', framed: 'emoldurado', lit: 'aceso', illuminated: 'iluminado', glow: 'brilhante', shining: 'brilhante',
    spinning: 'giratório', rotating: 'giratório', rolling: 'de rodinhas', moving: 'móvel', flying: 'voador', floating: 'flutuante', standing: 'de pé',
    sitting: 'sentado', sleeping: 'dormindo', dancing: 'dançante', singing: 'cantor', talking: 'falante', musical: 'musical', sound: 'de som',
    video: 'de vídeo', digital: 'digital', electronic: 'eletrônico', mechanical: 'mecânico', automatic: 'automático', wireless: 'sem fio',
    portable: 'portátil', mobile: 'móvel', fixed: 'fixo', permanent: 'permanente', temporary: 'temporário', limited: 'limitado', special: 'especial',
    exclusive: 'exclusivo', official: 'oficial', original: 'original', authentic: 'autêntico', fake: 'falso', real: 'de verdade', secret: 'secreto',
    hidden: 'escondido', mystery: 'misterioso', mysterious: 'misterioso', strange: 'estranho', weird: 'esquisito', funny: 'engraçado', silly: 'bobo',
    tribal: 'tribal', african: 'africano', egyptian: 'egípcio', roman: 'romano', french: 'francês', parisienne: 'parisiense', parisian: 'parisiense',
    italian: 'italiano', spanish: 'espanhol', english: 'inglês', british: 'britânico', american: 'americano', russian: 'russo', arabian: 'árabe',
    arabic: 'árabe', moroccan: 'marroquino', turkish: 'turco', persian: 'persa', venetian: 'veneziano', nordic: 'nórdico', scandinavian: 'escandinavo',
    alpine: 'alpino', arctic: 'ártico', polar: 'polar', desert: 'do deserto', western: 'do faroeste', wild: 'selvagem', safari: 'de safári', hawaiian: 'havaiano',
    caribbean: 'caribenho', mediterranean: 'mediterrâneo', asian: 'asiático', tokyo: 'de Tóquio', miami: 'de Miami', hollywood: 'de Hollywood',
    santorini: 'de Santorini', olympus: 'do Olimpo', sports: 'esportivo', sporty: 'esportivo', gaming: 'gamer', gamer: 'gamer', rock2: 'rock', pop: 'pop',
    jazz: 'jazz', disco: 'de discoteca', techno: 'techno', hip: 'hip', trendy: 'da moda', fashion: 'fashion', designer: 'de grife', boho: 'boho', hippie: 'hippie',
    hipster: 'hipster', industrial2: 'industrial', minimal: 'minimalista', minimalist: 'minimalista', cubic: 'cúbico', geometric: 'geométrico',
    abstract: 'abstrato', cosmic: 'cósmico', galactic: 'galáctico', lunar: 'lunar', solar: 'solar', atomic: 'atômico', nuclear: 'nuclear', toxic: 'tóxico',
    radioactive: 'radioativo', poison: 'venenoso', poisonous: 'venenoso', healthy: 'saudável', fresh: 'fresco', ripe: 'maduro', sweet: 'doce', sour: 'azedo',
    spicy: 'picante', salty: 'salgado', tasty: 'gostoso', delicious: 'delicioso', yummy: 'gostoso', juicy: 'suculento', creamy: 'cremoso', frosted: 'confeitado',
    glazed: 'glaçado', toasted: 'tostado', roasted: 'assado', grilled: 'grelhado', fried: 'frito', baked: 'assado', boiled: 'cozido', mashed: 'amassado',
    whipped: 'batido', melted: 'derretido', crushed: 'triturado', sliced: 'fatiado', chopped: 'picado', bubble: 'de bolhas', bubbly: 'borbulhante',
    sparkling: 'espumante', fizzy: 'gaseificado', cherry: 'de cerejeira', rose: 'rosa', lavender: 'lavanda', lilac: 'lilás', mint: 'menta', lime: 'verde-limão',
    lemon: 'limão', peach: 'pêssego', coral: 'coral', salmon: 'salmão', turquoise: 'turquesa', cyan: 'ciano', navy: 'azul-marinho', indigo: 'anil',
    magenta: 'magenta', crimson: 'carmesim', scarlet: 'escarlate', maroon: 'vinho', burgundy: 'bordô', olive: 'oliva', khaki: 'cáqui', tan: 'castanho',
    ivory: 'marfim', pearl: 'perolado', platinum: 'platina', emerald: 'esmeralda', ruby: 'rubi', sapphire: 'safira', amber: 'âmbar', jade: 'jade',
    obsidian: 'obsidiana', diamond: 'de diamante', ebony: 'ébano', mahogany: 'mogno', oak: 'de carvalho', pine: 'de pinho', birch: 'de bétula',
    cedar: 'de cedro', maple: 'de bordo', walnut: 'de nogueira', teak: 'de teca', colorful: 'colorido', colourful: 'colorido', multicolor: 'colorido',
    multicolored: 'colorido', mixed: 'misto', assorted: 'sortido', various: 'variado', classic2: 'clássico', retro2: 'retrô', modern2: 'moderno',
    contemporary: 'contemporâneo', future: 'do futuro', futurist: 'futurista', historic: 'histórico', historical: 'histórico', prehistoric: 'pré-histórico',
    primitive: 'primitivo', tribal2: 'tribal', cave: 'das cavernas', stoneage: 'da idade da pedra', medieval2: 'medieval', renaissance: 'renascentista',
    baroque: 'barroco', rococo: 'rococó', gothic2: 'gótico', art: 'artístico', artistic: 'artístico', creative: 'criativo', crafting: 'de artesanato',
    handmade: 'artesanal', homemade: 'caseiro', diy: 'faça você mesmo', studio: 'de estúdio', academic: 'acadêmico', scientific: 'científico',
    medical: 'médico', military: 'militar', naval: 'naval', nautical: 'náutico', marine: 'marinho', aquatic: 'aquático', underwater: 'submarino',
    sunken: 'afundado', floating2: 'flutuante', sky: 'do céu', cloud: 'de nuvem', storm: 'de tempestade', thunder: 'de trovão', lightning: 'de raio',
    rain: 'de chuva', windy: 'de vento', foggy: 'enevoado', misty: 'enevoado', starry: 'estrelado', sunny: 'ensolarado', shady: 'sombreado',
    dark2: 'escuro', shadow: 'sombrio', evil: 'maligno', holy: 'sagrado', sacred: 'sagrado', blessed: 'abençoado', cursed: 'amaldiçoado', enchanted: 'encantado',
    legendary: 'lendário', epic: 'épico', heroic: 'heroico', brave: 'corajoso', ice2: 'de gelo', wizard: 'de mago', witch: 'de bruxa', royal3: 'real',
    queen: 'da rainha', king: 'do rei', princess: 'de princesa', prince: 'de príncipe', baby2: 'de bebê', teddy: 'de pelúcia', plush: 'de pelúcia',
    stuffed: 'de pelúcia', toy: 'de brinquedo', play: 'de brincar', game: 'de jogo', games: 'de jogos', arcade: 'de fliperama', retro3: 'retrô',
    cardboard: 'de papelão', recycled: 'reciclado', green2: 'verde', natural: 'natural', wildflower: 'silvestre', mossy: 'musguento', grassy: 'gramado',
    sandy: 'arenoso', rocky: 'rochoso', muddy: 'lamacento', icy: 'gelado', snowy2: 'nevado', burning: 'em chamas', flaming: 'em chamas', fiery: 'flamejante',
    hc: '', habbo: '', habbos: '', hotel: '', ltd: '', ed: '', edition: '', limited2: '',
  };
  // Palavras que somem (avisos do Habbo, ligações do inglês, rótulos de teste). "the", "of" e afins.
  const FORA = new Set(['the', 'of', 'a', 'an', 'and', '&', 'with', 'for', 'on', 'in', 'is', 'it', 'my', 'your', 's', "'s", 'to', 'by', 'at', 'from',
    'non', 'not', 'tradable', 'tradeable', 'non-tradable', 'non-tradeable', 'crackable', 'sale', 'test', 'testing', 'name', 'furni', 'use', 'x', 'version',
    'hc', 'habbo', 'habbos', 'hotel', 'ltd', 'edition', 'mod', 'nft', 'beta', 'alpha', 'new!', 'only', 'this', 'that', 'here', 'me', 'you', 'be']);
  // Aviso entre parênteses: sai inteiro, a não ser que seja cor/material ("(Beige)").
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const femininoDe = (adj) => {
    // "vermelho" → "vermelha", "de madeira" fica; só a última palavra concorda.
    const p = adj.split(' ');
    if (p.length > 1 && p[0] === 'de') return adj; // "de madeira", "de centro"
    const u = p[p.length - 1];
    let f = u;
    if (/o$/.test(u) && !/^(rosa|laranja|cinza|bege|violeta|creme|lilás|vinho|mini|zen|neon|pastel|punk|grunge|pop|boho|hipster|gamer|steampunk|ultra)$/.test(u)) f = u.replace(/o$/, 'a');
    else if (/ês$/.test(u)) f = u.replace(/ês$/, 'esa');
    else if (u === 'mau') f = 'má';
    else if (u === 'bom') f = 'boa';
    p[p.length - 1] = f;
    return p.join(' ');
  };
  const pluralDe = (adj, fem) => {
    const base = fem ? femininoDe(adj) : adj; const p = base.split(' ');
    if (p.length > 1 && p[0] === 'de') return base;
    const u = p[p.length - 1];
    let pl = u;
    if (/[aeiouáéíóú]$/.test(u) && !/^(rosa|laranja|cinza|bege|violeta|creme|vinho|mini|zen|neon|pastel|punk|grunge|pop|boho)$/.test(u)) pl = u + 's';
    else if (/l$/.test(u)) pl = u.replace(/l$/, 'is');
    else if (/[rz]$/.test(u) && u !== 'azul') pl = u + 'es';
    else if (u === 'azul') pl = 'azuis';
    p[p.length - 1] = pl;
    return p.join(' ');
  };
  function separar(nome) {
    // Tira os parênteses e guarda o que tem cor/material dentro deles.
    const extra = [];
    const sem = String(nome || '').replace(/\(([^)]*)\)/g, (_, dentro) => {
      const ws = dentro.split(/[\s,]+/).filter(Boolean);
      if (ws.length && ws.every((w) => A[w.toLowerCase()] !== undefined)) extra.push(...ws);
      return ' ';
    }).replace(/\[[^\]]*\]/g, ' ');
    // Parêntese sem fechar (nome cortado no acervo: "(Non-crackab") sai até o fim; "+", "-" e "/" separam palavras
    // ("White+Pink", "Green-Billed", "Cryo-Bed").
    return [...sem.replace(/\([^)]*$/, ' ').replace(/[!?:;"“”+/]/g, ' ').replace(/(\p{L})-(\p{L})/gu, '$1 $2').split(/\s+/), ...extra].filter(Boolean);
  }
  function nomeEmPortugues(m) {
    m = m || {};
    let nome = String(m.nome || '');
    // Nomes de rascunho do acervo ("… name", prefixo de anúncio) saem do nome.
    nome = nome.replace(/\s+name$/i, '').replace(/^(ads|dtl)[ _]/i, '');
    if (m.categoria === 'Computadores') return nome || String(m.classe || '');
    // Sem nome no catálogo vem a classe ("bling_sofa_mu"): vira palavras.
    if (/_/.test(nome) || !nome) nome = String(nome || m.classe || '').replace(/_?c\d+_/g, ' ').replace(/_/g, ' ');
    // "Santa's" → "Santa"; códigos do acervo ("habbo15", "nokiax3", "r26") saem; "wall1" fica "wall".
    const palavras = separar(nome).map((p) => p.replace(/['’]s$/i, '')).map((p) => { const b = /^([a-z]+)\d+$/i.exec(p)?.[1]?.toLowerCase(); return b && (S[b] || A[b] !== undefined) ? b : p; })
      .filter((p) => !/^[a-z]+\d+[a-z]*$/i.test(p) || /^\d/.test(p));
    // Já em português (acento ou nenhuma palavra do dicionário inglês): só limpa o aviso.
    const ingles = palavras.some((p) => { const k = p.toLowerCase(); return (S[k] && !/[ãçéíóúâêôàõ]/.test(k) && !['mesa', 'cadeira', 'bloco', 'parede', 'caixa', 'porta', 'janela', 'piso', 'cama', 'planta', 'poltrona', 'estante', 'cortina', 'tapete', 'banco', 'vaso'].includes(k)) || (A[k] !== undefined && !/[ãçéíóúâêôàõ]/.test(k)) || FORA.has(k); });
    // Português com palavra emprestada ("Bandeja de cupcakes"): a ligação "de/do/da/com" denuncia.
    const ligacaoPt = palavras.some((p) => /^(de|do|da|dos|das|com|para|no|na|em|e)$/i.test(p)) || (palavras[0] && S[palavras[0].toLowerCase()] && /[ãçéíóúâêôàõ]/i.test(palavras[0]));
    if (!ingles || ligacaoPt) return palavras.join(' ').replace(/\s+/g, ' ').trim() || String(m.classe || '');
    let nucleo = null, generoF = false, plural = false;
    const resto = [];
    const limpas = palavras.map((p) => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter((p) => p && !FORA.has(p.toLowerCase()));
    // O núcleo do inglês é o último substantivo ("Coffee Table" → Mesa); nome que já começa por um
    // substantivo em português ("Bloco blue") fica com ele.
    const ehPt = (k) => /[ãçéíóúâêôàõ]/.test(k) || ['mesa', 'cadeira', 'bloco', 'parede', 'caixa', 'porta', 'janela', 'piso', 'cama', 'planta', 'poltrona', 'estante', 'cortina', 'tapete', 'banco', 'vaso'].includes(k);
    let iNucleo = -1;
    if (limpas.length && S[limpas[0].toLowerCase()] && ehPt(limpas[0].toLowerCase())) iNucleo = 0;
    else for (let i = limpas.length - 1; i >= 0; i--) if (S[limpas[i].toLowerCase()]) { iNucleo = i; break; }
    limpas.forEach((limpa, i) => {
      const k = limpa.toLowerCase();
      if (i === iNucleo) {
        const [t, g] = S[k].split(':');
        nucleo = t; generoF = g === 'a'; plural = /s$/.test(t) && !/(ônibus|lápis|tênis|atlas|lótus|fogos)$/i.test(t);
        return;
      }
      if (A[k] !== undefined) { if (A[k]) resto.push({ t: A[k], adj: !/^(de|do|da|dos|das|no|em) /.test(A[k]) }); return; }
      if (S[k]) { resto.push({ t: 'de ' + S[k].split(':')[0].toLowerCase(), adj: false }); return; }
      // Nome próprio ou palavra sem tradução: fica como está (marca, coleção).
      resto.push({ t: limpa, adj: false, proprio: true });
    });
    if (!nucleo) {
      // Sem substantivo conhecido: o tipo pela categoria ("Cadeiras e sofás" → "Assento").
      const POR_CATEGORIA = { 'Cadeiras e sofás': 'Assento', Mesas: 'Mesa:a', Tapetes: 'Tapete', Luzes: 'Luminária:a', Estantes: 'Estante:a',
        'Divisórias': 'Divisória:a', Jardim: 'Planta:a', Cozinha: 'Peça de cozinha:a', 'Na parede': 'Quadro', 'Música': 'Peça de música:a',
        Jogos: 'Jogo', 'Troféus': 'Troféu', 'Pisos do acervo': 'Piso', 'Blocos e materiais': 'Bloco' };
      const c = POR_CATEGORIA[m.categoria];
      const temProprio = resto.some((r) => r.proprio);
      if (c && !temProprio) { const [t, g] = c.split(':'); nucleo = t; generoF = g === 'a'; }
    }
    // Ordem do português: núcleo, nomes próprios e complementos ("Sofá Bling azul").
    const vistos = new Set();
    const fim = [];
    const proprios = resto.filter((r) => r.proprio).map((r) => r.t);
    // Complementos com "de" logo depois do núcleo ("Mesa de centro escura"), adjetivos em seguida.
    const outros = [...resto.filter((r) => !r.proprio && !r.adj), ...resto.filter((r) => !r.proprio && r.adj)];
    for (const r of [...outros.filter((r) => !r.adj), ...proprios.map((t) => ({ t, adj: false })), ...outros.filter((r) => r.adj)]) {
      const t = r.adj ? (plural ? pluralDe(r.t, generoF) : (generoF ? femininoDe(r.t) : r.t)) : r.t;
      const chave = semAcento(t).toLowerCase();
      if (vistos.has(chave) || chave === semAcento(nucleo || '').toLowerCase()) continue;
      vistos.add(chave); fim.push(t);
    }
    const saida = [nucleo, ...fim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!saida) return String(m.nome || m.classe || '');
    return saida.charAt(0).toUpperCase() + saida.slice(1);
  }
  const api = { nomeEmPortugues, SUBSTANTIVOS: S, ADJETIVOS: A, FORA };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.VybeNomeMovel = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
