(()=>{'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=v=>Array.isArray(v)?v.join(' '):String(v??'');
 const entries=()=>window.WatsonFigureGuides?.slides||[];
 function entryFor(slide){
  const seen=new Set();
  while(slide&&!seen.has(slide.dataset.slideId)){
   const id=slide.dataset.slideId;seen.add(id);
   const entry=entries().find(e=>e.id===id);if(entry)return entry;
   const source=slide.dataset.sourceSlideId;
   const direct=entries().find(e=>e.id===source);if(direct)return direct;
   slide=[...document.querySelectorAll('#deck>.slide')].find(s=>s.dataset.slideId===source);
  }return null;
 }
 function select(slide){
  const entry=entryFor(slide);if(!entry)return null;
  const n=Number(slide.dataset.stage||0),panel=slide.querySelector('[data-review-item].is-open')?.dataset.reviewItem;
  const stages=entry.stages||[];
  const current=(panel&&stages.find(e=>e.panel===panel))||stages.find(e=>Number(e.stage)===n&&!e.panel)||stages.find(e=>Number(e.stage)===0&&!e.panel)||stages[0]||{};
  const seen=new Set(),abbreviations=[];
  for(const a of [...(entry.abbreviations||[]),...(current.abbreviations||[])]){if(a.short&&!seen.has(a.short)){seen.add(a.short);abbreviations.push(a);}}
  return {entry,current,abbreviations,key:current.guide_key||String(current.stage??0)};
 }
 window.WatsonFigureGuideUI={
  selection:select,
  markup(slide){
   const d=select(slide);if(!d)return '';
   const c=d.current;
   const referencePassages=(d.entry.reference_passages||[]).length?'<div class="guide-reference-passages"><h4>선택한 선행문헌의 해당 설명</h4>'+(d.entry.reference_passages||[]).map(p=>'<p class="reference-locator">'+esc(p.locator||'')+'</p><p class="reference-en" lang="en">'+esc(p.en)+'</p><p class="reference-ko" lang="ko">'+esc(p.ko)+'</p>').join('')+'</div>':'';
   const block=(title,value,cls='')=>value?'<div class="figure-guide-block '+cls+'"><h4>'+title+'</h4><p>'+esc(text(value))+'</p></div>':'';
   const glossary=d.abbreviations.length?'<div class="figure-guide-glossary" id="guide-glossary"><h4>이 자료의 약어·기호</h4><dl>'+d.abbreviations.map(a=>'<dt>'+esc(a.short)+'</dt><dd><span class="english-term">'+esc(a.en)+'</span>'+esc(a.ko)+(a.meaning?' — '+esc(a.meaning):'')+'</dd>').join('')+'</dl></div>':'';
   return '<section class="figure-guide-section" id="figure-guide-section"><h3>그림·표를 읽는 법</h3>'+(d.entry.overview?'<p class="figure-guide-context">'+esc(text(d.entry.overview))+'</p>':'')+'<div class="figure-guide-grid">'+block('① 무엇을 보여주는 자료인가',c.what)+block('② 축·열·범례는 어떻게 읽나',c.how_to_read)+block('③ 무엇이 관찰됐나',c.key_result,'figure-guide-result')+block('④ 왜 본문 주장을 설명하나',c.why_supports,'figure-guide-result')+'</div>'+(c.limits?'<p class="figure-guide-limits">'+esc(text(c.limits))+'</p>':'')+referencePassages+glossary+'</section>';
  }
 };
 function positionControls(){document.body.classList.toggle('study-reading-panel',document.body.classList.contains('study-below')&&scrollY>innerHeight*.45);}
 function annotations(){
  positionControls();
  const slide=document.querySelector('#deck>.slide.is-active');if(!slide)return;
  const d=select(slide);if(!d)return;
  for(const e of slide.querySelectorAll('[data-guide-reading]'))e.hidden=e.dataset.guideReading!==d.key;
  let lines=0;
  for(const e of slide.querySelectorAll('[data-guide-abbreviations]')){e.hidden=e.dataset.guideAbbreviations!==d.key;if(!e.hidden)lines=Number(e.dataset.lines||1);}
  lines=Math.max(lines,Number(slide.dataset.abbreviationMaxLines||0));
  slide.dataset.abbreviationLines=String(lines);
  slide.classList.toggle('has-page-abbreviations',lines>0);
 }
 const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();
 ready(()=>{
  annotations();
  addEventListener('scroll',positionControls,{passive:true});
  document.addEventListener('academic:slidechange',annotations);document.addEventListener('academic:stagechange',annotations);
  document.addEventListener('click',event=>{
   const button=event.target.closest('[data-guide-jump]');if(!button)return;
   const panel=document.querySelector('#study-panel');
   const target=button.dataset.guideJump==='paper'?panel?.querySelector('.paper-passage-heading'):panel?.querySelector('#figure-guide-section');
   if(!target)return;
   if(document.body.classList.contains('study-side'))panel.scrollTo({top:panel.scrollTop+target.getBoundingClientRect().top-panel.getBoundingClientRect().top-14,behavior:'smooth'});
   else target.scrollIntoView({block:'start',behavior:'smooth'});
  });
 });
})();
