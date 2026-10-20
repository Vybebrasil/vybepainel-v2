import { QUARTOS, configurarQuarto, perfilDoAndar, plantaQuarto, LADO_QUARTO, CELDAS_LIVRES, ampliarGrade, ampliarParedes, ampliarCeldas } from "./escritorio-quartos.js";
import { carregarEconomia, comprarMovel, perfilPublico } from "./escritorio-economia.js";
import { missoesDaPessoa } from "./escritorio-pontos.js";
import { cobrancasDaPessoa } from "./escritorio-cobrancas.js";
import { prepararChamadaEscritorio } from "./escritorio-chamadas.js";
import { listarPostits, colarPostit, apagarPostit, darPresente, listarTrocas, proporTroca, responderTroca } from "./escritorio-social.js";
import { dimensoesDosMoveis, salasDoEscritorio, carregarMapaEscritorio, salvarCamadaEscritorio, arteRemotaEscritorio, bonecoEscritorio, enviarImagemEscritorio, imagemEscritorio, apagarImagemEscritorio, versoesDaCamada, itensDaVersao } from "./escritorio-mapa.js";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const SALAS_ESCRITORIO = [
  "convivencia",
  "criacao",
  "atendimento",
  "producao",
  "reuniao",
  "foco",
];
// Zonas de conversa do mapa: cada sala individual e cada espaço tem a sua.
export const ZONAS_ESCRITORIO = [
  ...Array.from({ length: 9 }, (_, i) => ["sala-" + i,"sala-" + i+"-andar-1"]).flat(),
  "auditorio", "reuniao", "recepcao", "cafe", "academia", "foco", "jogos", "producao", "lounge", "operacao",
];
export const CORES_ESCRITORIO = [
  "laranja",
  "azul",
  "verde",
  "roxo",
  "rosa",
  "grafite",
];
export const PISOS_SALA_ESCRITORIO = ["", "madeira", "clara", "concreto", "carpete", "preto", "cafe", "verde", "deck", "lareira", "cinema", "pista", "marmore", "gramado", "nogueira", "vinho"];
export const PAREDES_SALA_ESCRITORIO = ["", "#ff8a35", "#ffb347", "#ffd166", "#ff6fa8", "#e05a5a", "#b48cff", "#7c6cff", "#5aa9ff", "#5ad1e6", "#7ee08a", "#3fb68b", "#e8e8ee", "#8a8f9c"];
// Luz ambiente do quarto (como o regulador de luz do Habbo): só nomes conhecidos.
export const LUZES_SALA_ESCRITORIO = ["", "quente", "fria", "rosa", "roxa", "verde", "noite"];
export function perfilEscritorio(valor = {}) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) valor = {};
  const opcao = (campo, lista, padrao) =>
    lista.includes(valor[campo]) ? valor[campo] : padrao;
  const coordenada = (campo, padrao) =>
    Number.isFinite(Number(valor[campo]))
      ? Math.min(94, Math.max(6, Number(valor[campo])))
      : padrao;
  // Amplia pinturas legadas (8×8 e 12×12) para o lado atual do quarto sem
  // apagar as escolhas já salvas.
  const piso = String(valor.sala_pisos || "");
  const paredes = String(valor.sala_paredes || "");
  const pisoAtual = /^[0-9a-f]{64}$/.test(piso) ? ampliarGrade(piso, 8, "0") : /^[0-9a-f]{144}$/.test(piso) ? ampliarGrade(piso, 12, "0") : piso;
  const paredesAtuais = /^([a-h-][0-9a-d][0-2])+$/.test(paredes) ? ampliarParedes(paredes) : paredes;
  const celdas = ampliarCeldas(valor.sala_celdas);
  return {
    sala_planta: opcao("sala_planta", QUARTOS.plantas.map(p => p.id), "quadrado-m"),
    quarto_configurado: valor.quarto_configurado === true,
    sala_andares: Array.isArray(valor.sala_andares) ? valor.sala_andares.filter(a=>a?.andar===1).slice(0,1).map(a=>{
      const limpo=perfilEscritorio(Object.fromEntries(Object.entries(a).filter(([k])=>['sala_planta','sala_piso','sala_parede','sala_pisos','sala_paredes','sala_luz','sala_celdas','sala_porta','sala_sem_paredes','sala_espessura_parede','sala_espessura_piso','sala_altura_parede','quarto_configurado'].includes(k))));
      return {andar:1,...Object.fromEntries(Object.entries(limpo).filter(([k])=>k.startsWith('sala_') && k!=='sala_andares' || k==='quarto_configurado'))};
    }) : [],
    roupa: opcao("roupa", CORES_ESCRITORIO, "laranja"),
    pele: opcao("pele", ["clara", "media", "escura"], "media"),
    cabelo: opcao("cabelo", ["curto", "longo", "cacheado", "sem"], "curto"),
    mesa: opcao("mesa", CORES_ESCRITORIO, "grafite"),
    objeto: opcao("objeto", ["planta", "livros", "luminaria"], "planta"),
    sala: opcao("sala", SALAS_ESCRITORIO, "convivencia"),
    x: coordenada("x", 50),
    y: coordenada("y", 70),
    // Boneco do Habbo montado no criador: partes "tipo-conjunto-cor" separadas
    // por ponto. Só esse formato passa; vai para uma URL de imagem.
    figura: /^[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}(\.[a-z]{2}-\d{1,5}(-\d{1,5}){0,2}){0,15}$/.test(String(valor.figura || ""))
      ? String(valor.figura)
      : "",
    // Objeto na mão escolhido no criador (Paulo, 20/10/2026), como os agentes
    // dos clientes: só o formato de carregar do Habbo ("crr=6").
    mao: /^crr=\d{1,3}$/.test(String(valor.mao || "")) ? String(valor.mao) : "",
    // Piso e cor das paredes da própria sala (só valores conhecidos).
    sala_piso: opcao("sala_piso", PISOS_SALA_ESCRITORIO, ""),
    sala_parede: opcao("sala_parede", PAREDES_SALA_ESCRITORIO, ""),
    sala_luz: opcao("sala_luz", LUZES_SALA_ESCRITORIO, ""),
    // Lado da porta do quarto, escolhido pelo dono (vazio: o padrão da sala).
    sala_porta: opcao("sala_porta", ["", "baixo", "direita"], ""),
    // Quarto "maquete": sem as paredes do quarto (o dono constrói as suas).
    sala_sem_paredes: valor.sala_sem_paredes === true,
    // Opções do quarto do Habbo (RoomSettings): espessura da parede e do piso
    // (−2 a 1; vale 2 elevado a isso) e altura fixa da parede (0 a 15 blocos
    // a mais; vazio = a altura padrão).
    sala_espessura_parede: [-2, -1, 0, 1].includes(Number(valor.sala_espessura_parede)) && valor.sala_espessura_parede !== "" && valor.sala_espessura_parede != null ? Number(valor.sala_espessura_parede) : 0,
    sala_espessura_piso: [-2, -1, 0, 1].includes(Number(valor.sala_espessura_piso)) && valor.sala_espessura_piso !== "" && valor.sala_espessura_piso != null ? Number(valor.sala_espessura_piso) : 0,
    sala_altura_parede: Number.isInteger(Number(valor.sala_altura_parede)) && Number(valor.sala_altura_parede) >= 0 && Number(valor.sala_altura_parede) <= 15 && valor.sala_altura_parede !== "" && valor.sala_altura_parede != null ? Number(valor.sala_altura_parede) : -1,
    // Planta desenhada pelo dono (ver plantaQuarto); muda só ao salvar a decoração.
    sala_celdas: CELDAS_LIVRES.test(celdas) ? celdas : "",
    // Piso pintado ladrilho a ladrilho (LADO_QUARTO², um código por ladrilho; 0 =
    // o piso da sala) e cada trecho das duas paredes altas (estilo + cor).
    sala_pisos: new RegExp(`^[0-9a-f]{${LADO_QUARTO * LADO_QUARTO}}$`).test(pisoAtual) ? pisoAtual : "",
    // LADO_QUARTO trechos por lado (fundo, esquerda, frente, direita), cada um com
    // estilo, cor e altura (0 baixa, 1 média, 2 alta).
    sala_paredes: new RegExp(`^([a-h-][0-9a-d][0-2]){${LADO_QUARTO * 4}}$`).test(paredesAtuais) ? paredesAtuais : "",
    // Versão da abertura que a pessoa já viu (data). Vazio: ainda não viu.
    abertura: /^\d{4}-\d{2}-\d{2}$/.test(String(valor.abertura || "")) ? String(valor.abertura) : "",
  };
}
export function assinarEntradaEscritorio(
  pessoa,
  perfil,
  segredo,
  agora = Date.now(),
  minhaSala = "",
) {
  if (!segredo || segredo.length < 32)
    throw new Error(
      "Configure ESCRITORIO_SESSION_SECRET com pelo menos 32 caracteres.",
    );
  const claims = {
    sub: String(pessoa.id),
    nome: pessoa.nome,
    admin: Boolean(pessoa.admin),
    perfil: perfilEscritorio(perfil),
    // Sala individual da pessoa (decidida aqui): só ela e quem administra a trancam.
    minhaSala: /^sala-([0-9]|1[01])$/.test(String(minhaSala)) ? String(minhaSala) : "",
    aud: "vybe-escritorio",
    iat: Math.floor(agora / 1000),
    exp: Math.floor(agora / 1000) + 300,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return (
    body + "." + createHmac("sha256", segredo).update(body).digest("base64url")
  );
}
export async function escritorioPronto(sql) {
  const [r] =
    await sql`SELECT (to_regclass('public.vybe_escritorio_perfis') IS NOT NULL AND to_regclass('public.vybe_escritorio_mensagens') IS NOT NULL AND to_regclass('public.vybe_escritorio_salas') IS NOT NULL) AS existe`;
  return Boolean(r?.existe);
}
export async function carregarEscritorio(sql, pessoa) {
  const equipe =
    await sql`SELECT p.id,p.nome,COALESCE(e.preferencias,'{}'::jsonb) AS preferencias
    FROM vybe_pessoas p LEFT JOIN vybe_escritorio_perfis e ON e.pessoa_id=p.id
    WHERE p.ativo=TRUE AND p.pode_entrar=TRUE ORDER BY p.nome`;
  const lista = equipe.map((p) => ({
    id: String(p.id),
    nome: p.nome,
    perfil: perfilEscritorio(p.preferencias),
  }));
  return {
    quartos: QUARTOS,
    // A loja (faixas, estoque e vitrine) chega quando o editor abre; a entrada fica leve.
    economia: await carregarEconomia(sql, pessoa.id, { loja: false }),
    eu: String(pessoa.id),
    admin: Boolean(pessoa.admin),
    equipe: lista,
    // Dono de cada sala individual e o mapa salvo (camadas editadas).
    salas: salasDoEscritorio(lista),
    mapa: await carregarMapaEscritorio(sql),
  };
}
// "buscarSala" só é chamada se a porta mudar: devolve a sala da pessoa, para
// conferir que nenhum móvel ficou no vão da porta nova.
export async function salvarPerfilEscritorio(sql, pessoaId, valor, buscarSala = null) {
  return sql.comTransacao(async tx => {
    await tx`INSERT INTO vybe_escritorio_perfis(pessoa_id) VALUES(${pessoaId}) ON CONFLICT DO NOTHING`;
    const [atual] = await tx`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${pessoaId} FOR UPDATE`;
    let perfil = perfilEscritorio({...valor, sala_planta:atual.preferencias.sala_planta, sala_celdas:atual.preferencias.sala_celdas, quarto_configurado:atual.preferencias.quarto_configurado,sala_andares:atual.preferencias.sala_andares});
    if(valor.andar===1) {
      const andar=perfilDoAndar(atual.preferencias,1);
      if(!andar?.quarto_configurado) throw Object.assign(new Error('Configure esse andar antes de pintar.'),{status:409});
      const pintura=perfilEscritorio(valor);
      perfil={...atual.preferencias,sala_andares:[{...andar,...Object.fromEntries(['sala_piso','sala_parede','sala_pisos','sala_paredes','sala_luz','sala_porta','sala_sem_paredes','sala_espessura_parede','sala_espessura_piso','sala_altura_parede'].map(k=>[k,pintura[k]]))}]};
    }
    const andarNovo=perfilDoAndar(perfil,valor.andar===1 ? 1 : 0), andarAntes=perfilDoAndar(atual.preferencias,valor.andar===1 ? 1 : 0);
    if((andarNovo?.sala_porta || '')!==(andarAntes?.sala_porta || '') && andarNovo?.sala_porta) {
      const sala=buscarSala ? await buscarSala() : '';
      if(!sala) throw Object.assign(new Error('Abra o seu quarto para mudar a porta.'),{status:409});
      const camada=valor.andar===1 ? sala+'-andar-1' : sala;
      const [m]=await tx`SELECT itens FROM vybe_escritorio_mapa WHERE camada=${camada}`;
      const p=plantaQuarto(andarNovo.sala_planta,andarNovo.sala_celdas), h=p?.celdas.length, w=p?.celdas[0].length;
      const vao=andarNovo.sala_porta==='direita' ? [[w-1,p.portas.direita],[w-1,p.portas.direita+1]] : [[p.portas.baixo,h-1],[p.portas.baixo+1,h-1]];
      const itens=(m?.itens || []).filter(it=>!/^vybeimg_/.test(it[0]));
      const dims=await dimensoesDosMoveis(itens);
      const cobre=itens.some(it=>{const d=dims.get(it[0]) || {x:1,y:1},gira=it[3]===2||it[3]===6,dw=gira?d.y:d.x,dh=gira?d.x:d.y;
        return (d.z ?? 1)>0.05 && vao.some(([x,y])=>x>=Math.floor(it[1]) && x<Math.floor(it[1])+dw && y>=Math.floor(it[2]) && y<Math.floor(it[2])+dh);});
      if(cobre) throw Object.assign(new Error('Tire os móveis do lugar da porta nova antes de mudar.'),{status:409});
    }
    await tx`UPDATE vybe_escritorio_perfis SET preferencias=${JSON.stringify(perfil)}::jsonb,atualizado_em=NOW() WHERE pessoa_id=${pessoaId}`;
    return perfil;
  });
}
export async function mensagensEscritorio(sql, sala) {
  if (!SALAS_ESCRITORIO.includes(sala)) throw new Error("Sala inválida.");
  const rows =
    await sql`SELECT m.id,m.pessoa_id,p.nome,m.texto,m.criado_em FROM vybe_escritorio_mensagens m
    JOIN vybe_pessoas p ON p.id=m.pessoa_id WHERE m.sala=${sala} ORDER BY m.id DESC LIMIT 60`;
  return rows
    .reverse()
    .map((r) => ({ ...r, id: String(r.id), pessoa_id: String(r.pessoa_id) }));
}
export async function enviarMensagemEscritorio(
  sql,
  pessoaId,
  { sala, texto, chave },
) {
  if (!SALAS_ESCRITORIO.includes(sala)) throw new Error("Sala inválida.");
  if (typeof texto !== "string" || !texto.trim() || texto.length > 2000)
    throw new Error("Escreva uma mensagem de até 2.000 caracteres.");
  if (typeof chave !== "string" || !/^[a-f0-9-]{36}$/i.test(chave))
    throw new Error("Identificador de mensagem inválido.");
  const [r] =
    await sql`INSERT INTO vybe_escritorio_mensagens(pessoa_id,sala,texto,chave) VALUES(${pessoaId},${sala},${texto.trim()},${chave})
    ON CONFLICT(pessoa_id,chave) DO UPDATE SET chave=EXCLUDED.chave RETURNING id`;
  return String(r.id);
}
// Recados individuais: só quem enviou e quem recebeu leem a conversa. Sem a
// tabela (migração ainda não aplicada), a área avisa em vez de quebrar.
async function recadosProntos(sql) {
  const [r] = await sql`SELECT to_regclass('public.vybe_escritorio_recados') IS NOT NULL AS existe`;
  if (!r?.existe) throw Object.assign(new Error("Os recados aguardam a migração revisada do banco."), { status: 503 });
}
const idPessoa = (v) => {
  const s = String(v ?? "");
  if (!/^\d{1,18}$/.test(s)) throw Object.assign(new Error("Pessoa inválida."), { status: 400 });
  return s;
};
export async function resumoRecadosEscritorio(sql, pessoaId) {
  await recadosProntos(sql);
  const rows = await sql`SELECT de_id, COUNT(*)::int AS nao_lidos, MAX(criado_em) AS ultimo
    FROM vybe_escritorio_recados WHERE para_id = ${pessoaId} AND lido_em IS NULL GROUP BY de_id`;
  return rows.map((r) => ({ de: String(r.de_id), nao_lidos: r.nao_lidos, ultimo: r.ultimo }));
}
export async function conversaRecadosEscritorio(sql, pessoaId, com) {
  await recadosProntos(sql);
  const outro = idPessoa(com);
  const rows = await sql`SELECT id, de_id, para_id, texto, criado_em, lido_em FROM vybe_escritorio_recados
    WHERE (de_id = ${pessoaId} AND para_id = ${outro}) OR (de_id = ${outro} AND para_id = ${pessoaId})
    ORDER BY id DESC LIMIT 60`;
  return rows.reverse().map((r) => ({ id: String(r.id), de: String(r.de_id), para: String(r.para_id), texto: r.texto, criado_em: r.criado_em, lido_em: r.lido_em }));
}
export async function enviarRecadoEscritorio(sql, pessoaId, { para, texto, chave }) {
  await recadosProntos(sql);
  const destino = idPessoa(para);
  if (destino === String(pessoaId)) throw Object.assign(new Error("Escolha outra pessoa."), { status: 400 });
  if (typeof texto !== "string" || !texto.trim() || texto.length > 2000)
    throw Object.assign(new Error("Escreva um recado de até 2.000 caracteres."), { status: 400 });
  if (typeof chave !== "string" || !/^[a-f0-9-]{36}$/i.test(chave))
    throw Object.assign(new Error("Identificador de recado inválido."), { status: 400 });
  const [existe] = await sql`SELECT 1 AS ok FROM vybe_pessoas WHERE id = ${destino} AND ativo = TRUE AND pode_entrar = TRUE`;
  if (!existe) throw Object.assign(new Error("Pessoa não encontrada."), { status: 404 });
  const [r] = await sql`INSERT INTO vybe_escritorio_recados(de_id, para_id, texto, chave)
    VALUES (${pessoaId}, ${destino}, ${texto.trim()}, ${chave})
    ON CONFLICT (de_id, chave) DO UPDATE SET chave = EXCLUDED.chave RETURNING id`;
  return String(r.id);
}
export async function lerRecadosEscritorio(sql, pessoaId, com) {
  await recadosProntos(sql);
  const outro = idPessoa(com);
  await sql`UPDATE vybe_escritorio_recados SET lido_em = NOW()
    WHERE para_id = ${pessoaId} AND de_id = ${outro} AND lido_em IS NULL`;
}
export const PASTA_ARTE_ESCRITORIO = join(process.cwd(), "assets", "escritorio", "habbo");
export async function enviarArteEscritorio(res, arquivo) {
  const m = /^([a-z0-9_]+)\.(png|json)$/.exec(arquivo);
  if (!m) return res.status(400).json({ error: "Arquivo inválido." });
  let dados;
  try {
    dados = await readFile(join(PASTA_ARTE_ESCRITORIO, arquivo));
  } catch {
    // Fora dos móveis do painel: vem do catálogo do Habbo (editor do mapa).
    try {
      dados = await arteRemotaEscritorio(m[1], m[2]);
    } catch (e) {
      return res.status(e.status || 502).json({ error: e.message });
    }
  }
  res.setHeader("Content-Type", m[2] === "png" ? "image/png" : "application/json; charset=utf-8");
  // O endereço muda quando o arquivo muda (?v=hash); cache só no navegador.
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  return res.status(200).send(dados);
}
export async function areaEscritorio(req, res, quem, sql) {
  if (quem.tipo !== "sessao")
    return res.status(403).json({
      error: "Entre com sua conta individual para usar o escritório.",
    });
  if (!["GET", "POST"].includes(req.method))
    return res.status(405).json({ error: "Método não permitido." });
  // Arte do mapa (Habbo, uso interno): só sai para quem está logado, nunca
  // como arquivo público do site. O nome é validado; nada fora da pasta.
  if (req.method === "GET" && req.query?.acao === "arte")
    return enviarArteEscritorio(res, String(req.query.arquivo || ""));
  if (req.method === "GET" && req.query?.acao === "boneco") {
    try {
      const png = await bonecoEscritorio(sql, String(req.query.figura || ""), req.query.dir);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, max-age=86400");
      return res.status(200).send(png);
    } catch (e) {
      return res.status(e.status || 502).json({ error: e.message });
    }
  }
  // Imagem da equipe (quadro/tapete): só para quem está logado; o id não
  // muda de conteúdo, então o navegador guarda.
  if (req.method === "GET" && req.query?.acao === "imagem") {
    try {
      const img = await imagemEscritorio(sql, String(req.query.id || ""));
      res.setHeader("Content-Type", img.mime);
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(img.dados);
    } catch (e) {
      return res.status(e.status || 502).json({ error: e.message });
    }
  }
  if (!(await escritorioPronto(sql)))
    return res.status(503).json({
      error: "O escritório aguarda a migração revisada do banco.",
      code: "escritorio_setup",
    });
  const pessoa = quem.pessoa;
  const acao = req.query?.acao || req.body?.acao || "entrada";
  if (req.method === "GET") {
    if (acao === "economia") {
      // Quem administra pode ver os marcos de outra pessoa (a ficha dela); a loja é só a própria.
      const outra = req.query?.pessoa && String(req.query.pessoa) !== String(pessoa.id) ? String(req.query.pessoa) : null;
      if (outra && !pessoa.admin) return res.status(403).json({ error: "Só quem administra vê a ficha de outra pessoa." });
      if (outra && !/^\d+$/.test(outra)) return res.status(400).json({ error: "Pessoa inválida." });
      return res.status(200).json({ok:true,economia:await carregarEconomia(sql,outra ? Number(outra) : pessoa.id,{loja:!outra})});
    }
    // Perfil do jogo aberto a toda a equipe (decisão do Paulo, 19/10/2026;
    // sem ranking comparativo): moedas, nível, marcos e móveis. Desempenho no
    // trabalho continua na rota "economia", restrita.
    if (acao === "perfil-publico") {
      const alvo = String(req.query?.pessoa || pessoa.id);
      if (!/^\d+$/.test(alvo)) return res.status(400).json({ error: "Pessoa inválida." });
      return res.status(200).json({ ok: true, perfil: await perfilPublico(sql, Number(alvo)) });
    }
    if (acao === "trocas") return res.status(200).json({ ok: true, trocas: await listarTrocas(sql, pessoa) });
    if (acao === "missoes") return res.status(200).json({ ok: true, ...(await missoesDaPessoa(sql, pessoa.id)) });
    // Clientes cobrando no quarto de alguém: todos que estão no quarto veem
    // (decisão do Paulo, 19/10/2026); a equipe já vê todas as demandas.
    if (acao === "cobrancas") {
      const alvo = String(req.query?.pessoa || pessoa.id);
      if (!/^\d+$/.test(alvo)) return res.status(400).json({ error: "Pessoa inválida." });
      return res.status(200).json({ ok: true, cobrancas: await cobrancasDaPessoa(sql, Number(alvo)) });
    }
    if (acao === "recados" || acao === "recados-resumo")
      try {
        return res.status(200).json(acao === "recados"
          ? { ok: true, recados: await conversaRecadosEscritorio(sql, String(pessoa.id), req.query.com) }
          : { ok: true, resumo: await resumoRecadosEscritorio(sql, String(pessoa.id)) });
      } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
    if (acao === "mapa-versoes" || acao === "mapa-versao")
      try {
        const { salas } = await carregarEscritorio(sql, pessoa);
        return res.status(200).json(acao === "mapa-versoes"
          ? { ok: true, versoes: await versoesDaCamada(sql, pessoa, salas, String(req.query.camada || "")) }
          : { ok: true, ...(await itensDaVersao(sql, pessoa, salas, String(req.query.id || ""))) });
      } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
    if (acao === "postits")
      try {
        return res.status(200).json({ ok: true, postits: await listarPostits(sql, String(req.query.camada || "")) });
      } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
    if (acao === "mensagens")
      return res.status(200).json({
        ok: true,
        mensagens: await mensagensEscritorio(sql, String(req.query.sala || "")),
      });
    const base = await carregarEscritorio(sql, pessoa);
    const perfil =
      base.equipe.find((p) => p.id === base.eu)?.perfil || perfilEscritorio();
    const worker = String(process.env.ESCRITORIO_WORKER_URL || "");
    const configurado =
      /^https:\/\/[a-z0-9.-]+(?:\/)?$/i.test(worker) &&
      Boolean(process.env.ESCRITORIO_SESSION_SECRET?.length >= 32);
    return res.status(200).json({
      ok: true,
      ...base,
      worker: configurado ? worker : null,
      token: configurado
        ? assinarEntradaEscritorio(
            pessoa,
            perfil,
            process.env.ESCRITORIO_SESSION_SECRET,
            Date.now(),
            base.salas.find((x) => x.pessoa_id === String(pessoa.id))?.id || "",
          )
        : null,
      aviso: configurado
        ? null
        : "A conexão em tempo real ainda não foi configurada.",
    });
  }
  // Identidade vem exclusivamente da sessão; o corpo nunca escolhe pessoa/admin.
  if (acao === "chamada")
    try {
      return res.status(200).json({
        ok: true,
        ...(await prepararChamadaEscritorio(
          sql,
          pessoa,
          String(req.body?.sala || ""),
        )),
      });
    } catch (e) {
      // Sala inválida é 400; RealtimeKit sem configuração ou fora do ar
      // responde com o status e o código do erro (o painel mostra o motivo).
      return res.status(e.status || 400).json({ error: e.message, ...(e.code ? { code: e.code } : {}) });
    }
  if (acao === "quarto" || acao === "comprar") {
    try {
      const resultado = acao === "comprar" ? {economia: await comprarMovel(sql, pessoa.id, req.body)}
        : await configurarQuarto(sql, pessoa, perfilEscritorio(req.body?.perfil), req.body);
      return res.status(200).json({ok:true,...resultado});
    } catch(e) { return res.status(e.status || 400).json({error:e.message}); }
  }
  if (acao === "perfil")
    try {
      return res.status(200).json({
        ok: true,
        perfil: await salvarPerfilEscritorio(sql, pessoa.id, req.body?.perfil, async () => (await carregarEscritorio(sql, pessoa)).salas.find((s) => s.pessoa_id === String(pessoa.id))?.id || ""),
      });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  if (acao === "construcao-conferir") {
    try {
      const { salas } = await carregarEscritorio(sql, pessoa);
      const { conferirEditorEscritorio } = await import('./escritorio-construcao.js');
      return res.status(200).json({ ok: true, ...(await conferirEditorEscritorio(sql, pessoa, salas, req.body)) });
    } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  }
  if (acao === "mapa") {
    const { salas } = await carregarEscritorio(sql, pessoa);
    try {
      return res.status(200).json({ ok: true, ...(await salvarCamadaEscritorio(sql, pessoa, salas, req.body || {})) });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }
  if (acao === "imagem" || acao === "imagem-apagar") {
    const { salas } = await carregarEscritorio(sql, pessoa);
    try {
      return res.status(200).json({ ok: true, imagem: acao === "imagem"
        ? await enviarImagemEscritorio(sql, pessoa, salas, req.body || {})
        : await apagarImagemEscritorio(sql, pessoa, salas, req.body || {}) });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }
  if (acao === "recado" || acao === "recados-lidos")
    try {
      if (acao === "recado")
        return res.status(200).json({ ok: true, id: await enviarRecadoEscritorio(sql, String(pessoa.id), req.body || {}) });
      await lerRecadosEscritorio(sql, String(pessoa.id), req.body?.com);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  if (acao === "troca" || acao === "troca-responder") {
    try {
      const { salas } = await carregarEscritorio(sql, pessoa);
      const r = acao === "troca" ? await proporTroca(sql, pessoa, salas, req.body || {}) : await responderTroca(sql, pessoa, salas, req.body || {});
      return res.status(200).json({ ok: true, ...r, trocas: await listarTrocas(sql, pessoa) });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }
  if (acao === "postit" || acao === "postit-apagar" || acao === "presente") {
    try {
      if (acao === "postit") return res.status(200).json({ ok: true, id: await colarPostit(sql, pessoa, req.body || {}) });
      const { salas } = await carregarEscritorio(sql, pessoa);
      if (acao === "postit-apagar") return res.status(200).json({ ok: true, camada: await apagarPostit(sql, pessoa, salas, String(req.body?.id || "")) });
      return res.status(200).json({ ok: true, ...(await darPresente(sql, pessoa, salas, req.body || {})) });
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }
  if (acao === "mensagem")
    return res.status(200).json({
      ok: true,
      id: await enviarMensagemEscritorio(sql, pessoa.id, req.body || {}),
    });
  return res.status(400).json({ error: "Ação inválida." });
}
