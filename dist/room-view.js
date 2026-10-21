(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.AfterhoursView=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class Camera{
    constructor(){this.x=750;this.y=530;this.zoom=1.6;this.width=900;this.height=500;this.follow=false;}
    get scale(){return Math.min(this.width/1500,this.height/1000)*this.zoom;}
    project(x,y){return{x:this.width/2+(x-this.x)*this.scale,y:this.height/2+(y-this.y)*this.scale};}
    unproject(x,y){return{x:(x-this.width/2)/this.scale+this.x,y:(y-this.height/2)/this.scale+this.y};}
    constrain(){
      const halfX=this.width/this.scale/2,halfY=this.height/this.scale/2;
      this.x=halfX>=750?750:Math.max(halfX,Math.min(1500-halfX,this.x));
      this.y=halfY>=500?500:Math.max(halfY,Math.min(1000-halfY,this.y));
    }
    track(x,y,dt,reduced=false){
      if(!this.follow)return;
      const p=this.project(x,y),mx=Math.min(180,this.width*.26),my=Math.min(150,this.height*.32);
      const dx=p.x<mx?p.x-mx:p.x>this.width-mx?p.x-(this.width-mx):0;
      const dy=p.y<my?p.y-my:p.y>this.height-my?p.y-(this.height-my):0;
      const amount=reduced?1:1-Math.exp(-7*dt);
      this.x+=dx/this.scale*amount;this.y+=dy/this.scale*amount;this.constrain();
    }
  }
  // Bubbles stay where they were spoken and climb one line per new message in the room,
  // or every few seconds when it is quiet, so a conversation reads as one rising column.
  class Speech{
    constructor(){this.entries=[];this.last=new Map();this.step=0;this.stepped=0;}
    add(id,name,text,until,mode='say',now=Date.now(),at=null,color=null){
      if(!text||until<=now||mode==='whisper')return;
      const key=until+':'+text;
      if(this.last.get(id)===key)return;
      this.last.set(id,key);this.step++;this.stepped=now;
      this.entries.push({key:id+'|'+key,id,name,text:String(text).slice(0,160),until,mode,born:this.step,at,color});
      this.entries=this.entries.filter(e=>e.until>now).slice(-12);
    }
    active(now=Date.now()){
      this.entries=this.entries.filter(e=>e.until>now);
      if(this.entries.length&&now-this.stepped>=Speech.idle){this.step++;this.stepped=now;}
      return this.entries.map(e=>({...e,lift:this.step-e.born}));
    }
    clear(){this.entries=[];this.last.clear();}
  }
  Speech.idle=4000;
  // Gestures hold each pose for 125 ms (8 fps), like sprite animation, while walking stays smooth.
  const DANCE=[[0,-.06],[-5,0],[0,.06],[-5,0]];
  const dancePose=t=>{const [bob,tilt]=DANCE[Math.floor(t/125)%4];return{bob,tilt};};
  const wavePose=t=>Math.floor(t/125)%2?.35:-.2;
  // Ordered dither: quantise a 0..1 intensity to a few steps with a 4x4 Bayer threshold per cell.
  const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const dither=(x,y,value,levels=3)=>Math.min(1,Math.floor(value*levels+(BAYER[(y&3)*4+(x&3)]+.5)/16)/levels);
  const pools=new Map();
  function lightPool(color='255,170,54',cells=64){
    const key=color+':'+cells;if(pools.has(key))return pools.get(key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=cells;
    const g=canvas.getContext('2d'),img=g.createImageData(cells,cells),[r,gr,b]=color.split(',').map(Number);
    for(let y=0;y<cells;y++)for(let x=0;x<cells;x++){
      const f=Math.max(0,1-Math.hypot(x+.5-cells/2,y+.5-cells/2)/(cells/2)),i=(y*cells+x)*4;
      img.data[i]=r;img.data[i+1]=gr;img.data[i+2]=b;img.data[i+3]=Math.round(dither(x,y,f*f)*255);
    }
    g.putImageData(img,0,0);pools.set(key,canvas);return canvas;
  }
  // Short cues mixed around -18 dB, so arrivals are heard without competing with the music.
  const CUES={arrive:['square',[[659,0],[988,.09]]],pop:['square',[[523,0],[784,.05]]],ring:['square',[[784,0],[622,.24]]],knock:['triangle',[[120,0],[120,.16]]]};
  let audio=null;
  function cue(kind){
    if(!CUES[kind]||(navigator.userActivation&&!navigator.userActivation.hasBeenActive))return;
    try{
      audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});
      const [type,notes]=CUES[kind],now=audio.currentTime;
      for(const [freq,at] of notes){
        const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;
        g.gain.setValueAtTime(.0001,now+at);g.gain.exponentialRampToValueAtTime(.125,now+at+.008);g.gain.exponentialRampToValueAtTime(.0001,now+at+.18);
        o.connect(g).connect(audio.destination);o.start(now+at);o.stop(now+at+.2);
      }
    }catch{}
  }
  function mount(canvas){
    const camera=new Camera(),speech=new Speech(),nodes=new Map(),LINE=36;
    const overlay=document.createElement('div');overlay.className='speech-layer';overlay.setAttribute('aria-hidden','true');canvas.parentElement.append(overlay);
    const resize=()=>{
      const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
      camera.width=rect.width;camera.height=rect.height;
      canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));camera.constrain();
    };
    new ResizeObserver(resize).observe(canvas);resize();
    if(camera.width<500){camera.zoom=2.4;camera.constrain();}
    function begin(ctx,x,y,dt,reduced){
      camera.track(x,y-60,dt,reduced);
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.setTransform(canvas.width/camera.width,0,0,canvas.height/camera.height,0,0);
      ctx.translate(camera.width/2,camera.height/2);ctx.scale(camera.scale,camera.scale);ctx.translate(-camera.x,-camera.y);
    }
    function note(p,x,y,self){
      const id=self?'self':p.id||'resident:'+p.name;
      speech.add(id,p.name,p.bubble,p.until,p.bubbleMode,Date.now(),{x,y:y-(self?140:125)},p.chatColor);
    }
    function end(){
      const active=speech.active().reverse(),visible=new Set(),placed=[];
      // Newest first: older bubbles yield upward, out through the top of the room.
      for(const entry of active){
        if(!entry.at)continue;visible.add(entry.key);
        let node=nodes.get(entry.key);
        if(!node){
          node=document.createElement('div');node.className='speech-bubble'+(entry.mode==='shout'?' shout':'');if(entry.color)node.style.setProperty('--name',entry.color);
          const name=document.createElement('b'),text=document.createElement('span');name.textContent=entry.name;text.textContent=entry.text;node.append(name,text);overlay.append(node);nodes.set(entry.key,node);
        }
        const p=camera.project(entry.at.x,entry.at.y),w=node.offsetWidth,h=node.offsetHeight;
        const x=Math.max(8,Math.min(camera.width-w-8,p.x-w/2)),base=Math.min(camera.height-h-8,p.y-h-12);
        let y=base-entry.lift*LINE;
        for(const other of placed){if(x<other.x+other.w+8&&x+w+8>other.x&&y<other.y+other.h+6&&y+h+6>other.y)y=other.y-h-6;}
        node.style.transform=`translate(${Math.round(x)}px,${Math.round(base)}px)`;node.style.translate=`0 ${Math.round(y-base)}px`;
        node.classList.toggle('risen',y<base);placed.push({x,y,w,h});
      }
      for(const [id,node] of nodes)if(!visible.has(id)){nodes.delete(id);node.classList.add('leaving');setTimeout(()=>node.remove(),140);}
    }
    function reset(){speech.clear();nodes.forEach(n=>n.remove());nodes.clear();camera.x=750;camera.y=530;camera.follow=false;camera.constrain();}
    return{camera,begin,note,end,reset,resize};
  }
  return{Camera,Speech,mount,dancePose,wavePose,dither,lightPool,cue};
});
