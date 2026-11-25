(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MarkerPlayback=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TIME_EPSILON=1e-7;

  function requireTimeline(frameCount,fps){
    if(!Number.isInteger(frameCount)||frameCount<1)throw new RangeError('frameCount must be a positive integer');
    if(!Number.isFinite(fps)||fps<=0)throw new RangeError('fps must be positive');
  }
  function frameAtTime(seconds,fps,frameCount){
    requireTimeline(frameCount,fps);
    if(!Number.isFinite(seconds))throw new RangeError('Time must be finite');
    return Math.max(0,Math.min(frameCount-1,Math.floor(seconds*fps+TIME_EPSILON)));
  }
  function normalizeRange(start,end,frameCount){
    if(!Number.isInteger(frameCount)||frameCount<1)throw new RangeError('frameCount must be a positive integer');
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>=frameCount||start>end)
      throw new RangeError('The inclusive range must contain valid frames in ascending order');
    return {startIndex:start,endIndex:end};
  }
  // Time fields describe [start,end), while frame endpoints are inclusive.
  // A "use this frame as end" button should supply (index+1)/fps.
  function rangeFromSeconds(startSeconds,endSeconds,fps,frameCount){
    requireTimeline(frameCount,fps);
    if(!Number.isFinite(startSeconds)||!Number.isFinite(endSeconds)||startSeconds<0||endSeconds<=startSeconds)
      throw new RangeError('The end time must be later than the start time');
    const duration=frameCount/fps;
    if(startSeconds>=duration||endSeconds>duration+TIME_EPSILON)
      throw new RangeError('The selected times must lie within the clip');
    const start=Math.max(0,Math.min(frameCount-1,Math.floor(startSeconds*fps+TIME_EPSILON)));
    const end=Math.max(start,Math.min(frameCount-1,Math.ceil(endSeconds*fps-TIME_EPSILON)-1));
    return normalizeRange(start,end,frameCount);
  }

  function create(options){
    if(!options||!options.video)throw new TypeError('A video element is required');
    const video=options.video,frameCount=options.frameCount,fps=options.fps;
    requireTimeline(frameCount,fps);
    if(typeof video.addEventListener!=='function'||typeof video.removeEventListener!=='function')
      throw new TypeError('The video must support events');
    let loop=!!options.loop,rangeEnabled=!!options.rangeEnabled,startIndex=0,endIndex=frameCount-1;
    let pending=null,playIntent=false,singleFrameHold=false,loopCount=0,lastError=null,destroyed=false;
    const requestWatch=options.requestAnimationFrame||(typeof requestAnimationFrame==='function'?requestAnimationFrame.bind(globalThis):null);
    const cancelWatch=options.cancelAnimationFrame||(typeof cancelAnimationFrame==='function'?cancelAnimationFrame.bind(globalThis):null);
    let watchHandle=null;
    const listeners=[];
    const bounds=()=>rangeEnabled?{startIndex,endIndex}:{startIndex:0,endIndex:frameCount-1};
    const observedIndex=()=>{
      const value=typeof options.getIndex==='function'?options.getIndex():null;
      return Number.isInteger(value)?Math.max(0,Math.min(frameCount-1,value)):frameAtTime(video.currentTime||0,fps,frameCount);
    };
    function getState(){
      const active=bounds();
      return {loop,rangeEnabled,startIndex,endIndex,activeStartIndex:active.startIndex,activeEndIndex:active.endIndex,
        frameCount,fps,rangeStartSeconds:startIndex/fps,rangeEndSeconds:(endIndex+1)/fps,
        activeDurationSeconds:(active.endIndex-active.startIndex+1)/fps,
        isPlaying:!video.paused,pendingSeek:pending?pending.target:null,holdingSingleFrame:singleFrameHold,
        loopCount,error:lastError};
    }
    function emit(){if(!destroyed&&typeof options.onChange==='function')options.onChange(getState());}
    function isPlaying(){return !video.paused||playIntent;}
    function safePlay(){
      if(destroyed)return Promise.reject(new Error('Playback controller was destroyed'));
      playIntent=true;lastError=null;
      let result;
      try{result=video.play();}catch(error){playIntent=false;lastError='playback_failed';emit();return Promise.reject(error);}
      return Promise.resolve(result).then(()=>{emit();return getState();},error=>{
        playIntent=false;lastError='playback_failed';emit();throw error;
      });
    }
    function finishSeek(){
      if(!pending||video.seeking)return false;
      const current=frameAtTime(video.currentTime||0,fps,frameCount);
      if(current!==pending.target)return false;
      const saved=pending;pending=null;
      const active=bounds();
      if(saved.resume&&(saved.target<active.startIndex||saved.target>active.endIndex)){
        seek(active.startIndex,true,'range_changed');return true;
      }
      if(saved.resume&&!singleFrameHold)safePlay().catch(()=>{});
      else playIntent=false;
      emit();return true;
    }
    function seek(index,resume,reason){
      if(destroyed)return;
      const target=Math.max(0,Math.min(frameCount-1,index));
      if(pending&&pending.target===target){pending.resume=!!resume;playIntent=!!resume;return;}
      pending={target,resume:!!resume,reason};playIntent=!!resume;
      if(reason==='loop')loopCount++;
      video.pause();
      if(typeof options.onSeek==='function')options.onSeek(target);
      else video.currentTime=(target+.2)/fps;
      if(!video.seeking&&video.readyState>=2)finishSeek();
      emit();
    }
    function pause(){
      playIntent=false;if(pending)pending.resume=false;
      video.pause();emit();return getState();
    }
    // Manual scrubbing and camera changes supersede an in-flight loop seek.
    // Clearing its target prevents the new decoded frame from being rejected
    // forever as a stale loop frame. cancelPending leaves video state alone;
    // prepareExternalSeek also pauses it for callers that want one operation.
    function cancelPending(){
      pending=null;playIntent=false;singleFrameHold=false;
      emit();return getState();
    }
    function prepareExternalSeek(){pause();return cancelPending();}
    function play(){
      const active=bounds(),index=observedIndex();
      singleFrameHold=active.startIndex===active.endIndex;
      if(singleFrameHold){seek(active.startIndex,false,'single_frame');video.pause();emit();return Promise.resolve(getState());}
      if(pending){pending.resume=true;playIntent=true;finishSeek();return Promise.resolve(getState());}
      if(video.ended||index<active.startIndex||index>=active.endIndex){seek(active.startIndex,true,'play_range_start');return Promise.resolve(getState());}
      return safePlay();
    }
    // Call before displaying a decoded frame. A false result suppresses stale
    // seek frames and frames outside the selected playback interval.
    function enforceFrame(index,mediaTime){
      if(destroyed)return true;
      if(!Number.isInteger(index))throw new RangeError('A decoded integer frame index is required');
      if(pending){
        if(index!==pending.target||video.seeking)return false;
        finishSeek();
      }
      if(!isPlaying())return true; // Paused scrubbing may inspect any frame.
      const active=bounds();
      if(active.startIndex===active.endIndex){singleFrameHold=true;seek(active.startIndex,false,'single_frame');return false;}
      if(index<active.startIndex){seek(active.startIndex,true,'before_range');return false;}
      const beyondTime=Number.isFinite(mediaTime)&&mediaTime>=(active.endIndex+1)/fps-TIME_EPSILON;
      if(index>active.endIndex||beyondTime){
        if(loop)seek(active.startIndex,true,'loop');else seek(active.endIndex,false,'range_end');
        return false;
      }
      return true;
    }
    function handleEnded(){
      if(destroyed||pending)return false;
      const active=bounds();
      if(loop&&active.startIndex!==active.endIndex){seek(active.startIndex,true,'loop');return false;}
      playIntent=false;
      if(observedIndex()!==active.endIndex)seek(active.endIndex,false,'ended');
      else emit();
      return false;
    }
    function setLoop(enabled){loop=!!enabled;emit();return getState();}
    function setRangeEnabled(enabled){
      rangeEnabled=!!enabled;singleFrameHold=false;
      if(isPlaying())enforceFrame(observedIndex(),video.currentTime);
      emit();return getState();
    }
    function setRange(start,end){
      const valid=normalizeRange(start,end,frameCount);startIndex=valid.startIndex;endIndex=valid.endIndex;singleFrameHold=false;
      if(rangeEnabled&&isPlaying())enforceFrame(observedIndex(),video.currentTime);
      emit();return getState();
    }
    // A hidden/background video may expose requestVideoFrameCallback while
    // not delivering decoded-frame callbacks regularly. Range enforcement
    // therefore also follows its actual media clock, independently of drawing.
    function monitorMediaTime(){
      if(destroyed||video.paused||video.seeking||video.readyState<2)return;
      const time=video.currentTime||0;
      enforceFrame(frameAtTime(time,fps,frameCount),time);
    }
    function stopWatch(){
      if(watchHandle!==null&&cancelWatch)cancelWatch(watchHandle);
      watchHandle=null;
    }
    function startWatch(){
      if(!requestWatch||destroyed||video.paused||watchHandle!==null)return;
      watchHandle=requestWatch(function(){
        watchHandle=null;monitorMediaTime();
        if(!destroyed&&!video.paused)startWatch();
      });
    }
    function add(type,handler){video.addEventListener(type,handler);listeners.push([type,handler]);}
    add('ended',handleEnded);
    add('seeked',finishSeek);
    add('timeupdate',monitorMediaTime);
    add('play',()=>{playIntent=true;startWatch();emit();});
    add('pause',()=>{playIntent=!!(pending&&pending.resume);stopWatch();emit();});
    function destroy(){destroyed=true;stopWatch();for(const [type,handler] of listeners)video.removeEventListener(type,handler);listeners.length=0;}
    return Object.freeze({setLoop,setRangeEnabled,setRange,play,pause,cancelPending,prepareExternalSeek,toggle:()=>isPlaying()?Promise.resolve(pause()):play(),
      enforceFrame,handleEnded,getState,destroy});
  }
  return Object.freeze({create,frameAtTime,normalizeRange,rangeFromSeconds});
});
