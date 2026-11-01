/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Submission, Teacher, Assignment, Subject, GoogleSheetConfig, GradeLevel } from '../types';
import { INITIAL_SUBMISSIONS, INITIAL_TEACHERS, INITIAL_ASSIGNMENTS, INITIAL_SUBJECTS, DEFAULT_SHEET_CONFIG } from '../constants';
import * as XLSX from 'xlsx';

const STORAGE_KEYS = {
  SUBMISSIONS: 'tha_bo_submissions_v2',
  TEACHERS: 'tha_bo_teachers_v2',
  ASSIGNMENTS: 'tha_bo_assignments_v2',
  SUBJECTS: 'tha_bo_subjects_v2',
  SHEET_CONFIG: 'tha_bo_sheet_config_v2',
  ACTIVE_TEACHER: 'tha_bo_active_teacher_v2',
};

export const storageService = {
  // --- SUBMISSIONS ---
  getSubmissions(): Submission[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(INITIAL_SUBMISSIONS));
        return INITIAL_SUBMISSIONS;
      }
      const list: Submission[] = JSON.parse(data);
      let updated = false;
      // Merge sample records that may be missing
      INITIAL_SUBMISSIONS.forEach(initSub => {
        const existing = list.find(s => s.id === initSub.id);
        if (!existing) {
          list.push(initSub);
          updated = true;
        } else if (!existing.aiEvaluation && initSub.aiEvaluation) {
          existing.aiEvaluation = initSub.aiEvaluation;
          updated = true;
        }
      });
      if (updated) {
        this.saveSubmissions(list);
      }
      return list;
    } catch {
      return INITIAL_SUBMISSIONS;
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

  async deleteSubmission(id: string, config?: GoogleSheetConfig): Promise<{ success: boolean; message: string }> {
    const list = this.getSubmissions();
    const updated = list.filter(s => s.id !== id);
    this.saveSubmissions(updated);

    if (config?.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deleteSubmission', id }),
        });
      } catch (err) {
        console.warn('Delete submission sync err:', err);
      }
    }

    return { success: true, message: 'ลบข้อมูลการส่งงานเรียบร้อยแล้ว' };
  },

  async deleteMultipleSubmissions(
    ids: string[], 
    config?: GoogleSheetConfig
  ): Promise<{ success: boolean; count: number; message: string }> {
    if (!ids || ids.length === 0) {
      return { success: true, count: 0, message: 'ไม่มีรายการที่ต้องลบ' };
    }
    const idSet = new Set(ids);
    const list = this.getSubmissions();
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
            ids: Array.from(idSet) 
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
          const formatted: Submission[] = submissions.map((row: any, i: number) => ({
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
          }));
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
    printWindow.document.close();
  }
};
