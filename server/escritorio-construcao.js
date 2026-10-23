// Conferência consultiva do editor: reutiliza o verificador das cenas.
// Não salva nem concede inventário; permissões e planta vêm do servidor.
import { itensValidos, CENAS_COMUNS, conferirEdicao } from './escritorio-mapa.js';
import { partesDaCamada, perfilDoAndar, plantaQuarto, CELDAS_LIVRES } from './escritorio-quartos.js';

export async function conferirEditorEscritorio(sql, pessoa, salas, { camada, itens, celdas, decoracao } = {}) {
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
    const perfil = {...perfilDoAndar(p?.preferencias, partes.andar)};
    if(decoracao !== undefined){
      if(!decoracao || typeof decoracao!=='object' || Array.isArray(decoracao))throw Object.assign(new Error('Acabamento inválido.'),{status:400});
      if(Object.hasOwn(decoracao,'sala_porta') && !['','baixo','direita'].includes(decoracao.sala_porta))throw Object.assign(new Error('Porta inválida.'),{status:400});
      if(Object.hasOwn(decoracao,'sala_porta'))perfil.sala_porta=decoracao.sala_porta;
      if(Object.hasOwn(decoracao,'sala_sem_paredes'))perfil.sala_sem_paredes=decoracao.sala_sem_paredes===true;
    }
    modelo = plantaQuarto(perfil?.sala_planta, celdas ?? perfil?.sala_celdas);
    if (!modelo) throw Object.assign(new Error('Configure seu quarto antes de conferir.'), {status:400});
    opcoes = { porta: perfil?.sala_porta === 'direita' ? 'direita' : 'baixo', semParedes: perfil?.sala_sem_paredes === true };
  }
  const { conferirConstrucao } = await import('../scripts/escritorio-auditar.mjs');
  const r=conferirConstrucao(camada, limpos.filter(it => !/^vybeimg_/.test(it[0])), modelo, opcoes);
  // Arte remota pode estar visível no navegador, sem folha local no auditor.
  // Indisponibilidade de análise não é erro de decoração nem aprovação do móvel.
  const semArte=r.problemas.filter(t=>t.includes('sem arte no painel'));
  const problemas=r.problemas.filter(t=>!t.includes('sem arte no painel'));
  const avisos=[...r.avisos,...semArte.map(t=>t.replace('sem arte no painel','arte indisponível para análise local'))];
  const detalhes=[...problemas.map(m=>({mensagem:m,tipo:'problema'})),...avisos.map(m=>({mensagem:m,tipo:'aviso'}))].map(d=>({...d,indices:limpos.flatMap((it,i)=>d.mensagem.includes(it[0])?[i]:[])}));
  return {problemas,avisos,detalhes};
}
