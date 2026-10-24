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

    // If Google Apps Script is already configured, attempt background sync
    const currentConfig = storageService.getSheetConfig();
    if (currentConfig.scriptUrl && currentConfig.autoSync) {
      storageService.syncFromGoogleSheet(currentConfig).then((res) => {
        if (res.success) {
          refreshAllLocalData();
        }
      });
    }
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
      className="min-h-screen w-full relative bg-cover bg-center bg-fixed font-['Kanit',sans-serif] text-gray-900"
      style={{
        backgroundImage: `linear-gradient(rgba(240, 244, 255, 0.88), rgba(235, 242, 255, 0.92)), url('https://img1.pic.in.th/images/unnamed-3656f832b88724b5e7.png')`
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
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-white/60 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-gray-700 bg-white shadow-sm border border-gray-200 hover:bg-gray-50 cursor-pointer"
            >
              <Menu size={20} />
            </button>

            <div>
              <div className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                <Sparkles size={13} /> โรงเรียนท่าบ่อ สพม.หนองคาย
              </div>
              <h2 className="text-base md:text-lg font-extrabold text-gray-900 leading-tight">
                ระบบตรวจงานให้คะแนน ออนไลน์
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sync Button */}
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              title="ซิงค์ข้อมูลกับ Google Sheet"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-300 rounded-xl text-xs font-semibold text-gray-700 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin text-indigo-600' : 'text-gray-500'} />
              <span className="hidden sm:inline">ซิงค์ชีต</span>
            </button>

            {/* Live Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>ออนไลน์</span>
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
        <footer className="mt-auto py-5 px-6 border-t border-white/60 bg-white/70 backdrop-blur-sm text-center">
          <div className="text-xs space-y-1">
            <p className="font-semibold text-gray-800">พัฒนาโดย ครูชมัยพร ถินสำราญ</p>
            <p className="text-gray-600">โรงเรียนท่าบ่อ  สพม.หนองคาย</p>
            <p className="text-indigo-600 font-medium">ติดตามเพจ AI กับครูพอลล่า</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
