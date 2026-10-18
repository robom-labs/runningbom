import test from 'node:test';import assert from 'node:assert/strict';
import {emailAuthLinkKind} from '../domains/identity/emailAuthLink';
const confirm='runningbom://auth/email-confirm',recovery='runningbom://auth/recovery';
test('이메일 확인·복구 링크는 앱의 정확한 경로와 PKCE 코드만 받는다',()=>{
 assert.equal(emailAuthLinkKind(confirm+'?code=verified-code',confirm,recovery),'confirm');
 assert.equal(emailAuthLinkKind(recovery+'?code=verified-code',confirm,recovery),'recovery');
 for(const url of ['https://example.com/auth/recovery?code=x','runningbom://auth/recovery-other?code=x','runningbom://user:pass@auth/recovery?code=x',recovery+'#access_token=x',recovery,recovery+'?code='])assert.equal(emailAuthLinkKind(url,confirm,recovery),null);
});
