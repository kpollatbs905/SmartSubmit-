/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Users,
  Upload,
  Download,
  FileUp,
  BarChart3,
  PieChart,
  TrendingUp,
  SlidersHorizontal,
  Activity,
  Layers,
  ArrowUpRight,
  RotateCcw,
  Clock,
  Target,
  CheckCircle2,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Teacher, Assignment, Submission, AssignmentItem, Subject, GoogleSheetConfig, GradeLevel, StudentRosterItem } from '../types';
import { DEPARTMENTS, GRADE_LEVELS, ROOMS, ACADEMIC_YEARS, SEMESTERS, WORK_TYPES } from '../constants';
import { storageService, normalizeRoom, normalizeGradeLevel } from '../services/storageService';
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

  // Teacher dashboard sub-tab: 'dashboard' (แดชบอร์ดรายวิชา/รายห้อง), 'grade' (ตรวจงาน), 'report' (รายงานรายห้องและคะแนน AI), 'students' (จัดการ/ลบข้อมูลนักเรียน), or 'assignments' (จัดการงาน)
  const [teacherTab, setTeacherTab] = useState<'dashboard' | 'grade' | 'report' | 'students' | 'assignments'>('dashboard');

  // Helper to normalize and match teacher names flexibly
  const cleanTeacherName = (name?: string) => {
    if (!name) return '';
    return name
      .replace(/^(ครูผู้สอน|คุณครู|อาจารย์|ครู|อ\.)\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const matchesTeacher = (subTeacher?: string, filterTeacherVal?: string) => {
    if (!filterTeacherVal || filterTeacherVal === 'ALL') return true;
    if (!subTeacher) return false;
    const s1 = cleanTeacherName(subTeacher);
    const s2 = cleanTeacherName(filterTeacherVal);
    if (!s1 || !s2) return true;
    return s1 === s2 || s1.includes(s2) || s2.includes(s1);
  };

  // Subject Management States (Declared early for use in teacherSubjects computation)
  const [subjects, setSubjects] = useState<Subject[]>(() => storageService.getSubjects());
  const [selectedSubjectSelect, setSelectedSubjectSelect] = useState<string>('');
  const [isManageSubjectsOpen, setIsManageSubjectsOpen] = useState(false);
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjName, setNewSubjName] = useState('');
  const [editingSubject, setEditingSubject] = useState<{ oldCode: string; code: string; name: string } | null>(null);

  // คำนวณปีการศึกษาและภาคเรียนล่าสุดของครูผู้สอนท่านนี้ (จากงานและข้อมูลการส่งงาน)
  const { latestYear, latestSemester } = useMemo(() => {
    const teacherAssignments = activeTeacher 
      ? assignments.filter(a => matchesTeacher(a.teacherName, activeTeacher.fullName))
      : assignments;
    const teacherSubs = activeTeacher
      ? submissions.filter(s => matchesTeacher(s.teacherName, activeTeacher.fullName))
      : submissions;

    const validYears = [
      ...teacherAssignments.map(a => a.academicYear?.trim()),
      ...teacherSubs.map(s => s.academicYear?.trim()),
      ...assignments.map(a => a.academicYear?.trim()),
      ...submissions.map(s => s.academicYear?.trim()),
    ].filter((y): y is string => Boolean(y && y.length > 0));

    let bestYear = '2567';
    if (validYears.length > 0) {
      const sortedYears = [...new Set(validYears)].sort((a, b) => {
        const numA = parseInt(a, 10) || 0;
        const numB = parseInt(b, 10) || 0;
        return numB - numA;
      });
      bestYear = sortedYears[0];
    }

    const validSemesters = [
      ...teacherAssignments.filter(a => (!a.academicYear || a.academicYear.trim() === bestYear)).map(a => a.semester?.trim()),
      ...teacherSubs.filter(s => (!s.academicYear || s.academicYear.trim() === bestYear)).map(s => s.semester?.trim()),
      ...assignments.filter(a => (!a.academicYear || a.academicYear.trim() === bestYear)).map(a => a.semester?.trim()),
      ...submissions.filter(s => (!s.academicYear || s.academicYear.trim() === bestYear)).map(s => s.semester?.trim()),
    ].filter((s): s is string => Boolean(s && s.length > 0));

    let bestSem = '1';
    if (validSemesters.length > 0) {
      const sortedSem = [...new Set(validSemesters)].sort((a, b) => {
        const numA = parseInt(a, 10) || 0;
        const numB = parseInt(b, 10) || 0;
        return numB - numA;
      });
      bestSem = sortedSem[0];
    }

    return { latestYear: bestYear, latestSemester: bestSem };
  }, [assignments, submissions, activeTeacher]);

  // รายการปีการศึกษาทั้งหมดในระบบสำหรับให้เลือกใน Dropdown
  const availableAcademicYears = useMemo(() => {
    const set = new Set([
      ...ACADEMIC_YEARS,
      ...assignments.map(a => a.academicYear?.trim()).filter(Boolean) as string[],
      ...submissions.map(s => s.academicYear?.trim()).filter(Boolean) as string[],
    ]);
    return Array.from(set).sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
  }, [assignments, submissions]);

  // รายวิชาที่ครูท่านนี้สอน ที่นำข้อมูลเข้า หรือมีนักเรียนส่งงาน
  const teacherSubjects = useMemo(() => {
    const unique = new Map<string, string>();

    // 1. จากงานที่ครูท่านนี้สร้าง
    assignments
      .filter(a => !activeTeacher || matchesTeacher(a.teacherName, activeTeacher.fullName))
      .forEach(a => {
        if (a.subjectCode) {
          unique.set(a.subjectCode, `${a.subjectCode} ${a.subjectName || ''}`.trim());
        }
      });

    // 2. จากการส่งงานหรือรายชื่อที่นำเข้าของครูท่านนี้
    submissions
      .filter(s => !activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName))
      .forEach(s => {
        if (s.subjectCode) {
          unique.set(s.subjectCode, `${s.subjectCode} ${s.subjectName || ''}`.trim());
        } else if (s.subjectName) {
          unique.set(s.subjectName, s.subjectName);
        }
      });

    // 3. จากวิชาที่ลงทะเบียนของครูท่านนี้
    subjects
      .filter(s => !s.teacherName || !activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName))
      .forEach(s => {
        if (s.code && (!activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName))) {
          unique.set(s.code, `${s.code} ${s.name || ''}`.trim());
        }
      });

    // ถ้าครูเพิ่งเริ่มใช้ระบบยังไม่มีงาน ให้แสดงวิชาทั้งหมดเพื่อให้เลือกเริ่มต้นสร้างงานได้
    if (unique.size === 0) {
      subjects.forEach(s => {
        if (s.code) unique.set(s.code, `${s.code} ${s.name || ''}`.trim());
      });
      assignments.forEach(a => {
        if (a.subjectCode) unique.set(a.subjectCode, `${a.subjectCode} ${a.subjectName || ''}`.trim());
      });
      submissions.forEach(s => {
        if (s.subjectCode) unique.set(s.subjectCode, `${s.subjectCode} ${s.subjectName || ''}`.trim());
      });
    }

    return Array.from(unique.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [subjects, assignments, submissions, activeTeacher]);

  // Student Roster from Excel Uploads
  const [rosterList, setRosterList] = useState<StudentRosterItem[]>(() => storageService.getStudentRoster());

  // ห้องเรียนและชั้นที่ครูท่านนี้สอน ที่นำข้อมูลเข้า มีนักเรียนส่งงาน หรือมีรายชื่อที่อัปโหลดไว้
  const teacherClassrooms = useMemo(() => {
    const mySubmissions = submissions.filter(
      s => !activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName)
    );
    const myRoster = rosterList.filter(
      r => !activeTeacher || !r.importedBy || matchesTeacher(r.importedBy, activeTeacher.fullName)
    );

    const gradeSet = new Set<GradeLevel>();
    const roomSet = new Set<string>();
    const roomsByGradeMap = new Map<GradeLevel, Set<string>>();

    mySubmissions.forEach(s => {
      const g = s.gradeLevel || normalizeGradeLevel(s.gradeLevel);
      const r = normalizeRoom(s.room);
      if (g) {
        gradeSet.add(g);
        if (!roomsByGradeMap.has(g)) {
          roomsByGradeMap.set(g, new Set<string>());
        }
        if (r) {
          roomSet.add(r);
          roomsByGradeMap.get(g)!.add(r);
        }
      }
    });

    myRoster.forEach(rosterItem => {
      const g = rosterItem.gradeLevel || normalizeGradeLevel(rosterItem.gradeLevel);
      const r = normalizeRoom(rosterItem.room);
      if (g) {
        gradeSet.add(g);
        if (!roomsByGradeMap.has(g)) {
          roomsByGradeMap.set(g, new Set<string>());
        }
        if (r) {
          roomSet.add(r);
          roomsByGradeMap.get(g)!.add(r);
        }
      }
    });

    const activeGrades = Array.from(gradeSet).sort((a, b) => a.localeCompare(b));
    const activeRooms = Array.from(roomSet).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));

    const roomsByGrade: Record<string, string[]> = {};
    roomsByGradeMap.forEach((rooms, grade) => {
      roomsByGrade[grade] = Array.from(rooms).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
    });

    return {
      grades: activeGrades.length > 0 ? activeGrades : GRADE_LEVELS,
      rooms: activeRooms.length > 0 ? activeRooms : ROOMS,
      roomsByGrade,
      hasData: activeGrades.length > 0,
      firstGrade: activeGrades[0] || 'ม.1',
      firstRoom: (activeGrades[0] && roomsByGrade[activeGrades[0]]?.[0]) || activeRooms[0] || '1',
    };
  }, [submissions, rosterList, activeTeacher]);

  // Dashboard Analytics Filter States (กรองข้อมูลดูในแต่ละรายวิชา แต่ละห้อง - ไม่ต้องกรองชื่อผู้สอนคนอื่น)
  const [dashSubject, setDashSubject] = useState<string>('ALL');
  const [dashGrade, setDashGrade] = useState<string>('ALL');
  const [dashRoom, setDashRoom] = useState<string>('ALL');
  const [dashAssignment, setDashAssignment] = useState<string>('ALL');
  const [dashYear, setDashYear] = useState<string>(latestYear);
  const [dashSemester, setDashSemester] = useState<string>(latestSemester);
  const [dashStatus, setDashStatus] = useState<string>('ALL');
  const [dashSearch, setDashSearch] = useState<string>('');

  // Classroom Report States (รายงานการส่งงานรายห้อง พร้อมคะแนน AI และติดตามคนค้างส่ง)
  const [reportYear, setReportYear] = useState<string>(latestYear);
  const [reportSemester, setReportSemester] = useState<string>(latestSemester);
  const [reportGrade, setReportGrade] = useState<string>(teacherClassrooms.firstGrade);
  const [reportRoom, setReportRoom] = useState<string>(teacherClassrooms.firstRoom);
  const [reportSubject, setReportSubject] = useState<string>('ALL');
  const [reportAssignment, setReportAssignment] = useState<string>('ALL');
  const [reportStatus, setReportStatus] = useState<string>('ALL');
  const [reportFilterStatus, setReportFilterStatus] = useState<'ALL' | 'SUBMITTED' | 'MISSING' | 'GRADED' | 'WAITING'>('ALL');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [selectedAiDetail, setSelectedAiDetail] = useState<Submission | null>(null);
  const [isBatchEvaluating, setIsBatchEvaluating] = useState<boolean>(false);
  const [selectedReportSubIds, setSelectedReportSubIds] = useState<string[]>([]);
  const [showAllRooms, setShowAllRooms] = useState<boolean>(false);
  const [copiedMissingNotice, setCopiedMissingNotice] = useState<boolean>(false);

  // Quick Offline/In-Class Recording Modal State
  const [offlineModal, setOfflineModal] = useState<{
    isOpen: boolean;
    studentName: string;
    studentNumber: string;
    gradeLevel: GradeLevel;
    room: string;
    assignmentId: string;
    assignmentName: string;
    subjectCode: string;
    subjectName: string;
    maxScore: number;
    score: string;
    feedback: string;
    workUrl: string;
  } | null>(null);

  // Student Data & Deletion Management States (สลับดู Roster จาก Excel หรือ Submissions)
  const [studentManageViewMode, setStudentManageViewMode] = useState<'roster' | 'submissions'>('roster');
  const [studentManageYear, setStudentManageYear] = useState<string>(latestYear);
  const [studentManageSemester, setStudentManageSemester] = useState<string>(latestSemester);
  const [studentManageGrade, setStudentManageGrade] = useState<string>('ALL');
  const [studentManageRoom, setStudentManageRoom] = useState<string>('ALL');
  const [studentManageSubject, setStudentManageSubject] = useState<string>('ALL');
  const [studentManageSearch, setStudentManageSearch] = useState<string>('');
  const [selectedStudentManageIds, setSelectedStudentManageIds] = useState<string[]>([]);
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);

  // Excel Student Roster Upload States
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [parsedRosterList, setParsedRosterList] = useState<Array<{
    studentNumber: string;
    studentName: string;
    gradeLevel?: GradeLevel;
    room?: string;
    academicYear?: string;
    semester?: string;
  }>>([]);
  const [importTargetGrade, setImportTargetGrade] = useState<GradeLevel>('ม.1');
  const [importTargetRoom, setImportTargetRoom] = useState<string>('1');
  const [importTargetYear, setImportTargetYear] = useState<string>(latestYear);
  const [importTargetSemester, setImportTargetSemester] = useState<string>(latestSemester);
  const [importCreateSubmissions, setImportCreateSubmissions] = useState<boolean>(true);
  const [importSelectedAssignmentId, setImportSelectedAssignmentId] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Add Assignment form states
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [assignYear, setAssignYear] = useState(latestYear);
  const [assignSemester, setAssignSemester] = useState(latestSemester);
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
  const [filterYear, setFilterYear] = useState<string>(latestYear);
  const [filterSemester, setFilterSemester] = useState<string>(latestSemester);
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [filterRoom, setFilterRoom] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAiStatus, setFilterAiStatus] = useState<'ALL' | 'EVALUATED' | 'PENDING'>('ALL');
  const [gradingSearch, setGradingSearch] = useState('');
  const [isGradingBatchEvaluating, setIsGradingBatchEvaluating] = useState<boolean>(false);

  // Auto-sync filters to latest academic year & semester and active teacher's classroom
  const lastTeacherSyncRef = useRef<string>('');
  useEffect(() => {
    const currentKey = `${activeTeacher?.id || 'none'}-${latestYear}-${latestSemester}`;
    if (lastTeacherSyncRef.current !== currentKey) {
      lastTeacherSyncRef.current = currentKey;
      setDashYear(latestYear);
      setDashSemester(latestSemester);
      setReportYear(latestYear);
      setReportSemester(latestSemester);
      setStudentManageYear(latestYear);
      setStudentManageSemester(latestSemester);
      setFilterYear(latestYear);
      setFilterSemester(latestSemester);
      if (teacherClassrooms.hasData) {
        setReportGrade(teacherClassrooms.firstGrade);
        setReportRoom(teacherClassrooms.firstRoom);
      }
    }
  }, [activeTeacher?.id, latestYear, latestSemester, teacherClassrooms]);

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
  // EXCEL STUDENT ROSTER HANDLERS (อัปโหลดรายชื่อนักเรียนจาก Excel)
  // -------------------------------------------------------------
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setExcelFileName(file.name);
    setIsParsingExcel(true);

    try {
      const buffer = await file.arrayBuffer();
      const result = storageService.parseStudentRosterExcel(buffer);

      if (result.success && result.data && result.data.length > 0) {
        setParsedRosterList(result.data);
        
        // Auto-detect grade and room if first student has it
        if (result.data[0].gradeLevel) {
          setImportTargetGrade(result.data[0].gradeLevel);
        }
        if (result.data[0].room) {
          setImportTargetRoom(result.data[0].room);
        }
        if (result.data[0].academicYear) {
          setImportTargetYear(result.data[0].academicYear);
        }
        if (result.data[0].semester) {
          setImportTargetSemester(result.data[0].semester);
        }
        
        alertService.success('อ่านไฟล์ Excel สำเร็จ', `พบข้อมูลนักเรียนทั้งหมด ${result.data.length} คน พร้อมนำเข้า`);
      } else {
        setParsedRosterList([]);
        alertService.error('ไม่สามารถอ่านไฟล์ได้', result.error || 'โปรดตรวจสอบรูปแบบหัวตารางของไฟล์ Excel');
      }
    } catch (err: any) {
      alertService.error('เกิดข้อผิดพลาดในการเปิดไฟล์', err?.message || 'ไฟล์อาจเสียหายหรือไม่ใช่ไฟล์ Excel ที่ถูกต้อง');
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleConfirmImportRoster = async () => {
    if (parsedRosterList.length === 0) {
      alertService.error('ไม่มีข้อมูลนักเรียน', 'โปรดเลือกไฟล์ Excel ที่มีข้อมูลนักเรียนก่อนกดยืนยัน');
      return;
    }

    try {
      setIsImporting(true);
      alertService.loading('กำลังนำเข้ารายชื่อนักเรียน...', `ระบบกำลังบันทึกนักเรียน ${parsedRosterList.length} คน เข้าสู่ห้อง ${importTargetGrade}/${importTargetRoom}`);

      const targetAssignment = assignments.find(a => a.id === importSelectedAssignmentId);

      const normalizedStudents = parsedRosterList.map(s => ({
        studentNumber: s.studentNumber,
        studentName: s.studentName,
        gradeLevel: s.gradeLevel || importTargetGrade,
        room: s.room || importTargetRoom,
        academicYear: s.academicYear || importTargetYear,
        semester: s.semester || importTargetSemester,
      }));

      const res = await storageService.importStudentsToRoster(normalizedStudents, {
        teacherName: activeTeacher?.fullName || 'ครูผู้สอน',
        targetAssignment,
        createSubmissions: importCreateSubmissions && !!targetAssignment,
        config: sheetConfig,
      });

      setRosterList(storageService.getStudentRoster());
      await onRefreshData();
      onSubmissionsChange();
      setIsImporting(false);
      alertService.close();

      if (res.success) {
        setIsExcelImportOpen(false);
        setExcelFile(null);
        setParsedRosterList([]);
        setExcelFileName('');
        alertService.success('นำเข้ารายชื่อนักเรียนสำเร็จ! 🎉', res.message);
      } else {
        alertService.error('นำเข้าไม่สำเร็จ', res.message);
      }
    } catch (err: any) {
      setIsImporting(false);
      alertService.close();
      alertService.error('เกิดข้อผิดพลาดในการนำเข้า', err?.message || 'โปรดตรวจสอบข้อมูล');
    }
  };

  const handleDownloadRosterTemplate = () => {
    storageService.downloadStudentRosterTemplate(importTargetGrade, importTargetRoom);
    alertService.success('ดาวน์โหลดแม่แบบสำเร็จ', 'ไฟล์แม่แบบ Excel พร้อมตัวอย่างข้อมูลได้รับการดาวน์โหลดแล้ว');
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
      storageService.deleteRosterByRoom(targetGrade, targetRoom, targetYear, targetSemester);
      setRosterList(storageService.getStudentRoster());
      setSelectedStudentManageIds(prev => prev.filter(id => !targetIds.includes(id)));
      setSelectedReportSubIds(prev => prev.filter(id => !targetIds.includes(id)));
      setSelectedRosterIds([]);
      onSubmissionsChange();
      await onRefreshData();
      alertService.close();

      if (res.success) {
        await alertService.success('ลบข้อมูลทั้งห้องสำเร็จ!', `ลบข้อมูลห้อง ${targetGrade}/${targetRoom} จำนวน ${res.count} รายการ และล้างบัญชีรายชื่อห้องนี้เรียบร้อยแล้ว`);
      } else {
        alertService.error('เกิดข้อผิดพลาดในการลบ', res.message);
      }
    }
  };

  // ลบข้อมูลนักเรียนรายบุคคลที่เลือก (Delete Selected Individuals from Submissions)
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

  // ลบรายชื่อนักเรียนใน Roster ที่เลือก (Delete Selected from Uploaded Roster)
  const handleDeleteSelectedRosterStudents = async (idsToDelete: string[]) => {
    if (!idsToDelete || idsToDelete.length === 0) {
      alertService.info('ยังไม่ได้เลือกนักเรียน', 'กรุณาติ๊กเลือกนักเรียนในบัญชีรายชื่ออย่างน้อย 1 คน');
      return;
    }

    const selectedRosters = rosterList.filter(r => idsToDelete.includes(r.id));
    const sampleNames = selectedRosters.slice(0, 4).map(r => `• ${r.studentName} (เลขที่ ${r.studentNumber} ห้อง ${r.gradeLevel}/${r.room})`).join('<br/>');
    const remainingCount = selectedRosters.length - 4;
    const moreText = remainingCount > 0 ? `<br/><span class="text-gray-400">...และอีก ${remainingCount} คน</span>` : '';

    const result = await Swal.fire({
      title: '🗑️ ลบรายชื่อนักเรียนที่เลือก?',
      html: `
        <div class="text-left text-xs space-y-2 font-['Kanit',sans-serif]">
          <p class="font-bold text-gray-800 text-sm">คุณต้องการลบรายชื่อนักเรียนที่เลือกจำนวน <span class="text-rose-600 font-black">${idsToDelete.length}</span> คน ออกจากบัญชีรายชื่อห้องนี้?</p>
          <div class="p-3 bg-purple-50/80 rounded-2xl border border-purple-200 text-gray-700 space-y-1">
            <p class="text-[11px] font-bold text-violet-900 mb-1">รายชื่อตัวอย่างที่เลือก:</p>
            <div class="text-xs text-gray-800 pl-1 leading-relaxed">${sampleNames}${moreText}</div>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `🗑️ ยืนยันลบ (${idsToDelete.length} คน)`,
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
    });

    if (result.isConfirmed) {
      storageService.deleteMultipleStudentsFromRoster(idsToDelete);
      setRosterList(storageService.getStudentRoster());
      setSelectedRosterIds([]);
      await alertService.success('ลบรายชื่อสำเร็จ!', `ลบรายชื่อนักเรียน ${idsToDelete.length} คนออกจากบัญชีรายชื่อเรียบร้อยแล้ว`);
    }
  };

  // ลบรายชื่อนักเรียนคนเดียวใน Roster
  const handleDeleteSingleRosterStudent = async (rosterItem: StudentRosterItem) => {
    const result = await Swal.fire({
      title: '🗑️ ยืนยันลบรายชื่อนักเรียน?',
      html: `
        <div class="text-left text-xs space-y-2 font-['Kanit',sans-serif]">
          <p class="font-bold text-gray-800">คุณต้องการลบรายชื่อนี้ออกจากบัญชีรายชื่อห้อง ${rosterItem.gradeLevel}/${rosterItem.room} ใช่หรือไม่?</p>
          <div class="p-3 bg-purple-50 rounded-2xl border border-purple-200">
            <p class="font-bold text-violet-900">🧑‍🎓 ${rosterItem.studentName} (เลขที่ ${rosterItem.studentNumber})</p>
            <p class="text-[11px] text-gray-500 mt-1">ระดับชั้น ${rosterItem.gradeLevel}/${rosterItem.room} • ปีการศึกษา ${rosterItem.academicYear || '-'}</p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ ยืนยันลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
    });

    if (result.isConfirmed) {
      storageService.deleteStudentFromRoster(rosterItem.id);
      setRosterList(storageService.getStudentRoster());
      setSelectedRosterIds(prev => prev.filter(id => id !== rosterItem.id));
      alertService.success('ลบรายชื่อเรียบร้อย', `ลบ "${rosterItem.studentName}" ออกจากบัญชีรายชื่อแล้ว`);
    }
  };

  // แก้ไขรายชื่อนักเรียนใน Roster
  const handleEditRosterStudent = async (rosterItem: StudentRosterItem) => {
    const { value: formValues } = await Swal.fire({
      title: '✏️ แก้ไขข้อมูลนักเรียน',
      html: `
        <div class="text-left text-xs space-y-3 font-['Kanit',sans-serif]">
          <div>
            <label class="block text-gray-700 font-bold mb-1">เลขที่:</label>
            <input id="swal-roster-number" class="swal2-input !m-0 !w-full text-xs" value="${rosterItem.studentNumber}">
          </div>
          <div>
            <label class="block text-gray-700 font-bold mb-1">ชื่อ-นามสกุล:</label>
            <input id="swal-roster-name" class="swal2-input !m-0 !w-full text-xs" value="${rosterItem.studentName}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '💾 บันทึกการแก้ไข',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED',
      preConfirm: () => {
        const num = (document.getElementById('swal-roster-number') as HTMLInputElement)?.value;
        const name = (document.getElementById('swal-roster-name') as HTMLInputElement)?.value;
        if (!name || !name.trim()) {
          Swal.showValidationMessage('กรุณากรอกชื่อ-นามสกุล');
          return false;
        }
        return { studentNumber: num.trim(), studentName: name.trim() };
      }
    });

    if (formValues) {
      storageService.updateStudentInRoster(rosterItem.id, formValues);
      setRosterList(storageService.getStudentRoster());
      alertService.success('แก้ไขข้อมูลสำเร็จ', `อัปเดตข้อมูลของ ${formValues.studentName} เรียบร้อยแล้ว`);
    }
  };

  // เคลียร์ข้อมูลตัวอย่าง (Mock Data) ทั้งหมด
  const handleClearAllSampleData = async () => {
    const confirm = await Swal.fire({
      title: '🧹 เคลียร์ข้อมูลตัวอย่างทั้งหมด?',
      html: `
        <div class="text-left text-xs space-y-2.5 font-['Kanit',sans-serif]">
          <p class="font-bold text-gray-800 text-sm">ระบบจะลบข้อมูลงานส่งตัวอย่าง (Sample Mock Data) ออกทั้งหมด</p>
          <p class="text-gray-600">จะคงเหลือไว้เฉพาะรายชื่อนักเรียนจริงที่ครูอัปโหลดผ่าน Excel และผลงานจริงที่นักเรียนส่งเข้ามาเท่านั้น</p>
          <div class="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
            💡 เหมาะสำหรับเริ่มต้นใช้งานจริง เพื่อไม่ให้มีคะแนนหรือรายชื่อทดสอบปนในรายงาน
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🧹 ล้างข้อมูลตัวอย่าง',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
    });

    if (confirm.isConfirmed) {
      const res = storageService.clearAllSampleData();
      setRosterList(storageService.getStudentRoster());
      onSubmissionsChange();
      await onRefreshData();
      await alertService.success('เคลียร์ข้อมูลตัวอย่างสำเร็จ! 🎉', `นำข้อมูลตัวอย่างออกแล้ว ${res.removedCount} รายการ ระบบพร้อมใช้งานกับข้อมูลจริง`);
    }
  };

  // -------------------------------------------------------------
  // GRADING HANDLERS
  // -------------------------------------------------------------
  // Filter submissions for this teacher (or all submissions with filters)
  const teacherSubmissions = React.useMemo(() => {
    return submissions.filter(s => {
      // 1. Teacher match: strictly scope to activeTeacher
      const matchTeacher = !activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName);

      // 2. Year & Semester match
      const subYear = (s.academicYear && s.academicYear.trim()) || '2567';
      const matchYear = filterYear === 'ALL' || subYear === filterYear;

      const subSemester = (s.semester && s.semester.trim()) || '1';
      const matchSemester = filterSemester === 'ALL' || subSemester === filterSemester;

      // 3. Subject match
      const matchSubject = filterSubject === 'ALL' ||
        s.subjectCode === filterSubject ||
        s.subjectName === filterSubject ||
        (s.subjectCode && filterSubject.includes(s.subjectCode)) ||
        (filterSubject && s.subjectCode && filterSubject.includes(s.subjectCode)) ||
        (s.subjectName && filterSubject.includes(s.subjectName));

      // 4. Grade & Room match
      const matchGrade = filterGrade === 'ALL' || s.gradeLevel === filterGrade;
      const matchRoom = filterRoom === 'ALL' || s.room === filterRoom;

      // 5. Status match - treat missing status as 'รอตรวจ' (unless score is already recorded)
      const effectiveStatus = s.status || (s.score !== null && s.score !== undefined ? 'ตรวจแล้ว' : 'รอตรวจ');
      const matchStatus = filterStatus === 'ALL' || effectiveStatus === filterStatus;

      // 6. AI Status filter
      const hasAiEvaluation = Boolean(s.aiEvaluation && s.aiEvaluation.suggestedScore !== undefined);
      const matchAi = filterAiStatus === 'ALL' || 
        (filterAiStatus === 'EVALUATED' && hasAiEvaluation) || 
        (filterAiStatus === 'PENDING' && !hasAiEvaluation);
      
      // 7. Search query match
      const q = gradingSearch.trim().toLowerCase();
      const matchQuery = !q || (
        s.studentName.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        s.assignmentName.toLowerCase().includes(q) ||
        (s.subjectCode && s.subjectCode.toLowerCase().includes(q)) ||
        (s.subjectName && s.subjectName.toLowerCase().includes(q))
      );

      return matchTeacher && matchYear && matchSemester && matchSubject && matchGrade && matchRoom && matchStatus && matchAi && matchQuery;
    });
  }, [submissions, activeTeacher, filterYear, filterSemester, filterSubject, filterGrade, filterRoom, filterStatus, filterAiStatus, gradingSearch]);

  // Batch AI Evaluation for all currently filtered submissions on Grading page
  const handleBatchAiEvaluateGrading = async (evaluateMode: 'all' | 'unevaluated' = 'unevaluated') => {
    if (teacherSubmissions.length === 0) {
      alertService.info('ไม่มีผลงานตามตัวกรอง', 'กรุณาปรับตัวกรองเพื่อให้มีรายการส่งงาน');
      return;
    }

    const pending = teacherSubmissions.filter(s => !s.aiEvaluation || s.aiEvaluation.suggestedScore === undefined);
    const targets = evaluateMode === 'unevaluated' && pending.length > 0 ? pending : teacherSubmissions;

    if (targets.length === 0) {
      alertService.info('ผลงานทั้งหมดตรวจโดย AI ครบแล้ว', 'รายการที่กรองอยู่ได้รับการประเมินจาก AI ครบทุกชิ้นแล้ว หรือสามารถเลือก "ตรวจใหม่ทั้งหมด" ได้');
      return;
    }

    const confirm = await Swal.fire({
      title: '🤖 ให้ AI ตรวจประเมินผลงานทั้งหมด?',
      html: `
        <div class="text-left text-sm space-y-2">
          <p class="font-medium text-gray-800">ระบบ AI จะวิเคราะห์ผลงานและให้คะแนนตามเกณฑ์ของรายการที่กรองอยู่ทั้งหมด</p>
          <div class="bg-violet-50 p-3 rounded-xl border border-violet-200 text-xs space-y-1">
            <p>• จำนวนผลงานที่จะตรวจ: <b class="text-violet-700 font-bold">${targets.length}</b> ชิ้นงาน</p>
            <p>• รูปแบบ: <span class="font-semibold text-gray-700">${evaluateMode === 'unevaluated' ? 'เฉพาะที่ยังไม่ตรวจ' : 'ตรวจประเมินทั้งหมด'}</span></p>
          </div>
          <p class="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
            💡 AI จะประเมินคะแนน จุดเด่น และคำแนะนำให้อัตโนมัติ คุณครูสามารถนำคะแนนไปใส่ช่องตรวจได้ทันที
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 เริ่มให้ AI ตรวจทั้งหมด',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#7C3AED',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
      }
    });

    if (!confirm.isConfirmed) return;

    setIsGradingBatchEvaluating(true);
    let successCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const sub = targets[i];
      alertService.loading(
        `🤖 AI กำลังประเมินผลงาน ${i + 1}/${targets.length}`,
        `นักเรียน: ${sub.studentName} (${sub.gradeLevel}/${sub.room} เลขที่ ${sub.studentNumber}) • ชื่องาน: ${sub.assignmentName}`
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
        console.warn(`Error AI evaluating ${sub.id}:`, err);
      }
    }

    setIsGradingBatchEvaluating(false);
    alertService.close();
    onSubmissionsChange();

    await Swal.fire({
      title: '✨ AI ตรวจประเมินผลงานเสร็จสิ้น!',
      html: `
        <div class="text-sm space-y-2">
          <p>ประเมินและให้คะแนนสำเร็จ <b>${successCount}</b> จาก ${targets.length} ชิ้นงาน</p>
          <p class="text-xs text-gray-600">ท่านสามารถกดปุ่ม <b>"⚡ นำคะแนน AI ใส่ช่องครูทั้งหมด"</b> เพื่อใส่คะแนนและข้อเสนอแนะลงในช่องตรวจคะแนนได้ทันที</p>
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

  // Quick apply AI suggested scores to all filtered submissions on grading page
  const handleApplyAllAiScoresToGradingInputs = () => {
    if (teacherSubmissions.length === 0) return;
    let appliedCount = 0;
    const updates: Record<string, { score: string; feedback: string }> = {};

    teacherSubmissions.forEach(sub => {
      if (sub.aiEvaluation && sub.aiEvaluation.suggestedScore !== undefined) {
        updates[sub.id] = {
          score: String(sub.aiEvaluation.suggestedScore),
          feedback: sub.aiEvaluation.feedback || sub.feedback || '',
        };
        appliedCount++;
      }
    });

    if (appliedCount === 0) {
      alertService.info('ยังไม่มีผลคะแนน AI ในรายการที่กรอง', 'กรุณากดปุ่ม "🤖 ให้ AI ตรวจทั้งหมด" ก่อน');
      return;
    }

    setGradingScores(prev => ({
      ...prev,
      ...updates,
    }));

    alertService.success(
      'ดึงคะแนน AI เรียบร้อย!',
      `นำคะแนนและข้อเสนอแนะจาก AI มาใส่ในช่องคะแนนของนักเรียนจำนวน ${appliedCount} คนแล้ว คุณครูสามารถปรับแก้และกด "บันทึกคะแนน" ได้ทันที`
    );
  };

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
        const matchTeacher = !activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName);
        const subYear = (s.academicYear && s.academicYear.trim()) || '2567';
        const matchYear = reportYear === 'ALL' || subYear === reportYear;
        const subSemester = (s.semester && s.semester.trim()) || '1';
        const matchSemester = reportSemester === 'ALL' || subSemester === reportSemester;
        const matchGrade = s.gradeLevel === reportGrade;
        const matchRoom = s.room === reportRoom;
        const matchSubject = reportSubject === 'ALL' || 
          s.subjectCode === reportSubject || 
          s.subjectName === reportSubject ||
          (s.subjectCode && reportSubject.includes(s.subjectCode));
        const matchAssignment = reportAssignment === 'ALL' || s.assignmentId === reportAssignment || s.assignmentName === reportAssignment;
        const effectiveStatus = s.status || (s.score !== null && s.score !== undefined ? 'ตรวจแล้ว' : 'รอตรวจ');
        const matchStatus = reportStatus === 'ALL' || effectiveStatus === reportStatus;
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

  // รวบรวมรายชื่อนักเรียนทั้งหมดในห้องนี้ (จาก Roster ที่อัปโหลด และจากงานที่ส่ง)
  const classroomStudents = useMemo(() => {
    const studentMap = new Map<string, {
      studentNumber: string;
      studentName: string;
      gradeLevel: GradeLevel;
      room: string;
      rosterItem?: StudentRosterItem;
    }>();

    // 1. เพิ่มจาก Roster ที่ครูอัปโหลดเข้ามา
    rosterList.forEach(r => {
      if (r.gradeLevel === reportGrade && r.room === reportRoom) {
        const num = (r.studentNumber || '').trim();
        const key = num ? `num-${num}` : `name-${r.studentName.trim().toLowerCase()}`;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            studentNumber: num,
            studentName: r.studentName.trim(),
            gradeLevel: r.gradeLevel,
            room: r.room,
            rosterItem: r,
          });
        }
      }
    });

    // 2. เพิ่มจากรายการงานที่ส่งในห้องนี้ (กรณีมีนักเรียนส่งงานแต่ยังไม่ได้นำเข้า Roster)
    submissions.forEach(s => {
      if (s.gradeLevel === reportGrade && s.room === reportRoom) {
        const num = (s.studentNumber || '').trim();
        const key = num ? `num-${num}` : `name-${s.studentName.trim().toLowerCase()}`;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            studentNumber: num,
            studentName: s.studentName.trim(),
            gradeLevel: s.gradeLevel,
            room: s.room,
          });
        } else {
          const item = studentMap.get(key)!;
          if (!item.studentName && s.studentName) {
            item.studentName = s.studentName.trim();
          }
        }
      }
    });

    return Array.from(studentMap.values()).sort((a, b) => {
      const numA = parseInt(a.studentNumber, 10);
      const numB = parseInt(b.studentNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.studentNumber.localeCompare(b.studentNumber);
    });
  }, [rosterList, submissions, reportGrade, reportRoom]);

  // แมปนักเรียนทุกคนในห้องกับสถานะการส่งงานของใบงานที่เลือก เพื่อดูว่าใครส่งแล้ว และใครยังไม่ส่ง (ค้างส่ง)
  const classroomTrackingAll = useMemo(() => {
    // หางานเป้าหมายที่เลือกไว้
    const selectedAssignmentObj = assignments.find(a => a.id === reportAssignment || a.title === reportAssignment);
    const defaultMaxScore = selectedAssignmentObj?.maxScore || 10;
    const defaultAssignmentTitle = selectedAssignmentObj?.title || (reportAssignment !== 'ALL' ? reportAssignment : 'ทุกใบงาน');

    return classroomStudents.map(student => {
      // ค้นหาผลงานของนักเรียนคนนี้ในห้องนี้
      const matchedSub = roomSubmissions.find(s => {
        const matchNum = student.studentNumber && s.studentNumber && s.studentNumber.trim() === student.studentNumber;
        const matchName = s.studentName.trim().toLowerCase() === student.studentName.toLowerCase();
        return matchNum || matchName;
      });

      if (matchedSub) {
        const isGraded = matchedSub.status === 'ตรวจแล้ว' || (matchedSub.score !== null && matchedSub.score !== undefined);
        return {
          key: `sub-${matchedSub.id}`,
          studentNumber: student.studentNumber || matchedSub.studentNumber,
          studentName: student.studentName || matchedSub.studentName,
          gradeLevel: student.gradeLevel,
          room: student.room,
          rosterItem: student.rosterItem,
          submission: matchedSub,
          isSubmitted: true,
          status: isGraded ? ('ตรวจแล้ว' as const) : ('รอตรวจ' as const),
          score: matchedSub.score,
          maxScore: matchedSub.maxScore || defaultMaxScore,
          aiScore: matchedSub.aiEvaluation?.suggestedScore,
          aiEvaluation: matchedSub.aiEvaluation,
          workUrl: matchedSub.workUrl,
          feedback: matchedSub.feedback,
          assignmentName: matchedSub.assignmentName || defaultAssignmentTitle,
          subjectCode: matchedSub.subjectCode,
          subjectName: matchedSub.subjectName,
        };
      } else {
        return {
          key: `missing-${student.studentNumber}-${student.studentName}`,
          studentNumber: student.studentNumber,
          studentName: student.studentName,
          gradeLevel: student.gradeLevel,
          room: student.room,
          rosterItem: student.rosterItem,
          submission: undefined,
          isSubmitted: false,
          status: 'ยังไม่ส่ง' as const,
          score: null,
          maxScore: defaultMaxScore,
          aiScore: undefined,
          aiEvaluation: undefined,
          workUrl: '',
          feedback: '',
          assignmentName: defaultAssignmentTitle,
          subjectCode: reportSubject !== 'ALL' ? reportSubject : '',
          subjectName: '',
        };
      }
    });
  }, [classroomStudents, roomSubmissions, assignments, reportAssignment, reportSubject]);

  // กรองตาม reportFilterStatus และ reportSearch
  const classroomTracking = useMemo(() => {
    return classroomTrackingAll.filter(item => {
      // 1. Status Filter
      if (reportFilterStatus === 'SUBMITTED' && !item.isSubmitted) return false;
      if (reportFilterStatus === 'MISSING' && item.isSubmitted) return false;
      if (reportFilterStatus === 'GRADED' && (!item.isSubmitted || item.status !== 'ตรวจแล้ว')) return false;
      if (reportFilterStatus === 'WAITING' && (!item.isSubmitted || item.status !== 'รอตรวจ')) return false;

      // 2. Search query filter
      const q = reportSearch.trim().toLowerCase();
      if (q) {
        const matchName = item.studentName.toLowerCase().includes(q);
        const matchNum = item.studentNumber.toLowerCase().includes(q);
        const matchAssign = item.assignmentName.toLowerCase().includes(q);
        if (!matchName && !matchNum && !matchAssign) return false;
      }

      return true;
    });
  }, [classroomTrackingAll, reportFilterStatus, reportSearch]);

  // รายการนักเรียนที่ยังไม่ส่งงาน (ค้างส่ง) ในห้องนี้
  const missingStudentsList = useMemo(() => {
    return classroomTrackingAll.filter(i => !i.isSubmitted);
  }, [classroomTrackingAll]);

  // สถิติรายงานของห้องเรียนแบบครอบคลุมทั้งห้อง
  const roomStats = React.useMemo(() => {
    const totalInClass = classroomStudents.length;
    const submittedCount = classroomTrackingAll.filter(i => i.isSubmitted).length;
    const missingCount = classroomTrackingAll.filter(i => !i.isSubmitted).length;
    const gradedCount = classroomTrackingAll.filter(i => i.isSubmitted && i.status === 'ตรวจแล้ว').length;
    const waitingCount = classroomTrackingAll.filter(i => i.isSubmitted && i.status === 'รอตรวจ').length;
    const aiEvaluated = classroomTrackingAll.filter(i => i.isSubmitted && i.aiEvaluation?.suggestedScore !== undefined).length;
    
    const aiScores = classroomTrackingAll
      .filter(i => i.isSubmitted && i.aiEvaluation?.suggestedScore !== undefined)
      .map(i => i.aiEvaluation!.suggestedScore);
    const avgAiScore = aiScores.length > 0
      ? (aiScores.reduce((acc, curr) => acc + curr, 0) / aiScores.length).toFixed(1)
      : '-';

    const teacherScores = classroomTrackingAll
      .filter(i => i.isSubmitted && i.score !== null && i.score !== undefined)
      .map(i => i.score as number);
    const avgTeacherScore = teacherScores.length > 0
      ? (teacherScores.reduce((acc, curr) => acc + curr, 0) / teacherScores.length).toFixed(1)
      : '-';

    return { 
      total: roomSubmissions.length,
      totalInClass, 
      submittedCount, 
      missingCount, 
      gradedCount, 
      waitingCount, 
      aiEvaluated, 
      avgAiScore, 
      avgTeacherScore 
    };
  }, [classroomStudents.length, classroomTrackingAll, roomSubmissions.length]);

  // คัดลอกรายชื่อคนค้างส่งลง Clipboard เพื่อส่งในกลุ่ม LINE
  const handleCopyMissingStudents = () => {
    if (missingStudentsList.length === 0) {
      alertService.info('ไม่มีนักเรียนค้างส่ง 🎉', `นักเรียนห้อง ${reportGrade}/${reportRoom} ส่งงานครบทุกคนแล้ว`);
      return;
    }

    const currentSubj = reportSubject !== 'ALL' ? reportSubject : 'ทุกรายวิชา';
    const currentAssign = reportAssignment !== 'ALL' 
      ? (assignments.find(a => a.id === reportAssignment)?.title || reportAssignment)
      : 'งานที่ได้รับมอบหมาย';

    const lines = [
      `📢 แจ้งเตือนส่งงาน โรงเรียนท่าบ่อ`,
      `🏫 ระดับชั้น: ม.${reportGrade.replace('ม.', '')}/${reportRoom}`,
      `📚 วิชา: ${currentSubj}`,
      `📝 งาน: ${currentAssign}`,
      `👥 ยังไม่ส่งงาน: ${missingStudentsList.length} คน (จากทั้งหมด ${roomStats.totalInClass} คน)`,
      `---------------------------------`,
      ...missingStudentsList.map((s, idx) => `${idx + 1}. เลขที่ ${s.studentNumber || '-'} ${s.studentName}`),
      `---------------------------------`,
      `⏰ โปรดรีบดำเนินการส่งงานเพื่อบันทึกคะแนนเก็บครับ/ค่ะ`,
    ];

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedMissingNotice(true);
    setTimeout(() => setCopiedMissingNotice(false), 4000);

    alertService.success(
      'คัดลอกรายชื่อเรียบร้อย! 📋',
      `คัดลอกรายชื่อนักเรียนค้างส่งจำนวน ${missingStudentsList.length} คนแล้ว สามารถนำไปวางส่งในกลุ่ม LINE ได้ทันที`
    );
  };

  // ส่งออกรายชื่อคนค้างส่งเป็น Excel
  const handleExportMissingExcel = () => {
    if (missingStudentsList.length === 0) {
      alertService.info('ไม่มีนักเรียนค้างส่ง', `นักเรียนในห้อง ${reportGrade}/${reportRoom} ส่งงานครบทุกคนแล้ว`);
      return;
    }

    const currentAssign = reportAssignment !== 'ALL' 
      ? (assignments.find(a => a.id === reportAssignment)?.title || reportAssignment)
      : 'งานที่ได้รับมอบหมาย';

    const missingData = missingStudentsList.map(s => ({
      studentNumber: s.studentNumber,
      studentName: s.studentName,
      gradeLevel: s.gradeLevel,
      room: s.room,
      assignmentName: currentAssign,
      subjectCode: reportSubject !== 'ALL' ? reportSubject : '',
      subjectName: '',
    }));

    const fileName = `รายชื่อนักเรียนค้างส่ง_ชั้น${reportGrade}_ห้อง${reportRoom}_${activeTeacher?.fullName || 'ครูผู้สอน'}`;
    storageService.exportMissingStudentsToExcel(missingData, fileName);
    alertService.success('ส่งออก Excel คนค้างส่งเรียบร้อย', `ดาวน์โหลดรายชื่อคนค้างส่ง ${missingStudentsList.length} คน`);
  };

  // เปิดหน้าต่างบันทึกงานแทน / ให้คะแนนในห้องเรียน (Offline Submission Recording)
  const handleOpenOfflineModal = (student: { studentName: string; studentNumber: string; gradeLevel: GradeLevel; room: string }) => {
    const defaultAssignment = assignments.find(a => a.id === reportAssignment) || assignments[0];
    setOfflineModal({
      isOpen: true,
      studentName: student.studentName,
      studentNumber: student.studentNumber,
      gradeLevel: student.gradeLevel,
      room: student.room,
      assignmentId: defaultAssignment?.id || '',
      assignmentName: defaultAssignment?.title || 'ใบงานที่ 1',
      subjectCode: defaultAssignment?.subjectCode || (reportSubject !== 'ALL' ? reportSubject : 'ว21103'),
      subjectName: defaultAssignment?.subjectName || '',
      maxScore: defaultAssignment?.maxScore || 10,
      score: '',
      feedback: 'ส่งงานเรียบร้อย (บันทึกโดยครูผู้สอน)',
      workUrl: 'งานส่งในห้องเรียน / ใบงานกระดาษ',
    });
  };

  // บันทึกงานส่งแทนนักเรียน
  const handleSaveOfflineSubmission = async () => {
    if (!offlineModal) return;
    if (!offlineModal.studentName.trim()) {
      alertService.error('กรุณากรอกชื่อนักเรียน', 'ต้องระบุชื่อนักเรียน');
      return;
    }

    const scoreNum = offlineModal.score.trim() !== '' ? parseFloat(offlineModal.score) : null;
    if (scoreNum !== null && (isNaN(scoreNum) || scoreNum < 0 || scoreNum > offlineModal.maxScore)) {
      alertService.error('คะแนนไม่ถูกต้อง', `คะแนนต้องอยู่ระหว่าง 0 ถึง ${offlineModal.maxScore}`);
      return;
    }

    alertService.loading('กำลังบันทึกงาน...');
    const newSub: Submission = {
      id: `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      studentName: offlineModal.studentName.trim(),
      studentNumber: offlineModal.studentNumber.trim(),
      gradeLevel: offlineModal.gradeLevel,
      room: offlineModal.room,
      submittedAt: new Date().toLocaleString('th-TH'),
      teacherName: activeTeacher?.fullName || 'ครูผู้สอน',
      subjectCode: offlineModal.subjectCode,
      subjectName: offlineModal.subjectName,
      assignmentId: offlineModal.assignmentId,
      assignmentName: offlineModal.assignmentName,
      maxScore: offlineModal.maxScore,
      workUrl: offlineModal.workUrl.trim() || 'งานส่งในห้องเรียน',
      score: scoreNum,
      status: scoreNum !== null ? 'ตรวจแล้ว' : 'รอตรวจ',
      feedback: offlineModal.feedback.trim(),
      gradedAt: scoreNum !== null ? new Date().toLocaleString('th-TH') : undefined,
      gradedBy: scoreNum !== null ? (activeTeacher?.fullName || 'ครูผู้สอน') : undefined,
      academicYear: reportYear !== 'ALL' ? reportYear : latestYear,
      semester: reportSemester !== 'ALL' ? reportSemester : latestSemester,
    };

    const res = await storageService.addSubmission(newSub, sheetConfig);
    alertService.close();

    if (res.success) {
      setOfflineModal(null);
      await onRefreshData();
      onSubmissionsChange();
      alertService.success('บันทึกงานสำเร็จ! 🎉', `บันทึกงานของ ${newSub.studentName} เรียบร้อยแล้ว`);
    } else {
      alertService.error('บันทึกไม่สำเร็จ', res.message);
    }
  };

  // Submissions filtered for Student Data & Deletion Management tab
  const manageStudentSubmissions = React.useMemo(() => {
    return submissions
      .filter(s => {
        const matchTeacher = !activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName);
        const subYear = (s.academicYear && s.academicYear.trim()) || '2567';
        const matchYear = studentManageYear === 'ALL' || subYear === studentManageYear;
        const subSemester = (s.semester && s.semester.trim()) || '1';
        const matchSemester = studentManageSemester === 'ALL' || subSemester === studentManageSemester;
        const matchGrade = studentManageGrade === 'ALL' || s.gradeLevel === studentManageGrade;
        const matchRoom = studentManageRoom === 'ALL' || s.room === studentManageRoom;
        const matchSubject = studentManageSubject === 'ALL' || 
          s.subjectCode === studentManageSubject ||
          s.subjectName === studentManageSubject ||
          (s.subjectCode && studentManageSubject.includes(s.subjectCode));
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

  // บัญชีรายชื่อนักเรียน (Roster) ที่กรองสำหรับหน้าจัดการข้อมูลนักเรียน
  const filteredRosterList = useMemo(() => {
    return rosterList.filter(r => {
      const matchYear = studentManageYear === 'ALL' || r.academicYear === studentManageYear;
      const matchSem = studentManageSemester === 'ALL' || r.semester === studentManageSemester;
      const matchGrade = studentManageGrade === 'ALL' || r.gradeLevel === studentManageGrade;
      const matchRoom = studentManageRoom === 'ALL' || r.room === studentManageRoom;
      const q = studentManageSearch.trim().toLowerCase();
      const matchSearch = !q || r.studentName.toLowerCase().includes(q) || r.studentNumber.toLowerCase().includes(q);
      return matchYear && matchSem && matchGrade && matchRoom && matchSearch;
    }).sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel.localeCompare(b.gradeLevel);
      const roomA = parseInt(a.room, 10) || 0;
      const roomB = parseInt(b.room, 10) || 0;
      if (roomA !== roomB) return roomA - roomB;
      const numA = parseInt(a.studentNumber, 10);
      const numB = parseInt(b.studentNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.studentNumber.localeCompare(b.studentNumber);
    });
  }, [rosterList, studentManageYear, studentManageSemester, studentManageGrade, studentManageRoom, studentManageSearch]);

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
  // DASHBOARD ANALYTICS COMPUTATIONS & HANDLERS (วิเคราะห์ผลรายวิชา / รายห้อง)
  // -------------------------------------------------------------
  // Unique list of subjects for Dashboard filters (เฉพาะวิชาของครูท่านนี้ที่นำข้อมูลเข้า หรือมีนักเรียนส่งงาน)
  const availableDashSubjects = useMemo(() => {
    return teacherSubjects.map(([code, name]) => ({ code, name }));
  }, [teacherSubjects]);

  // Available assignments based on selected subject/year/semester (เฉพาะงานของครูท่านนี้)
  const availableDashAssignments = useMemo(() => {
    return assignments.filter(a => {
      const matchTeacher = !activeTeacher || matchesTeacher(a.teacherName, activeTeacher.fullName);
      const matchSubject = dashSubject === 'ALL' || a.subjectCode === dashSubject;
      const matchYear = dashYear === 'ALL' || (a.academicYear || '2567') === dashYear;
      const matchSemester = dashSemester === 'ALL' || (a.semester || '1') === dashSemester;
      return matchTeacher && matchSubject && matchYear && matchSemester;
    });
  }, [assignments, activeTeacher, dashSubject, dashYear, dashSemester]);

  // Filtered submissions for Dashboard (เฉพาะของครูท่านนี้)
  const dashFilteredSubmissions = useMemo(() => {
    return submissions
      .filter(s => {
        const matchTeacher = !activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName);
        const subYear = (s.academicYear && s.academicYear.trim()) || '2567';
        const matchYear = dashYear === 'ALL' || subYear === dashYear;
        const subSemester = (s.semester && s.semester.trim()) || '1';
        const matchSemester = dashSemester === 'ALL' || subSemester === dashSemester;
        const matchSubject = dashSubject === 'ALL' || 
          s.subjectCode === dashSubject || 
          s.subjectName === dashSubject ||
          (s.subjectCode && dashSubject.includes(s.subjectCode));
        const matchGrade = dashGrade === 'ALL' || s.gradeLevel === dashGrade;
        const matchRoom = dashRoom === 'ALL' || s.room === dashRoom;
        const matchAssignment = dashAssignment === 'ALL' || s.assignmentId === dashAssignment || s.assignmentName === dashAssignment;
        const effectiveStatus = s.status || (s.score !== null && s.score !== undefined ? 'ตรวจแล้ว' : 'รอตรวจ');
        const matchStatus = dashStatus === 'ALL' || effectiveStatus === dashStatus;
        const q = dashSearch.trim().toLowerCase();
        const matchQuery = !q || (
          s.studentName.toLowerCase().includes(q) ||
          s.studentNumber.toLowerCase().includes(q) ||
          s.assignmentName.toLowerCase().includes(q) ||
          (s.subjectCode && s.subjectCode.toLowerCase().includes(q)) ||
          (s.subjectName && s.subjectName.toLowerCase().includes(q))
        );
        return matchTeacher && matchYear && matchSemester && matchSubject && matchGrade && matchRoom && matchAssignment && matchStatus && matchQuery;
      })
      .sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel.localeCompare(b.gradeLevel);
        const roomA = parseInt(a.room, 10) || 0;
        const roomB = parseInt(b.room, 10) || 0;
        if (roomA !== roomB) return roomA - roomB;
        const numA = parseInt(a.studentNumber, 10);
        const numB = parseInt(b.studentNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.studentNumber.localeCompare(b.studentNumber);
      });
  }, [submissions, activeTeacher, dashYear, dashSemester, dashSubject, dashGrade, dashRoom, dashAssignment, dashStatus, dashSearch]);

  // Overall Statistics for Dashboard
  const dashStats = useMemo(() => {
    const total = dashFilteredSubmissions.length;
    const graded = dashFilteredSubmissions.filter(s => s.status === 'ตรวจแล้ว' && s.score !== null && s.score !== undefined);
    const pending = dashFilteredSubmissions.filter(s => s.status !== 'ตรวจแล้ว');
    const aiEvaluated = dashFilteredSubmissions.filter(s => s.aiEvaluation && s.aiEvaluation.suggestedScore !== undefined);

    const teacherScores = graded.map(s => Number(s.score));
    const avgTeacherScore = teacherScores.length > 0
      ? (teacherScores.reduce((acc, curr) => acc + curr, 0) / teacherScores.length).toFixed(1)
      : '-';

    const aiScores = aiEvaluated.map(s => s.aiEvaluation!.suggestedScore);
    const avgAiScore = aiScores.length > 0
      ? (aiScores.reduce((acc, curr) => acc + curr, 0) / aiScores.length).toFixed(1)
      : '-';

    const maxTeacherScore = teacherScores.length > 0 ? Math.max(...teacherScores) : '-';
    const minTeacherScore = teacherScores.length > 0 ? Math.min(...teacherScores) : '-';

    // Unique students count
    const uniqueStudentKeys = new Set(dashFilteredSubmissions.map(s => `${s.gradeLevel}-${s.room}-${s.studentNumber}`));
    const uniqueStudentsCount = uniqueStudentKeys.size;

    // Grade / Score Distribution based on percentage of maxScore (80-100%, 70-79%, 60-69%, 50-59%, <50%)
    let grade4 = 0;
    let grade3 = 0;
    let grade2 = 0;
    let grade1 = 0;
    let grade0 = 0;

    graded.forEach(s => {
      const max = s.maxScore || 10;
      const pct = max > 0 ? (Number(s.score) / max) * 100 : 0;
      if (pct >= 80) grade4++;
      else if (pct >= 70) grade3++;
      else if (pct >= 60) grade2++;
      else if (pct >= 50) grade1++;
      else grade0++;
    });

    const gradedCount = graded.length;
    const gradeDist = {
      grade4: { count: grade4, pct: gradedCount > 0 ? Math.round((grade4 / gradedCount) * 100) : 0 },
      grade3: { count: grade3, pct: gradedCount > 0 ? Math.round((grade3 / gradedCount) * 100) : 0 },
      grade2: { count: grade2, pct: gradedCount > 0 ? Math.round((grade2 / gradedCount) * 100) : 0 },
      grade1: { count: grade1, pct: gradedCount > 0 ? Math.round((grade1 / gradedCount) * 100) : 0 },
      grade0: { count: grade0, pct: gradedCount > 0 ? Math.round((grade0 / gradedCount) * 100) : 0 },
    };

    const completionRate = total > 0 ? Math.round((gradedCount / total) * 100) : 0;

    return {
      total,
      gradedCount,
      pendingCount: pending.length,
      aiEvaluatedCount: aiEvaluated.length,
      avgTeacherScore,
      avgAiScore,
      maxTeacherScore,
      minTeacherScore,
      uniqueStudentsCount,
      gradeDist,
      completionRate,
    };
  }, [dashFilteredSubmissions]);

  // Comparison across Rooms 1 to 14
  const dashRoomComparison = useMemo(() => {
    return ROOMS.map(rm => {
      const inRoom = submissions.filter(s => {
        const matchTeacher = !activeTeacher || s.teacherName === activeTeacher.fullName || s.teacherName.includes(activeTeacher.fullName);
        const matchYear = dashYear === 'ALL' || (s.academicYear || '2567') === dashYear;
        const matchSemester = dashSemester === 'ALL' || (s.semester || '1') === dashSemester;
        const matchSubject = dashSubject === 'ALL' || s.subjectCode === dashSubject || s.subjectName === dashSubject;
        const matchGrade = dashGrade === 'ALL' || s.gradeLevel === dashGrade;
        const matchAssignment = dashAssignment === 'ALL' || s.assignmentId === dashAssignment || s.assignmentName === dashAssignment;
        return matchTeacher && matchYear && matchSemester && matchSubject && matchGrade && matchAssignment && s.room === rm;
      });

      const gradedInRoom = inRoom.filter(s => s.status === 'ตรวจแล้ว' && s.score !== null && s.score !== undefined);
      const scores = gradedInRoom.map(s => Number(s.score));
      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
      const aiScores = inRoom.filter(s => s.aiEvaluation?.suggestedScore !== undefined).map(s => s.aiEvaluation!.suggestedScore);
      const avgAiScore = aiScores.length > 0 ? (aiScores.reduce((a, b) => a + b, 0) / aiScores.length).toFixed(1) : '-';
      const rate = inRoom.length > 0 ? Math.round((gradedInRoom.length / inRoom.length) * 100) : 0;

      return {
        room: rm,
        total: inRoom.length,
        graded: gradedInRoom.length,
        pending: inRoom.length - gradedInRoom.length,
        avgScore,
        avgAiScore,
        rate,
      };
    });
  }, [submissions, activeTeacher, dashYear, dashSemester, dashSubject, dashGrade, dashAssignment]);

  // Assignment breakdown under current filters
  const dashAssignmentBreakdown = useMemo(() => {
    const map = new Map<string, { title: string; maxScore: number; subjectCode: string; total: number; graded: number; totalScore: number }>();
    dashFilteredSubmissions.forEach(s => {
      const key = s.assignmentId || s.assignmentName;
      if (!map.has(key)) {
        map.set(key, {
          title: s.assignmentName,
          maxScore: s.maxScore || 10,
          subjectCode: s.subjectCode || '',
          total: 0,
          graded: 0,
          totalScore: 0,
        });
      }
      const item = map.get(key)!;
      item.total++;
      if (s.status === 'ตรวจแล้ว' && s.score !== null && s.score !== undefined) {
        item.graded++;
        item.totalScore += Number(s.score);
      }
    });

    return Array.from(map.values()).map(item => ({
      title: item.title,
      maxScore: item.maxScore,
      subjectCode: item.subjectCode,
      total: item.total,
      graded: item.graded,
      avgScore: item.graded > 0 ? (item.totalScore / item.graded).toFixed(1) : '-',
      rate: item.total > 0 ? Math.round((item.graded / item.total) * 100) : 0,
    }));
  }, [dashFilteredSubmissions]);

  // Export Dashboard to Excel
  const handleDashExportExcel = () => {
    if (dashFilteredSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับการส่งออก', 'ไม่พบข้อมูลตามเงื่อนไขตัวกรองแดชบอร์ด');
      return;
    }
    const subjPart = dashSubject !== 'ALL' ? `_${dashSubject}` : '';
    const classPart = dashGrade !== 'ALL' ? `_${dashGrade}` : '';
    const roomPart = dashRoom !== 'ALL' ? `_ห้อง${dashRoom}` : '';
    const fileName = `แดชบอร์ดสรุปผลการเรียน${subjPart}${classPart}${roomPart}_${activeTeacher?.fullName || 'ครูผู้สอน'}`;
    storageService.exportToExcel(dashFilteredSubmissions, fileName);
    alertService.success('ส่งออก Excel สำเร็จ', `ดาวน์โหลดข้อมูลแดชบอร์ดจำนวน ${dashFilteredSubmissions.length} รายการ เรียบร้อยแล้ว`);
  };

  // Export Dashboard to PDF
  const handleDashExportPdf = () => {
    if (dashFilteredSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับการส่งออก', 'ไม่พบข้อมูลตามเงื่อนไขตัวกรองแดชบอร์ด');
      return;
    }
    const parts = [];
    if (dashSubject !== 'ALL') parts.push(`วิชา ${dashSubject}`);
    if (dashGrade !== 'ALL') parts.push(`ชั้น ${dashGrade}`);
    if (dashRoom !== 'ALL') parts.push(`ห้อง ${dashRoom}`);
    if (dashYear !== 'ALL') parts.push(`ปี ${dashYear}`);
    if (dashSemester !== 'ALL') parts.push(`เทอม ${dashSemester}`);
    if (dashStatus !== 'ALL') parts.push(`สถานะ: ${dashStatus}`);
    const summary = parts.length > 0 ? parts.join(' • ') : 'สรุปข้อมูลทุกวิชาและทุกห้องเรียน';

    storageService.exportToPdf(
      dashFilteredSubmissions,
      `แดชบอร์ดรายงานผลสัมฤทธิ์และติดตามงาน - ${activeTeacher?.fullName || 'ครูผู้สอน'}`,
      `โรงเรียนท่าบ่อ • ${summary} • ข้อมูล ณ วันที่ ${new Date().toLocaleDateString('th-TH')}`
    );
  };

  const handleResetDashFilters = () => {
    setDashSubject('ALL');
    setDashGrade('ALL');
    setDashRoom('ALL');
    setDashAssignment('ALL');
    setDashYear(latestYear);
    setDashSemester(latestSemester);
    setDashStatus('ALL');
    setDashSearch('');
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
            {/* Sub-tabs: แดชบอร์ดวิเคราะห์ผล / ตรวจงาน / รายงานรายห้อง (คะแนน AI) / จัดการและลบข้อมูลนักเรียน / จัดการงาน */}
            <div className="flex flex-wrap bg-purple-100/60 p-1 rounded-xl border border-purple-200/60 gap-1">
              <button
                onClick={() => setTeacherTab('dashboard')}
                className={`px-3 md:px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  teacherTab === 'dashboard'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200'
                    : 'text-indigo-900 hover:text-indigo-700 bg-white/70 hover:bg-white'
                }`}
              >
                <BarChart3 size={14} className={teacherTab === 'dashboard' ? 'text-white' : 'text-indigo-600'} />
                <span className="font-extrabold">แดชบอร์ดรายวิชา/รายห้อง</span>
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                  teacherTab === 'dashboard' ? 'bg-amber-300 text-amber-950' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  ใหม่ 📊
                </span>
              </button>
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

      {/* ============================================================= */}
      {/* SUB-VIEW 0: แดชบอร์ดวิเคราะห์ผล (DASHBOARD ANALYTICS BY SUBJECT & ROOM) */}
      {/* ============================================================= */}
      {teacherTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-950/30 border border-indigo-700/40 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-44 h-44 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute right-1/4 -bottom-10 w-52 h-52 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  <BarChart3 size={14} className="text-blue-300" />
                  <span>แดชบอร์ดสรุปผลการเรียนและติดตามงานรายวิชา / รายห้อง</span>
                  <span className="text-amber-300">★</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                  <span>สถิติการส่งงานและผลสัมฤทธิ์</span>
                  <span className="text-blue-400 text-lg md:text-xl font-normal">
                    {dashSubject !== 'ALL' ? `• วิชา ${dashSubject}` : '• ทุกรายวิชา'}
                    {dashGrade !== 'ALL' ? ` ชั้น ${dashGrade}` : ''}
                    {dashRoom !== 'ALL' ? ` ห้อง ${dashRoom}` : ''}
                  </span>
                </h2>
                <p className="text-xs md:text-sm text-blue-200/80 max-w-3xl leading-relaxed">
                  โรงเรียนท่าบ่อ สพม.หนองคาย • ตรวจสอบอัตราการส่งงาน คะแนนเฉลี่ยจากครูและ AI พร้อมเปรียบเทียบผลสัมฤทธิ์แต่ละห้องเรียน (ห้อง 1 ถึง 14) อย่างละเอียด
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDashExportExcel}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <FileSpreadsheet size={15} />
                  <span>ส่งออก Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleDashExportPdf}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/40 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <FileDown size={15} />
                  <span>พิมพ์ / ส่งออก PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherTab('grade')}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>📝</span>
                  <span>ไปตรวจงาน</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Panel Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <SlidersHorizontal size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    🎛️ ตัวกรองข้อมูลแดชบอร์ด (เลือกรายวิชา และ ห้องเรียน)
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    เลือกเงื่อนไขเพื่อวิเคราะห์ผลเฉพาะห้อง หรือเปรียบเทียบทุกห้องในรายวิชานั้นๆ
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetDashFilters}
                className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-indigo-700 bg-gray-100 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>ล้างตัวกรองทั้งหมด</span>
              </button>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {/* รายวิชา */}
              <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📚</span>
                  <span>รายวิชา (Subject)</span>
                  <span className="text-indigo-600 font-normal">({availableDashSubjects.length})</span>
                </label>
                <select
                  value={dashSubject}
                  onChange={(e) => setDashSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-indigo-50/30 border border-indigo-200/80 rounded-xl text-xs font-semibold text-indigo-950 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="ALL">-- ทุกรายวิชา --</option>
                  {availableDashSubjects.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ระดับชั้น */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🎓</span>
                  <span>ระดับชั้น</span>
                </label>
                <select
                  value={dashGrade}
                  onChange={(e) => setDashGrade(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/30 border border-purple-200/80 rounded-xl text-xs font-semibold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกชั้น --</option>
                  {(teacherClassrooms.grades.length > 0 ? teacherClassrooms.grades : GRADE_LEVELS).map((g) => (
                    <option key={g} value={g}>
                      ชั้น {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* ห้องเรียน */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🚪</span>
                  <span>ห้องเรียน</span>
                </label>
                <select
                  value={dashRoom}
                  onChange={(e) => setDashRoom(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/30 border border-purple-200/80 rounded-xl text-xs font-semibold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกห้อง --</option>
                  {(dashGrade !== 'ALL' && teacherClassrooms.roomsByGrade[dashGrade]?.length > 0
                    ? teacherClassrooms.roomsByGrade[dashGrade]
                    : teacherClassrooms.rooms.length > 0 ? teacherClassrooms.rooms : ROOMS
                  ).map((r) => (
                    <option key={r} value={r}>
                      ห้อง {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* ใบงาน/ชิ้นงาน */}
              <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📋</span>
                  <span>ใบงาน / ชิ้นงาน</span>
                  <span className="text-gray-400 font-normal">({availableDashAssignments.length})</span>
                </label>
                <select
                  value={dashAssignment}
                  onChange={(e) => setDashAssignment(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/30 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300 truncate"
                >
                  <option value="ALL">-- ทุกใบงาน --</option>
                  {availableDashAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.subjectCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* สถานะตรวจ */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📌</span>
                  <span>สถานะการตรวจ</span>
                </label>
                <select
                  value={dashStatus}
                  onChange={(e) => setDashStatus(e.target.value)}
                  className="w-full px-2.5 py-2 bg-purple-50/30 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกสถานะ --</option>
                  <option value="ตรวจแล้ว">ตรวจแล้ว</option>
                  <option value="รอตรวจ">รอตรวจ</option>
                </select>
              </div>
            </div>

            {/* Sub-row: ปีการศึกษา, ภาคเรียน, ค้นหา (ไม่ต้องกรองชื่อผู้สอนคนอื่น) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-purple-50">
              {/* ปีการศึกษา */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <span>📅</span>
                  <span>ปีการศึกษา</span>
                </label>
                <select
                  value={dashYear}
                  onChange={(e) => setDashYear(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกปีการศึกษา --</option>
                  {availableAcademicYears.map((y) => (
                    <option key={y} value={y}>
                      ปี {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* ภาคเรียน */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <span>📆</span>
                  <span>ภาคเรียน</span>
                </label>
                <select
                  value={dashSemester}
                  onChange={(e) => setDashSemester(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกภาคเรียน --</option>
                  {SEMESTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ค้นหาด่วน */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                  <Search size={12} className="text-gray-500" />
                  <span>ค้นหาด่วน (ชื่อ, รหัส, เลขที่, ใบงาน)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={dashSearch}
                    onChange={(e) => setDashSearch(e.target.value)}
                    placeholder="พิมพ์ชื่อนักเรียน หรือคำค้นหา..."
                    className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  {dashSearch && (
                    <button
                      type="button"
                      onClick={() => setDashSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-gray-500 text-[11px] font-semibold flex items-center gap-1 mr-1">
                <Filter size={11} />
                <span>ตัวกรองที่ใช้งาน:</span>
              </span>
              {dashSubject !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                  วิชา: {dashSubject}
                  <button type="button" onClick={() => setDashSubject('ALL')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashGrade !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                  ชั้น: {dashGrade}
                  <button type="button" onClick={() => setDashGrade('ALL')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashRoom !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                  ห้อง: {dashRoom}
                  <button type="button" onClick={() => setDashRoom('ALL')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashAssignment !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-200">
                  ใบงานที่เลือก
                  <button type="button" onClick={() => setDashAssignment('ALL')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  สถานะ: {dashStatus}
                  <button type="button" onClick={() => setDashStatus('ALL')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashYear !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                  ปี: {dashYear}
                  <button type="button" onClick={() => setDashYear('ALL')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashSemester !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                  เทอม: {dashSemester}
                  <button type="button" onClick={() => setDashSemester('ALL')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-pink-100 text-pink-900 border border-pink-200">
                  ค้นหา: "{dashSearch}"
                  <button type="button" onClick={() => setDashSearch('')} className="hover:text-rose-600">
                    <X size={11} />
                  </button>
                </span>
              )}
              {dashSubject === 'ALL' && dashGrade === 'ALL' && dashRoom === 'ALL' && dashAssignment === 'ALL' && dashStatus === 'ALL' && dashYear === 'ALL' && dashSemester === 'ALL' && !dashSearch && (
                <span className="text-gray-400 text-[11px] italic">
                  กำลังแสดงภาพรวมทุกวิชาและทุกห้องเรียน
                </span>
              )}
            </div>
          </div>

          {/* 6 Modern KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Card 1: Total Submissions */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md shadow-indigo-100/40 border border-indigo-100/80 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">งานที่ส่งทั้งหมด</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers size={16} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-gray-900 tracking-tight">
                  {dashStats.total}
                  <span className="text-xs font-normal text-gray-500 ml-1">งาน</span>
                </div>
                <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                  จากนักเรียน {dashStats.uniqueStudentsCount} คน
                </p>
              </div>
            </div>

            {/* Card 2: Grading Progress */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md shadow-emerald-100/40 border border-emerald-100/80 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">อัตราการตรวจ</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-emerald-700 tracking-tight">
                  {dashStats.completionRate}%
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, dashStats.completionRate))}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  ตรวจ {dashStats.gradedCount} / รอ {dashStats.pendingCount}
                </p>
              </div>
            </div>

            {/* Card 3: Average Teacher Score */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md shadow-amber-100/40 border border-amber-100/80 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">คะแนนเฉลี่ยครู</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Award size={16} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-amber-700 tracking-tight">
                  {dashStats.avgTeacherScore}
                  {dashStats.avgTeacherScore !== '-' && <span className="text-xs font-normal text-gray-500 ml-1">คะแนน</span>}
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  สูงสุด: <b className="text-emerald-700">{dashStats.maxTeacherScore}</b> | ต่ำสุด: <b className="text-rose-600">{dashStats.minTeacherScore}</b>
                </p>
              </div>
            </div>

            {/* Card 4: Average AI Score */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md shadow-purple-100/40 border border-purple-100/80 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">คะแนนเฉลี่ย AI</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Bot size={16} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-purple-700 tracking-tight">
                  {dashStats.avgAiScore}
                  {dashStats.avgAiScore !== '-' && <span className="text-xs font-normal text-gray-500 ml-1">คะแนน</span>}
                </div>
                <p className="text-[10px] text-purple-700 font-medium mt-0.5">
                  AI ประเมินแล้ว {dashStats.aiEvaluatedCount} ชิ้น
                </p>
              </div>
            </div>

            {/* Card 5: Grade 4 Excellence */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md shadow-blue-100/40 border border-blue-100/80 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">ผลงานเกรด 4</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-blue-700 tracking-tight">
                  {dashStats.gradeDist.grade4.count}
                  <span className="text-xs font-normal text-blue-600 ml-1">({dashStats.gradeDist.grade4.pct}%)</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  เกรด 3: {dashStats.gradeDist.grade3.count} งาน ({dashStats.gradeDist.grade3.pct}%)
                </p>
              </div>
            </div>

            {/* Card 6: Pending Review */}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md shadow-rose-100/40 border border-rose-100/80 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600">รอการตรวจ</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Clock size={16} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-rose-600 tracking-tight">
                  {dashStats.pendingCount}
                  <span className="text-xs font-normal text-gray-500 ml-1">งาน</span>
                </div>
                {dashStats.pendingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTeacherTab('grade')}
                    className="text-[10px] text-rose-700 font-bold hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer"
                  >
                    <span>ตรวจงานทันที</span>
                    <ChevronRight size={11} />
                  </button>
                ) : (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    ✓ ตรวจครบทั้งหมดแล้ว
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Room-by-Room Comparison Grid (ห้อง 1 ถึง 14) */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Activity size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>🏫 เปรียบเทียบผลการส่งงานและคะแนนเฉลี่ยแต่ละห้อง (ห้อง 1 ถึง 14)</span>
                    {dashGrade !== 'ALL' && (
                      <span className="text-xs font-normal text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        ชั้น {dashGrade}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    คลิกที่ห้องเพื่อกรองแดชบอร์ดดูเฉพาะห้องนั้นๆ หรือคลิกซ้ำเพื่อแสดงทุกห้อง
                  </p>
                </div>
              </div>

              {dashRoom !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setDashRoom('ALL')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200 cursor-pointer self-start sm:self-auto"
                >
                  ✓ แสดงทุกห้อง (1-14)
                </button>
              )}
            </div>

            {/* 14 Classroom Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {dashRoomComparison.map((rc) => {
                const isSelected = dashRoom === rc.room;
                return (
                  <button
                    key={rc.room}
                    type="button"
                    onClick={() => setDashRoom(isSelected ? 'ALL' : rc.room)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-500 ring-2 ring-indigo-300 shadow-md'
                        : rc.total > 0
                        ? 'bg-white hover:bg-gray-50/90 border-gray-200 hover:border-indigo-300 shadow-xs'
                        : 'bg-gray-50/60 border-gray-200/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-black ${isSelected ? 'text-indigo-900' : 'text-gray-800'}`}>
                        ห้อง {rc.room}
                      </span>
                      {isSelected ? (
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">
                          {rc.total} งาน
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {/* Mini Progress */}
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            rc.rate >= 80 ? 'bg-emerald-500' : rc.rate >= 50 ? 'bg-amber-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${rc.rate}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                        <span>ตรวจ: <b className="text-gray-700">{rc.graded}</b>/{rc.total}</span>
                        <span className="font-semibold text-emerald-700">{rc.rate}%</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-gray-100">
                        <span className="text-gray-500">เฉลี่ย:</span>
                        <span className="font-bold text-indigo-900">
                          {rc.avgScore !== '-' ? `${rc.avgScore} ค.` : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-purple-700">
                        <span>AI:</span>
                        <span className="font-medium">
                          {rc.avgAiScore !== '-' ? `${rc.avgAiScore}` : '-'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Grade Distribution & Assignment Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Grade Distribution Breakdown (5 Cols) */}
            <div className="lg:col-span-5 bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100/70 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <PieChart size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      ระดับคะแนนผลสัมฤทธิ์ (เกรด 0 - 4)
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      คำนวณจากสัดส่วนคะแนนที่ครูตรวจให้เทียบกับคะแนนเต็ม
                    </p>
                  </div>
                </div>
              </div>

              {/* 5 Grade Bars */}
              <div className="space-y-3 pt-1">
                {/* เกรด 4 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <span>🌟</span>
                      <span>เกรด 4 (ยอดเยี่ยม: 80% - 100%)</span>
                    </span>
                    <span className="font-extrabold text-gray-800">
                      {dashStats.gradeDist.grade4.count} งาน ({dashStats.gradeDist.grade4.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${dashStats.gradeDist.grade4.pct}%` }}
                    />
                  </div>
                </div>

                {/* เกรด 3 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-teal-800 flex items-center gap-1.5">
                      <span>🟢</span>
                      <span>เกรด 3 (ดีมาก: 70% - 79%)</span>
                    </span>
                    <span className="font-extrabold text-gray-800">
                      {dashStats.gradeDist.grade3.count} งาน ({dashStats.gradeDist.grade3.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-full transition-all"
                      style={{ width: `${dashStats.gradeDist.grade3.pct}%` }}
                    />
                  </div>
                </div>

                {/* เกรด 2 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-800 flex items-center gap-1.5">
                      <span>🟡</span>
                      <span>เกรด 2 (ปานกลาง: 60% - 69%)</span>
                    </span>
                    <span className="font-extrabold text-gray-800">
                      {dashStats.gradeDist.grade2.count} งาน ({dashStats.gradeDist.grade2.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${dashStats.gradeDist.grade2.pct}%` }}
                    />
                  </div>
                </div>

                {/* เกรด 1 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-orange-800 flex items-center gap-1.5">
                      <span>🟠</span>
                      <span>เกรด 1 (ผ่านเกณฑ์: 50% - 59%)</span>
                    </span>
                    <span className="font-extrabold text-gray-800">
                      {dashStats.gradeDist.grade1.count} งาน ({dashStats.gradeDist.grade1.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all"
                      style={{ width: `${dashStats.gradeDist.grade1.pct}%` }}
                    />
                  </div>
                </div>

                {/* เกรด 0 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-800 flex items-center gap-1.5">
                      <span>🔴</span>
                      <span>เกรด 0 (ควรปรับปรุง: &lt; 50%)</span>
                    </span>
                    <span className="font-extrabold text-gray-800">
                      {dashStats.gradeDist.grade0.count} งาน ({dashStats.gradeDist.grade0.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${dashStats.gradeDist.grade0.pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span>💡</span>
                  <span>ข้อสังเกตการประเมิน:</span>
                </p>
                <p className="text-gray-600">
                  นักเรียนส่วนใหญ่ได้ผลสัมฤทธิ์ระดับเกรด {dashStats.gradeDist.grade4.pct >= dashStats.gradeDist.grade3.pct ? '4' : '3'} 
                  {dashStats.gradeDist.grade0.count > 0 && ` • มีนักเรียนที่ต้องส่งเสริมพัฒนา ${dashStats.gradeDist.grade0.count} คน`}
                </p>
              </div>
            </div>

            {/* Assignment Performance Breakdown Table (7 Cols) */}
            <div className="lg:col-span-7 bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100/70 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Target size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      วิเคราะห์ผลสัมฤทธิ์รายชิ้นงาน / ใบงาน
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      ความคืบหน้าการส่งงานและคะแนนเฉลี่ยในแต่ละชิ้นงาน
                    </p>
                  </div>
                </div>
              </div>

              {dashAssignmentBreakdown.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  ยังไม่มีข้อมูลการส่งงานของใบงานในเงื่อนไขที่เลือก
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 font-bold">
                        <th className="py-2 px-2">ชิ้นงาน / ใบงาน</th>
                        <th className="py-2 px-2 text-center">คะแนนเต็ม</th>
                        <th className="py-2 px-2 text-center">ส่งแล้ว</th>
                        <th className="py-2 px-2 text-center">ตรวจแล้ว</th>
                        <th className="py-2 px-2 text-center">คะแนนเฉลี่ย</th>
                        <th className="py-2 px-2 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dashAssignmentBreakdown.map((ab, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-2.5 px-2">
                            <p className="font-bold text-gray-800 line-clamp-1">{ab.title}</p>
                            <p className="text-[10px] text-indigo-600">{ab.subjectCode}</p>
                          </td>
                          <td className="py-2.5 px-2 text-center font-semibold text-gray-700">
                            {ab.maxScore}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-gray-900">
                            {ab.total}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="font-bold text-emerald-700">{ab.graded}</span>
                            <span className="text-[10px] text-gray-400 ml-1">({ab.rate}%)</span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              {ab.avgScore}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => setDashAssignment(ab.title)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-lg transition-all border border-indigo-200 cursor-pointer"
                            >
                              กรองใบงานนี้
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Student Submissions List for Current Dashboard Filters */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>ตารางข้อมูลนักเรียนตามตัวกรองที่เลือก</span>
                    <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                      {dashFilteredSubmissions.length} รายการ
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    แสดงรายละเอียดผลงาน คะแนนครู คะแนน AI และสามารถดูคำแนะนำหรือลบผลงานที่ซ้ำได้
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDashExportExcel}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleDashExportPdf}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <FileDown size={13} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {dashFilteredSubmissions.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center mx-auto text-2xl">
                  🔍
                </div>
                <h4 className="text-sm font-bold text-gray-700">ไม่พบรายการส่งงานตามตัวกรองที่ระบุ</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  ลองปรับเปลี่ยนตัวกรองรายวิชา ระดับชั้น หรือห้องเรียน เพื่อค้นหาข้อมูลการส่งงานของนักเรียน
                </p>
                <button
                  type="button"
                  onClick={handleResetDashFilters}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  ล้างตัวกรองแดชบอร์ด
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-purple-100">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-purple-50/80 text-gray-700 font-bold border-b border-purple-100">
                      <th className="py-3 px-3 text-center">เลขที่</th>
                      <th className="py-3 px-3">ชื่อ - นามสกุล นักเรียน</th>
                      <th className="py-3 px-3 text-center">ชั้น/ห้อง</th>
                      <th className="py-3 px-3">รายวิชา & ใบงาน</th>
                      <th className="py-3 px-3 text-center">คะแนน AI</th>
                      <th className="py-3 px-3 text-center">คะแนนครู</th>
                      <th className="py-3 px-3 text-center">สถานะ</th>
                      <th className="py-3 px-3 text-center">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50 bg-white">
                    {dashFilteredSubmissions.map((sub) => {
                      const isGraded = sub.status === 'ตรวจแล้ว' && sub.score !== null && sub.score !== undefined;
                      const hasAi = sub.aiEvaluation && sub.aiEvaluation.suggestedScore !== undefined;

                      return (
                        <tr key={sub.id} className="hover:bg-purple-50/40 transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-gray-800">
                            {sub.studentNumber}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-gray-900">{sub.studentName}</p>
                            <p className="text-[10px] text-gray-400">ส่งเมื่อ: {sub.submittedAt}</p>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-md font-bold text-xs bg-indigo-50 text-indigo-800 border border-indigo-200">
                              {sub.gradeLevel}/{sub.room}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-gray-800 line-clamp-1">{sub.assignmentName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-indigo-600 font-medium">{sub.subjectCode}</span>
                              {sub.workUrl && (
                                <a
                                  href={sub.workUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                  <span>เปิดผลงาน</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {hasAi ? (
                              <button
                                type="button"
                                onClick={() => setSelectedAiDetail(sub)}
                                className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-black inline-flex items-center gap-1 cursor-pointer transition-all"
                                title="คลิกดูรายละเอียดการประเมินจาก AI"
                              >
                                <span>🤖</span>
                                <span>{sub.aiEvaluation!.suggestedScore}</span>
                                <span className="text-[10px] text-purple-600 font-normal">/{sub.maxScore}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAiEvaluate(sub)}
                                className="text-[10px] text-purple-600 hover:text-purple-800 hover:underline font-semibold cursor-pointer"
                              >
                                + ให้ AI ตรวจ
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isGraded ? (
                              <span className="font-black text-sm text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                                {sub.score} <span className="text-[10px] text-gray-400 font-normal">/{sub.maxScore}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                ยังไม่ตรวจ
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isGraded
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {sub.status || 'รอตรวจ'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Student Info */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditStudent(sub)}
                                className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="แก้ไขข้อมูลนักเรียน"
                              >
                                <Edit3 size={13} />
                              </button>
                              {/* Delete duplicate / student submission */}
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentSubmission(sub)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="ลบผลงานนี้ (กรณีส่งซ้ำ)"
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
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 1: ตรวจงาน (GRADE SUBMISSIONS) */}
      {teacherTab === 'grade' && (
        <div className="space-y-6">
          {/* แถบระบบ AI ตรวจงานอัจฉริยะ (AI Grading Assistant Top Bar) - สามารถคลิกเลือกตรวจทั้งหมดได้ */}
          <div className="bg-gradient-to-r from-[#071330] via-indigo-950 to-purple-950 text-white rounded-3xl p-5 shadow-2xl border border-indigo-400/30 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Bot size={20} className="text-white" />
                  </div>
                  <h3 className="text-base font-extrabold tracking-wide flex items-center gap-2">
                    <span>แถบระบบตรวจงานด้วย AI อัจฉริยะ</span>
                    <span className="text-[11px] bg-gradient-to-r from-pink-500 to-rose-500 text-white px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                      AI Auto-Grader
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-indigo-200/90 leading-relaxed">
                  ระบบตรวจงานอัจฉริยะ วิเคราะห์ผลงาน ลิงก์งาน เกณฑ์รูบริก และคำนวณคะแนนพร้อมข้อเสนอแนะรายบุคคลให้อัตโนมัติในคลิกเดียว
                </p>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-xs border border-white/15 text-indigo-100 font-semibold">
                    📋 งานที่กรองอยู่: <b className="text-white font-bold">{teacherSubmissions.length}</b> รายการ
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-semibold">
                    ✅ AI ตรวจแล้ว: <b className="text-emerald-100 font-bold">{teacherSubmissions.filter(s => s.aiEvaluation?.suggestedScore !== undefined).length}</b> รายการ
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 font-semibold">
                    ⏳ ยังไม่ตรวจ: <b className="text-amber-100 font-bold">{teacherSubmissions.filter(s => !s.aiEvaluation || s.aiEvaluation?.suggestedScore === undefined).length}</b> รายการ
                  </span>
                </div>
              </div>

              {/* Action Buttons: ตรวจทั้งหมด / ตรวจที่ยังไม่ตรวจ / นำคะแนนใส่ช่องครู */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* ปุ่มตรวจผลงานทั้งหมด */}
                <button
                  type="button"
                  onClick={() => handleBatchAiEvaluateGrading('all')}
                  disabled={isGradingBatchEvaluating || teacherSubmissions.length === 0}
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-500 hover:from-violet-500 hover:to-pink-400 text-white font-bold rounded-2xl text-xs shadow-lg shadow-purple-900/50 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  title="สั่งให้ AI ตรวจและประเมินผลงานของนักเรียนทั้งหมดที่แสดงอยู่ในตาราง"
                >
                  {isGradingBatchEvaluating ? (
                    <>
                      <Sparkles size={16} className="animate-spin text-pink-200" />
                      <span>AI กำลังตรวจงานทั้งหมด...</span>
                    </>
                  ) : (
                    <>
                      <Bot size={16} className="text-pink-200" />
                      <span>🤖 ให้ AI ตรวจทั้งหมด ({teacherSubmissions.length})</span>
                    </>
                  )}
                </button>

                {/* ปุ่มตรวจเฉพาะรายการที่ยังไม่ได้ตรวจ */}
                {teacherSubmissions.some(s => !s.aiEvaluation || s.aiEvaluation?.suggestedScore === undefined) && (
                  <button
                    type="button"
                    onClick={() => handleBatchAiEvaluateGrading('unevaluated')}
                    disabled={isGradingBatchEvaluating}
                    className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl text-xs border border-white/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                    title="ตรวจเฉพาะผลงานที่ AI ยังไม่ได้ตรวจ"
                  >
                    <Sparkles size={14} className="text-amber-300" />
                    <span>ตรวจเฉพาะที่ยังไม่ตรวจ</span>
                  </button>
                )}

                {/* ปุ่มนำคะแนน AI ใส่ช่องครู */}
                <button
                  type="button"
                  onClick={handleApplyAllAiScoresToGradingInputs}
                  disabled={isGradingBatchEvaluating || teacherSubmissions.length === 0}
                  className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-2xl text-xs shadow-md shadow-amber-900/40 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                  title="นำคะแนนและข้อเสนอแนะที่ AI ประเมินไว้ ใส่ลงในช่องคะแนนครูของทุกคนทันที"
                >
                  <Sparkles size={14} className="text-amber-200" />
                  <span>⚡ นำคะแนน AI ใส่ช่องครู</span>
                </button>
              </div>
            </div>
          </div>

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

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
              {/* ปีการศึกษา */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>📅</span>
                  <span>ปีการศึกษา</span>
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกปี --</option>
                  {availableAcademicYears.map((y) => (
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
                  className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
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
                  className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกวิชา ({teacherSubjects.length}) --</option>
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
                  className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกชั้น --</option>
                  {(teacherClassrooms.grades.length > 0 ? teacherClassrooms.grades : GRADE_LEVELS).map((g) => (
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
                  className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกห้อง --</option>
                  {(filterGrade !== 'ALL' && teacherClassrooms.roomsByGrade[filterGrade]?.length > 0
                    ? teacherClassrooms.roomsByGrade[filterGrade]
                    : teacherClassrooms.rooms.length > 0 ? teacherClassrooms.rooms : ROOMS
                  ).map((r) => (
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
                  <span>สถานะตรวจ</span>
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- ทุกสถานะ --</option>
                  <option value="รอตรวจ">⏳ รอตรวจ</option>
                  <option value="ตรวจแล้ว">✅ ตรวจแล้ว</option>
                </select>
              </div>

              {/* สถานะ AI */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <span>🤖</span>
                  <span>สถานะ AI</span>
                </label>
                <select
                  value={filterAiStatus}
                  onChange={(e) => setFilterAiStatus(e.target.value as any)}
                  className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200/80 rounded-xl text-xs font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="ALL">-- AI ทั้งหมด --</option>
                  <option value="EVALUATED">✅ AI ตรวจแล้ว</option>
                  <option value="PENDING">⏳ ยังไม่ตรวจ</option>
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
                  ปี {filterYear !== 'ALL' ? filterYear : 'ทุกปี'} • เทอม {filterSemester !== 'ALL' ? filterSemester : 'ทุกเทอม'} • {filterSubject !== 'ALL' ? filterSubject : 'ทุกวิชา'} • {filterGrade !== 'ALL' ? filterGrade : 'ทุกชั้น'} • {filterRoom !== 'ALL' ? `ห้อง ${filterRoom}` : 'ทุกห้อง'} • {filterStatus !== 'ALL' ? filterStatus : 'ทุกสถานะ'} • {filterAiStatus !== 'ALL' ? (filterAiStatus === 'EVALUATED' ? 'AI ตรวจแล้ว' : 'AI ยังไม่ตรวจ') : 'ทุกสถานะ AI'}
                </span>
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-xs">
                  ✨ พบ {teacherSubmissions.length} รายการ
                </span>
              </div>

              {(filterYear !== latestYear || filterSemester !== latestSemester || filterSubject !== 'ALL' || filterGrade !== 'ALL' || filterRoom !== 'ALL' || filterStatus !== 'ALL' || filterAiStatus !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterYear(latestYear);
                    setFilterSemester(latestSemester);
                    setFilterSubject('ALL');
                    setFilterGrade('ALL');
                    setFilterRoom('ALL');
                    setFilterStatus('ALL');
                    setFilterAiStatus('ALL');
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
                {/* Copy Missing Student List for LINE group */}
                <button
                  type="button"
                  onClick={handleCopyMissingStudents}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    copiedMissingNotice
                      ? 'bg-emerald-600 text-white shadow-emerald-200'
                      : missingStudentsList.length > 0
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 hover:scale-[1.02]'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  title="คัดลอกรายชื่อนักเรียนที่ยังไม่ส่งงานเพื่อนำไปแจ้งเตือนในกลุ่ม LINE ห้องเรียน"
                >
                  {copiedMissingNotice ? <Check size={14} /> : <Copy size={14} />}
                  <span>
                    {copiedMissingNotice ? '✅ คัดลอกแล้ว!' : `📋 คัดลอกรายชื่อคนค้างส่ง (${missingStudentsList.length})`}
                  </span>
                </button>

                {/* Export Missing Student List to Excel */}
                <button
                  type="button"
                  onClick={handleExportMissingExcel}
                  disabled={missingStudentsList.length === 0}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    missingStudentsList.length > 0
                      ? 'bg-amber-500 hover:bg-amber-600 text-amber-950 font-black shadow-amber-200 hover:scale-[1.02]'
                      : 'border border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                  }`}
                  title="ดาวน์โหลดไฟล์ Excel รายชื่อนักเรียนที่ค้างส่งงานในห้องนี้"
                >
                  <FileSpreadsheet size={14} />
                  <span>📊 ส่งออกคนค้างส่ง (Excel)</span>
                </button>

                {/* Upload Roster to this Classroom */}
                <button
                  type="button"
                  onClick={() => {
                    setImportTargetGrade(reportGrade as GradeLevel);
                    setImportTargetRoom(reportRoom);
                    if (reportYear !== 'ALL') setImportTargetYear(reportYear);
                    if (reportSemester !== 'ALL') setImportTargetSemester(reportSemester);
                    if (reportAssignment !== 'ALL') setImportSelectedAssignmentId(reportAssignment);
                    setIsExcelImportOpen(true);
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102"
                  title="อัปโหลดไฟล์ Excel รายชื่อนักเรียนเพื่อนำเข้าสู่ห้องนี้"
                >
                  <Upload size={14} />
                  <span>📥 อัปโหลดรายชื่อห้องนี้</span>
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

                {/* Delete Entire Classroom Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteByRoom(reportGrade, reportRoom, reportYear, reportSemester)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 hover:border-rose-400 shadow-rose-100 hover:scale-[1.02]"
                  title={`ลบข้อมูลห้อง ${reportGrade}/${reportRoom} ทั้งหมด`}
                >
                  <Trash2 size={13} className="text-rose-600" />
                  <span>🗑️ ลบข้อมูลห้องนี้</span>
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

            {/* Quick Room Selector */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span>🚪</span>
                  <span>2. เลือกห้องเรียน:</span>
                  {teacherClassrooms.roomsByGrade[reportGrade]?.length > 0 && (
                    <span className="text-[11px] font-normal text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                      ห้องที่สอนในชั้น {reportGrade}: {teacherClassrooms.roomsByGrade[reportGrade].join(', ')}
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">
                    กำลังแสดงข้อมูลห้อง: <b className="text-violet-700">{reportGrade}/{reportRoom}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllRooms(prev => !prev)}
                    className="text-[11px] text-purple-600 hover:text-purple-800 underline font-medium cursor-pointer"
                  >
                    {showAllRooms ? 'แสดงเฉพาะห้องที่สอน' : 'แสดงทุกห้อง (1-14)'}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showAllRooms || !teacherClassrooms.roomsByGrade[reportGrade] || teacherClassrooms.roomsByGrade[reportGrade].length === 0
                  ? ROOMS
                  : teacherClassrooms.roomsByGrade[reportGrade]
                ).map((r) => {
                  const isCurrent = reportRoom === r;
                  // Count total submissions in this specific room matching year and semester
                  const roomCount = submissions.filter(s => 
                    (!activeTeacher || matchesTeacher(s.teacherName, activeTeacher.fullName)) &&
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

            {/* Detailed Filter Row (Year, Semester, Subject, Assignment, Status, Search) - ไม่ต้องกรองชื่อผู้สอนคนอื่น */}
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
                  {availableAcademicYears.map((y) => (
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
                    .filter(a => !activeTeacher || matchesTeacher(a.teacherName, activeTeacher.fullName))
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
            {/* นักเรียนทั้งหมดในห้อง */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-4 text-white shadow-lg shadow-violet-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>นักเรียนทั้งหมดในห้อง</span>
                <span>👥</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">{roomStats.totalInClass}</div>
                <div className="text-[11px] opacity-80 mt-0.5">ชั้น {reportGrade}/{reportRoom} (Roster & ส่งงาน)</div>
              </div>
            </div>

            {/* ส่งงานแล้ว */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-4 text-white shadow-lg shadow-emerald-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>ส่งงานแล้ว</span>
                <span>✅</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">
                  {roomStats.submittedCount}
                  <span className="text-sm font-semibold opacity-80 ml-1">/ {roomStats.totalInClass}</span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  {roomStats.totalInClass > 0 ? `${Math.round((roomStats.submittedCount / roomStats.totalInClass) * 100)}% ของห้อง` : 'ยังไม่มีนักเรียน'}
                </div>
              </div>
            </div>

            {/* ยังไม่ส่งงาน (ค้างส่ง) */}
            <div className="bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 rounded-3xl p-4 text-white shadow-lg shadow-rose-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>ยังไม่ส่งงาน (ค้างส่ง)</span>
                <span>🚨</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">
                  {roomStats.missingCount}
                  <span className="text-sm font-semibold opacity-80 ml-1">/ {roomStats.totalInClass}</span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  {roomStats.missingCount > 0 ? '⚠️ มีนักเรียนที่ต้องติดตาม' : '🎉 ส่งครบทุกคนแล้ว'}
                </div>
              </div>
            </div>

            {/* ครูตรวจแล้ว */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl p-4 text-white shadow-lg shadow-purple-200/50 flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>คุณครูตรวจแล้ว</span>
                <span>👨‍🏫</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-black">
                  {roomStats.gradedCount}
                  <span className="text-sm font-semibold opacity-80 ml-1">/ {roomStats.submittedCount}</span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  {roomStats.submittedCount > 0 ? `${Math.round((roomStats.gradedCount / roomStats.submittedCount) * 100)}% ของงานที่ส่ง` : 'ยังไม่มีงานส่ง'}
                </div>
              </div>
            </div>

            {/* คะแนนเฉลี่ย (AI & ครู) */}
            <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-3xl p-4 text-white shadow-lg shadow-amber-200/50 flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between opacity-90 text-xs">
                <span>คะแนนเฉลี่ย AI / ครู</span>
                <span>🎯</span>
              </div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-black flex items-center gap-1.5">
                  <span title="คะแนนเฉลี่ย AI">🤖 {roomStats.avgAiScore}</span>
                  <span className="opacity-40">|</span>
                  <span title="คะแนนเฉลี่ยครู">👨‍🏫 {roomStats.avgTeacherScore}</span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">AI ตรวจแล้ว {roomStats.aiEvaluated} ชิ้น</div>
              </div>
            </div>
          </div>

          {/* Quick Filter Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-white/95 rounded-2xl border border-purple-100 shadow-xs">
            <span className="text-xs font-bold text-gray-700 ml-1 mr-1 flex items-center gap-1.5">
              <Filter size={14} className="text-violet-600" />
              <span>ตัวกรองด่วน:</span>
            </span>

            <button
              type="button"
              onClick={() => setReportFilterStatus('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                reportFilterStatus === 'ALL'
                  ? 'bg-violet-600 text-white shadow-xs scale-102'
                  : 'bg-purple-50 hover:bg-purple-100 text-gray-700 border border-purple-100'
              }`}
            >
              👥 ทั้งหมดในห้อง ({roomStats.totalInClass})
            </button>

            <button
              type="button"
              onClick={() => setReportFilterStatus('SUBMITTED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                reportFilterStatus === 'SUBMITTED'
                  ? 'bg-emerald-600 text-white shadow-xs scale-102'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <span>✅ ส่งงานแล้ว ({roomStats.submittedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setReportFilterStatus('MISSING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                reportFilterStatus === 'MISSING'
                  ? 'bg-rose-600 text-white shadow-xs scale-102 animate-pulse'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              <span>🚨 ยังไม่ส่ง / ค้างส่ง ({roomStats.missingCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setReportFilterStatus('GRADED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                reportFilterStatus === 'GRADED'
                  ? 'bg-indigo-600 text-white shadow-xs scale-102'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-100'
              }`}
            >
              <span>👨‍🏫 ตรวจแล้ว ({roomStats.gradedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setReportFilterStatus('WAITING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                reportFilterStatus === 'WAITING'
                  ? 'bg-amber-600 text-white shadow-xs scale-102'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span>⏳ รอตรวจ ({roomStats.waitingCount})</span>
            </button>
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
                  แสดงรายชื่อนักเรียนทุกคนในห้อง ทั้งคนที่ส่งงานแล้ว และคนที่ยังไม่ส่ง (ค้างส่ง) พร้อมคะแนน AI และคะแนนคุณครู
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  ส่งแล้ว {roomStats.submittedCount} คน
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                  ค้างส่ง {roomStats.missingCount} คน
                </span>
              </div>
            </div>

            {/* Empty State */}
            {classroomTracking.length === 0 ? (
              <div className="py-14 text-center space-y-4 bg-purple-50/20 rounded-3xl border border-dashed border-purple-200">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-3xl">
                  🏫
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-gray-800">
                    ไม่พบรายชื่อนักเรียนในห้อง {reportGrade}/{reportRoom}
                  </h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    ยังไม่มีรายชื่อนักเรียนที่อัปโหลดผ่าน Excel หรือส่งงานเข้ามาในห้อง {reportGrade}/{reportRoom} 
                    คุณครูสามารถกดปุ่ม "📥 อัปโหลดรายชื่อห้องนี้" ด้านบน หรือสลับไปห้องอื่น
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportTargetGrade(reportGrade as GradeLevel);
                      setImportTargetRoom(reportRoom);
                      setIsExcelImportOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>อัปโหลดไฟล์ Excel รายชื่อห้องนี้</span>
                  </button>
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
                      <span>เลือกผลงาน {selectedReportSubIds.length} ชิ้นงาน</span>
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

                {/* Submissions & Missing Tracking Table */}
                <div className="overflow-x-auto rounded-2xl border border-purple-100">
                  <table className="w-full text-left text-xs text-gray-800">
                    <thead className="bg-gradient-to-r from-purple-100/90 via-violet-100/80 to-purple-50/90 text-gray-800 uppercase font-bold text-[11px] border-b border-purple-200/80">
                      <tr>
                        <th className="px-3 py-3.5 text-center whitespace-nowrap w-10">
                          <input
                            type="checkbox"
                            checked={
                              roomSubmissions.length > 0 && 
                              selectedReportSubIds.length === roomSubmissions.length
                            }
                            onChange={(e) => setSelectedReportSubIds(e.target.checked ? roomSubmissions.map(s => s.id) : [])}
                            className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-400 cursor-pointer"
                            title="เลือกงานที่ส่งทั้งหมด"
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
                      {classroomTracking.map((item) => {
                        const sub = item.submission;
                        const isSubmitted = item.isSubmitted && !!sub;
                        const isSelected = sub ? selectedReportSubIds.includes(sub.id) : false;

                        const currentInput = sub ? gradingScores[sub.id] : undefined;
                        const currentScoreVal = currentInput?.score !== undefined 
                          ? currentInput.score 
                          : (sub && sub.score !== null && sub.score !== undefined ? String(sub.score) : '');
                        const currentFeedbackVal = currentInput?.feedback !== undefined
                          ? currentInput.feedback
                          : (sub?.feedback || '');

                        const hasAi = !!sub?.aiEvaluation && sub.aiEvaluation.suggestedScore !== undefined;

                        return (
                          <tr 
                            key={item.key} 
                            className={`hover:bg-purple-50/30 transition-colors ${
                              !isSubmitted ? 'bg-rose-50/30' : isSelected ? 'bg-purple-50/60' : ''
                            }`}
                          >
                            {/* Checkbox เลือกรายบุคคล (เฉพาะคนที่ส่งงาน) */}
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {sub ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedReportSubIds(prev => checked ? [...prev, sub.id] : prev.filter(id => id !== sub.id));
                                  }}
                                  className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-400 cursor-pointer"
                                />
                              ) : (
                                <span className="text-gray-300 text-[10px]">-</span>
                              )}
                            </td>

                            {/* เลขที่ */}
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <span className={`w-8 h-8 rounded-xl font-black inline-flex items-center justify-center text-xs shadow-2xs ${
                                isSubmitted 
                                  ? 'bg-violet-100 text-violet-900 border border-violet-200'
                                  : 'bg-rose-100 text-rose-900 border border-rose-300 font-extrabold'
                              }`}>
                                {item.studentNumber || '-'}
                              </span>
                            </td>

                            {/* นักเรียน */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="font-bold text-gray-900 text-xs flex items-center gap-1">
                                  <span>{item.studentName}</span>
                                  {!isSubmitted && (
                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded-md">
                                      ค้างส่ง
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {sub ? (
                                    <>
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
                                    </>
                                  ) : item.rosterItem ? (
                                    <button
                                      type="button"
                                      onClick={() => handleEditRosterStudent(item.rosterItem!)}
                                      className="p-1 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded-md transition-colors cursor-pointer"
                                      title="แก้ไขรายชื่อใน Roster"
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                <span>ชั้น {item.gradeLevel}/{item.room}</span>
                                {sub?.submittedAt && (
                                  <>
                                    <span>•</span>
                                    <span>ส่งเมื่อ {sub.submittedAt.split(' ')[0]}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* วิชา & ชื่องาน */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.subjectCode && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                                    {item.subjectCode}
                                  </span>
                                )}
                                <span className="font-semibold text-gray-800 text-xs">
                                  {item.assignmentName}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                                <span>คะแนนเต็ม {item.maxScore} คะแนน</span>
                                {sub?.workType && (
                                  <>
                                    <span>•</span>
                                    <span className="text-purple-700 font-medium">{sub.workType}</span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* ผลงาน */}
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              {sub?.workUrl ? (
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
                              ) : isSubmitted ? (
                                <span className="text-gray-400 text-xs font-medium">ส่งในห้อง</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                                  ❌ ยังไม่แนบงาน
                                </span>
                              )}
                            </td>

                            {/* 🤖 คะแนนที่ AI ประเมิน & คำแนะนำ */}
                            <td className="px-4 py-3">
                              {hasAi && sub?.aiEvaluation ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-950 font-black text-xs border border-purple-200 shadow-2xs">
                                      <span>🤖 AI:</span>
                                      <span className="text-violet-700 text-sm font-black">
                                        {sub.aiEvaluation.suggestedScore}
                                      </span>
                                      <span className="text-[10px] text-gray-500 font-normal">/ {sub.maxScore}</span>
                                    </span>

                                    {/* Score Quality Badge */}
                                    {sub.aiEvaluation.suggestedScore >= sub.maxScore * 0.8 ? (
                                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        ดีเยี่ยม ✨
                                      </span>
                                    ) : sub.aiEvaluation.suggestedScore >= sub.maxScore * 0.5 ? (
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
                                    {sub.aiEvaluation.feedback || 'ไม่มีข้อเสนอแนะเพิ่มเติม'}
                                  </p>
                                </div>
                              ) : isSubmitted && sub ? (
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
                              ) : (
                                <span className="text-gray-400 text-xs italic">- ยังไม่ส่งผลงาน -</span>
                              )}
                            </td>

                            {/* 👨‍🏫 คะแนนคุณครู (คะแนน & ข้อเสนอแนะ) */}
                            <td className="px-4 py-3">
                              {isSubmitted && sub ? (
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
                              ) : (
                                <span className="text-gray-400 text-xs italic">-</span>
                              )}
                            </td>

                            {/* สถานะ */}
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              {isSubmitted && sub ? (
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
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse shadow-2xs">
                                  <span>🚨</span>
                                  <span>ยังไม่ส่งงาน</span>
                                </span>
                              )}
                            </td>

                            {/* การจัดการ (ใช้คะแนน AI / บันทึกคะแนน / บันทึกงานแทน) */}
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              {isSubmitted && sub ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* Apply AI Score Button */}
                                  {hasAi && sub.aiEvaluation && (
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
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenOfflineModal(item)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-violet-200 transition-all flex items-center gap-1 cursor-pointer hover:scale-102"
                                  title="บันทึกงานส่งในห้องเรียน / ใบงานกระดาษ พร้อมให้คะแนนแทนนักเรียนคนนี้"
                                >
                                  <span>✍️</span>
                                  <span>บันทึกงานแทน</span>
                                </button>
                              )}
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
                {/* Clear All Sample Data Button */}
                <button
                  type="button"
                  onClick={handleClearAllSampleData}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-rose-200 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                  title="ลบข้อมูลตัวอย่าง (Mock Data) ทั้งหมดออกจากระบบ เพื่อให้เหลือเฉพาะข้อมูลนักเรียนจริง"
                >
                  <span>🧹</span>
                  <span>เคลียร์ข้อมูลตัวอย่าง</span>
                </button>

                {/* Upload Student Roster Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (studentManageGrade !== 'ALL') setImportTargetGrade(studentManageGrade as GradeLevel);
                    if (studentManageRoom !== 'ALL') setImportTargetRoom(studentManageRoom);
                    if (studentManageYear !== 'ALL') setImportTargetYear(studentManageYear);
                    if (studentManageSemester !== 'ALL') setImportTargetSemester(studentManageSemester);
                    setIsExcelImportOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                  title="อัปโหลดไฟล์ Excel (.xlsx / .xls / .csv) รายชื่อนักเรียนเพื่อนำเข้าข้อมูลสู่ห้องเรียน"
                >
                  <FileSpreadsheet size={15} />
                  <span>📥 อัปโหลดรายชื่อนักเรียน (Excel)</span>
                </button>

                {/* Delete Entire Classroom Button */}
                <button
                  type="button"
                  disabled={studentManageGrade === 'ALL' || studentManageRoom === 'ALL' || (studentManageViewMode === 'roster' ? filteredRosterList.length === 0 : manageStudentSubmissions.length === 0)}
                  onClick={() => handleDeleteByRoom(studentManageGrade, studentManageRoom, studentManageYear, studentManageSemester)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 cursor-pointer transition-all ${
                    studentManageGrade === 'ALL' || studentManageRoom === 'ALL' || (studentManageViewMode === 'roster' ? filteredRosterList.length === 0 : manageStudentSubmissions.length === 0)
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
                  disabled={studentManageViewMode === 'roster' ? selectedRosterIds.length === 0 : selectedStudentManageIds.length === 0}
                  onClick={() => {
                    if (studentManageViewMode === 'roster') {
                      handleDeleteSelectedRosterStudents(selectedRosterIds);
                    } else {
                      handleDeleteSelectedStudents(selectedStudentManageIds);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    (studentManageViewMode === 'roster' ? selectedRosterIds.length === 0 : selectedStudentManageIds.length === 0)
                      ? 'border border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                      : 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 shadow-2xs hover:scale-[1.02]'
                  }`}
                  title="ลบเฉพาะนักเรียนที่ติ๊กเลือกในตาราง"
                >
                  <Trash2 size={14} className="text-rose-600" />
                  <span>
                    ลบที่เลือก (
                    {studentManageViewMode === 'roster' ? selectedRosterIds.length : selectedStudentManageIds.length} คน
                    )
                  </span>
                </button>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={async () => {
                    alertService.loading('กำลังรีเฟรชข้อมูล...');
                    setRosterList(storageService.getStudentRoster());
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
                {(studentManageYear !== latestYear || studentManageSemester !== latestSemester || studentManageGrade !== 'ALL' || studentManageRoom !== 'ALL' || studentManageSubject !== 'ALL' || studentManageSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentManageYear(latestYear);
                      setStudentManageSemester(latestSemester);
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

              {/* Filter Grid - ไม่ต้องกรองชื่อผู้สอนคนอื่น */}
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
                    {availableAcademicYears.map((y) => (
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
                    {(teacherClassrooms.grades.length > 0 ? teacherClassrooms.grades : GRADE_LEVELS).map((g) => (
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
                    {(studentManageGrade !== 'ALL' && teacherClassrooms.roomsByGrade[studentManageGrade]?.length > 0
                      ? teacherClassrooms.roomsByGrade[studentManageGrade]
                      : teacherClassrooms.rooms.length > 0 ? teacherClassrooms.rooms : ROOMS
                    ).map((r) => (
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
            {/* View Mode Toggle: Roster from Excel vs Submissions History */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100/80 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStudentManageViewMode('roster')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    studentManageViewMode === 'roster'
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-200 scale-102'
                      : 'bg-purple-50/70 hover:bg-purple-100 text-violet-900 border border-purple-200'
                  }`}
                >
                  <Users size={15} />
                  <span>👥 บัญชีรายชื่อในห้อง (Roster จาก Excel)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    studentManageViewMode === 'roster' ? 'bg-white/20 text-white' : 'bg-purple-200 text-purple-900'
                  }`}>
                    {filteredRosterList.length} คน
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudentManageViewMode('submissions')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    studentManageViewMode === 'submissions'
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-200 scale-102'
                      : 'bg-rose-50/70 hover:bg-rose-100 text-rose-900 border border-rose-200'
                  }`}
                >
                  <FileText size={15} />
                  <span>📂 ประวัติการส่งงาน (Submissions)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    studentManageViewMode === 'submissions' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {manageStudentSubmissions.length} รายการ
                  </span>
                </button>
              </div>

              {/* Multi-selection summary on top right */}
              <div className="flex flex-wrap items-center gap-2">
                {studentManageViewMode === 'roster' ? (
                  selectedRosterIds.length > 0 ? (
                    <>
                      <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-xl border border-violet-200">
                        เลือกในบัญชีแล้ว {selectedRosterIds.length} คน
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSelectedRosterStudents(selectedRosterIds)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                      >
                        <Trash2 size={13} />
                        <span>ลบที่เลือก ({selectedRosterIds.length} คน)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRosterIds([])}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={filteredRosterList.length === 0}
                      onClick={() => setSelectedRosterIds(filteredRosterList.map(r => r.id))}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-violet-800 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckSquare size={13} />
                      <span>เลือกทั้งหมดในบัญชี ({filteredRosterList.length})</span>
                    </button>
                  )
                ) : (
                  selectedStudentManageIds.length > 0 ? (
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
                  )
                )}
              </div>
            </div>

            {/* TAB 1: Roster View (รายชื่อที่อัปโหลดจาก Excel) */}
            {studentManageViewMode === 'roster' && (
              filteredRosterList.length === 0 ? (
                <div className="py-14 text-center space-y-4 bg-purple-50/20 rounded-3xl border border-dashed border-purple-200">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-3xl">
                    👥
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-gray-800">
                      ยังไม่มีบัญชีรายชื่อนักเรียนในห้องที่เลือก
                    </h4>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      คุณครูสามารถอัปโหลดไฟล์รายชื่อนักเรียนจาก Excel เพื่อนำเข้าข้อมูลสู่ระบบ หรือปรับตัวกรองชั้นและห้องด้านบน
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (studentManageGrade !== 'ALL') setImportTargetGrade(studentManageGrade as GradeLevel);
                        if (studentManageRoom !== 'ALL') setImportTargetRoom(studentManageRoom);
                        setIsExcelImportOpen(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload size={14} />
                      <span>อัปโหลดรายชื่อห้องนี้ (Excel)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-purple-100">
                  <table className="w-full text-left text-xs text-gray-800">
                    <thead className="bg-gradient-to-r from-violet-100/90 via-purple-100/80 to-indigo-50/90 text-gray-800 uppercase font-bold text-[11px] border-b border-purple-200/80">
                      <tr>
                        <th className="px-3 py-3.5 text-center whitespace-nowrap w-10">
                          <input
                            type="checkbox"
                            checked={filteredRosterList.length > 0 && selectedRosterIds.length === filteredRosterList.length}
                            onChange={(e) => setSelectedRosterIds(e.target.checked ? filteredRosterList.map(r => r.id) : [])}
                            className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-400 cursor-pointer"
                            title="เลือกรายชื่อทั้งหมด"
                          />
                        </th>
                        <th className="px-3.5 py-3.5 text-center whitespace-nowrap">เลขที่</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">ชื่อ-สกุลนักเรียน</th>
                        <th className="px-3.5 py-3.5 text-center whitespace-nowrap">ระดับชั้น/ห้อง</th>
                        <th className="px-3.5 py-3.5 text-center whitespace-nowrap">ปีการศึกษา/ภาคเรียน</th>
                        <th className="px-4 py-3.5 whitespace-nowrap">ข้อมูลการนำเข้า</th>
                        <th className="px-4 py-3.5 text-center whitespace-nowrap">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100/70 bg-white">
                      {filteredRosterList.map((roster) => {
                        const isSelected = selectedRosterIds.includes(roster.id);
                        return (
                          <tr key={roster.id} className={`hover:bg-purple-50/30 transition-colors ${isSelected ? 'bg-purple-50/60' : ''}`}>
                            {/* Checkbox */}
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedRosterIds(prev => checked ? [...prev, roster.id] : prev.filter(id => id !== roster.id));
                                }}
                                className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-400 cursor-pointer"
                              />
                            </td>

                            {/* เลขที่ */}
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-900 border border-violet-200 font-black inline-flex items-center justify-center text-xs shadow-2xs">
                                {roster.studentNumber || '-'}
                              </span>
                            </td>

                            {/* ชื่อ-สกุลนักเรียน */}
                            <td className="px-4 py-3">
                              <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                                <span>{roster.studentName}</span>
                                <span>🧑‍🎓</span>
                              </div>
                            </td>

                            {/* ระดับชั้น/ห้อง */}
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200 shadow-2xs">
                                {roster.gradeLevel}/{roster.room}
                              </span>
                            </td>

                            {/* ปีการศึกษา/ภาคเรียน */}
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <div className="text-xs font-bold text-gray-800">ปี {roster.academicYear || latestYear}</div>
                              <div className="text-[10px] text-gray-500 font-medium">ภาคเรียนที่ {roster.semester || latestSemester}</div>
                            </td>

                            {/* ข้อมูลการนำเข้า */}
                            <td className="px-4 py-3">
                              <div className="text-xs text-gray-700 font-medium">
                                {roster.importedBy || 'ครูผู้สอน'}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                นำเข้าเมื่อ: {roster.importedAt || '-'}
                              </div>
                            </td>

                            {/* การจัดการ */}
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditRosterStudent(roster)}
                                  className="px-2 py-1 text-[11px] font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="แก้ไขชื่อ-สกุล หรือ เลขที่"
                                >
                                  <Edit3 size={11} />
                                  <span>แก้ไข</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleRosterStudent(roster)}
                                  className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="ลบรายชื่อนี้ออกจากบัญชีรายชื่อ"
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
              )
            )}

            {/* TAB 2: Submissions View (ประวัติการส่งงาน) */}
            {studentManageViewMode === 'submissions' && (
              manageStudentSubmissions.length === 0 ? (
                <div className="py-14 text-center space-y-4 bg-rose-50/20 rounded-3xl border border-dashed border-rose-200">
                  <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto text-3xl">
                    🔍
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-gray-800">
                      ไม่พบข้อมูลการส่งงานตามเงื่อนไขตัวกรอง
                    </h4>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      ลองปรับตัวกรองปีการศึกษา ภาคเรียน ระดับชั้น หรือห้องเรียนด้านบน เพื่อค้นหารายชื่อผลงานที่ต้องการจัดการ
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
                        <th className="px-3.5 py-3.5 text-center whitespace-nowrap">เลขที่</th>
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
              )
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

      {/* MODAL: อัปโหลดรายชื่อนักเรียนจาก Excel (EXCEL STUDENT ROSTER UPLOAD) */}
      {isExcelImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-emerald-200 space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-green-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-emerald-200">
                  📥
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-1">
                    <span>โรงเรียนท่าบ่อ • สพม.หนองคาย</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">
                    อัปโหลดรายชื่อนักเรียนด้วยไฟล์ Excel (.xlsx / .xls / .csv)
                  </h3>
                  <p className="text-xs text-gray-500">
                    นำเข้ารายชื่อนักเรียนทั้งห้องเพื่อบันทึกประวัติ หรือสร้างรายการตรวจงานให้อัตโนมัติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsExcelImportOpen(false);
                  setParsedRosterList([]);
                  setExcelFile(null);
                  setExcelFileName('');
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Download Template */}
            <div className="bg-gradient-to-r from-emerald-50/70 via-teal-50/60 to-green-50/70 p-4 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <FileSpreadsheet size={15} className="text-emerald-700" />
                  <span>ขั้นตอนที่ 1: เตรียมไฟล์ตามแม่แบบมาตรฐาน (แนะนำ)</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  คอลัมน์มาตรฐาน: <b>เลขที่</b>, <b>ชื่อ-นามสกุล</b>, <b>ระดับชั้น</b>, <b>ห้อง</b>, <b>ปีการศึกษา</b>, <b>ภาคเรียน</b>
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadRosterTemplate}
                className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto hover:scale-102"
              >
                <Download size={14} className="text-emerald-600" />
                <span>ดาวน์โหลดแม่แบบ Excel (.xlsx)</span>
              </button>
            </div>

            {/* Step 2: Upload Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-800">
                ขั้นตอนที่ 2: เลือกไฟล์ Excel รายชื่อนักเรียน (.xlsx, .xls, .csv)
              </label>
              
              <div className="relative border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-emerald-50/20 hover:bg-emerald-50/40">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">
                    <FileUp size={24} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-900">
                      คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์ Excel มาวางที่นี่
                    </span>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      รองรับไฟล์ .xlsx, .xls, .csv
                    </p>
                  </div>
                </div>
              </div>

              {/* Selected File Status */}
              {excelFileName && (
                <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    <div>
                      <span className="text-xs font-bold text-gray-800">{excelFileName}</span>
                      {parsedRosterList.length > 0 && (
                        <span className="text-xs text-emerald-700 font-semibold ml-2">
                          (ตรวจพบนักเรียน {parsedRosterList.length} คน ✅)
                        </span>
                      )}
                    </div>
                  </div>
                  {isParsingExcel && (
                    <span className="text-xs text-violet-600 font-bold animate-pulse">
                      กำลังอ่านไฟล์...
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Target Options */}
            <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200 space-y-4">
              <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <span>⚙️</span>
                <span>ขั้นตอนที่ 3: ระบุข้อมูลห้องเรียนและปลายทางที่ต้องการนำเข้า</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* ระดับชั้น */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    ระดับชั้น <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={importTargetGrade}
                    onChange={(e) => setImportTargetGrade(e.target.value as GradeLevel)}
                    className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {GRADE_LEVELS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* ห้อง */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    ห้อง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={importTargetRoom}
                    onChange={(e) => setImportTargetRoom(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {ROOMS.map(r => (
                      <option key={r} value={r}>ห้อง {r}</option>
                    ))}
                  </select>
                </div>

                {/* ปีการศึกษา */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    ปีการศึกษา <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={importTargetYear}
                    onChange={(e) => setImportTargetYear(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {ACADEMIC_YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* ภาคเรียน */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    ภาคเรียน <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={importTargetSemester}
                    onChange={(e) => setImportTargetSemester(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {SEMESTERS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Option to create submissions for assignment */}
              <div className="pt-2 border-t border-gray-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importCreateSubmissions}
                    onChange={(e) => setImportCreateSubmissions(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-400 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800">
                    สร้างรายการรอตรวจงานสำหรับใบงานที่เลือกทันที (เหมาะสำหรับเตรียมตรวจงานห้องนี้)
                  </span>
                </label>

                {importCreateSubmissions && (
                  <div className="pl-6 pt-1">
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      เลือกใบงานที่ต้องการสร้างรายการให้นักเรียนทั้งห้อง:
                    </label>
                    <select
                      value={importSelectedAssignmentId}
                      onChange={(e) => setImportSelectedAssignmentId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="">-- เลือกใบงานของครู (ไม่บังคับ) --</option>
                      {assignments
                        .filter(a => !activeTeacher || a.teacherName === activeTeacher.fullName)
                        .map(a => (
                          <option key={a.id} value={a.id}>
                            [{a.subjectCode}] {a.title} ({a.maxScore} คะแนน)
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Preview Table */}
            {parsedRosterList.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <span>📋</span>
                    <span>ตัวอย่างรายชื่อนักเรียนที่ตรวจพบ ({parsedRosterList.length} คน)</span>
                  </label>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ปลายทาง: {importTargetGrade}/{importTargetRoom} (ปี {importTargetYear}/{importTargetSemester})
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-2xl bg-white shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-14">เลขที่</th>
                        <th className="py-2.5 px-4">ชื่อ-นามสกุล</th>
                        <th className="py-2.5 px-3 text-center">ชั้น/ห้อง</th>
                        <th className="py-2.5 px-3 text-center">ปี/เทอม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRosterList.map((st, idx) => (
                        <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-2 px-3 text-center font-bold text-emerald-800">
                            {st.studentNumber || idx + 1}
                          </td>
                          <td className="py-2 px-4 font-semibold text-gray-800">
                            {st.studentName}
                          </td>
                          <td className="py-2 px-3 text-center text-gray-600 font-medium">
                            {st.gradeLevel || importTargetGrade}/{st.room || importTargetRoom}
                          </td>
                          <td className="py-2 px-3 text-center text-gray-500 text-[11px]">
                            {st.academicYear || importTargetYear}/{st.semester || importTargetSemester}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsExcelImportOpen(false);
                  setParsedRosterList([]);
                  setExcelFile(null);
                  setExcelFileName('');
                }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={parsedRosterList.length === 0 || isImporting}
                onClick={handleConfirmImportRoster}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  parsedRosterList.length === 0 || isImporting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-200 hover:scale-102'
                }`}
              >
                <Save size={15} />
                <span>
                  {isImporting
                    ? 'กำลังนำเข้าข้อมูล...'
                    : `🚀 ยืนยันการนำเข้ารายชื่อ (${parsedRosterList.length} คน) ✨`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: บันทึกงานส่งแทน / ให้คะแนนในห้องเรียน (OFFLINE SUBMISSION RECORDING) */}
      {offlineModal && offlineModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-7 shadow-2xl border border-violet-200 space-y-5">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center text-xl shadow-md shadow-violet-200">
                  ✍️
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    บันทึกงานส่งแทน / ตรวจงานในห้องเรียน
                  </h3>
                  <p className="text-xs text-gray-500">
                    {offlineModal.studentName} (เลขที่ {offlineModal.studentNumber} ห้อง {offlineModal.gradeLevel}/{offlineModal.room})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOfflineModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {/* เลือกใบงาน */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  เลือกใบงาน / ชิ้นงานที่ส่ง:
                </label>
                <select
                  value={offlineModal.assignmentId}
                  onChange={(e) => {
                    const assign = assignments.find(a => a.id === e.target.value);
                    if (assign) {
                      setOfflineModal(prev => prev ? ({
                        ...prev,
                        assignmentId: assign.id,
                        assignmentName: assign.title,
                        maxScore: assign.maxScore,
                        subjectCode: assign.subjectCode || prev.subjectCode,
                        subjectName: assign.subjectName || prev.subjectName,
                      }) : null);
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800"
                >
                  {assignments
                    .filter(a => !activeTeacher || matchesTeacher(a.teacherName, activeTeacher.fullName))
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({a.maxScore} คะแนน)
                      </option>
                    ))}
                </select>
              </div>

              {/* คะแนนที่ได้ */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  คะแนนที่ได้ (คะแนนเต็ม {offlineModal.maxScore}):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={offlineModal.maxScore}
                    value={offlineModal.score}
                    onChange={(e) => setOfflineModal(prev => prev ? { ...prev, score: e.target.value } : null)}
                    placeholder="ใส่คะแนน เช่น 8.5"
                    className="w-32 px-3 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <span className="text-xs text-gray-500 font-medium">/ {offlineModal.maxScore} คะแนน (หากยังไม่ตรวจสามารถเว้นว่างไว้ได้)</span>
                </div>
              </div>

              {/* ข้อเสนอแนะของคุณครู */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  คำแนะนำ / ข้อเสนอแนะของคุณครู:
                </label>
                <input
                  type="text"
                  value={offlineModal.feedback}
                  onChange={(e) => setOfflineModal(prev => prev ? { ...prev, feedback: e.target.value } : null)}
                  placeholder="เช่น ทำงานเรียบร้อย, ส่งสมุดครบถ้วน"
                  className="w-full px-3 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              {/* บันทึกลิงก์ / หมายเหตุผลงาน */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  หมายเหตุผลงาน / ลิงก์งาน:
                </label>
                <input
                  type="text"
                  value={offlineModal.workUrl}
                  onChange={(e) => setOfflineModal(prev => prev ? { ...prev, workUrl: e.target.value } : null)}
                  placeholder="เช่น งานส่งในห้องเรียน, สมุดงานเล่มที่ 1"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setOfflineModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveOfflineSubmission}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>บันทึกผลงาน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
