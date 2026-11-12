/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Layers,
  Trash2,
  AlertTriangle,
  Edit3,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
  HelpCircle,
  User,
  Hash,
  Save,
  X
} from 'lucide-react';
import Swal from 'sweetalert2';
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
  const [pendingSubjectFilter, setPendingSubjectFilter] = useState<string>('ALL');

  // Modal states
  const [viewingDetail, setViewingDetail] = useState<Submission | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);

  // Edit form state
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentNumber, setEditStudentNumber] = useState('');
  const [editGradeLevel, setEditGradeLevel] = useState<GradeLevel>('ม.1');
  const [editRoom, setEditRoom] = useState('1');
  const [editWorkUrl, setEditWorkUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Sync initialSearchTerm if changed from outside
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const hasSearched = searchTerm.trim().length > 0;

  // Filtered submissions for the searched student
  const filteredSubmissions = useMemo(() => {
    if (!hasSearched) {
      return [];
    }

    const q = searchTerm.trim().toLowerCase();

    return submissions.filter((item) => {
      const matchStudent = 
        item.studentName.toLowerCase().includes(q) ||
        item.studentNumber.toLowerCase() === q;

      const matchGrade = selectedGrade === 'ALL' || item.gradeLevel === selectedGrade;
      const matchRoom = selectedRoom === 'ALL' || item.room === selectedRoom;
      const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

      return matchStudent && matchGrade && matchRoom && matchStatus;
    });
  }, [submissions, searchTerm, hasSearched, selectedGrade, selectedRoom, selectedStatus]);

  // Detected student info from submissions
  const detectedStudentInfo = useMemo(() => {
    if (filteredSubmissions.length > 0) {
      const first = filteredSubmissions[0];
      return {
        studentName: first.studentName,
        studentNumber: first.studentNumber,
        gradeLevel: first.gradeLevel,
        room: first.room,
      };
    }
    return {
      studentName: searchTerm.trim(),
      studentNumber: '',
      gradeLevel: (selectedGrade !== 'ALL' ? (selectedGrade as GradeLevel) : 'ม.1'),
      room: (selectedRoom !== 'ALL' ? selectedRoom : '1'),
    };
  }, [filteredSubmissions, searchTerm, selectedGrade, selectedRoom]);

  // Set of submitted assignment keys (IDs and normalized titles)
  const submittedAssignmentKeys = useMemo(() => {
    const set = new Set<string>();
    filteredSubmissions.forEach(s => {
      if (s.assignmentId) set.add(s.assignmentId);
      if (s.assignmentName) set.add(s.assignmentName.trim().toLowerCase());
    });
    return set;
  }, [filteredSubmissions]);

  // Relevant assignments according to student grade (or all if grade is ALL)
  const targetGrade = selectedGrade !== 'ALL' ? selectedGrade : detectedStudentInfo.gradeLevel;

  const relevantAssignments = useMemo(() => {
    return assignments.filter(a => {
      // If a specific grade is chosen or detected, match subject code's grade
      if (targetGrade && targetGrade !== 'ALL') {
        const gradeFromCode = getGradeFromSubjectCode(a.subjectCode);
        if (gradeFromCode && gradeFromCode !== targetGrade) {
          return false;
        }
      }
      return true;
    });
  }, [assignments, targetGrade]);

  // Pending (missing) assignments for this student
  const pendingAssignments = useMemo(() => {
    if (!hasSearched) return [];
    return relevantAssignments.filter(a => {
      const isSubmitted = 
        submittedAssignmentKeys.has(a.id) || 
        submittedAssignmentKeys.has(a.title.trim().toLowerCase());
      
      if (isSubmitted) return false;

      // Subject filter
      if (pendingSubjectFilter !== 'ALL' && a.subjectCode !== pendingSubjectFilter) {
        return false;
      }

      return true;
    });
  }, [relevantAssignments, submittedAssignmentKeys, hasSearched, pendingSubjectFilter]);

  // Group all assignments by Subject for the "เช็คสถานะแยกตามรายวิชา" tab
  const subjectGroups = useMemo(() => {
    const map = new Map<string, {
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
      const key = `${a.subjectCode}-${a.subjectName}`;
      if (!map.has(key)) {
        map.set(key, {
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

      const sub = filteredSubmissions.find(s => 
        s.assignmentId === a.id || 
        s.assignmentName.trim().toLowerCase() === a.title.trim().toLowerCase()
      );

      if (sub) {
        item.submitted.push(sub);
        item.earnedScore += (sub.score || 0);
      } else {
        item.pending.push(a);
      }
    });

    return Array.from(map.values());
  }, [relevantAssignments, filteredSubmissions]);

  // Available subjects for filtering pending tasks
  const availablePendingSubjects = useMemo(() => {
    const unique = new Map<string, string>();
    relevantAssignments.forEach(a => {
      if (!unique.has(a.subjectCode)) {
        unique.set(a.subjectCode, `${a.subjectCode} ${a.subjectName}`);
      }
    });
    return Array.from(unique.entries()).map(([code, label]) => ({ code, label }));
  }, [relevantAssignments]);

  // Statistics for the searched student
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

  // Open Edit Modal for a submission
  const handleOpenEdit = (sub: Submission) => {
    setEditingSubmission(sub);
    setEditStudentName(sub.studentName);
    setEditStudentNumber(sub.studentNumber);
    setEditGradeLevel(sub.gradeLevel);
    setEditRoom(sub.room);
    setEditWorkUrl(sub.workUrl);
  };

  // Save Edit Submission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubmission) return;

    if (!editStudentName.trim()) {
      alertService.error('กรุณาระบุชื่อ-นามสกุล', 'โปรดกรอกชื่อและนามสกุลของนักเรียน');
      return;
    }
    if (!editStudentNumber.trim()) {
      alertService.error('กรุณาระบุเลขที่', 'โปรดกรอกเลขที่ของนักเรียน');
      return;
    }
    if (!editWorkUrl.trim()) {
      alertService.error('กรุณาระบุลิงก์งาน', 'โปรดกรอกหรือวาง URL ผลงาน');
      return;
    }

    try {
      setIsSavingEdit(true);
      alertService.loading('กำลังบันทึกการแก้ไข...', 'ระบบกำลังอัปเดตข้อมูลผลงานและซิงค์ข้อมูล');

      const res = await storageService.updateSubmissionStudent(
        editingSubmission.id,
        {
          studentName: editStudentName,
          studentNumber: editStudentNumber,
          gradeLevel: editGradeLevel,
          room: editRoom,
          workUrl: editWorkUrl,
        },
        sheetConfig
      );

      await onRefreshData();
      if (onDataChange) onDataChange();
      setIsSavingEdit(false);
      alertService.close();

      if (res.success) {
        setEditingSubmission(null);
        if (viewingDetail && viewingDetail.id === editingSubmission.id) {
          setViewingDetail({
            ...viewingDetail,
            studentName: editStudentName,
            studentNumber: editStudentNumber,
            gradeLevel: editGradeLevel,
            room: editRoom,
            workUrl: editWorkUrl,
          });
        }
        alertService.success('แก้ไขข้อมูลสำเร็จ! ✨', 'ข้อมูลผลงานได้รับการปรับปรุงเรียบร้อยแล้ว');
      } else {
        alertService.error('การแก้ไขไม่สำเร็จ', res.message);
      }
    } catch (err: any) {
      setIsSavingEdit(false);
      alertService.close();
      alertService.error('เกิดข้อผิดพลาด', err?.message || 'โปรดตรวจสอบการเชื่อมต่อ');
    }
  };

  // ตรวจสอบว่าชิ้นงานนี้เป็นงานที่ส่งซ้ำหรือไม่ (นักเรียนคนเดียวกัน ระดับชั้น/ห้องเดียวกัน ในวิชาและงานเดียวกัน)
  const isDuplicateItem = React.useCallback((item: Submission) => {
    const cleanItemName = stripThaiPrefix(item.studentName).toLowerCase();
    const cleanItemNum = String(item.studentNumber || '').trim();
    const cleanItemGrade = normalizeGradeLevel(item.gradeLevel);
    const cleanItemRoom = normalizeRoom(item.room);
    const cleanItemAssign = (item.assignmentName || '').trim().toLowerCase();

    return submissions.some(s => {
      if (s.id === item.id) return false;
      const cleanName = stripThaiPrefix(s.studentName).toLowerCase();
      const cleanNum = String(s.studentNumber || '').trim();
      const cleanGrade = normalizeGradeLevel(s.gradeLevel);
      const cleanRoom = normalizeRoom(s.room);
      const cleanAssign = (s.assignmentName || '').trim().toLowerCase();

      const sameStudent = (cleanNum && cleanItemNum && cleanNum === cleanItemNum && cleanGrade === cleanItemGrade && cleanRoom === cleanItemRoom) ||
        (cleanName && cleanName === cleanItemName && cleanGrade === cleanItemGrade && cleanRoom === cleanItemRoom);

      const sameAssignment = (s.assignmentId && item.assignmentId && s.assignmentId === item.assignmentId) ||
        (cleanAssign && cleanAssign === cleanItemAssign);

      return sameStudent && sameAssignment;
    });
  }, [submissions]);

  // รายการที่มีการส่งซ้ำในผลการค้นหา/กรอง
  const duplicateSubmissions = useMemo(() => {
    return filteredSubmissions.filter(s => isDuplicateItem(s));
  }, [filteredSubmissions, isDuplicateItem]);

  // Delete submission (any submission or duplicate) - ลบออกจากทั้งเครื่องและฐานข้อมูล Google Sheet
  const handleDeleteSubmission = async (item: Submission) => {
    const isDup = isDuplicateItem(item);

    const result = await Swal.fire({
      title: isDup ? '🗑️ ลบงานที่ส่งซ้ำออกจากฐานข้อมูล?' : '🗑️ ยืนยันการลบผลงานออกจากฐานข้อมูล?',
      html: `
        <div class="text-left text-xs space-y-2.5">
          <p class="font-bold text-gray-800 text-sm">ผลงาน: ${item.assignmentName}</p>
          <div class="p-2.5 bg-purple-50 rounded-xl border border-purple-200 text-gray-700 space-y-1">
            <p>🧑‍🎓 นักเรียน: <b>${item.studentName}</b> (เลขที่ ${item.studentNumber} ชั้น ${item.gradeLevel}/${item.room})</p>
            <p>📚 วิชา: ${item.subjectCode} ${item.subjectName}</p>
            <p>📅 ส่งเมื่อ: <b>${item.submittedAt}</b></p>
            <p>🏷️ สถานะ: <span class="font-bold ${item.status === 'ตรวจแล้ว' ? 'text-emerald-700' : 'text-amber-700'}">${item.status}</span> ${item.score !== null ? `(${item.score}/${item.maxScore} คะแนน)` : ''}</p>
          </div>
          <p class="text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-semibold">
            ⚠️ ระบบจะลบผลงานนี้ออกจากทั้งฐานข้อมูลและ Google Sheet อย่างถาวร ${isDup ? '(เพื่อลบรายการที่ส่งซ้ำออกให้เหลือชิ้นเดียว)' : '(สามารถส่งงานใหม่ได้ภายหลัง)'}
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🗑️ ยืนยันการลบออกจากฐานข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2.5 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2.5 rounded-xl text-xs font-bold',
      }
    });

    if (result.isConfirmed) {
      alertService.loading('กำลังลบงานออกจากฐานข้อมูล...', 'ระบบกำลังลบข้อมูลออกจากเครื่องและ Google Sheet อย่างถาวร');
      await storageService.deleteSubmission(item, sheetConfig);
      if (onDataChange) onDataChange();
      alertService.close();
      if (viewingDetail?.id === item.id) {
        setViewingDetail(null);
      }
      alertService.success('ลบข้อมูลออกจากฐานข้อมูลเรียบร้อยแล้ว ✨', `ลบผลงาน "${item.assignmentName}" ของ ${item.studentName} ออกจากระบบและ Google Sheet เรียบร้อยแล้ว`);
    }
  };

  // ลบงานที่ส่งซ้ำทั้งหมดอัตโนมัติ โดยเก็บผลงานชิ้นที่ดีที่สุด/ล่าสุดไว้ 1 ชิ้น
  const handleDeleteAllOlderDuplicates = async () => {
    if (duplicateSubmissions.length === 0) return;

    // จัดกลุ่มตามนักเรียนและงาน เพื่อหาชิ้นงานเก่าที่ต้องลบ (เก็บชิ้นล่าสุดไว้)
    const groups = new Map<string, Submission[]>();
    filteredSubmissions.forEach(s => {
      const cleanName = stripThaiPrefix(s.studentName).toLowerCase();
      const cleanNum = String(s.studentNumber || '').trim();
      const cleanGrade = normalizeGradeLevel(s.gradeLevel);
      const cleanRoom = normalizeRoom(s.room);
      const cleanAssign = (s.assignmentName || '').trim().toLowerCase();
      const groupKey = `${cleanName}_${cleanNum}_${cleanGrade}_${cleanRoom}_${cleanAssign}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(s);
    });

    const itemsToDelete: Submission[] = [];
    groups.forEach(list => {
      if (list.length > 1) {
        // เรียง: ถ้ามีตรวจแล้วให้เก็บไว้ก่อน ตามด้วยใหม่ไปเก่า
        const sorted = [...list].sort((a, b) => {
          if (a.score !== null && b.score === null) return -1;
          if (b.score !== null && a.score === null) return 1;
          return (b.id || '').localeCompare(a.id || '');
        });
        const olderDups = sorted.slice(1);
        itemsToDelete.push(...olderDups);
      }
    });

    if (itemsToDelete.length === 0) {
      alertService.info('ไม่พบรายการส่งซ้ำที่ต้องลบ');
      return;
    }

    const confirm = await Swal.fire({
      title: '🗑️ ลบงานส่งซ้ำออกจากฐานข้อมูล?',
      html: `
        <div class="text-left text-xs space-y-2.5">
          <p>ระบบตรวจพบรายการส่งงานซ้ำจำนวน <b>${itemsToDelete.length}</b> รายการ</p>
          <div class="text-violet-700 bg-violet-50 p-3 rounded-xl border border-violet-200 space-y-1">
            <p class="font-bold">💡 สิ่งที่ระบบจะดำเนินการ:</p>
            <p>• <b>เก็บผลงานที่ดีที่สุด/ล่าสุดไว้ 1 ชิ้น</b> สำหรับแต่ละงาน</p>
            <p>• ลบรายการส่งซ้ำชิ้นอื่นๆ ออกจากทั้งระบบและ Google Sheet ทันที</p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `🗑️ ยืนยันลบ ${itemsToDelete.length} รายการ`,
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-3xl font-[\'Kanit\',sans-serif]',
        confirmButton: 'px-4 py-2.5 rounded-xl text-xs font-bold',
        cancelButton: 'px-4 py-2.5 rounded-xl text-xs font-bold',
      }
    });

    if (confirm.isConfirmed) {
      alertService.loading('กำลังลบงานที่ส่งซ้ำ...', `ระบบกำลังลบข้อมูล ${itemsToDelete.length} รายการออกจากฐานข้อมูล`);
      await storageService.deleteMultipleSubmissions(itemsToDelete, sheetConfig);
      if (onDataChange) onDataChange();
      alertService.close();
      alertService.success('ลบงานส่งซ้ำเรียบร้อยแล้ว ✨', `ลบรายการส่งซ้ำจำนวน ${itemsToDelete.length} รายการออกจากฐานข้อมูลเรียบร้อยแล้ว`);
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
        studentName: detectedStudentInfo.studentName,
        studentNumber: detectedStudentInfo.studentNumber,
        gradeLevel: detectedStudentInfo.gradeLevel,
        room: detectedStudentInfo.room,
      });
    } else {
      onNavigateToSubmit({
        studentName: detectedStudentInfo.studentName,
        studentNumber: detectedStudentInfo.studentNumber,
        gradeLevel: detectedStudentInfo.gradeLevel,
        room: detectedStudentInfo.room,
      });
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
                <span>เช็คคะแนน แก้ไขงาน ลบงาน และตรวจดูว่ามีวิชาไหนค้างส่งงานใดบ้าง 🌸</span>
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
            <span className="text-base">🔒</span>
            <span className="font-medium">แสดงข้อมูลผลงาน คะแนน และรายการค้างส่งของนักเรียนที่พิมพ์ค้นหาเท่านั้น</span>
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
              placeholder="🔍 พิมพ์ชื่อ หรือ นามสกุล นักเรียน เพื่อเช็คสถานะและงานค้างส่งทันที (เช่น สมชาย หรือ ท่าบ่อ)..."
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

        <div className="text-[11px] text-gray-500 flex items-center justify-between flex-wrap gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span>⚡ ค้นหาแบบ Real-time: พิมพ์ชื่อจริง หรือนามสกุล เพื่อดูผลงาน คะแนน และเช็คงานที่ค้างส่ง</span>
          </div>
          {hasSearched && (
            <span className="text-violet-700 font-semibold">
              ระดับชั้นที่วิเคราะห์: {targetGrade}
            </span>
          )}
        </div>
      </div>

      {/* Main Content: Prompt when not searched, or Student Results when searched */}
      {!hasSearched ? (
        <div className="bg-gradient-to-b from-white/95 via-purple-50/30 to-pink-50/30 backdrop-blur-md rounded-3xl p-10 md:p-14 shadow-xl shadow-purple-100/30 border border-purple-100/80 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-pink-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-200 text-3xl">
            🔍
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <span>พิมพ์ชื่อนักเรียนเพื่อเช็คสถานะ & งานค้างส่ง</span>
              <span>✨</span>
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              ระบบสามารถ <span className="font-semibold text-violet-700">แก้ไข ลบ หรือเพิ่มงานที่ส่ง</span> และ <span className="font-semibold text-rose-600">ตรวจสอบได้ทันทีว่ามีวิชาไหนค้างส่งงานใดบ้าง</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-100/80 via-purple-100/80 to-pink-100/80 border border-purple-200/80 rounded-2xl text-xs text-violet-900 font-medium shadow-xs">
              <span>💡</span>
              <span>พิมพ์ชื่อหรือนามสกุลในช่องค้นหาด้านบน เพื่อเริ่มต้นตรวจสอบ</span>
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
                <span className={studentPendingCount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {studentPendingCount}
                </span>
                <span className="text-xs text-gray-500 font-normal">งาน</span>
              </div>
              <div className="text-[11px] font-medium text-amber-900 mt-0.5">
                {studentPendingCount > 0 ? '🔴 มีงานที่ยังไม่ได้ส่ง (คลิกเพื่อเช็ค)' : '✅ ส่งครบทุกงานแล้ว 🎉'}
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
                <span>⚠️ งานที่ค้างส่ง</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  activeSubTab === 'pending'
                    ? 'bg-white/20 text-white'
                    : studentPendingCount > 0 ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {studentPendingCount}
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
                  {subjectGroups.length} วิชา
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

          {/* TAB 1: งานที่ส่งแล้ว (SUBMITTED) */}
          {activeSubTab === 'submitted' && (
            <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl shadow-purple-100/30 border border-purple-100/70 overflow-hidden">
              {filteredSubmissions.length > 0 && (
                <div className="p-4 sm:p-5 bg-gradient-to-r from-violet-50/70 via-purple-50/60 to-pink-50/70 border-b border-purple-100/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-600">ผลงานที่ส่งของนักเรียน:</span>
                    <span className="px-3 py-1 bg-white border border-purple-200 rounded-full text-xs font-bold text-violet-700 shadow-xs">
                      🧑‍🎓 {searchTerm}
                    </span>
                    <span className="text-xs text-purple-600 font-medium">({studentTotalCount} ชิ้นงาน)</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    💡 คลิกปุ่ม <span className="font-bold text-violet-700">✏️ แก้ไข</span> เพื่อแก้ไขข้อมูลหรือเปลี่ยนลิงก์งาน | <span className="font-bold text-rose-600">🗑️ ลบ</span> เพื่อนำงานออก
                  </span>
                </div>
              )}

              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                    <Search size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">
                    ยังไม่มีประวัติการส่งงานของนักเรียน "{searchTerm}"
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    หากคุณยังไม่ได้ส่งงาน สามารถคลิกปุ่มด้านล่างเพื่อเริ่มส่งงาน หรือคลิกแท็บ <span className="font-bold text-rose-600">"งานที่ค้างส่ง"</span> เพื่อดูว่ามีงานอะไรบ้าง
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    {onNavigateToSubmit && (
                      <button
                        onClick={() => handleQuickSubmit()}
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:scale-102 transition-all flex items-center gap-1.5"
                      >
                        <Plus size={15} />
                        <span>➕ ส่งงานแรกของคุณเลย</span>
                      </button>
                    )}
                    <button
                      onClick={() => setActiveSubTab('pending')}
                      className="px-5 py-2.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <span>⚠️ ดูงานที่ค้างส่ง</span>
                    </button>
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

                          {/* การจัดการ (ดูข้อมูล / แก้ไขงาน / ลบงาน) */}
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 👁️ ดูข้อมูล */}
                              <button
                                onClick={() => setViewingDetail(item)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-purple-200 transition-colors cursor-pointer"
                                title="ดูรายละเอียดคะแนนและคำแนะนำ"
                              >
                                👁️ ดูข้อมูล
                              </button>

                              {/* ✏️ แก้ไขงาน */}
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="แก้ไขชื่อ เลขที่ หรือเปลี่ยนลิงก์งานที่ส่ง"
                              >
                                <Edit3 size={12} />
                                <span>แก้ไข</span>
                              </button>

                              {/* 🗑️ ลบงาน */}
                              <button
                                onClick={() => handleDeleteSubmission(item)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                title="ลบผลงานนี้ออกจากระบบ"
                              >
                                <Trash2 size={13} />
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
                      รายการงานที่ค้างส่งสำหรับชั้น {targetGrade}
                    </h3>
                    <p className="text-xs text-gray-500">
                      ตรวจพบงานที่ยังไม่ได้ส่งทั้งหมด {pendingAssignments.length} ชิ้นงาน
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 whitespace-nowrap">กรองตามวิชา:</label>
                  <select
                    value={pendingSubjectFilter}
                    onChange={(e) => setPendingSubjectFilter(e.target.value)}
                    className="px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="ALL">🌟 ทุกรายวิชา</option>
                    {availablePendingSubjects.map(s => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {pendingAssignments.length === 0 ? (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 rounded-3xl p-10 md:p-14 text-center border-2 border-emerald-300 shadow-xl space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-4xl shadow-lg shadow-emerald-200">
                    🎉
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-emerald-950">
                    ยอดเยี่ยมมาก! ไม่มีงานค้างส่งในระดับชั้น {targetGrade}
                  </h3>
                  <p className="text-sm text-emerald-800 max-w-md mx-auto">
                    นักเรียน <b>{detectedStudentInfo.studentName}</b> ได้ส่งงานครบถ้วนเรียบร้อยแล้ว หรือยังไม่มีการมอบหมายงานเพิ่มเติมในหมวดนี้ ✨
                  </p>
                  <div className="pt-2">
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
                            <span>ค้างส่ง</span>
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
                      สรุปความก้าวหน้าการส่งงานแยกตามรายวิชา
                    </h3>
                    <p className="text-xs text-gray-500">
                      ตรวจสอบว่าในแต่ละวิชามีงานทั้งหมดกี่ชิ้น ส่งแล้วกี่ชิ้น และค้างส่งกี่ชิ้น
                    </p>
                  </div>
                </div>

                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                  ทั้งหมด {subjectGroups.length} รายวิชา
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subjectGroups.map((group) => {
                  const percent = group.totalAssignments.length > 0
                    ? Math.round((group.submitted.length / group.totalAssignments.length) * 100)
                    : 100;
                  const isAllDone = group.pending.length === 0;

                  return (
                    <div 
                      key={group.code}
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

                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isAllDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isAllDone ? '✅ ส่งครบแล้ว' : `⚠️ ค้างส่ง ${group.pending.length} งาน`}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                            <span>ความก้าวหน้าการส่งงาน</span>
                            <span className="text-violet-700">{group.submitted.length}/{group.totalAssignments.length} งาน ({percent}%)</span>
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
                          <span className="text-gray-600 font-medium">คะแนนสะสมในวิชานี้:</span>
                          <span className="font-extrabold text-violet-900 text-sm">
                            {group.earnedScore} <span className="text-gray-400 font-normal">/ {group.maxScore} คะแนน</span>
                          </span>
                        </div>

                        {/* List of assignments in this subject */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            รายการงานในวิชานี้:
                          </div>
                          {group.totalAssignments.map((a) => {
                            const sub = group.submitted.find(s => 
                              s.assignmentId === a.id || 
                              s.assignmentName.trim().toLowerCase() === a.title.trim().toLowerCase()
                            );

                            return (
                              <div 
                                key={a.id}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                  sub 
                                    ? 'bg-emerald-50/40 border-emerald-100 text-gray-800'
                                    : 'bg-rose-50/40 border-rose-100 text-gray-800'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate" title={a.title}>
                                    {a.title}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    คะแนนเต็ม {a.maxScore} คะแนน {a.workType ? `• 🏷️ ${a.workType}` : ''}
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-1.5">
                                  {sub ? (
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
                                  )}
                                </div>
                              </div>
                            );
                          })}
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

              {/* Edit Button */}
              <button
                type="button"
                onClick={() => {
                  const target = viewingDetail;
                  setViewingDetail(null);
                  handleOpenEdit(target);
                }}
                className="px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit3 size={13} />
                <span>แก้ไขงาน</span>
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleDeleteSubmission(viewingDetail)}
                className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>ลบงาน</span>
              </button>

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

      {/* EDIT MODAL: นักเรียนแก้ไขข้อมูลและผลงานที่ส่ง (STUDENT EDIT MODAL) */}
      {editingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-purple-200 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-amber-200">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">แก้ไขผลงานที่ส่ง</h3>
                  <p className="text-xs text-gray-500 truncate max-w-xs">{editingSubmission.assignmentName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubmission(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* ชื่อ-นามสกุล */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <User size={13} className="text-violet-600" />
                  <span>ชื่อและนามสกุล ผู้ส่งงาน</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="เช่น ด.ช. ภูริพัฒน์ วงศ์สว่าง"
                  className="w-full px-3.5 py-2.5 bg-purple-50/20 border border-purple-200 rounded-xl text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              {/* เลขที่ ชั้น ห้อง */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Hash size={13} className="text-violet-600" />
                    <span>เลขที่</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={editStudentNumber}
                    onChange={(e) => setEditStudentNumber(e.target.value)}
                    className="w-full px-2.5 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-sm font-bold text-center text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ระดับชั้น <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editGradeLevel}
                    onChange={(e) => setEditGradeLevel(e.target.value as GradeLevel)}
                    className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-xs font-semibold cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    {GRADE_LEVELS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ห้อง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    className="w-full px-2 py-2 bg-purple-50/20 border border-purple-200 rounded-xl text-xs font-semibold cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    {ROOMS.map(r => (
                      <option key={r} value={r}>ห้อง {r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* แนบลิงก์งาน (URL) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ExternalLink size={13} className="text-violet-600" />
                    <span>แนบลิงก์ผลงานใหม่ (URL)</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-gray-400">Google Drive / Canva / YouTube / Docs</span>
                </label>
                <input
                  type="url"
                  required
                  value={editWorkUrl}
                  onChange={(e) => setEditWorkUrl(e.target.value)}
                  placeholder="https://drive.google.com/... หรือ ลิงก์ชิ้นงาน"
                  className="w-full px-3.5 py-2.5 bg-purple-50/20 border border-purple-200 rounded-xl text-xs font-mono text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  💡 หากเป็น Google Drive โปรดตั้งค่าเป็น <b>"ทุกคนที่มีลิงก์มีสิทธิ์ดู"</b> เพื่อให้คุณครูตรวจได้
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setEditingSubmission(null)}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข ✨'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
