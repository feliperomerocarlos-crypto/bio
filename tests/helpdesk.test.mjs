import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpdesk-db-fixture.mjs';
registerHooks({resolve(specifier,context,next){
  if(specifier==='mysql2/promise')return {url:'data:text/javascript,'+encodeURIComponent('export default {createPool(){return {query:(...a)=>globalThis.hdFixture.pool.query(...a),getConnection:()=>globalThis.hdFixture.pool.getConnection()}}}'),shortCircuit:true};
  if(specifier==='nodemailer')return {url:'data:text/javascript,'+encodeURIComponent('export default {createTransport(){return {async sendMail(data){if(globalThis.mailFailure)throw new Error("SMTP simulated");globalThis.mails.push(data)},close(){}}}}'),shortCircuit:true};
  return next(specifier,context);
}});
Object.assign(process.env,{DB_HOST:'test.invalid',DB_USER:'test',DB_NAME:'test',GEMINI_API_KEY:'test-only-gemini-key',TICKET_TOKEN_SECRET:'test-only-secret-at-least-32-characters-long',AYUDA_PIN:'test-pin',SMTP_HOST:'smtp.test.invalid',SMTP_USER:'test',SMTP_PASSWORD:'test-only-smtp-password',SUPPORT_FROM:'BioVolt <support@example.invalid>'});
const {issueToken,tokenId}=await import('../lib/access.mjs');
const tickets=(await import('../netlify/functions/tickets.mjs')).default;
const agent=(await import('../netlify/functions/agente.mjs')).default;
const follow=(await import('../netlify/functions/seguimiento.mjs')).default;
const store=await import('../lib/helpdesk-store.mjs');
let db,providerCalls=[],ipCounter=0;
const originalFetch=globalThis.fetch;
const final=(extra={})=>Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'responder_solicitud',args:{respuesta:'Consulta el módulo de inventario y comparte el material que necesitas revisar.',categoria:'Inventario',prioridad:'Media',estado:'Resuelto',escalar:false,...extra}}}]}}]});
const body={name:'Solicitante de prueba',email:'owner@example.invalid',subject:'Consultar inventario',category:'Inventario',priority:'Media',description:'Necesito consultar la disponibilidad del material.'};
const req=(method='GET',data,url='/api/tickets',headers={})=>new Request('http://local'+url,{method,headers:{'Content-Type':'application/json',...headers},...(data?{body:JSON.stringify(data)}:{})});
const ctx=()=>({ip:'test-'+(++ipCounter)});
const owner=id=>({authorization:'Bearer '+issueToken(id)}),admin={'x-admin-pin':'test-pin'};
const call=async(method,data,url,headers,context=ctx())=>{const response=await tickets(req(method,data,url,headers),context);return {status:response.status,data:await response.json()};};
async function create(overrides={},context=ctx(),idempotency=randomUUID()){
  return call('POST',{...body,...overrides},'/api/tickets',{'x-idempotency-key':idempotency},context);
}
test.beforeEach(()=>{db=fixture();globalThis.hdFixture=db;globalThis.mails=[];globalThis.mailFailure=false;providerCalls=[];globalThis.fetch=async(url,options)=>{assert.match(url,/generativelanguage.googleapis.com/);assert.match(url,/gemini-3\.5-flash-lite/);assert.equal(options.headers['x-goog-api-key'],process.env.GEMINI_API_KEY);providerCalls.push(JSON.parse(options.body));return final();};});
test.afterEach(()=>db.close());test.after(()=>{globalThis.fetch=originalFetch;});

