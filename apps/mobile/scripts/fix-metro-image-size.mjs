// Metro 0.84 accepts file paths; patched image-size 2 accepts bytes only.
// Keep the upstream fixed parser and adapt this one build-tool boundary.
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../node_modules/metro/src/Assets.js',import.meta.url);
const metadata=JSON.parse(await readFile(new URL('../node_modules/metro/package.json',import.meta.url),'utf8'));
const old='const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;';
const next='const dimensions = isImage ? (0, _imageSize.default)(typeof isImageInput === "string" ? _fs.default.readFileSync(isImageInput) : isImageInput) : null;';
const source=await readFile(file,'utf8');
if(metadata.version!=='0.84.4')throw new Error('Unsupported Metro version. Review its image-size API before applying the compatibility patch.');
if(source.includes(next)){console.log('Metro image byte adapter already applied');}
else if(source.includes(old)){await writeFile(file,source.replace(old,next));console.log('Applied Metro 0.84.4 image-size 2 byte adapter');}
else throw new Error('Metro changed. Review its image-size API before applying the compatibility patch.');
