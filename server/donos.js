// Os donos da Vybe (Paulo, 08/11/2026): Paulo, Vinícius, Ewerton e Deivid têm TUDO liberado, em todo lugar (telas do
// Vybe OS, crachá do VYBES, rotas dos agentes, Comercial, Pessoas, Vybe Finanças). Uma regra só, a mesma do bot
// (whatsapp-ia/core/donos.js), e nunca pelo primeiro nome: um "Paulo" ou "Vinícius" homônimo não vira dono.
//
// Dono é a pessoa ativa do Vybe OS que:
//  1. tem o id do Monday (vybe_pessoas.monday_user_id) de um dos quatro — os mesmos ids de TEAM_USERS (vybe-config.js)
//     e da migração 2026-10-14-carteira-head.sql; ou
//  2. é a pessoa de VYBE_AI_ADMIN_PESSOA_ID (o Paulo, como sempre foi no crachá); ou
//  3. está em VYBE_DONOS_IDS (ids de vybe_pessoas separados por vírgula), para fixar pelo id do painel sem mexer aqui.
// "Quem administra" (vybe_pessoas.admin) continua sendo outra coisa: cada módulo decide se admin também passa.
export const DONOS_MONDAY = Object.freeze({ '68035537': 'Paulo', '68035653': 'Vinícius', '68036687': 'Ewerton', '68997024': 'Deivid' });

const idsDoEnv = (env) => new Set(String(env?.VYBE_DONOS_IDS || '').split(',').map((x) => x.trim()).filter((x) => /^[1-9]\d{0,15}$/.test(x)));

// pessoa: { id, monday_user_id? , dono? } — `dono` já calculado pela sessão (vybe_sessao.js) vale direto.
export function ehDonoPessoa(pessoa, env = process.env) {
  if (!pessoa) return false;
  if (pessoa.dono === true) return true;
  const m = pessoa.monday_user_id ?? pessoa.monday_id ?? null;
  if (m != null && Object.prototype.hasOwnProperty.call(DONOS_MONDAY, String(m))) return true;
  const id = Number(pessoa.id);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  if (String(env?.VYBE_AI_ADMIN_PESSOA_ID || '').trim() === String(id)) return true;
  return idsDoEnv(env).has(String(id));
}

// O id do Monday de uma pessoa, sem quebrar onde a coluna não existe (bancos de teste): '' quando não tem.
export async function mondayDaPessoa(sql, id) {
  try {
    const [r] = await sql`SELECT to_jsonb(p) ->> 'monday_user_id' AS m FROM vybe_pessoas p WHERE p.id = ${Number(id)}`;
    return r?.m && /^\d{1,15}$/.test(String(r.m)) ? String(r.m) : '';
  } catch { return ''; }
}
