/* HR Desk — ยูทิลิตี้กลาง (classic script, ไม่ต้อง build) */
(function () {
  const H = (window.HR = window.HR || {});
  H.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  H.num = n => Number(n || 0).toLocaleString('th-TH');
  H.pad = n => String(n).padStart(2, '0');
  H.today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  H.iso = d => d.getFullYear() + '-' + H.pad(d.getMonth() + 1) + '-' + H.pad(d.getDate());
  H.d0 = s => new Date(String(s).slice(0, 10) + 'T00:00:00');
  H.fd = (s, o) => s ? H.d0(s).toLocaleDateString('th-TH', o || { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  H.days = s => Math.round((H.d0(s) - H.today()) / 864e5);
  H.ageOf = (b, ref) => { if (!b) return ''; const a = H.d0(b), r = ref ? H.d0(ref) : H.today(); let y = r.getFullYear() - a.getFullYear(); if (r.getMonth() < a.getMonth() || (r.getMonth() === a.getMonth() && r.getDate() < a.getDate())) y--; return y; };
  H.tenure = (s, ref) => { if (!s) return ''; const a = H.d0(s), r = ref ? H.d0(ref) : H.today(); let m = (r.getFullYear() - a.getFullYear()) * 12 + r.getMonth() - a.getMonth(); if (r.getDate() < a.getDate()) m--; if (m < 0) m = 0; const y = Math.floor(m / 12); return (y ? y + ' ปี ' : '') + (m % 12) + ' เดือน'; };
  H.TH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  H.pLabel = p => { const a = String(p).split('-'); return H.TH_M[+a[1] - 1] + ' ' + (+a[0] + 543); };
  H.pNum = p => { const a = String(p).split('-'); return a[1] + '/' + (+a[0] + 543); };
  H.rel = iso => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'เมื่อครู่นี้' : m < 60 ? m + ' นาทีที่แล้ว' : m < 1440 ? Math.floor(m / 60) + ' ชม. ที่แล้ว' : Math.floor(m / 1440) + ' วันที่แล้ว'; };
  H.normDate = s => { s = String(s || '').trim(); if (!s) return null; let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + H.pad(m[2]) + '-' + H.pad(m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) { let y = +m[3]; if (y > 2400) y -= 543; return y + '-' + H.pad(m[2]) + '-' + H.pad(m[1]); } return null; };
  H.normPeriod = s => { s = String(s || '').trim(); let m = s.match(/^(\d{4})-(\d{1,2})/); if (m) return m[1] + '-' + H.pad(m[2]) + '-01';
    m = s.match(/^(\d{1,2})\/(\d{4})$/); if (m) { let y = +m[2]; if (y > 2400) y -= 543; return y + '-' + H.pad(m[1]) + '-01'; }
    const ti = H.TH_M.findIndex(x => s.includes(x)); m = s.match(/(\d{4})/); if (ti >= 0 && m) { let y = +m[1]; if (y > 2400) y -= 543; return y + '-' + H.pad(ti + 1) + '-01'; } return null; };
  H.norm = s => String(s == null ? '' : s).replace(/\s+/g, '');
  H.parseCsv = t => { const rows = []; let r = [], c = '', q = false; t = String(t).replace(/^\ufeff/, '');
    for (let i = 0; i < t.length; i++) { const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); c = ''; if (r.some(x => x.trim())) rows.push(r); r = []; } else c += ch; }
    r.push(c); if (r.some(x => x.trim())) rows.push(r); return rows; };
  const qt = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  H.csv = rows => rows.map(r => r.map(qt).join(',')).join('\n');
  H.download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  H.readCsvFile = (file, cb) => { const rd = new FileReader(); rd.onload = () => cb(H.parseCsv(String(rd.result))); rd.readAsText(file, 'utf-8'); };
  // จับคู่หัวตาราง -> index (ไม่สนช่องว่าง) schema: [[key, header, ...]], alias: {key:[ชื่ออื่น]}
  H.colMap = (hd, schema, alias) => { const ix = {}; schema.forEach(f => { const names = [f[1]].concat((alias && alias[f[0]]) || []).map(H.norm); ix[f[0]] = hd.findIndex(x => names.includes(H.norm(x))); }); return ix; };
  H.conv = (v, kind) => { v = String(v == null ? '' : v).trim(); if (kind === 'date') return H.normDate(v); if (kind === 'num') return Number(v.replace(/,/g, '')) || 0; if (kind === 'period') return H.normPeriod(v); return v === '' ? null : v; };
  H.toast = (msg, bad) => { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.className = bad ? 'bad show' : 'show'; clearTimeout(H._tt); H._tt = setTimeout(() => { t.className = ''; }, 4200); };
  H.resizeImage = (file, size, cb) => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), m = Math.min(img.width, img.height); x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size); c.toBlob(b => cb(b), 'image/jpeg', 0.86); }; img.src = rd.result; }; rd.readAsDataURL(file); };
})();
