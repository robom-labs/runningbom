import test from 'node:test';
import assert from 'node:assert/strict';
import {postTags,taggedPost,validFeedCursor,mergeFeed,relativePostTime} from '../src/features/feed-core.ts';
test('topic and coarse region tags remain editable, deduplicated and explicit',()=>{
 assert.equal(taggedPost('오늘도 달렸어요. #서울','러닝일상','서울'),'오늘도 달렸어요. #서울\n\n#러닝일상');
 assert.deepEqual(postTags('도움이 필요해요 #러닝화 #질문 #러닝화'),['러닝화','질문']);
 assert.equal(taggedPost(' 가볍게 5km ','전체','전체'),'가볍게 5km');
});
test('stable pagination admits only database-shaped cursors and excludes duplicate posts',()=>{
 assert.ok(validFeedCursor({createdAt:'2026-10-18T00:00:00+00:00',id:'12345678-1234-1234-1234-123456789abc'}));
 assert.equal(validFeedCursor({createdAt:'bad),id.gt.1',id:'abc'}),false);
 assert.deepEqual(mergeFeed([{id:'a'}],[{id:'a'},{id:'b'},{id:'b'}]),[{id:'a'},{id:'b'}]);
});
test('feed dates use natural runner-facing labels without fabricated activity',()=>{
 assert.equal(relativePostTime('2026-10-18T01:00:00Z',Date.parse('2026-10-18T01:03:00Z')),'3분 전');
 assert.equal(relativePostTime('2026-10-18T01:00:00Z',Date.parse('2026-10-18T03:00:00Z')),'2시간 전');
});
