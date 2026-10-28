/* Synchronize the native video with the exact published CSV values. */
(() => {
  const ns='http://www.w3.org/2000/svg';
  const svgNode=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;};
  const seriesCache=new Map(),prepared=new WeakSet();
  const nextPlayState=new WeakMap();
  let activeProjectSlide=null;
  const isPreview=()=>new URLSearchParams(location.search).has('preview')||document.documentElement.hasAttribute('data-preview');
  const nextVideo=slide=>slide?.querySelector('video[data-project-tracking],video[data-next-play]');
  let mediaChannel;
  try{mediaChannel=new BroadcastChannel('chen-media-next-'+location.pathname);}catch(_){}
  function broadcastMedia(){
    if(mediaChannel&&!isPreview())mediaChannel.postMessage({type:'media-state',states:[...document.querySelectorAll('#deck>.slide')].filter(nextVideo).map(slide=>({id:slide.dataset.slideId,expanded:slide.classList.contains('is-video-expanded')}))});
  }
  function expandVideo(slide,expanded,emit=true){
    if(!slide||slide.classList.contains('is-video-expanded')===expanded)return;
    slide.classList.toggle('is-video-expanded',expanded);
    if(emit)broadcastMedia();
  }
  const seekStart=video=>{if(video.readyState>=1){const start=Number(video.dataset.start||0);video.currentTime=Math.min(Number.isFinite(start)?start:0,video.duration||0);}};
  const resetNextPlay=slide=>{const video=nextVideo(slide);if(video){nextPlayState.set(slide,false);video.dataset.nextPlayState='ready';video.pause();seekStart(video);expandVideo(slide,false);}};
  const synchronizeActive=deck=>{
    const active=deck.querySelector(':scope>.slide.is-active');
    if(active!==activeProjectSlide){resetNextPlay(activeProjectSlide);activeProjectSlide=active;resetNextPlay(active);}
    deck.querySelectorAll(':scope>.slide:not(.is-active) video.project-video').forEach(video=>{if(!video.paused)video.pause();});
  };
  function playNextStep(dir,remote=false){
    if(dir!==1||isPreview()||document.body.classList.contains('edit-mode'))return false;
    const slide=document.querySelector('#deck>.slide.is-active'),video=nextVideo(slide),state=nextPlayState.get(slide);
    if(!video||state?.phase==='played')return false;
    if(state?.phase==='pending')return true;
    const attempt={phase:'pending'};nextPlayState.set(slide,attempt);video.dataset.nextPlayState='pending';
    if(video.dataset.nextPlay==='expand')expandVideo(slide,true);
    if(remote)video.muted=true;
    const settled=()=>{if(nextPlayState.get(slide)===attempt&&slide.classList.contains('is-active')){attempt.phase='played';video.dataset.nextPlayState='playing';}};
    const failed=()=>{if(nextPlayState.get(slide)===attempt&&slide.classList.contains('is-active')){nextPlayState.set(slide,false);video.dataset.nextPlayState='blocked';}};
    try{const playback=video.play();if(playback?.then)playback.then(settled,failed);else settled();}catch(_){failed();}
    return true;
  }
  // Presenter Next arrives through the runtime's BroadcastChannel step hook.
  // Keep the existing AI/review step chain and consume only this video step.
  const priorReviewStep=window.chenReviewStep;
  window.chenReviewStep=dir=>playNextStep(dir,true)||(priorReviewStep?priorReviewStep(dir):false);
  const nextKeys=new Set(['ArrowRight','PageDown',' ','Enter']);
  const videoKeys=new Set([' ','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown']);
  const expandedKeyups=new Set();
  // Capture navigation before runtime's bubbling listener. The tools' next
  // button dispatches the same keyboard event, so both controls use this step.
  document.addEventListener('keydown',event=>{
    const focusedVideo=event.target instanceof Element?event.target.closest('video.project-video'):null;
    if(focusedVideo&&videoKeys.has(event.key)&&!(nextKeys.has(event.key)&&focusedVideo.closest('.slide.is-video-expanded'))){event.stopImmediatePropagation();return;}
    if(!nextKeys.has(event.key)||event.repeat||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||isPreview()||document.body.classList.contains('edit-mode'))return;
    if(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
    if(event.target instanceof Element&&[' ','Enter'].includes(event.key)&&event.target.closest('button,a[href]'))return;
    const expandedNext=focusedVideo?.closest('.slide.is-video-expanded');
    if(expandedNext)expandedKeyups.add(event.key);
    if(playNextStep(1)){event.preventDefault();event.stopImmediatePropagation();return;}
    if(expandedNext)event.preventDefault();
  },true);
  document.addEventListener('keyup',event=>{if(expandedKeyups.has(event.key)){expandedKeyups.delete(event.key);event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('click',event=>{
    if(isPreview()||document.body.classList.contains('edit-mode')||!(event.target instanceof Element)||!event.target.closest('.deck-tools [data-key="ArrowRight"]')||!nextVideo(document.querySelector('#deck>.slide.is-active')))return;
    // Use an Element target for the shared editor's keyboard guards; the
    // generic tools handler dispatches on Document, which has no matches().
    event.preventDefault();event.stopImmediatePropagation();
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  },true);
  if(mediaChannel)mediaChannel.onmessage=event=>{
    if(event.data?.type==='ask'&&!isPreview())broadcastMedia();
    if(event.data?.type==='media-state'&&isPreview())event.data.states.forEach(state=>{
      const slide=[...document.querySelectorAll('#deck>.slide')].find(s=>s.dataset.slideId===state.id);
      expandVideo(slide,!!state.expanded,false);
    });
  };
  const seriesFor=url=>{if(!seriesCache.has(url))seriesCache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('CSV series unavailable');return r.json();}));return seriesCache.get(url);};
  async function chart(panel){
    if(prepared.has(panel))return;
    prepared.add(panel);
    panel.dataset.chartReady='loading';
    const slide=panel.closest('.slide'), video=slide.querySelector('video'), svg=panel.querySelector('svg');
    try{
      const series=await seriesFor(panel.dataset.series), finite=series.filter(d=>d[1]!==null&&Number.isFinite(d[1]));
      if(!finite.length)throw Error('No measured diameters');
      const x0=76,x1=628,y0=25,y1=320,tmax=series.at(-1)[0];
      const min=Math.floor(Math.min(...finite.map(d=>d[1]))*10)/10-.1,max=Math.ceil(Math.max(...finite.map(d=>d[1]))*10)/10+.1;
      const x=t=>x0+(x1-x0)*t/tmax,y=d=>y1-(y1-y0)*(d-min)/(max-min);
      svg.replaceChildren();
      for(let j=0;j<=4;j++){const v=min+(max-min)*j/4;svg.append(svgNode('line',{x1:x0,x2:x1,y1:y(v),y2:y(v),class:'grid'}),svgNode('text',{x:x0-12,y:y(v)+6,'text-anchor':'end'},v.toFixed(2)));}
      for(let t=0;t<=tmax;t+=20)svg.append(svgNode('text',{x:x(t),y:y1+32,'text-anchor':'middle'},String(t)));
      svg.append(svgNode('line',{x1:x0,x2:x1,y1:y1,y2:y1,class:'axis'}),svgNode('line',{x1:x0,x2:x0,y1:y0,y2:y1,class:'axis'}),svgNode('text',{x:8,y:16},'mm'),svgNode('text',{x:(x0+x1)/2,y:384,'text-anchor':'middle'},'Time (s)'));
      let d='',open=false;series.forEach(([t,v])=>{if(v===null||!Number.isFinite(v)){open=false;return;}d+=(open?'L':'M')+x(t).toFixed(2)+','+y(v).toFixed(2);open=true;});
      svg.append(svgNode('path',{d,class:'series'}));
      const cursor=svgNode('line',{x1:x(0),x2:x(0),y1:y0,y2:y1,class:'cursor'}),dot=svgNode('circle',{cx:0,cy:0,r:5,class:'current-dot'});svg.append(cursor,dot);
      const update=mediaTime=>{const time=Math.min(typeof mediaTime==='number'?mediaTime:video.currentTime||0,tmax);let lo=0,hi=series.length;while(lo<hi){const mid=(lo+hi)>>1;if(series[mid][0]<=time+.000002)lo=mid+1;else hi=mid;}const idx=Math.max(0,lo-1),[t,v]=series[idx];cursor.setAttribute('x1',x(t));cursor.setAttribute('x2',x(t));dot.setAttribute('cx',x(t));dot.setAttribute('cy',v===null?y1:y(v));dot.style.display=v===null?'none':'';panel.querySelector('output').textContent=v===null?'D: unavailable':v.toFixed(3)+' mm';panel.querySelector('.project-chart-status').textContent=t.toFixed(2)+' s · Frame '+(idx+1)+' / '+series.length+' · 시간 보간 없음';panel.dataset.frameIndex=idx;panel.dataset.currentD=v===null?'':String(v);};
      ['timeupdate','seeking','seeked','loadedmetadata'].forEach(event=>video.addEventListener(event,()=>update()));
      if(video.requestVideoFrameCallback){const frame=(_,metadata)=>{update(metadata.mediaTime);video.requestVideoFrameCallback(frame);};video.requestVideoFrameCallback(frame);}else{const animate=()=>{if(!video.paused&&!video.ended){update();requestAnimationFrame(animate);}};video.addEventListener('play',animate);}
      panel.dataset.chartReady='true';update();
    }catch(error){panel.dataset.chartReady='error';panel.querySelector('.project-chart-status').textContent='그래프를 불러오지 못했습니다. 공개 사이트에서 CSV를 확인할 수 있습니다.';console.error(error);}
  }
  const initialize=()=>{
    document.querySelectorAll('#deck>.slide video.project-video').forEach(video=>{const seek=()=>{seekStart(video);video.dataset.initialized='true';};video.addEventListener('loadedmetadata',seek,{once:true});video.addEventListener('play',()=>{if(!video.closest('#deck>.slide.is-active'))video.pause();});if(video.readyState>=1)seek();});
    document.querySelectorAll('#deck>.slide [data-diameter-chart]').forEach(chart);
    const deck=document.querySelector('#deck');synchronizeActive(deck);new MutationObserver(()=>{synchronizeActive(deck);deck.querySelectorAll(':scope>.slide [data-diameter-chart]:not([data-chart-ready])').forEach(chart);}).observe(deck,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    new MutationObserver(()=>{if(document.body.classList.contains('edit-mode'))resetNextPlay(deck.querySelector(':scope>.slide.is-active'));}).observe(document.body,{attributes:true,attributeFilter:['class']});
    if(isPreview()&&mediaChannel)mediaChannel.postMessage({type:'ask'});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
