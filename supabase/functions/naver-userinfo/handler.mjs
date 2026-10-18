// NAVER's documented response/id -> standard OAuth userinfo. Never forward age, phone or birth date.
export function projectNaverProfile(value){
 const p=value?.response;
 if(value?.resultcode!=='00'||!p||typeof p.id!=='string'||!p.id.trim())throw new Error('Invalid NAVER identity');
 return {sub:p.id,id:p.id,...(typeof p.nickname==='string'?{preferred_username:p.nickname}:{}),
  ...(typeof p.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)?{email:p.email,email_verified:false}:{})};
}
export async function handleUserInfo(request,fetcher=fetch){
 const response=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(request.method!=='GET')return response({error:'method_not_allowed'},405);
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~+\/-]+=*$/.test(authorization)||authorization.length>4096)return response({error:'unauthorized'},401);
 try{
  const upstream=await fetcher('https://openapi.naver.com/v1/nid/me',{headers:{authorization,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!upstream.ok)return response({error:'identity_provider_rejected'},401);
  return response(projectNaverProfile(await upstream.json()));
 }catch{return response({error:'identity_provider_unavailable'},502);}
}
