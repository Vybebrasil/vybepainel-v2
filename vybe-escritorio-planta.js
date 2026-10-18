// Planta do escritório (4ª versão, 17 de outubro de 2026, decisão do Paulo):
// não há mais mapa geral. Cada lugar é uma cena própria, como os quartos do
// Habbo, e se vai de um para outro pela lista de salas. As salas da equipe
// (sala-0 … sala-8) são os quartos de cada um; os espaços comuns (Convivência,
// Reunião, Auditório, Produção, Café, Jogos, Foco, Academia, Lounge) são
// cenas montadas aqui; a Praça (área de fora) é a cena de abertura, a que o
// editor do administrador chama de "geral". Quem sai de uma sala pela porta
// chega na Convivência; da Convivência a porta leva à Praça e volta.
// Unidade: ladrilho do Habbo (64×32 px). x desce para a direita na tela, y
// desce para a esquerda. Direções do Habbo: 0 olha para −y, 2 para +x,
// 4 para +y, 6 para −x; medidas valem em 0/4 e giram em 2/6.
// Item de parede (janela, quadro, luminária): [classe, x, y, 2|4, estado,
// altura]; 4 pendura na parede de fundo do ladrilho (y), 2 na da esquerda (x).
// Cada ambiente pertence a uma sala de conversa do servidor (os ids são os
// que o Worker aceita). Quem é dono de cada sala vem do servidor.
const ESCRITORIO_SALA_LADO = 8;
// Cenas montadas pelo motor de construção (scripts/cenas/<id>.mjs): cada
// peça conferida com a ficha e a arte do Habbo antes de entrar aqui.
// <cenas-compostas> (gerado por scripts/escritorio-compor.mjs; não edite à mão)
const ESCRITORIO_CENAS_COMPOSTAS = {
  cafe: {
    moveis: [
      ["xmas_c16_woodtile",0,0,0,0,7.6],
      ["xmas_c16_woodtile",1,0,0,0,7.6],
      ["xmas_c16_woodtile",2,0,0,0,7.6],
      ["xmas_c16_woodtile",3,0,0,0,7.6],
      ["xmas_c16_woodtile",4,0,0,0,7.6],
      ["xmas_c16_woodtile",5,0,0,0,7.6],
      ["xmas_c16_woodtile",6,0,0,0,7.6],
      ["xmas_c16_woodtile",7,0,0,0,7.6],
      ["xmas_c16_woodtile",8,0,0,0,7.6],
      ["xmas_c16_woodtile",9,0,0,0,7.6],
      ["xmas_c16_woodtile",10,0,0,0,7.6],
      ["xmas_c16_woodtile",11,0,0,0,7.6],
      ["xmas_c16_woodtile",12,0,0,0,7.6],
      ["xmas_c16_woodtile",13,0,0,0,7.6],
      ["xmas_c16_woodtile",14,0,0,0,7.6],
      ["xmas_c16_woodtile",15,0,0,0,7.6],
      ["xmas_c16_woodtile",0,0,0,0,7.6],
      ["xmas_c16_woodtile",0,1,0,0,7.6],
      ["xmas_c16_woodtile",0,2,0,0,7.6],
      ["xmas_c16_woodtile",0,3,0,0,7.6],
      ["xmas_c16_woodtile",0,4,0,0,7.6],
      ["xmas_c16_woodtile",0,5,0,0,7.6],
      ["xmas_c16_woodtile",0,6,0,0,7.6],
      ["xmas_c16_woodtile",0,7,0,0,7.6],
      ["xmas_c16_woodtile",0,8,0,0,7.6],
      ["xmas_c16_woodtile",0,9,0,0,7.6],
      ["xmas_c16_woodtile",0,10,0,0,7.6],
      ["xmas_c16_woodtile",0,11,0,0,7.6],
      ["xmas_c22_woodenfloor",0,0,0,0,0],
      ["xmas_c22_woodenfloor",0,2,0,0,0],
      ["xmas_c22_woodenfloor",2,0,0,0,0],
      ["xmas_c22_woodenfloor",2,2,0,0,0],
      ["xmas_c22_woodenfloor",4,0,0,0,0],
      ["xmas_c22_woodenfloor",4,2,0,0,0],
      ["xmas_c22_woodenfloor",6,0,0,0,0],
      ["xmas_c22_woodenfloor",6,2,0,0,0],
      ["xmas_c22_woodenfloor",8,0,0,0,0],
      ["xmas_c22_woodenfloor",8,2,0,0,0],
      ["xmas_c22_woodenfloor",10,0,0,0,0],
      ["xmas_c22_woodenfloor",10,2,0,0,0],
      ["xmas_c22_woodenfloor",12,0,0,0,0],
      ["xmas_c22_woodenfloor",12,2,0,0,0],
      ["rainyday_c20_woodenfloor",0,4,0,1,0],
      ["rainyday_c20_woodenfloor",2,4,0,1,0],
      ["rainyday_c20_woodenfloor",4,4,0,1,0],
      ["rainyday_c20_woodenfloor",6,4,0,1,0],
      ["rainyday_c20_woodenfloor",8,4,0,1,0],
      ["rainyday_c20_woodenfloor",10,4,0,1,0],
      ["rainyday_c20_woodenfloor",14,0,0,1,0],
      ["rainyday_c20_woodenfloor",14,2,0,1,0],
      ["xmas_c22_woodenfloor",12,4,0,0,0],
      ["xmas_c22_woodenfloor",14,4,0,0,0],
      ["xmas_c22_woodenfloor",0,6,0,0,0],
      ["xmas_c22_woodenfloor",0,8,0,0,0],
      ["xmas_c22_woodenfloor",0,10,0,0,0],
      ["xmas_c22_woodenfloor",2,6,0,0,0],
      ["xmas_c22_woodenfloor",2,8,0,0,0],
      ["xmas_c22_woodenfloor",2,10,0,0,0],
      ["xmas_c22_woodenfloor",4,6,0,0,0],
      ["xmas_c22_woodenfloor",4,8,0,0,0],
      ["xmas_c22_woodenfloor",4,10,0,0,0],
      ["xmas_c22_woodenfloor",6,6,0,0,0],
      ["xmas_c22_woodenfloor",6,8,0,0,0],
      ["xmas_c22_woodenfloor",6,10,0,0,0],
      ["xmas_c22_woodenfloor",8,6,0,0,0],
      ["xmas_c22_woodenfloor",8,8,0,0,0],
      ["xmas_c22_woodenfloor",8,10,0,0,0],
      ["xmas_c22_woodenfloor",10,6,0,0,0],
      ["xmas_c22_woodenfloor",10,8,0,0,0],
      ["xmas_c22_woodenfloor",10,10,0,0,0],
      ["xmas_c22_woodenfloor",12,6,0,0,0],
      ["xmas_c22_woodenfloor",12,8,0,0,0],
      ["xmas_c22_woodenfloor",12,10,0,0,0],
      ["xmas_c22_woodenfloor",14,6,0,0,0],
      ["xmas_c22_woodenfloor",14,8,0,0,0],
      ["xmas_c22_woodenfloor",14,10,0,0,0],
      ["wildwest_wallpaper",0,4,2,1,0],
      ["wildwest_wallpaper",0,6,2,1,0],
      ["wildwest_wallpaper",0,8,2,1,0],
      ["wildwest_wallpaper",0,10,2,1,0],
      ["wildwest_wallpaper",14,0,4,1,0],
      ["hween_c26_wornfloorboards",0,0,0,0,3.125],
      ["hween_c26_wornfloorboards",0,2,0,0,3.125],
      ["hween_c26_wornfloorboards",2,0,0,0,3.125],
      ["hween_c26_wornfloorboards",2,2,0,0,3.125],
      ["hween_c26_wornfloorboards",4,0,0,0,3.125],
      ["hween_c26_wornfloorboards",4,2,0,0,3.125],
      ["hween_c26_wornfloorboards",6,0,0,0,3.125],
      ["hween_c26_wornfloorboards",6,2,0,0,3.125],
      ["hween_c26_wornfloorboards",8,0,0,0,3.125],
      ["hween_c26_wornfloorboards",8,2,0,0,3.125],
      ["hween_c26_wornfloorboards",10,0,0,0,3.125],
      ["hween_c26_wornfloorboards",10,2,0,0,3.125],
      ["hween_c26_wornfloorboards",12,0,0,0,3.125],
      ["hween_c26_wornfloorboards",12,2,0,0,3.125],
      ["lodge_dark_divider",0,3,0,0,3.175],
      ["lodge_dark_divider",2,3,0,0,3.175],
      ["lodge_dark_divider",4,3,0,0,3.175],
      ["lodge_dark_divider",6,3,0,0,3.175],
      ["lodge_dark_divider",8,3,0,0,3.175],
      ["lodge_dark_divider",10,3,0,0,3.175],
      ["lodge_dark_divider",12,3,0,0,3.175],
      ["lodge_dark_divider",13,0,6,0,3.175],
      ["lodge_dark_cornerplinth",13,2,0,0,3.175],
      ["lodge_dark_cornerplinth",5,3,0,0,0],
      ["lodge_dark_cornerplinth",5,3,0,0,1],
      ["lodge_dark_cornerplinth",5,3,0,0,2],
      ["lodge_dark_cornerplinth",9,3,0,0,0],
      ["lodge_dark_cornerplinth",9,3,0,0,1],
      ["lodge_dark_cornerplinth",9,3,0,0,2],
      ["lodge_dark_cornerplinth",13,3,0,0,0],
      ["lodge_dark_cornerplinth",13,3,0,0,1],
      ["lodge_dark_cornerplinth",13,3,0,0,2],
      ["hween_c25_weed2",13,4,0,0,0],
      ["hygge_c25_wallpaper1",0,0,4,4,3.175],
      ["hygge_c25_wallpaper1",2,0,4,4,3.175],
      ["hygge_c25_wallpaper1",4,0,4,4,3.175],
      ["hygge_c25_wallpaper1",6,0,4,4,3.175],
      ["hygge_c25_wallpaper1",8,0,4,4,3.175],
      ["hygge_c25_wallpaper1",10,0,4,4,3.175],
      ["hygge_c25_wallpaper1",12,0,4,4,3.175],
      ["hygge_c25_wallpaper1",0,0,2,4,3.175],
      ["hygge_c25_wallpaper1",0,2,2,4,3.175],
      ["hween_c26_bookshelf",0,0,0,0,3.175],
      ["mafia_c26_sidetable_dark",2,1,0,0,3.175],
      ["antique_c21_teaset",2,1,0,0,4.167],
      ["antique_c21_armchair",1,1,2,0,3.175],
      ["antique_c21_armchair",3,1,6,0,3.175],
      ["antique_c21_lamp",2,0,0,0,3.175],
      ["paris_c15_table",6,1,0,0,3.175],
      ["xmas_c24_plate",6,1,0,0,4.125],
      ["val_c20_cake",6,1,0,0,4.225],
      ["paris_c15_chair",5,1,2,0,3.175],
      ["paris_c15_chair",7,1,6,0,3.175],
      ["rainyday_c20_woodentable",10,1,0,0,3.175],
      ["antique_c21_books",10,1,0,0,4.175],
      ["classic9_chair",9,1,2,0,3.175],
      ["classic9_chair",11,1,6,0,3.175],
      ["classic9_plant",12,2,0,0,3.175],
      ["antique_c21_doorteleport",0,2,2,0,3.175],
      ["lodge_dark_window",3.5625,0,4,0,3.46875],
      ["attic15_painting",6.5625,0,4,0,3.46875],
      ["lodge_dark_window",9.28125,0,4,0,3.46875],
      ["easter_c18_hangingplant",3,4,0,0,0],
      ["easter_c18_hangingplant",12,4,0,0,0],
      ["val_c20_cakedisplay",1,3,4,0,0],
      ["val_c20_tablecounter",7,3,0,0,0],
      ["sunsetcafe_c20_coffeemachine",7,3,0,0,1.5],
      ["ducket_c26_honeypot",8,3,0,0,1.5],
      ["val_c20_tablecounter",11,3,0,0,0],
      ["ducket_c26_charcuterie",11,3,0,0,1.5],
      ["val_c20_tablecounter",1,5,0,0,0],
      ["val_c20_tablecounter",3,5,0,0,0],
      ["val_c20_tablecounter",5,5,0,0,0],
      ["val_c20_tablecounter",7,5,0,0,0],
      ["wildwest_till",1,5,4,0,1.5],
      ["ktchn_c15_bread",3,5,4,0,1.5],
      ["xmas_c23_choccake",4,5,0,0,1.5],
      ["gift_c18_cookiejar",5,5,0,0,1.5],
      ["xmas_c24_mugs",6,5,0,0,1.5],
      ["dessertcafe_c17_creamrolls",7,5,0,0,1.5],
      ["xmas_c24_snacks1",8,5,0,0,1.5],
      ["dessertcafe_c17_teaplant",2,5,0,0,1.5],
      ["lodge_dark_barrelstool",5,6,0,0,0],
      ["lodge_dark_barrelstool",7,6,0,0,0],
      ["xmas12_barrel",11,5,4,0,0],
      ["jungle_c16_sacks",12,5,0,0,0],
      ["school_chalkboard",0,5.5,2,0,1.59375],
      ["waasa_wall_shelf1",0,9.53125,2,0,2.59375],
      ["antique_c21_pennyfarthing",0,8,2,0,0],
      ["antique_c21_doorteleport",0,9,2,0,0],
      ["doormat_plain",1,9,0,0,0],
      ["attic15_clock",0,11,2,0,0],
      ["paris_c15_menu",2,11,2,0,0],
      ["antique_c21_oldenrug",2,7,2,0,0],
      ["paris_c15_table",3,7,0,0,0],
      ["xmas_c24_plate",3,7,0,0,0.95],
      ["classic2_drinkcup",3,7,0,0,1.05],
      ["paris_c15_chair",2,7,2,0,0],
      ["paris_c15_chair",4,7,6,0,0],
      ["paris_c15_chair",3,8,0,0,0],
      ["antique_c21_oldenrug",7,9,2,0,0],
      ["rainyday_c20_woodentable",8,9,0,0,0],
      ["gift_vase",8,9,0,0,1],
      ["classic9_chair",7,9,2,0,0],
      ["classic9_chair",9,9,6,0,0],
      ["classic9_chair",8,10,0,0,0],
      ["antique_c21_oldenrug",10,7,2,0,0],
      ["paris_c15_table",11,7,0,0,0],
      ["rcandle",11,7,0,0,0.95],
      ["steampunk_chair",10,7,2,0,0],
      ["steampunk_chair",12,7,6,0,0],
      ["steampunk_chair",11,8,0,0,0],
      ["val_c20_lights",8,9,0,1,0],
      ["val_c20_lights",13,11,0,1,0],
      ["antique_c21_oldenrug",12,10,2,0,0],
      ["mafia_c26_coffeetable_dark",13,10,0,0,0],
      ["antique_c21_teaset",13,10,0,0,0.837],
      ["antique_c21_armchair",12,10,2,0,0],
      ["wintercabin_c19_cabinchair",14,10,6,0,0],
      ["antique_c21_lamp",15,10,0,0,0],
      ["recycler_baskettree",15,7,0,0,0],
      ["classic9_plant",9,5,0,0,0],
      ["wintercabin_c19_fireplace",14,0,4,0,0],
      ["antique_c21_oldenrug",14,1,0,0,0],
      ["antique_c21_armchair",14,2,0,0,0],
      ["wintercabin_c19_cabinchair",15,2,0,0,0],
      ["lodge_dark_lamp",14,5,0,0,0],
      ["wintercabin_c19_antlerlight",15,2,0,1,0],
    ],
    figurantes: [{"figura":"hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62","x":1,"y":1,"dir":2,"acao":"sit"},{"figura":"hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110","x":7,"y":1,"dir":6,"acao":"sit"},{"figura":"hr-515-45.hd-600-1.ch-635-1408.lg-695-1408.sh-725-62","x":5,"y":4,"dir":4},{"figura":"hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62","x":10,"y":4,"dir":4},{"figura":"hd-180-1.hr-828-61.ch-210-66.lg-280-110.sh-305-110","x":7,"y":6,"dir":0,"acao":"sit"},{"figura":"hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62","x":2,"y":7,"dir":2,"acao":"sit"},{"figura":"hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110","x":12,"y":7,"dir":6,"acao":"sit"},{"figura":"hr-828-61.hd-180-2.ch-210-1408.lg-270-110.sh-290-62","x":9,"y":6,"dir":2}],
  },
  recepcao: {
    moveis: [
      ["val12_marble1",0,0,0,0,0],
      ["val12_marble1",0,2,0,0,0],
      ["val12_marble1",0,4,0,0,0],
      ["val12_marble1",0,6,0,0,0],
      ["val12_marble1",0,8,0,0,0],
      ["val12_marble1",0,10,0,0,0],
      ["val12_marble1",0,12,0,0,0],
      ["val12_marble1",0,14,0,0,0],
      ["val12_marble1",0,16,0,0,0],
      ["val12_marble1",2,0,0,0,0],
      ["val12_marble1",2,2,0,0,0],
      ["val12_marble1",2,4,0,0,0],
      ["val12_marble1",2,6,0,0,0],
      ["val12_marble1",2,8,0,0,0],
      ["val12_marble1",2,10,0,0,0],
      ["val12_marble1",2,12,0,0,0],
      ["val12_marble1",2,14,0,0,0],
      ["val12_marble1",2,16,0,0,0],
      ["val12_marble1",4,0,0,0,0],
      ["val12_marble1",4,2,0,0,0],
      ["val12_marble1",4,4,0,0,0],
      ["val12_marble1",4,6,0,0,0],
      ["val12_marble1",4,8,0,0,0],
      ["val12_marble1",4,10,0,0,0],
      ["val12_marble1",4,12,0,0,0],
      ["val12_marble1",4,14,0,0,0],
      ["val12_marble1",4,16,0,0,0],
      ["val12_marble1",6,0,0,0,0],
      ["val12_marble1",6,2,0,0,0],
      ["val12_marble1",6,4,0,0,0],
      ["val12_marble1",6,6,0,0,0],
      ["val12_marble1",6,8,0,0,0],
      ["val12_marble1",6,10,0,0,0],
      ["val12_marble1",6,12,0,0,0],
      ["val12_marble1",6,14,0,0,0],
      ["val12_marble1",6,16,0,0,0],
      ["val12_marble1",8,0,0,0,0],
      ["val12_marble1",8,2,0,0,0],
      ["val12_marble1",8,4,0,0,0],
      ["val12_marble1",8,6,0,0,0],
      ["val12_marble1",8,8,0,0,0],
      ["val12_marble1",8,10,0,0,0],
      ["val12_marble1",8,12,0,0,0],
      ["val12_marble1",8,14,0,0,0],
      ["val12_marble1",8,16,0,0,0],
      ["val12_marble1",10,0,0,0,0],
      ["val12_marble1",10,2,0,0,0],
      ["val12_marble1",10,4,0,0,0],
      ["val12_marble1",10,6,0,0,0],
      ["val12_marble1",10,8,0,0,0],
      ["val12_marble1",10,10,0,0,0],
      ["val12_marble1",10,12,0,0,0],
      ["val12_marble1",10,14,0,0,0],
      ["val12_marble1",10,16,0,0,0],
      ["val12_marble1",12,0,0,0,0],
      ["val12_marble1",12,2,0,0,0],
      ["val12_marble1",12,4,0,0,0],
      ["val12_marble1",12,6,0,0,0],
      ["val12_marble1",12,8,0,0,0],
      ["val12_marble1",12,10,0,0,0],
      ["val12_marble1",12,12,0,0,0],
      ["val12_marble1",12,14,0,0,0],
      ["val12_marble1",12,16,0,0,0],
      ["val12_marble1",14,0,0,0,0],
      ["val12_marble1",14,2,0,0,0],
      ["val12_marble1",14,4,0,0,0],
      ["val12_marble1",14,6,0,0,0],
      ["val12_marble1",14,8,0,0,0],
      ["val12_marble1",14,10,0,0,0],
      ["val12_marble1",14,12,0,0,0],
      ["val12_marble1",14,14,0,0,0],
      ["val12_marble1",14,16,0,0,0],
      ["val12_marble1",16,0,0,0,0],
      ["val12_marble1",16,2,0,0,0],
      ["val12_marble1",16,4,0,0,0],
      ["val12_marble1",16,6,0,0,0],
      ["val12_marble1",16,8,0,0,0],
      ["val12_marble1",16,10,0,0,0],
      ["val12_marble1",16,12,0,0,0],
      ["val12_marble1",18,0,0,0,0],
      ["val12_marble1",18,2,0,0,0],
      ["val12_marble1",18,4,0,0,0],
      ["val12_marble1",18,6,0,0,0],
      ["val12_marble1",18,8,0,0,0],
      ["val12_marble1",18,10,0,0,0],
      ["val12_marble1",18,12,0,0,0],
      ["val12_marble1",16,14,0,0,0],
      ["val12_marble1",0,0,0,0,3],
      ["val12_marble1",0,2,0,0,3],
      ["val12_marble1",0,4,0,0,3],
      ["val12_marble1",0,6,0,0,3],
      ["val12_marble1",2,0,0,0,3],
      ["val12_marble1",2,2,0,0,3],
      ["val12_marble1",2,4,0,0,3],
      ["val12_marble1",2,6,0,0,3],
      ["val12_marble1",4,0,0,0,3],
      ["val12_marble1",4,2,0,0,3],
      ["val12_marble1",4,4,0,0,3],
      ["val12_marble1",4,6,0,0,3],
      ["val12_marble1",6,0,0,0,3],
      ["val12_marble1",6,2,0,0,3],
      ["val12_marble1",6,4,0,0,3],
      ["val12_marble1",6,6,0,0,3],
      ["val12_marble1",8,0,0,0,3],
      ["val12_marble1",8,2,0,0,3],
      ["val12_marble1",8,4,0,0,3],
      ["val12_marble1",8,6,0,0,3],
      ["val12_marble1",10,0,0,0,3],
      ["val12_marble1",10,2,0,0,3],
      ["val12_marble1",10,4,0,0,3],
      ["val12_marble1",10,6,0,0,3],
      ["val12_marble1",12,0,0,0,3],
      ["val12_marble1",12,2,0,0,3],
      ["val12_marble1",12,4,0,0,3],
      ["val12_marble1",12,6,0,0,3],
      ["val12_marble1",14,0,0,0,3],
      ["val12_marble1",14,2,0,0,3],
      ["val12_marble1",14,4,0,0,3],
      ["val12_marble1",14,6,0,0,3],
      ["greek_block",0,6,0,0,3],
      ["greek_block",2,6,0,0,3],
      ["greek_block",4,6,0,0,3],
      ["greek_block",6,6,0,0,3],
      ["greek_block",8,6,0,0,3],
      ["greek_block",10,6,0,0,3],
      ["greek_block",12,6,0,0,3],
      ["greek_block",14,6,0,0,3],
      ["greek_block",15,0,6,0,3],
      ["greek_block",15,2,6,0,3],
      ["greek_block",15,4,6,0,3],
      ["greek_corner",2,6,0,0,0],
      ["greek_corner",6,6,0,0,0],
      ["greek_corner",12,6,0,0,0],
      ["greek_corner",14,6,0,0,0],
      ["hween_c26_bookshelf",0,0,2,0,3],
      ["hween_c26_bookshelf",0,2,0,0,3],
      ["mafia_c26_sidetable_white",2,2,0,0,3],
      ["mafia_c26_vase_white",2,2,0,0,3.992],
      ["mafia_c26_armchair_white",2,3,0,0,3],
      ["mafia_c26_armchair_white",3,2,6,0,3],
      ["mafia_c26_sidetable_white",6,2,0,0,3],
      ["magazines",6,2,0,0,3.992],
      ["mafia_c26_armchair_white",5,2,2,0,3],
      ["mafia_c26_armchair_white",7,2,6,0,3],
      ["mafia_c26_sidetable_white",10,2,0,0,3],
      ["mafia_c26_vase_white",10,2,0,0,3.992],
      ["mafia_c26_armchair_white",9,2,2,0,3],
      ["mafia_c26_armchair_white",11,2,6,0,3],
      ["mafia_c26_sofa_white",11,0,4,0,3],
      ["mafia_c26_coffeetable_white",12,2,0,0,3],
      ["mafia_c26_teleport_white",14,0,4,0,3],
      ["mafia_c26_planter_white",14,3,0,0,3],
      ["mafia_c26_window_white",5.46875,0,4,0,3.5],
      ["mafia_c26_window_white",8.53125,0,4,0,3.5],
      ["js_exe_bardesk",7,5,2,0,0],
      ["js_exe_bardesk",8,5,2,0,0],
      ["js_exe_bardesk",9,5,2,0,0],
      ["computer_flatscreen",7,5,0,0,0.9],
      ["exe_c15_telephone",9,5,0,0,0.9],
      ["matic_water_dispenser",16,0,4,0,0],
      ["olympics_r16_vendingmchn",17,0,4,0,0],
      ["mafia_c26_teleport_dark",18,0,4,0,0],
      ["mafia_c26_teleport_white",19,0,4,0,0],
      ["bohogarden_c21_fanpalm",16,3,0,0,0],
      ["js_exe_rug",1,9,0,0,0],
      ["mafia_c26_sofa_white",0,9,2,0,0],
      ["mafia_c26_coffeetable_white",2,9,0,0,0],
      ["magazines",2,9,0,0,0.837],
      ["mafia_c26_armchair_white",4,9,6,0,0],
      ["mafia_c26_armchair_white",4,10,6,0,0],
      ["waasa_aquarium",0,7,2,0,0],
      ["waasa_aquarium",0,13,2,0,0],
      ["mafia_c26_walllamp_white",0,12.625,2,0,1.8125],
      ["mafia_c26_walllamp_white",0,9.40625,2,0,1.8125],
      ["mafia_c26_planter_white",0,16,0,0,0],
      ["modern_c17_floorlamp",5,9,0,0,0],
      ["india_c20_palmvase",5,12,0,0,0],
      ["room_wl15_tree",9,10,0,0,0],
      ["room_wl15_tree",10,11,0,0,0],
      ["room_info15_shrub2",9,12,0,0,0],
      ["room_info15_shrub1",11,10,0,0,0],
      ["greek_c15_bench",9,14,0,0,0],
      ["greek_c15_bench",6,10,2,0,0],
      ["greek_c15_bench",13,9,6,0,0],
      ["tokyo_c18_retroarcade",16,7,4,0,0],
      ["tokyo_c18_retroarcade",18,7,4,0,0],
      ["bling15_pooltable",15,11,4,0,0],
      ["tokyo_c18_racearcade",18,10,6,0,0],
      ["darkelegant_c20_carpet",14,13,0,0,0],
      ["mafia_c26_sofa_white",14,13,4,0,0],
      ["mafia_c26_coffeetable_white",15,14,2,0,0],
      ["modern_c17_floorlamp",17,14,0,0,0],
      ["india_c20_palmvase",13,15,0,0,0],
      ["usva_rug",2,14,0,0,0],
      ["mafia_c26_sidetable_white",3,15,0,0,0],
      ["magazines",3,15,0,0,0.992],
      ["mafia_c26_armchair_white",2,15,2,0,0],
      ["mafia_c26_armchair_white",3,14,4,0,0],
      ["exe_globe",1,12,0,0,0],
      ["hc_luggage",5,14,0,0,0],
      ["doormat_plain",9,16,0,0,0],
      ["doormat_plain",10,16,0,0,0],
      ["mafia_c26_planter_white",7,16,0,0,0],
      ["mafia_c26_planter_white",12,16,0,0,0],
    ],
    figurantes: [{"figura":"hr-170-45.hd-190-2.ch-215-66.lg-280-110.sh-305-62.ea-1406-62","x":2,"y":3,"dir":0,"acao":"sit"},{"figura":"hr-890-45.hd-605-2.ch-3030-73.lg-3116-1408.sh-735-62","x":5,"y":2,"dir":2,"acao":"sit"},{"figura":"hd-600-1.hr-515-61.ch-665-1323.lg-700-110.sh-725-110","x":8,"y":4,"dir":4},{"figura":"hd-180-1.hr-828-61.ch-255-1323.lg-280-110.sh-305-110","x":4,"y":9,"dir":6,"acao":"sit"},{"figura":"hr-3163-45.hd-180-1.ch-3030-1408.lg-275-1408.sh-290-62","x":17,"y":8,"dir":0}],
  },
};
// </cenas-compostas>
// Altura real do tampo (em ladrilhos de altura, 32 px), medida no desenho
// de cada móvel. A altura que vem na ficha do Habbo erra em vários (balcão,
// mesa da recepção): o que ia em cima afundava ou flutuava. O editor e o
// verificador usam esta tabela; o que não está nela usa a da ficha.
const ESCRITORIO_TAMPOS = {
  exe_table: 0.95, hc25_12: 1.25, hc_exe_table: 1.1, classic9_table: 0.7, army_c15_contable: 1.05, army_c15_contable2: 1.05,
  darkmodern_c20_lowtable: 0.95, modern_c17_lowtable: 0.95, hygge_c25_counter1: 1.25, lodge_dark_desk: 1.25,
  js_exe_bardesk: 0.9, hc26_3: 0.25, hygge_c25_coffeetable: 0.55, gaming_c18_rigpro: 1.15, vwave_c21_bartable: 1,
  cubie_shelf_2_p: 1.05, hygge_c18_shelf: 1.2, modern_c17_endtable: 1.3, purablk_c16_shelve: 1, jp_drawer: 1,
};
// Estado em que cada móvel se mexe (tela ligada, fogo aceso, fliperama
// rodando, água correndo). Na arte do Habbo isso muda de um móvel para outro:
// no estado errado ele fica parado. Vale para a planta e para as salas.
const ESCRITORIO_ESTADO_ANIMADO = {
  computer_flatscreen: 2, studio_floorlight: 4, spotlight: 5, studio_camera: 2, hc_exe_wrkdesk: 1, exe_c15_printer: 1,
  cine_screen: 2, cine_light1: 100, army15_largescreen: 0, hygge_c25_kitchensink: 1, tokyo_c18_retroarcade: 0,
  arcade_c23_space: 0, arcade_c23_pinball: 0, arcade_c23_cyberpunk: 0, bling15_pooltable: 1, olympics_c16_treadmill: 1,
  olympics_c16_trampoline: 1, disco_c26_floor: 0, exe_globe: 1, waasa_aquarium: 0, bazaar_r17_fountain: 1,
  zengarden_r18_fountain: 1, tokyo_c18_neonsign1: 1, tokyo_c18_neonsign2: 1, classic8_disco: 0, cine_popcorn: 0,
  bohogarden_c21_fireheater: 0, garden_birdbath: 1, lc_medusa1: 3, olympics_r16_vendingmchn: 1,
  birds_r18_cardinal: 1, ktchn10_tea: 1, fxbox_fx16: 1, hygge_r25_toastcat: 1, garden_flolamp: 1, tiki_torch: 1,
  lodge_dark_candle: 1, disco_c26_discoball: 1, arcade_c23_vrmachine: 1, matic_tree_blue: 1, attic15_clock: 0,
  jungle_c16_light: 0, army_c15_deskcomp: 1, celestial_c21_lamp: 1, hotel_c18_fountain: 0, garden_r21_plantwall: 1,
  modern_c17_iscreen: 1, art_c20_drawingtablet: 2, lodge_dark_tv: 1, darkmodern_c20_floorlight: 7, hc_radio: 1,
  sunsetcafe_c20_coffeemachine: 1, vwave_r21_jukebox: 1, rainyday_c20_retrogames: 1, disco_c26_jukebox: 1,
  graffiti_r24_arcademachine: 1, matic_water_dispenser: 1, darkmodern_c20_pug: 1, exe_c15_telephone: 1,
};
// Quando esta planta entrou no ar: o mapa geral salvo antes disso é da planta
// anterior e não vale mais (as salas individuais continuam, são relativas).
const ESCRITORIO_PLANTA_DESDE = "2026-10-17T12:30:00Z";
// A reorganização comum não invalida as coordenadas locais dos quartos.
// 17/10/2026, noite: o mapa geral deu lugar à Praça (cena de abertura, a
// camada "geral" do editor); o que foi salvo antes disso não vale mais.
const ESCRITORIO_GERAL_DESDE = "2026-10-17T23:52:04Z";
const ESCRITORIO_PLANTA = (() => {
  // W × H é só a escala da presença (porcentagem ↔ ladrilho), a mesma do
  // mapa antigo: as coordenadas de cada cena são locais e cabem nela.
  const W = 80, H = 80, L = ESCRITORIO_SALA_LADO;
  const PISO = {
    madeira: ["#6b4a33", "#62432e"], clara: ["#9c7550", "#916b48"], concreto: ["#3d3f46", "#383a40"],
    carpete: ["#2c3444", "#27303e"], preto: ["#1b1b20", "#17171b"], cafe: ["#c9c4bd", "#bdb8b1"],
    verde: ["#23493a", "#1f4134"], corredor: ["#5c5d66", "#56575f"], academia: ["#222227", "#1e1e22"],
    grama: ["#3f7d3a", "#3a7335"], deck: ["#8a5f3c", "#7f5736"], praca: ["#2a2930", "#26252b"],
    // Pisos das salas individuais (madeiras e tons próximos, cada um diferente).
    sala0: ["#7a4f3a", "#704836"], sala1: ["#5e4636", "#564031"], sala2: ["#3f4a5c", "#394354"], sala3: ["#6b5a3e", "#625238"],
    sala4: ["#6a4555", "#613f4e"], sala5: ["#4a5a48", "#435242"], sala6: ["#5a4a6a", "#524361"], sala7: ["#7a5a3a", "#705235"],
    sala8: ["#45545e", "#3f4d56"],
    // Espaços do Lounge, cada um com o seu piso.
    lareira: ["#4f3626", "#472f21"], cinema: ["#262a3c", "#222536"], pista: ["#2c2338", "#271f32"], bar: ["#3d2b22", "#36261e"],
    // Mais pisos para pintar as salas.
    marmore: ["#d9d6d0", "#cfccc5"], gramado: ["#4f8a43", "#467d3c"], nogueira: ["#3e2a1e", "#36241a"], vinho: ["#5a2230", "#4f1d2a"],
    patio: ["#cfc9bf", "#c5bfb5"],
  };
  // Cor da parede alta de cada sala.
  const CORES_SALAS = ["#ff8a35", "#ffb347", "#ffd166", "#5aa9ff", "#ff6fa8", "#7ee08a", "#b48cff", "#5ad1e6", "#e8a87c"];
  const ambientes = [];
  // Salas individuais, na ordem do servidor (sala-0 … sala-8): o quarto de
  // cada um, em coordenadas locais (0 … L). "porta": de que lado fica o vão
  // (embaixo ou à direita); "alta": as paredes altas do fundo.
  const PORTA_SALAS = ["baixo", "baixo", "baixo", "baixo", "baixo", "baixo", "direita", "direita", "direita"];
  // Chat escrito de cada sala: o da ala em que ela fica.
  const ALA_SALAS = ["atendimento", "atendimento", "atendimento", "criacao", "criacao", "criacao", "producao", "producao", "producao"];
  PORTA_SALAS.forEach((porta, i) => ambientes.push({ id: "sala-" + i, nome: "Sala livre", sala: ALA_SALAS[i], x0: 0, y0: 0, x1: L, y1: L, piso: "sala" + i,
    pessoal: true, porta, alta: ["y0", "x0"], cor: CORES_SALAS[i] }));
  // Espaços comuns: cada um é uma cena com as paredes do fundo altas e
  // forradas, preenchida do chão à parede (ESCRITORIO_MOVEIS_CENAS). O id é
  // a zona de conversa que o Worker já aceita: entrar na cena é entrar na
  // conversa daquele espaço. A Convivência usa a zona "recepcao".
  // [id, nome, sala de conversa, cor, largura × fundo, piso, papel de parede]
  const CENAS = [
    ["recepcao", "Convivência", "convivencia", "#ff8a35", 20, 18, "plano:piso:307", "plano:parede:218"],
    ["reuniao", "Sala de reunião", "reuniao", "#5aa9ff", 18, 14, "lodge_c15_floor", "lodge_dark_brickwall"],
    ["auditorio", "Auditório", "reuniao", "#6b4fa0", 20, 16, "cine_tile", "attic15_wall"],
    ["producao", "Produção", "producao", "#4a5560", 20, 14, "rainyday_c20_woodenfloor", "attic15_wall"],
    ["cafe", "Café", "convivencia", "#d9a066", 16, 12, "plano:piso:208", "plano:parede:1301"],
    ["jogos", "Jogos", "convivencia", "#3fae7a", 20, 12, "tokyo_c18_floor", "attic15_wall"],
    ["foco", "Foco", "foco", "#8b6b4a", 12, 16, "rainyday_c20_woodenfloor", "gardenshed_wall"],
    ["academia", "Academia", "convivencia", "#7a8494", 20, 16, "sb_tile", "attic15_wall"],
    ["lounge", "Lounge", "convivencia", "#b4583a", 16, 12, "rainyday_c20_woodenfloor", "plano:parede:1901"],
  ];
  // Planta de cada cena, linha a linha (y = 0 é a parede do fundo): "x" sem
  // piso, "0" chão, "1" e "2" patamares de um e dois degraus (o degrau do
  // Habbo sobe direto; de 0 para 2 não se passa). Como nos quartos do Habbo,
  // recorte no fundo ou à esquerda vira canto de parede; à direita e na
  // frente fica aberto. A porta é o par de ladrilhos do meio da última linha.
  const PLANTAS_CENAS = {
    // Saguão branco (referência aprovada pelo Paulo em 18/10/2026): piso
    // plano, mezanino de construtor no fundo e frente chanfrada; parede alta
    // para o mezanino caber. A porta é o par do meio da última linha.
    recepcao: { corDegrau: "#d8d2c8", fundo: "#1a1714", alturaParede: 5, figurantes: ESCRITORIO_CENAS_COMPOSTAS.recepcao?.figurantes || [], planta: [
      ...Array.from({ length: 15 }, () => "00000000000000000000"),
      "0000000000000000000x",
      "000000000000000000xx",
      "00000000000000000xxx",
    ] },
    // Sala executiva em L: a mesa de reunião no patamar do fundo, a lareira e o
    // bar embaixo.
    reuniao: { corDegrau: "#6b4428", planta: [
      "000000111111111111",
      "000000111111111111",
      "000000111111111111",
      "000000111111111111",
      "000000111111111111",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000000000",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
      "000000000000xxxxxx",
    ] },
    // Cinema: cantos do fundo recolhidos ao lado da tela e plateia em degraus até o
    // saguão da entrada, no alto (a última linha desce um degrau para a porta).
    auditorio: { corDegrau: "#7a5aa8", planta: [
      "xx000000000000000000",
      "xx000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "11111111111111111111",
      "11111111111111111111",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "22222222222222222222",
      "11111111111111111111",
    ] },
    // Estúdio em L: ilha de edição no recuo do fundo, set iluminado no patamar à
    // direita, mesa de som e espera na frente.
    producao: { corDegrau: "#2c3238", planta: [
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "xxxxxx00000011111111",
      "00000000000011111111",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
    ] },
    // Café (referência escolhida pelo Paulo em 18/10/2026: café de madeira em
    // dois andares). O mezanino é de construtor (tábuas suspensas sobre
    // colunas), para o térreo continuar embaixo da beira; sobe-se pela porta.
    // Piso por zona: ladrilho de barro no balcão, vinho no recanto da lareira.
    // Raio de sol pelas janelas; cozinheira, garçom e uma cliente de figurantes.
    cafe: { corDegrau: "#5a3a24", fundo: "#140c08", luz: "quente", alturaParede: 4, raiosDeSol: true, figurantes: ESCRITORIO_CENAS_COMPOSTAS.cafe?.figurantes || [], planta: [
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
    ], texturas: [
      { x0: 1, y0: 3, x1: 11, y1: 7, textura: "plano:piso:502" },
      { x0: 14, y0: 0, x1: 16, y1: 5, textura: "plano:piso:405" },
    ] },
    // Fliperama largo, com a frente recolhida à direita.
    jogos: { planta: [
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "0000000000000000xxxx",
      "0000000000000000xxxx",
      "0000000000000000xxxx",
      "0000000000000000xxxx",
    ] },
    // Biblioteca funda: galeria de leitura no patamar do fundo.
    foco: { corDegrau: "#5a4430", planta: [
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "111111111111",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000000",
      "000000000xxx",
      "000000000xxx",
      "000000000xxx",
      "000000000xxx",
    ] },
    // Academia: aparelhos no patamar do fundo (recuado à direita) e a quadra de
    // futebol na frente.
    academia: { corDegrau: "#4f5866", planta: [
      "11111111111111111111",
      "11111111111111111111",
      "11111111111111111111",
      "11111111111111111111",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
      "00000000000000000000",
    ] },
    // Pub (referência do Paulo, 18/10/2026), montado por conjuntos conferidos
    // um a um em 1×: retângulo simples; o único degrau é o palco do bardo no
    // fundo à direita. Piso por zona: xadrez no bar, carpete vermelho do
    // Habbo no salão, madeira no estar e nos sofás.
    // Lounge: bar-garagem grunge, referência escolhida pelo Paulo em
    // 18/10/2026 (quarto "Garage 93 Vinyl"). Retângulo; o piso diz a zona:
    // terracota no bar (esquerda), ladrilho verde-escuro na garagem (fundo),
    // concreto no meio e tábuas no canto do DJ, no fundo à direita.
    // Lounge: bar-garagem grunge, referência escolhida pelo Paulo em
    // 18/10/2026 (quarto "Garage 93 Vinyl"). O piso diz a zona: terracota no
    // bar (esquerda), ladrilho verde-escuro na garagem (fundo), concreto no
    // salão e o palco do DJ, um degrau acima, de tábuas, no fundo à direita.
    // Luz "bar": sala na penumbra e cada lâmpada acesa com a sua área quente.
    lounge: { corDegrau: "#4a3322", fundo: "#0d0a09", alturaParede: 1, luz: "bar", planta: [
      "0000000000011111",
      "0000000000011111",
      "0000000000011111",
      "0000000000011111",
      "0000000000011111",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
      "0000000000000000",
    ], texturas: [
      { x0: 0, y0: 0, x1: 16, y1: 12, textura: "plano:piso:401" },
      { x0: 0, y0: 0, x1: 5, y1: 12, textura: "plano:piso:505" },
      { x0: 5, y0: 0, x1: 11, y1: 4, textura: "plano:piso:601" },
      { x0: 11, y0: 0, x1: 16, y1: 5, textura: "plano:piso:208" },
    ] },
  };
  for (const [id, nome, sala, cor, w0, h0, textura, texturaParede] of CENAS) {
    // A planta da cena vem junto (não do catálogo dos quartos), com a porta
    // no meio da frente e sem parede na frente, como no Habbo.
    const def = PLANTAS_CENAS[id];
    const celdas = def ? def.planta.map((linha) => [...linha].map((c) => (c === "x" ? -1 : Number(c)))) : Array.from({ length: h0 }, () => Array(w0).fill(0));
    const w = celdas[0].length, h = celdas.length;
    const modelo = { id: "cena-" + id, celdas, portas: { baixo: Math.floor(w / 2) - 1 }, escada: def?.escada || [], bordaAberta: true };
    ambientes.push({ id, nome, sala, cena: true, semRotulo: true, x0: 0, y0: 0, x1: w, y1: h, piso: "madeira", porta: "baixo", cor, textura, texturaParede, modelo, corDegrau: def?.corDegrau, texturas: def?.texturas || [], fundo: def?.fundo, semParedes: def?.semParedes === true, alturaParedeFixa: def?.alturaParede ?? -1, luz: def?.luz || "", figurantes: def?.figurantes || [], raiosDeSol: def?.raiosDeSol === true });
  }
  return { W, H, PREDIO: null, PISO, ambientes, divisorias: [], moveis: [], piscina: null, quadros: [], corredores: [], postes: [], letreiro: null,
    pisos: [], rotulos: [], vistas: {}, texturas: [], texturaSalas: "rainyday_c20_woodenfloor", texturaCorredor: "paris_c15_pavement",
    texturaDeck: "country_patio", portas: [], soleiras: [], elevadores: [] };
})();
// Praça: a área de fora, compacta, ao ar livre (sem paredes). É a cena de
// abertura do escritório (zona vazia, sem voz, como era o corredor) e a
// camada "geral" do editor de quem administra. Chão por trechos: gramado,
// calçamento, deck da piscina, lago (água não se pisa).
const ESCRITORIO_PRACA = (() => {
  const w = 22, h = 18;
  const modelo = { id: "cena-praca", celdas: Array.from({ length: h }, () => Array(w).fill(0)), portas: { baixo: Math.floor(w / 2) - 1 }, escada: [], bordaAberta: true, semParedes: true };
  const texturas = [
    { x0: 0, y0: 0, x1: w, y1: h, textura: "country_grass", piso: "grama" },
    // Deck da piscina (fundo à esquerda) e a água.
    { x0: 0, y0: 0, x1: 10, y1: 9, textura: "country_patio", piso: "deck" },
    { x0: 1, y0: 1, x1: 7, y1: 5, textura: "jungle_c16_watertile", piso: "verde", agua: true },
    // Café ao ar livre (fundo à direita).
    { x0: 13, y0: 0, x1: w, y1: 7, textura: "paris_c15_floor", piso: "praca" },
    // Praça calçada com mosaico em volta da fonte e o caminho até a porta.
    { x0: 9, y0: 7, x1: 16, y1: 14, textura: "mexico_c24_cobbledstreet", piso: "praca" },
    { x0: 10, y0: 8, x1: 15, y1: 13, textura: "santorini_c17_mosaicfloor", piso: "praca" },
    { x0: 9, y0: 14, x1: 13, y1: h, textura: "paris_c15_pavement", piso: "praca" },
    // Lago do jardim (frente à direita).
    { x0: 17, y0: 14, x1: 21, y1: 17, textura: "jungle_c16_watertile", piso: "verde", agua: true },
  ];
  return { id: "praca", nome: "Praça", sala: "convivencia", praca: true, semRotulo: true, x0: 0, y0: 0, x1: w, y1: h, piso: "grama", porta: "baixo", cor: "#3fae7a", modelo, texturas };
})();
// Móveis de cada espaço comum, em coordenadas da cena (0,0 = canto do
// fundo). Montados como os quartos de referência do Habbo: cada cena com uma
// linha de móveis só, parede do fundo ocupada, peças empilhadas (o que fica
// em cima leva a altura do topo de baixo) e o caminho da porta livre.
// [classe, x, y, direção, estado, altura]
// Casca do quarto como a dos construtores do Habbo: a parede inteira
// forrada com um item de parede (variantes alternadas) e a cornija, uma
// fileira de ladrilho fino na primeira linha de ladrilhos, na altura do
// topo da parede (o mesmo para o quarto todo, como no Habbo).
function escritorioCascaDoQuarto(id, forro, variantes, [cornija, estadoCornija], colunas = []) {
  const a = ESCRITORIO_PLANTA.ambientes.find((x) => x.id === id);
  if (!a) return [];
  const r = [];
  const topo = escritorioTopoDaParede(a);
  for (const [x0, y0, x1, y1] of escritorioParedesDoQuarto(a).filter((p) => !p.baixa)) {
    const horizontal = y0 === y1;
    for (let i = horizontal ? x0 : y0; i < (horizontal ? x1 : y1); i++) {
      const x = horizontal ? i : x0, y = horizontal ? y0 : i;
      if (forro) r.push([forro, x, y, horizontal ? 4 : 2, i % variantes, 0]);
      if (!colunas.some(([cx, cy]) => cx === x && cy === y)) r.push([cornija, x, y, 0, estadoCornija, topo - escritorioAlturaQuarto(a, x, y)]);
    }
  }
  return r;
}
// Topo da parede, o mesmo no quarto todo (RoomPlaneParser do Habbo).
function escritorioTopoDaParede(a) {
  return 3.6 + Math.max(0, a.alturaParedeFixa ?? -1) + Math.max(0, ...a.modelo.celdas.flat());
}
// Coluna de construtor: peças empilhadas, uma apoiada no topo da outra, até
// passar da cornija (a coluna corta a cornija, como nas referências).
function escritorioColunaAteCornija(id, classe, x, y) {
  const a = ESCRITORIO_PLANTA.ambientes.find((q) => q.id === id), f = mapaFisica(classe).altura || 1;
  const n = a ? Math.ceil((escritorioTopoDaParede(a) - escritorioAlturaQuarto(a, x, y)) / f) : 4;
  return Array.from({ length: n }, (_, i) => [classe, x, y, 0, 0, Math.round(i * f * 100) / 100]);
}
// Café em dois andares, montado como os construtores do Habbo (referência
// escolhida pelo Paulo em 18/10/2026). O mezanino é de tábuas suspensas sobre
// colunas de pedestal, com guarda-corpo; sobe-se pela porta-teleporte (a
// referência não mostra escada: os construtores ligam os andares por porta).
const ESCRITORIO_MOVEIS_CENAS = {
  // Convivência: saguão branco montado pelo motor (scripts/cenas/recepcao.mjs).
  recepcao: () => ESCRITORIO_CENAS_COMPOSTAS.recepcao.moveis,
  // Praça: a área de fora, compacta. Deck da piscina com bar de palha no
  // fundo à esquerda; café ao ar livre no fundo à direita; fonte no meio do
  // calçamento; caminho iluminado até a porta; jardim com lago na frente à
  // direita; piquenique, bicicletas e árvores na frente à esquerda.
  praca: () => [
    // Deck: espreguiçadeiras viradas para a piscina, guarda-sóis entre elas,
    // bar de palha com banquetas e tochas, palmeiras.
    ...[1, 3, 5].map((x) => ["js_c16_lounger", x, 5, 0]), ["lido_parasol", 2, 7, 0], ["lido_parasol", 4, 7, 0],
    // Banqueta sim, banqueta não: cada uma com chão livre ao lado para chegar.
    ...[1, 2, 3, 4].map((y) => ["tiki_bardesk", 8, y, 6]), ["vwave_c21_barstool", 7, 1, 2], ["vwave_c21_barstool", 7, 3, 2],
    ["tiki_torch", 8, 0, 2], ["tiki_torch", 8, 5, 2], ["summer_c22_lifering", 7, 6, 2],
    ["vwave_c21_palm", 9, 0, 2], ["vwave_c21_palm", 9, 8, 2], ["vwave_c21_palm", 9, 6, 2],
    // Café: quiosque, quatro mesas com cadeiras, guarda-sóis e floreiras.
    ["nyc_c23_starterstall", 13, 0, 0],
    ...[[15, 1], [19, 1], [15, 4], [19, 4]].flatMap(([x, y]) => [["paris_c15_table", x, y, 0], ["paris_c15_chair", x - 1, y, 2], ["paris_c15_chair", x + 1, y, 6]]),
    ["lido_parasol", 17, 1, 0], ["lido_parasol", 17, 4, 0],
    ["olympics_c16_plantdvdr", 18, 6, 0], ["olympics_c16_plantdvdr", 20, 6, 0],
    // Fonte no meio do mosaico com quatro bancos, canteiros e postes.
    ["bazaar_r17_fountain", 11, 10, 4],
    ["greek_c15_bench", 11, 8, 4], ["greek_c15_bench", 10, 10, 2], ["greek_c15_bench", 13, 10, 6], ["greek_c15_bench", 11, 12, 0],
    ["stone_flowerbed", 14, 8, 0], ["stone_flowerbed", 14, 12, 0],
    ...[[9, 7], [15, 7], [9, 13], [15, 13], [9, 16], [12, 16]].map(([x, y]) => ["suncity_c19_streetlight", x, y, 0, 1]),
    // Jardim com lago: pedras, flores d'água, plantas, banco e bebedouro.
    ["rela_rock", 16, 14, 0], ["rela_rock", 16, 16, 0], ["br_c25_lilies3", 18, 15, 0], ["br_c25_lilies3", 20, 14, 0],
    ["zengarden_c18_spikeyplant", 21, 14, 0], ["zengarden_c18_spikeyplant", 21, 16, 0],
    ["br_c25_stonebench", 18, 17, 0], ["garden_birdbath", 14, 16, 0],
    // Sebe baixa separando o jardim da praça (árvore alta na frente cobria tudo).
    ["hblooza14_hedgediv", 17, 12, 0], ["hblooza14_hedgediv", 19, 12, 0], ["garden_lupin3", 21, 12, 0], ["garden_lupin3", 21, 9, 0],
    // Frente à esquerda: piquenique, bicicletário, árvores e flores.
    ["summer_c22_picnictable", 2, 11, 0], ["summer_c22_picnictable", 2, 14, 0],
    ["mafia_c26_teleport_dark", 13, 16, 6],
    ["paris15_bicycle", 7, 13, 0], ["paris15_bicycle", 7, 15, 0], ["classic2_trashcan", 8, 12, 2], ["nyc_c23_mailbox", 8, 17, 2],
    ["olympus_c25_olivetree", 0, 9, 2], ["bohogarden_c21_fanpalm", 1, 17, 0], ["bohogarden_c21_fanpalm", 5, 10, 0],
    ...[[0, 12], [0, 14], [5, 13], [4, 16]].map(([x, y]) => ["garden_lupin3", x, y, 0]),
  ],
  // Café: cafeteria funda. Cozinha no fundo (geladeira, bancada com
  // eletrodomésticos e armários de parede), ilha com banquetas, mesa de
  // jantar no tapete, estar e mesinhas na frente.
  // Café: madeira escura, bolos e plantas. Regras da planta: peça alta só
  // encostada; o caminho da porta (colunas 7 e 8) até o balcão e a escada
  // livre; a frente do mezanino é a parede do térreo (o balcão encosta nela).
  // Café: madeira escura, bolos e plantas, como obra de construtor.
  cafe: () => ESCRITORIO_CENAS_COMPOSTAS.cafe.moveis,
  // Sala de reunião em L: mesa de dez lugares no patamar do fundo, com mural,
  // mapa e lustre; embaixo a lareira com sofá, o bar com banquetas, a roleta
  // (sorteia quem fala primeiro) e a espera.
  reuniao: () => [
    ["uni_c23_whiteboard", 6, 0, 0], ["exe_map", 10, 0, 4, 0, 1.6], ["lodge_dark_candle", 14, 0, 0], ["shelves_silo", 15, 0, 4], ["mafia_c26_planter_dark", 17, 0, 0],
    ["exe_table", 10, 2, 0], ["lodge_dark_chandelier", 11, 2, 0, 1],
    ["exe_chair", 10, 1, 4], ["exe_chair", 12, 1, 4], ["exe_chair", 10, 4, 0], ["exe_chair", 12, 4, 0], ["exe_chair", 9, 2, 2], ["exe_chair", 13, 3, 6],
    ["uni_laptop", 10, 2, 4, 0, 1], ["mafia_c26_drinktray", 11, 3, 0, 0, 1], ["exe_c15_telephone", 12, 2, 0, 0, 1],
    ["mafia_c26_planter_dark", 6, 4, 0], ["mafia_c26_planter_dark", 17, 4, 0],
    // Lareira: sofá virado para o fogo, mesinha e poltrona.
    ["shelves_silo", 0, 0, 4], ["lodge_dark_tv", 2, 0, 0], ["lodge_dark_candle", 3, 0, 0], ["lodge_dark_endtable", 4, 0, 0], ["exe_globe", 4, 0, 0, 0, 0.9], ["mafia_c26_planter_dark", 5, 0, 0],
    ["lodge_dark_fireplace", 0, 2, 2], ["exe_rug", 1, 1, 0], ["mafia_c26_coffeetable_dark", 2, 2, 0],
    ["mafia_c26_sofa_dark", 3, 1, 6], ["mafia_c26_armchair_dark", 2, 4, 0],
    // Bar no canto e a roleta.
    ["lodge_dark_minibar", 0, 7, 2], ["lodge_dark_bardesk", 1, 7, 0], ["mafia_c26_drinktray", 1, 8, 0, 0, 1.4],
    ["lodge_dark_stool", 2, 7, 6], ["lodge_dark_stool", 2, 9, 6], ["hween_c22_gothicbookshelf", 0, 11, 0], ["mafia_c26_planter_dark", 0, 13, 0],
    // Espera: duas poltronas de frente, com a mesinha no meio.
    // (poltrona larga: uma de cada lado da mesa comprida, no mesmo eixo)
    ["mafia_c26_armchair_dark", 6, 6, 4], ["mafia_c26_coffeetable_dark", 6, 7, 0], ["mafia_c26_armchair_dark", 6, 9, 0],
    ["exe_artlamp", 8, 6, 0], ["mafia_c26_planter_dark", 11, 8, 0], ["mafia_c26_planter_dark", 4, 12, 0],
    // Camada de construtor: arandelas escuras e quadro nas paredes, tapetes
    // sob a mesa de reunião e a espera, lustres sobre o estar e a espera.
    ["mafia_c26_walllamp_dark", 0, 4.4, 2, 0, 0.8], ["attic15_painting", 0, 5.4, 2, 0, 1.2], ["mafia_c26_walllamp_dark", 0, 9.6, 2, 0, 0.8],
    ["mafia_c26_walllamp_dark", 8.6, 0, 4, 0, 0.6],
    ["js_exe_rug", 10, 2, 0], ["darkelegant_c20_carpet", 5, 7, 0],
    ["lodge_dark_chandelier", 2, 2, 0], ["lodge_dark_chandelier", 6, 7, 0],
  ],
  // Lounge: bar-garagem grunge (referência "Garage 93 Vinyl", escolhida
  // pelo Paulo em 18/10/2026). A história: oficina de um mecânico que vira
  // bar de vinil à noite. Da porta (meio da frente) o olhar vai à moto da
  // garagem, no fundo; o caminho da porta ao balcão e ao DJ fica livre.
  // Camadas: piso por zona, móvel grande encostado, peça em cima, coisa na
  // parede e lâmpada pendurada em cada zona. Colunas de caixotes até a
  // cornija nas duas pontas das paredes e entre a garagem e o DJ (nada
  // na frente da moto nem no canto mais perto de quem olha).
  lounge: () => [
    ...escritorioCascaDoQuarto("lounge", null, 1, ["xmas_c16_woodtile", 0], [[0, 11], [10, 0], [15, 0]]),
    ...[[0, 11], [10, 0], [15, 0]].flatMap(([x, y]) => escritorioColunaAteCornija("lounge", "wildwest_crate", x, y)),
    // Regras da planta: peça alta só encostada nas paredes (fundo e
    // esquerda); nas bordas da frente, só coisa baixa, para não tapar a sala.
    // A frente do palco fica aberta (é a plateia) e nada fica na frente da
    // moto. Caminho livre da porta (colunas 7 e 8) até o bar e o palco.
    //
    // Bar (parede da esquerda): máquina de bebida, geladeira de vidro,
    // prateleira de tijolo com garrafas e estante de vidro;
    // corredor do barman; balcão de caixotes com garrafas, velas, cafeteira e
    // canecas; banquetas do lado do cliente; pichação na parede.
    ["olympics_r16_vendingmchn", 0, 0, 2], ["ads_711shelf", 0, 1, 0], ["grunge_shelf", 0, 3, 2], ["glass_shelf", 0, 6, 2],
    ["sb_tag1", 0, 6, 2, 0, 1.9],
    ...[2, 3, 4, 5, 6, 7].map((y) => ["wildwest_crate", 2, y, 0]),
    ["pirate_bottle_1", 2, 2, 0, 0, 1.23], ["grunge_candle", 2, 3, 0, 0, 1.23], ["sunsetcafe_c20_coffeemachine", 2, 4, 2, 0, 1.23],
    ["pirate_bottle_3", 2, 5, 0, 0, 1.23], ["xmas_c24_mugs", 2, 6, 0, 0, 1.23], ["grunge_candle", 2, 7, 0, 0, 1.23],
    ...[2, 3, 4, 5, 6].map((y) => ["studio_stool", 3, y, 6]),
    ["grungelamp", 2, 3, 0, 1, 2.5], ["grungelamp", 2, 6, 0, 1, 2.5], ["hween_c17_rat", 1, 8, 2],
    // Parede do fundo do bar: mural de pôsteres de show e a placa de lata.
    ["nyc_c23_wallposters", 3, 0, 2], ["md_can", 1.4, 0, 4, 0, 0.7],
    // Canto de jogos (parede da esquerda, junto da porta): fliperama e
    // jukebox pichados de costas para a parede, sinuca baixa na frente e
    // lâmpada.
    ["graffiti_r24_arcademachine", 0, 9, 0], ["vwave_r21_jukebox", 0, 10, 2],
    ["bling15_pooltable", 2, 10, 4], ["grungelamp", 3, 10, 0, 1, 2.5],
    // Garagem (fundo): armário, carrinho de ferramentas sob a janela velha,
    // a moto encostada na parede com a guitarra pendurada em cima (o
    // destaque da sala, com lâmpada), ferramentas, placa, cone e pneus nos
    // cantos, longe da frente da moto.
    ["uni_c23_locker", 5, 0, 4], ["ads_ontrackgp_tools", 6, 0, 4], ["window_grunge", 6.4, 0, 4, 0, 1.4],
    ["tokyo_c18_motorbike", 7, 0, 2], ["guitar_skull", 8, 0, 4, 0, 2],
    ["ranch_c26_farmtools", 5, 1, 0], ["grunge_sign", 5, 2, 0], ["bump_tires", 5, 3, 0], ["fball_c26_trainingcone", 6, 3, 0], ["lt_spider", 9, 3, 0],
    ["grungelamp", 8, 1, 0, 1, 2.5], ["hween_c25_tools", 9, 2, 0],
    // Palco do DJ (fundo à direita, um degrau): mesa de DJ de frente para a
    // plateia, disco e neon na parede, violão encostado e o
    // microfone e caixas de som de chão na beira do palco; lâmpada e o
    // refletor de festa varrendo o palco.
    ["fest_c19_dj", 13, 1, 0], ["uni_vinyl", 12, 0, 4, 0, 1.4],
    ["disco_c26_neonlight1", 12, 0, 0, 1, 0.9], ["party_beamer", 11, 1, 4, 1], ["studio_guitar", 12, 1, 4], ["stories_oldmusic_mike", 13, 4, 4], ["darkmodern_c20_speakers", 11, 4, 4], ["darkmodern_c20_speakers", 15, 4, 4],
    ["grungelamp", 14, 2, 0, 1, 2.5],
    // Plateia (frente do palco): chão livre para ficar de pé; a mesa alta
    // fica na lateral direita, com duas banquetas, sem tapar o palco.
    ["vwave_c21_bartable", 14, 6, 0], ["studio_stool", 15, 6, 6], ["studio_stool", 15, 7, 6], ["grungelamp", 14, 6, 0, 1, 2.5],
    // Salão: mesa de carretel com cadeiras de caixote à esquerda do caminho;
    // na frente à direita, outra mesa com o sofá pichado (peças baixas).
    ["grunge_table", 5, 7, 0], ["recycler_cratechairdark", 4, 8, 2], ["recycler_cratechairdark", 5, 6, 4], ["recycler_cratechairdark", 6, 9, 0],
    ["grungelamp", 6, 8, 0, 1, 2.5],
    ["grunge_table", 12, 9, 0], ["grunge_chair", 11, 9, 2], ["recycler_cratechairdark", 14, 10, 6], ["graffiti_r24_sofa", 12, 11, 0],
    ["grungelamp", 13, 10, 0, 1, 2.5],
    // No chão: alçapão no caminho, papel amassado, lixo, pneus e balde de
    // tinta.
    ["hween_c26_hatchteleport", 8, 5, 0], ["uni_c23_toiletpaper", 9, 10, 0], ["vwave_c21_trash", 4, 4, 0],
    ["graffiti_c24_paintbucket", 15, 9, 0], ["bump_tires", 10, 11, 0],
  ],
  // Auditório: cinema. Tela com palco e púlpito entre os cantos recolhidos,
  // refletores, plateia em três degraus com corredor no meio e o saguão da
  // entrada no alto, com bilheteria, pipoca e projetor.
  auditorio: () => [
    ["cine_screen", 7, 0, 0], ["cine_light2", 3, 0, 4, 0, 0.4], ["cine_light2", 16, 0, 4, 0, 0.4],
    // Palco onde se pisa e se põe coisas, altura 1,15 (o degrau do Habbo: até 1,5).
    ["classic7_stage", 7, 1, 0], ["classic7_stage", 9, 1, 0], ["classic7_stage", 11, 1, 0], ["uni_lectern", 11, 2, 0, 0, 1.15],
    ["spotlight", 4, 2, 2], ["spotlight", 15, 2, 6], ["theatre_plant", 0, 2, 0], ["theatre_plant", 19, 2, 0],
    ["cine_pstr_1", 0, 5, 2, 0, 0.6], ["cine_pstr_6", 0, 10, 2, 0, 0.6], ["cine_light2", 0, 7, 2, 0, 0.4], ["cine_light2", 0, 13, 2, 0, 0.4],
    // Três fileiras, cada uma com passagem atrás, e corredor no meio.
    ...[6, 8, 10].flatMap((y) => [5, 6, 7, 8, 11, 12, 13, 14].map((x) => ["theatre_seat", x, y, 0])),
    ["cine_projector", 19, 9, 0],
    ["cine_ticket_booth", 6, 13, 0], ["cine_popcorn", 18, 13, 4], ["cine_vipsign", 14, 14, 0],
    ["lodge_dark_bench", 4, 14, 0], ["theatre_plant", 0, 15, 0], ["theatre_plant", 19, 15, 0],
    // Camada de construtor: tapete vermelho no corredor da plateia, da
    // entrada até a frente do palco.
    ...[9, 10].flatMap((x) => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((y) => ["theatre_carpet", x, y, 0])),
  ],
  // Jogos: fliperama largo. Máquinas lado a lado no fundo e na lateral,
  // sinuca e pebolim no meio, mesa de gamer com duas cadeiras, pufes com o
  // dado e fios de lâmpadas por cima.
  jogos: () => [
    ["tokyo_c18_retroarcade", 0, 0, 4], ["arcade_c23_space", 1, 0, 4], ["arcade_c23_cyberpunk", 2, 0, 4], ["graffiti_r24_arcademachine", 3, 0, 0],
    ["arcade_c23_vrmachine", 4, 0, 0], ["arcade_c23_pinball", 5, 0, 0], ["rainyday_c20_retrogames", 7, 0, 0], ["vwave_r21_jukebox", 9, 0, 4],
    ["olympics_r16_vendingmchn", 11, 0, 4], ["olympics_r16_vendingmchn", 12, 0, 4], ["tokyo_c18_neonsign1", 13, 0, 0],
    ["tokyo_c18_racearcade", 15, 0, 0], ["tokyo_c18_racearcade", 17, 0, 0], ["theatre_plant", 19, 0, 0],
    ["arcade_c23_pinball", 0, 2, 2], ["tokyo_c18_retroarcade", 0, 5, 2], ["arcade_c23_space", 0, 6, 2], ["rainyday_c20_retrogames", 0, 8, 2],
    ["bling15_pooltable", 4, 4, 4], ["ads_aftv_footballtable", 9, 4, 0],
    ["gaming_c18_rigpro", 14, 3, 0], ["studio_chair", 14, 4, 0], ["studio_chair", 16, 4, 0],
    ["computer_flatscreen", 14, 3, 4, 0, 1.15], ["computer_flatscreen", 16, 3, 4, 0, 1.15],
    ["cubie_beanbag_b", 2, 9, 2], ["edice", 3, 9, 0, 1], ["cubie_beanbag_p", 4, 9, 6], ["edicehc", 9, 8, 0, 1],
    ["theatre_plant", 13, 7, 0], ["theatre_plant", 0, 11, 0],
    ["circus_c24_hanginglights", 4, 1, 0, 1], ["circus_c24_hanginglights", 9, 1, 0, 1], ["circus_c24_hanginglights", 15, 1, 0, 1],
    // Camada de construtor: pôster e luminária neon na parede da esquerda,
    // tapete neon no canto dos pufes e varais de luz neon sobre a sinuca, o
    // pebolim e os pufes (desenhados no alto).
    ["pixel_poster2", 0, 4, 2, 0, 1], ["cubie_decklight_p", 0, 9.2, 2, 0, 1.2],
    ["neonpunk_c20_carpet", 1, 8, 0],
    ["neonpunk_c20_lights", 4, 5, 0], ["neonpunk_c20_lights", 9, 5, 0], ["neonpunk_c20_stardeco", 3, 8, 0],
  ],
  // Foco: biblioteca funda. Galeria de leitura no patamar do fundo, entre
  // estantes; embaixo, escrivaninhas com luminária na parede, duas mesas de
  // leitura e plantas na frente.
  foco: () => [
    ...[0, 2, 4, 6, 8].map((x) => ["shelves_silo", x, 0, 4]), ["exe_globe", 10, 0, 0], ["classic9_plant", 11, 0, 0],
    ["shelves_silo", 0, 2, 2],
    ...[[3, 4, 5], [7, 8, 9]].flatMap(([a, t, b]) => [["hygge_c18_chair", a, 2, 2], ["lodge_dark_endtable", t, 2, 0], ["bookpile", t, 2, 0, 0, 0.9], ["hygge_c18_chair", b, 2, 6]]),
    ["rainyday_c19_lamp", 6, 2, 0], ["rainyday_c19_lamp", 10, 2, 0], ["classic9_plant", 11, 4, 0],
    ...[6, 8, 10].flatMap((y) => [["rainyday_c20_woodendesk", 0, y, 2], ["hygge_c25_desklamp", 0, y, 0, 0, 1], ["classic9_chair", 1, y, 6], ["waasa_wall_shelf1", 0, y, 2, 0, 1.6]]),
    ...[[5, 7], [8, 10]].flatMap(([x, y]) => [["classic9_table", x, y, 0], ["classic9_light", x, y, 0, 0, 0.7], ["bookpile", x + 1, y + 1, 0, 0, 0.7],
      ["classic9_chair", x - 1, y, 2], ["classic9_chair", x + 2, y + 1, 6], ["classic9_chair", x + 1, y - 1, 4], ["classic9_chair", x, y + 2, 0]]),
    ["classic9_plant", 0, 15, 0], ["bookpile", 1, 14, 0], ["classic9_plant", 8, 15, 0],
    // Camada de construtor: tapetes de biblioteca sob as mesas de leitura,
    // lustres de velas por cima, mapa antigo e quadro na parede da esquerda.
    ["classic9_carpet", 4, 6, 0], ["classic9_carpet", 7, 9, 0],
    ["lodge_chandelier", 5, 7, 0], ["lodge_chandelier", 8, 10, 0], ["lodge_chandelier", 6, 2, 0],
    ["steampunk_map", 0, 11.6, 2, 0, 0.8], ["attic15_painting", 0, 5, 2, 0, 1.2],
  ],
  // Academia: aparelhos no patamar do fundo (esteiras viradas para a parede,
  // armários, halteres e camas elásticas), colchonetes e bancada de
  // suplementos à esquerda e a quadra de futebol do Habbo na frente.
  academia: () => [
    ["matic_water_dispenser", 0, 0, 4], ...[1, 2, 3, 4, 5].map((x) => ["olympics_c16_treadmill", x, 0, 0]), ["olympics_c16_weightrack", 6, 0, 0],
    ...[8, 9, 10].map((x) => ["school_locker_b_nosale", x, 0, 4]), ["school_locker_r_nosale", 11, 0, 4], ["school_locker_r_nosale", 12, 0, 4],
    ["olympics_c16_trampoline", 2, 2, 0], ["olympics_c16_trampoline", 4, 2, 0],
    ["uni_dumbells", 8, 2, 0], ["uni_dumbells", 10, 2, 0], ["uni_dumbells", 12, 2, 0], ["matic_tree_green", 15, 0, 0],
    ["olympics_c16_weightrack", 0, 5, 2], ["olympics_c16_sofa", 0, 7, 2], ["olympics_c16_softmat", 2, 5, 0], ["olympics_c16_softmat", 2, 8, 0],
    ["olympics_c16_counter", 1, 12, 4], ["uni_brotein", 1, 12, 0, 0, 1.2], ["olympics_c16_chair", 1, 13, 0], ["olympics_c16_chair", 2, 13, 0],
    // Quadra: chute parando em cima da bola, gol pela frente da trave, placar da cor da trave.
    ["fball_score_b", 16, 0, 4], ["fball_score_r", 18, 0, 4],
    ["fball_goal_b", 8, 9, 2], ["fball_goal_r", 19, 9, 6], ["fball_ball", 13, 10, 0],
    ["matic_tree_green", 0, 15, 0], ["theatre_plant", 6, 15, 0],
    // Camada de construtor: espelho e relógio de academia nas paredes,
    // e adesivo olímpico.
    ["wallmirror", 0, 10, 2, 0, 1.2], ["wallmirror", 0, 11, 2, 0, 1.2], ["pixel_clock_red", 7, 0, 4, 0, 2.2], ["olympics_c16_walldecal", 0, 3, 2, 0, 0.6],
  ],
  // Produção: estúdio em L. Ilha de edição no recuo do fundo, set de
  // entrevista iluminado no patamar com refletores e câmera, mesa de som na
  // parede do fundo à esquerda, mesa de gamer, caixas e espera na frente.
  producao: () => [
    ["hc_exe_wrkdesk", 6, 0, 4], ["army_c15_leatherchr", 6, 1, 0], ["exe_c15_printer", 8, 0, 0], ["hc_exe_wrkdesk", 9, 0, 4], ["army_c15_leatherchr", 10, 1, 0],
    ["theatre_plant", 11, 0, 0], ["theatre_plant", 6, 4, 0],
    ["studio_floorlight", 13, 1, 0], ["theatre_plant", 12, 0, 0], ["theatre_plant", 19, 0, 0],
    ["mafia_c26_armchair_white", 13, 2, 2], ["hc26_3", 14, 2, 0], ["mafia_c26_armchair_white", 15, 2, 6],
    ["spotlight", 12, 5, 2], ["spotlight", 19, 5, 6], ["studio_camera", 14, 7, 0],
    ["studio_mixingdesk", 0, 5, 0], ["studio_stool", 1, 6, 0], ["studio_stool", 3, 6, 0],
    ["gaming_c18_rigpro", 0, 9, 2], ["studio_chair", 1, 10, 6], ["theatre_plant", 0, 13, 0],
    ["army_c15_crate", 19, 12, 4], ["army_c15_crate", 19, 13, 4], ["army_c15_crate", 19, 12, 4, 0, 1], ["army_c15_crate", 18, 13, 4],
    ["mafia_c26_sofa_dark", 12, 13, 0], ["mafia_c26_coffeetable_dark", 13, 11, 2], ["mafia_c26_drinktray", 13, 11, 0, 0, 0.84], ["theatre_plant", 7, 13, 0],
    // Camada de construtor: pôsteres de filme nas paredes, tapete sob o
    // sofá dos clientes, canto da banda (bateria, guitarra e amplificadores)
    // na frente à esquerda.
    ["cine_pstr_1", 6, 2, 2, 0, 0.6], ["cine_pstr_12", 0, 7, 2, 0, 0.6], ["cine_pstr_5", 15, 0, 4, 0, 0.6], ["cine_pstr_19", 17, 0, 4, 0, 0.6],
    ["js_exe_rug", 12, 10, 0],
    ["studio_drums", 2, 12, 0], ["studio_guitar", 1, 12, 2], ["studio_amp1", 5, 12, 0], ["studio_amp2", 5, 10, 0],
  ],
};
// Presença trafega em porcentagem (6–94) no Worker; aqui vira ladrilho. A
// escala é sempre a do mapa geral (80 × 80): dentro de um quarto a posição
// é local (0 … L) e vai com a mesma conta, e a zona diz em que quarto é.
function escritorioParaMapa(px, py) {
  const P = ESCRITORIO_PLANTA;
  return { x: ((Number(px) - 6) / 88) * P.W, y: ((Number(py) - 6) / 88) * P.H };
}
function escritorioParaPorcentagem(x, y) {
  const P = ESCRITORIO_PLANTA, lim = (n) => Math.max(6, Math.min(94, n));
  return { x: lim(6 + (x / P.W) * 88), y: lim(6 + (y / P.H) * 88) };
}
// Cena em que a pessoa está: null no mapa geral; o id do quarto (sala-N)
// dentro de um quarto. O cliente define ao entrar e sair.
let ESCRITORIO_QUARTO = null;
function escritorioDefinirQuarto(id) {
  ESCRITORIO_QUARTO = id || null;
}
function escritorioQuartoAtual() {
  return ESCRITORIO_QUARTO;
}
// Ambiente do ladrilho na cena atual: dentro de uma sala, só ela. Na Praça
// (cena de abertura) não há ambiente: a zona fica vazia, sem voz, como era
// o corredor.
function escritorioAmbienteEm(x, y) {
  const q = ESCRITORIO_QUARTO;
  if (!q || typeof escritorioAmbienteDoQuarto !== "function") return null;
  const a = escritorioAmbienteDoQuarto(q);
  return a && x >= a.x0 && y >= a.y0 && x < a.x1 && y < a.y1 ? a : null;
}
// Cena de abertura (a Praça), no formato de planta do quarto.
function escritorioPlantaGeral() {
  return escritorioPlantaDoQuarto(ESCRITORIO_PRACA);
}
// Móveis de um espaço comum (coordenadas locais da cena). Definidos em
// ESCRITORIO_MOVEIS_CENAS, mais abaixo; a cena sem lista fica vazia.
function escritorioMoveisDaCena(a) {
  const f = typeof ESCRITORIO_MOVEIS_CENAS !== "undefined" && ESCRITORIO_MOVEIS_CENAS[a.id];
  // (a Praça também tem a sua lista: é o padrão da camada "geral")
  // O 7º campo (configuração: cor do fundo colorido, troféu…) segue junto.
  return f ? f().map(([classe, x, y, dir = 2, estado = 0, altura = 0, cfg]) => [classe, x, y, dir, ESCRITORIO_ESTADO_ANIMADO[classe] ?? estado, altura, ...(cfg && typeof cfg === "object" ? [cfg] : [])]) : [];
}
// Espaço comum com cena própria (Café, Lounge…), pelo id da zona.
function escritorioCenaComum(id) {
  return ESCRITORIO_PLANTA.ambientes.find((a) => a.cena && a.id === id) || null;
}
// Paredes do quarto (cena própria, coordenadas locais): as duas do fundo
// altas na cor da sala; as da frente baixas, de vidro, com o vão da porta.
function escritorioModeloPlanta(a) {
  // Cena de espaço comum: a planta vem no próprio ambiente.
  if (a?.modelo) return a.modelo;
  const p = typeof escritorio !== "undefined" ? escritorio.base?.quartos?.plantas?.find(p => p.id === a.planta) : null;
  // Planta desenhada pelo dono: a da edição em curso ou a salva no perfil.
  const e = typeof escritorio !== "undefined" ? escritorio.edicao : null;
  return escritorioPlantaLivre(p, e && e.camada === a.id && e.celdas !== undefined ? e.celdas : a.celdasLivres);
}
// Mesma regra do servidor (plantaQuarto): 12 × 12 códigos sobre a planta;
// "0" mantém, "v" tira o piso, "p" piso no chão, "1"/"2" patamares. Porta
// e escada ficam como na planta.
// Planta desenhada: um código por ladrilho, como a planta de alturas do
// Habbo (RoomLayout.parse): "0" mantém o da planta escolhida, "v" tira o
// piso, "p" é o chão, "1"–"9" e "A"–"Z" são as alturas 1 a 35 (1 = um bloco).
const ESCRITORIO_CELDAS_LIVRES = /^[0vp1-9A-Z]{400}$/; // ESCRITORIO_QUARTO_MAX²
const ESCRITORIO_ALTURA_PLANTA_MAX = 35;
function escritorioNivelDoCodigo(c) {
  if (c === "v") return -1;
  if (c === "p") return 0;
  if (/^[1-9]$/.test(c)) return Number(c);
  if (/^[A-Z]$/.test(c)) return 10 + c.charCodeAt(0) - 65;
  return null;
}
function escritorioCodigoDoNivel(n) { return n < 0 ? "v" : n === 0 ? "p" : n <= 9 ? String(n) : String.fromCharCode(65 + Math.min(25, n - 10)); }
const escritorioPlantasLivres = new Map();
function escritorioLadrilhoFixo(p, x, y) {
  const h = p.celdas.length, w = p.celdas[0].length;
  return (p.escada || []).some(([ex, ey]) => ex === x && ey === y)
    || (y === h - 1 && x >= p.portas.baixo && x <= p.portas.baixo + 1)
    || (x === w - 1 && y >= p.portas.direita && y <= p.portas.direita + 1);
}
function escritorioPlantaLivre(p, livres) {
  if (!p || !ESCRITORIO_CELDAS_LIVRES.test(String(livres || "")) || !/[^0]/.test(livres)) return p;
  const chave = p.id + ":" + livres;
  if (!escritorioPlantasLivres.has(chave)) {
    if (escritorioPlantasLivres.size > 40) escritorioPlantasLivres.clear();
    escritorioPlantasLivres.set(chave, { ...p, celdas: p.celdas.map((linha, y) => linha.map((n, x) => { const c = livres[y * ESCRITORIO_QUARTO_MAX + x]; return c === "0" || escritorioLadrilhoFixo(p, x, y) ? n : escritorioNivelDoCodigo(c); })) });
  }
  return escritorioPlantasLivres.get(chave);
}
// Tamanho do quarto (a planta escolhida: de 6 × 6 a 12 × 12); sem planta,
// o 8 × 8 da primeira versão.
// Lado máximo do quarto (= LADO_QUARTO do servidor): 20 × 20 desde 18/10/2026.
const ESCRITORIO_QUARTO_MAX = 20;
// Grades do perfil guardadas com o lado antigo (8 ou 12) valem ampliadas,
// como o servidor faz (ampliarGrade/ampliarParedes/ampliarCeldas).
function escritorioAmpliarGrade(s, de, vazio) {
  const L = ESCRITORIO_QUARTO_MAX;
  return Array.from({ length: L }, (_, y) => (y < de ? s.slice(y * de, (y + 1) * de) : "").padEnd(L, vazio)).join("");
}
function escritorioPisosDoPerfil(s) {
  s = String(s || "");
  return s.length === 64 ? escritorioAmpliarGrade(s, 8, "0") : s.length === 144 ? escritorioAmpliarGrade(s, 12, "0") : s;
}
function escritorioCeldasDoPerfil(s) {
  s = String(s || "");
  return s.length === 144 ? escritorioAmpliarGrade(s, 12, "0") : s;
}
function escritorioParedesDoPerfil(s) {
  s = String(s || "");
  const t = s.length / 12, L = ESCRITORIO_QUARTO_MAX;
  if (t !== 8 && t !== 12) return s;
  return Array.from({ length: 4 }, (_, lado) => s.slice(lado * t * 3, (lado + 1) * t * 3) + "-00".repeat(L - t)).join("");
}
function escritorioDimQuarto(a) {
  const c = escritorioModeloPlanta(a)?.celdas;
  return c ? { w: c[0].length, h: c.length } : { w: ESCRITORIO_SALA_LADO, h: ESCRITORIO_SALA_LADO };
}
// Vão da porta (2 ladrilhos): embaixo, no meio da última linha; à direita,
// no trecho de piso da última coluna. Vem da planta; sem ela, o meio.
function escritorioPortaQuarto(a) {
  const { w, h } = escritorioDimQuarto(a), p = escritorioModeloPlanta(a)?.portas;
  return a.porta === "direita" ? { x: w - 1, y: p?.direita ?? h / 2 - 1, lado: "direita" } : { x: p?.baixo ?? w / 2 - 1, y: h - 1, lado: "baixo" };
}
function escritorioNivelQuarto(a, x, y) {
  const { w, h } = escritorioDimQuarto(a);
  if (x < 0 || y < 0 || x >= w || y >= h) return -1;
  return escritorioModeloPlanta(a)?.celdas[Math.floor(y)]?.[Math.floor(x)] ?? 0;
}
// A escada ocupa um ladrilho no percurso, mas tem quatro degraus visíveis.
// A direção é derivada do patamar alto, inclusive nas alas laterais.
function escritorioEscadaQuarto(a,x,y) {
  const p=escritorioModeloPlanta(a), ix=Math.floor(x), iy=Math.floor(y);
  if(!p?.escada?.some(([ex,ey])=>ex===ix && ey===iy)) return null;
  // O patamar alto de um lado e o piso do outro: o vizinho alto que fica ao
  // lado da escada (o canto do mezanino) não define o sentido da subida.
  const lados=[[0,-1],[0,1],[-1,0],[1,0]].filter(([dx,dy])=>escritorioNivelQuarto(a,ix+dx,iy+dy)===2);
  const alto=lados.find(([dx,dy])=>escritorioNivelQuarto(a,ix-dx,iy-dy)===0) || lados[0];
  return alto ? {x:ix,y:iy,dx:alto[0],dy:alto[1]} : null;
}
// Altura do piso (em blocos do Habbo, 1 = 32 px). A escada é um degrau de
// altura 1 entre o chão e o mezanino (no Habbo não há rampa: sobe-se um
// degrau de cada vez, até 1,5).
function escritorioAlturaQuarto(a,x,y) {
  return Math.max(0,escritorioNivelQuarto(a,x,y));
}
function escritorioParedesDoQuarto(a) {
  // Ao ar livre (Praça): sem paredes; as bordas são sebes e floreiras. Quarto
  // "maquete" (escolha do dono): sem paredes, para construir as suas com
  // móveis, como os construtores do Habbo fazem.
  if (escritorioModeloPlanta(a)?.semParedes || a.semParedes) return [];
  const lista = [], { w, h } = escritorioDimQuarto(a), pt = escritorioPortaQuarto(a);
  // Como no Habbo (RoomPlaneParser): o topo da parede é o mesmo no quarto
  // todo, 3,6 blocos (ou a altura fixa escolhida + 3,6) acima do piso mais
  // alto (até 20); cada trecho desce até o piso do seu ladrilho.
  const celdas = escritorioModeloPlanta(a)?.celdas || [], maxPiso = Math.min(20, Math.max(0, ...celdas.flat()));
  const altoParede = ((a.alturaParedeFixa ?? -1) >= 0 ? a.alturaParedeFixa + 3.6 : 3.6) + maxPiso;
  const por = (x0,y0,x1,y1,alta) => {
    const r=[x0,y0,x1,y1];
    if(alta) {r.push(a.cor); r.sala=a.id; r.alt=Math.round((altoParede - Math.max(0, escritorioNivelQuarto(a,x0,y0))) * 32); r.espessura=a.espessuraParede ?? 1; if(a.cena) {r.textura=a.texturaParede; r.semTinta=true;}} else r.baixa=true;
    lista.push(r);
  };
  for(let x=0;x<w;x++) for(let y=0;y<h;y++) {
    if(escritorioNivelQuarto(a,x,y)<0) continue;
    if(escritorioNivelQuarto(a,x,y-1)<0) por(x,y,x+1,y,true);
    if(escritorioNivelQuarto(a,x-1,y)<0) por(x,y,x,y+1,true);
    if(!escritorioModeloPlanta(a)?.bordaAberta && escritorioNivelQuarto(a,x,y+1)<0 && !(pt.lado==="baixo" && y===pt.y && x>=pt.x && x<pt.x+2)) por(x,y+1,x+1,y+1,false);
    if(!escritorioModeloPlanta(a)?.bordaAberta && escritorioNivelQuarto(a,x+1,y)<0 && !(pt.lado==="direita" && x===pt.x && y>=pt.y && y<pt.y+2)) por(x+1,y,x+1,y+1,false);
  }
  const grupos=new Map();
  for(const r of lista) {
    const horizontal=r[1]===r[3],chave=[horizontal,horizontal?r[1]:r[0],Boolean(r.baixa),r.alt||0].join(":");
    if(!grupos.has(chave)) grupos.set(chave,[]);grupos.get(chave).push(r);
  }
  const unidas=[];
  for(const grupo of grupos.values()) {
    const h=grupo[0][1]===grupo[0][3];grupo.sort((a,b)=>a[h?0:1]-b[h?0:1]);
    for(const r of grupo) {
      const ultimo=unidas.at(-1);
      if(ultimo && grupo.includes(ultimo) && ultimo[h?2:3]===r[h?0:1]) ultimo[h?2:3]=r[h?2:3];
      else unidas.push(r);
    }
  }
  for(const trecho of escritorioModeloPlanta(a)?.divisorias || []) {const r=[...trecho];r.baixa=true;unidas.push(r);}
  return unidas;
}
// Peças fixas da planta (não são do dono, não entram no inventário nem no
// editor): a escada do acervo em cada ladrilho de escada, subindo para o
// mezanino, e a balaustrada na borda do mezanino onde há queda para o piso.
// [classe, x, y, dir, estado, altura]. As duas se atravessam (MAPA_PASSAVEIS).
const ESCRITORIO_PECA_ESCADA = "bc_stairs_recolorable", ESCRITORIO_PECA_GUARDA = "hotel_c18_rail";
// Direção da peça de escada pelo lado em que fica o patamar alto.
const ESCRITORIO_DIR_ESCADA = { "0,-1": 4, "0,1": 0, "-1,0": 2, "1,0": 6 };
function escritorioPecasDoQuarto(a) {
  const { w, h } = escritorioDimQuarto(a), pecas = [];
  for (const [x, y] of escritorioModeloPlanta(a)?.escada || []) {
    const e = escritorioEscadaQuarto(a, x, y);
    if (e) pecas.push([ESCRITORIO_PECA_ESCADA, x, y, ESCRITORIO_DIR_ESCADA[e.dx + "," + e.dy] ?? 4, 0, 0]);
  }
  // Guarda-corpo na borda da frente (+y) e da direita (+x) onde o patamar
  // cai dois blocos ou mais para o piso de baixo (queda à vista).
  const n = (x, y) => escritorioNivelQuarto(a, x, y);
  const cai = (xa, ya, xb, yb) => n(xb, yb) >= 0 && n(xa, ya) - n(xb, yb) >= 2;
  for (let y = 0; y < h; y++) for (let x = 0; x + 1 < w; x++)
    if (n(x, y) === n(x + 1, y) && cai(x, y, x, y + 1) && cai(x + 1, y, x + 1, y + 1)) { pecas.push([ESCRITORIO_PECA_GUARDA, x, y + 0.5, 4, 0, 0]); x++; }
  for (let x = 0; x < w; x++) for (let y = 0; y + 1 < h; y++)
    if (n(x, y) === n(x, y + 1) && cai(x, y, x + 1, y) && cai(x, y + 1, x + 1, y + 1)) { pecas.push([ESCRITORIO_PECA_GUARDA, x + 0.5, y, 2, 0, 0]); y++; }
  return pecas;
}
// Planta do quarto de uma sala: só o quarto, a soleira da porta (fora dele;
// pisar nela volta ao mapa) e o escuro em volta, como num quarto do Habbo.
// Luz ambiente do quarto, como o regulador de luz do Habbo. Os ids batem com
// LUZES_SALA_ESCRITORIO do servidor; a cor da amostra é só para o botão.
const ESCRITORIO_LUZES_SALA = [["", "Normal", "#f4f1e8"], ["quente", "Quente", "#ffc27a"], ["fria", "Fria", "#9cc8ff"], ["rosa", "Rosa", "#ff9ccd"], ["roxa", "Roxa", "#b79cff"], ["verde", "Verde", "#9be3a8"], ["noite", "Noite", "#3b4a7a"]];
function escritorioPlantaDoQuarto(a) {
  const { w, h } = escritorioDimQuarto(a), pt = escritorioPortaQuarto(a);
  const soleira = pt.lado === "baixo" ? { x: pt.x, y: h, w: 2, h: 1 } : { x: w, y: pt.y, w: 1, h: 2 };
  const naSoleira = (x, y) => x >= soleira.x && x < soleira.x + soleira.w && y >= soleira.y && y < soleira.y + soleira.h;
  return {
    W: w + 1, H: h + 1, PREDIO: null, PISO: ESCRITORIO_PLANTA.PISO, quarto: a.id, fixa: true,
    ambientes: [{ ...a, x1: a.x0 + w, y1: a.y0 + h }], divisorias: escritorioParedesDoQuarto(a), moveis: [], fixos: escritorioPecasDoQuarto(a), piscina: null, quadros: [], corredores: [], postes: [], letreiro: null,
    // Trechos de piso do acervo (só a Praça tem: gramado, deck, lago…).
    pisos: [], texturas: a.texturas || [], texturaSalas: ESCRITORIO_PLANTA.texturaSalas, portas: [], elevadores: [], fundo: null, vistas: {},
    // Luz ambiente escolhida pelo dono (tinge piso, paredes, móveis e bonecos).
    luz: a.luz || "",
    // Figurantes (cozinheiro, garçom): bonecos parados da cena, só cenário —
    // não entram na lista de quem está no escritório. Raio de sol pelas janelas.
    figurantes: a.figurantes || [], raiosDeSol: Boolean(a.raiosDeSol),
    rotulos: [{ texto: "Porta · " + escritorioDestinoDaPorta(a.id).nome, x: soleira.x + soleira.w / 2, y: soleira.y + soleira.h / 2, saida: true }],
    soleiras: [soleira], entrada: escritorioEntradaDaSala(a), saida: { x: soleira.x, y: soleira.y },
    // Só se anda dentro do quarto e na soleira.
    andavel: (x, y) => escritorioNivelQuarto(a,x,y) >= 0 || naSoleira(x, y),
    nivelEm: (x,y) => Math.max(0,escritorioNivelQuarto(a,x,y)),
    alturaEm: (x,y) => escritorioAlturaQuarto(a,x,y), escadaEm: (x,y) => escritorioEscadaQuarto(a,x,y),
    nivelMax: Math.max(0, ...(escritorioModeloPlanta(a)?.celdas || []).flat()),
    // Opções do quarto do Habbo: espessuras (multiplicador) da parede e do piso.
    espessuraParede: a.espessuraParede ?? 1, espessuraPiso: a.espessuraPiso ?? 1,
  };
}
// Aonde leva a porta de cada cena: das salas para a Convivência; da
// Convivência para a Praça; da Praça de volta para a Convivência.
function escritorioDestinoDaPorta(id) {
  if (id === "recepcao") return ESCRITORIO_PRACA;
  return ESCRITORIO_PLANTA.ambientes.find((a) => a.id === "recepcao");
}
// Praça e corredores são convivência.
function escritorioSalaEm(x, y) {
  return escritorioAmbienteEm(x, y)?.sala || "convivencia";
}
// Coordenadas locais da sala: lx/ly contam do canto do fundo (x0, y0; hoje
// 0, 0, porque o quarto é uma cena própria). A mobília é desenhada no mesmo
// sentido em todas as salas; só a porta muda de lado (embaixo ou à direita).
function escritorioNaSala(a, lx, ly) {
  return { x: a.x0 + lx, y: a.y0 + ly };
}
function escritorioDirNaSala(a, dir) {
  return dir;
}
// Ladrilho logo depois da porta, dentro da sala (onde se chega ao entrar).
function escritorioEntradaDaSala(a) {
  const pt = escritorioPortaQuarto(a);
  return pt.lado === "direita" ? { x: pt.x - 1, y: pt.y } : { x: pt.x, y: pt.y - 1 };
}
// Mesa de trabalho: no meio do fundo da sala, com o dono sentado atrás dela,
// virado para a sala (e para quem olha o mapa). Na sala com porta à direita
// a planta gira: a mesa fica junto da parede alta da esquerda.
function escritorioMesaDaSala(a) {
  if (a.porta === "direita") return { x: a.x0 + 2, y: a.y0 + 2, w: 2, h: 3, cadeira: { x: a.x0 + 1, y: a.y0 + 3, dir: 2 } };
  return { x: a.x0 + 2, y: a.y0 + 2, w: 3, h: 2, cadeira: { x: a.x0 + 3, y: a.y0 + 1, dir: 4 } };
}
// Mobília de cada sala (8 × 8): a mesa é a mesma em todas (exe_table, onde o
// E abre o painel), o resto acompanha a ala. A ordem segue DONOS_ESCRITORIO
// em server/escritorio-mapa.js: Paulo, Vinícius e Ewerton atendem clientes;
// Deivid, Bia e Jady criam; Mizinho, Taynara e Reriston produzem.
// Regras: itens de parede só nas paredes altas (as duas do fundo do quarto);
// móveis com a frente para dentro da sala; a faixa da porta livre; pelo
// menos três objetos animados por sala.
const ESCRITORIO_TEMAS_SALAS = ["atendimento", "atendimento", "atendimento", "criacao", "criacao", "criacao", "producao", "producao", "producao"];
function escritorioMoveisDaSala(a, temaEscolhido) {
  const tema = temaEscolhido || ESCRITORIO_TEMAS_SALAS[Number(String(a.id).split("-")[1])] || "atendimento";
  const direita = a.porta === "direita";
  // Sala com porta à direita: a planta local é espelhada na diagonal (x ↔ y)
  // e as direções giram junto, para a mesa ficar junto da parede alta.
  const giro = { 0: 6, 2: 4, 4: 2, 6: 0 };
  const item = (classe, lx, ly, dir, estado = 0, altura = 0, parede = false) => {
    let x = lx, y = ly, d = dir;
    if (direita) { x = ly; y = lx; d = parede ? (dir === 4 ? 2 : 4) : (giro[dir] ?? dir); }
    return [classe, a.x0 + x, a.y0 + y, d, ESCRITORIO_ESTADO_ANIMADO[classe] ?? estado, altura];
  };
  // Na parede alta do fundo (dir 4; vira a da esquerda na sala espelhada).
  const naParede = (classe, lx, estado, altura) => item(classe, lx, 0, 4, estado, altura, true);
  // Uma sala do Habbo é cheia: a mobília encosta nas paredes do fundo e da
  // esquerda (as que aparecem por trás), o meio fica livre para andar, e os
  // detalhes pequenos (xícara fumegando, livros, lixeira, abajur) dão vida.
  // A faixa da porta (3–4, 6–7) e os corredores de cada lado da mesa
  // (coluna 1 e coluna 5) ficam livres.
  const base = [
    item("exe_table", 2, 2, 0),
    // A tela olha para quem senta (no Habbo a direção do monitor é para
    // onde a tela aponta): o dono fica atrás da mesa, de frente para as
    // visitas, e o monitor vira para ele (direção 0; o verificador acusa
    // "tela de costas para quem senta").
    item("computer_flatscreen", 3, 2, 0, 1, 0.95),
    item("darkmodern_c20_folder", 2, 3, 2, 0, 0.95),
    // Xícara de chá fumegando na mesa (animada) e a lixeira de papel ao lado.
    item("ktchn10_tea", 3, 3, 2, 1, 0.95),
    item("ktchn_trash", 4, 1, 0),
    // Visitas de frente para a mesa, sobre o tapete; planta no canto do fundo.
    item("exe_rug", 2, 4, 0),
    item("exe_plant", 0, 0, 0),
    // Gaveteiro com livros embaixo da janela; estante baixa na parede da
    // esquerda com cacto e livros em cima; luminária de chão ao lado.
    item("jp_drawer", 1, 0, 4), item("books_0", 1, 0, 2, 0, 1),
    item("cubie_shelf_2_p", 0, 1, 2), item("plant_small_cactus", 0, 1, 0, 0, 1.05), item("books_1", 0, 2, 2, 0, 1.05),
    item("modern_c17_floorlamp", 0, 3, 2, 1),
    // Mesinha de canto na direita (cada ala põe uma coisa em cima).
    item("modern_c17_endtable", 7, 2, 0),
    naParede("window_double_default", 1, 0, 1.0),
    naParede("hc_wall_lamp", 5, 1, 1.3),
  ];
  const temas = {
    // Executivo: poltrona alta, visitas de couro, sofá, globo, telefone,
    // impressora, flores na mesinha, quadro e relógio na parede.
    atendimento: [
      item("hc_exe_chair2", 3, 1, 4), item("js_exe_chair", 2, 5, 0), item("js_exe_chair", 4, 5, 0),
      // Sofá encostado no fundo, de frente para a sala (de costas, só se via o
      // encosto); globo junto da parede da esquerda.
      item("exe_sofa", 5, 0, 4), item("exe_globe", 0, 5, 0), item("exe_c15_telephone", 4, 3, 2, 1, 0.95),
      item("exe_c15_printer", 0, 6, 2, 1), item("bohogarden_c21_snakeplant", 7, 6, 2),
      item("giftflowers", 7, 2, 2, 0, 1.3),
      naParede("pixel_clock_black", 6, 0, 1.4), naParede("attic15_painting", 7, 0, 1.1),
    ],
    // Criação: cadeira moderna, mesa digitalizadora, pufes, sofá compacto,
    // tela inteligente, letreiro de neon, luz de chão e abajur na mesinha.
    criacao: [
      item("modern_c17_chair", 3, 1, 4), item("cubie_beanbag_b", 2, 5, 0), item("cubie_beanbag_p", 4, 5, 0),
      item("art_c20_drawingtablet", 4, 2, 0, 2, 0.95),
      item("icedblk_c16_sofa", 5, 0, 4), item("modern_c17_iscreen", 7, 0, 2, 1),
      item("tokyo_c18_neonsign1", 0, 6, 2, 1), item("darkmodern_c20_floorlight", 7, 5, 2, 7),
      item("modern_c17_plant", 7, 7, 2), item("darkmodern_c20_neonlight", 6, 7, 0),
      item("modern_c17_lamp", 7, 2, 0, 1, 1.3),
      naParede("pixel_clock_black", 6, 0, 1.4), naParede("pixel_painting_red", 7, 0, 1.2),
    ],
    // Produção: cadeira de estúdio, segundo monitor, caixas de som, rádio na
    // prateleira, revistas na mesinha, pilha de livros e o disco na parede.
    producao: [
      item("studio_chair", 3, 1, 4), item("studio_chair", 2, 5, 0), item("studio_chair", 4, 5, 0),
      // Prateleira baixa no fundo com o rádio em cima; caixas de som na parede
      // da direita com a frente para a sala. (A grua de câmera saiu: o braço
      // dela cruzava a janela e a mesa numa sala de 8×8.)
      item("hygge_c25_desklamp", 4, 3, 2, 1, 0.95), item("uni_laptop", 2, 2, 0, 0, 0.95),
      item("cubie_shelf_2_p", 6, 0, 0), item("hc_radio", 6, 0, 4, 1, 1.05),
      item("darkmodern_c20_speakers", 7, 3, 0), item("darkmodern_c20_speakers", 7, 5, 0),
      item("darkmodern_c20_reads", 7, 2, 0, 0, 1.3), item("bookpile", 0, 5, 0),
      item("bohogarden_c21_snakeplant", 0, 6, 2),
      naParede("uni_vinyl", 7, 0, 1.6),
    ],
  };
  return [...base, ...(temas[tema] || temas.atendimento)];
}
