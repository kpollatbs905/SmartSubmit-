/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Send, 
  Search, 
  GraduationCap, 
  Settings, 
  X, 
  Sparkles, 
  BookCheck, 
  Lock 
} from 'lucide-react';
import { ActiveTab, Submission } from '../types';
import { FOOTER_CREDIT } from '../constants';

interface Props {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  submissions: Submission[];
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isAdminAuthenticated: boolean;
  onRequestAdminAuth: () => Promise<void>;
}

export default function NavigationSidebar({
  activeTab,
  onTabChange,
  submissions,
  isMobileOpen,
  setIsMobileOpen,
  isAdminAuthenticated,
  onRequestAdminAuth,
}: Props) {
  const handleTabClick = async (tab: ActiveTab) => {
    if (tab === 'admin' && !isAdminAuthenticated) {
      await onRequestAdminAuth();
      return;
    }
    onTabChange(tab);
    setIsMobileOpen(false);
  };

  const navItems = [
    {
      id: 'submit' as ActiveTab,
      label: '1. หน้าส่งงาน',
      sublabel: 'สำหรับนักเรียนส่งผลงาน',
      icon: Send,
    },
    {
      id: 'status' as ActiveTab,
      label: '2. ตรวจสอบสถานะการส่งงาน',
      sublabel: 'ค้นหาเฉพาะชื่อนักเรียน',
      icon: Search,
    },
    {
      id: 'teacher' as ActiveTab,
      label: '3. หน้าสำหรับครูผู้สอน',
      sublabel: 'ลงทะเบียน / เข้าสู่ระบบ / ตรวจงาน',
      icon: GraduationCap,
    },
    {
      id: 'admin' as ActiveTab,
      label: '4. ตั้งค่า Google Sheet (Admin)',
      sublabel: 'เชื่อมต่อชีตและ Apps Script',
      icon: Settings,
      locked: !isAdminAuthenticated,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md border-r border-white/60 shadow-2xl">
      {/* App Branding Header */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-700 text-white flex items-center justify-center shadow-md shadow-indigo-200">
            <BookCheck size={24} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
              <Sparkles size={11} /> โรงเรียนท่าบ่อ
            </div>
            <h1 className="text-sm font-extrabold text-gray-900 leading-tight">
              ระบบตรวจงานให้คะแนน ออนไลน์
            </h1>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Menu List */}
      <div className="p-4 flex-1 space-y-2 overflow-y-auto">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">
          เมนูหลัก
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full p-3 rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer group ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200'
                  : 'hover:bg-indigo-50/70 text-gray-700'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                }`}
              >
                <Icon size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                    {item.label}
                  </span>
                  {item.locked && (
                    <Lock size={12} className={isActive ? 'text-white/80' : 'text-amber-500'} />
                  )}
                </div>
                <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-indigo-100' : 'text-gray-400'}`}>
                  {item.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: ส่วนท้าย (ข้อความเล็ก) */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/70 text-center space-y-1">
        <p className="text-[11px] font-semibold text-gray-700">พัฒนาโดย ครูชมัยพร ถินสำราญ</p>
        <p className="text-[10px] text-gray-500">โรงเรียนท่าบ่อ  สพม.หนองคาย</p>
        <p className="text-[10px] text-indigo-600 font-medium">ติดตามเพจ AI กับครูพอลล่า</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-72 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
