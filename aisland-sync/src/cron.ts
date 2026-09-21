import {LinearAdapter} from './linear.js';import {GitHubAdapter} from './github.js';import {syncPair,type Link} from './sync.js';
const required=['LINEAR_TOKEN','GITHUB_TOKEN','GITHUB_OWNER','GITHUB_REPO','SYNC_LINKS'];for(const k of required)if(!process.env[k])throw new Error(`Missing ${k}`);
const linear=new LinearAdapter(process.env.LINEAR_TOKEN!);const github=new GitHubAdapter(process.env.GITHUB_TOKEN!,process.env.GITHUB_OWNER!,process.env.GITHUB_REPO!);
const links:Link[]=JSON.parse(process.env.SYNC_LINKS!);for(const link of links)console.log(link,await syncPair(linear,github,link));