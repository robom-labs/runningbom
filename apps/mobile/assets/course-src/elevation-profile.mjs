/** Source-bound, deterministic DEM profile. No network, clock, Node imports or AI. */
export const ELEVATION_SCHEMA_VERSION = 1;
const R = 6371008.8, RAD = Math.PI / 180;
const finite = Number.isFinite;
const validPoint = p => p && finite(p.lat) && finite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
export function elevationDistance(a, b) {
  const h = Math.sin((b.lat-a.lat)*RAD/2)**2 + Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin((b.lon-a.lon)*RAD/2)**2;
  return R*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}

/** FIPS 180-4 SHA-256, UTF-8. Synchronous so the WebView contract stays pure. */
export function utf8Bytes(text) {
  if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text);
  // Hermes can lack TextEncoder; match UTF-8 replacement semantics without a polyfill.
  const out=[];for(const char of text){let c=char.codePointAt(0);if(c>=0xd800&&c<=0xdfff)c=0xfffd;if(c<128)out.push(c);else if(c<2048)out.push(192|(c>>6),128|(c&63));else if(c<65536)out.push(224|(c>>12),128|((c>>6)&63),128|(c&63));else out.push(240|(c>>18),128|((c>>12)&63),128|((c>>6)&63),128|(c&63));}return new Uint8Array(out);
}
export function sha256(text) {
  const bytes = utf8Bytes(text);
  const n = Math.ceil((bytes.length+9)/64)*64, buf = new Uint8Array(n);
  buf.set(bytes); buf[bytes.length] = 128;
  const view = new DataView(buf.buffer), bits = bytes.length*8;
  view.setUint32(n-8,Math.floor(bits/4294967296)); view.setUint32(n-4,bits>>>0);
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const state = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64), rotr = (x,s)=>(x>>>s)|(x<<(32-s));
  for (let offset=0;offset<n;offset+=64) {
    for (let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
    for (let i=16;i<64;i++) {
      const a=w[i-15],b=w[i-2];
      w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0;
    }
    let [a,b,c,d,e,f,g,h]=state;
    for (let i=0;i<64;i++) {
      const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0;
      const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,h].forEach((v,i)=>{state[i]=(state[i]+v)>>>0;});
  }
  return state.map(v=>v.toString(16).padStart(8,'0')).join('');
}
export const elevationRouteHash = course => sha256(JSON.stringify(course.segments));

/** Cumulative geodesic distance, with NO distance across GPX segment breaks. */
export function elevationRouteGeometry(course) {
  if (!Array.isArray(course?.segments) || !course.segments.length || course.segments.length>1000) return null;
  let lengthM=0,count=0;
  const segments=[];
  for (const segment of course.segments) {
    if (!Array.isArray(segment)||segment.length<2) return null;
    const points=[];
    for (let i=0;i<segment.length;i++) {
      const p=segment[i]; if (!validPoint(p)||++count>100000) return null;
      if (i) lengthM+=elevationDistance(segment[i-1],p);
      points.push({...p,distanceM:lengthM});
    }
    segments.push(points);
  }
  return lengthM>0&&finite(lengthM)?{segments,lengthM}:null;
}
/** Acquisition grid interpolates on the same geometry as existing sampleGeoAt. */
export function elevationQueryPoints(course, spacingM=30) {
  const geometry=elevationRouteGeometry(course);
  if (!geometry||!finite(spacingM)||spacingM<10||spacingM>60) throw Error('invalid acquisition geometry/spacing');
  return geometry.segments.map(segment=>{
    const first=segment[0],last=segment.at(-1),out=[]; let edge=1;
    const at=distanceM=>{
      while(edge<segment.length-1&&segment[edge].distanceM<distanceM) edge++;
      const a=segment[edge-1],b=segment[edge],t=b.distanceM>a.distanceM?(distanceM-a.distanceM)/(b.distanceM-a.distanceM):0;
      return {distanceM,lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};
    };
    for(let d=first.distanceM;d<last.distanceM;d+=spacingM) out.push(at(d));
    out.push(at(last.distanceM)); return out;
  });
}

function interpolate(run,d,key='elevationM') {
  if(d<run[0].distanceM||d>run.at(-1).distanceM) return null;
  let lo=0,hi=run.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(run[m].distanceM<d)lo=m+1;else hi=m;}
  const b=run[lo];if(b.distanceM===d||!lo)return b[key];
  const a=run[lo-1];if(a[key]===null||b[key]===null)return null;
  return a[key]+(b[key]-a[key])*(d-a.distanceM)/(b.distanceM-a.distanceM);
}
// Exact integral of a piecewise-linear elevation curve; distance-weighted, not point-count-weighted.
function meanElevation(run,start,end) {
  let d=start,z=interpolate(run,start),sum=0;
  for(const p of run){if(p.distanceM<=start||p.distanceM>=end)continue;sum+=(z+p.elevationM)/2*(p.distanceM-d);d=p.distanceM;z=p.elevationM;}
  sum+=(z+interpolate(run,end))/2*(end-d);
  return sum/(end-start);
}
export function classifyGrade(grade) {
  return !finite(grade)?'unknown':grade>=1?'up':grade<=-1?'down':'flat';
}
function fail(reason,lengthM=0,sourceLabel='',estimated=false) {
  return {available:false,reason,sourceLabel,estimated,lengthM,minElevationM:null,maxElevationM:null,segments:[]};
}

