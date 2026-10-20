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
  class Speech{
    constructor(){this.groups=new Map();}
    add(id,name,text,until,mode='say',now=Date.now()){
      if(!text||until<=now||mode==='whisper')return;
      let group=this.groups.get(id);
      if(!group){group={id,name,entries:[],last:''};this.groups.set(id,group);}
      const key=until+':'+text;
      if(group.last===key)return;
      group.last=key;group.name=name;
      group.entries.push({key,text:String(text).slice(0,160),until,mode});
      group.entries=group.entries.filter(e=>e.until>now).slice(-2);
    }
    active(now=Date.now()){
      for(const [id,g] of this.groups){g.entries=g.entries.filter(e=>e.until>now);if(!g.entries.length)this.groups.delete(id);}
      return [...this.groups.values()];
    }
    clear(){this.groups.clear();}
  }
  function mount(canvas){
    const camera=new Camera(),speech=new Speech(),nodes=new Map(),anchors=new Map();
    const overlay=document.createElement('div');overlay.className='speech-layer';overlay.setAttribute('aria-hidden','true');canvas.parentElement.append(overlay);
    const resize=()=>{
      const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
      camera.width=rect.width;camera.height=rect.height;
      canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));camera.constrain();
    };
    new ResizeObserver(resize).observe(canvas);resize();
    if(camera.width<500){camera.zoom=2.4;camera.constrain();}
    function begin(ctx,x,y,dt,reduced){
      camera.track(x,y-60,dt,reduced);anchors.clear();
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.setTransform(canvas.width/camera.width,0,0,canvas.height/camera.height,0,0);
      ctx.translate(camera.width/2,camera.height/2);ctx.scale(camera.scale,camera.scale);ctx.translate(-camera.x,-camera.y);
    }
    function note(p,x,y,self){
      const id=self?'self':p.id||'resident:'+p.name;
      anchors.set(id,{...camera.project(x,y-125),self});
      speech.add(id,p.name,p.bubble,p.until,p.bubbleMode);
    }
    function end(){
      const active=speech.active(),visible=new Set(),placed=[];
      for(const group of active){
        const anchor=anchors.get(group.id);if(!anchor)continue;visible.add(group.id);
        let node=nodes.get(group.id);
        if(!node){node=document.createElement('div');node.className='speech-stack';overlay.append(node);nodes.set(group.id,node);}
        const signature=group.entries.map(e=>e.key).join('|');
        if(node.dataset.signature!==signature){
          node.replaceChildren();node.dataset.signature=signature;
          for(const entry of group.entries){
            const bubble=document.createElement('div');bubble.className='speech-bubble'+(anchor.self?' own':'')+(entry.mode==='shout'?' shout':'');
            const name=document.createElement('b'),text=document.createElement('span');name.textContent=group.name;text.textContent=entry.text;bubble.append(name,text);node.append(bubble);
          }
        }
        const w=node.offsetWidth,h=node.offsetHeight;
        const x=Math.max(8,Math.min(camera.width-w-8,anchor.x-w/2));
        let y=Math.max(8,Math.min(camera.height-h-8,anchor.y-h-12));
        for(const other of placed){if(x<other.x+other.w+8&&x+w+8>other.x&&y<other.y+other.h+8&&y+h+8>other.y)y=Math.max(8,other.y-h-10);}
        node.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
        node.style.setProperty('--tail',Math.max(15,Math.min(w-15,anchor.x-x))+'px');placed.push({x,y,w,h});
      }
      for(const [id,node] of nodes)if(!visible.has(id)){node.remove();nodes.delete(id);}
    }
    function reset(){speech.clear();nodes.forEach(n=>n.remove());nodes.clear();camera.x=750;camera.y=530;camera.follow=false;camera.constrain();}
    return{camera,begin,note,end,reset,resize};
  }
  return{Camera,Speech,mount};
});
