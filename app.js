// ============================================================
// บอร์ดงานแผนกบุคคลและสวัสดิการ — client logic
// ============================================================
const sb = window.supabase.createClient(window.HR_CONFIG.SUPABASE_URL, window.HR_CONFIG.SUPABASE_ANON_KEY);

const STATUS_LABEL = { doing: 'กำลังทำ', todo: 'ต้องทำ', done: 'เสร็จแล้ว' };
const STATUS_DOT = { doing: 'var(--sky)', todo: 'var(--gold)', done: 'var(--sage)' };

let CURRENT_SESSION = null;
let CURRENT_STAFF = null;   // แถวของผู้ใช้ปัจจุบันในตาราง staff
let ALL_STAFF = [];
let ALL_TASKS = [];
let ACTIVE_FILTER = 'all';

// ---------------- debug trail (เก็บไว้ใน sessionStorage เพราะ console หายตอนเปลี่ยนหน้า) ----------------
function debugLog(step, extra) {
  try {
    const log = JSON.parse(sessionStorage.getItem('hr_debug') || '[]');
    log.push({ t: new Date().toISOString(), step, extra: extra || null });
    sessionStorage.setItem('hr_debug', JSON.stringify(log.slice(-20)));
  } catch (e) { /* ignore */ }
  console.log('[hr-debug]', step, extra || '');
}

// ---------------- auth guard ----------------
(async function init() {
  debugLog('index.html loaded', { href: window.location.href });

  // ถ้า Supabase ส่ง error กลับมาทาง query string (เช่น account ไม่ผ่าน consent screen)
  // ให้ส่งต่อไปแสดงที่หน้า login แทนที่จะเด้งแบบเงียบๆ
  const qp = new URLSearchParams(window.location.search);
  if (qp.get('error') || qp.get('error_description')) {
    debugLog('auth callback error', { error: qp.get('error'), desc: qp.get('error_description') });
    window.location.replace('login.html?error=' + encodeURIComponent(qp.get('error') || qp.get('error_description')));
    return;
  }

  let { data: { session }, error: sessErr } = await sb.auth.getSession();
  debugLog('first getSession()', { hasSession: !!session, error: sessErr?.message });
  if (!session) {
    // เผื่อกรณี race condition: หลัง redirect กลับจาก Google การแลก code เป็น session
    // อาจยังไม่เสร็จตอน getSession() ครั้งแรก ลองรออีกครั้งสั้นๆ ก่อนสรุปว่าไม่มี session จริง
    await new Promise(r => setTimeout(r, 400));
    ({ data: { session }, error: sessErr } = await sb.auth.getSession());
    debugLog('retry getSession()', { hasSession: !!session, error: sessErr?.message });
  }
  if (!session) {
    debugLog('no session after retry -> redirect to login');
    window.location.replace('login.html');
    return;
  }
  debugLog('session found', { email: session.user.email, uid: session.user.id });
  CURRENT_SESSION = session;

  // ครั้งแรกที่ login ด้วย Gmail นี้: ลอง "จับคู่" กับแถวที่หัวหน้าแผนกเตรียมไว้ล่วงหน้าด้วยอีเมล
  // (ถ้าแถวนั้นถูกจับคู่ไปแล้ว หรือยังไม่มีแถวเลย คำสั่งนี้จะไม่เปลี่ยนอะไร ไม่ error)
  const { data: claimData, error: claimErr } = await sb
    .from('hr_staff')
    .update({ auth_uid: session.user.id })
    .is('auth_uid', null)
    .ilike('email', session.user.email)
    .select();
  debugLog('claim update', { rows: claimData, error: claimErr?.message });

  const { data: staffRow, error: fetchErr } = await sb.from('hr_staff').select('*').eq('auth_uid', session.user.id).maybeSingle();
  debugLog('fetch staffRow', { found: !!staffRow, error: fetchErr?.message });
  if (!staffRow) {
    document.getElementById('pending-email').textContent = session.user.email || '–';
    document.getElementById('pending-uid').textContent = session.user.id;
    document.getElementById('pending-shell').hidden = false;
    document.getElementById('pending-logout').addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.replace('login.html');
    });
    return;
  }

  document.getElementById('app-shell').hidden = false;

  startClock();
  await loadStaffAndTasks();
  wireToolbar();
  wireModal();
  wireDropzone();
  wireProfileMenu();
  subscribeRealtime();
  loadDriveList();
})();

