export interface TransferCatalog {
 id:'san-antonio-a-b'; version:1; reviewedAt:string; title:string; target:string; indoorNavigation:false;
 facts:string[]; unknowns:string[]; notice:string;
 sources:{title:string;url:string;supports:string}[];
}
export function validateTransferCatalog(value:unknown):value is TransferCatalog {
 if(!value || typeof value!=='object')return false;
 const v=value as TransferCatalog;
 const text=(s:unknown)=>typeof s==='string'&&s.length>0&&s.length<=1000;
 return v.id==='san-antonio-a-b'&&v.version===1&&v.indoorNavigation===false&&
  /^\d{4}-\d{2}-\d{2}$/.test(v.reviewedAt)&&text(v.title)&&text(v.target)&&text(v.notice)&&
  [v.facts,v.unknowns].every(a=>Array.isArray(a)&&a.length>0&&a.length<=10&&a.every(text))&&
  Array.isArray(v.sources)&&v.sources.length>0&&v.sources.length<=10&&v.sources.every(s=>{
   try{return text(s.title)&&text(s.supports)&&new URL(s.url).origin==='https://www.metrodemedellin.gov.co';}catch{return false;}
  });
}
export async function loadTransferCatalog(signal:AbortSignal):Promise<TransferCatalog>{
 const response=await fetch('/transfers/san-antonio-a-b.json',{signal,cache:'no-cache'});
 if(!response.ok)throw new Error('CATALOG');
 const data:unknown=await response.json();
 if(!validateTransferCatalog(data))throw new Error('CATALOG');
 return data;
}
