/*!
 * advance-link.js — เชื่อมระบบเงินยืมทดรองจ่าย (Apps Script) เข้ากับ Team Desk และ HR Desk
 * ----------------------------------------------------------------------------------------
 *  • เพิ่มเมนู "เงินยืมทดรองจ่าย" ในแถบเมนูซ้าย (หมวด ระบบงานสำนักงาน) ใช้หน้าตาเดียวกับเมนูของระบบนั้น
 *  • กดแล้วเปิดระบบเงินยืมเต็มจอ แบบเดียวกับระบบจองรถ (แถบบน: ‹ กลับ · ชื่อระบบ · เปิดแยก ↗)
 *  • มือถือมีปุ่มลอย "เงินยืม" มุมขวาล่าง
 *  • ตัวเลขแดงบนเมนู = รายการของกองผู้ใช้ที่เกินกำหนด/ใกล้ครบกำหนด (อัปเดตทุก 10 นาที)
 *  • ส่งชื่อและกองของผู้ใช้ไปให้ระบบเงินยืม → เข้าระบบอัตโนมัติ เห็นเฉพาะกองตัวเอง
 *
 * ตั้งค่า (ใน app-links.js หรือ config.js ของแต่ละระบบ):
 *   window.DESK_SUITE = Object.assign(window.DESK_SUITE || {}, {
 *     ADVANCE_URL: "https://script.google.com/macros/s/…/exec",   // ลิงก์เว็บแอประบบเงินยืม
 *     ADVANCE_DIV: ""   // (HR Desk) กองของแผนกบุคคลฯ ถ้าว่าง ผู้ใช้จะเลือกกองเองครั้งแรก
 *   });
 *
 * ระบบต้นทางต้องบอกว่าใครเข้าใช้อยู่ หลังล็อกอินสำเร็จ:
 *   window.DESK_USER = { name: "ชื่อ-นามสกุล", division: "ชื่อกองเต็ม" };
 *   window.dispatchEvent(new Event('desk-user'));
 */
