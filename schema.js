/* โครงสร้างข้อมูล / ค่าคงที่ — คีย์ = ชื่อคอลัมน์ใน Supabase */
(function () {
  const H = window.HR;
  // [คอลัมน์, หัวตารางไฟล์ฐานข้อมูลทะเบียน, กลุ่มในฟอร์ม, ชนิด]
  H.EF = [['employee_id', 'รหัสพนักงาน', 0], ['id_card', 'เลขบัตรประชาชน', 0], ['title', 'คำนำหน้า', 0], ['first_name', 'ชื่อ', 0], ['last_name', 'นามสกุล', 0], ['birth_date', 'วันเกิด', 0, 'date'], ['gender', 'เพศ', 0],
    ['emp_type', 'ประเภท', 1], ['org', 'หน่วยงาน', 1], ['section', 'แผนก', 1], ['position', 'ตำแหน่ง', 1], ['edu_hire', 'วุฒิที่ใช้บรรจุ', 1], ['edu_max', 'วุฒิสูงสุดปัจจุบัน', 1], ['major', 'สาขาวิชา', 1], ['school', 'สถาบันการศึกษา', 1],
    ['start_date', 'วันเริ่มงาน', 1, 'date'], ['contract_end', 'วันหมดสัญญา', 1, 'date'], ['base_salary', 'เงินเดือนฐาน', 1, 'num'], ['prof_allowance', 'ค่าวิชาชีพ', 1, 'num'], ['status', 'สถานะ', 1], ['exit_date', 'วันที่ออกจากงานจริง', 1, 'date'],
    ['addr_id', 'ที่อยู่ตามบัตรประชาชน/ทะเบียนบ้าน', 2], ['addr_now', 'ที่อยู่ปัจจุบัน', 2], ['phone', 'เบอร์โทร', 2], ['email', 'Email', 2],
    ['bank', 'ธนาคาร', 3], ['bank_no', 'เลขบัญชี', 3], ['ot_group', 'กลุ่ม OT', 3], ['ss_branch', 'รหัสสาขา SS', 3], ['ss_exempt', 'ยกเว้น SS', 3], ['scan_id', 'รหัสเครื่องสแกน', 3],
    ['blood', 'กรุ๊ปเลือด', 4], ['nationality', 'สัญชาติ', 4], ['ethnicity', 'เชื้อชาติ', 4], ['religion', 'ศาสนา', 4], ['disease', 'โรคประจำตัว', 4], ['marital', 'สถานภาพสมรส', 4],
    ['spouse_name', 'ชื่อคู่สมรส', 5], ['spouse_phone', 'เบอร์โทรคู่สมรส', 5], ['father_name', 'ชื่อบิดา', 5], ['father_phone', 'เบอร์โทรบิดา', 5], ['father_addr', 'ที่อยู่บิดา', 5], ['father_status', 'สถานภาพบิดา', 5],
    ['mother_name', 'ชื่อมารดา', 5], ['mother_phone', 'เบอร์โทรมารดา', 5], ['mother_addr', 'ที่อยู่มารดา', 5], ['mother_status', 'สถานภาพมารดา', 5],
    ['e1_name', 'ผู้ติดต่อฉุกเฉิน1 ชื่อ', 6], ['e1_phone', 'ผู้ติดต่อฉุกเฉิน1 เบอร์โทร', 6], ['e1_rel', 'ผู้ติดต่อฉุกเฉิน1 ความสัมพันธ์', 6], ['e2_name', 'ผู้ติดต่อฉุกเฉิน2 ชื่อ', 6], ['e2_phone', 'ผู้ติดต่อฉุกเฉิน2 เบอร์โทร', 6], ['e2_rel', 'ผู้ติดต่อฉุกเฉิน2 ความสัมพันธ์', 6]];
  H.ESEC = ['ข้อมูลส่วนตัว', 'การจ้างงาน', 'ที่อยู่และการติดต่อ', 'ธนาคาร / ประกันสังคม / เวลา', 'สัญชาติ ศาสนา สุขภาพ', 'ครอบครัว', 'ผู้ติดต่อฉุกเฉิน'];
  H.EF_ALIAS = { employee_id: ['รหัส'], prof_allowance: ['ค่าตอบแทน'], contract_end: ['สิ้นสุดสัญญา', 'ครบกำหนดสัญญา'], emp_type: ['ประเภทการจ้าง'], exit_date: ['วันที่พ้นสภาพ'] };
  H.ACT = ['ปฏิบัติงาน', 'ทำงาน', 'ปกติ', 'Active', 'active', ''];
  H.isAct = e => H.ACT.includes(String(e.status || '').trim());
  H.empName = e => ((e.first_name || '') + ' ' + (e.last_name || '')).trim();
  H.empFull = e => ((e.title || '') + H.empName(e)).trim();
  // เงินเดือน (คอลัมน์ = ชื่อใน hr_payroll)
  H.INC = [['base', 'เงินเดือนฐาน'], ['ot', 'ค่าล่วงเวลา'], ['prof', 'ค่าวิชาชีพ'], ['acad', 'ค่าบริการวิชาการ'], ['commission', 'ค่าคอมมิชชั่น'], ['backpay', 'ตกเบิกเงินเดือน'], ['inc2', 'รายได้อื่นๆ 2'], ['inc3', 'รายได้อื่นๆ 3'], ['comp', 'ค่าตอบแทน'], ['leave_refund', 'คืนเงินวันลา']];
  H.DED = [['tax', 'ค่าภาษี'], ['ss', 'ประกันสังคม'], ['loan', 'เงินกู้ยืม(ง)'], ['sl', 'เงินกู้ยืม กยศ.'], ['leave_ded', 'หักวันลา'], ['ded2', 'รายจ่ายอื่นๆ 2'], ['ded3', 'รายจ่ายอื่นๆ 3'], ['ded4', 'รายจ่ายอื่นๆ 4'], ['ded5', 'รายจ่ายอื่นๆ 5']];
  H.PF = [['employee_id', 'รหัสพนักงาน'], ['period', 'ประจำงวด', 'period'], ['title', 'คำนำหน้า'], ['first_name', 'ชื่อ'], ['last_name', 'นามสกุล'], ['ss_branch', 'สาขา(สปส)'], ['tax_id', 'เลขประจำตัวผู้เสียภาษี'], ['org', 'สังกัด'], ['bank_no', 'เลขบัญชีเงินฝาก'],
    ...H.INC.map(x => [x[0], x[1], 'num']), ...H.DED.map(x => [x[0], x[1], 'num'])];
  H.PF_ALIAS = { employee_id: ['รหัส'], tax: ['ภาษี'] };
  const sum = (r, a) => a.reduce((s, x) => s + (Number(r[x[0]]) || 0), 0);
  H.incT = r => sum(r, H.INC); H.dedT = r => sum(r, H.DED);
  H.PCAT = [['sal', 'เงินเดือน/ค่าตอบแทน', 'rose'], ['pen', 'เงินบำเหน็จ', 'plum'], ['pch', 'พ.ช.ค./เงินเพิ่ม', 'gold'], ['bon', 'เงินรางวัล/เงินพิเศษ', 'sage'], ['rem', 'นำส่ง ปกส./กยศ.', 'sky'], ['wel', 'สวัสดิการ/ค่าจัดการศพ', 'teal']];
  H.MV = { 'เข้าใหม่': 'sage', 'ลาออก': 'sky', 'เกษียณอายุ': 'plum', 'เสียชีวิต': 'gray', 'เลิกจ้าง': 'rose' };
  H.TONE = { rose: { m: '#c65d82', t: '#fbe6ee', d: '#8a3357' }, plum: { m: '#8a5aa8', t: '#f0e6f5', d: '#5e3a78' }, gold: { m: '#b07f25', t: '#fbf1dc', d: '#7a560f' }, teal: { m: '#3f8f94', t: '#e0f1f1', d: '#245f63' }, sky: { m: '#4b7fa6', t: '#e6eef5', d: '#2f5c80' }, sage: { m: '#5c8a6d', t: '#e7f2ea', d: '#2b5640' }, gray: { m: '#7a6570', t: '#f1e8ed', d: '#4a3a43' } };
  H.OT = { ney: 'rose', jom: 'plum', bb: 'gold', pan: 'teal', all: 'gray', head: 'rose' };
  H.OWN = { ney: 'เนย', jom: 'จ๋อม', bb: 'บีบี', pan: 'ปันปัน', all: 'ร่วมกัน' };
  H.TYPES = [['pay', 'เงินเดือน/ค่าตอบแทน', ['จ่ายเงิน', 'เงินเพิ่ม', 'เงินพิเศษ'], 'rose'], ['gov', 'ภาษี/ยื่นหน่วยงานรัฐ', ['ภาษี', 'ยื่นหน่วยงานรัฐ'], 'sky'], ['hire', 'สรรหา/จัดจ้าง/คำสั่ง', ['สรรหา', 'จัดจ้าง', 'คำสั่ง', 'อัตรากำลัง', 'ระเบียบ'], 'plum'], ['doc', 'สัญญา/หนังสือรับรอง', ['เอกสารรับรอง', 'สัญญา', 'พ้นสภาพ'], 'gold'], ['wel', 'สวัสดิการ/ประกัน', ['สวัสดิการ', 'สุขภาพ', 'ประกัน'], 'teal'], ['bud', 'งบประมาณ', ['งบประมาณ'], 'sage'], ['mtg', 'ประชุม', ['ประชุม'], 'gray']];
  H.typeOf = c => (H.TYPES.find(t => t[2].includes(c)) || [])[0];
  H.ST = { todo: ['ต้องทำ', '#fbf1dc', '#8a6516', '#c99a3f'], doing: ['กำลังทำ', '#e6eef5', '#2f5c80', '#4b7fa6'], done: ['เสร็จแล้ว', '#e7f2ea', '#2b5640', '#5c8a6d'] };
  H.NEXT = { todo: 'doing', doing: 'done', done: 'todo' };
  // ใบแสดงเจตนา
  H.benTot = rows => Math.round(rows.reduce((s, r) => s + (Number(r.pct) || 0), 0) * 100) / 100;
  H.benUsed = rows => rows.filter(r => String(r.name || '').trim() || Number(r.pct));
  H.benState = rows => { const u = H.benUsed(rows); if (!u.length) return 'none'; return !u.some(r => !String(r.name || '').trim() || !(Number(r.pct) > 0)) && H.benTot(rows) === 100 ? 'ok' : 'bad'; };
  H.emptyB = () => Array.from({ length: 10 }, () => ({ name: '', address: '', phone: '', pct: '' }));
  H.padB = a => { const r = H.emptyB(); (a || []).slice(0, 10).forEach((x, i) => { r[i] = { name: x.name || '', address: x.address || '', phone: x.phone || '', pct: x.pct == null ? '' : x.pct }; }); return r; };
})();
