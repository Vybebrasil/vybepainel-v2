import { carregarEconomia, nomeDoMovel } from "./escritorio-economia.js";
import { validarPisoQuarto, partesDaCamada, perfilDoAndar, CELDAS_LIVRES } from "./escritorio-quartos.js";
// Mapa editável e salas individuais do escritório. O servidor é a autoridade:
// quem é dono de cada sala, quem pode editar cada camada e o que é um item válido.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

// Ordem das salas individuais no mapa (sala-0 … sala-8), uma por pessoa.
export const DONOS_ESCRITORIO = ["Paulo", "Vinícius", "Ewerton", "Deivid", "Bia", "Jady", "Mizinho", "Taynara", "Reriston"];
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

// Maior quarto (12 × 12): cada planta usa o canto dela (de 6 × 6 a 12 × 12).
export const LADO_SALA = 24; // = LADO_QUARTO (escritorio-quartos.js)
// Limites como os do Habbo (construções de 1.000+ móveis num quarto); o mapa
// foi medido com 1.188 blocos empilhados a 60 quadros por segundo.
const LIMITE = { geral: { x: 80, y: 80, itens: 1500 }, sala: { x: LADO_SALA, y: LADO_SALA, itens: 1500 }, cena: { x: 30, y: 30, itens: 1500 } };
// Salas comuns com cena própria: camada com o id da zona (a mesma do Worker),
// editada só por quem administra, sem inventário (decisão do Paulo, 18/10/2026).
export const CENAS_COMUNS = new Set(["recepcao", "reuniao", "auditorio", "producao", "cafe", "jogos", "foco", "academia", "lounge", "operacao", "subsolo"]);
// Item: [classe, x, y, direção, estado, altura]. Nas salas, x/y são relativos à
// sala e o item inteiro fica dentro dela (o tamanho real é conferido no mapa).
let classesDeParede;
function itemDeParede(classe) {
  classesDeParede ??= new Set(JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/catalogo.json', import.meta.url), 'utf8')).filter(m => m.parede).map(m => m.classe));
  return classesDeParede.has(classe);
}
export function itensValidos(camada, itens) {
  if (!Array.isArray(itens)) throw new Error("Itens inválidos.");
  const lim = camada === "geral" ? LIMITE.geral : CENAS_COMUNS.has(camada) ? LIMITE.cena : LIMITE.sala;
  if (itens.length > lim.itens) throw new Error(`No máximo ${lim.itens} itens.`);
  return itens.map((it) => {
    if (!Array.isArray(it) || it.length < 4) throw new Error("Item inválido.");
    const [classe, x, y, dir, estado = 0, altura = 0] = it;
    if (typeof classe !== "string" || !/^[a-z0-9_]{1,64}$/i.test(classe)) throw new Error("Móvel inválido.");
    const num = (v, min, max) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max;
    if (!num(x, 0, lim.x - 0.01) || !num(y, 0, lim.y - 0.01)) throw new Error("Móvel fora da área que você pode editar.");
    if (![0, 2, 4, 6].includes(Number(dir))) throw new Error("Direção inválida.");
    // No chão, altura de 0 a 40. Na parede, deslocamento assinado
    // a partir do encaixe da arte; o catálogo do servidor define o tipo.
    if (!num(estado, 0, 200) || !num(altura, Number(altura) < 0 && itemDeParede(classe) ? -40 : 0, 40)) throw new Error("Estado ou altura inválidos.");
    const r = (v) => Math.round(Number(v) * 100) / 100;
    const item = [classe, r(x), r(y), Number(dir), Math.round(Number(estado)), r(altura)];
    const cfg = configGatilho(classe, it[6], lim) || configTrofeu(classe, it[6]) || configManequim(classe, it[6]) || configFundo(classe, it[6]);
    return cfg ? [...item, cfg] : item;
  });
}
// Gatilhos, condições e efeitos (o Wired do Habbo): 7º campo com até 5
// móveis escolhidos (m, origem e classe), um texto curto (t) e segundos (s).
// Só nos móveis de gatilho; nos outros o campo é descartado.
export const GATILHO = /^wf_(trg|cnd|act)_[a-z0-9_]+$/;
// Troféu (furniture_trophy): dedicatória gravada, como no Habbo — nome (até
// 40), texto (até 100) e data (AAAA-MM-DD).
export const TROFEU = /(^|_)(prize)?troph(y|ies)|^cine_star$|^xm09_trophy$|lovelock/i;
// Manequim (furniture_mannequin): o visual guardado nele (mesmo formato da
// figura do perfil).
export const MANEQUIM = /mannequin/i;
const FIGURA = /^[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}(\.[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}){0,15}$/;
// Cor de fundo do quarto (furniture_background_color, o "toner" do Habbo):
// pinta o vazio em volta do quarto; guarda só a cor ({ c: "#rrggbb" }).
const FUNDO = /^(roombg_color|background_color|room_info15_bg)$/;
function configFundo(classe, cfg) {
  if (!FUNDO.test(classe) || cfg == null) return null;
  if (typeof cfg !== "object" || !/^#[0-9a-f]{6}$/i.test(String(cfg.c || ""))) throw new Error("Cor de fundo inválida.");
  return { c: String(cfg.c).toLowerCase() };
}
function configManequim(classe, cfg) {
  if (!MANEQUIM.test(classe) || cfg == null) return null;
  if (typeof cfg !== "object" || !FIGURA.test(String(cfg.f || ""))) throw new Error("Visual do manequim inválido.");
  return { f: String(cfg.f) };
}
function configTrofeu(classe, cfg) {
  if (!TROFEU.test(classe) || cfg == null) return null;
  if (typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("Dedicatória do troféu inválida.");
  const saida = {};
  if (cfg.n != null) { if (typeof cfg.n !== "string" || cfg.n.length > 40) throw new Error("Nome do troféu com até 40 letras."); saida.n = cfg.n.trim(); }
  if (cfg.t != null) { if (typeof cfg.t !== "string" || cfg.t.length > 100) throw new Error("Dedicatória com até 100 letras."); saida.t = cfg.t.trim(); }
  if (cfg.d != null) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cfg.d))) throw new Error("Data do troféu inválida."); saida.d = String(cfg.d); }
  return Object.keys(saida).length ? saida : null;
}
function configGatilho(classe, cfg, lim) {
  if (!GATILHO.test(classe) || cfg == null) return null;
  if (typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("Configuração do gatilho inválida.");
  const saida = {};
  if (cfg.m != null) {
    if (!Array.isArray(cfg.m) || cfg.m.length > 5) throw new Error("No máximo 5 móveis por gatilho.");
    // [x, y, classe]: a origem do móvel escolhido e qual é (a classe é opcional).
    saida.m = cfg.m.map((p) => {
      if (!Array.isArray(p) || p.length < 2 || p.length > 3 || ![p[0], p[1]].every((v) => Number.isInteger(Number(v)))) throw new Error("Móvel do gatilho inválido.");
      if (p.length === 3 && (typeof p[2] !== "string" || !/^[a-z0-9_]{1,64}$/i.test(p[2]))) throw new Error("Móvel do gatilho inválido.");
      const [x, y] = [Number(p[0]), Number(p[1])];
      if (x < 0 || y < 0 || x >= lim.x || y >= lim.y) throw new Error("Móvel do gatilho fora da área.");
      return p.length === 3 ? [x, y, p[2]] : [x, y];
    });
  }
  if (cfg.t != null) {
    if (typeof cfg.t !== "string" || cfg.t.length > 100) throw new Error("Texto do gatilho com até 100 letras.");
    saida.t = cfg.t.trim();
  }
  if (cfg.s != null) {
    if (!Number.isInteger(Number(cfg.s)) || Number(cfg.s) < 1 || Number(cfg.s) > 60) throw new Error("Tempo do gatilho entre 1 e 60 segundos.");
    saida.s = Number(cfg.s);
  }
  return Object.keys(saida).length ? saida : null;
}

export async function mapaPronto(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_mapa') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}
// Camadas salvas; sem a tabela (migração ainda não aplicada), o mapa padrão.
// As imagens da equipe (quadros e tapetes) vêm só com os dados para desenhar;
// o arquivo sai por outra rota.
export async function carregarMapaEscritorio(sql) {
  if (!(await mapaPronto(sql))) return { editavel: false, camadas: {} };
  const linhas = await sql`SELECT camada, itens, versao, atualizado_em FROM vybe_escritorio_mapa`;
  // "em": quando foi salva (o painel ignora o mapa geral salvo sobre uma planta antiga).
  const mapa = { editavel: true, camadas: Object.fromEntries(linhas.map((l) => [l.camada, { itens: l.itens, versao: l.versao, em: l.atualizado_em }])) };
  if (await imagensProntas(sql)) mapa.imagens = await listarImagensEscritorio(sql);
  return mapa;
}
// Identidade de Paulo no escritório: quem administra e é dono da sala-0.
export function ehPauloNoEscritorio(pessoa, salas) {
  const paulo = salas.find(s=>s.id === "sala-0")?.pessoa_id;
  return Boolean(pessoa?.admin && paulo && String(pessoa.id) === String(paulo));
}
// Cada pessoa edita somente o próprio quarto. Ambientes públicos e Praça
// são exclusivos da identidade de Paulo, vinculada à sala-0 pelo servidor.
export function conferirEdicao(pessoa, salas, camada) {
  if (camada === "geral" || CENAS_COMUNS.has(camada)) {
    if (!ehPauloNoEscritorio(pessoa, salas))
      throw Object.assign(new Error("Só Paulo administra a edição das salas comuns."), {status:403});
    return;
  }
  const sala = salas.find(s=>s.id === partesDaCamada(camada)?.raiz);
  if (!sala) throw Object.assign(new Error("Camada inválida."), {status:400});
  if (String(sala.pessoa_id) !== String(pessoa.id))
    throw Object.assign(new Error("Você só edita a sua sala."), {status:403});
}
// Salva uma camada inteira. Permissão conferida acima, inclusive no histórico. A versão evita apagar o que outra pessoa salvou antes.
// Medidas no chão de cada móvel (da arte local ou, se faltar, do Habbo).
export async function dimensoesDosMoveis(itens) {
  const dimensoes=new Map();
  for(const [classe] of itens) {
    if(IMAGEM_ITEM.test(classe) || dimensoes.has(classe)) continue;
    let dados;
    try {dados=JSON.parse(readFileSync(new URL('../assets/escritorio/habbo/'+classe+'.json',import.meta.url),'utf8'));}
    catch {dados=JSON.parse((await arteRemotaEscritorio(classe,'json')).toString());}
    dimensoes.set(classe,dados.logic?.model?.dimensions || {x:1,y:1});
  }
  return dimensoes;
}
// "celdas" (opcional): a planta desenhada do quarto, salva junto com os móveis.
export async function salvarCamadaEscritorio(sql, pessoa, salas, { camada, itens, versao, celdas, decoracao }) {
  return sql.comTransacao(async tx => salvarCamadaTransacional(tx, pessoa, salas, {camada,itens,versao,celdas,decoracao}));
}
async function salvarCamadaTransacional(sql, pessoa, salas, {camada,itens,versao,celdas,decoracao}) {
  conferirEdicao(pessoa, salas, camada);
  if (!(await mapaPronto(sql))) throw Object.assign(new Error("O mapa editável aguarda a migração revisada do banco."), { status: 503 });
  const limpos = itensValidos(camada, itens);
  const comum = camada === "geral" || CENAS_COMUNS.has(camada);
  if (celdas !== undefined && (comum || !CELDAS_LIVRES.test(String(celdas)))) throw Object.assign(new Error("Planta do quarto inválida."), { status: 400 });
  if (decoracao !== undefined && (comum || !decoracao || typeof decoracao !== 'object' || Array.isArray(decoracao))) throw Object.assign(new Error('Acabamento inválido.'), {status:400});
  let novaPlanta = null, conferiuPlanta = false;
  if (!comum) {
    const dono = salas.find(s => s.id === partesDaCamada(camada)?.raiz)?.pessoa_id;
    const economia = await carregarEconomia(sql, dono);
    if (economia.disponivel) {
      const [p] = await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${dono} FOR UPDATE`;
      const decoracao=perfilDoAndar(p?.preferencias,partesDaCamada(camada)?.andar);
      if (!decoracao?.quarto_configurado) throw new Error("Configure seu quarto antes de decorar.");
      const dimensoes=await dimensoesDosMoveis(limpos);
      const livres = celdas !== undefined ? celdas : decoracao.sala_celdas;
      conferiuPlanta = true;
      validarPisoQuarto(decoracao.sala_planta,limpos,dimensoes,livres);
      if (celdas !== undefined && celdas !== (decoracao.sala_celdas || "")) novaPlanta = { preferencias: p.preferencias, andar: partesDaCamada(camada)?.andar };
      const usados = new Map();
      const raiz=partesDaCamada(camada).raiz;
      const outras=await sql`SELECT itens FROM vybe_escritorio_mapa WHERE camada<>${camada} AND (camada=${raiz} OR camada=${raiz+'-andar-1'})`;
      for (const it of [...limpos,...outras.flatMap(m=>m.itens)]) {
        if (IMAGEM_ITEM.test(it[0]) || economia.essenciais.includes(it[0])) continue;
        usados.set(it[0],(usados.get(it[0]) || 0)+1);
      }
      // Diz quais móveis faltam e quantos (Paulo, 20/10/2026: a Tainara não
      // conseguia salvar e a mensagem não dizia qual peça). A conta junta os
      // dois andares do quarto: a mesma peça não pode estar nos dois.
      const faltam = [...usados].map(([classe,n]) => ({ classe, nome: nomeDoMovel(classe), no_quarto: n, tem: economia.inventario.find(i=>i.classe===classe)?.quantidade || 0 })).filter(f => f.tem < f.no_quarto);
      if (faltam.length) throw Object.assign(new Error(`Faltam no inventário: ${faltam.map(f => `${f.nome} (no quarto ${f.no_quarto}, você tem ${f.tem})`).join("; ")}. Tire do quarto ou compre no Catálogo para salvar.`),{status:409,faltam});
    }
  }
  // Sem a loja não há validação de piso: a planta só muda com ela.
  if (celdas !== undefined && !conferiuPlanta) throw Object.assign(new Error("A planta do quarto aguarda a loja do escritório."), { status: 503 });
  if (novaPlanta) {
    const { preferencias: atual, andar } = novaPlanta, dono = salas.find(s => s.id === partesDaCamada(camada)?.raiz)?.pessoa_id;
    const salvo = andar ? { ...atual, sala_andares: (atual.sala_andares || []).map((a) => a.andar === andar ? { ...a, sala_celdas: celdas } : a) } : { ...atual, sala_celdas: celdas };
    await sql`UPDATE vybe_escritorio_perfis SET preferencias=${JSON.stringify(salvo)}::jsonb,atualizado_em=NOW() WHERE pessoa_id=${dono}`;
  }
  await conferirImagensDaCamada(sql, camada, limpos);
  // Guarda a versão que vai ser trocada (se o histórico já existe no banco).
  if (await versoesProntas(sql)) await guardarVersaoAnterior(sql, camada, Number(versao) || 0);
  const esperada = Number(versao) || 0;
  let r;
  try {
    [r] = await sql`INSERT INTO vybe_escritorio_mapa(camada, itens, versao, atualizado_por)
      VALUES(${camada}, ${JSON.stringify(limpos)}::jsonb, 1, ${pessoa.id})
      ON CONFLICT(camada) DO UPDATE SET itens = EXCLUDED.itens, versao = vybe_escritorio_mapa.versao + 1,
        atualizado_por = EXCLUDED.atualizado_por, atualizado_em = NOW()
      WHERE vybe_escritorio_mapa.versao = ${esperada}
      RETURNING versao`;
  } catch (e) {
    // Sala comum antes da migração das cenas: o banco ainda não aceita a chave.
    if (e?.code === "23514" && CENAS_COMUNS.has(camada)) throw Object.assign(new Error("Salvar as salas comuns aguarda a migração do banco (2026-10-18-escritorio-cenas-editaveis.sql)."), { status: 503 });
    throw e;
  }
  if (!r) throw Object.assign(new Error("Alguém salvou esta área antes. Recarregue para ver a versão nova."), { status: 409 });
  let perfil;
  if (decoracao !== undefined) {
    // O mesmo normalizador e a mesma validação da porta do perfil, nesta transação.
    // O cliente só pode alterar acabamento, nunca identidade, planta ou inventário.
    const { salvarPerfilNaTransacao } = await import('./escritorio.js');
    const [atual] = await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoa.id} FOR UPDATE`;
    const andar = partesDaCamada(camada).andar;
    const campos = ['sala_piso','sala_parede','sala_piso_plano','sala_parede_plano','sala_pisos','sala_paredes','sala_paredes_texturas','sala_luz','sala_porta','sala_sem_paredes','sala_espessura_parede','sala_espessura_piso','sala_altura_parede'];
    const patch = Object.fromEntries(campos.filter(k => Object.hasOwn(decoracao,k)).map(k => [k,decoracao[k]]));
    perfil = await salvarPerfilNaTransacao(sql,pessoa.id,{...atual.preferencias,...perfilDoAndar(atual.preferencias,andar),...patch,...(andar ? {andar:1} : {})},async()=>partesDaCamada(camada).raiz);
  }
  return { camada, versao: r.versao, itens: limpos, ...(perfil ? {perfil} : {}), ...(celdas !== undefined ? { celdas } : {}) };
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
      // Arquivo truncado ou de outro formato: 502 com motivo, não 500 genérico.
      try {
        const qtd = buf.readUInt16BE(p); p += 2;
        for (let i = 0; i < qtd; i++) {
          const n = buf.readUInt16BE(p); p += 2;
          const nome = buf.subarray(p, p + n).toString(); p += n;
          const t = buf.readUInt32BE(p); p += 4;
          arquivos[nome] = inflateSync(buf.subarray(p, p + t)); p += t;
        }
      } catch {
        throw Object.assign(new Error("A arte do móvel veio corrompida do acervo."), { status: 502 });
      }
      const json = Object.entries(arquivos).find(([n]) => n.endsWith(".json"))?.[1];
      const png = Object.entries(arquivos).find(([n]) => n.endsWith(".png"))?.[1];
      if (!json || !png) throw Object.assign(new Error("Móvel sem arte."), { status: 404 });
      return { json, png };
    })().catch((e) => { cacheArte.delete(classe); throw e; }));
  }
  return (await cacheArte.get(classe))[extensao];
}

