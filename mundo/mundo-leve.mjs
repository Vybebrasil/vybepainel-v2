// Entrada leve do mundo voxel (confere da-6, 19/11/2026): a leitura dos agentes e a planta do prédio, sem three.js.
// É o que o Hoje, a Gestão, o Boletim e a página Agentes usam com o Centro fechado. Antes isso vinha dentro do
// mundo-3d.js inteiro (1,2 MB no build), que baixava e rodava na abertura do painel mesmo sem ninguém abrir o mundo.
export { criarFonteAgentes, apresentarAgente, referenciaDaPeca, ESTADOS_REAIS } from './atividade-agentes.mjs';
export { PLANTA, ESTADOS, ZONAS_DO_PREDIO } from './planta.mjs';
// Nome e categoria das peças voxel na Loja do Escritório (o mesmo CATALOGO de catalogo.mjs, que é este JSON).
export { default as CATALOGO } from './catalogo-ligacao.json' with { type: 'json' };
