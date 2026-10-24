// Only bounded, first-party HEAD declarations from the fetched page are evidence.
// A canonical URL is a consistency check, never a new seed or navigation request.
const clean=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim();
export function courseEditionMetadata($,url){
 const descriptions=[],canonicals=[];
 const nodes=$('head meta,head link');
 if(nodes.length>128)return {descriptions:[],issue:'metadata-node-budget'};
 for(const el of nodes.toArray()){
  const n=$(el),tag=el.tagName?.toLowerCase();
  if(tag==='meta'){
   const kind=clean(n.attr('name')||n.attr('property')).toLowerCase();
   if(!['description','og:description'].includes(kind))continue;
   const content=n.attr('content')||'';
   if(content.length>2048||descriptions.length>=8)return {descriptions:[],issue:'metadata-description-budget'};
   const text=clean(content);if(text)descriptions.push({kind,text});
  }else if(clean(n.attr('rel')).toLowerCase().split(' ').includes('canonical')){
   const href=n.attr('href');
   if(!href||href.length>4096)return {descriptions:[],issue:'invalid-metadata-canonical'};
   try{
    const u=new URL(href,url),current=new URL(url);u.hash='';current.hash='';
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.href!==current.href)return {descriptions:[],issue:'metadata-canonical-scope-mismatch'};
    canonicals.push(u.href);
   }catch{return {descriptions:[],issue:'invalid-metadata-canonical'};}
  }
 }
 return {descriptions,canonical:canonicals[0]||null};
}

