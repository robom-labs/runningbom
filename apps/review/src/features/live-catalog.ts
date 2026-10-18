import {useEffect,useState} from 'react';
import {shoes as bundledShoes,type Shoe} from './catalog';
export type CatalogSnapshot={schemaVersion:number;revision:string;generatedAt:string;products:Shoe[]};
export function validCatalog(value:unknown):value is CatalogSnapshot{
 if(!value||typeof value!=='object')return false;
 const d=value as CatalogSnapshot;
 if(d.schemaVersion!==1||!d.revision||!Number.isFinite(Date.parse(d.generatedAt))||!Array.isArray(d.products)||!d.products.length)return false;
 const ids=new Set<string>();
 return d.products.every(p=>{
  if(!p || ids.has(p.id))return false;ids.add(p.id);
  return ['id','brand','name','model','purpose','tier','sourceRegion','color','gender','source','image','imageSource','checkedAt','merchant','priceType','release','releaseSource','releaseRegion','plate','weight','drop'].every(k=>typeof (p as unknown as Record<string,unknown>)[k]==='string')
   && Array.isArray(p.uses)&&p.uses.every(u=>typeof u==='string')&&typeof p.upcoming==='boolean'
   && (p.price===null||typeof p.price==='number'&&p.price>0)&&/^[A-Z]{3}$/.test(p.currency)
   && p.source.startsWith('https://')&&(p.image.startsWith('/assets/products/')||p.image.startsWith('https://'))&&p.imageSource.startsWith('https://');
 });
}
export function useLiveCatalog(){
 const [snapshot,setSnapshot]=useState<CatalogSnapshot>(()=>{try{const cached=JSON.parse(localStorage.getItem('runningbom:catalog-v1')||'null');if(validCatalog(cached))return cached;}catch{/* snapshot fallback */}return {schemaVersion:1,revision:'bundle',generatedAt:bundledShoes.reduce((max,p)=>p.checkedAt>max?p.checkedAt:max,''),products:bundledShoes};});
 const [health,setHealth]=useState('확인한 제품 자료');
 useEffect(()=>{
  const controller=new AbortController();const base=String(import.meta.env.VITE_CATALOG_URL||'/catalog/').replace(/\/?$/,'/');
  async function refresh(){
   try{
    const response=await fetch(base+'verified-products.manifest.json',{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw new Error('manifest');const manifest=await response.json();
    const dataResponse=await fetch(base+'verified-products.json',{signal:controller.signal,cache:'no-cache'});if(!dataResponse.ok)throw new Error('catalog');const text=await dataResponse.text();
    const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(sha!==manifest.sha256)throw new Error('integrity');const next=JSON.parse(text);
    if(!validCatalog(next)||manifest.count!==next.products.length)throw new Error('schema');
    setSnapshot(current=>{
      if(Date.parse(next.generatedAt)<Date.parse(current.generatedAt))return current;
      try{localStorage.setItem('runningbom:catalog-v1',text);}catch{/* storage full doesn't block browsing */}
      return next;
    });
    setHealth('제품 자료 자동 확인');
   }catch{if(!controller.signal.aborted)setHealth('마지막 확인 자료로 보기');}
  }
  void refresh();const interval=setInterval(()=>void refresh(),15*60*1000);return()=>{controller.abort();clearInterval(interval);};
 },[]);
 return {shoes:snapshot.products,health,checkedAt:snapshot.generatedAt};
}
