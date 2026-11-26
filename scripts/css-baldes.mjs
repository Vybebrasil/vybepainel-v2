// Seletores que o navegador consegue separar por balde (confere de leveza, 26/11/2026).
//
// O Chrome guarda cada regra num "balde" pela parte mais à direita do seletor: o id, uma classe, um atributo ou a
// tag. Na hora de calcular o estilo de um elemento ele só testa as regras dos baldes daquele elemento. A regra cuja
// parte da direita começa com :is(...) ou :where(...) com mais de um item não tem balde: vai para a lista
// "universal" e é testada contra TODOS os elementos da página, em todo recálculo. O Vybe OS tinha ~900 regras
// assim (ex.: `body.mundo :is(.v2f-chip, .v2c-chip, ...)`), e elas eram mais da metade do tempo de casar seletor
// na troca de módulo (medido com o rastro SelectorStats do Chrome).
//
// Esta função reescreve só essas regras, sem mudar o que elas pegam nem a especificidade:
//   X :is(A, B)  →  X :where(a):is(A, B), X :where(b):is(A, B)
// onde a/b é um seletor simples (id, classe, atributo ou tag) que A/B exige no elemento. :where() não soma
// especificidade, então cada alternativa pega exatamente os elementos de antes com o mesmo peso de antes, e o
// :where(a) de um item só dá o balde ao Chrome. Quando todos os itens são compostos simples (sem combinador nem
// função) e com o mesmo peso, a forma é a curta: `X A, X B`.
// Regra que não dá para provar igual (item sem id/classe/atributo/tag, comentário no meio, aninhamento com &)
// fica como está. Roda no build e no servidor local, sobre o texto das folhas; o fonte não muda.

const ABRE = { '(': ')', '[': ']' };

// Divide no separador de nível 0 (fora de (), [] e aspas).
function dividir(txt, sep) {
  const out = []; let ini = 0, prof = 0, aspa = '';
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (c === '\\') { i++; continue; }
    if (aspa) { if (c === aspa) aspa = ''; continue; }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof--;
    else if (prof === 0 && c === sep) { out.push(txt.slice(ini, i)); ini = i + 1; }
  }
  out.push(txt.slice(ini));
  return out;
}

// Posição onde começa o composto mais à direita (depois do último combinador de nível 0).
function inicioDoUltimoComposto(sel) {
  let prof = 0, aspa = '', ini = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '\\') { i++; continue; }
    if (aspa) { if (c === aspa) aspa = ''; continue; }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof--;
    else if (prof === 0 && (/\s/.test(c) || c === '>' || c === '+' || c === '~')) ini = i + 1;
  }
  return ini;
}

// Fecha o grupo que abre em txt[i] ('(' ou '['); devolve o índice do fechamento.
function fechar(txt, i) {
  const pilha = [ABRE[txt[i]]]; let aspa = '';
  for (let j = i + 1; j < txt.length; j++) {
    const c = txt[j];
    if (c === '\\') { j++; continue; }
    if (aspa) { if (c === aspa) aspa = ''; continue; }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (ABRE[c]) pilha.push(ABRE[c]);
    else if (c === pilha[pilha.length - 1]) { pilha.pop(); if (!pilha.length) return j; }
  }
  return -1;
}

const IDENT = /^-?(?:[_a-zA-Z -￿]|\\.)(?:[-_a-zA-Z0-9 -￿]|\\.)*/;
// Quebra um composto em seletores simples: [{ tipo, texto, args? }]. null se não reconhece.
function simples(comp) {
  const out = []; let i = 0;
  while (i < comp.length) {
    const resto = comp.slice(i); let m;
    if (resto[0] === '*') { out.push({ tipo: 'univ', texto: '*' }); i++; continue; }
    if (resto[0] === '.' || resto[0] === '#') {
      m = resto.slice(1).match(IDENT); if (!m) return null;
      out.push({ tipo: resto[0] === '.' ? 'classe' : 'id', texto: resto[0] + m[0] }); i += 1 + m[0].length; continue;
    }
    if (resto[0] === '[') { const f = fechar(comp, i); if (f < 0) return null; out.push({ tipo: 'attr', texto: comp.slice(i, f + 1) }); i = f + 1; continue; }
    if (resto[0] === ':') {
      const duplo = resto[1] === ':'; m = resto.slice(duplo ? 2 : 1).match(IDENT); if (!m) return null;
      let fim = i + (duplo ? 2 : 1) + m[0].length; let args = null;
      if (comp[fim] === '(') { const f = fechar(comp, fim); if (f < 0) return null; args = comp.slice(fim + 1, f); fim = f + 1; }
      out.push({ tipo: duplo ? 'pseudoel' : 'pseudo', nome: m[0].toLowerCase(), args, texto: comp.slice(i, fim) }); i = fim; continue;
    }
    m = resto.match(IDENT);
    if (m && i === 0) { out.push({ tipo: 'tag', texto: m[0] }); i += m[0].length; continue; }
    return null;
  }
  return out;
}

