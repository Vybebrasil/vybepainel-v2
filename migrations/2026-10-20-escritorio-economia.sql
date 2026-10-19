-- Nova economia do Escritório (pedido do Paulo, 19/10/2026: itens baratos
-- demais, dinheiro demais). Leitura do banco em 19/10: o ritmo normal dava de
-- 150 a 550 moedas por semana por pessoa, o bônus de chegada pôs de 350 a
-- 5.400 moedas de uma vez e um móvel comum custava 25. Regra nova
-- (docs/escritorio-pontos.md, "Economia de 20/10/2026"):
-- - XP não muda: continua premiando todo o trabalho e nunca cai.
-- - Moedas ficam mais raras (cerca de 100 por semana de trabalho normal).
-- - Cinco faixas de raridade (Paulo, 19/10/2026): comum, incomum, raro, épico
--   e lendário. O antigo "muito raro" vira épico; o catálogo inteiro é
--   sincronizado com scripts/escritorio-raridades.mjs, sem mexer nos móveis de
--   marco, nos preços e estoques próprios nem no que já foi vendido.
-- - Preço por tempo de trabalho: comum 2 dias, incomum 1 semana, raro 3
--   semanas, épico 2 meses, lendário 6 meses.
-- - Saldo de cada pessoa recalculado como se a regra nova valesse desde o
--   começo: cada lançamento do razão pelo valor novo da regra, bônus de chegada
--   a 1/4 e no máximo 500, compras e devoluções como foram. Um lançamento de
--   ajuste por pessoa explica a diferença; nunca abaixo de zero.
-- Aplicar uma vez, com o "Aprovado" do Paulo. Marcador economia-2026-10-20.
BEGIN;
LOCK TABLE vybe_escritorio_carteiras, vybe_escritorio_moedas, vybe_escritorio_regras, vybe_escritorio_raridades, vybe_escritorio_catalogo IN EXCLUSIVE MODE;

-- Cinco faixas. Pode rodar de novo: o resultado é o mesmo.
ALTER TABLE vybe_escritorio_raridades DROP CONSTRAINT IF EXISTS vybe_escritorio_raridades_chave_check;
ALTER TABLE vybe_escritorio_raridades ADD CONSTRAINT vybe_escritorio_raridades_chave_check CHECK (chave IN ('comum','incomum','raro','muito_raro','epico','lendario'));
INSERT INTO vybe_escritorio_raridades(chave,nome,ordem,preco,estoque,vitrine) VALUES
 ('incomum','Incomum',2,120,NULL,0),('epico','Épico',4,900,3,6)
 ON CONFLICT (chave) DO NOTHING;
