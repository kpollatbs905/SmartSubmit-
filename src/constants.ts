/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Submission, Teacher, Assignment, GoogleSheetConfig } from './types';

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

export const ACADEMIC_YEARS = ['2567', '2568', '2569', '2570'];

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

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 'T001',
    fullName: 'ครูชมัยพร ถินสำราญ',
    department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
    username: 'teacher',
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

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'A001',
    teacherName: 'ครูชมัยพร ถินสำราญ',
    subjectCode: 'ว21103',
    subjectName: 'วิทยาการคำนวณ 1',
    title: 'ใบงานที่ 1: การเขียนผังงาน Flowchart แก้ปัญหาชีวิตประจำวัน',
    maxScore: 10,
    academicYear: '2567',
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
    academicYear: '2567',
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
    academicYear: '2567',
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
    academicYear: '2567',
    semester: '1',
    createdAt: '2024-05-20 11:00:00',
  },
];

export const INITIAL_SUBMISSIONS: Submission[] = [
  {
    id: 'SUB-20240520-001',
    studentName: 'ด.ช. ภูริพัฒน์ วงศ์สว่าง',
    studentNumber: '1',
    gradeLevel: 'ม.1',
    room: '1',
    submittedAt: '24/05/2567 09:15:32',
    teacherName: 'ครูชมัยพร ถินสำราญ',
    subjectCode: 'ว21103',
    subjectName: 'วิทยาการคำนวณ 1',
    assignmentId: 'A001',
    assignmentName: 'ใบงานที่ 1: การเขียนผังงาน Flowchart แก้ปัญหาชีวิตประจำวัน',
    maxScore: 10,
    academicYear: '2567',
    semester: '1',
    workUrl: 'https://docs.google.com/presentation/d/example1',
    score: 9.5,
    status: 'ตรวจแล้ว',
    feedback: 'ออกแบบผังงานได้ถูกต้องตามสัญลักษณ์ ใช้การตัดสินใจและลูปชัดเจน ดีมากครับ',
    gradedAt: '24/05/2567 11:20:00',
    gradedBy: 'ครูชมัยพร ถินสำราญ',
  },
  {
    id: 'SUB-20240520-002',
    studentName: 'ด.ญ. กานต์พิชชา รัตนดิลก',
    studentNumber: '15',
    gradeLevel: 'ม.1',
    room: '1',
    submittedAt: '24/05/2567 10:05:14',
    teacherName: 'ครูชมัยพร ถินสำราญ',
    subjectCode: 'ว21103',
    subjectName: 'วิทยาการคำนวณ 1',
    assignmentId: 'A001',
    assignmentName: 'ใบงานที่ 1: การเขียนผังงาน Flowchart แก้ปัญหาชีวิตประจำวัน',
    maxScore: 10,
    academicYear: '2567',
    semester: '1',
    workUrl: 'https://canva.com/design/example2',
    score: 10,
    status: 'ตรวจแล้ว',
    feedback: 'ผลงานสวยงาม มีความคิดสร้างสรรค์ ลำดับขั้นตอนเข้าใจง่ายมากค่ะ',
    gradedAt: '24/05/2567 11:25:00',
    gradedBy: 'ครูชมัยพร ถินสำราญ',
  },
  {
    id: 'SUB-20240520-003',
    studentName: 'ด.ช. อนันต์ ธนะรัตน์',
    studentNumber: '8',
    gradeLevel: 'ม.1',
    room: '2',
    submittedAt: '24/05/2567 13:40:55',
    teacherName: 'ครูชมัยพร ถิ่นสำราญ',
    subjectCode: 'ว21103',
    subjectName: 'วิทยาการคำนวณ 1',
    assignmentId: 'A002',
    assignmentName: 'ใบงานที่ 2: การออกแบบอัลกอริทึมด้วย Scratch',
    maxScore: 20,
    academicYear: '2567',
    semester: '1',
    workUrl: 'https://scratch.mit.edu/projects/example3',
    score: null,
    status: 'รอตรวจ',
    feedback: '',
  },
  {
    id: 'SUB-20240520-004',
    studentName: 'ด.ญ. พิมพ์มาดา เลิศปัญญา',
    studentNumber: '22',
    gradeLevel: 'ม.2',
    room: '3',
    submittedAt: '24/05/2567 14:12:10',
    teacherName: 'ครูสมศักดิ์ รักการสอน',
    subjectCode: 'ค21101',
    subjectName: 'คณิตศาสตร์พื้นฐาน 1',
    assignmentId: 'A003',
    assignmentName: 'แบบฝึกหัดที่ 3: การบวกและลบจำนวนเต็ม',
    maxScore: 15,
    academicYear: '2567',
    semester: '1',
    workUrl: 'https://drive.google.com/file/d/example4',
    score: null,
    status: 'รอตรวจ',
    feedback: '',
  },
];
