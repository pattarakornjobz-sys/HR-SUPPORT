/*!
 * advance-link.js — เมนู "ระบบงานสำนักงาน" สำหรับ Team Desk และ HR Desk
 * ----------------------------------------------------------------------------------------
 *  ระบบในเมนู (เพิ่มในแถบเมนูซ้าย หมวด ระบบงานสำนักงาน ใช้หน้าตาเดียวกับเมนูของระบบนั้น)
 *   1) เงินยืมทดรองจ่าย  — ส่งชื่อและกองของผู้ใช้ไปให้ → เข้าระบบอัตโนมัติ · ตัวเลขแดง = เกิน/ใกล้ครบกำหนด
 *   2) ใบคุมต้นขั้วเช็ค
 *  • กดแล้วเปิดเต็มจอ แบบเดียวกับระบบจองรถ (แถบบน: ‹ กลับ · ชื่อระบบ · เปิดแยก ↗)
 *  • มือถือมีปุ่มลอย "ระบบงาน" มุมขวาล่าง กดแล้วเลือกระบบ
 *
 * ตั้งค่า (ใน app-links.js หรือ config.js ของแต่ละระบบ) — ไม่ใส่ก็ได้ถ้าใช้ลิงก์ค่าเริ่มต้นด้านล่าง
 *   window.DESK_SUITE = Object.assign(window.DESK_SUITE || {}, {
 *     ADVANCE_URL: "https://script.google.com/macros/s/…/exec",   // ระบบเงินยืม
 *     ADVANCE_DIV: "",                                            // (HR Desk) กองของแผนกบุคคลฯ
 *     CHECK_URL:   "https://script.google.com/macros/s/…/exec",   // ระบบใบคุมต้นขั้วเช็ค (ไม่ใส่ = ใช้ค่าเริ่มต้น)
 *     CHECK_OPEN:  "inapp"                                        // "newtab" = เปิดแท็บใหม่แทน
 *   });
 *
 * ระบบต้นทางต้องบอกว่าใครเข้าใช้อยู่ หลังล็อกอินสำเร็จ:
 *   window.DESK_USER = { name: "ชื่อ-นามสกุล", division: "ชื่อกองเต็ม" };
 *   window.dispatchEvent(new Event('desk-user'));
 */
