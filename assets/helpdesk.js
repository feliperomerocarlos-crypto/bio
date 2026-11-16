/* Mesa de ayuda: agente primero, conversación privada y cola docente sobre las rutas existentes. */
'use strict';
(function(){
  const API='/api/tickets', RESPONSABLES=['José Montalvo','Cristopher Orozco','Carlos Romero'];
  const api=BioVolt.fetchJSON;
  let epoch=0,queueSeq=0,queue={scope:'propietario',stats:null,page:1,pages:1},detail=null,older=null,poll=null,pollCount=0;
  let filters={status:'',priority:'',category:'',assignee:'',ai:'',q:'',from:'',to:'',escalated:'',unassigned:'',staleHours:'',sort:'priority'};
  let queueTimer,draftKey=null,detailSeq=0,threadSignature='',busy=false;
  try { const saved=JSON.parse(sessionStorage.getItem('bvTicketAccess')||'{}'); if(saved&&typeof saved==='object'&&!Array.isArray(saved))ticketTokens=Object.fromEntries(Object.entries(saved).filter(([id,token])=>/^BV-\d+$/.test(id)&&typeof token==='string').slice(-20)); }catch{}
  const key=()=>crypto.randomUUID();
  const helpDate=ts=>new Date(ts).toLocaleString('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'});
  function saveAccess(id,token){ticketTokens[id]=token;ticketTokens=Object.fromEntries(Object.entries(ticketTokens).slice(-20));try{sessionStorage.setItem('bvTicketAccess',JSON.stringify(ticketTokens));}catch{}}
  const headers=(id,ownerOnly=false)=>!ownerOnly&&adminPinCache?{'x-admin-pin':adminPinCache}:{Authorization:'Bearer '+(ticketTokens[id]||'')};
  const send=(id,body,method='POST',ownerOnly=false)=>api(API+(id?'?id='+encodeURIComponent(id):''),{method,headers:{...headers(id,ownerOnly),'Content-Type':'application/json'},body:JSON.stringify({...body,...(id?{id}:{})})});
  const aiState=t=>t.ai?.status||(t.ai?.respuesta?'respondido':'pendiente');
  const stateText={pendiente:'Agente IA pendiente',analizando:'Agente IA analizando',respondido:'Respuesta de Gemini',escalado:'IA respondió · requiere una persona',fallo:'IA no pudo completar la respuesta'};
  const waiting={agente:'Atención del agente IA',solicitante:'Respuesta del solicitante',persona:'Atención de una persona',nadie:'Solicitud resuelta'};
  const age=ts=>{const minutes=Math.max(0,Math.floor((Date.now()-Number(ts))/60000));return minutes<60?minutes+' min':minutes<1440?Math.floor(minutes/60)+' h':Math.floor(minutes/1440)+' días';};
  function errorText(error){return error?.name==='TimeoutError'?'La operación tardó demasiado. El ticket puede estar guardado; reintenta el mismo envío.':error.message||'No se pudo completar la operación.';}
  function broadcast(){renderAnalytics();window.dispatchEvent(new Event('biovolt:tickets'));}
  function upsert(ticket){const index=tickets.findIndex(t=>t.id===ticket.id);if(index<0)tickets.unshift(ticket);else tickets[index]=ticket;}

  $('#ticketStats').insertAdjacentHTML('beforebegin',`<div class="card access-panel">
    <h2 class="panel-title">Mis solicitudes y acceso de soporte</h2><p class="small muted">Tu código privado abre únicamente tu solicitud y su conversación. Vence a los 30 días; guárdalo para otro equipo.</p>
    <form id="accessForm" class="toolbar mt"><label class="sr-only" for="accessCode">Código privado</label><input class="input" id="accessCode" type="password" autocomplete="off" placeholder="Pega tu código privado" required><button class="btn btn-outline btn-sm" type="submit">Consultar</button></form>
    <details><summary>Perdí mi código · Recuperar por correo</summary><p class="small muted mt">El acceso requiere verificar el correo registrado. No basta con conocer el número de solicitud. El envío de correo debe estar configurado por el administrador.</p>
    <form id="recoveryForm" class="form mt"><div class="field-row cols-2"><div class="field"><label for="recoveryId">Número de solicitud</label><input class="input" id="recoveryId" placeholder="BV-123" required></div><div class="field"><label for="recoveryEmail">Correo registrado</label><input class="input" id="recoveryEmail" type="email" autocomplete="email" required></div></div><button class="btn btn-outline btn-sm" id="requestRecovery" type="submit">Enviar código de verificación</button><div class="field"><label for="recoveryCode">Código recibido por correo (6 dígitos)</label><input class="input" id="recoveryCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div><button class="btn btn-outline btn-sm" type="button" id="verifyRecovery">Verificar y recuperar acceso</button><p id="recoveryStatus" class="small" role="status"></p></form></details>
    <div class="toolbar mt"><button class="btn btn-ghost btn-sm" id="teacherAccess" type="button">Acceso docente</button><button class="btn btn-ghost btn-sm" id="teacherExit" type="button" hidden>Salir de docente</button><button class="btn btn-ghost btn-sm" id="forgetAccess" type="button">Olvidar mis códigos</button><button class="btn btn-ghost btn-sm" id="refreshQueue" type="button">Actualizar</button></div><p id="accessStatus" class="small muted" role="status">Solo solicitudes con código privado</p>
  </div><p class="err" id="queueError" role="alert" hidden></p>`);
  document.body.insertAdjacentHTML('beforeend',`<dialog id="teacherDialog" aria-labelledby="teacherTitle"><form id="teacherForm" class="dlg"><h2 class="panel-title" id="teacherTitle">Acceso docente</h2><div class="field"><label for="teacherPin">Clave de docente</label><input class="input" id="teacherPin" type="password" autocomplete="off" required></div><p class="small muted">Permite asignar responsables y revisar la cola completa. La clave se conserva solo mientras esta página esté abierta.</p><p id="teacherError" class="err" role="alert"></p><div class="toolbar"><button class="btn btn-primary" type="submit">Entrar</button><button class="btn btn-outline" id="teacherCancel" type="button">Cancelar</button></div></form></dialog>`);
  const originalToolbar=$('#tPrio').closest('.toolbar');
  originalToolbar.insertAdjacentHTML('afterend',`<div class="toolbar" id="queueFilters">
    <label class="small">Categoría<select class="select" id="tCatFilter"><option value="">Todas</option>${CATS.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label>
    <label class="small">Desde<input class="input" id="tFrom" type="date"></label><label class="small">Hasta<input class="input" id="tTo" type="date"></label>
    <label class="small">Estado del agente<select class="select" id="tAiFilter"><option value="">Todos</option>${Object.entries(stateText).map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label>
    <label class="small">Responsable<select class="select" id="tAssignee"><option value="">Todos</option>${RESPONSABLES.map(r=>`<option>${esc(r)}</option>`).join('')}</select></label>
    <label class="small">Espera mayor a (horas, opcional)<input class="input" id="tStale" type="number" min="1" max="8760" placeholder="Sin umbral"></label>
    <label class="small">Orden<select class="select" id="tSort"><option value="priority">Prioridad y antigüedad</option><option value="oldest">Más antiguas</option><option value="recent">Actividad reciente</option></select></label>
    <label class="small"><input type="checkbox" id="tEscalated"> Solo escaladas</label><label class="small"><input type="checkbox" id="tUnassigned"> Sin responsable</label>
    <button class="btn btn-ghost btn-sm" type="button" id="clearTicketFilters">Limpiar filtros</button></div>`);
  $('#ticketList').insertAdjacentHTML('afterend','<div id="ticketPagination" class="toolbar mt"><button class="btn btn-outline btn-sm" id="ticketPrev" type="button">Anterior</button><span class="small" id="ticketPage"></span><button class="btn btn-outline btn-sm" id="ticketNext" type="button">Siguiente</button></div>');
  $('#ticketStats').style.gridTemplateColumns='repeat(auto-fit,minmax(130px,1fr))';
  $('#tSearch').placeholder='Buscar por asunto, ID o nombre…';
  function applyScope(){
    $('#accessStatus').textContent=adminPinCache?'Cola docente · métricas agregadas del servidor con los filtros aplicados':'Solo solicitudes con código privado en esta pestaña';
    $('#teacherExit').hidden=!adminPinCache;$('#tAssignee').disabled=false;$('#tUnassigned').disabled=false;
    $('#ticketPagination').hidden=!adminPinCache;$('#ticketPrev').disabled=queue.page<=1;$('#ticketNext').disabled=queue.page>=queue.pages;$('#ticketPage').textContent='Página '+queue.page+' de '+queue.pages;
  }
  function ownerRows(){
    let rows=tickets.filter(t=>(!filters.status||t.status===filters.status)&&(!filters.priority||t.priority===filters.priority)&&(!filters.category||t.category===filters.category)&&(!filters.assignee||t.assignee===filters.assignee)&&(!filters.unassigned||!t.assignee)&&(!filters.staleHours||(t.status!=='Resuelto'&&Date.now()-t.createdAt>=Number(filters.staleHours)*3600000))&&(!filters.ai||aiState(t)===filters.ai)&&(!filters.escalated||t.ai?.escalar)&&(!filters.q||norm([t.id,t.subject,t.name].join(' ')).includes(norm(filters.q)))&&(!filters.from||t.createdAt>=Date.parse(filters.from+'T00:00:00'))&&(!filters.to||t.createdAt<=Date.parse(filters.to+'T23:59:59.999')));
    const rank={Crítica:0,Alta:1,Media:2,Baja:3};return rows.sort((a,b)=>filters.sort==='oldest'?a.createdAt-b.createdAt:filters.sort==='recent'?(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt):(rank[a.priority]-rank[b.priority]||a.createdAt-b.createdAt));
  }
  function render(){
    const rows=adminPinCache?tickets:ownerRows(),s=adminPinCache?queue.stats:null;
    const values=s?[['Abiertos',s.abiertos],['En proceso',s.proceso],['Resueltos',s.resueltos],['Escaladas abiertas',s.escaladas],['Sin responsable',s.sin_asignar]]:[['Abiertos',rows.filter(t=>t.status==='Abierto').length],['En proceso',rows.filter(t=>t.status==='En proceso').length],['Resueltos',rows.filter(t=>t.status==='Resuelto').length]];
    $('#ticketStats').innerHTML=values.map(([label,value])=>`<div class="card"><p class="small muted">${label}</p><p class="stat-value" style="font-size:30px">${Number(value)||0}</p></div>`).join('');
    $('#statusFilters').innerHTML=['Todos',...STATUSES].map(s=>`<button class="chip" type="button" data-status-filter="${s==='Todos'?'':s}" aria-pressed="${filters.status===(s==='Todos'?'':s)}">${s}</button>`).join('');
    $('#ticketCount').textContent=rows.length+' visibles'+(s?' de '+Number(s.total)+' solicitudes filtradas':' con tus códigos privados')+(s?.minutos_resolucion!=null?' · Resolución media registrada: '+Math.round(Number(s.minutos_resolucion))+' min':'');
    $('#ticketList').innerHTML=rows.map(t=>`<button class="card ticket" type="button" data-ticket="${esc(t.id)}"><span class="ticket-main"><span class="ticket-title">${esc(t.subject)}</span><span class="small muted">${esc(t.id)} · ${esc(t.category)} · ${esc(helpDate(t.createdAt))}</span><span class="small">${esc(t.assignee||'Sin responsable asignado')} · Última actividad hace ${esc(age(t.updatedAt||t.createdAt))}</span><span class="small muted">Espera: ${esc(waiting[t.waitingFor]||'Agente IA')}</span></span><span class="ticket-pills">${prioPill(t.priority)}${statusPill(t.status)}${pill(stateText[aiState(t)]||'Estado IA no disponible',aiState(t)==='fallo'?'danger':t.ai?.escalar?'warn':'info')}</span></button>`).join('');
    $('#ticketEmpty').hidden=rows.length>0;
    if(!rows.length)emptyState($('#ticketEmpty'),'inbox','No hay solicitudes visibles',adminPinCache?'No hay resultados para estos filtros.':'Crea una solicitud o introduce su código privado para consultar el historial.');
    applyScope();
  }
  async function load(silent=false){
    const requestEpoch=epoch,seq=++queueSeq;$('#queueError').hidden=true;
    try{
      if(adminPinCache){
        const params=new URLSearchParams({...filters,page:String(queue.page)});const data=await api(API+'?'+params,{headers:headers()});
        if(requestEpoch!==epoch||seq!==queueSeq)return;
        if(data.page>data.pages){queue.page=data.pages;return load(silent);}
        tickets=data.tickets;queue=data;
      }else{
        const results=await Promise.allSettled(Object.keys(ticketTokens).map(id=>api(API,{headers:headers(id)})));
        if(requestEpoch!==epoch||seq!==queueSeq)return;
        tickets=results.flatMap(r=>r.status==='fulfilled'?r.value.tickets:[]);queue={scope:'propietario',stats:null,page:1,pages:1};
        if(results.some(r=>r.status==='rejected')&&!silent)throw new Error('Alguna solicitud no pudo cargarse. El código puede haber vencido o el servicio no está disponible.');
      }
    }catch(error){
      if(requestEpoch!==epoch||seq!==queueSeq)return;
      if(error.status===403){adminPinCache=null;tickets=[];epoch++;}
      $('#queueError').textContent=errorText(error);$('#queueError').hidden=false;
    }
    render();broadcast();
  }
  function reloadFilters(){if(filters.from&&filters.to&&filters.from>filters.to){$('#queueError').textContent='El intervalo de fechas está invertido.';$('#queueError').hidden=false;return;}queue.page=1;if(adminPinCache)load();else render();}
  [['#tStale','staleHours'],['#tPrio','priority'],['#tCatFilter','category'],['#tFrom','from'],['#tTo','to'],['#tAiFilter','ai'],['#tAssignee','assignee'],['#tSort','sort'],['#tEscalated','escalated'],['#tUnassigned','unassigned']].forEach(([selector,name])=>$(selector).addEventListener('change',e=>{filters[name]=e.target.type==='checkbox'?(e.target.checked?'1':''):e.target.value;reloadFilters();}));
  $('#tSearch').addEventListener('input',e=>{filters.q=e.target.value;clearTimeout(queueTimer);queueTimer=setTimeout(reloadFilters,350);});
  $('#statusFilters').addEventListener('click',e=>{const button=e.target.closest('[data-status-filter]');if(button){filters.status=button.dataset.statusFilter;reloadFilters();}});
  $('#clearTicketFilters').addEventListener('click',()=>{filters={status:'',priority:'',category:'',assignee:'',ai:'',q:'',from:'',to:'',escalated:'',unassigned:'',staleHours:'',sort:'priority'};['#tStale','#tPrio','#tCatFilter','#tFrom','#tTo','#tAiFilter','#tAssignee','#tSearch'].forEach(s=>$(s).value='');$('#tSort').value='priority';$('#tEscalated').checked=false;$('#tUnassigned').checked=false;reloadFilters();});
  $('#ticketPrev').addEventListener('click',()=>{if(queue.page>1){queue.page--;load();}});$('#ticketNext').addEventListener('click',()=>{if(queue.page<queue.pages){queue.page++;load();}});
  $('#refreshQueue').addEventListener('click',()=>load());
  $('#accessForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const token=$('#accessCode').value.trim(),data=await api(API,{headers:{Authorization:'Bearer '+token}});if(!data.tickets?.length)throw new Error('Solicitud no disponible.');saveAccess(data.tickets[0].id,token);$('#accessCode').value='';await load();await openTicket(data.tickets[0].id);}catch(error){toast(errorText(error));}finally{button.disabled=false;}});
  $('#teacherAccess').addEventListener('click',()=>{$('#teacherPin').value='';$('#teacherError').textContent='';$('#teacherDialog').showModal();});
  $('#teacherCancel').addEventListener('click',()=>$('#teacherDialog').close());
  $('#teacherForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const pin=$('#teacherPin').value;const data=await api(API,{headers:{'x-admin-pin':pin}});epoch++;adminPinCache=pin;queue=data;tickets=data.tickets;$('#teacherPin').value='';$('#teacherDialog').close();render();broadcast();}catch(error){$('#teacherError').textContent=errorText(error);}finally{button.disabled=false;}});
  $('#teacherExit').addEventListener('click',()=>{epoch++;adminPinCache=null;detail=null;dlg.close();tickets=[];queue={scope:'propietario',stats:null,page:1,pages:1};load();});
  $('#forgetAccess').addEventListener('click',()=>{epoch++;ticketTokens={};try{sessionStorage.removeItem('bvTicketAccess');}catch{}detail=null;dlg.close();tickets=[];load();});
  $('#recoveryForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('#requestRecovery');button.disabled=true;try{const data=await send(null,{action:'recover',id:$('#recoveryId').value.trim(),email:$('#recoveryEmail').value.trim()});$('#recoveryStatus').textContent=data.message;}catch(error){$('#recoveryStatus').textContent=errorText(error);}finally{button.disabled=false;}});
  $('#verifyRecovery').addEventListener('click',async e=>{if(!$('#recoveryForm').reportValidity())return;e.target.disabled=true;try{const id=$('#recoveryId').value.trim(),data=await send(null,{action:'verify',id,email:$('#recoveryEmail').value.trim(),code:$('#recoveryCode').value.trim()});const numeric=id.replace(/^BV-/,'');saveAccess('BV-'+numeric,data.accessToken);$('#recoveryCode').value='';$('#recoveryStatus').textContent='Acceso recuperado. Conserva el nuevo código privado.';await load();await openTicket('BV-'+numeric);}catch(error){$('#recoveryStatus').textContent=errorText(error);}finally{e.target.disabled=false;}});

  const form=$('#ticketForm');
  const rules={name:v=>v.trim().length>=3,email:v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),subject:v=>v.trim().length>=5,category:v=>CATS.includes(v),priority:v=>['Baja','Media','Alta','Crítica'].includes(v),description:v=>v.trim().length>=15};
  function validate(name){const field=form.elements[name],ok=rules[name](field.value),error=$('#'+field.id+'-err');field.setAttribute('aria-invalid',String(!ok));error.hidden=ok;error.textContent=ok?'':'Revisa este campo'+(name==='description'?' (mínimo 15 caracteres).':'.');return ok;}
  Object.keys(rules).forEach(name=>form.elements[name].addEventListener('blur',()=>{if(form.elements[name].value)validate(name);}));
  $('#tDescription').addEventListener('input',e=>$('#tDescCount').textContent=e.target.value.length+'/500');
  $('#newTicketBtn').addEventListener('click',()=>{form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.name.focus({preventScroll:true});});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;const invalid=Object.keys(rules).filter(name=>!validate(name));if(invalid.length){form.elements[invalid[0]].focus();return;}
    busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Guardando y preparando atención IA…';
    const requestEpoch=epoch;
    try{
      const body=Object.fromEntries(Object.keys(rules).map(name=>[name,form.elements[name].value]));
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body))),fingerprint=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
      try{draftKey=JSON.parse(sessionStorage.getItem('bvHelpdeskDraft')||'null');}catch{}
      if(!draftKey||draftKey.fingerprint!==fingerprint)draftKey={fingerprint,key:key()};
      try{sessionStorage.setItem('bvHelpdeskDraft',JSON.stringify(draftKey));}catch{}
      const data=await api(API,{method:'POST',headers:{'Content-Type':'application/json','x-idempotency-key':draftKey.key},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
      if(requestEpoch!==epoch)return;
      saveAccess(data.ticket.id,data.accessToken);upsert(data.ticket);draftKey=null;try{sessionStorage.removeItem('bvHelpdeskDraft');}catch{}
      form.reset();$('#tDescCount').textContent='0/500';Object.keys(rules).forEach(name=>{form.elements[name].removeAttribute('aria-invalid');$('#'+form.elements[name].id+'-err').hidden=true;});
      render();broadcast();toast(data.ticket.id+' guardada. El agente inicia la atención automáticamente.');await openTicket(data.ticket.id);if(adminPinCache)await load(true);
    }catch(error){toast(errorText(error));}finally{busy=false;button.disabled=false;button.textContent='Enviar solicitud';}
  });

  function safeSources(sources){return (sources||[]).map(source=>{try{const url=new URL(source.url);return url.protocol==='https:'&&!url.username&&!url.password?`<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(source.title||url.hostname)}</a>`:'';}catch{return '';}}).filter(Boolean).join(' · ');}
  function renderDetail(){
    if(!detail)return;const t=detail.ticket,messages=detail.messages||[],state=aiState(t),owner=!!ticketTokens[t.id],draft=$('#conversationMessage')?.value||'';
    const active=['pendiente','analizando'].includes(state),ready=(!!t.ai?.respuesta&&(!t.ai?.processedVersion||t.ai.processedVersion===t.version))||messages.some(m=>m.role==='responsable');
    dlgBody.innerHTML=`<div class="dlg"><div class="dlg-top"><div><p class="eyebrow">${esc(t.id)}</p><h2 class="h-sm" id="dlgTitle">${esc(t.subject)}</h2></div><button class="icon-btn" type="button" data-hd-close aria-label="Cerrar detalle">${icon('x',20)}</button></div>
      <div class="chips">${prioPill(t.priority)}${statusPill(t.status)}${pill(stateText[state]||'IA pendiente',state==='fallo'?'danger':t.ai?.escalar?'warn':'info')}</div>
      <p class="small">Responsable: <b>${esc(t.assignee||'Sin asignar')}</b> · Espera: ${esc(waiting[t.waitingFor]||'Agente IA')}<br>Creada: ${esc(helpDate(t.createdAt))} · Última actividad: ${esc(helpDate(t.updatedAt||t.createdAt))}</p>
      ${t.ai?.escalar?`<p class="notice">Escalada a una persona: ${esc(t.ai.motivo||'Requiere revisión humana.')}</p>`:''}
      ${state==='fallo'?'<p class="err" role="status">El intento de IA falló. El mensaje del sistema no se presenta como una respuesta de Gemini. Tu solicitud está guardada.</p>':''}
      ${active?'<p class="small hd-processing" role="status">El agente de IA está preparando su respuesta…</p>':''}
      <div class="toolbar"><button class="btn btn-outline btn-sm" type="button" data-refresh-ticket>Actualizar conversación</button>${t.ai?.canRetry&&state!=='analizando'?'<button class="btn btn-outline btn-sm" type="button" data-retry-agent>Reintentar agente IA</button>':''}</div>
      ${owner?`<details><summary>Mi código privado</summary><div class="field mt"><label for="privateCode">Conserva este código; permite acceder a esta solicitud durante 30 días</label><input class="input" id="privateCode" type="password" readonly value="${esc(ticketTokens[t.id])}"><div class="toolbar"><button class="btn btn-ghost btn-sm" type="button" data-show-code>Mostrar / ocultar</button><button class="btn btn-ghost btn-sm" type="button" data-copy-code>Copiar código</button></div></div></details>`:''}
      <section aria-label="Conversación de la solicitud"><h3 class="panel-title">Conversación</h3>${older?'<button class="btn btn-ghost btn-sm" type="button" data-older>Cargar mensajes anteriores</button>':''}<ol class="hd-thread">${messages.map(m=>`<li class="hd-message hd-${esc(m.role)}"><p class="small muted">${esc(m.role==='agente'?(m.source==='historico'?'Agente IA · Historial anterior':m.source==='demo'?'Agente IA · Simulación local':'Agente IA · Gemini'):m.role==='responsable'?'Respuesta humana · '+m.name:m.role==='solicitante'?'Solicitante':'Sistema')} · ${esc(helpDate(m.at))}</p><div class="hd-message-text">${esc(m.text)}</div>${m.tools?.length?`<p class="small muted">Herramientas: ${esc(m.tools.join(' · '))}</p>`:''}${m.sources?.length?`<p class="small">Fuentes: ${safeSources(m.sources)}</p>`:''}</li>`).join('')||`<li class="hd-message"><p>${esc(t.description)}</p></li>`}</ol></section>
      ${owner&&!active&&(ready||t.status==='Resuelto')?`<div class="hd-feedback"><p class="field-label">¿La solución funcionó?</p><div class="toolbar mt">${t.status!=='Resuelto'?'<button class="btn btn-primary btn-sm" type="button" data-feedback="helpful">Me sirvió · Confirmar solución</button>':''}<button class="btn btn-outline btn-sm" type="button" data-feedback="unresolved">Sigo con el problema${t.status==='Resuelto'?' · Reabrir':''}</button></div></div>`:''}
      ${t.status!=='Resuelto'?`<form id="conversationForm" class="form"><div class="field"><label for="conversationMessage">${adminPinCache?'Respuesta pública del responsable':'Responder al agente o aportar más información'}</label><textarea class="textarea" id="conversationMessage" maxlength="2000" minlength="3" required ${active?'disabled':''}></textarea></div><button class="btn btn-primary btn-sm" type="submit" ${active?'disabled':''}>${adminPinCache?'Publicar respuesta humana':'Enviar y solicitar respuesta IA'}</button><p class="small muted">Las respuestas humanas se habilitan después de que el agente intente atender la solicitud. No escribas contraseñas ni claves.</p></form>`:''}
      ${adminPinCache?`<details><summary>Gestión docente</summary><div class="form mt"><div class="field"><label for="ticketAssignee">Responsable actual</label><select class="select" id="ticketAssignee"><option value="">Sin asignar</option>${RESPONSABLES.map(name=>`<option ${name===t.assignee?'selected':''}>${esc(name)}</option>`).join('')}</select></div><button class="btn btn-outline btn-sm" type="button" data-assign>Guardar responsable</button>
      <button class="btn btn-outline btn-sm" type="button" data-follow>Ver notas internas</button><div id="followBody" class="stack"></div>
      ${t.status!=='Resuelto'?`<form id="verifyResolutionForm" class="form"><label class="small"><input type="checkbox" id="verifiedResolution" required> Verifiqué que la solicitud fue resuelta</label><div class="field"><label for="resolutionNote">Cómo se comprobó la solución</label><textarea class="textarea" id="resolutionNote" minlength="10" maxlength="500" required></textarea></div><button class="btn btn-outline btn-sm" type="submit">Cerrar con verificación humana</button></form>`:''}
      <button class="btn btn-danger btn-sm" type="button" data-delete-ticket>Eliminar solicitud</button></div></details>`:''}
      <p class="err" id="detailError" role="alert" hidden></p><button class="btn btn-outline btn-sm" type="button" data-hd-close>Cerrar detalle</button></div>`;
    if($('#conversationMessage'))$('#conversationMessage').value=draft;
  }
  function schedulePoll(){clearTimeout(poll);if(!detail||!dlg.open||document.hidden||!['pendiente','analizando'].includes(aiState(detail.ticket))||pollCount>=24)return;poll=setTimeout(()=>{pollCount++;refreshDetail(true);},2500);}
  async function refreshDetail(silent=false){
    if(!currentId)return;const id=currentId,requestEpoch=epoch,seq=++detailSeq;
    try{
      const data=await api(API+'?id='+encodeURIComponent(id),{headers:headers(id)});
      if(id!==currentId||requestEpoch!==epoch||seq!==detailSeq)return;
      const signature=JSON.stringify([data.ticket,data.messages]);detail=data;older=data.before;upsert(data.ticket);
      if(signature!==threadSignature){threadSignature=signature;renderDetail();render();broadcast();}
      schedulePoll();
    }catch(error){if(id===currentId&&requestEpoch===epoch){if(!silent)toast(errorText(error));if($('#detailError')){$('#detailError').textContent=errorText(error);$('#detailError').hidden=false;}}}
  }
  async function openTicket(id){currentId=id;detail=null;threadSignature='';pollCount=0;dlgBody.innerHTML='<div class="dlg"><p role="status">Cargando conversación privada…</p><button class="btn btn-outline" data-hd-close type="button">Cerrar</button></div>';if(!dlg.open)dlg.showModal();await refreshDetail();}
  $('#ticketList').addEventListener('click',e=>{const button=e.target.closest('[data-ticket]');if(button)openTicket(button.dataset.ticket);});
  dlg.addEventListener('close',()=>{clearTimeout(poll);currentId=null;detail=null;detailSeq++;threadSignature='';});
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dlg.open){pollCount=0;refreshDetail(true);}else clearTimeout(poll);});
  dlgBody.addEventListener('submit',async e=>{
    if(!['conversationForm','verifyResolutionForm','followForm'].includes(e.target.id))return;e.preventDefault();const id=currentId,requestEpoch=epoch,button=e.target.querySelector('[type=submit]');if(button)button.disabled=true;
    try{
      if(e.target.id==='conversationForm'){
        const input=$('#conversationMessage'),text=input.value.trim();
        const messageKey=input.dataset.clientKey&&input.dataset.sentText===text?input.dataset.clientKey:key();input.dataset.clientKey=messageKey;input.dataset.sentText=text;
        await send(id,{action:'message',message:text,clientKey:messageKey});if(requestEpoch!==epoch||id!==currentId)return;input.value='';
      }else if(e.target.id==='verifyResolutionForm')await send(id,{estado:'Resuelto',version:detail.ticket.version,verified:$('#verifiedResolution').checked,resolutionNote:$('#resolutionNote').value},'PATCH');
      else{
        await api('/api/seguimiento?id='+id.replace('BV-',''),{method:'POST',headers:{...headers(id),'Content-Type':'application/json'},body:JSON.stringify({responsable:$('#followOwner').value,nota:$('#followNote').value})});
        if(requestEpoch!==epoch||id!==currentId)return;toast('Nota interna guardada.');$('#followNote').value='';await loadInternal(id);return;
      }
      if(requestEpoch===epoch&&id===currentId){pollCount=0;threadSignature='';await refreshDetail();if(adminPinCache)await load(true);}
    }catch(error){if(requestEpoch===epoch&&id===currentId){$('#detailError').hidden=false;$('#detailError').textContent=errorText(error);}}finally{if(button?.isConnected)button.disabled=false;}
  });
  async function loadInternal(id){
    const requestEpoch=epoch;const data=await api('/api/seguimiento?id='+id.replace('BV-',''),{headers:headers(id)});
    if(id!==currentId||requestEpoch!==epoch||!adminPinCache)return;
    $('#followBody').innerHTML=`<p class="small muted">Solo acceso docente · estas notas no se envían a Gemini ni al solicitante.</p><ul class="stack">${data.seguimiento.map(n=>`<li class="metric-tile"><b>${esc(n.responsable||'Sin responsable')}</b><p>${esc(n.nota)}</p><span class="small muted">${esc(helpDate(Number(n.fecha)))}</span></li>`).join('')||'<li class="small muted">Sin notas internas.</li>'}</ul><form id="followForm" class="form"><div class="field"><label for="followOwner">Responsable de la nota</label><select class="select" id="followOwner">${RESPONSABLES.map(name=>`<option>${esc(name)}</option>`).join('')}</select></div><div class="field"><label for="followNote">Comentario interno</label><textarea class="textarea" id="followNote" minlength="3" maxlength="500" required></textarea></div><button class="btn btn-outline btn-sm" type="submit">Guardar nota interna</button></form>`;
  }
  dlgBody.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-hd-close')){dlg.close();return;}
    const id=currentId,requestEpoch=epoch;if(!id||!detail)return;button.disabled=true;
    try{
      if(button.hasAttribute('data-show-code')){$('#privateCode').type=$('#privateCode').type==='password'?'text':'password';return;}
      if(button.hasAttribute('data-copy-code')){try{await navigator.clipboard.writeText(ticketTokens[id]);toast('Código copiado.');}catch{$('#privateCode').type='text';$('#privateCode').select();toast('Selecciona y copia el código con Ctrl+C.');}return;}
      if(button.hasAttribute('data-refresh-ticket')){pollCount=0;await refreshDetail();return;}
      if(button.hasAttribute('data-older')){
        const data=await api(API+'?id='+encodeURIComponent(id)+'&before='+older,{headers:headers(id)});if(requestEpoch!==epoch||id!==currentId)return;
        const map=new Map([...data.messages,...detail.messages].map(m=>[m.id,m]));detail.messages=[...map.values()];older=data.before;renderDetail();return;
      }
      if(button.hasAttribute('data-follow')){await loadInternal(id);return;}
      if(button.hasAttribute('data-retry-agent'))await api('/api/agente',{method:'POST',headers:{...headers(id),'Content-Type':'application/json'},body:JSON.stringify({id})});
      else if(button.dataset.feedback)await send(id,{action:'feedback',value:button.dataset.feedback,version:detail.ticket.version},'POST',true);
      else if(button.hasAttribute('data-assign'))await send(id,{action:'assign',assignee:$('#ticketAssignee').value},'PATCH');
      else if(button.hasAttribute('data-delete-ticket')){
        if(!confirm('¿Eliminar '+id+'? Esta acción requiere acceso docente.'))return;
        await api(API+'?id='+id+'&confirm=yes',{method:'DELETE',headers:headers(id)});if(requestEpoch!==epoch)return;dlg.close();await load();return;
      }else return;
      if(requestEpoch===epoch&&id===currentId){pollCount=0;threadSignature='';await refreshDetail();if(adminPinCache)await load(true);}
    }catch(error){if(requestEpoch===epoch&&id===currentId&&$('#detailError')){$('#detailError').hidden=false;$('#detailError').textContent=errorText(error);}}finally{if(button.isConnected)button.disabled=false;}
  });
  window.BioVoltHelpdesk={render,load,summary:()=>({scope:queue.scope,stats:queue.stats})};
  render();load(true);
})();
