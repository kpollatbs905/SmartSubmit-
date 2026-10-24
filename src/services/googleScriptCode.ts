/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * ระบบตรวจงานให้คะแนน ออนไลน์ - โรงเรียนท่าบ่อ
 * Google Apps Script Web App Backend
 * พัฒนาโดย ครูชมัยพร ถินสำราญ โรงเรียนท่าบ่อ  สพม.หนองคาย ติดตามเพจ AI กับครูพอลล่า
 * ==============================================================================
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheet ที่ต้องการเก็บข้อมูล
 * 2. ไปที่เมนู ส่วนขยาย (Extensions) > Apps Script
 * 3. ลบโค้ดเดิมออกทั้งหมด แล้ววางโค้ดชุดนี้ลงไป
 * 4. กดบันทึก (Save)
 * 5. กดปุ่ม 'Deploy' (การทำให้ใช้งานได้) > 'New deployment' (การทำให้ใช้งานได้ใหม่)
 * 6. เลือกประเภท: 'Web app' (เว็บแอป)
 * 7. ตั้งค่า Execute as: 'Me' (ฉัน)
 * 8. ตั้งค่า Who has access: 'Anyone' (ทุกคน) **สำคัญมาก เพื่อให้ส่งข้อมูลได้โดยไม่ต้องล็อกอิน Google
 * 9. กด Deploy แล้วคัดลอก Web App URL ไปใส่ในระบบตั้งค่าของเว็บ
 * ==============================================================================
 */

const SHEET_NAMES = {
  SUBMISSIONS: 'Submissions',
  TEACHERS: 'Teachers',
  ASSIGNMENTS: 'Assignments',
};

// เริ่มต้นสร้างชีตอัตโนมัติหากยังไม่มี
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ชีต Submissions (การส่งงาน)
  let subSheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
  if (!subSheet) {
    subSheet = ss.insertSheet(SHEET_NAMES.SUBMISSIONS);
    const headers = [
      'รหัสการส่ง (ID)',
      'วันที่ส่งงาน',
      'ชื่อ-นามสกุล',
      'เลขที่',
      'ระดับชั้น',
      'ห้อง',
      'ครูผู้สอน',
      'รหัสวิชา',
      'ชื่อวิชา',
      'ชื่องาน',
      'คะแนนเต็ม',
      'ลิงก์ผลงาน',
      'คะแนนที่ได้',
      'สถานะ',
      'คำแนะนำ/ข้อเสนอแนะ',
      'วันที่ตรวจ',
      'ผู้ตรวจ'
    ];
    subSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    subSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4F46E5')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    subSheet.setFrozenRows(1);
  }

  // 2. ชีต Teachers (ครูผู้สอน)
  let teacherSheet = ss.getSheetByName(SHEET_NAMES.TEACHERS);
  if (!teacherSheet) {
    teacherSheet = ss.insertSheet(SHEET_NAMES.TEACHERS);
    const headers = ['ID', 'ชื่อ-สกุล', 'กลุ่มสาระ', 'Username', 'Password', 'วันที่สมัคร'];
    teacherSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    teacherSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#059669')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    teacherSheet.setFrozenRows(1);
    
    // ใส่ครูเริ่มต้น
    teacherSheet.appendRow([
      'T001',
      'ครูชมัยพร ถิ่นสำราญ',
      'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
      'teacher',
      '1234',
      new Date().toLocaleString('th-TH')
    ]);
  }

  // 3. ชีต Assignments (ภาระงาน/ใบงาน)
  let assignSheet = ss.getSheetByName(SHEET_NAMES.ASSIGNMENTS);
  if (!assignSheet) {
    assignSheet = ss.insertSheet(SHEET_NAMES.ASSIGNMENTS);
    const headers = ['ID', 'ครูผู้สอน', 'รหัสวิชา', 'ชื่อวิชา', 'ชื่องาน', 'คะแนนเต็ม', 'วันที่สร้าง'];
    assignSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    assignSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#D97706')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    assignSheet.setFrozenRows(1);

    // ใส่ตัวอย่างงานเริ่มต้น
    assignSheet.appendRow([
      'A001',
      'ครูชมัยพร ถิ่นสำราญ',
      'ว21103',
      'วิทยาการคำนวณ 1',
      'ใบงานที่ 1: การเขียนผังงาน Flowchart',
      10,
      new Date().toLocaleString('th-TH')
    ]);
  }
}

