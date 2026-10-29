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
  const fonte=a.ctx.createBufferSource(),ganho=a.ctx.createGain();fonte.buffer=buffer;ganho.gain.value=volume;
  fonte.connect(ganho).connect(a.master);a.vozes.add(fonte);fonte.onended=()=>{a.vozes.delete(fonte);fonte.disconnect();ganho.disconnect();};fonte.start();
 });
}
function sinucaAudioSilenciar(){if(sinucaAudio)for(const voz of sinucaAudio.vozes){voz.stop();}sinucaAudio?.vozes.clear();}
if(typeof document!=='undefined'){
 document.addEventListener('pointerdown',ev=>{if(ev.target?.closest?.('.ofc-snc-jogo,.ofc-snc-menu'))sinucaAudioPreparar(true);},{capture:true});
 document.addEventListener('keydown',ev=>{if(ev.target?.closest?.('.ofc-snc-jogo,.ofc-snc-menu'))sinucaAudioPreparar(true);},{capture:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)sinucaAudioSilenciar();});
}