// ---------------- clock (Thai, 24h, พ.ศ.) ----------------
function startClock() {
  const days = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    const now = new Date();
    document.getElementById('thai-date').textContent =
      `${days[now.getDay()]}ที่ ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543}`;
    document.getElementById('thai-time').textContent =
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} น.`;
  }
  tick();
  setInterval(tick, 1000);
}

// ---------------- data load ----------------
async function loadStaffAndTasks() {
  const { data: staff, error: staffErr } = await sb.from('hr_staff').select('*').order('sort_order');
  const { data: tasks, error: taskErr } = await sb.from('hr_tasks').select('*').order('updated_at', { ascending: false });

  if (staffErr || taskErr) {
    document.getElementById('board').innerHTML =
      `<div class="empty-note">โหลดข้อมูลไม่สำเร็จ: ${(staffErr || taskErr).message}<br>ตรวจสอบว่ารัน sql/schema.sql และเพิ่มแถว hr_staff ของทุกคนแล้ว</div>`;
    return;
  }

  ALL_STAFF = staff || [];
  ALL_TASKS = tasks || [];
  CURRENT_STAFF = ALL_STAFF.find(s => s.auth_uid === CURRENT_SESSION.user.id) || null;

  renderWhoBar();
  renderBoard();
  renderActivity();
  populateAssigneeSelect();
}

function renderWhoBar() {
  if (!CURRENT_STAFF) return;
  document.getElementById('profile-wrap').hidden = false;

  const avatarInner = CURRENT_STAFF.avatar_url
    ? `<img src="${CURRENT_STAFF.avatar_url}" alt="${escapeHtml(CURRENT_STAFF.nickname)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : initials(CURRENT_STAFF.nickname);

  const av = document.getElementById('who-avatar');
  av.style.background = CURRENT_STAFF.avatar_color;
  av.innerHTML = avatarInner;

  const menuAv = document.getElementById('menu-avatar');
  menuAv.style.background = CURRENT_STAFF.avatar_color;
  menuAv.innerHTML = avatarInner;

  document.getElementById('who-name').textContent = CURRENT_STAFF.nickname;
  document.getElementById('who-role').textContent = CURRENT_STAFF.role === 'head' ? 'หัวหน้าแผนก' : 'เจ้าหน้าที่';
  document.getElementById('menu-name').textContent = CURRENT_STAFF.nickname;
  document.getElementById('menu-email').textContent = CURRENT_STAFF.email || CURRENT_SESSION.user.email || '';
  document.getElementById('f-phone').value = CURRENT_STAFF.phone || '';
}

function wireProfileMenu() {
  const trigger = document.getElementById('profile-trigger');
  const menu = document.getElementById('profile-menu');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== trigger) menu.hidden = true;
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.replace('login.html');
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('f-phone').value.trim();
    const note = document.getElementById('profile-save-note');
    const { error } = await sb.from('hr_staff').update({ phone }).eq('id', CURRENT_STAFF.id);
    if (error) { note.style.color = 'var(--gold)'; note.textContent = 'บันทึกไม่สำเร็จ: ' + error.message; return; }
    CURRENT_STAFF.phone = phone;
    const idx = ALL_STAFF.findIndex(s => s.id === CURRENT_STAFF.id);
    if (idx >= 0) ALL_STAFF[idx].phone = phone;
    note.style.color = 'var(--sage)';
    note.textContent = 'บันทึกแล้ว';
    setTimeout(() => { note.textContent = ''; }, 2000);
  });
}

function initials(name) { return (name || '?').slice(0, 2); }

function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'เมื่อครู่นี้';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

function fmtDueDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}

// ---------------- board render ----------------
function renderBoard() {
  const board = document.getElementById('board');
  if (!ALL_STAFF.length) {
    board.innerHTML = `<div class="empty-note">ยังไม่มีรายชื่อเจ้าหน้าที่ในตาราง hr_staff — เพิ่มได้จาก sql/schema.sql</div>`;
    return;
  }
  const head = ALL_STAFF.find(s => s.role === 'head');
  const members = ALL_STAFF.filter(s => s.role !== 'head');

  board.innerHTML = '';
  if (head) board.appendChild(renderHeadColumn(head));
  members.forEach(m => board.appendChild(renderMemberColumn(m)));

  const total = ALL_TASKS.length;
  const doing = ALL_TASKS.filter(t => t.status === 'doing').length;
  const todo = ALL_TASKS.filter(t => t.status === 'todo').length;
  const done = ALL_TASKS.filter(t => t.status === 'done').length;
  document.getElementById('task-summary').textContent =
    `${total} รายการ · กำลังทำ ${doing} · ต้องทำ ${todo} · เสร็จแล้ว ${done}`;
}

