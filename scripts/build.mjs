import { mkdir, copyFile, cp, rm, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
// Defensa adicional si un build hook omite el comando ignore de Netlify.
if (process.env.NETLIFY === 'true' && (process.env.BRANCH !== 'main' || process.env.CONTEXT !== 'production')) {
  throw new Error('Rama de revisión: despliegue deshabilitado hasta autorización del propietario.');
}
for (const name of await readdir('netlify/functions')) {
  if (!name.endsWith('.mjs')) continue;
  const result=spawnSync(process.execPath,['--check','netlify/functions/'+name],{stdio:'inherit'});
  if(result.status) process.exit(result.status);
}
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
await copyFile('index.html','dist/index.html'); await cp('assets','dist/assets',{recursive:true});
console.log('Build estático listo: dist/ (sin backend, SQL, tests ni documentación públicos).');
