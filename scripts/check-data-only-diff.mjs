import {execFileSync} from 'node:child_process';
import {DATA_ONLY_PATHS} from './data-only-pages.mjs';
const paths=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{encoding:'utf8'}).split('\0').filter(Boolean);
const allowed=new Set(DATA_ONLY_PATHS);
for(const entry of paths){
 if(!/^( M|M |\?\?) /.test(entry)||!allowed.has(entry.slice(3)))throw Error('Refusing non-data, deletion, rename or unreviewed staged change.');
}
console.log('Git publication diff contains permitted JSON files only.');
