-- Raridade das roupas pelo desenho, skins completas e personagens recriados
-- (decisões do Paulo em 21/10/2026: "o que for animado e diferente sempre vai
-- ser mais caro"; skins "no estilo do Tibia"; "resetar pra todos terem a
-- experiência de fazer o herói de novo"). Gerada por
-- scripts/escritorio-raridade-roupas.mjs; não editar à mão.
-- Não mexe em saldo, XP, inventário, conquistas nem nas peças grátis.
-- Roupa não tem estoque nem vitrine (server/escritorio-economia.js, infoMovel).
-- Grátis que viraram pagas por serem diferentes: 38.
-- Contagem: incomum 276, raro 627, épico 153, lendário 25.
BEGIN;
-- 1. Raridade: as linhas pagas de roupa são refeitas; quem não está em lista é Comum.
DELETE FROM vybe_escritorio_catalogo WHERE classe LIKE 'roupa:%' AND preco IS DISTINCT FROM 0;
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'roupa:ca-1811','roupa:ca-1814','roupa:ca-1816','roupa:ca-3084','roupa:ca-3085','roupa:ca-3131','roupa:ca-3151','roupa:ca-3175','roupa:ca-3177','roupa:ca-3187',
 'roupa:ca-3217','roupa:ca-3219','roupa:ca-3223','roupa:ca-3225','roupa:ca-3292','roupa:ca-3511','roupa:cc-3002','roupa:cc-3003','roupa:cc-3007','roupa:cc-3008',
 'roupa:cc-3009','roupa:cc-3010','roupa:cc-3039','roupa:cc-3066','roupa:cc-3075','roupa:cc-3087','roupa:cc-3152','roupa:cc-3153','roupa:cc-3157','roupa:cc-3158',
 'roupa:cc-3159','roupa:cc-3186','roupa:cc-3232','roupa:cc-3246','roupa:cc-3248','roupa:cc-3249','roupa:cc-3269','roupa:cc-3289','roupa:cc-3299','roupa:cc-3304',
 'roupa:cc-5235','roupa:cc-886','roupa:cc-887','roupa:cc-888','roupa:cc-9563','roupa:cc-9865','roupa:ch-3001','roupa:ch-3005','roupa:ch-3013','roupa:ch-3014',
 'roupa:ch-3015','roupa:ch-3022','roupa:ch-3032','roupa:ch-3033','roupa:ch-3036','roupa:ch-3038','roupa:ch-3045','roupa:ch-3046','roupa:ch-3049','roupa:ch-3050',
 'roupa:ch-3051','roupa:ch-3059','roupa:ch-3060','roupa:ch-3067','roupa:ch-3076','roupa:ch-3077','roupa:ch-3133','roupa:ch-3135','roupa:ch-3137','roupa:ch-3165',
 'roupa:ch-3167','roupa:ch-3183','roupa:ch-3185','roupa:ch-3197','roupa:ch-3199','roupa:ch-3203','roupa:ch-3208','roupa:ch-3213','roupa:ch-3214','roupa:ch-3215',
 'roupa:ch-3222','roupa:ch-3233','roupa:ch-3234','roupa:ch-3237','roupa:ch-3244','roupa:ch-3245','roupa:ch-3250','roupa:ch-3266','roupa:ch-3279','roupa:ch-3293',
 'roupa:ch-3501','roupa:ch-803','roupa:ch-824','roupa:ch-826','roupa:ch-883','roupa:ch-885','roupa:cp-3204','roupa:cp-3205','roupa:cp-3207','roupa:cp-3307',
 'roupa:cp-3308','roupa:cp-3309','roupa:cp-3310','roupa:cp-3311','roupa:cp-3312','roupa:cp-3313','roupa:cp-3314','roupa:cp-3315','roupa:cp-3316','roupa:cp-3317',
 'roupa:ea-1402','roupa:ea-1405','roupa:ea-3083','roupa:ea-3107','roupa:ea-3108','roupa:ea-3141','roupa:ea-3148','roupa:ea-3168','roupa:ea-3169','roupa:ea-3170',
 'roupa:ea-3196','roupa:ea-3224','roupa:ea-3226','roupa:ea-3262','roupa:ea-3270','roupa:fa-3230','roupa:fa-3296','roupa:fa-3350','roupa:ha-1011','roupa:ha-1012',
 'roupa:ha-1026','roupa:ha-1027','roupa:ha-3026','roupa:ha-3054','roupa:ha-3118','roupa:ha-3129','roupa:ha-3130','roupa:ha-3144','roupa:ha-3145','roupa:ha-3150',
 'roupa:ha-3156','roupa:ha-3171','roupa:ha-3209','roupa:ha-3220','roupa:ha-3236','roupa:ha-3242','roupa:ha-3261','roupa:ha-3265','roupa:ha-3268','roupa:ha-3272',
 'roupa:ha-3291','roupa:ha-5990','roupa:hd-3091','roupa:hd-3092','roupa:hd-3093','roupa:hd-3094','roupa:hd-3095','roupa:hd-3096','roupa:hd-3097','roupa:hd-3098',
 'roupa:hd-3099','roupa:hd-3100','roupa:hd-3101','roupa:hd-3102','roupa:hd-3103','roupa:hd-3104','roupa:hd-3105','roupa:hd-3106','roupa:he-1603','roupa:he-1604',
 'roupa:he-1607','roupa:he-3069','roupa:he-3070','roupa:he-3071','roupa:he-3079','roupa:he-3081','roupa:he-3082','roupa:he-3146','roupa:he-3149','roupa:he-3155',
 'roupa:he-3181','roupa:he-3188','roupa:he-3189','roupa:he-3218','roupa:he-3227','roupa:he-3228','roupa:he-3229','roupa:he-3239','roupa:he-3258','roupa:hr-3004',
 'roupa:hr-3011','roupa:hr-3012','roupa:hr-3021','roupa:hr-3024','roupa:hr-3037','roupa:hr-3040','roupa:hr-3041','roupa:hr-3043','roupa:hr-3044','roupa:hr-3048',
 'roupa:hr-3056','roupa:hr-3160','roupa:hr-3161','roupa:hr-3162','roupa:hr-3163','roupa:hr-3172','roupa:hr-3194','roupa:hr-3195','roupa:hr-3221','roupa:hr-3247',
 'roupa:hr-3255','roupa:hr-3256','roupa:hr-3260','roupa:hr-3273','roupa:hr-3278','roupa:hr-3281','roupa:hr-677','roupa:hr-678','roupa:hr-828','roupa:hr-829',
 'roupa:hr-831','roupa:hr-832','roupa:hr-833','roupa:hr-834','roupa:hr-835','roupa:hr-836','roupa:hr-838','roupa:hr-839','roupa:hr-840','roupa:hr-9534',
 'roupa:lg-3006','roupa:lg-3017','roupa:lg-3018','roupa:lg-3019','roupa:lg-3047','roupa:lg-3057','roupa:lg-3058','roupa:lg-3061','roupa:lg-3134','roupa:lg-3136',
 'roupa:lg-3138','roupa:lg-3166','roupa:lg-3174','roupa:lg-3191','roupa:lg-3192','roupa:lg-3198','roupa:lg-3200','roupa:lg-3202','roupa:lg-3235','roupa:lg-3257',
 'roupa:lg-3267','roupa:lg-3282','roupa:lg-3283','roupa:lg-3502','roupa:lg-827','roupa:sh-3016','roupa:sh-3027','roupa:sh-3035','roupa:sh-3064','roupa:sh-3089',
 'roupa:sh-3154','roupa:sh-3184','roupa:sh-3206','roupa:sh-3252','roupa:sh-3275','roupa:sh-3277','roupa:wa-2003','roupa:wa-2005','roupa:wa-2010','roupa:wa-3072',
 'roupa:wa-3073','roupa:wa-3080','roupa:wa-3178','roupa:wa-3212','roupa:wa-3263','roupa:wa-3264'
]),'incomum' ON CONFLICT (classe) DO NOTHING;
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'roupa:ca-3545','roupa:ca-3799','roupa:ca-3916','roupa:ca-3982','roupa:ca-4036','roupa:ca-4129','roupa:ca-4130','roupa:ca-4173','roupa:ca-4183','roupa:ca-4292',
 'roupa:ca-4344','roupa:ca-4347','roupa:ca-4378','roupa:ca-4389','roupa:ca-4936','roupa:ca-4937','roupa:ca-4963','roupa:ca-4999','roupa:ca-5028','roupa:ca-5051',
 'roupa:ca-5061','roupa:ca-5100','roupa:ca-5101','roupa:ca-5102','roupa:ca-5193','roupa:ca-5227','roupa:ca-5238','roupa:ca-5251','roupa:ca-5253','roupa:ca-5254',
 'roupa:ca-5255','roupa:ca-5273','roupa:ca-5282','roupa:ca-5309','roupa:ca-5352','roupa:ca-5365','roupa:ca-5420','roupa:ca-5431','roupa:ca-5444','roupa:ca-5459',
 'roupa:ca-5472','roupa:ca-5477','roupa:ca-5502','roupa:ca-5519','roupa:ca-5521','roupa:ca-5533','roupa:ca-5534','roupa:ca-5550','roupa:ca-5571','roupa:ca-5574',
 'roupa:ca-5575','roupa:ca-5583','roupa:ca-5604','roupa:ca-5616','roupa:ca-5625','roupa:ca-5705','roupa:ca-5706','roupa:ca-5707','roupa:ca-5708','roupa:ca-5739',
 'roupa:ca-5759','roupa:ca-5916','roupa:ca-5938','roupa:ca-5939','roupa:ca-5940','roupa:ca-5941','roupa:ca-5981','roupa:ca-6032','roupa:ca-6040','roupa:ca-6041',
 'roupa:ca-6124','roupa:ca-6128','roupa:ca-6149','roupa:ca-6168','roupa:ca-6199','roupa:ca-6208','roupa:ca-6213','roupa:ca-6226','roupa:ca-6227','roupa:ca-6228',
 'roupa:ca-6229','roupa:ca-6252','roupa:ca-6253','roupa:ca-6276','roupa:ca-6328','roupa:ca-6343','roupa:ca-6380','roupa:ca-6457','roupa:ca-6560','roupa:ca-6578',
 'roupa:ca-6603','roupa:ca-6604','roupa:cc-4010','roupa:cc-4026','roupa:cc-4032','roupa:cc-4217','roupa:cc-4277','roupa:cc-4947','roupa:cc-4979','roupa:cc-5144',
 'roupa:cc-5283','roupa:cc-5307','roupa:cc-5382','roupa:cc-6110','roupa:cc-6111','roupa:cc-6112','roupa:cc-6113','roupa:cc-6114','roupa:cc-6118','roupa:cc-6160',
 'roupa:cc-6294','roupa:cc-6572','roupa:cc-6573','roupa:cc-6581','roupa:cc-6582','roupa:ch-3442','roupa:ch-3443','roupa:ch-3563','roupa:ch-3615','roupa:ch-3616',
 'roupa:ch-3617','roupa:ch-3618','roupa:ch-3629','roupa:ch-3630','roupa:ch-3672','roupa:ch-3747','roupa:ch-3748','roupa:ch-3769','roupa:ch-3770','roupa:ch-3817',
 'roupa:ch-3818','roupa:ch-3835','roupa:ch-3848','roupa:ch-3849','roupa:ch-3949','roupa:ch-4062','roupa:ch-4063','roupa:ch-4099','roupa:ch-4101','roupa:ch-4157',
 'roupa:ch-4158','roupa:ch-4275','roupa:ch-4276','roupa:ch-4289','roupa:ch-4976','roupa:ch-4989','roupa:ch-5021','roupa:ch-5038','roupa:ch-5064','roupa:ch-5068',
 'roupa:ch-5072','roupa:ch-5168','roupa:ch-5189','roupa:ch-5195','roupa:ch-5202','roupa:ch-5256','roupa:ch-5257','roupa:ch-5258','roupa:ch-5302','roupa:ch-5303',
 'roupa:ch-5349','roupa:ch-5350','roupa:ch-5351','roupa:ch-5373','roupa:ch-5374','roupa:ch-5516','roupa:ch-5561','roupa:ch-5633','roupa:ch-5634','roupa:ch-5792',
 'roupa:ch-5793','roupa:ch-6030','roupa:ch-6038','roupa:ch-6039','roupa:ch-6051','roupa:ch-6060','roupa:ch-6097','roupa:ch-6098','roupa:ch-6099','roupa:ch-6100',
 'roupa:ch-6275','roupa:ch-6292','roupa:ch-6293','roupa:ch-6327','roupa:ch-6388','roupa:ch-6458','roupa:ch-6459','roupa:ch-6538','roupa:ch-6564','roupa:ch-6589',
 'roupa:ch-6590','roupa:fa-1205','roupa:fa-1209','roupa:fa-1210','roupa:fa-3193','roupa:fa-3462','roupa:fa-3470','roupa:fa-3472','roupa:fa-3473','roupa:fa-3553',
 'roupa:fa-3590','roupa:fa-3597','roupa:fa-3663','roupa:fa-3812','roupa:fa-3815','roupa:fa-3816','roupa:fa-3832','roupa:fa-3865','roupa:fa-3964','roupa:fa-3965',
 'roupa:fa-3966','roupa:fa-4014','roupa:fa-5158','roupa:fa-5384','roupa:fa-5513','roupa:fa-5552','roupa:fa-5703','roupa:fa-5731','roupa:fa-5760','roupa:fa-5811',
 'roupa:fa-6271','roupa:fa-6272','roupa:fa-6483','roupa:fa-6484','roupa:fa-6485','roupa:ha-1001','roupa:ha-1007','roupa:ha-1008','roupa:ha-1014','roupa:ha-1016',
 'roupa:ha-1018','roupa:ha-1019','roupa:ha-1021','roupa:ha-1024','roupa:ha-1025','roupa:ha-3086','roupa:ha-3139','roupa:ha-3140','roupa:ha-3231','roupa:ha-3240',
 'roupa:ha-3241','roupa:ha-3243','roupa:ha-3253','roupa:ha-3259','roupa:ha-3347','roupa:ha-3356','roupa:ha-3480','roupa:ha-3514','roupa:ha-3533','roupa:ha-3544',
 'roupa:ha-3554','roupa:ha-3555','roupa:ha-3556','roupa:ha-3564','roupa:ha-3565','roupa:ha-3566','roupa:ha-3570','roupa:ha-3584','roupa:ha-3585','roupa:ha-3601',
 'roupa:ha-3606','roupa:ha-3612','roupa:ha-3622','roupa:ha-3632','roupa:ha-3633','roupa:ha-3646','roupa:ha-3654','roupa:ha-3655','roupa:ha-3656','roupa:ha-3662',
 'roupa:ha-3666','roupa:ha-3677','roupa:ha-3694','roupa:ha-3701','roupa:ha-3711','roupa:ha-3736','roupa:ha-3737','roupa:ha-3741','roupa:ha-3742','roupa:ha-3766',
 'roupa:ha-3775','roupa:ha-3823','roupa:ha-3843','roupa:ha-3859','roupa:ha-3922','roupa:ha-3929','roupa:ha-3930','roupa:ha-3952','roupa:ha-3953','roupa:ha-3954',
 'roupa:ha-3984','roupa:ha-4006','roupa:ha-4007','roupa:ha-4018','roupa:ha-4054','roupa:ha-4057','roupa:ha-4061','roupa:ha-4103','roupa:ha-4133','roupa:ha-4134',
 'roupa:ha-4170','roupa:ha-4188','roupa:ha-4192','roupa:ha-4194','roupa:ha-4195','roupa:ha-4198','roupa:ha-4214','roupa:ha-4284','roupa:ha-4294','roupa:ha-4296',
 'roupa:ha-4304','roupa:ha-4307','roupa:ha-4310','roupa:ha-4313','roupa:ha-4316','roupa:ha-4320','roupa:ha-4323','roupa:ha-4324','roupa:ha-4327','roupa:ha-4328',
 'roupa:ha-4329','roupa:ha-4330','roupa:ha-4331','roupa:ha-4332','roupa:ha-4333','roupa:ha-4334','roupa:ha-4348','roupa:ha-4349','roupa:ha-4354','roupa:ha-4371',
 'roupa:ha-4374','roupa:ha-4960','roupa:ha-4964','roupa:ha-4972','roupa:ha-4980','roupa:ha-5000','roupa:ha-5010','roupa:ha-5011','roupa:ha-5012','roupa:ha-5020',
 'roupa:ha-5025','roupa:ha-5079','roupa:ha-5082','roupa:ha-5084','roupa:ha-5086','roupa:ha-5103','roupa:ha-5112','roupa:ha-5198','roupa:ha-5203','roupa:ha-5276',
 'roupa:ha-5299','roupa:ha-5301','roupa:ha-5335','roupa:ha-5353','roupa:ha-5364','roupa:ha-5375','roupa:ha-5377','roupa:ha-5402','roupa:ha-5403','roupa:ha-5426',
 'roupa:ha-5428','roupa:ha-5451','roupa:ha-5460','roupa:ha-5468','roupa:ha-5469','roupa:ha-5470','roupa:ha-5473','roupa:ha-5475','roupa:ha-5476','roupa:ha-5483',
 'roupa:ha-5486','roupa:ha-5499','roupa:ha-5501','roupa:ha-5520','roupa:ha-5591','roupa:ha-5677','roupa:ha-5689','roupa:ha-5693','roupa:ha-5744','roupa:ha-5814',
 'roupa:ha-5853','roupa:ha-5944','roupa:ha-5968','roupa:ha-6056','roupa:ha-6057','roupa:ha-6080','roupa:ha-6090','roupa:ha-6091','roupa:ha-6092','roupa:ha-6093',
 'roupa:ha-6198','roupa:ha-6206','roupa:ha-6209','roupa:ha-6225','roupa:ha-6240','roupa:ha-6241','roupa:ha-6243','roupa:ha-6249','roupa:ha-6250','roupa:ha-6277',
 'roupa:ha-6300','roupa:ha-6301','roupa:ha-6326','roupa:ha-6366','roupa:ha-6389','roupa:ha-6479','roupa:ha-6480','roupa:ha-6490','roupa:ha-6537','roupa:ha-6563',
 'roupa:ha-6608','roupa:ha-6609','roupa:ha-6622','roupa:hd-4203','roupa:hd-4204','roupa:hd-5042','roupa:hd-5522','roupa:hd-6361','roupa:hd-6507','roupa:he-3164',
 'roupa:he-3295','roupa:he-3324','roupa:he-3395','roupa:he-3543','roupa:he-3547','roupa:he-3548','roupa:he-3549','roupa:he-3550','roupa:he-3551','roupa:he-3552',
 'roupa:he-3557','roupa:he-3558','roupa:he-3559','roupa:he-3560','roupa:he-3561','roupa:he-3562','roupa:he-3627','roupa:he-3628','roupa:he-3642','roupa:he-3643',
 'roupa:he-3703','roupa:he-3740','roupa:he-3743','roupa:he-3884','roupa:he-3890','roupa:he-3912','roupa:he-3918','roupa:he-4022','roupa:he-4059','roupa:he-4209',
 'roupa:he-4210','roupa:he-4213','roupa:he-4258','roupa:he-4259','roupa:he-4260','roupa:he-4261','roupa:he-4262','roupa:he-4263','roupa:he-4264','roupa:he-4265',
 'roupa:he-4271','roupa:he-4272','roupa:he-4345','roupa:he-4380','roupa:he-4382','roupa:he-4946','roupa:he-4990','roupa:he-5031','roupa:he-5050','roupa:he-5088',
 'roupa:he-5121','roupa:he-5137','roupa:he-5244','roupa:he-5314','roupa:he-5380','roupa:he-5418','roupa:he-5442','roupa:he-5457','roupa:he-5458','roupa:he-5482',
 'roupa:he-5554','roupa:he-5721','roupa:he-5758','roupa:he-5766','roupa:he-5767','roupa:he-5788','roupa:he-5789','roupa:he-5790','roupa:he-5802','roupa:he-5804',
 'roupa:he-5813','roupa:he-5827','roupa:he-5828','roupa:he-5965','roupa:he-6028','roupa:he-6033','roupa:he-6125','roupa:he-6144','roupa:he-6146','roupa:he-6183',
 'roupa:he-6215','roupa:he-6344','roupa:he-6386','roupa:he-6536','roupa:hr-110','roupa:hr-3251','roupa:hr-3774','roupa:hr-4024','roupa:hr-4031','roupa:hr-4269',
 'roupa:hr-4270','roupa:hr-4343','roupa:hr-505','roupa:hr-5372','roupa:hr-5517','roupa:hr-5555','roupa:hr-5579','roupa:hr-5801','roupa:hr-5969','roupa:hr-6010',
 'roupa:hr-6023','roupa:hr-6063','roupa:hr-6084','roupa:hr-6174','roupa:hr-6318','roupa:hr-6420','roupa:hr-6465','roupa:hr-6495','roupa:hr-845','roupa:hr-863',
 'roupa:lg-3190','roupa:lg-3950','roupa:lg-4119','roupa:lg-4358','roupa:lg-5190','roupa:mc-3360','roupa:mc-3542','roupa:mc-3744','roupa:mc-3867','roupa:mc-3975',
 'roupa:mc-4041','roupa:mc-4091','roupa:mc-4137','roupa:mc-4282','roupa:mc-4356','roupa:mc-5461','roupa:mc-5498','roupa:mc-5500','roupa:mc-5518','roupa:mc-5569',
 'roupa:mc-5796','roupa:mc-5800','roupa:mc-5808','roupa:mc-5810','roupa:mc-5825','roupa:mc-5829','roupa:mc-5895','roupa:mc-5925','roupa:mc-5942','roupa:mc-5996',
 'roupa:mc-6050','roupa:mc-6115','roupa:mc-6210','roupa:mc-6230','roupa:mc-6247','roupa:mc-6255','roupa:mc-6346','roupa:mc-6369','roupa:mc-6382','roupa:mc-6408',
 'roupa:mc-6409','roupa:mc-6410','roupa:mc-6424','roupa:mc-6437','roupa:mc-6446','roupa:mc-6451','roupa:mc-6461','roupa:mc-6468','roupa:mc-6481','roupa:mc-6486',
 'roupa:mc-6509','roupa:mc-6535','roupa:mc-6547','roupa:mc-6552','roupa:mc-6574','roupa:mc-6579','roupa:mc-6584','roupa:mc-6593','roupa:mc-6595','roupa:mc-6600',
 'roupa:mc-6606','roupa:mc-6621','roupa:pt-5609','roupa:pt-5610','roupa:pt-5611','roupa:pt-5690','roupa:pt-5742','roupa:pt-5826','roupa:pt-5842','roupa:pt-5843',
 'roupa:pt-5961','roupa:pt-6031','roupa:pt-6069','roupa:pt-6070','roupa:pt-6077','roupa:pt-6119','roupa:pt-6150','roupa:pt-6166','roupa:pt-6217','roupa:pt-6266',
 'roupa:pt-6299','roupa:pt-6381','roupa:pt-6383','roupa:pt-6442','roupa:pt-6488','roupa:pt-6555','roupa:pt-6558','roupa:pt-6559','roupa:pt-6567','roupa:pt-6577',
 'roupa:sh-3693','roupa:sh-4064','roupa:sh-4065','roupa:sh-5164','roupa:sh-5670','roupa:sh-5671','roupa:sh-5729'
]),'raro' ON CONFLICT (classe) DO UPDATE SET raridade=EXCLUDED.raridade, preco=NULL;
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'roupa:ca-5026','roupa:ca-5250','roupa:ca-5252','roupa:ca-5454','roupa:ca-5523','roupa:ca-5771','roupa:ca-6044','roupa:ca-6081','roupa:ca-6189','roupa:ca-6190',
 'roupa:ca-6235','roupa:ca-6242','roupa:ca-6399','roupa:cc-5114','roupa:cc-6341','roupa:ch-3979','roupa:ch-4353','roupa:ch-5229','roupa:ch-5514','roupa:ch-5515',
 'roupa:ch-5735','roupa:ch-5736','roupa:ch-5762','roupa:ch-5763','roupa:ch-5963','roupa:ch-5964','roupa:ch-6058','roupa:ch-6059','roupa:ch-6516','roupa:ch-6517',
 'roupa:fa-1203','roupa:fa-1207','roupa:fa-3471','roupa:fa-3476','roupa:fa-3700','roupa:fa-3771','roupa:fa-3888','roupa:fa-4013','roupa:fa-4211','roupa:fa-5122',
 'roupa:fa-5280','roupa:fa-5369','roupa:fa-5691','roupa:fa-5692','roupa:fa-6170','roupa:fa-6284','roupa:fa-6450','roupa:fa-6585','roupa:fa-6586','roupa:fa-6587',
 'roupa:ha-1015','roupa:ha-3179','roupa:ha-3238','roupa:ha-3305','roupa:ha-3431','roupa:ha-3440','roupa:ha-3450','roupa:ha-3451','roupa:ha-3452','roupa:ha-3453',
 'roupa:ha-3454','roupa:ha-3455','roupa:ha-3456','roupa:ha-3457','roupa:ha-3534','roupa:ha-3535','roupa:ha-3567','roupa:ha-3583','roupa:ha-3588','roupa:ha-3589',
 'roupa:ha-3591','roupa:ha-3605','roupa:ha-3623','roupa:ha-3624','roupa:ha-3638','roupa:ha-3653','roupa:ha-3680','roupa:ha-3684','roupa:ha-3862','roupa:ha-4038',
 'roupa:ha-4051','roupa:ha-4056','roupa:ha-4164','roupa:ha-4207','roupa:ha-4208','roupa:ha-4215','roupa:ha-4970','roupa:ha-5003','roupa:ha-5004','roupa:ha-5027',
 'roupa:ha-5076','roupa:ha-5081','roupa:ha-5115','roupa:ha-5138','roupa:ha-5191','roupa:ha-5194','roupa:ha-5228','roupa:ha-5241','roupa:ha-5269','roupa:ha-5272',
 'roupa:ha-5277','roupa:ha-5371','roupa:ha-5379','roupa:ha-5421','roupa:ha-5489','roupa:ha-5562','roupa:ha-5697','roupa:ha-5774','roupa:ha-5809','roupa:ha-6052',
 'roupa:ha-6076','roupa:ha-6101','roupa:ha-6104','roupa:ha-6105','roupa:ha-6106','roupa:ha-6107','roupa:ha-6108','roupa:ha-6109','roupa:hd-3704','roupa:hd-4015',
 'roupa:hd-4202','roupa:hd-4205','roupa:hd-4206','roupa:hd-4267','roupa:hd-4268','roupa:hd-4287','roupa:hd-5033','roupa:hd-5143','roupa:hd-5153','roupa:hd-5154',
 'roupa:hd-5430','roupa:hd-6001','roupa:hd-6002','roupa:hd-6003','roupa:hd-6004','roupa:hd-6005','roupa:hd-6006','roupa:hd-6248','roupa:hd-6289','roupa:hd-6295',
 'roupa:hd-6435','roupa:hd-6436','roupa:hd-6519','roupa:hd-6520','roupa:hd-6616','roupa:hd-6617','roupa:he-6173','roupa:he-6236','roupa:he-6377','roupa:he-6443',
 'roupa:lg-5022','roupa:lg-6013','roupa:wa-6165'
]),'epico' ON CONFLICT (classe) DO UPDATE SET raridade=EXCLUDED.raridade, preco=NULL;
INSERT INTO vybe_escritorio_catalogo(classe,raridade) SELECT unnest(ARRAY[
 'roupa:ha-6273','roupa:ha-6356','roupa:he-6094','roupa:he-6370','roupa:he-6373','roupa:he-6390','roupa:mc-6251','roupa:mc-6445','roupa:mc-6448','roupa:mc-6449',
 'roupa:mc-6452','roupa:mc-6527','roupa:mc-6548','roupa:mc-6562','roupa:mc-6571','roupa:pt-6178','roupa:pt-6322','roupa:pt-6342','roupa:pt-6376','roupa:pt-6487',
 'roupa:pt-6512','roupa:pt-6539','roupa:pt-6553','roupa:pt-6565','roupa:pt-6618'
]),'lendario' ON CONFLICT (classe) DO UPDATE SET raridade=EXCLUDED.raridade, preco=NULL;
-- 2. Skins completas (o visual dos dois corpos) no lugar dos kits de duas peças.
ALTER TABLE vybe_escritorio_kits ADD COLUMN IF NOT EXISTS visual text NOT NULL DEFAULT '';
UPDATE vybe_escritorio_kits SET ativo=false WHERE chave IN ('skin-praia','skin-policial','skin-heroi','skin-lobo');
INSERT INTO vybe_escritorio_kits(chave,nome,descricao,classes,desconto,ordem,visual) VALUES
 ('visual-chef','Chef','Dólmã, touca e calça xadrez de cozinha.',ARRAY['roupa:ha-3930','roupa:ch-3931','roupa:lg-3933','roupa:sh-290','roupa:ch-3932','roupa:sh-725'],0.15,200,'M:hd-180-1.hr-100-61.ha-3930-92.ch-3931-92-92.lg-3933-92.sh-290-110|F:hd-600-1.hr-515-61.ha-3930-92.ch-3932-92-92.lg-3933-92.sh-725-110'),
 ('visual-mago','Mago','Chapéu animado com gatinho, cabelo branco, manto e cajado.',ARRAY['roupa:hr-6269','roupa:ha-6273','roupa:ch-6275','roupa:lg-270','roupa:sh-290','roupa:ca-4378','roupa:lg-695','roupa:sh-725'],0.15,201,'M:hd-180-1.hr-6269-49.ha-6273-76-66.ch-6275-76-66.lg-270-76.sh-290-110.ca-4378|F:hd-600-1.hr-6269-49.ha-6273-76-66.ch-6275-76-66.lg-695-76.sh-725-110.ca-4378'),
 ('visual-cyber','Ciberpunk','Visor, máscara de gás, armadura e asas robóticas.',ARRAY['roupa:ha-4018','roupa:fa-4014','roupa:ch-4025','roupa:cc-4026','roupa:lg-4017','roupa:sh-4016'],0.15,202,'M:hd-180-1.hr-100-61.ha-4018-82-110.fa-4014-64-110.ch-4025-64-82.cc-4026-64-82.lg-4017-64-82.sh-4016-64-82|F:hd-600-1.hr-515-61.ha-4018-82-110.fa-4014-64-110.ch-4025-64-82.cc-4026-64-82.lg-4017-64-82.sh-4016-64-82'),
 ('visual-samurai','Samurai','Elmo e armadura de samurai com espada.',ARRAY['roupa:ha-5027','roupa:ca-5028','roupa:ch-210','roupa:lg-270','roupa:sh-290','roupa:ch-630','roupa:lg-695','roupa:sh-725'],0.15,203,'M:hd-180-1.hr-100-61.ha-5027-73-110.ca-5028-73-110.ch-210-110.lg-270-110.sh-290-110|F:hd-600-1.hr-515-61.ha-5027-73-110.ca-5028-73-110.ch-630-110.lg-695-110.sh-725-110'),
 ('visual-medico','Médico','Espelho de testa, estetoscópio e jaleco.',ARRAY['roupa:ha-4301','roupa:ea-4302','roupa:he-4303','roupa:ch-210','roupa:lg-270','roupa:sh-290','roupa:ch-630','roupa:lg-695','roupa:sh-725'],0.15,204,'M:hd-180-1.hr-100-61.ha-4301-92-82.ea-4302-82-92.he-4303-92-82.ch-210-92.lg-270-82.sh-290-92|F:hd-600-1.hr-515-61.ha-4301-92-82.ea-4302-82-92.he-4303-92-82.ch-630-92.lg-695-82.sh-725-92'),
 ('visual-cowboy','Cowboy','Chapéu, camisa xadrez, colete e botas.',ARRAY['roupa:ha-6540','roupa:ch-6541','roupa:cc-6532','roupa:lg-270','roupa:sh-3783','roupa:ch-6542','roupa:lg-695'],0.15,205,'M:hd-180-1.hr-100-61.ha-6540-91-66.ch-6541-73-91.cc-6532-91.lg-270-82.sh-3783-91-110|F:hd-600-1.hr-515-61.ha-6540-91-66.ch-6542-73-91.cc-6532-91.lg-695-82.sh-3783-91-110'),
 ('visual-punk','Roqueiro','Cabelo vermelho, fones e jaqueta de couro.',ARRAY['roupa:hr-3325','roupa:he-3324','roupa:ea-3484','roupa:cc-3326','roupa:ch-210','roupa:lg-270','roupa:sh-3783','roupa:ch-630','roupa:lg-695'],0.15,206,'M:hd-180-1.hr-3325-59-61.he-3324-110-64.ea-3484.cc-3326-110-64.ch-210-110.lg-270-110.sh-3783-110-64|F:hd-600-1.hr-3325-59-61.he-3324-110-64.ea-3484.cc-3326-110-64.ch-630-110.lg-695-110.sh-3783-110-64'),
 ('visual-rei','Rei','Coroa de diamante, barba e roupa real.',ARRAY['roupa:ha-3710','roupa:fa-3344','roupa:ch-210','roupa:lg-270','roupa:sh-290','roupa:ch-630','roupa:lg-695','roupa:sh-725'],0.15,207,'M:hd-180-1.hr-100-61.ha-3710.fa-3344-92.ch-210-73.lg-270-73.sh-290-66|F:hd-600-1.hr-515-61.ha-3710.ch-630-73.lg-695-73.sh-725-66'),
 ('visual-fantasma','Fantasma','Corpo de sombra e um fantasminha do lado.',ARRAY['roupa:hd-6295','roupa:ch-3442','roupa:lg-270','roupa:sh-290','roupa:pt-5690','roupa:lg-695','roupa:sh-725'],0.15,208,'M:hd-6295-14.hr-100-61.ch-3442-92.lg-270-92.sh-290-92.pt-5690-92|F:hd-6295-14.hr-515-61.ch-3442-92.lg-695-92.sh-725-92.pt-5690-92'),
 ('visual-vampiro','Vampiro','Rosto de vampiro e morcego na cabeça.',ARRAY['roupa:hd-3721','roupa:ha-3606','roupa:ch-210','roupa:lg-270','roupa:sh-290','roupa:ch-630','roupa:lg-695','roupa:sh-725'],0.15,209,'M:hd-3721-14.hr-100-61.ha-3606.ch-210-110.lg-270-110.sh-290-110|F:hd-3721-14.hr-515-61.ha-3606.ch-630-110.lg-695-110.sh-725-110'),
 ('visual-comando','Comando','Faixa na cabeça e cinto de munição.',ARRAY['roupa:ha-3690','roupa:ca-3691','roupa:ch-210','roupa:lg-270','roupa:sh-290','roupa:ch-630','roupa:lg-695','roupa:sh-725'],0.15,210,'M:hd-180-1.hr-100-61.ha-3690-82.ca-3691-73-73.ch-210-82.lg-270-82.sh-290-73|F:hd-600-1.hr-515-61.ha-3690-82.ca-3691-73-73.ch-630-82.lg-695-82.sh-725-73'),
 ('visual-atleta','Atleta','Boné, camisa, óculos esportivos e mochila.',ARRAY['roupa:ha-5046','roupa:ch-5044','roupa:ea-3925','roupa:ca-5172','roupa:lg-270','roupa:sh-290','roupa:ch-5045','roupa:lg-695','roupa:sh-725'],0.15,211,'M:hd-180-1.hr-100-61.ha-5046.ch-5044.ea-3925-110-73.ca-5172-73-92.lg-270-82.sh-290-92|F:hd-600-1.hr-515-61.ha-5046.ch-5045.ea-3925-110-73.ca-5172-73-92.lg-695-82.sh-725-92'),
 ('visual-heroi','Herói','Elmo de herói e capa vermelha.',ARRAY['roupa:ha-3535','roupa:cc-4942','roupa:ch-210','roupa:lg-270','roupa:sh-290','roupa:ch-630','roupa:lg-695','roupa:sh-725'],0.15,212,'M:hd-180-1.hr-100-61.ha-3535.cc-4942-73-66.ch-210-82.lg-270-82.sh-290-73|F:hd-600-1.hr-515-61.ha-3535.cc-4942-73-66.ch-630-82.lg-695-82.sh-725-73')
