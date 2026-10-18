import test from 'node:test';import assert from 'node:assert/strict';
import {registrationState,raceFocus} from '../src/features/race-status';
const now=new Date('2026-10-18T03:00:00Z');
test('접수 중에는 마감일, 예정 대회는 시작일을 우선 보여 준다',()=>{
 const r={opensAt:'2026-08-01',closesAt:'2026-10-30',raceAt:'2026-11-07',status:'접수중',timeConfirmed:false};
 assert.deepEqual(raceFocus(r,'접수 일정'),{label:'접수 마감',date:'2026-10-30',hint:'접수중'});
 assert.equal(raceFocus({...r,status:'예정'},'접수 일정').date,'2026-08-01');
 assert.equal(raceFocus({...r,status:'확인 필요'},'접수 일정').date,'2026-11-07');
});
test('지난 마감은 원문에 open이 남아 있어도 마감으로 표시한다',()=>{
 assert.equal(registrationState({registrationStatus:'open',registrationClosesAt:'2026-10-17'},now),'접수마감');
 assert.equal(registrationState({registrationStatus:'open',registrationTimeConfirmed:true,registrationClosesAt:'2026-10-18T11:00:00+09:00'},now),'접수마감');
});
test('시간이 확인되지 않은 당일 접수는 자정에 마감됐다고 추정하지 않는다',()=>{
 assert.equal(registrationState({registrationStatus:'open',registrationClosesAt:'2026-10-18T00:00:00+09:00'},now),'마감임박');
});
test('미래 접수·조기 마감·불일치 자료는 각각 그대로 구분한다',()=>{
 assert.equal(registrationState({registrationStatus:'open',registrationOpensAt:'2026-10-20'},now),'예정');
 assert.equal(registrationState({registrationStatus:'closed',registrationClosesAt:'2026-10-30'},now),'접수마감');
 assert.equal(registrationState({registrationStatus:'open',needsReview:true},now),'확인 필요');
 assert.equal(registrationState({registrationStatus:'scheduled',registrationOpensAt:'2026-10-17'},now),'예정');
});
