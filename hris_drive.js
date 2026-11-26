/* =====================================================================
 * hris_drive.js — เรียก HRIS File Gateway (ไฟล์สแกนใน Google Drive ของมูลนิธิ)
 *
 * ตั้งค่าครั้งเดียว: วางลิงก์ Web app ของ Apps Script "HRIS File Gateway" (ลงท้ายด้วย /exec)
 *
 * ใช้ในหน้า HRIS (หลังสร้าง supabase client ชื่อ sb):
 *   const r = await HRISDrive.upload(sb, file, { kind: 'contract_scan', id_card, meta: {...}, replace_file_id });
 *   await HRISDrive.open(sb, fileId, { id_card });            // เปิดไฟล์ในแท็บใหม่
 *   await HRISDrive.relocate(sb, folderId, 'ลาออก', id_card); // ย้ายแฟ้มเมื่อพ้นสภาพ
 *   const blob = await HRISDrive.fetchBlob(sb, fileId, id_card); // ดึงไฟล์เป็น Blob (รูปเจ้าหน้าที่)
 * ===================================================================== */
window.HRIS_DRIVE_URL = window.HRIS_DRIVE_URL || 'วางลิงก์ Web app /exec ที่นี่';

window.HRISDrive = (function () {
  const MAX_MB = 25;

  async function token(sb) {
    const { data } = await sb.auth.getSession();
    const t = data && data.session && data.session.access_token;
    if (!t) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    return t;
  }

  async function call(sb, body) {
    const url = window.HRIS_DRIVE_URL;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
      throw new Error('ยังไม่ได้ตั้งค่าลิงก์ HRIS File Gateway ในไฟล์ hris_drive.js');
    }
    body.token = await token(sb);
    // text/plain = ไม่ต้องทำ CORS preflight (Apps Script ไม่รองรับ OPTIONS)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('เชื่อมต่อประตูไฟล์ไม่ได้ (' + res.status + ')');
    const out = await res.json();
    if (!out.ok) throw new Error(out.error === 'NEED_LOGIN' ? 'กรุณาเข้าสู่ระบบใหม่' : out.error);
    return out;
  }

  function toB64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
      r.readAsDataURL(file);
    });
  }

  function fromB64(b64, mime) {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'application/octet-stream' });
  }

  /** kind: 'contract_scan' (PDF) | 'photo' (JPG/PNG/WEBP) | 'ben_tw' | 'ben_mf' (PDF)
   *  คืนค่า { file_id, file_name, file_size, folder_id } — หน้าเว็บนำไปบันทึกในตารางเอง */
  async function upload(sb, file, opts) {
    if (!file) throw new Error('กรุณาเลือกไฟล์');
    if (file.size > MAX_MB * 1048576) throw new Error('ไฟล์ใหญ่เกิน ' + MAX_MB + ' MB');
    const o = opts || {};
    return call(sb, {
      action: 'upload', kind: o.kind, id_card: o.id_card, meta: o.meta || {},
      replace_file_id: o.replace_file_id || null,
      file_name: file.name, mime: file.type || 'application/octet-stream', b64: await toB64(file)
    });
  }

  /** เปิดไฟล์ในแท็บใหม่ (download:true = ดาวน์โหลดแทน) */
  async function open(sb, fileId, opts) {
    const o = opts || {};
    const win = o.download ? null : window.open('', '_blank');   // เปิดแท็บก่อน กันเบราว์เซอร์บล็อก popup
    if (win) win.document.write('<p style="font-family:sans-serif;padding:24px">กำลังเปิดไฟล์...</p>');
    try {
      const r = await call(sb, { action: 'get', file_id: fileId, id_card: o.id_card || null });
      const url = URL.createObjectURL(fromB64(r.b64, r.mime));
      if (win) { win.location.href = url; }
      else {
        const a = document.createElement('a');
        a.href = url; a.download = r.file_name || 'file';
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return r.file_name;
    } catch (e) {
      if (win) win.close();
      throw e;
    }
  }

  /** ดึงไฟล์มาเป็น Blob (ใช้คัดลอกรูปเจ้าหน้าที่จากคลังสัญญามาเก็บใน HRIS) */
  async function fetchBlob(sb, fileId, idCard) {
    const r = await call(sb, { action: 'get', file_id: fileId, id_card: idCard || null });
    return fromB64(r.b64, r.mime);
  }

  /** ตั้งค่าลิงก์ประตูไฟล์แล้วหรือยัง */
  function ready() { return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(window.HRIS_DRIVE_URL || ''); }

  async function relocate(sb, folderId, empStatus, idCard) {
    return call(sb, { action: 'relocate', folder_id: folderId, emp_status: empStatus || '', id_card: idCard || null });
  }

  async function ping(sb) { return call(sb, { action: 'ping' }); }

  return { upload, open, fetchBlob, relocate, ping, ready };
})();
