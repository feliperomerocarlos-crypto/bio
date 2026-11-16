/* Mejoras incrementales sobre las vistas y estilos originales. */
'use strict';
(function () {
  const sourceText = () => dataSource === 'demo' ? 'Datos demostrativos locales · sin conexión confirmada a TiDB' : 'Datos TiDB · última lectura del proyecto académico';
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const download = (name, rows) => {
    const url = URL.createObjectURL(new Blob([BioVolt.csv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $$('.view').map(view => view.querySelector(':scope > .container')).filter(Boolean).forEach(container => container.insertAdjacentHTML('afterbegin', '<p class="source-note small muted" data-source-note role="status"></p>'));
  function sources(detail) {
    $$('[data-source-note]').forEach(el => el.textContent = sourceText() + (DB.stats.energyUnknown ? ' · ' + DB.stats.energyUnknown + ' registros con unidades no compatibles, excluidos de energía.' : ''));
    if (detail?.availability) {
      const missing = Object.entries(detail.availability).filter(([,v]) => !v).map(([k]) => ({ biomass:'biomasa', inventory:'inventario', productionRows:'producción' }[k]));
      if (missing.length) $$('[data-source-note]').forEach(el => el.textContent += ' · No disponible: ' + missing.join(', ') + '.');
    }
  }
  sources(liveMetadata);
  let operations = liveMetadata?.operations || null;
  $('#view-analitica .container').insertAdjacentHTML('beforeend','<article class="card mt"><h2 class="panel-title">Mantenimiento y eficiencia</h2><p class="small muted">Acumulados globales; no aplican los filtros de producción. La moneda de costos no está documentada en el esquema disponible.</p><div id="operationSummary" class="stack mt"></div></article>');
  function showOperations(){
    const maintenance = operations?.maintenance, efficiency = operations?.efficiency;
    $('#operationSummary').innerHTML = '<h3 class="field-label">Mantenimientos por planta</h3>' + (Array.isArray(maintenance) ? maintenance.map(r => `<p class="small">${esc(r.planta)}: ${num(r.registros)} registros · costo ${nf2.format(r.costo)} (unidad monetaria de origen por confirmar)</p>`).join('') || '<p class="small">Sin registros.</p>' : '<p class="small muted">Mantenimiento no disponible; no se sustituyó por cifras de muestra.</p>') + '<h3 class="field-label">Eficiencia de pruebas por biomasa</h3>' + (Array.isArray(efficiency) ? efficiency.map(r=>`<p class="small">${esc(r.tipo)}: ${nf2.format(r.eficiencia)}% · ${num(r.pruebas)} pruebas</p>`).join('') || '<p class="small">Sin pruebas registradas.</p>' : '<p class="small muted">Pruebas no disponibles. No se puede calcular eficiencia operativa sin relaciones y unidades verificadas de consumo de biomasa.</p>');
  }
  showOperations();

  /* Consulta privada. El PIN no se persiste; los códigos se guardan solo en esta pestaña. */
  $('#ticketStats').insertAdjacentHTML('beforebegin', `<div class="card access-panel">
    <p class="field-label">Consultar mis solicitudes</p><p class="small muted">Pega tu código privado. Las solicitudes anteriores a esta versión se recuperan con el docente. Los códigos nuevos vencen en 30 días.</p>
    <form id="accessForm" class="toolbar mt"><label class="sr-only" for="accessCode">Código privado de solicitud</label><input class="input" id="accessCode" autocomplete="off" type="password" placeholder="Código privado"><button class="btn btn-outline btn-sm" type="submit">Consultar</button></form>
    <div class="toolbar"><button class="btn btn-ghost btn-sm" id="teacherAccess" type="button">Acceso docente</button><button class="btn btn-ghost btn-sm" id="teacherExit" type="button">Salir de docente</button><button class="btn btn-ghost btn-sm" id="forgetAccess" type="button">Olvidar mis códigos</button><span class="small muted" id="accessStatus" role="status">Solo tus solicitudes</span></div>
  </div>`);
  $('#accessForm').addEventListener('submit', async e => {
    e.preventDefault();
    const token = $('#accessCode').value.trim();
    try {
      const data = await BioVolt.fetchJSON(TAPI, { headers: { Authorization: 'Bearer ' + token } });
      if (!data.tickets?.length) throw new Error('La solicitud ya no está disponible.');
      saveAccess(data.tickets[0].id, token); $('#accessCode').value = ''; await loadRemote(false);
    } catch (err) { toast(err.message); }
  });
  $('#teacherAccess').addEventListener('click', async () => {
    const pin = prompt('Clave de docente:'); if (!pin) return;
    try {
      await BioVolt.fetchJSON(TAPI, { headers: { 'x-admin-pin': pin } });
      adminPinCache = pin; await loadRemote(false);
    } catch (err) { toast(err.message); }
  });
  $('#teacherExit').addEventListener('click', () => { adminPinCache = null; dlg.close(); loadRemote(false); });
  $('#forgetAccess').addEventListener('click', () => { ticketTokens = {}; try { sessionStorage.removeItem('bvTicketAccess'); } catch {} dlg.close(); loadRemote(false); });
  window.addEventListener('biovolt:tickets', () => $('#accessStatus').textContent = adminPinCache ? 'Acceso docente · últimas 100 solicitudes' : 'Solo solicitudes con código privado en esta pestaña');

  $('#tPrio').insertAdjacentHTML('afterend', `<label class="sr-only" for="tCatFilter">Categoría de tickets</label><select class="select" id="tCatFilter" data-ticket-filter><option value="">Todas las categorías</option>${CATS.map(c => `<option>${esc(c)}</option>`).join('')}</select><label class="small">Desde<input class="input" id="tFrom" data-ticket-filter type="date"></label><label class="small">Hasta<input class="input" id="tTo" data-ticket-filter type="date"></label><label class="small"><input id="tEscalated" data-ticket-filter type="checkbox"> Solo escaladas</label>`);
  [['#tCatFilter','category'],['#tFrom','from'],['#tTo','to'],['#tEscalated','escalated']].forEach(([sel,key]) => $(sel).addEventListener('change', e => { tState[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; renderTickets(); }));
  dlgBody.addEventListener('click', async e => {
    if (!e.target.closest('[data-follow]')) return;
    if (!adminPinCache) { toast('Entra como docente para consultar notas internas.'); return; }
    const id = currentId;
    try {
      const d = await BioVolt.fetchJSON('/api/seguimiento?id=' + encodeURIComponent(id.replace('BV-','')), { headers: accessHeaders(id) });
      if (currentId !== id || !$('#followBody')) return;
      $('#followBody').innerHTML = `<ul class="stack">${d.seguimiento.map(n => `<li class="metric-tile"><b>${esc(n.responsable || 'Sin asignar')}</b><p>${esc(n.nota)}</p><span class="small muted">${esc(fmtDate(Number(n.fecha)))}</span></li>`).join('') || '<li class="small muted">Sin notas internas.</li>'}</ul><form id="followForm" class="form"><div class="field"><label for="followOwner">Responsable</label><input class="input" id="followOwner" maxlength="80"></div><div class="field"><label for="followNote">Comentario interno</label><textarea class="textarea" id="followNote" minlength="3" maxlength="500" required></textarea></div><button class="btn btn-outline btn-sm" type="submit">Guardar seguimiento</button></form>`;
      $('#followForm').addEventListener('submit', async event => {
        event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true;
        try {
          await BioVolt.fetchJSON('/api/seguimiento?id=' + encodeURIComponent(id.replace('BV-','')), { method:'POST', headers:{ ...accessHeaders(id), 'Content-Type':'application/json' }, body:JSON.stringify({ responsable:$('#followOwner').value, nota:$('#followNote').value }) });
          toast('Seguimiento guardado.'); if (currentId === id) dlgBody.querySelector('[data-follow]').click();
        } catch (err) { toast(err.message); } finally { button.disabled = false; }
      });
    } catch (err) { toast(err.message); }
  });

  /* Inventario por material Y almacén. Nunca compara kg con toneladas. */
  $('#invCount').insertAdjacentHTML('beforebegin', `<label class="sr-only" for="invType">Tipo de biomasa</label><select class="select" id="invType"><option value="">Todos los tipos</option></select><label class="sr-only" for="invWarehouse">Almacén</label><select class="select" id="invWarehouse"><option value="">Todos los almacenes</option></select>`);
  $('#invRows').closest('article').insertAdjacentHTML('afterend', `<div class="card mt"><h2 class="panel-title">Estado del inventario</h2><p class="small muted">Umbral de alerta orientativo elegido por ti; no es un límite operativo de TiDB. Stock expresado en la unidad de la biomasa asociada; confirma esa convención con el esquema real.</p><div class="toolbar mt"><label class="small">Umbral de stock bajo<input class="input" id="stockThreshold" type="number" min="0" step="any" placeholder="Sin configurar"></label><label class="small">Unidad<select class="select" id="stockUnit"><option>kg</option><option>t</option></select></label></div><div id="stockSummary" class="stack" aria-live="polite"></div></div>`);
  let visibleInventory = [];
  const labelType = b => b.tipo || 'Tipo ' + b.id_tipo;
  function inventoryOptions() {
    [['#invType', [...new Set(DB.biomass.map(labelType))], 'Todos los tipos'],['#invWarehouse', [...new Set(DB.inventory.map(i => String(i.id_almacen)))], 'Todos los almacenes'],['#stockUnit', [...new Set(DB.biomass.map(b => b.unidad))], null]].forEach(([selector,options,all]) => {
      const el = $(selector), current = el.value;
      el.innerHTML = (all ? '<option value="">' + all + '</option>' : '') + options.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      if (options.includes(current)) el.value = current;
    });
  }
  renderInventory = function (q = $('#invSearch').value) {
    const thresholdText = $('#stockThreshold').value, threshold = Number(thresholdText), unit = $('#stockUnit').value;
    visibleInventory = DB.biomass.filter(b => (!$('#invType').value || labelType(b) === $('#invType').value) && norm(b.nombre + ' ' + b.id_biomasa + ' ' + labelType(b)).includes(norm(q.trim()))).flatMap(b => {
      const rows = DB.inventory.filter(i => String(i.id_biomasa) === String(b.id_biomasa));
      return (rows.length ? rows : [{ id_almacen: null, stock: null }]).filter(i => !$('#invWarehouse').value || String(i.id_almacen) === $('#invWarehouse').value).map(i => ({ ...b, warehouse:i.id_almacen, stock:i.stock }));
    });
    const low = r => r.stock != null && thresholdText !== '' && Number.isFinite(threshold) && threshold >= 0 && r.unidad === unit && Number(r.stock) < threshold;
    $('#invRows').innerHTML = visibleInventory.map(r => `<tr><td><b>${esc(r.nombre)}</b>${low(r) ? '<br>' + pill('Bajo umbral configurado','warn') : ''}</td><td>#${esc(r.id_biomasa)}</td><td>${esc(labelType(r))}</td><td>${nf2.format(r.cantidad)} ${esc(r.unidad)}</td><td>${r.warehouse == null ? 'Sin registro' : '#' + esc(r.warehouse)}</td><td>${r.stock == null ? 'No disponible' : nf2.format(r.stock) + ' ' + esc(r.unidad)}</td></tr>`).join('');
    $('#invCount').textContent = visibleInventory.length + ' filas material/almacén';
    $('#invRows').closest('.table-wrap').hidden = !visibleInventory.length;
    $('#invEmpty').hidden = !!visibleInventory.length;
    if (!visibleInventory.length) emptyState($('#invEmpty'),'search','Sin registros disponibles','Revisa los filtros o la disponibilidad de la fuente.');
    const groups = new Map();
    visibleInventory.forEach(r => { if (r.stock != null) { const key = labelType(r) + ' · ' + r.unidad; groups.set(key, (groups.get(key) || 0) + num(r.stock)); } });
    const largestForUnit = key => Math.max(1, ...[...groups].filter(([k])=>k.split(' · ').at(-1) === key.split(' · ').at(-1)).map(([,v])=>v));
    $('#stockSummary').innerHTML = `<p class="small">${visibleInventory.filter(low).length} filas bajo el umbral configurado. Sin capacidad disponible calculada: faltan unidades comparables de almacén.</p>` + [...groups].map(([key,value]) => `<div><p class="small">${esc(key)}: ${nf2.format(value)}</p><div class="track" role="img" aria-label="${esc(key)}: ${nf2.format(value)}"><span style="width:${100 * value / largestForUnit(key)}%"></span></div></div>`).join('') + '<p class="small muted">Escala independiente por unidad. Resumen del conjunto cargado: hasta 500 materiales y 1000 filas de inventario; puede ser parcial.</p>';
  };
  inventoryOptions(); renderInventory();
  ['#invType','#invWarehouse','#stockUnit','#stockThreshold'].forEach(selector => $(selector).addEventListener('input', () => renderInventory()));

  /* Periodos de producción: el servidor agrega; el navegador no descarga toda la tabla. */
  let analytics = null, analyticsSeq = 0;
  const dates = DB.productionRows.map(r => String(r.fecha).slice(0,10)).sort();
  const today = () => new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
  const currentRange = () => ({ from:new Date(Date.parse(today())-29*86400000).toISOString().slice(0,10), to:today(), plant:'' });
  let range = dataSource === 'tidb' ? currentRange() : { from:dates[0] || currentRange().from, to:dates.at(-1) || today(), plant:'' };
  const panelHTML = `<article class="card period-panel mt"><h2 class="panel-title">Producción por periodo</h2><form class="toolbar mt" data-period-form><label class="small">Desde<input class="input" name="from" type="date" required></label><label class="small">Hasta<input class="input" name="to" type="date" required></label><label class="small">Planta<select class="select" name="plant" data-period-plants><option value="">Todas</option></select></label><button class="btn btn-outline btn-sm" type="submit">Comparar</button></form><div data-period-output aria-live="polite"></div></article>`;
  $('#view-analitica .container').insertAdjacentHTML('beforeend', panelHTML);
  $('#view-inicio section[aria-label="Indicadores principales"]').insertAdjacentHTML('beforeend', panelHTML);
  function periodOptions() {
    $$('[data-period-form]').forEach(form => {
      form.elements.from.value = range.from; form.elements.to.value = range.to;
      form.elements.plant.innerHTML = '<option value="">Todas</option>' + DB.plants.map(p => `<option value="${esc(p.id_planta)}">${esc(p.nombre)}</option>`).join('');
      form.elements.plant.value = range.plant;
    });
  }
  function demoAnalytics() {
    const start = Date.parse(range.from), end = Date.parse(range.to), days = (end-start)/86400000+1;
    if (!Number.isFinite(days) || days < 1 || days > 366) throw new Error('Elige un periodo de 1 a 366 días.');
    const allowed = DB.productionRows.filter(r => !range.plant || String(r.id_planta) === range.plant);
    const inRange = (r,from,to) => Date.parse(String(r.fecha).slice(0,10)) >= from && Date.parse(String(r.fecha).slice(0,10)) <= to;
    const current = allowed.filter(r => inRange(r,start,end)), prev = allowed.filter(r => inRange(r,start-days*86400000,start-86400000));
    const summary = rows => ({ records:rows.length, kwh:rows.reduce((n,r) => n + (BioVolt.kwh(r) || 0),0), unknown:rows.filter(r => BioVolt.kwh(r) === null).length });
    const daily = new Map(), plants = new Map();
    current.forEach(r => { const key = String(r.fecha).slice(0,10); daily.set(key,(daily.get(key)||0)+(BioVolt.kwh(r)||0)); plants.set(r.id_planta,(plants.get(r.id_planta)||0)+(BioVolt.kwh(r)||0)); });
    return { source:'demo', unit:'kWh', range:{ ...range, previousFrom:new Date(start-days*86400000).toISOString().slice(0,10), previousTo:new Date(start-86400000).toISOString().slice(0,10) }, current:summary(current), previous:summary(prev), daily:[...daily].sort().map(([date,kwh])=>({ date,kwh })), plants:[...plants].map(([id,kwh])=>({ nombre:plantName(id),kwh })) };
  }
  function showAnalytics() {
    const a = analytics;
    const prev = num(a.previous.kwh), current = num(a.current.kwh), delta = prev ? (current-prev)/prev*100 : null;
    const max = Math.max(1,...a.daily.map(r=>num(r.kwh)));
    const html = `<p class="small muted">${a.source === 'tidb' ? 'TiDB' : 'Demostración local'} · ${esc(a.range.from)} a ${esc(a.range.to)} · comparación con ${esc(a.range.previousFrom)} a ${esc(a.range.previousTo)}</p><div class="grid comparison-grid mt"><div class="metric-tile"><p class="small">Periodo actual</p><p class="panel-title">${nf2.format(current)} kWh</p><p class="small">${num(a.current.records)} registros</p></div><div class="metric-tile"><p class="small">Periodo anterior</p><p class="panel-title">${nf2.format(prev)} kWh</p></div><div class="metric-tile"><p class="small">Variación</p><p class="panel-title">${delta === null ? 'Sin base comparable' : (delta >= 0 ? '+' : '') + nf2.format(delta) + '%'}</p></div></div><p class="small mt">${num(a.current.unknown)} registros excluidos por unidad desconocida. Una variación de producción no implica por sí sola una mejora ambiental.</p><details class="mt"><summary>Ver tendencia diaria y producción por planta</summary><div class="table-wrap" tabindex="0"><table><thead><tr><th>Fecha</th><th>Producción (kWh)</th><th>Tendencia relativa</th></tr></thead><tbody>${a.daily.map(r=>`<tr><td>${esc(String(r.date).slice(0,10))}</td><td>${nf2.format(r.kwh)}</td><td><div class="track"><span style="width:${100*num(r.kwh)/max}%"></span></div></td></tr>`).join('') || '<tr><td colspan="3">Sin registros para el periodo.</td></tr>'}</tbody></table></div><ul class="stack mt">${a.plants.map(r=>`<li>${esc(r.nombre || 'Planta sin nombre')}: ${nf2.format(r.kwh)} kWh</li>`).join('')}</ul></details>`;
    $$('[data-period-output]').forEach(el=>el.innerHTML=html);
  }
  async function loadAnalytics() {
    const seq = ++analyticsSeq;
    $$('[data-period-output]').forEach(el=>el.textContent='Consultando periodo…');
    try {
      const result = dataSource === 'demo' ? demoAnalytics() : await BioVolt.fetchJSON('/api/data?' + new URLSearchParams({ view:'analytics', ...range }));
      if (seq !== analyticsSeq) return;
      analytics = result; showAnalytics();
    } catch (err) { if (seq === analyticsSeq) { analytics = null; $$('[data-period-output]').forEach(el=>el.textContent=err.message); } }
  }
  periodOptions(); loadAnalytics();
  $$('[data-period-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault(); range={ from:form.elements.from.value, to:form.elements.to.value, plant:form.elements.plant.value }; periodOptions(); loadAnalytics(); }));

  /* Simulación explícita, sin parámetros científicos inventados. */
  $('#view-analitica .container').insertAdjacentHTML('beforeend', `<article class="card mt" id="simulator"><h2 class="panel-title">Simulador energético</h2><p class="small muted">Estimaciones orientativas; no son registros TiDB. Introduce tus propios supuestos y su fuente. No hay rendimientos técnicos predefinidos.</p><form class="form mt" id="simForm"><div class="field-row cols-2"><div class="field"><label for="simType">Tipo de biomasa / escenario</label><input class="input" id="simType" maxlength="80" required></div><div class="field"><label for="simSource">Fuente de los supuestos</label><input class="input" id="simSource" maxlength="200" required placeholder="Ej. hipótesis propia o ficha técnica consultada"></div></div><div class="field-row cols-2"><div class="field"><label for="simMass">Biomasa (kg)</label><input class="input" id="simMass" type="number" min="0" step="any" required></div><div class="field"><label for="simYield">Rendimiento térmico supuesto (kWh/kg)</label><input class="input" id="simYield" type="number" min="0" step="any" required></div></div><div class="field-row cols-2"><div class="field"><label for="simEfficiency">Eficiencia eléctrica supuesta (%)</label><input class="input" id="simEfficiency" type="number" min="0" max="100" step="any" required></div><div class="field"><label for="simPrice">Precio supuesto (COP/kWh)</label><input class="input" id="simPrice" type="number" min="0" step="any" required></div></div><button class="btn btn-outline" type="submit">Calcular y comparar escenario</button></form><p class="small mt">Energía (kWh) = biomasa (kg) × rendimiento térmico (kWh/kg) × eficiencia (%) / 100. Ingreso bruto (COP) = energía × precio. No incluye humedad, pérdidas adicionales, disponibilidad, impuestos, costos ni ingresos netos. Hasta 5 escenarios por comparación.</p><div id="simResults" class="mt" aria-live="polite"></div><button class="btn btn-ghost btn-sm mt" id="simClear" type="button">Limpiar escenarios</button></article>`);
  let scenarios=[];
  $('#simForm').addEventListener('submit', e=>{
    e.preventDefault();
    try {
      const inputs = { mass:$('#simMass').value, yieldKwh:$('#simYield').value, efficiency:$('#simEfficiency').value, price:$('#simPrice').value };
      const result = BioVolt.simulate(inputs);
      scenarios.push({ type:$('#simType').value, source:$('#simSource').value, ...inputs, ...result }); scenarios=scenarios.slice(-5);
      const max=Math.max(1,...scenarios.map(r=>r.kwh));
      $('#simResults').innerHTML='<div class="table-wrap" tabindex="0"><table><thead><tr><th>Escenario estimado</th><th>Energía (kWh)</th><th>Ingreso bruto (COP)</th><th>Supuestos / fuente</th></tr></thead><tbody>'+scenarios.map(r=>`<tr><td>${esc(r.type)}<div class="track"><span style="width:${100*r.kwh/max}%"></span></div></td><td>${nf2.format(r.kwh)}</td><td>${nf2.format(r.revenue)}</td><td>${esc(r.mass)} kg · ${esc(r.yieldKwh)} kWh/kg · ${esc(r.efficiency)}% · ${esc(r.price)} COP/kWh · ${esc(r.source)}</td></tr>`).join('')+'</tbody></table></div>';
    } catch(err) { $('#simResults').textContent=err.message; }
  });
  $('#simClear').addEventListener('click',()=>{scenarios=[];$('#simResults').textContent='';});

  /* Reportes públicos: no exportan nombres, correos, notas ni descripciones de tickets. */
  $('#view-analitica .container').insertAdjacentHTML('beforeend', `<article class="card mt"><h2 class="panel-title">Reportes BioVolt</h2><p class="small muted">Producción usa el periodo seleccionado. Ambiente es acumulado global; inventario usa sus filtros actuales. Tickets resume solo el conjunto autorizado cargado. No incluye información personal.</p><div class="toolbar mt"><label class="small">Reporte<select class="select" id="reportType"><option value="production">Producción por periodo</option><option value="environment">Impacto ambiental acumulado</option><option value="inventory">Inventario filtrado</option><option value="tickets">Estadísticas de tickets</option><option value="simulation">Escenarios estimados</option></select></label><button class="btn btn-outline btn-sm" id="exportCSV" type="button">Exportar CSV · Excel</button><button class="btn btn-outline btn-sm" id="exportPDF" type="button">Imprimir / Guardar PDF</button></div></article>`);
  function report() {
    const type=$('#reportType').value;
    const rows=[['BioVolt AI', $('#reportType').selectedOptions[0].textContent],['Generado',new Date().toLocaleString('es-CO',{ timeZone:'America/Bogota' })+' · America/Bogota'],['Fuente',sourceText()]];
    if(type==='production') {
      if (!analytics) throw new Error('Consulta un periodo válido antes de exportar.');
      rows.push(['Fuente de producción',analytics.source === 'tidb' ? 'TiDB' : 'Demostración local'],['Periodo',analytics.range.from,analytics.range.to],['Planta',range.plant ? plantName(range.plant) : 'Todas'],['Fecha','Producción (kWh)'],...analytics.daily.map(r=>[String(r.date).slice(0,10),r.kwh]),['Excluidos por unidad desconocida',analytics.current.unknown]);
    } else if(type==='environment') rows.push(['Alcance','Acumulado global; no aplica filtro de producción'],['Indicador','Cantidad','Unidad'],['CO₂ evitado',DB.stats.co2,'t'],['Residuos procesados',DB.stats.waste,'t']);
    else if(type==='inventory') rows.push(['Alcance','Solo filas cargadas y filtros de Inventario; conjunto potencialmente parcial'],['Material','Tipo','Almacén','Stock','Unidad'],...visibleInventory.map(r=>[r.nombre,labelType(r),r.warehouse,r.stock,r.unidad]));
    else if(type==='tickets') rows.push(['Alcance','Solo solicitudes autorizadas cargadas (hasta 100 para docente); sin información personal'],['Estado','Cantidad'],...STATUSES.map(status=>[status,tickets.filter(t=>t.status===status).length]),['Escaladas',tickets.filter(t=>t.ai?.escalar).length]);
    else rows.push(['Fuente','Supuestos introducidos por el usuario; estimaciones, no TiDB'],['Escenario','Biomasa (kg)','Rendimiento (kWh/kg)','Eficiencia (%)','Precio (COP/kWh)','Energía estimada (kWh)','Ingreso bruto estimado (COP)','Fuente de supuestos'],...scenarios.map(r=>[r.type,r.mass,r.yieldKwh,r.efficiency,r.price,r.kwh,r.revenue,r.source]));
    return rows;
  }
  $('#exportCSV').addEventListener('click',()=>{try{download('BioVolt-'+$('#reportType').value+'.csv',report());}catch(err){toast(err.message);}});
  document.body.insertAdjacentHTML('beforeend','<section id="printReport" hidden></section>');
  $('#exportPDF').addEventListener('click',()=>{
    try {
      const rows=report();
      $('#printReport').innerHTML='<h1>BioVolt AI</h1><table>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell??'')+'</td>').join('')+'</tr>').join('')+'</table>';
      $('#printReport').hidden=false; window.print();
    } catch(err){toast(err.message);}
  });
  window.addEventListener('afterprint',()=>$('#printReport').hidden=true);

  window.addEventListener('biovolt:data',e=>{
    sources(e.detail); operations = e.detail?.operations ?? operations; showOperations(); inventoryOptions(); renderInventory();
    if (dataSource === 'tidb' && analytics?.source !== 'tidb') {
      range = currentRange();
    }
    periodOptions(); loadAnalytics();
  });
  // Movimiento continuo solicitado por el propietario; no se modifica desde la preferencia del sistema.
})();
