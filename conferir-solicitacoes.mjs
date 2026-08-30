// conferir-solicitacoes.mjs — mede o estrago do bug das colunas trocadas.
//
// Até o commit f64c1d5, editar Prioridade ou Formato de uma Solicitação pelo
// painel procurava a opção no catálogo da coluna de PRODUÇÃO e mandava gravar
// nela. O banco da Vybe aceitava — ele só guarda a chave — e o Monday recusava
// a réplica, porque aquela coluna não existe no quadro de Solicitações.
//
// Falha de réplica não desfaz a escrita local. Então cada edição afastava um do
// outro em silêncio: o painel mostrava o valor novo, o Monday guardava o velho.
//
// Este script não conserta nada sozinho. Ele lista. Só com --corrigir ele
// escreve, e mesmo assim só onde o registro da Vybe é mais recente que o do
// Monday — se alguém mexeu no Monday depois, quem manda é o Monday.
//
//   node conferir-solicitacoes.mjs              → só o relatório
//   node conferir-solicitacoes.mjs --corrigir   → manda os valores da Vybe

import { neon } from '@neondatabase/serverless';

const BOARD_DEMANDAS = 8385559107;
// As colunas certas do quadro de Solicitações. As de Produção, que o bug usava
// por engano, são color_mm164yv8 e lista_suspensa0__1.
const COL_PRIORIDADE = 'color_mkwtgakv';
const COL_FORMATO = 'dropdown_mkv8d52z';

const CORRIGIR = process.argv.includes('--corrigir');

function faltando(nome, ondeAchar) {
  console.error(`\n  Falta a variável ${nome}.\n  ${ondeAchar}\n`);
  console.error('  Como passar, numa linha só:');
  console.error(`     ${nome}="valor" node conferir-solicitacoes.mjs\n`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  faltando('DATABASE_URL',
    'É o endereço do banco Neon. Está na Vercel: projeto vybe-painel-v2 →\n'
  + '  Settings → Environment Variables → DATABASE_URL → botão de olho para revelar.');
}
if (!process.env.MONDAY_TOKEN) {
  faltando('MONDAY_TOKEN',
    'É a chave da API do Monday. Está na Vercel, no mesmo lugar: projeto\n'
  + '  vybe-painel-v2 → Settings → Environment Variables → MONDAY_TOKEN.');
}

const sql = neon(process.env.DATABASE_URL);

async function monday(query, variables = {}) {
  const r = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_TOKEN,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });
  const dados = await r.json();
  if (dados.errors) throw new Error(dados.errors.map((e) => e.message).join(' · '));
  return dados.data;
}

// O Monday devolve a coluna de status/dropdown com o rótulo em `text`.
function valorDaColuna(item, colunaId) {
  const c = (item.column_values || []).find((x) => x.id === colunaId);
  return String(c?.text || '').trim();
}

const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

