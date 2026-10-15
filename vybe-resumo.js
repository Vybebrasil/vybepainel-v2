// Mensagens determinísticas para revisão e cópia manual por grupo do WhatsApp.
// Usa somente os dados carregados no painel; não envia mensagens nem chama IA.
function resumoTexto(v) { return String(v ?? '').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim(); }

function resumoDiaCurto(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function resumoDiasAntes(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "Jady Amynne Oliveira Lima, Vinícius Damascena" vira "Jady, Vinícius": no
// grupo todo mundo se conhece pelo primeiro nome, e a linha cabe no celular.
function resumoPessoas(responsavel) {
  const nomes = resumoTexto(responsavel).split(',').map((n) => n.trim().split(' ')[0]).filter(Boolean);
  return nomes.length ? nomes.join(', ') : 'sem responsável';
}

function resumosPorGrupo(itens, dia, { statusDe, clientesDe, equipe = [], baseAnterior = null, alertaBase = '', geradoEm = '' }) {
  const normal = v => resumoTexto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const status = i => normal(statusDe(i));
  const pedido = i => i.origem === 'solicitacao';
  const veic = i => i.veiculacao_iso || '';
  const data = i => pedido(i) ? (i.conclusao_iso || i.prazo_iso || '') : veic(i);
  const finalizado = i => !pedido(i) && status(i)==='finalizado';
  const publicado = i => !pedido(i) && ['publicado','postado'].includes(status(i));
  const agendado = i => !pedido(i) && status(i)==='agendado';
  const pronto = i => !pedido(i) && status(i)==='para agendar';
  const encerrado = i => pedido(i) ? ['finalizado','feito','aprovado','concluido','concluidas'].includes(status(i)) : finalizado(i)||publicado(i)||agendado(i);
  const pausa = i => status(i)==='segurar post';
  const alteracao = i => status(i)==='alteracao';
  const clienteAguarda = i => ['ag. info cliente','ag. aprovacao cliente'].includes(status(i));
  const faltaInfo = i => ['aguardo','aguardo redacao','falta info','falta d.a','falta off','ag. interno'].includes(status(i));
  const aprovacao = i => ['para aprovacao','em aprovacao'].includes(status(i));
  const cliente = i => (clientesDe(i)||[]).map(resumoTexto).filter(Boolean).join(' / ') || 'Sem cliente';
  const pertence = (i,p) => {
    const ids=Array.isArray(i.responsavel_ids) ? i.responsavel_ids.map(String) : [];
    if(ids.length) return ids.includes(String(p.id));
    return resumoTexto(i.responsavel).split(',').some(n=>[p.nome,p.nomeCompleto].filter(Boolean).some(nome=>normal(n.trim().split(' ')[0])===normal(nome)));
  };
  const temPessoa = i => (i.responsavel_ids?.length || resumoTexto(i.responsavel).length)>0;
  const gestores=equipe.filter(p=>p.grupo==='atendimento');
  const paulo=gestores.find(p=>normal(p.nome)==='paulo');
  const informacaoPaulo = i => faltaInfo(i) && paulo && pertence(i,paulo);
  const aberto = i => !encerrado(i)&&!pronto(i);
  const atraso = i => aberto(i)&&!pausa(i)&&!clienteAguarda(i)&&!informacaoPaulo(i)&&temPessoa(i)&&i.prazo_iso && i.prazo_iso<dia;
  const identidade = i => `${pedido(i)?'demanda':'conteudo'}:${i.id}`;
  const vistos=new Set();
  const unicos=itens.filter(i=>{const id=identidade(i);if(vistos.has(id))return false;vistos.add(id);return true;});
  const conteudos=unicos.filter(i=>!pedido(i));
  const hoje=conteudos.filter(i=>veic(i)===dia);
  const ontemIso=resumoDiasAntes(dia,1);
  const ontem=conteudos.filter(i=>veic(i)===ontemIso);
  const pendentes=unicos.filter(aberto);
  const risco=hoje.filter(i=>aberto(i)&&!pausa(i)&&!informacaoPaulo(i));
  const ordenar=(a,b)=>Number(atraso(b))-Number(atraso(a)) || Number(risco.includes(b))-Number(risco.includes(a))
    || String(a.prazo_iso||'9999').localeCompare(String(b.prazo_iso||'9999'))
    || veic(a).localeCompare(veic(b)) || cliente(a).localeCompare(cliente(b),'pt-BR') || resumoTexto(a.nome).localeCompare(resumoTexto(b.nome),'pt-BR');
  const periodo=i=>{
    const partes=[];
    if(atraso(i)) partes.push(`prazo venceu em ${resumoDiaCurto(i.prazo_iso)}`);
    else if(aberto(i)&&!pausa(i)&&i.prazo_iso) partes.push(i.prazo_iso===dia?'prazo hoje':`prazo ${resumoDiaCurto(i.prazo_iso)}`);
    if(pedido(i)) partes.push(data(i)?`conclusão ${resumoDiaCurto(data(i))}`:'sem data de conclusão');
    else partes.push(veic(i)===dia?'veicula hoje':veic(i)?`veicula ${resumoDiaCurto(veic(i))}`:'sem veiculação');
    return partes.join(' · ');
  };
  const linha=(i,pessoa=true)=>`- ${atraso(i)?'🔴 ':''}${resumoTexto(i.nome)||'Sem título'} (${cliente(i)})${pedido(i)?' [demanda]':''}`
    + `${pessoa?` · ${resumoPessoas(i.responsavel)}`:''} · ${resumoTexto(statusDe(i))||'Sem status'} · ${periodo(i)}`;
  const linhasLote=(lista,pessoa)=>{
    const lotes=new Map();
    for(const i of [...lista].sort(ordenar)) {
      const anuncio=/^card\s*[-:]\s*anuncio\b/.test(normal(i.nome));
      const chave=JSON.stringify([anuncio?'cards-anuncio':normal(i.nome),cliente(i),status(i),i.responsavel_ids||i.responsavel,i.prazo_iso,veic(i),pedido(i)]);
      if(!lotes.has(chave)) lotes.set(chave,[]);
      lotes.get(chave).push(i);
    }
    return [...lotes.values()].map(lote=>lote.length===1?linha(lote[0],pessoa):`${linha(lote[0],pessoa)} · lote de ${lote.length} atividades: ${lote.map(i=>`${resumoTexto(i.nome)} [${i.id}]`).join('; ')}`);
  };
  const bloco=(titulo,lista,pessoa=true)=>lista.length?['',`*${titulo} (${lista.length})*`,...linhasLote(lista,pessoa)]:[];
  const auditoria=[];
  const conferir=(texto,i)=>auditoria.push(`- ${texto}${i?`: ${resumoTexto(i.nome)} (${cliente(i)}) [${i.id}] · ${resumoTexto(statusDe(i))||'Sem status'}`:''}`);
  if(alertaBase) conferir(alertaBase);
  const gruposStatus=[['✅ Finalizados',finalizado],['📌 Agendados',agendado],['📅 Para agendar',pronto],
    ['🎬 Em produção',i=>['a fazer','pode fazer','em andamento','cap. agendada','agendando cap'].includes(status(i))],
    ['✏️ Em alteração',alteracao],['🟡 Aguardando aprovação do cliente',i=>status(i)==='ag. aprovacao cliente'],
    ['🔎 Aprovação interna',aprovacao],['⏳ Falta informação / aguardando cliente',i=>status(i)==='ag. info cliente'||faltaInfo(i)],['⏸️ Post segurado',pausa]];
  const classificados=new Set();
  const categorias=gruposStatus.map(([nome,regra])=>{const lista=hoje.filter(i=>!classificados.has(i)&&regra(i));lista.forEach(i=>classificados.add(i));return {nome,n:lista.length};});
  const extras=new Map();
  for(const i of hoje.filter(i=>!classificados.has(i))) {const chave=status(i);const c=extras.get(chave)||{nome:resumoTexto(statusDe(i))||'Sem status',n:0};c.n++;extras.set(chave,c);}
  categorias.push(...extras.values());
  // Maior resto: percentuais inteiros fecham exatamente 100% sem alterar contagens.
  const porcentagens=categorias.map(c=>hoje.length?Math.floor(c.n*100/hoje.length):0);
  if(hoje.length) {
    let faltam=100-porcentagens.reduce((a,b)=>a+b,0);
    const ordem=categorias.map((c,i)=>({i,resto:c.n*100/hoje.length-porcentagens[i]})).sort((a,b)=>b.resto-a.resto||a.i-b.i);
    for(const {i} of ordem) if(faltam-->0) porcentagens[i]++;
  }
  const metricas=categorias.map((c,i)=>`- ${c.nome}: ${porcentagens[i]}% (${c.n})`);
  const atuais=new Map(conteudos.map(i=>[String(i.id),i]));
  const baseValida=baseAnterior?.data===ontemIso && Array.isArray(baseAnterior.itens);
  const listaBase=baseValida?baseAnterior.itens:[];
  const remanejados=listaBase.filter(i=>atuais.has(String(i.id))&&veic(atuais.get(String(i.id)))!==ontemIso);
  const ausentes=listaBase.filter(i=>!atuais.has(String(i.id)));
  const finalBase=listaBase.filter(i=>atuais.has(String(i.id))&&finalizado(atuais.get(String(i.id)))).length;
  const totalOntem=baseValida?listaBase.length:ontem.length;
  const feitosOntem=baseValida?finalBase:ontem.filter(finalizado).length;
  const pct=totalOntem?Math.round(feitosOntem*100/totalOntem):0;
  if(!baseValida) conferir('Sem a lista de ontem de manhã, o percentual de fechamento pode estar inflado por remanejamentos.');
  else {
    const mantidos=listaBase.filter(i=>atuais.has(String(i.id))&&veic(atuais.get(String(i.id)))===ontemIso);
    conferir(`Fechamento só do que ficou na lista: ${mantidos.length?Math.round(mantidos.filter(i=>finalizado(atuais.get(String(i.id)))).length*100/mantidos.length):0}% (${mantidos.length} atividades).`);
    remanejados.forEach(i=>conferir(`Remanejado de ontem para ${veic(atuais.get(String(i.id)))||'sem data'}`,atuais.get(String(i.id))));
    ausentes.forEach(i=>conferir(`Item da base da manhã não localizado, não presumir remanejamento: [${i.id}]`));
  }
  const geral=[`📣 Bom dia, time! ${resumoDiaCurto(dia)}! 🚀`,'','As demandas estão organizadas nos resumos de cada grupo.',
    '',`📊 *Como fechamos ontem, ${resumoDiaCurto(ontemIso)}:* ${pct}% finalizados: ${feitosOntem} de ${totalOntem}!${pct>=90?' 🎉':''}`,
    `- ${baseValida?`Base da manhã · ${remanejados.length} remanejados · ${ausentes.length} não localizados`:'Sem base da manhã: percentual provisório, sujeito a remanejamentos.'}`,
    '',`📊 *Hoje (${resumoDiaCurto(dia)}), ${hoje.length} conteúdos no total:*`,...metricas,
    ...bloco('Solicitações com conclusão neste dia',unicos.filter(i=>pedido(i)&&data(i)===dia)),
    '',`- 🔴 ${pendentes.filter(atraso).length} atividades com prazo vencido, com responsável, excluindo pausas e espera de informação do Paulo/cliente.`,
    '', 'Bora colocar as entregas em dia, time! 💪'];
  const publicacoes=[`Bom dia, Tai! ☀️ Veiculação de ${resumoDiaCurto(dia)}: ${hoje.length} conteúdos.`,
    ...bloco('✅ Finalizados',hoje.filter(finalizado),false),...bloco('📅 Para agendar',hoje.filter(pronto),false),
    ...bloco('📌 Agendados',hoje.filter(agendado),false),...bloco('Já foram ao ar (status publicado)',hoje.filter(publicado),false),
    ...bloco('🔴 Em produção, risco de furo',risco.filter(i=>!clienteAguarda(i)&&!aprovacao(i)&&!faltaInfo(i)),false),
    ...bloco('🔎 Aprovação interna',hoje.filter(aprovacao),false),...bloco('⏳ Aguardando cliente ou informação',hoje.filter(i=>clienteAguarda(i)||faltaInfo(i)),false),
    ...bloco('⏸️ Post segurado',hoje.filter(pausa),false)];
  const previaDias=new Date(`${dia}T12:00:00`).getDay()===5?2:1;
  let temPublicacoes=hoje.length>0;
  for(let n=1;n<=previaDias;n++) {
    const proximo=resumoDiasAntes(dia,-n),lista=conteudos.filter(i=>veic(i)===proximo);
    temPublicacoes ||= lista.length>0;
    publicacoes.push('',`*Prévia ${resumoDiaCurto(proximo)}*`,
      `- ${lista.length} conteúdos · ${lista.filter(finalizado).length} finalizados · ${lista.filter(pronto).length} para agendar · ${lista.filter(agendado).length} agendados · ${lista.filter(i=>!pronto(i)&&!encerrado(i)).length} pendentes.`);
  }
  if(remanejados.length) publicacoes.push('',`- ${remanejados.length} conteúdos foram remanejados de ontem. Algum ficou travado?`);
  publicacoes.push('','Bora que bora! 💪');
  const criacaoTexto=[`Bom dia, time! ☀️ Vamos organizar ${resumoDiaCurto(dia)}:`,...bloco('🔴 Risco de furo (veiculação neste dia)',risco)];
  const atendimentoTexto=[`Bom dia, time! ☀️ Atendimento e Planejamento de ${resumoDiaCurto(dia)}.`];
  const designers=equipe.filter(p=>p.grupo!=='atendimento'&&p.limite===5);
  const aprovacaoDesign=i=>aprovacao(i) && !/^(reels|video|motion)/.test(normal(i.formato||i.tipo_demanda||i.nome)) && (designers.some(p=>pertence(i,p)) || /^(card|carrossel|design|fotografia|impresso|capa)/.test(normal(i.formato||i.tipo_demanda||i.nome)));
  let temCriacao=risco.length>0,temAtendimento=false;
  for(const pessoa of equipe) {
    const fila=pendentes.filter(i=>pertence(i,pessoa)&&!pausa(i)&&!informacaoPaulo(i));
    if(pessoa.grupo==='atendimento') {if(fila.length)temAtendimento=true;atendimentoTexto.push(...bloco(pessoa.nome,fila,false));continue;}
    const aprovacoes=pessoa.aprovacoesExtras?pendentes.filter(aprovacaoDesign):[];
    const disponiveis=fila.filter(i=>!aprovacaoDesign(i)&&!clienteAguarda(i)&&!faltaInfo(i)).sort(ordenar);
    const trabalho=disponiveis.filter(i=>(i.prazo_iso&&i.prazo_iso<=dia)||risco.includes(i));
    const design=designers.includes(pessoa);
    const foco=design
      ? [...trabalho,...disponiveis.filter(i=>!trabalho.includes(i)).slice(0,Math.max(0,pessoa.limite-trabalho.length))]
      : trabalho.slice(0,pessoa.limite);
    if(foco.length||aprovacoes.length)temCriacao=true;
    criacaoTexto.push(...bloco(`${pessoa.nome} · ${design?'mínimo de':'foco em até'} ${pessoa.limite} demandas`,foco,false));
    if(design && foco.length<pessoa.limite) criacaoTexto.push(`- Há somente ${foco.length} demandas disponíveis para ${pessoa.nome}.`);
    const restantes=design?disponiveis.length-foco.length:trabalho.length-foco.length;
    if(restantes>0) criacaoTexto.push('',`*${pessoa.nome} · próxima fila (${restantes})*`,'- O restante fica para a fila de amanhã no painel.');
    criacaoTexto.push(...bloco(`${pessoa.nome} · aprovações extras (além das ${pessoa.limite})`,aprovacoes,false));
  }
  criacaoTexto.push('','Quem travar em algo, avisa cedo. A gente resolve junto. Bora! 💪');
  const correcao=pendentes.filter(i=>alteracao(i)&&!informacaoPaulo(i));
  for(const i of pendentes) {
    if(paulo && pertence(i,paulo) && !informacaoPaulo(i)) conferir('Item do Paulo para conferência',i);
    if(informacaoPaulo(i)) conferir('Pendência de informação do Paulo, conferir fora da cobrança',i);
    if(!temPessoa(i)) conferir(veic(i)===dia?'Veicula hoje sem responsável':'Atividade sem responsável',i);
    if(!i.prazo_iso && !pausa(i)) conferir('Prazo de entrega não confirmado',i);
    if(status(i)==='pode fazer'&&i.tem_briefing===false) conferir('Pode Fazer sem briefing',i);
    if(status(i)==='pode fazer'&&i.tem_briefing==null) conferir('Briefing não confirmado pela fonte',i);
    if(status(i)==='falta info'&&/design|edicao/.test(normal(i.grupo))) conferir('Falta Info ainda em Design, conferir retorno para Redação',i);
    if(alteracao(i)) {
      const origem=i.responsavel_original_ids;
      if(!Array.isArray(origem)) conferir('Autoria original da alteração não confirmada pela fonte',i);
      else if(!origem.some(id=>(i.responsavel_ids||[]).map(String).includes(String(id)))) conferir('Alteração fora do responsável original',i);
      if(i.status_updated_at && Date.parse(`${dia}T12:00:00-03:00`)-Date.parse(i.status_updated_at)>=30*86400000) conferir('Alteração parada há 30 dias ou mais',i);
    }
    if(gestores.some(p=>pertence(i,p)) && !informacaoPaulo(i) && !aprovacao(i) && /design|edicao|redacao/.test(normal(i.grupo))) conferir('Criação atribuída à gestão, conferir executor',i);
    if(clienteAguarda(i)) conferir('Aguardando retorno do cliente, fora da cobrança por atraso',i);
  }
  const duplicados=new Map();
  for(const i of unicos) {const chave=JSON.stringify([normal(i.nome),cliente(i),pedido(i)]);if(!duplicados.has(chave))duplicados.set(chave,[]);duplicados.get(chave).push(i);}
  for(const lista of duplicados.values()) if(lista.length>1) conferir(`Possíveis cadastros duplicados (${lista.length}), conferir IDs ${lista.map(i=>i.id).join(', ')}`,lista[0]);
  const filaDesign=pendentes.filter(i=>!pausa(i)&&!clienteAguarda(i)&&!faltaInfo(i)&&!aprovacao(i)&&designers.some(p=>pertence(i,p)));
  for(const pessoa of designers) {const total=filaDesign.filter(i=>pertence(i,pessoa)).length;if(total>filaDesign.length/2&&filaDesign.length>1) conferir(`Carga de design: ${pessoa.nome} participa de ${total} de ${filaDesign.length} atividades da fila.`);}
  const conferencia=[`*Pontos pra conferir (só pra mim)*`,...(geradoEm?[`- Dados consultados em ${geradoEm}.`]:[]),...auditoria];
  return [
    {id:'geral',nome:'Geral',texto:geral.join('\n')},
    {id:'producao',nome:'Produção',texto:'',agenda:true,pronta:false},
    ...(temCriacao?[{id:'criacao',nome:'Criação',texto:criacaoTexto.join('\n')}]:[]),
    ...(correcao.length?[{id:'correcao',nome:'Correção',texto:[`Bom dia! Alterações de ${resumoDiaCurto(dia)}.`,...bloco('Alterações (responsável atual, autoria original a conferir)',correcao)].join('\n')}]:[]),
    ...(temPublicacoes?[{id:'publicacoes',nome:'Saída de Publicações',texto:publicacoes.join('\n')}]:[]),
    ...(temAtendimento?[{id:'atendimento',nome:'Atendimento e Planejamento',texto:atendimentoTexto.join('\n')}]:[]),
    {id:'conferencia',nome:'Pontos pra conferir (só pra mim)',texto:conferencia.join('\n'),pessoal:true},
  ];
}

function resumoProducaoAgenda(eventos,dia) {
  const fim=resumoDiasAntes(dia,-5);
  const linhas=[`Bom dia, Mizinho! 🎬 Gravações e captações de ${resumoDiaCurto(dia)} a ${resumoDiaCurto(fim)}.`,
    '- Horários no fuso de Brasília. Fonte: Google Agenda da agência.'];
  let anterior='';
  for(const evento of eventos) {
    if(evento.dia!==anterior) { linhas.push('',`*${resumoDiaCurto(evento.dia)}*`); anterior=evento.dia; }
    linhas.push(`- ${resumoTexto(evento.horario)}${evento.fimDia && evento.fimDia!==evento.dia ? ` (termina ${resumoDiaCurto(evento.fimDia)})` : ''}: ${resumoTexto(evento.titulo)}${evento.local ? ` · ${resumoTexto(evento.local)}` : ''}`);
  }
  if(!eventos.length) linhas.push('','- Nenhuma gravação ou captação cadastrada nesse período.');
  linhas.push('','Qualquer ajuste, avisa por aqui. Bora! 🚀');
  return linhas.join('\n');
}
