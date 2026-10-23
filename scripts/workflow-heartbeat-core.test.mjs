import test from 'node:test';import assert from 'node:assert/strict';import {workflowHeartbeat} from './workflow-heartbeat-core.mjs';
const now=Date.parse('2026-10-22T00:00:00Z');
const success={status:'completed',conclusion:'success',updatedAt:'2026-10-21T23:00:00Z'};
test('queued run can coexist with recent success without manufacturing a success',()=>{
 assert.equal(workflowHeartbeat([{status:'in_progress',updatedAt:'2026-10-21T23:50:00Z'},success],now).ok,true);
 assert.equal(workflowHeartbeat([{status:'in_progress',updatedAt:'2026-10-21T22:50:00Z'},success],now).ok,false);
});
test('missing, failed, stale, future and invalid records fail closed',()=>{
 for(const runs of [[],[{...success,conclusion:'failure'},success],[{...success,updatedAt:'2026-10-20T00:00:00Z'}],[{...success,updatedAt:'2026-10-23T00:00:00Z'}],[{...success,updatedAt:'bad'}]])assert.equal(workflowHeartbeat(runs,now).ok,false);
});
