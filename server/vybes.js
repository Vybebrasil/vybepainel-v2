// VYBES dentro do Vybe OS (decisão do Paulo, 02/11/2026: "é o nosso VYBES dentro lá, não uma interface nova").
// A central do VYBES roda no PC do Paulo (o ser, a voz, o WhatsApp, o modelo local) e fica acessível por um túnel.
// O bot publica aqui o endereço atual do túnel (consulta `vybes_publicar`); o cartão VYBES da tela de módulos pede um crachá
// (`entradaVybes`) e abre a central com ele. O crachá diz quem é e se pode agir; a central confere a assinatura.
// - Quem age (vybe_vybes_operadores: Paulo, Vinícius, Ewerton L., Deivid): as ações que pedem na central chegam pelo
//   bot (consulta `vybes_acao`) e passam pelo MESMO executor das ações do assistente, com a permissão da pessoa.
// - O resto da equipe só vê (a central não aceita pedido de quem não age).
// Migração: migrations/2026-11-02-vybes.sql.
import { createHmac } from 'node:crypto';
import { prepararAcao, confirmarAcao } from './assistente-acoes.js';

const TUNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const CRACHA_VALE_MS = 2 * 60e3;
const TUNEL_VELHO_MS = 10 * 60e3;

function erro(mensagem, status) { return Object.assign(new Error(mensagem), { status }); }

