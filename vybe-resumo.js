// Mensagens determinísticas para revisão e cópia manual por grupo do WhatsApp.
// Usa somente os dados carregados no painel; não envia mensagens nem chama IA.
function resumoTexto(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }

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

function resumosPorGrupo(itens, dia, { statusDe, clientesDe, equipe = [] }) {
  const normal = v => resumoTexto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const status = i => normal(statusDe(i));
  const pedido = i => i.origem === 'solicitacao';
  const data = i => pedido(i) ? (i.conclusao_iso || i.prazo_iso || '') : (i.veiculacao_iso || '');
  const finalizado = i => !pedido(i) && status(i) === 'finalizado';
  const publicado = i => !pedido(i) && ['publicado','postado'].includes(status(i));
  const agendado = i => !pedido(i) && status(i) === 'agendado';
  const encerrado = i => pedido(i)
    ? ['finalizado', 'feito', 'aprovado', 'concluido', 'concluidas'].includes(status(i))
    : finalizado(i) || publicado(i) || agendado(i);
  const pronto = i => !pedido(i) && status(i) === 'para agendar';
  const cliente = i => (clientesDe(i) || []).map(resumoTexto).filter(Boolean).join(' / ') || 'Sem cliente';
  const alteracao = i => status(i) === 'alteracao';
  const clienteAguarda = i => ['ag. info cliente', 'ag. aprovacao cliente'].includes(status(i));
  const aprovacao = i => ['para aprovacao', 'em aprovacao'].includes(status(i));
  const prioridade = i => [data(i),i.prazo_iso].filter(Boolean).sort()[0] || '9999';
  const ordenar = (a,b) => prioridade(a).localeCompare(prioridade(b)) || cliente(a).localeCompare(cliente(b),'pt-BR') || resumoTexto(a.nome).localeCompare(resumoTexto(b.nome),'pt-BR');
  const vistos = new Set();
  const unicos = itens.filter(i => {
    const key = `${pedido(i) ? 'demanda' : 'conteudo'}:${i.id}`;
    if (vistos.has(key)) return false;
    vistos.add(key); return true;
  });
  const conteudos = unicos.filter(i => !pedido(i));
  const hoje = conteudos.filter(i => data(i) === dia).sort(ordenar);
  const pendentes = unicos.filter(i => !encerrado(i) && !pronto(i)).sort(ordenar);
  const periodo = i => {
    const partes = [];
    if (i.prazo_iso && i.prazo_iso < dia) partes.push(`prazo venceu em ${resumoDiaCurto(i.prazo_iso)}`);
    else if (i.prazo_iso === dia) partes.push('prazo hoje');
    if (!data(i)) partes.push('sem data');
    else if (pedido(i)) partes.push(`conclusão ${resumoDiaCurto(data(i))}`);
    else if (data(i) === dia) partes.push('veicula hoje');
    else if (data(i) < dia) partes.push(`veiculação atrasada: ${resumoDiaCurto(data(i))}`);
    else partes.push(`veicula ${resumoDiaCurto(data(i))}`);
    return partes.join(', ');
  };
  const linha = (i, comPessoa = true) => `- ${resumoTexto(i.nome) || 'Sem título'} (${cliente(i)})${pedido(i) ? ' [demanda]' : ''}`
    + `${comPessoa ? ` · ${resumoPessoas(i.responsavel)}` : ''} · ${resumoTexto(statusDe(i)) || 'Sem status'} · ${periodo(i)}`
    + (resumoTexto(i.status_context?.reason) ? ` · ${resumoTexto(i.status_context.reason)}` : '');
  const bloco = (titulo, lista, comPessoa = true) => lista.length ? ['' , `*${titulo} (${lista.length})*`, ...lista.map(i => linha(i, comPessoa))] : [];
  const abertura = `Bom dia, time! ☀️ ${resumoDiaCurto(dia)}.`;
  const risco = hoje.filter(i => !encerrado(i) && !pronto(i));
  const gruposStatus = [
    ['✅ Finalizados', finalizado],
    ['📌 Agendados', agendado],
    ['📅 Para agendar', pronto],
    ...(hoje.some(publicado) ? [['Publicados', publicado]] : []),
    ['✏️ Em alteração', alteracao],
    ['⏳ Aguardando o cliente', clienteAguarda],
    ['👀 Em aprovação interna', aprovacao],
  ];
  const classificados = new Set();
  const metricas = gruposStatus.map(([titulo, regra]) => {
    const lista = hoje.filter(i => regra(i)); lista.forEach(i => classificados.add(i));
    return `${titulo}: ${hoje.length ? Math.round(lista.length * 100 / hoje.length) : 0}% (${lista.length})`;
  });
  const restantes = hoje.filter(i => !classificados.has(i));
  const outrosStatus = new Map();
  for(const item of restantes) {
    const chave=status(item);
    const grupo=outrosStatus.get(chave) || {nome:resumoTexto(statusDe(item)) || 'Sem status',quantidade:0};
    grupo.quantidade++; outrosStatus.set(chave,grupo);
  }
  for(const grupo of outrosStatus.values()) metricas.push(`${grupo.nome}: ${Math.round(grupo.quantidade*100/hoje.length)}% (${grupo.quantidade})`);
  const ontem = conteudos.filter(i => data(i) === resumoDiasAntes(dia,1));
  const finalizadosOntem = ontem.filter(finalizado).length;
  const geral = [abertura, '', `*Ontem: ${finalizadosOntem} de ${ontem.length} conteúdos finalizados.*`,
    `Para agendar: ${ontem.filter(pronto).length} · Agendados: ${ontem.filter(agendado).length}${ontem.some(publicado) ? ` · Publicados: ${ontem.filter(publicado).length}` : ''}`, '',
    `*${hoje.length} conteúdo${hoje.length === 1 ? "" : "s"} com veiculação neste dia:*`, ...metricas,
    '', `🔴 ${risco.length} conteúdo${risco.length === 1 ? " deste dia ainda não está pronto ou agendado" : "s deste dia ainda não estão prontos ou agendados"}.`,
    `${pendentes.filter(i=>i.prazo_iso && i.prazo_iso<dia).length} atividades pendentes com prazo vencido. Detalhes nos resumos de Criação, Atendimento e Planejamento e Correção.`];
  const publicacoes = [abertura, '', `*Veiculação de ${resumoDiaCurto(dia)}: ${hoje.length} conteúdos*`,
    ...bloco('✅ Finalizados', hoje.filter(finalizado),false),
    ...bloco('📅 Para agendar', hoje.filter(pronto),false),
    ...bloco('📌 Agendados', hoje.filter(agendado),false),
    ...bloco('Publicados', hoje.filter(publicado),false),
    ...bloco('🔴 Ainda em produção / alteração', risco.filter(i=>!clienteAguarda(i)&&!aprovacao(i)),false),
    ...bloco('⏳ Aguardando cliente / aprovação', risco.filter(i=>clienteAguarda(i)||aprovacao(i)),false)];
  for (let n=1;n<=2;n++) {
    const proximo = resumoDiasAntes(dia,-n);
    const lista = conteudos.filter(i=>data(i)===proximo);
    publicacoes.push('', `*${resumoDiaCurto(proximo)}:* ${lista.length} conteúdos; ${lista.filter(finalizado).length} finalizados, ${lista.filter(pronto).length} para agendar, ${lista.filter(agendado).length} agendados${lista.some(publicado) ? `, ${lista.filter(publicado).length} publicados` : ''}, ${lista.filter(i=>!pronto(i)&&!encerrado(i)).length} pendentes.`);
  }
  const pertence = (item,pessoa) => {
    const ids=Array.isArray(item.responsavel_ids) ? item.responsavel_ids.map(String) : [];
    // Com IDs presentes, a identidade é obrigatória; nomes são só compatibilidade.
    if(ids.length) return ids.includes(String(pessoa.id));
    return resumoTexto(item.responsavel).split(',').some(n=>[pessoa.nome,pessoa.nomeCompleto].filter(Boolean).some(nome=>normal(n.trim().split(' ')[0])===normal(nome)));
  };
  const criacaoTexto = [abertura,'Vamos organizar as entregas. As filas abaixo são prioridades sugeridas; a atribuição no painel não muda.',
    ...bloco('🔴 Risco de furo — veiculação neste dia',risco)];
  const atendimentoTexto = [abertura,'Pendências de atendimento e planejamento, por responsável.'];
  for(const pessoa of equipe) {
    const fila=pendentes.filter(i=>pertence(i,pessoa)).sort((a,b)=>Number(risco.includes(b))-Number(risco.includes(a)) || ordenar(a,b));
    if(pessoa.grupo==='atendimento') {
      atendimentoTexto.push(...bloco(pessoa.nome,fila,false));
      if(!fila.length) atendimentoTexto.push('',`*${pessoa.nome}:* nenhuma pendência.`);
      continue;
    }
    const aprovacoes=pessoa.aprovacoesExtras ? fila.filter(aprovacao) : [];
    const trabalho=fila.filter(i=>!aprovacoes.includes(i));
    const foco=trabalho.slice(0,pessoa.limite);
    criacaoTexto.push(...bloco(`${pessoa.nome} · foco em até ${pessoa.limite} demandas`,foco,false));
    if(!foco.length) criacaoTexto.push('',`*${pessoa.nome}:* nenhuma demanda na fila.`);
    if(trabalho.length>pessoa.limite) criacaoTexto.push('',`*${pessoa.nome} · próxima fila (${trabalho.length-pessoa.limite})*`,
      'As demais demandas continuam na fila do painel para os próximos dias.');
    criacaoTexto.push(...bloco(`${pessoa.nome} · aprovações extras (além das ${pessoa.limite})`,aprovacoes,false));
  }
  criacaoTexto.push('', 'Quem travar em algo, avisa cedo no grupo para a gente resolver junto. Bora! 💪');
  const correcao = pendentes.filter(alteracao);
  return [
    { id:'geral',nome:'Geral',texto:geral.join('\n') },
    { id:'criacao',nome:'Criação',texto:criacaoTexto.join('\n') },
    { id:'publicacoes',nome:'Saída de Publicações',texto:publicacoes.join('\n') },
    { id:'atendimento',nome:'Atendimento e Planejamento',texto:atendimentoTexto.join('\n') },
    { id:'producao',nome:'Produção',texto:'',agenda:true,pronta:false },
    { id:'correcao',nome:'Correção',texto:[abertura,...bloco('✏️ Alterações pendentes',correcao),
      ...(!correcao.length?['','Nenhuma alteração pendente no recorte.']:[])].join('\n') },
  ];
}

function resumoProducaoAgenda(eventos,dia) {
  const fim=resumoDiasAntes(dia,-6);
  const linhas=[`Bom dia, Mizinho! 🎬 Gravações e captações de ${resumoDiaCurto(dia)} a ${resumoDiaCurto(fim)}.`,
    'Horários no fuso de Brasília. Fonte: Google Agenda da agência.'];
  let anterior='';
  for(const evento of eventos) {
    if(evento.dia!==anterior) { linhas.push('',`*${resumoDiaCurto(evento.dia)}*`); anterior=evento.dia; }
    linhas.push(`- ${resumoTexto(evento.horario)}${evento.fimDia && evento.fimDia!==evento.dia ? ` (termina ${resumoDiaCurto(evento.fimDia)})` : ''}: ${resumoTexto(evento.titulo)}${evento.local ? ` · ${resumoTexto(evento.local)}` : ''}`);
  }
  if(!eventos.length) linhas.push('','Nenhuma gravação ou captação cadastrada nessa semana.');
  linhas.push('','Qualquer ajuste, avisa por aqui. Bora! 🚀');
  return linhas.join('\n');
}
