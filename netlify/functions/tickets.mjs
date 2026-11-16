// Endpoints existentes ampliados. Los mensajes públicos nunca incluyen notas internas ni correos.
import { isAdmin, tokenId, canAccess, ticketId, canIssueToken, issueToken, throttled } from '../../lib/access.mjs';
import { createTicket, readTicket, formatTicket, addMessage, feedback, assign, changeState, conversation,
  listQueue, query, transaction, lockTicket, event, fail, RESPONSABLES, clean } from '../../lib/helpdesk-store.mjs';
import { dispatchAgent } from '../../lib/helpdesk-runner.mjs';
import { requestRecovery, verifyRecovery, recoveryEnabled } from '../../lib/helpdesk-recovery.mjs';
export const config={path:'/api/tickets'};
export default async(request,context)=>{
  const out=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(throttled(request,context,'tickets',90))return out(429,{error:'Demasiadas consultas. Espera un minuto.'});
  if(!process.env.DB_HOST||!process.env.DB_USER||!process.env.DB_NAME)return out(503,{error:'Base de datos no configurada.'});
  const url=new URL(request.url),admin=isAdmin(request);
  try{
    if(request.method==='GET'){
      const explicit=url.searchParams.has('id'),id=explicit?ticketId(url.searchParams.get('id')):tokenId(request);
      if(explicit&&!id)fail(400,'ID inválido.');
      if(explicit){
        if(!canAccess(request,id))fail(403,'No tienes acceso a esta solicitud.');
        const before=Number(url.searchParams.get('before')||0);if(!Number.isSafeInteger(before)||before<0)fail(400,'Página de conversación inválida.');
        let row=await readTicket(id);if(!row)fail(404,'La solicitud no existe.');
        const initialize=!row.revision,history=await conversation(id,before,{initialize});if(initialize)row=await readTicket(id);
        return out(200,{ticket:formatTicket(row),...history,responsables:admin?RESPONSABLES:undefined});
      }
      if(admin)return out(200,{...await listQueue(url),recoveryEnabled:recoveryEnabled()});
      if(!id)fail(403,'Usa tu código privado o el acceso docente.');
      const row=await readTicket(id);return out(200,{tickets:row?[formatTicket(row)]:[],scope:'propietario',recoveryEnabled:recoveryEnabled()});
    }
    if(!['POST','PATCH','DELETE'].includes(request.method))fail(405,'Método no permitido.');
    const body=request.method==='DELETE'?{}:await request.json().catch(()=>null);
    if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Formato de solicitud inválido.');
    if(request.method==='POST'&&['recover','verify'].includes(body.action)){
      if(throttled(request,context,'recovery',10))fail(429,'Demasiados intentos de recuperación. Espera un minuto.');
      const id=ticketId(body.id);if(!id)fail(400,'Escribe el número de solicitud.');
      return out(body.action==='recover'?202:200,body.action==='recover'?await requestRecovery(id,body.email,context):await verifyRecovery(id,body.email,body.code));
    }
    if(request.method==='POST'&&!body.action){
      if(throttled(request,context,'ticket-create',6))fail(429,'Demasiadas solicitudes nuevas. Espera un minuto.');
      if(!canIssueToken())fail(503,'La consulta privada de solicitudes aún no está configurada. TICKET_TOKEN_SECRET requiere al menos 32 caracteres en Functions.');
      const created=await createTicket(body,request.headers.get('x-idempotency-key'));
      const accessToken=issueToken(created.id);
      await dispatchAgent(created.id,context);
      const row=await readTicket(created.id);
      return out(created.replayed?200:201,{ticket:formatTicket(row),accessToken,replayed:created.replayed});
    }
    const id=ticketId(body.id||url.searchParams.get('id'));if(!id)fail(400,'ID inválido.');
    if(!canAccess(request,id))fail(403,'No tienes acceso a esta solicitud.');
    if(request.method==='POST'&&body.action==='message'){
      if(throttled(request,context,'ticket-message',10))fail(429,'Demasiados mensajes seguidos. Espera un minuto.');
      await addMessage(id,body,admin);
      if(!admin)await dispatchAgent(id,context);
    }else if(request.method==='POST'&&body.action==='feedback'){
      // El PIN docente no sustituye la confirmación del solicitante.
      if(tokenId(request)!==id)fail(403,'La confirmación requiere el código privado del solicitante.');
      await feedback(id,body);
      if(body.value==='unresolved')await dispatchAgent(id,context);
    }else if(request.method==='PATCH'){
      if(!admin)fail(403,'Acción reservada al docente.');
      if(body.action==='assign')await assign(id,clean(body.assignee,80));else await changeState(id,body);
    }else if(request.method==='DELETE'){
      if(!admin)fail(403,'Acción reservada al docente.');
      // Borrar sigue disponible, pero exige confirmación explícita y conserva el historial asociado.
      if(url.searchParams.get('confirm')!=='yes')fail(400,'Confirma la eliminación.');
      await transaction(async q=>{const c=await lockTicket(id,q);if(c.estado_ia==='analizando')fail(409,'Espera a que el agente termine.');await q('DELETE FROM solicitudes_ayuda WHERE id=?',[id]);});
      return out(200,{ok:true});
    }else fail(400,'Acción no válida.');
    const row=await readTicket(id);if(!row)fail(404,'La solicitud no existe.');return out(200,{ticket:formatTicket(row)});
  }catch(error){
    const schema=['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes(error.code);
    console.error('[mesa tickets]',schema?'schema':error.code||error.status||'storage');
    return out(error.status||(schema?503:502),{error:error.status?error.message:schema?'La actualización de la mesa requiere aplicar la migración mesa_agente_v2.sql.':'No se pudo completar la operación. La solicitud puede estar guardada; reintenta el mismo envío.'});
  }
};
