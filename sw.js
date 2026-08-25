const CACHE='mi-agenda-v10';
const APP_SHELL=['./','./index.html','./modern.css?v=6','./mobile-drawer-fix.css?v=1','./planner-module.css?v=1','./upgrade-module.css?v=1','./modern.js?v=9','./planner-module.js?v=1','./upgrade-module.js?v=1','./loans-module.js?v=3','./loans-module.css?v=3','./manifest.webmanifest','./icon-mi-agenda.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(url.pathname))));
});