-- Construção livre e venda à loja, autorizadas por Paulo em 26/10/2026.
-- 1) Tabela das vendas à loja (server/escritorio-economia.js, venderMovel):
--    cada unidade comprada volta uma vez, pelo valor pago nela.
-- 2) Pisos do acervo, acabamentos, blocos e materiais e revestimentos de parede
--    ficaram grátis (MOVEIS_DE_CONSTRUCAO): devolve o que cada pessoa pagou por
--    eles, uma vez por compra, pelo razão ('reembolso:compra:<id>'), sem XP, e
--    tira essas peças do inventário (agora são essenciais, sem limite). Os
--    quartos não mudam: as peças continuam onde estão.
--    Kits não são devolvidos aqui (o preço é do conjunto); confira antes:
--    SELECT pessoa_id, origem FROM vybe_escritorio_moedas WHERE origem LIKE 'kit:%';
-- Aplicar explicitamente depois da publicação. Nunca no build ou carregamento.
-- Prévia do que volta:
-- SELECT pessoa_id, count(*) AS compras, -sum(quantidade) AS devolver
-- FROM vybe_escritorio_moedas c WHERE origem LIKE 'compra:%' AND quantidade<0
--  AND substring(origem from '^compra:[^:]+:(.*)$') = ANY(<a lista abaixo>)
--  AND NOT EXISTS(SELECT 1 FROM vybe_escritorio_moedas r WHERE r.pessoa_id=c.pessoa_id AND r.origem='reembolso:compra:'||c.id)
-- GROUP BY pessoa_id ORDER BY pessoa_id;
BEGIN;
CREATE TABLE IF NOT EXISTS vybe_escritorio_vendas (
 id bigserial PRIMARY KEY,
 pessoa_id bigint NOT NULL REFERENCES vybe_pessoas(id),
 chave text NOT NULL CHECK (chave ~ '^[a-f0-9-]{36}$'),
 compra_id bigint NOT NULL REFERENCES vybe_escritorio_moedas(id),
 classe text NOT NULL,
 unidades integer NOT NULL CHECK (unidades > 0),
 valor integer NOT NULL CHECK (valor > 0),
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE (pessoa_id, chave, compra_id)
);
CREATE INDEX IF NOT EXISTS vybe_escritorio_vendas_compra ON vybe_escritorio_vendas (pessoa_id, compra_id);
LOCK TABLE vybe_escritorio_inventario, vybe_escritorio_carteiras, vybe_escritorio_moedas IN EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS vybe_escritorio_reinicios (
 chave text PRIMARY KEY, executado_em timestamptz NOT NULL DEFAULT now()
);
DO $$
DECLARE construcao text[] := ARRAY[
  'SF_floor_1','SF_floor_2','ads_aftv_floor','ads_antena3_floor','ads_clearasil_tile1','ads_clfloor','ads_drsports_floor','ads_footlocker_logoblock',
  'ads_idol_floor1','ads_idol_floor2','ads_m6_floor','ads_mtv_floor','ads_nick_faketile','ads_reebok_block2','anc_c15_wall','anc_ele_grass',
  'anc_ele_rock','anc_hot_sands','anc_jngl_patch','anc_savanna_wall','anc_sunset_wall','arabian_wall','army_c15_wall','art_c20_wall',
  'attic15_wall','bathroom_floortile1','bathroom_floortile2','bathroom_floortile3','bathroom_floortile4','bathroom_wall2','bathroom_wall3','bathroom_wall4',
  'bb_patch1','bc_alpha1_a_recolorable','bc_alpha1_alpha_recolorable','bc_alpha1_b_recolorable','bc_alpha1_c_recolorable','bc_alpha1_d_recolorable','bc_alpha1_e_recolorable','bc_alpha1_f_recolorable',
  'bc_alpha1_g_recolorable','bc_alpha1_h_recolorable','bc_alpha1_i_recolorable','bc_alpha1_j_recolorable','bc_alpha1_k_recolorable','bc_alpha1_l_recolorable','bc_alpha1_m_recolorable','bc_alpha1_n_recolorable',
  'bc_alpha1_num_recolorable','bc_alpha1_o_recolorable','bc_alpha1_p_recolorable','bc_alpha1_q_recolorable','bc_alpha1_r_recolorable','bc_alpha1_s_recolorable','bc_alpha1_t_recolorable','bc_alpha1_u_recolorable',
  'bc_alpha1_v_recolorable','bc_alpha1_w_recolorable','bc_alpha1_x_recolorable','bc_alpha1_y_recolorable','bc_alpha1_z_recolorable','bc_block_0_recolorable','bc_block_1_recolorable','bc_block_artdeco1_recolorable',
  'bc_block_glass_recolorable','bc_block_grass_recolorable','bc_block_industrial_recolorable','bc_block_marble_recolorable','bc_block_metalgrip_recolorable','bc_block_redbrick_recolorable','bc_block_sand_recolorable','bc_block_small_recolorable',
  'bc_block_water_recolorable','bc_block_wool_recolorable','bc_blocktrophy_1','bc_cone_recolorable','bc_cylinder_recolorable','bc_flowerhedge_recolorable','bc_glasspanel_recolorable','bc_halfcylinder_recolorable',
  'bc_hemisphere_recolorable','bc_lavarock_recolorable','bc_metalcrate_recolorable','bc_panel_recolorable','bc_pyramidtip_recolorable','bc_quartercircle_recolorable','bc_quarterring_recolorable','bc_ramp_recolorable',
  'bc_round_recolorable','bc_sphere_recolorable','bc_stairs_recolorable','bc_stick_recolorable','bc_stone_recolorable','bc_terra_recolorable','bc_tile_recolorable','bc_wedge_recolorable',
  'bc_wedgecrnr_recolorable','bc_wood_recolorable','bling11_floor','bling11_wall1','bling11_wall2','bling11_wall3','bling11_wall4','bling_c15_wall',
  'bolly_tile1','bolly_tile2','boutique_floor1a','boutique_floor1b','boutique_floor2a','boutique_floor2b','bump_road','bw_water_2',
  'celestial_c19_wall','change_state_on_step','cland_c15_wall','classic5_stairs','classic7_stairs','classic8_stairs','coralking_c18_bluesand','coralking_c18_coralfloor',
  'coralking_c18_seafloor','country_forestwall','country_grass','country_patio','country_soil','country_wall','cpunk_c15_road','cpunk_c15_wall',
  'crystal_patch','cypunk_c15_wall','diamond_painting99','diner_rug','dino_c15_blocks','dino_c15_floor','dng_floor','dng_ground',
  'dng_stairs','dng_treasure','dng_wall','ducket_c25_autumnwall','ducket_c25_wall','easter11_wall','easter14_block2','easter14_block4',
  'easter14_metalfloor','easter14_sandfloor','easter14_wall','easter_c20_scatteredforestfloor','easter_c21_digitalfloor','easter_c21_textile','easter_c22_dirtfloor','easter_c22_rockerydark',
  'easter_c22_rockfloor','easter_c23_floor','easter_c26_elvenfloor','easter_c26_elvenmarbleblock','easter_c26_elvenstage','easter_c26_elvenstairs','easter_c26_elvenstairsblock','easter_c26_elvenwoodfloor',
  'env_grass','es_box','es_tile','exe_c15_wall','garden_wall','gardenshed_wall','gothic_carpet','gothic_carpet2',
  'greek_c15_floor','grungewall','habbo15_comp_blocks','habbo20_c20_trophyblock','hblooza_dirtfloor','hc16_7','hc17_1','horse_hayfloor',
  'horse_pitchfork_wall','horse_sawdustfloor','horse_shoe_wall','horse_stable_wall','horse_stable_wall_w','hotel_c18_stairs','hs_carpet','hs_carpet_blk',
  'hs_stairs_black','hs_stairs_blue','hs_stairs_pink','hs_wall','hween09_floor','hween11_disflo','hween11_disflo2','hween12_floor',
  'hween13_castleblock1','hween13_castleblock2','hween13_castleturret1','hween13_castleturret2','hween13_floor2','hween13_gutsfloor','hween13_tile1','hween13_tile2',
  'hween14_floor','hween14_wall','hween_c15_stairs','hween_c16_floor','hween_c16_floor2','hween_c16_ladder','hween_c16_ladder2','hween_c17_cavefloor',
  'hween_c18_bloodfloorstreak','hween_c18_floormould','hween_c18_labsteelfloor','hween_c18_labtilefloor','hween_c19_crookedfloor','hween_c20_brokenfloor','hween_c20_floor','hween_c20_floorstage',
  'hween_c20_floortrap','hween_c20_lrstairs','hween_c20_porchfloor','hween_c20_porchstairs','hween_c20_udstairs','hween_c21_stonefloor','hween_c22_gothicblock','hween_c22_gothicstairs',
  'hween_c22_marblefloor','hween_c23_floorspiketrap','hween_c23_tombfloor','hween_c24_basketballfloor_patch1','hween_c24_basketballfloor_patch2','hween_c24_basketballfloor_patch3','hween_c24_darkschoolhallfloor','hween_c25_mossyfloor',
  'hween_c25_tiledfloor','hween_c26_wornfloorboards','hygge_c25_featherdeco','hygge_c25_shower','hygge_c25_wallpaper1','hygge_c25_wallpaper2','hygge_c25_window1','jp_wall',
  'jungle_c16_floor','jungle_c16_stairs2','jungle_c16_stairs3','jungle_c16_watertile','jungle_c16_watertrap','ktchn_c15_floor','ktchn_wall','lc_tile1',
  'lc_tile2','lc_wall1','lc_wall2','lidostairs','lodge_c15_floor','lodge_c15_wall','lodge_dark_wall','lt_c26_stonestairs',
  'lt_jngl_wall','lt_nt_jngl_wall','lt_patch','lt_wall','market_c19_spill','marsrug','messy_c21_plushcarpet','messy_c21_stepladder',
  'mystics_bfloor','mystics_bwall','mystics_gfloor','mystics_gwall','newbie_stairs_black','newbie_stairs_pink','ny2013_floor','ny2013_wall',
  'nyc_c23_firestairs','nyc_c23_steps','paris_c15_floor','paris_c15_pavement','paris_c15_wall','party_block','party_block2','party_crate1_1',
  'party_crate1_2','party_crate1_3','party_crate1_4','party_crate2_1','party_crate2_2','party_crate2_3','party_crate2_4','party_floor',
  'party_nt_floor','pirate_stairs','pirate_stairs_g','pixel_floor_blue','pixel_floor_brown','pixel_floor_green','pixel_floor_pink','pixel_floor_yellow',
  'pixel_wall_black','pixel_wall_blue','pixel_wall_green','pixel_wall_pink','pixel_wall_red','pstack','rainyday_c20_woodenfloor','rela_nt_wall',
  'rela_wall','romantique_c15_wall','room_hcl15_floor','room_invisible_block2','room_invisible_block3','room_invisible_block4','room_invisible_click_tile','room_noob_floor1',
  'room_noob_floor2','room_noob_floor3','room_noob_stairs','room_noob_stairside','room_noob_tallfloor','room_thr15_block','room_thr15_stair','room_wl15_teleblock',
  'runway_fabric2','santorini_c17_mosaicfloor','santorini_c17_pebblefloor','santorini_c17_sand','santorini_c17_stairs','sb_tile','sb_wall','school_toilet_wall',
  'school_wall','sf_floor','sf_wall','sf_wall2','sf_wall3','shallow','snowb_mountain_wall','snowb_slope',
  'soundblock','soundblock_breakbeat','space_c23_planetbackground','space_c23_spaceplatform2','st_wildwest_goldpick','steampunk_floor1','steampunk_floor2','steampunk_wall1',
  'steampunk_wall2','stone_stairs','stone_wall','summer_sunset_wall','suncity_c19_floor','tiki_c15_wall','tiki_junglerug','tiki_sand',
  'tile','tile_red','tile_stackmagic8x8','tile_walkmagic1x8','tile_walkmagic8x8','tile_yell','tokyo_c18_floor','tokyo_c18_road',
  'transparent_floor','urban_sidewalk','urban_wall','urban_wall_china','val09_floor','val09_floor2','val11_floor','val12_marble1',
  'val12_marble2','val13_build_2','val13_floor1','val13_wall_1','val13_wall_2','val13_wall_3','val14_largetile','val14_tile1',
  'val14_tile2','val14_tile3','val_c20_floor','vikings_floor','vikings_wall_g','vikings_wall_r','vybe_assento_invisivel','vybe_bloco_invisivel',
  'wallpaper','wildwest_floor','wildwest_floor2','wildwest_wallpaper','wintercabin_c19_stairs','xmas08_wallpaper','xmas11_luxfloor1','xmas11_luxfloor2',
  'xmas11_stonefloor','xmas11_wall','xmas11_woodfloor','xmas12_cfloor','xmas12_cfloorbig','xmas12_floortile','xmas12_floortile2','xmas12_wall_in',
  'xmas12_wall_out','xmas13_block1','xmas13_block2','xmas13_floor','xmas13_toyblock1','xmas13_toyblock2','xmas13_toyblock3','xmas13_toyblock4',
  'xmas_c15_buildbase1','xmas_c15_buildbase2','xmas_c15_buildmid1','xmas_c15_buildmid2','xmas_c16_woodfloor','xmas_c16_woodtile','xmas_c17_smallpavement','xmas_c18_stagestairs',
  'xmas_c19_crystalfloor','xmas_c20_woodenblocks','xmas_c20_woodenhouse','xmas_c22_roofblock','xmas_c22_woodenfloor','xmas_c23_checkerfloor','xmas_c24_blizzardfloor','xmas_c24_wallpaper'
 ];
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_reinicios WHERE chave='construcao-livre-2026-10-26') THEN
  RAISE NOTICE 'Reembolso da construção já executado; nenhuma alteração.';
  RETURN;
 END IF;
 -- O UPDATE usa só os recibos inseridos agora (idempotência por compra).
 WITH alvo AS (
  SELECT c.id, c.pessoa_id, -c.quantidade - COALESCE((SELECT sum(v.valor) FROM vybe_escritorio_vendas v WHERE v.compra_id=c.id),0) AS devolver
  FROM vybe_escritorio_moedas c
  WHERE c.origem LIKE 'compra:%' AND c.quantidade<0
   AND substring(c.origem from '^compra:[^:]+:(.*)$') = ANY(construcao)
 ), recibos AS (
  INSERT INTO vybe_escritorio_moedas(pessoa_id,origem,quantidade)
  SELECT pessoa_id,'reembolso:compra:'||id,devolver FROM alvo WHERE devolver>0
  ON CONFLICT(pessoa_id,origem) DO NOTHING
  RETURNING pessoa_id,quantidade
 ), totais AS (SELECT pessoa_id,sum(quantidade)::integer AS valor FROM recibos GROUP BY pessoa_id)
 INSERT INTO vybe_escritorio_carteiras(pessoa_id,saldo)
 SELECT pessoa_id,valor FROM totais
 ON CONFLICT(pessoa_id) DO UPDATE SET saldo=vybe_escritorio_carteiras.saldo+EXCLUDED.saldo;
 DELETE FROM vybe_escritorio_inventario WHERE classe = ANY(construcao);
 INSERT INTO vybe_escritorio_reinicios(chave) VALUES('construcao-livre-2026-10-26');
END $$;
COMMIT;
