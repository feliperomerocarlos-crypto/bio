/* La nube continua solo necesita Three.js. Versión fija de 2023, sin imágenes externas. */
(function(){
 const url='https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js';
 window.BioVoltEngineReady=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.crossOrigin='anonymous';const timer=setTimeout(()=>reject(Error('Tiempo de carga del motor agotado')),4500);s.onload=()=>{clearTimeout(timer);if(!window.THREE){reject(Error('Motor no disponible'));return;}const api={THREE:window.THREE};window.BioVoltSceneEngine=api;resolve(api);};s.onerror=()=>{clearTimeout(timer);reject(Error('Motor no disponible'));};document.head.append(s);});
 // El fallo se atiende con partículas Canvas 2D; no afecta a las API ni al contenido.
 window.BioVoltEngineReady.catch(()=>{});
})();
