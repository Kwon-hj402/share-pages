(()=>{'use strict';
 const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();
 ready(()=>{
  const viewer=document.getElementById('figure-viewer');
  if(!viewer)return;
  document.addEventListener('click',event=>{
   const button=event.target.closest('[data-figure-src]');
   if(!button||document.body.classList.contains('edit-mode'))return;
   const image=viewer.querySelector('img');image.src=button.dataset.figureSrc;image.alt=button.dataset.figureCaption||'원문 그림';
   viewer.querySelector('p').textContent=button.dataset.figureCaption||'';viewer.showModal();
  });
  viewer.querySelector('.viewer-close').addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
  window.AcademicDeck?.registerStepHandler(()=>{if(viewer.open){viewer.close();return true;}return false;},{priority:300});
 });
})();
