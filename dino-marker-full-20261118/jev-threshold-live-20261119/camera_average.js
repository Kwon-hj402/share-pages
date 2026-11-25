(function(root,factory){
  'use strict';
  const api=typeof module==='object'&&module.exports?factory(require('./reconstruction.js')):factory(root.LiveMarkerReconstruction);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CameraAverage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Reconstruction){
  'use strict';
  // A display alternative only. It never edits a camera observation, strict
  // reconstruction, label, probability, or the numerical reconstruction engine.
  const clone=value=>JSON.parse(JSON.stringify(value));
  const finiteXYZ=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
  const length=a=>Math.hypot(...a);
  const subtract=(a,b)=>a.map((x,i)=>x-b[i]);
  const multiplyVector=(matrix,vector)=>matrix.map(row=>dot(row,vector));
  const transpose=matrix=>matrix[0].map((_,i)=>matrix.map(row=>row[i]));
  const markerName=p=>p.name||p.marker_name||p.marker_id;
  const rawXY=p=>p.raw_xy_px||p.xy_px||p.centre_xy_px;
  const pointIndex=p=>p.index!==undefined?p.index:p.point_id!==undefined?p.point_id:p.dino_center_index;
  const numericSort=(a,b)=>Number(a)-Number(b);
  const camera=(cal,id)=>{const c=cal.cameras?cal.cameras[id]:cal[id];if(!c)throw Error('Missing calibrated camera');return c;};
  function center(c){return c.center||multiplyVector(transpose(c.R),c.t).map(x=>-x);}
  function diagnostics(xyz,ids,observations,cal){
    const errors={},depths=[],rays=[];
    for(const id of ids){
      const c=camera(cal,id),projection=Reconstruction.projectDistorted(xyz,c),xy=rawXY(observations[id]);
      if(!Array.isArray(xy)||xy.length!==2||!xy.every(Number.isFinite))throw Error('Missing actual native pixel observation');
      const error=Math.hypot(projection.xy[0]-xy[0],projection.xy[1]-xy[1]);
      if(!Number.isFinite(error)||!Number.isFinite(projection.depth))throw Error('Invalid projection');
      errors[id]=error;depths.push(projection.depth);rays.push(subtract(xyz,center(c)));
    }
    let angle=0;
    for(let a=0;a<rays.length;a++)for(let b=a+1;b<rays.length;b++){
      const denominator=length(rays[a])*length(rays[b]);
      if(!(denominator>0))throw Error('Invalid camera ray');
      const cosine=Math.min(1,Math.max(0,Math.abs(dot(rays[a],rays[b])/denominator)));
      angle=Math.max(angle,Math.acos(cosine)*180/Math.PI);
    }
    const values=Object.values(errors);
    return {errors,rms:Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),
      minimum_depth_m:Math.min(...depths),maximum_reprojection_px:Math.max(...values),
      maximum_triangulation_angle_deg:angle};
  }
  function settings(strict,options){
    const source=Object.assign({},strict.settings||{},options||{});
    const minimumDepthM=source.minimumDepthM===undefined?.05:source.minimumDepthM;
    const minimumRayAngleDeg=source.minimumRayAngleDeg===undefined?2:source.minimumRayAngleDeg;
    if(!Number.isFinite(minimumDepthM)||minimumDepthM<0||!Number.isFinite(minimumRayAngleDeg)||minimumRayAngleDeg<=0||minimumRayAngleDeg>=90)throw Error('Invalid physical geometry settings');
    return {minimumDepthM,minimumRayAngleDeg};
  }
  function observationsFor(inputs,name,ids,group){
    const observations={};
    for(const id of ids){
      const bucket=Array.isArray(inputs[id])?inputs[id]:inputs[id]?.points||[];
      const rows=bucket.filter(p=>markerName(p)===name);
      if(rows.length!==1)throw Error('A camera must supply exactly one actual point with this marker ID');
      const point=rows[0],reference=(group.observation_keys||[]).find(p=>String(p.camera)===id);
      if(reference&&reference.index!==undefined&&String(reference.index)!==String(pointIndex(point)))throw Error('Strict and average observation indices differ');
      if(reference&&reference.key!==undefined&&reference.key!==point.key)throw Error('Strict and average observation keys differ');
      observations[id]=point;
    }
    return observations;
  }
  function previewFrame(inputs,calibration,strict,options){
    if(!strict||!Array.isArray(strict.points)||!Array.isArray(strict.groups))throw Error('Supply the unchanged strict reconstruction frame');
    const physical=settings(strict,options),original=new Map(strict.points.map(p=>[markerName(p),p]));
    const replacements=new Map(),added=[],receipts=[];
    const summary={original_strict_points:strict.points.length,affected_groups:0,averaged_points:0,
      added_points:0,replaced_points:0,unchanged_points:strict.points.length,valid_pairs:0,x_pairs:0,rejected_pairs:0,
      mean_displacement_m:0,maximum_displacement_m:0,original_2d_inputs_modified:false,
      strict_3d_modified:false,preview_is_derived_not_strict_observation:true};
    const displacements=[];
    for(const group of strict.groups){
      const excluded=(group.excluded_noise_cameras||[]).map(String),core=(group.consensus_cameras||[]).map(String);
      if(!excluded.length)continue;
      summary.affected_groups++;
      const name=group.name||group.marker_name,ids=[...new Set([...core,...excluded])].sort(numericSort);
      const receipt={name,status:'not_averaged',consensus_cameras:core,excluded_noise_cameras:excluded,
        candidate_cameras:ids,valid_pairs:[],rejected_pairs:[],strict_xyz:original.get(name)?.xyz||null};
      receipts.push(receipt);
      let observations;
      try{observations=observationsFor(inputs,name,ids,group);}catch(error){receipt.reason='missing_or_mismatched_same_marker_observation';continue;}
      for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
        const pair=[ids[a],ids[b]],containsX=pair.some(id=>excluded.includes(id));
        let xyz,diagnostic;
        try{
          xyz=Reconstruction.linearDLT(Object.fromEntries(pair.map(id=>[id,observations[id]])),calibration);
          if(!finiteXYZ(xyz))throw Error('Nonfinite DLT');
          diagnostic=diagnostics(xyz,pair,observations,calibration);
        }catch(error){receipt.rejected_pairs.push({cameras:pair,contains_x:containsX,reason:'missing_or_degenerate_numeric_geometry'});continue;}
        let reason=null;
        if(diagnostic.minimum_depth_m<=physical.minimumDepthM)reason='nonpositive_depth';
        else if(diagnostic.maximum_triangulation_angle_deg<physical.minimumRayAngleDeg)reason='insufficient_triangulation_angle';
        if(reason){receipt.rejected_pairs.push({cameras:pair,contains_x:containsX,reason,xyz,...diagnostic});continue;}
        // Deliberately no epipolar/reprojection threshold here: the user's
        // requested preview includes the original X camera observations.
        receipt.valid_pairs.push({cameras:pair,xyz,contains_x:containsX,...diagnostic});
      }
      summary.valid_pairs+=receipt.valid_pairs.length;
      summary.rejected_pairs+=receipt.rejected_pairs.length;
      const xPairs=receipt.valid_pairs.filter(p=>p.contains_x).length;
      summary.x_pairs+=xPairs;
      if(!receipt.valid_pairs.length||!xPairs){receipt.reason='no_valid_x_pairs';continue;}
      const xyz=[0,1,2].map(axis=>receipt.valid_pairs.reduce((sum,pair)=>sum+pair.xyz[axis],0)/receipt.valid_pairs.length);
      const used=[...new Set(receipt.valid_pairs.flatMap(pair=>pair.cameras))].sort(numericSort);
      let diagnostic;
      try{diagnostic=diagnostics(xyz,ids,observations,calibration);}catch(error){receipt.reason='invalid_mean_projection';continue;}
      if(diagnostic.minimum_depth_m<=physical.minimumDepthM||diagnostic.maximum_triangulation_angle_deg<physical.minimumRayAngleDeg){receipt.reason='mean_fails_physical_geometry';continue;}
      const strictPoint=original.get(name),displacement=strictPoint?length(subtract(xyz,strictPoint.xyz)):null;
      const spread=Math.sqrt(receipt.valid_pairs.reduce((sum,pair)=>sum+length(subtract(pair.xyz,xyz))**2,0)/receipt.valid_pairs.length);
      receipt.status='averaged';receipt.xyz=xyz;receipt.pair_count=receipt.valid_pairs.length;receipt.x_pair_count=xPairs;
      receipt.displacement_m=displacement;receipt.rms_spread_m=spread;
      const metadata={method:'equal_weight_mean_of_camera_pair_DLT',same_marker_id_only:true,
        affected_scope:'only_groups_with_original_excluded_X_observations',includes_excluded_noise:true,
        epipolar_gate_applied_to_candidates:false,reprojection_gate_applied_to_candidates:false,
        physical_geometry_settings:physical,pair_count:receipt.valid_pairs.length,x_pair_count:xPairs,
        cameras:used,consensus_cameras:core,excluded_noise_cameras:excluded,
        valid_pairs:clone(receipt.valid_pairs).map(pair=>({...pair,weight:1/receipt.valid_pairs.length})),
        rejected_pairs:clone(receipt.rejected_pairs),strict_xyz:strictPoint?strictPoint.xyz.slice():null,
        displacement_m:displacement,rms_spread_m:spread,reprojection_errors_px:diagnostic.errors,
        maximum_reprojection_px:diagnostic.maximum_reprojection_px,minimum_depth_m:diagnostic.minimum_depth_m,
        maximum_triangulation_angle_deg:diagnostic.maximum_triangulation_angle_deg};
      const point=Object.assign({},strictPoint?clone(strictPoint):{},
        {name,marker_name:name,xyz,world_xyz_m:xyz.slice(),kind:'camera_pair_average',
         is_camera_average:true,is_observed:false,is_derived:true,
         strict_raw_xyz:strictPoint?strictPoint.xyz.slice():null,processing_input_xyz:xyz.slice(),
         camera_average:metadata,view_count:used.length,cameras:used,support_cameras:used,
         errors:diagnostic.errors,reprojection_errors_px:diagnostic.errors,rms:diagnostic.rms,
         reprojection_rms_px:diagnostic.rms,minimum_depth_m:diagnostic.minimum_depth_m,
         maximum_triangulation_angle_deg:diagnostic.maximum_triangulation_angle_deg,
         two_view_consensus:false,observations:used.map(id=>({camera:id,index:pointIndex(observations[id]),
           key:observations[id].key,xy_px:rawXY(observations[id]).slice()}))});
      if(strictPoint){replacements.set(name,point);summary.replaced_points++;displacements.push(displacement);}
      else{added.push(point);summary.added_points++;}
      summary.averaged_points++;
    }
    const points=strict.points.map(p=>replacements.get(markerName(p))||clone(p)).concat(added);
    summary.unchanged_points=strict.points.length-summary.replaced_points;
    summary.output_points=points.length;
    if(displacements.length){summary.mean_displacement_m=displacements.reduce((sum,v)=>sum+v,0)/displacements.length;summary.maximum_displacement_m=Math.max(...displacements);}
    return {points,receipts,summary};
  }
  return Object.freeze({previewFrame});
});