(function () {
  'use strict';
  const APP_NAME = 'เงินยืมทดรองจ่าย';
  const MOBILE = 860;
  const cfg = () => window.DESK_SUITE || {};
  const baseUrl = () => String(cfg().ADVANCE_URL || (window.TD_CONFIG || {}).ADVANCE_URL || (window.HR_CONFIG || {}).ADVANCE_URL || '').trim();
  const fromApp = () => cfg().APP === 'hr' || window.HR ? 'hrdesk' : 'teamdesk';
  const user = () => window.DESK_USER || null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isMobile = () => window.innerWidth <= MOBILE;
  const ICON = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.6"/><path d="M6 6V4.5h12V6"/></svg>';
  const state = { open: false, src: '', badge: null };

  function appUrl(extra) {
    const u = user() || {}, q = new URLSearchParams();
    q.set('from', fromApp());
    if (u.name) q.set('name', u.name);
    const div = u.division || cfg().ADVANCE_DIV || '';
    if (div) q.set('div', div);
    Object.keys(extra || {}).forEach(k => q.set(k, extra[k]));
    return baseUrl() + (baseUrl().indexOf('?') < 0 ? '?' : '&') + q.toString();
  }

  /* ---------- สไตล์ ---------- */
  function css() {
    if (document.getElementById('adv-css')) return;
    const st = document.createElement('style');
    st.id = 'adv-css';
    st.textContent = [
      '#advPanel{position:fixed;inset:0;z-index:200;display:none;flex-direction:column;background:#f3f5f9}',
      '#advPanel.show{display:flex;animation:advIn .22s cubic-bezier(.2,.8,.2,1)}',
      '@keyframes advIn{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}',
      '.adv-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;height:56px;padding:0 18px;background:#fff;border-bottom:1px solid #e6e9f0;box-shadow:0 1px 3px rgba(16,24,40,.05);font-family:inherit;flex:none}',
      '.adv-back{justify-self:start;display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:#6d28d9;font:inherit;font-size:15px;font-weight:600;cursor:pointer;padding:8px 10px;margin-left:-10px;border-radius:10px}',
      '.adv-back:hover{background:#f3efff}.adv-back svg{width:18px;height:18px}',
      '.adv-mid{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:15.5px;color:#0b1f3a;min-width:0}',
      '.adv-mid .adv-ic{width:30px;height:30px;border-radius:9px;background:linear-gradient(140deg,#e7c55a,#a9861c);color:#0b1f3a;display:flex;align-items:center;justify-content:center;flex:none}',
      '.adv-mid .adv-ic svg{width:17px;height:17px}',
      '.adv-mid span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.adv-new{justify-self:end;color:#6d28d9;font-size:14px;font-weight:600;text-decoration:none;padding:8px 10px;margin-right:-10px;border-radius:10px;white-space:nowrap}',
      '.adv-new:hover{background:#f3efff}',
      '#advPanel iframe{flex:1;width:100%;border:0;background:#f3f5f9}',
      'html.adv-lock,html.adv-lock body{overflow:hidden}',
      '.adv-cnt{margin-left:auto;font-size:11.5px;font-weight:700;background:#e11d48;color:#fff;border-radius:999px;padding:1px 8px;min-width:22px;text-align:center}',
      '.adv-cnt.soon{background:#d97706}.adv-cnt[hidden]{display:none}',
      '#advFab{position:fixed;right:16px;bottom:calc(var(--tabbar-h,64px) + 24px + env(safe-area-inset-bottom));z-index:45;display:none;align-items:center;gap:8px;height:50px;padding:0 18px 0 14px;border:0;border-radius:999px;background:linear-gradient(135deg,#173f74,#0b1f3a);color:#fff;font:inherit;font-weight:600;font-size:14px;box-shadow:0 10px 26px rgba(11,31,58,.4);cursor:pointer}',
      '#advFab .adv-cnt{margin-left:2px;border:2px solid #fff}',
      '@media (max-width:' + MOBILE + 'px){#advFab{display:inline-flex}.adv-bar{padding:env(safe-area-inset-top) 12px 0;height:calc(52px + env(safe-area-inset-top))}.adv-mid{font-size:14.5px}.adv-back span{display:none}}',
      '@media print{#advPanel,#advFab{display:none!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------- เมนูซ้าย: ใช้คลาสของระบบนั้น ๆ ให้หน้าตาเหมือนเมนูเดิม ---------- */
  function navHtml(side) {
    const cnt = '<span class="adv-cnt" hidden></span>';
    if (side.querySelector('.nv')) { // HR Desk
      return '<div class="sg">ระบบงานสำนักงาน</div><button class="nv" id="advNavBtn" type="button">' + ICON + '<span class="g1">' + APP_NAME + '</span>' + cnt + '</button>';
    }
    return '<nav class="nav"><div class="gh">ระบบงานสำนักงาน</div><button id="advNavBtn" type="button">' + ICON + '<span>' + APP_NAME + '</span>' + cnt + '</button></nav>'; // Team Desk
  }
  function injectNav() {
    if (!baseUrl() || !user()) return;
    const side = document.querySelector('aside.side');
    if (!side || side.querySelector('#advNav')) return;
    const box = document.createElement('div');
    box.id = 'advNav';
    box.innerHTML = navHtml(side);
    const anchor = side.querySelector('.sp, .sysbox, .me, .who2');
    if (anchor) side.insertBefore(box, anchor); else side.appendChild(box);
    box.querySelector('#advNavBtn').addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      side.classList.remove('open');
      open();
    });
    paint();
  }
  function injectFab() {
    if (!baseUrl() || !user() || document.getElementById('advFab')) return;
    const b = document.createElement('button');
    b.id = 'advFab'; b.type = 'button';
    b.innerHTML = ICON + '<span>เงินยืม</span><span class="adv-cnt" hidden></span>';
    b.setAttribute('aria-label', 'เปิดระบบ' + APP_NAME);
    b.addEventListener('click', open);
    document.body.appendChild(b);
    paint();
  }

  /* ---------- แผงระบบเงินยืม ---------- */
  function panel() {
    let p = document.getElementById('advPanel');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'advPanel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'ระบบ' + APP_NAME);
    const home = fromApp() === 'hrdesk' ? 'HR Desk' : 'Team Desk';
    p.innerHTML = '<div class="adv-bar"><button type="button" class="adv-back" data-adv="close" aria-label="กลับ ' + home + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>' + home + '</span></button>' +
      '<div class="adv-mid"><span class="adv-ic">' + ICON + '</span><span>' + APP_NAME + '</span></div>' +
      '<a class="adv-new" id="advNew" href="#" target="_blank" rel="noopener">เปิดแยก ↗</a></div><iframe id="advFrame" title="ระบบ' + APP_NAME + '" referrerpolicy="no-referrer"></iframe>';
    p.querySelector('[data-adv="close"]').addEventListener('click', close);
    document.body.appendChild(p);
    return p;
  }
  function placePanel() { /* เปิดเต็มจอแบบเดียวกับระบบจองรถ */ }
  function open() {
    if (!baseUrl()) return;
    const p = panel(), u = user() || {}, src = appUrl();
    document.getElementById('advNew').href = src;
    if (state.src !== src) { document.getElementById('advFrame').src = src; state.src = src; }
    placePanel();
    p.classList.add('show');
    document.documentElement.classList.add('adv-lock');
    state.open = true;
    markActive();
  }
  function close() {
    const p = document.getElementById('advPanel');
    if (p) p.classList.remove('show');
    document.documentElement.classList.remove('adv-lock');
    state.open = false;
    markActive();
    refreshBadge();
  }
  function markActive() {
    const b = document.getElementById('advNavBtn');
    if (b) b.classList.toggle('on', state.open);
  }

  /* ---------- ตัวเลขแจ้งเตือน ---------- */
  function paint() {
    const b = state.badge, n = b ? (b.over || 0) + (b.soon || 0) : 0;
    document.querySelectorAll('.adv-cnt').forEach(el => {
      el.hidden = !n;
      el.textContent = n;
      el.classList.toggle('soon', !!b && !b.over);
      el.title = b ? 'เกินกำหนด ' + (b.over || 0) + ' · ใกล้ครบกำหนด ' + (b.soon || 0) : '';
    });
  }
  async function refreshBadge() {
    const u = user(), div = (u && u.division) || cfg().ADVANCE_DIV;
    if (!baseUrl() || !div) return;
    try {
      const r = await fetch(baseUrl() + (baseUrl().indexOf('?') < 0 ? '?' : '&') + 'api=badge&days=7&div=' + encodeURIComponent(div), { credentials: 'omit' });
      if (r.ok) { state.badge = await r.json(); paint(); }
    } catch (e) { /* ไม่มีเน็ตหรือยังไม่ deploy เวอร์ชันใหม่ ข้ามไป */ }
  }

  /* ---------- เริ่มทำงาน ---------- */
  function sync() {
    css();
    if (!user()) {
      ['advNav', 'advFab'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
      close(); state.src = '';
      return;
    }
    injectNav(); injectFab();
  }
  function boot() {
    if (!baseUrl()) return;
    sync();
    const app = document.getElementById('app') || document.body;
    new MutationObserver(() => { if (user() && !document.getElementById('advNav')) injectNav(); }).observe(app, { childList: true, subtree: true });
    window.addEventListener('desk-user', () => { sync(); refreshBadge(); });
    window.addEventListener('resize', () => { if (state.open) placePanel(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.open && !document.querySelector('#dlg.show, .dlg')) close(); });
    refreshBadge();
    setInterval(refreshBadge, 10 * 60 * 1000);
  }
  window.DeskAdvance = { open: open, close: close, refresh: refreshBadge, url: appUrl };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