UPDATE vybe_escritorio_raridades f SET ordem=v.ordem, nome=v.nome, preco=v.preco, estoque=v.estoque FROM (VALUES
 ('comum','Comum',1,40,NULL::int),('incomum','Incomum',2,120,NULL),('raro','Raro',3,300,10),('epico','Épico',4,900,3),('lendario','Lendário',5,2500,1)
) AS v(chave,nome,ordem,preco,estoque) WHERE f.chave=v.chave;
UPDATE vybe_escritorio_raridades SET vitrine=(SELECT vitrine FROM vybe_escritorio_raridades WHERE chave='muito_raro') WHERE chave='epico' AND EXISTS (SELECT 1 FROM vybe_escritorio_raridades WHERE chave='muito_raro');
UPDATE vybe_escritorio_catalogo SET raridade='epico' WHERE raridade='muito_raro';
DELETE FROM vybe_escritorio_raridades WHERE chave='muito_raro';
ALTER TABLE vybe_escritorio_raridades DROP CONSTRAINT vybe_escritorio_raridades_chave_check;
ALTER TABLE vybe_escritorio_raridades ADD CONSTRAINT vybe_escritorio_raridades_chave_check CHECK (chave IN ('comum','incomum','raro','epico','lendario'));
-- Catálogo pelas faixas novas (o que não está na lista é comum).
CREATE TEMP TABLE economia_faixas (classe text PRIMARY KEY, raridade text NOT NULL) ON COMMIT DROP;
-- incomum: 491 móveis
INSERT INTO economia_faixas(classe,raridade) SELECT unnest(ARRAY[
 'LT_pillar2','SF_lamp','ads_aftv_bag','ads_aftv_floorlight','ads_disney_tv','ads_drsports_fball_lamp','ads_drsports_fballvend','ads_idol_hotspot','ads_idol_lamp','ads_twi_fountn','ads_wowpball','antique_c21_lamp',
 'army_c15_light','art_c20_light','attic15_lamp','band_c19_drums','band_c19_guitar','bathroom_bath1','bb_cargobox','bb_caterhead','bb_crchair','bb_crchair2','bb_crchair3','bb_crnr',
 'bb_lightdiv','bb_lightstrip','bb_nt_lightdiv','bolly_monkey_lamp','bottle','br_c25_building2','br_c25_cocoatree','br_c25_dvdr','br_c25_festivalflags','br_c25_festivallanterns','br_c25_floracrateb','br_c25_lamppost',
 'br_c25_lilies3','br_c25_orchids3','br_c25_passionflower3','bubble_lamp1','bubblejuice_c21_light','circus_c24_hanginglights','circus_c24_spotlight','classic1_lamp','classic3_ticket','classic6_lantern','classic7_djbooth','classic7_starlight',
 'classic9_light','cn_lamp','console','cubie_lamp_b','cubie_lamp_p','darkelegant_c20_lamp','darkmodern_c20_bunnylight','diamond_painting48','dino_r22_meteorlight','disco_c26_block','disco_c26_candyheart','disco_c26_donutlight',
 'disco_c26_floornutlight','disco_c26_hexagonblue','disco_c26_hexagongreen','disco_c26_hexagonpink','disco_c26_hexagonpurple','disco_c26_hexagonyellow','disco_c26_ledtube','disco_c26_lightbarblue','disco_c26_lightbargreen','disco_c26_lightbarpink','disco_c26_lightbarpurple','disco_c26_lightbaryellow',
 'disco_c26_lightstick','dragonlamp_shinobi','dream_c24_puddle','ducket_c25_autumnlamp','ducket_c25_ducklamp','ducket_c26_glasslantern','easter14_block3','easter14_lamp','easter_c18_countryteaset','easter_c18_ivybeam','easter_c18_ivylight','easter_c18_radio',
 'easter_c19_flowerlamp','easter_c20_lightprize1','easter_c20_lightprize2','easter_c20_lightprize3','easter_c20_lightprize4','easter_c20_lightrock','easter_c20_lightrock1','easter_c21_hanginglight','easter_c21_lightplatform','easter_c22_pathlight','easter_c22_rockerylight','easter_c23_flowerlamp',
 'easter_c23_hanginglight','easter_c23_sunlightwindow','easter_c24_lightbunny','easter_c24_lightfruit','easter_c24_lightseed','easter_c24_lightseed2','easter_c24_shinylightbunny','easter_c24_shinylightfruit','easter_c24_teaset','easter_c25_hotairballoon','easter_c26_elvenfloorlamp','easter_c26_elvenhanginglight',
 'eco_lamp1','eco_lamp2','eco_lamp3','eco_light1','eco_light2','eco_light3','edice_nft_ff23_dicemachine','elegant_c17_light','es_lmppst','es_puck','exe_artlamp','exe_cubelight',
 'exe_light','fball_ball','fball_ball2','fball_ball3','fball_ball4','fball_ball5','fball_ball6','fball_c26_directionindicator','fball_c26_ptch11','fball_c26_trainingcone','fball_cote','fball_crnr',
 'fball_flag_grp','fball_fnc1','fball_fnc3','fball_goal_b','fball_goal_g','fball_goal_r','fball_goal_y','fball_grp_cote','fball_grp_crnr','fball_grp_fnc1','fball_light','fball_mascot',
 'fball_ptch0','fball_ptch1','fball_ptch2','fball_ptch3','fball_ptch4','fball_ptch5','fball_ptch6','fball_ptch7','fball_ptch8','fball_ptch9','fball_scales','fball_score_b',
 'fball_score_g','fball_score_r','fball_score_y','fest_c19_amp','fest_c19_lamp','fireworks_07','footylamp','footylamp_campaign','fruit_c21_cherrylamp','gaming_c18_cubelight','gaming_c18_setuppro','graffiti_c24_flashlight',
 'graffiti_c24_tvb','habbo20_c20_balloons','habbo25_c25_balloons','habbo25_c25_bdayballoon','habbo25_c25_bdayballoon2','habbo25_c25_bdayballoon2b','habbo25_c25_bdayballoonb','habbo25_c25_sparkler','hblooza_guitar1','hblooza_guitar2','hblooza_guitar3','hblooza_guitar4',
 'hblooza_guitar5','hblooza_guitar6','hblooza_guitar7','hblooza_guitar8','hblooza_guitar9','hhistory_c24_lavalamp1','hhistory_c24_lavalamp2','hhistory_c24_lavalamp3','hhistory_c24_lavalamp4','hhistory_c24_lavalamp5','hhistory_c24_lavalamp6','hobbies_c26_d10',
 'hobbies_c26_d12','hobbies_c26_d20','hobbies_c26_d4','hobbies_c26_d6','hobbies_c26_d8','hobbies_c26_dicetray','hobbies_c26_dmscreen','hobbies_c26_ornated10','hobbies_c26_ornated12','hobbies_c26_ornated20','hobbies_c26_ornated4','hobbies_c26_ornated6',
 'hobbies_c26_ornated8','hockey_score','hosptl_light','hs_lightstrip_blue','hs_lightstrip_pink','hween09_tv','hween10_ffly','hween10_jar','hween12_lantern','hween12_moon','hween12_orb','hween13_candle',
 'hween13_piglamp','hween13_sheep','hween13_teaset','hween14_candletrail','hween14_hangskull','hween14_skullcandle','hween14_skulllight','hween26_nt_curseddragonlamp','hween_c15_lamp','hween_c15_telewire','hween_c16_ghostvial','hween_c16_lamp',
 'hween_c16_lamp2','hween_c18_complexmchn2','hween_c18_dimlights','hween_c18_flashlight','hween_c18_labmchn2','hween_c19_bewitchedcandles','hween_c20_eyetv','hween_c20_lamp','hween_c21_lantern','hween_c22_darkcandles','hween_c22_gothiclamp','hween_c22_gothicteaset',
 'hween_c22_taintedlamp','hween_c23_cursedlightrays','hween_c23_walltorch','hween_c24_balloons','hween_c26_gothcandle','hween_c26_ivycandle','hween_r16_crackable2','hygge_c25_desklamp','hygge_c25_remote','icecream_c21_light','icedblk_c16_solarium','india_c20_light',
 'jp_c23_light','ktchn_c15_lamp_b','ktchn_c15_lamp_g','ktchn_c15_lamp_p','ktchn_light','kuurna_lamp','kuurna_red_lamp','lamp_armas','lamp_basic','lodge_dark_lamp','lt_c26_junglehole','mafia_c26_sidetable_white',
 'mafia_c26_tallwall_white','mafia_c26_wall_white','magitech_c22_lamp','market_c19_dvds','matic_light_cam_blue','matic_light_cam_green','matic_light_cam_orange','matic_light_cam_red','messy_c21_wonkylamp','minirare_dragonlamp_pink','mode_ceilinglight','modern_c17_floorlamp',
 'modern_c17_lamp','modern_c17_speakers','modern_c17_tv','nyc_c23_buildingred','nyc_c23_diner','nyc_c23_mailbox','nyc_c23_pizzeria','nyc_c23_roaditem2','nyc_c23_signs','nyc_c23_starterstall','nyc_c23_steakhouse','nyc_r23_yellowbus',
 'olympics_c16_light','org_lampblk','org_lamppnk','party_ball','party_discol','party_lantern','pastel_c19_lamp','pastel_c19_lights','pastel_c19_starlights','penguin_swim','pet_toy_ball','pirate_cannonballs',
 'pirate_mast2','pirate_mast2grp','pirate_mast3','pirate_mast3grp','pixel_light_black','pixel_light_blue','pixel_light_green','pixel_light_pink','pixel_light_red','pj_c26_nightlightbunny','pj_c26_nightlightcat','pj_c26_nightlightduck',
 'pj_c26_nightlightghost','pumpkin','pura_block_lamp1','purablk_c16_lamp1','purablk_c16_lamp2','purablk_c16_lamp3','qt_penguin_ballet','qt_val11_discoball','qt_xm10_monkey_lamp','rainbow_c19_lights','rainbow_c21_lightbulbheart','rainyday_c19_lamp',
 'ranch_c26_lightearth','ranch_c26_lightgate','random_tele_1','random_tele_2','rec26_paintlamp','recycler_dragonlamp','recycler_kintsugiB','recycler_tablelight','red_tv','rela_stick','rom_lamp','room_cof15_lamp1',
 'room_cof15_lamp2','room_gh15_ball','room_gh15_light','room_hall15_light1','room_info15_lamp1','room_noob_hanglight','runway_umbrellalight','s_snowball_machine','sanrio_c22_badtzlamp','sanrio_c22_chococatvanity','sanrio_c22_kuromilight','school_c22_cello',
 'school_c22_xylophone','school_floor','school_locker_b_nosale','school_locker_r_nosale','school_platform','school_stuff_01','school_stuff_02','skorea_c22_electricpole','skorea_c22_lanterns','skorea_c22_lightstick1','skorea_c22_lightstick2','skorea_c22_lightstick3',
 'snst_block1','snst_fence','solarium_norja','song_disk','sound_set_3','sound_set_37','space_c23_floorlights','starting_position','steampunk_computer','stories_oldmusic_guitarcase','stories_oldmusic_mike','stories_oldmusic_vinyl',
 'studio_guitar','studio_lights1','studio_lights2','studio_lights3','studio_monitor','summer_c17_promenadelamp','suncity_c19_awning','suncity_c19_balcony','suncity_c19_building','suncity_c19_flora','suncity_c19_gazebo','suncity_c19_glasswall',
 'suncity_c19_lamp','suncity_c19_minibridge','suncity_c19_perfumeshop','suncity_c19_streetlight','testtubetv1','testtubetv2','thai_c21_strawlamp','theatre_lights','theatre_spotlight','tokyo_c18_bigbillboard','tokyo_c18_lanterns','tokyo_c18_lights',
 'tv_flat','tv_luxus','uni_brotein','uni_c15_lamp','uni_drinks','uni_dumbells','uni_games','uni_laptop','uni_owl','uni_plush1','uni_projector','urban_lamp',
 'usva2_lamble','usva2_lamp','usva3_lamble','usva3_lamp','usva4_lamble','usva4_lamp','usva5_lamble','usva5_lamp','usva5_nt_lamp','usva_lamble','usva_lamp','val12_hopper1',
 'val12_lantern','val12_pillar2','val13_lamp','val13_light','val14_lamp','val15_lantern','val15_tea','val16_float1','val_c20_lights','vwave_c21_barstool','vwave_c21_bench','vwave_c21_brokentech',
 'vwave_c21_buildings','vwave_c21_cctv','vwave_c21_glitchpalm','vwave_c21_glitchrailcrnr','vwave_c21_glitchrailing','vwave_c21_railcrnr','vwave_c21_wall','wildwest_weed','wintercabin_c19_lamp','wonderland_c25_heartcardguard','xmas08_lantern','xmas11_balloon',
 'xmas11_balloon1','xmas11_balloon2','xmas11_balloon3','xmas12_snack','xmas13_eggnogglass','xmas13_light','xmas14_lights1','xmas14_lights2','xmas14_starfish','xmas_c15_mlight','xmas_c16_candles','xmas_c16_deskcandles',
 'xmas_c16_pillarlight','xmas_c17_doll6','xmas_c17_lamp','xmas_c18_balllight','xmas_c18_fairylightree','xmas_c18_groundlight','xmas_c18_iciclelight','xmas_c18_rainlightfloor','xmas_c18_snowballpit','xmas_c18_stocking_boo','xmas_c18_streetlight','xmas_c19_lamp',
 'xmas_c19_stackedicedrinks','xmas_c20_beadgame','xmas_c21_advent8','xmas_c21_tiffanylamp','xmas_c22_hangingwalllights','xmas_c22_stonelight','xmas_c22_xmaslighthanging','xmas_c24_batterycandle','xmas_c24_baubletrap','xmas_c24_ducktrapgame','xmas_c24_pogoball','xmas_c25_tree2a',
 'xmas_c25_tree2b','xmas_c25_tree2c','xmas_c25_treelights','xmas_icelamp','xmas_r17_musicbox','yttv1','yttv2','yttv2b','yttv2n','yttv3','yttv_retro']),'incomum' ON CONFLICT DO NOTHING;
