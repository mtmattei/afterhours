(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AfterhoursSession=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  async function resumeOrCreate(storage,request,name,avatar) {
    const existing=storage.getItem('afterhours-online-token');
    // Never clear a saved identity on a timeout, server failure, or 401.
    // Only an explicit recovery flow may change which character is selected.
    if(existing)return {token:existing,snapshot:await request('/api/state',undefined,existing)};
    const result=await request('/api/guest',{name,avatar},'');
    storage.setItem('afterhours-online-token',result.token);
    return result;
  }
  return {resumeOrCreate};
});
