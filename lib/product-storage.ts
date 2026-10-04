import type {Product} from '../services/topten';
export type Notes={location:string;display:string;manual?:Partial<Product>};
const blank:Notes={location:'',display:''};
// A small replaceable storage boundary. Each product is stored independently.
export const productStorage={
 read(code:string):Notes{try{return {...blank,...JSON.parse(localStorage.getItem('topten.notes.v1.'+code)||'{}')};}catch{return {...blank};}},
 write(code:string,value:Notes){localStorage.setItem('topten.notes.v1.'+code,JSON.stringify(value));window.dispatchEvent(new CustomEvent('topten-notes',{detail:code}));},
 corrections(code:string):string[]{try{return JSON.parse(localStorage.getItem('topten.corrections.v1.'+code)||'[]');}catch{return [];}},
 remember(from:string,to:string){if(from&&from!==to)localStorage.setItem('topten.corrections.v1.'+from,JSON.stringify([to,...this.corrections(from).filter(c=>c!==to)].slice(0,8)));}
};
export function safeLink(value?:string){try{const u=new URL(value||'');return u.protocol==='https:'?u.href:undefined;}catch{return undefined;}}
