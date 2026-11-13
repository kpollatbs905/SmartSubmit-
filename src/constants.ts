/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Submission, Teacher, Assignment, Subject, GoogleSheetConfig } from './types';

export const ADMIN_CONFIG = {
  username: 'admin',
  password: 'polla905',
};

export const FOOTER_CREDIT = 'พัฒนาโดย ครูชมัยพร ถินสำราญ โรงเรียนท่าบ่อ  สพม.หนองคาย ติดตามเพจ AI กับครูพอลล่า';

export const FOOTER_CREDIT_LINES = [
  'พัฒนาโดย ครูชมัยพร ถินสำราญ',
  'โรงเรียนท่าบ่อ  สพม.หนองคาย',
  'ติดตามเพจ AI กับครูพอลล่า',
];

export const DEFAULT_SHEET_CONFIG: GoogleSheetConfig = {
  sheetId: '15IU9xIXFHbzmMcnOMWPZwSWlWlryRxpPimYCCCNUijc',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwm-h0MP5FZXXR7dZpuIh20Is-YVitB9OvgUJDt90nI_xI9qn1a9UvDM06MoXyDNwa5/exec',
  autoSync: true,
};

export const GRADE_LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'] as const;

export const ROOMS = Array.from({ length: 14 }, (_, i) => String(i + 1));

export const ACADEMIC_YEARS = ['2567', '2568', '2569'];

export const SEMESTERS = [
  { value: '1', label: 'ภาคเรียนที่ 1' },
  { value: '2', label: 'ภาคเรียนที่ 2' },
];

export const DEPARTMENTS = [
  'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
  'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
  'กลุ่มสาระการเรียนรู้ภาษาไทย',
  'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ',
  'กลุ่มสาระการเรียนรู้สังคมศึกษา ศาสนา และวัฒนธรรม',
  'กลุ่มสาระการเรียนรู้ศิลปะ',
  'กลุ่มสาระการเรียนรู้สุขศึกษาและพลศึกษา',
  'กลุ่มสาระการเรียนรู้การงานอาชีพ',
  'กิจกรรมพัฒนาผู้เรียน / แนะแนว',
];

export const WORK_TYPES = [
  { value: 'ใบงาน/แบบฝึกหัด', label: '📝 ใบงาน / แบบฝึกหัด (Worksheet)', icon: '📝' },
  { value: 'ชิ้นงานกราฟิก/Canva/โปสเตอร์', label: '🎨 ชิ้นงานกราฟิก / Canva / โปสเตอร์', icon: '🎨' },
  { value: 'ผังงาน/อัลกอริทึม/Coding', label: '💻 ผังงาน Flowchart / โค้ดดิ้ง / Scratch', icon: '💻' },
  { value: 'วิดีโอคลิป/การนำเสนอ', label: '🎬 วิดีโอคลิป / การนำเสนอ (Video/Presentation)', icon: '🎬' },
  { value: 'โครงงาน/รายงาน/เอกสาร', label: '📑 โครงงาน / รายงาน / สรุปองค์ความรู้', icon: '📑' },
  { value: 'เรียงความ/บทความ/ข้อเขียน', label: '✍️ เรียงความ / ข้อเขียน / ถอดบทเรียน', icon: '✍️' },
  { value: 'อื่นๆ', label: '📌 อื่นๆ / ผลงานทั่วไป', icon: '📌' },
];

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 'T001',
    fullName: 'ครูชมัยพร ถินสำราญ',
    department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    username: 'chamaiporn',
    password: '1234',
    createdAt: '2024-05-01 08:30:00',
  },
  {
    id: 'T002',
    fullName: 'ครูสมศักดิ์ รักการสอน',
    department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
    username: 'somsak',
    password: '1234',
    createdAt: '2024-05-02 09:15:00',
  },
  {
    id: 'T003',
    fullName: 'ครูปรียานุช สอนดี',
    department: 'กลุ่มสาระการเรียนรู้ภาษาไทย',
    username: 'preeya',
    password: '1234',
    createdAt: '2024-05-03 10:00:00',
  },
];

