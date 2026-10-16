// Mapa editável e salas individuais do escritório. O servidor é a autoridade:
// quem é dono de cada sala, quem pode editar cada camada e o que é um item válido.
import { inflateSync } from "node:zlib";

// Ordem das salas individuais no mapa (sala-0 … sala-11): nove com dono e três livres.
export const DONOS_ESCRITORIO = ["Paulo", "Vinícius", "Ewerton", "Deivid", "Bia", "Jady", "Mizinho", "Taynara", "Reriston", "", "", ""];
// Como cada um está no cadastro quando o nome da sala é apelido ou outra grafia.
const DONOS_CADASTRO = { Bia: ["Beatriz"], Taynara: ["Tainara"], Mizinho: ["Ademir"] };
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Liga cada sala ao dono pelo primeiro nome (sem acento) ou pelo nome completo
// começando por ele. Quem não está na lista não ganha sala; livres ficam livres.
export function salasDoEscritorio(equipe = []) {
  const usados = new Set();
  return DONOS_ESCRITORIO.map((dono, i) => {
    let pessoa = null;
    if (dono) {
      const alvos = [dono, ...(DONOS_CADASTRO[dono] || [])].map(semAcento);
      pessoa = equipe.find((p) => !usados.has(String(p.id)) && alvos.includes(semAcento(p.nome).split(/\s+/)[0]))
        || equipe.find((p) => !usados.has(String(p.id)) && alvos.some((a) => semAcento(p.nome).startsWith(a)))
        || null;
      if (pessoa) usados.add(String(pessoa.id));
    }
    return { id: "sala-" + i, dono, pessoa_id: pessoa ? String(pessoa.id) : null };
  });
}

export const LADO_SALA = 10;
const LIMITE = { geral: { x: 80, y: 58, itens: 900 }, sala: { x: LADO_SALA, y: LADO_SALA, itens: 80 } };
// Item: [classe, x, y, direção, estado, altura]. Nas salas, x/y são relativos à
// sala e o item inteiro fica dentro dela (o tamanho real é conferido no mapa).
export function itensValidos(camada, itens) {
  if (!Array.isArray(itens)) throw new Error("Itens inválidos.");
  const lim = camada === "geral" ? LIMITE.geral : LIMITE.sala;
  if (itens.length > lim.itens) throw new Error(`No máximo ${lim.itens} itens.`);
  return itens.map((it) => {
    if (!Array.isArray(it) || it.length < 4) throw new Error("Item inválido.");
    const [classe, x, y, dir, estado = 0, altura = 0] = it;
    if (typeof classe !== "string" || !/^[a-z0-9_]{1,64}$/i.test(classe)) throw new Error("Móvel inválido.");
    const num = (v, min, max) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max;
    if (!num(x, 0, lim.x - 0.01) || !num(y, 0, lim.y - 0.01)) throw new Error("Móvel fora da área que você pode editar.");
    if (![0, 2, 4, 6].includes(Number(dir))) throw new Error("Direção inválida.");
    if (!num(estado, 0, 200) || !num(altura, 0, 5)) throw new Error("Estado ou altura inválidos.");
    const r = (v) => Math.round(Number(v) * 100) / 100;
    return [classe, r(x), r(y), Number(dir), Math.round(Number(estado)), r(altura)];
  });
}

export async function mapaPronto(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_mapa') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}
// Camadas salvas; sem a tabela (migração ainda não aplicada), o mapa padrão.
export async function carregarMapaEscritorio(sql) {
  if (!(await mapaPronto(sql))) return { editavel: false, camadas: {} };
  const linhas = await sql`SELECT camada, itens, versao FROM vybe_escritorio_mapa`;
  return { editavel: true, camadas: Object.fromEntries(linhas.map((l) => [l.camada, { itens: l.itens, versao: l.versao }])) };
}
// Salva uma camada inteira. Permissão: 'geral' só administrador; sala, o dono
// ou administrador. A versão evita apagar o que outra pessoa salvou antes.
export async function salvarCamadaEscritorio(sql, pessoa, salas, { camada, itens, versao }) {
  const sala = salas.find((s) => s.id === camada);
  if (camada !== "geral" && !sala) throw new Error("Camada inválida.");
  const admin = Boolean(pessoa.admin);
  if (camada === "geral" ? !admin : !admin && sala.pessoa_id !== String(pessoa.id))
    throw Object.assign(new Error(camada === "geral" ? "Só quem administra edita o mapa." : "Você só edita a sua sala."), { status: 403 });
  if (!(await mapaPronto(sql))) throw Object.assign(new Error("O mapa editável aguarda a migração revisada do banco."), { status: 503 });
  const limpos = itensValidos(camada, itens);
  const esperada = Number(versao) || 0;
  const [r] = await sql`INSERT INTO vybe_escritorio_mapa(camada, itens, versao, atualizado_por)
    VALUES(${camada}, ${JSON.stringify(limpos)}::jsonb, 1, ${pessoa.id})
    ON CONFLICT(camada) DO UPDATE SET itens = EXCLUDED.itens, versao = vybe_escritorio_mapa.versao + 1,
      atualizado_por = EXCLUDED.atualizado_por, atualizado_em = NOW()
    WHERE vybe_escritorio_mapa.versao = ${esperada}
    RETURNING versao`;
  if (!r) throw Object.assign(new Error("Alguém salvou esta área antes. Recarregue para ver a versão nova."), { status: 409 });
  return { camada, versao: r.versao, itens: limpos };
}

// Móvel do catálogo que ainda não está no painel: busca o .nitro no
// habboassets e devolve o .json ou o .png. Arte do Habbo, uso interno.
const cacheArte = new Map();
export async function arteRemotaEscritorio(classe, extensao, buscar = fetch) {
  if (!/^[a-z0-9_]{1,64}$/i.test(classe)) throw new Error("Móvel inválido.");
  if (!cacheArte.has(classe)) {
    cacheArte.set(classe, (async () => {
      const info = await buscar(`https://www.habboassets.com/imaging/info/furniture/${encodeURIComponent(classe)}`);
      if (!info.ok) throw Object.assign(new Error("Móvel não encontrado."), { status: 404 });
      const { latest } = await info.json();
      const r = await buscar(`https://cdn.habboassets.com/derived/furni/${encodeURIComponent(latest)}/${encodeURIComponent(classe)}/${encodeURIComponent(classe)}.nitro`);
      if (!r.ok) throw Object.assign(new Error("Móvel não encontrado."), { status: 404 });
      const buf = Buffer.from(await r.arrayBuffer());
      let p = 0;
      const arquivos = {};
      const qtd = buf.readUInt16BE(p); p += 2;
      for (let i = 0; i < qtd; i++) {
        const n = buf.readUInt16BE(p); p += 2;
        const nome = buf.subarray(p, p + n).toString(); p += n;
        const t = buf.readUInt32BE(p); p += 4;
        arquivos[nome] = inflateSync(buf.subarray(p, p + t)); p += t;
      }
      const json = Object.entries(arquivos).find(([n]) => n.endsWith(".json"))?.[1];
      const png = Object.entries(arquivos).find(([n]) => n.endsWith(".png"))?.[1];
      if (!json || !png) throw Object.assign(new Error("Móvel sem arte."), { status: 404 });
      return { json, png };
    })().catch((e) => { cacheArte.delete(classe); throw e; }));
  }
  return (await cacheArte.get(classe))[extensao];
}
