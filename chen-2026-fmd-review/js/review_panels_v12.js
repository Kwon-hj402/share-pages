/* Expand each review point in place; the other three headings remain visible. */
(() => {
  const isPreview = () => new URLSearchParams(location.search).has('preview');
  const roots = () => [...document.querySelectorAll('#deck > .critical-compact-slide')];
  let channel;
  try { channel = new BroadcastChannel('chen-review-panels-' + location.pathname); } catch (_) {}
  function broadcast() {
    if (channel && !isPreview()) channel.postMessage({type:'panels',states:roots().map(s=>({id:s.dataset.slideId,key:s.dataset.reviewPanel || ''}))});
  }
  function prepare(slide) {
    const prefix = slide.dataset.slideId;
    slide.querySelectorAll('[data-review-panel]').forEach(panel => {
      const key = panel.dataset.reviewPanel;
      panel.id = prefix + '-detail-' + key;
      const heading = panel.querySelector('h3');
      if (heading) { heading.id = prefix + '-heading-' + key; panel.setAttribute('aria-labelledby',heading.id); }
      const trigger = slide.querySelector('[data-review-open="' + key + '"]');
      if (trigger) trigger.setAttribute('aria-controls',panel.id);
    });
  }
  function setPanel(slide,key='',emit=true,focus=true) {
    if (!slide) return;
    prepare(slide);
    const previous = slide.dataset.reviewPanel;
    const panel = [...slide.querySelectorAll('[data-review-panel]')].find(p=>p.dataset.reviewPanel===key);
    key = panel ? key : '';
    slide.dataset.reviewPanel = key;
    slide.classList.toggle('is-review-open',!!key);
    slide.querySelectorAll('[data-review-panel]').forEach(p=>{p.hidden=p!==panel;});
    slide.querySelectorAll('[data-review-open]').forEach(b=>{
      const expanded=b.dataset.reviewOpen===key;
      b.setAttribute('aria-expanded',String(expanded));
      b.closest('[data-review-item]')?.classList.toggle('is-expanded',expanded);
      const symbol=b.querySelector('.point-open');
      if(symbol)symbol.textContent=expanded?'−':'＋';
    });
    const backdrop = slide.querySelector('.review-backdrop');
    if (backdrop) backdrop.hidden = !key;
    if (focus) {
      if (panel) (panel.querySelector('[data-review-close]') || slide.querySelector('[data-review-open="'+key+'"]'))?.focus({preventScroll:true});
      else if (previous) slide.querySelector('[data-review-open="'+previous+'"]')?.focus({preventScroll:true});
    }
    if (emit) broadcast();
  }
  function stepPanel(dir) {
    if (isPreview() || document.body.classList.contains('edit-mode')) return false;
    const slide=document.querySelector('#deck > .critical-compact-slide.is-active');
    if (!slide) return false;
    const keys=[...slide.querySelectorAll('[data-review-open]')].map(b=>b.dataset.reviewOpen);
    const current=keys.indexOf(slide.dataset.reviewPanel || '');
    if (dir>0 && current<keys.length-1) {setPanel(slide,keys[current+1],true,false);return true;}
    if (dir<0 && current>=0) {setPanel(slide,current>0?keys[current-1]:'',true,false);return true;}
    if (dir>0 && current===keys.length-1) setPanel(slide,'',true,false);
    return false;
  }
  const inheritedStep=window.chenReviewStep;
  window.chenReviewStep=dir=>stepPanel(dir) || !!inheritedStep?.(dir);
  document.addEventListener('click',event=>{
    if (document.body.classList.contains('edit-mode')) return;
    const control = event.target.closest('[data-review-open],[data-review-close]');
    const slide = control?.closest('#deck > .critical-compact-slide');
    if (!slide) return;
    event.preventDefault();
    const nextKey=control.dataset.reviewOpen || '';
    setPanel(slide,nextKey===slide.dataset.reviewPanel?'':nextKey);
  });
  document.addEventListener('keydown',event=>{
    if (document.body.classList.contains('edit-mode') || event.ctrlKey || event.metaKey || event.altKey) return;
    const slide = document.querySelector('#deck > .critical-compact-slide.is-active');
    if (!slide) return;
    const key = slide.dataset.reviewPanel;
    if (event.key==='Escape' && key) {
      event.preventDefault();event.stopImmediatePropagation();setPanel(slide);return;
    }
    const directions = {ArrowRight:1,PageDown:1,' ':1,Enter:1,ArrowLeft:-1,PageUp:-1,Backspace:-1};
    if (event.key in directions) {
      if (stepPanel(directions[event.key])) {event.preventDefault();event.stopImmediatePropagation();}
      return;
    }
    if (event.key==='Tab' && key) {
      const panel=slide.querySelector('[data-review-panel]:not([hidden])');
      if(panel.getAttribute('role')!=='dialog')return;
      const focusable=[...panel.querySelectorAll('button,a[href],[tabindex="0"]')];
      const first=focusable[0],last=focusable.at(-1);
      if (event.shiftKey && (document.activeElement===first || !panel.contains(document.activeElement))) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
    }
  },true);
  if (channel) channel.onmessage=event=>{
    if (event.data?.type==='ask' && !isPreview()) broadcast();
    if (event.data?.type==='panels' && isPreview()) {
      event.data.states.forEach(state=>setPanel(roots().find(s=>s.dataset.slideId===state.id),state.key,false,false));
    }
  };
  window.addEventListener('DOMContentLoaded',()=>{
    roots().forEach(s=>setPanel(s,'',false,false));
    const deck=document.getElementById('deck');
    new MutationObserver(()=>{
      for (const slide of roots()) {
        prepare(slide);
        if (!isPreview() && !slide.classList.contains('is-active') && slide.dataset.reviewPanel) setPanel(slide,'',true,false);
      }
    }).observe(deck,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    if (isPreview() && channel) channel.postMessage({type:'ask'});
  });
})();
