import {useEffect,useState} from 'react';import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import bundled from '../../data/catalog/verified-products.json';
import {acceptCatalog,catalogSchema,type VerifiedCatalog} from './contracts';
const initial=catalogSchema.parse(bundled), key='runningbom:verified-catalog:v1';
const base=(process.env.EXPO_PUBLIC_CATALOG_URL||'https://robom-labs.github.io/runningbom/data/').replace(/\/?$/,'/');
export function useVerifiedCatalog(){
 const [catalog,setCatalog]=useState(initial),[health,setHealth]=useState('확인한 제품 자료');
 useEffect(()=>{
  let alive=true,busy=false;let current:VerifiedCatalog=initial;const controller=new AbortController();
  async function refresh(){if(busy||!alive)return;busy=true;
   const requestController=new AbortController();const abort=()=>requestController.abort();controller.signal.addEventListener('abort',abort);
   const timeout=setTimeout(abort,20000);
   try{
    if(!base.startsWith('https://'))throw new Error('catalog HTTPS required');
    const signal=requestController.signal;
    const m=await fetch(base+'verified-products.manifest.json',{signal,cache:'no-cache'});if(!m.ok)throw new Error('manifest unavailable');const manifest=await m.json();
    const res=await fetch(base+'verified-products.json',{signal,cache:'no-cache'});if(!res.ok)throw new Error('catalog unavailable');const text=await res.text();
    const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,text);
    if(digest!==manifest.sha256)throw new Error('catalog checksum');
    const next=acceptCatalog(current,JSON.parse(text));if(manifest.count!==next.products.length)throw new Error('catalog count');
    if(!alive)return;current=next;setCatalog(next);setHealth('자료 자동 확인 완료');try{await AsyncStorage.setItem(key,text);}catch{/* A full cache must not invalidate verified current data. */}
   }catch{if(alive)setHealth('마지막 확인 자료로 보기');}finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',abort);busy=false;}
  }
  void (async()=>{try{const cached=await AsyncStorage.getItem(key);if(cached){current=acceptCatalog(current,JSON.parse(cached));if(alive)setCatalog(current);}}catch{/* invalid/older cache is ignored */}await refresh();})();
  const timer=setInterval(()=>void refresh(),15*60*1000);const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});
  return()=>{alive=false;controller.abort();clearInterval(timer);sub.remove();};
 },[]);
 return {products:catalog.products,checkedAt:catalog.generatedAt,health};
}
