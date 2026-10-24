'use strict';
const {limparCampo,prazoLegivel,formatarPreviaDemandas}=require('./previa-demandas');
// Projeção de apresentação, não autorização: o servidor continua validando cada chamada.
const SECOES=Object.freeze({consultar_perfil_jogo:'Perfil do jogo',consultar_perfil_trabalho:'Desempenho da pessoa',consultar_ranking:'Ranking',consultar_dia_equipe:'Dia da equipe',minhas_demandas:'Suas demandas',buscar_demandas:'Demandas encontradas',
 detalhar_demanda:'Demanda consultada',listar_clientes:'Clientes encontrados',listar_responsaveis:'Equipe',
 listar_planejamentos:'Planejamentos encontrados',detalhar_planejamento:'Planejamento consultado',
 listar_captacoes:'Captações encontradas',listar_roteiros:'Roteiros encontrados',
 consultar_metricas_trafego:'Métricas consultadas',cobertura_modulos:'Cobertura da consulta'});
const ferramentaLeitura=nome=>typeof nome==='string'&&Object.hasOwn(SECOES,nome);
const CAMPOS=Object.freeze({disponivel:'Fonte disponível',objective:'Objetivo',dailyBudget:'Orçamento diário',lifetimeBudget:'Orçamento total',spent:'Investimento',clicks:'Cliques',messages:'Conversas',text:'Texto do anúncio',format:'Formato',dimensao:'Dimensão',label:'Público',age:'Idade',gender:'Gênero',platform:'Plataforma',position:'Posicionamento',hour:'Hora',kind:'Tipo de local',context:'Região',radius:'Raio',frequency:'Frequência',curtidas:'Curtidas',comentarios:'Comentários',salvar:'Salvamentos',compartilhar:'Compartilhamentos',respostas:'Respostas',leads:'Leads',profile_visits:'Visitas ao perfil',follows:'Seguidores',purchases:'Compras',link_clicks:'Cliques no link',video_views:'Visualizações',engagement:'Engajamento',classe:'Item',conquistas:'Conquistas',xpTotal:'XP total',xpProximo:'XP até o próximo nível',dateLabel:'Período',contasAlcancadas:'Contas alcançadas',impressoes:'Impressões',naoSeguidoresPct:'Não seguidores (%)',seguidoresPct:'Seguidores (%)',atividadesPerfil:'Atividades do perfil',visitasPerfil:'Visitas ao perfil',linksExternos:'Cliques externos',interacoes:'Interações',crescimento:'Crescimento',seguiram:'Novos seguidores',deixaram:'Deixaram de seguir',faturamento:'Faturamento do cliente',meta:'Meta',influencers:'Influenciadores',midiaOff:'Mídia externa',radio:'Rádio',primary:'Objetivo principal',secondary:'Objetivo secundário',contentTitle:'Conteúdo',comment:'Comentário',name:'Nome do arquivo',mimeType:'Tipo de arquivo',modifiedTime:'Modificado em',size:'Tamanho',observacoes:'Observações',legenda:'Legenda',referencia:'Referência',tema:'Tema',objetivo:'Objetivo',ajuste_cliente:'Ajuste do cliente',nota:'Nota',por:'Por',nome:'Nome',briefing:'Briefing',texto:'Texto',corpo:'Comentário',autor:'Autor',tipo:'Tipo',de:'Anterior',para:'Atual',em:'Quando',criado_em:'Criado em',conclusao:'Conclusão',prioridade:'Prioridade',extensao:'Extensão',tamanho_bytes:'Tamanho em bytes',material_bruto:'Material cadastrado',funcao:'Função',regra:'Contribuição',xp_trabalho:'XP de trabalho',variacao:'Variação percentual',posicao:'Posição',xp:'XP',pontos:'Pontos',total:'Total',ativos:'Dias ativos',diasUteis:'Dias úteis',diasCobertos:'Dias cobertos',media:'Média por dia útil',mediaAtiva:'Média por dia ativo',n:'Quantidade',quantidade:'Quantidade',empates:'Empates',primeiro:'Primeiro registro',inicio:'Início',fim:'Fim',saldo:'Moedas',nivel:'Nível',entregas:'Entregas',com_status:'Com evidência de status',com_prazo:'Com evidência de prazo',no_prazo:'No prazo',com_retorno:'Com retorno',origem:'Origem',quando:'Quando',titulo:'Título',cliente:'Cliente',status:'Situação',estado:'Situação',
 formato:'Formato',mes:'Mês',dia:'Dia',inicio:'Início',fim:'Fim',resumo:'Resumo',
 campaign:'Campanha',date:'Data',reach:'Alcance (sem somar)',impressions:'Impressões',
 amountSpent:'Investimento',linkClicks:'Cliques',results:'Resultados',resultType:'Tipo de resultado',
 costPerResult:'Custo por resultado',cpm:'CPM',cpc:'CPC',messagingConversations:'Conversas'});
