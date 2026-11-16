// O que falta no cadastro para todo cliente ativo ter a logo (server/logos-clientes.js monta o plano).
//
//   node scripts/logos-clientes.mjs                 ENSAIO (o padrão): lê e mostra o que gravaria; não grava nada
//   node scripts/logos-clientes.mjs --drive         ensaio que também procura a logo no Drive (só leitura no Drive)
//   VYBE_LOGOS_GRAVAR=GRAVAR node scripts/logos-clientes.mjs --gravar [--drive]
//
// Conexões só por variável de ambiente, nunca impressas: DATABASE_URL (o banco do Vybe OS) e, com --drive, as do Drive
// que o servidor já usa (vybe_drive.js). Sem DATABASE_URL o ensaio usa os clientes das carteiras do repositório
// (vybe-config.js) com o cadastro vazio: mostra o que o cérebro sabe, mas o "valor de hoje" fica sem conferir.
// A gravação passa pelo salvarCadastro da ficha (server/clientes-cadastro.js), só nos campos instagram e logo_url,
// e lê de volta para conferir. Nada de SQL solto; nada de apagar campo.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { planejarLogos } from '../server/logos-clientes.js';

const args = process.argv.slice(2);
const tem = (f) => args.includes(f);
const parar = (msg) => { console.error(msg); process.exit(1); };
const querGravar = tem('--gravar'), comDrive = tem('--drive');
if (querGravar && process.env.VYBE_LOGOS_GRAVAR !== 'GRAVAR') parar('Gravação bloqueada: rode com VYBE_LOGOS_GRAVAR=GRAVAR no ambiente. Sem isso é só ensaio.');
if (querGravar && !process.env.DATABASE_URL) parar('Falta DATABASE_URL (o banco do Vybe OS) para gravar.');

const raiz = new URL('..', import.meta.url);
const ler = (f) => readFileSync(new URL(f, raiz), 'utf8');
function doNavegador(arquivo, nome) {
  const c = vm.createContext({ console: { log() {}, warn() {}, error() {} }, window: {}, document: { getElementById: () => null, addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} } });
  return vm.runInContext(`${ler(arquivo)}\n;${nome}`, c);
}
const cerebro = doNavegador('vybe-clientes-cerebro.js', 'VYBES_CEREBRO_BASE');

let clientes, origem, db = null;
if (process.env.DATABASE_URL) {
  const { bancoComTransacoes } = await import('../server/transacao-automacoes.js');
  db = bancoComTransacoes(process.env.DATABASE_URL);
  clientes = await db`SELECT id, nome, cadastro, identidade->>'logo' AS logo, identidade->>'logo_drive' AS logo_drive,
      (COALESCE(ativo,true) AND NOT COALESCE(nao_e_cliente,false)) AS ativo
    FROM vybe_clientes WHERE apagado_em IS NULL ORDER BY nome`;
  origem = 'banco do Vybe OS (só leitura nesta etapa)';
} else {
  const carteiras = doNavegador('vybe-config.js', 'CARTEIRAS_CLIENTES');
  clientes = [...new Set(Object.values(carteiras).flat())].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((nome) => ({ id: null, nome, ativo: true, cadastro: {} }));
  origem = 'carteiras do repositório (vybe-config.js), sem banco: o valor de hoje do cadastro NÃO foi lido';
}

const logosNoDrive = new Map();
if (comDrive) {
  const { logosNoDrive: procurar, logoNaPastaDoCliente } = await import('../vybe_drive.js');
  const pastas = db ? await db`SELECT DISTINCT ON (cliente_id) cliente_id::text AS id, pasta_drive FROM vybe_acessos WHERE pasta_drive IS NOT NULL ORDER BY cliente_id, atualizado_em DESC NULLS LAST` : [];
  const pastaDe = new Map(pastas.map((p) => [p.id, String(p.pasta_drive || '').match(/folders\/([\w-]{10,80})/)?.[1] || '']));
  for (const c of clientes) {
    if (c.ativo === false || c.cadastro?.logo_url || c.logo || c.logo_drive || c.id == null) continue;
    try {
      const pasta = pastaDe.get(String(c.id));
      let [melhor] = pasta ? await logoNaPastaDoCliente(pasta, c.nome) : [];
      if (!melhor) { const [achado] = await procurar(c.nome); if (achado && achado.nota >= 3) melhor = achado; }
      if (melhor) logosNoDrive.set(String(c.id), melhor);
    } catch (e) { console.warn(`Drive: ${c.nome}: ${String(e?.message || e).slice(0, 120)}`); }
  }
}

const plano = planejarLogos(clientes, { cerebro, logosNoDrive });
const mostrar = (v) => (v ? v : '(vazio)');
console.log(`Modo: ${querGravar ? 'GRAVAÇÃO' : 'ENSAIO (nada é gravado)'} · origem: ${origem}${comDrive ? ' · com busca no Drive' : ' · sem busca no Drive'}`);
console.log(`\nO que ${querGravar ? 'vai ser gravado' : 'seria gravado'} (${plano.mudar.length}):`);
for (const m of plano.mudar) console.log(`  - ${m.cliente} (id ${m.cliente_id ?? '?'}) · ${m.campo}: ${mostrar(m.hoje)} → ${m.novo}  [${m.motivo}]`);
console.log(`\nPara conferir, sem gravar (${plano.conferir.length}):`);
for (const m of plano.conferir) console.log(`  - ${m.cliente} · ${m.campo}: cadastro ${m.hoje} · cérebro ${m.cerebro}`);
console.log(`\nCom logo depois disso (${plano.prontos.length}): ${plano.prontos.map((p) => `${p.cliente} (${p.fontes.join(', ')})`).join('; ') || '—'}`);
console.log(`Sem logo ainda (${plano.sem.length}): ${plano.sem.map((p) => p.cliente).join(', ') || '—'}`);

if (!querGravar) { console.log('\nEnsaio: nada foi gravado.'); process.exit(0); }
if (plano.mudar.some((m) => m.cliente_id == null)) parar('Há cliente sem id no plano; a gravação só roda com os clientes lidos do banco.');
const { salvarCadastro } = await import('../server/clientes-cadastro.js');
const porCliente = new Map();
for (const m of plano.mudar) porCliente.set(m.cliente_id, { ...(porCliente.get(m.cliente_id) || {}), [m.campo]: m.novo });
for (const [id, campos] of porCliente) {
  await salvarCadastro(db, id, campos, { veDinheiro: false });
  const [volta] = await db`SELECT nome, cadastro FROM vybe_clientes WHERE id=${id}`;
  const ok = Object.entries(campos).every(([k, v]) => String(volta?.cadastro?.[k] || '') === v);
  console.log(`  ${ok ? 'gravado' : 'NÃO CONFERE'}: ${volta?.nome} · ${Object.keys(campos).join(', ')}`);
}
