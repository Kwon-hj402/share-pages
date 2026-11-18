/* Academic presentation interactions. Step() consumes a stage; runtime owns navigation. */
(() => {
  'use strict';
  const ready = fn => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn();
  ready(() => {
    const deck = document.querySelector('#deck');
    if (!deck) return;
    const preview = new URLSearchParams(location.search).has('preview');
    const states = new Map();
    const resetOnEntry = new Set();
    const handlers = [];
    let previousId = null;
    let channel;
    try { channel = new BroadcastChannel('academic-deck-stages:' + location.pathname); } catch (_) {}
    const slides = () => [...deck.querySelectorAll(':scope > .slide')];
    const active = () => deck.querySelector(':scope > .slide.is-active');
    const approvedFocus = slide => slide.dataset.focusApproved === 'true' && slide.dataset.focusTarget;
    const editing = () => document.body.classList.contains('edit-mode');
    const blankState = () => ({stage:0,focus:0,panel:null,video:-1});
    const getState = slide => {
      const id = slide.dataset.slideId;
      if (!states.has(id)) states.set(id, blankState());
      return states.get(id);
    };
    function scale() {
      document.documentElement.style.setProperty('--deck-scale', String(Math.min(innerWidth / 1600, innerHeight / 900)));
    }
    addEventListener('resize', scale); scale();
    function videos(slide) { return [...slide.querySelectorAll('[data-next-play]')].filter(el => { const video=mediaOf(el);return video && (video.currentSrc || video.getAttribute('src') || video.querySelector('source[src]')); }); }
    function mediaOf(el) { return el?.matches('video') ? el : el?.querySelector('video'); }
    function render(slide) {
      if (!slide) return;
      const state = getState(slide);
      slide.dataset.stage = String(state.stage);
      slide.querySelectorAll('[data-step]').forEach(el => {
        const hidden = !editing() && Number(el.dataset.step) > state.stage;
        el.classList.toggle('is-step-hidden',hidden);
        el.setAttribute('aria-hidden',String(hidden));
      });
      const selector = approvedFocus(slide);
      let focus;
      try { focus = selector ? slide.querySelector(selector) : null; } catch (_) {}
      slide.querySelectorAll('[data-focus-active]').forEach(el => el.removeAttribute('data-focus-active'));
      slide.classList.toggle('has-focus', !!focus && state.focus === 1 && !editing());
      focus?.toggleAttribute('data-focus-active', state.focus === 1 && !editing());
      const items = [...slide.querySelectorAll('[data-review-item]')];
      slide.querySelector('.review-list')?.classList.toggle('has-selection',state.panel !== null);
      items.forEach((item,i) => {
        const open = state.panel === i && !editing();
        item.classList.toggle('is-open',open);
        const button=item.querySelector('[data-review-open]');
        button?.setAttribute('aria-expanded',String(open));
        const panel=item.querySelector('[data-review-panel]');
        const key=item.dataset.reviewItem;
        if (panel && button) {
          panel.id = `${slide.dataset.slideId}-panel-${key}`;
          button.setAttribute('aria-controls',panel.id);
          panel.setAttribute('aria-hidden',String(!open && !editing()));
        }
        const symbol=item.querySelector('.review-symbol');
        if(symbol) symbol.textContent=open?'−':'＋';
      });
      const media=videos(slide);
      slide.classList.toggle('has-video-focus',!editing() && media[state.video]?.dataset.nextPlay === 'expand');
      media.forEach((el,i) => el.classList.toggle('is-video-active',!editing() && i === state.video));
    }
    function exportedStates() {
      return [...states].map(([id,state]) => [id,resetOnEntry.has(id)?blankState():state]);
    }
    function publish() {
      if (!preview && channel) channel.postMessage({type:'state',values:exportedStates()});
    }
    function changed(slide) { render(slide); publish(); document.dispatchEvent(new CustomEvent('academic:stagechange',{detail:{slideId:slide.dataset.slideId,state:{...getState(slide)}}})); }
    function stopVideos(slide) {
      slide?.querySelectorAll('video').forEach(video => video.pause());
      slide?.querySelectorAll('.play-fallback').forEach(el => el.remove());
    }
    function reset(slide) { stopVideos(slide); resetOnEntry.delete(slide.dataset.slideId); states.set(slide.dataset.slideId,blankState()); render(slide); }
    function play(element) {
      if(preview) return;
      const video=mediaOf(element);
      const start=Number(element.dataset.start || 0);
      if (Number.isFinite(start) && start >= 0) { try { video.currentTime=start; } catch (_) {} }
      const attempt=video.play();
      if(attempt?.catch) attempt.catch(() => {
        if(element.querySelector('.play-fallback')) return;
        const button=document.createElement('button');button.className='play-fallback';button.textContent='▶ 영상 재생';
        button.addEventListener('click',()=>video.play().then(()=>button.remove()).catch(()=>{}));
        (element.matches('video')?element.parentElement:element).append(button);
      });
    }
    function builtinStep(dir) {
      const slide=active();if(!slide) return false;
      const state=getState(slide);
      const reviews=[...slide.querySelectorAll('[data-review-item]')];
      if(reviews.length) {
        const next=state.panel === null ? (dir>0?0:null) : state.panel+dir;
        if(dir>0 && next >= reviews.length) return false;
        if(dir<0 && state.panel === null) return false;
        state.panel=next < 0 ? null:next;changed(slide);return true;
      }
      if(approvedFocus(slide)) {
        // Hold the enlarged source until Next advances; do not shrink it again.
        if(dir>0 && state.focus===1 && slide.dataset.focusFlow==='advance')return false;
        const next=state.focus+dir;
        if(next<0 || next>2) return false;
        state.focus=next;changed(slide);return true;
      }
      const max=Number(slide.dataset.steps || 0);
      if(max>0) {
        const next=state.stage+dir;
        if(next<0 || next>max) return false;
        state.stage=next;changed(slide);return true;
      }
      const media=videos(slide);
      if(media.length) {
        if(dir<0 && state.video>=0) { stopVideos(slide);state.video--;changed(slide);return true; }
        if(dir>0 && state.video+1<media.length) { stopVideos(slide);state.video++;changed(slide);play(media[state.video]);return true; }
      }
      return false;
    }
    const api={
      step(dir,options={}) {
        if(editing() || preview) return false;
        const direction=dir>0?1:-1;
        for(const h of handlers) if(h.fn(direction,options)) return true;
        return builtinStep(direction);
      },
      registerStepHandler(fn,{priority=0}={}) {const entry={fn,priority};handlers.push(entry);handlers.sort((a,b)=>b.priority-a.priority);return()=>handlers.splice(handlers.indexOf(entry),1);},
      goTo(id) { const index=slides().findIndex(s=>s.dataset.slideId===id);if(index>=0)window.AcademicRuntime?.go(index); },
      setStage(slide,value) {getState(slide).stage=Math.max(0,Math.min(Number(slide.dataset.steps||0),value));changed(slide);},
      setPanel(slide,key) {const index=key===null?null:[...slide.querySelectorAll('[data-review-item]')].findIndex(el=>el.dataset.reviewItem===key);if(index!==null && index<0)return;getState(slide).panel=index;changed(slide);},
      focusMedia(slide,enabled) {getState(slide).focus=enabled?1:2;changed(slide);},
      prepareSlide(slide) {
        // Reset before activation; keep the departing picture intact during its fade.
        if(slide && resetOnEntry.has(slide.dataset.slideId))reset(slide);
      },
      reset,
      exportState:exportedStates,
      preparePrint() {slides().forEach(slide=>{stopVideos(slide);slide.classList.add('print-all');slide.classList.remove('has-focus','has-video-focus');slide.querySelectorAll('[data-focus-active]').forEach(el=>el.removeAttribute('data-focus-active'));});},
      restorePrint() {slides().forEach(slide=>{slide.classList.remove('print-all');render(slide);});}
    };
    window.AcademicDeck=api;
    function updatePosition() { const current=active();const list=slides();document.querySelectorAll('[data-deck-position]').forEach(el=>el.textContent=`${Math.max(0,list.indexOf(current))+1} / ${list.length}`); }
    document.addEventListener('academic:slidechange',()=>{
      const slide=active();const id=slide?.dataset.slideId;
      if(previousId && previousId!==id) {
        const previous=slides().find(s=>s.dataset.slideId===previousId);stopVideos(previous);
        if(previous?.dataset.resetStage==='leave' && !preview)resetOnEntry.add(previousId);
      }
      previousId=id;render(slide);updatePosition();if(!preview)publish();
    });
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-review-open]');
      if(!button || editing() || preview) return;
      const slide=button.closest('.slide');const index=[...slide.querySelectorAll('[data-review-open]')].indexOf(button);
      const state=getState(slide);state.panel=state.panel===index?null:index;changed(slide);
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Escape' || editing()) return;
      const slide=active();if(!slide)return;const state=getState(slide);
      if(state.focus===1){state.focus=2;changed(slide);}
      else if(state.panel!==null){state.panel=null;changed(slide);}
      else if(state.video>=0){stopVideos(slide);state.video=-1;changed(slide);}
    });
    new MutationObserver(()=>{if(editing()){slides().forEach(reset);publish();}else slides().forEach(render);}).observe(document.body,{attributes:true,attributeFilter:['class']});
    document.querySelector('[data-deck-prev]')?.addEventListener('click',()=>window.AcademicRuntime?.step(-1));
    document.querySelector('[data-deck-next]')?.addEventListener('click',()=>window.AcademicRuntime?.step(1));
    document.querySelector('[data-deck-notes]')?.addEventListener('click',()=>window.AcademicRuntime?.toggleNotes());
    document.querySelector('[data-deck-presenter]')?.addEventListener('click',()=>window.AcademicRuntime?.openPresenter());
    addEventListener('beforeprint',api.preparePrint);addEventListener('afterprint',api.restorePrint);
    if(channel) channel.onmessage=event=>{
      if(event.data?.type==='request' && !preview)publish();
      if(event.data?.type==='state' && preview){for(const [id,value] of event.data.values||[])states.set(id,value);slides().forEach(render);}
    };
    slides().forEach(render);previousId=active()?.dataset.slideId;updatePosition();
    if(preview)channel?.postMessage({type:'request'});else publish();
  });
})();
