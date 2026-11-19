(function(root){
  'use strict';
  function bestNamed(point,original,markerNames){
    if(point.best_named)return {...point.best_named,confidence:original.confidence};
    const values=new Map(),names=new Set(markerNames);
    for(const item of [...(original.top3||[]),...(original.top3_alternatives||[])])if(names.has(item.name))values.set(item.name,Math.max(item.p,values.get(item.name)||0));
    const sorted=[...values].map(([name,p])=>({name,p})).sort((a,b)=>b.p-a.p||markerNames.indexOf(a.name)-markerNames.indexOf(b.name));
    return {choice:sorted[0]&&sorted[0].p>0?sorted[0].name:'no_named_evidence',p:sorted[0]?sorted[0].p:0,confidence:original.confidence,margin:sorted[0]?sorted[0].p-(sorted[1]?sorted[1].p:0):0,top3:sorted.slice(0,3),top3_alternatives:sorted.slice(1,4),unknown_p:original.unknown_p,probability_domain:'marker_id',derived_from_original_unknown:true};
  }
  function evaluateFrame(points, options, markerNames) {
    const names = new Set(markerNames), source = options.source || 'raw';
    const rows = points.map(point => {
      const original = point[source], forced = !!(options.force_unknown&&original&&original.choice==='unknown');
      const answer = forced?bestNamed(point,original,markerNames):original, p = answer && answer.p, confidence = answer && answer.confidence;
      let reason = 'accepted';
      if (point.detector_confidence < options.detector_min) reason = 'detector';
      else if (!answer || !Number.isFinite(p) || !Number.isFinite(confidence)) reason = 'invalid';
      else if (answer.choice==='no_named_evidence') reason = 'no_named_evidence';
      else if (!names.has(answer.choice)) reason = 'unknown';
      else if (p < options.p_min) reason = 'probability';
      else if (!forced && confidence < options.confidence_min) reason = 'confidence';
      else if (!Number.isFinite(answer.margin) || answer.margin < 0) reason = 'margin';
      return {...point, original_answer:original, forced_unknown:forced, answer, name: answer && answer.choice, probability:p, model_confidence:confidence, reason};
    });
    const winners = new Map();
    rows.filter(row=>row.reason==='accepted').sort((a,b)=>b.probability-a.probability || b.model_confidence-a.model_confidence || a.index-b.index)
      .forEach(row=>{if(winners.has(row.name))row.reason='duplicate';else winners.set(row.name,row);});
    if(options.exclude_noise) for(const row of winners.values()) {
      if(row.epipolar_noise && row.name===row.epipolar_noise_marker) row.reason='camera_noise';
    }
    return {rows, accepted:rows.filter(row=>row.reason==='accepted'), counts:rows.reduce((c,r)=>(c[r.reason]=(c[r.reason]||0)+1,c),{})};
  }
  const api={evaluateFrame};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ThresholdRules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
