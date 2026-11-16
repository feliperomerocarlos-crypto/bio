import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
for(const path of ['index.html','revision/index.html']){
 const html=readFileSync(path,'utf8');
 for(const [i,match] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries())new vm.Script(match[1],{filename:path+'-inline-'+i+'.js'});
}
for (const dir of ['assets','lib','netlify/functions']) for (const file of readdirSync(dir)) if (/\.(mjs|js)$/.test(file)) {
  const result=spawnSync(process.execPath,['--check',dir+'/'+file],{stdio:'inherit'}); if(result.status) process.exit(result.status);
}
console.log('Sintaxis: scripts inline, assets, lib y funciones aprobados.');

const routes=new Set();
for (const file of readdirSync('netlify/functions').filter(f=>f.endsWith('.mjs'))) {
  const fn=await import('../netlify/functions/'+file);
  if(typeof fn.default !== 'function' || !fn.config?.path?.startsWith('/api/') || routes.has(fn.config.path)) throw new Error('Contrato o ruta inválida: '+file);
  routes.add(fn.config.path);
}
console.log('Importaciones reales y rutas Netlify v2: '+[...routes].join(', '));
