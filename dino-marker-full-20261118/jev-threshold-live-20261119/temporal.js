(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MarkerTemporal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var DEFAULTS=Object.freeze({gapFillEnabled:false,maxGapFrames:8,polynomialDegree:3,
    supportPerSide:4,smoothingEnabled:false,smoothingWindow:7,smoothingDegree:2,
    sourceFps:60000/1001,manualFills:Object.freeze([]),manualSmooths:Object.freeze([])});
  function clone(value){
    if(Array.isArray(value))return value.map(clone);
    if(value&&typeof value==='object'){var out={};Object.keys(value).forEach(function(k){out[k]=clone(value[k]);});return out;}
    return value;
  }
  function xyzOf(point){var xyz=point.xyz||point.world_xyz_m;return Array.isArray(xyz)&&xyz.length===3&&xyz.every(Number.isFinite)?xyz:null;}
  function settings(raw){
    var o=Object.assign({},DEFAULTS,raw||{});
    ['gapFillEnabled','smoothingEnabled'].forEach(function(k){if(typeof o[k]!=='boolean')throw new Error('Invalid temporal option: '+k);});
    [['maxGapFrames',0,135],['polynomialDegree',1,5],['supportPerSide',2,20],['smoothingWindow',3,101],['smoothingDegree',0,5]].forEach(function(spec){
      var v=o[spec[0]];if(!Number.isInteger(v)||v<spec[1]||v>spec[2])throw new Error('Invalid temporal option: '+spec[0]);
    });
    if(o.smoothingWindow%2!==1||o.smoothingDegree>=o.smoothingWindow)throw new Error('Smoothing requires an odd window larger than its polynomial degree');
    if(typeof o.sourceFps!=='number'||!Number.isFinite(o.sourceFps)||o.sourceFps<=0)throw new Error('Invalid source frame rate');
    if(!Array.isArray(o.manualFills))throw new Error('Manual fills must be an explicit edit array');
    if(!Array.isArray(o.manualSmooths))throw new Error('Manual smoothing must be an explicit edit array');
    return o;
  }
  function norm(v){return Math.sqrt(v.reduce(function(s,x){return s+x*x;},0));}
  function dot(a,b){return a.reduce(function(s,x,i){return s+x*b[i];},0);}
  // Modified Gram-Schmidt QR with re-orthogonalization on centered, scaled
  // times. Small degree <=5 avoids the unstable normal-equations fit.
  function localPolynomial(support,queryRef,degree){
    if(support.length<degree+1)return null;
    var scale=Math.max.apply(null,support.map(function(p){return Math.abs(p.ref-queryRef);}));
    if(!Number.isFinite(scale)||scale===0)return null;
    var xs=support.map(function(p){return (p.ref-queryRef)/scale;}),q=[],r=[];
    for(var j=0;j<=degree;j++){
      var column=xs.map(function(x){return Math.pow(x,j);});r[j]=Array(degree+1).fill(0);
      for(var pass=0;pass<2;pass++)for(var k=0;k<j;k++){
        var projection=dot(q[k],column);r[k][j]+=projection;
        column=column.map(function(x,i){return x-projection*q[k][i];});
      }
      var length=norm(column);if(!Number.isFinite(length)||length<1e-12)return null;
      r[j][j]=length;q[j]=column.map(function(x){return x/length;});
    }
    var result=[];
    for(var axis=0;axis<3;axis++){
      var y=support.map(function(p){return p.xyz[axis];}),rhs=q.map(function(v){return dot(v,y);}),coefficients=Array(degree+1).fill(0);
      for(j=degree;j>=0;j--){var sum=rhs[j];for(k=j+1;k<=degree;k++)sum-=r[j][k]*coefficients[k];coefficients[j]=sum/r[j][j];}
      result.push(coefficients[0]);
    }
    return result.every(Number.isFinite)?result:null;
  }
  function runs(values,valid){
    var result=[];for(var i=0;i<values.length;){if(!valid(values[i])){i++;continue;}var start=i;while(i+1<values.length&&valid(values[i+1]))i++;result.push([start,i]);i++;}return result;
  }
  function manualRequests(edits,names,refs,defaultDegree){
    var seen=new Set();
    return edits.map(function(edit){
      var e=edit&&typeof edit==='object'?edit:{},receipt={id:e.id===undefined?null:e.id,marker:e.marker===undefined?null:e.marker,
        start_ref:e.start_ref===undefined?null:e.start_ref,end_ref:e.end_ref===undefined?null:e.end_ref,
        degree:e.degree===undefined?defaultDegree:e.degree,status:'pending',reason:null,filled_points:0,newly_filled_points:0,
        replaced_estimated_points:0,active_points:0,observed_points_modified:0,support_used_original_observations_only:true,gaps:[]};
      var reason=null;
      if(typeof receipt.id!=='string'||!receipt.id.trim()||receipt.id.length>256)reason='invalid_edit_id';
      else if(seen.has(receipt.id))reason='duplicate_edit_id';
      else seen.add(receipt.id);
      if(!reason&&(typeof receipt.marker!=='string'||!names.has(receipt.marker)))reason='unknown_marker';
      if(!reason&&(!Number.isInteger(receipt.start_ref)||!Number.isInteger(receipt.end_ref)||receipt.start_ref>receipt.end_ref))reason='invalid_selection';
      if(!reason&&(!refs.length||receipt.start_ref<refs[0]||receipt.end_ref>refs[refs.length-1]))reason='selection_outside_sequence';
      if(!reason&&(!Number.isInteger(receipt.degree)||receipt.degree<1||receipt.degree>5))reason='invalid_polynomial_degree';
      if(reason){receipt.status='rejected';receipt.reason=reason;}
      return receipt;
    });
  }
  function manualSmoothingRequests(edits,names,refs){
    var seen=new Set();
    return edits.map(function(edit){
      var e=edit&&typeof edit==='object'?edit:{},receipt={id:e.id===undefined?null:e.id,marker:e.marker===undefined?null:e.marker,
        start_ref:e.start_ref===undefined?null:e.start_ref,end_ref:e.end_ref===undefined?null:e.end_ref,
        method:e.method===undefined?'moving_average':e.method,window:e.window===undefined?7:e.window,degree:e.degree===undefined?2:e.degree,
        status:'pending',reason:null,applied_points:0,changed_points:0,active_points:0,observed_points:0,estimated_points:0,
        rms_displacement_m:0,maximum_displacement_m:0,writes_outside_selection:0,support_used_current_processed_points:true,runs:[]};
      var reason=null;
      if(typeof receipt.id!=='string'||!receipt.id.trim()||receipt.id.length>256)reason='invalid_edit_id';
      else if(seen.has(receipt.id))reason='duplicate_edit_id';
      else seen.add(receipt.id);
      if(!reason&&(typeof receipt.marker!=='string'||!names.has(receipt.marker)))reason='unknown_marker';
      if(!reason&&(!Number.isInteger(receipt.start_ref)||!Number.isInteger(receipt.end_ref)||receipt.start_ref>receipt.end_ref))reason='invalid_selection';
      if(!reason&&(!refs.length||receipt.start_ref<refs[0]||receipt.end_ref>refs[refs.length-1]))reason='selection_outside_sequence';
      if(!reason&&receipt.method!=='moving_average'&&receipt.method!=='local_polynomial')reason='invalid_smoothing_method';
      if(!reason&&(!Number.isInteger(receipt.window)||receipt.window<3||receipt.window>101||receipt.window%2!==1))reason='invalid_smoothing_window';
      if(!reason&&(!Number.isInteger(receipt.degree)||receipt.degree<0||receipt.degree>5||
        (receipt.method==='local_polynomial'&&receipt.degree>=receipt.window)))reason='invalid_polynomial_degree';
      if(reason){receipt.status='rejected';receipt.reason=reason;}
      return receipt;
    });
  }
  function processSequence(rawFrames,options){
    var o=settings(options);
    if(!Array.isArray(rawFrames))throw new Error('Raw frame sequence must be an array');
    var refs=rawFrames.map(function(f){return f.reference_frame!==undefined?f.reference_frame:f.referenceFrame;});
    refs.forEach(function(ref,i){if(!Number.isInteger(ref)||(i&&ref!==refs[i-1]+1))throw new Error('Temporal processing needs consecutive integer reference frames');});
    var names=new Set(Array.isArray(o.markerNames)?o.markerNames:[]),byMarker={},originalCount=0;
    rawFrames.forEach(function(frame,index){
      if(!Array.isArray(frame.points))throw new Error('Each frame needs an explicit point array');
      var seen=new Set();frame.points.forEach(function(point){
        var name=point.name||point.marker_name,xyz=xyzOf(point);
        if(point.is_gap_filled===true||point.manual_gap_fill===true||point.kind==='gap_filled'||point.is_smoothed===true||point.manual_smoothing===true)
          throw new Error('Temporal processing requires original observations, not previously estimated or smoothed points');
        if(typeof name!=='string'||!name||seen.has(name)||!xyz)throw new Error('Invalid, duplicate, or nonfinite observed marker');
        seen.add(name);names.add(name);if(!byMarker[name])byMarker[name]=Array(rawFrames.length).fill(null);
        var copy=clone(point);copy.name=name;copy.kind='observed';copy.is_observed=true;copy.is_gap_filled=false;copy.is_smoothed=false;
        copy.raw_xyz=xyz.slice();copy.xyz=xyz.slice();copy.processed_xyz=xyz.slice();
        if(Object.prototype.hasOwnProperty.call(copy,'world_xyz_m'))copy.world_xyz_m=xyz.slice();
        byMarker[name][index]=copy;originalCount++;
      });
    });
    var manualReceipts=manualRequests(o.manualFills,names,refs,o.polynomialDegree);
    var manualSmoothingReceipts=manualSmoothingRequests(o.manualSmooths,names,refs);
    var summary={frame_count:rawFrames.length,marker_count:names.size,original_observed_points:originalCount,
      original_missing_points:rawFrames.length*names.size-originalCount,filled_points:0,filled_gaps:0,
      remaining_missing_points:0,smoothed_points:0,smoothed_observed_points:0,smoothed_filled_points:0,
      changed_observed_points:0,rms_observed_displacement_m:0,maximum_observed_displacement_m:0,
      leading_or_trailing_gaps_never_filled:true,original_observed_coordinates_changed_by_gap_fill:0,
      original_inputs_modified:false,manual_edit_requests:manualReceipts.length,manual_applied_edits:0,manual_active_edit_ids:[],
      manual_filled_points:0,manual_newly_filled_points:0,manual_replaced_automatic_points:0,automatic_filled_points:0,
      manual_smoothing_requests:manualSmoothingReceipts.length,manual_smoothing_applied_edits:0,manual_smoothing_passes:0,
      manual_smoothing_points:0,manual_smoothing_application_points:0,manual_smoothing_active_edit_ids:[],
      options:clone(o)},perMarker={};
    names.forEach(function(name){
      var track=byMarker[name]||Array(rawFrames.length).fill(null),original=track.slice();byMarker[name]=track;
      var stats={observed_points:original.filter(Boolean).length,original_missing_points:original.filter(function(p){return !p;}).length,
        filled_points:0,filled_gaps:0,smoothed_points:0,remaining_missing_points:0,gaps:[]};perMarker[name]=stats;
      var rawGapRanges=runs(original,function(p){return !p;});
      rawGapRanges.forEach(function(range){
        var a=range[0],b=range[1],length=b-a+1,receipt={start_ref:refs[a],end_ref:refs[b],frame_count:length,filled:false};stats.gaps.push(receipt);
        if(a===0||b===track.length-1){receipt.reason='unbounded_leading_or_trailing_gap';return;}
        if(!o.gapFillEnabled){receipt.reason='gap_filling_disabled';return;}
        if(length>o.maxGapFrames){receipt.reason='gap_longer_than_limit';return;}
        var left=[],right=[];
        for(var i=a-1;i>=0&&original[i]&&left.length<o.supportPerSide;i--)left.unshift({ref:refs[i],xyz:original[i].raw_xyz});
        for(i=b+1;i<original.length&&original[i]&&right.length<o.supportPerSide;i++)right.push({ref:refs[i],xyz:original[i].raw_xyz});
        receipt.support_refs_left=left.map(function(p){return p.ref;});receipt.support_refs_right=right.map(function(p){return p.ref;});
        if(left.length<2||right.length<2||left.length+right.length<o.polynomialDegree+1){receipt.reason='insufficient_local_observed_support';return;}
        var support=left.concat(right),predictions=[];
        for(i=a;i<=b;i++){var fit=localPolynomial(support,refs[i],o.polynomialDegree);if(!fit){receipt.reason='rank_deficient_local_polynomial';return;}predictions.push(fit);}
        if(predictions.length!==length)return;
        for(i=a;i<=b;i++){
          var xyz=predictions[i-a];track[i]={name:name,marker_name:name,reference_frame:refs[i],xyz:xyz.slice(),world_xyz_m:xyz.slice(),processed_xyz:xyz.slice(),raw_xyz:null,
            kind:'gap_filled',is_observed:false,is_gap_filled:true,is_smoothed:false,cameras:[],support_cameras:[],view_count:0,observations:[],
            gap_fill:{method:'local_polynomial_least_squares',degree:o.polynomialDegree,gap_start_ref:refs[a],gap_end_ref:refs[b],gap_frames:length,
              gap_duration_source_seconds:length/o.sourceFps,support_refs_left:receipt.support_refs_left.slice(),support_refs_right:receipt.support_refs_right.slice()}};
        }
        receipt.filled=true;receipt.reason='bounded_gap_local_polynomial';receipt.degree=o.polynomialDegree;
        stats.filled_points+=length;stats.filled_gaps++;summary.filled_points+=length;summary.filled_gaps++;
      });
      // Explicit manual edits are independent of the automatic length limit.
      // They use only original observations, never estimates from this or any
      // previous edit, and require the whole raw missing run to be selected.
      var automaticMask=track.map(function(p){return !!(p&&p.is_gap_filled);});
      manualReceipts.filter(function(e){return e.status==='pending'&&e.marker===name;}).forEach(function(edit){
        var overlapping=rawGapRanges.filter(function(range){return refs[range[1]]>=edit.start_ref&&refs[range[0]]<=edit.end_ref;});
        edit.observed_points_in_selection=original.reduce(function(total,p,i){return total+(p&&refs[i]>=edit.start_ref&&refs[i]<=edit.end_ref?1:0);},0);
        if(!overlapping.length){edit.status='not_applied';edit.reason='no_missing_gap_in_selection';return;}
        overlapping.forEach(function(range){
          var a=range[0],b=range[1],length=b-a+1,receipt={start_ref:refs[a],end_ref:refs[b],frame_count:length,status:'skipped',reason:null};edit.gaps.push(receipt);
          if(refs[a]<edit.start_ref||refs[b]>edit.end_ref){receipt.reason='partial_gap_not_selected';return;}
          if(a===0||b===track.length-1){receipt.reason='unbounded_leading_or_trailing_gap';return;}
          var left=[],right=[];
          for(var i=a-1;i>=0&&left.length<o.supportPerSide;i--)if(original[i])left.unshift({ref:refs[i],xyz:original[i].raw_xyz});
          for(i=b+1;i<original.length&&right.length<o.supportPerSide;i++)if(original[i])right.push({ref:refs[i],xyz:original[i].raw_xyz});
          receipt.support_refs_left=left.map(function(p){return p.ref;});receipt.support_refs_right=right.map(function(p){return p.ref;});
          if(left.length<2||right.length<2||left.length+right.length<edit.degree+1){receipt.reason='insufficient_original_observed_support';return;}
          var support=left.concat(right),predictions=[];
          for(i=a;i<=b;i++){var fit=localPolynomial(support,refs[i],edit.degree);if(!fit){receipt.reason='rank_deficient_local_polynomial';return;}predictions.push(fit);}
          if(predictions.length!==length)return;
          for(i=a;i<=b;i++){
            var xyz=predictions[i-a];if(track[i]&&track[i].is_gap_filled)edit.replaced_estimated_points++;else edit.newly_filled_points++;
            track[i]={name:name,marker_name:name,reference_frame:refs[i],xyz:xyz.slice(),world_xyz_m:xyz.slice(),processed_xyz:xyz.slice(),raw_xyz:null,
              kind:'gap_filled',is_observed:false,is_gap_filled:true,is_smoothed:false,manual_gap_fill:true,manual_edit_id:edit.id,
              was_automatically_filled:automaticMask[i],cameras:[],support_cameras:[],view_count:0,observations:[],
              gap_fill:{method:'manual_local_polynomial_least_squares',edit_id:edit.id,degree:edit.degree,
                selection_start_ref:edit.start_ref,selection_end_ref:edit.end_ref,gap_start_ref:refs[a],gap_end_ref:refs[b],gap_frames:length,
                gap_duration_source_seconds:length/o.sourceFps,support_refs_left:receipt.support_refs_left.slice(),support_refs_right:receipt.support_refs_right.slice(),
                support_used_original_observations_only:true}};
          }
          receipt.status='applied';receipt.reason='explicit_bounded_gap_local_polynomial';receipt.degree=edit.degree;edit.filled_points+=length;
        });
        var skipped=edit.gaps.some(function(g){return g.status!=='applied';});
        edit.status=edit.filled_points?(skipped?'partial':'applied'):'not_applied';
        edit.reason=edit.filled_points?'manual_polynomial_gap_fill':edit.gaps[0].reason;
      });
      // The per-marker gap list describes the final fill state, retaining the
      // previous automatic decision when a manual edit changes that state.
      if(manualReceipts.some(function(e){return e.marker===name&&e.filled_points>0;}))stats.gaps.forEach(function(gap){
        var a=gap.start_ref-refs[0],b=gap.end_ref-refs[0],ids=new Set();
        for(var i=a;i<=b;i++)if(track[i]&&track[i].manual_gap_fill)ids.add(track[i].manual_edit_id);
        if(ids.size){gap.automatic_filled=gap.filled;gap.automatic_reason=gap.reason;gap.filled=true;gap.reason='manual_local_polynomial';gap.manual_edit_ids=Array.from(ids);}
      });
      // Each unfilled hole splits the smoothing track. The edge window is
      // shifted inside its valid run, as in Savitzky-Golay mode='interp'.
      if(o.smoothingEnabled){
        var beforeSmoothing=track.map(function(p){return p?{xyz:p.xyz.slice()}:null;});
        runs(beforeSmoothing,Boolean).forEach(function(range){
          var a=range[0],b=range[1],length=b-a+1,window=Math.min(o.smoothingWindow,length%2?length:length-1);
          if(window<=o.smoothingDegree||window<3)return;
          var half=(window-1)/2;
          for(var i=a;i<=b;i++){
            var start=Math.max(a,Math.min(i-half,b-window+1)),support=[];
            for(var j=start;j<start+window;j++)support.push({ref:refs[j],xyz:beforeSmoothing[j].xyz});
            var fit=localPolynomial(support,refs[i],o.smoothingDegree);if(!fit)continue;
            var point=track[i];point.pre_smoothing_xyz=point.xyz.slice();point.xyz=fit.slice();point.processed_xyz=fit.slice();
            if(Object.prototype.hasOwnProperty.call(point,'world_xyz_m'))point.world_xyz_m=fit.slice();
            point.is_smoothed=true;point.smoothing={method:'local_polynomial_smoothing',degree:o.smoothingDegree,window_frames:window,support_start_ref:refs[start],support_end_ref:refs[start+window-1]};
          }
        });
      }
      // Replay explicit S actions in order. Every action reads a snapshot of
      // the current processed track, including any previous S action. Context
      // may extend outside the selection, but writes never do; unfilled holes
      // always split runs. Moving-average edges use only the available half
      // window; optional polynomial smoothing uses the existing SG edge fit.
      manualSmoothingReceipts.filter(function(e){return e.status==='pending'&&e.marker===name;}).forEach(function(edit){
        var before=track.map(function(p){return p?{xyz:p.xyz.slice()}:null;}),squared=0,selectedPoints=0;
        runs(before,Boolean).forEach(function(range){
          var a=range[0],b=range[1],first=Math.max(a,edit.start_ref-refs[0]),last=Math.min(b,edit.end_ref-refs[0]);
          if(first>last)return;
          selectedPoints+=last-first+1;
          var length=b-a+1,window=edit.method==='local_polynomial'?Math.min(edit.window,length%2?length:length-1):edit.window;
          var receipt={run_start_ref:refs[a],run_end_ref:refs[b],start_ref:refs[first],end_ref:refs[last],frame_count:last-first+1,
            window_frames:window,applied_points:0,status:'applied',reason:null};edit.runs.push(receipt);
          if(edit.method==='local_polynomial'&&(window<3||window<=edit.degree)){
            receipt.status='skipped';receipt.reason='insufficient_contiguous_support';return;
          }
          var half=(window-1)/2;
          for(var i=first;i<=last;i++){
            var start,end,fit,support=[];
            if(edit.method==='moving_average'){
              start=Math.max(a,i-half);end=Math.min(b,i+half);fit=[0,0,0];
              for(var j=start;j<=end;j++)for(var axis=0;axis<3;axis++)fit[axis]+=before[j].xyz[axis]/(end-start+1);
            }else{
              start=Math.max(a,Math.min(i-half,b-window+1));end=start+window-1;
              for(j=start;j<=end;j++)support.push({ref:refs[j],xyz:before[j].xyz});
              fit=localPolynomial(support,refs[i],edit.degree);
              if(!fit){receipt.status='partial';receipt.reason='rank_deficient_local_polynomial';continue;}
            }
            var point=track[i],distance=Math.hypot.apply(null,fit.map(function(x,k){return x-before[i].xyz[k];}));
            point.pre_manual_smoothing_xyz=before[i].xyz.slice();point.xyz=fit.slice();point.processed_xyz=fit.slice();
            if(Object.prototype.hasOwnProperty.call(point,'world_xyz_m'))point.world_xyz_m=fit.slice();
            point.is_smoothed=true;point.manual_smoothing=true;point.manual_smoothing_id=edit.id;
            point.manual_smoothing_passes=(point.manual_smoothing_passes||0)+1;
            point.manual_smoothing_details={method:edit.method,edit_id:edit.id,degree:edit.method==='local_polynomial'?edit.degree:null,
              requested_window_frames:edit.window,window_frames:end-start+1,edge_mode:edit.method==='moving_average'?'truncate':'interp',
              selection_start_ref:edit.start_ref,selection_end_ref:edit.end_ref,support_start_ref:refs[start],support_end_ref:refs[end]};
            edit.applied_points++;receipt.applied_points++;squared+=distance*distance;
            if(distance>1e-12)edit.changed_points++;
            edit.maximum_displacement_m=Math.max(edit.maximum_displacement_m,distance);
            if(point.is_gap_filled)edit.estimated_points++;else edit.observed_points++;
          }
        });
        edit.status=edit.applied_points?(edit.applied_points<selectedPoints?'partial':'applied'):'not_applied';
        edit.reason=edit.applied_points?'manual_'+edit.method+'_smoothing':(selectedPoints?'insufficient_contiguous_support':'no_valid_points_in_selection');
        edit.rms_displacement_m=edit.applied_points?Math.sqrt(squared/edit.applied_points):0;
      });
      stats.filled_points=track.filter(function(p){return p&&p.is_gap_filled;}).length;
      stats.filled_gaps=stats.gaps.filter(function(g){return g.filled;}).length;
      stats.manual_filled_points=track.filter(function(p){return p&&p.manual_gap_fill;}).length;
      stats.smoothed_points=track.filter(function(p){return p&&p.is_smoothed;}).length;
      stats.manual_smoothed_points=track.filter(function(p){return p&&p.manual_smoothing;}).length;
      stats.remaining_missing_points=track.filter(function(p){return !p;}).length;summary.remaining_missing_points+=stats.remaining_missing_points;
    });
    var ordered=Array.from(names),frames=rawFrames.map(function(frame,i){var points=[];
      // Keep original point order, then append newly estimated tracks.
      var existing=new Set();frame.points.forEach(function(p){var n=p.name||p.marker_name;points.push(byMarker[n][i]);existing.add(n);});
      ordered.forEach(function(n){if(!existing.has(n)&&byMarker[n][i])points.push(byMarker[n][i]);});
      return Object.assign({},frame,{reference_frame:refs[i],points:points,processing_summary:{raw_observed_points:frame.points.length,
        gap_filled_points:points.filter(function(p){return p.is_gap_filled;}).length,smoothed_points:points.filter(function(p){return p.is_smoothed;}).length,display_points:points.length}});
    });
    var allPoints=frames.flatMap(function(f){return f.points;});
    summary.filled_points=allPoints.filter(function(p){return p.is_gap_filled;}).length;
    summary.filled_gaps=Object.values(perMarker).reduce(function(n,s){return n+s.filled_gaps;},0);
    summary.manual_filled_points=allPoints.filter(function(p){return p.manual_gap_fill;}).length;
    summary.manual_newly_filled_points=allPoints.filter(function(p){return p.manual_gap_fill&&!p.was_automatically_filled;}).length;
    summary.manual_replaced_automatic_points=allPoints.filter(function(p){return p.manual_gap_fill&&p.was_automatically_filled;}).length;
    summary.automatic_filled_points=summary.filled_points-summary.manual_filled_points;
    var smoothed=allPoints.filter(function(p){return p.is_smoothed;}),smoothedObserved=smoothed.filter(function(p){return !p.is_gap_filled;}),displacementSquared=0;
    summary.smoothed_points=smoothed.length;summary.smoothed_observed_points=smoothedObserved.length;
    summary.smoothed_filled_points=smoothed.length-smoothedObserved.length;
    smoothedObserved.forEach(function(point){
      var distance=Math.hypot.apply(null,point.xyz.map(function(x,k){return x-point.raw_xyz[k];}));
      displacementSquared+=distance*distance;summary.maximum_observed_displacement_m=Math.max(summary.maximum_observed_displacement_m,distance);
      if(distance>1e-12)summary.changed_observed_points++;
    });
    summary.rms_observed_displacement_m=smoothedObserved.length?Math.sqrt(displacementSquared/smoothedObserved.length):0;
    var activeIds=new Set();allPoints.forEach(function(p){if(p.manual_gap_fill)activeIds.add(p.manual_edit_id);});
    summary.manual_active_edit_ids=Array.from(activeIds);
    manualReceipts.forEach(function(edit){edit.active_points=allPoints.filter(function(p){return p.manual_gap_fill&&p.manual_edit_id===edit.id;}).length;});
    summary.manual_applied_edits=manualReceipts.filter(function(e){return e.filled_points>0;}).length;
    var smoothingIds=new Set();allPoints.forEach(function(p){if(p.manual_smoothing)smoothingIds.add(p.manual_smoothing_id);});
    summary.manual_smoothing_active_edit_ids=Array.from(smoothingIds);
    summary.manual_smoothing_points=allPoints.filter(function(p){return p.manual_smoothing;}).length;
    manualSmoothingReceipts.forEach(function(edit){edit.active_points=allPoints.filter(function(p){return p.manual_smoothing&&p.manual_smoothing_id===edit.id;}).length;});
    summary.manual_smoothing_applied_edits=manualSmoothingReceipts.filter(function(e){return e.applied_points>0;}).length;
    summary.manual_smoothing_passes=summary.manual_smoothing_applied_edits;
    summary.manual_smoothing_application_points=manualSmoothingReceipts.reduce(function(n,e){return n+e.applied_points;},0);
    summary.output_points=originalCount+summary.filled_points;
    return {frames:frames,summary:summary,per_marker:perMarker,manual_receipts:manualReceipts,manual_smoothing_receipts:manualSmoothingReceipts};
  }
  return Object.freeze({processSequence:processSequence,defaults:DEFAULTS});
});
