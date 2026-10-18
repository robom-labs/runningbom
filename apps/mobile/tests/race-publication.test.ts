import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicRaceRows} from '../domains/races/publication';
const race={id:'ok',name:'2026 가을 마라톤',raceDate:'2026-10-20'};
test('public races exclude operational review, past editions and conflicting names',()=>{
 const rows=[race,{...race,id:'review',registrationDataStatus:'needs-review'},{...race,id:'conflict',name:'2025 가을 마라톤'},{...race,id:'past',raceDate:'2026-09-01'},{...race,id:'flagged',needsReview:true}];
 assert.deepEqual(publicRaceRows(rows,'2026-10-18').map(r=>r.id),['ok']);
 assert.equal(rows.length,5);
});
test('only the reviewed exact alias pair shares a canonical event',()=>{
 const rows=[{...race,id:'schedule-0e4e73276928'},{...race,id:'schedule-dd6c6bcc11f2'},{...race,id:'different-event'}];
 assert.deepEqual(publicRaceRows(rows,'2026-10-18').map(r=>r.id),['schedule-0e4e73276928','different-event']);
 assert.equal(publicRaceRows([{...race,id:'schedule-dd6c6bcc11f2'}],'2026-10-18').length,1);
});
