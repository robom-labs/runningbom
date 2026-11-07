// Conservative DOM-content classification, not edition proof or asset approval.
// Never infer publication state from a footer, site banner, URL or absent image.
const clean=v=>String(v??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const ignored='script,style,noscript,template,nav,header,footer,aside,[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"],[hidden],[aria-hidden="true"],.banner,.site-banner,.global-banner,.site-header,.site-footer,.advertisement,.ads';
const blocks='h1,h2,h3,h4,h5,h6,p,div,li,td,th,figcaption,blockquote,section,article';
const subject=/(?:코스도|코스\s*(?:안내|지도|맵|경로)?|주로도|경로도|course\s*(?:map|guide|route)?|route\s*map)/i;
const pending=/(?:추후\s*(?:공개|안내|공지|게시|업데이트)|(?:공개|게시|안내)\s*(?:예정|준비\s*중)|(?:코스도?|지도|course\s*map)\s*미공개|준비\s*중|coming\s+soon|not\s+(?:yet\s+)?(?:published|available)|to\s+be\s+(?:published|announced))/i;
const otherSubject=/기념품|셔츠|티셔츠|시상|참가자|접수|배번호|주차|교통|환불|굿즈|영상|앨범|인터뷰|souvenir|registration|parking|race\s*kit|prize|video|photo|interview/i;
const courseHeading=t=>t.length<=100&&subject.test(t)&&!otherSubject.test(t)&&!pending.test(t)&&!/변경|수정|change|update/i.test(t);
const pendingStatus=t=>pending.test(t)&&!otherSubject.test(t)&&!/미공개\s*(?:가\s*)?(?:아니|아닙)|(?:예정|준비\s*중)(?:이|은|는)?\s*(?:아니|아닙)|not\s+coming\s+soon/i.test(t);
// A shared list predicate can explicitly include the course alongside sponsors
// or gifts. Do not let the unrelated-subject guard erase that course hold, but
// require a noun-only list: separate sentences about already published courses
// and upcoming gifts are not course-publication evidence.
function listedCoursePending(text){
 if(text.length>220)return false;
 const match=text.match(/^(.+?)\s+(추후\s*(?:공개|안내|공지)(?:\s*예정)?|coming\s+soon|to\s+be\s+(?:published|announced))\s*[.!…]*$/i);
 if(!match)return false;
 const items=match[1].split(/\s*(?:[,·ㆍ/&]|\s+(?:및|와|과|and)\s+)\s*/i).filter(Boolean);
 const courseNoun=/^(?:러닝\s*)?(?:코스(?:도|\s*안내|\s*지도|맵|경로)?|주로도|경로도)$|^(?:running\s+)?(?:course(?:\s+(?:map|guide|route))?|route\s+map)$/i;
 const otherNoun=/^(?:스폰서|후원사|(?:완주\s*)?기념품|sponsors?|(?:finisher\s+)?(?:gifts?|souvenirs?|medals?))$/i;
 return items.length>=2&&items.length<=6&&items.some(v=>courseNoun.test(v))&&items.every(v=>courseNoun.test(v)||otherNoun.test(v));
}
const inlinePending=t=>listedCoursePending(t)||t.length<=400&&t.split(/(?<=[.!?])\s+|[。;]/).some(part=>subject.test(part)&&pendingStatus(part)&&!/(?:변경|수정|change|update)\s*(?:사항|내용|details?)?\s*(?:은|을|를|이|가|:)?\s*(?:추후|공개|공지|coming)/i.test(part));

// Parse inline declarations only: no stylesheet fetch, CSSOM or layout claim.
// Quotes, comments and function parentheses cannot introduce declarations.
function inlineHidden(style=''){
 const declarations=[];let part='',quote='',depth=0,comment=false;
 for(let i=0;i<style.length;i++){
  const c=style[i],next=style[i+1];
  if(comment){if(c==='*'&&next==='/'){comment=false;i++;part+=' ';}continue;}
  if(c==='\\'){part+=c+(next||'');i++;continue;}
  if(quote){part+=c;if(c===quote)quote='';continue;}
  if(c==='/'&&next==='*'){comment=true;i++;continue;}
  if(c==='"'||c==="'"){quote=c;part+=c;continue;}
  if(c==='(')depth++;if(c===')')depth--;
  if(c===';'&&depth===0){declarations.push(part);part='';}else part+=c;
 }
 // Ambiguous/malformed CSS cannot justify removing visible evidence.
 if(quote||comment||depth!==0)return false;
 declarations.push(part);const winning=new Map();
 for(const declaration of declarations){
  const match=declaration.match(/^\s*(display|visibility)\s*:\s*([\s\S]*?)\s*$/i);if(!match)continue;
  let value=match[2],important=/!\s*important\s*$/i.test(value);
  if(important)value=value.replace(/!\s*important\s*$/i,'').trim();
  if(!value)continue;
  const key=match[1].toLowerCase(),prior=winning.get(key);
  // Unknown values remain unknown, not evidence of hidden content. Important
  // declarations beat normal declarations; otherwise the last declaration wins.
  if(!prior||important||!prior.important)winning.set(key,{value:value.toLowerCase(),important});
 }
 return winning.get('display')?.value==='none'||['hidden','collapse'].includes(winning.get('visibility')?.value);
}

export function classifyCourseContent($,region,{safeURL,baseURL}={}){
 // materializeCoursePage supplies a separate DOM with site chrome removed.
 // Clone the region so classification cannot mutate edition/asset parsing.
 if(region.is(ignored)||region.parents(ignored).length||region.add(region.parents()).toArray().some(el=>inlineHidden($(el).attr('style'))))return{status:'unknown',evidence:[]};
 const view=region.clone();view.find(ignored).remove();
 view.find('[style]').each((_,el)=>{if(inlineHidden($(el).attr('style')))$(el).remove();});
 const fragments=[];
 view.find(blocks).each((_,el)=>{const n=$(el);if(n.find(blocks).length||n.is(ignored)||n.closest(ignored).length)return;
  // Keep long text as a binding barrier, even though it cannot be evidence.
  const text=clean(n.text());if(text)fragments.push(text);
 });
 const evidence=[];
 for(let i=0;i<fragments.length;i++){
  const text=fragments[i],previous=fragments[i-1]||'';
  if(inlinePending(text))evidence.push({basis:'explicit-course-publication-text',text});
  // Adjacent text-only widgets/sections are common in official page builders.
  // Require an immediately preceding course heading; any intervening content
  // (e.g. racekit heading) breaks the subject binding.
  else if(pendingStatus(text)&&text.length<=100&&courseHeading(previous))evidence.push({basis:'adjacent-course-heading-and-status',heading:previous,text});
 }
 const actual=[];
 view.find('img,a[href],iframe[src],svg').each((_,el)=>{
  const n=$(el),own=clean([n.attr('alt'),n.attr('title'),n.attr('aria-label'),n.is('a')?n.text():''].join(' ')),url=n.attr('href')||n.attr('src')||n.attr('data-src')||'';
  if(!n.is('svg')&&!safeURL?.(url,baseURL))return;
  if(/banner|logo|icon|avatar|parking|주차|고저도|elevation|coming.?soon|page.?ready|준비.?중/i.test(own+' '+url))return;
  if(n.is('svg')&&n.find('path,polyline').length&&subject.test(clean(n.find('title,desc,text').text())))actual.push('declared-inline-course-svg');
  else if(n.is('a')&&/\.gpx(?:[?#]|$)/i.test(url))actual.push('declared-gpx-link');
  else if(n.is('iframe')&&subject.test(own)&&/maps|course|route/i.test(url))actual.push('declared-course-embed');
  else if(subject.test(own)&&!pending.test(own)&&(n.is('img')||n.is('a')&&/\.(?:png|jpe?g|gif|webp|svg|pdf)(?:[?#]|$)/i.test(url)))actual.push('own-labelled-course-content');
 });
 if(evidence.length&&!actual.length)return{status:'unpublished',evidence:evidence.slice(0,8)};
 if(actual.length)return{status:evidence.length?'mixed':'published',evidence:evidence.slice(0,8),publicationSignals:[...new Set(actual)]};
 return{status:'unknown',evidence:[]};
}
