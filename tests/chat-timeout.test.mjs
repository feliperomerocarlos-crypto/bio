import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='mysql2/promise'?{url:'data:text/javascript,'+encodeURIComponent('export default {createPool: options=>globalThis.chatTestPool(options)}'),shortCircuit:true}:next(specifier,context);}});
let sequence=0;
const flush=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};
const advance=async(t,ms)=>{t.mock.timers.tick(ms);await flush();};
const req=(message='Consulta de prueba',history=[])=>new Request('http://local/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history})});
const answer=()=>Response.json({candidates:[{content:{parts:[{text:'Respuesta de Gemini simulada'}]}}]});
async function setup(t,{db=false,pool}={}){
 process.env.GEMINI_API_KEY='chat-test-never-production';for(const key of ['DB_HOST','DB_USER','DB_NAME']){if(db)process.env[key]='test.invalid';else delete process.env[key];}
 globalThis.chatTestPool=pool||(()=>{throw Error('No debe consultar TiDB');});
 t.mock.timers.enable({apis:['setTimeout','Date'],now:100000});
 const timeouts=[];t.mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);const c=new AbortController();setTimeout(()=>c.abort(new DOMException('test deadline','TimeoutError')),ms);return c.signal;});
 const handler=(await import('../netlify/functions/chat.mjs?deadline-case='+sequence++)).default;
 return {handler,timeouts};
}
test('Gemini puede responder después de 12 segundos sin corte anticipado ni cambio de modelo',async t=>{
 const {handler,timeouts}=await setup(t);let done=false;
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.match(url,/gemini-3\.6-flash:generateContent/);return new Promise((resolve,reject)=>{setTimeout(()=>resolve(answer()),16000);options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});});
 const pending=handler(req(),{ip:'slow'}).then(r=>{done=true;return r;});await flush();assert.deepEqual(timeouts,[35000]);await advance(t,12001);assert.equal(done,false);await advance(t,3999);const r=await pending;assert.equal(r.status,200);assert.equal((await r.json()).source,'gemini');
});
test('TiDB bloqueado termina en ocho segundos, cancela conexiones y no encola las 14 consultas',async t=>{
 let queries=0,destroyed=0,model=false;const {handler}=await setup(t,{db:true,pool:()=>({getConnection:async()=>({query:()=>{queries++;return new Promise(()=>{});},destroy(){destroyed++;},release(){throw Error('No debe reutilizar una conexión vencida');}})})});
 t.mock.method(globalThis,'fetch',async()=>{model=true;return answer();});const pending=handler(req(),{ip:'db-hung'});await flush();assert.equal(queries,4);assert.equal(model,false);await advance(t,8000);const r=await pending;assert.equal(r.status,200);assert.equal((await r.json()).dataSource,'unavailable');assert.equal(destroyed,4);assert.equal(queries,4);
});
test('una conexión tardía se libera sin ejecutar SQL después del plazo',async t=>{
 let released=0,queries=0;const {handler}=await setup(t,{db:true,pool:()=>({getConnection:()=>new Promise(resolve=>setTimeout(()=>resolve({query(){queries++;return Promise.resolve([[],[]]);},release(){released++;},destroy(){}}),12000))})});t.mock.method(globalThis,'fetch',async()=>answer());const pending=handler(req(),{ip:'late'});await flush();await advance(t,8000);assert.equal((await pending).status,200);await advance(t,4000);assert.equal(queries,0);assert.equal(released,4);
});
test('solicitudes concurrentes comparten el resumen y la caché evita nuevas lecturas',async t=>{
 let queries=0,active=0,peak=0,pools=0;const {handler}=await setup(t,{db:true,pool:options=>{pools++;assert.equal(options.connectionLimit,4);assert.equal(options.ssl.minVersion,'TLSv1.2');return {getConnection:async()=>({query:()=>new Promise(resolve=>{queries++;active++;peak=Math.max(peak,active);setTimeout(()=>{active--;resolve([[],[]]);},100);}),release(){},destroy(){}})};}});
 t.mock.method(globalThis,'fetch',async()=>answer());const a=handler(req(),{ip:'cache-a'}),b=handler(req(),{ip:'cache-b'});await flush();for(let i=0;i<4;i++)await advance(t,100);assert.equal((await a).status,200);assert.equal((await b).status,200);assert.equal(queries,14);assert.equal(peak,4);assert.equal(pools,1);assert.equal((await handler(req(),{ip:'cache-c'})).status,200);assert.equal(queries,14);
});
test('el historial conserva mensajes recientes y la pregunta actual dentro del presupuesto',async t=>{
 const {handler}=await setup(t);let payload;t.mock.method(globalThis,'fetch',async(_url,options)=>{payload=JSON.parse(options.body);return answer();});const history=Array.from({length:12},(_,i)=>({role:i%2?'assistant':'user',content:String(i).padStart(2,'0')+'x'.repeat(3998)}));const message='Pregunta actual intacta';const response=await handler(req(message,history),{ip:'history'});assert.equal(response.status,200);assert.ok(payload.contents.reduce((n,m)=>n+m.parts[0].text.length,0)<=12000);assert.equal(payload.contents[0].role,'user');assert.equal(payload.contents.at(-1).parts[0].text,message);assert.ok(payload.contents.some(m=>m.parts[0].text.startsWith('10')));assert.equal(payload.generationConfig.maxOutputTokens,2048);
});
test('distingue el 504 de Google del vencimiento local y protege errores de lectura del cuerpo',async t=>{
 const {handler}=await setup(t);
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:{message:'private provider detail'}},{status:504}));let r=await handler(req(),{ip:'provider-deadline'});assert.equal(r.status,504);let body=await r.json();assert.equal(body.code,'GEMINI_DEADLINE_EXCEEDED');assert.ok(!JSON.stringify(body).includes('private'));
 globalThis.fetch=async()=>({ok:true,json:async()=>{throw new DOMException('private body detail','TimeoutError');}});r=await handler(req(),{ip:'body-deadline'});body=await r.json();assert.equal(r.status,504);assert.equal(body.code,'ASSISTANT_TIMEOUT');assert.ok(!JSON.stringify(body).includes('private'));
 globalThis.fetch=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));const pending=handler(req(),{ip:'local-deadline'});await flush();await advance(t,35000);r=await pending;assert.equal(r.status,504);assert.equal((await r.json()).code,'ASSISTANT_TIMEOUT');
});