/** enrichment is ONE wrapper.profiles entry (not the wrapper). All bindings fail closed. */
export function buildElevationProfile(course,enrichment) {
  const geometry=elevationRouteGeometry(course);
  if(!geometry)return fail('invalid-geometry');
  const {lengthM}=geometry,e=enrichment;
  if(!e)return fail('missing-enrichment',lengthM);
  if(e.schemaVersion!==ELEVATION_SCHEMA_VERSION)return fail('unsupported-schema',lengthM);
  if(!course.id||!course.eventId||!course.raceDate||e.courseId!==course.id||e.eventId!==course.eventId||e.raceDate!==course.raceDate)return fail('edition-mismatch',lengthM);
  if(e.routeHash!==elevationRouteHash(course))return fail('route-hash-mismatch',lengthM);
  if(!/^[a-f0-9]{64}$/.test(course.sourceSha256??'')||e.officialGPXsha!==course.sourceSha256||e.officialGPXUrl!==course.sourceUrl)return fail('official-source-mismatch',lengthM);
  const source=e.source,estimated=source?.kind==='dem',label=source?.attribution??'';
  if(!source||!['dem','gpx'].includes(source.kind)||!label||!source.license||!finite(source.resolutionM)||source.resolutionM<=0||!Array.isArray(source.urls)||!source.urls.length||!/^\d{4}-\d{2}-\d{2}T/.test(e.checkedAt??''))return fail('missing-provenance',lengthM);
  if(!Array.isArray(e.segments)||e.segments.length!==geometry.segments.length)return fail('invalid-samples',lengthM,label,estimated);
  if(!Array.isArray(e.masks)||e.masks.some(m=>!Number.isInteger(m.segmentIndex)||m.segmentIndex<0||m.segmentIndex>=e.segments.length||!finite(m.startM)||!finite(m.endM)||m.startM>m.endM||m.startM<geometry.segments[m.segmentIndex][0].distanceM||m.endM>geometry.segments[m.segmentIndex].at(-1).distanceM))return fail('invalid-masks',lengthM,label,estimated);
  let raw=[];
  for(let s=0;s<e.segments.length;s++){
    const samples=e.segments[s],route=geometry.segments[s];
    if(!Array.isArray(samples)||samples.length<2||samples.length>100000)return fail('invalid-samples',lengthM,label,estimated);
    let previous=-Infinity;
    for(const p of samples){
      if(!p||!finite(p.distanceM)||p.distanceM<route[0].distanceM-1e-6||p.distanceM>route.at(-1).distanceM+1e-6||p.distanceM<=previous)return fail('invalid-distance-axis',lengthM,label,estimated);
      previous=p.distanceM;raw.push(p.elevationM);
    }
  }
  raw=raw.filter(v=>finite(v)&&v>=-500&&v<=9000);
  if(!raw.length)return fail('no-valid-elevation',lengthM,label,estimated);
  if(raw.every(v=>v===0))return fail('zero-placeholder',lengthM,label,estimated);
  const output=[];
  const gradeSupported=!estimated||e.structureMask?.status==='checked';
  for(let s=0;s<e.segments.length;s++){
    const samples=e.segments[s],masks=e.masks.filter(m=>m.segmentIndex===s),bad=new Set();
    for(let i=0;i<samples.length;i++){
      const p=samples[i];
      if(!finite(p.elevationM)||p.elevationM< -500||p.elevationM>9000||p.valid===false||masks.some(m=>p.distanceM>=m.startM&&p.distanceM<=m.endM))bad.add(i);
      if(i){const a=samples[i-1],dx=p.distanceM-a.distanceM,dz=Math.abs(p.elevationM-a.elevationM);
        if(finite(a.elevationM)&&finite(p.elevationM)&&((dx<=200&&dz>40)||dz/Math.max(30,dx)>.25)){bad.add(i-1);bad.add(i);}
      }
    }
    let run=[];
    const flush=()=>{
      if(run.length>=2){
        // A symmetric 100m elevation mean is left untouched where full support is missing.
        const smoothed=run.map(p=>({...p,elevationM:p.distanceM-run[0].distanceM>=50&&run.at(-1).distanceM-p.distanceM>=50?meanElevation(run,p.distanceM-50,p.distanceM+50):p.elevationM}));
        output.push(smoothed.map(p=>{
          const left=interpolate(smoothed,p.distanceM-75),right=interpolate(smoothed,p.distanceM+75);
          const grade=gradeSupported&&left!==null&&right!==null?(right-left)/150*100:null;
          return {distanceM:p.distanceM,elevationM:p.elevationM,gradePercent:grade!==null&&Math.abs(grade)<=25?(Math.abs(grade)<1?0:grade):null};
        }));
      }run=[];
    };
    for(let i=0;i<samples.length;i++){
      const p=samples[i],prev=samples[i-1];
      // A narrow explicit mask between two samples must still break the curve.
      if(prev&&(p.distanceM-prev.distanceM>90||masks.some(m=>m.startM<=p.distanceM&&m.endM>=prev.distanceM)))flush();
      if(bad.has(i)){flush();continue;}run.push({distanceM:p.distanceM,elevationM:p.elevationM});
    }flush();
  }
  if(!output.length)return fail('no-continuous-elevation',lengthM,label,estimated);
  const values=output.flat().map(p=>p.elevationM);
  return {available:true,reason:null,sourceLabel:label,estimated,lengthM,minElevationM:Math.min(...values),maxElevationM:Math.max(...values),segments:output};
}

/** The distance fraction is geometric, never official-distance-scaled. Gaps stay null. */
export function sampleElevation(profile,progress) {
  if(!profile?.available||!finite(progress)||!finite(profile.lengthM))return null;
  const distanceM=Math.max(0,Math.min(1,progress))*profile.lengthM;
  for(const run of profile.segments){
    if(!run.length||distanceM<run[0].distanceM||distanceM>run.at(-1).distanceM)continue;
    return {distanceM,elevationM:interpolate(run,distanceM),gradePercent:interpolate(run,distanceM,'gradePercent')};
  }
  return null;
}
