/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Submission, Teacher, Assignment, Subject, GoogleSheetConfig, GradeLevel, StudentRosterItem } from '../types';
import { INITIAL_SUBMISSIONS, INITIAL_TEACHERS, INITIAL_ASSIGNMENTS, INITIAL_SUBJECTS, DEFAULT_SHEET_CONFIG } from '../constants';
import * as XLSX from 'xlsx';

const STORAGE_KEYS = {
  SUBMISSIONS: 'tha_bo_submissions_v2',
  TEACHERS: 'tha_bo_teachers_v2',
  ASSIGNMENTS: 'tha_bo_assignments_v2',
  SUBJECTS: 'tha_bo_subjects_v2',
  SHEET_CONFIG: 'tha_bo_sheet_config_v2',
  ACTIVE_TEACHER: 'tha_bo_active_teacher_v2',
  STUDENT_ROSTER: 'tha_bo_student_roster_v2',
  DELETED_SUBMISSION_IDS: 'tha_bo_deleted_submission_ids_v1',
  DELETED_SUBMISSION_KEYS: 'tha_bo_deleted_submission_keys_v1',
};

export const stripThaiPrefix = (name: string): string => {
  if (!name) return '';
  return name.trim().replace(/^(ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|นาย|นางสาว|น\.ส\.|นาง)\s*/i, '').trim();
};

export const normalizeRoom = (val: any): string => {
  if (val === undefined || val === null) return '';
  let s = String(val).trim();
  if (!s) return '';
  // If formatted like "1/2" or "ม.1/2" or "ม. 1/2", the room number is after the slash
  if (s.includes('/')) {
    const parts = s.split('/');
    s = parts[parts.length - 1].trim();
  }
  // Strip any Thai words like "ห้อง" or non-digit chars
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return s;
  // Remove leading zeros: "01" -> "1", "02" -> "2"
  const parsed = parseInt(digits, 10);
  return isNaN(parsed) ? s : String(parsed);
};

