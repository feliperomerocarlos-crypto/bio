/* BioVolt: una sola secuencia reversible. Sin vídeo, API ni acceso a datos. */
'use strict';
(function(){
 const root=document.getElementById('biovoltCinema'),view=document.getElementById('view-inicio');if(!root||!view)return;
 const media=window.matchMedia('(prefers-reduced-motion: reduce)'),script=document.currentScript;
 const engineURL=new URL('cinematic-engine.js',script?.src||new URL('assets/cinematic.js',document.baseURI)).href;
 let enginePromise,controller=null,sequence=0,intersecting=true,disposed=false,failed=false;
 const status={mode:'fallback',progress:0,frames:0,particles:0,pixelRatio:0,quality:'static',phase:3,active:false,resources:0};
 const beats=[...root.querySelectorAll('.bv-cinema__beat')],guide=root.querySelector('.bv-cinema__guide'),number=root.querySelector('.bv-cinema__number');
 function staticMode(reason='fallback'){
  root.dataset.state='static';root.style.setProperty('--scene-progress','1');status.mode=reason;status.active=false;status.resources=0;
  beats.forEach((b,i)=>{b.style.opacity=i===3?'1':'0';b.style.transform='none';});guide.hidden=true;
 }
 function engine(){
  if(window.BioVoltSceneEngine)return Promise.resolve(window.BioVoltSceneEngine);
  return enginePromise??=new Promise((resolve,reject)=>{
   const tag=document.createElement('script');tag.src=engineURL;tag.async=true;let timer=setTimeout(()=>reject(new Error('engine timeout')),12000);
   tag.onload=()=>{clearTimeout(timer);window.BioVoltSceneEngine?resolve(window.BioVoltSceneEngine):reject(new Error('engine unavailable'));};
   tag.onerror=()=>{clearTimeout(timer);reject(new Error('engine unavailable'));};document.head.append(tag);
  });
 }
 function stop(){sequence++;if(controller){controller.destroy();controller=null;}status.active=false;}
 async function sync(){
  document.querySelectorAll('svg').forEach(svg=>{if(media.matches)svg.pauseAnimations?.();else svg.unpauseAnimations?.();});
  stop();document.body.classList.toggle('bv-cinema-in-frame',!view.hidden&&intersecting);if(disposed||view.hidden){staticMode('inactive');return;}
  if(media.matches){staticMode('reduced');return;}if(failed){staticMode('fallback');return;}
  const ticket=sequence;staticMode('loading');
  try{const api=await engine();if(ticket!==sequence||view.hidden||media.matches||disposed)return;controller=createScene(api);}
  catch(error){if(ticket===sequence){failed=true;staticMode();console.warn('[BioVolt escena] Alternativa visual disponible.');}}
 }
 function createScene({THREE,gsap,ScrollTrigger}){
  gsap.registerPlugin(ScrollTrigger);
  const canvas=root.querySelector('canvas'),abort=new AbortController(),signal=abort.signal;
  const small=innerWidth<=640,slow=(navigator.hardwareConcurrency||4)<=4;
  const count=small?(slow?1800:3000):(slow?5500:10500);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});}catch(error){throw error;}
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,80),geometry=new THREE.BufferGeometry();
  let seed=8463;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const cloud=new Float32Array(count*3),galaxy=new Float32Array(count*3),leaf=new Float32Array(count*3),flow=new Float32Array(count*3),sizes=new Float32Array(count),seeds=new Float32Array(count);
  for(let i=0;i<count;i++){
   const k=i*3,r=(i%6===0?Math.pow(rand(),2.8)*1.1:Math.pow(rand(),.65)*5.25),arm=i%5,angle=arm*Math.PI*2/5+r*.9+(rand()-.5)*.65;
   cloud.set([(rand()-.5)*24,(rand()-.5)*16,(rand()-.5)*22],k);
   galaxy.set([Math.cos(angle)*r,Math.sin(angle)*r*.54,(rand()-.5)*.45+Math.sin(angle)*r*.2],k);
   const along=rand(),width=Math.sin(along*Math.PI)*2.3,side=(rand()-.5)*2;
   // Hoja: nervio curvado y lámina de ancho variable, con espesor real.
   leaf.set([(along-.5)*4.4+side*width*.7,(along-.5)*5.8-side*width*.5,Math.sin(along*Math.PI)*.65+(rand()-.5)*.22],k);
   const stream=i%7,t=rand();flow.set([(t-.5)*18,Math.sin(t*5+stream*.35)*1.15+(stream-3)*.4,Math.cos(t*6+stream*.6)*1.5],k);
   sizes[i]=.22+Math.pow(rand(),5)*1.65;seeds[i]=rand();
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(cloud,3));
  for(const [name,data] of [['aGalaxy',galaxy],['aLeaf',leaf],['aFlow',flow]])geometry.setAttribute(name,new THREE.BufferAttribute(data,3));
  geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
  const uniforms={uProgress:{value:0},uTime:{value:0},uRatio:{value:1},uPortrait:{value:0}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms,
   vertexShader:`attribute vec3 aGalaxy;attribute vec3 aLeaf;attribute vec3 aFlow;attribute float aSize;attribute float aSeed;
    uniform float uProgress,uTime,uRatio,uPortrait;varying float vSeed,vDepth;
    void main(){float p=uProgress;vec3 pos=mix(position,aGalaxy,smoothstep(0.03,0.34,p));
     pos=mix(pos,aLeaf,smoothstep(0.46,0.71,p));pos=mix(pos,aFlow,smoothstep(0.78,1.0,p));
     float a=uTime*0.055+p*0.55;float spiral=1.0-smoothstep(.46,.72,p);float cs=cos(a*spiral),sn=sin(a*spiral);
     pos.xy=mat2(cs,-sn,sn,cs)*pos.xy;
     pos.x+=sin(uTime*.24+aSeed*30.)*.065;pos.z+=sin(uTime*.18+aSeed*20.)*.12;
     pos.x+=mix(2.7,0.,uPortrait);pos.y-=uPortrait*2.2;
     vec4 mv=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mv;
     gl_PointSize=clamp(aSize*uRatio*(105.0/max(1.,-mv.z)),1.,32.);vSeed=aSeed;vDepth=1.0-smoothstep(10.,39.,-mv.z);}`,
   fragmentShader:`varying float vSeed,vDepth;uniform float uTime;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
    float glow=exp(-r*r*5.5)*.32+exp(-r*r*26.)*.7;float twinkle=.83+.17*sin(uTime*.8+vSeed*45.);
    vec3 color=mix(vec3(.10,.68,.34),vec3(.69,.96,.42),vSeed);color=mix(color,vec3(.87,1.,.86),pow(vSeed,14.));
    gl_FragColor=vec4(color,glow*vDepth*twinkle);}`});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
  let frame=0,last=0,time=0,alive=true,visible=true,tween,state={progress:0},pixelRatio=Math.min(devicePixelRatio||1,small?1.25:1.65),samples=0,totalTime=0,adapted=false;
  const pointer={x:0,y:0},position={x:0,y:0};
  root.dataset.state='active';guide.hidden=false;
  Object.assign(status,{mode:'webgl',active:false,particles:count,quality:small?'mobile':'desktop',resources:3});
  function resize(){const w=root.clientWidth,h=root.querySelector('.bv-cinema__stage').clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(pixelRatio,w<650?1.25:1.65));if(w<650){const capped=Math.min(count,geometry.drawRange.count,3000);geometry.setDrawRange(0,capped);status.particles=capped;}renderer.setSize(w,h,false);uniforms.uRatio.value=renderer.getPixelRatio();uniforms.uPortrait.value=w<650?1:0;status.pixelRatio=renderer.getPixelRatio();}
  resize();
  function render(now){
   frame=0;if(!alive||!visible||!intersecting||document.hidden)return;
   frame=requestAnimationFrame(render);const delta=now-last;if(delta<(small?30:15))return;last=now;time+=Math.min(delta||16,80)/1000;
   if(delta<250&&samples<100){samples++;totalTime+=delta;}
   if(!adapted&&samples>=100){adapted=true;if(totalTime/samples>38){pixelRatio=Math.min(pixelRatio,.85);geometry.setDrawRange(0,Math.floor(count*.65));status.particles=Math.floor(count*.65);status.quality='adaptive';resize();}}
   const p=state.progress;status.progress=p;uniforms.uProgress.value=p;uniforms.uTime.value=time;
   position.x+=(pointer.x-position.x)*.035;position.y+=(pointer.y-position.y)*.035;
   camera.position.set(position.x*.45,position.y*.28,20-8*Math.sin(p*Math.PI*.8));camera.lookAt(0,0,0);
   root.style.setProperty('--scene-progress',p.toFixed(4));
   const phase=p<.25?0:p<.5?1:p<.76?2:3;status.phase=phase;number.textContent=String(phase+1).padStart(2,'0')+' / 04';
   beats.forEach((b,i)=>{const center=[.08,.37,.63,.92][i],span=[.14,.115,.115,.15][i];let opacity=Math.max(0,Math.min(1,(span-Math.abs(p-center))/.065));if(i===0&&p<.08)opacity=1;if(i===3&&p>.92)opacity=1;b.style.opacity=opacity.toFixed(3);b.style.transform='translateY('+((1-opacity)*18).toFixed(2)+'px)';});
   try{renderer.render(scene,camera);status.programs=renderer.info.programs.length;status.frames++;status.active=true;}catch(error){fault();}
  }
  function resume(){if(alive&&!frame&&!document.hidden&&visible&&intersecting){last=performance.now();frame=requestAnimationFrame(render);}}
  function pause(){cancelAnimationFrame(frame);frame=0;status.active=false;}
  function fault(){if(!alive)return;destroy();failed=true;staticMode('fallback');}
  function destroy(){if(!alive)return;alive=false;pause();abort.abort();tween?.scrollTrigger?.kill();tween?.kill();scene.remove(points);geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();canvas.replaceWith(canvas.cloneNode(false));status.resources=0;}
  tween=gsap.to(state,{progress:1,ease:'none',scrollTrigger:{id:'biovolt-cinema',trigger:root,start:'top top',end:'bottom bottom',scrub:.65,invalidateOnRefresh:true}});
  window.addEventListener('resize',()=>{resize();ScrollTrigger.refresh();},{signal});
  root.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;pointer.x=event.clientX/innerWidth-.5;pointer.y=.5-event.clientY/innerHeight;},{passive:true,signal});
  root.addEventListener('pointerleave',()=>{pointer.x=pointer.y=0;},{signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fault();},{signal});
  document.addEventListener('visibilitychange',()=>document.hidden?pause():resume(),{signal});
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?resume():pause();}):null;
  observer?.observe(root);signal.addEventListener('abort',()=>observer?.disconnect(),{once:true});
  requestAnimationFrame(()=>{if(alive){ScrollTrigger.refresh();resume();}});
  return {destroy,pause,resume};
 }
 root.querySelector('[data-cinema-skip]').addEventListener('click',()=>document.getElementById('heroTitle').closest('section').scrollIntoView({behavior:media.matches?'auto':'smooth',block:'start'}));
 const routeObserver=new MutationObserver(sync);routeObserver.observe(view,{attributes:true,attributeFilter:['hidden']});
 media.addEventListener('change',sync);
 const viewportObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;document.body.classList.toggle('bv-cinema-in-frame',intersecting&&!view.hidden);if(intersecting)controller?.resume();else controller?.pause();}):null;viewportObserver?.observe(root);
 window.addEventListener('pagehide',e=>{if(e.persisted)controller?.pause();else{disposed=true;stop();routeObserver.disconnect();viewportObserver?.disconnect();media.removeEventListener('change',sync);}});
 window.addEventListener('pageshow',e=>{if(e.persisted)controller?.resume();});
 window.BioVoltCinema=Object.freeze({inspect:()=>({...status}),destroy:()=>{disposed=true;stop();staticMode();}});
 sync();
})();
