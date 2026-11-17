import {test,expect} from '@playwright/test';
import {cdn} from './cdn-fixture.mjs';
test.beforeEach(async({page})=>cdn(page));
async function reset(request,scenario='success'){await request.post('/__test/reset',{data:{scenario}});}
async function create(page){
  await page.goto('/#/ayuda');await page.locator('#tName').fill('Usuario de prueba');await page.locator('#tEmail').fill('owner@example.invalid');await page.locator('#tSubject').fill('Consultar inventario de prueba');await page.locator('#tCategory').selectOption('Inventario');await page.locator('#tDescription').fill('Necesito consultar el inventario de un material.');await page.locator('#ticketForm [type=submit]').click();await expect(page.locator('#ticketDialog')).toBeVisible();await expect(page.locator('#dlgBody')).toContainText('Agente IA · Gemini',{timeout:15000});
}
async function teacher(page){await page.locator('#teacherAccess').click();await page.locator('#teacherPin').fill('teacher-test');await page.locator('#teacherForm [type=submit]').click();await expect(page.locator('#teacherExit')).toBeVisible();}
test('solicitud real del frontend recibe atención IA del servidor; historial y doble clic no duplican',async({page,request})=>{
  await reset(request);const errors=[];page.on('pageerror',e=>errors.push(e.message));await create(page);
  await expect(page.locator('#dlgBody')).toContainText('Respuesta de Gemini');
  await page.locator('#conversationMessage').fill('Ya probé esos pasos. ¿Qué reviso después?');await page.locator('#conversationForm [type=submit]').click();
  await expect(page.locator('.hd-agente')).toHaveCount(2,{timeout:15000});await expect(page.locator('.hd-solicitante')).toHaveCount(2);
  const state=await(await request.get('/__test/state')).json();expect(state.tickets).toBe(1);expect(state.calls).toBe(2);expect(errors).toEqual([]);
});
test('confirmación del solicitante cierra; sigo con el problema reabre y escala con IA',async({page,request})=>{
  await reset(request);await create(page);await page.locator('[data-feedback=helpful]').click();await expect(page.locator('#dlgBody')).toContainText('Solicitud resuelta');
  await page.locator('[data-feedback=unresolved]').click();await expect(page.locator('#dlgBody')).toContainText('IA respondió · requiere una persona',{timeout:15000});await expect(page.locator('.hd-agente')).toHaveCount(2);
});
test('responsables autorizados, respuesta humana y notas internas funcionan sin mezclarse',async({page,request})=>{
  await reset(request);await create(page);await page.locator('#dlgBody [data-hd-close]').first().click();await teacher(page);await page.locator('[data-ticket]').first().click();
  await page.getByText('Gestión docente',{exact:true}).click();await page.locator('#ticketAssignee').selectOption('José Montalvo');await page.locator('[data-assign]').click();await expect(page.locator('#dlgBody')).toContainText('Responsable asignado: José Montalvo');
  await page.getByText('Gestión docente',{exact:true}).click();await page.locator('[data-follow]').click();await page.locator('#followOwner').selectOption('Cristopher Orozco');await page.locator('#followNote').fill('NOTA_INTERNA_PRIVADA_42');await page.locator('#followForm [type=submit]').click();await expect(page.locator('#followBody')).toContainText('NOTA_INTERNA_PRIVADA_42');
  await page.locator('#conversationMessage').fill('Revisé la solicitud y continuaré el seguimiento.');await page.locator('#conversationForm [type=submit]').click();await expect(page.locator('.hd-responsable')).toContainText('José Montalvo');
  await page.locator('#dlgBody [data-hd-close]').first().click();await page.locator('#teacherExit').click();await page.locator('[data-ticket]').first().click();await expect(page.locator('#dlgBody')).not.toContainText('NOTA_INTERNA_PRIVADA_42');await expect(page.locator('[data-follow]')).toHaveCount(0);
});
test('recuperar acceso exige código de email y no revela tickets por nombre o correo',async({page,request})=>{
  await reset(request);await create(page);await page.locator('#dlgBody [data-hd-close]').first().click();await page.locator('#forgetAccess').click();await expect(page.locator('[data-ticket]')).toHaveCount(0);
  await page.getByText('Perdí mi código · Recuperar por correo').click();await page.locator('#recoveryId').fill('BV-1');await page.locator('#recoveryEmail').fill('owner@example.invalid');await page.locator('#requestRecovery').click();await expect(page.locator('#recoveryStatus')).toContainText('Si la solicitud y el correo coinciden');
  const state=await(await request.get('/__test/state')).json();const code=state.mails[0].text.match(/es: (\d{6})/)[1];await page.locator('#recoveryCode').fill(code);await page.locator('#verifyRecovery').click();await expect(page.locator('#ticketDialog')).toBeVisible();await expect(page.locator('.hd-agente')).toHaveCount(1);
});
test('la pantalla explica fallos de IA y no los disfraza de respuesta Gemini',async({page,request})=>{
  await reset(request,'quota');await page.goto('/#/ayuda');await page.locator('#tName').fill('Usuario de prueba');await page.locator('#tEmail').fill('owner@example.invalid');await page.locator('#tSubject').fill('Consultar inventario');await page.locator('#tCategory').selectOption('Inventario');await page.locator('#tDescription').fill('Descripción de prueba para solicitar ayuda.');await page.locator('#ticketForm [type=submit]').click();await expect(page.locator('#dlgBody')).toContainText('El intento de IA falló',{timeout:15000});await expect(page.locator('.hd-agente')).toHaveCount(0);await expect(page.locator('.hd-sistema')).toContainText('cuota');
});
test('guardar al crear inicia IA aunque se cierre el diálogo y se recargue la página',async({page,request})=>{
  await reset(request,'slow');await page.goto('/#/ayuda');await page.locator('#tName').fill('Usuario de prueba');await page.locator('#tEmail').fill('owner@example.invalid');await page.locator('#tSubject').fill('Consultar inventario');await page.locator('#tCategory').selectOption('Inventario');await page.locator('#tDescription').fill('Descripción de prueba para solicitar ayuda.');await page.locator('#ticketForm [type=submit]').click();await expect(page.locator('#ticketDialog')).toBeVisible();await page.locator('#dlgBody [data-hd-close]').first().click();await page.reload();await expect(page.locator('[data-ticket]')).toHaveCount(1);await page.locator('[data-ticket]').click();await expect(page.locator('.hd-agente')).toHaveCount(1,{timeout:15000});
});
for(const width of [360,768,1440])test('mesa y conversación responsive '+width,async({page,request})=>{
  await reset(request);await page.setViewportSize({width,height:900});await create(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);expect(await page.locator('#ticketDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.locator('#ticketDialog').screenshot({path:'test-results/mesa-'+width+'.png'});
});
test('cola docente pagina y filtra responsables con conteos del servidor',async({page,request})=>{
  await reset(request);
  for(let i=0;i<26;i++)await request.post('/api/tickets',{headers:{'x-idempotency-key':crypto.randomUUID()},data:{name:'Persona de prueba',email:'test@example.invalid',subject:'Solicitud número '+i,category:'Inventario',priority:'Media',description:'Descripción de prueba para revisar la cola.'}});
  await request.patch('/api/tickets?id=1',{headers:{'x-admin-pin':'teacher-test'},data:{action:'assign',assignee:'Carlos Romero'}});
  await page.goto('/#/ayuda');await teacher(page);await expect(page.locator('[data-ticket]')).toHaveCount(20);await expect(page.locator('#ticketCount')).toContainText('de 26');await page.locator('#ticketNext').click();await expect(page.locator('[data-ticket]')).toHaveCount(6);await page.locator('#tAssignee').selectOption('Carlos Romero');await expect(page.locator('[data-ticket]')).toHaveCount(1);await expect(page.locator('#ticketCount')).toContainText('de 1');
});
test('copia de revisión usa respuestas marcadas como simuladas y no llama API ni correo real',async({page})=>{
  const network=[];page.on('request',request=>{if(request.url().includes('/api/')||request.url().includes('googleapis.com'))network.push(request.url());});
  await page.goto('/__test/revision#/ayuda');await expect(page.locator('#view-ayuda')).toContainText('REVISIÓN LOCAL');
  await page.locator('#tName').fill('Demo');await page.locator('#tEmail').fill('demo@example.invalid');await page.locator('#tSubject').fill('Caso de revisión local');await page.locator('#tCategory').selectOption('Inventario');await page.locator('#tDescription').fill('Descripción ficticia para revisar la mesa de ayuda.');await page.locator('#ticketForm [type=submit]').click();await expect(page.locator('#dlgBody')).toContainText('Agente IA · Simulación local');expect(network).toEqual([]);
});
