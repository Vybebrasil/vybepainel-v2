-- Loja do Escritório, fase 2: raridade, estoque, vitrine semanal e marcos no
-- servidor. Revisar e aplicar explicitamente. Plano: docs/escritorio-pontos.md.
-- Lista de faixas gerada por scripts/escritorio-raridades.mjs; depois de
-- aplicada, a tabela é a autoridade (trocar faixa, preço ou estoque é UPDATE).
BEGIN;
-- Faixas: preço, estoque padrão por móvel (NULL = sem limite) e vagas na
-- vitrine da semana (0 = sempre à venda).
CREATE TABLE IF NOT EXISTS vybe_escritorio_raridades (
 chave text PRIMARY KEY CHECK (chave IN ('comum','raro','muito_raro','lendario')),
 nome text NOT NULL, ordem integer NOT NULL,
 preco integer NOT NULL CHECK (preco >= 0),
 estoque integer CHECK (estoque > 0),
 vitrine integer NOT NULL DEFAULT 0 CHECK (vitrine >= 0)
);
INSERT INTO vybe_escritorio_raridades(chave,nome,ordem,preco,estoque,vitrine) VALUES
 ('comum','Comum',1,25,NULL,0),
 ('raro','Raro',2,120,10,0),
 ('muito_raro','Muito raro',3,500,3,6),
 ('lendario','Lendário',4,1500,1,2)
 ON CONFLICT (chave) DO NOTHING;
