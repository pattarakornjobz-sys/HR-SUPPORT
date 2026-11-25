/* HR Desk · ลิงก์ระบบอื่นในชุด (ไฟล์นี้แยกจาก index.html อัปเดต index.html ครั้งต่อไป ลิงก์จะไม่หาย) */

/* ระบบเงินยืมทดรองจ่าย */
window.DESK_SUITE = Object.assign(window.DESK_SUITE || {}, {
  // ลิงก์เว็บแอประบบเงินยืม (Apps Script) — วางลิงก์ที่ลงท้ายด้วย /exec แทนข้อความในเครื่องหมายคำพูด
  ADVANCE_URL: "https://script.google.com/macros/s/AKfycbwBEd896VhoXl-DTRXiqFlzZIy2bDFSjIbUlqiuOwTOIOcL-rMEiMOwqJ-yTjVecj6XIA/exec",
  // หน่วยงานของผู้ใช้ HR Desk (ชื่อต้องตรงกับในระบบเงินยืม) · เว้นว่าง = ผู้ใช้เลือกหน่วยงานเองตอนเข้าครั้งแรก
  ADVANCE_DIV: ""
});
