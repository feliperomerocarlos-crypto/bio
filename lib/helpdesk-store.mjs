import { createHash } from 'node:crypto';
import { query, transaction } from './helpdesk-db.mjs';
export { query, transaction };
export const RESPONSABLES=['José Montalvo','Cristopher Orozco','Carlos Romero'];
export const CATS=['Sistemas','Inventario','Producción','Logística','Administración','Otro'];
export const PRIOS=['Baja','Media','Alta','Crítica'];
export const STATES=['Abierto','En proceso','Resuelto'];
export const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const digest=value=>createHash('sha256').update(String(value)).digest('hex');
export function fail(status,message){const error=new Error(message);error.status=status;throw error;}
export const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export function parseJSON(value,fallback=[]){try{return value?JSON.parse(value):fallback;}catch{return fallback;}}
export const fields=`t.id,t.asunto,t.nombre,t.categoria,t.prioridad,t.estado,t.descripcion,
 UNIX_TIMESTAMP(t.creado_en)*1000 AS ts,t.ia_respuesta,t.ia_herramientas,t.ia_escalar,t.ia_motivo,UNIX_TIMESTAMP(t.ia_en)*1000 AS ia_ts,
 c.revision,c.revision_ia,c.estado_ia,c.intentos_ia,c.responsable,c.espera,c.confirmacion,c.inconformidades,
 UNIX_TIMESTAMP(c.ultima_actividad)*1000 AS actividad_ts,UNIX_TIMESTAMP(c.resuelto_en)*1000 AS resuelto_ts,
 UNIX_TIMESTAMP(c.lease_hasta)*1000 AS lease_ts,UNIX_TIMESTAMP(c.reintentar_en)*1000 AS retry_ts,c.error_ia`;