-- raro: 741 móveis
INSERT INTO economia_faixas(classe,raridade) SELECT unnest(ARRAY[
 'LT_pillar','ads_aftv_footballtable','ads_calip_pool','ads_capri_arcade','ads_gsArcade_1','ads_gsArcade_2','antibully_machine','antique_c21_pennyfarthing','antique_c21_wallclock','arabian_tray2','arcade_c23_amiami','arcade_c23_arcadefloor',
 'arcade_c23_cupcakeduck','arcade_c23_cyberpunk','arcade_c23_duckhunt','arcade_c23_pinball','arcade_c23_quackaduck','arcade_c23_space','arcade_c23_spinthewheel','arcade_c23_vrmachine','arcade_c23_vrplatform','arcade_r23_bearbot','arcade_r23_candyroo','arcade_r23_redpanda',
 'army15_largescreen','army_c15_deskcomp','army_c15_doorscan','army_c15_groupflag','army_c15_screen','army_c15_telemine','art_c20_drawingtablet','attic15_oillamp','attic15_window','bathroom_poop','bathroom_shower1','bathroom_shower2',
 'bathroom_shower3','bathroom_shower4','bathroom_toilet1','bathroom_toilet2','bathroom_toilet3','bathroom_toilet4','bazaar_c17_bubblejuiceblower','bazaar_c17_flycarpet','bazaar_c17_lamp','bazaar_c17_lampblue','bazaar_c17_lampbluepinktrim','bazaar_c17_lampgreen',
 'bazaar_c17_lampgreenpurpletrim','bazaar_c17_lampmystic','bazaar_c17_lamppink','bazaar_c17_lamppinkbluetrim','bazaar_c17_lamppurple','bazaar_c17_lamppurpleyellowtrim','bazaar_c17_lampyellow','bazaar_c17_lampyellowbluetrim','bb_dragon','bb_ducklight','bb_knj2','bb_robo',
 'birds_r18_cardinal','bohogarden_c21_candlebowl','bohogarden_c21_fireheater','bohogarden_c21_glasslantern','bolly_cherry','bolly_wdw_wd','booster_c19_box1','booster_c19_box2','boutique_lampwall','br_c25_bikes','br_c25_caramelodog','br_c25_faunacrateb',
 'br_c25_floracrate','br_c25_monkeybzn_pole','br_c25_toucan3','br_phoenix','br_r25_ipetree','bubblejuice_c21_neonsign','bubblejuice_c21_wall','bump_lights','bw_bball','bw_nt_pool_a1','bw_nt_pool_a3','bw_pool_a1',
 'bw_pool_a2','bw_pool_a3','bw_pool_b1','bw_pool_b2','bw_pool_b3','bw_water_1','calippo','carnival15_hotair_brazil','catcafe_c23_boxcat','catcafe_c23_cattree','catcafe_c23_conecat','catcafe_c23_counter',
 'catcafe_c23_wallcat','celestial_c19_aurora','celestial_c19_floor','celestial_c19_flower','celestial_c19_moonbed','celestial_c19_wall','celestial_c21_lamp','china_lantern','cine_light1','cine_nt_light1','cine_pillarlight','cine_popcorn',
 'cine_tile','circus_c24_bluetentcrackable','circus_c24_cardhand','circus_c24_cardshat','circus_c24_clownballoon','circus_c24_clowncar','circus_c24_frank','circus_c24_redtentcrackable','circus_r24_clownmirror','cland_c15_gate','cland_c15_gatepink','cland_c15_goofloor',
 'cland_c15_jellyseat1','cland_c15_jellyseat2','cland_c15_jellyseat3','cland_c15_light','classic2_drinkmach','classic5_speaker','classic5_window','classic6_food','classic7_c21_neonlights','cloud_c23_tower','cmp_fish_b','cmp_fish_bk',
 'cmp_fish_gr','cmp_fish_r','cmp_fish_s','cmp_nobox','cmp_nobox_2','cmp_nobox_3','cny16_monkeyballoon','cny17_roosterballoon','cny18_dogballoon','cny_sheepballoon','coco_divan','coco_divan_c2',
 'coco_divan_c3','coco_divan_c4','coco_table2','coffee_cup','coralking_c18_bubbleseat','coralking_c18_kelppillar','coralking_c18_neoncoral1','coralking_c18_neoncoral2','coralking_c18_neoncoral3','coralking_c18_treasurechest','costume_gate','country_fp',
 'country_lantern','cpunk_c15_neoarrow','cpunk_c15_neoarrowup','cpunk_c15_neond','cpunk_c15_neonsk','cpunk_c15_neonx','cpunk_c15_searchlight','cpunk_c15_stool','cpunk_c15_traffic','cpunk_c15_tubes','cpunk_r20_augchair','creator_streamtable',
 'darkmodern_c20_floorlight','darkmodern_c20_neonlight','darkmodern_c20_pug','darkmodern_c20_tubelights','dimmer_fuse6','dimmer_steampunk','disco_c26_blueglitterbomb','disco_c26_craftingdiscoduck','disco_c26_discoball','disco_c26_discoballb','disco_c26_floor','disco_c26_glitterball',
 'disco_c26_greenglitterbomb','disco_c26_jukebox','disco_c26_neonlight1','disco_c26_neonlight2','disco_c26_neonlight3','disco_c26_pinkglitterbomb','disco_c26_purpleglitterbomb','disco_c26_redglitterbomb','disco_c26_silverglitterbomb','disco_r26_discoturntable','disco_r26_sharkzone','drago_c15_flag',
 'dream_c24_cloudplant','dream_c24_dreammirror','dream_c24_dreammirrorb','dream_c24_jellywishcrafting','dream_c24_storybook','dream_c24_storybookb','dream_c24_waterfloor','dream_r24_cloudtree','ducket_c25_autumnwindow','ducket_c25_rainbowwasher','ducket_c26_autumncandle','ducket_c26_cottagecandle',
 'ducket_c26_picnicbasket','es_epictree','es_geysir','es_score_b','es_tagging','exe_c15_telephone','exe_copier','exe_sensor','exe_wrkdesk','exotic_r17_treefrog','fall_c23_deluxebasket','fall_c23_picnicbasket',
 'fall_r23_treebench','fantasy_c22_treasure1','fantasy_c22_treasure2','farm_c21_pizzaoven','fest_c19_bprintcrackable','fest_c19_dj','fest_c19_flags','fireworks_08','fireworks_10','fireworks_12','football12_de','football12_es',
 'football12_it','football12_pt','fxbox_fx116','fxbox_fx123','fxbox_fx125','fxbox_fx126','fxbox_fx127','fxbox_fx14','fxbox_fx143','fxbox_fx147','fxbox_fx152','fxbox_fx153',
 'fxbox_fx16','fxbox_fx183','fxbox_fx192','fxbox_fx238','fxbox_fx239','fxbox_fx240','fxbox_fx241','gacha_c25_gachamachine','gacha_c25_royalgacha','gaming_c18_hswap','garden15_lawnmower','garden_birdbath',
 'garden_c15_shroomchr','garden_caterpillar','garden_flolamp','garden_pond','garden_staringbush','garden_volcano','gate_of_eternity','gothic15_toilet','gothic_c15_toilet','gothic_candles','gothic_st_glass','gothiccandelabra',
 'graffiti_c24_craftingtable','graffiti_c24_tv','graffiti_r24_arcademachine','greek_c15_lamp','greek_r19_tiledbath','grunge_candle','grungelamp','habbo25_c25_drinksfloat2','habbo25_c25_jetski2','habbo25_c25_lifering','habbo25_c25_palmdecor2','habbo25_c25_poolfrank',
 'habbo25_c25_surfboard1','habbo25_c25_surfboard2','habbo25_c25_surfboard3','hal_cauldron','hblooza14_ballsign','hblooza14_bundkiosk','hblooza14_duck_balloon_b','hblooza14_duck_balloon_p','hblooza14_duck_balloon_y','hblooza14_duckgate','hblooza14_flagpole','hblooza14_flagpole_p',
 'hblooza14_hotair_b','hblooza14_hotair_p','hblooza14_hotair_y','hblooza14_mud','hblooza14_pinata2','hblooza14_pinata3','hblooza14_pinata4','hblooza14_track','hblooza14_track_crl','hblooza14_track_crr','hblooza_chicken','hblooza_pillar1',
 'hblooza_popcorn','hblooza_tfnc_1','hcamme','hhistory_c24_cactus','hhistory_r16_crackable','hhistory_r17_crackable','hhistory_r18_crackable','hobbies_c26_boardgamescrackable','hobbies_c26_boardgamescrackableb','hobbies_c26_gardeningcrackable','hobbies_c26_sewingcrackable','hockey_light',
 'hole2','hosptl_xray','hotel_c18_pool','hs_applause','hs_box','hs_prop','hw08_xray','hw_08_xray','hween_c24_neonballoons1','hween_c24_neonballoons2','hween_c24_neonballoons3','hween_c24_neonballoons4',
 'hween_c24_neonbatsticker1','hween_c24_neonbatsticker2','hween_c24_neonbatsticker3','hween_c24_neonbatsticker4','hween_c24_neonbatsticker5','hween_c24_neonconfetti','hween_c24_neoncupcakes','hween_c24_neonghoststicker1','hween_c24_neonghoststicker2','hween_c24_neonghoststicker3','hween_c24_neonghoststicker4','hween_c24_neonghoststicker5',
 'hween_c24_neonmixer','hween_c24_neonmixerb','hween_c24_neonpaperskulls1','hween_c24_neonpaperskulls2','hween_c24_neonpaperskulls3','hween_c24_neonpaperskulls4','hween_c24_neonpumpkinsticker1','hween_c24_neonpumpkinsticker2','hween_c24_neonpumpkinsticker3','hween_c24_neonpumpkinsticker4','hween_c24_neonpumpkinsticker5','hween_c24_neonpumpkinwitch1',
 'hween_c24_neonpumpkinwitch2','hween_c24_neonpumpkinwitch3','hween_c24_neonstreamers1','hween_c24_neonstreamers2','hween_c24_neonstreamers3','hween_c24_neonstreamers4','hween_c24_pumpkinsticker','hween_r24_ele','hygge_c18_stove','hygge_c25_kitchensink','hygge_c25_shower','hygge_c25_toiletsink',
 'hygge_c25_tv','hygge_c25_washer','hygge_r18_fox','hygge_r25_toastcat','igor_seat','india_c20_blueprint','india_c20_headjewelbp','india_c20_sewingmachine','industrialfan','jetset_vipscreen','jetset_vipscreencr','jetset_yacht_mid_3',
 'jp_c15_teapot','jp_c22_mistybg','jp_ceiling_lamp','jp_irori','jp_lantern','jp_r22_onsenpool','js_r16_boat','js_r16_jelly','jukebox_big','jungle_c16_flowera1','jungle_c16_flowera2','jungle_c16_flowera3',
 'jungle_c16_flowerb1','jungle_c16_flowerb2','jungle_c16_flowerb3','jungle_c16_flowerc1','jungle_c16_flowerc2','jungle_c16_flowerc3','jungle_c16_flowerd1','jungle_c16_flowerd2','jungle_c16_flowerd3','jungle_c16_light','jungle_c16_radio','jungle_c16_tallgrass',
 'jungle_c16_worktable','jungle_r16_basket','jungle_r16_pitcherplant','ktchn10_pot','ktchn10_sink','ktchn10_tea','ktchn15_coffeemaker','ktchn_c15_dishwasher','ktchn_c15_microwave','ktchn_c15_sink','ktchn_c15_stove','ktchn_hlthNut',
 'ktchn_inspctr','ktchn_sink','ktchn_stove','lamp2_armas','laundry_c18_washmachine','lc_medusa1','lc_medusa2','lc_tubes_corners','lc_tubes_straight','lido_kiosk','lm_jackbox','lodge_c15_window',
 'lodge_dark_candle','lodge_dark_fireplace','lodge_dark_tv','lodge_dark_window','lodge_tv','lt_c15_tree','lt_c26_banana','lt_c26_bobbapoof','lt_c26_boulder','lt_c26_trunkswing','lt_r26_crackable','lt_r26_icecream',
 'mafia_c26_designer','mafia_c26_firepit_white','mafia_c26_magazines','mafia_c26_teleport_white','mafia_r26_globe','mafia_r26_moneytile','magitech_c22_shelf','magitech_c22_testtubes','magitech_r22_bigtube','market_c19_checkoutdesk','matic_dispenser','matic_tree_blue',
 'matic_tree_green','matic_tree_red','matic_tree_silver','matic_tree_yellow','matic_water_dispenser','merger_chest','messy_c21_kitchenette','mexico_c24_deluxepinatab','mexico_c24_pinata','mexico_c24_pinatab','mini_c24_hotairballoon','mm_lemon_drink',
 'modern_c17_iscreen','mushroom_c21_crackable','mushroom_c21_crackableB','mushroom_c21_shelves','mushroom_r21_magicmirror','mushroom_r21_teapot','mutearea_sign2','mystics_bbed','mystics_btable','mystics_btile1','mystics_gbed','mystics_gtable',
 'mystics_gtile1','neonpunk_c20_bed','neonpunk_c20_bedsidetable','neonpunk_c20_bows','neonpunk_c20_candylights','neonpunk_c20_carpet','neonpunk_c20_cubeseat','neonpunk_c20_cupboard','neonpunk_c20_dresser','neonpunk_c20_floor','neonpunk_c20_food','neonpunk_c20_lamp',
 'neonpunk_c20_lights','neonpunk_c20_plushie1','neonpunk_c20_plushie2','neonpunk_c20_plushie3','neonpunk_c20_plushiepile','neonpunk_c20_sofa','neonpunk_c20_stardeco','neonpunk_c20_stool','neonpunk_c20_storage','neonpunk_c20_strawberries','neonpunk_c20_table','neonpunk_c20_unicornposter',
 'neonpunk_c20_wall','neopets_c25_crackableegg','neopets_c25_moneytree','neopets_c25_rainbowpool','neopets_r25_neopetsarcade','nouvelle_trax','nov_c25_happytree','ny16_crackable','ny17_crackable','ny18_crackable','ny2015_balloons','ny2015_conball',
 'ny_c16_sign','ny_r18_crackable','ny_r19_crackable','ny_r20_crackable','ny_r21_crackable','ny_r22_crackable','ny_r23_crackable','ny_r24_crackable','ny_r25_crackable','nyc_c23_bag2','nyc_c23_financeguy','nyc_r23_sharkpuppy',
 'obstacle_bush','olympics_c16_treadmill','olympics_c16_veggiething','olympics_r16_vendingmchn','olympus_c25_pandorasboxb','olympus_c25_pandorasboxcrackable','olympus_r25_lightninginabottle','party_barcorn','party_bardesk','party_beamer','party_chair','party_neon1',
 'party_neon2','party_neon3','party_neon4','party_neon5','party_nt_barcorn','party_nt_chair','party_nt_neon4','party_nt_shelf','party_ravel','party_seat','party_table','party_tray',
 'patch_cloud','pcnc_carp','penguin_ballet','penguin_boxer','picnic_3brds','pj_c26_pillowcrackable','public_x_tile','rainbow_c19_bed','rainbow_c19_chair','rainbow_c19_rug','rainbow_c21_crackable1','rainbow_c21_crackable2',
 'rainyday_c19_cocoa','rainyday_c19_rainwindows','rainyday_c20_coathanger','rainyday_c20_homebakes','rainyday_c20_scentedcandles','ranch_c26_small_duckbergine','ranch_c26_small_duckbergineb','ranch_c26_small_tomato','ranch_c26_sunset','ranch_c26_workbench','rcandle','rcandleset',
 'rclr_garden','rclr_lamp','recycler_mantelclock','rela_candle1','rela_candle2','rela_candle3','rela_candle4','rela_candle5','rela_candle6','rela_candles1','rela_candles2','rela_candles3',
 'romantique_clock','room_noob_pool','runway_fan','sanrio_c22_chococatclock','sanrio_c22_kuromicake','sanrio_c22_twinstarsballoons','santorini_c17_rockpool','santorini_r17_chest','sc26_flyingbook','sc_snowglobe2','sc_snowglobe3','school_c22_crackable',
 'school_toilet_stall','school_urinal','scifi_r17_bed','sculptures_r25_doveseat','seaside_c26_bubblepop','seaside_c26_chest','seaside_c26_tentacles','sf_stick','skorea_c22_idolbox','skorea_c22_idolbox2','skorea_c22_outdoortable','skorea_r22_bukdrum',
 'skullcandle','smiley_c23_hotair','smiley_c23_whoopeecushion1','smiley_c23_whoopeecushion2','smiley_c23_whoopeecushion3','smiley_c23_whoopeecushion4','snowb_light1','snst_tree1','snst_tree1_d','spa_c20_bath','spa_c20_bbcharcoal','spa_c20_bbcitrus',
 'spa_c20_bbmint','spa_c20_bbrose','spa_c20_crackable1A','spa_c20_crackable2A','spa_c22_candle','space_c23_planetbackground','spotlight','st_hween14_mbox','st_palooza_balloons','st_palooza_pool','st_palooza_unicorn','st_uni_labtable',
 'stackable_water','steampunk_lamp','steampunk_pillar_2','steampunk_rack','steampunk_timemach','steampunk_wall1','steampunk_window','stellar_c23_mooncraftingtable','stellar_c23_spacechair','stellar_c23_starcageb','stellar_r23_startree','stellar_r23_ursaminor',
 'stories_football_board','stories_football_screen','stories_football_table','stories_oldmusic_neon','stories_sch_glass','studio_drums','studio_floorlight','studio_mixingdesk','studio_tv','summer_blaster','suncity_c19_tree','suncity_c19_waterway',
 'suncity_c19_waterwaycrnr','suncity_c21_beehive','suncity_r19_biosphere','sunsetcafe_c20_coffeemachine','sunsetcafe_c20_lightupfloor','survival_c26_dystopiafence','survival_c26_dystopiawall','survival_c26_foliagefloor','survival_c26_surveillancetree','survival_r26_scifispeakercorner','svnr_de','test_builder_placeholder',
 'thai_c21_candledish','thai_c21_indoorstove','thai_c21_woodcarvingset','thai_r21_clothingbox','theatre_seat','theatre_seat_b','theatre_seat_g','tiki_c15_wall','tiki_torch','tile_fxprovider_nfs','tokyo_c18_craftbot','tokyo_c18_gacha',
 'tokyo_c18_gamesign','tokyo_c18_neonsign1','tokyo_c18_neonsign2','tokyo_c18_racearcade','tokyo_c18_retroarcade','tokyo_c18_retroarcade2','tokyo_r18_koikite','torch','totem_head','totem_leg','track12_hcauldron','track12_hurdle',
 'track12_mini_torch','traxbronze','traxsilver','tree6','triplecandle','uni_alarm','uni_doorhanging','uni_gamerdesk','uni_rubik','val_heart','vikings_torch','vote_machine',
 'vwave_c21_glitchbuildings','vwave_c21_glitchsunsetbg','vwave_c21_glitchwall','vwave_c21_neonsigns','vwave_c21_pc','vwave_c21_rubiks','vwave_c21_sunsetbg','vwave_r21_jukebox','waasa_ship1','waasa_ship2','wall_ph','wcandle',
 'wcandleset','wildwest_cabinet','wildwest_light','wildwest_minecart','wildwest_pump','winter_r24_snowtree','wisp_c23_starflower','wonderland_c25_crackable','wonderland_c25_crackableb','wonderland_c25_hattercrafting','wonderland_c25_redcrackable','wonderland_c25_redcrackableb',
 'wonderland_c25_spadecardguard','wonderland_c25_talkingflowers','wonderland_r25_mirrortele','xmas_c18_snowfootball','yarn','year2010','year2011','year2012','year2013','year2014','year2018','year2019',
 'year2020','year2021','year2022','year2023','year2024','year2025','year2026','zengarden_c18_glasspond','zengarden_c20_glasspond']),'raro' ON CONFLICT DO NOTHING;
