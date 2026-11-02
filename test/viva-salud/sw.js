const CACHE='viva-salud-static-v2';
const STATIC=['./','./index.html','./assets/styles.css?v=2','./assets/pro.css?v=2','./assets/app.js?v=2','./assets/icons.svg','./assets/icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('viva-salud-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin||url.pathname.includes('/api/')||url.pathname.includes('/private/'))return;
 if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 event.respondWith(fetch(req).then(response=>{if(response.ok && (response.headers.get('Content-Type')||'').match(/text\/html|javascript|text\/css|image\/svg\+xml|manifest\+json/)){const clone=response.clone();caches.open(CACHE).then(c=>c.put(req,clone));}return response;}).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html'))));
});
