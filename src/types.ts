/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GradeLevel = 'ม.1' | 'ม.2' | 'ม.3' | 'ม.4' | 'ม.5' | 'ม.6';

export type SubmissionStatus = 'รอตรวจ' | 'ตรวจแล้ว';

export interface Submission {
  id: string;
  studentName: string;      // ชื่อและนามสกุล ผู้ส่งงาน
  studentNumber: string;    // เลขที่
  gradeLevel: GradeLevel;   // ชั้น ม.1 - ม.6
  room: string;             // ห้อง 1 - 14
  submittedAt: string;      // วันที่และเวลาที่ส่งงาน
  teacherName: string;      // ครูผู้สอน
  subjectCode: string;      // รหัสวิชา
  subjectName: string;      // ชื่อวิชา
  assignmentId: string;     // ID ของงาน
  assignmentName: string;   // ชื่องานที่ส่ง
  maxScore: number;         // คะแนนเต็ม
  academicYear?: string;    // ปีการศึกษา เช่น 2567
  semester?: string;        // ภาคเรียน เช่น 1 หรือ 2
  workUrl: string;          // แนบลิงก์งาน
  score: number | null;     // คะแนนที่ได้ (ถ้ายังไม่ตรวจจะเป็น null)
  status: SubmissionStatus; // รอตรวจ / ตรวจแล้ว
  feedback?: string;        // ข้อเสนอแนะจากคุณครู
  gradedAt?: string;        // วันที่ตรวจ
  gradedBy?: string;        // ตรวจโดย
}

export interface Teacher {
  id: string;
  fullName: string;         // ชื่อ-สกุล
  department: string;       // กลุ่มสาระ
  username: string;
  password: string;
  createdAt: string;
}

export interface AssignmentItem {
  id: string;
  title: string;
  maxScore: number;
}

export interface Assignment {
  id: string;
  teacherName: string;
  subjectCode: string;
  subjectName: string;
  title: string;
  maxScore: number;
  academicYear?: string;    // ปีการศึกษา เช่น 2567
  semester?: string;        // ภาคเรียน เช่น 1 หรือ 2
  description?: string;
  createdAt: string;
}

export interface GoogleSheetConfig {
  sheetId: string;
  scriptUrl: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

export type ActiveTab = 'submit' | 'status' | 'teacher' | 'admin';
