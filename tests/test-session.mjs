import test from 'node:test';
import assert from 'node:assert/strict';
import {initialWorld,createGuest,authenticate,action,snapshot,tick,weekKey} from '../session-core.mjs';
const setup=async()=>{const db=initialWorld(),a=await createGuest(db,{name:'Alice'}),b=await createGuest(db,{name:'Bob'});return {db,a:await authenticate(db,a.token),b:await authenticate(db,b.token)};};
test('new two-seat furniture saves and reserves each seat independently',async()=>{
 const {db,a,b}=await setup(),now=Date.now();
 action(db,a,'command',{type:'buy',payload:{type:'loveseat',id:'new-sofa'}},now);
 action(db,a,'layout',{room:'home',items:[{id:'new-sofa',x:6,y:4,placed:true}]},now);
 const key='home:'+a.id+':home';action(db,a,'joinRoom',{key},now);action(db,b,'joinRoom',{key},now);
 action(db,a,'seat',{id:'new-sofa:0',point:[900,600]},now);
 assert.throws(()=>action(db,b,'seat',{id:'new-sofa:0',point:[900,600]},now));
 action(db,b,'seat',{id:'new-sofa:1',point:[950,620]},now);
 assert.throws(()=>action(db,b,'seat',{id:'new-sofa:2',point:[950,620]},now));
 assert.equal(db.rooms[key].seats['new-sofa:0'],a.id);assert.equal(db.rooms[key].seats['new-sofa:1'],b.id);
 const restored=JSON.parse(JSON.stringify(db));assert.equal(restored.users[a.id].game.items.find(i=>i.id==='new-sofa').x,6);
 assert.equal(restored.users[a.id].game.coins,165);
});
test('shared dice return the same server result displayed to both players',async()=>{
 const {db,a,b}=await setup(),now=Date.now();
 action(db,a,'command',{type:'buy',payload:{type:'dice',id:'shared-die'}},now);
 action(db,a,'layout',{room:'home',items:[{id:'shared-die',x:7,y:7,placed:true}]},now);
 action(db,a,'joinRoom',{key:'home:'+a.id+':home'},now);
 action(db,b,'joinRoom',{key:'home:'+a.id+':home'},now);
 const value=action(db,a,'command',{type:'itemAction',payload:{id:'shared-die',action:'roll'}},now);
 assert.ok(value>=1&&value<=6);assert.equal(db.users[a.id].game.items.find(i=>i.id==='shared-die').value,value);
 assert.ok(snapshot(db,b).chats.some(m=>m.text==='Alice rolled '+value));
 assert.throws(()=>action(db,a,'command',{type:'itemAction',payload:{id:'shared-die',action:'roll'}},now+100));
 assert.equal(db.users[a.id].game.items.find(i=>i.id==='shared-die').value,value);
});
test('session credentials are private and unguessable',async()=>{const {db,a,b}=await setup();assert.notEqual(a.id,b.id);assert.throws(()=>action(db,a,'joinRoom',{key:'bogus'}));const s=snapshot(db,a);assert.equal('auth' in s,false);assert.equal('token' in s.self,false);});
test('one avatar per seat and invalid claims are atomic',async()=>{const {db,a,b}=await setup();action(db,a,'seat',{id:'lounge-0-0',point:[200,400]});assert.throws(()=>action(db,b,'seat',{id:'lounge-0-0',point:[200,400]}));assert.throws(()=>action(db,a,'seat',{id:'lounge-0-1',point:[NaN,400]}));assert.equal(db.rooms['public:0'].seats['lounge-0-0'],a.id);assert.equal(db.rooms['public:0'].seats['lounge-0-1'],undefined);});
test('whispers are visible only to sender and recipient',async()=>{const {db,a,b}=await setup(),c=await createGuest(db,{name:'Cara'}),third=await authenticate(db,c.token);action(db,a,'chat',{text:'private hello',mode:'whisper',to:b.id});assert.ok(snapshot(db,b).chats.some(m=>m.text==='private hello'));assert.equal(snapshot(db,third).chats.some(m=>m.text==='private hello'),false);});
test('trade changes owners only after both final confirmations',async()=>{const {db,a,b}=await setup();action(db,a,'command',{type:'buy',payload:{type:'plant',id:'alice-plant'}});action(db,b,'command',{type:'buy',payload:{type:'lamp',id:'bob-lamp'}});
 const {id}=action(db,a,'trade',{user:b.id});action(db,b,'tradeAccept',{id});action(db,a,'tradeOffer',{id,items:['alice-plant']});action(db,b,'tradeOffer',{id,items:['bob-lamp']});action(db,a,'tradeConfirm',{id});
 assert.ok(db.users[a.id].game.items.some(i=>i.id==='alice-plant'));action(db,b,'tradeConfirm',{id});assert.ok(db.users[a.id].game.items.some(i=>i.id==='bob-lamp'));assert.equal(db.users[a.id].game.items.some(i=>i.id==='alice-plant'),false);assert.throws(()=>action(db,a,'tradeConfirm',{id}));assert.equal(db.users[b.id].game.items.filter(i=>i.id==='alice-plant').length,1);
});
test('changing an offer resets both confirmations; cancellation preserves items',async()=>{const {db,a,b}=await setup();action(db,a,'command',{type:'buy',payload:{type:'plant',id:'plant'}});const {id}=action(db,a,'trade',{user:b.id});action(db,b,'tradeAccept',{id});action(db,a,'tradeOffer',{id,items:['plant']});action(db,a,'tradeConfirm',{id});action(db,b,'tradeOffer',{id,items:[]});assert.deepEqual(db.trades[id].confirmed,[]);action(db,a,'tradeCancel',{id});assert.ok(db.users[a.id].game.items.some(i=>i.id==='plant'));});
test('placed furniture and foreign inventory cannot be offered',async()=>{const {db,a,b}=await setup();const {id}=action(db,a,'trade',{user:b.id});action(db,b,'tradeAccept',{id});assert.throws(()=>action(db,a,'tradeOffer',{id,items:[a.game.items[0].id]}));assert.throws(()=>action(db,a,'tradeOffer',{id,items:[b.game.items[0].id]}));assert.deepEqual(db.trades[id].offers[a.id],[]);});
test('private rooms and doorbell approvals enforce owner rights',async()=>{const {db,a,b}=await setup();const key='home:'+a.id+':home';action(db,a,'command',{type:'roomSettings',payload:{id:'home',door:'private'}});assert.throws(()=>action(db,b,'joinRoom',{key}));action(db,a,'command',{type:'roomSettings',payload:{id:'home',door:'doorbell'}});assert.equal(action(db,b,'joinRoom',{key}).waiting,true);action(db,a,'joinRoom',{key});action(db,a,'door',{user:b.id,allow:true});action(db,b,'joinRoom',{key});assert.equal(db.users[b.id].room,key);assert.throws(()=>action(db,b,'kick',{user:a.id}));});
test('shared performances have a fair queue, one vote and one reward',async()=>{const {db,a,b}=await setup(),now=Date.now();action(db,a,'command',{type:'song',payload:{id:'track',title:'Night drive',pattern:[[1],[1],[1],[1]]}},now);action(db,a,'queue',{song:'track'},now);const r=db.rooms['public:0'];assert.equal(r.stage.user,a.id);assert.throws(()=>action(db,a,'vote',{},now+3000));action(db,b,'vote',{},now+3000);assert.throws(()=>action(db,b,'vote',{},now+4000));tick(db,now+25000);assert.equal(db.users[a.id].game.coins,285);tick(db,now+26000);assert.equal(db.users[a.id].game.coins,285);});
test('server rewards require an actual started arcade round',async()=>{const {db,a}=await setup(),now=Date.now();assert.throws(()=>action(db,a,'command',{type:'game',payload:{id:'fake',game:'quiz',score:800,won:true,elapsed:90000}},now));action(db,a,'arcadeStart',{id:'real',game:'quiz'},now);assert.throws(()=>action(db,a,'command',{type:'game',payload:{id:'real',game:'quiz',score:800,won:true,elapsed:90000}},now+100));action(db,a,'command',{type:'game',payload:{id:'real',game:'quiz',score:800,won:true}},now+9000);assert.equal(db.users[a.id].game.coins,270);});
const song=(db,user,id,now)=>action(db,user,'command',{type:'song',payload:{id,title:'Track '+id,pattern:[[1],[1],[1],[1]]}},now);
const play=(db,artist,listeners,id,now)=>{action(db,artist,'queue',{song:id},now);for(const l of listeners)action(db,l,'vote',{},now+3000);tick(db,now+25000);};
test('applause pays the artist once per listener per day, up to the daily cap',async()=>{
 const {db,a,b}=await setup(),now=Date.parse('2026-10-20T12:00:00Z');song(db,a,'t1',now);
 action(db,a,'queue',{song:'t1'},now);const before=db.users[a.id].game.coins;
 action(db,b,'vote',{},now+3000);assert.equal(db.users[a.id].game.coins,before+5);
 assert.ok(db.users[a.id].notifications[0].text.includes('Bob applauded “Track t1” · +5 ✦'));
 assert.throws(()=>action(db,a,'vote',{},now+3000));tick(db,now+25000);
 // Same listener, same artist, same day: counted on the chart, not paid again.
 const afterSet=db.users[a.id].game.coins;action(db,a,'queue',{song:'t1'},now+30000);action(db,b,'vote',{},now+33000);
 assert.equal(db.users[a.id].game.coins,afterSet);assert.equal(db.users[a.id].notifications[0].text,'Bob applauded “Track t1”');
 // Ten more listeners: only the cap's worth is paid.
 const fans=[];for(let i=0;i<12;i++){const g=await createGuest(db,{name:'Fan'+i});fans.push(await authenticate(db,g.token));}
 tick(db,now+55000);const start=db.users[a.id].game.coins;action(db,a,'queue',{song:'t1'},now+60000);
 for(const f of fans)action(db,f,'vote',{},now+63000);
 assert.equal(db.users[a.id].game.coins-start,45);
 assert.equal(db.users[a.id].game.rewards['applause-2026-10-20'],50);
});
test('the weekly chart ranks unique listeners and pays the top three at rollover',async()=>{
 const {db,a,b}=await setup(),c=await authenticate(db,(await createGuest(db,{name:'Cara'})).token),d=await authenticate(db,(await createGuest(db,{name:'Dev'})).token),now=Date.parse('2026-10-21T12:00:00Z');
 song(db,a,'a1',now);song(db,b,'b1',now);song(db,c,'c1',now);song(db,d,'d1',now);
 play(db,a,[b,c,d],'a1',now);play(db,b,[a,c],'b1',now+30000);play(db,b,[a,c],'b1',now+60000);play(db,c,[a],'c1',now+90000);play(db,d,[],'d1',now+120000);
 const s=snapshot(db,db.users[a.id],now+150000);assert.equal(s.chart.week,'2026-W43');
 assert.deepEqual(s.chart.top.map(e=>[e.title,e.listeners,e.plays]),[['Track a1',3,1],['Track b1',2,2],['Track c1',1,1]]);
 const coins=[a,b,c].map(u=>db.users[u.id].game.coins),monday=Date.parse('2026-10-26T00:00:05Z');
 tick(db,monday);
 assert.deepEqual([a,b,c].map((u,i)=>db.users[u.id].game.coins-coins[i]),[150,100,60]);
 assert.deepEqual(db.users[a.id].game.awards[0],{week:'2026-W43',rank:1,title:'Track a1'});
 assert.equal(db.users[c.id].away[0].kind,'chart');assert.ok(db.users[c.id].away[0].text.includes('#3'));
 tick(db,monday+1000);assert.equal(db.users[a.id].game.coins-coins[0],150);
 const next=snapshot(db,db.users[a.id],monday+2000);assert.equal(next.chart.week,'2026-W44');assert.deepEqual(next.chart.top,[]);assert.equal(next.chart.last.top[0].title,'Track a1');
 assert.equal(weekKey(Date.parse('2026-10-25T23:59:59Z')),'2026-W43');
 const restored=new (await import('../dist/game-core.js')).default.Game(JSON.parse(JSON.stringify(db.users[b.id].game)));assert.equal(restored.state.awards[0].rank,2);
});
test('offline players collect visits and friend requests until they mark them seen',async()=>{
 const {db,a,b}=await setup(),now=Date.now(),key='home:'+a.id+':home';
 action(db,b,'joinRoom',{key},now);assert.deepEqual(db.users[a.id].away,[],'no trace while the owner is online');
 db.users[a.id].lastSeen=now-60000;
 action(db,b,'joinRoom',{key:'public:0'},now+1000);action(db,b,'joinRoom',{key},now+2000);action(db,b,'joinRoom',{key:'public:0'},now+3000);action(db,b,'joinRoom',{key},now+4000);
 action(db,b,'friend',{user:a.id},now+5000);
 assert.deepEqual(db.users[a.id].away.map(e=>e.kind),['friend','visit'],'one visit trace per six hours');
 assert.equal(snapshot(db,db.users[a.id],now+6000).away.length,2);
 action(db,a,'awaySeen',{},now+7000);assert.deepEqual(snapshot(db,db.users[a.id],now+8000).away,[]);
 const friends=snapshot(db,db.users[b.id],now+9000);assert.equal(friends.friends.length,0);
 action(db,a,'answerFriend',{user:b.id,accept:true},now+9000);assert.equal(snapshot(db,db.users[b.id],now+10000).friends[0].lastSeen,now+9000);
});
