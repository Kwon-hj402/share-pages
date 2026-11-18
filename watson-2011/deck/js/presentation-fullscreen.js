/* Clean audience view for the Fullscreen API and native desktop-browser F11. */
(() => {
  'use strict';
  function isFullscreen(view) {
    if (view.api || view.native === true) return true;
    const { width, height, outerWidth, outerHeight, screenWidth, screenHeight } = view;
    if (![width,height,outerWidth,outerHeight,screenWidth,screenHeight].every(v=>Number.isFinite(v)&&v>0)) return false;
    const tolerance=Math.max(8,Math.min(20,screenHeight*.015));
    // F11 has no standard fullscreenchange signal. Require both a screen-sized
    // outer window and a chrome-free viewport; normalize the latter for zoom.
    return Math.abs(outerWidth-screenWidth)<=tolerance &&
      Math.abs(outerHeight-screenHeight)<=tolerance &&
      Math.abs(height*(outerWidth/width)-screenHeight)<=tolerance;
  }
  const fitScale=(width,height,deckWidth=1600,deckHeight=900)=>Math.min(width/deckWidth,height/deckHeight);
  function install(w,d) {
    if(new URLSearchParams(w.location.search).has('preview'))return null;
    const root=d.documentElement,deck=d.querySelector('#deck');if(!deck)return null;
    let active=false,frame=null,scroll=[0,0],pendingScroll=null,pendingAt=0,restoreEditing=false;
    const chrome='.deck-tools,.edit-toggle,.edit-toolbar,.study-bar,.study-panel,.memo-panel';
    const measure=()=>({api:!!(d.fullscreenElement||d.webkitFullscreenElement),native:w.fullScreen,width:w.innerWidth,height:w.innerHeight,outerWidth:w.outerWidth,outerHeight:w.outerHeight,screenWidth:w.screen?.width,screenHeight:w.screen?.height});
    function sync() {
      const next=isFullscreen(measure());
      if(next)root.style.setProperty('--presentation-fullscreen-scale',String(fitScale(w.innerWidth,w.innerHeight,deck.offsetWidth||1600,deck.offsetHeight||900)));
      if(next===active)return;
      active=next;
      if(active){
        scroll=pendingScroll&&Date.now()-pendingAt<2000?pendingScroll:[w.scrollX||0,w.scrollY||0];pendingScroll=null;
        restoreEditing=d.body.classList.contains('edit-mode');
        if(restoreEditing)w.academicDeckEditor?.setEditMode(false);
        if(d.activeElement?.closest?.(chrome))d.activeElement.blur?.();
        root.classList.add('presentation-fullscreen');
        w.scrollTo(0,0);
      }else{
        root.classList.remove('presentation-fullscreen');
        root.style.removeProperty('--presentation-fullscreen-scale');
        if(restoreEditing&&!d.body.classList.contains('edit-mode'))w.academicDeckEditor?.setEditMode(true);
        restoreEditing=false;
        w.WatsonStudyPanel?.relayout();
        w.requestAnimationFrame(()=>{if(!active)w.scrollTo(scroll[0],scroll[1]);});
      }
      d.dispatchEvent(new w.CustomEvent('academic:fullscreenchange',{detail:{active}}));
    }
    function queue(){if(frame===null)frame=w.requestAnimationFrame(()=>{frame=null;sync();});}
    function remember(){if(!active){pendingScroll=[w.scrollX||0,w.scrollY||0];pendingAt=Date.now();}}
    w.addEventListener('resize',queue);
    w.addEventListener('focus',queue);
    w.addEventListener('pageshow',queue);
    w.visualViewport?.addEventListener('resize',queue);
    for(const event of ['fullscreenchange','webkitfullscreenchange'])d.addEventListener(event,()=>{queue();w.setTimeout(queue,180);});
    d.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-deck-fullscreen]'))remember();},true);
    d.addEventListener('keydown',e=>{
      if(e.key==='F11'||e.key==='Escape'||((e.key==='f'||e.key==='F')&&!e.ctrlKey&&!e.altKey&&!e.metaKey)){
        if(e.key!=='Escape')remember();
        // Leave F11/Escape to the browser; only observe the completed change.
        for(const delay of [0,180,700])w.setTimeout(queue,delay);
      }
    },true);
    sync();
    return {sync,isActive:()=>active};
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={isFullscreen,fitScale,install};return;}
  const ready=()=>install(window,document);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
