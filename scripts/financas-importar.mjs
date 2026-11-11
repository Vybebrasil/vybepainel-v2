// Importador do histórico do Vybe Finanças para o banco do Vybe OS (Paulo, 11/11/2026; fase 1 de abolir o Finanças).
//
//   node scripts/financas-importar.mjs --demo                  dados inventados, tudo em memória (não precisa de banco)
//   node scripts/financas-importar.mjs --dry-run               lê o Finanças e o Vybe OS de verdade, NÃO grava (é o padrão)
//   VYBE_FINANCAS_IMPORTAR=GRAVAR node scripts/financas-importar.mjs --gravar
//
// Opções: --hoje AAAA-MM-DD (dia de referência do atraso; padrão: hoje na Bahia) · --saida arquivo.md ·
//         --aceitar-diferencas (só com --gravar: grava mesmo se a conferência der diferença; sem isso, desfaz tudo).
//
// Conexões, só por variável de ambiente (nunca na linha de comando, nunca impressas):
//   VYBE_FINANCAS_DB_URL   a MESMA conexão só-SELECT da ponte (papel vybe_os_leitura do Supabase do Finanças);
//   DATABASE_URL           o banco do Vybe OS (Neon). No --dry-run só é lido (clientes, pessoas e se a migração existe).
//
// O que cada modo faz:
//   --dry-run  lê as duas pontas, monta o plano e ENSAIA a gravação num banco em memória (PGlite) com a migração
//              2026-11-11-financas-base.sql aplicada; roda a gravação duas vezes (idempotência), lê de volta pelo leitor
//              do Vybe OS (server/financas-local.js) e compara com a ponte pelas contas de shared/financas-calculos.js.
//   --gravar   o mesmo plano, numa transação no banco do Vybe OS; confere dentro da transação e, com diferença,
//              desfaz tudo (ROLLBACK). Exige a migração aplicada e VYBE_FINANCAS_IMPORTAR=GRAVAR.
// Nada aqui escreve no Finanças. O relatório tem valores reais: fica fora do repositório (.gitignore).
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { criarConectorFinancas, OPCOES_CONEXAO, VARIAVEL, urlValida, traduzirErro } from '../server/vybe-financas.js';
import { lerOrigemDoFinancas, baseDaOrigem, planejar, gravar, conferir, relatorio, basesIguais, podeGravar, VARIAVEL_GRAVAR, VALOR_GRAVAR } from '../server/financas-importacao.js';
import { lerBaseLocal } from '../server/financas-local.js';
import { clientesDoVybe, hojeNaBahia } from '../server/vybe-financas-api.js';
import { bancoComTransacoes } from '../server/transacao-automacoes.js';

const args = process.argv.slice(2);
const tem = (f) => args.includes(f);
const valorDe = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const parar = (msg, codigo = 1) => { console.error(msg); process.exit(codigo); };

const demo = tem('--demo'), querGravar = tem('--gravar');
if (querGravar && (demo || tem('--dry-run'))) parar('Escolha um modo só: --demo, --dry-run ou --gravar.');
const modo = demo ? 'demonstração (dados inventados)' : querGravar ? 'gravação' : 'dry-run (nada gravado)';
const hoje = valorDe('--hoje') || hojeNaBahia();
if (!/^\d{4}-\d{2}-\d{2}$/.test(hoje)) parar('--hoje precisa ser AAAA-MM-DD.');
const saida = valorDe('--saida') || `financas-importacao-${demo ? 'demo' : querGravar ? 'gravacao' : 'dry-run'}-${hoje}.md`;
if (querGravar && !podeGravar()) parar(`Gravação bloqueada: rode com ${VARIAVEL_GRAVAR}=${VALOR_GRAVAR} no ambiente. Sem isso o importador só faz --dry-run.`);

const pessoasDoVybe = (sql) => sql`SELECT id::text, nome FROM vybe_pessoas WHERE COALESCE(ativo, true) ORDER BY nome`;
const avisos = [];

// ---------- 1. As duas pontas ----------
let origem, antes, ponte = null, vybe, pessoas, destino = null, fechar = async () => {};
if (demo) {
  const { criarFinancasDeDemonstracao, DEMO_VYBE } = await import('./financas-demo.mjs');
  const fin = await criarFinancasDeDemonstracao();
  origem = await lerOrigemDoFinancas(fin.consultar);
  // A ponte de verdade (server/vybe-financas.js) lendo o mesmo banco de demonstração.
  antes = await criarConectorFinancas({ env: { [VARIAVEL]: 'postgresql://demo' }, criarSql: () => fin.comoPostgres }).lerBase({ desde: '1900-01-01' });
  vybe = DEMO_VYBE.clientes.filter((c) => c.ativo !== false).map((c) => ({ id: String(c.id), nome: c.nome, cnpj: c.cnpj || '', financas_cliente_id: null }));
  pessoas = DEMO_VYBE.pessoas.map((p) => ({ id: String(p.id), nome: p.nome }));
  avisos.push('Demonstração: os dados abaixo são inventados. A conexão de leitura do Finanças não estava disponível neste ambiente.');
} else {
  const urlFin = String(process.env[VARIAVEL] || '').trim();
  if (!urlValida(urlFin)) parar(`Falta ${VARIAVEL} (a conexão só-SELECT da ponte). Sem ela, use --demo para ver o importador com dados inventados.`);
  if (!process.env.DATABASE_URL) parar('Falta DATABASE_URL (o banco do Vybe OS). No --dry-run ele só é lido.');
  const fin = postgres(urlFin, { ...OPCOES_CONEXAO });
  fechar = async () => { await fin.end({ timeout: 2 }).catch(() => {}); };
  try {
    origem = await fin.begin('read only', (tx) => lerOrigemDoFinancas((texto) => tx.unsafe(texto)));
    // A ponte de verdade, com a conexão dela, para o "antes" ser exatamente o que a tela recebe hoje.
    const conector = criarConectorFinancas();
    try { antes = await conector.lerBase({ desde: '1900-01-01' }); } finally { await conector.fechar(); }
  } catch (e) {
    await fechar();
    // Nunca a URL, a senha nem a mensagem crua do Postgres.
    parar(`Não deu para ler o Finanças: ${e?.codigo === 'permissao' ? e.message : traduzirErro(e).message}`);
  }
  destino = bancoComTransacoes(process.env.DATABASE_URL);
  vybe = [...await clientesDoVybe(destino)];
  pessoas = [...await pessoasDoVybe(destino)];
}
// A leitura do importador tem que ser a da ponte (mesmas linhas, mesmos valores), senão a comparação não vale.
ponte = { igual: basesIguais(antes, baseDaOrigem(origem)) };
if (antes.transacoes.length >= 50000) avisos.push('A ponte corta em 50.000 lançamentos: a comparação com ela pode não cobrir o histórico inteiro.');

