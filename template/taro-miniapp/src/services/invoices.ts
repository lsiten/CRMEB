import { request } from './api';
import { apiId, apiItems, apiRecord, apiText } from './commerce-contracts';
export type Invoice=Readonly<{id:string;name:string;type:1|2;headerType:1|2;taxNumber:string;issued:boolean}>;
function parse(v:unknown):Invoice{const r=apiRecord(v);return{id:apiId(r['id']),name:apiText(r['name']??r['invoice_name']),type:Number(r['type'])===2?2:1,headerType:Number(r['header_type'])===2?2:1,taxNumber:apiText(r['duty_number']??r['tax_number']),issued:Number(r['is_invoice'])===1};}
export async function getInvoices():Promise<readonly Invoice[]>{const r=apiRecord(await request('/v2/invoice',{method:'GET',data:{page:1,limit:50}}));return apiItems(r['data']).flatMap(v=>{try{return[parse(v)]}catch{return[]}})}
export async function saveInvoice(input:Pick<Invoice,'name'|'type'|'headerType'|'taxNumber'>):Promise<void>{if(!input.name.trim()||(input.headerType===2&&!input.taxNumber.trim()))throw new Error('请填写完整发票抬头');await request('/v2/invoice/save',{method:'POST',data:{name:input.name.trim(),type:input.type,header_type:input.headerType,duty_number:input.taxNumber.trim()}})}
export async function deleteInvoice(id:string):Promise<void>{await request(`/v2/invoice/del/${encodeURIComponent(id)}`,{method:'GET'})}
