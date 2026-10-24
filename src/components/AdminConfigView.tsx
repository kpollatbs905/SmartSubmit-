/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Database, 
  ExternalLink, 
  Copy, 
  Check, 
  RefreshCw, 
  FileCode, 
  Server, 
  Sparkles, 
  HelpCircle, 
  Users, 
  GraduationCap, 
  Trash2, 
  Search, 
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import Swal from 'sweetalert2';
import { GoogleSheetConfig, Submission, Teacher } from '../types';
import { GOOGLE_APPS_SCRIPT_CODE } from '../services/googleScriptCode';
import { storageService } from '../services/storageService';
import { alertService } from '../services/alertService';

interface Props {
  sheetConfig: GoogleSheetConfig;
  submissions: Submission[];
  teachers: Teacher[];
  onConfigChange: (config: GoogleSheetConfig) => void;
  onTriggerSync: () => Promise<void>;
  onDataChange: () => void;
}

export default function AdminConfigView({
  sheetConfig,
  submissions,
  teachers,
  onConfigChange,
  onTriggerSync,
  onDataChange,
}: Props) {
  // Admin sub-tabs: 'students' | 'teachers' | 'config'
  const [adminTab, setAdminTab] = useState<'students' | 'teachers' | 'config'>('students');

  // Search states for management
  const [studentSearch, setStudentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');

  // Sheet config state
  const [sheetId, setSheetId] = useState(sheetConfig.sheetId || '');
  const [scriptUrl, setScriptUrl] = useState(sheetConfig.scriptUrl || '');
  const [copied, setCopied] = useState(false);
  const [testingPing, setTestingPing] = useState(false);

  // Filtered submissions for student management
  const filteredSubmissions = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter(s => 
      s.studentName.toLowerCase().includes(q) ||
      s.studentNumber.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.subjectCode.toLowerCase().includes(q) ||
      s.assignmentName.toLowerCase().includes(q) ||
      `${s.gradeLevel}/${s.room}`.includes(q)
    );
  }, [submissions, studentSearch]);

  // Filtered teachers for teacher management
  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(t => 
      t.fullName.toLowerCase().includes(q) ||
      t.username.toLowerCase().includes(q) ||
      t.department.toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch]);

  // Delete student submission handler with SweetAlert2
  const handleDeleteStudentSubmission = async (submission: Submission) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'ยืนยันการลบข้อมูลการส่งงาน?',
      html: `
        <div class="text-left font-['Kanit',sans-serif] space-y-2 text-sm text-gray-600">
          <p>คุณกำลังจะลบข้อมูลงานของ: <strong class="text-gray-900">${submission.studentName}</strong></p>
          <p>วิชา: <strong>${submission.subjectCode} ${submission.subjectName}</strong></p>
          <p>ชื่องาน: <strong>${submission.assignmentName}</strong></p>
          <p class="text-xs text-red-500 font-semibold pt-2">⚠️ การลบข้อมูลนี้จะลบออกจากระบบและส่งคำสั่งลบไปยัง Google Sheet</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันลบข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
      },
    });

    if (result.isConfirmed) {
      alertService.loading('กำลังลบข้อมูล...', 'ระบบกำลังลบข้อมูลออกจากฐานข้อมูลและ Google Sheet');
      await storageService.deleteSubmission(submission.id, sheetConfig);
      alertService.close();

      await alertService.success(
        'ลบข้อมูลสำเร็จ!',
        `ลบข้อมูลการส่งงานของ ${submission.studentName} เรียบร้อยแล้ว`
      );
      onDataChange();
    }
  };

  // Delete teacher handler with SweetAlert2
  const handleDeleteTeacher = async (teacher: Teacher) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'ยืนยันการลบข้อมูลครูผู้สอน?',
      html: `
        <div class="text-left font-['Kanit',sans-serif] space-y-2 text-sm text-gray-600">
          <p>คุณกำลังจะลบข้อมูลครู: <strong class="text-gray-900">${teacher.fullName}</strong></p>
          <p>กลุ่มสาระ: <strong>${teacher.department}</strong></p>
          <p>Username: <strong>${teacher.username}</strong></p>
          <p class="text-xs text-red-500 font-semibold pt-2">⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันลบครูผู้สอน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-2xl font-[\'Kanit\',sans-serif]',
      },
    });

    if (result.isConfirmed) {
      alertService.loading('กำลังลบข้อมูลครู...', 'กำลังดำเนินการลบออกจากฐานข้อมูล');
      await storageService.deleteTeacher(teacher.id, sheetConfig);
      alertService.close();

      await alertService.success(
        'ลบข้อมูลครูสำเร็จ!',
        `ลบข้อมูล ${teacher.fullName} เรียบร้อยแล้ว`
      );
      onDataChange();
    }
  };

  // Save sheet config
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const newConfig: GoogleSheetConfig = {
      ...sheetConfig,
      sheetId: sheetId.trim(),
      scriptUrl: scriptUrl.trim(),
    };
    storageService.saveSheetConfig(newConfig);
    onConfigChange(newConfig);
    alertService.success('บันทึกการตั้งค่าสำเร็จ', 'ข้อมูลการเชื่อมต่อ Google Sheets และ Apps Script ได้รับการบันทึกแล้ว');
  };

  // Ping test
  const handleTestConnection = async () => {
    if (!scriptUrl.trim()) {
      alertService.error('กรุณาระบุ URL ของ Google Apps Script', 'ยังไม่ได้ระบุ Web App URL');
      return;
    }

    try {
      setTestingPing(true);
      alertService.loading('กำลังทดสอบการเชื่อมต่อ...', 'ส่งคำขอ Ping ไปยัง Google Apps Script Web App');

      const pingUrl = `${scriptUrl.trim()}${scriptUrl.includes('?') ? '&' : '?'}action=ping&t=${Date.now()}`;
      const res = await fetch(pingUrl);
      const data = await res.json();

      alertService.close();

      if (data.status === 'success') {
        alertService.success('เชื่อมต่อสำเร็จ! 🎉', data.message || 'Google Apps Script ตอบกลับเป็นปกติ พร้อมใช้งาน');
      } else {
        alertService.error('การตอบกลับมีข้อผิดพลาด', data.message || 'โปรดตรวจสอบการ Deploy');
      }
    } catch (err: any) {
      alertService.close();
      alertService.info(
        'ผลการทดสอบการเชื่อมต่อ',
        'หากเบราว์เซอร์ติดบล็อก CORS ไม่ต้องกังวล ระบบการส่งงานใช้งานโหมด no-cors กับ Google Apps Script ซึ่งสามารถบันทึกข้อมูลได้จริงตามปกติ กรุณากดปุ่ม "ซิงค์ดึงข้อมูลสด" เพื่อทดสอบอีกครั้ง'
      );
    } finally {
      setTestingPing(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setCopied(true);
      alertService.success('คัดลอกโค้ด GS สำเร็จ!', 'คุณสามารถนำโค้ดไปวางใน Extensions > Apps Script บน Google Sheets ได้ทันที');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alertService.error('ไม่สามารถคัดลอกอัตโนมัติได้', 'โปรดเลือกและคัดลอกจากกล่องข้อความด้านล่าง');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-white/95 via-purple-50/60 to-pink-50/60 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/40 border border-purple-100/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100/80 text-amber-900 border border-amber-200 rounded-full text-xs font-semibold mb-2 shadow-xs">
              <span>🔒</span>
              <span>ส่วนจัดการระบบและฐานข้อมูล (ADMIN)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>ระบบจัดการข้อมูลและตั้งค่าชีต</span>
              <span>⚙️</span>
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              โรงเรียนท่าบ่อ • จัดการค้นหาและลบข้อมูลนักเรียน ข้อมูลครูผู้สอน และตั้งค่าเชื่อมต่อ Apps Script 🌸
            </p>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap bg-purple-100/60 p-1.5 rounded-2xl gap-1 border border-purple-200/60">
            <button
              onClick={() => setAdminTab('students')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                adminTab === 'students'
                  ? 'bg-white text-violet-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>🧑‍🎓</span>
              <span>ลบข้อมูลนักเรียน ({submissions.length})</span>
            </button>
            <button
              onClick={() => setAdminTab('teachers')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                adminTab === 'teachers'
                  ? 'bg-white text-violet-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>👩‍🏫</span>
              <span>ลบข้อมูลครู ({teachers.length})</span>
            </button>
            <button
              onClick={() => setAdminTab('config')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                adminTab === 'config'
                  ? 'bg-white text-violet-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>⚙️</span>
              <span>ตั้งค่าชีต & โค้ด GS</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* TAB 1: ลบข้อมูลนักเรียนด้วยการค้นหาชื่อ */}
      {/* ---------------------------------------------------------------- */}
      {adminTab === 'students' && (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-white/60 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users size={20} className="text-indigo-600" />
                ค้นหาและลบข้อมูลการส่งงานของนักเรียน
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                พิมพ์ชื่อ-นามสกุลเพื่อค้นหาและลบรายการส่งงานที่ไม่ถูกต้องหรือซ้ำซ้อน
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="พิมพ์ชื่อนักเรียน หรือเลขที่ เพื่อค้นหา..."
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {studentSearch && (
                <button
                  onClick={() => setStudentSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              ไม่พบข้อมูลนักเรียนที่ตรงกับคำค้นหา "{studentSearch}"
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold text-gray-600 uppercase border-b border-gray-200">
                    <th className="py-3 px-3 text-center w-14">เลขที่</th>
                    <th className="py-3 px-3">ชื่อ-นามสกุล นักเรียน</th>
                    <th className="py-3 px-3 text-center">ชั้น/ห้อง</th>
                    <th className="py-3 px-3">วิชาและชื่องาน</th>
                    <th className="py-3 px-3 text-center">คะแนน</th>
                    <th className="py-3 px-3 text-center">สถานะ</th>
                    <th className="py-3 px-3 text-center">วันที่ส่ง</th>
                    <th className="py-3 px-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredSubmissions.map((s) => (
                    <tr key={s.id} className="hover:bg-red-50/20 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-gray-700">
                        {s.studentNumber}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-900">
                        {s.studentName}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold">
                          {s.gradeLevel}/{s.room}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate" title={s.assignmentName}>
                        <div className="font-semibold text-indigo-700">{s.subjectCode} {s.subjectName}</div>
                        <div className="text-gray-600 truncate">{s.assignmentName}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        {s.score !== null ? `${s.score}/${s.maxScore}` : `-/${s.maxScore}`}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'ตรวจแล้ว' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-400">
                        {s.submittedAt}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteStudentSubmission(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                          title="ลบข้อมูลการส่งงานของนักเรียนนี้"
                        >
                          <Trash2 size={13} />
                          <span>ลบ</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* TAB 2: ลบข้อมูลครูผู้สอนด้วยการค้นหาชื่อ */}
      {/* ---------------------------------------------------------------- */}
      {adminTab === 'teachers' && (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-white/60 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap size={20} className="text-indigo-600" />
                ค้นหาและลบข้อมูลครูผู้สอน
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                ค้นหาชื่อครูเพื่อจัดการหรือลบบัญชีออกจากระบบ
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="พิมพ์ชื่อครู หรือ username..."
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {teacherSearch && (
                <button
                  onClick={() => setTeacherSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredTeachers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              ไม่พบข้อมูลครูผู้สอนที่ตรงกับคำค้นหา "{teacherSearch}"
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold text-gray-600 uppercase border-b border-gray-200">
                    <th className="py-3 px-4">ชื่อ-นามสกุล ครูผู้สอน</th>
                    <th className="py-3 px-4">กลุ่มสาระการเรียนรู้</th>
                    <th className="py-3 px-4 text-center">Username</th>
                    <th className="py-3 px-4 text-center">วันที่สมัคร</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredTeachers.map((t) => (
                    <tr key={t.id} className="hover:bg-red-50/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-900">
                        {t.fullName}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {t.department}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-indigo-700 font-semibold">
                        {t.username}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-400">
                        {t.createdAt}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteTeacher(t)}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                          title="ลบข้อมูลครูผู้สอนนี้"
                        >
                          <Trash2 size={13} />
                          <span>ลบครู</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* TAB 3: ตั้งค่า Google Sheet & Apps Script */}
      {/* ---------------------------------------------------------------- */}
      {adminTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Settings Form */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleSaveConfig}
              className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-7 shadow-xl border border-white/60 space-y-5"
            >
              <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
                <Database className="text-indigo-600" size={20} />
                <h2 className="text-base font-bold text-gray-900">ข้อมูลการเชื่อมต่อ</h2>
              </div>

              {/* SHEET_ID */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Google Sheet ID (SHEET_ID)</span>
                  {sheetId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[11px]"
                    >
                      เปิดชีต <ExternalLink size={11} />
                    </a>
                  )}
                </label>
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="เช่น 15IU9xIXFHbzmMcnOMWPZwSWlWlryRxpPimYCCCNUijc"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  ดูได้จาก URL ของชีต ระหว่าง /d/ และ /edit
                </p>
              </div>

              {/* Script Web App URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Web App URL (URL : XXX)
                </label>
                <input
                  type="url"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  ได้หลังจากกด Deploy &gt; Web app (Who has access: Anyone)
                </p>
              </div>

              {/* Last Synced */}
              {sheetConfig.lastSyncedAt && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                  <span>ซิงค์ข้อมูลล่าสุด:</span>
                  <span className="font-bold">{sheetConfig.lastSyncedAt}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Server size={15} />
                  บันทึกการตั้งค่า
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingPing}
                    className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RefreshCw size={13} className={testingPing ? 'animate-spin' : ''} />
                    ทดสอบเชื่อมต่อ
                  </button>

                  <button
                    type="button"
                    onClick={onTriggerSync}
                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Database size={13} />
                    ซิงค์ดึงข้อมูลสด
                  </button>
                </div>
              </div>
            </form>

            {/* Quick Guide */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/60 space-y-3">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle size={15} className="text-indigo-600" />
                ขั้นตอนการติดตั้ง Google Sheet & Apps Script
              </h3>
              <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside leading-relaxed">
                <li>เปิด Google Sheet ที่ต้องการเก็บข้อมูล</li>
                <li>ไปที่เมนู <strong>ส่วนขยาย (Extensions)</strong> &gt; <strong>Apps Script</strong></li>
                <li>คัดลอกโค้ด GS จากกล่องด้านขวา แล้ววางแทนที่โค้ดเดิมทั้งหมด</li>
                <li>กดปุ่ม <strong>Deploy (การทำให้ใช้งานได้)</strong> &gt; <strong>New deployment</strong></li>
                <li>เลือกประเภท <strong>Web app</strong></li>
                <li>ตั้งค่า Who has access เป็น <strong>Anyone (ทุกคน)</strong></li>
                <li>คัดลอก Web App URL มาใส่ในช่องด้านบนแล้วกดบันทึก</li>
              </ol>
            </div>
          </div>

          {/* Right: Google Apps Script Code Viewer */}
          <div className="lg:col-span-7">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/60 space-y-4 flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="text-indigo-600" size={20} />
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      โค้ด Google Apps Script (GS)
                    </h3>
                    <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <Sparkles size={12} /> สร้างหน้า Sheet อัตโนมัติ (Submissions, Teachers, Assignments)
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCopyCode}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด GS'}</span>
                </button>
              </div>

              <div className="flex-1 min-h-[480px] bg-gray-900 rounded-2xl p-4 overflow-auto border border-gray-800 text-gray-100 font-mono text-xs leading-relaxed">
                <pre>{GOOGLE_APPS_SCRIPT_CODE}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
