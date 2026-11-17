import {readFile,writeFile} from 'node:fs/promises';
// Fuente editable conservada; el archivo público no depende de assets locales.
let html=await readFile('src/page.html','utf8');
for(const match of [...html.matchAll(/<link rel="stylesheet" href="(assets\/[\w.-]+\.css)">/g)]){
 const css=await readFile(match[1],'utf8');html=html.replace(match[0],()=>'<style>\n'+css+'\n</style>');
}
for(const match of [...html.matchAll(/<script src="(assets\/[\w.-]+\.js)"><\/script>/g)]){
 const code=await readFile(match[1],'utf8'),marker=match[1]==='assets/scene-cdn.js'?' data-bv-cdn':'';
 html=html.replace(match[0],()=>'<script'+marker+'>\n'+code+'\n</script>');
}
if(/<(?:script|link)[^>]*(?:src|href)="assets\//.test(html))throw Error('Quedó una dependencia local en el HTML público.');
await writeFile('index.html',html.replace(/[\t ]+$/gm,''));
console.log('index.html autocontenido listo; solo librerías opcionales desde cdnjs con versión fija.');
