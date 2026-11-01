/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Submission, GradeLevel, Teacher, Assignment, GoogleSheetConfig } from '../types';
import { GRADE_LEVELS, ROOMS } from '../constants';
import { alertService } from '../services/alertService';
import { storageService } from '../services/storageService';

interface Props {
  teachers: Teacher[];
  assignments: Assignment[];
  sheetConfig: GoogleSheetConfig;
  onSubmissionSuccess: () => void;
  onNavigateToStatus: (studentName?: string) => void;
}

export default function StudentSubmissionView({
  teachers,
  assignments,
  sheetConfig,
  onSubmissionSuccess,
  onNavigateToStatus,
}: Props) {
  // Student persistent info
  const [studentName, setStudentName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('ม.1');
  const [room, setRoom] = useState('1');

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

  // When teacher changes, filter subjects
  const availableTeachers = teachers.length > 0 ? teachers : [];
  
  // Available subjects for selected teacher
  const availableSubjects = React.useMemo(() => {
    const list = assignments.filter(a => !selectedTeacher || a.teacherName === selectedTeacher);
    const uniqueMap = new Map<string, { code: string; name: string }>();
    list.forEach(a => {
      const key = `${a.subjectCode}-${a.subjectName}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { code: a.subjectCode, name: a.subjectName });
      }
    });
    return Array.from(uniqueMap.values());
  }, [assignments, selectedTeacher]);

  // Available assignments for selected subject
  const availableAssignments = React.useMemo(() => {
    return assignments.filter(a => {
      const matchTeacher = !selectedTeacher || a.teacherName === selectedTeacher;
      const matchSubject = !selectedSubject || a.subjectCode === selectedSubject;
      return matchTeacher && matchSubject;
    });
  }, [assignments, selectedTeacher, selectedSubject]);

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
        academicYear: currentAssignment.academicYear || '2567',
        semester: currentAssignment.semester || '1',
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

      {/* Main Form Box */}
      <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-8">
        {/* Section 1: ข้อมูลนักเรียน */}
        <div>
          <div className="flex items-center gap-2.5 pb-3 border-b border-purple-100/60 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-400 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              1
            </div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
              <span>👤 ข้อมูลผู้ส่งงาน</span>
            </h2>
            <span className="text-xs text-violet-600/80 font-medium ml-auto hidden sm:inline">
              ✨ ข้อมูลจะถูกจดจำไว้สำหรับการส่งงานชิ้นถัดไป
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* ชื่อและนามสกุล */}
            <div className="md:col-span-8">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">🧑‍🎓</span>
                <span>ชื่อและนามสกุล ผู้ส่งงาน</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="เช่น ด.ช. ภูริพัฒน์ วงศ์สว่าง"
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs"
              />
            </div>

            {/* เลขที่ */}
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">🔢</span>
                <span>เลขที่</span>
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

            {/* ชั้น ม.1 ถึง ม.6 */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">🎓</span>
                <span>ระดับชั้น (ม.1 ถึง ม.6)</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    ชั้นมัธยมศึกษาปีที่ {g.replace('ม.', '')} ({g})
                  </option>
                ))}
              </select>
            </div>

            {/* ห้อง 1 ถึง 14 */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-base">🚪</span>
                <span>ห้องเรียน (ห้อง 1 ถึง 14)</span>
                <span className="text-pink-500 font-bold">*</span>
              </label>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-purple-200/70 bg-purple-50/20 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-xs cursor-pointer"
              >
                {ROOMS.map((r) => (
                  <option key={r} value={r}>
                    ห้อง {r} (ห้อง {gradeLevel}/{r})
                  </option>
                ))}
              </select>
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

