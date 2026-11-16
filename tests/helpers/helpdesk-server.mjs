// Solo pruebas: sirve APIs reales con SQL de prueba, Gemini y correo simulados. Sin secretos reales.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {fixture} from '../helpdesk-db-fixture.mjs';
registerHooks({resolve(specifier,context,next){
  if(specifier==='mysql2/promise')return {url:'data:text/javascript,'+encodeURIComponent('export default {createPool(){return {query:(...a)=>globalThis.hdFixture.pool.query(...a),getConnection:()=>globalThis.hdFixture.pool.getConnection()}}}'),shortCircuit:true};
  if(specifier==='nodemailer')return {url:'data:text/javascript,'+encodeURIComponent('export default {createTransport(){return {async sendMail(data){globalThis.testMails.push(data)},close(){}}}}'),shortCircuit:true};
  return next(specifier,context);
}});
Object.assign(process.env,{DB_HOST:'test.invalid',DB_USER:'test',DB_NAME:'test',GEMINI_API_KEY:'test-only-gemini-key',TICKET_TOKEN_SECRET:'test-only-secret-32-or-more-characters',AYUDA_PIN:'teacher-test',SMTP_HOST:'test.invalid',SMTP_USER:'test',SMTP_PASSWORD:'test-password',SUPPORT_FROM:'BioVolt <support@example.invalid>'});
let current=fixture(),scenario='success',count=0;const tasks=new Set();globalThis.hdFixture=current;globalThis.testMails=[];
globalThis.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://generativelanguage.googleapis.com/'))throw new Error('Network disabled in tests');
  count++;
  if(scenario==='quota')return Response.json({error:{message:'Simulated quota'}},{status:429});
  if(scenario==='timeout'){const error=new Error('Simulated timeout');error.name='TimeoutError';throw error;}
  if(scenario==='slow')await new Promise(resolve=>setTimeout(resolve,800));
  return Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'responder_solicitud',args:{respuesta:'Para revisar el inventario, abre Inventario y busca el material. Si el resultado no coincide, indícame el nombre y el almacén para continuar.',categoria:'Inventario',prioridad:'Media',estado:'En proceso',escalar:false,espera_usuario:true}}}]}}]});
};
const routes={
  '/api/tickets':(await import('../../netlify/functions/tickets.mjs')).default,
  '/api/agente':(await import('../../netlify/functions/agente.mjs')).default,
  '/api/seguimiento':(await import('../../netlify/functions/seguimiento.mjs')).default,
};
let sequence=0;
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4173');
  try{
    if(url.pathname==='/__test/reset'&&req.method==='POST'){
      await Promise.allSettled([...tasks]);const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const options=JSON.parse(Buffer.concat(chunks).toString()||'{}');current.close();current=fixture();globalThis.hdFixture=current;globalThis.testMails=[];scenario=options.scenario||'success';count=0;
      res.setHeader('Content-Type','application/json');res.end('{}');return;
    }
    if(url.pathname==='/__test/revision'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(await readFile('revision/index.html'));return;}
    if(url.pathname==='/__test/state'){
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({calls:count,mails:globalThis.testMails,tickets:current.db.prepare('SELECT COUNT(*) AS n FROM solicitudes_ayuda').get().n}));return;
    }
    if(url.pathname.startsWith('/api/')){
      if(!routes[url.pathname]){res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"API simulada no disponible"}');return;}
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      const response=await routes[url.pathname](request,{ip:'local-'+(++sequence),waitUntil(task){tasks.add(task);task.finally(()=>tasks.delete(task));}});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    if(url.pathname!=='/'&&url.pathname!=='/index.html'&&!/^\/assets\/[\w.-]+\.(js|css)$/.test(url.pathname)){res.writeHead(404);res.end();return;}
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1);res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path));
  }catch(error){console.error('[test server]',error);res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Fallo del servidor de pruebas"}');}
}).listen(4173,'127.0.0.1',()=>console.log('BioVolt integración local: servicios externos simulados.'));
