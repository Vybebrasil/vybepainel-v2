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

function resumosPorGrupo(itens, dia, { statusDe, clientesDe, reristonId = '68036697' }) {
  const normal = v => resumoTexto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const status = i => normal(statusDe(i));
  const pedido = i => i.origem === 'solicitacao';
  const data = i => pedido(i) ? (i.conclusao_iso || i.prazo_iso || '') : (i.veiculacao_iso || '');
  const encerrado = i => pedido(i)
    ? ['finalizado', 'feito', 'aprovado', 'concluido', 'concluidas'].includes(status(i))
    : ['publicado', 'postado', 'agendado'].includes(status(i));
  const pronto = i => !pedido(i) && ['finalizado', 'para agendar'].includes(status(i));
  const cliente = i => (clientesDe(i) || []).map(resumoTexto).filter(Boolean).join(' / ') || 'Sem cliente';
  const alteracao = i => status(i) === 'alteracao';
  const clienteAguarda = i => ['ag. info cliente', 'ag. aprovacao cliente'].includes(status(i));
  const aprovacao = i => ['para aprovacao', 'em aprovacao'].includes(status(i));
  const captacao = i => !pedido(i) && (normal(i.grupo).includes('producao') || ['cap. agendada', 'agendando cap'].includes(status(i)))
    && !['captacao feita', 'feita'].includes(normal(i.captacao));
  const futuros = resumoDiasAntes(dia, -2);
  const prioridade = i => (data(i) || '9999');
  const ordenar = (a,b) => prioridade(a).localeCompare(prioridade(b)) || cliente(a).localeCompare(cliente(b),'pt-BR') || resumoTexto(a.nome).localeCompare(resumoTexto(b.nome),'pt-BR');
  const vistos = new Set();
  const unicos = itens.filter(i => {
    const key = `${pedido(i) ? 'demanda' : 'conteudo'}:${i.id}`;
    if (vistos.has(key)) return false;
    vistos.add(key); return true;
  });
  const conteudos = unicos.filter(i => !pedido(i));
  const hoje = conteudos.filter(i => data(i) === dia).sort(ordenar);
  const pendentes = unicos.filter(i => !encerrado(i) && !pronto(i) &&
    ((!data(i) || data(i) <= futuros) || (i.prazo_iso && i.prazo_iso <= dia))).sort(ordenar);
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
    ['✅ Publicados', i => ['publicado','postado'].includes(status(i))],
    ['📌 Agendados', i => status(i)==='agendado'],
    ['📅 Prontos para agendar', pronto],
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
  metricas.push(`🎬 Em produção / outros status: ${hoje.length ? Math.round(restantes.length*100/hoje.length) : 0}% (${restantes.length})`);
  const ontem = conteudos.filter(i => data(i) === resumoDiasAntes(dia,1));
  const publicadosOntem = ontem.filter(i => ['publicado','postado'].includes(status(i))).length;
  const geral = [abertura, '', `*Ontem: ${publicadosOntem} de ${ontem.length} conteúdos com status publicado.*`, '',
    `*${hoje.length} conteúdo${hoje.length === 1 ? "" : "s"} com veiculação neste dia:*`, ...metricas,
    '', `🔴 ${risco.length} conteúdo${risco.length === 1 ? " deste dia ainda não está pronto ou agendado" : "s deste dia ainda não estão prontos ou agendados"}.`,
    `${pendentes.filter(i=>i.prazo_iso && i.prazo_iso<dia).length} atividades pendentes com prazo vencido. Detalhes nos resumos de Criação, Produção e Correção.`];
  const publicacoes = [abertura, '', `*Veiculação de ${resumoDiaCurto(dia)}: ${hoje.length} conteúdos*`,
    ...bloco('✅ Prontos para agendar', hoje.filter(pronto),false),
    ...bloco('📌 Agendados / publicados', hoje.filter(encerrado),false),
    ...bloco('🔴 Ainda em produção / alteração', risco.filter(i=>!clienteAguarda(i)&&!aprovacao(i)),false),
    ...bloco('⏳ Aguardando cliente / aprovação', risco.filter(i=>clienteAguarda(i)||aprovacao(i)),false)];
  for (let n=1;n<=2;n++) {
    const proximo = resumoDiasAntes(dia,-n);
    const lista = conteudos.filter(i=>data(i)===proximo);
    publicacoes.push('', `*${resumoDiaCurto(proximo)}:* ${lista.length} conteúdos; ${lista.filter(pronto).length} prontos, ${lista.filter(encerrado).length} agendados/publicados, ${lista.filter(i=>!pronto(i)&&!encerrado(i)).length} pendentes.`);
  }
  const criacao = pendentes.filter(i=>!alteracao(i)&&!captacao(i));
  const porPessoa = new Map();
  for (const i of criacao) {
    const ids = Array.isArray(i.responsavel_ids) ? i.responsavel_ids.map(String) : [];
    const nomes = resumoTexto(i.responsavel).split(',').map(n=>n.trim()).filter(Boolean);
    const pessoas = nomes.length ? nomes : ['Sem responsável'];
    for (let n=0;n<pessoas.length;n++) {
      const id = ids[n] || pessoas[n];
      if (!porPessoa.has(id)) porPessoa.set(id,{ nome:pessoas[n],itens:[] });
      porPessoa.get(id).itens.push(i);
    }
  }
  const criacaoTexto = [abertura, 'Vamos organizar as entregas. Cada pessoa aparece com as atividades em que está atribuída.',
    ...bloco('🔴 Risco de furo — veiculação neste dia',risco.filter(i=>criacao.includes(i)))];
  for (const [id,pessoa] of porPessoa) {
    const reriston = id===String(reristonId) || normal(pessoa.nome).startsWith('reriston');
    const fila = pessoa.itens;
    criacaoTexto.push(...bloco(`${resumoPessoas(pessoa.nome)}${reriston?' · foco em até 4 demandas':''}`,reriston?fila.slice(0,4):fila,false));
    if(reriston && fila.length>4) criacaoTexto.push(...bloco('Reriston · próxima fila (além das 4)',fila.slice(4),false));
  }
  if(!criacao.length) criacaoTexto.push('', 'Nenhuma pendência de criação no recorte.');
  criacaoTexto.push('', 'Quem travar em algo, avisa cedo no grupo para a gente resolver junto. Bora! 💪');
  const producao = pendentes.filter(captacao);
  const correcao = pendentes.filter(alteracao);
  return [
    { id:'geral',nome:'Geral',texto:geral.join('\n') },
    { id:'criacao',nome:'VYBE · Criação',texto:criacaoTexto.join('\n') },
    { id:'publicacoes',nome:'Saída de Publicações',texto:publicacoes.join('\n') },
    { id:'producao',nome:'Produção',texto:[abertura,'Agenda de captação e pendências de produção.',
      'Datas abaixo são de prazo/veiculação. Horários do Google Agenda não estão conectados a este resumo.',
      ...bloco('Captação / produção',producao),...(!producao.length?['','Nenhuma pendência de captação no recorte.']:[])].join('\n') },
    { id:'correcao',nome:'Correção',texto:[abertura,...bloco('✏️ Alterações pendentes',correcao),
      ...(!correcao.length?['','Nenhuma alteração pendente no recorte.']:[])].join('\n') },
  ];
}
