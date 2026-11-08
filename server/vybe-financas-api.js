// server/vybe-financas-api.js — a área do Vybe Finanças no painel (Paulo, 08/11/2026). SÓ LEITURA.
//
//   GET /api/painel?area=vybe_financas&parte=comercial|carteira|rh&mes=AAAA-MM
//
// Lê o Postgres do Finanças pelo conector (server/vybe-financas.js, papel só de leitura), liga os clientes de lá aos do Vybe OS (CNPJ, senão o nome
// normalizado) e devolve os números já resumidos (shared/financas-calculos.js). Nunca devolve linha crua do Finanças.
//
// Quem recebe o quê (decidido aqui; a tela só reflete):
//  - parte=comercial (recebido × previsto, despesas por categoria, custos fixos, total da folha, séries, inadimplência,
//    margem real por cliente): só quem vê dinheiro no Comercial (pode.ver_dinheiro = donos e administração, ehDono de
//    server/crm.js). A folha aqui é só o total: salário de cada pessoa não sai nesta parte.
//  - parte=carteira (contratos do Finanças para a lista, o LTV e o tempo restante): toda sessão pessoal; o valor de cada
//    contrato só vai para quem vê dinheiro.
//  - parte=rh (folha com salário, bônus e dia de pagamento de cada funcionário): só os quatro donos (Paulo, Vinícius,
//    Ewerton e Deivid, pelo primeiro nome). Administração sem ser dono não recebe salário individual.
// Sem VYBE_FINANCAS_DB_URL: { conectado: false, motivo: 'Conectar o Vybe Finanças' } (com o passo a passo só para
// quem vê dinheiro). Finanças fora do ar: 502 com uma frase segura (nunca a URL, a senha ou a mensagem crua do Postgres).
import calc from '../shared/financas-calculos.js';
import { ehDono } from './crm.js';
import { ehDonoPessoa } from './donos.js';
import { conectorPadrao, ErroFinancas, MOTIVO_DESCONECTADO } from './vybe-financas.js';

// Os quatro donos de fato (sem a administração), pela regra única de server/donos.js.
export const ehDonoDeFato = (pessoa) => ehDonoPessoa(pessoa);
export const PARTES = Object.freeze(['comercial', 'carteira', 'rh']);
export const hojeNaBahia = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
export const PASSOS = Object.freeze([
  'No Supabase do Vybe Finanças, abra o SQL Editor, cole docs/vybe-financas-acesso-leitura.sql (troque antes a senha TROQUE-ESTA-SENHA) e rode.',
  'Confira no fim do resultado as contagens por tabela (o papel vybe_os_leitura enxerga só os dados da Vybe).',
  'Em Project Settings → Database → Connection pooling, copie a string do modo Transaction (porta 6543) e troque usuário e senha pelos do vybe_os_leitura.',
  'Na Vercel do Vybe OS (Production), crie VYBE_FINANCAS_DB_URL com essa string e publique de novo.',
]);

const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };

async function clientesDoVybe(sql) {
  try { return await sql`SELECT id::text, nome, COALESCE(cnpj,'') AS cnpj FROM vybe_clientes WHERE apagado_em IS NULL ORDER BY nome`; }
  catch (e) { if (e.code !== '42703') throw e; return sql`SELECT id::text, nome, '' AS cnpj FROM vybe_clientes ORDER BY nome`; }
}

