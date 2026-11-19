(async function(){
  'use strict';
  const $=id=>document.getElementById(id), video=$('background');
  const canvas=$('two-d'), ctx=canvas.getContext('2d'), three=$('three-d'), tctx=three.getContext('2d');
  const CAMERA_IDS=Array.from({length:8},(_,i)=>String(i+1));
  const partOrder=['MEPI','LEPI','PAT_INF','TIB_MID_LAT','MMA','LMA','NAV','HEE','P1M','D1M','D5M'];
  const pairs=[['MEPI','LEPI'],['MEPI','PAT_INF'],['LEPI','PAT_INF'],['LEPI','TIB_MID_LAT'],['TIB_MID_LAT','LMA'],['MEPI','MMA'],['MMA','LMA'],['LMA','HEE'],['MMA','HEE'],['HEE','P1M'],['P1M','D1M'],['D1M','D5M'],['D5M','HEE'],['NAV','P1M'],['NAV','MMA']];
  const reasons={accepted:'채택',detector:'검출 하한 미달',invalid:'판정 중',unknown:'Jev 이름 보류',no_named_evidence:'이름 확률 모두 0%',probability:'이름 확률 미달',confidence:'confidence 하한 미달',margin:'선택 확률 모순',duplicate:'동일 이름의 낮은 후보',camera_noise:'기록된 카메라 불일치',live_noise:'현재 카메라 대응 불일치'};
  const pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let DATA,CAL,META,refs,fps,colors;
  const state={camera:'1',index:0,probabilities:Object.fromEntries(CAMERA_IDS.map(c=>[c,.3])),confidence:0,detector:.425,source:'raw',excludeNoise:false,forceUnknown:true,selected:null,backgroundReady:false,pendingIndex:null,yaw:.5,pitch:.15,zoom:1,frameResults:{},reconstruction:null,hitPoints:[],totals:{}};
  try {
    const responses=await Promise.all([fetch('viewer_data.json'),fetch('calibration.json')]);
    if(responses.some(r=>!r.ok))throw new Error('판정 자료를 불러오지 못했습니다.');
    [DATA,CAL]=await Promise.all(responses.map(r=>r.json()));META=DATA.meta;refs=META.frame_refs;fps=META.encoded_fps;colors=META.colors;
    if(!Array.isArray(refs)||!refs.length||!window.ThresholdRules||!window.LiveMarkerReconstruction)throw new Error('필요한 계산 자료가 없습니다.');
    state.index=refs.includes(141)?refs.indexOf(141):0;
    $('frame').max=String(refs.length-1);$('frame').value=String(state.index);
    $('scope').textContent=`공유 영상의 2~6.5초 구간 · REF ${refs[0]}–${refs.at(-1)} · ${refs.length}프레임 · 0.5배속 재생 ${(refs.length/fps).toFixed(4)}초. 저장된 Jev 확률로 이름을 표시합니다.`;
    if(META.incomplete_preview){$('progress').hidden=false;$('progress').textContent='미리보기: 기존에 판정된 REF90–164는 바로 조절할 수 있습니다. 앞뒤 REF60–89·165–194의 추가 Jev 판정은 처리 중이며, 아직 판정이 없는 점은 이름을 붙이지 않았습니다.';}
    buildControls();bindEvents();recomputeTotals();refreshFrame();loadCamera(false);
    if(video.requestVideoFrameCallback) video.requestVideoFrameCallback(onVideoFrame);
  }catch(error){$('error').hidden=false;$('error').textContent=error.message||'자료를 불러오지 못했습니다.';return;}

  function settings(camera){return {p_min:state.probabilities[camera],confidence_min:state.confidence,detector_min:state.detector,source:state.source,exclude_noise:state.excludeNoise,force_unknown:state.forceUnknown};}
  function frameRecord(camera,ref=refs[state.index]){return DATA.cameras[camera].frames[String(ref)];}
  function evaluate(camera,ref){return ThresholdRules.evaluateFrame(frameRecord(camera,ref).points,settings(camera),META.marker_names);}
  function buildControls(){
    $('camera-controls').innerHTML=CAMERA_IDS.map(c=>`<div class="camera-card" data-card="${c}"><header><button data-camera="${c}">CAM ${c.padStart(2,'0')}</button><output id="p-value-${c}">0.30</output></header><input aria-label="CAM ${c.padStart(2,'0')} 이름 확률 문턱" data-threshold="${c}" type="range" min="0" max="1" step="0.01" value="0.3"><div class="count" id="count-${c}"></div></div>`).join('');
    document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>selectCamera(b.dataset.camera));
    document.querySelectorAll('[data-threshold]').forEach(input=>input.oninput=()=>{state.probabilities[input.dataset.threshold]=Number(input.value);thresholdChanged();});
    document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{for(const c of CAMERA_IDS)state.probabilities[c]=Number(b.dataset.preset)/100;thresholdChanged();});
  }
  function thresholdChanged(){recomputeTotals();refreshFrame();}
  function recomputeTotals(){
    state.totals={};for(const c of CAMERA_IDS){let named=0,detected=0;for(const ref of refs){const r=evaluate(c,ref);named+=r.accepted.length;detected+=r.rows.length;}state.totals[c]={named,detected};}
  }
  function refreshFrame(){
    const start=performance.now(),ref=refs[state.index];state.frameResults={};const inputs={};
    for(const c of CAMERA_IDS){const result=evaluate(c,ref);state.frameResults[c]=result;inputs[c]=result.accepted.map(p=>({...p,name:p.name,marker_name:p.name}));}
    state.reconstruction=LiveMarkerReconstruction.reconstructFrame(inputs,CAL);
    updateCameraCards();renderPointTable();draw2d();draw3d();
    $('frame').value=String(state.index);
    $('frame-status').textContent=`REF ${ref} · ${state.index+1}/${refs.length}프레임 · 재생 ${(state.index/fps).toFixed(2)} / ${(refs.length/fps).toFixed(2)}초 · 공유 영상 ${(refs[0]/fps+state.index/fps).toFixed(2)}초`;
    $('compute-time').textContent=`현재 프레임 다시 계산 ${(performance.now()-start).toFixed(1)}ms`;
  }
  function updateCameraCards(){
    for(const c of CAMERA_IDS){const t=state.totals[c],r=state.frameResults[c],candidates=r.rows.filter(p=>colors[p.name]).length;$(`p-value-${c}`).textContent=state.probabilities[c].toFixed(2);document.querySelector(`[data-threshold="${c}"]`).value=String(state.probabilities[c]);document.querySelector(`[data-card="${c}"]`).classList.toggle('selected',c===state.camera);$(`count-${c}`).textContent=`현재 채택 ${r.accepted.length}/${r.rows.length} · 이름 후보 ${candidates} · 구간 채택 ${t.named.toLocaleString()}/${t.detected.toLocaleString()}`;}
    $('camera-title').textContent=`CAM ${state.camera.padStart(2,'0')} · 이름과 선택확률`;
    $('active-threshold').value=String(state.probabilities[state.camera]);$('active-threshold-value').textContent=state.probabilities[state.camera].toFixed(2);
  }
  function noiseFor(camera,index){return state.reconstruction.noise_views.some(p=>String(p.camera)===camera&&Number(p.index)===index);}
  function rowStatus(row){return row.reason==='accepted'&&noiseFor(state.camera,row.index)?'live_noise':row.reason;}
  function draw2d(){
    ctx.fillStyle='#080f18';ctx.fillRect(0,0,canvas.width,canvas.height);state.hitPoints=[];
    const record=frameRecord(state.camera),result=state.frameResults[state.camera],ref=refs[state.index];
    const box=$('crop').checked?record.crop_xyxy_px:[0,0,...META.native_size];
    const [x1,y1,x2,y2]=box, bw=x2-x1,bh=y2-y1;
    const scale=Math.min(1020/bw,850/bh),w=bw*scale,h=bh*scale,ox=(1600-w)/2,oy=82+(850-h)/2;
    ctx.font='24px sans-serif';ctx.fillStyle='#b3d8c7';ctx.fillText(`REF ${ref} · CAM ${state.camera.padStart(2,'0')} · 문턱 ${state.probabilities[state.camera].toFixed(2)} · 이름 ${result.accepted.length}/${result.rows.length}`,24,36);
    if(state.backgroundReady&&video.readyState>=2)ctx.drawImage(video,x1,y1,bw,bh,ox,oy,w,h);
    else {ctx.fillStyle='#182638';ctx.fillRect(ox,oy,w,h);ctx.fillStyle='#c5d4e6';ctx.fillText('영상 프레임 불러오는 중…',ox+25,oy+50);}
    const visible=new Map(),grayTags=[];
    for(const row of result.rows){const [x,y]=row.xy_px;if(x<x1||x>x2||y<y1||y>y2||row.reason==='detector')continue;const px=ox+(x-x1)*scale,py=oy+(y-y1)*scale;const accepted=row.reason==='accepted',noise=accepted&&noiseFor(state.camera,row.index),selected=row.index===state.selected;ctx.beginPath();ctx.arc(px,py,selected?10:accepted?6:4,0,Math.PI*2);ctx.fillStyle=accepted?(colors[row.name]||'#fff'):'#a3a9b2';ctx.fill();ctx.lineWidth=selected?3:2;ctx.strokeStyle=selected?'#fff':'#070c12';ctx.stroke();if(noise){ctx.strokeStyle='#ffb385';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px-9,py-9);ctx.lineTo(px+9,py+9);ctx.moveTo(px+9,py-9);ctx.lineTo(px-9,py+9);ctx.stroke();}if(accepted)visible.set(row.name,{row,px,py,noise});else grayTags.push({row,px,py});state.hitPoints.push({index:row.index,x:px,y:py});}
    const tagBoxes=[];ctx.font='21px sans-serif';
    for(const item of grayTags.sort((a,b)=>a.py-b.py)){
      const {row,px,py}=item,kind=row.reason==='unknown'?'보류':row.reason==='probability'?'문턱미달':row.reason==='duplicate'?'중복':row.reason==='camera_noise'?'카메라불일치':row.reason==='invalid'?'판정중':reasons[row.reason];
      const candidate=colors[row.name]?row.name+(row.forced_unknown?'?':''):kind;
      const label=`#${row.index} ${candidate}${Number.isFinite(row.probability)?' '+pct(row.probability):''}`,tw=ctx.measureText(label).width+12,th=29;
      let chosen=null;
      for(let i=0;i<18;i++){const tx=Math.max(255,Math.min(1345-tw,px+(i%2?-tw-16:14))),ty=Math.max(83,Math.min(922-th,py-24+Math.floor(i/2)*32));const b={x:tx,y:ty,w:tw,h:th};if(!tagBoxes.some(q=>b.x<q.x+q.w+4&&b.x+b.w+4>q.x&&b.y<q.y+q.h+4&&b.y+b.h+4>q.y)){chosen=b;break;}}
      if(!chosen)chosen={x:Math.max(255,Math.min(1345-tw,px+14)),y:Math.max(83,Math.min(893,py+12)),w:tw,h:th};tagBoxes.push(chosen);
      ctx.strokeStyle='#a7b3c4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(chosen.x+(chosen.x>px?0:chosen.w),chosen.y+chosen.h/2);ctx.stroke();ctx.fillStyle='rgba(10,18,28,.86)';ctx.fillRect(chosen.x,chosen.y,chosen.w,chosen.h);ctx.fillStyle='#d3dce7';ctx.fillText(label,chosen.x+6,chosen.y+22);
    }
    for(const side of ['L','R'])for(let i=0;i<partOrder.length;i++){const name=`${side}_${partOrder[i]}`,item=visible.get(name),lx=side==='L'?12:1370,anchor=side==='L'?248:1352,y=95+i*75;ctx.font='22px sans-serif';ctx.fillStyle=item?colors[name]:'#41536b';ctx.fillText(name+(item&&item.row.forced_unknown?' ?':''),lx,y);if(item){ctx.font='21px sans-serif';ctx.fillStyle='#d2deeb';ctx.fillText(`${pct(item.row.probability)}${item.row.review&&state.source==='effective'?' †':''}${item.noise?' ×':''}`,lx,y+29);ctx.strokeStyle=colors[name];ctx.globalAlpha=.65;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(anchor,y+9);ctx.lineTo(item.px,item.py);ctx.stroke();ctx.globalAlpha=1;}}
    ctx.font='19px sans-serif';ctx.fillStyle='#9badc5';ctx.fillText('R_: 본인 오른쪽 / L_: 본인 왼쪽 · 같은 이름은 모든 카메라에서 같은 색',24,975);
    $('two-d-status').textContent=`CAM ${state.camera.padStart(2,'0')} · 원본 프레임 ${record.source_frame} · 채택 ${result.accepted.length} / 검출 ${result.rows.length}개 · 이름 후보 ${result.rows.filter(p=>colors[p.name]).length}개 · 문턱·중복 등으로 제외 ${result.rows.length-result.accepted.length}개`;
  }
  function draw3d(){
    const result=state.reconstruction,points=result.points||[];tctx.fillStyle='#0b1726';tctx.fillRect(0,0,1200,1000);tctx.fillStyle='#a7bbd1';tctx.font='23px sans-serif';tctx.fillText(`REF ${refs[state.index]} · 현재 카메라별 문턱 반영`,25,38);
    const n2=points.filter(p=>p.view_count===2).length,noise=result.noise_views.length;
    $('three-d-status').textContent=`3D 마커 ${points.length}/22개 · 2시점 ${n2} / 3시점 이상 ${points.length-n2} · 불일치 카메라 관측 ${noise}개 제외`;
    if(!points.length){tctx.fillStyle='#a8b9cf';tctx.font='28px sans-serif';tctx.fillText('현재 조건에서 재구성할 점이 없습니다.',190,470);return;}
    const coords=points.map(p=>p.xyz),min=[0,1,2].map(i=>Math.min(...coords.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...coords.map(p=>p[i]))),origin=min.map((v,i)=>(v+max[i])/2),span=Math.max(.85,...max.map((v,i)=>v-min[i]))*1.35;
    const scale=750/span*state.zoom,cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const project=p=>{const d=p.map((v,i)=>v-origin[i]),x=cy*d[0]+sy*d[2],z=-sy*d[0]+cy*d[2],y=cp*d[1]-sp*z;return [600+x*scale,520+y*scale,z];};
    tctx.strokeStyle='#263b50';tctx.lineWidth=1;for(let g=-3;g<=3;g++){const a=project([origin[0]-.75,origin[1]+g*.25,origin[2]]),b=project([origin[0]+.75,origin[1]+g*.25,origin[2]]);tctx.beginPath();tctx.moveTo(a[0],a[1]);tctx.lineTo(b[0],b[1]);tctx.stroke();}
    const lookup=new Map(points.map(p=>[p.name,p]));let edgeCount=0;
    if($('connections').checked)for(const side of ['R','L'])for(const [a,b] of pairs){const pa=lookup.get(`${side}_${a}`),pb=lookup.get(`${side}_${b}`);if(!pa||!pb)continue;const x=project(pa.xyz),y=project(pb.xyz);tctx.strokeStyle=colors[pa.name];tctx.lineWidth=4;tctx.beginPath();tctx.moveTo(x[0],x[1]);tctx.lineTo(y[0],y[1]);tctx.stroke();edgeCount++;}
    for(const point of [...points].sort((a,b)=>project(a.xyz)[2]-project(b.xyz)[2])){const [x,y]=project(point.xyz);tctx.fillStyle=colors[point.name]||'#fff';tctx.beginPath();tctx.arc(x,y,7,0,Math.PI*2);tctx.fill();tctx.strokeStyle='#07111c';tctx.lineWidth=2;tctx.stroke();if($('names').checked){const candidate=point.cameras.some(c=>state.frameResults[c].accepted.some(r=>r.name===point.name&&r.forced_unknown));tctx.font='21px sans-serif';tctx.fillText(point.name+(candidate?' ?':'')+(point.view_count===2?' *2':''),x+10,y-10);}}
    tctx.font='20px sans-serif';tctx.fillStyle='#9fb5cc';tctx.fillText(`실제 마커 연결 ${edgeCount}개 · 표시 격자 0.25m · 바닥 정렬 아님`,25,970);
  }
  function renderPointTable(){
    const rows=state.frameResults[state.camera].rows;
    $('point-table').innerHTML=rows.map(r=>{const status=rowStatus(r),name=r.name==='pending'?'판정 중':r.name==='no_named_evidence'?'이름 확률 모두 0%':r.name||'unknown';return `<tr data-point="${r.index}" class="${r.index===state.selected?'selected':''}"><td>#${r.index}</td><td style="color:${colors[r.name]||'#acb7c4'}">${esc(name)}${r.forced_unknown&&colors[r.name]?' ?':''}${r.review&&state.source==='effective'?' †':''}</td><td>${pct(r.probability)}</td><td>${pct(r.model_confidence)}</td><td>${pct(r.detector_confidence)}</td><td class="status-${status}">${reasons[status]}</td></tr>`;}).join('');
    $('point-table').querySelectorAll('[data-point]').forEach(tr=>tr.onclick=()=>{state.selected=Number(tr.dataset.point);renderPointTable();draw2d();});renderDetails();
  }
  function renderDetails(){const row=state.frameResults[state.camera].rows.find(r=>r.index===state.selected);if(!row){$('point-details').textContent='영상의 점 또는 아래 표의 행을 선택하세요.';return;}const a=row.answer,alternative=(a.top3_alternatives||[]).map(v=>`${esc(v.name)} ${pct(v.p)}`).join(' · ');$('point-details').innerHTML=`<div class="detail-grid"><span>점 #${row.index} · 좌표 ${row.xy_px.map(v=>v.toFixed(1)).join(', ')}</span><span>${row.forced_unknown?'마커 중 최고 후보':'Jev 선택'}: <b>${esc(a.choice)}</b></span><span>현재 상태: ${reasons[rowStatus(row)]}</span><span>이름 확률 <b>${pct(a.p)}</b></span><span>원응답 confidence ${pct(a.confidence)}</span><span>검출 확률 ${pct(row.detector_confidence)}</span></div><div>다른 마커 후보: ${alternative||'없음'}</div><div>${a.probability_domain==='point_for_marker'?'† 재검토: 해당 마커에 맞는 점을 고른 확률':'원래 이름 보류(unknown) 확률: '+pct(a.unknown_p)} · 이름 후보 간 1·2위 차이 ${pct(a.margin)}</div>${row.forced_unknown?'<div>? 원래 응답은 unknown이었으며, 마커 이름들 중 가장 높은 원래 확률로 후보를 표시했습니다. 원응답 confidence는 이 후보의 정답 확률이 아닙니다.</div>':''}`;}
  function setFrame(index,seek=true){state.index=Math.max(0,Math.min(refs.length-1,index));if(seek){const target=(state.index+.2)/fps;state.backgroundReady=false;state.pendingIndex=state.index;if(Math.abs(video.currentTime-target)<.001&&video.readyState>=2){state.pendingIndex=null;state.backgroundReady=true;}else video.currentTime=target;}refreshFrame();}
  function selectCamera(camera){if(camera===state.camera)return;const playing=!video.paused;state.camera=camera;state.selected=null;loadCamera(playing);refreshFrame();}
  function loadCamera(resume){video.pause();state.pendingIndex=state.index;state.backgroundReady=false;video.onloadedmetadata=()=>{const desiredIndex=state.pendingIndex===null?state.index:state.pendingIndex;state.index=desiredIndex;video.currentTime=(desiredIndex+.2)/fps;if(resume)video.play().catch(showPlaybackError);};video.src=`background/camera${state.camera.padStart(2,'0')}.mp4`;video.playbackRate=Number($('speed').value);video.load();}
  function showPlaybackError(){video.pause();$('play').textContent='재생';}
  function onVideoFrame(now,metadata){const next=Math.max(0,Math.min(refs.length-1,Math.floor(metadata.mediaTime*fps+1e-4)));if(video.readyState>=2&&!video.seeking&&(state.pendingIndex===null||next===state.pendingIndex)){state.pendingIndex=null;state.backgroundReady=true;if(next!==state.index){state.index=next;refreshFrame();}else draw2d();}video.requestVideoFrameCallback(onVideoFrame);}
  function bindEvents(){
    $('force-unknown').onchange=()=>{state.forceUnknown=$('force-unknown').checked;thresholdChanged();};
    $('active-threshold').oninput=()=>{state.probabilities[state.camera]=Number($('active-threshold').value);thresholdChanged();};
    for(const [button,view] of [['enlarge-two','two'],['enlarge-three','three']])$(button).onclick=()=>{const selected=$('views').dataset.focus==view;delete $('views').dataset.focus;if(!selected)$('views').dataset.focus=view;$('enlarge-two').textContent=$('views').dataset.focus==='two'?'함께 보기':'크게 보기';$('enlarge-three').textContent=$('views').dataset.focus==='three'?'함께 보기':'크게 보기';};
    $('answer-source').onchange=()=>{state.source=$('answer-source').value;$('review-note').hidden=state.source!=='effective';thresholdChanged();};
    $('detector').oninput=()=>{state.detector=Number($('detector').value);$('detector-value').textContent=pct(state.detector);thresholdChanged();};
    $('confidence').oninput=()=>{state.confidence=Number($('confidence').value);$('confidence-value').textContent=pct(state.confidence);thresholdChanged();};
    $('exclude-noise').onchange=()=>{state.excludeNoise=$('exclude-noise').checked;thresholdChanged();};
    $('crop').onchange=draw2d;$('connections').onchange=draw3d;$('names').onchange=draw3d;
    $('frame').oninput=()=>{video.pause();setFrame(Number($('frame').value));};
    $('previous').onclick=()=>{video.pause();setFrame(state.index-1);};$('next').onclick=()=>{video.pause();setFrame(state.index+1);};
    $('play').onclick=()=>{if(video.paused){if(video.ended||state.index===refs.length-1)video.currentTime=0;video.play().catch(showPlaybackError);}else video.pause();};
    $('speed').onchange=()=>video.playbackRate=Number($('speed').value);
    video.onplay=()=>$('play').textContent='일시 정지';video.onpause=()=>$('play').textContent='재생';
    video.onseeked=()=>{const actual=Math.min(refs.length-1,Math.floor(video.currentTime*fps+1e-4));if(state.pendingIndex===null||actual===state.pendingIndex){state.pendingIndex=null;state.backgroundReady=true;draw2d();}};video.onerror=()=>{$('error').hidden=false;$('error').textContent='배경 영상을 불러오지 못했습니다. 페이지를 새로 열어 주세요.';};
    if(!video.requestVideoFrameCallback)video.ontimeupdate=()=>{state.backgroundReady=true;const i=Math.min(refs.length-1,Math.floor(video.currentTime*fps+1e-4));if(i!==state.index){state.index=i;refreshFrame();}else draw2d();};
    canvas.onclick=e=>{const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*1600/rect.width,y=(e.clientY-rect.top)*1000/rect.height;const hits=state.hitPoints.map(p=>({...p,d:Math.hypot(x-p.x,y-p.y)})).sort((a,b)=>a.d-b.d);if(hits[0]&&hits[0].d<30){state.selected=hits[0].index;renderPointTable();draw2d();}};
    let drag=null;three.onpointerdown=e=>{drag=[e.clientX,e.clientY];three.setPointerCapture(e.pointerId);};three.onpointermove=e=>{if(!drag)return;state.yaw+=(e.clientX-drag[0])*.007;state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch+(e.clientY-drag[1])*.007));drag=[e.clientX,e.clientY];draw3d();};three.onpointerup=()=>drag=null;three.onpointercancel=()=>drag=null;
    three.onwheel=e=>{e.preventDefault();state.zoom=Math.max(.35,Math.min(4,state.zoom*Math.exp(-e.deltaY*.001)));draw3d();};
    $('reset-view').onclick=()=>{state.yaw=.5;state.pitch=.15;state.zoom=1;draw3d();};
    $('export-settings').onclick=()=>{const report={format:'jev_threshold_review_settings_v1',reference_frame:refs[state.index],reference_range:[refs[0],refs.at(-1)],jev_probability_threshold_by_camera:state.probabilities,additional_confidence_min:state.confidence,detector_min:state.detector,answer_source:state.source,unknown_policy:state.forceUnknown?'best_named_candidate':'preserve_unknown',recorded_noise_exclusion:state.excludeNoise,counts_by_camera:state.totals,current_frame_3d:state.reconstruction};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='jev_threshold_settings.json';a.click();URL.revokeObjectURL(url);};
  }
})();
