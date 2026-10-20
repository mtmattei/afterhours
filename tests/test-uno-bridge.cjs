const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('Uno WebView bridge converts DOM IDs and preserves dispatch return values',()=>{
  const calls=[],view={unoExports:{
    DispatchLoadEvent:(id,url)=>{assert.equal(typeof id,'number');calls.push([id,url]);return 42;},
    DispatchNewWindowRequested:(id,url,ref)=>{assert.equal(typeof id,'number');calls.push([id,url,ref]);return true;}
  }};
  const context={window:{Microsoft:{UI:{Xaml:{Controls:{WebView:view}}}}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../uno/Afterhours.Uno/Platforms/WebAssembly/WasmScripts/AfterhoursInterop.js'),'utf8'),context);
  assert.equal(context.window.AfterhoursUno.prepareWebView(),true);
  assert.equal(view.unoExports.DispatchLoadEvent('123','game/index.html'),42);
  assert.equal(view.unoExports.DispatchNewWindowRequested('123','https://example.test','game/index.html'),true);
  assert.equal(context.window.AfterhoursUno.prepareWebView(),true);
  assert.equal(calls.length,2);assert.equal(calls[0][0],123);
});
test('Uno bridge handles exports registered after WebView construction',()=>{
  const view={},context={window:{Microsoft:{UI:{Xaml:{Controls:{WebView:view}}}}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../uno/Afterhours.Uno/Platforms/WebAssembly/WasmScripts/AfterhoursInterop.js'),'utf8'),context);
  assert.equal(context.window.AfterhoursUno.prepareWebView(),true);
  let received;
  view.unoExports={DispatchLoadEvent:id=>{received=id;}};
  view.unoExports.DispatchLoadEvent('116178','about:blank');
  assert.equal(received,116178);
});
