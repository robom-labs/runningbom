// Run the integrated review from the real repository with its public project
// configuration. Private API keys are never accepted or passed to Vite.
import {readFileSync} from 'node:fs';import {spawn} from 'node:child_process';
const config=JSON.parse(readFileSync(new URL('../apps/mobile/eas.json',import.meta.url),'utf8')).build.production.env;
const key=config.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if(key&&!key.startsWith('sb_publishable_'))throw new Error('Review requires a public publishable key.');
const env={...process.env,VITE_SUPABASE_URL:config.EXPO_PUBLIC_SUPABASE_URL||'',VITE_SUPABASE_PUBLISHABLE_KEY:key||'',VITE_AUTH_GOOGLE_ENABLED:'false',VITE_AUTH_KAKAO_ENABLED:'false',VITE_AUTH_NAVER_ENABLED:'false',VITE_NAVER_ADAPTER_VERIFIED:'false'};
const mode=process.argv.includes('--build')?'build':'dev';
const args=['--prefix','apps/review','run',mode,...(mode==='dev'?['--','--host','0.0.0.0','--port','4173','--strictPort']:[])];
if(!process.env.npm_execpath)throw new Error('Run with npm run review:dev or npm run review:build.');
const child=spawn(process.execPath,[process.env.npm_execpath,...args],{env,stdio:'inherit',cwd:new URL('../',import.meta.url)});
child.on('exit',code=>process.exit(code??1));