ON CONFLICT (chave) DO UPDATE SET nome=EXCLUDED.nome, descricao=EXCLUDED.descricao, classes=EXCLUDED.classes, desconto=EXCLUDED.desconto, ordem=EXCLUDED.ordem, visual=EXCLUDED.visual, ativo=true;
-- 3. Personagens recriados uma vez: guarda o visual de cada um e limpa visual,
-- looks e a abertura (o criador abre de novo na entrada). Quarto, inventário,
-- moedas e XP ficam.
CREATE TABLE IF NOT EXISTS vybe_escritorio_personagens_reinicio (
 chave text PRIMARY KEY,
 criado_em timestamptz NOT NULL DEFAULT now(),
 perfis jsonb NOT NULL
);
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM vybe_escritorio_personagens_reinicio WHERE chave='personagens-2026-10-21') THEN
  RAISE NOTICE 'Personagens já recriados; nada a fazer.';
  RETURN;
 END IF;
 INSERT INTO vybe_escritorio_personagens_reinicio(chave,perfis)
 SELECT 'personagens-2026-10-21', coalesce(jsonb_agg(jsonb_build_object('pessoa_id',pessoa_id,'figura',preferencias->'figura','looks',preferencias->'looks','abertura',preferencias->'abertura')),'[]'::jsonb)
 FROM vybe_escritorio_perfis;
 UPDATE vybe_escritorio_perfis SET preferencias=preferencias - 'figura' - 'looks' - 'abertura', atualizado_em=now();
END $$;
COMMIT;
