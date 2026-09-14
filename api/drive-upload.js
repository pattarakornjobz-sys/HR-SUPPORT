// ============================================================
// POST /api/drive-upload  (multipart/form-data, field name "file")
// อัปโหลดไฟล์เข้าโฟลเดอร์ Google Drive กลางของแผนก ผ่าน Service Account
// ============================================================
const formidable = require('formidable');
const fs = require('fs');
const { getAuthedStaff, driveClient, folderId, supabaseAdmin } = require('./_lib');

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

  const authed = await getAuthedStaff(req);
  if (!authed) { res.status(401).send('กรุณาเข้าสู่ระบบใหม่'); return; }

  try {
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 }); // 25MB ต่อไฟล์
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
    });

    const uploaded = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploaded) { res.status(400).send('ไม่พบไฟล์ที่อัปโหลด'); return; }

    const drive = driveClient();
    const fid = folderId();

    const driveRes = await drive.files.create({
      requestBody: {
        name: uploaded.originalFilename || uploaded.newFilename,
        parents: [fid],
      },
      media: {
        mimeType: uploaded.mimetype || 'application/octet-stream',
        body: fs.createReadStream(uploaded.filepath),
      },
      fields: 'id,name,mimeType,size,webViewLink,modifiedTime',
      supportsAllDrives: true,
    });

    // เก็บ log ผู้อัปโหลดไว้ในตาราง drive_files (bypass RLS ด้วย service role)
    const admin = supabaseAdmin();
    await admin.from('drive_files').insert({
      drive_file_id: driveRes.data.id,
      file_name: driveRes.data.name,
      mime_type: driveRes.data.mimeType,
      size_bytes: Number(driveRes.data.size || uploaded.size || 0),
      web_view_link: driveRes.data.webViewLink,
      uploaded_by: authed.staff?.id || null,
    });

    res.status(200).json({ ok: true, file: driveRes.data });
  } catch (err) {
    res.status(500).send(err.message || 'อัปโหลดไฟล์ไม่สำเร็จ');
  }
};
