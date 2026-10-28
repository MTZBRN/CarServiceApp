import type { JobPart, ServiceJob } from '../../types';
export interface DraftPart { partName:string; partNumber:string; quantity:string; unitPrice:string; }
export interface WorksheetDraft { vehicleId:string; date:string; description:string; laborCost:string; parts:DraftPart[]; }
export const partsSubtotal = (parts:Pick<JobPart,'quantity'|'unitPrice'>[]) => parts.reduce((sum,p)=>sum+p.quantity*p.unitPrice,0);
export const worksheetTotal = (job:Pick<ServiceJob,'laborCost'|'jobParts'>) => partsSubtotal(job.jobParts)+job.laborCost;
export const toParts = (parts:DraftPart[]):JobPart[] => parts.map(p=>({...p,quantity:Number(p.quantity),unitPrice:Number(p.unitPrice)}));
export function draftFrom(job:ServiceJob):WorksheetDraft { return { vehicleId:String(job.vehicleId),date:job.date.slice(0,10),description:job.description,laborCost:String(job.laborCost),parts:job.jobParts.map(p=>({partName:p.partName,partNumber:p.partNumber||'',quantity:String(p.quantity),unitPrice:String(p.unitPrice)})) }; }
export function validateDraft(draft:WorksheetDraft) {
 const errors:Record<string,string>={};
 if(!draft.vehicleId) errors.vehicle='Válassz járművet.';
 if(!draft.description.trim()) errors.description='A munka leírása kötelező.';
 if(!draft.date||!Number.isFinite(new Date(draft.date).getTime())) errors.date='Érvényes dátumot adj meg.';
 if(!draft.laborCost.trim()||!Number.isFinite(Number(draft.laborCost))||Number(draft.laborCost)<0) errors.labor='Nemnegatív munkadíjat adj meg.';
 draft.parts.forEach((p,i)=>{if(!p.partName.trim())errors['name'+i]='A megnevezés kötelező.';if(!p.quantity.trim()||!Number.isFinite(Number(p.quantity))||Number(p.quantity)<=0)errors['quantity'+i]='A mennyiség legyen pozitív.';if(!p.unitPrice.trim()||!Number.isFinite(Number(p.unitPrice))||Number(p.unitPrice)<0)errors['price'+i]='Nemnegatív egységár szükséges.';});
 if(!Number.isFinite(worksheetTotal({jobParts:toParts(draft.parts),laborCost:Number(draft.laborCost)})))errors.total='A végösszeg nem számítható ki.';
 return errors;
}