export const normalizeGradeLevel = (val: any): GradeLevel | undefined => {
  if (!val) return undefined;
  const s = String(val).trim();
  if (/ม\.?\s*1|m\.?\s*1|^1$|^1\//i.test(s)) return 'ม.1';
  if (/ม\.?\s*2|m\.?\s*2|^2$|^2\//i.test(s)) return 'ม.2';
  if (/ม\.?\s*3|m\.?\s*3|^3$|^3\//i.test(s)) return 'ม.3';
  if (/ม\.?\s*4|m\.?\s*4|^4$|^4\//i.test(s)) return 'ม.4';
  if (/ม\.?\s*5|m\.?\s*5|^5$|^5\//i.test(s)) return 'ม.5';
  if (/ม\.?\s*6|m\.?\s*6|^6$|^6\//i.test(s)) return 'ม.6';
  return undefined;
};

export const storageService = {
  // Helper to check if a submission is a demo/sample record
  isSampleSubmission(sub: Submission): boolean {
    if (!sub) return false;
    const isSampleId = sub.id?.startsWith('SUB-20240520-') || sub.id?.startsWith('SUB-SAMPLE-');
    const isSampleUrl = Boolean(sub.workUrl && (
      sub.workUrl.includes('example1') || 
      sub.workUrl.includes('example2') || 
      sub.workUrl.includes('example3') || 
      sub.workUrl.includes('example4')
    ));
    const isSampleName = [
      'ด.ช. ภูริพัฒน์ วงศ์สว่าง',
      'ด.ญ. กานต์พิชชา รัตนดิลก',
      'ด.ช. อนันต์ ธนะรัตน์',
      'ด.ญ. ชนัญชิดา แสงทอง',
      'ด.ช. ภาณุวิชญ์ สุวรรณโชติ',
      'ด.ญ. พิมพ์มาดา เลิศปัญญา'
    ].includes(sub.studentName?.trim());

    return Boolean(isSampleId || (isSampleUrl && isSampleName));
  },

  // เคลียร์ข้อมูลนักเรียนตัวอย่างทั้งหมดออกจากระบบ
  clearAllSampleData(): { removedCount: number } {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      if (!data) return { removedCount: 0 };
      const list: Submission[] = JSON.parse(data);
      const cleaned = list.filter(s => !this.isSampleSubmission(s));
      const removedCount = list.length - cleaned.length;
      this.saveSubmissions(cleaned);
      return { removedCount };
    } catch {
      return { removedCount: 0 };
    }
  },

  // --- SUBMISSIONS ---
  getSubmissions(): Submission[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
        return [];
      }
      const list: Submission[] = JSON.parse(data);
      // Automatically clean out any old sample mock student records
      const cleaned = list.filter(s => !this.isSampleSubmission(s));
      if (cleaned.length !== list.length) {
        this.saveSubmissions(cleaned);
      }
      return cleaned;
    } catch {
      return [];
    }
  },

  saveSubmissions(submissions: Submission[]) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  },

  async addSubmission(submission: Submission, config?: GoogleSheetConfig): Promise<{ success: boolean; message: string }> {
    const list = this.getSubmissions();
    list.unshift(submission);
    this.saveSubmissions(list);

    // If Google Apps Script is configured, post to sheet
    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors', // standard for Google Apps Script Web App redirects
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'submitWork',
            data: submission,
          }),
        });
        return { success: true, message: 'บันทึกข้อมูลและส่งไปยัง Google Sheet เรียบร้อยแล้ว' };
      } catch (err) {
        console.warn('Apps Script sync failed, saved locally:', err);
        return { success: true, message: 'บันทึกข้อมูลในระบบแล้ว (การเชื่อมต่อชีตชั่วคราวติดขัด)' };
      }
    }

    return { success: true, message: 'บันทึกข้อมูลการส่งงานสำเร็จ' };
  },

  async gradeSubmission(
    id: string, 
    score: number, 
    feedback: string, 
    teacherName: string, 
    config?: GoogleSheetConfig,
    aiEvaluation?: Submission['aiEvaluation']
  ): Promise<{ success: boolean; message: string }> {
    const list = this.getSubmissions();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return { success: false, message: 'ไม่พบข้อมูลการส่งงาน' };

    const gradedAt = new Date().toLocaleString('th-TH');
    list[index] = {
      ...list[index],
      score,
      status: 'ตรวจแล้ว',
      feedback,
      gradedAt,
      gradedBy: teacherName,
      ...(aiEvaluation ? { aiEvaluation } : {}),
    };
    this.saveSubmissions(list);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'gradeSubmission',
            id,
            score,
            feedback,
            gradedBy: teacherName,
          }),
        });
      } catch (err) {
        console.warn('Grade sync error:', err);
      }
    }

    return { success: true, message: 'บันทึกคะแนนและคำแนะนำเรียบร้อยแล้ว' };
  },

  async saveAiEvaluation(
    id: string,
    aiEvaluation: NonNullable<Submission['aiEvaluation']>
  ): Promise<{ success: boolean; message: string }> {
    const list = this.getSubmissions();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return { success: false, message: 'ไม่พบข้อมูลการส่งงาน' };

    list[index] = {
      ...list[index],
      aiEvaluation,
    };
    this.saveSubmissions(list);
    return { success: true, message: 'บันทึกผลการประเมินจาก AI สำเร็จ' };
  },

  getDeletedSubmissionIds(): Set<string> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DELETED_SUBMISSION_IDS);
      return new Set(data ? JSON.parse(data) : []);
    } catch {
      return new Set();
    }
  },

  getDeletedSubmissionKeys(): Set<string> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DELETED_SUBMISSION_KEYS);
      return new Set(data ? JSON.parse(data) : []);
    } catch {
      return new Set();
    }
  },

  recordDeletedSubmission(sub: { id?: string; studentName?: string; studentNumber?: string; assignmentName?: string; workUrl?: string }) {
    try {
      if (sub.id) {
        const ids = this.getDeletedSubmissionIds();
        ids.add(sub.id);
        localStorage.setItem(STORAGE_KEYS.DELETED_SUBMISSION_IDS, JSON.stringify(Array.from(ids).slice(-2000)));
      }

      if (sub.studentName && (sub.assignmentName || sub.workUrl)) {
        const keys = this.getDeletedSubmissionKeys();
        const cleanName = stripThaiPrefix(sub.studentName).toLowerCase();
        const cleanNum = String(sub.studentNumber || '').trim();
        const cleanAssign = (sub.assignmentName || '').trim().toLowerCase();
        const cleanUrl = (sub.workUrl || '').trim();
        const key = `${cleanName}_${cleanNum}_${cleanAssign}_${cleanUrl}`;
        keys.add(key);
        localStorage.setItem(STORAGE_KEYS.DELETED_SUBMISSION_KEYS, JSON.stringify(Array.from(keys).slice(-2000)));
      }
    } catch (err) {
      console.warn('Failed to record deleted submission:', err);
    }
  },

  async deleteSubmission(submissionOrId: string | Submission, config?: GoogleSheetConfig): Promise<{ success: boolean; message: string }> {
    const list = this.getSubmissions();
    const id = typeof submissionOrId === 'string' ? submissionOrId : submissionOrId.id;
    const subObj = typeof submissionOrId === 'object' ? submissionOrId : list.find(s => s.id === id);

    if (subObj) {
      this.recordDeletedSubmission(subObj);
    } else if (id) {
      this.recordDeletedSubmission({ id });
    }

    const updated = list.filter(s => s.id !== id);
    this.saveSubmissions(updated);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ 
            action: 'deleteSubmission', 
            id,
            studentName: subObj?.studentName,
            studentNumber: subObj?.studentNumber,
            gradeLevel: subObj?.gradeLevel,
            room: subObj?.room,
            assignmentName: subObj?.assignmentName,
            subjectCode: subObj?.subjectCode,
            workUrl: subObj?.workUrl,
            submittedAt: subObj?.submittedAt,
          }),
        });
      } catch (err) {
        console.warn('Delete submission sync err:', err);
      }
    }

    return { success: true, message: 'ลบข้อมูลการส่งงานออกจากฐานข้อมูลเรียบร้อยแล้ว' };
  },

  async deleteMultipleSubmissions(
    itemsOrIds: (string | Submission)[], 
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; count: number; message: string }> {
    if (!itemsOrIds || itemsOrIds.length === 0) {
      return { success: true, count: 0, message: 'ไม่มีรายการที่ต้องลบ' };
    }
    const list = this.getSubmissions();
    const idSet = new Set<string>();
    const subObjects: (Submission | { id: string })[] = [];

    itemsOrIds.forEach(item => {
      if (typeof item === 'string') {
        idSet.add(item);
        const found = list.find(s => s.id === item);
        if (found) subObjects.push(found);
        else subObjects.push({ id: item });
      } else if (item && item.id) {
        idSet.add(item.id);
        subObjects.push(item);
      }
    });

    subObjects.forEach(s => this.recordDeletedSubmission(s));

    const updated = list.filter(s => !idSet.has(s.id));
    const deletedCount = list.length - updated.length;
    this.saveSubmissions(updated);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ 
            action: 'deleteMultipleSubmissions', 
            ids: Array.from(idSet),
            items: subObjects.map(s => {
              const full = s as Submission;
              return {
                id: s.id,
                studentName: full.studentName,
                studentNumber: full.studentNumber,
                gradeLevel: full.gradeLevel,
                room: full.room,
                assignmentName: full.assignmentName,
                workUrl: full.workUrl,
              };
            })
          }),
        });
      } catch (err) {
        console.warn('Delete multiple submissions sync err:', err);
      }
    }

    return { 
      success: true, 
      count: deletedCount, 
      message: `ลบข้อมูลนักเรียนเรียบร้อยแล้ว (${deletedCount} รายการ)` 
    };
  },

  async deleteSubmissionsByFilter(
    filter: {
      academicYear?: string;
      semester?: string;
      gradeLevel?: GradeLevel | string;
      room?: string;
      teacherName?: string;
    },
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; count: number; message: string }> {
    const list = this.getSubmissions();
    const targets = list.filter(s => {
      if (filter.teacherName && s.teacherName !== filter.teacherName && !s.teacherName.includes(filter.teacherName)) {
        return false;
      }
      if (filter.academicYear && filter.academicYear !== 'ALL' && (s.academicYear || '2567') !== filter.academicYear) {
        return false;
      }
      if (filter.semester && filter.semester !== 'ALL' && (s.semester || '1') !== filter.semester) {
        return false;
      }
      if (filter.gradeLevel && filter.gradeLevel !== 'ALL' && s.gradeLevel !== filter.gradeLevel) {
        return false;
      }
      if (filter.room && filter.room !== 'ALL' && s.room !== filter.room) {
        return false;
      }
      return true;
    });

    const targetIds = targets.map(t => t.id);
    return this.deleteMultipleSubmissions(targetIds, config);
  },

  async updateSubmissionStudent(
    id: string,
    data: {
      studentName: string;
      studentNumber: string;
      gradeLevel?: GradeLevel;
      room?: string;
      workUrl?: string;
    },
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; message: string }> {
    const list = this.getSubmissions();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return { success: false, message: 'ไม่พบข้อมูลการส่งงานที่ต้องการแก้ไข' };

    list[index] = {
      ...list[index],
      studentName: data.studentName.trim(),
      studentNumber: data.studentNumber.trim(),
      ...(data.gradeLevel ? { gradeLevel: data.gradeLevel } : {}),
      ...(data.room ? { room: data.room } : {}),
      ...(data.workUrl ? { workUrl: data.workUrl.trim() } : {}),
    };
    this.saveSubmissions(list);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateSubmissionStudent',
            id,
            ...data,
          }),
        });
      } catch (err) {
        console.warn('Update submission sync err:', err);
      }
    }

    return { success: true, message: 'ปรับปรุงข้อมูลนักเรียนเรียบร้อยแล้ว' };
  },

  // --- TEACHERS ---
  getTeachers(): Teacher[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEACHERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(INITIAL_TEACHERS));
        return INITIAL_TEACHERS;
      }
      const parsed: Teacher[] = JSON.parse(data);
      // Remove default test account 'teacher' if present in localStorage
      const cleaned = parsed.filter(t => t.username.toLowerCase() !== 'teacher');
      if (cleaned.length !== parsed.length) {
        this.saveTeachers(cleaned);
        return cleaned;
      }
      return parsed;
    } catch {
      return INITIAL_TEACHERS;
    }
  },

  saveTeachers(teachers: Teacher[]) {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
  },

  async registerTeacher(teacher: Teacher, config?: GoogleSheetConfig): Promise<{ success: boolean; message: string }> {
    const list = this.getTeachers();
    if (list.some(t => t.username.toLowerCase() === teacher.username.toLowerCase())) {
      return { success: false, message: 'Username นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' };
    }
    list.push(teacher);
    this.saveTeachers(list);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'registerTeacher',
            teacher,
          }),
        });
      } catch (err) {
        console.warn('Teacher sync err:', err);
      }
    }

    return { success: true, message: 'ลงทะเบียนครูผู้สอนเรียบร้อยแล้ว' };
  },

  async deleteTeacher(id: string, config?: GoogleSheetConfig): Promise<{ success: boolean; message: string }> {
    const list = this.getTeachers();
    const updated = list.filter(t => t.id !== id);
    this.saveTeachers(updated);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deleteTeacher', id }),
        });
      } catch (err) {
        console.warn('Delete teacher sync err:', err);
      }
    }

    return { success: true, message: 'ลบข้อมูลครูผู้สอนเรียบร้อยแล้ว' };
  },

  async requestTeacherPasswordReset(teacherIdentifier: string): Promise<{ success: boolean; message: string; teacherName?: string }> {
    const list = this.getTeachers();
    const query = teacherIdentifier.trim().toLowerCase();
    const teacher = list.find(t => 
      t.id.toLowerCase() === query || 
      t.username.toLowerCase() === query || 
      t.fullName.toLowerCase().includes(query)
    );

    if (!teacher) {
      return { 
        success: false, 
        message: 'ไม่พบข้อมูลครูผู้สอนจากชื่อหรือ Username ที่ระบุ กรุณาตรวจสอบหรือติดต่อผู้ดูแลระบบโดยตรง' 
      };
    }

    teacher.resetRequested = true;
    teacher.resetRequestedAt = new Date().toLocaleString('th-TH');
    this.saveTeachers(list);

    return { 
      success: true, 
      message: `ระบบได้ส่งคำขอรีเซ็ตรหัสผ่านของ "${teacher.fullName}" ไปยังผู้ดูแลระบบ (Admin) เรียบร้อยแล้ว`,
      teacherName: teacher.fullName 
    };
  },

  async resetTeacherCredentials(
    teacherId: string, 
    newUsername: string, 
    newPassword: string, 
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; message: string }> {
    const list = this.getTeachers();
    const teacherIndex = list.findIndex(t => t.id === teacherId);
    
    if (teacherIndex === -1) {
      return { success: false, message: 'ไม่พบข้อมูลครูผู้สอนที่ต้องการรีเซ็ต' };
    }

    const trimmedUser = newUsername.trim();
    const trimmedPass = newPassword.trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, message: 'กรุณาระบุ Username และ Password ให้ครบถ้วน' };
    }

    // Check if newUsername is already taken by another teacher
    const conflict = list.find(t => t.id !== teacherId && t.username.toLowerCase() === trimmedUser.toLowerCase());
    if (conflict) {
      return { success: false, message: `Username "${trimmedUser}" ถูกใช้งานโดยคุณครูท่านอื่นแล้ว` };
    }

    const oldUsername = list[teacherIndex].username;
    list[teacherIndex].username = trimmedUser;
    list[teacherIndex].password = trimmedPass;
    list[teacherIndex].resetRequested = false;
    list[teacherIndex].resetRequestedAt = undefined;
    this.saveTeachers(list);

    // If active teacher is this teacher, update session too
    const activeTeacher = this.getActiveTeacher();
    if (activeTeacher && activeTeacher.id === teacherId) {
      this.setActiveTeacher(list[teacherIndex]);
    }

    // Sync to Google Sheet if configured
    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'resetTeacherCredentials',
            id: teacherId,
            fullName: list[teacherIndex].fullName,
            oldUsername,
            newUsername: trimmedUser,
            newPassword: trimmedPass,
          }),
        });
      } catch (err) {
        console.warn('Reset teacher sync err:', err);
      }
    }

    return { 
      success: true, 
      message: `รีเซ็ตข้อมูลเข้าสู่ระบบของ "${list[teacherIndex].fullName}" สำเร็จ` 
    };
  },

  getActiveTeacher(): Teacher | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_TEACHER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setActiveTeacher(teacher: Teacher | null) {
    if (teacher) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TEACHER, JSON.stringify(teacher));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TEACHER);
    }
  },

  // --- ASSIGNMENTS ---
  getAssignments(): Assignment[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
        return INITIAL_ASSIGNMENTS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_ASSIGNMENTS;
    }
  },

  saveAssignments(assignments: Assignment[]) {
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  },

  async addAssignments(assignments: Assignment[], config?: GoogleSheetConfig): Promise<{ success: boolean; message: string }> {
    const current = this.getAssignments();
    const updated = [...assignments, ...current];
    this.saveAssignments(updated);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'saveAssignment',
            assignments,
          }),
        });
      } catch (err) {
        console.warn('Assignment sync err:', err);
      }
    }

    return { success: true, message: `บันทึกงานใหม่จำนวน ${assignments.length} ชิ้นงานเรียบร้อยแล้ว` };
  },

  async updateAssignment(
    updatedAssignment: Assignment, 
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; message: string }> {
    const currentAssignments = this.getAssignments();
    const index = currentAssignments.findIndex(a => a.id === updatedAssignment.id);
    if (index === -1) {
      return { success: false, message: 'ไม่พบข้อมูลงานที่ต้องการแก้ไข' };
    }
    
    currentAssignments[index] = { ...currentAssignments[index], ...updatedAssignment };
    this.saveAssignments(currentAssignments);

    // ปรับปรุงข้อมูลในงานที่นักเรียนส่งไปแล้วให้เป็นปัจจุบันตามข้อมูลใหม่
    const currentSubmissions = this.getSubmissions();
    let hasSubmissionsUpdated = false;
    const updatedSubmissions = currentSubmissions.map(sub => {
      if (sub.assignmentId === updatedAssignment.id) {
        hasSubmissionsUpdated = true;
        return {
          ...sub,
          subjectCode: updatedAssignment.subjectCode,
          subjectName: updatedAssignment.subjectName,
          assignmentName: updatedAssignment.title,
          maxScore: updatedAssignment.maxScore,
          workType: updatedAssignment.workType || sub.workType,
          sampleUrl: updatedAssignment.sampleUrl ?? sub.sampleUrl,
          academicYear: updatedAssignment.academicYear || sub.academicYear,
          semester: updatedAssignment.semester || sub.semester,
        };
      }
      return sub;
    });

    if (hasSubmissionsUpdated) {
      this.saveSubmissions(updatedSubmissions);
    }

    // Sync to Google Sheet Web App in background
    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateAssignment',
            assignment: updatedAssignment,
          }),
        });
      } catch (err) {
        console.warn('Update assignment sync err:', err);
      }
    }

    return { success: true, message: 'ปรับปรุงข้อมูลวิชาและใบงานเรียบร้อยแล้ว' };
  },

  async deleteAssignment(id: string, config?: GoogleSheetConfig): Promise<void> {
    const current = this.getAssignments().filter(a => a.id !== id);
    this.saveAssignments(current);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deleteAssignment', id }),
        });
      } catch (err) {
        console.warn('Delete assignment sync err:', err);
      }
    }
  },

  // --- SUBJECTS (รายวิชา) ---
  getSubjects(): Subject[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      if (!data) {
        // Also extract unique subjects from existing assignments if any
        const assignments = this.getAssignments();
        const extracted = new Map<string, Subject>();
        INITIAL_SUBJECTS.forEach(s => extracted.set(s.code, s));
        assignments.forEach(a => {
          if (!extracted.has(a.subjectCode)) {
            extracted.set(a.subjectCode, {
              id: `SUBJ-${a.subjectCode}-${Date.now()}`,
              code: a.subjectCode,
              name: a.subjectName,
              teacherName: a.teacherName,
              academicYear: a.academicYear,
              semester: a.semester,
            });
          }
        });
        const list = Array.from(extracted.values());
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(list));
        return list;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_SUBJECTS;
    }
  },

  saveSubjects(subjects: Subject[]) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  },

  async addSubject(
    subject: { code: string; name: string; teacherName?: string; academicYear?: string; semester?: string }, 
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; message: string; subject?: Subject }> {
    const list = this.getSubjects();
    const cleanCode = subject.code.trim();
    const cleanName = subject.name.trim();

    if (!cleanCode || !cleanName) {
      return { success: false, message: 'กรุณาระบุรหัสวิชาและชื่อวิชาให้ครบถ้วน' };
    }

    const exists = list.find(s => s.code.toLowerCase() === cleanCode.toLowerCase());
    if (exists) {
      return { success: false, message: `รหัสวิชา "${cleanCode}" มีอยู่ในระบบแล้ว (${exists.name})` };
    }

    const newSubject: Subject = {
      id: `SUBJ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: cleanCode,
      name: cleanName,
      teacherName: subject.teacherName,
      academicYear: subject.academicYear || '2567',
      semester: subject.semester || '1',
      createdAt: new Date().toLocaleString('th-TH'),
    };

    list.unshift(newSubject);
    this.saveSubjects(list);

    return { 
      success: true, 
      message: `เพิ่มรายวิชา "${cleanCode} ${cleanName}" เรียบร้อยแล้ว ✨`, 
      subject: newSubject 
    };
  },

  async updateSubject(
    oldCode: string, 
    updated: { code: string; name: string }, 
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; message: string }> {
    const list = this.getSubjects();
    const index = list.findIndex(s => s.code.toLowerCase() === oldCode.toLowerCase());
    if (index === -1) {
      return { success: false, message: 'ไม่พบวิชาที่ต้องการแก้ไข' };
    }

    const newCode = updated.code.trim();
    const newName = updated.name.trim();

    if (!newCode || !newName) {
      return { success: false, message: 'รหัสวิชาและชื่อวิชาต้องไม่เว้นว่าง' };
    }

    // Check duplicate if code changed
    if (newCode.toLowerCase() !== oldCode.toLowerCase()) {
      const duplicate = list.find(s => s.code.toLowerCase() === newCode.toLowerCase());
      if (duplicate) {
        return { success: false, message: `รหัสวิชา "${newCode}" มีอยู่ในระบบแล้ว` };
      }
    }

    list[index] = { ...list[index], code: newCode, name: newName };
    this.saveSubjects(list);

    // Cascade update to all assignments matching oldCode
    const assignments = this.getAssignments();
    let assignChanged = false;
    const updatedAssignments = assignments.map(a => {
      if (a.subjectCode.toLowerCase() === oldCode.toLowerCase()) {
        assignChanged = true;
        return { ...a, subjectCode: newCode, subjectName: newName };
      }
      return a;
    });
    if (assignChanged) {
      this.saveAssignments(updatedAssignments);
    }

    // Cascade update to all submissions matching oldCode
    const submissions = this.getSubmissions();
    let subChanged = false;
    const updatedSubmissions = submissions.map(sub => {
      if (sub.subjectCode.toLowerCase() === oldCode.toLowerCase()) {
        subChanged = true;
        return { ...sub, subjectCode: newCode, subjectName: newName };
      }
      return sub;
    });
    if (subChanged) {
      this.saveSubmissions(updatedSubmissions);
    }

    return { success: true, message: `ปรับปรุงข้อมูลรายวิชา "${newCode} ${newName}" เรียบร้อยแล้ว` };
  },

  async deleteSubject(code: string, config?: GoogleSheetConfig): Promise<{ success: boolean; message: string }> {
    const list = this.getSubjects();
    const filtered = list.filter(s => s.code.toLowerCase() !== code.toLowerCase());
    this.saveSubjects(filtered);

    return { success: true, message: `ลบรายวิชารหัส "${code}" เรียบร้อยแล้ว` };
  },

  // --- SHEET CONFIG ---
  getSheetConfig(): GoogleSheetConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SHEET_CONFIG);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SHEET_CONFIG, JSON.stringify(DEFAULT_SHEET_CONFIG));
        return DEFAULT_SHEET_CONFIG;
      }
      const parsed: GoogleSheetConfig = JSON.parse(data);
      if (!parsed.scriptUrl || parsed.scriptUrl.trim() === '') {
        parsed.scriptUrl = DEFAULT_SHEET_CONFIG.scriptUrl;
        parsed.sheetId = parsed.sheetId || DEFAULT_SHEET_CONFIG.sheetId;
        parsed.autoSync = true;
        this.saveSheetConfig(parsed);
      }
      return parsed;
    } catch {
      return DEFAULT_SHEET_CONFIG;
    }
  },

  saveSheetConfig(config: GoogleSheetConfig) {
    localStorage.setItem(STORAGE_KEYS.SHEET_CONFIG, JSON.stringify(config));
  },

  // --- SYNC WITH GOOGLE SHEET (FETCH) ---
  async syncFromGoogleSheet(config: GoogleSheetConfig): Promise<{ success: boolean; message: string; count?: number }> {
    if (!config.scriptUrl) {
      return { success: false, message: 'กรุณาระบุ URL ของ Google Apps Script Web App' };
    }

    try {
      const url = `${config.scriptUrl}${config.scriptUrl.includes('?') ? '&' : '?'}action=getAll&t=${Date.now()}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'success' && json.data) {
        const { submissions, teachers, assignments, sheetId } = json.data;
        
        if (Array.isArray(submissions) && submissions.length > 0) {
          const deletedIds = this.getDeletedSubmissionIds();
          const deletedKeys = this.getDeletedSubmissionKeys();

          const formatted: Submission[] = submissions
            .map((row: any, i: number) => ({
              id: row['รหัสการส่ง (ID)'] || row.id || `SUB-SHEET-${i}`,
              submittedAt: row['วันที่ส่งงาน'] || row.submittedAt || new Date().toLocaleString('th-TH'),
              studentName: row['ชื่อ-นามสกุล'] || row.studentName || 'ไม่ระบุชื่อ',
              studentNumber: String(row['เลขที่'] || row.studentNumber || '-'),
              gradeLevel: (row['ระดับชั้น'] || row.gradeLevel || 'ม.1') as any,
              room: String(row['ห้อง'] || row.room || '1'),
              teacherName: row['ครูผู้สอน'] || row.teacherName || '',
              subjectCode: row['รหัสวิชา'] || row.subjectCode || '',
              subjectName: row['ชื่อวิชา'] || row.subjectName || '',
              assignmentId: `A-${i}`,
              assignmentName: row['ชื่องาน'] || row.assignmentName || 'งานที่ส่ง',
              maxScore: Number(row['คะแนนเต็ม'] || row.maxScore || 10),
              workUrl: row['ลิงก์ผลงาน'] || row.workUrl || '',
              score: row['คะแนนที่ได้'] !== '' && row['คะแนนที่ได้'] !== undefined && row['คะแนนที่ได้'] !== null ? Number(row['คะแนนที่ได้']) : null,
              status: (row['สถานะ'] || (row['คะแนนที่ได้'] !== '' && row['คะแนนที่ได้'] !== undefined ? 'ตรวจแล้ว' : 'รอตรวจ')) as any,
              feedback: row['คำแนะนำ/ข้อเสนอแนะ'] || row.feedback || '',
              gradedAt: row['วันที่ตรวจ'] || row.gradedAt || '',
              gradedBy: row['ผู้ตรวจ'] || row.gradedBy || '',
            }))
            .filter((sub: Submission) => {
              if (deletedIds.has(sub.id)) return false;
              if (sub.studentName && (sub.assignmentName || sub.workUrl)) {
                const cleanName = stripThaiPrefix(sub.studentName).toLowerCase();
                const cleanNum = String(sub.studentNumber || '').trim();
                const cleanAssign = (sub.assignmentName || '').trim().toLowerCase();
                const cleanUrl = (sub.workUrl || '').trim();
                const key = `${cleanName}_${cleanNum}_${cleanAssign}_${cleanUrl}`;
                if (deletedKeys.has(key)) return false;
              }
              return true;
            });

          this.saveSubmissions(formatted);
        }

        if (Array.isArray(teachers) && teachers.length > 0) {
          const formattedTeachers: Teacher[] = teachers.map((row: any, i: number) => ({
            id: row['ID'] || `T-${i}`,
            fullName: row['ชื่อ-สกุล'] || '',
            department: row['กลุ่มสาระ'] || '',
            username: row['Username'] || `user${i}`,
            password: String(row['Password'] || '1234'),
            createdAt: row['วันที่สมัคร'] || '',
          }));
          this.saveTeachers(formattedTeachers);
        }

        if (Array.isArray(assignments) && assignments.length > 0) {
          const formattedAssignments: Assignment[] = assignments.map((row: any, i: number) => ({
            id: row['ID'] || `A-${i}`,
            teacherName: row['ครูผู้สอน'] || '',
            subjectCode: row['รหัสวิชา'] || '',
            subjectName: row['ชื่อวิชา'] || '',
            title: row['ชื่องาน'] || '',
            maxScore: Number(row['คะแนนเต็ม'] || 10),
            createdAt: row['วันที่สร้าง'] || '',
          }));
          this.saveAssignments(formattedAssignments);
        }

        this.saveSheetConfig({
          ...config,
          sheetId: sheetId || config.sheetId,
          lastSyncedAt: new Date().toLocaleString('th-TH'),
        });

        return { 
          success: true, 
          message: 'ดึงและซิงค์ข้อมูลจาก Google Sheet สำเร็จเรียบร้อยแล้ว!',
          count: submissions?.length || 0 
        };
      } else {
        return { success: false, message: json.message || 'โครงสร้างข้อมูลไม่ถูกต้อง' };
      }
    } catch (err: any) {
      return { 
        success: false, 
        message: 'ไม่สามารถดึงข้อมูลได้: ' + (err.message || 'โปรดตรวจสอบสิทธิ์การแชร์ Anyone ของ Apps Script') 
      };
    }
  },

  // --- EXPORT TO EXCEL ---
  exportToExcel(submissions: Submission[], filename = 'รายงานการส่งงาน_โรงเรียนท่าบ่อ') {
    const data = submissions.map((s, index) => ({
      'ลำดับ': index + 1,
      'ปีการศึกษา': s.academicYear || '-',
      'ภาคเรียน': s.semester ? `ภาคเรียนที่ ${s.semester}` : '-',
      'วันที่ส่งงาน': s.submittedAt,
      'ระดับชั้น': s.gradeLevel,
      'ห้อง': s.room,
      'เลขที่': s.studentNumber,
      'ชื่อ-นามสกุล': s.studentName,
      'รหัสวิชา': s.subjectCode,
      'ชื่อวิชา': s.subjectName,
      'ชื่องาน': s.assignmentName,
      'คะแนนที่ได้ (ครู)': s.score !== null ? s.score : '-',
      'คะแนน AI ประเมิน': s.aiEvaluation ? `${s.aiEvaluation.suggestedScore}` : '-',
      'คะแนนเต็ม': s.maxScore,
      'สถานะ': s.status,
      'คำแนะนำจาก AI': s.aiEvaluation?.feedback || '-',
      'ลิงก์ผลงาน': s.workUrl,
      'ครูผู้สอน/ผู้ตรวจ': s.gradedBy || s.teacherName,
      'คำแนะนำของคุณครู': s.feedback || '-',
      'วันที่ตรวจ': s.gradedAt || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ผลการส่งงาน');

    // Auto width
    const colWidths = [
      { wch: 6 },  // ลำดับ
      { wch: 12 }, // ปีการศึกษา
      { wch: 14 }, // ภาคเรียน
      { wch: 18 }, // วันที่ส่ง
      { wch: 8 },  // ชั้น
      { wch: 6 },  // ห้อง
      { wch: 6 },  // เลขที่
      { wch: 22 }, // ชื่อ-นามสกุล
      { wch: 10 }, // รหัสวิชา
      { wch: 20 }, // ชื่อวิชา
      { wch: 30 }, // ชื่องาน
      { wch: 12 }, // คะแนนที่ได้
      { wch: 14 }, // คะแนน AI
      { wch: 10 }, // คะแนนเต็ม
      { wch: 10 }, // สถานะ
      { wch: 30 }, // คำแนะนำ AI
      { wch: 35 }, // ลิงก์
      { wch: 20 }, // ครู
      { wch: 30 }, // ข้อเสนอแนะ
      { wch: 18 }, // วันที่ตรวจ
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  exportMissingStudentsToExcel(
    missingList: Array<{
      studentNumber: string;
      studentName: string;
      gradeLevel: string;
      room: string;
      assignmentName?: string;
      subjectCode?: string;
      subjectName?: string;
    }>,
    filename = 'รายชื่อนักเรียนค้างส่งงาน_โรงเรียนท่าบ่อ'
  ) {
    const data = missingList.map((item, index) => ({
      'ลำดับ': index + 1,
      'เลขที่': item.studentNumber,
      'ชื่อ-นามสกุล': item.studentName,
      'ระดับชั้น': item.gradeLevel,
      'ห้อง': item.room,
      'วิชา': item.subjectCode ? `${item.subjectCode} ${item.subjectName || ''}`.trim() : '-',
      'งานที่ค้างส่ง': item.assignmentName || 'งานที่มอบหมาย',
      'สถานะ': 'ยังไม่ส่งงาน (ค้างส่ง)',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายชื่อคนค้างส่ง');

    worksheet['!cols'] = [
      { wch: 6 },  // ลำดับ
      { wch: 8 },  // เลขที่
      { wch: 25 }, // ชื่อ-นามสกุล
      { wch: 10 }, // ระดับชั้น
      { wch: 8 },  // ห้อง
      { wch: 20 }, // วิชา
      { wch: 30 }, // งานที่ค้างส่ง
      { wch: 22 }, // สถานะ
    ];

    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  // --- EXPORT TO PDF (Printable Formatted HTML Window with full Thai fonts & proper styling) ---
  exportToPdf(submissions: Submission[], title = 'รายงานผลการส่งงานและคะแนนนักเรียน', filterSummary = '') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อดาวน์โหลดและพิมพ์ PDF');
      return;
    }

    const rowsHtml = submissions.map((s, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb; ${idx % 2 === 0 ? 'background-color: #f9fafb;' : ''}">
        <td style="padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; text-align: center;">${s.studentNumber}</td>
        <td style="padding: 8px;"><strong>${s.studentName}</strong></td>
        <td style="padding: 8px; text-align: center;">${s.gradeLevel}/${s.room}</td>
        <td style="padding: 8px; text-align: center; font-size: 11px;">${s.academicYear ? `${s.academicYear}/${s.semester || '1'}` : '-'}</td>
        <td style="padding: 8px;">${s.subjectCode} ${s.subjectName}</td>
        <td style="padding: 8px;">${s.assignmentName}</td>
        <td style="padding: 8px; text-align: center; font-weight: bold; font-size: 13px; color: #7c3aed; background-color: #f5f3ff;">
          ${s.aiEvaluation ? `${s.aiEvaluation.suggestedScore}/${s.maxScore}` : '-'}
        </td>
        <td style="padding: 8px; text-align: center; font-weight: bold; font-size: 13px; color: ${s.status === 'ตรวจแล้ว' ? '#059669' : '#d97706'};">
          ${s.score !== null ? s.score : '-'} / ${s.maxScore}
        </td>
        <td style="padding: 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; ${s.status === 'ตรวจแล้ว' ? 'background-color: #d1fae5; color: #065f46;' : 'background-color: #fef3c7; color: #92400e;'}">
            ${s.status}
          </span>
        </td>
        <td style="padding: 8px; font-size: 12px; color: #4b5563;">
          ${s.aiEvaluation ? `<div style="font-size: 11px; color: #6d28d9; margin-bottom: 3px;"><strong>🤖 AI:</strong> ${s.aiEvaluation.feedback}</div>` : ''}
          ${s.feedback ? `<div><strong>ครู:</strong> ${s.feedback}</div>` : (s.aiEvaluation ? '' : '-')}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Sarabun', sans-serif; color: #111827; margin: 0; padding: 15px; font-size: 13px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; }
          .title { font-size: 20px; font-weight: bold; color: #1e1b4b; margin: 0; }
          .subtitle { font-size: 14px; color: #4b5563; margin-top: 5px; }
          .filter-tag { display: inline-block; background-color: #EEF2FF; color: #3730A3; font-weight: 600; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; color: #6b7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background-color: #4f46e5; color: #ffffff; padding: 10px 8px; font-weight: 600; text-align: left; }
          th.center { text-align: center; }
          .footer { margin-top: 25px; text-align: right; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
          .badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; background: #EEF2FF; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #3730A3; font-weight: 600;">📄 ตัวอย่างรายงานสำหรับพิมพ์หรือบันทึกเป็น PDF</span>
          <button onclick="window.print()" style="background: #4F46E5; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
            🖨️ พิมพ์ / บันทึกเป็น PDF (Print to PDF)
          </button>
        </div>

        <div class="header">
          <div class="title">ระบบตรวจงานให้คะแนน ออนไลน์</div>
          <div class="subtitle">โรงเรียนท่าบ่อ สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย (สพม.หนองคาย)</div>
          <div class="subtitle" style="font-weight: bold; color: #3730A3;">${title}</div>
          ${filterSummary ? `<div class="filter-tag">🔍 เงื่อนไขการกรอง: ${filterSummary}</div>` : ''}
        </div>

        <div class="meta">
          <div>จำนวนรายการที่ส่งออก: <strong>${submissions.length}</strong> รายการ</div>
          <div>พิมพ์ข้อมูลเมื่อ: <strong>${new Date().toLocaleString('th-TH')}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="center" style="width: 35px;">ลำดับ</th>
              <th class="center" style="width: 40px;">เลขที่</th>
              <th style="width: 140px;">ชื่อ-สกุล</th>
              <th class="center" style="width: 55px;">ชั้น/ห้อง</th>
              <th class="center" style="width: 55px;">ปี/เทอม</th>
              <th style="width: 110px;">วิชา</th>
              <th style="width: 150px;">ชื่องาน</th>
              <th class="center" style="width: 80px; background-color: #6d28d9;">🤖 คะแนน AI</th>
              <th class="center" style="width: 80px;">คะแนนครู</th>
              <th class="center" style="width: 70px;">สถานะ</th>
              <th>คำแนะนำ/ข้อเสนอแนะ</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>พัฒนาโดย ครูชมัยพร ถินสำราญ • โรงเรียนท่าบ่อ  สพม.หนองคาย • ติดตามเพจ AI กับครูพอลล่า</div>
          <div style="margin-top: 3px;">พิมพ์จากระบบตรวจงานให้คะแนน ออนไลน์ • วันที่ ${new Date().toLocaleDateString('th-TH')}</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
  },

  // --- STUDENT ROSTER MANAGEMENT & EXCEL IMPORT ---
  getStudentRoster(): StudentRosterItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENT_ROSTER);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) => ({
        ...item,
        room: normalizeRoom(item.room) || item.room,
        studentNumber: String(item.studentNumber || '').trim(),
      }));
    } catch {
      return [];
    }
  },

  saveStudentRoster(roster: StudentRosterItem[]) {
    const normalized = (roster || []).map(item => ({
      ...item,
      room: normalizeRoom(item.room) || item.room,
      studentNumber: String(item.studentNumber || '').trim(),
    }));
    localStorage.setItem(STORAGE_KEYS.STUDENT_ROSTER, JSON.stringify(normalized));
  },

  deleteStudentFromRoster(rosterId: string) {
    const list = this.getStudentRoster();
    const filtered = list.filter(r => r.id !== rosterId);
    this.saveStudentRoster(filtered);
  },

  updateStudentInRoster(rosterId: string, updates: Partial<StudentRosterItem>) {
    const list = this.getStudentRoster();
    const updated = list.map(r => r.id === rosterId ? { ...r, ...updates } : r);
    this.saveStudentRoster(updated);
  },

  deleteMultipleStudentsFromRoster(rosterIds: string[]) {
    const list = this.getStudentRoster();
    const filtered = list.filter(r => !rosterIds.includes(r.id));
    this.saveStudentRoster(filtered);
  },

  deleteRosterByRoom(gradeLevel: string, room: string, academicYear?: string, semester?: string) {
    const list = this.getStudentRoster();
    const filtered = list.filter(r => {
      const matchGrade = r.gradeLevel === gradeLevel;
      const matchRoom = r.room === room;
      const matchYear = !academicYear || academicYear === 'ALL' || r.academicYear === academicYear;
      const matchSem = !semester || semester === 'ALL' || r.semester === semester;
      return !(matchGrade && matchRoom && matchYear && matchSem);
    });
    this.saveStudentRoster(filtered);
  },

  // ดาวน์โหลดไฟล์แม่แบบ Excel สำหรับอัปโหลดรายชื่อนักเรียน
  downloadStudentRosterTemplate(gradeLevel = 'ม.1', room = '1') {
    const templateData = [
      {
        'เลขที่': 1,
        'ชื่อ-นามสกุล': 'ด.ช. ภูริพัฒน์ วงศ์สว่าง',
        'ระดับชั้น': gradeLevel,
        'ห้อง': room,
        'ปีการศึกษา': '2567',
        'ภาคเรียน': '1',
      },
      {
        'เลขที่': 2,
        'ชื่อ-นามสกุล': 'ด.ช. กิตติศักดิ์ เจริญพร',
        'ระดับชั้น': gradeLevel,
        'ห้อง': room,
        'ปีการศึกษา': '2567',
        'ภาคเรียน': '1',
      },
      {
        'เลขที่': 3,
        'ชื่อ-นามสกุล': 'ด.ญ. กัญญารัตน์ มณีฉาย',
        'ระดับชั้น': gradeLevel,
        'ห้อง': room,
        'ปีการศึกษา': '2567',
        'ภาคเรียน': '1',
      },
      {
        'เลขที่': 4,
        'ชื่อ-นามสกุล': 'ด.ญ. ณัฐธิดา สุขเกษม',
        'ระดับชั้น': gradeLevel,
        'ห้อง': room,
        'ปีการศึกษา': '2567',
        'ภาคเรียน': '1',
      },
      {
        'เลขที่': 5,
        'ชื่อ-นามสกุล': 'ด.ช. ธนกฤต ศรีบุญเรือง',
        'ระดับชั้น': gradeLevel,
        'ห้อง': room,
        'ปีการศึกษา': '2567',
        'ภาคเรียน': '1',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `รายชื่อ_${gradeLevel}_ห้อง${room}`);

    worksheet['!cols'] = [
      { wch: 8 },  // เลขที่
      { wch: 28 }, // ชื่อ-นามสกุล
      { wch: 12 }, // ระดับชั้น
      { wch: 8 },  // ห้อง
      { wch: 12 }, // ปีการศึกษา
      { wch: 10 }, // ภาคเรียน
    ];

    XLSX.writeFile(workbook, `แม่แบบรายชื่อนักเรียน_${gradeLevel}_ห้อง${room}.xlsx`);
  },

  // แยกวิเคราะห์ไฟล์ Excel ที่อัปโหลดเข้ามา
  parseStudentRosterExcel(fileBuffer: ArrayBuffer): {
    success: boolean;
    data?: Array<{
      studentNumber: string;
      studentName: string;
      gradeLevel?: GradeLevel;
      room?: string;
      academicYear?: string;
      semester?: string;
    }>;
    error?: string;
  } {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return { success: false, error: 'ไม่พบชีตข้อมูลในไฟล์ Excel' };
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rows || rows.length === 0) {
        return { success: false, error: 'ไฟล์ Excel ไม่มีข้อมูลนักเรียน' };
      }

      const parsedStudents: Array<{
        studentNumber: string;
        studentName: string;
        gradeLevel?: GradeLevel;
        room?: string;
        academicYear?: string;
        semester?: string;
      }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // หาฟิลด์ชื่อนักเรียน
        const nameKey = Object.keys(row).find(k => 
          /ชื่อ.*นามสกุล|ชื่อ.*สกุล|ชื่อ|name|fullname|นักเรียน/i.test(k.trim()) && !/ครู|ผู้สอน/i.test(k.trim())
        );
        const rawName = nameKey ? String(row[nameKey]).trim() : '';

        // ถ้าไม่มีชื่อ ให้ข้ามบรรทัดนี้ไป
        if (!rawName) continue;

        // หาฟิลด์เลขที่
        const noKey = Object.keys(row).find(k => 
          /เลขที่|no|number|ที่|ลำดับ/i.test(k.trim())
        );
        const rawNo = noKey ? String(row[noKey]).trim() : String(parsedStudents.length + 1);

        // หาฟิลด์ระดับชั้น
        const gradeKey = Object.keys(row).find(k => 
          /ระดับชั้น|ชั้น|grade|class|level/i.test(k.trim())
        );
        let rawGrade: GradeLevel | undefined = gradeKey && row[gradeKey] ? normalizeGradeLevel(row[gradeKey]) : undefined;

        // หาฟิลด์ห้อง
        const roomKey = Object.keys(row).find(k => 
          /ห้องเรียน|ห้อง|room/i.test(k.trim())
        );
        const rawRoom = roomKey && row[roomKey] ? normalizeRoom(row[roomKey]) : undefined;

        // ถ้ายังไม่ได้ระดับชั้น แต่ฟิลด์ห้องระบุเป็น "1/2" หรือ "ม.1/2" ให้นำระดับชั้นจากฟิลด์ห้องมาใช้
        if (!rawGrade && roomKey && row[roomKey]) {
          rawGrade = normalizeGradeLevel(row[roomKey]);
        }

        // หาฟิลด์ปีการศึกษา
        const yearKey = Object.keys(row).find(k => 
          /ปีการศึกษา|ปี|year/i.test(k.trim())
        );
        const rawYear = yearKey && row[yearKey] ? String(row[yearKey]).trim() : undefined;

        // หาฟิลด์ภาคเรียน
        const semKey = Object.keys(row).find(k => 
          /ภาคเรียน|เทอม|semester|term/i.test(k.trim())
        );
        const rawSem = semKey && row[semKey] ? String(row[semKey]).trim() : undefined;

        parsedStudents.push({
          studentNumber: rawNo || String(parsedStudents.length + 1),
          studentName: rawName,
          gradeLevel: rawGrade,
          room: rawRoom,
          academicYear: rawYear,
          semester: rawSem,
        });
      }

      if (parsedStudents.length === 0) {
        return { success: false, error: 'ไม่พบข้อมูลคอลัมน์ชื่อนักเรียนในไฟล์ Excel กรุณาตรวจสอบหัวตาราง' };
      }

      return { success: true, data: parsedStudents };
    } catch (err: any) {
      return { success: false, error: err?.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel' };
    }
  },

  // บันทึกนำเข้ารายชื่อนักเรียนลงระบบ
  async importStudentsToRoster(
    students: Array<{
      studentNumber: string;
      studentName: string;
      gradeLevel: GradeLevel;
      room: string;
      academicYear: string;
      semester: string;
    }>,
    options: {
      teacherName?: string;
      targetAssignment?: Assignment;
      createSubmissions?: boolean;
      config?: GoogleSheetConfig;
    }
  ): Promise<{ success: boolean; count: number; message: string }> {
    if (!students || students.length === 0) {
      return { success: false, count: 0, message: 'ไม่มีข้อมูลนักเรียนที่จะนำเข้า' };
    }

    const currentRoster = this.getStudentRoster();
    const importedAt = new Date().toLocaleString('th-TH');

    // อัปเดต Roster ของห้อง
    const newRosterItems: StudentRosterItem[] = students.map((s, idx) => ({
      id: `ROSTER-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      studentNumber: s.studentNumber,
      studentName: s.studentName,
      gradeLevel: s.gradeLevel,
      room: s.room,
      academicYear: s.academicYear,
      semester: s.semester,
      importedAt,
      importedBy: options.teacherName || 'ครูผู้สอน',
    }));

    // รวมรายชื่อ
    const combinedRoster = [...currentRoster];
    newRosterItems.forEach(item => {
      const existingIdx = combinedRoster.findIndex(r => 
        r.studentName.toLowerCase() === item.studentName.toLowerCase() &&
        r.gradeLevel === item.gradeLevel &&
        r.room === item.room
      );
      if (existingIdx !== -1) {
        combinedRoster[existingIdx] = item;
      } else {
        combinedRoster.push(item);
      }
    });
    this.saveStudentRoster(combinedRoster);

    // หากเลือกสร้างรายการส่งงาน/ติดตามผลงานสำหรับใบงานที่เลือก
    let createdSubmissionsCount = 0;
    if (options.createSubmissions && options.targetAssignment) {
      const assignment = options.targetAssignment;
      const currentSubmissions = this.getSubmissions();

      students.forEach((s) => {
        // เช็คว่ามีรายการส่งงานนี้อยู่แล้วหรือไม่
        const exists = currentSubmissions.some(sub => 
          sub.assignmentId === assignment.id &&
          sub.studentName.toLowerCase() === s.studentName.toLowerCase() &&
          sub.gradeLevel === s.gradeLevel &&
          sub.room === s.room
        );

        if (!exists) {
          const newSub: Submission = {
            id: `SUB-IMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            studentName: s.studentName,
            studentNumber: s.studentNumber,
            gradeLevel: s.gradeLevel,
            room: s.room,
            submittedAt: importedAt,
            teacherName: assignment.teacherName,
            subjectCode: assignment.subjectCode,
            subjectName: assignment.subjectName,
            assignmentId: assignment.id,
            assignmentName: assignment.title,
            maxScore: assignment.maxScore,
            workType: assignment.workType || 'ใบงาน/แบบฝึกหัด',
            sampleUrl: assignment.sampleUrl,
            academicYear: s.academicYear || assignment.academicYear || '2567',
            semester: s.semester || assignment.semester || '1',
            workUrl: '',
            score: null,
            status: 'รอตรวจ',
          };
          currentSubmissions.push(newSub);
          createdSubmissionsCount++;
        }
      });

      this.saveSubmissions(currentSubmissions);

      // ซิงค์ไปยัง Google Sheet ถ้ามี scriptUrl
      if (options.config?.scriptUrl) {
        try {
          await fetch(options.config.scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'batchImportStudents',
              students,
              assignmentId: assignment.id,
              teacherName: options.teacherName,
            }),
          });
        } catch (err) {
          console.warn('Sync import to Google Sheet err:', err);
        }
      }
    }

    return {
      success: true,
      count: students.length,
      message: options.createSubmissions && options.targetAssignment
        ? `นำเข้ารายชื่อนักเรียนสำเร็จ ${students.length} คน พร้อมสร้างรายการติดตามงานสำหรับ "${options.targetAssignment.title}" (${createdSubmissionsCount} รายการใหม่) 🎉`
        : `บันทึกนำเข้ารายชื่อนักเรียนจำนวน ${students.length} คน เข้าสู่ระบบเรียบร้อยแล้ว ✨`,
    };
  }
};
