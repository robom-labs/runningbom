// Association evidence is not a pixel audit or a license claim. The source
// parser must supply the image from the SAME product/variant object or scope.
export function withImageOwnership(row,sourceUrl,kind){
 return {...row,imageOwnership:{schemaVersion:1,kind,sourceUrl,productSource:row.source,sku:row.sku||null,model:row.model,color:row.color||null,imageSource:row.imageSource,checkedAt:new Date().toISOString()}};
}
export function checkImageOwnership(row){
 const e=row.imageOwnership;
 if(!e||e.schemaVersion!==1)return {ok:false,reason:'missing official SKU/image association'};
 for(const [key,value]of [['productSource',row.source],['sku',row.sku||null],['model',row.model],['color',row.color||null],['imageSource',row.imageSource]])if(e[key]!==value)return {ok:false,reason:'image ownership mismatch: '+key};
 // Explicit contradictory Nike filenames are a veto, never fuzzy proof of
 // ownership. Opaque filenames still require the source object association.
 if(String(row.brand).toLowerCase()==='nike'){
  if(/^[A-Z0-9]{6,8}-\d{3}$/i.test(row.sku||'')){
   let declaredStyle='';try{declaredStyle=decodeURIComponent(new URL(row.source).pathname).split('/').filter(Boolean).at(-1)||'';}catch{return {ok:false,reason:'invalid product URL'};}
   if(declaredStyle.toUpperCase()!==row.sku.toUpperCase())return {ok:false,reason:'Nike source URL and exact style/color SKU disagree'};
  }
  const names=[['ultrafly',/ultrafly|울트라플라이/i],['vaporfly',/vaporfly|베이퍼플라이/i],['alphafly',/alphafly|알파플라이/i]];
  let filename='';try{filename=decodeURIComponent(new URL(row.imageSource).pathname).replace(/\+/g,' ');}catch{return {ok:false,reason:'invalid image URL'};}
  const text=row.model+' '+(row.sourceTitle||'');
  for(const[name,pattern]of names)if(pattern.test(text))for(const[other,otherPattern]of names)if(other!==name&&otherPattern.test(filename))return {ok:false,reason:'official image filename contradicts model family'};
 }
 return {ok:true};
}
export function retainExactImageFrame(product,now=Date.now()){
 const next={...product},f=next.imageFrame;if(!f)return next;
 const dimensions=['width','height','x','y','cropWidth','cropHeight'];
 const age=now-Date.parse(f.checkedAt);
 const valid=f.imageSource===next.imageSource&&f.productSource===next.source&&/^[a-f0-9]{64}$/.test(f.sha256||'')&&f.sha256===next.imageSha256&&dimensions.every(k=>Number.isSafeInteger(f[k]))&&f.width>0&&f.height>0&&f.width*f.height<=16000000&&f.x>=0&&f.y>=0&&f.cropWidth>0&&f.cropHeight>0&&f.x+f.cropWidth<=f.width&&f.y+f.cropHeight<=f.height&&(f.background===null||/^#[a-f0-9]{6}$/i.test(f.background||''))&&Number.isFinite(age)&&age>=-300000&&age<=7*86400000;
 if(!valid)delete next.imageFrame;
 return next;
}
