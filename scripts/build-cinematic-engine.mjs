// Dependencias fijadas; el navegador no consulta CDN ni ejecuta código de terceros remoto.
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:['src/cinematic-engine.mjs'],bundle:true,format:'iife',globalName:'BioVoltSceneEngine',platform:'browser',target:'es2020',minify:true,legalComments:'inline',outfile:'assets/cinematic-engine.js'});
const bundle=await readFile('assets/cinematic-engine.js','utf8');await writeFile('assets/cinematic-engine.js',bundle.replace(/[\t ]+$/gm,''));
const three=await readFile('node_modules/three/LICENSE','utf8');
const gsap=JSON.parse(await readFile('node_modules/gsap/package.json','utf8'));
await writeFile('assets/cinematic-licenses.txt','Three.js 0.180.0\n'+three+'\nGSAP 3.13.0 / ScrollTrigger\n'+gsap.license+'\nhttps://gsap.com/standard-license/\n');
console.log('Motor local Three.js + GSAP/ScrollTrigger generado.');
