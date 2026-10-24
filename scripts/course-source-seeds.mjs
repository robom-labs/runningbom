import{safeCourseURL,courseDirectoryHost}from'./course-discovery-core.mjs';
// Main-reviewed current official seeds travel as course metadata, not app edits.
// No observed page/image candidates are promoted by merely being a seed.
export function courseSeedURLs(race,manifest){
 if(!manifest)return[];
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.records)||!/^[a-f0-9]{64}$/.test(manifest.sourceIndexSha256||''))throw Error('Course seed metadata schema');
 const matches=manifest.records.filter(r=>r.eventId===race.id&&r.raceDate===race.raceDate);if(matches.length>1)throw Error('Duplicate course edition seeds');
 const row=matches[0];if(!row)return[];if(!Array.isArray(row.urls)||row.urls.length>3)throw Error('Course seed URL budget');
 return row.urls.map(url=>{const safe=safeCourseURL(url);if(!safe||courseDirectoryHost(new URL(safe).hostname))throw Error('Unsafe/nonofficial course seed');return safe;});
}
