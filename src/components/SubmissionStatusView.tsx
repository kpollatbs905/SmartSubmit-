/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  FileSpreadsheet, 
  FileDown, 
  CheckCircle, 
  Clock, 
  Award, 
  MessageSquare,
  BookOpen,
  Calendar,
  Layers,
  Plus,
  Send,
  AlertCircle
} from 'lucide-react';
import { Submission, GradeLevel, GoogleSheetConfig, Assignment, Teacher } from '../types';
import { GRADE_LEVELS, ROOMS } from '../constants';
import { storageService, normalizeRoom, normalizeGradeLevel, stripThaiPrefix } from '../services/storageService';
import { alertService } from '../services/alertService';

interface Props {
  submissions: Submission[];
  assignments?: Assignment[];
  teachers?: Teacher[];
  sheetConfig: GoogleSheetConfig;
  onRefreshData: () => Promise<void>;
  onDataChange?: () => void;
  initialSearchTerm?: string;
  onClearInitialSearch?: () => void;
  onNavigateToSubmit?: (prefill: {
    teacherName?: string;
    subjectCode?: string;
    assignmentId?: string;
    studentName?: string;
    studentNumber?: string;
    gradeLevel?: GradeLevel;
    room?: string;
  }) => void;
}

// Helper to deduce grade level from subject code (e.g. ว21103 -> ม.1, ว22103 -> ม.2, etc.)
export const getGradeFromSubjectCode = (code: string): GradeLevel | null => {
  if (!code) return null;
  const numStr = code.replace(/^[^\d]+/, '');
  if (numStr.startsWith('21') || numStr.startsWith('11') || numStr.startsWith('1')) return 'ม.1';
  if (numStr.startsWith('22') || numStr.startsWith('12') || numStr.startsWith('2')) return 'ม.2';
  if (numStr.startsWith('23') || numStr.startsWith('13') || numStr.startsWith('3')) return 'ม.3';
  if (numStr.startsWith('31') || numStr.startsWith('14') || numStr.startsWith('4')) return 'ม.4';
  if (numStr.startsWith('32') || numStr.startsWith('15') || numStr.startsWith('5')) return 'ม.5';
  if (numStr.startsWith('33') || numStr.startsWith('16') || numStr.startsWith('6')) return 'ม.6';
  return null;
};

