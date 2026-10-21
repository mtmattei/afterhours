(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./furniture.js') : root.AfterhoursFurniture);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AfterhoursGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (F) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const day = (time = Date.now()) => new Date(time).toISOString().slice(0, 10);
  const text = (value, max = 80) => String(value ?? '').trim().slice(0, max);
  // Name-block colours for chat bubbles; each keeps white text above 4.5:1 contrast.
  const chatColors = ['#c8102e','#d6246e','#7a3fc9','#1f5fbf','#0f7a6c','#3f7d1f','#b8520a','#3a3644'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const prices = Object.fromEntries(Object.entries(F.catalog).map(([id,item])=>[id,item.price]));
  const quests = [
    {id:'hello',name:'Your first hello',description:'Say something in room chat.',stat:'chats',target:1,reward:20,xp:20},
    {id:'tour',name:'Find your frequency',description:'Visit all four public rooms.',stat:'visited',target:4,reward:60,xp:50},
    {id:'producer',name:'First pressing',description:'Save an original track in the studio.',stat:'songsSaved',target:1,reward:45,xp:40},
    {id:'debut',name:'Take the stage',description:'Finish your first performance.',stat:'performances',target:1,reward:60,xp:60},
    {id:'designer',name:'Make yourself at home',description:'Place or move five pieces of furniture.',stat:'builds',target:5,reward:50,xp:40},
    {id:'companion',name:'A little company',description:'Adopt a pet and care for it three times.',stat:'petCare',target:3,reward:45,xp:40},
    {id:'player',name:'One more round',description:'Finish three arcade games.',stat:'games',target:3,reward:60,xp:50},
    {id:'collector',name:'Record collector',description:'Press two songs onto collectible discs.',stat:'discs',target:2,reward:50,xp:40}
  ];
  const achievements = [
    {id:'resident',name:'Night owl',description:'Claim your first daily check-in.',stat:'checkins',target:1,icon:'☾'},
    {id:'explorer',name:'Room hopper',description:'Discover every public room.',stat:'visited',target:4,icon:'◇'},
    {id:'artist',name:'Original artist',description:'Save three songs.',stat:'songsSaved',target:3,icon:'♫'},
    {id:'headliner',name:'Headliner',description:'Finish five performances.',stat:'performances',target:5,icon:'★'},
    {id:'architect',name:'Room architect',description:'Make twenty furniture placements.',stat:'builds',target:20,icon:'▧'},
    {id:'arcade',name:'High scorer',description:'Win three arcade games.',stat:'wins',target:3,icon:'♜'},
    {id:'friend',name:'Good company',description:'Care for your pet ten times.',stat:'petCare',target:10,icon:'♡'}
  ];
  function pattern(input, length = 16) {
    return Array.from({length:4}, (_,r) => Array.from({length},(_,c)=>input?.[r]?.[c % (input[r].length || length)] ? 1 : 0));
  }
  const starterPattern = [[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],[1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0],[1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0]];
  function song(input = {}) {
    const length = input.length === 32 ? 32 : 16;
    return {id:text(input.id,80)||uid(),title:text(input.title,48)||'Untitled afterhours',bpm:clamp(input.bpm||88,60,160),pack:['velvet','club','arcade'].includes(input.pack)?input.pack:'velvet',
      length,pattern:pattern(input.pattern,length),volumes:Array.from({length:4},(_,i)=>clamp(input.volumes?.[i]??.7,0,1)),
      muted:Array.from({length:4},(_,i)=>!!input.muted?.[i]),created:input.created||Date.now(),updated:Date.now()};
  }
  function initial(legacy = {}) {
    return {version:5,revision:0,profile:{id:uid(),name:'daydream',motto:'Good people. Late nights.',joined:Date.now(),xp:0,avatar:legacy.avatar||0,badges:[],chatColor:chatColors[0]},
      coins:Number.isFinite(legacy.coins)?Math.max(0,legacy.coins):240,
      rooms:[{id:'home',name:'Your afterhours',description:'A little place to call my own.',tags:'music, hangout',lighting:'amber',door:'open',notes:[],playlist:[],event:null}],
      activeRoom:'home',items:(legacy.decor||[]).map(d=>({...d,roomId:d.placed===false?null:'home',state:true})),
      songs:[],discs:[],favorites:[],history:[],claimed:[],ledger:[],rewards:{},stats:{visited:[],chats:0,builds:0,songsSaved:0,performances:0,games:0,wins:0,petCare:0,discs:0,checkins:0},
      best:{},pet:null,friends:[],blocked:[],notifications:[],blueprints:[],settings:{muteGuests:false},lastCheckin:'',draft:song({pattern:legacy.patterns||starterPattern})};
  }
  function validate(raw) {
    if(!raw||raw.version!==5||!Array.isArray(raw.rooms)||raw.rooms.length<1||raw.rooms.length>12||!Array.isArray(raw.items)||raw.items.length>1000||!Array.isArray(raw.songs)||raw.songs.length>100)throw Error('This is not a valid Afterhours save.');
    if(!Number.isFinite(raw.coins)||raw.coins<0||raw.coins>10000000)throw Error('Invalid wallet in save.');
    if(!raw.profile||typeof raw.profile.id!=='string'||!Number.isFinite(raw.profile.xp)||raw.profile.xp<0)throw Error('Invalid profile in save.');
    if(!raw.stats||!Array.isArray(raw.stats.visited)||!Array.isArray(raw.claimed)||!Array.isArray(raw.ledger)||!raw.rewards)throw Error('Incomplete save.');
    const ids = new Set();
    for(const room of raw.rooms){if(!room.id||ids.has(room.id))throw Error('Duplicate room in save.');ids.add(room.id);}
    const itemIds = new Set();
    for(const item of raw.items){
      if(!prices[item.type]||!item.id||itemIds.has(item.id)||!Number.isFinite(item.x)||!Number.isFinite(item.y))throw Error('Invalid furniture in save.');
      if(item.placed!==false&&(!ids.has(item.roomId)||item.x<1||item.y<1||item.x>8||item.y>8))throw Error('Furniture is outside its room.');
      itemIds.add(item.id);
    }
    raw.songs.forEach(s=>{if(!s.id||!s.title||!Array.isArray(s.pattern)||s.pattern.length!==4||![16,32].includes(s.length)||s.pattern.some(r=>!Array.isArray(r)||r.length!==s.length||r.some(v=>v!==0&&v!==1)))throw Error('Invalid song in save.');});
    const result=clone(raw);
    result.profile.name=text(result.profile.name,20)||'daydream';result.profile.motto=text(result.profile.motto,120);result.profile.chatColor=chatColors.includes(result.profile.chatColor)?result.profile.chatColor:chatColors[0];
    result.activeRoom=ids.has(result.activeRoom)?result.activeRoom:result.rooms[0].id;
    return result;
  }
  const progress = (s, q) => Array.isArray(s.stats[q.stat]) ? s.stats[q.stat].length : s.stats[q.stat]||0;
  const level = s => 1+Math.floor(Math.sqrt(s.profile.xp/100));
  function ledger(s, amount, reason, key=uid(), now=Date.now()) {
    if(s.ledger.some(e=>e.id===key))return false;
    if(!Number.isInteger(amount)||s.coins+amount<0)throw Error('You do not have enough credits.');
    s.coins+=amount;s.ledger.unshift({id:key,amount,reason,date:now});s.ledger=s.ledger.slice(0,300);return true;
  }
  function badges(s) {
    for(const a of achievements)if(progress(s,a)>=a.target&&!s.profile.badges.includes(a.id)){
      s.profile.badges.push(a.id);s.notifications.unshift({id:uid(),text:'Badge unlocked: '+a.name,date:Date.now()});
    }
    s.notifications=s.notifications.slice(0,30);
  }
  function needs(pet, now=Date.now()) {
    if(!pet)return null;
    const hours=Math.max(0,(now-pet.updated)/3600000);
    return {hunger:clamp(pet.hunger-hours*5,0,100),happiness:clamp(pet.happiness-hours*3,0,100),energy:clamp(pet.energy+hours*8,0,100)};
  }
  class Game {
    constructor(saved, legacy={}, save=()=>{}) {this.state=saved?validate(saved):initial(legacy);this.saveCallback=save;}
    save(){this.state.revision++;this.saveCallback(this.state);}
    event(name, value=1) {
      if(name==='visited'){if(!this.state.stats.visited.includes(value))this.state.stats.visited.push(value);}
      else if(Object.hasOwn(this.state.stats,name)&&typeof this.state.stats[name]==='number')this.state.stats[name]+=value;
      badges(this.state);this.save();
    }
    dispatch(action, payload={}, now=Date.now()) {
      const s=clone(this.state);let result=null;
      switch(action) {
        case 'checkin': {
          if(s.lastCheckin===day(now))throw Error('Your daily check-in is already claimed. Come back tomorrow.');
          s.lastCheckin=day(now);ledger(s,35,'Daily check-in','checkin-'+day(now),now);s.profile.xp+=15;s.stats.checkins++;break;
        }
        case 'quest': {
          const q=quests.find(q=>q.id===payload.id);
          if(!q||s.claimed.includes(q.id)||progress(s,q)<q.target)throw Error('Complete this quest before claiming its reward.');
          s.claimed.push(q.id);ledger(s,q.reward,q.name,'quest-'+q.id,now);s.profile.xp+=q.xp;break;
        }
        case 'profile':s.profile.name=text(payload.name,20)||s.profile.name;s.profile.motto=text(payload.motto,120);if(chatColors.includes(payload.chatColor))s.profile.chatColor=payload.chatColor;break;
        case 'buy': {
          if(!prices[payload.type])throw Error('That item is not in the catalog.');
          ledger(s,-prices[payload.type],'Bought '+payload.type,uid(),now);
          if(payload.id&&s.items.some(i=>i.id===payload.id))throw Error('That purchase is already in your inventory.');
          result={id:payload.id||uid(),type:payload.type,x:4,y:6,rot:0,placed:false,roomId:null,state:true};s.items.push(result);break;
        }
        case 'room': {
          if(s.rooms.length>=12)throw Error('You have reached the twelve-room limit.');
          const name=text(payload.name,40);if(!name)throw Error('Give your room a name.');
          if(payload.id&&s.rooms.some(r=>r.id===payload.id))throw Error('That room already exists.');
          result={id:payload.id||uid(),name,description:text(payload.description,180),tags:text(payload.tags,60)||'hangout',lighting:'amber',door:'open',notes:[],playlist:[],event:null};
          s.rooms.push(result);break;
        }
        case 'roomSettings': {
          const r=s.rooms.find(r=>r.id===payload.id);if(!r)throw Error('Room not found.');
          r.name=text(payload.name,40)||r.name;r.description=text(payload.description,180);r.tags=text(payload.tags,60);
          if(['amber','moonlight','rose','daylight','club'].includes(payload.lighting))r.lighting=payload.lighting;
          if(['open','doorbell','private'].includes(payload.door))r.door=payload.door;
          break;
        }
        case 'favorite': {
          const id=String(payload.id);s.favorites=s.favorites.includes(id)?s.favorites.filter(v=>v!==id):[...s.favorites,id];break;
        }
        case 'song': {
          const entry=song(payload);if(!entry.pattern.some(r=>r.some(Boolean)))throw Error('Add a few notes before saving.');
          const index=s.songs.findIndex(x=>x.id===entry.id);
          if(index<0){if(s.songs.length>=100)throw Error('Your library is full. Remove a song first.');s.songs.push(entry);s.stats.songsSaved++;s.profile.xp+=15;}
          else s.songs[index]=entry;
          s.draft=entry;result=entry;break;
        }
        case 'deleteSong': {
          s.songs=s.songs.filter(x=>x.id!==payload.id);s.rooms.forEach(r=>r.playlist=r.playlist.filter(id=>id!==payload.id));break;
        }
        case 'disc': {
          const track=s.songs.find(x=>x.id===payload.id);if(!track)throw Error('Save this song first.');
          if(s.discs.some(d=>d.song.id===track.id&&d.song.updated===track.updated))throw Error('You already pressed this version.');
          ledger(s,-10,'Pressed '+track.title,uid(),now);s.discs.push({id:uid(),song:clone(track),artist:s.profile.name,date:now});s.stats.discs++;break;
        }
        case 'performance': {
          if(!payload.id||!s.songs.some(x=>x.id===payload.songId))throw Error('Choose a saved song.');
          if(s.rewards[payload.id])throw Error('This performance was already rewarded.');
          if(payload.elapsed<15000)throw Error('Finish the performance first.');
          const key='performances-'+day(now),count=s.rewards[key]||0;
          s.rewards[payload.id]=true;s.rewards[key]=count+1;s.stats.performances++;s.profile.xp+=count<5?35:5;
          result=count<5?40:0;if(result)ledger(s,result,'Stage performance',payload.id,now);break;
        }
        case 'game': {
          if(!['tiles','quiz','snow'].includes(payload.game)||!payload.id||s.rewards[payload.id])throw Error('This round has already finished.');
          if(payload.elapsed<8000)throw Error('Finish a complete round to earn rewards.');
          const score=Math.floor(clamp(payload.score,0,9999)),key='arcade-'+day(now),count=s.rewards[key]||0;
          s.rewards[payload.id]=true;s.rewards[key]=count+1;s.stats.games++;if(payload.won)s.stats.wins++;
          s.best[payload.game]=Math.max(s.best[payload.game]||0,score);
          result=count<8?(payload.won?30:15):0;if(result)ledger(s,result,'Arcade · '+payload.game,payload.id,now);
          s.profile.xp+=count<8?20:3;break;
        }
        case 'adopt': {
          if(s.pet)throw Error('Your companion is already waiting for you.');
          ledger(s,-50,'Adopted a companion',uid(),now);
          s.pet={id:uid(),name:text(payload.name,20)||'Biscuit',hunger:85,happiness:80,energy:90,updated:now,x:3.5,y:5.5,following:true,tricks:[],xp:0};break;
        }
        case 'pet': {
          if(!s.pet)throw Error('Adopt a companion first.');
          const p=s.pet,n=needs(p,now);Object.assign(p,n,{updated:now});
          const cooldown='pet-'+payload.action;
          if(now-(s.rewards[cooldown]||0)<20000)throw Error('Give your companion a moment before doing that again.');
          if(payload.action==='feed'){if(p.hunger>95)throw Error(p.name+' is full for now.');ledger(s,-3,'Pet food',uid(),now);p.hunger=Math.min(100,p.hunger+35);}
          else if(payload.action==='play'){if(p.energy<15)throw Error(p.name+' needs some rest.');p.happiness=Math.min(100,p.happiness+30);p.energy-=15;}
          else if(payload.action==='train'){if(p.energy<15)throw Error(p.name+' needs some rest.');p.xp+=15;p.energy-=10;if(p.xp>=30&&!p.tricks.includes('sit'))p.tricks.push('sit');if(p.xp>=75&&!p.tricks.includes('spin'))p.tricks.push('spin');}
          else throw Error('Unknown pet activity.');
          s.rewards[cooldown]=now;s.stats.petCare++;s.profile.xp+=5;break;
        }
        case 'note': {
          const r=s.rooms.find(r=>r.id===payload.room);if(!r)throw Error('Room not found.');
          const note=text(payload.text,180);if(!note)throw Error('Write a note first.');
          if(r.notes.length>=30)throw Error('The board is full. Remove an old note first.');
          r.notes.unshift({id:uid(),text:note,name:s.profile.name,date:now});break;
        }
        case 'itemAction': {
          const item=s.items.find(i=>i.id===payload.id&&i.placed!==false);if(!item)throw Error('Place this object in a room first.');
          if(payload.action==='toggle'&&(['lamp','table'].includes(item.type)||F.catalog[item.type]?.use==='light')){item.state=item.state===false;result=item.state;}
          else if(payload.action==='soda'&&item.type==='vending'){ledger(s,-2,'Soda',uid(),now);}
          else if(payload.action==='water'&&(item.type==='plant'||F.catalog[item.type]?.use==='water')){item.watered=now;}
          else if(payload.action==='roll'&&item.type==='dice'){item.value=1+Math.floor(Math.random()*6);result=item.value;}
          else if(payload.action==='link'&&item.type==='portal'){
            if(!s.rooms.some(r=>r.id===payload.destination))throw Error('Choose one of your rooms.');
            item.destination=payload.destination;
          }else if(payload.action==='wrap'&&item.type==='gift'&&!item.contents){
            const content=s.items.find(i=>i.id===payload.content&&i.id!==item.id&&i.placed===false&&!i.wrapped&&!i.contents);
            if(!content)throw Error('Choose an unwrapped piece from your inventory.');
            content.wrapped=true;item.contents=content.id;item.note=text(payload.note,120);
          }else if(payload.action==='unwrap'&&item.type==='gift'&&item.contents){
            const content=s.items.find(i=>i.id===item.contents);if(content){content.wrapped=false;content.placed=false;content.roomId=null;}
            item.contents=null;item.note='';
          }else throw Error('This object cannot do that.');
          break;
        }
        case 'deleteNote': {const r=s.rooms.find(r=>r.id===payload.room);if(r)r.notes=r.notes.filter(n=>n.id!==payload.id);break;}
        case 'blueprint': {
          if(s.blueprints.length>=10)throw Error('Your blueprint folder is full.');
          const r=s.rooms.find(r=>r.id===payload.room);if(!r)throw Error('Room not found.');
          s.blueprints.push({id:uid(),name:text(payload.name,40)||r.name,room:r.id,items:clone(s.items.filter(d=>d.roomId===r.id&&d.placed!==false)),lighting:r.lighting});break;
        }
        case 'restoreBlueprint': {
          const b=s.blueprints.find(b=>b.id===payload.id);if(!b)throw Error('Blueprint not found.');
          if(!s.rooms.some(r=>r.id===b.room))throw Error('This room no longer exists.');
          for(const old of b.items)if(!s.items.some(i=>i.id===old.id))throw Error('A piece used by this blueprint is no longer owned.');
          s.items.forEach(i=>{if(i.roomId===b.room){i.placed=false;i.roomId=null;}});
          b.items.forEach(old=>Object.assign(s.items.find(i=>i.id===old.id),old));
          s.rooms.find(r=>r.id===b.room).lighting=b.lighting;break;
        }
        default:throw Error('Unknown action.');
      }
      badges(s);this.state=s;this.save();return result;
    }
  }
  return {Game,initial,validate,quests,achievements,progress,level,needs,prices,pattern,song,starterPattern,uid,day,clone,ledger,chatColors};
});
