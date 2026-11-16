import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { issueToken } from '../lib/access.mjs';
// Doble de MySQL: ningún test de funciones abre conexiones de red.
const mock='export default { createPool(){ return { query: (...args) => globalThis.mockQuery(...args) }; } };';
registerHooks({resolve(specifier,context,next){return specifier==='mysql2/promise'?{url:'data:text/javascript,'+encodeURIComponent(mock),shortCircuit:true}:next(specifier,context);}});
process.env.DB_HOST='test.invalid';process.env.DB_USER='test';process.env.DB_NAME='test';process.env.GEMINI_API_KEY='test-key-never-production';process.env.TICKET_TOKEN_SECRET='test-only-private-token-secret-32bytes-minimum';
process.env.AYUDA_PIN='test-pin';
const tickets=(await import('../netlify/functions/tickets.mjs')).default;
const agent=(await import('../netlify/functions/agente.mjs')).default;
const chat=(await import('../netlify/functions/chat.mjs')).default;
const data=(await import('../netlify/functions/data.mjs')).default;
const seguimiento=(await import('../netlify/functions/seguimiento.mjs')).default;
const originalFetch=globalThis.fetch;
const row={id:7,asunto:'Consultar inventario',nombre:'Privado',correo:'privado@example.invalid',categoria:'Inventario',prioridad:'Media',estado:'Abierto',descripcion:'Consultar stock por material',ts:1000};
let queries=[];
const reset=()=>{queries=[];globalThis.mockQuery=async options=>{queries.push(options);return [options.sql.startsWith('SELECT')?[row]:{insertId:7},[]];};globalThis.fetch=()=>{throw new Error('Red no permitida en pruebas');};};
const request=(path,method='GET',body,headers={})=>new Request('http://local'+path,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const owner=()=>({authorization:'Bearer '+issueToken(7)}),admin={'x-admin-pin':'test-pin'};
test.after(()=>{globalThis.fetch=originalFetch;});
test('visitante no puede listar tickets ni consultar notas o ejecutar IA',async()=>{
  reset();assert.equal((await tickets(request('/api/tickets'),{ip:'denied'})).status,403);
  assert.equal((await agent(request('/api/agente','POST',{id:7}),{ip:'denied'})).status,403);
  assert.equal((await seguimiento(request('/api/seguimiento?id=7'),{ip:'denied'})).status,403);assert.equal(queries.length,0);
});
test('código privado filtra SQL por propietario y no devuelve correo',async()=>{
  reset();const response=await tickets(request('/api/tickets','GET',null,owner()),{ip:'owner'});
  assert.equal(response.status,200);assert.match(queries[0].sql,/WHERE id = \?/);assert.deepEqual(queries[0].values,[7]);
  const text=await response.text();assert.ok(!text.includes(row.correo));
  assert.equal((await agent(request('/api/agente','POST',{id:8},owner()),{ip:'owner'})).status,403);
});
test('crear ticket devuelve código y mantiene consulta parametrizada',async()=>{
  reset();globalThis.mockQuery=async options=>{queries.push(options);return [options.sql.startsWith('SELECT COUNT')?[{n:0}]:options.sql.startsWith('SELECT')?[row]:{insertId:7},[]];};
  const response=await tickets(request('/api/tickets','POST',{name:'Usuario',email:'u@example.invalid',subject:'Problema de prueba',description:'Descripción de prueba suficiente',category:'Sistemas',priority:'Alta'}),{ip:'create'});
  assert.equal(response.status,201);assert.match((await response.json()).accessToken,/\./);
  assert.ok(queries.some(q=>q.sql.includes('VALUES (?,?,?,?,?,?)')&&q.values[0]==='Problema de prueba'));
});
test('PIN incorrecto no modifica; PIN correcto permite cierre humano',async()=>{
  reset();assert.equal((await tickets(request('/api/tickets?id=7','PATCH',{estado:'Resuelto'},{'x-admin-pin':'bad'}),{ip:'admin1'})).status,403);assert.equal(queries.length,0);
  assert.equal((await tickets(request('/api/tickets?id=7','PATCH',{estado:'Resuelto'},admin),{ip:'admin2'})).status,200);
  assert.deepEqual(queries[0].values,['Resuelto',7]);
});
test('agente autorizado conserva modelo, usa clave backend y no cierra aun si Gemini lo pide',async()=>{
  reset();globalThis.fetch=async(url,options)=>{
    assert.match(url,/gemini-3\.5-flash-lite:generateContent/);assert.equal(options.headers['x-goog-api-key'],process.env.GEMINI_API_KEY);
    return Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'responder_solicitud',args:{respuesta:'Revisa los pasos.',estado:'Resuelto',categoria:'Inventario',prioridad:'Media',escalar:false}}}]}}]});
  };
  assert.equal((await agent(request('/api/agente','POST',{id:'BV-7'},owner()),{ip:'agent'})).status,200);
  const update=queries.find(q=>q.sql.startsWith('UPDATE'));assert.equal(update.values[2],'En proceso');assert.match(update.sql,/CASE WHEN estado = 'Resuelto'/);
});
test('chat conserva modelo e identifica Gemini sin exponer clave',async()=>{
  reset();globalThis.mockQuery=async()=>[[],[]];globalThis.fetch=async(url,options)=>{assert.match(url,/gemini-3\.6-flash:generateContent/);assert.ok(options.signal);return Response.json({candidates:[{content:{parts:[{text:'Respuesta de prueba'}]}}]});};
  const response=await chat(request('/api/chat','POST',{message:'Hola',history:[]}),{ip:'chat'});const result=await response.json();assert.equal(result.source,'gemini');assert.equal(result.reply,'Respuesta de prueba');assert.ok(!JSON.stringify(result).includes(process.env.GEMINI_API_KEY));
});
test('cuota y timeout de Gemini no revelan errores internos',async()=>{
  reset();globalThis.fetch=async()=>Response.json({error:{message:'sensitive provider info'}},{status:429});
  const response=await chat(request('/api/chat','POST',{message:'Hola'}),{ip:'quota'});assert.equal(response.status,429);assert.ok(!(await response.text()).includes('sensitive'));
  globalThis.fetch=async()=>{const e=new Error('sensitive timeout');e.name='TimeoutError';throw e;};
  const timeout=await chat(request('/api/chat','POST',{message:'Hola'}),{ip:'timeout'});assert.equal(timeout.status,504);assert.ok(!(await timeout.text()).includes('sensitive'));
});
test('analytics agrega kWh en SQL y parametriza fecha y planta',async()=>{
  reset();globalThis.mockQuery=async options=>{queries.push(options);return [[{records:2,kwh:2003,unknown:0}],[]];};
  const response=await data(request('/api/data?view=analytics&from=2024-01-01&to=2024-01-02&plant=7'));assert.equal(response.status,200);
  assert.equal(queries.length,4);assert.ok(queries.every(q=>q.sql.includes('cantidad * 1000')));assert.deepEqual(queries[0].values,['2024-01-01','2024-01-02','7','7']);
  assert.equal((await data(request('/api/data?view=analytics&from=wrong'))).status,400);
});
test('seguimiento docente valida y parametriza notas internas',async()=>{
  reset();assert.equal((await seguimiento(request('/api/seguimiento?id=7','POST',{nota:'Prueba interna',responsable:'Docente'},admin),{ip:'follow'})).status,201);
  const insert=queries.find(q=>q.sql.startsWith('INSERT'));assert.deepEqual(insert.values,[7,'Docente','Prueba interna']);
});
test('sin secreto privado no se crea ticket ni se escribe en TiDB',async()=>{
  reset();const saved=process.env.TICKET_TOKEN_SECRET;delete process.env.TICKET_TOKEN_SECRET;
  try { assert.equal((await tickets(request('/api/tickets','POST',{name:'Usuario'}),{ip:'no-secret'})).status,503);assert.equal(queries.length,0); } finally { process.env.TICKET_TOKEN_SECRET=saved; }
});
test('respuesta parcial de TiDB no sustituye consultas fallidas por muestras',async()=>{
  reset();globalThis.mockQuery=async options=>{
    if(options.sql.includes('COUNT(*) FROM plantas'))return [[{plants:0,energy:0}],[]];
    if(options.sql.startsWith('SELECT id_planta'))return [[],[]];
    throw new Error('mock failure');
  };
  const response=await data(request('/api/data'),{ip:'partial'});assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.plants,[]);assert.equal(result.biomass,null);assert.equal(result.stats.clients,null);assert.equal(result.availability.inventory,false);
});
