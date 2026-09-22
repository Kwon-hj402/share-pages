(() => {
  'use strict';
  function fitDeck(){const editing=document.body.classList.contains('edit-mode');const reserved=editing?document.getElementById('edit-toolbar').offsetHeight+24:0;document.documentElement.style.setProperty('--deck-scale',Math.min(innerWidth/1600,(innerHeight-reserved)/900));document.documentElement.style.setProperty('--deck-top',`${reserved+(innerHeight-reserved)/2}px`);}
  fitDeck();addEventListener('resize',fitDeck);
  new MutationObserver(fitDeck).observe(document.body,{attributes:true,attributeFilter:['class']});
  const viewer=document.getElementById('image-viewer'),stage=document.getElementById('viewer-stage'),img=document.getElementById('viewer-image'),lens=document.getElementById('magnifier');
  let ratio=1,base=1,x=0,y=0,drag=null,showLens=false,opener=null;
  function paint(){img.style.width=img.naturalWidth+'px';img.style.height=img.naturalHeight+'px';img.style.transform=`translate(${x}px,${y}px) scale(${ratio})`;document.getElementById('zoom-value').textContent=Math.round(ratio/base*100)+'%';lens.hidden=true;}
  function fit(){base=Math.min((stage.clientWidth-50)/img.naturalWidth,(stage.clientHeight-50)/img.naturalHeight);ratio=base;x=(stage.clientWidth-img.naturalWidth*ratio)/2;y=(stage.clientHeight-img.naturalHeight*ratio)/2;paint();}
  function zoom(f,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=Math.min(base*10,Math.max(base*.5,ratio*f));x=cx-(cx-x)*next/ratio;y=cy-(cy-y)*next/ratio;ratio=next;paint();}
  document.addEventListener('click',e=>{const target=e.target.closest('.zoom-target');if(!target||document.body.classList.contains('edit-mode'))return;opener=target;document.getElementById('viewer-title').textContent=target.dataset.caption;img.alt=target.dataset.caption;img.onload=fit;viewer.showModal();img.src=target.dataset.zoom;if(img.complete&&img.naturalWidth)fit();document.getElementById('zoom-close').focus();});
  document.getElementById('zoom-in').onclick=()=>zoom(1.4);document.getElementById('zoom-out').onclick=()=>zoom(1/1.4);document.getElementById('zoom-fit').onclick=fit;
  document.getElementById('zoom-close').onclick=()=>viewer.close();
  document.getElementById('zoom-lens').onclick=e=>{showLens=!showLens;e.currentTarget.setAttribute('aria-pressed',showLens);lens.hidden=true;};
  viewer.addEventListener('close',()=>{showLens=false;lens.hidden=true;document.getElementById('zoom-lens').setAttribute('aria-pressed','false');opener?.focus();});
  stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();zoom(e.deltaY<0?1.16:1/1.16,e.clientX-r.left,e.clientY-r.top);},{passive:false});
  stage.addEventListener('pointerdown',e=>{drag={px:e.clientX,py:e.clientY,x,y};stage.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',e=>{if(drag){x=drag.x+e.clientX-drag.px;y=drag.y+e.clientY-drag.py;paint();return;}if(!showLens)return;const r=stage.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;const z=2.4;lens.hidden=false;lens.style.left=(px-130)+'px';lens.style.top=(py-130)+'px';lens.style.backgroundImage=`url("${img.src}")`;lens.style.backgroundSize=`${img.naturalWidth*ratio*z}px ${img.naturalHeight*ratio*z}px`;lens.style.backgroundPosition=`${130-(px-x)*z}px ${130-(py-y)*z}px`;});
  stage.addEventListener('pointerup',()=>drag=null);stage.addEventListener('pointercancel',()=>drag=null);stage.addEventListener('pointerleave',()=>lens.hidden=true);
  addEventListener('resize',()=>{if(viewer.open&&img.naturalWidth)fit();});
  // Capture dialog shortcuts before the deck navigation listener.
  document.addEventListener('keydown',e=>{if(!viewer.open)return;if(e.key==='Escape'){e.preventDefault();viewer.close();}else if(e.key==='+'||e.key==='='){zoom(1.4);}else if(e.key==='-'){zoom(1/1.4);}else if(e.key==='0'){fit();}e.stopImmediatePropagation();},true);
  const shortcuts={'nav-prev':'ArrowLeft','nav-next':'ArrowRight','nav-notes':'n','nav-presenter':'s','nav-overview':'o','nav-fullscreen':'f'};
  Object.entries(shortcuts).forEach(([id,key])=>document.getElementById(id).onclick=()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true})));
})();
