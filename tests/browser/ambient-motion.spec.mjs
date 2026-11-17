import {test,expect} from '@playwright/test';
import {cdn} from './cdn-fixture.mjs';
// Se mide la orientación de los píxeles dibujados, no solo el contador de frames:
// el render anterior avanzaba el contador mientras la figura parecía inmóvil.
function captureActualParticles(){
 let pending;
 function capture(ctx,gpu){if(!pending||!ctx.canvas.classList.contains('bv-cinema__canvas'))return;const w=ctx.canvas.width,h=ctx.canvas.height;let data;if(gpu){data=new Uint8Array(w*h*4);ctx.readPixels(0,0,w,h,ctx.RGBA,ctx.UNSIGNED_BYTE,data);}else data=ctx.getImageData(0,0,w,h).data;
  let mass=0,x=0,y=0,xx=0,yy=0,xy=0;for(let py=0;py<h;py+=2)for(let px=0;px<w;px+=2){const i=(py*w+px)*4,weight=data[i+3]*Math.max(0,data[i+1]-data[i]*.5);mass+=weight;x+=weight*px;y+=weight*py;xx+=weight*px*px;yy+=weight*py*py;xy+=weight*px*py;}
  const cx=x/mass,cy=y/mass,resolve=pending;pending=null;resolve({mass,angle:.5*Math.atan2(2*(xy/mass-cx*cy),xx/mass-cx*cx-yy/mass+cy*cy)});
 }
 for(const Type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!Type)continue;const draw=Type.prototype.drawArrays;Type.prototype.drawArrays=function(...args){const result=draw.apply(this,args);capture(this,true);return result;};}
 const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){capture(this,false);return clear.apply(this,args);};
 window.takeParticleSnapshot=()=>new Promise(resolve=>pending=resolve);
}
for(const mode of ['webgl','canvas2d'])test('la figura se mueve de forma visible sin scroll bajo una tabla: '+mode,async({page})=>{
 await cdn(page);await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Sin producción'}}));await page.setViewportSize({width:1280,height:800});await page.addInitScript(captureActualParticles);
 if(mode==='canvas2d')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 await page.goto('/__test/revision#inventario');await page.locator('#invRows').scrollIntoViewIfNeeded();await expect.poll(()=>page.evaluate(()=>BioVoltCinema.inspect().mode)).toBe(mode);await expect.poll(()=>page.evaluate(()=>Math.abs(BioVoltCinema.inspect().chapter-2))).toBeLessThan(.005);
 const initial=await page.evaluate(()=>({scroll:scrollY,chapter:BioVoltCinema.inspect().chapter,id:BioVoltCinema.inspect().geometryId})),first=await page.evaluate(()=>takeParticleSnapshot());await page.waitForTimeout(1800);const second=await page.evaluate(()=>takeParticleSnapshot());
 const angle=Math.abs(Math.atan2(Math.sin(2*(second.angle-first.angle)),Math.cos(2*(second.angle-first.angle))))/2;expect(first.mass).toBeGreaterThan(10000);expect(second.mass).toBeGreaterThan(10000);expect(angle).toBeGreaterThan(.045);
 const last=await page.evaluate(()=>({scroll:scrollY,chapter:BioVoltCinema.inspect().chapter,id:BioVoltCinema.inspect().geometryId}));expect(last.scroll).toBe(initial.scroll);expect(last.chapter).toBeCloseTo(initial.chapter,2);expect(last.id).toBe(initial.id);
});
test('las partículas continúan hasta el pie, sin depender de entrar en una cabecera',async({page})=>{
 await cdn(page);await page.route('**/api/**',r=>r.fulfill({status:503,json:{error:'Sin producción'}}));await page.goto('/__test/revision');await page.locator('footer').scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await expect.poll(()=>page.evaluate(()=>BioVoltCinema.inspect().active)).toBe(true);const first=await page.evaluate(()=>BioVoltCinema.inspect().frames);await expect.poll(()=>page.evaluate(()=>BioVoltCinema.inspect().frames)).toBeGreaterThan(first+3);await expect(page.locator('.bv-particle-story')).toHaveCSS('opacity','1');
});
