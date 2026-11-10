/* Team Desk service worker · ให้ติดตั้งเป็นแอปและเปิดหน้าได้เร็ว
   ข้อมูลงานทั้งหมดดึงสดจาก Supabase เสมอ (ไม่เก็บแคช) */
const CACHE = 'td-shell-v2';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;            // API / ล็อกอิน / รูป → ไม่ยุ่ง
  if (r.mode === 'navigate' || (u.origin === location.origin && /\/(index\.html|config\.js)?$|config\.js$/.test(u.pathname))) {
    // หน้าเว็บและ config: ใช้ของใหม่ก่อน ออฟไลน์ค่อยใช้แคช
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r.mode === 'navigate' ? './' : r, cp)); return res; })
      .catch(() => caches.match(r.mode === 'navigate' ? './' : r).then(m => m || caches.match('./index.html'))));
    return;
  }
  if (u.origin === location.origin || /(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(u.hostname)) {
    // ไอคอน ฟอนต์ ไลบรารี: ใช้แคชก่อน แล้วอัปเดตเบื้องหลัง
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(m => { const net = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }).catch(() => m); return m || net; })));
  }
});
