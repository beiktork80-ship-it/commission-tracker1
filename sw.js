const CACHE_NAME='commission-pwa-v4';
const ASSETS=['./index.html','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','https://cdn.jsdelivr.net/npm/chart.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):null))));});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(e.request.method==='GET'&&n.status===200){const copy=n.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}return n;}).catch(()=>caches.match('./index.html'))));});