// Cópia dos bonecos: em pé, 8 direções, guardada no banco na primeira vez que
// alguém pede. Se o Habbo cair, o mapa usa esta cópia.
export const FIGURA_VALIDA = /^[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}(\.[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}){0,15}$/;
const paraBuffer = (v) => (Buffer.isBuffer(v) ? v : typeof v === "string" && v.startsWith("\\x") ? Buffer.from(v.slice(2), "hex") : Buffer.from(v));
export async function bonecoEscritorio(sql, figura, direcao, buscar = fetch) {
  const dir = Number(direcao);
  if (!FIGURA_VALIDA.test(String(figura || "")) || !Number.isInteger(dir) || dir < 0 || dir > 7)
    throw Object.assign(new Error("Boneco inválido."), { status: 400 });
  const [tabela] = await sql`SELECT to_regclass('public.vybe_escritorio_bonecos') IS NOT NULL AS existe`;
  if (tabela?.existe) {
    const [r] = await sql`SELECT png FROM vybe_escritorio_bonecos WHERE figura = ${figura} AND direcao = ${dir}`;
    if (r) return paraBuffer(r.png);
  }
  const r = await buscar("https://www.habboassets.com/imaging/avatar.png?" + new URLSearchParams({ figure: figura, direction: String(dir), size: "n" }));
  if (!r.ok) throw Object.assign(new Error("Boneco indisponível."), { status: 404 });
  const png = Buffer.from(await r.arrayBuffer());
  if (tabela?.existe && png.length <= 200000)
    await sql`INSERT INTO vybe_escritorio_bonecos(figura, direcao, png) VALUES(${figura}, ${dir}, ${png}) ON CONFLICT DO NOTHING`;
  return png;
}

