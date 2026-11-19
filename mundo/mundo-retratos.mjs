// Retratos voxel fora do mundo (confere da-6, 19/11/2026): o boneco de cada pessoa e de cada agente, desenhado com o
// three.js, para as fotos do painel (Hoje, Escritório, página Agentes) e o nome das peças da Loja. Não monta Irecê nem o
// Prédio: o mundo-3d.js inteiro só baixa quando o Centro, o Prédio, um andar ou a Minha sala abrem. As partes em comum
// (three.js, avatar, catálogo) saem num pedaço compartilhado pelo build: abrir o mundo depois não baixa nada duas vezes.
export { avatarVoxel, avatarVoxelFiel, figuraFiel, lerFigura, iconeMovel, tipoDoMovel, desenharPreviaAvatar, desenharBoneco, figuraDaPessoa, figuraDoAgente, avatarDoAgente } from './avatar.mjs';
export { CATALOGO, pecaDaClasse } from './catalogo.mjs';
export { criarFonteAgentes, apresentarAgente, referenciaDaPeca, ESTADOS_REAIS } from './atividade-agentes.mjs';
export { PLANTA, ESTADOS, ZONAS_DO_PREDIO } from './planta.mjs';