test('la creación inicia al agente en servidor y devuelve el código antes del análisis con waitUntil',async()=>{
  const tasks=[],created=await create({}, {...ctx(),waitUntil:task=>tasks.push(task)});
  assert.equal(created.status,201);assert.equal(tokenId(req('GET',null,'/',{authorization:'Bearer '+created.data.accessToken})),1);assert.equal(tasks.length,1);
  await Promise.all(tasks);
  const result=await call('GET',null,'/api/tickets?id=1',owner(1));assert.equal(result.status,200);assert.equal(result.data.ticket.ai.status,'respondido');assert.equal(result.data.ticket.status,'En proceso');assert.equal(result.data.messages.filter(m=>m.role==='agente').length,1);assert.equal(providerCalls.length,1);
});
test('sin waitUntil también se responde por IA; llamadas repetidas no consumen Gemini otra vez',async()=>{
  const created=await create();assert.equal(created.status,201);assert.equal(created.data.ticket.ai.status,'respondido');
  for(let i=0;i<2;i++)assert.equal((await agent(req('POST',{id:1},'/api/agente',owner(1)),ctx())).status,200);
  assert.equal(providerCalls.length,1);
});
test('dos procesos simultáneos comparten lease y solo uno llama a Gemini',async()=>{
  let release,started;const ready=new Promise(r=>started=r);
  globalThis.fetch=async()=>{providerCalls.push({});started();return new Promise(r=>release=()=>r(final()));};
  const tasks=[];await create({}, {...ctx(),waitUntil:p=>tasks.push(p)});await ready;
  const results=await Promise.all([agent(req('POST',{id:1},'/api/agente',owner(1)),ctx()),agent(req('POST',{id:1},'/api/agente',owner(1)),ctx())]);
  assert.ok(results.every(r=>r.status===202));assert.equal(providerCalls.length,1);release();await Promise.all(tasks);
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM ayuda_mensajes WHERE autor='agente'").get().n,1);
});
test('idempotencia de creación evita tickets duplicados por doble envío concurrente',async()=>{
  const key=randomUUID();const results=await Promise.all([create({},ctx(),key),create({},ctx(),key)]);
  assert.ok(results.every(r=>[200,201].includes(r.status)));assert.equal(new Set(results.map(r=>r.data.ticket.id)).size,1);assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM solicitudes_ayuda').get().n,1);
  const conflict=await create({subject:'Otra solicitud'},ctx(),key);assert.equal(conflict.status,409);
});
test('un visitante o un código de otro ticket no accede al historial ni al agente ni a notas',async()=>{
  await create();assert.equal((await call('GET')).status,403);assert.equal((await call('GET',null,'/api/tickets?id=1',owner(2))).status,403);
  assert.equal((await agent(req('POST',{id:1},'/api/agente',owner(2)),ctx())).status,403);
  assert.equal((await follow(req('GET',null,'/api/seguimiento?id=1',owner(1)),ctx())).status,403);
  const data=(await call('GET',null,'/api/tickets?id=1',owner(1))).data;assert.ok(!JSON.stringify(data).includes(body.email));
});
test('nuevos mensajes conservan historial, disparan IA y no reenvían notas internas',async()=>{
  await create();db.db.prepare('INSERT INTO seguimiento_ayuda(id_solicitud,responsable,nota) VALUES(1,?,?)').run('José Montalvo','SECRET_INTERNO_42');
  const message={id:1,action:'message',message:'Ya lo intenté y necesito otro paso.',clientKey:randomUUID()};
  assert.equal((await call('POST',message,'/api/tickets',owner(1))).status,200);
  assert.equal((await call('POST',message,'/api/tickets',owner(1))).status,200);assert.equal(providerCalls.length,2);
  assert.ok(JSON.stringify(providerCalls[1]).includes('Ya lo intenté'));assert.ok(!JSON.stringify(providerCalls).includes('SECRET_INTERNO_42'));
  assert.equal((await call('POST',{...message,message:'Texto diferente'},'/api/tickets',owner(1))).status,409);
  const data=(await call('GET',null,'/api/tickets?id=1',owner(1))).data;assert.equal(data.messages.filter(m=>m.role==='agente').length,2);
});
test('la IA nunca cierra, el solicitante confirma y puede reabrir con nuevo análisis y escalamiento',async()=>{
  await create();assert.equal((await store.readTicket(1)).estado,'En proceso');
  assert.equal((await call('POST',{id:1,action:'feedback',value:'helpful',version:1},'/api/tickets',admin)).status,403);
  assert.equal((await call('POST',{id:1,action:'feedback',value:'helpful',version:99},'/api/tickets',owner(1))).status,409);
  assert.equal((await call('POST',{id:1,action:'feedback',value:'helpful',version:1},'/api/tickets',owner(1))).data.ticket.status,'Resuelto');
  const reopened=await call('POST',{id:1,action:'feedback',value:'unresolved',version:1},'/api/tickets',owner(1));assert.equal(reopened.status,200);assert.equal(reopened.data.ticket.status,'En proceso');assert.equal(reopened.data.ticket.ai.status,'escalado');assert.equal(providerCalls.length,2);
});
test('asignación acepta únicamente responsables autorizados; cierre docente exige verificación',async()=>{
  await create();assert.equal((await call('PATCH',{id:1,action:'assign',assignee:'Intruso'},'/api/tickets',admin)).status,400);
  const assigned=await call('PATCH',{id:1,action:'assign',assignee:'Cristopher Orozco'},'/api/tickets',admin);assert.equal(assigned.data.ticket.assignee,'Cristopher Orozco');
  assert.equal((await call('PATCH',{id:1,estado:'Resuelto',version:1},'/api/tickets',admin)).status,400);
  assert.equal((await call('PATCH',{id:1,estado:'Resuelto',version:1,verified:true,resolutionNote:'Comprobamos la solución con el solicitante.'},'/api/tickets',admin)).data.ticket.status,'Resuelto');
});
test('una respuesta humana complementa al agente y las notas siguen separadas',async()=>{
  await create();await call('PATCH',{id:1,action:'assign',assignee:'Carlos Romero'},'/api/tickets',admin);
  const result=await call('POST',{id:1,action:'message',message:'He revisado el caso y adjunto las indicaciones.',clientKey:randomUUID()},'/api/tickets',admin);assert.equal(result.status,200);assert.equal(providerCalls.length,1);
  const messages=(await call('GET',null,'/api/tickets?id=1',owner(1))).data.messages;assert.equal(messages.at(-1).role,'responsable');assert.equal(messages.at(-1).name,'Carlos Romero');
});
test('fallo de cuota queda persistido como fallo de IA; reintentos limitados sin fingir respuesta',async()=>{
  globalThis.fetch=async()=>{providerCalls.push({});return Response.json({error:{message:'provider details private'}},{status:429});};
  const created=await create();assert.equal(created.status,201);assert.equal(created.data.ticket.ai.status,'fallo');assert.equal(created.data.ticket.ai.escalar,true);assert.ok(!created.data.ticket.ai.respuesta);
  const history=(await call('GET',null,'/api/tickets?id=1',owner(1))).data.messages;assert.equal(history.filter(m=>m.role==='agente').length,0);assert.ok(history.some(m=>m.role==='sistema'));
  await agent(req('POST',{id:1},'/api/agente',owner(1)),ctx());assert.equal(providerCalls.length,1);
  for(let i=0;i<4;i++){db.db.prepare("UPDATE ayuda_control SET reintentar_en='2000-01-01 00:00:00' WHERE id_solicitud=1").run();await agent(req('POST',{id:1},'/api/agente',owner(1)),ctx());}
  assert.equal(providerCalls.length,3);
});
test('herramientas y búsqueda del agente siguen operativas, conservan fuentes HTTPS',async()=>{
  let n=0;globalThis.fetch=async(url,options)=>{const b=JSON.parse(options.body);providerCalls.push(b);n++;
    if(n===1)return Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'consultar_plantas',args:{}}}]}}]});
    return final({respuesta:'La planta de prueba figura Operativa.'});
  };
  await create();assert.ok(providerCalls[1].contents.some(c=>JSON.stringify(c).includes('Planta de prueba')));
  await store.addMessage(1,{message:'¿Cómo reviso el navegador?',clientKey:randomUUID()});
  n=0;globalThis.fetch=async(url,options)=>{n++;if(n===1)return Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'buscar_en_internet',args:{consulta:'Revisar caché del navegador'}}}]}}]});return Response.json({candidates:[{content:{parts:[{text:'1) Abre la configuración del navegador.'}]},groundingMetadata:{groundingChunks:[{web:{title:'Guía técnica',uri:'https://example.org/guide'}}]}}]});};
  await agent(req('POST',{id:1},'/api/agente',owner(1)),ctx());
  const messages=(await call('GET',null,'/api/tickets?id=1',owner(1))).data.messages;assert.equal(messages.at(-1).sources[0].url,'https://example.org/guide');
});
test('recuperación no revela existencia, verifica correo, caduca y usa código una sola vez',async()=>{
  await create();
  const unknown=await call('POST',{action:'recover',id:99,email:body.email});const known=await call('POST',{action:'recover',id:1,email:body.email});assert.equal(known.status,202);assert.deepEqual(known.data,unknown.data);assert.equal(globalThis.mails.length,1);
  await call('POST',{action:'recover',id:1,email:body.email});assert.equal(globalThis.mails.length,1);
  const code=globalThis.mails[0].text.match(/es: (\d{6})/)[1];assert.ok(!JSON.stringify(known.data).includes(code));
  assert.equal((await call('POST',{action:'verify',id:1,email:'wrong@example.invalid',code})).status,400);
  const verified=await call('POST',{action:'verify',id:1,email:body.email,code});assert.equal(verified.status,200);assert.equal(tokenId(req('GET',null,'/',{authorization:'Bearer '+verified.data.accessToken})),1);
  assert.equal((await call('POST',{action:'verify',id:1,email:body.email,code})).status,400);
});
test('cinco códigos fallidos bloquean la verificación incluso con el correcto',async()=>{
  await create();await call('POST',{action:'recover',id:1,email:body.email});const code=globalThis.mails[0].text.match(/es: (\d{6})/)[1],bad=code==='000000'?'111111':'000000';
  for(let i=0;i<5;i++)assert.equal((await call('POST',{action:'verify',id:1,email:body.email,code:bad})).status,400);
  assert.equal((await call('POST',{action:'verify',id:1,email:body.email,code})).status,400);
});
test('cola pagina y cuenta el conjunto completo autorizado con filtros parametrizados',async()=>{
  for(let i=0;i<26;i++)await store.createTicket({...body,subject:'Solicitud '+i,priority:i===0?'Crítica':'Media'},randomUUID());
  await store.assign(1,'José Montalvo');
  const result=await call('GET',null,'/api/tickets',admin);assert.equal(result.status,200);assert.equal(result.data.tickets.length,20);assert.equal(Number(result.data.stats.total),26);assert.equal(result.data.pages,2);assert.equal(result.data.tickets[0].priority,'Crítica');
  const filtered=await call('GET',null,'/api/tickets?assignee='+encodeURIComponent('José Montalvo'),admin);assert.equal(Number(filtered.data.stats.total),1);
  assert.equal((await call('GET',null,'/api/tickets?from=2026-02-30',admin)).status,400);
});
test('un código antiguo válido sigue funcionando y tickets anteriores se inicializan sin perder su respuesta',async()=>{
  db.db.prepare('INSERT INTO solicitudes_ayuda(asunto,nombre,correo,categoria,prioridad,descripcion,ia_respuesta,ia_en) VALUES(?,?,?,?,?,?,?,?)').run('Caso anterior','Persona',body.email,'Sistemas','Media','Descripción anterior','Respuesta anterior de IA','2026-11-01 00:00:00');
  const result=await call('GET',null,'/api/tickets?id=1',owner(1));assert.equal(result.status,200);assert.equal(result.data.messages[1].text,'Respuesta anterior de IA');
});
test('un fallo inicial seguido de una nueva respuesta no inventa una respuesta histórica en la revisión anterior',async()=>{
  globalThis.fetch=async()=>Response.json({error:{message:'Quota'}},{status:429});await create();
  globalThis.fetch=async()=>final();await call('POST',{id:1,action:'message',message:'Aporto información adicional para continuar.',clientKey:randomUUID()},'/api/tickets',owner(1));
  const data=(await call('GET',null,'/api/tickets?id=1',owner(1))).data;
  assert.deepEqual(data.messages.filter(m=>m.role==='agente').map(m=>m.version),[2]);
});
test('recuperación vencida o envío SMTP fallido no otorga acceso ni revela el código',async()=>{
  await create();await call('POST',{action:'recover',id:1,email:body.email});const code=globalThis.mails[0].text.match(/es: (\d{6})/)[1];
  db.db.prepare("UPDATE ayuda_control SET recovery_hasta='2000-01-01 00:00:00' WHERE id_solicitud=1").run();
  assert.equal((await call('POST',{action:'verify',id:1,email:body.email,code})).status,400);
  db.db.prepare("UPDATE ayuda_control SET recovery_ultimo='2000-01-01 00:00:00' WHERE id_solicitud=1").run();globalThis.mailFailure=true;
  assert.equal((await call('POST',{action:'recover',id:1,email:body.email})).status,202);
  assert.equal(db.db.prepare('SELECT recovery_hash FROM ayuda_control WHERE id_solicitud=1').get().recovery_hash,null);
});
test('una lease vencida se recupera, y una revisión pendiente no se puede cerrar desde una pantalla antigua',async()=>{
  const created=await store.createTicket(body,randomUUID());
  db.db.prepare("UPDATE ayuda_control SET estado_ia='analizando',lease_token='old',lease_hasta='2000-01-01 00:00:00' WHERE id_solicitud=?").run(created.id);
  const result=await agent(req('POST',{id:created.id},'/api/agente',owner(created.id)),ctx());assert.equal(result.status,200);assert.equal(providerCalls.length,1);
  await store.addMessage(created.id,{message:'Nueva información que cambia el caso.',clientKey:randomUUID()});
  assert.equal((await call('PATCH',{id:1,estado:'Resuelto',version:1,verified:true,resolutionNote:'Una verificación realizada en una pantalla antigua.'},'/api/tickets',admin)).status,409);
});
test('los fallos de herramientas nunca se guardan como una respuesta inventada de Gemini',async()=>{
  globalThis.fetch=async()=>Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'buscar_en_internet',args:{consulta:'password de biovolt'}}}]}}]});
  const created=await create();assert.equal(created.data.ticket.ai.status,'fallo');assert.equal(created.data.ticket.ai.error,'verification');
  assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM ayuda_mensajes WHERE autor='agente'").get().n,0);
});
test('historial paginado conserva todos los mensajes sin publicar notas internas',async()=>{
  await create();const insert=db.db.prepare("INSERT INTO ayuda_mensajes(id_solicitud,autor,contenido,origen) VALUES(1,'sistema',?,'sistema')");for(let i=0;i<60;i++)insert.run('Evento '+i);
  const first=await call('GET',null,'/api/tickets?id=1',owner(1));assert.equal(first.data.messages.length,50);assert.ok(first.data.before);
  const older=await call('GET',null,'/api/tickets?id=1&before='+first.data.before,owner(1));assert.equal(older.data.messages.length,12);assert.equal(older.data.before,null);
});
test('timeout del agente escala con aviso del sistema y no genera una respuesta falsa',async()=>{
  globalThis.fetch=async()=>{const error=new Error('Timeout simulado');error.name='TimeoutError';throw error;};
  const result=await create();assert.equal(result.status,201);assert.equal(result.data.ticket.ai.error,'timeout');assert.equal(result.data.ticket.ai.status,'fallo');
});
test('sin SMTP configurado la recuperación se explica y no otorga acceso por el correo',async()=>{
  const host=process.env.SMTP_HOST;delete process.env.SMTP_HOST;
  try{assert.equal((await call('POST',{action:'recover',id:1,email:body.email})).status,503);assert.equal(globalThis.mails.length,0);}finally{process.env.SMTP_HOST=host;}
});
