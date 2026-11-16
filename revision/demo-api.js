// Adaptador SOLO de la copia de revisión. No se copia a dist ni envía información a la red.
(function(){
  const tickets=new Map(),threads=new Map(),notes=new Map(),keys=new Map();let next=1;
  const staff=['José Montalvo','Cristopher Orozco','Carlos Romero'];
  const reply=(status,data)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));
  const token=id=>'DEMO-PRIVADO-'+id,number=id=>Number(String(id||'').replace(/^BV-/,''));
  function message(t,role,text,name=''){const list=threads.get(t.id)||[];list.push({id:String(Date.now())+'-'+list.length,role,text,name,source:role==='agente'?'demo':role==='responsable'?'humano':role==='solicitante'?'usuario':'sistema',at:Date.now(),tools:[],sources:[]});threads.set(t.id,list);t.updatedAt=Date.now();}
  function respond(t){
    t.status='En proceso';t.waitingFor=t.ai.escalar?'persona':'solicitante';
    t.ai={...t.ai,status:t.ai.escalar?'escalado':'respondido',source:'demo',processedVersion:t.version,at:Date.now(),attempts:1,canRetry:false,respuesta:'Demostración local de una respuesta del agente. En la versión conectada, Gemini analizará la solicitud con sus herramientas y el historial. Puedes responder, confirmar la solución o indicar que el problema continúa.'};
    message(t,'agente',t.ai.respuesta);return t;
  }
  window.bioPreviewOffline=async function(path,options={}){
    const url=new URL(path,'https://preview.invalid'),method=options.method||'GET',h=new Headers(options.headers||{});
    const admin=h.get('x-admin-pin')==='DEMO';let body={};try{body=JSON.parse(options.body||'{}');}catch{}
    const id=number(body.id||url.searchParams.get('id')),code=h.get('authorization')?.replace(/^Bearer /,'');
    const allowed=t=>admin||code===token(number(t.id));
    if(url.pathname==='/api/tickets'){
      if(method==='GET'){
        if(id){const t=tickets.get('BV-'+id);if(!t)return reply(404,{error:'Solicitud de demostración no encontrada.'});if(!allowed(t))return reply(403,{error:'Código de demostración inválido.'});return reply(200,{ticket:t,messages:threads.get(t.id)||[],before:null});}
        if(admin){
          let rows=[...tickets.values()];const filters={status:'status',priority:'priority',category:'category',assignee:'assignee'};
          for(const [param,field] of Object.entries(filters))if(url.searchParams.get(param))rows=rows.filter(t=>t[field]===url.searchParams.get(param));
          const search=url.searchParams.get('q');if(search)rows=rows.filter(t=>(t.id+' '+t.subject+' '+t.name).toLowerCase().includes(search.toLowerCase()));
          if(url.searchParams.get('escalated')==='1')rows=rows.filter(t=>t.ai.escalar);if(url.searchParams.get('unassigned')==='1')rows=rows.filter(t=>!t.assignee);
          if(url.searchParams.get('ai'))rows=rows.filter(t=>t.ai.status===url.searchParams.get('ai'));
          const stats={total:rows.length,abiertos:rows.filter(t=>t.status==='Abierto').length,proceso:rows.filter(t=>t.status==='En proceso').length,resueltos:rows.filter(t=>t.status==='Resuelto').length,escaladas:rows.filter(t=>t.ai.escalar&&t.status!=='Resuelto').length,sin_asignar:rows.filter(t=>!t.assignee&&t.status!=='Resuelto').length};
          const page=Number(url.searchParams.get('page')||1);return reply(200,{tickets:rows.slice((page-1)*20,page*20),stats,page,pages:Math.max(1,Math.ceil(rows.length/20)),scope:'docente',responsables:staff});
        }
        const row=[...tickets.values()].find(allowed);return row?reply(200,{tickets:[row],scope:'propietario'}):reply(403,{error:'Introduce un código privado de esta demostración.'});
      }
      if(method==='POST'&&body.action==='recover')return reply(202,{message:'Demostración: no se envió ningún correo. Para probar la recuperación usa el código 123456 con una solicitud creada aquí.'});
      if(method==='POST'&&body.action==='verify'){const t=tickets.get('BV-'+id);return t&&t._email===body.email&&body.code==='123456'?reply(200,{accessToken:token(id)}):reply(400,{error:'Datos de demostración incorrectos.'});}
      if(method==='POST'&&!body.action){
        const k=h.get('x-idempotency-key');if(keys.has(k)){const t=tickets.get(keys.get(k));return reply(200,{ticket:t,accessToken:token(number(t.id))});}
        const t={id:'BV-'+next++,subject:body.subject,name:body.name,_email:body.email,email:'Oculto por privacidad',description:body.description,category:body.category,priority:body.priority,status:'Abierto',createdAt:Date.now(),updatedAt:Date.now(),assignee:'',waitingFor:'agente',version:1,ai:{status:'pendiente',escalar:false,herramientas:[]}};
        tickets.set(t.id,t);keys.set(k,t.id);message(t,'solicitante',t.description);respond(t);return reply(201,{ticket:t,accessToken:token(number(t.id))});
      }
      const t=tickets.get('BV-'+id);if(!t||!allowed(t))return reply(403,{error:'Acceso de demostración no válido.'});
      if(body.action==='message'){
        if(admin&&!t.assignee)return reply(400,{error:'Asigna un responsable primero.'});
        message(t,admin?'responsable':'solicitante',body.message,admin?t.assignee:'');if(!admin){t.version++;respond(t);}
      }else if(body.action==='feedback'){
        if(body.value==='helpful'){t.status='Resuelto';t.waitingFor='nadie';message(t,'sistema','El solicitante confirmó la solución en esta demostración.');}
        else{t.version++;t.ai.escalar=true;t.ai.motivo='El solicitante indicó que el problema continúa.';message(t,'solicitante','Sigo con el problema.');respond(t);}
      }else if(method==='PATCH'&&admin){
        if(body.action==='assign'){if(body.assignee&&!staff.includes(body.assignee))return reply(400,{error:'Responsable inválido.'});t.assignee=body.assignee;message(t,'sistema','Responsable asignado: '+t.assignee);}
        else{t.status=body.estado;t.waitingFor=t.status==='Resuelto'?'nadie':'persona';message(t,'sistema','Cambio de estado verificado en la demostración.');}
      }else if(method==='DELETE'&&admin){tickets.delete(t.id);return reply(200,{ok:true});}
      return reply(200,{ticket:t});
    }
    if(url.pathname==='/api/agente'){const t=tickets.get('BV-'+id);return t&&allowed(t)?reply(200,{ticket:respond(t)}):reply(403,{error:'Acceso de demostración no válido.'});}
    if(url.pathname==='/api/seguimiento'){
      if(!admin)return reply(403,{error:'Solo acceso docente de demostración.'});
      const id=number(url.searchParams.get('id')),list=notes.get(id)||[];
      if(method==='POST'){list.unshift({responsable:body.responsable,nota:body.nota,fecha:Date.now()});notes.set(id,list);return reply(201,{ok:true});}
      return reply(200,{seguimiento:list});
    }
    return reply(503,{error:'Vista de revisión: servicio externo desconectado.'});
  };
  document.addEventListener('click',event=>{const a=event.target.closest?.('a[href^="#/"]');if(a){event.preventDefault();location.hash=a.getAttribute('href');}},true);
  document.addEventListener('DOMContentLoaded',()=>{
    const notice=document.createElement('div');notice.className='notice';notice.textContent='REVISIÓN LOCAL: datos y respuestas del agente simulados. No se usa Gemini ni se envían correos. Puedes crear tickets de prueba. Acceso docente de demostración: DEMO. Los tickets se pierden al recargar.';document.querySelector('#view-ayuda .view-head').after(notice);
  });
})();
