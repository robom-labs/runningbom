// Source authenticity does not make a garment/spec chart an event poster.
export const REJECTED_RACE_IMAGE_HASHES=Object.freeze(['0a8cfd635846f7953bcb483ed82f1560b2654e54a4946dd4f1b1d6782dd15c3d']);
export function raceRepresentativeRejection(image,rejections={}){
 if(REJECTED_RACE_IMAGE_HASHES.includes(image?.sha256)||rejections.hashes?.includes(image?.sha256))return 'reviewed-size-chart-hash';
 let text=[image?.url,image?.originalImageUrl,image?.alt,image?.context].filter(Boolean).join(' ');
 try{text=decodeURIComponent(text);}catch{/* Still inspect unescaped labels. */}
 text=text.normalize('NFKC');
 if(/제품\s*상세\s*(?:스펙|규격)|사이즈\s*(?:표|가이드|안내)|치수\s*표|size[\s_.-]*(?:chart|guide|table)|(?:t[\s_.-]*shirts?|shirts?|singlets?)[\s_.-]*(?:size|chart|spec)|싱글렛|티셔츠|가슴둘레|어깨너비/i.test(text))return 'merchandise-size-guide';
 return null;
}