-- Só os móveis que não são comuns. estoque/preco NULL = padrão da faixa;
-- `marco` = não se compra, vem com o marco (chave em server/escritorio-marcos.js).
CREATE TABLE IF NOT EXISTS vybe_escritorio_catalogo (
 classe text PRIMARY KEY,
 raridade text NOT NULL REFERENCES vybe_escritorio_raridades(chave),
 estoque integer CHECK (estoque > 0),
 vendidos integer NOT NULL DEFAULT 0 CHECK (vendidos >= 0),
 preco integer CHECK (preco >= 0),
 marco text
);
-- raro: 752 móveis
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'LT_pillar','ads_aftv_footballtable','antibully_machine','antique_c21_pennyfarthing','antique_c21_wallclock','arabian_tray2','arcade_c23_arcadefloor','arcade_c23_pinball','arcade_c23_vrmachine','arcade_c23_vrplatform','army15_largescreen','army_c15_deskcomp',
 'army_c15_doorscan','army_c15_groupflag','army_c15_screen','army_c15_telemine','art_c20_drawingtablet','attic15_oillamp','attic15_window','band_c19_drums','band_c19_guitar','bathroom_poop','bathroom_shower1','bathroom_shower2',
 'bathroom_shower3','bathroom_shower4','bathroom_toilet1','bathroom_toilet2','bathroom_toilet3','bathroom_toilet4','bazaar_c17_bubblejuiceblower','bazaar_c17_flycarpet','bazaar_c17_lamp','bazaar_c17_lampblue','bazaar_c17_lampbluepinktrim','bazaar_c17_lampgreen',
 'bazaar_c17_lampgreenpurpletrim','bazaar_c17_lampmystic','bazaar_c17_lamppink','bazaar_c17_lamppinkbluetrim','bazaar_c17_lamppurple','bazaar_c17_lamppurpleyellowtrim','bazaar_c17_lampyellow','bazaar_c17_lampyellowbluetrim','bb_cargobox','bb_caterhead','bb_crchair','bb_crchair2',
 'bb_crchair3','bb_crnr','bb_dragon','bb_ducklight','bb_gate_g','bb_robo','bb_score_b','bb_score_g','birds_r18_cardinal','bohogarden_c21_candlebowl','bohogarden_c21_fireheater','bohogarden_c21_glasslantern',
 'bolly_cherry','bolly_wdw_wd','booster_c19_box1','booster_c19_box2','boutique_lampwall','br_c25_bikes','br_c25_building2','br_c25_caramelodog','br_c25_cocoatree','br_c25_dvdr','br_c25_faunacrateb','br_c25_festivalflags',
 'br_c25_floracrate','br_c25_floracrateb','br_c25_lilies3','br_c25_monkeybzn_pole','br_c25_orchids3','br_c25_passionflower3','br_c25_toucan3','br_phoenix','br_r25_ipetree','bubblejuice_c21_neonsign','bubblejuice_c21_wall','bump_lights',
 'bw_bball','bw_nt_pool_a1','bw_nt_pool_a3','bw_pool_a1','bw_pool_a2','bw_pool_a3','bw_pool_b1','bw_pool_b2','bw_pool_b3','calippo','carnival15_hotair_brazil','catcafe_c23_boxcat',
 'catcafe_c23_cattree','catcafe_c23_conecat','catcafe_c23_counter','catcafe_c23_wallcat','celestial_c19_aurora','celestial_c19_floor','celestial_c19_flower','celestial_c19_moonbed','celestial_c19_wall','celestial_c21_lamp','china_lantern','cine_light1',
 'cine_nt_light1','cine_pillarlight','cine_popcorn','cine_tile','circus_c24_bluetentcrackable','circus_c24_cardhand','circus_c24_cardshat','circus_c24_clownballoon','circus_c24_clowncar','circus_c24_frank','circus_c24_redtentcrackable','circus_r24_clownmirror',
 'cland_c15_gate','cland_c15_gatepink','cland_c15_goofloor','cland_c15_jellyseat1','cland_c15_jellyseat2','cland_c15_jellyseat3','cland_c15_light','classic2_drinkmach','classic5_speaker','classic5_window','classic6_food','classic7_c21_neonlights',
 'classic7_djbooth','cloud_c23_tower','cmp_fish_b','cmp_fish_bk','cmp_fish_gr','cmp_fish_r','cmp_fish_s','cmp_nobox','cmp_nobox_2','cmp_nobox_3','cny16_monkeyballoon','cny17_roosterballoon',
 'cny18_dogballoon','cny_sheepballoon','coco_divan','coco_divan_c2','coco_divan_c3','coco_divan_c4','coco_table2','coffee_cup','coralking_c18_bubbleseat','coralking_c18_kelppillar','coralking_c18_neoncoral1','coralking_c18_neoncoral2',
 'coralking_c18_neoncoral3','coralking_c18_treasurechest','costume_gate','country_fp','country_lantern','cpunk_c15_neoarrow','cpunk_c15_neoarrowup','cpunk_c15_neond','cpunk_c15_neonx','cpunk_c15_searchlight','cpunk_c15_stool','cpunk_c15_traffic',
 'cpunk_c15_tubes','cpunk_r20_augchair','creator_streamtable','darkmodern_c20_floorlight','darkmodern_c20_neonlight','darkmodern_c20_pug','darkmodern_c20_tubelights','dimmer_fuse6','dimmer_steampunk','disco_c26_block','disco_c26_blueglitterbomb','disco_c26_candyheart',
 'disco_c26_craftingdiscoduck','disco_c26_discoball','disco_c26_discoballb','disco_c26_floor','disco_c26_glitterball','disco_c26_greenglitterbomb','disco_c26_jukebox','disco_c26_neonlight1','disco_c26_neonlight2','disco_c26_neonlight3','disco_c26_pinkglitterbomb','disco_c26_purpleglitterbomb',
 'disco_c26_redglitterbomb','disco_c26_silverglitterbomb','disco_r26_discoturntable','disco_r26_sharkzone','drago_c15_flag','dream_c24_cloudplant','dream_c24_dreammirror','dream_c24_dreammirrorb','dream_c24_jellywishcrafting','dream_c24_storybook','dream_c24_storybookb','dream_c24_waterfloor',
 'dream_r24_cloudtree','ducket_c25_autumnwindow','ducket_c25_rainbowwasher','ducket_c26_autumncandle','ducket_c26_cottagecandle','ducket_c26_picnicbasket','es_epictree','es_geysir','es_puck','es_score_b','es_skating_ice','es_tagging',
 'exe_c15_telephone','exe_copier','exe_sensor','exe_wrkdesk','exotic_r17_treefrog','fall_c23_deluxebasket','fall_c23_picnicbasket','fall_r23_treebench','fantasy_c22_treasure1','fantasy_c22_treasure2','farm_c21_pizzaoven','fest_c19_amp',
 'fest_c19_bprintcrackable','fest_c19_dj','fest_c19_flags','fireworks_08','fireworks_10','fireworks_12','football12_de','football12_es','football12_it','football12_pt','fxbox_fx116','fxbox_fx123',
 'fxbox_fx125','fxbox_fx126','fxbox_fx127','fxbox_fx14','fxbox_fx143','fxbox_fx147','fxbox_fx152','fxbox_fx153','fxbox_fx16','fxbox_fx183','fxbox_fx192','fxbox_fx238',
 'fxbox_fx239','fxbox_fx240','fxbox_fx241','gacha_c25_gachamachine','gacha_c25_royalgacha','gaming_c18_hswap','garden15_lawnmower','garden_birdbath','garden_c15_shroomchr','garden_caterpillar','garden_flolamp','garden_pond',
 'garden_staringbush','garden_volcano','gate_of_eternity','gothic15_toilet','gothic_c15_toilet','gothic_candles','gothic_st_glass','gothiccandelabra','graffiti_c24_craftingtable','graffiti_c24_tv','graffiti_c24_tvb','graffiti_r24_arcademachine',
 'greek_c15_lamp','greek_r19_tiledbath','grunge_candle','grungelamp','hal_cauldron','hblooza14_ballsign','hblooza14_bundkiosk','hblooza14_duck_balloon_b','hblooza14_duck_balloon_p','hblooza14_duck_balloon_y','hblooza14_duckgate','hblooza14_flagpole',
 'hblooza14_flagpole_p','hblooza14_hotair_b','hblooza14_hotair_p','hblooza14_hotair_y','hblooza14_mud','hblooza14_pinata2','hblooza14_pinata3','hblooza14_pinata4','hblooza14_track','hblooza14_track_crl','hblooza14_track_crr','hblooza_chicken',
 'hblooza_guitar1','hblooza_guitar2','hblooza_guitar3','hblooza_guitar4','hblooza_guitar5','hblooza_guitar6','hblooza_guitar7','hblooza_guitar8','hblooza_guitar9','hblooza_pillar1','hblooza_popcorn','hblooza_tfnc_1',
 'hcamme','hhistory_c24_cactus','hhistory_r16_crackable','hhistory_r17_crackable','hhistory_r18_crackable','hobbies_c26_boardgamescrackable','hobbies_c26_boardgamescrackableb','hobbies_c26_dmscreen','hobbies_c26_gardeningcrackable','hobbies_c26_sewingcrackable','hockey_light','hockey_score',
 'hole2','hosptl_xray','hotel_c18_pool','hs_applause','hs_box','hs_prop','hw08_xray','hw_08_xray','hygge_c18_stove','hygge_c25_kitchensink','hygge_c25_remote','hygge_c25_toiletsink',
 'hygge_c25_tv','hygge_c25_washer','hygge_r18_fox','hygge_r25_toastcat','igor_seat','india_c20_blueprint','india_c20_headjewelbp','india_c20_sewingmachine','industrialfan','jetset_vipscreen','jetset_vipscreencr','jetset_yacht_mid_3',
 'jp_c15_teapot','jp_c22_mistybg','jp_ceiling_lamp','jp_irori','jp_lantern','jp_r22_onsenpool','js_r16_boat','js_r16_jelly','jukebox_big','jungle_c16_flowera1','jungle_c16_flowera2','jungle_c16_flowera3',
 'jungle_c16_flowerb1','jungle_c16_flowerb2','jungle_c16_flowerb3','jungle_c16_flowerc1','jungle_c16_flowerc2','jungle_c16_flowerc3','jungle_c16_flowerd1','jungle_c16_flowerd2','jungle_c16_flowerd3','jungle_c16_light','jungle_c16_radio','jungle_c16_tallgrass',
 'jungle_c16_worktable','jungle_r16_basket','jungle_r16_pitcherplant','ktchn10_pot','ktchn10_sink','ktchn10_tea','ktchn15_coffeemaker','ktchn_c15_microwave','ktchn_c15_sink','ktchn_c15_stove','ktchn_hlthNut','ktchn_inspctr',
 'ktchn_sink','ktchn_stove','lamp2_armas','laundry_c18_washmachine','lc_medusa1','lc_medusa2','lc_tubes_corners','lc_tubes_straight','lido_kiosk','lm_jackbox','lodge_c15_window','lodge_dark_candle',
 'lodge_dark_fireplace','lodge_dark_tv','lodge_dark_window','lodge_tv','lt_c15_tree','lt_c26_banana','lt_c26_bobbapoof','lt_c26_boulder','lt_c26_junglehole','lt_c26_trunkswing','lt_r26_crackable','lt_r26_icecream',
 'mafia_c26_designer','mafia_c26_firepit_white','mafia_c26_magazines','mafia_c26_teleport_white','mafia_r26_globe','mafia_r26_moneytile','magitech_c22_shelf','magitech_c22_testtubes','magitech_r22_bigtube','market_c19_checkoutdesk','matic_dispenser','matic_tree_blue',
 'matic_tree_green','matic_tree_red','matic_tree_silver','matic_tree_yellow','matic_water_dispenser','merger_chest','messy_c21_kitchenette','mexico_c24_deluxepinatab','mexico_c24_pinata','mexico_c24_pinatab','mini_c24_hotairballoon','mm_lemon_drink',
 'modern_c17_iscreen','modern_c17_speakers','modern_c17_tv','mushroom_c21_crackable','mushroom_c21_crackableB','mushroom_c21_shelves','mushroom_r21_magicmirror','mushroom_r21_teapot','mutearea_sign2','mystics_bbed','mystics_btable','mystics_btile1',
 'mystics_gbed','mystics_gtable','mystics_gtile1','neonpunk_c20_bed','neonpunk_c20_bedsidetable','neonpunk_c20_bows','neonpunk_c20_candylights','neonpunk_c20_carpet','neonpunk_c20_cubeseat','neonpunk_c20_cupboard','neonpunk_c20_dresser','neonpunk_c20_floor',
 'neonpunk_c20_food','neonpunk_c20_lamp','neonpunk_c20_lights','neonpunk_c20_plushie2','neonpunk_c20_plushie3','neonpunk_c20_plushiepile','neonpunk_c20_sofa','neonpunk_c20_stardeco','neonpunk_c20_stool','neonpunk_c20_storage','neonpunk_c20_strawberries','neonpunk_c20_table',
 'neonpunk_c20_unicornposter','neonpunk_c20_wall','neopets_c25_crackableegg','neopets_c25_moneytree','neopets_c25_rainbowpool','nouvelle_trax','nov_c25_happytree','ny16_crackable','ny17_crackable','ny18_crackable','ny2015_balloons','ny2015_conball',
 'ny_c16_sign','ny_r18_crackable','ny_r19_crackable','ny_r20_crackable','ny_r21_crackable','ny_r22_crackable','ny_r23_crackable','ny_r24_crackable','ny_r25_crackable','nyc_c23_bag2','nyc_c23_buildingred','nyc_c23_diner',
 'nyc_c23_financeguy','nyc_c23_mailbox','nyc_c23_pizzeria','nyc_c23_roaditem2','nyc_c23_signs','nyc_c23_starterstall','nyc_c23_steakhouse','nyc_r23_sharkpuppy','nyc_r23_yellowbus','obstacle_bush','olympics_c16_treadmill','olympics_c16_veggiething',
 'olympics_r16_vendingmchn','olympus_c25_pandorasboxb','olympus_c25_pandorasboxcrackable','olympus_r25_lightninginabottle','patch_cloud','pcnc_carp','penguin_ballet','penguin_boxer','picnic_3brds','pj_c26_pillowcrackable','public_x_tile','rainbow_c19_bed',
 'rainbow_c19_chair','rainbow_c19_rug','rainbow_c21_crackable1','rainbow_c21_crackable2','rainyday_c19_cocoa','rainyday_c19_rainwindows','rainyday_c20_coathanger','rainyday_c20_homebakes','rainyday_c20_scentedcandles','ranch_c26_small_duckbergine','ranch_c26_small_duckbergineb','ranch_c26_small_tomato',
 'ranch_c26_sunset','ranch_c26_workbench','rcandle','rcandleset','rclr_garden','rclr_lamp','recycler_mantelclock','rela_candle1','rela_candle2','rela_candle3','rela_candle4','rela_candle5',
 'rela_candle6','rela_candles1','rela_candles2','rela_candles3','romantique_clock','runway_fan','s_snowball_machine','sanrio_c22_chococatclock','sanrio_c22_chococatvanity','sanrio_c22_kuromicake','sanrio_c22_twinstarsballoons','santorini_c17_rockpool',
 'santorini_r17_chest','sc26_flyingbook','sc_snowglobe2','sc_snowglobe3','school_c22_cello','school_c22_crackable','school_c22_xylophone','school_floor','school_locker_b_nosale','school_locker_r_nosale','school_platform','school_stuff_01',
 'school_stuff_02','school_toilet_stall','school_urinal','scifi_r17_bed','sculptures_r25_doveseat','seaside_c26_bubblepop','seaside_c26_chest','seaside_c26_tentacles','sf_stick','skorea_c22_idolbox','skorea_c22_idolbox2','skorea_c22_outdoortable',
 'skorea_r22_bukdrum','skullcandle','smiley_c23_hotair','smiley_c23_whoopeecushion1','smiley_c23_whoopeecushion2','smiley_c23_whoopeecushion3','smiley_c23_whoopeecushion4','snowb_light1','snst_block1','snst_fence','snst_tree1','snst_tree1_d',
 'song_disk','spa_c20_bath','spa_c20_bbcharcoal','spa_c20_bbcitrus','spa_c20_bbmint','spa_c20_bbrose','spa_c20_crackable1A','spa_c20_crackable2A','spa_c22_candle','space_c23_planetbackground','spotlight','st_hween14_mbox',
 'st_palooza_balloons','st_palooza_pool','st_palooza_unicorn','st_uni_labtable','stackable_water','starting_position','steampunk_computer','steampunk_lamp','steampunk_pillar_2','steampunk_rack','steampunk_timemach','steampunk_wall1',
 'steampunk_window','stellar_c23_mooncraftingtable','stellar_c23_spacechair','stellar_c23_starcageb','stellar_r23_startree','stellar_r23_ursaminor','stories_football_board','stories_football_screen','stories_football_table','stories_oldmusic_guitarcase','stories_oldmusic_neon','stories_sch_glass',
 'studio_drums','studio_floorlight','studio_guitar','studio_mixingdesk','studio_monitor','studio_tv','summer_blaster','suncity_c19_tree','suncity_c19_waterway','suncity_c19_waterwaycrnr','suncity_c21_beehive','suncity_r19_biosphere',
 'sunsetcafe_c20_coffeemachine','sunsetcafe_c20_lightupfloor','survival_c26_dystopiafence','survival_c26_dystopiawall','survival_c26_foliagefloor','survival_c26_surveillancetree','survival_r26_scifispeakercorner','svnr_de','test_builder_placeholder','testtubetv1','testtubetv2','thai_c21_candledish',
 'thai_c21_indoorstove','thai_c21_woodcarvingset','thai_r21_clothingbox','theatre_seat','theatre_seat_b','theatre_seat_g','tiki_c15_wall','tiki_torch','tile_fxprovider_nfs','tokyo_c18_craftbot','tokyo_c18_gacha','tokyo_c18_gamesign',
 'tokyo_c18_neonsign1','tokyo_c18_neonsign2','tokyo_c18_racearcade','tokyo_c18_retroarcade','tokyo_c18_retroarcade2','tokyo_r18_koikite','torch','totem_head','totem_leg','track12_hcauldron','track12_hurdle','track12_mini_torch',
 'traxbronze','traxsilver','tree6','triplecandle','uni_alarm','uni_brotein','uni_doorhanging','uni_drinks','uni_dumbells','uni_gamerdesk','uni_games','uni_laptop',
 'uni_owl','uni_plush1','uni_projector','uni_rubik','vikings_torch','vote_count_add','vote_machine','vote_majority','vwave_c21_barstool','vwave_c21_bench','vwave_c21_brokentech','vwave_c21_buildings',
 'vwave_c21_cctv','vwave_c21_glitchbuildings','vwave_c21_glitchpalm','vwave_c21_glitchrailcrnr','vwave_c21_glitchrailing','vwave_c21_glitchsunsetbg','vwave_c21_glitchwall','vwave_c21_neonsigns','vwave_c21_pc','vwave_c21_railcrnr','vwave_c21_rubiks','vwave_c21_sunsetbg',
 'vwave_c21_wall','vwave_r21_jukebox','waasa_ship1','waasa_ship2','wall_ph','wcandle','wcandleset','wildwest_cabinet','wildwest_light','wildwest_minecart','wildwest_pump','winter_r24_snowtree',
 'wisp_c23_starflower','wonderland_c25_crackable','wonderland_c25_crackableb','wonderland_c25_hattercrafting','wonderland_c25_redcrackable','wonderland_c25_redcrackableb','wonderland_c25_spadecardguard','wonderland_c25_talkingflowers','wonderland_r25_mirrortele','yarn','year2010','year2011',
 'year2012','year2013','year2014','year2018','year2019','year2020','year2021','year2022','year2023','year2024','year2025','year2026',
 'yttv1','yttv2','yttv2b','yttv2n','yttv3','yttv_retro','zengarden_c18_glasspond','zengarden_c20_glasspond']),'raro' ON CONFLICT (classe) DO NOTHING;
