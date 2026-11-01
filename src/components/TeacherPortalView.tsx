/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  UserPlus, 
  LogIn, 
  LogOut, 
  Plus, 
  Trash2, 
  CheckSquare, 
  FileSpreadsheet, 
  FileDown, 
  BookOpen, 
  ExternalLink, 
  Save, 
  Edit3, 
  ShieldCheck, 
  GraduationCap, 
  Search, 
  Filter,
  Sparkles,
  Award,
  AlertCircle,
  Bot,
  CheckCircle,
  Wand2,
  Lightbulb,
  ThumbsUp,
  X,
  FileText,
  KeyRound,
  Square,
  Users
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Teacher, Assignment, Submission, AssignmentItem, Subject, GoogleSheetConfig, GradeLevel } from '../types';
import { DEPARTMENTS, GRADE_LEVELS, ROOMS, ACADEMIC_YEARS, SEMESTERS, WORK_TYPES } from '../constants';
import { storageService } from '../services/storageService';
import { alertService } from '../services/alertService';
import { aiEvaluationService, AiEvaluationResult } from '../services/aiEvaluationService';

interface Props {
  teachers: Teacher[];
  assignments: Assignment[];
  submissions: Submission[];
  sheetConfig: GoogleSheetConfig;
  onRefreshData: () => Promise<void>;
  onAssignmentsChange: () => void;
  onSubmissionsChange: () => void;
}

