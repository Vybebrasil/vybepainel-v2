// api/conteudos.js — a lista de conteúdos vinda das tabelas de domínio.
//
// Alternativa ao /api/operational-mirror, que hoje devolve 3,35 MB: a resposta do
// Monday inteira, com os column_values crus e os updates de cada item, para o
// navegador transformar em objetos depois. Aqui o recorte e a transformação já
// vêm prontos do banco.
//
// A regra de recorte é a mesma que o processItems aplica hoje no navegador —
// precisa de pelo menos um cliente ativo e de pelo menos uma das duas datas. A
// diferença é onde ela mora: em vybe_clientes.ativo em vez de uma constante no
// vybe-config.js.
//
// Exige sessão do painel ou a chave de serviço. Era leitura pública, como o
// /api/operational-mirror ainda era — a operação inteira saía por uma URL.

import { listarConteudos, idsNoRecorte, catalogosDoQuadro,
  BOARD_PRODUCAO, BOARD_DEMANDAS } from '../vybe_dominio_store.js';
import { bloqueou } from '../vybe_acesso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'null');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (await bloqueou(req, res)) return;

  try {
    const inicio = Date.now();
    // Sem parâmetro, Produção — é o que todo mundo já chama.
    const alvo = String(req.query?.board || '') === 'demandas' ? BOARD_DEMANDAS : BOARD_PRODUCAO;
    // Reler o catálogo depois de renomear uma etiqueta baixava o quadro inteiro,
    // duas vezes — 1,2 MB para conferir dezoito rótulos. Agora tem porta própria.
    if (String(req.query?.apenas || '') === 'catalogos') {
      const c = await catalogosDoQuadro(alvo);
      return res.status(200).json({ ok: true, board_id: alvo, ...c, ms: Date.now() - inicio });
    }

    const desde = validaDesde(req.query?.desde);
    if (desde === false) return res.status(400).json({ error: 'Parâmetro "desde" precisa ser uma data ISO.' });

    // ── leitura inteira: o primeiro carregamento, e o refúgio de qualquer dúvida ──
    if (!desde) {
      const d = await listarConteudos(alvo);
      return res.status(200).json({ ok: true, incremental: false, ...d,
        total: d.itens.length, ms: Date.now() - inicio });
    }

    // ── leitura incremental ──────────────────────────────────────────────────
    // Primeiro sem catálogo: na esmagadora maioria das vezes nada entrou nem
    // saiu do recorte, e aí esta única consulta é a resposta inteira — algumas
    // centenas de bytes no lugar de 604 KB.
    const parcial = await listarConteudos(alvo, { desde, catalogos: false });
    const mesmoConjunto = String(req.query?.assinatura || '') === parcial.assinatura;
    if (mesmoConjunto) {
      return res.status(200).json({ ok: true, incremental: true,
        board_id: parcial.board_id, gerado_em: parcial.gerado_em,
        assinatura: parcial.assinatura, total_no_recorte: parcial.total_no_recorte,
        mudou: parcial.itens.length > 0, itens: parcial.itens, ms: Date.now() - inicio });
    }

    // O conjunto mudou: alguma peça nasceu, foi apagada, ou entrou/saiu do
    // recorte. É a única hora em que a lista de ids precisa viajar — e é a hora
    // de mandar os catálogos junto, porque etiqueta nova costuma vir no mesmo
    // movimento. São umas poucas vezes por dia, não quatro por minuto.
    const [catalogos, ids] = await Promise.all([catalogosDoQuadro(alvo), idsNoRecorte(alvo)]);
    return res.status(200).json({ ok: true, incremental: true, mudou: true,
      board_id: parcial.board_id, gerado_em: parcial.gerado_em,
      assinatura: parcial.assinatura, total_no_recorte: parcial.total_no_recorte,
      itens: parcial.itens, ids,
      status: catalogos.status, captacao: catalogos.captacao,
      opcoes: catalogos.opcoes, pessoas: catalogos.pessoas,
      ...(catalogos.degradado?.length ? { degradado: catalogos.degradado } : {}),
      ms: Date.now() - inicio });
  } catch (erro) {
    // O erro ia inteiro para o navegador e NADA para o registro: quando esta
    // leitura devolveu 500 em producao, o log tinha o 500 e nenhuma pista do
    // motivo. Quem investiga depois nao tem o navegador de quem viu.
    console.error('Leitura de conteúdos falhou:', erro?.stack || erro?.message || erro);
    return res.status(500).json({ error: erro.message });
  }
}

// Data no futuro ou texto sem sentido faria a leitura devolver uma lista vazia e
// a tela concluir que nada mudou — para sempre. Melhor recusar na porta.
function validaDesde(bruto) {
  const texto = String(bruto || '').trim();
  if (!texto) return null;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return false;
  return data.toISOString();
}

