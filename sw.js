// HR Desk ไม่ใช้ service worker · ไฟล์นี้ใช้ล้าง service worker ของ Team Desk ที่ติดตั้งผิดโดเมน
// (อัปโหลดผิด 10 พ.ย. 2569) — เปิดหน้าเว็บครั้งถัดไป จะล้างแคชและยกเลิกตัวเองอัตโนมัติ
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' }); cs.forEach(c => c.navigate(c.url));
  })());
});