-- epico: 575 móveis
INSERT INTO economia_faixas(classe,raridade) SELECT unnest(ARRAY[
 'SF_panel2','ads_dtlrare_gold','ads_dtlrare_gold2','ads_goldtabl','ads_idol_piano','ads_kelloggs_statue','ads_kfp2statue','ads_twi_piano','anc_artifact3','anc_waterfall','arcade_c23_goldenconsole','army15_statue',
 'army_c15_leatherchr','art_c20_gold1','art_c20_gold2','art_c20_gold3','art_c20_gold4','art_c20_gold5','attic15_clock','bazaar_c17_marketroofbig','bazaar_r17_fountain','bb_fnc3','bigtent_beige','bigtent_camo',
 'bling11_big1','bling11_block','bling11_dvd','bling11_dvn','bling11_floor','bling11_pillar','bling11_plant','bling11_rug1','bling11_rug2','bling11_seat1','bling11_seat2','bling11_slot',
 'bling11_sofa','bling11_statue1','bling11_statue2','bling11_tele','bling11_towels','bling11_wall1','bling11_wall2','bling11_wall3','bling11_wall4','bling15_pooltable','bling_bed','bling_c15_chandalier',
 'bling_c15_wall','bling_cabinet','bling_chair_a','bling_chair_b','bling_chair_c','bling_fridge','bling_fridge_restricted','bling_pool','bling_shwr','bling_sink','bling_sofa','bling_sofa_mu',
 'bling_toilet','bolly_fountain','bolly_lamp','boutique_hcsign','button_c22_rosegold','china_dog','china_dragonstatue','china_goat','china_goldendragon','china_goldenhorse','china_goldenox','china_goldenpig',
 'china_goldenrabbit','china_goldenrat','china_goldensnake','china_goldentiger','china_horse','china_monkey','china_ox','china_pig','china_rabbit','china_rabbitstatue','china_rat','china_rooster',
 'china_snake','china_tiger','china_tigerstatue','cine_curtain','cine_platform','cine_projector','cine_roof','cine_screen','cine_ticket_booth','cine_vipsign','circus_c24_performanceplatformbig','cland15_fountain',
 'classic6_arch','classic8_bar','classic8_chair','classic8_curtains','classic8_disco','classic8_divider','classic8_floor','classic8_glassfloor','classic8_pillar','classic8_plant','classic8_records','classic8_rug',
 'classic8_shelf','classic8_sign','classic8_sofa','classic8_stairs','classic8_statue','classic8_wall','classic9_statue','cmp_fish_g','coralking_c18_goldenfish','coralking_r18_goldenchest','crystal_dragon','crystal_patch',
 'darkelegant_c20_light','darkelegant_c20_lionstatue','diamond_painting6','diamond_painting76','diamond_r23_elephant_statue','dino_c22_bigteeth','disco_c26_goldglitterbomb','dream_c24_waterfall','dtl_r20_gold','duck_hc','duck_vip','ducket_c26_honeyfountain',
 'easter14_block1','easter14_block2','easter14_statue','easter_c20_ancientstatue','easter_c23_bigbattery','easter_c26_elvengoddess','easter_c26_elventable','easter_r16_gold','easter_r18_bonzaifountain','easter_r26_elvenarcher','es_big1','es_big2',
 'es_big3','es_statue','exe_c15_printer','exe_c15_wall','exe_drinks_cabinet','exe_glassdvdr','exe_globe','exe_icecream','exe_rug','exe_wfall','fantasy_c22_crystal','fantasy_r22_herostatue',
 'fball_goldenboot','fball_goldenboot2','fball_grp_fnc3','fest_c21_crystalstall','garden_lupin1','garden_mursu3','garden_r21_plantwall','gift_manlystatue','gold_c15_arc_camp','gold_c15_arc_div2','gold_c15_arc_geysir','gold_c15_arc_hole',
 'gold_c15_arc_snow','gold_c15_arc_tele','gothic_bowl','gothic_c15_chandelier','gothic_r16_fountain','gothicfountain','gothicfountain2','greek_c19_statue','habbo20_c20_blackgoldballoon','habbo20_c20_rosegoldballoon','habbo25_sc25_goldenfountain','hc16_1',
 'hc16_10','hc16_11','hc16_12','hc16_2','hc16_3','hc16_4','hc16_5','hc16_6','hc16_7','hc16_8','hc16_9','hc17_1',
 'hc17_10','hc17_11','hc17_12','hc17_2','hc17_3','hc17_4','hc17_5','hc17_6','hc17_7','hc17_8','hc17_9','hc19_1',
 'hc19_10','hc19_11','hc19_12','hc19_2','hc19_3','hc19_4','hc19_5','hc19_6','hc19_7','hc19_8','hc19_9','hc20_1',
 'hc20_10','hc20_11','hc20_12','hc20_2','hc20_3','hc20_4','hc20_5','hc20_6','hc20_7','hc20_8','hc20_9','hc21_1',
 'hc21_10','hc21_11','hc21_12','hc21_2','hc21_3','hc21_4','hc21_5','hc21_6','hc21_7','hc21_8','hc21_9','hc22_1',
 'hc22_10','hc22_11','hc22_12','hc22_2','hc22_3','hc22_4','hc22_5','hc22_6','hc22_7','hc22_8','hc22_9','hc23_1',
 'hc23_10','hc23_11','hc23_12','hc23_2','hc23_3','hc23_4','hc23_5','hc23_6','hc23_7','hc23_8','hc23_9','hc24_1',
 'hc24_10','hc24_11','hc24_12','hc24_2','hc24_3','hc24_4','hc24_5','hc24_6','hc24_7','hc24_8','hc24_9','hc25_1',
 'hc25_10','hc25_11','hc25_12','hc25_2','hc25_3','hc25_4','hc25_5','hc25_6','hc25_7','hc25_8','hc25_9','hc26_1',
 'hc26_11','hc26_12','hc26_2','hc26_3','hc26_4','hc26_5','hc26_6','hc26_7','hc26_8','hc26_9','hc2_armchair','hc2_barchair',
 'hc2_biglamp','hc2_carpet','hc2_cart','hc2_coffee','hc2_divider','hc2_dvn','hc2_frplc','hc2_sofa','hc2_sofatbl','hc2_vase','hc3_bard','hc3_dc',
 'hc3_divider','hc3_hugelamp','hc3_light','hc3_shelf','hc3_sofa','hc3_stereo','hc3_stool','hc3_table','hc3_vase','hc3_walldeco','hc_arab_bigtb','hc_arab_chair',
 'hc_arab_divdr','hc_arab_pllw','hc_arab_rug','hc_arab_snake','hc_arab_swords','hc_arab_teamk','hc_arab_tetbl','hc_arab_tray1','hc_arab_tray3','hc_arab_wndw','hc_bigvase','hc_bkshlf',
 'hc_btlr','hc_cab','hc_chr','hc_crpt','hc_crtn','hc_djset','hc_dsk','hc_exe_chair','hc_exe_chair2','hc_exe_cubelight','hc_exe_elevator','hc_exe_glassdvdr',
 'hc_exe_light','hc_exe_s_table','hc_exe_seccam','hc_exe_sofa','hc_exe_table','hc_exe_wfall','hc_exe_wrkdesk','hc_frplc','hc_gift_14days','hc_gift_31days','hc_knight_1','hc_lmp',
 'hc_lmpst','hc_luggage','hc_machine','hc_radio','hc_rllr','hc_rntgn','hc_roundchair','hc_roundtable','hc_tbl','hc_trll','hc_tv','hc_wall_lamp',
 'hcc_chair','hcc_crnr','hcc_dvdr','hcc_minibar','hcc_shelf','hcc_sofa','hcc_sofachair','hcc_stool','hcc_table','hhistory_c24_goldtimecapsule','hhistory_c24_goldtimecapsuleb','hhistory_r24_goldenhand',
 'hotel_c18_fountain','hs_stage_long_black','hs_stage_long_blue','hs_stage_long_pink','hween09_chandelier','hween11_fountain','hween_c15_evilcrystal1','hween_c15_evilcrystal2','hween_c15_evilcrystal3','hween_c15_purecrystal1','hween_c15_purecrystal2','hween_c15_purecrystal3',
 'hween_c17_pillar','hween_c19_bigroof','hween_c19_crystal','hween_c19_crystalball','hween_c20_goddesscrystal','hween_c21_kitsunestatue','hween_c22_darkangelstatue','hween_c22_darkangelstatueb','hween_c22_gothicstatue','hween_c23_crystalbasin','hween_c23_sphinx','hween_c23_statueofanubis',
 'hween_c26_ivystatue','hween_r16_chandelier','hween_r16_chandelier2','hween_r16_grandpiano','hween_r16_grandpiano2','hween_r21_goldenflowerscreen','hween_r23_goldenscarab','hween_r26_gargoylefountain','jetset_tub','jp_c22_waterfall','jp_r22_dragonfountain','js_bling11_dvn',
 'js_bling11_seat1','js_bling11_seat2','js_bling11_sofa','js_bling_bed','js_bling_chair_w','js_bling_fridge','js_chandelier','js_exe_wfall','js_r16_shark','lc_window2','lm_bigrock','lm_crystal_skull',
 'lodge_chandelier','lodge_dark_chandelier','lt_c26_coin','lt_c26_goldenstatue','lt_c26_monkey1','lt_c26_monkey2','lt_c26_monkey3','lt_c26_monkey4','lt_c26_monkey5','lt_c26_stonefountain','lt_c26_tigerstatue','lt_c26_toucanstatue',
 'lt_c26_waterfallbg','lt_r26_fountain','lt_r26_gemstatue','lt_statue','mafia_c26_goldleaf','mafia_c26_jacuzzi_dark','mafia_c26_jacuzzi_white','mafia_c26_vintagechair','mafia_c26_vintagedesk','mini_c24_fountain','mnstr_waterfall','mode_gold_bar',
 'mode_gold_bookcase','mode_gold_ceilinglight','mode_gold_diningchair','mode_gold_fireplace','mode_gold_fridge','mode_gold_largecoffeetable','mode_gold_largediningtable','mode_gold_largetable','mode_gold_smallcoffeetable','mode_gold_zshelf','mystics_btile2','mystics_crystal',
 'mystics_crystal_l','mystics_crystal_m','mystics_crystal_s','mystics_ltstatue','mystics_rfountain','ny2015_chocfountain','olympus_r25_zeusstatue','onewaydoor_c22_rosegold','party_block2','party_crate2_1','party_crate2_2','party_crate2_3',
 'party_crate2_4','pcnc_fountain','ranch_r26_statue','rare_blackrosegold_pillow','rare_blackrosegold_sleepingbag','recycler_cdclockB','reef_aquarium','regalblack_c25_goldenpillow','room_info15_statue1','room_info15_statue2','santorini_r17_centaur','santorini_r17_chimera',
 'santorini_r17_hydra','santorini_r17_minotaur','sc_elvenstatue1','sc_elvenstatue2','sc_elvenstatue3','sc_giantcoconutdrink','school_fountain','sculptures_r25_dragonfountain','sp_statue','spa_c22_waterfall','spyro','st_wildwest_buffalo',
 'st_wildwest_goldpick','statue','statue_dragon','statue_elk','statue_griffin','steampunk_gear_1','stories_shakespeare_fairy','suncity_r19_glassfountain','tablet_vendorg','thai_c21_crystalwater','thai_c21_woodenstatue','thai_r21_waterfalltree',
 'tiki_statue','tiki_waterfall','track12_javstatue','traxgold','trophy_chatterbox_gold','uni_c23_fabricposter5','uni_c23_goldenapple','uni_c23_smartduck','uni_c23_teddy5','val13_statue','val14_fountain','val14_largetile',
 'val15_rock2','val_c16_shellfountain','val_c20_chocfountain','val_c22_blingvan','vip_gate','vip_hopper','waasa_aquarium','white_dino_egg','wildwest_piano','wildwest_stageb2','wildwest_stager2','wildwest_stagew2',
 'window_golden','winter15_freeze','winter15_icehockey','winter15_iceskater','winter15_lmppst','winter15_snowboard','winter15_tree4','wintercabin_c19_antlerlight','wonderland_c25_redroseclock','wonderland_c25_whiteroseclock','wood_tv','xm09_lrgBauble',
 'xmas11_yetifeet','xmas13_block1','xmas15_fountainltd','xmas_c15_alpinetree','xmas_c16_creature2','xmas_c16_creature8','xmas_c18_piano','xmas_c19_chandelier','xmas_c19_crystalchair','xmas_c19_crystalfloor','xmas_c19_crystaltable','xmas_c19_jarofgold',
 'xmas_c20_frozenwaterfall','xmas_c23_goldenticket','xmas_c23_goldenutensils','xmas_r18_lightfountain','xmas_r19_crystalfountain','xmas_r19_crystalharp','xmas_r20_icefountain','zengarden_c18_peacefrog','zengarden_c20_goldenmobile','zengarden_c20_peacedog','zengarden_r18_fountain']),'epico' ON CONFLICT DO NOTHING;
