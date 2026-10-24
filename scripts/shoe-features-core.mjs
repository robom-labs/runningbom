// Deterministic, source-bound product copy. Never promotes catalog category text
// into product evidence, never transfers between generations or product URLs.
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
export const FEATURE_EXTRACTOR_VERSION='1.1.0';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const clean=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const normalized=value=>clean(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function shoeFeatureModelKey(p){
 const n=v=>clean(v).toLowerCase(),gender=n(p.gender),width=n(p.width);
 const nike=n(p.brand)==='nike'&&/^[A-Z0-9]{6,8}-\d{3}$/i.test(p.sku||'')?p.sku.split('-')[0]:'';
 const family=nike||(p.modelGroup&&width?p.modelGroup:'');
 return !family||!gender?`item:${p.id}`:[n(p.brand),n(p.modelEn||p.model),gender,width||'style-specific',family].join('|');
}
export function shoeFeaturePageKey(source){
 const u=new URL(source);u.hash='';
 if(u.hostname==='www.brooksrunning.com.au')u.hostname='brooksrunning.com.au';
 if(u.hostname==='asics.co.kr')u.hostname='www.asics.co.kr';
 // These selectors affect size/color, not which parent product is served. The
 // response still has to prove each requested SKU/parent before use.
 for(const key of ['size','variant','colour','color','width'])u.searchParams.delete(key);
 u.searchParams.sort();return u.href;
}
const walkLd=(v,parent=null)=>!v||typeof v!=='object'?[]:Array.isArray(v)?v.flatMap(x=>walkLd(x,parent)):
 [{node:v,parent},...walkLd(v['@graph'],parent),...walkLd(v.hasVariant,v),...walkLd(v.itemListElement,parent),...walkLd(v.item,parent)];
function titleFitsOne(model,title){
 const wanted=normalized(model);
 if(wanted.length<4)return false;
 const simple=clean(model).replace(/\s*-\s*Size\s+\S+.*$/i,'');
 const text=clean(title).toLowerCase();
 const tokens=simple.toLowerCase().match(/[\p{L}]+|\d+(?:\.\d+)?/gu)||[];
 // Word/number boundaries prevent Pegasus 4 matching 42 and Gel Nimbus 28
 // matching a page for 29. Don't drop Plus/Premium/GTX/width qualifiers.
 return tokens.filter(x=>x.length>1||/^\d/.test(x)).every(x=>/^\d/.test(x)?new RegExp(`(^|[^0-9])${x.replace('.','\\.')}([^0-9]|$)`).test(text):normalized(text).includes(normalized(x)));
}
function titleFits(p,title){return [p.model,p.modelEn].filter(Boolean).some(model=>titleFitsOne(model,title));}
export function officialModelTitleMatches(p,title){return titleFits(p,title)&&!genderConflict(p,title);}
function genderConflict(p,title){
 const text=clean(title).toLowerCase();
 if(/junior|kids|주니어|아동|베이비/.test(text))return true;
 const female=/\bwomen(?:'s|s)?\b|여성/.test(text),male=/(?:^|[^a-z])men(?:'s|s)?\b|남성/.test(text);
 return p.gender==='남성'&&female&&!male||p.gender==='여성'&&male&&!female;
}
function ownUrl(node,base){try{return new URL(node.url||node.offers?.url||node['@id']?.split('#')[0]||'',base).href;}catch{return '';}}
function exactSku(p,node){return !!p.sku&&[node.sku,node.mpn,node.productID,node.gtin,node.gtin13].some(v=>normalized(v)===normalized(p.sku));}
const unique=a=>[...new Set(a.filter(Boolean))];
const htmlText=value=>{const $=load(String(value||''));$('script,style,nav,footer').remove();return clean($.text());};
function properties(node){
 return (Array.isArray(node.additionalProperty)?node.additionalProperty:node.additionalProperty?[node.additionalProperty]:[])
 .map(p=>clean(`${p.name||''}: ${p.value||''} ${p.unitText||''}`)).filter(Boolean);
}
export function prepareShoeFeatureDocument(html){
 const $=load(html),ld=[];
 $('script[type="application/ld+json"]').each((_,el)=>{try{ld.push(...walkLd(JSON.parse($(el).text())));}catch{}});
 const inertia=[];
 $('[data-page]').each((_,el)=>{try{const page=JSON.parse($(el).attr('data-page'));if(page?.props?.product)inertia.push(page.props.product);}catch{}});
 return {$,ld,inertia,htmlSha256:digest(html)};
}
export function extractShoeFeatureSource(html,p,{source=p.source,checkedAt=new Date().toISOString(),prepared}={}){
 if(shoeFeaturePageKey(source)!==shoeFeaturePageKey(p.source))return {ok:false,reason:'source-url-mismatch'};
 let decodedSource=source;try{decodedSource=decodeURIComponent(source);}catch{}
 if(genderConflict(p,decodedSource))return {ok:false,reason:'source-gender-conflict'};
 const {$,ld,inertia,htmlSha256}=prepared||prepareShoeFeatureDocument(html);
 const productNodes=ld.filter(({node})=>[node['@type']].flat().some(t=>t==='Product'||t==='ProductGroup'));
 const samePage=({node})=>{const url=ownUrl(node,source);return url&&shoeFeaturePageKey(url)===shoeFeaturePageKey(source);};
 const titleMatches=({node})=>titleFits(p,node.name)&&!genderConflict(p,node.name);
 const brandFits=({node})=>{const brand=typeof node.brand==='object'?node.brand?.name:node.brand;return !brand||normalized(brand)===normalized(p.brand);};
 const candidates=productNodes.filter(x=>brandFits(x)&&titleMatches(x)&&(exactSku(p,x.node)||samePage(x)));
 candidates.sort((a,b)=>Number(exactSku(p,b.node))-Number(exactSku(p,a.node)));
 const chosen=candidates[0];
 let texts=[],binding;
 if(chosen){
  const {node,parent}=chosen;
  texts=[htmlText(node.description),...properties(node)];
  // Parent data may be used only if the matched child is actually in this
  // parent AND the parent's own title/gender and same exact product page agree.
  // Nike's live Pegasus 42 parent incorrectly says junior: never inherit it.
  if(parent&&titleFits(p,parent.name)&&!genderConflict(p,parent.name)&&samePage({node:parent}))texts.push(htmlText(parent.description),...properties(parent));
  binding={method:exactSku(p,node)?'exact-product-sku':'exact-product-page-and-model',name:clean(node.name),sku:clean(node.mpn||node.sku||node.productID),source:p.source,page:source,model:p.modelEn||p.model,gender:p.gender,width:p.width||'',sourceRegion:p.sourceRegion,currency:p.currency};
  const host=new URL(source).hostname;
  const scopedSelectors=host==='www.nike.com'?['[data-testid="hidden-product-details"]']:host==='us.karhu.com'?['.description__item']:host==='salomon.co.kr'?['[id*="__main--features"]']:host==='asics.co.kr'||host==='www.asics.co.kr'?['#goods_description']:host==='emea.mizuno.com'?['#pdpDescriptionAndDetail']:[];
  for(const selector of scopedSelectors)$(selector).each((_,el)=>{
   const element=$(el).clone();element.find('script,style,[class*="recommend"],[class*="related"]').remove();
   const text=clean(element.text());if(/DELIVERY\s*&\s*RETURNS|SHIPPING\s*&\s*RETURNS/i.test(text))return;
   if(text)texts.push(text);
  });
  // Brooks' product body lives in Inertia's props.product, not rendered DOM.
  // Its navCategories include OTHER generations: never recurse all props.
  // Only an exact style and the actual ProductGroup ancestry can authorize
  // shared construction facts across documented colors/sizes/widths.
  if(new URL(source).hostname.endsWith('brooksrunning.com.au'))for(const product of inertia||[]){
   const group=node['@type']==='ProductGroup'?node:parent;
   const canonical=new URL('/'+String(product.slug||'').replace(/^\//,''),source);
   const style=String(product.style||'');
   if(!group||group['@type']!=='ProductGroup'||String(group.productGroupID)!==style||!new URL(source).pathname.endsWith('/'+style+'.html')||shoeFeaturePageKey(canonical.href)!==shoeFeaturePageKey(source)||!titleFits(p,product.name))continue;
   const attrs=Object.fromEntries((product.attributes||[]).map(a=>[a.key,a.value]));
   if(attrs.GENDER==='M'&&p.gender==='여성'||attrs.GENDER==='W'&&p.gender==='남성')continue;
   const declared=['MIDSOLE_TECH','UPPER_TECH','OUTSOLE_TECH','PDP_MOD1_COPY','PDP_MOD2_COPY','PDP_MOD3_COPY','BEST_FOR'];
   texts.push(...declared.map(k=>clean(attrs[k])).filter(Boolean));
   binding={...binding,officialProductGroup:style,constructionScope:'exact-product-group',inertiaProductName:product.name,extractedFields:declared.filter(k=>attrs[k])};
  }
 }else{
  const h1=clean($('h1').first().text()),pageTitle=clean($('title').text());
  if(!titleFits(p,h1)||genderConflict(p,h1))return {ok:false,reason:'exact-model-identity-not-proven',pageTitle:pageTitle.slice(0,180),h1:h1.slice(0,180)};
  const body=$('body').text();
  const skuVisible=p.sku&&body.includes(p.sku);
  if(!skuVisible)return {ok:false,reason:'exact-sku-not-proven',pageTitle:pageTitle.slice(0,180),h1:h1.slice(0,180)};
  // Never mine the whole body, nav, related-product cards or recommendations.
  const selectors=['[data-test="product-description"]','[data-testid="product-description"]','[itemprop="description"]','.product-description','.product__description','.product-single__description','.product-detail-description','.product-info__description','#product-description'];
  for(const selector of selectors)$(selector).each((_,el)=>{const x=$(el).clone();x.find('script,style,nav,footer,[class*="recommend"],[class*="related"]').remove();texts.push(clean(x.text()));});
  binding={method:'exact-visible-h1-and-sku',name:h1,sku:p.sku,source:p.source,page:source,model:p.modelEn||p.model,gender:p.gender,width:p.width||'',sourceRegion:p.sourceRegion,currency:p.currency};
 }
 const description=unique(texts.map(clean)).join('\n').slice(0,14000);
 if(description.length<25)return {ok:false,reason:'no-scoped-product-description',binding};
 return {ok:true,description,binding,checkedAt,htmlSha256,descriptionSha256:digest(description)};
}

// The wording describes construction or an explicitly declared use, not clinical
// outcomes, review scores, comparative performance or unmeasured comfort.
const rules=[
 ['reactx',/(?:React\s*X|리액트\s*X)/i,'발밑 쿠션에 리액트X 폼을 사용했어요.','cushion'],
 ['zoomx',/(?:Zoom\s*X|줌\s*X)/i,'줌X 폼을 넣은 쿠션 구성이에요.','cushion'],
 ['airzoom',/(?:Air\s*Zoom|Zoom\s*Air|에어\s*줌)/i,'공기주머니인 에어 줌을 쿠션에 더했어요.','air'],
 ['ffleap',/FF\s*LEAP/i,'발밑 쿠션에 FF LEAP 폼을 사용했어요.','cushion'],
 ['ffblastmax',/FF\s*BLAST\s*MAX/i,'FF BLAST MAX 폼을 넣은 쿠션 구성이에요.','cushion'],
 ['ffblastplus',/FF\s*BLAST\s*(?:PLUS|\+)/i,'발밑 쿠션에 FF BLAST PLUS 폼을 사용했어요.','cushion'],
 ['ffblast',/FF\s*BLAST(?!\s*(?:MAX|PLUS|\+))/i,'발밑 쿠션에 FF BLAST 폼을 사용했어요.','cushion'],
 ['amplifoam',/AMPLIFOAM\s*\+?/i,'발밑 쿠션에 AMPLIFOAM 폼을 사용했어요.','cushion'],
 ['puregel',/PURE\s*GEL/i,'발밑에 퓨어젤 완충 소재를 더했어요.','cushion'],
 ['lightstrikepro',/Lightstrike\s*Pro|라이트스트라이크\s*프로/i,'라이트스트라이크 프로 폼을 넣은 쿠션 구성이에요.','cushion'],
 ['lightstrike',/Lightstrike(?!\s*Pro)|라이트스트라이크(?!\s*프로)/i,'발밑 쿠션에 라이트스트라이크 폼을 사용했어요.','cushion'],
 ['dnatuned',/DNA\s*TUNED/i,'DNA TUNED 폼으로 발밑 쿠션을 구성했어요.','cushion'],
 ['dnaloft3',/DNA\s*LOFT\s*(?:v\.?\s*)?3/i,'발밑 쿠션에 DNA LOFT v3 폼을 사용했어요.','cushion'],
 ['dnahype',/DNA\s*HYPE/i,'발밑 쿠션에 DNA HYPE 폼을 사용했어요.','cushion'],
 ['dnaflash',/DNA\s*FLASH(?:\s*(?:v\.?\s*)?2)?/i,'DNA FLASH 폼을 넣은 쿠션 구성이에요.','cushion'],
 ['freshfoam',/Fresh\s*Foam(?:\s*X)?/i,'프레시폼 쿠션을 사용한 모델이에요.','cushion'],
 ['infinion',/Infinion(?:\s*Foam)?/i,'발밑 쿠션에 인피니온 폼을 사용했어요.','cushion'],
 ['fuelcell',/Fuel\s*Cell/i,'발밑 쿠션에 FuelCell 폼을 사용했어요.','cushion'],
 ['peba',/(?:\bPEBA\b|\bPEBAX\b|페바)[^.!?\n]{0,35}(?:foam|폼)|(?:foam|폼)[^.!?\n]{0,35}(?:\bPEBA\b|\bPEBAX\b|페바)/i,'발밑 쿠션에 PEBA 계열 폼을 사용했어요.','cushion'],
 ['pebaxpowered',/midsole[^.!?\n]{0,45}Pebax\s*Powered/i,'발밑 쿠션에 PEBAX 소재를 사용했어요.','cushion'],
 ['nitroelite',/NITRO\s*(?:FOAM\s*)?ELITE/i,'NITRO ELITE 폼을 넣은 쿠션 구성이에요.','cushion'],
 ['nitro',/NITRO(?:\s*FOAM|\s*cushioning)(?!\s*ELITE)/i,'발밑 쿠션에 NITRO 폼을 사용했어요.','cushion'],
 ['enerzy',/MIZUNO\s*ENERZY(?:\s*NXT)?/i,'발밑 쿠션에 미즈노 에너지를 사용했어요.','cushion'],
 ['helion',/Helion/i,'발밑 쿠션에 헬리온 폼을 사용했어요.','cushion'],
 ['altraego',/Altra\s*EGO|EGO\s*(?:MAX|PRO|P35)/i,'알트라 EGO 계열 폼을 쿠션에 사용했어요.','cushion'],
 ['aerofoam',/Aero\s*Foam/i,'발밑 쿠션에 에어로폼을 사용했어요.','cushion'],
 ['zipfoam',/Zip\s*Foam/i,'발밑 쿠션에 집폼을 사용했어요.','cushion'],
 ['revfoam',/Rev\s*Foam/i,'발밑 쿠션에 레브폼을 사용했어요.','cushion'],
 ['optifoam',/opti\s*FOAM(?:2|²)?/i,'발밑 쿠션에 옵티폼을 사용했어요.','cushion'],
 ['fastech',/Fastech/i,'발밑 쿠션에 FASTECH 폼을 사용했어요.','cushion'],
 ['energyrods',/ENERGY\s*RODS(?:\s*2\.0)?|에너지\s*로드/i,'밑창 안에 에너지로드 막대 구조를 넣었어요.','plate'],
 ['carbon',/(?:carbon(?:[ -]fib(?:re|er))?|탄소\s*섬유|카본)[^.!?\n]{0,35}(?:plate|플레이트|판)|(?:plate|플레이트)[^.!?\n]{0,25}(?:carbon|카본)/i,'밑창 안에 탄소 섬유판을 넣은 구성이에요.','plate'],
 ['nylon',/(?:nylon|나일론)[^.!?\n]{0,25}(?:plate|플레이트|판)/i,'밑창 안에 나일론판을 넣었어요.','plate'],
 ['rockplate',/rock\s*plate|보호\s*플레이트|록\s*플레이트/i,'발밑 돌 충격을 막는 보호판을 넣었어요.','protection'],
 ['vibrammegagrip',/(?:Vibram|비브람)[^.!?\n]{0,25}(?:Mega\s*grip|메가그립)/i,'지면을 붙잡는 밑창에 비브람 메가그립 고무를 사용했어요.','grip'],
 ['vibramlitebase',/Vibram[^.!?\n]{0,25}Lite\s*base/i,'비브람 라이트베이스 밑창을 사용했어요.','grip'],
 ['pumagrip',/PUMA\s*GRIP/i,'밑창 고무에 푸마그립을 사용했어요.','grip'],
 ['asicsgrip',/ASICS\s*GRIP/i,'밑창 고무에 아식스그립을 사용했어요.','grip'],
 ['contagrip',/Conta\s*GRIP/i,'밑창 고무에 콘타그립을 사용했어요.','grip'],
 ['lugs',/\b(?:[2-6](?:\.\d)?\s*mm)\s*lugs?\b/i,'밑창에 돌기를 만들어 흙길에서 지면을 잡도록 설계했어요.','grip'],
 ['continental',/Continental(?:\s*(?:rubber|outsole))?|컨티넨탈/i,'밑창에 컨티넨탈 고무를 사용했어요.','grip'],
 ['outsolerevamp',/(?:revamped|redesigned|updated|improved|new)[^.!?\n]{0,20}outsole(?=[^.!?\n]{0,85}durab)(?=[^.!?\n]{0,85}traction)/i,'밑창을 접지력과 내구성에 초점을 맞춰 새로 설계했어요.','grip'],
 ['goretex',/GORE[ -]?TEX|고어텍스/i,'비가 스며드는 것을 막는 고어텍스 소재를 사용했어요.','weather'],
 ['waterproof',/\bwaterproof\b|방수(?!가\s*아)/i,'비가 스며드는 것을 막는 방수 구성이에요.','weather'],
 ['waterresistant',/water[ -]resistant|발수/i,'가벼운 물 튀김을 막는 발수 구성이에요.','weather'],
 ['guiderails',/Guide\s*Rails/i,'발 양옆을 받치는 가이드레일 지지 구조를 넣었어요.','support'],
 ['fulcrum',/\bFulcrum\b/i,'발밑에 풀크럼 지지 구조를 넣었어요.','support'],
 ['yframe',/Y[ -]Frame\s*Guidance/i,'Y자 형태의 지지 구조를 넣어 발을 받치도록 만들었어요.','support'],
 ['medialpost',/medial\s*post/i,'발 안쪽을 받치는 지지 구조를 넣었어요.','support'],
 ['toecap',/\btoe\s*cap\b|발가락\s*보호대/i,'발 앞쪽에 장애물 충격을 막는 보호 덮개를 넣었어요.','protection'],
 ['pebaxplate',/\bPEBAX\s*(?:plate|plated)/i,'밑창 안에 PEBAX 소재 판을 넣었어요.','plate'],
 ['guidancesystem',/(?:3D|4D)\s*GUIDANCE\s*SYSTEM|중족부(?:의)?\s*(?:지지|서포트)\s*시스템/i,'발을 받치는 지지 구조를 쿠션과 함께 넣었어요.','support'],
 ['rocker',/Meta[ -]?Rocker|rocker(?:ed)?\s*(?:geometry|shape|design)|로커\s*(?:형|구조)/i,'밑창이 둥글게 굴러가도록 로커 형태로 만들었어요.','shape'],
 ['cloudtec',/Cloud\s*Tec/i,'발밑에 클라우드텍 쿠션 구조를 사용했어요.','shape'],
 ['springramp',/Spring\s*Ramp/i,'발 앞쪽에 스프링램프 구조를 넣어 발을 떼는 동작을 돕도록 만들었어요.','shape'],
 ['knitupper',/(?:warp\s*knit|knitted)\s*upper/i,'신발 겉감에 니트 소재를 사용했어요.','upper'],
 ['knittongue',/flat\s*knit\s*tongue/i,'발등을 덮는 부분을 납작한 니트 구조로 만들었어요.','upper'],
 ['engineeredmesh',/engineered\s*mesh|엔지니어드\s*메쉬|엔지니어드\s*메시/i,'부위별 짜임을 조절한 메시 겉감을 사용했어요.','upper'],
 ['mesh',/(?:engineered|breathable|lightweight|통기성[^.!?\n]{0,20})\s*(?:mesh|메쉬|메시)|(?:mesh|메쉬|메시)[^.!?\n]{0,20}(?:통기성|breath)/i,'신발 겉감에 메시 소재를 사용했어요.','upper'],
 ['longrun',/\blong(?:er)?[ -](?:distance\s+)?runs?\b|장거리\s*(?:러닝|훈련)/i,'긴 거리 훈련용으로 설계된 모델이에요.','use'],
 ['race',/\b(?:marathon|half-marathon)\s*(?:race|racing)|\brace[ -]day\b|마라톤\s*(?:레이스|대회)/i,'대회에서 달리는 레이스용 모델이에요.','use'],
 ['speedwork',/\b(?:tempo\s*(?:runs?|training)|speed\s*work|interval\s*(?:training|runs?))\b|인터벌\s*훈련/i,'빠른 페이스 훈련을 위한 모델이에요.','use'],
 ['dailyuse',/\b(?:daily\s*(?:runs?|trainer|miles)|everyday\s*(?:runs?|running)|day-to-day)\b|(?:매일|데일리)\s*(?:러닝|달리기)/i,'매일 반복하는 러닝 훈련용 모델이에요.','use'],
 ['recoveryuse',/\brecovery\s*(?:runs?|days?)\b|회복\s*(?:러닝|훈련)/i,'가볍게 달리는 회복 러닝용으로 설계했어요.','use'],
];
export function translateShoeFacts(source){
 if(!source?.ok)return [];
 const text=clean(source.description),facts=[];
 for(const [id,pattern,korean,kind]of rules){
  const match=pattern.exec(text);if(!match)continue;
  const at=match.index,near=text.slice(Math.max(0,at-60),Math.min(text.length,at+match[0].length+110));
  // A technology mentioned as absent or as the previous version's construction
  // is not proof of a current feature.
  if(/\b(?:without|no|not|previous|older)\b[^.;。]{0,35}$/i.test(text.slice(Math.max(0,at-55),at))||/없|미적용|대신|제외/.test(text.slice(at+match[0].length,at+match[0].length+15)))continue;
  if((id==='waterproof'&&facts.some(f=>f.id==='goretex'))||(id==='ffblast'&&facts.some(f=>f.id.startsWith('ffblast'))))continue;
  facts.push({id,kind,korean,match:match[0],quote:near.slice(0,220),source:source.binding.source,sourceSha256:source.htmlSha256});
 }
 return facts;
}
export function buildShoeFeaturePatch(p,source){
 if(!source?.ok)return {ok:false,reason:source?.reason||'no-source'};
 const facts=translateShoeFacts(source),chosen=[];
 // Prefer multiple dimensions over three synonymous foam names. A dual-foam
 // construction is kept only when explicitly described as layered/combined.
 for(const fact of facts){if(chosen.some(x=>x.kind===fact.kind))continue;chosen.push(fact);if(chosen.length===3)break;}
 if(chosen.length<2)return {ok:false,reason:facts.length?'only-one-distinct-product-fact':'no-translatable-product-facts',facts,binding:source.binding};
 const benefits=chosen.map(f=>f.korean),headline=benefits.slice(0,2).join(' ').slice(0,130),description=benefits.slice(0,2).join('\n');
 const labels={cushion:'발밑 쿠션',air:'공기 쿠션',plate:'밑창 안의 구조',protection:'발밑 보호',grip:'지면을 잡는 밑창',weather:'비 오는 날의 구성',support:'발을 받치는 구조',shape:'발밑의 형태',upper:'신발 겉감',use:'공식 권장 용도'};
 const features=chosen.map(f=>({title:labels[f.kind],body:f.korean.slice(0,120)}));
 const identity={...source.binding,brand:p.brand,model:p.model,modelEn:p.modelEn||'',sku:p.sku,observedName:source.binding.name,observedSku:source.binding.sku,identitySha256:productFeatureIdentity(p),validated:true};
 const decisionEvidence={schemaVersion:1,productId:p.id,sku:p.sku,brand:p.brand,source:p.source,benefits,headline,supportingText:benefits[2]||'',features,extractorVersion:FEATURE_EXTRACTOR_VERSION,checkedAt:source.checkedAt,identity,sourceSha256:source.htmlSha256,descriptionSha256:source.descriptionSha256,facts:chosen};
 return {ok:true,patch:{description,decisionEvidence},facts,binding:source.binding};
}
export function applyShoeFeatureEvidence(catalog,evidence){
 const byId=new Map(evidence.records.filter(r=>r.patch).map(r=>[r.id,r]));let applied=0,rejected=0;
 const products=catalog.products.map(p=>{
  const r=byId.get(p.id);if(!r)return p;
  const e=r.patch.decisionEvidence;
  if(r.identitySha256!==productFeatureIdentity(p)||e?.source!==p.source||e.schemaVersion!==1||e.productId!==p.id||e.sku!==p.sku||e.brand!==p.brand||!/^[a-f0-9]{64}$/.test(e.sourceSha256||'')){rejected++;return p;}
  applied++;return {...p,...r.patch};
 });
 return {catalog:{...catalog,products},applied,rejected};
}
export function productFeatureIdentity(p){
 return digest(JSON.stringify([p.id,p.brand,p.model,p.modelEn||'',p.sku,p.source,p.sourceRegion,p.currency,p.gender,p.width||'',p.modelGroup||'']));
}
/** Migrate a prior extractor patch without inventing facts or refreshing its
 * observation date. Only known fact IDs with their original HTML hash survive. */
export function upgradeShoeFeaturePatch(p,patch){
 const e=patch?.decisionEvidence;
 if(e?.source!==p.source||!/^[a-f0-9]{64}$/.test(e.sourceSha256||'')||!Array.isArray(e.facts))return null;
 const facts=e.facts.map(f=>{const rule=rules.find(r=>r[0]===f.id);return rule&&f.source===p.source&&f.sourceSha256===e.sourceSha256?{...f,korean:rule[2]}:null;}).filter(Boolean);
 if(facts.length<2)return null;
 // Re-run all presentation construction from the preserved, source-bound
 // facts. No inference from category, model names or unobserved marketing.
 const labels={cushion:'발밑 쿠션',air:'공기 쿠션',plate:'밑창 안의 구조',protection:'발밑 보호',grip:'지면을 잡는 밑창',weather:'비 오는 날의 구성',support:'발을 받치는 구조',shape:'발밑의 형태',upper:'신발 겉감',use:'공식 권장 용도'};
 const benefits=facts.slice(0,3).map(f=>f.korean);
 return {description:benefits.slice(0,2).join('\n'),decisionEvidence:{...e,schemaVersion:1,productId:p.id,brand:p.brand,sku:p.sku,benefits,headline:benefits.slice(0,2).join(' ').slice(0,130),supportingText:benefits[2]||'',features:facts.slice(0,3).map(f=>({title:labels[f.kind],body:f.korean})),facts,identity:{...e.identity,brand:p.brand,model:p.model,modelEn:p.modelEn||'',sku:p.sku,identitySha256:productFeatureIdentity(p),validated:true}}};
}
