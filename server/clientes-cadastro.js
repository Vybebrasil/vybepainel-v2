// Cadastro único do cliente (Paulo, 09/11/2026).
//
// "A gente está desenvolvendo um ecossistema e não vários sistemas que vão ter
// o mesmo cliente cadastrado em vários lugares." O cadastro mora aqui, em
// vybe_clientes, e é a fonte do resto: o cérebro e os bots leem a lista de
// ativos, o Hub lista os nomes daqui e o Finanças se liga pelo CNPJ ou pelo nome.
//
// Antes, criar um cliente pedia só o nome (o Vinícius criou um e não soube para
// onde foi). Aqui ficam os campos da ficha completa e a conferência de onde o
// cliente já existe — e do que falta em cada sistema.
//
// Campos que já eram colunas continuam colunas (as outras telas e o bot leem
// delas). O que é novo fica em `cadastro` (jsonb): cresce sem migração, e a
// validação de cada campo está na lista abaixo, que a tela também usa.

import calc from '../shared/financas-calculos.js';

export const SECOES_CADASTRO = Object.freeze([
  { id: 'empresa', titulo: 'Empresa' },
  { id: 'responsavel', titulo: 'Responsável' },
  { id: 'contrato', titulo: 'Contrato' },
  { id: 'canais', titulo: 'Canais e marca' },
  { id: 'observacoes', titulo: 'Observações' },
]);

// coluna: grava na coluna de vybe_clientes; sem coluna, grava em cadastro->chave.
// obrigatorio: entra na conta do "cadastro completo".
export const CAMPOS_CADASTRO = Object.freeze([
  { chave: 'razao_social', rotulo: 'Razão social', secao: 'empresa', tipo: 'texto', max: 200 },
  { chave: 'cnpj', rotulo: 'CNPJ ou CPF', secao: 'empresa', tipo: 'documento', coluna: 'cnpj', obrigatorio: true },
  { chave: 'segmento', rotulo: 'Segmento', secao: 'empresa', tipo: 'texto', coluna: 'segmento', max: 80, obrigatorio: true },
  { chave: 'endereco', rotulo: 'Endereço', secao: 'empresa', tipo: 'texto', coluna: 'endereco', max: 300, largo: true, obrigatorio: true },
  { chave: 'cidade', rotulo: 'Cidade', secao: 'empresa', tipo: 'texto', max: 120, obrigatorio: true },
  { chave: 'uf', rotulo: 'Estado', secao: 'empresa', tipo: 'uf' },
  { chave: 'email', rotulo: 'E-mail da empresa', secao: 'empresa', tipo: 'email', coluna: 'email' },
  { chave: 'telefone', rotulo: 'Telefone da empresa', secao: 'empresa', tipo: 'telefone', coluna: 'telefone' },

  { chave: 'contato_nome', rotulo: 'Nome do responsável', secao: 'responsavel', tipo: 'texto', max: 120, obrigatorio: true },
  { chave: 'contato_cargo', rotulo: 'Cargo', secao: 'responsavel', tipo: 'texto', max: 80 },
  { chave: 'contato_whatsapp', rotulo: 'WhatsApp do responsável', secao: 'responsavel', tipo: 'telefone', obrigatorio: true },
  { chave: 'contato_email', rotulo: 'E-mail do responsável', secao: 'responsavel', tipo: 'email' },
  { chave: 'aprova', rotulo: 'Quem aprova as peças', secao: 'responsavel', tipo: 'texto', max: 200, largo: true,
    dica: 'Se for outra pessoa: nome e WhatsApp.' },

  { chave: 'plano', rotulo: 'Plano', secao: 'contrato', tipo: 'texto', coluna: 'plano', max: 120, obrigatorio: true },
  { chave: 'tipo_contrato', rotulo: 'Tipo de contrato', secao: 'contrato', tipo: 'opcao',
    opcoes: ['Mensal recorrente', 'Projeto fechado', 'Pontual', 'Permuta'], obrigatorio: true },
  { chave: 'contrato_inicio', rotulo: 'Início do contrato', secao: 'contrato', tipo: 'data', obrigatorio: true },
  { chave: 'contrato_fim', rotulo: 'Fim previsto', secao: 'contrato', tipo: 'data' },
  { chave: 'valor', rotulo: 'Valor mensal (R$)', secao: 'contrato', tipo: 'dinheiro', coluna: 'valor', dinheiro: true },
  { chave: 'vencimento', rotulo: 'Dia do vencimento', secao: 'contrato', tipo: 'dia', dinheiro: true },
  { chave: 'contrato_url', rotulo: 'Contrato (link do PDF no Drive)', secao: 'contrato', tipo: 'url', largo: true },

  { chave: 'instagram', rotulo: 'Instagram', secao: 'canais', tipo: 'texto', max: 120, obrigatorio: true },
  { chave: 'site', rotulo: 'Site', secao: 'canais', tipo: 'url' },
  { chave: 'grupo_whatsapp', rotulo: 'Grupo do WhatsApp com o cliente', secao: 'canais', tipo: 'texto', max: 160, largo: true,
    dica: 'O nome do grupo como aparece no WhatsApp. É por ele que o VYBES reconhece o cliente.', obrigatorio: true },
  { chave: 'logo_url', rotulo: 'Logo (link no Drive)', secao: 'canais', tipo: 'url', largo: true },

  { chave: 'escopo', rotulo: 'O que foi contratado', secao: 'observacoes', tipo: 'longo', max: 4000, largo: true, obrigatorio: true,
    dica: 'Escopo, quantidade de peças, redes, o que não está incluso.' },
  { chave: 'observacoes', rotulo: 'Comentários extras', secao: 'observacoes', tipo: 'longo', max: 4000, largo: true,
    dica: 'Preferências, pedidos especiais, como o cliente gosta de ser atendido.' },
  { chave: 'como_chegou', rotulo: 'Como chegou à Vybe', secao: 'observacoes', tipo: 'texto', max: 200, largo: true },
]);

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const POR_CHAVE = new Map(CAMPOS_CADASTRO.map((c) => [c.chave, c]));

