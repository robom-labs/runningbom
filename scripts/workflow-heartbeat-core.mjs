export function workflowHeartbeat(runs,now=Date.now()){
 const latest=Array.isArray(runs)?runs[0]:null;
 const age=r=>(now-Date.parse(r?.updatedAt))/3600000;
 const active=latest&&['queued','in_progress','waiting','pending'].includes(latest.status);
 const completed=active?runs.find(r=>r.status==='completed'):latest;
 const ageHours=age(completed),activeAgeHours=active?age(latest):null;
 const ok=!!completed&&completed.status==='completed'&&completed.conclusion==='success'&&Number.isFinite(ageHours)&&ageHours>=-5/60&&ageHours<=10&&(!active||(Number.isFinite(activeAgeHours)&&activeAgeHours>=-5/60&&activeAgeHours<.75));
 return {ok,status:ok?(active?'running-with-recent-success':'healthy'):'unhealthy',ageHours:Number.isFinite(ageHours)?Math.round(ageHours*10)/10:null,activeAgeHours:Number.isFinite(activeAgeHours)?activeAgeHours:null};
}
