/* Una misma nube de partículas recorre los ocho capítulos. Sin API, datos privados ni mallas sólidas. */
'use strict';
(function(){
 const root=document.getElementById('biovoltCinema'),main=document.querySelector('main');if(!root||!main)return;
 const chapters=[...main.querySelectorAll(':scope>.view')],names=chapters.map(n=>n.dataset.view),clamp=n=>Math.max(0,Math.min(1,n));
 const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
 // El scroll elige la forma; el tiempo mantiene su movimiento incluso durante la lectura.
 function ambient(t,p){const amount=smooth(.46,.8,p.intro);return {roll:t*.075*amount,sway:Math.sin(t*.35)*.28*amount,scale:1+Math.sin(t*.65)*.035*amount,x:Math.sin(t*.43)*.22*amount,y:Math.cos(t*.36)*.16*amount};}
 // El contenido real pasa a paneles de lectura; la cabecera dispone de recorrido como la apertura.
 const bridges=[];
 for(const chapter of chapters){chapter.classList.add('bv-story-chapter');const container=chapter.querySelector(':scope>.container'),head=chapter.querySelector('.view-head');
  if(container&&head){const bridge=document.createElement('div');bridge.className='bv-story-bridge';head.replaceWith(bridge);bridge.append(head);head.classList.add('bv-chapter','bv-story-head');head.querySelector('.gesture')?.classList.add('bv-portal');const workspace=document.createElement('div');workspace.className='bv-story-workspace';
   const content=[...container.children].filter(n=>n!==bridge&&!n.matches('.source-note,.view-deco'));if(content.length){container.append(workspace);content.forEach(n=>workspace.append(n));}bridges.push({name:chapter.dataset.view,bridge,head,workspace});
  }else{const content=[...chapter.children].filter(n=>!n.matches('.bv-cinema,.hero'));if(content.length){const workspace=document.createElement('div');workspace.className='bv-story-workspace bv-story-start container';chapter.append(workspace);content.forEach(n=>workspace.append(n));}}
 }
 const canvas=root.querySelector('canvas'),world=document.createElement('div');world.className='bv-particle-story bv-world';world.setAttribute('aria-hidden','true');world.inert=true;world.append(canvas);document.body.append(world);
 const control=root.querySelector('[data-cinema-motion]'),hint=root.querySelector('[data-cinema-status]'),beats=[...root.querySelectorAll('.bv-cinema__beat')],guide=root.querySelector('.bv-cinema__guide'),number=root.querySelector('.bv-cinema__number');control.disabled=false;
 const abort=new AbortController(),signal=abort.signal,paused=()=>document.documentElement.dataset.bvMotion==='off';
 let controller=null,failed=false,disposed=false,loading=false,dirty=true,raf=0,last=0,time=0,lastCopy=-1,layout=null,position={intro:0,chapter:0},targets={intro:0,chapter:0,read:1},pointer={x:0,y:0};
 const status={mode:'loading',active:false,frames:0,progress:0,chapter:0,phase:0,route:'inicio',particles:0,pixelRatio:0,quality:'static',resources:0,programs:0,canvasCount:1,models:1,objectTypes:['Points'],suspended:'',plantNodes:0};
 function countPlants(){return typeof DB!=='undefined'&&Array.isArray(DB.plants)?Math.min(60,DB.plants.length):0;}
 function field(count){
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
  return {cloud,galaxy,leaf,flow,sizes,seeds};
 }
 function shapes(count){const original=field(count),extra={};for(const name of ['energy','biomass','plants','network','analytics','support','assistant'])extra[name]=new Float32Array(count*3);const nodes=countPlants();status.plantNodes=nodes;let seed=71723;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){const k=i*3,t=rand(),a=rand()*Math.PI*2,z=rand()*2-1,s=Math.sqrt(Math.max(0,1-z*z)),r=3.1+(rand()-.5)*.32;
   const e=t*Math.PI*6,er=2.4+.7*Math.sin(e*2);extra.energy.set([Math.cos(e)*er,Math.sin(e)*er*.85,Math.sin(e*1.5)*1.5+(rand()-.5)*.15],k);
   extra.biomass.set([original.leaf[k]*1.27,original.leaf[k+1]*1.17,original.leaf[k+2]*1.9+(rand()-.5)*.25],k);
   const node=i%Math.max(1,nodes),pa=nodes&&i%5!==0?node*Math.PI*2/nodes:a,jitter=nodes&&i%5!==0?.28:.06;extra.plants.set([Math.cos(pa)*3.7+(rand()-.5)*jitter,Math.sin(pa)*2.6+(rand()-.5)*jitter,Math.sin(pa)*.8+(rand()-.5)*jitter],k);
   const nr=i%7===0?rand():1;extra.network.set([Math.cos(a)*s*r*nr,z*r*nr,Math.sin(a)*s*r*nr],k);
   const az=t*Math.PI*28,ar=3.15*Math.sqrt(Math.max(0,1-z*z));extra.analytics.set([Math.cos(az)*ar,z*3.15,Math.sin(az)*ar],k);
   const side=i%2?1:-1,sa=a,rad=1.8+(rand()-.5)*.2;extra.support.set([side*1.3+Math.cos(sa)*s*rad,z*rad+side*.35,Math.sin(sa)*s*rad],k);
   const aa=i*2.399963,rr=2.9+.22*Math.sin(a*4);extra.assistant.set([Math.cos(aa)*s*rr,z*rr,Math.sin(aa)*s*rr],k);
  }return {...original,...extra};
 }
 function showAllCopy(){for(const b of bridges){b.head.style.setProperty('--story-copy-opacity','1');b.head.style.setProperty('--story-copy-shift','0px');b.head.inert=false;}}
 function measure(){dirty=false;const y=scrollY,h=innerHeight,r=root.getBoundingClientRect(),tops=bridges.map(b=>({top:b.bridge.getBoundingClientRect().top+y,height:b.bridge.offsetHeight,...b}));layout={introTop:r.top+y,introRange:Math.max(1,root.offsetHeight-h),tops};
  for(const b of tops){const enter=smooth(b.top-h*.8,b.top-h*.15,y),leave=1-smooth(b.top+b.height-h*.95,b.top+b.height-h*.5,y);b.head.style.setProperty('--story-copy-opacity',paused()?1:(enter*leave).toFixed(4));b.head.style.setProperty('--story-copy-shift',((1-enter*leave)*14).toFixed(2)+'px');b.head.inert=!paused()&&enter*leave<.03;}
 }
 function getTargets(){if(dirty||!layout)measure();const y=scrollY,h=innerHeight;let chapter=0,nearHeader=false;for(let i=0;i<layout.tops.length;i++){const b=layout.tops[i],start=b.top-h*.62,end=b.top+h*.52;if(y>=start)chapter=i+smooth(start,end,y);if(y+h>b.top&&y<b.top+b.height)nearHeader=true;}
  const intro=clamp((y-layout.introTop)/layout.introRange);status.route=window.BioVoltNavigation?.current()||'inicio';targets={intro,chapter,read:nearHeader||intro<1?1:.62};
  document.body.classList.toggle('bv-cinema-in-frame',intro<1);world.dataset.reading=String(targets.read<1);return targets;
 }
 function editing(){const e=document.activeElement,r=e?.getBoundingClientRect?.();return !!document.querySelector('dialog[open]')||(/^(INPUT|TEXTAREA|SELECT)$/.test(e?.tagName)&&r&&r.bottom>0&&r.top<innerHeight);}
 function paintCopy(p){if(Math.abs(p-lastCopy)<.0001)return;lastCopy=p;root.style.setProperty('--scene-progress',p.toFixed(4));const phase=p<.25?0:p<.5?1:p<.76?2:3;status.phase=phase;number.textContent=String(phase+1).padStart(2,'0')+' / 04';beats.forEach((b,i)=>{const center=[.08,.37,.63,.92][i],span=[.14,.115,.115,.15][i];let opacity=Math.max(0,Math.min(1,(span-Math.abs(p-center))/.065));if(i===0&&p<.08)opacity=1;if(i===3&&p>.92)opacity=1;b.style.opacity=opacity.toFixed(3);b.style.transform='translateY('+((1-opacity)*18).toFixed(2)+'px)';});}
 function stop(){cancelAnimationFrame(raf);raf=0;status.active=false;}
 function wake(){if(disposed)return;dirty=true;if(paused()){stop();status.mode='paused';return;}if(!raf&&!document.hidden){last=performance.now();raf=requestAnimationFrame(render);}}
 function render(now){raf=0;if(disposed||paused()||document.hidden){stop();return;}const target=getTargets();world.dataset.editing=String(editing());if(!controller){start();return;}
  raf=requestAnimationFrame(render);const delta=now-last;if(delta<(innerWidth<650?30:20))return;last=now;time+=Math.min(delta,250)/1000;const ease=Math.min(1,delta/140);position.intro+=(target.intro-position.intro)*ease;position.chapter+=(target.chapter-position.chapter)*ease;
  try{controller.draw(time,position,target.read,pointer,ambient(time,position));status.progress=position.intro;status.chapter=position.chapter;status.frames++;status.active=true;paintCopy(position.intro);world.dataset.visible='true';}catch(error){fallback();}
 }
 function canvasNow(){return world.querySelector('canvas');}
 function replaceCanvas(){const old=canvasNow(),next=old.cloneNode(false);old.replaceWith(next);return next;}
 async function start(){if(loading||disposed||controller||paused())return;loading=true;try{const api=failed?null:await window.BioVoltEngineReady;if(disposed||paused())return;controller=api?webgl(api.THREE):light();ready();}catch(error){if(!disposed){failed=true;fallback();}}finally{loading=false;}}
 function ready(){const initial=getTargets();if(!status.frames){position.intro=initial.intro;position.chapter=initial.chapter;}root.dataset.state='active';document.body.classList.add('bv-story-ready');document.body.dataset.bvWorld=status.mode;guide.hidden=false;hint.textContent=status.mode==='canvas2d'?'Vista ligera animada · Las partículas recorren toda la página.':'Las mismas partículas se transforman durante todo el recorrido.';wake();}
 function fallback(){stop();controller?.destroy();controller=null;failed=true;try{controller=light();ready();}catch(error){status.mode='static';status.resources=0;showAllCopy();document.body.classList.remove('bv-story-ready');root.dataset.state='static';hint.textContent='Puedes explorar todas las secciones de BioVolt.';paintCopy(1);}}
 function webgl(T){
  const canvas=canvasNow(),small=innerWidth<650,slow=(navigator.hardwareConcurrency||4)<=4,count=small?(slow?1800:3000):(slow?5500:10500),data=shapes(count);
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'}),scene=new T.Scene(),camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,80),geometry=new T.BufferGeometry();if(renderer.capabilities.maxAttributes<13){renderer.dispose();replaceCanvas();throw Error('GPU limitada: usar partículas ligeras');}geometry.setAttribute('position',new T.BufferAttribute(data.cloud,3));
  const fields=['galaxy','leaf','flow','energy','biomass','plants','network','analytics','support','assistant'];for(const f of fields)geometry.setAttribute('a'+f[0].toUpperCase()+f.slice(1),new T.BufferAttribute(data[f],3));geometry.setAttribute('aSize',new T.BufferAttribute(data.sizes,1));geometry.setAttribute('aSeed',new T.BufferAttribute(data.seeds,1));
  const u={uProgress:{value:0},uChapter:{value:0},uTime:{value:0},uRatio:{value:1},uPortrait:{value:0},uRead:{value:1},uMotion:{value:new T.Vector3(0,0,1)},uDrift:{value:new T.Vector2(0,0)}};
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:u,
   vertexShader:`attribute vec3 aGalaxy,aLeaf,aFlow,aEnergy,aBiomass,aPlants,aNetwork,aAnalytics,aSupport,aAssistant;attribute float aSize,aSeed;
    uniform float uProgress,uChapter,uTime,uRatio,uPortrait;uniform vec3 uMotion;uniform vec2 uDrift;varying float vSeed,vDepth;
    void main(){float p=uProgress;vec3 pos=mix(position,aGalaxy,smoothstep(.03,.34,p));pos=mix(pos,aLeaf,smoothstep(.46,.71,p));pos=mix(pos,aFlow,smoothstep(.78,1.,p));
    float a=uTime*.055+p*.55;float spiral=1.-smoothstep(.46,.72,p);float cs=cos(a*spiral),sn=sin(a*spiral);pos.xy=mat2(cs,-sn,sn,cs)*pos.xy;
    pos=mix(pos,aEnergy,smoothstep(0.,1.,uChapter));pos=mix(pos,aBiomass,smoothstep(1.,2.,uChapter));pos=mix(pos,aPlants,smoothstep(2.,3.,uChapter));pos=mix(pos,aNetwork,smoothstep(3.,4.,uChapter));pos=mix(pos,aAnalytics,smoothstep(4.,5.,uChapter));pos=mix(pos,aSupport,smoothstep(5.,6.,uChapter));pos=mix(pos,aAssistant,smoothstep(6.,7.,uChapter));
    float cr=cos(uMotion.x),sr=sin(uMotion.x),cy=cos(uMotion.y),sy=sin(uMotion.y);pos.xy=vec2(pos.x*cr-pos.y*sr,pos.x*sr+pos.y*cr);pos.xz=vec2(pos.x*cy+pos.z*sy,pos.z*cy-pos.x*sy);pos*=uMotion.z;pos.xy+=uDrift;
    pos.x+=sin(uTime*.24+aSeed*30.)*.065;pos.z+=sin(uTime*.18+aSeed*20.)*.12;
    pos.x+=mix(2.7,0.,uPortrait);pos.y-=uPortrait*2.2;
    vec4 mv=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uRatio*(105./max(1.,-mv.z)),1.,32.);vSeed=aSeed;vDepth=1.-smoothstep(10.,39.,-mv.z);}`,
   fragmentShader:`varying float vSeed,vDepth;uniform float uTime,uRead;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float glow=exp(-r*r*5.5)*.32+exp(-r*r*26.)*.7;float twinkle=.83+.17*sin(uTime*.8+vSeed*45.);vec3 color=mix(vec3(.10,.68,.34),vec3(.69,.96,.42),vSeed);color=mix(color,vec3(.87,1.,.86),pow(vSeed,14.));gl_FragColor=vec4(color,glow*vDepth*twinkle*uRead);}`});
  const points=new T.Points(geometry,material);points.frustumCulled=false;scene.add(points);status.geometryId=geometry.uuid;status.objectTypes=scene.children.map(n=>n.type);status.models=scene.children.length;let ratio=Math.min(devicePixelRatio||1,small?1.25:1.6),samples=0,total=0,previous=performance.now(),adapted=false;
  function resize(){renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();u.uRatio.value=renderer.getPixelRatio();u.uPortrait.value=innerWidth<650?1:0;status.pixelRatio=renderer.getPixelRatio();}resize();
  status.mode='webgl';status.resources=14;status.particles=count;status.quality=small?'mobile':'desktop';
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!disposed)fallback();},{signal});
  return {resize,draw(t,p,read,ptr,motion){const now=performance.now(),dt=now-previous;previous=now;if(dt<250&&!adapted){samples++;total+=dt;if(samples>=90){adapted=true;if(total/samples>42){ratio=Math.min(ratio,.8);geometry.setDrawRange(0,Math.floor(count*.65));status.particles=Math.floor(count*.65);status.quality='adaptive';resize();}}}
   u.uProgress.value=p.intro;u.uChapter.value=p.chapter;u.uTime.value=t;u.uRead.value=read;u.uMotion.value.set(motion.roll,motion.sway,motion.scale);u.uDrift.value.set(motion.x,motion.y);camera.position.set(ptr.x*.45,ptr.y*.28,20-8*Math.sin(p.intro*Math.PI*.8)+Math.sin(p.chapter*.8)*.7);camera.lookAt(0,0,0);renderer.render(scene,camera);status.programs=renderer.info.programs.length;
  },dataChanged(){const next=shapes(count);geometry.attributes.aPlants.array.set(next.plants);geometry.attributes.aPlants.needsUpdate=true;},destroy(){scene.remove(points);geometry.dispose();material.dispose();renderer.dispose();replaceCanvas();status.resources=0;}};
 }
 function light(){const canvas=replaceCanvas(),ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas unavailable');const count=innerWidth<650?240:520,data=shapes(count),fields=[data.flow,data.energy,data.biomass,data.plants,data.network,data.analytics,data.support,data.assistant],sprites=[];
  for(const color of ['#36b46b','#a4e636','#e4ffdd']){const sprite=document.createElement('canvas');sprite.width=sprite.height=40;const c=sprite.getContext('2d'),g=c.createRadialGradient(20,20,0,20,20,20);g.addColorStop(0,color);g.addColorStop(.15,color);g.addColorStop(.5,color+'55');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,40,40);sprites.push(sprite);}
  function resize(){canvas.width=innerWidth;canvas.height=innerHeight;status.pixelRatio=1;}resize();status.mode='canvas2d';status.resources=2;status.particles=count;status.quality='light';
  return {resize,draw(t,p,read,ptr,motion){const w=innerWidth,h=innerHeight,portrait=w<650,lens=h/(2*Math.tan(20*Math.PI/180)),camera=20-8*Math.sin(p.intro*Math.PI*.8)+Math.sin(p.chapter*.8)*.7;ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='lighter';const g=smooth(.03,.34,p.intro),l=smooth(.46,.71,p.intro),f=smooth(.78,1,p.intro),a=(t*.055+p.intro*.55)*(1-smooth(.46,.72,p.intro)),cs=Math.cos(a),sn=Math.sin(a),cr=Math.cos(motion.roll),sr=Math.sin(motion.roll),cy=Math.cos(motion.sway),swaySin=Math.sin(motion.sway),from=Math.min(6,Math.floor(p.chapter)),blend=smooth(from,from+1,p.chapter);
   for(let i=0;i<count;i++){const k=i*3,v=[];for(let axis=0;axis<3;axis++){let value=data.cloud[k+axis]*(1-g)+data.galaxy[k+axis]*g;value=value*(1-l)+data.leaf[k+axis]*l;v[axis]=value*(1-f)+data.flow[k+axis]*f;}
    const xx=v[0]*cs-v[1]*sn,yy=v[0]*sn+v[1]*cs;v[0]=xx;v[1]=yy;
    if(p.chapter>0){for(let axis=0;axis<3;axis++)v[axis]=fields[from][k+axis]*(1-blend)+fields[from+1][k+axis]*blend;}
    const rx=v[0]*cr-v[1]*sr,ry=v[0]*sr+v[1]*cr;v[0]=(rx*cy+v[2]*swaySin)*motion.scale+motion.x;v[1]=ry*motion.scale+motion.y;v[2]=(v[2]*cy-rx*swaySin)*motion.scale;
    const x=v[0]+(portrait?0:2.7)+Math.sin(t*.24+data.seeds[i]*30)*.065,y=v[1]-(portrait?2.2:0),z=camera-v[2];if(z<=.5)continue;const factor=lens/z,sx=w/2+x*factor,sy=h/2-y*factor,r=Math.max(1,Math.min(14,data.sizes[i]*105/z));if(sx<-r||sx>w+r||sy<-r||sy>h+r)continue;ctx.globalAlpha=(1-smooth(10,39,z))*(.82+.18*Math.sin(t*.8+data.seeds[i]*45))*read;ctx.drawImage(sprites[Math.min(2,Math.floor(data.seeds[i]*3))],sx-r,sy-r,r*2,r*2);
   }ctx.globalAlpha=1;
  },dataChanged(){const next=shapes(count);data.plants.set(next.plants);},destroy(){ctx.clearRect(0,0,innerWidth,innerHeight);sprites.length=0;replaceCanvas();status.resources=0;}};
 }
 function motion(){control.value=paused()?'off':'full';document.querySelectorAll('svg').forEach(svg=>paused()?svg.pauseAnimations?.():svg.unpauseAnimations?.());if(paused()){stop();showAllCopy();status.mode='paused';hint.textContent='Movimiento en pausa. Puedes activarlo cuando quieras.';}else{status.mode=controller?(failed?'canvas2d':'webgl'):'loading';wake();}window.dispatchEvent(new Event('biovolt:particle-state'));}
 control.addEventListener('change',()=>{document.documentElement.dataset.bvMotion=control.value;try{localStorage.setItem('bvMotionPreference',control.value);}catch(error){}window.dispatchEvent(new Event('biovolt:motion'));},{signal});window.addEventListener('biovolt:motion',motion,{signal});
 root.querySelector('[data-cinema-skip]').addEventListener('click',()=>document.getElementById('heroTitle').closest('section').scrollIntoView({behavior:paused()?'auto':'smooth',block:'start'}),{signal});
 window.addEventListener('scroll',wake,{passive:true,signal});window.addEventListener('resize',()=>{controller?.resize();wake();},{passive:true,signal});window.addEventListener('biovolt:section',wake,{signal});window.addEventListener('biovolt:data',()=>{controller?.dataChanged();wake();},{signal});
 window.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;pointer.x=e.clientX/innerWidth-.5;pointer.y=.5-e.clientY/innerHeight;},{passive:true,signal});document.addEventListener('focusin',wake,{signal});document.addEventListener('focusout',()=>requestAnimationFrame(wake),{signal});document.addEventListener('visibilitychange',()=>document.hidden?stop():wake(),{signal});
 const modalObserver=new MutationObserver(wake);document.querySelectorAll('dialog').forEach(d=>modalObserver.observe(d,{attributes:true,attributeFilter:['open']}));const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(wake):null;resizeObserver?.observe(main);
 window.addEventListener('pagehide',e=>{stop();if(!e.persisted){disposed=true;controller?.destroy();abort.abort();modalObserver.disconnect();resizeObserver?.disconnect();}},{signal});window.addEventListener('pageshow',e=>{if(e.persisted)wake();},{signal});
 window.BioVoltCinema=Object.freeze({inspect:()=>({...status,preference:paused()?'off':'full',systemReduced:!!matchMedia('(prefers-reduced-motion: reduce)').matches,motionPaused:paused(),editing:!!editing(),canvasCount:world.querySelectorAll('canvas').length,targets:{...targets},bridges:layout?.tops.map(b=>({name:b.name,top:b.top,height:b.height}))||[]}),refresh:wake});
 motion();
})();
