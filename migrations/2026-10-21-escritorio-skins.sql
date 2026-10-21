-- Skins do personagem (decisão do Paulo, 21/10/2026: "o que fica grátis são
-- itens básicos; o preço das roupas segue a faixa dos móveis"). Cada peça de
-- roupa é a classe "roupa:<tipo>-<conjunto>" no mesmo catálogo, inventário e
-- razão dos móveis (server/escritorio-roupas.js): linha com preço 0 é grátis,
-- linha com faixa é dela, sem linha é Comum. Kits de roupa são linhas de
-- vybe_escritorio_kits. Não mexe em saldo nem inventário de ninguém; quem já
-- veste uma peça continua com ela (o salvamento aceita o visual já salvo).
-- Grátis: todos os rostos livres e 12 modelos livres por corpo de cabelo,
-- camiseta, calça e sapato. Raras: as exclusivas de assinante do Habbo e a peça
-- marcante de cada kit. Revisar e aplicar com o Aprovado do Paulo.
BEGIN;
-- grátis: 247 peças
INSERT INTO vybe_escritorio_catalogo(classe,raridade,preco) SELECT unnest(ARRAY[
 'roupa:hr-3357','roupa:hr-145','roupa:hr-125','roupa:hr-165','roupa:hr-105','roupa:hr-115','roupa:hr-170','roupa:hr-100','roupa:hr-135','roupa:hr-110',
 'roupa:hr-889','roupa:hr-802','roupa:hr-6508','roupa:hr-550','roupa:hr-596','roupa:hr-500','roupa:hr-555','roupa:hr-510','roupa:hr-505','roupa:hr-540',
 'roupa:hr-530','roupa:hr-575','roupa:hr-520','roupa:hr-545','roupa:hr-3020','roupa:hr-3025','roupa:hr-3090','roupa:hr-3322','roupa:hr-3325','roupa:hr-3339',
 'roupa:hr-3369','roupa:hr-3370','roupa:hr-3377','roupa:hr-3386','roupa:hr-3393','roupa:hr-3396','roupa:hd-620','roupa:hd-3536','roupa:hd-3537','roupa:hd-3600',
 'roupa:hd-3603','roupa:hd-3604','roupa:hd-3631','roupa:hd-3704','roupa:hd-3721','roupa:hd-3813','roupa:hd-3814','roupa:hd-3845','roupa:hd-3956','roupa:hd-3997',
 'roupa:hd-4015','roupa:hd-4023','roupa:hd-4163','roupa:hd-4174','roupa:hd-4202','roupa:hd-4203','roupa:hd-4204','roupa:hd-4205','roupa:hd-4206','roupa:hd-4266',
 'roupa:hd-4267','roupa:hd-4268','roupa:hd-4279','roupa:hd-4280','roupa:hd-4287','roupa:hd-4383','roupa:hd-5033','roupa:hd-5041','roupa:hd-5042','roupa:hd-5143',
 'roupa:hd-5153','roupa:hd-5154','roupa:hd-5316','roupa:hd-5317','roupa:hd-5318','roupa:hd-5319','roupa:hd-5430','roupa:hd-5522','roupa:hd-5524','roupa:hd-5525',
 'roupa:hd-5682','roupa:hd-5683','roupa:hd-5684','roupa:hd-5685','roupa:hd-5696','roupa:hd-5740','roupa:hd-5741','roupa:hd-5798','roupa:hd-5799','roupa:hd-5837',
 'roupa:hd-5838','roupa:hd-5839','roupa:hd-5840','roupa:hd-5888','roupa:hd-5889','roupa:hd-5890','roupa:hd-5913','roupa:hd-6001','roupa:hd-6002','roupa:hd-6003',
 'roupa:hd-6004','roupa:hd-6005','roupa:hd-6006','roupa:hd-6007','roupa:hd-6008','roupa:hd-6009','roupa:hd-6021','roupa:hd-6022','roupa:hd-6024','roupa:hd-6025',
 'roupa:hd-6026','roupa:hd-6027','roupa:hd-6045','roupa:hd-6046','roupa:hd-6047','roupa:hd-6048','roupa:hd-6072','roupa:hd-6157','roupa:hd-6158','roupa:hd-6159',
 'roupa:hd-6216','roupa:hd-6218','roupa:hd-6219','roupa:hd-6248','roupa:hd-6289','roupa:hd-6295','roupa:hd-6361','roupa:hd-6435','roupa:hd-6436','roupa:hd-6438',
 'roupa:hd-6439','roupa:hd-6440','roupa:hd-6441','roupa:hd-6456','roupa:hd-6507','roupa:hd-6519','roupa:hd-6520','roupa:hd-6556','roupa:hd-6557','roupa:hd-6575',
 'roupa:hd-6576','roupa:hd-6591','roupa:hd-6592','roupa:hd-6616','roupa:hd-6617','roupa:hd-626','roupa:hd-180','roupa:hd-207','roupa:hd-205','roupa:hd-190',
 'roupa:hd-625','roupa:hd-185','roupa:hd-195','roupa:hd-610','roupa:hd-200','roupa:hd-600','roupa:hd-615','roupa:hd-206','roupa:hd-627','roupa:hd-605',
 'roupa:hd-208','roupa:hd-209','roupa:hd-628','roupa:hd-629','roupa:ch-3030','roupa:ch-3109','roupa:ch-3110','roupa:ch-3111','roupa:ch-3323','roupa:ch-3334',
 'roupa:ch-3336','roupa:ch-3368','roupa:ch-3372','roupa:ch-3400','roupa:ch-3416','roupa:ch-3429','roupa:ch-680','roupa:ch-3112','roupa:ch-3113','roupa:ch-3114',
 'roupa:ch-3335','roupa:ch-3340','roupa:ch-3351','roupa:ch-3367','roupa:ch-3371','roupa:ch-3399','roupa:ch-3417','roupa:ch-3428','roupa:ch-3321','roupa:ch-3332',
 'roupa:ch-3342','roupa:ch-3446','roupa:ch-3459','roupa:ch-3538','roupa:ch-3539','roupa:ch-3540','roupa:ch-3563','roupa:ch-3672','roupa:ch-3735','roupa:ch-3788',
 'roupa:lg-280','roupa:lg-285','roupa:lg-270','roupa:lg-281','roupa:lg-275','roupa:lg-715','roupa:lg-6511','roupa:lg-696','roupa:lg-710','roupa:lg-720',
 'roupa:lg-700','roupa:lg-705','roupa:lg-695','roupa:lg-716','roupa:lg-3023','roupa:lg-3078','roupa:lg-3088','roupa:lg-3116','roupa:lg-3201','roupa:lg-3216',
 'roupa:lg-3290','roupa:lg-3320','roupa:lg-3328','roupa:lg-3333','roupa:lg-3337','roupa:lg-3341','roupa:sh-300','roupa:sh-305','roupa:sh-295','roupa:sh-290',
 'roupa:sh-907','roupa:sh-740','roupa:sh-735','roupa:sh-730','roupa:sh-725','roupa:sh-905','roupa:sh-906','roupa:sh-908','roupa:sh-3068','roupa:sh-3115',
 'roupa:sh-3180','roupa:sh-3338','roupa:sh-3348','roupa:sh-3354','roupa:sh-3375','roupa:sh-3383','roupa:sh-3419'
]),'comum',0 ON CONFLICT (classe) DO NOTHING;
-- raras: 303 peças
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'roupa:hr-3004','roupa:hr-3011','roupa:hr-3012','roupa:hr-3021','roupa:hr-3024','roupa:hr-3037','roupa:hr-3040','roupa:hr-3041','roupa:hr-3043','roupa:hr-3044',
 'roupa:hr-3048','roupa:hr-3056','roupa:hr-3160','roupa:hr-3161','roupa:hr-3162','roupa:hr-3163','roupa:hr-3172','roupa:hr-3194','roupa:hr-3195','roupa:hr-3221',
 'roupa:hr-3247','roupa:hr-3251','roupa:hr-3255','roupa:hr-3256','roupa:hr-3260','roupa:hr-3273','roupa:hr-3278','roupa:hr-3281','roupa:hr-9534','roupa:hr-840',
 'roupa:hr-828','roupa:hr-834','roupa:hr-831','roupa:hr-836','roupa:hr-833','roupa:hr-838','roupa:hr-835','roupa:hr-829','roupa:hr-678','roupa:hr-832',
 'roupa:hr-839','roupa:hr-677','roupa:hd-3096','roupa:hd-3091','roupa:hd-3092','roupa:hd-3093','roupa:hd-3097','roupa:hd-3098','roupa:hd-3094','roupa:hd-3099',
 'roupa:hd-3095','roupa:hd-3100','roupa:hd-3101','roupa:hd-3102','roupa:hd-3103','roupa:hd-3104','roupa:hd-3105','roupa:hd-3106','roupa:ch-3001','roupa:ch-3005',
 'roupa:ch-3013','roupa:ch-3014','roupa:ch-3015','roupa:ch-3022','roupa:ch-3032','roupa:ch-3033','roupa:ch-3036','roupa:ch-3038','roupa:ch-3045','roupa:ch-3046',
 'roupa:ch-3049','roupa:ch-3050','roupa:ch-3051','roupa:ch-3059','roupa:ch-3060','roupa:ch-3067','roupa:ch-3076','roupa:ch-3077','roupa:ch-3133','roupa:ch-3135',
 'roupa:ch-3137','roupa:ch-3165','roupa:ch-3167','roupa:ch-3183','roupa:ch-3185','roupa:ch-3197','roupa:ch-3199','roupa:ch-3203','roupa:ch-3208','roupa:ch-3213',
 'roupa:ch-3214','roupa:ch-3215','roupa:ch-3222','roupa:ch-3233','roupa:ch-3234','roupa:ch-3237','roupa:ch-3244','roupa:ch-3245','roupa:ch-3250','roupa:ch-3266',
 'roupa:ch-3279','roupa:ch-3293','roupa:ch-3501','roupa:ch-803','roupa:ch-824','roupa:ch-826','roupa:ch-883','roupa:ch-885','roupa:lg-3006','roupa:lg-3017',
 'roupa:lg-3018','roupa:lg-3019','roupa:lg-3047','roupa:lg-3057','roupa:lg-3058','roupa:lg-3061','roupa:lg-3134','roupa:lg-3136','roupa:lg-3138','roupa:lg-3166',
 'roupa:lg-3174','roupa:lg-3190','roupa:lg-3191','roupa:lg-3192','roupa:lg-3198','roupa:lg-3200','roupa:lg-3202','roupa:lg-3235','roupa:lg-3257','roupa:lg-3267',
 'roupa:lg-3282','roupa:lg-3283','roupa:lg-3502','roupa:lg-827','roupa:sh-3016','roupa:sh-3027','roupa:sh-3035','roupa:sh-3064','roupa:sh-3089','roupa:sh-3154',
 'roupa:sh-3184','roupa:sh-3206','roupa:sh-3252','roupa:sh-3275','roupa:sh-3277','roupa:ha-1027','roupa:ha-3026','roupa:ha-3054','roupa:ha-3086','roupa:ha-3118',
 'roupa:ha-3129','roupa:ha-3130','roupa:ha-3139','roupa:ha-3140','roupa:ha-3144','roupa:ha-3145','roupa:ha-3150','roupa:ha-3156','roupa:ha-3171','roupa:ha-3179',
 'roupa:ha-3209','roupa:ha-3220','roupa:ha-3231','roupa:ha-3236','roupa:ha-3238','roupa:ha-3240','roupa:ha-3241','roupa:ha-3242','roupa:ha-3243','roupa:ha-3253',
 'roupa:ha-3259','roupa:ha-3261','roupa:ha-3265','roupa:ha-3268','roupa:ha-3272','roupa:ha-3291','roupa:ha-3305','roupa:ha-5990','roupa:ha-1019','roupa:ha-1016',
 'roupa:ha-1024','roupa:ha-1011','roupa:ha-1012','roupa:ha-1025','roupa:ha-1026','roupa:he-3069','roupa:he-3070','roupa:he-3071','roupa:he-3079','roupa:he-3081',
 'roupa:he-3082','roupa:he-3146','roupa:he-3149','roupa:he-3155','roupa:he-3164','roupa:he-3181','roupa:he-3188','roupa:he-3189','roupa:he-3218','roupa:he-3227',
 'roupa:he-3228','roupa:he-3229','roupa:he-3239','roupa:he-3258','roupa:he-3295','roupa:he-1607','roupa:he-1604','roupa:he-1603','roupa:ea-3083','roupa:ea-3107',
 'roupa:ea-3108','roupa:ea-3141','roupa:ea-3148','roupa:ea-3168','roupa:ea-3169','roupa:ea-3170','roupa:ea-3196','roupa:ea-3224','roupa:ea-3226','roupa:ea-3262',
 'roupa:ea-3270','roupa:ea-1402','roupa:ea-1405','roupa:fa-3193','roupa:fa-3230','roupa:fa-3296','roupa:fa-3350','roupa:fa-1209','roupa:fa-1203','roupa:fa-1207',
 'roupa:ca-1814','roupa:ca-1816','roupa:ca-3084','roupa:ca-3085','roupa:ca-3131','roupa:ca-3151','roupa:ca-3175','roupa:ca-3177','roupa:ca-3187','roupa:ca-3217',
 'roupa:ca-3219','roupa:ca-3223','roupa:ca-3225','roupa:ca-3292','roupa:ca-3511','roupa:ca-1811','roupa:wa-3072','roupa:wa-3073','roupa:wa-3080','roupa:wa-3178',
 'roupa:wa-3212','roupa:wa-3263','roupa:wa-3264','roupa:wa-2003','roupa:wa-2010','roupa:wa-2005','roupa:cc-3002','roupa:cc-3003','roupa:cc-3007','roupa:cc-3008',
 'roupa:cc-3009','roupa:cc-3010','roupa:cc-3039','roupa:cc-3066','roupa:cc-3075','roupa:cc-3087','roupa:cc-3152','roupa:cc-3153','roupa:cc-3157','roupa:cc-3158',
 'roupa:cc-3159','roupa:cc-3186','roupa:cc-3232','roupa:cc-3246','roupa:cc-3248','roupa:cc-3249','roupa:cc-3269','roupa:cc-3289','roupa:cc-3299','roupa:cc-3304',
 'roupa:cc-5235','roupa:cc-9563','roupa:cc-9865','roupa:cc-888','roupa:cc-886','roupa:cc-887','roupa:cp-3204','roupa:cp-3205','roupa:cp-3207','roupa:cp-3307',
 'roupa:cp-3308','roupa:cp-3309','roupa:cp-3310','roupa:cp-3311','roupa:cp-3312','roupa:cp-3313','roupa:cp-3314','roupa:cp-3315','roupa:cp-3316','roupa:cp-3317',
 'roupa:ha-5627','roupa:ha-3535','roupa:ha-5277'
]),'raro' ON CONFLICT (classe) DO NOTHING;
INSERT INTO vybe_escritorio_kits(chave,nome,descricao,classes,desconto,ordem) VALUES
 ('skin-praia','Skin Praia','Chapéu de palha e óculos escuros.',ARRAY['roupa:ha-3261','roupa:ea-1401'],0.20,101),
 ('skin-policial','Skin Policial','Quepe, óculos escuros e distintivo.',ARRAY['roupa:ha-5627','roupa:ea-1404','roupa:ca-3410'],0.20,102),
 ('skin-heroi','Skin Herói','Máscara de herói e lenço.',ARRAY['roupa:ha-3535','roupa:ca-3545'],0.20,103),
 ('skin-lobo','Skin Lobo','Cabeça de lobo e casaco longo.',ARRAY['roupa:ha-5277','roupa:cc-3280'],0.20,104)
ON CONFLICT (chave) DO NOTHING;
COMMIT;
