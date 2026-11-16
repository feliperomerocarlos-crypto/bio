import { test, expect } from '@playwright/test';
const ticket={id:'BV-7',subject:'Consulta de inventario',name:'Usuario privado',email:'Oculto por privacidad',category:'Inventario',priority:'Alta',status:'Abierto',description:'Necesito consultar el inventario disponible.',createdAt:Date.now(),ai:null};
const token='private-test-code.signature';
async function offline(page){await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'API simulada no disponible'}}));}
test('todas las vistas, menú móvil y formulario inválido no provocan errores JS',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await offline(page);await page.goto('/');
  for(const route of ['inicio','operaciones','inventario','plantas','directorio','analitica','ayuda','asistente']){
    await page.goto('/#/'+route);await expect(page.locator('#view-'+route)).toBeVisible();
  }
  await page.goto('/#/ayuda');await page.locator('#ticketForm [type=submit]').click();await expect(page.locator('#tName-err')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await page.locator('#menuBtn').click();await expect(page.locator('#menuBtn')).toHaveAttribute('aria-expanded','true');
  await page.locator('#navLinks a[data-route=inventario]').click();await expect(page.locator('#view-inventario')).toBeVisible();
  expect(errors).toEqual([]);
});
test('chat distingue Gemini de respaldo y restaura historial en la pestaña',async({page})=>{
  await offline(page);await page.route('**/api/chat',r=>r.fulfill({json:{reply:'Respuesta verificada en mock',source:'gemini'}}));
  await page.goto('/#/asistente');await page.locator('#chatInput').fill('Hola');await page.locator('#chatSend').click();await expect(page.locator('.msg-row.assistant')).toContainText('Gemini');
  await page.route('**/api/chat',r=>r.fulfill({status:429,json:{error:'Cuota simulada'}}));await page.locator('#chatInput').fill('inventario');await page.locator('#chatSend').click();await expect(page.locator('.msg-row.assistant').last()).toContainText('Respaldo local');await expect(page.locator('.msg-row.assistant').last()).toContainText('Datos demostrativos');
  await page.reload();await expect(page.locator('.msg-row')).toHaveCount(4);
});
test('inventario filtra almacén, tipo y umbral sin perder filas',async({page})=>{
  await offline(page);await page.goto('/#/inventario');await page.locator('#invWarehouse').selectOption('2');await expect(page.locator('#invRows tr')).toHaveCount(1);
  await page.locator('#stockThreshold').fill('700');await expect(page.locator('#invRows')).toContainText('Bajo umbral configurado');
  await page.locator('#invSearch').fill('no-existe');await expect(page.locator('#invEmpty')).toBeVisible();
});
test('periodos normalizados, simulación y exportaciones sin PII',async({page})=>{
  await offline(page);await page.goto('/#/analitica');await expect(page.locator('#view-analitica [data-period-output]')).toContainText('kWh');
  await page.locator('#simType').fill('Bagazo hipotético');await page.locator('#simSource').fill('Hipótesis propia');await page.locator('#simMass').fill('1000');await page.locator('#simYield').fill('4');await page.locator('#simEfficiency').fill('25');await page.locator('#simPrice').fill('500');await page.locator('#simForm button').click();
  await expect(page.locator('#simResults')).toContainText('1.000,00');await expect(page.locator('#simResults')).toContainText('500.000,00');
  await page.locator('#reportType').selectOption('simulation');const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportCSV').click()]);expect(download.suggestedFilename()).toBe('BioVolt-simulation.csv');
  await page.evaluate(()=>{window.print=()=>{};});await page.locator('#exportPDF').click();await expect(page.locator('#printReport')).toContainText('Hipótesis propia');
  await page.pdf({path:'test-results/BioVolt-simulacion.pdf',format:'A4',landscape:true});
});
test('TiDB vacío no se mezcla con muestra; un MWh se compara como 1000 kWh',async({page})=>{
  await page.route('**/api/**',r=>{
    if(r.request().url().includes('view=analytics'))return r.fulfill({json:{source:'tidb',range:{from:'2026-11-01',to:'2026-11-15',previousFrom:'2026-10-17',previousTo:'2026-10-31'},current:{records:0,kwh:0},previous:{kwh:0},daily:[],plants:[]}});
    if(new URL(r.request().url()).pathname==='/api/data')return r.fulfill({json:{source:'tidb',stats:{plants:0,production:2,energy:1001,co2:0,waste:0,clients:null,providers:null,invoices:null},plants:[],biomass:[],inventory:[],productionRows:[{id_produccion:'1',id_planta:'1',fecha:'2026-11-01',cantidad:1,unidad:'MWh'},{id_produccion:'2',id_planta:'1',fecha:'2026-11-02',cantidad:1,unidad:'kWh'}]}});
    return r.fulfill({status:403,json:{error:'Sin acceso'}});
  });
  await page.goto('/');await expect(page.locator('#dataStatus')).toContainText('TiDB');await expect(page.locator('#productionChart')).toHaveAttribute('aria-label',/1.000 kWh/);
  await page.goto('/#/inventario');await expect(page.locator('#invRows tr')).toHaveCount(0);await expect(page.locator('#invEmpty')).toBeVisible();
  await page.goto('/#/plantas');await expect(page.locator('#plantCards article')).toHaveCount(0);
});
test('scroll ejecuta animaciones y la preferencia de movimiento reducido las detiene',async({page})=>{
  await offline(page);await page.goto('/');await page.locator('#moduleGrid').scrollIntoViewIfNeeded();
  await expect(page.locator('#moduleGrid .card').first()).toHaveClass(/rv-in/);
  await expect.poll(()=>page.locator('#moduleGrid .card').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('rvIn');
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>page.locator('#moduleGrid .card').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await expect(page.locator('#moduleGrid .card').first()).toHaveCSS('opacity','1');
});
for(const width of [360,390,768,1024,1440])test('responsive '+width+'px sin desbordamiento',async({page})=>{
  await page.setViewportSize({width,height:900});await offline(page);await page.goto('/');
  for(const route of ['inicio','inventario','analitica','ayuda','asistente']){
    await page.goto('/#/'+route);await page.waitForTimeout(100);
    const sizes=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));expect(sizes.body).toBeLessThanOrEqual(sizes.viewport+1);
  }
  if(width===1440){await page.goto('/');await page.waitForTimeout(3800);await page.screenshot({path:'test-results/BioVolt-inicio-desktop.png',fullPage:true});}
  if(width===390){await page.goto('/#/analitica');await expect(page.locator('#view-analitica')).toHaveCSS('opacity','1');await page.screenshot({path:'test-results/BioVolt-analitica-mobile.png',fullPage:true});}
});
test('movimiento reducido y ausencia de observador conservan el contenido visible',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>{delete window.IntersectionObserver;});await offline(page);await page.goto('/');await expect(page.locator('.hero-stage')).toHaveCSS('opacity','1');await expect.poll(()=>page.locator('.liquid-bg i').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.locator('#moduleGrid').scrollIntoViewIfNeeded();await expect(page.locator('#moduleGrid .card').first()).toHaveCSS('opacity','1');
});
test('modo oscuro conserva identidad y se mantiene al recargar',async({page})=>{
  await offline(page);await page.goto('/');
  await page.evaluate(()=>{localStorage.setItem('bvTheme','dark');});await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.waitForTimeout(3800);await page.screenshot({path:'test-results/BioVolt-inicio-dark.png',fullPage:true});
  await page.locator('#themeBtn').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
