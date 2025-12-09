const CACHE = 'anj-invoice-v3';
const RESOURCES = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/creatures.js',
  '/manifest.json',
  '/icon-48.png',
  '/icon-128.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(RESOURCES)));
});

self.addEventListener('fetch', e=>{
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).catch(()=>caches.match('/index.html')))
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=> { if(k!==CACHE) return caches.delete(k); } )))
  );
});