-- muito_raro: 286 móveis
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'anc_artifact3','army15_statue','army_c15_leatherchr','art_c20_gold4','art_c20_gold5','attic15_clock','bazaar_r17_fountain','bling11_big1','bling11_block','bling11_dvd','bling11_dvn','bling11_floor',
 'bling11_pillar','bling11_plant','bling11_rug1','bling11_rug2','bling11_seat1','bling11_seat2','bling11_slot','bling11_sofa','bling11_statue1','bling11_statue2','bling11_wall1','bling11_wall2',
 'bling11_wall3','bling11_wall4','bling15_pooltable','bling_bed','bling_c15_chandalier','bling_c15_wall','bling_cabinet','bling_chair_a','bling_chair_b','bling_chair_c','bling_fridge','bling_fridge_restricted',
 'bling_pool','bling_sink','bling_sofa','bling_sofa_mu','bling_toilet','bolly_fountain','bolly_lamp','boutique_hcsign','china_dog','china_goat','china_goldenhorse','china_goldenox',
 'china_goldenpig','china_goldenrabbit','china_goldenrat','china_goldensnake','china_goldentiger','china_horse','china_monkey','china_ox','china_pig','china_rabbit','china_rabbitstatue','china_rat',
 'china_rooster','china_snake','china_tiger','china_tigerstatue','cine_curtain','cine_platform','cine_projector','cine_roof','cine_screen','cine_ticket_booth','cine_vipsign','cland15_fountain',
 'classic8_bar','classic8_chair','classic8_disco','classic8_divider','classic8_floor','classic8_glassfloor','classic8_pillar','classic8_plant','classic8_rug','classic8_shelf','classic8_sign','classic8_sofa',
 'classic8_statue','classic8_wall','classic9_statue','cmp_fish_g','coralking_r18_goldenchest','darkelegant_c20_light','darkelegant_c20_lionstatue','disco_c26_goldglitterbomb','ducket_c26_honeyfountain','exe_c15_printer','exe_c15_wall','exe_drinks_cabinet',
 'exe_glassdvdr','exe_globe','exe_icecream','exe_rug','exe_wfall','fantasy_r22_herostatue','garden_lupin1','garden_mursu3','garden_r21_plantwall','gothic_bowl','gothic_c15_chandelier','gothicfountain',
 'gothicfountain2','greek_c19_statue','hc23_5','hc23_6','hc24_12','hc24_3','hc26_1','hc26_11','hc26_12','hc26_2','hc26_3','hc26_4',
 'hc26_5','hc26_6','hc26_7','hc26_8','hc26_9','hc2_armchair','hc2_barchair','hc2_biglamp','hc2_carpet','hc2_cart','hc2_coffee','hc2_divider',
 'hc2_dvn','hc2_sofa','hc2_sofatbl','hc2_vase','hc3_bard','hc3_dc','hc3_divider','hc3_hugelamp','hc3_light','hc3_shelf','hc3_sofa','hc3_stool',
 'hc3_table','hc3_vase','hc3_walldeco','hc_arab_bigtb','hc_arab_chair','hc_arab_divdr','hc_arab_pllw','hc_arab_rug','hc_arab_swords','hc_arab_tetbl','hc_arab_tray3','hc_arab_wndw',
 'hc_bigvase','hc_bkshlf','hc_btlr','hc_cab','hc_chr','hc_crpt','hc_djset','hc_dsk','hc_exe_chair','hc_exe_chair2','hc_exe_cubelight','hc_exe_glassdvdr',
 'hc_exe_light','hc_exe_s_table','hc_exe_sofa','hc_exe_table','hc_exe_wfall','hc_exe_wrkdesk','hc_lmp','hc_lmpst','hc_machine','hc_radio','hc_rntgn','hc_roundchair',
 'hc_roundtable','hc_tbl','hc_tv','hc_wall_lamp','hcc_chair','hcc_crnr','hcc_dvdr','hcc_minibar','hcc_shelf','hcc_sofa','hcc_sofachair','hcc_stool',
 'hcc_table','hotel_c18_fountain','jetset_tub','js_bling11_dvn','js_bling11_seat1','js_bling11_seat2','js_bling11_sofa','js_bling_bed','js_bling_chair_w','js_bling_fridge','js_chandelier','js_exe_wfall',
 'lc_window2','lodge_chandelier','lodge_dark_chandelier','lt_c26_coin','lt_c26_goldenstatue','lt_c26_monkey1','lt_c26_monkey2','lt_c26_monkey3','lt_c26_monkey4','lt_c26_monkey5','lt_c26_stonefountain','lt_c26_tigerstatue',
 'lt_c26_toucanstatue','lt_r26_fountain','lt_r26_gemstatue','lt_statue','mafia_c26_jacuzzi_dark','mafia_c26_jacuzzi_white','mafia_c26_vintagechair','mafia_c26_vintagedesk','mini_c24_fountain','mode_gold_bar','mode_gold_bookcase','mode_gold_ceilinglight',
 'mode_gold_diningchair','mode_gold_fridge','mode_gold_largecoffeetable','mode_gold_largediningtable','mode_gold_largetable','mode_gold_smallcoffeetable','mode_gold_zshelf','mystics_btile2','mystics_ltstatue','mystics_rfountain','ny2015_chocfountain','olympus_r25_zeusstatue',
 'pcnc_fountain','ranch_r26_statue','recycler_cdclockB','reef_aquarium','regalblack_c25_goldenpillow','santorini_r17_centaur','santorini_r17_chimera','santorini_r17_hydra','santorini_r17_minotaur','sc_elvenstatue1','sc_elvenstatue2','sc_elvenstatue3',
 'school_fountain','sp_statue','st_wildwest_buffalo','st_wildwest_goldpick','statue','statue_elk','statue_griffin','stories_shakespeare_fairy','suncity_r19_glassfountain','tablet_vendorg','thai_c21_woodenstatue','thai_r21_waterfalltree',
 'tiki_statue','track12_javstatue','traxgold','uni_c23_fabricposter5','uni_c23_smartduck','uni_c23_teddy5','waasa_aquarium','wildwest_piano','window_golden','winter15_freeze','winter15_icehockey','winter15_iceskater',
 'winter15_lmppst','winter15_snowboard','winter15_tree4','wintercabin_c19_antlerlight','wonderland_c25_redroseclock','wonderland_c25_whiteroseclock','zengarden_c18_peacefrog','zengarden_c20_goldenmobile','zengarden_c20_peacedog','zengarden_r18_fountain']),'muito_raro' ON CONFLICT (classe) DO NOTHING;
