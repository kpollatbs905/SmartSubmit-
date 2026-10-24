/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ExternalLink, 
  Filter, 
  RefreshCw, 
  FileSpreadsheet, 
  FileDown, 
  CheckCircle, 
  Clock, 
  Award, 
  MessageSquare,
  BookOpen,
  Calendar,
  Layers
} from 'lucide-react';
import { Submission, GradeLevel, GoogleSheetConfig } from '../types';
import { GRADE_LEVELS, ROOMS } from '../constants';
import { storageService } from '../services/storageService';
import { alertService } from '../services/alertService';

interface Props {
  submissions: Submission[];
  sheetConfig: GoogleSheetConfig;
  onRefreshData: () => Promise<void>;
  initialSearchTerm?: string;
  onClearInitialSearch?: () => void;
}

export default function SubmissionStatusView({
  submissions,
  sheetConfig,
  onRefreshData,
  initialSearchTerm = '',
  onClearInitialSearch,
}: Props) {
  // Search state (Real-time as user types) - Only display submissions matching searched student name
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync initialSearchTerm if changed from outside
  React.useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // Selected submission for detail modal
  const [viewingDetail, setViewingDetail] = useState<Submission | null>(null);

  const hasSearched = searchTerm.trim().length > 0;

  // Real-time filtering: ONLY show submissions when student name is searched
  const filteredSubmissions = useMemo(() => {
    if (!hasSearched) {
      return [];
    }

    const q = searchTerm.trim().toLowerCase();

    return submissions.filter((item) => {
      // Must match student name (or exact student number if entered)
      const matchStudent = 
        item.studentName.toLowerCase().includes(q) ||
        item.studentNumber.toLowerCase() === q;

      const matchGrade = selectedGrade === 'ALL' || item.gradeLevel === selectedGrade;
      const matchRoom = selectedRoom === 'ALL' || item.room === selectedRoom;
      const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

      return matchStudent && matchGrade && matchRoom && matchStatus;
    });
  }, [submissions, searchTerm, hasSearched, selectedGrade, selectedRoom, selectedStatus]);

  // Statistics for the searched student
  const studentTotalCount = filteredSubmissions.length;
  const studentGradedCount = filteredSubmissions.filter(s => s.status === 'ตรวจแล้ว').length;
  const studentWaitingCount = filteredSubmissions.filter(s => s.status === 'รอตรวจ').length;
  const studentTotalEarned = filteredSubmissions.reduce((sum, item) => sum + (item.score || 0), 0);
  const studentTotalMax = filteredSubmissions.reduce((sum, item) => sum + (item.maxScore || 0), 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    alertService.loading('กำลังโหลดข้อมูลล่าสุด...', 'ระบบกำลังดึงข้อมูลล่าสุดจาก Google Sheet');
    await onRefreshData();
    setIsRefreshing(false);
    alertService.close();
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    if (onClearInitialSearch) {
      onClearInitialSearch();
    }
  };

  const handleExportExcel = () => {
    if (!hasSearched) {
      alertService.info('กรุณาระบุชื่อนักเรียนก่อน', 'โปรดพิมพ์ชื่อนักเรียนในช่องค้นหาก่อนทำการส่งออกข้อมูล');
      return;
    }
    if (filteredSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับส่งออก', 'ไม่พบรายการส่งงานของนักเรียนที่ค้นหา');
      return;
    }
    storageService.exportToExcel(filteredSubmissions, `ตารางส่งงานและคะแนน_${searchTerm.trim()}`);
    alertService.success('ดาวน์โหลดไฟล์ Excel สำเร็จ', 'ไฟล์ .xlsx ได้รับการบันทึกลงในเครื่องของคุณแล้ว');
  };

  const handleExportPdf = () => {
    if (!hasSearched) {
      alertService.info('กรุณาระบุชื่อนักเรียนก่อน', 'โปรดพิมพ์ชื่อนักเรียนในช่องค้นหาก่อนทำการส่งออกข้อมูล');
      return;
    }
    if (filteredSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับส่งออก', 'ไม่พบรายการส่งงานของนักเรียนที่ค้นหา');
      return;
    }
    storageService.exportToPdf(filteredSubmissions, `ตารางส่งงานและคะแนน_${searchTerm.trim()}`, `รายงานผลการส่งงาน: ${searchTerm.trim()}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-white/95 via-purple-50/60 to-pink-50/60 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/40 border border-purple-100/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-full text-xs font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>⚡ ระบบค้นหาแบบ Real-time ค้นหาได้ทันทีขณะพิมพ์ 🎯</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>📊 ตรวจสอบสถานะการส่งงานและคะแนน</span>
              <span>✨</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <span>🏫 โรงเรียนท่าบ่อ</span>
              <span>•</span>
              <span>ตรวจสอบคะแนนและสถานะผลงานของตนเองได้แบบเรียลไทม์ 🌸</span>
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-purple-200/80 hover:bg-purple-50 text-violet-800 text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-violet-600' : 'text-violet-500'} />
              <span>🔄 ดึงข้อมูลล่าสุด</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-emerald-200 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>📊 ส่งออก Excel</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-pink-200 transition-all cursor-pointer"
            >
              <FileDown size={16} />
              <span>📄 ส่งออก PDF</span>
            </button>
          </div>
        </div>

        {/* Informational Subtitle */}
        <div className="mt-4 pt-4 border-t border-purple-100/70 flex items-center justify-between flex-wrap gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <span className="font-medium">แสดงเฉพาะข้อมูลผลงานและคะแนนของนักเรียนที่พิมพ์ค้นหาเท่านั้น เพื่อความเป็นส่วนตัว</span>
          </div>
          {hasSearched && (
            <button
              onClick={handleClearSearch}
              className="text-violet-700 hover:text-violet-900 font-semibold cursor-pointer underline flex items-center gap-1"
            >
              <span>ล้างการค้นหา</span>
              <span>✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {/* Real-time Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 พิมพ์ชื่อ หรือ นามสกุล นักเรียน เพื่อค้นหาผลงานทันที (เช่น สมชาย หรือ ท่าบ่อ)..."
              className="w-full pl-11 pr-20 py-3.5 bg-purple-50/20 border border-purple-200/80 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs px-2.5 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 font-medium cursor-pointer transition-colors"
              >
                ล้าง ✕
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* ชั้น */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3.5 py-2.5 bg-purple-50/20 border border-purple-200/70 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
            >
              <option value="ALL">🏫 ทุกระดับชั้น</option>
              {GRADE_LEVELS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* ห้อง */}
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="px-3.5 py-2.5 bg-purple-50/20 border border-purple-200/70 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
            >
              <option value="ALL">🚪 ทุกห้อง (1-14)</option>
              {ROOMS.map(r => (
                <option key={r} value={r}>ห้อง {r}</option>
              ))}
            </select>

            {/* สถานะ */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3.5 py-2.5 bg-purple-50/20 border border-purple-200/70 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
            >
              <option value="ALL">🏷️ สถานะทั้งหมด</option>
              <option value="รอตรวจ">⏳ รอตรวจ</option>
              <option value="ตรวจแล้ว">✅ ตรวจแล้ว</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span>⚡ ค้นหาแบบ Real-time: พิมพ์ชื่อจริง นามสกุล หรือเลขที่ เพื่อดูผลงานและคะแนนของนักเรียนทันที</span>
        </div>
      </div>

      {/* Main Content: Prompt when not searched, or Student Results when searched */}
      {!hasSearched ? (
        <div className="bg-gradient-to-b from-white/95 via-purple-50/30 to-pink-50/30 backdrop-blur-md rounded-3xl p-10 md:p-14 shadow-xl shadow-purple-100/30 border border-purple-100/80 text-center space-y-5">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-pink-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-200 text-3xl">
            🔍
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <span>พิมพ์ชื่อนักเรียนเพื่อเริ่มการตรวจสอบ</span>
              <span>✨</span>
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              ระบบได้รับการตั้งค่าให้ <span className="font-semibold text-violet-700">แสดงเฉพาะข้อมูลของนักเรียนที่พิมพ์ค้นหาเท่านั้น</span> เพื่อความเป็นส่วนตัวและความรวดเร็วในการดูคะแนน
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-100/80 via-purple-100/80 to-pink-100/80 border border-purple-200/80 rounded-2xl text-xs text-violet-900 font-medium shadow-xs">
            <span>💡</span>
            <span>กรุณาพิมพ์ชื่อหรือนามสกุลในช่องค้นหาด้านบน เพื่อดูรายการผลงานของคุณ</span>
          </div>
        </div>
      ) : (
        <>
          {/* 4 Stat Cards for the searched student */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Pastel Lavender */}
            <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-indigo-200/70 shadow-md shadow-indigo-100/40">
              <div className="flex items-center justify-between text-indigo-700 mb-1">
                <span className="text-xs font-semibold uppercase flex items-center gap-1">
                  <span>📑</span> งานที่ส่งของนักเรียน
                </span>
                <Layers size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-indigo-950">{studentTotalCount}</div>
              <div className="text-[11px] text-indigo-700 mt-0.5">ชิ้นงานที่ค้นพบ ✨</div>
            </div>

            {/* Card 2: Pastel Mint */}
            <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/90 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-emerald-200/70 shadow-md shadow-emerald-100/40">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-semibold uppercase flex items-center gap-1">
                  <span>✅</span> ตรวจแล้ว
                </span>
                <CheckCircle size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-emerald-950">{studentGradedCount}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                {studentTotalCount > 0 ? Math.round((studentGradedCount / studentTotalCount) * 100) : 0}% ของงานที่ส่ง
              </div>
            </div>

            {/* Card 3: Pastel Peach */}
            <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/90 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-amber-200/70 shadow-md shadow-amber-100/40">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-semibold uppercase flex items-center gap-1">
                  <span>⏳</span> รอตรวจ
                </span>
                <Clock size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-amber-950">{studentWaitingCount}</div>
              <div className="text-[11px] text-amber-700 mt-0.5">รอคุณครูให้คะแนน 📝</div>
            </div>

            {/* Card 4: Pastel Rose */}
            <div className="bg-gradient-to-br from-pink-50/90 to-rose-50/90 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-pink-200/70 shadow-md shadow-pink-100/40">
              <div className="flex items-center justify-between text-pink-700 mb-1">
                <span className="text-xs font-semibold uppercase flex items-center gap-1">
                  <span>🏆</span> คะแนนรวมสะสม
                </span>
                <Award size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-pink-950 flex items-baseline gap-1">
                <span>{studentTotalEarned}</span>
                <span className="text-xs text-gray-500 font-normal">/ {studentTotalMax}</span>
              </div>
              <div className="text-[11px] text-pink-700 mt-0.5">
                {studentTotalMax > 0 ? `${Math.round((studentTotalEarned / studentTotalMax) * 100)}% ของคะแนนเต็ม 🌟` : 'คะแนนที่ได้'}
              </div>
            </div>
          </div>

          {/* Submissions Table / Cards */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl shadow-purple-100/30 border border-purple-100/70 overflow-hidden">
            {/* Table Header Filter Indicator */}
            {filteredSubmissions.length > 0 && (
              <div className="p-4 sm:p-5 bg-gradient-to-r from-violet-50/70 via-purple-50/60 to-pink-50/70 border-b border-purple-100/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-600">ผลการค้นหาสำหรับนักเรียน:</span>
                  <span className="px-3 py-1 bg-white border border-purple-200 rounded-full text-xs font-bold text-violet-700 shadow-xs">
                    🧑‍🎓 {searchTerm}
                  </span>
                  <span className="text-xs text-purple-600 font-medium">({studentTotalCount} ชิ้นงาน)</span>
                </div>
                <button
                  onClick={handleClearSearch}
                  className="text-xs text-violet-700 hover:text-violet-900 font-semibold cursor-pointer underline flex items-center gap-1"
                >
                  <span>ค้นหานักเรียนคนอื่น</span>
                  <span>🔄</span>
                </button>
              </div>
            )}

            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
                  <Search size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                  ไม่พบข้อมูลการส่งงานของนักเรียน "{searchTerm}"
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  ไม่พบรายการที่ตรงกับคำค้นหา กรุณาตรวจสอบการสะกดชื่อ-นามสกุล หรือลองค้นหาด้วยชื่อจริงโดยไม่ต้องใส่นาย/นางสาว หรือเลขที่
                </p>
                <button
                  onClick={handleClearSearch}
                  className="mt-4 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  ล้างคำค้นหา
                </button>
              </div>
            ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50/80 via-indigo-50/70 to-pink-50/80 border-b border-purple-100 text-[11px] font-bold text-violet-900 uppercase tracking-wider">
                  <th className="py-4 px-4 text-center w-14">🔢 เลขที่</th>
                  <th className="py-4 px-4">🧑‍🎓 ผู้ส่งงาน</th>
                  <th className="py-4 px-3 text-center">🏫 ชั้น/ห้อง</th>
                  <th className="py-4 px-4">📚 วิชาและชื่องาน</th>
                  <th className="py-4 px-4 text-center">💯 คะแนนที่ได้</th>
                  <th className="py-4 px-4 text-center">🏷️ สถานะ</th>
                  <th className="py-4 px-4 text-center">📎 ผลงาน</th>
                  <th className="py-4 px-4 text-center">🔍 ข้อมูล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100/50 text-sm">
                {filteredSubmissions.map((item) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-purple-50/40 transition-colors group"
                  >
                    {/* เลขที่ */}
                    <td className="py-4 px-4 text-center font-bold text-gray-700">
                      <span className="w-8 h-8 rounded-xl bg-purple-100/80 text-violet-800 flex items-center justify-center mx-auto text-xs font-black shadow-xs">
                        {item.studentNumber}
                      </span>
                    </td>

                    {/* ผู้ส่งงาน */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                        {item.studentName}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} className="text-violet-400" /> {item.submittedAt}
                      </div>
                    </td>

                    {/* ชั้น/ห้อง */}
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-100/70 text-violet-800 border border-purple-200/60 shadow-xs">
                        {item.gradeLevel}/{item.room}
                      </span>
                    </td>

                    {/* วิชาและชื่องาน */}
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-violet-700 flex items-center gap-1">
                          <BookOpen size={12} />
                          {item.subjectCode} {item.subjectName}
                        </span>
                        {item.academicYear && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 border border-purple-100 text-purple-700 font-medium">
                            ปี {item.academicYear}/{item.semester || '1'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-800 font-medium truncate mt-0.5" title={item.assignmentName}>
                        {item.assignmentName}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        ครูผู้สอน: {item.teacherName}
                      </div>
                    </td>

                    {/* คะแนนงานที่ได้: คะแนนที่ได้ / คะแนนเต็ม ตัวใหญ่ชัดเจน */}
                    <td className="py-4 px-4 text-center">
                      {item.score !== null ? (
                        <div className="inline-flex flex-col items-center">
                          <div className="text-xl md:text-2xl font-black text-emerald-600 tracking-tight flex items-baseline gap-1">
                            <span>{item.score}</span>
                            <span className="text-xs text-gray-400 font-normal">/ {item.maxScore}</span>
                          </div>
                          <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/60 shadow-xs">
                            🌟 คะแนนที่ได้
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center">
                          <div className="text-xl md:text-2xl font-black text-amber-500 tracking-tight flex items-baseline gap-1">
                            <span>-</span>
                            <span className="text-xs text-gray-400 font-normal">/ {item.maxScore}</span>
                          </div>
                          <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200/60 shadow-xs">
                            ⏳ รอการตรวจ
                          </span>
                        </div>
                      )}
                    </td>

                    {/* สถานะการส่งงาน: "รอตรวจ" หรือ "ตรวจแล้ว" */}
                    <td className="py-4 px-4 text-center">
                      {item.status === 'ตรวจแล้ว' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                          <CheckCircle size={14} className="text-emerald-600" />
                          <span>ตรวจแล้ว</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-xs animate-pulse">
                          <Clock size={14} className="text-amber-600" />
                          <span>รอตรวจ</span>
                        </span>
                      )}
                    </td>

                    {/* ลิงก์ผลงาน */}
                    <td className="py-4 px-4 text-center">
                      <a
                        href={item.workUrl.startsWith('http') ? item.workUrl : `https://${item.workUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 hover:from-violet-600 hover:to-indigo-600 hover:text-white text-violet-800 transition-all shadow-xs cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>เปิดดูงาน</span>
                      </a>
                    </td>

                    {/* ปุ่มดูรายละเอียด */}
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => setViewingDetail(item)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium text-violet-700 hover:bg-violet-100/70 border border-purple-200 transition-colors cursor-pointer"
                      >
                        👁️ ดูข้อมูล
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
    )}

      {/* Detail Modal */}
      {viewingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-purple-100 space-y-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-violet-700 uppercase tracking-widest flex items-center gap-1">
                  <span>✨</span> รายละเอียดการส่งงาน
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                  <span>{viewingDetail.studentName}</span>
                  <span className="text-base">🧑‍🎓</span>
                </h3>
                <p className="text-xs text-gray-500">
                  เลขที่ {viewingDetail.studentNumber} • ชั้น {viewingDetail.gradeLevel}/{viewingDetail.room}
                </p>
              </div>
              <button
                onClick={() => setViewingDetail(null)}
                className="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Score Highlight Box */}
            <div className="p-5 bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 rounded-2xl border border-purple-200/80 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-xs text-violet-800 font-semibold">คะแนนที่ได้ / คะแนนเต็ม</div>
                <div className="text-3xl font-black text-violet-950 mt-1">
                  {viewingDetail.score !== null ? viewingDetail.score : '-'} 
                  <span className="text-base text-gray-400 font-normal"> / {viewingDetail.maxScore} คะแนน</span>
                </div>
              </div>
              <div>
                {viewingDetail.status === 'ตรวจแล้ว' ? (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-xs">
                    <CheckCircle size={14} className="text-emerald-600" /> ตรวจแล้ว
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 shadow-xs">
                    <Clock size={14} className="text-amber-600" /> รอตรวจ
                  </span>
                )}
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-400">วิชา:</span>
                <span className="font-semibold text-gray-800">{viewingDetail.subjectCode} {viewingDetail.subjectName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-400">ชื่องาน:</span>
                <span className="font-semibold text-gray-800 text-right">{viewingDetail.assignmentName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-400">ครูผู้สอน:</span>
                <span className="font-semibold text-gray-800">{viewingDetail.teacherName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-400">ปีการศึกษา / ภาคเรียน:</span>
                <span className="font-semibold text-gray-800">
                  {viewingDetail.academicYear ? `ปีการศึกษา ${viewingDetail.academicYear} (ภาคเรียนที่ ${viewingDetail.semester || '1'})` : 'ปีการศึกษา 2567 (ภาคเรียนที่ 1)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-400">วันที่ส่งงาน:</span>
                <span className="font-semibold text-gray-800">{viewingDetail.submittedAt}</span>
              </div>

              {/* Feedback */}
              <div className="pt-2">
                <span className="text-gray-500 font-bold flex items-center gap-1 mb-1">
                  <MessageSquare size={13} className="text-indigo-500" /> คำแนะนำ/ข้อเสนอแนะจากคุณครู:
                </span>
                <div className="p-3 bg-gray-50 rounded-xl text-gray-700 leading-relaxed border border-gray-100">
                  {viewingDetail.feedback || 'ยังไม่มีคำแนะนำเพิ่มเติมจากคุณครู'}
                </div>
              </div>
            </div>

            {/* Link button */}
            <div className="pt-2 flex gap-3">
              <a
                href={viewingDetail.workUrl.startsWith('http') ? viewingDetail.workUrl : `https://${viewingDetail.workUrl}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <ExternalLink size={14} /> เปิดดูไฟล์งานที่ส่ง
              </a>
              <button
                onClick={() => setViewingDetail(null)}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
