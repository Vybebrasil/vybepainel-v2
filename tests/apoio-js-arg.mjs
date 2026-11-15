// jsArg de verdade (vybe-gestor.js) para os testes que montam uma tela sem carregar o gestor.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fonte = readFileSync(new URL('../vybe-gestor.js', import.meta.url), 'utf8');
const ini = fonte.indexOf('const JS_ARG_RE');
const fim = fonte.indexOf('\n}', fonte.indexOf('function safeText(value) {')) + 2;
const ctx = vm.createContext({});
vm.runInContext(`${fonte.slice(ini, fim)}\nthis.jsArg = jsArg;`, ctx);
export const jsArg = ctx.jsArg;
