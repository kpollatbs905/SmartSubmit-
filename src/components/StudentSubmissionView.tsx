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
  Sparkles
} from 'lucide-react';
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

    try {
      setIsSubmitting(true);
      alertService.loading('กำลังบันทึกข้อมูลการส่งงาน...', 'ระบบกำลังบันทึกและประมวลผลข้อมูลลง Google Sheet');

      const timestamp = new Date().toLocaleString('th-TH');
      const newSubmission: Submission = {
        id: `SUB-${Date.now()}`,
        studentName: studentName.trim(),
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
        onNavigateToStatus(studentName.trim());
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
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-white/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-semibold mb-2">
              <Sparkles size={14} className="text-indigo-600 animate-spin" />
              ระบบส่งงานและตรวจงานออนไลน์
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              แบบฟอร์มส่งงานนักเรียน
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              โรงเรียนท่าบ่อ สพม.หนองคาย • กรอกข้อมูลให้ครบถ้วนเพื่อส่งงานให้คุณครูตรวจ
            </p>
          </div>
          
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-indigo-900 uppercase tracking-wider">
                ประทับวันและเวลาส่งงาน
              </div>
              <div className="text-sm font-bold text-indigo-700 font-mono">
                {currentTime}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Box */}
      <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-white/60 space-y-8">
        {/* Section 1: ข้อมูลนักเรียน */}
        <div>
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h2 className="text-lg font-bold text-gray-800">ข้อมูลผู้ส่งงาน</h2>
            <span className="text-xs text-gray-400 ml-auto">* ข้อมูลจะถูกจดจำไว้สำหรับการส่งงานชิ้นถัดไป</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* ชื่อและนามสกุล */}
            <div className="md:col-span-8">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <User size={16} className="text-indigo-500" />
                ชื่อและนามสกุล ผู้ส่งงาน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="เช่น ด.ช. ภูริพัฒน์ วงศ์สว่าง"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
            </div>

            {/* เลขที่ */}
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Hash size={16} className="text-indigo-500" />
                เลขที่ <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="60"
                required
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="เช่น 1"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
            </div>

            {/* ชั้น ม.1 ถึง ม.6 */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <GraduationCap size={16} className="text-indigo-500" />
                ระดับชั้น (ม.1 ถึง ม.6) <span className="text-red-500">*</span>
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm cursor-pointer"
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
                <DoorClosed size={16} className="text-indigo-500" />
                ห้อง (ห้อง 1 ถึง 14) <span className="text-red-500">*</span>
              </label>
              <select
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm cursor-pointer"
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
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h2 className="text-lg font-bold text-gray-800">เลือกครูผู้สอนและใบงาน</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* เลือกครูผู้สอน */}
            <div className="md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <UserCheck size={16} className="text-indigo-500" />
                เลือกครูผู้สอน <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedTeacher}
                onChange={(e) => {
                  setSelectedTeacher(e.target.value);
                  setSelectedSubject('');
                  setSelectedAssignmentId('');
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm cursor-pointer"
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
                <BookOpen size={16} className="text-indigo-500" />
                เลือกวิชาที่ส่งงาน <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedAssignmentId('');
                }}
                disabled={!selectedTeacher}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
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
                <FileText size={16} className="text-indigo-500" />
                เลือกงานที่ต้องการส่ง <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                disabled={!selectedSubject}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">-- กรุณาเลือกใบงาน/ชิ้นงานที่ส่ง --</option>
                {availableAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} [คะแนนเต็ม: {a.maxScore} คะแนน]
                  </option>
                ))}
              </select>

              {currentAssignment && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>งานที่เลือก: <strong>{currentAssignment.title}</strong></span>
                  </div>
                  <span className="font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg">
                    คะแนนเต็ม {currentAssignment.maxScore} คะแนน
                  </span>
                </div>
              )}
            </div>

            {/* แนบลิงก์งาน */}
            <div className="md:col-span-12">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <LinkIcon size={16} className="text-indigo-500" />
                  แนบลิงก์งาน (Google Drive, Canva, Docs, YouTube, เว็บไซต์ ฯลฯ) <span className="text-red-500">*</span>
                </span>
                {workUrl && (
                  <a
                    href={workUrl.startsWith('http') ? workUrl : `https://${workUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline"
                  >
                    ทดสอบเปิดลิงก์ <ExternalLink size={12} />
                  </a>
                )}
              </label>
              <input
                type="url"
                required
                value={workUrl}
                onChange={(e) => setWorkUrl(e.target.value)}
                placeholder="https://drive.google.com/... หรือ https://canva.com/..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <HelpCircle size={13} className="text-gray-400" />
                คำแนะนำ: หากแนบลิงก์จาก Google Drive อย่าลืมตั้งค่าการแชร์เป็น "ทุกคนที่มีลิงก์สามารถดูได้"
              </p>
            </div>
          </div>
        </div>

        {/* ปุ่มบันทึกข้อมูล */}
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500 text-center sm:text-left">
            เมื่อกดบันทึก ข้อมูลจะถูกจัดเก็บลงระบบและเชื่อมโยงไปยัง Google Sheet ทันที
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-lg shadow-indigo-300 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังบันทึกข้อมูล...
              </>
            ) : (
              <>
                <Send size={18} />
                บันทึกข้อมูลการส่งงาน
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
