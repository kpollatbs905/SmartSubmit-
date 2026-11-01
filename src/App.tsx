/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Send, 
  Search, 
  GraduationCap, 
  Settings, 
  RefreshCw, 
  Sparkles, 
  BookCheck,
  CheckCircle2,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';
import NavigationSidebar from './components/NavigationSidebar';
import StudentSubmissionView from './components/StudentSubmissionView';
import SubmissionStatusView from './components/SubmissionStatusView';
import TeacherPortalView from './components/TeacherPortalView';
import AdminConfigView from './components/AdminConfigView';
import { ActiveTab, Submission, Teacher, Assignment, GoogleSheetConfig } from './types';
import { FOOTER_CREDIT } from './constants';
import { storageService } from './services/storageService';
import { alertService } from './services/alertService';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('submit');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetConfig>(() => storageService.getSheetConfig());
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusSearchTerm, setStatusSearchTerm] = useState('');

  // Initialize data from LocalStorage
  const refreshAllLocalData = () => {
    setSubmissions(storageService.getSubmissions());
    setTeachers(storageService.getTeachers());
    setAssignments(storageService.getAssignments());
    setSheetConfig(storageService.getSheetConfig());
  };

  useEffect(() => {
    refreshAllLocalData();

    // Initial background sync from Google Sheet
    const currentConfig = storageService.getSheetConfig();
    if (currentConfig.scriptUrl) {
      storageService.syncFromGoogleSheet(currentConfig).then((res) => {
        if (res.success) {
          refreshAllLocalData();
        }
      });
    }

    // Auto-update every 25 seconds in the background quietly without popups
    const autoSyncTimer = setInterval(() => {
      const cfg = storageService.getSheetConfig();
      if (cfg.scriptUrl) {
        storageService.syncFromGoogleSheet(cfg).then((res) => {
          if (res.success) {
            refreshAllLocalData();
          }
        }).catch(() => {});
      }
    }, 25000);

    return () => clearInterval(autoSyncTimer);
  }, []);

  // Sync with Google Sheet
  const handleTriggerSync = async () => {
    const currentConfig = storageService.getSheetConfig();
    if (!currentConfig.scriptUrl) {
      alertService.info(
        'ยังไม่ได้ระบุ Web App URL',
        'กรุณาไปที่เมนู "4. ตั้งค่า Google Sheet (Admin)" เพื่อระบุ URL ของ Google Apps Script'
      );
      return;
    }

    try {
      setIsSyncing(true);
      alertService.loading('กำลังซิงค์ข้อมูลกับ Google Sheet...', 'กำลังดาวน์โหลดข้อมูลการส่งงาน ครู และใบงานล่าสุด');
      const res = await storageService.syncFromGoogleSheet(currentConfig);
      alertService.close();

      if (res.success) {
        refreshAllLocalData();
        alertService.success('ซิงค์ข้อมูลสำเร็จ! 🎉', res.message);
      } else {
        alertService.error('การซิงค์ข้อมูลไม่สำเร็จ', res.message);
      }
    } catch (err: any) {
      alertService.close();
      alertService.error('เกิดข้อผิดพลาดในการเชื่อมต่อ', err?.message || 'โปรดตรวจสอบสัญญาณอินเทอร์เน็ต');
    } finally {
      setIsSyncing(false);
    }
  };

  // Admin authentication prompt
  const handleRequestAdminAuth = async () => {
    const authorized = await alertService.promptAdminLogin();
    if (authorized) {
      setIsAdminAuthenticated(true);
      setActiveTab('admin');
    }
  };

  return (
    <div 
      className="min-h-screen w-full relative bg-cover bg-center bg-fixed font-['Kanit',sans-serif] text-gray-900 bg-neutral-950"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(10, 10, 12, 0.96) 0%, rgba(20, 20, 24, 0.93) 50%, rgba(6, 6, 8, 0.97) 100%), url('https://img1.pic.in.th/images/unnamed-3656f832b88724b5e7.png')`
      }}
    >
      {/* Sidebar Navigation */}
      <NavigationSidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        submissions={submissions}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isAdminAuthenticated={isAdminAuthenticated}
        onRequestAdminAuth={handleRequestAdminAuth}
      />

      {/* Main Content Container (offset by sidebar width on large screens) */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 bg-gradient-to-r from-yellow-200 via-amber-200 to-yellow-300 backdrop-blur-md border-b border-amber-400/80 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-md shadow-amber-950/15">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-amber-950 bg-amber-100/90 shadow-xs border border-amber-300 hover:bg-yellow-100 cursor-pointer transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* โรงเรียนท่าบ่อ Logo */}
            <img 
              src="https://img1.pic.in.th/images/images-39bd26cc1ba9520da.png" 
              alt="โลโก้โรงเรียนท่าบ่อ" 
              className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-2xl drop-shadow-md shrink-0 bg-white/60 p-1 border border-amber-300"
            />

            <div>
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <h1 className="text-xl md:text-2xl font-black text-amber-950 tracking-tight">
                  โรงเรียนท่าบ่อ
                </h1>
                <span className="text-xs md:text-sm font-bold text-amber-900/90">
                  สพม.หนองคาย
                </span>
                <span className="text-[10px] md:text-[11px] bg-yellow-100/95 text-amber-950 font-extrabold px-2 py-0.5 rounded-full border border-amber-300 shadow-xs">
                  ✨ ระบบออนไลน์
                </span>
              </div>
              <h2 className="text-xs md:text-sm font-bold text-amber-900 leading-tight flex items-center gap-1.5 mt-0.5">
                <span>ระบบตรวจงานให้คะแนน ออนไลน์</span>
                <span className="text-base">🎯</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Sync Live Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100/90 border border-emerald-300 rounded-full text-xs font-bold text-emerald-800 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>⚡ อัปเดตข้อมูลอัตโนมัติ</span>
            </div>
          </div>
        </header>

        {/* Tab Content Area */}
        <main className="flex-1 p-4 md:p-8">
          {activeTab === 'submit' && (
            <StudentSubmissionView
              teachers={teachers}
              assignments={assignments}
              sheetConfig={sheetConfig}
              onSubmissionSuccess={refreshAllLocalData}
              onNavigateToStatus={(studentName) => {
                if (studentName) {
                  setStatusSearchTerm(studentName);
                }
                setActiveTab('status');
              }}
            />
          )}

          {activeTab === 'status' && (
            <SubmissionStatusView
              submissions={submissions}
              sheetConfig={sheetConfig}
              onRefreshData={handleTriggerSync}
              initialSearchTerm={statusSearchTerm}
              onClearInitialSearch={() => setStatusSearchTerm('')}
            />
          )}

          {activeTab === 'teacher' && (
            <TeacherPortalView
              teachers={teachers}
              assignments={assignments}
              submissions={submissions}
              sheetConfig={sheetConfig}
              onRefreshData={handleTriggerSync}
              onAssignmentsChange={refreshAllLocalData}
              onSubmissionsChange={refreshAllLocalData}
            />
          )}

          {activeTab === 'admin' && (
            <AdminConfigView
              sheetConfig={sheetConfig}
              submissions={submissions}
              teachers={teachers}
              onConfigChange={(newCfg) => setSheetConfig(newCfg)}
              onTriggerSync={handleTriggerSync}
              onDataChange={refreshAllLocalData}
            />
          )}
        </main>

        {/* Bottom Footer (ส่วนท้าย) */}
        <footer className="mt-auto py-5 px-6 border-t border-neutral-800/90 bg-neutral-900/90 backdrop-blur-md text-center shadow-lg shadow-black/60">
          <div className="text-xs space-y-1">
            <p className="font-semibold text-neutral-200 flex items-center justify-center gap-1">
              <span>🌸</span> พัฒนาโดย ครูชมัยพร ถินสำราญ
            </p>
            <p className="text-neutral-400 flex items-center justify-center gap-1">
              <span>🏫</span> โรงเรียนท่าบ่อ  สพม.หนองคาย
            </p>
            <p className="text-amber-400 font-semibold flex items-center justify-center gap-1">
              <span>💖</span> ติดตามเพจ AI กับครูพอลล่า
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
