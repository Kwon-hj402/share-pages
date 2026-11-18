(()=>{'use strict';
 const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();
 ready(()=>{
  if(window.AcademicRuntime?.isPreview)return;
  const nav=document.querySelector('.deck-tools');
  const help=document.getElementById('deck-help');
  const overview=document.querySelector('.overview');
  const closeOverview=document.createElement('button');closeOverview.className='overview-close';closeOverview.textContent='전체보기 닫기 · Esc';closeOverview.hidden=true;document.body.append(closeOverview);
  closeOverview.addEventListener('click',()=>window.AcademicRuntime.toggleOverview(false));
  new MutationObserver(()=>{closeOverview.hidden=!overview.classList.contains('open');}).observe(overview,{attributes:true,attributeFilter:['class']});
  nav?.querySelector('[data-deck-overview]')?.addEventListener('click',()=>window.AcademicRuntime.toggleOverview());
  nav?.querySelector('[data-deck-fullscreen]')?.addEventListener('click',()=>window.AcademicRuntime.fullscreen());
  nav?.querySelector('[data-deck-source]')?.addEventListener('click',()=>window.WatsonStudyPanel?.toggle());
  nav?.querySelector('[data-deck-help]')?.addEventListener('click',()=>help.showModal());
  help.querySelector('.help-close').addEventListener('click',()=>help.close());
  window.AcademicDeck?.registerStepHandler(()=>{if(help.open){help.close();return true;}return false;},{priority:400});
  function tabState(){const s=document.querySelector('#deck>.slide.is-active');if(!s)return;for(const b of s.querySelectorAll('[data-evidence-target]'))b.setAttribute('aria-pressed',String(b.dataset.evidenceTarget===s.dataset.stage));}
  document.addEventListener('click',event=>{const button=event.target.closest('[data-evidence-target]');if(!button)return;const slide=button.closest('.slide');window.AcademicDeck?.setStage(slide,Number(button.dataset.evidenceTarget));tabState();});
  document.addEventListener('click',event=>{const caption=event.target.closest('.memo-evidence-zone figcaption');if(caption&&!document.body.classList.contains('edit-mode'))caption.closest('figure').querySelector('.figure-open')?.click();});
  document.addEventListener('academic:slidechange',tabState);document.addEventListener('academic:stagechange',tabState);tabState();
 });
})();
