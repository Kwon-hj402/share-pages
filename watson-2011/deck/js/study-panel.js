(() => {
  'use strict';
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();
  ready(() => {
    if(new URLSearchParams(location.search).has('preview') || document.querySelector('#study-panel'))return;
    const deck=document.querySelector('#deck');
    const data=window.WatsonStudyPassages;
    if(!deck || !data || !Array.isArray(data.slides))return;
    const byId=new Map(data.slides.map(s=>[s.id,s]));
    const storageKey='watson-study-view:v1:'+location.pathname;
    let preferences={visible:true,layout:innerWidth>=1800?'side':'below'};
    try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved)preferences={...preferences,...saved};}catch(_){}
    if(window.WatsonFigureGuides&&preferences.guideVersion!==1){preferences.visible=true;preferences.guideVersion=1;try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch(_){}}
    const bar=document.createElement('nav');
    bar.className='study-bar';bar.setAttribute('aria-label','준비용 주논문 원문');
    bar.innerHTML='<strong>준비용 · 그림 해설·주논문 원문</strong><span class="study-context">자료를 읽는 법과 영어·한글</span><div class="study-layout-controls"><button type="button" data-study-layout="side">옆에 보기</button><button type="button" data-study-layout="below">아래 보기</button></div><button type="button" class="study-toggle" aria-controls="study-panel"></button>';
    const panel=document.createElement('aside');panel.id='study-panel';panel.className='study-panel';panel.setAttribute('aria-label','현재 슬라이드의 주논문 원문과 번역');panel.tabIndex=0;
    const spacer=document.createElement('div');spacer.className='study-spacer';spacer.setAttribute('aria-hidden','true');
    document.body.append(bar,spacer,panel);
    const toggle=bar.querySelector('.study-toggle');
    let renderedId=null;
    const active=()=>deck.querySelector(':scope > .slide.is-active');
    function resolveEntry(slide){
      const seen=new Set();
      while(slide&&!seen.has(slide.dataset.slideId)){
        seen.add(slide.dataset.slideId);
        if(byId.has(slide.dataset.slideId))return byId.get(slide.dataset.slideId);
        const sourceId=slide.dataset.sourceSlideId;
        if(byId.has(sourceId))return byId.get(sourceId);
        slide=[...deck.querySelectorAll(':scope > .slide')].find(s=>s.dataset.slideId===sourceId);
      }
      return null;
    }
    const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const paperPage=entry=>{const m=entry.locator?.match(/PDF\s*(?:p(?:age)?[.\s]*)?(\d+)/i);if(m)return Number(m[1]);const p=entry.locator?.match(/(?:p[.]?\s*|원문\s*)(9[0-5])/i);return p?Number(p[1])-89:null;};
    function render(){
      const slide=active();if(!slide)return;
      const id=slide.dataset.slideId;
      const guideKey=id+'|'+(window.WatsonFigureGuideUI?.selection(slide)?.key||'');
      if(guideKey===renderedId)return;
      renderedId=guideKey;
      const entry=resolveEntry(slide);
      const slides=[...deck.querySelectorAll(':scope > .slide')];
      const number=slides.indexOf(slide)+1;
      const title=slide.dataset.title||'';
      if(!entry){panel.innerHTML='<p class="study-kicker">'+number+' / '+slides.length+'</p><h2>'+escape(title)+'</h2><p>이 추가 페이지에 연결한 주논문 문장이 아직 없습니다.</p>';return;}
      const pdfPage=paperPage(entry);
      const href='../'+encodeURIComponent('권혁진 발표.pdf')+(pdfPage?'#page='+pdfPage:'');
      panel.innerHTML='<p class="study-kicker">'+number+' / '+slides.length+' · WATSON ET AL. 2011</p><h2>'+escape(title)+'</h2><p class="study-locator">'+escape(entry.locator)+' · <a href="'+href+'" target="_blank" rel="noopener">PDF 원문 ↗</a></p>'+(entry.bridge?'<div class="study-bridge"><span class="study-bridge-label">이 페이지와 연결</span><p>'+escape(entry.bridge)+'</p></div>':'')+(entry.passages||[]).map((p,i)=>'<section class="study-passage" aria-label="대응 문장 '+(i+1)+'"><div class="study-en"><h3 class="study-language">EN · 원문'+(entry.passages.length>1?' '+(i+1):'')+'</h3><p class="study-original" lang="en">'+escape(p.en)+'</p></div><div class="study-ko"><h3 class="study-language">KO · 번역</h3><p class="study-translation" lang="ko">'+escape(p.ko)+'</p></div></section>').join('')+(entry.caution?'<p class="study-caution">'+escape(entry.caution)+'</p>':'')+'<p class="study-panel-footer">발표 준비용 대역 · 페이지를 넘기면 함께 바뀝니다. 상단의 “원문 숨기기”로 전체를 숨길 수 있습니다.</p>';
      const bridge=panel.querySelector('.study-bridge');
      const lastPassage=panel.querySelector('.study-passage:last-of-type');
      if(bridge&&lastPassage)lastPassage.after(bridge);
      const guideMarkup=window.WatsonFigureGuideUI?.markup(slide);
      if(guideMarkup)panel.querySelector('.study-locator').insertAdjacentHTML('afterend','<nav class="study-quick-links" aria-label="학습 내용 이동"><button type="button" data-guide-jump="guide">그림·표 설명</button><button type="button" data-guide-jump="paper">영문·번역</button></nav>'+guideMarkup+'<h3 class="paper-passage-heading">주논문 영문·한글</h3>');
      panel.scrollTop=0;
    }
    function save(){try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch(_){} }
    window.WatsonStudyPanel={
      toggle(){preferences.visible=!preferences.visible;save();layout();if(!preferences.visible)window.scrollTo(0,0);},
      setVisible(value){preferences.visible=Boolean(value);save();layout();},
      setLayout(value){if(!['side','below'].includes(value))return;preferences.layout=value;save();layout();window.scrollTo(0,0);},
      relayout:layout
    };
    function layout(){
      const editing=document.body.classList.contains('edit-mode');
      const visible=preferences.visible&&!editing;
      const mode=innerWidth<980?'below':preferences.layout;
      document.body.classList.toggle('study-visible',visible);
      document.body.classList.toggle('study-side',visible&&mode==='side');
      document.body.classList.toggle('study-below',visible&&mode==='below');
      panel.hidden=!visible;
      spacer.hidden=!visible||mode!=='below';
      toggle.textContent=preferences.visible?'해설·원문 숨기기':'그림 해설·원문 보이기';
      toggle.setAttribute('aria-expanded',String(visible));
      for(const button of bar.querySelectorAll('[data-study-layout]'))button.setAttribute('aria-pressed',String(button.dataset.studyLayout===mode));
      let width=innerWidth,height=innerHeight-44;
      if(visible&&mode==='side')width-=panel.getBoundingClientRect().width;
      const scale=Math.min(width/1600,height/900);
      document.documentElement.style.setProperty('--study-scale',String(scale));
      document.documentElement.style.setProperty('--study-stage-height',Math.max(0,height)+'px');
    }
    toggle.addEventListener('click',()=>{preferences.visible=!preferences.visible;save();layout();if(!preferences.visible)window.scrollTo(0,0);});
    for(const button of bar.querySelectorAll('[data-study-layout]'))button.addEventListener('click',()=>{preferences.layout=button.dataset.studyLayout;save();layout();window.scrollTo(0,0);});
    panel.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))event.stopPropagation();});
    document.addEventListener('academic:slidechange',()=>{
      const readingBelow=!document.documentElement.classList.contains('presentation-fullscreen')&&document.body.classList.contains('study-below')&&scrollY>innerHeight/2;
      render();layout();
      if(readingBelow)panel.scrollIntoView({block:'start',behavior:'instant'});
    });
    document.addEventListener('academic:stagechange',render);
    addEventListener('resize',layout);
    let editing=document.body.classList.contains('edit-mode');
    new MutationObserver(()=>{const next=document.body.classList.contains('edit-mode');if(next!==editing){editing=next;if(!editing){renderedId=null;render();}layout();}}).observe(document.body,{attributes:true,attributeFilter:['class']});
    render();layout();
  });
})();
