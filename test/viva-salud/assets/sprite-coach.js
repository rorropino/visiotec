/* Viva la Salud · Sprite animator using 30 hand-picked AI illustration frames.
   Five rows × six columns; no third-party animation service and no per-frame network requests. */
(function(){
'use strict';
const atlas = new Image();
atlas.decoding='async';
atlas.src='./assets/media/viva-sprites-clean.webp?v=7';
const cw=270,ch=285,frames=6,rows={march:0,squat:1,pushup:2,bridge:3,birddog:4};
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
let canvas=null,ctx=null,active=false,mode='march',changedAt=0,intervalId=0,lastFrame=-1,lastMode='';
function draw(now){
 if(!active)return;
 if(document.hidden)return;
 if(!canvas||!ctx||!atlas.complete||!atlas.naturalWidth)return;
 const frame=reduce.matches?0:Math.floor((now-changedAt)/360)%frames;
 if(frame!==lastFrame||lastMode!==mode){
  ctx.clearRect(0,0,480,300);

  const row=rows[mode]??0;
  ctx.drawImage(atlas,frame*cw,row*ch,cw,ch,97,0,286,300);
  lastFrame=frame;lastMode=mode;
 }

}
function start(id){canvas=document.getElementById(id);ctx=canvas?.getContext('2d',{alpha:true})||null;if(!ctx)return false;active=true;mode='march';lastMode='';changedAt=performance.now();lastFrame=-1;clearInterval(intervalId);draw(performance.now());intervalId=setInterval(()=>draw(performance.now()),110);return true;}
function setMode(name){const next=Object.prototype.hasOwnProperty.call(rows,name)?name:'march';if(mode!==next){mode=next;changedAt=performance.now();lastFrame=-1;draw(performance.now());}return true;}
function stop(){active=false;clearInterval(intervalId);intervalId=0;ctx=null;canvas=null;}
function getInfo(){return {loaded:atlas.complete&&atlas.naturalWidth>0,mode,active,frames,width:atlas.naturalWidth,height:atlas.naturalHeight};}
window.VivaSprite={start,setMode,stop,getInfo,hasMode:key=>Object.prototype.hasOwnProperty.call(rows,key)};
})();