// ตอบรับ GET Request (ดึงข้อมูล)
function doGet(e) {
  try {
    initSheets();
    const action = (e && e.parameter && e.parameter.action) || 'getAll';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return responseJSON({ status: 'success', message: 'เชื่อมต่อ Google Apps Script สำเร็จ!' });
    }

    const submissions = getSheetData(ss.getSheetByName(SHEET_NAMES.SUBMISSIONS));
    const teachers = getSheetData(ss.getSheetByName(SHEET_NAMES.TEACHERS));
    const assignments = getSheetData(ss.getSheetByName(SHEET_NAMES.ASSIGNMENTS));

    return responseJSON({
      status: 'success',
      data: {
        submissions: submissions,
        teachers: teachers,
        assignments: assignments,
        sheetTitle: ss.getName(),
        sheetId: ss.getId()
      }
    });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

// ตอบรับ POST Request (บันทึกข้อมูล/แก้ไขข้อมูล)
function doPost(e) {
  try {
    initSheets();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.parameter || {};
    }

    const action = body.action;

    // 1. ส่งงานใหม่
    if (action === 'submitWork') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
      const data = body.data;
      sheet.appendRow([
        data.id || ('SUB-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd-HHmmss")),
        data.submittedAt || new Date().toLocaleString('th-TH'),
        data.studentName,
        data.studentNumber,
        data.gradeLevel,
        data.room,
        data.teacherName,
        data.subjectCode,
        data.subjectName,
        data.assignmentName,
        data.maxScore || 10,
        data.workUrl,
        data.score !== undefined && data.score !== null ? data.score : '',
        data.status || 'รอตรวจ',
        data.feedback || '',
        data.gradedAt || '',
        data.gradedBy || ''
      ]);
      return responseJSON({ status: 'success', message: 'บันทึกการส่งงานสำเร็จ' });
    }

    // 2. ให้คะแนนตรวจงาน
    if (action === 'gradeSubmission') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
      const rows = sheet.getDataRange().getValues();
      const id = body.id;
      const score = body.score;
      const feedback = body.feedback || '';
      const gradedBy = body.gradedBy || '';
      const gradedAt = new Date().toLocaleString('th-TH');

      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(id)) {
          sheet.getRange(i + 1, 13).setValue(score); // คะแนนที่ได้
          sheet.getRange(i + 1, 14).setValue('ตรวจแล้ว'); // สถานะ
          sheet.getRange(i + 1, 15).setValue(feedback); // คำแนะนำ
          sheet.getRange(i + 1, 16).setValue(gradedAt); // วันที่ตรวจ
          sheet.getRange(i + 1, 17).setValue(gradedBy); // ผู้ตรวจ
          found = true;
          break;
        }
      }
      return responseJSON({ 
        status: found ? 'success' : 'not_found', 
        message: found ? 'บันทึกคะแนนเรียบร้อยแล้ว' : 'ไม่พบรหัสการส่งงานนี้' 
      });
    }

    // 3. ลงทะเบียนครู
    if (action === 'registerTeacher') {
      const sheet = ss.getSheetByName(SHEET_NAMES.TEACHERS);
      const t = body.teacher;
      sheet.appendRow([
        t.id || ('T-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMddHHmmss")),
        t.fullName,
        t.department,
        t.username,
        t.password,
        new Date().toLocaleString('th-TH')
      ]);
      return responseJSON({ status: 'success', message: 'ลงทะเบียนครูผู้สอนสำเร็จ' });
    }

    // 4. บันทึกงานใหม่โดยครู
    if (action === 'saveAssignment') {
      const sheet = ss.getSheetByName(SHEET_NAMES.ASSIGNMENTS);
      const items = body.assignments || [body.assignment];
      items.forEach(function(a) {
        sheet.appendRow([
          a.id || ('A-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMddHHmmss")),
          a.teacherName,
          a.subjectCode,
          a.subjectName,
          a.title,
          a.maxScore,
          new Date().toLocaleString('th-TH')
        ]);
      });
      return responseJSON({ status: 'success', message: 'บันทึกข้อมูลงานสำเร็จ' });
    }

    // 5. ลบงาน
    if (action === 'deleteAssignment') {
      const sheet = ss.getSheetByName(SHEET_NAMES.ASSIGNMENTS);
      const rows = sheet.getDataRange().getValues();
      const id = body.id;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return responseJSON({ status: 'success', message: 'ลบงานสำเร็จ' });
    }

    // 6. ลบข้อมูลการส่งงานของนักเรียน (Admin)
    if (action === 'deleteSubmission') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
      const rows = sheet.getDataRange().getValues();
      const id = body.id;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return responseJSON({ status: 'success', message: 'ลบข้อมูลการส่งงานสำเร็จ' });
    }

    // 7. ลบข้อมูลครูผู้สอน (Admin)
    if (action === 'deleteTeacher') {
      const sheet = ss.getSheetByName(SHEET_NAMES.TEACHERS);
      const rows = sheet.getDataRange().getValues();
      const id = body.id;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return responseJSON({ status: 'success', message: 'ลบข้อมูลครูสำเร็จ' });
    }

    return responseJSON({ status: 'error', message: 'Action ไม่ถูกต้อง' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

// ฟังก์ชันแปลงแถวในชีตเป็น Array of Objects
function getSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.join('').trim() === '') continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    data.push(obj);
  }
  return data;
}

// สร้าง JSON Response มี CORS
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
