/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Send, 
  ExternalLink, 
  User, 
  Hash, 
  GraduationCap, 
  DoorClosed, 
  Clock, 
  BookOpen, 
  UserCheck, 
  FileText, 
  Link as LinkIcon, 
  CheckCircle2, 
  HelpCircle,
  Sparkles,
  Trash2,
  AlertTriangle,
  Calendar,
  Users,
  Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Submission, GradeLevel, Teacher, Assignment, GoogleSheetConfig } from '../types';
import { GRADE_LEVELS, ROOMS, ACADEMIC_YEARS, SEMESTERS } from '../constants';
import { alertService } from '../services/alertService';
import { storageService } from '../services/storageService';

interface Props {
  teachers: Teacher[];
  assignments: Assignment[];
  sheetConfig: GoogleSheetConfig;
  onSubmissionSuccess: () => void;
  onNavigateToStatus: (studentName?: string) => void;
  prefillAssignment?: {
    teacherName?: string;
    subjectCode?: string;
    assignmentId?: string;
    studentName?: string;
    studentNumber?: string;
    gradeLevel?: GradeLevel;
    room?: string;
  } | null;
  onClearPrefill?: () => void;
}

export default function StudentSubmissionView({
  teachers,
  assignments,
  sheetConfig,
  onSubmissionSuccess,
  onNavigateToStatus,
  prefillAssignment,
  onClearPrefill,
}: Props) {
  // คำนวณปีการศึกษาและภาคเรียนล่าสุดจากงานที่ครูสร้างไว้ในระบบ
  const { latestYear, latestSemester } = useMemo(() => {
    const validYears = assignments
      .map((a) => a.academicYear?.trim())
      .filter((y): y is string => Boolean(y && y.length > 0));

    let bestYear = '2567';
    if (validYears.length > 0) {
      const sortedYears = [...new Set(validYears)].sort((a, b) => {
        const numA = parseInt(a, 10) || 0;
        const numB = parseInt(b, 10) || 0;
        return numB - numA;
      });
      bestYear = sortedYears[0];
    }

    const validSemesters = assignments
      .filter((a) => (!a.academicYear || a.academicYear.trim() === bestYear) && a.semester?.trim())
      .map((a) => a.semester!.trim());

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
  }, [assignments]);

  // รวมรายการปีการศึกษาทั้งหมดที่มีในระบบ เพื่อให้เลือกได้ครบ
  const availableYears = useMemo(() => {
    const set = new Set([
      ...ACADEMIC_YEARS,
      ...assignments.map((a) => a.academicYear?.trim()).filter(Boolean) as string[],
    ]);
    return Array.from(set).sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
  }, [assignments]);

  // ค่าปีการศึกษาและภาคเรียน - นำปีและเทอมล่าสุดที่ครูสร้างไว้มาแสดงเป็นค่าเริ่มต้น
  const [academicYear, setAcademicYear] = useState<string>(() => latestYear);
  const [semester, setSemester] = useState<string>(() => latestSemester);
  const userChangedAcademicYearRef = useRef<boolean>(false);

  // อัปเดตปีและเทอมล่าสุดอัตโนมัติหากยังไม่ได้เลือกเองและไม่มีการส่ง prefillAssignment เข้ามา
  useEffect(() => {
    if (!prefillAssignment && !userChangedAcademicYearRef.current) {
      setAcademicYear(latestYear);
      setSemester(latestSemester);
    }
  }, [latestYear, latestSemester, prefillAssignment]);

  // Student persistent info
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('ม.1');
  const [room, setRoom] = useState('1');
  const [studentName, setStudentName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [selectedRosterStudentId, setSelectedRosterStudentId] = useState<string>('');

  // Work selection
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [workUrl, setWorkUrl] = useState('');
  
  // Current real-time clock
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString('th-TH'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('th-TH'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // When prefillAssignment is passed (e.g. from pending assignments tab)
  useEffect(() => {
    if (prefillAssignment) {
      if (prefillAssignment.studentName) setStudentName(prefillAssignment.studentName);
      if (prefillAssignment.studentNumber) setStudentNumber(prefillAssignment.studentNumber);
      if (prefillAssignment.gradeLevel) setGradeLevel(prefillAssignment.gradeLevel);
      if (prefillAssignment.room) setRoom(prefillAssignment.room);
      if (prefillAssignment.teacherName) setSelectedTeacher(prefillAssignment.teacherName);
      if (prefillAssignment.subjectCode) setSelectedSubject(prefillAssignment.subjectCode);
      if (prefillAssignment.assignmentId) {
        setSelectedAssignmentId(prefillAssignment.assignmentId);
        const matchAssign = assignments.find(a => a.id === prefillAssignment.assignmentId);
        if (matchAssign?.academicYear) setAcademicYear(matchAssign.academicYear);
        if (matchAssign?.semester) setSemester(matchAssign.semester);
      }
    }
  }, [prefillAssignment, assignments]);

  // Query student names in the chosen classroom (from uploaded student roster + existing submissions)
  const availableRoomStudents = React.useMemo(() => {
    const rosterList = storageService.getStudentRoster();
    const allSubs = storageService.getSubmissions();

    const studentMap = new Map<string, { id: string; studentNumber: string; studentName: string; source: 'roster' | 'submission' }>();

    // 1. First priority: from uploaded student roster
    rosterList
      .filter(r => r.gradeLevel === gradeLevel && r.room === room)
      .forEach(r => {
        const key = r.studentName.trim().toLowerCase();
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            id: r.id,
            studentNumber: r.studentNumber,
            studentName: r.studentName.trim(),
            source: 'roster',
          });
        }
      });

    // 2. Second priority: from previous submissions in this grade & room
    allSubs
      .filter(s => s.gradeLevel === gradeLevel && s.room === room && s.studentName.trim())
      .forEach(s => {
        const key = s.studentName.trim().toLowerCase();
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            id: `SUB-${s.id}`,
            studentNumber: s.studentNumber || '',
            studentName: s.studentName.trim(),
            source: 'submission',
          });
        }
      });

    // Sort by numeric studentNumber (1, 2, 3...) then by name
    return Array.from(studentMap.values()).sort((a, b) => {
      const numA = parseInt(a.studentNumber, 10);
      const numB = parseInt(b.studentNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return a.studentName.localeCompare(b.studentName, 'th');
    });
  }, [gradeLevel, room]);

  const handleSelectStudentFromRoster = (studentId: string) => {
    setSelectedRosterStudentId(studentId);
    if (!studentId) {
      return;
    }
    const found = availableRoomStudents.find(s => s.id === studentId);
    if (found) {
      setStudentName(found.studentName);
      if (found.studentNumber) {
        setStudentNumber(found.studentNumber);
      }
    }
  };

  // When teacher changes, filter subjects
  const availableTeachers = teachers.length > 0 ? teachers : [];
  
  // Available subjects for selected teacher, year, and semester
  const availableSubjects = React.useMemo(() => {
    const list = assignments.filter(a => {
      const matchTeacher = !selectedTeacher || a.teacherName === selectedTeacher;
      const matchYear = !a.academicYear || a.academicYear === academicYear;
      const matchSemester = !a.semester || a.semester === semester;
      return matchTeacher && matchYear && matchSemester;
    });
    const effectiveList = list.length > 0 ? list : assignments.filter(a => !selectedTeacher || a.teacherName === selectedTeacher);
    const uniqueMap = new Map<string, { code: string; name: string }>();
    effectiveList.forEach(a => {
      const key = `${a.subjectCode}-${a.subjectName}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { code: a.subjectCode, name: a.subjectName });
      }
    });
    return Array.from(uniqueMap.values());
  }, [assignments, selectedTeacher, academicYear, semester]);

  // Available assignments for selected subject, year, and semester
  const availableAssignments = React.useMemo(() => {
    const strictList = assignments.filter(a => {
      const matchTeacher = !selectedTeacher || a.teacherName === selectedTeacher;
      const matchSubject = !selectedSubject || a.subjectCode === selectedSubject;
      const matchYear = !a.academicYear || a.academicYear === academicYear;
      const matchSemester = !a.semester || a.semester === semester;
      return matchTeacher && matchSubject && matchYear && matchSemester;
    });
    if (strictList.length > 0) return strictList;

    return assignments.filter(a => {
      const matchTeacher = !selectedTeacher || a.teacherName === selectedTeacher;
      const matchSubject = !selectedSubject || a.subjectCode === selectedSubject;
      return matchTeacher && matchSubject;
    });
  }, [assignments, selectedTeacher, selectedSubject, academicYear, semester]);

  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);

  // Check if current student has already submitted this assignment
  const existingSubmissions = React.useMemo(() => {
    if (!studentName.trim() || !selectedAssignmentId) return [];
    const allSubs = storageService.getSubmissions();
    const cleanName = studentName.trim().toLowerCase();
    return allSubs.filter(s =>
      s.assignmentId === selectedAssignmentId &&
      s.studentName.toLowerCase().includes(cleanName) &&
      s.gradeLevel === gradeLevel &&
      s.room === room
    );
  }, [studentName, selectedAssignmentId, gradeLevel, room]);

  const handleDeleteSpecificOldSubmission = async (oldSub: Submission) => {
    const confirm = await Swal.fire({
      title: '🗑️ ยืนยันการลบผลงานเดิม?',
      html: `
        <div class="text-left text-xs space-y-2">
          <p>คุณต้องการลบงาน: <b>${oldSub.assignmentName}</b></p>
          <p class="text-gray-500">ส่งไว้เมื่อ: ${oldSub.submittedAt}</p>
          <p class="text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
            ⚠️ การลบนี้จะนำงานเดิมออก เพื่อให้คุณสามารถส่งงานใหม่แทนที่ได้สะอาดเรียบร้อย
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ ยืนยันการลบงานเดิม',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2 rounded-xl text-xs font-bold',
      }
    });

    if (confirm.isConfirmed) {
      alertService.loading('กำลังลบงานเดิม...', 'ระบบกำลังลบข้อมูลออกจากระบบ');
      await storageService.deleteSubmission(oldSub.id, sheetConfig);
      onSubmissionSuccess();
      alertService.close();
      alertService.success('ลบงานเดิมเรียบร้อยแล้ว', 'คุณสามารถกรอกลิงก์ใหม่และกดส่งงานได้ทันที ✨');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!studentName.trim()) {
      alertService.error('กรุณากรอกชื่อและนามสกุล', 'โปรดระบุชื่อและนามสกุลของผู้ส่งงาน');
      return;
    }
    if (!studentNumber.trim()) {
      alertService.error('กรุณากรอกเลขที่', 'โปรดระบุเลขที่ของนักเรียน');
      return;
    }
    if (!selectedTeacher) {
      alertService.error('กรุณาเลือกครูผู้สอน', 'โปรดเลือกครูผู้สอนประจำวิชา');
      return;
    }
    if (!selectedAssignmentId || !currentAssignment) {
      alertService.error('กรุณาเลือกงานที่ต้องการส่ง', 'โปรดเลือกใบงานหรือชิ้นงานที่ต้องการส่ง');
      return;
    }
    if (!workUrl.trim()) {
      alertService.error('กรุณาแนบลิงก์งาน', 'โปรดแนบลิงก์ผลงาน เช่น Google Drive, Canva, Docs หรือ YouTube');
      return;
    }

    // Check if student has already submitted this assignment
    const allSubs = storageService.getSubmissions();
    const cleanStudentName = studentName.trim();
    const duplicates = allSubs.filter(s => 
      s.assignmentId === currentAssignment.id &&
      s.studentName.trim().toLowerCase() === cleanStudentName.toLowerCase() &&
      s.gradeLevel === gradeLevel &&
      s.room === room
    );

    if (duplicates.length > 0) {
      const latestDup = duplicates[0];
      const dupResult = await Swal.fire({
        title: '⚠️ พบประวัติการส่งงานชิ้นนี้แล้ว',
        html: `
          <div class="text-left text-xs space-y-2">
            <p class="text-gray-800">
              นักเรียน: <b>${cleanStudentName}</b> (เลขที่ ${studentNumber.trim()} ห้อง ${gradeLevel}/${room})
            </p>
            <p class="text-violet-700 font-semibold">
              งาน: ${currentAssignment.title}
            </p>
            <div class="p-2.5 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
              <p class="text-gray-700">📅 เคยส่งไว้เมื่อ: <b>${latestDup.submittedAt}</b></p>
              <p class="text-gray-600">สถานะ: <b>${latestDup.status}</b> ${latestDup.score !== null ? `(${latestDup.score}/${latestDup.maxScore} คะแนน)` : ''}</p>
            </div>
            <p class="text-gray-700 font-medium pt-1">
              ต้องการ <b>ลบงานเก่าแล้วส่งงานนี้แทนที่</b> หรือต้องการ <b>ส่งเพิ่ม (เก็บงานเก่าไว้)</b>?
            </p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '🗑️ ลบงานเก่าแล้วส่งใหม่ (แนะนำ)',
        denyButtonText: '➕ ส่งเพิ่ม (เก็บงานเก่าไว้)',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#EF4444',
        denyButtonColor: '#7C3AED',
        cancelButtonColor: '#6B7280',
        customClass: {
          popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
          confirmButton: 'px-3 py-2 rounded-xl text-xs font-bold',
          denyButton: 'px-3 py-2 rounded-xl text-xs font-bold',
          cancelButton: 'px-3 py-2 rounded-xl text-xs font-bold',
        }
      });

      if (dupResult.isDismissed) {
        return; // User cancelled
      }

      if (dupResult.isConfirmed) {
        // Delete older duplicate(s)
        alertService.loading('กำลังลบงานเก่า...', 'ระบบกำลังลบงานเดิมที่เคยส่งออก');
        for (const dup of duplicates) {
          await storageService.deleteSubmission(dup.id, sheetConfig);
        }
      }
      // If isDenied (ส่งเพิ่ม), proceed with saving without deleting old ones
    }

    try {
      setIsSubmitting(true);
      alertService.loading('กำลังบันทึกข้อมูลการส่งงาน...', 'ระบบกำลังบันทึกและประมวลผลข้อมูลลง Google Sheet');

      const timestamp = new Date().toLocaleString('th-TH');
      const newSubmission: Submission = {
        id: `SUB-${Date.now()}`,
        studentName: cleanStudentName,
        studentNumber: studentNumber.trim(),
        gradeLevel,
        room,
        submittedAt: timestamp,
        teacherName: selectedTeacher,
        subjectCode: currentAssignment.subjectCode,
        subjectName: currentAssignment.subjectName,
        assignmentId: currentAssignment.id,
        assignmentName: currentAssignment.title,
        maxScore: currentAssignment.maxScore,
        workType: currentAssignment.workType || 'ใบงาน/แบบฝึกหัด',
        sampleUrl: currentAssignment.sampleUrl,
        academicYear: academicYear || currentAssignment.academicYear || '2567',
        semester: semester || currentAssignment.semester || '1',
        workUrl: workUrl.trim(),
        score: null,
        status: 'รอตรวจ',
        feedback: '',
      };

      await storageService.addSubmission(newSubmission, sheetConfig);
      onSubmissionSuccess();

      alertService.close();

      // Show question: "ต้องการส่งต่อไหม"
      const continueNext = await alertService.askContinueSubmitting();
      if (continueNext) {
        // Clear work specific fields, keep student profile
        setSelectedSubject('');
        setSelectedAssignmentId('');
        setWorkUrl('');
        alertService.success('พร้อมส่งงานชิ้นถัดไป', 'ข้อมูลนักเรียนเดิมถูกเก็บไว้แล้ว สามารถเลือกวิชาและงานชิ้นใหม่ได้ทันที');
      } else {
        onNavigateToStatus(cleanStudentName);
      }
    } catch (err: any) {
      alertService.error('เกิดข้อผิดพลาดในการบันทึก', err?.message || 'โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-white/95 via-purple-50/60 to-pink-50/60 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/40 border border-purple-100/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <img 
              src="https://img1.pic.in.th/images/images-39bd26cc1ba9520da.png" 
              alt="โลโก้โรงเรียนท่าบ่อ" 
              className="w-14 h-14 md:w-16 md:h-16 object-contain rounded-2xl drop-shadow-md shrink-0 bg-white p-1 border border-amber-200"
            />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 border border-amber-200 text-amber-950 rounded-full text-xs font-bold mb-1">
                <span className="text-sm font-black">🏫 โรงเรียนท่าบ่อ สพม.หนองคาย</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                <span>แบบฟอร์มส่งงานนักเรียน</span>
                <span>📝</span>
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <span>กรอกข้อมูลให้ครบถ้วนเพื่อส่งงานให้คุณครูตรวจ 🌸</span>
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-tr from-sky-50 via-indigo-50 to-purple-50 border border-indigo-100/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-200 text-lg">
              ⏰
            </div>
            <div>
              <div className="text-[11px] font-semibold text-violet-900 uppercase tracking-wider">
                ประทับวันและเวลาส่งงาน
              </div>
              <div className="text-sm font-bold text-violet-700 font-mono">
                {currentTime}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action / Prefill notification */}
      {prefillAssignment && currentAssignment && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white rounded-3xl p-5 shadow-xl shadow-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-amber-300 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0">
              🚀
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
                <span>กำลังเลือกส่งงานที่ค้างส่ง</span>
                <span className="px-2 py-0.5 rounded-full bg-white text-amber-900 text-[10px] font-extrabold">ระบบเลือกข้อมูลให้อัตโนมัติ</span>
              </div>
              <div className="text-base font-extrabold mt-0.5">
                {currentAssignment.title}
              </div>
              <div className="text-xs text-amber-100 mt-0.5">
                วิชา: {currentAssignment.subjectCode} {currentAssignment.subjectName} • ครูผู้สอน: {currentAssignment.teacherName} (คะแนนเต็ม {currentAssignment.maxScore} คะแนน)
              </div>
            </div>
          </div>
          {onClearPrefill && (
            <button
              type="button"
              onClick={onClearPrefill}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold border border-white/40 cursor-pointer transition-colors self-start sm:self-auto"
            >
              เลือกงานอื่นแทน ✕
            </button>
          )}
        </div>
      )}

      {/* Button to check pending assignments & status */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-purple-100 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-gray-700">
          <span className="text-base">💡</span>
          <span>ต้องการตรวจสอบว่าส่งงานครบหรือยัง หรือมีวิชาไหนค้างส่งบ้าง?</span>
        </div>
        <button
          type="button"
          onClick={() => onNavigateToStatus(studentName || undefined)}
          className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
        >
          <span>🔍 เช็คงานค้างส่ง & คะแนนของคุณ</span>
          <span>→</span>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-8">
        {/* Section 1: ข้อมูลปีการศึกษา ระดับชั้น ห้อง และผู้ส่งงาน */}
        <div>
          <div className="flex items-center gap-2.5 pb-3 border-b border-purple-100/60 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-400 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              1
            </div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span>📅 ข้อมูลปีการศึกษา ห้องเรียน และผู้ส่งงาน</span>
            </h2>
            <span className="text-xs text-indigo-700 font-semibold ml-auto hidden sm:inline bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
              ค่าเริ่มต้น: ปีการศึกษา {academicYear} ภาคเรียนที่ {semester}
            </span>
          </div>

          {/* Grid 1: ปีการศึกษา ภาคเรียน ระดับชั้น และห้องเรียน */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* ปีการศึกษา */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-indigo-600" />
                  <span>ปีการศึกษา</span>
                  <span className="text-pink-500 font-bold">*</span>
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold border border-indigo-100">
                  ปี {academicYear}
                </span>
              </label>
              <select
                value={academicYear}
                onChange={(e) => {
                  userChangedAcademicYearRef.current = true;
                  setAcademicYear(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    ปีการศึกษา {y}
                  </option>
                ))}
              </select>
            </div>

            {/* ภาคเรียน */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>📆</span>
                  <span>ภาคเรียน</span>
                  <span className="text-pink-500 font-bold">*</span>
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold border border-indigo-100">
                  เทอม {semester}
                </span>
              </label>
              <select
                value={semester}
                onChange={(e) => {
                  userChangedAcademicYearRef.current = true;
                  setSemester(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer"
              >
                {SEMESTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* ชั้น ม.1 ถึง ม.6 */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-indigo-600" />
                <span>ระดับชั้น</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => {
                  setGradeLevel(e.target.value as GradeLevel);
                  setSelectedRosterStudentId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    ชั้น {g} (มัธยมศึกษาปีที่ {g.replace('ม.', '')})
                  </option>
                ))}
              </select>
            </div>

            {/* ห้อง 1 ถึง 14 */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DoorClosed size={14} className="text-indigo-600" />
                  <span>ห้องเรียน</span>
                  <span className="text-pink-500 font-bold">*</span>
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full font-bold">
                  ห้อง {gradeLevel}/{room}
                </span>
              </label>
              <select
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value);
                  setSelectedRosterStudentId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200/80 bg-purple-50/20 focus:bg-white text-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer"
              >
                {ROOMS.map((r) => (
                  <option key={r} value={r}>
                    ห้อง {r} (ห้อง {gradeLevel}/{r})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* กล่องแสดงรายชื่อนักเรียนในห้องที่เลือก (หากมีรายชื่อให้แสดงชื่อมาให้เลือกได้เลย) */}
          <div className="mb-6">
            {availableRoomStudents.length > 0 ? (
              <div className="bg-gradient-to-r from-violet-50/90 via-indigo-50/90 to-purple-50/90 border-2 border-indigo-200/90 rounded-2xl p-4 md:p-5 shadow-sm space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center text-lg shadow-xs">
                      📋
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                        <span>พบรายชื่อนักเรียนห้อง {gradeLevel}/{room} ในระบบ</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-indigo-600 text-white shadow-2xs">
                          {availableRoomStudents.length} คน
                        </span>
                      </h3>
                      <p className="text-xs text-indigo-700/90">
                        ✨ คลิกเลือกชื่อของคุณได้ทันที ระบบจะใส่ชื่อ-นามสกุลและเลขที่ให้อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  {studentName && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentName('');
                        setStudentNumber('');
                        setSelectedRosterStudentId('');
                      }}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors self-start sm:self-auto cursor-pointer"
                    >
                      ✕ ล้างชื่อที่เลือก / พิมพ์เอง
                    </button>
                  )}
                </div>

                {/* Dropdown เลือกชื่อนักเรียน */}
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5">
                    <span>👇</span>
                    <span>เลือกชื่อของคุณจากรายชื่อห้อง {gradeLevel}/{room} (เรียงตามลำดับเลขที่):</span>
                  </label>
                  <select
                    value={selectedRosterStudentId}
                    onChange={(e) => handleSelectStudentFromRoster(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-indigo-300 bg-white text-gray-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-xs cursor-pointer"
                  >
                    <option value="">
                      -- คลิกเพื่อเลือกชื่อของคุณ ({availableRoomStudents.length} คน) หรือ พิมพ์ชื่อเองด้านล่าง --
                    </option>
                    {availableRoomStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        เลขที่ {st.studentNumber}: {st.studentName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ปุ่มลัดเลือกชื่อนักเรียน (Quick Chips) */}
                <div>
                  <div className="text-[11px] font-bold text-indigo-900/80 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>⚡</span>
                      <span>หรือแตะเลือกชื่อด่วน:</span>
                    </span>
                    <span className="text-[10px] text-gray-500 font-normal">
                      (เลื่อนดูเพิ่มเติมได้)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white/70 rounded-xl border border-indigo-100/80">
                    {availableRoomStudents.map((st) => {
                      const isSelected = studentName.trim() === st.studentName.trim() || selectedRosterStudentId === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectStudentFromRoster(st.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 font-bold scale-[1.02]'
                              : 'bg-white hover:bg-indigo-50 text-gray-800 border border-indigo-100 hover:border-indigo-300 shadow-2xs'
                          }`}
                        >
                          <span className="font-mono text-[10px] opacity-75">#{st.studentNumber}</span>
                          <span>{st.studentName}</span>
                          {isSelected && <Check size={12} className="text-amber-300" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-900 shadow-2xs">
                <span className="text-2xl shrink-0">ℹ️</span>
                <div>
                  <p className="font-bold text-amber-950">ยังไม่มีรายชื่อนักเรียนห้อง {gradeLevel}/{room} บันทึกไว้ในระบบ</p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    คุณสามารถพิมพ์ชื่อ-นามสกุล และเลขที่ในช่องด้านล่างได้โดยตรง ระบบจะบันทึกข้อมูลเพื่อแสดงให้เลือกในครั้งต่อไป
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ช่องกรอกชื่อและเลขที่ (สามารถเลือกจากข้างบนหรือพิมพ์แก้ไขได้) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* ชื่อและนามสกุล */}
            <div className="md:col-span-8">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="text-base">🧑‍🎓</span>
                  <span className="font-bold">ชื่อและนามสกุล ผู้ส่งงาน</span>
                  <span className="text-pink-500 font-bold">*</span>
                </span>
                {studentName && availableRoomStudents.some(s => s.studentName.trim() === studentName.trim()) && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Check size={11} />
                    <span>เลือกจากรายชื่อห้อง {gradeLevel}/{room}</span>
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  const matched = availableRoomStudents.find(
                    s => s.studentName.trim().toLowerCase() === e.target.value.trim().toLowerCase()
                  );
                  if (matched) {
                    setSelectedRosterStudentId(matched.id);
                    if (!studentNumber && matched.studentNumber) {
                      setStudentNumber(matched.studentNumber);
                    }
                  } else {
                    setSelectedRosterStudentId('');
                  }
                }}
                placeholder="เช่น ด.ช. ภูริพัฒน์ วงศ์สว่าง (หรือเลือกจากรายชื่อด้านบน)"
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs"
              />
            </div>

            {/* เลขที่ */}
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">🔢</span>
                <span className="font-bold">เลขที่</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                required
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="เช่น 1"
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: ข้อมูลการส่งงานและครูผู้สอน */}
        <div>
          <div className="flex items-center gap-2.5 pb-3 border-b border-purple-100/60 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-400 to-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              2
            </div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
              <span>📚 เลือกครูผู้สอนและใบงาน</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* เลือกครูผู้สอน */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">👩‍🏫</span>
                <span>เลือกครูผู้สอน</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <select
                required
                value={selectedTeacher}
                onChange={(e) => {
                  setSelectedTeacher(e.target.value);
                  setSelectedSubject('');
                  setSelectedAssignmentId('');
                }}
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer"
              >
                <option value="">-- กรุณาเลือกครูผู้สอน --</option>
                {availableTeachers.map((t) => (
                  <option key={t.id} value={t.fullName}>
                    {t.fullName} ({t.department.replace('กลุ่มสาระการเรียนรู้', '')})
                  </option>
                ))}
              </select>
            </div>

            {/* เลือกวิชาที่ส่งงาน */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">📖</span>
                <span>เลือกวิชาที่ส่งงาน</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <select
                required
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedAssignmentId('');
                }}
                disabled={!selectedTeacher}
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">-- กรุณาเลือกวิชา --</option>
                {availableSubjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* เลือกงานที่ต้องการส่ง */}
            <div className="md:col-span-12">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">📋</span>
                <span>เลือกงานที่ต้องการส่ง</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <select
                required
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                disabled={!selectedSubject}
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">-- กรุณาเลือกใบงาน/ชิ้นงานที่ส่ง --</option>
                {availableAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} [คะแนนเต็ม: {a.maxScore} คะแนน]
                  </option>
                ))}
              </select>

              {currentAssignment && (
                <div className="mt-3 p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-purple-50 border border-emerald-200/80 rounded-2xl space-y-2.5 text-xs text-emerald-950 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <span>งานที่เลือก: <strong>{currentAssignment.title}</strong></span>
                    </div>
                    <span className="font-bold bg-emerald-600 text-white px-3 py-1 rounded-xl shadow-xs shrink-0 self-start sm:self-auto">
                      💯 คะแนนเต็ม {currentAssignment.maxScore} คะแนน
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-100/70">
                    {currentAssignment.workType && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 text-violet-800 rounded-lg font-semibold border border-purple-200 shadow-2xs">
                        <span>🏷️ ชนิดงาน:</span>
                        <span>{currentAssignment.workType}</span>
                      </span>
                    )}

                    {currentAssignment.sampleUrl && (
                      <a
                        href={currentAssignment.sampleUrl.startsWith('http') ? currentAssignment.sampleUrl : `https://${currentAssignment.sampleUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>📄 ดูตัวอย่างใบงาน / เอกสารประกอบของคุณครู</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* แนบลิงก์งาน */}
            <div className="md:col-span-12">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="text-base">📎</span>
                  <span>แนบลิงก์งาน (Google Drive, Canva, Docs, YouTube ฯลฯ)</span>
                  <span className="text-pink-500 font-bold">*</span>
                </span>
                {workUrl && (
                  <a
                    href={workUrl.startsWith('http') ? workUrl : `https://${workUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1 font-semibold underline"
                  >
                    <span>🔗 ทดสอบเปิดลิงก์</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </label>
              <input
                type="url"
                required
                value={workUrl}
                onChange={(e) => setWorkUrl(e.target.value)}
                placeholder="https://drive.google.com/... หรือ https://canva.com/..."
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs"
              />
              <div className="mt-2 p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex items-center gap-2 shadow-xs">
                <span className="text-base">💡</span>
                <span>คำแนะนำ: หากแนบลิงก์จาก Google Drive อย่าลืมตั้งค่าการแชร์เป็น "ทุกคนที่มีลิงก์สามารถดูได้" เพื่อให้คุณครูเปิดตรวจได้สะดวก</span>
              </div>
            </div>

            {/* กล่องแจ้งเตือนพบงานที่เคยส่งซ้ำ พร้อมปุ่มลบงานเดิม */}
            {existingSubmissions.length > 0 && (
              <div className="md:col-span-12 p-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs sm:text-sm">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                    <span>⚠️ ตรวจพบว่าคุณเคยส่งงานชิ้นนี้แล้ว ({existingSubmissions.length} รายการ)</span>
                  </div>
                  <span className="text-[11px] text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full font-semibold">
                    ส่งงานซ้ำ
                  </span>
                </div>
                <p className="text-xs text-amber-800">
                  หากต้องการส่งงานใหม่แทนที่ คุณสามารถคลิกปุ่ม <b>"ลบงานเก่านี้"</b> เพื่อลบงานเดิมออกก่อนส่งได้ทันที
                </p>
                <div className="space-y-2 pt-1">
                  {existingSubmissions.map((oldSub) => (
                    <div 
                      key={oldSub.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white/90 rounded-xl border border-amber-200 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                          <span>📅 ส่งเมื่อ: {oldSub.submittedAt}</span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                            oldSub.status === 'ตรวจแล้ว' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {oldSub.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate max-w-sm">
                          ลิงก์เดิม: {oldSub.workUrl}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {oldSub.workUrl && (
                          <a
                            href={oldSub.workUrl.startsWith('http') ? oldSub.workUrl : `https://${oldSub.workUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink size={11} />
                            <span>ดูงานเดิม</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSpecificOldSubmission(oldSub)}
                          className="px-2.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="ลบงานเก่าชิ้นนี้ออกจากระบบ"
                        >
                          <Trash2 size={12} />
                          <span>🗑️ ลบงานเก่านี้</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ปุ่มบันทึกข้อมูล */}
        <div className="pt-4 border-t border-purple-100/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500 text-center sm:text-left flex items-center gap-1.5">
            <span>✨</span>
            <span>เมื่อกดบันทึก ข้อมูลจะถูกจัดเก็บลงระบบและเชื่อมโยงไปยัง Google Sheet ทันที</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-200/80 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังบันทึกข้อมูล...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>🚀 บันทึกข้อมูลการส่งงาน ✨</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

