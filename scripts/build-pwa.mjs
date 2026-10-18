import fs from 'node:fs/promises';
import crypto from 'node:crypto';
async function staticFiles(directory='dist',prefix='') {
  const entries=await fs.readdir(directory,{withFileTypes:true});
  const nested=await Promise.all(entries.map(entry=>entry.isDirectory()
    ? staticFiles(directory+'/'+entry.name,prefix+entry.name+'/')
    : entry.name==='sw.js'||entry.name==='firebase-config.json' ? [] : [prefix+entry.name]));
  return nested.flat().sort();
}
const paths=await staticFiles();
const files=['./',...paths];
const hash=crypto.createHash('sha256');
for(const path of paths) hash.update(path).update(await fs.readFile('dist/'+path));
const version=hash.digest('hex').slice(0,12);
const worker=`const CACHE='mi-vida-${version}';const FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new URL(f,self.registration.scope).href)))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mi-vida-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname)||u.pathname.endsWith('firebase-config.json'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match(new URL('index.html',self.registration.scope).href)));return;}if(FILES.some(f=>new URL(f,self.registration.scope).href===u.href))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`;
await fs.writeFile('dist/sw.js',worker);
console.log('PWA lista: '+files.length+' archivos, caché '+version);