// Imagens da equipe. Item no mapa: ["vybeimg_<id>", x, y, dir, 0, 0]. Quadro
// fica na parede alta do fundo de uma sala (dir 4: parede de trás, y = 0;
// dir 2: parede da esquerda, x = 0); tapete fica no piso.
export const IMAGEM_ITEM = /^vybeimg_(\d{1,12})$/;
const LIMITE_IMAGEM = 1572864; // 1,5 MB
export async function imagensProntas(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_imagens') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}
export async function listarImagensEscritorio(sql) {
  const linhas = await sql`SELECT id, camada, tipo, largura, altura, nome FROM vybe_escritorio_imagens ORDER BY id`;
  return linhas.map((l) => ({ id: String(l.id), camada: l.camada, tipo: l.tipo, largura: Number(l.largura), altura: Number(l.altura), nome: l.nome }));
}
// Tipo do arquivo pelos primeiros bytes (não pelo nome nem pelo que o
// navegador disse).
export function tipoDaImagem(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString("latin1", 1, 4) === "PNG") return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}
export async function enviarImagemEscritorio(sql, pessoa, salas, { camada, tipo, largura, altura, nome = "", dados } = {}) {
  conferirEdicao(pessoa, salas, camada);
  if (!(await imagensProntas(sql))) throw Object.assign(new Error("Quadros e tapetes aguardam a migração do banco."), { status: 503 });
  if (!["quadro", "tapete"].includes(tipo)) throw Object.assign(new Error("Escolha quadro ou tapete."), { status: 400 });
  if (tipo === "quadro" && camada === "geral") throw Object.assign(new Error("Quadro vai na parede de uma sala."), { status: 400 });
  const w = Number(largura), h = Number(altura);
  const maxH = tipo === "quadro" ? 3 : 6;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || w > 6 || h < 1 || h > maxH)
    throw Object.assign(new Error(`Tamanho inválido: até 6 de largura e ${maxH} de altura.`), { status: 400 });
  const buf = Buffer.from(String(dados || ""), "base64");
  if (!buf.length) throw Object.assign(new Error("Escolha uma imagem."), { status: 400 });
  if (buf.length > LIMITE_IMAGEM) throw Object.assign(new Error("A imagem passa de 1,5 MB. Reduza e tente de novo."), { status: 413 });
  const mime = tipoDaImagem(buf);
  if (!mime) throw Object.assign(new Error("Use uma imagem PNG, JPG ou WEBP."), { status: 400 });
  const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM vybe_escritorio_imagens WHERE camada = ${camada}`;
  if (total >= 40) throw Object.assign(new Error("Esta área já tem 40 imagens. Apague alguma antes."), { status: 400 });
  const [r] = await sql`INSERT INTO vybe_escritorio_imagens(camada, tipo, largura, altura, nome, mime, dados, criado_por)
    VALUES(${camada}, ${tipo}, ${w}, ${h}, ${String(nome).slice(0, 80)}, ${mime}, ${buf}, ${String(pessoa.id)})
    RETURNING id`;
  return { id: String(r.id), camada, tipo, largura: w, altura: h, nome: String(nome).slice(0, 80) };
}
export async function imagemEscritorio(sql, id) {
  if (!/^\d{1,12}$/.test(String(id || ""))) throw Object.assign(new Error("Imagem inválida."), { status: 400 });
  if (!(await imagensProntas(sql))) throw Object.assign(new Error("Imagem não encontrada."), { status: 404 });
  const [r] = await sql`SELECT mime, dados FROM vybe_escritorio_imagens WHERE id = ${id}`;
  if (!r) throw Object.assign(new Error("Imagem não encontrada."), { status: 404 });
  return { mime: r.mime, dados: paraBuffer(r.dados) };
}
// Apaga a imagem e tira do mapa da camada os itens que a usavam (na mesma
// transação), para não sobrar quadro apontando para o nada.
export async function apagarImagemEscritorio(sql, pessoa, salas, { id } = {}) {
  if (!/^\d{1,12}$/.test(String(id || ""))) throw Object.assign(new Error("Imagem inválida."), { status: 400 });
  const [img] = await sql`SELECT camada FROM vybe_escritorio_imagens WHERE id = ${id}`;
  if (!img) throw Object.assign(new Error("Imagem não encontrada."), { status: 404 });
  conferirEdicao(pessoa, salas, img.camada);
  const classe = "vybeimg_" + id;
  const [, atualizada] = await sql.transaction([
    sql`DELETE FROM vybe_escritorio_imagens WHERE id = ${id}`,
    sql`UPDATE vybe_escritorio_mapa SET itens = COALESCE((SELECT jsonb_agg(i) FROM jsonb_array_elements(itens) i WHERE i->>0 <> ${classe}), '[]'::jsonb),
      versao = versao + 1, atualizado_por = ${pessoa.id}, atualizado_em = NOW()
      WHERE camada = ${img.camada} AND itens @> ${JSON.stringify([[classe]])}::jsonb
      RETURNING itens, versao`,
  ]);
  const camada = atualizada?.[0];
  return { id: String(id), camada: img.camada, ...(camada ? { itens: camada.itens, versao: camada.versao } : {}) };
}
// Ao salvar uma camada: cada imagem usada existe, é desta camada, e o quadro
// está encostado na parede do fundo da sala.
async function conferirImagensDaCamada(sql, camada, itens) {
  const usadas = itens.filter(([c]) => IMAGEM_ITEM.test(c));
  if (!usadas.length) return;
  if (!(await imagensProntas(sql))) throw Object.assign(new Error("Quadros e tapetes aguardam a migração do banco."), { status: 503 });
  const ids = [...new Set(usadas.map(([c]) => c.match(IMAGEM_ITEM)[1]))];
  const linhas = await sql`SELECT id, camada, tipo FROM vybe_escritorio_imagens WHERE id = ANY(${ids}::bigint[])`;
  const por = new Map(linhas.map((l) => [String(l.id), l]));
  for (const [c, x, y, dir] of usadas) {
    const img = por.get(c.match(IMAGEM_ITEM)[1]);
    if (!img || img.camada !== camada) throw Object.assign(new Error("Imagem de outra área ou apagada."), { status: 400 });
    if (img.tipo === "quadro" && !((dir === 4 && y === 0) || (dir === 2 && x === 0)))
      throw Object.assign(new Error("O quadro fica na parede do fundo da sala."), { status: 400 });
  }
}

// Histórico do mapa: a versão anterior de cada camada, as 30 mais recentes.
export async function versoesProntas(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_mapa_versoes') IS NOT NULL AS existe`;
  return Boolean(r?.existe);
}
async function guardarVersaoAnterior(sql, camada, versao) {
  // A camada já está dentro da mesma transação interativa do salvamento.
  await sql`INSERT INTO vybe_escritorio_mapa_versoes(camada, itens, versao, atualizado_por, salvo_em)
    SELECT camada, itens, versao, atualizado_por, atualizado_em FROM vybe_escritorio_mapa WHERE camada = ${camada} AND versao = ${versao}`;
  await sql`DELETE FROM vybe_escritorio_mapa_versoes WHERE camada = ${camada} AND id NOT IN (
    SELECT id FROM vybe_escritorio_mapa_versoes WHERE camada = ${camada} ORDER BY id DESC LIMIT 30)`;
}
export async function versoesDaCamada(sql, pessoa, salas, camada) {
  conferirEdicao(pessoa, salas, camada);
  if (!(await versoesProntas(sql))) throw Object.assign(new Error("O histórico do mapa aguarda a migração do banco."), { status: 503 });
  const linhas = await sql`SELECT v.id, v.versao, v.salvo_em, jsonb_array_length(v.itens) AS itens, p.nome
    FROM vybe_escritorio_mapa_versoes v LEFT JOIN vybe_pessoas p ON p.id = v.atualizado_por
    WHERE v.camada = ${camada} ORDER BY v.id DESC LIMIT 30`;
  return linhas.map((l) => ({ id: String(l.id), versao: l.versao, em: l.salvo_em, itens: Number(l.itens), por: l.nome || "" }));
}
export async function itensDaVersao(sql, pessoa, salas, id) {
  if (!/^\d{1,12}$/.test(String(id || ""))) throw Object.assign(new Error("Versão inválida."), { status: 400 });
  if (!(await versoesProntas(sql))) throw Object.assign(new Error("Versão não encontrada."), { status: 404 });
  const [v] = await sql`SELECT camada, itens FROM vybe_escritorio_mapa_versoes WHERE id = ${id}`;
  if (!v) throw Object.assign(new Error("Versão não encontrada."), { status: 404 });
  conferirEdicao(pessoa, salas, v.camada);
  return { camada: v.camada, itens: v.itens };
}
