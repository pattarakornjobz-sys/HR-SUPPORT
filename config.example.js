// คัดลอกไฟล์นี้เป็น config.js แล้วใส่ค่าจาก Supabase → Project Settings → API
// ใช้ "anon public" key เท่านั้น (ห้ามใส่ service_role เด็ดขาด — ไฟล์นี้ถูกโหลดในเบราว์เซอร์ของทุกคน)
// ความปลอดภัยของข้อมูลมาจาก Row Level Security ใน sql/schema.sql
window.HR_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
};