// A migração 2026-11-02-vybes.sql aplicada pelo próprio servidor no primeiro uso (autorizada pelo Paulo em
// 02/11/2026; mesmo padrão de vybe_ai_acoes em assistente-acoes.js). Só cria; a cópia de quem age acontece uma vez,
// quando a tabela nasce — depois, mudar quem age é mudar a tabela, e nada aqui repõe ninguém.
let tabelasVybes = null;
export function garantirTabelasVybes(sql) {
  if (!tabelasVybes) tabelasVybes = (async () => {
    const [r] = await sql`SELECT to_regclass('public.vybe_vybes_operadores') IS NOT NULL AS ok`;
    if (r?.ok) return;
    await sql.query(`CREATE TABLE IF NOT EXISTS vybe_vybes_estado (id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      estado jsonb NOT NULL, atualizado_em timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`CREATE TABLE IF NOT EXISTS vybe_vybes_operadores (pessoa_id bigint PRIMARY KEY REFERENCES vybe_pessoas(id),
      desde timestamptz NOT NULL DEFAULT now())`);
    await sql.query(`INSERT INTO vybe_vybes_operadores (pessoa_id) SELECT pessoa_id FROM vybe_escritorio_avisos_autores ON CONFLICT (pessoa_id) DO NOTHING`);
  })().catch((e) => { tabelasVybes = null; throw e; });
  return tabelasVybes;
}
export function esquecerTabelasVybes() { tabelasVybes = null; } // só para os testes (cada um tem um banco novo)

// O que o bot publica: só o endereço do túnel (e quando). Nada de dado de cliente passa por aqui.
export async function guardarEstadoVybes(sql, estado) {
  if (!estado || typeof estado !== 'object' || Array.isArray(estado)) throw erro('Estado inválido.', 400);
  const tunel = estado.tunel == null ? null : String(estado.tunel);
  if (tunel !== null && !TUNEL.test(tunel)) throw erro('Endereço do túnel inválido.', 400);
  const e = { versao: 2, tunel };
  await garantirTabelasVybes(sql);
  await sql`INSERT INTO vybe_vybes_estado (id, estado, atualizado_em) VALUES (1, ${JSON.stringify(e)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET estado = EXCLUDED.estado, atualizado_em = now()`;
  return { guardado: true };
}

export async function podeAgirNoVybes(sql, quem) {
  const id = Number(quem?.pessoa?.id);
  if (quem?.tipo !== 'sessao' || !Number.isInteger(id) || id <= 0) return false;
  await garantirTabelasVybes(sql);
  const [r] = await sql`SELECT 1 AS ok FROM vybe_vybes_operadores o JOIN vybe_pessoas p ON p.id = o.pessoa_id
    WHERE o.pessoa_id = ${id} AND p.ativo IS TRUE`;
  return Boolean(r?.ok);
}

// Mesmo formato do crachá que a central confere (entrada-vybes.js no PC): corpo base64url + HMAC com a chave derivada
// da credencial que os dois já compartilham (VYBE_AI_BOT_TOKEN), só para isto.
export function assinarCracha(dados, base = process.env.VYBE_AI_BOT_TOKEN) {
  const b = String(base || '').trim();
  if (!/^[A-Za-z0-9_-]{48,256}$/.test(b)) throw erro('VYBES indisponível agora.', 503);
  const chave = createHmac('sha256', b).update('vybes-entrada-v1').digest();
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return corpo + '.' + createHmac('sha256', chave).update(corpo).digest('base64url');
}

// Cartão VYBES na tela de módulos: se a central está no ar (o bot publicou o túnel há pouco) e se quem olha pode agir.
export async function estadoVybes(sql, quem, { agora = Date.now() } = {}) {
  const id = Number(quem?.pessoa?.id);
  if (quem?.tipo !== 'sessao' || !Number.isInteger(id) || id <= 0) throw erro('Entre no painel para abrir o VYBES.', 401);
  await garantirTabelasVybes(sql);
  const [linha] = await sql`SELECT estado, atualizado_em FROM vybe_vybes_estado WHERE id = 1`;
  const tunel = linha?.estado?.tunel;
  const noAr = Boolean(tunel && TUNEL.test(tunel) && agora - Date.parse(linha.atualizado_em) <= TUNEL_VELHO_MS);
  return { noAr, agir: await podeAgirNoVybes(sql, quem) };
}

// Cartão VYBES: o link de entrada na central, com o crachá de quem está logado (vale 2 min; a central troca por um cookie).
export async function entradaVybes(sql, quem, { env = process.env, agora = Date.now() } = {}) {
  const id = Number(quem?.pessoa?.id);
  if (quem?.tipo !== 'sessao' || !Number.isInteger(id) || id <= 0) throw erro('Entre no painel para abrir o VYBES.', 401);
  await garantirTabelasVybes(sql);
  const [linha] = await sql`SELECT estado, atualizado_em FROM vybe_vybes_estado WHERE id = 1`;
  const tunel = linha?.estado?.tunel;
  if (!tunel || !TUNEL.test(tunel) || agora - Date.parse(linha.atualizado_em) > TUNEL_VELHO_MS)
    throw erro('O VYBES do PC do Paulo está desligado agora. Tente de novo em alguns minutos.', 503);
  const [p] = await sql`SELECT id, nome FROM vybe_pessoas WHERE id = ${id} AND ativo IS TRUE`;
  if (!p) throw erro('Pessoa inativa.', 403);
  const agir = await podeAgirNoVybes(sql, quem);
  const dono = id === Number(env.VYBE_AI_ADMIN_PESSOA_ID);
  const t = assinarCracha({ p: id, n: String(p.nome || '').slice(0, 60), a: agir, d: dono, e: agora + CRACHA_VALE_MS }, env.VYBE_AI_BOT_TOKEN);
  return { url: `${tunel}/entrar?t=${encodeURIComponent(t)}`, agir };
}

// Ação pedida na central por quem entrou pelo Vybe OS: só quem age; o resto é o executor das ações do assistente
// (que confere a permissão da pessoa em cada ação, como no WhatsApp). preparar → resumo + código; confirmar → executa.
export async function acaoVybes(sql, quem, corpo, { segredo = process.env.VYBE_AI_LINK_SECRET, executar } = {}) {
  if (!(await podeAgirNoVybes(sql, quem))) throw erro('No VYBES, só Paulo, Vinícius, Ewerton e Deivid tomam ações. Você pode ver tudo.', 403);
  const pessoaId = Number(quem.pessoa.id);
  if (corpo?.etapa === 'preparar') return prepararAcao(sql, pessoaId, corpo.pedido, segredo);
  if (corpo?.etapa === 'confirmar') return confirmarAcao(sql, pessoaId, corpo.codigo, segredo, executar ? { executar } : {});
  throw erro('Informe a etapa: preparar ou confirmar.', 400);
}

export async function areaVybes(req, res, quem, sql) {
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, ...(await estadoVybes(sql, quem)) });
    if (req.method === 'POST' && req.body?.etapa === 'entrar') return res.status(200).json({ ok: true, ...(await entradaVybes(sql, quem)) });
    return res.status(405).json({ error: 'Use o cartão VYBES para abrir a central.' });
  } catch (e) {
    const status = e.status || (e instanceof TypeError ? 400 : 500);
    return res.status(status).json({ error: status >= 500 && status !== 503 ? 'Não foi possível abrir o VYBES agora.' : e.message });
  }
}
