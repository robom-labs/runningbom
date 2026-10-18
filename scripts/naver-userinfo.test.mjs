import test from 'node:test';import assert from 'node:assert/strict';
import {projectNaverProfile,handleUserInfo} from '../supabase/functions/naver-userinfo/handler.mjs';
test('Naver identity mapping does not invent verified email or expose unnecessary profile fields',()=>{
 const p=projectNaverProfile({resultcode:'00',response:{id:'naver-scoped-id',email:'fixture@example.com',nickname:'테스트러너',birthday:'01-01',mobile:'not-a-real-number',gender:'F'}});
 assert.equal(p.sub,'naver-scoped-id');assert.equal(p.email_verified,false);assert.equal(p.mobile,undefined);assert.equal(p.birthday,undefined);
 assert.throws(()=>projectNaverProfile({resultcode:'00',response:{email:'fixture@example.com'}}));
});
test('Adapter rejects unauthenticated requests and sends bearer tokens only to the fixed NAVER endpoint',async()=>{
 let called=false;const none=await handleUserInfo(new Request('https://adapter.example/'),async()=>{called=true;});assert.equal(none.status,401);assert.equal(called,false);
 const response=await handleUserInfo(new Request('https://adapter.example/?url=https://evil.example/',{headers:{authorization:'Bearer fixture-token'}}),async(url,opts)=>{assert.equal(url,'https://openapi.naver.com/v1/nid/me');assert.equal(opts.redirect,'error');return Response.json({resultcode:'00',response:{id:'fixture-id'}});});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
});
