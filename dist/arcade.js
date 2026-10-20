(function(root){
  'use strict';
  const questions=[
    ['How many beats are in a bar of 4/4?', ['2','3','4','8'],2],
    ['Which control changes how fast a song plays?', ['Tempo','Volume','Pan','Mute'],0],
    ['Which sound usually carries the low pulse?', ['Hi-hat','Kick drum','Clap','Shaker'],1],
    ['What does a sequencer arrange?', ['Musical events in time','Room wallpaper','Microphone cables','Album sales'],0],
    ['A duet has how many performers?', ['One','Two','Three','Four'],1],
    ['Which instrument has black and white keys?', ['Saxophone','Snare','Piano','Bass guitar'],2],
    ['What is a repeating musical passage called?', ['A sleeve','A loop','A label','A fader'],1],
    ['What does muting a track do?', ['Makes it faster','Silences it','Raises its pitch','Reverses it'],1],
    ['Which term means gradually getting louder?', ['Crescendo','Staccato','Rest','Solo'],0],
    ['A vinyl record is played using which object?', ['A drumstick','A stylus','A bow','A pick'],1],
    ['What does BPM stand for?', ['Bass per melody','Beats per minute','Bars per microphone','Beat playback mode'],1],
    ['What is a solo?', ['A performance by one featured musician','A silent bar','A pair of drums','A room effect'],0]
  ];
  function start(kind,host,done){
    let stopped=false,raf=0,timer=0,started=performance.now(),last=started,score=0;
    const duration=kind==='quiz'?60000:45000;
    let controls,canvas,ctx,status,finish;
    const clean=()=>{stopped=true;cancelAnimationFrame(raf);clearInterval(timer);document.removeEventListener('keydown',key);};
    finish=(won,detail)=>{
      if(stopped)return;const elapsed=performance.now()-started;clean();done({game:kind,score,won,elapsed,detail});
    };
    host.innerHTML='<div class="arcade-hud"><b id="arcadeScore">0</b><span id="arcadeTime">'+duration/1000+'s</span></div><div id="arcadeStatus" role="status"></div>';
    status=host.querySelector('#arcadeStatus');const scoreEl=host.querySelector('#arcadeScore'),timeEl=host.querySelector('#arcadeTime');
    const key=e=>{if(e.target.matches('input,textarea,select'))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)){e.preventDefault();controls?.(k);}};
    document.addEventListener('keydown',key);
    if(kind==='quiz'){
      const deck=[...questions].sort(()=>Math.random()-.5).slice(0,8);let index=0,locked=false;
      const question=document.createElement('div');question.className='quiz-question';host.append(question);
      function render(){
        locked=false;const q=deck[index];question.replaceChildren();const p=document.createElement('h3');p.textContent=(index+1)+' / 8 · '+q[0];question.append(p);
        q[1].forEach((answer,i)=>{const b=document.createElement('button');b.className='outline';b.textContent=answer;b.onclick=()=>{
          if(locked)return;locked=true;const correct=i===q[2];if(correct)score+=100;scoreEl.textContent=score;
          b.classList.add(correct?'correct':'incorrect');status.textContent=correct?'Correct!':'The answer was '+q[1][q[2]]+'.';
          setTimeout(()=>{if(stopped)return;if(++index===deck.length)finish(score>=500,score/100+' of 8 correct');else render();},1100);
        };question.append(b);});
      }render();
      timer=setInterval(()=>{const left=Math.max(0,Math.ceil((duration-performance.now()+started)/1000));timeEl.textContent=left+'s';if(!left)finish(score>=500,'Time is up · '+score/100+' correct');},250);
    }else{
      canvas=document.createElement('canvas');canvas.width=640;canvas.height=420;canvas.className='arcade-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label',kind==='tiles'?'Tile Rush. Use arrow keys or WASD to claim adjacent tiles.':'Snow Jam. Move with arrow keys or WASD. Click to throw a snowball.');host.append(canvas);ctx=canvas.getContext('2d');
      const footer=document.createElement('p');footer.className='game-tip';footer.textContent=kind==='tiles'?'Arrow keys / WASD · or tap an adjacent tile. Hold more tiles than the rival when time runs out.':'Arrow keys / WASD · click to throw · dodge the rival’s snowballs. First to 5 hits wins.';
      host.append(footer);canvas.focus();
      let player={x:1,y:1},rival={x:4,y:4},board=Array(36).fill(0),botAt=0,moveAt=0;
      let snow={x:130,y:210,hp:5},enemy={x:510,y:210,hp:5},balls=[],shotAt=0,enemyShot=0;
      const tileMove=(dx,dy)=>{
        if(performance.now()-moveAt<100)return;moveAt=performance.now();const nx=player.x+dx,ny=player.y+dy;
        if(nx<0||ny<0||nx>5||ny>5)return;player={x:nx,y:ny};board[ny*6+nx]=1;
      };
      controls=k=>{const v={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
        if(v){if(kind==='tiles')tileMove(...v);else{snow.x=Math.max(20,Math.min(620,snow.x+v[0]*22));snow.y=Math.max(25,Math.min(395,snow.y+v[1]*22));}}
        if(k===' '&&kind==='snow')shoot(enemy.x,enemy.y);
      };
      function shoot(x,y){const t=performance.now();if(t-shotAt<400)return;shotAt=t;const d=Math.hypot(x-snow.x,y-snow.y)||1;balls.push({x:snow.x,y:snow.y,vx:(x-snow.x)/d*350,vy:(y-snow.y)/d*350,owner:1});}
      canvas.onclick=e=>{const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*640,y=(e.clientY-rect.top)/rect.height*420;
        if(kind==='tiles'){const tx=Math.floor((x-125)/65),ty=Math.floor((y-15)/65);if(Math.abs(tx-player.x)+Math.abs(ty-player.y)===1)tileMove(tx-player.x,ty-player.y);}
        else shoot(x,y);
      };
      function disc(x,y,color,label){
        ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(x,y+14,18,7,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1a1a25';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(label,x,y+4);
      }
      function frame(t){
        if(stopped)return;const dt=Math.min(.04,(t-last)/1000);last=t;const left=Math.max(0,Math.ceil((duration-t+started)/1000));timeEl.textContent=left+'s';
        ctx.fillStyle='#171922';ctx.fillRect(0,0,640,420);
        if(kind==='tiles'){
          if(t>botAt){botAt=t+350;const possible=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>({x:rival.x+dx,y:rival.y+dy})).filter(p=>p.x>=0&&p.y>=0&&p.x<6&&p.y<6);
            possible.sort((a,b)=>(board[a.y*6+a.x]===2)-(board[b.y*6+b.x]===2)+Math.random()-.5);rival=possible[0];board[rival.y*6+rival.x]=2;
          }
          board[player.y*6+player.x]=1;board[rival.y*6+rival.x]=2;
          for(let y=0;y<6;y++)for(let x=0;x<6;x++){const v=board[y*6+x];ctx.fillStyle=v===1?'#bfcf82':v===2?'#a785c0':'#31323e';ctx.beginPath();ctx.roundRect(125+x*65,15+y*65,59,59,10);ctx.fill();}
          disc(154+player.x*65,44+player.y*65,'#edfac4','YOU');disc(154+rival.x*65,44+rival.y*65,'#e4c1ff','AI');
          score=board.filter(v=>v===1).length;const opponent=board.filter(v=>v===2).length;scoreEl.textContent=score+' — '+opponent;status.textContent='Your lime tiles · rival’s violet tiles';
          if(!left){finish(score>opponent,score+' tiles to '+opponent);return;}
        }else{
          ctx.fillStyle='#1f3040';ctx.beginPath();ctx.roundRect(14,14,612,392,22);ctx.fill();
          for(let i=0;i<40;i++){ctx.fillStyle='#ffffff16';ctx.beginPath();ctx.arc((i*137)%610+15,(i*83)%390+15,2,0,Math.PI*2);ctx.fill();}
          enemy.y=210+Math.sin(t/650)*150;enemy.x=490+Math.cos(t/1100)*65;
          if(t>enemyShot){enemyShot=t+900;const dx=snow.x-enemy.x,dy=snow.y-enemy.y,d=Math.hypot(dx,dy)||1;balls.push({x:enemy.x,y:enemy.y,vx:dx/d*225,vy:dy/d*225,owner:2});}
          balls=balls.filter(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;const target=b.owner===1?enemy:snow;
            if(Math.hypot(b.x-target.x,b.y-target.y)<21){target.hp--;if(b.owner===1)score+=100;return false;}
            ctx.fillStyle=b.owner===1?'#e9f7bb':'#d6c3f3';ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fill();return b.x>0&&b.x<640&&b.y>0&&b.y<420;
          });
          disc(snow.x,snow.y,'#dbe99b','YOU');disc(enemy.x,enemy.y,'#c2a3e1','AI');scoreEl.textContent=score;status.textContent='Your lives: '+Math.max(0,snow.hp)+' · Rival lives: '+Math.max(0,enemy.hp);
          if(snow.hp<=0||enemy.hp<=0||!left){finish(enemy.hp<=0||(snow.hp>enemy.hp&&!left),score+' points · '+Math.max(0,snow.hp)+' lives left');return;}
        }
        raf=requestAnimationFrame(frame);
      }raf=requestAnimationFrame(frame);
    }
    return clean;
  }
  root.AfterhoursArcade={start};
})(typeof globalThis!=='undefined'?globalThis:this);
