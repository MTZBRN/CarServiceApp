import type {APIRequestContext} from '@playwright/test';
export async function expectedVersion(request:APIRequestContext,url:string,options:{headers?:Record<string,string>;data?:unknown}) {
 const part=url.match(/\/(?:parts|Parts)\/(\d+)$/);
 const response=await request.get(part?url.replace(/\/\d+$/,''):url,{headers:options.headers});
 if(!response.ok()) throw new Error('Could not load expected version for '+url+': '+response.status());
 const body=await response.json();const record=part?body.find((p:{id:number})=>p.id===Number(part[1])):body;
 return {...options,data:{...(options.data as object),version:record.version}};
}
