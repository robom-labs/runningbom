import {resolveDeclaredCatalogUrl,sameApprovedCatalogHost} from './catalog-source-policy.mjs';

const scalar=v=>typeof v==='string'?v.trim():typeof v==='number'?String(v):'';
const norm=v=>scalar(v).normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
function sameProduct(a,b,source){
 try{
  if(!sameApprovedCatalogHost(a,b,source))return false;
  const x=new URL(a),y=new URL(b);
  if(source.id==='saucony-8'){
   const id=u=>u.searchParams.get('product_no')||u.pathname.match(/\/(\d+)\/?$/)?.[1];
   return !!id(x)&&id(x)===id(y);
  }
  return x.pathname===y.pathname;
 }catch{return false;}
}
export function bindKnownCatalogRow(row,source,previous,{keywords=''}={}){
 const candidates=previous.filter(p=>p.brand.toLowerCase()===row.brand.toLowerCase()&&p.sourceRegion===row.sourceRegion&&p.currency===row.currency&&sameProduct(p.source,row.source,source));
 const ids=[row.sku,...(row.observedIdentifiers||[])].map(scalar).filter(Boolean);
 let old=candidates.find(p=>p.sku&&ids.includes(p.sku));
 if(!old&&!row.sku)old=candidates.find(p=>!p.sku&&new URL(p.source).href===new URL(row.source).href);
 if(!old&&!row.sku&&source.id==='hoka-3'){
  const path=new URL(row.source).pathname.toLowerCase();
  const bound=candidates.filter(p=>p.sku&&path.endsWith('-'+p.sku.toLowerCase()));
  if(bound.length===1)old=bound[0];
 }
 // ASICS KR publishes an internal DB SKU. The manufacturer ID must also be
 // explicitly present in the current page's keyword identifiers, not guessed.
 if(!old&&source.id==='asics-1'){
  const tokens=keywords.split(',').map(norm);
  const bound=candidates.filter(p=>p.sku&&tokens.includes(norm(p.sku)));
  if(bound.length===1)old=bound[0];
 }
 if(old)return {...row,source:old.source,sku:old.sku,sourceSku:row.sku===old.sku?row.sourceSku:row.sku,knownCatalogId:old.id,sourceIdentityEvidence:row.sourceIdentityEvidence||{kind:'official-source-identifier',sourceUrl:row.source,manufacturerSku:old.sku,sourceSku:row.sku},...(row.imageOwnership?{imageOwnership:{...row.imageOwnership,productSource:old.source,sku:old.sku,declaredProductSource:row.source,declaredSku:row.sku}}:{})};
 return row;
}
export function variantAdmission(row){
 const productKind=row.model+' '+(typeof row.sourceCategory==='string'?row.sourceCategory:'');
 if(/\b(?:gaiters?|socks?|insoles?|shoelaces?|jackets?|shorts|tights|shirts?|backpacks?|bottles?)\b|게이터|양말|신발끈|러닝복/i.test(productKind))return {ok:false,reason:'officially-named-non-shoe-accessory'};
 let selectedSize=false;try{selectedSize=new URL(row.source).searchParams.has('size');}catch{/* Invalid URLs fail the source guard. */}
 if((row.officialVariantEvidence||selectedSize)&&!row.modelGroupEvidence&&!row.knownCatalogId)return {ok:false,reason:'unreviewed-size-or-fit-variant',evidence:row.officialVariantEvidence||{kind:'official-size-query',sourceUrl:row.source}};
 return {ok:true};
}
const meta=($,key)=>$(`meta[property="${key}"]`).attr('content');
function tableValue($,label){
 let value='';$('tr').each((_,n)=>{const th=$(n).find('th').first().text().replace(/\s+/g,' ').trim();if(th===label)value=$(n).find('td').first().text().replace(/\s+/g,' ').trim();});return value;
}
export function sourceBoundObservations($,url,source,previous){
 const existing=previous.filter(p=>p.brand.toLowerCase()===source.brand.toLowerCase()&&p.sourceRegion===source.region&&sameProduct(p.source,url,source));
 if(!existing.length)return [];
 if(source.id==='saucony-8'&&new URL(url).hostname==='www.saucony.co.kr'){
  const sku=tableValue($,'모델'),name=tableValue($,'영문상품명'),old=existing.find(p=>p.sku===sku);
  const price=Number(meta($,'product:price:amount')),currency=meta($,'product:price:currency');
  const imageSource=resolveDeclaredCatalogUrl(meta($,'og:image'),url);
  if(!old||!name||!imageSource||currency!==old.currency||!Number.isFinite(price)||price<=0)return [];
  return [{brand:source.brand,model:name,source:old.source,sku,currency,price,imageSource,color:old.color,gender:old.gender,sourceRegion:source.region,knownCatalogId:old.id,evidenceKind:'official-product-table',sourceIdentityEvidence:{kind:'official-model-table',modelLabel:'모델',sku,sourceUrl:url}}];
 }
 if(source.id==='mizuno-12'&&new URL(url).hostname==='emea.mizuno.com'){
  const scope=$('[itemscope][itemtype$="/Product"]').first(),sku=scope.find('meta[itemprop="mpn"]').attr('content');
  const brand=scope.find('[itemprop="brand"] [itemprop="name"]').attr('content');
  const name=scope.find('[itemprop="name"]').filter((_,n)=>!$(n).closest('[itemprop="brand"]').length).first().text().trim();
  const images=scope.find('img[itemprop="image"]').map((_,n)=>$(n).attr('src')).get().filter(Boolean).sort((a,b)=>Number(new URL(b,url).searchParams.get('sw')||0)-Number(new URL(a,url).searchParams.get('sw')||0));
  const imageSource=resolveDeclaredCatalogUrl(images[0],url),old=existing.find(p=>p.sku===sku);
  if(!old||brand!=='Mizuno'||!name||!imageSource)return [];
  // No numeric price/currency is declared on this observed sold-out page.
  // Preserve the known market currency, explicitly clear the unavailable price.
  return [{brand:source.brand,model:name,source:old.source,sku,currency:old.currency,price:null,imageSource,color:old.color,gender:old.gender,sourceRegion:source.region,knownCatalogId:old.id,priceObservation:'not-declared',evidenceKind:'official-product-microdata',sourceIdentityEvidence:{kind:'microdata-mpn',sku,sourceUrl:url}}];
 }
 if(source.id==='nike-press-global'&&new URL(url).hostname==='about.nike.com'){
  let data;try{data=JSON.parse($('script#__NEXT_DATA__').text()).props.pageProps.data;}catch{return [];}
  const old=existing.find(p=>p.evidenceKind==='official-announcement'||!p.sku);
  if(!old||typeof data?.title!=='string'||!Array.isArray(data.blocks))return [];
  const text=data.blocks.map(b=>[b.summary_text,b.text].filter(v=>typeof v==='string').join(' ')).join(' ');
  const plain=$('<div>').html(text).text().replace(/\s+/g,' ');
  const match=plain.match(/When is it available\?\s*[^.]*?launch in China in (January|February|March|April|May|June|July|August|September|October|November|December) (20\d{2})/i);
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  return [{brand:source.brand,model:old.modelEn||old.model,source:old.source,sku:old.sku,currency:old.currency,price:null,imageSource:resolveDeclaredCatalogUrl(meta($,'og:image'),url),color:old.color,gender:old.gender,sourceRegion:source.region,knownCatalogId:old.id,sourceTitle:data.title,evidenceKind:'official-announcement',...(match?{release:match[2]+'-'+String(months.indexOf(match[1].toLowerCase())+1).padStart(2,'0'),releaseRegion:'중국',releaseEvidence:'explicit-launch-section'}:{})}];
 }
 return [];
}