-- lendario: 59 móveis
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'LT_throne','anniversary_r18_throne','arcade_cab','bazaar_r17_monkey','bazaar_r17_throne','cland15_candythrone','cloud_throne','coco_throne','coco_throne__c2','coco_throne_c3','coco_throne_c4','crystal_throne',
 'dng_throne','ducket_c26_minilighthouse','easel_2','easel_3','easel_4','gold_c15_arc_chair','gold_c15_arc_div1','gold_c15_arc_icerug','gold_c15_arc_icewall','gold_c15_arc_lamp','gold_c15_arc_lantern','gold_c15_arc_seat',
 'gold_c15_arc_statue','gold_c15_arc_table','gold_c15_arc_tree1','gold_c15_arc_tree2','gold_c15_arc_tub','gold_rare_crackable','hblooza_guitar11','hcsohva','india_ltd20_sultanthrone','legotrophy','lt_ltd26_woodjuicedispenser','mini_c24_cakethrone3',
 'mystics_bthrone','mystics_gthrone','paris15_ltdfountain','rainbow_ltd22_elephant_statue','ranch_r26_pumpkinthrone','regalblack_r25_sohva','royal_chair','santorini_c17_lighthouse','santorini_ltd17_lighthouse','school_chairgold','school_consolegold','school_ltd22_treehouse',
 'se_trophyG','se_trophyS','seaside_c26_lighthouse','thai_ltd21_yakgodstatue','throne','trophy_ltd23_goldmonsterplant','trophy_ltd23_silvermonsterplant','uni_lectern','uni_ltd23_goldenfountain','vwave_ltd21_lambo','wonderland_c25_cardthrone']),'lendario' ON CONFLICT (classe) DO NOTHING;
