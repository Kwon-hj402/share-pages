(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.LiveMarkerReconstruction = api;
    root.JevReconstruction = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var SETTINGS = Object.freeze({epipolarGatePx:12, minimumViews:2,
    maximumReprojectionPx:8, minimumDepthM:0.05, minimumRayAngleDeg:2,
    xyzOutlierFilter:false, trajectoryFilter:false, gapFill:false});
  var SUFFIXES = ["D1M","D5M","P1M","NAV","HEE","MMA","LMA","TIB_MID_LAT","MEPI","LEPI","PAT_INF"];
  var NAMES = new Set(["R","L"].flatMap(function(s){return SUFFIXES.map(function(n){return s+"_"+n;});}));
  function finite(a) { return Array.isArray(a) && a.every(function(x){return typeof x === "number" && Number.isFinite(x);}); }
  function dot(a,b) { var s=0;for(var i=0;i<a.length;i++)s+=a[i]*b[i];return s; }
  function norm(a) { return Math.sqrt(dot(a,a)); }
  function mv(a,x) {return a.map(function(row){return dot(row,x);});}
  function transpose(a) {return a[0].map(function(_,j){return a.map(function(row){return row[j];});});}
  function multiply(a,b) {var bt=transpose(b);return a.map(function(row){return bt.map(function(col){return dot(row,col);});});}
  function sub(a,b) {return a.map(function(x,i){return x-b[i];});}
  function identity(n) {return Array.from({length:n},function(_,i){return Array.from({length:n},function(_,j){return i===j?1:0;});});}
  function invert3(a) {
    var b=a[0],c=a[1],d=a[2];
    var cof=[[c[1]*d[2]-c[2]*d[1],b[2]*d[1]-b[1]*d[2],b[1]*c[2]-b[2]*c[1]],
             [c[2]*d[0]-c[0]*d[2],b[0]*d[2]-b[2]*d[0],b[2]*c[0]-b[0]*c[2]],
             [c[0]*d[1]-c[1]*d[0],b[1]*d[0]-b[0]*d[1],b[0]*c[1]-b[1]*c[0]]];
    var det=b[0]*cof[0][0]+b[1]*cof[1][0]+b[2]*cof[2][0];
    if(!Number.isFinite(det)||Math.abs(det)<1e-18)throw new Error("Singular camera intrinsic matrix");
    return cof.map(function(row){return row.map(function(x){return x/det;});});
  }
  function skew(t) {return [[0,-t[2],t[1]],[t[2],0,-t[0]],[-t[1],t[0],0]];}
  function camera(calibration,id) {
    var c=calibration.cameras?calibration.cameras[id]:calibration[id];
    if(!c||!Array.isArray(c.K)||!Array.isArray(c.R)||!finite(c.t))throw new Error("Missing numeric camera calibration");
    return c;
  }
  function fundamental(calibration,a,b) {
    var pairs=calibration.F_pairs||calibration.fundamental_pairs||{};
    if(pairs[a+"-"+b])return pairs[a+"-"+b];
    if(pairs[b+"-"+a])return transpose(pairs[b+"-"+a]);
    var ca=camera(calibration,a),cb=camera(calibration,b);
    var r=multiply(cb.R,transpose(ca.R)),t=sub(cb.t,mv(r,ca.t));
    if(norm(t)<1e-12)throw new Error("Same-center camera pair");
    return multiply(multiply(multiply(transpose(invert3(cb.K)),skew(t)),r),invert3(ca.K));
  }
  function getRaw(point) {
    var p=point.raw_xy_px||point.xy_px||point.centre_xy_px;
    if(!p&&Number.isFinite(point.x)&&Number.isFinite(point.y))p=[point.x,point.y];
    return finite(p)&&p.length===2?p:null;
  }
  function pointIndex(point) {return point.index!==undefined?point.index:point.point_id!==undefined?point.point_id:point.dino_center_index;}
  function getNormalized(point,c) {
    var p=point.normalized_xy;
    if(finite(p)&&p.length===2)return p;
    var u=point.undistorted_xy_px;
    if(finite(u)&&u.length===2){var v=mv(invert3(c.K),[u[0],u[1],1]);return [v[0]/v[2],v[1]/v[2]];}
    return null;
  }
  function getUndistorted(point,c) {
    var p=point.undistorted_xy_px;
    if(finite(p)&&p.length===2)return p;
    var n=point.normalized_xy;
    if(finite(n)&&n.length===2){var q=mv(c.K,[n[0],n[1],1]);return [q[0]/q[2],q[1]/q[2]];}
    return null;
  }
  function pairDistance(a,b,calibration) {
    var receipt={camera_a:a.camera,camera_b:b.camera,distance_a_px:null,distance_b_px:null,
      symmetric_distance_px:null,compatible:false,valid:false};
    try {
      var ca=camera(calibration,a.camera),cb=camera(calibration,b.camera);
      var ua=getUndistorted(a.point,ca),ub=getUndistorted(b.point,cb);
      if(!ua||!ub)return receipt;
      var xa=[ua[0],ua[1],1],xb=[ub[0],ub[1],1],f=fundamental(calibration,a.camera,b.camera);
      var lb=mv(f,xa),la=mv(transpose(f),xb),na=Math.hypot(la[0],la[1]),nb=Math.hypot(lb[0],lb[1]);
      if(na<1e-18||nb<1e-18)return receipt;
      var e=Math.abs(dot(xb,mv(f,xa))),da=e/na,db=e/nb,d=Math.sqrt((da*da+db*db)/2);
      if(!Number.isFinite(d))return receipt;
      receipt.distance_a_px=da;receipt.distance_b_px=db;receipt.symmetric_distance_px=d;
      receipt.compatible=d<=SETTINGS.epipolarGatePx;receipt.valid=true;
    } catch (_) { /* Invalid comparisons never count as evidence of noise. */ }
    return receipt;
  }
  function selectConsensus(observations,calibration) {
    var ids=Object.keys(observations).sort(function(a,b){return Number(a)-Number(b);});
    var receipt={status:"insufficient_views",reason:"fewer_than_two_observed_cameras",
      observed_cameras:ids,consensus_cameras:[],excluded_noise_cameras:[],unresolved_cameras:ids.slice(),
      three_d_support_cameras:[],largest_cliques:[],pair_distances_px:{},pair_distances:[],outside_camera_votes:[]};
    if(ids.length>8)throw new Error("At most eight camera views are supported");
    if(ids.length<2)return receipt;
    var pairs={};
    function pk(a,b){return Number(a)<Number(b)?a+"-"+b:b+"-"+a;}
    for(var i=0;i<ids.length;i++)for(var j=i+1;j<ids.length;j++){
      var a=ids[i],b=ids[j],row=pairDistance({camera:a,point:observations[a]},{camera:b,point:observations[b]},calibration);
      pairs[pk(a,b)]=row;receipt.pair_distances.push(row);receipt.pair_distances_px[pk(a,b)]=row.symmetric_distance_px;
    }
    var largest=[],size=0;
    for(var mask=1;mask<(1<<ids.length);mask++){
      var group=[];for(i=0;i<ids.length;i++)if(mask&(1<<i))group.push(ids[i]);
      if(group.length<size)continue;
      var ok=true;
      for(i=0;i<group.length&&ok;i++)for(j=i+1;j<group.length;j++)if(!pairs[pk(group[i],group[j])].compatible){ok=false;break;}
      if(ok){if(group.length>size){size=group.length;largest=[];}largest.push(group);}
    }
    receipt.largest_cliques=largest;
    if(size<2){receipt.status="ambiguous";receipt.reason="no_compatible_two_camera_clique";return receipt;}
    if(largest.length!==1){receipt.status="ambiguous";receipt.reason="largest_camera_clique_tie";return receipt;}
    var core=largest[0],noise=[],unresolved=[];
    ids.forEach(function(id){
      if(core.indexOf(id)>=0)return;
      var good=[],bad=[],invalid=[];
      core.forEach(function(other){var p=pairs[pk(id,other)];if(!p.valid)invalid.push(other);else(p.compatible?good:bad).push(other);});
      var isNoise=invalid.length===0&&bad.length>=2&&bad.length>good.length;
      (isNoise?noise:unresolved).push(id);
      receipt.outside_camera_votes.push({camera:id,good_consensus_cameras:good,bad_consensus_cameras:bad,invalid_comparisons:invalid,noise:isNoise});
    });
    receipt.status="unique_consensus";receipt.reason="unique_largest_compatible_camera_clique";
    receipt.consensus_cameras=core;receipt.three_d_support_cameras=core.slice();receipt.excluded_noise_cameras=noise;
    receipt.unresolved_cameras=unresolved;
    return receipt;
  }

  // Symmetric 4x4 Jacobi eigensolver. The smallest eigenvector of A^T A gives
  // the homogeneous linear-DLT solution; no external numerical dependency.
  function smallestEigenvector4(matrix) {
    var a=matrix.map(function(row){return row.slice();}),v=identity(4);
    for(var iteration=0;iteration<100;iteration++){
      var p=0,q=1,largest=0,scale=1;
      for(var i=0;i<4;i++){
        scale=Math.max(scale,Math.abs(a[i][i]));
        for(var j=i+1;j<4;j++)if(Math.abs(a[i][j])>largest){largest=Math.abs(a[i][j]);p=i;q=j;}
      }
      if(largest<=1e-15*scale)break;
      var apq=a[p][q],tau=(a[q][q]-a[p][p])/(2*apq);
      var tangent=(tau>=0?1:-1)/(Math.abs(tau)+Math.sqrt(1+tau*tau));
      var c=1/Math.sqrt(1+tangent*tangent),s=tangent*c;
      var app=a[p][p],aqq=a[q][q];
      a[p][p]=app-tangent*apq;a[q][q]=aqq+tangent*apq;a[p][q]=a[q][p]=0;
      for(i=0;i<4;i++){
        if(i!==p&&i!==q){var aip=a[i][p],aiq=a[i][q];a[i][p]=a[p][i]=c*aip-s*aiq;a[i][q]=a[q][i]=s*aip+c*aiq;}
        var vip=v[i][p],viq=v[i][q];v[i][p]=c*vip-s*viq;v[i][q]=s*vip+c*viq;
      }
    }
    var index=0;for(var k=1;k<4;k++)if(a[k][k]<a[index][index])index=k;
    var vector=v.map(function(row){return row[index];}),length=norm(vector);
    return vector.map(function(x){return x/length;});
  }
  function linearDLT(observations,calibration) {
    var normal=Array.from({length:4},function(){return [0,0,0,0];});
    Object.keys(observations).forEach(function(id){
      var c=camera(calibration,id),n=getNormalized(observations[id],c);
      if(!n)throw new Error("Missing normalized undistorted point");
      var p=c.R.map(function(row,i){return row.concat([c.t[i]]);});
      [p[2].map(function(x,i){return n[0]*x-p[0][i];}),p[2].map(function(x,i){return n[1]*x-p[1][i];})].forEach(function(row){
        for(var i=0;i<4;i++)for(var j=0;j<4;j++)normal[i][j]+=row[i]*row[j];
      });
    });
    var h=smallestEigenvector4(normal);
    if(!finite(h)||Math.abs(h[3])<1e-12)throw new Error("Degenerate homogeneous DLT point");
    var xyz=h.slice(0,3).map(function(x){return x/h[3];});
    if(!finite(xyz))throw new Error("Nonfinite DLT point");
    return xyz;
  }
  function projectDistorted(xyz,c) {
    var p=mv(c.R,xyz).map(function(x,i){return x+c.t[i];}),z=p[2];
    if(!Number.isFinite(z)||Math.abs(z)<1e-15)throw new Error("Invalid projection depth");
    var x=p[0]/z,y=p[1]/z,r2=x*x+y*y,r4=r2*r2,r6=r4*r2,d=(c.D||[]).flat();
    if(d.length>12)throw new Error("Tilted-sensor distortion is not supported by this calibration contract");
    var radial=(1+(d[0]||0)*r2+(d[1]||0)*r4+(d[4]||0)*r6)/(1+(d[5]||0)*r2+(d[6]||0)*r4+(d[7]||0)*r6);
    var xd=x*radial+2*(d[2]||0)*x*y+(d[3]||0)*(r2+2*x*x)+(d[8]||0)*r2+(d[9]||0)*r4;
    var yd=y*radial+(d[2]||0)*(r2+2*y*y)+2*(d[3]||0)*x*y+(d[10]||0)*r2+(d[11]||0)*r4;
    var pixel=mv(c.K,[xd,yd,1]);
    return {xy:[pixel[0]/pixel[2],pixel[1]/pixel[2]],depth:z};
  }
  function solveAndCheck(observations,calibration) {
    var ids=Object.keys(observations).sort(function(a,b){return Number(a)-Number(b);}),xyz=linearDLT(observations,calibration);
    var errors={},depths=[],rays=[];
    ids.forEach(function(id){
      var c=camera(calibration,id),projection=projectDistorted(xyz,c),raw=getRaw(observations[id]);
      if(!raw)throw new Error("Missing actual distorted pixel coordinate");
      errors[id]=Math.hypot(projection.xy[0]-raw[0],projection.xy[1]-raw[1]);depths.push(projection.depth);
      var center=c.center||mv(transpose(c.R),c.t).map(function(x){return -x;});rays.push(sub(xyz,center));
    });
    var bestAngle=0;
    for(var i=0;i<rays.length;i++)for(var j=i+1;j<rays.length;j++){
      var cosine=Math.abs(dot(rays[i],rays[j])/(norm(rays[i])*norm(rays[j])));
      bestAngle=Math.max(bestAngle,Math.acos(Math.min(1,Math.max(0,cosine)))*180/Math.PI);
    }
    var values=Object.values(errors),maximum=Math.max.apply(null,values),minimumDepth=Math.min.apply(null,depths);
    var rms=Math.sqrt(values.reduce(function(s,e){return s+e*e;},0)/values.length);
    return {ok:values.every(Number.isFinite)&&minimumDepth>SETTINGS.minimumDepthM&&maximum<=SETTINGS.maximumReprojectionPx&&bestAngle>=SETTINGS.minimumRayAngleDeg,
      xyz:xyz,cameras:ids,view_count:ids.length,errors:errors,rms:rms,
      minimum_depth_m:minimumDepth,maximum_reprojection_px:maximum,maximum_triangulation_angle_deg:bestAngle};
  }
  function reconstructFrame(camerasMap,calibration) {
    var grouped={},inputCount=0;
    Object.keys(camerasMap).forEach(function(id){
      var rows=Array.isArray(camerasMap[id])?camerasMap[id]:(camerasMap[id].points||[]);
      rows.forEach(function(point){
        inputCount++;var name=point.name||point.marker_name||point.marker_id;
        if(!NAMES.has(name))return;
        if(!grouped[name])grouped[name]={};
        if(!grouped[name][String(id)])grouped[name][String(id)]=[];
        grouped[name][String(id)].push(point);
      });
    });
    var points=[],groups=[],noise=[],ambiguous=0,withheld=0;
    Object.keys(grouped).sort().forEach(function(name){
      var buckets=grouped[name],observations={},duplicates=Object.keys(buckets).filter(function(id){return buckets[id].length!==1;});
      Object.keys(buckets).forEach(function(id){if(buckets[id].length===1)observations[id]=buckets[id][0];});
      var receipt;
      if(duplicates.length){
        receipt={status:"ambiguous",reason:"duplicate_same_id_points_in_one_camera",observed_cameras:Object.keys(buckets),
          consensus_cameras:[],excluded_noise_cameras:[],unresolved_cameras:Object.keys(buckets),three_d_support_cameras:[],pair_distances:[],pair_distances_px:{}};
      }else receipt=selectConsensus(observations,calibration);
      receipt.name=name;receipt.marker_name=name;receipt.reconstruction_status="withheld";
      receipt.observation_keys=Object.keys(observations).map(function(id){var p=observations[id];return {camera:id,index:pointIndex(p),key:p.key};});
      receipt.excluded_noise_cameras.forEach(function(id){var p=observations[id];noise.push({camera:id,name:name,marker_name:name,index:pointIndex(p),point_id:pointIndex(p),key:p.key,xy_px:getRaw(p)});});
      if(receipt.status!=="unique_consensus"){ambiguous++;groups.push(receipt);return;}
      var selected={};receipt.consensus_cameras.forEach(function(id){selected[id]=observations[id];});
      try{
        var result=solveAndCheck(selected,calibration);
        receipt.reprojection_errors_px=result.errors;receipt.reprojection_rms_px=result.rms;
        receipt.minimum_depth_m=result.minimum_depth_m;receipt.maximum_triangulation_angle_deg=result.maximum_triangulation_angle_deg;
        if(result.ok){
          receipt.reconstruction_status="reconstructed";
          points.push({name:name,marker_name:name,xyz:result.xyz,world_xyz_m:result.xyz,
            view_count:result.view_count,cameras:result.cameras,support_cameras:result.cameras,
            errors:result.errors,reprojection_errors_px:result.errors,rms:result.rms,reprojection_rms_px:result.rms,
            minimum_depth_m:result.minimum_depth_m,maximum_triangulation_angle_deg:result.maximum_triangulation_angle_deg,
            two_view_consensus:result.view_count===2,observations:result.cameras.map(function(id){var p=selected[id];return {camera:id,index:pointIndex(p),key:p.key,xy_px:getRaw(p)};})});
        }else{withheld++;receipt.reconstruction_reason="depth_reprojection_or_ray_angle_not_sufficient";}
      }catch(error){withheld++;receipt.reconstruction_reason="degenerate_or_missing_numeric_geometry";}
      groups.push(receipt);
    });
    return {points:points,groups:groups,noise_views:noise,summary:{input_points:inputCount,group_count:groups.length,
      reconstructed_points:points.length,two_view_points:points.filter(function(p){return p.view_count===2;}).length,
      supporting_2d_observations:points.reduce(function(s,p){return s+p.view_count;},0),noise_view_count:noise.length,
      ambiguous_or_insufficient_groups:ambiguous,geometrically_withheld_groups:withheld,
      xyz_or_trajectory_outlier_deletions:0,original_2d_inputs_modified:false}};
  }
  return Object.freeze({reconstructFrame:reconstructFrame,selectConsensus:selectConsensus,
    linearDLT:linearDLT,projectDistorted:projectDistorted,settings:SETTINGS});
});
