import {supabase as memberClient} from './client';
export {memberClient};
export function requireMemberClient(){if(!memberClient)throw new Error('회원 서버 연결을 준비하고 있어요.');return memberClient;}
export function friendlyMemberError(error:unknown){
 const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';
 if(code==='23505')return '이미 사용 중인 아이디 또는 닉네임이에요. 다른 이름을 골라 주세요.';
 if(code==='invalid_credentials')return '이메일과 비밀번호를 다시 확인해 주세요.';
 if(code==='email_not_confirmed')return '이메일로 받은 확인 링크를 먼저 눌러 주세요.';
 return error instanceof Error?error.message:typeof error==='object'&&error&&'message' in error?String(error.message):'연결을 확인한 뒤 다시 시도해 주세요.';
}
export async function claimProfile(handle:string,nickname:string){const c=requireMemberClient();const {error}=await c.rpc('claim_member_profile',{next_handle:handle,next_nickname:nickname});if(error)throw error;}
export async function ownProfile(){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)return null;const [profile,handle]=await Promise.all([c.from('profiles').select('nickname').eq('user_id',user.id).maybeSingle(),c.from('member_handles').select('handle').eq('user_id',user.id).maybeSingle()]);if(profile.error)throw profile.error;if(handle.error)throw handle.error;return {id:user.id,nickname:profile.data?.nickname,handle:handle.data?.handle};}
export type MemberPost={id:string;author_id:string;author_nickname:string;body:string;kind:string;created_at:string;comment_count:number};
export type MemberMessage={id:string;sender_id:string;body:string;created_at:string;nickname:string};
export async function getPosts(){const {data,error}=await requireMemberClient().from('public_posts').select('id,author_id,author_nickname,body,kind,created_at,comment_count').order('created_at',{ascending:false}).limit(30);if(error)throw error;return (data||[]) as MemberPost[];}
export async function publishPost(body:string){const c=requireMemberClient();const {data:{user}}=await c.auth.getUser();if(!user)throw new Error('로그인 후 이야기를 올릴 수 있어요.');const {error}=await c.from('posts').insert({author_id:user.id,body:body.trim(),kind:'GENERAL',visibility:'PUBLIC'});if(error)throw error;}
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
