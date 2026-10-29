// All parser claims must derive from the bytes whose source digest was checked.
// Never use receipt.text, guess a legacy charset, or replace undecodable bytes.
import {createHash} from 'node:crypto';
const hash=body=>createHash('sha256').update(body).digest('hex');
function encoding(label){try{return new TextDecoder(label,{fatal:true}).encoding;}catch{throw Error('unsupported-course-page-charset');}}
export function decodeCourseReceipt(receipt,{maxBytes=4_000_000}={}){
 const body=receipt?.body;
 if(!Buffer.isBuffer(body)||!body.length||body.length>maxBytes||!/^[a-f0-9]{64}$/.test(receipt.sha256||'')||hash(body)!==receipt.sha256)throw Error('page-receipt-integrity');
 const header=String(receipt.contentType||''),declared=[];
 for(const m of header.matchAll(/(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/gi))declared.push(m[1]||m[2]||m[3]);
 // Charset tokens in HTML declarations are ASCII-compatible. A BOM/header can
 // independently establish UTF16; do not infer it from an unbound text field.
 const ascii=body.subarray(0,8192).toString('latin1').replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const head=ascii.split(/<\/head\s*>|<body\b/i)[0];
 for(const m of head.matchAll(/<meta\b[^>]*>/gi)){
  const tag=m[0],direct=tag.match(/\bcharset\s*=\s*(?:"([^";\s]+)"|'([^';\s]+)'|([^\s;"'/>]+))/i);
  if(direct)declared.push(direct[1]||direct[2]||direct[3]);
 }
 let bom;
 if(body.subarray(0,3).equals(Buffer.from([239,187,191])))bom='utf-8';
 else if(body.subarray(0,2).equals(Buffer.from([255,254])))bom='utf-16le';
 else if(body.subarray(0,2).equals(Buffer.from([254,255])))bom='utf-16be';
 const labels=[...declared.map(encoding),...(bom?[bom]:[])],unique=[...new Set(labels)];
 if(unique.length>1)throw Error('conflicting-course-page-charset');
 const charset=unique[0]||'utf-8';let text;
 try{text=new TextDecoder(charset,{fatal:true}).decode(body);}catch{throw Error('invalid-course-page-encoding');}
 return{text,encoding:charset,declaredCharsets:declared,bom:!!bom,sourceSha256:receipt.sha256,sourceBytes:body.length,from:'hash-verified-body'};
}