function avatarHtml(staff, cls) {
  if (staff.avatar_url) return `<div class="avatar ${cls || ''}"><img src="${staff.avatar_url}" alt="${staff.nickname}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>`;
  return `<div class="avatar ${cls || ''}" style="background:${staff.avatar_color}">${initials(staff.nickname)}</div>`;
}

function renderHeadColumn(head) {
  const col = document.createElement('div');
  col.className = 'col lead';

  const members = ALL_STAFF.filter(s => s.role !== 'head');
  const totalDoing = ALL_TASKS.filter(t => t.status === 'doing').length;
  const totalTodo = ALL_TASKS.filter(t => t.status === 'todo').length;
  const totalDone = ALL_TASKS.filter(t => t.status === 'done').length;

  const teamLines = members.map(m => {
    const mine = ALL_TASKS.filter(t => t.assigned_to === m.id);
    const d = mine.filter(t => t.status === 'doing').length;
    const t = mine.filter(t => t.status === 'todo').length;
    const done = mine.filter(t => t.status === 'done').length;
    const sum = Math.max(mine.length, 1);
    return `
      <div class="team-line">
        ${avatarHtml(m, 'ov-avatar')}
        <div class="ov-info">
          <div class="ov-name">${escapeHtml(m.nickname)} · ${escapeHtml(m.scope.split(' ').slice(0,3).join(' '))}</div>
          <div class="bar-track">
            <span style="width:${d/sum*100}%;background:var(--sky)"></span>
            <span style="width:${t/sum*100}%;background:var(--gold)"></span>
            <span style="width:${done/sum*100}%;background:var(--sage)"></span>
          </div>
          <div class="ov-nums"><span>ทำอยู่ ${d}</span><span>ต้องทำ ${t}</span><span>เสร็จ ${done}</span></div>
        </div>
      </div>`;
  }).join('');

  const recent = [...ALL_TASKS].sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 4);
  const recentHtml = recent.length ? recent.map(t => {
    const staff = ALL_STAFF.find(s => s.id === t.assigned_to);
    return `
      <div class="card">
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="due">${staff ? escapeHtml(staff.nickname) : ''} · ${relTime(t.updated_at)}</div>
        <span class="cat-tag">${escapeHtml(t.category || 'ทั่วไป')}</span>
      </div>`;
  }).join('') : `<div class="empty-card">ยังไม่มีงาน</div>`;

  col.innerHTML = `
    <div class="col-head">
      ${avatarHtml(head)}
      <div class="who">
        <div class="name">${escapeHtml(head.nickname)} <svg class="crown" viewBox="0 0 24 24" fill="#c99a3f"><path d="M3 17l2-9 5 4 2-6 2 6 5-4 2 9z"/></svg></div>
        <div class="role">${escapeHtml(head.scope)}</div>
        ${head.phone ? `<div class="role" style="margin-top:2px;">☎ ${escapeHtml(head.phone)}</div>` : ''}
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-tile"><div class="num">${totalDoing}</div><div class="lbl">กำลังทำ</div></div>
      <div class="stat-tile"><div class="num">${totalTodo}</div><div class="lbl">ต้องทำ</div></div>
      <div class="stat-tile"><div class="num">${totalDone}</div><div class="lbl">เสร็จแล้ว</div></div>
    </div>
    <div class="task-group">
      <div class="group-label">ภาพรวมรายคน</div>
      ${teamLines || '<div class="empty-note">ยังไม่มีสมาชิกในทีม</div>'}
    </div>
    <div class="task-group">
      <div class="group-label"><span class="gdot" style="background:var(--sky)"></span>อัปเดตล่าสุด</div>
      ${recentHtml}
    </div>
  `;
  return col;
}

