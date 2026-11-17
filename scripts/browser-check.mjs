// Optional local QA. Start headless Chrome with --remote-debugging-port=9223.
// Uses only Node 22 built-ins; no browser packages or game dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const targets=await (await fetch('http://127.0.0.1:9223/json/list')).json();
const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);});
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function navigate(method,params={}){const loaded=new Promise(resolve=>{const listener=e=>{if(JSON.parse(e.data).method==='Page.loadEventFired'){ws.removeEventListener('message',listener);resolve();}};ws.addEventListener('message',listener);});await send(method,params);await loaded;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Timeout: '+expression+'; state='+JSON.stringify(await evaluate('({state:Parkour.app.game.state,hidden:document.hidden,animation:Parkour.app.renderer.animation})'))+'; exceptions='+JSON.stringify(errors));}
async function screenshot(name){const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(root,'assets',name),Buffer.from(data,'base64'));}
try{
await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1400,deviceScaleFactor:1,mobile:false});
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
await navigate('Page.navigate',{url:pathToFileURL(path.join(root,'index.html')).href});
await until('!!window.Parkour?.app');
await evaluate("Parkour.app.game.state.phase='idle'; localStorage.clear()");
await navigate('Page.reload');await until('!!window.Parkour?.app');
await evaluate("document.body.dataset.theme='light'");
await screenshot('screenshot.png');
assert.equal(await evaluate("document.querySelectorAll('.topic').length"),6);
await evaluate("document.getElementById('start').click()");
await until("Parkour.app.game.state.phase==='question'");
assert.equal(await evaluate("document.querySelectorAll('.answer').length"),2);
// Verify real keyboard routing, then let the physical animation finish.
const correct=await evaluate('Parkour.app.game.state.current.correct');
await send('Input.dispatchKeyEvent',{type:'keyDown',key:String(correct+1),code:'Digit'+(correct+1)});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:String(correct+1),code:'Digit'+(correct+1)});
await until("Parkour.app.game.state.phase==='feedback'");
assert.equal(await evaluate('Parkour.app.game.state.score'),100);
await evaluate("document.getElementById('next').click(); document.querySelectorAll('.answer')[(Parkour.app.game.state.current.correct+1)%2].click()");
await until("Parkour.app.game.state.phase==='feedback'");
assert.equal(await evaluate('Parkour.app.game.state.lives'),2);
assert.ok(await evaluate("!document.getElementById('feedback').hidden"));
await evaluate("document.getElementById('next').click()");
assert.equal(await evaluate('Parkour.app.game.state.index'),0);
// Reload tests persistence, including pausing instead of silently running the timer.
await navigate('Page.reload');await until("!!window.Parkour?.app && document.getElementById('pauseDialog').open");
assert.equal(await evaluate('Parkour.app.game.state.lives'),2);
await evaluate("document.getElementById('resume').click(); Parkour.app.renderer.reduced=true");
// Complete the question course with real answer button clicks.
for(let i=0;i<10;i++){
 await evaluate("document.querySelectorAll('.answer')[Parkour.app.game.state.current.correct].click()");
 await until("Parkour.app.game.state.phase==='feedback'");
 await evaluate("document.getElementById('next').click()");
}
assert.equal(await evaluate('Parkour.app.game.state.phase'),'final');
for(let i=0;i<3;i++){
 await evaluate("Parkour.app.game.state.gauge=.5; document.getElementById('jump').click()");
 await until("['final','finished'].includes(Parkour.app.game.state.phase)");
}
assert.ok(await evaluate("document.getElementById('resultDialog').open"));
assert.equal(await evaluate("document.querySelectorAll('.mistake').length"),1);
assert.equal(await evaluate("document.querySelectorAll('.result-stats b').length"),3);
await evaluate("document.querySelector('[data-close=resultDialog]').click(); document.getElementById('shopOpen').click()");
// Purchase and equip the blue skin using earned coins.
await evaluate("document.querySelectorAll('.shop-item button')[1].click()");
assert.ok(await evaluate("document.querySelectorAll('.shop-item button')[1].disabled"));
await evaluate("document.querySelector('[data-close=shopDialog]').click(); document.getElementById('lang').click()");
assert.equal(await evaluate('document.documentElement.lang'),'en');
assert.equal(await evaluate("document.getElementById('start').innerText.includes('Start your run')"),true);
// Import through the actual file input.
const {root:doc}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:doc.nodeId,selector:'#importFile'});
await send('DOM.setFileInputFiles',{nodeId,files:[path.join(root,'questions/en.json')]});
await until("!document.getElementById('customTopic').hidden");
assert.ok(await evaluate("document.getElementById('customTopic').classList.contains('active')"));
// At 360 px the whole document must fit without horizontal scrolling.
await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
await sleep(200);
assert.ok(await evaluate('document.documentElement.scrollWidth<=360'));
await screenshot('mobile.png');
// Both dark theme and reduced motion render without errors.
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]});
await evaluate("document.body.dataset.theme='dark'");await sleep(100);
assert.ok(await evaluate('Parkour.app.renderer.reduced'));
assert.equal(errors.length,0,errors.join('\n'));
console.log('Browser QA passed: file launch, keyboard, animation, wrong answer, checkpoint, reload, finish, shop, i18n, file import, 360px, dark mode, reduced motion. No JS exceptions.');
}finally{if(process.argv.includes('--close-browser'))await send('Browser.close').catch(()=>{});ws.close();}
