/* Controles y lectura de la escena unificada. Este módulo no crea otro renderer ni modelos sólidos. */
'use strict';
(function(){
 const html=document.documentElement,main=document.querySelector('main');if(!main)return;const button=document.createElement('button');button.type='button';button.id='motionToggle';button.className='icon-btn bv-motion-toggle';document.querySelector('.nav-actions')?.prepend(button);
 const animations=new Set(),seen=new WeakSet();let uiFrames=0;
 const paused=()=>html.dataset.bvMotion==='off';
 function controls(){const on=!paused();button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'Pausar animaciones':'Activar animaciones');button.title=on?'Pausar animaciones':'Activar animaciones';button.innerHTML=on?'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 7v10M15 7v10"/><circle cx="12" cy="12" r="9"/></svg>':'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m10 7 7 5-7 5z"/><circle cx="12" cy="12" r="9"/></svg>';}
 button.addEventListener('click',()=>{html.dataset.bvMotion=paused()?'full':'off';try{localStorage.setItem('bvMotionPreference',html.dataset.bvMotion);}catch(error){}window.dispatchEvent(new Event('biovolt:motion'));});
 function animate(el,frames,options){if(paused()||!el.animate)return;try{const a=el.animate(frames,options);animations.add(a);a.onfinish=a.oncancel=()=>animations.delete(a);uiFrames++;}catch(error){}}
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting||seen.has(e.target))return;seen.add(e.target);const el=e.target;if(el.matches('.bar,.track>span'))animate(el,[{transform:el.matches('.bar')?'scaleY(.08)':'scaleX(.05)'},{transform:'none'}],{duration:850,easing:'cubic-bezier(.18,.7,.2,1)',fill:'none'});else if(!el.closest('.bv-story-head'))animate(el,[{opacity:.25,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:650,easing:'cubic-bezier(.18,.7,.2,1)',fill:'none'});observer.unobserve(el);}),{threshold:.2}):null;
 const selector='.panel-title,.bar,.track>span';function scan(node){node.querySelectorAll?.(selector).forEach(n=>{if(!seen.has(n))observer?.observe(n);});}scan(main);
 const mutation=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1){scan(n);if(n.matches?.(selector))observer?.observe(n);}})));mutation.observe(main,{childList:true,subtree:true});
 window.addEventListener('biovolt:motion',()=>{controls();animations.forEach(a=>a.cancel());});
 window.addEventListener('pagehide',e=>{if(!e.persisted){observer?.disconnect();mutation.disconnect();animations.forEach(a=>a.cancel());}});
 window.BioVoltExperience=Object.freeze({inspect:()=>({...window.BioVoltCinema.inspect(),paused:paused(),uiFrames}),refresh:()=>window.BioVoltCinema.refresh()});controls();
})();
