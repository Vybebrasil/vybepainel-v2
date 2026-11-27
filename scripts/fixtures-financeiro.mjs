// Demo local do Financeiro (area=financeiro): o servidor de verdade (server/financeiro.js) sobre um PGlite em memória,
// com clientes e extrato FICTÍCIOS. Nada sai deste processo e nada fica gravado ao reiniciar: dá para importar um extrato
// real pela tela para ver como fica, sem ele ir para banco nem para o repositório.
//   DEMO_FIN_MESES=14 (padrão)  catorze meses de extrato, para ver o histórico de 12 meses e a confiança alta
//   DEMO_FIN_MESES=3            o caso do Paulo hoje: só três meses (base baixa, o que pede 12 meses escondido)
//   DEMO_FIN_ATE=2026-11-13     o extrato termina nesse dia (para ver o aviso de extrato parado com o passo a passo)
//   DEMO_FINANCEIRO_VAZIO=1     sem extrato nenhum
//   DEMO_FIN_UM_CONTRATO=1      o caso da produção (26/11/2026): 15 clientes ativos, só um com contrato (R$ 1.200), os
//                               outros pagando pelo extrato (dois sem dizer de quem), ~R$ 30 mil de entrada e ~R$ 21 mil
//                               de saída por mês. Com DEMO_FIN_MESES=3 é o relatório que deu o alarme falso.
//   DEMO_FIN_PRODUCAO=1         o caso da produção depois do #784 (fin3, 26/11/2026): 2 lançamentos à mão no fim de julho,
//                               o extrato do banco de 17/08 a hoje, setembro e outubro cheios (R$ 45,7 mil e R$ 28,7 mil de
//                               entrada, ~R$ 30 mil de saída), 6 combinados (R$ 15.500) pagos por Pix sem pessoa ligada
//                               (2 com outro nome no Pix), pró-labore sem pessoa e 1 contrato de R$ 1.200. Tudo fictício.
//   DEMO_FIN_PESSOAS=1          finpes (27/11/2026): saídas para o time que Pessoas não mostrava. Pix da equipe como "outra
//                               saída" sem pessoa, um apelido, "Pago a" com espaço no fim, duas pessoas duplicadas, um sócio
//                               com pró-labore de agosto a novembro (parte sem conferir) e um cliente no "Pago a". Fictício.
// Finanças completo (26/11/2026): contratos com dia de vencimento, fim e reajuste; um cliente que saiu e um novo; peças
// da produção (rateio), clientes em risco (pessimista), funil do Comercial (otimista), cartão com itens, orçamento,
// um mês fechado, metas e um cenário guardado.
import { conexao } from '../tests/postgres.mjs';
import { lerFinanceiro, escreverFinanceiro } from '../server/financeiro.js';

// [nome, mensalidade, dia do vencimento, início (meses atrás), fim (meses atrás, null = sem fim), [reajuste %, meses atrás]]
const CLIENTES = [
  ['Academia Lions', 1800, 5, 20, null, null], ['Alpha1', 2500, 6, 20, 4, null], ['Brussolo Ristorante', 1500, 5, 20, null, null],
  ['ConectaSim', 3200, 8, 18, null, null], ['DiaLab', 2200, 26, 16, null, null], ['Hebravet', 1200, 5, 20, null, null],
  ['Serra Grande Bebidas', 4000, 18, 20, null, [10, 3]], ['VOA', 900, 10, 5, null, null], ['Nova Era Imóveis', 2800, 12, 2, null, null],
];
// Os seis clientes a mais do caso da produção: [nome, quanto paga por mês, dia, trecho do Pix, ligado ao cliente na conferência]
const EXTRAS = [['Lyo Exemplo', 2500, 7, 'Lyo Exemplo Ltda', true], ['Ótica Exemplo', 2300, 11, 'Otica Exemplo', true], ['Clínica Sorriso Exemplo', 2100, 13, 'Clinica Sorriso Exemplo', true],
  ['Pet Exemplo', 2000, 16, 'Pet Exemplo', true], ['Construtora Exemplo', 1900, 21, 'Joao Exemplo Silva', false], ['Café Exemplo', 1700, 24, 'Maria Exemplo Souza', false]];