export default function SubmissionStatusView({
  submissions,
  assignments = [],
  teachers = [],
  sheetConfig,
  onRefreshData,
  onDataChange,
  initialSearchTerm = '',
  onClearInitialSearch,
  onNavigateToSubmit,
}: Props) {
  // Search state (Real-time as user types)
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sub-tab: 'submitted' (งานที่ส่งแล้ว), 'pending' (งานค้างส่ง), 'subjects' (สรุปรายวิชา)
  const [activeSubTab, setActiveSubTab] = useState<'submitted' | 'pending' | 'subjects'>('submitted');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('ALL');
  const [showOnlyPendingInSubjects, setShowOnlyPendingInSubjects] = useState<boolean>(false);

  // Modal states
  const [viewingDetail, setViewingDetail] = useState<Submission | null>(null);

  // Sync initialSearchTerm if changed from outside
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const hasSearched = searchTerm.trim().length > 0;
  const hasActiveFilter =
    selectedGrade !== 'ALL' ||
    selectedRoom !== 'ALL' ||
    selectedSubject !== 'ALL' ||
    selectedAssignment !== 'ALL' ||
    selectedStatus !== 'ALL';
  const shouldShowResults = hasSearched || hasActiveFilter;

  // Helper: ตรวจสอบว่างานตรงกับวิชาที่เลือกกรองหรือไม่
  const matchesSubjectFilter = React.useCallback((filterVal: string, code?: string, name?: string) => {
    if (!filterVal || filterVal === 'ALL') return true;
    const normFilter = filterVal.trim().toLowerCase();
    const normCode = (code || '').trim().toLowerCase();
    const normName = (name || '').trim().toLowerCase();
    return (Boolean(normCode) && normCode === normFilter) || (Boolean(normName) && normName === normFilter);
  }, []);

  // Helper: ตรวจสอบว่างานตรงกับใบงานที่เลือกกรองหรือไม่
  const matchesAssignmentFilter = React.useCallback((filterVal: string, aId?: string, aTitle?: string) => {
    if (!filterVal || filterVal === 'ALL') return true;
    const normFilter = filterVal.trim().toLowerCase();
    const normId = (aId || '').trim().toLowerCase();
    const normTitle = (aTitle || '').trim().toLowerCase();
    if (normId && normId === normFilter) return true;
    if (normTitle && normTitle === normFilter) return true;
    const matchedAssign = assignments.find(
      a => (a.id && a.id.trim().toLowerCase() === normFilter) || a.title.trim().toLowerCase() === normFilter
    );
    if (matchedAssign) {
      if (normId && matchedAssign.id && normId === matchedAssign.id.trim().toLowerCase()) return true;
      if (normTitle && matchedAssign.title && normTitle === matchedAssign.title.trim().toLowerCase()) return true;
    }
    return false;
  }, [assignments]);

  // Helper: ตรวจสอบว่านักเรียนได้ส่งใบงานนี้แล้วหรือยัง (เทียบทั้ง assignmentId และ ชื่องาน+วิชา)
  const findMatchingSubmission = React.useCallback((assignment: Assignment, subs: Submission[]) => {
    const aTitle = (assignment.title || '').trim().toLowerCase();
    const aCode = (assignment.subjectCode || '').trim().toLowerCase();
    const aSubjName = (assignment.subjectName || '').trim().toLowerCase();
    return subs.find(s => {
      if (assignment.id && s.assignmentId && s.assignmentId === assignment.id) return true;
      const sTitle = (s.assignmentName || '').trim().toLowerCase();
      if (!aTitle || !sTitle || aTitle !== sTitle) return false;
      const sCode = (s.subjectCode || '').trim().toLowerCase();
      const sSubjName = (s.subjectName || '').trim().toLowerCase();
      if (aCode && sCode) return aCode === sCode;
      if (aSubjName && sSubjName) return aSubjName === sSubjName;
      return true;
    });
  }, []);

  // ข้อมูลการส่งงานทั้งหมดตามคำค้นหา + ชั้น + ห้อง (ก่อนกรองวิชา/ใบงาน/สถานะ)
  const studentAllSubmissions = useMemo(() => {
    if (!shouldShowResults) return [];
    const q = searchTerm.trim().toLowerCase();
    const qNoPrefix = stripThaiPrefix(searchTerm).toLowerCase();

    return submissions
      .filter((item) => {
        const itemNameLower = item.studentName.toLowerCase();
        const itemNoPrefix = stripThaiPrefix(item.studentName).toLowerCase();
        const matchStudent = !hasSearched || (
          itemNameLower.includes(q) ||
          (qNoPrefix && itemNoPrefix.includes(qNoPrefix)) ||
          item.studentNumber.trim().toLowerCase() === q
        );

        const matchGrade = selectedGrade === 'ALL' || normalizeGradeLevel(item.gradeLevel) === normalizeGradeLevel(selectedGrade);
        const matchRoom = selectedRoom === 'ALL' || normalizeRoom(item.room) === normalizeRoom(selectedRoom);

        return matchStudent && matchGrade && matchRoom;
      })
      .sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) return (a.gradeLevel || '').localeCompare(b.gradeLevel || '');
        const roomA = parseInt(normalizeRoom(a.room), 10) || 0;
        const roomB = parseInt(normalizeRoom(b.room), 10) || 0;
        if (roomA !== roomB) return roomA - roomB;
        const numA = parseInt(a.studentNumber, 10) || 0;
        const numB = parseInt(b.studentNumber, 10) || 0;
        if (numA !== numB) return numA - numB;
        return (a.studentName || '').localeCompare(b.studentName || '');
      });
  }, [submissions, searchTerm, hasSearched, shouldShowResults, selectedGrade, selectedRoom]);

  // Filtered submissions for display (กรองเพิ่มตามวิชา ใบงาน และสถานะ)
  const filteredSubmissions = useMemo(() => {
    return studentAllSubmissions.filter((item) => {
      const matchSubject = matchesSubjectFilter(selectedSubject, item.subjectCode, item.subjectName);
      const matchAssignment = matchesAssignmentFilter(selectedAssignment, item.assignmentId, item.assignmentName);
      const matchStatus = selectedStatus === 'ALL' || selectedStatus === 'ค้างส่ง' || item.status === selectedStatus;
      return matchSubject && matchAssignment && matchStatus;
    });
  }, [studentAllSubmissions, selectedSubject, selectedAssignment, selectedStatus, matchesSubjectFilter, matchesAssignmentFilter]);

  // Detected student info from submissions or uploaded student roster
  const detectedStudentInfo = useMemo(() => {
    if (studentAllSubmissions.length > 0) {
      const first = studentAllSubmissions[0];
      return {
        studentName: first.studentName,
        studentNumber: first.studentNumber,
        gradeLevel: first.gradeLevel,
        room: first.room,
        hasDetectedGrade: true,
      };
    }

    if (hasSearched) {
      const q = searchTerm.trim().toLowerCase();
      const qNoPrefix = stripThaiPrefix(searchTerm).toLowerCase();
      const roster = storageService.getStudentRoster();
      const matchedRoster = roster.find(r => {
        const rName = r.studentName.toLowerCase();
        const rNoPrefix = stripThaiPrefix(r.studentName).toLowerCase();
        const matchName = rName.includes(q) || (qNoPrefix && rNoPrefix.includes(qNoPrefix)) || r.studentNumber.trim().toLowerCase() === q;
        const matchGrade = selectedGrade === 'ALL' || normalizeGradeLevel(r.gradeLevel) === normalizeGradeLevel(selectedGrade);
        const matchRoom = selectedRoom === 'ALL' || normalizeRoom(r.room) === normalizeRoom(selectedRoom);
        return matchName && matchGrade && matchRoom;
      });

      if (matchedRoster) {
        return {
          studentName: matchedRoster.studentName,
          studentNumber: matchedRoster.studentNumber,
          gradeLevel: matchedRoster.gradeLevel,
          room: matchedRoster.room,
          hasDetectedGrade: true,
        };
      }
    }

    return {
      studentName: searchTerm.trim(),
      studentNumber: '',
      gradeLevel: (selectedGrade !== 'ALL' ? (selectedGrade as GradeLevel) : 'ม.1'),
      room: (selectedRoom !== 'ALL' ? selectedRoom : '1'),
      hasDetectedGrade: selectedGrade !== 'ALL',
    };
  }, [studentAllSubmissions, hasSearched, searchTerm, selectedGrade, selectedRoom]);

  // Relevant assignments according to student grade (or all if grade is not yet known)
  const targetGrade = selectedGrade !== 'ALL'
    ? selectedGrade
    : (hasSearched && detectedStudentInfo.hasDetectedGrade ? detectedStudentInfo.gradeLevel : 'ALL');

  const relevantAssignments = useMemo(() => {
    return assignments.filter(a => {
      if (targetGrade && targetGrade !== 'ALL') {
        const gradeFromCode = getGradeFromSubjectCode(a.subjectCode);
        if (gradeFromCode && gradeFromCode !== targetGrade) {
          return false;
        }
      }
      return true;
    });
  }, [assignments, targetGrade]);

  // รายชื่อใบงานที่มีให้เลือกในตัวกรอง (กรองตามระดับชั้นและวิชาที่เลือก และรวมชื่อใบงานที่มีใน Sheet หากยังไม่มีใน list)
  const availableAssignments = useMemo(() => {
    const map = new Map<string, { value: string; title: string; subjectCode: string; subjectName: string; label: string }>();

    relevantAssignments
      .filter(a => matchesSubjectFilter(selectedSubject, a.subjectCode, a.subjectName))
      .forEach(a => {
        const title = (a.title || '').trim();
        if (!title) return;
        const value = a.id || title;
        const key = `${(a.subjectCode || '').trim().toLowerCase()}__${title.toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            value,
            title,
            subjectCode: a.subjectCode || '',
            subjectName: a.subjectName || '',
            label: a.subjectCode ? `${title} (${a.subjectCode})` : title,
          });
        }
      });

    submissions
      .filter(s => {
        const matchGrade = targetGrade === 'ALL' || normalizeGradeLevel(s.gradeLevel) === normalizeGradeLevel(targetGrade);
        const matchSubj = matchesSubjectFilter(selectedSubject, s.subjectCode, s.subjectName);
        return matchGrade && matchSubj && Boolean((s.assignmentName || '').trim());
      })
      .forEach(s => {
        const title = (s.assignmentName || '').trim();
        const key = `${(s.subjectCode || '').trim().toLowerCase()}__${title.toLowerCase()}`;
        if (!map.has(key)) {
          const value = s.assignmentId || title;
          map.set(key, {
            value,
            title,
            subjectCode: s.subjectCode || '',
            subjectName: s.subjectName || '',
            label: s.subjectCode ? `${title} (${s.subjectCode})` : title,
          });
        }
      });

    return Array.from(map.values());
  }, [relevantAssignments, submissions, targetGrade, selectedSubject, matchesSubjectFilter]);

  useEffect(() => {
    if (selectedAssignment !== 'ALL' && !availableAssignments.some(a => a.value === selectedAssignment)) {
      setSelectedAssignment('ALL');
    }
  }, [availableAssignments, selectedAssignment]);

  const selectedAssignmentInfo = useMemo(() => {
    if (selectedAssignment === 'ALL') return null;
    return availableAssignments.find(a => a.value === selectedAssignment) || null;
  }, [selectedAssignment, availableAssignments]);

  // งานที่ค้างส่งทั้งหมด (ทุกรายวิชา) ของนักเรียนที่ค้นหา
  const allPendingAssignments = useMemo(() => {
    if (!hasSearched) return [];
    return relevantAssignments.filter(a => !findMatchingSubmission(a, studentAllSubmissions));
  }, [relevantAssignments, studentAllSubmissions, hasSearched, findMatchingSubmission]);

  // งานที่ค้างส่ง (กรองตามวิชาและใบงานที่เลือก)
  const pendingAssignments = useMemo(() => {
    if (!hasSearched) return [];
    return allPendingAssignments.filter(
      a => matchesSubjectFilter(selectedSubject, a.subjectCode, a.subjectName) &&
           matchesAssignmentFilter(selectedAssignment, a.id, a.title)
    );
  }, [allPendingAssignments, hasSearched, selectedSubject, selectedAssignment, matchesSubjectFilter, matchesAssignmentFilter]);

  // Group all assignments by Subject for the "เช็คสถานะแยกตามรายวิชา" tab
  const subjectGroups = useMemo(() => {
    const map = new Map<string, {
      filterValue: string;
      code: string;
      name: string;
      teacherName: string;
      totalAssignments: Assignment[];
      submitted: Submission[];
      pending: Assignment[];
      earnedScore: number;
      maxScore: number;
    }>();

    relevantAssignments.forEach(a => {
      const filterValue = (a.subjectCode || a.subjectName || '').trim();
      const key = filterValue.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          filterValue,
          code: a.subjectCode,
          name: a.subjectName,
          teacherName: a.teacherName,
          totalAssignments: [],
          submitted: [],
          pending: [],
          earnedScore: 0,
          maxScore: 0,
        });
      }
      const item = map.get(key)!;
      item.totalAssignments.push(a);
      item.maxScore += a.maxScore || 0;

      const sub = findMatchingSubmission(a, studentAllSubmissions);

      if (sub) {
        item.submitted.push(sub);
        item.earnedScore += (sub.score || 0);
      } else {
        item.pending.push(a);
      }
    });

    return Array.from(map.values());
  }, [relevantAssignments, studentAllSubmissions, findMatchingSubmission]);

  // กลุ่มรายวิชาที่ผ่านตัวกรอง selectedSubject และ selectedAssignment
  const filteredSubjectGroups = useMemo(() => {
    return subjectGroups
      .filter(g => matchesSubjectFilter(selectedSubject, g.code, g.name))
      .map(g => {
        if (selectedAssignment === 'ALL') return g;
        const filteredTotal = g.totalAssignments.filter(a => matchesAssignmentFilter(selectedAssignment, a.id, a.title));
        const filteredSubmitted = g.submitted.filter(s => matchesAssignmentFilter(selectedAssignment, s.assignmentId, s.assignmentName));
        const filteredPending = g.pending.filter(a => matchesAssignmentFilter(selectedAssignment, a.id, a.title));
        return {
          ...g,
          totalAssignments: filteredTotal,
          submitted: filteredSubmitted,
          pending: filteredPending,
          earnedScore: filteredSubmitted.reduce((sum, s) => sum + (s.score || 0), 0),
          maxScore: filteredTotal.reduce((sum, a) => sum + (a.maxScore || 0), 0),
        };
      })
      .filter(g => selectedAssignment === 'ALL' || g.totalAssignments.length > 0 || g.submitted.length > 0);
  }, [subjectGroups, selectedSubject, selectedAssignment, matchesSubjectFilter, matchesAssignmentFilter]);

  // รายชื่อวิชาทั้งหมดที่มีในระบบ (พร้อมนับจำนวนงานที่ค้างส่งในแต่ละวิชาเมื่อค้นหาแล้ว)
  const availableSubjects = useMemo(() => {
    const unique = new Map<string, { value: string; code: string; name: string; label: string; totalCount: number; pendingCount: number }>();

    relevantAssignments.forEach(a => {
      const value = (a.subjectCode || a.subjectName || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, {
          value,
          code: a.subjectCode,
          name: a.subjectName,
          label: a.subjectCode && a.subjectName ? `${a.subjectCode} ${a.subjectName}` : value,
          totalCount: 0,
          pendingCount: 0,
        });
      }
      unique.get(key)!.totalCount += 1;
    });

    if (hasSearched) {
      allPendingAssignments.forEach(a => {
        const value = (a.subjectCode || a.subjectName || '').trim();
        const key = value.toLowerCase();
        if (unique.has(key)) {
          unique.get(key)!.pendingCount += 1;
        }
      });
    }

    return Array.from(unique.values());
  }, [relevantAssignments, allPendingAssignments, hasSearched]);

  const selectedSubjectInfo = useMemo(() => {
    if (selectedSubject === 'ALL') return null;
    return availableSubjects.find(s => s.value.toLowerCase() === selectedSubject.trim().toLowerCase()) || {
      value: selectedSubject,
      code: selectedSubject,
      name: '',
      label: selectedSubject,
      totalCount: 0,
      pendingCount: pendingAssignments.length,
    };
  }, [selectedSubject, availableSubjects, pendingAssignments.length]);

  // Statistics for the searched student (สะท้อนตามวิชาที่เลือกกรอง)
  const studentTotalCount = filteredSubmissions.length;
  const studentGradedCount = filteredSubmissions.filter(s => s.status === 'ตรวจแล้ว').length;
  const studentWaitingCount = filteredSubmissions.filter(s => s.status === 'รอตรวจ').length;
  const studentTotalEarned = filteredSubmissions.reduce((sum, item) => sum + (item.score || 0), 0);
  const studentTotalMax = filteredSubmissions.reduce((sum, item) => sum + (item.maxScore || 0), 0);
  const studentPendingCount = pendingAssignments.length;

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

  const handleResetAllFilters = () => {
    setSearchTerm('');
    setSelectedGrade('ALL');
    setSelectedRoom('ALL');
    setSelectedSubject('ALL');
    setSelectedAssignment('ALL');
    setSelectedStatus('ALL');
    if (onClearInitialSearch) {
      onClearInitialSearch();
    }
  };

  // Quick Action to Submit a new work or pending work
  const handleQuickSubmit = (assignment?: Assignment) => {
    if (!onNavigateToSubmit) return;

    if (assignment) {
      onNavigateToSubmit({
        teacherName: assignment.teacherName,
        subjectCode: assignment.subjectCode,
        assignmentId: assignment.id,
        studentName: hasSearched ? detectedStudentInfo.studentName : '',
        studentNumber: hasSearched ? detectedStudentInfo.studentNumber : '',
        gradeLevel: detectedStudentInfo.gradeLevel,
        room: detectedStudentInfo.room,
      });
    } else {
      onNavigateToSubmit({
        studentName: hasSearched ? detectedStudentInfo.studentName : '',
        studentNumber: hasSearched ? detectedStudentInfo.studentNumber : '',
        gradeLevel: detectedStudentInfo.gradeLevel,
        room: detectedStudentInfo.room,
      });
    }
  };

  const activeFilterSummaryLabel = useMemo(() => {
    const parts: string[] = [];
    if (hasSearched) parts.push(searchTerm.trim());
    if (selectedGrade !== 'ALL') parts.push(selectedGrade);
    if (selectedRoom !== 'ALL') parts.push(`ห้อง${selectedRoom}`);
    if (selectedSubjectInfo) parts.push(selectedSubjectInfo.code || selectedSubjectInfo.label);
    if (selectedAssignmentInfo) parts.push(selectedAssignmentInfo.title);
    return parts.join('_') || 'ทั้งหมด';
  }, [hasSearched, searchTerm, selectedGrade, selectedRoom, selectedSubjectInfo, selectedAssignmentInfo]);

  const handleExportExcel = () => {
    if (!shouldShowResults) {
      alertService.info('กรุณาค้นหาหรือเลือกตัวกรองก่อน', 'โปรดพิมพ์ชื่อนักเรียน หรือเลือกกรอง ชั้น / ห้อง / วิชา / ใบงาน ก่อนส่งออกข้อมูล');
      return;
    }
    if (filteredSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับส่งออก', 'ไม่พบรายการส่งงานตามเงื่อนไขที่เลือก');
      return;
    }
    storageService.exportToExcel(filteredSubmissions, `ตารางส่งงานและคะแนน_${activeFilterSummaryLabel}`);
    alertService.success('ดาวน์โหลดไฟล์ Excel สำเร็จ', 'ไฟล์ .xlsx ได้รับการบันทึกลงในเครื่องของคุณแล้ว');
  };

  const handleExportPdf = () => {
    if (!shouldShowResults) {
      alertService.info('กรุณาค้นหาหรือเลือกตัวกรองก่อน', 'โปรดพิมพ์ชื่อนักเรียน หรือเลือกกรอง ชั้น / ห้อง / วิชา / ใบงาน ก่อนส่งออกข้อมูล');
      return;
    }
    if (filteredSubmissions.length === 0) {
      alertService.info('ไม่มีข้อมูลสำหรับส่งออก', 'ไม่พบรายการส่งงานตามเงื่อนไขที่เลือก');
      return;
    }
    storageService.exportToPdf(filteredSubmissions, `ตารางส่งงานและคะแนน_${activeFilterSummaryLabel}`, `รายงานผลการส่งงาน: ${activeFilterSummaryLabel.replace(/_/g, ' • ')}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-white/95 via-purple-50/60 to-pink-50/60 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-xl shadow-purple-100/40 border border-purple-100/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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
                <span>📊 ตรวจสอบสถานะการส่งงาน & เช็คงานค้างส่ง</span>
                <span>✨</span>
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <span>เช็คคะแนน สถานะการตรวจงาน และตรวจดูว่ามีวิชาไหนค้างส่งงานใดบ้าง 🌸</span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Submit / Add work button */}
            {onNavigateToSubmit && (
              <button
                onClick={() => handleQuickSubmit()}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-violet-200 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>➕ ส่งงานใหม่ / เพิ่มงาน</span>
              </button>
            )}

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-purple-200/80 hover:bg-purple-50 text-violet-800 text-sm font-medium rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-violet-600' : 'text-violet-500'} />
              <span>🔄 ดึงข้อมูลล่าสุด</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <FileDown size={15} />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Informational Subtitle */}
        <div className="mt-4 pt-4 border-t border-purple-100/70 flex items-center justify-between flex-wrap gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-base">🔎</span>
            <span className="font-medium">ค้นหาด้วยชื่อนักเรียน หรือเลือกกรองแสดงผลตาม ชั้น • ห้อง • วิชา • ใบงาน ได้ทันที</span>
          </div>
          {shouldShowResults && (
            <button
              onClick={handleResetAllFilters}
              className="text-violet-700 hover:text-violet-900 font-semibold cursor-pointer underline flex items-center gap-1"
            >
              <span>ล้างการค้นหาและตัวกรองทั้งหมด</span>
              <span>✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl shadow-purple-100/30 border border-purple-100/70 space-y-3">
        <div className="flex flex-col gap-3">
          {/* Real-time Search Box */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 พิมพ์ชื่อ หรือ นามสกุล นักเรียน (หรือเลือกกรอง ชั้น / ห้อง / วิชา / ใบงาน ด้านล่าง)..."
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

          {/* 5 Filters Grid: ชั้น, ห้อง, วิชา, ใบงาน, สถานะ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 w-full">
            {/* ชั้น */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2.5 bg-purple-50/25 border border-purple-200/80 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
              title="กรองตามระดับชั้น"
            >
              <option value="ALL">🏫 ทุกระดับชั้น</option>
              {GRADE_LEVELS.map(g => (
                <option key={g} value={g}>ระดับชั้น {g}</option>
              ))}
            </select>

            {/* ห้อง */}
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full px-3 py-2.5 bg-purple-50/25 border border-purple-200/80 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
              title="กรองตามห้องเรียน"
            >
              <option value="ALL">🚪 ทุกห้อง (1-14)</option>
              {ROOMS.map(r => (
                <option key={r} value={r}>ห้อง {r}</option>
              ))}
            </select>

            {/* วิชา (กรองตามรายวิชา) */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2.5 bg-purple-50/35 border border-purple-200/80 rounded-xl text-xs font-semibold text-violet-950 focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
              title="เลือกกรองตามรายวิชาเพื่อเช็คงานที่ส่งแล้วและงานที่ยังไม่ส่ง"
            >
              <option value="ALL">📚 ทุกรายวิชา ({availableSubjects.length})</option>
              {availableSubjects.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}{hasSearched ? (s.pendingCount > 0 ? ` (ยังไม่ส่ง ${s.pendingCount})` : ' (ส่งครบแล้ว)') : ''}
                </option>
              ))}
            </select>

            {/* ใบงาน (กรองตามใบงาน/ชิ้นงาน) */}
            <select
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value)}
              className="w-full px-3 py-2.5 bg-indigo-50/40 border border-indigo-200/80 rounded-xl text-xs font-semibold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
              title="เลือกกรองตามใบงาน / ชิ้นงาน"
            >
              <option value="ALL">📝 ทุกใบงาน ({availableAssignments.length})</option>
              {availableAssignments.map(a => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>

            {/* สถานะ */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStatus(val);
                if (val === 'ค้างส่ง') {
                  setActiveSubTab('pending');
                } else if (val === 'รอตรวจ' || val === 'ตรวจแล้ว') {
                  setActiveSubTab('submitted');
                }
              }}
              className="w-full col-span-2 sm:col-span-1 px-3 py-2.5 bg-purple-50/25 border border-purple-200/80 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
              title="กรองตามสถานะการส่งงาน"
            >
              <option value="ALL">🏷️ สถานะทั้งหมด</option>
              <option value="ค้างส่ง">⚠️ ค้างส่ง (ยังไม่ส่ง)</option>
              <option value="รอตรวจ">⏳ รอตรวจ</option>
              <option value="ตรวจแล้ว">✅ ตรวจแล้ว</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 flex items-center justify-between flex-wrap gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span>⚡ กรองข้อมูลได้ทันที: เลือกดูตาม ชั้น ห้อง วิชา ใบงาน หรือพิมพ์ชื่อนักเรียนเพื่อดูงานที่ยังไม่ส่งรายบุคคล</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {shouldShowResults && (
              <span className="text-violet-700 font-semibold">
                ระดับชั้นที่แสดง: {targetGrade === 'ALL' ? 'ทุกระดับชั้น' : targetGrade}
              </span>
            )}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject('ALL');
                  setSelectedAssignment('ALL');
                  setSelectedGrade('ALL');
                  setSelectedRoom('ALL');
                  setSelectedStatus('ALL');
                }}
                className="text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
              >
                ล้างตัวกรอง ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Prompt when neither searched nor filtered, or Results when active */}
      {!shouldShowResults ? (
        <div className="bg-gradient-to-b from-white/95 via-purple-50/30 to-pink-50/30 backdrop-blur-md rounded-3xl p-8 md:p-12 shadow-xl shadow-purple-100/30 border border-purple-100/80 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-pink-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-200 text-3xl">
            🔍
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <span>ค้นหาชื่อ หรือเลือกกรอง ชั้น / ห้อง / วิชา / ใบงาน</span>
              <span>✨</span>
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              สามารถ <span className="font-semibold text-violet-700">เลือกกรองตามระดับชั้น ห้องเรียน รายวิชา และใบงาน</span> ด้านบนเพื่อแสดงรายการส่งงานได้ทันที หรือพิมพ์ชื่อนักเรียนเพื่อตรวจดูว่า <span className="font-semibold text-rose-600">มีงานชิ้นไหนที่ยังไม่ส่งบ้าง</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-100/80 via-purple-100/80 to-pink-100/80 border border-purple-200/80 rounded-2xl text-xs text-violet-900 font-medium shadow-xs">
              <span>💡</span>
              <span>เลือก ชั้น / ห้อง / วิชา / ใบงาน หรือพิมพ์ชื่อนักเรียนในช่องค้นหาด้านบน</span>
            </div>
            {onNavigateToSubmit && (
              <button
                onClick={() => handleQuickSubmit()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>ไปที่หน้าส่งงาน</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Student Profile & 4 Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: งานที่ส่งแล้ว */}
            <div 
              onClick={() => setActiveSubTab('submitted')}
              className={`p-4 md:p-5 rounded-2xl border transition-all cursor-pointer shadow-md ${
                activeSubTab === 'submitted'
                  ? 'bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-400 ring-2 ring-indigo-300'
                  : 'bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border-indigo-200/70 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between text-indigo-700 mb-1">
                <span className="text-xs font-bold uppercase flex items-center gap-1">
                  <span>📑</span> งานที่ส่งแล้ว
                </span>
                <Layers size={18} />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-indigo-950">{studentTotalCount}</div>
              <div className="text-[11px] text-indigo-700 mt-0.5">ชิ้นงานที่ส่งในระบบ ✨</div>
            </div>

            {/* Card 2: งานค้างส่ง (Highlight Warning) */}
            <div 
              onClick={() => setActiveSubTab('pending')}
              className={`p-4 md:p-5 rounded-2xl border transition-all cursor-pointer shadow-md ${
                activeSubTab === 'pending'
                  ? 'bg-gradient-to-br from-amber-100 to-rose-100 border-amber-400 ring-2 ring-amber-300'
                  : 'bg-gradient-to-br from-amber-50/90 to-orange-50/90 border-amber-200/70 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between text-amber-800 mb-1">
                <span className="text-xs font-bold uppercase flex items-center gap-1">
                  <span>⚠️</span> งานที่ค้างส่ง
                </span>
                <AlertCircle size={18} className={studentPendingCount > 0 ? 'text-rose-500 animate-pulse' : 'text-amber-500'} />
              </div>
                <div className="text-2xl md:text-3xl font-extrabold text-amber-950 flex items-baseline gap-1.5">
                  <span className={!hasSearched ? 'text-amber-700' : studentPendingCount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {hasSearched ? studentPendingCount : '-'}
                  </span>
                  <span className="text-xs text-gray-500 font-normal">งาน</span>
                </div>
                <div className="text-[11px] font-medium text-amber-900 mt-0.5">
                  {!hasSearched
                    ? '🔍 พิมพ์ชื่อนักเรียนเพื่อเช็คงานค้างส่ง'
                    : studentPendingCount > 0 ? '🔴 มีงานที่ยังไม่ได้ส่ง (คลิกเพื่อเช็ค)' : '✅ ส่งครบทุกงานแล้ว 🎉'}
                </div>
              </div>

              {/* Card 3: ตรวจแล้ว */}
              <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/90 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-emerald-200/70 shadow-md shadow-emerald-100/40">
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                  <span className="text-xs font-bold uppercase flex items-center gap-1">
                    <span>✅</span> ตรวจแล้ว
                  </span>
                  <CheckCircle size={18} />
                </div>
                <div className="text-2xl md:text-3xl font-extrabold text-emerald-950">{studentGradedCount}</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  {studentTotalCount > 0 ? Math.round((studentGradedCount / studentTotalCount) * 100) : 0}% ของงานที่ส่ง
                </div>
              </div>

              {/* Card 4: คะแนนสะสม */}
              <div className="bg-gradient-to-br from-pink-50/90 to-rose-50/90 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-pink-200/70 shadow-md shadow-pink-100/40">
                <div className="flex items-center justify-between text-pink-700 mb-1">
                  <span className="text-xs font-bold uppercase flex items-center gap-1">
                    <span>🏆</span> คะแนนรวมสะสม
                  </span>
                  <Award size={18} />
                </div>
                <div className="text-2xl md:text-3xl font-extrabold text-pink-950 flex items-baseline gap-1">
                  <span>{studentTotalEarned}</span>
                  <span className="text-xs text-gray-500 font-normal">/ {studentTotalMax}</span>
                </div>
                <div className="text-[11px] text-pink-700 mt-0.5">
                  {studentTotalMax > 0 ? `${Math.round((studentTotalEarned / studentTotalMax) * 100)}% ของคะแนนเต็ม 🌟` : 'คะแนนสะสม'}
                </div>
              </div>
            </div>

            {/* Quick Subject Filter Bar (คลิกเลือกแต่ละวิชาเพื่อดูงานที่ยังไม่ส่งได้ทันที) */}
            {availableSubjects.length > 0 && (
              <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-md border border-purple-100/80 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-950">
                    <BookOpen size={14} className="text-violet-600" />
                    <span>📚 เลือกกรองตามรายวิชา {hasSearched ? '(เช็คงานที่ยังไม่ส่งแยกวิชา)' : '(คลิกเพื่อกรองแสดงเฉพาะวิชานั้น)'}:</span>
                  </div>
                  {selectedSubject !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedSubject('ALL')}
                      className="text-[11px] font-bold text-violet-700 hover:text-violet-900 underline cursor-pointer"
                    >
                      แสดงทุกรายวิชา
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSubject('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                      selectedSubject === 'ALL'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500 shadow-xs'
                        : 'bg-purple-50/50 hover:bg-purple-100/70 text-gray-700 border-purple-200/70'
                    }`}
                  >
                    <span>🌟 ทุกรายวิชา</span>
                    {hasSearched ? (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        selectedSubject === 'ALL'
                          ? 'bg-white/20 text-white'
                          : allPendingAssignments.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {allPendingAssignments.length > 0 ? `ค้าง ${allPendingAssignments.length}` : 'ครบ'}
                      </span>
                    ) : (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        selectedSubject === 'ALL' ? 'bg-white/20 text-white' : 'bg-purple-100 text-violet-700'
                      }`}>
                        {studentAllSubmissions.length}
                      </span>
                    )}
                  </button>

                  {availableSubjects.map(subj => {
                    const isActive = selectedSubject.toLowerCase() === subj.value.toLowerCase();
                    const subjSubmittedCount = studentAllSubmissions.filter(s => matchesSubjectFilter(subj.value, s.subjectCode, s.subjectName)).length;
                    return (
                      <button
                        key={subj.value}
                        type="button"
                        onClick={() => setSelectedSubject(subj.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500 shadow-xs'
                            : 'bg-white hover:bg-purple-50 text-gray-800 border-purple-200/80'
                        }`}
                      >
                        <span>{subj.label}</span>
                        {hasSearched ? (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : subj.pendingCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {subj.pendingCount > 0 ? `ยังไม่ส่ง ${subj.pendingCount}` : '✓ ครบ'}
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            isActive ? 'bg-white/25 text-white' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            ส่ง {subjSubmittedCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Sub-Tabs: 1. งานที่ส่งแล้ว / 2. งานที่ค้างส่ง / 3. สรุปรายวิชา */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-purple-200/80 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tab 1: งานที่ส่งแล้ว */}
              <button
                onClick={() => setActiveSubTab('submitted')}
                className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                  activeSubTab === 'submitted'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500 shadow-md shadow-violet-200'
                    : 'bg-white/90 hover:bg-white text-gray-700 border-purple-200'
                }`}
              >
                <span>📑 งานที่ส่งแล้ว</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${activeSubTab === 'submitted' ? 'bg-white/20 text-white' : 'bg-purple-100 text-violet-800'}`}>
                  {studentTotalCount}
                </span>
              </button>

              {/* Tab 2: งานที่ค้างส่ง */}
              <button
                onClick={() => setActiveSubTab('pending')}
                className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                  activeSubTab === 'pending'
                    ? 'bg-gradient-to-r from-rose-600 via-amber-600 to-yellow-600 text-white border-amber-500 shadow-md shadow-amber-900/20'
                    : 'bg-white/90 hover:bg-white text-gray-700 border-amber-200'
                }`}
              >
                <span>⚠️ งานที่ค้างส่ง (ยังไม่ส่ง)</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  activeSubTab === 'pending'
                    ? 'bg-white/20 text-white'
                    : hasSearched && studentPendingCount > 0 ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {hasSearched ? studentPendingCount : 'เช็ครายบุคคล'}
                </span>
              </button>

              {/* Tab 3: สรุปแยกตามรายวิชา */}
              <button
                onClick={() => setActiveSubTab('subjects')}
                className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                  activeSubTab === 'subjects'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-md shadow-emerald-200'
                    : 'bg-white/90 hover:bg-white text-gray-700 border-emerald-200'
                }`}
              >
                <span>📚 สรุปสถานะแยกตามรายวิชา</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${activeSubTab === 'subjects' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {filteredSubjectGroups.length} วิชา
                </span>
              </button>
            </div>

            {/* Quick Add Button */}
            {onNavigateToSubmit && (
              <button
                onClick={() => handleQuickSubmit()}
                className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Plus size={14} />
                <span>เพิ่มงานที่ส่ง</span>
              </button>
            )}
          </div>

          {/* Inline Missing Summary Banner when a specific subject is filtered on Tab 1 and a student was searched */}
          {activeSubTab === 'submitted' && hasSearched && selectedSubject !== 'ALL' && (
            <div className={`rounded-3xl p-4 sm:p-5 border shadow-md space-y-3 ${
              pendingAssignments.length > 0
                ? 'bg-gradient-to-r from-amber-50 via-rose-50/70 to-orange-50 border-amber-300'
                : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{pendingAssignments.length > 0 ? '⚠️' : '🎉'}</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      วิชา {selectedSubjectInfo?.label}: {pendingAssignments.length > 0 ? `มีงานที่ยังไม่ส่ง ${pendingAssignments.length} งาน` : 'ส่งงานครบทุกชิ้นในวิชานี้แล้ว!'}
                    </h3>
                    <p className="text-xs text-gray-600">
                      {pendingAssignments.length > 0
                        ? 'รายการด้านล่างคืองานในวิชานี้ที่ยังไม่มีประวัติการส่งของคุณ'
                        : 'ไม่พบงานค้างส่งในรายวิชาที่เลือก'}
                    </p>
                  </div>
                </div>
                {pendingAssignments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('pending')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
                  >
                    ดูรายละเอียดงานค้างส่งทั้งหมด →
                  </button>
                )}
              </div>

              {pendingAssignments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {pendingAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white/95 rounded-2xl p-3 border border-amber-200/90 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                            ยังไม่ส่ง
                          </span>
                          <span className="text-xs font-bold text-gray-900 truncate" title={a.title}>
                            {a.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          💯 เต็ม {a.maxScore} คะแนน • ครู{a.teacherName}
                        </div>
                      </div>
                      {onNavigateToSubmit && (
                        <button
                          type="button"
                          onClick={() => handleQuickSubmit(a)}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-[11px] font-bold shadow-xs shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          <Send size={11} />
                          <span>ส่งงานนี้</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: งานที่ส่งแล้ว (SUBMITTED) */}
          {activeSubTab === 'submitted' && (
            <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl shadow-purple-100/30 border border-purple-100/70 overflow-hidden">
              {filteredSubmissions.length > 0 && (
                <div className="p-4 sm:p-5 bg-gradient-to-r from-violet-50/70 via-purple-50/60 to-pink-50/70 border-b border-purple-100/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-600">รายการผลงานที่ส่ง:</span>
                    {hasSearched && (
                      <span className="px-3 py-1 bg-white border border-purple-200 rounded-full text-xs font-bold text-violet-700 shadow-xs">
                        🧑‍🎓 {searchTerm}
                      </span>
                    )}
                    {selectedGrade !== 'ALL' && (
                      <span className="px-3 py-1 bg-white border border-indigo-200 rounded-full text-xs font-bold text-indigo-700 shadow-xs">
                        🏫 {selectedGrade}
                      </span>
                    )}
                    {selectedRoom !== 'ALL' && (
                      <span className="px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-bold text-blue-700 shadow-xs">
                        🚪 ห้อง {selectedRoom}
                      </span>
                    )}
                    {selectedSubjectInfo && (
                      <span className="px-3 py-1 bg-white border border-purple-200 rounded-full text-xs font-bold text-purple-800 shadow-xs">
                        📚 {selectedSubjectInfo.label}
                      </span>
                    )}
                    {selectedAssignmentInfo && (
                      <span className="px-3 py-1 bg-white border border-teal-200 rounded-full text-xs font-bold text-teal-800 shadow-xs">
                        📝 {selectedAssignmentInfo.title}
                      </span>
                    )}
                    <span className="text-xs text-purple-600 font-medium">({studentTotalCount} ชิ้นงาน)</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    💡 คลิกปุ่ม <span className="font-bold text-violet-700">👁️ ดูข้อมูล</span> เพื่อดูรายละเอียดคะแนนและคำแนะนำจากคุณครู
                  </span>
                </div>
              )}

              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                    <Search size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {hasSearched
                      ? `ยังไม่มีประวัติการส่งงานของนักเรียน "${searchTerm}" ตามตัวกรองที่เลือก`
                      : 'ไม่พบประวัติการส่งงานตามตัวกรอง ชั้น / ห้อง / วิชา / ใบงาน ที่เลือก'}
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    {hasSearched
                      ? <>หากคุณยังไม่ได้ส่งงาน สามารถคลิกปุ่มด้านล่างเพื่อเริ่มส่งงาน หรือคลิกแท็บ <span className="font-bold text-rose-600">"งานที่ค้างส่ง"</span> เพื่อดูว่ามีงานอะไรบ้าง</>
                      : 'ลองปรับตัวกรองด้านบน หรือคลิกปุ่มด้านล่างเพื่อเริ่มส่งงาน'}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                    {onNavigateToSubmit && (
                      <button
                        onClick={() => handleQuickSubmit()}
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:scale-102 transition-all flex items-center gap-1.5"
                      >
                        <Plus size={15} />
                        <span>➕ ส่งงานใหม่</span>
                      </button>
                    )}
                    {hasSearched && (
                      <button
                        onClick={() => setActiveSubTab('pending')}
                        className="px-5 py-2.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        <span>⚠️ ดูงานที่ค้างส่ง</span>
                      </button>
                    )}
                    {hasActiveFilter && (
                      <button
                        onClick={handleResetAllFilters}
                        className="px-5 py-2.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors cursor-pointer"
                      >
                        <span>🔄 ล้างตัวกรอง</span>
                      </button>
                    )}
                  </div>
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
                        <th className="py-4 px-4 text-center">💯 คะแนน</th>
                        <th className="py-4 px-4 text-center">🏷️ สถานะ</th>
                        <th className="py-4 px-4 text-center">📎 ผลงาน</th>
                        <th className="py-4 px-4 text-center">⚙️ การจัดการ</th>
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
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-800 font-medium truncate" title={item.assignmentName}>
                                {item.assignmentName}
                              </span>
                              {item.workType && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-100/70 text-purple-900 text-[10px] font-semibold">
                                  🏷️ {item.workType}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              ครูผู้สอน: {item.teacherName}
                            </div>
                          </td>

                          {/* คะแนน */}
                          <td className="py-4 px-4 text-center">
                            {item.score !== null ? (
                              <div className="inline-flex flex-col items-center">
                                <div className="text-xl md:text-2xl font-black text-emerald-600 tracking-tight flex items-baseline gap-1">
                                  <span>{item.score}</span>
                                  <span className="text-xs text-gray-400 font-normal">/ {item.maxScore}</span>
                                </div>
                                <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/60 shadow-xs">
                                  🌟 ได้คะแนน
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

                          {/* สถานะ */}
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
                              <span>เปิดงาน</span>
                            </a>
                          </td>

                          {/* การจัดการ (ดูข้อมูล) */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center">
                              {/* 👁️ ดูข้อมูล */}
                              <button
                                onClick={() => setViewingDetail(item)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-purple-200 transition-colors cursor-pointer"
                                title="ดูรายละเอียดคะแนนและคำแนะนำ"
                              >
                                👁️ ดูข้อมูล
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: งานที่ค้างส่ง (PENDING / MISSING ASSIGNMENTS) */}
          {activeSubTab === 'pending' && (
            <div className="space-y-4">
              {/* Filter by subject for pending assignments */}
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-xl shadow-amber-950/5 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-bold">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      รายการงานที่ยังไม่ส่ง {targetGrade !== 'ALL' ? `สำหรับชั้น ${targetGrade}` : ''}
                      {selectedSubject !== 'ALL' && selectedSubjectInfo ? ` • วิชา ${selectedSubjectInfo.label}` : ''}
                      {selectedAssignmentInfo ? ` • ${selectedAssignmentInfo.title}` : ''}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {hasSearched
                        ? <>ตรวจพบงานที่ยังไม่ได้ส่งทั้งหมด <b className="text-rose-600">{pendingAssignments.length}</b> ชิ้นงาน</>
                        : 'พิมพ์ชื่อนักเรียนในช่องค้นหาด้านบน เพื่อตรวจเช็กงานที่ยังไม่ส่งรายบุคคล'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 whitespace-nowrap">กรองตามวิชา:</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="ALL">🌟 ทุกรายวิชา ({allPendingAssignments.length} งาน)</option>
                    {availableSubjects.map(s => (
                      <option key={s.value} value={s.value}>
                        {s.label}{hasSearched ? ` (${s.pendingCount > 0 ? `ยังไม่ส่ง ${s.pendingCount}` : 'ส่งครบแล้ว'})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!hasSearched ? (
                <div className="bg-white/95 rounded-3xl p-10 text-center border border-amber-200 shadow-sm space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl">
                    🧑‍🎓
                  </div>
                  <h4 className="text-base font-bold text-gray-900">กรุณาพิมพ์ชื่อนักเรียนเพื่อตรวจสอบงานที่ยังไม่ส่ง</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    การตรวจสอบงานค้างส่งต้องระบุชื่อหรือนามสกุลของนักเรียน ส่วนรายการที่ส่งแล้วตาม ชั้น / ห้อง / วิชา / ใบงาน สามารถดูได้ในแท็บ <b>"📑 งานที่ส่งแล้ว"</b>
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('submitted')}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ดูรายการงานที่ส่งแล้ว ({studentTotalCount}) →
                  </button>
                </div>
              ) : pendingAssignments.length === 0 ? (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 rounded-3xl p-10 md:p-14 text-center border-2 border-emerald-300 shadow-xl space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-4xl shadow-lg shadow-emerald-200">
                    🎉
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-emerald-950">
                    ยอดเยี่ยมมาก! ไม่มีงานค้างส่ง{selectedSubject !== 'ALL' && selectedSubjectInfo ? ` ในวิชา ${selectedSubjectInfo.label}` : targetGrade !== 'ALL' ? ` ในระดับชั้น ${targetGrade}` : ''}
                  </h3>
                  <p className="text-sm text-emerald-800 max-w-md mx-auto">
                    นักเรียน <b>{detectedStudentInfo.studentName}</b> ได้ส่งงานครบถ้วนเรียบร้อยแล้ว หรือยังไม่มีการมอบหมายงานเพิ่มเติมในหมวดนี้ ✨
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    {selectedSubject !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setSelectedSubject('ALL')}
                        className="px-5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold rounded-2xl text-xs shadow-xs transition-all cursor-pointer"
                      >
                        🌟 ดูงานค้างส่งทุกรายวิชา ({allPendingAssignments.length})
                      </button>
                    )}
                    <button
                      onClick={() => setActiveSubTab('submitted')}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all cursor-pointer"
                    >
                      ดูผลงานและคะแนนที่คุณส่งแล้ว →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingAssignments.map((assignment) => (
                    <div 
                      key={assignment.id}
                      className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-lg shadow-amber-950/5 border-2 border-amber-200/90 hover:border-amber-400 transition-all flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-3">
                        {/* Header: Subject & Missing Tag */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-violet-100 text-violet-800 border border-violet-200">
                              {assignment.subjectCode}
                            </span>
                            <span className="text-xs font-bold text-gray-800">
                              {assignment.subjectName}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                            <span>ยังไม่ส่ง</span>
                          </span>
                        </div>

                        {/* Title */}
                        <div>
                          <h4 className="text-base font-bold text-gray-900 leading-snug group-hover:text-amber-700 transition-colors">
                            {assignment.title}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            ครูผู้สอน: <b>{assignment.teacherName}</b>
                          </p>
                        </div>

                        {/* Badges: Work Type & Max Score */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          {assignment.workType && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 font-semibold">
                              🏷️ {assignment.workType}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-black">
                            💯 คะแนนเต็ม {assignment.maxScore} คะแนน
                          </span>
                          {assignment.academicYear && (
                            <span className="px-2 py-0.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 text-[11px]">
                              ปี {assignment.academicYear}/{assignment.semester || '1'}
                            </span>
                          )}
                        </div>

                        {/* Criteria / Rubric snippet */}
                        {assignment.rubricCriteria && (
                          <div className="p-2.5 bg-gray-50 rounded-xl text-[11px] text-gray-600 border border-gray-100 line-clamp-2">
                            <b>เกณฑ์:</b> {assignment.rubricCriteria}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        {assignment.sampleUrl ? (
                          <a
                            href={assignment.sampleUrl.startsWith('http') ? assignment.sampleUrl : `https://${assignment.sampleUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-violet-700 hover:text-violet-900 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>📎 ตัวอย่างใบงาน</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">ไม่มีไฟล์ตัวอย่าง</span>
                        )}

                        {onNavigateToSubmit && (
                          <button
                            type="button"
                            onClick={() => handleQuickSubmit(assignment)}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-200 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102"
                          >
                            <Send size={13} />
                            <span>🚀 ส่งงานนี้ทันที</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: สรุปสถานะแยกตามรายวิชา (SUBJECT OVERVIEW) */}
          {activeSubTab === 'subjects' && (
            <div className="space-y-4">
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-xl shadow-purple-100/20 border border-purple-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold">
                    📚
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      สรุปความก้าวหน้าและงานที่ยังไม่ส่งแยกตามรายวิชา
                    </h3>
                    <p className="text-xs text-gray-500">
                      เลือกรายวิชาเพื่อตรวจสอบว่าแต่ละวิชามีงานทั้งหมดกี่ชิ้น และมีงานไหนที่ยังไม่ส่งบ้าง
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="px-3 py-1.5 bg-purple-50/50 border border-purple-200 rounded-xl text-xs font-bold text-violet-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <option value="ALL">🌟 ทุกรายวิชา ({subjectGroups.length})</option>
                    {availableSubjects.map(s => (
                      <option key={s.value} value={s.value}>
                        {s.label} ({s.pendingCount > 0 ? `ยังไม่ส่ง ${s.pendingCount}` : 'ครบ'})
                      </option>
                    ))}
                  </select>

                  {hasSearched && (
                    <button
                      type="button"
                      onClick={() => setShowOnlyPendingInSubjects(prev => !prev)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        showOnlyPendingInSubjects
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                      }`}
                    >
                      {showOnlyPendingInSubjects ? '⚠️ แสดงเฉพาะงานที่ยังไม่ส่ง (เปิดอยู่)' : '🔍 แสดงเฉพาะงานที่ยังไม่ส่ง'}
                    </button>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-1 ${filteredSubjectGroups.length === 1 ? '' : 'md:grid-cols-2'} gap-4`}>
                {filteredSubjectGroups.map((group) => {
                  const submittedAssignCount = group.totalAssignments.filter(a => Boolean(findMatchingSubmission(a, group.submitted))).length;
                  const percent = group.totalAssignments.length > 0
                    ? Math.min(100, Math.round((submittedAssignCount / group.totalAssignments.length) * 100))
                    : 100;
                  const isAllDone = group.pending.length === 0;
                  const displayedAssignments = (hasSearched && showOnlyPendingInSubjects)
                    ? group.pending
                    : group.totalAssignments;

                  return (
                    <div 
                      key={group.filterValue || `${group.code}-${group.name}`}
                      className="bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-md border border-purple-100 space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Subject Title */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-violet-100 text-violet-800 border border-violet-200">
                                {group.code}
                              </span>
                              <h4 className="text-base font-bold text-gray-900">
                                {group.name}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              ครูผู้สอน: {group.teacherName}
                            </p>
                          </div>

                          {hasSearched ? (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                              isAllDone
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {isAllDone ? '✅ ส่งครบแล้ว' : `⚠️ ยังไม่ส่ง ${group.pending.length} งาน`}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                              📑 ส่งแล้ว {group.submitted.length} ชิ้น
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                            <span>{hasSearched ? 'ความก้าวหน้าการส่งงาน' : 'ใบงานที่มีการส่งแล้ว'}</span>
                            <span className="text-violet-700">{submittedAssignCount}/{group.totalAssignments.length} ใบงาน ({percent}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all rounded-full ${
                                isAllDone ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-amber-500 to-rose-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Score overview in this subject */}
                        <div className="p-3 bg-purple-50/40 rounded-2xl border border-purple-100/70 flex items-center justify-between text-xs">
                          <span className="text-gray-600 font-medium">
                            {hasSearched ? 'คะแนนสะสมในวิชานี้:' : 'จำนวนผลงานที่ส่งตามตัวกรอง:'}
                          </span>
                          {hasSearched ? (
                            <span className="font-extrabold text-violet-900 text-sm">
                              {group.earnedScore} <span className="text-gray-400 font-normal">/ {group.maxScore} คะแนน</span>
                            </span>
                          ) : (
                            <span className="font-extrabold text-violet-900 text-sm">
                              {group.submitted.length} <span className="text-gray-400 font-normal">ชิ้นงาน</span>
                            </span>
                          )}
                        </div>

                        {/* List of assignments in this subject */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                            <span>{hasSearched && showOnlyPendingInSubjects ? 'รายการงานที่ยังไม่ส่งในวิชานี้:' : 'รายการงานในวิชานี้:'}</span>
                            {hasSearched && !isAllDone && !showOnlyPendingInSubjects && (
                              <span className="text-rose-600 font-bold">ค้าง {group.pending.length} ชิ้น</span>
                            )}
                          </div>
                          {displayedAssignments.length === 0 ? (
                            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs font-semibold text-emerald-800 text-center">
                              🎉 ส่งงานครบทุกชิ้นในวิชานี้แล้ว ไม่มีงานค้างส่ง!
                            </div>
                          ) : (
                            displayedAssignments.map((a) => {
                              const sub = findMatchingSubmission(a, group.submitted);
                              const matchedCount = group.submitted.filter(s =>
                                (a.id && s.assignmentId && s.assignmentId === a.id) ||
                                (a.title && s.assignmentName && a.title.trim().toLowerCase() === s.assignmentName.trim().toLowerCase())
                              ).length;

                              return (
                                <div 
                                  key={a.id}
                                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                    sub 
                                      ? 'bg-emerald-50/40 border-emerald-100 text-gray-800'
                                      : hasSearched ? 'bg-rose-50/60 border-rose-200 text-gray-900' : 'bg-gray-50/70 border-gray-200 text-gray-800'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate flex items-center gap-1.5" title={a.title}>
                                      {hasSearched && !sub && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-black shrink-0">
                                          ยังไม่ส่ง
                                        </span>
                                      )}
                                      <span className="truncate">{a.title}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                      คะแนนเต็ม {a.maxScore} คะแนน {a.workType ? `• 🏷️ ${a.workType}` : ''}
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-1.5">
                                    {hasSearched ? (
                                      sub ? (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px] flex items-center gap-0.5">
                                          <CheckCircle size={10} />
                                          <span>ส่งแล้ว {sub.score !== null ? `(${sub.score}/${sub.maxScore})` : ''}</span>
                                        </span>
                                      ) : (
                                        onNavigateToSubmit && (
                                          <button
                                            type="button"
                                            onClick={() => handleQuickSubmit(a)}
                                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                                          >
                                            <span>ส่งงานนี้</span>
                                            <span>→</span>
                                          </button>
                                        )
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedAssignment(a.id || a.title);
                                          setActiveSubTab('submitted');
                                        }}
                                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg font-bold text-[10px] cursor-pointer transition-colors"
                                      >
                                        ส่งแล้ว {matchedCount} ชิ้น →
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* DETAIL MODAL: ดูข้อมูลผลงานและคะแนน */}
      {viewingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-purple-100 space-y-6 relative max-h-[92vh] overflow-y-auto">
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
              {viewingDetail.workType && (
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-400">ชนิดของงาน:</span>
                  <span className="font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                    🏷️ {viewingDetail.workType}
                  </span>
                </div>
              )}
              {viewingDetail.sampleUrl && (
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-400">ตัวอย่างใบงานครู:</span>
                  <a
                    href={viewingDetail.sampleUrl.startsWith('http') ? viewingDetail.sampleUrl : `https://${viewingDetail.sampleUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-violet-700 hover:underline flex items-center gap-1"
                  >
                    <span>คลิกดูตัวอย่าง</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
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

              {/* Feedback from teacher */}
              <div className="pt-2">
                <span className="text-gray-500 font-bold flex items-center gap-1 mb-1">
                  <MessageSquare size={13} className="text-indigo-500" /> คำแนะนำ/ข้อเสนอแนะจากคุณครู:
                </span>
                <div className="p-3 bg-gray-50 rounded-xl text-gray-700 leading-relaxed border border-gray-100">
                  {viewingDetail.feedback || 'ยังไม่มีคำแนะนำเพิ่มเติมจากคุณครู'}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <a
                href={viewingDetail.workUrl.startsWith('http') ? viewingDetail.workUrl : `https://${viewingDetail.workUrl}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <ExternalLink size={14} /> เปิดดูไฟล์งานที่ส่ง
              </a>

              <button
                onClick={() => setViewingDetail(null)}
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