export const join='FROM solicitudes_ayuda t LEFT JOIN ayuda_control c ON c.id_solicitud=t.id';
export async function readTicket(id,q=query){return (await q(`SELECT ${fields} ${join} WHERE t.id=? LIMIT 1`,[id]))[0];}
export function formatTicket(r){
  const expired=r.estado_ia==='analizando'&&Number(r.lease_ts)<Date.now();
  const state=expired?'fallo':r.estado_ia || (r.ia_respuesta?(r.ia_escalar?'escalado':'respondido'):'pendiente');
  return {id:'BV-'+r.id,subject:r.asunto,name:r.nombre,email:'Oculto por privacidad',category:r.categoria,
    priority:r.prioridad,status:r.estado,description:r.descripcion,createdAt:Number(r.ts),
    updatedAt:Number(r.actividad_ts)||Number(r.ia_ts)||Number(r.ts),resolvedAt:Number(r.resuelto_ts)||null,
    assignee:r.responsable||'',waitingFor:r.estado==='Resuelto'?'nadie':r.espera||(r.ia_escalar?'persona':r.ia_respuesta?'solicitante':'agente'),confirmation:r.confirmacion||'',version:Number(r.revision)||1,
    ai:{respuesta:r.ia_respuesta||'',herramientas:r.ia_herramientas?r.ia_herramientas.split('|'):[],
      escalar:!!r.ia_escalar,motivo:r.ia_motivo||'',at:Number(r.ia_ts)||null,status:state,
      processedVersion:Number(r.revision_ia)||0,attempts:Number(r.intentos_ia)||0,
      retryAt:expired?null:Number(r.retry_ts)||null,error:expired?'timeout':r.error_ia||null,
      canRetry:r.estado!=='Resuelto'&&Number(r.intentos_ia||0)<3&&(expired||state==='pendiente'||(state==='fallo'&&Number(r.intentos_ia)<3&&(!r.retry_ts||Number(r.retry_ts)<=Date.now())))}}
}
// Inicialización perezosa de metadata e historial de tickets existentes; no reescribe su contenido.
export async function ensureControl(id,q=query){
  const created = await q(`INSERT IGNORE INTO ayuda_control(id_solicitud,revision_ia,estado_ia,espera,ultima_actividad)
    SELECT id,IF(ia_respuesta IS NULL OR ia_respuesta='',0,1),IF(ia_respuesta IS NULL OR ia_respuesta='','pendiente',IF(ia_escalar=1,'escalado','respondido')),
      IF(estado='Resuelto','nadie',IF(ia_escalar=1,'persona',IF(ia_respuesta IS NULL OR ia_respuesta='','agente','solicitante'))),COALESCE(ia_en,creado_en)
    FROM solicitudes_ayuda WHERE id=?`,[id]);
  if (!Number(created.affectedRows ?? created.changes)) return;
  await q(`INSERT IGNORE INTO ayuda_mensajes(id_solicitud,revision,autor,contenido,origen)
    SELECT id,1,'solicitante',descripcion,'usuario' FROM solicitudes_ayuda WHERE id=?`,[id]);
  await q(`INSERT IGNORE INTO ayuda_mensajes(id_solicitud,revision,autor,contenido,origen,herramientas)
    SELECT id,1,'agente',ia_respuesta,'historico',ia_herramientas FROM solicitudes_ayuda
    WHERE id=? AND ia_respuesta IS NOT NULL AND ia_respuesta<>''`,[id]);
}
export async function lockTicket(id,q){
  await ensureControl(id,q);
  const control=(await q('SELECT *,UNIX_TIMESTAMP(lease_hasta)*1000 AS lease_ms,UNIX_TIMESTAMP(reintentar_en)*1000 AS retry_ms,UNIX_TIMESTAMP(recovery_hasta)*1000 AS recovery_until_ms,UNIX_TIMESTAMP(recovery_ultimo)*1000 AS recovery_last_ms,UNIX_TIMESTAMP(recovery_ventana)*1000 AS recovery_window_ms FROM ayuda_control WHERE id_solicitud=? FOR UPDATE',[id]))[0];
  if(!control)fail(404,'La solicitud no existe.');return control;
}
export const event=(q,id,text)=>q("INSERT INTO ayuda_mensajes(id_solicitud,autor,contenido,origen) VALUES(?,'sistema',?,'sistema')",[id,text]);
export function assertIdle(control){if(control.estado_ia==='analizando'&&Number(control.lease_ms)>Date.now())fail(409,'El agente sigue analizando. Espera su respuesta antes de enviar otro mensaje.');}
export async function conversation(id,before=0,{initialize=true}={}){
  if(initialize)await transaction(q=>lockTicket(id,q));
  const rows=await query(`SELECT id_mensaje,revision,autor,nombre,contenido,origen,herramientas,fuentes,UNIX_TIMESTAMP(registrado_en)*1000 AS ts
    FROM ayuda_mensajes WHERE id_solicitud=? AND (?=0 OR id_mensaje<?) ORDER BY id_mensaje DESC LIMIT 51`,[id,before,before]);
  const more=rows.length>50;const page=rows.slice(0,50).reverse();
  return {messages:page.map(r=>({id:String(r.id_mensaje),version:r.revision,role:r.autor,name:r.nombre,text:r.contenido,source:r.origen,
    tools:r.herramientas?r.herramientas.split('|'):[],sources:parseJSON(r.fuentes),at:Number(r.ts)})),before:more?String(page[0].id_mensaje):null};
}
export async function createTicket(body,key){
  if(!uuid(key))fail(400,'Actualiza la página y vuelve a enviar el formulario.');
  const ticket={name:clean(body.name,80),email:clean(body.email,120).toLowerCase(),subject:clean(body.subject,90),description:clean(body.description,500),category:body.category,priority:body.priority};
  if(ticket.name.length<3)fail(400,'Escribe tu nombre.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ticket.email))fail(400,'Escribe un correo válido.');
  if(ticket.subject.length<5||ticket.description.length<15)fail(400,'Completa el asunto y describe el problema con al menos 15 caracteres.');
  if(!CATS.includes(ticket.category)||!PRIOS.includes(ticket.priority))fail(400,'Categoría o prioridad no válida.');
  const hash=digest(key),fingerprint=digest(JSON.stringify(ticket));
  const replay=async()=>{
    const row=(await query('SELECT id_solicitud,creation_fingerprint,UNIX_TIMESTAMP(creation_hasta)*1000 AS until_ts FROM ayuda_control WHERE creation_key=?',[hash]))[0];
    if(!row)return null;
    if(row.creation_fingerprint!==fingerprint||Number(row.until_ts)<=Date.now())fail(409,'Ese envío ya fue utilizado. Recupera tu solicitud con el código privado o por correo.');
    return {id:Number(row.id_solicitud),replayed:true};
  };
  const prior=await replay();if(prior)return prior;
  try{return await transaction(async q=>{
    const [{n}]=await q('SELECT COUNT(*) AS n FROM solicitudes_ayuda');if(Number(n)>=2000)fail(429,'Se alcanzó el límite de solicitudes del proyecto.');
    const result=await q('INSERT INTO solicitudes_ayuda(asunto,nombre,correo,categoria,prioridad,descripcion) VALUES(?,?,?,?,?,?)',[ticket.subject,ticket.name,ticket.email,ticket.category,ticket.priority,ticket.description]);
    const id=Number(result.insertId);
    await q('INSERT INTO ayuda_control(id_solicitud,creation_key,creation_fingerprint,creation_hasta) VALUES(?,?,?,DATE_ADD(NOW(3),INTERVAL 15 MINUTE))',[id,hash,fingerprint]);
    await q("INSERT INTO ayuda_mensajes(id_solicitud,revision,autor,contenido,origen) VALUES(?,1,'solicitante',?,'usuario')",[id,ticket.description]);
    return {id,replayed:false};
  });}catch(error){if(error.code==='ER_DUP_ENTRY'){const existing=await replay();if(existing)return existing;}throw error;}
}
export async function addMessage(id,body,admin=false){
  if(!uuid(body.clientKey))fail(400,'Identificador de mensaje inválido.');
  const text=clean(body.message,2000);if(text.length<3)fail(400,'Escribe al menos tres caracteres.');
  return transaction(async q=>{
    const control=await lockTicket(id,q);
    const existing=(await q('SELECT id_mensaje,contenido FROM ayuda_mensajes WHERE id_solicitud=? AND client_key=?',[id,body.clientKey]))[0];if(existing){if(existing.contenido!==text)fail(409,'Ese identificador ya corresponde a otro mensaje.');return {cached:true};}
    assertIdle(control);
    const row=await readTicket(id,q);
    if(admin){
      if(!RESPONSABLES.includes(control.responsable))fail(400,'Asigna un responsable antes de registrar una respuesta humana.');
      if(Number(control.revision_ia)!==Number(control.revision)&&Number(control.intentos_ia)===0)fail(409,'El agente debe intentar atender esta revisión primero.');
      await q("INSERT INTO ayuda_mensajes(id_solicitud,autor,nombre,contenido,origen,client_key) VALUES(?,'responsable',?,?,'humano',?)",[id,control.responsable,text,body.clientKey]);
      await q("UPDATE ayuda_control SET espera='solicitante',ultima_actividad=NOW(3) WHERE id_solicitud=?",[id]);
    }else{
      if(row.estado==='Resuelto')fail(409,'Pulsa «Sigo con el problema» para reabrir la solicitud.');
      const version=Number(control.revision)+1;
      await q("INSERT INTO ayuda_mensajes(id_solicitud,revision,autor,contenido,origen,client_key) VALUES(?,?,'solicitante',?,'usuario',?)",[id,version,text,body.clientKey]);
      await q("UPDATE ayuda_control SET revision=?,estado_ia='pendiente',intentos_ia=0,error_ia=NULL,reintentar_en=NULL,espera='agente',confirmacion='',ultima_actividad=NOW(3) WHERE id_solicitud=?",[version,id]);
    }
    return {cached:false};
  });
}
export async function feedback(id,body){
  if(!['helpful','unresolved'].includes(body.value))fail(400,'Confirmación inválida.');
  return transaction(async q=>{
    const c=await lockTicket(id,q);assertIdle(c);const row=await readTicket(id,q);
    if(Number(body.version)!==Number(c.revision))fail(409,'La conversación cambió. Actualízala antes de confirmar.');
    if(c.confirmacion===body.value)return {cached:true};
    if(body.value==='helpful'){
      const human=(await q("SELECT id_mensaje FROM ayuda_mensajes WHERE id_solicitud=? AND autor='responsable' ORDER BY id_mensaje DESC LIMIT 1",[id]))[0];
      if((Number(c.revision_ia)!==Number(c.revision)||!row.ia_respuesta)&&!(human&&Number(c.intentos_ia)>0))fail(409,'Espera la respuesta del agente o la intervención humana antes de confirmar la solución.');
      await q("UPDATE solicitudes_ayuda SET estado='Resuelto' WHERE id=?",[id]);
      await q("UPDATE ayuda_control SET confirmacion='helpful',espera='nadie',resuelto_en=NOW(3),ultima_actividad=NOW(3) WHERE id_solicitud=?",[id]);
      await event(q,id,'El solicitante confirmó que la solución funcionó.');
    }else{
      if(!row.ia_respuesta&&Number(c.intentos_ia)===0)fail(409,'El agente debe atender primero la solicitud.');
      await q("UPDATE solicitudes_ayuda SET estado='En proceso',ia_escalar=1,ia_motivo='El solicitante indica que el problema continúa.' WHERE id=?",[id]);
      await q("UPDATE ayuda_control SET revision=revision+1,confirmacion='unresolved',inconformidades=inconformidades+1,estado_ia='pendiente',intentos_ia=0,reintentar_en=NULL,error_ia=NULL,espera='agente',resuelto_en=NULL,ultima_actividad=NOW(3) WHERE id_solicitud=?",[id]);
      await q("INSERT INTO ayuda_mensajes(id_solicitud,revision,autor,contenido,origen) VALUES(?,?,'solicitante','Sigo con el problema. La solución anterior no funcionó.','usuario')",[id,Number(c.revision)+1]);
    }
    return {cached:false};
  });
}
export async function assign(id,name){
  if(name!==''&&!RESPONSABLES.includes(name))fail(400,'Selecciona uno de los responsables autorizados.');
  await transaction(async q=>{const c=await lockTicket(id,q);if(c.responsable===name)return;
    await q('UPDATE ayuda_control SET responsable=?,ultima_actividad=NOW(3) WHERE id_solicitud=?',[name,id]);
    await event(q,id,name?'Responsable asignado: '+name+'.':'La solicitud quedó sin responsable asignado.');});
}
export async function changeState(id,body){
  if(!STATES.includes(body.estado))fail(400,'Estado no válido.');
  await transaction(async q=>{const c=await lockTicket(id,q);assertIdle(c);const row=await readTicket(id,q);if(row.estado===body.estado)return;
    if(body.estado==='Resuelto'){
      if(Number(body.version)!==Number(c.revision))fail(409,'La conversación cambió. Actualiza antes de cerrar.');
      if(body.verified!==true||clean(body.resolutionNote,500).length<10)fail(400,'Confirma la verificación y explica cómo se resolvió (mínimo 10 caracteres).');
      if(Number(c.revision_ia)!==Number(c.revision)&&Number(c.intentos_ia)===0)fail(409,'El agente debe intentar atender esta revisión primero.');
    }
    await q('UPDATE solicitudes_ayuda SET estado=? WHERE id=?',[body.estado,id]);
    await q("UPDATE ayuda_control SET espera=?,confirmacion=?,resuelto_en=IF(?='Resuelto',NOW(3),NULL),ultima_actividad=NOW(3) WHERE id_solicitud=?",[body.estado==='Resuelto'?'nadie':'persona',body.estado==='Resuelto'?'docente':'',body.estado,id]);
    await event(q,id,'Acceso docente: estado '+body.estado+'.'+(body.estado==='Resuelto'?' Verificación: '+clean(body.resolutionNote,500):''));
  });
}
export function queueFilters(url){
  const clauses=[],values=[];
  const equals=(param,column,allowed)=>{const value=url.searchParams.get(param);if(value){if(!allowed.includes(value))fail(400,'Filtro inválido: '+param);clauses.push(column+'=?');values.push(value);}};
  equals('status','t.estado',STATES);equals('category','t.categoria',CATS);equals('priority','t.prioridad',PRIOS);
  equals('assignee',"COALESCE(c.responsable,'')",RESPONSABLES);
  equals('ai',"COALESCE(c.estado_ia,IF(t.ia_respuesta IS NULL OR t.ia_respuesta='','pendiente','respondido'))",['pendiente','analizando','respondido','escalado','fallo']);
  if(url.searchParams.get('unassigned')==='1')clauses.push("COALESCE(c.responsable,'')=''");
  if(url.searchParams.get('escalated')==='1')clauses.push('t.ia_escalar=1');
  for(const [param,op] of [['from','>='],['to','<']]){const date=url.searchParams.get(param);if(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail(400,'Fecha inválida.');clauses.push(param==='to'?'t.creado_en<DATE_ADD(?,INTERVAL 1 DAY)':'t.creado_en>=?');values.push(date);}}
  if(url.searchParams.get('from')&&url.searchParams.get('to')&&url.searchParams.get('from')>url.searchParams.get('to'))fail(400,'El intervalo de fechas está invertido.');
  const search=clean(url.searchParams.get('q')||'',80);if(search){clauses.push("(t.asunto LIKE ? OR t.nombre LIKE ? OR CAST(t.id AS CHAR)=?)");const like='%'+search.replace(/[\\%_]/g,'')+'%';values.push(like,like,search.replace(/^BV-/,''));}
  const stale=url.searchParams.get('staleHours');if(stale){const hours=Number(stale);if(!Number.isSafeInteger(hours)||hours<1||hours>8760)fail(400,'El umbral de espera debe estar entre 1 y 8760 horas.');clauses.push("t.estado<>'Resuelto' AND TIMESTAMPDIFF(HOUR,t.creado_en,NOW())>=?");values.push(hours);}
  const page=Number(url.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>10000)fail(400,'Página inválida.');
  const order={priority:"FIELD(t.prioridad,'Crítica','Alta','Media','Baja'),t.creado_en ASC,t.id ASC",oldest:'t.creado_en ASC,t.id ASC',recent:'COALESCE(c.ultima_actividad,t.creado_en) DESC,t.id DESC'}[url.searchParams.get('sort')||'priority'];if(!order)fail(400,'Orden inválido.');
  return {where:clauses.length?' WHERE '+clauses.join(' AND '):'',values,page,order};
}
export async function listQueue(url){
  const f=queueFilters(url);
  const [rows,summary]=await Promise.all([
    query(`SELECT ${fields} ${join}${f.where} ORDER BY ${f.order} LIMIT 20 OFFSET ?`,[...f.values,(f.page-1)*20]),
    query(`SELECT COUNT(*) AS total,SUM(t.estado='Abierto') AS abiertos,SUM(t.estado='En proceso') AS proceso,SUM(t.estado='Resuelto') AS resueltos,
      SUM(t.ia_escalar=1 AND t.estado<>'Resuelto') AS escaladas,SUM(COALESCE(c.responsable,'')='' AND t.estado<>'Resuelto') AS sin_asignar,
      MIN(IF(t.estado<>'Resuelto',UNIX_TIMESTAMP(t.creado_en)*1000,NULL)) AS mas_antigua,
      AVG(IF(t.estado='Resuelto' AND c.resuelto_en IS NOT NULL,TIMESTAMPDIFF(MINUTE,t.creado_en,c.resuelto_en),NULL)) AS minutos_resolucion
      ${join}${f.where}`,f.values)
  ]);
  const stats=summary[0];return {tickets:rows.map(formatTicket),stats,scope:'docente',page:f.page,pages:Math.max(1,Math.ceil(Number(stats.total)/20)),responsables:RESPONSABLES};
}
