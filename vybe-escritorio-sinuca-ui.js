// Apresentação exclusiva da sinuca. As ações e a economia seguem os contratos das mesas.
// Endereços inteiros: o build põe a versão (?v=) em cada um, e a foto nova
// chega mesmo para quem tinha a antiga guardada no navegador.
const SINUCA_RETRATOS={facil:'/assets/jogos/sinuca-ze.webp',medio:'/assets/jogos/sinuca-tio.webp',lendario:'/assets/jogos/sinuca-lenda.webp'};
const sinucaRetrato=(nivel)=>SINUCA_RETRATOS[nivel]||SINUCA_RETRATOS.facil;
function sinucaMarcaHtml(){return '<img class="snc-emblema" src="/assets/jogos/sinuca-emblema.webp" alt=""><span><small>VYBE · SALÃO DE JOGOS</small><b>SINUCA <em>DE BOTECO</em></b></span>';}
function sinucaCabecalhoHtml(titulo,voltar='xadrezFechar()'){
 return `<header class="snc-sala-topo tema-sinuca"><div class="snc-marca">${sinucaMarcaHtml()}</div><span class="snc-local">${safeText(titulo)}</span><button type="button" class="snc-icone" aria-label="Fechar sinuca" onclick="${voltar}">×</button></header>`;
}
function sinucaPessoaHtml(p){const u=escritorioCabecaUrl(p?.id);return u?`<img src="${safeText(u)}" alt="">`:`<i class="snc-inicial">${safeText(String(p?.nome||'?')[0])}</i>`;}
function sinucaLobbySecao(aba){
 if(!['sala','desafios','ranking','conquistas','temporada'].includes(aba))return;
 const x=escritorioXadrez();x.sinucaSecao=aba;desenharLobbySinuca(x.sala||{},x.salaCfg||x.cfg);
}
// A Jornada dos bares: o caminho dos três bares, cada um com o dono, o prêmio e
// o estado (vencido, aberto, fechado). O servidor confere a ordem ao desafiar.
function sinucaBotsHtml(cfg){
 const x=escritorioXadrez(),e=x.extras?.jogo==='sinuca'?x.extras:null;
 if(!e)return '<p class="snc-vazio">Preparando os bares…</p>';
 if(!e.bots?.bots?.length)return '<div class="snc-vazio"><h3>Os donos dos bares não chegaram.</h3><p>Não foi possível carregar a jornada agora.</p><button class="snc-btn" onclick="escritorioXadrez().extras=null;mesaLerExtras(mesaCfg())">Tentar novamente</button></div>';
 const bares=e.bots.bares||e.bots.bots.map(b=>({nivel:b.nivel,bar:b.nome,aberto:true,vencido:b.vitorias>0}));
 const passo=(bar,i)=>{const b=e.bots.bots.find(x=>x.nivel===bar.nivel);if(!b)return'';const estado=bar.vencido?'vencido':bar.aberto?'aberto':'fechado';
  return `<article class="snc-bar ${estado}"><span class="snc-bar-num">${String(i+1).padStart(2,'0')}</span><img src="${sinucaRetrato(b.nivel)}" alt="Retrato de ${safeText(b.nome)}"><div class="snc-bar-dados"><small>${safeText(bar.bar)}</small><h3>${safeText(b.nome)}</h3><p>${safeText(b.frase)}</p><div class="snc-recompensa">${e.bots.resta_hoje?`<b>+${Math.min(b.premio.moedas,e.bots.resta_hoje)} moedas</b> · +${b.premio.xp} XP`:'Treino · sem prêmio em moedas'}${b.vitorias?`<small>${b.vitorias} vitória${b.vitorias>1?'s':''} sua${b.vitorias>1?'s':''}</small>`:''}</div>${estado==='fechado'?`<span class="snc-bar-tranca">🔒 Vença o dono do bar anterior</span>`:`<button type="button" class="snc-btn" onclick="desafiarBotEscritorio('${safeText(b.bot)}',this)">${estado==='vencido'?'Jogar de novo':'Entrar no bar'} <span>↗</span></button>`}</div>${estado==='vencido'?'<i class="snc-bar-selo">DONO DERRUBADO</i>':''}</article>`;};
 return `<div class="snc-painel-topo"><div><small>JORNADA DOS BARES</small><h2>Do boteco da esquina ao salão do Baianinho.</h2></div><p>${e.bots.resta_hoje?`Até ${Number(e.bots.resta_hoje).toLocaleString('pt-BR')} moedas em prêmios hoje.`:'Limite de prêmios de hoje atingido. Ainda vale o treino.'}</p></div><div class="snc-jornada">${bares.map(passo).join('<i class="snc-jornada-seta" aria-hidden="true">›</i>')}</div>`;
}
function sinucaConvitesHtml(d){
 const recebidos=(d.convites||[]).map(j=>`<article class="snc-desafio-recebido"><div>${sinucaPessoaHtml(j.desafiante)}<span><small>DESAFIO RECEBIDO</small><b>${xadrezPrimeiroNome(j.desafiante)} quer jogar.</b></span>${mesaPrazoHtml(j.convite_ate)}</div>${xadrezApostaHtml(j,'desafiado')}<footer><button class="snc-btn secundario" onclick="responderXadrezEscritorio('${safeText(j.id)}','recusar',this)">Recusar</button><button class="snc-btn" onclick="responderXadrezEscritorio('${safeText(j.id)}','aceitar',this)">Aceitar e jogar ↗</button></footer></article>`).join('');
 const espera=[...(d.enviados||[]),...(d.aguardando||[])].map(j=>`<article class="snc-pendente"><div><small>DESAFIO NA MESA</small><b>${xadrezPrimeiroNome(j.desafiante)} × ${xadrezPrimeiroNome(j.desafiado)}</b><p>Aguardando o aceite. A partida abre automaticamente.</p></div>${mesaPrazoHtml(j.convite_ate)}<button class="snc-btn secundario" onclick="responderXadrezEscritorio('${safeText(j.id)}','${(d.enviados||[]).some(v=>v.id===j.id)?'cancelar':'recusar'}',this)">Cancelar</button></article>`).join('');
 return recebidos+espera;
}
// O salão como menu de jogo (Paulo, 04/11/2026: "ficou preso na estrutura que já
// existia... quero algo mais jogo, não balão de dashboard"): a cena do bar ocupa
// a tela, o menu principal fica à esquerda em placas grandes, o painel da opção
// escolhida à direita, e o jogador (cabeça, posição, taco, carteira) no topo.
const SINUCA_MENU=[
 ['sala','Desafiar a equipe','Quem está no escritório','<circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.6"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6M14 19c.3-2.6 1.6-4.6 4-4.6 2.2 0 3 1.6 3 4.6"/>'],
 ['desafios','Jornada dos bares','Três bares, três donos','<path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>'],
 ['ranking','Ranking do salão','Quem manda no taco','<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8 20h8M9.5 17h5"/>'],
 ['conquistas','Conquistas','Feitos, títulos e zoeiras','<path d="M8 3h8l-1 6H9z"/><circle cx="12" cy="15" r="5"/><path d="M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>'],
 ['temporada','Temporada','A glória do boteco','<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'],
];
function sinucaIcone(d){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;}
function sinucaBannerJogador(saldo){
 const salao=escritorioXadrez().extras?.bots?.salao,eu=String(escritorio.base?.eu||''),f=salao?.fichas?.[eu],r=salao?.ranking?.lista?.find(p=>p.id===eu);
 const nome=r?.nome||escritorio.base?.nome||'Você',taco=f?.taco||'casa';
 return `<button type="button" class="snc-banner" onclick="sinucaFichaDoSalao('${safeText(eu)}')" title="Minha ficha do bar"><span class="snc-banner-cabeca">${sinucaPessoaHtml({id:eu,nome})}</span><span class="snc-banner-nome"><b>${safeText(String(nome).split(' ')[0])}</b><small>${r?`${r.posicao}º do salão · ${r.vitorias}V ${r.derrotas}D`:'Fora do ranking'}</small><canvas data-snc-taco="${safeText(taco)}" aria-hidden="true"></canvas></span>${saldo!==undefined?`<span class="snc-banner-moedas"><b>${Number(saldo).toLocaleString('pt-BR')}</b><small>moedas</small></span>`:''}</button>`;
}
// O SALÃO NO PADRÃO NOVO (Paulo, 08/11/2026: "o salão continuou tudo igual?
// ... mantém o padrão novo"): o seu personagem grande à esquerda, como na
// seleção de desafio (retrato, nome, título com o que quer dizer, campanha,
// moedas e taco), o menu em placas embaixo dele e o conteúdo direto na cena,
// sem a caixa de painel.
function sinucaHeroiHtml(saldo){
 const x=escritorioXadrez(),salao=x.extras?.jogo==='sinuca'?x.extras.bots?.salao:null,eu=String(escritorio.base?.eu||''),f=salao?.fichas?.[eu],r=salao?.ranking?.lista?.find(p=>p.id===eu);
 const nome=r?.nome||escritorio.base?.nome||'Você',u=escritorioCabecaUrl?.(eu),t=f?.titulo;
 return `<button type="button" class="snc-heroi ${safeText(t?.raridade||'comum')}" onclick="sinucaFichaDoSalao('${safeText(eu)}')" title="Abrir a minha ficha do bar"><span class="snc-heroi-foto">${u?`<img src="${safeText(u)}" alt="">`:`<i>${safeText(String(nome)[0])}</i>`}</span>
<span class="snc-heroi-dados"><small>VOCÊ</small><b class="snc-heroi-nome">${safeText(String(nome).split(' ')[0])}</b><em class="snc-heroi-titulo">${safeText(t?.nome||'Estreante')}</em><span class="snc-heroi-texto">${safeText(t?.texto||'Ganhe a primeira partida para ter um título.')}</span></span>
<span class="snc-heroi-numeros"><span><b>${r?`${r.posicao}º`:'—'}</b><small>salão</small></span><span><b>${f?f.vitorias:0}<i>V</i> ${f?f.derrotas:0}<i>D</i></b><small>campanha</small></span>${saldo!==undefined?`<span class="moedas"><b>${Number(saldo).toLocaleString('pt-BR')}</b><small>moedas</small></span>`:''}</span>
<canvas class="snc-heroi-taco" data-snc-taco="${safeText(f?.taco||'casa')}" aria-hidden="true"></canvas></button>`;
}
function desenharLobbySinuca(d,cfg){
 const x=escritorioXadrez(),aba=x.sinucaSecao||'sala',online=mesaPessoasParaChamar(),saldo=escritorio.base?.economia?.saldo;
 mesaLerExtras(cfg);
 // Cada carta diz quem é a pessoa no bar (Paulo, 08/11/2026: melhorar a UX de todos os menus): título, campanha e o taco.
 const fichasSalao=x.extras?.bots?.salao?.fichas||{};
 const equipe=online.slice(0,12).map(p=>{const f=fichasSalao[String(p.id)];return `<button type="button" class="snc-carta-pessoa ${p.online?'online':''}" onclick="novoXadrez(null);escolherRivalXadrez('${safeText(String(p.id))}')"><span class="snc-carta-cabeca">${sinucaPessoaHtml(p)}</span><b>${xadrezPrimeiroNome(p)}</b><small>${p.online?'No escritório':'Convidar'}</small>${f?`<span class="snc-carta-ficha"><i class="${safeText(f.titulo?.raridade||'comum')}">${safeText(f.titulo?.nome||'Estreante')}</i><span>${f.vitorias}V · ${f.derrotas}D${f.posicao?` · ${f.posicao}º`:''}</span><canvas data-snc-taco="${safeText(f.taco||'casa')}" aria-hidden="true"></canvas></span>`:''}<em>DESAFIAR</em></button>`;}).join('');
 const aoVivo=d.mesa?`<button type="button" class="snc-ao-vivo" onclick="mesaAssistir()"><i></i>AO VIVO · ${xadrezPrimeiroNome(d.mesa.desafiante)} × ${xadrezPrimeiroNome(d.mesa.desafiado)}<b>ASSISTIR</b></button>`:'';
 const tSnc=x.extras?.jogo==='sinuca'?x.extras.temporada:null,temporada=tSnc&&typeof sinucaTemporadaHtml==='function'?sinucaTemporadaHtml(tSnc):mesaTemporadaHtml(cfg);
 const painel=aba==='sala'?`<div class="snc-painel-topo"><div><small>A DISPUTA FICA MELHOR COM COMPANHIA</small><h2>Quem vai pra mesa?</h2></div><button class="snc-btn" onclick="novoXadrez(null)">DESAFIAR UM AMIGO</button></div><div class="snc-cartas-pessoas">${equipe||'<p class="snc-vazio">Ninguém mais na equipe por enquanto. Treine na Jornada dos bares.</p>'}</div>${typeof sinucaSeuBarHtml==='function'?sinucaSeuBarHtml():''}`
  :aba==='desafios'?sinucaBotsHtml(cfg)
  :aba==='ranking'?sinucaSalaoHtml()
  :aba==='conquistas'?sinucaConquistasHtml()
  :`<div class="snc-painel-topo"><div><small>A GLÓRIA DO BOTECO</small><h2>Seu nome no topo.</h2></div></div>${temporada||'<div class="snc-vazio"><p>Temporada indisponível no momento.</p><button class="snc-btn secundario" onclick="escritorioXadrez().extras=null;mesaLerExtras(mesaCfg())">Atualizar temporada</button></div>'}`;
 xadrezModal(`<div class="snc-sala snc-jogo-menu snc-hub"><div class="snc-cena" aria-hidden="true"></div>
<header class="snc-menu-topo tema-sinuca"><div class="snc-marca">${sinucaMarcaHtml()}</div><button type="button" class="snc-icone" aria-label="Fechar sinuca" onclick="xadrezFechar()">×</button></header>
<nav class="snc-menu-principal" aria-label="Menu da sinuca">${sinucaHeroiHtml(saldo)}${SINUCA_MENU.map(([id,nome,sub,ic])=>`<button type="button" class="snc-opcao" aria-pressed="${aba===id}" onclick="sinucaLobbySecao('${id}')">${sinucaIcone(ic)}<span><b>${nome}</b><small>${sub}</small></span></button>`).join('')}<small class="snc-menu-regra">PAR OU ÍMPAR · REGRA DE BAR</small></nav>
<main class="snc-menu-painel" data-aba="${aba}">${sinucaConvitesHtml(d)}${aoVivo}${painel}<p class="ofc-erro" id="xdz-erro" role="alert"></p></main></div>`,'ofc-xdz-sala');
 mesaLobbyRelogio();
 sinucaTacosVitrine(document.querySelector('.snc-sala')||document);
}
// PREPARAR DESAFIO como seleção de personagem (Paulo, 08/11/2026: "você tá
// mantendo tudo igual só trocando a cor... é pra mudar tudo"). Antes era um
// formulário com três passos e rolagem; agora é uma tela só, sem rolar: você à
// esquerda, o rival à direita (grande, com título e campanha), o VS no meio com
// as regras como seletores de jogo (◀ ▶) e o valor em fichas, e a fileira dos
// jogadores embaixo para escolher. Mesmas funções de antes (rival, dupla,
// regras da casa, resenha ou valendo, moedas e itens, enviar).
function sinucaSelRetrato(p,f,lado,vazio){
 const u=p?escritorioCabecaUrl?.(p.id):'';
 const t=f?.titulo;
 return `<section class="snc-sel-lado ${lado}${p?'':' vazio'}"><div class="snc-sel-foto">${u?`<img src="${safeText(u)}" alt="">`:`<i>${p?safeText(String(p.nome||'?')[0]):'?'}</i>`}</div>
<div class="snc-sel-nome"><small>${lado==='eu'?'VOCÊ':p?'O RIVAL':'ESCOLHA O RIVAL'}</small><h2>${p?safeText(xadrezPrimeiroNome(p)):safeText(vazio||'—')}</h2>${t?`<b class="snc-sel-titulo ${safeText(t.raridade)}">${safeText(t.nome)}</b><span class="snc-sel-texto">${safeText(t.texto||'')}</span>`:p?'<b class="snc-sel-titulo comum">Estreante</b>':''}
${f?`<p class="snc-sel-campanha"><b>${f.posicao?`${f.posicao}º`:'—'}</b><small>salão</small><b>${f.vitorias}<i>V</i> ${f.derrotas}<i>D</i></b><small>campanha</small></p><canvas class="snc-sel-taco" data-snc-taco="${safeText(f.taco||'casa')}" aria-hidden="true"></canvas>`:''}</div></section>`;
}
// Cada regra é uma ficha de jogo: um clique troca (são sempre duas opções).
const SINUCA_SEL_ICONE={FORMATO:'👥',MODALIDADE:'🎱','MULTA DA FALTA':'⚠️','BOLA DO OUTRO':'🎯'};
function sinucaSelSeletor(rotulo,valor,ant,prox,dica){
 return `<button type="button" class="snc-sel-ficha" onclick="${prox}" title="Clique para trocar"><i>${SINUCA_SEL_ICONE[rotulo]||'◆'}</i><small>${rotulo}</small><b>${valor}</b>${dica?`<span>${dica}</span>`:''}<em aria-hidden="true">⟳</em></button>`;
}
function sinucaCasaTrocar(campo){
 const f=escritorioXadrez().nova;if(!f)return;const c=f.casa||(f.casa={multa:1,doOutro:'falta',modo:'parimpar'});
 if(campo==='modo'){if(f.dupla)return escritorioAviso('A dupla é no par ou ímpar.');c.modo=c.modo==='bolavez'?'parimpar':'bolavez';}
 else if(campo==='multa')c.multa=c.multa===2?1:2;
 else c.doOutro=c.doOutro==='livre'?'falta':'livre';
 desenharNovoSinuca();
}
function sinucaApostaFicha(v){const f=escritorioXadrez().nova,saldo=Number(escritorio.base?.economia?.saldo||0);if(!f)return;f.moedas=Math.max(0,Math.min(saldo,v));desenharNovoSinuca();}
function desenharNovoSinuca(){
 const x=escritorioXadrez(),f=x.nova;if(!f)return;const pessoas=mesaPessoasParaChamar(),saldo=Number(escritorio.base?.economia?.saldo||0),rival=pessoas.find(p=>String(p.id)===String(f.para)),meus=xadrezMeusItens();
 const fichas=x.extras?.jogo==='sinuca'?x.extras.bots?.salao?.fichas||{}:{},eu=String(escritorio.base?.eu||'');
 const c=f.casa||(f.casa={multa:1,doOutro:'falta',modo:'parimpar'});c.modo||='parimpar';
 // A fileira de jogadores (como a seleção de personagem).
 const fileira=f.dupla?`<div class="snc-sel-dupla">${sinucaDuplaEscolhaHtml(f,pessoas)}</div>`:`<div class="snc-sel-fileira" role="radiogroup" aria-label="Escolha seu adversário">${pessoas.map(p=>{const fi=fichas[String(p.id)],sel=String(p.id)===f.para,u=escritorioCabecaUrl?.(p.id);return `<button type="button" role="radio" aria-checked="${sel}" class="snc-sel-carta${sel?' selecionado':''}${p.online?' online':''}" onclick="escolherRivalXadrez('${safeText(String(p.id))}')"><span class="snc-sel-carta-foto">${u?`<img src="${safeText(u)}" alt="">`:`<i>${safeText(String(p.nome||'?')[0])}</i>`}</span><b>${xadrezPrimeiroNome(p)}</b><small>${p.online?'● no escritório':'recebe no sino'}</small>${fi?.titulo?`<em class="${safeText(fi.titulo.raridade)}">${safeText(fi.titulo.nome)}</em>`:''}</button>`;}).join('')||'<p class="snc-vazio">Não há outra pessoa na equipe para convidar.</p>'}</div>`;
 const regras=[sinucaSelSeletor('FORMATO',f.dupla?'DUPLA 2×2':'1 × 1',`sinucaFormato(${!f.dupla})`,`sinucaFormato(${!f.dupla})`,f.dupla?'Você + parceiro contra dois':'Você contra um'),
  f.dupla?'':sinucaSelSeletor('MODALIDADE',c.modo==='bolavez'?'BOLA DA VEZ':'PAR OU ÍMPAR',"sinucaCasaTrocar('modo')","sinucaCasaTrocar('modo')",c.modo==='bolavez'?'7 bolas, pontos de 1 a 7':'Regra de bar, o ás no fim'),
  c.modo==='bolavez'?'':sinucaSelSeletor('MULTA DA FALTA',`${c.multa} BOLA${c.multa>1?'S':''}`,"sinucaCasaTrocar('multa')","sinucaCasaTrocar('multa')",'Bater direto na do outro: sempre 2'),
  c.modo==='bolavez'?'':sinucaSelSeletor('BOLA DO OUTRO',c.doOutro==='livre'?'LIVRE':'É FALTA',"sinucaCasaTrocar('doOutro')","sinucaCasaTrocar('doOutro')",c.doOutro==='livre'?'Caiu junto: só passa a vez':'Caiu junto: multa e passa a vez')].join('');
 const valor=`<div class="snc-sel-valor${f.valendo?' valendo':''}"><button type="button" class="snc-sel-ficha vale" onclick="modoXadrez(${!f.valendo})" title="Clique para trocar"><i>${f.valendo?'💰':'🍻'}</i><small>VALE</small><b>${f.valendo?`${Number(f.moedas||0).toLocaleString('pt-BR')} 🪙`:'A RESENHA'}</b><span>${f.valendo?(f.dupla?'Cada um põe; a dupla que ganha divide':'Cada um põe; quem ganha leva tudo'):'De graça: só vale a vitória'}</span><em aria-hidden="true">⟳</em></button>
${f.valendo?`<div class="snc-sel-fichas">${[10,50,100,500].filter(v=>v<=saldo).map(v=>`<button type="button" class="ficha" aria-pressed="${Number(f.moedas)===v}" onclick="sinucaApostaFicha(${v})">${v}</button>`).join('')}<input aria-label="Moedas da aposta" type="number" min="0" max="${saldo}" step="1" value="${f.moedas}" oninput="escritorioXadrez().nova.moedas=Math.max(0,Math.min(${saldo},Math.floor(Number(this.value)||0)));atualizarBotaoXadrez()"><small>saldo ${saldo.toLocaleString('pt-BR')}</small></div>${f.dupla?'':`<details class="snc-sel-itens"><summary>Apostar móveis ou roupas</summary><div class="ofc-troca-montar"><section><h3>Você oferece</h3>${meus.length?`<ul>${meus.map(i=>xadrezItemHtml('oferece',i)).join('')}</ul>`:'<p>Nenhum item disponível.</p>'}</section><section><h3>Você pede</h3>${f.deles===null?'<p>Selecione alguém para carregar os itens.</p>':f.deles.length?`<ul>${f.deles.map(i=>xadrezItemHtml('pede',i)).join('')}</ul>`:'<p>Nenhum item disponível.</p>'}</section></div></details>`}`:''}</div>`;
 xadrezModal(`<div class="snc-sala snc-sel">${sinucaCabecalhoHtml('Preparar desafio')}
<div class="snc-sel-palco">${sinucaSelRetrato({id:eu,nome:escritorio.base?.nome||'Você'},fichas[eu],'eu')}
<div class="snc-sel-centro"><b class="snc-sel-vs">VS</b><div class="snc-sel-regras">${regras}</div>${valor}<p id="xdz-erro" class="ofc-erro" role="alert"></p></div>
${f.dupla?sinucaSelRetrato(null,null,'rival','2 contra 2'):sinucaSelRetrato(rival,rival?fichas[String(rival.id)]:null,'rival')}</div>
${fileira}
<footer class="snc-sel-pe"><button class="snc-btn secundario" onclick="abrirSalaMesa()">◀ SALÃO</button><button class="snc-btn snc-sel-desafiar" id="xdz-chamar" onclick="desafiarXadrezEscritorio(this)">DESAFIAR ▸</button></footer>
</div>`,'ofc-xdz-novo');atualizarBotaoXadrez();sinucaTacosVitrine(document.querySelector('.snc-sel')||document);
}
// SINUCA EM DUPLA (Paulo, 04/11/2026): você + o parceiro contra dois. A ordem
// dos lugares define a dupla e o rodízio: você (A1), o 1º adversário (B1), o
// parceiro (A2) e o 2º adversário (B2) — por isso o convite vai como
// para = 1º adversário e mais = [parceiro, 2º adversário].
function sinucaFormato(dupla){
 const f=escritorioXadrez().nova;if(!f)return;
 f.dupla=Boolean(dupla);f.parceiro=null;f.advs=[];f.grupo=[];f.para='';f.pede=new Map();f.oferece=new Map();f.deles=null;
 if(f.dupla){f.casa=f.casa||{multa:1,doOutro:'falta',modo:'parimpar'};f.casa.modo='parimpar';}
 desenharNovoSinuca();
}
function sinucaEscolherDupla(papel,id){
 const f=escritorioXadrez().nova;if(!f)return;id=String(id);f.advs||=[];
 if(papel==='parceiro'){f.parceiro=f.parceiro===id?null:id;f.advs=f.advs.filter(x=>x!==id);}
 else if(f.advs.includes(id))f.advs=f.advs.filter(x=>x!==id);
 else if(f.advs.length<2){f.advs.push(id);if(f.parceiro===id)f.parceiro=null;}
 else return escritorioAviso('Já são dois adversários: tire um para trocar.');
 const pronto=f.parceiro&&f.advs.length===2;
 f.grupo=pronto?[f.advs[0],f.parceiro,f.advs[1]]:[];f.para=pronto?f.advs[0]:'';
 desenharNovoSinuca();
}
function sinucaDuplaEscolhaHtml(f,pessoas){
 const carta=(p,papel,marcado,extra='')=>`<button type="button" role="${papel==='parceiro'?'radio':'checkbox'}" aria-checked="${marcado}" class="snc-colega ${marcado?'selecionado':''} ${p.online?'online':''}" onclick="sinucaEscolherDupla('${papel}','${safeText(String(p.id))}')"${extra}>${sinucaPessoaHtml(p)}<span>${xadrezPrimeiroNome(p)}<small>${p.online?'No escritório':'Recebe no sino'}</small></span><i>${marcado?'✓':'+'}</i></button>`;
 const advs=f.advs||[];
 const parceiros=pessoas.map(p=>carta(p,'parceiro',String(p.id)===f.parceiro)).join('');
 const rivais=pessoas.filter(p=>String(p.id)!==f.parceiro).map(p=>carta(p,'adv',advs.includes(String(p.id)))).join('');
 const nome=(id)=>xadrezPrimeiroNome(pessoas.find(p=>String(p.id)===id));
 const resumo=f.parceiro&&advs.length===2?`<p class="snc-dupla-resumo"><b>Você e ${nome(f.parceiro)}</b> contra <b>${nome(advs[0])} e ${nome(advs[1])}</b>. A vez roda: você → ${nome(advs[0])} → ${nome(f.parceiro)} → ${nome(advs[1])}.</p>`:'<p class="snc-dupla-resumo">Escolha o parceiro e os dois adversários.</p>';
 return `<h3 class="snc-dupla-titulo">Seu parceiro</h3><div class="snc-equipe escolha" role="radiogroup" aria-label="Escolha seu parceiro">${parceiros||'<p class="snc-vazio">Não há outra pessoa na equipe.</p>'}</div><h3 class="snc-dupla-titulo">Os adversários <small>${advs.length}/2</small></h3><div class="snc-equipe escolha" role="group" aria-label="Escolha os dois adversários">${rivais}</div>${resumo}`;
}
// As regras da casa do convite: a multa da falta e a bola do outro que cai junto.
function sinucaCasaHtml(f){
 const c=f.casa||(f.casa={multa:1,doOutro:'falta',modo:'parimpar'});c.modo||='parimpar';
 const op=(campo,valor,titulo,texto)=>`<button type="button" role="radio" aria-checked="${c[campo]===valor}" onclick="escritorioXadrez().nova.casa.${campo}=${JSON.stringify(valor).replace(/"/g,"'")};desenharNovoSinuca()"><b>${titulo}</b><small>${texto}</small></button>`;
 const modalidade=`<div class="snc-modos" role="radiogroup" aria-label="Modalidade">${op('modo','parimpar','PAR OU ÍMPAR','Regra de bar: grupos e o ás no fim')}${f.dupla?'':op('modo','bolavez','BOLA DA VEZ','Sinuca brasileira: 7 bolas, pontos de 1 a 7')}</div>`;
 if(c.modo==='bolavez')return `<div class="snc-casa">${modalidade}<p class="snc-casa-nota">Bata sempre primeiro na menor bola da mesa. Encaçapou, marca o valor dela e continua. Falta dá 7 pontos ao outro. Acabaram as bolas, ganha quem tem mais pontos.</p></div>`;
 return `<div class="snc-casa">${modalidade}<div class="snc-modos" role="radiogroup" aria-label="Multa da falta">${op('multa',1,'MULTA DE 1 BOLA','Falta tira uma bola do outro')}${op('multa',2,'MULTA DE 2 BOLAS','Falta tira duas bolas do outro')}<small class="snc-casa-nota">Bater direto na bola do outro é sempre multa de 2 bolas.</small></div><div class="snc-modos" role="radiogroup" aria-label="Bola do outro que cai junto">${op('doOutro','falta','BOLA DO OUTRO É FALTA','Caiu a do outro junto: multa e passa a vez')}${op('doOutro','livre','BOLA DO OUTRO LIVRE','Caiu a do outro: fica fora e passa a vez')}</div></div>`;
}
// Convite recebido como tela de jogo (Paulo, 08/11/2026: "abre tudo, cada menu"):
// o cartão de quem chamou (título com o que quer dizer, campanha, taco e as
// conquistas mais raras), o que vale a partida, as regras da casa em placas e o
// relógio do convite. Antes era um título e um botão numa tela vazia.
function desenharConviteSinuca(j,cfg){
 const x=escritorioXadrez(),fichas=x.extras?.jogo==='sinuca'?x.extras.bots?.salao?.fichas||{}:{},p=j.desafiante||{},f=fichas[String(p.id)]||null;
 const lado={p,bot:false,f,retrato:escritorioCabecaUrl?.(p.id)||'',taco:f?.taco||'casa',nome:p.nome||xadrezPrimeiroNome(p)};
 const cartao=typeof sinucaConfrontoCartao==='function'?sinucaConfrontoCartao(j,lado,null,'esq'):'';
 const c=regrasDaCasaTela(j.mesa?.casa||j.casa);
 const regras=[c.modo==='bolavez'?['🎱','Bola da vez','7 bolas, pontos de 1 a 7']:['🎱','Par ou ímpar','Regra de bar, o ás no fim'],c.modo==='bolavez'?['⚠️','Falta','7 pontos para o outro']:['⚠️',`Multa de ${c.multa} bola${c.multa>1?'s':''}`,'Por falta'],c.modo==='bolavez'?null:['🎯',c.doOutro==='livre'?'Bola do outro livre':'Bola do outro é falta',c.doOutro==='livre'?'Só passa a vez':'Multa e passa a vez']].filter(Boolean);
 xadrezModal(`<div class="snc-sala snc-convite">${sinucaCabecalhoHtml('Convite para a mesa')}<div class="snc-convite-palco">${cartao||`<div class="snc-duelo recebido">${sinucaPessoaHtml(p)}</div>`}
<main class="snc-convite-lado"><small class="snc-convite-kicker">O DESAFIO ESTÁ LANÇADO</small><h1>TE CHAMOU<br>PRA MESA.</h1>${mesaPrazoHtml(j.convite_ate)}
<section><h3>VALENDO</h3>${xadrezApostaHtml(j,'desafiado')||'<p class="snc-convite-amistoso">Amistoso: só a honra (e a ficha do bar).</p>'}</section>
<section><h3>REGRAS DA CASA</h3><ul class="snc-convite-regras">${regras.map(([i,t,d])=>`<li><i>${i}</i><b>${safeText(t)}</b><small>${safeText(d)}</small></li>`).join('')}</ul><details class="snc-regras-convite"><summary>Ler a regra inteira</summary><p>${safeText(cfg.nota)}</p></details></section>
<p class="ofc-erro" id="xdz-erro" role="alert"></p>
<footer class="snc-convite-acoes"><button class="snc-btn secundario" onclick="responderXadrezEscritorio('${safeText(j.id)}','recusar',this)">Agora não</button><button class="snc-btn" onclick="responderXadrezEscritorio('${safeText(j.id)}','aceitar',this)">ACEITAR E JOGAR ▸</button></footer></main></div></div>`,'ofc-xdz-convite');
 sinucaTacosVitrine(document.querySelector('.snc-convite')||document);
}
// As regras da casa como a tela mostra (mesmo padrão do servidor).
function regrasDaCasaTela(c){return {multa:Number(c?.multa)===2?2:1,doOutro:c?.doOutro==='livre'?'livre':'falta',modo:c?.modo==='bolavez'?'bolavez':'parimpar'};}
function sinucaBannerHtml(cfg,titulo,texto){return `${sinucaCabecalhoHtml(titulo)}<p class="snc-vazio">${safeText(texto||'')}</p>`;}
function sinucaAlternarSom(){alternarSomEscritorio();if(!escritorioSomLigado())sinucaAudioSilenciar();else sinucaAudioPreparar(true);}
function sinucaCreditosHtml(){return `<details class="snc-creditos"><summary>Créditos dos sons e da arte</summary><p>Gravações de bilhar: <a href="https://freesound.org/people/Za-Games/sounds/539854/" target="_blank" rel="noopener noreferrer">Billiard ball clack — Za-Games</a> e <a href="https://directory.audio/sound-effects/sports/15767-pool-table-ball-hit-sink" target="_blank" rel="noopener noreferrer">Pool table ball hit sink — AmberdeMeillon</a> (CC0). Este jogo contém <a href="https://directory.audio/sound-effects/sports/26417-pool-cue-hitting-ball" target="_blank" rel="noopener noreferrer">Pool cue hitting ball</a> e <a href="https://directory.audio/sound-effects/sports/26225-pool-ball-bouncing-off-a-rail-of-a-pool-table" target="_blank" rel="noopener noreferrer">Pool ball bouncing off a rail of a pool table</a>, do catálogo Directory.Audio, sob <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>. Trechos recortados, convertidos para mono, com filtro e fade; sem endosso dos autores. Arte da mesa enviada por Paulo; cenário e emblema gerados para a Vybe; fotos do Baianinho, do Zé e do Tio enviadas por Paulo.</p></details>`;}
function sinucaTopoHtml(nome,assistindo,selos,botoes,fechar){
 const acoes=botoes.replace(/(<button\b[^>]*title="([^"]+)"[^>]*>)[\s\S]*?(<\/button>)/g,'$1$2$3');
 return `<header class="jogo-topo tema-sinuca"><div class="snc-marca">${sinucaMarcaHtml()}</div><div class="jogo-selos">${selos}${assistindo?'<span class="jogo-selo">Assistindo</span>':''}</div><details class="snc-menu"><summary>☰ <span>MENU</span></summary><div class="snc-menu-lista"><b>A MESA É SUA</b><button onclick="sinucaAba('regras');this.closest('details').open=false">Como jogar</button><button onclick="sinucaAba('lousa');this.closest('details').open=false">Placar e histórico</button><button onclick="sinucaAlternarSom();this.textContent=escritorioSomLigado()?'Desligar som':'Ligar som'">${escritorioSomLigado()?'Desligar som':'Ligar som'}</button>${acoes}<button onclick="${fechar}">Voltar ao salão</button></div></details></header>`;
}
// O caderno começa fechado (Paulo, 08/11/2026: "ainda parece dashboard"): a aba abre o
// painel e clicar de novo na aberta fecha. O que aconteceu na tacada já sai no anúncio.
function sinucaAba(aba){
 if(!['partida','lousa','regras','torcida'].includes(aba))return;
 const s=sinucaEstado();if(s.aba===aba&&document.querySelector(`[data-snc-painel="${aba}"]`)?.hidden===false)aba=null;s.aba=aba;
 document.querySelector('.snc-caderno')?.classList.toggle('aberto',Boolean(aba));
 for(const el of document.querySelectorAll('[data-snc-aba]')){const ativa=el.dataset.sncAba===aba;el.setAttribute('aria-selected',String(ativa));el.tabIndex=ativa||(!aba&&el.dataset.sncAba==='partida')?0:-1;}
 for(const el of document.querySelectorAll('[data-snc-painel]'))el.hidden=el.dataset.sncPainel!==aba;
}
function sinucaAbaFechar(){const s=sinucaEstado();if(s.aba)sinucaAba(s.aba);}
function sinucaAbasTecla(ev){const abas=['partida','torcida','lousa','regras'],atual=abas.indexOf(ev.target.dataset.sncAba);if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const n=ev.key==='Home'?0:ev.key==='End'?abas.length-1:(atual+(ev.key==='ArrowRight'?1:abas.length-1))%abas.length;sinucaAba(abas[n]);document.querySelector(`[data-snc-aba="${abas[n]}"]`)?.focus();}
function sinucaPainelHtml(j,s,q,ultimo){
 // Torcida (Paulo, 08/11/2026): apostas de quem assiste e de quem joga (vybe-escritorio-sinuca-confronto.js).
 const aba=s.aba||null,nomes={partida:'A partida',...(j.torcida&&typeof sinucaTorcidaHtml==='function'?{torcida:'Torcida'}:{}),lousa:'Placar do bar',regras:'Como jogar'},caiu=j.mesa.bolas.map((p,n)=>!p&&n&&(j.mesa.modo!=='bolavez'||n<=7)?n:null).filter(n=>n!==null);
 return `<section class="snc-caderno${aba?' aberto':''}"><button type="button" class="snc-caderno-fechar" onclick="sinucaAbaFechar()" aria-label="Fechar painel">×</button><nav class="snc-abas" role="tablist" aria-label="Informações da sinuca" onkeydown="sinucaAbasTecla(event)">${Object.entries(nomes).map(([id,nome])=>`<button role="tab" id="snc-aba-${id}" aria-controls="snc-painel-${id}" aria-selected="${aba===id}" tabindex="${aba===id||(!aba&&id==='partida')?0:-1}" data-snc-aba="${id}" onclick="sinucaAba('${id}')">${nome}${id==='torcida'?'<em></em>':''}</button>`).join('')}<span>PAR OU ÍMPAR · REGRA DE BAR</span></nav><div class="snc-painel" role="tabpanel" id="snc-painel-partida" aria-labelledby="snc-aba-partida" data-snc-painel="partida" ${aba==='partida'?'':'hidden'}><div class="snc-ultima"><small>ÚLTIMA TACADA</small><p data-snc-relato aria-live="polite">${safeText(ultimo||'Mesa aberta. Quem encaçapa primeiro define os grupos.')}</p></div><div class="snc-encacapadas"><small>NA CAÇAPA</small><div class="snc-tubo">${caiu.map(n=>{const v=sinucaVisual(j.mesa.modo,n);return `<i class="${v.listra?'listra':''}" style="--c:${v.cor}" title="Bola ${n}">${n}</i>`;}).join('')||'<span>Nenhuma ainda</span>'}</div></div></div><div class="snc-painel" role="tabpanel" id="snc-painel-lousa" aria-labelledby="snc-aba-lousa" data-snc-painel="lousa" ${aba==='lousa'?'':'hidden'}>${sinucaLousaHtml(j,q)||'<div class="snc-vazio"><h3>O placar fica no giz.</h3><p>Histórico e ranking aparecem nas partidas com a equipe.</p></div>'}</div><div class="snc-painel snc-regras" role="tabpanel" id="snc-painel-regras" aria-labelledby="snc-aba-regras" data-snc-painel="regras" ${aba==='regras'?'':'hidden'}><article><small>01 · MIRE</small><h3>Escolha a direção.</h3><p>Clique no pano para mirar. A direção fica fixa ao ir até os controles. No celular, toque e arraste para mirar. Use as setas para o ajuste fino.</p></article><article><small>02 · DOSE</small><h3>Sinta a tacada.</h3><p>Um clique na barra só escolhe a força. Arraste e solte para tacar, ou informe de 0,1% a 100% e use TACAR. Na mesa, puxe para trás e solte. Toques sem arrasto não disparam.</p></article><article><small>03 · FECHE</small><h3>Limpe a mesa.</h3><p>${j.mesa.modo==='bolavez'?'Bola da vez: bata sempre primeiro na menor bola da mesa. Encaçapou, marca o valor dela (1 a 7) e continua. Falta (suicida, cegar, bater ou encaçapar outra bola) dá 7 pontos ao outro, e a bola errada volta para a marca. Acabaram as bolas, ganha quem tem mais pontos.':j.mesa.modo==='parimpar'?'Primeira bola: par (lisas) ou ímpar (listradas). Limpe seu grupo e mate a 1. Matar bola do outro, mesmo junto com a sua, é falta. Toda falta tira mais uma bola do outro e passa a vez; nada volta. Na suicida a branca vai para o D.'+(j.mesa.casa?` <b>Regras desta mesa:</b> multa de ${j.mesa.casa.multa} bola${j.mesa.casa.multa>1?'s':''}; bola do outro que cai junto ${j.mesa.casa.doOutro==='livre'?'fica fora e só passa a vez':'é falta'}.`:''):'Limpe seu grupo e encaçape a 8. Falta dá bola na mão ao outro.'}</p></article>${sinucaCreditosHtml()}</div>${nomes.torcida?`<div class="snc-painel" role="tabpanel" id="snc-painel-torcida" aria-labelledby="snc-aba-torcida" data-snc-painel="torcida" ${aba==='torcida'?'':'hidden'}>${sinucaTorcidaHtml(j)}</div>`:''}</section>`;
}
// Fim de partida como tela de jogo (Paulo, 08/11/2026: "abre tudo, cada menu"):
// VITÓRIA, DERROTA ou EMPATE em letra de placar, o motivo, o prêmio em ouro e os
// números dos dois na partida (mesa.stats), lado a lado nas cores de cada um.
function sinucaFimHtml(j,acoes,{titulo,premio,ganhou,perdeu}){
 const st=j.mesa?.stats||{},lados=['desafiante','desafiado'].filter(l=>j[l]);
 const num=(l,c)=>Number(st[l]?.[c]||0);
 const linhas=[['Bolas suas',(l)=>num(l,'b')],['Maior sequência',(l)=>num(l,'maxSeq')],['Numa tacada só',(l)=>num(l,'uma')],['Faltas',(l)=>num(l,'faltas')],['Suicidas',(l)=>num(l,'suic')],['Tacadas',(l)=>num(l,'t')]];
 const tem=lados.some(l=>st[l]);
 const numeros=tem?`<table class="snc-fim-numeros"><thead><tr><th></th>${lados.map(l=>`<th class="${l}">${safeText(xadrezPrimeiroNome(j[l]))}</th>`).join('')}</tr></thead><tbody>${linhas.map(([n,f])=>`<tr><td>${n}</td>${lados.map(l=>`<td class="${l}">${f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'';
 const tipo=ganhou?'ganhou':perdeu?'perdeu':'empate';
 return `<div class="jogo-fim ${tipo}"><div class="jogo-fim-caixa snc-resultado snc-fim"><small class="snc-fim-motivo">${safeText(j.motivo_nome||'Fim de jogo')}</small><b class="snc-fim-palavra">${ganhou?'VITÓRIA':perdeu?'DERROTA':'EMPATE'}</b><p class="snc-fim-frase">${safeText(titulo)} · ${ganhou?'Hoje o boteco é seu.':perdeu?'A próxima mesa é outra história.':'Essa ficou pra resenha.'}</p>${premio?`<span class="snc-fim-premio">${safeText(premio)}</span>`:''}${numeros}<div class="snc-fim-acoes">${acoes}</div></div></div>`;
}

// FICHA DO BAR (Paulo, 04/11/2026: "os tacos fodas também têm que aparecer no
// perfil de cada jogador... ver os troféus que o outro cara tem... ter o perfil
// do cara no bar"). A ficha vem do servidor (fichaSinuca): números, coleção de
// tacos e troféus. Abre por cima de tudo, no placar da partida e no salão.
// FICHA DO BAR COMO CARTA DE JOGADOR (Paulo, 08/11/2026: "quero tudo parecendo
// JOGO... não quero as coisas parecendo site, dashboard"). Nada de tabela nem
// lista: à esquerda a carta colecionável (moldura da raridade do título com
// brilho, nota geral, retrato, título explicado e seis atributos); à direita a
// parede de tacos (os tacos em pé, como no bar), a estante de medalhas (as
// conquistas; passar o mouse diz o que é cada uma) e o mural das zoeiras.
const SINUCA_ATRIBUTOS = [["pre", "PRE", "Precisão: bolas suas por tacada"], ["seq", "SEQ", "Sequência: o máximo de bolas seguidas"], ["sai", "SAI", "Saída: bolas matadas na saída"], ["lim", "LIM", "Jogo limpo: poucas faltas"], ["vit", "VIT", "Vitórias: aproveitamento"], ["exp", "EXP", "Experiência: partidas jogadas"]];
function sinucaFichaHtml(nome, ficha, retrato, extra = "") {
 const f = ficha || { vitorias: 0, derrotas: 0, jogos: 0, posicao: null, maior_sequencia: 0, bots: {}, tacos: ["casa"], taco: "casa", trofeus: [] };
 const rar = f.titulo?.raridade || "comum", nota = f.nota ?? null, at = f.atributos || null;
 const legenda = (t) => `onmouseenter="sinucaFichaLegenda(this,'${safeText(String(t.nome).replace(/'/g, "’"))}','${safeText(String(t.texto).replace(/'/g, "’"))}')" onfocus="this.onmouseenter()"`;
 const tacos = Object.entries(SINUCA_TACOS).map(([k, t]) => { const tem = f.tacos.includes(k); return `<li class="${tem ? "tem" : "falta"}${f.taco === k ? " usando" : ""}" tabindex="0" onclick="this.onmouseenter()" ${legenda({ nome: `Taco ${t.nome}`, texto: f.taco === k ? "Na mão" : tem ? "Na coleção" : t.requisito })}><canvas data-snc-taco="${k}" aria-hidden="true"></canvas><b>${safeText(t.nome)}</b></li>`; }).join("");
 const boas = f.trofeus.filter((t) => !t.zoeira), RAR = { lendario: 4, epico: 3, raro: 2, comum: 1 };
 const medalhas = [...boas].sort((a, b) => (b.tem - a.tem) || ((RAR[b.raridade] || 1) - (RAR[a.raridade] || 1))).map((t) => `<li class="${t.tem ? "tem" : "falta"} ${safeText(t.raridade)}" tabindex="0" onclick="this.onmouseenter()" ${legenda(t)}><i>${t.tem ? t.icone : "?"}</i>${t.vezes > 1 ? `<em>×${t.vezes}</em>` : ""}<b>${safeText(t.nome)}</b></li>`).join("");
 const zoeiras = f.trofeus.filter((t) => t.zoeira && t.tem);
 const mural = zoeiras.length ? zoeiras.map((t, i) => `<li style="--g:${(i % 3 - 1) * 3}deg" tabindex="0" onclick="this.onmouseenter()" ${legenda(t)}><i>${t.icone}</i><b>${safeText(t.nome)}</b><small>${safeText(t.texto)}</small></li>`).join("") : '<li class="limpo"><b>Ficha limpa</b><small>Nenhuma zoeira no mural (por enquanto).</small></li>';
 const derrubou = ["facil", "medio", "lendario"].filter((n) => f.bots?.[n]).length;
 return `<div class="snc-perfil-caixa snc-cf" role="dialog" aria-modal="true" aria-label="Ficha do bar de ${safeText(nome)}">
<button type="button" class="snc-perfil-fechar" onclick="sinucaFichaFechar()" aria-label="Fechar ficha">×</button>
<div class="snc-cf-carta ${safeText(rar)}"><span class="snc-cf-brilho" aria-hidden="true"></span>
<div class="snc-cf-topo"><b>${nota ?? "—"}</b><small>GERAL</small><em>${f.posicao ? `${f.posicao}º` : "—"}</em><small>SALÃO</small></div>
<div class="snc-cf-foto">${retrato ? `<img src="${safeText(retrato)}" alt="">` : `<i>${safeText(String(nome || "?")[0])}</i>`}</div>
<h2 class="snc-cf-nome">${safeText(String(nome || "").split(" ")[0])}</h2>
<div class="snc-cf-titulo"><b>${safeText(f.titulo?.nome || "Estreante")}</b><span>${safeText(f.titulo?.texto || "Ganhe a primeira partida para ter um título.")}</span></div>
${at ? `<ul class="snc-cf-atributos">${SINUCA_ATRIBUTOS.map(([k, sig, txt]) => `<li title="${safeText(txt)}"><b>${at[k]}</b><small>${sig}</small></li>`).join("")}</ul>` : ""}
<div class="snc-cf-rodape"><span><b>${f.vitorias}</b>V</span><span><b>${f.derrotas}</b>D</span><span><b>${f.maior_sequencia}</b>SÉRIE</span><span><b>${derrubou}/3</b>DONOS</span></div>
${extra}</div>
<div class="snc-cf-estante">
<p class="snc-cf-legenda" aria-live="polite"><b>Toque ou passe o mouse</b> numa peça para ver o que ela é.</p>
<section class="snc-cf-parede"><h3>PAREDE DE TACOS <small>${f.tacos.length}/${Object.keys(SINUCA_TACOS).length}</small></h3><ul>${tacos}</ul></section>
<section class="snc-cf-medalhas"><h3>ESTANTE DE CONQUISTAS <small>${boas.filter((t) => t.tem).length}/${boas.length}</small></h3><ul>${medalhas}</ul></section>
<section class="snc-cf-mural"><h3>MURAL DA ZOEIRA <small>${zoeiras.length}</small></h3><ul>${mural}</ul></section>
</div></div>`;
}
function sinucaFichaLegenda(el, nome, texto) {
 const p = el.closest(".snc-cf")?.querySelector(".snc-cf-legenda");
 if (p) p.innerHTML = `<b>${nome}</b> ${texto}`;
}
function sinucaFichaAbrir(nome, ficha, retrato, extra) {
 sinucaFichaFechar();
 const el = document.createElement("div");
 el.className = "snc-perfil"; el.onclick = (ev) => { if (ev.target === el) sinucaFichaFechar(); };
 el.innerHTML = sinucaFichaHtml(nome, ficha, retrato, extra);
 document.body.appendChild(el); sinucaTacosVitrine(el); el.querySelector(".snc-perfil-fechar")?.focus();
}
function sinucaFichaFechar() { document.querySelector(".snc-perfil")?.remove(); }
if (typeof document !== "undefined") document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && document.querySelector(".snc-perfil")) { ev.stopPropagation(); sinucaFichaFechar(); } }, true);
// Ficha de quem está na partida (o card do placar abre).
function sinucaFichaDaMesa(lado) {
 const s = sinucaEstado(), j = s.jogo, p = j?.[lado];
 if (!p) return;
 if (j.bot && String(p.id) === "bot") {
  const nivel = j.bot.nivel || String(j.bot.id).split(":")[1], taco = sinucaTacoModelo(j, lado);
  return sinucaFichaAbrir(j.bot.nome || p.nome, { vitorias: 0, derrotas: 0, jogos: 0, posicao: null, maior_sequencia: 0, bots: {}, tacos: Object.keys(SINUCA_TACOS).slice(0, Object.keys(SINUCA_TACOS).indexOf(taco) + 1), taco, trofeus: [] }, sinucaRetrato(nivel), `<p class="snc-perfil-frase">“${safeText(p.frase || j.bot.frase || "")}”</p>`);
 }
 sinucaFichaAbrir(p.nome || xadrezPrimeiroNome(p), sinucaFichas(j)?.[String(p.id)], mesaCabecaUrl(j, p));
}
const sinucaFichas = (j) => j?.fichas || (sinucaEstado().fichas?.id === j?.id ? sinucaEstado().fichas.lista : null);
// O ranking do salão como placar de jogo: pódio com os três primeiros (o 1º no
// meio, mais alto), cada um com a cabeça, o placar e o taco na mão; do 4º em
// diante, em linhas.
function sinucaSalaoHtml() {
 const x = escritorioXadrez(), salao = x.extras?.jogo === "sinuca" ? x.extras.bots?.salao : null;
 const topo = '<div class="snc-painel-topo"><div><small>QUEM MANDA NO TACO</small><h2>Ranking do salão</h2></div></div>';
 if (!salao) return `${topo}<p class="snc-vazio">Carregando o ranking…</p>`;
 const eu = String(escritorio.base?.eu || ""), lista = salao.ranking?.lista || [];
 if (!lista.length) return `${topo}<p class="snc-vazio">Ninguém ganhou ainda. A primeira vitória põe seu nome aqui.</p>`;
 const taco = (r) => safeText(salao.fichas?.[r.id]?.taco || "casa");
 const trofeus = (r) => (salao.fichas?.[r.id]?.trofeus || []).filter((t) => t.tem).slice(0, 4).map((t) => t.icone).join("");
 const degrau = (r) => r ? `<button type="button" class="snc-degrau p${r.posicao}${r.id === eu ? " eu" : ""}" onclick="sinucaFichaDoSalao('${safeText(r.id)}')"><span class="snc-degrau-cabeca">${sinucaPessoaHtml({ id: r.id, nome: r.nome })}</span><b>${safeText(String(r.nome).split(" ")[0])}</b><small>${r.vitorias}V · ${r.derrotas}D</small>${salao.fichas?.[r.id]?.titulo ? `<small class="snc-degrau-titulo ${safeText(salao.fichas[r.id].titulo.raridade)}">${safeText(salao.fichas[r.id].titulo.nome)}</small>` : ""}<canvas data-snc-taco="${taco(r)}" aria-hidden="true"></canvas><i>${trofeus(r)}</i><em>${r.posicao}</em></button>` : "<span></span>";
 const [p1, p2, p3] = lista;
 const resto = lista.slice(3, 10).map((r) => `<li class="${r.id === eu ? "eu" : ""}"><button type="button" onclick="sinucaFichaDoSalao('${safeText(r.id)}')"><em>${r.posicao}º</em>${sinucaPessoaHtml({ id: r.id, nome: r.nome })}<b>${safeText(String(r.nome).split(" ")[0])}</b><small>${r.vitorias}V · ${r.derrotas}D</small><canvas data-snc-taco="${taco(r)}" aria-hidden="true"></canvas></button></li>`).join("");
 return `${topo}<div class="snc-podio">${degrau(p2)}${degrau(p1)}${degrau(p3)}</div>${resto ? `<ol class="snc-placar-lista">${resto}</ol>` : ""}`;
}
function sinucaFichaDoSalao(id) {
 const salao = escritorioXadrez().extras?.bots?.salao, r = salao?.ranking?.lista?.find((p) => p.id === String(id));
 sinucaFichaAbrir(r?.nome || (String(id) === String(escritorio.base?.eu) ? "Você" : "Jogador"), salao?.fichas?.[String(id)], escritorioCabecaUrl(id));
}