function invalido(mensagem) { return Object.assign(new Error(mensagem), { status: 400 }); }
const digitos = (v) => String(v ?? '').replace(/\D+/g, '');

// Devolve o valor limpo, '' para apagar, ou lança 400 com a frase para quem preencheu.
export function limparCampo(campo, bruto) {
  if (bruto === null || bruto === undefined) return '';
  if (typeof bruto !== 'string' && typeof bruto !== 'number') throw invalido(`${campo.rotulo}: valor inválido.`);
  const v = String(bruto).trim();
  if (!v) return '';
  switch (campo.tipo) {
    case 'documento': {
      const d = digitos(v);
      if (d.length !== 11 && d.length !== 14) throw invalido('CNPJ precisa de 14 números (ou CPF, 11).');
      return d.length === 14
        ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
        : `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }
    case 'email':
      if (v.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw invalido(`${campo.rotulo}: e-mail inválido.`);
      return v.toLowerCase();
    case 'telefone': {
      const d = digitos(v);
      if (d.length < 10 || d.length > 13) throw invalido(`${campo.rotulo}: use DDD e número, como (74) 99999-9999.`);
      return v.slice(0, 30);
    }
    case 'url': {
      let u;
      try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { throw invalido(`${campo.rotulo}: endereço inválido.`); }
      if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) throw invalido(`${campo.rotulo}: endereço inválido.`);
      return u.href.slice(0, 600);
    }
    case 'data':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) throw invalido(`${campo.rotulo}: data inválida.`);
      return v;
    case 'dia': {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 31) throw invalido(`${campo.rotulo}: um dia de 1 a 31.`);
      return String(n);
    }
    case 'dinheiro': {
      const n = Number(v.replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw invalido(`${campo.rotulo}: valor inválido.`);
      return String(Math.round(n * 100) / 100);
    }
    case 'uf': {
      const uf = v.toUpperCase();
      if (!UFS.has(uf)) throw invalido('Estado: use a sigla, como BA.');
      return uf;
    }
    case 'opcao':
      if (!campo.opcoes.includes(v)) throw invalido(`${campo.rotulo}: escolha uma das opções.`);
      return v;
    default:
      return v.slice(0, campo.max || 200);
  }
}

// { chave: valor } da tela → { colunas, extras } prontos para gravar.
// Campo que não veio fica como está; campo que veio vazio é apagado.
// Quem não vê dinheiro não grava campo de dinheiro (o servidor ignora).
export function separarCampos(campos, { veDinheiro = true } = {}) {
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) throw invalido('Informe os campos do cadastro.');
  const colunas = {}, extras = {};
  for (const [chave, bruto] of Object.entries(campos)) {
    const campo = POR_CHAVE.get(chave);
    if (!campo) continue;
    if (campo.dinheiro && !veDinheiro) continue;
    const limpo = limparCampo(campo, bruto);
    if (campo.coluna) colunas[campo.coluna] = limpo || null;
    else extras[chave] = limpo;
  }
  if (extras.contrato_inicio && extras.contrato_fim && extras.contrato_fim < extras.contrato_inicio)
    throw invalido('O fim previsto do contrato vem antes do início.');
  return { colunas, extras };
}

let esquemaPronto = false;
export async function garantirSchemaDoCadastro(db) {
  if (esquemaPronto) return;
  await db`ALTER TABLE vybe_clientes ADD COLUMN IF NOT EXISTS cadastro JSONB NOT NULL DEFAULT '{}'::jsonb`;
  esquemaPronto = true;
}

export async function salvarCadastro(db, id, campos, opcoes = {}) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw invalido('Informe o cliente.');
  const { colunas, extras } = separarCampos(campos, opcoes);
  await garantirSchemaDoCadastro(db);
  const [antes] = await db`SELECT id, cadastro FROM vybe_clientes WHERE id=${Number(id)} AND apagado_em IS NULL`;
  if (!antes) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
  const cadastro = { ...(antes.cadastro || {}) };
  for (const [k, v] of Object.entries(extras)) { if (v) cadastro[k] = v; else delete cadastro[k]; }
  // Um UPDATE só, com as colunas fixas: a que não veio no pedido fica como está.
  const veio = (c) => Object.prototype.hasOwnProperty.call(colunas, c);
  const v = (c) => (veio(c) ? colunas[c] : null);
  const [r] = await db`UPDATE vybe_clientes SET
      cnpj      = CASE WHEN ${veio('cnpj')}      THEN ${v('cnpj')}      ELSE cnpj      END,
      segmento  = CASE WHEN ${veio('segmento')}  THEN ${v('segmento')}  ELSE segmento  END,
      endereco  = CASE WHEN ${veio('endereco')}  THEN ${v('endereco')}  ELSE endereco  END,
      email     = CASE WHEN ${veio('email')}     THEN ${v('email')}     ELSE email     END,
      telefone  = CASE WHEN ${veio('telefone')}  THEN ${v('telefone')}  ELSE telefone  END,
      plano     = CASE WHEN ${veio('plano')}     THEN ${v('plano')}     ELSE plano     END,
      valor     = CASE WHEN ${veio('valor')}     THEN ${v('valor')}::numeric ELSE valor END,
      cadastro  = ${JSON.stringify(cadastro)}::jsonb
    WHERE id=${Number(id)} RETURNING id, nome`;
  return { ok: true, cliente: r };
}

// Lê o valor de um campo numa linha de vybe_clientes (coluna ou cadastro).
export function valorDoCampo(linha, campo) {
  const bruto = campo.coluna ? linha?.[campo.coluna] : linha?.cadastro?.[campo.chave];
  return bruto === null || bruto === undefined ? '' : String(bruto).trim();
}

export function completude(linha) {
  const obrigatorios = CAMPOS_CADASTRO.filter((c) => c.obrigatorio);
  const faltam = obrigatorios.filter((c) => !valorDoCampo(linha, c)).map((c) => c.rotulo);
  return { feitos: obrigatorios.length - faltam.length, total: obrigatorios.length, faltam };
}

// ── onde o cliente existe ────────────────────────────────────────────────────
// Uma linha por sistema: ok (está lá), falta (não está, e diz o que fazer) ou
// conferir (daqui não dá para saber; diz onde olhar). Nunca "ok" sem prova.
export function estadoNoEcossistema({ cliente, acesso = null, financas = null, hubUrl = '', criaNoFinancas = false, driveErro = '' }) {
  const ativo = cliente.ativo !== false && !cliente.nao_e_cliente && !cliente.apagado_em;
  // Só o grupo do WhatsApp informado no cadastro: vybe_acessos.grupo é o grupo do Monday ("Banco de dados"), e usá-lo
  // fazia a ficha dizer "Está lá" sem prova (revisão de 09/11/2026).
  const grupo = String(cliente.cadastro?.grupo_whatsapp || '').trim();
  const drive = String(acesso?.drive || '').trim();
  const comp = completude(cliente);
  const linhas = [];
  linhas.push({ id: 'vybe_os', nome: 'Vybe OS', estado: ativo ? 'ok' : 'falta',
    detalhe: ativo ? `Ativo. Cadastro com ${comp.feitos} de ${comp.total} itens essenciais.` : 'Fora do painel: não aparece nas telas nem recebe conteúdo.',
    acao: !ativo ? 'reativar' : comp.faltam.length ? 'cadastro' : '' });
  linhas.push({ id: 'cerebro', nome: 'Cérebro do VYBES', estado: ativo ? 'ok' : 'falta',
    detalhe: ativo ? 'Lê o cadastro e a operação deste cliente. O estudo de identidade aparece na aba Cérebro.' : 'Só entra quem está ativo.',
    acao: ativo ? 'cerebro' : '' });
  linhas.push({ id: 'bots', nome: 'Bots e WhatsApp', estado: !ativo ? 'falta' : grupo ? 'ok' : 'falta',
    detalhe: !ativo ? 'Só entra quem está ativo.' : grupo ? `Agentes leem o cliente da lista de ativos. Grupo: ${grupo}.`
      : 'Os agentes já conhecem o cliente, mas falta dizer qual é o grupo do WhatsApp dele.',
    acao: grupo ? '' : 'grupo' });
  const driveNaoAbre = Boolean(drive && /\b404\b|not found|não encontrad/i.test(String(driveErro || '')));
  linhas.push({ id: 'drive', nome: 'Google Drive', estado: drive && !driveNaoAbre ? 'ok' : 'falta',
    detalhe: driveNaoAbre ? 'A pasta ligada não abre para o sistema (o Drive respondeu "não encontrado"). Compartilhe a pasta com a integração ou ligue a certa.'
      : drive ? 'Pasta do cliente ligada.' : 'Nenhuma pasta ligada. Peças e planejamentos procuram a pasta pelo nome; ligue a certa.',
    acao: drive && !driveNaoAbre ? 'abrir_drive' : 'drive', link: drive || '' });
  linhas.push({ id: 'hub', nome: 'Vybe Hub', estado: 'conferir',
    detalhe: ativo ? 'O Hub lista os clientes ativos daqui. O portal (endereço e senha) se cria lá, no admin.' : 'O Hub segue o Vybe OS: inativo aqui some de lá.',
    acao: hubUrl ? 'abrir_hub' : '', link: hubUrl ? new URL('/admin', hubUrl).href : '' });
  if (!financas || financas.estado === 'desligado') {
    linhas.push({ id: 'financas', nome: 'Vybe Finanças', estado: 'conferir',
      detalhe: 'A leitura do Finanças não está ligada neste ambiente.', acao: 'abrir_financas', link: 'https://vybe-financas.vercel.app/' });
  } else if (financas.estado === 'erro') {
    linhas.push({ id: 'financas', nome: 'Vybe Finanças', estado: 'conferir',
      detalhe: 'O Finanças não respondeu agora. Tente de novo em instantes.', acao: 'abrir_financas', link: 'https://vybe-financas.vercel.app/' });
  } else {
    const par = financas.ligacao;
    const porQue = { cnpj: 'pelo CNPJ', nome: 'pelo nome', nome_parecido: 'pelo nome parecido' };
    linhas.push({ id: 'financas', nome: 'Vybe Finanças', estado: par ? 'ok' : 'falta',
      detalhe: par ? `Ligado ${porQue[par.por] || ''} a "${par.financas_nome}".`
        : criaNoFinancas ? 'Ainda não está no Finanças. "Criar no Finanças" leva o cadastro para lá como Pendente (a cobrança só começa quando alguém ativar lá).'
        : cliente.cnpj ? 'Não há cliente com este CNPJ nem com este nome no Finanças. Cadastre lá com o mesmo CNPJ.'
          : 'Não achei pelo nome. Preencha o CNPJ aqui e cadastre lá com o mesmo CNPJ: é ele que liga os dois.',
      acao: par ? '' : criaNoFinancas ? 'criar_financas' : 'abrir_financas', link: 'https://vybe-financas.vercel.app/' });
  }
  return linhas;
}

// O par do cliente no Finanças, com a mesma regra da Carteira e do Comercial.
export function parNoFinancas(clientesFinancas, clientesVybe, idVybe) {
  const ligacao = calc.ligarClientes(clientesFinancas || [], clientesVybe || []);
  return ligacao.ligados.find((l) => l.vybe_id === String(idVybe)) || null;
}
