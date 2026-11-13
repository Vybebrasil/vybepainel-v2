// shared/financeiro-extrato.js — o extrato do banco dentro do Financeiro do Vybe OS (Paulo, 13/11/2026).
//
// Pedido do Paulo: "me livrar 100% do Vybe Finanças" e controlar tudo pelo módulo Financeiro, usando o extrato da conta
// PJ como base. Cada lançamento do banco tem dois lados:
//   banco   = como está no extrato (data, histórico, documento, valor, saldo) — nunca muda depois de importado;
//   real    = para onde foi de verdade (categoria, quem, cliente, dividido em partes, pago | nao_pago | em_aberto).
// O Pix para o Vinícius que pagou o cartão da agência, o Pix para o Mizinho que foi gasolina, o boleto de 3 clientes
// que caiu junto como "Cr Cob Bloq…": o banco mostra uma coisa, o real é outra, e o histórico usa o real.
//
// Funções puras (sem DOM, rede nem banco). No servidor: import x from '../shared/financeiro-extrato.js'.
// No navegador: window.VybeFinanceiroExtrato.
//   lerCsvBB(texto)                      → { agencia, conta, lancamentos[], ignorados[], avisos[] }
//   idDoLancamento(l)                    → id estável (data + histórico + documento + valor + ordem no dia)
//   sugerir(l, regras)                   → { categoria, quem, revisar, regra } (a regra que bateu, para o Paulo confirmar)
//   novaTransacao(l, regras)             → { id, banco, real, sugestao } pronta para guardar
//   mesclar(guardadas, novas)            → { lista, novas, repetidas } (reimportar o mesmo CSV não duplica)
//   partesValidas(real, valorBanco)      → '' ou o motivo (as partes têm que somar o valor do banco)
//   resumo(lista, { mes })               → entradas, saídas, por categoria, por status
//   porCliente(lista, contratos, meses)  → cada cliente × mês: previsto, recebido, em aberto
//   cartao(itens, lista)                 → faturas: itens, pago/não pago, conferência com o débito no extrato
//   projetar(base, cenario, meses)       → caixa mês a mês para 3, 6, 12 meses com os cenários
// Dinheiro sempre em centavos inteiros nas contas; a saída volta em reais.
(function (raiz) {
  'use strict';
  const centavos = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const reais = (c) => Math.round(c) / 100;
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ehMes = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
  function somarMeses(mes, n) {
    const [a, m] = mes.split('-').map(Number), t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  }

  // ---------- Categorias (as saídas e entradas de verdade) ----------
  // tipo: entrada | saida | transferencia (mexe no caixa mas não é receita nem despesa: aplicação, pagar a fatura do
  // cartão — os itens da fatura é que são as despesas, contados no módulo do cartão).
  const CATEGORIAS = Object.freeze([
    { id: 'receita_cliente', nome: 'Recebimento de cliente', tipo: 'entrada', grupo: 'Receitas' },
    { id: 'receita_boleto', nome: 'Boleto recebido (dividir entre clientes)', tipo: 'entrada', grupo: 'Receitas' },
    { id: 'receita_outra', nome: 'Outra entrada', tipo: 'entrada', grupo: 'Receitas' },
    { id: 'rendimento', nome: 'Rendimento da conta', tipo: 'entrada', grupo: 'Receitas financeiras' },
    { id: 'aporte_socio', nome: 'Aporte de sócio', tipo: 'entrada', grupo: 'Sócios' },
    { id: 'emprestimo_entrada', nome: 'Empréstimo recebido', tipo: 'entrada', grupo: 'Empréstimos' },
    { id: 'cartao_agencia', nome: 'Pagar cartão da agência', tipo: 'transferencia', grupo: 'Cartão' },
    { id: 'salario', nome: 'Salário', tipo: 'saida', grupo: 'Pessoas' },
    { id: 'freela', nome: 'Freela / prestador', tipo: 'saida', grupo: 'Pessoas' },
    { id: 'pro_labore', nome: 'Pró-labore', tipo: 'saida', grupo: 'Sócios' },
    { id: 'retirada_socio', nome: 'Retirada de sócio', tipo: 'saida', grupo: 'Sócios' },
    { id: 'combustivel', nome: 'Combustível', tipo: 'saida', grupo: 'Operação' },
    { id: 'alimentacao', nome: 'Alimentação', tipo: 'saida', grupo: 'Operação' },
    { id: 'viagem', nome: 'Viagem e transporte', tipo: 'saida', grupo: 'Operação' },
    { id: 'producao', nome: 'Produção (gráfica, locação, material)', tipo: 'saida', grupo: 'Operação' },
    { id: 'ferramentas', nome: 'Ferramentas e assinaturas', tipo: 'saida', grupo: 'Estrutura' },
    { id: 'estrutura', nome: 'Aluguel, internet, telefone, energia', tipo: 'saida', grupo: 'Estrutura' },
    { id: 'impostos', nome: 'Impostos', tipo: 'saida', grupo: 'Impostos' },
    { id: 'tarifa_bancaria', nome: 'Tarifas do banco', tipo: 'saida', grupo: 'Banco' },
    { id: 'juros_banco', nome: 'Juros e encargos do banco', tipo: 'saida', grupo: 'Banco' },
    { id: 'emprestimo', nome: 'Parcela de empréstimo', tipo: 'saida', grupo: 'Empréstimos' },
    { id: 'outra_saida', nome: 'Outra saída', tipo: 'saida', grupo: 'Outros' },
    { id: 'a_classificar', nome: 'A classificar', tipo: 'indefinido', grupo: 'A classificar' },
  ]);
  const CAT = new Map(CATEGORIAS.map((c) => [c.id, c]));
  const STATUS = Object.freeze(['pago', 'nao_pago', 'em_aberto']);

  // ---------- Regras automáticas (o Paulo confirma cada sugestão) ----------
  // Regra: { id, quando: { contem | comeca, sinal: 'entrada'|'saida'|'' }, categoria, quem, revisar, nota }
  // `contem` é comparado sem acento e sem diferença de maiúscula com o histórico do banco. Vale a primeira que bater.
  // As regras do Paulo (as que ele cria, como "Pix para <nome> = combustível") ficam guardadas e vêm antes destas.
  const REGRAS_PADRAO = Object.freeze([
    { id: 'emprestimo', quando: { contem: 'prest. de emprest', sinal: 'saida' }, categoria: 'emprestimo', nota: 'parcela do empréstimo (PARC xx/046)' },
    { id: 'juros-limite', quando: { contem: 'comissao recurso nao disp', sinal: 'saida' }, categoria: 'juros_banco', nota: 'encargo por usar o limite da conta' },
    { id: 'tarifa', quando: { comeca: 'tarifa', sinal: 'saida' }, categoria: 'tarifa_bancaria' },
    { id: 'tarifa-cob', quando: { comeca: 'tar ', sinal: 'saida' }, categoria: 'tarifa_bancaria', nota: 'tarifa de cobrança (boleto)' },
    { id: 'rendimento', quando: { contem: 'rendimento', sinal: 'entrada' }, categoria: 'rendimento' },
    { id: 'boleto-recebido', quando: { contem: 'cr cob bloq', sinal: 'entrada' }, categoria: 'receita_boleto', revisar: true,
      nota: 'boleto pago — pode ser de mais de um cliente: divida entre eles' },
    { id: 'fatura-cartao', quando: { contem: 'fat.cartao', sinal: 'saida' }, categoria: 'cartao_agencia', nota: 'débito automático da fatura do cartão' },
    { id: 'pix-vinicius', quando: { contem: 'pix enviado vinicius', sinal: 'saida' }, categoria: 'cartao_agencia', quem: 'Vinícius', revisar: true,
      nota: 'o cartão da agência é o do Vinícius: Pix para ele costuma ser para pagar a fatura' },
    { id: 'pix-paulo', quando: { contem: 'pix enviado paulo', sinal: 'saida' }, categoria: 'alimentacao', quem: 'Paulo', revisar: true,
      nota: 'pode ter sido alimentação na viagem — confira' },
    { id: 'pix-ewerton', quando: { contem: 'pix enviado ewerton', sinal: 'saida' }, categoria: 'pro_labore', quem: 'Ewerton', revisar: true },
    { id: 'pix-deivid', quando: { contem: 'pix enviado deivid', sinal: 'saida' }, categoria: 'pro_labore', quem: 'Deivid', revisar: true },
    { id: 'transporte-app', quando: { contem: '99 tecnologia', sinal: 'saida' }, categoria: 'viagem' },
    { id: 'telefone', quando: { contem: 'conta celular', sinal: 'saida' }, categoria: 'estrutura' },
    { id: 'pix-recebido', quando: { contem: 'pix recebido', sinal: 'entrada' }, categoria: 'receita_cliente', revisar: true, nota: 'de qual cliente foi?' },
    { id: 'pix-automatico', quando: { contem: 'pix automatico', sinal: 'saida' }, categoria: 'ferramentas', revisar: true },
  ]);

  // ---------- Leitura do CSV do Banco do Brasil PJ ----------
  // Formato (export "extrato-pj-*.csv"): já decodificado de Windows-1252 por quem chama (o navegador lê com
  // TextDecoder('windows-1252'); o Node com o mesmo TextDecoder). Separador ';', campos entre aspas, valor com vírgula
  // decimal e ponto de milhar. Primeira linha: AGENCIA;"x";CONTA;"y". Depois o cabeçalho
  // Data;Histórico;Documento;Valor (R$);Saldo (R$). Linhas de saldo ("Saldo Anterior", "S A L D O") não são lançamento.
  function campos(linha) {
    const out = []; let atual = '', dentro = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (dentro) {
        if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
        else if (c === '"') dentro = false;
        else atual += c;
      } else if (c === '"') dentro = true;
      else if (c === ';') { out.push(atual); atual = ''; }
      else atual += c;
    }
    out.push(atual);
    return out.map((s) => s.trim());
  }
  function numeroBR(s) {
    const t = String(s || '').replace(/\s/g, '').replace(/^R\$/, '');
    if (!/^[-+]?[\d.]*,?\d+$/.test(t)) return null;
    const n = Number(t.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function dataBR(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  }
  const SALDO = /^(saldo|s a l d o|saldo anterior|saldo do dia)/i;
  function lerCsvBB(texto) {
    const linhas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/);
    const out = { agencia: '', conta: '', lancamentos: [], ignorados: [], avisos: [] };
    let cabecalho = false;
    const porDia = new Map();
    linhas.forEach((bruta, i) => {
      if (!bruta.trim()) return;
      const f = campos(bruta);
      if (/^agencia$/i.test(semAcento(f[0]))) { out.agencia = f[1] || ''; out.conta = f[3] || ''; return; }
      if (/^data$/i.test(f[0])) { cabecalho = true; return; }
      const data = dataBR(f[0]);
      if (!data) { out.ignorados.push({ linha: i + 1, motivo: 'sem data' }); return; }
      const historico = f[1] || '';
      if (SALDO.test(semAcento(historico))) { out.ignorados.push({ linha: i + 1, motivo: 'linha de saldo' }); return; }
      const valor = numeroBR(f[3]);
      if (valor == null || valor === 0) { out.ignorados.push({ linha: i + 1, motivo: 'sem valor' }); return; }
      out.lancamentos.push({ data, historico, documento: f[2] || '', valor, saldo: numeroBR(f[4]) });
    });
    if (!cabecalho) out.avisos.push('Não achei o cabeçalho Data;Histórico;Documento;Valor;Saldo — o arquivo é o extrato PJ do Banco do Brasil?');
    // O extrato do BB vem do mais novo para o mais antigo (e, no mesmo dia, do último para o primeiro). Guardamos do mais
    // antigo para o mais novo, com a ordem do dia (`ordem`), para o saldo do último lançamento ser o saldo do dia.
    const L = out.lancamentos;
    if (L.length > 1 && L[0].data > L[L.length - 1].data) L.reverse();
    L.sort((a, b) => a.data.localeCompare(b.data));
    for (const l of L) { const n = (porDia.get(l.data) || 0) + 1; porDia.set(l.data, n); l.ordem = n; }
    return out;
  }
  // Id estável: o mesmo lançamento num CSV baixado de novo dá o mesmo id. Data + valor + histórico + documento, mais a
  // posição entre os lançamentos iguais do mesmo dia (dois Pix iguais no mesmo dia continuam dois).
  function hash(s) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
  }
  function idsDosLancamentos(lancs) {
    const vistos = new Map();
    return lancs.map((l) => {
      const base = [l.data, centavos(l.valor), semAcento(l.historico).replace(/\s+/g, ' '), l.documento || ''].join('|');
      const n = (vistos.get(base) || 0) + 1; vistos.set(base, n);
      return 'bb:' + hash(base + '|' + n);
    });
  }

  // ---------- Sugestão e transação ----------
  function regraBate(r, l) {
    const sinal = l.valor < 0 ? 'saida' : 'entrada';
    if (r.quando?.sinal && r.quando.sinal !== sinal) return false;
    const h = semAcento(l.historico).replace(/\s+/g, ' ').trim();
    const comeca = semAcento(r.quando?.comeca || '');
    if (comeca) return h.startsWith(comeca);
    const contem = semAcento(r.quando?.contem || '').trim();
    return Boolean(contem) && h.includes(contem);
  }
  function sugerir(l, regras = []) {
    const todas = [...(regras || []), ...REGRAS_PADRAO];
    const r = todas.find((x) => regraBate(x, l));
    if (!r) return { categoria: l.valor < 0 ? 'outra_saida' : 'receita_outra', quem: '', revisar: true, regra: '', nota: 'nenhuma regra bateu' };
    return { categoria: CAT.has(r.categoria) ? r.categoria : 'a_classificar', quem: r.quem || '', revisar: Boolean(r.revisar), regra: r.id, nota: r.nota || '',
      cliente_id: r.cliente_id || '', cliente_nome: r.cliente_nome || '' };
  }
  // Quem recebeu/mandou, tirado do histórico ("Pix Enviado Fulano de Tal" → "Fulano de Tal"), só para mostrar.
  function contraparte(historico) {
    const m = /^pix (enviado|recebido|automatico enviado)\s+(.+)$/i.exec(String(historico || '').trim());
    return m ? m[2].trim() : '';
  }
  // Pix recebido de quem tem o nome de um cliente ("Pix Recebido Serra Grande Bebidas" → Serra Grande Bebidas): o nome
  // do cliente, sem acento, espaço e pontuação, dentro do histórico (só nomes com 5+ letras, e só se um cliente bater).
  const soLetras = (s) => semAcento(s).replace(/\b(ltda|me|eireli|epp|s\/?a)\b/g, '').replace(/[^a-z0-9]/g, '');
  function clienteDoHistorico(historico, clientes = []) {
    const h = soLetras(historico);
    const achados = clientes.filter((c) => { const n = soLetras(c.nome); return n.length >= 5 && h.includes(n); });
    return achados.length === 1 ? { cliente_id: String(achados[0].id), cliente_nome: achados[0].nome } : null;
  }
  function novaTransacao(l, regras, id, clientes = []) {
    const s = sugerir(l, regras);
    if (l.valor > 0 && !s.cliente_id && clientes.length) {
      const c = clienteDoHistorico(l.historico, clientes);
      if (c) Object.assign(s, c, { revisar: true, nota: `pelo nome parece ser ${c.cliente_nome}${s.nota ? ' — ' + s.nota : ''}` });
    }
    const banco = { data: l.data, ordem: l.ordem || 0, historico: l.historico, documento: l.documento || '', valor: l.valor, saldo: l.saldo ?? null, contraparte: contraparte(l.historico) };
    return {
      id: id || idsDosLancamentos([l])[0],
      banco,
      sugestao: s,
      real: {
        categoria: s.categoria, quem: s.quem, descricao: '', cliente_id: s.cliente_id || '', cliente_nome: s.cliente_nome || '', fatura: '',
        partes: [], // [{ valor, categoria, cliente_id, cliente_nome, quem, descricao, competencia }] quando dividido
        status: 'pago', // o banco só mostra o que já entrou/saiu: no extrato, nasce pago
        competencia: l.data.slice(0, 7), // mês a que se refere (a mensalidade de outubro paga em novembro)
        conferido: !s.revisar, conferido_por: '', conferido_em: '',
      },
    };
  }
  function transacoesDoCsv(lido, regras, clientes = []) {
    const ids = idsDosLancamentos(lido.lancamentos);
    return lido.lancamentos.map((l, i) => novaTransacao(l, regras, ids[i], clientes));
  }
  const ordemBanco = (a, b) => a.banco.data.localeCompare(b.banco.data) || (a.banco.ordem || 0) - (b.banco.ordem || 0) || a.id.localeCompare(b.id);
  // Reimportar: o que já existe fica como está (o Paulo pode ter reclassificado); só entra o novo.
  function mesclar(guardadas = [], novas = []) {
    const ja = new Set(guardadas.map((t) => t.id));
    const entram = novas.filter((t) => !ja.has(t.id));
    const lista = [...guardadas, ...entram].sort(ordemBanco);
    return { lista, novas: entram.length, repetidas: novas.length - entram.length };
  }

  // Depois de uma regra nova: o que ainda não foi conferido ganha a sugestão nova (o conferido nunca muda sozinho).
  function reaplicarRegras(lista = [], regras = []) {
    let mudou = 0;
    const out = lista.map((t) => {
      if (t.real.conferido || t.real.partes?.length) return t;
      const s = sugerir({ historico: t.banco.historico, valor: t.banco.valor }, regras);
      if (s.regra === t.sugestao?.regra && s.categoria === t.real.categoria) return t;
      mudou++;
      return { ...t, sugestao: s, real: { ...t.real, categoria: s.categoria, quem: s.quem || t.real.quem, cliente_id: s.cliente_id || t.real.cliente_id, cliente_nome: s.cliente_nome || t.real.cliente_nome } };
    });
    return { lista: out, mudou };
  }
  // Regra que o Paulo cria do lançamento ("sempre que aparecer isso, é aquilo"). Devolve { regra } ou { erro }.
  function normalizarRegra(r = {}) {
    const contem = String(r.contem ?? r.quando?.contem ?? '').trim().slice(0, 80);
    if (contem.length < 3) return { erro: 'Diga um pedaço do histórico com pelo menos 3 letras.' };
    if (!CAT.has(r.categoria)) return { erro: 'Categoria desconhecida.' };
    const sinalPedido = r.sinal ?? r.quando?.sinal;
    const sinal = ['entrada', 'saida'].includes(sinalPedido) ? sinalPedido : '';
    const id = /^[a-z0-9-]{3,60}$/.test(String(r.id || '')) ? r.id : 'p-' + hash(semAcento(contem) + '|' + sinal);
    return { regra: { id, quando: { contem, sinal }, categoria: r.categoria, quem: String(r.quem || '').slice(0, 80), revisar: Boolean(r.revisar),
      cliente_id: String(r.cliente_id || '').slice(0, 80), cliente_nome: String(r.cliente_nome || '').slice(0, 160), nota: String(r.nota || '').slice(0, 160) } };
  }

  // ---------- Gastos fixos (programas, assinaturas, aluguel…) ----------
  // Fixo: { id, nome, categoria, valor, dia, forma: pix|boleto|cartao|debito, contem (pedaço do histórico no extrato),
  //         inicio 'AAAA-MM', fim 'AAAA-MM' | '', ativo, observacao }
  const FORMAS = Object.freeze(['pix', 'boleto', 'cartao', 'debito']);
  function normalizarFixo(f = {}) {
    const nome = String(f.nome || '').trim().slice(0, 80);
    if (!nome) return { erro: 'Dê um nome ao gasto fixo.' };
    const valor = Math.abs(reais(centavos(f.valor)));
    if (!(valor > 0)) return { erro: 'Informe o valor por mês.' };
    const categoria = CAT.has(f.categoria) && CAT.get(f.categoria).tipo === 'saida' ? f.categoria : 'ferramentas';
    const dia = Math.max(1, Math.min(31, Math.round(Number(f.dia) || 1)));
    if (f.inicio && !ehMes(f.inicio)) return { erro: 'Início no formato AAAA-MM.' };
    if (f.fim && !ehMes(f.fim)) return { erro: 'Fim no formato AAAA-MM.' };
    const id = /^[a-z0-9-]{3,60}$/.test(String(f.id || '')) ? f.id : 'fx-' + hash(nome + '|' + Date.now() + '|' + Math.random());
    return { fixo: { id, nome, categoria, valor, dia, forma: FORMAS.includes(f.forma) ? f.forma : 'pix', contem: String(f.contem || '').trim().slice(0, 80),
      inicio: f.inicio || '', fim: f.fim || '', ativo: f.ativo !== false, observacao: String(f.observacao || '').slice(0, 240) } };
  }
  const fixoVigente = (f, mes) => f.ativo !== false && (!f.inicio || f.inicio <= mes) && (!f.fim || f.fim >= mes);
  // Análise do mês: total, por categoria e, para cada fixo, se apareceu no extrato do mês (pelo pedaço do histórico ou
  // pelo valor parecido, ±5%, na mesma categoria) ou na fatura do cartão.
  function analisarFixos(fixos = [], lista = [], mes = '', itensCartao = []) {
    const vig = fixos.filter((f) => fixoVigente(f, mes));
    const doMes = lista.filter((t) => t.banco.data.startsWith(mes) && t.banco.valor < 0);
    const usados = new Set();
    const perto = (a, b) => Math.abs(Math.abs(centavos(a)) - centavos(b)) <= centavos(b) * 0.05;
    const linhas = vig.map((f) => {
      let achado = null;
      if (f.forma === 'cartao') {
        const it = itensCartao.find((i) => i.fatura === mes && !usados.has('c:' + i.id) && (f.contem ? semAcento(i.descricao).includes(semAcento(f.contem)) : perto(i.valor, f.valor)));
        if (it) { usados.add('c:' + it.id); achado = { onde: 'cartao', data: it.data, valor: Math.abs(Number(it.valor)), status: it.status }; }
      } else {
        const t = doMes.find((x) => !usados.has(x.id) && (f.contem ? semAcento(x.banco.historico).includes(semAcento(f.contem)) : x.real.categoria === f.categoria && perto(x.banco.valor, f.valor)));
        if (t) { usados.add(t.id); achado = { onde: 'extrato', id: t.id, data: t.banco.data, valor: Math.abs(t.banco.valor), status: t.real.status }; }
      }
      return { ...f, vence: `${mes}-${String(Math.min(f.dia, 28)).padStart(2, '0')}`, achado, diferenca: achado ? reais(centavos(achado.valor) - centavos(f.valor)) : null };
    });
    const total = vig.reduce((t, f) => t + centavos(f.valor), 0);
    const porCat = new Map();
    for (const f of vig) porCat.set(f.categoria, (porCat.get(f.categoria) || 0) + centavos(f.valor));
    return { mes, total: reais(total), anual: reais(total * 12), quantidade: vig.length, inativos: fixos.length - vig.length,
      achados: linhas.filter((l) => l.achado).length,
      por_categoria: [...porCat].map(([categoria, v]) => ({ categoria, nome: CAT.get(categoria)?.nome || categoria, total: reais(v), pct: total ? Math.round(v / total * 100) : 0 })).sort((a, b) => b.total - a.total),
      fixos: linhas.sort((a, b) => a.dia - b.dia) };
  }

  // ---------- Edição do lado real ----------
  // As partes (dividir um boleto entre 3 clientes, ou um Pix entre combustível e alimentação) somam o valor do banco,
  // em módulo e com o mesmo sinal. Sem partes, a transação inteira vai para a categoria do real.
  function partesValidas(real, valorBanco) {
    const partes = Array.isArray(real?.partes) ? real.partes : [];
    if (!partes.length) return '';
    if (partes.some((p) => !(Math.abs(Number(p.valor)) > 0))) return 'Toda parte precisa de um valor.';
    if (partes.some((p) => p.categoria && !CAT.has(p.categoria))) return 'Categoria desconhecida numa parte.';
    const total = partes.reduce((t, p) => t + Math.abs(centavos(p.valor)), 0);
    const alvo = Math.abs(centavos(valorBanco));
    if (total !== alvo) return `As partes somam ${(total / 100).toFixed(2).replace('.', ',')} e o banco mostra ${(alvo / 100).toFixed(2).replace('.', ',')}.`;
    return '';
  }
  // Campos que a tela pode mandar; o resto é ignorado. Devolve { real, erro }.
  function aplicarEdicao(t, mudanca = {}, quem = '') {
    const real = { ...t.real };
    if ('categoria' in mudanca) { if (!CAT.has(mudanca.categoria)) return { erro: 'Categoria desconhecida.' }; real.categoria = mudanca.categoria; }
    if ('status' in mudanca) { if (!STATUS.includes(mudanca.status)) return { erro: 'Status deve ser pago, nao_pago ou em_aberto.' }; real.status = mudanca.status; }
    for (const k of ['quem', 'descricao', 'cliente_id', 'cliente_nome', 'fatura']) if (k in mudanca) real[k] = String(mudanca[k] ?? '').slice(0, 160);
    if ('competencia' in mudanca) { if (mudanca.competencia && !ehMes(mudanca.competencia)) return { erro: 'Competência no formato AAAA-MM.' }; real.competencia = mudanca.competencia || t.banco.data.slice(0, 7); }
    if ('partes' in mudanca) {
      const partes = (Array.isArray(mudanca.partes) ? mudanca.partes : []).slice(0, 30).map((p) => ({
        valor: Math.abs(reais(centavos(p.valor))), categoria: CAT.has(p.categoria) ? p.categoria : real.categoria,
        cliente_id: String(p.cliente_id ?? '').slice(0, 80), cliente_nome: String(p.cliente_nome ?? '').slice(0, 160),
        quem: String(p.quem ?? '').slice(0, 80), descricao: String(p.descricao ?? '').slice(0, 160),
        competencia: ehMes(p.competencia) ? p.competencia : '' }));
      const erro = partesValidas({ partes }, t.banco.valor);
      if (erro) return { erro };
      real.partes = partes;
    }
    if ('conferido' in mudanca) real.conferido = Boolean(mudanca.conferido);
    if (real.conferido) { real.conferido_por = quem || real.conferido_por; real.conferido_em = real.conferido_em || new Date().toISOString(); }
    else { real.conferido_por = ''; real.conferido_em = ''; }
    return { real };
  }
  // Cada transação vira 1 ou N pedaços com sinal (o que os relatórios somam).
  function pedacos(t) {
    const sinal = t.banco.valor < 0 ? -1 : 1;
    const base = { id: t.id, data: t.banco.data, status: t.real.status, conferido: t.real.conferido };
    if (t.real.partes?.length) return t.real.partes.map((p, i) => ({ ...base, parte: i, valor: sinal * Math.abs(Number(p.valor)), categoria: p.categoria || t.real.categoria,
      cliente_id: p.cliente_id || '', cliente_nome: p.cliente_nome || '', quem: p.quem || t.real.quem || '', competencia: p.competencia || t.real.competencia || t.banco.data.slice(0, 7) }));
    return [{ ...base, parte: 0, valor: t.banco.valor, categoria: t.real.categoria, cliente_id: t.real.cliente_id || '', cliente_nome: t.real.cliente_nome || '',
      quem: t.real.quem || '', competencia: t.real.competencia || t.banco.data.slice(0, 7) }];
  }

  // ---------- Resumo do mês ----------
  function resumo(lista = [], { mes = '' } = {}) {
    const doMes = mes ? lista.filter((t) => t.banco.data.startsWith(mes)) : lista;
    let entra = 0, sai = 0, transf = 0, revisar = 0;
    const porCat = new Map();
    for (const t of doMes) {
      if (!t.real.conferido) revisar++;
      for (const p of pedacos(t)) {
        const c = CAT.get(p.categoria) || CAT.get('a_classificar'), v = centavos(p.valor);
        if (c.tipo === 'transferencia') transf += v;
        else if (v > 0) entra += v; else sai += v;
        const k = porCat.get(c.id) || { categoria: c.id, nome: c.nome, grupo: c.grupo, tipo: c.tipo, total: 0, quantidade: 0 };
        k.total += v; k.quantidade++; porCat.set(c.id, k);
      }
    }
    const comSaldo = doMes.filter((t) => t.banco.saldo != null).sort(ordemBanco);
    const saldoFinal = comSaldo.length ? comSaldo[comSaldo.length - 1].banco.saldo : null;
    return {
      mes, lancamentos: doMes.length, a_revisar: revisar,
      entradas: reais(entra), saidas: reais(-sai), cartao_e_transferencias: reais(-transf), resultado: reais(entra + sai + transf),
      saldo_final: saldoFinal,
      categorias: [...porCat.values()].map((c) => ({ ...c, total: reais(c.total) })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    };
  }
  function mesesDa(lista) { return [...new Set(lista.map((t) => t.banco.data.slice(0, 7)))].sort(); }

  // ---------- Por cliente, mês a mês ----------
  // contratos: [{ cliente_id, cliente_nome, valor_mensal, inicio, fim, dia_vencimento }] (os ativos da Carteira).
  // Recebido de um cliente no mês = pedaços de entrada com aquele cliente, pela competência (o mês a que o dinheiro se
  // refere, que o Paulo edita). Previsto = mensalidade do contrato vigente no mês. Em aberto = previsto − recebido,
  // quando o mês já venceu ou é o atual. Pedaço marcado nao_pago/em_aberto é previsto, não recebido.
  // { desde: 'AAAA-MM' } = primeiro mês com extrato: antes dele não há como saber se pagou ('fora', não conta como aberto).
  // { mesAtual: 'AAAA-MM' } = o mês corrente: o que falta nele é 'a_receber' (ainda pode entrar), fora do total em aberto.
  function porCliente(lista = [], contratos = [], meses = [], { desde = '', mesAtual = '' } = {}) {
    const recebido = new Map(), aberto = new Map();
    const nomes = new Map();
    for (const t of lista) for (const p of pedacos(t)) {
      const c = CAT.get(p.categoria);
      if (!c || c.tipo !== 'entrada' || !p.cliente_id) continue;
      nomes.set(p.cliente_id, p.cliente_nome || nomes.get(p.cliente_id) || '');
      const k = p.cliente_id + '|' + p.competencia;
      const alvo = p.status === 'pago' ? recebido : aberto;
      alvo.set(k, (alvo.get(k) || 0) + centavos(p.valor));
    }
    const ids = new Set([...contratos.map((c) => String(c.cliente_id)), ...nomes.keys()]);
    const contratoDe = new Map(contratos.map((c) => [String(c.cliente_id), c]));
    return [...ids].map((id) => {
      const ct = contratoDe.get(id);
      const linhas = meses.map((m) => {
        const vigente = ct && Number(ct.valor_mensal) > 0 && (!ct.inicio || String(ct.inicio).slice(0, 7) <= m) && (!ct.fim || String(ct.fim).slice(0, 7) >= m);
        const prev = vigente ? centavos(ct.valor_mensal) : 0;
        const rec = recebido.get(id + '|' + m) || 0;
        const marcado = aberto.get(id + '|' + m) || 0;
        if (desde && m < desde && !rec && !marcado) return { mes: m, previsto: reais(prev), recebido: 0, em_aberto: 0, situacao: 'fora' };
        const falta = Math.max(0, Math.max(prev, rec + marcado) - rec);
        let situacao = !prev && !rec && !marcado ? 'sem' : falta === 0 ? 'pago' : rec > 0 ? 'parcial' : 'aberto';
        if (falta > 0 && mesAtual && m >= mesAtual) situacao = 'a_receber';
        return { mes: m, previsto: reais(prev), recebido: reais(rec), em_aberto: situacao === 'a_receber' ? 0 : reais(falta), a_receber: situacao === 'a_receber' ? reais(falta) : 0, situacao };
      });
      return { cliente_id: id, cliente_nome: ct?.cliente_nome || nomes.get(id) || id, mensalidade: ct ? Number(ct.valor_mensal) || 0 : null, meses: linhas,
        total_recebido: reais(linhas.reduce((t, l) => t + centavos(l.recebido), 0)), total_aberto: reais(linhas.reduce((t, l) => t + centavos(l.em_aberto), 0)),
        a_receber: reais(linhas.reduce((t, l) => t + centavos(l.a_receber || 0), 0)) };
    }).sort((a, b) => b.total_aberto - a.total_aberto || String(a.cliente_nome).localeCompare(String(b.cliente_nome), 'pt-BR'));
  }

  // ---------- Cartão de crédito ----------
  // Itens da fatura são lançados no Vybe OS (o banco só mostra o pagamento da fatura). Item:
  //   { id, cartao, fatura: 'AAAA-MM', data, descricao, valor, categoria, cliente_id, quem, parcela: 'n/N', status }
  // A fatura é paga quando os pagamentos ligados a ela (transações do extrato com categoria cartao_agencia e
  // real.fatura = 'cartao|AAAA-MM', ou o débito automático "Fat.cartao FINAL nnnn") somam o total.
  function cartao(itens = [], lista = []) {
    const faturas = new Map();
    const chaveF = (c, f) => `${c || 'Cartão da agência'}|${f}`;
    for (const it of itens) {
      if (!ehMes(it.fatura)) continue;
      const k = chaveF(it.cartao, it.fatura);
      const f = faturas.get(k) || { cartao: it.cartao || 'Cartão da agência', fatura: it.fatura, itens: [], total: 0, pagos: 0, pagamentos: [], pago_extrato: 0 };
      f.itens.push(it); f.total += centavos(it.valor); if (it.status === 'pago') f.pagos += centavos(it.valor);
      faturas.set(k, f);
    }
    for (const t of lista) for (const p of pedacos(t)) {
      if (p.categoria !== 'cartao_agencia') continue;
      const ref = (t.real.fatura || '').split('|');
      if (ref.length !== 2 || !ehMes(ref[1])) continue;
      const f = faturas.get(chaveF(ref[0], ref[1]));
      if (!f) continue;
      f.pagamentos.push({ id: t.id, data: t.banco.data, historico: t.banco.historico, valor: Math.abs(p.valor) });
      f.pago_extrato += Math.abs(centavos(p.valor));
    }
    return [...faturas.values()].map((f) => {
      const porCat = new Map();
      for (const it of f.itens) porCat.set(it.categoria || 'a_classificar', (porCat.get(it.categoria || 'a_classificar') || 0) + centavos(it.valor));
      const situacao = f.total === 0 ? 'vazia' : f.pago_extrato >= f.total ? 'paga' : f.pago_extrato > 0 ? 'parcial' : 'em_aberto';
      return { cartao: f.cartao, fatura: f.fatura, total: reais(f.total), itens_pagos: reais(f.pagos), pago_no_extrato: reais(f.pago_extrato),
        falta: reais(Math.max(0, f.total - f.pago_extrato)), situacao, pagamentos: f.pagamentos,
        itens: f.itens.slice().sort((a, b) => String(a.data).localeCompare(String(b.data))),
        por_categoria: [...porCat].map(([categoria, v]) => ({ categoria, nome: CAT.get(categoria)?.nome || categoria, total: reais(v) })).sort((a, b) => b.total - a.total) };
    }).sort((a, b) => b.fatura.localeCompare(a.fatura) || a.cartao.localeCompare(b.cartao));
  }
  function normalizarItemCartao(it = {}) {
    const descricao = String(it.descricao || '').trim().slice(0, 120);
    if (!descricao) return { erro: 'O que é esse item da fatura?' };
    const valor = reais(centavos(it.valor));
    if (!valor) return { erro: 'Informe o valor do item.' };
    if (!ehMes(it.fatura)) return { erro: 'Fatura no formato AAAA-MM.' };
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(it.data || '')) ? it.data : `${it.fatura}-01`;
    const parcela = /^\d{1,2}\/\d{1,2}$/.test(String(it.parcela || '')) ? it.parcela : '';
    const id = /^[a-z0-9-]{3,60}$/.test(String(it.id || '')) ? it.id : 'ct-' + hash(descricao + '|' + Date.now() + '|' + Math.random());
    return { item: { id, cartao: String(it.cartao || 'Cartão da agência').slice(0, 60), fatura: it.fatura, data, descricao, valor,
      categoria: CAT.has(it.categoria) ? it.categoria : 'a_classificar', cliente_id: String(it.cliente_id || '').slice(0, 80), cliente_nome: String(it.cliente_nome || '').slice(0, 160),
      quem: String(it.quem || '').slice(0, 80), parcela, status: STATUS.includes(it.status) ? it.status : 'em_aberto', observacao: String(it.observacao || '').slice(0, 240) } };
  }
  // Os pagamentos de cartão no extrato que ainda não foram ligados a nenhuma fatura.
  function pagamentosSemFatura(lista = []) {
    return lista.filter((t) => pedacos(t).some((p) => p.categoria === 'cartao_agencia') && !t.real.fatura)
      .map((t) => ({ id: t.id, data: t.banco.data, historico: t.banco.historico, valor: Math.abs(t.banco.valor) }));
  }

  // ---------- Projeção ----------
  // base: { saldo_hoje, mes_inicial: 'AAAA-MM', entradas_mes, saidas_por_categoria: { cat: valor/mês } }
  //   — normalmente a média dos meses realizados (baseDaProjecao), que o Paulo pode ajustar.
  // cenario: { cortes: [{ categoria, percentual }], economias: [{ nome, valor, a_partir }] (um fixo cortado), clientes_novos: [{ quantos, valor, a_partir: n }],
  //            clientes_perdidos: [{ valor, a_partir }], gastos_novos: [{ nome, valor, a_partir }], ajuste_entradas_pct }
  // Saída: meses [{ mes, entradas, saidas, resultado, saldo }] e o mês em que o saldo fica negativo (ou null).
  function baseDaProjecao(lista = [], { meses = 3, ate = '' } = {}) {
    const todos = mesesDa(lista).filter((m) => !ate || m <= ate);
    // O mês corrente ainda não fechou e o primeiro mês do extrato pode ter começado no meio (o de agosto começa dia 17):
    // nenhum dos dois entra na média, a menos que não sobre outro.
    let fechados = todos.length > 1 ? todos.slice(0, -1) : todos;
    const primeiroDia = lista.length ? Number(lista[0].banco.data.slice(8, 10)) : 1;
    if (fechados.length > 1 && primeiroDia > 5 && fechados[0] === todos[0]) fechados = fechados.slice(1);
    const usados = fechados.slice(-meses);
    const entra = new Map(), sai = new Map();
    for (const t of lista) {
      const m = t.banco.data.slice(0, 7);
      if (!usados.includes(m)) continue;
      for (const p of pedacos(t)) {
        const c = CAT.get(p.categoria) || CAT.get('a_classificar');
        const v = centavos(p.valor);
        if (c.tipo === 'transferencia' && c.id !== 'cartao_agencia') continue;
        // Pagar o cartão é dinheiro que sai do caixa: entra na projeção como saída (os itens são o detalhe).
        const alvo = v > 0 ? entra : sai;
        alvo.set(c.id, (alvo.get(c.id) || 0) + Math.abs(v));
      }
    }
    const n = usados.length || 1;
    const media = (m) => Object.fromEntries([...m].map(([k, v]) => [k, reais(Math.round(v / n))]));
    const comSaldo = lista.filter((t) => t.banco.saldo != null).sort(ordemBanco); // lançado à mão/WhatsApp não tem saldo
    const ultimo = comSaldo[comSaldo.length - 1] || null;
    return { meses_usados: usados, saldo_hoje: ultimo?.banco.saldo ?? 0, mes_inicial: todos.length ? somarMeses(todos[todos.length - 1], 1) : '',
      entradas_por_categoria: media(entra), saidas_por_categoria: media(sai) };
  }
  function projetar(base, cenario = {}, meses = 12) {
    const cortes = new Map((cenario.cortes || []).map((c) => [c.categoria, Math.max(0, Math.min(100, Number(c.percentual) || 0))]));
    const somaObj = (o) => Object.values(o || {}).reduce((t, v) => t + centavos(v), 0);
    const ajuste = 1 + (Number(cenario.ajuste_entradas_pct) || 0) / 100;
    const entradaBase = Math.round(somaObj(base.entradas_por_categoria) * ajuste);
    const saidaBase = Object.entries(base.saidas_por_categoria || {}).reduce((t, [k, v]) => t + Math.round(centavos(v) * (1 - (cortes.get(k) || 0) / 100)), 0);
    let saldo = centavos(base.saldo_hoje);
    const out = [];
    let negativo = null;
    const partir = (x) => Math.max(1, Number(x.a_partir) || 1);
    for (let i = 1; i <= meses; i++) {
      const mes = base.mes_inicial ? somarMeses(base.mes_inicial, i - 1) : String(i);
      let e = entradaBase, s = saidaBase;
      for (const c of cenario.clientes_novos || []) if (i >= partir(c)) e += centavos(c.valor) * Math.max(0, Number(c.quantos) || 1);
      for (const c of cenario.clientes_perdidos || []) if (i >= partir(c)) e -= centavos(c.valor);
      for (const g of cenario.gastos_novos || []) if (i >= partir(g)) s += centavos(g.valor);
      for (const g of cenario.economias || []) if (i >= partir(g)) s -= centavos(g.valor); // cortar um gasto fixo inteiro
      if (s < 0) s = 0;
      saldo += e - s;
      if (negativo == null && saldo < 0) negativo = mes;
      out.push({ mes, entradas: reais(e), saidas: reais(s), resultado: reais(e - s), saldo: reais(saldo) });
    }
    return { meses: out, primeiro_mes_negativo: negativo, saldo_final: out.length ? out[out.length - 1].saldo : reais(saldo),
      resultado_mensal: out.length ? out[0].resultado : 0 };
  }

  // ---------- Vorcaro (Tesouraria): o que chega do grupo Vybe Financeiro e o lançado à mão ----------
  // Proposta: o que o Vorcaro leu no WhatsApp (print, áudio, mensagem) ou o que um dono lança à mão (dinheiro fora do
  // banco). { id, origem: whatsapp|mao, autor, texto, anexo, tipo: entrada|saida, valor, data, categoria, cliente_id,
  //   cliente_nome, quem, recebido_em, estado: pendente|lancada|juntada|descartada, transacao_id, decidido_por }
  // Lançar vira uma transação sem saldo (id 'wa:'), "juntar" põe a classificação dela num lançamento do banco.
  const ESTADOS_PROPOSTA = Object.freeze(['pendente', 'lancada', 'juntada', 'descartada']);
  function normalizarProposta(p = {}, { agora = new Date().toISOString() } = {}) {
    const valor = Math.abs(reais(centavos(typeof p.valor === 'string' ? numeroBR(p.valor) ?? p.valor : p.valor)));
    if (!(valor > 0)) return { erro: 'Proposta sem valor.' };
    const tipo = p.tipo === 'entrada' ? 'entrada' : 'saida';
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(p.data || '')) ? p.data : agora.slice(0, 10);
    const base = String(p.id_externo || p.id || '') || `${data}|${valor}|${p.texto || ''}|${agora}`;
    const categoria = CAT.has(p.categoria) ? p.categoria : 'a_classificar';
    return { proposta: { id: 'pr-' + hash(base), id_externo: String(p.id_externo || '').slice(0, 120), origem: p.origem === 'mao' ? 'mao' : 'whatsapp',
      autor: String(p.autor || '').slice(0, 80), texto: String(p.texto || '').slice(0, 600), anexo: ['print', 'audio', 'mensagem'].includes(p.anexo) ? p.anexo : 'mensagem',
      tipo, valor, data, categoria, cliente_id: String(p.cliente_id || '').slice(0, 80), cliente_nome: String(p.cliente_nome || '').slice(0, 160),
      quem: String(p.quem || '').slice(0, 80), status: STATUS.includes(p.status) ? p.status : 'pago', recebido_em: agora,
      estado: 'pendente', transacao_id: '', decidido_por: '' } };
  }
  // Lançamentos do banco que podem ser a mesma coisa: mesmo sentido, mesmo valor (centavo a centavo) e até 5 dias de
  // diferença, que ainda não tenham proposta juntada.
  function candidatosDaProposta(p, lista = [], juntadas = new Set()) {
    const alvo = centavos(p.valor) * (p.tipo === 'entrada' ? 1 : -1);
    const dia = (s) => Date.parse(s + 'T12:00:00Z');
    return lista.filter((t) => t.banco.saldo != null && !juntadas.has(t.id) && centavos(t.banco.valor) === alvo && Math.abs(dia(t.banco.data) - dia(p.data)) <= 5 * 864e5)
      .sort((a, b) => Math.abs(dia(a.banco.data) - dia(p.data)) - Math.abs(dia(b.banco.data) - dia(p.data)));
  }
  function transacaoDaProposta(p, quem = '') {
    const valor = p.tipo === 'entrada' ? Math.abs(p.valor) : -Math.abs(p.valor);
    return { id: 'wa:' + p.id.replace(/^pr-/, ''),
      banco: { data: p.data, ordem: 0, historico: `${p.origem === 'mao' ? 'Lançado à mão' : 'WhatsApp'}${p.autor ? ' · ' + p.autor : ''} · ${p.texto || 'sem texto'}`.slice(0, 200),
        documento: '', valor, saldo: null, contraparte: p.quem || '', origem: p.origem },
      sugestao: { categoria: p.categoria, quem: p.quem, revisar: false, regra: 'vorcaro', nota: 'lançado pelo Vorcaro' },
      real: { categoria: p.categoria, quem: p.quem, descricao: p.texto.slice(0, 160), cliente_id: p.cliente_id, cliente_nome: p.cliente_nome, fatura: '', partes: [],
        status: p.status || 'pago', competencia: p.data.slice(0, 7), conferido: true, conferido_por: quem, conferido_em: new Date().toISOString() } };
  }

  const api = Object.freeze({ CATEGORIAS, ESTADOS_PROPOSTA, normalizarProposta, candidatosDaProposta, transacaoDaProposta, STATUS, REGRAS_PADRAO, lerCsvBB, numeroBR, dataBR, idsDosLancamentos, sugerir, contraparte, novaTransacao,
    clienteDoHistorico, transacoesDoCsv, mesclar, reaplicarRegras, normalizarRegra, FORMAS, normalizarFixo, fixoVigente, analisarFixos, normalizarItemCartao, partesValidas, aplicarEdicao, pedacos, resumo, mesesDa, porCliente, cartao, pagamentosSemFatura, baseDaProjecao, projetar, somarMeses });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VybeFinanceiroExtrato = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