-- lendario: 322 móveis
INSERT INTO economia_faixas(classe,raridade) SELECT unnest(ARRAY[
 'LTD_fashionistaf','LTD_fashionistam','LT_throne','ads_aftv_trophy1','ads_aftv_trophy2','ads_cp_trophy','ads_drsports_trophy3','ads_frank_trophy','ads_grefu_trophy','ads_idol_trophy','ads_mtvtrophy_gold','ads_mtvtrophy_silver',
 'ads_spiderman_trophy','ads_twi_trophy','anc_trophy_marble','anc_trophy_obsidian','anc_trophy_sstone','anniversary_r18_throne','arcade_cab','bazaar_ltd17_ele','bazaar_r17_monkey','bazaar_r17_throne','bc_blocktrophy_1','circus_ltd24_pheonixfire',
 'cland15_LTD5','cland15_candythrone','cland15_ltd1','cland15_ltd2','cland15_ltd3','cland15_ltd4','cloud_throne','coco_throne','coco_throne__c2','coco_throne_c3','coco_throne_c4','coralking_ltd18_royalseahorse',
 'crystal_throne','diamond_throne','dino15_dragonfly','dino15_throne','dino_ltd22_lavathrone','dng_throne','duck_ltd25_bonnie','ducket_c26_minilighthouse','easel_2','easel_3','easel_4','easter16_habberge6ltd',
 'easter16_habberge7ltd','easter16_habberge8ltd','easter16_habberge9ltd','easter_c26_elventhroneb','easter_ltd17_harvestgoddess','easter_ltd18_habberge10','easter_ltd19_flowerthrone','easter_ltd20_fortuneduck','easter_ltd22_butterflyenclosure','easter_ltd23_steampunkhabberge','easter_ltd24_bunnyride','easter_ltd26_elventhrone',
 'easter_r16_throne','fall_ltd23_sleepybear','fantasy_ltd22_dragon','fball_ltd14','fball_trophy','fball_trophybrasil_bronze','fball_trophybrasil_gold','fball_trophybrasil_silver','fest_ltd19_alpaca','gift_mysterytrophy','gold_c15_arc_chair','gold_c15_arc_div1',
 'gold_c15_arc_icerug','gold_c15_arc_icewall','gold_c15_arc_lamp','gold_c15_arc_lantern','gold_c15_arc_seat','gold_c15_arc_statue','gold_c15_arc_table','gold_c15_arc_tree1','gold_c15_arc_tree2','gold_c15_arc_tub','gold_rare_crackable','golden_apple',
 'greek_ltd19_harp','habbo15_rare_crackable','habbo20_c20_trophyblock','habbo20_c20_trophybronze','habbo20_c20_trophydesign','habbo20_c20_trophygold','habbo20_c20_trophylooks','habbo20_c20_trophysilver','habbo20_c20_trophyvideo','habbo25_ltd25_duckymachine','habbo25_r25_blackthrone','hblooza_guitar11',
 'hcsohva','hween10_throne','hween13_throne','hween14_rare1','hween14_rare2','hween_c20_goddessthrone','hween_c20_tentaclethrone','hween_ltd16_ghostcar','hween_ltd17_dragon','hween_ltd18_cosplaycat','hween_ltd19_skullthrone','hween_ltd20_tearfountain',
 'hween_ltd21_pagoda','hween_ltd22_throneofwings','hween_ltd23_oasis','hween_ltd26_curseddragonlamp','hween_r17_lichthrone','india_ltd20_sultanthrone','iridescent_ltd24_dragonlamp','iridescent_ltd24_dragonlamp_sorry','iridescent_nt_dragonlamp','jp_rare','jungle_ltd16_orangutan','legotrophy',
 'lt_ltd26_woodjuicedispenser','ltd21_unicornpup','ltd22_giantcrystal','ltd23_plane','ltd_habberge1','ltd_habberge2','ltd_habberge3','ltd_habberge4','ltd_habberge5','mini_c24_cakethrone3','mushroom_ltd21_fairy','mystics_bthrone',
 'mystics_gthrone','nyc_ltd23_applehabberge','olympics_ltd16_missolympus','paris15_ltdfountain','prizetrophy','prizetrophy2','prizetrophy3','prizetrophy_2011_b','prizetrophy_2011_g','prizetrophy_2011_p','prizetrophy_2011_r','prizetrophy_2011_w',
 'prizetrophy_2011_y','prizetrophy_cine','prizetrophy_cool','prizetrophy_frank','prizetrophy_habboway','prizetrophy_hot','prizetrophy_hween11','prizetrophy_mastercard','prizetrophy_niko1','prizetrophy_niko2','prizetrophy_nrj','prizetrophy_nrj_2011',
 'prizetrophy_room_1','prizetrophy_storieshero','prizetrophy_thumb','race_trophy','rainbow_ltd19_parasol','rainbow_ltd21_dragonlamp','rainbow_ltd21_fan','rainbow_ltd21_rainbowboa','rainbow_ltd22_elephant_statue','rainbow_ltd23_icecream','ranch_r26_pumpkinthrone','rare_beehive_bulb',
 'rare_blackrosegold_barrier','rare_blackrosegold_beehive_bulb','rare_blackrosegold_dragonlamp','rare_blackrosegold_elephant_statue','rare_blackrosegold_fan','rare_blackrosegold_fountain','rare_blackrosegold_icecream','rare_blackrosegold_marquee','rare_blackrosegold_parasol','rare_blackrosegold_pillar','rare_blackrosegold_scifidoor','rare_blackrosegold_scifiport',
 'rare_blackrosegold_scifirocket','rare_blackrosegold_wooden_screen','rare_chinahorse','rare_daffodil_rug','rare_dragonlamp_pink','rare_elephant_statue','rare_fountain','rare_fountain_niko','rare_globe','rare_hammock','rare_icecream_campaign','rare_ironmaiden',
 'rare_mmmth','rare_mnstr','rare_moonrug','rare_parasol','rare_prize17xmas','rare_prize18_xmas','rare_prize19_xmas','rare_prize20_xmas','rare_prize21_xmas','rare_prize22xmas','rare_prize23_xmas','rare_prize24_xmas',
 'rare_prize25_xmas','rare_r19_car1','rare_r20_balloonchair','rare_r20_candle','rare_r20_corgi','rare_r20_grandebackdrop','rare_r20_marimo','rare_r20_throne','rare_r20_treehouse','rare_r20_wardrobe','rare_r21_aussiedog','rare_r21_blossomtree',
 'rare_r21_coffeesiphon','rare_r22_bluerocococlock','rare_r22_carbootcabinet','rare_r22_clawmachine','rare_r22_fancyfountain','rare_r22_topiaryanimals','rare_r23_djesko_turntable_2','rare_r23_glassflower','rare_r23_jellyfish','rare_r23_lionstatue','rare_r23_sharkbed','rare_r24_easel1',
 'rare_r24_easel2','rare_r24_easel3','rare_r24_htuberchair','rare_r24_whippet','rare_r25_duckmaster','rare_r25_pygmyhippo','rare_r25_tradetrophy','rare_r26_goldencontrol','rare_r26_silverdragonduck','rare_royalchair','rare_royalsofa','rare_sage',
 'rare_snowrug','rare_stand','rare_stpat14','rare_trex','rare_vdoll','rare_venusstatue','rare_xmas_screen','regalblack_r25_sohva','room_hall_trophy1','room_hall_trophy2','royal_chair','santorini_c17_lighthouse',
 'santorini_ltd17_lighthouse','school_chairgold','school_consolegold','school_ltd22_treehouse','scifi_ltd17_mech','se_trophyG','se_trophyS','seaside_c26_lighthouse','seaside_ltd26_sanddragon','suncity_ltd19_duckpond','thai_ltd21_yakgodstatue','throne',
 'tokyo_ltd18_shiba','trophy_baw','trophy_display','trophy_fansite','trophy_fball_c26_wingedbronze','trophy_fball_c26_wingedgold','trophy_fball_c26_wingedsilver','trophy_gameprize','trophy_ltd18_wcup','trophy_ltd23_goldmonsterplant','trophy_ltd23_silvermonsterplant','trophy_netsafety_0',
 'trophy_photographer_bronze','trophy_photographer_gold','trophy_photographer_iron','trophy_photographer_silver','trophy_snowstorm_bronze','trophy_snowstorm_gold','trophy_snowstorm_silver','trophy_snowstorm_stone','trophy_streamer_bronze','trophy_streamer_gold','trophy_streamer_iron','trophy_streamer_silver',
 'trophy_torch','trophy_videographer_bronze','trophy_videographer_gold','trophy_videographer_iron','trophy_videographer_silver','trophy_viraldancer_bronze','trophy_viraldancer_gold','trophy_viraldancer_iron','trophy_viraldancer_silver','trophy_wired','trophy_wireds','uni_lectern',
 'uni_ltd23_goldenfountain','vikings_throne','vwave_ltd21_lambo','wonderland_c25_cardthrone','xm09_trophy','xmas11_throne','xmas12_santathrone','xmas13_throne','xmas14_sharkthrone','xmas14_snowglobe','xmas_c22_penguintrophy','xmas_c22_reindeertrophy',
 'xmas_ltd16_bearbed','xmas_ltd17_ted','xmas_ltd18_snowhabberge','xmas_ltd19_icethrone','xmas_ltd20_yak','xmas_ltd22_sglobehabberge','xmas_ltd23_carousel','xmas_r16_throne','xmas_r23_cakethrone','xmas_r23_cakethrone2']),'lendario' ON CONFLICT DO NOTHING;
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT classe,raridade FROM economia_faixas
 ON CONFLICT (classe) DO UPDATE SET raridade=EXCLUDED.raridade WHERE vybe_escritorio_catalogo.marco IS NULL;
