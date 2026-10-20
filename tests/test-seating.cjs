const assert=require('node:assert/strict');
const S=require('../dist/seating.js');
const M=require('../dist/movement.js');
const F=require('../dist/furniture.js');
let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++}
const sofa={id:'sofa',type:'sofa',x:3,y:3,rot:0,placed:true};
const options=()=>({min:1,max:8,blocked:new Set(F.tiles(sofa))});
test('sofas have two seats with separate front approaches',()=>{
 const slots=S.slots(sofa);assert.equal(slots.length,2);
 assert.deepEqual(slots.map(x=>x.approaches[0]),[{x:3.5,y:4.5},{x:4.5,y:4.5}]);
 assert.equal(new Set(slots.map(s=>s.id)).size,2);
});
test('rotating furniture also rotates its seating approaches',()=>{
 const slots=S.slots({...sofa,rot:1});
 assert.deepEqual(slots.map(x=>x.approaches[0]),[{x:4.5,y:3.5},{x:4.5,y:4.5}]);
 assert.equal(slots[0].flip,false);
});
test('stored furniture and non-seating items do not offer seats',()=>{
 assert.deepEqual(S.slots({...sofa,placed:false}),[]);
 assert.deepEqual(S.slots({...sofa,type:'table'}),[]);
 assert.equal(S.slots({...sofa,type:'seat'}).length,1);
});
test('a blocked sofa entrance selects the other usable cushion',()=>{
 const opts=options();opts.blocked.add('3,4');
 const choice=S.plan(S.slots(sofa),{x:6.5,y:6.5},opts);
 assert.equal(choice.offer.index,1);
 opts.blocked.add('4,4');
 assert.equal(S.plan(S.slots(sofa),{x:6.5,y:6.5},opts),null);
});
test('reserved seats cannot be selected',()=>{
 const slots=S.slots(sofa);
 assert.equal(S.plan(slots,{x:6.5,y:6.5},options(),new Set([slots[0].id])).offer.index,1);
 assert.equal(S.plan(slots,{x:6.5,y:6.5},options(),new Set(slots.map(s=>s.id))),null);
});
function fixture(){const actor={x:6.5,y:6.5},walker=new M.Walker(actor,options);let exists=true;const seat=new S.Controller(walker,options,()=>exists);return{actor,walker,seat,remove:()=>exists=false}}
test('the avatar walks to the entrance before sitting',()=>{
 const f=fixture();assert(f.seat.request(S.slots(sofa)));
 assert.equal(f.seat.mode,'approaching');assert.deepEqual([f.actor.x,f.actor.y],[6.5,6.5]);
 for(let n=0;n<250;n++){f.walker.update(1/60);f.seat.update(1/60)}
 assert.equal(f.seat.mode,'sitting');assert.deepEqual([f.actor.x,f.actor.y],[3.5,4.5]);
 assert.equal(f.seat.settle,1);assert.equal(f.walker.path.length,0);
});
test('standing permits an ordinary walking route again',()=>{
 const f=fixture();f.seat.request(S.slots(sofa));
 for(let n=0;n<250;n++){f.walker.update(1/60);f.seat.update(1/60)}
 f.seat.stand();assert(f.walker.goTo({x:7.5,y:7.5}));
 for(let n=0;n<250;n++){f.walker.update(1/60);f.seat.update(1/60)}
 assert.equal(f.seat.mode,'standing');assert.deepEqual([f.actor.x,f.actor.y],[7.5,7.5]);
});
test('cancelling an approach cannot trigger a late sit',()=>{
 const f=fixture();f.seat.request(S.slots(sofa));f.seat.stand();f.walker.goTo({x:7.5,y:7.5});
 for(let n=0;n<200;n++){f.walker.update(1/60);f.seat.update(1/60)}
 assert.equal(f.seat.mode,'standing');assert.equal(f.seat.target,null);
});
test('removing a target cancels the pending action safely',()=>{
 const f=fixture();f.seat.request(S.slots(sofa));f.remove();f.seat.update(.016);
 assert.equal(f.seat.mode,'standing');assert.equal(f.walker.path.length,0);
});
console.log(`${count} seating checks passed.`);
