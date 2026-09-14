// ============================================================
// ฟังก์ชันช่วยใช้ร่วมกันระหว่าง serverless functions
// ============================================================
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// Supabase client ฝั่งเซิร์ฟเวอร์ ใช้ service_role key (ข้าม RLS ได้ — ห้ามส่งให้ browser)
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ตรวจ Authorization: Bearer <access_token> ที่ส่งมาจากหน้าเว็บ แล้วคืนข้อมูลผู้ใช้ + แถว staff
async function getAuthedStaff(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return null;

  const { data: staff } = await admin.from('staff').select('*').eq('auth_uid', userData.user.id).maybeSingle();
  return { user: userData.user, staff };
}

// ไคลเอนต์ Google Drive จาก Service Account (ตั้งค่าใน Vercel env vars)
function driveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  if (!email || !privateKey) {
    throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ใน Vercel env vars');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

function folderId() {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_DRIVE_FOLDER_ID ใน Vercel env vars');
  return id;
}

module.exports = { supabaseAdmin, getAuthedStaff, driveClient, folderId };
