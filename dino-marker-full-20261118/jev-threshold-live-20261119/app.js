(async function(){
  'use strict';
  const $=id=>document.getElementById(id), video=$('background');
  const canvas=$('two-d'), ctx=canvas.getContext('2d'), three=$('three-d'), tctx=three.getContext('2d');
  const CAMERA_IDS=Array.from({length:8},(_,i)=>String(i+1));
  const partOrder=['MEPI','LEPI','PAT_INF','TIB_MID_LAT','MMA','LMA','NAV','HEE','P1M','D1M','D5M'];
  const pairs=[['MEPI','LEPI'],['MEPI','PAT_INF'],['LEPI','PAT_INF'],['LEPI','TIB_MID_LAT'],['TIB_MID_LAT','LMA'],['MEPI','MMA'],['MMA','LMA'],['LMA','HEE'],['MMA','HEE'],['HEE','P1M'],['P1M','D1M'],['D1M','D5M'],['D5M','HEE'],['NAV','P1M'],['NAV','MMA']];
  const reasons={accepted:'채택',detector:'검출 하한 미달',invalid:'판정 중',unknown:'Jev 이름 보류',no_named_evidence:'이름 확률 모두 0%',probability:'이름 확률 미달',confidence:'confidence 하한 미달',margin:'선택 확률 모순',duplicate:'동일 이름의 낮은 후보',camera_noise:'기록된 카메라 불일치',live_noise:'기존 합의의 카메라 대응 불일치'};
  const pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let DATA,CAL,META,refs,fps,colors,playback;
  let mediaEpoch=0,mediaExpectedSrc='',mediaNeedsSeek=false,mediaResume=false,mediaFrameRequest=null,mediaWatch=null,mediaError=false;
  const STORAGE_KEY='jev-marker-local-review-v2';
  const DATASET_ID='sha256:f3743d1c735073a0394c062871f5e7c31749237e8e34a095dda2852d2dc3197b';
  const state={camera:'1',index:0,probabilities:Object.fromEntries(CAMERA_IDS.map(c=>[c,.3])),confidence:0,detector:.425,source:'raw',excludeNoise:false,forceUnknown:true,cameraAgreementPx:24,reprojectionPx:16,selected:null,backgroundReady:false,pendingIndex:null,yaw:.5,pitch:.15,zoom:1,frameResults:{},reconstruction:null,hitPoints:[],totals:{},rawKey:null,processedKey:null,rawSequence:[],averageKey:null,averageSequence:[],previewSequence:[],cameraAverageMode:'off',demoSession:false,temporal:null,gapFill:true,gapLimit:8,gapDegree:3,smoothing:true,smoothingWindow:7,processingView:'overlay',loop:true,rangeEnabled:false,rangeStart:0,rangeEnd:134,rangeDraftStart:null,rangeDraftEnd:null};
  Object.assign(state,{manualFills:[],manualSmooths:[],editActions:[],manualSmoothWindow:7,manualSmoothMethod:'moving_average',fillSelection:null,fillMessage:'',fillMessageError:false});
  try {
    const responses=await Promise.all([fetch('viewer_data.json'),fetch('calibration.json')]);
    if(responses.some(r=>!r.ok))throw new Error('판정 자료를 불러오지 못했습니다.');
    [DATA,CAL]=await Promise.all(responses.map(r=>r.json()));META=DATA.meta;refs=META.frame_refs;fps=META.encoded_fps;colors=Object.fromEntries(META.marker_names.map(name=>[name,name.startsWith('R_')?'#d5a17e':'#83b4d5']));
    if(!Array.isArray(refs)||!refs.length||!window.ThresholdRules||!window.LiveMarkerReconstruction||!window.MarkerTemporal||!window.MarkerPlayback||!window.CameraAverage)throw new Error('필요한 계산 자료가 없습니다.');
    state.index=refs.includes(141)?refs.indexOf(141):0;
    state.rangeEnd=refs.length-1;restorePreferences();restoreEditorPreferences();applyPreviewUrl();
    $('frame').max=String(refs.length-1);$('frame').value=String(state.index);
    $('scope').textContent=`공유 영상의 2~6.5초 구간 · REF ${refs[0]}–${refs.at(-1)} · ${refs.length}프레임 · 0.5배속 재생 ${(refs.length/fps).toFixed(4)}초. 저장된 Jev 확률로 이름을 표시합니다.`;
    if(META.incomplete_preview){$('progress').hidden=false;$('progress').textContent='미리보기: 기존에 판정된 REF90–164는 바로 조절할 수 있습니다. 앞뒤 REF60–89·165–194의 추가 Jev 판정은 처리 중이며, 아직 판정이 없는 점은 이름을 붙이지 않았습니다.';}
    buildControls();bindEvents();syncTemporalControls();$('answer-source').value=state.source;$('review-note').hidden=state.source!=='effective';$('detector').value=String(state.detector);$('detector-value').textContent=pct(state.detector);$('confidence').value=String(state.confidence);$('confidence-value').textContent=pct(state.confidence);$('exclude-noise').checked=state.excludeNoise;$('force-unknown').checked=state.forceUnknown;
    if(state.savedViewPreferences){const v=state.savedViewPreferences;for(const [id,key] of [['names','names'],['connections','connections'],['crop','crop']])if(typeof v[key]==='boolean')$(id).checked=v[key];if(['0.5','1','2'].includes(v.speed))$('speed').value=v.speed;}
    $('trajectory-marker').innerHTML=META.marker_names.map(n=>`<option value="${n}"${n===(state.savedMarker||'R_HEE')?' selected':''}>${n}</option>`).join('');
    playback=MarkerPlayback.create({video,frameCount:refs.length,fps,onSeek:index=>setFrame(index,true,true),getIndex:()=>state.index,onChange:updatePlaybackStatus});
    playback.setRange(state.rangeStart,state.rangeEnd);playback.setLoop(state.loop);playback.setRangeEnabled(state.rangeEnabled);
    $('loop').checked=state.loop;$('range-enabled').checked=state.rangeEnabled;recomputeTotals();refreshFrame();loadCamera(false);
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
  function thresholdChanged(){recomputeTotals();refreshFrame();savePreferences();}
  function recomputeTotals(){
    state.totals={};for(const c of CAMERA_IDS){let named=0,detected=0;for(const ref of refs){const r=evaluate(c,ref);named+=r.accepted.length;detected+=r.rows.length;}state.totals[c]={named,detected};}
  }
  function refreshFrame(){
    const start=performance.now(),ref=refs[state.index];state.frameResults={};const inputs={};
    for(const c of CAMERA_IDS){const result=evaluate(c,ref);state.frameResults[c]=result;inputs[c]=result.accepted.map(p=>({...p,name:p.name,marker_name:p.name}));}
    ensureSequences();state.reconstruction=state.rawSequence[state.index];
    updateCameraCards();renderPointTable();renderGeometryTable();draw2d();draw3d();drawTrajectory();renderTemporalSummary();renderCameraAverageSummary();
    $('frame').value=String(state.index);
    $('frame-status').textContent=`REF ${ref} · ${state.index+1}/${refs.length}프레임 · 재생 ${(state.index/fps).toFixed(2)} / ${(refs.length/fps).toFixed(2)}초 · 공유 영상 ${(refs[0]/fps+state.index/fps).toFixed(2)}초`;
    $('compute-time').textContent=`화면 반영 ${(performance.now()-start).toFixed(1)}ms · 반복·후처리 변경은 API 호출 없음`;
  }
  function temporalOptions(){return {gapFillEnabled:state.gapFill,maxGapFrames:state.gapLimit,polynomialDegree:state.gapDegree,supportPerSide:4,smoothingEnabled:state.smoothing,smoothingWindow:state.smoothingWindow,smoothingDegree:2,sourceFps:META.source_fps,markerNames:META.marker_names,manualFills:state.manualFills,manualSmooths:state.manualSmooths};}
  function ensureSequences(){
    const key=JSON.stringify([state.probabilities,state.confidence,state.detector,state.source,state.excludeNoise,state.forceUnknown,state.cameraAgreementPx,state.reprojectionPx]);
    if(key!==state.rawKey){
      const next=refs.map(ref=>{const inputs={};for(const c of CAMERA_IDS)inputs[c]=evaluate(c,ref).accepted.map(p=>({...p,name:p.name,marker_name:p.name}));return {reference_frame:ref,...LiveMarkerReconstruction.reconstructFrame(inputs,CAL,{epipolarGatePx:state.cameraAgreementPx,maximumReprojectionPx:state.reprojectionPx})};});
      state.rawSequence=next;state.rawKey=key;state.averageKey=null;state.averageSequence=[];state.processedKey=null;
    }
    if(state.cameraAverageMode==='pair_mean'&&key!==state.averageKey){
      state.averageSequence=refs.map((ref,index)=>{const inputs={};for(const c of CAMERA_IDS)inputs[c]=evaluate(c,ref).accepted.map(p=>({...p,name:p.name,marker_name:p.name}));return {reference_frame:ref,...CameraAverage.previewFrame(inputs,CAL,state.rawSequence[index])};});
      state.averageKey=key;
    }
    state.previewSequence=state.cameraAverageMode==='pair_mean'?state.averageSequence:state.rawSequence;
    const processingKey=JSON.stringify([key,state.cameraAverageMode,temporalOptions()]);
    if(processingKey!==state.processedKey){
      state.temporal=MarkerTemporal.processSequence(state.previewSequence.map(f=>({reference_frame:f.reference_frame,points:f.points})),temporalOptions());
      // Temporal processing calls all its inputs observed. Camera-pair means are
      // derived previews, so retain their provenance instead of claiming a new observation.
      for(const frame of state.temporal.frames)for(const point of frame.points)if(point.is_camera_average){point.is_observed=false;point.is_derived=true;point.kind=point.is_smoothed?'smoothed_camera_pair_average':'camera_pair_average';}
      state.temporal.input_source=state.cameraAverageMode==='pair_mean'?'strict_consensus_with_same_marker_camera_pair_means':'strict_consensus';
      state.temporal.summary.processing_input_points=state.previewSequence.reduce((n,f)=>n+f.points.length,0);
      state.temporal.summary.original_observed_points_semantics='temporal_processing_input_count_before_gap_fill_not_a_verified_observation_count';
      state.temporal.summary.strict_observed_points=state.rawSequence.reduce((n,f)=>n+f.points.length,0);
      state.temporal.summary.camera_average_points=state.cameraAverageMode==='pair_mean'?state.averageSequence.reduce((n,f)=>n+(f.summary.averaged_points||0),0):0;
      state.processedKey=processingKey;
    }
  }
  function applyPreviewUrl(){
    const query=new URLSearchParams(location.search),mode=query.get('cameraAverage');
    if(query.get('averageDemo')==='1'){state.demoSession=true;state.probabilities=Object.fromEntries(CAMERA_IDS.map(c=>[c,.3]));state.confidence=0;state.detector=.425;state.source='raw';state.excludeNoise=false;state.forceUnknown=true;state.cameraAgreementPx=24;state.reprojectionPx=16;state.gapFill=false;state.smoothing=false;state.processingView='overlay';state.manualFills=[];state.manualSmooths=[];state.editActions=[];}
    if(mode==='pair_mean'||mode==='off'){state.cameraAverageMode=mode;if(mode==='pair_mean'){state.gapFill=false;state.smoothing=false;state.processingView='overlay';}}
    const ref=Number(query.get('ref'));if(query.has('ref')&&refs.includes(ref))state.index=refs.indexOf(ref);
    if(CAMERA_IDS.includes(query.get('camera')))state.camera=query.get('camera');
  }
  function cameraAverageExport(){return {format:'same_marker_camera_pair_average_preview_v1',mode:state.cameraAverageMode,only_markers_with_excluded_x_observations:true,different_marker_names_mixed:false,epipolar_and_reprojection_limits_applied_to_pair_means:false,raw_inputs_modified:false,frames:state.cameraAverageMode==='pair_mean'?state.averageSequence:[]};}
  function renderCameraAverageSummary(){
    const active=state.cameraAverageMode==='pair_mean';$('camera-average').checked=active;
    if(!active){$('camera-average-summary').textContent='평균 끔 · 기존 카메라 합의 좌표를 사용합니다.';return;}
    const frame=state.averageSequence[state.index],summary=frame.summary,mean=Number.isFinite(summary.mean_displacement_m)?(summary.mean_displacement_m*1000).toFixed(2):'—',maximum=Number.isFinite(summary.maximum_displacement_m)?(summary.maximum_displacement_m*1000).toFixed(2):'—';
    const total=state.averageSequence.reduce((n,f)=>n+(f.summary.averaged_points||0),0);
    $('camera-average-summary').textContent=`현재 평균 ${summary.averaged_points||0}개 · 유효 카메라 쌍 ${summary.valid_pairs||0}개(X 포함 ${summary.x_pairs||0}개) · 기존 대비 평균 이동 ${mean}mm / 최대 ${maximum}mm · 전체 구간 평균 ${total}점×프레임${state.processingView==='raw'?' · 현재 화면은 원래 3D만 표시 중':''}${state.manualFills.length||state.manualSmooths.length?' · 수동 편집도 처리 결과에 적용 중':''}${state.demoSession?' · 비교용 설정·편집은 JSON으로 저장(브라우저 저장값 유지)':''}`;
  }
  function syncTemporalControls(){
    $('gap-fill').checked=state.gapFill;$('gap-limit').value=String(state.gapLimit);$('gap-degree').value=String(state.gapDegree);$('smoothing').checked=state.smoothing;$('smooth-window').value=String(state.smoothingWindow);$('processing-view').value=state.processingView;$('camera-average').checked=state.cameraAverageMode==='pair_mean';
    $('processing-preset').value=state.gapFill?(state.smoothing?'both':'gap'):(state.smoothing?'smooth':'raw');
  }
  function renderTemporalSummary(){const s=state.temporal.summary;const duration=state.gapLimit/META.source_fps;$('temporal-summary').textContent=`전체 구간: ${state.cameraAverageMode==='pair_mean'?'평균 적용 입력':'원래 관측'} ${s.processing_input_points.toLocaleString()}개 + 보간 ${s.filled_points.toLocaleString()}개 = ${s.output_points.toLocaleString()}개 · 수동 보간 ${s.manual_filled_points||0}개 · S 스무딩 ${s.manual_smoothing_passes||0}회 · 남은 빈 점 ${s.remaining_missing_points.toLocaleString()}개 · 스무딩 관측 이동 RMS ${(s.rms_observed_displacement_m*1000).toFixed(2)}mm · 자동 최대 ${state.gapLimit}프레임(실제 ${duration.toFixed(3)}초 / 현재 반속 영상 ${(state.gapLimit/fps).toFixed(3)}초)`;}
  function exportPreferences(){return {viewPreferences:{names:$('names').checked,connections:$('connections').checked,crop:$('crop').checked,speed:$('speed').value},reference_frame:refs[state.index],camera:state.camera,probabilities:state.probabilities,confidence:state.confidence,detector:state.detector,source:state.source,excludeNoise:state.excludeNoise,forceUnknown:state.forceUnknown,cameraAgreementPx:state.cameraAgreementPx,reprojectionPx:state.reprojectionPx,cameraAverageMode:state.cameraAverageMode,gapFill:state.gapFill,gapLimit:state.gapLimit,gapDegree:state.gapDegree,smoothing:state.smoothing,smoothingWindow:state.smoothingWindow,processingView:state.processingView,loop:state.loop,rangeEnabled:state.rangeEnabled,rangeStart:state.rangeStart,rangeEnd:state.rangeEnd};}
  function savePreferences(){if(state.demoSession)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...exportPreferences(),manualFills:state.manualFills,manualSmooths:state.manualSmooths,editActions:state.editActions,manualSmoothWindow:state.manualSmoothWindow,manualSmoothMethod:state.manualSmoothMethod,editorMarker:$('trajectory-marker').value,editorDataset:DATASET_ID}));}catch(_){}}
  function restorePreferences(){try{const p=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!p)return;state.savedViewPreferences=p.viewPreferences||null;for(const c of CAMERA_IDS)if(p.probabilities&&Number.isFinite(p.probabilities[c])&&p.probabilities[c]>=0&&p.probabilities[c]<=1)state.probabilities[c]=p.probabilities[c];for(const key of ['gapFill','smoothing','loop','rangeEnabled','excludeNoise','forceUnknown'])if(typeof p[key]==='boolean')state[key]=p[key];for(const key of ['confidence','detector','cameraAgreementPx','reprojectionPx','gapLimit','gapDegree','smoothingWindow'])if(Number.isFinite(p[key]))state[key]=p[key];state.confidence=Math.max(0,Math.min(1,state.confidence));state.detector=Math.max(.425,Math.min(1,state.detector));state.cameraAgreementPx=Math.max(8,Math.min(48,state.cameraAgreementPx));state.reprojectionPx=Math.max(4,Math.min(32,state.reprojectionPx));state.gapLimit=Math.max(1,Math.min(30,Math.round(state.gapLimit)));state.gapDegree=Math.max(1,Math.min(3,Math.round(state.gapDegree)));if(![3,5,7,9,11,15,21].includes(state.smoothingWindow))state.smoothingWindow=7;if(['off','pair_mean'].includes(p.cameraAverageMode))state.cameraAverageMode=p.cameraAverageMode;if(['raw','effective'].includes(p.source))state.source=p.source;if(CAMERA_IDS.includes(p.camera))state.camera=p.camera;if(['raw','processed','overlay'].includes(p.processingView))state.processingView=p.processingView;if(refs.includes(p.reference_frame))state.index=refs.indexOf(p.reference_frame);if(Number.isInteger(p.rangeStart)&&Number.isInteger(p.rangeEnd)&&p.rangeStart>=0&&p.rangeEnd<refs.length&&p.rangeStart<=p.rangeEnd){state.rangeStart=p.rangeStart;state.rangeEnd=p.rangeEnd;}}catch(_){}}
  function updatePlaybackStatus(p){if(!p)return;const a=p.activeStartIndex,b=p.activeEndIndex;if(state.rangeDraftStart===null&&document.activeElement!==$('range-start'))$('range-start').value=(p.startIndex/fps).toFixed(4);if(state.rangeDraftEnd===null&&document.activeElement!==$('range-end'))$('range-end').value=((p.endIndex+1)/fps).toFixed(4);$('range-start').max=String(refs.length/fps);$('range-end').max=String(refs.length/fps);$('loop-status').textContent=`${p.rangeEnabled?'선택 구간':'전체 구간'} ${(a/fps).toFixed(2)}~${((b+1)/fps).toFixed(2)}초 · REF ${refs[a]}~${refs[b]} · ${p.loop?'반복 켜짐':'반복 꺼짐'}${p.holdingSingleFrame?' · 한 프레임 정지 표시':''} · 반복 ${p.loopCount}회`;}
  function applyRangeInputs({play=false}={}){try{const startText=$('range-start').value,endText=$('range-end').value;if(!startText.trim()||!endText.trim())throw new Error('Missing range');const start=state.rangeDraftStart===null&&Math.abs(Number(startText)-state.rangeStart/fps)<.000051?state.rangeStart/fps:Number(startText),end=state.rangeDraftEnd===null&&Math.abs(Number(endText)-(state.rangeEnd+1)/fps)<.000051?(state.rangeEnd+1)/fps:Number(endText),r=MarkerPlayback.rangeFromSeconds(start,end,fps,refs.length),resume=play||!video.paused;playback.prepareExternalSeek();state.rangeStart=r.startIndex;state.rangeEnd=r.endIndex;state.rangeDraftStart=null;state.rangeDraftEnd=null;state.rangeEnabled=true;state.loop=true;$('range-enabled').checked=true;$('loop').checked=true;playback.setRange(r.startIndex,r.endIndex);playback.setLoop(true);playback.setRangeEnabled(true);setFrame(r.startIndex,true,true);$('range-error').hidden=true;savePreferences();if(resume)playback.play().catch(showPlaybackError);return true;}catch(e){$('range-error').hidden=false;$('range-error').textContent='시작은 끝보다 앞이어야 하며, 현재 클립 시간 안에서 골라 주세요.';return false;}}
  function updateCameraCards(){
    for(const c of CAMERA_IDS){const t=state.totals[c],r=state.frameResults[c],candidates=r.rows.filter(p=>colors[p.name]).length;$(`p-value-${c}`).textContent=state.probabilities[c].toFixed(2);document.querySelector(`[data-threshold="${c}"]`).value=String(state.probabilities[c]);document.querySelector(`[data-card="${c}"]`).classList.toggle('selected',c===state.camera);$(`count-${c}`).textContent=`현재 채택 ${r.accepted.length}/${r.rows.length} · 이름 후보 ${candidates} · 구간 채택 ${t.named.toLocaleString()}/${t.detected.toLocaleString()}`;}
    $('camera-title').textContent=`CAM ${state.camera.padStart(2,'0')} · 이름과 선택확률`;
    $('active-threshold').value=String(state.probabilities[state.camera]);$('active-threshold-value').textContent=state.probabilities[state.camera].toFixed(2);
  }
  function noiseFor(camera,index){return state.reconstruction.noise_views.some(p=>String(p.camera)===camera&&Number(p.index)===index);}
  function rowStatus(row){return row.reason==='accepted'&&noiseFor(state.camera,row.index)?'live_noise':row.reason;}
  function renderGeometryTable(){
    const groups=new Map(state.reconstruction.groups.map(group=>[group.name||group.marker_name,group]));
    const counts={complete:0,support:0,matching:0,reprojection:0,geometry:0};
    function cameras(ids){return ids&&ids.length?ids.map(c=>`CAM ${String(c).padStart(2,'0')}`).join(', '):'—';}
    function reason(group){
      if(!group)return {kind:'support',text:'이름 문턱을 통과한 관측 없음'};
      const observed=group.observed_cameras||[];
      if(group.reconstruction_status==='reconstructed')return {kind:'complete',text:`3D 계산 완료 · ${(group.consensus_cameras||[]).length}대 · RMS ${Number(group.reprojection_rms_px).toFixed(2)} px`};
      if(observed.length<2)return {kind:'support',text:'같은 이름으로 관측한 카메라가 2대 미만'};
      if(group.reason==='no_compatible_two_camera_clique'){
        const distances=Object.values(group.pair_distances_px||{}).filter(Number.isFinite),closest=distances.length?Math.min(...distances):null;
        return {kind:'matching',text:`서로 위치가 맞는 카메라 쌍 없음${closest===null?'':` · 최소 대응 오차 ${closest.toFixed(1)} px`}`};
      }
      if(group.reason==='largest_camera_clique_tie')return {kind:'matching',text:'맞는 카메라 조합이 여럿이라 한 조합을 고를 수 없음'};
      if(group.reason==='duplicate_same_id_points_in_one_camera')return {kind:'matching',text:'한 카메라에서 같은 이름의 점이 중복됨'};
      const errors=Object.values(group.reprojection_errors_px||{}).filter(Number.isFinite),maximum=errors.length?Math.max(...errors):null;
      if(maximum!==null&&maximum>state.reprojectionPx)return {kind:'reprojection',text:`최종 오차 ${maximum.toFixed(2)} px > 허용 ${state.reprojectionPx} px`};
      if(Number.isFinite(group.minimum_depth_m)&&group.minimum_depth_m<=.05)return {kind:'geometry',text:'카메라 앞쪽의 유효한 위치로 계산되지 않음'};
      if(Number.isFinite(group.maximum_triangulation_angle_deg)&&group.maximum_triangulation_angle_deg<2)return {kind:'geometry',text:'두 카메라의 관측 방향이 너무 비슷함'};
      return {kind:'geometry',text:'위치 계산 조건을 충족하지 못함'};
    }
    $('geometry-table').innerHTML=META.marker_names.map(name=>{
      const group=groups.get(name),status=reason(group);counts[status.kind]++;
      const average=state.cameraAverageMode==='pair_mean'&&state.averageSequence[state.index].points.find(p=>p.name===name&&p.is_camera_average),excluded=group&&group.excluded_noise_cameras||[],filled=state.temporal.frames[state.index].points.some(p=>p.name===name&&p.is_gap_filled),detail=(excluded.length?`<small>기존 합의에서 × ${cameras(excluded)} 제외${average?' · 평균에는 포함':''}</small>`:'')+(filled?'<small>실제 3D 관측은 없으며 보간으로 채워 표시</small>':'')+(average?`<small>평균 후보 · ${average.camera_average.pair_count}개 카메라 쌍${Number.isFinite(average.camera_average.displacement_m)?' · 기존 대비 '+(average.camera_average.displacement_m*1000).toFixed(2)+'mm 이동':''}</small>`:'');
      return `<tr><td style="color:${colors[name]}">${esc(name)}</td><td>${cameras(group&&group.observed_cameras)}</td><td>${cameras(group&&group.consensus_cameras)}</td><td class="geometry-result-${status.kind}">${esc(status.text)}${detail}</td></tr>`;
    }).join('');
    $('geometry-summary').innerHTML=[['complete','3D 계산',counts.complete],['support','카메라 지원 부족',counts.support],['matching','카메라 대응 불일치·동률',counts.matching],['reprojection','최종 오차 초과',counts.reprojection],['geometry','기타 위치 계산 조건',counts.geometry]].map(([kind,label,count])=>`<span class="geometry-chip geometry-result-${kind}">${label} <b>${count}</b></span>`).join('');
    $('camera-agreement').value=String(state.cameraAgreementPx);$('camera-agreement-value').textContent=`${state.cameraAgreementPx} px`;
    $('reprojection').value=String(state.reprojectionPx);$('reprojection-value').textContent=`${state.reprojectionPx} px`;
  }
  function draw2d(){
    ctx.fillStyle='#080f18';ctx.fillRect(0,0,canvas.width,canvas.height);state.hitPoints=[];
    const record=frameRecord(state.camera),result=state.frameResults[state.camera],ref=refs[state.index];canvas.dataset.referenceFrame=String(ref);canvas.dataset.sourceFrame=String(record.source_frame);canvas.dataset.camera=state.camera;canvas.dataset.backgroundReady=String(state.backgroundReady&&video.readyState>=2);
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
    const result=state.reconstruction,raw=result.points||[],processed=state.temporal.frames[state.index].points,points=state.processingView==='raw'?raw:processed,ghost=state.processingView==='overlay'?raw:[];tctx.fillStyle='#0b1726';tctx.fillRect(0,0,1200,1000);tctx.fillStyle='#a7bbd1';tctx.font='23px sans-serif';tctx.fillText(`REF ${refs[state.index]} · ${state.processingView==='raw'?'원래 3D':state.processingView==='overlay'?'처리 결과 + 원래 좌표':'처리 결과'}`,25,38);
    const n2=raw.filter(p=>p.view_count===2).length,noise=result.noise_views.length,filled=points.filter(p=>p.is_gap_filled).length,averaged=points.filter(p=>p.is_camera_average).length;three.dataset.referenceFrame=String(refs[state.index]);three.dataset.cameraAverage=state.cameraAverageMode;three.dataset.processingView=state.processingView;three.dataset.averageCount=String(averaged);three.dataset.rawCount=String(raw.length);three.dataset.viewOrigin='';three.dataset.viewSpan='';three.dataset.pixelsPerMeter='';
    $('three-d-status').textContent=`표시 ${points.length}/22개 · 기존 합의 ${raw.length}개 · X 포함 평균 ${averaged}개 · 보간 ${filled}개 · 원관측 2시점 ${n2} / 3시점 이상 ${raw.length-n2} · 기존 합의에서 X 관측 ${noise}개 제외`;
    if(!points.length){tctx.fillStyle='#a8b9cf';tctx.font='28px sans-serif';tctx.fillText('현재 조건에서 재구성할 점이 없습니다.',190,470);return;}
    const coords=[...raw,...processed].map(p=>p.xyz),min=[0,1,2].map(i=>Math.min(...coords.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...coords.map(p=>p[i]))),origin=min.map((v,i)=>(v+max[i])/2),span=Math.max(.85,...max.map((v,i)=>v-min[i]))*1.35;
    const scale=750/span*state.zoom;three.dataset.viewOrigin=JSON.stringify(origin);three.dataset.viewSpan=String(span);three.dataset.pixelsPerMeter=String(scale);const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const project=p=>{const d=p.map((v,i)=>v-origin[i]),x=cy*d[0]+sy*d[2],z=-sy*d[0]+cy*d[2],y=cp*d[1]-sp*z;return [600+x*scale,520+y*scale,z];};
    tctx.strokeStyle='#263b50';tctx.lineWidth=1;for(let g=-3;g<=3;g++){const a=project([origin[0]-.75,origin[1]+g*.25,origin[2]]),b=project([origin[0]+.75,origin[1]+g*.25,origin[2]]);tctx.beginPath();tctx.moveTo(a[0],a[1]);tctx.lineTo(b[0],b[1]);tctx.stroke();}
    for(const point of ghost){const [x,y]=project(point.xyz);tctx.strokeStyle='#c4c9d2';tctx.lineWidth=2;tctx.globalAlpha=.65;tctx.beginPath();tctx.arc(x,y,10,0,Math.PI*2);tctx.stroke();tctx.globalAlpha=1;}
    const lookup=new Map(points.map(p=>[p.name,p]));let edgeCount=0;
    tctx.setLineDash([]);if($('connections').checked)for(const side of ['R','L'])for(const [a,b] of pairs){const pa=lookup.get(`${side}_${a}`),pb=lookup.get(`${side}_${b}`);if(!pa||!pb)continue;const x=project(pa.xyz),y=project(pb.xyz);tctx.strokeStyle=colors[pa.name];tctx.lineWidth=4;tctx.beginPath();tctx.moveTo(x[0],x[1]);tctx.lineTo(y[0],y[1]);tctx.stroke();edgeCount++;}
    for(const point of [...points].sort((a,b)=>project(a.xyz)[2]-project(b.xyz)[2])){const [x,y]=project(point.xyz);tctx.fillStyle=colors[point.name]||'#fff';tctx.beginPath();tctx.arc(x,y,7,0,Math.PI*2);tctx.fill();tctx.strokeStyle='#07111c';tctx.lineWidth=2;tctx.stroke();if($('names').checked){const candidate=(point.cameras||[]).some(c=>state.frameResults[c].accepted.some(r=>r.name===point.name&&r.forced_unknown));tctx.font='21px sans-serif';tctx.fillText(point.name+(point.is_camera_average?' ≈':'')+(candidate?' ?':'')+(!point.is_gap_filled&&point.view_count===2?' *2':''),x+10,y-10);}}
    tctx.font='20px sans-serif';tctx.fillStyle='#9fb5cc';tctx.fillText(`실제 마커 연결 ${edgeCount}개 · 표시 격자 0.25m · 바닥 정렬 아님`,25,970);
  }
  function drawTrajectory(){
    if(!state.temporal)return;const c=$('trajectory'),g=c.getContext('2d'),name=$('trajectory-marker').value,axis=Number($('trajectory-axis').value),delta=$('trajectory-mode').value==='displacement';
    renderFillEditor();
    const raw=state.rawSequence.map(f=>f.points.find(p=>p.name===name)||null),processed=state.temporal.frames.map(f=>f.points.find(p=>p.name===name)||null);
    const a=raw.map(p=>p?(delta?0:p.xyz[axis]):null),b=processed.map((p,i)=>p?(delta?(raw[i]?(p.xyz[axis]-raw[i].xyz[axis])*1000:null):p.xyz[axis]):null),all=[...a,...b].filter(Number.isFinite);
    g.fillStyle='#0b1726';g.fillRect(0,0,1600,360);if(!all.length){g.fillStyle='#b7c9df';g.font='23px sans-serif';g.fillText('이 마커의 관측이 없습니다.',35,150);$('trajectory-status').textContent='이 마커의 원래 관측과 처리 좌표가 없습니다.';return;}
    let low=Math.min(...all),high=Math.max(...all);if(high-low<1e-6){low-=delta?1:.005;high+=delta?1:.005;}const pad=(high-low)*.13;low-=pad;high+=pad;
    const x=i=>90+i/(refs.length-1)*1465,y=v=>300-(v-low)/(high-low)*245;
    const selection=state.fillSelection;if(selection&&selection.marker===name){const left=x(selection.startIndex),right=x(selection.endIndex);g.fillStyle='rgba(131,180,213,0.16)';g.fillRect(left,42,Math.max(3,right-left),263);g.strokeStyle=colors[name];g.lineWidth=1;g.strokeRect(left,42,Math.max(3,right-left),263);}
    g.font='20px sans-serif';g.fillStyle='#a7bbd1';for(let k=0;k<=4;k++){const v=low+(high-low)*k/4;g.strokeStyle='#263b50';g.beginPath();g.moveTo(85,y(v));g.lineTo(1560,y(v));g.stroke();g.fillText(v.toFixed(delta?2:3),8,y(v)+7);}
    for(let k=0;k<=4;k++){const t=refs.length/fps*k/4;g.fillText(t.toFixed(2)+'s',Math.min(1500,x((refs.length-1)*k/4)),335);}
    function line(values,color,width){g.strokeStyle=color;g.lineWidth=width;g.beginPath();let open=false;values.forEach((v,i)=>{if(!Number.isFinite(v)){open=false;return;}if(open)g.lineTo(x(i),y(v));else {g.moveTo(x(i),y(v));open=true;}});g.stroke();}
    line(a,'#bdc4ce',2);line(b,colors[name],3);
    g.strokeStyle='#c5e5ff';g.lineWidth=1;g.setLineDash([6,5]);g.beginPath();g.moveTo(x(state.index),42);g.lineTo(x(state.index),305);g.stroke();g.setLineDash([]);g.fillStyle='#c7d9ee';g.fillText(`${name} · ${delta?'원관측 대비 변화량(mm)':['X','Y','Z'][axis]+' 좌표(m)'}`,90,27);
    const p=processed[state.index],r=raw[state.index];$('trajectory-status').textContent=`현재 ${name}: ${r?'원래 관측 있음':'원래 관측 없음'} · ${p?(p.is_gap_filled?'보간으로 채움':p.is_camera_average?(p.is_smoothed?'카메라 쌍 평균 + 스무딩':'카메라 쌍 평균'):p.is_smoothed?'스무딩 적용':'원래 좌표'):'빈 구간 유지'}${p&&r?' · 3D 이동 '+(Math.hypot(...p.xyz.map((v,j)=>v-r.xyz[j]))*1000).toFixed(2)+'mm':''}`;
  }
  function validatedEdits(edits){
    if(!Array.isArray(edits)||edits.length>500)throw new Error('편집 목록을 확인할 수 없습니다.');
    const ids=new Set();return edits.map(edit=>{if(!edit||typeof edit.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(edit.id)||ids.has(edit.id)||!META.marker_names.includes(edit.marker)||!Number.isInteger(edit.start_ref)||!Number.isInteger(edit.end_ref)||edit.start_ref<refs[0]||edit.end_ref>refs.at(-1)||edit.start_ref>edit.end_ref||![1,2,3].includes(edit.degree))throw new Error('유효하지 않은 마커 또는 편집 구간입니다.');ids.add(edit.id);return {id:edit.id,marker:edit.marker,start_ref:edit.start_ref,end_ref:edit.end_ref,degree:edit.degree};});
  }
  function validatedSmoothEdits(edits){
    if(!Array.isArray(edits)||edits.length>500)throw new Error('스무딩 목록을 확인할 수 없습니다.');
    const ids=new Set();return edits.map(edit=>{if(!edit||typeof edit.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(edit.id)||ids.has(edit.id)||!META.marker_names.includes(edit.marker)||!Number.isInteger(edit.start_ref)||!Number.isInteger(edit.end_ref)||edit.start_ref<refs[0]||edit.end_ref>refs.at(-1)||edit.start_ref>edit.end_ref||![3,5,7,9,11,15,21].includes(edit.window)||edit.degree!==2||!['moving_average','local_polynomial'].includes(edit.method))throw new Error('유효하지 않은 스무딩 설정입니다.');ids.add(edit.id);return {id:edit.id,marker:edit.marker,start_ref:edit.start_ref,end_ref:edit.end_ref,method:edit.method,window:edit.window,degree:2};});
  }
  function validatedActions(actions,fills,smooths){const all=[...fills.map(e=>({kind:'fill',id:e.id})),...smooths.map(e=>({kind:'smooth',id:e.id}))];if(actions===undefined)return all;if(!Array.isArray(actions)||actions.length!==all.length)throw new Error('편집 순서가 올바르지 않습니다.');const remaining=new Set(all.map(e=>e.kind+':'+e.id));return actions.map(a=>{const key=a&&a.kind+':'+a.id;if(!remaining.delete(key))throw new Error('편집 순서가 올바르지 않습니다.');return {kind:a.kind,id:a.id};});}
  function restoreEditorPreferences(){try{const p=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!p)return;if(p.editorDataset===DATASET_ID){state.manualFills=validatedEdits(p.manualFills||[]);state.manualSmooths=validatedSmoothEdits(p.manualSmooths||[]);state.editActions=validatedActions(p.editActions,state.manualFills,state.manualSmooths);}if([3,5,7,9,11,15,21].includes(p.manualSmoothWindow))state.manualSmoothWindow=p.manualSmoothWindow;if(['moving_average','local_polynomial'].includes(p.manualSmoothMethod))state.manualSmoothMethod=p.manualSmoothMethod;if(META.marker_names.includes(p.editorMarker))state.savedMarker=p.editorMarker;}catch(_){state.manualFills=[];state.manualSmooths=[];state.editActions=[];}}
  function gapReason(reason){return ({gap_filling_disabled:'자동 보간 꺼짐',gap_longer_than_limit:'자동 길이 제한 초과',insufficient_local_observed_support:'주변 연속 관측 부족',unbounded_leading_or_trailing_gap:'한쪽 끝 관측 없음',partial_gap_not_selected:'빈 구간 전체를 선택해 주세요',insufficient_original_observed_support:'양쪽 실제 관측 부족',insufficient_observed_support:'양쪽 실제 관측 부족',no_missing_gap_in_selection:'선택 안에 빈 구간 없음',rank_deficient_local_polynomial:'다항식 계산에 필요한 관측 부족'})[reason]||reason||'보간 조건 확인';}
  function renderFillEditor(){
    const name=$('trajectory-marker').value,selection=state.fillSelection,active=selection&&selection.marker===name;
    $('fill-selection-status').textContent=active?`${name} · 선택 REF ${refs[selection.startIndex]}–${refs[selection.endIndex]} · ${(selection.startIndex/fps).toFixed(3)}~${((selection.endIndex+1)/fps).toFixed(3)}초 · ${selection.endIndex-selection.startIndex+1}프레임`:'마커를 고른 뒤 그래프에서 구간을 드래그하고 F 또는 S를 누르세요.';
    for(const id of ['fill-start','fill-end'])$(id).max=String(refs.length/fps);
    if(active){if(document.activeElement!==$('fill-start'))$('fill-start').value=(selection.startIndex/fps).toFixed(4);if(document.activeElement!==$('fill-end'))$('fill-end').value=((selection.endIndex+1)/fps).toFixed(4);}
    $('fill-apply').disabled=!active;$('smooth-apply').disabled=!active;$('fill-undo').disabled=!state.editActions.length;$('manual-smooth-window').value=String(state.manualSmoothWindow);$('manual-smooth-method').value=state.manualSmoothMethod;
    $('fill-result').textContent=state.fillMessage;$('fill-result').classList.toggle('input-warning',state.fillMessageError);
    const gaps=(state.temporal.per_marker[name]||{}).gaps||[],pending=gaps.filter(g=>{const a=refs.indexOf(g.start_ref),b=refs.indexOf(g.end_ref);return state.temporal.frames.slice(a,b+1).some(f=>!f.points.some(p=>p.name===name));});
    $('fill-gap-status').textContent=pending.length?pending.map(g=>`REF ${g.start_ref}–${g.end_ref}: ${g.frame_count}프레임 · ${gapReason(g.reason)}`).join(' / '):'이 마커에 남은 빈 구간이 없습니다.';
    const fills=new Map(state.manualFills.map(e=>[e.id,e])),smooths=new Map(state.manualSmooths.map(e=>[e.id,e])),receipts=state.temporal.manual_receipts||[],smoothReceipts=state.temporal.manual_smoothing_receipts||[];
    $('fill-history').textContent=state.editActions.map((action,i)=>{const edit=(action.kind==='fill'?fills:smooths).get(action.id),receipt=(action.kind==='fill'?receipts:smoothReceipts).find(r=>r.id===action.id);if(!edit)return '';return `${i+1}. ${edit.marker} · REF ${edit.start_ref}–${edit.end_ref} · ${action.kind==='fill'?`${edit.degree}차 보간 · ${receipt?receipt.active_points||0:0}개 적용`:`S 스무딩 · ${edit.method==='moving_average'?'이동평균':'다항식'} ${edit.window}프레임 · ${receipt?receipt.applied_points||0:0}개 처리`}`;}).join('\n');
    const passes=state.manualSmooths.filter(e=>e.marker===name),selectedPasses=active?passes.filter(e=>e.start_ref===refs[selection.startIndex]&&e.end_ref===refs[selection.endIndex]):[];$('smooth-pass-status').textContent=`${name}: 수동 스무딩 ${passes.length}회${active?` · 이 선택 구간 ${selectedPasses.length}회`:''} · S를 누를 때마다 현재 결과에 한 번 더 적용`;
  }
  function selectFillRange(startIndex,endIndex){const a=Math.max(0,Math.min(refs.length-1,Math.round(startIndex))),b=Math.max(0,Math.min(refs.length-1,Math.round(endIndex)));state.fillSelection={marker:$('trajectory-marker').value,startIndex:Math.min(a,b),endIndex:Math.max(a,b)};state.fillMessage='';state.fillMessageError=false;drawTrajectory();}
  function selectFillInputs(){try{const a=$('fill-start').value,b=$('fill-end').value;if(!a.trim()||!b.trim())throw new Error('Missing range');const r=MarkerPlayback.rangeFromSeconds(Number(a),Number(b),fps,refs.length);selectFillRange(r.startIndex,r.endIndex);return true;}catch(_){state.fillMessage='현재 클립 안에서 시작·끝 시간을 골라 주세요.';state.fillMessageError=true;renderFillEditor();return false;}}
  function selectNextGap(){const name=$('trajectory-marker').value,gaps=((state.temporal.per_marker[name]||{}).gaps||[]).filter(g=>g.start_ref>refs[0]&&g.end_ref<refs.at(-1)&&state.temporal.frames.slice(g.start_ref-refs[0],g.end_ref-refs[0]+1).some(f=>!f.points.some(p=>p.name===name)));if(!gaps.length){state.fillMessage='양쪽 실제 관측 사이에 남은 빈 구간이 없습니다.';state.fillMessageError=false;renderFillEditor();return;}const from=state.fillSelection&&state.fillSelection.marker===name?refs[state.fillSelection.endIndex]+1:refs[state.index],gap=gaps.find(g=>g.end_ref>=from)||gaps[0];selectFillRange(refs.indexOf(gap.start_ref),refs.indexOf(gap.end_ref));}
  function applyManualFill(){
    const selection=state.fillSelection;if(!selection||selection.marker!==$('trajectory-marker').value){state.fillMessage='그래프에서 빈 구간 전체를 먼저 선택해 주세요.';state.fillMessageError=true;renderFillEditor();return;}
    playback.pause();const edit={id:`fill-${Date.now()}-${state.manualFills.length}`,marker:selection.marker,start_ref:refs[selection.startIndex],end_ref:refs[selection.endIndex],degree:state.gapDegree};
    state.manualFills.push(edit);ensureSequences();const receipt=(state.temporal.manual_receipts||[]).find(r=>r.id===edit.id);
    if(!receipt||!receipt.filled_points){state.manualFills.pop();ensureSequences();const reasons=receipt&&(receipt.gaps||[]).map(g=>gapReason(g.reason));state.fillMessage='채우지 못했습니다: '+(reasons&&reasons.length?[...new Set(reasons)].join(' · '):gapReason(receipt&&receipt.reason));state.fillMessageError=true;}
    else{state.editActions.push({kind:'fill',id:edit.id});state.processingView='processed';syncTemporalControls();state.fillMessage=`${edit.marker} · ${receipt.filled_points}개 보간 완료 · 원래 관측은 보존했습니다.`+(receipt.status==='partial'?' 선택 구간의 일부는 조건을 만족하지 않아 남았습니다.':'');state.fillMessageError=false;}
    refreshFrame();savePreferences();
  }
  function applyManualSmooth(){
    const selection=state.fillSelection;if(!selection||selection.marker!==$('trajectory-marker').value){state.fillMessage='그래프에서 스무딩할 구간을 먼저 선택해 주세요.';state.fillMessageError=true;renderFillEditor();return;}
    playback.pause();const edit={id:`smooth-${Date.now()}-${state.manualSmooths.length}`,marker:selection.marker,start_ref:refs[selection.startIndex],end_ref:refs[selection.endIndex],method:state.manualSmoothMethod,window:state.manualSmoothWindow,degree:2};
    state.manualSmooths.push(edit);ensureSequences();const receipt=(state.temporal.manual_smoothing_receipts||[]).find(r=>r.id===edit.id);
    if(!receipt||!receipt.applied_points){state.manualSmooths.pop();ensureSequences();state.fillMessage='스무딩할 연속 좌표가 부족합니다. 빈 구간은 F로 먼저 채우거나 관측이 있는 구간을 선택해 주세요.';state.fillMessageError=true;}
    else{state.editActions.push({kind:'smooth',id:edit.id});state.processingView='processed';syncTemporalControls();const count=state.manualSmooths.filter(e=>e.marker===edit.marker&&e.start_ref===edit.start_ref&&e.end_ref===edit.end_ref).length;state.fillMessage=`${edit.marker} · 선택 구간 S ${count}회 · ${receipt.applied_points}개 스무딩 · 이번 변화 RMS ${(receipt.rms_displacement_m*1000).toFixed(3)}mm`;state.fillMessageError=false;}
    refreshFrame();savePreferences();
  }
  function undoManualFill(){if(!state.editActions.length)return;const action=state.editActions.pop(),edits=action.kind==='fill'?state.manualFills:state.manualSmooths,index=edits.findIndex(e=>e.id===action.id),edit=edits[index];if(index>=0)edits.splice(index,1);state.fillMessage=`${edit?edit.marker:'마커'}의 마지막 ${action.kind==='fill'?'수동 보간을':'S 스무딩 1회를'} 되돌렸습니다.`;state.fillMessageError=false;refreshFrame();savePreferences();}
  function editSession(){return {format:'jev_marker_edit_session_v1',dataset_id:DATASET_ID,units:'m',preferences:exportPreferences(),manual_edits:state.manualFills,manual_smoothing_edits:state.manualSmooths,edit_actions:state.editActions,editor_options:{manualSmoothWindow:state.manualSmoothWindow,manualSmoothMethod:state.manualSmoothMethod},selected_marker:$('trajectory-marker').value,raw_frames:state.rawSequence.map(f=>({reference_frame:f.reference_frame,points:f.points})),camera_average_preview:cameraAverageExport(),processed:state.temporal};}
  function downloadFile(contents,name,type){const blob=new Blob([contents],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  function saveEditSession(){downloadFile(JSON.stringify(editSession(),null,2),'jev_marker_edited_session.json','application/json');state.fillMessage='편집 설정·원본·처리 좌표를 JSON 파일로 저장했습니다.';state.fillMessageError=false;renderFillEditor();}
  function saveEditedCsv(){
    const lines=['reference_frame,clip_time_seconds,marker,x_m,y_m,z_m,raw_x_m,raw_y_m,raw_z_m,is_observed,is_gap_filled,is_manual_fill,is_smoothed,manual_edit_id,is_manual_smoothed,manual_smoothing_id,is_camera_average,average_pair_count,average_camera_ids,average_x_camera_ids,average_displacement_mm,average_pair_spread_mm'];
    for(let i=0;i<refs.length;i++){const points=new Map(state.temporal.frames[i].points.map(p=>[p.name,p])),raw=new Map(state.rawSequence[i].points.map(p=>[p.name,p]));for(const name of META.marker_names){const p=points.get(name),original=raw.get(name),average=p&&p.camera_average;lines.push([refs[i],(i/fps).toFixed(6),name,...(p?p.xyz:['','','']),...(original?original.xyz:['','','']),p?Number(!!p.is_observed):0,p?Number(!!p.is_gap_filled):0,p?Number(!!p.manual_gap_fill):0,p?Number(!!p.is_smoothed):0,p&&p.manual_edit_id||'',p?Number(!!p.manual_smoothing):0,p&&p.manual_smoothing_id||'',p?Number(!!p.is_camera_average):0,average?average.pair_count:'',average?average.cameras.join('|'):'',average?average.excluded_noise_cameras.join('|'):'',average&&Number.isFinite(average.displacement_m)?average.displacement_m*1000:'',average&&Number.isFinite(average.rms_spread_m)?average.rms_spread_m*1000:''].join(','));}}
    downloadFile('\ufeff'+lines.join('\r\n'),'jev_marker_edited_coordinates.csv','text/csv;charset=utf-8');state.fillMessage='3D 좌표와 기존 원본·평균·보간·스무딩 구분을 CSV 파일로 저장했습니다.';state.fillMessageError=false;renderFillEditor();
  }
  async function loadEditSession(file){
    if(!file)return;try{if(file.size>30_000_000)throw new Error('파일이 너무 큽니다.');const session=JSON.parse(await file.text());if(session.format!=='jev_marker_edit_session_v1'||session.dataset_id!==DATASET_ID)throw new Error('현재 영상에서 저장한 편집 JSON 파일을 골라 주세요.');const edits=validatedEdits(session.manual_edits),smooths=validatedSmoothEdits(session.manual_smoothing_edits||[]),actions=validatedActions(session.edit_actions,edits,smooths),preferences=session.preferences;if(!preferences||typeof preferences!=='object')throw new Error('설정 정보가 없습니다.');playback.prepareExternalSeek();localStorage.setItem(STORAGE_KEY,JSON.stringify({...preferences,...session.editor_options,manualFills:edits,manualSmooths:smooths,editActions:actions,editorDataset:DATASET_ID,editorMarker:session.selected_marker}));restorePreferences();restoreEditorPreferences();for(const [id,key] of [['answer-source','source'],['detector','detector'],['confidence','confidence'],['camera-agreement','cameraAgreementPx'],['reprojection','reprojectionPx']])$(id).value=String(state[key]);$('exclude-noise').checked=state.excludeNoise;$('force-unknown').checked=state.forceUnknown;$('detector-value').textContent=pct(state.detector);$('confidence-value').textContent=pct(state.confidence);$('review-note').hidden=state.source!=='effective';if(state.savedViewPreferences){const v=state.savedViewPreferences;for(const id of ['names','connections','crop'])if(typeof v[id]==='boolean')$(id).checked=v[id];if(['0.5','1','2'].includes(v.speed))$('speed').value=v.speed;}$('trajectory-marker').value=state.savedMarker||'R_HEE';state.fillSelection=null;state.processingView='processed';syncTemporalControls();playback.setRange(state.rangeStart,state.rangeEnd);playback.setLoop(state.loop);playback.setRangeEnabled(state.rangeEnabled);$('loop').checked=state.loop;$('range-enabled').checked=state.rangeEnabled;recomputeTotals();refreshFrame();loadCamera(false);state.fillMessage=`수동 보간 ${edits.length}건 · S 스무딩 ${smooths.length}회와 저장한 설정을 불러왔습니다.`;state.fillMessageError=false;renderFillEditor();savePreferences();}catch(error){state.fillMessage=error.message||'편집 파일을 읽지 못했습니다.';state.fillMessageError=true;renderFillEditor();}
  }
  function bindFillEditor(){
    const plot=$('trajectory');let drag=null;const frameFromEvent=e=>{const rect=plot.getBoundingClientRect(),x=(e.clientX-rect.left)*plot.width/rect.width;return Math.max(0,Math.min(refs.length-1,Math.round((x-90)/1465*(refs.length-1))));};
    plot.onpointerdown=e=>{if(e.button!==0)return;playback.pause();plot.focus();plot.setPointerCapture(e.pointerId);drag={pointerId:e.pointerId,start:frameFromEvent(e)};selectFillRange(drag.start,drag.start);e.preventDefault();};
    plot.onpointermove=e=>{if(drag&&e.pointerId===drag.pointerId)selectFillRange(drag.start,frameFromEvent(e));};plot.onpointerup=e=>{if(!drag||e.pointerId!==drag.pointerId)return;selectFillRange(drag.start,frameFromEvent(e));drag=null;};plot.onpointercancel=()=>drag=null;
    const keyHandler=e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;if(e.target&&(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.target.isContentEditable))return;if(e.code==='KeyF'||String(e.key).toLowerCase()==='f'){e.preventDefault();applyManualFill();}else if(e.code==='KeyS'||String(e.key).toLowerCase()==='s'){e.preventDefault();applyManualSmooth();}};document.addEventListener('keydown',keyHandler);
    $('fill-apply').onclick=applyManualFill;$('smooth-apply').onclick=applyManualSmooth;$('manual-smooth-window').onchange=()=>{state.manualSmoothWindow=Number($('manual-smooth-window').value);savePreferences();};$('manual-smooth-method').onchange=()=>{state.manualSmoothMethod=$('manual-smooth-method').value;savePreferences();};$('fill-undo').onclick=undoManualFill;$('fill-next-gap').onclick=selectNextGap;$('fill-select').onclick=selectFillInputs;$('fill-clear').onclick=()=>{state.fillSelection=null;state.fillMessage='';drawTrajectory();};$('fill-save').onclick=saveEditSession;$('fill-save-csv').onclick=saveEditedCsv;$('fill-load').onchange=async()=>{await loadEditSession($('fill-load').files[0]);$('fill-load').value='';};
  }
  function renderPointTable(){
    const rows=state.frameResults[state.camera].rows;
    $('point-table').innerHTML=rows.map(r=>{const status=rowStatus(r),name=r.name==='pending'?'판정 중':r.name==='no_named_evidence'?'이름 확률 모두 0%':r.name||'unknown';return `<tr data-point="${r.index}" class="${r.index===state.selected?'selected':''}"><td>#${r.index}</td><td style="color:${colors[r.name]||'#acb7c4'}">${esc(name)}${r.forced_unknown&&colors[r.name]?' ?':''}${r.review&&state.source==='effective'?' †':''}</td><td>${pct(r.probability)}</td><td>${pct(r.model_confidence)}</td><td>${pct(r.detector_confidence)}</td><td class="status-${status}">${reasons[status]}</td></tr>`;}).join('');
    $('point-table').querySelectorAll('[data-point]').forEach(tr=>tr.onclick=()=>{state.selected=Number(tr.dataset.point);renderPointTable();draw2d();});renderDetails();
  }
  function renderDetails(){const row=state.frameResults[state.camera].rows.find(r=>r.index===state.selected);if(!row){$('point-details').textContent='영상의 점 또는 아래 표의 행을 선택하세요.';return;}const a=row.answer,alternative=(a.top3_alternatives||[]).map(v=>`${esc(v.name)} ${pct(v.p)}`).join(' · ');$('point-details').innerHTML=`<div class="detail-grid"><span>점 #${row.index} · 좌표 ${row.xy_px.map(v=>v.toFixed(1)).join(', ')}</span><span>${row.forced_unknown?'마커 중 최고 후보':'Jev 선택'}: <b>${esc(a.choice)}</b></span><span>현재 상태: ${reasons[rowStatus(row)]}</span><span>이름 확률 <b>${pct(a.p)}</b></span><span>원응답 confidence ${pct(a.confidence)}</span><span>검출 확률 ${pct(row.detector_confidence)}</span></div><div>다른 마커 후보: ${alternative||'없음'}</div><div>${a.probability_domain==='point_for_marker'?'† 재검토: 해당 마커에 맞는 점을 고른 확률':'원래 이름 보류(unknown) 확률: '+pct(a.unknown_p)} · 이름 후보 간 1·2위 차이 ${pct(a.margin)}</div>${row.forced_unknown?'<div>? 원래 응답은 unknown이었으며, 마커 이름들 중 가장 높은 원래 확률로 후보를 표시했습니다. 원응답 confidence는 이 후보의 정답 확률이 아닙니다.</div>':''}`;}
  function setFrame(index,seek=true,fromController=false){
    if(seek&&!fromController){mediaResume=false;if(playback)playback.prepareExternalSeek();}
    state.index=Math.max(0,Math.min(refs.length-1,index));
    if(seek){
      const target=(state.index+.2)/fps;state.backgroundReady=false;state.pendingIndex=state.index;
      if(!mediaNeedsSeek&&video.readyState>=1){
        if(Math.abs(video.currentTime-target)<.001&&video.readyState>=2&&!video.seeking)presentMediaFrame();
        else video.currentTime=target;
      }
      watchMediaReady(mediaEpoch);
    }
    refreshFrame();if(!fromController)savePreferences();
  }
  function selectCamera(camera){if(camera===state.camera)return;const p=playback&&playback.getState(),playing=mediaResume||!video.paused||!!(p&&p.pendingSeek!==null&&!p.holdingSingleFrame);state.camera=camera;state.selected=null;loadCamera(playing);refreshFrame();savePreferences();}
  function mediaIndex(time=video.currentTime){return Math.max(0,Math.min(refs.length-1,Math.floor(time*fps+1e-4)));}
  function matchingMedia(epoch){return epoch===mediaEpoch&&(!video.currentSrc||video.currentSrc===mediaExpectedSrc);}
  function clearMediaWatch(){if(mediaWatch!==null&&typeof clearTimeout==='function')clearTimeout(mediaWatch);mediaWatch=null;}
  function presentMediaFrame(index,mediaTime,epoch=mediaEpoch){
    if(!matchingMedia(epoch)||mediaNeedsSeek||video.seeking||video.readyState<2)return false;
    const actual=mediaIndex();
    // A queued decoded-frame callback can still describe the frame before a
    // seek. The media clock is authoritative for readiness events and seeks.
    if(index===undefined||state.pendingIndex!==null){index=actual;mediaTime=video.currentTime;}
    else if(Math.abs(index-actual)>1)return false;
    if(playback&&!playback.enforceFrame(index,mediaTime))return false;
    state.pendingIndex=null;state.backgroundReady=true;clearMediaWatch();
    if(mediaError){mediaError=false;$('error').hidden=true;}
    if(index!==state.index){state.index=index;refreshFrame();}else draw2d();
    // Resume only after the requested camera frame exists. Starting playback
    // in loadedmetadata could skip the exact pending frame before seeked ran.
    if(mediaResume){mediaResume=false;Promise.resolve(playback?playback.play():video.play()).catch(showPlaybackError);}
    return true;
  }
  function seekLoadedMedia(epoch){
    if(!matchingMedia(epoch)||!mediaNeedsSeek||video.readyState<1)return;
    const desired=state.pendingIndex===null?state.index:state.pendingIndex;
    state.index=desired;mediaNeedsSeek=false;
    const target=(desired+.2)/fps;
    if(Math.abs(video.currentTime-target)>=.001||video.readyState<2)video.currentTime=target;
    presentMediaFrame(undefined,undefined,epoch);
  }
  function watchMediaReady(epoch,attempt=0){
    clearMediaWatch();
    if(epoch!==mediaEpoch)return;
    seekLoadedMedia(epoch);
    if(presentMediaFrame(undefined,undefined,epoch))return;
    if(typeof setTimeout!=='function')return;
    if(attempt>=80){mediaError=true;mediaResume=false;state.pendingIndex=null;video.pause();$('error').hidden=false;$('error').textContent=`CAM ${state.camera.padStart(2,'0')} 영상을 아직 불러오지 못했습니다. 다른 카메라를 선택한 뒤 다시 선택해 주세요.`;return;}
    mediaWatch=setTimeout(()=>{mediaWatch=null;watchMediaReady(epoch,attempt+1);},150);
  }
  function requestMediaFrame(epoch){
    if(!video.requestVideoFrameCallback||epoch!==mediaEpoch)return;
    mediaFrameRequest=video.requestVideoFrameCallback((now,metadata)=>onVideoFrame(now,metadata,epoch));
  }
  function loadCamera(resume){
    if(playback)playback.prepareExternalSeek();else video.pause();
    const epoch=++mediaEpoch;clearMediaWatch();if(mediaError){mediaError=false;$('error').hidden=true;}
    if(mediaFrameRequest!==null&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(mediaFrameRequest);
    mediaFrameRequest=null;mediaResume=!!resume;mediaNeedsSeek=true;
    state.pendingIndex=state.index;state.backgroundReady=false;
    video.onloadedmetadata=()=>seekLoadedMedia(epoch);
    video.onloadeddata=video.oncanplay=()=>{seekLoadedMedia(epoch);presentMediaFrame(undefined,undefined,epoch);};
    video.src=`background/camera${state.camera.padStart(2,'0')}.mp4?v=byte-ranges-1`;mediaExpectedSrc=video.src;
    video.playbackRate=Number($('speed').value);video.load();requestMediaFrame(epoch);watchMediaReady(epoch);
  }
  function showPlaybackError(){video.pause();$('play').textContent='재생';}
  function onVideoFrame(now,metadata,epoch){if(epoch!==mediaEpoch)return;mediaFrameRequest=null;presentMediaFrame(mediaIndex(metadata.mediaTime),metadata.mediaTime,epoch);requestMediaFrame(epoch);}
  function bindEvents(){
    bindFillEditor();
    $('camera-agreement').oninput=()=>{state.cameraAgreementPx=Number($('camera-agreement').value);refreshFrame();savePreferences();};
    $('reprojection').oninput=()=>{state.reprojectionPx=Number($('reprojection').value);refreshFrame();savePreferences();};
    function temporalChanged(){syncTemporalControls();$('temporal-error').hidden=true;refreshFrame();savePreferences();}
    $('camera-average').onchange=()=>{state.cameraAverageMode=$('camera-average').checked?'pair_mean':'off';if(state.cameraAverageMode==='pair_mean'&&state.processingView==='raw')state.processingView='overlay';temporalChanged();};
    $('camera-average-demo').onclick=()=>{state.cameraAverageMode='pair_mean';state.gapFill=false;state.smoothing=false;state.processingView='overlay';temporalChanged();};
    $('processing-preset').onchange=()=>{const value=$('processing-preset').value;state.gapFill=value==='gap'||value==='both';state.smoothing=value==='smooth'||value==='both';if(value!=='raw'&&state.processingView==='raw')state.processingView='overlay';temporalChanged();};
    $('gap-fill').onchange=()=>{state.gapFill=$('gap-fill').checked;temporalChanged();};$('smoothing').onchange=()=>{state.smoothing=$('smoothing').checked;temporalChanged();};
    $('gap-limit').onchange=()=>{const value=Number($('gap-limit').value);if(!Number.isInteger(value)||value<1||value>30){$('temporal-error').hidden=false;$('temporal-error').textContent='최대 누락은 1~30프레임 중에서 골라 주세요.';return;}state.gapLimit=value;temporalChanged();};
    $('gap-degree').onchange=()=>{state.gapDegree=Number($('gap-degree').value);temporalChanged();};$('smooth-window').onchange=()=>{state.smoothingWindow=Number($('smooth-window').value);temporalChanged();};$('processing-view').onchange=()=>{state.processingView=$('processing-view').value;draw3d();renderCameraAverageSummary();savePreferences();};
    $('trajectory-marker').onchange=()=>{state.fillSelection=null;state.fillMessage='';drawTrajectory();savePreferences();};for(const id of ['trajectory-axis','trajectory-mode'])$(id).onchange=drawTrajectory;
    $('loop').onchange=()=>{state.loop=$('loop').checked;playback.setLoop(state.loop);savePreferences();};$('range-enabled').onchange=()=>{if($('range-enabled').checked){if(!applyRangeInputs())$('range-enabled').checked=state.rangeEnabled;}else{state.rangeEnabled=false;playback.setRangeEnabled(false);savePreferences();}};
    for(const id of ['range-start','range-end']){const draft=()=>{state[id==='range-start'?'rangeDraftStart':'rangeDraftEnd']=$(id).value;};$(id).oninput=draft;$(id).onchange=draft;$(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applyRangeInputs({play:true});}};}$('range-apply').onclick=()=>applyRangeInputs();$('range-play').onclick=()=>applyRangeInputs({play:true});
    function commitRange(){state.rangeDraftStart=null;state.rangeDraftEnd=null;state.rangeEnabled=true;state.loop=true;$('range-enabled').checked=true;$('loop').checked=true;playback.setRange(state.rangeStart,state.rangeEnd);playback.setLoop(true);playback.setRangeEnabled(true);$('range-error').hidden=true;savePreferences();}
    $('range-start-now').onclick=()=>{state.rangeStart=state.index;state.rangeEnd=Math.max(state.rangeStart,state.rangeEnd);commitRange();};$('range-end-now').onclick=()=>{state.rangeEnd=state.index;state.rangeStart=Math.min(state.rangeStart,state.rangeEnd);commitRange();};
    $('range-reset').onclick=()=>{state.rangeStart=0;state.rangeEnd=refs.length-1;state.rangeDraftStart=null;state.rangeDraftEnd=null;state.rangeEnabled=false;$('range-enabled').checked=false;playback.setRange(0,refs.length-1);playback.setRangeEnabled(false);$('range-error').hidden=true;savePreferences();};
    $('force-unknown').onchange=()=>{state.forceUnknown=$('force-unknown').checked;thresholdChanged();};
    $('active-threshold').oninput=()=>{state.probabilities[state.camera]=Number($('active-threshold').value);thresholdChanged();};
    for(const [button,view] of [['enlarge-two','two'],['enlarge-three','three']])$(button).onclick=()=>{const selected=$('views').dataset.focus==view;delete $('views').dataset.focus;if(!selected)$('views').dataset.focus=view;$('enlarge-two').textContent=$('views').dataset.focus==='two'?'함께 보기':'크게 보기';$('enlarge-three').textContent=$('views').dataset.focus==='three'?'함께 보기':'크게 보기';};
    $('answer-source').onchange=()=>{state.source=$('answer-source').value;$('review-note').hidden=state.source!=='effective';thresholdChanged();};
    $('detector').oninput=()=>{state.detector=Number($('detector').value);$('detector-value').textContent=pct(state.detector);thresholdChanged();};
    $('confidence').oninput=()=>{state.confidence=Number($('confidence').value);$('confidence-value').textContent=pct(state.confidence);thresholdChanged();};
    $('exclude-noise').onchange=()=>{state.excludeNoise=$('exclude-noise').checked;thresholdChanged();};
    $('crop').onchange=()=>{draw2d();savePreferences();};$('connections').onchange=()=>{draw3d();savePreferences();};$('names').onchange=()=>{draw3d();savePreferences();};
    $('frame').oninput=()=>setFrame(Number($('frame').value));
    $('previous').onclick=()=>setFrame(state.index-1);$('next').onclick=()=>setFrame(state.index+1);
    $('play').onclick=()=>{if(video.paused&&(state.rangeDraftStart!==null||state.rangeDraftEnd!==null)){applyRangeInputs({play:true});return;}playback.toggle().catch(showPlaybackError);};
    $('speed').onchange=()=>{video.playbackRate=Number($('speed').value);savePreferences();};
    video.onplay=()=>{if(mediaNeedsSeek){mediaResume=true;video.pause();return;}$('play').textContent='일시 정지';};video.onpause=()=>{$('play').textContent='재생';savePreferences();};
    video.onseeked=()=>presentMediaFrame();
    video.onerror=()=>{mediaError=true;mediaResume=false;state.pendingIndex=null;video.pause();clearMediaWatch();$('error').hidden=false;$('error').textContent='배경 영상을 불러오지 못했습니다. 다른 카메라를 선택한 뒤 다시 선택해 주세요.';};
    video.ontimeupdate=()=>presentMediaFrame();
    canvas.onclick=e=>{const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*1600/rect.width,y=(e.clientY-rect.top)*1000/rect.height;const hits=state.hitPoints.map(p=>({...p,d:Math.hypot(x-p.x,y-p.y)})).sort((a,b)=>a.d-b.d);if(hits[0]&&hits[0].d<30){state.selected=hits[0].index;renderPointTable();draw2d();}};
    let drag=null;three.onpointerdown=e=>{drag=[e.clientX,e.clientY];three.setPointerCapture(e.pointerId);};three.onpointermove=e=>{if(!drag)return;state.yaw+=(e.clientX-drag[0])*.007;state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch+(e.clientY-drag[1])*.007));drag=[e.clientX,e.clientY];draw3d();};three.onpointerup=()=>drag=null;three.onpointercancel=()=>drag=null;
    three.onwheel=e=>{e.preventDefault();state.zoom=Math.max(.35,Math.min(4,state.zoom*Math.exp(-e.deltaY*.001)));draw3d();};
    $('reset-view').onclick=()=>{state.yaw=.5;state.pitch=.15;state.zoom=1;draw3d();};
    function settingsExport(){return {format:'jev_threshold_review_settings_v2',reference_frame:refs[state.index],reference_range:[refs[0],refs.at(-1)],jev_probability_threshold_by_camera:state.probabilities,additional_confidence_min:state.confidence,detector_min:state.detector,answer_source:state.source,unknown_policy:state.forceUnknown?'best_named_candidate':'preserve_unknown',recorded_noise_exclusion:state.excludeNoise,epipolar_gate_native_px:state.cameraAgreementPx,maximum_reprojection_native_px:state.reprojectionPx,temporal_options:temporalOptions(),camera_average_mode:state.cameraAverageMode,preview_demo_session:state.demoSession,camera_average_policy:{same_marker_only:true,only_x_groups:true,epipolar_and_reprojection_limits_applied:false},current_frame_camera_average:state.cameraAverageMode==='pair_mean'?state.averageSequence[state.index]:null,processing_view:state.processingView,playback:playback.getState(),counts_by_camera:state.totals,current_frame_3d:state.reconstruction,current_frame_processed:state.temporal.frames[state.index]};}
    function download(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
    $('export-settings').onclick=()=>download(settingsExport(),'jev_threshold_settings.json');
    $('export-trajectories').onclick=()=>download({settings:settingsExport(),raw_frames:state.rawSequence.map(f=>({reference_frame:f.reference_frame,points:f.points})),camera_average_preview:cameraAverageExport(),processed:state.temporal},'jev_3d_raw_and_processed.json');
  }
})();
