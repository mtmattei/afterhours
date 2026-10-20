const assert = require('node:assert/strict');
const M = require('../dist/movement.js');
const F = require('../dist/furniture.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
test('path detours around occupied tiles without cutting corners', () => {
  const blocked = new Set(['4,4','4,5','4,6']);
  const start = {x:3.5,y:5.5};
  const path = M.route(start,{x:5.5,y:5.5},{blocked,min:1,max:8});
  assert.deepEqual(path.goal,{x:5.5,y:5.5});
  let prev=start;
  for(const p of path.nodes){
    assert(!blocked.has(M.key(p)));
    if(p.x!==prev.x&&p.y!==prev.y){
      assert(!blocked.has(M.key({x:p.x,y:prev.y})));
      assert(!blocked.has(M.key({x:prev.x,y:p.y})));
    }
    prev=p;
  }
});
test('occupied destinations resolve to a reachable neighbor',()=>{
  const path=M.route({x:3.5,y:3.5},{x:6.5,y:6.5},{blocked:new Set(['6,6'])});
  assert.notEqual(M.key(path.goal),'6,6');
  assert(Math.hypot(path.goal.x-6.5,path.goal.y-6.5)<=1);
});
test('outside destinations are rejected',()=>{
  assert.equal(M.route({x:3.5,y:3.5},{x:-1,y:9}),null);
});
function simulate(fps,seconds=4){
  const actor={x:2.5,y:2.5};
  const walker=new M.Walker(actor,()=>({}));
  walker.goTo({x:8.5,y:8.5});
  for(let n=0;n<seconds*fps;n++)walker.update(1/fps);
  return {actor,walker};
}
test('30, 60, 120 Hz all arrive exactly and finish standing',()=>{
  for(const fps of [30,60,120]){
    const {actor,walker}=simulate(fps);
    assert.deepEqual([actor.x,actor.y],[8.5,8.5]);
    assert.equal(walker.speed,0);assert.equal(walker.moving,false);
  }
});
test('walking distance and gait agree across frame rates',()=>{
  const low=simulate(30,1),high=simulate(120,1);
  assert(Math.abs(low.walker.totalDistance-high.walker.totalDistance)<.00001);
  assert(Math.abs(low.walker.phase-high.walker.phase)<.00001);
});
test('retargeting mid-step does not teleport and reaches the new tile',()=>{
  const actor={x:2.5,y:2.5},walker=new M.Walker(actor,()=>({}));
  walker.goTo({x:8.5,y:8.5});walker.update(.1);walker.update(.1);
  const before={x:actor.x,y:actor.y};walker.goTo({x:2.5,y:7.5});
  assert.deepEqual({x:actor.x,y:actor.y},before);
  for(let i=0;i<300;i++)walker.update(1/60);
  assert.deepEqual([actor.x,actor.y],[2.5,7.5]);
});
test('starter furnishings have valid, disjoint footprints',()=>{
  const pieces=F.starter();
  for(const piece of pieces)assert(F.canPlace(piece,pieces,{x:4.5,y:4.5}),piece.id);
});
test('rotation swaps the sofa footprint',()=>{
  const sofa=F.starter()[0];
  assert.deepEqual(F.footprint({...sofa,rot:0}),{w:2,d:1});
  assert.deepEqual(F.footprint({...sofa,rot:1}),{w:1,d:2});
});
test('placement rejects collisions, player tile, and room edges',()=>{
  const pieces=F.starter(),table=pieces.find(p=>p.type==='table');
  assert(!F.canPlace({...table,x:7,y:1},pieces));
  assert(!F.canPlace({...table,x:4,y:4},pieces,{x:4.5,y:4.5}));
  assert(!F.canPlace({...table,x:9,y:4},pieces));
  assert(F.canPlace({...table,x:5,y:6},pieces));
});
test('stored pieces do not block placement',()=>{
  const table={id:'a',type:'table',x:3,y:3,rot:0};
  assert(F.canPlace(table,[{...table,id:'b',placed:false}]));
  assert(!F.canPlace(table,[{...table,id:'b',placed:true}]));
});
console.log(`${passed} mechanics checks passed.`);