function renderMemberColumn(member) {
  const col = document.createElement('div');
  col.className = 'col';
  const mine = ALL_TASKS.filter(t => t.assigned_to === member.id);

  const groups = ['doing', 'todo', 'done'].map(status => {
    const items = mine.filter(t => t.status === status && matchesFilter(status));
    const cards = items.length
      ? items.map(t => taskCardHtml(t)).join('')
      : (matchesFilter(status) ? `<div class="empty-card">ไม่มีงาน</div>` : '');
    if (!matchesFilter(status)) return '';
    return `
      <div class="task-group">
        <div class="group-label"><span class="gdot" style="background:${STATUS_DOT[status]}"></span>${STATUS_LABEL[status]}<span class="gcount">${items.length}</span></div>
        ${cards}
      </div>`;
  }).join('');

  col.innerHTML = `
    <div class="col-head">
      ${avatarHtml(member)}
      <div class="who">
        <div class="name">${escapeHtml(member.nickname)}</div>
        <div class="role">${escapeHtml(member.scope)}</div>
        ${member.phone ? `<div class="role" style="margin-top:2px;">☎ ${escapeHtml(member.phone)}</div>` : ''}
      </div>
    </div>
    ${groups || '<div class="empty-note">ไม่มีงานตามตัวกรองนี้</div>'}
  `;
  return col;
}

function matchesFilter(status) { return ACTIVE_FILTER === 'all' || ACTIVE_FILTER === status; }

