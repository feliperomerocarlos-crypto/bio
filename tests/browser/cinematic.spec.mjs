import {test,expect} from '@playwright/test';
const inspect=page=>page.evaluate(()=>window.BioVoltCinema?.inspect());
async function ready(page){await expect.poll(async()=>(await inspect(page))?.mode,{timeout:15000}).toBe('webgl');await expect.poll(async()=>(await inspect(page))?.frames||0).toBeGreaterThan(1);}
async function scroll(page,p){await page.evaluate(p=>{const el=document.getElementById('biovoltCinema');window.scrollTo({top:el.offsetTop+(el.offsetHeight-innerHeight)*p,behavior:'instant'});},p);await expect.poll(async()=>Math.abs((await inspect(page)).progress-p),{timeout:10000}).toBeLessThan(.04);}
test.beforeEach(async({page})=>{await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Offline'}}));});
test('WebGL real compila, dibuja y recorre espiral/hoja/flujo en ambos sentidos',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
 expect((await inspect(page)).programs).toBeGreaterThan(0);const shots=[];
 for(const p of [.37,.64,.93,.37]){await scroll(page,p);shots.push(await page.locator('.bv-cinema__canvas').screenshot());await page.screenshot({path:'test-results/cinema-'+p+'.png'});}
 expect(shots[0].equals(shots[1])).toBe(false);expect(shots[1].equals(shots[2])).toBe(false);expect(errors).toEqual([]);
});
test('la escena es diferida, se libera al navegar y se reconstruye al volver',async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().endsWith('cinematic-engine.js'))requests.push(r.url());});await page.goto('/#/ayuda');await expect.poll(async()=>(await inspect(page))?.mode).toBe('inactive');expect(requests).toHaveLength(0);
 for(let i=0;i<3;i++){await page.goto('/#/inicio');await ready(page);await page.goto('/#/ayuda');await expect.poll(async()=>(await inspect(page)).resources).toBe(0);expect((await inspect(page)).active).toBe(false);await expect(page.locator('#ticketForm')).toBeVisible();}
 expect(requests).toHaveLength(1);await page.goto('/#/inicio');await ready(page);expect(await page.locator('.bv-cinema__canvas').count()).toBe(1);
});
test('móvil limita GPU, mantiene lectura y responde al desplazamiento',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await ready(page);expect((await inspect(page)).particles).toBeLessThanOrEqual(3000);expect((await inspect(page)).pixelRatio).toBeLessThanOrEqual(1.25);await scroll(page,.65);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/cinema-mobile.png'});await page.locator('[data-cinema-skip]').click();await expect(page.locator('#heroTitle')).toBeInViewport({timeout:10000});
});
test('movimiento reducido no carga WebGL y permite entrar directamente a la plataforma',async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().endsWith('cinematic-engine.js'))requests.push(r.url());});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect.poll(async()=>(await inspect(page))?.mode).toBe('reduced');expect(requests).toHaveLength(0);await expect(page.locator('#cinematicTitle')).toBeVisible();await expect(page.locator('.bv-cinema__guide')).toBeHidden();await page.locator('[data-cinema-skip]').click();await expect(page.locator('#heroTitle')).toBeInViewport();
});
test('cambiar la preferencia en ejecución detiene y reconstruye la escena',async({page})=>{
 await page.goto('/');await ready(page);await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(async()=>(await inspect(page)).mode).toBe('reduced');expect((await inspect(page)).resources).toBe(0);const frames=(await inspect(page)).frames;await page.waitForTimeout(150);expect((await inspect(page)).frames).toBe(frames);await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);
});
test('sin motor funciona una alternativa animada ligera sin bloquear navegación',async({page})=>{
 await page.route('**/cinematic-engine.js',r=>r.abort());await page.goto('/');await expect.poll(async()=>(await inspect(page))?.mode).toBe('canvas2d');await expect.poll(async()=>(await inspect(page)).frames).toBeGreaterThan(1);await page.locator('[data-cinema-skip]').click();await expect(page.locator('#heroTitle')).toBeInViewport({timeout:10000});await page.goto('/#/asistente');await expect(page.locator('#chatInput')).toBeVisible();
});
test('la pérdida de contexto WebGL pasa a animación ligera',async({page})=>{
 await page.goto('/');await ready(page);await page.evaluate(()=>document.querySelector('.bv-cinema__canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await expect.poll(async()=>(await inspect(page)).mode).toBe('canvas2d');await expect.poll(async()=>(await inspect(page)).active).toBe(true);
});
test('la copia autocontenida ejecuta WebGL sin pedir dependencias ni API',async({page})=>{
 const outgoing=[];page.on('request',r=>{if(/^https?:/.test(r.url()))outgoing.push(r.url());});await page.goto('/__test/revision');await ready(page);await scroll(page,.91);await expect(page.locator('#cinematicTitle')).toBeVisible();expect(outgoing).toHaveLength(1);expect(outgoing[0]).toContain('/__test/revision');
});

test('sin WebGL dibuja partículas en Canvas 2D y mantiene scroll',async({page})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});await page.goto('/');await expect.poll(async()=>(await inspect(page))?.mode).toBe('canvas2d');const first=(await inspect(page)).frames;await expect.poll(async()=>(await inspect(page)).frames).toBeGreaterThan(first);await scroll(page,.65);await page.locator('[data-cinema-skip]').click();await expect(page.locator('#heroTitle')).toBeInViewport({timeout:10000});
});
test('fuera de pantalla se pausa el render y al volver se reanuda',async({page})=>{
 await page.goto('/');await ready(page);await page.locator('#faqTitle').scrollIntoViewIfNeeded();await expect.poll(async()=>(await inspect(page)).active).toBe(false);const frame=(await inspect(page)).frames;await page.waitForTimeout(160);expect((await inspect(page)).frames).toBe(frame);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await expect.poll(async()=>(await inspect(page)).frames).toBeGreaterThan(frame);
});

