import game from '../dist/server/index.js';

// The bounded playtest has one world document. Route every API writer through
// the same object so D1 read/modify/write operations cannot starve each other.
// D1 remains the source of truth; this coordinator stores no player data.
export class SharedWorld {
  constructor(state,env){this.state=state;this.env=env;}
  handle(request){return game.fetch(request,this.env);}
  fetch(request){return this.state.blockConcurrencyWhile(()=>this.handle(request));}
}

export default {
  fetch(request,env){
    if(!new URL(request.url).pathname.startsWith('/api/'))return game.fetch(request,env);
    if(!env.WORLD)return Response.json({error:'The shared world coordinator is unavailable. Saved progress is safe.'},{status:503});
    return env.WORLD.get(env.WORLD.idFromName('main')).fetch(request);
  }
};
