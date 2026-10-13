export function restorePageState(value,today){
 const state=value&&typeof value==='object'?value:{};
 return {view:['today','search','closing','schedule','events'].includes(state.view)?state.view:'today',showProducts:state.date===today&&state.showProducts===true,query:typeof state.query==='string'?state.query.slice(0,80):'',searched:typeof state.searched==='string'&&/^[A-Z0-9]{8,15}$/.test(state.searched)?state.searched:null};
}
