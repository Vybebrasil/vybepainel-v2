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
function desenharLobbySinuca(d,cfg){
 const x=escritorioXadrez(),aba=x.sinucaSecao||'sala',online=mesaPessoasParaChamar(),saldo=escritorio.base?.economia?.saldo;
 mesaLerExtras(cfg);
 // Cada carta diz quem é a pessoa no bar (Paulo, 08/11/2026: melhorar a UX de todos os menus): título, campanha e o taco.
 const fichasSalao=x.extras?.bots?.salao?.fichas||{};
 const equipe=online.slice(0,12).map(p=>{const f=fichasSalao[String(p.id)];return `<button type="button" class="snc-carta-pessoa ${p.online?'online':''}" onclick="novoXadrez(null);escolherRivalXadrez('${safeText(String(p.id))}')"><span class="snc-carta-cabeca">${sinucaPessoaHtml(p)}</span><b>${xadrezPrimeiroNome(p)}</b><small>${p.online?'No escritório':'Convidar'}</small>${f?`<span class="snc-carta-ficha"><i class="${safeText(f.titulo?.raridade||'comum')}">${safeText(f.titulo?.nome||'Estreante')}</i><span>${f.vitorias}V · ${f.derrotas}D${f.posicao?` · ${f.posicao}º`:''}</span><canvas data-snc-taco="${safeText(f.taco||'casa')}" aria-hidden="true"></canvas></span>`:''}<em>DESAFIAR</em></button>`;}).join('');
 const aoVivo=d.mesa?`<button type="button" class="snc-ao-vivo" onclick="mesaAssistir()"><i></i>AO VIVO · ${xadrezPrimeiroNome(d.mesa.desafiante)} × ${xadrezPrimeiroNome(d.mesa.desafiado)}<b>ASSISTIR</b></button>`:'';
 const temporada=mesaTemporadaHtml(cfg);
 const painel=aba==='sala'?`<div class="snc-painel-topo"><div><small>A DISPUTA FICA MELHOR COM COMPANHIA</small><h2>Quem vai pra mesa?</h2></div><button class="snc-btn" onclick="novoXadrez(null)">DESAFIAR UM AMIGO</button></div><div class="snc-cartas-pessoas">${equipe||'<p class="snc-vazio">Ninguém mais na equipe por enquanto. Treine na Jornada dos bares.</p>'}</div>`
  :aba==='desafios'?sinucaBotsHtml(cfg)
  :aba==='ranking'?sinucaSalaoHtml()
  :aba==='conquistas'?sinucaConquistasHtml()
  :`<div class="snc-painel-topo"><div><small>A GLÓRIA DO BOTECO</small><h2>Seu nome no topo.</h2></div></div>${temporada||'<div class="snc-vazio"><p>Temporada indisponível no momento.</p><button class="snc-btn secundario" onclick="escritorioXadrez().extras=null;mesaLerExtras(mesaCfg())">Atualizar temporada</button></div>'}`;
 xadrezModal(`<div class="snc-sala snc-jogo-menu"><div class="snc-cena" aria-hidden="true"></div>
<header class="snc-menu-topo tema-sinuca"><div class="snc-marca">${sinucaMarcaHtml()}</div>${sinucaBannerJogador(saldo)}<button type="button" class="snc-icone" aria-label="Fechar sinuca" onclick="xadrezFechar()">×</button></header>
<nav class="snc-menu-principal" aria-label="Menu da sinuca"><h1>RESPEITA<br>O <em>TACO.</em></h1>${SINUCA_MENU.map(([id,nome,sub,ic])=>`<button type="button" class="snc-opcao" aria-pressed="${aba===id}" onclick="sinucaLobbySecao('${id}')">${sinucaIcone(ic)}<span><b>${nome}</b><small>${sub}</small></span></button>`).join('')}<small class="snc-menu-regra">PAR OU ÍMPAR · REGRA DE BAR</small></nav>
<main class="snc-menu-painel" data-aba="${aba}">${sinucaConvitesHtml(d)}${aoVivo}${painel}<p class="ofc-erro" id="xdz-erro" role="alert"></p>${sinucaCreditosHtml()}</main></div>`,'ofc-xdz-sala');
 mesaLobbyRelogio();
 sinucaTacosVitrine(document.querySelector('.snc-sala')||document);
}
function desenharNovoSinuca(){
 const x=escritorioXadrez(),f=x.nova;if(!f)return;const pessoas=mesaPessoasParaChamar(),saldo=Number(escritorio.base?.economia?.saldo||0),rival=pessoas.find(p=>String(p.id)===String(f.para)),meus=xadrezMeusItens();
 const lista=pessoas.map(p=>`<button type="button" role="radio" aria-checked="${String(p.id)===f.para}" class="snc-colega ${String(p.id)===f.para?'selecionado':''} ${p.online?'online':''}" onclick="escolherRivalXadrez('${safeText(String(p.id))}')">${sinucaPessoaHtml(p)}<span>${xadrezPrimeiroNome(p)}<small>${p.online?'No escritório':'Recebe no sino'}</small></span><i>${String(p.id)===f.para?'✓':'+'}</i></button>`).join('');
 const aposta=!f.valendo?'':`<section class="snc-aposta"><label class="snc-aposta-moedas"><span>Cada jogador põe em moedas<small>Seu saldo: ${saldo.toLocaleString('pt-BR')}</small></span><input aria-label="Moedas da aposta" type="number" min="0" max="${saldo}" step="1" value="${f.moedas}" oninput="escritorioXadrez().nova.moedas=Math.max(0,Math.min(${saldo},Math.floor(Number(this.value)||0)));atualizarBotaoXadrez()"></label>${f.dupla?'':'<details><summary>Apostar móveis ou roupas</summary>'}<div class="ofc-troca-montar"><section><h3>Você oferece</h3>${meus.length?`<ul>${meus.map(i=>xadrezItemHtml('oferece',i)).join('')}</ul>`:'<p>Nenhum item disponível.</p>'}</section><section><h3>Você pede</h3>${f.deles===null?'<p>Selecione alguém para carregar os itens.</p>':f.deles.length?`<ul>${f.deles.map(i=>xadrezItemHtml('pede',i)).join('')}</ul>`:'<p>Nenhum item disponível.</p>'}</section></div>${f.dupla?'':'</details>'}<p>${f.dupla?'Os quatro precisam aceitar. Cada um põe as mesmas moedas; a dupla que ganha divide o pote.':'Os dois precisam aceitar. Quem vence leva o que estiver na mesa.'}</p></section>`;
 xadrezModal(`<div class="snc-sala">${sinucaCabecalhoHtml('Preparar desafio')}<div class="snc-duelo"><img src="/assets/jogos/sinuca-emblema.webp" alt=""><small>CHAMA QUEM AGUENTA</small><h1>FECHA COM QUEM?</h1><p>${rival?`${xadrezPrimeiroNome(rival)} do outro lado. Agora acerte a disputa.`:'Escolha o adversário. O resto vocês resolvem no pano.'}</p></div><main class="snc-sala-corpo"><div class="snc-passo"><b>01</b><h2>${f.dupla?'Monte a dupla':'Escolha o rival'}</h2><small>Quem estiver fora recebe no sino.</small></div><div class="snc-formato" role="radiogroup" aria-label="Formato da partida"><button type="button" role="radio" aria-checked="${!f.dupla}" onclick="sinucaFormato(false)"><b>1 × 1</b><small>Você contra um</small></button><button type="button" role="radio" aria-checked="${Boolean(f.dupla)}" onclick="sinucaFormato(true)"><b>DUPLA</b><small>2 contra 2, jogando alternado</small></button></div>${f.dupla?sinucaDuplaEscolhaHtml(f,pessoas):`<div class="snc-equipe escolha" role="radiogroup" aria-label="Escolha seu adversário">${lista||'<p class="snc-vazio">Não há outra pessoa na equipe para convidar.</p>'}</div>`}<div class="snc-passo"><b>02</b><h2>Regras da casa</h2><small>Cada bar tem a sua. Combine antes.</small></div>${sinucaCasaHtml(f)}<div class="snc-passo"><b>03</b><h2>Quanto vale a partida?</h2></div><div class="snc-modos" role="radiogroup" aria-label="Modo do desafio"><button type="button" role="radio" aria-checked="${!f.valendo}" onclick="modoXadrez(false)"><span>◉</span><b>PELA RESENHA</b><small>De graça. Só vale a vitória.</small></button><button type="button" role="radio" aria-checked="${f.valendo}" onclick="modoXadrez(true)"><span>◆</span><b>VALENDO</b><small>${f.dupla?'Moedas: a dupla que ganha divide o pote.':'Moedas, móveis ou roupas.'}</small></button></div>${aposta}<p id="xdz-erro" class="ofc-erro" role="alert"></p></main><footer class="snc-sala-pe"><button class="snc-btn secundario" onclick="abrirSalaMesa()">← Voltar ao salão</button><button class="snc-btn" id="xdz-chamar" onclick="desafiarXadrezEscritorio(this)">ENVIAR DESAFIO ↗</button></footer></div>`,'ofc-xdz-novo');atualizarBotaoXadrez();
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
function desenharConviteSinuca(j,cfg){
 xadrezModal(`<div class="snc-sala">${sinucaCabecalhoHtml('Convite para a mesa')}<div class="snc-duelo recebido">${sinucaPessoaHtml(j.desafiante)}<small>O DESAFIO ESTÁ LANÇADO</small><h1>${xadrezPrimeiroNome(j.desafiante).toUpperCase()}<br>TE CHAMOU.</h1><p>Uma boa disputa está esperando você.</p>${mesaPrazoHtml(j.convite_ate)}</div><main class="snc-sala-corpo">${xadrezApostaHtml(j,'desafiado')}<details class="snc-regras-convite"><summary>As regras desta mesa</summary><p>${safeText(cfg.nota)}</p></details><p class="ofc-erro" id="xdz-erro" role="alert"></p></main><footer class="snc-sala-pe"><button class="snc-btn secundario" onclick="responderXadrezEscritorio('${safeText(j.id)}','recusar',this)">Agora não</button><button class="snc-btn" onclick="responderXadrezEscritorio('${safeText(j.id)}','aceitar',this)">ACEITAR E JOGAR ↗</button></footer></div>`,'ofc-xdz-convite');
}
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
 for(const el of document.querySelectorAll('[data-snc-aba]')){const ativa=el.dataset.sncAba===aba;el.setAttribute('aria-selected',String(ativa));el.tabIndex=ativa||(!aba&&el.dataset.sncAba==='partida')?0:-1;}
 for(const el of document.querySelectorAll('[data-snc-painel]'))el.hidden=el.dataset.sncPainel!==aba;
 if(aba!=='partida')document.querySelector(`[data-snc-painel="${aba}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function sinucaAbasTecla(ev){const abas=['partida','torcida','lousa','regras'],atual=abas.indexOf(ev.target.dataset.sncAba);if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;ev.preventDefault();const n=ev.key==='Home'?0:ev.key==='End'?abas.length-1:(atual+(ev.key==='ArrowRight'?1:abas.length-1))%abas.length;sinucaAba(abas[n]);document.querySelector(`[data-snc-aba="${abas[n]}"]`)?.focus();}
function sinucaPainelHtml(j,s,q,ultimo){
 // Torcida (Paulo, 08/11/2026): apostas de quem assiste e de quem joga (vybe-escritorio-sinuca-confronto.js).
 const aba=s.aba||null,nomes={partida:'A partida',...(j.torcida&&typeof sinucaTorcidaHtml==='function'?{torcida:'Torcida'}:{}),lousa:'Placar do bar',regras:'Como jogar'},caiu=j.mesa.bolas.map((p,n)=>!p&&n&&(j.mesa.modo!=='bolavez'||n<=7)?n:null).filter(n=>n!==null);
 return `<section class="snc-caderno"><nav class="snc-abas" role="tablist" aria-label="Informações da sinuca" onkeydown="sinucaAbasTecla(event)">${Object.entries(nomes).map(([id,nome])=>`<button role="tab" id="snc-aba-${id}" aria-controls="snc-painel-${id}" aria-selected="${aba===id}" tabindex="${aba===id||(!aba&&id==='partida')?0:-1}" data-snc-aba="${id}" onclick="sinucaAba('${id}')">${nome}${id==='torcida'?'<em></em>':''}</button>`).join('')}<span>PAR OU ÍMPAR · REGRA DE BAR</span></nav><div class="snc-painel" role="tabpanel" id="snc-painel-partida" aria-labelledby="snc-aba-partida" data-snc-painel="partida" ${aba==='partida'?'':'hidden'}><div class="snc-ultima"><small>ÚLTIMA TACADA</small><p data-snc-relato aria-live="polite">${safeText(ultimo||'Mesa aberta. Quem encaçapa primeiro define os grupos.')}</p></div><div class="snc-encacapadas"><small>NA CAÇAPA</small><div class="snc-tubo">${caiu.map(n=>{const v=sinucaVisual(j.mesa.modo,n);return `<i class="${v.listra?'listra':''}" style="--c:${v.cor}" title="Bola ${n}">${n}</i>`;}).join('')||'<span>Nenhuma ainda</span>'}</div></div></div><div class="snc-painel" role="tabpanel" id="snc-painel-lousa" aria-labelledby="snc-aba-lousa" data-snc-painel="lousa" ${aba==='lousa'?'':'hidden'}>${sinucaLousaHtml(j,q)||'<div class="snc-vazio"><h3>O placar fica no giz.</h3><p>Histórico e ranking aparecem nas partidas com a equipe.</p></div>'}</div><div class="snc-painel snc-regras" role="tabpanel" id="snc-painel-regras" aria-labelledby="snc-aba-regras" data-snc-painel="regras" ${aba==='regras'?'':'hidden'}><article><small>01 · MIRE</small><h3>Escolha a direção.</h3><p>Clique no pano para mirar. A direção fica fixa ao ir até os controles. No celular, toque e arraste para mirar. Use as setas para o ajuste fino.</p></article><article><small>02 · DOSE</small><h3>Sinta a tacada.</h3><p>Um clique na barra só escolhe a força. Arraste e solte para tacar, ou informe de 0,1% a 100% e use TACAR. Na mesa, puxe para trás e solte. Toques sem arrasto não disparam.</p></article><article><small>03 · FECHE</small><h3>Limpe a mesa.</h3><p>${j.mesa.modo==='bolavez'?'Bola da vez: bata sempre primeiro na menor bola da mesa. Encaçapou, marca o valor dela (1 a 7) e continua. Falta (suicida, cegar, bater ou encaçapar outra bola) dá 7 pontos ao outro, e a bola errada volta para a marca. Acabaram as bolas, ganha quem tem mais pontos.':j.mesa.modo==='parimpar'?'Primeira bola: par (lisas) ou ímpar (listradas). Limpe seu grupo e mate a 1. Matar bola do outro, mesmo junto com a sua, é falta. Toda falta tira mais uma bola do outro e passa a vez; nada volta. Na suicida a branca vai para o D.'+(j.mesa.casa?` <b>Regras desta mesa:</b> multa de ${j.mesa.casa.multa} bola${j.mesa.casa.multa>1?'s':''}; bola do outro que cai junto ${j.mesa.casa.doOutro==='livre'?'fica fora e só passa a vez':'é falta'}.`:''):'Limpe seu grupo e encaçape a 8. Falta dá bola na mão ao outro.'}</p></article>${sinucaCreditosHtml()}</div>${nomes.torcida?`<div class="snc-painel" role="tabpanel" id="snc-painel-torcida" aria-labelledby="snc-aba-torcida" data-snc-painel="torcida" ${aba==='torcida'?'':'hidden'}>${sinucaTorcidaHtml(j)}</div>`:''}</section>`;
}
function sinucaFimHtml(j,acoes,{titulo,premio,ganhou,perdeu}){return `<div class="jogo-fim ${ganhou?'ganhou':perdeu?'perdeu':'empate'}"><div class="jogo-fim-caixa snc-resultado"><img src="/assets/jogos/sinuca-emblema.webp" alt=""><small>${safeText(j.motivo_nome||'Fim de jogo')}</small><b>${safeText(titulo)}</b><p>${ganhou?'HOJE O BOTECO É SEU.':perdeu?'A PRÓXIMA MESA É OUTRA HISTÓRIA.':'ESSA FICOU PRA RESENHA.'}</p>${premio?`<span>${safeText(premio)}</span>`:''}${acoes}</div></div>`;}

// FICHA DO BAR (Paulo, 04/11/2026: "os tacos fodas também têm que aparecer no
// perfil de cada jogador... ver os troféus que o outro cara tem... ter o perfil
// do cara no bar"). A ficha vem do servidor (fichaSinuca): números, coleção de
// tacos e troféus. Abre por cima de tudo, no placar da partida e no salão.
function sinucaFichaHtml(nome, ficha, retrato, extra = "") {
 const f = ficha || { vitorias: 0, derrotas: 0, jogos: 0, posicao: null, maior_sequencia: 0, bots: {}, tacos: ["casa"], taco: "casa", trofeus: [] };
 const aprov = f.jogos ? Math.round((100 * f.vitorias) / f.jogos) : 0, ganhos = f.trofeus.filter((t) => t.tem).length;
 const derrubou = ["facil", "medio", "lendario"].filter((n) => f.bots?.[n]).length;
 const tacos = Object.entries(SINUCA_TACOS).map(([k, t]) => { const tem = f.tacos.includes(k); return `<li class="${tem ? "tem" : "falta"}${f.taco === k ? " usando" : ""}"><canvas data-snc-taco="${k}" aria-hidden="true"></canvas><span><b>${safeText(t.nome)}</b><small>${f.taco === k ? "Na mão" : tem ? "Na coleção" : safeText(t.requisito)}</small></span></li>`; }).join("");
 // Conquistas por raridade (as que tem primeiro) e as zoeiras à parte (Paulo, 08/11/2026).
 const RAR = { lendario: 4, epico: 3, raro: 2, comum: 1 }, item = (t) => `<li class="${t.tem ? "tem" : "falta"} ${safeText(t.raridade || "comum")}" title="${safeText(t.texto)}"><i>${t.icone}</i><b>${safeText(t.nome)}${t.vezes > 1 ? ` <em>×${t.vezes}</em>` : ""}</b><small>${safeText(t.texto)}</small></li>`;
 const boas = f.trofeus.filter((t) => !t.zoeira).sort((a, b) => (b.tem - a.tem) || ((RAR[b.raridade] || 1) - (RAR[a.raridade] || 1)));
 const zoeiras = f.trofeus.filter((t) => t.zoeira).sort((a, b) => b.tem - a.tem);
 const trofeus = boas.map(item).join(""), zoeirasHtml = zoeiras.map(item).join("");
 return `<div class="snc-perfil-caixa" role="dialog" aria-modal="true" aria-label="Ficha do bar de ${safeText(nome)}">
<button type="button" class="snc-perfil-fechar" onclick="sinucaFichaFechar()" aria-label="Fechar ficha">×</button>
<header class="snc-perfil-topo tema-sinuca">${retrato ? `<img src="${safeText(retrato)}" alt="">` : `<i class="snc-inicial">${safeText(String(nome || "?")[0])}</i>`}<div><small>FICHA DO BAR</small><h2>${safeText(nome)}</h2>${f.titulo || f.apelido ? `<p class="snc-perfil-titulos">${f.titulo ? `<b class="${safeText(f.titulo.raridade)}">${safeText(f.titulo.nome)}</b>` : ""}${f.apelido ? `<em title="Zoeira do bar">${f.apelido.icone} ${safeText(f.apelido.nome)}</em>` : ""}</p>` : ""}<p>${f.posicao ? `<em class="snc-perfil-pos">${f.posicao}º do salão</em>` : '<em class="snc-perfil-pos sem">Fora do ranking</em>'}<span>Taco ${safeText(SINUCA_TACOS[f.taco]?.nome || "da Casa")}</span></p>${extra}</div></header>
<canvas class="snc-perfil-taco" data-snc-taco="${safeText(f.taco)}" aria-hidden="true"></canvas>
<dl class="snc-perfil-numeros"><div><dt>Vitórias</dt><dd>${f.vitorias}</dd></div><div><dt>Derrotas</dt><dd>${f.derrotas}</dd></div><div><dt>Aproveitamento</dt><dd>${aprov}%</dd></div><div><dt>Maior sequência</dt><dd>${f.maior_sequencia}</dd></div><div><dt>Donos derrubados</dt><dd>${derrubou}/3</dd></div></dl>
<section><h3>Coleção de tacos <small>${f.tacos.length}/${Object.keys(SINUCA_TACOS).length}</small></h3><ul class="snc-perfil-tacos">${tacos}</ul></section>
<section><h3>Conquistas <small>${boas.filter((t) => t.tem).length}/${boas.length}</small></h3><ul class="snc-perfil-trofeus">${trofeus}</ul></section>${zoeiras.length ? `<section><h3>Zoeira do bar <small>${zoeiras.filter((t) => t.tem).length}/${zoeiras.length}</small></h3><ul class="snc-perfil-trofeus zoeira">${zoeirasHtml}</ul></section>` : ""}</div>`;
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