async function main() {
  console.log('\n  Conferindo Solicitações · Prioridade e Formato · Vybe contra Monday\n');

  // 1. o que a Vybe tem. O rótulo sai do catálogo pela coluna CERTA do quadro.
  const nossos = await sql`
    SELECT c.monday_item_id AS id, c.titulo, c.atualizado_em,
           c.prioridade_chave, c.formato_chaves,
           (SELECT o.rotulo FROM vybe_opcoes o
             WHERE o.coluna_id = ${COL_PRIORIDADE} AND o.chave = c.prioridade_chave) AS prioridade,
           (SELECT STRING_AGG(o.rotulo, ', ') FROM vybe_opcoes o
             WHERE o.coluna_id = ${COL_FORMATO} AND o.chave = ANY(c.formato_chaves)) AS formato
      FROM vybe_conteudos c
     WHERE c.board_id = ${BOARD_DEMANDAS}
       AND c.monday_item_id IS NOT NULL
       AND c.removido_em IS NULL`;

  if (!nossos.length) {
    console.log('  Nenhuma Solicitação no banco da Vybe. Nada a conferir.\n');
    return;
  }
  console.log(`  ${nossos.length} Solicitações no banco da Vybe.`);

  // 2. o que o Monday tem. Em blocos, senão a consulta estoura.
  const porId = new Map();
  const ids = nossos.map((n) => String(n.id));
  for (let i = 0; i < ids.length; i += 100) {
    const bloco = ids.slice(i, i + 100);
    const d = await monday(
      `query($ids:[ID!]) { items(ids:$ids) { id name updated_at
         column_values(ids:["${COL_PRIORIDADE}","${COL_FORMATO}"]) { id text } } }`,
      { ids: bloco }
    );
    (d.items || []).forEach((it) => porId.set(String(it.id), it));
    process.stdout.write(`\r  lendo o Monday… ${Math.min(i + 100, ids.length)}/${ids.length}`);
  }
  console.log(`\r  lidas ${porId.size} no Monday.` + ' '.repeat(20));

  // 3. comparar
  const divergentes = [];
  const sumidas = [];
  // A impressao digital do bug: a chave foi gravada, mas nao existe no catalogo
  // da coluna deste quadro — veio do catalogo de Producao.
  const chaveDeOutroQuadro = [];
  for (const n of nossos) {
    const m = porId.get(String(n.id));
    if (!m) { sumidas.push(n); continue; }
    const orfas = [];
    if (n.prioridade_chave && !n.prioridade) orfas.push('Prioridade');
    if ((n.formato_chaves || []).length && !n.formato) orfas.push('Tipo de demanda');
    if (orfas.length) {
      chaveDeOutroQuadro.push({ id: String(n.id), titulo: n.titulo || m.name, orfas,
        monday: { Prioridade: valorDaColuna(m, COL_PRIORIDADE) || '(vazio)',
                  'Tipo de demanda': valorDaColuna(m, COL_FORMATO) || '(vazio)' } });
      continue;
    }

    const campos = [];
    if (!igual(n.prioridade, valorDaColuna(m, COL_PRIORIDADE))) {
      campos.push({ campo: 'Prioridade', coluna: COL_PRIORIDADE,
        vybe: n.prioridade || '(vazio)', monday: valorDaColuna(m, COL_PRIORIDADE) || '(vazio)' });
    }
    if (!igual(n.formato, valorDaColuna(m, COL_FORMATO))) {
      campos.push({ campo: 'Tipo de demanda', coluna: COL_FORMATO,
        vybe: n.formato || '(vazio)', monday: valorDaColuna(m, COL_FORMATO) || '(vazio)' });
    }
    if (campos.length) {
      const nossoMaisNovo = new Date(n.atualizado_em) > new Date(m.updated_at);
      divergentes.push({ id: String(n.id), titulo: n.titulo || m.name, campos, nossoMaisNovo,
        quandoVybe: n.atualizado_em, quandoMonday: m.updated_at });
    }
  }

  console.log(`\n  iguais nos dois ......... ${nossos.length - divergentes.length - sumidas.length - chaveDeOutroQuadro.length}`);
  console.log(`  divergentes ............. ${divergentes.length}`);
  console.log(`  com chave do quadro errado ${chaveDeOutroQuadro.length}`);
  if (sumidas.length) console.log(`  não achadas no Monday ... ${sumidas.length}  (apagadas ou arquivadas lá)`);

  if (chaveDeOutroQuadro.length) {
    console.log('\n  ── chave gravada com o catálogo do quadro errado ──');
    console.log('  Estas são a marca do bug: a Vybe guardou uma chave que não existe no');
    console.log('  catálogo desta coluna, então nem dá para traduzir em rótulo. O valor bom');
    console.log('  é o do Monday — o script NÃO mexe nelas, para não apagar o que sobrou.');
    for (const c of chaveDeOutroQuadro) {
      console.log(`\n  #${c.id}  ${String(c.titulo).slice(0, 62)}`);
      for (const campo of c.orfas) {
        console.log(`     ${campo.padEnd(16)} Vybe: (chave sem tradução)   Monday: ${c.monday[campo]}`);
      }
    }
    console.log('\n  Para consertar estas, basta reabrir cada uma no painel e escolher o valor');
    console.log('  de novo — agora ele grava na coluna certa.');
  }

  if (!divergentes.length) {
    console.log(chaveDeOutroQuadro.length
      ? '\n  Fora essas, nada mais divergiu.\n'
      : '\n  Nada divergiu. O bug não chegou a estragar dado.\n');
    return;
  }

  console.log('\n  ── as divergentes ──');
  for (const d of divergentes) {
    const quem = d.nossoMaisNovo ? 'Vybe mais recente' : 'Monday mais recente';
    console.log(`\n  #${d.id}  ${String(d.titulo).slice(0, 62)}`);
    console.log(`     ${quem}`);
    for (const c of d.campos) {
      console.log(`     ${c.campo.padEnd(16)} Vybe: ${String(c.vybe).padEnd(22)} Monday: ${c.monday}`);
    }
  }

  const paraCorrigir = divergentes.filter((d) => d.nossoMaisNovo);
  console.log(`\n  ${paraCorrigir.length} dessas têm o registro da Vybe mais recente — são as que o bug`);
  console.log('  provavelmente causou: alguém editou no painel e o Monday não recebeu.');
  if (divergentes.length - paraCorrigir.length > 0) {
    console.log(`  As outras ${divergentes.length - paraCorrigir.length} foram mexidas no Monday depois; nelas quem manda é o Monday.`);
  }

  if (!CORRIGIR) {
    console.log('\n  Nada foi alterado. Para mandar os valores da Vybe para o Monday:');
    console.log('     node conferir-solicitacoes.mjs --corrigir\n');
    return;
  }

  console.log('\n  ── corrigindo ──');
  let ok = 0; let erro = 0;
  for (const d of paraCorrigir) {
    // Rótulo em coluna de status vai como {"label": "..."}; em dropdown, como
    // {"labels": [...]}. Prioridade é status; Tipo de demanda é dropdown.
    const values = {};
    for (const c of d.campos) {
      // Nunca mandar vazio: apagaria no Monday o unico valor bom que restou.
      if (c.vybe === '(vazio)') continue;
      values[c.coluna] = c.coluna === COL_FORMATO
        ? { labels: String(c.vybe).split(',').map((x) => x.trim()).filter(Boolean) }
        : { label: c.vybe };
    }
    if (!Object.keys(values).length) {
      console.log(`     · #${d.id} nada a mandar (o lado da Vybe está vazio)`);
      continue;
    }
    try {
      await monday(
        `mutation($item: ID!, $board: ID!, $values: JSON!) {
           change_multiple_column_values(item_id:$item, board_id:$board, column_values:$values) { id } }`,
        { item: d.id, board: String(BOARD_DEMANDAS), values: JSON.stringify(values) }
      );
      ok += 1;
      console.log(`     ✓ #${d.id}  ${String(d.titulo).slice(0, 48)}`);
    } catch (e) {
      erro += 1;
      console.log(`     ✗ #${d.id}  ${e.message}`);
    }
  }
  console.log(`\n  ${ok} corrigidas, ${erro} com erro.\n`);
}

main().catch((e) => { console.error('\n  Parou:', e.message, '\n'); process.exit(1); });
