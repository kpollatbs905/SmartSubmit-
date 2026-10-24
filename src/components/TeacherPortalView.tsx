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
  AlertCircle
} from 'lucide-react';
import { Teacher, Assignment, Submission, AssignmentItem, GoogleSheetConfig } from '../types';
import { DEPARTMENTS, GRADE_LEVELS, ROOMS, ACADEMIC_YEARS, SEMESTERS } from '../constants';
import { storageService } from '../services/storageService';
import { alertService } from '../services/alertService';

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

  // Teacher dashboard sub-tab: 'grade' (ตรวจงาน) or 'assignments' (จัดการงาน)
  const [teacherTab, setTeacherTab] = useState<'grade' | 'assignments'>('grade');

  // Add Assignment form states
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [assignYear, setAssignYear] = useState('2567');
  const [assignSemester, setAssignSemester] = useState('1');
  const [assignmentItems, setAssignmentItems] = useState<AssignmentItem[]>([
    { id: '1', title: 'ใบงานที่ 1: ', maxScore: 10 },
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
      alertService.error('เข้าสู่ระบบไม่สำเร็จ', 'Username หรือ Password ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }
  };

  const handleLogout = () => {
    setActiveTeacher(null);
    storageService.setActiveTeacher(null);
    alertService.info('ออกจากระบบแล้ว', 'ขอบคุณที่ใช้งานระบบตรวจงานให้คะแนน ออนไลน์');
  };

  // -------------------------------------------------------------
  // ASSIGNMENTS MANAGEMENT HANDLERS
  // -------------------------------------------------------------
  const handleAddAssignmentItem = () => {
    const nextNumber = assignmentItems.length + 1;
    setAssignmentItems(prev => [
      ...prev,
      { id: String(Date.now()), title: `ใบงานที่ ${nextNumber}: `, maxScore: 10 },
    ]);
  };

  const handleRemoveAssignmentItem = (index: number) => {
    if (assignmentItems.length <= 1) {
      alertService.info('ไม่สามารถลบได้', 'ต้องมีชิ้นงานอย่างน้อย 1 รายการ');
      return;
    }
    setAssignmentItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'title' | 'maxScore', val: any) => {
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
      academicYear: assignYear,
      semester: assignSemester,
      createdAt: new Date().toLocaleString('th-TH'),
    }));

    await storageService.addAssignments(newAssignments, sheetConfig);
    alertService.close();
    await alertService.success('บันทึกข้อมูลงานสำเร็จ!', `เพิ่มงานจำนวน ${newAssignments.length} ชิ้นงาน (ปีการศึกษา ${assignYear} เทอม ${assignSemester}) เรียบร้อยแล้ว`);

    // Reset items
    setAssignmentItems([{ id: '1', title: 'ใบงานที่ 1: ', maxScore: 10 }]);
    onAssignmentsChange();
  };

  const handleDeleteAssignment = async (id: string, title: string) => {
    const confirm = await alertService.askContinueSubmitting();
    // Using simple confirm or delete
    await storageService.deleteAssignment(id, sheetConfig);
    onAssignmentsChange();
    alertService.success('ลบงานเรียบร้อย', `ลบงาน "${title}" เรียบร้อยแล้ว`);
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
                placeholder="ระบุ username (เช่น teacher)"
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
                placeholder="ระบุรหัสผ่าน (เช่น 1234)"
                className="w-full px-4 py-3 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-xs"
              />
            </div>

            <div className="p-3.5 bg-gradient-to-r from-violet-50 to-purple-50 border border-purple-100 rounded-2xl text-xs text-violet-800 shadow-xs flex items-center gap-2">
              <span className="text-base">💡</span>
              <span>บัญชีทดสอบเริ่มต้น: Username = <strong>teacher</strong> | Password = <strong>1234</strong></span>
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
            {/* Sub-tabs: ตรวจงาน / จัดการงาน */}
            <div className="flex bg-purple-100/60 p-1 rounded-xl border border-purple-200/60">
              <button
                onClick={() => setTeacherTab('grade')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  teacherTab === 'grade'
                    ? 'bg-white text-violet-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>📝</span>
                <span>เมนูตรวจงาน</span>
              </button>
              <button
                onClick={() => setTeacherTab('assignments')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  teacherTab === 'assignments'
                    ? 'bg-white text-violet-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>📋</span>
                <span>เพิ่ม/จัดการงาน</span>
              </button>
            </div>

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
                      className="p-5 hover:bg-indigo-50/20 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                    >
                      {/* Left: Student & Work Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-800">
                            {sub.gradeLevel}/{sub.room} • เลขที่ {sub.studentNumber}
                          </span>
                          <span className="font-bold text-gray-900 text-base">
                            {sub.studentName}
                          </span>
                          {sub.status === 'ตรวจแล้ว' ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              ตรวจแล้ว ({sub.score}/{sub.maxScore})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              รอตรวจ
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-600">
                          <span className="font-semibold text-indigo-700">{sub.subjectCode} {sub.subjectName}</span>
                          <span className="mx-2 text-gray-300">•</span>
                          <span className="font-medium text-gray-800">{sub.assignmentName}</span>
                          <span className="mx-2 text-gray-300">•</span>
                          <span className="text-gray-400">ส่งเมื่อ: {sub.submittedAt}</span>
                        </div>

                        {/* Open Work Link */}
                        <div className="pt-1">
                          <a
                            href={sub.workUrl.startsWith('http') ? sub.workUrl : `https://${sub.workUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all shadow-sm cursor-pointer"
                          >
                            <ExternalLink size={13} />
                            คลิกเพื่อเปิดดูผลงานนักเรียน
                          </a>
                        </div>
                      </div>

                      {/* Right: Score and Feedback Inputs */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200/80">
                        {/* Score Box */}
                        <div className="w-full sm:w-32">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center justify-between">
                            <span>คะแนน</span>
                            <span className="text-gray-400">เต็ม {sub.maxScore}</span>
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
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Feedback Box */}
                        <div className="w-full sm:w-64">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            คำแนะนำ/ข้อเสนอแนะ
                          </label>
                          <input
                            type="text"
                            value={currentFeedbackInput}
                            onChange={(e) => handleFeedbackInputChange(sub.id, e.target.value)}
                            placeholder="เช่น ยอดเยี่ยม, แก้ไขข้อ 2 เพิ่มเติม"
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Save Button */}
                        <button
                          onClick={() => handleSaveGrade(sub)}
                          className="sm:self-end px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Save size={14} />
                          บันทึกคะแนน
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

      {/* SUB-VIEW 2: จัดการงาน / เพิ่มงาน (ASSIGNMENTS MANAGEMENT) */}
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
                    onChange={(e) => setSubjectCode(e.target.value)}
                    placeholder="เช่น ว21103"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="เช่น วิทยาการคำนวณ 1"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
                      <span>ชิ้นงานที่ {index + 1}</span>
                      {assignmentItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignmentItem(index)}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-8">
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                          placeholder="ชื่องาน เช่น ใบงานที่ 1..."
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.maxScore}
                          onChange={(e) => handleItemChange(index, 'maxScore', Number(e.target.value))}
                          placeholder="คะแนนเต็ม"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ปุ่มบันทึกข้อมูล */}
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Save size={18} />
                บันทึกข้อมูลงาน
              </button>
            </form>
          </div>

          {/* Table: รายการงานที่สร้างไว้ */}
          <div className="lg:col-span-7">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/60 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    งานทั้งหมดที่คุณครูสร้างไว้ ({assignments.filter(a => a.teacherName === activeTeacher.fullName).length} ชิ้นงาน)
                  </h3>
                  <p className="text-xs text-gray-500">สามารถแก้ไขหรือลบชิ้นงานได้</p>
                </div>
              </div>

              <div className="space-y-3">
                {assignments
                  .filter(a => a.teacherName === activeTeacher.fullName)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="p-4 bg-gray-50/80 hover:bg-indigo-50/40 rounded-2xl border border-gray-200/80 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">
                            {a.subjectCode}
                          </span>
                          <span className="text-xs font-semibold text-gray-500">
                            {a.subjectName}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">
                          {a.title}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          สร้างเมื่อ: {a.createdAt}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                            เต็ม {a.maxScore} คะแนน
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteAssignment(a.id, a.title)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
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
    </div>
  );
}