export const INITIAL_SUBJECTS: Subject[] = [
  { id: 'SUBJ-001', code: 'ว21103', name: 'วิทยาการคำนวณ 1', teacherName: 'ครูชมัยพร ถินสำราญ', academicYear: '2568', semester: '1' },
  { id: 'SUBJ-002', code: 'ว22103', name: 'การออกแบบและเทคโนโลยี 2', teacherName: 'ครูชมัยพร ถินสำราญ', academicYear: '2568', semester: '1' },
  { id: 'SUBJ-003', code: 'ค21101', name: 'คณิตศาสตร์พื้นฐาน 1', teacherName: 'ครูสมศักดิ์ รักการสอน', academicYear: '2568', semester: '1' },
  { id: 'SUBJ-004', code: 'ท21101', name: 'ภาษาไทยพื้นฐาน 1', teacherName: 'ครูปรียานุช สอนดี', academicYear: '2568', semester: '1' },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'A001',
    teacherName: 'ครูชมัยพร ถินสำราญ',
    subjectCode: 'ว21103',
    subjectName: 'วิทยาการคำนวณ 1',
    title: 'ใบงานที่ 1: การเขียนผังงาน Flowchart แก้ปัญหาชีวิตประจำวัน',
    maxScore: 10,
    workType: 'ผังงาน/อัลกอริทึม/Coding',
    sampleUrl: 'https://docs.google.com/presentation/d/1_example_flowchart_worksheet/preview',
    rubricCriteria: 'ความถูกต้องของสัญลักษณ์ Flowchart (4 คะแนน), ลำดับตรรกะและการตัดสินใจ (4 คะแนน), ความคิดสร้างสรรค์และความเรียบร้อย (2 คะแนน)',
    academicYear: '2568',
    semester: '1',
    createdAt: '2024-05-10 08:30:00',
  },
  {
    id: 'A002',
    teacherName: 'ครูชมัยพร ถินสำราญ',
    subjectCode: 'ว21103',
    subjectName: 'วิทยาการคำนวณ 1',
    title: 'ใบงานที่ 2: การออกแบบอัลกอริทึมด้วย Scratch',
    maxScore: 20,
    workType: 'ผังงาน/อัลกอริทึม/Coding',
    sampleUrl: 'https://scratch.mit.edu/projects/sample_animation_guide',
    rubricCriteria: 'ความสมบูรณ์ของโค้ดบล็อก Scratch (8 คะแนน), การโต้ตอบและการทำงานไม่ค้าง (6 คะแนน), ความคิดสร้างสรรค์และเสียงประกอบ (6 คะแนน)',
    academicYear: '2568',
    semester: '1',
    createdAt: '2024-05-15 09:00:00',
  },
  {
    id: 'A003',
    teacherName: 'ครูสมศักดิ์ รักการสอน',
    subjectCode: 'ค21101',
    subjectName: 'คณิตศาสตร์พื้นฐาน 1',
    title: 'แบบฝึกหัดที่ 3: การบวกและลบจำนวนเต็ม',
    maxScore: 15,
    workType: 'ใบงาน/แบบฝึกหัด',
    sampleUrl: 'https://drive.google.com/file/d/sample_math_exercise/view',
    rubricCriteria: 'แสดงวิธีทำถูกต้องตามขั้นตอน (10 คะแนน), คำตอบสุดท้ายถูกต้องและเขียนลายมือเรียบร้อย (5 คะแนน)',
    academicYear: '2568',
    semester: '1',
    createdAt: '2024-05-18 10:20:00',
  },
  {
    id: 'A004',
    teacherName: 'ครูปรียานุช สอนดี',
    subjectCode: 'ท21101',
    subjectName: 'ภาษาไทยพื้นฐาน 1',
    title: 'ชิ้นงานที่ 1: การเขียนเรียงความวันภาษาไทยแห่งชาติ',
    maxScore: 10,
    workType: 'เรียงความ/บทความ/ข้อเขียน',
    sampleUrl: 'https://docs.google.com/document/d/sample_thai_essay_guidelines/view',
    rubricCriteria: 'โครงสร้างเรียงความ คำนำ-เนื้อเรื่อง-สรุป (4 คะแนน), การใช้ภาษาและวรรณยุกต์ถูกต้อง (3 คะแนน), เนื้อหามีคุณค่าและข้อคิด (3 คะแนน)',
    academicYear: '2568',
    semester: '1',
    createdAt: '2024-05-20 11:00:00',
  },
];

export const INITIAL_SUBMISSIONS: Submission[] = [];

