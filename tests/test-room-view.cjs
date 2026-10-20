const test=require('node:test'),assert=require('node:assert/strict');
const {Camera,Speech}=require('../dist/room-view.js');
const F=require('../dist/furniture.js'),S=require('../dist/seating.js'),G=require('../dist/game-core.js');

test('floor clicks retain their world position at desktop and phone zoom levels',()=>{
 for(const [width,height] of [[1164,380],[358,440]])for(const zoom of [.8,1,1.6,2.4]){
  const c=new Camera();Object.assign(c,{width,height,zoom});c.constrain();
  for(const [x,y] of [[750,530],[200,400],[1200,800]]){
   const screen=c.project(x,y),world=c.unproject(screen.x,screen.y);
   assert.ok(Math.abs(world.x-x)<1e-8&&Math.abs(world.y-y)<1e-8);
  }
 }
});
test('the stage camera stays fixed unless follow is explicitly enabled',()=>{
 const c=new Camera();c.constrain();const before=[c.x,c.y];
 c.track(1450,990,1);assert.deepEqual([c.x,c.y],before);
 c.follow=true;c.track(1450,990,1);assert.ok(c.y>before[1]);
 c.x=-10000;c.y=10000;c.constrain();
 assert.ok(c.x>=0&&c.x<=1500&&c.y>=0&&c.y<=1000);
});
test('speech preserves full messages, stacks two, expires and keeps whispers private',()=>{
 const s=new Speech(),message='A'.repeat(160);
 s.add('a','Alice',message,10000,'say',1000);s.add('a','Alice',message,10000,'say',1000);
 assert.equal(s.active(1000)[0].entries.length,1);assert.equal(s.active(1000)[0].entries[0].text,message);
 s.add('a','Alice','second',11000,'say',2000);s.add('a','Alice','third',12000,'shout',3000);
 assert.deepEqual(s.active(3000)[0].entries.map(e=>e.text),['second','third']);
 s.add('b','Bob','private',12000,'whisper',3000);assert.equal(s.active(3000).length,1);
 assert.equal(s.active(11000)[0].entries.length,1);assert.deepEqual(s.active(12000),[]);
 s.add('a','Alice','new room',15000,'say',13000);s.clear();assert.deepEqual(s.active(13000),[]);
});
test('every new catalog piece purchases at its authoritative price and survives save validation',()=>{
 const entries=Object.entries(F.catalog).filter(([,v])=>v.atlas);
 assert.equal(entries.length,32);
 for(const [type,item] of entries){
  const g=new G.Game(null,{coins:240,decor:F.starter()});
  g.dispatch('buy',{type,id:'new-piece'});assert.equal(g.state.coins,240-item.price);
  const restored=new G.Game(JSON.parse(JSON.stringify(g.state)));
  assert.equal(restored.state.items.find(i=>i.id==='new-piece').type,type);
  assert.equal(restored.state.items.find(i=>i.id==='starter-sofa').type,'sofa');
 }
});
test('every seat rotation has a distinct reachable approach outside its footprint',()=>{
 for(const [type,c] of Object.entries(F.catalog).filter(([,c])=>c.seats))for(const rot of [0,1]){
  const item={id:'seat',type,x:3,y:3,rot,placed:true},slots=S.slots(item),tiles=new Set(F.tiles(item));
  assert.equal(slots.length,c.seats.length);assert.equal(new Set(slots.map(s=>s.id)).size,slots.length);
  for(const slot of slots){assert.equal(tiles.has(slot.approaches[0].x-.5+','+(slot.approaches[0].y-.5)),false);assert.ok(slot.anchor.every(n=>n>0&&n<1));}
  assert.deepEqual(S.slots({...item,placed:false}),[]);
 }
});
test('seated avatars remain behind closer furniture and ahead of their own chair',()=>{
 const seat={id:'sofa:with-colon',type:'loveseat',x:2,y:2,rot:0,placed:true};
 const foreground={id:'shelf',type:'bookcase',x:2,y:5,rot:0,placed:true};
 const actor={x:2.5,y:3.5},depth=F.actorDepth(actor,'sofa:with-colon:1',[seat,foreground]);
 assert.ok(depth>F.depth(seat));assert.ok(depth<F.depth(foreground));
 assert.equal(F.actorDepth(actor,'missing:0',[seat]),actor.x+actor.y);
});