test('los títulos se revelan sin superponer frases durante el scroll',async({page})=>{
 await page.goto('/');await ready(page);for(const progress of [.22,.25,.37,.49,.5,.51,.63,.75,.77,.92]){await scroll(page,progress);const count=await page.locator('.bv-cinema__beat').evaluateAll(nodes=>nodes.filter(n=>Number(getComputedStyle(n).opacity)>.03).length);expect(count).toBeLessThanOrEqual(1);}
});


test('el usuario activa movimiento aunque el sistema lo reduzca y conserva la elección',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/__test/revision');await expect.poll(async()=>(await inspect(page))?.mode).toBe('reduced');await expect(page.locator('[data-cinema-status]')).toContainText('Tu dispositivo');await page.locator('[data-cinema-motion]').selectOption('full');await ready(page);await expect(page.locator('.liquid-bg i').first()).not.toHaveCSS('animation-name','none');await page.reload();await ready(page);await expect(page.locator('[data-cinema-motion]')).toHaveValue('full');expect((await inspect(page)).systemReduced).toBe(true);await scroll(page,.37);
 await page.locator('[data-cinema-motion]').selectOption('off');await expect.poll(async()=>(await inspect(page)).mode).toBe('paused');const frames=(await inspect(page)).frames;await page.waitForTimeout(150);expect((await inspect(page)).frames).toBe(frames);await expect(page.locator('#cinematicTitle')).toBeVisible();
});
test('la copia de revisión anima sin GPU ni motor y permite pausa explícita',async({page})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});await page.goto('/__test/revision');await expect.poll(async()=>(await inspect(page))?.mode).toBe('canvas2d');await expect(page.locator('[data-cinema-status]')).toContainText('Vista ligera animada');await scroll(page,.64);await page.screenshot({path:'test-results/cinema-light.png'});await page.locator('[data-cinema-motion]').selectOption('off');await expect.poll(async()=>(await inspect(page)).mode).toBe('paused');await page.goto('/#/ayuda');await expect(page.locator('#ticketForm')).toBeVisible();
});
