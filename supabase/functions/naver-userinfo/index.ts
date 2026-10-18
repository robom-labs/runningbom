// Server-to-server OAuth userinfo endpoint. Its bearer token is a NAVER token, not a Supabase JWT.
import {handleUserInfo} from './handler.mjs';
Deno.serve(handleUserInfo);
