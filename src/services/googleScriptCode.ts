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
  SUBJECTS: 'Subjects',
};

// ตรวจสอบและเติมหัวตารางที่ยังขาดอยู่ (เพื่อรองรับชีตเดิมที่มีอยู่แล้ว)
function ensureHeaders(sheet, requiredHeaders) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  requiredHeaders.forEach(function(h) {
    if (existingHeaders.indexOf(h) === -1) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(h)
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    }
  });
}

// สร้าง Map ชื่อคอลัมน์ -> ลำดับคอลัมน์ (1-indexed)
function getHeaderMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const map = {};
  if (lastCol === 0) return map;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    map[String(headers[i]).trim()] = i + 1;
  }
  return map;
}

// เริ่มต้นสร้างชีตอัตโนมัติหากยังไม่มี
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. ชีต Submissions (การส่งงาน)
  const subHeaders = [
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
    'ผู้ตรวจ',
    'ปีการศึกษา',
    'ภาคเรียน'
  ];
  let subSheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
  if (!subSheet) {
    subSheet = ss.insertSheet(SHEET_NAMES.SUBMISSIONS);
    subSheet.getRange(1, 1, 1, subHeaders.length).setValues([subHeaders]);
    subSheet.getRange(1, 1, 1, subHeaders.length)
      .setBackground('#4F46E5')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    subSheet.setFrozenRows(1);
  } else {
    ensureHeaders(subSheet, subHeaders);
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
      'chamaiporn',
      '1234',
      new Date().toLocaleString('th-TH')
    ]);
  }

  // 3. ชีต Assignments (ภาระงาน/ใบงาน)
  const assignHeaders = ['ID', 'ครูผู้สอน', 'รหัสวิชา', 'ชื่อวิชา', 'ชื่องาน', 'คะแนนเต็ม', 'ชนิดของงาน', 'ตัวอย่างใบงาน', 'วันที่สร้าง', 'ปีการศึกษา', 'ภาคเรียน', 'เกณฑ์การให้คะแนน'];
  let assignSheet = ss.getSheetByName(SHEET_NAMES.ASSIGNMENTS);
  if (!assignSheet) {
    assignSheet = ss.insertSheet(SHEET_NAMES.ASSIGNMENTS);
    assignSheet.getRange(1, 1, 1, assignHeaders.length).setValues([assignHeaders]);
    assignSheet.getRange(1, 1, 1, assignHeaders.length)
      .setBackground('#D97706')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    assignSheet.setFrozenRows(1);

    // ใส่ตัวอย่างงานเริ่มต้น
    assignSheet.appendRow([
      'A001',
      'ครูชมัยพร ถินสำราญ',
      'ว21103',
      'วิทยาการคำนวณ 1',
      'ใบงานที่ 1: การเขียนผังงาน Flowchart',
      10,
      'ผังงาน/อัลกอริทึม/Coding',
      'https://docs.google.com/presentation/d/sample',
      new Date().toLocaleString('th-TH'),
      '2569',
      '2',
      'ความถูกต้องของสัญลักษณ์ Flowchart (4 คะแนน), ลำดับตรรกะและการตัดสินใจ (4 คะแนน), ความคิดสร้างสรรค์และความเรียบร้อย (2 คะแนน)'
    ]);
  } else {
    ensureHeaders(assignSheet, assignHeaders);
  }

  // 4. ชีต Subjects (รายวิชาที่สอน)
  const subjectHeaders = ['ID', 'รหัสวิชา', 'ชื่อวิชา', 'ครูผู้สอน', 'ปีการศึกษา', 'ภาคเรียน', 'วันที่สร้าง'];
  let subjectSheet = ss.getSheetByName(SHEET_NAMES.SUBJECTS);
  if (!subjectSheet) {
    subjectSheet = ss.insertSheet(SHEET_NAMES.SUBJECTS);
    subjectSheet.getRange(1, 1, 1, subjectHeaders.length).setValues([subjectHeaders]);
    subjectSheet.getRange(1, 1, 1, subjectHeaders.length)
      .setBackground('#7C3AED')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    subjectSheet.setFrozenRows(1);
  } else {
    ensureHeaders(subjectSheet, subjectHeaders);
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
    const subjects = getSheetData(ss.getSheetByName(SHEET_NAMES.SUBJECTS));

    return responseJSON({
      status: 'success',
      data: {
        submissions: submissions,
        teachers: teachers,
        assignments: assignments,
        subjects: subjects,
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
      const headerMap = getHeaderMap(sheet);
      const data = body.data;
      const totalCols = sheet.getLastColumn();
      const newRow = new Array(totalCols).fill('');
      const setVal = function(colName, val) {
        if (headerMap[colName]) newRow[headerMap[colName] - 1] = val;
      };
      setVal('รหัสการส่ง (ID)', data.id || ('SUB-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd-HHmmss")));
      setVal('วันที่ส่งงาน', data.submittedAt || new Date().toLocaleString('th-TH'));
      setVal('ชื่อ-นามสกุล', data.studentName || '');
      setVal('เลขที่', data.studentNumber || '');
      setVal('ระดับชั้น', data.gradeLevel || '');
      setVal('ห้อง', data.room || '');
      setVal('ครูผู้สอน', data.teacherName || '');
      setVal('รหัสวิชา', data.subjectCode || '');
      setVal('ชื่อวิชา', data.subjectName || '');
      setVal('ชื่องาน', data.assignmentName || '');
      setVal('คะแนนเต็ม', data.maxScore || 10);
      setVal('ลิงก์ผลงาน', data.workUrl || '');
      setVal('คะแนนที่ได้', data.score !== undefined && data.score !== null ? data.score : '');
      setVal('สถานะ', data.status || 'รอตรวจ');
      setVal('คำแนะนำ/ข้อเสนอแนะ', data.feedback || '');
      setVal('วันที่ตรวจ', data.gradedAt || '');
      setVal('ผู้ตรวจ', data.gradedBy || '');
      setVal('ปีการศึกษา', data.academicYear || '');
      setVal('ภาคเรียน', data.semester || '');
      sheet.appendRow(newRow);
      return responseJSON({ status: 'success', message: 'บันทึกการส่งงานสำเร็จ' });
    }

    // 2. ให้คะแนนตรวจงาน
    if (action === 'gradeSubmission') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
      const rows = sheet.getDataRange().getValues();
      const headerMap = getHeaderMap(sheet);
      const id = body.id;
      const score = body.score;
      const feedback = body.feedback || '';
      const gradedBy = body.gradedBy || '';
      const gradedAt = new Date().toLocaleString('th-TH');

      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(id)) {
          sheet.getRange(i + 1, headerMap['คะแนนที่ได้'] || 13).setValue(score);
          sheet.getRange(i + 1, headerMap['สถานะ'] || 14).setValue('ตรวจแล้ว');
          sheet.getRange(i + 1, headerMap['คำแนะนำ/ข้อเสนอแนะ'] || 15).setValue(feedback);
          sheet.getRange(i + 1, headerMap['วันที่ตรวจ'] || 16).setValue(gradedAt);
          sheet.getRange(i + 1, headerMap['ผู้ตรวจ'] || 17).setValue(gradedBy);
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
      const headerMap = getHeaderMap(sheet);
      const totalCols = sheet.getLastColumn();
      const items = body.assignments || [body.assignment];
      items.forEach(function(a) {
        const newRow = new Array(totalCols).fill('');
        const setVal = function(colName, val) {
          if (headerMap[colName]) newRow[headerMap[colName] - 1] = val;
        };
        setVal('ID', a.id || ('A-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMddHHmmss")));
        setVal('ครูผู้สอน', a.teacherName || '');
        setVal('รหัสวิชา', a.subjectCode || '');
        setVal('ชื่อวิชา', a.subjectName || '');
        setVal('ชื่องาน', a.title || '');
        setVal('คะแนนเต็ม', a.maxScore || 10);
        setVal('ชนิดของงาน', a.workType || 'ใบงาน/แบบฝึกหัด');
        setVal('ตัวอย่างใบงาน', a.sampleUrl || '');
        setVal('วันที่สร้าง', a.createdAt || new Date().toLocaleString('th-TH'));
        setVal('ปีการศึกษา', a.academicYear || '');
        setVal('ภาคเรียน', a.semester || '');
        setVal('เกณฑ์การให้คะแนน', a.rubricCriteria || '');
        sheet.appendRow(newRow);
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

    // 5.1 แก้ไขข้อมูลงานและชื่อวิชา (ครูผู้สอน)
    if (action === 'updateAssignment') {
      const sheet = ss.getSheetByName(SHEET_NAMES.ASSIGNMENTS);
      const rows = sheet.getDataRange().getValues();
      const headerMap = getHeaderMap(sheet);
      const a = body.assignment;
      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(a.id)) {
          sheet.getRange(i + 1, headerMap['รหัสวิชา'] || 3).setValue(a.subjectCode);
          sheet.getRange(i + 1, headerMap['ชื่อวิชา'] || 4).setValue(a.subjectName);
          sheet.getRange(i + 1, headerMap['ชื่องาน'] || 5).setValue(a.title);
          sheet.getRange(i + 1, headerMap['คะแนนเต็ม'] || 6).setValue(a.maxScore);
          sheet.getRange(i + 1, headerMap['ชนิดของงาน'] || 7).setValue(a.workType || 'ใบงาน/แบบฝึกหัด');
          sheet.getRange(i + 1, headerMap['ตัวอย่างใบงาน'] || 8).setValue(a.sampleUrl || '');
          if (headerMap['ปีการศึกษา']) sheet.getRange(i + 1, headerMap['ปีการศึกษา']).setValue(a.academicYear || '');
          if (headerMap['ภาคเรียน']) sheet.getRange(i + 1, headerMap['ภาคเรียน']).setValue(a.semester || '');
          if (headerMap['เกณฑ์การให้คะแนน']) sheet.getRange(i + 1, headerMap['เกณฑ์การให้คะแนน']).setValue(a.rubricCriteria || '');
          found = true;
          break;
        }
      }
      return responseJSON({ 
        status: found ? 'success' : 'not_found', 
        message: found ? 'แก้ไขข้อมูลงานและวิชาสำเร็จ' : 'ไม่พบงานที่ต้องการแก้ไข' 
      });
    }

    // 5.2 จัดการรายวิชา (บันทึก/แก้ไข/ลบรายวิชา พร้อมปีการศึกษาและภาคเรียน)
    if (action === 'saveSubject') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBJECTS);
      const s = body.subject;
      sheet.appendRow([
        s.id || ('SUBJ-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMddHHmmss")),
        s.code || '',
        s.name || '',
        s.teacherName || '',
        s.academicYear || '',
        s.semester || '',
        s.createdAt || new Date().toLocaleString('th-TH')
      ]);
      return responseJSON({ status: 'success', message: 'บันทึกรายวิชาสำเร็จ' });
    }

    if (action === 'updateSubject') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBJECTS);
      const rows = sheet.getDataRange().getValues();
      const s = body.subject;
      const oldCode = String(body.oldCode || s.code || '').trim().toLowerCase();
      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][1] || '').trim().toLowerCase() === oldCode) {
          sheet.getRange(i + 1, 2).setValue(s.code);
          sheet.getRange(i + 1, 3).setValue(s.name);
          if (s.academicYear !== undefined) sheet.getRange(i + 1, 5).setValue(s.academicYear);
          if (s.semester !== undefined) sheet.getRange(i + 1, 6).setValue(s.semester);
          found = true;
          break;
        }
      }
      return responseJSON({ status: found ? 'success' : 'not_found', message: found ? 'แก้ไขรายวิชาสำเร็จ' : 'ไม่พบรายวิชา' });
    }

    if (action === 'deleteSubject') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBJECTS);
      const rows = sheet.getDataRange().getValues();
      const code = String(body.code || '').trim().toLowerCase();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][1] || '').trim().toLowerCase() === code) {
          sheet.deleteRow(i + 1);
        }
      }
      return responseJSON({ status: 'success', message: 'ลบรายวิชาสำเร็จ' });
    }

    // 6. ลบข้อมูลการส่งงานของนักเรียน (ลบงานเดี่ยว / งานส่งซ้ำ)
    if (action === 'deleteSubmission') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
      const rows = sheet.getDataRange().getValues();
      const id = body.id ? String(body.id).trim() : '';
      const studentName = body.studentName ? String(body.studentName).trim().toLowerCase() : '';
      const studentNumber = body.studentNumber ? String(body.studentNumber).trim() : '';
      const assignmentName = body.assignmentName ? String(body.assignmentName).trim().toLowerCase() : '';
      const workUrl = body.workUrl ? String(body.workUrl).trim() : '';

      let found = false;
      for (let i = 1; i < rows.length; i++) {
        const rowId = String(rows[i][0] || '').trim();
        const rowName = String(rows[i][2] || '').trim().toLowerCase();
        const rowNum = String(rows[i][3] || '').trim();
        const rowAssign = String(rows[i][9] || '').trim().toLowerCase();
        const rowUrl = String(rows[i][11] || '').trim();

        const matchId = id && rowId === id;
        const matchInfo = studentName && rowName.includes(studentName.replace(/^(ด\.ช\.|ด\.ญ\.|นาย|นางสาว|น\.ส\.)\s*/i, '')) &&
          (!studentNumber || rowNum === studentNumber) &&
          ((assignmentName && rowAssign === assignmentName) || (workUrl && rowUrl === workUrl));

        if (matchId || matchInfo) {
          sheet.deleteRow(i + 1);
          found = true;
          break;
        }
      }
      return responseJSON({ 
        status: found ? 'success' : 'not_found', 
        message: found ? 'ลบข้อมูลการส่งงานออกจากฐานข้อมูลสำเร็จ' : 'ไม่พบข้อมูลที่ต้องการลบใน Google Sheet' 
      });
    }

    // 6.1 ลบข้อมูลการส่งงานหลายรายการ / งานส่งซ้ำ
    if (action === 'deleteMultipleSubmissions') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
      const rows = sheet.getDataRange().getValues();
      const idList = Array.isArray(body.ids) ? body.ids.map(function(x) { return String(x).trim(); }) : [];
      var deleted = 0;
      // ลบจากแถวล่างขึ้นบนเพื่อป้องกัน index เลื่อน
      for (var i = rows.length - 1; i >= 1; i--) {
        var rowId = String(rows[i][0] || '').trim();
        if (idList.indexOf(rowId) !== -1) {
          sheet.deleteRow(i + 1);
          deleted++;
        }
      }
      return responseJSON({ status: 'success', message: 'ลบข้อมูลสำเร็จ ' + deleted + ' รายการ' });
    }

    // 6.2 แก้ไขข้อมูลการส่งงานและลิงก์ผลงานของนักเรียน (ครูผู้สอน)
    if (action === 'updateSubmissionStudent') {
      const sheet = ss.getSheetByName(SHEET_NAMES.SUBMISSIONS);
      const rows = sheet.getDataRange().getValues();
      const headerMap = getHeaderMap(sheet);
      const id = body.id ? String(body.id).trim() : '';

      let found = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0] || '').trim() === id) {
          const rowIdx = i + 1;
          if (body.studentName !== undefined) sheet.getRange(rowIdx, headerMap['ชื่อ-นามสกุล'] || 3).setValue(body.studentName);
          if (body.studentNumber !== undefined) sheet.getRange(rowIdx, headerMap['เลขที่'] || 4).setValue(body.studentNumber);
          if (body.gradeLevel !== undefined) sheet.getRange(rowIdx, headerMap['ระดับชั้น'] || 5).setValue(body.gradeLevel);
          if (body.room !== undefined) sheet.getRange(rowIdx, headerMap['ห้อง'] || 6).setValue(body.room);
          if (body.subjectCode !== undefined) sheet.getRange(rowIdx, headerMap['รหัสวิชา'] || 8).setValue(body.subjectCode);
          if (body.subjectName !== undefined) sheet.getRange(rowIdx, headerMap['ชื่อวิชา'] || 9).setValue(body.subjectName);
          if (body.assignmentName !== undefined) sheet.getRange(rowIdx, headerMap['ชื่องาน'] || 10).setValue(body.assignmentName);
          if (body.workUrl !== undefined) sheet.getRange(rowIdx, headerMap['ลิงก์ผลงาน'] || 12).setValue(body.workUrl);
          if (body.academicYear !== undefined && headerMap['ปีการศึกษา']) sheet.getRange(rowIdx, headerMap['ปีการศึกษา']).setValue(body.academicYear);
          if (body.semester !== undefined && headerMap['ภาคเรียน']) sheet.getRange(rowIdx, headerMap['ภาคเรียน']).setValue(body.semester);
          found = true;
          break;
        }
      }
      return responseJSON({
        status: found ? 'success' : 'not_found',
        message: found ? 'แก้ไขข้อมูลงานที่ส่งสำเร็จ' : 'ไม่พบข้อมูลที่ต้องการแก้ไขใน Google Sheet'
      });
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

    // 8. รีเซ็ต Username และ Password ครูผู้สอน (Admin)
    if (action === 'resetTeacherCredentials') {
      const sheet = ss.getSheetByName(SHEET_NAMES.TEACHERS);
      const rows = sheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(body.id) || rows[i][1] === body.fullName || rows[i][3] === body.oldUsername) {
          if (body.newUsername) sheet.getRange(i + 1, 4).setValue(body.newUsername);
          if (body.newPassword) sheet.getRange(i + 1, 5).setValue(body.newPassword);
          updated = true;
          break;
        }
      }
      return responseJSON({ 
        status: updated ? 'success' : 'not_found', 
        message: updated ? 'รีเซ็ตข้อมูลครูสำเร็จ' : 'ไม่พบข้อมูลครู' 
      });
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
