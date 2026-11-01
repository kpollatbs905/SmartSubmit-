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
  workType?: string;        // ชนิดของงาน เช่น ใบงาน, Canva, วิดีโอ, ผังงาน
  sampleUrl?: string;       // ลิงก์ตัวอย่างใบงาน/เกณฑ์จากครูผู้สอน
  academicYear?: string;    // ปีการศึกษา เช่น 2567
  semester?: string;        // ภาคเรียน เช่น 1 หรือ 2
  workUrl: string;          // แนบลิงก์งาน
  score: number | null;     // คะแนนที่ได้ (ถ้ายังไม่ตรวจจะเป็น null)
  status: SubmissionStatus; // รอตรวจ / ตรวจแล้ว
  feedback?: string;        // ข้อเสนอแนะจากคุณครู
  gradedAt?: string;        // วันที่ตรวจ
  gradedBy?: string;        // ตรวจโดย
  aiEvaluation?: {          // ผลการประเมินจาก AI
    suggestedScore: number;
    feedback: string;
    strengths?: string[];
    improvements?: string[];
    evaluatedAt?: string;
  };
}

export interface Teacher {
  id: string;
  fullName: string;         // ชื่อ-สกุล
  department: string;       // กลุ่มสาระ
  username: string;
  password: string;
  createdAt: string;
  resetRequested?: boolean;   // มีคำขอรีเซ็ตรหัสผ่าน
  resetRequestedAt?: string; // วันที่ส่งคำขอรีเซ็ต
}

export interface AssignmentItem {
  id: string;
  title: string;
  maxScore: number;
  workType?: string;        // ชนิดของงาน
  sampleUrl?: string;       // ช่องส่งตัวอย่างใบงาน/ลิงก์ตัวอย่าง
  rubricCriteria?: string;  // เกณฑ์การให้คะแนน
}

export interface Subject {
  id: string;
  code: string;           // รหัสวิชา เช่น ว21103
  name: string;           // ชื่อวิชา เช่น วิทยาการคำนวณ 1
  teacherName?: string;   // ครูผู้สอน
  academicYear?: string;  // ปีการศึกษา
  semester?: string;      // ภาคเรียน
  createdAt?: string;
}

export interface Assignment {
  id: string;
  teacherName: string;
  subjectCode: string;
  subjectName: string;
  title: string;
  maxScore: number;
  workType?: string;        // ชนิดของงาน
  sampleUrl?: string;       // ช่องส่งตัวอย่างใบงาน/ลิงก์ตัวอย่าง
  rubricCriteria?: string;  // เกณฑ์การประเมิน
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