UPDATE vybe_escritorio_catalogo c SET raridade='comum'
 WHERE c.marco IS NULL AND c.raridade<>'comum' AND NOT EXISTS (SELECT 1 FROM economia_faixas f WHERE f.classe=c.classe);

CREATE TABLE IF NOT EXISTS vybe_escritorio_reinicios (
 chave text PRIMARY KEY, executado_em timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='economia-2026-10-20') THEN
  RAISE NOTICE 'Economia de 20/10/2026 já aplicada; nenhuma alteração.';
  RETURN;
 END IF;

 -- Moedas por ação (XP igual ao de antes).
 UPDATE vybe_escritorio_regras r SET moedas=v.moedas FROM (VALUES
  ('entrega',5),('entrega_prazo',2),('criacao_aprovacao',4),('criacao_aprovada',2),('criacao_alteracao',-2),
  ('carteira',2),('agendamento',2),('captacao',8),('agencia',1),('briefing',0),
  ('dia_sem_vencida',3),('dia_vencida',-3),('dia_agendamento',3),('dia_sem_furo',5),
  ('meta_semanal',30),('conquista',25)
 ) AS v(chave,moedas) WHERE r.chave=v.chave;

 -- Saldo pela regra nova. Perda que parou no zero continua zero; perda
 -- parcial não passa do que foi tirado.
 CREATE TEMP TABLE economia_saldos ON COMMIT DROP AS
 SELECT c.pessoa_id, c.saldo AS antes, GREATEST(0, COALESCE(sum(
   CASE
    WHEN m.regra = 'chegada' THEN LEAST(500, round(m.quantidade * 0.25)::int)
    WHEN m.regra IS NULL THEN m.quantidade
    WHEN m.quantidade = 0 THEN 0
    WHEN m.quantidade < 0 THEN GREATEST(LEAST(r.moedas, 0), m.quantidade)
    ELSE GREATEST(r.moedas, 0)
   END), 0))::int AS depois
 FROM vybe_escritorio_carteiras c
 LEFT JOIN vybe_escritorio_moedas m ON m.pessoa_id = c.pessoa_id
 LEFT JOIN vybe_escritorio_regras r ON r.chave = m.regra
 GROUP BY c.pessoa_id, c.saldo;

 INSERT INTO vybe_escritorio_moedas(pessoa_id, origem, quantidade, pontos, regra)
 SELECT pessoa_id, 'ajuste:economia-2026-10-20', depois - antes, 0, NULL
 FROM economia_saldos WHERE depois <> antes
 ON CONFLICT DO NOTHING;
 UPDATE vybe_escritorio_carteiras c SET saldo = e.depois
 FROM economia_saldos e WHERE e.pessoa_id = c.pessoa_id AND e.depois <> e.antes;

 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('economia-2026-10-20');
END $$;

-- Conquista paga o valor da regra "conquista" da tabela (antes, 50 fixo no
-- código de quem chamava). Assim a moeda e o XP da conquista mudam na tabela.
CREATE OR REPLACE FUNCTION vybe_creditar_moedas(p bigint, origem_evento text, valor integer)
 RETURNS boolean LANGUAGE sql AS $$
 SELECT vybe_lancar_pontos(p, origem_evento, 'conquista', NULL,
  COALESCE((SELECT moedas FROM vybe_escritorio_regras WHERE chave='conquista'), valor),
  COALESCE((SELECT pontos FROM vybe_escritorio_regras WHERE chave='conquista'), GREATEST(valor, 0)))
$$;
COMMIT;
