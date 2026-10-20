/* Original synthesis and sample-accurate scheduling. No external music assets. */
(function(root){
  'use strict';
  class Music {
    constructor(){this.context=null;this.running=false;this.song=null;this.step=0;this.next=0;this.timer=null;this.onStep=()=>{};this.master=null;this.generation=0;}
    async ensure(){
      if(!this.context){this.context=new (window.AudioContext||window.webkitAudioContext)();this.master=this.context.createGain();this.master.gain.value=.7;this.master.connect(this.context.destination);}
      await this.context.resume();return this.context;
    }
    async play(song,onStep=()=>{},startAt=0){
      const generation=++this.generation;this.halt();
      await this.ensure();if(generation!==this.generation)return;
      this.song=JSON.parse(JSON.stringify(song));this.onStep=onStep;this.running=true;
      const now=Date.now(),stepMs=60/song.bpm/4*1000,elapsed=startAt?Math.max(0,now-startAt):0;
      this.step=startAt?Math.ceil(elapsed/stepMs):0;
      const delay=startAt?(startAt>now?startAt-now:this.step*stepMs-elapsed):60;
      this.next=this.context.currentTime+Math.max(.025,delay/1000);this.started=startAt||now;
      this.schedule();this.timer=setInterval(()=>this.schedule(),25);
    }
    halt(){clearInterval(this.timer);this.timer=null;this.running=false;if(this.master&&this.context){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(0,this.context.currentTime);this.master.disconnect();this.master=this.context.createGain();this.master.gain.value=.7;this.master.connect(this.context.destination);}}
    stop(){this.generation++;this.halt();}
    update(song){this.song=JSON.parse(JSON.stringify(song));}
    schedule(){
      if(!this.running)return;
      const c=this.context,s=this.song;
      // Resume at the current beat after a suspended tab, rather than scheduling a backlog.
      if(this.next<c.currentTime-.2)this.next=c.currentTime+.03;
      while(this.next<c.currentTime+.12){
        const index=this.step%s.length,at=this.next;
        for(let row=0;row<4;row++)if(s.pattern[row][index]&&!s.muted[row])Music.hit(c,this.master,row,index,s,at);
        const generation=this.generation;setTimeout(()=>{if(this.running&&generation===this.generation)this.onStep(index);},Math.max(0,(at-c.currentTime)*1000));
        this.next+=60/s.bpm/4;this.step++;
      }
    }
    static hit(c,dest,row,step,song,at){
      const volume=(song.volumes[row]??.7),pack=song.pack;
      if(!volume)return;
      const envelope=(length,peak)=>{const g=c.createGain();g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak*volume),at+.004);g.gain.exponentialRampToValueAtTime(.0001,at+length);g.connect(dest);return g;};
      if(row===0){
        const o=c.createOscillator();o.frequency.setValueAtTime(pack==='club'?155:120,at);o.frequency.exponentialRampToValueAtTime(pack==='club'?42:36,at+.16);o.connect(envelope(.3,.32));o.start(at);o.stop(at+.31);
      }else if(row===1||row===2){
        const length=row===1?.17:.055,buf=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),data=buf.getChannelData(0);
        let seed=1977+step*317+row;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/1073741823.5-1)*(1-i/data.length);}
        const src=c.createBufferSource(),filter=c.createBiquadFilter();src.buffer=buf;filter.type='highpass';filter.frequency.value=row===1?1100:6500;src.connect(filter).connect(envelope(length,row===1?.2:.12));src.start(at);src.stop(at+length);
        if(row===1&&pack==='club'){const o=c.createOscillator();o.frequency.value=180;o.type='triangle';o.connect(envelope(.12,.05));o.start(at);o.stop(at+.13);}
      }else{
        const notes=pack==='arcade'?[261.63,329.63,392,523.25,440,392,329.63,293.66]:[130.81,155.56,196,233.08,196,174.61,155.56,116.54];
        const o=c.createOscillator(),filter=c.createBiquadFilter();o.type=pack==='arcade'?'square':pack==='club'?'sawtooth':'triangle';o.frequency.value=notes[Math.floor(step/2)%notes.length];
        filter.type='lowpass';filter.frequency.setValueAtTime(pack==='velvet'?900:1800,at);filter.frequency.exponentialRampToValueAtTime(250,at+.35);o.connect(filter).connect(envelope(.42,pack==='arcade'?.045:.11));o.start(at);o.stop(at+.44);
      }
    }
    async wav(song,bars=4){
      const stepDuration=60/song.bpm/4,duration=stepDuration*song.length*bars+.6,sampleRate=22050;
      const c=new OfflineAudioContext(1,Math.ceil(duration*sampleRate),sampleRate),g=c.createGain();g.gain.value=.65;g.connect(c.destination);
      for(let i=0;i<song.length*bars;i++)for(let row=0;row<4;row++)if(song.pattern[row][i%song.length]&&!song.muted[row])Music.hit(c,g,row,i%song.length,song,i*stepDuration);
      const buffer=await c.startRendering(),data=buffer.getChannelData(0),bytes=new ArrayBuffer(44+data.length*2),v=new DataView(bytes);
      const ascii=(offset,str)=>{for(let i=0;i<str.length;i++)v.setUint8(offset+i,str.charCodeAt(i));};
      ascii(0,'RIFF');v.setUint32(4,36+data.length*2,true);ascii(8,'WAVE');ascii(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,data.length*2,true);
      data.forEach((sample,i)=>v.setInt16(44+i*2,Math.max(-1,Math.min(1,sample))*32767,true));return new Blob([bytes],{type:'audio/wav'});
    }
  }
  root.AfterhoursMusic=Music;
})(typeof globalThis!=='undefined'?globalThis:this);
