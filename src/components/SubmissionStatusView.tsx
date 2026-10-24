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
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl border border-white/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              ระบบค้นหาแบบ Real-time ค้นหาได้ทันทีขณะพิมพ์
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              ตรวจสอบสถานะการส่งงานและคะแนน
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              โรงเรียนท่าบ่อ • ตรวจสอบคะแนนและสถานะผลงานของตนเองได้แบบเรียลไทม์
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-indigo-600' : 'text-gray-500'} />
              <span>ดึงข้อมูลล่าสุด</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-emerald-200 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>ส่งออก Excel</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-red-200 transition-all cursor-pointer"
            >
              <FileDown size={16} />
              <span>ส่งออก PDF</span>
            </button>
          </div>
        </div>

        {/* Informational Subtitle */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>แสดงเฉพาะข้อมูลผลงานและคะแนนของนักเรียนที่พิมพ์ค้นหาเท่านั้น</span>
          </div>
          {hasSearched && (
            <button
              onClick={handleClearSearch}
              className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
            >
              ล้างการค้นหา
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/60 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {/* Real-time Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="พิมพ์ชื่อ หรือ นามสกุล นักเรียน เพื่อค้นหาผลงานทันที (เช่น สมชาย หรือ ท่าบ่อ)..."
              className="w-full pl-11 pr-20 py-3.5 bg-gray-50/90 border border-gray-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs px-2.5 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 font-medium cursor-pointer transition-colors"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* ชั้น */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">ทุกระดับชั้น</option>
              {GRADE_LEVELS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* ห้อง */}
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="px-3 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">ทุกห้อง (1-14)</option>
              {ROOMS.map(r => (
                <option key={r} value={r}>ห้อง {r}</option>
              ))}
            </select>

            {/* สถานะ */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">สถานะทั้งหมด</option>
              <option value="รอตรวจ">⏳ รอตรวจ</option>
              <option value="ตรวจแล้ว">✅ ตรวจแล้ว</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 flex items-center gap-1.5 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>ค้นหาแบบ Real-time: พิมพ์ชื่อจริง หรือนามสกุล หรือเลขที่ เพื่อดูผลงานและคะแนนของนักเรียน</span>
        </div>
      </div>

      {/* Main Content: Prompt when not searched, or Student Results when searched */}
      {!hasSearched ? (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-10 md:p-14 shadow-xl border border-white/60 text-center space-y-5">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
            <Search size={36} />
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              พิมพ์ชื่อนักเรียนเพื่อเริ่มการตรวจสอบ
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              ระบบได้รับการตั้งค่าให้ <span className="font-semibold text-indigo-600">แสดงเฉพาะข้อมูลของนักเรียนที่พิมพ์ค้นหาเท่านั้น</span> เพื่อความเป็นส่วนตัวและความรวดเร็วในการดูคะแนน
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-700 font-medium">
            💡 กรุณาพิมพ์ชื่อหรือนามสกุลในช่องค้นหาด้านบนเพื่อดูรายการผลงานของคุณ
          </div>
        </div>
      ) : (
        <>
          {/* 4 Stat Cards for the searched student */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/95 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/60 shadow-lg">
              <div className="flex items-center justify-between text-indigo-600 mb-1">
                <span className="text-xs font-semibold uppercase">งานที่ส่งของนักเรียน</span>
                <Layers size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-indigo-900">{studentTotalCount}</div>
              <div className="text-[11px] text-indigo-700 mt-0.5">ชิ้นงานที่ค้นพบ</div>
            </div>

            <div className="bg-white/95 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/60 shadow-lg">
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-xs font-semibold uppercase">ตรวจแล้ว</span>
                <CheckCircle size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-emerald-900">{studentGradedCount}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                {studentTotalCount > 0 ? Math.round((studentGradedCount / studentTotalCount) * 100) : 0}% ของงานที่ส่ง
              </div>
            </div>

            <div className="bg-white/95 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/60 shadow-lg">
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <span className="text-xs font-semibold uppercase">รอตรวจ</span>
                <Clock size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-amber-900">{studentWaitingCount}</div>
              <div className="text-[11px] text-amber-700 mt-0.5">รอคุณครูให้คะแนน</div>
            </div>

            <div className="bg-white/95 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/60 shadow-lg">
              <div className="flex items-center justify-between text-purple-600 mb-1">
                <span className="text-xs font-semibold uppercase">คะแนนรวมสะสม</span>
                <Award size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-purple-900 flex items-baseline gap-1">
                <span>{studentTotalEarned}</span>
                <span className="text-xs text-gray-400 font-normal">/ {studentTotalMax}</span>
              </div>
              <div className="text-[11px] text-purple-700 mt-0.5">
                {studentTotalMax > 0 ? `${Math.round((studentTotalEarned / studentTotalMax) * 100)}% ของคะแนนเต็ม` : 'คะแนนที่ได้'}
              </div>
            </div>
          </div>

          {/* Submissions Table / Cards */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-white/60 overflow-hidden">
            {/* Table Header Filter Indicator */}
            {filteredSubmissions.length > 0 && (
              <div className="p-4 sm:p-5 bg-indigo-50/60 border-b border-indigo-100/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">ผลการค้นหาสำหรับนักเรียน:</span>
                  <span className="px-3 py-1 bg-white border border-indigo-200 rounded-full text-xs font-bold text-indigo-700 shadow-xs">
                    {searchTerm}
                  </span>
                  <span className="text-xs text-gray-400">({studentTotalCount} ชิ้นงาน)</span>
                </div>
                <button
                  onClick={handleClearSearch}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                >
                  ค้นหานักเรียนคนอื่น
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
                <tr className="bg-gray-50/90 border-b border-gray-200/80 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-4 px-4 text-center w-14">เลขที่</th>
                  <th className="py-4 px-4">ผู้ส่งงาน</th>
                  <th className="py-4 px-3 text-center">ชั้น/ห้อง</th>
                  <th className="py-4 px-4">วิชาและชื่องาน</th>
                  <th className="py-4 px-4 text-center">คะแนนที่ได้</th>
                  <th className="py-4 px-4 text-center">สถานะ</th>
                  <th className="py-4 px-4 text-center">ผลงาน</th>
                  <th className="py-4 px-4 text-center">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredSubmissions.map((item) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    {/* เลขที่ */}
                    <td className="py-4 px-4 text-center font-bold text-gray-700">
                      <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-xs">
                        {item.studentNumber}
                      </span>
                    </td>

                    {/* ผู้ส่งงาน */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {item.studentName}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} /> {item.submittedAt}
                      </div>
                    </td>

                    {/* ชั้น/ห้อง */}
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {item.gradeLevel}/{item.room}
                      </span>
                    </td>

                    {/* วิชาและชื่องาน */}
                    <td className="py-4 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                          <BookOpen size={12} />
                          {item.subjectCode} {item.subjectName}
                        </span>
                        {item.academicYear && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
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
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                            คะแนน
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center">
                          <div className="text-xl md:text-2xl font-black text-amber-500 tracking-tight flex items-baseline gap-1">
                            <span>-</span>
                            <span className="text-xs text-gray-400 font-normal">/ {item.maxScore}</span>
                          </div>
                          <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                            รอการตรวจ
                          </span>
                        </div>
                      )}
                    </td>

                    {/* สถานะการส่งงาน: "รอตรวจ" หรือ "ตรวจแล้ว" */}
                    <td className="py-4 px-4 text-center">
                      {item.status === 'ตรวจแล้ว' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                          <CheckCircle size={14} className="text-emerald-600" />
                          ตรวจแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm animate-pulse">
                          <Clock size={14} className="text-amber-600" />
                          รอตรวจ
                        </span>
                      )}
                    </td>

                    {/* ลิงก์ผลงาน */}
                    <td className="py-4 px-4 text-center">
                      <a
                        href={item.workUrl.startsWith('http') ? item.workUrl : `https://${item.workUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-700 transition-all shadow-sm cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        เปิดดูงาน
                      </a>
                    </td>

                    {/* ปุ่มดูรายละเอียด */}
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => setViewingDetail(item)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors cursor-pointer"
                      >
                        ดูข้อมูล
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 space-y-6 relative">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  รายละเอียดการส่งงาน
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-1">
                  {viewingDetail.studentName}
                </h3>
                <p className="text-xs text-gray-500">
                  เลขที่ {viewingDetail.studentNumber} • ชั้น {viewingDetail.gradeLevel}/{viewingDetail.room}
                </p>
              </div>
              <button
                onClick={() => setViewingDetail(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Highlight Box */}
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
              <div>
                <div className="text-xs text-indigo-700 font-semibold">คะแนนที่ได้ / คะแนนเต็ม</div>
                <div className="text-3xl font-black text-indigo-950 mt-1">
                  {viewingDetail.score !== null ? viewingDetail.score : '-'} 
                  <span className="text-base text-gray-400 font-normal"> / {viewingDetail.maxScore} คะแนน</span>
                </div>
              </div>
              <div>
                {viewingDetail.status === 'ตรวจแล้ว' ? (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle size={14} /> ตรวจแล้ว
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Clock size={14} /> รอตรวจ
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