function formatarPreviaNatural(resultados){
 if(!Array.isArray(resultados)||resultados.length>3)throw Error('Resultado operacional inválido.');
 if(!resultados.length)return 'Não consultei dados do Vybe OS para confirmar essa resposta. Reformule a pergunta indicando o que deseja consultar.';
 let tamanho=0;
 const blocos=resultados.map(({nome,argumentos={},dados})=>{
  if(!ferramentaLeitura(nome)||dados?.ok!==true||!Array.isArray(dados.itens)||dados.itens.length>25)throw Error('Resultado operacional inválido.');
  if(nome==='minhas_demandas')return formatarPreviaDemandas(dados,argumentos.periodo||'todas',argumentos.situacao||'todas');
  // Nomes operacionais da equipe são autorizados pela política interna.
  const linhas=dados.itens.map((item,i)=>{
   if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Resultado operacional inválido.');
   const campos=[];
   if(nome==='listar_clientes'&&typeof item.nome==='string')campos.push('Cliente: '+limparCampo(item.nome,180));
   const compostos=new Set(['briefing','atual','anterior','recorde','distribuicao','qualidade','contribuicoes','responsaveis','clientes','hoje','ontem','atrasadas','revisoes','editores','pecas','numeros','linhas','datas','revisao','head','cliente','revisao_cliente','revisao_head','telas','reels','publi','stories','outcomes']);
   function detalhes(obj,nivel=0){if(nivel>4)return '';if(Array.isArray(obj))return obj.slice(0,25).map(x=>typeof x==='string'?limparCampo(x,1200):detalhes(x,nivel+1)).filter(Boolean).join('; ');if(!obj||typeof obj!=='object')return '';return Object.entries(obj).map(([k,v])=>{if(v===null||v===undefined)return '';if(compostos.has(k)&&typeof v==='object')return k+': '+detalhes(v,nivel+1);if(!Object.hasOwn(CAMPOS,k))return '';return CAMPOS[k]+': '+(typeof v==='number'&&Number.isFinite(v)?String(v):typeof v==='string'?limparCampo(v,1200):typeof v==='boolean'?(v?'Sim':'Não'):'');}).filter(Boolean).join(' · ');}
   for(const [chave,rotulo] of Object.entries(CAMPOS)){
    const v=item[chave];if(v===null||v===undefined)continue;
    if(compostos.has(chave)&&typeof v==='object'){campos.push(rotulo+': '+detalhes(v));continue;}
    if(typeof v!=='string'&&typeof v!=='boolean'&&!(typeof v==='number'&&Number.isFinite(v)))throw Error('Resultado operacional inválido.');
    campos.push(rotulo+': '+(typeof v==='number'?String(v):typeof v==='boolean'?(v?'Sim':'Não'):limparCampo(v,['resumo','corpo','texto'].includes(chave)?1200:180)));
   }
   for(const k of compostos)if(k!=='briefing'&&item[k]&&typeof item[k]==='object')campos.push(k+': '+detalhes(item[k]));
   if(nome==='buscar_demandas'||nome==='detalhar_demanda'&&(!dados.secao||dados.secao==='ficha')){
    campos.push('Prazo: '+prazoLegivel(item.prazo));
    if(item.status===null||item.status===undefined)campos.push('Situação: Não informada');
   }
   if(nome==='cobertura_modulos')for(const chave of ['disponiveis','limitacoes']){
    if(!Array.isArray(item[chave])||item[chave].length>20)throw Error('Resultado operacional inválido.');
    campos.push((chave==='disponiveis'?'Módulos: ':'Limitações: ')+item[chave].map(x=>limparCampo(x,300)).join('; '));
   }
   return (i+1)+'. '+(campos.join('\n   ')||'Registro autorizado; detalhes não disponíveis nesta prévia.');
  });
  return SECOES[nome]+':\n'+(linhas.join('\n\n')||'Nenhum registro retornado neste recorte.')+
   (dados.limitado===true?'\nEsta lista pode estar incompleta.':'');
 });
 const exibidos=[];
 for(const bloco of blocos){if(tamanho+bloco.length>12000){exibidos.push('Prévia limitada; reduza o recorte para consultar os demais resultados.');break;}exibidos.push(bloco);tamanho+=bloco.length;}
 return 'Consultei os dados autorizados do Vybe OS:\n\n'+exibidos.join('\n\n')+'\n\nCampos ausentes não foram inferidos. Status registrado não comprova publicação.';
}
module.exports={formatarPreviaNatural,ferramentaLeitura};
