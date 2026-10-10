export const normalizeName=value=>value.toLowerCase().replace(/\s/g,'');
export function suggestNames(items,query){
 const words=query.trim().split(/\s+/).filter(Boolean).map(normalizeName);
 if(!words.length)return [];
 const seen=new Set();
 return items.filter(item=>words.every(word=>normalizeName(item.name+' '+item.aliases).includes(word)))
 .sort((a,b)=>Number(normalizeName(b.name).startsWith(normalizeName(query)))-Number(normalizeName(a.name).startsWith(normalizeName(query))))
 .filter(item=>{const key=normalizeName(item.name);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
}