const umContrato = () => process.env.DEMO_FIN_UM_CONTRATO === '1';
const brl = (v) => { const n = Math.abs(v).toFixed(2).split('.'); return `${v < 0 ? '-' : ''}${n[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${n[1]}`; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const hojeBahia = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
const mesAtras = (hoje, k) => { const [a, m] = hoje.split('-').map(Number); return new Date(Date.UTC(a, m - 1 - k, 1)).toISOString().slice(0, 7); };
const ultimo = (mes) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
const ativoEm = (c, k) => k <= c[3] && (c[4] == null || k > c[4]);

// Extrato inventado no CSV do banco (mais novo primeiro), terminando hoje. k = meses atrás.
export function csvFicticio(hoje = hojeBahia(), nMeses = 14) {
  const ls = [];
  const valor = (c, k) => (c[5] && k <= c[5][1] ? Math.round(c[1] * (1 + c[5][0] / 100) * 100) / 100 : c[1]);
  const cli = (nome) => CLIENTES.find((c) => c[0] === nome);
  for (let k = nMeses - 1; k >= 0; k--) {
    const M = mesAtras(hoje, k), dia = (d) => `${M}-${String(Math.min(d, ultimo(M))).padStart(2, '0')}`;
    const ate = k === 0 ? Number(hoje.slice(8, 10)) : 31;
    // Caso da produção: o Pix dos clientes antigos chega no nome de quem pagou (sócio, financeiro do cliente), sem o nome
    // da empresa: o extrato não sabe de quem é.
    const PAGADOR = { 'Pix Recebido Alpha Um Comunicacao': 'Pix Recebido Carlos Exemplo Lima', 'Pix Recebido Conecta Sim Telecom': 'Pix Recebido Fulano Exemplo Reis',
      'Pix Recebido Voa Viagens': 'Pix Recebido Ana Exemplo Costa', 'Pix Recebido Nova Era Imoveis': 'Pix Recebido Bruno Exemplo Dias',
      'Pix Recebido Serra Grande Bebidas': 'Pix Recebido Sg Exemplo Comercio', 'Pix Recebido DiaLab Analises': 'Pix Recebido Lab Exemplo Me' };
    const add = (d, h, v) => { if (d <= ate) ls.push([dia(d), umContrato() && PAGADOR[h] ? PAGADOR[h] : h, v]); };
    const sazonal = [1, 0.9, 1, 1.05, 1.1, 1, 0.95, 1, 1.2, 1.1, 1, 1.3][Number(M.slice(5, 7)) - 1]; // dezembro e setembro gastam mais
    add(2, 'Rendimento Liquido De Contamax', 3.12);
    // Lions + Brussolo + Hebravet pagam juntos por boleto no dia 5.
    const boleto = ['Academia Lions', 'Brussolo Ristorante', 'Hebravet'].map(cli).filter((c) => ativoEm(c, k)).reduce((s, c) => s + valor(c, k), 0);
    if (boleto) add(5, 'Cr Cob Bloq Comp Conf Recebimento 0001/000123', boleto);
    if (ativoEm(cli('Alpha1'), k)) add(9, 'Pix Recebido Alpha Um Comunicacao', valor(cli('Alpha1'), k)); // paga 3 dias depois
    add(8, 'Pix Recebido Conecta Sim Telecom', valor(cli('ConectaSim'), k));
    if (ativoEm(cli('VOA'), k)) add(10, 'Pix Recebido Voa Viagens', valor(cli('VOA'), k));
    if (ativoEm(cli('Nova Era Imóveis'), k)) add(14, 'Pix Recebido Nova Era Imoveis', valor(cli('Nova Era Imóveis'), k));
    add(5, 'Pix Enviado Equipe Exemplo Salarios', -5200);
    add(28, 'Pix Enviado Editor Video Freela', -Math.round(900 * sazonal));
    add(10, 'Pix Enviado Vinicius Exemplo Socio', -2380.4);
    add(10, 'Tarifa Avulsa Envio Pix', -1.9);
    add(12, 'Pix Enviado Motorista Exemplo', -Math.round(180 * sazonal));
    add(12, 'Pix Enviado Paulo Exemplo Socio', -96.5);
    add(12, 'Pagamento Fat.cartao Santander', -Math.round(620 * sazonal * 100) / 100);
    add(15, 'Prest. De Emprest. Financiamento PARC 0' + String(10 + (nMeses - 1 - k)).padStart(2, '0') + '/046 1', -812.33);
    add(15, 'Pix Enviado Designer Freela Ficticio', -Math.round(1200 * sazonal));
    if (k !== 2) add(19, 'Pix Recebido Serra Grande Bebidas', valor(cli('Serra Grande Bebidas'), k)); // num mês atrasou e pagou dois no seguinte
    if (k === 1) add(19, 'Pix Recebido Serra Grande Bebidas', valor(cli('Serra Grande Bebidas'), k));
    add(20, 'Pagamento Conta Celular Em Canais INTERNET OPERADORA', -159.9);
    add(20, 'Pix Enviado Ewerton Exemplo Socio', -1500);
    add(20, 'Pix Enviado Deivid Exemplo Socio', -1500);
    add(20, 'Pagamento Das Simples Nacional', -Math.round(boleto * 0.06 + 600));
    add(22, 'Pix Enviado Motorista Exemplo', -150);
    add(25, 'Pix Enviado Restaurante Ficticio', -Math.round(68 * sazonal));
    if (k !== 1 && k !== 0) add(27, 'Pix Recebido DiaLab Analises', 2200); // a DiaLab não pagou o mês passado (nem este, ainda)
    if (k % 4 === 3) add(23, 'Pix Enviado Grafica Ficticia Impressos', -480);
    add(27, 'Comissao Recurso Nao Disp. Dia', -14.27);
    add(28, 'Pix Automatico Enviado Programa Ficticio', -103.4);
    if (umContrato()) {
      for (const [, v, d, pix] of EXTRAS) add(d, `Pix Recebido ${pix}`, v);
      add(5, 'Pix Enviado Equipe Exemplo Salarios Producao', -4000);
      add(6, 'Pix Enviado Imobiliaria Exemplo Aluguel', -1200);
    }
  }
  ls.sort((x, y) => x[0].localeCompare(y[0]));
  let saldo = 900;
  const linhas = ls.map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  return ['AGENCIA;"0001";CONTA;"99999"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
    ...linhas.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n');
}

// ---------- DEMO_FIN_PRODUCAO=1: o caso igual à produção (fin3) ----------
// [id, nome no Vybe OS, combinado, como o nome aparece no Pix]: os 4 primeiros com o nome inteiro, os 2 últimos por outra conta.
const TIME_PROD = [[11, 'Ana Exemplo Lima', 3000, 'Ana Exemplo Lima'], [12, 'Bruno Teste Costa', 2800, 'Bruno Teste Costa'], [13, 'Carla Modelo Dias', 2700, 'Carla Modelo Dias'],
  [14, 'Diego Amostra Reis', 2500, 'Diego Amostra Reis'], [15, 'Elisa Ficticia Rocha', 2500, 'Conta Conjunta Exemplo'], [16, 'Fabio Simulado Nunes', 2000, 'Mae Do Fabio Exemplo']];
const NOMES_CLI = ['Um', 'Dois', 'Tres', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez'];
const prodLigada = () => process.env.DEMO_FIN_PRODUCAO === '1';
export function csvProducao(hoje = hojeBahia()) {
  const ls = [];
  const add = (d, h, v) => { if (d <= hoje) ls.push([d, h, v]); };
  // Agosto: o extrato do banco começa em 17/08.
  add('2026-08-17', 'Pix Recebido Cliente Dois Exemplo', 3800); add('2026-08-20', 'Pix Recebido Empresa Exemplo Pagadora', 9000);
  for (const [, , v, pix] of TIME_PROD) add('2026-08-25', 'Pix Enviado ' + pix, -v);
  add('2026-08-28', 'Pagamento Das Simples Nacional', -2500);
  for (const [M, entradas, pro] of [['2026-09', 45700, 4500], ['2026-10', 28700, 4000], ['2026-11', 30000, 4200]]) {
    const fixas = [['01', 'Rendimento Liquido De Contamax', 12], ['10', 'Pix Recebido Cliente Um Exemplo', 1200], ['05', 'Pix Recebido Cliente Dois Exemplo', 3800], ['08', 'Pix Recebido Cliente Tres Exemplo', 3000],
      ['12', 'Pix Recebido Cliente Quatro Exemplo', 2500], ['15', 'Pix Recebido Cliente Cinco Exemplo', 2000]];
    for (const [d, h, v] of fixas) add(M + '-' + d, h, v);
    const resto = Math.round((entradas - fixas.reduce((a, x) => a + x[2], 0)) * 100) / 100, parte = Math.floor(resto / 6 * 100) / 100;
    for (let k = 0; k < 6; k++) add(M + '-' + String(3 + k * 4).padStart(2, '0'), 'Pix Recebido Empresa Exemplo Pagadora', k < 5 ? parte : Math.round((resto - parte * 5) * 100) / 100);
    for (const [, , v, pix] of TIME_PROD) add(M + '-05', 'Pix Enviado ' + pix, -v);
    add(M + '-06', 'Pix Enviado Socio Exemplo Prolabore', -pro);
    add(M + '-05', 'Pagamento Aluguel Sala Exemplo', -1500);
    add(M + '-28', 'Pagamento Fat.cartao Santander', -4000); add(M + '-20', 'Pagamento Das Simples Nacional', -2500);
    add(M + '-12', 'Pix Automatico Enviado Programa Ficticio', -1200); add(M + '-22', 'Pix Enviado Posto Exemplo', -800);
  }
  ls.sort((x, y) => x[0].localeCompare(y[0]));
  let saldo = 12000;
  const linhas = ls.map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  return ['AGENCIA;"0001";CONTA;"99999"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)',
    ...linhas.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n');
}
async function montarProducao(db, sql, ir, hoje) {
  for (const [id, nome] of TIME_PROD) await db.query('INSERT INTO vybe_pessoas VALUES ($1,$2)', [id, nome]);
  for (let i = 1; i <= 10; i++) await db.query('INSERT INTO vybe_clientes (id,nome) VALUES ($1,$2)', [i, 'Cliente ' + NOMES_CLI[i - 1] + ' Exemplo']);
  await db.query("INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES (1, 1200, '2026-11-01')");
  await ir({ acao: 'importar', csv: csvProducao(hoje) });
  await ir({ acao: 'contrato_salvar', cliente_id: '1', valor_mensal: 1200, dia_vencimento: 10, inicio: '2026-11-01', fim: '', sem_fim: true, status: 'ativo' });
  // Julho: 2 lançamentos à mão no fim do mês (sem saldo do banco), como na produção.
  await ir({ acao: 'lancar_mao', lancamento: { tipo: 'entrada', valor: 3800, data: '2026-07-29', categoria: 'receita_cliente', cliente_id: '2', cliente_nome: 'Cliente Dois Exemplo', texto: 'Mensalidade de julho' } });
  await ir({ acao: 'lancar_mao', lancamento: { tipo: 'saida', valor: 350, data: '2026-07-30', categoria: 'ferramentas', texto: 'Assinatura' } });
  for (const [id, , v] of TIME_PROD) await ir({ acao: 'salario_salvar', pessoa_id: String(id), valor: v, desde: '2026-07' });
  await ir({ acao: 'fixo_salvar', fixo: { nome: 'Aluguel da sala', valor: 1500, dia: 5, categoria: 'estrutura', forma: 'boleto', contem: 'aluguel' } });
  // O lado real como na produção: os clientes 1 a 5 ligados; o time como outra saída e o pró-labore sem pessoa.
  const { lerTudo } = await import('../server/financeiro.js');
  for (const t of (await lerTudo(sql)).extrato.transacoes) {
    const h = t.banco.historico.toLowerCase(), conferido = t.banco.data.slice(0, 7) < hoje.slice(0, 7);
    let mudanca = null;
    const i = NOMES_CLI.slice(0, 5).findIndex((n) => h.includes('cliente ' + n.toLowerCase() + ' exemplo'));
    if (t.banco.valor > 0 && i >= 0) mudanca = { categoria: 'receita_cliente', cliente_id: String(i + 1), cliente_nome: 'Cliente ' + NOMES_CLI[i] + ' Exemplo', conferido };
    else if (t.banco.valor < 0 && TIME_PROD.some((x) => h.includes(x[3].toLowerCase()))) mudanca = { categoria: 'outra_saida', conferido };
    else if (h.includes('prolabore')) mudanca = { categoria: 'pro_labore', conferido };
    else if (h.includes('fat.cartao')) mudanca = { categoria: 'cartao_agencia', conferido };
    if (mudanca) await ir({ acao: 'editar', id: t.id, mudanca });
  }
}

// ---------- DEMO_FIN_PESSOAS=1: os casos de Pessoas (finpes) ----------
// [id, nome, combinado]
const TIME_PES = [[21, 'Rita Exemplo Lima', 2500], [22, 'Ademar Ficticio Santos', 2000], [23, 'Otavio Teste Ramos', 1800], [24, 'Caio Modelo Souza Prado', 0], [31, 'Caio Prado', 0],
  [25, 'Davi Socio Exemplo', 0], [26, 'Tito Freela Exemplo', 0]];
async function montarPessoas(db, sql, ir, hoje) {
  for (const [id, nome] of TIME_PES) await db.query('INSERT INTO vybe_pessoas VALUES ($1,$2)', [id, nome]);
  await db.query("INSERT INTO vybe_clientes (id,nome) VALUES (1,'Loja Exemplo Modas'),(2,'Cliente Dois Exemplo')");
  const ls = [];
  const add = (d, h, v) => { if (d <= hoje) ls.push([d, h, v]); };
  for (const M of ['2026-08', '2026-09', '2026-10', '2026-11']) {
    add(M + '-02', 'Pix Recebido Cliente Dois Exemplo', 12000);
    add(M + '-05', 'Pix Enviado Rita Exemplo Lima', -2500);
    add(M + '-05', 'Pix Enviado Zezinho Ficticio', -1500); add(M + '-18', 'Pix Enviado Zezinho Ficticio', -500); add(M + '-12', 'Pix Enviado Zezinho Ficticio', -120);
    add(M + '-06', 'Pix Enviado Conta Conjunta Exemplo', -1800);
    add(M + '-20', 'Pix Enviado Davi Socio', -1500);
    add(M + '-21', 'Pix Enviado Caio', -1200);
    add(M + '-25', 'Pix Enviado Rita Exemplo Lima', -340);
  }
  add('2026-10-28', 'Pix Enviado Tito Freela Exemplo', -900); add('2026-11-10', 'Pix Enviado Tito Freela Exemplo', -700);
  ls.sort((x, y) => x[0].localeCompare(y[0]));
  let saldo = 8000;
  const linhas = ls.map(([d, h, v]) => { saldo = Math.round((saldo + v) * 100) / 100; return [d, h, v, saldo]; });
  await ir({ acao: 'importar', csv: ['AGENCIA;"0001";CONTA;"99999"', '', 'Data;Histórico;Documento;Valor (R$);Saldo (R$)', ...linhas.reverse().map(([d, h, v, s]) => `"${br(d)}";"${h}";"";"${brl(v)}";"${brl(s)}"`)].join('\r\n') });
  for (const [id, , v] of TIME_PES) if (v) await ir({ acao: 'salario_salvar', pessoa_id: String(id), valor: v, desde: '2026-08' });
  await ir({ acao: 'pessoa_apelidos_salvar', pessoa_id: '22', apelidos: 'Zezinho' });
  const { lerTudo } = await import('../server/financeiro.js');
  let k = 0;
  for (const tr of (await lerTudo(sql)).extrato.transacoes) {
    const h = tr.banco.historico.toLowerCase(), mes = tr.banco.data.slice(0, 7), conferido = mes < hoje.slice(0, 7);
    let mudanca = null;
    if (h.includes('rita') && tr.banco.valor === -2500) mudanca = { categoria: 'outra_saida', conferido };                 // equipe como "outra saída"
    else if (h.includes('rita')) mudanca = { categoria: 'producao', quem: 'Loja Exemplo Modas', conferido };              // cliente no "Pago a"
    else if (h.includes('zezinho')) mudanca = { categoria: tr.banco.valor === -120 ? 'combustivel' : k++ % 2 ? 'salario' : 'outra_saida', conferido }; // apelido
    else if (h.includes('conta conjunta')) mudanca = { categoria: 'salario', quem: 'Otavio ', conferido };              // "Pago a" com espaço
    else if (h.includes('davi')) mudanca = { categoria: 'pro_labore', quem: 'Davi', conferido: mes >= '2026-10' };        // sócio, parte sem conferir
    else if (h.includes('pix enviado caio')) mudanca = { categoria: 'pro_labore', quem: 'Caio ', conferido };             // duplicado
    else if (h.includes('tito')) mudanca = { categoria: 'freela', conferido };
    else if (h.includes('cliente dois')) mudanca = { categoria: 'receita_cliente', cliente_id: '2', cliente_nome: 'Cliente Dois Exemplo', conferido };
    if (mudanca) await ir({ acao: 'editar', id: tr.id, mudanca });
  }
}
let pronto = null;
const TOKEN_DEMO = 'demo-local-so-para-a-demonstracao-do-financeiro-0000'; // fictício, só neste processo
async function banco() {
  if (pronto) return pronto;
  pronto = (async () => {
    const { db, sql } = conexao();
    const hoje = hojeBahia(), nMeses = Math.max(1, Math.min(24, Number(process.env.DEMO_FIN_MESES) || 14));
    await db.exec(`CREATE TABLE vybe_pessoas (id bigint PRIMARY KEY, nome text); INSERT INTO vybe_pessoas VALUES (1,'Operador de teste');
      CREATE TABLE vybe_clientes (id bigint PRIMARY KEY, nome text, ativo boolean DEFAULT true, nao_e_cliente boolean DEFAULT false);
      CREATE TABLE vybe_cliente_contratos (id serial PRIMARY KEY, cliente_id bigint, valor_mensal numeric, inicio date, renovacao date, status text, observacao text,
        atualizado_em timestamptz DEFAULT now(), atualizado_por bigint);
      CREATE TABLE vybe_comercial_financas_cliente (cliente_id bigint PRIMARY KEY, valor_mensal numeric);
      CREATE TABLE vybe_carteira_config (chave text PRIMARY KEY CHECK (chave ~ '^[a-z_]{1,40}$'), valor jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por bigint REFERENCES vybe_pessoas(id));
      CREATE TABLE vybe_conteudos (id serial PRIMARY KEY, titulo text, veiculacao date, status_chave text, removido_em timestamptz);
      CREATE TABLE vybe_conteudo_clientes (conteudo_id bigint, cliente_id bigint);
      CREATE TABLE vybe_carteira_saude_mensal (cliente_id bigint, mes text, risco text);
      CREATE TABLE vybe_crm_oportunidades (id serial PRIMARY KEY, empresa text, etapa text, valor_mensal numeric, valor_avulso numeric);`);
    const quem = { tipo: 'sessao', pessoa: { id: 1, nome: 'Operador de teste', dono: true } };
    const ir = (b) => escreverFinanceiro(sql, quem, b);
    if (prodLigada()) { await montarProducao(db, sql, ir, hoje); return { sql, quem }; }
    if (process.env.DEMO_FIN_PESSOAS === '1') { await montarPessoas(db, sql, ir, hoje); return { sql, quem }; }
    // No caso da produção só a Hebravet (R$ 1.200) tem contrato: os outros 14 clientes ativos não têm mensalidade cadastrada.
    const comContrato = (nome) => !umContrato() || nome === 'Hebravet';
    for (const [i, [nome, valor]] of CLIENTES.entries()) {
      await db.query('INSERT INTO vybe_clientes (id,nome) VALUES ($1,$2)', [i + 1, nome]);
      if (comContrato(nome)) await db.query("INSERT INTO vybe_cliente_contratos (cliente_id, valor_mensal, inicio) VALUES ($1,$2,'2026-01-01')", [i + 1, valor]);
    }
    if (umContrato()) for (const [j, [nome]] of EXTRAS.entries()) await db.query('INSERT INTO vybe_clientes (id,nome) VALUES ($1,$2)', [CLIENTES.length + j + 1, nome]);
    if (process.env.DEMO_FINANCEIRO_VAZIO !== '1') {
      const fimExtrato = /^\d{4}-\d{2}-\d{2}$/.test(process.env.DEMO_FIN_ATE || '') ? process.env.DEMO_FIN_ATE : hoje;
      await ir({ acao: 'importar', csv: csvFicticio(fimExtrato, nMeses) });
      // O contrato completo de cada cliente (o mesmo que o dono salva na ficha do cliente).
      for (const [i, [nomeC, valor, diaV, ini, fim, rj]] of CLIENTES.entries()) {
        if (!comContrato(nomeC)) continue;
        const mf = fim == null ? '' : mesAtras(hoje, fim + 1);
        await ir({ acao: 'contrato_salvar', cliente_id: String(i + 1), valor_mensal: valor, dia_vencimento: diaV, inicio: `${mesAtras(hoje, ini)}-01`,
          fim: mf ? `${mf}-${ultimo(mf)}` : '', sem_fim: fim == null, status: fim == null ? 'ativo' : 'encerrado',
          reajuste_em: rj ? `${mesAtras(hoje, rj[1])}-01` : '', reajuste_pct: rj ? rj[0] : '' });
      }
      // O lado real das entradas, como o dono confere: cada recebimento no cliente dele, o boleto dividido entre os três
      // e o segundo pagamento da Serra Grande no mês que ela atrasou. O mês corrente fica sem conferir (o lote mostra).
      const { lerTudo } = await import('../server/financeiro.js');
      const id = (nome) => { const i = CLIENTES.findIndex((c) => c[0] === nome); return String(i >= 0 ? i + 1 : CLIENTES.length + EXTRAS.findIndex((c) => c[0] === nome) + 1); };
      const PIX = [['alpha um', 'Alpha1'], ['conecta sim', 'ConectaSim'], ['voa viagens', 'VOA'], ['nova era', 'Nova Era Imóveis'], ['serra grande', 'Serra Grande Bebidas'], ['dialab', 'DiaLab'],
        ...(umContrato() ? EXTRAS.filter((c) => c[4]).map((c) => [c[3].toLowerCase(), c[0]]) : [])];
      const vistos = new Set();
      for (const t of (await lerTudo(sql)).extrato.transacoes) {
        if (!(t.banco.valor > 0)) continue;
        // Caso da produção: quase nada foi ligado ao cliente ainda. Só quatro dos clientes novos estão conferidos no
        // cliente; o resto fica como o extrato chegou (o Pix pela regra, o boleto sem dividir).
        if (umContrato() && !EXTRAS.some((c) => c[4] && t.banco.historico.toLowerCase().includes(c[3].toLowerCase()))) continue;
        const h = t.banco.historico.toLowerCase(), mes = t.banco.data.slice(0, 7), conferido = mes < hoje.slice(0, 7);
        let mudanca = null;
        if (h.includes('cr cob bloq')) mudanca = { categoria: 'receita_cliente', conferido, partes: ['Academia Lions', 'Brussolo Ristorante', 'Hebravet'].map((n) => ({ valor: CLIENTES[Number(id(n)) - 1][1], categoria: 'receita_cliente', cliente_id: id(n), cliente_nome: n })) };
        else for (const [p, n] of PIX) if (h.includes(p)) {
          const chave = n + t.banco.data;
          mudanca = { categoria: 'receita_cliente', cliente_id: id(n), cliente_nome: n, conferido, ...(vistos.has(chave) ? { competencia: mesAtras(mes + '-01', 1) } : {}) };
          vistos.add(chave); break;
        }
        if (mudanca) await ir({ acao: 'editar', id: t.id, mudanca });
      }
      for (const f of [{ nome: 'Programa de edição', valor: 103.4, dia: 28, categoria: 'ferramentas', forma: 'pix', contem: 'programa' },
        { nome: 'Internet e celular', valor: 159.9, dia: 20, categoria: 'estrutura', forma: 'debito', contem: 'celular' },
        { nome: 'Empréstimo (46x)', valor: 812.33, dia: 15, categoria: 'emprestimo', forma: 'debito', contem: 'emprest' },
        { nome: 'Aluguel da sala', valor: 1200, dia: 5, categoria: 'estrutura', forma: 'boleto' }]) await ir({ acao: 'fixo_salvar', fixo: f });
      // Peças da produção por cliente e mês (o rateio da equipe na margem): a Serra Grande consome muito, a VOA pouco.
      const pecas = { 1: 6, 2: 8, 3: 5, 4: 10, 5: 9, 6: 4, 7: 22, 8: 3, 9: 12 };
      for (let k = Math.min(nMeses, 12) - 1; k >= 0; k--) {
        const M = mesAtras(hoje, k);
        for (const [id, n] of Object.entries(pecas)) {
          if (!ativoEm(CLIENTES[Number(id) - 1], k)) continue;
          for (let p = 0; p < n; p++) {
            const { rows: [r] } = await db.query('INSERT INTO vybe_conteudos (titulo, veiculacao, status_chave) VALUES ($1,$2,$3) RETURNING id', [`Peça ${p + 1}`, `${M}-${String(1 + (p % 27)).padStart(2, '0')}`, 'publicado']);
            await db.query('INSERT INTO vybe_conteudo_clientes VALUES ($1,$2)', [r.id, Number(id)]);
          }
        }
      }
      // Saúde da Carteira: DiaLab e Hebravet em risco alto (o pessimista perde os dois).
      for (const id of [5, 6]) await db.query("INSERT INTO vybe_carteira_saude_mensal VALUES ($1,$2,'alto')", [id, hoje.slice(0, 7)]);
      await db.query("INSERT INTO vybe_carteira_saude_mensal VALUES (7,$1,'baixo')", [hoje.slice(0, 7)]);
      // Funil do Comercial (o otimista pondera pela chance da etapa).
      for (const [empresa, etapa, vm, va] of [['Clínica Exemplo', 'proposta_comercial', 2400, 0], ['Padaria Exemplo', 'reuniao', 1500, 0], ['Evento Exemplo', 'proposta_comercial', 0, 6000], ['Loja Exemplo', 'empresa', 1800, 0]])
        await db.query('INSERT INTO vybe_crm_oportunidades (empresa, etapa, valor_mensal, valor_avulso) VALUES ($1,$2,$3,$4)', [empresa, etapa, vm, va]);
      // Cartão: itens das três últimas faturas e o dia em que vence.
      await ir({ acao: 'cartao_vencimento', cartao: 'Cartão da agência', dia: 12 });
      for (let k = 3; k >= 1; k--) {
        const fat = mesAtras(hoje, k);
        for (const [descricao, valor, categoria, cliente_id] of [['Adobe Creative Cloud', 290, 'ferramentas', ''], ['Canva Pro', 35, 'ferramentas', ''], ['Impulsionamento Serra Grande', 200, 'producao', '7'], ['Uber reunião', 48, 'viagem', ''], ['Almoço com cliente', 47, 'alimentacao', '4']])
          await ir({ acao: 'cartao_salvar', item: { fatura: fat, data: `${fat}-0${(k % 8) + 1}`, descricao, valor, categoria, cliente_id, status: 'pago' } });
      }
      // Orçamento do mês passado e deste, um mês fechado, metas e um cenário guardado.
      const grupos = { Pessoas: 1500, Sócios: 7000, Operação: 600, Estrutura: 1500, Impostos: 1600, Banco: 30, Empréstimos: 812.33, Cartão: 700, Outros: 300 };
      await ir({ acao: 'orcamento_salvar', mes: mesAtras(hoje, 1), grupos });
      await ir({ acao: 'orcamento_copiar', de: mesAtras(hoje, 1), para: hoje.slice(0, 7), pct: 5 });
      if (nMeses >= 3) await ir({ acao: 'fechar_mes', mes: mesAtras(hoje, 2), observacao: 'Demo: mês conferido.' });
      await ir({ acao: 'meta_salvar', metas: { mrr: 25000, margem_pct: 20, caixa_minimo: 5000 } });
      await ir({ acao: 'cenario_salvar', cenario: { nome: 'Contratar um designer', contratar: [{ nome: 'Designer', salario: 3000, a_partir: 2 }] } });
      // O que o Vorcaro teria lido no grupo Vybe Financeiro (fictício): um que já está no extrato e um em dinheiro vivo.
      const { areaFinanceiroBot } = await import('../server/financeiro.js');
      const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10), mot = csvFicticio(hoje, nMeses).split('\r\n').find((l) => l.includes('Motorista'));
      const dataMot = mot ? mot.slice(7, 11) + '-' + mot.slice(4, 6) + '-' + mot.slice(1, 3) : ontem;
      const res = { status() { return this; }, json() { return this; } };
      await areaFinanceiroBot({ method: 'POST', headers: { authorization: 'Bearer ' + TOKEN_DEMO }, body: { acao: 'propor', propostas: [
        { id_externo: 'demo-1', autor: 'Vinícius', anexo: 'print', texto: 'Gasolina do Mizinho para a captação', tipo: 'saida', valor: 180, data: dataMot, categoria: 'combustivel', quem: 'Mizinho' },
        { id_externo: 'demo-2', autor: 'Paulo', anexo: 'audio', texto: 'Paguei o almoço da equipe em dinheiro', tipo: 'saida', valor: 86, data: ontem, categoria: 'alimentacao', quem: 'Restaurante' }] } }, res, () => sql, { VYBE_AI_BOT_TOKEN: TOKEN_DEMO });
    }
    return { sql, quem };
  })();
  return pronto;
}

export async function financeiroDemo(req, url, body, reply) {
  try {
    const { sql, quem } = await banco();
    if (req.method === 'POST') {
      let d = {}; try { d = JSON.parse(String(body || '{}')); } catch { return reply(400, { error: 'JSON inválido.' }); }
      return reply(200, { ok: true, ...await escreverFinanceiro(sql, quem, d) });
    }
    return reply(200, { ok: true, ...await lerFinanceiro(sql, quem, Object.fromEntries(url.searchParams)) });
  } catch (e) { return reply(e.status || 500, { error: e.message }); }
}
