// Gravações de bilhar, separadas dos impactos genéricos dos outros jogos.
// Créditos e recortes: assets/jogos/sons/SINUCA-LICENCA.md.
const SINUCA_SONS={taco:'sinuca-taco',bola:'sinuca-bola',tabela:'sinuca-tabela',cacapa:'sinuca-cacapa'};
let sinucaAudio=null;
function sinucaAudioLigado(){return typeof escritorioSomLigado!=='function'||escritorioSomLigado();}
function sinucaAudioPreparar(gesto=false){
 if(!sinucaAudioLigado())return null;
 try{
  if(!sinucaAudio){
   const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
   const ctx=new C(),master=ctx.createGain(),limite=ctx.createDynamicsCompressor();
   master.gain.value=.8;limite.threshold.value=-12;limite.knee.value=12;limite.ratio.value=8;limite.attack.value=.003;limite.release.value=.12;master.connect(limite).connect(ctx.destination);
   sinucaAudio={ctx,master,buffers:{},vozes:new Set()};
   for(const [tipo,nome] of Object.entries(SINUCA_SONS)){
    sinucaAudio.buffers[tipo]=(async()=>{
     for(const ext of ['ogg','mp3'])try{const r=await fetch(`/assets/jogos/sons/${nome}.${ext}`);if(!r.ok)continue;return await ctx.decodeAudioData(await r.arrayBuffer());}catch{ /* tenta o formato compatível */ }
     return null;
    })();
   }
  }
  if(gesto&&sinucaAudio.ctx.state==='suspended')sinucaAudio.ctx.resume().catch(()=>{});
  return sinucaAudio;
 }catch{return null;}
}
function sinucaSom(tipo,intensidade=.5){
 if(!SINUCA_SONS[tipo]||!sinucaAudioLigado())return;
 const a=sinucaAudioPreparar();if(!a)return;
 const em=performance.now(),f=Math.max(0,Math.min(1,Number(intensidade)||0));
 // Contatos leves continuam audíveis sem soar como uma saída forte.
 const volume=(tipo==='cacapa'?.56:tipo==='tabela'?.48:tipo==='taco'?.62:.72)*Math.sqrt(f);
 if(!volume)return;
 a.buffers[tipo]?.then(buffer=>{
  // Um download atrasado não deve tocar a tacada que já passou, nem ignorar mute.
  if(!buffer||!sinucaAudioLigado()||a.ctx.state!=='running'||performance.now()-em>100)return;
  if(a.vozes.size>=24){const antiga=a.vozes.values().next().value;antiga.stop();a.vozes.delete(antiga);}
  // Nenhuma batida igual à outra: altura ±5% (a caçapa um pouco mais grave) e volume ±10%.
  const fonte=a.ctx.createBufferSource(),ganho=a.ctx.createGain();fonte.buffer=buffer;ganho.gain.value=volume*(0.9+Math.random()*0.2);
  fonte.playbackRate.value=(tipo==='cacapa'?0.94:1)+(Math.random()-0.5)*0.1;
  fonte.connect(ganho).connect(a.master);a.vozes.add(fonte);fonte.onended=()=>{a.vozes.delete(fonte);fonte.disconnect();ganho.disconnect();};fonte.start();
 });
}
function sinucaAudioSilenciar(){if(sinucaAudio)for(const voz of sinucaAudio.vozes){voz.stop();}sinucaAudio?.vozes.clear();}
if(typeof document!=='undefined'){
 document.addEventListener('pointerdown',ev=>{if(ev.target?.closest?.('.ofc-snc-jogo,.ofc-snc-menu'))sinucaAudioPreparar(true);},{capture:true});
 document.addEventListener('keydown',ev=>{if(ev.target?.closest?.('.ofc-snc-jogo,.ofc-snc-menu'))sinucaAudioPreparar(true);},{capture:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)sinucaAudioSilenciar();});
}
// SOM AMBIENTE DO BOTECO (Paulo, 11/11/2026: "boteco vivo"): conversa de bar baixinha e um copo
// tilintando de vez em quando, sintetizados aqui (sem arquivo de áudio de terceiros). Cala quando a TV do
// bar está tocando música, quando o som do escritório está desligado, com a aba escondida ou fora da sinuca.
let sinucaAmb=null;
function sinucaAmbienteQuer(){
 if(typeof document==='undefined'||document.hidden||!sinucaAudioLigado())return false;
 if(!document.querySelector('#workflow-modal.ofc-snc-jogo,#workflow-modal.ofc-snc-menu'))return false;
 const tv=document.querySelector('.ofc-musica.na-tv');
 return !(tv&&!tv.hidden&&typeof escritorio!=='undefined'&&escritorio.musica?.tocando);
}
function sinucaAmbiente(){
 if(!sinucaAmbienteQuer()){
  if(sinucaAmb){const a=sinucaAmb;sinucaAmb=null;clearInterval(a.copos);a.ganho.gain.setTargetAtTime(0,a.ctx.currentTime,.25);setTimeout(()=>{try{a.fonte.stop();a.lfo.stop();}catch{/* já parou */}a.ganho.disconnect();},1500);}
  return;
 }
 if(sinucaAmb)return;
 const a=sinucaAudioPreparar();if(!a||a.ctx.state!=='running')return;
 const ctx=a.ctx,n=ctx.sampleRate*4,buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
 // Ruído rosa (a "massa" de conversa), recortado na faixa da voz e respirando devagar.
 let b0=0,b1=0,b2=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;d[i]=(b0+b1+b2+w*.1848)*.12;}
 const fonte=ctx.createBufferSource();fonte.buffer=buf;fonte.loop=true;
 const banda=ctx.createBiquadFilter();banda.type='bandpass';banda.frequency.value=480;banda.Q.value=.8;
 const mod=ctx.createGain();mod.gain.value=.6;const lfo=ctx.createOscillator();lfo.frequency.value=.3;const lfoG=ctx.createGain();lfoG.gain.value=.35;lfo.connect(lfoG).connect(mod.gain);
 const ganho=ctx.createGain();ganho.gain.value=0;fonte.connect(banda).connect(mod).connect(ganho).connect(a.master);fonte.start();lfo.start();
 ganho.gain.setTargetAtTime(.07,ctx.currentTime,1.2);
 const copo=()=>{
  if(sinucaAmb?.ganho!==ganho||Math.random()<.45)return;
  const t=ctx.currentTime;
  for(const f of [2300+Math.random()*900,3800+Math.random()*700]){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f;g.gain.setValueAtTime(.01,t);g.gain.exponentialRampToValueAtTime(.0001,t+.45);o.connect(g).connect(a.master);o.start(t);o.stop(t+.5);o.onended=()=>{o.disconnect();g.disconnect();};}
 };
 sinucaAmb={ctx,fonte,lfo,ganho,copos:setInterval(copo,5200)};
}
if(typeof window!=='undefined'&&!window.__sinucaAmbiente){window.__sinucaAmbiente=setInterval(sinucaAmbiente,2500);}
