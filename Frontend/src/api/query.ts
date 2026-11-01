import type {Query} from '../types/queries';
export function requestQuery(query?:Query){
 return Object.fromEntries(Object.entries(query||{}).filter(([k,v])=>v!==undefined&&v!==''&&!(k==='page'&&v===1)&&!(k==='pageSize'&&v===50)));
}