const COM_BALDE = new Set(['id', 'classe', 'attr', 'tag']);
// A chave de balde que um seletor complexo exige no elemento (ou várias, se a direita for outro :is).
function chaves(arg) {
  const a = arg.trim(); if (!a || /&|\/\*/.test(a)) return null;
  const comp = simples(a.slice(inicioDoUltimoComposto(a)));
  if (!comp || !comp.length) return null;
  const id = comp.find((s) => s.tipo === 'id'); if (id) return [id.texto];
  const classes = comp.filter((s) => s.tipo === 'classe'); if (classes.length) return [classes[classes.length - 1].texto];
  const attr = comp.find((s) => s.tipo === 'attr'); if (attr) return [attr.texto];
  const tag = comp.find((s) => s.tipo === 'tag'); if (tag) return [tag.texto];
  const lista = comp.find((s) => s.tipo === 'pseudo' && (s.nome === 'is' || s.nome === 'where') && s.args);
  return lista ? chavesDaLista(lista.args) : null;
}
function chavesDaLista(args) {
  const todas = [];
  for (const arg of dividir(args, ',')) { const c = chaves(arg); if (!c) return null; for (const k of c) if (!todas.includes(k)) todas.push(k); }
  return todas.length ? todas : null;
}

// Peso de um composto simples (só tag, classe, id, atributo e pseudo-classe sem parênteses).
function pesoSimples(arg) {
  const comp = simples(arg.trim());
  if (!comp || !comp.length) return null;
  let a = 0, b = 0, c = 0;
  for (const s of comp) {
    if (s.tipo === 'id') a++; else if (s.tipo === 'classe' || s.tipo === 'attr') b++; else if (s.tipo === 'tag') c++;
    else if (s.tipo === 'pseudo' && s.args === null) b++; else return null;
  }
  return `${a},${b},${c}`;
}

function reescreverComplexo(sel) {
  const ini = inicioDoUltimoComposto(sel); const prefixo = sel.slice(0, ini), comp = sel.slice(ini);
  const partes = simples(comp);
  if (!partes || partes.some((s) => COM_BALDE.has(s.tipo))) return null;
  // Já tem balde: um :where()/:is() de um item só, que é id, classe, atributo ou tag (o que esta função escreve).
  if (partes.some((s) => s.tipo === 'pseudo' && (s.nome === 'is' || s.nome === 'where') && s.args && simples(s.args.trim())?.length === 1
    && COM_BALDE.has(simples(s.args.trim())[0].tipo))) return null;
  const k = partes.findIndex((s) => s.tipo === 'pseudo' && (s.nome === 'is' || s.nome === 'where') && s.args);
  if (k < 0) return null;
  const lista = partes[k]; const itens = dividir(lista.args, ',').map((x) => x.trim());
  // Forma curta: :is com itens compostos simples, todos do mesmo peso.
  if (lista.nome === 'is' && itens.every((x) => x && !/\s|>|\+|~/.test(x))) {
    const pesos = itens.map(pesoSimples);
    if (pesos.every((p) => p && p === pesos[0])) {
      const resto = partes.filter((_, j) => j !== k).map((s) => s.texto).join('');
      // A tag do item precisa ficar na frente do composto; o resto vem depois.
      return itens.map((x) => prefixo + x + resto);
    }
  }
  const ks = chavesDaLista(lista.args);
  if (!ks) return null;
  return ks.map((chave) => `${prefixo}:where(${chave})${comp}`);
}

function reescreverLista(prelude) {
  let mudou = false;
  const sels = dividir(prelude, ',').map((s) => {
    const t = s.trim(); const novo = /:(is|where)\(/i.test(t) ? reescreverComplexo(t) : null;
    if (novo) { mudou = true; return novo.join(','); }
    return t;
  });
  return mudou ? sels.join(',') : null;
}

// Reescreve as regras sem balde de uma folha inteira. Devolve { css, regras } (regras = quantas mudaram).
export function baldearCss(css) {
  let out = '', ultimo = 0, prof = 0, aspa = '', regras = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '\\') { i++; continue; }
    if (aspa) { if (c === aspa) aspa = ''; continue; }
    if (c === '/' && css[i + 1] === '*') { const f = css.indexOf('*/', i + 2); i = f < 0 ? css.length : f + 1; continue; }
    if (c === '"' || c === "'") { aspa = c; continue; }
    if (c === '(') prof++;
    else if (c === ')') prof = Math.max(0, prof - 1);
    else if (prof === 0 && (c === ';' || c === '}')) { out += css.slice(ultimo, i + 1); ultimo = i + 1; }
    else if (prof === 0 && c === '{') {
      const trecho = css.slice(ultimo, i);
      // Separa o que vem antes do seletor (espaços e comentários) do seletor em si.
      const m = trecho.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)*)([\s\S]*)$/);
      const antes = m[1], sel = m[2];
      const novo = sel.trim() && !sel.trim().startsWith('@') && !sel.includes('/*') && /:(is|where)\(/i.test(sel) ? reescreverLista(sel) : null;
      if (novo) { regras++; out += antes + novo + (/\s$/.test(sel) ? ' ' : ''); } else out += trecho;
      out += '{'; ultimo = i + 1;
    }
  }
  out += css.slice(ultimo);
  return { css: out, regras };
}
