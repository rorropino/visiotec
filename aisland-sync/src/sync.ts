export type Side='linear'|'github';
export interface Item { id:string; title:string; body:string; updatedAt:string; state:string; labels:string[] }
export interface Link { linearId:string; githubId:string; lastLinear?:string; lastGithub?:string }
export interface Adapter { get(id:string):Promise<Item>; update(id:string, patch:Partial<Item>):Promise<Item> }
export type Winner='linear'|'github'|'none';
export function conflictWinner(linear:Item,github:Item,link:Link):Winner {
 const lc=linear.updatedAt!==link.lastLinear, gc=github.updatedAt!==link.lastGithub;
 if(!lc&&!gc)return 'none'; if(lc&&!gc)return 'linear'; if(gc&&!lc)return 'github';
 return new Date(linear.updatedAt)>=new Date(github.updatedAt)?'linear':'github';
}
export async function syncPair(linearApi:Adapter,githubApi:Adapter,link:Link){
 const [linear,github]=await Promise.all([linearApi.get(link.linearId),githubApi.get(link.githubId)]);
 const winner=conflictWinner(linear,github,link);
 if(winner==='linear') await githubApi.update(link.githubId,{title:linear.title,body:linear.body,state:linear.state,labels:linear.labels});
 if(winner==='github') await linearApi.update(link.linearId,{title:github.title,body:github.body,state:github.state,labels:github.labels});
 return {winner,linearUpdatedAt:linear.updatedAt,githubUpdatedAt:github.updatedAt};
}