function taskCardHtml(t) {
  const canEdit = CURRENT_STAFF && (CURRENT_STAFF.role === 'head' || t.assigned_to === CURRENT_STAFF.id);
  return `
    <div class="card ${t.status === 'done' ? 'done' : ''}" data-task-id="${t.id}">
      ${canEdit ? `
        <div class="card-menu">
          <button class="del-task" title="ลบงาน" data-id="${t.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
          </button>
        </div>` : ''}
      <div class="title">${escapeHtml(t.title)}</div>
      ${t.due_date ? `<div class="due">กำหนดส่ง ${fmtDueDate(t.due_date)}</div>` : `<div class="due">${t.status === 'done' ? 'เสร็จเมื่อ ' + relTime(t.completed_at) : 'ไม่ระบุกำหนด'}</div>`}
      <span class="cat-tag">${escapeHtml(t.category || 'ทั่วไป')}</span>
      ${canEdit ? `
        <select class="status-select" data-id="${t.id}">
          <option value="todo" ${t.status === 'todo' ? 'selected' : ''}>ต้องทำ</option>
          <option value="doing" ${t.status === 'doing' ? 'selected' : ''}>กำลังทำ</option>
          <option value="done" ${t.status === 'done' ? 'selected' : ''}>เสร็จแล้ว</option>
        </select>` : ''}
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// event delegation for status change / delete (board re-renders often, so attach once on parent)
document.addEventListener('change', async (e) => {
  if (e.target.matches('.status-select')) {
    const id = e.target.dataset.id;
    const status = e.target.value;
    const { error } = await sb.from('hr_tasks').update({ status }).eq('id', id);
    if (error) alert('อัปเดตสถานะไม่สำเร็จ: ' + error.message);
  }
});
document.addEventListener('click', async (e) => {
  const del = e.target.closest('.del-task');
  if (del) {
    if (!confirm('ลบงานนี้ใช่หรือไม่?')) return;
    const { error } = await sb.from('hr_tasks').delete().eq('id', del.dataset.id);
    if (error) alert('ลบไม่สำเร็จ: ' + error.message);
  }
});

// ---------------- toolbar filter ----------------
function wireToolbar() {
  document.getElementById('filter-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    ACTIVE_FILTER = btn.dataset.filter;
    [...document.querySelectorAll('#filter-toggle button')].forEach(b => b.classList.toggle('active', b === btn));
    renderBoard();
  });
}

// ---------------- activity feed ----------------
function renderActivity() {
  const feed = document.getElementById('activity-feed');
  const recent = [...ALL_TASKS].sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8);
  if (!recent.length) { feed.innerHTML = `<div class="empty-note">ยังไม่มีความเคลื่อนไหว</div>`; return; }
  feed.innerHTML = recent.map(t => {
    const staff = ALL_STAFF.find(s => s.id === t.assigned_to);
    const label = t.status === 'done' ? 'ทำงานเสร็จ' : (t.status === 'doing' ? 'กำลังดำเนินการ' : 'เพิ่มงานใหม่');
    return `
      <div class="notif-row">
        <div class="notif-dot" style="background:${STATUS_DOT[t.status]}"></div>
        <div><div class="t">${staff ? escapeHtml(staff.nickname) : ''} ${label}: ${escapeHtml(t.title)}</div><div class="s">${relTime(t.updated_at)}</div></div>
      </div>`;
  }).join('');
}

// ---------------- add task modal ----------------
function populateAssigneeSelect() {
  const sel = document.getElementById('f-assignee');
  const options = CURRENT_STAFF && CURRENT_STAFF.role === 'head' ? ALL_STAFF : ALL_STAFF.filter(s => s.id === CURRENT_STAFF?.id);
  sel.innerHTML = options.map(s => `<option value="${s.id}">${escapeHtml(s.nickname)}${s.role === 'head' ? ' (หัวหน้าแผนก)' : ''}</option>`).join('');
}

function wireModal() {
  const overlay = document.getElementById('task-modal');
  document.getElementById('open-add-task').addEventListener('click', () => overlay.classList.add('open'));
  document.getElementById('cancel-task').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

  document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const assigned_to = document.getElementById('f-assignee').value;
    const title = document.getElementById('f-title').value.trim();
    const category = document.getElementById('f-category').value.trim();
    const due_date = document.getElementById('f-due').value || null;
    const status = document.getElementById('f-status').value;
    if (!title) return;

    const { error } = await sb.from('hr_tasks').insert({
      assigned_to, title, category, due_date, status, created_by: CURRENT_STAFF?.id ?? null,
    });
    if (error) { alert('เพิ่มงานไม่สำเร็จ: ' + error.message); return; }

    overlay.classList.remove('open');
    e.target.reset();
  });
}

// ---------------- realtime ----------------
function subscribeRealtime() {
  sb.channel('tasks-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_tasks' }, async () => {
      const { data } = await sb.from('hr_tasks').select('*').order('updated_at', { ascending: false });
      ALL_TASKS = data || [];
      renderBoard();
      renderActivity();
    })
    .subscribe();
}

// ---------------- Google Drive panel ----------------
async function authedFetch(url, options = {}) {
  const headers = Object.assign({}, options.headers, {
    Authorization: `Bearer ${CURRENT_SESSION.access_token}`,
  });
  return fetch(url, Object.assign({}, options, { headers }));
}

async function loadDriveList() {
  const listEl = document.getElementById('drive-list');
  try {
    const res = await authedFetch('/api/drive-list');
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (data.folderUrl) document.getElementById('drive-open-btn').href = data.folderUrl;
    renderDriveList(data.files || []);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-note">โหลดรายการไฟล์ไม่สำเร็จ — ตรวจสอบว่าตั้งค่า Google Service Account ใน Vercel env vars แล้ว<br><span style="opacity:.7">${escapeHtml(err.message || '')}</span></div>`;
  }
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function renderDriveList(files) {
  const listEl = document.getElementById('drive-list');
  if (!files.length) { listEl.innerHTML = `<div class="empty-note">ยังไม่มีไฟล์ในโฟลเดอร์กลาง</div>`; return; }
  listEl.innerHTML = files.map(f => `
    <div class="drive-row">
      <div class="drive-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3v5h5"/><path d="M6 3h8l5 5v13H6z"/></svg></div>
      <div><div class="drive-name">${escapeHtml(f.name)}</div><div class="drive-meta">${fmtSize(f.size)} · ${f.uploadedByNickname ? escapeHtml(f.uploadedByNickname) + ' · ' : ''}${relTime(f.modifiedTime)}</div></div>
      <a class="drive-view" href="${f.webViewLink}" target="_blank" rel="noopener" title="เปิดใน Drive">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
      </a>
    </div>`).join('');
}

function wireDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('drive-file-input');

  fileInput.addEventListener('change', (e) => { uploadFiles(e.target.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files); });
}

async function uploadFiles(fileList) {
  const sub = document.getElementById('dz-sub');
  for (const file of Array.from(fileList)) {
    sub.textContent = `กำลังอัปโหลด ${file.name}…`;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authedFetch('/api/drive-upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      alert(`อัปโหลด ${file.name} ไม่สำเร็จ: ${err.message}`);
    }
  }
  sub.textContent = 'ไฟล์จะถูกเก็บในโฟลเดอร์ของแผนกบุคคลและสวัสดิการ';
  loadDriveList();
}
