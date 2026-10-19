// Conferência consultiva do editor: reutiliza o verificador das cenas.
// Não salva nem concede inventário; permissões e planta vêm do servidor.
import { itensValidos, CENAS_COMUNS, conferirEdicao } from './escritorio-mapa.js';
import { partesDaCamada, perfilDoAndar, plantaQuarto, CELDAS_LIVRES } from './escritorio-quartos.js';

export async function conferirEditorEscritorio(sql, pessoa, salas, { camada, itens, celdas } = {}) {
  const comum = camada === 'geral' || CENAS_COMUNS.has(camada);
  const partes = partesDaCamada(camada);
  const sala = salas.find(s => s.id === partes?.raiz);
  conferirEdicao(pessoa, salas, camada);
  const limpos = itensValidos(camada, itens);
  if (celdas !== undefined && (comum || !CELDAS_LIVRES.test(String(celdas))))
    throw Object.assign(new Error('Planta do quarto inválida.'), {status:400});
  let modelo = null, opcoes = {};
  if (!comum) {
    const [p] = await sql`SELECT preferencias FROM vybe_escritorio_perfis WHERE pessoa_id=${sala.pessoa_id}`;
    const perfil = perfilDoAndar(p?.preferencias, partes.andar);
    modelo = plantaQuarto(perfil?.sala_planta, celdas ?? perfil?.sala_celdas);
    if (!modelo) throw Object.assign(new Error('Configure seu quarto antes de conferir.'), {status:400});
    opcoes = { porta: perfil?.sala_porta === 'direita' ? 'direita' : 'baixo', semParedes: perfil?.sala_sem_paredes === true };
  }
  const { conferirConstrucao } = await import('../scripts/escritorio-auditar.mjs');
  return conferirConstrucao(camada, limpos.filter(it => !/^vybeimg_/.test(it[0])), modelo, opcoes);
}