export default function TeacherPortalView({
  teachers,
  assignments,
  submissions,
  sheetConfig,
  onRefreshData,
  onAssignmentsChange,
  onSubmissionsChange,
}: Props) {
  // Authentication states
  const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(() => storageService.getActiveTeacher());
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regDepartment, setRegDepartment] = useState(DEPARTMENTS[0]);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Teacher dashboard sub-tab: 'grade' (ตรวจงาน), 'report' (รายงานรายห้องและคะแนน AI), 'students' (จัดการ/ลบข้อมูลนักเรียน), or 'assignments' (จัดการงาน)
  const [teacherTab, setTeacherTab] = useState<'grade' | 'report' | 'students' | 'assignments'>('grade');

  // Classroom Report States (รายงานการส่งงานรายห้อง พร้อมคะแนน AI)
  const [reportYear, setReportYear] = useState<string>('ALL');
  const [reportSemester, setReportSemester] = useState<string>('ALL');
  const [reportGrade, setReportGrade] = useState<string>('ม.1');
  const [reportRoom, setReportRoom] = useState<string>('1');
  const [reportSubject, setReportSubject] = useState<string>('ALL');
  const [reportAssignment, setReportAssignment] = useState<string>('ALL');
  const [reportStatus, setReportStatus] = useState<string>('ALL');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [selectedAiDetail, setSelectedAiDetail] = useState<Submission | null>(null);
  const [isBatchEvaluating, setIsBatchEvaluating] = useState<boolean>(false);
  const [selectedReportSubIds, setSelectedReportSubIds] = useState<string[]>([]);

  // Student Data & Deletion Management States (กรองปีการศึกษา ภาคเรียน ชั้น ห้อง ลบเป็นห้องหรือรายบุคคล)
  const [studentManageYear, setStudentManageYear] = useState<string>('ALL');
  const [studentManageSemester, setStudentManageSemester] = useState<string>('ALL');
  const [studentManageGrade, setStudentManageGrade] = useState<string>('ALL');
  const [studentManageRoom, setStudentManageRoom] = useState<string>('ALL');
  const [studentManageSubject, setStudentManageSubject] = useState<string>('ALL');
  const [studentManageSearch, setStudentManageSearch] = useState<string>('');
  const [selectedStudentManageIds, setSelectedStudentManageIds] = useState<string[]>([]);

  // Add Assignment form states
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [assignYear, setAssignYear] = useState('2567');
  const [assignSemester, setAssignSemester] = useState('1');
  const [assignmentItems, setAssignmentItems] = useState<AssignmentItem[]>([
    { 
      id: '1', 
      title: 'ใบงานที่ 1: ', 
      maxScore: 10,
      workType: 'ใบงาน/แบบฝึกหัด',
      sampleUrl: '',
      rubricCriteria: '',
    },
  ]);

  // Grading Filter states
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterSemester, setFilterSemester] = useState<string>('ALL');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [filterRoom, setFilterRoom] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [gradingSearch, setGradingSearch] = useState('');

  // Inline grading inputs: mapping submissionId -> { score, feedback }
  const [gradingScores, setGradingScores] = useState<Record<string, { score: string; feedback: string }>>({});

  // AI Evaluation modal states
  const [evaluatingSubId, setEvaluatingSubId] = useState<string | null>(null);
  const [activeAiModal, setActiveAiModal] = useState<{
    submission: Submission;
    result: AiEvaluationResult;
    editableScore: number;
    editableFeedback: string;
  } | null>(null);

  // Edit Assignment State
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Edit Student Info State
  const [editingStudentSub, setEditingStudentSub] = useState<{
    id: string;
    studentName: string;
    studentNumber: string;
    gradeLevel: GradeLevel;
    room: string;
    workUrl: string;
    assignmentName: string;
  } | null>(null);

  // Subject Management States
  const [subjects, setSubjects] = useState<Subject[]>(() => storageService.getSubjects());
  const [selectedSubjectSelect, setSelectedSubjectSelect] = useState<string>('');
  const [isManageSubjectsOpen, setIsManageSubjectsOpen] = useState(false);
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjName, setNewSubjName] = useState('');
  const [editingSubject, setEditingSubject] = useState<{ oldCode: string; code: string; name: string } | null>(null);

  // -------------------------------------------------------------
  // AUTHENTICATION HANDLERS
  // -------------------------------------------------------------
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regUsername.trim() || !regPassword.trim()) {
      alertService.error('กรุณากรอกข้อมูลให้ครบถ้วน', 'ต้องระบุชื่อ-สกุล, Username และ Password');
      return;
    }

    alertService.loading('กำลังลงทะเบียน...', 'ระบบกำลังบันทึกข้อมูลครูผู้สอน');
    const newTeacher: Teacher = {
      id: `T-${Date.now()}`,
      fullName: regFullName.trim(),
      department: regDepartment,
      username: regUsername.trim(),
      password: regPassword.trim(),
      createdAt: new Date().toLocaleString('th-TH'),
    };

    const res = await storageService.registerTeacher(newTeacher, sheetConfig);
    alertService.close();

    if (res.success) {
      await alertService.success('ลงทะเบียนสำเร็จ!', 'คุณสามารถเข้าสู่ระบบด้วย Username และ Password ที่สมัครได้ทันที');
      setLoginUsername(regUsername.trim());
      setLoginPassword('');
      setAuthMode('login');
      onRefreshData();
    } else {
      alertService.error('การลงทะเบียนไม่สำเร็จ', res.message);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const allTeachers = storageService.getTeachers();
    const found = allTeachers.find(
      t => t.username.toLowerCase() === loginUsername.trim().toLowerCase() && t.password === loginPassword
    );

    if (found) {
      setActiveTeacher(found);
      storageService.setActiveTeacher(found);
      alertService.success('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${found.fullName}`);
    } else {
      alertService.error(
        'เข้าสู่ระบบไม่สำเร็จ', 
        'Username หรือ Password ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง หรือกดปุ่ม "ลืม Username / Password?" ด้านล่าง'
      );
    }
  };

  // Handle Forgot Password / Username modal for teachers
  const handleForgotPassword = async () => {
    const allTeachers = storageService.getTeachers();
    const teacherOptionsHtml = allTeachers.length > 0
      ? allTeachers.map(t => `<option value="${t.id}">${t.fullName} (${t.department})</option>`).join('')
      : '<option value="">ไม่มีข้อมูลครูในระบบ</option>';

    const { value: formValues } = await Swal.fire({
      title: '🔑 ลืม Username หรือ Password? ✨',
      html: `
        <div class="space-y-3.5 text-left pt-2 font-['Kanit',sans-serif]">
          <div class="text-xs text-amber-900 leading-relaxed bg-amber-50 p-3 rounded-2xl border border-amber-200">
            <p class="font-bold flex items-center gap-1"><span>💡</span> <strong>คำแนะนำสำหรับคุณครู:</strong></p>
            <p class="mt-1">หากลืมชื่อผู้ใช้หรือรหัสผ่าน คุณครูสามารถส่งคำขอแจ้งไปยัง <strong>ผู้ดูแลระบบ (Admin)</strong> เพื่อทำการรีเซ็ตรหัสผ่านใหม่ให้ได้ทันที</p>
          </div>
          
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">👩‍🏫 1. เลือกชื่อของคุณครู</label>
            <select id="swal-forgot-select" class="w-full px-3 py-2.5 border border-purple-200 bg-white rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400">
              <option value="">-- เลือกชื่อของคุณครู --</option>
              ${teacherOptionsHtml}
            </select>
          </div>

          <div class="text-center text-xs text-gray-400 font-semibold">— หรือ —</div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">✍️ 2. หรือพิมพ์ชื่อ-นามสกุล / Username</label>
            <input 
              id="swal-forgot-input" 
              type="text" 
              placeholder="เช่น ครูชมัยพร ถินสำราญ" 
              class="w-full px-3 py-2.5 border border-purple-200 bg-purple-50/20 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div class="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
            <span>🛡️</span>
            <span>หลังส่งคำขอ ผู้ดูแลระบบ (Admin) สามารถตั้งรหัสใหม่ให้ท่านได้ที่เมนู "4. ตั้งค่าระบบ (Google Sheet)"</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '🚀 ส่งคำขอรีเซ็ตรหัสผ่าน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
        confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-xs',
        cancelButton: 'px-5 py-2.5 rounded-xl font-bold text-xs',
      },
      preConfirm: () => {
        const selectEl = document.getElementById('swal-forgot-select') as HTMLSelectElement;
        const inputEl = document.getElementById('swal-forgot-input') as HTMLInputElement;
        const selectedId = selectEl?.value;
        const typedQuery = inputEl?.value?.trim();

        if (!selectedId && !typedQuery) {
          Swal.showValidationMessage('กรุณาเลือกชื่อครู หรือพิมพ์ชื่อเพื่อส่งคำขอ');
          return false;
        }

        return { selectedId, typedQuery };
      }
    });

    if (formValues) {
      const identifier = formValues.selectedId || formValues.typedQuery;
      const res = await storageService.requestTeacherPasswordReset(identifier);
      if (res.success) {
        await onRefreshData();
        Swal.fire({
          icon: 'success',
          title: 'ส่งคำขอรีเซ็ตสำเร็จ! 🎉',
          html: `
            <div class="text-left text-xs text-gray-700 space-y-2 pt-2 font-['Kanit',sans-serif]">
              <p>ระบบได้ส่งคำขอรีเซ็ตรหัสผ่านของ <strong class="text-violet-700 font-bold">${res.teacherName || 'คุณครู'}</strong> ไปยัง <strong>ผู้ดูแลระบบ (Admin)</strong> เรียบร้อยแล้ว 🌸</p>
              <div class="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-amber-900 mt-2 space-y-1">
                <p class="font-bold">📋 คำแนะนำการรับรหัสใหม่:</p>
                <p>1. แจ้งผู้ดูแลระบบ (Admin) ให้เข้าสู่ระบบที่เมนู <strong>"4. ตั้งค่าระบบ (Google Sheet)"</strong></p>
                <p>2. ผู้ดูแลระบบสามารถกดปุ่ม <strong>"🔑 รีเซ็ต User/Pass"</strong> เพื่อกำหนดรหัสผ่านใหม่ให้คุณครูได้ทันที</p>
              </div>
            </div>
          `,
          confirmButtonText: 'รับทราบ ✨',
          confirmButtonColor: '#7C3AED',
          customClass: {
            popup: 'rounded-3xl font-[\'Kanit\',sans-serif] border border-purple-100 shadow-2xl',
            confirmButton: 'px-5 py-2.5 rounded-xl font-bold',
          },
        });
      } else {
        alertService.error('ไม่พบข้อมูล', res.message);
      }
    }
  };

  const handleLogout = () => {
    setActiveTeacher(null);
    storageService.setActiveTeacher(null);
    alertService.info('ออกจากระบบแล้ว', 'ขอบคุณที่ใช้งานระบบตรวจงานให้คะแนน ออนไลน์');
  };

  // -------------------------------------------------------------
  // SUBJECTS MANAGEMENT HANDLERS (จัดการรายวิชา)
  // -------------------------------------------------------------
  const refreshSubjects = () => {
    const list = storageService.getSubjects();
    setSubjects(list);
  };

  const handleSelectSubjectChange = (val: string) => {
    setSelectedSubjectSelect(val);
    if (val === '__MANAGE__') {
      setIsManageSubjectsOpen(true);
      return;
    }
    const found = subjects.find(s => s.code === val);
    if (found) {
      setSubjectCode(found.code);
      setSubjectName(found.name);
    } else {
      setSubjectCode('');
      setSubjectName('');
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjCode.trim() || !newSubjName.trim()) {
      alertService.error('กรุณากรอกข้อมูล', 'ต้องระบุรหัสวิชาและชื่อวิชาให้ครบถ้วน');
      return;
    }

    const res = await storageService.addSubject({
      code: newSubjCode.trim(),
      name: newSubjName.trim(),
      teacherName: activeTeacher?.fullName,
      academicYear: assignYear,
      semester: assignSemester,
    }, sheetConfig);

    if (res.success && res.subject) {
      refreshSubjects();
      setSubjectCode(res.subject.code);
      setSubjectName(res.subject.name);
      setSelectedSubjectSelect(res.subject.code);
      setNewSubjCode('');
      setNewSubjName('');
      alertService.success('เพิ่มรายวิชาสำเร็จ! 🎉', res.message);
    } else {
      alertService.error('ไม่สามารถเพิ่มวิชาได้', res.message);
    }
  };

  const handleSaveEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;

    if (!editingSubject.code.trim() || !editingSubject.name.trim()) {
      alertService.error('กรุณากรอกข้อมูลให้ครบถ้วน', 'รหัสวิชาและชื่อวิชาห้ามเว้นว่าง');
      return;
    }

    alertService.loading('กำลังบันทึกการแก้ไขวิชา...', 'กำลังอัปเดตข้อมูลวิชาในระบบและ Google Sheet');
    const res = await storageService.updateSubject(
      editingSubject.oldCode,
      { code: editingSubject.code.trim(), name: editingSubject.name.trim() },
      sheetConfig
    );
    alertService.close();

    if (res.success) {
      refreshSubjects();
      if (subjectCode === editingSubject.oldCode) {
        setSubjectCode(editingSubject.code.trim());
        setSubjectName(editingSubject.name.trim());
        setSelectedSubjectSelect(editingSubject.code.trim());
      }
      setEditingSubject(null);
      onAssignmentsChange();
      alertService.success('แก้ไขรายวิชาสำเร็จ! ✨', res.message);
    } else {
      alertService.error('เกิดข้อผิดพลาด', res.message);
    }
  };

  const handleDeleteSubject = async (code: string, name: string) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบรายวิชา?',
      html: `คุณต้องการลบรายวิชา <strong>"${code} ${name}"</strong> ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      }
    });

    if (result.isConfirmed) {
      const res = await storageService.deleteSubject(code, sheetConfig);
      if (res.success) {
        refreshSubjects();
        if (subjectCode === code) {
          setSubjectCode('');
          setSubjectName('');
          setSelectedSubjectSelect('');
        }
        alertService.success('ลบรายวิชาเรียบร้อย', res.message);
      } else {
        alertService.error('เกิดข้อผิดพลาด', res.message);
      }
    }
  };

  // -------------------------------------------------------------
  // ASSIGNMENTS MANAGEMENT HANDLERS
  // -------------------------------------------------------------
  const handleAddAssignmentItem = () => {
    const nextNumber = assignmentItems.length + 1;
    setAssignmentItems(prev => [
      ...prev,
      { 
        id: String(Date.now()), 
        title: `ใบงานที่ ${nextNumber}: `, 
        maxScore: 10,
        workType: 'ใบงาน/แบบฝึกหัด',
        sampleUrl: '',
        rubricCriteria: '',
      },
    ]);
  };

  const handleRemoveAssignmentItem = (index: number) => {
    if (assignmentItems.length <= 1) {
      alertService.info('ไม่สามารถลบได้', 'ต้องมีชิ้นงานอย่างน้อย 1 รายการ');
      return;
    }
    setAssignmentItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof AssignmentItem, val: any) => {
    setAssignmentItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectCode.trim() || !subjectName.trim()) {
      alertService.error('กรุณากรอกรหัสวิชาและชื่อวิชา');
      return;
    }

    const invalidItem = assignmentItems.find(item => !item.title.trim() || item.maxScore <= 0);
    if (invalidItem) {
      alertService.error('กรุณาระบุชื่องานและคะแนนเต็มให้ถูกต้อง', 'คะแนนเต็มต้องมากกว่า 0');
      return;
    }

    alertService.loading('กำลังบันทึกงานใหม่...', 'กำลังบันทึกลงฐานข้อมูลและ Google Sheet');
    const newAssignments: Assignment[] = assignmentItems.map(item => ({
      id: `A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      teacherName: activeTeacher?.fullName || 'ครูผู้สอน',
      subjectCode: subjectCode.trim(),
      subjectName: subjectName.trim(),
      title: item.title.trim(),
      maxScore: Number(item.maxScore),
      workType: item.workType || 'ใบงาน/แบบฝึกหัด',
      sampleUrl: item.sampleUrl?.trim() || undefined,
      rubricCriteria: item.rubricCriteria?.trim() || undefined,
      academicYear: assignYear,
      semester: assignSemester,
      createdAt: new Date().toLocaleString('th-TH'),
    }));

    await storageService.addAssignments(newAssignments, sheetConfig);
    alertService.close();
    await alertService.success('บันทึกข้อมูลงานสำเร็จ!', `เพิ่มงานจำนวน ${newAssignments.length} ชิ้นงาน (ปีการศึกษา ${assignYear} เทอม ${assignSemester}) เรียบร้อยแล้ว`);

    // Reset items
    setAssignmentItems([
      { 
        id: '1', 
        title: 'ใบงานที่ 1: ', 
        maxScore: 10,
        workType: 'ใบงาน/แบบฝึกหัด',
        sampleUrl: '',
        rubricCriteria: '',
      }
    ]);
    onAssignmentsChange();
  };

  // -------------------------------------------------------------
  // AI EVALUATION HANDLERS
  // -------------------------------------------------------------
  const handleAiEvaluate = async (sub: Submission) => {
    try {
      setEvaluatingSubId(sub.id);
      alertService.loading('🤖 AI กำลังประเมินผลงาน...', `วิเคราะห์ผลงานตามชนิดงาน "${sub.workType || 'ใบงาน/แบบฝึกหัด'}" พร้อมสรุปจุดเด่นและคำแนะนำ`);

      const result = await aiEvaluationService.evaluateSubmission({
        assignmentTitle: sub.assignmentName,
        workType: sub.workType,
        maxScore: sub.maxScore,
        sampleUrl: sub.sampleUrl,
        studentName: sub.studentName,
        workUrl: sub.workUrl,
        studentNumber: sub.studentNumber,
        gradeLevel: sub.gradeLevel,
        room: sub.room,
      });

      // Save AI evaluation to submission record permanently
      await storageService.saveAiEvaluation(sub.id, result);
      onSubmissionsChange();

      alertService.close();

      setActiveAiModal({
        submission: { ...sub, aiEvaluation: result },
        result,
        editableScore: result.suggestedScore,
        editableFeedback: result.feedback,
      });
    } catch (err: any) {
      alertService.close();
      alertService.error('การประเมินด้วย AI ขัดข้อง', err?.message || 'ระบบไม่สามารถประเมินได้ในขณะนี้');
    } finally {
      setEvaluatingSubId(null);
    }
  };

  const handleApplyAiEvaluation = async (subId: string, score: number, feedback: string) => {
    setGradingScores(prev => ({
      ...prev,
      [subId]: {
        score: String(score),
        feedback,
      },
    }));

    if (activeAiModal?.result) {
      await storageService.saveAiEvaluation(subId, activeAiModal.result);
      onSubmissionsChange();
    }

    setActiveAiModal(null);
    alertService.success('นำคะแนนและคำแนะนำเข้าสู่ระบบแล้ว!', 'ระบบกรอกคะแนนและข้อเสนอแนะลงในช่องตรวจของนักเรียนแล้ว สามารถกด "บันทึกคะแนน" เพื่อบันทึกได้ทันที ✨');
  };

  const handleOpenEditAssignment = (assignment: Assignment) => {
    setEditingAssignment({ ...assignment });
  };

  const handleSaveEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;

    if (!editingAssignment.subjectCode.trim() || !editingAssignment.subjectName.trim() || !editingAssignment.title.trim()) {
      alertService.error('กรุณากรอกข้อมูลให้ครบถ้วน', 'รหัสวิชา, ชื่อวิชา และชื่อใบงานห้ามเว้นว่าง');
      return;
    }

    if (Number(editingAssignment.maxScore) <= 0) {
      alertService.error('คะแนนเต็มไม่ถูกต้อง', 'คะแนนเต็มต้องมากกว่า 0');
      return;
    }

    alertService.loading('กำลังบันทึกการแก้ไข...', 'ระบบกำลังบันทึกและอัปเดตข้อมูลลงฐานข้อมูลและ Google Sheet อัตโนมัติ');
    const res = await storageService.updateAssignment({
      ...editingAssignment,
      subjectCode: editingAssignment.subjectCode.trim(),
      subjectName: editingAssignment.subjectName.trim(),
      title: editingAssignment.title.trim(),
      maxScore: Number(editingAssignment.maxScore),
      sampleUrl: editingAssignment.sampleUrl?.trim() || undefined,
    }, sheetConfig);

    alertService.close();

    if (res.success) {
      setEditingAssignment(null);
      onAssignmentsChange();
      await alertService.success('ปรับปรุงข้อมูลสำเร็จ! 🎉', `อัปเดตวิชา "${editingAssignment.subjectName}" และชื่องาน "${editingAssignment.title}" เรียบร้อยแล้ว`);
    } else {
      alertService.error('เกิดข้อผิดพลาด', res.message);
    }
  };

  const handleDeleteAssignment = async (id: string, title: string) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบงาน?',
      text: `คุณต้องการลบงาน "${title}" ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      }
    });

    if (result.isConfirmed) {
      await storageService.deleteAssignment(id, sheetConfig);
      onAssignmentsChange();
      alertService.success('ลบงานเรียบร้อย', `ลบงาน "${title}" เรียบร้อยแล้ว`);
    }
  };

  // -------------------------------------------------------------
  // STUDENT SUBMISSION MANAGEMENT (แก้ไขข้อมูลนักเรียน / ลบชื่อนักเรียน)
  // -------------------------------------------------------------
  const handleOpenEditStudent = (sub: Submission) => {
    setEditingStudentSub({
      id: sub.id,
      studentName: sub.studentName,
      studentNumber: sub.studentNumber,
      gradeLevel: sub.gradeLevel,
      room: sub.room,
      workUrl: sub.workUrl || '',
      assignmentName: sub.assignmentName,
    });
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentSub) return;

    if (!editingStudentSub.studentName.trim()) {
      alertService.error('กรุณาระบุชื่อ-นามสกุล', 'ชื่อนักเรียนห้ามเว้นว่าง');
      return;
    }
    if (!editingStudentSub.studentNumber.trim()) {
      alertService.error('กรุณาระบุเลขที่', 'เลขที่นักเรียนห้ามเว้นว่าง');
      return;
    }

    alertService.loading('กำลังบันทึกข้อมูล...', 'ระบบกำลังบันทึกการแก้ไขข้อมูลนักเรียน');
    const res = await storageService.updateSubmissionStudent(
      editingStudentSub.id,
      {
        studentName: editingStudentSub.studentName.trim(),
        studentNumber: editingStudentSub.studentNumber.trim(),
        gradeLevel: editingStudentSub.gradeLevel,
        room: editingStudentSub.room,
        workUrl: editingStudentSub.workUrl.trim(),
      },
      sheetConfig
    );
    alertService.close();

    if (res.success) {
      setEditingStudentSub(null);
      onSubmissionsChange();
      await alertService.success('แก้ไขข้อมูลสำเร็จ! 🎉', `อัปเดตข้อมูลของ "${editingStudentSub.studentName}" เรียบร้อยแล้ว`);
    } else {
      alertService.error('เกิดข้อผิดพลาด', res.message);
    }
  };

  const handleDeleteStudentSubmission = async (sub: Submission) => {
    const result = await Swal.fire({
      title: '🗑️ ยืนยันการลบชื่อนักเรียนและงาน?',
      html: `
        <div class="text-left text-xs space-y-2">
          <p class="font-bold text-gray-800">คุณต้องการลบรายชื่อนักเรียนและผลงานนี้ออกจากระบบใช่หรือไม่?</p>
          <div class="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-1">
            <p class="text-violet-900 font-bold">🧑‍🎓 ${sub.studentName} (เลขที่ ${sub.studentNumber} ห้อง ${sub.gradeLevel}/${sub.room})</p>
            <p class="text-gray-600">📝 งาน: ${sub.assignmentName} (${sub.subjectCode})</p>
            <p class="text-gray-500">📅 ส่งเมื่อ: ${sub.submittedAt}</p>
          </div>
          <p class="text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
            ⚠️ การลบนี้จะนำชื่อและผลงานชิ้นนี้ออกจากตารางตรวจและรายงานอย่างถาวร
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      }
    });

    if (result.isConfirmed) {
      alertService.loading('กำลังลบข้อมูล...', 'ระบบกำลังลบข้อมูลการส่งงานของนักเรียน');
      await storageService.deleteSubmission(sub.id, sheetConfig);
      onSubmissionsChange();
      alertService.close();
      alertService.success('ลบข้อมูลเรียบร้อยแล้ว', `ลบข้อมูลของ "${sub.studentName}" ออกจากระบบแล้ว`);
    }
  };

  // ลบข้อมูลนักเรียนทั้งห้อง (Delete by Classroom/Room)
  const handleDeleteByRoom = async (targetGrade: string, targetRoom: string, targetYear?: string, targetSemester?: string) => {
    if (!targetGrade || targetGrade === 'ALL' || !targetRoom || targetRoom === 'ALL') {
      alertService.error('กรุณาระบุชั้นและห้อง', 'กรุณาเลือกระดับชั้นและห้องเรียนที่ต้องการลบ เช่น ชั้น ม.1 ห้อง 1');
      return;
    }

    const targets = submissions.filter(s => {
      const matchTeacher = !activeTeacher || s.teacherName === activeTeacher.fullName || s.teacherName.includes(activeTeacher.fullName);
      const matchGrade = s.gradeLevel === targetGrade;
      const matchRoom = s.room === targetRoom;
      const matchYear = !targetYear || targetYear === 'ALL' || (s.academicYear || '2567') === targetYear;
      const matchSem = !targetSemester || targetSemester === 'ALL' || (s.semester || '1') === targetSemester;
      return matchTeacher && matchGrade && matchRoom && matchYear && matchSem;
    });

    if (targets.length === 0) {
      alertService.info(
        'ไม่พบข้อมูลนักเรียนในห้องนี้', 
        `ไม่มีรายการส่งงานของนักเรียนในชั้น ${targetGrade}/${targetRoom} ตามปีการศึกษาและภาคเรียนที่เลือก`
      );
      return;
    }

    const yearLabel = targetYear && targetYear !== 'ALL' ? `ปีการศึกษา ${targetYear}` : 'ทุกปีการศึกษา';
    const semLabel = targetSemester && targetSemester !== 'ALL' ? `ภาคเรียนที่ ${targetSemester}` : 'ทุกภาคเรียน';

    const result = await Swal.fire({
      title: `🚨 ยืนยันลบข้อมูลนักเรียนทั้งห้อง!`,
      html: `
        <div class="text-left text-xs space-y-3 font-['Kanit',sans-serif]">
          <p class="font-bold text-gray-800 text-sm">
            คุณกำลังจะลบข้อมูลการส่งงานของนักเรียน <span class="text-rose-600 font-black">ทั้งห้อง</span>
          </p>
          <div class="p-3.5 bg-rose-50/90 rounded-2xl border border-rose-200 space-y-1.5 text-rose-950">
            <p>🏫 <b>ห้องเรียน:</b> ชั้น ${targetGrade} ห้อง ${targetRoom}</p>
            <p>📅 <b>เงื่อนไข:</b> ${yearLabel} • ${semLabel}</p>
            <p>👥 <b>จำนวนที่จะถูกลบ:</b> <span class="font-black text-rose-700 text-sm">${targets.length}</span> รายการ</p>
          </div>
          <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
            ⚠️ <b>คำเตือน:</b> การดำเนินการนี้จะลบรายชื่อนักเรียน งานที่ส่ง คะแนน และผลการประเมินของห้องนี้ออกอย่างถาวรทั้งในระบบและ Google Sheet ไม่สามารถกู้คืนได้
          </div>
          <p class="text-gray-500 text-[11px]">พิมพ์ข้อความ <b>"ยืนยันลบ"</b> ในช่องด้านล่างเพื่อยืนยัน:</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'พิมพ์ ยืนยันลบ',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `🗑️ ยืนยันลบทั้งห้อง (${targets.length} รายการ)`,
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      },
      inputValidator: (value) => {
        if (!value || value.trim() !== 'ยืนยันลบ') {
          return 'กรุณาพิมพ์ "ยืนยันลบ" ให้ถูกต้องก่อนกดยืนยัน';
        }
      }
    });

    if (result.isConfirmed) {
      alertService.loading('กำลังลบข้อมูลทั้งห้อง...', `ระบบกำลังลบข้อมูลของห้อง ${targetGrade}/${targetRoom} จำนวน ${targets.length} รายการ`);
      const targetIds = targets.map(t => t.id);
      const res = await storageService.deleteMultipleSubmissions(targetIds, sheetConfig);
      setSelectedStudentManageIds(prev => prev.filter(id => !targetIds.includes(id)));
      setSelectedReportSubIds(prev => prev.filter(id => !targetIds.includes(id)));
      onSubmissionsChange();
      await onRefreshData();
      alertService.close();

      if (res.success) {
        await alertService.success('ลบข้อมูลทั้งห้องสำเร็จ!', `ลบข้อมูลห้อง ${targetGrade}/${targetRoom} จำนวน ${res.count} รายการเรียบร้อยแล้ว`);
      } else {
        alertService.error('เกิดข้อผิดพลาดในการลบ', res.message);
      }
    }
  };

  // ลบข้อมูลนักเรียนรายบุคคลที่เลือก (Delete Selected Individuals)
  const handleDeleteSelectedStudents = async (idsToDelete: string[]) => {
    if (!idsToDelete || idsToDelete.length === 0) {
      alertService.info('ยังไม่ได้เลือกนักเรียน', 'กรุณาติ๊กเลือกนักเรียนที่ต้องการลบในตารางอย่างน้อย 1 คน');
      return;
    }

    const selectedSubs = submissions.filter(s => idsToDelete.includes(s.id));
    const sampleNames = selectedSubs.slice(0, 4).map(s => `• ${s.studentName} (เลขที่ ${s.studentNumber} ห้อง ${s.gradeLevel}/${s.room})`).join('<br/>');
    const remainingCount = selectedSubs.length - 4;
    const moreText = remainingCount > 0 ? `<br/><span class="text-gray-400">...และอีก ${remainingCount} คน</span>` : '';

    const result = await Swal.fire({
      title: `🗑️ ยืนยันลบนักเรียนที่เลือก?`,
      html: `
        <div class="text-left text-xs space-y-2.5 font-['Kanit',sans-serif]">
          <p class="font-bold text-gray-800 text-sm">
            คุณต้องการลบข้อมูลนักเรียนที่เลือกจำนวน <span class="text-rose-600 font-black">${idsToDelete.length}</span> คน ใช่หรือไม่?
          </p>
          <div class="p-3 bg-purple-50/80 rounded-2xl border border-purple-200 text-gray-700 space-y-1">
            <p class="text-[11px] font-bold text-violet-900 mb-1">รายชื่อตัวอย่างที่เลือก:</p>
            <div class="text-xs text-gray-800 pl-1 leading-relaxed">${sampleNames}${moreText}</div>
          </div>
          <div class="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px]">
            ⚠️ ข้อมูลการส่งงานและคะแนนของนักเรียนที่เลือกจะถูกลบออกจากระบบและ Google Sheet อย่างถาวร
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `🗑️ ยืนยันลบ (${idsToDelete.length} รายการ)`,
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      }
    });

    if (result.isConfirmed) {
      alertService.loading('กำลังลบข้อมูลที่เลือก...', `กำลังลบข้อมูลนักเรียนจำนวน ${idsToDelete.length} รายการ`);
      const res = await storageService.deleteMultipleSubmissions(idsToDelete, sheetConfig);
      setSelectedStudentManageIds(prev => prev.filter(id => !idsToDelete.includes(id)));
      setSelectedReportSubIds(prev => prev.filter(id => !idsToDelete.includes(id)));
      onSubmissionsChange();
      await onRefreshData();
      alertService.close();

      if (res.success) {
        await alertService.success('ลบข้อมูลสำเร็จ!', `ลบข้อมูลนักเรียนจำนวน ${res.count} คนเรียบร้อยแล้ว`);
      } else {
        alertService.error('เกิดข้อผิดพลาดในการลบ', res.message);
      }
    }
  };

  // -------------------------------------------------------------
  // GRADING HANDLERS
  // -------------------------------------------------------------
  // Filter submissions for this teacher (or all submissions with filters)
  const teacherSubmissions = React.useMemo(() => {
    return submissions.filter(s => {
      // If logged in, teacher can view their own submissions or all
      const matchTeacher = !activeTeacher || s.teacherName === activeTeacher.fullName || s.teacherName.includes(activeTeacher.fullName);
      const matchYear = filterYear === 'ALL' || (s.academicYear || '2567') === filterYear;
      const matchSemester = filterSemester === 'ALL' || (s.semester || '1') === filterSemester;
      const matchSubject = filterSubject === 'ALL' || s.subjectCode === filterSubject;
      const matchGrade = filterGrade === 'ALL' || s.gradeLevel === filterGrade;
      const matchRoom = filterRoom === 'ALL' || s.room === filterRoom;
      const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
      
      const q = gradingSearch.trim().toLowerCase();
      const matchQuery = !q || (
        s.studentName.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        s.assignmentName.toLowerCase().includes(q)
      );

      return matchTeacher && matchYear && matchSemester && matchSubject && matchGrade && matchRoom && matchStatus && matchQuery;
    });
  }, [submissions, activeTeacher, filterYear, filterSemester, filterSubject, filterGrade, filterRoom, filterStatus, gradingSearch]);

  // Unique subjects taught by teacher
  const teacherSubjects = React.useMemo(() => {
    const unique = new Map<string, string>();
    assignments
      .filter(a => !activeTeacher || a.teacherName === activeTeacher.fullName)
      .forEach(a => unique.set(a.subjectCode, `${a.subjectCode} ${a.subjectName}`));
    return Array.from(unique.entries());
  }, [assignments, activeTeacher]);

  const handleScoreInputChange = (id: string, scoreVal: string) => {
    setGradingScores(prev => ({
      ...prev,
      [id]: {
        score: scoreVal,
        feedback: prev[id]?.feedback ?? (submissions.find(s => s.id === id)?.feedback || ''),
      },
    }));
  };

  const handleFeedbackInputChange = (id: string, feedbackVal: string) => {
    setGradingScores(prev => ({
      ...prev,
      [id]: {
        score: prev[id]?.score ?? (submissions.find(s => s.id === id)?.score?.toString() || ''),
        feedback: feedbackVal,
      },
    }));
  };

  const handleSaveGrade = async (sub: Submission) => {
    const currentInput = gradingScores[sub.id];
    const scoreNum = currentInput?.score !== undefined && currentInput.score !== '' 
      ? Number(currentInput.score) 
      : sub.score;

    if (scoreNum === null || scoreNum === undefined || isNaN(scoreNum)) {
      alertService.error('กรุณาระบุคะแนนที่ถูกต้อง', 'คะแนนต้องเป็นตัวเลข');
      return;
    }

    if (scoreNum < 0 || scoreNum > sub.maxScore) {
      alertService.error(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${sub.maxScore}`, `คะแนนเต็มของงานนี้คือ ${sub.maxScore} คะแนน`);
      return;
    }

    const feedback = currentInput?.feedback !== undefined ? currentInput.feedback : (sub.feedback || '');

    alertService.loading('กำลังบันทึกคะแนน...', 'ระบบกำลังบันทึกคะแนนลง Google Sheet');
    await storageService.gradeSubmission(
      sub.id,
      scoreNum,
      feedback,
      activeTeacher?.fullName || 'ครูผู้สอน',
      sheetConfig
    );
    alertService.close();

    await alertService.success(
      'บันทึกคะแนนสำเร็จ!',
      `บันทึกคะแนน ${scoreNum}/${sub.maxScore} ให้แก่ ${sub.studentName} เรียบร้อยแล้ว`
    );
    onSubmissionsChange();
  };

  const handleExportExcel = () => {
    if (teacherSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับการส่งออก', 'กรุณาตรวจสอบตัวกรองข้อมูล หรือยังไม่มีนักเรียนส่งงาน');
      return;
    }
    const yearText = filterYear !== 'ALL' ? `_ปี${filterYear}` : '';
    const semText = filterSemester !== 'ALL' ? `_เทอม${filterSemester}` : '';
    const classText = filterGrade !== 'ALL' ? `_${filterGrade}` : '';
    const roomText = filterRoom !== 'ALL' ? `_ห้อง${filterRoom}` : '';
    const subjectText = filterSubject !== 'ALL' ? `_${filterSubject}` : '';

    storageService.exportToExcel(
      teacherSubmissions,
      `ผลคะแนน_${activeTeacher?.fullName || 'ครูผู้สอน'}${subjectText}${classText}${roomText}${yearText}${semText}`
    );
    alertService.success('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว', `ส่งออกข้อมูลตามเงื่อนไขที่กรองจำนวน ${teacherSubmissions.length} รายการ`);
  };

  const handleExportPdf = () => {
    if (teacherSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับการส่งออก', 'กรุณาตรวจสอบตัวกรองข้อมูล หรือยังไม่มีนักเรียนส่งงาน');
      return;
    }
    const filterParts = [];
    if (filterYear !== 'ALL') filterParts.push(`ปีการศึกษา ${filterYear}`);
    if (filterSemester !== 'ALL') filterParts.push(`ภาคเรียนที่ ${filterSemester}`);
    if (filterSubject !== 'ALL') filterParts.push(`วิชา ${filterSubject}`);
    if (filterGrade !== 'ALL') filterParts.push(`ระดับชั้น ${filterGrade}`);
    if (filterRoom !== 'ALL') filterParts.push(`ห้อง ${filterRoom}`);
    if (filterStatus !== 'ALL') filterParts.push(`สถานะ: ${filterStatus}`);
    const filterSummary = filterParts.length > 0 ? filterParts.join(' • ') : 'ข้อมูลทั้งหมด';

    storageService.exportToPdf(
      teacherSubmissions,
      `รายงานผลการตรวจงานและคะแนน - ${activeTeacher?.fullName || 'ครูผู้สอน'}`,
      filterSummary
    );
  };

  // -------------------------------------------------------------
  // CLASSROOM REPORT COMPUTATIONS & HANDLERS (รายงานรายห้อง และ คะแนน AI)
  // -------------------------------------------------------------
  // Submissions filtered specifically for the selected classroom (room & grade)
  const roomSubmissions = React.useMemo(() => {
    return submissions
      .filter(s => {
        const matchTeacher = !activeTeacher || s.teacherName === activeTeacher.fullName || s.teacherName.includes(activeTeacher.fullName);
        const matchYear = reportYear === 'ALL' || (s.academicYear || '2567') === reportYear;
        const matchSemester = reportSemester === 'ALL' || (s.semester || '1') === reportSemester;
        const matchGrade = s.gradeLevel === reportGrade;
        const matchRoom = s.room === reportRoom;
        const matchSubject = reportSubject === 'ALL' || s.subjectCode === reportSubject;
        const matchAssignment = reportAssignment === 'ALL' || s.assignmentId === reportAssignment || s.assignmentName === reportAssignment;
        const matchStatus = reportStatus === 'ALL' || s.status === reportStatus;
        const q = reportSearch.trim().toLowerCase();
        const matchQuery = !q || (
          s.studentName.toLowerCase().includes(q) ||
          s.studentNumber.toLowerCase().includes(q) ||
          s.assignmentName.toLowerCase().includes(q)
        );
        return matchTeacher && matchYear && matchSemester && matchGrade && matchRoom && matchSubject && matchAssignment && matchStatus && matchQuery;
      })
      .sort((a, b) => {
        const numA = parseInt(a.studentNumber, 10);
        const numB = parseInt(b.studentNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.studentNumber.localeCompare(b.studentNumber);
      });
  }, [submissions, activeTeacher, reportYear, reportSemester, reportGrade, reportRoom, reportSubject, reportAssignment, reportStatus, reportSearch]);

  // Statistics for selected classroom
  const roomStats = React.useMemo(() => {
    const total = roomSubmissions.length;
    const aiEvaluated = roomSubmissions.filter(s => s.aiEvaluation && s.aiEvaluation.suggestedScore !== undefined).length;
    const teacherGraded = roomSubmissions.filter(s => s.status === 'ตรวจแล้ว' && s.score !== null && s.score !== undefined).length;
    
    const aiScores = roomSubmissions
      .filter(s => s.aiEvaluation?.suggestedScore !== undefined)
      .map(s => s.aiEvaluation!.suggestedScore);
    const avgAiScore = aiScores.length > 0
      ? (aiScores.reduce((acc, curr) => acc + curr, 0) / aiScores.length).toFixed(1)
      : '-';

    const teacherScores = roomSubmissions
      .filter(s => s.score !== null && s.score !== undefined)
      .map(s => s.score as number);
    const avgTeacherScore = teacherScores.length > 0
      ? (teacherScores.reduce((acc, curr) => acc + curr, 0) / teacherScores.length).toFixed(1)
      : '-';

    return { total, aiEvaluated, teacherGraded, avgAiScore, avgTeacherScore };
  }, [roomSubmissions]);

  // Submissions filtered for Student Data & Deletion Management tab
  const manageStudentSubmissions = React.useMemo(() => {
    return submissions
      .filter(s => {
        const matchTeacher = !activeTeacher || s.teacherName === activeTeacher.fullName || s.teacherName.includes(activeTeacher.fullName);
        const matchYear = studentManageYear === 'ALL' || (s.academicYear || '2567') === studentManageYear;
        const matchSemester = studentManageSemester === 'ALL' || (s.semester || '1') === studentManageSemester;
        const matchGrade = studentManageGrade === 'ALL' || s.gradeLevel === studentManageGrade;
        const matchRoom = studentManageRoom === 'ALL' || s.room === studentManageRoom;
        const matchSubject = studentManageSubject === 'ALL' || s.subjectCode === studentManageSubject;
        const q = studentManageSearch.trim().toLowerCase();
        const matchQuery = !q || (
          s.studentName.toLowerCase().includes(q) ||
          s.studentNumber.toLowerCase().includes(q) ||
          s.assignmentName.toLowerCase().includes(q) ||
          s.subjectCode.toLowerCase().includes(q) ||
          s.subjectName.toLowerCase().includes(q)
        );
        return matchTeacher && matchYear && matchSemester && matchGrade && matchRoom && matchSubject && matchQuery;
      })
      .sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) {
          return a.gradeLevel.localeCompare(b.gradeLevel);
        }
        const roomA = parseInt(a.room, 10) || 0;
        const roomB = parseInt(b.room, 10) || 0;
        if (roomA !== roomB) return roomA - roomB;
        const numA = parseInt(a.studentNumber, 10);
        const numB = parseInt(b.studentNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.studentNumber.localeCompare(b.studentNumber);
      });
  }, [submissions, activeTeacher, studentManageYear, studentManageSemester, studentManageGrade, studentManageRoom, studentManageSubject, studentManageSearch]);

  // Batch AI Evaluation for all unevaluated or all works in this classroom
  const handleBatchAiEvaluateRoom = async () => {
    const pending = roomSubmissions.filter(s => !s.aiEvaluation || s.aiEvaluation.suggestedScore === undefined);
    const targets = pending.length > 0 ? pending : roomSubmissions;

    if (targets.length === 0) {
      alertService.info('ไม่มีผลงานที่ต้องประเมิน', `ในห้อง ${reportGrade}/${reportRoom} ยังไม่มีนักเรียนส่งงาน`);
      return;
    }

    const confirm = await Swal.fire({
      title: '🤖 ให้ AI ตรวจประเมินทั้งห้อง?',
      html: `
        <div class="text-left text-sm space-y-2">
          <p class="font-medium text-gray-800">ระบบจะทำการวิเคราะห์และให้คะแนนผลงานของนักเรียนห้อง <b>${reportGrade}/${reportRoom}</b></p>
          <p class="text-xs text-gray-500">จำนวนที่ตรวจรอบนี้: <b class="text-violet-700">${targets.length}</b> ชิ้นงาน</p>
          <p class="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            💡 AI จะตรวจตามรูบริก ชนิดของงาน พร้อมประเมินจุดเด่นและข้อเสนอแนะรายบุคคลให้อัตโนมัติ
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 เริ่มให้ AI ตรวจประเมิน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
      }
    });

    if (!confirm.isConfirmed) return;

    setIsBatchEvaluating(true);
    let successCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const sub = targets[i];
      alertService.loading(
        `🤖 กำลังประเมินผลงาน ${i + 1}/${targets.length}`,
        `นักเรียน: ${sub.studentName} (เลขที่ ${sub.studentNumber}) • ชื่องาน: ${sub.assignmentName}`
      );

      try {
        const result = await aiEvaluationService.evaluateSubmission({
          assignmentTitle: sub.assignmentName,
          workType: sub.workType,
          maxScore: sub.maxScore,
          sampleUrl: sub.sampleUrl,
          studentName: sub.studentName,
          workUrl: sub.workUrl,
          studentNumber: sub.studentNumber,
          gradeLevel: sub.gradeLevel,
          room: sub.room,
        });

        await storageService.saveAiEvaluation(sub.id, result);
        successCount++;
      } catch (err) {
        console.warn(`Error evaluating ${sub.id}:`, err);
      }
    }

    setIsBatchEvaluating(false);
    alertService.close();
    onSubmissionsChange();

    await Swal.fire({
      title: '✨ AI ประเมินทั้งห้องเสร็จสิ้น!',
      html: `
        <div class="text-sm space-y-2">
          <p>ประเมินและให้คะแนนสำเร็จ <b>${successCount}</b> จาก ${targets.length} ชิ้นงาน</p>
          <p class="text-xs text-gray-600">คะแนนและข้อเสนอแนะถูกบันทึกลงในระบบเรียบร้อย สามารถส่งออกรายงานหรือกด "ใช้คะแนน AI" เพื่อบันทึกเป็นคะแนนทางการได้ทันที</p>
        </div>
      `,
      icon: 'success',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#10B981',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
      }
    });
  };

  // Quick apply all AI suggested scores to teacher inputs for this room
  const handleApplyAllAiScoresToGrading = () => {
    if (roomSubmissions.length === 0) return;
    let appliedCount = 0;
    const updates: Record<string, { score: string; feedback: string }> = {};

    roomSubmissions.forEach(sub => {
      if (sub.aiEvaluation && sub.aiEvaluation.suggestedScore !== undefined) {
        updates[sub.id] = {
          score: String(sub.aiEvaluation.suggestedScore),
          feedback: sub.aiEvaluation.feedback || sub.feedback || '',
        };
        appliedCount++;
      }
    });

    if (appliedCount === 0) {
      alertService.info('ยังไม่มีผลคะแนน AI ในห้องนี้', 'กรุณากดปุ่ม "🤖 ให้ AI ตรวจงานทั้งห้อง" ก่อน');
      return;
    }

    setGradingScores(prev => ({
      ...prev,
      ...updates,
    }));

    alertService.success(
      'ดึงคะแนน AI เรียบร้อย!',
      `นำคะแนนและข้อเสนอแนะจาก AI มาใส่ช่องคะแนนครูของนักเรียนจำนวน ${appliedCount} คนแล้ว คุณครูสามารถตรวจสอบและกด "บันทึกคะแนน" ได้ทันที`
    );
  };

  // Export room report to Excel
  const handleExportClassroomExcel = () => {
    if (roomSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับการส่งออก', `ไม่พบรายการส่งงานของห้อง ${reportGrade}/${reportRoom}`);
      return;
    }
    const subjPart = reportSubject !== 'ALL' ? `_${reportSubject}` : '';
    const fileName = `รายงานส่งงานและคะแนนAI_ชั้น${reportGrade}_ห้อง${reportRoom}${subjPart}_${activeTeacher?.fullName || 'ครูผู้สอน'}`;
    storageService.exportToExcel(roomSubmissions, fileName);
    alertService.success('ส่งออก Excel เรียบร้อยแล้ว', `ดาวน์โหลดรายงานห้อง ${reportGrade}/${reportRoom} จำนวน ${roomSubmissions.length} รายการ (พร้อมคอลัมน์คะแนน AI)`);
  };

  // Export room report to PDF
  const handleExportClassroomPdf = () => {
    if (roomSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับการส่งออก', `ไม่พบรายการส่งงานของห้อง ${reportGrade}/${reportRoom}`);
      return;
    }
    const subjName = reportSubject !== 'ALL' ? `วิชา ${reportSubject}` : 'ทุกรายวิชา';
    storageService.exportToPdf(
      roomSubmissions,
      `รายงานการส่งงานและคะแนนประเมินด้วย AI - ชั้น ${reportGrade}/${reportRoom}`,
      `โรงเรียนท่าบ่อ • ${subjName} • ครูผู้สอน: ${activeTeacher?.fullName || 'ครูผู้สอน'} • ข้อมูล ณ วันที่ ${new Date().toLocaleDateString('th-TH')}`
    );
  };

  // -------------------------------------------------------------
  // RENDER: NOT LOGGED IN (REGISTER / LOGIN SCREENS)
  // -------------------------------------------------------------
  if (!activeTeacher) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-white/95 via-purple-50/60 to-pink-50/60 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/40 border border-purple-100/80 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-pink-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200 text-3xl">
            👩‍🏫
          </div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <span>ระบบสำหรับครูผู้สอน</span>
            <span>✨</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            โรงเรียนท่าบ่อ สพม.หนองคาย • เข้าสู่ระบบหรือลงทะเบียนเพื่อจัดการใบงานและตรวจงานนักเรียน 🌸
          </p>

          {/* Toggle Login / Register */}
          <div className="flex bg-purple-100/60 p-1.5 rounded-2xl mt-6 max-w-xs mx-auto border border-purple-200/50">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'login'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>🔐</span>
              <span>เข้าสู่ระบบ</span>
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'register'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>✍️</span>
              <span>ลงทะเบียนใหม่</span>
            </button>
          </div>
        </div>

        {authMode === 'login' ? (
          /* LOGIN FORM */
          <form
            onSubmit={handleLogin}
            className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-5"
          >
            <div className="border-b border-purple-100/70 pb-3 flex items-center gap-2">
              <span className="text-xl">🔐</span>
              <h2 className="text-lg font-bold text-gray-800">เข้าสู่ระบบครูผู้สอน</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span>👤</span>
                <span>Username (ชื่อผู้ใช้)</span>
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="ระบุชื่อผู้ใช้ (Username)"
                className="w-full px-4 py-3 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span>🔑</span>
                <span>Password (รหัสผ่าน)</span>
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="ระบุรหัสผ่าน (Password)"
                className="w-full px-4 py-3 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-xs"
              />
            </div>

            {/* ปุ่มลืมรหัสผ่าน */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <span className="text-gray-400 text-[11px]">จำรหัสผ่านไม่ได้?</span>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-violet-700 hover:text-violet-900 font-semibold hover:underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                <KeyRound size={13} className="text-violet-600" />
                <span>ลืม Username / Password?</span>
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-200/80 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogIn size={18} />
              <span>เข้าสู่ระบบ ✨</span>
            </button>
          </form>
        ) : (
          /* REGISTER FORM */
          <form
            onSubmit={handleRegister}
            className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-5"
          >
            <div className="border-b border-purple-100/70 pb-3 flex items-center gap-2">
              <span className="text-xl">✍️</span>
              <h2 className="text-lg font-bold text-gray-800">ลงทะเบียนครูผู้สอนใหม่</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span>👤</span>
                <span>ชื่อและนามสกุล ครูผู้สอน</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="เช่น ครูชมัยพร ถิ่นสำราญ"
                className="w-full px-4 py-3 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span>📚</span>
                <span>กลุ่มสาระการเรียนรู้</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <select
                value={regDepartment}
                onChange={(e) => setRegDepartment(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-xs cursor-pointer"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <span>🆔</span>
                  <span>Username</span>
                  <span className="text-pink-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="เช่น chamaiporn"
                  className="w-full px-4 py-3 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <span>🔒</span>
                  <span>Password</span>
                  <span className="text-pink-500 font-bold">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="รหัสผ่านอย่างน้อย 4 ตัวอักษร"
                  className="w-full px-4 py-3 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200/80 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus size={18} />
              <span>ยืนยันการลงทะเบียนครูใหม่ ✨</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: LOGGED IN TEACHER DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Teacher Top Bar */}
      <div className="bg-gradient-to-r from-white/95 via-purple-50/60 to-pink-50/60 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/40 border border-purple-100/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-pink-500 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-purple-200">
              {activeTeacher.fullName.charAt(0) || 'ค'}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-violet-100/80 text-violet-800 border border-violet-200 rounded-full text-[11px] font-semibold mb-1 shadow-xs">
                <span>👩‍🏫</span>
                <span>เข้าสู่ระบบในฐานะครูผู้สอน</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span>{activeTeacher.fullName}</span>
                <span>🌸</span>
              </h1>
              <p className="text-xs text-gray-500">
                {activeTeacher.department}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sub-tabs: ตรวจงาน / รายงานรายห้อง (คะแนน AI) / จัดการและลบข้อมูลนักเรียน / จัดการงาน */}
            <div className="flex flex-wrap bg-purple-100/60 p-1 rounded-xl border border-purple-200/60 gap-1">
              <button
                onClick={() => setTeacherTab('grade')}
                className={`px-3 md:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  teacherTab === 'grade'
                    ? 'bg-white text-violet-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>📝</span>
                <span>เมนูตรวจงาน</span>
              </button>
              <button
                onClick={() => setTeacherTab('report')}
                className={`px-3 md:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  teacherTab === 'report'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200'
                    : 'text-violet-900 hover:text-violet-700 bg-white/70 hover:bg-white'
                }`}
              >
                <span>📊</span>
                <span className="font-extrabold">รายงานรายห้อง (คะแนน AI)</span>
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                  teacherTab === 'report' ? 'bg-amber-300 text-amber-950' : 'bg-violet-200 text-violet-800'
                }`}>
                  ✨
                </span>
              </button>
              <button
                onClick={() => setTeacherTab('students')}
                className={`px-3 md:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  teacherTab === 'students'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-200'
                    : 'text-rose-900 hover:text-rose-700 bg-white/70 hover:bg-white'
                }`}
              >
                <span>🗑️</span>
                <span className="font-extrabold">จัดการ/ลบข้อมูลนักเรียน</span>
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                  teacherTab === 'students' ? 'bg-amber-300 text-amber-950' : 'bg-rose-100 text-rose-800'
                }`}>
                  ใหม่ ⚡
                </span>
              </button>
              <button
                onClick={() => setTeacherTab('assignments')}
                className={`px-3 md:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  teacherTab === 'assignments'
                    ? 'bg-white text-violet-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>📋</span>
                <span>เพิ่ม/จัดการงาน</span>
              </button>
            </div>

            {/* Manage Subjects Action Button */}
            <button
              onClick={() => setIsManageSubjectsOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-amber-950 bg-gradient-to-r from-yellow-200 via-amber-200 to-yellow-300 hover:from-yellow-300 hover:to-amber-300 border border-amber-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="จัดการรายวิชา (เลือก เพิ่ม แก้ไข ลบวิชา)"
            >
              <span>📚</span>
              <span>จัดการรายวิชา ({subjects.length})</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LogOut size={14} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: ตรวจงาน (GRADE SUBMISSIONS) */}
      {teacherTab === 'grade' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <h2 className="text-base font-bold text-gray-800">
                  กรองรายการส่งงานเพื่อตรวจให้คะแนน
                </h2>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-emerald-200 transition-all cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  <span>📊 ส่งออก Excel</span>
                </button>
                <button
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-pink-200 transition-all cursor-pointer"
                >
                  <FileDown size={14} />
                  <span>📄 ส่งออก PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {/* ปีการศึกษา */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📅</span>
                  <span>ปีการศึกษา</span>
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกปี --</option>
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>
                      ปี {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* ภาคเรียน */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📆</span>
                  <span>ภาคเรียน</span>
                </label>
                <select
                  value={filterSemester}
                  onChange={(e) => setFilterSemester(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกเทอม --</option>
                  {SEMESTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* เลือกวิชา */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📚</span>
                  <span>เลือกวิชา</span>
                </label>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกวิชา --</option>
                  {teacherSubjects.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ชั้นที่สอน */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🏫</span>
                  <span>ชั้นที่สอน</span>
                </label>
                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกชั้น --</option>
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* ห้องที่สอน */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🚪</span>
                  <span>ห้องที่สอน</span>
                </label>
                <select
                  value={filterRoom}
                  onChange={(e) => setFilterRoom(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกห้อง --</option>
                  {ROOMS.map((r) => (
                    <option key={r} value={r}>
                      ห้อง {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* สถานะการตรวจ */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🏷️</span>
                  <span>สถานะการตรวจ</span>
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกสถานะ --</option>
                  <option value="รอตรวจ">⏳ รอตรวจ</option>
                  <option value="ตรวจแล้ว">✅ ตรวจแล้ว</option>
                </select>
              </div>
            </div>

            {/* Active Filter Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 rounded-2xl border border-purple-200/70 text-xs shadow-xs">
              <div className="flex items-center gap-2 text-violet-950 flex-wrap">
                <span className="font-bold flex items-center gap-1">
                  <span>🎯</span>
                  <span>ข้อมูลที่กรอง:</span>
                </span>
                <span className="text-gray-700">
                  {filterYear !== 'ALL' ? `ปี ${filterYear}` : 'ทุกปี'} • {filterSemester !== 'ALL' ? `เทอม ${filterSemester}` : 'ทุกเทอม'} • {filterSubject !== 'ALL' ? filterSubject : 'ทุกวิชา'} • {filterGrade !== 'ALL' ? filterGrade : 'ทุกชั้น'} • {filterRoom !== 'ALL' ? `ห้อง ${filterRoom}` : 'ทุกห้อง'}
                </span>
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-xs">
                  ✨ พบ {teacherSubmissions.length} รายการ
                </span>
              </div>

              {(filterYear !== 'ALL' || filterSemester !== 'ALL' || filterSubject !== 'ALL' || filterGrade !== 'ALL' || filterRoom !== 'ALL' || filterStatus !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterYear('ALL');
                    setFilterSemester('ALL');
                    setFilterSubject('ALL');
                    setFilterGrade('ALL');
                    setFilterRoom('ALL');
                    setFilterStatus('ALL');
                  }}
                  className="text-xs text-violet-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>ล้างตัวกรองทั้งหมด</span>
                  <span>✕</span>
                </button>
              )}
            </div>

            {/* ค้นหาเพิ่มเติม */}
            <div className="pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500" size={16} />
                <input
                  type="text"
                  value={gradingSearch}
                  onChange={(e) => setGradingSearch(e.target.value)}
                  placeholder="🔍 ค้นหาชื่อนักเรียน, เลขที่ หรือชื่องาน..."
                  className="w-full pl-9 pr-4 py-2.5 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>
          </div>

          {/* Submissions List with Inline Grading */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-white/60 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-bold text-gray-800">
                รายการส่งงานที่ตรงตามเงื่อนไข ({teacherSubmissions.length} รายการ)
              </div>
              <div className="text-xs text-gray-500">
                สามารถกรอกคะแนนและข้อเสนอแนะได้โดยตรง แล้วกดปุ่ม "บันทึกคะแนน"
              </div>
            </div>

            {teacherSubmissions.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <CheckSquare size={28} />
                </div>
                <h4 className="text-base font-bold text-gray-800">ไม่มีรายการส่งงานตามตัวกรองที่เลือก</h4>
                <p className="text-xs text-gray-500 mt-1">
                  ลองเลือกทุกวิชาหรือระดับชั้นเพื่อดูผลงานที่นักเรียนส่งมา
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {teacherSubmissions.map((sub) => {
                  const currentScoreInput = gradingScores[sub.id]?.score ?? (sub.score !== null ? String(sub.score) : '');
                  const currentFeedbackInput = gradingScores[sub.id]?.feedback ?? (sub.feedback || '');

                  return (
                    <div 
                      key={sub.id}
                      className="p-5 hover:bg-purple-50/25 transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-5"
                    >
                      {/* Left: Student & Work Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-violet-100 text-violet-800 border border-violet-200">
                            {sub.gradeLevel}/{sub.room} • เลขที่ {sub.studentNumber}
                          </span>
                          <span className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                            <span>{sub.studentName}</span>
                            <span>🧑‍🎓</span>
                          </span>
                          {sub.status === 'ตรวจแล้ว' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                              ✅ ตรวจแล้ว ({sub.score}/{sub.maxScore})
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                              ⏳ รอตรวจ
                            </span>
                          )}

                          {/* ปุ่มแก้ไขชื่อ/ข้อมูล และลบชื่อนักเรียน */}
                          <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditStudent(sub)}
                              className="px-2 py-1 text-[11px] font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="แก้ไขชื่อ-สกุล เลขที่ ระดับชั้น หรือห้องของนักเรียน"
                            >
                              <Edit3 size={11} />
                              <span>แก้ไขชื่อ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudentSubmission(sub)}
                              className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="ลบรายชื่อนักเรียนและงานชิ้นนี้ออกจากระบบ"
                            >
                              <Trash2 size={11} />
                              <span>ลบ</span>
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                            {sub.subjectCode} {sub.subjectName}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="font-medium text-gray-800">{sub.assignmentName}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-400">ส่งเมื่อ: {sub.submittedAt}</span>
                        </div>

                        {/* Work Type & Sample Badges & Links */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200/80">
                            <span>🏷️ ชนิดงาน:</span>
                            <span>{sub.workType || 'ใบงาน/แบบฝึกหัด'}</span>
                          </span>

                          {sub.sampleUrl && (
                            <a
                              href={sub.sampleUrl.startsWith('http') ? sub.sampleUrl : `https://${sub.sampleUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors"
                              title="ดูตัวอย่างใบงาน/เกณฑ์ที่ครูกำหนด"
                            >
                              <FileText size={12} />
                              <span>ตัวอย่างใบงานครู</span>
                            </a>
                          )}

                          {/* Open Student Work Link */}
                          <a
                            href={sub.workUrl.startsWith('http') ? sub.workUrl : `https://${sub.workUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 transition-all shadow-2xs cursor-pointer"
                          >
                            <ExternalLink size={12} />
                            <span>คลิกเปิดดูผลงานนักเรียน</span>
                          </a>
                        </div>
                      </div>

                      {/* Right: Score, Feedback Inputs & AI Button */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-gradient-to-r from-purple-50/40 via-violet-50/30 to-pink-50/30 p-3.5 rounded-2xl border border-purple-100/90 shadow-xs">
                        {/* AI Grading Button */}
                        <button
                          type="button"
                          onClick={() => handleAiEvaluate(sub)}
                          disabled={evaluatingSubId === sub.id}
                          className="px-3.5 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-500 hover:from-violet-700 hover:via-indigo-700 hover:to-pink-600 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          title="ให้ AI วิเคราะห์ผลงานตามชนิดงาน พร้อมแนะนำคะแนนและคำแนะนำ"
                        >
                          {evaluatingSubId === sub.id ? (
                            <>
                              <Sparkles size={14} className="animate-spin text-pink-200" />
                              <span>AI กำลังวิเคราะห์...</span>
                            </>
                          ) : (
                            <>
                              <Bot size={15} className="text-pink-200" />
                              <span>🤖 AI ประเมินคะแนน</span>
                            </>
                          )}
                        </button>

                        {/* Score Box */}
                        <div className="w-full sm:w-28">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                            <span>คะแนน</span>
                            <span className="text-gray-400 font-normal">เต็ม {sub.maxScore}</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max={sub.maxScore}
                              value={currentScoreInput}
                              onChange={(e) => handleScoreInputChange(sub.id, e.target.value)}
                              placeholder={`0 - ${sub.maxScore}`}
                              className="w-full px-3 py-2 bg-white border border-purple-200/80 rounded-xl text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-purple-300"
                            />
                          </div>
                        </div>

                        {/* Feedback Box */}
                        <div className="w-full sm:w-56">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            คำแนะนำ/ข้อเสนอแนะ
                          </label>
                          <input
                            type="text"
                            value={currentFeedbackInput}
                            onChange={(e) => handleFeedbackInputChange(sub.id, e.target.value)}
                            placeholder="เช่น ยอดเยี่ยม, ตรวจสอบข้อ 2 เพิ่มเติม"
                            className="w-full px-3 py-2 bg-white border border-purple-200/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                          />
                        </div>

                        {/* Save Button */}
                        <button
                          onClick={() => handleSaveGrade(sub)}
                          className="sm:self-end px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Save size={14} />
                          <span>บันทึกคะแนน</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: รายงานการส่งงานรายห้อง พร้อมคะแนนที่ AI ตรวจให้ (CLASSROOM SUBMISSION & AI REPORT) */}
      {teacherTab === 'report' && (
        <div className="space-y-6">
          {/* Header & Classroom Filter Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-2xl shadow-md shadow-violet-200">
                  📊
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200 mb-1">
                    <span>🤖</span>
                    <span>รายงานการส่งงานรายห้อง • ระบบตรวจและวิเคราะห์ด้วย AI</span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span>รายงานการส่งงานห้อง {reportGrade}/{reportRoom}</span>
                    <span className="text-violet-600 text-sm font-semibold">({roomSubmissions.length} รายการ)</span>
                  </h2>
                </div>
              </div>

              {/* Action Buttons for Room */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Delete Entire Classroom Button */}
                <button
                  type="button"
                  disabled={roomSubmissions.length === 0}
                  onClick={() => handleDeleteByRoom(reportGrade, reportRoom, reportYear, reportSemester)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    roomSubmissions.length === 0
                      ? 'border border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 hover:border-rose-400 shadow-rose-100 hover:scale-[1.02]'
                  }`}
                  title={`ลบข้อมูลการส่งงานของนักเรียนห้อง ${reportGrade}/${reportRoom} ทั้งหมด`}
                >
                  <Trash2 size={13} className="text-rose-600" />
                  <span>🗑️ ลบข้อมูลห้องนี้ ({roomSubmissions.length})</span>
                </button>

                {/* Batch AI Grading Button */}
                <button
                  type="button"
                  disabled={isBatchEvaluating || roomSubmissions.length === 0}
                  onClick={handleBatchAiEvaluateRoom}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 cursor-pointer transition-all ${
                    isBatchEvaluating || roomSubmissions.length === 0
                      ? 'bg-gray-400 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 shadow-purple-200 hover:scale-[1.02]'
                  }`}
                  title="สั่งให้ AI ตรวจและประเมินผลงานของนักเรียนในห้องนี้ทั้งหมดที่ยังไม่ได้ตรวจ"
                >
                  <Sparkles size={15} className={isBatchEvaluating ? 'animate-spin' : ''} />
                  <span>{isBatchEvaluating ? 'กำลังประเมินทั้งห้อง...' : '🤖 ให้ AI ตรวจประเมินทั้งห้อง'}</span>
                </button>

                {/* Batch Apply AI Scores to Teacher Inputs */}
                <button
                  type="button"
                  onClick={handleApplyAllAiScoresToGrading}
                  disabled={roomStats.aiEvaluated === 0}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    roomStats.aiEvaluated === 0
                      ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                  }`}
                  title="คัดลอกคะแนนและข้อเสนอแนะที่ AI ประเมินไว้ มาใส่ในช่องคะแนนครูของนักเรียนทุกคนในห้องนี้"
                >
                  <Wand2 size={14} className="text-amber-700" />
                  <span>✨ ดึงคะแนน AI ใส่ช่องตรวจ</span>
                </button>

                {/* Excel Export */}
                <button
                  type="button"
                  onClick={handleExportClassroomExcel}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="ดาวน์โหลดไฟล์ Excel รายชื่อนักเรียนพร้อมคะแนน AI ของห้องนี้"
                >
                  <FileSpreadsheet size={14} />
                  <span>📊 ส่งออก Excel</span>
                </button>

                {/* PDF Export */}
                <button
                  type="button"
                  onClick={handleExportClassroomPdf}
                  className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-pink-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="พิมพ์รายงานหรือบันทึกเป็น PDF"
                >
                  <FileDown size={14} />
                  <span>📄 ส่งออก PDF</span>
                </button>
              </div>
            </div>

            {/* Quick Grade Selector (ม.1 - ม.6) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span>🏫</span>
                  <span>1. เลือกระดับชั้น:</span>
                </label>
                <span className="text-[11px] text-gray-500">
                  คลิกเลือกระดับชั้นเพื่อดูห้องเรียนและคะแนนที่เกี่ยวข้อง
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {GRADE_LEVELS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setReportGrade(g)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      reportGrade === g
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200 scale-102'
                        : 'bg-purple-50/50 hover:bg-purple-100/70 text-gray-700 border border-purple-200/70'
                    }`}
                  >
                    <span>🎓</span>
                    <span>ชั้น {g}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Room Selector (ห้อง 1 - 14) */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span>🚪</span>
                  <span>2. เลือกห้องเรียน (ห้อง 1 ถึง 14):</span>
                </label>
                <span className="text-[11px] text-gray-500">
                  กำลังแสดงข้อมูลห้อง: <b className="text-violet-700">{reportGrade}/{reportRoom}</b>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROOMS.map((r) => {
                  const isCurrent = reportRoom === r;
                  // Count total submissions in this specific room matching year and semester
                  const roomCount = submissions.filter(s => 
                    (!activeTeacher || s.teacherName === activeTeacher.fullName || s.teacherName.includes(activeTeacher.fullName)) &&
                    s.gradeLevel === reportGrade && 
                    s.room === r &&
                    (reportYear === 'ALL' || (s.academicYear || '2567') === reportYear) &&
                    (reportSemester === 'ALL' || (s.semester || '1') === reportSemester)
                  ).length;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReportRoom(r)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-amber-400 text-amber-950 font-black shadow-md border-2 border-amber-500 scale-105'
                          : roomCount > 0
                          ? 'bg-purple-50 hover:bg-purple-100 text-violet-900 border border-purple-200'
                          : 'bg-gray-50/80 hover:bg-gray-100 text-gray-500 border border-gray-200/60'
                      }`}
                    >
                      <span>ห้อง {r}</span>
                      {roomCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                          isCurrent ? 'bg-amber-950 text-amber-200' : 'bg-violet-600 text-white'
                        }`}>
                          {roomCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Filter Row (Year, Semester, Subject, Assignment, Status, Search) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-purple-100/60">
              {/* ปีการศึกษา */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📅</span>
                  <span>ปีการศึกษา</span>
                </label>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกปี --</option>
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>
                      ปี {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* ภาคเรียน */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📆</span>
                  <span>ภาคเรียน</span>
                </label>
                <select
                  value={reportSemester}
                  onChange={(e) => setReportSemester(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกภาค --</option>
                  {SEMESTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* วิชา */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📚</span>
                  <span>วิชา</span>
                </label>
                <select
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกวิชา ({teacherSubjects.length}) --</option>
                  {teacherSubjects.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ชื่องาน */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📝</span>
                  <span>ชื่องาน / ใบงาน</span>
                </label>
                <select
                  value={reportAssignment}
                  onChange={(e) => setReportAssignment(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300 truncate"
                >
                  <option value="ALL">-- ทุกใบงาน --</option>
                  {assignments
                    .filter(a => !activeTeacher || a.teacherName === activeTeacher.fullName)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({a.maxScore} คะแนน)
                      </option>
                    ))}
                </select>
              </div>

              {/* สถานะการตรวจ */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🎯</span>
                  <span>สถานะการตรวจ</span>
                </label>
                <select
                  value={reportStatus}
                  onChange={(e) => setReportStatus(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกสถานะ --</option>
                  <option value="รอตรวจ">⏳ รอตรวจ</option>
                  <option value="ตรวจแล้ว">✅ ตรวจแล้ว</option>
                </select>
              </div>

              {/* ค้นหาชื่อ / เลขที่ */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🔍</span>
                  <span>ค้นหาในห้องนี้</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="พิมพ์ชื่อ หรือ เลขที่..."
                    className="w-full pl-7 pr-3 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Classroom KPI Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* นักเรียนส่งงาน */}
            <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl p-4 text-white shadow-lg shadow-violet-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>นักเรียนส่งงานในห้องนี้</span>
                <span>👥</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">{roomStats.total}</div>
                <div className="text-[11px] opacity-80 mt-0.5">ห้อง {reportGrade}/{reportRoom}</div>
              </div>
            </div>

            {/* ตรวจด้วย AI แล้ว */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-4 text-white shadow-lg shadow-purple-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>ประเมินด้วย AI แล้ว</span>
                <span>🤖</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">
                  {roomStats.aiEvaluated}
                  <span className="text-sm font-semibold opacity-80 ml-1">/ {roomStats.total}</span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  {roomStats.total > 0 ? `${Math.round((roomStats.aiEvaluated / roomStats.total) * 100)}% เรียบร้อย` : 'ยังไม่มีงาน'}
                </div>
              </div>
            </div>

            {/* ครูตรวจแล้ว */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-4 text-white shadow-lg shadow-emerald-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>คุณครูตรวจแล้ว</span>
                <span>👨‍🏫</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">
                  {roomStats.teacherGraded}
                  <span className="text-sm font-semibold opacity-80 ml-1">/ {roomStats.total}</span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  {roomStats.total > 0 ? `${Math.round((roomStats.teacherGraded / roomStats.total) * 100)}% เรียบร้อย` : 'ยังไม่มีงาน'}
                </div>
              </div>
            </div>

            {/* คะแนนเฉลี่ย AI */}
            <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-3xl p-4 text-white shadow-lg shadow-amber-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>คะแนนเฉลี่ย AI ประเมิน</span>
                <span>🎯</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">
                  {roomStats.avgAiScore}
                  {roomStats.avgAiScore !== '-' && <span className="text-xs font-medium ml-1">คะแนน</span>}
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">ประเมินตามรูบริก & ตัวอย่างงาน</div>
              </div>
            </div>

            {/* คะแนนเฉลี่ยคุณครู */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-4 text-white shadow-lg shadow-blue-200/50 flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>คะแนนเฉลี่ยคุณครู</span>
                <span>🏆</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">
                  {roomStats.avgTeacherScore}
                  {roomStats.avgTeacherScore !== '-' && <span className="text-xs font-medium ml-1">คะแนน</span>}
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">คะแนนทางการที่บันทึกแล้ว</div>
              </div>
            </div>
          </div>

          {/* Main Classroom Submissions & AI Scores Table Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>📋</span>
                  <span>ตารางรายงานการส่งงานและคะแนน AI • ห้อง {reportGrade}/{reportRoom}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-violet-100 text-violet-800 rounded-full border border-violet-200">
                    เรียงตามเลขที่ 1, 2, 3...
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  คุณครูสามารถตรวจสอบคะแนนที่ AI ประเมิน จุดเด่น ข้อเสนอแนะ และกดนำคะแนนไปใช้บันทึกเป็นคะแนนจริงได้ทันที
                </p>
              </div>

              {roomSubmissions.length > 0 && (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>ส่งงานแล้ว {roomSubmissions.length} รายการ</span>
                </div>
              )}
            </div>

            {/* Empty State */}
            {roomSubmissions.length === 0 ? (
              <div className="py-14 text-center space-y-4 bg-purple-50/20 rounded-3xl border border-dashed border-purple-200">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-3xl">
                  🏫
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-gray-800">
                    ยังไม่มีรายการส่งงานในห้อง {reportGrade}/{reportRoom}
                  </h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    ยังไม่มีนักเรียนในระดับชั้น {reportGrade} ห้อง {reportRoom} ส่งงานเข้ามาตามเงื่อนไขที่เลือก 
                    คุณครูสามารถคลิกเลือกห้องอื่น เช่น ห้อง 1, ห้อง 2 หรือปรับตัวกรองวิชาด้านบน
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {ROOMS.slice(0, 5).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReportRoom(r)}
                      className="px-3 py-1.5 bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      สลับไปห้อง {r} ➜
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {/* Selection Action Bar for Classroom Report */}
                {selectedReportSubIds.length > 0 && (
                  <div className="mb-3 p-3 bg-rose-50/95 border border-rose-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                      <CheckSquare size={16} className="text-rose-600" />
                      <span>เลือกนักเรียน {selectedReportSubIds.length} คน จากทั้งหมด {roomSubmissions.length} คน</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteSelectedStudents(selectedReportSubIds)}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                      >
                        <Trash2 size={13} />
                        <span>ลบที่เลือก ({selectedReportSubIds.length} คน)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedReportSubIds([])}
                        className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                      >
                        ยกเลิกการเลือก
                      </button>
                    </div>
                  </div>
                )}

                {/* Submissions Table with AI Scores */}
                <div className="overflow-x-auto rounded-2xl border border-purple-100">
                  <table className="w-full text-left text-xs text-gray-800">
                    <thead className="bg-gradient-to-r from-purple-100/90 via-violet-100/80 to-purple-50/90 text-gray-800 uppercase font-bold text-[11px] border-b border-purple-200/80">
                      <tr>
                        <th className="px-3 py-3.5 text-center whitespace-nowrap w-10">
                          <input
                            type="checkbox"
                            checked={roomSubmissions.length > 0 && selectedReportSubIds.length === roomSubmissions.length}
                            onChange={(e) => setSelectedReportSubIds(e.target.checked ? roomSubmissions.map(s => s.id) : [])}
                            className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-400 cursor-pointer"
                            title="เลือกทั้งหมด / ยกเลิกทั้งหมด"
                          />
                        </th>
                        <th className="px-3.5 py-3.5 text-center whitespace-nowrap">เลขที่</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">นักเรียน</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">วิชา & ชื่องาน</th>
                        <th className="px-3.5 py-3.5 text-center whitespace-nowrap">ผลงาน</th>
                        <th className="px-4 py-3.5 min-w-[240px] whitespace-nowrap">🤖 คะแนนที่ AI ประเมิน & คำแนะนำ</th>
                        <th className="px-4 py-3.5 min-w-[170px] whitespace-nowrap">👨‍🏫 คะแนนคุณครู</th>
                        <th className="px-3.5 py-3.5 text-center whitespace-nowrap">สถานะ</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100/70 bg-white">
                      {roomSubmissions.map((sub) => {
                        const currentInput = gradingScores[sub.id];
                        const currentScoreVal = currentInput?.score !== undefined 
                          ? currentInput.score 
                          : (sub.score !== null && sub.score !== undefined ? String(sub.score) : '');
                        const currentFeedbackVal = currentInput?.feedback !== undefined
                          ? currentInput.feedback
                          : (sub.feedback || '');

                        const hasAi = !!sub.aiEvaluation && sub.aiEvaluation.suggestedScore !== undefined;
                        const isSelected = selectedReportSubIds.includes(sub.id);

                        return (
                          <tr key={sub.id} className={`hover:bg-purple-50/30 transition-colors ${isSelected ? 'bg-purple-50/60' : ''}`}>
                            {/* Checkbox เลือกรายบุคคล */}
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedReportSubIds(prev => checked ? [...prev, sub.id] : prev.filter(id => id !== sub.id));
                                }}
                                className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-400 cursor-pointer"
                              />
                            </td>

                            {/* เลขที่ */}
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-900 border border-violet-200 font-black inline-flex items-center justify-center text-xs shadow-2xs">
                              {sub.studentNumber}
                            </span>
                          </td>

                          {/* นักเรียน */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="font-bold text-gray-900 text-xs">
                                {sub.studentName}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStudent(sub)}
                                  className="p-1 text-violet-600 hover:text-violet-900 hover:bg-violet-100/80 rounded-md transition-colors cursor-pointer"
                                  title="แก้ไขชื่อ-สกุล เลขที่ หรือห้องของนักเรียน"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudentSubmission(sub)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="ลบชื่อนักเรียนและผลงานนี้ออกจากระบบ"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <span>ชั้น {sub.gradeLevel}/{sub.room}</span>
                              <span>•</span>
                              <span>{sub.submittedAt ? sub.submittedAt.split(' ')[0] : ''}</span>
                            </div>
                          </td>

                          {/* วิชา & ชื่องาน */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                                {sub.subjectCode}
                              </span>
                              <span className="font-semibold text-gray-800 text-xs">
                                {sub.assignmentName}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                              <span>คะแนนเต็ม {sub.maxScore} คะแนน</span>
                              {sub.workType && (
                                <>
                                  <span>•</span>
                                  <span className="text-purple-700 font-medium">{sub.workType}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* ผลงาน */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            {sub.workUrl ? (
                              <a
                                href={sub.workUrl.startsWith('http') ? sub.workUrl : `https://${sub.workUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold transition-all shadow-2xs"
                                title="คลิกเพื่อเปิดดูผลงานที่นักเรียนส่ง"
                              >
                                <ExternalLink size={12} />
                                <span>เปิดดูงาน</span>
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>

                          {/* 🤖 คะแนนที่ AI ประเมิน & คำแนะนำ */}
                          <td className="px-4 py-3">
                            {hasAi ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-950 font-black text-xs border border-purple-200 shadow-2xs">
                                    <span>🤖 AI:</span>
                                    <span className="text-violet-700 text-sm font-black">
                                      {sub.aiEvaluation!.suggestedScore}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-normal">/ {sub.maxScore}</span>
                                  </span>

                                  {/* Score Quality Badge */}
                                  {sub.aiEvaluation!.suggestedScore >= sub.maxScore * 0.8 ? (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      ดีเยี่ยม ✨
                                    </span>
                                  ) : sub.aiEvaluation!.suggestedScore >= sub.maxScore * 0.5 ? (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      ปานกลาง 👍
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      ต้องปรับปรุง ⚠️
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveAiModal({
                                        submission: sub,
                                        result: {
                                          suggestedScore: sub.aiEvaluation!.suggestedScore,
                                          maxScore: sub.maxScore,
                                          feedback: sub.aiEvaluation!.feedback,
                                          strengths: sub.aiEvaluation!.strengths || [],
                                          improvements: sub.aiEvaluation!.improvements || [],
                                          rubricBreakdown: [
                                            { 
                                              criteria: 'ความถูกต้องและสมบูรณ์ของชิ้นงาน', 
                                              score: Math.round(sub.aiEvaluation!.suggestedScore * 0.6 * 10) / 10, 
                                              max: Math.round(sub.maxScore * 0.6), 
                                              comment: 'เกณฑ์ความถูกต้องตามวัตถุประสงค์' 
                                            },
                                            { 
                                              criteria: 'ตรรกะ/ความคิดสร้างสรรค์และความเรียบร้อย', 
                                              score: Math.round(sub.aiEvaluation!.suggestedScore * 0.4 * 10) / 10, 
                                              max: Math.round(sub.maxScore * 0.4), 
                                              comment: 'เกณฑ์ความคิดสร้างสรรค์และการประยุกต์ใช้' 
                                            },
                                          ],
                                          confidenceScore: 0.95,
                                        },
                                        editableScore: sub.aiEvaluation!.suggestedScore,
                                        editableFeedback: sub.aiEvaluation!.feedback,
                                      });
                                    }}
                                    className="text-[11px] font-bold text-violet-700 hover:text-violet-900 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span>🔍 ดูเกณฑ์</span>
                                  </button>
                                </div>

                                <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed bg-purple-50/40 p-1.5 rounded-lg border border-purple-100/80">
                                  {sub.aiEvaluation!.feedback || 'ไม่มีข้อเสนอแนะเพิ่มเติม'}
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-medium">ยังไม่ตรวจ</span>
                                <button
                                  type="button"
                                  disabled={evaluatingSubId === sub.id}
                                  onClick={() => handleAiEvaluate(sub)}
                                  className="px-2.5 py-1 rounded-xl bg-purple-100 hover:bg-purple-200 text-violet-800 text-[11px] font-bold border border-purple-200 cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                                >
                                  <Sparkles size={11} className={evaluatingSubId === sub.id ? 'animate-spin' : ''} />
                                  <span>{evaluatingSubId === sub.id ? 'กำลังตรวจ...' : '🤖 AI ตรวจคนนี้'}</span>
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 👨‍🏫 คะแนนคุณครู (คะแนน & ข้อเสนอแนะ) */}
                          <td className="px-4 py-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={sub.maxScore}
                                  value={currentScoreVal}
                                  onChange={(e) => handleScoreInputChange(sub.id, e.target.value)}
                                  placeholder="0.0"
                                  className="w-16 px-2 py-1 bg-purple-50/20 focus:bg-white border border-purple-200/80 rounded-lg text-xs font-bold text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300"
                                />
                                <span className="text-[11px] text-gray-500 font-medium">/ {sub.maxScore}</span>
                              </div>

                              <input
                                type="text"
                                value={currentFeedbackVal}
                                onChange={(e) => handleFeedbackInputChange(sub.id, e.target.value)}
                                placeholder="คำแนะนำของคุณครู..."
                                className="w-full px-2 py-1 bg-purple-50/20 focus:bg-white border border-purple-200/80 rounded-lg text-[11px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                              />
                            </div>
                          </td>

                          {/* สถานะ */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                sub.status === 'ตรวจแล้ว'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs'
                              }`}
                            >
                              <span>{sub.status === 'ตรวจแล้ว' ? '✅' : '⏳'}</span>
                              <span>{sub.status}</span>
                            </span>
                          </td>

                          {/* การจัดการ (ใช้คะแนน AI / บันทึกคะแนน) */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Apply AI Score Button */}
                              {hasAi && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleScoreInputChange(sub.id, String(sub.aiEvaluation!.suggestedScore));
                                    handleFeedbackInputChange(sub.id, sub.aiEvaluation!.feedback || '');
                                    alertService.success('ใส่คะแนน AI แล้ว', `นำคะแนน ${sub.aiEvaluation!.suggestedScore} เข้าสู่ช่องตรวจของ ${sub.studentName}`);
                                  }}
                                  className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg border border-amber-300 transition-colors cursor-pointer"
                                  title="นำคะแนนและข้อเสนอแนะที่ AI ตรวจให้มาใส่ในช่องตรวจของคุณครู"
                                >
                                  <Wand2 size={13} />
                                </button>
                              )}

                              {/* Save Teacher Grade Button */}
                              <button
                                type="button"
                                onClick={() => handleSaveGrade(sub)}
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-emerald-200 transition-all cursor-pointer flex items-center gap-1"
                                title="บันทึกคะแนนและคำแนะนำนี้"
                              >
                                <Save size={12} />
                                <span>บันทึก</span>
                              </button>

                              {/* Re-evaluate with AI Button */}
                              <button
                                type="button"
                                disabled={evaluatingSubId === sub.id}
                                onClick={() => handleAiEvaluate(sub)}
                                className="p-1.5 text-purple-700 hover:text-purple-900 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                                title="ให้ AI ตรวจประเมินซ้ำอีกครั้ง"
                              >
                                <Bot size={13} />
                              </button>

                              {/* Delete Student & Submission Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentSubmission(sub)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                title="ลบรายชื่อนักเรียนและงานนี้ออกจากระบบ"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW: จัดการและลบข้อมูลนักเรียน (STUDENT DATA MANAGEMENT & DELETION) */}
      {teacherTab === 'students' && (
        <div className="space-y-6">
          {/* Header & Action Summary Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-rose-100/30 border border-rose-100/80 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 text-white flex items-center justify-center text-2xl shadow-md shadow-rose-200">
                  🗑️
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 mb-1">
                    <span>⚡</span>
                    <span>ระบบจัดการและลบข้อมูลนักเรียน • ลบเป็นห้อง หรือ ลบรายบุคคล</span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span>จัดการข้อมูลนักเรียน</span>
                    <span className="text-rose-600 text-sm font-semibold">({manageStudentSubmissions.length} รายการตามตัวกรอง)</span>
                  </h2>
                </div>
              </div>

              {/* Action Buttons Top */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Delete Entire Classroom Button */}
                <button
                  type="button"
                  disabled={studentManageGrade === 'ALL' || studentManageRoom === 'ALL' || manageStudentSubmissions.length === 0}
                  onClick={() => handleDeleteByRoom(studentManageGrade, studentManageRoom, studentManageYear, studentManageSemester)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 cursor-pointer transition-all ${
                    studentManageGrade === 'ALL' || studentManageRoom === 'ALL' || manageStudentSubmissions.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-200 hover:scale-[1.02]'
                  }`}
                  title={
                    studentManageGrade === 'ALL' || studentManageRoom === 'ALL'
                      ? 'กรุณาเลือกระดับชั้นและห้องเรียนก่อนสั่งลบทั้งห้อง'
                      : `ลบข้อมูลนักเรียนทั้งห้อง ${studentManageGrade}/${studentManageRoom}`
                  }
                >
                  <Trash2 size={14} />
                  <span>
                    {studentManageGrade !== 'ALL' && studentManageRoom !== 'ALL'
                      ? `ลบข้อมูลทั้งห้อง ${studentManageGrade}/${studentManageRoom}`
                      : 'ลบข้อมูลทั้งห้อง (เลือกชั้น/ห้องก่อน)'}
                  </span>
                </button>

                {/* Delete Selected Individuals Button */}
                <button
                  type="button"
                  disabled={selectedStudentManageIds.length === 0}
                  onClick={() => handleDeleteSelectedStudents(selectedStudentManageIds)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedStudentManageIds.length === 0
                      ? 'border border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                      : 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 shadow-2xs hover:scale-[1.02]'
                  }`}
                  title="ลบเฉพาะนักเรียนที่ติ๊กเลือกในตาราง"
                >
                  <Trash2 size={14} className="text-rose-600" />
                  <span>ลบที่เลือก ({selectedStudentManageIds.length} คน)</span>
                </button>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={async () => {
                    alertService.loading('กำลังรีเฟรชข้อมูล...');
                    await onRefreshData();
                    alertService.close();
                  }}
                  className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-violet-800 border border-purple-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>รีเฟรช</span>
                </button>
              </div>
            </div>

            {/* Filter Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Filter size={14} className="text-rose-600" />
                  <span>ตัวกรองข้อมูล: เลือกปีการศึกษา ภาคเรียน ระดับชั้น และห้องเรียน</span>
                </span>
                {(studentManageYear !== 'ALL' || studentManageSemester !== 'ALL' || studentManageGrade !== 'ALL' || studentManageRoom !== 'ALL' || studentManageSubject !== 'ALL' || studentManageSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentManageYear('ALL');
                      setStudentManageSemester('ALL');
                      setStudentManageGrade('ALL');
                      setStudentManageRoom('ALL');
                      setStudentManageSubject('ALL');
                      setStudentManageSearch('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>✕ ล้างตัวกรองทั้งหมด</span>
                  </button>
                )}
              </div>

              {/* 6-Column Filter Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* ปีการศึกษา */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <span>📅</span>
                    <span>ปีการศึกษา</span>
                  </label>
                  <select
                    value={studentManageYear}
                    onChange={(e) => setStudentManageYear(e.target.value)}
                    className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="ALL">-- ทุกปีการศึกษา --</option>
                    {ACADEMIC_YEARS.map((y) => (
                      <option key={y} value={y}>
                        ปี {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ภาคเรียน */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <span>📆</span>
                    <span>ภาคเรียน</span>
                  </label>
                  <select
                    value={studentManageSemester}
                    onChange={(e) => setStudentManageSemester(e.target.value)}
                    className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="ALL">-- ทุกภาคเรียน --</option>
                    {SEMESTERS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ระดับชั้น */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <span>🏫</span>
                    <span>ระดับชั้น</span>
                  </label>
                  <select
                    value={studentManageGrade}
                    onChange={(e) => setStudentManageGrade(e.target.value)}
                    className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="ALL">-- ทุกระดับชั้น --</option>
                    {GRADE_LEVELS.map((g) => (
                      <option key={g} value={g}>
                        ชั้น {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ห้องเรียน */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <span>🚪</span>
                    <span>ห้องเรียน</span>
                  </label>
                  <select
                    value={studentManageRoom}
                    onChange={(e) => setStudentManageRoom(e.target.value)}
                    className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="ALL">-- ทุกห้อง --</option>
                    {ROOMS.map((r) => (
                      <option key={r} value={r}>
                        ห้อง {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* รายวิชา */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <span>📚</span>
                    <span>รายวิชา</span>
                  </label>
                  <select
                    value={studentManageSubject}
                    onChange={(e) => setStudentManageSubject(e.target.value)}
                    className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="ALL">-- ทุกวิชา ({teacherSubjects.length}) --</option>
                    {teacherSubjects.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ค้นหาชื่อ / เลขที่ */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <span>🔍</span>
                    <span>ค้นหาชื่อ/เลขที่</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studentManageSearch}
                      onChange={(e) => setStudentManageSearch(e.target.value)}
                      placeholder="ชื่อ, เลขที่ หรือวิชา..."
                      className="w-full pl-7 pr-3 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Quick Grade and Room Buttons */}
              <div className="pt-2 border-t border-rose-100/60 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-700">คลิกด่วนเลือกระดับชั้น:</span>
                  <button
                    type="button"
                    onClick={() => setStudentManageGrade('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      studentManageGrade === 'ALL'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    ทุกชั้น
                  </button>
                  {GRADE_LEVELS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setStudentManageGrade(g)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        studentManageGrade === g
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      ชั้น {g}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold text-gray-700 mr-1">คลิกด่วนเลือกห้อง:</span>
                  <button
                    type="button"
                    onClick={() => setStudentManageRoom('ALL')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      studentManageRoom === 'ALL'
                        ? 'bg-amber-400 text-amber-950 font-black shadow-2xs'
                        : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    ทุกห้อง
                  </button>
                  {ROOMS.map((r) => {
                    const isCurrent = studentManageRoom === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setStudentManageRoom(r)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-400 text-amber-950 font-black shadow-2xs scale-105'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        ห้อง {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Student Submissions List & Batch Table Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-rose-100/30 border border-rose-100/80 space-y-4">
            {/* Table Header Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>🧑‍🎓</span>
                  <span>ตารางข้อมูลนักเรียน</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full border border-rose-200">
                    พบ {manageStudentSubmissions.length} รายการ
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  เลือกติ๊กถูกหน้ารายชื่อเพื่อเลือกลบรายบุคคล หรือใช้ปุ่มด้านบนเพื่อลบข้อมูลทั้งห้อง
                </p>
              </div>

              {/* Multi-selection info and action */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedStudentManageIds.length > 0 ? (
                  <>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                      เลือกแล้ว {selectedStudentManageIds.length} คน
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSelectedStudents(selectedStudentManageIds)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 size={13} />
                      <span>ลบที่เลือก ({selectedStudentManageIds.length} คน)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentManageIds([])}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={manageStudentSubmissions.length === 0}
                    onClick={() => setSelectedStudentManageIds(manageStudentSubmissions.map(s => s.id))}
                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-violet-800 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    <CheckSquare size={13} />
                    <span>เลือกทั้งหมดในหน้านี้ ({manageStudentSubmissions.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table Content */}
            {manageStudentSubmissions.length === 0 ? (
              <div className="py-14 text-center space-y-4 bg-rose-50/20 rounded-3xl border border-dashed border-rose-200">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto text-3xl">
                  🔍
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-gray-800">
                    ไม่พบข้อมูลนักเรียนตามเงื่อนไขตัวกรอง
                  </h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    ลองปรับตัวกรองปีการศึกษา ภาคเรียน ระดับชั้น หรือห้องเรียนด้านบน เพื่อค้นหารายชื่อนักเรียนที่ต้องการจัดการ
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-rose-100">
                <table className="w-full text-left text-xs text-gray-800">
                  <thead className="bg-gradient-to-r from-rose-100/90 via-pink-100/80 to-purple-100/80 text-gray-800 uppercase font-bold text-[11px] border-b border-rose-200/80">
                    <tr>
                      <th className="px-3 py-3.5 text-center whitespace-nowrap w-10">
                        <input
                          type="checkbox"
                          checked={manageStudentSubmissions.length > 0 && selectedStudentManageIds.length === manageStudentSubmissions.length}
                          onChange={(e) => setSelectedStudentManageIds(e.target.checked ? manageStudentSubmissions.map(s => s.id) : [])}
                          className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-400 cursor-pointer"
                          title="เลือกทั้งหมด / ยกเลิกทั้งหมด"
                        />
                      </th>
                      <th className="px-3 py-3.5 text-center whitespace-nowrap">เลขที่</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">ชื่อ-สกุลนักเรียน</th>
                      <th className="px-3.5 py-3.5 text-center whitespace-nowrap">ระดับชั้น/ห้อง</th>
                      <th className="px-3.5 py-3.5 text-center whitespace-nowrap">ปีการศึกษา/เทอม</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">วิชา & ชื่องาน</th>
                      <th className="px-3.5 py-3.5 text-center whitespace-nowrap">ผลงาน</th>
                      <th className="px-3.5 py-3.5 text-center whitespace-nowrap">คะแนน</th>
                      <th className="px-3.5 py-3.5 text-center whitespace-nowrap">สถานะ</th>
                      <th className="px-4 py-3.5 text-center whitespace-nowrap">การจัดการรายบุคคล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100/70 bg-white">
                    {manageStudentSubmissions.map((sub) => {
                      const isSelected = selectedStudentManageIds.includes(sub.id);
                      return (
                        <tr key={sub.id} className={`hover:bg-rose-50/30 transition-colors ${isSelected ? 'bg-rose-50/60' : ''}`}>
                          {/* Checkbox */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedStudentManageIds(prev => checked ? [...prev, sub.id] : prev.filter(id => id !== sub.id));
                              }}
                              className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-400 cursor-pointer"
                            />
                          </td>

                          {/* เลขที่ */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-900 border border-violet-200 font-black inline-flex items-center justify-center text-xs shadow-2xs">
                              {sub.studentNumber}
                            </span>
                          </td>

                          {/* ชื่อ-สกุลนักเรียน */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                              <span>{sub.studentName}</span>
                              <span>🧑‍🎓</span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              ส่งเมื่อ: {sub.submittedAt || '-'}
                            </div>
                          </td>

                          {/* ระดับชั้น/ห้อง */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200 shadow-2xs">
                              {sub.gradeLevel}/{sub.room}
                            </span>
                          </td>

                          {/* ปีการศึกษา/เทอม */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            <div className="text-xs font-bold text-gray-800">ปี {sub.academicYear || '2567'}</div>
                            <div className="text-[10px] text-gray-500 font-medium">ภาคเรียนที่ {sub.semester || '1'}</div>
                          </td>

                          {/* วิชา & ชื่องาน */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                                {sub.subjectCode}
                              </span>
                              <span className="font-semibold text-gray-800 text-xs">
                                {sub.assignmentName}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {sub.subjectName}
                            </div>
                          </td>

                          {/* ลิงก์ผลงาน */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            {sub.workUrl ? (
                              <a
                                href={sub.workUrl.startsWith('http') ? sub.workUrl : `https://${sub.workUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 transition-all shadow-2xs cursor-pointer"
                              >
                                <ExternalLink size={11} />
                                <span>เปิดงาน</span>
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>

                          {/* คะแนน */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            {sub.score !== null && sub.score !== undefined ? (
                              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                {sub.score} / {sub.maxScore}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 font-medium">-</span>
                            )}
                          </td>

                          {/* สถานะ */}
                          <td className="px-3.5 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                sub.status === 'ตรวจแล้ว'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              <span>{sub.status === 'ตรวจแล้ว' ? '✅ ตรวจแล้ว' : '⏳ รอตรวจ'}</span>
                            </span>
                          </td>

                          {/* การจัดการรายบุคคล */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditStudent(sub)}
                                className="px-2 py-1 text-[11px] font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="แก้ไขชื่อ-สกุล เลขที่ ระดับชั้น หรือห้องของนักเรียน"
                              >
                                <Edit3 size={11} />
                                <span>แก้ไข</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentSubmission(sub)}
                                className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="ลบรายชื่อนักเรียนและผลงานนี้ออกจากระบบ"
                              >
                                <Trash2 size={11} />
                                <span>ลบ</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: จัดการงาน / เพิ่มงาน (ASSIGNMENTS MANAGEMENT) */}
      {teacherTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form: เพิ่มงาน */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSaveAssignments}
              className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-7 shadow-xl border border-white/60 space-y-6"
            >
              <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} />
                <div>
                  <h3 className="text-base font-bold text-gray-900">เพิ่มใบงานใหม่</h3>
                  <p className="text-xs text-gray-500">กำหนดชื่อใบงานและคะแนนเต็ม</p>
                </div>
              </div>

              {/* ปีการศึกษา และ ภาคเรียน */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ปีการศึกษา <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assignYear}
                    onChange={(e) => setAssignYear(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 cursor-pointer"
                  >
                    {ACADEMIC_YEARS.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ภาคเรียน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assignSemester}
                    onChange={(e) => setAssignSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 cursor-pointer"
                  >
                    {SEMESTERS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ตัวเลือกรายวิชา (เลือก เพิ่ม แก้ไข ลบวิชา) */}
              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <span>📚</span>
                    <span>เลือกรายวิชาที่สอน</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManageSubjectsOpen(true)}
                    className="text-[11px] font-bold text-amber-900 hover:text-black bg-amber-200/90 hover:bg-yellow-300 px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <span>⚙️ จัดการวิชา (เพิ่ม/แก้/ลบ)</span>
                  </button>
                </div>

                <select
                  value={selectedSubjectSelect}
                  onChange={(e) => handleSelectSubjectChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-xs"
                >
                  <option value="">-- เลือกจากรายวิชาที่มีอยู่ ({subjects.length} วิชา) --</option>
                  {subjects.map((s) => (
                    <option key={s.id || s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                  <option value="__MANAGE__">➕ จัดการรายวิชา (เพิ่ม/แก้ไข/ลบ)...</option>
                </select>
              </div>

              {/* รหัสวิชา และ ชื่อวิชา */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    รหัสวิชา <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subjectCode}
                    onChange={(e) => {
                      setSubjectCode(e.target.value);
                      setSelectedSubjectSelect('');
                    }}
                    placeholder="เช่น ว21103"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="sm:col-span-7">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ชื่อวิชา <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subjectName}
                    onChange={(e) => {
                      setSubjectName(e.target.value);
                      setSelectedSubjectSelect('');
                    }}
                    placeholder="เช่น วิทยาการคำนวณ 1"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* รายการชิ้นงาน (Dynamic Items) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800">
                    รายการชิ้นงานและคะแนนเต็ม
                  </label>
                  <button
                    type="button"
                    onClick={handleAddAssignmentItem}
                    className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> เพิ่มชิ้นงานอีก
                  </button>
                </div>

                {assignmentItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-4 bg-purple-50/30 rounded-2xl border border-purple-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                      <span className="flex items-center gap-1.5 font-bold">
                        <span>📌 ชิ้นงานที่ {index + 1}</span>
                      </span>
                      {assignmentItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignmentItem(index)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer text-xs flex items-center gap-1 font-medium"
                        >
                          <Trash2 size={13} />
                          <span>ลบรายการนี้</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-8">
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          ชื่องาน / ใบงาน <span className="text-pink-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                          placeholder="ชื่องาน เช่น ใบงานที่ 1: การเขียนผังงาน Flowchart"
                          className="w-full px-3 py-2 bg-white border border-purple-200/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                          คะแนนเต็ม <span className="text-pink-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.maxScore}
                          onChange={(e) => handleItemChange(index, 'maxScore', Number(e.target.value))}
                          placeholder="10"
                          className="w-full px-3 py-2 bg-white border border-purple-200/80 rounded-xl text-xs text-center font-bold text-violet-950 focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                      </div>
                    </div>

                    {/* ชนิดของงาน */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                        <span>🏷️</span>
                        <span>ชนิดของงาน (สำหรับประเมินเกณฑ์ด้วย AI)</span>
                      </label>
                      <select
                        value={item.workType || 'ใบงาน/แบบฝึกหัด'}
                        onChange={(e) => handleItemChange(index, 'workType', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-purple-200/80 rounded-xl text-xs text-gray-800 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                      >
                        {WORK_TYPES.map(wt => (
                          <option key={wt.value} value={wt.value}>
                            {wt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ช่องส่งตัวอย่างใบงาน */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span>📎</span>
                          <span>ช่องส่งตัวอย่างใบงาน / ใบความรู้ / เกณฑ์ของคุณครู</span>
                        </span>
                        <span className="text-[10px] text-gray-400">Google Drive, Docs, Canva, PDF</span>
                      </label>
                      <div className="relative">
                        <input
                          type="url"
                          value={item.sampleUrl || ''}
                          onChange={(e) => handleItemChange(index, 'sampleUrl', e.target.value)}
                          placeholder="https://drive.google.com/... หรือ ลิงก์ตัวอย่างใบงาน"
                          className="w-full pl-3 pr-16 py-2 bg-white border border-purple-200/80 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        {item.sampleUrl && (
                          <a
                            href={item.sampleUrl.startsWith('http') ? item.sampleUrl : `https://${item.sampleUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-md text-[10px] font-bold flex items-center gap-1"
                          >
                            <ExternalLink size={10} />
                            <span>เปิดดู</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ปุ่มบันทึกข้อมูล */}
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-200/80 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Save size={18} />
                <span>บันทึกข้อมูลงาน ✨</span>
              </button>
            </form>
          </div>

          {/* Table: รายการงานที่สร้างไว้ */}
          <div className="lg:col-span-7">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/60 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>งานทั้งหมดที่คุณครูสร้างไว้ ({assignments.filter(a => a.teacherName === activeTeacher.fullName).length} ชิ้นงาน)</span>
                  </h3>
                  <p className="text-xs text-gray-500">สามารถตรวจสอบตัวอย่างใบงานและลบชิ้นงานได้</p>
                </div>
              </div>

              <div className="space-y-3">
                {assignments
                  .filter(a => a.teacherName === activeTeacher.fullName)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="p-4 bg-purple-50/20 hover:bg-purple-50/50 rounded-2xl border border-purple-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-2xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                            {a.subjectCode}
                          </span>
                          <span className="text-xs font-semibold text-gray-600">
                            {a.subjectName}
                          </span>
                          {a.academicYear && (
                            <span className="text-[10px] text-gray-400">
                              (ปี {a.academicYear} เทอม {a.semester || '1'})
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-gray-800">
                          {a.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          <span className="px-2 py-0.5 rounded-md bg-purple-100/60 text-purple-900 font-medium">
                            🏷️ {a.workType || 'ใบงาน/แบบฝึกหัด'}
                          </span>
                          {a.sampleUrl && (
                            <a
                              href={a.sampleUrl.startsWith('http') ? a.sampleUrl : `https://${a.sampleUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-violet-700 hover:underline font-semibold"
                            >
                              <ExternalLink size={11} />
                              <span>ดูตัวอย่างใบงาน</span>
                            </a>
                          )}
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-400">สร้างเมื่อ: {a.createdAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl shadow-2xs">
                            เต็ม {a.maxScore} คะแนน
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenEditAssignment(a)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:text-black bg-amber-100/90 hover:bg-yellow-200 border border-amber-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                          title="แก้ไขชื่อวิชาและใบงาน"
                        >
                          <Edit3 size={13} />
                          <span>แก้ไข</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(a.id, a.title)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบงาน"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                {assignments.filter(a => a.teacherName === activeTeacher.fullName).length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-xs">
                    ยังไม่มีใบงานที่คุณครูสร้างไว้ กรุณากรอกแบบฟอร์มด้านซ้ายเพื่อเพิ่มงาน
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-amber-200 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-amber-200">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    แก้ไขชื่อวิชาและใบงาน
                  </h3>
                  <p className="text-xs text-gray-500">
                    ปรับปรุงข้อมูลวิชา ชื่องาน คะแนน หรือตัวอย่างใบงาน
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingAssignment(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEditAssignment} className="space-y-4">
              {/* ปีการศึกษา และ ภาคเรียน */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ปีการศึกษา
                  </label>
                  <select
                    value={editingAssignment.academicYear || '2567'}
                    onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, academicYear: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    {ACADEMIC_YEARS.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ภาคเรียน
                  </label>
                  <select
                    value={editingAssignment.semester || '1'}
                    onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, semester: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    {SEMESTERS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* รหัสวิชา และ ชื่อวิชา */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    รหัสวิชา <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAssignment.subjectCode}
                    onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, subjectCode: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div className="sm:col-span-8">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ชื่อวิชา <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAssignment.subjectName}
                    onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, subjectName: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              {/* ชื่องาน / ใบงาน */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ชื่องาน / ใบงาน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingAssignment.title}
                  onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              {/* คะแนนเต็ม และ ชนิดของงาน */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    คะแนนเต็ม <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingAssignment.maxScore}
                    onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, maxScore: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-center text-emerald-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ชนิดของงาน
                  </label>
                  <select
                    value={editingAssignment.workType || 'ใบงาน/แบบฝึกหัด'}
                    onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, workType: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    {WORK_TYPES.map(wt => (
                      <option key={wt.value} value={wt.value}>
                        {wt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ลิงก์ตัวอย่างใบงาน */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span>📎 ลิงก์ตัวอย่างใบงาน / ใบความรู้</span>
                  <span className="text-[10px] text-gray-400">Google Drive, Docs, Canva</span>
                </label>
                <input
                  type="url"
                  value={editingAssignment.sampleUrl || ''}
                  onChange={(e) => setEditingAssignment(prev => prev ? { ...prev, sampleUrl: e.target.value } : null)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-center gap-2">
                <span>💡</span>
                <span>เมื่อบันทึกการแก้ไข ข้อมูลในระบบและ Google Sheet จะอัปเดตอัตโนมัติทันที</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-300 transition-all cursor-pointer"
                >
                  <Save size={15} />
                  <span>บันทึกการแก้ไข ✨</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Evaluation Dialog Modal */}
      {activeAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-purple-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-purple-200/90 space-y-5 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-purple-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-purple-200">
                  🤖
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-full text-[11px] font-bold">
                    <Sparkles size={12} className="text-violet-600 animate-spin" />
                    <span>Gemini 3.8 Flash • ประเมินตามชนิดงาน</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                    ผลการประเมินชิ้นงาน: {activeAiModal.submission.studentName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {activeAiModal.submission.assignmentName} ({activeAiModal.submission.gradeLevel}/{activeAiModal.submission.room} เลขที่ {activeAiModal.submission.studentNumber})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveAiModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Work Type Badge & Links */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1 bg-purple-100/90 text-purple-900 font-bold rounded-xl border border-purple-200">
                🏷️ เกณฑ์วิเคราะห์: {activeAiModal.result.workType}
              </span>
              <a
                href={activeAiModal.submission.workUrl.startsWith('http') ? activeAiModal.submission.workUrl : `https://${activeAiModal.submission.workUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl border border-indigo-200 transition-colors"
              >
                <ExternalLink size={12} />
                <span>คลิกเปิดดูผลงานนักเรียน</span>
              </a>
              {activeAiModal.submission.sampleUrl && (
                <a
                  href={activeAiModal.submission.sampleUrl.startsWith('http') ? activeAiModal.submission.sampleUrl : `https://${activeAiModal.submission.sampleUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold rounded-xl border border-violet-200 transition-colors"
                >
                  <FileText size={12} />
                  <span>ดูตัวอย่างใบงานครู</span>
                </a>
              )}
            </div>

            {/* Score Banner */}
            <div className="p-4 bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <div className="text-xs font-semibold text-gray-600">คะแนนที่ AI ประเมินและแนะนำ</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-extrabold text-violet-900 font-mono">
                    {activeAiModal.editableScore}
                  </span>
                  <span className="text-sm font-bold text-gray-500">
                    / {activeAiModal.result.maxScore} คะแนน
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                  คุณครูสามารถปรับคะแนนได้:
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={activeAiModal.result.maxScore}
                  value={activeAiModal.editableScore}
                  onChange={(e) => setActiveAiModal(prev => prev ? { ...prev, editableScore: Number(e.target.value) } : null)}
                  className="w-24 px-3 py-2 bg-white border border-purple-300 rounded-xl text-center text-sm font-bold text-violet-950 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-xs"
                />
              </div>
            </div>

            {/* Rubric Breakdown */}
            {activeAiModal.result.rubricBreakdown && activeAiModal.result.rubricBreakdown.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span>📊</span>
                  <span>การให้คะแนนแยกตามเกณฑ์ (Rubric Breakdown)</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {activeAiModal.result.rubricBreakdown.map((r, idx) => (
                    <div key={idx} className="p-3 bg-purple-50/30 border border-purple-200/60 rounded-xl flex items-center justify-between text-xs gap-3">
                      <div>
                        <div className="font-semibold text-gray-800">{r.criteria}</div>
                        <div className="text-[11px] text-gray-500">{r.comment}</div>
                      </div>
                      <div className="font-bold text-violet-700 bg-violet-100/80 px-2.5 py-1 rounded-lg shrink-0">
                        {r.score} / {r.max}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths and Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1.5">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <ThumbsUp size={14} className="text-emerald-600" />
                  <span>🌟 จุดเด่นของผลงาน</span>
                </div>
                <ul className="text-xs text-emerald-800 space-y-1 list-disc list-inside">
                  {activeAiModal.result.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1.5">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Lightbulb size={14} className="text-amber-600" />
                  <span>💡 สิ่งที่พัฒนาเพิ่มเติมได้</span>
                </div>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                  {activeAiModal.result.improvements.map((imp, i) => (
                    <li key={i}>{imp}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Editable Feedback */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center gap-1.5">
                <span>💬</span>
                <span>คำแนะนำและข้อเสนอแนะสำหรับแจ้งนักเรียน (แก้ไขได้)</span>
              </label>
              <textarea
                rows={3}
                value={activeAiModal.editableFeedback}
                onChange={(e) => setActiveAiModal(prev => prev ? { ...prev, editableFeedback: e.target.value } : null)}
                className="w-full px-4 py-2.5 bg-purple-50/20 border border-purple-200/80 rounded-2xl text-xs text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-purple-100">
              <button
                type="button"
                onClick={() => setActiveAiModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={() => handleApplyAiEvaluation(
                  activeAiModal.submission.id,
                  activeAiModal.editableScore,
                  activeAiModal.editableFeedback
                )}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 hover:from-violet-700 hover:via-indigo-700 hover:to-pink-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Wand2 size={15} />
                <span>✨ ใช้คะแนนและข้อเสนอแนะนี้</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal จัดการรายวิชา (เลือก เพิ่ม แก้ไข ลบ วิชา) */}
      {isManageSubjectsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-amber-300 space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-yellow-400 via-amber-500 to-amber-600 text-white flex items-center justify-center text-xl shadow-md shadow-amber-300 border border-amber-300">
                  📚
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>จัดการรายวิชาของคุณครู</span>
                    <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                      {subjects.length} วิชา
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    เลือก เพิ่ม แก้ไข หรือลบรายวิชา เพื่อใช้สร้างใบงานและตรวจงานนักเรียน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageSubjectsOpen(false);
                  setEditingSubject(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* ส่วน 1: แบบฟอร์มเพิ่มรายวิชาใหม่ */}
            <form onSubmit={handleAddSubject} className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
              <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <span>➕</span>
                <span>เพิ่มรายวิชาใหม่</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    required
                    value={newSubjCode}
                    onChange={(e) => setNewSubjCode(e.target.value)}
                    placeholder="รหัสวิชา เช่น ว21103"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    required
                    value={newSubjName}
                    onChange={(e) => setNewSubjName(e.target.value)}
                    placeholder="ชื่อวิชา เช่น วิทยาการคำนวณ 1"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full h-full py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus size={14} />
                    <span>เพิ่มวิชา</span>
                  </button>
                </div>
              </div>
            </form>

            {/* ส่วน 2: รายการวิชาที่มีในระบบ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span>📋</span>
                  <span>รายวิชาทั้งหมดในระบบ ({subjects.length} วิชา)</span>
                </h4>
                <span className="text-[11px] text-gray-400">
                  คลิกที่ปุ่มเพื่อเลือก / แก้ไข / ลบ
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {subjects.map((s) => {
                  const isEditingThis = editingSubject?.oldCode === s.code;
                  const countAssignments = assignments.filter(a => a.subjectCode === s.code).length;

                  if (isEditingThis) {
                    return (
                      <form
                        key={s.code}
                        onSubmit={handleSaveEditSubject}
                        className="p-3 bg-yellow-50 rounded-2xl border-2 border-amber-400 space-y-2 animate-in fade-in duration-100"
                      >
                        <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                          <span>✏️</span>
                          <span>แก้ไขข้อมูลวิชา:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-4">
                            <input
                              type="text"
                              required
                              value={editingSubject.code}
                              onChange={(e) => setEditingSubject(prev => prev ? { ...prev, code: e.target.value } : null)}
                              className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                          <div className="sm:col-span-8">
                            <input
                              type="text"
                              required
                              value={editingSubject.name}
                              onChange={(e) => setEditingSubject(prev => prev ? { ...prev, name: e.target.value } : null)}
                              className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingSubject(null)}
                            className="px-3 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <Save size={12} />
                            <span>บันทึกวิชา</span>
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={s.code}
                      className="p-3 bg-white hover:bg-amber-50/50 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-3 transition-colors shadow-2xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shrink-0">
                          {s.code}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">
                            {s.name}
                          </p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                            <span>มีใบงาน {countAssignments} ชิ้นงาน</span>
                            {s.teacherName && (
                              <>
                                <span>•</span>
                                <span>{s.teacherName}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* ปุ่มเลือกวิชานี้ */}
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectCode(s.code);
                            setSubjectName(s.name);
                            setSelectedSubjectSelect(s.code);
                            setIsManageSubjectsOpen(false);
                            alertService.success('เลือกวิชาแล้ว', `เลือกวิชา "${s.code} ${s.name}" สำหรับสร้างงาน`);
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                          title="เลือกวิชานี้เพื่อสร้างงาน"
                        >
                          ✓ เลือก
                        </button>

                        {/* ปุ่มแก้ไข */}
                        <button
                          type="button"
                          onClick={() => setEditingSubject({ oldCode: s.code, code: s.code, name: s.name })}
                          className="p-1.5 text-amber-800 hover:text-black hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                          title="แก้ไขรหัสวิชาและชื่อวิชา"
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* ปุ่มลบ */}
                        <button
                          type="button"
                          onClick={() => handleDeleteSubject(s.code, s.name)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                          title="ลบวิชานี้"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {subjects.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    ยังไม่มีรายวิชาในระบบ คุณครูสามารถเพิ่มวิชาใหม่ได้จากแบบฟอร์มด้านบน
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-amber-900/80 flex items-center gap-1">
                <span>💡</span>
                <span>เมื่อแก้ไขหรือลบวิชา ข้อมูลในใบงานและการส่งงานจะอัปเดตให้อัตโนมัติ</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsManageSubjectsOpen(false);
                  setEditingSubject(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: แก้ไขข้อมูลนักเรียน (EDIT STUDENT INFO) */}
      {editingStudentSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-purple-100 space-y-5">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg font-bold">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">แก้ไขข้อมูลนักเรียน</h3>
                  <p className="text-xs text-gray-500 truncate max-w-xs">งาน: {editingStudentSub.assignmentName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudentSub(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ชื่อ-นามสกุล นักเรียน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingStudentSub.studentName}
                  onChange={(e) => setEditingStudentSub(prev => prev ? { ...prev, studentName: e.target.value } : null)}
                  placeholder="เช่น ด.ช. สมชาย รักเรียน"
                  className="w-full px-3 py-2.5 bg-purple-50/20 border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    เลขที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudentSub.studentNumber}
                    onChange={(e) => setEditingStudentSub(prev => prev ? { ...prev, studentNumber: e.target.value } : null)}
                    placeholder="เช่น 1"
                    className="w-full px-3 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ระดับชั้น <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editingStudentSub.gradeLevel}
                    onChange={(e) => setEditingStudentSub(prev => prev ? { ...prev, gradeLevel: e.target.value as any } : null)}
                    className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    {GRADE_LEVELS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ห้อง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editingStudentSub.room}
                    onChange={(e) => setEditingStudentSub(prev => prev ? { ...prev, room: e.target.value } : null)}
                    className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    {ROOMS.map(r => (
                      <option key={r} value={r}>ห้อง {r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ลิงก์ผลงานที่ส่ง (URL)
                </label>
                <input
                  type="url"
                  value={editingStudentSub.workUrl}
                  onChange={(e) => setEditingStudentSub(prev => prev ? { ...prev, workUrl: e.target.value } : null)}
                  placeholder="https://drive.google.com/... หรือ ลิงก์งาน"
                  className="w-full px-3 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setEditingStudentSub(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
