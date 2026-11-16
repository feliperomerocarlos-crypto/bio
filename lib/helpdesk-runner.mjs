import { randomUUID } from 'node:crypto';
import { analyzeTicket } from './helpdesk-agent.mjs';
import { transaction, query, readTicket, lockTicket, conversation, event } from './helpdesk-store.mjs';

const failure=error=>error.status===429?{code:'quota',delay:60000,text:'El agente de IA alcanzó su cuota. La solicitud está guardada y requiere reintento o revisión humana.'}:
  ['TimeoutError','AbortError'].includes(error.name)?{code:'timeout',delay:15000,text:'El agente de IA no respondió a tiempo. La solicitud está guardada; puedes reintentar o esperar atención humana.'}:
  {code:error.code==='config'?'config':error.code==='verification'?'verification':'provider',delay:60000,text:'El agente de IA no pudo completar o verificar su respuesta. La solicitud permanece guardada y se escala para revisión.'};

export async function processTicket(id){
  const lease=randomUUID();
  const job=await transaction(async q=>{
    const c=await lockTicket(id,q),row=await readTicket(id,q);
    if(row.estado==='Resuelto'||(Number(c.revision_ia)===Number(c.revision)&&['respondido','escalado'].includes(c.estado_ia)))return null;
    if(c.estado_ia==='analizando'&&Number(c.lease_ms)>Date.now())return null;
    if(Number(c.intentos_ia)>=3||Number(c.retry_ms)>Date.now())return null;
    await q("UPDATE ayuda_control SET estado_ia='analizando',intentos_ia=intentos_ia+1,lease_token=?,lease_hasta=DATE_ADD(NOW(3),INTERVAL 45 SECOND),error_ia=NULL WHERE id_solicitud=?",[lease,id]);
    return {row,revision:Number(c.revision)};
  });
  if(!job)return {cached:true};
  try{
    const history=await conversation(id,0,{initialize:false});const result=await analyzeTicket(job.row,history.messages);
    await transaction(async q=>{
      const c=await lockTicket(id,q);if(c.lease_token!==lease||Number(c.revision)!==job.revision)return;
      const row=await readTicket(id,q);if(row.estado==='Resuelto')return;
      await q("INSERT IGNORE INTO ayuda_mensajes(id_solicitud,revision,autor,contenido,origen,herramientas,fuentes) VALUES(?,?,'agente',?,'gemini',?,?)",[id,job.revision,result.answer,result.tools.join('|'),JSON.stringify(result.sources)]);
      await q("UPDATE solicitudes_ayuda SET categoria=?,prioridad=?,estado='En proceso',ia_respuesta=?,ia_herramientas=?,ia_escalar=?,ia_motivo=?,ia_en=NOW() WHERE id=?",[result.category,result.priority,result.answer,result.tools.join('|'),result.escalated?1:0,result.reason,id]);
      await q("UPDATE ayuda_control SET revision_ia=?,estado_ia=?,lease_token=NULL,lease_hasta=NULL,reintentar_en=NULL,error_ia=NULL,espera=?,ultima_actividad=NOW(3) WHERE id_solicitud=?",[job.revision,result.escalated?'escalado':'respondido',result.waiting,id]);
      if(result.escalated)await event(q,id,'El agente escaló la solicitud a una persona: '+(result.reason||'Requiere revisión humana.'));
    });
    return {completed:true};
  }catch(error){
    const f=failure(error);console.error('[mesa agente]',f.code);
    await transaction(async q=>{
      const c=await lockTicket(id,q);if(c.lease_token!==lease||Number(c.revision)!==job.revision)return;
      await q("UPDATE ayuda_control SET estado_ia='fallo',lease_token=NULL,lease_hasta=NULL,error_ia=?,reintentar_en=DATE_ADD(NOW(3),INTERVAL ? MICROSECOND),espera='persona',ultima_actividad=NOW(3) WHERE id_solicitud=?",[f.code,f.delay*1000,id]);
      await q('UPDATE solicitudes_ayuda SET ia_escalar=1,ia_motivo=? WHERE id=?',[f.text.slice(0,300),id]);
      await event(q,id,f.text);
    });
    return {failed:true,code:f.code};
  }
}
// Netlify v2 mantiene esta promesa viva después de entregar el código privado al navegador.
// Fuera de Netlify se espera el mismo trabajo: nunca se deja una promesa abandonada.
export async function dispatchAgent(id,context){
  const task=processTicket(id).catch(error=>{console.error('[mesa dispatch]',error?.code||'storage');return {failed:true};});
  if(typeof context?.waitUntil==='function'){context.waitUntil(task);return {scheduled:true};}
  return task;
}
