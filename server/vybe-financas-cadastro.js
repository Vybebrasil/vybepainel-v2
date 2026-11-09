// Vybe OS → Vybe Finanças: criar e atualizar o cliente (Paulo, 09/11/2026: "pode liberar o ponto 3").
//
// A leitura continua em server/vybe-financas.js (papel vybe_os_leitura, só SELECT). Aqui é outra conexão, com o papel
// vybe_os_cadastro, que NÃO escreve em tabela nenhuma: só pode chamar public.vybe_os_salvar_cliente(...)
// (docs/vybe-financas-cadastro-cliente.sql). Cliente novo entra como "Pendente" para a cobrança automática do Finanças,
// que só roda para "Ativo", não disparar sozinha; quem administra ativa no Finanças.
//
// Sem a variável VYBE_FINANCAS_CADASTRO_URL, nada é enviado e a ficha mostra "falta no Finanças" como antes.

import postgres from 'postgres';
import { valorDoCampo, CAMPOS_CADASTRO } from './clientes-cadastro.js';

export const VARIAVEL_CADASTRO = 'VYBE_FINANCAS_CADASTRO_URL';
const OPCOES = { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 6, ssl: 'require' };
const urlValida = (u) => /^postgres(ql)?:\/\/[^\s]+$/i.test(String(u || ''));
const campo = (chave) => CAMPOS_CADASTRO.find((c) => c.chave === chave);

// O que vai para o Finanças, tirado da linha de vybe_clientes (colunas + cadastro).
export function clienteParaFinancas(linha) {
  const v = (chave) => valorDoCampo(linha, campo(chave)) || null;
  const valor = linha?.valor === null || linha?.valor === undefined || linha?.valor === '' ? null : Number(linha.valor);
  const vencimento = Number(v('vencimento'));
  return {
    nome: String(linha?.nome || '').trim(),
    cnpj: v('cnpj'),
    contato: v('contato_nome'),
    email: v('contato_email') || v('email'),
    telefone: v('contato_whatsapp') || v('telefone'),
    plano: v('plano'),
    valor: Number.isFinite(valor) ? valor : null,
    vencimento: Number.isInteger(vencimento) && vencimento >= 1 && vencimento <= 31 ? vencimento : null,
  };
}

export function criarCadastroFinancas({ env = process.env, criarSql = (url, op) => postgres(url, op) } = {}) {
  const url = String(env?.[VARIAVEL_CADASTRO] ?? '').trim();
  let sql = null;
  return {
    configurado: () => urlValida(url),
    async salvar(linha) {
      if (!urlValida(url)) return { estado: 'desligado' };
      const c = clienteParaFinancas(linha);
      if (!c.nome) throw new Error('Cliente sem nome.');
      sql ||= criarSql(url, OPCOES);
      try {
        const [r] = await sql`SELECT cliente_id::text, criado FROM public.vybe_os_salvar_cliente(
          ${c.nome}, ${c.cnpj}, ${c.contato}, ${c.email}, ${c.telefone}, ${c.plano}, ${c.valor}, ${c.vencimento})`;
        return { estado: r?.criado ? 'criado' : 'atualizado', id: r?.cliente_id || null };
      } catch (e) {
        // Nunca a URL, a senha ou a mensagem crua do Postgres para a tela.
        const permissao = /permission denied|does not exist/i.test(String(e?.message || ''));
        throw Object.assign(new Error(permissao
          ? 'O Finanças ainda não liberou o cadastro para o Vybe OS (rode o SQL de docs/vybe-financas-cadastro-cliente.sql).'
          : 'O Finanças não respondeu agora. Tente de novo em instantes.'), { status: 502 });
      }
    },
  };
}

let padrao = null;
export function cadastroFinancasPadrao() { return (padrao ||= criarCadastroFinancas()); }