// Os dados das três partes, a partir da base lida do Finanças (função pura sobre as linhas; testada sem rede).
export function montarParte(parte, base, vybe, { mes, hoje, dinheiro, dono }) {
  const ligacao = calc.ligarClientes(base.clientes, vybe);
  const nomeFin = Object.fromEntries(base.clientes.map((c) => [c.id, c.name]));
  const quem = (finId) => { const par = finId ? ligacao.porFinancas[finId] : null;
    return { cliente_id: par ? par.vybe_id : null, cliente_nome: par ? par.vybe_nome : finId ? nomeFin[finId] || 'Cliente do Finanças' : 'Sem cliente', no_vybe: Boolean(par) }; };
  const resumoLigacao = { ligados: ligacao.ligados.length, por_cnpj: ligacao.ligados.filter((l) => l.por === 'cnpj').length,
    sem_par: ligacao.sem_par.map(({ nome, status }) => ({ nome, status })) };

  if (parte === 'comercial') {
    const folha = calc.folhaDoMes(base.funcionarios, base.historico, mes);
    const inad = calc.inadimplencia(base.transacoes, hoje);
    return {
      resumo: calc.resumoMes(base.transacoes, base.clientes, mes),
      despesas: calc.despesasPorCategoria(base.transacoes, mes),
      custos_fixos: calc.custosFixos(base.assinaturas),
      // Só o total: o salário de cada pessoa fica na parte rh (donos).
      folha: { mes: folha.mes, total: folha.total, total_anterior: folha.total_anterior, variacao: folha.variacao, variacao_percentual: folha.variacao_percentual, quantidade: folha.quantidade },
      series: calc.serieMensal(base.transacoes, mes, 12, 6),
      inadimplencia: { ...inad, clientes: inad.clientes.map(({ cliente_id, descricao, ...c }) => ({ ...c, ...quem(cliente_id), descricao: cliente_id ? '' : descricao })) },
      margens: calc.margemPorCliente(base.transacoes, mes, 3).map(({ cliente_id, ...m }) => ({ ...quem(cliente_id), ...m })),
      ligacao: resumoLigacao,
    };
  }
  if (parte === 'carteira') {
    const lista = calc.contratosDoFinancas(base.contratos, ligacao, nomeFin, hoje);
    // Um contrato por cliente do Vybe OS alimenta a Carteira (o ativo mais recente); os outros ficam na lista.
    const porCliente = new Map();
    for (const c of lista) if (c.cliente_id) porCliente.set(c.cliente_id, [...(porCliente.get(c.cliente_id) || []), c]);
    const principais = new Set([...porCliente.values()].map((l) => calc.contratoPrincipal(l)?.id));
    const contratos = lista.map((c) => ({ ...c, principal: principais.has(c.id), ...(dinheiro ? {} : { valor: null }) }));
    return { contratos, ligacao: resumoLigacao };
  }
  if (parte === 'rh') {
    if (!dono) falhar('A folha é só dos donos.', 403);
    return { folha: calc.folhaDoMes(base.funcionarios, base.historico, mes) };
  }
  return falhar('Parte desconhecida.');
}

export async function lerVybeFinancas(sql, pessoa, query = {}, { conector = conectorPadrao(), hoje = hojeNaBahia() } = {}) {
  const parte = String(query.parte || 'comercial');
  if (!PARTES.includes(parte)) falhar('Parte desconhecida.');
  const mes = query.mes == null || query.mes === '' ? hoje.slice(0, 7) : String(query.mes);
  if (!calc.ehMes(mes) || mes < '2000-01' || mes > '2100-12') falhar('Mês inválido.');
  const dinheiro = ehDono(pessoa), dono = ehDonoDeFato(pessoa);
  if (parte === 'comercial' && !dinheiro) falhar('Só os donos e a administração veem o dinheiro da agência.', 403);
  if (parte === 'rh' && !dono) falhar('A folha é só dos donos.', 403);
  const pode = { ver_dinheiro: dinheiro, ver_salarios: dono };
  if (!conector.configurado()) {
    const urlErrada = !conector.urlValida();
    return { parte, mes, hoje, conectado: false, motivo: MOTIVO_DESCONECTADO, pode,
      ...(dinheiro ? { passos: PASSOS, faltando: conector.faltando(), aviso: urlErrada ? 'VYBE_FINANCAS_DB_URL precisa começar com postgresql://.' : '' } : {}) };
  }
  // 12 meses até o mês escolhido (séries) e as pendências antigas (inadimplência).
  const desde = calc.somarMeses(mes, -11) + '-01';
  const [base, vybe] = await Promise.all([conector.lerBase({ desde }), clientesDoVybe(sql)]);
  return { parte, mes, hoje, conectado: true, fonte: 'Vybe Finanças', pode, ...montarParte(parte, base, vybe, { mes, hoje, dinheiro, dono }) };
}

export async function areaVybeFinancas(req, res, quem, criarBanco, opcoes = {}) {
  if (!quem) return res.status(401).json({ error: 'Entre no painel para ver o Vybe Finanças.' });
  if (quem.tipo !== 'sessao' || !quem.pessoa?.id) return res.status(403).json({ error: 'O Vybe Finanças exige uma sessão pessoal.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'O Vybe Finanças é só leitura.' });
  try {
    return res.status(200).json({ ok: true, ...await lerVybeFinancas(criarBanco(), quem.pessoa, req.query || {}, opcoes) });
  } catch (e) {
    if (e instanceof ErroFinancas) return res.status(502).json({ error: e.message, financas_indisponivel: true, codigo: e.codigo, ...(e.diagnostico ? { diagnostico: e.diagnostico } : {}) });
    if (e.status) return res.status(e.status).json({ error: e.message });
    return res.status(500).json({ error: 'Não foi possível ler o Vybe Finanças agora. Tente novamente.' });
  }
}
