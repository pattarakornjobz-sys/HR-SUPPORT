/* Desk Suite · เชื่อม Team Desk / HR Desk กับระบบจองรถส่วนกลาง (Apps Script)
   ไฟล์เดียวกันใช้ได้ทั้งสองแอป ตั้งค่าใน window.DESK_SUITE (config.js / app-links.js)
   - แท็บ "จองรถ" ในแถบล่าง + เมนูด้านข้าง
   - การ์ดสถานะรถบนหน้าภาพรวม (ดึงจาก CAR_APP_URL?api=status)
   - เปิดระบบจองรถเต็มจอในแอป พร้อมเติมชื่อ/หน่วยงานของผู้ใช้
   - แตะโลโก้เพื่อสลับแอปในชุด */
(function () {
  'use strict';
  const C = window.DESK_SUITE || {};
  const APP = C.APP === 'hr' ? 'hr' : 'team';
  const NAME = APP === 'hr' ? 'HR Desk' : 'Team Desk';
  const ICON = APP === 'hr'
    ? { team: 'team-icon-192.png', hr: 'icon-192.png', car: 'car-icon-192.png' }
    : { team: 'icon-192.png', hr: 'hr-icon-192.png', car: 'car-icon-192.png' };
  const CAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13l2.2-5.5A2 2 0 0 1 7.1 6h9.8a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1M3 13v4a1 1 0 0 0 1 1h1M3 13h18M9 18h6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
  const ICO = {
    board: '<path d="M4 4h5v16H4zM10.5 4h5v11h-5zM17 4h3v7h-3z"/>',
    dash: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  };
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r) => (r || document).querySelector(s);

  /* ---------- ผู้ใช้ปัจจุบัน ---------- */
  function me() {
    try {
      if (APP === 'team' && typeof S !== 'undefined' && S && S.me) { // eslint-disable-line no-undef
        const m = S.me, d = (S.d.depts || []).find(x => x.id === (S.dept || m.dept_id)); // eslint-disable-line no-undef
        return { name: m.full_name || m.nickname || '', nick: m.nickname || '', dept: d ? d.name : '', view: S.view }; // eslint-disable-line no-undef
      }
      if (APP === 'hr' && window.HR && HR.S && HR.S.me) {
        const m = HR.S.me;
        return { name: m.full_name || m.name || m.nickname || '', nick: m.nickname || '', dept: C.DEPT_NAME || 'แผนกบุคคลและสวัสดิการ', view: HR.S.view };
      }
    } catch (e) {}
    return { name: '', nick: '', dept: '', view: '' };
  }

  /* ---------- สถานะรถ ---------- */
  let car = { loaded: false, ok: false }, carAt = 0, carBusy = false;
  const hm = s => String(s || '').slice(11, 16);
  const when = s => { if (!s) return ''; const d = s.slice(0, 10), t = new Date(), td = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); return d === td ? hm(s) + ' น.' : s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + hm(s) + ' น.'; };
  function carView() {
    if (!C.CAR_APP_URL) return { cls: 'na', word: 'ระบบจองรถ', sub: 'ยังไม่ได้ตั้งค่า CAR_APP_URL', plate: 'รถส่วนกลาง' };
    if (!car.ok) return { cls: 'na', word: car.loaded ? 'ระบบจองรถ' : 'กำลังตรวจสถานะ…', sub: 'แตะเพื่อดูสถานะและจองรถ', plate: 'รถส่วนกลาง' };
    const v = (car.vehicles || [])[0] || {}, c = v.current, n = v.next;
    const plate = 'รถส่วนกลาง' + (v.plate ? ' · ' + v.plate : '');
    if (v.state === 'IN_USE') return { cls: 'use', word: 'กำลังใช้งาน', sub: (c ? c.name + ' · คืน ' + when(c.end) : ''), plate };
    if (v.state === 'RESERVED') return { cls: 'resv', word: 'ถึงคิวจองแล้ว', sub: c ? 'รอ ' + c.name + ' รับป้ายหน้ารถ' : '', plate };
    return { cls: 'free', word: 'รถว่าง', sub: n ? 'ว่างถึง ' + when(n.start) + ' · จองได้เลย' : 'ไม่มีคิวจอง · จองได้เลย', plate };
  }
  async function loadCar(force) {
    if (!C.CAR_APP_URL || carBusy || (!force && Date.now() - carAt < 60000)) return;
    carBusy = true;
    try {
      const r = await fetch(C.CAR_APP_URL + (C.CAR_APP_URL.indexOf('?') < 0 ? '?' : '&') + 'api=status', { redirect: 'follow' });
      const j = await r.json();
      car = Object.assign({ loaded: true }, j); carAt = Date.now();
    } catch (e) { car = { loaded: true, ok: false }; carAt = Date.now(); }
    carBusy = false; paintCar();
  }
  function paintCar() {
    const v = carView();
    document.querySelectorAll('[data-ds-card]').forEach(el => {
      el.className = 'ds-carcard ds-' + v.cls;
      el.innerHTML = '<span class="ds-ci">' + CAR_SVG + '</span><span class="ds-cm"><span class="ds-cl">' + esc(v.plate) + '</span><span class="ds-cw"><i></i>' + esc(v.word) + '</span><span class="ds-cs">' + esc(v.sub) + '</span></span><span class="ds-cgo">จองรถ ›</span>';
    });
    document.querySelectorAll('[data-ds-dot]').forEach(el => { el.className = 'ds-dot ds-' + v.cls; });
    const sw = $('#dsSwCar'); if (sw) { sw.textContent = v.word + (v.sub ? ' · ' + v.sub : ''); sw.className = 'ds-swsub ds-t-' + v.cls; }
  }

  /* ---------- เปิดระบบจองรถในแอป ---------- */
  function carUrl(page) {
    const u = me(), q = ['page=' + encodeURIComponent(page || 'book')];
    if (u.name) q.push('name=' + encodeURIComponent(u.name));
    if (u.dept) q.push('dept=' + encodeURIComponent(u.dept));
    q.push('from=' + APP);
    return C.CAR_APP_URL + (C.CAR_APP_URL.indexOf('?') < 0 ? '?' : '&') + q.join('&');
  }
  function openCar(page) {
    closeSwitch();
    if (!C.CAR_APP_URL) { alert('ยังไม่ได้ตั้งค่าลิงก์ระบบจองรถ\nใส่ CAR_APP_URL (ลิงก์ .../exec ของ Apps Script) ใน DESK_SUITE'); return; }
    const url = carUrl(page);
    if (C.CAR_OPEN === 'newtab') { window.open(url, '_blank', 'noopener'); return; }
    let ov = $('#dsCar');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'dsCar'; ov.className = 'ds-ov noprint';
      ov.innerHTML = '<div class="ds-ovh"><button type="button" class="ds-back" aria-label="กลับ">' + svg('<path d="M15 18l-6-6 6-6"/>') + '<span>' + NAME + '</span></button><div class="ds-ovt"><img src="' + ICON.car + '" alt=""><b>จองรถส่วนกลาง</b></div><a class="ds-ext" target="_blank" rel="noopener">เปิดแยก ↗</a></div><div class="ds-ovb"><div class="ds-load"><img src="' + ICON.car + '" alt=""><span>กำลังเปิดระบบจองรถ…</span></div><iframe title="ระบบจองรถส่วนกลาง" allow="clipboard-write"></iframe></div>';
      document.body.appendChild(ov);
      ov.querySelector('.ds-back').onclick = closeCar;
      ov.querySelector('iframe').addEventListener('load', () => ov.classList.add('ready'));
    }
    const fr = ov.querySelector('iframe');
    if (fr.dataset.src !== url) { ov.classList.remove('ready'); fr.dataset.src = url; fr.src = url; }
    ov.querySelector('.ds-ext').href = url;
    requestAnimationFrame(() => ov.classList.add('open'));
    document.documentElement.classList.add('ds-lock');
    try { history.pushState({ dsCar: 1 }, ''); } catch (e) {}
  }
  function closeCar(fromPop) {
    const ov = $('#dsCar'); if (!ov || !ov.classList.contains('open')) return;
    ov.classList.remove('open'); document.documentElement.classList.remove('ds-lock');
    loadCar(true);
    if (fromPop !== true) { try { if (history.state && history.state.dsCar) history.back(); } catch (e) {} }
  }
  window.addEventListener('popstate', () => closeCar(true));

  /* ---------- สลับแอป ---------- */
  function openSwitch() {
    let sw = $('#dsSw');
    if (!sw) {
      sw = document.createElement('div'); sw.id = 'dsSw'; sw.className = 'ds-sw noprint';
      const row = (key, title, sub, href, cur) => (cur ? '<div class="ds-swr cur">' : href ? '<a class="ds-swr" href="' + esc(href) + '">' : '<button type="button" class="ds-swr" data-ds-open="car">') +
        '<img src="' + ICON[key] + '" alt=""><span class="ds-swm"><b>' + title + '</b><span class="ds-swsub"' + (key === 'car' ? ' id="dsSwCar"' : '') + '>' + sub + '</span></span>' + (cur ? '<span class="ds-cur">กำลังใช้</span>' : '<span class="ds-chev">›</span>') + (cur ? '</div>' : href ? '</a>' : '</button>');
      sw.innerHTML = '<div class="ds-swbg"></div><div class="ds-sws" role="dialog" aria-label="สลับแอป"><i class="ds-grab"></i><div class="ds-swh">แอปในชุด Desk</div>' +
        row('team', 'Team Desk', 'มอบหมายและติดตามงาน', APP === 'team' ? '' : C.TEAM_DESK_URL, APP === 'team') +
        row('hr', 'HR Desk', 'แผนกบุคคลและสวัสดิการ', APP === 'hr' ? '' : C.HR_DESK_URL, APP === 'hr') +
        row('car', 'จองรถส่วนกลาง', '', '', false) + '</div>';
      document.body.appendChild(sw);
      sw.querySelector('.ds-swbg').onclick = closeSwitch;
      sw.querySelectorAll('a.ds-swr[href=""]').forEach(a => a.remove());
    }
    paintCar();
    requestAnimationFrame(() => sw.classList.add('open'));
  }
  function closeSwitch() { const sw = $('#dsSw'); if (sw) sw.classList.remove('open'); }

  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-ds-open]');
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    const k = t.getAttribute('data-ds-open');
    if (k === 'car') openCar(t.getAttribute('data-ds-page') || 'book');
    else if (k === 'switch') openSwitch();
  }, true);

  /* ---------- ฉีด UI หลังแอปเรนเดอร์ ---------- */
  const card = () => '<button type="button" class="ds-carcard" data-ds-card data-ds-open="car" data-ds-page="status"></button>';
  const logoImg = () => '<img src="' + ICON[APP] + '" alt="' + NAME + '">';
  function ensureTeam() {
    document.querySelectorAll('.brand .logo:not([data-ds]), .gate .glogo:not([data-ds])').forEach(el => {
      el.setAttribute('data-ds', ''); el.innerHTML = logoImg();
      if (el.closest('.side')) { el.setAttribute('data-ds-open', 'switch'); el.title = 'สลับแอป'; }
    });
    const side = $('.side'), meBox = side && $('.me', side);
    if (side && meBox && !$('.ds-nav', side)) {
      const n = document.createElement('nav'); n.className = 'nav ds-nav';
      n.innerHTML = '<div class="gh">แอปในชุด</div><button type="button" data-ds-open="car">' + CAR_SVG + '<span>จองรถส่วนกลาง</span><i data-ds-dot class="ds-dot"></i></button>' +
        (C.HR_DESK_URL ? '<button type="button" onclick="location.href=\'' + esc(C.HR_DESK_URL) + '\'"><img class="ds-ni" src="' + ICON.hr + '" alt=""><span>HR Desk</span></button>' : '');
      side.insertBefore(n, meBox);
    }
    const tb = $('.tabbar');
    if (tb && !$('.ds-tab', tb)) {
      const btns = tb.querySelectorAll(':scope > button'), at = btns[Math.floor(btns.length / 2)] || null;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ds-tab'; b.setAttribute('data-ds-open', 'car');
      b.innerHTML = '<span class="ds-tabi">' + CAR_SVG + '</span><span>จองรถ</span>';
      tb.insertBefore(b, at);
    }
    const ab = $('.appbar');
    if (ab && !$('.ds-applogo', ab)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ds-applogo'; b.setAttribute('data-ds-open', 'switch'); b.title = 'สลับแอป'; b.innerHTML = logoImg();
      const ttl = $('.ttl', ab); ab.insertBefore(b, ttl || ab.firstChild);
    }
    const v = me().view, top = $('.main > .top');
    if (top && ['dash', 'org', 'mine'].indexOf(v) >= 0 && !$('.main > .ds-carcard')) top.insertAdjacentHTML('afterend', card());
  }
  function ensureHr() {
    document.querySelectorAll('.logo:not([data-ds])').forEach(el => {
      el.setAttribute('data-ds', ''); el.innerHTML = logoImg();
      if (el.closest('.side')) { el.setAttribute('data-ds-open', 'switch'); el.title = 'สลับแอป'; }
    });
    const side = $('.side'), sp = side && $('.sp', side);
    if (side && sp && !$('.ds-nav', side)) {
      const n = document.createElement('div'); n.className = 'ds-nav';
      n.innerHTML = '<div class="sg">แอปในชุด</div><button type="button" class="nv" data-ds-open="car"><span class="ds-nvi">' + CAR_SVG + '</span><span class="g1">จองรถส่วนกลาง</span><i data-ds-dot class="ds-dot"></i></button>' +
        (C.TEAM_DESK_URL ? '<a class="nv" href="' + esc(C.TEAM_DESK_URL) + '"><img class="ds-ni" src="' + ICON.team + '" alt=""><span class="g1">Team Desk</span></a>' : '');
      side.insertBefore(n, sp);
    }
    const top = $('.top2');
    if (top && !$('.ds-applogo', top)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ds-applogo'; b.setAttribute('data-ds-open', 'switch'); b.title = 'สลับแอป';
      b.innerHTML = logoImg() + '<span class="ds-apn"><b>HR Desk</b><small>แผนกบุคคลและสวัสดิการ</small></span>';
      top.insertBefore(b, top.firstChild);
    }
    const app = $('.app'), v = me().view;
    if (app) {
      let tb = $('.ds-tabbar', app);
      if (!tb) {
        tb = document.createElement('nav'); tb.className = 'ds-tabbar noprint';
        const it = (k, l) => '<button type="button" data-act="view" data-a="' + k + '" data-k="' + k + '">' + svg(ICO[k]) + '<span>' + l + '</span></button>';
        tb.innerHTML = it('board', 'บอร์ด') + it('dash', 'ภาพรวม') + '<button type="button" class="ds-tab" data-ds-open="car"><span class="ds-tabi">' + CAR_SVG + '</span><span>จองรถ</span></button>' + it('cal', 'ปฏิทิน') +
          '<button type="button" data-act="menu" data-k="menu">' + svg(ICO.menu) + '<span>เมนู</span></button>';
        app.appendChild(tb);
      }
      tb.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.getAttribute('data-k') === v));
    }
    const ph = $('.content .ph2');
    if (ph && ['board', 'dash'].indexOf(v) >= 0 && !$('.content > .ds-carcard')) ph.insertAdjacentHTML('afterend', card());
  }
  function ensure() {
    try { (APP === 'hr' ? ensureHr : ensureTeam)(); } catch (e) { /* ไม่ให้ส่วนเสริมทำแอปหลักพัง */ }
    if (document.querySelector('[data-ds-card]:empty')) paintCar();
    loadCar(false);
  }

  /* ---------- สไตล์ ---------- */
  const T = APP === 'hr'
    ? '--ds-pri:#a8446a;--ds-grad:linear-gradient(135deg,#c65d82,#a8446a 45%,#8a5aa8);--ds-ink:#3a1f30;--ds-mu:#7a6570;--ds-line:#f0dde6;--ds-t:#faeaf0;--ds-surf:#fff;--ds-bg:#fdf3f6;--ds-font:Kanit,Sarabun,sans-serif;--ds-sh:0 1px 2px rgba(58,31,48,.06),0 10px 28px rgba(58,31,48,.10)'
    : '--ds-pri:var(--pri);--ds-grad:var(--grad);--ds-ink:var(--ink);--ds-mu:var(--muted);--ds-line:var(--line);--ds-t:var(--pri-t);--ds-surf:var(--surface);--ds-bg:var(--bg);--ds-font:inherit;--ds-sh:var(--sh-2)';
  const css = ':root{' + T + '}' +
    '.ds-lock,.ds-lock body{overflow:hidden}' +
    /* การ์ดสถานะรถ */
    '.ds-carcard{--sc:var(--ds-pri);--st:var(--ds-t);width:100%;display:flex;align-items:center;gap:12px;text-align:left;border:1px solid var(--ds-line);background:var(--ds-surf);color:var(--ds-ink);border-radius:20px;padding:12px 14px;margin:0 0 16px;box-shadow:var(--ds-sh);cursor:pointer;font:inherit;transition:transform .15s,box-shadow .15s}' +
    '.ds-carcard:active{transform:scale(.985)}' +
    '.ds-free{--sc:#059669;--st:#e1f7ee}.ds-use{--sc:#ea6a0c;--st:#fff2e6}.ds-resv{--sc:#2563eb;--st:#e6eeff}' +
    '.ds-ci{width:46px;height:46px;border-radius:15px;background:var(--st);color:var(--sc);display:grid;place-items:center;flex:none}.ds-ci svg{width:24px;height:24px}' +
    '.ds-cm{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.35}.ds-cl{font-size:12px;color:var(--ds-mu)}' +
    '.ds-cw{display:flex;align-items:center;gap:7px;font-family:var(--ds-font);font-weight:600;font-size:16px;color:var(--sc)}.ds-cw i{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px var(--st)}' +
    '.ds-cs{font-size:12.5px;color:var(--ds-mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ds-cgo{flex:none;border-radius:12px;padding:8px 12px;background:var(--ds-grad);color:#fff;font-family:var(--ds-font);font-weight:600;font-size:13px;white-space:nowrap}' +
    '.ds-dot{margin-left:auto;width:8px;height:8px;border-radius:50%;background:#94a3b8;flex:none}.ds-dot.ds-free{background:#10b981}.ds-dot.ds-use{background:#f97316}.ds-dot.ds-resv{background:#3b82f6}' +
    '.ds-ni{width:20px;height:20px;border-radius:6px;flex:none}' +
    /* โลโก้ */
    '[data-ds]{background:none!important;padding:0!important;overflow:hidden;cursor:pointer}[data-ds] img{width:100%;height:100%;display:block;border-radius:inherit}' +
    '.ds-applogo{display:none;align-items:center;gap:10px;border:0;background:none;padding:0;cursor:pointer;color:inherit;text-align:left;font:inherit}' +
    '.ds-applogo img{width:34px;height:34px;border-radius:10px;display:block;box-shadow:0 4px 12px rgba(99,102,241,.3);flex:none}' +
    '.ds-apn{display:flex;flex-direction:column;line-height:1.2}.ds-apn b{font-family:var(--ds-font);font-weight:600;font-size:16px;color:var(--ds-ink)}.ds-apn small{font-size:11px;color:var(--ds-mu)}' +
    /* แท็บจองรถ */
    '.ds-tab .ds-tabi{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(140deg,#10b981,#0ea5b7);color:#fff;box-shadow:0 6px 14px rgba(16,185,129,.35)}.ds-tab .ds-tabi svg{width:19px!important;height:19px!important}.ds-tab{color:#059669!important;font-weight:600!important}' +
    /* หน้าจองรถเต็มจอ */
    '.ds-ov{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;background:var(--ds-bg);transform:translateY(100%);transition:transform .34s cubic-bezier(.2,.8,.2,1);visibility:hidden}' +
    '.ds-ov.open{transform:none;visibility:visible}' +
    '.ds-ovh{display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;background:color-mix(in srgb,var(--ds-surf) 88%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--ds-line);color:var(--ds-ink)}' +
    '.ds-back{display:flex;align-items:center;gap:2px;border:0;background:none;color:var(--ds-pri);font:inherit;font-weight:600;font-size:15px;padding:8px 6px;cursor:pointer;min-height:44px}.ds-back svg{width:22px;height:22px}' +
    '.ds-ovt{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0}.ds-ovt img{width:24px;height:24px;border-radius:7px}.ds-ovt b{font-family:var(--ds-font);font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ds-ext{font-size:13px;font-weight:600;color:var(--ds-pri);text-decoration:none;padding:8px 6px;white-space:nowrap}' +
    '.ds-ovb{position:relative;flex:1}.ds-ovb iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#f2f5fb;opacity:0;transition:opacity .25s}.ds-ov.ready iframe{opacity:1}' +
    '.ds-load{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--ds-mu);font-size:14px}.ds-load img{width:64px;height:64px;border-radius:19px;animation:dsPulse 1.4s ease-in-out infinite}' +
    '@keyframes dsPulse{50%{transform:scale(.92);opacity:.7}}' +
    /* แผ่นสลับแอป */
    '.ds-sw{position:fixed;inset:0;z-index:310;display:flex;flex-direction:column;justify-content:flex-end;visibility:hidden;pointer-events:none}.ds-sw.open{visibility:visible;pointer-events:auto}' +
    '.ds-swbg{position:absolute;inset:0;background:rgba(10,12,34,.45);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .25s}.ds-sw.open .ds-swbg{opacity:1}' +
    '.ds-sws{position:relative;background:var(--ds-surf);color:var(--ds-ink);border-radius:28px 28px 0 0;padding:10px 16px calc(22px + env(safe-area-inset-bottom));max-width:520px;width:100%;margin:0 auto;transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1);box-shadow:0 -20px 50px rgba(0,0,0,.2)}.ds-sw.open .ds-sws{transform:none}' +
    '.ds-grab{display:block;width:40px;height:5px;border-radius:3px;background:var(--ds-line);margin:0 auto 12px}.ds-swh{font-family:var(--ds-font);font-weight:600;font-size:17px;padding:0 6px 10px}' +
    '.ds-swr{display:flex;align-items:center;gap:12px;width:100%;padding:10px;border:0;border-radius:18px;background:none;color:inherit;text-decoration:none;font:inherit;text-align:left;cursor:pointer}.ds-swr:hover{background:var(--ds-t)}.ds-swr.cur{background:var(--ds-t);cursor:default}' +
    '.ds-swr img{width:48px;height:48px;border-radius:14px;flex:none}.ds-swm{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.35}.ds-swm b{font-family:var(--ds-font);font-weight:600;font-size:15px}' +
    '.ds-swsub{font-size:12.5px;color:var(--ds-mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ds-t-free{color:#059669}.ds-t-use{color:#ea6a0c}.ds-t-resv{color:#2563eb}' +
    '.ds-cur{font-size:11px;font-weight:600;color:var(--ds-pri);background:var(--ds-surf);border-radius:999px;padding:2px 9px}.ds-chev{color:var(--ds-mu);font-size:20px}' +
    '@media (max-width:860px){.appbar .ds-applogo{display:flex}.appbar .ds-applogo img{width:32px;height:32px}.tabbar .ds-tab span:last-child{font-size:10.5px}}' +
    '@media print{.ds-carcard,.ds-ov,.ds-sw,.ds-tabbar,.ds-applogo{display:none!important}}';

  /* HR Desk · โครงแอปมือถือ (แถบล่าง แถบบนแบบกระจก แผ่นล่าง) */
  const hrCss = '.ds-tabbar{display:none}' +
    '.side .ds-nav .nv .ds-nvi{width:20px;height:20px;display:grid;place-items:center;color:#059669}.side .ds-nav .nv .ds-nvi svg{width:19px;height:19px}.side .ds-nav a.nv{text-decoration:none}' +
    '@media (max-width:900px){' +
    'html{-webkit-tap-highlight-color:transparent}' +
    '.content{padding:0 14px calc(104px + env(safe-area-inset-bottom))!important}' +
    '.top2{position:sticky;top:0;z-index:20;margin:0 -14px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px!important;background:rgba(253,243,246,.84);-webkit-backdrop-filter:saturate(1.6) blur(16px);backdrop-filter:saturate(1.6) blur(16px);border-bottom:1px solid var(--line)}' +
    '.top2 .ds-applogo{display:flex}.top2 .hamb{display:none!important}.top2>.g1{display:none}.top2 .ds-applogo{flex:1;min-width:0}' +
    '.top2 .yrsel{font-size:12px;padding:4px 8px;border-radius:12px}.top2 .round{width:40px;height:40px}' +
    '.ph2{margin-top:14px!important;border:0!important;border-radius:24px!important;padding:18px!important;color:#fff;background:linear-gradient(135deg,#c65d82 0%,#a8446a 45%,#8a5aa8 100%)!important;box-shadow:0 16px 36px rgba(138,51,87,.28)!important;position:relative;overflow:hidden}' +
    '.ph2::after{content:"";position:absolute;right:-60px;top:-70px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.10);pointer-events:none}' +
    '.ph2 h2{color:#fff!important;font-size:22px}.ph2 .mu{color:rgba(255,255,255,.9)!important;font-size:12.5px}' +
    '.ph2 .hacts{width:100%;position:relative;z-index:1}.ph2 .hacts .btn{flex:1;background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.3);color:#fff}.ph2 .hacts .btn.primary{background:#fff;border-color:#fff;color:#a8446a}' +
    '.content>.ds-carcard{margin-top:14px}main{margin-top:14px}' +
    '.card{border-radius:20px}.tiles{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px}.tile{border-radius:18px}.tv{font-size:24px}' +
    '.tabs{border-radius:16px}.btn{min-height:42px}.search{max-width:none}' +
    '.ov{align-items:end!important;padding:0!important}.dlg{max-width:100%!important;border-radius:26px 26px 0 0!important;max-height:92dvh;padding-bottom:calc(18px + env(safe-area-inset-bottom))!important;animation:dsUp .28s cubic-bezier(.2,.8,.2,1)}' +
    '.dlg::before{content:"";display:block;width:40px;height:5px;border-radius:3px;background:var(--line);margin:-8px auto 12px}' +
    '@keyframes dsUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}' +
    '.pop{left:12px!important;right:12px!important;width:auto!important;top:calc(64px + env(safe-area-inset-top))!important}.pop.pup{top:auto!important;bottom:calc(92px + env(safe-area-inset-bottom))!important}' +
    '#toast{bottom:calc(96px + env(safe-area-inset-bottom))}' +
    '.ds-tabbar{display:flex;position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:24;height:66px;padding:6px;border-radius:24px;background:rgba(255,255,255,.86);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border:1px solid var(--line);box-shadow:0 14px 36px rgba(58,31,48,.18)}' +
    '.ds-tabbar button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:none;border-radius:18px;color:var(--ink-soft);font:600 10.5px Kanit,sans-serif;cursor:pointer}' +
    '.ds-tabbar button svg{width:22px;height:22px}.ds-tabbar button.on{background:var(--rose-600);color:#fff;box-shadow:0 6px 16px rgba(168,68,106,.35)}' +
    '.side{z-index:40}.scrim.show{z-index:35}' +
    '}';

  function boot() {
    const st = document.createElement('style'); st.id = 'ds-style'; st.textContent = css + (APP === 'hr' ? hrCss : ''); document.head.appendChild(st);
    const root = document.getElementById('app');
    if (root) new MutationObserver(() => requestAnimationFrame(ensure)).observe(root, { childList: true });
    setInterval(ensure, 1500);
    setInterval(() => loadCar(false), 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadCar(false); });
    ensure();
  }
  window.DeskSuite = { openCar, openSwitch, refresh: () => loadCar(true) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
