import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('index.html','utf8');
for(const name of ['enhancements','helpdesk','cinematic']){
 const css=await readFile(`assets/${name}.css`,'utf8');
 html=html.replace(`<link rel="stylesheet" href="assets/${name}.css">`,()=>'<style>\n'+css+'\n</style>');
}
html=html.replace('<script src="assets/cinematic.js"></script>','<script src="assets/cinematic-engine.js"></script>\n<script src="assets/cinematic.js"></script>');
for(const name of ['core','enhancements','helpdesk','cinematic-engine','cinematic']){
 const code=await readFile(`assets/${name}.js`,'utf8');
 // Una función conserva literalmente $&, $` y $' dentro de código de proveedores.
 html=html.replace(`<script src="assets/${name}.js"></script>`,()=>'<script>\n'+code+'\n</script>');
}
html=html.replace(/\bfetch\s*\(/g,'bioPreviewOffline(');
const demo=await readFile('revision/demo-api.js','utf8');html=html.replace('<script>',()=>'<script>\n'+demo+'\n</script>\n<script>');
html=html.replaceAll('Respuesta de Gemini','Respuesta IA simulada').replaceAll('Agente IA · Gemini','Agente IA · Simulación local');
html=html.replace("t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';","t = 'dark';");
await writeFile('revision/index.html',html.replace(/[\t ]+$/gm,''));
console.log('revision/index.html listo: escena autocontenida; datos y respuestas IA simulados, sin llamadas de red.');
