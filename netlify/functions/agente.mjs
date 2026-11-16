// Agente original: Gemini con herramientas. Autorización y ejecución idempotente por revisión.
import { canAccess, ticketId, throttled } from '../../lib/access.mjs';
import { processTicket } from '../../lib/helpdesk-runner.mjs';
import { readTicket, formatTicket } from '../../lib/helpdesk-store.mjs';
export const config={path:'/api/agente'};
export default async(request,context)=>{
  const out=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return out(405,{error:'Método no permitido.'});
  if(throttled(request,context,'agente',12))return out(429,{error:'Demasiados intentos. Espera un minuto.'});
  try{
    const body=await request.json().catch(()=>null),id=ticketId(body?.id);
    if(!id)return out(400,{error:'ID de solicitud inválido.'});
    if(!canAccess(request,id))return out(403,{error:'No tienes acceso a esta solicitud.'});
    const result=await processTicket(id);const row=await readTicket(id);
    if(!row)return out(404,{error:'La solicitud no existe.'});
    return out(row.estado_ia==='analizando'?202:200,{ticket:formatTicket(row),...result});
  }catch(error){return out(error.status||502,{error:error.status?error.message:'No se pudo revisar la solicitud. Comprueba la configuración de la mesa de ayuda.'});}
};