// ---------- 2. Plano ----------
const plano = planejar(origem, { clientesVybe: vybe, pessoasVybe: pessoas });

// ---------- 3. Ensaio em memória ou gravação de verdade ----------
let depois = null, conferencia = null, gravacao = null, segunda = null, falha = '';
const envGravar = { [VARIAVEL_GRAVAR]: VALOR_GRAVAR };
if (!querGravar) {
  // O banco de ensaio é descartável e só existe na memória deste processo: por isso a trava de gravação é ligada aqui.
  const { criarVybeDeEnsaio } = await import('./financas-demo.mjs');
  const ensaio = await criarVybeDeEnsaio({ clientes: vybe.map((c) => ({ ...c, id: Number(c.id) })), pessoas: pessoas.map((p) => ({ ...p, id: Number(p.id) })) });
  gravacao = await ensaio.sql.comTransacao((tx) => gravar(tx, plano, { env: envGravar }));
  segunda = await ensaio.sql.comTransacao((tx) => gravar(tx, plano, { env: envGravar }));
  depois = await lerBaseLocal(ensaio.sql);
  conferencia = conferir(antes, depois, vybe, { hoje, vybeDepois: [...await clientesDoVybe(ensaio.sql)] });
  if (!demo) avisos.push('Dry-run: nada foi gravado no Vybe OS. A coluna "depois" é a gravação ensaiada num banco em memória com a migração aplicada.');
} else {
  const [pronta] = await destino`SELECT to_regclass('public.vybe_financas_importacoes') IS NOT NULL AS sim`;
  if (!pronta?.sim) { await fechar(); parar('A migração migrations/2026-11-11-financas-base.sql ainda não foi aplicada no banco do Vybe OS. Nada foi gravado.'); }
  try {
    ({ gravacao, depois, conferencia } = await destino.comTransacao(async (tx) => {
      const g = await gravar(tx, plano);
      const d = await lerBaseLocal(tx);
      const c = conferir(antes, d, vybe, { hoje, vybeDepois: [...await clientesDoVybe(tx)] });
      if (!c.iguais && !tem('--aceitar-diferencas')) throw Object.assign(new Error('diferenca'), { conferencia: c, depois: d });
      return { gravacao: g, depois: d, conferencia: c };
    }));
    avisos.push('Gravado no banco do Vybe OS. A tela só passa a ler daqui quando VYBE_FINANCAS_FONTE=local for ligada na Vercel.');
  } catch (e) {
    if (e?.message !== 'diferenca') { await fechar(); parar(`A gravação falhou e foi desfeita (nada ficou gravado). Código: ${e?.code || e?.codigo || 'desconhecido'}.`); }
    ({ conferencia, depois } = e); falha = 'A conferência deu diferença: a gravação foi DESFEITA (nada ficou gravado).';
    avisos.push(falha);
  }
}
await fechar();

// ---------- 4. Relatório ----------
const texto = relatorio({ modo, quando: new Date().toISOString(), hoje, origem, plano, antes, depois, conferencia, gravacao, segunda, ponte, avisos });
writeFileSync(saida, texto, 'utf8');
const p = plano.pendencias;
if (demo) console.log(texto);
console.log([
  `Modo: ${modo}`,
  `Lido do Finanças: ${origem.transactions.length} lançamentos, ${origem.clients.length} clientes, ${origem.employees.length} da equipe, ${origem.contracts.length} contratos.`,
  `Leitura do importador igual à da ponte: ${ponte.igual ? 'sim' : 'NÃO'}`,
  conferencia ? `Conferência: ${conferencia.iguais ? 'diferença zero' : conferencia.diferencas.length + ' diferença(s)'} em ${conferencia.contas_feitas} contas.` : '',
  segunda ? `Segunda rodada (idempotência): ${Object.values(segunda).reduce((s, v) => s + (v && typeof v === 'object' && 'novos' in v ? v.novos : 0), 0)} linha(s) nova(s).` : '',
  `Para decidir: ${p.clientes_sem_par.length} cliente(s) sem par, ${p.clientes_por_nome_parecido.length} ligado(s) por nome parecido, ${p.equipe_sem_par.length} da equipe sem pessoa.`,
  `Não importados: ${p.nao_importados.length}. Ajustados: ${p.ajustes.length}. Sem acesso: ${p.sem_acesso.join(', ') || 'nenhuma tabela'}.`,
  `Relatório: ${saida}`,
].filter(Boolean).join('\n'));
if (falha || (conferencia && !conferencia.iguais) || !ponte.igual) process.exit(2);