(function () {
  'use strict';
  const DEFAULT_CHECK_URL = 'https://script.google.com/macros/s/AKfycbznnWnVRrYqZKHPOht7871GKJ1XziqJcTD93vXCdpM55YSLzLe_hwRq4ETPq15Nrc-uhg/exec';
  const MOBILE = 860;
  const cfg = () => window.DESK_SUITE || {};
  const pick = k => String(cfg()[k] || (window.TD_CONFIG || {})[k] || (window.HR_CONFIG || {})[k] || '').trim();
  const fromApp = () => cfg().APP === 'hr' || window.HR ? 'hrdesk' : 'teamdesk';
  const user = () => window.DESK_USER || null;
  const isMobile = () => window.innerWidth <= MOBILE;
  const join = (u, q) => u + (u.indexOf('?') < 0 ? '?' : '&') + q;
  const SVG = d => '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

  const APPS = [
    {
      key: 'adv', name: 'เงินยืมทดรองจ่าย', short: 'เงินยืม', badge: true,
      icon: SVG('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.6"/><path d="M6 6V4.5h12V6"/>'),
      tint: 'linear-gradient(140deg,#e7c55a,#a9861c)',
      base: () => pick('ADVANCE_URL'),
      url() {
        const u = user() || {}, q = new URLSearchParams();
        q.set('from', fromApp());
        if (u.name) q.set('name', u.name);
        const div = u.division || cfg().ADVANCE_DIV || '';
        if (div) q.set('div', div);
        return join(this.base(), q.toString());
      }
    },
    {
      key: 'chq', name: 'ใบคุมต้นขั้วเช็ค', short: 'เช็ค', badge: false,
      icon: SVG('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 10h7M6 14h4M15.5 14.5l1.5 1.5 3-3.5"/>'),
      tint: 'linear-gradient(140deg,#5eead4,#0f766e)',
      base: () => pick('CHECK_URL') || DEFAULT_CHECK_URL,
      url() { return this.base(); },
      newTab: () => pick('CHECK_OPEN') === 'newtab'
    }
  ];
  const live = () => APPS.filter(a => a.base());
  const state = { open: null, src: {}, badge: null };

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
      '.adv-ic{width:30px;height:30px;border-radius:9px;color:#0b1f3a;display:flex;align-items:center;justify-content:center;flex:none}',
      '.adv-ic svg{width:17px;height:17px}',
      '.adv-mid span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.adv-new{justify-self:end;color:#6d28d9;font-size:14px;font-weight:600;text-decoration:none;padding:8px 10px;margin-right:-10px;border-radius:10px;white-space:nowrap}',
      '.adv-new:hover{background:#f3efff}',
      '#advPanel iframe{flex:1;width:100%;border:0;background:#f3f5f9;display:none}',
      '#advPanel iframe.on{display:block}',
      'html.adv-lock,html.adv-lock body{overflow:hidden}',
      '.adv-cnt{margin-left:auto;font-size:11.5px;font-weight:700;background:#e11d48;color:#fff;border-radius:999px;padding:1px 8px;min-width:22px;text-align:center}',
      '.adv-cnt.soon{background:#d97706}.adv-cnt[hidden]{display:none}',
      '#advFab{position:fixed;right:16px;bottom:calc(var(--tabbar-h,64px) + 24px + env(safe-area-inset-bottom));z-index:45;display:none;align-items:center;gap:8px;height:50px;padding:0 18px 0 14px;border:0;border-radius:999px;background:linear-gradient(135deg,#173f74,#0b1f3a);color:#fff;font:inherit;font-weight:600;font-size:14px;box-shadow:0 10px 26px rgba(11,31,58,.4);cursor:pointer}',
      '#advFab .adv-cnt{margin-left:2px;border:2px solid #fff}',
      '#advSheet{position:fixed;inset:0;z-index:190;display:none;background:rgba(11,31,58,.35)}',
      '#advSheet.show{display:block}',
      '#advSheet .adv-menu{position:absolute;right:16px;bottom:calc(var(--tabbar-h,64px) + 84px + env(safe-area-inset-bottom));min-width:240px;background:#fff;border-radius:16px;padding:8px;box-shadow:0 18px 40px rgba(11,31,58,.3);animation:advIn .18s ease-out}',
      '#advSheet button{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;padding:12px;border-radius:12px;font:inherit;font-size:15px;font-weight:600;color:#0b1f3a;cursor:pointer;text-align:left}',
      '#advSheet button:hover{background:#f3f5f9}',
      '@media (max-width:' + MOBILE + 'px){#advFab{display:inline-flex}.adv-bar{padding:env(safe-area-inset-top) 12px 0;height:calc(52px + env(safe-area-inset-top))}.adv-mid{font-size:14.5px}.adv-back span{display:none}}',
      '@media print{#advPanel,#advFab,#advSheet{display:none!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------- เมนูซ้าย: ใช้คลาสของระบบนั้น ๆ ให้หน้าตาเหมือนเมนูเดิม ---------- */
  function navHtml(side) {
    const hr = !!side.querySelector('.nv');
    const items = live().map(a => {
      const cnt = a.badge ? '<span class="adv-cnt" hidden></span>' : '';
      return hr
        ? '<button class="nv" data-adv-app="' + a.key + '" type="button">' + a.icon + '<span class="g1">' + a.name + '</span>' + cnt + '</button>'
        : '<button data-adv-app="' + a.key + '" type="button">' + a.icon + '<span>' + a.name + '</span>' + cnt + '</button>';
    }).join('');
    return hr ? '<div class="sg">ระบบงานสำนักงาน</div>' + items : '<nav class="nav"><div class="gh">ระบบงานสำนักงาน</div>' + items + '</nav>';
  }
  function injectNav() {
    if (!live().length || !user()) return;
    const side = document.querySelector('aside.side');
    if (!side || side.querySelector('#advNav')) return;
    const box = document.createElement('div');
    box.id = 'advNav';
    box.innerHTML = navHtml(side);
    const anchor = side.querySelector('.sp, .sysbox, .me, .who2');
    if (anchor) side.insertBefore(box, anchor); else side.appendChild(box);
    box.querySelectorAll('[data-adv-app]').forEach(b => b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      side.classList.remove('open');
      open(b.getAttribute('data-adv-app'));
    }));
    paint(); markActive();
  }
  function injectFab() {
    if (!live().length || !user() || document.getElementById('advFab')) return;
    const b = document.createElement('button');
    b.id = 'advFab'; b.type = 'button';
    const one = live().length === 1 ? live()[0] : null;
    b.innerHTML = (one ? one.icon + '<span>' + one.short + '</span>' : APPS[0].icon + '<span>ระบบงาน</span>') + '<span class="adv-cnt" hidden></span>';
    b.setAttribute('aria-label', 'ระบบงานสำนักงาน');
    b.addEventListener('click', () => one ? open(one.key) : sheet(true));
    document.body.appendChild(b);
    paint();
  }
  function sheet(show) {
    let s = document.getElementById('advSheet');
    if (!s) {
      s = document.createElement('div');
      s.id = 'advSheet';
      s.innerHTML = '<div class="adv-menu">' + live().map(a =>
        '<button type="button" data-adv-app="' + a.key + '"><span class="adv-ic" style="background:' + a.tint + '">' + a.icon + '</span><span>' + a.name + '</span>' +
        (a.badge ? '<span class="adv-cnt" hidden></span>' : '') + '</button>').join('') + '</div>';
      s.addEventListener('click', ev => {
        const b = ev.target.closest('[data-adv-app]');
        sheet(false);
        if (b) open(b.getAttribute('data-adv-app'));
      });
      document.body.appendChild(s);
      paint();
    }
    s.classList.toggle('show', show);
  }

  /* ---------- แผงเต็มจอ ---------- */
  function panel() {
    let p = document.getElementById('advPanel');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'advPanel';
    p.setAttribute('role', 'dialog');
    const home = fromApp() === 'hrdesk' ? 'HR Desk' : 'Team Desk';
    p.innerHTML = '<div class="adv-bar"><button type="button" class="adv-back" data-adv="close" aria-label="กลับ ' + home + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>' + home + '</span></button>' +
      '<div class="adv-mid"><span class="adv-ic" id="advIc"></span><span id="advTitle"></span></div>' +
      '<a class="adv-new" id="advNew" href="#" target="_blank" rel="noopener">เปิดแยก ↗</a></div>';
    p.querySelector('[data-adv="close"]').addEventListener('click', close);
    document.body.appendChild(p);
    return p;
  }
  function frame(key) {
    const p = panel();
    let f = p.querySelector('iframe[data-app="' + key + '"]');
    if (!f) {
      f = document.createElement('iframe');
      f.setAttribute('data-app', key);
      f.setAttribute('referrerpolicy', 'no-referrer');
      p.appendChild(f);
    }
    return f;
  }
  function open(key) {
    const a = APPS.find(x => x.key === (key || 'adv'));
    if (!a || !a.base()) return;
    const src = a.url();
    if (a.newTab && a.newTab()) { window.open(src, '_blank', 'noopener'); return; }
    const p = panel(), f = frame(a.key);
    p.setAttribute('aria-label', 'ระบบ' + a.name);
    document.getElementById('advTitle').textContent = a.name;
    const ic = document.getElementById('advIc');
    ic.innerHTML = a.icon; ic.style.background = a.tint;
    document.getElementById('advNew').href = src;
    f.title = 'ระบบ' + a.name;
    if (state.src[a.key] !== src) { f.src = src; state.src[a.key] = src; }
    p.querySelectorAll('iframe').forEach(x => x.classList.toggle('on', x === f));
    p.classList.add('show');
    document.documentElement.classList.add('adv-lock');
    state.open = a.key;
    markActive();
  }
  function close() {
    const p = document.getElementById('advPanel');
    if (p) p.classList.remove('show');
    document.documentElement.classList.remove('adv-lock');
    state.open = null;
    markActive();
    refreshBadge();
  }
  function markActive() {
    document.querySelectorAll('#advNav [data-adv-app]').forEach(b => b.classList.toggle('on', b.getAttribute('data-adv-app') === state.open));
  }

  /* ---------- ตัวเลขแจ้งเตือน (ระบบเงินยืม) ---------- */
  function paint() {
    const b = state.badge, n = b ? (b.over || 0) + (b.soon || 0) : 0;
    document.querySelectorAll('.adv-cnt').forEach(el => {
      el.hidden = !n;
      el.textContent = n;
      el.classList.toggle('soon', !!b && !b.over);
      el.title = b ? 'เงินยืม: เกินกำหนด ' + (b.over || 0) + ' · ใกล้ครบกำหนด ' + (b.soon || 0) : '';
    });
  }
  async function refreshBadge() {
    const base = APPS[0].base(), u = user(), div = (u && u.division) || cfg().ADVANCE_DIV;
    if (!base || !div) return;
    try {
      const r = await fetch(join(base, 'api=badge&days=7&div=' + encodeURIComponent(div)), { credentials: 'omit' });
      if (r.ok) { state.badge = await r.json(); paint(); }
    } catch (e) { /* ไม่มีเน็ตหรือยังไม่ deploy เวอร์ชันใหม่ ข้ามไป */ }
  }

  /* ---------- เริ่มทำงาน ---------- */
  function sync() {
    css();
    if (!user()) {
      ['advNav', 'advFab', 'advSheet'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
      close(); state.src = {};
      const p = document.getElementById('advPanel'); if (p) p.remove();
      return;
    }
    injectNav(); injectFab();
  }
  function boot() {
    if (!live().length) return;
    sync();
    const app = document.getElementById('app') || document.body;
    new MutationObserver(() => { if (user() && !document.getElementById('advNav')) injectNav(); }).observe(app, { childList: true, subtree: true });
    window.addEventListener('desk-user', () => { sync(); refreshBadge(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const s = document.getElementById('advSheet');
      if (s && s.classList.contains('show')) return sheet(false);
      if (state.open && !document.querySelector('#dlg.show, .dlg')) close();
    });
    refreshBadge();
    setInterval(refreshBadge, 10 * 60 * 1000);
  }
  window.DeskAdvance = { open: open, close: close, refresh: refreshBadge, url: () => APPS[0].url() };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
