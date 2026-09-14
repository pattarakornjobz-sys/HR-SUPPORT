// ============================================================
// GET /api/drive-list
// คืนรายการไฟล์ในโฟลเดอร์ Google Drive กลางของแผนก
// ============================================================
const { getAuthedStaff, driveClient, folderId, supabaseAdmin } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).send('Method not allowed'); return; }

  const authed = await getAuthedStaff(req);
  if (!authed) { res.status(401).send('กรุณาเข้าสู่ระบบใหม่'); return; }
  if (!authed.staff) { res.status(403).send('บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งาน'); return; }

  try {
    const drive = driveClient();
    const fid = folderId();

    const { data } = await drive.files.list({
      q: `'${fid}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,webViewLink,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    // จับคู่ผู้อัปโหลดจากตาราง drive_files (เขียนไว้ตอน upload)
    const admin = supabaseAdmin();
    const ids = (data.files || []).map(f => f.id);
    let uploaderMap = {};
    if (ids.length) {
      const { data: rows } = await admin
        .from('drive_files')
        .select('drive_file_id, uploaded_by, staff:uploaded_by(nickname)')
        .in('drive_file_id', ids);
      (rows || []).forEach(r => { uploaderMap[r.drive_file_id] = r.staff?.nickname; });
    }

    const files = (data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size || 0),
      webViewLink: f.webViewLink,
      modifiedTime: f.modifiedTime,
      uploadedByNickname: uploaderMap[f.id] || null,
    }));

    res.status(200).json({
      files,
      folderUrl: `https://drive.google.com/drive/folders/${fid}`,
    });
  } catch (err) {
    res.status(500).send(err.message || 'เกิดข้อผิดพลาดขณะดึงรายการไฟล์จาก Google Drive');
  }
};
