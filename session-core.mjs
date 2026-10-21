import G from './dist/game-core.js';
import F from './dist/furniture.js';
const clean=(value,max=160)=>String(value??'').trim().slice(0,max);
const uid=()=>crypto.randomUUID();
const clone=G.clone;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export function initialWorld(){return {version:1,revision:0,users:{},auth:{},rooms:{},trades:{},reports:[],requests:{}};}
const publicCounts=[10,10,3,6];
const roomData=(db,key)=>db.rooms[key]||(db.rooms[key]={chat:[],seats:{},queue:[],stage:null,history:[],guests:[],requests:[],banned:[]});
const touch=db=>{db.revision++;};
function model(user){return new G.Game(user.game,{},s=>{user.game=s;});}
function roomOwner(db,key){
  if(!key.startsWith('home:'))return null;
  const rest=key.slice(5),sep=rest.indexOf(':');return db.users[rest.slice(0,sep)]||null;
}
function ownedRoom(db,key){const owner=roomOwner(db,key);return owner?.game.rooms.find(r=>key==='home:'+owner.id+':'+r.id);}
function chat(db,key,name,text,mode='say',to=null,from=null){
  const room=roomData(db,key);room.chat.push({id:uid(),name,text:clean(text),mode,to,from,time:Date.now()});room.chat=room.chat.slice(-100);
}
function release(db,user){
  const room=roomData(db,user.room);
  for(const [seat,owner] of Object.entries(room.seats))if(owner===user.id)delete room.seats[seat];
  user.pose.seat=null;
}
function itemReserved(db,id){
  return Object.values(db.trades).some(t=>['pending','open'].includes(t.status)&&Object.values(t.offers).some(items=>items.includes(id)));
}
function checkItem(user,id){const item=user.game.items.find(i=>i.id===id);if(!item||item.placed!==false||item.wrapped||item.contents)throw Error('Trade only unwrapped pieces from your inventory.');return item;}
function saveModel(user){user.game.revision++;}
const AWAY=20000;
// Traces collect what happened while a player was offline; `always` records it even when they are here.
function trace(db,target,kind,text,now,always=false){
  if(!target||(!always&&now-target.lastSeen<AWAY))return;
  target.away=[{id:uid(),kind,text:clean(text),time:now},...(target.away||[])].slice(0,30);
}
export function weekKey(now){
  const d=new Date(now);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+3-(d.getUTCDay()+6)%7);
  return d.getUTCFullYear()+'-W'+String(Math.ceil(((d-Date.UTC(d.getUTCFullYear(),0,1))/86400000+1)/7)).padStart(2,'0');
}
// Rank by unique listeners, then plays, then whoever played it first.
function chartTop(chart,limit=10){
  return Object.values(chart?.entries||{}).filter(e=>e.listeners.length).sort((a,b)=>b.listeners.length-a.listeners.length||b.plays-a.plays||a.first-b.first)
    .slice(0,limit).map((e,i)=>({rank:i+1,user:e.user,artist:e.artist,title:e.title,listeners:e.listeners.length,plays:e.plays}));
}
function rollChart(db,now){
  const week=weekKey(now);if(db.chart?.week===week)return false;
  if(db.chart){
    const top=chartTop(db.chart,3);
    for(const e of top){
      const winner=db.users[e.user];if(!winner)continue;let prize=0;
      try{prize=model(winner).dispatch('chartAward',{week:db.chart.week,rank:e.rank,title:e.title},now);}catch{}
      const text='“'+e.title+'” finished #'+e.rank+' on the weekly chart'+(prize?' · +'+prize+' ✦':'');
      trace(db,winner,'chart',text,now,true);winner.notifications.unshift({id:uid(),text,time:now});winner.notifications=winner.notifications.slice(0,30);
    }
    db.chartHistory=[{week:db.chart.week,top},...(db.chartHistory||[])].slice(0,8);
  }
  db.chart={week,entries:{}};return true;
}
export async function createGuest(db,input={},now=Date.now()){
  if(Object.keys(db.users).length>=500)throw Error('The world is at capacity. Try again later.');
  const name=clean(input.name,20)||'nightowl',id=uid(),secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const game=G.initial({coins:240,avatar:Math.max(0,Math.min(5,Number(input.avatar)||0)),outfit:input.outfit,decor:F.starter().map(item=>({...item,id:id+'-'+item.id}))});
  game.profile.id=id;game.profile.name=Object.values(db.users).some(u=>u.game.profile.name.toLowerCase()===name.toLowerCase())?name.slice(0,14)+'-'+id.slice(0,4):name;
  db.users[id]={id,game,room:'public:0',pose:{x:5.5,y:5.5,avatar:game.profile.avatar,back:false,flip:false,seat:null,dancing:false},lastSeen:now,friendIds:[],friendRequests:[],blocked:[],notifications:[],lastChat:0,away:[],awaySeen:now};
  db.auth[await hash(secret)]=id;touch(db);return {token:secret,id};
}
export async function authenticate(db,token){const id=db.auth[await hash(token||'')];if(!id||!db.users[id])throw Error('Your session expired. Join the world again.');return db.users[id];}
export function tick(db,now=Date.now()){
  let changed=rollChart(db,now);
  for(const user of Object.values(db.users))if(now-user.lastSeen>20000&&user.pose.seat){release(db,user);changed=true;}
  for(const [key,r] of Object.entries(db.rooms)){
    r.queue=r.queue.filter(q=>db.users[q.user]&&now-db.users[q.user].lastSeen<20000);
    if(r.stage&&now>=r.stage.end){
      const performance=r.stage,user=db.users[performance.user];r.stage=null;
      if(user){
        try{const reward=model(user).dispatch('performance',{id:performance.id,songId:performance.song.id,elapsed:now-performance.start},now);const count=Object.keys(performance.votes).length;chat(db,key,'system',user.game.profile.name+' finished “'+performance.song.title+'” · '+count+' applause · '+reward+' credits for the set.');}catch{}
        user.notifications.unshift({id:uid(),text:'Set complete: '+performance.song.title,time:now});
      }
      const listeners=Object.keys(performance.votes),entries=db.chart.entries,songKey=performance.user+':'+performance.song.id;
      const entry=entries[songKey]||(Object.keys(entries).length<200?(entries[songKey]={user:performance.user,artist:performance.artist,title:performance.song.title,listeners:[],plays:0,first:now}):null);
      if(entry){entry.plays++;entry.title=performance.song.title;for(const id of listeners)if(!entry.listeners.includes(id))entry.listeners.push(id);}
      r.history.unshift({...performance,votes:listeners.length});r.history=r.history.slice(0,15);changed=true;
    }
    if(!r.stage&&r.queue.length){
      const next=r.queue.shift();r.stage={...next,start:now+2000,end:now+22000,votes:{}};
      chat(db,key,'system',db.users[next.user].game.profile.name+' is up next: “'+next.song.title+'”.');changed=true;
    }
  }
  for(const trade of Object.values(db.trades))if(['pending','open'].includes(trade.status)&&now-trade.updated>300000){trade.status='expired';changed=true;}
  if(changed)touch(db);
}
function applyAction(db,user,type,p={},now=Date.now()){
  user.lastSeen=now;let result=null;
  const current=roomData(db,user.room);
  switch(type){
    case 'heartbeat':return null;
    case 'pose': {
      const x=Number(p.x),y=Number(p.y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>10||y>10)throw Error('Invalid room position.');
      const elapsed=Math.max(.1,(now-(user.pose.time||now))/1000);
      if(Math.hypot(x-user.pose.x,y-user.pose.y)>elapsed*4+1)throw Error('That movement was too far.');
      user.pose={...user.pose,x,y,back:!!p.back,flip:!!p.flip,dancing:!!p.dancing,avatar:Math.max(0,Math.min(5,Number(p.avatar)||0)),time:now,seat:user.pose.seat};
      if(p.seated&&user.pose.seat)user.pose.seat.sitting=true;break;
    }
    case 'joinRoom': {
      const key=clean(p.key,160);
      if(!/^public:[0-3]$/.test(key)&&!ownedRoom(db,key))throw Error('That room no longer exists.');
      const owner=roomOwner(db,key),meta=ownedRoom(db,key),r=roomData(db,key);
      if(r.banned.includes(user.id))throw Error('You cannot enter this room.');
      if(owner&&owner.id!==user.id&&meta.door!=='open'&&!r.guests.includes(user.id)){
        if(meta.door==='private')throw Error('This room is private.');
        if(!r.requests.includes(user.id))r.requests.push(user.id);result={waiting:true};break;
      }
      release(db,user);user.room=key;user.pose={...user.pose,x:5.5,y:5.5,seat:null,time:now};
      if(owner?.id===user.id){user.game.activeRoom=meta.id;saveModel(user);}
      if(key.startsWith('public:'))model(user).event('visited',Number(key.slice(7)));
      if(owner&&owner.id!==user.id){const text=user.game.profile.name+' dropped by '+meta.name;if(!(owner.away||[]).some(e=>e.text===text&&now-e.time<21600000))trace(db,owner,'visit',text,now);}
      chat(db,key,'system',user.game.profile.name+' joined the room.');break;
    }
    case 'door': {
      if(roomOwner(db,user.room)?.id!==user.id)throw Error('Only the owner can answer the door.');
      const id=clean(p.user,80);current.requests=current.requests.filter(x=>x!==id);
      if(p.allow&&!current.guests.includes(id))current.guests.push(id);
      if(db.users[id])db.users[id].notifications.unshift({id:uid(),text:p.allow?'The door is open. You can enter now.':'The host could not let you in.',time:now});break;
    }
    case 'kick':case 'ban': {
      if(roomOwner(db,user.room)?.id!==user.id||p.user===user.id)throw Error('Only the host can remove a guest.');
      const target=db.users[p.user];if(!target||target.room!==user.room)throw Error('That guest has already left.');
      if(type==='ban'&&!current.banned.includes(target.id))current.banned.push(target.id);
      release(db,target);target.room='public:0';target.pose.x=5.5;target.pose.y=5.5;
      target.notifications.unshift({id:uid(),text:'The host returned you to Side B.',time:now});break;
    }
    case 'seat': {
      const seat=clean(p.id,120);let valid=false;
      if(user.room.startsWith('public:')){const i=Number(user.room.slice(7));valid=new RegExp('^lounge-'+i+'-\\d+$').test(seat)&&Number(seat.split('-').at(-1))<publicCounts[i];}
      else{const owner=roomOwner(db,user.room),meta=ownedRoom(db,user.room);valid=owner.game.items.some(i=>i.roomId===meta.id&&i.placed!==false&&F.catalog[i.type]?.seats?.some((_,index)=>seat===i.id+':'+index));}
      if(!valid)throw Error('That seat is not available.');
      if(current.seats[seat]&&current.seats[seat]!==user.id)throw Error('Someone is already sitting there.');
      release(db,user);current.seats[seat]=user.id;const point=Array.isArray(p.point)?p.point.map(Number):[];
      if(point.length!==2||point.some(v=>!Number.isFinite(v)||v<0||v>1500))throw Error('Invalid seat.');
      user.pose.seat={id:seat,point,flip:!!p.flip,sitting:false};break;
    }
    case 'stand':release(db,user);break;
    case 'awaySeen':user.awaySeen=now;break;
    case 'chat':{
      if(now-user.lastChat<700)throw Error('Give the room a moment between messages.');const text=clean(p.text,160);if(!text)break;user.lastChat=now;
      const mode=['say','shout','whisper'].includes(p.mode)?p.mode:'say',to=mode==='whisper'?p.to:null;
      if(to&&(!db.users[to]||db.users[to].room!==user.room))throw Error('That person is not in this room.');
      chat(db,user.room,user.game.profile.name,text,mode,to,user.id);model(user).event('chats');
      if(mode!=='whisper')user.pose.bubble={text,mode,until:now+9000};break;
    }
    case 'command':{
      const allowed=['checkin','quest','profile','outfit','buy','room','roomSettings','favorite','song','deleteSong','disc','adopt','pet','note','deleteNote','blueprint','restoreBlueprint','itemAction'];
      if(p.type==='game'){
        const round=user.arcade?.[p.payload?.id];if(!round||round.game!==p.payload.game)throw Error('Start a new arcade round first.');
        result=model(user).dispatch('game',{...p.payload,elapsed:now-round.start},now);delete user.arcade[p.payload.id];break;
      }
      if(!allowed.includes(p.type))throw Error('This action is not available here.');
      if(p.type==='buy'&&p.payload?.id&&Object.values(db.users).some(u=>u.game.items.some(i=>i.id===p.payload.id)))throw Error('That item identifier is already in use.');
      if(p.type==='restoreBlueprint'&&Object.values(db.trades).some(t=>t.participants.includes(user.id)&&['pending','open'].includes(t.status)))throw Error('Finish your trade before restoring a blueprint.');
      result=model(user).dispatch(p.type,p.payload||{},now);
      if(p.type==='itemAction'&&p.payload?.action==='roll'){
        if(now-(user.lastDice||0)<1000)throw Error('Wait a moment before rolling again.');
        user.lastDice=now;user.pose.bubble={text:'Rolled a '+result,until:now+5000};
        chat(db,user.room,'system',user.game.profile.name+' rolled '+result);
      }break;
    }
    case 'arcadeStart':{
      if(!['tiles','snow','quiz'].includes(p.game)||typeof p.id!=='string')throw Error('Unknown arcade game.');
      user.arcade={[p.id]:{game:p.game,start:now}};break;
    }
    case 'extras':{
      const r=user.game.rooms.find(r=>r.id===p.room);
      if(r){
        r.rules=Array.isArray(p.rules)?p.rules.slice(0,10).filter(rule=>['enter','say','sit','dice'].includes(rule.trigger)&&['lights','message','music'].includes(rule.effect)).map(rule=>({id:clean(rule.id,80),trigger:rule.trigger,effect:rule.effect,phrase:clean(rule.phrase,120),message:clean(rule.message,120)})):[];
        r.playlist=Array.isArray(p.playlist)?p.playlist.filter(id=>user.game.songs.some(s=>s.id===id)).slice(0,100):[];
        r.event=p.event?{name:clean(p.event.name,60),start:Math.max(now-3600000,Math.min(now+86400000,Number(p.event.start)||now))}:null;
      }
      if(p.draft)user.game.draft=G.song(p.draft);
      user.game.profile.avatar=Math.max(0,Math.min(5,Number(p.avatar)||0));saveModel(user);break;
    }
    case 'layout':{
      const meta=user.game.rooms.find(r=>r.id===p.room);if(!meta||!Array.isArray(p.items)||p.items.length>1000)throw Error('Room not found.');
      const next=clone(user.game.items);let moved=0;
      for(const change of p.items){
        const item=next.find(i=>i.id===change.id);if(!item)throw Error('You do not own that piece.');
        if(itemReserved(db,item.id))throw Error('Finish the trade before moving a reserved piece.');
        if(item.wrapped)throw Error('Open the wrapped gift first.');
        const x=Math.floor(Number(change.x)),y=Math.floor(Number(change.y));if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid tile.');
        const before=JSON.stringify([item.x,item.y,item.rot,item.placed,item.roomId]);
        Object.assign(item,{x,y,rot:change.rot?1:0,placed:change.placed!==false,roomId:change.placed===false?null:meta.id,state:change.state!==false});
        if(before!==JSON.stringify([item.x,item.y,item.rot,item.placed,item.roomId]))moved++;
        if(change.destination&&user.game.rooms.some(r=>r.id===change.destination))item.destination=change.destination;
      }
      const inRoom=next.filter(i=>i.roomId===meta.id&&i.placed!==false);
      for(const item of inRoom)if(!F.canPlace(item,inRoom,null))throw Error('Furniture overlaps or falls outside the room.');
      user.game.items=next;if(moved)model(user).event('builds',moved);else saveModel(user);break;
    }
    case 'queue': {
      if(current.queue.some(q=>q.user===user.id)||current.stage?.user===user.id)throw Error('You already have a place in the queue.');
      const song=user.game.songs.find(s=>s.id===p.song);if(!song)throw Error('Save a song before joining the queue.');
      current.queue.push({id:uid(),user:user.id,artist:user.game.profile.name,song:clone(song)});break;
    }
    case 'leaveQueue':current.queue=current.queue.filter(q=>q.user!==user.id);if(current.stage?.user===user.id)current.stage=null;break;
    case 'vote':{
      const performance=current.stage;if(!performance||performance.user===user.id||now<performance.start||now>=performance.end)throw Error('Applaud another artist while they are playing.');
      if(performance.votes[user.id])throw Error('You already applauded this performance.');
      performance.votes[user.id]=true;
      const artist=db.users[performance.user];
      if(artist){const paid=model(artist).dispatch('applause',{id:performance.id,from:user.id},now);artist.notifications.unshift({id:uid(),text:user.game.profile.name+' applauded “'+performance.song.title+'”'+(paid?' · +'+paid+' ✦':''),time:now});artist.notifications=artist.notifications.slice(0,30);}
      break;
    }
    case 'friend': {
      const other=db.users[p.user];if(!other||other.id===user.id)throw Error('Choose another player.');
      if(!other.friendRequests.includes(user.id)&&!other.friendIds.includes(user.id)){other.friendRequests.push(user.id);trace(db,other,'friend',user.game.profile.name+' sent you a friend request',now);}break;
    }
    case 'answerFriend':{
      const other=db.users[p.user];if(!other||!user.friendRequests.includes(other.id))throw Error('Friend request not found.');
      user.friendRequests=user.friendRequests.filter(id=>id!==other.id);
      if(p.accept){if(!user.friendIds.includes(other.id))user.friendIds.push(other.id);if(!other.friendIds.includes(user.id))other.friendIds.push(user.id);}break;
    }
    case 'unfriend':{const other=db.users[p.user];user.friendIds=user.friendIds.filter(id=>id!==p.user);if(other)other.friendIds=other.friendIds.filter(id=>id!==user.id);break;}
    case 'block':if(!user.blocked.includes(p.user))user.blocked.push(p.user);break;
    case 'report':{
      if(!db.users[p.user]||!clean(p.reason,300))throw Error('Choose a player and give a reason.');
      db.reports.push({id:uid(),from:user.id,target:p.user,reason:clean(p.reason,300),room:user.room,time:now});db.reports=db.reports.slice(-500);break;
    }
    case 'trade':{
      const other=db.users[p.user];if(!other||other.room!==user.room||other.id===user.id||other.blocked.includes(user.id))throw Error('That player cannot trade right now.');
      if(Object.values(db.trades).some(t=>['pending','open'].includes(t.status)&&t.participants.some(id=>[user.id,other.id].includes(id))))throw Error('Finish the current trade first.');
      const id=uid();db.trades[id]={id,participants:[user.id,other.id],status:'pending',offers:{[user.id]:[],[other.id]:[]},confirmed:[],updated:now};result={id};break;
    }
    case 'tradeAccept':case 'tradeOffer':case 'tradeConfirm':case 'tradeCancel':{
      const trade=db.trades[p.id];if(!trade||!trade.participants.includes(user.id)||!['pending','open'].includes(trade.status))throw Error('This trade is no longer active.');
      trade.updated=now;
      if(type==='tradeCancel'){trade.status='cancelled';break;}
      if(type==='tradeAccept'){if(user.id!==trade.participants[1])throw Error('Waiting for the other player.');trade.status='open';break;}
      if(trade.status!=='open')throw Error('Wait for the invitation to be accepted.');
      if(type==='tradeOffer'){
        if(!Array.isArray(p.items)||p.items.length>8||new Set(p.items).size!==p.items.length)throw Error('Offer up to eight different items.');
        p.items.forEach(id=>checkItem(user,id));trade.offers[user.id]=p.items;trade.confirmed=[];break;
      }
      if(!Object.values(trade.offers).some(items=>items.length))throw Error('Add at least one item.');
      for(const ownerId of trade.participants)trade.offers[ownerId].forEach(id=>checkItem(db.users[ownerId],id));
      if(!trade.confirmed.includes(user.id))trade.confirmed.push(user.id);
      if(trade.confirmed.length===2){
        const [a,b]=trade.participants.map(id=>db.users[id]),giveA=trade.offers[a.id].map(id=>checkItem(a,id)),giveB=trade.offers[b.id].map(id=>checkItem(b,id));
        a.game.items=a.game.items.filter(i=>!trade.offers[a.id].includes(i.id));b.game.items=b.game.items.filter(i=>!trade.offers[b.id].includes(i.id));
        a.game.items.push(...giveB.map(i=>({...i,placed:false,roomId:null})));b.game.items.push(...giveA.map(i=>({...i,placed:false,roomId:null})));
        saveModel(a);saveModel(b);trade.status='completed';
        for(const person of[a,b])person.notifications.unshift({id:uid(),text:'Trade completed. Your inventory is updated.',time:now});
      }break;
    }
    default:throw Error('Unknown shared-world action.');
  }
  user.notifications=user.notifications.slice(0,30);touch(db);tick(db,now);return result;
}
export function action(db,user,type,p={},now=Date.now()){
  // An invalid command must not release a seat, reserve an item, or partially transfer ownership.
  const draft=clone(db),actor=draft.users[user.id];
  if(!actor)throw Error('Your session expired.');
  const result=applyAction(draft,actor,type,p,now);
  Object.assign(user,actor);draft.users[user.id]=user;Object.assign(db,draft);
  return result;
}
export function snapshot(db,user,now=Date.now()){
  const current=roomData(db,user.room),owner=roomOwner(db,user.room),meta=ownedRoom(db,user.room);
  const publicUser=u=>({id:u.id,name:u.game.profile.name,motto:u.game.profile.motto,chatColor:u.game.profile.chatColor,level:G.level(u.game),avatar:u.pose.avatar,outfit:G.clone(u.game.profile.outfit||null),online:now-u.lastSeen<20000,room:u.room,awards:(u.game.awards||[]).slice(0,3)});
  const peers=Object.values(db.users).filter(u=>u.id!==user.id&&u.room===user.room&&now-u.lastSeen<20000&&!user.blocked.includes(u.id)).map(u=>({...publicUser(u),pose:u.pose}));
  const trades=Object.values(db.trades).filter(t=>t.participants.includes(user.id)&&now-t.updated<600000).sort((a,b)=>b.updated-a.updated).map(t=>({...t,people:t.participants.map(id=>publicUser(db.users[id])),items:Object.fromEntries(t.participants.map(id=>[id,t.offers[id].map(itemId=>db.users[id].game.items.find(i=>i.id===itemId)).filter(Boolean).map(i=>({id:i.id,type:i.type}))]))}));
  return {revision:db.revision,time:now,self:publicUser(user),game:user.game,peers,room:user.room,
    roomView:owner&&owner.id!==user.id?{...meta,key:user.room,owner:owner.game.profile.name,ownerId:owner.id,items:owner.game.items.filter(i=>i.roomId===meta.id&&i.placed!==false)}:null,
    chats:current.chat.filter(m=>(m.mode!=='whisper'||m.from===user.id||m.to===user.id)&&(!m.from||!user.blocked.includes(m.from))&&(m.mode!=='say'||!m.from||m.from===user.id||!db.users[m.from]||Math.hypot(db.users[m.from].pose.x-user.pose.x,db.users[m.from].pose.y-user.pose.y)<5)),
    seats:current.seats,stage:current.stage,queue:current.queue,history:current.history,
    friends:user.friendIds.map(id=>db.users[id]).filter(Boolean).map(u=>({...publicUser(u),lastSeen:u.lastSeen})),
    away:(user.away||[]).filter(e=>e.time>(user.awaySeen||0)),
    chart:{week:db.chart?.week||weekKey(now),top:chartTop(db.chart),last:db.chartHistory?.[0]||null},friendRequests:user.friendRequests.map(id=>db.users[id]).filter(Boolean).map(publicUser),
    rooms:Object.values(db.users).flatMap(u=>u.game.rooms.filter(r=>r.door!=='private'||u.id===user.id).map(r=>({key:'home:'+u.id+':'+r.id,name:r.name,description:r.description,owner:u.game.profile.name,door:r.door,count:Object.values(db.users).filter(p=>p.room==='home:'+u.id+':'+r.id&&now-p.lastSeen<20000).length}))),
    doorRequests:owner?.id===user.id?current.requests.map(id=>db.users[id]).filter(Boolean).map(publicUser):[],trades,notifications:user.notifications};
}
