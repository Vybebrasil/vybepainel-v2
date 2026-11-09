// PRÉ-PARTIDA DA SINUCA (Paulo, 09/11/2026: "por que ela não vira uma tela de
// pré-entrada na partida, onde cada player tem que dar um preparado? E pode
// ser até a hora das apostas de quem tá dentro e assistindo").
//
// Vale na partida 1×1 entre a equipe (sem bot, sem cliente, sem dupla). Depois
// do aceite a mesa fica em `mesa.pre` até os dois darem PREPARADO ou o relógio
// acabar (ninguém fica preso esperando quem saiu da tela). Enquanto isso não
// tem tacada nem relógio da vez; a torcida já aposta (a da primeira tacada vale
// para quem quebra). Quando abre, a vez começa a contar dali.
export const PRE_S = 60;
const LADOS = ['desafiante', 'desafiado'];

export const preValeNaMesa = (j) => j?.jogo === 'sinuca' && !j.bot && !(j.mais || []).length && !(j.clientes || []).length;

export function abrirPre(agora = Date.now()) {
 return { prontos: [], ate: new Date(agora + PRE_S * 1000).toISOString() };
}
// Ainda segurando a mesa? (os dois prontos ou o relógio no fim: não)
export function preAberta(mesa, agora = Date.now()) {
 const p = mesa?.pre;
 if (!p) return false;
 if (LADOS.every((l) => (p.prontos || []).includes(l))) return false;
 return agora < new Date(p.ate).getTime();
}
// Marca o lado como pronto. Devolve a mesa nova e se a partida começou agora.
export function marcarPronto(mesa, lado, agora = Date.now()) {
 if (!LADOS.includes(lado)) throw new Error('Só quem joga dá PREPARADO.');
 if (!mesa?.pre) return { mesa, comecou: false, repetido: true };
 const prontos = [...new Set([...(mesa.pre.prontos || []), lado])];
 const novo = { ...mesa, pre: { ...mesa.pre, prontos } };
 if (preAberta(novo, agora)) return { mesa: novo, comecou: false };
 const { pre, ...resto } = novo;
 return { mesa: resto, comecou: true };
}
// Tira a pré-partida da mesa (relógio acabou).
export function fecharPre(mesa) {
 if (!mesa?.pre) return mesa;
 const { pre, ...resto } = mesa;
 return resto;
}
// O que a tela recebe.
export function vistaPre(mesa, agora = Date.now()) {
 if (!preAberta(mesa, agora)) return null;
 return { prontos: [...mesa.pre.prontos], ate: mesa.pre.ate, total: PRE_S };
}
