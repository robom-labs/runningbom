// Deterministic discovery only: official declarations, exact editions, no AI/route tracing.
import{load}from'cheerio';import{createHash}from'node:crypto';import{isIP}from'node:net';import{imageSize}from'image-size';
import{parseOfficialGPX}from'./update-course-elevation.mjs';
import{elevationRouteGeometry}from'../apps/mobile/assets/course-src/elevation-profile.mjs';
import{courseEditionMetadata}from'./course-edition-metadata.mjs';
export const courseDigest=value=>createHash('sha256').update(value).digest('hex');
const clean=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const compact=value=>clean(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export const courseDirectoryHost=host=>/(^|\.)(marathongo\.co\.kr|marathon\.pe\.kr|runzoa\.com|runneron\.com|runxel\.com|facebook\.com|instagram\.com|youtube\.com|naver\.com|kakao\.com)$/.test(host);
export function safeCourseURL(raw,base){
 if(typeof raw!=='string'||!raw.trim()||raw.length>4096)return null;
 try{const u=new URL(raw,base);if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname)||!u.hostname.includes('.')||/^(localhost$|.*\.local$|.*\.internal$)/i.test(u.hostname))return null;
  for(const key of ['url','src','target']){const value=u.searchParams.get(key);if(value&&/^(?:[a-z]+:|\/\/)/i.test(value)&&!safeCourseURL(value,u.origin))return null;}
  u.hash='';return u.href;
 }catch{return null;}
}
export function disciplineKeys(value){
 const s=clean(Array.isArray(value)?value.join(' '):value).toLowerCase(),keys=new Set();
 if(/\bfull\b|풀\s*코스|42[.,](?:195|2)\s*(?:km|k|㎞)/i.test(s))keys.add('Full');
 if(/\bhalf\b|하프|21[.,](?:0975|1)\s*(?:km|k|㎞)/i.test(s))keys.add('Half');
 for(const m of s.matchAll(/(?:^|[^a-z\d])([1-9]\d{0,2}(?:[.,]\d{1,4})?)\s*(?:km|k|킬로미터)(?![a-z])/gi)){
  const n=Number(m[1].replace(',','.'));if([42.195,42.2].includes(n))keys.add('Full');else if([21.0975,21.1].includes(n))keys.add('Half');else keys.add(n+'K');
 }
 return [...keys].sort((a,b)=>distanceKm(a)-distanceKm(b));
}
export const distanceKm=key=>key==='Full'?42.195:key==='Half'?21.0975:Number(String(key).replace(/K$/i,''));
export const distanceLabel=key=>key==='Full'?'풀코스':key==='Half'?'하프':key;
export const courseDisciplineLiteral=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim();
export function plainCourseDivisionKey(label){
 if(typeof label!=='string')return null;const value=courseDisciplineLiteral(label);
 if(!/^(?:[1-9]\d{0,2}(?:[.,]\d{1,4})?\s*(?:km|k|킬로미터)|full|half|풀코스|하프)$/i.test(value))return null;
 const parsed=disciplineKeys(value);return parsed.length===1?parsed[0]:null;
}
export function currentCourseOption(race,label){
 const literal=courseDisciplineLiteral(label),key=plainCourseDivisionKey(label),options=race.distances||[];
 const matches=key?options.filter(d=>plainCourseDivisionKey(d)===key):options.filter(d=>!plainCourseDivisionKey(d)&&courseDisciplineLiteral(d)===literal);
 if(!literal||matches.length!==1)return null;const actual=courseDisciplineLiteral(matches[0]),parsed=disciplineKeys(actual);
 return{kind:key?'plain':'named',literal:actual,key:key||(parsed.length===1?parsed[0]:null),identity:key?'key:'+key:'literal:'+actual};
}
function scopeDeclaration(text,literal){
 const value=courseDisciplineLiteral(text);if(value===literal)return true;
 if(!value.startsWith(literal))return false;const suffix=value.slice(literal.length).trim();
 return /^(?:(?:공식|확정)\s*)?(?:코스도|코스\s*(?:안내|지도|소개)|경로도|지도|course(?: map| guide)?|route map|gpx|다운로드)$/i.test(suffix);
}
function declaredCourseScope(race,item){
 const fields=[['asset-caption',item.primaryCaption],['local-heading',item.localHeading],['asset-label',item.label]].filter(([,v])=>v);
 for(const [declarationKind,declaration]of fields){
  const matches=(race.distances||[]).filter(d=>scopeDeclaration(declaration,courseDisciplineLiteral(d))).map(d=>currentCourseOption(race,d)).filter(Boolean);
  // Canonical plain aliases in a literal caption may differ (5km vs 5K), but
  // a named division is NEVER inferred from its numeric portion or a filename.
  const stripped=courseDisciplineLiteral(declaration).replace(/(?:\s*(?:(?:공식|확정)\s*)?(?:코스(?:도|안내|지도|소개)?|course(?: map| guide)?|route map|경로도|지도|gpx))+$/i,'').trim();
  if(!matches.length){const plain=plainCourseDivisionKey(stripped),option=plain&&currentCourseOption(race,stripped);if(option)matches.push(option);}
  const unique=[...new Map(matches.map(m=>[m.identity,m])).values()];
  if(unique.length===1)return{...unique[0],declaration:courseDisciplineLiteral(declaration),declarationKind};
  if(unique.length>1)return null;
  // Do not borrow a filename/nearby heading over a conflicting explicit caption.
  if(declarationKind==='asset-caption'&&stripped)return{blocked:true};
 }
 return null;
}
export function namedCourseScopeProof(c,race,sourcePages=[]){
 const option=currentCourseOption(race,c.distanceLabel),e=c.discoveryEvidence,s=e?.disciplineScope;
 if(option?.kind!=='named'||s?.schemaVersion!==1||s.kind!=='official-literal-asset-declaration'||s.sourceRepresentation!=='raw-html'||!['asset-caption','local-heading','asset-label'].includes(s.declarationKind)||s.literal!==option.literal||s.eventId!==race.id||s.raceDate!==race.raceDate||s.pageUrl!==e.pageUrl||s.pageSha256!==e.pageSha256||s.pageCheckedAt!==e.pageCheckedAt||s.assetUrl!==e.declaredUrl||s.assetUrl!==c.sourceUrl||s.assetSha256!==c.sourceSha256||s.assetCheckedAt!==e.assetCheckedAt||s.assetFinalUrl!==c.imageUrl||!scopeDeclaration(s.declaration,option.literal))return false;
 return sourcePages.some(p=>p.verified&&p.sourceRepresentation==='raw-html'&&p.url===s.pageUrl&&p.sha256===s.pageSha256&&p.checkedAt===s.pageCheckedAt&&p.editionEvidence?.accepted&&p.editionEvidence.raceDate===race.raceDate&&p.disciplineDeclarations?.some(d=>d.assetUrl===s.assetUrl&&d.literal===s.literal&&d.kind==='named'&&d.declaration===s.declaration&&d.declarationKind===s.declarationKind));
}
export function materializeCoursePage(html,url){
 if(typeof html!=='string'||Buffer.byteLength(html,'utf8')>4000000)throw Error('course-page-parser-byte-budget');
 const $=load(html),title=clean($('title').text()),primary=clean($('h1,h2,h3').slice(0,8).text()+' '+($('meta[property="og:title"]').attr('content')||''));
 const metadata=courseEditionMetadata($,url);
 const structured=[];$('script[type="application/ld+json"]').each((_,el)=>{try{const value=JSON.parse($(el).text());const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(/SportsEvent|Event/.test(String(v['@type'])))structured.push({name:clean(v.name),startDate:v.startDate,endDate:v.endDate,url:v.url});if(v['@graph'])visit(v['@graph']);}};visit(value);}catch{}});
 $('script,style,noscript,footer').remove();const text=clean(title+' '+$('body').text());
 const links=[],images=[],add=(list,raw,label,context,extra={})=>{const target=safeCourseURL(raw,url);if(target&&!list.some(x=>x.url===target))list.push({url:target,label:clean(label),context:clean(context).slice(0,350),...extra});};
 $('a[href],iframe[src],frame[src]').each((_,el)=>{const n=$(el);add(links,n.attr('href')||n.attr('src'),n.text()||n.attr('title'),n.closest('li,figure,article,section,td').text(),{frame:/^(iframe|frame)$/.test(el.tagName)});});
 const current=safeCourseURL(url),selfLabels=links.filter(l=>l.url===current).map(l=>l.label).filter(l=>disciplineKeys(l).length===1),selectedKeys=[...new Set(selfLabels.flatMap(disciplineKeys))];
 $('img').each((_,el)=>{const n=$(el),container=n.closest('figure,.course-item,.course-box,.widget,td,section,article');let heading='';
  // A local preceding text block is authoritative; a whole navigation/menu is not.
  for(let cursor=n,depth=0;cursor.length&&depth<4&&!heading;cursor=cursor.parent(),depth++){
   const prior=cursor.prevAll().filter((_,p)=>!!clean($(p).text())).first(),caption=clean(prior.text());
   if(caption.length<=160&&disciplineKeys(caption).length===1&&!prior.find('img,nav').length)heading=caption;
  }
  heading=heading||n.prevAll('h1,h2,h3,h4,h5').first().text()||container.find('h1,h2,h3,h4,h5').first().text();
  const primaryCaption=clean([n.attr('alt'),n.attr('title'),n.closest('figure').find('figcaption').text()].join(' ')),label=clean([primaryCaption,heading].join(' '));
  const context=[n.attr('class'),n.attr('id'),container.attr('class'),container.attr('id')].join(' ');
  let raw=n.attr('data-original')||n.attr('data-src')||n.attr('data-lazy-src')||n.attr('src');
  const srcset=n.attr('srcset');if(srcset){const largest=srcset.split(',').map(v=>v.trim().split(/\s+/)).sort((a,b)=>Number(b[1]?.replace(/[wx]/g,''))-Number(a[1]?.replace(/[wx]/g,'')))[0]?.[0];if(largest)raw=largest;}
  add(images,raw,label,context,{primaryCaption,localHeading:clean(heading),pageDistanceKeys:selectedKeys.length===1?selectedKeys:[]});
 });
 $('[style]').each((_,el)=>{const n=$(el),context=[n.attr('class'),n.attr('id'),n.prevAll('h1,h2,h3,h4').first().text()].join(' ');if(/코스|course|route/i.test(context))for(const m of(n.attr('style')||'').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))add(images,m[1],n.attr('aria-label')||n.prevAll('h1,h2,h3,h4').first().text(),context);});
 return{url,title,primary,text,structured,metadata,links,images,selectedDistanceKeys:selectedKeys.length===1?selectedKeys:[]};
}
export function exactCourseEdition(race,page){
 const [year,month,day]=race.raceDate.split('-').map(Number),title=page.title+' '+page.primary,years=[...title.matchAll(/20\d{2}/g)].map(m=>Number(m[0]));
 const stem=clean(race.name).replace(/20\d{2}|(?:제\s*)?\d+\s*회|마라톤|대회|국제|전국|특별자치시|특례시/g,' ').trim();
 const identity=compact(stem),words=stem.split(/[\s,&()·-]+/).map(compact).filter(w=>w.length>=2&&!['함께하는','함께','with','the'].includes(w));
 if(page.metadata?.issue)return {accepted:false,reason:page.metadata.issue};
 const fits=value=>{const s=compact(value);return identity.length>=3&&s.includes(identity)||words.length>0&&words.every(w=>s.includes(w));};
 const metadata=page.metadata?.descriptions.filter(d=>fits(d.text))||[];
 const text=compact(page.text),matchedWords=words.filter(w=>text.includes(w));
 const identityOK=identity.length>=3&&text.includes(identity)||words.length>0&&matchedWords.length===words.length;
 if(!identityOK&&!metadata.length)return{accepted:false,reason:'event-identity-not-established',matchedWords};
 if(years.some(y=>y!==year))return{accepted:false,reason:'title-edition-conflict',years,matchedWords};
 const literal=new RegExp(`(?:^|[^\\d])${year}\\s*(?:년|[./-])\\s*0?${month}\\s*(?:월|[./-])\\s*0?${day}(?!\\d)`);
 const splitYear=new RegExp(`(?:^|[^\\d])${year}\\s*년[^\\d]{0,50}0?${month}\\s*월\\s*0?${day}(?!\\d)`);
 const monthDay=new RegExp(`(?:^|[^\\d])0?${month}\\s*월\\s*0?${day}\\s*일`);
 const full=page.text.match(literal)||page.text.match(splitYear);
 const structured=page.structured.find(e=>String(e.startDate).slice(0,10)===race.raceDate&&words.length&&words.every(word=>compact(e.name).includes(word)));
 const short=years.includes(year)&&page.text.match(monthDay);
 const meta=metadata.map(d=>({...d,match:d.text.match(literal)||d.text.match(splitYear)})).find(d=>d.match);
 if(metadata.some(d=>/20\d{2}\s*(?:년|[./-])\s*\d{1,2}\s*(?:월|[./-])\s*\d{1,2}/.test(d.text)&&!literal.test(d.text)&&!splitYear.test(d.text)))return {accepted:false,reason:'metadata-event-date-conflict',matchedWords};
 const local=compact(title),primaryIdentity=identity.length>=3&&local.includes(identity)||words.length>0&&words.every(w=>local.includes(w));
 if(!full&&!short&&!structured&&!meta)return{accepted:false,reason:'exact-event-date-not-established',matchedWords,primaryIdentity,identityOK};
 if(meta&&!full&&!short&&!structured)return {accepted:true,raceDate:race.raceDate,year:String(year),matchedDate:clean(meta.match[0]),method:'official-head-description-exact-date',metadataKind:meta.kind,matchedWords:words,excerpt:meta.text.slice(Math.max(0,meta.match.index-100),meta.match.index+220)};
 const match=full?.[0]||short?.[0]||structured.startDate;
 return{accepted:true,raceDate:race.raceDate,year:String(year),matchedDate:clean(match),method:structured?'official-structured-event':full?'explicit-year-month-day':'title-year-and-explicit-month-day',matchedWords,excerpt:page.text.slice(Math.max(0,page.text.indexOf(match)-100),page.text.indexOf(match)+220)};
}
const courseWords=/코스|주로|경로|course|route|\.gpx(?:[?#]|$)/i;
const forbidden=/로그인|비밀번호|개인정보|환불|문의|변경\s*신청|변경\s*가능|참가자유|login|password|privacy|refund|application|\/apply(?:[/?-]|$)|\/board\/(?:games|free|qna)\b/i;
export function officialPageKind(page,via={}){
 if(forbidden.test(page.title+' '+new URL(page.url).pathname))return 'excluded-user-or-account-page';
 return courseWords.test(page.title+' '+new URL(page.url).pathname+' '+via.label)&&!/(?:주차|오시는|대회장\s*배치)/.test(page.title)?'course':'event';
}
export function discoverDeclaredCourseAssets(race,page,{pageKind='event'}={}){
 const valid=disciplineKeys(race.distances),out=[],seen=new Set();
 const add=(item,kind)=>{
  if(seen.has(item.url))return;let decoded=item.url;try{decoded=decodeURIComponent(decoded);}catch{}
  const own=clean(item.label+' '+(item.localHeading||'')+' '+decoded),context=clean(own+' '+item.context);
  if(/시상|기념품|사이즈|싱글렛|티셔츠|제품.*스펙|주차|배치도|고저도|고도표|elevation[-_ ]?(?:profile|chart)|high[_-]and[_-]low|logo|mascot|banner|icon|button|btn|default_profile|avatar|size[-_ ]?(?:chart|guide)|scenery|course-card__media|course-guide-visual/i.test(context))return;
  const years=[...new URL(item.url).pathname.matchAll(/(?:^|\D)(20\d{2})(?!\d)/g)].map(m=>m[1]);
  if(years.some(y=>y!==race.raceDate.slice(0,4)))return;
  const explicit=kind==='gpx'||/코스도|코스\s*(?:안내|소개|지도)|경로도|course[-_ /]*(?:map|guide)|route[-_ /]*map|(?:^|[\/_. -])(?:course|route)(?:[\/_.? -]|\d)/i.test(context);
  const captionKeys=disciplineKeys(item.primaryCaption),localKeys=captionKeys.length?captionKeys:disciplineKeys(item.label+' '+(item.localHeading||'')),pageKeys=item.pageDistanceKeys||[];
  const dedicated=pageKind==='course'&&(localKeys.length===1||pageKeys.length===1);
  if(!explicit&&!(pageKind==='course'&&courseWords.test(item.label))&&!dedicated)return;
  const assetURL=new URL(assetFileURL(item.url));let fileText;try{fileText=decodeURIComponent(assetURL.pathname.split('/').at(-1)||'');}catch{return;}
  fileText=fileText.replace(/[_-]/g,' ').replace(/\bhalf(?=\d)/i,'half ').replace(/\bfull(?=\d)/i,'full ');
  const filenameKeys=disciplineKeys(fileText),observed=filenameKeys.length?filenameKeys:localKeys.length?localKeys:pageKeys,keys=observed.filter(key=>valid.includes(key));
  const declaredScope=declaredCourseScope(race,item);
  const distanceKeys=declaredScope?.key?[declaredScope.key]:declaredScope?[]:keys.length?keys:valid.length===1&&!observed.length?valid:[];
  seen.add(item.url);out.push({...item,kind,distanceKeys,...(declaredScope&&!declaredScope.blocked?{declaredScope}:{}),distanceEvidence:declaredScope?.blocked?'unresolved-literal-scope':declaredScope?.kind==='named'?'explicit-literal-asset-declaration':keys.length?'explicit-asset-caption-or-filename':distanceKeys.length?'single-official-discipline':'unresolved-no-guess',explicitCourseDeclaration:explicit||dedicated});
 };
 for(const l of page.links)if(/\.gpx(?:[?#]|$)/i.test(l.url))add(l,'gpx');else if(/\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i.test(l.url)&&courseWords.test(l.label+' '+l.url))add(l,'image');
 for(const i of page.images)add(i,'image');return out;
}
function assetFileURL(url){const u=new URL(url),nested=u.searchParams.get('url');return nested?safeCourseURL(nested,u.origin)||u.href:u.href;}
export function declaredPublishedGeometryLinks(page){return page.links.flatMap(link=>{
 const u=new URL(link.url),format=/\.kml(?:[?#]|$)/i.test(link.url)?'kml':/\.geojson(?:[?#]|$)/i.test(link.url)?'geojson':/(^|\.)google\.com$/.test(u.hostname)&&/^\/maps\/d\/(?:u\/\d+\/)?(?:viewer|edit|embed)/.test(u.pathname)&&u.searchParams.get('mid')?'google-mymaps':null;
 return format&&courseWords.test(link.label+' '+link.context)?[{url:link.url,format,label:link.label,sourcePage:page.url,geometryParsed:false,catalogPromotion:false}]:[];
});}
export function courseNavigations(page,seedOrigins){return page.links.filter(l=>seedOrigins.has(new URL(l.url).origin)&&!forbidden.test(l.label+' '+l.url)&&!courseDirectoryHost(new URL(l.url).hostname)&&!/^https?:.*\.(?:png|jpe?g|webp|gif|gpx)(?:[?#]|$)/i.test(l.url)&&(l.frame||courseWords.test(l.label+' '+l.url)||/대회\s*(안내|요강|소개|개요)|overview|\/info(?:[./?]|$)|\/guide|\/about/i.test(l.label+' '+l.url))).sort((a,b)=>Number(courseWords.test(b.label+' '+b.url))-Number(courseWords.test(a.label+' '+a.url)));}
export function assessCourseAsset(race,candidate,receipt){
 if(!receipt.ok||!receipt.body||courseDigest(receipt.body)!==receipt.sha256)throw Error('asset-receipt-integrity');
 if(!candidate.distanceKeys.length&&!(candidate.kind==='image'&&candidate.declaredScope?.kind==='named'))throw Error('discipline-unresolved');
 if(candidate.kind==='image'){
  const b=receipt.body,magic=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b[0]===255&&b[1]===216&&b[2]===255||b.subarray(0,6).toString().startsWith('GIF8')||b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
  if(!magic||!/^image\//i.test(receipt.contentType||''))throw Error('not-an-actual-raster-image');const size=imageSize(b);
  if(size.width<220||size.height<150||size.width*size.height<70000)throw Error('image-too-small');
  if(b.length>10000000||size.width>16000||size.height>16000||size.width*size.height>40000000||Math.max(size.width/size.height,size.height/size.width)>20)throw Error('image-byte-or-pixel-budget');
  return{kind:'official-image',width:size.width,height:size.height,noGeometry:true,noElevation:true};
 }
 const xml=receipt.body.toString('utf8'),parsed=parseOfficialGPX(xml.replace(/<((?:\w+:)?trkpt)\b([^>]*?)\/\s*>/gi,'<$1$2></$1>')),geometry=elevationRouteGeometry(parsed);
 if(candidate.distanceKeys.length!==1)throw Error('gpx-discipline-must-be-unambiguous');
 const km=distanceKm(candidate.distanceKeys[0]);if(Math.abs(geometry.lengthM/1000-km)>Math.max(.15,km*.05))throw Error('gpx-distance-does-not-match-official-discipline');
 return{kind:'official-gpx',segments:parsed.segments,lengthM:geometry.lengthM,elevation:parsed,requiresSourceBoundDEM:true};
}
export function courseCandidate(race,asset,receipt,pageProof,assessment){
 const idBase='discovered-'+courseDigest([race.id,race.raceDate,asset.kind,asset.url].join('|')).slice(0,16),date=receipt.checkedAt.slice(0,10);
 const scopes=asset.declaredScope?[asset.declaredScope]:asset.distanceKeys.map(key=>({key,kind:'plain',literal:distanceLabel(key)}));
 return scopes.map(scope=>{const key=scope.key;return{
  id:idBase+'-'+(scope.kind==='named'?courseDigest(scope.identity).slice(0,12):key.toLowerCase()),eventId:race.id,eventName:race.name,raceDate:race.raceDate,
  distanceLabel:scope.kind==='named'?scope.literal:distanceLabel(key),...(key?{officialDistanceKm:pageProof.publishedDistanceKm?.[key]??distanceKm(key)}:{}),sourceKind:assessment.kind,
  sourcePage:pageProof.url,sourceUrl:asset.kind==='image'?asset.url:receipt.finalUrl,imageUrl:asset.kind==='image'?receipt.finalUrl:undefined,
  sourceSha256:receipt.sha256,checkedAt:date,segments:asset.kind==='image'?[]:assessment.segments,
  startLabel:'공식 코스 안내 참고',endLabel:'공식 코스 안내 참고',
  notice:asset.kind==='image'?'공식 페이지에 선언된 이미지형 코스도 · 경로·고도 재생 없음'+(['Half','Full'].includes(key)&&!pageProof.publishedDistanceKm?.[key]?' · 거리는 표준 종목 분류값이며 실측 경로 거리가 아님':''):'공식 GPX 원본 · 고도 보완 및 출처 결합 검증 전 후보',
  reuseStatus:'official-page-declared; redistribution-rights-not-established',
  discoveryEvidence:{schemaVersion:1,pageUrl:pageProof.url,pageKind:pageProof.pageKind,pageSha256:pageProof.sha256,pageCheckedAt:pageProof.checkedAt,
   editionEvidence:pageProof.editionEvidence,declaredUrl:asset.url,distanceEvidence:asset.distanceEvidence,distanceKey:key,declaredDistanceKeys:asset.distanceKeys,
   distanceBasis:!key?'official-literal-no-numeric-distance':asset.kind==='image'&&['Half','Full'].includes(key)&&!pageProof.publishedDistanceKm?.[key]?'standard-category-nominal':'official-declared-numeric',
   ...(scope.kind==='named'?{disciplineScope:{schemaVersion:1,kind:'official-literal-asset-declaration',sourceRepresentation:pageProof.sourceRepresentation||'unknown',literal:scope.literal,eventId:race.id,raceDate:race.raceDate,pageUrl:pageProof.url,pageSha256:pageProof.sha256,pageCheckedAt:pageProof.checkedAt,assetUrl:asset.url,assetSha256:receipt.sha256,assetFinalUrl:receipt.finalUrl,assetCheckedAt:receipt.checkedAt,declaration:scope.declaration,declarationKind:scope.declarationKind}}:{}),
   ...(asset.kind==='image'?{distanceIsMeasuredRoute:false,...(['Half','Full'].includes(key)&&!pageProof.publishedDistanceKm?.[key]?{nominalDistanceKm:distanceKm(key)}:{})}:{}),
   assetCheckedAt:receipt.checkedAt,explicitCourseDeclaration:asset.explicitCourseDeclaration,
   validatedRaster:asset.kind==='image'?{width:assessment.width,height:assessment.height,bytes:receipt.body.length,mime:receipt.contentType}:undefined,
   source:'deterministic-official-source-discovery',candidateOnly:true,requiresVisualReview:asset.kind==='image',requiresDEM:asset.kind==='gpx'}
 };});
}
export function validCourseNavigationFrontier(race,seeds,frontier,{now=Date.now()}={}){
 if(!Array.isArray(frontier))return[];
 return frontier.slice(0,16).filter(f=>{
  const age=now-Date.parse(f?.checkedAt);if(f?.eventId!==race.id||f.raceDate!==race.raceDate||!seeds.some(s=>s.url===f.seedURL)||!Number.isFinite(age)||age< -300000||age>7*86400000||!/^[a-f0-9]{64}$/.test(f.anchorSha256||''))return false;
  const urls=[f.url,f.anchorURL,f.seedURL].map(u=>safeCourseURL(u));return urls.every(Boolean)&&urls.every(u=>new URL(u).origin===new URL(urls[0]).origin)&&!forbidden.test(f.url+' '+(f.label||''));
 });
}
export async function discoverRaceCourseSources(race,{seeds,get,knownPages=[],maxPages=7,maxAssets=5,frontier=[],now=Date.now()}){
 const savedFrontier=validCourseNavigationFrontier(race,seeds,frontier,{now}),resume=savedFrontier[0],resumeTargets=resume?savedFrontier.filter(f=>f.anchorURL===resume.anchorURL):[];
 const seedOrigins=new Set(seeds.map(s=>new URL(s.url).origin)),queue=resume?[{url:resume.anchorURL,seedURL:resume.seedURL,depth:0,resumeAnchor:true}]:seeds.map(s=>({...s,depth:0})),seen=new Set(),assetsSeen=new Set(),pages=[],candidates=[],issues=[],proofs=new Map(),pending=savedFrontier.filter(f=>f.anchorURL!==resume?.anchorURL);
 // Frontier entries are navigation hints, NEVER cached edition/asset approval.
 // The anchor and its declared child must be re-read and revalidated this run.
 const defer=(url,label,proof)=>{
  const anchor=proof.editionEvidence.method==='same-origin-direct-declaration'?proofs.get(proof.editionEvidence.inheritedFrom):proof;
  if(!anchor?.verified||anchor.editionEvidence.method==='same-origin-direct-declaration'||new URL(url).origin!==new URL(anchor.url).origin)return;
  if(pending.some(f=>f.url===url&&f.anchorURL===anchor.url))return;
  if(pending.length>=16){issues.push({url,reason:'frontier-cap-quarantined-not-complete'});return;}
  pending.push({eventId:race.id,raceDate:race.raceDate,url,label,anchorURL:anchor.url,anchorSha256:anchor.sha256,seedURL:anchor.seedURL,checkedAt:anchor.checkedAt});
 };
 // Saved pages are still required to be reachable from current seeds by declared links.
 const saved=new Map(knownPages.map(p=>[p.url,p]));
 while(queue.length&&pages.length<maxPages){
  const item=queue.shift();if(seen.has(item.url))continue;seen.add(item.url);
  const receipt=await get(item.url,{kind:'page'});if(!receipt.ok){pages.push({url:item.url,verified:false,reason:receipt.reason});
   const parent=proofs.get(item.declaredBy);if(parent&&/network-budget/.test(receipt.reason||''))defer(item.url,item.label,parent);
   if(item.resumeAnchor){pending.push(...savedFrontier.filter(f=>!pending.some(p=>p.url===f.url&&p.anchorURL===f.anchorURL)).slice(0,16-pending.length));queue.push(...seeds.map(s=>({...s,depth:0})));}continue;}
  if(!receipt.body||courseDigest(receipt.body)!==receipt.sha256){pages.push({url:item.url,verified:false,reason:'page-receipt-integrity'});continue;}
  if(pages.some(p=>p.url===receipt.finalUrl))continue;
  if(!/html/i.test(receipt.contentType||'')){issues.push({url:item.url,reason:'non-html-official-page'});continue;}
  if(!safeCourseURL(receipt.finalUrl)||!seedOrigins.has(new URL(receipt.finalUrl).origin)){pages.push({url:item.url,verified:false,reason:'official-final-page-scope-mismatch'});continue;}
  let page;try{page=materializeCoursePage(receipt.text??receipt.body.toString('utf8'),receipt.finalUrl);}catch(error){pages.push({url:item.url,verified:false,reason:error.message});continue;}
  const edition=exactCourseEdition(race,page),kind=officialPageKind(page,item);
 const parentProof=proofs.get(item.declaredBy),inherited=parentProof&&(edition.primaryIdentity===true||kind==='course'&&edition.identityOK===true)&&new URL(page.url).origin===new URL(parentProof.url).origin&&edition.reason==='exact-event-date-not-established';
  const accepted=kind!=='excluded-user-or-account-page'&&(edition.accepted||inherited);
  const proof={url:page.url,sourceRepresentation:receipt.sourceRepresentation||(receipt.verification==='live-public-https'?'raw-html':'unknown'),pageKind:kind,verified:!!accepted,title:page.title,checkedAt:receipt.checkedAt,sha256:receipt.sha256,verification:receipt.verification??'saved-audit',editionEvidence:edition.accepted?edition:inherited?{...parentProof.editionEvidence,method:'same-origin-direct-declaration',inheritedFrom:parentProof.url,directlyDeclared:true}:edition,seedURL:item.seedURL||item.url,declaredBy:item.declaredBy??null,publishedGeometryLinks:accepted?declaredPublishedGeometryLinks(page):[]};
  proof.publishedDistanceKm={...(inherited?parentProof.publishedDistanceKm:{})};
  for(const m of page.text.matchAll(/(?:^|[^\d])(21[.,](?:0975|1)|42[.,](?:195|2))\s*(?:km|k|㎞|킬로미터)(?![a-z\d])/gi)){const km=Number(m[1].replace(',','.'));proof.publishedDistanceKm[km<30?'Half':'Full']=km;}
  if(kind==='course'&&page.selectedDistanceKeys?.length)proof.distanceLabels=page.selectedDistanceKeys.map(distanceLabel);
  pages.push(proof);if(accepted)proofs.set(page.url,proof);
  if(item.resumeAnchor&&!edition.accepted){issues.push({url:page.url,reason:'frontier-anchor-current-exact-edition-required'});queue.push(...seeds.map(s=>({...s,depth:0})));continue;}
  const navigations=courseNavigations(page,seedOrigins).slice(0,8);
  if(item.resumeAnchor){const order=new Map(resumeTargets.map((f,i)=>[f.url,i]));navigations.sort((a,b)=>(order.get(a.url)??99)-(order.get(b.url)??99));
   for(const f of resumeTargets)if(f.url!==page.url&&!navigations.some(l=>l.url===f.url))issues.push({url:f.url,reason:'frontier-target-no-longer-declared'});
  }
  for(const link of navigations)if(item.depth<2)queue.push({...link,depth:item.depth+1,declaredBy:page.url,seedURL:item.seedURL||item.url});
  // Reuse a cached approved/old-audit course page only when the same parent explicitly declares it.
  for(const link of page.links)if(saved.has(link.url)&&new URL(link.url).origin===new URL(page.url).origin&&item.depth<2&&!forbidden.test(link.url+' '+link.label))queue.push({...link,depth:item.depth+1,declaredBy:page.url,seedURL:item.seedURL||item.url});
  if(!accepted)continue;
  for(const asset of discoverDeclaredCourseAssets(race,page,{pageKind:kind})){
   if(!asset.distanceKeys.length&&!(asset.kind==='image'&&asset.declaredScope?.kind==='named')){issues.push({url:asset.url,reason:'discipline-unresolved-no-request'});continue;}
   if(asset.declaredScope){proof.disciplineDeclarations??=[];proof.disciplineDeclarations.push({assetUrl:asset.url,literal:asset.declaredScope.literal,kind:asset.declaredScope.kind,declaration:asset.declaredScope.declaration,declarationKind:asset.declaredScope.declarationKind});}
   if(asset.kind==='gpx'&&asset.distanceKeys.some(key=>['Half','Full'].includes(key)&&!proof.publishedDistanceKm[key])){issues.push({url:asset.url,reason:'gpx-named-discipline-numeric-distance-not-published-no-guess'});continue;}
   if(assetsSeen.has(asset.url))continue;if(assetsSeen.size>=maxAssets){defer(page.url,item.label||page.title,proof);issues.push({url:asset.url,reason:'asset-cap-deferred-not-complete'});continue;}assetsSeen.add(asset.url);
   try{const receipt=await get(asset.url,{kind:asset.kind});if(!receipt.ok&&/network-budget/.test(receipt.reason||'')){defer(page.url,item.label||page.title,proof);throw Error(receipt.reason);}const assessment=assessCourseAsset(race,asset,receipt);candidates.push(...courseCandidate(race,asset,receipt,proof,assessment));}
   catch(error){issues.push({url:asset.url,reason:error.message});}
  }
 }
 const verified=pages.filter(p=>p.verified),coursePages=verified.filter(p=>p.pageKind==='course');
 for(const item of queue){const parent=proofs.get(item.declaredBy);if(parent)defer(item.url,item.label,parent);}
 return{eventId:race.id,eventName:race.name,raceDate:race.raceDate,distanceKeys:disciplineKeys(race.distances),seedUrls:seeds.map(s=>s.url),status:coursePages.length?'verified-course-page':verified.length?'verified-event-page':pages.some(p=>/network-budget/.test(p.reason||''))?'pending-budget':'unverified',resolvedOfficialPages:verified,observations:pages,issues,candidates,navigationFrontier:pending.slice(0,16)};
}
export function mergeCourseDiscoveryIndex(previous,records,races){
 const current=new Map(races.map(r=>[r.id,r]));return records.map(row=>{const old=previous?.records?.find(p=>p.eventId===row.eventId&&p.raceDate===row.raceDate),race=current.get(row.eventId);
  if(!race||race.raceDate!==row.raceDate)throw Error('discovery index edition mismatch');
  if(!old?.resolvedOfficialPages?.length)return row;
  const retained=old.resolvedOfficialPages.filter(p=>p.verified&&row.seedUrls.includes(p.seedURL));
  const combined=new Map(retained.map(p=>[p.url,p]));for(const p of row.resolvedOfficialPages)combined.set(p.url,p);
  return retained.length?{...row,status:row.resolvedOfficialPages.length?row.status:'retained-last-good',resolvedOfficialPages:[...combined.values()],...(!row.resolvedOfficialPages.length?{lastAttemptStatus:row.status}:{})}:row;
 });
}
