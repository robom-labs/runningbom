import test from 'node:test';import assert from 'node:assert/strict';
import {calendarEntries,calendarDateKey} from '../src/features/calendar.ts';
const race={id:'r',name:'2027 바다마라톤',opensAt:'2026-10-22',closesAt:'2026-11-01',raceAt:'2027-03-21'};
test('calendar keeps opening, closing and race dates separate and omits absent dates',()=>{
 const rows=calendarEntries([race,{...race,id:'no-dates',opensAt:'',closesAt:''}],'접수 일정');
 assert.deepEqual(rows.map(row=>[row.kind,row.date]),[['open','2026-10-22'],['close','2026-11-01']]);
 assert.deepEqual(calendarEntries([race],'대회 일정').map(row=>[row.kind,row.date]),[['race','2027-03-21']]);
});
test('Korean day grouping crosses UTC midnight correctly and does not invent midnight registration times',()=>{
 assert.equal(calendarDateKey(new Date('2026-10-18T15:01:00Z')),'2026-10-19');
 assert.equal(calendarEntries([race],'접수 일정')[0].date,'2026-10-22');
});
