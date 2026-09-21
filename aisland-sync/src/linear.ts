import type {Adapter,Item} from './sync.js';
const endpoint='https://api.linear.app/graphql';
export class LinearAdapter implements Adapter {
 constructor(private token:string){}
 private async gql(query:string,variables:Record<string,unknown>={}){const r=await fetch(endpoint,{method:'POST',headers:{Authorization:this.token,'Content-Type':'application/json'},body:JSON.stringify({query,variables})});if(!r.ok)throw new Error(`Linear ${r.status}`);const j:any=await r.json();if(j.errors)throw new Error(JSON.stringify(j.errors));return j.data;}
 async get(id:string):Promise<Item>{const d=await this.gql(`query($id:String!){issue(id:$id){id title description updatedAt state{name} labels{nodes{name}}}}`,{id});const x=d.issue;return{id:x.id,title:x.title,body:x.description||'',updatedAt:x.updatedAt,state:x.state.name,labels:x.labels.nodes.map((n:any)=>n.name)}}
 async update(id:string,p:Partial<Item>):Promise<Item>{await this.gql(`mutation($id:String!,$input:IssueUpdateInput!){issueUpdate(id:$id,input:$input){success}}`,{id,input:{title:p.title,description:p.body}});return this.get(id)}
}