import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {validFeedCursor,type FeedCursor} from '../features/feed-core';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const memberClient:SupabaseClient|null=url&&key?createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export const socialProviders=[
 {id:'google',label:'Google',enabled:import.meta.env.VITE_AUTH_GOOGLE_ENABLED==='true'},
 {id:'kakao',label:'카카오',enabled:import.meta.env.VITE_AUTH_KAKAO_ENABLED==='true'},
 {id:'custom:naver',label:'네이버',enabled:import.meta.env.VITE_AUTH_NAVER_ENABLED==='true'&&import.meta.env.VITE_NAVER_ADAPTER_VERIFIED==='true'},
];
export function requireMemberClient(){if(!memberClient)throw new Error('회원 서버 연결을 준비하고 있어요.');return memberClient;}
export function friendlyMemberError(error:unknown){
 const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';
 if(code==='23505')return '이미 사용 중인 아이디 또는 닉네임이에요. 다른 이름을 골라 주세요.';
 if(code==='invalid_credentials')return '이메일과 비밀번호를 다시 확인해 주세요.';
 if(code==='email_not_confirmed')return '이메일로 받은 확인 링크를 먼저 눌러 주세요.';
 return error instanceof Error?error.message:typeof error==='object'&&error&&'message' in error?String(error.message):'연결을 확인한 뒤 다시 시도해 주세요.';
}
export async function claimProfile(handle:string,nickname:string){const c=requireMemberClient();const {error}=await c.rpc('claim_member_profile',{next_handle:handle,next_nickname:nickname});if(error)throw error;window.dispatchEvent(new Event('runningbom:profile-updated'));}
export async function ownProfile(){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)return null;const [profile,handle]=await Promise.all([c.from('profiles').select('nickname').eq('user_id',user.id).maybeSingle(),c.from('member_handles').select('handle').eq('user_id',user.id).maybeSingle()]);if(profile.error)throw profile.error;if(handle.error)throw handle.error;return {id:user.id,nickname:profile.data?.nickname,handle:handle.data?.handle};}
export type MemberPost={id:string;author_id:string;author_nickname:string;body:string;kind:string;created_at:string;comment_count:number;reaction_counts:Record<string,number>;topic:string|null;region:string|null};
export type MemberMessage={id:string;sender_id:string;body:string;created_at:string;nickname:string};
export async function getPosts(options:{topic?:string;region?:string;query?:string;cursor?:FeedCursor;signal?:AbortSignal;ids?:string[]}={}){
 let request=requireMemberClient().from('public_posts').select('id,author_id,author_nickname,body,kind,created_at,comment_count,reaction_counts,topic,region').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(30);
 if(options.topic&&options.topic!=='전체')request=request.eq('topic',options.topic);
 if(options.region&&options.region!=='전체')request=request.eq('region',options.region);
 if(options.query?.trim())request=request.ilike('body','%'+options.query.trim().replace(/[\\%_]/g,'\\$&')+'%');
 if(options.ids){if(!options.ids.length)return [];request=request.in('id',options.ids);}
 if(options.cursor){if(!validFeedCursor(options.cursor))throw new Error('다음 피드 위치를 다시 확인해 주세요.');const c=options.cursor;request=request.or(`created_at.lt.${c.createdAt},and(created_at.eq.${c.createdAt},id.lt.${c.id})`);}
 if(options.signal)request=request.abortSignal(options.signal);
 const {data,error}=await request;if(error)throw error;return (data||[]) as MemberPost[];
}
export async function myCheers(postIds:string[]){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user||!postIds.length)return [];const {data,error}=await c.from('reactions').select('post_id').eq('user_id',user.id).eq('kind','CHEER').in('post_id',postIds);if(error)throw error;return (data||[]).map(r=>r.post_id as string);}
export async function cheerPost(postId:string,active:boolean){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('로그인 후 응원할 수 있어요.');const request=active?c.from('reactions').upsert({post_id:postId,user_id:user.id,kind:'CHEER',updated_at:new Date().toISOString()},{onConflict:'post_id,user_id'}):c.from('reactions').delete().eq('post_id',postId).eq('user_id',user.id);const {error}=await request;if(error)throw error;}
export async function publishPost(body:string,options:{topic?:string;region?:string}={}){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('로그인 후 이야기를 올릴 수 있어요.');const {error}=await c.from('posts').insert({author_id:user.id,body:body.trim(),kind:'GENERAL',visibility:'PUBLIC',topic:options.topic||null,region:options.region&&options.region!=='전체'?options.region:null});if(error)throw error;}
export async function getMessages(room:string):Promise<MemberMessage[]>{
 const c=requireMemberClient();const {data,error}=await c.from('chat_messages').select('id,sender_id,body,created_at').eq('room_id',room).order('created_at',{ascending:false}).limit(50);if(error)throw error;
 const ids=[...new Set((data||[]).map(m=>m.sender_id))];if(!ids.length)return [];
 const profiles=await c.from('public_profiles').select('user_id,nickname').in('user_id',ids);if(profiles.error)throw profiles.error;
 const names=new Map((profiles.data||[]).map(p=>[p.user_id,p.nickname]));
 return (data||[]).reverse().map(m=>({...m,nickname:names.get(m.sender_id)||'러너'}));
}
export async function sendMessage(room:string,body:string){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('로그인 후 대화할 수 있어요.');const {error}=await c.from('chat_messages').insert({room_id:room,sender_id:user.id,body:body.trim()});if(error)throw error;}
export async function reportMessage(id:string){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('로그인이 필요해요.');const {error}=await c.from('chat_reports').insert({reporter_id:user.id,message_id:id,reason:'반복 광고 또는 부적절한 대화'});if(error)throw error;}
export async function blockMember(id:string){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('로그인이 필요해요.');const {error}=await c.from('blocks').upsert({blocker_id:user.id,blocked_id:id});if(error)throw error;}
export async function getComments(postId:string){const {data,error}=await requireMemberClient().from('comments').select('id,author_id,body,created_at').eq('post_id',postId).eq('status','ACTIVE').order('created_at').limit(50);if(error)throw error;return data||[];}
export async function addComment(postId:string,body:string){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('로그인 후 댓글을 남길 수 있어요.');const {error}=await c.from('comments').insert({post_id:postId,author_id:user.id,body:body.trim()});if(error)throw error;}

export async function reportContent(type:'POST'|'COMMENT',id:string){const c=requireMemberClient();const {error}=await c.rpc('submit_report',{next_target_type:type,next_target_id:id,next_reason:'부적절한 콘텐츠',next_details:''});if(error)throw error;}