-- Móveis que só se ganham por marco (não aparecem à venda).
UPDATE vybe_escritorio_catalogo SET marco=v.marco FROM (VALUES
 ('trophy_ltd23_goldmonsterplant','duzentas'),('se_trophyS','quinhentas'),('legotrophy','maratona'),
 ('trophy_ltd23_silvermonsterplant','semfuro'),('se_trophyG','nivel20'),('school_consolegold','meta4')) AS v(classe,marco)
 WHERE vybe_escritorio_catalogo.classe=v.classe;
-- Marcos conquistados (o móvel do marco entra no inventário junto, uma vez).
CREATE TABLE IF NOT EXISTS vybe_escritorio_marcos (
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id), marco text NOT NULL,
 em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (pessoa_id,marco)
);
-- Mesmo gatilho da fase 1, sem as conquistas de 1ª/5ª/10ª demanda: os marcos
-- do servidor (server/escritorio-marcos.js) passam a contar toda entrega.
CREATE OR REPLACE FUNCTION vybe_pontuar_evento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record; recibo bigint; executor bigint; para text; de text; dia date; no_prazo boolean; autor_funcao text;
BEGIN
 SELECT id,board_id,prazo,briefing INTO c FROM vybe_conteudos WHERE id=NEW.conteudo_id;
 IF c.id IS NULL THEN RETURN NEW; END IF;
 para := lower(trim(COALESCE(NEW.para,''))); de := lower(trim(COALESCE(NEW.de,'')));
 dia := vybe_dia_bahia(COALESCE(NEW.em,now()));
 no_prazo := c.prazo IS NOT NULL AND dia <= c.prazo;
 SELECT funcao INTO autor_funcao FROM vybe_escritorio_funcoes WHERE pessoa_id=NEW.autor_id;
 IF NEW.tipo = 'status' THEN
  -- 1 e 2: demanda de Solicitações finalizada, uma vez por demanda (recibo global).
  IF c.board_id=8385559107 AND para IN ('finalizado','feito') THEN
   INSERT INTO vybe_escritorio_demandas_premiadas(conteudo_id) VALUES(c.id) ON CONFLICT DO NOTHING RETURNING conteudo_id INTO recibo;
   IF recibo IS NOT NULL THEN
    FOR executor IN SELECT DISTINCT pessoa_id FROM vybe_conteudo_responsaveis WHERE conteudo_id=c.id ORDER BY pessoa_id LOOP
     PERFORM vybe_aplicar_regra(executor,'entrega','demanda:'||c.id,c.id,dia);
     IF no_prazo THEN PERFORM vybe_aplicar_regra(executor,'entrega_prazo','prazo:'||c.id,c.id,dia); END IF;
    END LOOP;
    PERFORM vybe_pontuar_carteira(c.id,dia);
   END IF;
  END IF;
  -- 3: a Criação mandou a peça para aprovação (primeira vez na peça). Sem
  -- responsável da Criação, vale quem mandou, se for da Criação.
  IF c.board_id=7829537690 AND para ILIKE 'para aprova%'
   AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_entregas WHERE regra='criacao_aprovacao' AND conteudo_id=c.id) THEN
   FOR executor IN
    SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id
    UNION SELECT NEW.autor_id WHERE autor_funcao='criacao' AND NOT EXISTS(
     SELECT 1 FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id)
    ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_aprovacao','aprovacao:'||c.id,c.id,dia);
    IF no_prazo THEN PERFORM vybe_aplicar_regra(executor,'entrega_prazo','prazo:'||c.id,c.id,dia); END IF;
   END LOOP;
  END IF;
  -- 4 e 6: aprovada sem nunca ter voltado para alteração.
  IF c.board_id=7829537690 AND para='para agendar'
   AND NOT EXISTS(SELECT 1 FROM vybe_conteudo_eventos a WHERE a.conteudo_id=c.id AND a.tipo='status' AND a.para ILIKE 'altera%' AND a.id<>NEW.id) THEN
   FOR executor IN SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_aprovada','aprovada:'||c.id,c.id,dia);
   END LOOP;
   PERFORM vybe_pontuar_carteira(c.id,dia);
  END IF;
  -- 5: voltou para alteração (no máximo uma vez por peça por dia).
  IF para ILIKE 'altera%' THEN
   FOR executor IN SELECT r.pessoa_id FROM vybe_conteudo_responsaveis r JOIN vybe_escritorio_funcoes f ON f.pessoa_id=r.pessoa_id AND f.funcao='criacao' WHERE r.conteudo_id=c.id ORDER BY 1 LOOP
    PERFORM vybe_aplicar_regra(executor,'criacao_alteracao','alteracao:'||c.id||':'||dia,c.id,dia);
   END LOOP;
  END IF;
  -- 7: agendou (saiu de Para agendar/Agendado para Agendado/Finalizado), quem fez.
  IF para IN ('agendado','finalizado') AND de IN ('para agendar','agendado') AND autor_funcao='agendamento' THEN
   PERFORM vybe_aplicar_regra(NEW.autor_id,'agendamento','agendou:'||c.id,c.id,dia);
  END IF;
 ELSIF (NEW.tipo='captacao' AND para ILIKE 'capta%feita') OR (NEW.tipo='material_bruto' AND NEW.para IS NOT NULL) THEN
  -- 8: captação feita ou material bruto entregue (primeira vez na peça).
  FOR executor IN SELECT pessoa_id FROM vybe_escritorio_funcoes WHERE funcao='producao' ORDER BY 1 LOOP
   PERFORM vybe_aplicar_regra(executor,'captacao','captacao:'||c.id,c.id,dia);
  END LOOP;
 ELSIF NEW.tipo='criacao' AND NULLIF(trim(COALESCE(c.briefing,'')),'') IS NOT NULL THEN
  -- 9: criada com briefing.
  PERFORM vybe_aplicar_regra(NEW.autor_id,'briefing','briefing:'||c.id,c.id,dia);
 END IF;
 RETURN NEW;
END $$;
COMMIT;
